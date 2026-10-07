// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Gardes de l'arborescence, lues dans le texte des sources : le moteur, le
// générateur de démonstrations, le stockage et l'analyseur CSV n'appellent
// aucune source non reproductible (§ 14.7), et ne parcourent les clés d'un
// objet que par exception nommée (§ 15.5, point 4) ; le graphe d'imports de
// chaque couche ne rejoint que ce que le § 13.4 lui permet ; chaque paquet
// importé est déclaré dans devDependencies ; une valeur du contrat de données
// n'a qu'une définition, celle de configuration.js ; la mesure de la
// couverture joue la série node, publie chaque module et tient ses seuils
// durs sur des modules qui existent (§ 14.13). Chaque relevé lit le
// texte entier, commentaires et chaînes compris, hors celui des accès au
// navigateur, qui saute les chaînes littérales : un commentaire qui nomme un
// appel refusé fait échouer la garde comme l'appel lui-même. Chaque garde
// refuse de passer sur un balayage vide (§ 14.2), et d'autres épreuves la
// font tourner sur des arbres temporaires qui portent, à plus d'un niveau de
// profondeur, les formes qu'elle refuse et des formes voisines qu'elle admet.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, extname, join, matchesGlob, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import configuration from '../vitest.config.js';
import { chargements } from './chargements.js';
import { describe, test } from './lanceur.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));

