<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La vue « Comparaison » (§ 12.10.6, D55) de la page de qualité : la carte
  // titrée de sa question, sans contenu. SectionQualite ne l'importe pas, et
  // la liste des vues ne porte pas son lien.
  //
  // Elle reçoit le contrat de propriétés des vues — detail, le détail du
  // placement mesuré ; ligne, sa ligne d'évaluation ; table, la table
  // d'évaluation de la charge — et n'en lit aucune.
  //
  // Désignation : data-vue-qualite sur le <div> qui enveloppe la carte, que
  // la carte ne transmet pas.
  import { getContext } from 'svelte';
  import Carte from '../primitives/Carte.svelte';

  let { detail = null, ligne = null, table = null } = $props();

  const t = getContext('t');
</script>

<div data-vue-qualite="comparaison">
  <Carte titre={t('qualite.vue.comparaison.titre')} sousTitre={t('qualite.vue.comparaison.question')} niveau={3} />
</div>
