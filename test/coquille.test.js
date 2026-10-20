// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La coquille Electron (§ 13.1) : la fenêtre qu'ouvre le processus principal,
// la page qu'elle charge, le profil de Chromium hors d'AppData (§ 8.6), le
// pont étroit et nommé que le préchargement expose — une fonction par
// primitive du système de fichiers, un canal par fonction, la copie dans
// le presse-papiers et l'impression —, ce que le processus principal y
// répond : emplacements, racines, dialogues, explorateur, presse-papiers,
// impression (§ 11.7, § 13.4) ; et les verrous que la page a pris, effacés
// à la sortie (§ 8.8). La page elle-même, index.html, charge le collecteur
// d'erreurs avant son module d'entrée (§ 19.2).
//
// electron/main.js s'exécute sous Node, dans un processus à part, contre
// test/electron_factice.js, qui consigne ce que la coquille demande à
// Electron puis rend son journal en JSON. Ce qui s'éprouve ici est ce que la
// coquille demande ; qu'Electron l'applique relève d'une épreuve dans un vrai
// Electron (make essai_demarrage). Les primitives elles-mêmes s'éprouvent
// dans test/fichiers_electron.test.js ; le gestionnaire d'impression
// (electron/impression.js) s'éprouve ici, sur un contenu de fenêtre factice.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PRIMITIVES } from '../electron/fichiers.js';
import { CANAL_IMPRESSION, FORMATS_DE_PAGE, imprimer, optionsImpression, servirImpression } from '../electron/impression.js';
import { PAPIERS } from '../src/geometrie/papiers.js';
import { LIENS } from '../src/interface/apropos.js';
import { describe, test } from './lanceur.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const FACTICE = pathToFileURL(join(RACINE, 'test', 'electron_factice.js')).href;
const PRINCIPAL = join(RACINE, 'electron', 'main.js');
const PRECHARGEMENT = join(RACINE, 'electron', 'preload.cjs');
const NOM_PRODUIT = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8')).productName;
const CANAUX = PRIMITIVES.map((primitive) => `gtt:fichiers:${primitive}`);
const CANAL_COPIE = 'gtt:copier';
const CANAL_IMPRIMER = 'gtt:imprimer';

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

// Les adresses que la page demande d'ouvrir dans une nouvelle fenêtre, puis
// de naviguer : les liens du panneau « À propos », puis des voisines que la
// coquille n'ouvre pas — un autre schéma, sans la barre finale, un autre
// chemin, un hôte qui prolonge le sien, une autre page du même site, un
// fichier local, une adresse inventée.
const LIENS_DE_LA_PAGE = Object.values(LIENS);
const ADRESSES_VOISINES = [
  'http://technolibre.ca/',
  'https://technolibre.ca',
  'https://technolibre.ca/autre',
  'https://technolibre.ca.exemple.invalid/',
  'https://www.gnu.org/licenses/agpl-3.0.html',
  'file:///page.html',
  'https://exemple.invalid/',
];
const ADRESSES_DE_LA_PAGE = [...LIENS_DE_LA_PAGE, ...ADRESSES_VOISINES];

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

