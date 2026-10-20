// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le manifeste des captures et ses contrôles du niveau node (§ 19.3, § 19.5,
// § 19.7). Pur : aucune lecture de fichier, aucune horloge. L'appelant lit le
// manifeste, la documentation et le dossier des images, puis passe leurs
// contenus ; chaque contrôle rend la liste de ses fautes, vide quand tout
// tient, et refuse de passer sur un balayage vide.
//
// Un nom de capture (« fichier ») n'a pas d'extension : l'image est
// doc/captures/<fichier>.png. L'ordre déclaré des captures et des reportées
// est celui de leurs noms, comparés unité de code par unité de code : le
// préfixe NN, puis « a », « b », range chaque entrée à sa place dans le guide.
//
// Une faute est { chemin, faute } : le chemin du fichier en cause, relatif à
// la racine du projet (l'image d'une capture, le manifeste, un document), et
// la nature de la faute en toutes lettres.
import { createHash } from 'node:crypto';
import { VERSION } from '../../src/version.genere.js';

/** @typedef {{chemin: string, faute: string}} Faute */

export const DOSSIER_CAPTURES = 'doc/captures';
export const CHEMIN_MANIFESTE = `${DOSSIER_CAPTURES}/manifeste.json`;

/** Chemin de l'image d'une capture, relatif à la racine du projet. */
export function cheminImage(fichier) {
  return `${DOSSIER_CAPTURES}/${fichier}.png`;
}

