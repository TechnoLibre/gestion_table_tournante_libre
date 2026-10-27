<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Les colonnes côte à côte de la vue de comparaison (§ 12.10.6, § 12.8,
  // D57, D67, D84, C20, C29) : une colonne par placement, les mêmes
  // chiffres dans le même ordre, rendus de ce que colonnesComparaison
  // (colonnes.js) en tire — rien ne se calcule ici.
  //
  // Un premier tableau porte l'en-tête de chaque colonne — le nom du
  // placement, la proposition d'où vient un retenu, la filiation d'une
  // dérivée — et les lignes de la tête. Dessous, la commande « Tous les
  // indicateurs » ouvre et referme un second tableau, les autres tuiles de
  // l'en-tête chiffré sous les groupes du tableau des propositions ; elle
  // dit son état par aria-expanded et désigne le tableau ouvert par
  // aria-controls. Fermé, il n'est pas dans le DOM ; à la fermeture, le
  // focus reste sur la commande. Regarder n'écrit rien : la commande est
  // vivante en lecture et sur un plan bloqué.
  //
  // Une cellule porte, comme la tuile du même placement, sa valeur, son
  // pourcentage suivi du compte du pire (Pourcentage) sur trois lignes
  // seulement, puis les lignes de sa borne et celle des lignes secondaires
  // d'un agrégat, son plancher en dernier ; la mention « ne classe pas »
  // suit le libellé de sa ligne. Aucune cellule n'est mise en avant, aucun
  // écart n'est écrit (§ 12.8).
  //
  // comparaison : la comparaison des deux placements (ComparaisonPlacements,
  // comparerPlacements de src/application/evaluation.js) ; table : la table
  // d'évaluation d'où elle se lit. Sans l'une ou l'autre, rien ne se rend.
  // Les noms des personnes se lisent dans la charge de la séance (contexte
  // seance).
  //
  // Désignations : data-colonne-comparaison, a ou b, sur chaque en-tête et
  // chaque cellule d'une colonne ; data-colonne sur chaque ligne, par le nom
  // de sa colonne au tableau ('rang' pour la place) ; data-tous-les-indicateurs
  // sur la commande du repli.
  import { getContext, tick } from 'svelte';
  import { nomDe } from '../propositions/modele.js';
  import Pourcentage from './graphiques/Pourcentage.svelte';
  import { colonnesComparaison } from './colonnes.js';

  let { comparaison = null, table = null } = $props();

  const t = getContext('t');
  const format = getContext('format');
  const seance = getContext('seance');
  const uid = $props.id();
  const idIndicateurs = `${uid}-indicateurs`;

  const colonnes = $derived(
    comparaison === null || table === null
      ? null
      : colonnesComparaison(comparaison, table, { t, format, nomDe: (id) => nomDe($seance.charge, id) }),
  );

  let ouvert = $state(false);
  let commande = $state(null);

  async function basculer() {
    ouvert = !ouvert;
    if (!ouvert) {
      await tick();
      commande?.focus();
    }
  }
</script>

{#snippet entetes(placements)}
  <thead>
    <tr>
      <td></td>
      <th scope="col" data-colonne-comparaison="a">{@render placement(placements.a)}</th>
      <th scope="col" data-colonne-comparaison="b">{@render placement(placements.b)}</th>
    </tr>
  </thead>
{/snippet}

{#snippet placement(entete)}
  <span class="nom">{entete.nom}</span>
  {#if entete.origine !== null}
    <span class="secondaire">{entete.origine}</span>
  {/if}
  {#if entete.filiation !== null}
    <span class="secondaire">{entete.filiation}</span>
  {/if}
{/snippet}

{#snippet cellule(contenu)}
  <span class="valeur">{contenu.texte}</span>
  {#if contenu.pourcentage !== null}
    <Pourcentage texte={contenu.pourcentage.texte} compte={contenu.pourcentage.compte} />
  {/if}
  {#each contenu.bornes as borne, rang (rang)}
    <span class="secondaire">{borne}</span>
  {/each}
{/snippet}

{#snippet ligne(chiffre)}
  <tr data-colonne={chiffre.nom}>
    <th scope="row">
      <span>{chiffre.libelle}</span>
      {#if chiffre.neClassePas !== null}
        <span class="ne-classe-pas">{chiffre.neClassePas}</span>
      {/if}
    </th>
    <td data-colonne-comparaison="a">{@render cellule(chiffre.a)}</td>
    <td data-colonne-comparaison="b">{@render cellule(chiffre.b)}</td>
  </tr>
{/snippet}

{#if colonnes !== null}
  <div class="colonnes">
    <div class="defilement">
      <table aria-label={t('qualite.colonnes.titre')}>
        {@render entetes(colonnes.placements)}
        <tbody>
          {#each colonnes.tete as chiffre (chiffre.nom)}
            {@render ligne(chiffre)}
          {/each}
        </tbody>
      </table>
    </div>
    <button
      bind:this={commande}
      type="button"
      class="commande"
      data-tous-les-indicateurs
      aria-expanded={ouvert}
      aria-controls={ouvert ? idIndicateurs : undefined}
      onclick={basculer}>{t('qualite.colonnes.tousLesIndicateurs')}</button
    >
    {#if ouvert}
      <div class="defilement" id={idIndicateurs}>
        <table aria-label={t('qualite.colonnes.tousLesIndicateurs')}>
          {@render entetes(colonnes.placements)}
          {#each colonnes.groupes as groupe (groupe.cle)}
            <tbody>
              <tr>
                <th scope="rowgroup" colspan="3" class="groupe">{groupe.libelle}</th>
              </tr>
              {#each groupe.lignes as chiffre (chiffre.nom)}
                {@render ligne(chiffre)}
              {/each}
            </tbody>
          {/each}
        </table>
      </div>
    {/if}
  </div>
{/if}

<style>
  .colonnes {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
    min-width: 0;
    max-width: 100%;
  }

  .defilement {
    max-width: 100%;
    overflow-x: auto;
  }

  table {
    border-collapse: collapse;
    font-size: var(--taille-texte);
  }

  /* Un filet léger entre deux lignes, aucun filet vertical ; les deux
     colonnes de même largeur, aucune plus marquée que l'autre. */
  th,
  td {
    padding: var(--espace-2) var(--espace-3);
    border-bottom: 1px solid var(--couleur-ligne-filet);
    vertical-align: top;
    text-align: start;
  }

  td[data-colonne-comparaison],
  th[data-colonne-comparaison] {
    width: 14rem;
  }

  /* Les en-têtes des colonnes : sur le fond sourd de la carte, sous un
     filet de carte. */
  thead th {
    background-color: var(--couleur-carte-fond-sourd);
    border-bottom-color: var(--couleur-carte-filet);
    vertical-align: bottom;
  }

  thead th,
  td,
  tbody th {
    font-weight: normal;
  }

  /* Chaque morceau d'une cellule ou d'un en-tête sur sa propre ligne ; le
     pourcentage, un bloc en ligne entre deux blocs, prend la sienne. */
  th > span,
  td > span {
    display: block;
  }

  .nom {
    font-weight: bold;
  }

  .valeur {
    font-weight: bold;
    font-variant-numeric: tabular-nums;
  }

  /* L'intitulé d'un groupe : un intertitre en petit corps, comme la rangée
     des groupes du tableau. */
  .groupe {
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-texte-petit);
    font-weight: bold;
  }

  .secondaire,
  .ne-classe-pas {
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-texte-petit);
  }

  .ne-classe-pas {
    font-style: italic;
  }

  /* La commande du repli : un bouton secondaire, à filet sur le fond de la
     carte, comme celle du jumeau. */
  .commande {
    min-height: var(--cible-minimale);
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    cursor: pointer;
  }

  .commande:hover {
    background-color: var(--couleur-carte-fond-sourd);
  }

  .commande:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }
</style>
