// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

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
// participants et des tables, le tour des réservations, la portée et le tour
// des objectifs de table, l'ordre des priorités sous le mode des objectifs,
// les titres répétés à l'identique et la présence de chaque personne
// (FORME) ; les
// comptes de la saisie dans l'en-tête — participants, tables, réservations,
// titres — (COMPTES) ; les références (REFERENCE). Les comptes des
// propositions et du retenu ne refusent jamais le fichier (§ 8.9, point 3) :
// ce que l'en-tête annonce sans que la charge le porte se rend à côté d'elle,
// et le dépôt l'annonce. Un fichier d'un format plus récent que FORMAT se lit
// réduit aux clés que le schéma connaît, et ce qui serait FORME au format
// courant y porte la raison FORMAT_PLUS_RECENT : la lecture ne le distingue
// pas d'une évolution du format. Ses comptes et ses références gardent leur
// raison, une corruption quel que soit le format ; tout refus d'un tel
// fichier porte le format lu dans ses détails, qui disent au dépôt d'où il
// vient. Le dépôt complète les détails — base, secours — et pose lui-même la
// raison ABSENT, quand le journal existe sans l'état. Des propositions et du
// retenu, l'analyse ne lit que le conteneur : leur forme, leur cohérence et
// leurs identifiants, comparés entre eux et à prochainsIds.proposition, sont
// l'affaire du contrôle des placements, qui écarte une proposition fautive et
// signale un retenu fautif sans refuser le fichier (§ 8.9, point 3).
//
// Un fichier d'un format plus ancien se lit comme un fichier du format
// courant : chaque format n'ajoute au précédent que des champs facultatifs
// (§ 8.8, § 8.9). Le format 2 ajoute les étiquettes des personnes, leur
// présence par tour (presence, absente quand la personne est présente à tous
// les tours), les objectifs des tables, cinq réglages, chacun absent à son
// défaut, la dérivation d'une proposition, depart et toursFiges, absente
// hors dérivation, et les absents de chaque tour d'un placement (absents,
// absente quand le tour n'en a pas) ; un fichier du format 1 ne les porte
// pas, et se lit sans conversion. Il ne se réécrit qu'au premier geste, au
// format courant.
//
// Une clé que les réglages ont portée et ne portent plus — la cible de la
// somme de redondance, cibleRedondance — est oubliée (oubliees de la règle
// des réglages) : un fichier qui la porte se lit sans faute, quelle que soit
// sa valeur, la charge rendue ne la porte pas, et le premier geste écrit le
// fichier sans elle. Un correctif du journal qui la pose ou la retire
// s'applique sans rien changer (correctifs.js).
//
// Les autres fonctions créent une charge ou dérivent d'elle la configuration
// du moteur, l'état qu'impose son contenu, la capacité d'une table et la
// valeur d'un réglage facultatif. Aucune ne modifie ce qu'elle reçoit.
import { CRITERES, POIDS_MAX, PRIORITES_PAR_DEFAUT, completerPriorites, verifierPriorites } from '../moteur/criteres.js';
import { HISTORIQUE_PAR_DEFAUT } from '../moteur/recherche.js';
import { ETIQUETTES_MAX, estEtiquetteBienFormee } from './etiquettes.js';
import { ErreurStockage } from './erreurs.js';

/**
 * Version de format que ce code écrit (§ 8.8). Le format 2 ajoute au format
 * 1 des champs facultatifs seulement (§ 8.9), la présence par tour d'une
 * personne (presence) et les absents d'un tour de placement (absents)
 * compris : un fichier du format 1 se lit comme un fichier du format 2 qui
 * n'en porte aucun.
 */
export const FORMAT = 2;

/**
 * Le plus grand nombre de places d'une table, au défaut comme en surcharge
 * (§ 6.2). Le plan dessine une chaise par place, et l'état des places en
 * construit une par place et par table à chaque rendu : une capacité saisie
 * au-delà rendrait l'événement inaffichable sans rien apporter — à 60 cm par
 * place (§ 7.7), 1 000 places font une table ronde de 191 m de diamètre.
 * L'analyse refuse au-delà, et les commandes refusent la saisie.
 */
export const SIEGES_MAX = 1000;

/**
 * Le plus grand nombre de tours d'une soirée (§ 2.1, étape 5). Le moteur
 * réserve une case par participant et par tour dans ses tableaux, et le
 * placement écrit une liste par table et par tour : cent tours de vingt
 * minutes durent plus d'un jour. L'analyse refuse au-delà, et la commande
 * refuse la saisie.
 */
export const TOURS_MAX = 100;

/**
 * Réglages de génération d'une charge neuve : cinq propositions de 200 000
 * mouvements, valeurs de départ non mesurées (§ 5.10), et l'historique
 * d'acceptation que le moteur prend par défaut.
 */
export const GENERATION_PAR_DEFAUT = Object.freeze({ nombre: 5, arret: 200_000, historique: HISTORIQUE_PAR_DEFAUT });

