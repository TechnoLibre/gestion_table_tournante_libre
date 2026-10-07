<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La section des participants sous sa forme minimale : son titre, tiré des libellés de la coquille.
  import { getContext } from 'svelte';

  const t = getContext('t');
</script>

<section data-section="participants">
  <h2>{t('coquille.section.participants')}</h2>
</section>
