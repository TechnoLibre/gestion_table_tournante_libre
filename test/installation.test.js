// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les points d'entrée de l'installation et du lancement : ./install.sh,
// ./install_dev.sh, ./run.sh, ./create_exe.sh et le Makefile sous Linux et
// macOS ; install.cmd, install_dev.cmd et run.cmd sous Windows, qui passent
// la main à PowerShell ; shell.nix sous NixOS. Ces épreuves gardent ce qui
// les casse sans rien faire échouer ailleurs : un bit d'exécution perdu, un
// chemin renommé, une commande npm qui contourne le Node du projet, une fin
// de ligne d'Unix dans un fichier de commandes, une marque d'ordre d'octets
// absente. ./create_exe.sh s'y joue aussi sur une copie, devant
// l'exécutable de la même version.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from './lanceur.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const lire = (chemin) => readFileSync(join(RACINE, chemin), 'utf8');
const SCRIPTS_BASH = ['install.sh', 'install_dev.sh', 'run.sh', 'create_exe.sh', 'scripts/installation/avec_node.sh'];

describe('installation : les scripts bash', () => {
  test('ils sont exécutables, et cherchent bash dans le PATH : /bin/bash manque sous NixOS', () => {
    for (const script of SCRIPTS_BASH) {
      assert.equal(lire(script).split('\n')[0], '#!/usr/bin/env bash', script);
      if (process.platform !== 'win32') {
        assert.equal(statSync(join(RACINE, script)).mode & 0o111, 0o111, `${script} n'est pas exécutable`);
      }
    }
  });

  test('ils sourcent la bibliothèque commune, et s’arrêtent à la première erreur', () => {
    for (const script of SCRIPTS_BASH) {
      const texte = lire(script);
      assert.match(texte, /^set -euo pipefail$/m, script);
      assert.match(texte, /commun\.sh/, script);
    }
  });
});