// Les treize étapes du parcours de l'opérateur (§ 2.1), dans leur ordre : la
// seule source de l'ordre des captures (§ 19.3).
export const ETAPES = Object.freeze(['1', '1b', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);

const capture = (fichier, etape, configuration, source = 'navigateur') => Object.freeze({ fichier, etape, configuration, source });

// La table du § 19.3 en données, avec 02b, 07a et 07b, et les quatre captures
// des étiquettes, des objectifs et de l'ordre des priorités : 04a, 05a, 05b,
// 10a (A22). « configuration » nomme ce que la capture exige : le répertoire
// neuf, le fichier d'import d'exemples/, l'identifiant de démonstration du
// catalogue, l'événement que le parcours construit puis retient, ou, préfixée
// de « construite- », une configuration qu'un scénario court du parcours
// construit. L'étape place une capture dans le guide, la configuration dit
// sur quoi elle se prend : les deux 07a, à l'étape 4, se photographient sur
// la grande démonstration que le parcours charge pour 10 ; 05b, sur
// l'exemple des objectifs importé dans l'événement construit ; 10a, à
// l'étape 9 où l'ordre des priorités se règle à côté de la génération
// (§ 2.1).
//
// Les captures de la page de qualité, 12 à 16 et leurs voisines en « a » à
// « g » (B27), illustrent l'étape 10 et se prennent à la fin du parcours,
// chacune sur sa charge : la grande démonstration, la petite, sa variante
// « conflit inévitable », l'événement construit, ou l'une des six
// configurations construites — les cinq cas limites 12b à 12e et 12g, et
// les paires de 14 et 14a.
//
// Les captures de la dérivée et de la comparaison (D81) se prennent après
// elles, sur la grande démonstration sans exception que le parcours charge
// depuis le premier écran : 11a et 11b, à l'étape 9 où l'on repart d'une
// proposition, puis 17, 17a et 18, la vue de comparaison de la page de
// qualité, à l'étape 10 : ses courbes qui se croisent, ses colonnes côte à
// côte, son escalier. La vue d'historique, 21, se photographie à l'étape 11
// sur l'événement retenu, après l'ajustement et la lecture.
//
// Les captures de la présence par tour se prennent les dernières, sur la
// configuration construite « construite-presence » : la petite
// démonstration générée, n° 1 retenue, une personne dite présente aux
// tours 1 et 2 par la grille, une personne ajoutée dite présente aux tours 3
// et 4 par sa fiche. Chacune illustre son étape : 02c, l'aperçu du modèle
// de participants téléchargé, à l'étape 2 ; 04b et 04c, la saisie dans la
// grille et dans la fiche, à l'étape 3 ; 11c, la dérivée d'un départ que ce
// changement de participants a mis en dérive, à l'étape 9 ; 12h, la page de
// qualité de la meilleure dérivée, à l'étape 10 ; 19a, le retenu ajusté au
// plan, à l'étape 11 ; 25a, la réédition des badges de ces deux personnes,
// tramée du PDF, à l'étape 12.
export const CAPTURES = Object.freeze([
  capture('01-premier-ecran', '1', 'repertoire-neuf'),
  capture('01b-passer-en-ecriture', '1b', 'repertoire-neuf'),
  capture('02-import-apercu', '2', 'participants_cas_limites.csv'),
  capture('02b-import-cp1252', '2', 'participants_cas_limites_cp1252.csv'),
  capture('02c-import-presence', '2', 'construite-presence'),
  capture('03-import-rapport', '2', 'participants_cas_limites.csv'),
  capture('04-grille-participants', '3', 'evenement-construit'),
  capture('04a-etiquettes', '3', 'evenement-construit'),
  capture('04b-presence-grille', '3', 'construite-presence'),
  capture('04c-presence-fiche', '3', 'construite-presence'),
  capture('05-tables-etat', '4', 'evenement-construit'),
  capture('05a-objectifs-tables', '4', 'evenement-construit'),
  capture('05b-import-objectifs', '4', 'objectifs_cas_limites.csv'),
  capture('06-defaut-consequence', '4', 'evenement-construit'),
  capture('07-plan-tables', '4', 'evenement-construit'),
  capture('07a-cibles-sieges', '4', 'grande'),
  capture('07a-cibles-tables', '4', 'grande'),
  capture('07b-nombre-de-tours', '5', 'evenement-construit'),
  capture('08-animateurs-designes', '6', 'evenement-construit'),
  capture('09-refus-sur-place', '7', 'evenement-construit'),
  capture('10-diagnostic', '8', 'grande'),
  capture('10a-ordre-priorites', '9', 'evenement-construit'),
  capture('11-propositions', '9', 'evenement-construit'),
  capture('11a-depart-derive', '9', 'grande-sans-exception'),
  capture('11b-propositions-derivees', '9', 'grande-sans-exception'),
  capture('11c-derivee-presence', '9', 'construite-presence'),
  capture('12-qualite-profil', '10', 'grande'),
  capture('12a-qualite-sans-placement', '10', 'petite-conflit'),
  capture('12b-qualite-une-table', '10', 'construite-une-table'),
  capture('12c-qualite-un-tour', '10', 'construite-un-tour'),
  capture('12d-qualite-une-appartenance', '10', 'construite-une-organisation'),
  capture('12e-qualite-sans-collision', '10', 'construite-sans-collision'),
  capture('12f-qualite-reserve', '10', 'petite-conflit'),
  capture('12g-qualite-plafond-nul', '10', 'construite-plafond-nul'),
  capture('12h-qualite-absence', '10', 'construite-presence'),
  capture('13-qualite-collisions', '10', 'petite-conflit'),
  capture('13a-qualite-tables', '10', 'petite-conflit'),
  capture('14-qualite-paires', '10', 'construite-paires'),
  capture('14a-fiche-rencontres', '10', 'construite-paires'),
  capture('15-pas-de-matrice', '10', 'grande'),
  capture('15a-qualite-objectifs', '10', 'evenement-construit'),
  capture('15b-qualite-animateurs', '10', 'grande'),
  capture('15c-qualite-performance', '10', 'grande'),
  capture('16-minimum-atteint', '10', 'petite'),
  capture('17-comparaison-manque', '10', 'grande-sans-exception'),
  capture('17a-comparaison-colonnes', '10', 'grande-sans-exception'),
  capture('18-comparaison-escalier', '10', 'grande-sans-exception'),
  capture('19-ajustement', '11', 'evenement-retenu'),
  capture('19a-presence-plan', '11', 'construite-presence'),
  capture('20-mode-lecture', '11', 'evenement-retenu'),
  capture('21-historique', '11', 'evenement-retenu'),
  capture('22-plan-brouillon', '12', 'evenement-retenu'),
  capture('23-plan-retenu', '12', 'evenement-retenu'),
  capture('24-badges-controle', '12', 'evenement-retenu', 'pdf'),
  capture('25-badges-planche', '12', 'evenement-retenu', 'pdf'),
  capture('25a-badge-absente', '12', 'construite-presence', 'pdf'),
]);

// Les captures des écrans que le logiciel n'offre pas encore, chacune
// { fichier, etape, raison } : déclarées à leur étape, sans image ; le
// contrôle d'ordre les compte comme présentes. Vide : chaque écran déclaré
// existe et se photographie.
export const REPORTEES = Object.freeze([]);

// Captures déclarées dans CAPTURES et pas encore photographiées : la
// publication et le contrôle d'ordre les admettent absentes du manifeste.
// Vide : le parcours photographie chaque capture déclarée.
export const A_VENIR = Object.freeze([]);

// --- Forme canonique et empreintes ---------------------------------------------

const comparer = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function estObjet(valeur) {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);
}

