// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La coquille Electron (§ 13.1) : la fenêtre qu'ouvre le processus principal,
// la page qu'elle charge, le profil de Chromium hors d'AppData (§ 8.6), le
// pont étroit et nommé que le préchargement expose — une fonction par
// primitive du système de fichiers, un canal par fonction —, et ce que le
// processus principal y répond : emplacements, racines, dialogues,
// explorateur.
//
// electron/main.js s'exécute sous Node, dans un processus à part, contre
// test/electron_factice.js, qui consigne ce que la coquille demande à
// Electron puis rend son journal en JSON. Ce qui s'éprouve ici est ce que la
// coquille demande ; qu'Electron l'applique relève d'une épreuve dans un vrai
// Electron (make essai_demarrage). Les primitives elles-mêmes s'éprouvent
// dans test/fichiers_electron.test.js.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PRIMITIVES } from '../electron/fichiers.js';
import { describe, test } from './lanceur.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const FACTICE = pathToFileURL(join(RACINE, 'test', 'electron_factice.js')).href;
const PRINCIPAL = join(RACINE, 'electron', 'main.js');
const PRECHARGEMENT = join(RACINE, 'electron', 'preload.cjs');
const NOM_PRODUIT = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8')).productName;
const CANAUX = PRIMITIVES.map((primitive) => `gtt:fichiers:${primitive}`);

// Dossier que publie le lanceur portable, et LOCALAPPDATA, dans le scénario
// qui les donne. Aucun des deux n'est lu ni écrit.
const PUBLIE = join(sep, 'media', 'cle', 'soirees');
const LOCAL = join(sep, 'donnees', 'locales');

// Ce que la coquille voit de l'environnement, par scénario.
const SCENARIOS = {
  publie: { PORTABLE_EXECUTABLE_DIR: PUBLIE, LOCALAPPDATA: LOCAL },
  absent: {},
  vide: { PORTABLE_EXECUTABLE_DIR: '' },
};

// Délai de l'exécution de la coquille. Le factice ne joue la page qu'une
// fois le processus sans rien à faire ; un minuteur ou un écouteur laissé
// actif l'en empêche, et l'exécution ne finit jamais. Le délai reste sous
// celui d'une épreuve de Vitest, 5 s, qui n'interrompt pas un appel
// synchrone : l'épreuve échoue en le disant, au lieu de figer la série. Le
// délai écoulé, le processus reçoit KILL, qu'aucun gestionnaire de signal
// ne retient.
const DELAI_MS = 4_000;

// Le pid d'un processus terminé : aucun processus de ce poste n'y répond
// plus.
const PID_TERMINE = spawnSync(process.execPath, ['-e', '']).pid;

// Ce que le dossier temporaire porte avant la coquille : les Documents du
// produit, où l'explorateur s'ouvre ; le profil qu'a laissé une séance
// terminée, celui d'une séance qui tourne encore — ce processus d'épreuve —,
// et un dossier dont le nom ne porte aucun pid.
const PROFIL_TERMINE = `gtt-profil-${PID_TERMINE}-Ab12Cd`;
const PROFIL_VIVANT = `gtt-profil-${process.pid}-Ef34Gh`;
const AUTRE = 'gtt-profil-sans-pid';
const DOSSIERS_POSES = ['Documents', PROFIL_TERMINE, PROFIL_VIVANT, AUTRE];

// Exécute la coquille contre le factice dans un scénario, et rend son
// journal, son pid, le dossier temporaire qu'elle a reçu, et ce qu'elle y a
// laissé. Le répertoire courant est un dossier vide hors du projet : dans
// l'exécutable, il n'est jamais l'intérieur d'app.asar, si bien qu'un chemin
// résolu contre lui ne désigne ni la page ni le préchargement. Le dossier
// temporaire est neuf, et porte les DOSSIERS_POSES.
function executerLaCoquille(scenario) {
  const environnement = { ...process.env };
  delete environnement.PORTABLE_EXECUTABLE_DIR;
  delete environnement.LOCALAPPDATA;
  const ailleurs = mkdtempSync(join(tmpdir(), 'coquille-'));
  const temporaire = mkdtempSync(join(tmpdir(), 'coquille-temp-'));
  mkdirSync(join(temporaire, 'Documents', NOM_PRODUIT), { recursive: true });
  for (const nom of [PROFIL_TERMINE, PROFIL_VIVANT, AUTRE]) {
    mkdirSync(join(temporaire, nom, 'Session Storage'), { recursive: true });
    writeFileSync(join(temporaire, nom, 'Local State'), '{}');
  }
  try {
    const resultat = spawnSync(process.execPath, ['--import', FACTICE, PRINCIPAL], {
      cwd: ailleurs,
      encoding: 'utf8',
      env: { ...environnement, TMPDIR: temporaire, TEMP: temporaire, TMP: temporaire, ...SCENARIOS[scenario] },
      timeout: DELAI_MS,
      killSignal: 'SIGKILL',
    });
    assert.notEqual(
      resultat.error?.code,
      'ETIMEDOUT',
      `la coquille ne s'arrête pas en ${DELAI_MS} ms : un minuteur ou un écouteur la tient en vie`,
    );
    assert.equal(resultat.status, 0, `la coquille ne s'exécute pas :\n${resultat.stderr}`);
    return {
      journal: JSON.parse(resultat.stdout),
      pid: resultat.pid,
      temporaire,
      restes: readdirSync(temporaire).sort(),
    };
  } finally {
    rmSync(ailleurs, { recursive: true, force: true });
    rmSync(temporaire, { recursive: true, force: true });
  }
}

