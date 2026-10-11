// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de la correspondance d'une personne à un objectif (§ 4.5, D18) :
// la règle « au moins une » (OU), la règle « toutes » (ET), la personne sans
// étiquette, l'égalité de chaînes sans normalisation, et le refus d'une
// règle inconnue. Les étiquettes sont des mots génériques inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { correspondA } from './correspondance.js';

// Un objectif de règle et d'étiquettes données.
const objectif = (regle, ...etiquettes) => ({ regle, etiquettes });

describe('correspondA : la règle « au moins une » (OU)', () => {
  test('une seule étiquette commune suffit, à toute place des deux listes', () => {
    assert.equal(correspondA(['finance'], objectif('ou', 'finance', 'ressources humaines')), true);
    assert.equal(correspondA(['bénévole', 'ressources humaines'], objectif('ou', 'finance', 'ressources humaines')), true);
  });

  test("aucune étiquette commune : la personne ne correspond pas", () => {
    assert.equal(correspondA(['Montréal', 'bénévole'], objectif('ou', 'finance', 'ressources humaines')), false);
  });
});

describe('correspondA : la règle « toutes » (ET)', () => {
  test('la personne porte chacune des étiquettes, et d’autres encore', () => {
    assert.equal(correspondA(['bénévole', 'finance', 'Montréal'], objectif('et', 'finance', 'Montréal')), true);
  });

  test("une étiquette manque : la personne ne correspond pas, même si elle porte l'autre", () => {
    assert.equal(correspondA(['finance'], objectif('et', 'finance', 'Montréal')), false);
    assert.equal(correspondA(['Montréal', 'bénévole'], objectif('et', 'finance', 'Montréal')), false);
  });

  test('un objectif d’une seule étiquette se lit pareil sous les deux règles', () => {
    for (const regle of ['ou', 'et']) {
      assert.equal(correspondA(['finance', 'bénévole'], objectif(regle, 'finance')), true, regle);
      assert.equal(correspondA(['bénévole'], objectif(regle, 'finance')), false, regle);
    }
  });
});

describe('correspondA : les listes vides', () => {
  test('une personne sans étiquette ne correspond à aucun objectif, sous les deux règles', () => {
    for (const regle of ['ou', 'et']) {
      assert.equal(correspondA([], objectif(regle, 'finance')), false, regle);
      assert.equal(correspondA([], objectif(regle)), false, regle);
    }
  });

  test("un objectif sans étiquette n'attend personne, même sous « toutes »", () => {
    for (const regle of ['ou', 'et']) assert.equal(correspondA(['finance'], objectif(regle)), false, regle);
  });
});

describe("correspondA : l'égalité de chaînes (§ 4.5)", () => {
  test('la casse, les blancs et la forme de composition distinguent deux étiquettes', () => {
    assert.equal(correspondA(['Finance'], objectif('ou', 'finance')), false);
    assert.equal(correspondA(['finance '], objectif('ou', 'finance')), false);
    // « é » composé (U+00E9) contre « e » suivi de l'accent combinant (U+0301).
    assert.equal(correspondA(['b\u{e9}n\u{e9}vole'], objectif('ou', 'be\u{301}ne\u{301}vole')), false);
    assert.equal(correspondA(['b\u{e9}n\u{e9}vole'], objectif('et', 'b\u{e9}n\u{e9}vole')), true);
  });
});

describe('correspondA : la règle inconnue', () => {
  test('une règle non résolue ou inconnue lève RangeError, sans se lire comme OU ni comme ET', () => {
    for (const regle of [null, undefined, 'OU', 'toutes', '']) {
      assert.throws(() => correspondA(['finance'], objectif(regle, 'finance')), RangeError, String(regle));
    }
  });

  test('ne modifie pas les listes reçues', () => {
    const personne = Object.freeze(['Montréal', 'finance']);
    const vise = Object.freeze({ regle: 'et', etiquettes: Object.freeze(['finance', 'Montréal']) });
    assert.equal(correspondA(personne, vise), true);
  });
});
