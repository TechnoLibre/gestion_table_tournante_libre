<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La liste d'accueil imprimée (§ 11.7) : une ligne par personne non
  // exclue, par ordre de nom, de prénom, d'appartenance, puis d'identifiant
  // (lignesAccueil), et pour chaque tour de la soirée, en colonnes, la table,
  // le siège sous sièges attribués, ou la réserve. Les feuilles sont en
  // portrait et portent le pied de la soirée (« Tous les tours »).
  //
  // Rien ne se tronque : un nom long replie dans sa colonne (§ 7.4). La
  // hauteur d'une ligne dépend donc de son texte, et la pagination se fait
  // sur les hauteurs rendues : la liste entière se rend d'abord, hors de la
  // vue, dans une feuille de la bande reçue, où se lisent la hauteur utile,
  // celle de l'en-tête — titre et têtes de colonnes — et celle de chaque
  // ligne (mesurerListes) ; paginerFeuilles en fait les pages, et chaque
  // page se rend dans sa feuille, sous l'en-tête répété. La feuille de
  // mesure disparaît une fois lue, et revient quand le papier, la bande ou
  // les lignes changent. Les colonnes ont des largeurs fixées
  // (largeursColonnes) : la mesure et les pages replient de même.
  //
  // Les colonnes de tour se règlent sur leur texte. La feuille de mesure
  // porte une sonde : un tableau d'une colonne, sans repli, qui réunit chaque
  // libellé de place et chaque tête de tour. Sa largeur, sur celle de la
  // liste, donne la part d'un tour (mesurerPlace), que largeursColonnes
  // borne par le plancher des noms. La mesure se fait donc en deux temps :
  // la part d'abord, puis, la liste rendue aux largeurs qui en suivent, les
  // hauteurs.
  //
  // La source est celle de l'aperçu, tour par tour : la proposition que
  // porte l'état reçu, sinon le retenu, sinon les réservations
  // (etatsDesTours).
  //
  // Sans bandeMm, la vue rend sa feuille gabarit, que l'aperçu mesure.
  import { getContext, tick } from 'svelte';
  import { cleNormalisee } from '../../application/csv.js';
  import Feuille from './Feuille.svelte';
  import { etatsDesTours, largeursColonnes, libellePlace, lignesAccueil } from './listes.js';
  import { mesurerListes, mesurerPlace, paginerFeuilles } from './pagination.js';

  let { etat, options, feuille, bandeMm = null, orientation = $bindable(null) } = $props();

  const t = getContext('t');
  const seance = getContext('seance');

  const charge = $derived($seance.charge);
  const etats = $derived(etatsDesTours(charge, etat.proposition));
  const lignes = $derived(lignesAccueil(charge, etats, cleNormalisee));
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
  // part d'un tour, puis les hauteurs ; les pages, null tant qu'elles ne
  // sont pas celles des lignes courantes.
  const cle = $derived(JSON.stringify([options.papier, bandeMm, lignes]));
  let part = $state(null);
  let mesures = $state(null);
  const largeurs = $derived(largeursColonnes('accueil', tours.length, part !== null && part.cle === cle ? part.valeur : null));
  let sonde = $state(null);
  const pages = $derived(mesures !== null && mesures.cle === cle ? paginerFeuilles(mesures.feuilles, mesures.utile) : null);
  const feuilleMesure = $derived({ ...feuille, filigrane: false });

  // Mesure la feuille de mesure une fois le rendu à jour (tick) : la
  // clé lue alors est celle des valeurs que le DOM porte. Sans part à jour,
  // lit la part d'un tour ; avec elle, les hauteurs de la liste rendue à ses
  // largeurs. La lecture de cle et de part relance la mesure quand l'une
  // change avant que les pages viennent.
  function mesurer(conteneur) {
    const voulue = cle;
    const partLue = part;
    let active = true;
    tick().then(() => {
      if (!active || voulue !== cle) return;
      const contenu = conteneur.querySelector('[data-contenu]');
      if (partLue === null || partLue.cle !== cle) {
        part = { cle, valeur: mesurerPlace(sonde, contenu.querySelector('[data-liste-imprimee] table')) };
      } else {
        mesures = { cle, ...mesurerListes(contenu) };
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

{#snippet liste(debut, fin)}
  <div class="liste" data-liste-imprimee={0}>
    <p class="titre">{t('feuilles.accueil.titre')}</p>
    <table>
      <colgroup>
        {#each largeurs as largeur, rang (rang)}
          <col style:width="{largeur}%" />
        {/each}
      </colgroup>
      <thead data-entete-liste>
        <tr>
          <th scope="col">{t('feuilles.accueil.nom')}</th>
          <th scope="col">{t('feuilles.accueil.prenom')}</th>
          <th scope="col">{t('feuilles.accueil.appartenance')}</th>
          {#each tours as tour (tour)}
            <th scope="col">{t('feuilles.tour', { tour })}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each lignes.slice(debut, fin) as ligne, rang (ligne.participant)}
          <tr data-ligne-imprimee={debut + rang} data-participant={ligne.participant}>
            <td><span class="nom" data-nom-imprime>{ligne.nom}</span></td>
            <td>
              {#if ligne.prenom !== null}{ligne.prenom}{/if}
            </td>
            <td>
              {#if ligne.appartenance !== null}{ligne.appartenance}{/if}
            </td>
            {#each ligne.places as place (place.tour)}
              {@const libelle = libellePlace(place)}
              <td>{t(libelle.cle, libelle.details)}</td>
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
        {@render liste(0, lignes.length)}
        <table class="sonde" bind:this={sonde}>
          <tbody>
            {#each tours as tour (tour)}
              <tr><th scope="row">{t('feuilles.tour', { tour })}</th></tr>
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
        {@render liste(page.debut, page.fin)}
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