// Chaque scénario ne s'exécute qu'une fois, et son échec se rend à chaque
// épreuve qui le demande, sans relancer.
const executions = new Map();
function coquille(scenario = 'publie') {
  if (!executions.has(scenario)) {
    try {
      executions.set(scenario, { resultat: executerLaCoquille(scenario) });
    } catch (erreur) {
      executions.set(scenario, { erreur });
    }
  }
  const execution = executions.get(scenario);
  if (execution.erreur !== undefined) throw execution.erreur;
  return execution.resultat;
}
const journalDeLaCoquille = (scenario) => coquille(scenario).journal;

// L'appel de la page à une fonction du pont, consigné par le factice.
const appelDe = (journal, membre) => journal.prechargement.appels.find((appel) => appel.membre === membre);

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

  test('un canal gtt:fichiers:<primitive> par primitive, et aucun autre, chacun posé avant le chargement de la page', () => {
    const { canaux, sequence } = journalDeLaCoquille();
    assert.deepEqual(canaux, CANAUX);
    assert.equal(CANAUX.length, 17);
    const charge = sequence.indexOf('loadFile');
    assert.notEqual(charge, -1);
    for (const canal of CANAUX) {
      const pose = sequence.indexOf(`ipcMain.handle:${canal}`);
      assert.ok(pose !== -1 && pose < charge, `${canal} : ${sequence.join(', ')}`);
    }
  });

  test("la page n'ouvre aucune fenêtre et ne navigue nulle part", () => {
    const { ouvertures, navigations } = journalDeLaCoquille();
    assert.deepEqual(ouvertures, [{ action: 'deny' }]);
    assert.ok(navigations.length > 0, 'aucun écouteur de will-navigate');
    assert.deepEqual(navigations, navigations.map(() => true));
  });

  test('le profil de Chromium est un dossier neuf sous le dossier temporaire, nommé par le pid de la séance, posé avant whenReady, retiré à la sortie (§ 8.6)', () => {
    const { journal, pid, temporaire } = coquille();
    assert.equal(journal.setPath.length, 1, JSON.stringify(journal.setPath));
    const [{ nom, chemin }] = journal.setPath;
    assert.equal(nom, 'userData');
    assert.equal(dirname(chemin), temporaire);
    assert.ok(basename(chemin).startsWith(`gtt-profil-${pid}-`), basename(chemin));
    const pose = journal.sequence.indexOf('app.setPath:userData');
    const pret = journal.sequence.indexOf('app.whenReady');
    assert.ok(pose !== -1 && pret !== -1 && pose < pret, `ordre des appels : ${journal.sequence.join(', ')}`);
    assert.deepEqual(journal.profil, { avant: true, apres: false });
  });

  test("au démarrage, les profils des séances terminées se retirent : ni celui d'une séance vivante, ni un dossier sans pid", () => {
    const { restes } = coquille();
    assert.deepEqual(restes, DOSSIERS_POSES.filter((nom) => nom !== PROFIL_TERMINE).sort());
  });
});

