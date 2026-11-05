// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les commandes des captures d'écran, côté node (§ 19.4, § 19.5, § 19.7) :
// vitest.config.js les déclare dans browser.commands, et la page les appelle
// par commands de vitest/browser. Chacune reçoit d'abord le contexte de la
// commande — la page Playwright, le cadre de l'épreuve —, puis l'unique
// objet que la page lui passe ; elle rend du JSON. Aucun octet ne traverse
// en Uint8Array : le RPC des commandes sérialiserait un tableau typé en objet
// {"0": …}. La capture d'élément se prend ici, sur le cadre de l'épreuve, et
// s'écrit sur le disque sans repasser par la page.
//
// Les fichiers vivent sous une racine : celle du projet (racine null), ou
// un dossier d'épreuve que dossierEpreuve a créé, et que seul
// effacerDossierEpreuve retire. Toute autre racine est refusée.
//
// Le mode d'écriture. Chaque étape photographiée dépose, sous
// doc/captures/.attente/, son image <fichier>.png et son entrée complète
// <fichier>.json. publierCaptures publie d'un bloc : toutes les captures
// déclarées déposées, ni plus ni moins, chaque entrée relue et ses
// dimensions contrôlées, le manifeste assemblé et ses contrôles d'ordre et
// de machine tenus, alors seulement les images et le manifeste s'écrivent.
// Une image ne se réécrit que si l'empreinte de son étape a changé, ou si
// le fichier présent n'est plus celui que le manifeste décrit ; le
// manifeste ne se réécrit que si ses octets changent ; une image qui n'est
// plus déclarée part. Le dossier d'attente est jeté à la fin de chaque
// publication, réussie ou refusée : une publication refusée laisse le
// manifeste et les images tels qu'avant.
//
// Le mode de vérification compare l'entrée d'une étape à celle du
// manifeste (comparerCapture) et n'écrit rien.
//
// Les images de la planche (§ 19.6) ne viennent pas du navigateur : la page
// passe le PDF produit, en base64, à tramerPdf, qui lit chaque page demandée
// par pdfjs-dist — sa couche de texte et ses traits (test/pdf.js), sa taille
// à 96 ppp — et, en écriture, la trame en PNG sous le dossier d'attente, par
// le canevas natif que pdfjs-dist charge lui-même, @napi-rs/canvas, sa
// dépendance optionnelle. Seul make captures exige ce canevas : la lecture
// s'en passe, et le tramage refuse en le nommant quand il manque. pdfjs-dist
// et test/pdf.js se chargent au premier appel : la configuration du lanceur
// importe ce module sans eux. La publication tire son pilote des seules
// captures du navigateur : une page de PDF a la taille de sa page.
//
// Le manifeste ne nomme pas sa machine (§ 19.5, contrainte 27). Outre
// fautesDeMachine — clés fermées, chemins hors de la racine neutre —, la
// publication refuse toute chaîne qui porte, comme mot entier, le nom
// d'hôte de la machine, son premier libellé ou son utilisateur, lus de
// node:os — sauf un nom que les sources fixes du scénario portent déjà, un
// prénom de la démonstration par exemple, qu'aucun texte ne distingue de la
// machine —, et tout instant, celui de la capture ou un instant écrit dans
// un texte, que l'horloge pilotée du montage n'atteint pas : une lecture de
// l'horloge du système tombe hors de son intervalle.
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { hostname, tmpdir, userInfo } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CAPTURES,
  CHEMIN_MANIFESTE,
  DOSSIER_CAPTURES,
  ETAPES,
  canoniser,
  cheminImage,
  cheminsHorsRacine as cheminsHors,
  empreinteEtape,
  fautesDImage,
  fautesDeMachine,
  lireEntetePng,
  verifierOrdre,
} from '../../scripts/documentation/manifeste.js';
import { creerHorlogePilotee } from '../../src/application/horloge.js';
import { libelle } from '../../src/application/libelles.js';
import { estHorodatage } from '../../src/stockage/journal.js';
import { suivreRequetes } from '../chromium.js';

/** Les deux modes des captures : verifier compare au manifeste, ecrire
 *  dépose puis publie (make captures). */
export const MODES = Object.freeze(['verifier', 'ecrire']);

/** Les commandes que vitest.config.js déclare, toutes exportées ici. */
export const COMMANDES = Object.freeze([
  'requetesHorsBoucle',
  'echecsHorsBoucle',
  'declarationsCaptures',
  'cheminsHorsRacine',
  'lireManifeste',
  'prendreCliche',
  'deposerCapture',
  'comparerCapture',
  'publierCaptures',
  'viderAttente',
  'dossierEpreuve',
  'effacerDossierEpreuve',
  'empreintesDossier',
  'copierDansEpreuve',
  'tramerPdf',
]);

/**
 * Le mode des captures que GTT_CAPTURES demande : 'verifier' quand la
 * variable est absente ou vide.
 *
 * @param {Record<string, string|undefined>} env
 * @returns {'verifier'|'ecrire'}
 * @throws {Error} une autre valeur, nommée
 */
export function modeCaptures(env) {
  const valeur = env.GTT_CAPTURES ?? '';
  if (valeur === '') return 'verifier';
  if (MODES.includes(valeur)) return valeur;
  throw new Error(`GTT_CAPTURES : « ${valeur} » n’est ni ${MODES.map((m) => `« ${m} »`).join(' ni ')}`);
}

// La racine du projet, deux dossiers au-dessus de ce module.
const PROJET = fileURLToPath(new URL('../..', import.meta.url));

// Le dossier d'attente, relatif à une racine.
const ATTENTE = `${DOSSIER_CAPTURES}/.attente`;

// Les dossiers d'épreuve créés par dossierEpreuve et pas encore effacés.
const DOSSIERS_EPREUVE = new Set();

