<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Le tableau des propositions (§ 5.4, § 5.7, § 9, § 12.6) : une ligne
  // d'en-têtes, chacun nommant son unité ; la ligne du retenu, mesurée, au-
  // dessus du classement ; les propositions classées, dans l'ordre de la
  // table d'évaluation ; puis celles hors classement, « non comparables »,
  // avec leurs raisons et les personnes qu'elles nomment. Chaque cellule
  // s'écrit par texteCellule (modele.js) ; aucune valeur ne se calcule ici.
  //
  // vue : ce que rend tableau(), libellés et étendues compris. nommer(id) :
  // le nom affiché d'une personne, null pour id null ou pour une personne que
  // la charge n'a plus. voir(id) et
  // retenir(id) : les gestes d'une ligne, que la section câble ; voir(null)
  // montre le retenu. Un refus de « Retenir » se pose à côté du bouton, par
  // la Commande.
  //
  // Désignations : data-retenu sur la ligne du retenu, data-proposition sur
  // chaque autre ligne, data-colonne sur chaque cellule et chaque en-tête ;
  // data-classement et data-hors-classement sur les deux groupes de lignes.
  import { getContext } from 'svelte';
  import Commande from '../primitives/Commande.svelte';
  import { texteCellule } from './modele.js';

  let { vue, nommer, voir, retenir } = $props();

  const t = getContext('t');
  const format = getContext('format');
  const outils = { t, format };
</script>

{#snippet raisons(ligne)}
  <p class="statut">{t(ligne.statut)}</p>
  {#each ligne.raisons as raison, rang (rang)}
    {@const personne = nommer(raison.participant)}
    <p class="raison">
      <span>{t(raison.cle, raison.details)}</span>
      {#if personne !== null}
        <span class="nom">{personne}</span>
      {/if}
    </p>
  {/each}
{/snippet}

{#snippet mesures(ligne)}
  {#if ligne.comparable}
    {#each ligne.cellules as cellule (cellule.colonne)}
      <td data-colonne={cellule.colonne} class="nombre">{texteCellule(cellule, outils)}</td>
    {/each}
    <td data-colonne="imposes">
      {#each ligne.imposes as phrase, rang (rang)}
        <p>{t(phrase.cle, phrase.details)}</p>
      {/each}
    </td>
  {:else}
    <td colspan={vue.etendueRaisons} class="raisons">{@render raisons(ligne)}</td>
  {/if}
{/snippet}

{#snippet identite(ligne)}
  <td data-colonne="proposition">
    <span class="identifiant">{format.nombre(ligne.id)}</span>
    {#if ligne.retenue}
      <span class="marque">{t('propositions.marque.retenue')}</span>
    {/if}
    {#if ligne.comparable}
      {#each ligne.violations as violation, rang (rang)}
        <p>{t(violation.cle, violation.details)}</p>
      {/each}
    {/if}
  </td>
{/snippet}

{#snippet commandes(ligne)}
  <td data-colonne="commandes">
    <div class="commandes">
      <Commande cle="propositions.commande.voir" nom="voir" executer={() => voir(ligne.id)} />
      <Commande cle="propositions.commande.retenir" executer={() => retenir(ligne.id)} />
    </div>
  </td>
{/snippet}

<div class="defilement">
  <table>
    <caption>{t('propositions.tableau.titre')}</caption>
    <thead>
      <tr>
        {#each vue.colonnes as colonne (colonne.nom)}
          <th scope="col" data-colonne={colonne.nom}>{t(colonne.cle)}</th>
        {/each}
      </tr>
    </thead>
    {#if vue.retenu !== null}
      <tbody>
        <tr data-retenu={vue.retenu.id} class="retenu">
          <th scope="row" data-colonne="rang">{t('propositions.retenu.titre')}</th>
          <td data-colonne="proposition">
            <span class="identifiant">{format.nombre(vue.retenu.id)}</span>
            <p>{t(vue.retenu.libelle.cle, vue.retenu.libelle.details)}</p>
          </td>
          {@render mesures(vue.retenu)}
          <td data-colonne="commandes">
            <div class="commandes">
              <Commande cle="propositions.commande.voir" nom="voir" executer={() => voir(null)} />
            </div>
          </td>
        </tr>
      </tbody>
    {/if}
    <tbody data-classement>
      {#each vue.lignes as ligne (ligne.id)}
        <tr data-proposition={ligne.id} class:retenue={ligne.retenue}>
          <td data-colonne="rang" class="nombre">{format.nombre(ligne.rang)}</td>
          {@render identite(ligne)}
          {@render mesures(ligne)}
          {@render commandes(ligne)}
        </tr>
      {/each}
    </tbody>
    {#if vue.horsClassement.length > 0}
      <tbody data-hors-classement>
        <tr>
          <th scope="rowgroup" colspan={vue.colonnes.length}>{t('propositions.horsClassement.titre')}</th>
        </tr>
        {#each vue.horsClassement as ligne (ligne.id)}
          <tr data-proposition={ligne.id} class:retenue={ligne.retenue}>
            <td data-colonne="rang">{t('format.vide')}</td>
            {@render identite(ligne)}
            {@render mesures(ligne)}
            {@render commandes(ligne)}
          </tr>
        {/each}
      </tbody>
    {/if}
  </table>
</div>

<style>
  .defilement {
    max-width: 100%;
    overflow-x: auto;
  }

  table {
    border-collapse: collapse;
    font-size: var(--taille-texte);
  }

  caption {
    padding-bottom: var(--espace-2);
    font-weight: bold;
    text-align: left;
  }

  th,
  td {
    padding: var(--espace-1) var(--espace-2);
    border: 1px solid var(--couleur-page-filet);
    vertical-align: top;
    text-align: left;
  }

  thead th {
    min-width: 6rem;
    font-weight: bold;
  }

  .nombre {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  p {
    margin: 0;
  }

  .raisons {
    min-width: 20rem;
  }

  .raison {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-1);
  }

  .statut {
    font-weight: bold;
  }

  .nom {
    font-style: italic;
  }

  /* La ligne du retenu et la proposition retenue se distinguent par leur
     forme : texte gras, filet épais à gauche, et le mot « retenue ». */
  .retenu,
  .retenue {
    font-weight: bold;
  }

  .retenu > :first-child,
  .retenue > :first-child {
    border-left: 4px solid var(--couleur-page-texte);
  }

  .marque {
    margin-left: var(--espace-1);
    padding: 0 var(--espace-1);
    border: 1px solid var(--couleur-page-texte);
    border-radius: var(--rayon-1);
  }

  .commandes {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-1);
  }
</style>
