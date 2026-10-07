// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les sections de l'événement ouvert (§ 2.1) : sept noms distincts, dans
// l'ordre du parcours de l'opérateur, chacun nommé par sa clé
// coquille.section.<nom> de la table de la coquille ; la section d'ouverture
// en est une.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { TABLE as COQUILLE } from '../libelles/coquille.js';
import { SECTION_OUVERTURE, SECTIONS, cleDeSection } from './sections.js';

describe('sections de l’événement (§ 2.1)', () => {
  test('sept noms distincts, dans l’ordre du parcours, figés', () => {
    assert.deepEqual(SECTIONS, ['import', 'participants', 'tables', 'plan', 'diagnostic', 'generation', 'propositions']);
    assert.equal(new Set(SECTIONS).size, 7);
    assert.ok(Object.isFrozen(SECTIONS));
  });

  test('chaque section a sa clé coquille.section.<nom>, une chaîne non vide, que rend cleDeSection', () => {
    assert.ok(SECTIONS.length > 0);
    for (const nom of SECTIONS) {
      assert.equal(cleDeSection(nom), `coquille.section.${nom}`);
      const texte = COQUILLE.get(cleDeSection(nom));
      assert.equal(typeof texte, 'string', nom);
      assert.notEqual(texte.trim(), '', nom);
    }
  });

  test('la section d’ouverture est le plan, l’une des sections', () => {
    assert.equal(SECTION_OUVERTURE, 'plan');
    assert.ok(SECTIONS.includes(SECTION_OUVERTURE));
  });

  test('cleDeSection lève RangeError hors de SECTIONS', () => {
    for (const faute of ['accueil', '', 'Plan', 'constructor', undefined]) {
      assert.throws(() => cleDeSection(faute), RangeError, String(faute));
    }
  });
});
