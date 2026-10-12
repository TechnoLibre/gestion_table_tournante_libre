<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La vue « Profil trié des rencontres » (§ 12.3) de la page de qualité, en
  // attente de son contenu : la carte titrée de sa question, et rien d'autre.
  // Elle reçoit le contrat de propriétés des vues — detail, le détail du
  // placement mesuré, null tant qu'il n'est pas calculé ; ligne, sa ligne
  // d'évaluation ; table, la table d'évaluation de la charge — et n'en lit
  // rien. Son <div> porte data-vue-qualite, que la carte ne transmet pas : il
  // enveloppe la carte.
  import { getContext } from 'svelte';
  import Carte from '../primitives/Carte.svelte';

  let { detail = null, ligne = null, table = null } = $props();

  const t = getContext('t');
</script>

<div data-vue-qualite="profil">
  <Carte titre={t('qualite.vue.profil.titre')} sousTitre={t('qualite.vue.profil.question')} niveau={3} />
</div>
