// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

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
//      valide ou refusée pour un seul motif ; zéro ligne valide refuse. La
//      présence se lit sous le nombre de tours de l'aperçu (Apercu.tours),
//      le seul réglage de l'événement que l'aperçu reçoive ;
//   7. les organisations des lignes valides se réconcilient avec celles des
//      existants, et les doublons se relèvent ; en mode remplacer, qui
//      retire chaque existant, avec ceux du fichier seuls. Leurs étiquettes
//      se réconcilient avec celles des existants, hors du mode remplacer, et
//      avec celles des objectifs de table dans chaque mode : les objectifs
//      appartiennent aux tables, que remplacer garde ;
//   8. en mode mettreAJour, les lignes ajoutées à côté d'un existant de même
//      nom se nomment ; dans chaque mode, les cellules qui s'étendent sur
//      plusieurs lignes du texte et portent le séparateur.
// Une ligne refusée ne refuse pas le texte : le reste s'importe, et la ligne
// revient dans le CSV des refus (§ 10.1).

import { TOURS_MAX } from '../stockage/document.js';
import { ETIQUETTES_MAX, lireEtiquettes } from '../stockage/etiquettes.js';
import { associer, reconnaitre } from './colonnes.js';
import { contientNul } from './encodage.js';
import { ErreurCsv } from './erreurs.js';
import { cleEtiquette, reconcilier as reconcilierEtiquettes } from './etiquettes.js';
import { choisirSeparateur, decouper, enregistrementVide } from './lecture.js';
import { cleNormalisee } from './normalisation.js';
import { lirePresence } from './presence.js';

/**
 * Modes de l'import, que l'aperçu et l'import reçoivent tous deux (§ 10.1).
 *
 * @type {readonly string[]}
 */
