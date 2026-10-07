// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Essai de démarrage : construit la page, lance la vraie coquille Electron
// par Playwright, et y joue une courte séance par gestes. Il prouve ce que la
// coquille factice des épreuves (test/coquille.test.js) ne peut pas dire :
// qu'Electron démarre sur ce système, avec ses bibliothèques, y charge la
// page, que l'application y monte, que la détermination du dossier de
// travail retient le mode portable, qu'un travailleur de génération naît et
// rend son issue dans la page chargée sous file://, et que la sortie rend
// les verrous.
//
//   node scripts/essai_demarrage.js
//
// La séance, dans l'ordre :
//  1. le titre de la fenêtre vaut le nom suivi de la version affichée, le
//     bandeau porte la version affichée, le collecteur d'erreurs est posé ;
//  2. la liste affiche le dossier de travail exe/data ; créer un événement,
//     qui s'ouvre, revenir à la liste, puis charger la petite
//     démonstration, qui s'ouvre ;
//  3. le mode portable : leurs deux .gtt.json sous exe/data, aucun sous home
//     ni sous temp ;
//  4. « Modifier » prend un verrou sous exe/data ; le compte d'arrêt passe à
//     2 000 mouvements par son champ, puis « Générer », dans la page chargée
//     sous file://, fait naître un travailleur et ajoute des propositions,
//     que le fichier d'état porte, sans refus dans la section ni erreur
//     recueillie ;
//  5. le collecteur est vide ; la fenêtre se ferme, le processus sort, et
//     aucun .gtt.verrou ne reste sous exe/data.
//
// La coquille se lance comme publiée par le lanceur portable dans un dossier
// neuf, créé par mkdtemp sous le dossier temporaire du système et retiré en
// sortant. Il y prend trois dossiers distincts : exe, que le lanceur publie
// (PORTABLE_EXECUTABLE_DIR) ; home, le dossier personnel (HOME) ; temp, le
// dossier temporaire (TMPDIR, TEMP, TMP). XDG_CONFIG_HOME est retiré : sous
// Linux, les données applicatives et les Documents se déduisent alors de
// home seul. Sous Windows, le profil (USERPROFILE), AppData et LOCALAPPDATA
// passent eux aussi sous home : le temporaire du poste, où mkdtemp prend la
// racine, se range d'ordinaire sous LOCALAPPDATA.
// La coquille range le dossier temporaire et LOCALAPPDATA parmi les données
// applicatives (electron/fichiers.js, § 8.6 point 2) : un exe placé sous
// l'un d'eux ferait retenir les Documents. Sous Windows, les Documents sont
// un dossier connu qu'aucune variable ne déplace : leur sonde y créerait le
// dossier du produit, que la suppression de la racine ne retire pas. Avant
// tout lancement, l'essai refuse donc un exe que l'une des données
// applicatives prévisibles de la coquille porterait.
//
// Sous Linux sans session graphique, Electron se lance sur la plateforme
// Ozone « headless » de Chromium : la fenêtre existe et la page s'y charge
// et s'y met en page, sans serveur d'affichage. Sous root, ou avec
// GTT_SANS_BAC_A_SABLE=1 là où le système refuse les espaces de noms
// d'utilisateur — un conteneur —, Electron se lance sans son bac à sable.
// Sort à 0 sur un démarrage conforme, à 1 sinon : chaque constat s'imprime,
// et le premier échec arrête la séance.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path, { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decrireSysteme } from '../electron/fichiers.js';
import { estSous } from '../src/stockage/dossier_travail.js';
import { VERSION } from '../src/version.genere.js';
import { titreAvecVersion } from '../src/interface/libelles.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const ATTENTE_MS = 60_000;
const SONDAGE_MS = 100;

// Le nom de l'événement créé, la démonstration chargée, le compte d'arrêt.
const NOM_EVENEMENT = "Soirée d'essai";
const DEMONSTRATION = 'petite';
const ARRET = 2000;

/**
 * Les trois dossiers distincts de l'essai, sous racine.
 * @param {string} racine
 * @param {path.PlatformPath} [chemins]  node:path, ou l'une de ses variantes
 * @returns {{exe: string, home: string, temp: string}}
 */
