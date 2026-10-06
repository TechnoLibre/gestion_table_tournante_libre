// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les réglages des séries node selon le nombre de cœurs (§ 14.14), et leur
// application dans vitest.config.js.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import configuration from '../vitest.config.js';
import { describe, test } from './lanceur.js';
import { LOURDES, SEUIL_COEURS, coeursDisponibles, ligneMachine, reglagesSeries } from './machine.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const projet = (nom) => configuration.test.projects.find(({ test: { name } }) => name === nom).test;

describe('machine : les réglages selon le nombre de cœurs (§ 14.14)', () => {
  test('à partir de quatre cœurs, des processus complets et la série surveillée entière', () => {
    for (const coeurs of [SEUIL_COEURS, 8, 16, 64]) {
      assert.deepEqual(reglagesSeries(coeurs), {
        petiteMachine: false,
        coeurs,
        pool: 'forks',
        maxWorkers: undefined,
        horsSerieSurveillee: [],
      }, `${coeurs} cœurs`);
    }
  });

  test('en deçà de quatre cœurs, des threads sur tous les cœurs, et les épreuves lourdes en série longue', () => {
    for (const coeurs of [1, 2, 3]) {
      assert.deepEqual(reglagesSeries(coeurs), {
        petiteMachine: true,
        coeurs,
        pool: 'threads',
        maxWorkers: coeurs,
        horsSerieSurveillee: [...LOURDES],
      }, `${coeurs} cœurs`);
    }
  });

  test('un nombre de cœurs qui n’est pas un entier ≥ 1 lève RangeError', () => {
    for (const coeurs of [0, -1, 2.5, Number.NaN, '4', undefined]) {
      assert.throws(() => reglagesSeries(coeurs), RangeError, String(coeurs));
    }
  });

  test('les épreuves lourdes existent, sont de la série surveillée, et la liste n’est pas vide', () => {
    assert.ok(LOURDES.length > 0, 'aucune épreuve lourde nommée');
    for (const fichier of LOURDES) {
      assert.ok(existsSync(join(RACINE, fichier)), `${fichier} absent`);
      assert.match(fichier, /\.test\.js$/);
      assert.doesNotMatch(fichier, /\.(long|navigateur)\.test\.js$/, `${fichier} n'est pas de la série surveillée`);
    }
  });

  test('les cœurs disponibles suivent l’affinité du processus, comme availableParallelism', () => {
    assert.equal(coeursDisponibles(), availableParallelism());
    assert.ok(coeursDisponibles() >= 1);
  });

  test('la ligne annoncée dit le mode, sur une petite machine comme sur une grande', () => {
    assert.equal(
      ligneMachine(reglagesSeries(2)),
      'Machine : 2 cœurs, en deçà de 4 — threads sur les 2 cœurs ; '
        + 'en série longue : src/moteur/integration.test.js.',
    );
    assert.equal(
      ligneMachine(reglagesSeries(1)),
      'Machine : 1 cœur, en deçà de 4 — threads sur son seul cœur ; '
        + 'en série longue : src/moteur/integration.test.js.',
    );
    assert.equal(ligneMachine(reglagesSeries(16)), 'Machine : 16 cœurs — processus complets, série surveillée entière.');
  });
});

describe('machine : vitest.config.js applique les réglages de cette machine', () => {
  const reglages = reglagesSeries(coeursDisponibles());

  test('les projets node et node-long prennent le pool et le nombre de processus retenus', () => {
    for (const nom of ['node', 'node-long']) {
      assert.equal(projet(nom).pool, reglages.pool, nom);
      assert.equal(projet(nom).maxWorkers, reglages.maxWorkers, nom);
    }
  });

  test('une épreuve hors de la série surveillée entre dans la série longue, et nulle part ailleurs', () => {
    for (const fichier of reglages.horsSerieSurveillee) {
      assert.ok(projet('node').exclude.includes(fichier), `${fichier} reste dans node`);
      assert.ok(projet('node-long').include.includes(fichier), `${fichier} manque à node-long`);
    }
    for (const fichier of LOURDES.filter((f) => !reglages.horsSerieSurveillee.includes(f))) {
      assert.ok(!projet('node').exclude.includes(fichier), `${fichier} sort de node sur cette machine`);
      assert.ok(!projet('node-long').include.includes(fichier), `${fichier} entre dans node-long sur cette machine`);
    }
  });

  test('le projet navigateur ne prend aucun de ces réglages', () => {
    const navigateur = projet('navigateur');
    assert.equal(navigateur.pool, undefined);
    assert.equal(navigateur.maxWorkers, undefined);
  });
});
