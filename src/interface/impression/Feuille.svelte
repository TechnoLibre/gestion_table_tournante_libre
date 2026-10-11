<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Une feuille imprimée, une page (§ 11.7) : aux dimensions du papier dans
  // son orientation, en mm, sa marge de MARGE_PAGE_MM sur chaque bord ; sa
  // zone de contenu [data-contenu], ce que la vue y pose ; ce que la vue
  // porte hors du contenu (bande) ; son pied [data-pied] ; et le filigrane
  // BROUILLON, par-dessus, quand la feuille est un brouillon. Elle demande
  // par sa propriété page la page nommée de son papier et de son
  // orientation (impression.css), et se termine à l'impression par un saut
  // de page. Le papier est clair dans les deux thèmes : la feuille est sous
  // [data-impression], qui porte les jetons du clair, et peint son fond du
  // papier et son texte de l'encre de la page.
  //
  // À l'écran, le bord de la feuille est un contour tracé sur son propre
  // rectangle, qui ne prend aucune place : la zone de contenu a la largeur
  // de la page moins ses marges, à l'écran comme sur le papier, et la tuile
  // du plan, à la largeur utile, y tient sans être rognée.
  //
  // La zone de contenu mesure la hauteur utile que la découpe reçoit : la
  // page, moins les marges, moins bandeMm, la bande mesurée sur la feuille
  // gabarit. Sans bandeMm, la feuille est le gabarit : sa hauteur suit ce
  // qu'elle porte, son contenu est vide et de hauteur nulle, et elle ne
  // porte ni rang, ni filigrane. L'aperçu la mesure (bandeDeFeuille).
  import { constante } from '../../geometrie/constantes.js';
  import Filigrane from './Filigrane.svelte';
  import PiedDePage from './PiedDePage.svelte';
  import { dimensionsPage, hauteurContenu, nomPage } from './modele.js';

  let { rang = null, papier, orientation, feuille, bandeMm = null, contenu = null, bande = null } = $props();

  const marge = constante('MARGE_PAGE_MM');
  const gabarit = $derived(bandeMm === null);
  const dimensions = $derived(dimensionsPage(papier, orientation));
  const hauteur = $derived(gabarit ? undefined : `${dimensions.hauteur}mm`);
  const hauteurUtile = $derived(gabarit ? 0 : hauteurContenu({ papier, orientation, margeMm: marge, bandeMm }));
  const page = $derived(nomPage(papier, orientation));
</script>

<section
  class="feuille"
  data-feuille={gabarit ? undefined : rang}
  style:width="{dimensions.largeur}mm"
  style:height={hauteur}
  style:padding="{marge}mm"
  style:page
>
  <div class="contenu" data-contenu style:height="{hauteurUtile}mm">
    {#if !gabarit}
      {@render contenu?.()}
    {/if}
  </div>
  {@render bande?.()}
  <PiedDePage elements={feuille.elements} />
  {#if feuille.filigrane && !gabarit}
    <Filigrane {papier} {orientation} />
  {/if}
</section>

<style>
  .feuille {
    position: relative;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    margin: 0 auto var(--espace-5);
    overflow: hidden;
    outline: 1px solid var(--couleur-page-filet);
    outline-offset: -1px;
    background-color: var(--couleur-papier);
    color: var(--couleur-page-texte);
    box-shadow: var(--ombre-2);
  }

  .contenu {
    flex: none;
    min-height: 0;
    overflow: hidden;
  }
</style>
