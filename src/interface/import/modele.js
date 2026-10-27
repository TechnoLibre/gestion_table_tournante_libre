// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le modèle de l'aperçu d'un import, § 10.1, § 10.2 et § 10.4 : ce que
// l'aperçu montre, en clés de libellés et en données, d'un fichier décodé,
// d'un fichier que decoder refuse, ou d'un collage, sous la nature que
// l'opérateur a choisie — des participants ou des objectifs de table. Le
// texte vient de la traduction ; ce module ne choisit que les clés, et ne
// recalcule rien de ce que l'aperçu de src/csv établit : association,
// lignes, fusions et doublons s'y lisent tels quels.
//
// La nature se reçoit, jamais ne se déduit du texte : une liste de
// participants porte souvent une colonne « Table » d'une soirée passée, et
// un en-tête d'objectifs lu sous Participants reste refusé, jamais lu comme
// des objectifs.
//
// Le modèle à télécharger suit la nature cochée : celui des participants,
// dont la présence suit le nombre de tours de l'événement ouvert, ou celui
// des objectifs de l'événement ouvert. Le guide de l'import la suit aussi :
// une ligne par colonne reconnue, lue dans la table d'en-têtes de la nature.
import {
  CHAMPS,
  CHAMPS_OBJECTIFS,
  ENTETES_DES_CHAMPS,
  ENTETES_DES_OBJECTIFS,
  apercevoir,
  apercevoirObjectifs,
  modeleObjectifs,
  modeleParticipants,
  rendreNomsUniques,
} from '../../application/csv.js';

/** Les deux natures d'un fichier importé (§ 10.4), dans l'ordre où l'écran
 *  les offre, la clé de leur nom, et celle du nom accessible de
 *  « Télécharger un modèle » sous cette nature. */
export const NATURES_D_IMPORT = Object.freeze(
  [
    ['participants', 'import.nature.participants', 'import.modele.participants'],
    ['objectifs', 'import.nature.objectifs', 'import.modele.objectifs'],
  ].map(([nature, cle, modele]) => Object.freeze({ nature, cle, modele })),
);

/** La nature cochée à l'ouverture de la section : les participants. */
export const NATURE_PAR_DEFAUT = 'participants';

// La nature reçue, ou RangeError qui la nomme : jamais une nature devinée.
function exigerNature(nature) {
  if (!NATURES_D_IMPORT.some((offerte) => offerte.nature === nature)) {
    throw new RangeError(`import : nature inconnue ${JSON.stringify(nature)}`);
  }
  return nature;
}

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

// La clé du nom de chaque champ, dans l'ordre de CHAMPS, puis de
// CHAMPS_OBJECTIFS : aucun nom n'est commun aux deux.
const CLES_DES_CHAMPS = new Map([
  ['nom', 'import.champ.nom'],
  ['prenom', 'import.champ.prenom'],
  ['organisation', 'import.champ.organisation'],
  ['courriel', 'import.champ.courriel'],
  ['titre_pressenti', 'import.champ.titrePressenti'],
  ['exclu', 'import.champ.exclu'],
  ['notes', 'import.champ.notes'],
  ['etiquettes', 'import.champ.etiquettes'],
  ['presence', 'import.champ.presence'],
  ['conflit_organisation', 'import.champ.conflits'],
  ['animation_reservee', 'import.champ.animationReservee'],
  ['table', 'import.champ.table'],
  ['tour', 'import.champ.tour'],
  ['objectif', 'import.champ.objectif'],
  ['regle', 'import.champ.regle'],
]);

// La clé de la règle lue d'un objectif ; null : l'objectif suit la règle par
// défaut de l'événement.
const CLES_DE_REGLE = new Map([
  ['ou', 'import.regle.ou'],
  ['et', 'import.regle.et'],
  [null, 'import.regle.defaut'],
]);

// La clé de la valeur lue d'« exclu » ou de l'animation réservée, la même
// liste fermée ; une cellule vide n'en a pas.
const CLES_OUI_NON = new Map([
  [true, 'import.exclu.oui'],
  [false, 'import.exclu.non'],
]);

// Le nom de chaque champ dans ChampsLus, celui de l'aperçu de src/csv.
const CHAMPS_LUS = new Map([
  ['titre_pressenti', 'titrePressenti'],
  ['conflit_organisation', 'conflits'],
  ['animation_reservee', 'animationReservee'],
]);

// Les champs dont la valeur lue est oui ou non : chacun se montre par la
// clé de sa valeur (CLES_OUI_NON).
const CHAMPS_OUI_NON = new Set(['exclu', 'animation_reservee']);

// Les champs dont la cellule est une liste de noms, chacun sa pastille : les
// étiquettes, et les organisations en conflit.
const CHAMPS_EN_LISTE = new Set(['etiquettes', 'conflit_organisation']);

