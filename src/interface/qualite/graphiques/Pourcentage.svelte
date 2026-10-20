<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Un pourcentage de mélange de la page de qualité, suivi, juste dessous,
  // de son compte (D34, contrainte 44) : le pire cas de sa population pour
  // une tuile, une phrase de synthèse ou la soirée, le compte de la ligne
  // pour une ligne de jumeau ou d'infobulle. Rien ne se calcule ici
  // (contrainte 41) : texte est le pourcentage déjà écrit par la vue — un
  // entier du détail suivi du signe, par la table de la page —, null quand
  // son dénominateur est nul, qui s'écrit « — » ; compte, le compte déjà
  // écrit, que exigerCompte (pointage.js) exige non vide.
  //
  // Désignations : data-pourcentage sur la valeur, data-compte-pire sur le
  // compte, son voisin immédiat.
  import { getContext } from 'svelte';
  import { exigerCompte } from './pointage.js';

  let { texte = null, compte } = $props();

  const t = getContext('t');
  const ecrit = $derived(exigerCompte(compte));
</script>

<span class="pourcentage"
  ><span class="valeur" data-pourcentage>{texte ?? t('format.vide')}</span><span class="compte" data-compte-pire
    >{ecrit}</span
  ></span
>

<style>
  /* La valeur, puis le compte sur sa propre ligne, en petit corps d'encre
     secondaire ; l'un et l'autre suivent l'alignement de leur conteneur. */
  .pourcentage {
    display: inline-block;
  }

  .valeur,
  .compte {
    display: block;
    font-variant-numeric: tabular-nums;
  }

  .compte {
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-texte-petit);
  }
</style>
