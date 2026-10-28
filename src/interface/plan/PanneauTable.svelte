<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Le panneau de la table sélectionnée (§ 7.3, § 2.1 étape 6, § 5.9) :
  // ouvert quand l'état de navigation sélectionne une table sans siège,
  // {table} — un clic sur une table, ou l'entrée du clavier sur une table en
  // régime table, où les chaises ne sont plus des cibles. Il nomme la table,
  // son libellé dans son propre nœud quand elle en porte un, compte ses
  // titres et ceux qu'une réservation « tous les tours » pourvoit
  // (comptesTitres, A5), dit son gel, nomme chaque paire en conflit
  // d'organisation qu'elle réunit au tour montré — les paires de l'état des
  // places, celles que le plan signale par sa trame (detailConflits,
  // modele.js) : une réservation ou un placement à la main qui en réunit une
  // est signalé ici, jamais refusé (§ 5.9, § 7.5) —, et liste ses sièges,
  // chacun un bouton [data-choix-siege] qui sélectionne la place : le siège
  // se choisit dans le panneau. Le premier reçoit le focus quand le clavier
  // ouvre le panneau ([data-focus-initial]). Le siège choisi remplace ce
  // panneau par celui de la place, qui reçoit le focus : il ne tombe pas sur
  // le corps du document avec le bouton détruit.
  //
  // Il offre aussi « Donner un titre » et « Désigner », sur la personne
  // choisie, au niveau de la table : sous des sièges non attribués, aucun choix
  // de siège n'est offert — l'application prend le siège (A5) — ; sous des
  // sièges attribués, le numéro se choisit ([data-champ=siege]), le plus petit
  // siège sans titre d'abord. Un refus se pose sur la table (executerSurPlace),
  // LIBELLE_VIDE à côté du champ. Un libellé tapé que ni « Donner un titre » ni
  // « Désigner » n'a encore appliqué est une saisie non validée : un geste
  // ouvert (geste.js), qui suspend le compte d'inactivité de la séance (§ 8.4).
  // La commande aboutie sur lui, une autre table sélectionnée ou le panneau
  // refermé le rendent ; un refus le laisse ouvert, la saisie gardée.
  //
  // Échap referme le panneau et rend le focus à la racine du plan. Le
  // panneau lit 'seance' et 'ui' au contexte ; etatTour, l'état des places
  // du tour affiché, que SectionPlan calcule, ou null sans événement.
  import { getContext, onDestroy, tick, untrack } from 'svelte';
  import { comptesTitres } from '../../application/listes_travail.js';
  import { libellePropose } from '../../application/places.js';
  import { nomsDesTours } from '../../application/tours.js';
  import Commande from '../primitives/Commande.svelte';
  import { creerGeste } from '../primitives/geste.js';
  import { effetDe } from '../raccourcis.js';
  import { libellePlace } from './gestes.js';
  import { detailConflits, executerSurPlace, ligneListe, partiesLigne, textesLigne } from './modele.js';
  import { nomDeCharge, organisationDeCharge } from './vue_plan.js';

  let { etatTour } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui');
  const uid = $props.id();

  const charge = $derived($seance.charge);
  // Les noms des tours, que les libellés d'un tour lisent (aides.js).
  const nomsTours = $derived(charge === null ? [] : nomsDesTours(charge));
  const selection = $derived($ui.selection);
  const table = $derived(charge !== null && selection !== null && (selection.siege ?? null) === null ? selection.table : null);
  const etat = $derived(table === null ? null : etatTour);
  const etatTable = $derived(etat === null ? undefined : etat.tables.find(({ id }) => id === table));
  const nomDe = $derived(charge === null ? null : nomDeCharge(charge));
  const comptes = $derived(etatTable === undefined ? null : comptesTitres(charge, table));
  // Les paires en conflit d'organisation de la table au tour montré, chacune
  // ses deux noms ; aucune quand ses conflits ne s'évaluent pas.
  const pairesEnConflit = $derived.by(() => {
    if (etatTable === undefined) return [];
    const detail = detailConflits(etatTable, nomDe, organisationDeCharge(charge));
    if (detail === null) return [];
    return detail.lignes.filter(({ regle }) => regle === 'conflitsOrganisation').flatMap(({ groupes }) => groupes);
  });
  const nommee = $derived(etatTable === undefined ? null : libellePlace({ numero: etatTable.numero, siege: null }));
  const lignes = $derived(
    etatTable === undefined ? [] : etatTable.chaises.map((chaise) => partiesLigne(textesLigne(ligneListe(chaise, nomDe, null, nomsTours), t))),
  );
  const choix = $derived($ui.choix);
  const personne = $derived(choix !== null && choix.genre === 'personne' ? choix : null);
  const propose = $derived(charge === null ? '' : libellePropose(charge, personne === null ? 0 : personne.participant));

  // La saisie du libellé, null tant que l'opérateur n'a rien tapé ; le
  // dernier libellé qu'une commande aboutie a appliqué depuis le champ, null
  // sans lui ; le siège choisi sous des sièges attribués, null pour le
  // premier sans titre.
  let saisi = $state(null);
  let applique = $state(null);
  let siege = $state(null);
  const libelleSaisi = $derived(saisi ?? propose);
  const premierSansTitre = $derived(etatTable === undefined ? 1 : (etatTable.chaises.find(({ titre }) => titre === null)?.siege ?? 1));
  const siegeChoisi = $derived(siege ?? premierSansTitre);

  let tableSuivie = null;
  $effect(() => {
    const lue = table;
    untrack(() => {
      if (lue === tableSuivie) return;
      tableSuivie = lue;
      saisi = null;
      applique = null;
      siege = null;
    });
  });

  // Le geste suit la saisie tapée que rien n'a appliquée.
  const geste = creerGeste(seance);
  $effect(() => geste.tenir(saisi !== null && saisi !== applique));
  onDestroy(() => geste.liberer());

  const dependances = { seance, ui };
  const lieu = () => ({ table });
  const siegeDuTitre = () => (etat.siegesAttribues ? siegeChoisi : null);

  // Exécute la commande sur le libellé du champ ; aboutie, elle l'applique.
  async function avecLibelle(commande, args) {
    const libelle = libelleSaisi;
    const rendu = await executerSurPlace(dependances, lieu(), commande, { ...args, libelle }, { locaux: ['LIBELLE_VIDE'] });
    if (rendu !== null) applique = libelle;
  }

  async function donnerTitre() {
    await avecLibelle('poserTitre', { table, siege: siegeDuTitre() });
  }

  async function designer() {
    if (personne === null) return;
    await avecLibelle('designer', { participant: personne.participant, table, siege: siegeDuTitre() });
  }

  // Sélectionne le siège, puis porte le focus au panneau de la place : à
  // son élément [data-focus-initial], sinon au panneau.
  async function choisirSiege(evenement, numero) {
    const section = evenement.currentTarget.closest('[data-section]');
    ui.selectionner({ table, siege: numero });
    await tick();
    const suivant = section?.querySelector('[data-panneau="place"]') ?? null;
    (suivant?.querySelector('[data-focus-initial]') ?? suivant)?.focus();
  }

  function surTouche(evenement) {
    if (effetDe('fenetre', evenement.key) !== 'fermer') return;
    evenement.preventDefault();
    const racine = evenement.currentTarget.closest('[data-section]')?.querySelector('[data-plan]') ?? null;
    ui.selectionner(null);
    racine?.focus();
  }
