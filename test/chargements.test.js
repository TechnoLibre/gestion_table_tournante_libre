// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'analyseur des chargements, test/chargements.js, que lisent les gardes de
// l'arborescence et du livrable. Chaque épreuve donne un texte et les
// chargements qu'il demande, dans l'ordre du texte, ou un composant Svelte et
// le texte de ses blocs de script. Les spécificateurs nus
// des données sont des paquets de devDependencies ou des modules de Node :
// la garde des dépendances lit aussi ce fichier.
import assert from 'node:assert/strict';
import { blocsScript, chargements, scriptsDe } from './chargements.js';
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

describe('chargements : les blocs de script d’un composant Svelte', () => {
  // Un composant à deux blocs, dont l'un sous attribut, du balisage qui écrit
  // « import » en texte, un import() en expression du gabarit, un style à
  // @import, et une balise de script en commentaire HTML.
  const COMPOSANT = [
    '<script module>',
    "  import { tirer } from './module.js';",
    '</script>',
    '',
    '<script>',
    "  import { onMount } from 'svelte';",
    "  import Voisin from './Voisin.svelte';",
    '</script>',
    '',
    "<!-- <script>import { cache } from './commentaire.js';</script> -->",
    "<p>import { faux } from './texte.js';</p>",
    "<p>{import('./expression.js')}</p>",
    '<style>',
    "  @import 'jetons.css';",
    '</style>',
  ].join('\n');

  test('le texte rendu garde la longueur et les lignes du composant ; les blocs de script et les import() du gabarit y restent', () => {
    const scripts = scriptsDe(COMPOSANT);
    assert.equal(scripts.length, COMPOSANT.length);
    assert.equal(scripts.split('\n').length, COMPOSANT.split('\n').length);
    assert.deepEqual(lus(scripts), ['2 ./module.js', '6 svelte', '7 ./Voisin.svelte', '12 ./expression.js']);
    assert.deepEqual(scripts.split('\n')[5], "  import { onMount } from 'svelte';");
    assert.match(scripts.split('\n')[10], /^ *$/);
    assert.equal(scripts.split('\n')[11], "    import('./expression.js')     ");
  });

  test('un import() du gabarit se lit à sa place, à toute profondeur — bloc {#await}, attribut, bloc imbriqué — ; le mot « import » d’un nœud de texte ou d’une chaîne ne se lit pas', () => {
    const texte = [
      '<script>',
      "  let ouvert = $state(false);",
      '</script>',
      "{#await import('../stockage/depot.js') then depot}{/await}",
      '{#if ouvert}',
      "  <button onclick={() => import('./panneau.js')}>import(</button>",
      '  {#each [1] as n}',
      "    <p title={'import(\\'./chaine.js\\')'}>{n}</p>",
      '  {/each}',
      '{/if}',
      "<p>import('./texte.js')</p>",
    ].join('\n');
    const scripts = scriptsDe(texte);
    assert.equal(scripts.length, texte.length);
    assert.deepEqual(lus(scripts), ['4 ../stockage/depot.js', '6 ./panneau.js']);
  });

  test('un composant que l’analyseur de Svelte refuse se lit en entier, gabarit compris : la garde relève plus, jamais moins', () => {
    const texte = "<p>{import('./a.js')}</p>\n<div>\n<script>\nimport { b } from './b.js';";
    assert.deepEqual(lus(scriptsDe(texte)), ['1 ./a.js', '4 ./b.js']);
  });

  test('les étendues désignent le contenu de chaque bloc, balises exclues, et un bloc non fermé court jusqu’à la fin', () => {
    const blocs = blocsScript(COMPOSANT);
    assert.equal(blocs.length, 2);
    assert.deepEqual(
      blocs.map(({ debut, fin }) => COMPOSANT.slice(debut, fin)),
      ["\n  import { tirer } from './module.js';\n", "\n  import { onMount } from 'svelte';\n  import Voisin from './Voisin.svelte';\n"],
    );
    const ouvert = "<p></p>\n<script lang=\"js\">\nimport { a } from './a.js';";
    assert.deepEqual(lus(scriptsDe(ouvert)), ['3 ./a.js']);
  });

  test('un composant sans bloc de script ne charge rien ; une balise voisine n’ouvre aucun bloc', () => {
    for (const texte of ["<p>import { x } from './x.js';</p>", "<scripts>import { x } from './x.js';</scripts>"]) {
      assert.deepEqual(blocsScript(texte), [], texte);
      assert.deepEqual(lus(scriptsDe(texte)), [], texte);
    }
  });
});
