// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de l'énumération des mutants (§ 14.13) : chaque opérateur sur un
// extrait inventé, les décalages en unités UTF-16, ce qui n'est jamais muté,
// la clé stable, et le plancher du moteur réel.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAst } from 'vite';
import { describe, test } from '../../test/lanceur.js';
import { appliquer, mutants, OPERATEURS } from './mutants.js';

const RACINE = fileURLToPath(new URL('../..', import.meta.url));
const EXTRAIT = 'scripts/mutation/extrait.js';

// Les sources mutées d'un extrait, pour un opérateur, dans l'ordre du source.
const mutes = (source, operateur) =>
  mutants(source, EXTRAIT)
    .filter((m) => m.operateur === operateur)
    .map((m) => appliquer(source, m));

// Vrai quand (ligne, colonne) ne décroît jamais d'un mutant au suivant.
const ordonne = (liste) =>
  liste.every((m, i) => i === 0 || liste[i - 1].ligne < m.ligne || (liste[i - 1].ligne === m.ligne && liste[i - 1].colonne <= m.colonne));

describe('OPERATEURS', () => {
  test('la liste est figée et nomme chaque opérateur une fois', () => {
    assert.deepEqual(OPERATEURS, [
      'arithmetique',
      'frontiere',
      'negation',
      'logique',
      'retrait-non',
      'mise-a-jour',
      'nombre-plus-un',
      'nombre-zero',
      'booleen',
      'si-vrai',
      'si-faux',
      'ternaire-vrai',
      'ternaire-faux',
      'min-max',
      'corps-si',
    ]);
    assert.ok(Object.isFrozen(OPERATEURS));
  });
});

