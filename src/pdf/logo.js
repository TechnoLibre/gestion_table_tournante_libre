// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La lecture du logo vectoriel que le pied TechnoLibre du badge dessine
// (§ 11.4) : les octets d'un fichier SVG, ceux de
// src/actifs/full_logo_technolibre_2023.svg, que la séance charge et passe à
// la production comme ceux de la police. Module pur, sans pdf-lib : il rend
// des formes, chacune une couleur et un tracé, que la planche dessine.
//
// Le lecteur ne connaît que ce qu'un logo plat demande : une racine <svg>,
// des <rect> et des <path> à plat sous elle, remplis d'une couleur unie
// (#rgb, #rrggbb, white, black), sans trait. Tout le reste — un autre
// élément, une transformation, une opacité, un style, une règle de
// remplissage pair-impair, un arc — se refuse, TypeError : un logo que
// l'éditeur changerait pour une forme que ce lecteur ne rend pas se dit à
// la première épreuve, au lieu de sortir faux sur les badges.
//
// Le tracé se ramène à quatre commandes absolues, dans le repère de la
// boîte de vue, origine en haut à gauche, y vers le bas : M, L, C (cubique)
// et Z. Les commandes relatives se rapportent au point courant ; H et V
// deviennent des L ; S et T reflètent le point de contrôle précédent ; Q et
// T deviennent des cubiques de même tracé.

/**
 * Un point du tracé : M et L vont en (x, y) ; C, cubique, par (x1, y1) et
 * (x2, y2) jusqu'en (x, y) ; Z ferme le sous-chemin.
 *
 * @typedef {{op: 'M'|'L', x: number, y: number}
 *   | {op: 'C', x1: number, y1: number, x2: number, y2: number, x: number, y: number}
 *   | {op: 'Z'}} Trace
 *
 * @typedef {Object} Logo
 * @property {number} largeur   celle de la boîte de vue
 * @property {number} hauteur
 * @property {Array<{couleur: [number, number, number], trace: Trace[]}>} formes
 *           dans l'ordre du fichier, chacune peinte sur les précédentes ;
 *           couleur : rouge, vert, bleu, de 0 à 1
 */

// Les attributs que chaque élément admet ; un autre attribut se refuse.
// stroke n'est admis qu'à « none », fill-rule et clip-rule qu'à « nonzero »,
// la règle du remplissage que la planche emploie.
const ATTRIBUTS = new Map([
  ['svg', new Set(['width', 'height', 'viewBox', 'fill', 'xmlns', 'xmlns:xlink', 'version', 'id'])],
  ['rect', new Set(['x', 'y', 'width', 'height', 'fill', 'stroke', 'fill-rule', 'clip-rule', 'id'])],
  ['path', new Set(['d', 'fill', 'stroke', 'fill-rule', 'clip-rule', 'id'])],
]);
const VALEURS_IMPOSEES = new Map([
  ['stroke', 'none'],
  ['fill-rule', 'nonzero'],
  ['clip-rule', 'nonzero'],
]);

// Les couleurs nommées que le lecteur connaît.
const COULEURS_NOMMEES = new Map([
  ['white', [1, 1, 1]],
  ['black', [0, 0, 0]],
]);

// Un nombre SVG : signe, partie entière ou décimale, exposant.
const NOMBRE = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?';
// Une dimension de la racine : un nombre positif, en px au plus.
const DIMENSION = new RegExp(`^(${NOMBRE})(?:px)?$`);
// Les jetons d'un chemin : une commande, un nombre, un séparateur, ou un
// caractère que la syntaxe n'admet pas.
const JETONS = new RegExp(`([MmLlHhVvCcSsQqTtZzAa])|(${NOMBRE})|([\\s,]+)|(.)`, 'gu');
// Le nombre de coordonnées de chaque commande, en majuscule.
const ARITES = new Map([
  ['M', 2],
  ['L', 2],
  ['T', 2],
  ['H', 1],
  ['V', 1],
  ['C', 6],
  ['S', 4],
  ['Q', 4],
]);

