// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Conflits par table (§ 7.5) : les violations des règles actives, table par
// table et tour par tour, que le plan lit sans rien recalculer. Elles se
// lisent dans parcourirTours (indicateurs.js), le passage dont mesurer tire
// ses chiffres : la somme des paires séparer d'un plan égale ses collisions
// cumulées, celle des personnes nouvelle table ses retours choisis, et les
// paires distinctes nouveaux voisins ses rencontres répétées choisies
// (§ 13.2). La pastille d'une table compte des occurrences de violation —
// une paire en collision, une paire revue, une personne revenue —, et chaque
// règle porte les siennes dans son unité (§ 5.4).
//
// « Varier les appartenances » ne se localise pas à une table : aucune
// violation n'en sort.
import { parcourirTours } from './indicateurs.js';

/**
 * @typedef {Object} ConflitsTable
 * @property {number} table    identifiant
 * @property {number} nombre   violations des règles actives à ce tour, toutes règles
 * @property {Array<{regle: 'separerAppartenances'|'nouveauxVoisins', paires: number[][]}
 *                  |{regle: 'nouvelleTable', personnes: number[]}>} regles
 *           identifiants croissants, règles dans cet ordre ; une règle inactive
 *           ou sans violation est omise
 */

/**
 * Violations des règles actives (§ 7.5), lues dans parcourirTours et rendues
 * en identifiants : séparer les appartenances — les collègues réunis ;
 * nouveaux voisins — les paires revues ; nouvelle table — les personnes
 * revenues. Une paire revue se signale à chaque rencontre répétée, sauf quand
 * toutes ses rencontres jusque-là ont eu lieu à une table où les deux étaient
 * réservés ; une personne revenue, à chaque visite répétée d'une table, sauf
 * quand elle y est réservée à ce tour et l'a été à une visite antérieure.
 *
 * Les index de personnes croissent avec les identifiants : les listes de
 * parcourirTours, traduites terme à terme, restent croissantes.
 *
 * Ne modifie ni l'instance ni le plan ; lève ce que lève exigerPlanIndexe.
 *
 * @param {import('./types.js').Instance} instance
 * @param {ArrayLike<number>} tableDe
 * @returns {ConflitsTable[][]}   [tour][index de table], tables dans l'ordre de l'instance
 */
export function conflitsParTable(instance, tableDe) {
  const { ids, idsTables, contraintes } = instance;
  const enIds = (paires) => paires.map(([a, b]) => [ids[a], ids[b]]);
  return parcourirTours(instance, tableDe).parTour.map((tables) =>
    tables.map(({ collegues, revues, revenus }, t) => {
      const regles = [];
      if (contraintes.separerAppartenances && collegues.length > 0) {
        regles.push({ regle: 'separerAppartenances', paires: enIds(collegues) });
      }
      if (contraintes.nouveauxVoisins && revues.length > 0) {
        regles.push({ regle: 'nouveauxVoisins', paires: enIds(revues) });
      }
      if (contraintes.nouvelleTable && revenus.length > 0) {
        regles.push({ regle: 'nouvelleTable', personnes: revenus.map((p) => ids[p]) });
      }
      let nombre = 0;
      for (const regle of regles) nombre += (regle.paires ?? regle.personnes).length;
      return { table: idsTables[t], nombre, regles };
    }),
  );
}
