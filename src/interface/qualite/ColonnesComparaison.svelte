<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Les colonnes côte à côte de la vue de comparaison (§ 12.10.6, D57,
  // D84) : le composant reçoit ses propriétés et ne rend rien. Aucune vue ne
  // l'importe.
  //
  // comparaison : la comparaison des deux placements (ComparaisonPlacements,
  // comparerPlacements de src/application/evaluation.js) ; table : la table
  // d'évaluation de la charge.
  let { comparaison = null, table = null } = $props();
</script>
