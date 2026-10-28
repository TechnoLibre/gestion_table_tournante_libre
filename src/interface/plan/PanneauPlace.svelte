<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Le panneau de la place sélectionnée (§ 7.1, § 2.1 étape 6, § 4, § 5.9) :
  // ouvert quand l'état de navigation sélectionne un siège, {table, siege}.
  // Il nomme la place et sa ligne, le choix en attente, puis offre les
  // actions d'actionsPlace (modele.js) : assigner, réserver — portée au
  // choix —, donner un titre, désigner, retirer la réservation, retirer le
  // titre, déplacer la réservation ici. Assigner, réserver et désigner
  // portent sur la personne choisie (ui.choix), et le panneau invite à la
  // choisir tant qu'il n'y en a pas. Assigner donne ce que donne le dépôt
  // d'un glissement, par commandeDeDepot (depot.js) : une seule
  // implémentation du dépôt. Sous des sièges non attribués, un titre et une
  // désignation se posent sans siège : l'application prend le siège (A5).
  //
  // Toute commande passe par executerSurPlace : son refus se pose sur la place
  // du plan, sauf LIBELLE_VIDE, refusé à côté du champ du libellé. Un libellé
  // tapé que ni « Donner un titre » ni « Désigner » n'a encore appliqué est une
  // saisie non validée : un geste ouvert (geste.js), qui suspend le compte
  // d'inactivité de la séance (§ 8.4). La commande aboutie sur lui, une autre
  // place sélectionnée ou le panneau refermé le rendent ; un refus le laisse
  // ouvert, la saisie gardée. Le menu de l'occupant suit (MenuPersonne) ; il
  // reste celui de la même personne tant que la place reste sélectionnée, même
  // quand elle la quitte — une exclusion —, pour qu'elle se réintègre d'où elle
  // a été exclue.
  //
  // Échap referme le panneau et rend le focus à la racine du plan. Le
  // panneau lit 'seance' et 'ui' au contexte ; etatTour, l'état des places
  // du tour affiché, que SectionPlan calcule, ou null sans événement, et le
  // passe au menu.
  import { getContext, onDestroy, untrack } from 'svelte';
  import { libellePropose } from '../../application/places.js';
  import { nomsDesTours } from '../../application/tours.js';
  import Commande from '../primitives/Commande.svelte';
  import { creerGeste } from '../primitives/geste.js';
  import { effetDe } from '../raccourcis.js';
  import { commandeDeDepot } from './depot.js';
  import { libellePlace } from './gestes.js';
  import MenuPersonne from './MenuPersonne.svelte';
  import { actionsPlace, executerSurPlace, ligneListe, partiesLigne, textesLigne } from './modele.js';
  import { nomDeCharge } from './vue_plan.js';

  let { etatTour } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui');
  const uid = $props.id();

  const charge = $derived($seance.charge);
  // Les noms des tours, que les libellés d'un tour lisent (aides.js).
  const nomsTours = $derived(charge === null ? [] : nomsDesTours(charge));
  const selection = $derived($ui.selection);
  const place = $derived(charge !== null && selection !== null && (selection.siege ?? null) !== null ? selection : null);
  const etat = $derived(place === null ? null : etatTour);
  const tour = $derived(etatTour === null ? 1 : etatTour.tour);
  const etatTable = $derived(etat === null ? undefined : etat.tables.find(({ id }) => id === place.table));
  const chaise = $derived(etatTable === undefined ? null : (etatTable.chaises[place.siege - 1] ?? null));
  const nomDe = $derived(charge === null ? null : nomDeCharge(charge));
  const choix = $derived($ui.choix);
  const personne = $derived(choix !== null && choix.genre === 'personne' ? choix : null);
  const actions = $derived(chaise === null ? [] : actionsPlace(chaise, choix));
  const parties = $derived(chaise === null ? [] : partiesLigne(textesLigne(ligneListe(chaise, nomDe, null, nomsTours), t)));
  const nommee = $derived(etatTable === undefined ? null : libellePlace({ numero: etatTable.numero, siege: place.siege }));

  // Le libellé proposé : le titre pressenti de la personne choisie, sinon
  // celui de la place, sinon le plus fréquent (libellePropose, A5).
  const propose = $derived.by(() => {
    if (chaise === null) return '';
    if (personne !== null) return libellePropose(charge, personne.participant);
    return chaise.titre === null ? libellePropose(charge, 0) : chaise.titre.libelle;
  });
  // La saisie de l'opérateur, null tant qu'il n'a rien tapé ; le dernier
  // libellé qu'une commande aboutie a appliqué depuis le champ, null sans
  // lui ; la portée d'une réservation.
  let saisi = $state(null);
  let applique = $state(null);
  let portee = $state('tour');
  const libelleSaisi = $derived(saisi ?? propose);

  // Le geste suit la saisie tapée que rien n'a appliquée.
  const geste = creerGeste(seance);
  $effect(() => geste.tenir(saisi !== null && saisi !== applique));
  onDestroy(() => geste.liberer());

  // Le menu : la personne de la place au moment de sa sélection, ou la
  // première qui s'y assied ensuite.
  const occupant = $derived(chaise === null ? null : chaise.occupant);
  let menuDe = $state(null);
  let placeDuMenu = null;
  $effect(() => {
    const lue = place;
    const assise = occupant;
    untrack(() => {
      if (lue !== placeDuMenu) {
        placeDuMenu = lue;
        menuDe = assise;
        saisi = null;
        applique = null;
      } else if (menuDe === null) {
        menuDe = assise;
      }
    });
  });

  const dependances = { seance, ui };
  const sieges = () => (etat.siegesAttribues ? place.siege : null);

  async function assigner() {
    if (personne === null) return;
    const rendu = commandeDeDepot({
      etatPlaces: etat,
      tour,
      personne: personne.participant,
      depuis: personne.depuis,
      cible: { table: place.table, siege: place.siege },
      surLeSol: false,
    });
    if (rendu === null) return;
    if (Object.hasOwn(rendu, 'refus')) {
      ui.poserSurPlace({ place, refus: rendu.refus, avertissements: [] });
      return;
    }
    await executerSurPlace(dependances, place, rendu.commande, rendu.arguments);
  }

  async function reserver() {
    if (personne === null) return;
    await executerSurPlace(dependances, place, 'reserver', {
      participant: personne.participant,
      table: place.table,
      siege: place.siege,
      portee,
      tour: portee === 'tour' ? tour : null,
    });
  }

  // Exécute la commande sur le libellé du champ ; aboutie, elle l'applique.
  async function avecLibelle(commande, args) {
    const libelle = libelleSaisi;
    const rendu = await executerSurPlace(dependances, place, commande, { ...args, libelle }, { locaux: ['LIBELLE_VIDE'] });
    if (rendu !== null) applique = libelle;
  }

  async function donnerTitre() {
    await avecLibelle('poserTitre', { table: place.table, siege: sieges() });
  }

  async function designer() {
    if (personne === null) return;
    await avecLibelle('designer', { participant: personne.participant, table: place.table, siege: sieges() });
  }

  async function retirerReservation() {
    const { participant, portee: sienne, tour: sonTour } = chaise.reservation;
    await executerSurPlace(dependances, place, 'retirerReservation', { participant, table: place.table, portee: sienne, tour: sonTour });
  }

  async function retirerTitre() {
    await executerSurPlace(dependances, place, 'retirerTitre', { table: place.table, siege: place.siege });
  }

  async function deplacerReservationIci() {
    await executerSurPlace(dependances, place, 'deplacerReservation', {
      participant: choix.participant,
      de: choix.de,
      vers: { table: place.table, siege: place.siege },
    });
  }

  const EXECUTIONS = { assigner, reserver, donnerTitre, designer, retirerReservation, retirerTitre, deplacerReservationIci };

  // Échap referme le panneau et rend le focus à la racine du plan.
  function surTouche(evenement) {
    if (effetDe('fenetre', evenement.key) !== 'fermer') return;
    evenement.preventDefault();
    const racine = evenement.currentTarget.closest('[data-section]')?.querySelector('[data-plan]') ?? null;
    ui.selectionner(null);
    racine?.focus();
  }
