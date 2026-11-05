// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

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
 * @param {{t: Function, format: {nombre: Function}, nomsTours?: Array<string|null>}} outils
 *   la traduction, la mise en forme qui écrit chaque numéro de tour, et les
 *   noms des tours de l'événement (nomsDesTours), dont chaque tour figé qui
 *   en a un suit son numéro
 * @returns {string|null}
 */
export function texteFiliation(derivation, { t, format, nomsTours }) {
  if (derivation === null) return null;
  const { depart, toursFiges, departPresent } = derivation;
  if (!departPresent) return t('propositions.filiation.departAbsent', { depart });
  if (toursFiges.length === 0) return t('propositions.filiation.derivee', { depart });
  const terme = (tour) => t('propositions.filiation.tourFige', { numero: format.nombre(tour), nom: nomsTours?.[tour - 1] ?? null });
  return t('propositions.filiation.deriveeFiges', { depart, tours: toursFiges.map(terme) });
}
