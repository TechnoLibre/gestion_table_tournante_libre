// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les réglages des séries node selon le nombre de cœurs (§ 14.14), sous la
// mesure de la couverture comme hors d'elle (§ 14.4, § 14.13), et leur
// application dans vitest.config.js.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
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

  test('sous la mesure de la couverture, aucune épreuve ne quitte la série node, sur une petite machine comme sur une grande ; le reste des réglages ne change pas', () => {
    for (const coeurs of [1, 2, 3, SEUIL_COEURS, 16]) {
      assert.deepEqual(
        reglagesSeries(coeurs, { couverture: true }),
        { ...reglagesSeries(coeurs), horsSerieSurveillee: [] },
        `${coeurs} cœurs`,
      );
      assert.deepEqual(reglagesSeries(coeurs, { couverture: false }), reglagesSeries(coeurs), `${coeurs} cœurs`);
    }
    assert.deepEqual(reglagesSeries(2).horsSerieSurveillee, [...LOURDES]);
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
    // Sous la mesure de la couverture, la petite machine garde tout en série node.
    assert.equal(
      ligneMachine(reglagesSeries(2, { couverture: true })),
      'Machine : 2 cœurs, en deçà de 4 — threads sur les 2 cœurs ; série surveillée entière.',
    );
  });
});

describe('machine : vitest.config.js applique les réglages de cette machine', () => {
  // Les réglages de ce processus : ses cœurs, et la mesure de la couverture
  // quand ses arguments portent --coverage, la règle de vitest.config.js.
  const reglages = reglagesSeries(coeursDisponibles(), { couverture: process.argv.includes('--coverage') });

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

// Projets node et node-long de vitest.config.js, chargé dans un processus à
// part dont la machine n'a que deux cœurs — availableParallelism remplacé
// avant tout import — et dont process.argv porte les arguments donnés, comme
// celui de npm run couverture porte --coverage. Rend la promesse de
// { node, long } : exclude du premier, include du second.
async function projetsSurDeuxCoeurs(argumentsDuLanceur) {
  const deuxCoeurs = [
    "import os from 'node:os';",
    "import { syncBuiltinESMExports } from 'node:module';",
    'os.availableParallelism = () => 2;',
    'syncBuiltinESMExports();',
  ].join('\n');
  const lire = [
    "const { default: configuration } = await import('./vitest.config.js');",
    'const projet = (nom) => configuration.test.projects.find(({ test: { name } }) => name === nom).test;',
    "console.log(JSON.stringify({ node: projet('node').exclude, long: projet('node-long').include }));",
  ].join('\n');
  const { stdout } = await promisify(execFile)(
    process.execPath,
    ['--import', `data:text/javascript,${encodeURIComponent(deuxCoeurs)}`, '--input-type=module', '-e', lire, '--', ...argumentsDuLanceur],
    { cwd: RACINE, encoding: 'utf8' },
  );
  return JSON.parse(stdout);
}

describe('machine : vitest.config.js garde la série node entière sous la mesure de la couverture (§ 14.13)', () => {
  test('sur deux cœurs, --coverage garde les épreuves lourdes dans node, où se mesurent les seuils d’indicateurs.js et de plafond.js ; sans lui, elles passent dans node-long', async () => {
    // Les deux processus partent ensemble : la durée de l'épreuve est celle
    // d'un seul.
    const [mesure, surveillee] = await Promise.all([
      projetsSurDeuxCoeurs(['--project', 'node', '--coverage']),
      projetsSurDeuxCoeurs(['--project', 'node']),
    ]);
    assert.ok(LOURDES.length > 0, 'aucune épreuve lourde nommée');
    for (const fichier of LOURDES) {
      assert.ok(!mesure.node.includes(fichier), `${fichier} sort de node sous --coverage`);
      assert.ok(!mesure.long.includes(fichier), `${fichier} entre dans node-long sous --coverage`);
      assert.ok(surveillee.node.includes(fichier), `${fichier} reste dans node sur deux cœurs`);
      assert.ok(surveillee.long.includes(fichier), `${fichier} manque à node-long sur deux cœurs`);
    }
  });
});