// Des modes et la clé de leur nom, figés.
const modes = (paires) => Object.freeze(paires.map(([mode, cle]) => Object.freeze({ mode, cle })));

/** Les trois modes de l'import des participants (§ 10.1), dans l'ordre où
 *  l'écran les offre, et la clé de leur nom. */
export const MODES_D_IMPORT = modes([
  ['ajouter', 'import.mode.ajouter'],
  ['mettreAJour', 'import.mode.mettreAJour'],
  ['remplacer', 'import.mode.remplacer'],
]);

// Les deux modes de l'import des objectifs (§ 10.4) : ajouter n'en est pas
// un, un couple (table, tour) déjà pourvu y serait une collision.
const MODES_D_IMPORT_OBJECTIFS = modes([
  ['mettreAJour', 'import.mode.mettreAJour'],
  ['remplacer', 'import.mode.remplacer'],
]);

/**
 * Les modes qu'offre l'import d'une nature, dans l'ordre de l'écran.
 *
 * @param {'participants'|'objectifs'} nature
 * @returns {ReadonlyArray<{mode: string, cle: string}>}
 * @throws {RangeError} une nature inconnue
 */
export function modesDImport(nature) {
  return exigerNature(nature) === 'participants' ? MODES_D_IMPORT : MODES_D_IMPORT_OBJECTIFS;
}

/**
 * Le modèle à télécharger sous une nature (§ 10.1, § 10.4), et le nom que
 * l'enregistrement propose : modele-participants.csv pour celui des
 * participants, dont seule la présence suit le nombre de tours de
 * l'événement ; ‹base›-modele-objectifs.csv pour celui des objectifs, fait
 * des tables et des tours de l'événement, sur le patron de
 * ‹base›-objectifs.csv. Rien ne s'écrit dans la charge.
 *
 * @param {'participants'|'objectifs'} nature
 * @param {{base: string, charge: Object}} evenement  la base de l'événement
 *   ouvert et sa charge
 * @returns {{nom: string, octets: Uint8Array}}
 * @throws {RangeError} une nature inconnue
 * @throws {import('../../application/erreurs.js').ErreurCommande}
 *   sous Objectifs, OBJECTIFS_SANS_TABLE pour un événement sans table et
 *   OBJECTIFS_NUMEROS_PARTAGES pour un événement dont chaque numéro de table
 *   est partagé
 */
export function modeleATelecharger(nature, { base, charge }) {
  if (exigerNature(nature) === 'participants') return { nom: 'modele-participants.csv', octets: modeleParticipants(charge) };
  return { nom: `${base}-modele-objectifs.csv`, octets: modeleObjectifs(charge) };
}

/**
 * L'aperçu d'un texte décodé sous la nature choisie, contre la charge : celui
 * des participants (apercevoir, contre ses personnes et ses tables, dont les
 * objectifs donnent leur orthographe aux étiquettes, la présence lue sous
 * son nombre de tours) ou celui des objectifs de table
 * (apercevoirObjectifs). Rien ne s'écrit.
 *
 * @param {'participants'|'objectifs'} nature
 * @param {string} texte
 * @param {Object} charge  la charge de l'événement ouvert
 * @param {{choix?: Object<string, number>, mode?: string, noms?: Map<number, string>}} [options]
 *   le choix des colonnes ambiguës et le mode ; chaque aperçu prend son mode
 *   par défaut quand mode manque ; noms, ceux de nomsRendusUniques, que lit
 *   le seul aperçu des participants
 * @returns {Object}  l'aperçu de la nature, tel que src/csv le rend
 * @throws {RangeError} une nature inconnue
 */
export function apercevoirSelon(nature, texte, charge, { choix = {}, mode, noms } = {}) {
  const options = mode === undefined ? { choix } : { choix, mode };
  if (exigerNature(nature) === 'objectifs') return apercevoirObjectifs(texte, charge, options);
  return apercevoir(texte, {
    participants: charge.participants,
    tables: charge.tables,
    tours: charge.evenement.tours,
    ...options,
    ...(noms === undefined ? {} : { noms }),
  });
}

/**
 * Les noms que « Rendre les noms uniques » donne aux doublons d'un aperçu
 * (rendreNomsUniques, § 10.1) : rang de ligne → nom suffixé. Aucun pour des
 * objectifs, qui n'ont pas de doublon, ni sans aperçu. L'écran n'offre la
 * commande que lorsqu'il y en a un au moins.
 *
 * @param {'participants'|'objectifs'} nature
 * @param {Object|null} apercu  l'aperçu de la nature, calculé sans noms
 * @param {Array<Object>} participants  ceux contre lesquels il s'est calculé
 * @returns {Map<number, string>}
 * @throws {RangeError} une nature inconnue
 */
