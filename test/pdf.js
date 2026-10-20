// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La lecture d'un PDF pour les épreuves, sous node seulement : ce qu'un
// lecteur réel y trouve, en millimètres, l'origine au coin haut gauche de la
// boîte de média. pdfjs-dist, lecteur des navigateurs, rend la couche de
// texte et la liste des opérateurs de dessin ; pdf-lib relit la structure
// du fichier — boîtes de page, polices, leur ToUnicode et leur programme
// embarqué, /Info, /ID —, que pdfjs ne montre pas telle qu'elle est écrite.
//
// Ce module isole le format des opérateurs de la version épinglée de
// pdfjs-dist : constructPath y porte [opérateur de peinture, [données du
// chemin], englobant], les données en suites « code DrawOPS, coordonnées »,
// dans l'espace de l'utilisateur, avant la matrice courante. La lecture
// suit elle-même la matrice courante (q, Q, cm) et l'épaisseur de trait
// (w) : une mise à l'échelle posée dans le flux déplace et épaissit les
// segments qu'elle rend, là où les boîtes de page ne changent pas.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef, decodePDFRawStream } from 'pdf-lib';
import { OPS, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

/** Le point typographique en millimètres. */
const MM_PAR_PT = 25.4 / 72;

// Les polices standard de pdfjs, lues du disque quand un document en
// appelle une sans l'embarquer : pdfjs les attend dans un dossier.
const POLICES_STANDARD = `${join(dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json')), 'standard_fonts')}/`;

// Les codes des segments de chemin dans les données de constructPath.
const DRAW = Object.freeze({ moveTo: 0, lineTo: 1, curveTo: 2, quadraticCurveTo: 3, closePath: 4 });

// Les opérateurs de peinture qui tracent le contour, et ceux qui
// remplissent : S s, f F f*, B B* b b*.
const TRACENT = new Set([OPS.stroke, OPS.closeStroke, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke]);
const REMPLISSENT = new Set([OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke]);
const COULEURS = new Set([OPS.setFillRGBColor, OPS.setStrokeRGBColor]);
// Les opérateurs qui montrent du texte : Tj TJ ' ".
const MONTRENT = new Set([OPS.showText, OPS.showSpacedText, OPS.nextLineShowText, OPS.nextLineSetSpacingShowText]);

// La composition de deux matrices [a b c d e f] : m1 d'abord, puis m2.
const composer = ([a1, b1, c1, d1, e1, f1], [a2, b2, c2, d2, e2, f2]) => [
  a1 * a2 + b1 * c2,
  a1 * b2 + b1 * d2,
  c1 * a2 + d1 * c2,
  c1 * b2 + d1 * d2,
  e1 * a2 + f1 * c2 + e2,
  e1 * b2 + f1 * d2 + f2,
];
const appliquer = ([a, b, c, d, e, f], x, y) => [a * x + c * y + e, b * x + d * y + f];

// L'épaisseur, en points de la page, d'un trait d'épaisseur w (espace de
// l'utilisateur) tracé de (x1, y1) vers (x2, y2), sous la matrice m : la
// largeur du parallélogramme image de la bande du trait, mesurée en travers
// de sa direction, w·|det m| / |m·u|, u le vecteur unitaire du trait. Juste
// pour une matrice quelconque : une échelle d'un seul axe épaissit le trait
// qui la traverse et laisse l'autre tel quel.
function epaisseurSous([a, b, c, d], w, [x1, y1], [x2, y2]) {
  const longueur = Math.hypot(x2 - x1, y2 - y1);
  const [ux, uy] = [(x2 - x1) / longueur, (y2 - y1) / longueur];
  return (w * Math.abs(a * d - b * c)) / Math.hypot(a * ux + c * uy, b * ux + d * uy);
}

// Une couleur « #rrggbb » de pdfjs en [r, g, b].
const enRgb = (hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));

