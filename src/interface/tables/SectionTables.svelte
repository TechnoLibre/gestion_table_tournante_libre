<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La section des tables et des tours (§ 4, § 6, § 2.1 étapes 4 et 5) : le
  // nombre de places par défaut et l'énoncé de son changement, le nombre de
  // tours, puis la liste des tables. Elle lit la charge et la révision dans
  // l'état observable de la séance et les donne à ses parties ; chaque geste
  // passe par la séance, et chaque refus se pose là où il a eu lieu.
  import { getContext } from 'svelte';
  import Defaut from './Defaut.svelte';
  import ListeTables from './ListeTables.svelte';
  import Tours from './Tours.svelte';

  const t = getContext('t');
  const seance = getContext('seance');
</script>

<section data-section="tables">
  <h2>{t('coquille.section.tables')}</h2>
  {#if $seance.charge !== null}
    <div class="reglages">
      <Defaut charge={$seance.charge} revision={$seance.evenement.revision} />
      <Tours charge={$seance.charge} />
    </div>
    <ListeTables charge={$seance.charge} revision={$seance.evenement.revision} />
  {/if}
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: var(--espace-4);
  }

  h2 {
    margin: 0;
    font-size: var(--taille-titre);
  }

  .reglages {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-5);
  }
</style>
