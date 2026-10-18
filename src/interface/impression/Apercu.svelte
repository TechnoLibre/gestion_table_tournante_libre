<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // L'écran d'aperçu avant impression (§ 11.7) : la feuille de style
  // d'impression réelle appliquée au document vivant, la même mise en page
  // regardée avant d'être envoyée — jamais une seconde. App le monte à la
  // place de l'événement tant que l'état de navigation porte un aperçu ; il
  // n'a pour ancêtres que la racine, et son document n'est jamais tronqué à
  // une page par un ancêtre de hauteur fixe. Toute impression passe par lui.
  //
  // Sa barre — titre, libellé de mode, vue imprimée, réglages de la vue,
  // papier, « Imprimer », « Fermer l'aperçu » — ne s'imprime pas. Son
  // document, [data-impression], est la vue choisie : une feuille par page,
  // chacune sous le pied et, pour un brouillon (estBrouillon), le filigrane.
  // La sortie est celle du plan à l'écran : le retenu, la proposition
  // montrée, ou les réservations seules ; le pied porte son horodatage
  // (piedDePage). Sans papier choisi, l'aperçu pose la question du papier
  // (Papier.svelte) à la place du document.
  //
  // Un nom d'événement que le pied ne porte pas (refusApercu) — lu d'un
  // fichier, au-delà de la borne de la saisie — ne monte ni gabarit ni
  // document, dans aucune vue : son refus se pose sur « Imprimer », avec le
  // remède « Renommer », et « Imprimer » le rend sans appeler l'imprimante.
  //
  // La bande — ce qu'une feuille porte hors de sa zone de contenu — se
  // mesure sur une feuille gabarit, que la vue rend hors de la vue, à
  // l'ouverture et chaque fois que la vue, le papier ou le pied changent
  // (HAUTEUR_BANDE_IMPRESSION) ; le document se rend ensuite, la bande
  // reçue par la vue, qui la passe à sa mise en page.
  //
  // « Imprimer » demande à l'imprimante du contexte le papier et
  // l'orientation de la vue ; un échec pose son refus (refusImpression) sur
  // la commande, une annulation ne dit rien. Rien de l'événement ne
  // s'écrit : l'aperçu ne reçoit de la séance que son état, et le papier
  // passe par choisirPapier.
  //
  // Habillage de l'écran : la barre est une carte, ses commandes en groupes
  // nommés, côte à côte — la vue imprimée, en commandes enfoncées ; les
  // réglages de la vue, quand elle en a ; le papier et « Imprimer », l'action
  // principale — puis « Fermer l'aperçu », à part. Le document imprimé n'en
  // prend rien.
  import '../impression.css';
  import { getContext } from 'svelte';
  import { estBrouillon, piedDePage, refusImpression } from '../../application/sorties.js';
  import { constante } from '../../geometrie/constantes.js';
  import { DECOUPES, VUES_IMPRESSION } from '../etat_ui.js';
  import { cleDeMode } from '../mode.js';
  import Commande from '../primitives/Commande.svelte';
  import Papier from '../sorties/Papier.svelte';
  import FeuillesTables from './FeuillesTables.svelte';
  import ListeAccueil from './ListeAccueil.svelte';
  import PlanImprime from './PlanImprime.svelte';
  import { bandeDeFeuille, cleDecoupe, cleVue, feuilleDe, optionsApercu, refusApercu, sortieApercu, toursOfferts } from './modele.js';

  // provenance et version : celles du bandeau, que le pied reprend ;
  // fermer : ferme l'aperçu et rend le focus à « Imprimer… ».
  let { provenance, version, fermer } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui');
  const imprimante = getContext('imprimante');

  // Le composant de chaque vue imprimée.
  const VUES = new Map([
    ['plan', PlanImprime],
    ['accueil', ListeAccueil],
    ['tables', FeuillesTables],
  ]);

  const marge = constante('MARGE_PAGE_MM');

  const charge = $derived($seance.charge);
  const options = $derived(optionsApercu($ui.apercu, $seance.papier));
  const sortie = $derived(sortieApercu(charge, options, $ui.proposition));
  const pied = $derived(
    piedDePage(charge, { source: sortie.source, proposition: sortie.proposition, tour: sortie.tour, provenance, version, texte: t }),
  );
  const feuille = $derived(feuilleDe(pied, estBrouillon(charge, { source: sortie.source, tour: sortie.tour })));
  const refusNom = $derived(refusApercu(pied));
  const Vue = $derived(VUES.get(options.vue));
  const cleMode = $derived(cleDeMode($seance));
  const tours = $derived(toursOfferts(charge.evenement.tours));

  // La bande mesurée sur le gabarit, null avant la première mesure ; ce qui
  // la change remonte le gabarit, qui se mesure de nouveau.
  let bandeMm = $state(null);
  const cleGabarit = $derived(JSON.stringify([options.vue, options.papier, feuille.elements]));

  // L'orientation que la vue a choisie : celle des listes, ou celle de la
  // découpe du plan.
  let orientationVue = $state(null);
  const orientation = $derived(options.orientation ?? orientationVue);

  function mesurer(conteneur) {
    const gabarit = conteneur.firstElementChild;
    const contenu = gabarit.querySelector('[data-contenu]');
    bandeMm = bandeDeFeuille({
      feuillePx: gabarit.getBoundingClientRect().height,
      contenuPx: contenu.getBoundingClientRect().height,
      margeMm: marge,
    });
  }

  // La vue choisie ; le plan, qui s'imprime à un tour, reprend celui du plan
  // à l'écran quand l'aperçu couvre la soirée.
  function choisirVue(vue) {
    ui.reglerApercu(vue === 'plan' && $ui.apercu.tour === 'tous' ? { vue, tour: $ui.tour } : { vue });
  }

  async function imprimer() {
    if (refusNom !== null) throw refusNom;
    const refus = refusImpression(await imprimante.imprimer({ papier: options.papier, orientation }));
    if (refus !== null) throw refus;
  }
