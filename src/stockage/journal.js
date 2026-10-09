// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le journal d'un événement (§ 8.2, § 8.3, § 8.6, § 8.8) : le fichier
// <base>.gtt-journal.jsonl, un objet JSON par ligne, fin de ligne LF, dont
// types.js décrit chaque sorte de ligne. La première ligne l'apparie à son
// état par l'identifiant de l'événement ; suivent les entrées, une par geste
// achevé, et les jalons, qui nomment l'instant d'une révision sans changer la
// charge. L'ordre est celui des lignes, jamais celui des horodatages, qui ne
// servent qu'à l'affichage.
//
// Le module n'a ni fichier ni horloge. Il rend le texte d'une ligne, sans fin
// de ligne — l'ajout au fichier appartient au système de fichiers —, lit le
// texte entier d'un journal, en décode les octets ligne par ligne, restitue
// la charge d'un instant, suit le fil courant et élague. Une table par sorte
// de ligne — OUVERTURE, ENTREE, JALON — donne à la fois l'ordre des clés à
// l'écriture et la règle de chaque clé à la lecture : l'écriture refuse par
// TypeError la ligne dont la lecture refuserait la forme. La suite des
// révisions et la cadence des instantanés, que la lecture contrôle aussi,
// dépendent des lignes voisines : elles appartiennent à l'appelant.
//
// Une entrée porte soit l'instantané de la charge qui en résulte, soit le
// correctif qui y mène depuis la charge de l'entrée qui la précède dans
// l'ordre des lignes (correctifs.js). L'instantané tombe sur la première
// entrée du journal, puis toutes les INTERVALLE_INSTANTANE révisions comptées
// depuis elle : restituer un instant part de l'instantané le plus proche, à
// ou avant lui, et applique au plus INTERVALLE_INSTANTANE − 1 correctifs.
//
// La lecture s'arrête à la première ligne illisible : JSON invalide, forme
// fausse, révision qui ne suit pas la précédente, cadence des instantanés
// rompue, jalon d'une révision qui n'est pas lue, ligne finale sans fin de
// ligne, que laisse une écriture interrompue. Cette ligne et toutes celles
// qui la suivent sont écartées et comptées : reprendre après elle ferait
// suivre un correctif à un instant qui n'est pas le sien (§ 8.6).
import { canoniser } from './canonique.js';
import { appliquer, difference } from './correctifs.js';
import { FORMAT, SCHEMA, clesRangees, premiereFaute } from './document.js';

/** Révisions d'un instantané au suivant (§ 8.6). */
export const INTERVALLE_INSTANTANE = 50;
/** Entrées que l'élagage garde au moins : le plancher l'emporte (§ 8.6). */
export const PLANCHER_ENTREES = 500;
/** Entrées au-delà desquelles le journal s'élague (§ 8.6). */
export const PLAFOND_ENTREES = 600;

/**
 * Un journal lu (lireJournal) : l'identifiant de l'événement, null quand
 * l'ouverture est illisible ; les entrées, puis les jalons, chacun dans
 * l'ordre des lignes, tels que le texte les porte ; et le nombre de lignes
 * écartées. Les révisions des entrées se suivent ; la première porte un
 * instantané et une version.
 *
 * @typedef {Object} Journal
 * @property {string|null} evenement
 * @property {import('./types.js').LigneEntree[]} entrees
 * @property {import('./types.js').LigneJalon[]} jalons
 * @property {number} ecartees
 */

// Règles de la charge et d'une proposition dans le schéma du fichier d'état.
const regleDuChamp = (regle, cle) => regle.champs.find(([nom]) => nom === cle)[1];
const CHARGE = regleDuChamp(SCHEMA, 'charge');
const PROPOSITION = regleDuChamp(CHARGE, 'propositions').element;

const MARQUE_ORDRE_OCTETS = '\u{FEFF}';
// La fin de ligne, en octets.
const LF = 0x0a;
// Décodage strict d'une ligne : un octet hors UTF-8 lève, et la marque
// d'ordre d'octets reste dans le texte, que la lecture retire.
const UTF8_STRICT = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
// AAAA-MM-JJTHH:MM:SS±HH:MM, la forme que rend l'horloge de l'application.
// Le calendrier ne se contrôle pas : un horodatage ne décide d'aucun ordre.
const HORODATAGE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
const SENS = [null, 'defaire', 'refaire', 'revenir'];

