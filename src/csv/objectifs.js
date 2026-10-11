// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le CSV des objectifs de table (§ 10.4) : un second fichier, que
// l'opérateur choisit d'importer comme tel, jamais une section du fichier
// des participants. Il garde son séparateur, son en-tête et son CSV des
// refus ; tout le § 10.1 vaut, sauf ce qui nomme les participants. Ce module
// en porte l'aperçu, l'import appliqué selon le mode, ce que remplacer
// touche et l'export, qui est le gabarit de l'import et sa sauvegarde.
//
// La lecture reprend, dans l'ordre, celle de l'aperçu des participants :
//   1. un caractère nul refuse le texte ;
//   2. choisirSeparateur choisit le séparateur sur la table d'en-têtes des
//      objectifs ; un texte vide ou blanc est refusé AUCUN_ENTETE, tout autre
//      texte sans séparateur SEPARATEUR_INTROUVABLE, sauf quand le seul
//      défaut est un guillemet resté ouvert, que le point 3 refuse ;
//   3. un guillemet resté ouvert refuse le texte, au rang où il s'ouvre ;
//   4. aucun en-tête reconnu, puis aucune colonne associée à table
//      (TABLE_NON_ASSOCIEE), puis à objectif (OBJECTIF_NON_ASSOCIE), puis un
//      événement sans table (OBJECTIFS_SANS_TABLE) refusent ;
//   5. chaque enregistrement non vide qui suit l'en-tête est une ligne,
//      valide ou refusée pour un seul motif (lireLigne) ; zéro ligne valide
//      refuse (AUCUNE_LIGNE_VALIDE) ;
//   6. les étiquettes des lignes valides se réconcilient avec celles de
//      l'événement : celles des personnes, exclues comprises, et celles des
//      objectifs de table, sauf sous remplacer, qui retire ces objectifs.
// Une ligne refusée ne refuse pas le texte : le reste s'importe, et la ligne
// revient dans le CSV des refus (exporterRefus de import.js, tel quel), dont
// les colonnes ligne et motif restent inconnues de la table des en-têtes.
//
// La table d'une ligne se désigne par son numéro affiché, jamais par son
// identifiant : l'opérateur lit le numéro sur le plan. Une valeur inconnue
// de la règle refuse la ligne : la lire comme le défaut ferait servir un
// objectif sous une règle que personne n'a choisie.

import { ETIQUETTES_MAX, lireEtiquettes } from '../stockage/etiquettes.js';
import { associerSelon, reconnaitreSelon } from './colonnes.js';
import { contientNul } from './encodage.js';
import { ErreurCsv } from './erreurs.js';
import { cleEtiquette, reconcilier } from './etiquettes.js';
import { JOINTURE_ETIQUETTES, SEPARATEUR, ecrireCsv } from './export.js';
import { choisirSeparateur, decouper, enregistrementVide } from './lecture.js';
import { cleNormalisee } from './normalisation.js';

// Un champ et ses en-têtes, figés.
const champ = (nom, entetes) => Object.freeze([nom, Object.freeze(entetes)]);

/**
 * La table des colonnes du CSV des objectifs (§ 10.4), seule source de ses
 * champs et de leurs synonymes : chaque champ, dans l'ordre de l'export, avec
 * ses en-têtes tels que le § 10.4 les écrit — son nom, puis ses synonymes.
 * « règle » a la clé de « regle » : il ne fait que redire que l'accent
 * n'importe pas. Le tableau des colonnes de la documentation s'en engendre.
 * Figée à toute profondeur.
 *
 * @type {ReadonlyArray<readonly [string, ReadonlyArray<string>]>}
 */
export const ENTETES_DES_OBJECTIFS = Object.freeze([
  champ('table', ['table']),
  champ('tour', ['tour']),
  champ('objectif', ['objectif', 'objectifs']),
  champ('regle', ['regle', 'règle']),
]);

/** Champs du CSV des objectifs, dans l'ordre de l'export : son en-tête. */
export const CHAMPS_OBJECTIFS = Object.freeze(ENTETES_DES_OBJECTIFS.map(([nom]) => nom));

