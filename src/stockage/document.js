// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le document d'un événement (§ 4, § 6.1, § 8.1, § 8.8, § 9).
//
// SCHEMA décrit le fichier d'état en une seule table de règles : l'ordre des
// champs de chaque objet fait l'ordre des clés du texte canonique, et
// l'analyse parcourt la table pour contrôler la forme. Chaque règle porte
// aussi ce que canonique.js lit pour écrire : la mise en page et l'ordre des
// listes. Les formes sont décrites dans types.js. Ce parcours de la forme
// est le seul : premiereFaute le rend au contrôle des placements et aux
// correctifs, et premiereFauteEnPlace aux correctifs, pour le retenu posé à
// sa place.
//
// analyser lit un texte sans rien écrire et lève, à la première faute,
// ErreurStockage('ETAT_ILLISIBLE', { raison, chemin }), en contrôlant dans
// cet ordre : le texte vide (VIDE) ; le JSON (JSON) ; le format, lu avant
// tout le reste parce qu'il dit comment lire le reste (FORME s'il manque,
// FORMAT_INCONNU s'il n'est pas un entier ≥ 1) ; la forme de chaque champ,
// dans l'ordre du schéma puis des rangs (FORME) ; les identifiants des
// participants et des tables, et le tour des réservations (FORME) ; les
// comptes de la saisie dans l'en-tête — participants, tables, réservations,
// titres — (COMPTES) ; les références (REFERENCE). Les comptes des
// propositions et du retenu ne refusent jamais le fichier (§ 8.9, point 3) :
// ce que l'en-tête annonce sans que la charge le porte se rend à côté
// d'elle, et le dépôt l'annonce. Un fichier
// d'un format plus récent que FORMAT se lit réduit aux clés que le schéma
// connaît, et ce qui serait FORME au format courant y porte la raison
// FORMAT_PLUS_RECENT : la lecture ne le distingue pas d'une évolution du
// format. Ses comptes et ses références gardent leur raison, une
// corruption quel que soit le format ; tout refus d'un tel fichier porte le
// format lu dans ses détails, qui disent au dépôt d'où il vient. Le dépôt
// complète les détails — base, secours — et pose lui-même la raison ABSENT,
// quand le journal existe sans l'état. Des propositions et du retenu,
// l'analyse ne lit que le conteneur : leur forme, leur cohérence et leurs
// identifiants, comparés entre eux et à prochainsIds.proposition, sont
// l'affaire du contrôle des placements, qui écarte une proposition fautive
// et signale un retenu fautif sans refuser le fichier (§ 8.9, point 3).
//
// Les autres fonctions créent une charge ou dérivent d'elle la configuration
// du moteur, l'état qu'impose son contenu et la capacité d'une table. Aucune
// ne modifie ce qu'elle reçoit.
import { HISTORIQUE_PAR_DEFAUT } from '../moteur/recherche.js';
import { ErreurStockage } from './erreurs.js';

/** Version de format que ce code écrit (§ 8.8). */
export const FORMAT = 1;

/**
 * Réglages de génération d'une charge neuve : cinq propositions de 200 000
 * mouvements, valeurs de départ non mesurées (§ 5.10), et l'historique
 * d'acceptation que le moteur prend par défaut.
 */
export const GENERATION_PAR_DEFAUT = Object.freeze({ nombre: 5, arret: 200_000, historique: HISTORIQUE_PAR_DEFAUT });

// Une règle du schéma ; types.js en décrit les propriétés (Regle). Un objet
// porte ses champs, paires [clé, règle] dans l'ordre des clés, et l'ensemble
// de leurs clés ; une liste porte la règle de ses éléments.
function regle(genre, proprietes) {
  return Object.freeze({ genre, nul: false, ...proprietes });
}
const chaine = (options) => regle('chaine', options);
const entier = (min, max = Infinity, options = {}) => regle('entier', { min, max, ...options });
const parmi = (...valeurs) => regle('parmi', { valeurs: Object.freeze(valeurs) });
const liste = (element, options) => regle('liste', { element, ...options });
const objet = (champs, options) =>
  regle('objet', {
    champs: Object.freeze(champs.map((champ) => Object.freeze(champ))),
    cles: new Set(champs.map(([cle]) => cle)),
    ...options,
  });

