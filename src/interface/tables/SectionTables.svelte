<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // La section des tables et des tours (§ 4, § 4.5, § 6, § 2.1 étapes 4 et
  // 5) : la carte des réglages — le nombre de places par défaut et l'énoncé
  // de son changement, le nombre de tours, la règle par défaut des
  // objectifs —, sous lesquels le tableau des personnes présentes par tour,
  // monté seulement quand une personne manque un tour, puis la carte de la
  // liste des tables et de leurs objectifs.
  // Elle lit la charge et la révision dans l'état observable de la séance
  // et les donne à ses parties ; chaque geste passe par la séance, et
  // chaque refus se pose là où il a eu lieu.
  import { getContext } from 'svelte';
  import Carte from '../primitives/Carte.svelte';
  import Defaut from './Defaut.svelte';
  import ListeTables from './ListeTables.svelte';
  import PresencesParTour from './PresencesParTour.svelte';
  import RegleObjectifs from './RegleObjectifs.svelte';
  import Tours from './Tours.svelte';

  const t = getContext('t');
  const seance = getContext('seance');
</script>

<div class="section" data-section="tables">
  {#if $seance.charge === null}
    <Carte titre={t('coquille.section.tables')} />
  {:else}
    <Carte titre={t('coquille.section.tables')}>
      <div class="reglages">
        <Defaut charge={$seance.charge} revision={$seance.evenement.revision} />
        <Tours charge={$seance.charge} />
        <RegleObjectifs charge={$seance.charge} />
      </div>
      <PresencesParTour charge={$seance.charge} />
    </Carte>
    <ListeTables charge={$seance.charge} revision={$seance.evenement.revision} />
  {/if}
</div>

<style>
  .section {
    display: flex;
    flex-direction: column;
    gap: var(--espace-4);
  }

  .reglages {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-5);
  }
</style>