const refus = (message) => new TypeError(`lireLogo : ${message}`);

// Un nombre lu d'un attribut ; TypeError sinon.
function nombre(texte, nom) {
  const valeur = Number(texte);
  if (typeof texte !== 'string' || !new RegExp(`^${NOMBRE}$`).test(texte.trim()) || !Number.isFinite(valeur)) {
    throw refus(`${nom} : nombre attendu, reçu ${JSON.stringify(texte)}`);
  }
  return valeur;
}

// La couleur d'un remplissage : [r, g, b] de 0 à 1, null pour « none ».
function couleurDe(texte) {
  if (texte === 'none') return null;
  if (COULEURS_NOMMEES.has(texte)) return COULEURS_NOMMEES.get(texte);
  const court = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(texte);
  const long = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(texte);
  const chiffres = court === null ? long : court;
  if (chiffres === null) throw refus(`couleur ${JSON.stringify(texte)} non prise en charge`);
  return chiffres.slice(1).map((c) => Number.parseInt(c.length === 1 ? c + c : c, 16) / 255);
}

// Les éléments du fichier, dans l'ordre : {nom, attributs: Map, ferme}, et
// les fermetures, {fermeture: nom}. La déclaration XML et les commentaires
// se taisent ; un texte hors des balises, une déclaration ou un attribut
// mal formé se refusent.
function elements(texte) {
  const sansCommentaires = texte.replace(/<!--[\s\S]*?-->/g, ' ').replace(/^<\?xml[^>]*\?>/, ' ');
  const lus = [];
  let curseur = 0;
  for (const balise of sansCommentaires.matchAll(/<([^>]*)>/g)) {
    if (sansCommentaires.slice(curseur, balise.index).trim() !== '') throw refus('texte hors des balises');
    curseur = balise.index + balise[0].length;
    const contenu = balise[1].trim();
    const fermeture = /^\/([\w:-]+)$/.exec(contenu);
    if (fermeture !== null) {
      lus.push({ fermeture: fermeture[1] });
      continue;
    }
    const ouverture = /^([\w:-]+)((?:\s+[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)$/.exec(contenu);
    if (ouverture === null) throw refus(`balise mal formée <${contenu.slice(0, 40)}>`);
    const attributs = new Map();
    for (const [, nom, guillemets, apostrophes] of ouverture[2].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      if (attributs.has(nom)) throw refus(`attribut ${nom} en double`);
      attributs.set(nom, guillemets ?? apostrophes);
    }
    lus.push({ nom: ouverture[1], attributs, ferme: ouverture[3] === '/' });
  }
  if (sansCommentaires.slice(curseur).trim() !== '') throw refus('texte hors des balises');
  return lus;
}

// Les attributs d'un élément, contrôlés contre ceux qu'il admet.
function controlerAttributs({ nom, attributs }) {
  const admis = ATTRIBUTS.get(nom);
  if (admis === undefined) throw refus(`élément <${nom}> non pris en charge`);
  for (const [cle, valeur] of attributs) {
    if (!admis.has(cle)) throw refus(`attribut ${cle} de <${nom}> non pris en charge`);
    if (VALEURS_IMPOSEES.has(cle) && valeur !== VALEURS_IMPOSEES.get(cle)) {
      throw refus(`${cle}="${valeur}" de <${nom}> non pris en charge`);
    }
  }
}

// Les jetons d'un chemin : chaque commande, une lettre, et chaque nombre.
function jetons(d) {
  const lus = [];
  for (const [, lettre, valeur, , autre] of d.matchAll(JETONS)) {
    if (autre !== undefined) throw refus(`caractère ${JSON.stringify(autre)} dans un chemin`);
    if (lettre !== undefined) lus.push(lettre);
    else if (valeur !== undefined) lus.push(Number(valeur));
  }
  return lus;
}

/**
 * Le tracé d'un chemin SVG, en commandes absolues M, L, C et Z, décalé de
 * (ox, oy).
 *
 * @param {string} d
 * @returns {Trace[]}
 * @throws {TypeError} un chemin vide, qui ne s'ouvre pas sur M, un arc, une
 *         commande inconnue, un nombre manquant
 */
function tracerChemin(d, ox, oy) {
  const lus = jetons(d);
  if (lus.length === 0 || (lus[0] !== 'M' && lus[0] !== 'm')) throw refus(`chemin qui ne s'ouvre pas sur M : ${JSON.stringify(d.slice(0, 40))}`);
  const trace = [];
  let [cx, cy] = [0, 0];
  let [dx, dy] = [0, 0];
  // Le second point de contrôle de la dernière cubique, et le point de
  // contrôle de la dernière quadratique ; null après toute autre commande.
  let controleC = null;
  let controleQ = null;
  let commande = null;
  let i = 0;
  const cubique = (x1, y1, x2, y2, x, y) => {
    trace.push({ op: 'C', x1: x1 - ox, y1: y1 - oy, x2: x2 - ox, y2: y2 - oy, x: x - ox, y: y - oy });
    controleC = [x2, y2];
    [cx, cy] = [x, y];
  };
  // Une quadratique de contrôle (qx, qy), comme la cubique de même tracé.
  const quadratique = (qx, qy, x, y) => {
    const [x0, y0] = [cx, cy];
    cubique(x0 + (2 / 3) * (qx - x0), y0 + (2 / 3) * (qy - y0), x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), x, y);
    controleQ = [qx, qy];
    controleC = null;
  };
  while (i < lus.length) {
    if (typeof lus[i] === 'string') {
      commande = lus[i];
      i += 1;
      if (commande === 'A' || commande === 'a') throw refus('arc non pris en charge');
      if (commande === 'Z' || commande === 'z') {
        trace.push({ op: 'Z' });
        [cx, cy] = [dx, dy];
        controleC = null;
        controleQ = null;
        commande = null;
        continue;
      }
    } else if (commande === null) {
      throw refus(`nombre sans commande dans un chemin : ${JSON.stringify(d.slice(0, 40))}`);
    }
    const majuscule = commande.toUpperCase();
    const relatif = commande !== majuscule;
    const arite = ARITES.get(majuscule);
    const valeurs = lus.slice(i, i + arite);
    if (valeurs.length < arite || valeurs.some((v) => typeof v !== 'number')) {
      throw refus(`commande ${commande} à qui il manque des nombres`);
    }
    i += arite;
    // Les points de la commande, absolus : chaque paire, rapportée au point
    // courant pour une commande relative.
    const points = [];
    for (let k = 0; k + 1 < valeurs.length; k += 2) {
      points.push(relatif ? [cx + valeurs[k], cy + valeurs[k + 1]] : [valeurs[k], valeurs[k + 1]]);
    }
    const avantC = controleC;
    const avantQ = controleQ;
    controleC = null;
    controleQ = null;
    if (majuscule === 'M') {
      [[cx, cy]] = points;
      [dx, dy] = [cx, cy];
      trace.push({ op: 'M', x: cx - ox, y: cy - oy });
      // Les coordonnées qui suivent un M sans lettre sont des L.
      commande = relatif ? 'l' : 'L';
    } else if (majuscule === 'L' || majuscule === 'H' || majuscule === 'V') {
      if (majuscule === 'H') cx = relatif ? cx + valeurs[0] : valeurs[0];
      else if (majuscule === 'V') cy = relatif ? cy + valeurs[0] : valeurs[0];
      else [[cx, cy]] = points;
      trace.push({ op: 'L', x: cx - ox, y: cy - oy });
    } else if (majuscule === 'C') {
      cubique(...points[0], ...points[1], ...points[2]);
    } else if (majuscule === 'S') {
      const premier = avantC === null ? [cx, cy] : [2 * cx - avantC[0], 2 * cy - avantC[1]];
      cubique(...premier, ...points[0], ...points[1]);
    } else if (majuscule === 'Q') {
      quadratique(...points[0], ...points[1]);
    } else {
      const controle = avantQ === null ? [cx, cy] : [2 * cx - avantQ[0], 2 * cy - avantQ[1]];
      quadratique(...controle, ...points[0]);
    }
  }
  return trace;
}

/**
 * Le logo d'un fichier SVG plat : ses dimensions, celles de la boîte de vue
 * — à défaut, width et height —, et ses formes, rect et path dans l'ordre
 * du fichier, chacune de sa couleur de remplissage — à défaut celle de la
 * racine, à défaut le noir ; une forme de remplissage « none » ne se rend
 * pas. Les coordonnées partent de l'origine de la boîte de vue.
 *
 * @param {Uint8Array} octets   le fichier, en UTF-8 ; non modifié
 * @returns {Logo}
 * @throws {TypeError} des octets qui ne sont pas un SVG que ce lecteur rend
 *         fidèlement
 */
export function lireLogo(octets) {
  if (!(octets instanceof Uint8Array)) throw refus('les octets du fichier SVG attendus');
  let texte;
  try {
    texte = new TextDecoder('utf-8', { fatal: true }).decode(octets);
  } catch {
    throw refus("fichier qui n'est pas de l'UTF-8");
  }
  const lus = elements(texte);
  const racine = lus[0];
  if (racine?.nom !== 'svg' || racine.ferme) throw refus('une racine <svg> attendue');
  controlerAttributs(racine);
  let boite;
  if (racine.attributs.has('viewBox')) {
    const valeurs = racine.attributs.get('viewBox').trim().split(/[\s,]+/);
    if (valeurs.length !== 4) throw refus('viewBox : quatre nombres attendus');
    boite = valeurs.map((v) => nombre(v, 'viewBox'));
  } else {
    const dimension = (nom) => {
      const lu = DIMENSION.exec(racine.attributs.get(nom) ?? '');
      if (lu === null) throw refus(`${nom} : sans viewBox, une dimension attendue`);
      return Number(lu[1]);
    };
    boite = [0, 0, dimension('width'), dimension('height')];
  }
  const [ox, oy, largeur, hauteur] = boite;
  if (!(largeur > 0 && hauteur > 0)) throw refus('dimensions positives attendues');
  const remplissage = racine.attributs.has('fill') ? couleurDe(racine.attributs.get('fill')) : [0, 0, 0];

  const formes = [];
  const fin = lus.at(-1);
  if (lus.length < 2 || fin.fermeture !== 'svg') throw refus('la racine <svg> doit se fermer à la fin du fichier');
  for (const element of lus.slice(1, -1)) {
    if (element.fermeture !== undefined || !element.ferme) {
      throw refus(`élément <${element.nom ?? `/${element.fermeture}`}> non pris en charge sous la racine`);
    }
    controlerAttributs(element);
    if (element.nom === 'svg') throw refus('élément <svg> non pris en charge sous la racine');
    const { attributs } = element;
    const couleur = attributs.has('fill') ? couleurDe(attributs.get('fill')) : remplissage;
    if (couleur === null) continue;
    let trace;
    if (element.nom === 'rect') {
      const lire = (nom, defaut) => (attributs.has(nom) ? nombre(attributs.get(nom), nom) : defaut);
      const [x, y, l, h] = [lire('x', 0), lire('y', 0), lire('width', null), lire('height', null)];
      if (!(l > 0 && h > 0)) throw refus('<rect> : width et height positifs attendus');
      trace = [
        { op: 'M', x: x - ox, y: y - oy },
        { op: 'L', x: x + l - ox, y: y - oy },
        { op: 'L', x: x + l - ox, y: y + h - oy },
        { op: 'L', x: x - ox, y: y + h - oy },
        { op: 'Z' },
      ];
    } else {
      trace = tracerChemin(attributs.get('d') ?? '', ox, oy);
    }
    formes.push({ couleur: [...couleur], trace });
  }
  return { largeur, hauteur, formes };
}
