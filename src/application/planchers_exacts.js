// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les planchers exacts des collisions (§ 5.6), côté interface : ce qu'on
// donne au solveur du travailleur, ce qu'on fait de ses issues, et le
// plancher qu'un plan doit atteindre. Pur : ce module n'importe pas le
// solveur (solveur_travailleur.js seul le charge), et l'interface le lit
// sans importer le moteur (§ 13.4).
//
// Le travailleur résout chaque tour seul (modele_tour.js) : (A), un
// placement du tour sans conflit d'organisation existe ou non ; (AC), le
// minimum exact des collisions du tour parmi ces placements. Zéro conflit
// est possible si et seulement si (A) vaut à chaque tour, et la somme des
// (AC) est le minimum exact des collisions cumulées des plans sans conflit.
// Ce minimum ne vaut QUE pour un plan sans conflit : un plan qui accepte un
// conflit peut descendre au-dessous. Il n'est pas forcément atteint par la
// meilleure proposition du moteur : l'excédent et les rencontres répétées,
// qui lient les tours, passent avant les collisions cumulées dans le
// classement. Un tour qui atteint sa limite de temps ne donne qu'une borne
// prouvée, « au moins », peut-être pas atteignable.
import { ErreurConfiguration } from '../moteur/erreurs.js';
import { normaliser } from '../moteur/configuration.js';
import { configurationDe } from './configuration.js';
import { donneesDesTours } from './modele_tour.js';
import { plancherCollisionsTotal } from './planchers_conflits.js';

/** La limite de temps de la résolution d'un tour, en secondes. */
export const LIMITE_PAR_TOUR = 30;

/**
 * @typedef {Object} IssueTour
 * @property {true|false|null} faisable  un placement du tour sans conflit
 *           d'organisation existe (true), n'existe pas (false), ou la limite
 *           de temps a tu la réponse (null)
 * @property {number|null} minimum  le minimum exact des collisions du tour
 *           parmi ces placements, null s'il n'est pas prouvé
 * @property {number|null} auMoins  une borne prouvée de ce minimum, quand la
 *           limite de temps est atteinte avant la preuve ; null sinon
 * @property {null|'reserves'|'places'|'affectation'|'solveur'|'limite'|'echec'} cause
 *           pourquoi minimum manque : des réservés en conflit à une même
 *           table, un manque de places, une unité sans table possible, une
 *           infaisabilité que le solveur prouve, la limite de temps, ou un
 *           échec du solveur, jamais lu comme une preuve ; null quand
 *           minimum est prouvé
 * @property {number} duree   millisecondes de résolution du tour
 * @property {boolean} cache  vrai quand aucune résolution n'a tourné : le
 *           résultat d'un texte LP identique a servi
 */

/**
 * @typedef {Object} PlanchersExacts
 * @property {true|false|null} sansConflit  un plan sans conflit
 *           d'organisation existe, n'existe pas, ou l'on ne sait pas
 * @property {number[]} toursSansIssue  les tours (à partir de 1) sans
 *           placement sans conflit, hors des tours dont des réservations
 *           imposent le conflit
 * @property {number|null} plancherCumulees  le plancher des collisions
 *           cumulées d'un plan sans conflit
 * @property {boolean} exact  plancherCumulees est le minimum exact
 * @property {Array<{minimum: number|null, auMoins: number|null}>} parTour
 * @property {number[]} toursALimite  les tours (à partir de 1) qui ont
 *           atteint leur limite de temps
 */

/**
 * Les entrées du solveur pour une charge : les données de chaque tour
 * (donneesDesTours) et leur clé, leur JSON. La clé ne change que si le
 * modèle change : ni les plans, ni les propositions, ni un nom ne la
 * touchent, et aucun calcul ne se relance pour eux. null pour une charge
 * null, pour une configuration que normaliser refuse (une
 * ErreurConfiguration, comme diagnostiquerCharge ; toute autre erreur est
 * une faute du code et remonte), sous séparation décochée — les collisions
 * ne comptent pas — et quand un tour manque de places : aucun plan n'existe,
 * le solveur n'a rien à prouver, et le manque de places ne doit pas se lire
 * comme un conflit inévitable. Ne modifie pas la charge.
 *
 * @param {import('../stockage/types.js').Charge|null} charge
 * @returns {{cle: string, tours: import('./modele_tour.js').DonneesTour[]}|null}
 */
