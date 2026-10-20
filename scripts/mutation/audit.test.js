// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Gardes de l'audit par mutation (§ 14.13, § 14.4, § 14.14). L'audit est sa
// propre commande — make mutation, npm run mutation, scripts/mutation/audit.js —,
// hors des séries node et node-long : son coût est d'un autre ordre que leurs
// budgets. Son périmètre est le moteur seul. Ces gardes lisent audit.js, le
// Makefile et package.json comme du texte : aucun module n'importe audit.js,
// celui-ci compris, donc aucune épreuve des séries.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAst } from 'vite';
import { describe, test } from '../../test/lanceur.js';
import { construireGraphe, grapheDuProjet } from './graphe.js';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const AUDIT = 'scripts/mutation/audit.js';

// Le périmètre que déclare le source d'audit.js : les chaînes de
// « export const PERIMETRE = [...] » ou « Object.freeze([...]) ». null quand
// il ne le déclare pas ; lève quand la déclaration n'est pas une liste de
// chaînes littérales, qu'aucune garde ne saurait lire.
function perimetreDeclare(source) {
  for (const noeud of parseAst(source).body) {
    if (noeud.type !== 'ExportNamedDeclaration' || noeud.declaration?.type !== 'VariableDeclaration') continue;
    for (const { id, init } of noeud.declaration.declarations) {
      if (id.type !== 'Identifier' || id.name !== 'PERIMETRE') continue;
      const gele =
        init?.type === 'CallExpression' &&
        init.callee.type === 'MemberExpression' &&
        init.callee.object.name === 'Object' &&
        init.callee.property.name === 'freeze';
      const liste = gele ? init.arguments[0] : init;
      if (liste?.type !== 'ArrayExpression') throw new TypeError('PERIMETRE : liste littérale attendue');
      return liste.elements.map((element) => {
        if (element?.type !== 'Literal' || typeof element.value !== 'string') {
          throw new TypeError('PERIMETRE : chaînes littérales attendues');
        }
        return element.value;
      });
    }
  }
  return null;
}

// Les fonctions appelées par leur nom dans le corps de la fonction déclarée
// « nom », fonctions imbriquées comprises, dans l'ordre du texte ; null quand
// le source ne déclare pas cette fonction au niveau du module.
function appelsDans(source, nom) {
  const declaration = parseAst(source).body
    .map((noeud) => (noeud.type === 'ExportNamedDeclaration' ? noeud.declaration : noeud))
    .find((noeud) => noeud?.type === 'FunctionDeclaration' && noeud.id?.name === nom);
  if (declaration === undefined) return null;
  const appels = [];
  const parcourir = (noeud) => {
    if (Array.isArray(noeud)) {
      noeud.forEach(parcourir);
      return;
    }
    if (typeof noeud !== 'object' || noeud === null) return;
    if (noeud.type === 'CallExpression' && noeud.callee.type === 'Identifier') appels.push([noeud.start, noeud.callee.name]);
    for (const cle of Object.keys(noeud).sort()) {
      if (cle !== 'type' && cle !== 'start' && cle !== 'end') parcourir(noeud[cle]);
    }
  };
  parcourir(declaration.body);
  return appels.sort((a, b) => a[0] - b[0]).map(([, appele]) => appele);
}

// Les écarts de l'ordre des appels d'auditer : l'en-tête validé avant la
// ligne de base, l'empreinte prise avant elle et reprise après le dernier
// mutant, avant la première écriture. Une liste vide quand l'ordre tient.
function ecartsDeLOrdre(appels) {
  const premier = (nom) => appels.indexOf(nom);
  const dernier = (nom) => appels.lastIndexOf(nom);
  const base = premier('ligneDeBase');
  const ecarts = [];
  if (premier('verifierEntete') === -1 || premier('verifierEntete') > base) ecarts.push('en-tête validé après la ligne de base');
  if (premier('empreinteDe') === -1 || premier('empreinteDe') > base) ecarts.push('empreinte prise après la ligne de base');
  if (premier('empreinteDe') === dernier('empreinteDe') || dernier('empreinteDe') < dernier('executerMutant') || dernier('empreinteDe') > premier('writeFileSync')) {
    ecarts.push('empreinte non reprise entre le dernier mutant et l’écriture');
  }
  return ecarts;
}

// La cible nommée d'un Makefile : sa ligne de documentation (« ## … »), ses
// commandes (les lignes de recette qui la suivent, tabulation retirée) et sa
// déclaration .PHONY ; null quand le Makefile ne la porte pas.
function cibleDuMakefile(texte, nom) {
  const lignes = texte.split('\n');
  const rang = lignes.findIndex((ligne) => ligne.startsWith(`${nom}:`));
  if (rang === -1) return null;
  const documentation = /##\s*(.*)$/.exec(lignes[rang])?.[1] ?? null;
  const commandes = [];
  for (let i = rang + 1; i < lignes.length && lignes[i].startsWith('\t'); i += 1) commandes.push(lignes[i].slice(1));
  const factice = lignes.some((ligne) => /^\.PHONY:/.test(ligne) && ligne.slice('.PHONY:'.length).trim().split(/\s+/).includes(nom));
  return { documentation, commandes, factice };
}

