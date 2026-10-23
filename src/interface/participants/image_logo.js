// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La conversion de l'image qu'on choisit pour logo d'une personne en PNG
// (§ 8.9, § 10.2), dans le moteur de rendu : la séance n'écrit qu'un PNG
// d'au plus LOGO_PARTICIPANT_COTE_MAX pixels de côté (seance.js), et c'est
// ici qu'il se compose. Toute image que le moteur décode — PNG, JPEG, GIF
// (sa première image), WebP, AVIF, BMP, ICO, SVG — s'accepte ; HEIC et
// TIFF, qu'il ne décode pas, se refusent comme des octets illisibles.
//
// Une image matricielle se mesure d'abord par un élément <img> hors du
// document, qui lit ses dimensions sans en décoder les pixels : une source
// de plus de LOGO_PIXELS_MAX pixels se refuse avant tout décodage. Elle se
// décode ensuite par createImageBitmap sous imageOrientation 'from-image' :
// l'orientation EXIF d'une photo s'applique, et la taille retenue est celle
// de l'image redressée. Son PNG garde sa taille quand son plus grand côté
// tient dans le plafond, et se réduit sinon, proportions gardées : jamais
// agrandi. Un SVG, que createImageBitmap ne décode pas, se dessine par
// l'élément <img> même ; sans résolution propre, il se rastérise à son plus
// grand côté au plafond, dans les proportions de ses dimensions naturelles
// — celles que le moteur tire de sa largeur et de sa hauteur, ou de sa
// viewBox ; un SVG sans dimensions naturelles se refuse comme illisible.
// Une image chargée par <img> n'exécute aucun script et ne charge aucune
// ressource externe.
//
// Le PNG sort d'un OffscreenCanvas, lissage de haute qualité, par
// convertToBlob : la transparence passe, le profil de couleur se perd au
// profit de sRGB. Les mêmes octets source ne donnent pas forcément les
// mêmes octets PNG d'une version du moteur à l'autre : rien n'en dépend.
// L'adresse blob: de l'élément <img> et l'ImageBitmap se libèrent quoi
// qu'il arrive.
//
// Les règles de taille, la reconnaissance d'un SVG et le plafond des pixels
// sont pures et s'éprouvent sous node ; convertirLogo demande un moteur de
// rendu.
import { ErreurCommande } from '../../application/erreurs.js';
import { LOGO_PARTICIPANT_COTE_MAX } from '../../application/seance.js';

/**
 * Codes d'un refus que la conversion lève elle-même, leur texte dans
 * src/application/libelles/participants.js :
 *   LOGO_ILLISIBLE {fichier, remede} : le moteur ne décode pas les octets
 *     choisis — HEIC, TIFF, fichier abîmé ou qui n'est pas une image ;
 *     fichier, le nom du fichier choisi ; remède null.
 *   LOGO_TROP_GRAND {fichier, largeur, hauteur, max, remede} : la source
 *     compte plus de max pixels, largeur × hauteur ; elle n'est pas
 *     décodée ; remède null.
 */

/** Le plus grand nombre de pixels d'une image source : une photo de 48
 *  millions de pixels passe, une image dont le décodage occuperait plus de
 *  200 Mo se refuse. */
export const LOGO_PIXELS_MAX = 50_000_000;

// Les signatures des images matricielles que le moteur décode, qui priment
// sur l'extension « .svg » : PNG, JPEG, GIF, BMP, ICO, puis WebP et AVIF par
// leurs octets 8 à 11 et 4 à 7.
const SIGNATURES_MATRICIELLES = [
  [0, [0x89, 0x50, 0x4e, 0x47]],
  [0, [0xff, 0xd8, 0xff]],
  [0, [0x47, 0x49, 0x46, 0x38]],
  [0, [0x42, 0x4d]],
  [0, [0x00, 0x00, 0x01, 0x00]],
  [8, [0x57, 0x45, 0x42, 0x50]],
  [4, [0x66, 0x74, 0x79, 0x70]],
];

// Vrai quand les octets portent la signature d'une image matricielle.
function estMatricielle(octets) {
  return SIGNATURES_MATRICIELLES.some(([debut, signature]) => signature.every((o, i) => octets[debut + i] === o));
}

