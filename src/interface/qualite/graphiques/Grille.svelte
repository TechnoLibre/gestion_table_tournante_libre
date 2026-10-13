<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Une grille de comptes (§ 12.5, § 12.11, D33, D35) : la matrice « qui a
  // rencontré qui », ou les tables par tour. Chaque case est bordée, peinte
  // du niveau de son compte sur l'échelle à quatre niveaux — 0, 1, 2, 3 et
  // plus —, le compte écrit de l'encre qui sert ce niveau (NIVEAUX_GRAPHIQUE,
  // marques.js). Une case sans compte écrit « — », sans couleur ; sous
  // diagonale, une case de même ligne et colonne est vide et neutre. Aucune
  // case n'est une cible : ni focus, ni clic ; le jumeau et la fiche portent
  // les mêmes comptes.
  //
  // lignes et colonnes : [{libelle}], libellés déjà écrits ; valeurs, les
  // comptes en ordre de lignes, null sans compte. Quand ses cases ne
  // tiennent pas dans la largeur réelle de la carte (grille, graphique.js),
  // la grille cède la place à phrase, un texte déjà traduit ou un snippet ;
  // dessinable, liable, le dit à la vue.
  //
  // Le pointage désigne la case sous le pointeur, aucune sur la diagonale ;
  // pointe, liable, en porte l'indice, ligne × colonnes + colonne ;
  // infobulle, {colonnes, lignes}, une ligne par case dans cet ordre
  // (Graphique). ecrire(v) écrit un compte, par défaut le nombre mis en
  // forme. coteMaxTextes borne la case à ce nombre de hauteurs de ligne du
  // compte écrit, mesurée par la sonde ; null, sans borne : la case prend
  // alors toute la largeur que la carte donne à sa colonne.
  //
  // Désignations : data-graphique sur le <svg>, data-case sur chaque case,
  // par « ligne:colonne » à partir de 0, data-rang sur la désignation de la
  // case pointée, par son indice à partir de 1. Le niveau d'une case à
  // partir de 1 porte data-marque ; le niveau 0 est un fond, sans marque.
  // Les bordures de toutes les cases sont un seul <path>, après les cases,
  // qui porte data-marque : aucune case ne chevauche la bordure d'une autre,
  // et l'ordre de peinture ne change aucun pixel.
  import { getContext } from 'svelte';
  import Graphique from './Graphique.svelte';
  import { ESPACE_PX, cadreGrille, cibleCase, dispositionGrille } from './pointage.js';

  let {
    graphique,
    nom,
    synthese,
    lignes,
    colonnes,
    valeurs,
    diagonale = false,
    phrase = null,
    ecrire = null,
    coteMaxTextes = null,
    infobulle = null,
    dessinable = $bindable(true),
    pointe = $bindable(null),
  } = $props();

  const t = getContext('t');
  const format = getContext('format');

  let largeur = $state(0);
  let mesures = $state(null);
  let dessine = $state(false);

  const coteMax = $derived(
    coteMaxTextes === null || mesures === null ? Number.POSITIVE_INFINITY : coteMaxTextes * mesures.hauteurTexte,
  );

  // Le cadre, que les seuls intitulés décident (cadreGrille) : mesuré dès
  // la sonde rendue, dessin fait ou non, il donne la hauteur que le
  // graphique réserve — celle de son dessin — et dit si la grille cède la
  // place.
  const cadre = $derived(
    mesures === null || largeur === 0
      ? null
      : mesures.calculer((mesurer) =>
          cadreGrille({ largeur, lignes, colonnes, mesurer, hauteurTexte: mesures.hauteurTexte, coteMax }),
        ),
  );

  const disposition = $derived(
    !dessine || mesures === null || largeur === 0
      ? null
      : mesures.calculer((mesurer) =>
          dispositionGrille({
            largeur,
            lignes,
            colonnes,
            valeurs,
            diagonale,
            mesurer,
            hauteurTexte: mesures.hauteurTexte,
            ecrire: ecrire ?? ((v) => format.nombre(v)),
            coteMax,
          }),
        ),
  );

  $effect(() => {
    if (cadre !== null) dessinable = cadre.dessinable;
  });

  const zone = $derived(
    disposition === null
      ? null
      : { x: disposition.x0, y: disposition.y0, largeur: disposition.largeur - disposition.x0, hauteur: disposition.hauteur - disposition.y0 },
  );
  const cibler = (x, y) => cibleCase(x, y, disposition);
  const ancrer = (indice) => {
    const c = disposition.cases[indice];
    return { x: c.x + c.cote, y: c.y + c.cote };
  };
