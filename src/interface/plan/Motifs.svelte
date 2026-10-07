<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<svelte:options namespace="svg" />

<script>
  // Les motifs du plan (§ 7.5, § 7.6) : la hachure d'une place à pourvoir —
  // des traits --couleur-hachure sur le fond de la chaise — et la trame d'une
  // table en conflit — des traits --couleur-conflit sur le fond du plateau.
  // Chaque motif peint son fond, opaque, puis ses traits : la couleur relue
  // dans le style calculé est la couleur peinte. Les tailles sont en cm de
  // dessin ; prefixe rend leurs identifiants uniques dans le document.
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
  <pattern id="{prefixe}-trame" patternUnits="userSpaceOnUse" width="12" height="12" patternTransform="rotate(-45)">
    <rect class="fond-table" width="12" height="12" />
    <line class="trait-trame" x1="6" y1="0" x2="6" y2="12" />
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

  .fond-table {
    fill: var(--couleur-table-fond);
  }

  .trait-trame {
    stroke: var(--couleur-conflit);
    stroke-width: 3;
  }
</style>
