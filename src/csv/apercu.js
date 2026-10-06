// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Aperçu d'un texte CSV décodé, venu d'un fichier ou d'un collage en bloc
// (§ 10.1, § 10.2). L'aperçu n'importe rien : il dit, ligne par ligne, ce que
// l'import ferait contre les participants existants. Un fichier passe d'abord
// par decoder ; un collage, qui ne porte pas d'octets, arrive ici tel quel ;
// à partir d'ici, les deux suivent le même chemin, et un second analyseur ne
// peut pas diverger du premier.
//
// La lecture suit un ordre fixe, et le premier refus global arrête tout :
//   1. un caractère nul refuse le texte, par la règle de decoder ;
//   2. choisirSeparateur choisit le séparateur ; un texte vide ou blanc est
//      refusé AUCUN_ENTETE, tout autre texte sans séparateur
//      SEPARATEUR_INTROUVABLE, au rang du défaut que choisirSeparateur
//      nomme, sauf quand ce défaut est un guillemet resté ouvert : le texte
//      se lit alors sous le candidat qu'il écarte, jusqu'au refus du point 4 ;
//   3. decouper rend les enregistrements ; l'en-tête est le premier non vide ;
//   4. un guillemet resté ouvert refuse le texte : ce qui le suit tiendrait
//      dans un seul champ, et deux personnes se fondraient en une ;
//   5. aucun en-tête reconnu, puis aucune colonne associée à nom, refusent ;
//   6. chaque enregistrement non vide qui suit l'en-tête est une ligne,
//      valide ou refusée pour un seul motif ; zéro ligne valide refuse ;
//   7. les appartenances des lignes valides se réconcilient avec celles des
//      existants, et les doublons se relèvent.
// Une ligne refusée ne refuse pas le texte : le reste s'importe, et la ligne
// revient dans le CSV des refus (§ 10.1).

import { associer, reconnaitre } from './colonnes.js';
import { contientNul } from './encodage.js';
import { ErreurCsv } from './erreurs.js';
import { choisirSeparateur, decouper, enregistrementVide } from './lecture.js';
import { cleNormalisee } from './normalisation.js';

/**
 * Valeurs admises d'« exclu », par clé normalisée (cleNormalisee) : une liste
 * fermée. Une valeur absente de la liste refuse la ligne. La clé vide dit ce
 * que vaut une cellule vide pour une personne créée, non ; l'aperçu rend
 * pourtant null pour une cellule vide, qu'une mise à jour lit comme « garder
 * la valeur » (voir ChampsLus).
 *
 * @type {Map<string, boolean>}
 */
export const VALEURS_EXCLU = new Map([
  ['oui', true],
  ['o', true],
  ['vrai', true],
  ['1', true],
  ['x', true],
  ['non', false],
  ['n', false],
  ['faux', false],
  ['0', false],
  ['', false],
]);

