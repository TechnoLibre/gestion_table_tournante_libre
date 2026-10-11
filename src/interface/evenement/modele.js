// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le modèle de l'événement ouvert, pur : ce que ses composants montrent de
// l'état observable de la séance (§ 8.4, § 8.5, § 8.8, § 8.9, § 9). Le cadre
// de mode et sa forme, la commande de la place fixe, les états du plan et
// leurs clés, la reprise de verrou que l'écran offre, et les avertissements
// dans l'ordre de la séance, chacun avec son remède ; puis ce que montre
// l'enveloppe de l'événement : le résumé chiffré de son en-tête, les étapes
// de ses états, la bande de mode. Rien n'y est décidé que la séance ne
// décide déjà : le refus courant, le mode et l'état du plan se lisent dans
// EtatSeance, jamais se recalculent.
import { cleDeMode } from '../mode.js';
import { modelePastille } from '../primitives/pastille.js';
import { etatTable } from '../tables/modele.js';

// La forme du cadre pour chaque clé du libellé de mode : un trait différent
// par mode, pour qu'aucun ne se distingue par la seule couleur (§ 14.5).
const FORMES = new Map([
  ['coquille.mode.lecture', 'tirets'],
  ['coquille.mode.ecriture', 'plein'],
  ['coquille.mode.bloque', 'double'],
]);

/**
 * Libellé et forme du cadre de mode : cle, celle de cleDeMode (mode.js) — le
 * libellé du bandeau — ; forme : lecture (tirets), écriture (trait plein),
 * bloqué (trait double), quel que soit le mode d'un plan bloqué. null sans
 * événement.
 *
 * @param {Object} etatSeance  EtatSeance
 * @returns {null|{cle: string, forme: 'tirets'|'plein'|'double'}}
 */
export function cadreDeMode(etatSeance) {
  const cle = cleDeMode(etatSeance);
  if (cle === null) return null;
  return { cle, forme: FORMES.get(cle) };
}

/**
 * La commande de la place fixe (§ 8.4, § 8.5, § 8.8) : 'format' quand le
 * refus courant est celui d'un format plus récent — l'explication remplace
 * alors toute commande, plan bloqué compris ; 'debloquer' sur un plan
 * bloqué ; 'lecture' — « Revenir en lecture » — en écriture ; 'modifier'
 * sinon. null sans événement.
 *
 * @param {Object} etatSeance  EtatSeance
 * @returns {null|'format'|'debloquer'|'lecture'|'modifier'}
 */
export function commandeFixe(etatSeance) {
  if (etatSeance.evenement === null) return null;
  const { refus } = etatSeance;
  if (refus?.code === 'LECTURE_SEULE' && refus.details?.raison === 'FORMAT') return 'format';
  if (etatSeance.evenement.etat === 'bloque') return 'debloquer';
  return etatSeance.mode === 'ecriture' ? 'lecture' : 'modifier';
}

/** Les états d'un plan (§ 9), dans l'ordre du spec. */
export const ETATS_PLAN = Object.freeze(['brouillon', 'propose', 'retenu', 'bloque']);

/**
 * La clé du libellé d'un état du plan, evenement.etat.<etat>.
 *
 * @param {string} etat
 * @returns {string}
 * @throws {RangeError} hors d'ETATS_PLAN
 */
export function cleEtat(etat) {
  if (!ETATS_PLAN.includes(etat)) throw new RangeError(`état du plan inconnu : ${JSON.stringify(etat)}`);
  return `evenement.etat.${etat}`;
}

/**
 * Les étapes de la suite des états du plan (§ 9), dans l'ordre d'ETATS_PLAN :
 * pour chacune, son état, la clé de son libellé (cleEtat), l'icône de sa
 * pastille d'état (pastille.js) et courant, vrai pour l'état du plan ouvert
 * seul. Sans événement, aucune n'est courante.
 *
 * @param {Object} etatSeance  EtatSeance
 * @returns {Array<{etat: string, cle: string, icone: string, courant: boolean}>}
 */
