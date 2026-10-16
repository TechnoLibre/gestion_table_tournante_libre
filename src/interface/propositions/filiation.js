// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La phrase qui rattache une proposition dérivée à son départ (§ 5.7, D76,
// C7), la même sous le numéro d'une ligne du tableau, sur la ligne de
// source de la page de qualité et dans sa performance. Seul le départ
// immédiat est nommé ; un départ qui a quitté la liste se dit tel, sans
// désigner aucune autre proposition.

/**
 * La phrase de filiation d'une proposition, ou null quand elle n'est pas
 * une dérivée.
 *
 * @param {null|{depart: number, toursFiges: number[], departPresent: boolean}} derivation
 *   la filiation que rend derivationDe (src/application/depart.js) : le
 *   numéro du départ, ses tours figés croissants, [] sans tour figé, et vrai
 *   quand le départ est encore dans la liste
 * @param {{t: Function, format: {nombre: Function}}} outils  la traduction,
 *   et la mise en forme qui écrit chaque numéro de tour
 * @returns {string|null}
 */
export function texteFiliation(derivation, { t, format }) {
  if (derivation === null) return null;
  const { depart, toursFiges, departPresent } = derivation;
  if (!departPresent) return t('propositions.filiation.departAbsent', { depart });
  if (toursFiges.length === 0) return t('propositions.filiation.derivee', { depart });
  return t('propositions.filiation.deriveeFiges', { depart, tours: toursFiges.map((tour) => format.nombre(tour)) });
}
