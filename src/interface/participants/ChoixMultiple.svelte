<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Un choix multiple parmi des valeurs nommées, une case par valeur, que la
  // grille (compact) et la fiche partagent pour les conflits d'organisation
  // et les inclusions. Le composant ne calcule rien lui-même : il reçoit
  // ses choix tout faits, {valeur, coche}, dans l'ordre où il les montre, et
  // rend chaque bascule à basculer(valeur, coche) ; la saisie, sa validation
  // et les commandes restent à qui le monte. Chaque case écrit
  // libelle(valeur), la valeur elle-même par défaut : un identifiant se
  // montre ainsi sous le nom de sa personne.
  //
  // Un groupe nommé par nom : dans la grille, un groupe compact,
  // data-editeur-choix, qui défile au-delà de quelques lignes ; dans la
  // fiche, un fieldset titré par legende. Chaque case porte son libellé pour
  // nom, en texte, une donnée posée dans son propre nœud, et data-choix, son
  // rang à partir de 1 parmi les cases montrées. Les cases passent à la
  // ligne quand la place manque. Sans aucun choix, le groupe dit vide, en
  // texte, et reçoit lui-même le focus (tabindex -1) : les touches de
  // validation y gardent leur effet.
  //
  // Avec filtre, {nom, aucun, cle, lu}, le groupe s'ouvre sur une zone de
  // recherche nommée filtre.nom (data-recherche-choix), qui reste en haut du
  // groupe quand il défile : seules les cases dont la clé de filtre.lu(valeur)
  // — le nom seul, sans les marques du libellé — contient celle de la
  // recherche se montrent (choixFiltres, choix_multiple.js), et
  // filtre.aucun(texte) dit, en texte, qu'aucune ne la contient. La recherche
  // ne change pas la saisie : une case cochée qu'elle cache reste cochée.
  // Échap dans une recherche non vide la vide ; toute autre touche, et Échap
  // dans une recherche vide, va à toucher(evenement).
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
  import { choixFiltres } from './choix_multiple.js';
  import { caseSuivante } from './presence.js';

  let {
    choix,
    nom,
    legende = null,
    vide,
    libelle = (valeur) => valeur,
    filtre = null,
    compact = false,
    invalide = false,
    decrit = undefined,
    basculer,
    toucher = () => {},
    sortir = () => {},
    conteneur = $bindable(null),
  } = $props();

  // La recherche saisie, et les choix qu'elle laisse voir.
  let recherche = $state('');
  const montres = $derived(filtre === null ? choix : choixFiltres(choix, recherche, filtre.lu, filtre.cle));

  // Le rang de la case active, à partir de 1 ; la première quand il dépasse
  // les choix montrés.
  let active = $state(1);
  const rangActif = $derived(active <= montres.length ? active : 1);

  function surTouche(evenement, rang) {
    const voisine = caseSuivante(rang, effetDe('cases', evenement.key), montres.length);
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

  // Dans la recherche : Échap la vide quand elle porte un texte ; toute
  // autre touche va à toucher.
  function surToucheRecherche(evenement) {
    if (effetDe('champ', evenement.key) === 'rendre' && recherche !== '') {
      evenement.preventDefault();
      recherche = '';
      return;
    }
    toucher(evenement);
  }
</script>

{#snippet laRecherche()}
  {#if filtre !== null}
    <input
      class="recherche"
      type="search"
      autocomplete="off"
      data-recherche-choix
      aria-label={filtre.nom}
      placeholder={filtre.nom}
      bind:value={recherche}
      onkeydown={surToucheRecherche}
    />
  {/if}
{/snippet}

{#snippet lesCases()}
  {#if choix.length === 0}
    <p class="vide">{vide}</p>
  {:else if montres.length === 0}
    <p class="vide" data-aucun-choix>{filtre.aucun(recherche)}</p>
  {/if}
  {#each montres as { valeur, coche }, rang (valeur)}
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
      <span class="valeur">{libelle(valeur)}</span>
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
    {@render laRecherche()}
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
    {@render laRecherche()}
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

  /* La recherche : un champ de la largeur du groupe, qui reste en haut
     d'un groupe compact quand ses cases défilent. Son texte indicatif prend
     l'encre secondaire, à pleine opacité, que la palette mesure sur la carte
     dans les deux thèmes : le gris par défaut du navigateur ne change pas
     de thème. */
  .recherche {
    box-sizing: border-box;
    flex: 1 0 100%;
    width: 100%;
    min-height: var(--cible-minimale);
    margin-bottom: var(--espace-1);
    padding: var(--espace-1) var(--espace-2);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
  }

  .recherche::placeholder {
    color: var(--couleur-page-texte-secondaire);
    opacity: 1;
  }

  .compact .recherche {
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .recherche:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 1px;
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
