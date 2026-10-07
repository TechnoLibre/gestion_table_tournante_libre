// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le modèle de l'aperçu d'import (§ 10.1, § 10.2) : ce que l'aperçu montre,
// en clés de libellés et en données, d'un fichier décodé, d'un fichier que
// decoder refuse, ou d'un collage. Le texte vient de la traduction ; ce
// module ne choisit que les clés, et ne recalcule rien de ce que l'aperçu de
// src/csv établit : association, lignes, fusions et doublons s'y lisent tels
// quels.
import { CHAMPS } from '../../application/csv.js';

/** La clé du nom de chaque encodage que rend decoder, dans l'ordre de ses
 *  quatre temps. */
export const ENCODAGES = new Map([
  ['utf-8-bom', 'import.encodage.utf8Marque'],
  ['utf-16le', 'import.encodage.utf16le'],
  ['utf-16be', 'import.encodage.utf16be'],
  ['utf-8', 'import.encodage.utf8'],
  ['windows-1252', 'import.encodage.windows1252'],
]);

/** La clé du nom de chaque séparateur de l'aperçu ; null : le fichier n'a
 *  qu'une colonne. */
export const SEPARATEURS = new Map([
  [';', 'import.separateur.pointVirgule'],
  [',', 'import.separateur.virgule'],
  ['\t', 'import.separateur.tabulation'],
  [null, 'import.separateur.uneColonne'],
]);

// La clé du nom de chaque champ, dans l'ordre de CHAMPS.
const CLES_DES_CHAMPS = new Map([
  ['nom', 'import.champ.nom'],
  ['prenom', 'import.champ.prenom'],
  ['appartenance', 'import.champ.appartenance'],
  ['courriel', 'import.champ.courriel'],
  ['titre_pressenti', 'import.champ.titrePressenti'],
  ['exclu', 'import.champ.exclu'],
  ['notes', 'import.champ.notes'],
]);

// La clé de la valeur lue d'« exclu » ; une cellule vide n'en a pas.
const CLES_D_EXCLU = new Map([
  [true, 'import.exclu.oui'],
  [false, 'import.exclu.non'],
]);

// Le nom de chaque champ dans ChampsLus, celui de l'aperçu de src/csv.
const CHAMPS_LUS = new Map([['titre_pressenti', 'titrePressenti']]);

/** Les trois modes de l'import (§ 10.1), dans l'ordre où l'écran les
 *  offre, et la clé de leur nom. */
export const MODES_D_IMPORT = Object.freeze(
  [
    ['ajouter', 'import.mode.ajouter'],
    ['mettreAJour', 'import.mode.mettreAJour'],
    ['remplacer', 'import.mode.remplacer'],
  ].map(([mode, cle]) => Object.freeze({ mode, cle })),
);

/** Les colonnes du tableau des lignes : chaque champ, dans l'ordre de
 *  CHAMPS, et la clé de son nom. */
export const COLONNES_DES_LIGNES = Object.freeze(CHAMPS.map((champ) => Object.freeze({ champ, cle: CLES_DES_CHAMPS.get(champ) })));

// Le remède d'un refus de decoder : le code que ses détails portent, que le
// texte du refus compose déjà (contrat « Refus et avertissements »).
const REFUS_DE_DECODER = new Set(['UTF16_SANS_MARQUE', 'UTF16_INVALIDE', 'UTF8_INVALIDE', 'CARACTERE_NUL']);

// La clé du remède de chaque refus global de l'aperçu. Un caractère nul n'y
// arrive que d'un texte collé : celui d'un fichier, decoder le refuse.
const REMEDES_DE_L_APERCU = new Map([
  ['CARACTERE_NUL', 'import.remede.caractereNulCollage'],
  ['AUCUN_ENTETE', 'import.remede.aucunEntete'],
  ['NOM_NON_ASSOCIE', 'import.remede.nomNonAssocie'],
  ['AUCUNE_LIGNE_VALIDE', 'import.remede.aucuneLigneValide'],
  ['GUILLEMET_OUVERT', 'import.remede.guillemetOuvert'],
  ['SEPARATEUR_INTROUVABLE', 'import.remede.separateurIntrouvable'],
]);