// Un nom de capture : lettres, chiffres, tirets, sans point ni barre.
const NOM_CAPTURE = /^[A-Za-z0-9][A-Za-z0-9-]*$/;

const sha256 = (octets) => createHash('sha256').update(octets).digest('hex');

// La racine absolue que désigne racine : le projet pour null, un dossier
// d'épreuve vivant, sinon un refus.
function racineDe(racine) {
  if (racine === null || racine === undefined) return PROJET;
  if (DOSSIERS_EPREUVE.has(racine)) return racine;
  throw new Error(`captures : racine refusée « ${racine} » — ni le projet, ni un dossier d’épreuve vivant`);
}

function exigerNom(fichier) {
  if (typeof fichier !== 'string' || !NOM_CAPTURE.test(fichier)) {
    throw new Error(`captures : nom de capture refusé ${JSON.stringify(fichier)}`);
  }
}

// Le contenu d'un fichier, null quand il n'existe pas.
async function lireSiPresent(chemin, encodage) {
  try {
    return await readFile(chemin, encodage);
  } catch (erreur) {
    if (erreur.code === 'ENOENT') return null;
    throw erreur;
  }
}

// Écrit un fichier par un fichier voisin renommé : un lecteur ne voit jamais
// un fichier à moitié écrit.
async function ecrireAtomique(chemin, contenu) {
  const provisoire = `${chemin}.ecriture`;
  await writeFile(provisoire, contenu);
  await rename(provisoire, chemin);
}

// Le manifeste d'une racine absolue, analysé ; null quand il n'existe pas.
async function manifesteDe(base) {
  const texte = await lireSiPresent(join(base, CHEMIN_MANIFESTE), 'utf8');
  if (texte === null) return null;
  try {
    return JSON.parse(texte);
  } catch (erreur) {
    throw new Error(`${CHEMIN_MANIFESTE} illisible : ${erreur.message}`);
  }
}

/** Les requêtes hors de la boucle locale que la page a émises depuis
 *  l'appel précédent (test/chromium.js) ; le premier appel pose le suivi. */
export async function requetesHorsBoucle(context) {
  return suivreRequetes(context.page).relever();
}

/** Les échecs des requêtes hors de la boucle locale, { adresse, cause },
 *  depuis l'appel précédent : la cause dit qui a refusé la connexion. */
export async function echecsHorsBoucle(context) {
  return suivreRequetes(context.page).releverEchecs();
}

/** Les captures déclarées (CAPTURES), sous { captures } : la page ne charge
 *  pas scripts/documentation/manifeste.js, qui est de node. */
export async function declarationsCaptures() {
  return { captures: CAPTURES.map((capture) => ({ ...capture })) };
}

/** Les chemins hors de la racine neutre que porte le texte relevé :
 *  cheminsHorsRacine de scripts/documentation/manifeste.js, sur les textes
 *  joints ligne à ligne. */
export async function cheminsHorsRacine(_context, { texte, racine }) {
  if (!Array.isArray(texte) || texte.some((ligne) => typeof ligne !== 'string')) {
    throw new TypeError('cheminsHorsRacine : texte est une liste de chaînes');
  }
  return cheminsHors(texte.join('\n'), racine);
}

/** Le manifeste de la racine, analysé ; null quand il n'existe pas. */
export async function lireManifeste(_context, { racine = null } = {}) {
  return manifesteDe(racineDe(racine));
}

/**
 * Photographie l'élément que désigne selecteur dans le cadre de l'épreuve
 * et écrit l'image sous le dossier d'attente de la racine, à
 * <fichier>.png. Le sélecteur doit désigner un seul élément.
 *
 * @returns {Promise<{chemin: string}>}  le chemin absolu de l'image
 */
export async function prendreCliche(context, { fichier, selecteur, racine = null }) {
  exigerNom(fichier);
  const base = racineDe(racine);
  const element = context.iframe.locator(selecteur);
  const nombre = await element.count();
  if (nombre !== 1) throw new Error(`capture ${fichier} : le sélecteur « ${selecteur} » désigne ${nombre} éléments, un attendu`);
  const octets = await element.screenshot({ animations: 'disabled', caret: 'hide' });
  const dossier = join(base, ATTENTE);
  await mkdir(dossier, { recursive: true });
  const chemin = join(dossier, `${fichier}.png`);
  await ecrireAtomique(chemin, octets);
  return { chemin };
}

/**
 * Dépose l'entrée d'une étape à côté de son image, sous le dossier
 * d'attente : l'image que prendreCliche a écrite à chemin, relue ; l'entrée
 * complétée de image {sha256, largeur, hauteur} et de son empreinte
 * d'étape. Des dimensions autres que cadre × facteur d'échelle refusent le
 * dépôt.
 *
 * @returns {Promise<{empreinte: string}>}
 */
export async function deposerCapture(_context, { fichier, entree, chemin, racine = null }) {
  exigerNom(fichier);
  const base = racineDe(racine);
  const attendu = join(base, ATTENTE, `${fichier}.png`);
  if (typeof chemin !== 'string' || resolve(chemin) !== attendu) {
    throw new Error(`capture ${fichier} : image attendue à ${relative(base, attendu)}, reçue ${JSON.stringify(chemin)}`);
  }
  if (entree?.fichier !== fichier) throw new Error(`capture ${fichier} : l’entrée porte le nom ${JSON.stringify(entree?.fichier)}`);
  const octets = new Uint8Array(await readFile(attendu));
  const { largeur, hauteur } = lireEntetePng(octets);
  const complete = { ...entree, image: { sha256: sha256(octets), largeur, hauteur } };
  const fautes = fautesDImage(complete, octets);
  if (fautes.length > 0) throw new Error(`capture ${fichier} : ${fautes.map(({ faute }) => faute).join(' ; ')}`);
  complete.empreinte = empreinteEtape(complete);
  await ecrireAtomique(join(base, ATTENTE, `${fichier}.json`), JSON.stringify(complete));
  return { empreinte: complete.empreinte };
}