// JSON d'une valeur, les clés de chaque objet triées par unités de code, sans
// espace. Lève TypeError sur ce que JSON ne porte pas fidèlement : undefined,
// fonction, symbole, grand entier, nombre non fini.
function json(valeur) {
  if (valeur === null || typeof valeur === 'string' || typeof valeur === 'boolean') return JSON.stringify(valeur);
  if (typeof valeur === 'number') {
    if (!Number.isFinite(valeur)) throw new TypeError(`nombre non fini dans le manifeste : ${valeur}`);
    return JSON.stringify(valeur);
  }
  if (Array.isArray(valeur)) return `[${valeur.map(json).join(',')}]`;
  if (estObjet(valeur)) {
    const cles = Object.keys(valeur).sort(comparer);
    return `{${cles.map((cle) => `${JSON.stringify(cle)}:${json(valeur[cle])}`).join(',')}}`;
  }
  throw new TypeError(`valeur que JSON ne porte pas dans le manifeste : ${typeof valeur}`);
}

const sha256 = (donnees) => createHash('sha256').update(donnees).digest('hex');

/**
 * Le manifeste en JSON canonique : clés triées à toute profondeur, chaque
 * élément d'un tableau de premier niveau sur sa ligne (une capture, une
 * reportée), le reste sur la ligne de sa clé, une fin de ligne finale. Deux
 * manifestes égaux rendent les mêmes octets, quel que soit l'ordre de leurs
 * clés ; l'ordre des tableaux est conservé.
 * @param {object} manifeste
 * @returns {string}
 */
export function canoniser(manifeste) {
  if (!estObjet(manifeste)) throw new TypeError('le manifeste est un objet');
  const champs = Object.keys(manifeste).sort(comparer).map((cle) => {
    const valeur = manifeste[cle];
    const tete = `${JSON.stringify(cle)}:`;
    if (Array.isArray(valeur) && valeur.length > 0) return `${tete}[\n${valeur.map(json).join(',\n')}\n]`;
    return tete + json(valeur);
  });
  return `{${champs.join(',')}}\n`;
}

/**
 * Empreinte d'étape (§ 19.5, amendé) : SHA-256 hexadécimal du JSON canonique
 * de l'entrée, sans image, empreinte, versionReelle ni versionNavigateur, à
 * plat ou sous pilote. La version réelle et celle du navigateur changent
 * d'une livraison et d'un poste à l'autre sans que l'état montré change :
 * les garder réécrirait chaque image à chaque incrément.
 * @param {object} entree  une entrée de manifeste.captures
 * @returns {string}
 */
export function empreinteEtape(entree) {
  if (!estObjet(entree)) throw new TypeError('une entrée de manifeste est un objet');
  const { image: _image, empreinte: _empreinte, versionReelle: _version, versionNavigateur: _navigateur, ...reste } = entree;
  if (estObjet(reste.pilote)) {
    const { versionNavigateur: _versionPilote, ...pilote } = reste.pilote;
    reste.pilote = pilote;
  }
  return sha256(json(reste));
}

// --- Appariement documentation, manifeste, disque --------------------------------

const MOTIF_REFERENCE = /doc\/captures\/[A-Za-z0-9._-]+\.png/g;

/**
 * Les images de doc/captures qu'un document référence, sous la forme
 * doc/captures/<nom>.png quel que soit le préfixe relatif qui les précède,
 * chacune une fois, dans l'ordre de leur première apparition.
 * @param {string} texte
 * @returns {string[]}
 */
export function imagesReferencees(texte) {
  if (typeof texte !== 'string') throw new TypeError('le texte d’un document est une chaîne');
  return [...new Set(texte.match(MOTIF_REFERENCE) ?? [])];
}

function exigerTableau(valeur, nom) {
  if (!Array.isArray(valeur)) throw new TypeError(`${nom} est un tableau`);
}

