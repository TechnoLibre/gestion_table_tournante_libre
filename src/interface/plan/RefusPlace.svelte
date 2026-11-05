<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Un refus, ou un avertissement, posé sur une place du plan (§ 5.9, § 6.2,
  // § 7.1) : hors du <svg data-plan>, dans la surface qui le porte, à la
  // position que Plan.svelte calcule par ecranDepuisDessin au moment du
  // refus, puis à chaque changement de vue. Il nomme la place — la table, et
  // le siège quand c'en est un, par le libellé que rend libellePlace —, puis
  // montre le refus et chacun de details.autres par la primitive Refus,
  // chacun avec la commande de son remède, puis chaque avertissement. La
  // place le désigne par aria-describedby, vers id.
  //
  // Posé sur le plan, le message couvre d'autres places : seuls ses
  // contrôles reçoivent le pointeur. Un appui sur le texte va au plan
  // dessous, dont l'appui retire la pose et saisit ce qui est visé — le
  // refus se ferme au geste suivant sans lui prendre sa cible.
  //
  // Le message se pose par placerBulle : à droite et sous la place quand il
  // y tient, sinon de l'autre côté, et dans la zone — il ne couvre pas le
  // panneau voisin et ne sort pas du cadre. Sa taille se lit par un
  // observateur de taille (bind:offsetWidth) ; elle ne dépend pas de sa
  // position, sa largeur étant celle de son contenu, bornée.
  //
  // pose : {id, numero, siege|null, refus|null, avertissements, x, y} — x et y
  // en px de la surface ; zone : le cadre du <svg> dans la surface ; fermer :
  // retire la pose ; gestes : ceux qu'un remède emprunte à l'écran — le choix
  // d'une place sur le plan —, que Refus reçoit tels quels. « Fermer » se
  // désigne par data-commande="fermerPose".
  import { getContext } from 'svelte';
  import { nomsDesTours } from '../../application/tours.js';
  import Refus from '../primitives/Refus.svelte';
  import { libellePlace } from './gestes.js';
  import { placerBulle } from './vue_plan.js';

  let { pose, zone, fermer, gestes = {} } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  // Les noms des tours, que le texte d'un avertissement lit (aides.js).
  const nomsTours = $derived($seance?.charge ? nomsDesTours($seance.charge) : undefined);
  const libelle = $derived(libellePlace(pose));

  let largeur = $state(0);
  let hauteur = $state(0);
  const position = $derived(placerBulle({ x: pose.x, y: pose.y }, { largeur, hauteur }, zone));
</script>

<div
  class="refus-place"
  id={pose.id}
  style:left="{position.x}px"
  style:top="{position.y}px"
  bind:offsetWidth={largeur}
  bind:offsetHeight={hauteur}
>
  <p class="place">
    {t(libelle.cle, libelle.details)}
  </p>
  {#if pose.refus !== null}
    <Refus refus={pose.refus} lever={fermer} {gestes} />
  {/if}
  {#each pose.avertissements as avertissement, rang (rang)}
    <p class="avertissement" role="status" data-avertissement={avertissement.code}>{t(avertissement.code, { nomsTours, ...avertissement.details })}</p>
  {/each}
  <button type="button" class="fermer" data-commande="fermerPose" onclick={fermer}>{t('plan.refus.fermer')}</button>
</div>

<style>
  /* Une carte flottante : fond et filet de la carte, ombre portée. Sa
     largeur est celle de son contenu, bornée à 22rem et à la surface. */
  .refus-place {
    position: absolute;
    z-index: 1;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
    box-sizing: border-box;
    width: max-content;
    max-width: min(22rem, 100%);
    padding: var(--espace-3);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-2);
    background: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    box-shadow: var(--ombre-2);
    font-size: var(--taille-texte);
  }

  .refus-place :global(button) {
    pointer-events: auto;
  }

  p {
    margin: 0;
  }

  .place {
    font-weight: 700;
  }

  .avertissement {
    color: var(--couleur-avis);
  }

  /* « Fermer » : une commande discrète, au filet de la page. */
  .fermer {
    align-self: flex-end;
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    cursor: pointer;
  }

  .fermer:hover {
    background-color: var(--couleur-carte-fond-sourd);
  }

  .fermer:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }
</style>
