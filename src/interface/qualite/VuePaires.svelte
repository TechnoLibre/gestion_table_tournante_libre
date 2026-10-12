<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La vue « Paires répétées » (§ 12.5, B14, D32, D33, D50) de la page de
  // qualité. Elle reçoit le contrat de propriétés des vues — detail, le
  // détail du placement mesuré, null tant qu'il n'est pas calculé ; ligne et
  // table, qu'elle ne lit pas — et met en forme ce que le détail porte, par
  // paires.js : elle ne trie, ne compte ni ne mesure rien. Son <div> porte
  // data-vue-qualite, que la carte ne transmet pas : il enveloppe la carte.
  //
  // Le tableau des paires : les paires choisies, puis, sous leur intitulé,
  // les paires que les réservations imposent, chacune dans l'ordre du
  // détail — chaque groupe est un tableau titré de sa légende. Une ligne
  // (data-paire, « a:b ») nomme les deux personnes, leur appartenance et,
  // pour un homonyme, son identifiant ; puis le nombre de fois ; puis ses
  // commandes. Une ligne n'est pas une cible : seule sa première commande
  // mène au plan au premier tour où la paire se revoit, la première
  // personne mise en évidence, et chaque tour de la paire, avec sa table,
  // est une commande sœur vers le plan à ce tour, la même personne mise en
  // évidence. Chaque commande se nomme par son libellé suivi de la paire,
  // l'identifiant d'un homonyme compris.
  // Les commandes de ligne sont des boutons simples, sans refus possible :
  // une ligne coûte une quinzaine de nœuds, cent lignes par page.
  // Le tableau se pagine comme celui des propositions, par pages de cent,
  // l'étendue et le total écrits ; changer de page porte le focus sur
  // l'étendue. Une seule table, un seul tour, aucune paire revue : la
  // phrase du cas (data-phrase-qualite) remplace le tableau.
  //
  // La matrice « qui a rencontré qui », sauf sur une seule table : quand le
  // détail la porte — sous SEUIL_MATRICE_PARTICIPANTS —, la grille n × n
  // dans l'ordre du profil, et son jumeau ; quand ses cases ne tiennent pas
  // dans la largeur de la carte (Grille), la phrase de la matrice non
  // dessinée remplace la grille et le jumeau. Au-delà du seuil, la phrase
  // du seuil. L'une et l'autre renvoient à la fiche de chaque personne.
  //
  // Regarder n'écrit rien : la vue vit en lecture et sur un plan bloqué.
  import { getContext, tick } from 'svelte';
  import { constante } from '../../geometrie/constantes.js';
  import Carte from '../primitives/Carte.svelte';
  import Commande from '../primitives/Commande.svelte';
  import Grille from './graphiques/Grille.svelte';
  import Jumeau from './graphiques/Jumeau.svelte';
  import { casDesPaires, lignesDesPaires, matriceDesPaires, nomDistinct, pageDesPaires, syntheseMatrice } from './paires.js';

  let { detail = null, ligne = null, table = null } = $props();

  const t = getContext('t');
  const format = getContext('format');
  const ui = getContext('ui');

  const cas = $derived(detail === null ? null : casDesPaires(detail));
  const lignes = $derived(cas === 'tableau' ? lignesDesPaires(detail) : null);
  // La page montrée, à partir de 1, retenue avec l'identifiant du détail où
  // elle a été choisie : un autre détail — une autre proposition montrée —
  // s'ouvre à sa première page ; le même détail remesuré garde la sienne,
  // que pageDesPaires borne aux pages existantes.
  let choix = $state({ detail: null, page: 1 });
  const page = $derived(choix.detail === (detail?.id ?? null) ? choix.page : 1);
  const pageMontree = $derived(lignes === null ? null : pageDesPaires(lignes, page));
  const matrice = $derived(detail === null || cas === 'uneTable' ? null : matriceDesPaires(detail, { t, format }));
  const synthese = $derived(detail === null ? null : syntheseMatrice(detail));
  let dessinable = $state(true);

  // L'étendue de la page, où le focus revient après un changement de page.
  let etendue = $state(null);

  function tourner(numero) {
    choix = { detail: detail?.id ?? null, page: numero };
    tick().then(() => etendue?.focus());
  }

  // Le nom d'une personne dans le nom accessible d'une commande.
  const nomAccessible = (p) => nomDistinct(p, t);

  // Montre la paire au plan au tour donné, à partir de 1, sa première
  // personne mise en évidence.
  function voir(paire, tour) {
    ui.montrerTour(tour);
    ui.mettreEnEvidence(paire.a.id);
    ui.allerA('plan');
  }
