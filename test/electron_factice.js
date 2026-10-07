// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Electron factice : la coquille s'éprouve sous Node, sans Electron.
//
//   node --import <ce module> electron/main.js
//
// Chargé avant electron/main.js, ce module fait résoudre le spécificateur
// « electron » vers lui-même : le processus principal s'exécute contre les
// fausses API exportées ici, qui consignent chaque appel. Quand le processus
// n'a plus rien à faire, le module joue le rôle de la page : il exécute
// electron/preload.cjs dans une fonction qui reçoit require, module et
// exports, et appelle chaque fonction du pont exposé, qui atteint les
// gestionnaires posés par le processus principal ; puis gtt.copier, avec un
// texte d'épreuve, et gtt.fichiers.verrouiller sur la racine documents, deux
// verrous réels que la page ne rend pas ; le contenu du second est récrit au
// nom d'une autre séance, comme après une reprise. Il joue ensuite la sortie
// de l'application — before-quit, will-quit, quit —, relève la présence de
// ces deux verrous et de celui d'une autre séance, autre.gtt.verrou, avant et
// après la sortie, puis imprime le journal en JSON sur la sortie standard.
//
// Seul require est restreint, à electron, comme dans un rendu en bac à
// sable. Les globales de Node du processus d'épreuve, dont process et Buffer,
// restent visibles du préchargement, et un vrai préchargement en bac à sable
// lit lui aussi process.env. Le journal des invocations, et non l'absence de
// process, montre que chaque réponse vient du processus principal.
//
// Les exports sont la surface d'Electron que la coquille a le droit
// d'employer : un import absent d'ici fait échouer le chargement de
// electron/main.js. Ils refusent ce qu'Electron refuse et qu'une erreur de
// la coquille provoquerait : une fenêtre créée avant que l'application soit
// prête, un second gestionnaire pour un même canal, un appel à un canal sans
// gestionnaire, un nom de chemin qu'app.getPath ne connaît pas.
//
// app.getPath rend le dossier temporaire du processus — que l'épreuve
// désigne par TMPDIR, et par TEMP et TMP sous Windows —, et des Documents et
// un AppData qui y vivent ; app.getName, le nom de produit de package.json,
// comme Electron. Les dialogues rendent une annulation ; l'explorateur
// consigne le dossier qu'on lui demande d'ouvrir, et réussit ; le
// presse-papiers consigne chaque texte qu'il reçoit.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileFunction } from 'node:vm';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'electron') return { url: import.meta.url, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const PRECHARGEMENT = fileURLToPath(new URL('../electron/preload.cjs', import.meta.url));

// Ce que la page copie, et les verrous qu'elle prend dans la racine
// documents, à côté de celui d'une autre séance que l'épreuve y pose avant le
// lancement. Le second verrou de la page est repris : son contenu porte
// ensuite SEANCE_REPRISE.
const TEXTE_COPIE = 'Bloc copié par la page factice';
const VERROU_PAGE = 'soiree.gtt.verrou';
const VERROU_REPRIS = 'reprise.gtt.verrou';
const SEANCE_PAGE = 'seance-page';
const SEANCE_REPRISE = 'seance-reprise';
const VERROU_AUTRE = 'autre.gtt.verrou';
const NOM_PRODUIT = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).productName;

// Ce que rend app.getPath, par nom.
const TEMPORAIRE = tmpdir();
const CHEMINS = Object.freeze({
  temp: TEMPORAIRE,
  documents: join(TEMPORAIRE, 'Documents'),
  appData: join(TEMPORAIRE, 'AppData'),
});