export const MODES = Object.freeze(['ajouter', 'mettreAJour', 'remplacer']);

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
 * @property {string|null} organisation    l'orthographe affichée de son groupe ;
 *           null pour une cellule vide, blanche ou faite de marques
 *           combinantes seules : sa clé normalisée est vide
 * @property {string|null} courriel
 * @property {string|null} titrePressenti
 * @property {string|null} notes
 * @property {boolean|null} exclu          null pour une cellule vide ou une
 *           colonne absente : vide vaut non pour une personne créée, et laisse
 *           la valeur d'une personne existante qu'un import met à jour
 * @property {string[]|null} etiquettes    les étiquettes de la cellule,
 *           découpées par lireEtiquettes, dans l'ordre de la cellule, chacune
 *           sous l'orthographe que la réconciliation lui donne, sans deux de
 *           même clé, ETIQUETTES_MAX au plus ; null pour une colonne absente
 *           ou une cellule qui n'en donne aucune — vide, blanche ou faite de
 *           séparateurs —, qui laisse celles d'une personne mise à jour
 * @property {number[]|null} presence      les tours de présence lus par
 *           lirePresence sous Apercu.tours, croissants, 1..R pour « tous » ;
 *           null pour une colonne absente ou une cellule vide ou blanche :
 *           vide vaut tous les tours pour une personne créée, et laisse la
 *           présence d'une personne mise à jour
 *
 * @typedef {Object} Apercu
 * @property {'ajouter'|'mettreAJour'|'remplacer'} mode   le mode pour lequel
 *           l'aperçu est calculé : appliquerImport n'applique l'aperçu que
 *           dans ce mode
 * @property {number} tours                le nombre de tours sous lequel la
 *           présence est lue, porté sous un refus global comme sans :
 *           appliquerImport refuse un aperçu dont la colonne de la présence
 *           est associée sous un autre nombre de tours que l'événement
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
 * @property {Array<{ligne: number, code: string, valeur: string|null, raison?: string, nombre?: number,
 *             tour?: number, tours?: number, brut: string[]}>} refusees
 *           code : CHAMPS_EN_TROP, NOM_ABSENT, EXCLU_INCONNU,
 *           ETIQUETTE_MAL_FORMEE, ETIQUETTES_TROP_NOMBREUSES,
 *           PRESENCE_ILLISIBLE, PRESENCE_HORS_TOURS ; valeur : la valeur
 *           d'« exclu » ou de la présence refusée, en NFC sans ses blancs de
 *           bord, ou la première étiquette fautive de la cellule, mise en
 *           forme ; null pour les autres codes ; raison, sous
 *           ETIQUETTE_MAL_FORMEE : 'controle' ou 'longueur', celle de
 *           lireEtiquettes ; sous PRESENCE_ILLISIBLE : 'syntaxe',
 *           'intervalle' ou 'date', celle de lirePresence ; nombre, sous
 *           ETIQUETTES_TROP_NOMBREUSES : les étiquettes de clés distinctes
 *           que porte la cellule ; tour et tours, sous PRESENCE_HORS_TOURS :
 *           le premier tour fautif et le nombre de tours de l'aperçu
 * @property {Array<{affichee: string, orthographes: Array<{texte: string, lignes: number[]}>}>} fusions
 *           chaque groupe d'au moins deux orthographes, existantes comprises
 *           hors du mode remplacer, qui porte une ligne valide, rangé par sa
 *           première ligne ;
 *           orthographes dans l'ordre de rencontre, la première affichée ;
 *           lignes : rangs des lignes valides de cette orthographe, vide pour
 *           une orthographe que seuls des participants existants portent
 * @property {import('./etiquettes.js').FusionEtiquettes[]} fusionsEtiquettes
 *           les fusions d'orthographes d'étiquettes que rend reconcilier
 *           (etiquettes.js) sur les lignes valides : chacune nomme
 *           l'orthographe retenue, les orthographes de sa clé et son nombre
 *           de lignes réécrites ; distinctes des fusions des organisations
 * @property {Array<{cle: string, lignes: number[], existants: number[]}>} doublons
 *           chaque triplet (nom, prénom, organisation) normalisé que portent au
 *           moins deux personnes, dont une ligne valide, rangé par sa première
 *           ligne ; cle : le triplet normalisé, en JSON ; existants :
 *           identifiants croissants, toujours vide en mode remplacer
 * @property {Array<{ligne: number, participants: number[]}>} homonymes
 *           en mode mettreAJour, chaque ligne valide qui ne désigne personne
 *           (designer) alors que des existants portent son nom normalisé :
 *           l'import l'ajoute à côté d'eux, une seconde personne de ce nom,
 *           parce que le prénom ou l'organisation, présents des deux côtés,
 *           diffèrent ; participants : ces existants, identifiants
 *           croissants ; rangée par ligne. Toujours vide dans les autres
 *           modes : ajouter crée chaque ligne, remplacer retire chaque
 *           existant
 * @property {number[]} designees
 *           en mode mettreAJour, les rangs croissants des lignes valides que
 *           designer fait désigner à un participant existant au moins :
 *           l'import met à jour ou refuse ces lignes, et ne les crée jamais ;
 *           une cellule vide y garde la valeur de la personne. Toujours vide
 *           dans les autres modes, où chaque ligne est créée
 * @property {Array<{ligne: number, rangs: number[]}>} multilignes
 *           chaque ligne valide dont une cellule au moins s'étend sur
 *           plusieurs lignes du texte et porte le séparateur, rangée par
 *           ligne ; rangs : les rangs croissants de ces cellules dans brut.
 *           Sans séparateur, la fin de ligne seule suffit. C'est la forme
 *           que laisse un guillemet égaré qu'un autre guillemet referme plus
 *           loin, devant le séparateur ou une fin de ligne : les
 *           enregistrements d'entre les deux tiennent dans la cellule, et
 *           deux personnes se fondent en une. Une note écrite sur plusieurs
 *           lignes a la même forme, et l'export l'écrit ainsi (§ 10.2) :
 *           l'aperçu la nomme sans refuser la ligne
 * @property {null|'CARACTERE_NUL'|'AUCUN_ENTETE'|'SEPARATEUR_INTROUVABLE'|'GUILLEMET_OUVERT'|'NOM_NON_ASSOCIE'|'AUCUNE_LIGNE_VALIDE'} refusGlobal
 *           sous un refus global, lignes, fusions, fusionsEtiquettes,
 *           doublons, homonymes, designees et multilignes sont vides, et refusees aussi, sauf sous AUCUNE_LIGNE_VALIDE, dont les lignes
 *           refusées sont la cause
 * @property {number|null} refusGlobalLigne   sous GUILLEMET_OUVERT, le rang de
 *           l'enregistrement où le guillemet s'ouvre ; sous
 *           SEPARATEUR_INTROUVABLE, celui de l'enregistrement dont le nombre
 *           de champs écarte le séparateur, quand choisirSeparateur le nomme ;
 *           null sinon
 */

