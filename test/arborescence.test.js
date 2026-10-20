// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Gardes de l'arborescence, lues dans le texte des sources : le moteur, la
// géométrie du plan, le générateur de démonstrations, le stockage,
// l'analyseur CSV et la production PDF n'appellent aucune source non
// reproductible (§ 14.7), et ne
// parcourent les clés d'un objet que par exception nommée (§ 15.5, point 4) ;
// le graphe d'imports de chaque couche, l'interface et ses composants compris,
// ne rejoint que ce que le § 13.4 lui permet, et ni le moteur, ni la
// géométrie, ni le générateur ne lisent la version engendrée (§ 14.7) ; seuls
// deux lecteurs nommés touchent le pont de la coquille (§ 13.1) ; hors de
// l'horloge, l'interface et l'application n'arment aucune minuterie et ne
// lisent ni l'heure, ni l'aléa, ni la langue (§ 19.4) ; seul le point
// d'entrée lit le nombre de processeurs logiques (§ 13.4) ; seul l'aperçu lit
// le contexte 'imprimante' et appelle imprimer, et ni l'interface ni
// l'application ne touchent print (§ 11.7) ; chaque paquet importé est déclaré dans devDependencies, et aucun
// paquet refusé ne l'est (§ 13.3, § 14.8) ; une valeur du contrat de données
// n'a qu'une définition, celle de configuration.js ; la mesure de la
// couverture joue la série node sous le seul rapporteur default, publie
// chaque module et tient ses seuils durs sur des modules qui existent
// (§ 14.13) ; les épreuves s'écrivent selon le § 14.8, la série surveillée
// n'attend ni n'écrit hors d'un temporaire, et ses motifs de surveillance ne
// retirent aucune relance (§ 14.14) ; dans le moteur, deux modules nommés
// lisent les réservations (§ 5.2) ; src/, electron/ et scripts/ n'ont qu'une
// langue (§ 13.2) ; une épreuve de src/ vit à côté de son module, et aucune
// donnée d'épreuve ne double un fichier livré (§ 14.9) ; fast-check ne se
// charge que dans les épreuves nommées (§ 14.12). Chaque relevé lit le texte
// entier, commentaires et chaînes compris, hors ceux qui disent le contraire —
// les accès au navigateur et au pont, et les relevés des épreuves, sautent les
// chaînes littérales ; les lectures du nombre de processeurs et de
// l'imprimante sautent chaînes et commentaires : un commentaire qui nomme un appel refusé fait échouer
// la garde comme l'appel lui-même. Chaque garde déclare son périmètre, refuse
// de passer sur un balayage vide (§ 14.2), et d'autres épreuves la font
// tourner sur des arbres temporaires qui portent, à plus d'un niveau de
// profondeur, les formes qu'elle refuse et des formes voisines qu'elle admet.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, matchesGlob, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOGUE } from '../src/demo/catalogue.js';
import { LIVREES, demonstrationsLivrees } from '../src/demo/livrees.js';
import configuration from '../vitest.config.js';
import { blocsScript, chargements, scriptsDe } from './chargements.js';
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
  {
    fichier: join('src', 'stockage', 'reglages_locaux.js'),
    motif: /Object\s*\.\s*keys\s*\(\s*PAPIERS\s*\)\s*\.\s*sort\s*\(\s*comparerTextes\s*\)/,
    raison:
      'le domaine du papier, tiré de src/geometrie/papiers.js, sa seule définition : les clés de PAPIERS, ' +
      "rangées sur-le-champ par comparerTextes ; le message d'un refus ne dépend que de leur ensemble",
  },
];

// Arbres dont les modules ne lisent aucune source non reproductible (§ 14.7) :
// le moteur, la géométrie du plan et le générateur de démonstrations, puis le
// stockage et l'analyseur CSV, qui reçoivent l'horloge et l'aléa de
// l'application, en paramètre, et la production PDF, dont la date du
// document entre en paramètre : deux productions du même modèle rendent les
// mêmes octets.
const ARBRES_DETERMINISTES = ['src/moteur', 'src/geometrie', 'src/demo', 'src/stockage', 'src/csv', 'src/pdf'];

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
  'src/interface/a.js': '',
  'src/moteur/a.js': '',
  'src/geometrie/a.js': '',
  'src/demo/a.js': '',
  'src/stockage/a.js': '',
  'src/csv/a.js': '',
  'src/pdf/a.js': '',
  'src/impression/a.js': '',
  'src/polices/a.js': '',
});

// Les fichiers donnés, sans ceux de l'arbre nommé.
const sansArbre = (fichiers, arbre) =>
  Object.fromEntries(Object.entries(fichiers).filter(([chemin]) => !chemin.startsWith(`${arbre}/`)));

// Le relevé du déterminisme sans exception : une donnée d'épreuve ne porte pas
// les fichiers que nomment les exceptions de l'arbre réel.
const releverSansException = (racine) => releverDeterminisme(racine, []);

