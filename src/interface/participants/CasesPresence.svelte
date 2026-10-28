<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Les cases d'une saisie de la présence par tour, une par tour, que la
  // grille (compact) et la fiche partagent. Le composant ne calcule rien :
  // il reçoit ses cases toutes faites (casesDeSaisie, presence.js) et rend
  // chaque bascule à basculer(tour, coche) ; la saisie, sa validation et la
  // commande restent à qui le monte.
  //
  // Un groupe nommé « Présence de <nom>, une case par tour » : dans la
  // grille, un groupe compact, data-editeur-presence, dont chaque case
  // affiche son numéro et se nomme par le nom de son tour, « Tour r » sans
  // lui ; dans la fiche, un fieldset titré « Présente aux tours », chaque
  // case sous ce nom entier. nomsTours porte les noms des tours de
  // l'événement (nomsDesTours) ; absent, aucun tour n'a de nom. Chaque
  // case porte data-presence-tour. Les cases passent à la ligne quand la
  // place manque : R peut aller jusqu'à TOURS_MAX.
  //
  // Une seule case est dans l'ordre de tabulation, l'active : la première à
  // l'ouverture, puis celle qui a reçu le focus. Les touches du contexte
  // 'cases' (raccourcis.js) — ← → Début Fin — mènent à la case voisine
  // (caseSuivante) ; l'espace coche ou décoche, de lui-même ; toute autre
  // touche va à toucher(evenement), qui valide ou rend la saisie. La
  // sortie du groupe passe à sortir(evenement), qui lit relatedTarget pour
  // ignorer un focus resté dans le groupe. Quand un refus est posé
  // (invalide), chaque case porte aria-invalid, et le groupe comme chaque
  // case nomment decrit dans aria-describedby.
  import { getContext } from 'svelte';
  import { effetDe } from '../raccourcis.js';
  import { caseSuivante } from './presence.js';

  let {
    cases,
    nom,
    nomsTours = undefined,
    compact = false,
    invalide = false,
    decrit = undefined,
    basculer,
    toucher = () => {},
    sortir = () => {},
    conteneur = $bindable(null),
  } = $props();

  const t = getContext('t');

  // Le tour de la case active ; la première quand il n'est plus parmi les cases.
  let active = $state(1);
  const tourActif = $derived(cases.some(({ tour }) => tour === active) ? active : 1);

  function surTouche(evenement, tour) {
    const voisine = caseSuivante(tour, effetDe('cases', evenement.key), cases.length);
    if (voisine === null) {
      toucher(evenement);
      return;
    }
    evenement.preventDefault();
    active = voisine;
    conteneur?.querySelector(`[data-presence-tour="${voisine}"]`)?.focus();
  }
</script>

{#snippet lesCases()}
  {#each cases as { tour, coche } (tour)}
    <label class="case">
      <input
        type="checkbox"
        data-presence-tour={tour}
        checked={coche}
        tabindex={tour === tourActif ? 0 : -1}
        aria-label={compact ? t('participants.presence.case', { tour, nomsTours }) : undefined}
        aria-invalid={invalide ? 'true' : undefined}
        aria-describedby={decrit}
        onfocus={() => (active = tour)}
        onchange={(evenement) => basculer(tour, evenement.currentTarget.checked)}
        onkeydown={(evenement) => surTouche(evenement, tour)}
      />
      <span>{t(compact ? 'participants.presence.caseCourte' : 'participants.presence.case', { tour, nomsTours })}</span>
    </label>
  {/each}
{/snippet}

{#if compact}
  <div
    class="cases compact"
    role="group"
    data-editeur-presence
    aria-label={t('participants.presence.editeur', { nom })}
    aria-describedby={decrit}
    bind:this={conteneur}
    onfocusout={sortir}
  >
    {@render lesCases()}
  </div>
{:else}
  <fieldset class="cases" aria-label={t('participants.presence.editeur', { nom })} aria-describedby={decrit} bind:this={conteneur} onfocusout={sortir}>
    <legend>{t('participants.fiche.presenceLegende')}</legend>
    <div class="rangee">
      {@render lesCases()}
    </div>
  </fieldset>
{/if}

<style>
  /* Les cases : une rangée qui passe à la ligne, chaque case à la hauteur
     d'une cible. Compactes, dans une cellule de la grille, elles se
     serrent ; dans la fiche, la légende les titre en petites capitales. */
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

  .case {
    display: inline-flex;
    align-items: center;
    gap: var(--espace-1);
    min-height: var(--cible-minimale);
    white-space: nowrap;
  }

  .case input {
    margin: 0;
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
</style>
