<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Les feuilles par table imprimées (§ 11.7, Q6 c) : par défaut une feuille
  // par table, les tours de la soirée en colonnes ; sous l'option « Une
  // feuille par tour » de l'aperçu (options.parTour), une feuille par table
  // et par tour. Chaque feuille liste chaque place de la table : l'occupant
  // de chaque tour, ou la place vide écrite comme telle, et le titre de la
  // place, « non pourvu » quand rien ne le pourvoit à ce tour
  // (feuillesTables). Les feuilles sont en portrait. En colonnes, elles
  // portent le pied de la soirée ; une feuille d'un seul tour porte celui de
  // son tour, et le filigrane de la règle du brouillon à ce tour
  // (feuilleDuTour).
  //
  // Rien ne se tronque : un nom long replie dans sa colonne (§ 7.4). Une
  // colonne de tour garde au moins la largeur du plus long mot de ses
  // cellules ; les tours d'une feuille qui n'y tiennent pas tous côte à
  // côte se scindent en groupes de tours consécutifs, chaque groupe sous ses
  // propres têtes de tour (toursParGroupe, grouperTours). Chaque groupe
  // commence une page ; un groupe plus long qu'une page continue sur la
  // suivante, sous son en-tête répété. Une soirée sans table imprime une
  // feuille qui le dit.
  //
  // Tout se décide sur le rendu, hors de la vue, dans une feuille de la
  // bande reçue, en passes successives. La première rend une sonde par
  // feuille : un tableau d'une colonne, à la largeur de son contenu sans
  // repli dans les mots, qui porte chaque cellule et chaque tête de tour de
  // la feuille ; sa part de la largeur (mesurerPlace) donne la taille de ses
  // groupes. Les suivantes rendent les groupes et lisent la hauteur utile,
  // et pour chaque groupe celle de son en-tête et de chacune de ses lignes
  // (mesurerListes). Une ligne encore plus haute qu'une page — un nom fait
  // de nombreux mots courts — resserre les groupes de sa feuille
  // (resserrerGroupes), et la passe se refait ; sinon paginerFeuilles en
  // fait les pages. Une ligne qui passe encore la page sous un seul tour
  // par groupe, sa colonne à toute la largeur que la place laisse — un nom
  // de milliers de caractères —, ne se coupe pas au bord de la page : la
  // même passe en essaie les morceaux sur la ligne rendue (couperLigne), et
  // la ligne se continue, un morceau par page, sous l'en-tête répété et le
  // numéro de sa place (morcelerPages, trancher).
  //
  // La source est celle de l'aperçu, tour par tour (etatsDesTours).
  //
  // Sans bandeMm, la vue rend sa feuille gabarit, que l'aperçu mesure.
  import { getContext, tick } from 'svelte';
  import Feuille from './Feuille.svelte';
  import {
    etatsDesTours,
    feuilleDuTour,
    feuillesTables,
    grouperTours,
    largeursColonnes,
    resserrerGroupes,
    textesCellule,
    toursParGroupe,
  } from './listes.js';
  import { couperLigne, mesurerListes, mesurerPlace, morcelerPages, paginerFeuilles, trancher } from './pagination.js';

  let { etat, options, feuille, bandeMm = null, orientation = $bindable(null) } = $props();

  const t = getContext('t');
  const seance = getContext('seance');

  const charge = $derived($seance.charge);
  const etats = $derived(etatsDesTours(charge, etat.proposition));
  const listes = $derived(feuillesTables(charge, etats, { parTour: options.parTour }));

  // La taille de groupe de chaque feuille et ce qu'elle mesurait, null
  // avant la passe des sondes ; les groupes qui en suivent ; les mesures des
  // groupes et ce qu'elles mesuraient ; les pages, null tant qu'elles ne
  // sont pas celles des groupes courants.
  const cle = $derived(JSON.stringify([options.papier, bandeMm, listes]));
  let tailles = $state(null);
  const parGroupe = $derived(tailles !== null && tailles.cle === cle ? tailles.valeurs : null);
  const groupes = $derived(parGroupe === null ? null : grouperTours(listes, parGroupe));
  const cleGroupes = $derived(JSON.stringify([cle, parGroupe]));
  let mesures = $state(null);
  const pages = $derived(
    mesures !== null && mesures.cle === cleGroupes ? morcelerPages(paginerFeuilles(mesures.feuilles, mesures.utile), mesures.coupures) : null,
  );
  const feuilleMesure = $derived({ ...feuille, filigrane: false });
  // Les sondes de la première passe, une par feuille.
  let sondes = $state([]);

  // Mesure la feuille de mesure une fois le rendu à jour (tick) : la clé
  // lue alors est celle des valeurs que le DOM porte. Sans tailles à jour,
  // lit les sondes ; avec elles, les hauteurs des groupes, qui donnent les
  // pages ou des tailles resserrées, et les morceaux de chaque ligne encore
  // seule. La lecture des clés relance la mesure quand l'une change avant
  // que les pages viennent.
  function mesurer(conteneur) {
    const voulue = cleGroupes;
    const valeurs = parGroupe;
    const feuillesLues = listes;
    const groupesLus = groupes;
    let active = true;
    tick().then(() => {
      if (!active || voulue !== cleGroupes) return;
      const contenu = conteneur.querySelector('[data-contenu]');
      if (valeurs === null) {
        tailles = { cle, valeurs: feuillesLues.map((liste, rang) => toursParGroupe(mesurerPlace(sondes[rang], contenu), liste.tours.length)) };
        return;
      }
      const lues = mesurerListes(contenu);
      const paginees = paginerFeuilles(lues.feuilles, lues.utile);
      const resserrees = resserrerGroupes(valeurs, groupesLus, paginees);
      if (resserrees !== null) {
        tailles = { cle, valeurs: resserrees };
        return;
      }
      const listesRendues = contenu.querySelectorAll('[data-liste-imprimee]');
      const coupures = [];
      for (const { feuille: rang, debut, seule } of paginees) {
        if (!seule) continue;
        const ligne = listesRendues[rang].querySelector('tbody').rows[debut];
        coupures.push({ feuille: rang, ligne: debut, bornes: couperLigne(ligne, lues.utile - lues.feuilles[rang].entete) });
      }
      mesures = { cle: voulue, ...lues, coupures };
    });
    return () => {
      active = false;
    };
  }

  // La feuille d'une page : celle de la soirée en colonnes, celle de son
  // tour pour une feuille d'un seul tour.
  function feuilleDeListe(liste) {
    return options.parTour ? feuilleDuTour(charge, feuille, etats[liste.tours[0] - 1]) : feuille;
  }

  $effect(() => {
    orientation = 'portrait';
  });
