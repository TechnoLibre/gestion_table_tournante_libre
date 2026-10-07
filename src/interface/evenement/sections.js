// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les sections de l'événement ouvert. Aucune n'en exige une autre : la
// navigation les offre toutes, dans l'ordre du parcours de l'opérateur
// (§ 2.1), et la séance refuse elle-même ce qui ne peut pas se faire.

// Chaque section et la clé de son titre, qui la nomme aussi dans la
// navigation, dans l'ordre du § 2.1.
const CLES = new Map([
  ['import', 'coquille.section.import'],
  ['participants', 'coquille.section.participants'],
  ['tables', 'coquille.section.tables'],
  ['plan', 'coquille.section.plan'],
  ['diagnostic', 'coquille.section.diagnostic'],
  ['generation', 'coquille.section.generation'],
  ['propositions', 'coquille.section.propositions'],
]);

/** Les sections de l'itération, dans l'ordre du § 2.1 : import,
 *  participants, tables, plan, diagnostic, generation, propositions. Aucune
 *  n'en exige une autre. Le titre et le nom de navigation de chacune sont la
 *  clé coquille.section.<nom> de coquille.js. */
export const SECTIONS = Object.freeze([...CLES.keys()]);

/** La section qu'un événement montre à son ouverture. */
export const SECTION_OUVERTURE = 'plan';

/**
 * La clé du titre d'une section, coquille.section.<nom>.
 *
 * @param {string} nom
 * @returns {string}
 * @throws {RangeError} hors de SECTIONS
 */
export function cleDeSection(nom) {
  const cle = CLES.get(nom);
  if (cle === undefined) throw new RangeError(`section inconnue : ${JSON.stringify(nom)}`);
  return cle;
}
