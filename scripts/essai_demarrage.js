// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Essai de démarrage : construit la page, lance la vraie coquille Electron
// par Playwright, et y joue une courte séance par gestes. Il prouve ce que la
// coquille factice des épreuves (test/coquille.test.js) ne peut pas dire :
// qu'Electron démarre sur ce système, avec ses bibliothèques, y charge la
// page, que l'application y monte, que la détermination du dossier de
// travail retient le mode portable, qu'un travailleur de génération naît et
// rend son issue dans la page chargée sous file://, que le travailleur du
// solveur du diagnostic y charge HiGHS et rend le plancher exact, que la
// police de l'interface s'y charge, que l'aperçu s'y imprime une page par
// feuille, que
// les commandes de l'explorateur y lancent l'ouvreur du bureau sur le bon
// dossier, et que la sortie rend les verrous.
//
//   node scripts/essai_demarrage.js
//
// La séance, dans l'ordre :
//  1. le titre de la fenêtre vaut le nom suivi de la version affichée, le
//     bandeau porte la version affichée, le collecteur d'erreurs est posé ;
//     dans la page chargée sous file://, les deux faces de Noto Sans sont
//     chargées, le corps du document est en Noto Sans, et la chaîne témoin
//     y a la longueur des avances de la police, dans
//     TOLERANCE_CHAINE_TEMOIN (§ 19.4) ;
//  2. la liste affiche le dossier de travail exe/data ; hors de Windows et
//     de macOS, « Ouvrir dans l'explorateur » lance xdg-open sur exe/data,
//     sans refus à côté de la commande ; créer un événement, qui s'ouvre,
//     revenir à la liste, puis charger la petite démonstration, qui
//     s'ouvre ;
//  3. le mode portable : leurs deux .gtt.json sous exe/data, aucun sous home
//     ni sous temp, chacun avec son journal dans le dossier de son
//     événement, exe/data/<nom>/<nom>.gtt.json, aucun à même exe/data
//     (§ 8.6) ; puis la section « Impression » montre l'aperçu, le papier
//     A4 choisi, et le processus principal imprime en PDF le plan, puis la
//     feuille par table (webContents.printToPDF, à la taille de page de la
//     feuille de style) : une page par feuille de l'aperçu, chacune aux
//     dimensions de la sienne à TOLERANCE_PAGE_MM près ; hors de Windows et
//     de macOS, Impression › « Ouvrir le dossier » lance
//     xdg-open sur le dossier de la démonstration, sans refus ; la section
//     Diagnostic de la démonstration voit sa ligne du calcul exact,
//     [data-solveur], passer à « pret », sans erreur recueillie : le
//     travailleur du solveur, servi depuis blob:, a chargé le module
//     WebAssembly de HiGHS depuis file:// et rendu le calcul. Aucune
//     démonstration ne porte de conflit d'organisation, et le plancher exact
//     n'y apprend rien : l'essai attend l'état, non une phrase ;
//  4. « Modifier » prend un verrou dans le dossier de l'événement, sous
//     exe/data ; le compte d'arrêt passe à 2 000 mouvements par son champ,
//     puis « Générer », dans la page chargée sous file://, fait naître un
//     travailleur et ajoute des propositions, que le fichier d'état porte,
//     sans refus dans la section ni erreur recueillie ;
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
// racine, se range d'ordinaire sous LOCALAPPDATA. Hors de Windows et de
// macOS, un faux xdg-open, posé en tête du PATH, consigne chacun de ses
// arguments sur une ligne d'un journal et sort à 0 : l'essai lit dans ce
// journal le dossier que chaque commande de l'explorateur a demandé, sans
// qu'aucun gestionnaire de fichiers s'ouvre.
// La coquille range le dossier temporaire et LOCALAPPDATA parmi les données
// applicatives (electron/fichiers.js, § 8.6 point 2) : un exe placé sous
// l'un d'eux ferait retenir les Documents. Sous Windows, les Documents sont
// un dossier connu qu'aucune variable ne déplace : leur sonde y créerait le
// dossier du produit et son data/, que la suppression de la racine ne
// retire pas. Avant tout lancement, l'essai refuse donc un exe que l'une des
// données applicatives prévisibles de la coquille porterait.
//
// Sous Linux sans session graphique, Electron se lance sur la plateforme
// Ozone « headless » de Chromium : la fenêtre existe et la page s'y charge
// et s'y met en page, sans serveur d'affichage. Sous root, ou avec
// GTT_SANS_BAC_A_SABLE=1 là où le système refuse les espaces de noms
// d'utilisateur — un conteneur —, Electron se lance sans son bac à sable.
// Sort à 0 sur un démarrage conforme, à 1 sinon : chaque constat s'imprime,
// et le premier échec arrête la séance.
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path, { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OUVREUR_BUREAU, decrireSysteme, parOuvreurDuBureau } from '../electron/fichiers.js';
import { constante } from '../src/geometrie/constantes.js';
import { estSous } from '../src/stockage/dossier_travail.js';
import { VERSION } from '../src/version.genere.js';
import { titreAvecVersion } from '../src/interface/libelles.js';
import { MM_PAR_PX } from '../src/interface/impression/modele.js';
import { lirePolices } from '../test/polices.js';
import { CHAINE_TEMOIN, longueurTemoin } from '../test/temoin.js';
import { TOLERANCE_PAGE_MM, lireImpression } from '../test/navigateur/commandes_impression.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const ATTENTE_MS = 60_000;
const SONDAGE_MS = 100;

