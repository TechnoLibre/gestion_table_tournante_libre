// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les sections de l'événement ouvert (§ 2.1) : huit noms distincts, dans
// l'ordre du parcours de l'opérateur — les badges, dernière étape, après les
// propositions (§ 2.1 étape 12) —, chacun nommé par sa clé
// coquille.section.<nom> de la table de la coquille ; la section d'ouverture
// en est une. La navigation les groupe en trois phases — préparer, placer,
// produire —, qui les couvrent chacune une fois, dans leur ordre.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { TABLE as COQUILLE } from '../libelles/coquille.js';
import { TABLE as EVENEMENT } from '../libelles/evenement.js';
import { PHASES, SECTION_OUVERTURE, SECTIONS, cleDeSection } from './sections.js';

describe('sections de l’événement (§ 2.1)', () => {
  test('huit noms distincts, dans l’ordre du parcours, les badges après les propositions, figés', () => {
    assert.deepEqual(SECTIONS, ['import', 'participants', 'tables', 'plan', 'diagnostic', 'generation', 'propositions', 'badges']);
    assert.equal(new Set(SECTIONS).size, 8);
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

describe('les phases de la navigation', () => {
  test('trois phases, préparer, placer, produire, qui couvrent les sections une fois chacune, dans l’ordre du parcours', () => {
    assert.deepEqual(
      PHASES.map(({ nom, sections }) => [nom, sections]),
      [
        ['preparer', ['import', 'participants', 'tables']],
        ['placer', ['plan', 'diagnostic', 'generation', 'propositions']],
        ['produire', ['badges']],
      ],
    );
    assert.deepEqual(
      PHASES.flatMap(({ sections }) => sections),
      SECTIONS,
    );
  });

  test('chaque phase a sa clé evenement.phase.<nom>, au texte non vide, et deux phases n’ont pas le même texte', () => {
    const textes = PHASES.map(({ nom, cle }) => {
      assert.equal(cle, `evenement.phase.${nom}`);
      const texte = EVENEMENT.get(cle);
      assert.equal(typeof texte, 'string', nom);
      assert.notEqual(texte.trim(), '', nom);
      return texte;
    });
    assert.equal(textes.length, 3);
    assert.equal(new Set(textes).size, 3);
  });

  test('les phases, leurs listes et chacune d’elles sont figées', () => {
    assert.ok(Object.isFrozen(PHASES));
    for (const phase of PHASES) {
      assert.ok(Object.isFrozen(phase), phase.nom);
      assert.ok(Object.isFrozen(phase.sections), phase.nom);
    }
  });
});
