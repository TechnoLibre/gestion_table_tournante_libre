<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Un choix multiple parmi des valeurs nommées, une case par valeur, que la
  // grille (compact) et la fiche partagent pour les conflits d'organisation.
  // Le composant ne calcule rien : il reçoit ses choix tout faits,
  // {valeur, coche}, dans l'ordre où il les montre, et rend chaque bascule à
  // basculer(valeur, coche) ; la saisie, sa validation et les commandes
  // restent à qui le monte.
  //
  // Un groupe nommé par nom : dans la grille, un groupe compact,
  // data-editeur-choix, qui défile au-delà de quelques lignes ; dans la
  // fiche, un fieldset titré par legende. Chaque case porte sa valeur pour
  // nom, en texte, une donnée posée dans son propre nœud, et data-choix, son
  // rang à partir de 1. Les cases passent à la ligne quand la place manque.
  // Sans aucun choix, le groupe dit vide, en texte, et reçoit lui-même le
  // focus (tabindex -1) : les touches de validation y gardent leur effet.
  //
  // Une seule case est dans l'ordre de tabulation, l'active : la première à
  // l'ouverture, puis celle qui a reçu le focus. Les touches du contexte
  // 'cases' (raccourcis.js) — ← → Début Fin — mènent à la case voisine
  // (caseSuivante, presence.js), sans boucler ; la case reçue se fait
  // défiler dans le groupe. L'espace coche ou décoche, de lui-même ; toute
  // autre touche va à toucher(evenement), qui valide ou rend la saisie. La
  // sortie du groupe passe à sortir(evenement), qui lit relatedTarget pour
  // ignorer un focus resté dans le groupe. Quand un refus est posé
  // (invalide), chaque case porte aria-invalid, et le groupe comme chaque
  // case nomment decrit dans aria-describedby.
  import { effetDe } from '../raccourcis.js';
  import { caseSuivante } from './presence.js';

  let {
    choix,
    nom,
    legende = null,
    vide,
    compact = false,
    invalide = false,
    decrit = undefined,
    basculer,
    toucher = () => {},
    sortir = () => {},
    conteneur = $bindable(null),
  } = $props();

  // Le rang de la case active, à partir de 1 ; la première quand il dépasse
  // les choix.
  let active = $state(1);
  const rangActif = $derived(active <= choix.length ? active : 1);

  function surTouche(evenement, rang) {
    const voisine = caseSuivante(rang, effetDe('cases', evenement.key), choix.length);
    if (voisine === null) {
      toucher(evenement);
      return;
    }
    evenement.preventDefault();
    active = voisine;
    const cible = conteneur?.querySelector(`[data-choix="${voisine}"]`) ?? null;
    cible?.focus();
    cible?.scrollIntoView({ block: 'nearest' });
  }

  // Sans choix, le groupe lui-même reçoit les touches de validation.
  function surToucheGroupe(evenement) {
    if (evenement.target === evenement.currentTarget) toucher(evenement);
  }
</script>

{#snippet lesCases()}
  {#if choix.length === 0}
    <p class="vide">{vide}</p>
  {/if}
  {#each choix as { valeur, coche }, rang (valeur)}
    <label class="case">
      <input
        type="checkbox"
        data-choix={rang + 1}
        checked={coche}
        tabindex={rang + 1 === rangActif ? 0 : -1}
        aria-invalid={invalide ? 'true' : undefined}
        aria-describedby={decrit}
        onfocus={() => (active = rang + 1)}
        onchange={(evenement) => basculer(valeur, evenement.currentTarget.checked)}
        onkeydown={(evenement) => surTouche(evenement, rang + 1)}
      />
      <span class="valeur">{valeur}</span>
    </label>
  {/each}
{/snippet}

{#if compact}
  <!-- Sans choix, le groupe reçoit le focus et ses touches : Entrée valide,
       Échap rend la saisie. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="cases compact"
    role="group"
    data-editeur-choix
    aria-label={nom}
    aria-describedby={decrit}
    tabindex={choix.length === 0 ? -1 : undefined}
    bind:this={conteneur}
    onfocusout={sortir}
    onkeydown={surToucheGroupe}
  >
    {@render lesCases()}
  </div>
{:else}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <fieldset
    class="cases"
    aria-label={nom}
    aria-describedby={decrit}
    tabindex={choix.length === 0 ? -1 : undefined}
    bind:this={conteneur}
    onfocusout={sortir}
    onkeydown={surToucheGroupe}
  >
    {#if legende !== null}
      <legend>{legende}</legend>
    {/if}
    <div class="rangee">
      {@render lesCases()}
    </div>
  </fieldset>
{/if}

<style>
  /* Les cases : une rangée qui passe à la ligne, chaque case à la hauteur
     d'une cible. Compactes, dans une cellule de la grille, elles se serrent
     et défilent au-delà de 12rem ; dans la fiche, la légende les titre en
     petites capitales. Un nom long se replie entre deux mots, puis entre
     deux caractères : il ne sort pas de la cellule. */
  .cases {
    margin: 0;
    padding: 0;
    border: none;
  }

  .compact,
  .rangee {
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--espace-3);
  }

  .compact {
    gap: 0 var(--espace-2);
    max-height: 12rem;
    overflow-y: auto;
  }

  legend {
    margin-bottom: var(--espace-1);
    padding: 0;
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-intertitre);
    font-weight: bold;
    letter-spacing: var(--interlettre-capitales);
    text-transform: uppercase;
  }

  .vide {
    margin: 0;
    color: var(--couleur-page-texte-secondaire);
  }

  .case {
    display: inline-flex;
    align-items: center;
    gap: var(--espace-1);
    min-height: var(--cible-minimale);
    max-width: 100%;
  }

  .case input {
    flex: none;
    margin: 0;
  }

  .valeur {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /* Une case refusée porte le trait du refus ; le focus, déclaré après,
     l'emporte sur elle. */
  .case input[aria-invalid='true'] {
    outline: 2px solid var(--couleur-refus);
    outline-offset: 1px;
  }

  .case input:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 1px;
  }

  .cases:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }
</style>