// Aperçu d'un texte refusé en entier : son mode et son nombre de tours, ce
// que la lecture a établi avant le refus, aucune ligne.
function refuserEn(
  { mode, tours },
  code,
  { separateur = null, entetes = [], association = { colonnes: {}, ambigus: [], nonReconnues: [] } } = {},
  ligne = null,
) {
  return {
    mode,
    tours,
    separateur,
    entetes,
    association,
    lignes: [],
    refusees: [],
    fusions: [],
    fusionsEtiquettes: [],
    doublons: [],
    homonymes: [],
    designees: [],
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

// Vrai pour une organisation qui en nomme une : une chaîne dont la clé
// normalisée n'est pas vide. Une organisation vide, blanche ou faite de
// marques combinantes seules vaut absence (§ 10.1) : la clé de doublon la
// compte vide, comme une organisation absente, et elle n'est l'orthographe
// d'aucun groupe. La réconciliation et la clé de doublon s'accordent ainsi
// sur chaque organisation, lue ou existante.
const organisationNommee = (texte) => typeof texte === 'string' && cleNormalisee(texte) !== '';

// Les étiquettes d'une cellule (§ 4.5, § 10.1), par la découpe de la saisie
// (lireEtiquettes) : { etiquettes }, null quand la cellule n'en donne aucune,
// ou le motif du refus de la ligne. Une étiquette mal formée refuse,
// ETIQUETTE_MAL_FORMEE, la première nommée avec sa raison ; puis plus
// d'ETIQUETTES_MAX clés distinctes, ETIQUETTES_TROP_NOMBREUSES : deux
// morceaux de même clé ne font qu'une étiquette, que la réconciliation
// fond. Tronquer ou écarter en silence ferait manquer un objectif sans que
// rien ne le dise. La cellule arrive telle que découpée, sans le trim de
// valeurDe : trim retire au bord une tabulation ou U+FEFF, que
// lireEtiquettes refuse, et la ligne ne dépendrait plus que de leur place.
// cellule : undefined quand le champ n'a pas de colonne ou que
// l'enregistrement s'arrête avant elle.
function etiquettesDe(cellule) {
  if (cellule === undefined) return { etiquettes: null };
  const { etiquettes, fautes } = lireEtiquettes(cellule);
  if (fautes.length > 0) {
    const [{ valeur, raison }] = fautes;
    return { refus: { code: 'ETIQUETTE_MAL_FORMEE', valeur, raison } };
  }
  const nombre = new Set(etiquettes.map(cleEtiquette)).size;
  if (nombre > ETIQUETTES_MAX) return { refus: { code: 'ETIQUETTES_TROP_NOMBREUSES', valeur: null, nombre } };
  return { etiquettes: etiquettes.length === 0 ? null : etiquettes };
}

// La présence d'une cellule (§ 10.1), par la grammaire de lirePresence sous
// tours : { presence }, null pour une cellule vide ou blanche, ou le motif
// du refus de la ligne, PRESENCE_HORS_TOURS pour un tour hors de la soirée,
// PRESENCE_ILLISIBLE avec sa raison sinon. Lire un tour inconnu comme « tous
// les tours » assiérait une personne aux tours où elle ne vient pas.
// cellule : undefined quand le champ n'a pas de colonne ou que
// l'enregistrement s'arrête avant elle.
function presenceDe(cellule, tours) {
  if (cellule === undefined) return { presence: null };
  const { presence, faute } = lirePresence(cellule, tours);
  if (faute === undefined) return { presence };
  const { raison, valeur, tour } = faute;
  if (raison === 'horsTours') return { refus: { code: 'PRESENCE_HORS_TOURS', valeur, tour, tours } };
  return { refus: { code: 'PRESENCE_ILLISIBLE', valeur, raison } };
}

// Lit un enregistrement de données selon les colonnes associées, largeur
// étant le nombre d'en-têtes et tours celui de l'aperçu. Rend { champs },
// l'organisation telle qu'écrite ou null quand elle n'en nomme aucune, les
// étiquettes telles que découpées, ou le motif du refus { code, valeur },
// avec raison, nombre, tour ou tours selon le code, un seul, dans cet
// ordre : un champ non vide au-delà de l'en-tête, qui dit une ligne décalée
// dont aucune valeur n'est sûre ; un nom vide ; une valeur d'« exclu » hors
// de la liste fermée ; une étiquette mal formée ; trop d'étiquettes ; une
// présence illisible ou hors de la soirée.
function lireLigne(brut, largeur, colonnes, tours) {
  if (!enregistrementVide(brut.slice(largeur))) return { code: 'CHAMPS_EN_TROP', valeur: null };
  const lire = (champ) => valeurDe(brut, colonnes[champ]);
  const nom = lire('nom');
  if (nom === null) return { code: 'NOM_ABSENT', valeur: null };
  const valeurExclu = lire('exclu');
  const exclu = valeurExclu === null ? null : VALEURS_EXCLU.get(cleNormalisee(valeurExclu));
  if (exclu === undefined) return { code: 'EXCLU_INCONNU', valeur: valeurExclu };
  const { etiquettes, refus } = etiquettesDe(colonnes.etiquettes === undefined ? undefined : brut[colonnes.etiquettes]);
  if (refus !== undefined) return refus;
  const lue = presenceDe(colonnes.presence === undefined ? undefined : brut[colonnes.presence], tours);
  if (lue.refus !== undefined) return lue.refus;
  const organisation = lire('organisation');
  return {
    champs: {
      nom,
      prenom: lire('prenom'),
      organisation: organisationNommee(organisation) ? organisation : null,
      courriel: lire('courriel'),
      titrePressenti: lire('titre_pressenti'),
      notes: lire('notes'),
      exclu,
      etiquettes,
      presence: lue.presence,
    },
  };
}

// Les étiquettes de l'événement qui donnent leur orthographe à celles d'un
// fichier importé (§ 10.1) : celles des participants existants — aucun
// sous remplacer, qui les retire —, puis celles des objectifs de table,
// dans chaque mode. reconcilier ne dépend pas de leur ordre.
function etiquettesExistantes(existants, tables) {
  return [
    ...existants.flatMap(({ etiquettes = [] }) => etiquettes),
    ...tables.flatMap(({ objectifs = [] }) => objectifs.flatMap(({ etiquettes }) => etiquettes)),
  ];
}

// Réconcilie les organisations (§ 10.1). Les orthographes de même clé
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
  for (const { organisation } of existants) {
    if (organisationNommee(organisation)) noter(organisation, null);
  }
  for (const { ligne, champs } of valides) {
    if (champs.organisation !== null) noter(champs.organisation, ligne);
  }
  const fusions = [...groupes.values()]
    .filter((groupe) => groupe.orthographes.length > 1 && groupe.lignes.length > 0)
    .sort((a, b) => a.lignes[0] - b.lignes[0])
    .map(({ affichee, orthographes }) => ({ affichee, orthographes }));
  return { afficheeDe: (texte) => groupes.get(cleNormalisee(texte)).affichee, fusions };
}

// Clé de doublon : le triplet (nom, prénom, organisation), chacun par sa clé
// normalisée, un prénom ou une organisation absents comptant comme vides,
// écrit en JSON pour qu'aucun texte ne se confonde avec une frontière.
const cleDoublon = (nom, prenom, organisation) =>
  JSON.stringify([nom, prenom ?? '', organisation ?? ''].map((texte) => cleNormalisee(texte)));

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
  for (const { id, nom, prenom, organisation } of existants) {
    groupeDe(cleDoublon(nom, prenom, organisation)).existants.push(id);
  }
  for (const { ligne, champs } of valides) {
    groupeDe(cleDoublon(champs.nom, champs.prenom, champs.organisation)).lignes.push(ligne);
  }
  return [...groupes.values()]
    .filter((groupe) => groupe.lignes.length > 0 && groupe.lignes.length + groupe.existants.length > 1)
    .sort((a, b) => a.lignes[0] - b.lignes[0]);
}