const CHAINE = chaine();
const CHAINE_OU_NUL = chaine({ nul: true });
const BOOLEEN = regle('booleen');
const NOMBRE = regle('nombre');
// Un identifiant entier — d'un participant, d'une table, d'une proposition,
// ou de ce qu'une réservation, un titre ou un placement désigne — reste sous
// 2^31, dans un entier signé de 32 bits, la largeur des tableaux du moteur
// (Int32Array). Chaque compteur de prochainsIds, le prochain identifiant à
// attribuer, suit la même règle : relevé au-delà d'un identifiant lu, il
// reste ainsi loin de 2^53, où l'analyse ne le relirait plus. Au-delà, la
// valeur sort de sa règle.
const IDENTIFIANT = entier(1, 2 ** 31 - 1);
const DATE_OU_NUL = regle('date', { nul: true });

// Ordres des listes de la charge (§ 8.8, § 8.9). canonique.js range les
// copies canoniques des éléments : clés dans l'ordre du schéma, listes
// intérieures déjà rangées. Chaque ordre est total : deux éléments qu'il
// tient pour égaux s'écrivent pareil, et le tri rend la même liste quel que
// soit l'ordre reçu. Participants et tables se rangent par identifiant,
// unique sur une charge que l'analyse admet ; réservations et titres se
// comparent sur tous leurs champs ; une liste d'identifiants, par valeur.
const croissant = (a, b) => a - b;
const parIdentifiant = (a, b) => a.id - b.id;
// Deux chaînes, comparées unité UTF-16 par unité.
const comparerTextes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
// null avant tout entier, puis les entiers croissants.
const nulEnTete = (a, b) => (a === b ? 0 : a === null ? -1 : b === null ? 1 : a - b);
// La portée « tous » avant « tour », que l'ordre des chaînes inverserait.
const rangDePortee = (portee) => (portee === 'tous' ? 0 : 1);
const ordreDesReservations = (a, b) =>
  a.participant - b.participant ||
  a.table - b.table ||
  rangDePortee(a.portee) - rangDePortee(b.portee) ||
  nulEnTete(a.tour, b.tour) ||
  nulEnTete(a.siege, b.siege);
// Deux titres d'une même place se départagent par leur libellé.
const ordreDesTitres = (a, b) => a.table - b.table || a.siege - b.siege || comparerTextes(a.libelle, b.libelle);
// L'analyse n'examine des propositions que leur liste : deux d'entre elles
// peuvent partager un identifiant. À identifiant égal, la graine, le compte
// d'arrêt et l'historique les départagent, puis le JSON de leur copie
// canonique, qui ne coïncide que pour deux propositions écrites pareil.
const ordreDesPropositions = (a, b) =>
  a.id - b.id ||
  a.graine - b.graine ||
  a.arret - b.arret ||
  a.historique - b.historique ||
  comparerTextes(JSON.stringify(a), JSON.stringify(b));

const COMPTES = objet([
  ['participants', entier(0)],
  ['tables', entier(0)],
  ['reservations', entier(0)],
  ['titres', entier(0)],
  ['propositions', entier(0)],
  ['retenu', entier(0, 1)],
]);

const ENTETE = objet([
  ['format', entier(1)],
  ['produitVersion', CHAINE],
  ['revision', entier(1)],
  ['comptes', COMPTES],
]);

const FILIATION = objet(
  [
    ['source', objet([['id', CHAINE], ['nom', CHAINE]])],
    ['instant', objet([['revision', entier(1)], ['libelle', CHAINE]])],
  ],
  { nul: true },
);

const EVENEMENT = objet([
  ['id', CHAINE],
  ['nom', CHAINE],
  ['date', DATE_OU_NUL],
  ['siegesParDefaut', entier(2)],
  ['tours', entier(1)],
  ['unite', parmi('cm')],
  ['etat', parmi('brouillon', 'propose', 'retenu', 'bloque')],
  ['filiation', FILIATION],
]);

