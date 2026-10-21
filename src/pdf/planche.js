// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La production de la planche de badges (§ 11.1 à § 11.4) : le seul PDF du
// logiciel, dessiné en mémoire par pdf-lib depuis le modèle, jamais depuis
// le DOM. Les deux entrées partent des octets des polices : la couche
// application ne voit jamais un objet de pdf-lib. Ce module ne compose
// aucun mot : les textes du badge, les lignes de la feuille de contrôle et
// le mot du filigrane lui arrivent composés ; il n'écrit de lui-même que les
// nombres de la graduation.
//
// Le document de l'A6 : page 1, la feuille de contrôle, qui ne se découpe
// pas ; puis une page par planche, dans l'ordre d'imposer. Celui d'un
// modèle à cartes prédécoupées — Avery 5392 — ne porte que ses feuilles de
// cartes, sans filet : sa feuille de contrôle est un second document
// (produireControle), à imprimer sur papier ordinaire, qui trace aussi le
// contour des cartes à leur place exacte. Les cotes se posent en
// millimètres, origine en haut à gauche de la feuille, et se convertissent
// en points au seul moment d'écrire : aucune matrice d'échelle (cm) n'entre
// dans le flux, ni CropBox, ni UserUnit — une transformation posée dans le
// flux ne se verrait sur aucune boîte de page, et la planche sortirait à la
// mauvaise taille sans qu'un contrôle des boîtes ne le dise. Un texte tourné
// l'est par sa matrice de texte (Tm), qui ne touche pas les chemins. Le
// texte s'écrit par ses opérateurs (BT, Tf, Tm, Tj, ET), tel que la police
// l'encode, comme la mise en page l'a mesuré : chaque police entre une fois
// dans les ressources de chaque page.
//
// Les octets ne dépendent que des entrées : pdf-lib tire les suffixes de ses
// noms de ressources d'un générateur à graine fixe, créé avec le document ;
// la date du document vient de l'horodatage du placement, jamais d'une
// horloge ; ni Producer, ni Creator, ni ModDate, ni /ID.
import fontkit from '@pdf-lib/fontkit';
import {
  PDFDocument,
  PDFName,
  PDFString,
  TextRenderingMode,
  beginText,
  endText,
  grayscale,
  popGraphicsState,
  pushGraphicsState,
  setFontAndSize,
  setLineWidth,
  setStrokingGrayscaleColor,
  setTextMatrix,
  setTextRenderingMode,
  showText,
} from 'pdf-lib';
import { constante } from '../geometrie/constantes.js';
import { MODELES_BADGE, PAPIERS, estModeleBadge } from '../geometrie/papiers.js';
import { cadreUtile, cellules, filets, imposer } from './imposition.js';
import { mettreEnPage, metriquesDe } from './mise_en_page.js';

/**
 * Ce que la production lit du modèle de la planche, ModelePlanche de
 * src/application/planche.js, que src/pdf n'importe pas.
 *
 * @typedef {Object} ModelePlanche
 * @property {Array<{textes: {nom: string, lignes: string[], abregeables?: Array<Array<{debut: number, fin: number}>>,
 *            organisation: string|null, pied: string[], piedReduit: string[]}}>} badges
 *           dans l'ordre de la pile ; abregeables, les textes libres de chaque
 *           ligne de tour, que la mise en page abrège au plancher
 * @property {string|null} horodatage   l'horodatage du placement ; null : inconnu
 * @property {boolean} brouillon
 */

/** Le millimètre en points typographiques. */
const PT_PAR_MM = 72 / 25.4;

/** Les impositions que la planche connaît (§ 11.6). */
const IMPOSITIONS = new Set(['feuille', 'pile']);

// Le trait des filets de coupe : fin, d'une encre neutre, continu (§ 11.3).
// Le contour des cartes de la feuille de contrôle se trace du même trait.
const FILET = Object.freeze({ epaisseurPt: 0.25, gris: 0.5 });

// Le contour du filigrane : un texte au trait, gris, qui laisse lire ce
// qu'il recouvre (§ 11.7).
const CONTOUR_FILIGRANE = Object.freeze({ epaisseurPt: 0.6, gris: 0.55 });

