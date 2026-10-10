// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'aide d'extraction des PDF (test/pdf.js), éprouvée sur des documents
// faits à la main par pdf-lib, dont chaque cote se calcule de tête : la
// boîte d'un texte tourné, le mode de rendu des textes, les segments sous
// la matrice courante et leur épaisseur, les remplissages, les tirets et les
// couleurs, les boîtes de page, les polices, leur ToUnicode et la longueur de
// leur programme embarqué, le dictionnaire /Info et l'identifiant du fichier.
import assert from 'node:assert/strict';
import fontkit from '@pdf-lib/fontkit';
import {
  PDFArray,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFString,
  StandardFonts,
  concatTransformationMatrix,
  degrees,
  grayscale,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  setLineWidth,
  setTextRenderingMode,
  stroke,
  TextRenderingMode,
} from 'pdf-lib';
import { lirePdf } from './pdf.js';
import { lirePolices } from './polices.js';
import { describe, test } from './lanceur.js';

/** Le point typographique en millimètres. */
const MM_PAR_PT = 25.4 / 72;
const proche = (a, b, tolerance = 1e-6) => Math.abs(a - b) <= tolerance;

/** Un document d'une page de largeur × hauteur points, que `dessiner` remplit. */
async function document(dessiner, { largeur = 600, hauteur = 800, avant = async () => {} } = {}) {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  pdf.registerFontkit(fontkit);
  await avant(pdf);
  const page = pdf.addPage([largeur, hauteur]);
  await dessiner(page, pdf);
  return pdf.save();
}

const noto = (pdf) => pdf.embedFont(lirePolices().regulier, { subset: true });

describe('lirePdf : le texte, en millimètres depuis le coin haut gauche', () => {
  test("un texte droit : sa boîte part de sa ligne de base, sa largeur est l'avance, sa hauteur le corps", async () => {
    let avance = 0;
    const octets = await document(async (page, pdf) => {
      const police = await noto(pdf);
      avance = police.widthOfTextAtSize('Iris Ombrelle', 20);
      page.drawText('Iris Ombrelle', { x: 100, y: 700, size: 20, font: police });
    });
    const [page] = (await lirePdf(octets)).pages;
    assert.equal(page.textes.length, 1);
    const [fragment] = page.textes;
    assert.equal(fragment.texte, 'Iris Ombrelle');
    assert.ok(proche(fragment.x, 100 * MM_PAR_PT), `x ${fragment.x}`);
    assert.ok(proche(fragment.y, (800 - 720) * MM_PAR_PT), `y ${fragment.y}`);
    assert.ok(proche(fragment.l, avance * MM_PAR_PT, 1e-4), `l ${fragment.l}`);
    assert.ok(proche(fragment.h, 20 * MM_PAR_PT), `h ${fragment.h}`);
  });

  test('un texte tourné de 90° : la boîte est l\u{2019}englobant des quatre coins du rectangle tourné, haute de son avance', async () => {
    let avance = 0;
    const octets = await document(async (page, pdf) => {
      const police = await noto(pdf);
      avance = police.widthOfTextAtSize('Théo Pervenche', 20);
      page.drawText('Théo Pervenche', { x: 300, y: 300, size: 20, font: police, rotate: degrees(90) });
    });
    const [fragment] = (await lirePdf(octets)).pages[0].textes;
    // Le texte monte depuis (300, 300) ; son haut regarde vers la gauche :
    // il couvre x de 280 à 300 et y de 300 à 300 + avance, en points.
    assert.ok(proche(fragment.x, 280 * MM_PAR_PT), `x ${fragment.x}`);
    assert.ok(proche(fragment.l, 20 * MM_PAR_PT), `l ${fragment.l}`);
    assert.ok(proche(fragment.y, (800 - 300 - avance) * MM_PAR_PT, 1e-4), `y ${fragment.y}`);
    assert.ok(proche(fragment.h, avance * MM_PAR_PT, 1e-4), `h ${fragment.h}`);
  });

  test("deux textes d'une même ligne de base, écartés : deux fragments, sans l'espace que le lecteur intercale entre eux", async () => {
    const octets = await document(async (page, pdf) => {
      const police = await noto(pdf);
      page.drawText('Iris', { x: 50, y: 400, size: 12, font: police });
      page.drawText('Ombrelle', { x: 300, y: 400, size: 12, font: police });
    });
    assert.deepEqual((await lirePdf(octets)).pages[0].textes.map(({ texte }) => texte), ['Iris', 'Ombrelle']);
  });

  test("le mode de rendu de chaque texte montré, dans l'ordre : 0 par défaut, 1 au trait, rendu par Q", async () => {
    const octets = await document(async (page, pdf) => {
      const police = await noto(pdf);
      page.drawText('Iris', { x: 50, y: 500, size: 12, font: police });
      page.pushOperators(pushGraphicsState(), setTextRenderingMode(TextRenderingMode.Outline));
      page.drawText('Ombrelle', { x: 50, y: 400, size: 12, font: police });
      page.pushOperators(popGraphicsState());
      page.drawText('Pervenche', { x: 50, y: 300, size: 12, font: police });
    });
    assert.deepEqual((await lirePdf(octets)).pages[0].modesTexte, [0, 1, 0]);
    assert.deepEqual((await lirePdf(await document(() => {}))).pages[0].modesTexte, []);
  });

  test('les accents et les capitales liées se lisent caractère par caractère, par la ToUnicode', async () => {
    const octets = await document(async (page, pdf) => {
      page.drawText('Ôjgq Æ Œuvre', { x: 50, y: 400, size: 12, font: await noto(pdf) });
    });
    const [fragment] = (await lirePdf(octets)).pages[0].textes;
    assert.deepEqual([...fragment.texte], [...'Ôjgq Æ Œuvre']);
  });
});

