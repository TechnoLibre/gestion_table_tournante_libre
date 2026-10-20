// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les réglages locaux (§ 8.5) : le fichier reglages_locaux.json, à la racine
// du dossier de travail, à côté des fichiers d'événement et hors d'eux. Il
// porte trois choses, et trois seulement : le cadrage de chaque événement,
// indexé par son identifiant — le zoom k en pixels par centimètre, la
// translation tx, ty en pixels —, le format de papier des planches, global
// à la machine (§ 11.2), null tant que l'opérateur ne l'a pas choisi, et la
// taille du texte de l'écran, globale à la machine, sous la clé
// taille_texte, absente tant que l'opérateur ne l'a pas choisie : le défaut
// de l'échelle s'applique alors (src/geometrie/taille_texte.js). Aucun ne
// voyage avec un événement ni ne revient par un retour arrière.
//
// La lecture ne bloque jamais : un fichier absent donne les défauts ; un
// fichier qui ne se lit pas, ou dont une valeur connue sort de sa règle,
// donne les défauts et l'avertissement REGLAGES_ILLISIBLES. Un fichier
// lisible garde ses clés inconnues, à tout niveau, et son format, un entier
// d'au moins 1 : le réglage qu'une construction plus récente y ajoute
// survit à la réécriture par une plus ancienne.
//
// Le texte est canonique : JSON sur une ligne, les clés de chaque objet
// rangées par unités UTF-16, les cadrages par identifiant d'événement, une
// fin de ligne finale. L'écriture en est différée (§ 8.2, § 8.5) : un
// écrivain regroupe les demandes d'un délai borné, si bien qu'un zoom
// continu écrit une fois par délai, jamais à chaque image.
import { PAPIERS } from '../geometrie/papiers.js';
import { PALIERS_TAILLE_TEXTE, TAILLE_TEXTE_DEFAUT, estPalierTailleTexte } from '../geometrie/taille_texte.js';
import { clesRangees } from './document.js';
import { ErreurStockage } from './erreurs.js';

/** Le fichier des réglages locaux, à la racine du dossier de travail (§ 8.5). */
export const FICHIER_REGLAGES = 'reglages_locaux.json';

// Format d'un fichier que ce code crée.
const FORMAT_REGLAGES = 1;

const MARQUE_ORDRE_OCTETS = '\u{FEFF}';

/**
 * Les réglages locaux, tels que reglages_locaux.json les porte.
 *
 * @typedef {Object} ReglagesLocaux
 * @property {number} format              entier ≥ 1, gardé tel que lu
 * @property {null|import('../geometrie/papiers.js').Papier} papier   une clé de PAPIERS
 * @property {Array<{evenement: string, k: number, tx: number, ty: number}>} cadrages
 *           un par événement, triés par identifiant ; evenement non vide, k
 *           nombre fini > 0, tx et ty nombres finis
 * @property {number} [taille_texte]      l'un de PALIERS_TAILLE_TEXTE ; absente
 *           tant que l'opérateur ne l'a pas choisie. Toute autre clé, à tout
 *           niveau, se garde telle quelle
 */

// Deux chaînes, comparées unité UTF-16 par unité.
const comparerTextes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const parEvenement = (a, b) => comparerTextes(a.evenement, b.evenement);

// Le domaine du papier : les clés de PAPIERS (src/geometrie/papiers.js),
// rangées par comparerTextes — le message d'un refus les nomme dans cet
// ordre, qui ne dépend que de leur ensemble. Une clé héritée
// d'Object.prototype n'en est pas une.
const NOMS_PAPIERS = Object.keys(PAPIERS).sort(comparerTextes);
const estPapier = (papier) => typeof papier === 'string' && Object.hasOwn(PAPIERS, papier);

// Vrai pour un objet qui n'est ni null ni une liste.
const estObjet = (valeur) => typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);

// Les réglages d'un dossier qui n'en a pas, neufs à chaque appel.
const defauts = () => ({ format: FORMAT_REGLAGES, papier: null, cadrages: [] });

// Chemin de la première valeur connue d'un cadrage qui sort de sa règle, ou
// null ; chemin désigne le cadrage lui-même.
function fauteDeCadrage(cadrage, chemin) {
  if (!estObjet(cadrage)) return chemin;
  const { evenement, k, tx, ty } = cadrage;
  if (typeof evenement !== 'string' || evenement === '') return `${chemin}.evenement`;
  if (!Number.isFinite(k) || k <= 0) return `${chemin}.k`;
  if (!Number.isFinite(tx)) return `${chemin}.tx`;
  if (!Number.isFinite(ty)) return `${chemin}.ty`;
  return null;
}