function capturesDe(manifeste) {
  if (!estObjet(manifeste)) throw new TypeError('le manifeste est un objet');
  const captures = manifeste.captures ?? [];
  exigerTableau(captures, 'manifeste.captures');
  return captures;
}

const enListe = (parties) => (parties.length === 1 ? parties[0] : `${parties.slice(0, -1).join(', ')} et ${parties.at(-1)}`);

/**
 * L'appariement du § 19.7 : toute image référencée par la documentation a
 * son entrée au manifeste et son fichier, toute entrée et tout fichier sont
 * référencés. Une image absente d'un côté au moins est une orpheline : une
 * faute par image, qui dit où elle est et d'où elle manque. Un manifeste sans
 * capture, une documentation vide, un document sans image, un dossier sans
 * image sont chacun une faute.
 * @param {{manifeste: object, references: Array<{document: string, images: string[]}>, images: string[]}} entrees
 *        references : par document, les chemins doc/captures/<nom>.png qu'il
 *        référence ; images : les chemins des PNG présents sur le disque
 * @returns {Faute[]}  les balayages vides, puis les images par chemin
 */
export function verifierAppariement({ manifeste, references, images }) {
  const captures = capturesDe(manifeste);
  exigerTableau(references, 'references');
  exigerTableau(images, 'images');
  const fautes = [];
  if (captures.length === 0) fautes.push({ chemin: CHEMIN_MANIFESTE, faute: 'aucune capture au manifeste' });
  if (references.length === 0) fautes.push({ chemin: CHEMIN_MANIFESTE, faute: 'aucun document ne référence d’image' });
  if (images.length === 0) fautes.push({ chemin: DOSSIER_CAPTURES, faute: 'aucune image sur le disque' });

  const documentsDe = new Map();
  for (const { document, images: referencees } of references) {
    exigerTableau(referencees, `les images de ${document}`);
    if (referencees.length === 0) fautes.push({ chemin: document, faute: 'aucune image référencée' });
    for (const image of referencees) {
      const documents = documentsDe.get(image) ?? [];
      if (!documents.includes(document)) documents.push(document);
      documentsDe.set(image, documents);
    }
  }
  const auManifeste = new Set();
  const doubles = new Set();
  for (const entree of captures) {
    const chemin = cheminImage(entree.fichier);
    if (auManifeste.has(chemin)) doubles.add(chemin);
    auManifeste.add(chemin);
  }
  const surDisque = new Set(images);

  const tous = [...new Set([...documentsDe.keys(), ...auManifeste, ...surDisque])].sort(comparer);
  for (const chemin of tous) {
    if (doubles.has(chemin)) fautes.push({ chemin, faute: 'deux fois au manifeste' });
    const presences = [];
    const absences = [];
    if (documentsDe.has(chemin)) presences.push(`référencée par ${documentsDe.get(chemin).join(', ')}`);
    else absences.push('de la documentation');
    if (auManifeste.has(chemin)) presences.push('au manifeste');
    else absences.push('du manifeste');
    if (surDisque.has(chemin)) presences.push('sur le disque');
    else absences.push('du disque');
    if (absences.length > 0) fautes.push({ chemin, faute: `orpheline : ${presences.join(', ')} ; absente ${enListe(absences)}` });
  }
  return fautes;
}

// --- Ordre contre les étapes ------------------------------------------------------

/**
 * Le contrôle d'ordre du § 19.3 : les captures et les reportées du
 * manifeste, plus chaque capture d'aVenir absente du manifeste à son étape
 * déclarée dans CAPTURES, rangées par nom. Faute : une étape hors d'ETAPES ;
 * un nom déclaré deux fois ; une entrée dont l'étape précède celle de
 * l'entrée connue qui la devance ; une étape d'ETAPES sans aucune entrée ; un
 * manifeste sans aucune entrée.
 * @param {object} manifeste
 * @param {{aVenir?: readonly string[]}} [options]  A_VENIR par défaut
 * @returns {Faute[]}  les fautes d'entrée dans l'ordre des noms, puis les étapes manquantes
 */
