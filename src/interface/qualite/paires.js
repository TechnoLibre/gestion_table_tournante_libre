// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le modèle de la vue des paires répétées (§ 12.5, B14, D32, D33, D50) et de
// la rubrique « Rencontres » de la fiche, pur : VuePaires.svelte et
// Fiche.svelte le câblent.
//
// Il met en forme ce que le détail du placement porte, dans l'ordre où il
// le porte : les paires choisies puis les paires imposées, chacune triée par
// le moteur (fois décroissant, puis identifiants) ; la matrice dans l'ordre
// du profil (§ 12.3), jamais par l'alphabet. Il ne trie, ne recompte et ne
// mesure rien : un tour du détail, compté à partir de 0, s'écrit à partir
// de 1, une table, nommée par son identifiant, s'écrit par son numéro, et
// une liste du détail se lit par sa longueur et sa tête, sans s'ajouter à
// une autre ni s'y comparer.
import { rencontresDePersonne } from '../../application/evaluation.js';
import { nomAffiche } from '../../application/personnes.js';
import { pagine } from '../propositions/modele.js';

/** Les cas de la vue des paires, dans l'ordre où elle les éprouve :
 *  uneTable, une seule table ; unTour, un seul tour ; aucune, aucune paire
 *  ne se revoit ; tableau, le tableau des paires. */
export const CAS_PAIRES = Object.freeze(['uneTable', 'unTour', 'aucune', 'tableau']);

/**
 * Le cas de la vue des paires pour un détail comparable : une seule table
 * l'emporte, puis un seul tour ; sans paire choisie ni imposée, aucune ;
 * sinon le tableau.
 *
 * @param {{T: number, R: number, paires: {choisies: Object[], imposees: Object[]}}} detail
 * @returns {string}  l'un de CAS_PAIRES
 */
export function casDesPaires({ T, R, paires }) {
  if (T === 1) return 'uneTable';
  if (R === 1) return 'unTour';
  if (paires.choisies.length === 0 && paires.imposees.length === 0) return 'aucune';
  return 'tableau';
}

// Les personnes données par identifiant, chacune {id, nom, organisation,
// homonyme} : homonyme vrai quand une autre personne de la liste porte le
// même nom affiché — la vue écrit alors son identifiant à côté du nom.
function personnesParId(personnes) {
  const parNom = new Map();
  for (const { nom } of personnes) parNom.set(nom, (parNom.get(nom) ?? 0) + 1);
  return new Map(
    personnes.map(({ id, nom, organisation }) => [id, { id, nom, organisation, homonyme: parNom.get(nom) > 1 }]),
  );
}

/**
 * Le nom d'une personne là où un seul texte la désigne — une infobulle, un
 * intitulé de la matrice, un nom accessible : son nom, suivi de son
 * identifiant pour un homonyme, comme une ligne l'écrit en deux morceaux.
 *
 * @param {{id: number, nom: string, homonyme: boolean}} personne
 * @param {(cle: string, details?: Object) => string} t
 */
export const nomDistinct = ({ id, nom, homonyme }, t) => (homonyme ? t('qualite.paires.nomHomonyme', { nom, id }) : nom);

// Le numéro de chaque table du détail, par son identifiant.
const numerosParTable = ({ idsTables, numerosTables }) => new Map(idsTables.map((id, t) => [id, numerosTables[t]]));

/**
 * Les lignes du tableau des paires (§ 12.5, D32) : {choisies, imposees},
 * chacune dans l'ordre du détail. Une ligne : {cle, genre, a, b, fois,
 * tours, repetition} — cle, « a:b » par identifiants ; genre, 'choisie' ou
 * 'imposee' ; a et b, {id, nom, organisation, homonyme} ; tours, chaque
 * tour où la paire est assise ensemble, {tour, table}, tour à partir de 1,
 * table son numéro ; repetition, le premier tour où la paire se revoit —
 * son second tour ensemble —, où mène la première commande de la ligne.
 *
 * @param {Object} detail   un détail comparable (detaillerQualite)
 * @returns {{choisies: Object[], imposees: Object[]}}
 */
