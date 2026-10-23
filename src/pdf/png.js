// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La lecture d'un PNG (§ 8.9, PNG 1.2 / ISO 15948) : sa structure, sans
// décoder l'image. lirePng contrôle la signature, puis chaque morceau —
// longueur, type, CRC —, l'en-tête IHDR en premier, une palette avant les
// données sous le type de couleur 3, des IDAT qui se suivent, un IEND vide
// en dernier et rien après lui, et rend la largeur et la hauteur de l'IHDR.
// Les données compressées ne s'ouvrent pas : un PNG bien formé ici peut
// encore porter des pixels que zlib refuse.
//
// Module pur : il n'importe rien, ne lit ni horloge ni aléa, et ne modifie
// pas les octets reçus. La séance le lit au dépôt d'un logo, la planche à
// son analyse.

// Les huit octets qui ouvrent tout PNG.
const SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

// La plus grande longueur d'un morceau et la plus grande dimension d'une
// image : 2^31 − 1, la borne du format.
const BORNE = 2 ** 31 - 1;

// Les profondeurs admises par type de couleur (PNG 1.2, § 4.1.1) : gris,
// RVB, palette, gris et alpha, RVBA.
const PROFONDEURS = new Map([
  [0, [1, 2, 4, 8, 16]],
  [2, [8, 16]],
  [3, [1, 2, 4, 8]],
  [4, [8, 16]],
  [6, [8, 16]],
]);

// La table du CRC-32 de PNG (polynôme réfléchi 0xEDB88320), une entrée par
// valeur d'octet.
const TABLE_CRC = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

