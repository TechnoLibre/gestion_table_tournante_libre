// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Sur une petite machine, les séries node et node-long se jouent en threads
// (test/machine.js). Un thread de Node refuse ce qui changerait le processus
// entier — process.chdir, process.umask avec un masque, les changements
// d'identité — là où un processus complet l'accepte : une épreuve qui s'en
// servirait passerait sur une grande machine et échouerait sur une petite.
// La garde les refuse dans tout le code que ces séries exécutent : les
// épreuves de src/ et de scripts/, les modules sous test/, et les scripts
// qu'elles importent. L'environnement, lui, est copié dans chaque thread :
// une épreuve qui écrit process.env ne trouble pas sa voisine, et la garde ne
// le refuse pas.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from './lanceur.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));

// Appels qu'un thread de Node refuse. Un motif exige la parenthèse de
// l'appel : une phrase qui nomme process.chdir n'en est pas un. umask sans
// argument lit le masque, ce qu'un thread accepte.
const REFUSES_DANS_UN_THREAD = [
  ['process.chdir', /\bprocess\s*\??\.\s*chdir\s*(?:\?\.)?\s*\(/g],
  ['process.umask(masque)', /\bprocess\s*\??\.\s*umask\s*(?:\?\.)?\s*\(\s*[^)\s]/g],
  ['process.set…id', /\bprocess\s*\??\.\s*(?:set(?:e?[ug]id|groups)|initgroups)\s*(?:\?\.)?\s*\(/g],
];

// Ce fichier nomme ces appels dans ses motifs et dans ses données d'épreuve :
// il est hors de son propre balayage.
const CE_FICHIER = fileURLToPath(import.meta.url);

// Fichiers JavaScript que les séries node exécutent : les épreuves de src/ et
// de scripts/, hors épreuves du navigateur, tout module sous test/, et les
// scripts de scripts/, que des épreuves importent.
function fichiersExecutes(racine) {
  const sous = (dossier) => {
    try {
      return readdirSync(join(racine, dossier), { recursive: true, withFileTypes: true })
        .filter((e) => e.isFile() && /\.[cm]?js$/.test(e.name))
        .map((e) => join(e.parentPath, e.name));
    } catch {
      return [];
    }
  };
  return [
    ...sous('src').filter((f) => /\.test\.[cm]?js$/.test(f) && !/\.navigateur\.test\.[cm]?js$/.test(f)),
    ...sous('scripts'),
    ...sous('test').filter((f) => !f.includes(`${join('test', 'fixtures')}`) && f !== CE_FICHIER),
  ].sort();
}

// Relevé « fichier:ligne appel » de ces appels, par fichier puis par ligne.
// Lève quand aucun fichier n'est examiné (§ 14.2).
function releverAppelsRefuses(racine) {
  const fichiers = fichiersExecutes(racine);
  assert.ok(fichiers.length > 0, 'aucun fichier examiné');
  return fichiers.flatMap((fichier) => {
    const texte = readFileSync(fichier, 'utf8');
    return REFUSES_DANS_UN_THREAD.flatMap(([appel, motif]) =>
      [...texte.matchAll(motif)].map(({ index }) => ({ ligne: texte.slice(0, index).split('\n').length, appel })),
    )
      .sort((a, b) => a.ligne - b.ligne)
      .map(({ ligne, appel }) => `${relative(racine, fichier)}:${ligne} ${appel}`);
  });
}

// Écrit les fichiers donnés dans une racine temporaire, rend le relevé, et
// efface la racine.
function avecArbre(fichiers) {
  const racine = mkdtempSync(join(tmpdir(), 'fils-'));
  try {
    for (const [chemin, texte] of Object.entries(fichiers)) {
      mkdirSync(dirname(join(racine, chemin)), { recursive: true });
      writeFileSync(join(racine, chemin), texte);
    }
    return releverAppelsRefuses(racine);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
}

describe('fils : ce qu’un thread refuse, hors des séries node (test/machine.js)', () => {
  test('aucune épreuve, aucun module sous test/ ni aucun script n’appelle ce qu’un thread refuse', () => {
    assert.deepEqual(releverAppelsRefuses(RACINE), []);
  });

  test('la garde relève chaque appel par sa ligne, dans les épreuves, les modules sous test/ et les scripts, et pas ses voisins', () => {
    const fichiers = {
      'src/moteur/a.test.js': [
        "process.chdir('/tmp');",
        'process.umask(0o022);',
        'process.setuid(1000);',
        'process?.chdir?.(ici);',
      ].join('\n'),
      'scripts/outil.js': 'process.setgroups([]);\n',
      'test/aide.js': 'process.initgroups("x", 1);\n',
      'src/moteur/voisins.test.js': [
        'const ici = process.cwd();',
        'const masque = process.umask();',
        "process.env.SONDE = 'copie par thread';",
        '// process.chdir changerait le processus entier.',
      ].join('\n'),
      'src/moteur/module.js': "process.chdir('/tmp');\n",
      'src/interface/App.navigateur.test.js': "process.chdir('/tmp');\n",
    };
    assert.deepEqual(avecArbre(fichiers), [
      'scripts/outil.js:1 process.set…id',
      'src/moteur/a.test.js:1 process.chdir',
      'src/moteur/a.test.js:2 process.umask(masque)',
      'src/moteur/a.test.js:3 process.set…id',
      'src/moteur/a.test.js:4 process.chdir',
      'test/aide.js:1 process.set…id',
    ]);
  });

  test('un arbre sans fichier exécuté par ces séries fait échouer la garde', () => {
    assert.throws(() => avecArbre({ 'src/moteur/module.js': 'export const a = 1;\n' }), /aucun fichier examiné/);
  });
});