describe('lirePdf : les chemins, sous la matrice courante', () => {
  test('un trait se lit en millimètres, haut gauche ; une mise à l\u{2019}échelle posée dans le flux le déplace', async () => {
    const octets = await document((page) => {
      page.drawLine({ start: { x: 72, y: 700 }, end: { x: 144, y: 700 }, thickness: 0.5, color: grayscale(0.5) });
      page.pushOperators(pushGraphicsState(), concatTransformationMatrix(2, 0, 0, 2, 0, 0));
      page.drawLine({ start: { x: 72, y: 100 }, end: { x: 72, y: 172 }, thickness: 0.5 });
      page.pushOperators(popGraphicsState());
      page.drawLine({ start: { x: 10, y: 10 }, end: { x: 20, y: 10 }, thickness: 0.5 });
    });
    const { segments } = (await lirePdf(octets)).pages[0];
    const attendus = [
      { x1: 25.4, y1: (800 - 700) * MM_PAR_PT, x2: 50.8, y2: (800 - 700) * MM_PAR_PT },
      { x1: 50.8, y1: (800 - 200) * MM_PAR_PT, x2: 50.8, y2: (800 - 344) * MM_PAR_PT },
      { x1: 10 * MM_PAR_PT, y1: (800 - 10) * MM_PAR_PT, x2: 20 * MM_PAR_PT, y2: (800 - 10) * MM_PAR_PT },
    ];
    assert.equal(segments.length, attendus.length);
    segments.forEach((segment, i) => {
      for (const cle of ['x1', 'y1', 'x2', 'y2']) {
        assert.ok(proche(segment[cle], attendus[i][cle]), `segment ${i} ${cle} : ${segment[cle]} contre ${attendus[i][cle]}`);
      }
    });
  });

  test("l'épaisseur d'un trait se lit en millimètres : celle de setLineWidth sous la matrice courante, mesurée en travers du trait ; 1 pt par défaut, rendue par Q", async () => {
    const octets = await document((page) => {
      page.drawLine({ start: { x: 72, y: 700 }, end: { x: 144, y: 700 }, thickness: 0.5 });
      page.pushOperators(pushGraphicsState(), concatTransformationMatrix(2, 0, 0, 2, 0, 0));
      page.drawLine({ start: { x: 72, y: 100 }, end: { x: 72, y: 172 }, thickness: 0.5 });
      page.pushOperators(popGraphicsState(), pushGraphicsState(), concatTransformationMatrix(3, 0, 0, 1, 0, 0));
      // Une échelle de 3 en x seulement : un trait horizontal garde son
      // épaisseur, un trait vertical la triple.
      page.drawLine({ start: { x: 10, y: 600 }, end: { x: 50, y: 600 }, thickness: 0.5 });
      page.drawLine({ start: { x: 10, y: 500 }, end: { x: 10, y: 550 }, thickness: 0.5 });
      page.pushOperators(popGraphicsState());
      // Hors de tout drawLine : l'épaisseur par défaut, puis celle posée.
      page.pushOperators(moveTo(10, 300), lineTo(20, 300), stroke());
      page.pushOperators(setLineWidth(2), moveTo(10, 200), lineTo(20, 200), stroke());
    });
    const { segments } = (await lirePdf(octets)).pages[0];
    const attendues = [0.5, 1, 0.5, 1.5, 1, 2].map((pt) => pt * MM_PAR_PT);
    assert.equal(segments.length, attendues.length);
    segments.forEach(({ epaisseur }, i) => assert.ok(proche(epaisseur, attendues[i]), `segment ${i} : ${epaisseur} contre ${attendues[i]}`));
  });

  test("un rectangle tracé donne ses quatre côtés ; un rectangle rempli compte un remplissage et aucun segment", async () => {
    const octets = await document((page) => {
      page.drawRectangle({ x: 72, y: 72, width: 72, height: 144, borderWidth: 1, borderColor: grayscale(0) });
      page.drawRectangle({ x: 300, y: 300, width: 10, height: 10, color: rgb(1, 0, 0) });
    });
    const page = (await lirePdf(octets)).pages[0];
    assert.equal(page.remplissages, 1);
    assert.equal(page.segments.length, 4);
    const longueurs = page.segments.map(({ x1, y1, x2, y2 }) => Math.hypot(x2 - x1, y2 - y1)).sort((a, b) => a - b);
    [25.4, 25.4, 50.8, 50.8].forEach((attendue, i) => assert.ok(proche(longueurs[i], attendue), `côté ${i} : ${longueurs[i]}`));
  });

  test('les couleurs posées se lisent en [r, g, b] de 0 à 255 ; les tirets se voient, un motif vide est un trait continu', async () => {
    const continu = await document((page) => {
      page.drawLine({ start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, color: grayscale(0.5) });
    });
    const tirete = await document((page) => {
      page.drawLine({ start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, color: rgb(1, 0, 0), dashArray: [3, 2] });
    });
    const [a] = (await lirePdf(continu)).pages;
    const [b] = (await lirePdf(tirete)).pages;
    assert.equal(a.tirets, false);
    assert.deepEqual(a.couleurs, [[128, 128, 128]]);
    assert.equal(b.tirets, true);
    assert.deepEqual(b.couleurs, [[255, 0, 0]]);
  });
});