</script>

{#if chaise !== null}
  <!-- Échap remonte des contrôles du panneau jusqu'à lui, qui se referme. -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <section class="panneau carte" data-panneau="place" tabindex="-1" aria-labelledby="{uid}-titre" onkeydown={surTouche}>
    <h3 id="{uid}-titre">{t(nommee.cle, nommee.details)}</h3>
    <div class="corps">
      <p class="ligne">
        {#each parties as { partie, texte } (partie)}<span class:titre={partie === 'titre'}>{texte}</span>{/each}
      </p>
      {#if choix !== null}
        <p class="choix" role="status">
          <span>{t(choix.genre === 'personne' ? 'plan.choix.personne' : 'plan.choix.reservation')}</span><span class="donnee"
            >{nomDe(choix.participant)}</span
          >
        </p>
      {:else if actions.includes('assigner')}
        <p class="invite">{t('plan.choix.inviter')}</p>
      {/if}
      {#if actions.includes('reserver')}
        <label class="champ">
          <span>{t('plan.portee.etiquette')}</span>
          <select data-champ="portee" value={portee} onchange={(evenement) => (portee = evenement.currentTarget.value)}>
            <option value="tour">{t('plan.portee.tour', { tour, nomsTours })}</option>
            <option value="tous">{t('plan.portee.tous')}</option>
          </select>
        </label>
      {/if}
      {#if actions.includes('donnerTitre') || actions.includes('designer')}
        <label class="champ">
          <span>{t('plan.titre.etiquette')}</span>
          <input type="text" data-champ="libelle" value={libelleSaisi} oninput={(evenement) => (saisi = evenement.currentTarget.value)} />
        </label>
      {/if}
      <div class="actions">
        {#each actions as action (action)}
          <Commande
            cle="plan.action.{action}"
            nom={action}
            executer={EXECUTIONS[action]}
            variante={action === 'assigner' ? 'principale' : 'secondaire'}
          />
        {/each}
        {#if choix !== null}
          <Commande cle="plan.choix.oublier" nom="oublierChoix" executer={() => ui.choisir(null)} />
        {/if}
      </div>
      {#if menuDe !== null}
        <MenuPersonne participant={menuDe} {etatTour} />
      {/if}
    </div>
  </section>
{/if}

<style>
  /* Le panneau est une carte : fond, filet, rayon et ombre de la carte ;
     son titre au-dessus d'un filet, son contenu en retrait. */
  .carte {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-3);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    box-shadow: var(--ombre-carte);
  }

  .carte > h3 {
    margin: 0;
    padding: var(--espace-3) var(--espace-4);
    border-bottom: 1px solid var(--couleur-carte-filet);
    font-size: var(--taille-titre-carte);
  }

  .corps {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
    padding: var(--espace-3) var(--espace-4);
  }

  /* Le panneau reçoit le focus d'Échap et du clavier : son contour suit le
     rayon de la carte. */
  .panneau:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  p {
    margin: 0;
  }

  .titre {
    font-style: italic;
  }

  .invite {
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-texte-petit);
  }

  .champ {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
  }

  .champ > span {
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-texte-petit);
    font-weight: 700;
  }

  .champ select,
  .champ input {
    padding: var(--espace-1) var(--espace-2);
    font: inherit;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-2);
  }
</style>
