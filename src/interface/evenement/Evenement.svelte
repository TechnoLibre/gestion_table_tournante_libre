<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // L'événement ouvert sous sa forme minimale : son nom, une commande par
  // section, dans l'ordre du § 2.1, et la section ouverte de l'état de
  // navigation. Aucune section n'en exige une autre.
  import { getContext } from 'svelte';
  import Diagnostic from '../diagnostic/Diagnostic.svelte';
  import SectionGeneration from '../generation/SectionGeneration.svelte';
  import SectionImport from '../import/SectionImport.svelte';
  import SectionParticipants from '../participants/SectionParticipants.svelte';
  import SectionPlan from '../plan/SectionPlan.svelte';
  import SectionPropositions from '../propositions/SectionPropositions.svelte';
  import SectionTables from '../tables/SectionTables.svelte';
  import { SECTIONS, cleDeSection } from './sections.js';

  const t = getContext('t');
  const ui = getContext('ui');
  const seance = getContext('seance');

  // Le composant de chaque section.
  const COMPOSANTS = new Map([
    ['import', SectionImport],
    ['participants', SectionParticipants],
    ['tables', SectionTables],
    ['plan', SectionPlan],
    ['diagnostic', Diagnostic],
    ['generation', SectionGeneration],
    ['propositions', SectionPropositions],
  ]);

  const Section = $derived(COMPOSANTS.get($ui.section));
</script>

<div class="evenement" data-ecran="evenement">
  <h1>{$seance.evenement?.nom}</h1>
  <nav aria-label={t('coquille.navigation')}>
    {#each SECTIONS as nom (nom)}
      <button
        type="button"
        data-commande="section"
        data-cible={nom}
        aria-current={$ui.section === nom ? 'page' : undefined}
        onclick={() => ui.allerA(nom)}>{t(cleDeSection(nom))}</button
      >
    {/each}
  </nav>
  <Section />
</div>

<style>
  nav {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2);
  }

  button {
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
    background-color: var(--couleur-page-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    cursor: pointer;
  }

  /* La section ouverte se distingue par sa forme : texte souligné et gras. */
  button[aria-current='page'] {
    font-weight: bold;
    text-decoration: underline;
  }

  button:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }
</style>