// La feuille de contrôle. La règle : 100 mm, un repère tous les 10 mm, plus
// long tous les 50 mm, son chiffre au-dessus ; elle se pose au coin haut
// gauche de la page, en deçà de la marge non imprimable (MARGE_PAGE_MM), et
// se trace en noir, le trait de la mesure. Les lignes de contrôle suivent, au
// corps du texte courant, repliées dans la largeur utile.
const REGLE = Object.freeze({
  longueurMm: 100,
  pasMm: 10,
  reperesLongsMm: 50,
  hauteurRepereMm: 3,
  hauteurRepereLongMm: 5,
  // De la marge haute à la ligne de la règle : la place des chiffres et des
  // repères longs.
  descenteMm: 10,
  corpsChiffresPt: 8,
  // Du haut d'un repère long à la ligne de base de son chiffre.
  ecartChiffreMm: 1,
  epaisseurPt: 0.5,
  // De la ligne de la règle à la première ligne de contrôle, et au cadre du
  // filigrane : la règle reste hors de tout texte.
  degagementMm: 8,
});
const CORPS_CONTROLE_PT = 11;

// La forme d'un horodatage, celle qu'estHorodatage de src/stockage/journal.js
// tient — date, heure à la seconde, décalage local —, relue ici parce que
// src/pdf n'importe pas le stockage. Ses groupes composent la date PDF.
const HORODATAGE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})([+-])(\d{2}):(\d{2})$/;

// Une grappe : un point de code suivi de ses marques combinantes ; une
// ligne de contrôle trop longue se coupe entre deux grappes.
const GRAPPE = /\P{M}\p{M}*|\p{M}+/gu;

/**
 * La date PDF d'un horodatage, décalage local gardé :
 * « 2026-10-09T19:00:00-04:00 » → « D:20261009190000-04'00' ».
 *
 * @param {string} horodatage
 * @returns {string}
 * @throws {TypeError} un texte d'une autre forme
 */
function datePdf(horodatage) {
  const morceaux = typeof horodatage === 'string' ? HORODATAGE.exec(horodatage) : null;
  if (morceaux === null) throw new TypeError(`horodatage de la forme AAAA-MM-JJTHH:MM:SS±HH:MM attendu, reçu ${JSON.stringify(horodatage)}`);
  const [, annee, mois, jour, heure, minute, seconde, signe, hDecalage, mDecalage] = morceaux;
  return `D:${annee}${mois}${jour}${heure}${minute}${seconde}${signe}${hDecalage}'${mDecalage}'`;
}

// Les entrées communes, contrôlées : un modèle qui porte des badges, deux
// polices en octets, un modèle de badge connu.
function controlerModeleEtPolices(modele, polices, modeleBadge) {
  if (!Array.isArray(modele?.badges)) throw new TypeError('modele : un modèle de planche attendu');
  if (!(polices?.regulier instanceof Uint8Array) || !(polices?.gras instanceof Uint8Array)) {
    throw new TypeError('polices : {regulier, gras} en Uint8Array attendus');
  }
  if (!estModeleBadge(modeleBadge)) throw new TypeError(`modeleBadge : modèle de badge inconnu ${JSON.stringify(modeleBadge)}`);
}

// Les entrées d'un document, contrôlées, et sa date PDF, null pour un
// horodatage inconnu : le papier, que le modèle de badge admet ; les lignes
// de contrôle ; le mot du filigrane d'un brouillon.
function controlerDocument({ modele, papier, polices, controle, filigrane, modeleBadge }) {
  controlerModeleEtPolices(modele, polices, modeleBadge);
  if (typeof papier !== 'string' || !Object.hasOwn(PAPIERS, papier)) throw new TypeError(`papier inconnu : ${JSON.stringify(papier)}`);
  const impose = MODELES_BADGE[modeleBadge].papier;
  if (impose !== null && papier !== impose) throw new TypeError(`le modèle ${modeleBadge} se pose sur ${impose}, reçu ${papier}`);
  if (!Array.isArray(controle) || !controle.every((ligne) => typeof ligne === 'string')) {
    throw new TypeError('controle : les lignes de la feuille de contrôle, des chaînes, attendues');
  }
  if (typeof modele.brouillon !== 'boolean') throw new TypeError('modele.brouillon : booléen attendu');
  if (modele.brouillon && (typeof filigrane !== 'string' || filigrane.trim() === '')) {
    throw new TypeError("filigrane : le mot du filigrane d'un brouillon attendu");
  }
  return modele.horodatage === null ? null : datePdf(modele.horodatage);
}

