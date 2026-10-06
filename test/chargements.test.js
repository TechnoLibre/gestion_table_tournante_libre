// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'analyseur des chargements, test/chargements.js, que lisent les gardes de
// l'arborescence et du livrable. Chaque épreuve donne un texte et les
// chargements qu'il demande, dans l'ordre du texte. Les spécificateurs nus
// des données sont des paquets de devDependencies ou des modules de Node :
// la garde des dépendances lit aussi ce fichier.
import assert from 'node:assert/strict';
import { chargements } from './chargements.js';
import { describe, test } from './lanceur.js';

// Numéro, à partir de 1, de la ligne qui porte le caractère d'indice donné.
const ligneDe = (texte, indice) => texte.slice(0, indice).split('\n').length;

// Chaque chargement d'un texte, en « ligne spécificateur », ou en « ligne
// calculé argument » pour un argument qui n'est pas une chaîne littérale.
const lus = (texte) =>
  chargements(texte).map(({ indice, specificateur, argument }) =>
    specificateur === undefined
      ? `${ligneDe(texte, indice)} calculé ${argument}`
      : `${ligneDe(texte, indice)} ${specificateur}`,
  );

describe('chargements', () => {
  test("un import dont les accolades portent un commentaire à apostrophe se relève, comme celui qui le suit", () => {
    const texte = [
      'import {',
      "  // l'écran d'accueil",
      '  App,',
      "} from '../interface/App.svelte';",
      "import { a } from './a.js';",
    ].join('\n');
    assert.deepEqual(
      chargements(texte).map(({ specificateur }) => specificateur),
      ['../interface/App.svelte', './a.js'],
    );
  });

  test('import et export à from, import seul, import() et require() de chaîne, avec ou sans options, se relèvent à leur ligne, dans l’ordre du texte', () => {
    const texte = [
      "import { a } from './a.js';",
      'import b, { c } from "../b.js";',
      "export * from './c.js';",
      "export { d } from'./d.js';",
      "import 'svelte';",
      'const e = require("electron");',
      "const f = await import('node:fs', { with: {} });",
      'const g = await import(`vitest`);',
      "import * as h from 'svelte/store'; const i = require('./i.cjs');",
    ].join('\n');
    assert.deepEqual(lus(texte), [
      '1 ./a.js',
      '2 ../b.js',
      '3 ./c.js',
      '4 ./d.js',
      '5 svelte',
      '6 electron',
      '7 node:fs',
      '8 vitest',
      '9 svelte/store',
      '9 ./i.cjs',
    ]);
  });

  test("un argument qui n'est pas une chaîne littérale se relève comme calculé, sans spécificateur", () => {
    const texte = [
      'const a = require(nom);',
      'const b = await import(`./${module}.js`);',
      "const c = require('./' + nom);",
      'const d = await import( cible );',
    ].join('\n');
    assert.deepEqual(lus(texte), [
      '1 calculé nom',
      '2 calculé `./${module}.js`',
      "3 calculé './' + nom",
      '4 calculé cible',
    ]);
  });

  test("ni une chaîne qui finit sur « import », ni la règle @import d'une feuille de style ne sont des chargements", () => {
    const texte = [
      "spawnSync(process.execPath, ['--import', 'chargeur.js']);",
      '<style>',
      "  @import 'jetons.css';",
      '</style>',
      "const mot = 'import';",
    ].join('\n');
    assert.deepEqual(lus(texte), []);
  });
});
