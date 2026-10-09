// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'exécution d'un mutant, pour l'audit par mutation (§ 14.13) : un processus
// node --test par mutant, sous le repli du § 14.8, les crochets de
// crochets.js servant le source muté sans rien écrire dans le projet. Le
// processus est chef de son groupe : au délai, le groupe entier est tué, les
// processus d'épreuve que node --test a lancés compris.
//
// Issues d'un mutant :
//   erreur     le source muté ne se lit pas (syntaxe), ou node --test sort
//              autrement que par 0 ou 1 : l'audit les compte à part ;
//   tue        une épreuve échoue, chargement du module compris ;
//   survivant  toutes les épreuves passent ;
//   delai      le délai expire avant la fin : une boucle sans fin, le plus
//              souvent.
//
// La durée se lit à l'horloge réelle (performance.now) et ne s'écrit nulle
// part. L'extrait ne porte aucun chemin du poste : la racine du projet est
// retirée, le dossier personnel devient « ~ ».
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseAst } from 'vite';
import { VARIABLE } from './crochets.js';
import { appliquer } from './mutants.js';

const RACINE = fileURLToPath(new URL('../..', import.meta.url));
const CROCHETS = new URL('./crochets.js', import.meta.url).href;

// Ce que l'on garde de la sortie d'un processus : son début, un mébioctet au
// plus ; une boucle qui imprime ne remplit pas la mémoire.
const SORTIE_MAX_OCTETS = 1 << 20;
// La longueur d'un extrait, en caractères, et ses lignes au plus.
const EXTRAIT_MAX = 2_000;
const LIGNES_MAX = 15;

/**
 * @typedef {Object} Serie
 * @property {number|null} code     code de sortie de node --test, null s'il est tué
 * @property {string|null} signal
 * @property {boolean} delai        vrai quand le délai a tué le groupe
 * @property {number} dureeMs
 * @property {string} sortie        sortie standard et d'erreur mêlées, TAP, bornée
 */

// Lève sur une demande que node --test lirait autrement : sans fichier, il
// chercherait lui-même les épreuves de tout le projet ; un chemin absent, il
// le lirait comme un motif sans correspondance et échouerait, ce qui se
// confondrait avec un mutant tué.
function verifierDemande({ tests, delaiMs, racine }) {
  if (!Array.isArray(tests) || tests.length === 0) throw new TypeError('aucune épreuve à jouer');
  for (const test of tests) {
    if (typeof test !== 'string' || !existsSync(join(racine, test))) throw new Error(`épreuve introuvable : ${test}`);
  }
  if (!Number.isFinite(delaiMs) || delaiMs <= 0) throw new RangeError(`délai invalide : ${delaiMs}`);
}

// Tue le processus et son groupe. ESRCH : le groupe est déjà vide.
function tuerGroupe(enfant) {
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(enfant.pid), '/t', '/f'], { windowsHide: true });
    } else {
      process.kill(-enfant.pid, 'SIGKILL');
    }
  } catch (erreur) {
    if (erreur.code !== 'ESRCH') throw erreur;
  }
}

/**
 * Joue les épreuves sous le repli node --test, le module désigné muté s'il y
 * en a un. Une liste d'épreuves vide, une épreuve absente ou un délai non
 * positif sont refusés avant tout lancement.
 * @param {Object} demande
 * @param {string[]} demande.tests  chemins relatifs à la racine
 * @param {number} demande.delaiMs
 * @param {null|{fichier: string, remplacement: string}} [demande.mutation]
 *        fichier : chemin absolu du module muté ; null : la série non mutée
 * @param {string} [demande.racine]  la racine du projet, celle de ce script par défaut
 * @param {string[]} [demande.argumentsNode]  options de Node ajoutées avant --test
 * @returns {Promise<Serie>}
 */