describe('coquille : préchargement', () => {
  test("n'expose que window.gtt.fichiers, une fonction par primitive, et ne requiert qu'electron", () => {
    const { prechargement } = journalDeLaCoquille();
    assert.equal(prechargement.erreur, undefined, prechargement.erreur);
    assert.deepEqual(prechargement.requis, ['electron']);
    assert.deepEqual(prechargement.exposes, [{ cle: 'gtt', membres: ['fichiers'] }]);
    assert.deepEqual(prechargement.fichiers, [...PRIMITIVES]);
    assert.deepEqual(
      prechargement.appels.map(({ membre, type }) => ({ membre, type })),
      PRIMITIVES.map((membre) => ({ membre, type: 'function' })),
    );
  });

  test('chaque fonction invoque son propre canal, une fois par appel, et rend la réponse du processus principal', () => {
    const journal = journalDeLaCoquille();
    assert.deepEqual(
      journal.prechargement.appels.map(({ membre, canaux }) => ({ membre, canaux })),
      PRIMITIVES.map((membre) => ({ membre, canaux: [`gtt:fichiers:${membre}`] })),
    );
    assert.deepEqual(journal.invocations, CANAUX);
    // Une racine que le processus principal ne connaît pas est refusée par
    // lui, en réponse et non en erreur.
    for (const [membre, chemin] of [
      ['sonder', ''],
      ['typeSupport', ''],
      ['lireTexte', 'soiree.gtt.json'],
      ['ecrireAtomique', 'soiree.gtt.json'],
      ['ajouterLigne', 'soiree.gtt-journal.jsonl'],
      ['lister', ''],
      ['creerDossier', 'corbeille'],
      ['deplacer', 'soiree.gtt.json'],
      ['supprimer', 'soiree.gtt.json'],
      ['verrouiller', 'soiree.gtt.verrou'],
      ['deverrouiller', 'soiree.gtt.verrou'],
    ]) {
      assert.deepEqual(
        appelDe(journal, membre).reponse,
        { ok: false, code: 'CHEMIN_REFUSE', details: { chemin } },
        membre,
      );
    }
  });

  test("emplacements et racines viennent du processus principal : le dossier publié et son data/, AppData, LOCALAPPDATA, le temporaire, les Documents du produit", () => {
    const journal = journalDeLaCoquille('publie');
    const { chemins } = journal;
    assert.deepEqual(appelDe(journal, 'emplacements').reponse, {
      ok: true,
      valeur: {
        executable: PUBLIE,
        donneesApplicatives: [chemins.appData, LOCAL, chemins.temp],
        insensibleCasse: process.platform === 'win32' || process.platform === 'darwin',
        separateur: sep,
      },
    });
    assert.deepEqual(appelDe(journal, 'racines').reponse, {
      ok: true,
      valeur: {
        portable: { id: 'portable', chemin: join(PUBLIE, 'data') },
        documents: { id: 'documents', chemin: join(chemins.documents, NOM_PRODUIT) },
      },
    });
  });

  test('sans dossier publié, ou publié vide, ni exécutable ni racine portable', () => {
    for (const scenario of ['absent', 'vide']) {
      const journal = journalDeLaCoquille(scenario);
      const { chemins } = journal;
      assert.deepEqual(
        appelDe(journal, 'emplacements').reponse.valeur,
        {
          executable: null,
          donneesApplicatives: [chemins.appData, chemins.temp],
          insensibleCasse: process.platform === 'win32' || process.platform === 'darwin',
          separateur: sep,
        },
        scenario,
      );
      assert.deepEqual(
        appelDe(journal, 'racines').reponse.valeur,
        { portable: null, documents: { id: 'documents', chemin: join(chemins.documents, NOM_PRODUIT) } },
        scenario,
      );
    }
  });

  test("les dialogues s'ouvrent sur la fenêtre de la page, et une annulation rend null", () => {
    const journal = journalDeLaCoquille();
    assert.deepEqual(journal.dialogues, [
      { methode: 'showOpenDialog', parent: true, options: { properties: ['openDirectory', 'createDirectory'] } },
      { methode: 'showOpenDialog', parent: true, options: { properties: ['openFile'] } },
      { methode: 'showSaveDialog', parent: true, options: { defaultPath: join(journal.chemins.documents, 'liste.csv') } },
    ]);
    for (const membre of ['choisirDossier', 'choisirFichierAImporter', 'enregistrerSous']) {
      assert.deepEqual(appelDe(journal, membre).reponse, { ok: true, valeur: null }, membre);
    }
  });

  test("l'explorateur s'ouvre sur la racine que la page désigne", () => {
    const journal = journalDeLaCoquille();
    assert.deepEqual(journal.explorateur, [join(journal.chemins.documents, NOM_PRODUIT)]);
    // La réponse porte valeur: undefined, que le journal en JSON ne garde pas.
    assert.deepEqual(appelDe(journal, 'ouvrirDansExplorateur').reponse, { ok: true });
  });
});