describe('chaque opérateur sur un extrait minimal', () => {
  test('arithmetique : + et - s’échangent, * et / aussi, % devient *', () => {
    const source = 'y = a + b;\ny = a - b;\ny = a * b;\ny = a / b;\ny = a % b;\n';
    assert.deepEqual(mutes(source, 'arithmetique'), [
      'y = a - b;\ny = a - b;\ny = a * b;\ny = a / b;\ny = a % b;\n',
      'y = a + b;\ny = a + b;\ny = a * b;\ny = a / b;\ny = a % b;\n',
      'y = a + b;\ny = a - b;\ny = a / b;\ny = a / b;\ny = a % b;\n',
      'y = a + b;\ny = a - b;\ny = a * b;\ny = a * b;\ny = a % b;\n',
      'y = a + b;\ny = a - b;\ny = a * b;\ny = a / b;\ny = a * b;\n',
    ]);
  });

  test('arithmetique : une concaténation avec une chaîne n’est pas une addition', () => {
    assert.deepEqual(mutes("s = 'a' + b;\ns = b + 'a';\n", 'arithmetique'), []);
  });

  test('frontiere : < et <= s’échangent, > et >= aussi', () => {
    assert.deepEqual(mutes('p = a < b; p = a <= b; p = a > b; p = a >= b;', 'frontiere'), [
      'p = a <= b; p = a <= b; p = a > b; p = a >= b;',
      'p = a < b; p = a < b; p = a > b; p = a >= b;',
      'p = a < b; p = a <= b; p = a >= b; p = a >= b;',
      'p = a < b; p = a <= b; p = a > b; p = a > b;',
    ]);
  });

  test('negation : l’égalité et chaque comparaison prennent leur contraire', () => {
    const source = 'p = a === b; p = a !== b; p = a == b; p = a != b; p = a < b; p = a <= b; p = a > b; p = a >= b;';
    const remplacements = mutants(source, EXTRAIT)
      .filter((m) => m.operateur === 'negation')
      .map((m) => `${m.original}→${m.remplacement}`);
    assert.deepEqual(remplacements, ['===→!==', '!==→===', '==→!=', '!=→==', '<→>=', '<=→>', '>→<=', '>=→<']);
  });

  test('logique : && et || s’échangent, ?? devient &&, entre parenthèses', () => {
    assert.deepEqual(mutes('p = a && b; p = a || b; p = a ?? b;', 'logique'), [
      'p = ((a )||( b)); p = a || b; p = a ?? b;',
      'p = a && b; p = ((a )&&( b)); p = a ?? b;',
      'p = a && b; p = a || b; p = ((a )&&( b));',
    ]);
  });

  test('logique : la parenthèse garde l’arbre quand la priorité change', () => {
    // a && b && c se lit (a && b) && c : sans parenthèse, le nœud de gauche muté
    // en || se relirait a || (b && c).
    const source = 'p = a && b && c;';
    const interieur = mutants(source, EXTRAIT).find((m) => m.operateur === 'logique' && m.original === 'a && b');
    assert.equal(appliquer(source, interieur), 'p = ((a )||( b)) && c;');
    // Un ?? sous un ?? ne se mêle pas à && sans parenthèse : la source mutée se lit.
    for (const m of mutants('p = a ?? b ?? c;', EXTRAIT)) {
      parseAst(appliquer('p = a ?? b ?? c;', m));
    }
  });

  test('retrait-non : le ! part, son argument reste', () => {
    assert.deepEqual(mutes('p = !a; q = !(b && c);', 'retrait-non'), ['p = a; q = !(b && c);', 'p = !a; q = (b && c);']);
  });

  test('mise-a-jour : ++ et -- s’échangent, += et -= aussi', () => {
    assert.deepEqual(mutes('i++; --j; k += c; k -= c;', 'mise-a-jour'), [
      'i--; --j; k += c; k -= c;',
      'i++; ++j; k += c; k -= c;',
      'i++; --j; k -= c; k -= c;',
      'i++; --j; k += c; k += c;',
    ]);
  });

  test('nombre-plus-un et nombre-zero : n devient n + 1, puis 0 s’il ne l’est pas déjà', () => {
    const source = 'n = 3; n = 0.5; n = 0; n = 0x10;';
    assert.deepEqual(mutes(source, 'nombre-plus-un'), [
      'n = 4; n = 0.5; n = 0; n = 0x10;',
      'n = 3; n = 1.5; n = 0; n = 0x10;',
      'n = 3; n = 0.5; n = 1; n = 0x10;',
      'n = 3; n = 0.5; n = 0; n = 17;',
    ]);
    assert.deepEqual(mutes(source, 'nombre-zero'), [
      'n = 0; n = 0.5; n = 0; n = 0x10;',
      'n = 3; n = 0; n = 0; n = 0x10;',
      'n = 3; n = 0.5; n = 0; n = 0;',
    ]);
  });

  test('nombre : une clé de propriété n’est pas une valeur', () => {
    assert.deepEqual(mutants('o = { 1: a };', EXTRAIT), []);
  });

  test('booleen : true et false s’échangent', () => {
    assert.deepEqual(mutes('v = true; w = false;', 'booleen'), ['v = false; w = false;', 'v = true; w = true;']);
  });

  test('si-vrai et si-faux : le test d’un if devient constant, sauf s’il l’est déjà', () => {
    const source = 'if (a > b) f();\nif (true) g();\n';
    assert.deepEqual(mutes(source, 'si-vrai'), ['if (true) f();\nif (true) g();\n']);
    assert.deepEqual(mutes(source, 'si-faux'), ['if (false) f();\nif (true) g();\n', 'if (a > b) f();\nif (false) g();\n']);
  });

  test('ternaire-vrai et ternaire-faux : le test du ternaire devient constant', () => {
    assert.deepEqual(mutes('v = a || b ? c : d;', 'ternaire-vrai'), ['v = true ? c : d;']);
    assert.deepEqual(mutes('v = a || b ? c : d;', 'ternaire-faux'), ['v = false ? c : d;']);
  });

  test('min-max : Math.min et Math.max s’échangent, rien d’autre ne s’appelle min', () => {
    assert.deepEqual(mutes('v = Math.min(a, b); w = Math.max(a, b); x = o.min(a);', 'min-max'), [
      'v = Math.max(a, b); w = Math.max(a, b); x = o.min(a);',
      'v = Math.min(a, b); w = Math.min(a, b); x = o.min(a);',
    ]);
  });

  test('corps-si : le corps d’un if se vide, l’autre branche reste', () => {
    const source = 'if (a) { f(); } else { g(); }\nif (b) h();\nif (c) {}\n';
    assert.deepEqual(mutes(source, 'corps-si'), [
      'if (a) {} else { g(); }\nif (b) h();\nif (c) {}\n',
      'if (a) { f(); } else { g(); }\nif (b) {}\nif (c) {}\n',
    ]);
  });
});