// Chemin de la première valeur connue des réglages qui sort de sa règle, ou
// null ; '' quand les réglages ne sont pas un objet. Le second cadrage d'un
// même événement est fautif ; une taille du texte présente est l'un des
// paliers.
function fauteDeReglages(reglages) {
  if (!estObjet(reglages)) return '';
  const { format, papier, cadrages } = reglages;
  if (!Number.isSafeInteger(format) || format < 1) return 'format';
  if (papier !== null && !estPapier(papier)) return 'papier';
  if (Object.hasOwn(reglages, 'taille_texte') && !estPalierTailleTexte(reglages.taille_texte)) return 'taille_texte';
  if (!Array.isArray(cadrages)) return 'cadrages';
  const vus = new Set();
  for (let rang = 0; rang < cadrages.length; rang += 1) {
    const chemin = `cadrages[${rang}]`;
    const faute = fauteDeCadrage(cadrages[rang], chemin);
    if (faute !== null) return faute;
    if (vus.has(cadrages[rang].evenement)) return `${chemin}.evenement`;
    vus.add(cadrages[rang].evenement);
  }
  return null;
}

// Copie de valeur dont chaque objet reçoit ses clés rangées (clesRangees),
// chaque liste gardant son ordre. JSON.stringify écrit les clés de la copie
// dans cet ordre, les clés d'index entier en tête, croissantes, comme
// JavaScript les énumère : le texte ne dépend que de l'ensemble des clés.
// Object.fromEntries pose chaque clé en propre, « __proto__ » comprise.
function rangee(valeur) {
  if (Array.isArray(valeur)) return valeur.map(rangee);
  if (!estObjet(valeur)) return valeur;
  return Object.fromEntries(clesRangees(valeur).map((cle) => [cle, rangee(valeur[cle])]));
}

// Ce que rend lireReglages d'un fichier illisible : les défauts, et
// l'avertissement qui nomme le fichier et la raison.
const illisibles = (raison) => ({
  reglages: defauts(),
  avertissement: { code: 'REGLAGES_ILLISIBLES', details: { chemin: FICHIER_REGLAGES, raison } },
});

/**
 * Lit les réglages locaux de racine (§ 8.5), sans rien écrire ni jamais
 * bloquer. Un fichier absent rend les défauts, sans avertissement. Un
 * fichier illisible rend les défauts et l'avertissement REGLAGES_ILLISIBLES
 * {chemin, raison} : raison JSON pour un texte qui ne se lit pas, vide
 * compris ; FORME pour une valeur connue hors de sa règle — un format qui
 * n'est pas un entier ≥ 1, un papier hors de null et des clés de PAPIERS,
 * un cadrage fautif ou en double, une taille du texte présente hors des
 * paliers ; le code d'une lecture que le système de fichiers refuse
 * autrement que par ABSENT. Une marque d'ordre d'octets en tête est
 * ignorée. Les réglages lus gardent leurs clés inconnues et leur format ;
 * leurs cadrages sont triés par identifiant d'événement.
 *
 * @param {import('./systeme_fichiers.js').SystemeFichiers} fs
 * @param {import('./systeme_fichiers.js').Racine} racine
 * @returns {Promise<{reglages: ReglagesLocaux, avertissement: {code: string, details: Object}|null}>}
 *          une erreur qui n'est pas une ErreurStockage remonte telle quelle
 */
export async function lireReglages(fs, racine) {
  let texte;
  try {
    texte = await fs.lireTexte(racine, FICHIER_REGLAGES);
  } catch (erreur) {
    if (!(erreur instanceof ErreurStockage)) throw erreur;
    if (erreur.code === 'ABSENT') return { reglages: defauts(), avertissement: null };
    return illisibles(erreur.code);
  }
  let lu;
  try {
    lu = JSON.parse(texte.startsWith(MARQUE_ORDRE_OCTETS) ? texte.slice(1) : texte);
  } catch {
    return illisibles('JSON');
  }
  if (fauteDeReglages(lu) !== null) return illisibles('FORME');
  return { reglages: { ...lu, cadrages: [...lu.cadrages].sort(parEvenement) }, avertissement: null };
}

/**
 * Le cadrage de l'événement d'identifiant evenement, ou null quand les
 * réglages n'en portent pas.
 *
 * @param {ReglagesLocaux} reglages
 * @param {string} evenement
 * @returns {{k: number, tx: number, ty: number}|null}
 */
