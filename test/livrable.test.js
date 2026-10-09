// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le livrable tel qu'electron-builder.config.cjs le décrit : son nom (§ 18.2),
// sa forme (§ 16), ce qu'il emporte (§ 14.15) et l'identité inscrite dans sa
// ressource de version ; le nom de l'application, un seul pour Electron,
// pour Capacitor et pour le titre de la fenêtre (§ 18.6) ; le répertoire de
// la page construite, www/, que Vite, Capacitor, la coquille et
// electron-builder désignent ensemble (§ 13.1) ; la langue que la page passe
// à App, jamais la langue témoin (§ 14.6) ; et les démonstrations, composées
// dans src/main.js comme dans le montage des épreuves du navigateur. La
// configuration se charge ici comme electron-builder la charge, par require.
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire, isBuiltin } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deriver } from '../scripts/version.js';
import { titreAvecVersion } from '../src/interface/libelles.js';
import { VERSION } from '../src/version.genere.js';
import { chargements } from './chargements.js';
import { describe, test } from './lanceur.js';
import { versionVoisine } from './version_voisine.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const CONFIGURATION = 'electron-builder.config.cjs';

const lireJson = (racine, chemin) => JSON.parse(readFileSync(join(racine, chemin), 'utf8'));
const charger = (racine) => {
  const chemin = join(racine, CONFIGURATION);
  return createRequire(chemin)(chemin);
};

// Fichiers d'electron/ sous une racine, à toute profondeur, en chemins
// absolus.
const fichiersDElectron = (racine) =>
  readdirSync(join(racine, 'electron'), { recursive: true, withFileTypes: true })
    .filter((entree) => entree.isFile())
    .map((entree) => join(entree.parentPath, entree.name));