</script>

<!-- La largeur se mesure ici aussi : une grille qui a cédé la place se
     redessine quand la carte s'élargit. Elle se lit sur une règle de
     hauteur nulle, comme dans Graphique : la hauteur de la grille suit sa
     largeur, et le conteneur qui la porte ne se mesure pas. -->
<div>
<div class="mesure" bind:clientWidth={largeur}></div>
{#if cadre !== null && !cadre.dessinable}
  <p class="phrase">{#if typeof phrase === 'function'}{@render phrase()}{:else}{phrase}{/if}</p>
{:else}
  <Graphique
    {graphique}
    {nom}
    {synthese}
    {infobulle}
    hauteur={cadre?.hauteur ?? 0}
    {zone}
    {cibler}
    {ancrer}
    bind:largeur
    bind:mesures
    bind:dessine
    bind:pointe
  >
    {#if disposition !== null}
      {#each disposition.intitulesLignes as intitule, i (i)}
        <text class="intitule" x={intitule.x} y={intitule.y} text-anchor="end" dominant-baseline="central">{intitule.texte}</text>
      {/each}
      {#each disposition.intitulesColonnes as intitule, j (j)}
        <text
          class="intitule"
          x={intitule.x}
          y={intitule.y}
          text-anchor={intitule.tourne ? 'start' : 'middle'}
          dominant-baseline={intitule.tourne ? 'central' : 'auto'}
          transform={intitule.tourne ? `rotate(-90 ${intitule.x} ${intitule.y})` : undefined}>{intitule.texte}</text
        >
      {/each}
      {#each disposition.cases as c (c.index)}
        <g data-case="{c.ligne}:{c.colonne}">
          {#if c.jeton !== null}
            <rect
              data-marque={c.marque ?? undefined}
              x={c.fond.x}
              y={c.fond.y}
              width={c.fond.cote}
              height={c.fond.cote}
              style:fill={`var(${c.jeton})`}
            />
          {/if}
          {#if !c.diagonale}
            <text
              class="compte"
              x={c.x + c.cote / 2}
              y={c.y + c.cote / 2}
              text-anchor="middle"
              dominant-baseline="central"
              style:fill={c.encre === null ? null : `var(${c.encre})`}>{c.texte ?? t('format.vide')}</text
            >
          {/if}
        </g>
      {/each}
      <path class="bordure" data-marque="graphiqueBordureCase" d={disposition.bordures} />
      {#if pointe !== null && disposition.cases[pointe] !== undefined}
        {@const c = disposition.cases[pointe]}
        <rect class="designation" data-rang={pointe + 1} x={c.x - ESPACE_PX / 3} y={c.y - ESPACE_PX / 3} width={c.cote + (2 * ESPACE_PX) / 3} height={c.cote + (2 * ESPACE_PX) / 3} />
      {/if}
    {/if}
  </Graphique>
{/if}
</div>

<style>
  /* La règle de la largeur : la largeur du conteneur, aucune hauteur. */
  .mesure {
    height: 0;
  }

  .phrase {
    margin: 0;
  }

  .intitule {
    fill: var(--couleur-page-texte);
  }

  /* Les bordures, un seul chemin, sans lissage : un coin de sous-chemin
     lissé se peint plus clair que celui d'un <rect>, et un trait sans
     lissage peint son jeton entier, sur la même rangée de pixels qu'un
     <rect> posé à la demi-unité. */
  .bordure {
    fill: none;
    stroke: var(--couleur-graphique-bordure-case);
    stroke-width: 1;
    shape-rendering: crispEdges;
  }

  /* Un compte sans niveau — « — » — se lit de l'encre de la page. */
  .compte {
    fill: var(--couleur-page-texte);
    font-variant-numeric: tabular-nums;
  }

  .designation {
    fill: none;
    stroke: var(--couleur-graphique-axe);
    stroke-width: 2;
  }
</style>