export function nomsRendusUniques(nature, apercu, participants) {
  if (exigerNature(nature) === 'objectifs' || apercu === null) return new Map();
  return rendreNomsUniques(apercu, participants);
}

/** Les trois sortes d'un message de l'aperçu et du rapport, chacune un ton
 *  de pastille (Pastille, sorte 'statut'). */
export const SORTES_DE_MESSAGE = Object.freeze(['refus', 'avis', 'information']);

// L'icône de chaque sorte, distincte des deux autres : la sorte se lit au
// libellé de sa pastille, et l'icône la redit sans la couleur.
const ICONES_DE_SORTE = new Map([
  ['refus', 'interdit'],
  ['avis', 'triangle'],
  ['information', 'information'],
]);

// La sorte de chaque bloc de messages. Un refus écarte des lignes, ou tout
// l'import ; un avis demande à l'opérateur de vérifier ou de trancher ce
// que le logiciel ne fusionne jamais seul — doublons, homonymes d'une mise
// à jour —, ou une cellule sur plusieurs lignes qui porte le séparateur,
// peut-être un guillemet mal fermé ; une information dit ce qui a été fait
// ou lu sans rien écarter — les orthographes fondues d'organisations et
// celles d'étiquettes, deux blocs distincts, les noms rendus uniques, et
// les personnes à désigner animatrices qu'un import laisse.
const SORTES_DES_BLOCS = new Map([
  ['global', 'refus'],
  ['refusees', 'refus'],
  ['doublons', 'avis'],
  ['homonymes', 'avis'],
  ['multilignes', 'avis'],
  ['fusions', 'information'],
  ['fusionsEtiquettes', 'information'],
  ['renommes', 'information'],
  ['rienEcrit', 'information'],
  ['animations', 'information'],
]);

/**
 * La classe d'un bloc de messages de l'aperçu ou du rapport.
 *
 * @param {string} bloc  'global', 'refusees', 'doublons', 'homonymes',
 *        'fusions', 'fusionsEtiquettes', 'renommes', 'multilignes',
 *        'rienEcrit' ou 'animations'
 * @returns {{sorte: string, cle: string, icone: string}}  la sorte, la clé
 *   de son libellé et l'icône de sa pastille
 * @throws {RangeError} un bloc inconnu
 */
export function messageDuBloc(bloc) {
  const sorte = SORTES_DES_BLOCS.get(bloc);
  if (sorte === undefined) throw new RangeError(`bloc de messages inconnu : ${JSON.stringify(bloc)}`);
  return { sorte, cle: `import.sorte.${sorte}`, icone: ICONES_DE_SORTE.get(sorte) };
}

// Des champs et la clé de leur nom, figés.
const colonnes = (champs) => Object.freeze(champs.map((champ) => Object.freeze({ champ, cle: CLES_DES_CHAMPS.get(champ) })));

/** Les colonnes du tableau des lignes des participants : chaque champ, dans
 *  l'ordre de CHAMPS, et la clé de son nom. */
export const COLONNES_DES_LIGNES = colonnes(CHAMPS);

/** Les colonnes du tableau des lignes des objectifs : chaque champ, dans
 *  l'ordre de CHAMPS_OBJECTIFS, et la clé de son nom. */
export const COLONNES_DES_OBJECTIFS = colonnes(CHAMPS_OBJECTIFS);

// La clé du texte de guide de chaque champ, dans l'ordre de CHAMPS, puis de
// CHAMPS_OBJECTIFS : ce que la colonne contient, et comment une cellule en
// sépare plusieurs valeurs.
const CLES_DU_GUIDE = new Map([
  ['nom', 'import.guide.colonne.nom'],
  ['prenom', 'import.guide.colonne.prenom'],
  ['organisation', 'import.guide.colonne.organisation'],
  ['courriel', 'import.guide.colonne.courriel'],
  ['titre_pressenti', 'import.guide.colonne.titrePressenti'],
  ['exclu', 'import.guide.colonne.exclu'],
  ['notes', 'import.guide.colonne.notes'],
  ['etiquettes', 'import.guide.colonne.etiquettes'],
  ['presence', 'import.guide.colonne.presence'],
  ['conflit_organisation', 'import.guide.colonne.conflits'],
  ['animation_reservee', 'import.guide.colonne.animationReservee'],
  ['table', 'import.guide.colonne.table'],
  ['tour', 'import.guide.colonne.tour'],
  ['objectif', 'import.guide.colonne.objectif'],
  ['regle', 'import.guide.colonne.regle'],
]);