export function cadrageDe({ cadrages }, evenement) {
  const cadrage = cadrages.find((candidat) => candidat.evenement === evenement);
  return cadrage === undefined ? null : { k: cadrage.k, tx: cadrage.tx, ty: cadrage.ty };
}

/**
 * Les réglages reçus, le cadrage de l'événement remplacé, ou ajouté à son
 * rang ; ceux reçus ne changent pas.
 *
 * @param {ReglagesLocaux} reglages
 * @param {string} evenement   identifiant de l'événement, non vide
 * @param {{k: number, tx: number, ty: number}} cadrage   k fini > 0, tx et
 *        ty finis
 * @returns {ReglagesLocaux}
 * @throws {TypeError} une valeur hors de sa règle
 */
export function avecCadrage(reglages, evenement, { k, tx, ty }) {
  const cadrage = { evenement, k, tx, ty };
  const faute = fauteDeCadrage(cadrage, 'cadrage');
  if (faute !== null) throw new TypeError(`avecCadrage : ${faute} hors de sa règle`);
  const autres = reglages.cadrages.filter((autre) => autre.evenement !== evenement);
  return { ...reglages, cadrages: [...autres, cadrage].sort(parEvenement) };
}

/**
 * Les réglages reçus, le papier remplacé ; ceux reçus ne changent pas.
 *
 * @param {ReglagesLocaux} reglages
 * @param {null|import('../geometrie/papiers.js').Papier} papier
 * @returns {ReglagesLocaux}
 * @throws {TypeError} un autre papier
 */
export function avecPapier(reglages, papier) {
  if (papier !== null && !estPapier(papier)) {
    throw new TypeError(`avecPapier : papier null, ${NOMS_PAPIERS.join(' ou ')} attendu, reçu ${JSON.stringify(papier)}`);
  }
  return { ...reglages, papier };
}

/**
 * La taille du texte de l'écran que les réglages portent, à défaut
 * TAILLE_TEXTE_DEFAUT.
 *
 * @param {ReglagesLocaux} reglages
 * @returns {number}   l'un de PALIERS_TAILLE_TEXTE
 */
export function tailleTexteDe(reglages) {
  return Object.hasOwn(reglages, 'taille_texte') ? reglages.taille_texte : TAILLE_TEXTE_DEFAUT;
}

/**
 * Les réglages reçus, la taille du texte de l'écran remplacée ; ceux reçus ne
 * changent pas.
 *
 * @param {ReglagesLocaux} reglages
 * @param {number} taille   l'un de PALIERS_TAILLE_TEXTE
 * @returns {ReglagesLocaux}
 * @throws {TypeError} hors des paliers
 */
export function avecTailleTexte(reglages, taille) {
  if (!estPalierTailleTexte(taille)) {
    throw new TypeError(
      `avecTailleTexte : taille du texte ${PALIERS_TAILLE_TEXTE.slice(0, -1).join(', ')} ou ${PALIERS_TAILLE_TEXTE.at(-1)} attendue, reçu ${JSON.stringify(taille)}`,
    );
  }
  return { ...reglages, taille_texte: taille };
}

/**
 * Texte canonique des réglages : JSON sur une ligne, les clés de chaque
 * objet rangées par unités UTF-16, clés inconnues comprises, les cadrages
 * triés par identifiant d'événement, une fin de ligne finale. Deux réglages
 * égaux s'écrivent pareil, quel que soit l'ordre de leurs clés ou de leurs
 * cadrages.
 *
 * @param {ReglagesLocaux} reglages
 * @returns {string}
 * @throws {TypeError} une valeur connue hors de sa règle, que la lecture
 *         refuserait
 */
export function serialiserReglages(reglages) {
  const faute = fauteDeReglages(reglages);
  if (faute !== null) throw new TypeError(`serialiserReglages : ${faute || 'les réglages'} hors de sa règle`);
  return `${JSON.stringify(rangee({ ...reglages, cadrages: [...reglages.cadrages].sort(parEvenement) }))}\n`;
}

/**
 * Écrit les réglages dans racine : leur texte canonique, par une écriture
 * atomique de FICHIER_REGLAGES à sa racine. Le dossier de travail doit
 * exister : aucune écriture ne le recrée (§ 8.6).
 *
 * @param {import('./systeme_fichiers.js').SystemeFichiers} fs
 * @param {import('./systeme_fichiers.js').Racine} racine
 * @param {ReglagesLocaux} reglages
 * @returns {Promise<void>}
 * @throws {TypeError} des réglages hors de leur règle, avant toute écriture
 * @throws {ErreurStockage} ECRITURE, le fichier intact
 */
