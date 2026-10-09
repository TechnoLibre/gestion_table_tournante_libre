// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

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
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  A_VENIR,
  CAPTURES,
  CHEMIN_MANIFESTE,
  DOSSIER_CAPTURES,
  REPORTEES,
  canoniser,
  cheminImage,
  cheminsHorsRacine as cheminsHors,
  empreinteEtape,
  fautesDImage,
  fautesDeMachine,
  lireEntetePng,
  verifierOrdre,
} from '../../scripts/documentation/manifeste.js';
import { MODE_AFFICHAGE, suivreRequetes } from '../chromium.js';

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

/** Les captures déclarées (CAPTURES) et celles qui sont à venir (A_VENIR) :
 *  la page ne charge pas scripts/documentation/manifeste.js, qui est de node. */
export async function declarationsCaptures() {
  return { captures: CAPTURES.map((capture) => ({ ...capture })), aVenir: [...A_VENIR] };
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

// Le pilote du manifeste : le navigateur et sa version, le mode nommé, le
// facteur d'échelle et le cadre, communs à toutes les captures.
function piloteDe(context, captures) {
  const [premiere] = captures;
  for (const capture of captures) {
    if (capture.facteurEchelle !== premiere.facteurEchelle || canonique(capture.cadre) !== canonique(premiere.cadre)) {
      throw new Error(`publication : ${capture.fichier} n’a pas le cadre ni le facteur d’échelle de ${premiere.fichier}`);
    }
  }
  const versionNavigateur = context.page.context().browser()?.version() ?? 'inconnue';
  return {
    navigateur: 'chromium',
    versionNavigateur,
    mode: MODE_AFFICHAGE,
    facteurEchelle: premiere.facteurEchelle,
    cadre: { largeur: premiere.cadre.largeur, hauteur: premiere.cadre.hauteur },
  };
}

// Assemble la publication sans rien écrire : le manifeste, les images à
// écrire, les images à retirer. Lève sur la première raison de refuser.
async function preparer(context, base, declarees, racineNeutre) {
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

  const manifeste = { format: 1, pilote: piloteDe(context, captures), captures, reportees: REPORTEES.map((r) => ({ ...r })) };
  const aVenir = CAPTURES.map(({ fichier }) => fichier).filter((fichier) => !declarees.includes(fichier));
  const fautes = [...verifierOrdre(manifeste, { aVenir }), ...fautesDeMachine(manifeste, racineNeutre)];
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
 * CAPTURES que cette publication porte — les autres comptent comme à venir
 * au contrôle d'ordre ; racineNeutre, la racine de travail que les textes
 * relevés peuvent nommer (fautesDeMachine). Le dossier d'attente est jeté,
 * que la publication réussisse ou non.
 *
 * @returns {Promise<{ecrites: string[], gardees: string[], retirees: string[], manifeste: boolean}>}
 *   manifeste : vrai quand ses octets ont changé
 */
export async function publierCaptures(context, { declarees, racine = null, racineNeutre } = {}) {
  const base = racineDe(racine);
  try {
    const { texte, aEcrire, gardees, retirees } = await preparer(context, base, declarees, racineNeutre);
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
