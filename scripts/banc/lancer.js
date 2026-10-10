// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'orchestrateur du banc de mesure (§ 19.10), que lancent npm run banc et
// make banc. Son déroulé :
//
//   1. effacer les sorties du navigateur (scripts/banc/sorties/<nom>.json,
//      chacune par son nom), pour qu'aucune sortie d'un passage précédent
//      ne se lise comme une mesure de celui-ci ;
//   2. relever le coût du plafond a priori sous node (plafond.js) ;
//   3. jouer le projet banc de Vitest (vitest.banc.config.js), qui écrit
//      les sorties ; une épreuve tombée — un contrôle du harnais, une
//      mesure qui se refuse — arrête le passage sans relevé ;
//   4. lire les sorties, et assembler le relevé : la configuration de la
//      machine, puis chaque mesure attendue, une fois, dans l'ordre du
//      registre, avec le ralentissement sous lequel elle s'est prise ; une
//      mesure manquante arrête le passage sans relevé ;
//   5. juger : une mesure de texte prise hors de la police embarquée
//      arrête le passage sans relevé ; un verdict « non tenu » s'écrit au
//      relevé, qui est une donnée, et rend la sortie non nulle ;
//   6. écrire scripts/banc/releve.json, puis imprimer le tableau des
//      constantes, les valeurs proposées face à celles du registre et les
//      écarts de leur accord.
//
// Le banc écrit un relevé, jamais le registre : src/geometrie/constantes.js
// ne se lit ici que pour l'ordre et les valeurs, et une valeur s'adopte à la
// main (releve.js). La configuration du relevé est la liste fermée du
// contrat — cadre, facteur d'échelle, versions, nombre de processeurs
// logiques, ralentissement, police — et ne nomme pas la machine : ni nom
// d'hôte, ni modèle de processeur, ni utilisateur, ni chemin, ni date
// (contrainte 27). Code de sortie : 0 quand le relevé est écrit et que
// chaque verdict est tenu, 1 sinon.
import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONSTANTES } from '../../src/geometrie/constantes.js';
import { optionsBanc, projetBanc } from './projet.js';
import { accordRegistre, nombre, tableauConstantes, verifierReleve } from './releve.js';

/** La racine du projet, d'où se résolvent les chemins relatifs. */
export const RACINE = fileURLToPath(new URL('../../', import.meta.url));

/** Le relevé, relatif à la racine. */
export const CHEMIN_RELEVE = 'scripts/banc/releve.json';

// Le dossier des sorties du navigateur, que navigateur.js écrit.
const DOSSIER_SORTIES = 'scripts/banc/sorties';

/** Les sorties que les épreuves du banc écrivent, par nom de fichier sans
 *  extension : le harnais, puis chaque mesure. */
export const SORTIES_NAVIGATEUR = Object.freeze(['harnais', 'temoin', 'sieges_lisibles', 'temps_image', 'parallele']);

/** Les gardes du banc : des mesures hors du registre, qui ne proposent pas
 *  de constante mais disent si une hypothèse tient, par ordre de nom. */
export const GARDES = Object.freeze(['DUREE_GENERATION_PAR_DEFAUT', 'TEMPS_IMAGE_LISTES']);

/** Les mesures qu'un relevé porte : chaque constante du banc du registre,
 *  dans son ordre, puis les gardes. Une constante du banc ajoutée au
 *  registre est attendue d'office, et manque tant que le banc ne la relève
 *  pas. */
export const ATTENDUES = Object.freeze([...CONSTANTES.filter((c) => c.proprietaire === 'banc').map((c) => c.nom), ...GARDES]);

/** La police embarquée, sous laquelle se prend toute mesure de texte. */
export const FAMILLE_EMBARQUEE = 'Noto Sans';

// Les mesures qui lisent le rendu du texte, et nomment donc leur police.
const MESURES_DE_TEXTE = Object.freeze(['SEUIL_SIEGES_LISIBLES', 'TOLERANCE_CHAINE_TEMOIN']);

// La machine de référence du banc : le poste, son processeur ralenti ×4 par
// le navigateur. C'est le ralentissement de la configuration du relevé ;
// chaque mesure porte en plus celui sous lequel elle s'est prise, que cite
// la configuration de sa constante.
const RALENTISSEMENT_REFERENCE = 4;

// Les constantes du banc que la machine de référence relève sans les
// proposer : ρ y reste à son défaut de travail. Leur mesure s'imprime pour
// information, jamais « à adopter ».
const RELEVEES_SANS_ADOPTION = Object.freeze(['RALENTISSEMENT_PLEINE_CHARGE']);

