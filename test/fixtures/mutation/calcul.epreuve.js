// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'épreuve inventée de calcul.js, que test/mutation.long.test.js joue sous
// le repli node --test (§ 14.8). Son nom ne finit pas par .test.js : aucune
// série de Vitest ne la ramasse.
import assert from 'node:assert/strict';
import { describe, test } from '../../lanceur.js';
import { plusGrand, somme } from './calcul.js';

describe('calcul', () => {
  test('somme', () => {
    assert.equal(somme(4), 10);
    assert.equal(somme(0), 0);
  });

  test('plusGrand', () => {
    assert.equal(plusGrand(2, 5), 5);
    assert.equal(plusGrand(5, 2), 5);
  });
});