export async function ecrireReglages(fs, racine, reglages) {
  await fs.ecrireAtomique(racine, FICHIER_REGLAGES, serialiserReglages(reglages));
}

const rien = () => {};

/**
 * Écrivain différé des réglages (§ 8.5). La première demande arme un
 * minuteur de delaiMs ; celles qui suivent avant son terme remplacent les
 * réglages en attente sans le réarmer : le délai est borné, et un zoom
 * continu écrit une fois par délai. À son terme, ecrire reçoit les derniers
 * réglages demandés. Les écritures s'enchaînent sans jamais se chevaucher :
 * chacune attend la fin de la précédente.
 *
 * La dernière demande l'emporte sur tous les chemins. Chaque demande avance
 * un compteur, que chaque écriture relève au moment où elle prend les
 * réglages en attente. Une écriture refusée ne remet ses réglages en attente
 * que quand rien n'attend et que le compteur n'a pas bougé depuis ce relevé ;
 * la demande suivante, ou vider, les écrit alors. Une demande venue
 * entre-temps, qu'elle attende encore ou que son écriture soit déjà lancée,
 * est plus récente que les réglages refusés, qui ne reviennent pas.
 *
 * Le refus d'une écriture qu'a lancée le minuteur ne devient jamais un rejet
 * que rien ne traite : il va à signaler quand il est donné, et se tait sinon.
 * vider annule le minuteur, écrit tout de suite les réglages en attente et
 * rend la promesse de cette écriture, qui rejette sur son refus ; sans
 * réglages en attente, il n'écrit rien et rend une promesse que la fin
 * de l'écriture en cours résout.
 *
 * @param {Object} parametres
 * @param {(reglages: ReglagesLocaux) => Promise<void>} parametres.ecrire
 * @param {(fonction: () => void, delaiMs: number) => *} parametres.planifier
 *        arme un minuteur et rend de quoi l'annuler
 * @param {(minuteur: *) => void} parametres.annuler
 * @param {number} parametres.delaiMs   nombre fini ≥ 0
 * @param {((erreur: *) => void)|null} [parametres.signaler]
 * @returns {{demander: (reglages: ReglagesLocaux) => void, vider: () => Promise<void>}}
 * @throws {TypeError} un paramètre hors de sa forme
 */
export function creerEcrivainDiffere({ ecrire, planifier, annuler, delaiMs, signaler = null }) {
  for (const [nom, fonction] of [
    ['ecrire', ecrire],
    ['planifier', planifier],
    ['annuler', annuler],
  ]) {
    if (typeof fonction !== 'function') throw new TypeError(`creerEcrivainDiffere : ${nom} n'est pas une fonction`);
  }
  if (signaler !== null && typeof signaler !== 'function') {
    throw new TypeError("creerEcrivainDiffere : signaler n'est pas une fonction");
  }
  if (!Number.isFinite(delaiMs) || delaiMs < 0) {
    throw new TypeError(`creerEcrivainDiffere : délai fini ≥ 0 attendu, reçu ${JSON.stringify(delaiMs)}`);
  }
  // Les réglages à écrire, ou null ; le nombre de demandes reçues ; le
  // minuteur armé, ou null ; la fin de la dernière écriture lancée, qui ne
  // rejette jamais.
  let attente = null;
  let demandes = 0;
  let minuteur = null;
  let file = Promise.resolve();

  // Lance l'écriture des réglages en attente à la suite de la précédente, et
  // relève le nombre de demandes au moment où elle les prend. Rend sa
  // promesse, qui rejette sur son refus après avoir remis ces réglages en
  // attente quand rien n'attend et qu'aucune demande n'a suivi ce relevé.
  function ecrireEnAttente() {
    const reglages = attente;
    const releve = demandes;
    attente = null;
    const ecriture = file.then(() => ecrire(reglages));
    file = ecriture.then(rien, rien);
    return ecriture.then(rien, (erreur) => {
      if (attente === null && demandes === releve) attente = reglages;
      throw erreur;
    });
  }

  return {
    demander(reglages) {
      demandes += 1;
      attente = reglages;
      if (minuteur !== null) return;
      minuteur = planifier(() => {
        minuteur = null;
        ecrireEnAttente().catch((erreur) => {
          if (signaler !== null) signaler(erreur);
        });
      }, delaiMs);
    },
    vider() {
      if (minuteur !== null) {
        annuler(minuteur);
        minuteur = null;
      }
      return attente === null ? file : ecrireEnAttente();
    },
  };
}