const REGLAGES = objet([
  ['separerAppartenances', BOOLEEN],
  ['nouveauxVoisins', BOOLEEN],
  ['nouvelleTable', BOOLEEN],
  ['varierAppartenances', BOOLEEN],
  ['attribuerSieges', BOOLEEN],
  ['generation', objet([['nombre', entier(1)], ['arret', entier(1)], ['historique', entier(1)]])],
]);

const PARTICIPANT = objet([
  ['id', IDENTIFIANT],
  ['nom', CHAINE],
  ['prenom', CHAINE_OU_NUL],
  ['appartenance', CHAINE_OU_NUL],
  ['courriel', CHAINE_OU_NUL],
  ['titrePressenti', CHAINE_OU_NUL],
  ['notes', CHAINE_OU_NUL],
  ['exclu', BOOLEEN],
]);

const TABLE = objet([
  ['id', IDENTIFIANT],
  ['numero', entier(1)],
  ['sieges', entier(2, undefined, { nul: true })],
  ['forme', parmi('ronde', 'carree')],
  ['position', objet([['x', NOMBRE], ['y', NOMBRE]])],
]);

const RESERVATION = objet([
  ['participant', IDENTIFIANT],
  ['table', IDENTIFIANT],
  ['siege', entier(1, undefined, { nul: true })],
  ['portee', parmi('tous', 'tour')],
  ['tour', entier(1, undefined, { nul: true })],
]);

const TITRE = objet([
  ['table', IDENTIFIANT],
  ['siege', entier(1)],
  ['libelle', CHAINE],
]);

// Le placement d'une proposition ou du retenu (§ 8.9) : un tour par élément,
// chacun sur sa ligne. sieges porte une liste d'identifiants par table
// déclarée, dans l'ordre des sièges. Quand l'objet qui porte le placement a
// siegesAttribues faux, cet ordre ne porte rien, et chaque liste se trie par
// identifiant croissant ; vrai, il est celui des sièges et se garde. reserve
// porte ceux qui ne sont assis nulle part à ce tour, un ensemble : elle se
// trie par identifiant croissant, quel que soit le drapeau.
const PLACEMENT = liste(
  objet([
    ['sieges', liste(liste(IDENTIFIANT, { triSansAttribution: croissant }))],
    ['reserve', liste(IDENTIFIANT, { tri: croissant })],
  ]),
  { mise: 'lignes' },
);

// Champs qu'une proposition et le retenu partagent, après ce qui les
// identifie : tables et capacités se correspondent rang à rang, et leur
// ordre se garde ; participants est l'ensemble des identifiants que le plan
// place, rangé par identifiant croissant.
const PLAN = [
  ['tables', liste(IDENTIFIANT)],
  ['capacites', liste(entier(2))],
  ['tours', entier(1)],
  ['participants', liste(IDENTIFIANT, { tri: croissant })],
  ['placement', PLACEMENT],
];

const PROPOSITION = objet(
  [
    ['id', IDENTIFIANT],
    ['graine', entier(0, 2 ** 32 - 1)],
    ['arret', entier(1)],
    ['historique', entier(1)],
    ['produitVersion', CHAINE],
    ['siegesAttribues', BOOLEEN],
    ...PLAN,
  ],
  { mise: 'ouverte' },
);

const RETENU = objet([['proposition', IDENTIFIANT], ['siegesAttribues', BOOLEEN], ...PLAN], {
  nul: true,
  mise: 'ouverte',
  aPart: true,
});

const CHARGE = objet(
  [
    ['evenement', EVENEMENT],
    ['reglages', REGLAGES],
    ['prochainsIds', objet([['participant', IDENTIFIANT], ['table', IDENTIFIANT], ['proposition', IDENTIFIANT]])],
    ['participants', liste(PARTICIPANT, { mise: 'lignes', tri: parIdentifiant })],
    ['tables', liste(TABLE, { mise: 'lignes', tri: parIdentifiant })],
    ['reservations', liste(RESERVATION, { mise: 'lignes', tri: ordreDesReservations })],
    ['titres', liste(TITRE, { mise: 'lignes', tri: ordreDesTitres })],
    ['propositions', liste(PROPOSITION, { mise: 'lignes', tri: ordreDesPropositions, aPart: true })],
    ['retenu', RETENU],
  ],
  { mise: 'lignes' },
);