// AAAA-MM-JJTHH:MM:SS±HH:MM, la forme que rend l'horloge de l'application.
// Le calendrier ne se contrôle pas : un horodatage ne décide d'aucun ordre.
const HORODATAGE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;

/**
 * Vrai pour une chaîne de la forme AAAA-MM-JJTHH:MM:SS±HH:MM, celle que rend
 * l'horloge de l'application : la forme d'un horodatage, que le placement
 * daté, le journal et le verrou partagent. Ni le calendrier ni les bornes
 * des heures ne se contrôlent ici. Elle vit dans ce module : le schéma en a
 * besoin dès son évaluation, et ce module ne peut importer le journal, qui
 * lit le schéma dès la sienne ; le journal la réexporte, et le code qui
 * n'est pas le schéma la prend de lui.
 *
 * @param {unknown} valeur
 * @returns {boolean}
 */
export const estHorodatage = (valeur) => typeof valeur === 'string' && HORODATAGE.test(valeur);

// Une règle du schéma ; types.js en décrit les propriétés (Regle). Un objet
// porte ses champs, paires [clé, règle] dans l'ordre des clés, et l'ensemble
// de leurs clés, et peut nommer des clés oubliées (oubliees), admises de
// toute valeur et jamais copiées ; une liste porte la règle de ses éléments,
// et peut borner sa longueur (min, max), exiger des éléments distincts
// (distincts) ou strictement croissants (croissante), un ordre que l'écriture
// garde sans trier. Un champ facultatif (optionnel) peut manquer à son objet :
// absent, il ne s'écrit pas, et sa valeur par défaut se lit par la fonction
// qui le nomme.
function regle(genre, proprietes) {
  return Object.freeze({ genre, nul: false, optionnel: false, ...proprietes });
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
// L'occupant d'un siège dans une liste de table d'un placement :
// l'identifiant d'une personne, ou null, le marqueur d'une chaise vide
// (§ 8.9). Ses bornes sont celles d'IDENTIFIANT, dont la règle se recopie,
// null admis. La règle admet null à toute place d'une telle liste ; le
// contrôle des placements (placements.js) ne l'admet que sous des sièges
// attribués, et jamais en fin de liste.
const OCCUPANT = regle('entier', { ...IDENTIFIANT, nul: true });
const DATE_OU_NUL = regle('date', { nul: true });
// L'instant où un placement a pris sa forme courante (§ 8.9) : facultatif,
// absent quand il est inconnu, null refusé comme toute autre forme.
const HORODATAGE_FACULTATIF = regle('horodatage', { optionnel: true });

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
// Les objectifs d'une table : la soirée, puis les tours croissants (§ 8.9).
// Deux objectifs d'une même portée et d'un même tour, que l'analyse refuse,
// se départagent par le JSON de leur copie canonique : l'ordre reste total.
const ordreDesObjectifs = (a, b) =>
  rangDePortee(a.portee) - rangDePortee(b.portee) ||
  nulEnTete(a.tour, b.tour) ||
  comparerTextes(JSON.stringify(a), JSON.stringify(b));
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
  ['siegesParDefaut', entier(2, SIEGES_MAX)],
  ['tours', entier(1, TOURS_MAX)],
  ['unite', parmi('cm')],
  ['etat', parmi('brouillon', 'propose', 'retenu', 'bloque')],
  ['filiation', FILIATION],
]);

// Les étiquettes d'une personne ou d'un objectif (§ 4.5, § 8.9) : une liste
// non vide d'au plus ETIQUETTES_MAX étiquettes bien formées, sans doublon
// exact, rangée par unités de code à l'écriture. Le genre etiquettes est
// celui d'une seule étiquette (estEtiquetteBienFormee). Deux orthographes
// d'une même clé normalisée restent admises : un fichier retouché à la main
// peut les porter, et le moteur les tient pour deux (§ 4.5).
const ETIQUETTES = liste(regle('etiquettes'), { min: 1, max: ETIQUETTES_MAX, distincts: true, tri: comparerTextes });

// Un objectif de table (§ 4.5) : sa portée, son tour — null sous « tous »,
// de 1 à R sous « tour », que l'analyse compare au nombre de tours —, sa
// règle propre, null quand il suit le défaut de l'événement, et ses
// étiquettes.
const OBJECTIF = objet([
  ['portee', parmi('tous', 'tour')],
  ['tour', entier(1, undefined, { nul: true })],
  ['regle', regle('parmi', { valeurs: Object.freeze(['ou', 'et']), nul: true })],
  ['etiquettes', ETIQUETTES],
]);

// Un champ facultatif présent seulement hors de son défaut (§ 8.9) : la
// liste fermée des valeurs qu'il admet, le défaut exclu ; écrit à son
// défaut, il est une faute de forme.
const horsDuDefaut = (...valeurs) => regle('parmi', { valeurs: Object.freeze(valeurs), optionnel: true });