export function dossiersDEssai(racine, chemins = path) {
  return { exe: chemins.join(racine, 'exe'), home: chemins.join(racine, 'home'), temp: chemins.join(racine, 'temp') };
}

/**
 * L'environnement de la coquille : une copie de env où le lanceur portable
 * publie exe, où home est le dossier personnel (HOME, USERPROFILE) et porte
 * AppData (APPDATA) et LOCALAPPDATA, où temp est le dossier temporaire, sans
 * XDG_CONFIG_HOME. Sous X11 (DISPLAY posé) sans XAUTHORITY, Xlib cherche son
 * fichier d'autorisation dans le dossier personnel : XAUTHORITY nomme alors
 * celui du dossier personnel de env, que le remplacement de HOME ferait
 * perdre. env n'est pas modifié.
 * @param {Record<string, string|undefined>} env
 * @param {{exe: string, home: string, temp: string}} dossiers
 * @param {path.PlatformPath} [chemins]  node:path, ou l'une de ses variantes
 * @returns {Record<string, string|undefined>}
 */
export function environnementDEssai(env, { exe, home, temp }, chemins = path) {
  const { XDG_CONFIG_HOME: _retire, ...garde } = env;
  const autorisation =
    garde.DISPLAY && !garde.XAUTHORITY && garde.HOME ? { XAUTHORITY: chemins.join(garde.HOME, '.Xauthority') } : {};
  return {
    ...garde,
    ...autorisation,
    PORTABLE_EXECUTABLE_DIR: exe,
    HOME: home,
    USERPROFILE: home,
    APPDATA: chemins.join(home, 'AppData', 'Roaming'),
    LOCALAPPDATA: chemins.join(home, 'AppData', 'Local'),
    TMPDIR: temp,
    TEMP: temp,
    TMP: temp,
  };
}

/**
 * Les données applicatives que la coquille lancée sous env retiendrait et
 * qui portent l'exécutable publié : vide quand le mode portable reste
 * possible. La liste est celle que compose decrireSysteme
 * (electron/fichiers.js, § 8.6 point 2), appelée comme la coquille l'appelle,
 * et estSous compare comme le système, selon la casse et le séparateur
 * qu'elle décrit. L'essai ne sait en propre que ce que rend app.getPath :
 * appData prend chaque valeur qu'il peut rendre — sous Windows, l'APPDATA de
 * env et celle du poste, dossier connu qu'aucune variable ne déplace ; sous
 * macOS, Library/Application Support sous l'un et l'autre HOME ; ailleurs,
 * XDG_CONFIG_HOME ou .config sous HOME —, decrireSysteme étant appelée une
 * fois pour chacune ; temp est TMP, puis TEMP, sous Windows, TMPDIR, puis
 * /tmp, ailleurs. Un autre nom demandé à app.getPath lève : l'essai
 * jugerait une liste à laquelle il manque un emplacement. Les dossiers se
 * rendent dans l'ordre des appels, sans doublon ; sans exécutable publié,
 * rien ne le porte.
 * @param {Record<string, string|undefined>} env  l'environnement de la coquille
 * @param {Record<string, string|undefined>} poste  l'environnement du poste
 * @param {string} plateforme  process.platform
 * @param {typeof decrireSysteme} [decrire]  la description du poste par la coquille
 * @returns {string[]}
 */
export function donneesApplicativesSurExe(env, poste, plateforme, decrire = decrireSysteme) {
  const executable = env.PORTABLE_EXECUTABLE_DIR || null;
  if (executable === null) return [];
  const chemins = plateforme === 'win32' ? path.win32 : path.posix;
  const sousMaison = (maison, ...segments) => (maison ? chemins.join(maison, ...segments) : undefined);
  const appData =
    plateforme === 'win32'
      ? [env.APPDATA, poste.APPDATA]
      : plateforme === 'darwin'
        ? [env.HOME, poste.HOME].map((maison) => sousMaison(maison, 'Library', 'Application Support'))
        : [env.XDG_CONFIG_HOME || sousMaison(env.HOME, '.config')];
  const temp = plateforme === 'win32' ? env.TMP || env.TEMP : env.TMPDIR || '/tmp';
  const portent = appData.flatMap((dossierAppData) => {
    const connus = { appData: dossierAppData, temp, documents: '' };
    const cheminSysteme = (nom) => {
      if (!Object.hasOwn(connus, nom)) throw new Error(`app.getPath('${nom}') : l'essai ne sait pas l'émuler`);
      return connus[nom];
    };
    const { emplacements } = decrire({ env, plateforme, cheminSysteme, nomProduit: '' });
    return emplacements.donneesApplicatives.filter((dossier) => estSous(executable, dossier, emplacements));
  });
  return [...new Set(portent)];
}