// Les recettes de toutes les cibles d'un Makefile, { cible, commande }, dans
// l'ordre du texte.
function recettes(texte) {
  const sortie = [];
  let cible = null;
  for (const ligne of texte.split('\n')) {
    const tete = /^([A-Za-z0-9_.-]+):/.exec(ligne);
    if (tete !== null) cible = tete[1];
    else if (ligne.startsWith('\t') && cible !== null) sortie.push({ cible, commande: ligne.slice(1) });
  }
  return sortie;
}

// Écarts entre la couverture et l'audit : la mesure de la couverture garde
// une seule commande, npm run couverture lancé par make couverture, et la
// passe de couverture de l'audit, interne à audit.js, n'en devient pas une
// seconde. Relevés dans l'ordre : chaque script de package.json autre que
// couverture qui mesure (--coverage, --experimental-test-coverage), le script
// mutation qui ne lance pas audit.js seul ; chaque recette du Makefile hors de
// la cible couverture qui lance la mesure ou une passe de couverture.
function ecartsDeLaCouverture({ scripts, makefile }) {
  const ecarts = [];
  const MESURE = /--(?:experimental-test-)?coverage\b/;
  for (const nom of Object.keys(scripts).sort()) {
    if (nom !== 'couverture' && MESURE.test(scripts[nom])) ecarts.push(`npm run ${nom} : mesure la couverture`);
  }
  if (scripts.mutation !== 'node scripts/mutation/audit.js') ecarts.push('npm run mutation : ne lance pas audit.js seul');
  for (const { cible, commande } of recettes(makefile)) {
    if (cible !== 'couverture' && (MESURE.test(commande) || /npm run couverture\b/.test(commande))) {
      ecarts.push(`make ${cible} : lance une mesure de couverture`);
    }
  }
  return ecarts;
}

// Les modules du graphe qui importent la cible, triés. audit.js est un point
// d'entrée en ligne de commande : qu'aucun module ne l'importe garantit
// qu'aucune épreuve, de quelque série qu'elle soit, ne l'atteint par un
// module intermédiaire.
const importateursDe = (cible, graphe) =>
  [...graphe.keys()].filter((fichier) => graphe.get(fichier).includes(cible)).sort();

describe('audit par mutation : sa commande (§ 14.13)', () => {
  const { scripts = {} } = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8'));
  const makefile = readFileSync(join(RACINE, 'Makefile'), 'utf8');

  test('npm run mutation lance scripts/mutation/audit.js, et aucun autre script ne touche à l’audit', () => {
    assert.equal(scripts.mutation, 'node scripts/mutation/audit.js');
    const autres = Object.keys(scripts)
      .sort()
      .filter((nom) => nom !== 'mutation' && /mutation|audit\.js/.test(scripts[nom]));
    assert.deepEqual(autres, []);
  });

  test('make mutation lance npm run mutation, cible factice documentée', () => {
    assert.deepEqual(cibleDuMakefile(makefile, 'mutation'), {
      documentation: 'Audit par mutation du moteur, avant une livraison (§ 14.13)',
      commandes: ['$(AVEC_NODE) npm run mutation'],
      factice: true,
    });
  });

  test('la lecture du Makefile relève une cible absente, une recette autre, une cible non factice', () => {
    assert.equal(cibleDuMakefile('.PHONY: banc\nbanc:\n\t$(AVEC_NODE) npm run banc\n', 'mutation'), null);
    assert.deepEqual(cibleDuMakefile('.PHONY: test\nmutation: ## Audit\n\tnode scripts/mutation/audit.js\n\nx:\n\techo\n', 'mutation'), {
      documentation: 'Audit',
      commandes: ['node scripts/mutation/audit.js'],
      factice: false,
    });
  });
});

describe('audit par mutation : son périmètre, le moteur seul', () => {
  test('audit.js déclare exactement [src/moteur]', () => {
    assert.deepEqual(perimetreDeclare(readFileSync(join(RACINE, AUDIT), 'utf8')), ['src/moteur']);
  });

  test('la lecture du périmètre rend une liste élargie telle quelle, null sans déclaration, et refuse un calcul', () => {
    assert.deepEqual(perimetreDeclare("export const PERIMETRE = Object.freeze(['src/moteur', 'src/application']);\n"), [
      'src/moteur',
      'src/application',
    ]);
    assert.deepEqual(perimetreDeclare("export const PERIMETRE = ['src/verger'];\n"), ['src/verger']);
    assert.equal(perimetreDeclare("const PERIMETRE = ['src/moteur'];\nexport const AUTRE = 1;\n"), null);
    assert.throws(() => perimetreDeclare("const d = 'src';\nexport const PERIMETRE = [`${d}/moteur`];\n"), /chaînes littérales/);
    assert.throws(() => perimetreDeclare('export const PERIMETRE = lister();\n'), /liste littérale/);
  });
});

