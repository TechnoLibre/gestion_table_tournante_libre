// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Configuration d'electron-builder : un exécutable Windows portable à fichier
// unique (§ 16), nommé d'après la version datée (§ 18.2).
//
// electron-builder ne lit ce fichier que par « --config
// electron-builder.config.cjs » : son nom n'est pas de ceux qu'il cherche
// seul, et sans lui il retombe sur ses défauts, dont un installateur. Le
// script scripts/construire_windows.sh le lui passe.
//
// Le nom du livrable sort de deriver, appliqué à version.json : la
// configuration ne le compose pas (§ 13.2). scripts/version.js est un module
// ESM, chargé ici par require : Node l'accepte depuis 20.19 et 22.12, pour un
// module sans await de premier niveau.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { deriver } = require('./scripts/version.js');

const lireJson = (nom) => JSON.parse(readFileSync(join(__dirname, nom), 'utf8'));

module.exports = {
  // Un seul identifiant pour toutes les plateformes, celui de Capacitor.
  appId: lireJson('capacitor.config.json').appId,
  productName: lireJson('package.json').productName,
  // Champ LegalCopyright de la ressource de version de l'exécutable.
  copyright: '© 2026 TechnoLibre Inc.',
  directories: { output: 'dist-electron' },
  // La page construite, la coquille, et package.json, dont electron-builder
  // tire le point d'entrée. package.json ne déclarant aucune dépendance
  // d'exécution, aucun node_modules n'entre dans le paquet.
  files: ['www/**', 'electron/**', 'package.json'],
  artifactName: deriver(lireJson('version.json').version).nomFichier,
  // Les traductions des textes propres à Chromium (locales/*.pak) gardées
  // dans le paquet : le français, et l'anglais des États-Unis, la langue de
  // repli de Chromium. L'interface ne les lit pas : elle porte ses libellés.
  electronLanguages: ['fr', 'en-US'],
  win: { target: [{ target: 'portable', arch: ['x64'] }] },
};