// Le CRC-32 des octets [debut, fin[.
function crc(octets, debut, fin) {
  let c = 0xffffffff;
  for (let i = debut; i < fin; i += 1) c = TABLE_CRC[(c ^ octets[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Un type de morceau : quatre lettres ASCII, capitales ou minuscules.
const estLettre = (octet) => (octet >= 0x41 && octet <= 0x5a) || (octet >= 0x61 && octet <= 0x7a);

/**
 * Ce qui rend des octets autres qu'un PNG bien formé. raison :
 * - SIGNATURE : les huit premiers octets ne sont pas ceux d'un PNG ;
 * - TRONQUE : un morceau dépasse la fin, ou la fin vient sans IEND ;
 * - CRC : le CRC d'un morceau ne correspond pas à son type et ses données ;
 * - IHDR : le premier morceau n'est pas un IHDR de treize octets, ou une
 *   dimension, la profondeur, le type de couleur, la compression, le filtre
 *   ou l'entrelacement sont hors de leurs règles ;
 * - STRUCTURE : un second IHDR, aucun IDAT, des IDAT séparés, une palette
 *   absente ou après les données sous le type 3, un IEND non vide, des
 *   octets après lui, un type qui n'est pas en lettres, une longueur
 *   au-delà de 2^31 − 1.
 * Le message, la raison puis le détail, sert aux traces.
 */
export class ErreurPng extends Error {
  /**
   * @param {'SIGNATURE'|'TRONQUE'|'CRC'|'IHDR'|'STRUCTURE'} raison
   * @param {string} detail
   */
  constructor(raison, detail) {
    super(`${raison} ${detail}`);
    this.raison = raison;
  }
}
ErreurPng.prototype.name = 'ErreurPng';

// Contrôle les treize octets de l'IHDR qui commencent à debut, et rend ses
// dimensions.
function lireEntete(vue, debut) {
  const largeur = vue.getUint32(debut);
  const hauteur = vue.getUint32(debut + 4);
  if (largeur === 0 || hauteur === 0 || largeur > BORNE || hauteur > BORNE) {
    throw new ErreurPng('IHDR', `dimensions ${largeur} × ${hauteur} hors de 1 à ${BORNE}`);
  }
  const profondeur = vue.getUint8(debut + 8);
  const couleur = vue.getUint8(debut + 9);
  if (!(PROFONDEURS.get(couleur)?.includes(profondeur) ?? false)) {
    throw new ErreurPng('IHDR', `profondeur ${profondeur} sous le type de couleur ${couleur}`);
  }
  const [compression, filtre, entrelacement] = [10, 11, 12].map((decalage) => vue.getUint8(debut + decalage));
  if (compression !== 0 || filtre !== 0 || entrelacement > 1) {
    throw new ErreurPng('IHDR', `compression ${compression}, filtre ${filtre}, entrelacement ${entrelacement}`);
  }
  return { largeur, hauteur, couleur };
}

/**
 * Les dimensions d'un PNG bien formé, en pixels : celles de son IHDR. Seuls
 * comptent les octets de la vue reçue, qui reste telle.
 *
 * @param {Uint8Array} octets
 * @returns {{largeur: number, hauteur: number}}
 * @throws {TypeError} des octets d'une autre forme qu'un Uint8Array
 * @throws {ErreurPng} des octets qui ne sont pas un PNG bien formé
 */
export function lirePng(octets) {
  if (!(octets instanceof Uint8Array)) {
    throw new TypeError(`octets : Uint8Array attendu, reçu ${Object.prototype.toString.call(octets)}`);
  }
  if (octets.length < SIGNATURE.length || SIGNATURE.some((octet, rang) => octets[rang] !== octet)) {
    throw new ErreurPng('SIGNATURE', 'les octets ne commencent pas par la signature PNG');
  }
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  let position = SIGNATURE.length;
  let entete = null;
  let palette = false;
  // Les IDAT : aucun vu, en cours, ou finis par un autre morceau.
  let donnees = 'aucune';
  for (;;) {
    if (position + 8 > octets.length) throw new ErreurPng('TRONQUE', `la fin vient à l'octet ${octets.length} sans IEND`);
    const longueur = vue.getUint32(position);
    if (longueur > BORNE) throw new ErreurPng('STRUCTURE', `longueur ${longueur} à l'octet ${position}`);
    const fin = position + 8 + longueur + 4;
    if (fin > octets.length) throw new ErreurPng('TRONQUE', `le morceau de l'octet ${position} finirait à ${fin}`);
    const lettres = octets.subarray(position + 4, position + 8);
    if (!lettres.every(estLettre)) throw new ErreurPng('STRUCTURE', `type illisible à l'octet ${position}`);
    if (crc(octets, position + 4, fin - 4) !== vue.getUint32(fin - 4)) {
      throw new ErreurPng('CRC', `morceau de l'octet ${position}`);
    }
    const type = String.fromCharCode(...lettres);
    if (entete === null) {
      if (type !== 'IHDR' || longueur !== 13) throw new ErreurPng('IHDR', `premier morceau ${type} de ${longueur} octets`);
      entete = lireEntete(vue, position + 8);
    } else if (type === 'IHDR') {
      throw new ErreurPng('STRUCTURE', `second IHDR à l'octet ${position}`);
    } else if (type === 'PLTE') {
      if (donnees !== 'aucune') throw new ErreurPng('STRUCTURE', `palette après les données, à l'octet ${position}`);
      palette = true;
    } else if (type === 'IDAT') {
      if (donnees === 'finies') throw new ErreurPng('STRUCTURE', `IDAT séparé, à l'octet ${position}`);
      if (entete.couleur === 3 && !palette) throw new ErreurPng('STRUCTURE', 'type de couleur 3 sans palette');
      donnees = 'en cours';
    } else if (type === 'IEND') {
      if (longueur !== 0) throw new ErreurPng('STRUCTURE', `IEND de ${longueur} octets`);
      if (donnees === 'aucune') throw new ErreurPng('STRUCTURE', 'aucun IDAT');
      if (fin !== octets.length) throw new ErreurPng('STRUCTURE', `${octets.length - fin} octets après IEND`);
      return { largeur: entete.largeur, hauteur: entete.hauteur };
    }
    if (type !== 'IDAT' && donnees === 'en cours') donnees = 'finies';
    position = fin;
  }
}