// Le verrou qu'une autre séance tient dans les Documents du produit, posé
// avant le lancement : la sortie de la coquille ne le touche pas.
const VERROU_AUTRE = 'autre.gtt.verrou';
const CONTENU_AUTRE = {
  seance: 'seance-voisine',
  pid: PID_TERMINE,
  hote: 'poste-voisin',
  depuis: '2026-10-06T19:00:00-04:00',
  demarrage: null,
};

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
  writeFileSync(join(temporaire, 'Documents', NOM_PRODUIT, VERROU_AUTRE), `${JSON.stringify(CONTENU_AUTRE)}\n`);
  for (const nom of [PROFIL_TERMINE, PROFIL_VIVANT, AUTRE]) {
    mkdirSync(join(temporaire, nom, 'Session Storage'), { recursive: true });
    writeFileSync(join(temporaire, nom, 'Local State'), '{}');
  }
  try {
    const resultat = spawnSync(process.execPath, ['--import', FACTICE, PRINCIPAL], {
      cwd: ailleurs,
      encoding: 'utf8',
      env: {
        ...environnement,
        TMPDIR: temporaire,
        TEMP: temporaire,
        TMP: temporaire,
        GTT_ADRESSES_DE_LA_PAGE: JSON.stringify(ADRESSES_DE_LA_PAGE),
        ...SCENARIOS[scenario],
      },
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

  test("un canal gtt:fichiers:<primitive> par primitive, puis celui du presse-papiers, puis celui de l'impression, et aucun autre, chacun posé avant le chargement de la page", () => {
    const { canaux, sequence } = journalDeLaCoquille();
    assert.equal(CANAL_IMPRESSION, CANAL_IMPRIMER);
    assert.deepEqual(canaux, [...CANAUX, CANAL_COPIE, CANAL_IMPRIMER]);
    assert.equal(CANAUX.length, 18);
    const charge = sequence.indexOf('loadFile');
    assert.notEqual(charge, -1);
    for (const canal of [...CANAUX, CANAL_COPIE, CANAL_IMPRIMER]) {
      const pose = sequence.indexOf(`ipcMain.handle:${canal}`);
      assert.ok(pose !== -1 && pose < charge, `${canal} : ${sequence.join(', ')}`);
    }
  });

  test("la page n'ouvre aucune fenêtre et ne navigue nulle part, quelle que soit l'adresse", () => {
    const { ouvertures, navigations } = journalDeLaCoquille();
    assert.deepEqual(ouvertures, ADRESSES_DE_LA_PAGE.map(() => ({ action: 'deny' })));
    assert.ok(navigations.length >= ADRESSES_DE_LA_PAGE.length, 'aucun écouteur de will-navigate');
    assert.deepEqual(navigations, navigations.map(() => true));
  });

  test('les liens du panneau « À propos », et eux seuls, passent au navigateur du système, dans leur ordre (§ 2, § 18.6)', () => {
    assert.equal(LIENS_DE_LA_PAGE.length, 4);
    assert.deepEqual(journalDeLaCoquille().externes, LIENS_DE_LA_PAGE);
  });

  test('les adresses que la coquille ouvre sont exactement les liens du panneau « À propos »', () => {
    const texte = readFileSync(PRINCIPAL, 'utf8');
    const adresses = [...texte.matchAll(/'(https?:\/\/[^']*)'/gu)].map(([, adresse]) => adresse);
    assert.deepEqual(adresses.sort(), [...LIENS_DE_LA_PAGE].sort());
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

  test("à la sortie, le verrou que la page a pris s'efface ; celui qu'une autre séance a repris depuis, et celui d'une autre séance, restent (§ 8.8)", () => {
    for (const scenario of ['publie', 'absent']) {
      const { prechargement, verrous } = journalDeLaCoquille(scenario);
      assert.deepEqual(prechargement.verrou.reponse, { ok: true, valeur: { pris: true } }, scenario);
      // Le second verrou de la page est au relevé de la coquille, mais son
      // contenu porte désormais une autre séance : la sortie le relit et le
      // laisse.
      assert.deepEqual(prechargement.repris.reponse, { ok: true, valeur: { pris: true } }, scenario);
      assert.deepEqual(
        verrous,
        {
          page: { avant: true, apres: false },
          repris: { avant: true, apres: true },
          autre: { avant: true, apres: true },
        },
        scenario,
      );
    }
  });

  test("à la sortie, la coquille confie les verrous tenus à rendreVerrousTenus, seul lecteur de leur format : elle n'en analyse aucun", () => {
    const texte = readFileSync(PRINCIPAL, 'utf8');
    assert.match(texte, /app\.on\('quit', \(\) => fichiers\.rendreVerrousTenus\(\)\)/);
    assert.doesNotMatch(texte, /JSON\.parse|\.verrousTenus\(/);
  });

  test("au démarrage, les profils des séances terminées se retirent : ni celui d'une séance vivante, ni un dossier sans pid", () => {
    const { restes } = coquille();
    assert.deepEqual(restes, DOSSIERS_POSES.filter((nom) => nom !== PROFIL_TERMINE).sort());
  });
});

describe('coquille : préchargement', () => {
  test("n'expose que window.gtt.fichiers, une fonction par primitive, gtt.copier et gtt.imprimer, deux fonctions ; ne requiert qu'electron", () => {
    const { prechargement } = journalDeLaCoquille();
    assert.equal(prechargement.erreur, undefined, prechargement.erreur);
    assert.deepEqual(prechargement.requis, ['electron']);
    assert.deepEqual(prechargement.exposes, [{ cle: 'gtt', membres: ['copier', 'fichiers', 'imprimer'] }]);
    assert.equal(prechargement.copie.type, 'function');
    assert.equal(prechargement.impression.type, 'function');
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
    // Après le pont : la copie, les deux verrous réels que prend la page,
    // puis ses cinq demandes d'impression.
    assert.deepEqual(journal.invocations, [
      ...CANAUX,
      CANAL_COPIE,
      'gtt:fichiers:verrouiller',
      'gtt:fichiers:verrouiller',
      ...Array(5).fill(CANAL_IMPRIMER),
    ]);
    // Une racine que le processus principal ne connaît pas est refusée par
    // lui, en réponse et non en erreur.
    for (const [membre, chemin] of [
      ['sonder', ''],
      ['typeSupport', ''],
      ['lireTexte', 'soiree.gtt.json'],
      ['ecrireAtomique', 'soiree.gtt.json'],
      ['ecrireOctetsAtomique', 'soiree.badges.pdf'],
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

  test('gtt.copier invoque le canal gtt:copier, une fois, et le presse-papiers reçoit le texte tel quel', () => {
    const { prechargement, pressePapiers } = journalDeLaCoquille();
    const { copie } = prechargement;
    assert.deepEqual(copie.canaux, [CANAL_COPIE]);
    assert.equal(copie.erreur, undefined, copie.erreur);
    assert.equal(typeof copie.texte, 'string');
    assert.notEqual(copie.texte, '');
    assert.deepEqual(pressePapiers, [copie.texte]);
  });

  test("gtt.imprimer invoque le canal gtt:imprimer, une fois par appel : le processus principal imprime la fenêtre qui le demande, avec le papier et l'orientation reçus, et rend l'issue du rappel", () => {
    const { prechargement, impressions, sequence } = journalDeLaCoquille();
    const { appels } = prechargement.impression;
    assert.deepEqual(
      appels.map(({ canaux }) => canaux),
      appels.map(() => [CANAL_IMPRIMER]),
    );
    assert.deepEqual(
      appels.slice(0, 3).map(({ reponse, erreur }) => ({ reponse, erreur })),
      [
        { reponse: { issue: 'envoye', cause: null }, erreur: undefined },
        { reponse: { issue: 'annule', cause: null }, erreur: undefined },
        { reponse: { issue: 'echec', cause: 'failed' }, erreur: undefined },
      ],
    );
    assert.deepEqual(impressions, [
      { silent: false, printBackground: true, pageSize: 'A4', landscape: false },
      { silent: false, printBackground: true, pageSize: 'Letter', landscape: true },
      { silent: false, printBackground: true, pageSize: 'A4', landscape: true },
    ]);
    // Une option de print brute, un papier inconnu : refusés, sans imprimer.
    for (const { options, reponse, erreur } of appels.slice(3)) {
      assert.equal(reponse, undefined, JSON.stringify(options));
      assert.equal(typeof erreur, 'string', JSON.stringify(options));
    }
    assert.equal(sequence.filter((appel) => appel === 'webContents.print').length, 3);
  });

  test("l'explorateur s'ouvre sur la racine que la page désigne", () => {
    const journal = journalDeLaCoquille();
    assert.deepEqual(journal.explorateur, [join(journal.chemins.documents, NOM_PRODUIT)]);
    // La réponse porte valeur: undefined, que le journal en JSON ne garde pas.
    assert.deepEqual(appelDe(journal, 'ouvrirDansExplorateur').reponse, { ok: true });
  });
});

describe('coquille : la page', () => {
  test("index.html charge le collecteur d'erreurs, script classique, avant le module d'entrée (§ 19.2)", () => {
    const page = readFileSync(join(RACINE, 'index.html'), 'utf8');
    const scripts = [...page.matchAll(/<script\b([^>]*)>/g)].map(([, attributs]) => attributs.trim());
    assert.deepEqual(scripts, ['src="./collecteur.js"', 'type="module" src="/src/main.js"']);
    assert.ok(existsSync(join(RACINE, 'public', 'collecteur.js')), 'public/collecteur.js absent');
  });
});

describe('coquille : le gestionnaire d’impression (§ 11.7, § 13.4)', () => {
  // Le contenu d'une fenêtre qui consigne les options de chaque print et
  // répond à son rappel par (succes, raison), ou lève l'erreur donnée.
  function contenuFactice(succes = true, raison = '', leve = null) {
    const contenu = {
      options: [],
      print(options, rappel) {
        contenu.options.push(options);
        if (leve !== null) throw leve;
        queueMicrotask(() => rappel(succes, raison));
      },
    };
    return contenu;
  }

  test('un format de page par papier, que la coquille recopie des clés de PAPIERS : A4 reste A4, Lettre devient Letter', () => {
    assert.deepEqual(FORMATS_DE_PAGE, { A4: 'A4', Lettre: 'Letter' });
    assert.deepEqual(Object.keys(FORMATS_DE_PAGE), Object.keys(PAPIERS));
    assert.ok(Object.isFrozen(FORMATS_DE_PAGE));
  });

  test("le papier et l'orientation deviennent les seules options de print : boîte de dialogue montrée, fonds imprimés, format de page du papier, paysage pour paysage", () => {
    for (const papier of Object.keys(PAPIERS)) {
      for (const [orientation, landscape] of [['portrait', false], ['paysage', true]]) {
        assert.deepEqual(optionsImpression({ papier, orientation }), {
          silent: false,
          printBackground: true,
          pageSize: FORMATS_DE_PAGE[papier],
          landscape,
        });
      }
    }
  });

  test('toute autre option est refusée par TypeError, sans appeler print : une option de print brute, un papier ou une orientation hors domaine, une demande qui n’est pas un objet', async () => {
    const refusees = [
      { papier: 'A4', orientation: 'portrait', silent: true },
      { papier: 'A4', orientation: 'portrait', deviceName: 'imprimante-voisine' },
      { papier: 'A4', orientation: 'portrait', pageSize: 'A3' },
      { papier: 'A3', orientation: 'portrait' },
      { papier: 'Letter', orientation: 'portrait' },
      { papier: 'toString', orientation: 'portrait' },
      { papier: 'A4', orientation: 'landscape' },
      { papier: 'A4' },
      {},
      null,
      'A4',
      ['A4', 'portrait'],
      undefined,
    ];
    for (const demande of refusees) {
      const contenu = contenuFactice();
      await assert.rejects(imprimer(contenu, demande), TypeError, JSON.stringify(demande));
      assert.deepEqual(contenu.options, [], JSON.stringify(demande));
    }
  });

  test('le rappel donne l’issue : succès → envoyé ; « cancelled » → annulé ; une autre raison → échec, qu’elle nomme ; un print qui lève → échec sans cause, le message gardé pour la console', async () => {
    const cas = [
      [[true, ''], { issue: 'envoye', cause: null }],
      [[false, 'cancelled'], { issue: 'annule', cause: null }],
      [[false, 'failed'], { issue: 'echec', cause: 'failed' }],
      [[false, 'Invalid printer settings'], { issue: 'echec', cause: 'Invalid printer settings' }],
      [[false, ''], { issue: 'echec', cause: null }],
      [[false, undefined], { issue: 'echec', cause: null }],
    ];
    for (const [[succes, raison], attendu] of cas) {
      const contenu = contenuFactice(succes, raison);
      assert.deepEqual(await imprimer(contenu, { papier: 'Lettre', orientation: 'paysage' }), attendu, String(raison));
      assert.equal(contenu.options.length, 1);
    }
    const leve = contenuFactice(true, '', new Error('Object has been destroyed'));
    const console0 = console.error;
    const journal = [];
    console.error = (...valeurs) => journal.push(valeurs);
    try {
      assert.deepEqual(await imprimer(leve, { papier: 'A4', orientation: 'portrait' }), { issue: 'echec', cause: null });
    } finally {
      console.error = console0;
    }
    assert.equal(journal.length, 1);
    assert.ok(String(journal[0].at(-1)?.message ?? journal[0].at(-1)).includes('Object has been destroyed'));
  });

  test('servirImpression pose le seul canal gtt:imprimer ; son gestionnaire imprime l’expéditeur de la demande', async () => {
    const poses = [];
    servirImpression((canal, gestionnaire) => poses.push({ canal, gestionnaire }));
    assert.deepEqual(poses.map(({ canal }) => canal), [CANAL_IMPRIMER]);
    const contenu = contenuFactice(false, 'cancelled');
    const issue = await poses[0].gestionnaire({ sender: contenu }, { papier: 'A4', orientation: 'portrait' });
    assert.deepEqual(issue, { issue: 'annule', cause: null });
    assert.deepEqual(contenu.options, [{ silent: false, printBackground: true, pageSize: 'A4', landscape: false }]);
  });
});