// Un document neuf, les deux graisses embarquées en sous-ensemble, chacune
// avec sa ToUnicode, et leurs métriques. updateMetadata faux : pdf-lib
// n'écrit ni Producer, ni Creator, ni dates.
async function documentAvecPolices(polices) {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  pdf.registerFontkit(fontkit);
  const regulier = await pdf.embedFont(polices.regulier, { subset: true });
  const gras = await pdf.embedFont(polices.gras, { subset: true });
  return { pdf, regulier, gras, metriques: metriquesDe({ regulier, gras }) };
}

// Les textes d'un badge, dans l'ordre où ses absents se nomment.
const textesDuBadge = ({ textes }) => [
  textes.nom,
  ...(textes.organisation === null ? [] : [textes.organisation]),
  ...textes.lignes,
  ...textes.pied,
  ...textes.piedReduit,
];

/**
 * L'analyse d'une planche avant sa production (§ 11.5, décision 12) : la
 * mise en page de chaque badge, dans l'ordre du modèle, et les caractères
 * que la police embarquée ne dessine pas. Rien ne se produit.
 *
 * @param {Object} entrees
 * @param {ModelePlanche} entrees.modele
 * @param {{regulier: Uint8Array, gras: Uint8Array}} entrees.polices
 * @param {import('../geometrie/papiers.js').ModeleBadge} [entrees.modeleBadge]   'a6' par défaut
 * @returns {Promise<{refus: null | {code: string, details: object, rang: number}, absents: string[]}>}
 *   refus : le premier badge que la mise en page refuse, rang étant son
 *   indice dans modele.badges ; src/pdf ne connaît pas la personne, et
 *   l'appelant complète les détails. absents : les caractères sans glyphe
 *   de tous les textes des badges, une fois chacun, dans l'ordre de
 *   première rencontre.
 * @throws {TypeError} un modèle sans badges, des polices qui ne sont pas des
 *         octets, un modèle de badge inconnu
 */
export async function analyserPlanche({ modele, polices, modeleBadge = 'a6' }) {
  controlerModeleEtPolices(modele, polices, modeleBadge);
  const { metriques } = await documentAvecPolices(polices);
  let refus = null;
  const absents = [];
  const vus = new Set();
  modele.badges.forEach((badge, rang) => {
    if (refus === null) {
      const page = mettreEnPage(badge.textes, metriques, modeleBadge);
      if (page.refus !== undefined) refus = { ...page.refus, rang };
    }
    for (const caractere of metriques.absents(textesDuBadge(badge).join(''))) {
      if (vus.has(caractere)) continue;
      vus.add(caractere);
      absents.push(caractere);
    }
  });
  return { refus, absents };
}

// Un repère : la position, en points du repère PDF (origine en bas à
// gauche), d'un point donné en millimètres, et la direction (ux, uy),
// unitaire, où court l'axe des x de ce repère, celle d'un texte droit.

// Le repère d'un badge sur sa page, le badge droit — origine au coin bas
// gauche, y vers le haut. Debout, le badge occupe sa cellule tel quel. À
// plat, il tourne de 90° dans le sens trigonométrique, son haut à gauche :
// son coin bas gauche tombe au coin bas droit de la cellule, son axe des x
// monte, son axe des y va vers la gauche.
function repereDuBadge(cellule, hauteurPage) {
  const bas = (hauteurPage - cellule.y - cellule.hauteur) * PT_PAR_MM;
  if (!cellule.aPlat) {
    const gauche = cellule.x * PT_PAR_MM;
    return { point: (x, y) => [gauche + x * PT_PAR_MM, bas + y * PT_PAR_MM], ux: 1, uy: 0 };
  }
  const droite = (cellule.x + cellule.largeur) * PT_PAR_MM;
  return { point: (x, y) => [droite - y * PT_PAR_MM, bas + x * PT_PAR_MM], ux: 0, uy: 1 };
}

// Le repère d'une page, depuis son coin haut gauche, y vers le bas.
const repereDePage = (hauteurPage) => ({ point: (x, y) => [x * PT_PAR_MM, (hauteurPage - y) * PT_PAR_MM], ux: 1, uy: 0 });