// Les critères d'un palier de priorités se rangent dans l'ordre du registre
// (A16) ; à critère égal, que l'analyse refuse, le poids puis le JSON les
// départagent : l'ordre reste total.
const rangDuCritere = (nom) => CRITERES.indexOf(nom);
const ordreDansLePalier = (a, b) =>
  rangDuCritere(a.critere) - rangDuCritere(b.critere) ||
  a.poids - b.poids ||
  comparerTextes(JSON.stringify(a), JSON.stringify(b));

// L'ordre des priorités (§ 5.7, A16) : une liste non vide de paliers, chacun
// une liste non vide d'entrées {critere, poids}, le critère nommé par le
// registre, le poids entier de 1 à POIDS_MAX ; chaque palier s'écrit rangé.
// La répétition, l'absence, les critères seuls à leur palier sous le mode
// des objectifs et l'ordre par défaut écrit se jugent sur la charge entière
// (examinerPriorites).
const PRIORITES = liste(
  liste(objet([['critere', parmi(...CRITERES)], ['poids', entier(1, POIDS_MAX)]]), { min: 1, tri: ordreDansLePalier }),
  { min: 1, optionnel: true },
);

// La cible de la somme de redondance (cibleRedondance), un réglage que les
// fichiers ont porté : oubliée, elle se lit de toute valeur et ne s'écrit
// plus.
const REGLAGES = objet(
  [
    ['separerAppartenances', BOOLEEN],
    ['nouveauxVoisins', BOOLEEN],
    ['nouvelleTable', BOOLEEN],
    ['varierAppartenances', BOOLEEN],
    ['attribuerSieges', BOOLEEN],
    ['generation', objet([['nombre', entier(1)], ['arret', entier(1)], ['historique', entier(1)]])],
    // Facultatifs, en dernier, dans l'ordre de A16 : un fichier qui n'en
    // porte aucun s'écrit sans eux, au numéro de format près. La règle par
    // défaut des objectifs, « et » seulement (regleObjectifs) ; la case des
    // objectifs, décochée seulement (respecterObjectifs) ; le mode des
    // objectifs hors du plus de places servies (modeObjectifs) ; la case des
    // animateurs, cochée seulement (rencontrerAnimateurs) ; l'ordre des
    // priorités hors de l'ordre par défaut (priorites).
    ['regleObjectifs', horsDuDefaut('et')],
    ['respecterObjectifs', horsDuDefaut(false)],
    ['modeObjectifs', horsDuDefaut('chacun', 'minimum')],
    ['rencontrerAnimateurs', horsDuDefaut(true)],
    ['priorites', PRIORITES],
  ],
  { oubliees: new Set(['cibleRedondance']) },
);

const PARTICIPANT = objet([
  ['id', IDENTIFIANT],
  ['nom', CHAINE],
  ['prenom', CHAINE_OU_NUL],
  ['appartenance', CHAINE_OU_NUL],
  ['courriel', CHAINE_OU_NUL],
  ['titrePressenti', CHAINE_OU_NUL],
  ['notes', CHAINE_OU_NUL],
  ['exclu', BOOLEEN],
  // Facultatifs, en dernier. etiquettes absent : la personne ne porte aucune
  // étiquette. presence absent : la personne est présente à tous les tours
  // (src/moteur/presence.js) ; présent, les tours où elle l'est, une liste
  // non vide d'entiers distincts de 1 à TOURS_MAX, rangée croissante à
  // l'écriture ; examinerPresences la compare au nombre de tours.
  ['etiquettes', regle('liste', { ...ETIQUETTES, optionnel: true })],
  ['presence', liste(entier(1, TOURS_MAX), { min: 1, distincts: true, tri: croissant, optionnel: true })],
]);