export function etapesEtat(etatSeance) {
  const courant = etatSeance.evenement?.etat ?? null;
  return ETATS_PLAN.map((etat) => ({ etat, cle: cleEtat(etat), icone: modelePastille('etat', etat, null).icone, courant: etat === courant }));
}

// Le mode de la bande, son explication et son icône, pour chaque forme du
// cadre : la bande dit ce que le cadre dit.
const BANDES = new Map([
  ['tirets', { mode: 'lecture', explication: 'evenement.bande.lecture', icone: 'oeil' }],
  ['plein', { mode: 'ecriture', explication: 'evenement.bande.ecriture', icone: 'stylo' }],
  ['double', { mode: 'bloque', explication: 'evenement.bande.bloque', icone: 'cadenas' }],
]);

/**
 * La bande de mode, sous le bandeau (§ 8.4) : mode, 'lecture', 'ecriture' ou
 * 'bloque' — un plan bloqué l'est quel que soit le mode — ; cle, le libellé
 * du cadre (cadreDeMode) ; explication, la clé de la phrase qui le suit ;
 * icone, celle des primitives qui le précède. La phrase nomme la commande
 * de la place fixe (commandeFixe) ; devant un format plus récent, qui n'en
 * offre aucune, plan bloqué compris, elle est evenement.bande.lectureSeule,
 * qui n'en nomme aucune. null sans événement.
 *
 * @param {Object} etatSeance  EtatSeance
 * @returns {null|{mode: 'lecture'|'ecriture'|'bloque', cle: string, explication: string, icone: string}}
 */
export function bandeDeMode(etatSeance) {
  const cadre = cadreDeMode(etatSeance);
  if (cadre === null) return null;
  const { mode, explication, icone } = BANDES.get(cadre.forme);
  const phrase = commandeFixe(etatSeance) === 'format' ? 'evenement.bande.lectureSeule' : explication;
  return { mode, cle: cadre.cle, explication: phrase, icone };
}

/**
 * Le résumé chiffré de l'en-tête, tiré de la charge publiée : date, celle de
 * l'événement ou null ; participants, tous ceux de la liste, exclus compris,
 * comme la liste des événements les compte ; tables ; sieges, la somme de
 * leurs capacités (etatTable, tables/modele.js), défaut ou surcharge ;
 * tours. null sans charge.
 *
 * @param {Object} etatSeance  EtatSeance
 * @returns {null|{date: string|null, participants: number, tables: number, sieges: number, tours: number}}
 */
export function resumeEvenement(etatSeance) {
  const { charge } = etatSeance;
  if (charge === null || charge === undefined) return null;
  const { date, siegesParDefaut, tours } = charge.evenement;
  let sieges = 0;
  for (const table of charge.tables) sieges += etatTable(table, siegesParDefaut).capacite;
  return { date: date ?? null, participants: charge.participants.length, tables: charge.tables.length, sieges, tours };
}

/**
 * Le verrou que l'écran offre de reprendre (§ 8.8) : en lecture, celui qui a
 * refusé le dernier passage en écriture quand sa vie ne se prouve pas
 * (vivant null) — un autre poste, un verrou illisible. Un verrou vivant ne
 * se reprend jamais, et celui d'une séance morte, la séance le reprend
 * seule. null sinon.
 *
 * @param {Object} etatSeance  EtatSeance
 * @returns {null|{seance: string|null, depuis: string|null, vivant: null}}
 */
export function repriseOfferte(etatSeance) {
  const { evenement, mode, verrouAutre } = etatSeance;
  if (evenement === null || mode !== 'lecture' || verrouAutre === null || verrouAutre.vivant !== null) return null;
  return verrouAutre;
}