// Les champs de sommet qu'une sortie peut porter en plus de ses mesures, et
// que le relevé reprend tels quels.
const CHAMPS_REPRIS = Object.freeze(['plafondAPriori', 'parallele']);

const cheminSortie = (nom) => `${DOSSIER_SORTIES}/${nom}.json`;
const estAbsent = (erreur) => erreur?.code === 'ENOENT';

/**
 * La configuration du relevé : le cadre du projet banc au facteur 1, les
 * versions du navigateur et de Node, le nombre des processeurs logiques, le
 * ralentissement de la machine de référence, la police embarquée. Du
 * système, seul availableParallelism se lit : ni nom d'hôte, ni modèle de
 * processeur, ni utilisateur, ni dossier.
 *
 * @param {{systeme: Pick<typeof os, 'availableParallelism'>,
 *          node: string, navigateur: string|null}} options
 * @returns {import('./releve.js').ConfigurationReleve}
 */
export function configurationDuBanc({ systeme, node, navigateur }) {
  return {
    cadre: { ...projetBanc().provide.cadreBanc },
    facteurEchelle: 1,
    navigateur,
    node,
    processeursLogiques: systeme.availableParallelism(),
    ralentissementCpu: RALENTISSEMENT_REFERENCE,
    police: FAMILLE_EMBARQUEE,
  };
}

// Le rang d'une mesure dans le relevé : son rang au registre, puis, pour
// une garde, après toutes les constantes, par ordre de nom.
function rangeur(constantes) {
  const rang = (nom) => {
    const auRegistre = constantes.findIndex((c) => c.nom === nom);
    return auRegistre >= 0 ? auRegistre : constantes.length;
  };
  return (a, b) => rang(a.nom) - rang(b.nom) || (a.nom < b.nom ? -1 : a.nom > b.nom ? 1 : 0);
}

/**
 * Le relevé d'un passage : la configuration, les mesures de toutes les
 * sorties — chaque attendue une fois, rangées dans l'ordre du registre reçu
 * puis les gardes par ordre de nom —, et plafondAPriori et parallele quand
 * une sortie les porte. Une mesure sans ralentissement propre reçoit celui
 * de la configuration de sa sortie, quand celle-ci en porte un : en copie,
 * les sorties reçues restent intactes. Les sorties se lisent dans l'ordre
 * de la table ; une sortie sans mesures (le harnais) n'apporte rien.
 *
 * @param {{configuration: import('./releve.js').ConfigurationReleve,
 *          sorties: Map<string, {mesures?: object[], plafondAPriori?: object[], parallele?: object[]}>,
 *          attendues: ReadonlyArray<string>,
 *          constantes?: ReadonlyArray<import('../../src/geometrie/constantes.js').Constante>}} options
 * @returns {import('./releve.js').Releve}
 * @throws {TypeError} des sorties qui ne sont pas une Map
 * @throws {Error} une mesure attendue absente, une mesure en double ou
 *   inattendue, un champ repris porté par deux sorties, ou un relevé que
 *   verifierReleve refuse — le message nomme chaque faute
 */
export function assembler({ configuration, sorties, attendues, constantes = CONSTANTES }) {
  if (!(sorties instanceof Map)) throw new TypeError('sorties du banc : une Map attendue');
  const mesures = [];
  const repris = new Map();
  for (const [nomSortie, sortie] of sorties) {
    const ralentissementSortie = sortie.configuration?.ralentissementCpu;
    for (const mesure of sortie.mesures ?? []) {
      if (!attendues.includes(mesure.nom)) throw new Error(`mesure inattendue : ${mesure.nom} (sortie ${nomSortie})`);
      if (mesures.some((m) => m.nom === mesure.nom)) throw new Error(`mesure en double : ${mesure.nom} (sortie ${nomSortie})`);
      const herite = ralentissementSortie !== undefined && !Object.hasOwn(mesure, 'ralentissementCpu');
      mesures.push(herite ? { ...mesure, ralentissementCpu: ralentissementSortie } : mesure);
    }
    for (const champ of CHAMPS_REPRIS) {
      if (!Object.hasOwn(sortie, champ)) continue;
      if (repris.has(champ)) throw new Error(`${champ} : porté par deux sorties, ${repris.get(champ).sortie} et ${nomSortie}`);
      repris.set(champ, { sortie: nomSortie, valeur: sortie[champ] });
    }
  }
  const absentes = attendues.filter((nom) => !mesures.some((m) => m.nom === nom));
  if (absentes.length > 0) throw new Error(`mesure attendue absente : ${absentes.join(', ')}`);
  const releve = { format: 1, configuration, mesures: [...mesures].sort(rangeur(constantes)) };
  for (const champ of CHAMPS_REPRIS) if (repris.has(champ)) releve[champ] = repris.get(champ).valeur;
  const fautes = verifierReleve(releve, constantes);
  if (fautes.length > 0) throw new Error(`relevé refusé : ${fautes.map(({ chemin, faute }) => `${chemin} : ${faute}`).join(' ; ')}`);
  return releve;
}

