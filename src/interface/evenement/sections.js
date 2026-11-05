// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

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
  ['qualite', 'coquille.section.qualite'],
  ['badges', 'coquille.section.badges'],
]);

/** Les sections de l'événement, dans l'ordre du § 2.1 : import,
 *  participants, tables, plan, diagnostic, generation, propositions,
 *  qualite — la page de qualité, lue avant de retenir (§ 2.1 étape 10) —,
 *  badges — la planche, dernière étape (§ 2.1 étape 12). Aucune n'en exige
 *  une autre. Le titre et le nom de navigation de chacune sont la clé
 *  coquille.section.<nom> de coquille.js. */
export const SECTIONS = Object.freeze([...CLES.keys()]);

// Les phases de la navigation, chacune avec ses sections, dans l'ordre du
// § 2.1 : préparer la liste et le mobilier, placer, produire la planche.
const PHASES_ET_SECTIONS = [
  ['preparer', ['import', 'participants', 'tables']],
  ['placer', ['plan', 'diagnostic', 'generation', 'propositions', 'qualite']],
  ['produire', ['badges']],
];

/** Les phases qui groupent les sections dans la navigation : { nom, cle,
 *  sections } — cle, evenement.phase.<nom> de evenement.js, l'intertitre du
 *  groupe ; sections, les siennes dans l'ordre de SECTIONS. Mises bout à
 *  bout, les phases rendent SECTIONS, chaque section une fois. Figées. */
export const PHASES = Object.freeze(
  PHASES_ET_SECTIONS.map(([nom, sections]) => Object.freeze({ nom, cle: `evenement.phase.${nom}`, sections: Object.freeze([...sections]) })),
);

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
