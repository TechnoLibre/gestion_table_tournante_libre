<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<svelte:options namespace="svg" />

<script>
  // Le fantôme d'une personne glissée (§ 5.8, § 7.1) : un <g data-fantome>
  // permanent, enfant du <svg data-plan> hors du groupe de la vue, dont
  // l'unité est le pixel CSS — il garde sa taille à tout zoom. Plan.svelte
  // écrit son attribut transform à chaque image, directement, et le montre
  // par la propriété fantome : le nom de la personne, dans son propre nœud,
  // puis le libellé de ce que le geste modifie — la clé que cleFantome
  // (gestes.js) tire de la cible de l'état des places et de la portée de la
  // réservation qui tient la personne. Caché, il ne porte
  // rien ; montré ou non, il ne reçoit pas le pointeur.
  //
  // fantome : {nom, cle} | null ; element : le <g>, lié pour Plan.svelte.
  import { getContext } from 'svelte';

  let { fantome = null, element = $bindable(null) } = $props();

  const t = getContext('t');
</script>

<g class="fantome" class:cache={fantome === null} data-fantome bind:this={element}>
  {#if fantome !== null}
    <circle class="disque" data-marque="fantome" r="10" />
    <text class="texte" x="16" y="-6"
      ><tspan data-partie="nom">{fantome.nom}</tspan><tspan x="16" dy="1.25em" data-partie="etat">{t(fantome.cle)}</tspan></text
    >
  {/if}
</g>

<style>
  .fantome {
    pointer-events: none;
  }

  .fantome.cache {
    display: none;
  }

  .disque {
    fill: none;
    stroke: var(--couleur-fantome);
    stroke-width: 4;
  }

  .texte {
    fill: var(--couleur-liste-texte);
    font-family: var(--police-interface);
    font-size: var(--taille-texte);
    font-weight: 700;
    white-space: pre;
  }
</style>
