<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La bande de mode (§ 8.4) : sous le bandeau, de bord à bord de la
  // fenêtre, l'icône du mode, son libellé — celui du cadre et du
  // bandeau — en gras, puis la phrase qui dit ce que le mode permet et la
  // commande qui en sort (bandeDeMode, modele.js). Elle s'ajoute au cadre de
  // mode, qui reste autour de la surface de travail, et ne le remplace pas.
  //
  // Son fond et son filet sont ceux du mode, son icône de la teinte du
  // cadre, son texte de l'encre de la page (marques.js : bandeMode et les
  // signes bandeLecture, bandeEcriture, bandeBloque). Région d'état, elle
  // annonce le mode quand il change.
  //
  // Sa marge haute négative vaut le retrait de l'écran (App.svelte) : la
  // bande touche le bandeau. Ses marges latérales négatives valent la
  // distance du contenu de la colonne au bord de la fenêtre : le retrait de
  // l'écran tant que la fenêtre ne dépasse pas --largeur-page, ce retrait
  // plus la moitié de l'excédent au-delà, où la colonne se centre. La bande
  // va donc d'un bord à l'autre de la fenêtre à toute largeur, et son retrait
  // intérieur, de même valeur, aligne son texte sur la colonne. 100vw égale
  // la largeur utile de la fenêtre parce que l'écran de l'événement tient
  // dans sa hauteur (Evenement.svelte) : aucune barre de défilement
  // verticale n'en retranche, et la page ne défile pas en largeur. Elle tient en
  // une ligne aux largeurs usuelles, de même hauteur dans les trois modes :
  // changer de mode ne déplace pas la place fixe du cadre, sous elle. Mince
  // — une ligne de petit corps —, elle prend au plan à peine plus que le
  // retrait de l'écran qu'elle remplace.
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
    margin: calc(-1 * var(--espace-4)) calc(-1 * max(var(--espace-4), (100vw - var(--largeur-page)) / 2 + var(--espace-4))) 0;
    padding: 0.0625rem max(var(--espace-4), (100vw - var(--largeur-page)) / 2 + var(--espace-4));
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
    color: var(--couleur-cadre-lecture);
  }

  .ecriture .signe {
    color: var(--couleur-cadre-ecriture);
  }

  .bloque .signe {
    color: var(--couleur-cadre-bloque);
  }
</style>