export function verifierOrdre(manifeste, { aVenir = A_VENIR } = {}) {
  const captures = capturesDe(manifeste);
  const reportees = manifeste.reportees ?? [];
  exigerTableau(reportees, 'manifeste.reportees');
  const presentes = new Set(captures.map((c) => c.fichier));
  const admises = CAPTURES.filter((c) => aVenir.includes(c.fichier) && !presentes.has(c.fichier));
  const entrees = [...captures, ...reportees, ...admises]
    .map(({ fichier, etape }) => ({ fichier, etape }))
    .sort((a, b) => comparer(a.fichier, b.fichier));

  const fautes = [];
  if (entrees.length === 0) fautes.push({ chemin: CHEMIN_MANIFESTE, faute: 'aucune capture ni reportée' });
  const vues = new Set();
  const couvertes = new Set();
  let precedente = null;
  for (const entree of entrees) {
    const chemin = cheminImage(entree.fichier);
    if (vues.has(entree.fichier)) fautes.push({ chemin, faute: 'déclarée deux fois' });
    vues.add(entree.fichier);
    const rang = ETAPES.indexOf(entree.etape);
    if (rang < 0) {
      fautes.push({ chemin, faute: `étape inconnue « ${entree.etape} »` });
      continue;
    }
    couvertes.add(entree.etape);
    if (precedente !== null && rang < precedente.rang) {
      fautes.push({
        chemin,
        faute: `étape ${entree.etape} après ${precedente.fichier}, de l’étape ${precedente.etape} : l’ordre contredit les étapes`,
      });
    }
    precedente = { ...entree, rang };
  }
  for (const etape of ETAPES) {
    if (!couvertes.has(etape)) fautes.push({ chemin: CHEMIN_MANIFESTE, faute: `étape ${etape} : aucune capture ni reportée` });
  }
  return fautes;
}

// --- Version ----------------------------------------------------------------------

/**
 * Écart entre la version réelle inscrite au manifeste et celle de la
 * construction (§ 19.7) : null quand chaque capture porte la version
 * attendue ; sinon { manifeste, construction }, où manifeste nomme les
 * versions distinctes des captures, dans leur ordre, séparées par « , »
 * (« absente » pour une capture qui n'en porte pas), et vaut null pour un
 * manifeste sans capture, qui n'établit aucune version.
 * @param {object} manifeste
 * @param {string} [version]  VERSION.affichee par défaut
 * @returns {null | {manifeste: string|null, construction: string}}
 */
export function ecartDeVersion(manifeste, version = VERSION.affichee) {
  if (typeof version !== 'string') throw new TypeError('la version de la construction est une chaîne');
  const captures = capturesDe(manifeste);
  if (captures.length === 0) return { manifeste: null, construction: version };
  const versions = [...new Set(captures.map((c) => (typeof c.versionReelle === 'string' ? c.versionReelle : 'absente')))];
  if (versions.length === 1 && versions[0] === version) return null;
  return { manifeste: versions.join(', '), construction: version };
}

// --- Image --------------------------------------------------------------------------

const SIGNATURE_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const LIMITE_PNG = 2 ** 31 - 1;

/**
 * Largeur et hauteur d'un PNG, lues dans son morceau IHDR, qui suit la
 * signature (octets 16 à 23, gros-boutiste). Lève sur une signature fausse,
 * un en-tête tronqué, un premier morceau qui n'est pas un IHDR de 13 octets,
 * une dimension nulle ou au-delà de 2³¹ − 1.
 * @param {Uint8Array} octets
 * @returns {{largeur: number, hauteur: number}}
 */
export function lireEntetePng(octets) {
  if (!(octets instanceof Uint8Array)) throw new TypeError('les octets d’une image sont un Uint8Array');
  if (octets.length < SIGNATURE_PNG.length || SIGNATURE_PNG.some((octet, rang) => octets[rang] !== octet)) {
    throw new Error('signature PNG absente');
  }
  if (octets.length < 24) throw new Error(`en-tête PNG tronqué : ${octets.length} octets`);
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  const type = String.fromCharCode(...octets.subarray(12, 16));
  if (vue.getUint32(8) !== 13 || type !== 'IHDR') throw new Error('premier morceau PNG autre qu’un IHDR de 13 octets');
  const largeur = vue.getUint32(16);
  const hauteur = vue.getUint32(20);
  if (largeur === 0 || largeur > LIMITE_PNG) throw new Error(`largeur PNG hors domaine : ${largeur}`);
  if (hauteur === 0 || hauteur > LIMITE_PNG) throw new Error(`hauteur PNG hors domaine : ${hauteur}`);
  return { largeur, hauteur };
}