// Écrit dans un répertoire temporaire l'arbre { chemin relatif: contenu }, le
// passe à examiner, puis l'efface ; rend ce que rend examiner.
function avecArbre(fichiers, examiner) {
  const racine = mkdtempSync(join(tmpdir(), 'arborescence-'));
  try {
    for (const [chemin, contenu] of Object.entries(fichiers)) {
      mkdirSync(dirname(join(racine, chemin)), { recursive: true });
      writeFileSync(join(racine, chemin), contenu);
    }
    return examiner(racine);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
}

// Fichiers d'un arbre, à toute profondeur, en chemins absolus. Un arbre
// absent n'en fournit aucun.
function fichiersDe(dossier) {
  try {
    return readdirSync(dossier, { withFileTypes: true, recursive: true })
      .filter((e) => e.isFile())
      .map((e) => join(e.parentPath, e.name));
  } catch (erreur) {
    if (erreur.code === 'ENOENT') return [];
    throw erreur;
  }
}

// Modules d'un arbre : ses fichiers JavaScript, épreuves exclues, triés.
const EXTENSIONS_MODULE = new Set(['.js', '.mjs', '.cjs']);
const EPREUVE = /\.test\.[cm]?js$/;
const modulesDe = (dossier) =>
  fichiersDe(dossier)
    .filter((fichier) => EXTENSIONS_MODULE.has(extname(fichier)) && !EPREUVE.test(fichier))
    .sort();

// Numéro, à partir de 1, de la ligne qui porte le caractère d'indice donné.
const ligneDe = (texte, indice) => texte.slice(0, indice).split('\n').length;

// Appels dont le résultat change d'une exécution à l'autre, ou d'un poste à
// l'autre : localeCompare, Intl et les méthodes toLocale… suivent la langue
// et les données régionales du moteur d'exécution (§ 14.7, § 15.5). Chaque
// motif à point admet des blancs autour de lui, que la mise en forme
// introduit quand elle coupe une chaîne d'appels, et le chaînage optionnel.
// Math, Date et performance suivis d'un crochet, accolé ou après « ?. »,
// sont refusés eux aussi, quel que soit le membre nommé. new Date se relève
// avec ou sans parenthèses, et Date appelée sans new, « Date() » comme
// « Date?.() », rend elle aussi l'heure courante. getRandomValues,
// randomUUID et les tirages de node:crypto — randomInt, randomBytes,
// randomFill — se reconnaissent au nom de la fonction, quel que soit l'objet
// qui la porte ou l'import qui la nomme.
const SOURCES_NON_REPRODUCTIBLES = [
  ['Math.random', /\bMath\s*\??\.\s*random\b/g],
  ['Math[', /\bMath\s*(?:\?\.)?\s*\[/g],
  ['Date.now', /\bDate\s*\??\.\s*now\b/g],
  ['Date[', /\bDate\s*(?:\?\.)?\s*\[/g],
  ['new Date', /\bnew\s+Date\b/g],
  ['Date()', /(?<!\bnew\s+)\bDate\s*(?:\?\.\s*)?\(/g],
  ['performance.now', /\bperformance\s*\??\.\s*now\b/g],
  ['performance[', /\bperformance\s*(?:\?\.)?\s*\[/g],
  ['crypto.getRandomValues', /\bgetRandomValues\b/g],
  ['crypto.randomUUID', /\brandomUUID\b/g],
  ['localeCompare', /\blocaleCompare\b/g],
  ['toLocale…', /\btoLocale\w*/g],
  ['Intl', /\bIntl\b/g],
  ['crypto.randomInt', /\brandomInt\b/g],
  ['crypto.randomBytes', /\brandomBytes\b/g],
  ['crypto.randomFill', /\brandomFill(?:Sync)?\b/g],
];

// Parcours des clés d'un objet (§ 15.5, point 4) : les clés entières y
// viennent d'abord, croissantes, puis les autres dans l'ordre où l'objet les
// a reçues. Un résultat qui en dépend change quand l'objet se construit
// autrement, sans qu'aucune épreuve ne le voie ; un départage se fait par
// identifiant entier. Les motifs à point suivent les règles de
// SOURCES_NON_REPRODUCTIBLES, et Object suivi d'un crochet est refusé quel
// que soit le membre nommé. for…in se relève sur une variable, un chemin
// pointé ou un motif de déstructuration suivi de « in », avec ou sans
// déclaration : la boucle à compteur, for…of et l'opérateur in hors d'une
// boucle n'en sont pas.
const PARCOURS_DE_CLES = [
  ['Object.keys', /\bObject\s*\??\.\s*keys\b/g],
  ['Object.entries', /\bObject\s*\??\.\s*entries\b/g],
  ['Object.values', /\bObject\s*\??\.\s*values\b/g],
  ['Object[', /\bObject\s*(?:\?\.)?\s*\[(?!\s*\])/g],
  ['for…in', /\bfor\s*\(\s*(?:(?:const|let|var)\s+)?(?:[\p{L}_$][\p{L}\p{N}_$.]*|\[[^\]]*\]|\{[^}]*\})\s+in\b/gu],
  ['Reflect.ownKeys', /\bReflect\s*\??\.\s*ownKeys\b/g],
  ['Object.getOwnPropertyNames', /\bObject\s*\??\.\s*getOwnPropertyNames\b/g],
];

// Parcours de clés admis, chacun nommé par son fichier, relatif à la racine,
// et par un motif : l'expression régulière de la forme admise, qui se lit à
// partir du parcours relevé, sur une ligne ou sur plusieurs — non un numéro
// de ligne, qu'un ajout au-dessus déplace. Sa raison dit pourquoi l'ordre n'y
// décide d'aucun résultat. Une exception admet dans son fichier chaque
// parcours de sa forme, et rien d'autre : le parcours écrit autrement, ou un
// second parcours sur la même ligne, se relève. Elle ne couvre aucune source
// de SOURCES_NON_REPRODUCTIBLES, que rien n'admet.
const PARCOURS_DE_CLES_ADMIS = [
  {
    fichier: join('src', 'stockage', 'document.js'),
    motif: /Object\s*\.\s*keys\s*\(\s*\w+\s*\)\s*\.\s*sort\s*\(\s*comparerTextes\s*\)/,
    raison:
      'clesRangees, que lisent le relevé des clés inconnues et la recopie de canonique.js : ' +
      "les clés propres d'un objet, rangées sur-le-champ par comparerTextes, un ordre total des chaînes ; " +
      'le résultat ne dépend que de leur ensemble',
  },
];

// Arbres dont les modules ne lisent aucune source non reproductible (§ 14.7) :
// le moteur et le générateur de démonstrations, puis le stockage et
// l'analyseur CSV, qui reçoivent l'horloge et l'aléa de l'application, en
// paramètre.
const ARBRES_DETERMINISTES = ['src/moteur', 'src/demo', 'src/stockage', 'src/csv'];

// Vrai quand le motif se lit dans le texte à partir de l'indice donné, et non
// plus loin : une copie collante du motif, ses drapeaux g et y retirés.
function seLitA(motif, texte, indice) {
  const collant = new RegExp(motif.source, `${motif.flags.replace(/[gy]/g, '')}y`);
  collant.lastIndex = indice;
  return collant.test(texte);
}

// Relevé « fichier:ligne appel » des sources non reproductibles et des
// parcours de clés non admis dans les modules de ARBRES_DETERMINISTES, arbre
// par arbre, puis par fichier et par ligne, et sur une même ligne dans
// l'ordre de SOURCES_NON_REPRODUCTIBLES puis de PARCOURS_DE_CLES. Les
// épreuves en sont exclues : un tirage y sert légitimement (§ 14.12). Suit une
// ligne « exception sans objet : fichier /motif/ » par exception qui n'admet
// rien, dans l'ordre de la liste. Lève quand l'un des arbres ne fournit aucun
// module.
function releverDeterminisme(racine, admis = PARCOURS_DE_CLES_ADMIS) {
  const servies = new Set();
  // Vrai quand une exception du fichier admet le parcours relevé à l'indice
  // donné : son motif s'y lit.
  const estAdmis = (fichier, texte, indice) => {
    const exception = admis.find((e) => e.fichier === fichier && seLitA(e.motif, texte, indice));
    if (exception !== undefined) servies.add(exception);
    return exception !== undefined;
  };
  const releve = ARBRES_DETERMINISTES.flatMap((arbre) => {
    const modules = modulesDe(join(racine, arbre));
    assert.ok(modules.length > 0, `${arbre} ne fournit aucun module`);
    return modules.flatMap((fichier) => {
      const nom = relative(racine, fichier);
      const texte = readFileSync(fichier, 'utf8');
      const trouves = (motifs) =>
        motifs.flatMap(([appel, motif]) => [...texte.matchAll(motif)].map(({ index }) => ({ index, appel })));
      return [
        ...trouves(SOURCES_NON_REPRODUCTIBLES),
        ...trouves(PARCOURS_DE_CLES).filter(({ index }) => !estAdmis(nom, texte, index)),
      ]
        .map(({ index, appel }) => ({ ligne: ligneDe(texte, index), appel }))
        .sort((a, b) => a.ligne - b.ligne)
        .map(({ ligne, appel }) => `${nom}:${ligne} ${appel}`);
    });
  });
  const sansObjet = admis
    .filter((exception) => !servies.has(exception))
    .map(({ fichier, motif }) => `exception sans objet : ${fichier} ${motif}`);
  return [...releve, ...sansObjet];
}

// Un module vide dans chaque arbre que les gardes exigent : une donnée
// d'épreuve y ajoute ce qu'elle éprouve, ou en retire un arbre (sansArbre)
// pour éprouver le refus d'un balayage vide.
const MODULES_VIDES = Object.freeze({
  'src/moteur/a.js': '',
  'src/demo/a.js': '',
  'src/stockage/a.js': '',
  'src/csv/a.js': '',
});

// Les fichiers donnés, sans ceux de l'arbre nommé.
const sansArbre = (fichiers, arbre) =>
  Object.fromEntries(Object.entries(fichiers).filter(([chemin]) => !chemin.startsWith(`${arbre}/`)));

// Le relevé du déterminisme sans exception : une donnée d'épreuve ne porte pas
// les fichiers que nomment les exceptions de l'arbre réel.
const releverSansException = (racine) => releverDeterminisme(racine, []);

describe('arborescence : déterminisme (§ 14.7)', () => {
  test("ni src/moteur, ni src/demo, ni src/stockage, ni src/csv ne lisent une source non reproductible, ni ne parcourent les clés d'un objet hors des exceptions nommées", () => {
    assert.deepEqual(releverDeterminisme(RACINE), []);
  });

  test('les tirages de node:crypto se relèvent comme ceux du navigateur', () => {
    const fichiers = {
      ...MODULES_VIDES,
      'src/moteur/a.js': 'export const a = 1;\n',
      'src/demo/tirage.js': [
        "import { randomInt, randomBytes, randomFillSync } from 'node:crypto';",
        'export const a = randomInt(6);',
        'export const b = randomBytes(4);',
        'export const c = randomFillSync(new Uint8Array(4));',
      ].join('\n'),
    };
    assert.deepEqual(avecArbre(fichiers, releverSansException), [
      'src/demo/tirage.js:1 crypto.randomInt',
      'src/demo/tirage.js:1 crypto.randomBytes',
      'src/demo/tirage.js:1 crypto.randomFill',
      'src/demo/tirage.js:2 crypto.randomInt',
      'src/demo/tirage.js:3 crypto.randomBytes',
      'src/demo/tirage.js:4 crypto.randomFill',
    ]);
  });

  test('la garde relève chaque appel par sa ligne, à toute profondeur, hors épreuves, et refuse un arbre sans module', () => {
    const fichiers = {
      ...MODULES_VIDES,
      'src/moteur/tirage.js': [
        'export const a = Math.random();',
        'export const b = Date.now() - performance.now();',
        'export const c = new Date(0);',
        'export const d = globalThis.crypto.getRandomValues(new Uint32Array(1));',
        "export const e = ['b', 'a'].sort((x, y) => x.localeCompare(y));",
        'export const f = Math',
        '  .random;',
        'export const i = Date',
        '  .now() + performance .now();',
        'export const j = globalThis.crypto',
        '  .getRandomValues(t);',
        'export const k = new Date;',
        'export const p = Date();',
        'export const q = crypto.randomUUID();',
        "export const r = Math['random']();",
        "export const s = new Intl.Collator('fr').compare;",
        "export const u = 'É'.toLocaleLowerCase();",
        'export const v = webcrypto.getRandomValues(t);',
        'const { Collator } = Intl;',
        'export const x = source.randomUUID();',
        'export const y = (1234.5).toLocaleString();',
        'export const t1 = globalThis.performance?.now?.() ?? 0;',
        'export const t2 = Date?.now() + Math?.random();',
        "export const t3 = performance['now']();",
        "export const t4 = Date['now']() + Math?.['random']();",
        "export const t5 = Date?.['now']() - performance?.['now']();",
        'export const t6 = Date?.();',
      ].join('\n'),
      'src/moteur/tirage.test.js': 'export const g = Math.random();\n',
      'src/moteur/sous/profond.js': 'export const l = Math.random();\n',
      'src/demo/propre.js': [
        'export const h = Math.floor(2.5) + Date.UTC(2000, 0, 1);',
        'export const mathRandom = 1;',
        'export const debutDate = { now: 2 };',
        'export const m = debutDate.now + xMath.random;',
        "export const w = 'É'.toLowerCase();",
      ].join('\n'),
      'src/demo/tirage.mjs': 'export const n = Math.random();\n',
      'src/demo/tirage.cjs': 'module.exports = Date.now();\n',
      'src/demo/tirage.test.mjs': 'export const o = Math.random();\n',
      'src/demo/tirage.test.cjs': 'module.exports = Math.random();\n',
    };
    assert.deepEqual(avecArbre(fichiers, releverSansException), [
      'src/moteur/sous/profond.js:1 Math.random',
      'src/moteur/tirage.js:1 Math.random',
      'src/moteur/tirage.js:2 Date.now',
      'src/moteur/tirage.js:2 performance.now',
      'src/moteur/tirage.js:3 new Date',
      'src/moteur/tirage.js:4 crypto.getRandomValues',
      'src/moteur/tirage.js:5 localeCompare',
      'src/moteur/tirage.js:6 Math.random',
      'src/moteur/tirage.js:8 Date.now',
      'src/moteur/tirage.js:9 performance.now',
      'src/moteur/tirage.js:11 crypto.getRandomValues',
      'src/moteur/tirage.js:12 new Date',
      'src/moteur/tirage.js:13 Date()',
      'src/moteur/tirage.js:14 crypto.randomUUID',
      'src/moteur/tirage.js:15 Math[',
      'src/moteur/tirage.js:16 Intl',
      'src/moteur/tirage.js:17 toLocale…',
      'src/moteur/tirage.js:18 crypto.getRandomValues',
      'src/moteur/tirage.js:19 Intl',
      'src/moteur/tirage.js:20 crypto.randomUUID',
      'src/moteur/tirage.js:21 toLocale…',
      'src/moteur/tirage.js:22 performance.now',
      'src/moteur/tirage.js:23 Math.random',
      'src/moteur/tirage.js:23 Date.now',
      'src/moteur/tirage.js:24 performance[',
      'src/moteur/tirage.js:25 Math[',
      'src/moteur/tirage.js:25 Date[',
      'src/moteur/tirage.js:26 Date[',
      'src/moteur/tirage.js:26 performance[',
      'src/moteur/tirage.js:27 Date()',
      'src/demo/tirage.cjs:1 Date.now',
      'src/demo/tirage.mjs:1 Math.random',
    ]);
    for (const arbre of ['src/moteur', 'src/demo', 'src/stockage', 'src/csv']) {
      const sansModule = { ...sansArbre(MODULES_VIDES, arbre), [`${arbre}/a.test.js`]: '' };
      assert.throws(
        () => avecArbre(sansModule, releverSansException),
        new RegExp(`${arbre} ne fournit aucun module`),
        arbre,
      );
    }
  });

  test('src/stockage et src/csv se relèvent comme le moteur et le générateur, à toute profondeur, hors épreuves', () => {
    const fichiers = {
      ...MODULES_VIDES,
      'src/stockage/horloge.js': [
        'export const a = Date.now();',
        'export const b = (o) => Object.keys(o).map((cle) => o[cle]);',
        'export const c = new Date();',
      ].join('\n'),
      'src/stockage/sous/tri.js': 'export const d = (t) => t.sort((x, y) => x.localeCompare(y));\n',
      'src/stockage/horloge.test.js': 'export const e = Date.now();\n',
      'src/csv/tirage.js': [
        'export const f = crypto.randomUUID();',
        'for (const champ in ligne) t.push(champ);',
      ].join('\n'),
      'src/csv/sous/profond.js': 'export const g = performance.now();\n',
      'src/csv/tirage.test.js': 'export const h = Math.random();\n',
    };
    assert.deepEqual(avecArbre(fichiers, releverSansException), [
      'src/stockage/horloge.js:1 Date.now',
      'src/stockage/horloge.js:2 Object.keys',
      'src/stockage/horloge.js:3 new Date',
      'src/stockage/sous/tri.js:1 localeCompare',
      'src/csv/sous/profond.js:1 performance.now',
      'src/csv/tirage.js:1 crypto.randomUUID',
      'src/csv/tirage.js:2 for…in',
    ]);
  });

  test("les parcours des clés d'un objet se relèvent par leur ligne, hors épreuves, et pas leurs voisins (§ 15.5, point 4)", () => {
    const fichiers = {
      ...MODULES_VIDES,
      'src/moteur/cles.js': [
        'export const a = Object.keys(o);',
        'export const b = Object.entries(o).map(f);',
        'export const c = Object.values(o);',
        'for (const k in o) t.push(k);',
        'for (k in o) t.push(k);',
        'export const d = Object',
        '  .keys(o);',
        'export const e = Object?.entries?.(o);',
        "export const g = Object['keys'](o);",
        'for(let k in o){}',
        'for (const [k] in o) t.push(k);',
        'for (var { length } in o) t.push(length);',
        'export const h = Reflect.ownKeys(o);',
        'export const i = Object.getOwnPropertyNames(o);',
        'for (const k of Object.keys(o)) t.push(k);',
        'for (a.b in o) t.push(a.b);',
      ].join('\n'),
      'src/moteur/cles.test.js': 'export const x = Object.keys(o);\n',
      'src/demo/voisins.js': [
        'for (let i = 0; i < n; i += 1) t.push(i);',
        'for (const v of Object.freeze([])) t.push(v);',
        "export const f = 'k' in o;",
        'for (const [k, v] of m) t.push(k, v);',
        'export const z = monObject.keys + objectKeys;',
        'export const w = Object.fromEntries(paires);',
        'for (const index of inventaire) t.push(index);',
        '/** @param {Object[]} entrees  les entrées, dans leur ordre */',
      ].join('\n'),
    };
    assert.deepEqual(avecArbre(fichiers, releverSansException), [
      'src/moteur/cles.js:1 Object.keys',
      'src/moteur/cles.js:2 Object.entries',
      'src/moteur/cles.js:3 Object.values',
      'src/moteur/cles.js:4 for…in',
      'src/moteur/cles.js:5 for…in',
      'src/moteur/cles.js:6 Object.keys',
      'src/moteur/cles.js:8 Object.entries',
      'src/moteur/cles.js:9 Object[',
      'src/moteur/cles.js:10 for…in',
      'src/moteur/cles.js:11 for…in',
      'src/moteur/cles.js:12 for…in',
      'src/moteur/cles.js:13 Reflect.ownKeys',
      'src/moteur/cles.js:14 Object.getOwnPropertyNames',
      'src/moteur/cles.js:15 Object.keys',
      'src/moteur/cles.js:16 for…in',
    ]);
  });

  test("une exception nommée par motif n'admet, dans son fichier, que les parcours de sa forme, sur une ligne ou plusieurs ; une exception sans objet se relève", () => {
    const somme = 'Object.values(o).reduce((s, v) => s + v, 0)';
    const fichiers = {
      ...MODULES_VIDES,
      'src/moteur/a.js': 'export const a = Math.random();\n',
      'src/demo/somme.js': [
        `export const total = (o) => ${somme};`,
        'export const nombre = (o) => Object.keys(o).length;',
        `export const double = (o) => 2 * ${somme} + Object.values(o).length;`,
        'export const reste = (o) =>',
        '  Object',
        '    .values(o).reduce((s, v) => s + v, 0);',
      ].join('\n'),
      'src/demo/autre.js': `export const total = (o) => ${somme};\n`,
    };
    const exceptions = [
      {
        fichier: 'src/demo/somme.js',
        motif: /Object\s*\.\s*values\(o\)\.reduce\(\(s, v\) => s \+ v, 0\)/,
        raison: "une somme d'entiers ne dépend pas de l'ordre de ses termes",
      },
      { fichier: 'src/moteur/a.js', motif: /Math\.random\(\)/, raison: 'un tirage ne se nomme pas en exception' },
      { fichier: 'src/demo/disparu.js', motif: /for \(const k in o\)/, raison: 'le fichier a disparu' },
    ];
    assert.deepEqual(avecArbre(fichiers, (racine) => releverDeterminisme(racine, exceptions)), [
      'src/moteur/a.js:1 Math.random',
      'src/demo/autre.js:1 Object.values',
      'src/demo/somme.js:2 Object.keys',
      'src/demo/somme.js:3 Object.values',
      `exception sans objet : src/moteur/a.js ${exceptions[1].motif}`,
      `exception sans objet : src/demo/disparu.js ${exceptions[2].motif}`,
    ]);
  });
});

// Chargements d'un texte qui désignent un spécificateur, dans l'ordre du
// texte, chacun { indice, specificateur } : ceux que relève l'analyseur
// commun (test/chargements.js), moins les arguments calculés, qui ne
// désignent aucun module.
const chargementsLitteraux = (texte) =>
  chargements(texte).filter(({ specificateur }) => specificateur !== undefined);

// « ./ » ou « ../ » en tête, ou « . » et « .. » seuls.
const RELATIF = /^\.{1,2}(?:\/|$)/;

// Nom du paquet que désigne un spécificateur nu : son premier segment, ou
// ses deux premiers pour un paquet à portée (@portée/nom).
const nomDePaquet = (specificateur) =>
  specificateur.split('/').slice(0, specificateur.startsWith('@') ? 2 : 1).join('/');

// Les paquets de l'interface et des plateformes, sous-chemins compris, dont
// le motif s'applique au nom de paquet.
const PAQUETS_DE_PLATEFORME = /^(?:svelte|electron|@capacitor\/.+)$/;

// La frontière de chaque couche (§ 13.4), dans l'ordre du relevé. arbres :
// ceux de ses modules, dont requis nomme ceux qui doivent en fournir au moins
// un — une couche encore à écrire peut manquer. exterieures : les couches de
// src/ qu'elle n'importe pas. paquets : ceux qu'elle refuse, outre les
// modules natifs de Node, que la page n'a pas et qu'aucune couche ne charge.
// navigateur : null quand la couche y accède librement ; sinon, les fichiers
// admis à y accéder, chacun dans son seul texte. Aucun module du parcours
// n'importe un fichier admis : il ne passe qu'en paramètre, de la main de
// l'application.
//
// Le moteur et la géométrie ne connaissent ni l'écran, ni les fichiers, ni ce
// qui les commande. Le stockage lit et écrit par le système de fichiers qu'il
// reçoit ; seules ses deux implémentations de plateforme touchent le
// navigateur, par l'OPFS sous web et par le pont window.gtt sous Electron.
// L'analyseur CSV lit le modèle du stockage. L'application câble le moteur,
// le stockage, le CSV et les systèmes de fichiers des plateformes, sous
// l'interface.
const COUCHES = [
  {
    arbres: ['src/moteur', 'src/geometrie'],
    requis: ['src/moteur'],
    exterieures: ['interface', 'application', 'stockage'],
    paquets: PAQUETS_DE_PLATEFORME,
    navigateur: [],
  },
  {
    arbres: ['src/stockage'],
    requis: ['src/stockage'],
    exterieures: ['interface', 'application', 'csv'],
    paquets: PAQUETS_DE_PLATEFORME,
    navigateur: ['src/stockage/fichiers_web.js', 'src/stockage/fichiers_electron.js'],
  },
  {
    arbres: ['src/csv'],
    requis: ['src/csv'],
    exterieures: ['interface', 'application'],
    paquets: PAQUETS_DE_PLATEFORME,
    navigateur: [],
  },
  {
    arbres: ['src/application'],
    requis: [],
    exterieures: ['interface'],
    paquets: /^svelte$/,
    navigateur: null,
  },
];

// Un accès au navigateur est un nom de document, de window, de navigator, de
// location, de localStorage ou de sessionStorage suivi d'un crochet, ou
// d'un point puis d'un nom de propriété, accolé ou en tête de la ligne
// suivante. Une phrase qui continue après « document. » sur la même ligne
// n'en est pas un, ni une ligne qui finit sur ce mot quand la suivante
// s'ouvre sur autre chose qu'un nom, un commentaire par exemple. Le relevé
// lit le texte que rend sansChaines : le spécificateur « './document.js' »
// nomme un fichier, et une chaîne n'accède à rien. Il ne distingue pas le
// commentaire du code : une ligne de commentaire qui finit sur « document. »
// juste avant une ligne de code se lit comme un accès.
const ACCES_AU_DOM = /\b(document|window|navigator|location|localStorage|sessionStorage)\s*(?:\??\.(?=[\p{L}_$]|[ \t]*\r?\n\s*[\p{L}_$])|(?:\?\.)?\s*\[)/gu;

// Mots après lesquels une barre oblique ouvre une expression régulière
// littérale, comme après un opérateur, et non une division.
const MOTS_AVANT_EXPRESSION = new Set([
  'await', 'case', 'delete', 'do', 'else', 'in', 'instanceof', 'new', 'of', 'return', 'throw', 'typeof', 'void', 'yield',
]);
const LETTRE_DE_MOT = /[\p{L}\p{N}_$]/u;
const BLANC = /\s/;

// Le texte où chaque caractère d'une chaîne littérale — entre apostrophes,
// entre guillemets, ou partie littérale d'un gabarit entre accents graves —
// devient une espace, délimiteurs et fins de ligne gardés : les indices et
// les numéros de ligne restent ceux du texte. Les commentaires restent tels
// quels, et une apostrophe qui y figure n'ouvre aucune chaîne ; le code
// d'une substitution ${…} reste lu, chaînes blanchies. Une barre oblique
// ouvre une expression régulière littérale après rien, après un opérateur ou
// une ponctuation autre que « ) » et « ] », ou après un mot comme return ;
// l'expression reste telle quelle, et un guillemet de sa classe n'ouvre pas
// de chaîne. Une chaîne entre apostrophes ou guillemets, comme une
// expression, s'arrête au plus tard à la fin de sa ligne : une barre mal lue
// n'y fait blanchir que la fin de cette ligne. Un accent grave mal lu, lui,
// ouvrirait un gabarit jusqu'au suivant.
function sansChaines(texte) {
  let sortie = '';
  let i = 0;
  const recopier = (fin) => {
    sortie += texte.slice(i, fin);
    i = fin;
  };
  const blanchir = (fin) => {
    for (; i < fin; i += 1) sortie += texte[i] === '\n' ? '\n' : ' ';
  };
  // Une chaîne : jusqu'à son délimiteur non échappé, ou jusqu'à la fin de la
  // ligne, qu'une barre oblique inverse finale prolonge.
  const chaine = () => {
    const delimiteur = texte[i];
    recopier(i + 1);
    let fin = i;
    while (fin < texte.length && texte[fin] !== delimiteur && texte[fin] !== '\n') {
      fin += texte[fin] === '\\' ? 2 : 1;
    }
    blanchir(Math.min(fin, texte.length));
    if (texte[i] === delimiteur) recopier(i + 1);
  };
  // Une expression régulière : jusqu'à la barre oblique non échappée hors
  // d'une classe, ou jusqu'à la fin de la ligne, puis ses drapeaux.
  const expression = () => {
    let fin = i + 1;
    let classe = false;
    while (fin < texte.length && texte[fin] !== '\n' && (classe || texte[fin] !== '/')) {
      if (texte[fin] === '\\') fin += 1;
      else if (texte[fin] === '[') classe = true;
      else if (texte[fin] === ']') classe = false;
      fin += 1;
    }
    if (texte[fin] === '/') fin += 1;
    while (fin < texte.length && LETTRE_DE_MOT.test(texte[fin])) fin += 1;
    recopier(Math.min(fin, texte.length));
  };
  // Du code, jusqu'à la fin du texte, ou, dans une substitution, jusqu'à
  // l'accolade qui la ferme, laissée à l'appelant.
  const code = (substitution) => {
    let profondeur = 0;
    let expressionPermise = true;
    while (i < texte.length) {
      const c = texte[i];
      if (c === '/' && texte[i + 1] === '/') {
        const fin = texte.indexOf('\n', i);
        recopier(fin === -1 ? texte.length : fin);
      } else if (c === '/' && texte[i + 1] === '*') {
        const fin = texte.indexOf('*/', i + 2);
        recopier(fin === -1 ? texte.length : fin + 2);
      } else if (c === "'" || c === '"') {
        chaine();
        expressionPermise = false;
      } else if (c === '`') {
        gabarit();
        expressionPermise = false;
      } else if (c === '/' && expressionPermise) {
        expression();
        expressionPermise = false;
      } else if (LETTRE_DE_MOT.test(c)) {
        let fin = i + 1;
        while (fin < texte.length && LETTRE_DE_MOT.test(texte[fin])) fin += 1;
        expressionPermise = MOTS_AVANT_EXPRESSION.has(texte.slice(i, fin));
        recopier(fin);
      } else {
        if (substitution && c === '}' && profondeur === 0) return;
        if (c === '{') profondeur += 1;
        if (c === '}') profondeur -= 1;
        if (!BLANC.test(c)) expressionPermise = c !== ')' && c !== ']';
        recopier(i + 1);
      }
    }
  };
  // Un gabarit : ses parties littérales blanchies, chaque substitution lue
  // comme du code.
  const gabarit = () => {
    recopier(i + 1);
    while (i < texte.length && texte[i] !== '`') {
      if (texte[i] === '\\') {
        blanchir(Math.min(i + 2, texte.length));
      } else if (texte[i] === '$' && texte[i + 1] === '{') {
        recopier(i + 2);
        code(true);
        if (i < texte.length) recopier(i + 1);
      } else {
        blanchir(i + 1);
      }
    }
    if (i < texte.length) recopier(i + 1);
  };
  code(false);
  return sortie;
}

// Chemin que désigne un spécificateur relatif, ou absolu depuis la racine
// comme Vite le résout ; null pour un spécificateur nu ou une URL.
function cibleDe(racine, fichier, specificateur) {
  if (RELATIF.test(specificateur)) return resolve(dirname(fichier), specificateur);
  if (specificateur.startsWith('/')) return join(racine, specificateur);
  return null;
}

// Relevé des refus de la frontière d'une couche dans son graphe d'imports.
// Le parcours part des modules de ses arbres, à toute profondeur, épreuves
// exclues. Il suit chaque chemin relatif, ou absolu depuis la racine, vers un
// module JavaScript existant, chaque module une fois. Un type que la JSDoc
// importe par import(…) compte comme un import. Un fichier d'une couche
// extérieure n'est pas parcouru : l'importer est déjà un refus, comme
// importer un fichier admis au navigateur. Un chemin sans extension en est un
// aussi : Node ne le résout pas (§ 14.8), et le parcours ne suit pas le
// module que Vite y trouverait. Un module natif de Node, que reconnaît
// isBuiltin, est refusé : la page où la couche s'exécute n'en a aucun. Un
// accès au navigateur n'est admis que dans le texte d'un fichier admis, parti
// de lui-même. Chaque refus se lit « accès:ligne refus », où l'accès est la
// suite des modules qui mène d'un module de départ à celui qui refuse. Lève
// quand un arbre requis ne fournit aucun module.
function releverCouche(racine, { arbres, requis, exterieures, paquets, navigateur }) {
  for (const arbre of requis) {
    assert.ok(modulesDe(join(racine, arbre)).length > 0, `${arbre} ne fournit aucun module`);
  }
  const couches = exterieures.map((couche) => join(racine, 'src', couche));
  const exterieur = (chemin) => couches.some((c) => chemin === c || chemin.startsWith(c + sep));
  const admis = new Set((navigateur ?? []).map((fichier) => join(racine, fichier)));
  const aParcourir = arbres.flatMap((arbre) => modulesDe(join(racine, arbre)));
  const acces = new Map(aParcourir.map((fichier) => [fichier, relative(racine, fichier)]));
  const refus = [];
  for (let i = 0; i < aParcourir.length; i += 1) {
    const fichier = aParcourir[i];
    const texte = readFileSync(fichier, 'utf8');
    const trouves =
      navigateur === null || admis.has(fichier)
        ? []
        : [...sansChaines(texte).matchAll(ACCES_AU_DOM)].map(({ 0: lu, 1: nom, index }) => ({
            indice: index,
            motif: nom + lu.at(-1),
          }));
    for (const { specificateur, indice } of chargementsLitteraux(texte)) {
      const cible = cibleDe(racine, fichier, specificateur);
      if (cible === null) {
        if (isBuiltin(specificateur) || paquets.test(nomDePaquet(specificateur))) {
          trouves.push({ indice, motif: `import ${specificateur}` });
        }
      } else if (exterieur(cible) || admis.has(cible)) {
        trouves.push({ indice, motif: `import ${specificateur}` });
      } else if (extname(cible) === '') {
        trouves.push({ indice, motif: `import ${specificateur} sans extension` });
      } else if (!acces.has(cible) && EXTENSIONS_MODULE.has(extname(cible)) && existsSync(cible)) {
        acces.set(cible, `${acces.get(fichier)} → ${relative(racine, cible)}`);
        aParcourir.push(cible);
      }
    }
    trouves.sort((a, b) => a.indice - b.indice);
    for (const { indice, motif } of trouves) {
      refus.push(`${acces.get(fichier)}:${ligneDe(texte, indice)} ${motif}`);
    }
  }
  return refus;
}

// Relevé des refus de la frontière de chaque couche, dans l'ordre de COUCHES.
const releverFrontiere = (racine) => COUCHES.flatMap((couche) => releverCouche(racine, couche));

describe('arborescence : frontière des couches (§ 13.4)', () => {
  test('les globales du navigateur hors du DOM se refusent comme lui : navigator, location, localStorage, sessionStorage', () => {
    const fichiers = {
      ...MODULES_VIDES,
      'src/moteur/a.js': [
        'export const langue = navigator.language;',
        'export const adresse = location.href;',
        "export const memoire = localStorage.getItem('x');",
        "export const seance = sessionStorage['x'];",
      ].join('\n'),
    };
    assert.deepEqual(avecArbre(fichiers, releverFrontiere), [
      'src/moteur/a.js:1 navigator.',
      'src/moteur/a.js:2 location.',
      'src/moteur/a.js:3 localStorage.',
      'src/moteur/a.js:4 sessionStorage[',
    ]);
  });

  test("le graphe d'imports de chaque couche ne rejoint que ce que le § 13.4 lui permet", () => {
    assert.deepEqual(releverFrontiere(RACINE), []);
  });

  test('la garde suit les imports depuis chaque module à toute profondeur, relève chaque refus par sa ligne, hors épreuves', () => {
    const fichiers = {
      ...MODULES_VIDES,
      'src/moteur/a.js': [
        "import { mount } from 'svelte';",
        "import { Capacitor } from '@capacitor/core';",
        "import { app } from 'electron';",
        "import App from '../interface/App.svelte';",
        "import { lire } from '../stockage/fichiers.js';",
        "import { aide } from '../commun/aide.js';",
        "import { ErreurConfiguration } from './erreurs.js';",
        'export const largeur = document.body.clientWidth;',
        "import { writable } from 'svelte/store';",
        "import { ipcRenderer } from 'electron/renderer';",
        "import { voisin } from '../interface-x/voisin.js';",
        'export const adresse = window.URL;',
        "import { x } from '/src/interface/x.js';",
        "import { f } from '../commun/fenetre';",
        "import { readFileSync } from 'node:fs';",
        "export const hauteur = window['innerHeight'];",
        'export const corps = () => document.',
        '  body;',
        "import 'svelte';",
        'import { y } from "electron";',
        "import { z } from '@capacitor/cli';",
        'const c = require("svelte");',
        "export const echelle = window?.['devicePixelRatio'];",
        "import fs from 'fs';",
        "import { seance } from '../application/seance.js';",
        "/** @param {import('../application/seance.js').Seance} s */",
      ].join('\n'),
      'src/moteur/b.js': [
        'import {',
        "  // l'écran d'accueil",
        '  App,',
        "} from '../interface/App.svelte';",
      ].join('\n'),
      'src/moteur/erreurs.js': [
        '// Une phrase finit sur le mot document. La suivante commence ici.',
        "import { rien } from './absent.js';",
        'export const fenetres = { windows: 1, documentation: 2 };',
        '// Cette ligne finit sur le mot document.',
        '// La suivante est un commentaire.',
      ].join('\n'),
      'src/moteur/sous/c.js': [
        "import { x } from '../../interface/x.js';",
        "import { y } from '../interface/y.js';",
      ].join('\n'),
      'src/moteur/interface/y.js': 'export const y = 1;\n',
      'src/moteur/a.test.js': "import { mount } from 'svelte';\nexport const corps = document.body;\n",
      'src/stockage/fichiers.js': "import { Filesystem } from '@capacitor/core';\n",
      'src/commun/aide.js': [
        "import { largeur } from '../moteur/a.js';",
        'export const aide = () => window',
        '  .innerWidth;',
      ].join('\n'),
      'src/commun/fenetre.js': 'export const f = () => window.innerHeight;\n',
      'src/commun/racine.js': 'export const r = () => window.top;\n',
      'src/geometrie/echelle.js': [
        'export const zoom = () => window?.devicePixelRatio;',
        "import { r } from '/src/commun/racine.js';",
        "import { commande } from '../application/commandes.js';",
        "/** @returns {import('../application/seance.js').Seance} */",
      ].join('\n'),
    };
    assert.deepEqual(avecArbre(fichiers, releverFrontiere), [
      'src/moteur/a.js:1 import svelte',
      'src/moteur/a.js:2 import @capacitor/core',
      'src/moteur/a.js:3 import electron',
      'src/moteur/a.js:4 import ../interface/App.svelte',
      'src/moteur/a.js:5 import ../stockage/fichiers.js',
      'src/moteur/a.js:8 document.',
      'src/moteur/a.js:9 import svelte/store',
      'src/moteur/a.js:10 import electron/renderer',
      'src/moteur/a.js:12 window.',
      'src/moteur/a.js:13 import /src/interface/x.js',
      'src/moteur/a.js:14 import ../commun/fenetre sans extension',
      'src/moteur/a.js:15 import node:fs',
      'src/moteur/a.js:16 window[',
      'src/moteur/a.js:17 document.',
      'src/moteur/a.js:19 import svelte',
      'src/moteur/a.js:20 import electron',
      'src/moteur/a.js:21 import @capacitor/cli',
      'src/moteur/a.js:22 import svelte',
      'src/moteur/a.js:23 window[',
      'src/moteur/a.js:24 import fs',
      'src/moteur/a.js:25 import ../application/seance.js',
      'src/moteur/a.js:26 import ../application/seance.js',
      'src/moteur/b.js:4 import ../interface/App.svelte',
      'src/moteur/sous/c.js:1 import ../../interface/x.js',
      'src/geometrie/echelle.js:1 window.',
      'src/geometrie/echelle.js:3 import ../application/commandes.js',
      'src/geometrie/echelle.js:4 import ../application/seance.js',
      'src/moteur/a.js → src/commun/aide.js:2 window.',
      'src/geometrie/echelle.js → src/commun/racine.js:1 window.',
      'src/stockage/fichiers.js:1 import @capacitor/core',
    ]);
  });

  test("la garde du navigateur ne lit pas les chaînes littérales : « ./document.js » nomme un fichier ; elle lit le code d'une substitution et les commentaires, suit l'échappement, et distingue la division de l'expression régulière", () => {
    const fichiers = {
      ...MODULES_VIDES,
      'src/moteur/a.js': [
        "import { SCHEMA } from './document.js';",
        'export const a = \'window.name\' + "navigator.language";',
        'export const b = `document.title`;',
        'export const c = `${document.title}`;',
        "export const d = 'l\\'objet'; export const e = window.name;",
        'export const f = x.replace(/["\'`]/g, \'\'); export const g = window.top;',
        "// l'accès à document.body se relève, même en commentaire",
        'export const h = y / 2; export const i = location.href / 3;',
        "export const j = `a${'location.href'}b` + localStorage.x;",
        'export const k = /\'/.test(s) ? sessionStorage.x : "";',
        'export const l = navigator',
        '  .language;',
        // Après « ) », « ] » ou un nom, la barre oblique divise, et la chaîne
        // qui la suit se blanchit ; après un mot-clé, elle ouvre une
        // expression, où l'apostrophe n'ouvre rien.
        "export const milieu = (a + b) / 2; export const cle = 'document.title';",
        "export const moitie = largeur / 2 + 'window.name'.length;",
        "export const quart = cotes[0] / 4 + 'location.href'.length;",
        "export const langue = (s) => { return /'/.test(s) ? navigator.language : ''; };",
        // Un accent grave échappé ne ferme pas le gabarit ; l'accolade qui
        // referme un objet dans une substitution ne ferme pas la substitution.
        'export const m = `\\`` + window.name;',
        'export const n = `x${ {a: 1}.a + document.title }y`;',
        // Une barre oblique ne ferme pas l'expression dans une classe, ni
        // échappée ; « /* » après un nom ouvre un commentaire, non une division.
        "export const p = /[/']/.test(s) ? 'location.href' : document.title;",
        "export const q = /\\/'/.test(s) ? 'window.name' : navigator.language;",
        "export const r = somme /* l'entier */ + window.name;",
        // Une expression après « ) » se lit comme une division : l'apostrophe
        // y ouvre une chaîne, que la fin de la ligne arrête.
        "if (garde) /'/.test(s) && compter();",
        'export const z = localStorage.x;',
      ].join('\n'),
      'src/moteur/document.js': 'export const SCHEMA = 1;\n',
    };
    assert.deepEqual(avecArbre(fichiers, releverFrontiere), [
      'src/moteur/a.js:4 document.',
      'src/moteur/a.js:5 window.',
      'src/moteur/a.js:6 window.',
      'src/moteur/a.js:7 document.',
      'src/moteur/a.js:8 location.',
      'src/moteur/a.js:9 localStorage.',
      'src/moteur/a.js:10 sessionStorage.',
      'src/moteur/a.js:11 navigator.',
      'src/moteur/a.js:16 navigator.',
      'src/moteur/a.js:17 window.',
      'src/moteur/a.js:18 document.',
      'src/moteur/a.js:19 document.',
      'src/moteur/a.js:20 navigator.',
      'src/moteur/a.js:21 window.',
      'src/moteur/a.js:23 localStorage.',
    ]);
  });

  test("src/stockage n'importe ni src/csv, ni src/application, ni src/interface, ni une plateforme, et ne touche le navigateur que dans ses deux systèmes de fichiers, que nul n'y importe", () => {
    const fichiers = {
      ...MODULES_VIDES,
      'src/stockage/depot.js': [
        "import { decouper } from '../csv/lecture.js';",
        "import { creerSeance } from '../application/seance.js';",
        "import App from '../interface/App.svelte';",
        "import { mount } from 'svelte';",
        "import { ipcRenderer } from 'electron';",
        "import { Capacitor } from '@capacitor/core';",
        "import { readFile } from 'node:fs/promises';",
        "import { HISTORIQUE } from '../moteur/recherche.js';",
        "import { SCHEMA } from './document.js';",
        "import { creerFichiersWeb } from './fichiers_web.js';",
        "/** @param {import('../application/seance.js').Seance} seance */",
        "/** @returns {import('./types.js').Charge} */",
        'export const titre = () => document.title;',
        "export const cle = 'localStorage.x';",
        "import { voisin } from './voisin';",
      ].join('\n'),
      'src/stockage/document.js': 'export const SCHEMA = 1;\n',
      'src/stockage/types.js': '/** @typedef {Object} Charge */\n',
      'src/stockage/sous/memoire.js': "export const lire = () => localStorage.getItem('x');\n",
      'src/stockage/fichiers_web.js': 'export const creerFichiersWeb = () => navigator.storage.getDirectory();\n',
      'src/stockage/fichiers_electron.js': [
        'export const creerFichiersElectron = (pont = window.gtt.fichiers) => pont;',
        "import { creerFichiersWeb } from './fichiers_web.js';",
      ].join('\n'),
      'src/stockage/depot.test.js': "import { mount } from 'svelte';\nexport const corps = document.body;\n",
      'src/moteur/recherche.js': 'export const HISTORIQUE = 1000;\nexport const largeur = () => window.innerWidth;\n',
    };
    assert.deepEqual(avecArbre(fichiers, releverFrontiere), [
      'src/moteur/recherche.js:2 window.',
      'src/stockage/depot.js:1 import ../csv/lecture.js',
      'src/stockage/depot.js:2 import ../application/seance.js',
      'src/stockage/depot.js:3 import ../interface/App.svelte',
      'src/stockage/depot.js:4 import svelte',
      'src/stockage/depot.js:5 import electron',
      'src/stockage/depot.js:6 import @capacitor/core',
      'src/stockage/depot.js:7 import node:fs/promises',
      'src/stockage/depot.js:10 import ./fichiers_web.js',
      'src/stockage/depot.js:11 import ../application/seance.js',
      'src/stockage/depot.js:13 document.',
      'src/stockage/depot.js:15 import ./voisin sans extension',
      'src/stockage/fichiers_electron.js:2 import ./fichiers_web.js',
      'src/stockage/sous/memoire.js:1 localStorage.',
      'src/stockage/depot.js → src/moteur/recherche.js:2 window.',
    ]);
  });

  test("src/csv n'importe ni src/application, ni src/interface, ni une plateforme, et lit le modèle de src/stockage ; un import de type en JSDoc compte comme un import", () => {
    const fichiers = {
      ...MODULES_VIDES,
      'src/csv/import.js': [
        "/** @param {import('../stockage/types.js').Charge} charge */",
        "import { libelle } from '../application/libelles.js';",
        "/** @returns {import('../interface/vue.js').Vue} */",
        "import { Capacitor } from '@capacitor/core';",
        "import { app } from 'electron';",
        "import { writable } from 'svelte/store';",
        "import { creerFichiersWeb } from '../stockage/fichiers_web.js';",
        "import { SCHEMA } from '../stockage/document.js';",
        'export const largeur = () => window.innerWidth;',
      ].join('\n'),
      'src/csv/sous/lecture.js': "import { readFileSync } from 'fs';\n",
      'src/stockage/types.js': '/** @typedef {Object} Charge */\n',
      'src/stockage/document.js': 'export const SCHEMA = 1;\n',
      'src/stockage/fichiers_web.js': 'export const creerFichiersWeb = () => navigator.storage.getDirectory();\n',
    };
    assert.deepEqual(avecArbre(fichiers, releverFrontiere), [
      'src/csv/import.js:2 import ../application/libelles.js',
      'src/csv/import.js:3 import ../interface/vue.js',
      'src/csv/import.js:4 import @capacitor/core',
      'src/csv/import.js:5 import electron',
      'src/csv/import.js:6 import svelte/store',
      'src/csv/import.js:9 window.',
      'src/csv/sous/lecture.js:1 import fs',
      'src/csv/import.js → src/stockage/fichiers_web.js:1 navigator.',
    ]);
  });

  test("src/application n'importe ni src/interface, ni svelte, ni un module de Node ; elle câble le stockage, le CSV et les systèmes de fichiers des plateformes", () => {
    const fichiers = {
      ...MODULES_VIDES,
      'src/application/seance.js': [
        "import App from '../interface/App.svelte';",
        "import { mount } from 'svelte';",
        "import { creerFichiersWeb } from '../stockage/fichiers_web.js';",
        "import { decoder } from '../csv/encodage.js';",
        "import { Capacitor } from '@capacitor/core';",
        "import { readFile } from 'node:fs/promises';",
        'export const largeur = () => window.innerWidth;',
        "/** @param {import('../interface/vue.js').Vue} vue */",
      ].join('\n'),
      'src/application/sous/commandes.js': "import { x } from '../../interface/x.js';\n",
      'src/stockage/fichiers_web.js': 'export const creerFichiersWeb = () => navigator.storage.getDirectory();\n',
      'src/csv/encodage.js': 'export const decoder = (octets) => octets;\n',
    };
    assert.deepEqual(avecArbre(fichiers, releverFrontiere), [
      'src/application/seance.js:1 import ../interface/App.svelte',
      'src/application/seance.js:2 import svelte',
      'src/application/seance.js:6 import node:fs/promises',
      'src/application/seance.js:8 import ../interface/vue.js',
      'src/application/sous/commandes.js:1 import ../../interface/x.js',
    ]);
  });

  test('src/geometrie et src/application peuvent manquer ; un src/moteur, un src/stockage ou un src/csv sans module fait échouer la garde', () => {
    assert.deepEqual(avecArbre(MODULES_VIDES, releverFrontiere), []);
    for (const arbre of ['src/moteur', 'src/stockage', 'src/csv']) {
      const sansModule = { ...sansArbre(MODULES_VIDES, arbre), [`${arbre}/a.test.js`]: '', 'src/geometrie/echelle.js': '' };
      assert.throws(
        () => avecArbre(sansModule, releverFrontiere),
        new RegExp(`${arbre} ne fournit aucun module`),
        arbre,
      );
    }
  });
});

// Périmètre du relevé des dépendances : les fichiers de la racine, et les
// arbres des sources, des épreuves, des scripts et de la coquille ; ni
// node_modules ni sortie de construction.
const ARBRES = ['src', 'test', 'scripts', 'electron'];
const EXTENSIONS_SOURCE = new Set(['.js', '.cjs', '.mjs', '.svelte']);
function sourcesDuProjet(racine) {
  const racineSeule = readdirSync(racine, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => join(racine, e.name));
  return [...racineSeule, ...ARBRES.flatMap((arbre) => fichiersDe(join(racine, arbre)))]
    .filter((chemin) => EXTENSIONS_SOURCE.has(extname(chemin)))
    .sort();
}

// Un spécificateur nu n'est ni relatif, ni absolu : ni chemin, ni URL, sinon
// sous node:, la forme des modules natifs.
const URL_ABSOLUE = /^(?!node:)[a-z][a-z\d+.-]*:/i;
const estNu = (specificateur) =>
  !RELATIF.test(specificateur) && !specificateur.startsWith('/') && !URL_ABSOLUE.test(specificateur);

// Relevé « fichier:ligne spécificateur » des spécificateurs nus qui ne
// désignent ni un module natif de Node ni un paquet de devDependencies ; un
// paquet que seul dependencies déclare est relevé lui aussi, le projet
// n'ayant aucune dépendance d'exécution. Node et Vite résolvent un
// spécificateur nu en remontant les node_modules des répertoires parents :
// un paquet non déclaré, présent dans un parent sur un poste, s'y charge,
// puis manque dans un clone. isBuiltin admet le nom seul d'un module natif et
// sa forme node:, la seule qu'acceptent certains (node:test) ; il refuse un
// nom inconnu sous node:. Lève quand le périmètre ne porte aucun
// spécificateur nu.
function releverDependances(racine) {
  const { devDependencies = {} } = JSON.parse(readFileSync(join(racine, 'package.json'), 'utf8'));
  const declares = new Set(Object.keys(devDependencies));
  let nus = 0;
  const refus = [];
  for (const fichier of sourcesDuProjet(racine)) {
    const texte = readFileSync(fichier, 'utf8');
    const trouves = chargementsLitteraux(texte).filter(({ specificateur }) => estNu(specificateur));
    nus += trouves.length;
    for (const { specificateur, indice } of trouves) {
      if (!isBuiltin(specificateur) && !declares.has(nomDePaquet(specificateur))) {
        refus.push(`${relative(racine, fichier)}:${ligneDe(texte, indice)} ${specificateur}`);
      }
    }
  }
  assert.ok(nus > 0, 'aucun spécificateur nu dans le périmètre');
  return refus;
}

// Un import de module seul par spécificateur, une ligne chacun, entre les
// guillemets donnés, doubles par défaut. Le texte de ce fichier ne porte
// ainsi aucun spécificateur entre guillemets après le mot-clé : un
// spécificateur refusé, écrit en clair dans une instruction d'import de ce
// fichier, ferait échouer la garde sur ce fichier même. Une donnée qui charge
// un paquet refusé par une autre forme l'interpole pour la même raison.
const importsSeuls = (specificateurs, guillemet = '"') =>
  specificateurs.map((s) => `import ${guillemet}${s}${guillemet};`).join('\n');

describe('arborescence : dépendances déclarées', () => {
  test('chaque spécificateur nu désigne un module natif de Node ou un paquet de devDependencies', () => {
    assert.deepEqual(releverDependances(RACINE), []);
  });

  test('la garde relève chaque paquet absent de devDependencies, dans son périmètre seul', () => {
    const fichiers = {
      'package.json': JSON.stringify({
        dependencies: { lodash: '^4.17.21' },
        devDependencies: { vitest: '^5.0.3', '@vitest/browser-playwright': '^5.0.3' },
      }),
      'vite.config.js': "import { defineConfig } from 'vite';\n",
      'src/interface/a.svelte': [
        '<script>',
        "  import { mount } from 'svelte';",
        '</script>',
        '<style>',
        "  @import 'jetons.css';",
        '</style>',
      ].join('\n'),
      'electron/b.cjs': "const { app } = require('electron');\n",
      'scripts/oracle/c.mjs': [
        "const { chromium } = require('playwright');",
        "import assert from 'node:assert/strict';",
        'import {',
        '  describe,',
        "} from 'vitest/config';",
        "export * from '@vitest/browser-playwright';",
        "const { join } = require('node:path');",
        "const vue = await import('svelte/store');",
        "import './voisin.js';",
        "import '..';",
        "spawnSync(process.execPath, ['--import', 'chargeur.js']);",
        "import { build } from'vite';",
        'const fc = await import(`fast-check`);',
        "const { app } = await import('electron', { with: {} });",
      ].join('\n'),
      'test/d.test.js': [
        importsSeuls(['fs/promises', 'node:test', 'test', 'node:inexistant', '@vitest/inconnu']),
        importsSeuls(['jsdom'], "'"),
        importsSeuls(['/absolu.js', 'file:///e.js', 'lodash']),
        `import x from ${JSON.stringify('happy-dom')};`,
        `require(${JSON.stringify('undici')});`,
      ].join('\n'),
      'node_modules/f/index.js': importsSeuls(['hors-perimetre']),
      'www/g.js': importsSeuls(['hors-perimetre']),
    };
    assert.deepEqual(avecArbre(fichiers, releverDependances), [
      'electron/b.cjs:1 electron',
      'scripts/oracle/c.mjs:1 playwright',
      'scripts/oracle/c.mjs:8 svelte/store',
      'scripts/oracle/c.mjs:12 vite',
      'scripts/oracle/c.mjs:13 fast-check',
      'scripts/oracle/c.mjs:14 electron',
      'src/interface/a.svelte:2 svelte',
      'test/d.test.js:3 test',
      'test/d.test.js:4 node:inexistant',
      'test/d.test.js:5 @vitest/inconnu',
      'test/d.test.js:6 jsdom',
      'test/d.test.js:9 lodash',
      'test/d.test.js:10 happy-dom',
      'test/d.test.js:11 undici',
      'vite.config.js:1 vite',
    ]);
  });

  test('un périmètre sans spécificateur nu fait échouer la garde', () => {
    const fichiers = { 'package.json': '{}', 'src/a.js': "import './b.js';\n" };
    assert.throws(() => avecArbre(fichiers, releverDependances), /aucun spécificateur nu/);
  });
});

// Valeurs du contrat de données (types.js) : configuration.js les définit et
// les exporte, tout autre fichier de src/moteur les importe, épreuves
// comprises (§ 13.2). Une déclaration de l'un de ces noms ailleurs est une
// seconde définition, qui peut dériver de la première sans qu'aucune épreuve
// ne le voie. Le relevé lit le nom qui suit const, let ou var : une
// déstructuration de STATUT n'est pas relevée, elle lit la définition au lieu
// de la refaire.
const VALEURS_DU_CONTRAT = [
  'STATUT',
  'MOBILE',
  'PARTIELLEMENT_FIXE',
  'ANCRE',
  'LIBRE',
  'RESERVE',
  'SANS_GROUPE',
];
const DECLARATION_DE_VALEUR = new RegExp(
  `\\b(?:const|let|var)\\s+(${VALEURS_DU_CONTRAT.join('|')})\\b`,
  'g',
);
const PROPRIETAIRE_DES_VALEURS = join('src', 'moteur', 'configuration.js');

// Relevé « fichier:ligne nom » des déclarations d'une valeur du contrat dans
// les fichiers JavaScript de src/moteur, à toute profondeur, épreuves
// comprises, configuration.js excepté ; par fichier, puis par ligne. Lève
// quand src/moteur ne fournit aucun fichier JavaScript.
function releverValeursDuContrat(racine) {
  const fichiers = fichiersDe(join(racine, 'src', 'moteur'))
    .filter((fichier) => EXTENSIONS_MODULE.has(extname(fichier)))
    .sort();
  assert.ok(fichiers.length > 0, 'src/moteur ne fournit aucun fichier JavaScript');
  return fichiers
    .filter((fichier) => relative(racine, fichier) !== PROPRIETAIRE_DES_VALEURS)
    .flatMap((fichier) => {
      const texte = readFileSync(fichier, 'utf8');
      return [...texte.matchAll(DECLARATION_DE_VALEUR)].map(
        (trouve) => `${relative(racine, fichier)}:${ligneDe(texte, trouve.index)} ${trouve[1]}`,
      );
    });
}

describe('arborescence : un seul propriétaire des valeurs du contrat (types.js)', () => {
  test('hors de configuration.js, aucun fichier de src/moteur ne déclare STATUT, un statut, LIBRE, RESERVE ni SANS_GROUPE', () => {
    assert.deepEqual(releverValeursDuContrat(RACINE), []);
  });

  test('la garde relève chaque déclaration par sa ligne, épreuves comprises, et admet le propriétaire, la déstructuration et les noms voisins', () => {
    const fichiers = {
      'src/moteur/configuration.js': 'export const STATUT = Object.freeze({ ANCRE: 2 });\nexport const LIBRE = -1;\n',
      'src/moteur/a.js': [
        "import { STATUT } from './configuration.js';",
        'const { ANCRE } = STATUT;',
        'const ANCRES = [];',
        'let LIBRES = 0;',
      ].join('\n'),
      'src/moteur/b.js': 'const ANCRE = 2;\nexport let RESERVE = -1;\n',
      'src/moteur/sous/c.test.js': '// Épreuve.\nvar SANS_GROUPE = -1;\n',
    };
    assert.deepEqual(avecArbre(fichiers, releverValeursDuContrat), [
      'src/moteur/b.js:1 ANCRE',
      'src/moteur/b.js:2 RESERVE',
      'src/moteur/sous/c.test.js:2 SANS_GROUPE',
    ]);
  });

  test('un src/moteur sans fichier JavaScript fait échouer la garde', () => {
    for (const fichiers of [{ 'src/demo/a.js': '' }, { 'src/moteur/notes.md': '' }]) {
      assert.throws(
        () => avecArbre(fichiers, releverValeursDuContrat),
        /src\/moteur ne fournit aucun fichier JavaScript/,
      );
    }
  });
});

// Modules que le § 14.13 tient à 100 % de branches : le module des indicateurs
// et du plafond, et les chemins de reprise du stockage.
const MODULES_A_SEUIL = [
  'src/moteur/indicateurs.js',
  'src/moteur/plafond.js',
  'src/stockage/depot.js',
  'src/stockage/journal.js',
];

// Clés de coverage.thresholds qui vaudraient pour tous les fichiers mesurés.
const SEUILS_GLOBAUX = ['statements', 'branches', 'functions', 'lines', '100', 'perFile'];

// Vrai quand le chemin relatif répond à l'un des motifs de fichiers donnés.
const repondA = (chemin, motifs = []) => motifs.some((motif) => matchesGlob(chemin, motif));

// La commande de la mesure : make couverture passe la main à npm run
// couverture, qui lance vitest run sur la série node, couverture active.
// Sans --coverage, la série passe et aucun seuil ne se lit. Outre ces deux
// arguments, le script n'admet que le choix du rapporteur des épreuves : une
// option --coverage.* redéfinirait, pour cette exécution, les seuils, include
// ou exclude que relève releverCouverture, et --changed, --config ou un
// filtre de fichiers changeraient ce qui se mesure. Une option et sa valeur
// se lisent en un argument : « --project node » comme « --project=node ».
const RECETTE_DE_MESURE = '$(AVEC_NODE) npm run couverture';
const ARGUMENTS_REQUIS = ['--project=node', '--coverage'];
const ARGUMENT_ADMIS = /^(?:--project=node|--coverage|--reporter=\S+)$/;
const OPTION_A_VALEUR = /^--(?:project|reporter)$/;

// Écarts de la commande de la mesure sous la racine : la recette de la cible
// couverture du Makefile, puis le script couverture de package.json, ses
// arguments requis dans l'ordre de ARGUMENTS_REQUIS, puis ses arguments non
// admis dans l'ordre du script. Un script qui ne commence pas par
// « vitest run » n'est pas lu plus loin.
function ecartsDeLaCommande(racine) {
  const ecarts = [];
  const makefile = readFileSync(join(racine, 'Makefile'), 'utf8');
  const recette = /^couverture:.*\n((?:\t.*(?:\n|$))*)/m.exec(makefile)?.[1] ?? '';
  if (recette.trim() !== RECETTE_DE_MESURE) ecarts.push('make couverture : ne lance pas npm run couverture');
  const { scripts = {} } = JSON.parse(readFileSync(join(racine, 'package.json'), 'utf8'));
  const [programme, sousCommande, ...mots] = (scripts.couverture ?? '').trim().split(/\s+/);
  if (programme !== 'vitest' || sousCommande !== 'run') {
    return [...ecarts, 'npm run couverture : ne lance pas vitest run'];
  }
  const lus = [];
  for (let i = 0; i < mots.length; i += 1) {
    if (OPTION_A_VALEUR.test(mots[i]) && i + 1 < mots.length) {
      lus.push(`${mots[i]}=${mots[i + 1]}`);
      i += 1;
    } else {
      lus.push(mots[i]);
    }
  }
  for (const requis of ARGUMENTS_REQUIS) {
    if (!lus.includes(requis)) ecarts.push(`npm run couverture : sans ${requis.replace('=', ' ')}`);
  }
  for (const argument of lus) {
    if (!ARGUMENT_ADMIS.test(argument)) ecarts.push(`npm run couverture : argument non admis ${argument}`);
  }
  return ecarts;
}

// Écarts des rapports que la configuration nomme : le tableau text, une
// ligne par couche et par module, pleins compris — sans skipFull: false
// écrit, Vitest les tait quand un agent le lance —, puis le rapport html, qui
// montre ligne à ligne ce qui ne s'exécute jamais. Un rapporteur est un nom ou
// un couple [nom, options] ; reporter, un rapporteur seul ou leur liste.
function ecartsDuRapport(reporter) {
  const rapporteurs = (Array.isArray(reporter) ? reporter : [reporter]).map((r) => (Array.isArray(r) ? r : [r]));
  const ecarts = [];
  if (!rapporteurs.some(([nom, options]) => nom === 'text' && options?.skipFull === false)) {
    ecarts.push('rapport : aucun tableau text à skipFull: false');
  }
  if (!rapporteurs.some(([nom]) => nom === 'html')) ecarts.push('rapport : aucun rapport html');
  return ecarts;
}

// Relevé des écarts de la mesure au § 14.13, sur l'arbre qu'elle mesure :
// ceux de la commande, puis ceux des rapports ; puis, dans la configuration
// de couverture de Vitest, un seuil global, qu'un pourcentage d'ensemble
// satisfait en couvrant les modules faciles ; un seuil hors de
// MODULES_A_SEUIL ; un module de MODULES_A_SEUIL dont le seuil de branches
// n'est pas 100 ; un module absent de l'arbre, ou hors de la mesure — hors de
// coverage.include, ou dans coverage.exclude. Vitest tient pour atteint un
// seuil qui ne compte aucune branche, sans rien dire : sans ces deux derniers
// relevés, un module renommé passerait. Les écarts viennent dans cet ordre,
// module par module dans l'ordre de MODULES_A_SEUIL. Lève quand la
// configuration, le Makefile ou package.json manque.
function releverCouverture(racine, couverture) {
  assert.ok(couverture, 'aucune configuration de couverture');
  const { thresholds = {}, include, exclude, reporter } = couverture;
  const ecarts = [
    ...ecartsDeLaCommande(racine),
    ...ecartsDuRapport(reporter),
    ...SEUILS_GLOBAUX.filter((cle) => Object.hasOwn(thresholds, cle)).map((cle) => `seuil global : ${cle}`),
  ];
  for (const cle of Object.keys(thresholds).sort()) {
    if (!SEUILS_GLOBAUX.includes(cle) && !MODULES_A_SEUIL.includes(cle)) {
      ecarts.push(`seuil hors des modules nommés : ${cle}`);
    }
  }
  for (const module of MODULES_A_SEUIL) {
    const seuil = thresholds[module];
    if (seuil === undefined) ecarts.push(`${module} : aucun seuil`);
    else if (seuil.branches !== 100) ecarts.push(`${module} : branches à ${seuil.branches}`);
    if (!existsSync(join(racine, module))) ecarts.push(`${module} : absent de l'arbre`);
    else if (!repondA(module, include) || repondA(module, exclude)) ecarts.push(`${module} : hors de la mesure`);
  }
  return ecarts;
}

// Une mesure conforme au § 14.13, que les données d'épreuve altèrent une
// pièce à la fois : les quatre modules, le script de package.json, la recette
// du Makefile, et la configuration de couverture.
const scriptDeMesure = (script) => JSON.stringify({ scripts: { couverture: script } });
const MODULES_MESURES = Object.freeze(Object.fromEntries(MODULES_A_SEUIL.map((module) => [module, ''])));
const COMMANDE_CONFORME = Object.freeze({
  'package.json': scriptDeMesure('vitest run --project node --coverage --reporter=default'),
  Makefile: '.PHONY: couverture\ncouverture: ## Mesure la couverture\n\t$(AVEC_NODE) npm run couverture\n',
});
const RAPPORT_CONFORME = Object.freeze([['text', { skipFull: false }], 'html']);
const COUVERTURE_CONFORME = Object.freeze({
  include: ['src/**/*.js'],
  reporter: RAPPORT_CONFORME,
  thresholds: Object.fromEntries(MODULES_A_SEUIL.map((module) => [module, { branches: 100 }])),
});

describe('arborescence : la couverture (§ 14.13)', () => {
  test("make couverture et npm run couverture mesurent la série node ; le rapport montre chaque module ; aucun seuil global ; 100 % de branches sur chaque module nommé, présent dans l'arbre et dans la mesure", () => {
    assert.deepEqual(releverCouverture(RACINE, configuration.test.coverage), []);
  });

  test("la garde relève un seuil global, un seuil hors des modules nommés, abaissé ou absent, un module absent de l'arbre ou de la mesure", () => {
    const couverture = {
      include: ['src/**/*.js'],
      exclude: ['**/*.test.js', 'src/stockage/depot.js'],
      reporter: RAPPORT_CONFORME,
      thresholds: {
        branches: 90,
        perFile: true,
        'src/moteur/indicateurs.js': { branches: 100 },
        'src/moteur/plafond.js': { branches: 95 },
        'src/stockage/journal.js': { branches: 100, lines: 100 },
        'src/csv/**': { branches: 100 },
      },
    };
    const fichiers = {
      ...COMMANDE_CONFORME,
      'src/moteur/indicateurs.js': '',
      'src/stockage/depot.js': '',
      'src/stockage/journal.js': '',
    };
    assert.deepEqual(avecArbre(fichiers, (racine) => releverCouverture(racine, couverture)), [
      'seuil global : branches',
      'seuil global : perFile',
      'seuil hors des modules nommés : src/csv/**',
      'src/moteur/plafond.js : branches à 95',
      "src/moteur/plafond.js : absent de l'arbre",
      'src/stockage/depot.js : aucun seuil',
      'src/stockage/depot.js : hors de la mesure',
    ]);
    const sansInclude = { ...couverture, include: undefined, exclude: undefined, thresholds: {} };
    assert.deepEqual(
      avecArbre(fichiers, (racine) => releverCouverture(racine, sansInclude)).filter((e) => e.endsWith('mesure')),
      ['src/moteur/indicateurs.js : hors de la mesure', 'src/stockage/depot.js : hors de la mesure', 'src/stockage/journal.js : hors de la mesure'],
    );
    assert.throws(() => releverCouverture(RACINE, undefined), /aucune configuration de couverture/);
  });

  test('la garde relève une commande qui ne mesure pas la série node, ou qui redéfinit la mesure ; make couverture passe par npm run couverture', () => {
    const relever = (fichiers) =>
      avecArbre({ ...MODULES_MESURES, ...COMMANDE_CONFORME, ...fichiers }, (racine) =>
        releverCouverture(racine, COUVERTURE_CONFORME),
      );
    assert.deepEqual(relever({}), []);
    assert.deepEqual(relever({ 'package.json': scriptDeMesure('vitest run --project=node --coverage --reporter default') }), []);
    const scripts = [
      ['vitest run --project node --reporter=default', ['npm run couverture : sans --coverage']],
      [
        'vitest run --project node --coverage --coverage.include=src/moteur/indicateurs.js --coverage.exclude=src/stockage/journal.js',
        [
          'npm run couverture : argument non admis --coverage.include=src/moteur/indicateurs.js',
          'npm run couverture : argument non admis --coverage.exclude=src/stockage/journal.js',
        ],
      ],
      [
        'vitest run --project node-long --coverage',
        ['npm run couverture : sans --project node', 'npm run couverture : argument non admis --project=node-long'],
      ],
      [
        'vitest run --project node --coverage --changed src/moteur',
        ['npm run couverture : argument non admis --changed', 'npm run couverture : argument non admis src/moteur'],
      ],
      ['vitest --project node --coverage', ['npm run couverture : ne lance pas vitest run']],
    ];
    for (const [script, attendu] of scripts) {
      assert.deepEqual(relever({ 'package.json': scriptDeMesure(script) }), attendu, script);
    }
    for (const makefile of ['couverture:\n\t$(AVEC_NODE) npm test\n', 'mesure:\n\t$(AVEC_NODE) npm run couverture\n']) {
      assert.deepEqual(relever({ Makefile: makefile }), ['make couverture : ne lance pas npm run couverture'], makefile);
    }
  });

  test("la garde relève un rapport qui tait les modules pleins, ou qui ne montre pas, ligne à ligne, ce qui ne s'exécute jamais", () => {
    const relever = (reporter) =>
      avecArbre({ ...MODULES_MESURES, ...COMMANDE_CONFORME }, (racine) =>
        releverCouverture(racine, { ...COUVERTURE_CONFORME, reporter }),
      );
    const sansTableau = 'rapport : aucun tableau text à skipFull: false';
    const sansHtml = 'rapport : aucun rapport html';
    assert.deepEqual(relever([['html'], ['text', { skipFull: false, maxCols: 120 }]]), []);
    const rapporteurs = [
      [['text-summary'], [sansTableau, sansHtml]],
      [['text', 'html'], [sansTableau]],
      [[['text', { skipFull: true }], 'html'], [sansTableau]],
      ['html', [sansTableau]],
      [[['text', { skipFull: false }]], [sansHtml]],
    ];
    for (const [reporter, attendu] of rapporteurs) {
      assert.deepEqual(relever(reporter), attendu, JSON.stringify(reporter));
    }
  });
});
