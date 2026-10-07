// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Réglages des séries node selon le nombre de cœurs de la machine (§ 14.14).
//
// Le budget de relance, deux secondes, tient avec des processus complets à
// partir de quatre cœurs. En deçà, le lanceur ne porte la série que dans un
// seul processus, et la relance qui suit un module de base — que presque
// toutes les épreuves importent — dépasse ce budget : de l'ordre de trois
// secondes sur deux cœurs. Une petite machine prend donc des threads, moins
// coûteux à démarrer qu'un processus, sur tous ses cœurs, et les épreuves
// lourdes de la série surveillée passent dans la série longue : la même
// relance y tient alors sous une seconde et demie.
//
// Aucune épreuve ne disparaît : elle change de série, et ce qu'elle éprouve
// ne dépend pas de la machine. Les threads partagent un processus : la garde
// de test/fils.test.js tient la série node à l'écart de l'état global du
// processus, sans quoi une épreuve en troublerait une autre.
import { availableParallelism } from 'node:os';

// Nombre de cœurs à partir duquel la série surveillée garde des processus
// complets et toutes ses épreuves.
export const SEUIL_COEURS = 4;

// Épreuves de la série surveillée qui passent dans node-long sur une petite
// machine. L'épreuve de bout en bout lance de vraies recherches : c'est la
// plus lourde de la série, et toute modification du moteur la rejoue.
export const LOURDES = Object.freeze(['src/moteur/integration.test.js']);

/**
 * Réglages des projets node et node-long pour un nombre de cœurs.
 *
 * Sous la mesure de la couverture, aucune épreuve ne quitte la série node :
 * les seuils de branches d'indicateurs.js et de plafond.js se mesurent avec
 * l'épreuve de bout en bout, sur une petite machine comme sur une grande. La
 * mesure ne relance rien sous surveillance ; le budget de relance n'y joue
 * pas. Le reste des réglages ne change pas.
 *
 * @param {number} coeurs  entier ≥ 1
 * @param {{couverture?: boolean}} [options]  couverture vraie quand le
 *          lanceur mesure la couverture (--coverage)
 * @returns {{petiteMachine: boolean, coeurs: number, pool: 'forks'|'threads',
 *            maxWorkers: number|undefined, horsSerieSurveillee: string[]}}
 *          maxWorkers undefined laisse au lanceur son défaut
 */
export function reglagesSeries(coeurs, { couverture = false } = {}) {
  if (!Number.isInteger(coeurs) || coeurs < 1) {
    throw new RangeError(`nombre de cœurs ${String(coeurs)} : entier ≥ 1 attendu`);
  }
  if (coeurs >= SEUIL_COEURS) {
    return { petiteMachine: false, coeurs, pool: 'forks', maxWorkers: undefined, horsSerieSurveillee: [] };
  }
  const horsSerieSurveillee = couverture ? [] : [...LOURDES];
  return { petiteMachine: true, coeurs, pool: 'threads', maxWorkers: coeurs, horsSerieSurveillee };
}

// Cœurs que ce processus peut occuper. availableParallelism suit l'affinité
// du processus : sous « taskset -c 0,1 », il rend 2 sur une machine qui en a
// seize, ce qui permet d'éprouver le mode d'une petite machine sur une grande.
export const coeursDisponibles = () => availableParallelism();

// Ligne que le rapporteur imprime, pour qu'un développeur sache sur quelle
// série sa relance a porté.
export function ligneMachine({ petiteMachine, coeurs, horsSerieSurveillee }) {
  const compte = coeurs === 1 ? '1 cœur' : `${coeurs} cœurs`;
  if (!petiteMachine) return `Machine : ${compte} — processus complets, série surveillée entière.`;
  const ou = coeurs === 1 ? 'sur son seul cœur' : `sur les ${coeurs} cœurs`;
  return `Machine : ${compte}, en deçà de ${SEUIL_COEURS} — threads ${ou} ; `
    + `en série longue : ${horsSerieSurveillee.join(', ')}.`;
}
