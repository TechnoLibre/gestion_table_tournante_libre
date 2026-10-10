// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'épreuve node inventée de bornes.js, posée en src/moteur/bornes.test.js du
// petit arbre de test/mutation.long.test.js : ses imports sont écrits pour
// cette place. Son nom ici ne finit pas par .test.js : aucune série de Vitest
// ne la ramasse. Elle exécute triple sans en affirmer la valeur.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { plusGrand, triple } from './bornes.js';

describe('bornes', () => {
  test('plusGrand', () => {
    assert.equal(plusGrand(2, 5), 5);
    assert.equal(plusGrand(5, 2), 5);
  });

  test('triple rend un nombre', () => {
    assert.equal(typeof triple(2), 'number');
  });
});