</script>

<!-- Une cellule de tour : ses textes entiers (textesCellule), ou les parts
     de ses textes qu'une page porte d'une ligne continuée. -->
{#snippet celluleTour(cellule, parts = null)}
  {@const [nom, titre, nonPourvu] = parts ?? textesCellule(cellule, t)}
  <td>
    {#if nom !== ''}
      {#if cellule.nom === null}
        <span class="vide" data-place-vide>{nom}</span>
      {:else}
        <span class="nom" data-nom-imprime>{nom}</span>
      {/if}
    {/if}
    {#if titre !== '' || nonPourvu !== ''}
      <span class="titre-place">
        {#if titre !== ''}
          <span class="libelle-titre">{titre}</span>
        {/if}
        {#if nonPourvu !== ''}
          <span>{nonPourvu}</span>
        {/if}
      </span>
    {/if}
  </td>
{/snippet}

<!-- La sonde d'une feuille : ses têtes de tour et chacune de ses cellules,
     une par rangée, dans une seule colonne. -->
{#snippet sonde(liste, rangListe)}
  <table class="sonde" bind:this={sondes[rangListe]}>
    <tbody>
      {#each liste.tours as tour (tour)}
        <tr><th>{t('feuilles.tour', { tour })}</th></tr>
      {/each}
      {#each liste.lignes as ligne (ligne.place)}
        {#each ligne.cellules as cellule (cellule.tour)}
          <tr>{@render celluleTour(cellule)}</tr>
        {/each}
      {/each}
    </tbody>
  </table>
{/snippet}

{#snippet blocTable(liste, rangListe, debut, fin, morceau = null)}
  <div class="liste" data-liste-imprimee={rangListe} data-table={liste.table}>
    <p class="titre">{t('feuilles.tables.titre', { table: liste.numero })}</p>
    <table>
      <colgroup>
        {#each largeursColonnes('tables', liste.tours.length) as largeur, rang (rang)}
          <col style:width="{largeur}%" />
        {/each}
      </colgroup>
      <thead data-entete-liste>
        <tr>
          <th scope="col">{t('feuilles.tables.place')}</th>
          {#each liste.tours as tour (tour)}
            <th scope="col">{t('feuilles.tour', { tour })}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each liste.lignes.slice(debut, fin) as ligne, rang (ligne.place)}
          <!-- Le morceau {debut, fin} d'une ligne continuée porte sur les
               textes de ses cellules mis bout à bout, dans l'ordre du
               document, comme couperLigne les lit : trois par cellule. -->
          {@const parts = morceau === null ? null : trancher(ligne.cellules.flatMap((cellule) => textesCellule(cellule, t)), morceau.debut, morceau.fin)}
          <tr data-ligne-imprimee={debut + rang}>
            <th scope="row">{ligne.place}</th>
            {#each ligne.cellules as cellule, rangCellule (cellule.tour)}
              {@render celluleTour(cellule, parts === null ? null : parts.slice(3 * rangCellule, 3 * rangCellule + 3))}
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/snippet}

{#if bandeMm === null}
  <Feuille papier={options.papier} orientation="portrait" {feuille} />
{:else if pages === null}
  <div class="mesure" aria-hidden="true" {@attach mesurer}>
    <Feuille papier={options.papier} orientation="portrait" feuille={feuilleMesure} {bandeMm}>
      {#snippet contenu()}
        {#if groupes === null}
          {#each listes as liste, rangListe (rangListe)}
            {@render sonde(liste, rangListe)}
          {/each}
        {:else}
          {#each groupes as groupe, rangGroupe (rangGroupe)}
            {@render blocTable(groupe, rangGroupe, 0, groupe.lignes.length)}
          {/each}
        {/if}
      {/snippet}
    </Feuille>
  </div>
{:else if pages.length === 0}
  <Feuille rang={0} papier={options.papier} orientation="portrait" {feuille} {bandeMm}>
    {#snippet contenu()}
      <p class="titre">{t('feuilles.tables.aucune')}</p>
    {/snippet}
  </Feuille>
{:else}
  {#each pages as page (page.rang)}
    <Feuille rang={page.rang} papier={options.papier} orientation="portrait" feuille={feuilleDeListe(groupes[page.feuille])} {bandeMm}>
      {#snippet contenu()}
        {@render blocTable(groupes[page.feuille], page.feuille, page.debut, page.fin, page.morceau)}
      {/snippet}
    </Feuille>
  {/each}
{/if}

<style>
  .titre {
    margin: 0;
    padding-bottom: var(--espace-2);
    font-size: var(--taille-titre);
    font-weight: bold;
  }

  /* Disposition fixe, sans espacement entre cellules : la hauteur d'une
     table est celle de son en-tête plus la somme de ses lignes. */
  table {
    width: 100%;
    table-layout: fixed;
    border-collapse: separate;
    border-spacing: 0;
    font-size: var(--taille-texte);
  }

  th,
  td {
    padding: var(--espace-1) var(--espace-2);
    border-bottom: 1px solid var(--couleur-page-filet);
    text-align: start;
    vertical-align: top;
    overflow-wrap: anywhere;
  }

  .nom,
  .vide,
  .titre-place {
    display: block;
  }

  .nom {
    font-weight: bold;
  }

  /* Une place vide se distingue par sa forme, en italique, sans couleur. */
  .vide {
    font-style: italic;
  }

  .libelle-titre {
    font-style: italic;
  }

  /* La sonde prend la largeur de son plus long mot : à la largeur de son
     contenu, sans repli dans un mot. */
  .sonde {
    width: min-content;
    table-layout: auto;
  }

  .sonde th,
  .sonde td {
    overflow-wrap: normal;
  }

  /* La feuille de mesure se rend hors de la vue : elle se mesure, elle ne
     se voit ni ne s'atteint. */
  .mesure {
    position: fixed;
    top: 0;
    left: 0;
    z-index: -1;
    visibility: hidden;
    pointer-events: none;
  }
</style>