// Le texte JSON canonique d'une valeur, pour comparer deux champs.
const canonique = (valeur) => canoniser({ valeur });

// Le premier rang où deux listes de textes diffèrent, et les deux textes.
function premierEcart(avant, apres) {
  const longueur = Math.max(avant.length, apres.length);
  for (let rang = 0; rang < longueur; rang += 1) {
    if (avant[rang] !== apres[rang]) return { rang, avant: avant[rang] ?? null, apres: apres[rang] ?? null };
  }
  return null;
}

// Un texte relevé en citation, ou « (rien) » au-delà de la fin.
const citer = (texte) => (texte === null ? '(rien)' : `« ${texte} »`);

/**
 * Compare l'entrée d'une étape à celle du manifeste de la racine (§ 19.7) :
 * l'empreinte d'étape d'abord ; quand elle diffère, chaque champ qui
 * diffère est nommé, le texte avec son premier écart. Rien ne s'écrit.
 *
 * @returns {Promise<{ecarts: string[]}>}  vide quand l'empreinte est la même
 */
export async function comparerCapture(_context, { fichier, entree, racine = null }) {
  exigerNom(fichier);
  const manifeste = await manifesteDe(racineDe(racine));
  const nom = `${fichier} (étape ${entree?.etape})`;
  if (manifeste === null) return { ecarts: [`${nom} : aucun manifeste, ${CHEMIN_MANIFESTE} — lancer make captures`] };
  const precedente = (manifeste.captures ?? []).find((capture) => capture?.fichier === fichier);
  if (precedente === undefined) return { ecarts: [`${nom} : absente du manifeste — lancer make captures`] };
  if (empreinteEtape(entree) === precedente.empreinte) return { ecarts: [] };
  const ecarts = [];
  const exclus = new Set(['image', 'empreinte', 'versionReelle']);
  const champs = [...new Set([...Object.keys(entree), ...Object.keys(precedente)])].filter((champ) => !exclus.has(champ)).sort();
  for (const champ of champs) {
    if (canonique(entree[champ] ?? null) === canonique(precedente[champ] ?? null)) continue;
    if (champ === 'texte' && Array.isArray(entree.texte) && Array.isArray(precedente.texte)) {
      const ecart = premierEcart(precedente.texte, entree.texte);
      ecarts.push(`${nom} : écart de texte, rang ${ecart.rang} : ${citer(ecart.apres)} au lieu de ${citer(ecart.avant)}`);
    } else {
      ecarts.push(`${nom} : écart de ${champ}`);
    }
  }
  if (ecarts.length === 0) ecarts.push(`${nom} : empreinte d’étape différente de celle du manifeste`);
  return { ecarts };
}

// Les captures déposées sous le dossier d'attente : { fichier → {png, json} }.
// Un fichier d'une autre forme lève.
async function deposees(attente) {
  let noms;
  try {
    noms = await readdir(attente);
  } catch (erreur) {
    if (erreur.code === 'ENOENT') return new Map();
    throw erreur;
  }
  const depots = new Map();
  for (const nom of noms.sort()) {
    const forme = /^(.+)\.(png|json)$/.exec(nom);
    if (forme === null || !NOM_CAPTURE.test(forme[1])) throw new Error(`publication : fichier inattendu dans ${ATTENTE} : ${nom}`);
    const [, fichier, extension] = forme;
    depots.set(fichier, { ...depots.get(fichier), [extension]: join(attente, nom) });
  }
  return depots;
}

/**
 * L'identité de la machine que la publication refuse de publier : son nom
 * d'hôte, et son utilisateur, null quand le système n'en connaît aucun.
 *
 * @returns {{hote: string, utilisateur: string|null}}
 */
export function machineCourante() {
  let utilisateur = null;
  try {
    utilisateur = userInfo().username;
  } catch {
    // Un processus sans entrée dans la base des comptes : aucun nom à taire.
  }
  return { hote: hostname(), utilisateur };
}

/** La portée de l'horloge pilotée qu'admet un instant de capture, en ms
 *  depuis son départ : le parcours l'avance de quelques minutes ; une
 *  lecture de l'horloge du système tombe des jours plus loin. */
export const PORTEE_PILOTEE_MS = 24 * 60 * 60 * 1000;

/** Le premier et le dernier horodatage qu'admet un instant de capture :
 *  ceux de creerHorlogePilotee à son départ, puis avancée de
 *  PORTEE_PILOTEE_MS. Les deux portent le décalage du départ. */
export const INSTANTS_PILOTES = (() => {
  const horloge = creerHorlogePilotee();
  const debut = horloge.horodatage();
  horloge.avancer(PORTEE_PILOTEE_MS);
  return Object.freeze({ debut, fin: horloge.horodatage() });
})();

// Vrai quand l'instant est un horodatage que l'horloge pilotée atteint :
// sa forme, le décalage du départ, entre début et fin. À forme et décalage
// égaux, l'ordre des textes est celui des instants.
function instantPilote(instant) {
  const { debut, fin } = INSTANTS_PILOTES;
  return (
    typeof instant === 'string' &&
    estHorodatage(instant) &&
    instant.slice(19) === debut.slice(19) &&
    instant >= debut &&
    instant <= fin
  );
}

// Un instant écrit dans un texte, sous les formes de l'application : un
// horodatage ISO, millisecondes et « Z » compris, que seul instantPilote
// admet ; dans un nom de fichier, AAAA-MM-JJ_HH-MM-SS, le jour et l'heure
// locale sans décalage (la planche, la corbeille) ; en lettres, la date de
// format.date suivie, après « , » ou « à », de l'heure de format.heure
// (format.horodatage, dater) ou de HH:MM:SS (planche.pied.horodatage).
const INSTANT_ISO = /(?<!\d)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?(?!\d)/gu;
const INSTANT_FICHIER = /(?<!\d)(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})(?!\d)/gu;
const INSTANT_EN_LETTRES =
  /(?<![\p{L}\p{N}])(1er|\d{1,2})\s(\p{L}+)\s(\d{4})(?:,\s|\sà\s)(?:(\d{1,2})\sh\s(\d{2})|(\d{2}):(\d{2}):(\d{2}))(?!\p{N})/gu;