// Les fichiers sous dossier, récursivement, dont le nom finit par suffixe,
// relatifs à dossier et triés ; aucun quand dossier n'existe pas.
function fichiersSous(dossier, suffixe) {
  let entrees;
  try {
    entrees = readdirSync(dossier, { recursive: true, withFileTypes: true });
  } catch (erreur) {
    if (erreur?.code === 'ENOENT') return [];
    throw erreur;
  }
  return entrees
    .filter((e) => e.isFile() && e.name.endsWith(suffixe))
    .map((e) => relative(dossier, join(e.parentPath, e.name)))
    .sort();
}

// Sonde condition() jusqu'à ce qu'elle rende une valeur vraie, qu'elle rend ;
// au-delà d'ATTENTE_MS, rend la dernière valeur lue.
async function attendre(condition) {
  const limite = performance.now() + ATTENTE_MS;
  let valeur = await condition();
  while (!valeur && performance.now() < limite) {
    await new Promise((fin) => setTimeout(fin, SONDAGE_MS));
    valeur = await condition();
  }
  return valeur;
}

// La charge d'un fichier d'état (§ 8.9), ou null tant qu'il ne se lit pas.
function lireEtat(chemin) {
  try {
    return JSON.parse(readFileSync(chemin, 'utf8')).charge ?? null;
  } catch {
    return null;
  }
}

class EchecDEssai extends Error {}

// Imprime un constat ; un constat faux arrête la séance.
function constater(libelle, vrai, detail) {
  console.log(`${vrai ? '[conforme]' : '[ÉCHEC]   '} ${libelle}${detail === undefined ? '' : ` : ${detail}`}`);
  if (!vrai) throw new EchecDEssai(libelle);
}