/**
 * Champ des objectifs qu'un en-tête désigne, par la règle de reconnaitre
 * (colonnes.js) ; null pour un en-tête inconnu, ceux des participants, ligne
 * et motif compris.
 *
 * @type {(entete: string) => string|null}
 */
export const reconnaitreObjectif = reconnaitreSelon(ENTETES_DES_OBJECTIFS);

/**
 * L'association des colonnes du CSV des objectifs, par la règle d'associer
 * (colonnes.js), les champs dans l'ordre de CHAMPS_OBJECTIFS.
 *
 * @type {ReturnType<typeof associerSelon>}
 */
export const associerObjectifs = associerSelon(ENTETES_DES_OBJECTIFS);

/**
 * Modes de l'import des objectifs, que l'aperçu et l'import reçoivent tous
 * deux (§ 10.4). Ajouter n'en est pas un : un couple (table, tour) déjà
 * pourvu serait une collision, que mettre à jour tranche.
 *
 * @type {readonly string[]}
 */
export const MODES_IMPORT_OBJECTIFS = Object.freeze(['mettreAJour', 'remplacer']);

/**
 * Valeurs admises de la règle, par clé normalisée (cleNormalisee), comme
 * celles d'« exclu » : une liste fermée. 'ou' et 'et' pour une règle propre ;
 * la clé vide, null, pour un objectif qui suit la règle par défaut de
 * l'événement. Une valeur absente de la liste refuse la ligne.
 *
 * @type {Map<string, 'ou'|'et'|null>}
 */
export const VALEURS_REGLE = new Map([
  ['ou', 'ou'],
  ['une', 'ou'],
  ['au moins une', 'ou'],
  ['et', 'et'],
  ['toutes', 'et'],
  ['', null],
]);

// Un entier écrit en chiffres décimaux, un signe admis : « 2.0 », « deux »
// et « 1,5 » n'en sont pas.
const ENTIER = /^[+-]?[0-9]+$/;

// L'ordre des objectifs d'une table (§ 8.9) : la soirée, de tour null,
// avant les tours, puis les tours croissants.
const ordreDesObjectifs = (a, b) => (a.tour ?? 0) - (b.tour ?? 0);

// Deux chaînes, comparées unité UTF-16 par unité : l'ordre où le fichier
// d'état range une liste d'étiquettes (§ 8.9).
const comparerTextes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const rangees = (etiquettes) => [...etiquettes].sort(comparerTextes);

