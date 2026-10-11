<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Le tableau des propositions (§ 5.4, § 5.7, § 9, § 12.6) : une ligne
  // d'en-têtes, chacun nommant son unité ; la ligne du retenu, mesurée, au-
  // dessus du classement ; les propositions classées, dans l'ordre de la
  // table d'évaluation ; puis celles hors classement, « non comparables »,
  // avec leurs raisons et les personnes qu'elles nomment. Chaque cellule
  // s'écrit par texteCellule (modele.js) ; aucune valeur ne se calcule ici.
  // Les violations d'une ligne comparable — retenu compris — se lisent sous
  // son identifiant.
  //
  // vue : ce que rend tableau(), libellés et étendues compris. nommer(id) :
  // le nom affiché d'une personne, null pour id null ou pour une personne que
  // la charge n'a plus. voir(id) et
  // retenir(id) : les gestes d'une ligne, que la section câble ; voir(null)
  // montre le retenu. Un refus de « Retenir » se pose à côté du bouton, par
  // la Commande. surlignee : le nom de la colonne que la phrase de l'ordre
  // désigne — une colonne de mesure, ou celle des propositions —, null sans
  // surlignage ; son en-tête et chacune de ses cellules se surlignent, hors
  // la cellule des raisons d'une ligne hors classement, qui en couvre
  // plusieurs.
  //
  // Chaque en-tête explique sa colonne dans l'infobulle de la section : il se
  // focalise au clavier (tabindex 0), et son survol ou son focus appelle
  // expliquer(evenement, 'colonne:<nom>', nom), le quitter taire('colonne:<nom>').
  // decrit('colonne:<nom>') rend l'identifiant de l'infobulle quand elle
  // explique cet en-tête, pour son aria-describedby, undefined sinon.
  //
  // Deux rangées d'en-têtes : celle des groupes (GROUPES_COLONNES, modele.js),
  // chacun en scope colgroup au-dessus de ses colonnes, une cellule vide au-
  // dessus d'une colonne hors groupe ; puis celle des colonnes, seule à
  // porter data-colonne et les explications. Les colonnes de nombres
  // s'alignent à droite en chiffres tabulaires, en-tête compris. La ligne du
  // retenu se peint de la teinte de l'état Retenu, sous l'encre de la page ;
  // la proposition retenue porte la pastille « retenue » (Pastille,
  // primitive). Le tableau se nomme par aria-label : la carte de la section
  // en porte le titre visible.
  //
  // Désignations : data-retenu sur la ligne du retenu, data-proposition sur
  // chaque autre ligne, data-colonne sur chaque cellule et chaque en-tête ;
  // data-classement et data-hors-classement sur les deux groupes de lignes.
  // Une cellule surlignée porte data-marque="selection" : ses filets
  // portent l'information, et la garde des marques (§ 14.5) les mesure à
  // 3:1 contre le fond, dans les deux thèmes. Les autres n'en portent pas.
  import { getContext } from 'svelte';
  import Commande from '../primitives/Commande.svelte';
  import Icone from '../primitives/Icone.svelte';
  import Pastille from '../primitives/Pastille.svelte';
  import { GROUPES_COLONNES, texteCellule } from './modele.js';

  let { vue, surlignee = null, nommer, voir, retenir, expliquer, taire, decrit } = $props();

  // L'attribut data-marque d'une cellule de la colonne nommée : 'selection'
  // quand elle est la colonne surlignée, undefined sinon, qui l'omet.
  const marque = (nommee) => (nommee === surlignee ? 'selection' : undefined);

  const t = getContext('t');
  const format = getContext('format');
  const outils = { t, format };

  // Les noms des colonnes de nombres.
  const nombres = $derived(new Set(vue.colonnes.filter((colonne) => colonne.nombre).map((colonne) => colonne.nom)));
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
      <td data-colonne={cellule.colonne} data-marque={marque(cellule.colonne)} class:nombre={nombres.has(cellule.colonne)} class:surlignee={cellule.colonne === surlignee}>{texteCellule(cellule, outils)}</td>
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