// Arguments que la page passe à chaque fonction du pont, selon la réponse de
// racines() quand elle a précédé : une racine que le processus principal ne
// connaît pas, pour que la réponse vienne du confinement sans toucher au
// disque ; la racine documents pour l'explorateur ; un nom et des octets
// pour l'enregistrement. Une fonction absente d'ici s'appelle sans argument.
const INCONNUE = { id: 'racine-inconnue', chemin: TEMPORAIRE };
const ARGUMENTS_DE_LA_PAGE = {
  sonder: () => [INCONNUE],
  typeSupport: () => [INCONNUE],
  lireTexte: () => [INCONNUE, 'soiree.gtt.json'],
  ecrireAtomique: () => [INCONNUE, 'soiree.gtt.json', '{}\n'],
  ajouterLigne: () => [INCONNUE, 'soiree.gtt-journal.jsonl', '{}'],
  lister: () => [INCONNUE, ''],
  creerDossier: () => [INCONNUE, 'corbeille'],
  deplacer: () => [INCONNUE, 'soiree.gtt.json', 'corbeille/soiree.gtt.json'],
  supprimer: () => [INCONNUE, 'soiree.gtt.json'],
  verrouiller: () => [INCONNUE, 'soiree.gtt.verrou', 'seance-factice'],
  deverrouiller: () => [INCONNUE, 'soiree.gtt.verrou', 'seance-factice'],
  ouvrirDansExplorateur: (racines) => [racines?.documents],
  enregistrerSous: () => ['liste.csv', new Uint8Array([0x6e, 0x6f, 0x6d])],
};

const journal = {
  // Appels qui comptent pour l'ordre, dans l'ordre où ils arrivent.
  sequence: [],
  // Ce que rend app.getPath, par nom.
  chemins: CHEMINS,
  // Chaque app.setPath : { nom, chemin }.
  setPath: [],
  // Options de chaque new BrowserWindow.
  fenetres: [],
  // Argument de chaque Menu.setApplicationMenu.
  menus: [],
  // { loadFile: chemin } ou { loadURL: adresse }, par appel.
  chargements: [],
  // Canal de chaque ipcMain.handle ou ipcMain.on.
  canaux: [],
  // Canal de chaque ipcRenderer.invoke du préchargement, dans l'ordre des
  // appels.
  invocations: [],
  // Chaque dialogue : sa méthode, sa fenêtre parente est-elle une
  // BrowserWindow, ses options.
  dialogues: [],
  // Dossier de chaque shell.openPath.
  explorateur: [],
  // Texte de chaque clipboard.writeText.
  pressePapiers: [],
  // Réponse du gestionnaire d'ouverture de chaque fenêtre à une adresse
  // externe.
  ouvertures: [],
  // Pour chaque écouteur de will-navigate : la navigation est-elle annulée ?
  navigations: [],
  // Ce que fait le préchargement : modules requis, objets exposés, membres
  // de gtt.fichiers, et pour chacun les canaux qu'il invoque et sa réponse ;
  // puis l'appel de gtt.copier et ceux des deux verrous de la page, de même.
  prechargement: null,
  // Présence du verrou de la page, de celui qu'une autre séance a repris et
  // de celui de l'autre séance, avant puis après la sortie de l'application ;
  // null quand la page n'a pas de racine documents.
  verrous: null,
  // Le dossier userData existe-t-il avant la sortie de l'application, puis
  // après ; null sans app.setPath('userData').
  profil: null,
};

const gestionnaires = new Map();
const ecouteurs = new Map();
const pageDeFenetre = [];

// L'application n'est jamais prête pendant l'évaluation du module principal,
// ni dans les microtâches qu'elle lance : whenReady() la rend prête à la
// phase setImmediate qui suit, puis résout, la même promesse à chaque appel.
// Sans appel à whenReady(), elle ne l'est jamais.
let pret = false;
let quandPret;

export const app = {
  whenReady() {
    journal.sequence.push('app.whenReady');
    quandPret ??= new Promise((resoudre) => {
      setImmediate(() => {
        pret = true;
        resoudre();
      });
    });
    return quandPret;
  },
  on(evenement, ecouteur) {
    journal.sequence.push(`app.on:${evenement}`);
    if (!ecouteurs.has(evenement)) ecouteurs.set(evenement, []);
    ecouteurs.get(evenement).push(ecouteur);
  },
  quit() {
    journal.sequence.push('app.quit');
  },
  getName() {
    return NOM_PRODUIT;
  },
  getPath(nom) {
    if (!Object.hasOwn(CHEMINS, nom)) throw new Error(`Failed to get '${nom}' path`);
    return CHEMINS[nom];
  },
  setPath(nom, chemin) {
    journal.sequence.push(`app.setPath:${nom}`);
    journal.setPath.push({ nom, chemin });
  },
};