/**
 * Le fichier d'état (§ 8.8) : l'en-tête, puis la charge. Une règle par
 * valeur, dont types.js décrit la forme (Regle) ; l'ordre des champs de
 * chaque objet est l'ordre des clés du texte canonique.
 * @type {import('./types.js').Regle}
 */
export const SCHEMA = objet([['entete', ENTETE], ['charge', CHARGE]], { mise: 'lignes' });

/**
 * Comptes de l'en-tête (§ 8.8) : pour chaque clé des comptes, la longueur de
 * la liste de la charge du même nom, et 0 ou 1 pour le retenu. Les clés
 * suivent l'ordre du schéma. canonique.js les écrit ; analyser les compare.
 *
 * @param {import('./types.js').Charge} charge
 * @returns {import('./types.js').Comptes}
 */
export function comptesDe(charge) {
  const comptes = {};
  for (const [cle] of COMPTES.champs) {
    const valeur = charge[cle];
    comptes[cle] = Array.isArray(valeur) ? valeur.length : valeur === null ? 0 : 1;
  }
  return comptes;
}

/**
 * Charge neuve (§ 4, § 9) : brouillon, ni participant ni table, aucune
 * proposition, identifiants attribués à partir de 1. Les réglages activent
 * les quatre contraintes, laissent les sièges non attribués et copient
 * GENERATION_PAR_DEFAUT. Chaque appel rend des objets neufs. Les arguments
 * ne sont pas contrôlés ici : ce contrôle appartient à la commande qui crée
 * l'événement.
 *
 * @param {{id: string, nom: string, date?: string|null, siegesParDefaut: number, tours: number}} evenement
 * @returns {import('./types.js').Charge}
 */
export function creerCharge({ id, nom, date = null, siegesParDefaut, tours }) {
  return {
    evenement: { id, nom, date, siegesParDefaut, tours, unite: 'cm', etat: 'brouillon', filiation: null },
    reglages: {
      separerAppartenances: true,
      nouveauxVoisins: true,
      nouvelleTable: true,
      varierAppartenances: true,
      attribuerSieges: false,
      generation: { ...GENERATION_PAR_DEFAUT },
    },
    prochainsIds: { participant: 1, table: 1, proposition: 1 },
    participants: [],
    tables: [],
    reservations: [],
    titres: [],
    propositions: [],
    retenu: null,
  };
}

const MARQUE_ORDRE_OCTETS = '\uFEFF';

// Lève le refus d'un état illisible ; plus ajoute ses détails après la
// raison et le chemin.
function illisible(raison, chemin, plus = {}) {
  throw new ErreurStockage('ETAT_ILLISIBLE', { raison, chemin, ...plus });
}

// Vrai pour un objet qui n'est ni null ni une liste.
const estObjet = (valeur) => typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);

// Chemin de la clé cle sous chemin : après un point quand elle s'écrit comme
// un identifiant, entre crochets en JSON sinon ; la racine est ''.
const IDENTIFIANT_JS = /^[A-Za-z_$][\w$]*$/;
function joindre(chemin, cle) {
  if (!IDENTIFIANT_JS.test(cle)) return `${chemin}[${JSON.stringify(cle)}]`;
  return chemin === '' ? cle : `${chemin}.${cle}`;
}

// AAAA-MM-JJ d'un jour du calendrier grégorien : mois de 1 à 12, jour de 1
// au dernier du mois, février à 29 jours les années bissextiles.
const AAAA_MM_JJ = /^(\d{4})-(\d{2})-(\d{2})$/;
const JOURS_PAR_MOIS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function estJour(texte) {
  const morceaux = AAAA_MM_JJ.exec(texte);
  if (morceaux === null) return false;
  const [annee, mois, jour] = morceaux.slice(1).map(Number);
  const bissextile = annee % 4 === 0 && (annee % 100 !== 0 || annee % 400 === 0);
  const dernier = mois === 2 && bissextile ? 29 : JOURS_PAR_MOIS[mois - 1];
  return mois >= 1 && mois <= 12 && jour >= 1 && jour <= dernier;
}

