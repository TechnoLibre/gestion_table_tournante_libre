// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// L'attribution des teintes d'organisation des listes, pure. Les
// organisations distinctes d'un événement — deux chaînes différentes sont
// deux organisations, comme pour le moteur — se rangent par le comparateur
// de noms du projet : leur clé normalisée (cleNormalisee, § 10.1), comparée
// point de code par point de code, puis, pour deux orthographes de même clé,
// leurs chaînes elles-mêmes. Les RANGS_ORGANISATION premières reçoivent les
// rangs 1 à RANGS_ORGANISATION, chacun une teinte de TEINTES_ORGANISATION
// (marques.js) ; les suivantes, null : leur pastille est neutre.
//
// L'attribution lit toute la liste, exclues comprises : un filtre, un tri,
// une exclusion ne changent aucun rang, et une même organisation garde sa
// teinte d'une vue à l'autre. Elle ne dépend que des noms portés.

import { cleNormalisee } from '../application/csv.js';
import { comparerPointsDeCode } from '../application/planche.js';
import { TEINTES_ORGANISATION } from './marques.js';

/** Le nombre de teintes d'organisation, celui de la palette. */
export const RANGS_ORGANISATION = TEINTES_ORGANISATION.length;

/**
 * Les teintes des organisations d'un événement.
 *
 * @param {Array<{id?: number, organisation: string|null}>} participants
 *   tous les participants de l'événement, exclus compris
 * @returns {Map<string, number|null>}  chaque organisation portée, dans
 *   l'ordre du comparateur de noms, vers son rang de 1 à RANGS_ORGANISATION,
 *   ou null au-delà ; une personne sans organisation n'y ajoute rien
 * @throws {TypeError} une organisation qui n'est ni une chaîne ni null, en
 *   nommant l'identifiant de la personne
 */
export function teintesOrganisations(participants) {
  const noms = new Set();
  for (const { id, organisation } of participants) {
    if (organisation === null) continue;
    if (typeof organisation !== 'string') {
      throw new TypeError(`participant ${id} : organisation chaîne ou null attendue, reçu ${typeof organisation}`);
    }
    noms.add(organisation);
  }
  const ranges = [...noms]
    .map((nom) => ({ nom, cle: cleNormalisee(nom) }))
    .sort((a, b) => comparerPointsDeCode(a.cle, b.cle) || comparerPointsDeCode(a.nom, b.nom));
  return new Map(ranges.map(({ nom }, i) => [nom, i < RANGS_ORGANISATION ? i + 1 : null]));
}
