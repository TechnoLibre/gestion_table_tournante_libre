// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Processus principal de la coquille Electron (§ 13.1) : une fenêtre qui
// charge la page construite par Vite dans www/, et le système de fichiers de
// la plateforme (electron/fichiers.js), offert à la page par un canal IPC
// par primitive, que electron/preload.cjs expose sous window.gtt.fichiers ;
// un canal de plus, gtt:copier, remet un texte au presse-papiers du système
// (window.gtt.copier) ; un dernier, gtt:imprimer, imprime la page sur le
// papier et dans l'orientation qu'elle demande (electron/impression.js,
// window.gtt.imprimer).
//
// La page n'a ni Node ni accès au disque : isolation de contexte active,
// intégration de Node coupée, rendu en bac à sable. Elle n'atteint le
// processus principal que par ces canaux, et n'y désigne un fichier que par
// une racine que ce processus connaît et un chemin relatif à elle. Un nom
// importé interprété comme du balisage reste ainsi une faute d'affichage, et
// non un accès au disque.
import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, shell } from 'electron';
import { mkdtempSync, rmSync } from 'node:fs';
import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { creerFichiers, decrireSysteme, processusVivant, servir } from './fichiers.js';
import { servirImpression } from './impression.js';

// Chemins relatifs à ce module : ils valent dans le dépôt comme dans
// l'archive app.asar de l'exécutable, qui reproduit electron/ et www/.
const PRECHARGEMENT = fileURLToPath(new URL('./preload.cjs', import.meta.url));
const PAGE = fileURLToPath(new URL('../www/index.html', import.meta.url));

// Profil de Chromium (§ 8.6) : un dossier neuf sous le dossier temporaire du
// système, nommé gtt-profil-<pid>-…, posé avant que l'application soit
// prête — Chromium l'ouvre alors —, et retiré à la sortie. L'application ne
// garde rien dans ce profil, et un exécutable portable ne laisse ainsi rien
// dans AppData, ni dans le dossier de travail.
//
// Le retrait de la sortie n'est qu'un premier temps : Chromium écrit encore
// dans le profil après l'évènement quit — son état local, ses préférences,
// le stockage de session —, et le dossier renaît, réduit à quelques fichiers.
// Une séance qui s'arrête sans sortir n'en retire rien. Chaque démarrage
// retire donc, après l'ouverture de la fenêtre, les profils des séances
// terminées : le pid de leur nom ne désigne plus aucun processus de ce
// poste. Le profil d'une séance qui tourne encore reste.
const TEMPORAIRE = app.getPath('temp');
const PROFIL_DE_SEANCE = /^gtt-profil-(\d+)-/;
const PROFIL = mkdtempSync(join(TEMPORAIRE, `gtt-profil-${process.pid}-`));
app.setPath('userData', PROFIL);
app.on('quit', () => {
  try {
    rmSync(PROFIL, { recursive: true, force: true });
  } catch {
    // Au mieux : le démarrage suivant le retire.
  }
});

async function retirerProfilsTermines() {
  for (const nom of await readdir(TEMPORAIRE)) {
    const pid = Number(PROFIL_DE_SEANCE.exec(nom)?.[1]);
    if (!(pid > 0) || pid === process.pid || processusVivant(pid)) continue;
    await rm(join(TEMPORAIRE, nom), { recursive: true, force: true }).catch(() => {});
  }
}

// Le système de fichiers : emplacements et racines lus une fois, au
// démarrage (§ 8.6) ; les dialogues s'ouvrent sur la fenêtre de la page. Les
// gestionnaires sont posés avant le chargement de la page, qui peut les
// appeler dès son premier script.
let fenetre = null;
const fichiers = creerFichiers({
  ...decrireSysteme({
    env: process.env,
    plateforme: process.platform,
    cheminSysteme: (nom) => app.getPath(nom),
    nomProduit: app.getName(),
  }),
  dialog,
  shell,
  fenetre: () => fenetre,
});
servir(fichiers, (canal, gestionnaire) => ipcMain.handle(canal, gestionnaire));

// Le presse-papiers : le texte reçu, une chaîne, remplace son contenu.
ipcMain.handle('gtt:copier', (_evenement, texte) => {
  if (typeof texte !== 'string') throw new TypeError("le texte à copier n'est pas une chaîne");
  clipboard.writeText(texte);
});

// L'impression : la page qui la demande s'imprime, par la boîte de dialogue
// du système, sur le papier et dans l'orientation reçus, et rien d'autre.
servirImpression((canal, gestionnaire) => ipcMain.handle(canal, gestionnaire));

// Les verrous que la page a pris et pas rendus s'effacent à la sortie (§ 8.8) :
// la page ne survit pas au processus principal, et une fermeture de la fenêtre
// ne lui laisse pas le temps de les rendre elle-même. rendreVerrousTenus les
// relit et les efface de façon synchrone, comme le retrait du profil, chacun
// seulement s'il porte encore la séance qui l'a pris.
app.on('quit', () => fichiers.rendreVerrousTenus());

function creerFenetre() {
  fenetre = new BrowserWindow({
    width: 1366,
    height: 768,
    webPreferences: {
      preload: PRECHARGEMENT,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // La page ne quitte jamais www/ : toute nouvelle fenêtre est refusée, toute
  // navigation annulée, quelle que soit sa cible.
  fenetre.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  fenetre.webContents.on('will-navigate', (evenement) => evenement.preventDefault());
  fenetre.loadFile(PAGE);
}

// Sans menu posé par l'application, Electron installe le sien : en anglais,
// alors que l'interface est en français (§ 2), et porteur de « Reload » et
// des outils de développement. null le retire, et retire avec lui la barre
// de menu des fenêtres sous Windows et Linux ; il est posé avant la première
// fenêtre, qui naîtrait sinon avec la barre.
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  creerFenetre();
  retirerProfilsTermines().catch(() => {});
});