/**
 * @typedef {Object} ChampsObjectif
 * @property {number} numero          le numéro affiché de la table visée
 * @property {number} table           son identifiant
 * @property {number|null} tour       null pour la soirée, sinon de 1 à R
 * @property {'ou'|'et'|null} regle   null quand l'objectif suit la règle par
 *           défaut de l'événement
 * @property {string[]} etiquettes    découpées par lireEtiquettes, dans
 *           l'ordre de la cellule, chacune sous l'orthographe que la
 *           réconciliation lui donne, sans deux de même clé, de 1 à
 *           ETIQUETTES_MAX
 *
 * @typedef {Object} LigneObjectifRefusee
 * @property {number} ligne   rang de l'enregistrement, en-tête compris
 * @property {string} code    CHAMPS_EN_TROP, TABLE_ABSENTE, TABLE_NON_ENTIERE,
 *           NUMERO_TABLE_INCONNU, PLUSIEURS_TABLES, TOUR_NON_ENTIER,
 *           TOUR_HORS_SOIREE, OBJECTIF_VIDE, ETIQUETTE_MAL_FORMEE,
 *           ETIQUETTES_TROP_NOMBREUSES, REGLE_INCONNUE ou OBJECTIF_EN_DOUBLE
 * @property {string|null} valeur   la cellule fautive, en NFC sans ses blancs
 *           de bord, sous les codes de la table, du tour et de la règle ;
 *           l'étiquette fautive, mise en forme, sous ETIQUETTE_MAL_FORMEE ;
 *           null sous les autres
 * @property {number} [tours]       TOUR_HORS_SOIREE : le nombre de tours
 * @property {string} [raison]      ETIQUETTE_MAL_FORMEE : 'controle' ou
 *           'longueur'
 * @property {number} [nombre]      ETIQUETTES_TROP_NOMBREUSES : les
 *           étiquettes de clés distinctes de la cellule
 * @property {number} [premiereLigne]  OBJECTIF_EN_DOUBLE : la ligne valide
 *           qui donne la première l'objectif de ce couple
 * @property {number} [numero]      OBJECTIF_EN_DOUBLE : le numéro de la table
 * @property {number|null} [tour]   OBJECTIF_EN_DOUBLE : le tour, null pour la
 *           soirée
 * @property {string[]} brut        les champs tels que découpés
 *
 * @typedef {Object} ApercuObjectifs
 * @property {'mettreAJour'|'remplacer'} mode   le mode pour lequel l'aperçu
 *           est calculé : appliquerImportObjectifs ne l'applique que dans ce
 *           mode
 * @property {string|null} separateur   null quand aucun séparateur n'est
 *           établi, ou pour un fichier à une colonne
 * @property {string[]} entetes         tels qu'écrits
 * @property {{colonnes: Object<string, number>, ambigus: Array<{champ: string, rangs: number[]}>,
 *             nonReconnues: number[]}} association   ce que rend associerObjectifs
 * @property {Array<{ligne: number, champs: ChampsObjectif, brut: string[]}>} lignes
 *           les lignes valides, dans l'ordre du texte
 * @property {LigneObjectifRefusee[]} refusees   rangées par ligne
 * @property {import('./etiquettes.js').FusionEtiquettes[]} fusionsEtiquettes
 *           les fusions d'orthographes que rend reconcilier sur les lignes
 *           valides
 * @property {Array<{ligne: number, rangs: number[]}>} multilignes   chaque ligne
 *           valide dont une cellule s'étend sur plusieurs lignes du texte et
 *           porte le séparateur — la forme d'un guillemet égaré qui fond deux
 *           lignes en une —, avec les rangs croissants de ces cellules
 * @property {null|'CARACTERE_NUL'|'AUCUN_ENTETE'|'SEPARATEUR_INTROUVABLE'|'GUILLEMET_OUVERT'|'TABLE_NON_ASSOCIEE'|'OBJECTIF_NON_ASSOCIE'|'OBJECTIFS_SANS_TABLE'|'AUCUNE_LIGNE_VALIDE'} refusGlobal
 *           sous un refus global, lignes, fusionsEtiquettes et multilignes
 *           sont vides, et refusees aussi, sauf sous AUCUNE_LIGNE_VALIDE
 * @property {number|null} refusGlobalLigne   sous GUILLEMET_OUVERT, le rang où
 *           le guillemet s'ouvre ; sous SEPARATEUR_INTROUVABLE, celui de
 *           l'enregistrement qui écarte le séparateur, quand il est nommé ;
 *           null sinon
 */

// Aperçu d'un texte refusé en entier : son mode, ce que la lecture a établi
// avant le refus, aucune ligne.
function refuserEn(
  mode,
  code,
  { separateur = null, entetes = [], association = { colonnes: {}, ambigus: [], nonReconnues: [] } } = {},
  ligne = null,
) {
  return {
    mode,
    separateur,
    entetes,
    association,
    lignes: [],
    refusees: [],
    fusionsEtiquettes: [],
    multilignes: [],
    refusGlobal: code,
    refusGlobalLigne: ligne,
  };
}

// Valeur de la cellule de rang donné : NFC, blancs de bord retirés. Null quand
// le champ n'a pas de colonne, que l'enregistrement s'arrête avant elle, ou
// que la cellule est vide ou blanche.
function valeurDe(brut, rang) {
  if (rang === undefined || rang >= brut.length) return null;
  const valeur = brut[rang].normalize('NFC').trim();
  return valeur === '' ? null : valeur;
}