// Le nom de l'événement créé, la démonstration chargée, le compte d'arrêt.
const NOM_EVENEMENT = "Soirée d'essai";
const DEMONSTRATION = 'petite';
const ARRET = 2000;

// Les vues de l'aperçu que la coquille imprime, dans l'ordre : le plan,
// dans l'orientation de sa découpe, puis la feuille par table, en portrait,
// une page au moins par table.
const VUES_IMPRIMEES = ['plan', 'tables'];

// La police de l'interface, ses graisses, et le corps en px où la chaîne
// témoin se mesure.
const FAMILLE = 'Noto Sans';
const GRAISSES = ['400', '700'];
const CORPS_TEMOIN = 100;

/**
 * Les fautes de la police d'interface relevée dans la page, [] quand elle
 * est conforme, dans cet ordre : par graisse, 400 puis 700, une face de
 * Noto Sans absente de document.fonts ou dont le statut n'est pas
 * « loaded » ; le corps du document dont la première famille calculée n'est
 * pas Noto Sans ; la chaîne témoin dont l'écart relatif à la longueur
 * attendue passe la tolérance. Une famille se compare sans ses guillemets ;
 * les faces des autres familles n'entrent pas en compte.
 * @param {{faces: Array<{famille: string, graisse: string, style: string, etat: string}>,
 *          familleCorps: string, largeurTemoin: number}} releve
 * @param {{longueurAttendue: number, tolerance: number}} temoin
 * @returns {string[]}
 */