// Le remède d'un collage auquel l'aperçu offre l'ordre de la grille.
const REMEDES_DE_LA_GRILLE = new Map([
  ['AUCUN_ENTETE', 'import.remede.aucunEnteteCollage'],
  ['SEPARATEUR_INTROUVABLE', 'import.remede.separateurIntrouvableCollage'],
]);

// La valeur d'une table de clés, ou RangeError qui nomme ce qui manque :
// jamais une clé devinée.
function dans(table, valeur, quoi) {
  if (!table.has(valeur)) throw new RangeError(`import : ${quoi} inconnu ${JSON.stringify(valeur)}`);
  return table.get(valeur);
}

// Vrai quand l'aperçu offre la lecture dans l'ordre de la grille : un texte
// non blanc sans en-tête reconnu, ou une seule colonne sans séparateur.
function offreLaGrille(apercu) {
  if (apercu.refusGlobal === 'AUCUN_ENTETE') return apercu.entetes.length > 0;
  return apercu.refusGlobal === 'SEPARATEUR_INTROUVABLE' && apercu.refusGlobalLigne === null;
}

// Le refus global d'un refus de decoder : sa cause, le code ; son remède,
// le code de details.remede, déjà dans la cause.
function globalDeDecoder({ code, details }) {
  if (!REFUS_DE_DECODER.has(code)) throw new RangeError(`import : refus de decoder inconnu ${JSON.stringify(code)}`);
  return { cle: code, details, remede: { cle: details.remede, details: {}, dansLaCause: true } };
}

// Le refus global d'un aperçu, null sans refus. Un collage auquel l'aperçu
// offre l'ordre de la grille prend le remède qui le nomme.
function globalDeLApercu(apercu, collage) {
  const code = apercu.refusGlobal;
  if (code === null) return null;
  const remede = collage && offreLaGrille(apercu) ? REMEDES_DE_LA_GRILLE.get(code) : dans(REMEDES_DE_L_APERCU, code, 'refus global');
  const rang = apercu.refusGlobalLigne;
  const details = rang === null ? {} : { ligne: rang };
  return { cle: code, details, remede: { cle: remede, details, dansLaCause: false } };
}

// Le nom du séparateur, quand la lecture l'a établi : rien sous un caractère
// nul, un séparateur introuvable ou un texte blanc, où l'aperçu porte null
// sans que le texte ait une seule colonne.
function separateurDe(apercu) {
  const nonEtabli =
    apercu.refusGlobal === 'CARACTERE_NUL' ||
    apercu.refusGlobal === 'SEPARATEUR_INTROUVABLE' ||
    apercu.entetes.length === 0;
  return nonEtabli ? null : dans(SEPARATEURS, apercu.separateur, 'séparateur');
}

// Chaque colonne de l'en-tête : son rang, son en-tête tel qu'écrit, et la
// clé de ce qu'elle devient — un champ, une colonne à trancher, une colonne
// écartée par le choix d'une autre, une colonne non reconnue.
function colonnesDe({ entetes, association }) {
  const champDuRang = new Map(CHAMPS.filter((champ) => Object.hasOwn(association.colonnes, champ)).map((champ) => [association.colonnes[champ], champ]));
  const aTrancher = new Set(association.ambigus.flatMap(({ rangs }) => rangs));
  const nonReconnues = new Set(association.nonReconnues);
  return entetes.map((entete, rang) => {
    let cle = 'import.colonne.ecartee';
    if (champDuRang.has(rang)) cle = CLES_DES_CHAMPS.get(champDuRang.get(rang));
    else if (aTrancher.has(rang)) cle = 'import.colonne.aTrancher';
    else if (nonReconnues.has(rang)) cle = 'import.colonne.nonReconnue';
    return { rang, entete, cle };
  });
}