const estObjet = (valeur) => typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);
const estRevision = (valeur) => Number.isSafeInteger(valeur) && valeur >= 1;
const estTexte = (valeur) => typeof valeur === 'string' && valeur !== '';

/**
 * Vrai pour une chaîne de la forme AAAA-MM-JJTHH:MM:SS±HH:MM, celle que rend
 * l'horloge de l'application : la seule définition de la forme d'un
 * horodatage, que le journal, le verrou et le placement daté partagent. Ni
 * le calendrier ni les bornes des heures ne se contrôlent ici.
 *
 * @param {unknown} valeur
 * @returns {boolean}
 */
export const estHorodatage = (valeur) => typeof valeur === 'string' && HORODATAGE.test(valeur);

// Chemin de la première valeur de charge que l'analyse du fichier d'état
// refuserait, ou null : la forme de la charge, propositions et retenu lus
// comme conteneurs, puis la forme de chaque proposition, que canoniser
// exige. Un retenu hors de sa règle reste admis, comme le contrôle des
// placements le garde (§ 8.9).
function fauteDeCharge(charge) {
  return (
    premiereFaute(charge, CHARGE, 'charge') ??
    charge.propositions
      .map((proposition, rang) => premiereFaute(proposition, PROPOSITION, `charge.propositions[${rang}]`))
      .find((faute) => faute !== null) ??
    null
  );
}

// Une sorte de ligne : ses champs, paires [clé, admet] dans l'ordre des clés
// du texte, et l'ensemble de ces clés. admet(valeur, ligne) dit si une valeur
// est admise à sa clé ; il peut lire les clés qui la précèdent, déjà admises.
const sorte = (champs) => ({ champs, cles: new Set(champs.map(([cle]) => cle)) });

const OUVERTURE = sorte([
  ['type', (valeur) => valeur === 'journal'],
  ['format', (valeur) => valeur === FORMAT],
  ['evenement', estTexte],
]);

const ENTREE = sorte([
  ['type', (valeur) => valeur === 'entree'],
  ['revision', estRevision],
  ['libelle', estTexte],
  ['horodatage', estHorodatage],
  ['sens', (valeur) => SENS.includes(valeur)],
  // Un retour vise une révision antérieure à la sienne ; un geste n'en vise
  // aucune.
  ['retour', (valeur, { sens, revision }) => (sens === null ? valeur === null : estRevision(valeur) && valeur < revision)],
  ['produitVersion', (valeur) => valeur === null || estTexte(valeur)],
  ['instantane', (valeur) => valeur === null || fauteDeCharge(valeur) === null],
  // Exactement l'un des deux : le correctif quand l'instantané manque.
  ['correctif', (valeur, { instantane }) => (instantane === null ? Array.isArray(valeur) : valeur === null)],
]);

const JALON = sorte([
  ['type', (valeur) => valeur === 'jalon'],
  ['revision', estRevision],
  ['nom', estTexte],
  ['horodatage', estHorodatage],
]);

// Première clé de ligne hors de la règle de sa sorte, ou null : '' quand la
// ligne n'est pas un objet, puis chaque champ dans l'ordre de la sorte,
// absent ou refusé, puis la plus petite clé inconnue.
function champFautif(ligne, { champs, cles }) {
  if (!estObjet(ligne)) return '';
  for (const [cle, admet] of champs) {
    if (!Object.hasOwn(ligne, cle) || !admet(ligne[cle], ligne)) return cle;
  }
  return clesRangees(ligne).find((cle) => !cles.has(cle)) ?? null;
}

// Texte d'une ligne, ses clés dans l'ordre de sa sorte, sans fin de ligne ;
// JSON.stringify n'écrit aucune fin de ligne brute. Lève TypeError, au nom
// de fonction, quand la lecture refuserait la ligne.
function ecrire(sorteDeLigne, valeurs, fonction) {
  const ligne = Object.fromEntries(sorteDeLigne.champs.map(([cle]) => [cle, valeurs[cle]]));
  const cle = champFautif(ligne, sorteDeLigne);
  if (cle !== null) throw new TypeError(`${fonction} : ${cle} hors de sa règle`);
  return JSON.stringify(ligne);
}