// Vrai quand la valeur d'une ligne et celle d'un participant laissent ce
// participant parmi les candidats de la ligne : l'une ou l'autre est absente
// — null, ou de clé normalisée vide —, ou leurs clés normalisées sont égales.
function compatibles(deLaLigne, duParticipant) {
  const cleLigne = cleNormalisee(deLaLigne ?? '');
  const cleParticipant = cleNormalisee(duParticipant ?? '');
  return cleLigne === '' || cleParticipant === '' || cleLigne === cleParticipant;
}

/**
 * Index des participants par nom normalisé, que lit designer. Chaque entrée
 * copie l'identifiant, le prénom et l'organisation du participant : ce
 * qu'une mise à jour pose ensuite sur lui ne change pas l'index, qui garde
 * les valeurs d'avant l'import.
 *
 * @param {Array<{id: number, nom: string, prenom: string|null, organisation: string|null}>} participants
 * @returns {Map<string, Array<{id: number, prenom: string|null, organisation: string|null}>>}
 */
export function indexerParNom(participants) {
  const index = new Map();
  for (const { id, nom, prenom, organisation } of participants) {
    const cle = cleNormalisee(nom);
    if (!index.has(cle)) index.set(cle, []);
    index.get(cle).push({ id, prenom, organisation });
  }
  return index;
}

