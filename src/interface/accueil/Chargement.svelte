<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Le signe d'une valeur de la liste qui se calcule encore (§ 8.1) : un arc
  // de cercle dessiné en SVG (§ 7.6), que porte une cellule qui se dit
  // occupée (aria-busy). Il est décoratif (aria-hidden) : la liste annonce
  // son chargement une seule fois, dans sa région d'état
  // (ListeEvenements.svelte), et non une fois par valeur. Il tourne d'un
  // tour par seconde : c'est la seule animation de l'interface, et aucun
  // état n'en dépend — rien n'attend sa fin, rien ne lit son rendu. Il reste
  // immobile sous prefers-reduced-motion: reduce, et la feuille qui annule
  // les animations des captures (§ 19.2) l'arrête comme toute autre. L'arc
  // est peint de l'encre secondaire de la page, sans opacité partielle
  // (§ 14.5) ; son trait est la marque « chargement » du registre
  // (marques.js).
</script>

<svg class="rouet" data-chargement viewBox="0 0 16 16" aria-hidden="true">
  <path data-marque="chargement" d="M 8 2 A 6 6 0 1 1 2 8" />
</svg>

<style>
  .rouet {
    width: 1em;
    height: 1em;
    vertical-align: -0.125em;
    animation: rotation 1s linear infinite;
  }

  path {
    fill: none;
    stroke: var(--couleur-page-texte-secondaire);
    stroke-width: 2;
    stroke-linecap: round;
  }

  @keyframes rotation {
    to {
      transform: rotate(1turn);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rouet {
      animation: none;
    }
  }
</style>