// Le repère droit d'une page, depuis son coin bas gauche, y vers le haut :
// celui du PDF.
const REPERE_DROIT = Object.freeze({ point: (x, y) => [x * PT_PAR_MM, y * PT_PAR_MM], ux: 1, uy: 0 });

// La clé de ressource d'une police sur une page, créée à sa première
// demande, la même ensuite.
const CLES = new WeakMap();
function cleDePolice(page, police) {
  if (!CLES.has(page)) CLES.set(page, new Map());
  const cles = CLES.get(page);
  if (!cles.has(police)) cles.set(police, page.node.newFontDictionary(police.name, police.ref));
  return cles.get(police);
}

// Un texte posé par ses opérateurs : sa ligne de base part de (X, Y) points
// et court selon (ux, uy). Le mode de rendu 1 le trace au trait, gris, sans
// remplissage ; le mode par défaut le remplit de l'encre par défaut, noire.
function ecrire(page, texte, { police, corps, X, Y, ux, uy, contour = null }) {
  page.pushOperators(
    pushGraphicsState(),
    ...(contour === null
      ? []
      : [setStrokingGrayscaleColor(contour.gris), setLineWidth(contour.epaisseurPt), setTextRenderingMode(TextRenderingMode.Outline)]),
    beginText(),
    setFontAndSize(cleDePolice(page, police), corps),
    setTextMatrix(ux, uy, -uy, ux, X, Y),
    showText(police.encodeText(texte)),
    endText(),
    popGraphicsState(),
  );
}

/**
 * Le filigrane d'un brouillon, inscrit dans un cadre : le mot au trait
 * (mode de rendu 1), dans la couche de texte, tourné selon la diagonale du
 * cadre qui monte vers la droite, au plus grand corps dont l'englobant —
 * avance du mot sur la hauteur d'ascendante à descendante — tient dans le
 * cadre, centré sur lui.
 *
 * @param {import('pdf-lib').PDFPage} page
 * @param {{x: number, y: number, largeur: number, hauteur: number}} cadre
 *        mm, dans le repère droit du repère reçu : origine en bas à gauche
 * @param {{point: Function, ux: number, uy: number}} repere
 */
function poserFiligrane(page, { mot, police, metriques }, cadre, repere) {
  const phi = Math.atan2(cadre.hauteur, cadre.largeur);
  const [cos, sin] = [Math.cos(phi), Math.sin(phi)];
  const avanceParPt = metriques.largeur(mot, 1, true);
  const { ascendante, descendante } = metriques.hauteurs(1);
  const hauteurParPt = ascendante + descendante;
  const corps = Math.min(
    cadre.largeur / (avanceParPt * cos + hauteurParPt * sin),
    cadre.hauteur / (avanceParPt * sin + hauteurParPt * cos),
  );
  // L'origine du mot : le centre du cadre, moins le centre de l'englobant
  // du mot droit, tourné de phi.
  const [mx, my] = [(avanceParPt * corps) / 2, ((ascendante - descendante) * corps) / 2];
  const ox = cadre.x + cadre.largeur / 2 - (mx * cos - my * sin);
  const oy = cadre.y + cadre.hauteur / 2 - (mx * sin + my * cos);
  const [X, Y] = repere.point(ox, oy);
  // La direction du mot : celle du repère, tournée de phi.
  const [ux, uy] = [repere.ux * cos - repere.uy * sin, repere.ux * sin + repere.uy * cos];
  ecrire(page, mot, { police, corps, X, Y, ux, uy, contour: CONTOUR_FILIGRANE });
}

// Un texte droit dans son repère, sa ligne de base en (x, y) mm.
function poserTexte(page, texte, { x, y, corps, police }, repere) {
  const [X, Y] = repere.point(x, y);
  ecrire(page, texte, { police, corps, X, Y, ux: repere.ux, uy: repere.uy });
}

// Un segment en millimètres, repère haut gauche de la page.
function poserSegment(page, { x1, y1, x2, y2 }, hauteurPage, { epaisseurPt, gris }) {
  const repere = repereDePage(hauteurPage);
  const [X1, Y1] = repere.point(x1, y1);
  const [X2, Y2] = repere.point(x2, y2);
  page.drawLine({ start: { x: X1, y: Y1 }, end: { x: X2, y: Y2 }, thickness: epaisseurPt, color: grayscale(gris) });
}

