// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Gardes du banc de mesure (§ 19.10, § 14.4, § 14.8). Le banc vit hors des
// trois séries de vitest.config.js : il se lance par sa propre commande, sur
// sa propre configuration, vitest.banc.config.js, qui ôte au Chromium sa
// cadence d'images. Une épreuve du banc que l'une des séries jouerait la
// mesurerait à cadence bridée, et alourdirait une série qui se lance à
// chaque modification ; une épreuve que le projet banc n'inclut pas ne se
// joue nulle part. Les gardes lisent par import vitest.config.js et le
// projet banc tel que scripts/banc/projet.js le décrit — vitest.banc.config.js
// charge Vitest, qu'une épreuve node ne charge pas (§ 14.8) —, le Makefile et
// package.json par le disque.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, matchesGlob, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chargements } from '../../test/chargements.js';
import { describe, test } from '../../test/lanceur.js';
import configuration from '../../vitest.config.js';
import { optionsBanc, projetBanc } from './projet.js';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));

// Ce fichier, relatif à la racine. Ses données d'épreuve écrivent en
// chaînes des chargements des outils du banc, que le relevé des chargements
// lit comme les autres : le parcours de l'arbre réel le laisse de côté.
const CE_FICHIER = relative(RACINE, fileURLToPath(import.meta.url)).split(sep).join('/');

// Les outils de page du banc : un module qui les charge mesure dans la page.
const OUTILS_DU_BANC = 'scripts/banc/navigateur.js';

// Les drapeaux qui ôtent à Chromium sa cadence d'images.
const DRAPEAUX_CADENCE = ['--disable-frame-rate-limit', '--disable-gpu-vsync'];

// Ce que le parcours de l'arbre saute : les dépendances, à toute
// profondeur, et, à la racine, le dépôt et les sorties de construction et de
// mesure.
const HORS_DU_PARCOURS_A_LA_RACINE = new Set(['.git', 'www', 'dist-electron', 'coverage', '.vitest']);
const MODULE = /\.[cm]?js$/;

// Les modules JavaScript du projet, { chemin, texte }, chemins relatifs à la
// racine en barres obliques, triés.
function modulesDuProjet(racine) {
  const modules = [];
  const parcourir = (dossier) => {
    for (const entree of readdirSync(dossier, { withFileTypes: true })) {
      const chemin = join(dossier, entree.name);
      const exclu = entree.name === 'node_modules' || (dossier === racine && HORS_DU_PARCOURS_A_LA_RACINE.has(entree.name));
      if (entree.isDirectory() && !exclu) parcourir(chemin);
      else if (entree.isFile() && MODULE.test(entree.name)) {
        modules.push({ chemin: relative(racine, chemin).split(sep).join('/'), texte: readFileSync(chemin, 'utf8') });
      }
    }
  };
  parcourir(racine);
  return modules.sort((a, b) => (a.chemin < b.chemin ? -1 : a.chemin > b.chemin ? 1 : 0));
}

// Le module que vise un spécificateur, relatif à la racine, en barres
// obliques, suffixe de Vite (« ?… ») retiré : relatif au fichier, ou absolu
// depuis la racine comme Vite les résout ; null pour un paquet.
function cible(chemin, specificateur) {
  const sansSuffixe = specificateur.replace(/\?.*$/, '');
  if (sansSuffixe.startsWith('/')) return posix.normalize(sansSuffixe.slice(1));
  if (sansSuffixe.startsWith('.')) return posix.normalize(posix.join(posix.dirname(chemin), sansSuffixe));
  return null;
}

// Une épreuve que Vitest peut jouer : un fichier *.banc.js, que le projet
// banc inclut, ou *.test.js, que les séries incluent.
const EPREUVE = /\.(?:banc|test)\.[cm]?js$/;

// Les épreuves du banc parmi des modules { chemin, texte } : un fichier
// *.banc.js, ou une épreuve *.test.js qui charge les outils de page du banc,
// directement ou à travers des modules de la liste, à toute profondeur. Un
// module qui n'est pas une épreuve n'en est jamais une : une aide du banc
// qui charge les outils ne se joue que par une épreuve qui la charge.
function epreuvesDuBanc(modules) {
  const textes = new Map(modules.map(({ chemin, texte }) => [chemin, texte]));
  // Les modules que chaque module charge, lus une fois.
  const lus = new Map();
  const voisins = (chemin) => {
    if (!lus.has(chemin)) {
      lus.set(
        chemin,
        chargements(textes.get(chemin))
          .filter(({ specificateur }) => specificateur !== undefined)
          .map(({ specificateur }) => cible(chemin, specificateur))
          .filter((vise) => vise !== null),
      );
    }
    return lus.get(chemin);
  };
  const atteintLesOutils = (depart) => {
    const vus = new Set([depart]);
    const aParcourir = [depart];
    for (let i = 0; i < aParcourir.length; i += 1) {
      for (const vise of voisins(aParcourir[i])) {
        if (vise === OUTILS_DU_BANC) return true;
        if (vus.has(vise) || !textes.has(vise)) continue;
        vus.add(vise);
        aParcourir.push(vise);
      }
    }
    return false;
  };
  return modules.filter(
    ({ chemin }) => chemin.endsWith('.banc.js') || (EPREUVE.test(chemin) && atteintLesOutils(chemin)),
  );
}

