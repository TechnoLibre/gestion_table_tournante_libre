<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Le panneau de la table sélectionnée (§ 7.3, § 2.1 étape 6, § 5.9) :
  // ouvert quand l'état de navigation sélectionne une table sans siège,
  // {table} — un clic sur une table, ou l'entrée du clavier sur une table
  // en régime table, où les chaises ne sont plus des cibles. Il nomme la
  // table, compte ses titres et ceux qu'une réservation « tous les tours »
  // pourvoit (comptesTitres, A5), dit son gel, et liste ses sièges, chacun
  // un bouton [data-choix-siege] qui sélectionne la place : le siège se
  // choisit dans le panneau. Le premier reçoit le focus quand le clavier
  // ouvre le panneau ([data-focus-initial]). Le siège choisi remplace ce
  // panneau par celui de la place, qui reçoit le focus : il ne tombe pas
  // sur le corps du document avec le bouton détruit.
  //
  // Il offre aussi « Donner un titre » et « Désigner », sur la personne
  // choisie, au niveau de la table : sous des sièges non attribués, aucun
  // choix de siège n'est offert — l'application prend le siège (A5) — ;
  // sous des sièges attribués, le numéro se choisit ([data-champ=siege]),
  // le plus petit siège sans titre d'abord. Un refus se pose sur la table
  // (executerSurPlace), LIBELLE_VIDE à côté du champ.
  //
  // Échap referme le panneau et rend le focus à la racine du plan. Le
  // panneau lit 'seance' et 'ui' au contexte ; etatTour, l'état des places
  // du tour affiché, que SectionPlan calcule, ou null sans événement.
  import { getContext, tick, untrack } from 'svelte';
  import { comptesTitres } from '../../application/listes_travail.js';
  import { libellePropose } from '../../application/places.js';
  import Commande from '../primitives/Commande.svelte';
  import { effetDe } from '../raccourcis.js';
  import { libellePlace } from './gestes.js';
  import { executerSurPlace, ligneListe, partiesLigne, textesLigne } from './modele.js';
  import { nomDeCharge } from './vue_plan.js';

  let { etatTour } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui');
  const uid = $props.id();

  const charge = $derived($seance.charge);
  const selection = $derived($ui.selection);
  const table = $derived(charge !== null && selection !== null && (selection.siege ?? null) === null ? selection.table : null);
  const etat = $derived(table === null ? null : etatTour);
  const etatTable = $derived(etat === null ? undefined : etat.tables.find(({ id }) => id === table));
  const nomDe = $derived(charge === null ? null : nomDeCharge(charge));
  const comptes = $derived(etatTable === undefined ? null : comptesTitres(charge, table));
  const nommee = $derived(etatTable === undefined ? null : libellePlace({ numero: etatTable.numero, siege: null }));
  const lignes = $derived(
    etatTable === undefined ? [] : etatTable.chaises.map((chaise) => partiesLigne(textesLigne(ligneListe(chaise, nomDe), t))),
  );
  const choix = $derived($ui.choix);
  const personne = $derived(choix !== null && choix.genre === 'personne' ? choix : null);
  const propose = $derived(charge === null ? '' : libellePropose(charge, personne === null ? 0 : personne.participant));

  // La saisie du libellé, null tant que l'opérateur n'a rien tapé ; le
  // siège choisi sous des sièges attribués, null pour le premier sans titre.
  let saisi = $state(null);
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
      siege = null;
    });
  });

  const dependances = { seance, ui };
  const lieu = () => ({ table });
  const siegeDuTitre = () => (etat.siegesAttribues ? siegeChoisi : null);

  async function donnerTitre() {
    await executerSurPlace(dependances, lieu(), 'poserTitre', { table, siege: siegeDuTitre(), libelle: libelleSaisi }, { locaux: ['LIBELLE_VIDE'] });
  }

  async function designer() {
    if (personne === null) return;
    await executerSurPlace(
      dependances,
      lieu(),
      'designer',
      { participant: personne.participant, table, siege: siegeDuTitre(), libelle: libelleSaisi },
      { locaux: ['LIBELLE_VIDE'] },
    );
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
  <section class="panneau" data-panneau="table" data-table-panneau={table} tabindex="-1" aria-labelledby="{uid}-titre" onkeydown={surTouche}>
    <h3 id="{uid}-titre">{t(nommee.cle, nommee.details)}</h3>
    <p>{t('plan.panneauTable.titres', comptes)}</p>
    {#if etatTable.gelee}
      <p class="gel">{t('plan.liste.gelee')}</p>
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
  </section>
{/if}

<style>
  .panneau {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
  }

  h3,
  h4,
  p {
    margin: 0;
  }

  h3,
  h4 {
    font-size: var(--taille-texte);
  }

  .gel {
    font-weight: 700;
  }

  .sieges {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .sieges button {
    width: 100%;
    text-align: start;
  }

  .titre {
    font-style: italic;
  }

  .champ {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2);
  }
</style>