const deuxChiffres = (n) => String(n).padStart(2, '0');

// La clé AAAA-MM-JJTHH:MM[:SS] d'un instant en lettres, lu par les textes
// mêmes qui l'écrivent : le mois est celui dont format.date redonne la
// date telle quelle, l'heure celle que format.heure redonne telle quelle.
// null quand le texte n'est pas une forme de l'application.
function cleEnLettres([, jourEcrit, nomDuMois, anneeEcrite, heureH, minuteH, heureS, minuteS, seconde]) {
  const annee = Number(anneeEcrite);
  const jour = jourEcrit === '1er' ? 1 : Number(jourEcrit);
  const dateEcrite = `${jourEcrit} ${nomDuMois} ${anneeEcrite}`;
  const mois = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find((m) => libelle('format.date', { annee, mois: m, jour }) === dateEcrite);
  if (mois === undefined) return null;
  const jourCle = `${anneeEcrite}-${deuxChiffres(mois)}-${deuxChiffres(jour)}`;
  if (heureS !== undefined) return `${jourCle}T${heureS}:${minuteS}:${seconde}`;
  const [heure, minute] = [Number(heureH), Number(minuteH)];
  if (libelle('format.heure', { heure, minute }) !== `${heureH} h ${minuteH}`) return null;
  return `${jourCle}T${deuxChiffres(heure)}:${minuteH}`;
}

// Le premier instant d'un texte que l'horloge pilotée n'atteint pas, tel
// qu'il s'écrit, ou null. Un instant d'un nom de fichier ou en lettres se
// lit à l'heure locale du départ, à la minute ou à la seconde qu'il porte :
// sa clé AAAA-MM-JJTHH:MM[:SS] se compare au même préfixe de début et de
// fin.
function instantEtranger(texte) {
  for (const [ecrit] of texte.matchAll(INSTANT_ISO)) if (!instantPilote(ecrit)) return ecrit;
  const { debut, fin } = INSTANTS_PILOTES;
  const horsPortee = (cle) => cle < debut.slice(0, cle.length) || cle > fin.slice(0, cle.length);
  for (const [ecrit, jour, heure, minute, seconde] of texte.matchAll(INSTANT_FICHIER)) {
    if (horsPortee(`${jour}T${heure}:${minute}:${seconde}`)) return ecrit;
  }
  for (const morceaux of texte.matchAll(INSTANT_EN_LETTRES)) {
    const cle = cleEnLettres(morceaux.map((m) => m?.replace(/\s/gu, ' ')));
    if (cle !== null && horsPortee(cle)) return morceaux[0];
  }
  return null;
}

const echapper = (texte) => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Le motif d'un nom pris comme mot entier, sans égard à la casse : ni
// lettre, ni chiffre, ni « _ » ne le touche.
const motEntier = (nom) => new RegExp(`(?<![\\p{L}\\p{N}_])${echapper(nom)}(?![\\p{L}\\p{N}_])`, 'iu');

// Les chaînes d'une valeur JSON, clés comprises, les clés d'un objet dans
// leur ordre de points de code.
function chaines(valeur) {
  if (typeof valeur === 'string') return [valeur];
  if (Array.isArray(valeur)) return valeur.flatMap(chaines);
  if (valeur !== null && typeof valeur === 'object') {
    return Object.keys(valeur)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .flatMap((cle) => [cle, ...chaines(valeur[cle])]);
  }
  return [];
}

// Les sources fixes dont le scénario des captures tire ses textes, sous le
// projet : les réservoirs et le catalogue de la démonstration, les
// démonstrations livrées, les CSV d'exemple, les tables de libellés, et le
// parcours, qui tape les siens. Un dossier se lit fichier par fichier, sans
// ses sous-dossiers ni ses épreuves.
export const SOURCES_DU_SCENARIO = Object.freeze([
  'src/demo',
  'src/demo/livrees',
  'exemples',
  'src/application/libelles',
  'src/interface/libelles',
  'src/interface/parcours.navigateur.test.js',
]);

// Le texte d'un fichier : UTF-8 quand ses octets le sont, windows-1252
// sinon, l'encodage d'un CSV d'exemple.
function decoderSource(octets) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(octets);
  } catch {
    return new TextDecoder('windows-1252').decode(octets);
  }
}

/**
 * Les textes des SOURCES_DU_SCENARIO, lus sous le projet, dossier par
 * dossier dans l'ordre de la liste, chaque dossier dans l'ordre des points
 * de code de ses noms.
 *
 * @returns {Promise<string[]>}
 */
export async function lireSourcesDuScenario() {
  const textes = [];
  for (const source of SOURCES_DU_SCENARIO) {
    const chemin = join(PROJET, source);
    let fichiers = [chemin];
    if (!source.endsWith('.js')) {
      const entrees = await readdir(chemin, { withFileTypes: true });
      fichiers = entrees
        .filter((entree) => entree.isFile() && !entree.name.includes('.test.'))
        .map(({ name }) => name)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
        .map((nom) => join(chemin, nom));
    }
    for (const fichier of fichiers) textes.push(decoderSource(await readFile(fichier)));
  }
  return textes;
}

