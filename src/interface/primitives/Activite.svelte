<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La pastille de l'indicateur d'activité (§ 5.10) : « Traitement en
  // cours… », au bas de la fenêtre, centrée, par-dessus l'écran, tant
  // qu'une opération longue suivie (activite.js) n'est pas finie. App la
  // monte une fois. Au repos, elle est absente du DOM : aucune capture ne la
  // voit. role="status" l'annonce sans prendre le focus ; le signe, l'arc de
  // la marque « chargement » (marques.js), est décoratif (aria-hidden), le
  // texte la nomme.
  //
  // Elle se monte et se peint avant que l'opération ne parte (suivre), mais
  // ne se voit qu'au bout d'une demi-seconde : une opération brève passe sans
  // rien montrer. L'apparition est une animation d'opacité en un seul pas —
  // 0 pendant le délai, par son remplissage arrière, puis 1, sans valeur
  // partielle (§ 14.5) —, et le signe tourne d'un tour par seconde par une
  // animation de transformation : le compositeur joue l'une et l'autre hors
  // du fil principal, pendant le bloc synchrone de l'opération. Aucun état
  // n'en dépend ni n'attend leur fin. Sous prefers-reduced-motion: reduce,
  // la pastille apparaît de même — l'apparition n'est pas un mouvement —,
  // et le signe reste immobile ; la feuille qui annule les animations des
  // captures (§ 19.2) la montre d'emblée. Elle ne s'imprime pas.
  //
  // Fond de la carte, filet de la page, texte de la page : le texte tient
  // 4,5:1 et le signe, de l'encre secondaire, 3:1 sur le fond de la carte
  // dans les deux thèmes.
  import { getContext } from 'svelte';
  import { activite } from '../activite.js';

  const t = getContext('t');
</script>

{#if $activite}
  <div class="activite" data-activite role="status">
    <svg class="signe" viewBox="0 0 16 16" aria-hidden="true">
      <path data-marque="chargement" d="M 8 2 A 6 6 0 1 1 2 8" />
    </svg>
    <span>{t('communs.activite')}</span>
  </div>
{/if}

<style>
  .activite {
    position: fixed;
    inset-inline: 0;
    bottom: var(--espace-5);
    z-index: 4;
    display: flex;
    align-items: center;
    gap: var(--espace-2);
    width: fit-content;
    margin-inline: auto;
    padding: var(--espace-2) var(--espace-4);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-pilule);
    background-color: var(--couleur-carte-fond);
    box-shadow: var(--ombre-2);
    color: var(--couleur-page-texte);
    font-size: var(--taille-texte-petit);
    animation: apparition 1ms steps(1, end) 500ms both;
  }

  @keyframes apparition {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .signe {
    flex: none;
    width: 1em;
    height: 1em;
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
    .signe {
      animation: none;
    }
  }

  @media print {
    .activite {
      display: none;
    }
  }
</style>
