// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Préchargement de la coquille (§ 13.1) : le seul pont entre la page et le
// processus principal. Il expose window.gtt et rien d'autre : sous
// gtt.fichiers, une fonction par primitive du système de fichiers, qui
// invoque le canal de cette primitive, gtt:fichiers:<primitive>, et rend la
// réponse du processus principal (electron/fichiers.js) ; gtt.copier(texte),
// qui invoque le canal gtt:copier et remet le texte au presse-papiers du
// système ; gtt.imprimer({papier, orientation}), qui invoque le canal
// gtt:imprimer et rend l'issue de l'impression (electron/impression.js). La
// page ne reçoit jamais ipcRenderer lui-même, ni une fonction qui
// invoquerait un canal de son choix.
//
// Dans l'autre sens, un seul canal : gtt:lien, par lequel le processus
// principal envoie l'issue d'un lien d'« À propos » qu'il a passé au
// navigateur du système, { adresse, raison } — raison vide quand
// l'ouverture est lancée, sinon celle de son échec. Le préchargement la
// porte à la page par window.postMessage, sous { type: 'gtt:lien', adresse,
// raison }, que le panneau « À propos » écoute : un message traverse
// l'isolation de contexte, là où la page n'a aucune fonction à offrir au
// préchargement. Une issue d'une autre forme ne passe pas, ni un autre
// champ.
//
// Un préchargement exécuté en bac à sable est un script CommonJS, d'où
// l'extension .cjs dans un paquet de type module. Son require ne connaît
// qu'electron et quelques modules de Node, et non les fichiers du projet :
// les primitives et les noms des canaux s'écrivent donc ici, les primitives
// dans l'ordre de l'interface, et test/coquille.test.js éprouve qu'ils sont
// ceux des canaux que pose le processus principal ; le canal des liens est
// CANAL_LIEN d'electron/fichiers.js, que test/fichiers_electron.long.test.js
// compare à celui-ci.
const { contextBridge, ipcRenderer } = require('electron');

const PRIMITIVES = [
  'emplacements',
  'racines',
  'choisirDossier',
  'sonder',
  'typeSupport',
  'lireTexte',
  'lireOctets',
  'ecrireAtomique',
  'ecrireOctetsAtomique',
  'ajouterLigne',
  'lister',
  'creerDossier',
  'supprimerDossier',
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

const imprimer = (demande) => ipcRenderer.invoke('gtt:imprimer', demande);

contextBridge.exposeInMainWorld('gtt', { fichiers, copier, imprimer });

const CANAL_LIEN = 'gtt:lien';

ipcRenderer.on(CANAL_LIEN, (_evenement, issue) => {
  const { adresse, raison } = issue ?? {};
  if (typeof adresse !== 'string' || typeof raison !== 'string') return;
  window.postMessage({ type: CANAL_LIEN, adresse, raison }, '*');
});