</script>

{#if etatTable !== undefined}
  <!-- Échap remonte des contrôles du panneau jusqu'à lui, qui se referme. -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <section
    class="panneau carte"
    data-panneau="table"
    data-table-panneau={table}
    tabindex="-1"
    aria-labelledby="{uid}-titre"
    onkeydown={surTouche}
  >
    <h3 id="{uid}-titre">
      {t(nommee.cle, nommee.details)}{#if etatTable.libelle !== null}<span>{t('plan.table.avantLibelle')}</span><span class="donnee"
          >{etatTable.libelle}</span
        >{/if}
    </h3>
    <div class="corps">
      <p>{t('plan.panneauTable.titres', comptes)}</p>
      {#if etatTable.gelee}
        <p class="gel">{t('plan.liste.gelee')}</p>
      {/if}
      {#if pairesEnConflit.length > 0}
        <h4 id="{uid}-conflits">{t('plan.panneauTable.conflits')}</h4>
        <ul class="conflits" aria-labelledby="{uid}-conflits" data-conflits-table>
          {#each pairesEnConflit as paire, rang (rang)}
            <li data-conflit-organisation>
              {#each paire as nom, i (i)}{#if i > 0}<span>{t('plan.infobulle.et')}</span>{/if}<span class="donnee">{nom}</span>{/each}
            </li>
          {/each}
        </ul>
      {/if}
      <h4 id="{uid}-sieges">{t('plan.panneauTable.sieges')}</h4>
      <ul class="sieges" aria-labelledby="{uid}-sieges">
        {#each lignes as parties, rang (rang)}
          <li>
            <button
              type="button"
              data-choix-siege={rang + 1}
              data-focus-initial={rang === 0 ? '' : undefined}
              onclick={(evenement) => choisirSiege(evenement, rang + 1)}
            >
              {#each parties as { partie, texte } (partie)}<span class:titre={partie === 'titre'}>{texte}</span>{/each}
            </button>
          </li>
        {/each}
      </ul>
      {#if choix !== null}
        <p class="choix" role="status">
          <span>{t(choix.genre === 'personne' ? 'plan.choix.personne' : 'plan.choix.reservation')}</span><span class="donnee"
            >{nomDe(choix.participant)}</span
          >
        </p>
      {:else}
        <p class="invite">{t('plan.choix.inviter')}</p>
      {/if}
      {#if etat.siegesAttribues}
        <label class="champ">
          <span>{t('plan.panneauTable.siege')}</span>
          <select data-champ="siege" value={siegeChoisi} onchange={(evenement) => (siege = Number(evenement.currentTarget.value))}>
            {#each lignes as _, rang (rang)}
              <option value={rang + 1}>{rang + 1}</option>
            {/each}
          </select>
        </label>
      {/if}
      <label class="champ">
        <span>{t('plan.titre.etiquette')}</span>
        <input type="text" data-champ="libelle" value={libelleSaisi} oninput={(evenement) => (saisi = evenement.currentTarget.value)} />
      </label>
      <div class="actions">
        <Commande cle="plan.action.donnerTitre" nom="donnerTitre" executer={donnerTitre} />
        <Commande cle="plan.action.designer" nom="designer" executer={designer} />
      </div>
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

  .panneau:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  p {
    margin: 0;
  }

  /* Un intertitre en petites capitales, d'encre secondaire. */
  h4 {
    margin: var(--espace-1) 0 0;
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-intertitre);
    letter-spacing: var(--interlettre-capitales);
    text-transform: uppercase;
  }

  .gel {
    font-weight: 700;
  }

  /* Les paires en conflit d'organisation : une par ligne, au trait épais
     de la marque de conflit, la forme se lisant sans la couleur. */
  .conflits {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .conflits li {
    padding-left: var(--espace-2);
    border-left: 3px solid var(--couleur-page-texte);
  }

  .sieges {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* Un bouton de liste : la commande secondaire, au filet de la page. */
  li > button {
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    cursor: pointer;
  }

  li > button:hover {
    background-color: var(--couleur-carte-fond-sourd);
  }

  li > button:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  .sieges button {
    width: 100%;
    text-align: start;
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
    gap: var(--espace-2);
  }
</style>
