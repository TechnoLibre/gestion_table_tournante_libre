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
  // vue : ce que rend tableau(), libellés et étendues compris — ses colonnes
  // et ses groupes, ceux que porte la table, le sixième groupe selon les
  // critères qui comptent —, ses lignes et ses lignes hors classement
  // réduites à celles de la page montrée (pagine, modele.js) ; chaque ligne
  // garde son rang global. nommer(id) : le nom affiché d'une personne, null
  // pour id null ou pour une personne que la charge n'a plus. voir(id) et
  // retenir(id) : les gestes d'une ligne, que la section câble ; voir(null)
  // montre le retenu.
  //
  // Les commandes d'une ligne vivent dans son menu « Actions »
  // (MenuActions, primitive), dernière cellule de la ligne : fermé, il ne
  // montre que son bouton, et la ligne garde la hauteur de ses chiffres. Le
  // bouton se nomme par une phrase qui porte le numéro de sa ligne,
  // « Actions de la proposition n° 4 », ou « Actions du placement
  // retenu ». Le menu d'une proposition porte « Voir sur le plan »,
  // « Qualité » et « Retenir », puis « Repartir d'elle » sur une ligne qui
  // sert de départ — comparable, ou en dérive par ses seuls participants —
  // et « Comparer » sur une ligne comparable ; celui du retenu, « Voir sur
  // le plan », « Qualité » et « Comparer ». Un refus de « Retenir » se pose à côté du
  // bouton du menu, par MenuActions. « Qualité » demande sa proposition au
  // plan — le retenu sur la ligne du retenu — et ouvre la page de qualité,
  // qui mesure la proposition de sa ligne, ou le retenu (§ 12), que le plan
  // la montre ou non : l'état de navigation seul change, sans écriture ni
  // refus, en lecture comme sur un plan bloqué.
  //
  // Une proposition dérivée porte sous son numéro, dans sa cellule
  // d'identité, la phrase qui la rattache à son départ (texteFiliation,
  // filiation.js), sans colonne de plus ; la ligne du retenu garde « Tel que
  // la proposition n° X. ». « Repartir d'elle » choisit la proposition de sa
  // ligne pour départ et ouvre la section Génération : il s'offre sur toute
  // ligne qui sert de départ (sertDeDepart, modele.js), une ligne en dérive
  // par ses seuls participants comprise, dont la génération part ajustée à
  // la présence. « Comparer » ouvre la page de qualité à sa vue de
  // comparaison, la ligne y devenant le second placement ou la source
  // (gesteComparer, comparer.js, jugé sur la source de la page) : il ne
  // s'offre que sur une ligne comparable, et quand deux placements
  // mesurables et distincts existent (comparaisonOfferte, evaluation.js).
  // Le menu du retenu porte « Comparer » seul ; celui d'une ligne en dérive
  // par le mobilier, ou fautive, ni l'une ni l'autre.
  // Chacune se nomme, pour le lecteur d'écran, par une phrase qui porte le
  // numéro de sa ligne : cent lignes par page ne portent pas cent boutons
  // de même nom. Ni l'une ni l'autre n'écrit ni ne refuse : seul l'état de
  // navigation change, en lecture comme sur un plan bloqué (§ 8.4). La
  // charge et sa table d'évaluation se lisent dans l'état observable de la
  // séance, la table par evaluation (modele.js), celle que la section met en
  // tableau, gardée sous la charge.
  //
  // surlignee : le nom de la
  // colonne que la phrase de l'ordre désigne — une colonne de mesure, ou
  // celle des propositions —, null sans surlignage ; son en-tête et chacune
  // de ses cellules se surlignent, hors la cellule des raisons d'une ligne
  // hors classement, qui en couvre plusieurs.
  //
  // Chaque en-tête explique sa colonne dans l'infobulle de la section : il se
  // focalise au clavier (tabindex 0), et son survol ou son focus appelle
  // expliquer(evenement, 'colonne:<nom>', nom), le quitter
  // taire('colonne:<nom>').
  // decrit('colonne:<nom>') rend l'identifiant de l'infobulle quand elle
  // explique cet en-tête, pour son aria-describedby, undefined sinon.
  //
  // Deux rangées d'en-têtes : celle des groupes (vue.groupes, modele.js),
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
  // data-classement et data-hors-classement sur les deux groupes de lignes ;
  // data-filiation sur la phrase de filiation d'une dérivée.
  // Une cellule surlignée porte data-marque="selection" : ses filets
  // portent l'information, et la garde des marques (§ 14.5) les mesure à
  // 3:1 contre le fond, dans les deux thèmes. Les autres n'en portent pas.
  import { getContext } from 'svelte';
  import { derivationDe } from '../../application/depart.js';
  import { comparaisonOfferte } from '../../application/evaluation.js';
  import Icone from '../primitives/Icone.svelte';
  import MenuActions from '../primitives/MenuActions.svelte';
  import Pastille from '../primitives/Pastille.svelte';
  import { sourceQualite } from '../qualite/source.js';
  import { gesteComparer } from './comparer.js';
  import { texteFiliation } from './filiation.js';
  import { evaluation, texteCellule } from './modele.js';

  let { vue, surlignee = null, nommer, voir, retenir, expliquer, taire, decrit } = $props();

  // L'attribut data-marque d'une cellule de la colonne nommée : 'selection'
  // quand elle est la colonne surlignée, undefined sinon, qui l'omet.
  const marque = (nommee) => (nommee === surlignee ? 'selection' : undefined);

  const t = getContext('t');
  const format = getContext('format');
  const ui = getContext('ui');
  const seance = getContext('seance');
  const outils = { t, format };

  const charge = $derived($seance.charge);
  const table = $derived(charge === null ? null : evaluation(charge).table);
  const offerte = $derived(table !== null && comparaisonOfferte(charge, table));

  // Demande la proposition id au plan, ou le retenu pour null, puis ouvre
  // la page de qualité.
  function qualite(id) {
    ui.montrerProposition(id);
    ui.allerA('qualite');
  }

  // Choisit la proposition id pour départ, ses tours tous décochés, puis
  // ouvre la section Génération.
  function repartir(id) {
    ui.choisirDepart(id);
    ui.allerA('generation');
  }

  // Ouvre la page de qualité à sa vue de comparaison, cible — une
  // proposition, ou 'retenu' — devenue le second placement de la source de
  // la page, ou la source même (gesteComparer).
  function comparer(cible) {
    const source = sourceQualite(charge, { demandee: ui.etat().proposition });
    const { montrer, comparee } = gesteComparer(charge, table, { source, cible });
    if (montrer !== undefined) ui.montrerProposition(montrer);
    ui.comparerA(comparee);
    ui.allerA('qualite');
    ui.demanderVueQualite('comparaison');
  }

  // Les éléments du menu d'une proposition : voir, qualité et retenir, puis
  // repartir sur une ligne qui sert de départ, et comparer sur une ligne
  // comparable quand la comparaison est offerte.
  function actionsDeLigne(ligne) {
    const actions = [
      { cle: 'propositions.commande.voir', nom: 'voir', executer: () => voir(ligne.id) },
      { cle: 'propositions.commande.qualite', nom: 'qualite', executer: () => qualite(ligne.id) },
      { cle: 'propositions.commande.retenir', executer: () => retenir(ligne.id) },
    ];
    if (ligne.sertDeDepart) {
      actions.push({ cle: 'propositions.commande.repartir', nomAccessible: t('propositions.nom.repartir', { proposition: ligne.id }), executer: () => repartir(ligne.id) });
    }
    if (ligne.comparable && offerte) actions.push({ cle: 'propositions.commande.comparer', nomAccessible: t('propositions.nom.comparer', { proposition: ligne.id }), executer: () => comparer(ligne.id) });
    return actions;
  }

  // Les éléments du menu du retenu : voir et qualité, puis comparer quand
  // le retenu est comparable et la comparaison offerte.
  const actionsDuRetenu = $derived([
    { cle: 'propositions.commande.voir', nom: 'voir', executer: () => voir(null) },
    { cle: 'propositions.commande.qualite', nom: 'qualite', executer: () => qualite(null) },
    ...(vue.retenu?.comparable && offerte
      ? [{ cle: 'propositions.commande.comparer', nomAccessible: t('propositions.nom.comparerRetenu'), executer: () => comparer('retenu') }]
      : []),
  ]);

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
  {@const filiation = texteFiliation(derivationDe(charge, ligne.id), outils)}
  <td data-colonne="proposition" data-marque={marque('proposition')} class:surlignee={surlignee === 'proposition'}>
    <span class="identifiant">{format.nombre(ligne.id)}</span>
    {#if ligne.retenue}
      <Pastille sorte="statut" valeur="retenu" icone="coche" libelle={t('propositions.marque.retenue')} />
    {/if}
    {#if filiation !== null}
      <p data-filiation>{filiation}</p>
    {/if}
    {@render violations(ligne)}
  </td>
{/snippet}

{#snippet commandes(ligne)}
  <td data-colonne="commandes">
    <MenuActions nomAccessible={t('propositions.nom.actions', { proposition: ligne.id })} elements={actionsDeLigne(ligne)} />
  </td>
{/snippet}

<div class="defilement">
  <table aria-label={t('propositions.tableau.titre')}>
    {#each vue.groupes as segment, rang (rang)}
      <colgroup span={segment.etendue}></colgroup>
    {/each}
    <thead>
      <tr class="groupes">
        {#each vue.groupes as segment, rang (rang)}
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
            <MenuActions nomAccessible={t('propositions.nom.actionsRetenu')} elements={actionsDuRetenu} />
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

  /* La cellule des propositions a la largeur d'une phrase courte : elle
     tient son numéro et « Tel que la proposition n° 3. » ou la phrase de
     filiation en deux lignes, « Ajusté à la main depuis… » en trois. Plus
     étroite, sa phrase passerait à la ligne mot à mot et allongerait la
     ligne entière. Le certificat et les retours imposés tiennent sur une
     ligne, les deux phrases imposées l'une après l'autre : seule la cellule
     des propositions donne à une ligne plus d'une ligne de texte, et la
     ligne garde la hauteur de ses chiffres ; le tableau défile déjà en
     largeur. */
  td[data-colonne='proposition'] {
    min-width: 14rem;
  }

  td[data-colonne='certificat'],
  td[data-colonne='imposes'] {
    white-space: nowrap;
  }

  td[data-colonne='imposes'] p {
    display: inline;
  }

  td[data-colonne='imposes'] p + p {
    margin-left: var(--espace-2);
  }

  /* La cellule du menu « Actions » : le bouton porte en plus du texte son
     remplissage de --espace-1 et son filet de 1 px (MenuActions) ; la
     cellule les retire de son propre remplissage, si bien que le texte du
     bouton s'aligne sur celui des chiffres et que la cellule n'est pas plus
     haute qu'une ligne de texte. */
  td[data-colonne='commandes'] {
    padding-top: calc(var(--espace-2) - var(--espace-1) - 1px);
    padding-bottom: calc(var(--espace-2) - var(--espace-1) - 1px);
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
</style>