// Le remède que l'écran joint à un avertissement : rouvrir la version
// précédente d'un retenu fautif ; ouvrir les propositions devant une dérive,
// et les tables devant des places manquantes. Les autres n'en ont pas.
const VERS_PROPOSITIONS = Object.freeze({ geste: 'ouvrirSection', section: 'propositions' });
const REMEDES = new Map([
  ['RETENU_FAUTIF', Object.freeze({ geste: 'ouvrirSecours', source: 'precedent' })],
  ['DERIVE', VERS_PROPOSITIONS],
  ['DERIVE_NOUVELLE', VERS_PROPOSITIONS],
  ['PLACES_MANQUANTES', Object.freeze({ geste: 'ouvrirSection', section: 'tables' })],
]);

// Le remède d'un avertissement : celui qu'il porte en details.remede quand
// il en porte un — LISTE_SUR_VOISINE, le déplacement de la voisine que la
// commande a choisi —, sinon celui de REMEDES, sauf une réservation que le
// retenu ne tient pas à son siège (details.siege), que lève l'échange de sa
// personne avec l'occupant, ou, chaise vide, son déplacement au siège.
function remedeDe(code, details) {
  if (details?.remede !== undefined && details.remede !== null) return details.remede;
  if (code === 'RESERVATION_NON_HONOREE' && details.siege !== undefined) {
    const { tour, participant, table, siege, occupant } = details;
    return occupant === null
      ? { commande: 'deplacerDansRetenu', arguments: { tour, participant, table, siege } }
      : { commande: 'echangerDansRetenu', arguments: { tour, a: participant, b: occupant } };
  }
  return REMEDES.get(code) ?? null;
}

// Ce que l'examen de la séance dit de chaque placement que nomme une dérive
// {ids, retenu} : le retenu d'abord, quand la dérive le nomme, puis chaque
// proposition de ids, dans l'ordre de ids, avec ses raisons. Un placement
// que l'examen ne porte pas n'apparaît pas.
function derivesNommees({ ids = [], retenu = false }, examen) {
  if (examen === null || examen === undefined) return [];
  const nommees = [];
  if (retenu && examen.retenu.raisons.length > 0) nommees.push({ id: 'retenu', raisons: examen.retenu.raisons });
  for (const id of ids) {
    const derive = examen.derives.find((candidate) => candidate.id === id);
    if (derive !== undefined) nommees.push({ id, raisons: derive.raisons });
  }
  return nommees;
}

/**
 * Les avertissements à montrer, dans l'ordre d'EtatSeance.avertissements —
 * celui de la séance : ceux de l'Ouvert courant, INVARIANT_VIOLE, ceux du
 * dernier geste, RETOUR_AUTOMATIQUE —, sans en retirer ni en ajouter. Chacun
 * garde son code et ses détails, et reçoit son remède : RETENU_FAUTIF →
 * { geste: 'ouvrirSecours', source: 'precedent' } ; DERIVE et
 * DERIVE_NOUVELLE → { geste: 'ouvrirSection', section: 'propositions' } ;
 * PLACES_MANQUANTES → { geste: 'ouvrirSection', section: 'tables' } ; null
 * pour les autres. PROPOSITIONS_FAUTIVES porte en plus fautives, celles
 * d'EtatSeance.fautives ; DERIVE, derives, ce que l'examen dit de chaque
 * placement qu'elle nomme ({id: number|'retenu', raisons}). Le texte vient
 * de la traduction, sur le code.
 *
 * @param {Object} etatSeance  EtatSeance
 * @returns {Array<{code: string, details: Object, remede: Object|null, fautives?: Object[], derives?: Object[]}>}
 */
export function avertissementsOrdonnes(etatSeance) {
  return etatSeance.avertissements.map(({ code, details }) => {
    const rendu = { code, details, remede: remedeDe(code, details) };
    if (code === 'PROPOSITIONS_FAUTIVES') rendu.fautives = etatSeance.fautives;
    if (code === 'DERIVE') rendu.derives = derivesNommees(details, etatSeance.examen);
    return rendu;
  });
}