export class BrowserWindow {
  constructor(options) {
    if (!pret) throw new Error('Cannot create BrowserWindow before app is ready');
    journal.sequence.push('new BrowserWindow');
    journal.fenetres.push(options);
    const page = { ouverture: null, ecouteurs: [] };
    pageDeFenetre.push(page);
    this.webContents = {
      setWindowOpenHandler(gestionnaire) {
        page.ouverture = gestionnaire;
      },
      on(evenement, ecouteur) {
        page.ecouteurs.push({ evenement, ecouteur });
      },
    };
  }

  loadFile(chemin) {
    journal.sequence.push('loadFile');
    journal.chargements.push({ loadFile: chemin });
    return Promise.resolve();
  }

  loadURL(adresse) {
    journal.sequence.push('loadURL');
    journal.chargements.push({ loadURL: adresse });
    return Promise.resolve();
  }
}

export const Menu = {
  setApplicationMenu(menu) {
    journal.sequence.push('Menu.setApplicationMenu');
    journal.menus.push(menu);
  },
};

export const ipcMain = {
  handle(canal, gestionnaire) {
    journal.sequence.push(`ipcMain.handle:${canal}`);
    journal.canaux.push(canal);
    if (gestionnaires.has(canal)) {
      throw new Error(`Attempted to register a second handler for '${canal}'`);
    }
    gestionnaires.set(canal, gestionnaire);
  },
  on(canal) {
    journal.sequence.push(`ipcMain.on:${canal}`);
    journal.canaux.push(canal);
  },
};

export const dialog = {
  async showOpenDialog(parent, options) {
    journal.dialogues.push({ methode: 'showOpenDialog', parent: parent instanceof BrowserWindow, options });
    return { canceled: true, filePaths: [] };
  },
  async showSaveDialog(parent, options) {
    journal.dialogues.push({ methode: 'showSaveDialog', parent: parent instanceof BrowserWindow, options });
    return { canceled: true, filePath: '' };
  },
};

export const shell = {
  async openPath(chemin) {
    journal.explorateur.push(chemin);
    return '';
  },
};

export const clipboard = {
  writeText(texte) {
    journal.pressePapiers.push(texte);
  },
};

// Côté page : ce que require('electron') rend au préchargement. invoke se
// consigne, atteint le gestionnaire posé par le processus principal pour ce
// canal, et rejette comme Electron quand il n'y en a pas.
function electronDuRendu(exposes) {
  return {
    contextBridge: {
      exposeInMainWorld(cle, api) {
        exposes.push({ cle, api });
      },
    },
    ipcRenderer: {
      async invoke(canal, ...arguments_) {
        journal.invocations.push(canal);
        const gestionnaire = gestionnaires.get(canal);
        if (gestionnaire === undefined) throw new Error(`No handler registered for '${canal}'`);
        return gestionnaire({ sender: null }, ...arguments_);
      },
    },
  };
}

// Appelle chaque fonction de gtt.fichiers, dans l'ordre de ses membres, et
// consigne pour chacune son type, les canaux qu'elle invoque et sa réponse,
// une erreur par son message.
async function appelerLePont(fichiers) {
  const appels = [];
  let racines = null;
  for (const membre of Object.keys(fichiers)) {
    const avant = journal.invocations.length;
    const appel = { membre, type: typeof fichiers[membre] };
    try {
      appel.reponse = await fichiers[membre](...(ARGUMENTS_DE_LA_PAGE[membre]?.(racines) ?? []));
      if (membre === 'racines') racines = appel.reponse?.valeur;
    } catch (erreur) {
      appel.erreur = erreur.message;
    }
    appel.canaux = journal.invocations.slice(avant);
    appels.push(appel);
  }
  return { appels, racines };
}

// Un appel de la page hors de la tournée du pont : sa réponse, ou le message
// de son erreur, et les canaux qu'il invoque.
async function appelerUne(fonction, parametres) {
  const avant = journal.invocations.length;
  const appel = {};
  try {
    appel.reponse = await fonction(...parametres);
  } catch (erreur) {
    appel.erreur = erreur.message;
  }
  appel.canaux = journal.invocations.slice(avant);
  return appel;
}