/**
 * Les fautes d'identité d'un manifeste (§ 19.5, contrainte 27) : une
 * chaîne, clés comprises, qui porte comme mot entier le nom d'hôte de la
 * machine, le premier libellé de ce nom ou son utilisateur ; l'instant
 * d'une capture que l'horloge pilotée n'atteint pas (INSTANTS_PILOTES) ;
 * un instant écrit dans une chaîne qu'elle n'atteint pas (instantEtranger).
 * Un nom que l'une des sources porte déjà comme mot entier ne se cherche
 * pas : le texte qui le porte vient du scénario, et le chercher refuserait
 * toute machine nommée comme un prénom de la démonstration. Le pilote
 * d'abord, puis chaque capture et chaque reportée, dans leur ordre ; une
 * faute par sorte de nom — hôte, utilisateur — et par entrée, qui ne cite
 * pas le nom ; une par entrée pour les instants de ses chaînes, qui cite le
 * premier. Un nom vide ou null ne se cherche pas.
 *
 * @param {Object} manifeste
 * @param {{hote: string|null, utilisateur: string|null}} machine
 * @param {{sources?: string[]}} [options]  les textes des sources du
 *        scénario (lireSourcesDuScenario), aucun par défaut
 * @returns {Array<{chemin: string, faute: string}>}
 */
export function fautesDIdentite(manifeste, machine, { sources = [] } = {}) {
  const noms = [];
  const hote = machine?.hote ?? '';
  if (hote !== '') {
    noms.push(['nom d’hôte de la machine', hote]);
    const court = hote.split('.')[0];
    if (court !== '' && court !== hote) noms.push(['nom d’hôte de la machine', court]);
  }
  if ((machine?.utilisateur ?? '') !== '') noms.push(['utilisateur de la machine', machine.utilisateur]);
  const motifs = noms
    .map(([quoi, nom]) => [quoi, motEntier(nom)])
    .filter(([, motif]) => !sources.some((source) => motif.test(source)));
  const { debut, fin } = INSTANTS_PILOTES;
  const fautes = [];
  // Les noms, puis les instants écrits dans les chaînes, hors de la clé
  // instant d'une capture, contrôlée à part.
  const lire = (chemin, valeur, instantAPart = false) => {
    const textes = chaines(valeur);
    const vus = new Set();
    for (const [quoi, motif] of motifs) {
      if (vus.has(quoi) || !textes.some((texte) => motif.test(texte))) continue;
      vus.add(quoi);
      fautes.push({ chemin, faute: quoi });
    }
    for (const texte of instantAPart ? chaines({ ...valeur, instant: null }) : textes) {
      const ecrit = instantEtranger(texte);
      if (ecrit === null) continue;
      fautes.push({ chemin, faute: `instant « ${ecrit} » dans un texte, hors de l’horloge pilotée, de « ${debut} » à « ${fin} »` });
      break;
    }
  };
  lire(CHEMIN_MANIFESTE, manifeste.pilote ?? null);
  for (const entree of manifeste.captures ?? []) {
    lire(cheminImage(entree?.fichier), entree, true);
    if (!instantPilote(entree?.instant)) {
      const instant = typeof entree?.instant === 'string' ? `« ${entree.instant} »` : JSON.stringify(entree?.instant ?? null);
      fautes.push({ chemin: cheminImage(entree?.fichier), faute: `instant ${instant} hors de l’horloge pilotée, de « ${debut} » à « ${fin} »` });
    }
  }
  for (const entree of manifeste.reportees ?? []) lire(cheminImage(entree?.fichier), entree);
  return fautes;
}

// Le pilote du manifeste : le navigateur et sa version, le mode
// d'affichage, le facteur d'échelle et le cadre, communs à toutes les
// captures du navigateur. Le mode est celui que chaque capture inscrit, que
// la page tient de la configuration (modeAffichage de test/chromium.js) :
// deux modes, comme deux cadres, refusent la publication. Une page de PDF
// n'en relève pas : son cadre est sa page à PPP_TRAMAGE (§ 19.6). Sans
// capture du navigateur, aucun pilote : refus.
function piloteDe(context, captures) {
  const duNavigateur = captures.filter(({ source }) => source !== 'pdf');
  const [premiere] = duNavigateur;
  if (premiere === undefined) throw new Error('publication : aucune capture du navigateur — le manifeste n’aurait aucun pilote');
  for (const capture of duNavigateur) {
    if (capture.facteurEchelle !== premiere.facteurEchelle || canonique(capture.cadre) !== canonique(premiere.cadre)) {
      throw new Error(`publication : ${capture.fichier} n’a pas le cadre ni le facteur d’échelle de ${premiere.fichier}`);
    }
    if (capture.mode !== premiere.mode) {
      throw new Error(
        `publication : ${capture.fichier} n’a pas le mode d’affichage de ${premiere.fichier}, « ${capture.mode} » contre « ${premiere.mode} »`,
      );
    }
  }
  const versionNavigateur = context.page.context().browser()?.version() ?? 'inconnue';
  return {
    navigateur: 'chromium',
    versionNavigateur,
    mode: premiere.mode,
    facteurEchelle: premiere.facteurEchelle,
    cadre: { largeur: premiere.cadre.largeur, hauteur: premiere.cadre.hauteur },
  };
}

/**
 * Les étapes que le contrôle d'ordre exige d'une publication dont declarees
 * nomme les captures, des noms de CAPTURES sans doublon : toutes celles
 * d'ETAPES quand elle les porte toutes, comme make captures ; sinon les
 * seules étapes de sa sélection, dans l'ordre d'ETAPES. Une publication
 * partielle, celle des épreuves, laisse d'autres étapes sans capture, et le
 * contrôle du niveau node refuse le manifeste qu'elle écrit.
 * @param {readonly string[]} declarees
 * @returns {readonly string[]}
 */
export function etapesExigees(declarees) {
  if (CAPTURES.every(({ fichier }) => declarees.includes(fichier))) return ETAPES;
  const choisies = new Set(CAPTURES.filter(({ fichier }) => declarees.includes(fichier)).map(({ etape }) => etape));
  return ETAPES.filter((etape) => choisies.has(etape));
}

