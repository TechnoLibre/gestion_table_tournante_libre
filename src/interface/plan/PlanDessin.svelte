<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<svelte:options namespace="svg" />

<script>
  // Le dessin du plan (§ 7.1, § 7.3 à § 7.7), enfant du groupe <g data-vue>
  // que Plan.svelte transforme : les motifs, les tables — plateaux, numéros,
  // chaises, poignées, pastilles —, puis les listes de noms, peintes par-dessus et
  // transparentes au pointeur. Le composant ne lit k qu'à travers le modèle
  // (modele.js), qu'il reçoit entier ; aucun attribut qu'il écrit ne dépend
  // de k hors du franchissement d'un seuil — régime des cibles, K_LISTES.
  //
  // Les mesures du texte se relèvent sur une sonde : un <text> caché au
  // style des listes, et un tspan en italique pour les titres. La hauteur
  // d'une ligne est la hauteur d'encre du gabarit (mesure_texte.js) ; les
  // listes paraissent une fois les mesures prises, et la largeur de leur
  // bloc est LARGEUR_BLOC_NOMS_CM du registre. Aucun <canvas>.
  //
  // Un plan monté caché — un ancêtre en display: none — n'a pas de mise en
  // page : ses largeurs mesurées vaudraient 0. Les mesures ne se prennent
  // donc que sur une sonde rendue, au montage, puis à chaque changement de
  // taille du <svg> qui porte le dessin, qu'un ResizeObserver signale : un
  // plan qui se cache perd ses mesures, et ses listes, et les reprend en se
  // montrant.
  //
  // Le modèle du plan imprimé (modele.impression, § 11.7) se dessine de
  // même, chaque table sans poignée, ni cible, ni identifiant (TablePlan) ;
  // ses listes ont la largeur et la troncature de l'écran (§ 7.4).
  import { untrack } from 'svelte';
  import { constante } from '../../geometrie/constantes.js';
  import { TAILLE_TEXTE_LISTE_CM } from '../../geometrie/texte.js';
  import ListeNoms from './ListeNoms.svelte';
  import { creerMesureur, hauteurLigne, mesurable } from './mesure_texte.js';
  import Motifs from './Motifs.svelte';
  import TablePlan from './TablePlan.svelte';

  let { modele } = $props();

  const prefixe = $props.id();
  const largeur = constante('LARGEUR_BLOC_NOMS_CM');

  let sonde = $state(null);
  let sondeItalique = $state(null);
  let mesures = $state(null);

  // Prend les mesures quand la sonde est rendue et qu'il n'y en a pas ; les
  // oublie quand elle ne l'est plus.
  function actualiserMesures() {
    if (!mesurable(sonde)) mesures = null;
    else if (mesures === null) {
      mesures = { hauteur: hauteurLigne(sonde), mesurer: creerMesureur(sonde), mesurerItalique: creerMesureur(sondeItalique) };
    }
  }

  $effect(() => {
    const cible = sonde.ownerSVGElement ?? sonde;
    untrack(actualiserMesures);
    const observateur = new ResizeObserver(actualiserMesures);
    observateur.observe(cible);
    return () => observateur.disconnect();
  });
</script>

<Motifs {prefixe} />
{#each modele.tables as table (table.id)}
  <TablePlan {table} signaler={modele.signalerConflits} {prefixe} impression={modele.impression === true} />
{/each}
<text class="sonde" font-size={TAILLE_TEXTE_LISTE_CM} aria-hidden="true" bind:this={sonde}
  ><tspan class="titre" bind:this={sondeItalique}></tspan></text
>
{#if modele.listesRendues && mesures !== null}
  {#each modele.tables as table (table.id)}
    <ListeNoms {table} {mesures} {largeur} />
  {/each}
{/if}

<style>
  /* La sonde a le style des listes (ListeNoms.svelte) ; elle ne se voit pas
     et ne porte de texte que le temps d'une mesure. */
  .sonde {
    font-family: var(--police-interface);
    text-rendering: geometricPrecision;
    white-space: pre;
    visibility: hidden;
    pointer-events: none;
  }

  .titre {
    font-style: italic;
  }
</style>
