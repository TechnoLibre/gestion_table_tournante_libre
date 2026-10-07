<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La réserve du tour affiché sous sa forme minimale : son titre, tiré des
  // libellés. Le panneau lit 'seance' et 'ui' au contexte, sans propriété de
  // SectionPlan.
  import { getContext } from 'svelte';

  const t = getContext('t');
</script>

<section>
  <h3>{t('plan.reserve.titre')}</h3>
</section>

<style>
  h3 {
    margin: 0;
    font-size: var(--taille-texte);
  }
</style>