// La table d'en-têtes de chaque nature, la clé de la légende de son tableau
// dans le guide, et ses champs obligatoires : ceux dont l'absence refuse le
// fichier entier, NOM_NON_ASSOCIE pour des participants,
// TABLE_NON_ASSOCIEE et OBJECTIF_NON_ASSOCIE pour des objectifs.
const GUIDES_DES_NATURES = new Map([
  ['participants', { entetes: ENTETES_DES_CHAMPS, legende: 'import.guide.legende.participants', obligatoires: ['nom'] }],
  ['objectifs', { entetes: ENTETES_DES_OBJECTIFS, legende: 'import.guide.legende.objectifs', obligatoires: ['table', 'objectif'] }],
]);

/** Les clés des consignes générales du guide de l'import, dans l'ordre où
 *  il les montre, sous l'une et l'autre nature. */
export const CONSIGNES_DU_GUIDE = Object.freeze([
  'import.guide.consigne.entetes',
  'import.guide.consigne.fichier',
  'import.guide.consigne.modele',
  'import.guide.consigne.apercu',
]);

// Les en-têtes d'un champ, sans ceux qui ne diffèrent d'un précédent que
// par l'apostrophe, droite ou typographique : la reconnaissance garde les
// deux graphies, le guide n'écrit que la première, que l'œil distingue mal
// de l'autre.
function uneGraphieParApostrophe(ecritures) {
  const vues = new Set();
  return ecritures.filter((ecriture) => {
    const graphie = ecriture.replaceAll('\u{2019}', "'");
    if (vues.has(graphie)) return false;
    vues.add(graphie);
    return true;
  });
}

/**
 * Les lignes du guide d'une table d'en-têtes, de la forme
 * d'ENTETES_DES_CHAMPS : une par champ, dans l'ordre de la table, son
 * en-tête, ses synonymes tels que la table les écrit, une seule graphie par
 * apostrophe, s'il est obligatoire, et la clé de son texte de guide. La
 * table seule donne en-têtes et synonymes : le guide n'en recopie aucun.
 *
 * @param {ReadonlyArray<readonly [string, ReadonlyArray<string>]>} entetes
 * @param {ReadonlyArray<string>} obligatoires  les champs obligatoires
 * @returns {Array<{champ: string, entete: string, synonymes: string[], obligatoire: boolean, cle: string}>}
 * @throws {RangeError} un champ sans texte de guide, qu'il nomme
 */
export function colonnesDuGuide(entetes, obligatoires) {
  return entetes.map(([champ, ecritures]) => {
    const [entete, ...synonymes] = uneGraphieParApostrophe(ecritures);
    return { champ, entete, synonymes, obligatoire: obligatoires.includes(champ), cle: dans(CLES_DU_GUIDE, champ, 'texte de guide du champ') };
  });
}

/**
 * Le guide de l'import sous une nature (§ 10.1, § 10.4) : la clé de la
 * légende de son tableau, et une ligne par colonne reconnue, dans l'ordre
 * de la table d'en-têtes de la nature (colonnesDuGuide).
 *
 * @param {'participants'|'objectifs'} nature
 * @returns {{legende: string, colonnes: ReturnType<typeof colonnesDuGuide>}}
 * @throws {RangeError} une nature inconnue, ou un champ sans texte de guide
 */
export function guideDeLImport(nature) {
  const { entetes, legende, obligatoires } = GUIDES_DES_NATURES.get(exigerNature(nature));
  return { legende, colonnes: colonnesDuGuide(entetes, obligatoires) };
}

// Les comptes du rapport de chaque nature, dans l'ordre du résumé de son
// import, et la clé de leur libellé, accordé au nombre.
const COMPTES_DU_RAPPORT = new Map([
  [
    'participants',
    [
      ['ajoutes', 'import.rapport.ajoutes'],
      ['misAJour', 'import.rapport.misAJour'],
      ['inchanges', 'import.rapport.inchanges'],
      ['retires', 'import.rapport.retires'],
      ['reservationsRetirees', 'import.rapport.reservationsRetirees'],
    ],
  ],
  [
    'objectifs',
    [
      ['ajoutes', 'import.rapport.objectifsAjoutes'],
      ['remplaces', 'import.rapport.objectifsRemplaces'],
      ['inchanges', 'import.rapport.objectifsInchanges'],
      ['retires', 'import.rapport.objectifsRetires'],
      ['tables', 'import.rapport.tablesTouchees'],
    ],
  ],
]);

/**
 * Les comptes que montre le rapport d'un import : chaque nom du résumé de
 * la commande de la nature, et la clé de son libellé.
 *
 * @param {'participants'|'objectifs'} nature
 * @returns {Array<{nom: string, cle: string}>}
 * @throws {RangeError} une nature inconnue
 */
export function comptesDuRapport(nature) {
  return COMPTES_DU_RAPPORT.get(exigerNature(nature)).map(([nom, cle]) => ({ nom, cle }));
}