// Assemble la publication sans rien écrire : le manifeste, les images à
// écrire, les images à retirer. Lève sur la première raison de refuser.
async function preparer(context, base, declarees, racineNeutre, machine, sources) {
  if (!Array.isArray(declarees) || declarees.length === 0) {
    throw new Error('publication : aucune capture déclarée — zéro capture n’est pas zéro capture périmée');
  }
  const connues = new Map(CAPTURES.map((capture) => [capture.fichier, capture]));
  for (const fichier of declarees) {
    if (!connues.has(fichier)) throw new Error(`publication : ${JSON.stringify(fichier)} n’est pas déclarée dans CAPTURES`);
  }
  if (new Set(declarees).size !== declarees.length) throw new Error('publication : une capture déclarée deux fois');

  const depots = await deposees(join(base, ATTENTE));
  if (depots.size === 0) throw new Error('publication : aucune capture déposée — rien n’est publié');
  const completes = [...depots].filter(([, depot]) => depot.png && depot.json).map(([fichier]) => fichier);
  const manquantes = declarees.filter((fichier) => !completes.includes(fichier));
  if (manquantes.length > 0) {
    throw new Error(`publication : étapes sans capture déposée, rien n’est publié : ${manquantes.join(', ')}`);
  }
  const enTrop = [...depots.keys()].filter((fichier) => !declarees.includes(fichier));
  if (enTrop.length > 0) throw new Error(`publication : captures déposées hors des déclarées : ${enTrop.join(', ')}`);

  const ancien = await manifesteDe(base);
  const anciennes = new Map((ancien?.captures ?? []).map((capture) => [capture?.fichier, capture]));
  const captures = [];
  const aEcrire = [];
  const gardees = [];
  for (const { fichier, etape } of CAPTURES.filter((capture) => declarees.includes(capture.fichier))) {
    const { png, json } = depots.get(fichier);
    const entree = JSON.parse(await readFile(json, 'utf8'));
    const octets = new Uint8Array(await readFile(png));
    if (entree.fichier !== fichier || entree.etape !== etape) {
      throw new Error(`publication : ${fichier} déposée sous le nom ${entree.fichier}, étape ${entree.etape} ; étape ${etape} déclarée`);
    }
    if (entree.empreinte !== empreinteEtape(entree)) throw new Error(`publication : ${fichier} : l’empreinte déposée ne répond pas à l’entrée`);
    const fautes = fautesDImage(entree, octets);
    if (fautes.length > 0) throw new Error(`publication : ${fichier} : ${fautes.map(({ faute }) => faute).join(' ; ')}`);
    const precedente = anciennes.get(fichier);
    const presente = await lireSiPresent(join(base, cheminImage(fichier)));
    if (precedente?.empreinte === entree.empreinte && presente !== null && sha256(presente) === precedente.image?.sha256) {
      captures.push({ ...entree, image: precedente.image });
      gardees.push(fichier);
    } else {
      captures.push(entree);
      aEcrire.push({ fichier, octets });
    }
  }

  // La clé reportees du format vaut toujours la liste vide (verifierOrdre).
  const manifeste = { format: 1, pilote: piloteDe(context, captures), captures, reportees: [] };
  const fautes = [
    ...verifierOrdre(manifeste, { etapes: etapesExigees(declarees) }),
    ...fautesDeMachine(manifeste, racineNeutre),
    ...fautesDIdentite(manifeste, machine, { sources }),
  ];
  if (fautes.length > 0) {
    throw new Error(`publication refusée :\n${fautes.map(({ chemin, faute }) => `${chemin} : ${faute}`).join('\n')}`);
  }

  let presentes;
  try {
    presentes = await readdir(join(base, DOSSIER_CAPTURES));
  } catch (erreur) {
    if (erreur.code !== 'ENOENT') throw erreur;
    presentes = [];
  }
  const retirees = presentes
    .filter((nom) => nom.endsWith('.png'))
    .map((nom) => nom.slice(0, -'.png'.length))
    .filter((fichier) => !declarees.includes(fichier))
    .sort();
  return { texte: canoniser(manifeste), aEcrire, gardees, retirees };
}

/**
 * Publie d'un bloc les captures déposées (§ 19.5) : declarees, les noms de
 * CAPTURES que cette publication porte — le contrôle d'ordre en tire les
 * étapes qu'il exige (etapesExigees) ; racineNeutre, la racine de travail
 * que les textes relevés peuvent nommer (fautesDeMachine). Le troisième
 * argument, que la page ne passe jamais, remplace l'identité de la machine
 * que fautesDIdentite cherche, machineCourante() par défaut ; les noms que
 * lireSourcesDuScenario porte déjà ne s'y cherchent pas. Le dossier
 * d'attente est jeté, que la publication réussisse ou non.
 *
 * @returns {Promise<{ecrites: string[], gardees: string[], retirees: string[], manifeste: boolean}>}
 *   manifeste : vrai quand ses octets ont changé
 */
export async function publierCaptures(context, { declarees, racine = null, racineNeutre } = {}, { machine = machineCourante() } = {}) {
  const base = racineDe(racine);
  try {
    const sources = await lireSourcesDuScenario();
    const { texte, aEcrire, gardees, retirees } = await preparer(context, base, declarees, racineNeutre, machine, sources);
    await mkdir(join(base, DOSSIER_CAPTURES), { recursive: true });
    for (const { fichier, octets } of aEcrire) await ecrireAtomique(join(base, cheminImage(fichier)), octets);
    for (const fichier of retirees) await rm(join(base, cheminImage(fichier)));
    const ancien = await lireSiPresent(join(base, CHEMIN_MANIFESTE), 'utf8');
    if (ancien !== texte) await ecrireAtomique(join(base, CHEMIN_MANIFESTE), texte);
    return { ecrites: aEcrire.map(({ fichier }) => fichier), gardees, retirees, manifeste: ancien !== texte };
  } finally {
    await rm(join(base, ATTENTE), { recursive: true, force: true });
  }
}

