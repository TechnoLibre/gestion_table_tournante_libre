<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Le filigrane BROUILLON d'une feuille (§ 11.7, § 14.5) : le texte de la
  // traduction, au trait — aucun remplissage, un contour du jeton
  // --couleur-filigrane —, par-dessus le contenu de la feuille, couché sur sa
  // diagonale montante par une rotation de l'élément lui-même. Ni opacité
  // partielle, ni filtre : un contour se lit sans cacher les noms dessous,
  // et sa couleur relue est celle qui se peint. Le dessin couvre la page
  // entière, en mm de papier, et ne reçoit aucun pointeur. Le texte reste
  // un texte : il est dans la couche de texte de la page imprimée.
  // data-marque le nomme au registre des marques (marques.js).
  import { getContext } from 'svelte';
  import { filigraneDe } from './modele.js';

  let { papier, orientation } = $props();

  const t = getContext('t');

  const dessin = $derived(filigraneDe(papier, orientation));
</script>

<svg
  class="filigrane"
  data-filigrane
  viewBox="0 0 {dessin.largeur} {dessin.hauteur}"
  role="img"
  aria-label={t('impression.filigrane')}
>
  <text
    data-marque="filigrane"
    x={dessin.x}
    y={dessin.y}
    font-size={dessin.corps}
    stroke-width={dessin.trait}
    style:transform="rotate({dessin.angle}deg)">{t('impression.filigrane')}</text
  >
</svg>

<style>
  .filigrane {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    pointer-events: none;
  }

  text {
    fill: none;
    stroke: var(--couleur-filigrane);
    font-family: var(--police-interface);
    font-weight: bold;
    text-anchor: middle;
    dominant-baseline: central;
    transform-box: fill-box;
    transform-origin: center;
  }
</style>
