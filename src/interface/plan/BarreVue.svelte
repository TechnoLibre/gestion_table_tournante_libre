<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La barre de vue du plan (§ 7.2, § 7.7, § 8.4) : le sélecteur de tour,
  // « Zoom + », « Zoom moins », « Ajuster », l'affichage des listes et le plein
  // écran. Des contrôles HTML, hors du <svg data-plan>, tous vivants en
  // lecture comme sur un plan bloqué : aucun n'écrit l'événement. Le tour,
  // les listes et le plein écran passent par l'état de navigation ('ui') ;
  // les zooms et l'ajustement par Plan.svelte, qui tient la vue :
  // zoomer(sens), sens valant 1 ou -1, et ajuster(). Un bouton à bascule dit
  // son état par aria-pressed, que la forme du bouton redit.
  import { getContext } from 'svelte';
  import { toursOfferts } from './vue_plan.js';

  let { tour, tours, zoomer, ajuster } = $props();

  const t = getContext('t');
  const ui = getContext('ui');

  const offerts = $derived(toursOfferts(tours));
</script>

<div class="barre-vue" role="toolbar" aria-label={t('plan.vue.barre')}>
  <label class="tour">
    <span>{t('plan.vue.tour')}</span>
    <select data-champ="tour" value={tour} onchange={(evenement) => ui.montrerTour(Number(evenement.currentTarget.value))}>
      {#each offerts as numero (numero)}
        <option value={numero}>{numero}</option>
      {/each}
    </select>
  </label>
  <button type="button" data-commande="zoomer" onclick={() => zoomer(1)}>{t('plan.vue.zoomer')}</button>
  <button type="button" data-commande="dezoomer" onclick={() => zoomer(-1)}>{t('plan.vue.dezoomer')}</button>
  <button type="button" data-commande="ajuster" onclick={() => ajuster()}>{t('plan.vue.ajuster')}</button>
  <button type="button" data-commande="listes" aria-pressed={$ui.listes} onclick={() => ui.basculerListes()}
    >{t('plan.vue.listes')}</button
  >
  <button type="button" data-commande="pleinEcran" aria-pressed={$ui.pleinEcran} onclick={() => ui.basculerPleinEcran()}
    >{t('plan.vue.pleinEcran')}</button
  >
</div>

<style>
  .barre-vue {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-2);
  }

  .tour {
    display: flex;
    align-items: center;
    gap: var(--espace-1);
  }

  button,
  select {
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
    background-color: var(--couleur-page-fond);
    color: var(--couleur-page-texte);
    font: inherit;
  }

  button {
    cursor: pointer;
  }

  /* Une bascule active se distingue par sa forme : trait intérieur épais,
     texte souligné ; sa boîte ne change pas, et la barre ne bouge pas. */
  button[aria-pressed='true'] {
    box-shadow: inset 0 0 0 2px var(--couleur-page-texte);
    text-decoration: underline;
  }

  button:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }
</style>