// Raison de refuser le chargement que demande un fichier du répertoire
// electron donné, ou null quand il reste dans le paquet : electron, un module
// de Node hors du lanceur d'épreuves, ou un fichier de ce répertoire. Le
// paquet n'emporte ni node_modules ni rien de test/ : un chargement qui en
// sort échoue au démarrage de l'exécutable. Un chargement calculé ne se
// vérifie pas d'ici.
function raisonDeRefus(electron, { fichier, specificateur, argument }) {
  if (specificateur === undefined) return `argument calculé, ${argument} : il ne se vérifie pas`;
  if (/^(?:vitest|node:test)(?:\/|$)|^@vitest\//.test(specificateur)) return "lanceur d'épreuves";
  if (specificateur === 'electron' || isBuiltin(specificateur)) return null;
  if (/^\.{1,2}(?:\/|$)/.test(specificateur)) {
    return resolve(dirname(fichier), specificateur).startsWith(`${electron}${sep}`) ? null : "hors d'electron/";
  }
  return "hors du paquet, qui n'emporte aucun node_modules";
}

// Chargements refusés des fichiers d'electron/ sous une racine, par fichier
// puis dans l'ordre du texte : chacun est { fichier, specificateur, raison }
// ou { fichier, argument, raison }, fichier relatif à la racine. Lève quand
// electron/ n'a aucun fichier, ou quand ses fichiers ne demandent aucun
// chargement.
function refusDElectron(racine) {
  const electron = join(racine, 'electron');
  const fichiers = fichiersDElectron(racine).sort();
  assert.ok(fichiers.length > 0, 'electron/ ne contient aucun fichier');
  const demandes = fichiers.flatMap((fichier) =>
    chargements(readFileSync(fichier, 'utf8')).map(({ specificateur, argument }) =>
      specificateur === undefined ? { fichier, argument } : { fichier, specificateur },
    ),
  );
  assert.ok(demandes.length > 0, 'aucun chargement relevé dans electron/');
  return demandes
    .map((demande) => ({ ...demande, fichier: relative(racine, demande.fichier), raison: raisonDeRefus(electron, demande) }))
    .filter(({ raison }) => raison !== null);
}

describe('livrable : nom', () => {
  test('le nom est celui que deriver calcule depuis version.json (§ 18.2)', () => {
    const { version } = lireJson(RACINE, 'version.json');
    assert.equal(charger(RACINE).artifactName, deriver(version).nomFichier);
  });

  test("le nom suit version.json : la configuration ne l'écrit pas elle-même", () => {
    // Un arbre où version.json porte la version voisine. La configuration et
    // scripts/version.js y sont recopiés tels quels.
    const { version } = lireJson(RACINE, 'version.json');
    const autre = versionVoisine(version);
    const arbre = mkdtempSync(join(tmpdir(), 'livrable-'));
    try {
      for (const chemin of [CONFIGURATION, 'scripts/version.js', 'package.json', 'capacitor.config.json']) {
        mkdirSync(dirname(join(arbre, chemin)), { recursive: true });
        copyFileSync(join(RACINE, chemin), join(arbre, chemin));
      }
      writeFileSync(join(arbre, 'version.json'), `${JSON.stringify({ version: autre })}\n`);
      const nom = charger(arbre).artifactName;
      assert.equal(nom, deriver(autre).nomFichier);
      assert.notEqual(nom, deriver(version).nomFichier);
    } finally {
      rmSync(arbre, { recursive: true, force: true });
    }
  });
});

describe('livrable : forme et contenu', () => {
  test('un exécutable portable à fichier unique, pour Windows x64 : jamais un installateur (§ 16)', () => {
    assert.deepEqual(charger(RACINE).win, { target: [{ target: 'portable', arch: ['x64'] }] });
  });

  test("sortie dans dist-electron/ ; le paquet n'emporte que la page, la coquille et package.json", () => {
    const configuration = charger(RACINE);
    assert.deepEqual(configuration.directories, { output: 'dist-electron' });
    assert.deepEqual(configuration.files, ['www/**', 'electron/**', 'package.json']);
  });

  test("la configuration n'a pas d'autre clé que celles que ces épreuves examinent (§ 14.15, § 18.1)", () => {
    // Une clé de plus change ce que le paquet emporte (extraResources,
    // extraFiles, asar) ou la version qu'il porte (buildVersion, buildNumber),
    // et aucune épreuve ne la lirait : elle échoue ici jusqu'à sa revue. Les
    // épreuves de chaque clé comparent sa valeur entière, si bien qu'une clé
    // ajoutée plus bas, sous win ou directories, échoue aussi.
    assert.deepEqual(Object.keys(charger(RACINE)).sort(), [
      'appId',
      'artifactName',
      'copyright',
      'directories',
      'files',
      'productName',
      'win',
    ]);
  });

  test("electron/, que le paquet emporte en entier, ne contient aucune épreuve (§ 14.15)", () => {
    const fichiers = fichiersDElectron(RACINE);
    assert.ok(fichiers.length > 0, 'electron/ ne contient aucun fichier');
    assert.deepEqual(fichiers.filter((chemin) => /\.test\.[cm]?js$/.test(chemin)), []);
  });

  test("electron/ ne charge qu'electron, Node et ses propres fichiers : ni épreuve, ni lanceur, ni dépendance (§ 14.9)", () => {
    assert.deepEqual(refusDElectron(RACINE), []);
  });

  test("la garde d'electron/ relève chaque chargement refusé, import à commentaire entre ses accolades compris, et admet electron, Node et les fichiers d'electron/", () => {
    const arbre = mkdtempSync(join(tmpdir(), 'livrable-'));
    try {
      mkdirSync(join(arbre, 'electron'));
      writeFileSync(join(arbre, 'electron', 'main.js'), [
        "import { app } from 'electron';",
        "import { join } from 'node:path';",
        'import {',
        "  // l'API des épreuves",
        '  test,',
        "} from 'vitest';",
        'import {',
        "  // l'aide d'à côté",
        '  aide,',
        "} from '../test/aide.js';",
        "import { voisin } from './voisin.js';",
        "const prechargement = require('./preload.cjs');",
        'const module = require(chemin);',
        "const { mount } = await import('svelte');",
      ].join('\n'));
      writeFileSync(join(arbre, 'electron', 'preload.cjs'), "const { contextBridge } = require('electron');\n");
      assert.deepEqual(refusDElectron(arbre), [
        { fichier: join('electron', 'main.js'), specificateur: 'vitest', raison: "lanceur d'épreuves" },
        { fichier: join('electron', 'main.js'), specificateur: '../test/aide.js', raison: "hors d'electron/" },
        { fichier: join('electron', 'main.js'), argument: 'chemin', raison: 'argument calculé, chemin : il ne se vérifie pas' },
        { fichier: join('electron', 'main.js'), specificateur: 'svelte', raison: "hors du paquet, qui n'emporte aucun node_modules" },
      ]);
      writeFileSync(join(arbre, 'electron', 'main.js'), '// Aucun chargement.\n');
      writeFileSync(join(arbre, 'electron', 'preload.cjs'), '');
      assert.throws(() => refusDElectron(arbre), /aucun chargement relevé dans electron\//);
    } finally {
      rmSync(arbre, { recursive: true, force: true });
    }
  });

  test("package.json ne déclare aucune dépendance d'exécution : le paquet n'emporte aucun node_modules", () => {
    const paquet = lireJson(RACINE, 'package.json');
    assert.equal(paquet.dependencies, undefined);
    assert.equal(paquet.optionalDependencies, undefined);
    assert.match(paquet.devDependencies?.electron ?? '', /^\^44(\.|$)/);
    assert.match(paquet.devDependencies?.['electron-builder'] ?? '', /^\^26(\.|$)/);
    assert.equal(paquet.main, 'electron/main.js');
  });
});

describe('livrable : identité', () => {
  test("l'identifiant est celui de Capacitor, le nom de produit celui de package.json", () => {
    const configuration = charger(RACINE);
    assert.equal(configuration.appId, lireJson(RACINE, 'capacitor.config.json').appId);
    assert.equal(configuration.productName, lireJson(RACINE, 'package.json').productName);
    // Une source muette rend undefined des deux côtés de l'égalité, et
    // electron-builder retombe alors sur ses valeurs par défaut : chaque
    // valeur a aussi sa forme.
    assert.match(configuration.appId ?? '', /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/);
    assert.ok(
      typeof configuration.productName === 'string' && configuration.productName.trim() !== '',
      `productName vide : ${configuration.productName}`,
    );
  });

  test('le titulaire entre dans la ressource de version, champ LegalCopyright', () => {
    assert.equal(charger(RACINE).copyright, '© 2026 TechnoLibre');
  });

  test("le nom de l'application est un seul : productName de package.json, appName de Capacitor, celui du titre de la fenêtre (§ 18.6)", () => {
    // electron-builder nomme l'application d'après productName, Capacitor
    // d'après appName, et la page pose le titre de la fenêtre par
    // titreAvecVersion : le nom suivi de la version affichée, que l'épreuve
    // retire pour lire le nom.
    const titre = titreAvecVersion(VERSION.affichee);
    const suite = ` — ${VERSION.affichee}`;
    assert.ok(titre.endsWith(suite), `le titre « ${titre} » ne finit pas sur « ${suite} »`);
    const nom = titre.slice(0, -suite.length);
    assert.ok(nom.trim() !== '', `le titre « ${titre} » ne porte aucun nom`);
    assert.deepEqual(
      {
        productName: lireJson(RACINE, 'package.json').productName,
        appName: lireJson(RACINE, 'capacitor.config.json').appName,
      },
      { productName: nom, appName: nom },
    );
  });
});

// Où vit la page construite, lu dans chaque fichier qui la désigne : la
// sortie de la construction de Vite (vite.config.js, chargé comme Vite le
// charge), le répertoire web de Capacitor, la page que la coquille charge
// par loadFile — la constante que l'appel nomme, une adresse relative à
// electron/main.js —, rendue relative à la racine, ou null quand l'appel ou
// sa constante manquent ; et si electron-builder emporte www/ en entier.
async function pageConstruite(racine) {
  const { default: vite } = await import(pathToFileURL(join(racine, 'vite.config.js')).href);
  const coquille = readFileSync(join(racine, 'electron', 'main.js'), 'utf8');
  const appel = /\bloadFile\s*\(\s*([\p{L}_$][\p{L}\p{N}_$]*)\s*\)/u.exec(coquille);
  const constante =
    appel &&
    new RegExp(
      String.raw`\bconst\s+${appel[1]}\s*=\s*fileURLToPath\(\s*new\s+URL\(\s*(['"])([^'"]+)\1\s*,\s*import\.meta\.url\s*\)\s*\)`,
    ).exec(coquille);
  return {
    sortieDeVite: vite.build?.outDir,
    repertoireWeb: lireJson(racine, 'capacitor.config.json').webDir,
    pageDeLaCoquille: constante ? relative(racine, resolve(racine, 'electron', constante[2])).split(sep).join('/') : null,
    emporte: charger(racine).files.includes('www/**'),
  };
}

// La langue que l'appel mount(App, …) d'un texte passe à App : le texte de
// la valeur de sa clé langue, tel qu'écrit — « 'fr' » pour la chaîne —, ou
// null sans appel ou sans clé écrite « langue: ». L'appel court jusqu'à la
// ligne qui s'ouvre sur « }); ». Lève quand l'appel en porte deux.
function langueDeLaPage(texte) {
  const debut = texte.search(/\bmount\s*\(\s*App\s*,/);
  if (debut === -1) return null;
  const fin = texte.indexOf('\n});', debut);
  const appel = texte.slice(debut, fin === -1 ? texte.length : fin);
  const langues = [...appel.matchAll(/\blangue\s*:\s*([^,\n}]+?)\s*(?=[,\n}])/g)].map(([, valeur]) => valeur);
  if (langues.length > 1) throw new Error(`deux langues passées à App : ${langues.join(', ')}`);
  return langues[0] ?? null;
}

describe('livrable : la page construite et ce que la coquille lui passe', () => {
  test('la page construite vit dans www/ : la sortie de Vite, le répertoire web de Capacitor, la page que charge la coquille et ce qu’emporte electron-builder (§ 13.1)', async () => {
    const page = await pageConstruite(RACINE);
    assert.deepEqual(page, {
      sortieDeVite: 'www',
      repertoireWeb: 'www',
      pageDeLaCoquille: 'www/index.html',
      emporte: true,
    });
  });

  test('src/main.js passe langue: \'fr\' à App : la construction livrée n’emploie jamais la langue témoin (§ 14.6)', () => {
    assert.equal(langueDeLaPage(readFileSync(join(RACINE, 'src', 'main.js'), 'utf8')), "'fr'");
  });

  test('la langue lue est la seule que porte mount(App, …) : la langue témoin, une variable, une clé abrégée ou absente ne sont pas « fr »', () => {
    const page = (ligne) => ["import App from './App.svelte';", 'mount(App, {', '  target: document.body,', '  props: {', ligne, '    demonstrations,', '  },', '});'].join('\n');
    assert.equal(langueDeLaPage(page("    langue: 'fr',")), "'fr'");
    assert.equal(langueDeLaPage(page("    langue: 'temoin',")), "'temoin'");
    assert.equal(langueDeLaPage(page('    langue: LANGUE,')), 'LANGUE');
    assert.equal(langueDeLaPage(page('    langue,')), null);
    assert.equal(langueDeLaPage(page('')), null);
    assert.equal(langueDeLaPage("const langue = 'fr';\nmount(Autre, { props: { langue: 'fr' } });\n"), null);
    assert.throws(() => langueDeLaPage(page("    langue: 'fr',\n    langue: 'temoin',")), /deux langues/);
  });
});