describe('installation : ./create_exe.sh devant l’exécutable de la même version (§ 18.2)', { skip: process.platform === 'win32' }, () => {
  // Une copie de create_exe.sh et de commun.sh, avec un avec_node.sh factice
  // qui répond « livrable_epreuve.exe » au calcul du nom et consigne dans
  // journal chaque autre commande, celle qui lancerait la construction.
  // L'entrée standard n'est jamais un terminal. Rend { statut, erreurs,
  // journal }, journal null quand rien n'a été lancé.
  function lancer({ options = [], env = {}, existant = true } = {}) {
    const dossier = mkdtempSync(join(tmpdir(), 'create-exe-'));
    try {
      mkdirSync(join(dossier, 'scripts/installation'), { recursive: true });
      copyFileSync(join(RACINE, 'create_exe.sh'), join(dossier, 'create_exe.sh'));
      copyFileSync(join(RACINE, 'scripts/installation/commun.sh'), join(dossier, 'scripts/installation/commun.sh'));
      const factice = join(dossier, 'scripts/installation/avec_node.sh');
      writeFileSync(
        factice,
        '#!/usr/bin/env bash\nif [ "$1" = node ]; then echo livrable_epreuve.exe; else printf \'%s\\n\' "$*" >> journal; fi\n',
      );
      chmodSync(factice, 0o755);
      if (existant) {
        mkdirSync(join(dossier, 'dist-electron'));
        writeFileSync(join(dossier, 'dist-electron/livrable_epreuve.exe'), 'déjà livré\n');
      }
      const r = spawnSync('bash', [join(dossier, 'create_exe.sh'), ...options], {
        encoding: 'utf8',
        env: { PATH: process.env.PATH, HOME: process.env.HOME, GTT_FAMILLE: 'arch', ...env },
        input: '',
      });
      const journal = existsSync(join(dossier, 'journal')) ? readFileSync(join(dossier, 'journal'), 'utf8') : null;
      return { statut: r.status, erreurs: r.stderr, journal };
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  }

  test('GTT_OUI=1 ne répond pas à la question : sans terminal, l’exécutable reste et rien ne se construit', () => {
    const r = lancer({ env: { GTT_OUI: '1' } });
    assert.equal(r.statut, 1, r.erreurs);
    assert.match(r.erreurs, /dist-electron\/livrable_epreuve\.exe reste/);
    assert.equal(r.journal, null);
  });

  test('--reconstruire l’écrase sans question ; sans exécutable de la version, rien ne se demande', () => {
    assert.equal(lancer({ options: ['--reconstruire'] }).journal, 'scripts/construire_windows.sh --reconstruire\n');
    assert.equal(lancer({ existant: false }).journal, 'scripts/construire_windows.sh\n');
  });
});

describe('installation : le Makefile', () => {
  const makefile = lire('Makefile');
  const recettes = makefile.split('\n').filter((ligne) => ligne.startsWith('\t'));

  test('make sans cible lance l’application, comme ./run.sh', () => {
    assert.match(makefile, /^\.DEFAULT_GOAL := run$/m);
    assert.match(makefile, /^LANCER := \.\/run\.sh$/m);
    assert.match(makefile, /^run: .*\n\t\$\(LANCER\)$/m);
  });

  test('chaque script que le Makefile nomme existe', () => {
    const chemins = [...makefile.matchAll(/(?:^|[\s=])(?:\.\/)?((?:scripts\/[\w/.-]+\.(?:sh|ps1|js))|[\w-]+\.sh)\b/gm)]
      .map(([, chemin]) => chemin);
    assert.ok(chemins.length > 0, 'aucun script relevé');
    assert.deepEqual(chemins.filter((chemin) => !existsSync(join(RACINE, chemin))), []);
  });

  test('npm, npx et node ne s’y lancent que par avec_node, qui pose le Node du projet', () => {
    const directes = recettes.filter((ligne) => /\b(?:npm|npx|node)\b/.test(ligne) && !ligne.includes('$(AVEC_NODE)'));
    assert.ok(recettes.length > 0, 'aucune recette relevée');
    assert.deepEqual(directes, []);
  });
});

describe('installation : Windows', () => {
  const commandes = readdirSync(RACINE).filter((nom) => nom.endsWith('.cmd')).sort();

  test('install.cmd, install_dev.cmd et run.cmd existent à la racine', () => {
    assert.deepEqual(commandes, ['install.cmd', 'install_dev.cmd', 'run.cmd']);
  });

  test('chaque fichier de commandes appelle un script PowerShell qui existe, avec ses arguments', () => {
    for (const nom of commandes) {
      const appel = lire(nom).match(/-File "%~dp0(scripts\\windows\\[\w.]+\.ps1)"[^\r\n]*%\*/);
      assert.ok(appel, `${nom} n'appelle aucun script PowerShell avec %*`);
      assert.ok(existsSync(join(RACINE, ...appel[1].split('\\'))), `${nom} → ${appel[1]} absent`);
    }
  });

  test('les fichiers de commandes ont des fins de ligne de Windows', () => {
    for (const nom of commandes) {
      const texte = lire(nom);
      assert.equal(texte.replaceAll('\r\n', '').includes('\n'), false, `${nom} a une fin de ligne d'Unix`);
    }
  });

  test('les scripts PowerShell portent la marque d’ordre d’octets UTF-8 : sans elle, Windows PowerShell 5.1 défigure les accents', () => {
    const scripts = readdirSync(join(RACINE, 'scripts', 'windows')).filter((nom) => nom.endsWith('.ps1'));
    assert.ok(scripts.length > 0, 'aucun script PowerShell');
    for (const nom of scripts) {
      const octets = readFileSync(join(RACINE, 'scripts', 'windows', nom));
      assert.deepEqual([...octets.subarray(0, 3)], [0xef, 0xbb, 0xbf], nom);
    }
  });
});

describe('installation : la majeure de Node a une seule source', () => {
  test('.node-version porte une majeure entière', () => {
    assert.match(lire('.node-version'), /^\d+\n$/);
  });

  test('bash, PowerShell et shell.nix la lisent dans .node-version au lieu de l’écrire', () => {
    assert.match(lire('scripts/installation/commun.sh'), /\$GTT_RACINE\/\.node-version/);
    assert.match(lire('scripts/windows/commun.ps1'), /'\.node-version'/);
    assert.match(lire('scripts/installation/shell.nix'), /readFile \.\.\/\.\.\/\.node-version/);
  });

  test('shell.nix épingle nixpkgs par révision et par somme', () => {
    const nix = lire('scripts/installation/shell.nix');
    assert.match(nix, /archive\/[0-9a-f]{40}\.tar\.gz/);
    assert.match(nix, /sha256 = "[0-9a-z]{52}"/);
  });
});
