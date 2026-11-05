<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<svelte:options namespace="svg" />

<script>
  // Les motifs du plan (§ 7.5, § 7.6) : la hachure d'une place à pourvoir —
  // des traits --couleur-hachure sur le fond de la chaise — et les quatre
  // trames de conflit, une par règle (CONFLITS, marques.js), chacune d'une
  // forme et d'une teinte : hachures horizontales pour le conflit
  // d'organisation, hachures descendantes pour séparer les organisations,
  // hachures montantes pour nouveaux voisins, points pour nouvelle table.
  // L'identifiant d'une trame est <prefixe>-trame-<règle>.
  //
  // La hachure peint son fond, opaque, puis ses traits. Une trame de conflit
  // ne peint pas de fond : elle se pose sur le plateau, et une table qui
  // viole plusieurs règles superpose ses trames — les hachures des deux sens
  // se croisent en quadrillage, les points se posent par-dessus. Chaque trait
  // ou point se peint sur un halo du fond du plateau, plus large que lui, qui
  // le détache de la trame dessous : une trame ne peint que sa teinte et le
  // fond du plateau, et sa teinte se mesure contre lui (§ 14.5). La couleur
  // relue dans le style calculé est la couleur peinte.
  //
  // Les tailles sont dans l'unité du dessin qui porte les motifs : des cm sur
  // le plan, des px dans la légende. prefixe rend les identifiants uniques
  // dans le document.
  //
  // Les cadenas et l'anneau ne sont pas des symboles référencés par <use> :
  // chaque chaise les dessine elle-même (TablePlan), et les aides de rendu
  // des épreuves lisent la peinture de chaque forme, jamais à travers une
  // référence.
  let { prefixe } = $props();
</script>

<defs>
  <pattern id="{prefixe}-hachure" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
    <rect class="fond-chaise" width="8" height="8" />
    <line class="trait-hachure" x1="4" y1="0" x2="4" y2="8" />
  </pattern>
  <!-- Le conflit d'organisation : un trait horizontal par carreau. -->
  <pattern id="{prefixe}-trame-conflitsOrganisation" patternUnits="userSpaceOnUse" width="12" height="12">
    <line class="halo" x1="0" y1="6" x2="12" y2="6" />
    <line class="trait evitement-conflit" x1="0" y1="6" x2="12" y2="6" />
  </pattern>
  <!-- Séparer les organisations : un trait du carreau, tourné de −45°, descend vers la droite. -->
  <pattern
    id="{prefixe}-trame-separerOrganisations"
    patternUnits="userSpaceOnUse"
    width="12"
    height="12"
    patternTransform="rotate(-45)"
  >
    <line class="halo" x1="6" y1="0" x2="6" y2="12" />
    <line class="trait organisation-conflit" x1="6" y1="0" x2="6" y2="12" />
  </pattern>
  <!-- Nouveaux voisins : tourné de 45°, le trait monte vers la droite. -->
  <pattern id="{prefixe}-trame-nouveauxVoisins" patternUnits="userSpaceOnUse" width="12" height="12" patternTransform="rotate(45)">
    <line class="halo" x1="6" y1="0" x2="6" y2="12" />
    <line class="trait voisins-conflit" x1="6" y1="0" x2="6" y2="12" />
  </pattern>
  <!-- Nouvelle table : un point par carreau. -->
  <pattern id="{prefixe}-trame-nouvelleTable" patternUnits="userSpaceOnUse" width="12" height="12">
    <circle class="halo-point" cx="6" cy="6" r="4.5" />
    <circle class="point table-conflit" cx="6" cy="6" r="3" />
  </pattern>
</defs>

<style>
  .fond-chaise {
    fill: var(--couleur-chaise-fond);
  }

  .trait-hachure {
    stroke: var(--couleur-hachure);
    stroke-width: 3;
  }

  /* Le halo d'un trait ou d'un point : le fond du plateau, plus large que
     lui d'un de chaque côté. */
  .halo {
    stroke: var(--couleur-table-fond);
    stroke-width: 6;
  }

  .halo-point {
    fill: var(--couleur-table-fond);
  }

  .trait {
    stroke-width: 4;
  }

  .trait.evitement-conflit {
    stroke: var(--couleur-conflit-evitement);
  }

  .trait.organisation-conflit {
    stroke: var(--couleur-conflit-organisation);
  }

  .trait.voisins-conflit {
    stroke: var(--couleur-conflit-voisins);
  }

  .point.table-conflit {
    fill: var(--couleur-conflit-table);
  }
</style>