// Chaque ligne valide : son rang, puis une cellule par champ, dans l'ordre
// de CHAMPS : le texte lu, ou la clé de la valeur d'« exclu ».
function lignesDe(lignes) {
  return lignes.map(({ ligne, champs }) => ({
    ligne,
    cellules: CHAMPS.map((champ) => {
      const valeur = champs[CHAMPS_LUS.get(champ) ?? champ];
      if (champ === 'exclu') return { champ, texte: null, cle: valeur === null ? null : CLES_D_EXCLU.get(valeur) };
      return { champ, texte: valeur, cle: null };
    }),
  }));
}

/**
 * Les lignes refusées, par l'aperçu ou par la mise à jour, telles que
 * l'aperçu et le rapport les montrent : le rang, le code, et les détails que
 * reçoit le motif — la ligne refusée sans son code ni ses champs découpés,
 * comme exporterRefus les passe au motif du CSV.
 *
 * @param {Array<{ligne: number, code: string, brut: string[]}>} refusees
 * @returns {Array<{ligne: number, code: string, details: Object}>}
 */
export function refuseesDe(refusees) {
  return refusees.map(({ code, brut, ...details }) => ({ ligne: details.ligne, code, details }));
}

/**
 * Les personnes que désigne une liste d'identifiants, dans son ordre ; un
 * identifiant que la liste des participants ne porte plus est omis.
 *
 * @param {Array<{id: number, nom: string, prenom: string|null}>} participants
 * @param {number[]} ids
 * @returns {Array<{id: number, nom: string, prenom: string|null}>}
 */
export function nommer(participants, ids) {
  const parId = new Map(participants.map((participant) => [participant.id, participant]));
  return ids.filter((id) => parId.has(id)).map((id) => {
    const { nom, prenom } = parId.get(id);
    return { id, nom, prenom };
  });
}

/**
 * Le mode d'import proposé (§ 10.1) : Ajouter pour un événement sans
 * participant, Mettre à jour sinon. Remplacer ne se propose jamais : il se
 * choisit.
 *
 * @param {Array<Object>} participants
 * @returns {'ajouter'|'mettreAJour'}
 */
export function modePropose(participants) {
  return participants.length === 0 ? 'ajouter' : 'mettreAJour';
}

// Un modèle vide : rien de lu.
const RIEN = Object.freeze({
  encodage: null,
  separateur: null,
  colonnes: [],
  ambigus: [],
  valides: 0,
  lignes: [],
  refusees: [],
  fusions: [],
  doublons: [],
  homonymes: [],
  multilignes: [],
  global: null,
});

/**
 * Ce que l'aperçu montre, d'un fichier ou d'un collage : encodage (null pour
 * un collage) et séparateur nommés — « une seule colonne » pour un
 * séparateur null —, association par colonne, ambiguïtés, lignes valides et
 * refusées, fusions, doublons, et le refus global, de decoder (refusDecodage,
 * apercu null) ou de l'aperçu (apercu.refusGlobal), avec la clé de sa cause
 * et celle de son remède — en clés de libellés et en données.
 *
 * La cause est le code du refus, sa propre clé ; ses détails sont ceux de
 * decoder, ou { ligne } quand l'aperçu nomme un rang. Le remède d'un refus
 * de decoder est le code de details.remede, que le texte de la cause compose
 * déjà : remede.dansLaCause le dit, et l'écran ne le répète pas.
 *
 * @param {{encodage?: string|null, apercu?: Object|null, refusDecodage?: {code: string, details: Object}|null}} entree
 *   encodage : celui que rend decoder, null pour un collage
 * @returns {{
 *   encodage: string|null, separateur: string|null,
 *   colonnes: Array<{rang: number, entete: string, cle: string}>,
 *   ambigus: Array<{champ: string, cle: string, rangs: Array<{rang: number, entete: string}>}>,
 *   valides: number,
 *   lignes: Array<{ligne: number, cellules: Array<{champ: string, texte: string|null, cle: string|null}>}>,
 *   refusees: Array<{ligne: number, code: string, details: Object}>,
 *   fusions: Array<{affichee: string, orthographes: Array<{texte: string, lignes: number}>}>,
 *   doublons: Array<{lignes: number[], existants: number[]}>,
 *   homonymes: Array<{ligne: number, participants: number[]}>,
 *   multilignes: Array<{ligne: number, rangs: number[]}>,
 *   global: null|{cle: string, details: Object, remede: {cle: string, details: Object, dansLaCause: boolean}},
 * }}
 *   encodage, separateur, colonnes[].cle et ambigus[].cle sont des clés de
 *   traduction, comme lignes[].cellules[].cle, celle de la valeur
 *   d'« exclu » ; refusees[].details, ceux que reçoit le motif d'une ligne
 *   (motifLigne) ; fusions[].orthographes[].lignes, le nombre de lignes de
 *   l'orthographe, 0 pour celle que seuls des participants existants portent
 * @throws {RangeError} un encodage, un séparateur ou un refus sans clé
 */