describe('arborescence : déterminisme (§ 14.7)', () => {
  test("ni src/moteur, ni src/geometrie, ni src/demo, ni src/stockage, ni src/csv, ni src/pdf ne lisent une source non reproductible, ni ne parcourent les clés d'un objet hors des exceptions nommées", () => {
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
    for (const arbre of ARBRES_DETERMINISTES) {
      const sansModule = { ...sansArbre(MODULES_VIDES, arbre), [`${arbre}/a.test.js`]: '' };
      assert.throws(
        () => avecArbre(sansModule, releverSansException),
        new RegExp(`${arbre} ne fournit aucun module`),
        arbre,
      );
    }
  });

  test('src/geometrie se relève comme le moteur, à toute profondeur, hors épreuves', () => {
    const fichiers = {
      ...MODULES_VIDES,
      'src/geometrie/vue.js': [
        'export const a = Math.random();',
        'export const b = (o) => Object.keys(o).map((cle) => o[cle]);',
        'export const c = Math.min(1, 2) + Math.floor(2.5);',
      ].join('\n'),
      'src/geometrie/sous/texte.js': 'for (const champ in ligne) t.push(champ);\n',
      'src/geometrie/vue.test.js': 'export const d = Math.random() + Object.keys(o).length;\n',
    };
    assert.deepEqual(avecArbre(fichiers, releverSansException), [
      'src/geometrie/sous/texte.js:1 for…in',
      'src/geometrie/vue.js:1 Math.random',
      'src/geometrie/vue.js:2 Object.keys',
    ]);
  });

  test('src/pdf se relève comme le moteur : une date de document lue ou un parcours de clés y tombent, à toute profondeur, hors épreuves', () => {
    const fichiers = {
      ...MODULES_VIDES,
      'src/pdf/planche.js': [
        'export const date = () => new Date();',
        'export const ordre = (o) => Object.entries(o);',
        'export const mesure = () => Math.ceil(2.5) + Date.UTC(2000, 0, 1);',
      ].join('\n'),
      'src/pdf/sous/filigrane.js': 'export const angle = () => Math.random() * 90;\n',
      'src/pdf/planche.test.js': 'export const t = Date.now() + Object.keys(o).length;\n',
    };
    assert.deepEqual(avecArbre(fichiers, releverSansException), [
      'src/pdf/planche.js:1 new Date',
      'src/pdf/planche.js:2 Object.entries',
      'src/pdf/sous/filigrane.js:1 Math.random',
    ]);
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
// un — une couche encore à écrire peut manquer. exterieures : les arbres,
// relatifs à la racine, qu'elle n'importe pas. frontieres : les arbres
// qu'elle importe sans que le parcours les suive, leur propre garde les
// tenant. paquets : ceux qu'elle refuse, outre les modules natifs de Node,
// que la page n'a pas et qu'aucune couche ne charge. navigateur : null quand
// la couche y accède librement ; sinon, les fichiers admis à y accéder,
// chacun dans son seul texte. Aucun module du parcours n'importe un fichier
// admis : il ne passe qu'en paramètre, de la main de l'application.
// composants : vrai quand ses composants Svelte sont des modules de la
// couche, lus par leurs blocs de script et les import() de leur gabarit.
//
// Le moteur et la géométrie ne connaissent ni l'écran, ni les fichiers, ni ce
// qui les commande. La géométrie est une couche à part, plus bas que le
// moteur : des fonctions pures du plan, qui n'importent ni le moteur, ni
// l'analyseur CSV, ni le générateur de démonstrations. Le stockage lit et
// écrit par le système de fichiers qu'il reçoit ; seules ses deux
// implémentations de plateforme touchent le navigateur, par l'OPFS sous web
// et par le pont window.gtt sous Electron.
// L'analyseur CSV lit le modèle du stockage. L'application câble le moteur,
// le stockage, le CSV et les systèmes de fichiers des plateformes, sous
// l'interface. L'interface n'importe que svelte, ses propres modules,
// l'application et la géométrie : elle atteint le CSV par
// src/application/csv.js, et le moteur par la table d'évaluation, sans que
// sa garde le lui reproche, l'application le faisant par construction ;
// importés en direct, le stockage, le CSV, le moteur, les démonstrations et
// test/ sont refusés. Le générateur de démonstrations lit le moteur et le
// stockage, qui sérialise ses fichiers, mais ni l'application, ni
// l'interface, ni le navigateur. Le moteur, la géométrie et le générateur ne
// lisent pas la version engendrée (§ 14.7, § 18.5), à aucune profondeur :
// une démonstration ou un placement qui en dépendrait changerait à chaque
// livraison.
//
// Les trois couches des sorties n'importent, hors d'elles, que ce que leur
// liste seulement nomme : tout autre fichier du projet est refusé, sans être
// parcouru, et les fichiers nommés sont des frontières que leur propre
// garde tient. La production PDF (src/pdf) n'importe que pdf-lib, fontkit,
// le registre des constantes et les papiers, et ne touche pas le navigateur :
// elle tourne sous node, dans le cycle court (§ 11.1). L'impression
// (src/impression), frontière de plateforme, n'importe que les papiers ; la
// police (src/polices) n'importe rien. Ni l'une ni l'autre ne s'importe
// depuis une autre couche : src/main.js seul les câble (IMPORTATEURS_RESERVES).
const VERSION_ENGENDREE = 'src/version.genere.js';
const SORTIES = ['src/pdf', 'src/impression', 'src/polices'];
const COUCHES = [
  {
    arbres: ['src/moteur'],
    requis: ['src/moteur'],
    exterieures: ['src/interface', 'src/application', 'src/stockage', ...SORTIES, VERSION_ENGENDREE],
    paquets: PAQUETS_DE_PLATEFORME,
    navigateur: [],
  },
  {
    arbres: ['src/geometrie'],
    requis: ['src/geometrie'],
    exterieures: ['src/interface', 'src/application', 'src/stockage', 'src/moteur', 'src/csv', 'src/demo', ...SORTIES, VERSION_ENGENDREE],
    paquets: PAQUETS_DE_PLATEFORME,
    navigateur: [],
  },
  {
    arbres: ['src/demo'],
    requis: ['src/demo'],
    exterieures: ['src/interface', 'src/application', ...SORTIES, VERSION_ENGENDREE],
    paquets: PAQUETS_DE_PLATEFORME,
    navigateur: [],
  },
  {
    arbres: ['src/stockage'],
    requis: ['src/stockage'],
    exterieures: ['src/interface', 'src/application', 'src/csv', ...SORTIES],
    paquets: PAQUETS_DE_PLATEFORME,
    navigateur: ['src/stockage/fichiers_web.js', 'src/stockage/fichiers_electron.js'],
  },
  {
    arbres: ['src/csv'],
    requis: ['src/csv'],
    exterieures: ['src/interface', 'src/application', ...SORTIES],
    paquets: PAQUETS_DE_PLATEFORME,
    navigateur: [],
  },
  {
    arbres: ['src/application'],
    requis: [],
    exterieures: ['src/interface', 'src/impression', 'src/polices'],
    frontieres: ['src/pdf'],
    paquets: /^svelte$/,
    navigateur: null,
  },
  {
    arbres: ['src/interface'],
    requis: ['src/interface'],
    exterieures: ['src/stockage', 'src/csv', 'src/moteur', 'src/demo', 'test', ...SORTIES],
    frontieres: ['src/application', 'src/geometrie'],
    paquets: /^(?!svelte$)/,
    navigateur: null,
    composants: true,
  },
  {
    arbres: ['src/pdf'],
    requis: ['src/pdf'],
    seulement: ['src/geometrie/constantes.js', 'src/geometrie/papiers.js'],
    paquets: /^(?!(?:pdf-lib|@pdf-lib\/fontkit)$)/,
    navigateur: [],
  },
  {
    arbres: ['src/impression'],
    requis: ['src/impression'],
    seulement: ['src/geometrie/papiers.js'],
    paquets: /^/,
    navigateur: null,
  },
  {
    arbres: ['src/polices'],
    requis: ['src/polices'],
    seulement: [],
    paquets: /^/,
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

// Composants Svelte d'un arbre, à toute profondeur, triés.
const composantsDe = (dossier) => fichiersDe(dossier).filter((fichier) => extname(fichier) === '.svelte').sort();

// Le texte qu'un relevé de chargements lit dans un fichier : celui de ses
// blocs de script et des import() de son gabarit pour un composant Svelte
// (scriptsDe), le texte entier sinon.
const texteDesChargements = (fichier, texte) => (extname(fichier) === '.svelte' ? scriptsDe(texte) : texte);

// Relevé des refus de la frontière d'une couche dans son graphe d'imports.
// Une couche à liste seulement refuse tout fichier du projet hors de ses
// arbres et de cette liste, et ne parcourt pas les fichiers qu'elle nomme.
// Le parcours part des modules de ses arbres, à toute profondeur, épreuves
// exclues, et de leurs composants Svelte pour une couche à composants. Il
// suit chaque chemin relatif, ou absolu depuis la racine, vers un module
// JavaScript existant — ou un composant, pour une couche à composants —,
// chaque fichier une fois. Un type que la JSDoc importe par import(…) compte
// comme un import. Un fichier d'une couche extérieure n'est pas parcouru :
// l'importer est déjà un refus, comme importer un fichier admis au
// navigateur. Un fichier d'une frontière admise n'est ni refusé ni parcouru.
// Un chemin sans extension est un refus : Node ne le résout pas (§ 14.8), et
// le parcours ne suit pas le module que Vite y trouverait. Un module natif de
// Node, que reconnaît isBuiltin, est refusé : la page où la couche s'exécute
// n'en a aucun. Un accès au navigateur n'est admis que dans le texte d'un
// fichier admis, parti de lui-même. Chaque refus se lit « accès:ligne
// refus », où l'accès est la suite des fichiers qui mène d'un fichier de
// départ à celui qui refuse. Lève quand un arbre requis ne fournit aucun
// module, ni composant pour une couche à composants.
function releverCouche(
  racine,
  { arbres, requis, exterieures = [], frontieres = [], seulement = null, paquets, navigateur, composants = false },
) {
  const departs = (arbre) => [
    ...modulesDe(join(racine, arbre)),
    ...(composants ? composantsDe(join(racine, arbre)).filter((f) => !EPREUVE.test(f)) : []),
  ];
  for (const arbre of requis) {
    assert.ok(departs(arbre).length > 0, `${arbre} ne fournit aucun module`);
  }
  const dans = (arbresDonnes) => {
    const chemins = arbresDonnes.map((arbre) => join(racine, arbre));
    return (chemin) => chemins.some((c) => chemin === c || chemin.startsWith(c + sep));
  };
  const propre = dans(arbres);
  const nomme = dans(seulement ?? []);
  const exterieure = dans(exterieures);
  const frontiereAdmise = dans(frontieres);
  const horsListe = (cible) => seulement !== null && !propre(cible) && !nomme(cible);
  const exterieur = (cible) => exterieure(cible) || horsListe(cible);
  const frontiere = (cible) => frontiereAdmise(cible) || (seulement !== null && nomme(cible));
  const parcourable = (chemin) => EXTENSIONS_MODULE.has(extname(chemin)) || (composants && extname(chemin) === '.svelte');
  const admis = new Set((navigateur ?? []).map((fichier) => join(racine, fichier)));
  const aParcourir = arbres.flatMap(departs);
  const acces = new Map(aParcourir.map((fichier) => [fichier, relative(racine, fichier)]));
  const refus = [];
  for (let i = 0; i < aParcourir.length; i += 1) {
    const fichier = aParcourir[i];
    const texte = texteDesChargements(fichier, readFileSync(fichier, 'utf8'));
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
      } else if (!frontiere(cible) && !acces.has(cible) && parcourable(cible) && existsSync(cible)) {
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
      'src/moteur/a.js → src/commun/aide.js:2 window.',
      'src/geometrie/echelle.js:1 window.',
      'src/geometrie/echelle.js:3 import ../application/commandes.js',
      'src/geometrie/echelle.js:4 import ../application/seance.js',
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

  test("src/geometrie n'importe ni le moteur, ni le CSV, ni les démonstrations : une couche à part, plus bas que le moteur", () => {
    const fichiers = {
      ...MODULES_VIDES,
      'src/geometrie/vue.js': [
        "import { mesurer } from '../moteur/indicateurs.js';",
        "import { decouper } from '../csv/lecture.js';",
        "import { creerPcg32 } from '../demo/prng.js';",
        "import { tronquer } from './texte.js';",
      ].join('\n'),
      'src/geometrie/texte.js': 'export const tronquer = (t) => t;\n',
      'src/moteur/indicateurs.js': 'export const mesurer = () => 0;\n',
      'src/csv/lecture.js': 'export const decouper = () => [];\n',
      'src/demo/prng.js': 'export const creerPcg32 = () => null;\n',
    };
    assert.deepEqual(avecArbre(fichiers, releverFrontiere), [
      'src/geometrie/vue.js:1 import ../moteur/indicateurs.js',
      'src/geometrie/vue.js:2 import ../csv/lecture.js',
      'src/geometrie/vue.js:3 import ../demo/prng.js',
    ]);
  });

  test("src/geometrie n'importe ni l'interface, ni l'application, ni le stockage, ni un paquet de plateforme", () => {
    const fichiers = {
      ...MODULES_VIDES,
      'src/geometrie/vue.js': [
        "import { x } from '../interface/x.js';",
        "import { y } from '../application/y.js';",
        "import { lire } from '../stockage/document.js';",
        "import { mount } from 'svelte';",
        "import { writable } from 'svelte/store';",
        "import { app } from 'electron';",
        "import { Capacitor } from '@capacitor/core';",
        "import { tronquer } from './texte.js';",
      ].join('\n'),
      'src/geometrie/texte.js': 'export const tronquer = (t) => t;\n',
    };
    assert.deepEqual(avecArbre(fichiers, releverFrontiere), [
      'src/geometrie/vue.js:1 import ../interface/x.js',
      'src/geometrie/vue.js:2 import ../application/y.js',
      'src/geometrie/vue.js:3 import ../stockage/document.js',
      'src/geometrie/vue.js:4 import svelte',
      'src/geometrie/vue.js:5 import svelte/store',
      'src/geometrie/vue.js:6 import electron',
      'src/geometrie/vue.js:7 import @capacitor/core',
    ]);
  });

  test("src/interface n'importe que svelte, ses propres modules, l'application et la géométrie ; elle lit les blocs de script de ses composants, et ne parcourt pas les frontières admises", () => {
    const fichiers = {
      ...MODULES_VIDES,
      // Les trois composants de l'arbre d'épreuve du plan : deux bibliothèques
      // de dessin, le stockage en direct, puis l'application qui importe le
      // moteur, admise.
      'src/interface/plan/Zoom.svelte': [
        '<script>',
        // Un paquet non déclaré s'interpole : la garde des dépendances lit
        // ce fichier.
        `  import { zoom } from ${JSON.stringify('d3-zoom')};`,
        `  import Konva from ${JSON.stringify('konva')};`,
        '</script>',
        '<svg data-plan></svg>',
      ].join('\n'),
      'src/interface/accueil/Liste.svelte': [
        '<script>',
        "  import { lireDepot } from '../../stockage/depot.js';",
        '</script>',
      ].join('\n'),
      'src/interface/generation/Lancer.svelte': [
        '<script>',
        "  import { lancer } from '../../application/generation.js';",
        "  import { onMount } from 'svelte';",
        "  import { writable } from 'svelte/store';",
        '</script>',
        "<p>import {'{'} faux {'}'} from '../../csv/texte.js';</p>",
      ].join('\n'),
      'src/application/generation.js': "import { rechercher } from '../moteur/recherche.js';\nimport { decouper } from '../csv/lecture.js';\n",
      'src/moteur/recherche.js': 'export const rechercher = () => [];\n',
      'src/csv/lecture.js': 'export const decouper = () => [];\n',
      // L'interface atteint le CSV par l'application, non en direct.
      'src/interface/import/modele.js': [
        "import { exporter } from '../../application/csv.js';",
        "import { decouper } from '../../csv/lecture.js';",
        "import { centre } from '../../geometrie/vue.js';",
        "import Fiche from './Fiche.svelte';",
        "import { voisin } from './voisin';",
        "/** @param {import('../../stockage/types.js').Charge} charge */",
      ].join('\n'),
      'src/application/csv.js': "import { decouper } from '../csv/lecture.js';\n",
      // La géométrie n'est pas parcourue depuis l'interface : sa propre garde
      // relève son import du moteur.
      'src/geometrie/vue.js': "import { rechercher } from '../moteur/recherche.js';\n",
      // Un composant importé se parcourt, bloc de module compris ; une
      // épreuve de l'interface ne se parcourt pas.
      'src/interface/import/Fiche.svelte': [
        '<script module>',
        "  import { PCG } from '../../demo/prng.js';",
        '</script>',
        '<script>',
        "  import { readFileSync } from 'node:fs';",
        "  import { aide } from '../../../test/aide.js';",
        "  import { mesurer } from '../../moteur/indicateurs.js';",
        "  import { ipcRenderer } from 'electron';",
        '</script>',
      ].join('\n'),
      'src/interface/import/modele.test.js': `import { lireDepot } from '../../stockage/depot.js';\nimport ${JSON.stringify('jsdom')};\n`,
      'src/interface/import/Import.navigateur.test.js': "import { page } from 'vitest/browser';\n",
      // Un module hors des couches se parcourt depuis l'interface, et un
      // composant qu'il importe aussi.
      'src/interface/a.js': "import { outil } from '../commun/outil.js';\n",
      'src/commun/outil.js': "import Calque from './Calque.svelte';\nexport const outil = Calque;\n",
      'src/commun/Calque.svelte': "<script>\n  import { noms } from '../stockage/noms.js';\n</script>\n",
    };
    assert.deepEqual(avecArbre(fichiers, releverFrontiere), [
      'src/geometrie/vue.js:1 import ../moteur/recherche.js',
      'src/interface/import/modele.js:2 import ../../csv/lecture.js',
      'src/interface/import/modele.js:5 import ./voisin sans extension',
      'src/interface/import/modele.js:6 import ../../stockage/types.js',
      'src/interface/accueil/Liste.svelte:2 import ../../stockage/depot.js',
      'src/interface/import/Fiche.svelte:2 import ../../demo/prng.js',
      'src/interface/import/Fiche.svelte:5 import node:fs',
      'src/interface/import/Fiche.svelte:6 import ../../../test/aide.js',
      'src/interface/import/Fiche.svelte:7 import ../../moteur/indicateurs.js',
      'src/interface/import/Fiche.svelte:8 import electron',
      'src/interface/plan/Zoom.svelte:2 import d3-zoom',
      'src/interface/plan/Zoom.svelte:3 import konva',
      'src/interface/a.js → src/commun/outil.js → src/commun/Calque.svelte:2 import ../stockage/noms.js',
    ]);
  });

  test('ni le moteur, ni la géométrie, ni le générateur de démonstrations ne lisent la version engendrée (§ 14.7, § 18.5) ; l’interface et l’application la lisent ; le générateur n’importe ni l’interface, ni l’application, ni une plateforme, ni le navigateur', () => {
    const fichiers = {
      ...MODULES_VIDES,
      'src/version.genere.js': "export const VERSION = Object.freeze({ affichee: '', technique: '' });\n",
      'src/moteur/recherche.js': "import { VERSION } from '../version.genere.js';\n",
      'src/geometrie/sous/vue.js': "import { VERSION } from '../../version.genere.js';\n",
      'src/demo/catalogue.js': [
        "import { VERSION } from '../version.genere.js';",
        "import { ErreurConfiguration } from '../moteur/erreurs.js';",
        "import { serialiser } from '../stockage/canonique.js';",
        "import { t } from '../application/traduction.js';",
        "import { x } from '../interface/x.js';",
        "import { mount } from 'svelte';",
        "import { readFileSync } from 'node:fs';",
        'export const langue = navigator.language;',
      ].join('\n'),
      'src/demo/livrees.js': "import { CATALOGUE } from './catalogue.js';\nimport petite from './livrees/petite.gtt.json' with { type: 'json' };\n",
      'src/moteur/erreurs.js': 'export class ErreurConfiguration extends Error {}\n',
      'src/stockage/canonique.js': "import { VERSION } from '../version.genere.js';\nexport const serialiser = () => VERSION;\n",
      'src/application/a.js': "import { VERSION } from '../version.genere.js';\n",
      'src/interface/App.svelte': "<script>\n  import { VERSION } from '../version.genere.js';\n</script>\n",
    };
    assert.deepEqual(avecArbre(fichiers, releverFrontiere), [
      'src/moteur/recherche.js:1 import ../version.genere.js',
      'src/geometrie/sous/vue.js:1 import ../../version.genere.js',
      'src/demo/catalogue.js:1 import ../version.genere.js',
      'src/demo/catalogue.js:4 import ../application/traduction.js',
      'src/demo/catalogue.js:5 import ../interface/x.js',
      'src/demo/catalogue.js:6 import svelte',
      'src/demo/catalogue.js:7 import node:fs',
      'src/demo/catalogue.js:8 navigator.',
      'src/demo/catalogue.js → src/stockage/canonique.js:1 import ../version.genere.js',
    ]);
  });

  test('un import() du gabarit d’un composant se relève comme celui d’un bloc de script ; le mot « import » d’un nœud de texte non', () => {
    const fichiers = {
      ...MODULES_VIDES,
      'src/interface/APropos.svelte': [
        '<script>',
        "  import { apropos } from './apropos.js';",
        '</script>',
        "<p>import('../stockage/texte.js') reste du texte</p>",
        "{#await import('../stockage/depot.js') then depot}{/await}",
        '{#if apropos}',
        "  <button onclick={() => import('../moteur/recherche.js')}>{apropos}</button>",
        '{/if}',
      ].join('\n'),
      'src/interface/apropos.js': 'export const apropos = 1;\n',
    };
    assert.deepEqual(avecArbre(fichiers, releverFrontiere), [
      'src/interface/APropos.svelte:5 import ../stockage/depot.js',
      'src/interface/APropos.svelte:7 import ../moteur/recherche.js',
    ]);
  });

  test('src/application peut manquer ; un src/moteur, un src/geometrie, un src/demo, un src/stockage, un src/csv ou un src/interface sans module fait échouer la garde ; un composant seul suffit à l’interface', () => {
    assert.deepEqual(avecArbre(MODULES_VIDES, releverFrontiere), []);
    const composantSeul = { ...sansArbre(MODULES_VIDES, 'src/interface'), 'src/interface/App.svelte': '<p></p>\n' };
    assert.deepEqual(avecArbre(composantSeul, releverFrontiere), []);
    for (const arbre of ['src/moteur', 'src/geometrie', 'src/demo', 'src/stockage', 'src/csv', 'src/interface']) {
      const sansModule = { ...sansArbre(MODULES_VIDES, arbre), [`${arbre}/a.test.js`]: '' };
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

// Les paquets de développement, liste fermée : ceux de l'outillage, puis
// ceux des sorties — pdf-lib et fontkit, que la page incorpore pour la
// planche, pdfjs-dist, outil d'épreuve qui relit le PDF (§ 11.1, § 17,
// point 2). Le projet n'a aucune dépendance d'exécution : Vite incorpore ce
// que la page importe. Les paquets des sorties sont épinglés à une version
// exacte, et ni eux ni ce qu'ils tirent ne portent de script d'installation.
const DEPENDANCES_DE_DEVELOPPEMENT = [
  '@capacitor/cli',
  '@capacitor/core',
  '@pdf-lib/fontkit',
  '@sveltejs/vite-plugin-svelte',
  '@vitest/browser-playwright',
  '@vitest/coverage-v8',
  'electron',
  'electron-builder',
  'fast-check',
  'pdf-lib',
  'pdfjs-dist',
  'playwright',
  'svelte',
  'vite',
  'vitest',
];
const PAQUETS_EPINGLES = ['pdf-lib', '@pdf-lib/fontkit', 'pdfjs-dist'];
const SCRIPTS_ADMIS = { 'electron-winstaller': false };
const VERSION_EXACTE = /^\d+\.\d+\.\d+$/;

// Le chemin, dans les paquets du verrou, du paquet nom que tire l'entrée
// située en depuis : node_modules imbriqués d'abord, en remontant, comme
// Node le résout ; null quand le verrou ne le porte pas.
function cheminDansLeVerrou(paquets, depuis, nom) {
  for (let base = depuis; ; ) {
    const chemin = `${base === '' ? '' : `${base}/`}node_modules/${nom}`;
    if (Object.hasOwn(paquets, chemin)) return chemin;
    if (base === '') return null;
    const coupe = base.lastIndexOf('/node_modules/');
    base = coupe === -1 ? '' : base.slice(0, coupe);
  }
}

// Relevé des paquets déclarés : chaque paquet de devDependencies hors de la
// liste fermée, « devDependencies nom : hors de la liste » ; chaque paquet
// de la liste qui manque, « devDependencies nom : absent » ; chaque paquet de
// dependencies ; chaque paquet épinglé dont la version n'est pas exacte ;
// allowScripts qui diffère de SCRIPTS_ADMIS ; puis chaque entrée du verrou
// que tirent les paquets épinglés, à toute profondeur, dépendances
// facultatives comprises, et qui porte un script d'installation.
function releverPaquetsDeclares(racine, liste = DEPENDANCES_DE_DEVELOPPEMENT) {
  const paquet = JSON.parse(readFileSync(join(racine, 'package.json'), 'utf8'));
  const declares = Object.keys(paquet.devDependencies ?? {}).sort();
  const refus = [
    ...declares.filter((nom) => !liste.includes(nom)).map((nom) => `devDependencies ${nom} : hors de la liste`),
    ...liste.filter((nom) => !declares.includes(nom)).map((nom) => `devDependencies ${nom} : absent`),
    ...Object.keys(paquet.dependencies ?? {}).sort().map((nom) => `dependencies ${nom}`),
    ...PAQUETS_EPINGLES.filter((nom) => nom in (paquet.devDependencies ?? {}))
      .filter((nom) => !VERSION_EXACTE.test(paquet.devDependencies[nom]))
      .map((nom) => `devDependencies ${nom} : ${paquet.devDependencies[nom]} n'est pas une version exacte`),
  ];
  if (JSON.stringify(paquet.allowScripts ?? {}) !== JSON.stringify(SCRIPTS_ADMIS)) {
    refus.push(`allowScripts : ${JSON.stringify(paquet.allowScripts ?? {})}`);
  }
  const { packages: paquets = {} } = JSON.parse(readFileSync(join(racine, 'package-lock.json'), 'utf8'));
  const vus = new Set();
  const aParcourir = PAQUETS_EPINGLES.map((nom) => cheminDansLeVerrou(paquets, '', nom)).filter((c) => c !== null);
  for (let i = 0; i < aParcourir.length; i += 1) {
    const chemin = aParcourir[i];
    if (vus.has(chemin)) continue;
    vus.add(chemin);
    const entree = paquets[chemin];
    if (entree.hasInstallScript) refus.push(`${chemin} : script d'installation`);
    for (const nom of Object.keys({ ...entree.dependencies, ...entree.optionalDependencies }).sort()) {
      const cible = cheminDansLeVerrou(paquets, chemin, nom);
      if (cible !== null) aParcourir.push(cible);
    }
  }
  assert.ok(vus.size > 0, 'aucun paquet épinglé dans le verrou');
  return refus;
}

// Les paquets réservés à une place : chacun ne se charge que sous les arbres
// admis, relatifs à la racine. pdf-lib et fontkit dessinent la planche dans
// src/pdf, seule couche de la page qui les importe ; les épreuves les
// relisent. pdfjs-dist, lecteur qui relit le PDF comme un lecteur réel, ne
// sert qu'aux épreuves et aux commandes de Vitest, sous test/ : un module
// livré qui l'importerait l'emporterait dans la page.
const PAQUETS_RESERVES = [
  { paquets: ['pdf-lib', '@pdf-lib/fontkit'], admis: ['src/pdf', 'test'] },
  { paquets: ['pdfjs-dist'], admis: ['test'] },
];

// Relevé « fichier:ligne spécificateur » des chargements d'un paquet
// réservé hors de ses arbres admis, dans le périmètre des dépendances
// (sourcesDuProjet), par fichier puis par ligne. Un chargement écrit dans
// une chaîne, donnée d'épreuve, n'en est pas un. Lève quand le périmètre ne
// porte aucun fichier.
function releverPaquetsReserves(racine, reserves = PAQUETS_RESERVES) {
  const fichiers = sourcesDuProjet(racine);
  assert.ok(fichiers.length > 0, 'aucun fichier source');
  return fichiers.flatMap((fichier) => {
    const nom = enBarres(racine, fichier);
    const texte = readFileSync(fichier, 'utf8');
    const code = codeSansChaines(fichier, texte);
    return chargementsLitteraux(texte)
      .filter(({ indice, specificateur }) => estDuCode(code, indice) && estNu(specificateur))
      .filter(({ specificateur }) => {
        const reserve = reserves.find(({ paquets }) => paquets.includes(nomDePaquet(specificateur)));
        return reserve !== undefined && !reserve.admis.some((arbre) => nom.startsWith(`${arbre}/`));
      })
      .map(({ indice, specificateur }) => `${nom}:${ligneDe(texte, indice)} ${specificateur}`);
  });
}

// Les couches que seuls des importateurs nommés chargent, hors de leurs
// propres fichiers : la police, que src/main.js et le montage des épreuves
// passent à App ; l'impression, frontière de plateforme que src/main.js
// choisit (§ 13.4).
const IMPORTATEURS_RESERVES = [
  { arbre: 'src/polices', importateurs: ['src/main.js', 'test/navigateur/montage.js'] },
  { arbre: 'src/impression', importateurs: ['src/main.js'] },
];

// Relevé « fichier:ligne spécificateur » des chargements d'un fichier d'un
// arbre réservé par un fichier qui n'est ni de cet arbre ni l'un de ses
// importateurs, dans le périmètre des dépendances ; le suffixe de Vite se
// retire, et un type que la JSDoc importe compte. Lève quand le périmètre ne
// porte aucun fichier.
function releverImportateursReserves(racine, reserves = IMPORTATEURS_RESERVES) {
  const fichiers = sourcesDuProjet(racine);
  assert.ok(fichiers.length > 0, 'aucun fichier source');
  return fichiers.flatMap((fichier) => {
    const nom = enBarres(racine, fichier);
    const texte = readFileSync(fichier, 'utf8');
    const code = codeSansChaines(fichier, texte);
    return chargementsLitteraux(texte)
      .filter(({ indice }) => estDuCode(code, indice))
      .filter(({ specificateur }) => {
        const cible = cibleDe(racine, fichier, specificateur.replace(/\?.*$/, ''));
        if (cible === null) return false;
        const vise = enBarres(racine, cible);
        return reserves.some(
          ({ arbre, importateurs }) =>
            vise.startsWith(`${arbre}/`) && !nom.startsWith(`${arbre}/`) && !importateurs.includes(nom),
        );
      })
      .map(({ indice, specificateur }) => `${nom}:${ligneDe(texte, indice)} ${specificateur}`);
  });
}

// Les variantes de placements.js qui lisent un placement sans le valider :
// evaluation.js seul les appelle, après avoir validé le placement une fois
// par fautes ; tout autre appelant passe par planDepuisFichier et derive,
// qui valident. Le relevé lit leurs noms, mots entiers, dans le code des
// sources du projet — chaînes comprises, commentaires exclus —, hors de
// leurs porteurs et des épreuves.
const PORTEURS_SANS_REVALIDATION = ['src/stockage/placements.js', 'src/application/evaluation.js'];
const NOM_SANS_REVALIDATION = /\b(?:planSansRevalider|deriveSansRevalider)\b/g;

// Relevé « fichier:ligne nom » des variantes sans validation nommées hors de
// leurs porteurs, par fichier puis par ligne ; puis « porteur sans objet :
// fichier » pour un porteur qui ne les nomme plus. Lève quand le périmètre
// ne porte aucun fichier.
function releverSansRevalidation(racine, porteurs = PORTEURS_SANS_REVALIDATION) {
  const fichiers = sourcesDuProjet(racine).filter((f) => !EPREUVE.test(f));
  assert.ok(fichiers.length > 0, 'aucun fichier source');
  const servis = new Set();
  const releve = fichiers.flatMap((fichier) => {
    const nom = enBarres(racine, fichier);
    const texte = readFileSync(fichier, 'utf8');
    const trouves = [...texteSansCommentaires(fichier, texte).matchAll(NOM_SANS_REVALIDATION)];
    if (porteurs.includes(nom)) {
      if (trouves.length > 0) servis.add(nom);
      return [];
    }
    return trouves.map(({ 0: variante, index }) => `${nom}:${ligneDe(texte, index)} ${variante}`);
  });
  const sansObjet = porteurs.filter((p) => !servis.has(p)).map((p) => `porteur sans objet : ${p}`);
  return [...releve, ...sansObjet];
}

// Le nom d'un papier, que seul src/geometrie/papiers.js définit (§ 13.2) :
// le stockage, l'application, l'imposition et l'impression tirent leur
// domaine de PAPIERS. Le relevé lit « Lettre », mot entier, dans le code
// des modules et des composants de src/ — chaînes, gabarits, noms et
// balisage compris, commentaires exclus —, hors de papiers.js, des tables
// de libellés, qui portent le texte affiché, et des épreuves.
const PORTEURS_DES_NOMS_DE_PAPIER = ['src/geometrie/papiers.js'];
const NOM_DE_PAPIER = /\bLettre\b/g;

// Le texte d'un code JavaScript où chaque commentaire devient blanc, fins de
// ligne gardées, chaînes intactes : les commentaires se repèrent dans le
// texte sans chaînes (sansChaines), où une chaîne n'en ouvre aucun.
function sansCommentaires(texte) {
  const blancs = texte.split('');
  for (const { 0: commentaire, index } of sansChaines(texte).matchAll(/\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/g)) {
    for (let i = index; i < index + commentaire.length; i += 1) if (blancs[i] !== '\n') blancs[i] = ' ';
  }
  return blancs.join('');
}

// Le texte d'un module sans ses commentaires ; d'un composant Svelte, sans
// ses commentaires HTML ni ceux de ses blocs de script.
function texteSansCommentaires(fichier, texte) {
  if (extname(fichier) !== '.svelte') return sansCommentaires(texte);
  let sortie = texte.replace(/<!--[\s\S]*?(?:-->|$)/g, (commentaire) => commentaire.replace(/[^\n]/g, ' '));
  for (const { debut, fin } of blocsScript(sortie)) {
    sortie = sortie.slice(0, debut) + sansCommentaires(sortie.slice(debut, fin)) + sortie.slice(fin);
  }
  return sortie;
}

// Relevé « fichier:ligne Lettre » des noms de papier hors de leurs porteurs,
// par fichier puis par ligne ; puis « porteur sans objet : fichier » pour un
// porteur qui ne nomme plus aucun papier. Lève quand src/ ne porte aucun
// module.
function releverNomsDePapier(racine, porteurs = PORTEURS_DES_NOMS_DE_PAPIER) {
  const fichiers = fichiersDe(join(racine, 'src'))
    .filter((f) => (EXTENSIONS_MODULE.has(extname(f)) || extname(f) === '.svelte') && !EPREUVE.test(f))
    .sort();
  assert.ok(fichiers.length > 0, 'src ne fournit aucun module');
  const servis = new Set();
  const releve = fichiers.flatMap((fichier) => {
    const nom = enBarres(racine, fichier);
    if (TABLE_DE_LIBELLES.test(nom)) return [];
    const texte = readFileSync(fichier, 'utf8');
    const trouves = [...texteSansCommentaires(fichier, texte).matchAll(NOM_DE_PAPIER)];
    if (porteurs.includes(nom)) {
      if (trouves.length > 0) servis.add(nom);
      return [];
    }
    return trouves.map(({ index }) => `${nom}:${ligneDe(texte, index)} Lettre`);
  });
  const sansObjet = porteurs.filter((p) => !servis.has(p)).map((p) => `porteur sans objet : ${p}`);
  return [...releve, ...sansObjet];
}

describe('arborescence : la validation des placements (§ 8.9)', () => {
  test('planSansRevalider et deriveSansRevalider ne se nomment que dans placements.js, evaluation.js et les épreuves', () => {
    assert.deepEqual(releverSansRevalidation(RACINE), []);
  });

  test('la garde des variantes sans validation relève un import, un appel ou une chaîne hors de leurs porteurs, script et composant compris ; commentaires et épreuves passent ; un porteur muet est sans objet', () => {
    const porteurs = {
      'src/stockage/placements.js': 'export function planSansRevalider(p) {}\nexport function deriveSansRevalider(p, c) {}\n',
      'src/application/evaluation.js': "import { deriveSansRevalider, planSansRevalider } from '../stockage/placements.js';\n",
    };
    const fichiers = {
      ...porteurs,
      'src/application/places.js': [
        '// planSansRevalider, dans un commentaire',
        "import { planSansRevalider } from '../stockage/placements.js';",
        'const plan = planSansRevalider(p);',
      ].join('\n'),
      'src/interface/Plan.svelte': ['<script>', "  const nom = 'deriveSansRevalider';", '</script>'].join('\n'),
      'scripts/outil.js': "import { deriveSansRevalider } from '../src/stockage/placements.js';\n",
      'src/application/evaluation.test.js': "import { planSansRevalider } from '../stockage/placements.js';\n",
      'src/application/derive.js': 'const planSansRevaliderAutre = 1;\n',
    };
    assert.deepEqual(avecArbre(fichiers, releverSansRevalidation), [
      'scripts/outil.js:1 deriveSansRevalider',
      'src/application/places.js:2 planSansRevalider',
      'src/application/places.js:3 planSansRevalider',
      'src/interface/Plan.svelte:2 deriveSansRevalider',
    ]);
    const muet = { 'src/stockage/placements.js': porteurs['src/stockage/placements.js'], 'src/application/evaluation.js': '\n' };
    assert.deepEqual(avecArbre(muet, releverSansRevalidation), ['porteur sans objet : src/application/evaluation.js']);
  });
});

describe('arborescence : les sorties — PDF, impression, police (§ 11.1, § 13.4, § 17 point 2)', () => {
  test('les paquets de développement sont ceux de la liste fermée, les trois paquets des sorties épinglés exacts, sans script d’installation ; aucune dépendance d’exécution', () => {
    assert.deepEqual(releverPaquetsDeclares(RACINE), []);
  });

  test('la garde des paquets déclarés relève un paquet de plus, un paquet manquant, une version non exacte, une dépendance d’exécution, allowScripts changé et un script d’installation tiré par un paquet épinglé', () => {
    const verrou = {
      packages: {
        '': {},
        'node_modules/pdf-lib': { dependencies: { pako: '^1.0.11', tslib: '^1.11.1' } },
        'node_modules/pdf-lib/node_modules/tslib': { hasInstallScript: true },
        'node_modules/tslib': {},
        'node_modules/pako': {},
        'node_modules/pdfjs-dist': { optionalDependencies: { canevas: '1.0.0' } },
        'node_modules/canevas': { hasInstallScript: true },
        'node_modules/sans-rapport': { hasInstallScript: true },
      },
    };
    const fichiers = {
      'package.json': JSON.stringify({
        dependencies: { 'pdf-lib': '1.17.1' },
        devDependencies: { vite: '^8.3.2', 'pdf-lib': '^1.17.1', 'pdfjs-dist': '6.4.299', 'outil-de-trop': '1.0.0' },
        allowScripts: { 'electron-winstaller': false, canevas: true },
      }),
      'package-lock.json': JSON.stringify(verrou),
    };
    assert.deepEqual(
      avecArbre(fichiers, (racine) => releverPaquetsDeclares(racine, ['vite', 'pdf-lib', 'pdfjs-dist', 'svelte'])),
      [
        'devDependencies outil-de-trop : hors de la liste',
        'devDependencies svelte : absent',
        'dependencies pdf-lib',
        "devDependencies pdf-lib : ^1.17.1 n'est pas une version exacte",
        'allowScripts : {"electron-winstaller":false,"canevas":true}',
        "node_modules/pdf-lib/node_modules/tslib : script d'installation",
        "node_modules/canevas : script d'installation",
      ],
    );
  });

  test('pdf-lib et fontkit ne se chargent que sous src/pdf et test/, pdfjs-dist que sous test/', () => {
    assert.deepEqual(releverPaquetsReserves(RACINE), []);
  });

  test('la garde des paquets réservés relève src/interface ou src/application qui importent pdf-lib, et un module livré qui importe pdfjs-dist ; une chaîne n’est pas un chargement', () => {
    const fichiers = {
      'src/interface/Badges.svelte': "<script>\n  import { PDFDocument } from 'pdf-lib';\n</script>\n",
      'src/application/planche.js': [
        "import fontkit from '@pdf-lib/fontkit';",
        "const lecteur = await import('pdfjs-dist/legacy/build/pdf.mjs');",
        "const exemple = \"import 'pdf-lib'\";",
      ].join('\n'),
      'src/pdf/planche.js': "import { PDFDocument } from 'pdf-lib';\nimport fontkit from '@pdf-lib/fontkit';\n",
      'src/pdf/planche.test.js': "import { getDocument } from 'pdfjs-dist';\n",
      'scripts/documentation/tramer.js': "import { getDocument } from 'pdfjs-dist';\n",
      'electron/impression.js': "const { PDFDocument } = require('pdf-lib');\n",
      'test/pdf.js': "import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';\nimport { PDFDocument } from 'pdf-lib';\n",
      'vite.config.js': "import { defineConfig } from 'vite';\n",
    };
    assert.deepEqual(avecArbre(fichiers, releverPaquetsReserves), [
      'electron/impression.js:1 pdf-lib',
      'scripts/documentation/tramer.js:1 pdfjs-dist',
      'src/application/planche.js:1 @pdf-lib/fontkit',
      'src/application/planche.js:2 pdfjs-dist/legacy/build/pdf.mjs',
      'src/interface/Badges.svelte:2 pdf-lib',
      'src/pdf/planche.test.js:1 pdfjs-dist',
    ]);
  });

  test('src/polices ne se charge que par src/main.js et le montage des épreuves, src/impression que par src/main.js', () => {
    assert.deepEqual(releverImportateursReserves(RACINE), []);
  });

  test('la garde des importateurs relève une autre couche, une épreuve ou un script qui chargent la police ou l’impression, type JSDoc compris ; leurs propres fichiers et les importateurs nommés passent', () => {
    const fichiers = {
      'src/main.js': [
        "import { chargerPolices } from './polices/chargement.js';",
        "import { creerImprimanteWeb } from './impression/imprimante_web.js';",
      ].join('\n'),
      'test/navigateur/montage.js': [
        "import { chargerPolices } from '../../src/polices/chargement.js';",
        "import { creerImprimanteWeb } from '../../src/impression/imprimante_web.js';",
      ].join('\n'),
      'src/polices/chargement.js': "const r = () => import('./regulier.js');\n",
      'src/polices/regulier.js': "export { default } from './NotoSans-Regular.ttf?inline';\n",
      'src/polices/chargement.navigateur.test.js': "import { chargerPolices } from './chargement.js';\n",
      'src/interface/App.svelte': [
        '<script>',
        "  /** @type {import('../impression/imprimante_web.js').Imprimante} */",
        '  let imprimante;',
        '</script>',
      ].join('\n'),
      'src/application/planche_seance.js': "const polices = () => import('../polices/chargement.js');\n",
      'scripts/banc/police.js': "import regulier from '../../src/polices/NotoSans-Regular.ttf?inline';\n",
      'test/aide.js': "const texte = \"import x from '../src/polices/chargement.js'\";\n",
    };
    assert.deepEqual(avecArbre(fichiers, releverImportateursReserves), [
      'scripts/banc/police.js:1 ../../src/polices/NotoSans-Regular.ttf?inline',
      'src/application/planche_seance.js:1 ../polices/chargement.js',
      'src/interface/App.svelte:2 ../impression/imprimante_web.js',
      'test/navigateur/montage.js:2 ../../src/impression/imprimante_web.js',
    ]);
  });

  test('hors de src/geometrie/papiers.js, des tables de libellés et des épreuves, aucun code de src/ ne nomme le papier Lettre', () => {
    assert.deepEqual(releverNomsDePapier(RACINE), []);
  });

  test('la garde des noms de papier relève chaîne, gabarit, nom et balisage, à toute profondeur ; commentaires, mots voisins, libellés et épreuves passent ; un porteur muet est sans objet', () => {
    const fichiers = {
      'src/geometrie/papiers.js': "export const PAPIERS = { A4: {}, Lettre: {} };\n",
      'src/stockage/reglages_locaux.js': [
        "const PAPIERS = ['A4', 'Lettre'];",
        '// le papier Lettre se lit ici dans un commentaire',
        '/** @property {null|\'A4\'|\'Lettre\'} papier */',
        'const message = `papier ${a} ou Lettre`;',
        'export const lettres = 1, Lettres = 2, uneLettre = 3;',
      ].join('\n'),
      'src/impression/sous/papier.js': 'export const lettre = PAPIERS.Lettre;\n',
      'src/interface/Papier.svelte': [
        '<!-- Lettre, dans un commentaire HTML -->',
        '<script>',
        '  // Lettre, dans un commentaire de script',
        "  const choix = 'Lettre';",
        '</script>',
        '<p>Lettre</p>',
      ].join('\n'),
      'src/interface/libelles/papier.js': "export const LIBELLES = { lettre: 'Lettre' };\n",
      'src/application/planche.test.js': "const papier = 'Lettre';\n",
    };
    assert.deepEqual(avecArbre(fichiers, releverNomsDePapier), [
      'src/impression/sous/papier.js:1 Lettre',
      'src/interface/Papier.svelte:4 Lettre',
      'src/interface/Papier.svelte:6 Lettre',
      'src/stockage/reglages_locaux.js:1 Lettre',
      'src/stockage/reglages_locaux.js:4 Lettre',
    ]);
    const muet = { 'src/geometrie/papiers.js': 'export const PAPIERS = {};\n' };
    assert.deepEqual(avecArbre(muet, releverNomsDePapier), ['porteur sans objet : src/geometrie/papiers.js']);
  });

  test('src/pdf n’importe que ses modules, pdf-lib, fontkit, constantes.js et papiers.js, et ne touche pas le navigateur', () => {
    const fichiers = {
      ...MODULES_VIDES,
      'src/pdf/planche.js': [
        "import { PDFDocument } from 'pdf-lib';",
        "import fontkit from '@pdf-lib/fontkit';",
        "import { constante } from '../geometrie/constantes.js';",
        "import { PAPIERS } from '../geometrie/papiers.js';",
        "import { mettreEnPage } from './mise_en_page.js';",
        "import { modelePlanche } from '../application/planche.js';",
        "import { englobant } from '../geometrie/tables.js';",
        "import { getDocument } from 'pdfjs-dist';",
        "import { mount } from 'svelte';",
        "import { readFileSync } from 'node:fs';",
        'export const corps = () => document.body;',
        "import { VERSION } from '../version.genere.js';",
      ].join('\n'),
      'src/pdf/mise_en_page.js': "export const mettreEnPage = () => window.devicePixelRatio;\n",
      'src/pdf/planche.test.js': "import { modelePlanche } from '../application/planche.js';\nexport const c = document.body;\n",
      'src/application/planche.js': 'export const modelePlanche = () => null;\n',
      'src/geometrie/tables.js': 'export const englobant = () => null;\n',
      'src/geometrie/constantes.js': 'export const constante = () => 8;\n',
      'src/geometrie/papiers.js': 'export const PAPIERS = {};\n',
    };
    assert.deepEqual(avecArbre(fichiers, releverFrontiere), [
      'src/pdf/mise_en_page.js:1 window.',
      'src/pdf/planche.js:6 import ../application/planche.js',
      'src/pdf/planche.js:7 import ../geometrie/tables.js',
      'src/pdf/planche.js:8 import pdfjs-dist',
      'src/pdf/planche.js:9 import svelte',
      'src/pdf/planche.js:10 import node:fs',
      'src/pdf/planche.js:11 document.',
      'src/pdf/planche.js:12 import ../version.genere.js',
    ]);
  });

  test('src/impression n’importe que papiers.js et aucun paquet, et touche le navigateur ; src/polices n’importe que ses fichiers', () => {
    const fichiers = {
      ...MODULES_VIDES,
      'src/impression/imprimante_web.js': [
        "import { PAPIERS } from '../geometrie/papiers.js';",
        "import { decouperPlan } from '../geometrie/pages.js';",
        "import { estBrouillon } from '../application/sorties.js';",
        "import { ipcRenderer } from 'electron';",
        'export const imprimer = () => window.print();',
      ].join('\n'),
      'src/polices/chargement.js': [
        "export const regulier = () => import('./regulier.js');",
        "import { t } from '../interface/libelles.js';",
        "import { mount } from 'svelte';",
        "export const attendre = () => document.fonts.ready;",
      ].join('\n'),
      'src/polices/regulier.js': "export { default } from './NotoSans-Regular.ttf?inline';\n",
      'src/geometrie/papiers.js': 'export const PAPIERS = {};\n',
      'src/geometrie/pages.js': 'export const decouperPlan = () => null;\n',
      'src/application/sorties.js': 'export const estBrouillon = () => true;\n',
      'src/interface/libelles.js': 'export const t = () => "";\n',
    };
    assert.deepEqual(avecArbre(fichiers, releverFrontiere), [
      'src/impression/imprimante_web.js:2 import ../geometrie/pages.js',
      'src/impression/imprimante_web.js:3 import ../application/sorties.js',
      'src/impression/imprimante_web.js:4 import electron',
      'src/polices/chargement.js:2 import ../interface/libelles.js',
      'src/polices/chargement.js:3 import svelte',
    ]);
  });

  test('ni l’interface ni une couche du cœur n’importent les sorties ; l’application importe src/pdf sans le parcourir, jamais l’impression ni la police', () => {
    const fichiers = {
      ...MODULES_VIDES,
      'src/interface/Badges.svelte': [
        '<script>',
        "  import { cellules } from '../pdf/imposition.js';",
        "  import { PDFDocument } from 'pdf-lib';",
        '</script>',
      ].join('\n'),
      'src/geometrie/vue.js': "import { cellules } from '../pdf/imposition.js';\n",
      'src/stockage/noms.js': "import { PAPIERS } from '../impression/papiers.js';\n",
      'src/application/planche.js': [
        "const production = () => import('../pdf/planche.js');",
        "import { chargerPolices } from '../polices/chargement.js';",
        "import { creerImprimanteWeb } from '../impression/imprimante_web.js';",
      ].join('\n'),
      'src/pdf/planche.js': "import { PDFDocument } from 'pdf-lib';\n",
      'src/pdf/imposition.js': 'export const cellules = () => [];\n',
    };
    assert.deepEqual(avecArbre(fichiers, releverFrontiere), [
      'src/geometrie/vue.js:1 import ../pdf/imposition.js',
      'src/stockage/noms.js:1 import ../impression/papiers.js',
      'src/application/planche.js:2 import ../polices/chargement.js',
      'src/application/planche.js:3 import ../impression/imprimante_web.js',
      'src/interface/Badges.svelte:2 import ../pdf/imposition.js',
      'src/interface/Badges.svelte:3 import pdf-lib',
    ]);
  });

  test('un src/pdf, un src/impression ou un src/polices sans module fait échouer la garde des couches', () => {
    for (const arbre of SORTIES) {
      const sansModule = { ...sansArbre(MODULES_VIDES, arbre), [`${arbre}/a.test.js`]: '' };
      assert.throws(() => avecArbre(sansModule, releverFrontiere), new RegExp(`${arbre} ne fournit aucun module`), arbre);
    }
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

// Modules que le § 14.13 tient à 100 % de branches : les calculs du
// moteur qui décrivent ou bornent un plan, la géométrie des graphiques, les
// chemins de reprise du stockage, les refus et la recopie du départ d'une
// génération dérivée, sa carte et son issue dans la section de la
// génération, le geste « Comparer » d'une ligne du tableau des propositions,
// les colonnes côte à côte et les cas de la vue de comparaison.
const MODULES_A_SEUIL = [
  'src/application/depart.js',
  'src/geometrie/graphique.js',
  'src/interface/generation/depart.js',
  'src/interface/propositions/comparer.js',
  'src/interface/qualite/colonnes.js',
  'src/interface/qualite/comparaison.js',
  'src/moteur/correspondance.js',
  'src/moteur/criteres.js',
  'src/moteur/diversite.js',
  'src/moteur/indicateurs.js',
  'src/moteur/paires.js',
  'src/moteur/plafond.js',
  'src/moteur/qualite.js',
  'src/stockage/depot.js',
  'src/stockage/journal.js',
];

// Clés de coverage.thresholds qui vaudraient pour tous les fichiers mesurés.
const SEUILS_GLOBAUX = ['statements', 'branches', 'functions', 'lines', '100', 'perFile'];

// Vrai quand le chemin relatif répond à l'un des motifs de fichiers donnés.
const repondA = (chemin, motifs = []) => motifs.some((motif) => matchesGlob(chemin, motif));

// La commande de la mesure : make couverture passe la main à npm run
// couverture, qui lance vitest run sur la série node, couverture active, sous
// le seul rapporteur default. Sans --coverage, la série passe et aucun seuil
// ne se lit. Sans --reporter default, vitest.config.js remet
// ./test/rapporteur.js, dont les plafonds de durée (§ 14.14) bornent la
// série surveillée et la série longue, et feraient échouer la série
// instrumentée, plus lente. Le script n'admet rien d'autre que ces trois
// arguments : un second rapporteur, ou un autre, ramènerait ces plafonds ou
// changerait le bilan ; une option --coverage.* redéfinirait, pour cette
// exécution, les seuils, include ou exclude que relève releverCouverture, et
// --changed, --config ou un filtre de fichiers changeraient ce qui se
// mesure. Une option et sa valeur se lisent en un argument : « --project
// node » comme « --project=node ».
const RECETTE_DE_MESURE = '$(AVEC_NODE) npm run couverture';
const ARGUMENTS_REQUIS = ['--project=node', '--coverage', '--reporter=default'];
const ARGUMENT_ADMIS = /^(?:--project=node|--coverage|--reporter=default)$/;
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
// pièce à la fois : les modules nommés, le script de package.json, la recette
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
  test("make couverture et npm run couverture mesurent la série node, sous le seul rapporteur default ; le rapport montre chaque module ; aucun seuil global ; 100 % de branches sur chaque module nommé, présent dans l'arbre et dans la mesure", () => {
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
        'src/application/depart.js': { branches: 100 },
        'src/geometrie/graphique.js': { branches: 100 },
        'src/interface/generation/depart.js': { branches: 100 },
        'src/interface/propositions/comparer.js': { branches: 100 },
        'src/interface/qualite/colonnes.js': { branches: 100 },
        'src/interface/qualite/comparaison.js': { branches: 100 },
        'src/moteur/correspondance.js': { branches: 100 },
        'src/moteur/criteres.js': { branches: 100 },
        'src/moteur/diversite.js': { branches: 100 },
        'src/moteur/indicateurs.js': { branches: 100 },
        'src/moteur/paires.js': { branches: 100 },
        'src/moteur/plafond.js': { branches: 95 },
        'src/moteur/qualite.js': { branches: 100 },
        'src/stockage/journal.js': { branches: 100, lines: 100 },
        'src/csv/**': { branches: 100 },
      },
    };
    const fichiers = {
      ...COMMANDE_CONFORME,
      'src/application/depart.js': '',
      'src/geometrie/graphique.js': '',
      'src/interface/generation/depart.js': '',
      'src/interface/propositions/comparer.js': '',
      'src/interface/qualite/colonnes.js': '',
      'src/interface/qualite/comparaison.js': '',
      'src/moteur/correspondance.js': '',
      'src/moteur/criteres.js': '',
      'src/moteur/diversite.js': '',
      'src/moteur/indicateurs.js': '',
      'src/moteur/paires.js': '',
      'src/moteur/qualite.js': '',
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
      [
        'src/application/depart.js : hors de la mesure',
        'src/geometrie/graphique.js : hors de la mesure',
        'src/interface/generation/depart.js : hors de la mesure',
        'src/interface/propositions/comparer.js : hors de la mesure',
        'src/interface/qualite/colonnes.js : hors de la mesure',
        'src/interface/qualite/comparaison.js : hors de la mesure',
        'src/moteur/correspondance.js : hors de la mesure',
        'src/moteur/criteres.js : hors de la mesure',
        'src/moteur/diversite.js : hors de la mesure',
        'src/moteur/indicateurs.js : hors de la mesure',
        'src/moteur/paires.js : hors de la mesure',
        'src/moteur/qualite.js : hors de la mesure',
        'src/stockage/depot.js : hors de la mesure',
        'src/stockage/journal.js : hors de la mesure',
      ],
    );
    assert.throws(() => releverCouverture(RACINE, undefined), /aucune configuration de couverture/);
  });

  test('la garde relève une commande qui ne mesure pas la série node, qui redéfinit la mesure, ou qui la lance sous un autre rapporteur que default ; make couverture passe par npm run couverture', () => {
    const relever = (fichiers) =>
      avecArbre({ ...MODULES_MESURES, ...COMMANDE_CONFORME, ...fichiers }, (racine) =>
        releverCouverture(racine, COUVERTURE_CONFORME),
      );
    assert.deepEqual(relever({}), []);
    assert.deepEqual(relever({ 'package.json': scriptDeMesure('vitest run --project=node --coverage --reporter default') }), []);
    const scripts = [
      ['vitest run --project node --reporter=default', ['npm run couverture : sans --coverage']],
      [
        'vitest run --project node --coverage --reporter=default --coverage.include=src/moteur/indicateurs.js --coverage.exclude=src/stockage/journal.js',
        [
          'npm run couverture : argument non admis --coverage.include=src/moteur/indicateurs.js',
          'npm run couverture : argument non admis --coverage.exclude=src/stockage/journal.js',
        ],
      ],
      [
        'vitest run --project node-long --coverage --reporter=default',
        ['npm run couverture : sans --project node', 'npm run couverture : argument non admis --project=node-long'],
      ],
      [
        'vitest run --project node --coverage --reporter=default --changed src/moteur',
        ['npm run couverture : argument non admis --changed', 'npm run couverture : argument non admis src/moteur'],
      ],
      ['vitest --project node --coverage', ['npm run couverture : ne lance pas vitest run']],
      ['vitest run --project node --coverage', ['npm run couverture : sans --reporter default']],
      [
        'vitest run --project node --coverage --reporter=./test/rapporteur.js',
        ['npm run couverture : sans --reporter default', 'npm run couverture : argument non admis --reporter=./test/rapporteur.js'],
      ],
      [
        'vitest run --project node --coverage --reporter=default --reporter verbose',
        ['npm run couverture : argument non admis --reporter=verbose'],
      ],
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

// Fichiers du projet, en chemins absolus triés : la racine et ses arbres, à
// toute profondeur, hors des dépendances — node_modules, à toute
// profondeur — et, à la racine, du dépôt git, des sorties de construction et
// de mesure : www, dist-electron, coverage et le cache .vitest.
const HORS_DU_PROJET_A_LA_RACINE = new Set(['.git', 'www', 'dist-electron', 'coverage', '.vitest']);
function fichiersDuProjet(racine) {
  const fichiers = [];
  const parcourir = (dossier) => {
    for (const entree of readdirSync(dossier, { withFileTypes: true })) {
      const chemin = join(dossier, entree.name);
      const exclu = entree.name === 'node_modules' || (dossier === racine && HORS_DU_PROJET_A_LA_RACINE.has(entree.name));
      if (entree.isDirectory() && !exclu) parcourir(chemin);
      else if (entree.isFile()) fichiers.push(chemin);
    }
  };
  parcourir(racine);
  return fichiers.sort();
}

// Chemin relatif à la racine, en barres obliques : la forme que lisent les
// motifs de vitest.config.js, sur tout système.
const enBarres = (racine, fichier) => relative(racine, fichier).split(sep).join('/');

// Le texte d'un fichier où chaque chaîne littérale de code est blanchie
// (sansChaines), indices et lignes gardés. Un composant Svelte n'a de code
// que dans ses blocs de script : chacun est blanchi à part, et le balisage
// reste tel quel.
function codeSansChaines(fichier, texte) {
  if (extname(fichier) !== '.svelte') return sansChaines(texte);
  let sortie = '';
  let fin = 0;
  for (const { debut, fin: finBloc } of blocsScript(texte)) {
    sortie += texte.slice(fin, debut) + sansChaines(texte.slice(debut, finBloc));
    fin = finBloc;
  }
  return sortie + texte.slice(fin);
}

// Vrai quand le chargement relevé à cet indice est du code : son mot-clé —
// from, import ou require — subsiste dans le texte sans ses chaînes. Une
// instruction écrite dans une chaîne, donnée d'épreuve, n'en est pas un.
const estDuCode = (code, indice) => LETTRE_DE_MOT.test(code[indice] ?? '');

// Relevé « fichier:ligne motif » des motifs donnés dans un texte, par ligne
// puis dans l'ordre des motifs ; chaque motif est [nom, expression à g].
const releverMotifs = (nom, texte, motifs) =>
  motifs
    .flatMap(([motif, expression], rang) =>
      [...texte.matchAll(expression)].map(({ index }) => ({ ligne: ligneDe(texte, index), rang, motif })),
    )
    .sort((a, b) => a.ligne - b.ligne || a.rang - b.rang)
    .map(({ ligne, motif }) => `${nom}:${ligne} ${motif}`);

// Le pont de la coquille (§ 13.1) : la page n'atteint le processus principal
// que par window.gtt, et deux lecteurs nommés le lisent. Un accès se relève
// par un nom de l'objet global — window, globalThis, self — suivi de
// « .gtt », de « ?.gtt » ou de « ['gtt'] », ou par une déstructuration qui
// en tire gtt. Le relevé à point lit le code sans ses chaînes : le nom d'un
// fichier « ….gtt.json » est une chaîne ; celui à crochet lit le texte
// entier, la chaîne y étant le nom même.
const ACCES_AU_PONT = [
  ['.gtt', /\b(window|globalThis|self)\s*\??\.\s*gtt\b/g, 'code'],
  ["['gtt']", /\b(window|globalThis|self)\s*(?:\?\.)?\s*\[\s*(['"`])gtt\2\s*\]/g, 'texte'],
  ['{ gtt }', /\{[^{}]*\bgtt\b[^{}]*\}\s*=\s*(window|globalThis|self)\b/g, 'code'],
];

// Les deux lecteurs du pont, chacun par son fichier : le relevé admet tout
// accès de son texte.
const LECTEURS_DU_PONT = [
  {
    fichier: join('src', 'main.js'),
    raison: 'choisit la plateforme : construit le système de fichiers et le presse-papiers de la coquille',
  },
  {
    fichier: join('src', 'stockage', 'fichiers_electron.js'),
    raison: 'son paramètre par défaut lit window.gtt.fichiers ; nul ne l’importe hors de src/main.js',
  },
];

// Relevé « fichier:ligne accès » des accès au pont dans les modules et les
// composants de src/, épreuves exclues, hors des lecteurs nommés ; par
// fichier, par ligne, puis dans l'ordre de ACCES_AU_PONT. Suit une ligne
// « lecteur sans objet : fichier » par lecteur dont le texte n'accède pas au
// pont. Lève quand src/ ne fournit aucun fichier.
function releverPont(racine, lecteurs = LECTEURS_DU_PONT) {
  const fichiers = fichiersDe(join(racine, 'src'))
    .filter((f) => (EXTENSIONS_MODULE.has(extname(f)) || extname(f) === '.svelte') && !EPREUVE.test(f))
    .sort();
  assert.ok(fichiers.length > 0, 'src ne fournit aucun fichier');
  const servis = new Set();
  const releve = fichiers.flatMap((fichier) => {
    const nom = relative(racine, fichier);
    const texte = readFileSync(fichier, 'utf8');
    const lus = { code: codeSansChaines(fichier, texte), texte };
    const trouves = ACCES_AU_PONT.flatMap(([forme, motif, lu], rang) =>
      [...lus[lu].matchAll(motif)].map(({ index, 1: objet }) => ({
        ligne: ligneDe(texte, index),
        rang,
        acces: forme === '{ gtt }' ? `{ gtt } = ${objet}` : `${objet}${forme}`,
      })),
    );
    if (lecteurs.some((l) => l.fichier === nom)) {
      if (trouves.length > 0) servis.add(nom);
      return [];
    }
    return trouves
      .sort((a, b) => a.ligne - b.ligne || a.rang - b.rang)
      .map(({ ligne, acces }) => `${nom}:${ligne} ${acces}`);
  });
  const sansObjet = lecteurs.filter(({ fichier }) => !servis.has(fichier)).map(({ fichier }) => `lecteur sans objet : ${fichier}`);
  return [...releve, ...sansObjet];
}

describe('arborescence : le pont de la coquille (§ 13.1)', () => {
  test('dans src/, seuls src/main.js et src/stockage/fichiers_electron.js lisent window.gtt', () => {
    assert.deepEqual(releverPont(RACINE), []);
  });

  test('la garde relève chaque accès par sa ligne, composants compris, hors épreuves et hors chaînes ; un lecteur qui ne lit plus le pont est sans objet', () => {
    const fichiers = {
      'src/interface/primitives/Copier.svelte': [
        '<script>',
        '  const copier = (texte) => window.gtt.copier(texte);',
        "  const nom = 'evenement.gtt.json';",
        '</script>',
        '<button onclick={() => window.gtt.copier(nom)}>{nom}</button>',
      ].join('\n'),
      'src/application/presse.js': [
        "export const a = globalThis?.gtt ?? self.gtt;",
        "export const b = window['gtt'].fichiers;",
        'const { gtt } = window;',
        "export const c = 'window.gtt' + `${'self.gtt'}`;",
        '// window.gtt se lit aussi dans un commentaire',
        'export const d = fenetre.gtt + windowgtt;',
      ].join('\n'),
      'src/interface/App.navigateur.test.js': 'window.gtt = pont;\n',
      'src/application/presse.test.js': 'export const e = window.gtt;\n',
      'src/main.js': 'const pont = window.gtt;\n',
      'src/stockage/fichiers_electron.js': 'export const creer = (pont) => pont;\n',
    };
    assert.deepEqual(avecArbre(fichiers, releverPont), [
      'src/application/presse.js:1 globalThis.gtt',
      'src/application/presse.js:1 self.gtt',
      "src/application/presse.js:2 window['gtt']",
      'src/application/presse.js:3 { gtt } = window',
      'src/application/presse.js:5 window.gtt',
      'src/interface/primitives/Copier.svelte:2 window.gtt',
      'src/interface/primitives/Copier.svelte:5 window.gtt',
      `lecteur sans objet : ${join('src', 'stockage', 'fichiers_electron.js')}`,
    ]);
    assert.throws(() => avecArbre({ 'test/a.js': '' }, releverPont), /src ne fournit aucun fichier/);
  });
});

// Les minuteries que seule l'horloge de l'application arme (§ 19.4).
// requestAnimationFrame, qui regroupe les mouvements par image et ne mesure
// rien, n'en est pas une.
const MINUTERIES = [
  ['setTimeout', /\bsetTimeout\b/g],
  ['setInterval', /\bsetInterval\b/g],
  ['requestIdleCallback', /\brequestIdleCallback\b/g],
];

// Les arbres où l'heure ne se lit que par src/application/horloge.js, et le
// point d'entrée de la page, qui la construit.
const ARBRES_D_UNE_HORLOGE = ['src/interface', 'src/application'];
const ENTREE_DE_LA_PAGE = join('src', 'main.js');
const HORLOGE = join('src', 'application', 'horloge.js');

// Sources admises hors de l'horloge, chacune par son fichier et le nom de
// l'appel tel que le relevé le nomme : elle admet chaque occurrence de cet
// appel dans ce fichier, et rien d'autre.
const SOURCES_ADMISES_HORS_HORLOGE = [
  {
    fichier: ENTREE_DE_LA_PAGE,
    appel: 'crypto.randomUUID',
    raison: "les identifiants d'événement, que src/main.js passe à App en propriété",
  },
];

// Relevé « fichier:ligne appel » des minuteries et des sources non
// reproductibles (SOURCES_NON_REPRODUCTIBLES : heure, aléa, tirages de
// crypto, tri et mise en forme selon la langue) dans les modules et les
// composants de src/interface et de src/application, épreuves exclues, et
// dans src/main.js ; horloge.js est hors du relevé. Le texte se lit entier,
// commentaires et chaînes compris, comme celui du déterminisme. Par fichier,
// par ligne, puis dans l'ordre de MINUTERIES et de SOURCES_NON_REPRODUCTIBLES ;
// suit une ligne « exception sans objet : fichier appel » par exception qui
// n'admet rien. Lève quand l'un des arbres ne fournit aucun fichier.
function releverHorloge(racine, admis = SOURCES_ADMISES_HORS_HORLOGE) {
  const fichiers = ARBRES_D_UNE_HORLOGE.flatMap((arbre) => {
    const trouves = [...modulesDe(join(racine, arbre)), ...composantsDe(join(racine, arbre)).filter((f) => !EPREUVE.test(f))];
    assert.ok(trouves.length > 0, `${arbre} ne fournit aucun fichier`);
    return trouves;
  });
  if (existsSync(join(racine, ENTREE_DE_LA_PAGE))) fichiers.push(join(racine, ENTREE_DE_LA_PAGE));
  const servies = new Set();
  const releve = fichiers
    .filter((fichier) => relative(racine, fichier) !== HORLOGE)
    .sort()
    .flatMap((fichier) => {
      const nom = relative(racine, fichier);
      return releverMotifs(nom, readFileSync(fichier, 'utf8'), [...MINUTERIES, ...SOURCES_NON_REPRODUCTIBLES]).filter((ligne) => {
        const exception = admis.find((e) => e.fichier === nom && ligne.endsWith(` ${e.appel}`));
        if (exception !== undefined) servies.add(exception);
        return exception === undefined;
      });
    });
  const sansObjet = admis
    .filter((exception) => !servies.has(exception))
    .map(({ fichier, appel }) => `exception sans objet : ${fichier} ${appel}`);
  return [...releve, ...sansObjet];
}

describe('arborescence : une horloge (§ 19.4, § 14.7)', () => {
  test("hors d'horloge.js, ni src/interface, ni src/application, ni src/main.js n'arment une minuterie ni ne lisent l'heure, l'aléa ou la langue ; src/main.js tire les identifiants d'événement", () => {
    assert.deepEqual(releverHorloge(RACINE), []);
  });

  test('la garde relève chaque appel par sa ligne, composants compris, à toute profondeur, hors épreuves et hors horloge.js ; requestAnimationFrame est admis ; une exception sans objet se relève', () => {
    const fichiers = {
      'src/interface/plan/Pression.svelte': [
        '<script>',
        "  import { getContext } from 'svelte';",
        '  const minuterie = setTimeout(() => {}, 500);',
        '  const image = requestAnimationFrame(() => {});',
        '</script>',
        '<p>{new Date().getFullYear()}</p>',
      ].join('\n'),
      'src/interface/plan/vue_plan.js': [
        'export const a = setInterval(f, 10) + requestIdleCallback(f);',
        "export const b = noms.sort((x, y) => x.localeCompare(y, 'fr'));",
        'export const c = new Intl.NumberFormat().format(n) + n.toLocaleString();',
        'export const d = Date.now() - performance.now();',
        'export const e = cancelAnimationFrame(image) + Date.UTC(2000, 0, 1);',
      ].join('\n'),
      'src/application/sous/tirage.js': 'export const f = Math.random() + crypto.randomUUID();\n',
      'src/application/horloge.js': 'export const g = () => setTimeout(f, 0) + new Date() + performance.now();\n',
      'src/application/seance.test.js': 'const laisser = () => new Promise((r) => setTimeout(r, 0));\n',
      'src/interface/App.navigateur.test.js': 'await new Promise((r) => setTimeout(r, 10));\n',
      'src/main.js': 'const id = () => crypto.randomUUID();\nconst t = Date.now();\n',
    };
    assert.deepEqual(avecArbre(fichiers, releverHorloge), [
      'src/application/sous/tirage.js:1 Math.random',
      'src/application/sous/tirage.js:1 crypto.randomUUID',
      'src/interface/plan/Pression.svelte:3 setTimeout',
      'src/interface/plan/Pression.svelte:6 new Date',
      'src/interface/plan/vue_plan.js:1 setInterval',
      'src/interface/plan/vue_plan.js:1 requestIdleCallback',
      'src/interface/plan/vue_plan.js:2 localeCompare',
      'src/interface/plan/vue_plan.js:3 toLocale…',
      'src/interface/plan/vue_plan.js:3 Intl',
      'src/interface/plan/vue_plan.js:4 Date.now',
      'src/interface/plan/vue_plan.js:4 performance.now',
      `${join('src', 'main.js')}:2 Date.now`,
    ]);
    const sansTirage = { ...fichiers, 'src/main.js': 'const t = 0;\n' };
    assert.deepEqual(avecArbre(sansTirage, releverHorloge).at(-1), `exception sans objet : ${join('src', 'main.js')} crypto.randomUUID`);
    for (const arbre of ARBRES_D_UNE_HORLOGE) {
      const sansFichier = { ...sansArbre(fichiers, arbre), [`${arbre}/a.test.js`]: '' };
      assert.throws(() => avecArbre(sansFichier, releverHorloge), new RegExp(`${arbre} ne fournit aucun fichier`), arbre);
    }
  });
});

// Relevé « fichier:ligne forme » des formes données dans les modules et les
// composants des arbres, à toute profondeur, épreuves exclues ; par fichier,
// par ligne, puis dans l'ordre des formes. Une forme est [nom, expression à
// g, lu]. Lue dans le 'code', elle se cherche dans le texte sans chaînes ni
// commentaires ; lue dans le 'texte', parce qu'une chaîne est son nom même,
// elle se cherche dans le texte sans commentaires et ne compte que si son
// premier caractère subsiste dans le code : celle qu'une chaîne contient est
// blanchie avec elle. Un composant se lit sans ses commentaires HTML, ses
// blocs de script comme un module, son balisage tel quel. Un lecteur admis,
// {fichier, forme}, admet chaque occurrence de cette forme dans ce fichier,
// et rien d'autre ; suit une ligne « lecteur sans objet : fichier forme » par
// lecteur qui n'en porte aucune. Lève quand un arbre ne fournit aucun
// fichier.
function releverLectures(racine, { arbres, formes, lecteurs }) {
  const fichiers = arbres
    .flatMap((arbre) => {
      const trouves = fichiersDe(join(racine, arbre)).filter(
        (f) => (EXTENSIONS_MODULE.has(extname(f)) || extname(f) === '.svelte') && !EPREUVE.test(f),
      );
      assert.ok(trouves.length > 0, `${arbre} ne fournit aucun fichier`);
      return trouves;
    })
    .sort();
  const servis = new Set();
  const releve = fichiers.flatMap((fichier) => {
    const nom = enBarres(racine, fichier);
    const texte = texteSansCommentaires(fichier, readFileSync(fichier, 'utf8'));
    const lus = { texte, code: codeSansChaines(fichier, texte) };
    return formes
      .flatMap(([forme, motif, lu], rang) =>
        [...lus[lu].matchAll(motif)]
          .filter(({ index }) => lus.code[index] === texte[index])
          .map(({ index }) => ({ ligne: ligneDe(texte, index), rang, forme })),
      )
      .filter(({ forme }) => {
        const lecteur = lecteurs.find((l) => l.fichier === nom && l.forme === forme);
        if (lecteur !== undefined) servis.add(lecteur);
        return lecteur === undefined;
      })
      .sort((a, b) => a.ligne - b.ligne || a.rang - b.rang)
      .map(({ ligne, forme }) => `${nom}:${ligne} ${forme}`);
  });
  const sansObjet = lecteurs.filter((l) => !servis.has(l)).map(({ fichier, forme }) => `lecteur sans objet : ${fichier} ${forme}`);
  return [...releve, ...sansObjet];
}

// Le nombre de processeurs logiques du poste (§ 13.4) est une donnée de la
// plateforme : src/main.js le lit et le passe à l'exécuteur de la génération
// (coeursDisponibles). Ailleurs dans src/, une lecture ferait dépendre du
// poste un module que les épreuves et le banc pilotent par ce paramètre. Il
// se lit par le nom du champ — point, chaînage optionnel, déstructuration —
// ou par une chaîne entre crochets.
const LECTURES_DES_COEURS = [
  ['hardwareConcurrency', /\bhardwareConcurrency\b/g, 'code'],
  ["['hardwareConcurrency']", /\[\s*(['"`])hardwareConcurrency\1\s*\]/g, 'texte'],
];
const LECTEURS_DES_COEURS = [
  {
    fichier: 'src/main.js',
    forme: 'hardwareConcurrency',
    raison: "construit l'exécuteur de la génération avec le nombre de processeurs logiques du poste",
  },
];
const releverLecteursDesCoeurs = (racine) =>
  releverLectures(racine, { arbres: ['src'], formes: LECTURES_DES_COEURS, lecteurs: LECTEURS_DES_COEURS });

describe('arborescence : un seul lecteur du nombre de processeurs logiques (§ 13.4)', () => {
  test('hors de src/main.js, aucun module de src/ ne lit hardwareConcurrency', () => {
    assert.deepEqual(releverLecteursDesCoeurs(RACINE), []);
  });

  test('la garde relève chaque lecture par sa ligne, composants compris, à toute profondeur, hors épreuves, chaînes et commentaires ; src/main.js ne lit que par le point ; un lecteur qui ne lit plus le champ est sans objet', () => {
    const fichiers = {
      'src/interface/generation/Coeurs.svelte': [
        '<script>',
        '  const coeurs = navigator.hardwareConcurrency;',
        '  // navigator.hardwareConcurrency se lit aussi dans un commentaire',
        "  const nom = 'navigator.hardwareConcurrency';",
        '</script>',
        '<!-- {navigator.hardwareConcurrency} -->',
        '<p>{navigator?.hardwareConcurrency}</p>',
      ].join('\n'),
      'src/application/sous/parallele.js': [
        "export const a = globalThis.navigator['hardwareConcurrency'];",
        'const { hardwareConcurrency } = navigator;',
        'export const b = "[\'hardwareConcurrency\']" + hardwareConcurrencyMax;',
        '/* navigator.hardwareConcurrency */',
      ].join('\n'),
      'src/stockage/reserve.js': 'export const c = self.navigator.hardwareConcurrency ?? 1;\n',
      'src/application/generation.test.js': 'const n = navigator.hardwareConcurrency;\n',
      'src/interface/App.navigateur.test.js': "const n = navigator['hardwareConcurrency'];\n",
      'src/main.js': "const coeurs = navigator.hardwareConcurrency;\nconst autre = navigator['hardwareConcurrency'];\n",
    };
    assert.deepEqual(avecArbre(fichiers, releverLecteursDesCoeurs), [
      "src/application/sous/parallele.js:1 ['hardwareConcurrency']",
      'src/application/sous/parallele.js:2 hardwareConcurrency',
      'src/interface/generation/Coeurs.svelte:2 hardwareConcurrency',
      'src/interface/generation/Coeurs.svelte:7 hardwareConcurrency',
      "src/main.js:2 ['hardwareConcurrency']",
      'src/stockage/reserve.js:1 hardwareConcurrency',
    ]);
    const sansLecteur = { ...fichiers, 'src/main.js': 'const coeurs = 4;\n' };
    assert.deepEqual(avecArbre(sansLecteur, releverLecteursDesCoeurs).at(-1), 'lecteur sans objet : src/main.js hardwareConcurrency');
    assert.throws(() => avecArbre({ 'src/a.test.js': '', 'test/b.js': '' }, releverLecteursDesCoeurs), /src ne fournit aucun fichier/);
  });
});

// Paquets refusés (§ 13.3, § 14.8), chacun par le motif de son nom : un outil
// qui déduit les styles en lisant les sources élague les classes d'état
// composées à l'exécution ; D3 garde la transformation du zoom hors du
// modèle ; jsdom et ses voisins n'ont pas de mise en page, et le style
// calculé y devient une formalité ; les autres lanceurs et bibliothèques
// d'assertion doublent Vitest et node:assert/strict.
const PAQUETS_REFUSES = [
  /^tailwindcss$/, /^@tailwindcss\//, /^unocss$/, /^windicss$/, /^purgecss$/, /^@fullhuman\/postcss-purgecss$/,
  /^d3$/, /^d3-/,
  /^jsdom$/, /^happy-dom$/, /^@testing-library\//,
  /^jest$/, /^mocha$/, /^chai$/, /^sinon$/, /^nyc$/, /^karma$/, /^jasmine$/, /^qunit$/,
];

// Les champs de package.json qui déclarent un paquet.
const CHAMPS_DE_PAQUETS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];

// Configurations, à la racine, d'un outil qui lit les sources pour en
// déduire les styles.
const CONFIGURATION_REFUSEE = /^(?:tailwind|uno|postcss)\.config\.[^/]+$/;

// Ce que vite.config.js charge : Vite et le greffon Svelte, rien d'autre.
const CHARGEMENTS_DE_VITE = new Set(['vite', '@sveltejs/vite-plugin-svelte']);

// Éléments d'une liste écrite entre crochets, séparés par les virgules de
// premier niveau, blancs de bord retirés, vides exclus.
function elementsDeListe(liste) {
  const elements = [];
  let profondeur = 0;
  let debut = 0;
  for (let i = 0; i <= liste.length; i += 1) {
    const c = liste[i];
    if (c === '(' || c === '[' || c === '{') profondeur += 1;
    else if (c === ')' || c === ']' || c === '}') profondeur -= 1;
    else if (i === liste.length || (c === ',' && profondeur === 0)) {
      elements.push(liste.slice(debut, i).trim());
      debut = i + 1;
    }
  }
  return elements.filter((element) => element !== '');
}

// Relevé des dépendances refusées : chaque paquet refusé de package.json,
// champ par champ dans l'ordre de CHAMPS_DE_PAQUETS, « package.json champ
// paquet » ; chaque configuration refusée de la racine, « fichier à la
// racine » ; puis, dans vite.config.js, chaque chargement autre que Vite et
// le greffon Svelte, « vite.config.js:ligne import x », et chaque greffon
// autre qu'un appel à svelte, « vite.config.js:ligne greffon x ». Lève quand
// package.json ne déclare aucun paquet, ou que vite.config.js manque.
function releverDependancesRefusees(racine) {
  const paquet = JSON.parse(readFileSync(join(racine, 'package.json'), 'utf8'));
  const declares = CHAMPS_DE_PAQUETS.flatMap((champ) => Object.keys(paquet[champ] ?? {}).sort().map((nom) => ({ champ, nom })));
  assert.ok(declares.length > 0, 'package.json ne déclare aucun paquet');
  const refus = declares
    .filter(({ nom }) => PAQUETS_REFUSES.some((motif) => motif.test(nom)))
    .map(({ champ, nom }) => `package.json ${champ} ${nom}`);
  const configurations = readdirSync(racine, { withFileTypes: true })
    .filter((entree) => entree.isFile() && CONFIGURATION_REFUSEE.test(entree.name))
    .map((entree) => entree.name)
    .sort();
  refus.push(...configurations.map((nom) => `${nom} à la racine`));
  const texte = readFileSync(join(racine, 'vite.config.js'), 'utf8');
  const code = sansChaines(texte);
  for (const { indice, specificateur, argument } of chargements(texte)) {
    if (estDuCode(code, indice) && !CHARGEMENTS_DE_VITE.has(specificateur)) {
      refus.push(`vite.config.js:${ligneDe(texte, indice)} import ${specificateur ?? argument}`);
    }
  }
  const greffons = /\bplugins\s*:\s*\[/.exec(code);
  if (greffons === null) {
    refus.push('vite.config.js : aucun greffon Svelte');
  } else {
    const debut = greffons.index + greffons[0].length;
    let fin = debut;
    for (let profondeur = 1; fin < code.length && profondeur > 0; fin += 1) {
      if (code[fin] === '[') profondeur += 1;
      if (code[fin] === ']') profondeur -= 1;
    }
    const liste = elementsDeListe(code.slice(debut, fin - 1));
    if (!liste.some((element) => /^svelte\s*\(/.test(element))) refus.push('vite.config.js : aucun greffon Svelte');
    for (const element of liste.filter((e) => !/^svelte\s*\(/.test(e))) {
      refus.push(`vite.config.js:${ligneDe(code, code.indexOf(element, debut))} greffon ${element.replace(/\s+/g, ' ')}`);
    }
  }
  return refus;
}

describe('arborescence : dépendances refusées (§ 13.3, § 14.8)', () => {
  test('ni outil qui lit les sources pour les styles, ni D3, ni jsdom, ni autre lanceur ; vite.config.js ne charge que le greffon Svelte', () => {
    assert.deepEqual(releverDependancesRefusees(RACINE), []);
  });

  test('la garde relève un paquet refusé dans chaque champ, une configuration refusée à la racine, et un greffon ou un chargement de plus dans vite.config.js', () => {
    const vite = [
      "import { defineConfig } from 'vite';",
      "import { svelte } from '@sveltejs/vite-plugin-svelte';",
      'export default defineConfig({ base: \'./\', plugins: [svelte()] });',
    ].join('\n');
    const conforme = {
      'package.json': JSON.stringify({ devDependencies: { svelte: '^5', vite: '^8', vitest: '^5' } }),
      'vite.config.js': vite,
      'src/postcss.config.js': '',
    };
    assert.deepEqual(avecArbre(conforme, releverDependancesRefusees), []);
    const avec = (devDependencies) => ({ ...conforme, 'package.json': JSON.stringify({ devDependencies }) });
    assert.deepEqual(avecArbre(avec({ svelte: '^5', tailwindcss: '^4' }), releverDependancesRefusees), [
      'package.json devDependencies tailwindcss',
    ]);
    assert.deepEqual(avecArbre(avec({ svelte: '^5', jsdom: '^26' }), releverDependancesRefusees), [
      'package.json devDependencies jsdom',
    ]);
    const tout = {
      ...conforme,
      'package.json': JSON.stringify({
        dependencies: { d3: '^7', 'd3-zoom': '^3' },
        devDependencies: {
          '@tailwindcss/vite': '^4', unocss: '^0', windicss: '^3', purgecss: '^7', '@fullhuman/postcss-purgecss': '^7',
          'happy-dom': '^18', '@testing-library/svelte': '^5', jest: '^30', mocha: '^11', chai: '^5', sinon: '^21',
          nyc: '^17', karma: '^6', jasmine: '^5', qunit: '^2', svelte: '^5', d3x: '^1', 'jest-voisin': '^1',
        },
        optionalDependencies: { 'd3-selection': '^3' },
        peerDependencies: { tailwindcss: '^4' },
      }),
      'tailwind.config.js': '',
      'uno.config.ts': '',
      'postcss.config.cjs': '',
      'vite.config.js': [
        "import { defineConfig } from 'vite';",
        "import { svelte } from '@sveltejs/vite-plugin-svelte';",
        `import tailwind from ${JSON.stringify('@tailwindcss/vite')};`,
        "import { greffon } from './greffon.js';",
        'export default defineConfig({',
        '  plugins: [',
        '    svelte({ compilerOptions: {} }),',
        '    tailwind(),',
        '  ],',
        '});',
      ].join('\n'),
    };
    assert.deepEqual(avecArbre(tout, releverDependancesRefusees), [
      'package.json dependencies d3',
      'package.json dependencies d3-zoom',
      'package.json devDependencies @fullhuman/postcss-purgecss',
      'package.json devDependencies @tailwindcss/vite',
      'package.json devDependencies @testing-library/svelte',
      'package.json devDependencies chai',
      'package.json devDependencies happy-dom',
      'package.json devDependencies jasmine',
      'package.json devDependencies jest',
      'package.json devDependencies karma',
      'package.json devDependencies mocha',
      'package.json devDependencies nyc',
      'package.json devDependencies purgecss',
      'package.json devDependencies qunit',
      'package.json devDependencies sinon',
      'package.json devDependencies unocss',
      'package.json devDependencies windicss',
      'package.json optionalDependencies d3-selection',
      'package.json peerDependencies tailwindcss',
      'postcss.config.cjs à la racine',
      'tailwind.config.js à la racine',
      'uno.config.ts à la racine',
      'vite.config.js:3 import @tailwindcss/vite',
      'vite.config.js:4 import ./greffon.js',
      'vite.config.js:8 greffon tailwind()',
    ]);
    const sansSvelte = { ...conforme, 'vite.config.js': "import { defineConfig } from 'vite';\nexport default defineConfig({});\n" };
    assert.deepEqual(avecArbre(sansSvelte, releverDependancesRefusees), ['vite.config.js : aucun greffon Svelte']);
    assert.throws(() => avecArbre({ ...conforme, 'package.json': '{}' }, releverDependancesRefusees), /package.json ne déclare aucun paquet/);
  });
});

// Le lanceur d'épreuves : vitest, ses sous-chemins et ses paquets @vitest/.
const LANCEUR_D_EPREUVES = /^(?:vitest(?:\/|$)|@vitest\/)/;
const EPREUVE_NAVIGATEUR = /\.navigateur\.test\.[cm]?js$/;

// Ce que le texte sans chaînes d'une épreuve node ne porte pas (§ 14.8) : les
// assertions de Vitest, que node:assert/strict remplace, et l'objet env
// d'import.meta, que Node ne fournit pas.
const ECRITURE_NODE = [
  ['expect', /\bexpect\s*(?:\?\.)?\s*\(/g],
  ['import.meta.env', /\bimport\s*\.\s*meta\s*\??\.\s*env\b/g],
];

// Les chargements du lanceur admis, chacun par son fichier et son
// spécificateur. test/lanceur.js réexporte test et describe, le point que
// change le repli sous node --test (§ 14.8). vitest.config.js n'est pas une
// épreuve : c'est la configuration du lanceur, que lisent les gardes qui
// l'éprouvent — motifs de surveillance, séries selon la machine, rapporteur,
// options de Chromium — et que les épreuves chargent telle que le lanceur la
// charge ; sous node --test, ces gardes mêmes la lisent.
const LANCEUR_ADMIS = [
  {
    fichier: join('test', 'lanceur.js'),
    specificateur: 'vitest',
    raison: 'réexporte test et describe de vitest ; remplacer sa ligne fait tourner la série sous node --test',
  },
  {
    fichier: 'vitest.config.js',
    specificateur: 'vitest/config',
    raison: 'defineConfig, de la configuration du lanceur que les gardes chargent',
  },
  {
    fichier: 'vitest.config.js',
    specificateur: '@vitest/browser-playwright',
    raison: 'le pilote du projet navigateur, de la configuration du lanceur que les gardes chargent',
  },
];

// Relevé de l'écriture des épreuves node et node-long (§ 14.8) : chaque
// *.test.js du projet hors des épreuves du navigateur, et chaque module
// JavaScript qu'ils importent, à toute profondeur, par un chemin relatif ou
// absolu depuis la racine — le parcours ne suit ni un composant ni un autre
// fichier. Sur le texte sans chaînes, il relève les assertions de Vitest et
// l'objet env d'import.meta ; parmi les chargements dont le mot-clé
// subsiste dans ce texte, le lanceur d'épreuves, un spécificateur à suffixe
// de Vite — « ?raw » comme tout autre — et un chemin sans extension. Chaque
// refus se lit « accès:ligne refus », l'accès étant la suite des fichiers
// qui y mène depuis une épreuve, comme dans releverCouche ; suit une ligne
// « exception sans objet : fichier spécificateur » par chargement admis
// qu'aucun fichier parcouru ne fait. Lève quand le projet ne porte aucune
// épreuve node.
function releverEcritureDesEpreuves(racine, admis = LANCEUR_ADMIS) {
  const epreuves = fichiersDuProjet(racine).filter((f) => EPREUVE.test(f) && !EPREUVE_NAVIGATEUR.test(f));
  assert.ok(epreuves.length > 0, 'aucune épreuve node');
  const aParcourir = [...epreuves];
  const acces = new Map(epreuves.map((fichier) => [fichier, relative(racine, fichier)]));
  const servies = new Set();
  const refus = [];
  for (let i = 0; i < aParcourir.length; i += 1) {
    const fichier = aParcourir[i];
    const nom = relative(racine, fichier);
    const texte = readFileSync(fichier, 'utf8');
    const code = sansChaines(texte);
    const trouves = ECRITURE_NODE.flatMap(([motif, expression]) =>
      [...code.matchAll(expression)].map(({ index }) => ({ indice: index, motif })),
    );
    for (const { indice, specificateur } of chargementsLitteraux(texte)) {
      if (!estDuCode(code, indice)) continue;
      const cible = cibleDe(racine, fichier, specificateur);
      if (LANCEUR_D_EPREUVES.test(specificateur)) {
        const exception = admis.find((e) => e.fichier === nom && e.specificateur === specificateur);
        if (exception === undefined) trouves.push({ indice, motif: `import ${specificateur}` });
        else servies.add(exception);
      } else if (specificateur.includes('?')) {
        trouves.push({ indice, motif: `import ${specificateur} : suffixe de Vite` });
      } else if (cible !== null && extname(cible) === '') {
        trouves.push({ indice, motif: `import ${specificateur} sans extension` });
      } else if (
        cible !== null &&
        !acces.has(cible) &&
        EXTENSIONS_MODULE.has(extname(cible)) &&
        !cible.split(sep).includes('node_modules') &&
        existsSync(cible)
      ) {
        acces.set(cible, `${acces.get(fichier)} → ${relative(racine, cible)}`);
        aParcourir.push(cible);
      }
    }
    trouves.sort((a, b) => a.indice - b.indice);
    refus.push(...trouves.map(({ indice, motif }) => `${acces.get(fichier)}:${ligneDe(texte, indice)} ${motif}`));
  }
  const sansObjet = admis
    .filter((e) => !servies.has(e))
    .map(({ fichier, specificateur }) => `exception sans objet : ${fichier} ${specificateur}`);
  return [...refus, ...sansObjet];
}

// Ce qu'une épreuve du navigateur n'asserte pas : la présence d'une classe,
// qui ne dit rien de ce qui est peint (§ 14.2).
const ASSERTIONS_DE_CLASSE = [
  ['classList.contains', /\bclassList\s*\??\.\s*contains\b/g],
  ['toHaveClass', /\btoHaveClass\b/g],
  ['className', /\bclassName\b/g],
];

// Les délais fixes, chacun par son appel : une épreuve attend un état, un
// événement ou une image, jamais une durée (§ 14.14, § 19.3). Le module des
// minuteurs de Node se relève à son chargement. Un setTimeout de zéro est un
// délai : Node le porte à une milliseconde. setImmediate n'en est pas un : il
// ne prend aucune durée, et rappelle une fois vidées les microtâches en
// attente — une épreuve node l'attend pour que les promesses lancées sans
// être rendues s'achèvent avant ses assertions.
const DELAIS = [
  ['setTimeout', /\bsetTimeout\s*(?:\?\.)?\s*\(/g],
  ['setInterval', /\bsetInterval\s*(?:\?\.)?\s*\(/g],
  ['waitForTimeout', /\bwaitForTimeout\s*(?:\?\.)?\s*\(/g],
  ['sleep', /\bsleep\s*(?:\?\.)?\s*\(/g],
];
const MINUTEURS_DE_NODE = /^(?:node:)?timers(?:\/promises)?$/;

// Ce que relèvent, dans un texte et son code sans chaînes, les motifs donnés
// et les chargements du module des minuteurs dont le mot-clé subsiste dans
// le code : chacun { ligne, motif }, par ligne, puis dans l'ordre des
// motifs, le chargement après eux.
function delaisEt(texte, code, motifs) {
  const minuteurs = chargementsLitteraux(texte)
    .filter(({ indice, specificateur }) => estDuCode(code, indice) && MINUTEURS_DE_NODE.test(specificateur))
    .map(({ indice, specificateur }) => ({ ligne: ligneDe(texte, indice), rang: motifs.length, motif: `import ${specificateur}` }));
  return [
    ...motifs.flatMap(([motif, expression], rang) =>
      [...code.matchAll(expression)].map(({ index }) => ({ ligne: ligneDe(texte, index), rang, motif })),
    ),
    ...minuteurs,
  ].sort((a, b) => a.ligne - b.ligne || a.rang - b.rang);
}

// Relevé des épreuves du navigateur, chaque *.navigateur.test.js du
// projet, et des modules JavaScript de test/ qu'elles importent, à toute
// profondeur, par un chemin relatif ou absolu depuis la racine : les aides
// partagées de test/navigateur/ attendent et agissent pour elles. Un module
// de src/ ne se parcourt pas : c'est le code éprouvé, que ses propres gardes
// tiennent. Chaque assertion de classe ou délai fixe se lit « accès:ligne
// refus », l'accès étant la suite des fichiers qui y mène depuis une
// épreuve, comme dans releverEcritureDesEpreuves. Lève quand le projet n'en
// porte aucune.
function releverEpreuvesNavigateur(racine) {
  const epreuves = fichiersDuProjet(racine).filter((f) => EPREUVE_NAVIGATEUR.test(f));
  assert.ok(epreuves.length > 0, 'aucune épreuve du navigateur');
  const sousTest = join(racine, 'test') + sep;
  const aParcourir = [...epreuves];
  const acces = new Map(epreuves.map((fichier) => [fichier, relative(racine, fichier)]));
  const refus = [];
  for (let i = 0; i < aParcourir.length; i += 1) {
    const fichier = aParcourir[i];
    const texte = readFileSync(fichier, 'utf8');
    const code = sansChaines(texte);
    for (const { indice, specificateur } of chargementsLitteraux(texte)) {
      const cible = cibleDe(racine, fichier, specificateur);
      if (
        estDuCode(code, indice) &&
        cible !== null &&
        cible.startsWith(sousTest) &&
        !acces.has(cible) &&
        EXTENSIONS_MODULE.has(extname(cible)) &&
        existsSync(cible)
      ) {
        acces.set(cible, `${acces.get(fichier)} → ${relative(racine, cible)}`);
        aParcourir.push(cible);
      }
    }
    refus.push(
      ...delaisEt(texte, code, [...ASSERTIONS_DE_CLASSE, ...DELAIS]).map(({ ligne, motif }) => `${acces.get(fichier)}:${ligne} ${motif}`),
    );
  }
  return refus;
}

describe('arborescence : écriture des épreuves (§ 14.8, § 14.2)', () => {
  test('les épreuves node, et les modules qu’elles importent, n’emploient ni les assertions de Vitest, ni le lanceur hors de test/lanceur.js, ni syntaxe propre à Vite, ni chemin sans extension', () => {
    assert.deepEqual(releverEcritureDesEpreuves(RACINE), []);
  });

  test('les épreuves du navigateur n’assertent aucune classe et n’attendent aucun délai fixe', () => {
    assert.deepEqual(releverEpreuvesNavigateur(RACINE), []);
  });

  test('la garde des épreuves node relève chaque refus par sa ligne, dans les épreuves et les modules qu’elles importent, et non dans une chaîne ; un chargement admis ne vaut que pour son fichier et son spécificateur ; une exception sans objet se relève', () => {
    const fichiers = {
      'test/lanceur.js': "export { test, describe } from 'vitest';\nexport { vi } from 'vitest/node';\n",
      'test/config.test.js': "import configuration from '../vitest.config.js';\n",
      'vitest.config.js': [
        "import { defineConfig } from 'vitest/config';",
        "import { playwright } from '@vitest/browser-playwright';",
        "import { createVitest } from 'vitest/node';",
        "import { expect } from 'vitest';",
      ].join('\n'),
      'src/moteur/a.test.js': [
        "import { test } from '../../test/lanceur.js';",
        "import { expect } from 'vitest';",
        "import { describe } from 'vitest/node';",
        `import { page } from ${"'"}@vitest/browser/context${"'"};`,
        "import gabarit from './gabarit.txt?raw';",
        "import { aide } from './aide';",
        "import { outil } from './outil.js';",
        'expect(1).toBe(1);',
        'const mode = import.meta.env.MODE;',
        "const donnee = \"} from 'vitest';\" + 'expect(2)' + `import.meta.env`;",
        '// import.meta.env se relève aussi dans un commentaire',
        'const voisin = attendu.expected + importMeta.env + expectation;',
      ].join('\n'),
      'src/moteur/outil.js': "import { profond } from './sous/profond.js';\nimport Composant from './Composant.svelte';\n",
      'src/moteur/sous/profond.js': 'export const profond = import.meta.env.DEV;\n',
      'src/moteur/Composant.svelte': '<script>\n  import { expect } from \'vitest\';\n</script>\n',
      'src/moteur/sous/b.long.test.js': "const v = await import('vitest');\n",
      'src/interface/A.navigateur.test.js': "import { expect } from 'vitest';\nexpect(1).toBe(1);\n",
      'node_modules/p/x.test.js': "import { expect } from 'vitest';\n",
      'www/y.test.js': "import { expect } from 'vitest';\n",
    };
    assert.deepEqual(avecArbre(fichiers, releverEcritureDesEpreuves), [
      'src/moteur/a.test.js:2 import vitest',
      'src/moteur/a.test.js:3 import vitest/node',
      'src/moteur/a.test.js:4 import @vitest/browser/context',
      'src/moteur/a.test.js:5 import ./gabarit.txt?raw : suffixe de Vite',
      'src/moteur/a.test.js:6 import ./aide sans extension',
      'src/moteur/a.test.js:8 expect',
      'src/moteur/a.test.js:9 import.meta.env',
      'src/moteur/a.test.js:11 import.meta.env',
      'src/moteur/sous/b.long.test.js:1 import vitest',
      'src/moteur/a.test.js → test/lanceur.js:2 import vitest/node',
      'test/config.test.js → vitest.config.js:3 import vitest/node',
      'test/config.test.js → vitest.config.js:4 import vitest',
      'src/moteur/a.test.js → src/moteur/outil.js → src/moteur/sous/profond.js:1 import.meta.env',
    ]);
    const sansLanceur = {
      ...fichiers,
      'test/lanceur.js': "export { test, describe } from 'node:test';\n",
      'test/config.test.js': "import { test } from './lanceur.js';\n",
    };
    assert.deepEqual(avecArbre(sansLanceur, releverEcritureDesEpreuves).slice(-3), [
      `exception sans objet : ${join('test', 'lanceur.js')} vitest`,
      'exception sans objet : vitest.config.js vitest/config',
      'exception sans objet : vitest.config.js @vitest/browser-playwright',
    ]);
    assert.throws(() => avecArbre({ 'src/a.js': '', 'src/A.navigateur.test.js': '' }, releverEcritureDesEpreuves), /aucune épreuve node/);
  });

  test('la garde des épreuves du navigateur relève une assertion de classe et un délai fixe par leur ligne, et non dans une chaîne', () => {
    const fichiers = {
      'src/interface/plan/Plan.navigateur.test.js': [
        "expect(table.classList.contains('conflit')).toBe(true);",
        "await expect.element(table).toHaveClass('conflit');",
        "expect(table.className).toContain('conflit');",
        'await new Promise((fin) => setTimeout(fin, 50));',
        'await page.waitForTimeout(100);',
        'await sleep(20);',
        "import { setTimeout as attendre } from 'node:timers/promises';",
        "const mot = 'setTimeout(f) className';",
        'await new Promise(requestAnimationFrame);',
        'const style = getComputedStyle(table).backgroundColor;',
      ].join('\n'),
      'test/navigateur/entrees.navigateur.test.js': 'setInterval(f, 10);\n',
      'src/interface/plan/gestes.test.js': 'await new Promise((fin) => setTimeout(fin, 50));\n',
    };
    assert.deepEqual(avecArbre(fichiers, releverEpreuvesNavigateur), [
      'src/interface/plan/Plan.navigateur.test.js:1 classList.contains',
      'src/interface/plan/Plan.navigateur.test.js:2 toHaveClass',
      'src/interface/plan/Plan.navigateur.test.js:3 className',
      'src/interface/plan/Plan.navigateur.test.js:4 setTimeout',
      'src/interface/plan/Plan.navigateur.test.js:5 waitForTimeout',
      'src/interface/plan/Plan.navigateur.test.js:6 sleep',
      'src/interface/plan/Plan.navigateur.test.js:7 import node:timers/promises',
      'test/navigateur/entrees.navigateur.test.js:1 setInterval',
    ]);
    assert.throws(() => avecArbre({ 'src/a.test.js': '' }, releverEpreuvesNavigateur), /aucune épreuve du navigateur/);
  });

  test('la garde des épreuves du navigateur suit leurs imports relatifs vers les modules de test/, à toute profondeur, et relève le refus avec son chemin d’accès ; un module de src/ ne se parcourt pas', () => {
    const fichiers = {
      'src/interface/plan/Plan.navigateur.test.js': [
        "import { cliquer } from '../../../test/navigateur/aide.js';",
        "import { horloge } from '../../application/horloge.js';",
        "import { donnee } from '../../../test/fixtures/donnee.json' with { type: 'json' };",
      ].join('\n'),
      'test/navigateur/aide.js': [
        "import { attendre } from './profond/attente.js';",
        'export const cliquer = async () => {',
        '  await new Promise((r) => setTimeout(r, 300));',
        '};',
      ].join('\n'),
      'test/navigateur/profond/attente.js': "export const attendre = (e) => e.classList.contains('vu');\n",
      'src/application/horloge.js': 'export const horloge = () => setTimeout(() => {}, 10);\n',
      'test/fixtures/donnee.json': '{}\n',
      'test/navigateur/aide.navigateur.test.js': "import { cliquer } from './aide.js';\n",
    };
    assert.deepEqual(avecArbre(fichiers, releverEpreuvesNavigateur), [
      'src/interface/plan/Plan.navigateur.test.js → test/navigateur/aide.js:3 setTimeout',
      'src/interface/plan/Plan.navigateur.test.js → test/navigateur/aide.js → test/navigateur/profond/attente.js:1 classList.contains',
    ]);
  });
});

// Le projet de la série surveillée dans une configuration de Vitest.
const projetSurveille = (projets) => projets.find(({ test: { name } }) => name === 'node').test;

// Épreuves d'un projet de Vitest, en chemins absolus triés : les fichiers du
// projet que l'un de ses motifs include désigne et qu'aucun motif exclude
// n'écarte, lus relatifs à la racine.
function epreuvesDuProjet(racine, { include = [], exclude = [] }) {
  const epreuves = fichiersDuProjet(racine).filter((fichier) => {
    const chemin = enBarres(racine, fichier);
    return repondA(chemin, include) && !repondA(chemin, exclude);
  });
  assert.ok(epreuves.length > 0, 'la série surveillée ne porte aucune épreuve');
  return epreuves;
}

// Ce que la série surveillée n'appelle pas : la géométrie du rendu, qu'aucun
// environnement node n'implémente (§ 14.4).
const GEOMETRIE_DU_RENDU = [
  ['getBBox', /\bgetBBox\s*(?:\?\.)?\s*\(/g],
  ['getScreenCTM', /\bgetScreenCTM\s*(?:\?\.)?\s*\(/g],
  ['getComputedTextLength', /\bgetComputedTextLength\s*(?:\?\.)?\s*\(/g],
];

// Les fonctions d'écriture de node:fs et de node:fs/promises, et leurs formes
// synchrones. Un import du module entier — par défaut, par espace de noms, par
// require ou import() sans déstructuration, ou de son objet promises — les
// porte toutes.
const MODULE_FS = /^(?:node:)?fs(?:\/promises)?$/;
const ECRITURES_FS = new Set(
  ['writeFile', 'appendFile', 'mkdir', 'rm', 'rename', 'copyFile', 'cp', 'symlink', 'unlink', 'createWriteStream'].flatMap(
    (nom) => [nom, `${nom}Sync`],
  ),
);
const TEMPORAIRE = /\bmkdtemp(?:Sync)?\s*(?:\?\.)?\s*\(/;

// Noms d'une liste « a, b as c » ou « a, b: c », tels que le module les
// exporte.
const nomsImportes = (liste) =>
  liste
    .split(',')
    .map((nom) => nom.trim().split(/\s+as\s+|\s*:\s*/)[0])
    .filter((nom) => nom !== '');

// Imports d'écriture de node:fs d'un texte, chacun { indice, ecrit } : ecrit
// nomme les fonctions d'écriture importées par leur nom, ou « entier » pour
// le module entier. Un chargement dont le mot-clé ne subsiste pas dans le
// texte sans chaînes n'en est pas un, ni l'import du module seul.
function importsDEcriture(texte, code) {
  return chargementsLitteraux(texte).flatMap(({ indice, specificateur }) => {
    if (!MODULE_FS.test(specificateur) || !estDuCode(code, indice)) return [];
    let noms;
    if (code.startsWith('from', indice)) {
      const clause = code.slice(code.lastIndexOf('import', indice) + 'import'.length, indice);
      const accolades = /\{([^}]*)\}/.exec(clause);
      const reste = clause.replace(/\{[^}]*\}/, '').replace(/[\s,]/g, '');
      noms = accolades !== null && reste === '' ? nomsImportes(accolades[1]) : null;
    } else if (/^import\s+['"]/.test(texte.slice(indice))) {
      return [];
    } else {
      const avant = /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(?:await\s+)?$/.exec(code.slice(0, indice));
      noms = avant === null ? null : nomsImportes(avant[1]);
    }
    if (noms?.some((nom) => nom === 'promises' || nom === 'default')) noms = null;
    if (noms === null) return [{ indice, ecrit: `${specificateur} entier` }];
    const ecrits = noms.filter((nom) => ECRITURES_FS.has(nom));
    return ecrits.length === 0 ? [] : [{ indice, ecrit: `${specificateur} ${ecrits.join(', ')}` }];
  });
}

// La commande surveillée : vitest sur le seul projet node (§ 14.4).
const COMMANDES_SURVEILLEES = new Set(['vitest --project node', 'vitest --project=node']);

// Relevé de la série surveillée (§ 14.4, § 14.14), sur les épreuves du
// projet node donné : par épreuve, puis par ligne, un délai fixe, un appel de
// la géométrie du rendu, et un import d'écriture de node:fs dans un fichier
// dont le code — commentaires et chaînes exclus — n'appelle ni mkdtemp ni
// mkdtempSync, « fichier:ligne écrit sans
// mkdtemp : module fonctions » ; puis le script test:surveille de
// package.json quand il lance autre chose que vitest sur le projet node. La
// garde voit l'import, non le chemin : l'écriture hors du temporaire d'un
// fichier qui en crée un reste à la revue. Lève quand la série ne porte
// aucune épreuve.
function releverSerieSurveillee(racine, projet) {
  const refus = epreuvesDuProjet(racine, projet).flatMap((fichier) => {
    const texte = readFileSync(fichier, 'utf8');
    const code = sansChaines(texte);
    const ecritures = TEMPORAIRE.test(codeSeul(texte))
      ? []
      : importsDEcriture(texte, code).map(({ indice, ecrit }) => ({
          ligne: ligneDe(texte, indice),
          motif: `écrit sans mkdtemp : ${ecrit}`,
        }));
    return [...ecritures, ...delaisEt(texte, code, [...DELAIS, ...GEOMETRIE_DU_RENDU])]
      .sort((a, b) => a.ligne - b.ligne)
      .map(({ ligne, motif }) => `${relative(racine, fichier)}:${ligne} ${motif}`);
  });
  const { scripts = {} } = JSON.parse(readFileSync(join(racine, 'package.json'), 'utf8'));
  const surveille = (scripts['test:surveille'] ?? '').trim().split(/\s+/).join(' ');
  if (!COMMANDES_SURVEILLEES.has(surveille)) {
    refus.push(`package.json test:surveille : « ${surveille} » ne lance pas vitest --project node seul`);
  }
  return refus;
}

describe('arborescence : la série surveillée (§ 14.4, § 14.14)', () => {
  test("aucune épreuve de la série surveillée n'attend un délai, n'appelle la géométrie du rendu, ni n'importe une écriture de node:fs sans créer de temporaire ; test:surveille ne lance que le projet node", () => {
    assert.deepEqual(releverSerieSurveillee(RACINE, projetSurveille(configuration.test.projects)), []);
  });

  test('la garde relève chaque refus par sa ligne, dans les seules épreuves du projet, et le script surveillé qui lance autre chose', () => {
    const projet = {
      include: ['src/**/*.test.js', 'test/**/*.test.js'],
      exclude: ['**/*.long.test.js', '**/*.navigateur.test.js', 'src/moteur/lourde.test.js'],
    };
    const fichiers = {
      'package.json': JSON.stringify({ scripts: { 'test:surveille': 'vitest  --project node' } }),
      'src/geometrie/vue.test.js': [
        "import { writeFileSync, readFileSync as lire } from 'node:fs';",
        'await new Promise((fin) => setTimeout(fin, 0));',
        'const boite = element.getBBox();',
        'const ctm = svg?.getScreenCTM?.();',
        "// au navigateur, getComputedTextLength mesure le texte ; ce commentaire ne l'appelle pas",
        "const longueur = texte.getComputedTextLength() + 'getBBox()'.length;",
        "import { setTimeout as attendre } from 'node:timers/promises';",
        'await new Promise((fin) => setImmediate(fin));',
      ].join('\n'),
      'test/ecrit.test.js': [
        "import fs from 'node:fs';",
        "import * as fsp from 'node:fs/promises';",
        "import { promises } from 'fs';",
        "const { rmSync, existsSync } = require('node:fs');",
        "const module = await import('node:fs');",
        "import { mkdir as creer, cpSync } from 'fs/promises';",
        "import 'node:fs';",
        "const donnee = \"import { writeFileSync } from 'node:fs';\";",
      ].join('\n'),
      'test/temporaire.test.js': [
        "import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';",
        "const racine = mkdtempSync('arbre-');",
      ].join('\n'),
      // Seul un commentaire nomme mkdtempSync( : le fichier n'en crée aucun.
      'test/commente.test.js': [
        "import { writeFileSync } from 'node:fs';",
        '// mkdtempSync( se lit ici, sans être appelé',
      ].join('\n'),
      'test/lecture.test.js': "import { readFileSync, existsSync } from 'node:fs';\nconst { statSync } = require('fs');\n",
      'src/moteur/lourde.test.js': 'await new Promise((fin) => setTimeout(fin, 0));\n',
      'src/moteur/a.long.test.js': "import { writeFileSync } from 'node:fs';\n",
      'src/interface/A.navigateur.test.js': 'element.getBBox();\n',
      'src/stockage/ecrire.js': "import { writeFileSync } from 'node:fs';\n",
    };
    assert.deepEqual(avecArbre(fichiers, (racine) => releverSerieSurveillee(racine, projet)), [
      'src/geometrie/vue.test.js:1 écrit sans mkdtemp : node:fs writeFileSync',
      'src/geometrie/vue.test.js:2 setTimeout',
      'src/geometrie/vue.test.js:3 getBBox',
      'src/geometrie/vue.test.js:4 getScreenCTM',
      'src/geometrie/vue.test.js:6 getComputedTextLength',
      'src/geometrie/vue.test.js:7 import node:timers/promises',
      'test/commente.test.js:1 écrit sans mkdtemp : node:fs writeFileSync',
      'test/ecrit.test.js:1 écrit sans mkdtemp : node:fs entier',
      'test/ecrit.test.js:2 écrit sans mkdtemp : node:fs/promises entier',
      'test/ecrit.test.js:3 écrit sans mkdtemp : fs entier',
      'test/ecrit.test.js:4 écrit sans mkdtemp : node:fs rmSync',
      'test/ecrit.test.js:5 écrit sans mkdtemp : node:fs entier',
      'test/ecrit.test.js:6 écrit sans mkdtemp : fs/promises mkdir, cpSync',
    ]);
    for (const script of ['vitest', 'vitest --project node --project navigateur', 'vitest run --project node']) {
      const autre = { ...fichiers, 'package.json': JSON.stringify({ scripts: { 'test:surveille': script } }) };
      assert.deepEqual(
        avecArbre(autre, (racine) => releverSerieSurveillee(racine, projet)).at(-1),
        `package.json test:surveille : « ${script} » ne lance pas vitest --project node seul`,
        script,
      );
    }
    assert.throws(
      () => avecArbre({ 'package.json': '{}', 'src/a.long.test.js': '' }, (racine) => releverSerieSurveillee(racine, projet)),
      /la série surveillée ne porte aucune épreuve/,
    );
  });
});

// Ce que relance au moins un changement de composant de src/interface, et
// d'une feuille de style de src/interface, quoi que lise le texte des
// épreuves : les gardes des sources de l'interface, des couches et de la
// palette, et celles dont le texte ne lie pas la lecture au fichier — le
// contrôle de version balaie tout l'arbre src sans filtre d'extension,
// test/projets.test.js importe App pour en voir l'échec sous node, quel que
// soit le composant changé. Les épreuves qui lisent ces fichiers par le
// disque s'y ajoutent (lecteursParLeDisque).
const RELANCES_REQUISES_D_UN_COMPOSANT = [
  'test/arborescence.test.js',
  'test/sources_interface.test.js',
  'scripts/version.test.js',
  'test/projets.test.js',
];
const RELANCES_REQUISES_D_UNE_FEUILLE = [
  'src/interface/palette.test.js',
  'test/sources_interface.test.js',
  'scripts/version.test.js',
];

// Une table de libellés : un module d'un dossier libelles/ de l'application
// ou de l'interface. Les épreuves l'importent ; le graphe suffit.
const TABLE_DE_LIBELLES = /^src\/(?:application|interface)\/libelles\/[^/]+\.[cm]?js$/;

// Fichiers que chaque épreuve donnée importe, à toute profondeur, par un
// chargement dont le mot-clé subsiste dans le texte sans chaînes et dont le
// chemin, relatif ou absolu depuis la racine, désigne un fichier existant —
// suffixe de Vite retiré. Le parcours suit les modules JavaScript hors de
// node_modules ; un composant ou une feuille de style est importé sans être
// parcouru, comme Vitest sous node, sans greffon Svelte. Rend une Map
// fichier relatif → épreuves relatives qui l'importent.
function importateurs(racine, epreuves) {
  const voisins = new Map();
  const cibles = (fichier) => {
    if (!voisins.has(fichier)) {
      const texte = readFileSync(fichier, 'utf8');
      const code = sansChaines(texte);
      voisins.set(
        fichier,
        chargementsLitteraux(texte)
          .filter(({ indice }) => estDuCode(code, indice))
          .map(({ specificateur }) => cibleDe(racine, fichier, specificateur.replace(/\?.*$/, '')))
          .filter((cible) => cible !== null && statSync(cible, { throwIfNoEntry: false })?.isFile()),
      );
    }
    return voisins.get(fichier);
  };
  const parFichier = new Map();
  for (const epreuve of epreuves) {
    const vus = new Set([epreuve]);
    const aParcourir = [epreuve];
    for (let i = 0; i < aParcourir.length; i += 1) {
      for (const cible of cibles(aParcourir[i])) {
        if (vus.has(cible)) continue;
        vus.add(cible);
        const chemin = enBarres(racine, cible);
        parFichier.set(chemin, [...(parFichier.get(chemin) ?? []), enBarres(racine, epreuve)]);
        if (EXTENSIONS_MODULE.has(extname(cible)) && !cible.split(sep).includes('node_modules')) aParcourir.push(cible);
      }
    }
  }
  return parFichier;
}

// Contenus des chaînes littérales d'un texte, lus aux places que sansChaines
// blanchit : entre deux délimiteurs, ou entre un délimiteur et la
// substitution d'un gabarit. Une place que sansChaines garde telle quelle —
// un commentaire entre deux apostrophes — ne rend que des blancs, écartés.
function chainesDe(texte) {
  const code = sansChaines(texte);
  return [...code.matchAll(/[`'"}]( +)(?=[`'"]|\$\{)/g)]
    .map(({ 1: blancs, index }) => texte.slice(index + 1, index + 1 + blancs.length))
    .filter((contenu) => contenu.trim() !== '');
}

// Un appel qui lit un fichier, et un appel qui balaie un dossier, dans le
// texte sans chaînes d'un module.
const LECTURE_D_UN_FICHIER = /\b(?:readFileSync|readFile)\s*\(/;
const BALAYAGE_D_UN_DOSSIER = /\b(?:readdirSync|readdir|globSync|glob)\s*\(/;

// Les épreuves qui lisent un fichier par le disque, hors de tout graphe
// d'imports. Une épreuve se juge avec les modules JavaScript du projet
// qu'elle importe à toute profondeur (parFichier, que rend importateurs),
// pris ensemble : elle lit un fichier quand l'un d'eux lit un fichier et que
// l'un d'eux — le même ou un autre — porte une chaîne littérale qui finit
// sur son nom (« ./jetons.css », « src/interface/jetons.css ») ; ou quand
// l'un d'eux balaie un dossier et que l'un d'eux nomme son extension, en
// chaîne littérale exacte (« .css ») ou dans une expression régulière
// (« \.css », « \.(svelte|css) »). Une épreuve qui nomme la feuille et
// passe le nom à une aide qui la lit la lit donc. Le relevé est textuel : un
// nom de fichier dans les données d'une épreuve qui lit compte comme une
// lecture, d'où des noms inventés dans ces données ; un balayage sans filtre
// d'extension ni extension nommée, comme celui du contrôle de version, ne se
// lie à aucun fichier et se déclare dans les relances requises. Rend une
// fonction : chemin relatif → Set des épreuves relatives qui le lisent.
function lecteursParLeDisque(racine, epreuves, parFichier) {
  const modulesDe = new Map(epreuves.map((epreuve) => [enBarres(racine, epreuve), [enBarres(racine, epreuve)]]));
  for (const [chemin, qui] of parFichier) {
    if (!EXTENSIONS_MODULE.has(extname(chemin)) || chemin.split('/').includes('node_modules')) continue;
    for (const epreuve of qui) modulesDe.get(epreuve).push(chemin);
  }
  const resumes = new Map();
  const resume = (chemin) => {
    if (!resumes.has(chemin)) {
      const texte = readFileSync(join(racine, chemin), 'utf8');
      const code = sansChaines(texte);
      resumes.set(chemin, { code, chaines: chainesDe(texte), lit: LECTURE_D_UN_FICHIER.test(code), balaie: BALAYAGE_D_UN_DOSSIER.test(code) });
    }
    return resumes.get(chemin);
  };
  const ensembles = [...modulesDe].map(([epreuve, chemins]) => {
    const membres = chemins.map(resume);
    return {
      epreuve,
      codes: membres.map(({ code }) => code),
      chaines: membres.flatMap(({ chaines }) => chaines),
      lit: membres.some(({ lit }) => lit),
      balaie: membres.some(({ balaie }) => balaie),
    };
  });
  return (fichier) => {
    const nom = basename(fichier);
    const extension = extname(fichier);
    const enExpression = new RegExp(String.raw`(?<![\w-])\\\.(?:\(\?:|\()?(?:\w+\|)*${extension.slice(1)}\b`);
    const lisent = ensembles.filter(
      ({ codes, chaines, lit, balaie }) =>
        (lit && chaines.some((contenu) => contenu === nom || contenu.endsWith(`/${nom}`))) ||
        (balaie && (chaines.includes(extension) || codes.some((code) => enExpression.test(code)))),
    );
    return new Set(lisent.map(({ epreuve }) => epreuve));
  };
}

// Relevé des motifs de surveillance (§ 14.14) d'une configuration de Vitest
// — { watchTriggerPatterns, projects } — sur l'arbre donné. Un fichier qui
// répond à un motif ne relance que les épreuves que le motif nomme, et plus
// celles qui l'importent : par motif, dans l'ordre de la liste, chaque
// fichier du projet qui y répond et qu'importe une épreuve de la série
// surveillée que le motif ne relance pas, « motif n /…/ : fichier, qu'importe
// épreuve, ne la relance pas » ; « motif n /…/ : ne répond à aucun fichier »
// quand aucun fichier de l'arbre n'y répond ; chaque table de libellés qu'il nomme ;
// chaque épreuve qu'il relance et que l'arbre n'a pas. Puis les relances
// requises des composants (.svelte) de src/interface, et de ses feuilles de
// style (.css) : pour chaque fichier, celles de RELANCES_REQUISES_D_UN_COMPOSANT
// ou de RELANCES_REQUISES_D_UNE_FEUILLE, et chaque épreuve de la série
// surveillée qui le lit par le disque (lecteursParLeDisque). Par épreuve,
// les requises d'abord, puis les autres triées : « aucun des n composants de
// src/interface ne relance épreuve » quand tous la requièrent et qu'aucun ne
// la relance, sinon « fichiers ne relance pas épreuve ». Lève quand la
// configuration ne porte aucun motif, ou que src/interface n'a aucun
// composant ou aucune feuille de style.
function releverSurveillance(racine, { watchTriggerPatterns: motifs = [], projects }) {
  assert.ok(motifs.length > 0, 'aucun motif de surveillance');
  const fichiers = fichiersDuProjet(racine).map((fichier) => enBarres(racine, fichier));
  const presents = new Set(fichiers);
  const epreuves = epreuvesDuProjet(racine, projetSurveille(projects));
  const parFichier = importateurs(racine, epreuves);
  const repond = ({ pattern }, chemin) => new RegExp(pattern.source, pattern.flags.replace('g', '')).test(chemin);
  const relances = (motif, chemin) => [motif.testsToRun(chemin) ?? []].flat();
  const refus = [];
  motifs.forEach((motif, rang) => {
    const nom = `motif ${rang + 1} ${motif.pattern}`;
    const absentes = new Set();
    const repondants = fichiers.filter((f) => repond(motif, f));
    if (repondants.length === 0) refus.push(`${nom} : ne répond à aucun fichier`);
    for (const chemin of repondants) {
      const relancees = relances(motif, chemin);
      if (TABLE_DE_LIBELLES.test(chemin) && !EPREUVE.test(chemin)) refus.push(`${nom} : nomme la table de libellés ${chemin}`);
      for (const epreuve of [...(parFichier.get(chemin) ?? [])].sort()) {
        if (!relancees.includes(epreuve)) refus.push(`${nom} : ${chemin}, qu'importe ${epreuve}, ne la relance pas`);
      }
      for (const epreuve of relancees) if (!presents.has(epreuve)) absentes.add(epreuve);
    }
    refus.push(...[...absentes].sort().map((epreuve) => `${nom} : relance ${epreuve}, absente de l'arbre`));
  });
  const relanceesPar = (chemin) => new Set(motifs.filter((m) => repond(m, chemin)).flatMap((m) => relances(m, chemin)));
  const lecteurs = lecteursParLeDisque(racine, epreuves, parFichier);
  const deSrcInterface = (extension) => fichiers.filter((f) => f.startsWith('src/interface/') && extname(f) === extension);
  const familles = [
    { membres: deSrcInterface('.svelte'), requises: RELANCES_REQUISES_D_UN_COMPOSANT, vide: 'aucun composant', tous: 'composants' },
    { membres: deSrcInterface('.css'), requises: RELANCES_REQUISES_D_UNE_FEUILLE, vide: 'aucune feuille de style', tous: null },
  ];
  for (const { membres, requises, vide, tous } of familles) {
    assert.ok(membres.length > 0, `src/interface ne fournit ${vide}`);
    const exigees = new Map(membres.map((f) => [f, new Set([...requises, ...lecteurs(f)])]));
    const autres = [...new Set([...exigees.values()].flatMap((s) => [...s]))].filter((e) => !requises.includes(e)).sort();
    for (const epreuve of [...requises, ...autres]) {
      const concernes = membres.filter((f) => exigees.get(f).has(epreuve));
      const manquent = concernes.filter((f) => !relanceesPar(f).has(epreuve));
      if (manquent.length === 0) continue;
      if (tous !== null && manquent.length === membres.length && membres.length > 1) {
        refus.push(`aucun des ${membres.length} ${tous} de src/interface ne relance ${epreuve}`);
      } else {
        refus.push(`${manquent.join(', ')} ne relance pas ${epreuve}`);
      }
    }
  }
  return refus;
}

describe('arborescence : les motifs de surveillance (§ 14.14)', () => {
  test("un motif ne nomme aucun fichier qu'une épreuve importe sans qu'il la relance, ni une table de libellés ; les composants et les feuilles de style relancent les gardes requises et chaque épreuve qui les lit par le disque", () => {
    assert.deepEqual(releverSurveillance(RACINE, configuration.test), []);
  });

  test('la garde relève un fichier importé que son motif ne relance pas, une table de libellés nommée, une épreuve absente, chaque relance requise qui manque et chaque lecteur par le disque non relancé', () => {
    const projects = [{ test: { name: 'node', include: ['src/**/*.test.js', 'test/**/*.test.js'], exclude: ['**/*.navigateur.test.js'] } }];
    const fichiers = {
      'src/interface/App.svelte': '<p></p>\n',
      'src/interface/plan/Plan.svelte': '<p></p>\n',
      'src/interface/teintes.css': ':root {}\n',
      'src/interface/libelles/plan.js': 'export const TABLE = new Map();\n',
      'src/interface/palette.js': "import { TABLE } from './libelles/plan.js';\n",
      'src/interface/palette.test.js': "import { TABLE } from './palette.js';\nconst donnee = \"import x from './modele.js';\";\n",
      'src/interface/modele.js': 'export const x = 1;\n',
      'src/interface/App.navigateur.test.js': "import App from './App.svelte';\n",
      // Lit la feuille par son nom.
      'src/interface/nuances.test.js': "import { readFileSync } from 'node:fs';\nconst feuille = readFileSync(new URL('./teintes.css', import.meta.url), 'utf8');\n",
      // Balaie composants et feuilles par le module qu'elle importe.
      'test/entetes.test.js': "import { lireTout } from './balayage.js';\nlireTout();\n",
      'test/balayage.js': "import { readdirSync } from 'node:fs';\nexport const lireTout = () => readdirSync('src', { recursive: true }).filter((nom) => /\\.(svelte|css)$/.test(nom));\n",
      // Nomme la feuille sans la lire, et lit une donnée qui la cite sans finir sur son nom.
      'src/interface/nomme.test.js': "const chemin = './teintes.css';\n",
      'src/interface/cite.test.js': "import { readFileSync } from 'node:fs';\nconst donnee = \"  @import 'teintes.css';\";\nreadFileSync(donnee);\n",
      // Nomme la feuille ; le module qu'elle importe la lit.
      'src/interface/combine.test.js': "import { lireFeuille } from '../../test/lecture.js';\nlireFeuille('./teintes.css');\n",
      'test/lecture.js': "import { readFileSync } from 'node:fs';\nexport const lireFeuille = (chemin) => readFileSync(chemin, 'utf8');\n",
      // Nomme l'extension ; le module qu'elle importe balaie, sans filtre.
      'src/interface/extension.test.js': "import { tout } from '../../test/inventaire.js';\nconst feuilles = tout().filter((nom) => nom.endsWith('.css'));\n",
      'test/inventaire.js': "import { readdirSync } from 'node:fs';\nexport const tout = () => readdirSync('src', { recursive: true });\n",
      'test/projets.test.js': "const App = await import('../src/interface/App.svelte?inline');\n",
      'test/arborescence.test.js': '',
      'scripts/version.test.js': '',
    };
    const motifs = [
      { pattern: /\.svelte$/, testsToRun: () => ['test/arborescence.test.js', 'scripts/version.test.js'] },
      { pattern: /(^|\/)src\/interface\/libelles\/[^/]+$/, testsToRun: () => 'src/interface/palette.test.js' },
      { pattern: /(^|\/)src\/interface\/(teintes\.css|modele\.js)$/, testsToRun: () => ['test/sources_interface.test.js'] },
      // Mal écrit : aucun fichier n'y répond.
      { pattern: /(^|\/)electrn\/[^/]+$/, testsToRun: () => ['test/coquille.test.js'] },
    ];
    assert.deepEqual(avecArbre(fichiers, (racine) => releverSurveillance(racine, { watchTriggerPatterns: motifs, projects })), [
      "motif 1 /\\.svelte$/ : src/interface/App.svelte, qu'importe test/projets.test.js, ne la relance pas",
      'motif 2 /(^|\\/)src\\/interface\\/libelles\\/[^/]+$/ : nomme la table de libellés src/interface/libelles/plan.js',
      "motif 3 /(^|\\/)src\\/interface\\/(teintes\\.css|modele\\.js)$/ : relance test/sources_interface.test.js, absente de l'arbre",
      'motif 4 /(^|\\/)electrn\\/[^/]+$/ : ne répond à aucun fichier',
      'aucun des 2 composants de src/interface ne relance test/sources_interface.test.js',
      'aucun des 2 composants de src/interface ne relance test/projets.test.js',
      'aucun des 2 composants de src/interface ne relance test/entetes.test.js',
      'src/interface/teintes.css ne relance pas src/interface/palette.test.js',
      'src/interface/teintes.css ne relance pas scripts/version.test.js',
      'src/interface/teintes.css ne relance pas src/interface/combine.test.js',
      'src/interface/teintes.css ne relance pas src/interface/extension.test.js',
      'src/interface/teintes.css ne relance pas src/interface/nuances.test.js',
      'src/interface/teintes.css ne relance pas test/entetes.test.js',
    ]);
    const conformes = [
      { pattern: /(^|\/)src\/interface\/.*\.svelte$/, testsToRun: () => [...RELANCES_REQUISES_D_UN_COMPOSANT, 'test/entetes.test.js'] },
      { pattern: /(^|\/)src\/interface\/teintes\.css$/,
        testsToRun: () => [
          ...RELANCES_REQUISES_D_UNE_FEUILLE,
          'src/interface/combine.test.js',
          'src/interface/extension.test.js',
          'src/interface/nuances.test.js',
          'test/entetes.test.js',
        ] },
      { pattern: /(^|\/)src\/interface\/plan\/Plan\.svelte$/, testsToRun: () => [] },
    ];
    const complets = { ...fichiers, 'test/sources_interface.test.js': '' };
    assert.deepEqual(avecArbre(complets, (racine) => releverSurveillance(racine, { watchTriggerPatterns: conformes, projects })), []);
    const partiel = [
      { pattern: /App\.svelte$/, testsToRun: () => [...RELANCES_REQUISES_D_UN_COMPOSANT, 'test/entetes.test.js'] },
      conformes[1],
    ];
    assert.deepEqual(
      avecArbre(complets, (racine) => releverSurveillance(racine, { watchTriggerPatterns: partiel, projects })),
      [...RELANCES_REQUISES_D_UN_COMPOSANT, 'test/entetes.test.js'].map((requise) => `src/interface/plan/Plan.svelte ne relance pas ${requise}`),
    );
    const { 'src/interface/teintes.css': _feuille, ...sansFeuille } = complets;
    assert.throws(
      () => avecArbre(sansFeuille, (racine) => releverSurveillance(racine, { watchTriggerPatterns: conformes, projects })),
      /src\/interface ne fournit aucune feuille de style/,
    );
    assert.throws(() => releverSurveillance(RACINE, { watchTriggerPatterns: [], projects }), /aucun motif de surveillance/);
  });
});

// --- Un seul chemin, un seul langage, des épreuves à leur place -------------

// Le code d'un texte sans ses chaînes ni ses commentaires : sansChaines,
// puis chaque commentaire « // … » et « /* … */ » blanchi, fins de ligne
// gardées. Les chaînes déjà blanchies n'ouvrent plus aucun commentaire.
function codeSeul(texte) {
  return sansChaines(texte).replace(/\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/g, (commentaire) => commentaire.replace(/[^\n]/g, ' '));
}

// Les seuls lecteurs des réservations dans le moteur (§ 5.2) : la
// réservation est un prétraitement qui réduit l'instance — capacités,
// mobiles, organisations des ancrés —, jamais un second algorithme.
const LECTEURS_DES_RESERVATIONS = [
  {
    fichier: 'src/moteur/configuration.js',
    raison: 'normaliser fixe les réservations et réduit l’instance que la recherche résout',
  },
  {
    fichier: 'src/moteur/diagnostic.js',
    raison: 'le diagnostic sonde la configuration sous une partie de ses réservations pour nommer la cause',
  },
];

// Une lecture des réservations : le nom reservations dans le code —
// propriété, déstructuration, paramètre —, ou une propriété nommée par une
// chaîne entre crochets.
const LECTURE_DES_RESERVATIONS = /\breservations\b/g;
const RESERVATIONS_ENTRE_CROCHETS = /\[\s*(['"`])reservations\1\s*\]/g;

// Relevé des lectures des réservations dans les modules de src/moteur, à
// toute profondeur, épreuves exclues, hors des lecteurs admis : chacune
// « fichier:ligne reservations », ou « fichier:ligne ['reservations'] » pour
// la forme à crochets, par fichier puis par ligne ; puis « exception sans
// objet : fichier » pour un lecteur admis qui n'en lit aucune. Le nom se lit
// dans le code sans chaînes ni commentaires : un typedef JSDoc qui le nomme
// ne lit rien. Lève quand src/moteur ne fournit aucun module.
function releverLecteursDesReservations(racine, admis = LECTEURS_DES_RESERVATIONS) {
  const modules = modulesDe(join(racine, 'src', 'moteur'));
  assert.ok(modules.length > 0, 'src/moteur ne fournit aucun module');
  const lecteurs = new Set();
  const refus = [];
  for (const fichier of modules) {
    const nom = enBarres(racine, fichier);
    const texte = readFileSync(fichier, 'utf8');
    const code = codeSeul(texte);
    // Le crochet d'une lecture subsiste dans le code ; celui d'un
    // commentaire est blanchi avec lui.
    const trouves = [
      ...[...code.matchAll(LECTURE_DES_RESERVATIONS)].map(({ index }) => ({ indice: index, rang: 0, motif: 'reservations' })),
      ...[...texte.matchAll(RESERVATIONS_ENTRE_CROCHETS)]
        .filter(({ index }) => code[index] === '[')
        .map(({ index }) => ({ indice: index, rang: 1, motif: "['reservations']" })),
    ];
    if (trouves.length > 0) lecteurs.add(nom);
    if (admis.some((e) => e.fichier === nom)) continue;
    trouves.sort((a, b) => a.indice - b.indice || a.rang - b.rang);
    refus.push(...trouves.map(({ indice, motif }) => `${nom}:${ligneDe(texte, indice)} ${motif}`));
  }
  const sansObjet = admis.filter(({ fichier }) => !lecteurs.has(fichier)).map(({ fichier }) => `exception sans objet : ${fichier}`);
  return [...refus, ...sansObjet];
}

// Les arbres du code livré et de son outillage, où ne vit qu'une langue
// (§ 13.2) : JavaScript, composants Svelte, feuilles de style, et des
// données JSON, qui ne calculent rien.
const ARBRES_D_UNE_LANGUE = ['src', 'electron', 'scripts'];
const EXTENSIONS_D_UNE_LANGUE = new Set(['.js', '.cjs', '.mjs', '.svelte', '.css', '.json']);

// Les scripts d'installation et de construction, chacun à sa place : ils
// posent l'outillage ou le lancent, et ne refont aucun calcul du logiciel.
const SCRIPTS_NOMMES = [
  { fichier: 'scripts/construire_windows.sh', raison: 'construit l’exécutable Windows depuis Linux (§ 16)' },
  { fichier: 'scripts/verifier_systemes.sh', raison: 'éprouve l’installation sur chaque système, dans un conteneur' },
  { fichier: 'scripts/installation/avec_node.sh', raison: 'lance une commande avec le Node du projet' },
  { fichier: 'scripts/installation/commun.sh', raison: 'fonctions communes des scripts d’installation' },
  { fichier: 'scripts/installation/shell.nix', raison: 'environnement de développement sous NixOS' },
  {
    fichier: 'scripts/oracle/pcg32_reference.sh',
    raison: 'compile et lance la référence de PCG32, oracle pris hors du code éprouvé (§ 14.11)',
  },
  { fichier: 'scripts/windows/avec_node.ps1', raison: 'lance une commande avec le Node du projet, sous Windows' },
  { fichier: 'scripts/windows/commun.ps1', raison: 'fonctions communes des scripts Windows' },
  { fichier: 'scripts/windows/installer.ps1', raison: 'installe le projet sous Windows' },
  { fichier: 'scripts/windows/lancer.ps1', raison: 'lance le projet sous Windows' },
];

// Les données nommées, chacune à sa seule place : les deux fichiers de la
// police embarquée, que Vite incruste, et leur provenance, que lit
// test/polices.test.js ; les deux fichiers du logo de TechnoLibre, que Vite
// incruste aussi, et qui viennent de l'éditeur. Ce sont des données, qui ne
// calculent rien.
const DONNEES_NOMMEES = [
  { fichier: 'src/polices/NotoSans-Regular.ttf', raison: 'la police embarquée, graisse normale (§ 11.1, § 14.15)' },
  { fichier: 'src/polices/NotoSans-Bold.ttf', raison: 'la police embarquée, graisse grasse (§ 11.1, § 14.15)' },
  { fichier: 'src/polices/PROVENANCE', raison: 'version amont, adresse et empreinte de chaque fichier de la police' },
  { fichier: 'src/actifs/full_logo_technolibre_2023.svg', raison: 'le logo de TechnoLibre, marque de l’éditeur, tel qu’il le fournit (§ 18.6)' },
  { fichier: 'src/actifs/full_logo_technolibre_2023.png', raison: 'le logo de TechnoLibre, marque de l’éditeur, tel qu’il le fournit (§ 18.6)' },
];

// Fichiers que le disque porte sans qu'ils soient du projet : l'index de
// dossier .DS_Store, l'échange de Vim (.x.js.swp, .x.js.swo…), le verrou
// d'Emacs (.#x.js), une sauvegarde d'éditeur (x.js~, #x.js#), un reste de
// fusion ou de correctif (x.js.orig, x.js.rej). Un autre nom caché est un
// fichier comme un autre : .calcul.py porte un second langage. Le relevé des
// langues est le seul à admettre une extension par sa liste plutôt qu'à
// choisir la sienne : sans ce filtre, il tombe sur un arbre conforme dès
// qu'un éditeur est ouvert, et la série surveillée le relance à chaque
// sauvegarde. La liste de git ne les écarte pas : ces noms ne sont pas
// ignorés par le dépôt, et --others les rend comme tout fichier nouveau.
const estArtefact = (nom) =>
  nom === '.DS_Store' ||
  /^\..+\.sw[a-p]$/.test(nom) ||
  nom.startsWith('.#') ||
  nom.endsWith('~') ||
  /^#.*#$/.test(nom) ||
  /\.(orig|rej)$/.test(nom);

// Relevé des fichiers d'une autre langue sous src/, electron/ et scripts/, à
// toute profondeur, artefacts d'éditeur et de fusion écartés : chacun
// « chemin : extension », ou « chemin : sans extension », dans l'ordre des
// chemins, hors des extensions admises, des scripts et des données nommés ;
// puis « exception sans objet : fichier » pour un fichier nommé absent. Lève quand
// ces arbres ne portent aucun fichier.
function releverLangages(racine, nommes = [...SCRIPTS_NOMMES, ...DONNEES_NOMMEES]) {
  const fichiers = ARBRES_D_UNE_LANGUE.flatMap((arbre) => fichiersDe(join(racine, arbre)))
    .filter((fichier) => !fichier.split(sep).includes('node_modules') && !estArtefact(basename(fichier)))
    .map((fichier) => enBarres(racine, fichier))
    .sort();
  assert.ok(fichiers.length > 0, 'aucun fichier sous src/, electron/ et scripts/');
  const presents = new Set(fichiers);
  const refus = fichiers
    .filter((chemin) => !EXTENSIONS_D_UNE_LANGUE.has(extname(chemin)) && !nommes.some((e) => e.fichier === chemin))
    .map((chemin) => `${chemin} : ${extname(chemin) || 'sans extension'}`);
  const sansObjet = nommes.filter(({ fichier }) => !presents.has(fichier)).map(({ fichier }) => `exception sans objet : ${fichier}`);
  return [...refus, ...sansObjet];
}

// Les épreuves de src/ qui ne vivent pas à côté d'un module de leur
// répertoire, chacune avec sa raison.
const EPREUVES_SANS_VOISIN = [
  {
    fichier: 'src/interface/accueil/Accueil.navigateur.test.js',
    raison: 'l’accueil n’existe qu’au sein de l’application : l’épreuve monte App par test/navigateur/montage.js',
  },
  {
    fichier: 'src/interface/plan/ecouteurs.test.js',
    raison: 'garde des sources : elle lit les composants de son répertoire par le disque, sans les importer',
  },
];

// Relevé des épreuves de src/ éloignées de leur module (§ 14.9) : chaque
// *.test.js de src/, à toute profondeur, dont aucun chargement de code ne
// désigne un fichier existant de son propre répertoire qui ne soit pas une
// épreuve — module ou composant ; le suffixe de Vite se retire, et
// « ./travailleur.js?worker&inline » désigne le module voisin —, hors des
// exceptions nommées : chacune « épreuve : aucun module de répertoire »,
// dans l'ordre des chemins ; puis « exception sans objet : fichier » pour
// une exception qui a désormais un voisin ou n'existe plus. Lève quand src/
// ne porte aucune épreuve.
function releverEpreuvesEloignees(racine, admis = EPREUVES_SANS_VOISIN) {
  const epreuves = fichiersDe(join(racine, 'src'))
    .filter((fichier) => EPREUVE.test(fichier))
    .sort();
  assert.ok(epreuves.length > 0, 'aucune épreuve sous src/');
  const sansVoisin = epreuves.filter((fichier) => {
    const texte = readFileSync(fichier, 'utf8');
    const code = codeSeul(texte);
    return !chargementsLitteraux(texte).some(({ indice, specificateur }) => {
      const cible = cibleDe(racine, fichier, specificateur.replace(/\?.*$/, ''));
      return (
        estDuCode(code, indice) &&
        cible !== null &&
        dirname(cible) === dirname(fichier) &&
        !EPREUVE.test(cible) &&
        existsSync(cible)
      );
    });
  });
  const noms = sansVoisin.map((fichier) => enBarres(racine, fichier));
  const refus = noms
    .filter((nom) => !admis.some((e) => e.fichier === nom))
    .map((nom) => `${nom} : aucun module de ${dirname(nom)}`);
  const sansObjet = admis.filter(({ fichier }) => !noms.includes(fichier)).map(({ fichier }) => `exception sans objet : ${fichier}`);
  return [...refus, ...sansObjet];
}

// Les fichiers livrés qu'une donnée d'épreuve ne double pas (§ 14.9) : les
// exemples du § 10.3 et les démonstrations livrées.
const ARBRES_LIVRES = ['exemples', 'src/demo/livrees'];

// Relevé des données de test/fixtures/, à toute profondeur, égales octet
// pour octet à un fichier livré : chacune « donnée = fichier livré », dans
// l'ordre des chemins. Lève quand test/fixtures/ ou les arbres livrés ne
// portent aucun fichier.
function releverFixturesLivrees(racine) {
  const fixtures = fichiersDe(join(racine, 'test', 'fixtures')).sort();
  const livres = ARBRES_LIVRES.flatMap((arbre) => fichiersDe(join(racine, arbre))).sort();
  assert.ok(fixtures.length > 0, 'test/fixtures/ ne porte aucune donnée');
  assert.ok(livres.length > 0, 'aucun fichier livré sous exemples/ ni src/demo/livrees/');
  const octets = new Map(livres.map((fichier) => [fichier, readFileSync(fichier)]));
  return fixtures.flatMap((fixture) => {
    const contenu = readFileSync(fixture);
    return livres
      .filter((livre) => octets.get(livre).equals(contenu))
      .map((livre) => `${enBarres(racine, fixture)} = ${enBarres(racine, livre)}`);
  });
}

// Les seules épreuves qui chargent fast-check (§ 14.12) : la formule du
// plafond et la détection du séparateur, qui gagnent au rétrécissement ;
// deux propriétés du stockage, sur des paires de charges et des séances
// tirées, dont le contre-exemple rétréci tient en quelques opérations ; et
// la découpe du plan en pages, dont les tuiles se juxtaposent à l'égalité
// exacte sur des englobants, papiers et seuils tirés.
const CHARGEURS_DE_FAST_CHECK = [
  { fichier: 'src/moteur/plafond.test.js', raison: 'la formule du plafond, arbitrée par énumération exhaustive' },
  { fichier: 'src/moteur/plafond.long.test.js', raison: 'la grande grille du plafond, sous la même graine écrite' },
  { fichier: 'src/csv/lecture.test.js', raison: 'la détection du séparateur, arbitrée par construction' },
  {
    fichier: 'src/stockage/correctifs.test.js',
    raison: 'l’aller-retour appliquer(a, difference(a, b)) sur des paires de charges tirées',
  },
  {
    fichier: 'src/stockage/journal.long.test.js',
    raison: 'chaque instant d’une séance tirée se restitue tel qu’il s’est écrit',
  },
  {
    fichier: 'src/geometrie/pages.test.js',
    raison: 'les tuiles de la découpe, contiguës à l’égalité exacte, sur des englobants tirés',
  },
];

// Relevé des chargements de fast-check, sous-chemins compris, dans les
// fichiers JavaScript et les composants du projet, hors des épreuves
// nommées : chacun « fichier:ligne spécificateur », par fichier puis dans
// l'ordre du texte ; puis « exception sans objet : fichier » pour une
// épreuve nommée qui ne le charge pas. Un chargement écrit dans une chaîne,
// donnée d'épreuve, n'en est pas un. Lève quand le projet ne porte aucun
// module.
function releverFastCheck(racine, nommes = CHARGEURS_DE_FAST_CHECK) {
  const fichiers = fichiersDuProjet(racine).filter(
    (fichier) => EXTENSIONS_MODULE.has(extname(fichier)) || extname(fichier) === '.svelte',
  );
  assert.ok(fichiers.length > 0, 'aucun module dans le projet');
  const chargeurs = new Set();
  const refus = [];
  for (const fichier of fichiers) {
    const nom = enBarres(racine, fichier);
    const texte = readFileSync(fichier, 'utf8');
    const code = codeSansChaines(fichier, texte);
    const trouves = chargementsLitteraux(texte).filter(
      ({ indice, specificateur }) => estDuCode(code, indice) && nomDePaquet(specificateur) === 'fast-check',
    );
    if (trouves.length > 0) chargeurs.add(nom);
    if (nommes.some((e) => e.fichier === nom)) continue;
    refus.push(...trouves.map(({ indice, specificateur }) => `${nom}:${ligneDe(texte, indice)} ${specificateur}`));
  }
  const sansObjet = nommes.filter(({ fichier }) => !chargeurs.has(fichier)).map(({ fichier }) => `exception sans objet : ${fichier}`);
  return [...refus, ...sansObjet];
}

// Les fichiers qui passent les démonstrations à App : la page et le montage
// des épreuves du navigateur.
const PORTEURS_DES_DEMONSTRATIONS = ['src/main.js', 'test/navigateur/montage.js'];

// Relevé des compositions de démonstrations hors de src/demo/livrees.js :
// chaque porteur qui ne passe pas demonstrationsLivrees() à App, ou qui lit
// LIVREES ou CATALOGUE lui-même — « fichier : raison ».
function releverCompositions(racine, porteurs = PORTEURS_DES_DEMONSTRATIONS) {
  const releves = [];
  for (const chemin of porteurs) {
    const texte = readFileSync(join(racine, chemin), 'utf8');
    if (!/\bdemonstrationsLivrees\(\)/.test(texte)) releves.push(`${chemin} : demonstrationsLivrees() absent`);
    for (const nom of ['LIVREES', 'CATALOGUE']) if (new RegExp(`\\b${nom}\\b`).test(texte)) releves.push(`${chemin} : ${nom} lu`);
  }
  return releves;
}

describe('arborescence : une seule composition des démonstrations (§ 15)', () => {
  test('src/main.js et le montage des épreuves passent demonstrationsLivrees() à App, et ne composent rien eux-mêmes', () => {
    assert.deepEqual(releverCompositions(RACINE), []);
  });

  test('la garde relève un porteur qui recompose LIVREES par le catalogue, et un qui ne passe pas demonstrationsLivrees()', () => {
    const recompose =
      "import { CATALOGUE } from './demo/catalogue.js';\nimport { LIVREES } from './demo/livrees.js';\n" +
      'const demonstrations = LIVREES.map(({ cle, texte }) => ({ cle, nom: CATALOGUE.find((e) => e.cle === cle).nom, texte }));\n';
    const releves = avecArbre(
      { 'src/main.js': recompose, 'test/navigateur/montage.js': 'const d = demonstrationsLivrees();\n' },
      (racine) => releverCompositions(racine),
    );
    assert.deepEqual(releves, ['src/main.js : demonstrationsLivrees() absent', 'src/main.js : LIVREES lu', 'src/main.js : CATALOGUE lu']);
  });

  test('demonstrationsLivrees : chaque démonstration livrée, dans l’ordre de LIVREES, nommée par le catalogue ; un tableau neuf à chaque appel', () => {
    const rendues = demonstrationsLivrees();
    assert.deepEqual(rendues.map(({ cle }) => cle), LIVREES.map(({ cle }) => cle));
    for (const { cle, nom, texte } of rendues) {
      assert.equal(nom, CATALOGUE.find((entree) => entree.cle === cle).nom, cle);
      assert.equal(texte, LIVREES.find((livree) => livree.cle === cle).texte, cle);
    }
    assert.notEqual(demonstrationsLivrees(), rendues);
  });
});

// Le corps de mount(App, { props: { … } }) d'un module, '' sans lui.
const proprietesDApp = (code) => /\bmount\(App, \{[\s\S]*?\bprops: \{([\s\S]*?)\n\s*\},\n/.exec(code)?.[1] ?? '';
// L'objet que rend monterApp, '' sans lui : de « return { » à « }; » au
// premier niveau du corps de la fonction.
const renduDuMontage = (code) => /\n {2}return \{\n([\s\S]*?)\n {2}\};\n\}/.exec(code)?.[1] ?? '';
// Le corps de la déstructuration des dépendances d'App, '' sans lui.
const dependancesDApp = (code) => /\bconst \{\n([\s\S]*?)\n\s*\} = untrack\(\(\) => dependances\);/.exec(code)?.[1] ?? '';
const NOMMEE_SEULE = (nom) => new RegExp(`^\\s*${nom},$`, 'm');

// Le câblage de l'imprimante (§ 13.4) : par fichier, chaque pièce qu'il
// porte, commentaires ôtés — [ce qui manque, vrai quand la pièce est là].
// src/main.js construit l'imprimante de la plateforme, celle d'electron sur
// le pont window.gtt sous la coquille, celle du navigateur sur la fenêtre
// sinon, et la passe à App ; le montage des épreuves prend l'imprimante
// d'épreuve par défaut, la passe à App et la rend, sans rien importer de
// src/impression ; App la reçoit dans ses dépendances et la donne aux
// composants sous la clé de contexte 'imprimante'. Un motif d'import
// s'écrit « fro[m] », que la garde des dépendances ne prend pas pour un
// chargement.
const CABLAGE_DE_L_IMPRIMANTE = new Map([
  [
    'src/main.js',
    [
      ['import de creerImprimanteElectron absent', (code) => /^import \{ creerImprimanteElectron \} fro[m] '\.\/impression\/imprimante_electron\.js';$/m.test(code)],
      ['import de creerImprimanteWeb absent', (code) => /^import \{ creerImprimanteWeb \} fro[m] '\.\/impression\/imprimante_web\.js';$/m.test(code)],
      ['pont window.gtt absent', (code) => /^const pont = window\.gtt;$/m.test(code)],
      [
        'imprimante de la plateforme absente',
        (code) => /^const imprimante = sousElectron \? creerImprimanteElectron\(pont\) : creerImprimanteWeb\(window\);$/m.test(code),
      ],
      ['imprimante non passée à App', (code) => NOMMEE_SEULE('imprimante').test(proprietesDApp(code))],
    ],
  ],
  [
    'test/navigateur/montage.js',
    [
      ['import de creerImprimanteSimulee absent', (code) => /^import \{ creerImprimanteSimulee \} fro[m] '\.\.\/imprimante_simulee\.js';$/m.test(code)],
      ["imprimante d'épreuve par défaut absente", (code) => /^\s*imprimante = creerImprimanteSimulee\(\),$/m.test(code)],
      ['imprimante non passée à App', (code) => NOMMEE_SEULE('imprimante').test(proprietesDApp(code))],
      ['imprimante non rendue', (code) => NOMMEE_SEULE('imprimante').test(renduDuMontage(code))],
      ['src/impression importé', (code) => !/src\/impression\//.test(code)],
    ],
  ],
  [
    'src/interface/App.svelte',
    [
      ['imprimante absente des dépendances', (code) => NOMMEE_SEULE('imprimante').test(dependancesDApp(code))],
      ["contexte 'imprimante' non posé", (code) => /^\s*setContext\('imprimante', imprimante\);$/m.test(code)],
    ],
  ],
]);

// Relevé du câblage de l'imprimante : « fichier : ce qui manque », dans
// l'ordre de la table puis de ses pièces ; « fichier : fichier absent » pour
// un fichier que l'arbre n'a pas.
function releverCablageImprimante(racine, cablage = CABLAGE_DE_L_IMPRIMANTE) {
  const releves = [];
  for (const [chemin, pieces] of cablage) {
    if (!existsSync(join(racine, chemin))) {
      releves.push(`${chemin} : fichier absent`);
      continue;
    }
    const code = texteSansCommentaires(chemin, readFileSync(join(racine, chemin), 'utf8'));
    for (const [manque, presente] of pieces) if (!presente(code)) releves.push(`${chemin} : ${manque}`);
  }
  return releves;
}

describe("arborescence : le câblage de l'imprimante (§ 13.4)", () => {
  test("src/main.js construit l'imprimante de la plateforme, le montage des épreuves l'imprimante d'épreuve, chacun la passe à App, qui la donne aux composants sous la clé 'imprimante'", () => {
    assert.deepEqual(releverCablageImprimante(RACINE), []);
  });

  test("la garde relève chaque pièce absente, fichier par fichier, et un fichier absent ; un commentaire ne compte pas", () => {
    const releves = avecArbre(
      {
        'src/main.js':
          "import { creerImprimanteWeb } from './impression/imprimante_web.js';\n" +
          'const pont = window.gtt;\nconst imprimante = creerImprimanteWeb(window);\n' +
          'mount(App, {\n  target: document.body,\n  props: {\n    fs,\n  },\n});\nconst autre = { imprimante,\n};\n',
        'test/navigateur/montage.js':
          "import { creerImprimanteSimulee } from '../imprimante_simulee.js';\nimport { x } from '../../src/impression/imprimante_web.js';\n" +
          'export function monterApp({\n  imprimante = creerImprimanteSimulee(),\n} = {}) {\n' +
          '  const app = mount(App, {\n    target,\n    props: {\n      imprimante,\n    },\n  });\n  return {\n    app,\n  };\n}\n',
        'src/interface/App.svelte':
          "<script>\n  const {\n    fs,\n    imprimante,\n  } = untrack(() => dependances);\n  // setContext('imprimante', imprimante);\n</script>\n",
      },
      (racine) => [...releverCablageImprimante(racine), ...releverCablageImprimante(racine, new Map([['src/absent.js', []]]))],
    );
    assert.deepEqual(releves, [
      'src/main.js : import de creerImprimanteElectron absent',
      'src/main.js : imprimante de la plateforme absente',
      'src/main.js : imprimante non passée à App',
      'test/navigateur/montage.js : imprimante non rendue',
      'test/navigateur/montage.js : src/impression importé',
      "src/interface/App.svelte : contexte 'imprimante' non posé",
      'src/absent.js : fichier absent',
    ]);
  });
});

// La porte d'impression (§ 11.7) : toute impression passe par l'écran
// d'aperçu. App.svelte reçoit l'imprimante et la pose sous la clé de contexte
// 'imprimante' ; dans src/interface et src/application, seul l'aperçu lit ce
// contexte et appelle la fonction imprimer de l'imprimante, et aucun module
// ne touche print — que seule l'imprimante web de src/impression appelle, sur
// la fenêtre. Une lecture du contexte se reconnaît à getContext et à la clé
// entre apostrophes, guillemets ou accents graves. print se relève au nom
// suivi d'une parenthèse, chaînage optionnel compris, quel que soit l'objet
// qui le porte ; à toute mention sur l'objet global écrit par son nom —
// window, globalThis, self —, appelée ou non, une référence ainsi passée à un
// bouton étant une impression différée ; à une chaîne entre crochets ; à une
// déstructuration qui le tire. Une référence nue au print global, ou prise
// sur un alias de window, n'est pas relevée. imprimer se relève de même : par le point,
// appelé ou non, par une chaîne entre crochets ou par une déstructuration ;
// la fonction de l'aperçu qui porte ce nom n'est pas un passage. Le balisage
// d'un composant se lit tel quel, ses attributs entre guillemets compris :
// un « .imprimer » suivi d'un guillemet y clôt une valeur, comme la clé de
// libellé « impression.commande.imprimer », et ne se relève pas.
const ARBRES_D_UNE_PORTE = ['src/interface', 'src/application'];
const PORTE_D_IMPRESSION = 'src/interface/impression/Apercu.svelte';
const PASSAGES_D_IMPRESSION = [
  ["getContext('imprimante')", /\bgetContext\s*\(\s*(['"`])imprimante\1\s*\)/g, 'texte'],
  ['print()', /\bprint\s*(?:\?\.\s*)?\(/g, 'code'],
  ['.print', /\b(?:window|globalThis|self)\s*\??\.\s*print\b/g, 'code'],
  ["['print']", /\[\s*(['"`])print\1\s*\]/g, 'texte'],
  ['{ print }', /\{[^{}]*\bprint\b[^{}]*\}\s*=/g, 'code'],
  ['.imprimer', /\.\s*imprimer\b(?!\s*['"`])/g, 'code'],
  ["['imprimer']", /\[\s*(['"`])imprimer\1\s*\]/g, 'texte'],
  ['{ imprimer }', /\{[^{}]*\bimprimer\b[^{}]*\}\s*=/g, 'code'],
];
const RAISON_DE_LA_PORTE = "l'écran d'aperçu, d'où part toute impression : la page qu'il montre est celle qui s'imprime";
const LECTEURS_DE_L_IMPRIMANTE = [
  { fichier: PORTE_D_IMPRESSION, forme: "getContext('imprimante')", raison: RAISON_DE_LA_PORTE },
  { fichier: PORTE_D_IMPRESSION, forme: '.imprimer', raison: RAISON_DE_LA_PORTE },
];
const releverPortesDImpression = (racine) =>
  releverLectures(racine, { arbres: ARBRES_D_UNE_PORTE, formes: PASSAGES_D_IMPRESSION, lecteurs: LECTEURS_DE_L_IMPRIMANTE });

describe("arborescence : une seule porte d'impression (§ 11.7)", () => {
  test("seul src/interface/impression/Apercu.svelte lit le contexte 'imprimante' et appelle imprimer, et aucun module de src/interface ni de src/application ne touche print", () => {
    assert.deepEqual(releverPortesDImpression(RACINE), []);
  });

  test("la garde relève chaque lecture du contexte, chaque appel ou référence de print et chaque passage par imprimer, par sa ligne, composants compris, à toute profondeur, hors épreuves, chaînes et commentaires ; l'aperçu n'appelle pas print() ; un lecteur qui ne lit plus le contexte ou n'imprime plus est sans objet", () => {
    const fichiers = {
      'src/interface/badges/Tiroir.svelte': [
        '<script>',
        "  import { getContext } from 'svelte';",
        "  const imprimante = getContext('imprimante');",
        "  // getContext('imprimante') se lit aussi dans un commentaire",
        '  const nom = "getContext(\'imprimante\')";',
        "  const voisine = getContext('imprimanteDeSecours');",
        '</script>',
        '<!-- <button onclick={() => window.print()}> -->',
        '<button onclick={() => window.print()}>Imprimer</button>',
        '<button onclick={window.print}>Imprimer</button>',
        '<Commande cle="impression.commande.imprimer" executer={imprimer} />',
      ].join('\n'),
      'src/application/sous/sortie.js': [
        'export const a = () => window.print();',
        'export const b = () => globalThis?.print?.();',
        "export const c = window['print'];",
        'const { print } = window;',
        "export const d = 'window.print()' + 'imprimante.imprimer()' + reprint(x) + print_(y) + w.printer + x.reimprimer() + y.imprimerTout();",
        '/* window.print() */',
        'export const e = getContext("imprimante");',
        'const p = window.print;',
        'export const f = () => p.call(window) + self?.print;',
        "export const g = (i) => i['imprimer'](o) + i?.imprimer;",
        'const { imprimer } = imprimante;',
      ].join('\n'),
      'src/interface/App.svelte': [
        '<script>',
        "  setContext('imprimante', imprimante);",
        "  const direct = () => imprimante.imprimer({ papier: 'A4' });",
        '</script>',
      ].join('\n'),
      'src/interface/impression/Apercu.svelte': [
        '<script>',
        "  const imprimante = getContext('imprimante');",
        '  const envoyer = () => print();',
        '  async function imprimer() {',
        '    return imprimante.imprimer({ papier });',
        '  }',
        '</script>',
        '<button onclick={imprimer}>Imprimer</button>',
      ].join('\n'),
      'src/interface/impression/Apercu.navigateur.test.js': "window.print = () => {};\nconst i = getContext('imprimante');\n",
      'src/application/seance.test.js': 'const e = window.print();\n',
      'src/impression/imprimante_web.js': 'export const imprimer = (fenetre) => fenetre.print();\n',
    };
    assert.deepEqual(avecArbre(fichiers, releverPortesDImpression), [
      'src/application/sous/sortie.js:1 print()',
      'src/application/sous/sortie.js:1 .print',
      'src/application/sous/sortie.js:2 print()',
      'src/application/sous/sortie.js:2 .print',
      "src/application/sous/sortie.js:3 ['print']",
      'src/application/sous/sortie.js:4 { print }',
      "src/application/sous/sortie.js:7 getContext('imprimante')",
      'src/application/sous/sortie.js:8 .print',
      'src/application/sous/sortie.js:9 .print',
      'src/application/sous/sortie.js:10 .imprimer',
      "src/application/sous/sortie.js:10 ['imprimer']",
      'src/application/sous/sortie.js:11 { imprimer }',
      'src/interface/App.svelte:3 .imprimer',
      "src/interface/badges/Tiroir.svelte:3 getContext('imprimante')",
      'src/interface/badges/Tiroir.svelte:9 print()',
      'src/interface/badges/Tiroir.svelte:9 .print',
      'src/interface/badges/Tiroir.svelte:10 .print',
      'src/interface/impression/Apercu.svelte:3 print()',
    ]);
    const sansLecteur = { ...fichiers, 'src/interface/impression/Apercu.svelte': '<script>\n  const imprimante = null;\n</script>\n' };
    assert.deepEqual(avecArbre(sansLecteur, releverPortesDImpression).slice(-2), [
      `lecteur sans objet : ${PORTE_D_IMPRESSION} getContext('imprimante')`,
      `lecteur sans objet : ${PORTE_D_IMPRESSION} .imprimer`,
    ]);
    const sansEnvoi = {
      ...fichiers,
      'src/interface/impression/Apercu.svelte': [
        '<script>',
        "  const imprimante = getContext('imprimante');",
        '</script>',
        '<Commande cle="impression.commande.imprimer" />',
      ].join('\n'),
    };
    assert.equal(avecArbre(sansEnvoi, releverPortesDImpression).at(-1), `lecteur sans objet : ${PORTE_D_IMPRESSION} .imprimer`);
    for (const arbre of ARBRES_D_UNE_PORTE) {
      const sansFichier = { ...sansArbre(fichiers, arbre), [`${arbre}/a.test.js`]: '' };
      assert.throws(() => avecArbre(sansFichier, releverPortesDImpression), new RegExp(`${arbre} ne fournit aucun fichier`), arbre);
    }
  });
});

describe('arborescence : un seul chemin de code pour les réservations (§ 5.2)', () => {
  test('dans src/moteur, seuls configuration.js et diagnostic.js lisent les réservations', () => {
    assert.deepEqual(releverLecteursDesReservations(RACINE), []);
  });

  test('la garde relève chaque lecture par sa ligne — propriété, déstructuration, crochet —, hors commentaires, chaînes et épreuves ; un lecteur admis qui ne lit plus est sans objet', () => {
    const fichiers = {
      'src/moteur/configuration.js': 'export const normaliser = ({ reservations }) => reservations.length;\n',
      'src/moteur/diagnostic.js': 'export const sonder = (c) => c.reservations;\n',
      'src/moteur/recherche.js': [
        '// les reservations sont fixées avant la recherche',
        'export const rechercher = (configuration) => {',
        '  const { tables, reservations } = configuration;',
        "  const motif = 'reservations';",
        '  return configuration?.reservations ?? configuration["reservations"];',
        '};',
      ].join('\n'),
      'src/moteur/types.js': '/** @property {Reservation[]} reservations */\nexport const fixerReservations = 1;\n',
      'src/moteur/sous/profond.js': 'export const lire = (c) => c.reservations;\n',
      'src/moteur/recherche.test.js': 'const r = configuration.reservations;\n',
    };
    assert.deepEqual(avecArbre(fichiers, releverLecteursDesReservations), [
      'src/moteur/recherche.js:3 reservations',
      'src/moteur/recherche.js:5 reservations',
      "src/moteur/recherche.js:5 ['reservations']",
      'src/moteur/sous/profond.js:1 reservations',
    ]);
    const sansLecture = { ...fichiers, 'src/moteur/diagnostic.js': 'export const sonder = (c) => c.tables;\n' };
    assert.deepEqual(avecArbre(sansLecture, releverLecteursDesReservations).at(-1), 'exception sans objet : src/moteur/diagnostic.js');
    assert.throws(() => avecArbre({ 'src/moteur/a.test.js': '' }, releverLecteursDesReservations), /src\/moteur ne fournit aucun module/);
  });
});

describe('arborescence : une seule langue (§ 13.2)', () => {
  test('sous src/, electron/ et scripts/, rien que du JavaScript, des composants Svelte, des feuilles de style, des données JSON, les scripts d’installation nommés et les données nommées, la police et le logo', () => {
    assert.deepEqual(releverLangages(RACINE), []);
  });

  test('la garde relève un second langage, à toute profondeur, et un fichier sans extension ; un script nommé hors de sa place l’est aussi ; un script nommé absent est sans objet', () => {
    const fichiers = {
      'src/moteur/a.js': '',
      'src/moteur/b.mjs': '',
      'electron/c.cjs': '',
      'src/interface/D.svelte': '',
      'src/interface/jetons.css': '',
      'src/demo/livrees/e.gtt.json': '{}',
      'src/moteur/calcul.py': '',
      'src/geometrie/vue.ts': '',
      'src/moteur/sous/recherche.wasm': '',
      'electron/Makefile': '',
      'scripts/outil.rb': '',
      'scripts/construire_windows.sh': '',
      'src/installation/avec_node.sh': '',
      'test/aide.py': '',
      'node_modules/p/x.py': '',
    };
    const releves = avecArbre(fichiers, releverLangages);
    assert.deepEqual(
      releves.filter((r) => !r.startsWith('exception sans objet')),
      [
        'electron/Makefile : sans extension',
        'scripts/outil.rb : .rb',
        'src/geometrie/vue.ts : .ts',
        'src/installation/avec_node.sh : .sh',
        'src/moteur/calcul.py : .py',
        'src/moteur/sous/recherche.wasm : .wasm',
      ],
    );
    assert.ok(releves.includes('exception sans objet : scripts/installation/avec_node.sh'));
    assert.ok(!releves.includes('exception sans objet : scripts/construire_windows.sh'));
    assert.throws(() => avecArbre({ 'test/a.js': '' }, releverLangages), /aucun fichier sous src\/, electron\/ et scripts\//);
  });

  test('les fichiers cachés et les restes d\u{2019}éditeur ou de fusion ne sont pas du projet : la garde les passe, et relève encore ce qui les côtoie', () => {
    const fichiers = {
      'src/moteur/recherche.js': '',
      'src/moteur/.recherche.js.swp': '',
      'src/moteur/.recherche.js.swo': '',
      'src/moteur/.#recherche.js': '',
      'src/interface/.DS_Store': '',
      'src/moteur/recherche.js~': '',
      'src/moteur/recherche.js.orig': '',
      'electron/principal.cjs.rej': '',
      'scripts/#notes.txt#': '',
      'src/moteur/calcul.py': '',
      'src/moteur/orig': '',
      'src/moteur/calcul.py.bak': '',
      // Un nom caché n'est pas pour autant un reste d'éditeur : un second
      // langage s'y cacherait.
      'src/moteur/.calcul.py': '',
      'src/moteur/.cache': '',
    };
    const releves = avecArbre(fichiers, releverLangages).filter((r) => !r.startsWith('exception sans objet'));
    assert.deepEqual(releves, [
      'src/moteur/.cache : sans extension',
      'src/moteur/.calcul.py : .py',
      'src/moteur/calcul.py : .py',
      'src/moteur/calcul.py.bak : .bak',
      'src/moteur/orig : sans extension',
    ]);
    assert.throws(
      () => avecArbre({ 'src/moteur/.a.js.swp': '', 'electron/a.cjs~': '' }, releverLangages),
      /aucun fichier sous src\/, electron\/ et scripts\//,
    );
  });
});

describe('arborescence : où vivent les épreuves (§ 14.9, § 14.12)', () => {
  test('chaque épreuve de src/ importe un module de son propre répertoire, hors des exceptions nommées', () => {
    assert.deepEqual(releverEpreuvesEloignees(RACINE), []);
  });

  test('la garde relève une épreuve qui n’importe que d’ailleurs — d’un sous-répertoire, d’un parent, une autre épreuve voisine —, à toute profondeur ; un composant voisin compte ; une exception sans objet se relève', () => {
    const fichiers = {
      'src/moteur/plafond.js': '',
      'src/moteur/plafond.test.js': "import { plafond } from './plafond.js';\n",
      'src/moteur/loin.test.js': "import { x } from '../csv/lecture.js';\nimport { y } from './sous/y.js';\n",
      'src/moteur/sous/y.js': '',
      'src/moteur/sous/y.long.test.js': "import { x } from '../plafond.js';\n",
      'src/moteur/voisine.test.js': "import './plafond.test.js';\n// import { plafond } from './plafond.js';\n",
      'src/csv/lecture.js': '',
      'src/interface/Plan.svelte': '',
      'src/interface/Plan.navigateur.test.js': "import Plan from './Plan.svelte';\n",
      'src/interface/travailleur.js': '',
      'src/interface/Travail.navigateur.test.js': "import Travailleur from './travailleur.js?worker&inline';\n",
      'src/interface/Ecran.navigateur.test.js': "import { monter } from '../../test/montage.js';\n",
      'test/a.test.js': "import { x } from '../src/csv/lecture.js';\n",
    };
    const exceptions = [
      { fichier: 'src/interface/Ecran.navigateur.test.js', raison: 'monte l’application entière' },
      { fichier: 'src/interface/Absente.navigateur.test.js', raison: 'disparue' },
    ];
    assert.deepEqual(avecArbre(fichiers, (racine) => releverEpreuvesEloignees(racine, exceptions)), [
      'src/moteur/loin.test.js : aucun module de src/moteur',
      'src/moteur/sous/y.long.test.js : aucun module de src/moteur/sous',
      'src/moteur/voisine.test.js : aucun module de src/moteur',
      'exception sans objet : src/interface/Absente.navigateur.test.js',
    ]);
    assert.throws(() => avecArbre({ 'src/a.js': '' }, releverEpreuvesEloignees), /aucune épreuve sous src\//);
  });

  test('aucune donnée de test/fixtures/ n’est, octet pour octet, un fichier d’exemples/ ou de src/demo/livrees/', () => {
    assert.deepEqual(releverFixturesLivrees(RACINE), []);
  });

  test('la garde relève chaque donnée d’épreuve égale à un fichier livré, à toute profondeur, et rien pour un contenu voisin', () => {
    const fichiers = {
      'exemples/participants.csv': 'nom\nIris Ombrelle\n',
      'src/demo/livrees/petite.gtt.json': '{"format":1}\n',
      'test/fixtures/csv/copie.csv': 'nom\nIris Ombrelle\n',
      'test/fixtures/plan/sous/petite.gtt.json': '{"format":1}\n',
      'test/fixtures/csv/voisine.csv': 'nom\nIris Ombrelle\r\n',
    };
    assert.deepEqual(avecArbre(fichiers, releverFixturesLivrees), [
      'test/fixtures/csv/copie.csv = exemples/participants.csv',
      'test/fixtures/plan/sous/petite.gtt.json = src/demo/livrees/petite.gtt.json',
    ]);
    assert.throws(() => avecArbre({ 'exemples/a.csv': 'x' }, releverFixturesLivrees), /test\/fixtures\/ ne porte aucune donnée/);
    assert.throws(() => avecArbre({ 'test/fixtures/a.csv': 'x' }, releverFixturesLivrees), /aucun fichier livré/);
  });

  test('fast-check ne se charge que dans les épreuves que le § 14.12 nomme', () => {
    assert.deepEqual(releverFastCheck(RACINE), []);
  });

  test('la garde relève chaque chargement de fast-check hors de la liste, à toute profondeur, et non dans une chaîne ; un fichier nommé qui ne le charge plus est sans objet', () => {
    const fichiers = {
      'src/moteur/plafond.test.js': "import fc from 'fast-check';\n",
      'src/moteur/recherche.test.js': "import fc from 'fast-check';\nconst arb = require('fast-check/lib/arbitrary');\n",
      'src/stockage/sous/depot.long.test.js': 'const fc = await import(`fast-check`);\n',
      'test/aide.js': "const texte = \"import fc from 'fast-check';\";\n",
      'node_modules/p/x.js': "import fc from 'fast-check';\n",
    };
    const nommes = [
      { fichier: 'src/moteur/plafond.test.js', raison: 'la formule du plafond' },
      { fichier: 'src/csv/lecture.test.js', raison: 'la détection du séparateur' },
    ];
    assert.deepEqual(avecArbre(fichiers, (racine) => releverFastCheck(racine, nommes)), [
      'src/moteur/recherche.test.js:1 fast-check',
      'src/moteur/recherche.test.js:2 fast-check/lib/arbitrary',
      'src/stockage/sous/depot.long.test.js:1 fast-check',
      'exception sans objet : src/csv/lecture.test.js',
    ]);
    assert.throws(() => avecArbre({ 'README.md': '' }, releverFastCheck), /aucun module dans le projet/);
  });
});