</script>

{#snippet personne(p)}
  <span class="personne">
    <span class="nom">{p.nom}</span>
    {#if p.homonyme}
      <span class="secondaire">{t('qualite.paires.homonyme', { id: p.id })}</span>
    {/if}
    {#if p.appartenance !== null}
      <span class="secondaire">{p.appartenance}</span>
    {/if}
  </span>
{/snippet}

{#snippet groupe(titre, paires)}
  <table>
    <caption>{titre}</caption>
    <thead>
      <tr>
        <th scope="col">{t('qualite.paires.colonne.paire')}</th>
        <th scope="col" class="nombre">{t('qualite.paires.colonne.fois')}</th>
        <th scope="col">{t('qualite.paires.colonne.tours')}</th>
      </tr>
    </thead>
    <tbody>
      {#each paires as paire (paire.cle)}
        {@const noms = { a: nomAccessible(paire.a), b: nomAccessible(paire.b) }}
        <tr data-paire={paire.cle}>
          <th scope="row">{@render personne(paire.a)}{@render personne(paire.b)}</th>
          <td class="nombre">{t('qualite.paires.fois', { fois: format.nombre(paire.fois) })}</td>
          <td class="tours">
            <button
              type="button"
              class="premiere"
              data-commande="allerAuTour"
              aria-label={t('qualite.paires.premierTourNom', { tour: paire.repetition, ...noms })}
              onclick={() => voir(paire, paire.repetition)}>{t('qualite.paires.premierTour', { tour: paire.repetition })}</button
            >
            {#each paire.tours as { tour, table: numero } (tour)}
              <button
                type="button"
                data-commande="allerAuTour"
                aria-label={t('qualite.paires.tourNom', { tour, table: numero, ...noms })}
                onclick={() => voir(paire, tour)}>{t('qualite.paires.tour', { tour, table: numero })}</button
              >
            {/each}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/snippet}

{#snippet etroite()}
  <span data-phrase-qualite="matriceEtroite">{t('qualite.paires.matrice.etroite')}</span>
{/snippet}

<div data-vue-qualite="paires">
  <Carte titre={t('qualite.vue.paires.titre')} sousTitre={t('qualite.vue.paires.question')} niveau={3}>
    {#if detail !== null}
      <div class="corps">
        {#if cas === 'uneTable'}
          <p data-phrase-qualite="pairesUneTable">{t('qualite.paires.uneTable')}</p>
        {:else if cas === 'unTour'}
          <p data-phrase-qualite="pairesUnTour">{t('qualite.paires.unTour')}</p>
        {:else if cas === 'aucune'}
          <p data-phrase-qualite="pairesAucune">{t('qualite.paires.aucune')}</p>
        {:else if pageMontree !== null}
          <nav class="pages" aria-label={t('qualite.paires.pages.nom')}>
            {#if pageMontree.page > 1}
              <Commande cle="qualite.paires.pages.precedentes" nom="precedentes" executer={() => tourner(pageMontree.page - 1)} />
            {/if}
            <p class="etendue" bind:this={etendue} role="status" tabindex="-1">
              {t('qualite.paires.pages.etendue', {
                premier: format.nombre(pageMontree.premier),
                dernier: format.nombre(pageMontree.dernier),
                total: format.nombre(pageMontree.total),
              })}
            </p>
            {#if pageMontree.page < pageMontree.pages}
              <Commande cle="qualite.paires.pages.suivantes" nom="suivantes" executer={() => tourner(pageMontree.page + 1)} />
            {/if}
          </nav>
          <div class="defilement">
            {#if pageMontree.choisies.length > 0}
              {@render groupe(t('qualite.paires.choisies'), pageMontree.choisies)}
            {/if}
            {#if pageMontree.imposees.length > 0}
              {@render groupe(t('qualite.paires.imposees'), pageMontree.imposees)}
            {/if}
          </div>
        {/if}

        {#if cas !== 'uneTable'}
          <section class="matrice">
            <h4>{t('qualite.paires.matrice.titre')}</h4>
            {#if matrice === null}
              <p data-phrase-qualite="matriceSeuil">
                {t('qualite.paires.matrice.seuil', {
                  participants: format.nombre(detail.population.mesuree),
                  seuil: format.nombre(constante('SEUIL_MATRICE_PARTICIPANTS')),
                })}
              </p>
            {:else}
              <Grille
                graphique="matrice"
                nom={t('qualite.paires.matrice.titre')}
                synthese={t(synthese.cle, synthese.details)}
                lignes={matrice.lignes}
                colonnes={matrice.colonnes}
                valeurs={matrice.valeurs}
                diagonale
                phrase={etroite}
                infobulle={matrice.infobulle}
                bind:dessinable
              />
              {#if dessinable}
                <Jumeau tableaux={[matrice.jumeau]} />
              {/if}
            {/if}
          </section>
        {/if}
      </div>
    {/if}
  </Carte>
</div>

<style>
  .corps {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
    min-width: 0;
  }

  p {
    margin: 0;
  }

  /* La nav des pages : précédentes, l'étendue, suivantes, sur une ligne
     quand elle tient. */
  .pages {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-2) var(--espace-3);
  }

  .etendue {
    font-variant-numeric: tabular-nums;
  }

  .etendue:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  .defilement {
    display: flex;
    flex-direction: column;
    gap: var(--espace-4);
    max-width: 100%;
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--taille-texte);
  }

  caption {
    padding-bottom: var(--espace-2);
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-intertitre);
    font-weight: bold;
    letter-spacing: var(--interlettre-capitales);
    text-align: start;
    text-transform: uppercase;
  }

  /* Un filet léger entre deux lignes, aucun filet vertical. */
  th,
  td {
    padding: var(--espace-2) var(--espace-3);
    border-bottom: 1px solid var(--couleur-ligne-filet);
    vertical-align: top;
    text-align: start;
  }

  thead th {
    background-color: var(--couleur-carte-fond-sourd);
    border-bottom-color: var(--couleur-carte-filet);
    font-size: var(--taille-texte-petit);
    font-weight: bold;
    vertical-align: bottom;
  }

  tbody th {
    font-weight: normal;
  }

  .nombre {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  /* Les deux personnes d'une paire, l'une sous l'autre : le nom en gras,
     l'identifiant d'un homonyme et l'appartenance en encre secondaire. */
  .personne {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 var(--espace-2);
    overflow-wrap: anywhere;
  }

  .nom {
    font-weight: bold;
  }

  .secondaire {
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-texte-petit);
  }

  /* Les commandes d'une ligne : la première, à filet, puis chaque tour,
     sans fond ni filet au repos, en rangée qui se replie. */
  .tours {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-1) var(--espace-2);
  }

  button {
    min-height: var(--cible-minimale);
    padding: var(--espace-1) var(--espace-2);
    border: 1px solid transparent;
    border-radius: var(--rayon-2);
    background-color: transparent;
    color: var(--couleur-action-encre);
    font: inherit;
    cursor: pointer;
  }

  button.premiere {
    border-color: var(--couleur-page-filet);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
  }

  button:hover {
    background-color: var(--couleur-carte-fond-sourd);
  }

  button:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  .matrice {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
    min-width: 0;
  }

  h4 {
    margin: 0;
    font-size: var(--taille-titre-carte);
  }
</style>