// Les premiers octets qu'on lit pour reconnaître un SVG.
const TETE_SVG = 4096;

// Un texte de balisage qui s'ouvre sur une déclaration XML, un commentaire
// ou un DOCTYPE, puis sur la balise <svg>.
const DEBUT_SVG = /^\s*(?:<\?xml[^>]*>\s*|<!--[\s\S]*?-->\s*|<!DOCTYPE[^>]*>\s*)*<svg[\s/>]/i;

// Un côté valide : un entier strictement positif, sinon TypeError.
function exigerCote(valeur, nom) {
  if (!Number.isInteger(valeur) || valeur <= 0) {
    throw new TypeError(`${nom} : entier strictement positif attendu, reçu ${String(valeur)}`);
  }
}

// La taille dont le plus grand côté vaut cote, proportions gardées ; un
// côté arrondi au pixel, au moins un.
function aCote(largeur, hauteur, cote) {
  const facteur = cote / Math.max(largeur, hauteur);
  return {
    largeur: largeur >= hauteur ? cote : Math.max(1, Math.round(largeur * facteur)),
    hauteur: hauteur > largeur ? cote : Math.max(1, Math.round(hauteur * facteur)),
  };
}

/**
 * La taille du PNG d'une image matricielle de largeur × hauteur pixels : la
 * même quand son plus grand côté tient dans LOGO_PARTICIPANT_COTE_MAX,
 * sinon réduite à ce plus grand côté, proportions gardées, l'autre côté
 * arrondi, d'au moins un pixel. Jamais agrandie. Un côté qui n'est pas un
 * entier strictement positif lève TypeError.
 *
 * @param {number} largeur
 * @param {number} hauteur
 * @returns {{largeur: number, hauteur: number}}
 */
export function tailleDuLogo(largeur, hauteur) {
  exigerCote(largeur, 'largeur');
  exigerCote(hauteur, 'hauteur');
  if (Math.max(largeur, hauteur) <= LOGO_PARTICIPANT_COTE_MAX) return { largeur, hauteur };
  return aCote(largeur, hauteur, LOGO_PARTICIPANT_COTE_MAX);
}

/**
 * La taille du PNG d'un SVG dont les proportions sont largeur × hauteur :
 * son plus grand côté à LOGO_PARTICIPANT_COTE_MAX, plus petit ou plus
 * grand — un dessin vectoriel n'a pas de résolution propre, et rien ne s'y
 * perd. Un côté qui n'est pas un entier strictement positif lève TypeError.
 *
 * @param {number} largeur
 * @param {number} hauteur
 * @returns {{largeur: number, hauteur: number}}
 */
export function tailleDuSvg(largeur, hauteur) {
  exigerCote(largeur, 'largeur');
  exigerCote(hauteur, 'hauteur');
  return aCote(largeur, hauteur, LOGO_PARTICIPANT_COTE_MAX);
}

/**
 * Vrai quand le fichier est un SVG : ses octets ne portent la signature
 * d'aucune image matricielle (PNG, JPEG, GIF, BMP, ICO, WebP, AVIF), et son
 * nom finit par « .svg », casse ignorée, ou ses TETE_SVG premiers octets, lus en UTF-8, s'ouvrent — BOM,
 * blancs, déclaration XML, commentaires et DOCTYPE passés — sur la balise
 * <svg>. Le moteur ne reconnaît un SVG que sous son type déclaré.
 *
 * @param {Uint8Array} octets
 * @param {string|null} fichier
 * @returns {boolean}
 */
export function estSvg(octets, fichier) {
  if (estMatricielle(octets)) return false;
  if (typeof fichier === 'string' && /\.svg$/i.test(fichier)) return true;
  const tete = new TextDecoder('utf-8', { ignoreBOM: false }).decode(octets.subarray(0, TETE_SVG));
  return DEBUT_SVG.test(tete);
}

/**
 * Refuse une source de plus de max pixels : LOGO_TROP_GRAND {fichier,
 * largeur, hauteur, max, remede: null}.
 *
 * @param {number} largeur
 * @param {number} hauteur
 * @param {string} fichier
 * @param {number} [max]
 */