// La table qu'un numéro écrit désigne, ou le motif du refus : TABLE_ABSENTE
// pour une cellule vide, TABLE_NON_ENTIERE pour ce qui n'est pas un entier,
// NUMERO_TABLE_INCONNU quand aucune table ne porte ce numéro, PLUSIEURS_TABLES
// quand deux le portent : la ligne ne dit pas laquelle elle vise.
function tableDe(valeur, tables) {
  if (valeur === null) return { refus: { code: 'TABLE_ABSENTE', valeur: null } };
  if (!ENTIER.test(valeur)) return { refus: { code: 'TABLE_NON_ENTIERE', valeur } };
  const numero = Number(valeur);
  const portees = tables.filter((candidate) => candidate.numero === numero);
  if (portees.length === 0) return { refus: { code: 'NUMERO_TABLE_INCONNU', valeur } };
  if (portees.length > 1) return { refus: { code: 'PLUSIEURS_TABLES', valeur } };
  return { table: portees[0] };
}

// Le tour qu'une cellule écrit : null pour une cellule vide, la soirée ; un
// entier de 1 à tours ; ou le motif du refus, TOUR_NON_ENTIER, ou
// TOUR_HORS_SOIREE qui nomme le nombre de tours.
function tourDe(valeur, tours) {
  if (valeur === null) return { tour: null };
  if (!ENTIER.test(valeur)) return { refus: { code: 'TOUR_NON_ENTIER', valeur } };
  const tour = Number(valeur);
  if (tour < 1 || tour > tours) return { refus: { code: 'TOUR_HORS_SOIREE', valeur, tours } };
  return { tour };
}

// Les étiquettes de la cellule objectif (§ 4.5, § 10.1), par la découpe de
// la saisie : la cellule arrive telle que découpée, sans le trim de valeurDe,
// qui retirerait au bord une tabulation que lireEtiquettes refuse.
// OBJECTIF_VIDE pour une cellule absente, vide ou faite de blancs et de
// séparateurs ; puis ETIQUETTE_MAL_FORMEE, la première fautive avec sa
// raison ; puis ETIQUETTES_TROP_NOMBREUSES au-delà d'ETIQUETTES_MAX clés
// distinctes : deux morceaux de même clé ne font qu'une étiquette.
function etiquettesDe(cellule) {
  const { etiquettes, fautes } = lireEtiquettes(cellule ?? '');
  if (etiquettes.length === 0 && fautes.length === 0) return { refus: { code: 'OBJECTIF_VIDE', valeur: null } };
  if (fautes.length > 0) {
    const [{ valeur, raison }] = fautes;
    return { refus: { code: 'ETIQUETTE_MAL_FORMEE', valeur, raison } };
  }
  const nombre = new Set(etiquettes.map(cleEtiquette)).size;
  if (nombre > ETIQUETTES_MAX) return { refus: { code: 'ETIQUETTES_TROP_NOMBREUSES', valeur: null, nombre } };
  return { etiquettes };
}

// Lit un enregistrement de données selon les colonnes associées, largeur
// étant le nombre d'en-têtes. Rend { champs } ou le motif du refus, un seul,
// dans l'ordre du § 10.4 : un champ non vide au-delà de l'en-tête ; le
// numéro de table ; le tour ; l'objectif ; la règle hors de sa liste fermée.
// Le doublon d'un couple (table, tour) se juge après, contre les lignes
// valides qui précèdent.
function lireLigne(brut, largeur, colonnes, { tables, tours }) {
  if (!enregistrementVide(brut.slice(largeur))) return { code: 'CHAMPS_EN_TROP', valeur: null };
  const lire = (nom) => valeurDe(brut, colonnes[nom]);
  const visee = tableDe(lire('table'), tables);
  if (visee.refus !== undefined) return visee.refus;
  const lu = tourDe(lire('tour'), tours);
  if (lu.refus !== undefined) return lu.refus;
  const objectif = etiquettesDe(colonnes.objectif < brut.length ? brut[colonnes.objectif] : undefined);
  if (objectif.refus !== undefined) return objectif.refus;
  const valeurRegle = lire('regle');
  const regle = VALEURS_REGLE.get(cleNormalisee(valeurRegle ?? ''));
  if (regle === undefined) return { code: 'REGLE_INCONNUE', valeur: valeurRegle };
  return {
    champs: { numero: visee.table.numero, table: visee.table.id, tour: lu.tour, regle, etiquettes: objectif.etiquettes },
  };
}

