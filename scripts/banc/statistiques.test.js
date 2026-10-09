// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves des statistiques du temps par image (§ 19.10) : des listes
// écrites, dont chaque statistique se lit à la main sur la liste triée.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { statistiques } from './statistiques.js';

// Vingt intervalles dans le désordre. Triés : 6 7 7 8 8 8 9 9 9 10 | 11 11 12
// 12 13 14 15 33 41 50. La médiane est la moyenne des deux du milieu, 10 et
// 11 ; le p95, au rang ⌈0,95 × 20⌉ = 19, vaut 41 — une interpolation
// rendrait 41,45, le rang 20 rendrait 50.
const VINGT = Object.freeze([12, 9, 33, 7, 8, 41, 10, 6, 15, 11, 9, 7, 50, 8, 13, 11, 12, 9, 14, 8]);

describe('statistiques du temps par image', () => {
  test('vingt intervalles connus : nombre d’images, médiane, p95 au rang le plus proche, maximum', () => {
    assert.deepEqual(statistiques(VINGT), { images: 20, medianeMs: 10.5, p95Ms: 41, maxMs: 50 });
  });

  test('une longueur impaire : la médiane est l’intervalle du milieu', () => {
    assert.deepEqual(statistiques([5, 1, 3]), { images: 3, medianeMs: 3, p95Ms: 5, maxMs: 5 });
  });

  test('cent intervalles de 1 à 100 : le p95 est le 95e, la médiane la moyenne du 50e et du 51e', () => {
    const cent = Array.from({ length: 100 }, (_, i) => 100 - i);
    assert.deepEqual(statistiques(cent), { images: 100, medianeMs: 50.5, p95Ms: 95, maxMs: 100 });
  });

  // 0,95 × 11 = 10,45 : le rang ⌈10,45⌉ = 11 et l'arrondi au plus proche,
  // 10, désignent deux intervalles distincts ; aux longueurs 1, 3, 20 et 100
  // des autres épreuves, ils désignent le même.
  test('onze intervalles de 1 à 11 : le p95 est au rang ⌈10,45⌉ = 11, et non à l’arrondi 10', () => {
    const onze = [4, 11, 7, 1, 9, 2, 10, 5, 8, 3, 6];
    assert.deepEqual(statistiques(onze), { images: 11, medianeMs: 6, p95Ms: 11, maxMs: 11 });
  });

  test('un seul intervalle : chaque statistique le vaut', () => {
    assert.deepEqual(statistiques([16.7]), { images: 1, medianeMs: 16.7, p95Ms: 16.7, maxMs: 16.7 });
  });

  test('la liste reçue reste dans son ordre', () => {
    const recue = [...VINGT];
    statistiques(recue);
    assert.deepEqual(recue, VINGT);
  });

  test('une liste vide est refusée', () => {
    assert.throws(() => statistiques([]), RangeError);
  });

  test('un intervalle négatif, non fini ou qui n’est pas un nombre est refusé en le nommant', () => {
    assert.throws(() => statistiques([3, -1]), { name: 'RangeError', message: /-1/ });
    assert.throws(() => statistiques([3, Number.NaN]), { name: 'RangeError', message: /NaN/ });
    assert.throws(() => statistiques([3, Number.POSITIVE_INFINITY]), { name: 'RangeError', message: /Infinity/ });
    assert.throws(() => statistiques([3, '4']), { name: 'RangeError', message: /4/ });
  });

  test('autre chose qu’une liste est refusé', () => {
    assert.throws(() => statistiques(null), TypeError);
    assert.throws(() => statistiques(new Set([1, 2])), TypeError);
  });
});