/**
 * Le jugement d'un relevé assemblé. bloquants : chaque mesure de texte
 * prise sous une autre police que la police embarquée, ou qui n'en nomme
 * aucune — le relevé ne s'écrit pas. nonTenus : chaque mesure au verdict
 * « nonTenu », avec son critère — le relevé s'écrit, la sortie est non
 * nulle. Dans l'ordre des mesures.
 *
 * @param {import('./releve.js').Releve} releve
 * @returns {{bloquants: string[], nonTenus: string[]}}
 */
export function jugement(releve) {
  const bloquants = [];
  const nonTenus = [];
  for (const mesure of releve.mesures) {
    if (MESURES_DE_TEXTE.includes(mesure.nom) && mesure.police !== FAMILLE_EMBARQUEE) {
      bloquants.push(`${mesure.nom} mesurée sous la police « ${mesure.police ?? 'inconnue'} », et non sous ${FAMILLE_EMBARQUEE}`);
    }
    if (mesure.verdict === 'nonTenu') nonTenus.push(`${mesure.nom} : verdict non tenu — ${mesure.critere}`);
  }
  return { bloquants, nonTenus };
}

// Le relevé committé, lu sur le disque.
const releveCommite = (racine = RACINE) => JSON.parse(readFileSync(join(racine, CHEMIN_RELEVE), 'utf8'));

/**
 * Le tableau des constantes (§ 19.8, § 19.10) : tableauConstantes sur le
 * registre et un relevé, par défaut le relevé committé. Une ligne par
 * constante, sous un en-tête et son séparateur.
 *
 * @param {{releve?: import('./releve.js').Releve,
 *          constantes?: ReadonlyArray<import('../../src/geometrie/constantes.js').Constante>}} [options]
 * @returns {string}
 */
export function regionConstantes({ releve = releveCommite(), constantes = CONSTANTES } = {}) {
  return tableauConstantes(constantes, releve);
}

// Une valeur et son unité, à la française.
const avecUnite = (valeur, unite) => (valeur === null ? 'aucune valeur' : `${nombre(valeur)} ${unite}`);

// Ce qu'un passage imprime après l'écriture du relevé : le tableau, chaque
// constante du banc face à sa valeur proposée — égale, à adopter, ou
// relevée sans adoption —, chaque garde, puis l'accord du registre avec le
// relevé.
function imprimer(releve, sortie) {
  sortie('');
  sortie(regionConstantes({ releve }));
  sortie('');
  sortie('Valeurs proposées par le banc (à adopter à la main dans src/geometrie/constantes.js) :');
  for (const constante of CONSTANTES) {
    if (constante.proprietaire !== 'banc') continue;
    const mesure = releve.mesures.find((m) => m.nom === constante.nom);
    let suite = mesure.valeurProposee === constante.valeur ? 'égale' : 'à adopter';
    if (RELEVEES_SANS_ADOPTION.includes(constante.nom)) suite = 'relevé, non adopté : défaut de travail sous la machine de référence';
    sortie(
      `- ${constante.nom} : registre ${avecUnite(constante.valeur, constante.unite)}, ` +
        `relevé ${avecUnite(mesure.valeurProposee, constante.unite)} — ${suite}`,
    );
  }
  sortie('Gardes :');
  for (const mesure of releve.mesures) {
    if (!GARDES.includes(mesure.nom)) continue;
    const verdict = mesure.verdict === undefined ? '' : `, verdict ${mesure.verdict === 'tenu' ? 'tenu' : 'non tenu'}`;
    sortie(`- ${mesure.nom} : ${avecUnite(mesure.valeurProposee, mesure.unite)}${verdict}`);
  }
  const ecarts = accordRegistre(CONSTANTES, releve);
  if (ecarts.length === 0) sortie('Accord du registre avec le relevé : aucun écart.');
  else {
    sortie('Accord du registre avec le relevé :');
    for (const { nom, faute } of ecarts) sortie(`- ${nom} : ${faute}`);
  }
  sortie('La région « constantes » de README.md se met à jour par node scripts/documentation.js engendrer.');
}