/** Vide le dossier d'attente de la racine : un parcours en écriture part
 *  de lui vide, et le dépôt d'un passage interrompu ne se publie jamais
 *  avec les captures d'un autre. */
export async function viderAttente(_context, { racine = null } = {}) {
  await rm(join(racineDe(racine), ATTENTE), { recursive: true, force: true });
}

/** Crée un dossier d'épreuve neuf, sous le dossier temporaire du système,
 *  et rend son chemin absolu : une racine que les autres commandes
 *  acceptent jusqu'à effacerDossierEpreuve. */
export async function dossierEpreuve() {
  const dossier = await mkdtemp(join(tmpdir(), 'gtt-captures-'));
  DOSSIERS_EPREUVE.add(dossier);
  return dossier;
}

/** Efface un dossier que dossierEpreuve a créé, et lui seul. */
export async function effacerDossierEpreuve(_context, racine) {
  if (!DOSSIERS_EPREUVE.has(racine)) throw new Error(`captures : « ${racine} » n’est pas un dossier d’épreuve vivant`);
  DOSSIERS_EPREUVE.delete(racine);
  await rm(racine, { recursive: true, force: true });
}

/**
 * Copie un fichier d'un dossier d'épreuve sur un autre chemin du même
 * dossier, les deux sous doc/captures : une image posée là où la
 * publication ne l'a pas mise. La racine du projet est refusée.
 *
 * @param {Object} _context
 * @param {{racine: string, depuis: string, vers: string}} chemins  relatifs à racine
 */
export async function copierDansEpreuve(_context, { racine, depuis, vers }) {
  if (!DOSSIERS_EPREUVE.has(racine)) throw new Error(`captures : « ${racine} » n’est pas un dossier d’épreuve vivant`);
  const captures = join(racine, DOSSIER_CAPTURES);
  const dedans = (chemin) => {
    const absolu = resolve(racine, String(chemin));
    const relatif = relative(captures, absolu);
    if (relatif === '' || relatif.startsWith('..') || isAbsolute(relatif)) {
      throw new Error(`captures : ${JSON.stringify(chemin)} hors de ${DOSSIER_CAPTURES}`);
    }
    return absolu;
  };
  const source = dedans(depuis);
  const cible = dedans(vers);
  await mkdir(dirname(cible), { recursive: true });
  await ecrireAtomique(cible, await readFile(source));
}

/** Les fichiers sous doc/captures de la racine, dossier d'attente compris :
 *  [chemin relatif à la racine, SHA-256], rangés par chemin. */
export async function empreintesDossier(_context, { racine = null } = {}) {
  const base = racineDe(racine);
  const fichiers = [];
  async function parcourir(dossier) {
    let entrees;
    try {
      entrees = await readdir(dossier, { withFileTypes: true });
    } catch (erreur) {
      if (erreur.code === 'ENOENT') return;
      throw erreur;
    }
    for (const entree of entrees) {
      const chemin = join(dossier, entree.name);
      if (entree.isDirectory()) await parcourir(chemin);
      else fichiers.push([relative(base, chemin).split('\\').join('/'), sha256(await readFile(chemin))]);
    }
  }
  await parcourir(join(base, DOSSIER_CAPTURES));
  return fichiers.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

// --- Le tramage des pages de la planche (§ 19.6) ---------------------------------

/** La résolution du tramage, en points par pouce : celle du pixel CSS, que
 *  mesurent les captures du navigateur. */
export const PPP_TRAMAGE = 96;

/** Le mode qu'inscrit l'entrée d'une page de PDF : le lecteur qui la trame et
 *  sa résolution, là où une capture du navigateur inscrit son mode
 *  d'affichage. */
export const MODE_TRAMAGE = `pdfjs-dist-${PPP_TRAMAGE}ppp`;

// Le canevas natif que pdfjs-dist charge pour tramer sous node, sa
// dépendance optionnelle ; le point PDF et le millimètre, par pouce.
const CANEVAS = '@napi-rs/canvas';
const PT_PAR_POUCE = 72;
const MM_PAR_POUCE = 25.4;

// Le chargeur CommonJS du paquet pdfjs-dist : un module qu'il résout est
// celui que pdfjs-dist charge lui-même.
const depuisPdfjs = () => createRequire(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));

// Les polices standard de pdfjs-dist, lues du disque quand un document en
// appelle une sans l'embarquer, comme test/pdf.js les lui donne.
const policesStandard = () => `${join(dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json')), 'standard_fonts')}/`;

/** Le canevas natif de pdfjs-dist, chargé depuis son paquet. Lève quand il
 *  manque, ou que sa liaison native n'existe pas pour ce système. */
export function chargerCanevas() {
  return depuisPdfjs()(CANEVAS);
}

/** Vrai quand le canevas natif de pdfjs-dist se charge sur ce système. */
export function canevasDisponible() {
  try {
    chargerCanevas();
    return true;
  } catch {
    return false;
  }
}

// Les octets que porte un texte base64 ; lève sur un texte vide ou qui
// n'est pas du base64 canonique, que la relecture ne rendrait pas tel quel.
function octetsDe(octetsB64) {
  if (typeof octetsB64 !== 'string' || octetsB64.length === 0) {
    throw new TypeError('tramerPdf : octetsB64 est le texte base64, non vide, du PDF');
  }
  const octets = Buffer.from(octetsB64, 'base64');
  if (octets.toString('base64') !== octetsB64) throw new TypeError('tramerPdf : octetsB64 n’est pas du base64');
  return new Uint8Array(octets.buffer, octets.byteOffset, octets.byteLength);
}