// Vrai quand valeur, non nulle, a le genre de sa règle et tient dans son
// domaine. Un entier du fichier est un entier exact, au plus 2^53 − 1 :
// au-delà, deux entiers distincts se lisent comme un seul, et la relecture
// rend un autre texte.
function conforme(valeur, { genre, min, max, valeurs }) {
  switch (genre) {
    case 'objet':
      return estObjet(valeur);
    case 'liste':
      return Array.isArray(valeur);
    case 'chaine':
      return typeof valeur === 'string' && valeur !== '';
    case 'entier':
      return Number.isSafeInteger(valeur) && valeur >= min && valeur <= max;
    case 'nombre':
      return Number.isFinite(valeur);
    case 'booleen':
      return typeof valeur === 'boolean';
    case 'parmi':
      return valeurs.includes(valeur);
    case 'date':
      return typeof valeur === 'string' && estJour(valeur);
  }
}

/**
 * Clés propres de l'objet valeur, rangées par unités UTF-16 croissantes :
 * leur ordre ne dépend que de leur ensemble, non de l'ordre dans lequel
 * l'objet les a reçues. C'est le seul parcours des clés d'un objet du
 * stockage : l'analyse y cherche une clé inconnue, et canonique.js recopie
 * ainsi ce que le schéma ne décrit pas.
 *
 * @param {Object} valeur
 * @returns {string[]}
 */
export function clesRangees(valeur) {
  return Object.keys(valeur).sort(comparerTextes);
}

// Plus petite des clés de valeur absentes de cles, en comparant les unités
// UTF-16, ou undefined.
const cleInconnue = (valeur, cles) => clesRangees(valeur).find((cle) => !cles.has(cle));

// Format du fichier lu, contrôlé avant toute autre règle : il dit comment
// lire le reste. Une racine qui n'est pas un objet, un en-tête ou un format
// absents sont des fautes de forme ; un format qui n'est pas un entier ≥ 1
// est inconnu.
function lireFormat(lu) {
  if (!estObjet(lu)) illisible('FORME', '');
  if (!estObjet(lu.entete)) illisible('FORME', 'entete');
  if (lu.entete.format === undefined) illisible('FORME', 'entete.format');
  const { format } = lu.entete;
  if (!Number.isSafeInteger(format) || format < 1) illisible('FORMAT_INCONNU', 'entete.format');
  return format;
}

// Valeur réduite aux clés que sa règle connaît, en profondeur, chaque objet
// refait dans l'ordre du schéma, propositions et retenu compris : la lecture
// d'un format plus récent ignore les clés qu'elle ne connaît pas, et un tel
// fichier ne se réécrit jamais. Une valeur qui n'a pas la sorte de sa règle
// passe telle quelle : le contrôle de forme la nomme.
function reduire(valeur, regleDeValeur) {
  if (regleDeValeur.genre === 'objet' && estObjet(valeur)) {
    const reduite = {};
    for (const [cle, regleDuChamp] of regleDeValeur.champs) {
      if (valeur[cle] !== undefined) reduite[cle] = reduire(valeur[cle], regleDuChamp);
    }
    return reduite;
  }
  if (regleDeValeur.genre === 'liste' && Array.isArray(valeur)) {
    return valeur.map((element) => reduire(element, regleDeValeur.element));
  }
  return valeur;
}