{#snippet violations(ligne)}
  {#if ligne.comparable}
    {#each ligne.violations as violation, rang (rang)}
      <p>{t(violation.cle, violation.details)}</p>
    {/each}
  {/if}
{/snippet}

{#snippet identite(ligne)}
  <td data-colonne="proposition" data-marque={marque('proposition')} class:surlignee={surlignee === 'proposition'}>
    <span class="identifiant">{format.nombre(ligne.id)}</span>
    {#if ligne.retenue}
      <Pastille sorte="statut" valeur="retenu" icone="coche" libelle={t('propositions.marque.retenue')} />
    {/if}
    {@render violations(ligne)}
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
  <table aria-label={t('propositions.tableau.titre')}>
    {#each GROUPES_COLONNES as segment, rang (rang)}
      <colgroup span={segment.etendue}></colgroup>
    {/each}
    <thead>
      <tr class="groupes">
        {#each GROUPES_COLONNES as segment, rang (rang)}
          {#if segment.cle === null}
            <td></td>
          {:else}
            <th scope="colgroup" colspan={segment.etendue}>{t(segment.cle)}</th>
          {/if}
        {/each}
      </tr>
      <tr>
        {#each vue.colonnes as colonne (colonne.nom)}
          {@const terme = `colonne:${colonne.nom}`}
          <!-- L'en-tête se focalise pour montrer au clavier l'explication que
               le pointeur montre au survol ; il n'agit sur rien. -->
          <th
            scope="col"
            data-colonne={colonne.nom}
            data-marque={marque(colonne.nom)}
            class:surlignee={colonne.nom === surlignee}
            class:nombre={colonne.nombre}
            tabindex="0"
            aria-describedby={decrit(terme)}
            onmouseenter={(evenement) => expliquer(evenement, terme, colonne.nom)}
            onmouseleave={() => taire(terme)}
            onfocus={(evenement) => expliquer(evenement, terme, colonne.nom)}
            onblur={() => taire(terme)}>{t(colonne.cle)}</th
          >
        {/each}
      </tr>
    </thead>
    {#if vue.retenu !== null}
      <tbody>
        <tr data-retenu={vue.retenu.id} class="retenu">
          <th scope="row" data-colonne="rang"
            ><span class="titre-retenu"><span class="signe-retenu"><Icone nom="coche" /></span>{t('propositions.retenu.titre')}</span></th
          >
          <td data-colonne="proposition" data-marque={marque('proposition')} class:surlignee={surlignee === 'proposition'}>
            <span class="identifiant">{format.nombre(vue.retenu.id)}</span>
            <p>{t(vue.retenu.libelle.cle, vue.retenu.libelle.details)}</p>
            {@render violations(vue.retenu)}
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
    min-width: 100%;
    border-collapse: collapse;
    font-size: var(--taille-texte);
  }

  /* Les cellules : un filet léger entre deux lignes, aucun filet vertical. */
  th,
  td {
    padding: var(--espace-2) var(--espace-3);
    border: none;
    border-bottom: 1px solid var(--couleur-ligne-filet);
    vertical-align: top;
    text-align: start;
  }

  /* Les en-têtes de colonne : sur le fond sourd de la carte, en gras et en
     petit corps, sous un filet de carte. */
  thead th,
  thead td {
    background-color: var(--couleur-carte-fond-sourd);
    border-bottom-color: var(--couleur-carte-filet);
  }

  thead th {
    min-width: 6rem;
    font-size: var(--taille-texte-petit);
    font-weight: bold;
    vertical-align: bottom;
  }

  /* La rangée des groupes : des intertitres en petites capitales d'encre
     secondaire, chacun soulignant l'étendue de ses colonnes. */
  .groupes th {
    padding-top: var(--espace-2);
    padding-bottom: var(--espace-1);
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-intertitre);
    letter-spacing: var(--interlettre-capitales);
    text-transform: uppercase;
    white-space: nowrap;
  }

  .groupes th,
  .groupes td {
    border-bottom: none;
  }

  .groupes th {
    border-bottom: 2px solid var(--couleur-carte-filet);
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

  /* L'en-tête du groupe hors classement : un intertitre sur le fond sourd. */
  tbody[data-hors-classement] th[scope='rowgroup'] {
    background-color: var(--couleur-carte-fond-sourd);
    font-size: var(--taille-intertitre);
    letter-spacing: var(--interlettre-capitales);
    text-transform: uppercase;
  }

  /* La ligne du retenu : chaque cellule sur la teinte de l'état Retenu,
     l'encre de la page dessus ; son titre en gras, précédé de la coche. */
  .retenu > * {
    background-color: var(--couleur-etat-retenu-fond);
  }

  .titre-retenu {
    display: inline-flex;
    align-items: center;
    gap: var(--espace-1);
    font-weight: bold;
    white-space: nowrap;
  }

  .signe-retenu {
    display: inline-flex;
    color: var(--couleur-etat-retenu-marque);
  }

  /* La ligne du retenu et la proposition retenue ouvrent sur un trait de la
     marque de Retenu ; la ligne du retenu se nomme en mots, la proposition
     retenue par sa pastille. */
  .retenu > :first-child,
  .retenue > :first-child {
    border-left: 3px solid var(--couleur-etat-retenu-marque);
  }

  td[data-colonne='proposition'] {
    min-width: 7rem;
  }

  .identifiant {
    margin-right: var(--espace-2);
    font-weight: bold;
    font-variant-numeric: tabular-nums;
  }

  /* La colonne que désigne la phrase de l'ordre : un filet de 2 px de la
     couleur de sélection de chaque côté de son en-tête et de ses cellules,
     et l'en-tête souligné. Ni le fond ni la couleur du texte ne changent :
     les contrastes restent ceux du tableau. */
  th.surlignee,
  td.surlignee {
    border-left: 2px solid var(--couleur-selection);
    border-right: 2px solid var(--couleur-selection);
  }

  /* L'anneau de focus se pose dans la cellule : le conteneur défilant ne le
     rogne pas. */
  thead th:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: -2px;
  }

  thead th.surlignee {
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 0.2em;
  }

  .commandes {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-1);
  }
</style>
