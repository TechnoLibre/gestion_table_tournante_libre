<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Le jumeau tabulaire d'un graphique (§ 12.7, D44) : le chemin du clavier
  // et du lecteur d'écran vers chaque valeur. Une commande sous le
  // graphique, « Voir le tableau », l'ouvre à la demande et le referme ;
  // elle dit son état par aria-expanded, et désigne le tableau ouvert par
  // aria-controls. Fermé, il n'est pas dans le DOM : ses lignes ne se
  // bâtissent qu'à l'ouverture. À la fermeture, le focus reste sur la
  // commande, jamais sur body. Regarder n'écrit rien : la commande est
  // vivante en lecture et sur un plan bloqué.
  //
  // tableaux : un ou plusieurs tableaux, chacun {nom, colonnes, lignes} —
  // nom, déjà traduit, le nomme par aria-label ; colonnes, {cle, libelle,
  // genre, decimales?} (exigerColonnes, pointage.js), genre texte, nombre ou
  // pourcentage ; lignes, une par ligne, chacune un objet des valeurs sous la
  // clé de leur colonne, dans l'ordre où la vue les a reçues du détail. Un
  // nombre s'écrit par format.nombre, aux décimales de sa colonne, comme les
  // graduations des axes (celluleDe). La première colonne est l'en-tête de sa
  // ligne. Une cellule de genre pourcentage reçoit {texte, compte} et se rend
  // par Pourcentage, le compte de sa ligne dessous ; une valeur absente
  // s'écrit « — ». ouvert : liable, l'état de la commande.
  //
  // Un jumeau porte au moins les valeurs de son graphique, et peut détailler
  // au-delà — une seconde table, une ligne par tour —, jamais en deçà : la
  // vue en décide, le composant rend ce qu'il reçoit, sur le modèle de
  // TableauPropositions. Les noms y sont entiers.
  //
  // Désignations : data-commande ouvrirJumeau ou fermerJumeau sur la
  // commande, data-jumeau sur chaque tableau, par son rang, data-colonne sur
  // chaque en-tête et chaque cellule.
  import { getContext, tick } from 'svelte';
  import Pourcentage from './Pourcentage.svelte';
  import { celluleDe, exigerColonnes } from './pointage.js';

  let { tableaux, ouvert = $bindable(false) } = $props();

  const t = getContext('t');
  const format = getContext('format');
  const uid = $props.id();
  const idTableaux = `${uid}-tableaux`;

  let commande = $state(null);

  async function basculer() {
    ouvert = !ouvert;
    if (!ouvert) {
      await tick();
      commande?.focus();
    }
  }
</script>

<div class="jumeau">
  <button
    bind:this={commande}
    type="button"
    class="commande"
    data-commande={ouvert ? 'fermerJumeau' : 'ouvrirJumeau'}
    aria-expanded={ouvert}
    aria-controls={ouvert ? idTableaux : undefined}
    onclick={basculer}>{t(ouvert ? 'graphiques.jumeau.fermer' : 'graphiques.jumeau.ouvrir')}</button
  >
  {#if ouvert}
    <div id={idTableaux} class="tableaux">
      {#each tableaux as tableau, rang (rang)}
        {@const colonnes = exigerColonnes(tableau.colonnes)}
        <div class="defilement">
          <table data-jumeau={rang} aria-label={tableau.nom}>
            <thead>
              <tr>
                {#each colonnes as colonne (colonne.cle)}
                  <th scope="col" class:nombre={colonne.genre !== 'texte'} data-colonne={colonne.cle}>{colonne.libelle}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each tableau.lignes as ligne, i (i)}
                <tr>
                  {#each colonnes as colonne, j (colonne.cle)}
                    {@const cellule = celluleDe(colonne, ligne, format.nombre)}
                    <svelte:element
                      this={j === 0 ? 'th' : 'td'}
                      scope={j === 0 ? 'row' : undefined}
                      class:nombre={colonne.genre !== 'texte'}
                      data-colonne={colonne.cle}
                    >
                      {#if cellule.genre === 'pourcentage'}
                        <Pourcentage texte={cellule.texte} compte={cellule.compte} />
                      {:else}
                        {cellule.texte ?? t('format.vide')}
                      {/if}
                    </svelte:element>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .jumeau {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
  }

  /* La commande : un bouton secondaire, à filet sur le fond de la carte. */
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

  .tableaux {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
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

  /* Un filet léger entre deux lignes, aucun filet vertical. */
  th,
  td {
    padding: var(--espace-2) var(--espace-3);
    border-bottom: 1px solid var(--couleur-ligne-filet);
    vertical-align: top;
    text-align: start;
  }

  /* Les en-têtes de colonne : sur le fond sourd de la carte, en gras et en
     petit corps, sous un filet de carte. */
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
  }
</style>