/**
 * Ce que la fenêtre de « Remplacer » des participants nomme détruit, en clés
 * de libellé et leurs détails : les quatre comptes du bilan
 * (bilanRemplacement) — personnes, réservations, titres pourvus,
 * propositions —, toujours, puis les logos que le remplacement retire,
 * seulement quand il en retire : le CSV ne porte aucun logo (§ 8.9).
 *
 * @param {{participants: number, reservations: number, titresPourvus: number, propositions: number}} bilan
 * @param {number} logosRetires  le compte du résumé de l'essai de l'import
 * @returns {Array<{cle: string, details: {n: number}}>}
 */
export function annonceRemplacementParticipants(bilan, logosRetires) {
  return [
    { cle: 'import.remplacer.participants', details: { n: bilan.participants } },
    { cle: 'import.remplacer.reservations', details: { n: bilan.reservations } },
    { cle: 'import.remplacer.titres', details: { n: bilan.titresPourvus } },
    { cle: 'import.remplacer.propositions', details: { n: bilan.propositions } },
    ...(logosRetires > 0 ? [{ cle: 'import.remplacer.logos', details: { n: logosRetires } }] : []),
  ];
}

// Le remède d'un refus de decoder : le code que ses détails portent, que le
// texte du refus compose déjà (contrat « Refus et avertissements »).
const REFUS_DE_DECODER = new Set(['UTF16_SANS_MARQUE', 'UTF16_INVALIDE', 'UTF8_INVALIDE', 'CARACTERE_NUL']);

// La clé du remède de chaque refus global de l'aperçu des participants. Un
// caractère nul n'y arrive que d'un texte collé : celui d'un fichier,
// decoder le refuse. Un conflit fautif refuse le fichier entier : son
// remède invite à le corriger, puis à l'importer de nouveau.
const REMEDES_DE_L_APERCU = new Map([
  ['CARACTERE_NUL', 'import.remede.caractereNulCollage'],
  ['AUCUN_ENTETE', 'import.remede.aucunEntete'],
  ['NOM_NON_ASSOCIE', 'import.remede.nomNonAssocie'],
  ['AUCUNE_LIGNE_VALIDE', 'import.remede.aucuneLigneValide'],
  ['GUILLEMET_OUVERT', 'import.remede.guillemetOuvert'],
  ['SEPARATEUR_INTROUVABLE', 'import.remede.separateurIntrouvable'],
  ['CONFLIT_ORGANISATION_INCONNUE', 'import.remede.conflitOrganisation'],
  ['CONFLIT_ORGANISATION_PROPRE', 'import.remede.conflitPropre'],
]);

// La clé du remède de chaque refus global de l'aperçu des objectifs (§ 10.4) :
// ceux du § 10.1 hors NOM_NON_ASSOCIE, et les trois qui lui sont propres.
// OBJECTIFS_SANS_TABLE n'en a pas : son texte dit déjà de créer les tables,
// et son remède est le geste qui ouvre leur section.
const REMEDES_DES_OBJECTIFS = new Map([
  ['CARACTERE_NUL', 'import.remede.caractereNulCollage'],
  ['AUCUN_ENTETE', 'import.remede.aucunEnteteObjectifs'],
  ['TABLE_NON_ASSOCIEE', 'import.remede.tableNonAssociee'],
  ['OBJECTIF_NON_ASSOCIE', 'import.remede.objectifNonAssocie'],
  ['OBJECTIFS_SANS_TABLE', null],
  ['AUCUNE_LIGNE_VALIDE', 'import.remede.aucuneLigneValide'],
  ['GUILLEMET_OUVERT', 'import.remede.guillemetOuvert'],
  ['SEPARATEUR_INTROUVABLE', 'import.remede.separateurIntrouvable'],
]);

// Le geste qui remédie à un refus global des objectifs, celui que la
// commande importerObjectifs pose sur le même code : la section des tables
// pour un événement sans table.
const GESTES_DES_OBJECTIFS = new Map([['OBJECTIFS_SANS_TABLE', Object.freeze({ geste: 'ouvrirSection', section: 'tables' })]]);

// Le remède d'un collage auquel l'aperçu offre l'ordre de la grille.
const REMEDES_DE_LA_GRILLE = new Map([
  ['AUCUN_ENTETE', 'import.remede.aucunEnteteCollage'],
  ['SEPARATEUR_INTROUVABLE', 'import.remede.separateurIntrouvableCollage'],
]);

// Le remède d'un conflit fautif dans un texte collé : le corriger, puis le
// coller de nouveau, là où celui d'un fichier dit de le réimporter.
const REMEDES_DU_COLLAGE = new Map([
  ['CONFLIT_ORGANISATION_INCONNUE', 'import.remede.conflitOrganisationCollage'],
  ['CONFLIT_ORGANISATION_PROPRE', 'import.remede.conflitPropreCollage'],
]);