async function jouerLePrechargement() {
  const requis = [];
  const exposes = [];
  const electron = electronDuRendu(exposes);
  const requerir = (nom) => {
    requis.push(nom);
    if (nom === 'electron') return electron;
    throw new Error(`module « ${nom} » indisponible dans un préchargement en bac à sable`);
  };
  const module = { exports: {} };
  compileFunction(readFileSync(PRECHARGEMENT, 'utf8'), ['require', 'module', 'exports'], {
    filename: PRECHARGEMENT,
  })(requerir, module, module.exports);

  const gtt = exposes.find(({ cle }) => cle === 'gtt')?.api;
  const fichiers = gtt?.fichiers;
  const { appels, racines } = fichiers === undefined ? { appels: [], racines: null } : await appelerLePont(fichiers);
  const copie = {
    type: typeof gtt?.copier,
    texte: TEXTE_COPIE,
    ...(typeof gtt?.copier === 'function' ? await appelerUne(gtt.copier, [TEXTE_COPIE]) : {}),
  };
  const documents = racines?.documents ?? null;
  const verrou = documents === null || fichiers === undefined
    ? null
    : await appelerUne(fichiers.verrouiller, [documents, VERROU_PAGE, SEANCE_PAGE]);
  const repris = documents === null || fichiers === undefined
    ? null
    : await appelerUne(fichiers.verrouiller, [documents, VERROU_REPRIS, SEANCE_PAGE]);
  if (repris?.reponse?.ok === true) {
    const chemin = join(documents.chemin, VERROU_REPRIS);
    const contenu = JSON.parse(readFileSync(chemin, 'utf8'));
    writeFileSync(chemin, `${JSON.stringify({ ...contenu, seance: SEANCE_REPRISE })}\n`);
  }
  return {
    requis,
    exposes: exposes.map(({ cle, api }) => ({ cle, membres: Object.keys(api).sort() })),
    fichiers: fichiers === undefined ? null : Object.keys(fichiers),
    appels,
    copie,
    verrou,
    repris,
    documents: documents?.chemin ?? null,
  };
}

// Joue la sortie de l'application : chaque écouteur de ces évènements, dans
// l'ordre où Electron les émet.
function sortir() {
  for (const evenement of ['before-quit', 'will-quit', 'quit']) {
    for (const ecouteur of ecouteurs.get(evenement) ?? []) ecouteur({ preventDefault() {} }, 0);
  }
}

async function jouerLaPage() {
  const externe = 'https://exemple.invalid/';
  for (const page of pageDeFenetre) {
    journal.ouvertures.push(page.ouverture === null ? null : page.ouverture({ url: externe }));
    for (const { evenement, ecouteur } of page.ecouteurs) {
      if (evenement !== 'will-navigate') continue;
      let annulee = false;
      ecouteur({ url: externe, preventDefault: () => (annulee = true) }, externe);
      journal.navigations.push(annulee);
    }
  }
  try {
    journal.prechargement = await jouerLePrechargement();
  } catch (erreur) {
    journal.prechargement = { erreur: erreur.message };
  }
  const profil = journal.setPath.find(({ nom }) => nom === 'userData')?.chemin;
  const avant = profil !== undefined && existsSync(profil);
  const dossier = journal.prechargement?.documents ?? null;
  const verrous = dossier === null ? null : [VERROU_PAGE, VERROU_REPRIS, VERROU_AUTRE].map((nom) => join(dossier, nom));
  const presents = () => verrous.map((chemin) => existsSync(chemin));
  const verrousAvant = verrous === null ? null : presents();
  sortir();
  journal.profil = profil === undefined ? null : { avant, apres: existsSync(profil) };
  if (verrous !== null) {
    const verrousApres = presents();
    journal.verrous = {
      page: { avant: verrousAvant[0], apres: verrousApres[0] },
      repris: { avant: verrousAvant[1], apres: verrousApres[1] },
      autre: { avant: verrousAvant[2], apres: verrousApres[2] },
    };
  }
  process.stdout.write(`${JSON.stringify(journal)}\n`);
}

process.once('beforeExit', () => {
  jouerLaPage().catch((erreur) => {
    process.stderr.write(`${erreur.stack}\n`);
    process.exitCode = 1;
  });
});