// Un texte replié dans une largeur, en mm : coupé aux espaces, et entre deux
// grappes pour un mot plus large que la ligne. Jamais tronqué.
function replier(texte, largeurMax, mesurer) {
  const lignes = [];
  let courante = '';
  for (const mot of texte.split(' ').filter((m) => m !== '')) {
    const avecMot = courante === '' ? mot : `${courante} ${mot}`;
    if (mesurer(avecMot) <= largeurMax) {
      courante = avecMot;
      continue;
    }
    if (courante !== '') lignes.push(courante);
    courante = '';
    for (const grappe of mot.match(GRAPPE)) {
      if (courante !== '' && mesurer(courante + grappe) > largeurMax) {
        lignes.push(courante);
        courante = '';
      }
      courante += grappe;
    }
  }
  if (courante !== '' || lignes.length === 0) lignes.push(courante);
  return lignes;
}

// La règle graduée de la feuille de contrôle, en haut à gauche de la page,
// chaque chiffre centré sur son repère : elle commence à la demi-largeur du
// « 0 » de la marge, qui ne déborde pas dans la marge. Rend l'ordonnée de
// sa ligne, en mm depuis le haut.
function poserRegle(page, { regulier, metriques }, hauteurPage) {
  const marge = constante('MARGE_PAGE_MM');
  const largeurChiffres = (chiffres) => metriques.largeur(chiffres, REGLE.corpsChiffresPt, false);
  const origine = marge + largeurChiffres('0') / 2;
  const ligne = marge + REGLE.descenteMm;
  const trait = { epaisseurPt: REGLE.epaisseurPt, gris: 0 };
  poserSegment(page, { x1: origine, y1: ligne, x2: origine + REGLE.longueurMm, y2: ligne }, hauteurPage, trait);
  for (let mm = 0; mm <= REGLE.longueurMm; mm += REGLE.pasMm) {
    const long = mm % REGLE.reperesLongsMm === 0;
    const x = origine + mm;
    const haut = ligne - (long ? REGLE.hauteurRepereLongMm : REGLE.hauteurRepereMm);
    poserSegment(page, { x1: x, y1: haut, x2: x, y2: ligne }, hauteurPage, trait);
    if (long) {
      const chiffres = String(mm);
      const position = { x: x - largeurChiffres(chiffres) / 2, y: haut - REGLE.ecartChiffreMm };
      poserTexte(page, chiffres, { ...position, corps: REGLE.corpsChiffresPt, police: regulier }, repereDePage(hauteurPage));
    }
  }
  return ligne;
}

// Le contour d'une grille de cartes jointives : chaque abscisse et chaque
// ordonnée d'un bord de carte, d'un seul segment qui court d'un bout à
// l'autre de la grille, les verticaux d'abord, de gauche à droite, puis les
// horizontaux, de haut en bas. Les cotes se réunissent au centième de
// millimètre, où elles sont exactes.
function contourDes(cartes) {
  const centiemes = (mm) => Math.round(mm * 100);
  const valeurs = (bords) => [...new Set(cartes.flatMap(bords).map(centiemes))].sort((a, b) => a - b).map((c) => c / 100);
  const xs = valeurs(({ x, largeur }) => [x, x + largeur]);
  const ys = valeurs(({ y, hauteur }) => [y, y + hauteur]);
  const [gauche, droite, haut, bas] = [xs[0], xs.at(-1), ys[0], ys.at(-1)];
  return [
    ...xs.map((x) => ({ x1: x, y1: haut, x2: x, y2: bas })),
    ...ys.map((y) => ({ x1: gauche, y1: y, x2: droite, y2: y })),
  ];
}