// La valeur d'une table de clés, ou RangeError qui nomme ce qui manque :
// jamais une clé devinée.
function dans(table, valeur, quoi) {
  if (!table.has(valeur)) throw new RangeError(`import : ${quoi} inconnu ${JSON.stringify(valeur)}`);
  return table.get(valeur);
}

// Vrai quand l'aperçu offre la lecture dans l'ordre de la grille : un texte
// non blanc sans en-tête reconnu, ou une seule colonne sans séparateur, lu
// comme une liste de participants. La grille n'a pas l'ordre des objectifs.
function offreLaGrille(apercu, nature = 'participants') {
  if (nature !== 'participants') return false;
  if (apercu.refusGlobal === 'AUCUN_ENTETE') return apercu.entetes.length > 0;
  return apercu.refusGlobal === 'SEPARATEUR_INTROUVABLE' && apercu.refusGlobalLigne === null;
}

// Le refus global d'un refus de decoder : sa cause, le code ; son remède,
// le code de details.remede, déjà dans la cause.
function globalDeDecoder({ code, details }) {
  if (!REFUS_DE_DECODER.has(code)) throw new RangeError(`import : refus de decoder inconnu ${JSON.stringify(code)}`);
  return { cle: code, details, remede: { cle: details.remede, details: {}, dansLaCause: true, geste: null } };
}

