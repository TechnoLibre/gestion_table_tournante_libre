// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Gardes de l'arborescence, lues dans le texte des sources : le moteur et le
// générateur de démonstrations n'appellent aucune source non reproductible
// (§ 14.7), et ne parcourent les clés d'un objet que par exception nommée
// (§ 15.5, point 4) ; le graphe d'imports du moteur et de la géométrie ne
// rejoint ni l'interface, ni le stockage, ni une plateforme (§ 13.4) ;
// chaque paquet importé est déclaré dans devDependencies ; une valeur du
// contrat de données n'a qu'une définition, celle de configuration.js.
// Chaque relevé lit le texte entier, commentaires et chaînes compris : un
// commentaire qui nomme un appel refusé fait échouer la garde comme l'appel
// lui-même. Chaque garde refuse de passer sur un balayage vide (§ 14.2), et
// d'autres épreuves la font tourner sur des arbres temporaires qui portent,
// à plus d'un niveau de profondeur, les formes qu'elle refuse et des formes
// voisines qu'elle admet.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
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
// et par le texte de sa ligne, blancs de bord retirés ; sa raison dit
// pourquoi l'ordre n'y décide d'aucun résultat. Une exception admet chaque
// ligne de ce texte dans ce fichier, et rien d'autre : la ligne réécrite, ou
// un second parcours ajouté à côté, se relève de nouveau. Elle ne couvre
// aucune source de SOURCES_NON_REPRODUCTIBLES, que rien n'admet.
const PARCOURS_DE_CLES_ADMIS = [];

// Relevé « fichier:ligne appel » des sources non reproductibles et des
// parcours de clés non admis dans les modules de src/moteur et de src/demo,
// par fichier puis par ligne, et sur une même ligne dans l'ordre de
// SOURCES_NON_REPRODUCTIBLES puis de PARCOURS_DE_CLES. Les épreuves en sont
// exclues : un tirage y sert légitimement (§ 14.12). Suit une ligne
// « exception sans objet : fichier « texte » » par exception qui n'admet
// rien, dans l'ordre de la liste. Lève quand l'un des deux arbres ne fournit
// aucun module.
function releverDeterminisme(racine, admis = PARCOURS_DE_CLES_ADMIS) {
  const servies = new Set();
  const estAdmis = (fichier, texteDeLigne) => {
    const exception = admis.find((e) => e.fichier === fichier && e.ligne === texteDeLigne);
    if (exception !== undefined) servies.add(exception);
    return exception !== undefined;
  };
  const releve = ['src/moteur', 'src/demo'].flatMap((arbre) => {
    const modules = modulesDe(join(racine, arbre));
    assert.ok(modules.length > 0, `${arbre} ne fournit aucun module`);
    return modules.flatMap((fichier) => {
      const nom = relative(racine, fichier);
      const texte = readFileSync(fichier, 'utf8');
      const lignes = texte.split('\n');
      const trouves = (motifs) =>
        motifs.flatMap(([appel, motif]) =>
          [...texte.matchAll(motif)].map(({ index }) => ({ ligne: ligneDe(texte, index), appel })),
        );
      return [
        ...trouves(SOURCES_NON_REPRODUCTIBLES),
        ...trouves(PARCOURS_DE_CLES).filter(({ ligne }) => !estAdmis(nom, lignes[ligne - 1].trim())),
      ]
        .sort((a, b) => a.ligne - b.ligne)
        .map(({ ligne, appel }) => `${nom}:${ligne} ${appel}`);
    });
  });
  const sansObjet = admis
    .filter((exception) => !servies.has(exception))
    .map(({ fichier, ligne }) => `exception sans objet : ${fichier} « ${ligne} »`);
  return [...releve, ...sansObjet];
}

