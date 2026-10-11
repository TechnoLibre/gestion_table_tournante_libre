// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le modèle d'une pastille : sa sorte, sa valeur, la teinte qu'elles
// désignent, son signe — icône ou point — et ce qui lève. Pastille.svelte le
// câble ; la teinte nomme une famille de jetons, dont le registre des signes
// (marques.js) valide la marque sur le fond — marques.test.js vérifie que
// chaque jeton du registre est déclaré dans les deux thèmes.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { RANGS_APPARTENANCE } from '../appartenances.js';
import { SIGNES } from '../marques.js';
import { NOMS_ICONES } from './icones.js';
import { ETATS_PASTILLE, SORTES_PASTILLE, TONS_PASTILLE, modelePastille } from './pastille.js';

describe('modelePastille', () => {
  test('trois sortes ; les quatre états du plan dans l’ordre du § 9 ; cinq tons de statut', () => {
    assert.deepEqual(SORTES_PASTILLE, ['etat', 'appartenance', 'statut']);
    assert.deepEqual(ETATS_PASTILLE, ['brouillon', 'propose', 'retenu', 'bloque']);
    assert.deepEqual(TONS_PASTILLE, ['neutre', 'information', 'avis', 'refus', 'retenu']);
    assert.ok([SORTES_PASTILLE, ETATS_PASTILLE, TONS_PASTILLE].every(Object.isFrozen));
  });

  test('un état : sa teinte, et son icône propre, distincte d’un état à l’autre', () => {
    const modeles = ETATS_PASTILLE.map((etat) => modelePastille('etat', etat));
    assert.deepEqual(modeles.map((m) => m.teinte), ['etat-brouillon', 'etat-propose', 'etat-retenu', 'etat-bloque']);
    assert.deepEqual(modeles.map((m) => m.icone), ['crayon', 'listePoints', 'coche', 'cadenas']);
    assert.ok(modeles.every((m) => m.point === false));
  });

  test('une appartenance : le rang 1 à 6 donne sa teinte, null la neutre ; un point, sans icône', () => {
    for (let rang = 1; rang <= RANGS_APPARTENANCE; rang += 1) {
      assert.deepEqual(modelePastille('appartenance', rang), { teinte: `appartenance-${rang}`, icone: null, point: true });
    }
    assert.deepEqual(modelePastille('appartenance', null), { teinte: 'neutre', icone: null, point: true });
  });

  test('un statut : la teinte de son ton, sans signe par défaut', () => {
    assert.deepEqual(TONS_PASTILLE.map((ton) => modelePastille('statut', ton).teinte), ['neutre', 'information', 'avis', 'refus', 'etat-retenu']);
    assert.ok(TONS_PASTILLE.every((ton) => modelePastille('statut', ton).icone === null && !modelePastille('statut', ton).point));
  });

  test('l’icône donnée remplace le signe par défaut, point compris', () => {
    assert.deepEqual(modelePastille('statut', 'refus', 'croix'), { teinte: 'refus', icone: 'croix', point: false });
    assert.deepEqual(modelePastille('appartenance', 2, 'etoile'), { teinte: 'appartenance-2', icone: 'etoile', point: false });
    assert.equal(modelePastille('etat', 'retenu', 'etoile').icone, 'etoile');
  });

  test('chaque teinte a son signe au registre : sa marque mesurée sur son fond', () => {
    const teintes = new Set([
      ...ETATS_PASTILLE.map((e) => modelePastille('etat', e).teinte),
      ...Array.from({ length: RANGS_APPARTENANCE }, (_, i) => modelePastille('appartenance', i + 1).teinte),
      ...TONS_PASTILLE.map((t) => modelePastille('statut', t).teinte),
    ]);
    assert.equal(teintes.size, 4 + RANGS_APPARTENANCE + 4);
    for (const teinte of teintes) {
      const signe = SIGNES.find((s) => s.jeton === `--couleur-${teinte}-marque`);
      assert.notEqual(signe, undefined, teinte);
      assert.ok(signe.fonds.includes(`--couleur-${teinte}-fond`), teinte);
    }
  });

  test('une sorte, une valeur ou une icône hors contrat lève RangeError en la nommant', () => {
    const leve = (fn, mot) => assert.throws(fn, (e) => e instanceof RangeError && e.message.includes(mot));
    leve(() => modelePastille('couleur', 'brouillon'), 'couleur');
    leve(() => modelePastille('etat', 'archive'), 'archive');
    leve(() => modelePastille('appartenance', 7), '7');
    leve(() => modelePastille('appartenance', 0), '0');
    leve(() => modelePastille('appartenance', '1'), '"1"');
    leve(() => modelePastille('statut', 'retenue'), 'retenue');
    leve(() => modelePastille('etat', 'retenu', 'licorne'), 'licorne');
    assert.ok(NOMS_ICONES.includes('croix'));
  });
});