// Une boîte [x1 y1 x2 y2] de pdf-lib, en points, en {x, y, largeur, hauteur}
// en millimètres, x et y au coin bas gauche.
function boiteEnMm(tableau) {
  const [x1, y1, x2, y2] = tableau.asArray().map((n) => n.asNumber());
  return {
    x: Math.min(x1, x2) * MM_PAR_PT,
    y: Math.min(y1, y2) * MM_PAR_PT,
    largeur: Math.abs(x2 - x1) * MM_PAR_PT,
    hauteur: Math.abs(y2 - y1) * MM_PAR_PT,
  };
}

// La boîte d'un fragment de texte, en points : l'englobant des quatre coins
// du rectangle largeur × hauteur posé sur sa ligne de base, à son origine,
// le long des deux axes de son transform — juste pour un texte tourné. La
// largeur suit le premier axe, la hauteur (le corps) le second.
function boiteDuFragment({ transform, width, height }) {
  const [a, b, c, d, e, f] = transform;
  const [na, nc] = [Math.hypot(a, b), Math.hypot(c, d)];
  const u = na === 0 ? [1, 0] : [a / na, b / na];
  const v = nc === 0 ? [0, 1] : [c / nc, d / nc];
  const coins = [
    [e, f],
    [e + width * u[0], f + width * u[1]],
    [e + height * v[0], f + height * v[1]],
    [e + width * u[0] + height * v[0], f + width * u[1] + height * v[1]],
  ];
  const xs = coins.map(([x]) => x);
  const ys = coins.map(([, y]) => y);
  return { x1: Math.min(...xs), x2: Math.max(...xs), y1: Math.min(...ys), y2: Math.max(...ys) };
}

// Les segments, remplissages, couleurs et tirets d'une liste d'opérateurs,
// les segments en points sous la matrice courante, chacun avec son
// épaisseur ; le mode de rendu en vigueur à chaque texte montré. La
// matrice, l'épaisseur de trait (1 par défaut, PDF 32000 § 8.4.1) et le
// mode font partie de l'état graphique : q les empile, Q les rend.
function lireDessin({ fnArray, argsArray }) {
  const segments = [];
  const couleurs = [];
  const modesTexte = [];
  let remplissages = 0;
  let tirets = false;
  let matrice = [1, 0, 0, 1, 0, 0];
  let mode = 0;
  let largeurTrait = 1;
  const pile = [];
  fnArray.forEach((fn, i) => {
    const args = argsArray[i];
    if (fn === OPS.save) pile.push({ matrice, mode, largeurTrait });
    else if (fn === OPS.restore) ({ matrice, mode, largeurTrait } = pile.pop() ?? { matrice: [1, 0, 0, 1, 0, 0], mode: 0, largeurTrait: 1 });
    else if (fn === OPS.transform) matrice = composer(args, matrice);
    else if (fn === OPS.setLineWidth) [largeurTrait] = args;
    else if (fn === OPS.setTextRenderingMode) [mode] = args;
    else if (MONTRENT.has(fn)) modesTexte.push(mode);
    else if (fn === OPS.setDash) tirets ||= args[0].length > 0;
    else if (COULEURS.has(fn)) couleurs.push(enRgb(args[0]));
    else if (fn === OPS.constructPath) {
      const [peinture, [donnees]] = args;
      if (REMPLISSENT.has(peinture)) remplissages += 1;
      if (!TRACENT.has(peinture) || donnees === null || donnees === undefined) return;
      let courant = null;
      let depart = null;
      const tracer = (vers) => {
        if (courant !== null && (courant[0] !== vers[0] || courant[1] !== vers[1])) {
          const [x1, y1] = appliquer(matrice, ...courant);
          const [x2, y2] = appliquer(matrice, ...vers);
          segments.push({ x1, y1, x2, y2, epaisseur: epaisseurSous(matrice, largeurTrait, courant, vers) });
        }
      };
      for (let j = 0; j < donnees.length; ) {
        const code = donnees[j++];
        if (code === DRAW.moveTo) {
          courant = [donnees[j++], donnees[j++]];
          depart = courant;
        } else if (code === DRAW.lineTo) {
          const vers = [donnees[j++], donnees[j++]];
          tracer(vers);
          courant = vers;
        } else if (code === DRAW.curveTo) {
          j += 4;
          courant = [donnees[j++], donnees[j++]];
        } else if (code === DRAW.quadraticCurveTo) {
          j += 2;
          courant = [donnees[j++], donnees[j++]];
        } else if (code === DRAW.closePath) {
          if (depart !== null) tracer(depart);
          courant = depart;
        } else {
          throw new TypeError(`lirePdf : code de chemin inconnu ${code}`);
        }
      }
    }
  });
  return { segments, remplissages, couleurs, tirets, modesTexte };
}

