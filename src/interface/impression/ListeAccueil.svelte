<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // La liste d'accueil imprimée (§ 11.7) : une ligne par personne non
  // exclue, dans l'ordre du tri que l'aperçu règle — par organisation, par
  // nom ou par prénom (lignesAccueil) —, et pour chaque tour de la soirée, en
  // colonnes, la table, le siège sous sièges attribués, ou la réserve. Les
  // feuilles sont en portrait et portent le pied de la soirée (« Tous les
  // tours »). Triée par organisation, la dernière ligne de chaque
  // organisation porte un filet plus marqué (finsOrganisation), de la même
  // épaisseur que les autres : la hauteur des lignes, donc la pagination,
  // n'en dépend pas. Une ligne continuée sur plusieurs pages ne le porte
  // qu'à son dernier morceau.
  //
  // Rien ne se tronque : un nom long replie dans sa colonne (§ 7.4). La
  // hauteur d'une ligne dépend donc de son texte, et la pagination se fait
  // sur les hauteurs rendues : la liste entière se rend d'abord, hors de la
  // vue, dans une feuille de la bande reçue, où se lisent la hauteur utile,
  // et pour chaque bloc de tours celle de son en-tête — titre, tours du
  // bloc et têtes de colonnes — et celle de chaque ligne (mesurerListes) ;
  // paginerFeuilles en fait les pages, et chaque page se rend dans sa
  // feuille, sous l'en-tête répété de son bloc. La feuille de mesure
  // disparaît une fois lue, et revient quand le papier, la bande ou les
  // lignes changent. Les colonnes ont des largeurs fixées
  // (largeursColonnes) : la mesure et les pages replient de même.
  //
  // Une ligne plus haute qu'une page — un nom de milliers de caractères —
  // ne se coupe pas au bord de la page : la même passe en essaie les
  // morceaux sur la ligne rendue (couperLigne), et la ligne se continue, un
  // morceau par page, sous l'en-tête répété. Ses textes se suivent dans
  // l'ordre de ses cellules — nom, prénom, organisation, places
  // (textesLigneAccueil) — et chaque page pose de chaque cellule la part qui
  // tombe dans son morceau (morcelerPages, trancher).
  //
  // Les colonnes de tour se règlent sur leur texte. La feuille de mesure
  // porte une sonde : un tableau d'une colonne, sans repli, qui réunit chaque
  // libellé de place et chaque tête de tour. Sa largeur, sur celle de la
  // liste, donne la part d'un tour (mesurerPlace) : chaque colonne de tour
  // la reçoit. Des tours qui ne tiennent pas tous côte à côte en laissant
  // aux noms leur plancher se répartissent en blocs de tours consécutifs
  // (toursParBloc, blocsAccueil) : chaque bloc reprend chaque ligne, nom,
  // prénom et organisation répétés, sous un en-tête qui nomme ses tours
  // (« Tours 1 à 34 »), et commence une page ; un bloc plus long qu'une page
  // continue sur la suivante, sous son en-tête répété. Une soirée dont les
  // tours tiennent garde un seul bloc, sans en-tête de bloc. La mesure se
  // fait donc en deux temps : la part d'abord, la liste rendue en un seul
  // bloc, puis, les blocs rendus aux largeurs qui en suivent, les hauteurs
  // de chacun.
  //
  // La source est celle de l'aperçu, tour par tour : la proposition que
  // porte l'état reçu, sinon le retenu, sinon les réservations
  // (etatsDesTours).
  //
  // Sans bandeMm, la vue rend sa feuille gabarit, que l'aperçu mesure.
  import { getContext, tick } from 'svelte';
  import { cleNormalisee } from '../../application/csv.js';
  import { nomsDesTours } from '../../application/tours.js';
  import Feuille from './Feuille.svelte';
  import {
    blocsAccueil,
    etatsDesTours,
    finsOrganisation,
    largeursColonnes,
    libellePlace,
    lignesAccueil,
    textesLigneAccueil,
    toursParBloc,
  } from './listes.js';
  import { couperLigne, mesurerListes, mesurerPlace, morcelerPages, paginerFeuilles, trancher } from './pagination.js';

  let { etat, options, feuille, bandeMm = null, orientation = $bindable(null) } = $props();

  const t = getContext('t');
  const seance = getContext('seance');

  const charge = $derived($seance.charge);
  // La tête d'un tour : son nom, une donnée posée telle quelle, ou son
  // libellé, « Tour 3 », pour un tour sans nom.
  const nomsTours = $derived(nomsDesTours(charge));
  const teteDuTour = (tour) => nomsTours[tour - 1] ?? t('feuilles.tour', { tour });
  const etats = $derived(etatsDesTours(charge, etat.proposition));
  const lignes = $derived(lignesAccueil(charge, etats, cleNormalisee, options.tri));
  // Les lignes qui ferment une organisation, aucune hors du tri par
  // organisation.
  const fins = $derived(options.tri === 'organisation' ? finsOrganisation(lignes, cleNormalisee) : new Set());
  const tours = $derived(etats.map(({ tour }) => tour));
  // Chaque libellé de place que la liste écrit, une fois : ce que la sonde
  // porte.
  const libelles = $derived([
    ...new Set(
      lignes.flatMap(({ places }) =>
        places.map((place) => {
          const { cle: cleLibelle, details } = libellePlace(place);
          return t(cleLibelle, details);
        }),
      ),
    ),
  ]);

  // Les mesures de la feuille de mesure, et ce qu'elles mesuraient : la
  // part d'un tour, null tant qu'elle n'est pas celle des lignes courantes ;
  // les blocs qui en suivent, un seul sans elle ; puis les hauteurs ; les
  // pages, null tant qu'elles ne sont pas celles des blocs courants.
  const cle = $derived(JSON.stringify([options.papier, bandeMm, lignes]));
  let part = $state(null);
  const partTour = $derived(part !== null && part.cle === cle ? part.valeur : null);
  const blocs = $derived(blocsAccueil(lignes, tours, partTour === null ? tours.length : toursParBloc(partTour, tours.length)));
  const cleBlocs = $derived(JSON.stringify([cle, partTour]));
  let mesures = $state(null);
  let sonde = $state(null);
  const pages = $derived(
    mesures !== null && mesures.cle === cleBlocs ? morcelerPages(paginerFeuilles(mesures.feuilles, mesures.utile), mesures.coupures) : null,
  );
  const feuilleMesure = $derived({ ...feuille, filigrane: false });

  // Mesure la feuille de mesure une fois le rendu à jour (tick) : la
  // clé lue alors est celle des valeurs que le DOM porte. Sans part à jour,
  // lit la part d'un tour ; avec elle, les hauteurs de chaque bloc rendu à
  // ses largeurs, et les morceaux de chaque ligne seule sur sa page, dans
  // son bloc. La lecture de cleBlocs, qui porte la clé et la part, relance
  // la mesure quand l'une change avant que les pages viennent.
  function mesurer(conteneur) {
    const voulue = cleBlocs;
    const partLue = partTour;
    let active = true;
    tick().then(() => {
      if (!active || voulue !== cleBlocs) return;
      const contenu = conteneur.querySelector('[data-contenu]');
      if (partLue === null) {
        part = { cle, valeur: mesurerPlace(sonde, contenu.querySelector('[data-liste-imprimee] table')) };
      } else {
        const lues = mesurerListes(contenu);
        const listesRendues = contenu.querySelectorAll('[data-liste-imprimee]');
        const coupures = paginerFeuilles(lues.feuilles, lues.utile)
          .filter(({ seule }) => seule)
          .map(({ feuille, debut }) => ({
            feuille,
            ligne: debut,
            bornes: couperLigne(listesRendues[feuille].querySelector('tbody').rows[debut], lues.utile - lues.feuilles[feuille].entete),
          }));
        mesures = { cle: voulue, ...lues, coupures };
      }
    });
    return () => {
      active = false;
    };
  }

  $effect(() => {
    orientation = 'portrait';
  });
