<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Le plan imprimé (§ 11.7), dans sa forme minimale : la découpe du plan
  // du tour en pages (decoupeDuPlan), qui reçoit la bande mesurée et choisit
  // l'orientation, et une feuille par page, que son contenu titre de son
  // rang. Sous le titre, la tuile de la page : un <svg> sans dessin, de
  // viewBox le cadrage de la page en cm, à la taille que la découpe lui
  // donne sur le papier — le cadrage à l'échelle, en mm —, soit la surface
  // utile de la page, que la bande reçue diminue. L'orientation de la
  // découpe remonte à l'aperçu par la propriété liée orientation : c'est
  // celle qu'il demande à l'imprimante.
  //
  // Sans bandeMm, la vue rend sa feuille gabarit, en portrait — la largeur la
  // plus étroite, où le pied replie le plus —, que l'aperçu mesure.
  import { getContext } from 'svelte';
  import Feuille from './Feuille.svelte';
  import { decoupeDuPlan } from './modele.js';

  let { etat, options, feuille, bandeMm = null, orientation = $bindable(null) } = $props();

  const t = getContext('t');

  const decoupe = $derived(
    bandeMm === null ? null : decoupeDuPlan(etat, { papier: options.papier, bandeMm, decoupe: options.decoupe }),
  );

  $effect(() => {
    if (decoupe !== null) orientation = decoupe.orientation;
  });
</script>

{#if decoupe === null}
  <Feuille papier={options.papier} orientation="portrait" {feuille} />
{:else}
  {#each decoupe.pages as page (page.rang)}
    <Feuille rang={page.rang} papier={options.papier} orientation={decoupe.orientation} {feuille} {bandeMm}>
      {#snippet contenu()}
        <p class="titre">{t('impression.plan.page', { page: page.cartouche.page, total: page.cartouche.total })}</p>
        <svg
          viewBox="{page.cadrage.x} {page.cadrage.y} {page.cadrage.largeur} {page.cadrage.hauteur}"
          style:width="{page.cadrage.largeur * decoupe.echelle}mm"
          style:height="{page.cadrage.hauteur * decoupe.echelle}mm"
          aria-hidden="true"
        ></svg>
      {/snippet}
    </Feuille>
  {/each}
{/if}

<style>
  .titre {
    margin: 0;
    font-size: var(--taille-titre);
    font-weight: bold;
  }

  svg {
    display: block;
  }
</style>