export function exigerPixels(largeur, hauteur, fichier, max = LOGO_PIXELS_MAX) {
  if (largeur * hauteur <= max) return;
  throw new ErreurCommande('LOGO_TROP_GRAND', { fichier, largeur, hauteur, max, remede: null });
}

// Le refus d'octets que le moteur ne décode pas.
const illisible = (fichier) => new ErreurCommande('LOGO_ILLISIBLE', { fichier, remede: null });

// L'élément <img> chargé depuis adresse, hors du document ; une image que
// le moteur ne lit pas rejette.
function chargerImage(adresse) {
  return new Promise((resoudre, rejeter) => {
    const element = new Image();
    element.onload = () => resoudre(element);
    element.onerror = () => rejeter(new Error('image illisible'));
    element.src = adresse;
  });
}

// Les proportions d'un SVG chargé, ses dimensions naturelles ; null quand
// le moteur ne lui en donne pas.
function proportionsDuSvg(element) {
  const { naturalWidth: largeur, naturalHeight: hauteur } = element;
  return largeur > 0 && hauteur > 0 ? { largeur, hauteur } : null;
}

// Les octets PNG de source dessinée à largeur × hauteur.
async function encoderPng(source, { largeur, hauteur }) {
  const canevas = new OffscreenCanvas(largeur, hauteur);
  const contexte = canevas.getContext('2d');
  contexte.imageSmoothingEnabled = true;
  contexte.imageSmoothingQuality = 'high';
  contexte.drawImage(source, 0, 0, largeur, hauteur);
  const blob = await canevas.convertToBlob({ type: 'image/png' });
  return new Uint8Array(await blob.arrayBuffer());
}

// encoderPng, dont un refus du moteur — canevas qu'il n'alloue pas, SVG
// qu'il refuse de lire, encodage qui échoue (DOMException) — se refuse
// comme illisible ; toute autre erreur passe.
async function encoderOuRefuser(source, taille, fichier) {
  try {
    return await encoderPng(source, taille);
  } catch (erreur) {
    if (erreur instanceof DOMException) throw illisible(fichier);
    throw erreur;
  }
}

/**
 * Le PNG du logo composé depuis les octets d'une image choisie : d'au plus
 * LOGO_PARTICIPANT_COTE_MAX pixels de côté, orientation EXIF appliquée,
 * transparence gardée (voir l'en-tête du module). Refuse par
 * ErreurCommande LOGO_ILLISIBLE des octets que le moteur ne décode pas, et
 * LOGO_TROP_GRAND une source de plus de pixelsMax pixels, sans la décoder.
 * Des octets qui ne sont pas un Uint8Array lèvent TypeError.
 *
 * @param {Uint8Array} octets
 * @param {{fichier: string, pixelsMax?: number}} options
 *        fichier, le nom du fichier choisi, que les refus nomment ;
 *        pixelsMax, le plafond des pixels de la source
 * @returns {Promise<Uint8Array>}
 */
export async function convertirLogo(octets, { fichier, pixelsMax = LOGO_PIXELS_MAX }) {
  if (!(octets instanceof Uint8Array)) throw new TypeError('octets : Uint8Array attendu');
  const svg = estSvg(octets, fichier);
  const blob = new Blob([octets], svg ? { type: 'image/svg+xml' } : {});
  const adresse = URL.createObjectURL(blob);
  let bitmap = null;
  try {
    let element;
    try {
      element = await chargerImage(adresse);
    } catch {
      throw illisible(fichier);
    }
    if (svg) {
      const proportions = proportionsDuSvg(element);
      if (proportions === null) throw illisible(fichier);
      return await encoderOuRefuser(element, tailleDuSvg(proportions.largeur, proportions.hauteur), fichier);
    }
    exigerPixels(element.naturalWidth, element.naturalHeight, fichier, pixelsMax);
    try {
      bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      throw illisible(fichier);
    }
    return await encoderOuRefuser(bitmap, tailleDuLogo(bitmap.width, bitmap.height), fichier);
  } finally {
    bitmap?.close();
    URL.revokeObjectURL(adresse);
  }
}