/**
 * Première ligne d'un journal, qui l'apparie à son état par l'identifiant de
 * l'événement (§ 8.6) ; sans fin de ligne. Le format est FORMAT, celui des
 * charges que le journal porte. Lève TypeError quand evenement n'est pas une
 * chaîne non vide.
 *
 * @param {string} evenement
 * @returns {string}
 */
export function ligneOuverture(evenement) {
  return ecrire(OUVERTURE, { type: 'journal', format: FORMAT, evenement }, 'ligneOuverture');
}

/**
 * Ligne d'une entrée (§ 8.2, § 8.3), sans fin de ligne : sa révision, son
 * libellé figé, son horodatage d'affichage, sens et retour pour une entrée
 * de retour, la version de la construction quand elle se note (§ 8.8), puis
 * l'instantané de la copie canonique de apres quand instantane est vrai, ou
 * le correctif de avant à apres sinon (difference). L'instantané et le
 * correctif ne dépendent que des deux charges, non de l'ordre de leurs clés
 * ni de leurs listes. Ni avant ni apres ne sont modifiées.
 *
 * L'appelant passe instantane = estInstantane(revision, première révision
 * du journal), et produitVersion à la première entrée et quand la
 * construction change ; la lecture refuse une ligne qui rompt l'un ou
 * l'autre.
 *
 * Lève TypeError quand la lecture refuserait la ligne — révision qui n'est
 * pas un entier ≥ 1, libellé vide, horodatage qui n'a pas la forme
 * AAAA-MM-JJTHH:MM:SS±HH:MM, sens inconnu, retour présent sans sens, absent
 * avec un sens, ou qui ne précède pas la révision, version vide —, quand
 * instantane n'est pas un booléen, quand apres n'a pas la forme que
 * l'analyse du fichier d'état admet — clés inconnues comprises —, chaque
 * proposition selon sa règle, et, pour un correctif, quand avant manque ou
 * ne se canonise pas.
 *
 * @param {Object} entree
 * @param {number} entree.revision
 * @param {string} entree.libelle
 * @param {string} entree.horodatage
 * @param {null|'defaire'|'refaire'|'revenir'} [entree.sens]
 * @param {number|null} [entree.retour]
 * @param {string|null} [entree.produitVersion]
 * @param {import('./types.js').Charge} [entree.avant]   requise pour un correctif
 * @param {import('./types.js').Charge} entree.apres
 * @param {boolean} entree.instantane
 * @returns {string}
 */
export function ligneEntree({
  revision,
  libelle,
  horodatage,
  sens = null,
  retour = null,
  produitVersion = null,
  avant,
  apres,
  instantane,
}) {
  if (typeof instantane !== 'boolean') {
    throw new TypeError(`ligneEntree : instantane booléen attendu, reçu ${JSON.stringify(instantane)}`);
  }
  // La charge reçue, telle quelle : une clé hors du schéma, que la copie
  // canonique tairait, est refusée comme l'analyse la refuserait.
  const faute = fauteDeCharge(apres);
  if (faute !== null) throw new TypeError(`ligneEntree : ${faute} hors de sa règle`);
  const ligne = {
    type: 'entree',
    revision,
    libelle,
    horodatage,
    sens,
    retour,
    produitVersion,
    instantane: instantane ? canoniser(apres) : null,
    correctif: instantane ? null : difference(avant, apres),
  };
  return ecrire(ENTREE, ligne, 'ligneEntree');
}

/**
 * Ligne d'un jalon (§ 8.3), sans fin de ligne : il nomme l'instant de la
 * révision donnée, ne change pas la charge et ne prend pas de révision.
 * Lève TypeError quand la révision n'est pas un entier ≥ 1, le nom vide, ou
 * l'horodatage hors de sa forme.
 *
 * @param {{revision: number, nom: string, horodatage: string}} jalon
 * @returns {string}
 */
export function ligneJalon({ revision, nom, horodatage }) {
  return ecrire(JALON, { type: 'jalon', revision, nom, horodatage }, 'ligneJalon');
}