/**
 * @typedef {Object} ChampsLus
 * @property {string} nom
 * @property {string|null} prenom
 * @property {string|null} appartenance    l'orthographe affichée de son groupe ;
 *           null pour une cellule vide, blanche ou faite de marques
 *           combinantes seules : sa clé normalisée est vide
 * @property {string|null} courriel
 * @property {string|null} titrePressenti
 * @property {string|null} notes
 * @property {boolean|null} exclu          null pour une cellule vide ou une
 *           colonne absente : vide vaut non pour une personne créée, et laisse
 *           la valeur d'une personne existante qu'un import met à jour
 *
 * @typedef {Object} Apercu
 * @property {string|null} separateur      null pour un fichier à une colonne,
 *           et quand aucun séparateur n'est établi : sous CARACTERE_NUL, sous
 *           SEPARATEUR_INTROUVABLE, pour un texte vide ou blanc
 * @property {string[]} entetes            tels qu'écrits
 * @property {{colonnes: Object<string, number>, ambigus: Array<{champ: string, rangs: number[]}>,
 *             nonReconnues: number[]}} association   ce que rend associer
 * @property {Array<{ligne: number, champs: ChampsLus, brut: string[]}>} lignes
 *           les lignes valides ; ligne : rang de l'enregistrement à partir de
 *           1, l'en-tête compris ; champs : chaînes en NFC, blancs de bord
 *           retirés, vide → null ; brut : les champs tels que découpés
 * @property {Array<{ligne: number, code: string, valeur: string|null, brut: string[]}>} refusees
 *           code : CHAMPS_EN_TROP, NOM_ABSENT, EXCLU_INCONNU ; valeur : la
 *           valeur d'« exclu » refusée, en NFC sans ses blancs de bord, null
 *           pour les deux autres codes
 * @property {Array<{affichee: string, orthographes: Array<{texte: string, lignes: number[]}>}>} fusions
 *           chaque groupe d'au moins deux orthographes, existantes comprises,
 *           qui porte une ligne valide, rangé par sa première ligne ;
 *           orthographes dans l'ordre de rencontre, la première affichée ;
 *           lignes : rangs des lignes valides de cette orthographe, vide pour
 *           une orthographe que seuls des participants existants portent
 * @property {Array<{cle: string, lignes: number[], existants: number[]}>} doublons
 *           chaque triplet (nom, prénom, appartenance) normalisé que portent au
 *           moins deux personnes, dont une ligne valide, rangé par sa première
 *           ligne ; cle : le triplet normalisé, en JSON ; existants :
 *           identifiants croissants
 * @property {null|'CARACTERE_NUL'|'AUCUN_ENTETE'|'SEPARATEUR_INTROUVABLE'|'GUILLEMET_OUVERT'|'NOM_NON_ASSOCIE'|'AUCUNE_LIGNE_VALIDE'} refusGlobal
 *           sous un refus global, lignes, fusions et doublons sont vides, et
 *           refusees aussi, sauf sous AUCUNE_LIGNE_VALIDE, dont les lignes
 *           refusées sont la cause
 * @property {number|null} refusGlobalLigne   sous GUILLEMET_OUVERT, le rang de
 *           l'enregistrement où le guillemet s'ouvre ; sous
 *           SEPARATEUR_INTROUVABLE, celui de l'enregistrement dont le nombre
 *           de champs écarte le séparateur, quand choisirSeparateur le nomme ;
 *           null sinon
 */