export function lignesDesPaires(detail) {
  const personnes = personnesParId(detail.personnes);
  const numeros = numerosParTable(detail);
  const ligne = (genre) => ({ a, b, fois, tours }) => {
    const ecrits = tours.map(({ tour, table }) => ({ tour: tour + 1, table: numeros.get(table) }));
    return { cle: `${a}:${b}`, genre, a: personnes.get(a), b: personnes.get(b), fois, tours: ecrits, repetition: ecrits[1].tour };
  };
  return { choisies: detail.paires.choisies.map(ligne('choisie')), imposees: detail.paires.imposees.map(ligne('imposee')) };
}

/**
 * La page p du tableau des paires (§ 12.5, D50) : le découpage du tableau
 * des propositions (pagine, TAILLE_PAGE lignes par page), les paires
 * choisies d'abord, puis les imposées, comptées à la suite. Rend
 * {choisies, imposees, page, pages, premier, dernier, total, paginee} :
 * les lignes de chaque groupe que la page porte, puis la forme de pagine.
 *
 * @param {{choisies: Object[], imposees: Object[]}} lignes   lignesDesPaires
 * @param {number} page   entière, à partir de 1 ; bornée aux pages existantes
 */
export function pageDesPaires({ choisies, imposees }, page) {
  const { lignes, horsClassement, ...reste } = pagine({ lignes: choisies, horsClassement: imposees }, page);
  return { choisies: lignes, imposees: horsClassement, ...reste };
}

/**
 * La matrice « qui a rencontré qui » (§ 12.5, D33) mise en forme pour la
 * grille, son infobulle et son jumeau ; null quand le détail ne la porte
 * pas (au-delà du seuil). Les personnes viennent dans l'ordre de la
 * matrice, celui du profil, chacune sous son rang à partir de 1 : une ligne
 * de la grille s'intitule « rang. nom », une colonne par le rang seul. Le
 * nom d'une personne, celui de nomDistinct, s'écrit une fois et sert à
 * l'intitulé de sa ligne comme à l'infobulle de chacune de ses cases. Les
 * valeurs sont le triangle du détail déplié en n × n, ligne après ligne,
 * symétrique, null sur la diagonale, que la grille laisse vide.
 *
 * Rend {personnes, lignes, colonnes, valeurs, infobulle, jumeau} :
 * personnes, [{id, nom, rang}], nom celui de nomDistinct ; lignes et
 * colonnes, [{libelle}] ;
 * infobulle, {colonnes, lignes}, une ligne par case dans l'ordre des
 * valeurs — la paire et son compte, la personne seule sur la diagonale ;
 * jumeau, {nom, colonnes, lignes}, une ligne par personne, son intitulé
 * puis un compte par colonne, vide sur la diagonale.
 *
 * @param {Object} detail   un détail comparable
 * @param {{t: Function, format: {nombre: Function}}} outils
 */
export function matriceDesPaires(detail, { t, format }) {
  if (detail.matrice === null) return null;
  const { ordre, comptes } = detail.matrice;
  const parId = personnesParId(detail.personnes);
  const n = ordre.length;
  const personnes = ordre.map((id, i) => ({ id, nom: nomDistinct(parId.get(id), t), rang: i + 1 }));
  // Le rang d'une paire i < j dans le triangle du détail, ligne après ligne.
  const rangPaire = (i, j) => (i * (2 * n - i - 1)) / 2 + (j - i - 1);
  const compte = (i, j) => (i === j ? null : comptes[i < j ? rangPaire(i, j) : rangPaire(j, i)]);

  const lignes = personnes.map(({ nom, rang }) => ({ libelle: t('qualite.paires.matrice.ligne', { rang: format.nombre(rang), nom }) }));
  const colonnes = personnes.map(({ rang }) => ({ libelle: format.nombre(rang) }));
  const valeurs = [];
  const bulles = [];
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      valeurs.push(compte(i, j));
      bulles.push({
        paire: i === j ? personnes[i].nom : t('qualite.paires.matrice.paire', { a: personnes[i].nom, b: personnes[j].nom }),
        fois: compte(i, j),
      });
    }
  }
  const colonnesBulle = [
    { cle: 'paire', libelle: t('qualite.paires.colonne.paire'), genre: 'texte' },
    { cle: 'fois', libelle: t('qualite.paires.colonne.fois'), genre: 'nombre' },
  ];
  const colonnesJumeau = [
    { cle: 'personne', libelle: t('qualite.paires.matrice.personne'), genre: 'texte' },
    ...personnes.map(({ rang }, j) => ({ cle: `c${j}`, libelle: format.nombre(rang), genre: 'nombre' })),
  ];
  const lignesJumeau = personnes.map((personne, i) => {
    const ligne = { personne: lignes[i].libelle };
    for (let j = 0; j < n; j += 1) ligne[`c${j}`] = i === j ? '' : compte(i, j);
    return ligne;
  });
  return {
    personnes,
    lignes,
    colonnes,
    valeurs,
    infobulle: { colonnes: colonnesBulle, lignes: bulles },
    jumeau: { nom: t('qualite.paires.matrice.titre'), colonnes: colonnesJumeau, lignes: lignesJumeau },
  };
}