describe('lirePdf : les boîtes, les polices, /Info et /ID', () => {
  test('la boîte de média en millimètres ; ni CropBox ni UserUnit par défaut', async () => {
    const page = (await lirePdf(await document(() => {}, { largeur: 595.28, hauteur: 841.89 }))).pages[0];
    assert.ok(proche(page.boite.largeur, 595.28 * MM_PAR_PT) && proche(page.boite.hauteur, 841.89 * MM_PAR_PT));
    assert.equal(page.boite.x, 0);
    assert.equal(page.boite.y, 0);
    assert.equal(page.cropBox, null);
    assert.equal(page.userUnit, null);
  });

  test('une CropBox et un UserUnit posés se lisent', async () => {
    const octets = await document((page) => {
      page.setCropBox(0, 0, 72, 72);
      page.node.set(PDFName.of('UserUnit'), PDFNumber.of(2));
    });
    const page = (await lirePdf(octets)).pages[0];
    assert.deepEqual(page.cropBox, { x: 0, y: 0, largeur: 25.4, hauteur: 25.4 });
    assert.equal(page.userUnit, 2);
  });

  test("chaque police de page se nomme, avec ou sans ToUnicode : une police embarquée en porte une, une police standard non", async () => {
    const octets = await document(async (page, pdf) => {
      page.drawText('a', { x: 10, y: 10, size: 10, font: await noto(pdf) });
      page.drawText('b', { x: 10, y: 30, size: 10, font: await pdf.embedFont(StandardFonts.Helvetica) });
    });
    const { polices } = await lirePdf(octets);
    assert.equal(polices.length, 2);
    const parNom = (motif) => polices.find(({ nom }) => motif.test(nom));
    assert.equal(parNom(/NotoSans/).toUnicode, true);
    assert.equal(parNom(/^Helvetica$/).toUnicode, false);
  });

  test("chaque police de page rend la longueur de son programme FontFile2, décodé : le .ttf entier hors sous-ensemble, moins en sous-ensemble ; null sans programme", async () => {
    const { regulier, gras } = lirePolices();
    const octets = await document(async (page, pdf) => {
      page.drawText('a', { x: 10, y: 10, size: 10, font: await pdf.embedFont(regulier, { subset: true }) });
      page.drawText('b', { x: 10, y: 30, size: 10, font: await pdf.embedFont(gras, { subset: false }) });
      page.drawText('c', { x: 10, y: 50, size: 10, font: await pdf.embedFont(StandardFonts.Helvetica) });
    });
    const { polices } = await lirePdf(octets);
    const parNom = (motif) => polices.find(({ nom }) => motif.test(nom));
    assert.equal(parNom(/NotoSans-Bold/).fontFile2, gras.length);
    const sousEnsemble = parNom(/NotoSans-Regular/).fontFile2;
    assert.ok(sousEnsemble > 0 && sousEnsemble < regulier.length / 10, `sous-ensemble de ${sousEnsemble} octets`);
    assert.equal(parNom(/^Helvetica$/).fontFile2, null);
  });

  test("/Info absent : [] ; posé : ses clés ; /ID se voit dans la remorque", async () => {
    assert.deepEqual(await lirePdf(await document(() => {})).then(({ info, id }) => ({ info, id })), { info: [], id: false });
    const octets = await document(
      () => {},
      {
        avant: async (pdf) => {
          pdf.getInfoDict().set(PDFName.of('CreationDate'), PDFString.of("D:20261009190000-04'00'"));
          const identifiant = PDFHexString.of('00112233445566778899aabbccddeeff');
          pdf.context.trailerInfo.ID = PDFArray.withContext(pdf.context);
          pdf.context.trailerInfo.ID.push(identifiant);
          pdf.context.trailerInfo.ID.push(identifiant);
        },
      },
    );
    const lu = await lirePdf(octets);
    assert.deepEqual(lu.info, ['CreationDate']);
    assert.equal(lu.id, true);
  });

  test("les octets reçus ne sont pas détachés par la lecture : une seconde lecture des mêmes octets rend la même chose", async () => {
    const octets = await document(async (page, pdf) => {
      page.drawText('Ondine Lacasse', { x: 10, y: 10, size: 10, font: await noto(pdf) });
    });
    const premiere = await lirePdf(octets);
    assert.deepEqual(await lirePdf(octets), premiere);
  });
});