// Les pages demandées, [{page, fichier}] : au moins une, chaque nom de
// capture valide et une seule fois, chaque page un entier.
function pagesDemandees(pages) {
  if (!Array.isArray(pages) || pages.length === 0) throw new Error('tramerPdf : aucune page demandée');
  const vus = new Set();
  return pages.map(({ page, fichier }) => {
    exigerNom(fichier);
    if (vus.has(fichier)) throw new Error(`tramerPdf : « ${fichier} » demandée deux fois`);
    vus.add(fichier);
    if (!Number.isSafeInteger(page)) throw new TypeError(`tramerPdf : page ${JSON.stringify(page)}, un entier attendu`);
    return { page, fichier };
  });
}

// La taille en pixels d'une longueur en millimètres, à PPP_TRAMAGE.
const enPixels = (mm) => Math.round((mm * PPP_TRAMAGE) / MM_PAR_POUCE);

// Trame les pages données, [{page, cadre}], en PNG, dans l'ordre : chaque
// page sur un canevas de son cadre, fond blanc, à PPP_TRAMAGE. Rend leurs
// octets ; lève quand la page tramée n'a pas la taille de son cadre — une
// page tournée par /Rotate, que le cadre lu des boîtes ne suit pas.
async function tramerPages(octets, pages, canevas) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const tache = getDocument({
    data: new Uint8Array(octets),
    verbosity: 0,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    standardFontDataUrl: policesStandard(),
  });
  const document = await tache.promise;
  try {
    const images = [];
    for (const { page: rang, cadre } of pages) {
      const page = await document.getPage(rang);
      const viewport = page.getViewport({ scale: PPP_TRAMAGE / PT_PAR_POUCE });
      const largeur = Math.round(viewport.width);
      const hauteur = Math.round(viewport.height);
      if (largeur !== cadre.largeur || hauteur !== cadre.hauteur) {
        throw new Error(`tramerPdf : page ${rang} tramée à ${largeur} × ${hauteur}, son cadre est ${cadre.largeur} × ${cadre.hauteur}`);
      }
      const toile = canevas.createCanvas(largeur, hauteur);
      const contexte = toile.getContext('2d');
      await page.render({ canvasContext: contexte, canvas: toile, viewport, background: '#ffffff' }).promise;
      images.push(new Uint8Array(await toile.encode('png')));
    }
    return images;
  } finally {
    await tache.destroy();
  }
}

/**
 * Lit les pages demandées d'un PDF et, quand ecrire est vrai, les trame en
 * PNG sous le dossier d'attente de la racine, à <fichier>.png (§ 19.6).
 * Dans l'ordre : les pages demandées et les octets se contrôlent, le PDF se
 * lit (test/pdf.js), chaque page doit exister ; puis, en écriture, le
 * canevas se charge — absent, le refus le nomme et rien ne s'écrit —, toutes
 * les pages se trament, et alors seulement les images s'écrivent. Sans
 * écriture, aucun canevas n'est chargé.
 *
 * @param {{octetsB64: string, pages: Array<{page: number, fichier: string}>,
 *          racine?: string|null, ecrire?: boolean}} demande
 * @param {{chargerCanevas?: () => Object}} [options]  le chargeur du canevas
 * @returns {Promise<{pdf: string, mode: string, pages: Array<{fichier: string,
 *   page: number, cadre: {largeur: number, hauteur: number}, chemin: string|null,
 *   textes: string[], segments: Array<{x1: number, y1: number, x2: number, y2: number}>}>}>}
 *   pdf : le SHA-256 des octets ; cadre : la boîte de média à PPP_TRAMAGE,
 *   en pixels arrondis ; chemin : l'image écrite, null sans écriture ;
 *   textes : les fragments de la couche de texte, dans l'ordre du flux ;
 *   segments : les traits droits, en mm, l'origine au coin haut gauche
 */
export async function tramer({ octetsB64, pages, racine = null, ecrire = true }, { chargerCanevas: charger = chargerCanevas } = {}) {
  const base = racineDe(racine);
  const demandees = pagesDemandees(pages);
  const octets = octetsDe(octetsB64);
  const { lirePdf } = await import('../pdf.js');
  let lu;
  try {
    lu = await lirePdf(octets);
  } catch (erreur) {
    throw new Error(`tramerPdf : PDF illisible : ${erreur.message}`);
  }
  for (const { page } of demandees) {
    if (page < 1 || page > lu.pages.length) throw new Error(`tramerPdf : page ${page} hors du document de ${lu.pages.length} pages`);
  }
  const lues = demandees.map(({ page, fichier }) => {
    const { boite, textes, segments } = lu.pages[page - 1];
    return {
      fichier,
      page,
      cadre: { largeur: enPixels(boite.largeur), hauteur: enPixels(boite.hauteur) },
      chemin: null,
      textes: textes.map(({ texte }) => texte),
      segments,
    };
  });
  if (ecrire) {
    let canevas;
    try {
      canevas = charger();
    } catch (erreur) {
      throw new Error(
        `tramerPdf : le canevas « ${CANEVAS} » manque — make captures l’exige pour tramer les pages du PDF ; rien n’est écrit (${erreur.message})`,
      );
    }
    const images = await tramerPages(octets, lues, canevas);
    const dossier = join(base, ATTENTE);
    await mkdir(dossier, { recursive: true });
    for (const [rang, lue] of lues.entries()) {
      lue.chemin = join(dossier, `${lue.fichier}.png`);
      await ecrireAtomique(lue.chemin, images[rang]);
    }
  }
  return { pdf: sha256(octets), mode: MODE_TRAMAGE, pages: lues };
}

/**
 * La commande de la page : tramer, sur le PDF que la page passe en base64
 * (octetsB64) — aucun octet ne traverse en Uint8Array. Rend ce que le PDF
 * donne à lire et les chemins des images, jamais d'octets.
 */
export async function tramerPdf(_context, demande) {
  return tramer(demande ?? {});
}