// La feuille de contrôle (§ 11.3) : la règle, puis les lignes de contrôle
// repliées dans la largeur utile, et le filigrane d'un brouillon dans le
// cadre sous la règle. Des lignes qui débordent la page continuent sur une
// page suivante, sans règle, qui porte elle aussi le filigrane : la feuille
// ne se découpe pas, ses pages non plus.
//
// cartes : null pour l'A6 ; pour un modèle à cartes prédécoupées, ses
// cellules, dont la première page trace le contour du trait des filets —
// les axes de la grille, chacun d'un seul segment. Les lignes de contrôle
// se replient alors dans la colonne de gauche des cartes, en deçà de la
// marge de page de part et d'autre, sans croiser le contour du milieu.
function poserControle(pdf, { controle, papier, polices, metriques, filigrane, cartes = null }) {
  const { largeur: W, hauteur: H } = PAPIERS[papier];
  const marge = constante('MARGE_PAGE_MM');
  const largeurUtile = cartes === null ? W - 2 * marge : cartes[0].x + cartes[0].largeur - 2 * marge;
  const { ascendante, descendante } = metriques.hauteurs(CORPS_CONTROLE_PT);
  const mesurer = (texte) => metriques.largeur(texte, CORPS_CONTROLE_PT, false);
  const lignes = controle.flatMap((ligne) => replier(ligne, largeurUtile, mesurer));

  const nouvellePage = (avecRegle) => {
    const page = pdf.addPage([W * PT_PAR_MM, H * PT_PAR_MM]);
    if (avecRegle && cartes !== null) for (const segment of contourDes(cartes)) poserSegment(page, segment, H, FILET);
    const haut = avecRegle ? poserRegle(page, { ...polices, metriques }, H) + REGLE.degagementMm : marge;
    if (filigrane !== null) {
      // Le cadre du filigrane, en mm dans le repère droit de la page : sous
      // la règle, dans les marges.
      const cadre = { x: marge, y: marge, largeur: W - 2 * marge, hauteur: H - marge - haut };
      poserFiligrane(page, { ...filigrane, metriques }, cadre, REPERE_DROIT);
    }
    return { page, curseur: haut };
  };
  let { page, curseur } = nouvellePage(true);
  for (const ligne of lignes) {
    if (curseur + ascendante + descendante > H - marge) ({ page, curseur } = nouvellePage(false));
    poserTexte(page, ligne, { x: marge, y: curseur + ascendante, corps: CORPS_CONTROLE_PT, police: polices.regulier }, repereDePage(H));
    curseur += ascendante + descendante;
  }
}

/**
 * La planche de badges, en octets PDF (§ 11.1 à § 11.4).
 *
 * A6 — page 1 : la feuille de contrôle — la règle de 100 mm repérée tous
 * les 10 mm, les lignes de controle, et le filigrane d'un brouillon, une
 * fois, hors de la règle ; aucun filet de coupe. Puis une page par planche :
 * les filets des cellules occupées, et dans chacune, le badge que la mise en
 * page pose dans son cadre utile, et le filigrane d'un brouillon, une fois,
 * inscrit dans ce cadre. Une cellule vide ne porte rien.
 *
 * Avery 5392 : une page par feuille de cartes, sans feuille de contrôle ni
 * filet ; chaque carte porte son badge et son filigrane comme une cellule
 * de l'A6. Les lignes de contrôle reçues vont à produireControle.
 *
 * La boîte de média est celle du papier ; ni CropBox ni UserUnit. /Info ne
 * porte que CreationDate, la date de l'horodatage du placement, décalage
 * local gardé, et n'existe pas quand l'horodatage est inconnu.
 *
 * @param {Object} entrees
 * @param {ModelePlanche} entrees.modele
 * @param {import('../geometrie/papiers.js').Papier} entrees.papier   celui
 *        qu'impose le modèle de badge, quand il en impose un
 * @param {'feuille'|'pile'} entrees.imposition
 * @param {{regulier: Uint8Array, gras: Uint8Array}} entrees.polices
 * @param {string[]} entrees.controle      les lignes de textesControle
 * @param {string} [entrees.filigrane]     le mot du filigrane, composé par
 *        libelle ; exigé quand modele.brouillon est vrai, ignoré sinon
 * @param {import('../geometrie/papiers.js').ModeleBadge} [entrees.modeleBadge]   'a6' par défaut
 * @returns {Promise<Uint8Array>}
 * @throws {TypeError} une entrée hors de son domaine, un papier que le
 *         modèle de badge n'admet pas, un horodatage d'une autre forme, un
 *         brouillon sans le mot de son filigrane
 * @throws {RangeError} un badge que la mise en page refuse : analyserPlanche
 *         le dit avant de produire
 */