describe('décalages', () => {
  test('un commentaire accentué avant le site : appliquer coupe au bon endroit, en unités UTF-16', () => {
    // é, « » et une clé de sol hors du plan multilingue de base, qui compte
    // deux unités UTF-16 et quatre octets.
    const source = '// Côté « été » \u{1D11E}\nexport const x = a < b;\n';
    const [site] = mutants(source, EXTRAIT).filter((m) => m.operateur === 'frontiere');
    const indice = source.indexOf('<');
    assert.equal(indice, 38);
    assert.equal(site.debut, indice);
    assert.equal(site.fin, indice + 1);
    assert.equal(site.ligne, 2);
    assert.equal(site.colonne, 20);
    assert.equal(appliquer(source, site), '// Côté « été » \u{1D11E}\nexport const x = a <= b;\n');
  });

  test('un commentaire entre les opérandes qui porte l’opérateur n’est pas le site', () => {
    const source = 'y = a /* é - < */ - b;';
    const sites = mutants(source, EXTRAIT).filter((m) => m.operateur === 'arithmetique');
    assert.equal(sites.length, 1);
    assert.equal(sites[0].debut, source.lastIndexOf('-'));
    assert.equal(appliquer(source, sites[0]), 'y = a /* é - < */ + b;');
  });

  test('un commentaire de ligne entre les opérandes qui porte l’opérateur n’est pas le site', () => {
    const source = 'y = a // note - <\n  - b;';
    const sites = mutants(source, EXTRAIT).filter((m) => m.operateur === 'arithmetique');
    assert.equal(sites.length, 1);
    assert.equal(sites[0].debut, source.lastIndexOf('-'));
    assert.equal(appliquer(source, sites[0]), 'y = a // note - <\n  + b;');
    parseAst(appliquer(source, sites[0]));
  });

  test('appliquer refuse un mutant que le source ne porte plus à sa place', () => {
    const source = 'y = a + b;';
    const [site] = mutants(source, EXTRAIT);
    assert.throws(() => appliquer('y = a - b;', site), /ne porte pas/);
  });
});

describe('ce qui n’est jamais muté', () => {
  test('ni chaîne, ni commentaire, ni gabarit, ni import', () => {
    const source = [
      "import { a } from './a.js';",
      "export { b } from './b.js';",
      "const s = 'a < b + 1 && true';",
      '// c < d + 1 && true',
      '/* e > 2 */',
      'const t = `${a + 1} < 2 ${true}`;',
      'const u = String.raw`${a - 1}`;',
      "const v = import('./c.js');",
      '',
    ].join('\n');
    assert.deepEqual(mutants(source, EXTRAIT), []);
  });

  test('un import dynamique dont l’argument porte des sites reste sans mutant', () => {
    // Hors de import(…), le ternaire, i + 1 et le 1 en donneraient.
    assert.deepEqual(mutants("const m = import(a ? './x.js' : './y.js');\n", EXTRAIT), []);
    assert.deepEqual(mutants("const n = import('./p' + (i + 1) + '.js');\n", EXTRAIT), []);
    assert.ok(mutants("const m = a ? './x.js' : './y.js';\n", EXTRAIT).length > 0);
    assert.ok(mutants("const n = './p' + (i + 1) + '.js';\n", EXTRAIT).length > 0);
  });

  test('un source sans site rend []', () => {
    assert.deepEqual(mutants('', EXTRAIT), []);
    assert.deepEqual(mutants("export const NOM = 'x';\n", EXTRAIT), []);
  });

  test('types.js et les épreuves sont exclus, quel que soit leur contenu', () => {
    assert.ok(mutants('p = a < b;', EXTRAIT).length > 0);
    assert.deepEqual(mutants('p = a < b;', 'src/moteur/types.js'), []);
    assert.deepEqual(mutants('p = a < b;', 'src/moteur/plafond.test.js'), []);
    assert.deepEqual(mutants('p = a < b;', 'src/moteur/plafond.long.test.js'), []);
  });
});

describe('la clé', () => {
  const SOURCE = 'function f(a, b) {\n  if (a < b) return a + 2;\n  return b + 1;\n}\nconst g = (a) => a + 1;\nconst h = (a) => a + 1;\n';

  test('chaque mutant a sa clé, et deux sites identiques se distinguent par leur rang', () => {
    const cles = mutants(SOURCE, EXTRAIT).map((m) => m.cle);
    assert.equal(new Set(cles).size, cles.length);
    const jumeaux = mutants(SOURCE, EXTRAIT).filter((m) => m.operateur === 'arithmetique' && m.ligne >= 5);
    assert.equal(jumeaux.length, 2);
    assert.match(jumeaux[0].cle, /:0$/);
    assert.match(jumeaux[1].cle, /:1$/);
  });

  test('la clé porte le fichier et l’opérateur', () => {
    assert.equal(mutants(SOURCE, EXTRAIT).length, 17);
    for (const m of mutants(SOURCE, EXTRAIT)) {
      assert.ok(m.cle.startsWith(`${EXTRAIT}:${m.operateur}:`), m.cle);
    }
    const autre = mutants(SOURCE, 'scripts/mutation/autre.js').map((m) => m.cle);
    assert.equal(autre.filter((cle) => mutants(SOURCE, EXTRAIT).some((m) => m.cle === cle)).length, 0);
  });

  test('une ligne sans rapport ajoutée au-dessus ne change aucune clé', () => {
    const avant = mutants(SOURCE, EXTRAIT);
    // Le 1 et le 2 ajoutés précèdent ceux de SOURCE : une clé prise sur le
    // seul littéral verrait leur rang glisser.
    const apres = mutants(`let k = 1;\nconst z = y * 2; // é\n${SOURCE}`, EXTRAIT).filter((m) => m.ligne > 2);
    assert.deepEqual(
      apres.map(({ cle, operateur, original, remplacement, ligne }) => ({ cle, operateur, original, remplacement, ligne })),
      avant.map(({ cle, operateur, original, remplacement, ligne }) => ({ cle, operateur, original, remplacement, ligne: ligne + 2 })),
    );
  });

  test('deux énumérations du même source sont identiques', () => {
    assert.ok(mutants(SOURCE, EXTRAIT).length > 0);
    assert.deepEqual(mutants(SOURCE, EXTRAIT), mutants(SOURCE, EXTRAIT));
  });
});