// Cellules d'une ligne sur plusieurs lignes du texte qui portent le
// séparateur, ou toute fin de ligne sans séparateur : les lignes valides qui
// en ont, avec leurs rangs.
function multilignesDe(lignes, separateur) {
  const multilignes = [];
  for (const { ligne, brut } of lignes) {
    const rangs = [];
    brut.forEach((cellule, rang) => {
      const surPlusieursLignes = cellule.includes('\n') || cellule.includes('\r');
      if (surPlusieursLignes && (separateur === null || cellule.includes(separateur))) rangs.push(rang);
    });
    if (rangs.length > 0) multilignes.push({ ligne, rangs });
  }
  return multilignes;
}

// Les étiquettes de l'événement qui donnent leur orthographe à celles du
// fichier : celles des personnes, exclues comprises, puis celles des
// objectifs de table, sauf sous remplacer, qui les retire. reconcilier ne
// dépend pas de leur ordre.
function etiquettesExistantes({ participants, tables }, mode) {
  return [
    ...participants.flatMap(({ etiquettes = [] }) => etiquettes),
    ...(mode === 'remplacer' ? [] : tables.flatMap(({ objectifs = [] }) => objectifs.flatMap(({ etiquettes }) => etiquettes))),
  ];
}

// La clé d'un couple (table, tour), la soirée sous tour null.
const cleDuCouple = (table, tour) => JSON.stringify([table, tour]);

/**
 * Aperçu d'un texte décodé du CSV des objectifs (§ 10.4), contre la charge,
 * pour un mode de l'import : rien n'est importé. Les lignes se lisent dans
 * l'ordre du texte ; une ligne refusée ne refuse que soi. Le doublon d'un
 * couple (table, tour) se juge contre les lignes valides qui précèdent : une
 * ligne refusée n'est la première d'aucun couple.
 *
 * @param {string} texte  le texte que rend decoder
 * @param {{evenement: {tours: number}, tables: Array<{id: number, numero: number,
 *          objectifs?: Array<{etiquettes: string[]}>}>, participants: Array<{etiquettes?: string[]}>}} charge
 *   la charge de l'événement : ses tables, leurs numéros et leurs objectifs,
 *   les étiquettes de ses personnes, son nombre de tours
 * @param {Object} [options]
 * @param {Object<string, number>} [options.choix]  { champ: rang } qui
 *   tranche une ambiguïté de l'en-tête (voir associer)
 * @param {'mettreAJour'|'remplacer'} [options.mode]  mettreAJour par défaut
 * @returns {ApercuObjectifs}
 * @throws {TypeError} quand texte n'est pas une chaîne, pour un mode inconnu,
 *   et pour un nombre de tours qui n'est pas un entier positif
 */