// Le relevé du plafond a priori, par le script lui-même : son JSON imprimé.
function plafondParScript(racine) {
  const resultat = spawnSync(process.execPath, [join(racine, 'scripts/banc/plafond.js')], {
    cwd: racine,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  if (resultat.status !== 0) throw new Error(`plafond.js : code ${resultat.status}`);
  return JSON.parse(resultat.stdout);
}

// Le projet banc de Vitest, sorties à l'écran ; rend son code de sortie.
function vitestDuBanc(racine) {
  const resultat = spawnSync(process.execPath, [join(racine, 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'vitest.banc.config.js'], {
    cwd: racine,
    stdio: 'inherit',
  });
  return resultat.status ?? 1;
}

// La version du Chromium du banc, lancé par Playwright sous les options du
// projet banc : « Chromium <version> ».
async function versionNavigateur() {
  const { chromium } = await import('playwright');
  const { launchOptions = {} } = optionsBanc(process.env);
  const navigateur = await chromium.launch({ ...launchOptions, headless: true });
  try {
    return `Chromium ${navigateur.version()}`;
  } finally {
    await navigateur.close();
  }
}

/**
 * Un passage du banc, selon le déroulé de l'en-tête. Chaque effet se reçoit,
 * pour que les épreuves le remplacent ; par défaut, ceux de la machine.
 *
 * @param {{racine?: string, mesurerPlafond?: () => object[], lancerVitest?: () => number,
 *          lireNavigateur?: () => Promise<string>, systeme?: typeof os, node?: string,
 *          effacer?: (chemin: string) => void, lire?: (chemin: string) => string,
 *          ecrire?: (chemin: string, texte: string) => void, sortie?: (ligne: string) => void}} [effets]
 * @returns {Promise<0|1>}
 */
export async function executer({
  racine = RACINE,
  mesurerPlafond = () => plafondParScript(racine),
  lancerVitest = () => vitestDuBanc(racine),
  lireNavigateur = versionNavigateur,
  systeme = os,
  node = process.version,
  effacer = (chemin) => rmSync(join(racine, chemin), { force: true }),
  lire = (chemin) => readFileSync(join(racine, chemin), 'utf8'),
  ecrire = (chemin, texte) => writeFileSync(join(racine, chemin), texte),
  sortie = (ligne) => process.stdout.write(`${ligne}\n`),
} = {}) {
  for (const nom of SORTIES_NAVIGATEUR) effacer(cheminSortie(nom));
  let releve;
  try {
    const plafondAPriori = mesurerPlafond();
    const code = lancerVitest();
    if (code !== 0) {
      sortie(`Une épreuve du banc est tombée (code ${code}) : un contrôle du harnais, ou une mesure refusée. Aucun relevé écrit.`);
      return 1;
    }
    const sorties = new Map([['plafond', { plafondAPriori }]]);
    for (const nom of SORTIES_NAVIGATEUR) {
      let texte;
      try {
        texte = lire(cheminSortie(nom));
      } catch (erreur) {
        if (estAbsent(erreur)) continue;
        throw erreur;
      }
      sorties.set(nom, JSON.parse(texte));
    }
    const configuration = configurationDuBanc({ systeme, node, navigateur: await lireNavigateur() });
    releve = assembler({ configuration, sorties, attendues: ATTENDUES });
  } catch (erreur) {
    sortie(`Aucun relevé écrit : ${erreur.message}`);
    return 1;
  }
  const { bloquants, nonTenus } = jugement(releve);
  if (bloquants.length > 0) {
    for (const motif of bloquants) sortie(motif);
    sortie('Aucun relevé écrit : une mesure de texte hors de la police embarquée ne mesure pas le logiciel.');
    return 1;
  }
  ecrire(CHEMIN_RELEVE, `${JSON.stringify(releve, null, 2)}\n`);
  sortie(`Relevé écrit : ${CHEMIN_RELEVE}`);
  imprimer(releve, sortie);
  for (const motif of nonTenus) sortie(motif);
  return nonTenus.length > 0 ? 1 : 0;
}

// Vrai quand ce fichier est le script que Node a lancé, et non un module
// importé.
function estLanceDirectement() {
  if (process.argv[1] === undefined) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (estLanceDirectement()) process.exitCode = await executer();
