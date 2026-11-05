<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // La bande de mode (§ 8.4) : sous le bandeau, de bord à bord de la
  // fenêtre, l'icône du mode, son libellé — celui du bandeau et de la barre
  // de l'événement — en gras, puis la phrase qui dit ce que le mode permet
  // et la commande qui en sort (bandeDeMode, modele.js). Avec ces deux
  // libellés, elle porte seule le mode : aucun trait n'entoure la surface de
  // travail.
  //
  // Son fond et son filet sont ceux du mode (--couleur-mode-…-fond et
  // -filet), son icône de la teinte du mode (--couleur-mode-lecture,
  // -ecriture, -bloque), son texte de l'encre de la page (marques.js :
  // bandeMode et les signes bandeLecture, bandeEcriture, bandeBloque).
  // Région d'état, elle annonce le mode quand il change.
  //
  // Ses marges négatives valent le retrait de l'écran (App.svelte), que
  // l'écran de l'événement garde à toute largeur de fenêtre sans être borné
  // par --largeur-page : la bande touche le bandeau et va d'un bord à
  // l'autre de la fenêtre, et son retrait intérieur, de même valeur, aligne
  // son texte sur l'écran. Elle tient en une ligne aux largeurs usuelles, de
  // même hauteur dans les trois modes : changer de mode ne déplace pas la
  // place fixe de la barre, sous elle. Mince — une ligne de petit corps —,
  // elle prend au plan à peine plus que le retrait de l'écran qu'elle
  // remplace.
  import { getContext } from 'svelte';
  import Icone from '../primitives/Icone.svelte';
  import { bandeDeMode } from './modele.js';

  const t = getContext('t');
  const seance = getContext('seance');

  const bande = $derived(bandeDeMode($seance));
</script>

{#if bande !== null}
  <div class="bande" class:ecriture={bande.mode === 'ecriture'} class:bloque={bande.mode === 'bloque'} role="status">
    <span class="signe"><Icone nom={bande.icone} /></span>
    <strong>{t(bande.cle)}</strong>
    <span>{t(bande.explication)}</span>
  </div>
{/if}

<style>
  .bande {
    display: flex;
    flex: 0 0 auto;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-1) var(--espace-2);
    margin: calc(-1 * var(--espace-4)) calc(-1 * var(--espace-4)) 0;
    padding: 0.0625rem var(--espace-4);
    border-bottom: 1px solid var(--couleur-mode-lecture-filet);
    background-color: var(--couleur-mode-lecture-fond);
    color: var(--couleur-page-texte);
    font-size: var(--taille-texte-petit);
  }

  .bande.ecriture {
    border-bottom-color: var(--couleur-mode-ecriture-filet);
    background-color: var(--couleur-mode-ecriture-fond);
  }

  .bande.bloque {
    border-bottom-color: var(--couleur-mode-bloque-filet);
    background-color: var(--couleur-mode-bloque-fond);
  }

  .signe {
    display: flex;
    color: var(--couleur-mode-lecture);
  }

  .ecriture .signe {
    color: var(--couleur-mode-ecriture);
  }

  .bloque .signe {
    color: var(--couleur-mode-bloque);
  }
</style>