export function apercevoirObjectifs(texte, charge, { choix = {}, mode = 'mettreAJour' } = {}) {
  if (typeof texte !== 'string') throw new TypeError('texte : chaîne attendue');
  if (!MODES_IMPORT_OBJECTIFS.includes(mode)) {
    throw new TypeError(`mode : ${MODES_IMPORT_OBJECTIFS.join(', ')} attendu, reçu ${String(mode)}`);
  }
  const { tours } = charge.evenement;
  if (!Number.isSafeInteger(tours) || tours < 1) throw new TypeError(`tours : entier positif attendu, reçu ${String(tours)}`);
  const refuser = (...refus) => refuserEn(mode, ...refus);
  if (contientNul(texte)) return refuser('CARACTERE_NUL');

  let separateur;
  try {
    ({ separateur } = choisirSeparateur(texte, reconnaitreObjectif));
  } catch (erreur) {
    // Sur une chaîne, choisirSeparateur ne lève que SEPARATEUR_INTROUVABLE ;
    // toute autre erreur est un défaut, qu'un refus de l'aperçu masquerait.
    if (!(erreur instanceof ErreurCsv) || erreur.code !== 'SEPARATEUR_INTROUVABLE') throw erreur;
    if (texte.trim() === '') return refuser('AUCUN_ENTETE');
    const { cause = null, ligne = null } = erreur.details;
    if (cause !== 'GUILLEMET_OUVERT') return refuser('SEPARATEUR_INTROUVABLE', {}, ligne);
    ({ separateur } = erreur.details);
  }

  const { enregistrements, guillemetOuvert } = decouper(texte, separateur);
  const indiceEntete = enregistrements.findIndex((enregistrement) => !enregistrementVide(enregistrement));
  const entetes = enregistrements[indiceEntete];
  const association = associerObjectifs(entetes, choix);
  const lu = { separateur, entetes, association };
  if (guillemetOuvert) return refuser('GUILLEMET_OUVERT', lu, enregistrements.length);
  if (association.nonReconnues.length === entetes.length) return refuser('AUCUN_ENTETE', lu);
  if (association.colonnes.table === undefined) return refuser('TABLE_NON_ASSOCIEE', lu);
  if (association.colonnes.objectif === undefined) return refuser('OBJECTIF_NON_ASSOCIE', lu);
  if (charge.tables.length === 0) return refuser('OBJECTIFS_SANS_TABLE', lu);

  const valides = [];
  const refusees = [];
  const premieres = new Map();
  for (let indice = indiceEntete + 1; indice < enregistrements.length; indice += 1) {
    const brut = enregistrements[indice];
    if (enregistrementVide(brut)) continue;
    const ligne = indice + 1;
    const { champs, ...refus } = lireLigne(brut, entetes.length, association.colonnes, { tables: charge.tables, tours });
    if (champs === undefined) {
      refusees.push({ ligne, ...refus, brut });
      continue;
    }
    const cle = cleDuCouple(champs.table, champs.tour);
    if (premieres.has(cle)) {
      refusees.push({
        ligne, code: 'OBJECTIF_EN_DOUBLE', valeur: null, premiereLigne: premieres.get(cle), numero: champs.numero,
        tour: champs.tour, brut,
      });
      continue;
    }
    premieres.set(cle, ligne);
    valides.push({ ligne, champs, brut });
  }
  if (valides.length === 0) return { ...refuser('AUCUNE_LIGNE_VALIDE', lu), refusees };

  const { listes, fusions: fusionsEtiquettes } = reconcilier(
    etiquettesExistantes(charge, mode),
    valides.map(({ champs }) => champs.etiquettes),
  );
  const lignes = valides.map(({ ligne, champs, brut }, rang) => ({ ligne, champs: { ...champs, etiquettes: listes[rang] }, brut }));
  return {
    mode,
    ...lu,
    lignes,
    refusees,
    fusionsEtiquettes,
    multilignes: multilignesDe(lignes, separateur),
    refusGlobal: null,
    refusGlobalLigne: null,
  };
}

/**
 * Ce que remplacer toucherait, à annoncer avant d'agir (§ 10.4) : les
 * objectifs de l'événement, que remplacer retire tous, et les tables qui en
 * portent. La charge n'est pas modifiée.
 *
 * @param {{tables: Array<{objectifs?: Array<Object>}>}} charge
 * @returns {{objectifs: number, tables: number}}
 */
export function bilanRemplacementObjectifs({ tables }) {
  const portantes = tables.filter(({ objectifs = [] }) => objectifs.length > 0);
  return { objectifs: portantes.reduce((somme, { objectifs }) => somme + objectifs.length, 0), tables: portantes.length };
}

// Deux objectifs de même règle et de mêmes étiquettes, rangées.
const memesObjectifs = (a, b) => a.regle === b.regle && JSON.stringify(a.etiquettes) === JSON.stringify(b.etiquettes);

