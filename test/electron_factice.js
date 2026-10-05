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
// exports, appelle le pont exposé et les gestionnaires posés par le processus
// principal, puis imprime le journal en JSON sur la sortie standard.
//
// Seul require est restreint, à electron, comme dans un rendu en bac à
// sable. Les globales de Node du processus d'épreuve, dont process et Buffer,
// restent visibles du préchargement, et un vrai préchargement en bac à sable
// lit lui aussi process.env. Un pont qui lirait lui-même la variable
// répondrait donc juste : le journal des invocations, et non l'absence de
// process, montre que chaque réponse vient du processus principal.
//
// Les exports sont la surface d'Electron que la coquille a le droit
// d'employer : un import absent d'ici fait échouer le chargement de
// electron/main.js. Ils refusent ce qu'Electron refuse et qu'une erreur de
// la coquille provoquerait : une fenêtre créée avant que l'application soit
// prête, un second gestionnaire pour un même canal, un appel à un canal sans
// gestionnaire.
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { compileFunction } from 'node:vm';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'electron') return { url: import.meta.url, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const PRECHARGEMENT = fileURLToPath(new URL('../electron/preload.cjs', import.meta.url));

// Valeur de PORTABLE_EXECUTABLE_DIR quand le lanceur portable la publie.
const DOSSIER_PUBLIE = 'E:\\soirees';

const journal = {
  // Appels qui comptent pour l'ordre, dans l'ordre où ils arrivent.
  sequence: [],
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
  // Réponse du gestionnaire d'ouverture de chaque fenêtre à une adresse
  // externe.
  ouvertures: [],
  // Pour chaque écouteur de will-navigate : la navigation est-elle annulée ?
  navigations: [],
  // Ce que fait le préchargement : modules requis, objets exposés, et la
  // réponse du pont selon PORTABLE_EXECUTABLE_DIR.
  prechargement: null,
};

const gestionnaires = new Map();
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
  on(evenement) {
    journal.sequence.push(`app.on:${evenement}`);
  },
  quit() {
    journal.sequence.push('app.quit');
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

// Réponse du pont pour une valeur de PORTABLE_EXECUTABLE_DIR, undefined
// valant variable absente ; une erreur se consigne par son message.
async function reponseDuPont(api, valeur) {
  if (valeur === undefined) delete process.env.PORTABLE_EXECUTABLE_DIR;
  else process.env.PORTABLE_EXECUTABLE_DIR = valeur;
  try {
    return { valeur: await api.dossierExecutable() };
  } catch (erreur) {
    return { erreur: erreur.message };
  }
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
  return {
    requis,
    exposes: exposes.map(({ cle, api }) => ({ cle, membres: Object.keys(api).sort() })),
    plateforme: gtt?.plateforme ?? null,
    reponses:
      typeof gtt?.dossierExecutable === 'function'
        ? {
            publie: await reponseDuPont(gtt, DOSSIER_PUBLIE),
            absent: await reponseDuPont(gtt, undefined),
            vide: await reponseDuPont(gtt, ''),
          }
        : null,
  };
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
  process.stdout.write(`${JSON.stringify(journal)}\n`);
}

process.once('beforeExit', () => {
  jouerLaPage().catch((erreur) => {
    process.stderr.write(`${erreur.stack}\n`);
    process.exitCode = 1;
  });
});