/**
 * Vrai quand l'entrée revision porte un instantané, dans un journal dont la
 * première entrée est premiere : premiere elle-même, puis toutes les
 * INTERVALLE_INSTANTANE révisions comptées depuis elle ; jamais une révision
 * qui précède premiere.
 *
 * @param {number} revision
 * @param {number} premiere
 * @returns {boolean}
 */
export function estInstantane(revision, premiere) {
  return revision >= premiere && (revision - premiere) % INTERVALLE_INSTANTANE === 0;
}

// Valeur JSON d'une ligne, ou undefined quand elle n'en est pas une.
function analyserLigne(ligne) {
  try {
    return JSON.parse(ligne);
  } catch {
    return undefined;
  }
}

// Vrai quand ligne est l'entrée qui suit entrees : sa forme admise, et la
// révision qui suit la dernière, l'instantané là où la cadence le veut ; la
// première entrée, de révision quelconque, porte un instantané et sa
// version.
function entreeSuivante(ligne, entrees) {
  if (champFautif(ligne, ENTREE) !== null) return false;
  if (entrees.length === 0) return ligne.produitVersion !== null && ligne.instantane !== null;
  return (
    ligne.revision === entrees[entrees.length - 1].revision + 1 &&
    (ligne.instantane !== null) === estInstantane(ligne.revision, entrees[0].revision)
  );
}

// Vrai quand ligne est un jalon d'une révision déjà lue.
function jalonDe(ligne, entrees) {
  return (
    champFautif(ligne, JALON) === null &&
    entrees.length > 0 &&
    ligne.revision >= entrees[0].revision &&
    ligne.revision <= entrees[entrees.length - 1].revision
  );
}

// Lecture d'un texte de journal : le journal lu ; les lignes lues après
// l'ouverture, entrées et jalons dans l'ordre du texte ; et les segments du
// texte coupé à chaque fin de ligne, la marque d'ordre d'octets retirée, le
// dernier segment suivant la dernière fin de ligne. Chaque segment suivi
// d'une fin de ligne est une ligne ; le dernier aussi quand il n'est pas
// vide, et la lecture l'écarte.
function lire(texte) {
  const segments = (texte.startsWith(MARQUE_ORDRE_OCTETS) ? texte.slice(1) : texte).split('\n');
  const completes = segments.length - 1;
  const lignes = segments[completes] === '' ? completes : completes + 1;
  const journal = { evenement: null, entrees: [], jalons: [], ecartees: lignes };
  const lues = [];
  const ouverture = completes > 0 ? analyserLigne(segments[0]) : undefined;
  if (champFautif(ouverture, OUVERTURE) !== null) return { journal, lues, segments };
  journal.evenement = ouverture.evenement;
  for (let rang = 1; rang < completes; rang += 1) {
    const ligne = analyserLigne(segments[rang]);
    if (entreeSuivante(ligne, journal.entrees)) journal.entrees.push(ligne);
    else if (jalonDe(ligne, journal.entrees)) journal.jalons.push(ligne);
    else break;
    lues.push(ligne);
  }
  journal.ecartees = lignes - 1 - lues.length;
  return { journal, lues, segments };
}

/**
 * Lit le texte d'un journal (§ 8.6), sans rien écrire (§ 8.4). Une marque
 * d'ordre d'octets en tête est ignorée ; un retour chariot avant la fin de
 * ligne aussi, que JSON tient pour un blanc.
 *
 * La lecture s'arrête à la première ligne illisible : JSON invalide ; forme
 * fausse, toute clé absente, refusée ou inconnue, et l'instantané d'une
 * forme que l'analyse du fichier d'état refuse ; une ouverture d'un autre
 * format ; une entrée dont la révision ne suit pas la précédente, ou dont
 * l'instantané manque ou abonde au regard de la cadence (estInstantane) ;
 * une première entrée sans version ; un jalon d'une révision qui n'est pas
 * encore lue ; une ligne finale sans fin de ligne. Cette ligne et toutes
 * celles qui la suivent, entrées et jalons confondus — une ligne illisible
 * ne dit pas sa sorte —, sont écartées et comptées dans ecartees. Une
 * ouverture illisible écarte tout, et evenement vaut null.
 *
 * Un correctif se lit sans s'appliquer : reconstruire lève CORRECTIF sur
 * celui qui ne s'applique pas.
 *
 * @param {string} texte
 * @returns {Journal}
 */