/**
 * @typedef {Object} ResumeImportObjectifs
 * @property {number} ajoutes     objectifs d'un couple qui n'en portait pas
 * @property {number} remplaces   objectifs qui remplacent un objectif
 *           différent du même couple
 * @property {number} inchanges   lignes qui redonnent l'objectif de leur couple
 * @property {number} retires     sous remplacer, les objectifs d'un couple
 *           que le fichier ne nomme pas ; 0 sous mettreAJour
 * @property {number} tables      les tables dont les objectifs changent
 * @property {LigneObjectifRefusee[]} refusees   ceux de l'aperçu, copiés
 * @property {boolean} derive     vrai en état retenu : l'import y avertit
 *           que le classement peut changer, sans mettre aucune proposition
 *           en dérive
 */

/**
 * Applique un aperçu des objectifs à une charge (§ 10.4), selon le mode :
 * - 'mettreAJour' : chaque couple (table, tour) du fichier remplace
 *   l'objectif de ce couple ; les autres restent ;
 * - 'remplacer' : chaque objectif de l'événement part, puis ceux du fichier
 *   s'écrivent.
 * Un objectif écrit porte la portée « tous » pour la soirée, « tour » pour un
 * tour, sa règle — null quand il suit le défaut — et ses étiquettes rangées
 * par unités de code ; les objectifs d'une table se rangent la soirée
 * d'abord, puis par tour croissant, et une table qui n'en garde aucun perd
 * son champ objectifs (§ 8.9). Personnes, réservations, titres,
 * propositions et retenu restent. La charge et l'aperçu reçus ne sont pas
 * modifiés ; la charge rendue n'en partage aucun objet.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {ApercuObjectifs} apercu  calculé contre cette charge, pour ce mode
 * @param {'mettreAJour'|'remplacer'} mode
 * @returns {{charge: import('../stockage/types.js').Charge, resume: ResumeImportObjectifs}}
 * @throws {ErreurCsv} dans cet ordre : PLAN_BLOQUE, détails {}, en état
 *   bloqué ; le refus global de l'aperçu, son code, détails { ligne } ;
 *   AMBIGUITE, détails { champs }, tant que le choix ne tranche pas
 * @throws {TypeError} pour un mode inconnu, un aperçu calculé pour un autre
 *   mode, et une ligne dont la table manque à la charge : l'aperçu montré à
 *   l'opérateur est celui que l'import applique
 */
export function appliquerImportObjectifs(charge, apercu, mode) {
  if (!MODES_IMPORT_OBJECTIFS.includes(mode)) {
    throw new TypeError(`mode : ${MODES_IMPORT_OBJECTIFS.join(', ')} attendu, reçu ${String(mode)}`);
  }
  if (apercu.mode !== mode) throw new TypeError(`aperçu calculé pour ${String(apercu.mode)}, import en ${mode}`);
  if (charge.evenement.etat === 'bloque') throw new ErreurCsv('PLAN_BLOQUE');
  if (apercu.refusGlobal !== null) throw new ErreurCsv(apercu.refusGlobal, { ligne: apercu.refusGlobalLigne });
  const { ambigus } = apercu.association;
  if (ambigus.length > 0) throw new ErreurCsv('AMBIGUITE', { champs: ambigus.map(({ champ: nom }) => nom) });

  const resultat = structuredClone(charge);
  const parId = new Map(resultat.tables.map((table) => [table.id, table]));
  const avant = new Map(resultat.tables.map((table) => [table.id, JSON.stringify(table.objectifs ?? [])]));
  const ecrits = new Set();
  let ajoutes = 0;
  let remplaces = 0;
  let inchanges = 0;
  for (const { champs } of apercu.lignes) {
    const table = parId.get(champs.table);
    if (table === undefined) throw new TypeError(`aperçu : la table ${champs.table} manque à la charge`);
    const objectif = {
      portee: champs.tour === null ? 'tous' : 'tour',
      tour: champs.tour,
      regle: champs.regle,
      etiquettes: rangees(champs.etiquettes),
    };
    const objectifs = table.objectifs ?? [];
    const rang = objectifs.findIndex(({ tour }) => tour === champs.tour);
    if (rang === -1) ajoutes += 1;
    else if (memesObjectifs(objectifs[rang], objectif)) inchanges += 1;
    else remplaces += 1;
    table.objectifs = [...objectifs.filter(({ tour }) => tour !== champs.tour), objectif].sort(ordreDesObjectifs);
    ecrits.add(cleDuCouple(champs.table, champs.tour));
  }
  let retires = 0;
  if (mode === 'remplacer') {
    for (const table of resultat.tables) {
      const gardes = (table.objectifs ?? []).filter(({ tour }) => ecrits.has(cleDuCouple(table.id, tour)));
      retires += (table.objectifs ?? []).length - gardes.length;
      table.objectifs = gardes;
    }
  }
  for (const table of resultat.tables) if (table.objectifs?.length === 0) delete table.objectifs;
  const tables = resultat.tables.filter((table) => JSON.stringify(table.objectifs ?? []) !== avant.get(table.id)).length;
  return {
    charge: resultat,
    resume: {
      ajoutes,
      remplaces,
      inchanges,
      retires,
      tables,
      refusees: structuredClone(apercu.refusees),
      derive: charge.evenement.etat === 'retenu',
    },
  };
}