export async function produirePlanche({ modele, papier, imposition, polices, controle, filigrane = null, modeleBadge = 'a6' }) {
  const date = controlerDocument({ modele, papier, polices, controle, filigrane, modeleBadge });
  if (!IMPOSITIONS.has(imposition)) throw new TypeError(`imposition inconnue : ${JSON.stringify(imposition)}`);

  const { pdf, regulier, gras, metriques } = await documentAvecPolices(polices);
  const mises = modele.badges.map((badge, rang) => {
    const mise = mettreEnPage(badge.textes, metriques, modeleBadge);
    if (mise.refus !== undefined) throw new RangeError(`badge ${rang} refusé par la mise en page : ${mise.refus.code}`);
    return mise;
  });
  if (date !== null) pdf.getInfoDict().set(PDFName.of('CreationDate'), PDFString.of(date));

  const marque = modele.brouillon ? { mot: filigrane, police: gras } : null;
  const badge = MODELES_BADGE[modeleBadge];
  if (badge.grille === null) poserControle(pdf, { controle, papier, polices: { regulier, gras }, metriques, filigrane: marque });

  const { largeur: W, hauteur: H } = PAPIERS[papier];
  const lesCellules = cellules(papier, modeleBadge);
  const cadreBadge = cadreUtile({ x: 0, y: 0, largeur: badge.largeur, hauteur: badge.hauteur }, modeleBadge);
  // Le cadre utile dans le repère droit du badge, y vers le haut.
  const cadreDroit = { ...cadreBadge, y: badge.hauteur - cadreBadge.y - cadreBadge.hauteur };
  for (const planche of imposer(modele.badges.length, papier, imposition, modeleBadge)) {
    const page = pdf.addPage([W * PT_PAR_MM, H * PT_PAR_MM]);
    const occupees = planche.map((indice) => indice !== null);
    for (const segment of filets(papier, occupees, modeleBadge)) poserSegment(page, segment, H, FILET);
    planche.forEach((indice, rang) => {
      if (indice === null) return;
      const repere = repereDuBadge(lesCellules[rang], H);
      for (const { texte, corps, gras: enGras, x, y } of mises[indice].blocs) {
        const position = { x: cadreBadge.x + x, y: badge.hauteur - (cadreBadge.y + y) };
        poserTexte(page, texte, { ...position, corps, police: enGras ? gras : regulier }, repere);
      }
      if (marque !== null) poserFiligrane(page, { ...marque, metriques }, cadreDroit, repere);
    });
  }
  return pdf.save();
}

/**
 * La feuille de contrôle d'un modèle à cartes prédécoupées, en octets PDF,
 * à part de ses feuilles de cartes (§ 11.3) : à imprimer sur papier
 * ordinaire. Sa première page porte la règle de 100 mm, le contour des
 * cartes à leur place exacte sur la feuille — posée sur une feuille de
 * cartes, il tombe sur les prédécoupes —, les lignes de contrôle et le
 * filigrane d'un brouillon ; des lignes qui débordent continuent sur une
 * page suivante, comme la feuille de contrôle de l'A6. Boîtes, /Info et
 * octets suivent les règles de produirePlanche.
 *
 * @param {Object} entrees   celles de produirePlanche, sans l'imposition
 * @returns {Promise<Uint8Array>}
 * @throws {TypeError} comme produirePlanche, et un modèle de badge sans
 *         cartes prédécoupées, dont la feuille de contrôle est la page 1
 *         de la planche
 */
export async function produireControle({ modele, papier, polices, controle, filigrane = null, modeleBadge = 'a6' }) {
  const date = controlerDocument({ modele, papier, polices, controle, filigrane, modeleBadge });
  if (MODELES_BADGE[modeleBadge].grille === null) {
    throw new TypeError(`produireControle : le modèle ${modeleBadge} porte sa feuille de contrôle en page 1 de la planche`);
  }
  const { pdf, regulier, gras, metriques } = await documentAvecPolices(polices);
  if (date !== null) pdf.getInfoDict().set(PDFName.of('CreationDate'), PDFString.of(date));
  const marque = modele.brouillon ? { mot: filigrane, police: gras } : null;
  const cartes = cellules(papier, modeleBadge);
  poserControle(pdf, { controle, papier, polices: { regulier, gras }, metriques, filigrane: marque, cartes });
  return pdf.save();
}
