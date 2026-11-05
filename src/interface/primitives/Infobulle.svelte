<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // L'infobulle d'un terme (§ 12.7, § 14.5, § 14.6) : un seul élément
  // [role=tooltip], toujours présent, caché tant qu'aucun terme n'est
  // expliqué. Le porteur l'ouvre au survol et au focus du clavier d'un terme
  // — un survol n'est jamais le seul chemin —, la referme quand le pointeur
  // ou le focus quitte ce terme, et donne au terme expliqué
  // aria-describedby={id} : un lecteur d'écran lit l'explication avec lui.
  // Échap la referme, le focus restant où il est.
  //
  // ouverte : null, ou {ancre, cle, details} — l'élément du terme expliqué et
  // la clé de traduction de son texte ; fermer() : rendu au porteur, qui
  // remet ouverte à null. id : celui que l'aria-describedby du terme désigne.
  //
  // La place se calcule par placerInfobulle (infobulle.js) sur les rectangles
  // relus du rendu, à l'ouverture puis à chaque défilement — un conteneur
  // défilant compris, que l'écoute en capture atteint — et à chaque
  // redimensionnement : sous le terme, ou au-dessus, jamais dessus, dans la
  // fenêtre. Sa largeur est celle de son texte, bornée par max-width : elle
  // ne dépend pas de sa place, et se mesure où qu'elle soit. Tant qu'elle
  // n'est pas placée, elle reste invisible. Une ancre retirée du document la
  // referme. Elle ne capte aucun pointeur : le terme reste survolé.
  import { getContext } from 'svelte';
  import { effetDe } from '../raccourcis.js';
  import { placerInfobulle } from './infobulle.js';

  let { id, ouverte = null, fermer } = $props();

  const t = getContext('t');

  let element = $state(null);
  // Le coin haut gauche de l'infobulle dans la fenêtre, en px ; null tant
  // qu'elle n'est pas placée.
  let place = $state(null);

  function placer() {
    if (ouverte === null || element === null) return;
    if (!ouverte.ancre.isConnected) {
      fermer();
      return;
    }
    const a = ouverte.ancre.getBoundingClientRect();
    const b = element.getBoundingClientRect();
    const fenetre = document.documentElement;
    place = placerInfobulle(
      { gauche: a.left, haut: a.top, droite: a.right, bas: a.bottom },
      { largeur: b.width, hauteur: b.height },
      { largeur: fenetre.clientWidth, hauteur: fenetre.clientHeight },
    );
  }

  // À chaque terme expliqué, après le rendu de son texte.
  $effect(() => {
    if (ouverte === null) {
      place = null;
      return;
    }
    placer();
  });

  function surTouche(evenement) {
    if (ouverte !== null && effetDe('fenetre', evenement.key) === 'fermer') fermer();
  }
</script>

<svelte:window onkeydown={surTouche} onscrollcapture={placer} onresize={placer} />

<div
  bind:this={element}
  class="infobulle"
  class:placee={place !== null}
  role="tooltip"
  {id}
  hidden={ouverte === null}
  style:left={place === null ? null : `${place.gauche}px`}
  style:top={place === null ? null : `${place.haut}px`}
>
  {#if ouverte !== null}{t(ouverte.cle, ouverte.details)}{/if}
</div>

<style>
  .infobulle {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 3;
    box-sizing: border-box;
    width: max-content;
    max-width: min(26rem, calc(100% - 16px));
    padding: var(--espace-2) var(--espace-3);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-2);
    background: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    box-shadow: var(--ombre-2);
    font-size: var(--taille-texte);
    font-weight: normal;
    line-height: 1.4;
    text-align: left;
    white-space: normal;
    pointer-events: none;
    visibility: hidden;
  }

  .infobulle.placee {
    visibility: visible;
  }

  .infobulle[hidden] {
    display: none;
  }
</style>
