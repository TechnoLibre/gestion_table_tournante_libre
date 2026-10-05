// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Préchargement de la coquille (§ 13.1) : le seul pont entre la page et le
// processus principal. Il expose window.gtt et rien d'autre ; la page n'en
// reçoit que des fonctions qui appellent un canal nommé, jamais ipcRenderer
// lui-même.
//
// Un préchargement exécuté en bac à sable est un script CommonJS, d'où
// l'extension .cjs dans un paquet de type module. Son require ne connaît
// qu'electron et quelques modules de Node.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gtt', {
  plateforme: 'electron',
  // Dossier publié par le lanceur portable (§ 8.6, point 1), ou null hors de
  // lui ; voir electron/main.js.
  dossierExecutable: () => ipcRenderer.invoke('gtt:dossier-executable'),
});