async function seance(application, dossiers) {
  const data = join(dossiers.exe, 'data');
  const fenetre = await application.firstWindow({ timeout: ATTENTE_MS });
  // La fenêtre de la plateforme headless peut n'avoir qu'un pixel de côté :
  // la taille de la coquille lui est rendue, pour que chaque geste atteigne
  // un élément visible.
  await application.evaluate(({ BrowserWindow }) => {
    for (const w of BrowserWindow.getAllWindows()) w.setContentSize(1366, 768);
  });
  const collecteur = () => fenetre.evaluate(() => globalThis.__gttErreurs ?? null);

  // 1. Titre, bandeau, collecteur.
  await fenetre.locator('[data-bandeau]').waitFor({ timeout: ATTENTE_MS });
  await fenetre.locator('[data-ecran="accueil"]').waitFor({ timeout: ATTENTE_MS });
  const titre = await fenetre.title();
  constater('titre de la fenêtre', titre === titreAvecVersion(VERSION.affichee), titre);
  const bandeau = (await fenetre.locator('[data-bandeau]').textContent()).replace(/\s+/g, ' ').trim();
  constater('bandeau portant la version affichée', bandeau.includes(VERSION.affichee), bandeau);
  const erreursAuDepart = await collecteur();
  constater('collecteur posé et vide', Array.isArray(erreursAuDepart) && erreursAuDepart.length === 0, JSON.stringify(erreursAuDepart));

  // 2. Le dossier affiché, un événement créé, la démonstration chargée.
  const affiche = (await fenetre.locator('[data-dossier-travail]').textContent()).trim();
  constater('dossier de travail affiché', resolve(affiche) === resolve(data), affiche);
  await fenetre.locator('[data-ecran="accueil"] input[data-champ="nom"]').fill(NOM_EVENEMENT);
  await fenetre.locator('[data-ecran="accueil"] [data-commande="creer"]').click();
  await fenetre.locator('[data-ecran="evenement"]').waitFor({ timeout: ATTENTE_MS });
  constater('événement créé et ouvert', true, NOM_EVENEMENT);
  await fenetre.locator('[data-commande="liste"]').first().click();
  await fenetre.locator('[data-ecran="accueil"]').waitFor({ timeout: ATTENTE_MS });
  constater('événement créé dans la liste', (await fenetre.locator('[data-evenement]').count()) === 1);
  await fenetre.locator(`[data-demonstration="${DEMONSTRATION}"]`).click();
  await fenetre.locator('[data-ecran="evenement"]').waitFor({ timeout: ATTENTE_MS });
  constater('démonstration ouverte', true, DEMONSTRATION);

  // 3. Le mode portable.
  const etats = fichiersSous(data, '.gtt.json');
  constater('deux .gtt.json sous exe/data', etats.length === 2, etats.join(', '));
  const egares = [dossiers.home, dossiers.temp].flatMap((d) => fichiersSous(d, '.gtt.json').map((f) => join(d, f)));
  constater('aucun .gtt.json sous home ni temp', egares.length === 0, egares.join(', ') || 'aucun');

  // 4. « Modifier », le compte d'arrêt, « Générer ».
  await fenetre.locator('[data-commande="modifier"]').first().click();
  const verrous = await attendre(() => {
    const trouves = fichiersSous(data, '.gtt.verrou');
    return trouves.length > 0 ? trouves : null;
  });
  constater('« Modifier » prend un verrou sous exe/data', verrous !== null, (verrous ?? []).join(', '));
  const avant = new Set(etats);
  const ouvert = fichiersSous(data, '.gtt.json').find((f) => {
    const etat = lireEtat(join(data, f));
    return etat !== null && etat.evenement?.nom !== NOM_EVENEMENT && avant.has(f);
  });
  constater("fichier d'état de la démonstration", ouvert !== undefined, ouvert);
  const cheminOuvert = join(data, ouvert);
  await fenetre.locator('[data-commande="section"][data-cible="generation"]').click();
  const section = fenetre.locator('[data-section="generation"]');
  await section.waitFor({ timeout: ATTENTE_MS });
  const arret = section.locator('input[data-champ="generation.arret"]');
  await arret.fill(String(ARRET));
  await arret.press('Tab');
  const regle = await attendre(() => lireEtat(cheminOuvert)?.reglages?.generation?.arret === ARRET);
  constater('compte d’arrêt écrit', regle, String(lireEtat(cheminOuvert)?.reglages?.generation?.arret));
  const propositionsAvant = lireEtat(cheminOuvert)?.propositions?.length ?? 0;
  // Chaque génération prend un travailleur neuf (src/main.js) : Playwright
  // en signale la naissance, qui attend son rattachement avant d'exécuter
  // son script. Un exécuteur qui calcule dans la page n'en fait naître aucun.
  constater('page chargée sous file://', fenetre.url().startsWith('file:'), fenetre.url());
  const travailleurs = [];
  fenetre.on('worker', (travailleur) => travailleurs.push(travailleur.url()));
  await section.locator('[data-commande="generer"]').click();
  // La première fin qui se montre : l'issue, un refus dans la section, ou
  // une erreur recueillie — un travailleur qui ne se charge pas n'affiche
  // ni l'une ni l'autre, et le collecteur seul le dit.
  const texte = async (selecteur) => (await section.locator(selecteur).first().textContent()).replace(/\s+/g, ' ').trim();
  const fin = await attendre(async () => {
    if ((await section.locator('[data-refus]').count()) > 0) return { issue: false, detail: await texte('[data-refus]') };
    const recueillies = await collecteur();
    if (recueillies?.length > 0) return { issue: false, detail: JSON.stringify(recueillies) };
    if ((await section.locator('[data-issue]').count()) > 0) return { issue: true, detail: await texte('[data-issue]') };
    return null;
  });
  constater('génération achevée, sans refus ni erreur', fin?.issue === true, fin?.detail ?? `rien en ${ATTENTE_MS} ms`);
  constater(
    'un travailleur de génération né après « Générer »',
    travailleurs.length > 0,
    travailleurs.length === 0 ? 'aucun' : travailleurs.map((url) => url.slice(0, 64)).join(', '),
  );
  const ajoutees = await attendre(() => {
    const propositions = lireEtat(cheminOuvert)?.propositions ?? [];
    return propositions.length > propositionsAvant ? propositions.slice(propositionsAvant) : null;
  });
  constater(
    `propositions ajoutées au fichier d'état, chacune arrêtée à ${ARRET} mouvements`,
    ajoutees !== null && ajoutees.every((p) => p.arret === ARRET),
    ajoutees === null ? 'aucune' : ajoutees.map((p) => `${p.id}:${p.arret}`).join(', '),
  );

  // 5. Collecteur, fermeture, verrous.
  const erreurs = await collecteur();
  constater('collecteur vide après la séance', Array.isArray(erreurs) && erreurs.length === 0, JSON.stringify(erreurs));
  const sortie = application.waitForEvent('close', { timeout: ATTENTE_MS });
  await application.evaluate(({ BrowserWindow }) => {
    for (const w of BrowserWindow.getAllWindows()) w.close();
  });
  await sortie;
  constater('la fermeture de la fenêtre termine la coquille', true);
  const restants = fichiersSous(data, '.gtt.verrou');
  constater('aucun .gtt.verrou sous exe/data après la sortie', restants.length === 0, restants.join(', ') || 'aucun');
}

