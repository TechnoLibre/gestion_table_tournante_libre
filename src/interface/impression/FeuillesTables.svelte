<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Les feuilles par table imprimées (§ 11.7, Q6 c) : par défaut une feuille
  // par table, les tours de la soirée en colonnes ; sous l'option « Une feuille
  // par tour » de l'aperçu (options.parTour), une feuille par table et par
  // tour. Une table où personne n'est assis aux tours d'une feuille n'a pas
  // cette feuille. Le titre d'une feuille nomme sa table par son numéro et,
  // quand elle en porte un, par son libellé, dans son propre nœud ; sous
  // l'option « Dessiner la table » (options.dessinTable), le dessin de la table
  // tient lieu de titre : sa forme, ses chaises, son numéro et son libellé,
  // tels que le plan imprimé les dessine au premier tour de la feuille, réduits
  // à HAUTEUR_DESSIN_MM. Chaque feuille liste chaque place de la table :
  // l'occupant de chaque tour et, à l'encre secondaire, son organisation, ou la
  // place vide écrite comme telle, et le titre de la place, « non pourvu »
  // quand rien ne le pourvoit à ce tour (feuillesTables). Les feuilles sont en
  // portrait. En colonnes, elles portent le pied de la soirée ; une feuille
  // d'un seul tour porte celui de son tour, et le filigrane de la règle du
  // brouillon à ce tour (feuilleDuTour).
  //
  // Rien ne se tronque : un nom long replie dans sa colonne (§ 7.4). Une
  // colonne de tour garde au moins la largeur du plus long mot de ses
  // cellules ; les tours d'une feuille qui n'y tiennent pas tous côte à côte se
  // scindent en groupes de tours consécutifs, chaque groupe sous ses propres
  // têtes de tour (toursParGroupe, grouperTours). Chaque groupe commence une
  // page ; un groupe plus long qu'une page continue sur la suivante, sous son
  // en-tête répété. Une soirée sans table occupée imprime une feuille qui le
  // dit.
  //
  // Le texte d'un groupe qui tient sur une page grandit pour la remplir, sans
  // exagérer : une échelle du corps de sa liste et de son titre, les retraits
  // des cellules dans la même proportion (taillesEchelle), de 1 à
  // ECHELLE_TEXTE_MAX, assez petite pour que chaque mot tienne encore dans sa
  // colonne (plafondEchelle) et que le groupe tienne sur sa page
  // (echelleAjustee, essayée sur une copie de la liste rendue, tientEnCopie).
  // Chaque table reçoit la plus petite des échelles de ses groupes
  // (echellesParTable) ; une table dont un groupe passe une page garde
  // l'échelle 1.
  //
  // Tout se décide sur le rendu, hors de la vue, dans une feuille de la bande
  // reçue, en passes successives. La première rend une sonde par feuille : un
  // tableau d'une colonne, à la largeur de son contenu sans repli dans les
  // mots, qui porte chaque cellule et chaque tête de tour de la feuille, et une
  // seconde sonde, la tête et le plus grand numéro de la colonne de la place ;
  // leurs parts de la largeur (mesurerPlace) donnent la taille de ses groupes
  // et le plafond de son échelle. Les suivantes rendent les groupes et lisent
  // la hauteur utile, et pour chaque groupe celle de son en-tête et de chacune
  // de ses lignes (mesurerListes). Une ligne encore plus haute qu'une page — un
  // nom fait de nombreux mots courts — resserre les groupes de sa feuille
  // (resserrerGroupes), et la passe se refait ; sinon paginerFeuilles en fait
  // les pages. Une ligne qui passe encore la page sous un seul tour par groupe,
  // sa colonne à toute la largeur que la place laisse — un nom de milliers de
  // caractères —, ne se coupe pas au bord de la page : la même passe en essaie
  // les morceaux sur la ligne rendue (couperLigne), et la ligne se continue, un
  // morceau par page, sous l'en-tête répété et le numéro de sa place
  // (morcelerPages, partsDesCellules). La même passe, enfin, règle l'échelle de
  // chaque groupe.
  //
  // La source est celle de l'aperçu, tour par tour (etatsDesTours).
  //
  // Sans bandeMm, la vue rend sa feuille gabarit, que l'aperçu mesure.
  import { getContext, tick } from 'svelte';
  import { nomsDesTours } from '../../application/tours.js';
  import { englobant } from '../../geometrie/tables.js';
  import { modeleDessin } from '../plan/modele.js';
  import PlanDessin from '../plan/PlanDessin.svelte';
  import { nomDeCharge } from '../plan/vue_plan.js';
  import Feuille from './Feuille.svelte';
  import {
    echelleAjustee,
    echellesParTable,
    etatsDesTours,
    feuilleDuTour,
    feuillesTables,
    grouperTours,
    largeursColonnes,
    partsDesCellules,
    plafondEchelle,
    resserrerGroupes,
    textesCellule,
    toursParGroupe,
  } from './listes.js';
  import { couperLigne, mesurerListes, mesurerPlace, morcelerPages, paginerFeuilles, tientEnCopie } from './pagination.js';
  import { modeleDeLaPage } from './plan.js';

  let { etat, options, feuille, bandeMm = null, orientation = $bindable(null) } = $props();

  const t = getContext('t');
  const seance = getContext('seance');

  // La hauteur du dessin d'une table en tête de sa feuille, en mm : assez
  // pour lire ses chaises, sans prendre aux noms plus du sixième d'une page.
  const HAUTEUR_DESSIN_MM = 40;

  const charge = $derived($seance.charge);
  // La tête d'un tour : son nom, une donnée posée telle quelle, ou son
  // libellé, « Tour 3 », pour un tour sans nom.
  const nomsTours = $derived(nomsDesTours(charge));
  const teteDuTour = (tour) => nomsTours[tour - 1] ?? t('feuilles.tour', { tour });
  const etats = $derived(etatsDesTours(charge, etat.proposition));
  const listes = $derived(feuillesTables(charge, etats, { parTour: options.parTour }));
  // Le modèle du plan imprimé de chaque tour, sans listes, quand la feuille
  // dessine sa table ; null sinon.
  const dessins = $derived(
    options.dessinTable ? etats.map((etatTour) => modeleDessin(etatTour, { listes: false, nomDe: nomDeCharge(charge), impression: true })) : null,
  );

  // La taille de groupe de chaque feuille, les parts que ses sondes
  // mesuraient et ce qu'elles mesuraient, null avant la passe des sondes ;
  // les groupes qui en suivent ; les mesures des groupes, l'échelle de
  // chacun et ce qu'elles mesuraient ; les pages, null tant qu'elles ne
  // sont pas celles des groupes courants.
  const cle = $derived(JSON.stringify([options.papier, bandeMm, listes, options.dessinTable]));
  let tailles = $state(null);
  const parGroupe = $derived(tailles !== null && tailles.cle === cle ? tailles.valeurs : null);
  const groupes = $derived(parGroupe === null ? null : grouperTours(listes, parGroupe));
  const cleGroupes = $derived(JSON.stringify([cle, parGroupe]));
  let mesures = $state(null);
  const pages = $derived(
    mesures !== null && mesures.cle === cleGroupes ? morcelerPages(paginerFeuilles(mesures.feuilles, mesures.utile), mesures.coupures) : null,
  );
  const echelles = $derived(pages === null ? null : mesures.echelles);
  const feuilleMesure = $derived({ ...feuille, filigrane: false });
  // Les sondes de la première passe, deux par feuille : ses tours, sa place.
  let sondes = $state([]);
  let sondesPlace = $state([]);

  // Mesure la feuille de mesure une fois le rendu à jour (tick) : la clé
  // lue alors est celle des valeurs que le DOM porte. Sans tailles à jour,
  // lit les sondes ; avec elles, les hauteurs des groupes, qui donnent les
  // pages ou des tailles resserrées, les morceaux de chaque ligne encore
  // seule, et l'échelle de chaque groupe. La lecture des clés relance la
  // mesure quand l'une change avant que les pages viennent.
  function mesurer(conteneur) {
    const voulue = cleGroupes;
    const valeurs = parGroupe;
    const partsLues = tailles?.parts ?? null;
    const feuillesLues = listes;
    const groupesLus = groupes;
    let active = true;
    tick().then(() => {
      if (!active || voulue !== cleGroupes) return;
      const contenu = conteneur.querySelector('[data-contenu]');
      if (valeurs === null) {
        const parts = feuillesLues.map((_, rang) => ({ tour: mesurerPlace(sondes[rang], contenu), place: mesurerPlace(sondesPlace[rang], contenu) }));
        tailles = { cle, parts, valeurs: feuillesLues.map((liste, rang) => toursParGroupe(parts[rang].tour, liste.tours.length)) };
        return;
      }
      const lues = mesurerListes(contenu);
      const paginees = paginerFeuilles(lues.feuilles, lues.utile);
      const resserrees = resserrerGroupes(valeurs, groupesLus, paginees);
      if (resserrees !== null) {
        tailles = { cle, parts: partsLues, valeurs: resserrees };
        return;
      }
      const listesRendues = contenu.querySelectorAll('[data-liste-imprimee]');
      const coupures = [];
      for (const { feuille: rang, debut, seule } of paginees) {
        if (!seule) continue;
        const ligne = listesRendues[rang].querySelector('tbody').rows[debut];
        coupures.push({ feuille: rang, ligne: debut, bornes: couperLigne(ligne, lues.utile - lues.feuilles[rang].entete) });
      }
      const parGroupeLues = groupesLus.map((groupe, rang) => {
        const siennes = paginees.filter(({ feuille: page }) => page === rang);
        if (siennes.length !== 1 || siennes[0].seule) return 1;
        const { tour, place } = partsLues[groupe.source];
        return echelleAjustee(plafondEchelle(groupe.tours.length, tour, place), (essai) =>
          tientEnCopie(listesRendues[rang], lues.utile, (copie) => {
            const tailles = taillesEchelle(essai);
            copie.style.fontSize = tailles.liste;
            copie.querySelector('.titre')?.style.setProperty('font-size', tailles.titre);
          }),
        );
      });
      mesures = { cle: voulue, ...lues, coupures, echelles: echellesParTable(groupesLus, parGroupeLues) };
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

  // Les corps d'une liste et de son titre à l'échelle echelle : ceux des
  // jetons, multipliés ; null à l'échelle 1, que la feuille de style donne.
  function taillesEchelle(echelle) {
    if (echelle === null || echelle === 1) return { liste: null, titre: null };
    return { liste: `calc(var(--taille-texte) * ${echelle})`, titre: `calc(var(--taille-titre) * ${echelle})` };
  }

  // Le dessin d'une table au premier tour d'une feuille : le modèle de la
  // page réduit à la table, et le cadre de son dessin, en cm.
  function dessinDe(liste) {
    const modele = modeleDeLaPage(dessins[liste.tours[0] - 1], { tables: [liste.table] });
    const { minX, minY, maxX, maxY } = englobant(modele.tables.map(({ geometrie }) => geometrie));
    return { modele, viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}` };
  }

  $effect(() => {
    orientation = 'portrait';
  });
</script>

<!-- Une cellule de tour : ses textes entiers (textesCellule), ou les parts
     de ses textes qu'une page porte d'une ligne continuée
     (partsDesCellules). Le nom et l'organisation se suivent sur une ligne,
     sans blanc entre leurs nœuds : le séparateur porte les siens. -->
{#snippet celluleTour(cellule, parts)}
  {@const [nom, avantOrganisation, organisation, titre, nonPourvu] = parts}
  <td>
    {#if nom !== '' || avantOrganisation !== '' || organisation !== ''}
      <span class="occupant"
        >{#if nom !== ''}{#if cellule.nom === null}<span class="vide" data-place-vide>{nom}</span>{:else}<span class="nom" data-nom-imprime
              >{nom}</span
            >{/if}{/if}{#if avantOrganisation !== '' || organisation !== ''}<span class="organisation" data-organisation-imprimee
            >{avantOrganisation}{organisation}</span
          >{/if}</span
      >
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

<!-- Les sondes d'une feuille : ses têtes de tour et chacune de ses
     cellules, une par rangée, dans une seule colonne ; la tête de la
     colonne de la place et son plus grand numéro. -->
{#snippet sonde(liste, rangListe)}
  <table class="sonde" bind:this={sondes[rangListe]}>
    <tbody>
      {#each liste.tours as tour (tour)}
        <tr><th>{teteDuTour(tour)}</th></tr>
      {/each}
      {#each liste.lignes as ligne (ligne.place)}
        {#each ligne.cellules as cellule (cellule.tour)}
          <tr>{@render celluleTour(cellule, textesCellule(cellule, t))}</tr>
        {/each}
      {/each}
    </tbody>
  </table>
  <table class="sonde" bind:this={sondesPlace[rangListe]}>
    <tbody>
      <tr><th>{t('feuilles.tables.place')}</th></tr>
      <tr><th>{liste.lignes.length}</th></tr>
    </tbody>
  </table>
{/snippet}

<!-- Le titre d'une feuille : son numéro et son libellé, ou le dessin de sa
     table, une image nommée de même. -->
{#snippet titreTable(liste, echelle)}
  {#if dessins === null}
    <p class="titre" style:font-size={taillesEchelle(echelle).titre}>
      {t('feuilles.tables.titre', { table: liste.numero })}{#if liste.libelle !== null}<span>{t('feuilles.tables.avantLibelle')}</span><span
          >{liste.libelle}</span
        >{/if}
    </p>
  {:else}
    {@const { modele, viewBox } = dessinDe(liste)}
    <svg
      class="dessin"
      data-dessin-table
      {viewBox}
      preserveAspectRatio="xMinYMid meet"
      style:height="{HAUTEUR_DESSIN_MM}mm"
      role="img"
      aria-label={liste.libelle === null
        ? t('feuilles.tables.titre', { table: liste.numero })
        : `${t('feuilles.tables.titre', { table: liste.numero })}${t('feuilles.tables.avantLibelle')}${liste.libelle}`}
    >
      <g aria-hidden="true">
        <PlanDessin {modele} />
      </g>
    </svg>
  {/if}
{/snippet}

{#snippet blocTable(liste, rangListe, debut, fin, morceau = null, echelle = null)}
  <div class="liste" data-liste-imprimee={rangListe} data-table={liste.table} data-echelle={echelle ?? undefined} style:font-size={taillesEchelle(echelle).liste}>
    {@render titreTable(liste, echelle)}
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
            <th scope="col">{teteDuTour(tour)}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each liste.lignes.slice(debut, fin) as ligne, rang (ligne.place)}
          {@const parts = partsDesCellules(ligne.cellules, t, morceau)}
          <tr data-ligne-imprimee={debut + rang}>
            <th scope="row">{ligne.place}</th>
            {#each ligne.cellules as cellule, rangCellule (cellule.tour)}
              {@render celluleTour(cellule, parts[rangCellule])}
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
        {@render blocTable(groupes[page.feuille], page.feuille, page.debut, page.fin, page.morceau, echelles[page.feuille])}
      {/snippet}
    </Feuille>
  {/each}
{/if}

<style>
  /* Le corps d'une liste, que son tableau reprend ; une page imprimée le
     porte à son échelle (taillesEchelle), en ligne. */
  .liste {
    font-size: var(--taille-texte);
  }

  /* Le titre d'une feuille replie, entre deux caractères au besoin : un
     libellé de table sans espace ne déborde pas de la page. */
  .titre {
    margin: 0;
    padding-bottom: var(--espace-2);
    font-size: var(--taille-titre);
    font-weight: bold;
    overflow-wrap: anywhere;
  }

  /* Le dessin de la table, à la hauteur fixée, calé à gauche comme le
     titre qu'il remplace. */
  .dessin {
    display: block;
    width: 100%;
    padding-bottom: var(--espace-2);
  }

  /* Disposition fixe, sans espacement entre cellules : la hauteur d'une
     table est celle de son en-tête plus la somme de ses lignes. */
  table {
    width: 100%;
    table-layout: fixed;
    border-collapse: separate;
    border-spacing: 0;
    font-size: inherit;
  }

  /* Les retraits d'une cellule, le quart et la moitié du corps : --espace-1
     et --espace-2 au corps de 16 px, qui suivent l'échelle de la liste. */
  th,
  td {
    padding: 0.25em 0.5em;
    border-bottom: 1px solid var(--couleur-page-filet);
    text-align: start;
    vertical-align: top;
    overflow-wrap: anywhere;
  }

  .occupant,
  .titre-place {
    display: block;
  }

  .nom {
    font-weight: bold;
  }

  /* L'organisation suit le nom sur sa ligne, à l'encre secondaire. */
  .organisation {
    color: var(--couleur-page-texte-secondaire);
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
    font-size: var(--taille-texte);
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