// Chemin de la première valeur qui sort de sa règle, ou null. Une règle
// aPart rencontrée sous une autre n'examine que son conteneur ; racine
// vrai fait examiner tout le contenu de la règle donnée, même aPart, et
// faux la lit à sa place sous une autre, comme l'analyse.
function fauteDeForme(valeur, regleDeValeur, chemin, racine) {
  if (valeur === null && regleDeValeur.nul) return null;
  if (!conforme(valeur, regleDeValeur)) return chemin;
  if (regleDeValeur.aPart && !racine) return null;
  if (regleDeValeur.genre === 'objet') {
    for (const [cle, regleDuChamp] of regleDeValeur.champs) {
      const faute = fauteDeForme(valeur[cle], regleDuChamp, joindre(chemin, cle), false);
      if (faute !== null) return faute;
    }
    const inconnue = cleInconnue(valeur, regleDeValeur.cles);
    return inconnue === undefined ? null : joindre(chemin, inconnue);
  }
  if (regleDeValeur.genre === 'liste') {
    for (let rang = 0; rang < valeur.length; rang += 1) {
      const faute = fauteDeForme(valeur[rang], regleDeValeur.element, `${chemin}[${rang}]`, false);
      if (faute !== null) return faute;
    }
  }
  return null;
}

/**
 * Chemin de la première valeur qui sort de sa règle, en profondeur, ou null
 * quand valeur est conforme ; ne lève jamais. D'un objet, chaque champ dans
 * l'ordre du schéma, puis la plus petite de ses clés inconnues ; d'une
 * liste, chaque élément dans l'ordre des rangs. null est conforme à une
 * règle qui l'admet. Un champ absent se lit undefined, qu'aucune règle
 * n'admet, et se nomme par son chemin comme une valeur fautive. Le chemin
 * suit la convention d'analyser, à partir de chemin, '' par défaut.
 *
 * Une règle aPart rencontrée sous une autre n'examine que son conteneur :
 * son contenu s'examine à part, la règle donnée ici pour racine. analyser
 * contrôle ainsi le fichier sans entrer dans les propositions ni dans le
 * retenu ; le contrôle des placements les examine chacun sous leur règle.
 *
 * @param {*} valeur
 * @param {import('./types.js').Regle} regle
 * @param {string} [chemin]
 * @returns {string|null}
 */
export function premiereFaute(valeur, regle, chemin = '') {
  return fauteDeForme(valeur, regle, chemin, true);
}

/**
 * premiereFaute de valeur lue à la place d'une règle regle sous une autre,
 * comme l'analyse la lit : une règle aPart n'y examine que son conteneur,
 * même donnée ici. Les correctifs contrôlent ainsi le retenu posé à sa
 * place, que la lecture admet hors de sa règle.
 *
 * @param {*} valeur
 * @param {import('./types.js').Regle} regle
 * @param {string} [chemin]
 * @returns {string|null}
 */
export function premiereFauteEnPlace(valeur, regle, chemin = '') {
  return fauteDeForme(valeur, regle, chemin, false);
}

// Identifiants des participants, puis des tables : chacun unique, et sous
// prochainsIds, qui ne recule jamais (§ 4) ; d'un doublon, le second est
// fautif. Ceux des propositions et la proposition d'origine du retenu ne se
// comparent pas ici : une proposition qui contredit prochainsIds.proposition
// tombe seule, et le retenu se signale sans fermer la saisie (§ 8.9, point
// 3). faute(chemin) lève l'écart.
function examinerIdentifiants({ prochainsIds, participants, tables }, faute) {
  for (const [cle, enregistrements, prochain] of [
    ['participants', participants, prochainsIds.participant],
    ['tables', tables, prochainsIds.table],
  ]) {
    const vus = new Set();
    enregistrements.forEach(({ id }, rang) => {
      if (id >= prochain || vus.has(id)) faute(`charge.${cle}[${rang}].id`);
      vus.add(id);
    });
  }
}

// Tour de chaque réservation : null pour la portée « tous », de 1 à R pour
// la portée « tour » ; faute(chemin) lève l'écart.
function examinerTours({ evenement, reservations }, faute) {
  reservations.forEach(({ portee, tour }, rang) => {
    const admis = portee === 'tous' ? tour === null : tour !== null && tour <= evenement.tours;
    if (!admis) faute(`charge.reservations[${rang}].tour`);
  });
}

// Comptes de l'en-tête qui portent sur les placements : une proposition ou
// un retenu perdus se recalculent, la saisie non.
const COMPTES_DES_PLACEMENTS = new Set(['propositions', 'retenu']);