/**
 * Les fautes du fichier image d'une entrée : son SHA-256 diffère de
 * image.sha256 (une image remplacée, par une version antérieure ou par une
 * autre) ; il ne se lit pas comme un PNG ; ses dimensions diffèrent du cadre
 * multiplié par le facteur d'échelle (arrondi à l'entier), ou de celles
 * qu'inscrit image. Le contrôle porte sur les octets du fichier, jamais sur
 * des pixels (§ 19.4).
 * @param {object} entree  une entrée de manifeste.captures
 * @param {Uint8Array} octets  le contenu du fichier
 * @returns {Faute[]}
 */
export function fautesDImage(entree, octets) {
  if (!estObjet(entree)) throw new TypeError('une entrée de manifeste est un objet');
  const chemin = cheminImage(entree.fichier);
  const image = estObjet(entree.image) ? entree.image : {};
  const fautes = [];
  if (sha256(octets) !== image.sha256) fautes.push({ chemin, faute: 'image remplacée : son empreinte diffère de celle du manifeste' });
  let lue;
  try {
    lue = lireEntetePng(octets);
  } catch (erreur) {
    fautes.push({ chemin, faute: `illisible : ${erreur.message}` });
    return fautes;
  }
  const facteur = entree.facteurEchelle;
  const largeur = Math.round(entree.cadre?.largeur * facteur);
  const hauteur = Math.round(entree.cadre?.hauteur * facteur);
  if (lue.largeur !== largeur || lue.hauteur !== hauteur) {
    fautes.push({ chemin, faute: `dimensions ${lue.largeur} × ${lue.hauteur}, attendues ${largeur} × ${hauteur} (cadre × facteur)` });
  }
  if (lue.largeur !== image.largeur || lue.hauteur !== image.hauteur) {
    fautes.push({ chemin, faute: `dimensions ${lue.largeur} × ${lue.hauteur}, le manifeste inscrit ${image.largeur} × ${image.hauteur}` });
  }
  return fautes;
}

// --- Chemins hors de la racine neutre --------------------------------------------------

// Un chemin absolu commence en début de texte ou après l'un de ces
// caractères. Le deux-points en est (« poste:/home/… ») : le « // » d'une
// adresse web reste écarté, car une barre suivie d'une barre n'ouvre pas un
// chemin POSIX et un chemin réseau ne suit pas un deux-points. Un chiffre,
// une lettre, un point ou une barre avant « / » font une fraction ou un
// chemin relatif.
const AVANT_CHEMIN = new Set([...' \t\n\r\f\v([{<"\'«“‘=,;:>', '\u{a0}', '\u{202f}']);
// Le schéma d'une adresse de fichier, comparé sans casse.
const SCHEMA_FICHIER = 'file://';
// Un chemin s'arrête à un blanc ou à l'un de ces caractères…
const FIN_CHEMIN = new Set([...'"\'<>|«»“”‘', '\u{a0}', '\u{202f}']);
// … et perd la ponctuation qui le suit dans la phrase.
const PONCTUATION_FINALE = new Set([...'.,;:!?)]}»’”']);

const estBlanc = (caractere) => /\s/u.test(caractere);
const estLettre = (caractere) => /^[A-Za-z]$/.test(caractere);

