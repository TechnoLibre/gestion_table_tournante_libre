// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le livrable tel qu'electron-builder.config.cjs le décrit : son nom (§ 18.2),
// sa forme (§ 16), ce qu'il emporte (§ 14.15) et l'identité inscrite dans sa
// ressource de version. La configuration se charge ici comme electron-builder
// la charge, par require.
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire, isBuiltin } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriver } from '../scripts/version.js';
import { describe, test } from './lanceur.js';
import { versionVoisine } from './version_voisine.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const CONFIGURATION = 'electron-builder.config.cjs';
const ELECTRON = join(RACINE, 'electron');

const lireJson = (racine, chemin) => JSON.parse(readFileSync(join(racine, chemin), 'utf8'));
const charger = (racine) => {
  const chemin = join(racine, CONFIGURATION);
  return createRequire(chemin)(chemin);
};

// Fichiers d'electron/, à toute profondeur, en chemins absolus.
const fichiersDElectron = () =>
  readdirSync(ELECTRON, { recursive: true, withFileTypes: true })
    .filter((entree) => entree.isFile())
    .map((entree) => join(entree.parentPath, entree.name));

// Chargements que demande le texte d'un module : import et export statiques,
// import() et require(). Chacun est { specificateur } quand l'argument est
// une chaîne littérale, { argument } sinon. Le relevé lit le texte entier,
// commentaires compris.
const DEPUIS = /\b(?:import|export)\b[^'"`;]*?\bfrom\s*(['"])(?<specificateur>[^'"]+)\1/g;
const IMPORT_NU = /\bimport\s*(['"])(?<specificateur>[^'"]+)\1/g;
const APPEL = /\b(?:import|require)\s*\((?<argument>[^)]*)\)/g;
const LITTERAL = /^\s*(['"])(?<specificateur>[^'"]*)\1\s*$/;
function chargements(texte) {
  return [
    ...[...texte.matchAll(DEPUIS), ...texte.matchAll(IMPORT_NU)].map(({ groups }) => ({
      specificateur: groups.specificateur,
    })),
    ...[...texte.matchAll(APPEL)].map(({ groups }) => {
      const litteral = LITTERAL.exec(groups.argument);
      return litteral === null ? { argument: groups.argument.trim() } : { specificateur: litteral.groups.specificateur };
    }),
  ];
}

// Raison de refuser le chargement que demande un fichier d'electron/, ou
// null quand il reste dans le paquet : electron, un module de Node hors du
// lanceur d'épreuves, ou un fichier d'electron/. Le paquet n'emporte ni
// node_modules ni rien de test/ : un chargement qui en sort échoue au
// démarrage de l'exécutable. Un chargement calculé ne se vérifie pas d'ici.
function raisonDeRefus({ fichier, specificateur, argument }) {
  if (specificateur === undefined) return `argument calculé, ${argument} : il ne se vérifie pas`;
  if (/^(?:vitest|node:test)(?:\/|$)|^@vitest\//.test(specificateur)) return "lanceur d'épreuves";
  if (specificateur === 'electron' || isBuiltin(specificateur)) return null;
  if (/^\.{1,2}(?:\/|$)/.test(specificateur)) {
    return resolve(dirname(fichier), specificateur).startsWith(`${ELECTRON}${sep}`) ? null : "hors d'electron/";
  }
  return "hors du paquet, qui n'emporte aucun node_modules";
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
    const fichiers = fichiersDElectron();
    assert.ok(fichiers.length > 0, 'electron/ ne contient aucun fichier');
    assert.deepEqual(fichiers.filter((chemin) => /\.test\.[cm]?js$/.test(chemin)), []);
  });

  test("electron/ ne charge qu'electron, Node et ses propres fichiers : ni épreuve, ni lanceur, ni dépendance (§ 14.9)", () => {
    const demandes = fichiersDElectron().flatMap((fichier) =>
      chargements(readFileSync(fichier, 'utf8')).map((chargement) => ({ fichier, ...chargement })),
    );
    assert.ok(demandes.length > 0, 'aucun chargement relevé dans electron/');
    const refusees = demandes
      .map((demande) => ({ ...demande, fichier: relative(RACINE, demande.fichier), raison: raisonDeRefus(demande) }))
      .filter(({ raison }) => raison !== null);
    assert.deepEqual(refusees, []);
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
});