</script>

<div class="apercu" data-ecran="apercu">
  <div class="barre" role="group" aria-label={t('impression.barre')}>
    <div class="tete">
      <h2>{t('impression.titre')}</h2>
      {#if cleMode !== null}
        <span class="mode" data-mode-libelle="barre">{t(cleMode)}</span>
      {/if}
    </div>
    <div class="groupe vues" role="group" aria-label={t('impression.vue.titre')}>
      {#each VUES_IMPRESSION as vue (vue)}
        <button type="button" data-commande="vue" data-cible={vue} aria-pressed={options.vue === vue} onclick={() => choisirVue(vue)}
          >{t(cleVue(vue))}</button
        >
      {/each}
    </div>
    {#if options.vue === 'plan' || options.vue === 'tables'}
      <div class="groupe" role="group" aria-label={t('impression.groupe.reglages')}>
        {#if options.vue === 'plan'}
          <label class="reglage">
            <span>{t('impression.tour.titre')}</span>
            <select data-champ="tour" value={options.tour} onchange={(evenement) => ui.reglerApercu({ tour: Number(evenement.currentTarget.value) })}>
              {#each tours as tour (tour)}
                <option value={tour}>{t('impression.tour.option', { tour })}</option>
              {/each}
            </select>
          </label>
          <button type="button" data-commande="listes" aria-pressed={options.listes} onclick={() => ui.reglerApercu({ listes: !options.listes })}
            >{t('impression.listes')}</button
          >
          <label class="reglage">
            <span>{t('impression.decoupe.titre')}</span>
            <select data-champ="decoupe" value={options.decoupe} onchange={(evenement) => ui.reglerApercu({ decoupe: evenement.currentTarget.value })}>
              {#each DECOUPES as decoupe (decoupe)}
                <option value={decoupe}>{t(cleDecoupe(decoupe))}</option>
              {/each}
            </select>
          </label>
        {:else}
          <button type="button" data-commande="parTour" aria-pressed={options.parTour} onclick={() => ui.reglerApercu({ parTour: !options.parTour })}
            >{t('impression.parTour')}</button
          >
        {/if}
      </div>
    {/if}
    {#if !options.question}
      <div class="groupe" role="group" aria-label={t('impression.groupe.sortie')}>
        <Papier />
        <Commande cle="impression.commande.imprimer" nom="imprimer" variante="principale" executer={imprimer} refusExterne={refusNom} />
      </div>
    {/if}
    <div class="fermer">
      <Commande cle="impression.commande.fermer" nom="fermerApercu" executer={fermer} />
    </div>
  </div>

  {#if options.question}
    <div class="question">
      <Papier />
    </div>
  {:else if refusNom === null}
    {#key cleGabarit}
      <div class="gabarit" aria-hidden="true" {@attach mesurer}>
        <Vue etat={sortie.etat} {options} {feuille} />
      </div>
    {/key}
    {#if bandeMm !== null}
      <div class="document" data-impression data-vue-impression={options.vue}>
        <Vue etat={sortie.etat} {options} {feuille} {bandeMm} bind:orientation={orientationVue} />
      </div>
    {/if}
  {/if}
</div>

<style>
  .apercu {
    display: flex;
    flex-direction: column;
    gap: var(--espace-4);
  }

  /* La barre : une carte, ses groupes côte à côte, chacun ouvert par un
     filet ; elle se replie à la ligne sous une largeur étroite. */
  .barre {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-3) var(--espace-4);
    padding: var(--espace-3) var(--espace-4);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-3);
    background-color: var(--couleur-carte-fond);
    box-shadow: var(--ombre-carte);
  }

  .tete {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--espace-2) var(--espace-3);
  }

  h2 {
    margin: 0;
    font-size: var(--taille-titre-carte);
  }

  .mode {
    font-weight: bold;
  }

  .groupe {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-2) var(--espace-3);
    padding-left: var(--espace-4);
    border-left: 1px solid var(--couleur-carte-filet);
  }

  /* Les vues se touchent, en une rangée de commandes enfoncées. */
  .vues {
    gap: 0;
  }

  .vues button + button {
    margin-left: -1px;
  }

  .vues button:not(:first-child) {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  .vues button:not(:last-child) {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  .fermer {
    margin-left: auto;
  }

  .reglage {
    display: inline-flex;
    align-items: center;
    gap: var(--espace-2);
  }

  .reglage > span {
    color: var(--couleur-page-texte-secondaire);
  }

  button,
  select {
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    font-size: var(--taille-texte);
  }

  button {
    cursor: pointer;
  }

  button:hover {
    background-color: var(--couleur-carte-fond-sourd);
  }

  /* Une vue ou un réglage enfoncé : la teinte de l'action, le texte en gras
     de l'encre de la page ; le gras le distingue sans la couleur. */
  button[aria-pressed='true'] {
    position: relative;
    background-color: var(--couleur-action-teinte);
    font-weight: bold;
  }

  button:focus-visible,
  select:focus-visible {
    position: relative;
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  /* La question du papier, sans document : une carte sous la barre. */
  .question {
    padding: var(--espace-4) var(--espace-5);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-3);
    background-color: var(--couleur-carte-fond);
    box-shadow: var(--ombre-carte);
  }

  /* La feuille gabarit se rend hors de la vue : elle se mesure, elle ne se
     voit ni ne s'atteint. */
  .gabarit {
    position: fixed;
    top: 0;
    left: 0;
    z-index: -1;
    visibility: hidden;
    pointer-events: none;
  }

  .document {
    display: block;
  }
</style>
