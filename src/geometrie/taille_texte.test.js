// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'échelle de la taille du texte de l'écran : ses paliers, figés et
// croissants, son défaut, son domaine et la taille de police de la racine
// que chaque palier donne.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { PALIERS_TAILLE_TEXTE, TAILLE_TEXTE_DEFAUT, estPalierTailleTexte, taillePoliceRacine } from './taille_texte.js';

describe('la taille du texte de l’écran : les paliers', () => {
  test('90, 100, 115, 130 et 150, en pour cent de la taille de base, croissants et figés', () => {
    assert.deepEqual(PALIERS_TAILLE_TEXTE, [90, 100, 115, 130, 150]);
    assert.ok(Object.isFrozen(PALIERS_TAILLE_TEXTE));
    for (let rang = 1; rang < PALIERS_TAILLE_TEXTE.length; rang += 1) {
      assert.ok(PALIERS_TAILLE_TEXTE[rang] > PALIERS_TAILLE_TEXTE[rang - 1]);
    }
  });

  test('le défaut est 100, l’un des paliers', () => {
    assert.equal(TAILLE_TEXTE_DEFAUT, 100);
    assert.ok(PALIERS_TAILLE_TEXTE.includes(TAILLE_TEXTE_DEFAUT));
  });

  test('estPalierTailleTexte admet chaque palier, et rien d’autre : ni un nombre voisin, ni un texte, ni une valeur absente', () => {
    for (const palier of PALIERS_TAILLE_TEXTE) assert.equal(estPalierTailleTexte(palier), true, String(palier));
    for (const faute of [0, 89, 95, 101, 120, 151, 200, -100, 100.5, Number.NaN, '100', '115%', null, undefined, [100], { taille: 100 }]) {
      assert.equal(estPalierTailleTexte(faute), false, JSON.stringify(faute) ?? String(faute));
    }
  });
});

describe('la taille du texte de l’écran : la police de la racine', () => {
  test('chaque palier donne sa taille de police de la racine en pour cent, que les jetons en rem suivent', () => {
    assert.deepEqual(
      PALIERS_TAILLE_TEXTE.map((palier) => taillePoliceRacine(palier)),
      ['90%', '100%', '115%', '130%', '150%'],
    );
  });

  test('hors des paliers, taillePoliceRacine lève RangeError', () => {
    for (const faute of [0, 120, '100', null, undefined, Number.NaN]) {
      assert.throws(() => taillePoliceRacine(faute), RangeError, String(faute));
    }
  });
});