// Chaque compte de la saisie dans l'en-tête contre la charge, dans l'ordre
// du schéma ; plus s'ajoute aux détails du refus. Rend ce que les comptes
// des placements annoncent sans que la charge le porte : propositions, le
// nombre annoncé au-delà de la liste ; retenu, vrai quand il est annoncé et
// absent. Un compte plus petit que sa liste ne dit pas quelle proposition
// est en trop : la liste se lit telle quelle.
function examinerComptes(comptes, charge, plus) {
  const reels = comptesDe(charge);
  for (const [cle] of COMPTES.champs) {
    if (COMPTES_DES_PLACEMENTS.has(cle)) continue;
    if (comptes[cle] !== reels[cle]) illisible('COMPTES', `entete.comptes.${cle}`, plus);
  }
  return {
    propositions: Math.max(0, comptes.propositions - reels.propositions),
    retenu: comptes.retenu > reels.retenu,
  };
}

// Références des réservations, puis des titres : la personne et la table
// désignées existent, et le siège, quand il est donné, tient dans la
// capacité courante de la table (§ 6.2). La réservation d'une personne
// exclue reste admise : elle est suspendue, non fautive (§ 4.4). plus
// s'ajoute aux détails du refus.
function examinerReferences(charge, plus) {
  const personnes = new Set(charge.participants.map(({ id }) => id));
  const tables = new Map(charge.tables.map((table) => [table.id, table]));
  const examinerPlace = ({ table, siege }, chemin) => {
    const designee = tables.get(table);
    if (designee === undefined) illisible('REFERENCE', `${chemin}.table`, plus);
    if (siege !== null && siege > capacite(charge, designee)) illisible('REFERENCE', `${chemin}.siege`, plus);
  };
  charge.reservations.forEach((reservation, rang) => {
    const chemin = `charge.reservations[${rang}]`;
    if (!personnes.has(reservation.participant)) illisible('REFERENCE', `${chemin}.participant`, plus);
    examinerPlace(reservation, chemin);
  });
  charge.titres.forEach((titre, rang) => examinerPlace(titre, `charge.titres[${rang}]`));
}

/**
 * Lit le texte d'un fichier d'état, sans rien écrire (§ 8.4, § 8.8). Une
 * marque d'ordre d'octets en tête est ignorée. Rend l'en-tête, la charge,
 * formatPlusRecent, vrai quand le format dépasse FORMAT, et manquants, ce que
 * les comptes des propositions et du retenu annoncent sans que la charge le
 * porte, qui ne refuse jamais le fichier (§ 8.9, point 3). Au format courant,
 * l'en-tête et la charge sont ceux que le texte porte, ni copiés ni triés :
 * canoniser les met dans l'ordre canonique. Un fichier d'un format plus
 * récent s'ouvre en lecture seule et ne se réécrit jamais : l'en-tête et la
 * charge rendus sont des copies réduites aux clés que le schéma connaît, et
 * une faute de forme y porte la raison FORMAT_PLUS_RECENT ; les comptes et
 * les références gardent leur raison, et chaque refus porte le format lu
 * dans ses détails. Des propositions et du retenu, seul le conteneur se
 * contrôle ici : examiner (placements.js) juge le reste, identifiants
 * compris, sans refuser le fichier (§ 8.9, point 3).
 *
 * Lève ErreurStockage('ETAT_ILLISIBLE', { raison, chemin }), et format
 * pour un fichier plus récent, à la première faute, dans l'ordre que donne
 * l'en-tête du module. chemin désigne l'élément fautif : clés séparées par
 * un point, rangs entre crochets, une clé qui ne s'écrit pas comme un
 * identifiant entre crochets en JSON ; '' pour la racine ; null quand le
 * texte n'a rien à désigner (VIDE, JSON). D'un objet, un champ du schéma
 * fautif est nommé avant une clé inconnue, et de plusieurs clés inconnues,
 * la plus petite.
 *
 * @param {string} texte
 * @returns {import('./types.js').Lecture}
 */