export function fautesDePolice({ faces, familleCorps, largeurTemoin }, { longueurAttendue, tolerance }) {
  const sansGuillemets = (texte) => texte.trim().replace(/^(["'])(.*)\1$/, '$2');
  const fautes = [];
  for (const graisse of GRAISSES) {
    const siennes = faces.filter((face) => sansGuillemets(face.famille) === FAMILLE && String(face.graisse) === graisse);
    if (siennes.length === 0) fautes.push(`face ${graisse} de ${FAMILLE} absente`);
    for (const { etat } of siennes) if (etat !== 'loaded') fautes.push(`face ${graisse} de ${FAMILLE} : ${etat}`);
  }
  if (sansGuillemets(familleCorps.split(',')[0]) !== FAMILLE) fautes.push(`corps du document en ${familleCorps}`);
  const ecart = Math.abs(largeurTemoin - longueurAttendue) / longueurAttendue;
  if (!(ecart <= tolerance)) fautes.push(`chaîne témoin : ${largeurTemoin} px pour ${longueurAttendue} px`);
  return fautes;
}

// Relève dans la page les faces de document.fonts, la famille calculée du
// corps, et la longueur de la chaîne témoin au corps donné, crénage et
// ligatures coupés, sur un <text> de la police de l'interface posé le temps
// de la mesure.
function releverPolice({ chaine, corps }) {
  const faces = [...document.fonts].map((face) => ({ famille: face.family, graisse: face.weight, style: face.style, etat: face.status }));
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const texte = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  texte.setAttribute(
    'style',
    `font-family: var(--police-interface); font-size: ${corps}px; font-kerning: none; font-variant-ligatures: none`,
  );
  texte.textContent = chaine;
  svg.append(texte);
  document.body.append(svg);
  const largeurTemoin = texte.getComputedTextLength();
  svg.remove();
  return { faces, familleCorps: getComputedStyle(document.body).fontFamily, largeurTemoin };
}

/**
 * Les fautes d'une impression de l'aperçu, [] quand elle est conforme : un
 * aperçu sans feuille ; un compte de pages qui n'est pas celui des feuilles,
 * et rien d'autre alors ; sinon, dans l'ordre des pages, chaque page dont la
 * largeur ou la hauteur s'écarte de plus de tolerance de celles de sa
 * feuille. Les dimensions sont en mm.
 * @param {Array<{largeur: number, hauteur: number}>} feuilles  celles de l'aperçu, dans l'ordre
 * @param {Array<{largeur: number, hauteur: number}>} pages  les boîtes de média du PDF
 * @param {number} tolerance
 * @returns {string[]}
 */
export function fautesDImpression(feuilles, pages, tolerance) {
  if (feuilles.length === 0) return ['aucune feuille dans l’aperçu'];
  if (pages.length !== feuilles.length) return [`${pages.length} page(s) pour ${feuilles.length} feuille(s)`];
  return pages.flatMap((page, rang) => {
    const feuille = feuilles[rang];
    const ecart = Math.max(Math.abs(page.largeur - feuille.largeur), Math.abs(page.hauteur - feuille.hauteur));
    return ecart <= tolerance
      ? []
      : [`page ${rang + 1} : ${page.largeur} × ${page.hauteur} mm pour une feuille de ${feuille.largeur} × ${feuille.hauteur} mm`];
  });
}

// Relève dans la page les dimensions rendues de chaque feuille de l'aperçu,
// en mm, dans l'ordre du document ; mmParPx, les millimètres par px CSS,
// vient du processus de l'essai (MM_PAR_PX), la fonction s'exécutant dans
// la page.
function releverFeuilles(mmParPx) {
  return [...document.querySelectorAll('[data-impression] [data-feuille]')].map((feuille) => {
    const { width, height } = feuille.getBoundingClientRect();
    return { largeur: width * mmParPx, hauteur: height * mmParPx };
  });
}

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

/**
 * Les fautes de la disposition des fichiers d'événement sous data (§ 8.6),
 * [] quand chacun est dans le dossier de son événement : un chemin relatif
 * à data, découpé au séparateur de chemins, compte deux segments,
 * <dossier>/<dossier><suffixe> — à la création, le dossier porte la base
 * des fichiers. Se nomment, dans l'ordre reçu : un fichier posé à même
 * data, un fichier plus profond, un fichier nommé autrement que son
 * dossier.
 * @param {string[]} relatifs  chemins relatifs à data, ceux de fichiersSous
 * @param {string} suffixe  le suffixe des fichiers jugés, SUFFIXES.etat…
 * @param {{sep: string}} [chemins]  path du système, ou path.posix, path.win32
 * @returns {string[]}
 */
export function fautesDeDisposition(relatifs, suffixe, chemins = path) {
  const fautes = [];
  for (const relatif of relatifs) {
    const segments = relatif.split(chemins.sep);
    if (segments.length === 1) fautes.push(`${relatif} : posé à même data, hors d\u{2019}un dossier d\u{2019}événement`);
    else if (segments.length > 2) fautes.push(`${relatif} : plus profond que le dossier de son événement`);
    else if (segments[1] !== segments[0] + suffixe) fautes.push(`${relatif} : nommé autrement que son dossier`);
  }
  return fautes;
}

/**
 * Les dossiers d'événement qui portent un état sans journal, ou un journal
 * sans état : le premier segment de chaque chemin relatif à data, comparé
 * entre les deux listes ; [] quand chaque état a son journal dans son
 * dossier. Chacun se nomme une fois, dans l'ordre des noms.
 * @param {string[]} etats  chemins relatifs à data des fichiers d'état
 * @param {string[]} journaux  chemins relatifs à data des journaux
 * @param {{sep: string}} [chemins]  path du système, ou path.posix, path.win32
 * @returns {string[]}
 */
export function fautesDAppariement(etats, journaux, chemins = path) {
  const dossiers = (relatifs) => new Set(relatifs.map((relatif) => relatif.split(chemins.sep)[0]));
  const avecEtat = dossiers(etats);
  const avecJournal = dossiers(journaux);
  const fautes = [];
  for (const dossier of [...new Set([...avecEtat, ...avecJournal])].sort()) {
    if (!avecJournal.has(dossier)) fautes.push(`${dossier} : un état sans journal`);
    else if (!avecEtat.has(dossier)) fautes.push(`${dossier} : un journal sans état`);
  }
  return fautes;
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

// La règle des plateformes vient de la coquille : l'essai attend l'ouvreur
// du bureau exactement là où elle le lance.
export { parOuvreurDuBureau };

/**
 * Le faux ouvreur du bureau, un script sh : il ajoute chacun de ses
 * arguments, sur sa ligne, au fichier que nomme GTT_JOURNAL_OUVREUR, et
 * sort à 0.
 */
export const OUVREUR_FACTICE = ['#!/bin/sh', 'printf \'%s\\n\' "$@" >> "$GTT_JOURNAL_OUVREUR"', ''].join('\n');

/**
 * L'environnement de la coquille avec le faux ouvreur : une copie de env où
 * dossier, qui le porte, ouvre le PATH, et où GTT_JOURNAL_OUVREUR nomme
 * journal. env n'est pas modifié.
 * @param {Record<string, string|undefined>} env
 * @param {string} dossier
 * @param {string} journal
 * @param {path.PlatformPath} [chemins]  node:path, ou l'une de ses variantes
 * @returns {Record<string, string|undefined>}
 */
export function environnementAvecOuvreur(env, dossier, journal, chemins = path) {
  const suite = env.PATH ? `${chemins.delimiter}${env.PATH}` : '';
  return { ...env, PATH: `${dossier}${suite}`, GTT_JOURNAL_OUVREUR: journal };
}

/**
 * Les fautes d'une commande de l'explorateur, [] quand l'ouvreur a reçu
 * exactement un argument, le dossier attendu : aucun appel ; sinon chaque
 * argument reçu autre que lui, ou un compte d'arguments autre que un.
 * @param {string[]} recus  les arguments que l'ouvreur a consignés pour la commande
 * @param {string} attendu  le chemin absolu du dossier à montrer
 * @returns {string[]}
 */
export function fautesDOuverture(recus, attendu) {
  if (recus.length === 0) return [`aucun appel de ${OUVREUR_BUREAU}`];
  const fautes = recus.filter((recu) => recu !== attendu).map((recu) => `${OUVREUR_BUREAU} reçoit ${recu} pour ${attendu}`);
  if (recus.length !== 1) fautes.push(`${recus.length} arguments pour un`);
  return fautes;
}

// Les lignes du journal de l'ouvreur, aucune tant qu'il n'existe pas.
function lignesDe(journal) {
  try {
    return readFileSync(journal, 'utf8').split('\n').filter((ligne) => ligne !== '');
  } catch {
    return [];
  }
}

// Clique la commande, puis attend qu'un argument de plus entre au journal
// de l'ouvreur, ou qu'un refus se montre dans conteneur ; rend les
// arguments reçus depuis le clic et le texte des refus montrés.
async function ouvrirParLOuvreur(conteneur, commande, journal) {
  const avant = lignesDe(journal).length;
  await commande.click();
  const refus = conteneur.locator('[data-refus]');
  await attendre(async () => lignesDe(journal).length > avant || (await refus.count()) > 0);
  const textes = (await refus.allTextContents()).map((texte) => texte.replace(/\s+/g, ' ').trim());
  return { recus: lignesDe(journal).slice(avant), refus: textes };
}

class EchecDEssai extends Error {}

/**
 * L'issue du calcul exact du diagnostic, lue dans la page : etat, l'état
 * que porte la ligne [data-solveur] (null sans elle) ; erreurs, ce que le
 * collecteur a recueilli (null sans collecteur). Fini et conforme quand la
 * ligne est prête sans erreur ; fini et non conforme sur une erreur, un
 * collecteur absent, un état indisponible ou annulé ; sinon pas fini,
 * l'essai attend.
 * @param {string|null} etat
 * @param {unknown[]|null} erreurs
 * @returns {{fini: boolean, conforme: boolean, detail: string}}
 */
export function issueDuSolveur(etat, erreurs) {
  if (erreurs === null) return { fini: true, conforme: false, detail: 'collecteur absent' };
  if (erreurs.length > 0) return { fini: true, conforme: false, detail: JSON.stringify(erreurs) };
  if (etat === 'pret') return { fini: true, conforme: true, detail: etat };
  if (etat === 'indisponible' || etat === 'annule') return { fini: true, conforme: false, detail: etat };
  return { fini: false, conforme: false, detail: String(etat) };
}

// Imprime un constat ; un constat faux arrête la séance.
function constater(libelle, vrai, detail) {
  console.log(`${vrai ? '[conforme]' : '[ÉCHEC]   '} ${libelle}${detail === undefined ? '' : ` : ${detail}`}`);
  if (!vrai) throw new EchecDEssai(libelle);
}

async function seance(application, dossiers, journalOuvreur) {
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
  // La police de l'interface, dans la page chargée sous file:// : la
  // longueur attendue vient des avances de la police embarquée, lue ici.
  constater('page chargée sous file://', fenetre.url().startsWith('file:'), fenetre.url());
  const police = await fenetre.evaluate(releverPolice, { chaine: CHAINE_TEMOIN, corps: CORPS_TEMOIN });
  const fautes = fautesDePolice(police, {
    longueurAttendue: longueurTemoin(lirePolices().regulier, CORPS_TEMOIN),
    tolerance: constante('TOLERANCE_CHAINE_TEMOIN'),
  });
  constater(
    'police de l’interface chargée : Noto Sans 400 et 700, corps du document, chaîne témoin',
    fautes.length === 0,
    fautes.length === 0 ? `${police.largeurTemoin} px à ${CORPS_TEMOIN} px` : fautes.join(' ; '),
  );

  // 2. Le dossier affiché, un événement créé, la démonstration chargée.
  const affiche = (await fenetre.locator('[data-dossier-travail]').textContent()).trim();
  constater('dossier de travail affiché', resolve(affiche) === resolve(data), affiche);
  if (journalOuvreur !== null) {
    const carte = fenetre.locator('[data-ecran="accueil"] [data-dossier]');
    const { recus, refus } = await ouvrirParLOuvreur(carte, carte.locator('[data-commande="explorateur"]'), journalOuvreur);
    const fautes = [...fautesDOuverture(recus, data), ...refus];
    constater(
      `« Ouvrir dans l’explorateur » lance ${OUVREUR_BUREAU} sur le dossier de travail, sans refus`,
      fautes.length === 0,
      fautes.length === 0 ? recus.join(', ') : fautes.join(' ; '),
    );
  }
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
  const journaux = fichiersSous(data, '.gtt-journal.jsonl');
  const disposition = [
    ...fautesDeDisposition(etats, '.gtt.json'),
    ...fautesDeDisposition(journaux, '.gtt-journal.jsonl'),
    ...fautesDAppariement(etats, journaux),
  ];
  constater(
    'chaque état et son journal dans le dossier de son événement, exe/data/<nom>/',
    disposition.length === 0,
    disposition.length === 0 ? [...etats, ...journaux].join(', ') : disposition.join(' ; '),
  );
  // L'aperçu de la section de l'impression, imprimé par le processus
  // principal : le plan, puis la feuille par table.
  await fenetre.locator('[data-commande="section"][data-cible="badges"]').click();
  await fenetre.locator('[data-apercu-impression] [data-papier="question"] [data-cible="A4"] [data-commande="choisirPapier"]').click();
  for (const vue of VUES_IMPRIMEES) {
    await fenetre.locator(`[data-apercu-impression] [data-commande="vue"][data-cible="${vue}"]`).click();
    await fenetre.locator(`[data-impression][data-vue-impression="${vue}"] [data-feuille]`).first().waitFor({ timeout: ATTENTE_MS });
    await fenetre.evaluate(() => document.fonts.ready.then(() => undefined));
    const feuilles = await fenetre.evaluate(releverFeuilles, MM_PAR_PX);
    const pdf = await application.evaluate(async ({ BrowserWindow }) => {
      const octets = await BrowserWindow.getAllWindows()[0].webContents.printToPDF({ preferCSSPageSize: true, printBackground: true });
      return octets.toString('base64');
    });
    const lu = await lireImpression(new Uint8Array(Buffer.from(pdf, 'base64')));
    const fautesImpression = fautesDImpression(feuilles, lu.mediaBox, TOLERANCE_PAGE_MM);
    const dimensions = ({ largeur, hauteur }) => `${largeur.toFixed(2)} × ${hauteur.toFixed(2)} mm`;
    constater(
      `aperçu « ${vue} » imprimé par la coquille : une page par feuille, chacune aux dimensions de la sienne`,
      fautesImpression.length === 0,
      fautesImpression.length === 0 ? `${lu.pages} page(s) : ${lu.mediaBox.map(dimensions).join(', ')}` : fautesImpression.join(' ; '),
    );
  }
  // Impression › « Ouvrir le dossier », sur le dossier de la démonstration
  // ouverte : celui de l'état qui ne porte pas l'événement créé.
  if (journalOuvreur !== null) {
    const demonstration = etats.find((f) => {
      const etat = lireEtat(join(data, f));
      return etat !== null && etat.evenement?.nom !== NOM_EVENEMENT;
    });
    constater('dossier de la démonstration sous exe/data', demonstration !== undefined, demonstration && dirname(demonstration));
    await fenetre.locator('[data-commande="section"][data-cible="badges"]').click();
    const badges = fenetre.locator('[data-section="badges"]');
    await badges.waitFor({ timeout: ATTENTE_MS });
    const { recus, refus } = await ouvrirParLOuvreur(badges, badges.locator('[data-commande="ouvrirDossier"]'), journalOuvreur);
    const fautes = [...fautesDOuverture(recus, join(data, dirname(demonstration))), ...refus];
    constater(
      `Impression › « Ouvrir le dossier » lance ${OUVREUR_BUREAU} sur le dossier de l’événement, sans refus`,
      fautes.length === 0,
      fautes.length === 0 ? recus.join(', ') : fautes.join(' ; '),
    );
  }

  // Le plancher exact de la démonstration : la section Diagnostic, puis
  // l'état de sa ligne du calcul exact, jusqu'à « pret » ou une faute.
  await fenetre.locator('[data-commande="section"][data-cible="diagnostic"]').click();
  const diagnostic = fenetre.locator('[data-section="diagnostic"]');
  await diagnostic.waitFor({ timeout: ATTENTE_MS });
  const solveur = await attendre(async () => {
    const etat = await diagnostic.locator('[data-solveur]').first().getAttribute('data-solveur', { timeout: ATTENTE_MS });
    const issue = issueDuSolveur(etat, await collecteur());
    return issue.fini ? issue : null;
  });
  constater(
    'plancher exact du diagnostic calculé par le travailleur du solveur, sans erreur recueillie',
    solveur?.conforme === true,
    solveur?.detail ?? `rien en ${ATTENTE_MS} ms`,
  );

  // 4. « Modifier », le compte d'arrêt, « Générer ».
  await fenetre.locator('[data-commande="modifier"]').first().click();
  const verrous = await attendre(() => {
    const trouves = fichiersSous(data, '.gtt.verrou');
    return trouves.length > 0 ? trouves : null;
  });
  constater('« Modifier » prend un verrou sous exe/data', verrous !== null, (verrous ?? []).join(', '));
  const verrousEgares = fautesDeDisposition(verrous, '.gtt.verrou');
  constater(
    'le verrou dans le dossier de son événement',
    verrousEgares.length === 0,
    verrousEgares.length === 0 ? verrous.join(', ') : verrousEgares.join(' ; '),
  );
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
  // Le faux ouvreur et son journal, hors des trois dossiers de l'essai.
  const ouvreur = join(racine, 'ouvreur');
  const journalOuvreur = parOuvreurDuBureau(process.platform) ? join(racine, 'ouvreur.txt') : null;
  const sansOuvreur = environnementDEssai(process.env, dossiers);
  const env = journalOuvreur === null ? sansOuvreur : environnementAvecOuvreur(sansOuvreur, ouvreur, journalOuvreur);
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
    if (journalOuvreur !== null) {
      mkdirSync(ouvreur);
      writeFileSync(join(ouvreur, OUVREUR_BUREAU), OUVREUR_FACTICE);
      chmodSync(join(ouvreur, OUVREUR_BUREAU), 0o755);
    }
    const { _electron } = await import('playwright');
    const application = await _electron.launch({
      args: [...(sansBacASable ? ['--no-sandbox'] : []), ...(sansEcran ? ['--ozone-platform=headless'] : []), '.'],
      cwd: RACINE,
      env,
      timeout: ATTENTE_MS,
    });
    try {
      await seance(application, dossiers, journalOuvreur);
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
