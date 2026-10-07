// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Préchargement de la coquille (§ 13.1) : le seul pont entre la page et le
// processus principal. Il expose window.gtt et rien d'autre : sous
// gtt.fichiers, une fonction par primitive du système de fichiers, qui
// invoque le canal de cette primitive, gtt:fichiers:<primitive>, et rend la
// réponse du processus principal (electron/fichiers.js) ; gtt.copier(texte),
// qui invoque le canal gtt:copier et remet le texte au presse-papiers du
// système. La page ne reçoit jamais ipcRenderer lui-même, ni une fonction
// qui invoquerait un canal de son choix.
//
// Un préchargement exécuté en bac à sable est un script CommonJS, d'où
// l'extension .cjs dans un paquet de type module. Son require ne connaît
// qu'electron et quelques modules de Node, et non les fichiers du projet :
// les primitives s'écrivent donc ici, dans l'ordre de l'interface, et
// test/coquille.test.js éprouve qu'elles sont celles des canaux que pose le
// processus principal.
const { contextBridge, ipcRenderer } = require('electron');

const PRIMITIVES = [
  'emplacements',
  'racines',
  'choisirDossier',
  'sonder',
  'typeSupport',
  'lireTexte',
  'ecrireAtomique',
  'ajouterLigne',
  'lister',
  'creerDossier',
  'deplacer',
  'supprimer',
  'verrouiller',
  'deverrouiller',
  'ouvrirDansExplorateur',
  'choisirFichierAImporter',
  'enregistrerSous',
];

const fichiers = {};
for (const primitive of PRIMITIVES) {
  const canal = `gtt:fichiers:${primitive}`;
  fichiers[primitive] = (...parametres) => ipcRenderer.invoke(canal, ...parametres);
}

const copier = (texte) => ipcRenderer.invoke('gtt:copier', texte);

contextBridge.exposeInMainWorld('gtt', { fichiers, copier });