describe('arborescence : déterminisme (§ 14.7)', () => {
  test("ni src/moteur ni src/demo ne lisent une source non reproductible, ni ne parcourent les clés d'un objet hors des exceptions nommées", () => {
    assert.deepEqual(releverDeterminisme(RACINE), []);
  });

  test('les tirages de node:crypto se relèvent comme ceux du navigateur', () => {
    const fichiers = {
      'src/moteur/a.js': 'export const a = 1;\n',
      'src/demo/tirage.js': [
        "import { randomInt, randomBytes, randomFillSync } from 'node:crypto';",
        'export const a = randomInt(6);',
        'export const b = randomBytes(4);',
        'export const c = randomFillSync(new Uint8Array(4));',
      ].join('\n'),
    };
    assert.deepEqual(avecArbre(fichiers, releverDeterminisme), [
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
    assert.deepEqual(avecArbre(fichiers, releverDeterminisme), [
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
    assert.throws(
      () => avecArbre({ 'src/demo/propre.js': '' }, releverDeterminisme),
      /src\/moteur ne fournit aucun module/,
    );
    assert.throws(
      () => avecArbre({ 'src/moteur/a.js': '', 'src/demo/a.test.js': '' }, releverDeterminisme),
      /src\/demo ne fournit aucun module/,
    );
  });

  test("les parcours des clés d'un objet se relèvent par leur ligne, hors épreuves, et pas leurs voisins (§ 15.5, point 4)", () => {
    const fichiers = {
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
    assert.deepEqual(avecArbre(fichiers, releverDeterminisme), [
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

  test("une exception nommée n'admet que la ligne qu'elle cite, dans son fichier, et qu'un parcours de clés ; une exception sans objet se relève", () => {
    const somme = 'export const total = (o) => Object.values(o).reduce((s, v) => s + v, 0);';
    const fichiers = {
      'src/moteur/a.js': 'export const a = Math.random();\n',
      'src/demo/somme.js': [
        somme,
        'export const nombre = (o) => Object.keys(o).length;',
        'export const double = (o) => Object.values(o).reduce((s, v) => s + 2 * v, 0);',
      ].join('\n'),
      'src/demo/autre.js': `${somme}\n`,
    };
    const exceptions = [
      { fichier: 'src/demo/somme.js', ligne: somme, raison: "une somme d'entiers ne dépend pas de l'ordre de ses termes" },
      { fichier: 'src/moteur/a.js', ligne: 'export const a = Math.random();', raison: 'un tirage ne se nomme pas en exception' },
      { fichier: 'src/demo/disparu.js', ligne: 'for (const k in o) t.push(k);', raison: 'la ligne a disparu' },
    ];
    assert.deepEqual(avecArbre(fichiers, (racine) => releverDeterminisme(racine, exceptions)), [
      'src/moteur/a.js:1 Math.random',
      'src/demo/autre.js:1 Object.values',
      'src/demo/somme.js:2 Object.keys',
      'src/demo/somme.js:3 Object.values',
      'exception sans objet : src/moteur/a.js « export const a = Math.random(); »',
      'exception sans objet : src/demo/disparu.js « for (const k in o) t.push(k); »',
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

// Ce que ni le moteur ni la géométrie ne chargent (§ 13.4), outre les
// modules natifs de Node : les paquets de l'interface et des plateformes,
// sous-chemins compris, dont le motif s'applique au nom de paquet, et les
// couches de src/ qui touchent l'écran ou les fichiers.
const PAQUETS_EXTERIEURS = /^(?:svelte|electron|@capacitor\/.+)$/;
const COUCHES_EXTERIEURES = ['interface', 'stockage'];

// Un accès au navigateur est un nom de document, de window, de navigator, de
// location, de localStorage ou de sessionStorage suivi d'un crochet, ou
// d'un point puis d'un nom de propriété, accolé ou en tête de la ligne
// suivante. Une phrase qui continue après « document. » sur la même ligne
// n'en est pas un, ni une ligne qui finit sur ce mot quand la suivante
// s'ouvre sur autre chose qu'un nom, un commentaire par exemple. Le relevé
// ne distingue pas le commentaire du code : une ligne de commentaire qui
// finit sur « document. » juste avant une ligne de code se lit comme un
// accès.
const ACCES_AU_DOM = /\b(document|window|navigator|location|localStorage|sessionStorage)\s*(?:\??\.(?=[\p{L}_$]|[ \t]*\r?\n\s*[\p{L}_$])|(?:\?\.)?\s*\[)/gu;

// Chemin que désigne un spécificateur relatif, ou absolu depuis la racine
// comme Vite le résout ; null pour un spécificateur nu ou une URL.
function cibleDe(racine, fichier, specificateur) {
  if (RELATIF.test(specificateur)) return resolve(dirname(fichier), specificateur);
  if (specificateur.startsWith('/')) return join(racine, specificateur);
  return null;
}

// Relevé des refus de la frontière des couches dans le graphe d'imports du
// moteur et de la géométrie. Le parcours part des modules de src/moteur et
// de src/geometrie, à toute profondeur, épreuves exclues. Il suit chaque
// chemin relatif, ou absolu depuis la racine, vers un module JavaScript
// existant, chaque module une fois. Un fichier d'une couche extérieure n'est
// pas parcouru : l'importer est déjà un refus. Un chemin sans extension en
// est un aussi : Node ne le résout pas (§ 14.8), et le parcours ne suit pas
// le module que Vite y trouverait. Un module natif de Node, que reconnaît
// isBuiltin, est refusé : la page où le moteur s'exécute n'en a aucun.
// Chaque refus se lit « accès:ligne refus », où l'accès est la suite des
// modules qui mène d'un module de départ à celui qui refuse. src/geometrie
// peut manquer ; lève quand src/moteur ne fournit aucun module.
function releverFrontiere(racine) {
  const moteur = modulesDe(join(racine, 'src', 'moteur'));
  assert.ok(moteur.length > 0, 'src/moteur ne fournit aucun module');
  const couches = COUCHES_EXTERIEURES.map((couche) => join(racine, 'src', couche));
  const exterieur = (chemin) => couches.some((c) => chemin === c || chemin.startsWith(c + sep));
  const aParcourir = [...moteur, ...modulesDe(join(racine, 'src', 'geometrie'))];
  const acces = new Map(aParcourir.map((fichier) => [fichier, relative(racine, fichier)]));
  const refus = [];
  for (let i = 0; i < aParcourir.length; i += 1) {
    const fichier = aParcourir[i];
    const texte = readFileSync(fichier, 'utf8');
    const trouves = [...texte.matchAll(ACCES_AU_DOM)].map(({ 0: lu, 1: nom, index }) => ({
      indice: index,
      motif: nom + lu.at(-1),
    }));
    for (const { specificateur, indice } of chargementsLitteraux(texte)) {
      const cible = cibleDe(racine, fichier, specificateur);
      if (cible === null) {
        if (isBuiltin(specificateur) || PAQUETS_EXTERIEURS.test(nomDePaquet(specificateur))) {
          trouves.push({ indice, motif: `import ${specificateur}` });
        }
      } else if (exterieur(cible)) {
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

describe('arborescence : frontière des couches (§ 13.4)', () => {
  test('les globales du navigateur hors du DOM se refusent comme lui : navigator, location, localStorage, sessionStorage', () => {
    const fichiers = {
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

  test("le graphe d'imports du moteur et de la géométrie ne rejoint ni l'interface, ni le stockage, ni une plateforme", () => {
    assert.deepEqual(releverFrontiere(RACINE), []);
  });

  test('la garde suit les imports depuis chaque module à toute profondeur, relève chaque refus par sa ligne, hors épreuves', () => {
    const fichiers = {
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
      'src/moteur/b.js:4 import ../interface/App.svelte',
      'src/moteur/sous/c.js:1 import ../../interface/x.js',
      'src/geometrie/echelle.js:1 window.',
      'src/moteur/a.js → src/commun/aide.js:2 window.',
      'src/geometrie/echelle.js → src/commun/racine.js:1 window.',
    ]);
  });

  test('src/geometrie peut manquer ; un src/moteur sans module fait échouer la garde', () => {
    assert.deepEqual(avecArbre({ 'src/moteur/a.js': '' }, releverFrontiere), []);
    assert.throws(
      () => avecArbre({ 'src/geometrie/echelle.js': '', 'src/moteur/a.test.js': '' }, releverFrontiere),
      /src\/moteur ne fournit aucun module/,
    );
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
