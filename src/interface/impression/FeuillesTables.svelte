<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Les feuilles par table imprimées (§ 11.7), dans leur forme minimale :
  // une feuille en portrait, titrée, sans table, qui porte le pied de la
  // soirée ; l'option parTour de l'aperçu ne la change pas.
  //
  // Sans bandeMm, la vue rend sa feuille gabarit, que l'aperçu mesure.
  import { getContext } from 'svelte';
  import Feuille from './Feuille.svelte';

  let { options, feuille, bandeMm = null, orientation = $bindable(null) } = $props();

  const t = getContext('t');

  $effect(() => {
    orientation = 'portrait';
  });
</script>

<Feuille rang={0} papier={options.papier} orientation="portrait" {feuille} {bandeMm}>
  {#snippet contenu()}
    <p class="titre">{t('impression.tables.titre')}</p>
  {/snippet}
</Feuille>

<style>
  .titre {
    margin: 0;
    font-size: var(--taille-titre);
    font-weight: bold;
  }
</style>