// Aperçu d'un texte refusé en entier : ce que la lecture a établi avant le
// refus, aucune ligne.
function refuser(
  code,
  { separateur = null, entetes = [], association = { colonnes: {}, ambigus: [], nonReconnues: [] } } = {},
  ligne = null,
) {
  return {
    separateur,
    entetes,
    association,
    lignes: [],
    refusees: [],
    fusions: [],
    doublons: [],
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

// Vrai pour une appartenance qui en nomme une : une chaîne dont la clé
// normalisée n'est pas vide. Une appartenance vide, blanche ou faite de
// marques combinantes seules vaut absence (§ 10.1) : la clé de doublon la
// compte vide, comme une appartenance absente, et elle n'est l'orthographe
// d'aucun groupe. La réconciliation et la clé de doublon s'accordent ainsi
// sur chaque appartenance, lue ou existante.
const appartenanceNommee = (texte) => typeof texte === 'string' && cleNormalisee(texte) !== '';

// Lit un enregistrement de données selon les colonnes associées, largeur
// étant le nombre d'en-têtes. Rend { champs }, l'appartenance telle qu'écrite
// ou null quand elle n'en nomme aucune, ou le motif du refus { code, valeur },
// un seul, dans cet ordre : un champ non vide au-delà de l'en-tête, qui dit
// une ligne décalée dont aucune valeur n'est sûre ; un nom vide ; une valeur
// d'« exclu » hors de la liste fermée.
function lireLigne(brut, largeur, colonnes) {
  if (!enregistrementVide(brut.slice(largeur))) return { code: 'CHAMPS_EN_TROP', valeur: null };
  const lire = (champ) => valeurDe(brut, colonnes[champ]);
  const nom = lire('nom');
  if (nom === null) return { code: 'NOM_ABSENT', valeur: null };
  const valeurExclu = lire('exclu');
  const exclu = valeurExclu === null ? null : VALEURS_EXCLU.get(cleNormalisee(valeurExclu));
  if (exclu === undefined) return { code: 'EXCLU_INCONNU', valeur: valeurExclu };
  const appartenance = lire('appartenance');
  return {
    champs: {
      nom,
      prenom: lire('prenom'),
      appartenance: appartenanceNommee(appartenance) ? appartenance : null,
      courriel: lire('courriel'),
      titrePressenti: lire('titre_pressenti'),
      notes: lire('notes'),
      exclu,
    },
  };
}

// Réconcilie les appartenances (§ 10.1). Les orthographes de même clé
// normalisée forment un groupe, que représente la première rencontrée :
// celles des participants existants d'abord, dans l'ordre de existants,
// telles qu'enregistrées, puis celles des lignes valides, dans l'ordre du
// texte. Rend l'orthographe affichée du groupe d'un texte, et les fusions :
// chaque groupe d'au moins deux orthographes qui porte une ligne valide,
// rangé par sa première ligne.
function reconcilier(existants, valides) {
  const groupes = new Map();
  const noter = (texte, ligne) => {
    const cle = cleNormalisee(texte);
    let groupe = groupes.get(cle);
    if (groupe === undefined) {
      groupe = { affichee: texte, orthographes: [], parTexte: new Map(), lignes: [] };
      groupes.set(cle, groupe);
    }
    let orthographe = groupe.parTexte.get(texte);
    if (orthographe === undefined) {
      orthographe = { texte, lignes: [] };
      groupe.orthographes.push(orthographe);
      groupe.parTexte.set(texte, orthographe);
    }
    if (ligne !== null) {
      orthographe.lignes.push(ligne);
      groupe.lignes.push(ligne);
    }
  };
  for (const { appartenance } of existants) {
    if (appartenanceNommee(appartenance)) noter(appartenance, null);
  }
  for (const { ligne, champs } of valides) {
    if (champs.appartenance !== null) noter(champs.appartenance, ligne);
  }
  const fusions = [...groupes.values()]
    .filter((groupe) => groupe.orthographes.length > 1 && groupe.lignes.length > 0)
    .sort((a, b) => a.lignes[0] - b.lignes[0])
    .map(({ affichee, orthographes }) => ({ affichee, orthographes }));
  return { afficheeDe: (texte) => groupes.get(cleNormalisee(texte)).affichee, fusions };
}

// Clé de doublon : le triplet (nom, prénom, appartenance), chacun par sa clé
// normalisée, un prénom ou une appartenance absents comptant comme vides,
// écrit en JSON pour qu'aucun texte ne se confonde avec une frontière.
const cleDoublon = (nom, prenom, appartenance) =>
  JSON.stringify([nom, prenom ?? '', appartenance ?? ''].map((texte) => cleNormalisee(texte)));

// Doublons (§ 10.1) : chaque clé de doublon que portent au moins deux
// personnes, dont une ligne valide, avec les rangs de ses lignes et les
// identifiants de ses existants, rangée par sa première ligne. Un doublon est
// signalé, jamais fusionné : deux personnes peuvent porter le même nom.
function doublonsDe(existants, valides) {
  const groupes = new Map();
  const groupeDe = (cle) => {
    if (!groupes.has(cle)) groupes.set(cle, { cle, lignes: [], existants: [] });
    return groupes.get(cle);
  };
  for (const { id, nom, prenom, appartenance } of existants) {
    groupeDe(cleDoublon(nom, prenom, appartenance)).existants.push(id);
  }
  for (const { ligne, champs } of valides) {
    groupeDe(cleDoublon(champs.nom, champs.prenom, champs.appartenance)).lignes.push(ligne);
  }
  return [...groupes.values()]
    .filter((groupe) => groupe.lignes.length > 0 && groupe.lignes.length + groupe.existants.length > 1)
    .sort((a, b) => a.lignes[0] - b.lignes[0]);
}

/**
 * Aperçu d'un texte décodé, import ou collage, contre les participants
 * existants : rien n'est importé.
 *
 * @param {string} texte  le texte que rend decoder, ou celui d'un collage
 * @param {Object} [options]
 * @param {Array<{id: number, nom: string, prenom: string|null, appartenance: string|null}>} [options.participants]
 *   les participants existants, dans n'importe quel ordre : l'identifiant
 *   ordonne leurs orthographes
 * @param {Object<string, number>} [options.choix]  { champ: rang } qui tranche
 *   une ambiguïté de l'en-tête (voir associer)
 * @returns {Apercu}
 * @throws {TypeError} quand texte n'est pas une chaîne : des octets passent
 *   d'abord par decoder
 */
export function apercevoir(texte, { participants = [], choix = {} } = {}) {
  if (typeof texte !== 'string') throw new TypeError('texte : chaîne attendue');
  if (contientNul(texte)) return refuser('CARACTERE_NUL');

  let separateur;
  try {
    ({ separateur } = choisirSeparateur(texte, reconnaitre));
  } catch (erreur) {
    // Sur une chaîne, choisirSeparateur ne lève que SEPARATEUR_INTROUVABLE ;
    // toute autre erreur est un défaut, qu'un refus de l'aperçu masquerait.
    if (!(erreur instanceof ErreurCsv) || erreur.code !== 'SEPARATEUR_INTROUVABLE') throw erreur;
    if (texte.trim() === '') return refuser('AUCUN_ENTETE');
    const { cause = null, ligne = null } = erreur.details;
    if (cause !== 'GUILLEMET_OUVERT') return refuser('SEPARATEUR_INTROUVABLE', {}, ligne);
    // Seul le guillemet resté ouvert écarte ce candidat : le texte se lit
    // sous lui, et le refus GUILLEMET_OUVERT porte le séparateur, l'en-tête,
    // l'association et le rang, comme au-delà de la fenêtre.
    ({ separateur } = erreur.details);
  }

  const { enregistrements, guillemetOuvert } = decouper(texte, separateur);
  // Le séparateur, retenu ou écarté par le seul guillemet ouvert, a lu un
  // enregistrement non vide dans la fenêtre du choix : l'en-tête existe.
  const indiceEntete = enregistrements.findIndex((enregistrement) => !enregistrementVide(enregistrement));
  const entetes = enregistrements[indiceEntete];
  const association = associer(entetes, choix);
  const lu = { separateur, entetes, association };
  if (guillemetOuvert) return refuser('GUILLEMET_OUVERT', lu, enregistrements.length);
  if (association.nonReconnues.length === entetes.length) return refuser('AUCUN_ENTETE', lu);
  if (association.colonnes.nom === undefined) return refuser('NOM_NON_ASSOCIE', lu);

  const valides = [];
  const refusees = [];
  for (let indice = indiceEntete + 1; indice < enregistrements.length; indice += 1) {
    const brut = enregistrements[indice];
    if (enregistrementVide(brut)) continue;
    const ligne = indice + 1;
    const lecture = lireLigne(brut, entetes.length, association.colonnes);
    if (lecture.champs === undefined) refusees.push({ ligne, code: lecture.code, valeur: lecture.valeur, brut });
    else valides.push({ ligne, champs: lecture.champs, brut });
  }
  if (valides.length === 0) return { ...refuser('AUCUNE_LIGNE_VALIDE', lu), refusees };

  const existants = [...participants].sort((a, b) => a.id - b.id);
  const { afficheeDe, fusions } = reconcilier(existants, valides);
  const lignes = valides.map(({ ligne, champs, brut }) => ({
    ligne,
    champs: { ...champs, appartenance: champs.appartenance === null ? null : afficheeDe(champs.appartenance) },
    brut,
  }));
  return {
    ...lu,
    lignes,
    refusees,
    fusions,
    doublons: doublonsDe(existants, lignes),
    refusGlobal: null,
    refusGlobalLigne: null,
  };
}