// Le refus global d'un aperçu, null sans refus. Un collage auquel l'aperçu
// offre l'ordre de la grille prend le remède qui le nomme, un conflit
// fautif collé celui qui dit de coller de nouveau. Un refus que son texte
// remédie déjà porte le seul geste qui y mène. Les détails portent le rang
// que l'aperçu nomme, et l'organisation d'un conflit fautif.
function globalDeLApercu(apercu, collage, nature) {
  const code = apercu.refusGlobal;
  if (code === null) return null;
  const rang = apercu.refusGlobalLigne;
  const organisation = apercu.refusGlobalOrganisation ?? null;
  const details = { ...(rang === null ? {} : { ligne: rang }), ...(organisation === null ? {} : { organisation }) };
  if (nature === 'objectifs') {
    const remede = dans(REMEDES_DES_OBJECTIFS, code, 'refus global des objectifs');
    const geste = GESTES_DES_OBJECTIFS.get(code) ?? null;
    return { cle: code, details, remede: { cle: remede, details, dansLaCause: remede === null, geste } };
  }
  const remede =
    collage && offreLaGrille(apercu)
      ? REMEDES_DE_LA_GRILLE.get(code)
      : (collage && REMEDES_DU_COLLAGE.get(code)) || dans(REMEDES_DE_L_APERCU, code, 'refus global');
  return { cle: code, details, remede: { cle: remede, details, dansLaCause: false, geste: null } };
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
// clé de ce qu'elle devient — un champ de la nature, une colonne à trancher,
// une colonne écartée par le choix d'une autre, une colonne non reconnue.
function colonnesDe({ entetes, association }, champs) {
  const champDuRang = new Map(champs.filter((champ) => Object.hasOwn(association.colonnes, champ)).map((champ) => [association.colonnes[champ], champ]));
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

// Une cellule de l'aperçu : un texte lu, une clé de libellé et ses détails,
// ou une liste de noms — des étiquettes, des organisations en conflit —,
// chacun une pastille, sous etiquettes ; les autres null.
const cellule = (champ, { texte = null, cle = null, etiquettes = null, details = null }) => ({
  champ, texte, cle, etiquettes, details,
});

// La cellule de la présence lue, sous tours tours (§ 10.1) : les tours
// nommés, par leurs détails ; « tous les tours » pour 1..tours. Une cellule
// vide ne dit rien sur une ligne que l'import crée, où elle vaut tous les
// tours ; sur une ligne qui désigne une personne existante (inchangee),
// elle garde la présence de la personne, et le dit : « présence inchangée ».
function celluleDePresence(presence, { tours, inchangee }) {
  if (presence === null) return cellule('presence', { cle: inchangee ? 'import.presence.inchangee' : null });
  if (presence.length === tours) return cellule('presence', { cle: 'import.presence.tous' });
  return cellule('presence', { cle: 'import.presence.tours', details: { tours: [...presence] } });
}

// Chaque ligne valide des participants : son rang, puis une cellule par champ,
// dans l'ordre de CHAMPS : le texte lu, ou la clé de la valeur d'« exclu » ou
// de l'animation réservée ; les étiquettes une à une, et de même les
// organisations en conflit, aucune pour une cellule vide ; la présence par
// celluleDePresence, sous le nombre de tours : « inchangée » seulement quand
// la colonne existe et que la ligne désigne une personne existante (designees,
// que l'aperçu ne remplit qu'en mise à jour).
function lignesDesParticipants({ lignes, tours, association, designees }) {
  const colonne = association.colonnes.presence !== undefined;
  const designee = new Set(designees);
  return lignes.map(({ ligne, champs }) => ({
    ligne,
    cellules: CHAMPS.map((champ) => {
      const valeur = champs[CHAMPS_LUS.get(champ) ?? champ];
      if (CHAMPS_OUI_NON.has(champ)) return cellule(champ, { cle: valeur === null ? null : CLES_OUI_NON.get(valeur) });
      if (CHAMPS_EN_LISTE.has(champ)) return cellule(champ, { etiquettes: valeur ?? [] });
      if (champ === 'presence') return celluleDePresence(valeur, { tours, inchangee: colonne && designee.has(ligne) });
      return cellule(champ, { texte: valeur });
    }),
  }));
}

// Chaque ligne valide des objectifs : son rang, puis le numéro affiché de la
// table, le tour — la clé de la soirée pour un tour null —, les étiquettes
// de l'objectif une à une, et la clé de sa règle.
function lignesDesObjectifs(lignes) {
  return lignes.map(({ ligne, champs }) => ({
    ligne,
    cellules: [
      cellule('table', { texte: String(champs.numero) }),
      champs.tour === null ? cellule('tour', { cle: 'import.tour.soiree' }) : cellule('tour', { texte: String(champs.tour) }),
      cellule('objectif', { etiquettes: champs.etiquettes }),
      cellule('regle', { cle: CLES_DE_REGLE.get(champs.regle) }),
    ],
  }));
}

// Chaque doublon de l'aperçu, ses lignes et ses existants, et la personne
// qu'il nomme : le nom et le prénom de sa première ligne, tels qu'écrits.
// Un aperçu des objectifs n'en a pas.
function doublonsNommes({ doublons = [], lignes }) {
  const champsDe = new Map(lignes.map(({ ligne, champs }) => [ligne, champs]));
  return doublons.map(({ lignes: rangs, existants }) => {
    const { nom, prenom } = champsDe.get(rangs[0]);
    return { lignes: rangs, existants, nom, prenom };
  });
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
 * Le mode d'import proposé (§ 10.1, § 10.4) : pour des participants, Ajouter
 * dans un événement sans participant, Mettre à jour sinon ; pour des
 * objectifs, Mettre à jour. Remplacer ne se propose jamais : il se choisit.
 *
 * @param {Array<Object>} participants
 * @param {'participants'|'objectifs'} [nature]  participants par défaut
 * @returns {'ajouter'|'mettreAJour'}
 * @throws {RangeError} une nature inconnue
 */
export function modePropose(participants, nature = 'participants') {
  if (exigerNature(nature) === 'objectifs') return 'mettreAJour';
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
  fusionsEtiquettes: [],
  doublons: [],
  homonymes: [],
  multilignes: [],
  renommes: 0,
  global: null,
});

/**
 * Ce que l'aperçu montre, d'un fichier ou d'un collage, sous sa nature :
 * encodage (null pour un collage) et séparateur nommés — « une seule
 * colonne » pour un séparateur null —, association par colonne, ambiguïtés,
 * colonnes et lignes valides, lignes refusées, orthographes fondues
 * d'organisations et d'étiquettes, chacune dans son bloc, doublons, le
 * nombre de noms rendus uniques, et le refus global, de decoder (refusDecodage, apercu null) ou de l'aperçu
 * (apercu.refusGlobal), avec la clé de sa cause et celle de son remède — en
 * clés de libellés et en données. Un aperçu des objectifs n'a ni
 * organisations, ni doublons, ni homonymes : ces listes y sont vides.
 *
 * La cause est le code du refus, sa propre clé ; ses détails sont ceux de
 * decoder, ou { ligne } quand l'aperçu nomme un rang, et { organisation }
 * sous un conflit fautif. Le remède d'un refus
 * de decoder est le code de details.remede, que le texte de la cause compose
 * déjà : remede.dansLaCause le dit, et l'écran ne le répète pas. remede.geste
 * est le remède du contrat (commande.js) qui y mène, null sans geste.
 *
 * @param {{nature?: 'participants'|'objectifs', encodage?: string|null, apercu?: Object|null,
 *          refusDecodage?: {code: string, details: Object}|null}} entree
 *   nature : celle que l'opérateur a choisie, participants par défaut ;
 *   encodage : celui que rend decoder, null pour un collage
 * @returns {{
 *   encodage: string|null, separateur: string|null,
 *   champs: ReadonlyArray<{champ: string, cle: string}>,
 *   colonnes: Array<{rang: number, entete: string, cle: string}>,
 *   ambigus: Array<{champ: string, cle: string, rangs: Array<{rang: number, entete: string}>}>,
 *   valides: number,
 *   lignes: Array<{ligne: number, cellules: Array<{champ: string, texte: string|null, cle: string|null,
 *     etiquettes: string[]|null, details: Object|null}>}>,
 *   refusees: Array<{ligne: number, code: string, details: Object}>,
 *   fusions: Array<{affichee: string, orthographes: Array<{texte: string, lignes: number}>}>,
 *   fusionsEtiquettes: Array<{retenue: string, orthographes: string[], lignes: number}>,
 *   doublons: Array<{lignes: number[], existants: number[], nom: string, prenom: string|null}>,
 *   homonymes: Array<{ligne: number, participants: number[]}>,
 *   multilignes: Array<{ligne: number, rangs: number[]}>,
 *   renommes: number,
 *   global: null|{cle: string, details: Object,
 *     remede: {cle: string|null, details: Object, dansLaCause: boolean, geste: Object|null}},
 * }}
 *   champs : les colonnes du tableau des lignes de la nature ; encodage,
 *   separateur, colonnes[].cle et ambigus[].cle sont des clés de
 *   traduction, comme lignes[].cellules[].cle — la valeur d'« exclu », la
 *   soirée, la règle d'un objectif, la présence —, que composent les
 *   détails de la cellule quand elle en porte ; refusees[].details, ceux
 *   que reçoit le motif d'une ligne (motifLigne) ; fusions[].orthographes[].lignes, le
 *   nombre de lignes de l'orthographe, 0 pour celle que seuls des
 *   participants existants portent ; fusionsEtiquettes[].lignes, le nombre
 *   de lignes réécrites sous l'orthographe retenue ; doublons[].nom et
 *   doublons[].prenom, la personne telle que la première ligne du doublon
 *   l'écrit ; renommes, le nombre de lignes dont le nom vient de « Rendre
 *   les noms uniques »
 * @throws {RangeError} une nature, un encodage, un séparateur ou un refus
 *   sans clé
 */
export function modeleApercu({ nature = 'participants', encodage = null, apercu = null, refusDecodage = null }) {
  const objectifs = exigerNature(nature) === 'objectifs';
  const champs = objectifs ? COLONNES_DES_OBJECTIFS : COLONNES_DES_LIGNES;
  if (refusDecodage !== null) return { ...RIEN, champs, global: globalDeDecoder(refusDecodage) };
  if (apercu === null) return { ...RIEN, champs };
  const { entetes, association } = apercu;
  return {
    encodage: encodage === null ? null : dans(ENCODAGES, encodage, 'encodage'),
    separateur: separateurDe(apercu),
    champs,
    colonnes: colonnesDe(apercu, objectifs ? CHAMPS_OBJECTIFS : CHAMPS),
    ambigus: association.ambigus.map(({ champ, rangs }) => ({
      champ,
      cle: CLES_DES_CHAMPS.get(champ),
      rangs: rangs.map((rang) => ({ rang, entete: entetes[rang] })),
    })),
    valides: apercu.lignes.length,
    lignes: objectifs ? lignesDesObjectifs(apercu.lignes) : lignesDesParticipants(apercu),
    refusees: refuseesDe(apercu.refusees),
    fusions: (apercu.fusions ?? []).map(({ affichee, orthographes }) => ({
      affichee,
      orthographes: orthographes.map(({ texte, lignes }) => ({ texte, lignes: lignes.length })),
    })),
    fusionsEtiquettes: apercu.fusionsEtiquettes.map(({ retenue, orthographes, lignes }) => ({
      retenue,
      orthographes: [...orthographes],
      lignes,
    })),
    doublons: doublonsNommes(apercu),
    homonymes: apercu.homonymes ?? [],
    multilignes: apercu.multilignes,
    renommes: (apercu.renommes ?? []).length,
    global: globalDeLApercu(apercu, encodage === null, nature),
  };
}

/**
 * Le texte relu dans l'ordre de la grille, sous la nature des participants
 * seule : précédé d'une ligne d'en-têtes —
 * les largeur premiers de CHAMPS, puis des en-têtes vides au-delà de onze —,
 * joints par le séparateur de l'aperçu. Sous AUCUN_ENTETE d'un texte non
 * blanc, largeur vaut apercu.entetes.length ; sous SEPARATEUR_INTROUVABLE
 * sans candidat (refusGlobalLigne null : une seule colonne), largeur vaut 1
 * et la ligne est « nom ». null sous tout autre aperçu. Offert pour un
 * collage, jamais appliqué seul : le texte rendu repasse par apercevoir, et
 * les rangs de ce second aperçu comptent la ligne ajoutée. null sous la
 * nature des objectifs : la grille n'en a pas l'ordre.
 *
 * @param {string} texte  le texte de l'aperçu
 * @param {Object} apercu  l'aperçu de ce texte
 * @param {'participants'|'objectifs'} [nature]  participants par défaut
 * @returns {string|null}
 */
export function avecEntetesDeLaGrille(texte, apercu, nature = 'participants') {
  if (!offreLaGrille(apercu, exigerNature(nature))) return null;
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
