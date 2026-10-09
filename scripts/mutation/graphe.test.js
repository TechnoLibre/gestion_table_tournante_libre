// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du graphe des imports de l'audit par mutation (§ 14.13) : un arbre
// inventé, tenu en mémoire, où une épreuve atteint un module par un autre ; un
// module isolé n'est atteint par aucune ; puis le moteur réel, lu sans rien
// écrire.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { describe, test } from '../../test/lanceur.js';
import { construireGraphe, grapheDuProjet, importsDe, testsConcernes } from './graphe.js';

const RACINE = fileURLToPath(new URL('../..', import.meta.url));

// Un arbre inventé : chemin relatif à la racine → texte du module.
const ARBRE = new Map([
  ['src/verger/pommes.test.js', "import { cueillir } from './panier.js';\nimport assert from 'node:assert/strict';\n"],
  ['src/verger/panier.js', "export { cueillir } from '../serre/tige.js';\n"],
  ['src/serre/tige.js', "import { racine } from './sol.js';\nexport const cueillir = () => racine;\n"],
  ['src/serre/sol.js', 'export const racine = 1;\n'],
  ['src/serre/rocaille.js', 'export const caillou = 2;\n'],
  ['src/serre/boucle.js', "import './boucle.js';\nimport { racine } from './sol.js';\n"],
  ['src/serre/tardive.test.js', "const { racine } = await import('./sol.js');\nexport * from './boucle.js';\n"],
  ['src/verger/poires.test.js', "import { test } from 'vitest';\nimport '../../test/lanceur.js';\n"],
]);
const lire = (fichier) => ARBRE.get(fichier);

describe('importsDe', () => {
  test('rend les chargements relatifs, statiques, réexportés ou dynamiques, résolus depuis la racine', () => {
    const source = [
      "import a from './a.js';",
      "import { b } from '../haut/b.js';",
      "export { c } from './sous/c.js';",
      "export * from './d.js';",
      "const e = await import('./e.js');",
      "import 'node:fs';",
      "import { parseAst } from 'vite';",
      "const f = await import(`./${nom}.js`);",
      "const g = './g.js';",
      "import h from './a.js';",
    ].join('\n');
    assert.deepEqual(importsDe(source, 'src/milieu/m.js'), [
      'src/haut/b.js',
      'src/milieu/a.js',
      'src/milieu/d.js',
      'src/milieu/e.js',
      'src/milieu/sous/c.js',
    ]);
  });

  test('un suffixe de requête ne fait pas un autre module', () => {
    assert.deepEqual(importsDe("import p from '../feuilles/x.css?raw';\n", 'src/a/b.js'), ['src/feuilles/x.css']);
  });
});

describe('testsConcernes', () => {
  const graphe = construireGraphe([...ARBRE.keys()], lire);

  test('un module importé indirectement est atteint par les épreuves qui y mènent', () => {
    assert.deepEqual(testsConcernes('src/serre/tige.js', graphe), ['src/verger/pommes.test.js']);
    assert.deepEqual(testsConcernes('src/serre/sol.js', graphe), [
      'src/serre/tardive.test.js',
      'src/verger/pommes.test.js',
    ]);
  });

  test("un module isolé n'est atteint par aucune épreuve", () => {
    assert.deepEqual(testsConcernes('src/serre/rocaille.js', graphe), []);
  });

  test("un cycle d'imports se parcourt sans boucler", () => {
    assert.deepEqual(testsConcernes('src/serre/boucle.js', graphe), ['src/serre/tardive.test.js']);
  });

  test("un module que le graphe ne connaît pas n'est atteint par rien", () => {
    assert.deepEqual(testsConcernes('src/ailleurs/absent.js', graphe), []);
  });

  test('le graphe rend, par module, ses imports triés', () => {
    assert.deepEqual([...graphe.keys()], [...ARBRE.keys()].sort());
    assert.deepEqual(graphe.get('src/serre/boucle.js'), ['src/serre/boucle.js', 'src/serre/sol.js']);
    assert.deepEqual(graphe.get('src/verger/poires.test.js'), ['test/lanceur.js']);
  });
});

describe('le moteur réel', () => {
  test("l'épreuve d'un module du moteur l'atteint, et le graphe ne rend que des épreuves", () => {
    const graphe = grapheDuProjet(RACINE, ['src/moteur']);
    assert.ok(graphe.size > 10, `${graphe.size} modules`);
    assert.ok([...graphe.keys()].every((f) => f.startsWith('src/moteur/') && f.endsWith('.js')));
    const concernes = testsConcernes('src/moteur/plafond.js', graphe);
    assert.ok(concernes.includes('src/moteur/plafond.test.js'), concernes.join(', '));
    assert.ok(concernes.every((f) => f.endsWith('.test.js')));
    assert.deepEqual(concernes, [...concernes].sort());
  });
});