export function lireJournal(texte) {
  return lire(texte).journal;
}

/**
 * Le texte lisible des octets d'un journal (§ 8.6) : coupés à chaque octet
 * de fin de ligne LF, chaque segment se décode strictement, dans l'ordre ;
 * le premier qui n'est pas de l'UTF-8 arrête le texte, comme une ligne
 * illisible arrête la lecture. Rend texte, les lignes qui le précèdent,
 * chacune suivie de sa fin de ligne — tout le texte quand chaque segment se
 * décode, null quand l'ouverture elle-même ne se décode pas —, et ecartees,
 * ce segment et ceux qui le suivent, comptés comme lireJournal compte les
 * lignes : chaque fin de ligne en termine une, et le dernier segment en est
 * une quand il n'est pas vide. Une écriture coupée au milieu d'un caractère
 * ne gâte ainsi que sa dernière ligne, et lireJournal(texte), ses ecartees
 * augmentées de celles-ci, est la lecture du journal.
 *
 * @param {Uint8Array} octets
 * @returns {{texte: string|null, ecartees: number}}
 */
export function decoderJournal(octets) {
  const segments = [];
  let debut = 0;
  for (let rang = octets.indexOf(LF); rang !== -1; rang = octets.indexOf(LF, debut)) {
    segments.push(octets.subarray(debut, rang));
    debut = rang + 1;
  }
  segments.push(octets.subarray(debut));
  const lignes = segments.length - 1 + (segments.at(-1).length > 0 ? 1 : 0);
  let texte = '';
  for (let rang = 0; rang < segments.length; rang += 1) {
    let ligne;
    try {
      ligne = UTF8_STRICT.decode(segments[rang]);
    } catch {
      return { texte: rang === 0 ? null : texte, ecartees: lignes - rang };
    }
    texte += rang < segments.length - 1 ? `${ligne}\n` : ligne;
  }
  return { texte, ecartees: 0 };
}

/**
 * Charge après l'entrée revision (§ 8.3) : l'instantané le plus proche, à ou
 * avant elle, puis chaque correctif jusqu'à elle, dans l'ordre des lignes —
 * au plus INTERVALLE_INSTANTANE − 1. Rend une charge neuve, dans l'ordre
 * canonique, qui ne partage rien avec le journal. Une entrée de retour rend
 * la charge de sa cible, que son correctif ou son instantané portent.
 *
 * Lève ErreurStockage('CORRECTIF', { rang }) d'appliquer (correctifs.js) sur
 * un correctif qui ne s'applique pas : il gâte les révisions de la sienne à
 * l'instantané suivant, et aucune autre. Lève RangeError quand revision
 * n'est pas celle d'une entrée du journal.
 *
 * @param {Journal} journal
 * @param {number} revision
 * @returns {import('./types.js').Charge}
 */
export function reconstruire({ entrees }, revision) {
  const rang = entrees.findIndex((entree) => entree.revision === revision);
  if (rang === -1) throw new RangeError(`reconstruire : révision ${String(revision)} absente du journal`);
  let base = rang;
  while (entrees[base].instantane === null) base -= 1;
  let charge = canoniser(entrees[base].instantane);
  for (let suivante = base + 1; suivante <= rang; suivante += 1) {
    charge = appliquer(charge, entrees[suivante].correctif);
  }
  return charge;
}

