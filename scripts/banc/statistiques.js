// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les statistiques du temps par image (§ 19.10) : une liste d'intervalles
// entre images, en millisecondes, rend son nombre, sa médiane, son p95 et
// son maximum. Module pur, sans import : il se charge sous node comme dans la
// page du banc, où mesurerImages (navigateur.js) relève les intervalles.
//
// Le p95 est celui du rang le plus proche : l'intervalle de rang ⌈0,95 n⌉
// dans la liste croissante, un intervalle mesuré et non une interpolation
// entre deux.

/**
 * @param {number[]} intervallesMs   au moins un ; chacun un nombre fini ≥ 0
 * @returns {{images: number, medianeMs: number, p95Ms: number, maxMs: number}}
 *   images : le nombre d'intervalles, une image chacun ; medianeMs : celui du
 *   milieu de la liste triée, ou la moyenne des deux du milieu pour une
 *   longueur paire. La liste reçue n'est pas modifiée.
 * @throws {TypeError} sur autre chose qu'une liste
 * @throws {RangeError} sur une liste vide, ou un intervalle qui n'est pas un
 *   nombre fini positif ou nul, nommé
 */
export function statistiques(intervallesMs) {
  if (!Array.isArray(intervallesMs)) throw new TypeError('statistiques : une liste d’intervalles est attendue');
  if (intervallesMs.length === 0) throw new RangeError('statistiques : aucun intervalle');
  for (const valeur of intervallesMs) {
    if (typeof valeur !== 'number' || !Number.isFinite(valeur) || valeur < 0) {
      throw new RangeError(`statistiques : intervalle refusé, ${String(valeur)}`);
    }
  }
  const triees = [...intervallesMs].sort((a, b) => a - b);
  const n = triees.length;
  const milieu = Math.floor(n / 2);
  const medianeMs = n % 2 === 1 ? triees[milieu] : (triees[milieu - 1] + triees[milieu]) / 2;
  const rang95 = Math.ceil((95 * n) / 100);
  return { images: n, medianeMs, p95Ms: triees[rang95 - 1], maxMs: triees[n - 1] };
}
