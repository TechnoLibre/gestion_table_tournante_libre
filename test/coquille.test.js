// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La coquille Electron (§ 13.1) : la fenêtre qu'ouvre le processus principal,
// la page qu'elle charge, le pont étroit que le préchargement expose, et le
// trajet du dossier publié par le lanceur portable jusqu'à la page (§ 8.6,
// point 1).
//
// electron/main.js s'exécute sous Node, dans un processus à part, contre
// test/electron_factice.js, qui consigne ce que la coquille demande à
// Electron puis rend son journal en JSON. Ce qui s'éprouve ici est ce que la
// coquille demande ; qu'Electron l'applique relève d'une épreuve dans un vrai
// Electron.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, test } from './lanceur.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const FACTICE = pathToFileURL(join(RACINE, 'test', 'electron_factice.js')).href;
const PRINCIPAL = join(RACINE, 'electron', 'main.js');
const PRECHARGEMENT = join(RACINE, 'electron', 'preload.cjs');
const CANAL = 'gtt:dossier-executable';

// Délai de l'exécution de la coquille. Le factice ne joue la page qu'une
// fois le processus sans rien à faire ; un minuteur ou un écouteur laissé
// actif l'en empêche, et l'exécution ne finit jamais. Le délai reste sous
// celui d'une épreuve de Vitest, 5 s, qui n'interrompt pas un appel
// synchrone : l'épreuve échoue en le disant, au lieu de figer la série. Le
// délai écoulé, le processus reçoit KILL, qu'aucun gestionnaire de signal
// ne retient.
const DELAI_MS = 4_000;

// Exécute la coquille contre le factice et rend son journal. Le répertoire
// courant est un dossier vide hors du projet : dans l'exécutable, il n'est
// jamais l'intérieur d'app.asar, si bien qu'un chemin résolu contre lui ne
// désigne ni la page ni le préchargement.
function executerLaCoquille() {
  const environnement = { ...process.env };
  delete environnement.PORTABLE_EXECUTABLE_DIR;
  const ailleurs = mkdtempSync(join(tmpdir(), 'coquille-'));
  try {
    const resultat = spawnSync(process.execPath, ['--import', FACTICE, PRINCIPAL], {
      cwd: ailleurs,
      encoding: 'utf8',
      env: environnement,
      timeout: DELAI_MS,
      killSignal: 'SIGKILL',
    });
    assert.notEqual(
      resultat.error?.code,
      'ETIMEDOUT',
      `la coquille ne s'arrête pas en ${DELAI_MS} ms : un minuteur ou un écouteur la tient en vie`,
    );
    assert.equal(resultat.status, 0, `la coquille ne s'exécute pas :\n${resultat.stderr}`);
    return JSON.parse(resultat.stdout);
  } finally {
    rmSync(ailleurs, { recursive: true, force: true });
  }
}

// L'exécution est partagée par les épreuves : le processus ne se lance
// qu'une fois, et son échec se rend à chacune sans relancer.
let execution;
function journalDeLaCoquille() {
  if (execution === undefined) {
    try {
      execution = { journal: executerLaCoquille() };
    } catch (erreur) {
      execution = { erreur };
    }
  }
  if (execution.erreur !== undefined) throw execution.erreur;
  return execution.journal;
}

describe('coquille : processus principal', () => {
  test("une seule fenêtre, 1366 × 768 : page isolée, sans Node, en bac à sable, préchargée par le pont", () => {
    const { fenetres } = journalDeLaCoquille();
    assert.equal(fenetres.length, 1);
    const [{ width, height, webPreferences }] = fenetres;
    assert.deepEqual({ width, height }, { width: 1366, height: 768 });
    assert.deepEqual(webPreferences, {
      preload: PRECHARGEMENT,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    });
    assert.ok(existsSync(webPreferences.preload), `${webPreferences.preload} absent`);
  });

  test("aucun menu d'application : le menu par défaut d'Electron, en anglais, est retiré avant la première fenêtre (§ 2)", () => {
    const { menus, sequence } = journalDeLaCoquille();
    assert.deepEqual(menus, [null]);
    const retrait = sequence.indexOf('Menu.setApplicationMenu');
    const fenetre = sequence.indexOf('new BrowserWindow');
    assert.ok(retrait !== -1 && fenetre !== -1 && retrait < fenetre, `ordre des appels : ${sequence.join(', ')}`);
  });

  test('la fenêtre charge la page que Vite construit dans www/', () => {
    assert.deepEqual(journalDeLaCoquille().chargements, [
      { loadFile: join(RACINE, 'www', 'index.html') },
    ]);
  });

  test(`un seul canal IPC, ${CANAL}, posé avant le chargement de la page`, () => {
    const { canaux, sequence } = journalDeLaCoquille();
    assert.deepEqual(canaux, [CANAL]);
    const pose = sequence.indexOf(`ipcMain.handle:${CANAL}`);
    const charge = sequence.indexOf('loadFile');
    assert.ok(pose !== -1 && charge !== -1 && pose < charge, `ordre des appels : ${sequence.join(', ')}`);
  });

  test("la page n'ouvre aucune fenêtre et ne navigue nulle part", () => {
    const { ouvertures, navigations } = journalDeLaCoquille();
    assert.deepEqual(ouvertures, [{ action: 'deny' }]);
    assert.ok(navigations.length > 0, 'aucun écouteur de will-navigate');
    assert.deepEqual(navigations, navigations.map(() => true));
  });
});

describe('coquille : préchargement', () => {
  test("n'expose que window.gtt, et ne requiert qu'electron", () => {
    const { prechargement } = journalDeLaCoquille();
    assert.equal(prechargement.erreur, undefined, prechargement.erreur);
    assert.deepEqual(prechargement.requis, ['electron']);
    assert.deepEqual(prechargement.exposes, [
      { cle: 'gtt', membres: ['dossierExecutable', 'plateforme'] },
    ]);
    assert.equal(prechargement.plateforme, 'electron');
  });

  test(`gtt.dossierExecutable() demande à chaque appel, par ${CANAL}, le dossier publié par le lanceur portable, null sans lui`, () => {
    const { prechargement, invocations } = journalDeLaCoquille();
    assert.equal(prechargement.erreur, undefined, prechargement.erreur);
    assert.deepEqual(prechargement.reponses, {
      publie: { valeur: 'E:\\soirees' },
      absent: { valeur: null },
      vide: { valeur: null },
    });
    // Le préchargement voit lui aussi process.env : seules les invocations
    // montrent que la réponse vient du processus principal, une par appel.
    assert.deepEqual(invocations, [CANAL, CANAL, CANAL]);
  });
});
