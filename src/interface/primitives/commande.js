// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La machine d'une commande, et les remèdes d'un refus (§ 2.1, § 8.5,
// § 14.6), purs : Commande.svelte et Refus.svelte les câblent.
//
// Une commande sans confirmation exécute à chaque clic. Une commande à
// confirmer s'arme au premier clic — son libellé devient celui de la
// confirmation — et n'exécute qu'au second ; le composant la désarme au
// terme de DELAI_CONFIRMATION_MS, par l'horloge qu'il reçoit. Aucun chemin
// n'exécute une commande à confirmer en un clic (§ 8.5).
//
// Le clic répété d'une série — celui dont le compte de clics, detail,
// dépasse 1 — est sans effet sur toute commande : il n'exécute, n'arme ni ne
// confirme rien. Le second clic d'un double-clic tombe souvent sur une autre
// commande que le premier, celle qu'a montée l'exécution à la même place
// — « Revenir en lecture » à la place de « Modifier » —, et il n'est jamais
// une seconde exécution voulue : « Défaire » double-cliqué ne rend qu'un
// geste. Armée, une commande le reste ; un clic simple la confirme.
//
// Une commande n'est pas ré-entrante : de l'exécution lancée à terminer(),
// que le composant appelle quand l'action rend la main, tout clic est sans
// effet. Un second clic pendant une écriture lente ne relance rien.
//
// Un remède (contrat « Refus et avertissements ») est null, une commande
// exécutable telle quelle, { commande, arguments }, ou un geste,
// { geste, … }. Son libellé est la clé communs.remede.<commande>, ou
// communs.remede.<geste>, suivie de .<variante> quand le geste a plusieurs
// libellés selon ses arguments : la source d'ouvrirSecours, la racine
// d'ecrireAilleurs — documents quand elle est donnée, choisi quand
// l'opérateur la désigne —, la section d'ouvrirSection. Son action passe par
// la séance, par l'état de navigation pour ce qui ne fait que montrer, ou
// par un geste que l'écran fournit : choisirPlace se choisit sur le plan,
// enregistrerSous reprend la planche que l'écran a demandée, choisirPapier
// pose la question du papier.

import { COMMANDES } from '../../application/commandes.js';

/** Les variantes d'une commande, la secondaire en tête — celle d'une
 *  commande qui n'en donne pas : principale, l'action à faire sur l'écran,
 *  pleine de la teinte de l'action ; secondaire, à filet ; discrète, sans
 *  fond ni filet au repos. La variante ne change que l'apparence : le rôle,
 *  les attributs et la machine restent ceux de toute commande. */
export const VARIANTES_COMMANDE = Object.freeze(['secondaire', 'principale', 'discrete']);

/**
 * Une variante de commande, rendue telle quelle.
 *
 * @param {string} variante
 * @returns {'secondaire'|'principale'|'discrete'}
 * @throws {RangeError} hors de VARIANTES_COMMANDE, en la nommant
 */
export function exigerVariante(variante) {
  if (!VARIANTES_COMMANDE.includes(variante)) throw new RangeError(`commande : variante inconnue ${JSON.stringify(variante) ?? 'undefined'}`);
  return variante;
}

/** Le délai au terme duquel une commande armée se désarme. */
export const DELAI_CONFIRMATION_MS = 10_000;

/** La clé du libellé que prend « Débloquer » une fois armée (§ 8.5). */
export const CONFIRMATION_DEBLOCAGE = 'communs.commande.confirmerDeblocage';

/** Les gestes d'un remède, ceux du contrat de données. */
export const GESTES = Object.freeze([
  'modifier',
  'debloquer',
  'afficherTour',
  'ouvrirSection',
  'choisirPlace',
  'ouvrirSecours',
  'ecrireAilleurs',
  'enregistrerSous',
  'choisirPapier',
]);

/** Les sources d'un secours (seance.ouvrirSecours). */
export const SOURCES_SECOURS = Object.freeze(['precedent', 'journal']);

/** Les sections qu'ouvre un remède : celles de l'événement ouvert, dans l'ordre du § 2.1. */
export const SECTIONS_REMEDE = Object.freeze([
  'import',
  'participants',
  'tables',
  'plan',
  'diagnostic',
  'generation',
  'propositions',
]);

/**
 * Une machine de commande.
 *
 * @param {{confirmer?: string|null}} [options]  la clé du libellé de
 *        confirmation ; null pour une commande qui exécute au premier clic
 * @returns {{readonly armee: boolean, readonly enCours: boolean,
 *   cliquer: (clic?: {repete?: boolean}) => ({action: 'armer'}|{action: 'executer'}|{action: 'aucune'}),
 *   terminer: () => void, expirer: () => void}}
 *   cliquer ne fait rien pendant une exécution, ni pour le clic répété
 *   d'une série (repete vrai) ; sinon il arme une commande à confirmer
 *   désarmée, et exécute, en la désarmant et en la marquant en cours ;
 *   terminer la rend aux clics ; expirer la désarme.
 */
