<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La section du plan (§ 2.1, étapes 7 et 8 ; § 7) : son titre, le plan et
  // sa vue (Plan.svelte), et les panneaux latéraux — le diagnostic compact,
  // dans [data-panneau-diagnostic], visible dès l'ouverture, sans clic ;
  // les listes de travail, la réserve, le panneau d'une place et celui
  // d'une table. Les panneaux lisent 'seance' et 'ui' au contexte.
  //
  // L'état des places du tour affiché (etatPlaces, A5) se calcule ici, une
  // fois par changement de la charge, du tour affiché ou de la proposition
  // montrée — chacun un $derived, qu'un autre changement de l'état de
  // navigation ne relance pas —, et se passe au plan, à la réserve et aux
  // panneaux de la place et de la table (etatTour) : aucun ne le recalcule.
  // Le plan se remonte pour chaque événement : un autre événement repart de
  // sa propre vue, mémorisée ou ajustée.
  //
  // En plein écran, le titre et les panneaux s'effacent : le plan prend la
  // surface que le cadre de mode lui laisse sous le bandeau (§ 18.6), et le
  // cadre l'entoure toujours (§ 8.4).
  import { getContext } from 'svelte';
  import { diagnostiquerCharge } from '../../application/diagnostic.js';
  import { etatPlaces } from '../../application/places.js';
  import Diagnostic from '../diagnostic/Diagnostic.svelte';
  import ListesTravail from './ListesTravail.svelte';
  import PanneauPlace from './PanneauPlace.svelte';
  import PanneauTable from './PanneauTable.svelte';
  import Plan from './Plan.svelte';
  import Reserve from './Reserve.svelte';
  import { tourAffiche } from './vue_plan.js';

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui');

  const charge = $derived($seance.charge);
  const evenement = $derived(charge === null ? null : charge.evenement.id);
  const tour = $derived(charge === null ? 1 : tourAffiche($ui.tour, charge.evenement.tours));
  const proposition = $derived($ui.proposition);
  const etatTour = $derived(charge === null ? null : etatPlaces(charge, { tour, proposition }));
  // Le diagnostic de la charge, que Plan donne au modèle de dessin : quand
  // toutes les tables sont en conflit, le bandeau du plan en énonce les
  // planchers (§ 7.5) ; null quand la configuration ne se normalise pas, et
  // le bandeau ne porte que la phrase.
  const diagnostic = $derived(charge === null ? null : diagnostiquerCharge(charge).diagnostic);
</script>

<section data-section="plan" class="section-plan">
  {#if !$ui.pleinEcran}
    <h2>{t('coquille.section.plan')}</h2>
  {/if}
  <div class="corps">
    {#if evenement !== null}
      {#key evenement}
        <Plan {diagnostic} {etatTour} />
      {/key}
    {/if}
    {#if !$ui.pleinEcran}
      <aside class="panneaux" aria-label={t('plan.panneaux')}>
        <div data-panneau-diagnostic>
          <Diagnostic compact />
        </div>
        <ListesTravail />
        <Reserve {etatTour} />
        <PanneauPlace {etatTour} />
        <PanneauTable {etatTour} />
      </aside>
    {/if}
  </div>
</section>

<style>
  /* La section prend la hauteur de la surface du cadre de mode : le plan
     s'y étend, et c'est la surface du cadre qui défile, jamais la page. */
  .section-plan {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
    box-sizing: border-box;
    height: 100%;
    min-height: 0;
  }

  h2 {
    margin: 0;
    font-size: var(--taille-texte);
  }

  .corps {
    display: flex;
    flex: 1 1 auto;
    gap: var(--espace-3);
    min-height: 0;
  }

  .panneaux {
    display: flex;
    flex: 0 0 18rem;
    flex-direction: column;
    gap: var(--espace-3);
    min-height: 0;
    overflow-y: auto;
  }
</style>