describe('l’ordre du source', () => {
  test('les mutants se rangent par place du jeton muté, quel que soit le parcours de l’arbre', () => {
    // Le if se visite avant le < de son test, et le test avant le corps.
    const source = 'if (a < b) y = a + 2;\n';
    const liste = mutants(source, EXTRAIT);
    assert.ok(ordonne(liste));
    assert.deepEqual(
      liste.map((m) => `${m.colonne}:${m.operateur}`),
      ['5:si-vrai', '5:si-faux', '7:frontiere', '7:negation', '12:corps-si', '18:arithmetique', '20:nombre-plus-un', '20:nombre-zero'],
    );
  });

  test('deux mutants d’un même site se rangent dans l’ordre d’OPERATEURS, non dans celui du parcours', () => {
    // Le if se visite avant son test : sans départage, si-vrai passerait devant.
    const operateurs = (source, colonne) =>
      mutants(source, EXTRAIT)
        .filter((m) => m.colonne === colonne)
        .map((m) => m.operateur);
    assert.deepEqual(operateurs('p = a < b;', 7), ['frontiere', 'negation']);
    assert.deepEqual(operateurs('if (0) f();', 5), ['nombre-plus-un', 'si-vrai', 'si-faux']);
    assert.deepEqual(operateurs('if (!a) f();', 5), ['retrait-non', 'si-vrai', 'si-faux']);
  });
});

describe('le moteur réel', () => {
  // Les modules du moteur, hors épreuves, dans l'ordre des noms.
  const dossier = join(RACINE, 'src/moteur');
  const modules = readdirSync(dossier)
    .filter((nom) => nom.endsWith('.js'))
    .sort()
    .map((nom) => ({ fichier: `src/moteur/${nom}`, source: readFileSync(join(dossier, nom), 'utf8') }));

  test('il rend au moins 1 000 mutants, de clés distinctes, chacun à sa place dans le source', () => {
    const tous = modules.flatMap(({ fichier, source }) =>
      mutants(source, fichier).map((m) => {
        assert.equal(source.slice(m.debut, m.fin), m.original, m.cle);
        assert.notEqual(m.remplacement, m.original, m.cle);
        return m;
      }),
    );
    assert.ok(tous.length >= 1000, `${tous.length} mutants`);
    for (const { fichier, source } of modules) assert.ok(ordonne(mutants(source, fichier)), fichier);
    assert.equal(new Set(tous.map((m) => m.cle)).size, tous.length);
    assert.ok(tous.every((m) => !m.fichier.endsWith('types.js') && !m.fichier.endsWith('.test.js')));
  });

  // Relire chaque source mutée reparse le module entier par mutant, des
  // milliers de fois : se relisent le premier mutant de chaque opérateur dans
  // chaque module, et tous ceux de logique, les seuls qui réécrivent un nœud
  // entier.
  test('une source mutée du moteur se lit encore, pour chaque opérateur de chaque module', () => {
    const operateurs = new Set();
    for (const { fichier, source } of modules) {
      const vus = new Set();
      for (const m of mutants(source, fichier)) {
        if (vus.has(m.operateur) && m.operateur !== 'logique') continue;
        vus.add(m.operateur);
        operateurs.add(m.operateur);
        assert.doesNotThrow(() => parseAst(appliquer(source, m)), m.cle);
      }
    }
    assert.deepEqual([...operateurs].sort(), [...OPERATEURS].sort());
  });
});
