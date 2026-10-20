// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les papiers et le badge (§ 11.2) : la seule définition, en millimètres,
// portrait, figée.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { BADGE, PAPIERS } from './papiers.js';

describe('papiers : la seule définition (§ 11.2)', () => {
  test('A4 210 × 297 et Lettre 215,9 × 279,4, en mm, portrait, dans cet ordre', () => {
    assert.deepEqual(PAPIERS, { A4: { largeur: 210, hauteur: 297 }, Lettre: { largeur: 215.9, hauteur: 279.4 } });
    assert.deepEqual(Object.keys(PAPIERS), ['A4', 'Lettre']);
    for (const { largeur, hauteur } of Object.values(PAPIERS)) assert.ok(hauteur > largeur);
  });

  test('le badge est un A6 exact, 105 × 148 mm, debout', () => {
    assert.deepEqual(BADGE, { largeur: 105, hauteur: 148 });
  });

  test('papiers et badge sont figés, chaque papier compris', () => {
    assert.ok(Object.isFrozen(PAPIERS) && Object.isFrozen(BADGE));
    assert.ok(Object.isFrozen(PAPIERS.A4) && Object.isFrozen(PAPIERS.Lettre));
  });
});