const repondA = (chemin, motifs = []) => motifs.some((motif) => matchesGlob(chemin, motif));
const inclus = (chemin, { include = [], exclude = [] }) => repondA(chemin, include) && !repondA(chemin, exclude);

// Relevé des épreuves du banc mal rangées, dans l'ordre des modules reçus :
// « chemin : jouée par le projet nom » pour chaque projet des séries qui
// l'inclut, puis « chemin : hors du projet banc » quand le projet banc ne
// l'inclut pas. projets et banc : les objets test des projets de Vitest.
// Lève quand les modules ne portent aucune épreuve du banc (§ 14.2).
function releverBancs(modules, { projets, banc }) {
  const bancs = epreuvesDuBanc(modules);
  assert.ok(bancs.length > 0, 'aucune épreuve du banc');
  return bancs.flatMap(({ chemin }) => [
    ...projets.filter((projet) => inclus(chemin, projet)).map(({ name }) => `${chemin} : jouée par le projet ${name}`),
    ...(inclus(chemin, banc) ? [] : [`${chemin} : hors du projet banc`]),
  ]);
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

const projetsDesSeries = () => configuration.test.projects.map(({ test: projet }) => projet);

describe('banc : hors des trois séries (§ 14.4, § 14.8)', () => {
  test('aucune épreuve du banc ne répond aux motifs des trois projets de vitest.config.js, et le projet banc les inclut toutes', () => {
    const modules = modulesDuProjet(RACINE).filter(({ chemin }) => chemin !== CE_FICHIER);
    assert.ok(epreuvesDuBanc(modules).some(({ chemin }) => chemin === 'scripts/banc/harnais.banc.js'));
    assert.deepEqual(projetsDesSeries().map(({ name }) => name), ['node', 'node-long', 'navigateur']);
    assert.deepEqual(releverBancs(modules, { projets: projetsDesSeries(), banc: projetBanc() }), []);
  });

  test('la garde relève une épreuve du banc renommée en épreuve du navigateur, une autre chargée par une épreuve de src/, directement ou par une aide, un *.banc.js hors de scripts/banc, et une série qui inclurait le banc ; une aide du banc qui n’est pas une épreuve passe', () => {
    const outils = "import { mesurerImages } from './navigateur.js';\n";
    const modules = [
      { chemin: 'scripts/banc/navigateur.js', texte: "import { cdp } from 'vitest/browser';\n" },
      { chemin: 'scripts/banc/statistiques.test.js', texte: "import { statistiques } from './statistiques.js';\n" },
      { chemin: 'scripts/banc/defilement.banc.js', texte: outils },
      { chemin: 'scripts/banc/defilement.navigateur.test.js', texte: outils },
      { chemin: 'scripts/banc/gestes.js', texte: `${outils}export const mesurer = (geste) => mesurerImages(geste);\n` },
      { chemin: 'scripts/banc/pivots.js', texte: "export { mesurer } from './gestes.js?brut';\n" },
      { chemin: 'scripts/banc/zoom/crans.navigateur.test.js', texte: "import { mesurerImages } from '/scripts/banc/navigateur.js';\n" },
      { chemin: 'src/interface/plan/Pivot.navigateur.test.js', texte: "import { mesurer } from '../../../scripts/banc/pivots.js';\n" },
      { chemin: 'src/interface/plan/Zoom.navigateur.test.js', texte: "const o = await import('../../../scripts/banc/navigateur.js');\n" },
      { chemin: 'test/navigateur/listes.banc.js', texte: '' },
    ];
    assert.deepEqual(
      epreuvesDuBanc(modules).map(({ chemin }) => chemin),
      [
        'scripts/banc/defilement.banc.js',
        'scripts/banc/defilement.navigateur.test.js',
        'scripts/banc/zoom/crans.navigateur.test.js',
        'src/interface/plan/Pivot.navigateur.test.js',
        'src/interface/plan/Zoom.navigateur.test.js',
        'test/navigateur/listes.banc.js',
      ],
    );
    assert.deepEqual(releverBancs(modules, { projets: projetsDesSeries(), banc: projetBanc() }), [
      'scripts/banc/defilement.navigateur.test.js : hors du projet banc',
      'scripts/banc/zoom/crans.navigateur.test.js : hors du projet banc',
      'src/interface/plan/Pivot.navigateur.test.js : jouée par le projet navigateur',
      'src/interface/plan/Pivot.navigateur.test.js : hors du projet banc',
      'src/interface/plan/Zoom.navigateur.test.js : jouée par le projet navigateur',
      'src/interface/plan/Zoom.navigateur.test.js : hors du projet banc',
      'test/navigateur/listes.banc.js : hors du projet banc',
    ]);
    const serieTropLarge = { name: 'node', include: ['scripts/**/*.js'], exclude: ['**/*.navigateur.test.js'] };
    assert.deepEqual(releverBancs(modules.slice(0, 3), { projets: [serieTropLarge], banc: projetBanc() }), [
      'scripts/banc/defilement.banc.js : jouée par le projet node',
    ]);
  });

  test('la garde refuse de passer sans épreuve du banc', () => {
    const modules = [{ chemin: 'scripts/banc/navigateur.js', texte: "import { cdp } from 'vitest/browser';\n" }];
    assert.throws(() => releverBancs(modules, { projets: projetsDesSeries(), banc: projetBanc() }), /aucune épreuve du banc/);
  });
});

describe('banc : sa configuration (§ 19.10)', () => {
  test('le projet banc inclut scripts/banc/**/*.banc.js, et chaque appel rend un objet neuf', () => {
    const projet = projetBanc();
    assert.equal(projet.name, 'banc');
    assert.deepEqual(projet.include, ['scripts/banc/**/*.banc.js']);
    projet.include.push('ailleurs/**/*.js');
    projet.provide.cadreBanc.largeur = 1;
    assert.deepEqual(projetBanc().include, ['scripts/banc/**/*.banc.js']);
    assert.equal(projetBanc().provide.cadreBanc.largeur, 1366);
  });

  test('Chromium sans tête, cadence non bridée, cadre 1 366 × 700 au facteur 1, fichiers l’un après l’autre, délai large', () => {
    const { browser, fileParallelism, testTimeout, hookTimeout, provide } = projetBanc();
    assert.equal(browser.enabled, true);
    assert.equal(browser.headless, true);
    assert.deepEqual(browser.instances, [{ browser: 'chromium' }]);
    assert.deepEqual(browser.viewport, { width: 1366, height: 700 });
    const { launchOptions, contextOptions } = optionsBanc({ LANG: 'fr_CA.UTF-8' });
    assert.deepEqual(launchOptions.args.slice(-2), DRAPEAUX_CADENCE);
    assert.deepEqual(contextOptions, { viewport: { width: 1366, height: 700 }, deviceScaleFactor: 1 });
    assert.deepEqual(provide, { cadreBanc: { largeur: 1366, hauteur: 700 } });
    assert.equal(fileParallelism, false);
    assert.ok(testTimeout >= 600_000, `testTimeout ${testTimeout}`);
    assert.ok(hookTimeout >= 600_000, `hookTimeout ${hookTimeout}`);
  });

  test('optionsBanc ajoute les drapeaux de cadence aux options de test/chromium.js, sans les perdre', () => {
    assert.deepEqual(optionsBanc({ LANG: 'fr_CA.UTF-8' }), {
      launchOptions: { args: DRAPEAUX_CADENCE },
      contextOptions: { viewport: { width: 1366, height: 700 }, deviceScaleFactor: 1 },
    });
    const env = { LANG: 'C', GTT_CHROMIUM: '/opt/chromium-epreuve/chrome' };
    const { launchOptions } = optionsBanc(env);
    assert.equal(launchOptions.executablePath, '/opt/chromium-epreuve/chrome');
    assert.equal(launchOptions.env.LANG, 'C.UTF-8');
    assert.deepEqual(launchOptions.args, DRAPEAUX_CADENCE);
    assert.deepEqual(env, { LANG: 'C', GTT_CHROMIUM: '/opt/chromium-epreuve/chrome' });
  });
});

describe('banc : sa commande', () => {
  const { scripts = {} } = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8'));
  const makefile = readFileSync(join(RACINE, 'Makefile'), 'utf8');

  test('npm run banc lance scripts/banc/lancer.js, et aucun autre script de package.json ne touche au banc', () => {
    assert.equal(scripts.banc, 'node scripts/banc/lancer.js');
    const autres = Object.entries(scripts).filter(([nom, commande]) => nom !== 'banc' && /banc/.test(commande));
    assert.deepEqual(autres, []);
  });

  test('make banc lance npm run banc, cible factice documentée', () => {
    assert.deepEqual(cibleDuMakefile(makefile, 'banc'), {
      documentation: 'Relève les constantes du banc de mesure (§ 19.10), avant une livraison',
      commandes: ['$(AVEC_NODE) npm run banc'],
      factice: true,
    });
  });

  test('la lecture du Makefile relève une cible absente, une recette autre, une cible non factice', () => {
    assert.equal(cibleDuMakefile('test:\n\t$(AVEC_NODE) npm test\n', 'banc'), null);
    assert.deepEqual(cibleDuMakefile('.PHONY: test\nbanc: ## Mesure\n\tnode scripts/banc/lancer.js\n\nx:\n\techo\n', 'banc'), {
      documentation: 'Mesure',
      commandes: ['node scripts/banc/lancer.js'],
      factice: false,
    });
  });
});
