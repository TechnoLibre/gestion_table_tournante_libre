// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les crochets de chargement de l'audit par mutation (§ 14.13). executer.js
// charge ce module par --import dans le processus de node --test, qui le
// transmet à chaque processus d'épreuve. Deux substitutions, par URL :
//
//   test/lanceur.js     sert « export { test, describe } from 'node:test' » :
//                       les épreuves tournent sous le repli du § 14.8, sans
//                       qu'un seul fichier d'épreuve change ;
//   le module muté      sert le source muté à la place de celui du disque,
//                       que rien n'écrit.
//
// Les données arrivent par la variable d'environnement VARIABLE, que les
// processus d'épreuve héritent : le chemin d'un fichier JSON
// {fichier, remplacement} — fichier, chemin absolu du module muté ;
// remplacement, son source muté entier —, ou la chaîne vide pour la série non
// mutée. Sans la variable, importer ce module ne pose aucun crochet.
//
// Les crochets sont synchrones et posés dans le fil du module
// (module.registerHooks) : module.register, qui les poserait dans un fil à
// part, est déprécié par Node.
import { readFileSync, realpathSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const VARIABLE = 'GTT_MUTATION';

// Les URL se comparent après résolution des liens : Node charge un module
// sous son chemin réel.
const urlReelle = (chemin) => pathToFileURL(realpathSync(chemin)).href;

const LANCEUR = urlReelle(fileURLToPath(new URL('../../test/lanceur.js', import.meta.url)));
const LANCEUR_DE_REPLI = "export { test, describe } from 'node:test';\n";

// Le module muté : { url, remplacement }, ou null pour la série non mutée.
let cible = null;

/**
 * Désigne le module muté et son source muté. Lève sur un fichier absent.
 * @param {{fichier: string, remplacement: string}} donnees  fichier : chemin absolu
 */
export function initialize({ fichier, remplacement }) {
  if (typeof fichier !== 'string' || typeof remplacement !== 'string') {
    throw new TypeError('initialize attend { fichier, remplacement }, deux chaînes');
  }
  cible = { url: urlReelle(fichier), remplacement };
}

/**
 * Crochet load de module.registerHooks : le lanceur de repli pour
 * test/lanceur.js, le source muté pour le module désigné, le chargement
 * ordinaire sinon. Le format du module muté reste celui que Node lui
 * reconnaît.
 */
export function load(url, contexte, suivant) {
  if (url === LANCEUR) return { format: 'module', source: LANCEUR_DE_REPLI, shortCircuit: true };
  if (cible !== null && url === cible.url) return { ...suivant(url, contexte), source: cible.remplacement };
  return suivant(url, contexte);
}

const donnees = process.env[VARIABLE];
if (donnees !== undefined) {
  if (donnees !== '') initialize(JSON.parse(readFileSync(donnees, 'utf8')));
  registerHooks({ load });
}