</script>

<!-- Le bloc de rang rangBloc, de la ligne debut (comprise) à fin (exclue),
     sous l'en-tête qui nomme ses tours quand la liste a plusieurs blocs ;
     sous un morceau {debut, fin}, chaque cellule de la ligne continuée ne
     pose que la part de ses textes (textesLigneAccueil) qui tombe dans ce
     morceau, et le filet de fin d'organisation ne vient qu'avec le morceau
     qui finit ces textes. -->
{#snippet liste(bloc, rangBloc, debut, fin, morceau = null)}
  <div class="liste" data-liste-imprimee={rangBloc}>
    <p class="titre">{t('feuilles.accueil.titre')}</p>
    {#if blocs.length > 1}
      <p class="tours" data-tours-bloc>{t('feuilles.accueil.tours', { premier: bloc.tours[0], dernier: bloc.tours.at(-1) })}</p>
    {/if}
    <table>
      <colgroup>
        {#each largeursColonnes('accueil', bloc.tours.length, partTour) as largeur, rang (rang)}
          <col style:width="{largeur}%" />
        {/each}
      </colgroup>
      <thead data-entete-liste>
        <tr>
          <th scope="col">{t('feuilles.accueil.nom')}</th>
          <th scope="col">{t('feuilles.accueil.prenom')}</th>
          <th scope="col">{t('feuilles.accueil.organisation')}</th>
          {#each bloc.tours as tour (tour)}
            <th scope="col">{teteDuTour(tour)}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each bloc.lignes.slice(debut, fin) as ligne, rang (ligne.participant)}
          {@const textes = textesLigneAccueil(ligne, t)}
          {@const [nom, prenom, organisation, ...places] = morceau === null ? textes : trancher(textes, morceau.debut, morceau.fin)}
          {@const fermeOrganisation = fins.has(ligne.participant) && (morceau === null || morceau.fin >= textes.join('').length)}
          <tr data-ligne-imprimee={debut + rang} data-participant={ligne.participant} data-fin-organisation={fermeOrganisation ? '' : undefined}>
            <td>
              {#if nom !== ''}<span class="nom" data-nom-imprime>{nom}</span>{/if}
            </td>
            <td>{prenom}</td>
            <td>{organisation}</td>
            {#each places as place, rangPlace (rangPlace)}
              <td>{place}</td>
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
        {#each blocs as bloc, rangBloc (rangBloc)}
          {@render liste(bloc, rangBloc, 0, bloc.lignes.length)}
        {/each}
        <table class="sonde" bind:this={sonde}>
          <tbody>
            {#each tours as tour (tour)}
              <tr><th scope="row">{teteDuTour(tour)}</th></tr>
            {/each}
            {#each libelles as libelle (libelle)}
              <tr><td>{libelle}</td></tr>
            {/each}
          </tbody>
        </table>
      {/snippet}
    </Feuille>
  </div>
{:else}
  {#each pages as page (page.rang)}
    <Feuille rang={page.rang} papier={options.papier} orientation="portrait" {feuille} {bandeMm}>
      {#snippet contenu()}
        {@render liste(blocs[page.feuille], page.feuille, page.debut, page.fin, page.morceau)}
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

  .tours {
    margin: 0;
    padding-bottom: var(--espace-2);
    font-size: var(--taille-texte);
    font-weight: bold;
  }

  /* Disposition fixe, sans espacement entre cellules : la hauteur de la
     liste est celle de son en-tête plus la somme de ses lignes. */
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

  /* La fin d'une organisation : le filet garde son épaisseur, il prend
     l'encre du texte. */
  tr[data-fin-organisation] > td {
    border-bottom-color: var(--couleur-page-texte);
  }

  .nom {
    font-weight: bold;
  }

  /* La sonde : à la largeur de son plus large libellé — max-content, que
     le repli n'atteint pas —, hors du cours de la feuille de mesure. */
  .sonde {
    position: absolute;
    top: 0;
    left: 0;
    width: max-content;
    table-layout: auto;
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
