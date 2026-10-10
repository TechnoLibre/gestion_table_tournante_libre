<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

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
  // Rien ne se tronque : un nom long replie dans sa colonne (§ 7.4). Chaque
  // table commence une page ; une table plus longue qu'une page continue sur
  // la suivante, sous son en-tête répété. La pagination se fait sur les
  // hauteurs rendues, comme celle de la liste d'accueil : toutes les tables
  // se rendent d'abord, hors de la vue, dans une feuille de la bande reçue,
  // où se lisent la hauteur utile, et pour chaque table celle de son
  // en-tête et de chacune de ses lignes (mesurerListes) ; paginerFeuilles en
  // fait les pages. Une soirée sans table imprime une feuille qui le dit.
  //
  // La source est celle de l'aperçu, tour par tour (etatsDesTours).
  //
  // Sans bandeMm, la vue rend sa feuille gabarit, que l'aperçu mesure.
  import { getContext, tick } from 'svelte';
  import Feuille from './Feuille.svelte';
  import { etatsDesTours, feuilleDuTour, feuillesTables, largeursColonnes } from './listes.js';
  import { mesurerListes, paginerFeuilles } from './pagination.js';

  let { etat, options, feuille, bandeMm = null, orientation = $bindable(null) } = $props();

  const t = getContext('t');
  const seance = getContext('seance');

  const charge = $derived($seance.charge);
  const etats = $derived(etatsDesTours(charge, etat.proposition));
  const listes = $derived(feuillesTables(charge, etats, { parTour: options.parTour }));

  // Les mesures de la feuille de mesure, et ce qu'elles mesuraient ; les
  // pages, null tant qu'elles ne sont pas celles des listes courantes.
  const cle = $derived(JSON.stringify([options.papier, bandeMm, listes]));
  let mesures = $state(null);
  const pages = $derived(mesures !== null && mesures.cle === cle ? paginerFeuilles(mesures.feuilles, mesures.utile) : null);
  const feuilleMesure = $derived({ ...feuille, filigrane: false });

  // Mesure la feuille de mesure une fois le rendu à jour (tick) : la
  // clé lue alors est celle des valeurs que le DOM porte. La lecture de
  // cle relance la mesure quand elle change avant que les pages viennent.
  function mesurer(conteneur) {
    const voulue = cle;
    let active = true;
    tick().then(() => {
      if (active && voulue === cle) mesures = { cle, ...mesurerListes(conteneur.querySelector('[data-contenu]')) };
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

{#snippet blocTable(liste, rangListe, debut, fin)}
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
          <tr data-ligne-imprimee={debut + rang}>
            <th scope="row">{ligne.place}</th>
            {#each ligne.cellules as cellule (cellule.tour)}
              <td>
                {#if cellule.nom === null}
                  <span class="vide" data-place-vide>{t('feuilles.tables.vide')}</span>
                {:else}
                  <span class="nom" data-nom-imprime>{cellule.nom}</span>
                {/if}
                {#if cellule.titre !== null}
                  <span class="titre-place">
                    <span class="libelle-titre">{cellule.titre.libelle}</span>
                    {#if !cellule.titre.pourvu}
                      <span>{t('feuilles.tables.titreNonPourvu')}</span>
                    {/if}
                  </span>
                {/if}
              </td>
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
        {#each listes as liste, rangListe (rangListe)}
          {@render blocTable(liste, rangListe, 0, liste.lignes.length)}
        {/each}
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
    <Feuille rang={page.rang} papier={options.papier} orientation="portrait" feuille={feuilleDeListe(listes[page.feuille])} {bandeMm}>
      {#snippet contenu()}
        {@render blocTable(listes[page.feuille], page.feuille, page.debut, page.fin)}
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
