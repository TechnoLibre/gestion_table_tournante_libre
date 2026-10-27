// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le modèle des informations de la fiche d'une personne (§ 4, § 10.2), pur :
// InformationsFiche.svelte le câble. Le formulaire part des six champs de
// texte de la personne, préremplis, et de la case de l'animation réservée,
// cochée sous la marque ; « Enregistrer » pose une seule commande,
// modifierParticipant, des seuls champs que la saisie change depuis
// l'ouverture et qui diffèrent encore de la personne courante, chacun lu
// comme la commande le lit — NFC, blancs de bord retirés, vide valant null
// — : une saisie qui ne change rien ne pose aucune commande, SANS_EFFET ne se
// produit pas, et une écriture venue d'ailleurs pendant la saisie garde les
// champs que la saisie ne touche pas. Une organisation saisie qui ne diffère
// de celle d'une autre personne que par la casse, les accents ou les blancs
// prend l'orthographe de cette autre personne (orthographeExistante,
// grille.js), et le rendu le dit ; une organisation que la saisie ne touche
// pas reste la sienne, même voisine d'une autre ; la personne elle-même ne
// compte pas, si bien que la seule à porter une organisation en change la
// casse. Les refus restent ceux de la commande et de la séance : NOM_REQUIS
// se pose contre le nom, tout autre contre « Enregistrer ». Ce que les listes
// de conflits ont suivi (§ 4) se lit entre la charge d'avant et celle
// d'après, par la règle même de la commande (suivreOrganisations). Aucune
// fonction ne modifie ce qu'elle reçoit.

import { rienASuivre, suivreOrganisations } from '../../application/conflits_organisation.js';
import { orthographeExistante } from './grille.js';

/** Les champs du formulaire, dans l'ordre des colonnes de la grille : ceux
 *  de texte que modifierParticipant reçoit. */
export const CHAMPS_INFORMATIONS = Object.freeze(['nom', 'prenom', 'organisation', 'courriel', 'titrePressenti', 'notes']);

/** La case du formulaire, après les champs de texte : la marque de
 *  l'animation réservée, que modifierParticipant reçoit en booléen. */
export const CASE_ANIMATION = 'animationReservee';

// La case lue d'une saisie ou d'une personne : vraie sous la marque, fausse
// sans elle.
const cochee = (source) => source[CASE_ANIMATION] === true;

// La commande que pose « Enregistrer ».
const COMMANDE = 'modifierParticipant';

// Deux chaînes, comparées unité UTF-16 par unité : l'ordre de l'écriture.
const comparerTextes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Une saisie lue comme la commande l'enregistre : en NFC, sans ses blancs
// de bord, null quand il ne reste rien ; une valeur absente vaut null.
function lue(texte) {
  const valeur = (texte ?? '').normalize('NFC').trim();
  return valeur === '' ? null : valeur;
}

/**
 * La saisie du formulaire à l'ouverture : chaque champ de la personne, une
 * valeur absente rendue en chaîne vide, puis la case de l'animation
 * réservée, cochée sous la marque.
 *
 * @param {Object} participant
 * @returns {Record<string, string|boolean>}
 */
export function saisieDesInformations(participant) {
  return {
    ...Object.fromEntries(CHAMPS_INFORMATIONS.map((champ) => [champ, participant[champ] ?? ''])),
    [CASE_ANIMATION]: cochee(participant),
  };
}

/**
 * Vrai quand un champ de la saisie, lu comme la commande le lit, diffère de
 * celui de initiale — la saisie de l'ouverture, ou la personne elle-même —,
 * lu de même, ou que la case de l'animation réservée diffère de la sienne :
 * le brouillon tient alors le geste ouvert. Une écriture venue d'ailleurs
 * pendant la saisie ne change pas initiale, et ne tient rien.
 *
 * @param {Object} initiale
 * @param {Record<string, string|boolean>} saisie
 * @returns {boolean}
 */
export function informationsModifiees(initiale, saisie) {
  return CHAMPS_INFORMATIONS.some((champ) => lue(saisie[champ]) !== lue(initiale[champ])) || cochee(saisie) !== cochee(initiale);
}