export function modeleApercu({ encodage = null, apercu = null, refusDecodage = null }) {
  if (refusDecodage !== null) return { ...RIEN, global: globalDeDecoder(refusDecodage) };
  if (apercu === null) return { ...RIEN };
  const { entetes, association } = apercu;
  return {
    encodage: encodage === null ? null : dans(ENCODAGES, encodage, 'encodage'),
    separateur: separateurDe(apercu),
    colonnes: colonnesDe(apercu),
    ambigus: association.ambigus.map(({ champ, rangs }) => ({
      champ,
      cle: CLES_DES_CHAMPS.get(champ),
      rangs: rangs.map((rang) => ({ rang, entete: entetes[rang] })),
    })),
    valides: apercu.lignes.length,
    lignes: lignesDe(apercu.lignes),
    refusees: refuseesDe(apercu.refusees),
    fusions: apercu.fusions.map(({ affichee, orthographes }) => ({
      affichee,
      orthographes: orthographes.map(({ texte, lignes }) => ({ texte, lignes: lignes.length })),
    })),
    doublons: apercu.doublons.map(({ lignes, existants }) => ({ lignes, existants })),
    homonymes: apercu.homonymes,
    multilignes: apercu.multilignes,
    global: globalDeLApercu(apercu, encodage === null),
  };
}

/**
 * Le texte relu dans l'ordre de la grille : précédé d'une ligne d'en-têtes —
 * les largeur premiers de CHAMPS, puis des en-têtes vides au-delà de sept —,
 * joints par le séparateur de l'aperçu. Sous AUCUN_ENTETE d'un texte non
 * blanc, largeur vaut apercu.entetes.length ; sous SEPARATEUR_INTROUVABLE
 * sans candidat (refusGlobalLigne null : une seule colonne), largeur vaut 1
 * et la ligne est « nom ». null sous tout autre aperçu. Offert pour un
 * collage, jamais appliqué seul : le texte rendu repasse par apercevoir, et
 * les rangs de ce second aperçu comptent la ligne ajoutée.
 *
 * @param {string} texte  le texte de l'aperçu
 * @param {Object} apercu  l'aperçu de ce texte
 * @returns {string|null}
 */
export function avecEntetesDeLaGrille(texte, apercu) {
  if (!offreLaGrille(apercu)) return null;
  const largeur = apercu.refusGlobal === 'AUCUN_ENTETE' ? apercu.entetes.length : 1;
  const entetes = Array.from({ length: largeur }, (_, rang) => CHAMPS[rang] ?? '');
  return `${entetes.join(apercu.separateur ?? '')}\n${texte}`;
}

/**
 * Le motif d'une ligne refusée, tel que l'aperçu et le rapport l'affichent :
 * (code, details) → t(code, details). Le CSV des refus ne le reçoit pas :
 * son motif est celui de libelle, que lie exporterRefus de
 * src/application/csv.js.
 *
 * @param {(cle: string, details?: Object) => string} t
 * @returns {(code: string, details: Object) => string}
 */
export function motifLigne(t) {
  return (code, details) => t(code, details);
}
