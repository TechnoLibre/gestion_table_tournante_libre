// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'épreuve longue inventée de bornes.js, posée en
// src/moteur/bornes.long.test.js du petit arbre de
// test/mutation.long.test.js : ses imports sont écrits pour cette place. Son
// nom ici ne finit pas par .test.js : aucune série de Vitest ne la ramasse.
// Elle affirme la valeur de triple, que l'épreuve node tait.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { triple } from './bornes.js';

describe('bornes, série longue', () => {
  test('triple rend le triple', () => {
    assert.equal(triple(2), 6);
  });
});