const TABLE = objet([
  ['id', IDENTIFIANT],
  ['numero', entier(1)],
  ['sieges', entier(2, SIEGES_MAX, { nul: true })],
  ['forme', parmi('ronde', 'carree')],
  ['position', objet([['x', NOMBRE], ['y', NOMBRE]])],
  // Facultatif, en dernier : absent, la table n'a aucun objectif. Présent,
  // une liste non vide, la soirée d'abord, puis les tours croissants.
  ['objectifs', liste(OBJECTIF, { min: 1, tri: ordreDesObjectifs, optionnel: true })],
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
// chacun sur sa ligne. sieges porte une liste d'occupants par table
// déclarée, dans l'ordre des sièges. Quand l'objet qui porte le placement a
// siegesAttribues faux, cet ordre ne porte rien, et chaque liste se trie par
// identifiant croissant ; vrai, il est celui des sièges et se garde : le
// siège est le rang dans la liste, et une chaise vide avant le dernier
// occupant, siège 1 compris, y porte null. Une liste qui ne finit jamais
// par null a ainsi une seule écriture, que le tri ne touche pas. reserve
// porte ceux qui sont présents à ce tour sans être assis, un ensemble : elle
// se trie par identifiant croissant, quel que soit le drapeau. absents,
// facultatif, porte ceux qui sont absents à ce tour, un ensemble non vide
// rangé de même ; il manque quand le tour n'a pas d'absent, et le tour
// s'écrit alors octet pour octet comme avant qu'il existe.
const PLACEMENT = liste(
  objet([
    ['sieges', liste(liste(OCCUPANT, { triSansAttribution: croissant }))],
    ['reserve', liste(IDENTIFIANT, { tri: croissant })],
    ['absents', liste(IDENTIFIANT, { min: 1, tri: croissant, optionnel: true })],
  ]),
  { mise: 'lignes' },
);

// Champs qu'une proposition et le retenu partagent, après ce qui les
// identifie : tables et capacités se correspondent rang à rang, et leur
// ordre se garde ; participants est l'ensemble des identifiants que le plan
// place, rangé par identifiant croissant. horodatage, facultatif et en
// dernier, date le placement : pour le retenu, l'instant où il a pris sa
// forme courante ; pour une proposition, celui de la génération qui l'a
// produite. Absent, l'objet s'écrit octet pour octet comme avant qu'il
// existe.
const PLAN = [
  ['tables', liste(IDENTIFIANT)],
  ['capacites', liste(entier(2))],
  ['tours', entier(1)],
  ['participants', liste(IDENTIFIANT, { tri: croissant })],
  ['placement', PLACEMENT],
  ['horodatage', HORODATAGE_FACULTATIF],
];

// Ce qui identifie une proposition, au-delà de son identifiant : la graine,
// le compte d'arrêt et l'historique de la recherche qui l'a produite. Le
// compagnon des courses reconnaît une proposition à ces quatre champs, à
// l'horodatage de sa génération et à l'empreinte de son placement
// (ENTREE_DE_COURSE).
const IDENTITE = [
  ['id', IDENTIFIANT],
  ['graine', entier(0, 2 ** 32 - 1)],
  ['arret', entier(1)],
  ['historique', entier(1)],
];

// La dérivation d'une proposition (§ 5.7, § 8.9), juste après son identité :
// depart, l'identifiant de la proposition d'où sa recherche est partie ;
// toursFiges, les numéros des tours repris de son départ, une liste non
// vide d'entiers ≥ 1 strictement croissante, écrite dans l'ordre reçu.
// Facultatifs, absents hors dérivation, toursFiges absent d'une dérivée sans
// tour figé : une proposition qui n'est pas dérivée s'écrit octet pour octet
// sans eux. Hors d'IDENTITE, que partage l'entrée du compagnon des courses,
// dont la clé ne les lit pas. Le retenu ne les porte pas. Les fautes qui les
// croisent à l'identifiant et aux tours déclarés sont l'affaire du contrôle
// des placements (fautes, DERIVATION).
const CHAMPS_DE_DERIVATION = [
  ['depart', regle('entier', { ...IDENTIFIANT, optionnel: true })],
  ['toursFiges', liste(entier(1), { min: 1, croissante: true, optionnel: true })],
];

const PROPOSITION = objet(
  [...IDENTITE, ...CHAMPS_DE_DERIVATION, ['produitVersion', CHAINE], ['siegesAttribues', BOOLEEN], ...PLAN],
  { mise: 'ouverte' },
);

const RETENU = objet([['proposition', IDENTIFIANT], ['siegesAttribues', BOOLEEN], ...PLAN], {
  nul: true,
  mise: 'ouverte',
  aPart: true,
});

/**
 * Une entrée du compagnon des courses (§ 5.10, § 8.9), qui n'est pas le
 * fichier d'état : l'identité d'une proposition, sous les règles mêmes de
 * la proposition, puis horodatage, celui de la génération qui l'a
 * produite, facultatif et absent quand la proposition n'en porte pas, puis
 * empreinte, celle du texte canonique de son placement (courses.js), un
 * entier de 0 à 2^53 − 1, puis course, ce que la recherche a rapporté
 * d'elle-même.
 * course porte evalues, ses mouvements évalués, puis releves, un point de
 * relevé {mouvements, placement} par puissance de dix strictement
 * inférieure à evalues, le placement sous la forme de celui d'une
 * proposition. Aucune autre clé : ni valeur mesurée, ni durée. Les
 * contraintes qui croisent la course et la proposition — evalues au plus
 * arret, abscisses 1, 10, 100…, placements cohérents avec la déclaration —
 * sont l'affaire du contrôle des placements (fauteDeCourse). La règle
 * contrôle la forme ; elle n'écrit rien : courses.js écrit le compagnon.
 * @type {import('./types.js').Regle}
 */
export const ENTREE_DE_COURSE = objet([
  ...IDENTITE,
  ['horodatage', HORODATAGE_FACULTATIF],
  ['empreinte', entier(0, Number.MAX_SAFE_INTEGER)],
  [
    'course',
    objet([
      ['evalues', entier(0)],
      ['releves', liste(objet([['mouvements', entier(1)], ['placement', PLACEMENT]]))],
    ]),
  ],
]);

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
// rend un autre texte. Une liste tient dans ses bornes de longueur quand sa
// règle en porte, et ne répète aucun élément quand elle les veut distincts.
function conforme(valeur, { genre, min, max, valeurs, distincts }) {
  switch (genre) {
    case 'objet':
      return estObjet(valeur);
    case 'liste':
      return (
        Array.isArray(valeur) &&
        valeur.length >= (min ?? 0) &&
        valeur.length <= (max ?? Infinity) &&
        (distincts !== true || new Set(valeur).size === valeur.length)
      );
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
    case 'horodatage':
      return estHorodatage(valeur);
    case 'etiquettes':
      return estEtiquetteBienFormee(valeur);
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

// Plus petite des clés de valeur que la règle objet ne connaît pas — ni
// l'une de ses clés, ni l'une de ses clés oubliées —, en comparant les
// unités UTF-16, ou undefined.
const cleInconnue = (valeur, { cles, oubliees }) =>
  clesRangees(valeur).find((cle) => !cles.has(cle) && oubliees?.has(cle) !== true);

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

// Vrai quand chaque élément de valeur, une liste de nombres, dépasse le
// précédent.
const strictementCroissante = (valeur) => valeur.every((element, rang) => rang === 0 || element > valeur[rang - 1]);

// Étapes menant à la première valeur qui sort de sa règle, de la plus
// profonde vers valeur — une clé d'objet, une chaîne, ou un rang de liste,
// un nombre —, [] quand c'est valeur elle-même, ou null quand rien ne sort
// de sa règle. Une règle aPart rencontrée sous une autre n'examine que son
// conteneur ; racine vrai fait examiner tout le contenu de la règle donnée,
// même aPart, et faux la lit à sa place sous une autre, comme l'analyse.
// L'ordre d'une liste croissante se contrôle après ses éléments : un
// élément hors de sa règle se nomme par son rang, un ordre rompu par la
// liste. Le parcours d'une valeur conforme ne forme aucun texte ni aucune
// liste d'étapes : la liste naît à la faute, et chaque niveau y ajoute la
// sienne en remontant.
function etapesDeLaFaute(valeur, regleDeValeur, racine) {
  if (valeur === undefined && regleDeValeur.optionnel) return null;
  if (valeur === null && regleDeValeur.nul) return null;
  if (!conforme(valeur, regleDeValeur)) return [];
  if (regleDeValeur.aPart && !racine) return null;
  if (regleDeValeur.genre === 'objet') {
    for (const [cle, regleDuChamp] of regleDeValeur.champs) {
      const etapes = etapesDeLaFaute(valeur[cle], regleDuChamp, false);
      if (etapes !== null) {
        etapes.push(cle);
        return etapes;
      }
    }
    const inconnue = cleInconnue(valeur, regleDeValeur);
    return inconnue === undefined ? null : [inconnue];
  }
  if (regleDeValeur.genre === 'liste') {
    const { element } = regleDeValeur;
    if (element.genre === 'entier') {
      // Une liste d'entiers — identifiants, occupants, tours — se lit d'une
      // boucle qui déplie, pour le genre entier, les contrôles ci-dessus :
      // facultatif, null, puis le cas entier de conforme, qu'elle recopie et
      // doit suivre. Un entier n'a pas de contenu : aPart n'y change rien.
      const { optionnel, nul, min, max } = element;
      for (let rang = 0; rang < valeur.length; rang += 1) {
        const v = valeur[rang];
        if ((v === undefined && optionnel) || (v === null && nul)) continue;
        if (!(Number.isSafeInteger(v) && v >= min && v <= max)) return [rang];
      }
    } else {
      for (let rang = 0; rang < valeur.length; rang += 1) {
        const etapes = etapesDeLaFaute(valeur[rang], element, false);
        if (etapes !== null) {
          etapes.push(rang);
          return etapes;
        }
      }
    }
    if (regleDeValeur.croissante === true && !strictementCroissante(valeur)) return [];
  }
  return null;
}

// Chemin de la première valeur qui sort de sa règle, à partir de chemin, ou
// null (etapesDeLaFaute). Les étapes se joignent de la racine vers la
// faute : une clé par joindre, un rang entre crochets.
function fauteDeForme(valeur, regleDeValeur, chemin, racine) {
  const etapes = etapesDeLaFaute(valeur, regleDeValeur, racine);
  if (etapes === null) return null;
  return etapes.reduceRight(
    (deja, etape) => (typeof etape === 'number' ? `${deja}[${etape}]` : joindre(deja, etape)),
    chemin,
  );
}

/**
 * Chemin de la première valeur qui sort de sa règle, en profondeur, ou null
 * quand valeur est conforme ; ne lève jamais. D'un objet, chaque champ dans
 * l'ordre du schéma, puis la plus petite de ses clés inconnues — une clé
 * oubliée de sa règle n'en est pas une, quelle que soit sa valeur ; d'une
 * liste, chaque élément dans l'ordre des rangs, puis, quand sa règle la veut
 * croissante, son ordre, nommé par le chemin de la liste. null est conforme à une
 * règle qui l'admet. Un champ absent se lit undefined, qu'admet seule une
 * règle facultative ; ailleurs, il se nomme par son chemin comme une valeur
 * fautive. Le chemin
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

// Titres : deux titres de même table, même siège et même libellé
// s'écriraient pareil et ne se distingueraient sur aucun écran ; le second
// est fautif. Deux libellés à une même place restent admis (§ 4.1).
// faute(chemin) lève l'écart.
function examinerTitres({ titres }, faute) {
  const vus = new Set();
  titres.forEach(({ table, siege, libelle }, rang) => {
    const cle = JSON.stringify([table, siege, libelle]);
    if (vus.has(cle)) faute(`charge.titres[${rang}]`);
    vus.add(cle);
  });
}

// Tour de chaque réservation : null pour la portée « tous », de 1 à R pour
// la portée « tour » ; faute(chemin) lève l'écart.
function examinerTours({ evenement, reservations }, faute) {
  reservations.forEach(({ portee, tour }, rang) => {
    const admis = portee === 'tous' ? tour === null : tour !== null && tour <= evenement.tours;
    if (!admis) faute(`charge.reservations[${rang}].tour`);
  });
}

// Objectifs de chaque table, dans l'ordre des tables puis des rangs : le
// tour d'un objectif est null pour la portée « tous », de 1 à R pour la
// portée « tour » ; une table porte au plus un objectif par portée et tour,
// et le second est fautif (§ 4.5). faute(chemin) lève l'écart.
function examinerObjectifs({ evenement, tables }, faute) {
  tables.forEach(({ objectifs = [] }, rangTable) => {
    const vus = new Set();
    objectifs.forEach(({ portee, tour }, rang) => {
      const chemin = `charge.tables[${rangTable}].objectifs[${rang}]`;
      const admis = portee === 'tous' ? tour === null : tour !== null && tour <= evenement.tours;
      if (!admis) faute(`${chemin}.tour`);
      if (vus.has(tour)) faute(chemin);
      vus.add(tour);
    });
  });
}

// Présence de chaque personne qui la porte, exclues comprises, dans l'ordre
// des personnes : un tour au-delà des tours de l'événement est fautif, le
// premier dans l'ordre écrit ; une liste qui porte chaque tour, le défaut
// écrit, l'est aussi, nommée par la liste. La forme garantit des tours
// entiers, distincts, de 1 à TOURS_MAX : une liste dont aucun tour ne dépasse
// R et qui en compte R les porte tous. faute(chemin) lève l'écart.
function examinerPresences({ evenement, participants }, faute) {
  participants.forEach(({ presence }, rang) => {
    if (presence === undefined) return;
    const chemin = `charge.participants[${rang}].presence`;
    const hors = presence.findIndex((tour) => tour > evenement.tours);
    if (hors >= 0) faute(`${chemin}[${hors}]`);
    if (presence.length === evenement.tours) faute(chemin);
  });
}

// L'ordre des priorités, quand les réglages le portent, chaque palier rangé
// dans l'ordre du registre : la liste se juge par verifierPriorites sous le
// mode des objectifs de la charge, et l'ordre par défaut écrit est une faute
// (§ 8.9, A16). Une faute d'un palier désigne ce palier ; une autre, la
// liste. faute(chemin) lève l'écart.
function examinerPriorites(charge, faute) {
  const { priorites: portee } = charge.reglages;
  if (portee === undefined) return;
  const chemin = 'charge.reglages.priorites';
  const rangee = rangerPriorites(portee);
  const ecart = verifierPriorites(rangee, modeObjectifs(charge));
  if (ecart !== null) faute(ecart.palier === undefined ? chemin : `${chemin}[${ecart.palier}]`);
  if (egaleAuDefaut(rangee)) faute(chemin);
}

// Copie d'une liste de priorités, chaque palier rangé dans l'ordre du
// registre, chaque entrée réduite à {critere, poids}.
const rangerPriorites = (liste) =>
  liste.map((palier) => palier.map(({ critere, poids }) => ({ critere, poids })).sort(ordreDansLePalier));

// Vrai quand une liste rangée est l'ordre par défaut : chaque critère seul à
// son palier, au poids 1, dans l'ordre du registre.
const egaleAuDefaut = (liste) =>
  liste.length === PRIORITES_PAR_DEFAUT.length &&
  liste.every(
    (palier, rang) =>
      palier.length === 1 &&
      palier[0].critere === PRIORITES_PAR_DEFAUT[rang][0].critere &&
      palier[0].poids === PRIORITES_PAR_DEFAUT[rang][0].poids,
  );

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

// Retire des réglages lus, en place, chaque clé oubliée de leur règle
// (oubliees) : la charge que rend la lecture ne la porte pas.
function oublierDesReglages(reglages) {
  for (const cle of REGLAGES.oubliees) delete reglages[cle];
}

/**
 * Lit le texte d'un fichier d'état, sans rien écrire (§ 8.4, § 8.8). Une
 * marque d'ordre d'octets en tête est ignorée. Rend l'en-tête, la charge,
 * formatPlusRecent, vrai quand le format dépasse FORMAT, et manquants, ce que
 * les comptes des propositions et du retenu annoncent sans que la charge le
 * porte, qui ne refuse jamais le fichier (§ 8.9, point 3). Au format courant,
 * l'en-tête et la charge sont ceux que le texte porte, ni copiés ni triés,
 * les clés oubliées des réglages retirées (oublierDesReglages) : canoniser
 * les met dans l'ordre canonique. Un fichier d'un format plus
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
  oublierDesReglages(charge.reglages);
  examinerIdentifiants(charge, faute);
  examinerTours(charge, faute);
  examinerObjectifs(charge, faute);
  examinerPresences(charge, faute);
  examinerPriorites(charge, faute);
  examinerTitres(charge, faute);
  const manquants = examinerComptes(entete.comptes, charge, plus);
  examinerReferences(charge, plus);
  return { entete, charge, formatPlusRecent, manquants };
}

/**
 * Configuration du moteur tirée d'une charge : les participants avec leur
 * appartenance, leur exclusion, leurs étiquettes et leur présence ; les
 * tables avec leur capacité courante ; le nombre de tours ; les réservations
 * sans leur siège, que le moteur ne lit pas, et sans tour pour la portée
 * « tous » ; les quatre contraintes des réglages et les deux cases
 * facultatives ; les objectifs des tables, chacun { table, tour, regle,
 * etiquettes }, tour null pour la soirée, sa règle résolue : la sienne,
 * sinon la règle par défaut (regleObjectifs) ; le mode des objectifs ;
 * l'ordre des priorités, tel que le rend priorites. Chaque champ nouveau du
 * format 2 est absent à son défaut — étiquettes d'une personne qui n'en
 * porte pas, présence d'une personne présente à tous les tours, objectifs
 * quand aucune table n'en a, modeObjectifs à « places », respecterObjectifs
 * coché, rencontrerAnimateurs décoché, priorites quand les réglages ne le
 * portent pas — : la configuration d'une charge sans eux est celle du
 * format 1. Qui
 * anime à chaque tour ne se lit pas ici : configurationDe
 * (src/application/configuration.js) l'ajoute, sur la règle des titres
 * pourvus, que le stockage n'importe pas. Les tables vont
 * par identifiant croissant, l'ordre du texte canonique : le moteur assoit
 * table après table, et une charge aux tables dans un autre ordre, relue
 * après un enregistrement, ne régénérerait plus ses propositions (§ 8.9).
 * Les objectifs suivent l'ordre des tables, puis la soirée et les tours
 * croissants. Les participants et les réservations gardent l'ordre de la
 * charge : le rang d'une réservation que nomme une ErreurConfiguration est
 * son rang dans la charge. Les listes d'étiquettes, de présence et de
 * priorités sont des copies ; la présence, que le fichier admet dans un
 * autre ordre, s'y range croissante, comme le moteur la lit.
 *
 * @param {import('./types.js').Charge} charge
 * @returns {import('../moteur/types.js').Configuration}
 */
export function configurationDepuisCharge(charge) {
  const { evenement, reglages } = charge;
  const tables = [...charge.tables].sort((a, b) => a.id - b.id);
  const regleParDefaut = regleObjectifs(charge);
  const objectifs = tables.flatMap(({ id, objectifs: deLaTable = [] }) =>
    [...deLaTable]
      .sort(ordreDesObjectifs)
      .map(({ tour, regle: propre, etiquettes }) => ({ table: id, tour, regle: propre ?? regleParDefaut, etiquettes: [...etiquettes] })),
  );
  const contraintes = {
    separerAppartenances: reglages.separerAppartenances,
    nouveauxVoisins: reglages.nouveauxVoisins,
    nouvelleTable: reglages.nouvelleTable,
    varierAppartenances: reglages.varierAppartenances,
  };
  for (const [cle, defaut] of CASES_FACULTATIVES) {
    if (critereCoche(charge, cle) !== defaut) contraintes[cle] = !defaut;
  }
  const configuration = {
    participants: charge.participants.map(({ id, nom, appartenance, exclu, etiquettes, presence }) => {
      const participant = { id, nom, appartenance, exclu };
      if (etiquettes !== undefined) participant.etiquettes = [...etiquettes];
      if (presence !== undefined) participant.presence = [...presence].sort(croissant);
      return participant;
    }),
    tables: tables.map((table) => ({ id: table.id, numero: table.numero, capacite: capacite(charge, table) })),
    tours: evenement.tours,
    reservations: charge.reservations.map(({ participant, table, portee, tour }) =>
      portee === 'tous' ? { participant, table, portee } : { participant, table, portee, tour },
    ),
    contraintes,
  };
  if (objectifs.length > 0) configuration.objectifs = objectifs;
  const mode = modeObjectifs(charge);
  if (mode !== MODE_OBJECTIFS_PAR_DEFAUT) configuration.modeObjectifs = mode;
  if (reglages.priorites !== undefined) configuration.priorites = priorites(charge);
  return configuration;
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

// La règle par défaut des objectifs et le mode des objectifs quand les
// réglages ne les portent pas (§ 8.9).
const REGLE_OBJECTIFS_PAR_DEFAUT = 'ou';
const MODE_OBJECTIFS_PAR_DEFAUT = 'places';

// Les quatre cases du format 1, toujours portées par les réglages (§ 5.3,
// § 8.9).
const CASES_DU_FORMAT_1 = new Set(['separerAppartenances', 'nouveauxVoisins', 'nouvelleTable', 'varierAppartenances']);

// Les défauts des cases facultatives, que seul CASES_FACULTATIVES expose.
const DEFAUTS_DES_CASES = new Map([
  ['respecterObjectifs', true],
  ['rencontrerAnimateurs', false],
]);

/**
 * Les deux cases facultatives du format 2 (§ 5.3, § 8.9), chacune avec la
 * valeur qu'elle prend quand les réglages ne la portent pas, dans cet
 * ordre. La seule déclaration de ces cases : le registre des commandes
 * l'importe. La vue est gelée et ne lit qu'une Map privée au module : ni
 * set, ni delete, ni clear, et chaque paire [cle, defaut] qu'elle itère est
 * un tableau neuf, qu'un appelant peut changer sans toucher aux défauts que
 * lisent critereCoche et le registre.
 *
 * @type {Readonly<{has: (cle: string) => boolean, get: (cle: string) => boolean|undefined,
 *   [Symbol.iterator]: () => Iterator<['respecterObjectifs'|'rencontrerAnimateurs', boolean]>}>}
 */
export const CASES_FACULTATIVES = Object.freeze({
  has: (cle) => DEFAUTS_DES_CASES.has(cle),
  get: (cle) => DEFAUTS_DES_CASES.get(cle),
  [Symbol.iterator]: () => DEFAUTS_DES_CASES.entries(),
});

/**
 * La règle par défaut des objectifs de l'événement (§ 4.5, § 8.9) : « et »
 * quand les réglages la portent, « ou » sinon. C'est la seule lecture de ce
 * réglage ; un objectif dont la règle propre est null la suit.
 *
 * @param {import('./types.js').Charge} charge
 * @returns {'ou'|'et'}
 */
export function regleObjectifs(charge) {
  return charge.reglages.regleObjectifs ?? REGLE_OBJECTIFS_PAR_DEFAUT;
}

/**
 * Vrai quand la case cle des critères est cochée (§ 5.3, § 8.9) : l'une des
 * quatre contraintes du format 1, que les réglages portent toujours, ou
 * l'une des deux cases facultatives — respecterObjectifs, cochée quand les
 * réglages ne la portent pas, rencontrerAnimateurs, décochée alors. C'est la
 * seule lecture des deux cases facultatives.
 *
 * @param {import('./types.js').Charge} charge
 * @param {'separerAppartenances'|'nouveauxVoisins'|'nouvelleTable'|'varierAppartenances'|'respecterObjectifs'|'rencontrerAnimateurs'} cle
 * @returns {boolean}
 * @throws {RangeError} pour toute autre clé
 */
export function critereCoche(charge, cle) {
  if (CASES_DU_FORMAT_1.has(cle)) return charge.reglages[cle];
  if (CASES_FACULTATIVES.has(cle)) return charge.reglages[cle] ?? CASES_FACULTATIVES.get(cle);
  throw new RangeError(`critereCoche : case inconnue ${JSON.stringify(cle)}`);
}

/**
 * Le mode des objectifs de l'événement (§ 8.9, D20) : « chacun » ou
 * « minimum » quand les réglages le portent, « places », le plus de places
 * servies, sinon. C'est la seule lecture de ce réglage.
 *
 * @param {import('./types.js').Charge} charge
 * @returns {'places'|'chacun'|'minimum'}
 */
export function modeObjectifs(charge) {
  return charge.reglages.modeObjectifs ?? MODE_OBJECTIFS_PAR_DEFAUT;
}

/**
 * L'ordre des priorités de l'événement (§ 5.7, § 8.9, A16) : la liste que
 * les réglages portent, sinon l'ordre par défaut. Chaque palier y est rangé
 * dans l'ordre du registre, et un critère que la liste ne nomme pas — écrit
 * sous un format qui ne le connaissait pas — y prend sa place de l'ordre par
 * défaut, seul à son palier, au poids 1 (completerPriorites). C'est la seule
 * lecture de ce réglage. Rend une liste neuve à chaque appel ; ne modifie pas
 * la charge.
 *
 * @param {import('./types.js').Charge} charge
 * @returns {Array<Array<{critere: string, poids: number}>>}
 */
export function priorites(charge) {
  const { priorites: portee } = charge.reglages;
  return portee === undefined ? rangerPriorites(PRIORITES_PAR_DEFAUT) : completerPriorites(rangerPriorites(portee));
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
