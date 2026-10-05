// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Processus principal de la coquille Electron (§ 13.1) : une fenêtre qui
// charge la page construite par Vite dans www/, et un seul canal IPC, que
// electron/preload.cjs expose à la page sous window.gtt.
//
// La page n'a ni Node ni accès au disque : isolation de contexte active,
// intégration de Node coupée, rendu en bac à sable. Elle n'atteint le
// processus principal que par les canaux que ce module traite. Un nom importé
// interprété comme du balisage reste ainsi une faute d'affichage, et non un
// accès au disque.
import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';

// Chemins relatifs à ce module : ils valent dans le dépôt comme dans
// l'archive app.asar de l'exécutable, qui reproduit electron/ et www/.
const PRECHARGEMENT = fileURLToPath(new URL('./preload.cjs', import.meta.url));
const PAGE = fileURLToPath(new URL('../www/index.html', import.meta.url));

// Dossier de l'exécutable livré (§ 8.6, point 1). L'exécutable portable est
// une archive auto-extractible : l'application tourne depuis un dossier
// temporaire effacé à la sortie, et le lanceur publie son propre dossier dans
// PORTABLE_EXECUTABLE_DIR avant de la lancer. Hors de ce lanceur, la variable
// est absente ; vide, elle ne désigne aucun dossier. Dans les deux cas, le
// canal rend null. Le gestionnaire est posé avant le chargement de la page,
// qui peut l'appeler dès son premier script.
ipcMain.handle('gtt:dossier-executable', () => process.env.PORTABLE_EXECUTABLE_DIR || null);

function creerFenetre() {
  const fenetre = new BrowserWindow({
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

app.whenReady().then(creerFenetre);