// La valeur d'un attribut héritable d'une page (MediaBox, CropBox,
// UserUnit), lue sur la page puis sur ses parents.
function attributHerite(noeud, nom) {
  for (let courant = noeud; courant instanceof PDFDict; courant = courant.lookup(PDFName.of('Parent'))) {
    const valeur = courant.lookup(PDFName.of(nom));
    if (valeur !== undefined) return valeur;
  }
  return undefined;
}

// La longueur, en octets, du programme TrueType embarqué d'une police
// (FontFile2), décodé de ses filtres : sur le dictionnaire de la police
// pour une police simple, sur sa descendante pour une police composite
// (Type0). null sans FontFile2 : police standard, ou programme d'une autre
// forme (FontFile, FontFile3).
function longueurFontFile2(police) {
  const descendantes = police.lookup(PDFName.of('DescendantFonts'));
  const porteuse = descendantes instanceof PDFArray ? descendantes.lookup(0, PDFDict) : police;
  const descripteur = porteuse.lookup(PDFName.of('FontDescriptor'));
  const programme = descripteur instanceof PDFDict ? descripteur.lookup(PDFName.of('FontFile2')) : undefined;
  if (programme === undefined) return null;
  if (!(programme instanceof PDFRawStream)) throw new TypeError('lirePdf : FontFile2 qui n\u{2019}est pas un flux brut');
  return decodePDFRawStream(programme).decode().length;
}

// La structure lue par pdf-lib : par page, la boîte de média, la CropBox,
// l'UserUnit ; les polices des ressources des pages, une fois chacune, dans
// l'ordre de première rencontre, avec la longueur de leur programme ; les
// clés de /Info ; la présence de /ID.
async function lireStructure(octets) {
  const document = await PDFDocument.load(octets, { updateMetadata: false });
  const vues = new Set();
  const polices = [];
  const pages = document.getPages().map((page) => {
    const cropBox = attributHerite(page.node, 'CropBox');
    const userUnit = attributHerite(page.node, 'UserUnit');
    const dictionnaire = page.node.Resources()?.lookup(PDFName.of('Font'));
    if (dictionnaire instanceof PDFDict) {
      for (const [, valeur] of dictionnaire.entries()) {
        const cle = valeur instanceof PDFRef ? valeur.toString() : valeur;
        if (vues.has(cle)) continue;
        vues.add(cle);
        const police = document.context.lookup(valeur, PDFDict);
        polices.push({
          nom: police.lookup(PDFName.of('BaseFont'))?.decodeText?.() ?? police.lookup(PDFName.of('BaseFont'))?.asString().slice(1) ?? '',
          toUnicode: police.has(PDFName.of('ToUnicode')),
          fontFile2: longueurFontFile2(police),
        });
      }
    }
    return {
      boite: boiteEnMm(attributHerite(page.node, 'MediaBox')),
      cropBox: cropBox instanceof PDFArray ? boiteEnMm(cropBox) : null,
      userUnit: userUnit instanceof PDFNumber ? userUnit.asNumber() : null,
    };
  });
  const info = document.context.lookup(document.context.trailerInfo.Info);
  return {
    pages,
    polices,
    info: info instanceof PDFDict ? info.keys().map((cle) => cle.asString().slice(1)) : [],
    id: document.context.trailerInfo.ID !== undefined,
  };
}

