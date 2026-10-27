<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // La phrase d'une inclusion (§ 12.15) : un avis, « Prénom Nom n'a pas
  // rencontré Prénom Nom », ou « … n'a rencontré personne de » et
  // l'organisation, suivi de « une rencontre demandée des deux côtés » quand
  // les deux personnes de la paire la demandent ; ou, avec raison, une
  // inclusion hors d'atteinte, « Prénom Nom → cible : » et sa raison. Chaque
  // nom et chaque organisation est une donnée, dans son propre nœud, qui en
  // garde les blancs ; le texte vient des libellés. La vue de la qualité, la
  // liste de travail du plan et la fiche la posent telle quelle.
  //
  // avis : un avis nommé (avisNomme, inclusions.js), ou une inclusion hors
  // d'atteinte nommée, {source, cible} ; raison : la raison de celle-ci,
  // null pour un avis.
  import { getContext } from 'svelte';
  import { cleDeRaison } from './inclusions.js';

  let { avis, raison = null } = $props();

  const t = getContext('t');
  const verbe = $derived(avis.cible.sorte === 'organisation' ? 'qualite.inclusions.avis.organisation' : 'qualite.inclusions.avis.participant');
</script>

{#if raison === null}<span class="donnee">{avis.source.nom}</span><span>{t(verbe)}</span><span class="donnee">{avis.cible.nom}</span
  >{#if avis.reciproque}<span>{t('qualite.inclusions.avis.reciproque')}</span>{/if}{:else}<span class="donnee"
    >{avis.source.nom}</span
  ><span>{t('qualite.inclusions.vers')}</span><span class="donnee">{avis.cible.nom}</span><span
    >{t('qualite.inclusions.parce', { raison: cleDeRaison(raison) })}</span
  >{/if}

<style>
  .donnee {
    white-space: pre-wrap;
  }
</style>