/**
 * Participants qu'une ligne désigne en mise à jour (§ 10.1), seule règle de
 * la désignation, que l'aperçu et l'import lisent tous deux. memeNom : les
 * participants de l'index de même nom normalisé que la ligne. candidats :
 * ceux d'entre eux que ni le prénom ni l'organisation n'écartent ; l'un ou
 * l'autre n'écarte un participant que lorsque la ligne et lui en portent
 * tous deux un, de clés normalisées différentes : une colonne absente ou une
 * cellule vide n'écarte personne, comme elle ne vide aucune valeur.
 *
 * @param {{nom: string, prenom: string|null, organisation: string|null}} champs
 * @param {ReturnType<typeof indexerParNom>} index
 * @returns {{memeNom: number[], candidats: number[]}}  identifiants croissants
 */
export function designer(champs, index) {
  const memeNom = index.get(cleNormalisee(champs.nom)) ?? [];
  const croissants = (entrees) => entrees.map(({ id }) => id).sort((a, b) => a - b);
  return {
    memeNom: croissants(memeNom),
    candidats: croissants(
      memeNom.filter(
        ({ prenom, organisation }) =>
          compatibles(champs.prenom, prenom) && compatibles(champs.organisation, organisation),
      ),
    ),
  };
}

// Homonymes d'une mise à jour : chaque ligne valide que designer ne fait
// désigner à personne, alors que des participants portent son nom, avec
// leurs identifiants. L'index est celui des participants d'avant l'import :
// une ligne n'y change rien pour la suivante.
function homonymesDe(participants, lignes) {
  const index = indexerParNom(participants);
  const homonymes = [];
  for (const { ligne, champs } of lignes) {
    const { memeNom, candidats } = designer(champs, index);
    if (memeNom.length > 0 && candidats.length === 0) homonymes.push({ ligne, participants: memeNom });
  }
  return homonymes;
}