// La cellule regle d'un objectif : 'ou', 'et', ou vide quand il suit le
// défaut ; toute autre valeur lève TypeError, qui nomme la table.
function celluleRegle(regle, numero) {
  if (regle === null) return '';
  if (regle === 'ou' || regle === 'et') return regle;
  throw new TypeError(`table ${numero}, regle : 'ou', 'et' ou null attendu, reçu ${JSON.stringify(regle) ?? String(regle)}`);
}

// La cellule objectif : les étiquettes jointes par JOINTURE_ETIQUETTES, dans
// l'ordre de leur liste ; une liste qui n'est pas de textes lève TypeError.
function celluleObjectif(etiquettes, numero) {
  if (!Array.isArray(etiquettes) || !etiquettes.every((motCle) => typeof motCle === 'string')) {
    throw new TypeError(`table ${numero}, etiquettes : liste de textes attendue, reçu ${JSON.stringify(etiquettes) ?? String(etiquettes)}`);
  }
  return etiquettes.join(JOINTURE_ETIQUETTES);
}

/**
 * Les objectifs des tables en CSV (§ 10.4), dans la forme exacte que
 * l'import lit : UTF-8 avec marque, « ; », CRLF ; l'en-tête
 * table;tour;objectif;regle ; puis une ligne par objectif, les tables par
 * numéro affiché puis identifiant croissant, et pour chacune la soirée puis
 * les tours croissants. Le tour s'écrit vide pour la soirée ; les étiquettes
 * jointes par « , », dans l'ordre de leur liste ; la règle ou, et, ou vide
 * quand l'objectif suit le défaut. Une valeur s'écrit telle quelle, même
 * quand un tableur la lirait comme une formule (export.js). Sans objectif,
 * l'en-tête seul. Les tables reçues ne sont pas modifiées.
 *
 * @param {Array<{id: number, numero: number, objectifs?: Array<{tour: number|null, regle: 'ou'|'et'|null, etiquettes: string[]}>}>} tables
 * @returns {Uint8Array}
 * @throws {TypeError} pour une règle hors de ou, et, null, ou des étiquettes
 *   qui ne sont pas une liste de textes, la table nommée par son numéro
 */
export function exporterObjectifs(tables) {
  const lignes = [...tables]
    .sort((a, b) => a.numero - b.numero || a.id - b.id)
    .flatMap(({ numero, objectifs = [] }) =>
      [...objectifs]
        .sort(ordreDesObjectifs)
        .map(({ tour, regle, etiquettes }) => [
          String(numero),
          tour === null ? '' : String(tour),
          celluleObjectif(etiquettes, numero),
          celluleRegle(regle, numero),
        ]),
    );
  return ecrireCsv([[...CHAMPS_OBJECTIFS], ...lignes], SEPARATEUR);
}
