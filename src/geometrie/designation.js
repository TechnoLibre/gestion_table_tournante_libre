// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La désignation d'un siège (§ 7.3, § 14.10) : ce que contient un point de
// dessin, lu sur les géométries de tables.js, celles mêmes que le dessin pose.
// Le dépôt d'un glissement ne cherche pas sa cible dans le DOM : il convertit
// le point en coordonnées de dessin et le passe à designer. Le seuil des
// cibles, CIBLE_MIN_PX, vient de cible.js, que les graphiques lisent aussi.

import { CIBLE_MIN_PX } from './cible.js';

// Vrai quand le point est dans le disque (ronde) ou le carré aux côtés
// parallèles aux axes (carrée) de demi-taille donnée, centré sur la table,
// bord compris.
function dans(point, { centre, forme }, demiTaille) {
  const dx = point.x - centre.x;
  const dy = point.y - centre.y;
  return forme === 'ronde' ? Math.hypot(dx, dy) <= demiTaille : Math.max(Math.abs(dx), Math.abs(dy)) <= demiTaille;
}

/**
 * Régime des cibles d'une table au zoom k : 'sieges' quand k × pas ≥
 * CIBLE_MIN_PX, 'table' sinon. Le seuil se décide table par table, sur le
 * pas de chacune.
 *
 * @param {number} k  px/cm
 * @param {import('./tables.js').GeometrieTable} geometrie
 * @returns {'sieges'|'table'}
 */
export function regimeCibles(k, geometrie) {
  return k * geometrie.pas >= CIBLE_MIN_PX ? 'sieges' : 'table';
}

/**
 * Le plus petit zoom où regimeCibles rend 'sieges' pour une table :
 * CIBLE_MIN_PX / pas, relevé d'un écart d'arrondi quand le produit k × pas
 * retombe sous le seuil. Au-dessous, la table ne dessine aucune chaise, et
 * aucune marque ne s'y pose (§ 7.3).
 *
 * @param {import('./tables.js').GeometrieTable} geometrie
 * @returns {number}  px/cm
 */
export function kSieges(geometrie) {
  let k = CIBLE_MIN_PX / geometrie.pas;
  while (k * geometrie.pas < CIBLE_MIN_PX) k += k * Number.EPSILON;
  return k;
}

/**
 * Ce que désigne un point de dessin au zoom k.
 *
 * Les tables s'examinent de la dernière reçue à la première, l'ordre inverse
 * de la peinture : la première dont la surface peinte contient le point
 * décide. En régime table, la surface est l'emprise — disque d'une ronde,
 * carré d'une carrée — et la table est désignée. En régime sièges, elle est
 * le plateau et les cibles des sièges : un point à rayonCible au plus du
 * centre d'une chaise — max(RAYON_CHAISE, pas / 2), la cible a la taille du
 * pas — désigne son siège ; un point sur le plateau hors de toute cible ne
 * désigne rien, et cache les chaises des tables peintes dessous ; hors des
 * cibles et du plateau, le point passe aux tables de dessous. Deux cibles
 * d'une même table se touchent au plus : sur leur bord commun, le plus petit
 * siège l'emporte.
 *
 * @param {{x: number, y: number}} point  cm
 * @param {import('./tables.js').GeometrieTable[]} geometries  dans l'ordre du dessin
 * @param {number} k  px/cm
 * @returns {{table: number, siege: number}|{table: number}|null}
 */
export function designer(point, geometries, k) {
  for (let i = geometries.length - 1; i >= 0; i -= 1) {
    const geometrie = geometries[i];
    if (regimeCibles(k, geometrie) === 'table') {
      if (dans(point, geometrie, geometrie.rayonEmprise)) return { table: geometrie.id };
      continue;
    }
    const chaise = geometrie.chaises.find((c) => Math.hypot(point.x - c.x, point.y - c.y) <= geometrie.rayonCible);
    if (chaise !== undefined) return { table: geometrie.id, siege: chaise.siege };
    if (dans(point, geometrie, geometrie.demiTaille)) return null;
  }
  return null;
}

/**
 * Vrai quand le point n'est dans l'emprise — disque ou carré — d'aucune
 * table : le sol, où un dépôt retire la personne du tour.
 *
 * @param {{x: number, y: number}} point  cm
 * @param {import('./tables.js').GeometrieTable[]} geometries
 * @returns {boolean}
 */
export function surLeSol(point, geometries) {
  return !geometries.some((geometrie) => dans(point, geometrie, geometrie.rayonEmprise));
}