// Lignes désignées d'une mise à jour : le rang de chaque ligne valide que
// designer fait désigner à un participant existant au moins, contre l'index
// des participants d'avant l'import, dans l'ordre des lignes.
function designeesDe(participants, lignes) {
  const index = indexerParNom(participants);
  return lignes.filter(({ champs }) => designer(champs, index).candidats.length > 0).map(({ ligne }) => ligne);
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

/**
 * Aperçu d'un texte décodé, import ou collage, contre les participants
 * existants, pour un mode de l'import : rien n'est importé. En mode
 * remplacer, chaque existant est retiré avant que les lignes s'ajoutent :
 * aucune ligne n'en est le doublon, et aucune orthographe existante ne
 * s'affiche ni ne fond avec celles du fichier. Ajouter et mettre à jour
 * lisent le fichier contre les existants. Les étiquettes des objectifs de
 * table donnent leur orthographe dans chaque mode.
 *
 * @param {string} texte  le texte que rend decoder, ou celui d'un collage
 * @param {Object} [options]
 * @param {Array<{id: number, nom: string, prenom: string|null, organisation: string|null}>} [options.participants]
 *   les participants existants, dans n'importe quel ordre : l'identifiant
 *   ordonne leurs orthographes
 * @param {Array<{objectifs?: Array<{etiquettes: string[]}>}>} [options.tables]
 *   les tables de l'événement, dont seules les étiquettes des objectifs se
 *   lisent
 * @param {Object<string, number>} [options.choix]  { champ: rang } qui tranche
 *   une ambiguïté de l'en-tête (voir associer)
 * @param {'ajouter'|'mettreAJour'|'remplacer'} [options.mode]  ajouter par
 *   défaut
 * @param {number} [options.tours]  le nombre de tours de l'événement, sous
 *   lequel la présence se lit ; TOURS_MAX par défaut, qui ne refuse qu'un
 *   tour au-delà du plus grand nombre de tours admis
 * @returns {Apercu}
 * @throws {TypeError} quand texte n'est pas une chaîne : des octets passent
 *   d'abord par decoder ; pour un mode inconnu ; pour un nombre de tours qui
 *   n'est pas un entier de 1 à TOURS_MAX
 */
export function apercevoir(
  texte,
  { participants = [], tables = [], choix = {}, mode = 'ajouter', tours = TOURS_MAX } = {},
) {
  if (typeof texte !== 'string') throw new TypeError('texte : chaîne attendue');
  if (!MODES.includes(mode)) throw new TypeError(`mode : ${MODES.join(', ')} attendu, reçu ${String(mode)}`);
  if (!Number.isInteger(tours) || tours < 1 || tours > TOURS_MAX) {
    throw new TypeError(`tours : entier de 1 à ${TOURS_MAX} attendu, reçu ${String(tours)}`);
  }
  // Chaque refus global porte le mode et le nombre de tours de l'aperçu.
  const refuser = (...refus) => refuserEn({ mode, tours }, ...refus);
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
    const { champs: lus, ...refus } = lireLigne(brut, entetes.length, association.colonnes, tours);
    if (lus === undefined) refusees.push({ ligne, ...refus, brut });
    else valides.push({ ligne, champs: lus, brut });
  }
  if (valides.length === 0) return { ...refuser('AUCUNE_LIGNE_VALIDE', lu), refusees };

  const existants = mode === 'remplacer' ? [] : [...participants].sort((a, b) => a.id - b.id);
  const { afficheeDe, fusions } = reconcilier(existants, valides);
  const { listes, fusions: fusionsEtiquettes } = reconcilierEtiquettes(
    etiquettesExistantes(existants, tables),
    valides.map(({ champs }) => champs.etiquettes),
  );
  const lignes = valides.map(({ ligne, champs, brut }, rang) => ({
    ligne,
    champs: {
      ...champs,
      organisation: champs.organisation === null ? null : afficheeDe(champs.organisation),
      etiquettes: listes[rang],
    },
    brut,
  }));
  return {
    mode,
    tours,
    ...lu,
    lignes,
    refusees,
    fusions,
    fusionsEtiquettes,
    doublons: doublonsDe(existants, lignes),
    homonymes: mode === 'mettreAJour' ? homonymesDe(participants, lignes) : [],
    designees: mode === 'mettreAJour' ? designeesDe(participants, lignes) : [],
    multilignes: multilignesDe(lignes, separateur),
    refusGlobal: null,
    refusGlobalLigne: null,
  };
}
