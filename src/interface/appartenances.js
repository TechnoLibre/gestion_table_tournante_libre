// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'attribution des teintes d'appartenance des listes, pure. Les
// appartenances distinctes d'un événement — deux chaînes différentes sont
// deux appartenances, comme pour le moteur — se rangent par le comparateur
// de noms du projet : leur clé normalisée (cleNormalisee, § 10.1), comparée
// point de code par point de code, puis, pour deux orthographes de même clé,
// leurs chaînes elles-mêmes. Les RANGS_APPARTENANCE premières reçoivent les
// rangs 1 à RANGS_APPARTENANCE, chacun une teinte de TEINTES_APPARTENANCE
// (marques.js) ; les suivantes, null : leur pastille est neutre.
//
// L'attribution lit toute la liste, exclues comprises : un filtre, un tri,
// une exclusion ne changent aucun rang, et une même appartenance garde sa
// teinte d'une vue à l'autre. Elle ne dépend que des noms portés.

import { cleNormalisee } from '../application/csv.js';
import { comparerPointsDeCode } from '../application/planche.js';
import { TEINTES_APPARTENANCE } from './marques.js';

/** Le nombre de teintes d'appartenance, celui de la palette. */
export const RANGS_APPARTENANCE = TEINTES_APPARTENANCE.length;

/**
 * Les teintes des appartenances d'un événement.
 *
 * @param {Array<{id?: number, appartenance: string|null}>} participants
 *   tous les participants de l'événement, exclus compris
 * @returns {Map<string, number|null>}  chaque appartenance portée, dans
 *   l'ordre du comparateur de noms, vers son rang de 1 à RANGS_APPARTENANCE,
 *   ou null au-delà ; une personne sans appartenance n'y ajoute rien
 * @throws {TypeError} une appartenance qui n'est ni une chaîne ni null, en
 *   nommant l'identifiant de la personne
 */
export function teintesAppartenances(participants) {
  const noms = new Set();
  for (const { id, appartenance } of participants) {
    if (appartenance === null) continue;
    if (typeof appartenance !== 'string') {
      throw new TypeError(`participant ${id} : appartenance chaîne ou null attendue, reçu ${typeof appartenance}`);
    }
    noms.add(appartenance);
  }
  const ranges = [...noms]
    .map((nom) => ({ nom, cle: cleNormalisee(nom) }))
    .sort((a, b) => comparerPointsDeCode(a.cle, b.cle) || comparerPointsDeCode(a.nom, b.nom));
  return new Map(ranges.map(({ nom }, i) => [nom, i < RANGS_APPARTENANCE ? i + 1 : null]));
}