describe('audit par mutation : ce qu’il mesure est ce qu’il écrit', () => {
  test('auditer valide l’en-tête avant la ligne de base, et reprend l’empreinte des sources avant d’écrire', () => {
    const appels = appelsDans(readFileSync(join(RACINE, AUDIT), 'utf8'), 'auditer');
    assert.ok(appels.includes('ligneDeBase') && appels.includes('writeFileSync'), appels.join(', '));
    assert.deepEqual(ecartsDeLOrdre(appels), []);
  });

  test('la lecture des appels suit le texte, fonctions imbriquées comprises ; la garde relève chaque écart', () => {
    const source = 'export async function auditer() { a(); await b(c()); const f = () => d(); }\nfunction autre() { e(); }\n';
    assert.deepEqual(appelsDans(source, 'auditer'), ['a', 'b', 'c', 'd']);
    assert.equal(appelsDans(source, 'absente'), null);
    assert.deepEqual(ecartsDeLOrdre(['ligneDeBase', 'executerMutant', 'empreinteDe', 'verifierEntete', 'writeFileSync']), [
      'en-tête validé après la ligne de base',
      'empreinte prise après la ligne de base',
      'empreinte non reprise entre le dernier mutant et l’écriture',
    ]);
    assert.deepEqual(
      ecartsDeLOrdre(['empreinteDe', 'verifierEntete', 'ligneDeBase', 'executerMutant', 'writeFileSync', 'empreinteDe']),
      ['empreinte non reprise entre le dernier mutant et l’écriture'],
    );
    assert.deepEqual(
      ecartsDeLOrdre(['empreinteDe', 'verifierEntete', 'ligneDeBase', 'executerMutant', 'empreinteDe', 'writeFileSync']),
      [],
    );
  });
});

describe('audit par mutation : hors des séries (§ 14.4, § 14.14)', () => {
  test('aucun module de src/, scripts/, test/ ni electron/ n’importe audit.js : aucune épreuve des séries node et node-long ne l’atteint', () => {
    const graphe = grapheDuProjet(RACINE, ['src', 'scripts', 'test', 'electron']);
    assert.ok(graphe.has(AUDIT), 'audit.js est dans le graphe');
    assert.ok(graphe.get('scripts/mutation/audit.test.js').includes('scripts/mutation/graphe.js'), 'le graphe lit les imports');
    assert.ok(graphe.size > 200, `${graphe.size} modules lus`);
    assert.deepEqual(importateursDe(AUDIT, graphe), []);
  });

  test('la garde relève un module qui l’importe, statiquement, par une ré-exportation ou par import()', () => {
    const textes = new Map([
      ['scripts/mutation/audit.js', "import { rediger } from './rapport.js';\n"],
      ['scripts/mutation/rapport.js', ''],
      ['scripts/mutation/rapport.test.js', "import { rediger } from './rapport.js';\n"],
      ['scripts/mutation/aide.js', "export { PERIMETRE } from './audit.js';\n"],
      ['src/verger/pommes.test.js', "import { PERIMETRE } from '../../scripts/mutation/aide.js';\n"],
      ['src/verger/poires.long.test.js', "const audit = await import('../../scripts/mutation/audit.js');\n"],
      ['src/verger/vue.navigateur.test.js', "import '../../scripts/mutation/audit.js';\n"],
    ]);
    const graphe = construireGraphe([...textes.keys()], (chemin) => textes.get(chemin));
    assert.deepEqual(importateursDe(AUDIT, graphe), [
      'scripts/mutation/aide.js',
      'src/verger/poires.long.test.js',
      'src/verger/vue.navigateur.test.js',
    ]);
  });
});

describe('audit par mutation : la couverture garde sa commande (§ 14.13)', () => {
  test('la mesure reste npm run couverture, lancée par make couverture seule ; l’audit n’en est pas une seconde', () => {
    const { scripts = {} } = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8'));
    const makefile = readFileSync(join(RACINE, 'Makefile'), 'utf8');
    assert.match(scripts.couverture, /--coverage\b/);
    assert.deepEqual(cibleDuMakefile(makefile, 'couverture')?.commandes, ['$(AVEC_NODE) npm run couverture']);
    assert.deepEqual(ecartsDeLaCouverture({ scripts, makefile }), []);
  });

  test('la garde relève une passe de couverture sortie d’audit.js, et un audit qui lance autre chose', () => {
    const scripts = {
      couverture: 'vitest run --project node --coverage',
      mutation: 'node --experimental-test-coverage scripts/mutation/audit.js',
      test: 'vitest run --project node --coverage',
    };
    const makefile = [
      '.PHONY: couverture mutation',
      'couverture: ## Mesure',
      '\t$(AVEC_NODE) npm run couverture',
      'mutation: ## Audit',
      '\t$(AVEC_NODE) npm run couverture',
      '\tnode --test --experimental-test-coverage src/moteur',
      '',
    ].join('\n');
    assert.deepEqual(ecartsDeLaCouverture({ scripts, makefile }), [
      'npm run mutation : mesure la couverture',
      'npm run test : mesure la couverture',
      'npm run mutation : ne lance pas audit.js seul',
      'make mutation : lance une mesure de couverture',
      'make mutation : lance une mesure de couverture',
    ]);
  });
});