export function creerMachineCommande({ confirmer = null } = {}) {
  let armee = false;
  let enCours = false;
  return {
    get armee() {
      return armee;
    },
    get enCours() {
      return enCours;
    },
    cliquer({ repete = false } = {}) {
      if (enCours || repete) return { action: 'aucune' };
      if (confirmer !== null && !armee) {
        armee = true;
        return { action: 'armer' };
      }
      armee = false;
      enCours = true;
      return { action: 'executer' };
    },
    terminer() {
      enCours = false;
    },
    expirer() {
      armee = false;
    },
  };
}

// Une valeur d'un remède qui doit appartenir à sa liste : RangeError qui la
// nomme sinon, plutôt qu'une clé de traduction que rien ne porte.
function exigerParmi(valeur, liste, quoi) {
  if (!liste.includes(valeur)) throw new RangeError(`remède : ${quoi} inconnu ${JSON.stringify(valeur)}`);
  return valeur;
}

/**
 * Le libellé d'un remède : sa clé dans la table communs et les détails que
 * le texte reçoit — les arguments d'une commande, le tour d'afficherTour.
 *
 * @param {Object} remede  non null
 * @returns {{cle: string, details: Object}}
 * @throws {RangeError} une commande, un geste, une source ou une section
 *         hors du registre ou du contrat
 */
export function libelleRemede(remede) {
  if (Object.hasOwn(remede, 'commande')) {
    if (!COMMANDES.has(remede.commande)) throw new RangeError(`remède : commande inconnue ${JSON.stringify(remede.commande)}`);
    return { cle: `communs.remede.${remede.commande}`, details: remede.arguments ?? {} };
  }
  const geste = exigerParmi(remede.geste, GESTES, 'geste');
  if (geste === 'ouvrirSecours') {
    return { cle: `communs.remede.ouvrirSecours.${exigerParmi(remede.source, SOURCES_SECOURS, 'source')}`, details: {} };
  }
  if (geste === 'ecrireAilleurs') {
    return { cle: `communs.remede.ecrireAilleurs.${remede.racine ? 'documents' : 'choisi'}`, details: {} };
  }
  if (geste === 'ouvrirSection') {
    return { cle: `communs.remede.ouvrirSection.${exigerParmi(remede.section, SECTIONS_REMEDE, 'section')}`, details: {} };
  }
  if (geste === 'afficherTour') return { cle: 'communs.remede.afficherTour', details: { tour: remede.tour } };
  return { cle: `communs.remede.${geste}`, details: {} };
}

// Ce que fait un geste du remède, par la séance ou par l'état de navigation ;
// null quand ce qui le ferait manque.
function executionDuGeste(remede, seance, ui) {
  switch (remede.geste) {
    case 'modifier':
      return () => seance.passerEnEcriture();
    case 'debloquer':
      return () => seance.debloquer();
    case 'ouvrirSecours':
      return () => seance.ouvrirSecours(seance.etat().evenement.base, remede.source);
    case 'ecrireAilleurs':
      return () => seance.ecrireAilleurs(remede.racine ?? null);
    case 'afficherTour':
      if (ui === null) return null;
      return () => {
        ui.montrerProposition(remede.proposition ?? null);
        ui.montrerTour(remede.tour);
      };
    case 'ouvrirSection':
      if (ui === null) return null;
      return () => ui.allerA(remede.section);
    default:
      return null;
  }
}

/**
 * L'action qu'offre un remède : de quoi poser une Commande à côté du refus.
 * Un geste que gestes fournit passe par lui, avant tout autre chemin ;
 * choisirPlace, enregistrerSous et choisirPapier n'en ont pas d'autre. Un
 * remède de commande s'exécute par seance.executer, tel quel ; modifier,
 * debloquer, ouvrirSecours et ecrireAilleurs par la méthode de la séance de
 * même nom — passerEnEcriture pour modifier, la base de l'événement ouvert
 * pour ouvrirSecours ;
 * afficherTour et ouvrirSection par l'état de navigation, ui.
 *
 * @param {Object|null} remede
 * @param {{seance: Object, ui?: Object|null, gestes?: Object<string, (remede: Object) => unknown>}} dependances
 * @returns {null|{nom: string, cle: string, details: Object, confirmer: string|null, executer: () => unknown}}
 *   null sans remède, ou quand rien ne sait l'exécuter ; nom : la commande
 *   ou le geste, que porte data-commande ; confirmer : la clé de la
 *   confirmation, pour debloquer seul, geste ou commande
 */
export function actionRemede(remede, { seance, ui = null, gestes = {} }) {
  if (remede === null || remede === undefined) return null;
  const { cle, details } = libelleRemede(remede);
  const nom = remede.commande ?? remede.geste;
  // debloquer se confirme, qu'il vienne en geste ou en commande : aucun
  // chemin ne débloque en un clic (§ 8.5).
  const confirmer = nom === 'debloquer' ? CONFIRMATION_DEBLOCAGE : null;
  let executer;
  if (remede.geste !== undefined && Object.hasOwn(gestes, remede.geste)) {
    const fourni = gestes[remede.geste];
    executer = () => fourni(remede);
  } else if (remede.commande !== undefined) {
    executer = () => seance.executer(remede.commande, remede.arguments ?? {});
  } else {
    executer = executionDuGeste(remede, seance, ui ?? null);
  }
  if (executer === null) return null;
  return { nom, cle, details, confirmer, executer };
}
