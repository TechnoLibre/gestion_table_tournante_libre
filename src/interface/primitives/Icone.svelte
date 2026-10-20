<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Une icône du module des primitives (icones.js) : un <svg> au trait,
  // sans remplissage, du trait de la couleur courante — le parent la règle
  // par color, d'un jeton. Elle est cachée aux technologies d'assistance et
  // ne prend jamais le focus : un libellé l'accompagne toujours. taille :
  // le côté du carré, en px. marque, le nom d'une marque du registre
  // (MARQUES, marques.js), se pose en data-marque sur chacun de ses tracés,
  // que les épreuves de rendu mesurent ; null, aucun. Un nom inconnu lève
  // RangeError au montage.
  import { traceIcone } from './icones.js';

  let { nom, taille = 16, marque = null } = $props();

  const traces = $derived(traceIcone(nom));
</script>

<svg
  class="icone"
  width={taille}
  height={taille}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  {#each traces as trace, rang (rang)}
    <path d={trace} data-marque={marque ?? undefined} />
  {/each}
</svg>

<style>
  .icone {
    flex: none;
    vertical-align: middle;
  }
</style>