/**
 * La phrase de synthèse de la matrice (§ 12.7) : chaque liste du détail qui
 * n'est pas vide, les choisies puis les imposées, lue telle que le moteur la
 * rend — son effectif et le fois de sa tête, la plus revue de la liste — ;
 * sans paire revue, la phrase qui le dit. Rien ne s'y additionne ni ne s'y
 * compare : les deux têtes s'écrivent l'une après l'autre. Rend {cle,
 * details}, details {choisies, imposees}, chacune {paires, fois}, null pour
 * une liste vide.
 *
 * @param {{paires: {choisies: Object[], imposees: Object[]}}} detail
 */
export function syntheseMatrice({ paires: { choisies, imposees } }) {
  if (choisies.length === 0 && imposees.length === 0) return { cle: 'qualite.paires.matrice.syntheseAucune', details: {} };
  const liste = (paires) => (paires.length === 0 ? null : { paires: paires.length, fois: paires[0].fois });
  return { cle: 'qualite.paires.matrice.synthese', details: { choisies: liste(choisies), imposees: liste(imposees) } };
}

/**
 * La rubrique « Rencontres » de la fiche d'une personne (§ 12.5, B14, D33)
 * : la ligne de la personne dans le placement que le plan montre, la
 * source de la page de qualité — la proposition demandée au plan quand la
 * liste la porte, sinon le retenu, sinon aucun, comme sourceQualite
 * (source.js) le choisit, sans en évaluer la table.
 *
 * Rend {statut, source, lignes} : statut, celui de rencontresDePersonne —
 * mesuree, nonMesurable, exclue ou sansPlacement ; source, {cle, details},
 * le libellé du placement, null sans placement ; lignes, chaque personne
 * rencontrée, {id, nom, organisation, homonyme, fois, tours: [{tour,
 * table}]}, les plus revues d'abord, tour à partir de 1, table son numéro.
 * organisation et homonyme sont ceux du tableau des paires, sur les
 * personnes non exclues de la charge, celles que le placement mesure. Ne
 * modifie pas la charge.
 *
 * @param {Object} charge   la charge de l'état observable de la séance
 * @param {number|null} demandee   la proposition demandée au plan (ui.proposition)
 * @param {number} personne   l'identifiant de la personne de la fiche
 */
export function rubriqueRencontres(charge, demandee, personne) {
  let id = null;
  if (demandee !== null && charge.propositions.some((proposition) => proposition.id === demandee)) id = demandee;
  else if (charge.retenu !== null) id = 'retenu';
  const { statut, lignes } = rencontresDePersonne(charge, id, personne);
  let source = null;
  if (id === 'retenu') source = { cle: 'participants.fiche.rencontres.retenu', details: {} };
  else if (id !== null) source = { cle: 'participants.fiche.rencontres.proposition', details: { proposition: id } };
  const numeros = new Map(charge.tables.map(({ id: table, numero }) => [table, numero]));
  const personnes = personnesParId(
    charge.participants
      .filter(({ exclu }) => !exclu)
      .map((p) => ({ id: p.id, nom: nomAffiche(p), organisation: (p.organisation ?? '').trim() === '' ? null : p.organisation })),
  );
  return {
    statut,
    source,
    lignes: lignes.map(({ id: autre, fois, tours }) => ({
      ...personnes.get(autre),
      fois,
      tours: tours.map(({ tour, table }) => ({ tour: tour + 1, table: numeros.get(table) })),
    })),
  };
}
