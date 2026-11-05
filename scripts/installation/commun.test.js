// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Fonctions de scripts/installation/commun.sh, appelées par bash : la
// famille d'un os-release, l'architecture et la plateforme au sens de
// nodejs.org et d'Electron, l'archive de Node dans un SHASUMS256.txt, la
// majeure de .node-version, l'état des dépendances npm, le consentement.
// Sous Windows, ces scripts passent la main à PowerShell et ces épreuves ne
// se jouent pas.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from '../../test/lanceur.js';

const COMMUN = fileURLToPath(new URL('./commun.sh', import.meta.url));
const SOUS_WINDOWS = process.platform === 'win32';

// Exécute un script bash après avoir sourcé commun.sh, dans un
// environnement réduit au PATH, à HOME et à ce qu'on lui passe ; l'entrée
// standard n'est jamais un terminal. Rend { statut, sortie, erreurs }.
function bash(script, env = {}) {
  const r = spawnSync('bash', ['-c', `. "$1"\n${script}`, 'bash', COMMUN], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env },
    input: '',
  });
  return { statut: r.status, sortie: r.stdout.trim(), erreurs: r.stderr.trim() };
}

// Écrit des fichiers dans un dossier temporaire, appelle f(dossier), efface.
function avecDossier(fichiers, f) {
  const dossier = mkdtempSync(join(tmpdir(), 'installation-'));
  try {
    for (const [chemin, texte] of Object.entries(fichiers)) {
      mkdirSync(join(dossier, chemin, '..'), { recursive: true });
      writeFileSync(join(dossier, chemin), texte);
    }
    return f(dossier);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

describe('installation : la famille du système, lue dans os-release', { skip: SOUS_WINDOWS }, () => {
  // [contenu d'os-release, famille attendue] : les systèmes du catalogue de
  // machines virtuelles, deux dérivés, des guillemets simples, un inconnu.
  const CAS = [
    ['ID=ubuntu\nID_LIKE=debian\nVERSION_ID="24.04"\n', 'debian'],
    ['ID=debian\nVERSION_ID="13"\n', 'debian'],
    ['ID=linuxmint\nID_LIKE="ubuntu debian"\n', 'debian'],
    ['ID=fedora\nVERSION_ID=43\n', 'fedora'],
    ['ID="almalinux"\nID_LIKE="rhel centos fedora"\n', 'fedora'],
    ['ID="rocky"\nID_LIKE="rhel centos fedora"\n', 'fedora'],
    ['ID="opensuse-leap"\nID_LIKE="suse opensuse"\n', 'suse'],
    ['ID="opensuse-tumbleweed"\nID_LIKE="opensuse suse"\n', 'suse'],
    ['ID=arch\n', 'arch'],
    ['ID=manjaro\nID_LIKE=arch\n', 'arch'],
    ['ID=nixos\nVERSION_ID="25.11"\n', 'nixos'],
    ["ID='fedora'\n", 'fedora'],
    ['ID=void\n', 'inconnu'],
    ['NAME="sans identifiant"\n', 'inconnu'],
  ];

  test('chaque os-release donne sa famille, par ID puis ID_LIKE', () => {
    const ecarts = avecDossier({}, (dossier) =>
      CAS.flatMap(([contenu, attendue], rang) => {
        const fichier = join(dossier, `os-release-${rang}`);
        writeFileSync(fichier, contenu);
        const { sortie } = bash(`gtt_famille_depuis_os_release "${fichier}"`);
        return sortie === attendue ? [] : [`${JSON.stringify(contenu)} → ${sortie}, attendu ${attendue}`];
      }),
    );
    assert.deepEqual(ecarts, []);
  });

  test('un os-release absent donne inconnu', () => {
    assert.equal(bash('gtt_famille_depuis_os_release /chemin/absent/os-release').sortie, 'inconnu');
  });

  test('GTT_FAMILLE l’emporte sur le système', () => {
    assert.equal(bash('gtt_famille', { GTT_FAMILLE: 'suse' }).sortie, 'suse');
  });
});

describe('installation : architecture et plateforme', { skip: SOUS_WINDOWS }, () => {
  test('uname -m se traduit en architecture de nodejs.org', () => {
    const CAS = [
      ['x86_64', 'x64'], ['amd64', 'x64'], ['aarch64', 'arm64'], ['arm64', 'arm64'],
      ['s390x', 's390x'], ['ppc64le', 'ppc64le'], ['riscv64', 'inconnue'], ['i686', 'inconnue'],
    ];
    for (const [machine, attendue] of CAS) {
      assert.equal(bash(`gtt_arch_node_depuis ${machine}`).sortie, attendue, machine);
    }
  });

  test('Electron et le Chromium de Playwright ne sont publiés que pour linux et darwin, x64 et arm64', () => {
    const CAS = [
      ['linux', 'x64', 0], ['linux', 'arm64', 0], ['darwin', 'x64', 0], ['darwin', 'arm64', 0],
      ['linux', 's390x', 1], ['linux', 'ppc64le', 1], ['linux', 'inconnue', 1],
    ];
    for (const [os, arch, statut] of CAS) {
      assert.equal(bash(`gtt_electron_publie ${os} ${arch}`).statut, statut, `${os}-${arch}`);
    }
  });
});

describe('installation : l’archive de Node dans SHASUMS256.txt', { skip: SOUS_WINDOWS }, () => {
  // Sommes inventées ; noms de la forme que publie nodejs.org.
  const SOMMES = [
    'a1  node-v26.10.0-darwin-arm64.tar.gz',
    'a2  node-v26.10.0-darwin-arm64.tar.xz',
    'b1  node-v26.10.0-linux-x64.tar.gz',
    'b2  node-v26.10.0-linux-x64-musl.tar.xz',
    'b3  node-v26.10.0-linux-x64.tar.xz',
    'c1  node-v26.10.0-linux-s390x.tar.xz',
    'd1  node-v26.10.0-win-x64.zip',
    'e1  node-v26.10.0.tar.xz',
    'e2  node-v26.10.0-headers.tar.xz',
    'e3  win-x64/node.exe',
    '',
  ].join('\n');

  test('chaque plateforme publiée donne sa somme et son archive .tar.xz, et rien d’autre', () => {
    const CAS = [
      ['linux', 'x64', 'b3 node-v26.10.0-linux-x64.tar.xz'],
      ['linux', 's390x', 'c1 node-v26.10.0-linux-s390x.tar.xz'],
      ['darwin', 'arm64', 'a2 node-v26.10.0-darwin-arm64.tar.xz'],
      ['linux', 'ppc64le', ''],
      ['win', 'x64', ''],
    ];
    avecDossier({ 'SHASUMS256.txt': SOMMES }, (dossier) => {
      for (const [os, arch, attendu] of CAS) {
        const { sortie } = bash(`gtt_archive_node "${join(dossier, 'SHASUMS256.txt')}" ${os} ${arch}`);
        assert.equal(sortie, attendu, `${os}-${arch}`);
      }
    });
  });
});

describe('installation : .node-version, dépendances, consentement', { skip: SOUS_WINDOWS }, () => {
  test('la majeure de .node-version est un entier, et rien d’autre ne passe', () => {
    const CAS = [['26\n', 0, '26'], [' 26 \r\n', 0, '26'], ['v26\n', 1, ''], ['26.10\n', 1, ''], ['', 1, '']];
    for (const [contenu, statut, sortie] of CAS) {
      avecDossier({ '.node-version': contenu }, (dossier) => {
        const r = bash(`GTT_RACINE="${dossier}"\ngtt_node_majeure`);
        assert.deepEqual([r.statut, r.sortie], [statut, sortie], JSON.stringify(contenu));
        if (statut !== 0) assert.match(r.erreurs, /\.node-version doit porter une majeure entière/);
      });
    }
  });

  test('les dépendances suivent le verrou tant que node_modules/.package-lock.json n’est pas plus ancien', () => {
    avecDossier({ 'package-lock.json': '{}', 'node_modules/.package-lock.json': '{}' }, (dossier) => {
      const aJour = () => bash(`GTT_RACINE="${dossier}"\ngtt_dependances_a_jour`).statut;
      const date = (chemin, secondes) => utimesSync(join(dossier, chemin), secondes, secondes);
      date('package-lock.json', 1_000_000);
      date('node_modules/.package-lock.json', 2_000_000);
      assert.equal(aJour(), 0, 'installation postérieure au verrou');
      date('package-lock.json', 3_000_000);
      assert.equal(aJour(), 1, 'verrou modifié depuis l’installation');
      rmSync(join(dossier, 'node_modules'), { recursive: true });
      assert.equal(aJour(), 1, 'aucune installation');
    });
  });

  test('sans terminal, rien ne consent ; GTT_OUI=1 consent d’avance', () => {
    assert.equal(bash('gtt_confirmer "Question ?"').statut, 1);
    assert.equal(bash('gtt_confirmer "Question ?"', { GTT_OUI: '1' }).statut, 0);
  });

  test('gtt_demander ne lit que le terminal : GTT_OUI=1 n’y répond pas', () => {
    assert.equal(bash('gtt_demander "Question ?"').statut, 1);
    assert.equal(bash('gtt_demander "Question ?"', { GTT_OUI: '1' }).statut, 1);
  });

  test('chaque famille qui pose des paquets a ses outils, ses bibliothèques d’Electron et ses outils de développement', () => {
    for (const famille of ['debian', 'fedora', 'suse', 'arch']) {
      for (const liste of ['gtt_paquets_outils', 'gtt_paquets_electron', 'gtt_paquets_developpement']) {
        assert.notEqual(bash(`${liste} ${famille}`).sortie, '', `${liste} ${famille}`);
      }
      assert.match(bash(`gtt_paquets_electron ${famille}`).sortie, /gtk/, famille);
      assert.match(bash(`gtt_paquets_outils ${famille}`).sortie, /\bmake\b/, famille);
    }
  });
});
