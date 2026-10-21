// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les papiers et le badge (§ 11.2) : la seule définition, en millimètres,
// portrait, figée.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { BADGE, MODELES_BADGE, MODELE_BADGE_DEFAUT, PAPIERS, PAPIER_BADGES_DEFAUT, estModeleBadge } from './papiers.js';

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

describe('papiers : les modèles de badge (§ 11.2)', () => {
  test('deux modèles, Avery 5392 puis A6, dans cet ordre ; Avery 5392 par défaut', () => {
    assert.deepEqual(Object.keys(MODELES_BADGE), ['avery5392', 'a6']);
    assert.equal(MODELE_BADGE_DEFAUT, 'avery5392');
  });

  test('le papier des badges par défaut : le Lettre, celui qu’Avery 5392 impose', () => {
    assert.equal(PAPIER_BADGES_DEFAUT, 'Lettre');
    assert.ok(Object.hasOwn(PAPIERS, PAPIER_BADGES_DEFAUT));
    assert.equal(MODELES_BADGE[MODELE_BADGE_DEFAUT].papier, PAPIER_BADGES_DEFAUT);
  });

  test('Avery 5392 : cartes de 101,6 × 76,2 mm à plat, 2 colonnes × 3 rangées sans gouttière, marges 6,35 et 25,4, sur Lettre seulement', () => {
    assert.deepEqual(MODELES_BADGE.avery5392, {
      largeur: 101.6,
      hauteur: 76.2,
      papier: 'Lettre',
      grille: { colonnes: 2, rangees: 3, gauche: 6.35, haut: 25.4 },
    });
  });

  test('la grille Avery remplit la feuille Lettre à 0,01 mm : deux marges latérales et deux cartes en largeur, deux marges et trois cartes en hauteur', () => {
    const { largeur, hauteur, papier, grille } = MODELES_BADGE.avery5392;
    const centiemes = (mm) => Math.round(mm * 100);
    assert.equal(centiemes(2 * grille.gauche) + grille.colonnes * centiemes(largeur), centiemes(PAPIERS[papier].largeur));
    assert.equal(centiemes(2 * grille.haut) + grille.rangees * centiemes(hauteur), centiemes(PAPIERS[papier].hauteur));
  });

  test('A6 : le badge de BADGE, sur tout papier, sans grille fixe', () => {
    assert.deepEqual(MODELES_BADGE.a6, { largeur: BADGE.largeur, hauteur: BADGE.hauteur, papier: null, grille: null });
  });

  test('les modèles sont figés, chaque modèle et sa grille compris ; estModeleBadge ne reconnaît que leurs clés propres', () => {
    assert.ok(Object.isFrozen(MODELES_BADGE) && Object.isFrozen(MODELES_BADGE.a6) && Object.isFrozen(MODELES_BADGE.avery5392));
    assert.ok(Object.isFrozen(MODELES_BADGE.avery5392.grille));
    assert.ok(estModeleBadge('avery5392') && estModeleBadge('a6'));
    for (const autre of ['A6', 'Avery5392', 'avery', '', null, undefined, 5392, 'toString', '__proto__']) {
      assert.equal(estModeleBadge(autre), false, String(autre));
    }
  });
});