/**
 * Ce qu'un PDF montre à un lecteur, page par page, en millimètres,
 * l'origine au coin haut gauche de la boîte de média.
 *
 * @param {Uint8Array} octets   le fichier ; ni modifié ni détaché
 * @returns {Promise<{
 *   pages: Array<{
 *     boite: {x: number, y: number, largeur: number, hauteur: number},
 *     cropBox: null | {x: number, y: number, largeur: number, hauteur: number},
 *     userUnit: number|null,
 *     textes: Array<{texte: string, x: number, y: number, l: number, h: number}>,
 *     segments: Array<{x1: number, y1: number, x2: number, y2: number, epaisseur: number}>,
 *     remplissages: number,
 *     couleurs: Array<[number, number, number]>,
 *     tirets: boolean,
 *     modesTexte: number[]}>,
 *   polices: Array<{nom: string, toUnicode: boolean, fontFile2: number|null}>,
 *   info: string[],
 *   id: boolean}>}
 *   boite et cropBox : x et y au coin bas gauche, en millimètres du repère
 *   du PDF ; textes : la boîte de chaque fragment qui n'est pas fait que
 *   de blancs, x et y à son coin haut gauche ; segments : les côtés droits des chemins tracés,
 *   ceux d'un chemin seulement rempli exclus, epaisseur : celle du trait en
 *   millimètres, mesurée en travers du segment sous la matrice courante ; remplissages : le nombre de
 *   chemins remplis (f F f* B B* b b*) ; couleurs : chaque couleur posée,
 *   de trait ou de fond, dans l'ordre ; tirets : un motif de tirets non
 *   vide posé ; modesTexte : le mode de rendu (Tr) en vigueur à chaque
 *   opérateur qui montre du texte, dans l'ordre du flux, 0 par défaut, 1
 *   au trait ; polices : fontFile2, la longueur en octets du programme
 *   TrueType embarqué, décodé, null sans FontFile2 ; info : les clés de
 *   /Info, [] sans /Info ; id : la remorque porte /ID.
 */
export async function lirePdf(octets) {
  const structure = await lireStructure(octets);
  const tache = getDocument({
    data: new Uint8Array(octets),
    verbosity: 0,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    standardFontDataUrl: POLICES_STANDARD,
  });
  const document = await tache.promise;
  try {
    const pages = [];
    for (let rang = 1; rang <= document.numPages; rang += 1) {
      const page = await document.getPage(rang);
      const { boite, cropBox, userUnit } = structure.pages[rang - 1];
      const gauche = boite.x / MM_PAR_PT;
      const haut = (boite.y + boite.hauteur) / MM_PAR_PT;
      const contenu = await page.getTextContent({ disableNormalization: true });
      const textes = contenu.items
        // Un fragment fait de blancs ne porte aucune encre : pdfjs en
        // intercale entre deux textes d'une même ligne, à cheval sur l'écart.
        .filter((item) => typeof item.str === 'string' && item.str.trim() !== '')
        .map((item) => {
          const { x1, x2, y1, y2 } = boiteDuFragment(item);
          return {
            texte: item.str,
            x: (x1 - gauche) * MM_PAR_PT,
            y: (haut - y2) * MM_PAR_PT,
            l: (x2 - x1) * MM_PAR_PT,
            h: (y2 - y1) * MM_PAR_PT,
          };
        });
      const dessin = lireDessin(await page.getOperatorList());
      const enMm = ({ x1, y1, x2, y2, epaisseur }) => ({
        x1: (x1 - gauche) * MM_PAR_PT,
        y1: (haut - y1) * MM_PAR_PT,
        x2: (x2 - gauche) * MM_PAR_PT,
        y2: (haut - y2) * MM_PAR_PT,
        epaisseur: epaisseur * MM_PAR_PT,
      });
      pages.push({
        boite,
        cropBox,
        userUnit,
        textes,
        segments: dessin.segments.map(enMm),
        remplissages: dessin.remplissages,
        couleurs: dessin.couleurs,
        tirets: dessin.tirets,
        modesTexte: dessin.modesTexte,
      });
    }
    return { pages, polices: structure.polices, info: structure.info, id: structure.id };
  } finally {
    await tache.destroy();
  }
}