export function entreesDuSolveur(charge) {
  if (charge === null) return null;
  let instance;
  try {
    instance = normaliser(configurationDe(charge));
  } catch (erreur) {
    if (!(erreur instanceof ErreurConfiguration)) throw erreur;
    return null;
  }
  if (!instance.contraintes.separerOrganisations) return null;
  const tours = donneesDesTours(instance);
  if (tours.some(({ infaisable }) => infaisable === 'places')) return null;
  return { cle: JSON.stringify(tours), tours };
}

/**
 * Les planchers exacts, assemblés des issues des tours, une par tour dans
 * l'ordre des données. sansConflit vaut false dès qu'un tour n'a aucun
 * placement sans conflit — une preuve, quels que soient les autres —, sinon
 * null dès qu'un tour a une faisabilité inconnue, sinon true.
 * plancherCumulees est la somme, sur les tours, du minimum, ou à défaut de
 * la borne auMoins, ou à défaut de 0, la borne triviale d'un tour arrêté
 * avant toute borne ; exact quand chaque tour a son minimum. plancherCumulees
 * vaut null quand aucun plan sans conflit n'existe, ou qu'un tour finit en
 * échec du solveur.
 *
 * @param {Array<{r: number}>} tours  les données des tours (DonneesTour)
 * @param {IssueTour[]} issues
 * @returns {PlanchersExacts}
 */
export function assemblerPlanchers(tours, issues) {
  if (issues.length !== tours.length) {
    throw new RangeError(`planchers exacts : ${tours.length} tours, ${issues.length} issues`);
  }
  const numeros = (garder) => issues.flatMap((issue, rang) => (garder(issue) ? [tours[rang].r + 1] : []));
  let sansConflit = true;
  if (issues.some(({ faisable }) => faisable === false)) sansConflit = false;
  else if (issues.some(({ faisable }) => faisable === null)) sansConflit = null;
  const echec = issues.some(({ cause }) => cause === 'echec');
  return {
    sansConflit,
    toursSansIssue: numeros(({ faisable, cause }) => faisable === false && cause !== 'reserves'),
    plancherCumulees:
      sansConflit === false || echec ? null : issues.reduce((somme, { minimum, auMoins }) => somme + (minimum ?? auMoins ?? 0), 0),
    exact: issues.every(({ minimum }) => minimum !== null),
    parTour: issues.map(({ minimum, auMoins }) => ({ minimum, auMoins })),
    toursALimite: numeros(({ cause }) => cause === 'limite'),
  };
}

/**
 * Le plancher des collisions cumulées qu'un plan doit atteindre. Les
 * planchers des étoiles et le plancher exact ne valent que pour un plan sans
 * conflit d'organisation : pour un plan qui en a (conflitsDuPlan > 0), la
 * somme des planchers par groupe seule. Sinon le plus grand de la somme
 * renforcée par les étoiles — sans elles quand aucun plan sans conflit
 * n'existe, leur promesse étant vide — et du plancher exact : deux bornes
 * valides du même domaine. Le Diagnostic, qui énonce la charge et non un
 * plan, l'appelle sans conflitsDuPlan.
 *
 * @param {Array<{plancherCumulees: number}>} collisions  diagnostic.collisions
 * @param {Array<{gain: number}>} etoiles  celles de planchersConflits
 * @param {PlanchersExacts|null} exacts
 * @param {{conflitsDuPlan?: number}} [options]
 * @returns {number}
 */
export function plancherRetenu(collisions, etoiles, exacts, { conflitsDuPlan = 0 } = {}) {
  if (conflitsDuPlan > 0) return plancherCollisionsTotal(collisions, []);
  const renforce = plancherCollisionsTotal(collisions, exacts?.sansConflit === false ? [] : etoiles);
  return Math.max(renforce, exacts?.plancherCumulees ?? 0);
}