async function principal() {
  const sousRoot = typeof process.getuid === 'function' && process.getuid() === 0;
  const sansBacASable = sousRoot || process.env.GTT_SANS_BAC_A_SABLE === '1';
  const sansEcran = process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY;

  // npm est un script .cmd sous Windows, que Node ne lance que par un shell.
  execFileSync('npm', ['run', '--silent', 'build'], {
    cwd: RACINE,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  const racine = mkdtempSync(join(tmpdir(), 'gtt-essai-demarrage-'));
  const dossiers = dossiersDEssai(racine);
  const env = environnementDEssai(process.env, dossiers);
  for (const dossier of [...Object.values(dossiers), env.APPDATA, env.LOCALAPPDATA]) mkdirSync(dossier, { recursive: true });
  let conforme = false;
  let retrait = null;
  try {
    // Un exe sous des données applicatives ferait retenir les Documents du
    // poste, où la sonde écrirait : rien n'est lancé.
    const portent = donneesApplicativesSurExe(env, process.env, process.platform);
    constater(
      'exe hors des données applicatives de la coquille',
      portent.length === 0,
      portent.length === 0 ? dossiers.exe : `${dossiers.exe} sous ${portent.join(', ')}`,
    );
    const { _electron } = await import('playwright');
    const application = await _electron.launch({
      args: [...(sansBacASable ? ['--no-sandbox'] : []), ...(sansEcran ? ['--ozone-platform=headless'] : []), '.'],
      cwd: RACINE,
      env,
      timeout: ATTENTE_MS,
    });
    try {
      await seance(application, dossiers);
      conforme = true;
    } finally {
      await application.close().catch(() => {});
    }
  } catch (erreur) {
    if (!(erreur instanceof EchecDEssai)) console.error(erreur);
  } finally {
    // Un retrait refusé (EBUSY sous Windows, un fichier encore ouvert) ne
    // masque pas le verdict : il s'imprime après lui, en avertissement, et
    // ne change pas le code de sortie.
    try {
      rmSync(racine, { recursive: true, force: true });
    } catch (erreur) {
      retrait = erreur;
    }
  }
  console.log(conforme ? 'Démarrage conforme.' : 'Démarrage non conforme.');
  if (retrait !== null) console.warn(`Avertissement : ${racine} reste en place, son retrait a échoué : ${retrait.message}`);
  process.exit(conforme ? 0 : 1);
}

/**
 * Vrai quand script, le fichier que node exécute (process.argv[1]), est
 * fichier, ce module. Les deux chemins se comparent résolus par realpath :
 * un script atteint par un lien symbolique est le fichier qu'il désigne. Un
 * script absent ou illisible n'est pas ce module.
 * @param {string|undefined} script
 * @param {string} [fichier]
 * @returns {boolean}
 */
export function estLanceDirectement(script, fichier = fileURLToPath(import.meta.url)) {
  if (script === undefined) return false;
  try {
    return realpathSync(script) === realpathSync(fichier);
  } catch {
    return false;
  }
}

// L'essai ne part que lorsque node exécute ce fichier ; l'épreuve qui
// l'importe n'en lit que les fonctions.
if (estLanceDirectement(process.argv[1])) await principal();