/**
 * Le fil courant (§ 8.3), par le rejeu des entrées dans l'ordre des lignes.
 * La position d'une entrée ordinaire est elle-même ; celle d'une entrée de
 * retour, la position de l'entrée qu'elle vise. Une entrée ordinaire pose la
 * position et vide la pile de refaire ; un retour defaire ou revenir empile
 * la position courante et pose celle de sa cible ; un retour refaire dépile
 * et pose celle de sa cible.
 *
 * Le prédécesseur d'une position est la position de l'entrée qui la précède
 * dans l'ordre des lignes, null pour la première entrée du journal. Un retour
 * dont la cible précède la première entrée — l'élagage l'a retirée — porte
 * la charge de cette cible sans en connaître la position : il est sa propre
 * position, sans prédécesseur, et le fil s'arrête à lui.
 *
 * Rend position, la position courante, null pour un journal sans entrée ;
 * pile, les positions à refaire, le sommet en dernier ; courant, le fil
 * courant, la chaîne des prédécesseurs depuis la position, de la plus récente
 * à la plus ancienne ; cibleDefaire, le prédécesseur de la position, et
 * cibleRefaire, le sommet de la pile, null quand ils n'existent pas. Les
 * entrées ordinaires hors du fil courant forment les fils abandonnés.
 *
 * @param {Journal} journal
 * @returns {{position: number|null, pile: number[], courant: number[], cibleDefaire: number|null, cibleRefaire: number|null}}
 */
export function fil({ entrees }) {
  const positions = new Map();
  const sansPredecesseur = new Set();
  const pile = [];
  let position = null;
  for (const { revision, sens, retour } of entrees) {
    let cible = revision;
    if (sens === null) {
      pile.length = 0;
    } else {
      if (positions.has(retour)) cible = positions.get(retour);
      else sansPredecesseur.add(revision);
      if (sens === 'refaire') pile.pop();
      else if (position !== null) pile.push(position);
    }
    positions.set(revision, cible);
    position = cible;
  }
  const predecesseur = (p) => (sansPredecesseur.has(p) ? null : (positions.get(p - 1) ?? null));
  const courant = [];
  for (let p = position; p !== null; p = predecesseur(p)) courant.push(p);
  return { position, pile, courant, cibleDefaire: courant[1] ?? null, cibleRefaire: pile.at(-1) ?? null };
}

/**
 * Version de la construction qui a produit l'entrée revision (§ 8.8) : la
 * dernière produitVersion non nulle à ou avant elle. null quand revision
 * n'est pas celle d'une entrée du journal.
 *
 * @param {Journal} journal
 * @param {number} revision
 * @returns {string|null}
 */
export function versionDe({ entrees }, revision) {
  for (let rang = entrees.findIndex((entree) => entree.revision === revision); rang >= 0; rang -= 1) {
    if (entrees[rang].produitVersion !== null) return entrees[rang].produitVersion;
  }
  return null;
}

/**
 * Texte du journal élagué (§ 8.6), ou null quand ses entrées lisibles ne
 * dépassent pas PLAFOND_ENTREES. La coupe tombe sur l'instantané le plus
 * récent qui garde au moins PLANCHER_ENTREES entrées : le plancher l'emporte
 * sur le plafond. Le texte rendu porte l'ouverture, puis les lignes lues dont
 * la révision atteint la coupe — les jalons des entrées retirées partent
 * avec elles —, puis les lignes que la lecture écarte, telles quelles.
 * L'entrée de la coupe porte la version de la construction qui l'a produite
 * (versionDe), qu'elle hérite sinon d'une entrée retirée ; toute autre
 * ligne gardée se recopie octet pour octet. La marque d'ordre d'octets ne
 * se recopie pas. Les instantanés gardés suivent la cadence comptée depuis
 * la coupe, celle d'avant : le texte rendu se relit, et chaque instant gardé
 * s'y restitue comme avant.
 *
 * @param {string} texte
 * @returns {string|null}
 */
export function elaguer(texte) {
  const { journal, lues, segments } = lire(texte);
  const { entrees } = journal;
  if (entrees.length <= PLAFOND_ENTREES) return null;
  let rang = entrees.length - PLANCHER_ENTREES;
  while (entrees[rang].instantane === null) rang -= 1;
  const coupe = entrees[rang];
  const gardees = [ligneOuverture(journal.evenement)];
  lues.forEach((ligne, i) => {
    if (ligne.revision < coupe.revision) return;
    if (ligne !== coupe || coupe.produitVersion !== null) gardees.push(segments[i + 1]);
    else gardees.push(ecrire(ENTREE, { ...coupe, produitVersion: versionDe(journal, coupe.revision) }, 'elaguer'));
  });
  return [...gardees, ...segments.slice(1 + lues.length)].join('\n');
}