export function analyser(texte) {
  const sansMarque = texte.startsWith(MARQUE_ORDRE_OCTETS) ? texte.slice(1) : texte;
  if (sansMarque.trim() === '') illisible('VIDE', null);
  let lu;
  try {
    lu = JSON.parse(sansMarque);
  } catch {
    illisible('JSON', null);
  }
  const format = lireFormat(lu);
  const formatPlusRecent = format > FORMAT;
  // Tout refus d'un fichier plus récent porte le format lu.
  const plus = formatPlusRecent ? { format } : {};
  const fichier = formatPlusRecent ? reduire(lu, SCHEMA) : lu;
  const faute = (chemin) => illisible(formatPlusRecent ? 'FORMAT_PLUS_RECENT' : 'FORME', chemin, plus);
  const cheminFautif = premiereFaute(fichier, SCHEMA);
  if (cheminFautif !== null) faute(cheminFautif);
  const { entete, charge } = fichier;
  examinerIdentifiants(charge, faute);
  examinerTours(charge, faute);
  const manquants = examinerComptes(entete.comptes, charge, plus);
  examinerReferences(charge, plus);
  return { entete, charge, formatPlusRecent, manquants };
}

/**
 * Configuration du moteur tirée d'une charge : les participants avec leur
 * appartenance et leur exclusion ; les tables avec leur capacité courante ;
 * le nombre de tours ; les réservations sans leur siège, que le moteur ne
 * lit pas, et sans tour pour la portée « tous » ; les quatre contraintes des
 * réglages. Les tables vont par identifiant croissant, l'ordre du texte
 * canonique : le moteur assoit table après table, et une charge aux tables
 * dans un autre ordre, relue après un enregistrement, ne régénérerait plus
 * ses propositions (§ 8.9). Les participants et les réservations gardent
 * l'ordre de la charge : le rang d'une réservation que nomme une
 * ErreurConfiguration est son rang dans la charge.
 *
 * @param {import('./types.js').Charge} charge
 * @returns {import('../moteur/types.js').Configuration}
 */
export function configurationDepuisCharge(charge) {
  const { evenement, reglages } = charge;
  return {
    participants: charge.participants.map(({ id, nom, appartenance, exclu }) => ({ id, nom, appartenance, exclu })),
    tables: [...charge.tables]
      .sort((a, b) => a.id - b.id)
      .map((table) => ({ id: table.id, numero: table.numero, capacite: capacite(charge, table) })),
    tours: evenement.tours,
    reservations: charge.reservations.map(({ participant, table, portee, tour }) =>
      portee === 'tous' ? { participant, table, portee } : { participant, table, portee, tour },
    ),
    contraintes: {
      separerAppartenances: reglages.separerAppartenances,
      nouveauxVoisins: reglages.nouveauxVoisins,
      nouvelleTable: reglages.nouvelleTable,
      varierAppartenances: reglages.varierAppartenances,
    },
  };
}

/**
 * État que le contenu impose à une copie (§ 8.7, § 9) : retenu quand un
 * placement est retenu, proposé quand des propositions existent, brouillon
 * sinon. L'état inscrit dans l'événement n'est pas lu : la copie d'un plan
 * bloqué n'est pas bloquée.
 *
 * @param {import('./types.js').Charge} charge
 * @returns {'brouillon'|'propose'|'retenu'}
 */
export function etatDeduit({ retenu, propositions }) {
  if (retenu !== null) return 'retenu';
  return propositions.length > 0 ? 'propose' : 'brouillon';
}

/**
 * Capacité courante d'une table (§ 6.1) : ses sièges quand elle est
 * surchargée, le défaut de l'événement quand elle le suit (sieges null).
 * table est l'enregistrement de charge.tables : un identifiant lève
 * TypeError, au lieu de rendre le défaut sans bruit.
 *
 * @param {import('./types.js').Charge} charge
 * @param {import('./types.js').Table} table
 * @returns {number}
 */
export function capacite(charge, table) {
  if (!estObjet(table)) {
    throw new TypeError(`capacite : enregistrement de table attendu, reçu ${JSON.stringify(table)}`);
  }
  return table.sieges ?? charge.evenement.siegesParDefaut;
}