// La forme d'un chemin absolu qui commence à la position rang : 'windows'
// (lecteur, chemin réseau sous l'une ou l'autre barre), 'posix' (racine,
// dossier personnel abrégé), 'fichier' (adresse file://, quoi qui la
// précède), ou null.
function formeEn(texte, rang) {
  if (texte.slice(rang, rang + SCHEMA_FICHIER.length).toLowerCase() === SCHEMA_FICHIER) return 'fichier';
  const avant = rang === 0 ? null : texte[rang - 1];
  const borne = avant === null || AVANT_CHEMIN.has(avant) || estBlanc(avant);
  const c = texte[rang];
  const suivant = texte[rang + 1];
  if (estLettre(c) && suivant === ':' && (texte[rang + 2] === '\\' || texte[rang + 2] === '/')) {
    return borne ? 'windows' : null;
  }
  if (!borne) return null;
  const troisieme = texte[rang + 2];
  const ouvreReseau = (barre) => c === barre && suivant === barre && troisieme !== undefined && troisieme !== barre && !estBlanc(troisieme);
  if (ouvreReseau('\\') || (avant !== ':' && ouvreReseau('/'))) return 'windows';
  if (c === '/' && suivant !== undefined && suivant !== '/' && !estBlanc(suivant)) return 'posix';
  if (c === '~' && /^~[A-Za-z0-9._-]*\//.test(texte.slice(rang, rang + 64))) return 'posix';
  return null;
}

function finDuJeton(texte, debut) {
  let fin = debut;
  while (fin < texte.length && !estBlanc(texte[fin]) && !FIN_CHEMIN.has(texte[fin])) fin += 1;
  while (fin > debut && PONCTUATION_FINALE.has(texte[fin - 1])) fin -= 1;
  return fin;
}

// Le chemin que porte une adresse file:// et sa forme : « file:///C:/… »
// donne un lecteur, « file:///… » un chemin POSIX, « file://hôte/… » un
// chemin réseau. Les séquences %XX sont décodées ; une séquence invalide
// laisse le chemin tel qu'écrit.
function cheminDeFichier(adresse) {
  const reste = adresse.slice(SCHEMA_FICHIER.length - 2);
  let chemin = reste.startsWith('///') ? reste.slice(2) : reste;
  try {
    chemin = decodeURIComponent(chemin);
  } catch {
    // le chemin reste encodé, et se compare tel quel
  }
  if (/^\/[A-Za-z]:[\\/]/.test(chemin)) return { forme: 'windows', chemin: chemin.slice(1) };
  if (chemin.startsWith('//')) return { forme: 'windows', chemin };
  return { forme: 'posix', chemin };
}

const normaliserWindows = (chemin) => chemin.replaceAll('/', '\\').toLowerCase();
const estSeparateur = (caractere) => caractere === '/' || caractere === '\\';

function formeDeRacine(racine) {
  if (typeof racine !== 'string' || racine.length === 0) throw new TypeError('la racine neutre est un chemin absolu non vide');
  if (/^[A-Za-z]:[\\/]/.test(racine) || racine.startsWith('\\\\')) return 'windows';
  if (racine.startsWith('/')) return 'posix';
  throw new TypeError(`la racine neutre n’est pas un chemin absolu : « ${racine} »`);
}

// La racine sans ses séparateurs finaux, sauf celui d'une racine de lecteur
// ou de système (« C:\ », « / »).
function sansSeparateurFinal(racine) {
  let fin = racine.length;
  while (fin > 1 && estSeparateur(racine[fin - 1]) && !/^[A-Za-z]:$/.test(racine.slice(0, fin - 1))) fin -= 1;
  return racine.slice(0, fin);
}

/**
 * Les chemins absolus d'un texte qui ne sont ni la racine neutre ni sous
 * elle (§ 19.4) : chemins de lecteur et réseau de Windows, chemins POSIX,
 * dossier personnel abrégé « ~/ », adresses file://. Une adresse se juge
 * sur le chemin décodé qu'elle porte et se relève telle qu'écrite. Sous
 * Windows, la comparaison ignore la casse et le sens des barres. La racine
 * se reconnaît entière même quand elle porte une espace ; un autre chemin
 * s'arrête au premier blanc, ce qui suffit à relever la part qui nomme un
 * compte. Chaque chemin relevé une fois, dans l'ordre du texte.
 * @param {string} texte
 * @param {string} racine  la racine neutre, absolue
 * @returns {string[]}
 */
export function cheminsHorsRacine(texte, racine) {
  if (typeof texte !== 'string') throw new TypeError('le texte relevé est une chaîne');
  const formeRacine = formeDeRacine(racine);
  const base = sansSeparateurFinal(racine);
  const commeRacine = formeRacine === 'windows' ? normaliserWindows : (chemin) => chemin;
  const baseComparee = commeRacine(base);
  const sousLaRacine = (chemin) => {
    if (commeRacine(chemin.slice(0, base.length)) !== baseComparee) return false;
    const reste = chemin.slice(base.length);
    return reste === '' || estSeparateur(reste[0]) || estSeparateur(base.at(-1));
  };
  const releves = [];
  let rang = 0;
  while (rang < texte.length) {
    const forme = formeEn(texte, rang);
    if (forme === null) {
      rang += 1;
      continue;
    }
    let fin;
    let dessous;
    if (forme === 'fichier') {
      fin = finDuJeton(texte, rang);
      const porte = cheminDeFichier(texte.slice(rang, fin));
      dessous = porte.forme === formeRacine && sousLaRacine(porte.chemin);
    } else {
      // La racine se reconnaît avant la coupe au blanc, qu'elle peut porter.
      const aLaRacine = forme === formeRacine && commeRacine(texte.slice(rang, rang + base.length)) === baseComparee;
      fin = finDuJeton(texte, aLaRacine ? rang + base.length : rang);
      dessous = aLaRacine && sousLaRacine(texte.slice(rang, fin));
    }
    if (!dessous) {
      const chemin = texte.slice(rang, fin);
      if (!releves.includes(chemin)) releves.push(chemin);
    }
    rang = Math.max(fin, rang + 1);
  }
  return releves;
}

// --- Un relevé ne nomme pas sa machine (contrainte 27) ---------------------------------

const CLES_MANIFESTE = ['captures', 'format', 'pilote', 'reportees'];
const CLES_PILOTE = ['cadre', 'facteurEchelle', 'mode', 'navigateur', 'versionNavigateur'];
const CLES_CADRE = ['hauteur', 'largeur'];
const CLES_CAPTURE = [
  'cadre', 'empreinte', 'etape', 'etat', 'facteurEchelle', 'fichier', 'graine', 'image',
  'instant', 'mode', 'pdf', 'source', 'styles', 'texte', 'theme', 'versionReelle',
];
const CLES_IMAGE = ['hauteur', 'largeur', 'sha256'];
const CLES_REPORTEE = ['etape', 'fichier', 'raison'];

function clesHorsContrat(objet, permises, prefixe) {
  if (!estObjet(objet)) return [];
  return Object.keys(objet)
    .filter((cle) => !permises.includes(cle))
    .sort(comparer)
    .map((cle) => `clé hors du contrat : « ${prefixe}${cle} »`);
}

function chainesDe(valeur) {
  if (typeof valeur === 'string') return [valeur];
  if (Array.isArray(valeur)) return valeur.flatMap(chainesDe);
  if (estObjet(valeur)) return Object.keys(valeur).sort(comparer).flatMap((cle) => [cle, ...chainesDe(valeur[cle])]);
  return [];
}

function cheminsDe(valeur, racine) {
  const releves = chainesDe(valeur).flatMap((chaine) => cheminsHorsRacine(chaine, racine));
  return [...new Set(releves)].map((chemin) => `chemin hors de la racine neutre : « ${chemin} »`);
}

/**
 * La garde de la contrainte 27 : un manifeste ne nomme ni son hôte, ni un
 * compte, ni un utilisateur, ni une date de la machine. Les clés du
 * manifeste, du pilote, de chaque capture, de son cadre et de son image, et
 * de chaque reportée forment des listes fermées, celles du contrat : un
 * champ « hote » ou « date » est une clé hors du contrat. Toute chaîne, clés
 * comprises, est passée à cheminsHorsRacine.
 * @param {object} manifeste
 * @param {string} racine  la racine neutre des captures
 * @returns {Faute[]}  le manifeste et son pilote, puis chaque capture et chaque reportée, dans leur ordre
 */
export function fautesDeMachine(manifeste, racine) {
  const captures = capturesDe(manifeste);
  const reportees = manifeste.reportees ?? [];
  exigerTableau(reportees, 'manifeste.reportees');
  const fautes = [];
  const ajouter = (chemin, natures) => {
    for (const faute of natures) fautes.push({ chemin, faute });
  };
  const { captures: _captures, reportees: _reportees, ...tete } = manifeste;
  ajouter(CHEMIN_MANIFESTE, [
    ...clesHorsContrat(manifeste, CLES_MANIFESTE, ''),
    ...clesHorsContrat(manifeste.pilote, CLES_PILOTE, 'pilote.'),
    ...clesHorsContrat(manifeste.pilote?.cadre, CLES_CADRE, 'pilote.cadre.'),
    ...cheminsDe(tete, racine),
  ]);
  for (const entree of captures) {
    ajouter(cheminImage(entree?.fichier), [
      ...clesHorsContrat(entree, CLES_CAPTURE, ''),
      ...clesHorsContrat(entree?.cadre, CLES_CADRE, 'cadre.'),
      ...clesHorsContrat(entree?.image, CLES_IMAGE, 'image.'),
      ...cheminsDe(entree, racine),
    ]);
  }
  for (const entree of reportees) {
    ajouter(cheminImage(entree?.fichier), [...clesHorsContrat(entree, CLES_REPORTEE, ''), ...cheminsDe(entree, racine)]);
  }
  return fautes;
}