/**
 * Ce que pose « Enregistrer » : {action: 'aucune'} quand aucun champ ne
 * change ; sinon la commande modifierParticipant de la personne, ses champs
 * changés, lus, dans l'ordre de CHAMPS_INFORMATIONS, puis la case de
 * l'animation réservée, un booléen, qui part sous la même règle, et
 * orthographe, {saisie, retenue} quand l'organisation saisie a pris celle
 * d'une autre personne et change, null sinon. Un champ part quand la
 * saisie le change par rapport à initiale, la saisie de l'ouverture, et que
 * sa valeur — l'orthographe retenue pour l'organisation — diffère de celle
 * de participant, la personne courante ; un champ que la saisie ne touche
 * pas ne part jamais. Sans initiale, la saisie de participant en tient
 * lieu.
 *
 * @param {Object} participant
 * @param {Record<string, string|boolean>} saisie
 * @param {Array<{id: number, organisation: string|null}>} participants   ceux de l'événement
 * @param {(texte: string) => string} cleNormalisee
 * @param {Record<string, string>} [initiale]
 * @returns {{action: 'aucune'} | {action: 'executer', nom: string, args: {id: number, champs: Object}, orthographe: {saisie: string, retenue: string}|null}}
 */
export function commandeDesInformations(participant, saisie, participants, cleNormalisee, initiale = saisieDesInformations(participant)) {
  const autres = participants.filter(({ id }) => id !== participant.id);
  const champs = {};
  let orthographe = null;
  for (const champ of CHAMPS_INFORMATIONS) {
    let valeur = lue(saisie[champ]);
    if (valeur === lue(initiale[champ])) continue;
    if (champ === 'organisation' && valeur !== null) {
      const retenue = orthographeExistante(valeur, autres, cleNormalisee);
      if (retenue !== null && retenue !== participant.organisation) orthographe = { saisie: valeur, retenue };
      valeur = retenue ?? valeur;
    }
    if (valeur !== participant[champ]) champs[champ] = valeur;
  }
  if (cochee(saisie) !== cochee(initiale) && cochee(saisie) !== cochee(participant)) champs[CASE_ANIMATION] = cochee(saisie);
  if (Object.keys(champs).length === 0) return { action: 'aucune' };
  return { action: 'executer', nom: COMMANDE, args: { id: participant.id, champs }, orthographe };
}

/**
 * Le champ contre lequel se pose un refus du formulaire : 'nom' pour
 * NOM_REQUIS, null pour tout autre, posé contre « Enregistrer ».
 *
 * @param {string} code
 * @returns {'nom'|null}
 */
export const champDuRefus = (code) => (code === 'NOM_REQUIS' ? 'nom' : null);

/**
 * Les organisations que le champ propose : celles de l'événement, chacune
 * une fois, rangées par clé normalisée, puis par écriture.
 *
 * @param {Set<string>} organisations
 * @param {(texte: string) => string} cleNormalisee
 * @returns {string[]}
 */
export function suggestionsOrganisation(organisations, cleNormalisee) {
  const cles = new Map([...organisations].map((nom) => [nom, cleNormalisee(nom)]));
  return [...organisations].sort((a, b) => comparerTextes(cles.get(a), cles.get(b)) || comparerTextes(a, b));
}

/**
 * Ce que les listes de conflits ont suivi quand modifierParticipant a changé
 * la personne id, lu entre la charge d'avant et celle d'après : null quand
 * rien n'a suivi, sinon ce que suivreOrganisations rend — renommee, {de,
 * vers} ; retirees, rangées ; propres, un compte. La règle reste celle de
 * suivreOrganisations, rejouée sur les participants d'après, chacun avec la
 * liste qu'il portait avant, sous le renommage que la commande en déduit :
 * l'organisation de la personne changée d'une valeur en une autre. Aucune
 * des deux charges reçues ne change.
 *
 * @param {{participants: Array<Object>}} avant
 * @param {{participants: Array<Object>}} apres
 * @param {number} id
 * @returns {{renommee: {de: string, vers: string}|null, retirees: string[], propres: number}|null}
 */
export function suiviDesConflits(avant, apres, id) {
  const anciens = new Map(avant.participants.map((participant) => [participant.id, participant]));
  const participants = apres.participants.map((participant) => {
    const copie = { ...participant };
    delete copie.conflits;
    const listeAvant = anciens.get(participant.id)?.conflits;
    return listeAvant === undefined ? copie : { ...copie, conflits: listeAvant };
  });
  const de = anciens.get(id)?.organisation ?? null;
  const vers = apres.participants.find((participant) => participant.id === id)?.organisation ?? null;
  const renommage = de !== null && vers !== null && de !== vers ? { de, vers } : null;
  const suivi = suivreOrganisations(avant, { participants }, renommage);
  return rienASuivre(suivi) ? null : suivi;
}