export async function executerSerie({ tests, delaiMs, mutation = null, racine = RACINE, argumentsNode = [] }) {
  verifierDemande({ tests, delaiMs, racine });
  const dossier = mutation === null ? null : mkdtempSync(join(tmpdir(), 'gtt-mutation-'));
  let donnees = '';
  if (dossier !== null) {
    donnees = join(dossier, 'mutation.json');
    writeFileSync(donnees, JSON.stringify(mutation));
  }
  try {
    return await new Promise((resoudre, rejeter) => {
      const debut = performance.now();
      const enfant = spawn(
        process.execPath,
        ['--import', CROCHETS, ...argumentsNode, '--test', '--test-concurrency=1', '--test-reporter=tap', ...tests],
        {
          cwd: racine,
          env: { ...process.env, [VARIABLE]: donnees },
          detached: process.platform !== 'win32',
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        },
      );
      const morceaux = [];
      let octets = 0;
      const garder = (morceau) => {
        if (octets >= SORTIE_MAX_OCTETS) return;
        const reste = morceau.subarray(0, SORTIE_MAX_OCTETS - octets);
        morceaux.push(reste);
        octets += reste.length;
      };
      enfant.stdout.on('data', garder);
      enfant.stderr.on('data', garder);
      let delai = false;
      const minuterie = setTimeout(() => {
        delai = true;
        tuerGroupe(enfant);
      }, delaiMs);
      enfant.once('error', (erreur) => {
        clearTimeout(minuterie);
        rejeter(erreur);
      });
      enfant.once('close', (code, signal) => {
        clearTimeout(minuterie);
        resoudre({
          code,
          signal,
          delai,
          dureeMs: performance.now() - debut,
          sortie: Buffer.concat(morceaux).toString('utf8'),
        });
      });
    });
  } finally {
    if (dossier !== null) rmSync(dossier, { recursive: true, force: true });
  }
}

// Le texte sans chemin du poste : la racine (chemin et URL, liens résolus ou
// non) retirée, le dossier personnel remplacé par « ~ ».
function sansChemins(texte, racine) {
  const avecFin = (chemin) => (chemin.endsWith(sep) ? chemin : chemin + sep);
  const racines = [...new Set([avecFin(racine), avecFin(realpathSync(racine))])];
  let propre = texte;
  for (const chemin of racines) {
    propre = propre.replaceAll(pathToFileURL(chemin).href, '').replaceAll(chemin, '');
  }
  return propre.replaceAll(homedir(), '~');
}

// Au plus LIGNES_MAX lignes et EXTRAIT_MAX caractères.
const borner = (lignes) => lignes.slice(0, LIGNES_MAX).join('\n').slice(0, EXTRAIT_MAX);

// Le premier échec du TAP : sa ligne « not ok » et son diagnostic, jusqu'à la
// pile exclue ; les dernières lignes de la sortie à défaut.
function premierEchec(sortie) {
  const lignes = sortie.split('\n');
  const debut = lignes.findIndex((ligne) => /^\s*not ok \d+/u.test(ligne));
  if (debut === -1) return borner(lignes.slice(-LIGNES_MAX));
  const retrait = lignes[debut].search(/\S/u);
  const fin = lignes.findIndex(
    (ligne, i) => i > debut && (/^\s*stack:/u.test(ligne) || (ligne.trim() === '...' && ligne.search(/\S/u) > retrait)),
  );
  return borner(lignes.slice(debut, fin === -1 ? undefined : fin));
}

/**
 * Joue un mutant contre ses épreuves.
 * @param {Object} demande
 * @param {import('./mutants.js').Mutant} demande.mutant  fichier relatif à la racine
 * @param {string[]} demande.tests  chemins relatifs à la racine, non vide
 * @param {number} demande.delaiMs  > 0
 * @param {string} [demande.racine]
 * @returns {Promise<{issue: 'tue'|'survivant'|'delai'|'erreur', dureeMs: number, extrait: string}>}
 *          rejetée sur une demande invalide, ou un mutant que le source ne
 *          porte plus à sa place (appliquer)
 */
export async function executerMutant({ mutant, tests, delaiMs, racine = RACINE }) {
  verifierDemande({ tests, delaiMs, racine });
  const fichier = join(racine, mutant.fichier);
  const remplacement = appliquer(readFileSync(fichier, 'utf8'), mutant);
  const debut = performance.now();
  try {
    parseAst(remplacement);
  } catch (erreur) {
    return { issue: 'erreur', dureeMs: performance.now() - debut, extrait: borner([sansChemins(String(erreur.message), racine)]) };
  }
  const serie = await executerSerie({ tests, delaiMs, mutation: { fichier, remplacement }, racine });
  const sortie = sansChemins(serie.sortie, racine);
  if (serie.delai) return { issue: 'delai', dureeMs: serie.dureeMs, extrait: '' };
  if (serie.code === 0) return { issue: 'survivant', dureeMs: serie.dureeMs, extrait: '' };
  if (serie.code === 1) return { issue: 'tue', dureeMs: serie.dureeMs, extrait: premierEchec(sortie) };
  return { issue: 'erreur', dureeMs: serie.dureeMs, extrait: borner(sortie.split('\n').slice(-LIGNES_MAX)) };
}
