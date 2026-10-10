// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves sous node des commandes des captures qui touchent au PDF de la
// planche (§ 19.5, § 19.6) : tramerPdf lit chaque page demandée — texte,
// traits, taille à 96 ppp —, la trame en PNG sous le dossier d'attente quand
// on le lui demande, et refuse en nommant le canevas quand il manque ; la
// publication admet, à côté des captures du navigateur, une page de PDF à la
// taille de sa page. Chaque épreuve travaille dans un dossier d'épreuve
// (dossierEpreuve), effacé à la fin.
//
// Les PDF des épreuves se construisent ici par pdf-lib, une fois par
// fichier : le premier, une page A4 qui porte un trait de 100 mm et une ligne
// de texte, une page A6 qui porte un nom inventé, dans la police embarquée ;
// le second, deux pages vides aux dimensions de deux cadres d'écran. Toute
// image s'écrit par tramerPdf : l'épreuve n'écrit rien elle-même.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, grayscale } from 'pdf-lib';
import { describe, test } from '../lanceur.js';
import { lirePolices } from '../polices.js';
import { VERSION } from '../../src/version.genere.js';
import { CHEMIN_MANIFESTE, DOSSIER_CAPTURES, lireEntetePng } from '../../scripts/documentation/manifeste.js';
import {
  COMMANDES,
  MODE_TRAMAGE,
  PPP_TRAMAGE,
  canevasDisponible,
  chargerCanevas,
  deposerCapture,
  dossierEpreuve,
  effacerDossierEpreuve,
  empreintesDossier,
  lireManifeste,
  publierCaptures,
  tramer,
  tramerPdf,
} from './commandes_documentation.js';

const sha256 = (octets) => createHash('sha256').update(octets).digest('hex');
const enBase64 = (octets) => Buffer.from(octets).toString('base64');

// Le point typographique et le pixel CSS, en millimètres.
const PT_PAR_MM = 72 / 25.4;
const PX_PAR_MM = 96 / 25.4;

// Les deux pages du PDF des épreuves, en mm, et ce que chacune porte.
const A4 = Object.freeze({ largeur: 210, hauteur: 297 });
const A6 = Object.freeze({ largeur: 105, hauteur: 148 });
const LIGNE_A4 = 'Feuille témoin';
const NOM_A6 = 'Ondine Lacasse';
// Le trait de la page A4 : 100 mm, à 20 mm du bord gauche et 30 mm du haut.
const TRAIT = Object.freeze({ x: 20, y: 30, longueur: 100 });

// La racine neutre des textes relevés : inventée, elle n'existe nulle part
// ailleurs dans le dépôt.
const RACINE_NEUTRE = 'C:\\Seance\\Tables';

// Le dossier d'attente d'une racine, et le chemin d'une image déposée.
const ATTENTE = `${DOSSIER_CAPTURES}/.attente`;
const deposee = (racine, fichier) => join(racine, ATTENTE, `${fichier}.png`);

// La taille attendue d'une page à 96 ppp : ses millimètres en pixels CSS,
// arrondis à l'entier.
const enPixels = ({ largeur, hauteur }) => ({ largeur: Math.round(largeur * PX_PAR_MM), hauteur: Math.round(hauteur * PX_PAR_MM) });

async function construirePdf() {
  const document = await PDFDocument.create({ updateMetadata: false });
  document.registerFontkit(fontkit);
  const police = await document.embedFont(lirePolices().regulier, { subset: true });
  const a4 = document.addPage([A4.largeur * PT_PAR_MM, A4.hauteur * PT_PAR_MM]);
  const yTrait = (A4.hauteur - TRAIT.y) * PT_PAR_MM;
  a4.drawLine({
    start: { x: TRAIT.x * PT_PAR_MM, y: yTrait },
    end: { x: (TRAIT.x + TRAIT.longueur) * PT_PAR_MM, y: yTrait },
    thickness: 0.5,
    color: grayscale(0),
  });
  a4.drawText(LIGNE_A4, { x: TRAIT.x * PT_PAR_MM, y: yTrait - 40, size: 14, font: police, color: grayscale(0) });
  const a6 = document.addPage([A6.largeur * PT_PAR_MM, A6.hauteur * PT_PAR_MM]);
  a6.drawText(NOM_A6, { x: 30, y: 200, size: 18, font: police, color: grayscale(0) });
  return document.save();
}

// Deux pages vides de la taille de deux cadres d'écran, en px CSS : le
// cadre des captures du navigateur, et un autre.
const ECRAN = Object.freeze({ largeur: 1366, hauteur: 700 });
const AUTRE_ECRAN = Object.freeze({ largeur: 1280, hauteur: 700 });
async function construireEcrans() {
  const document = await PDFDocument.create({ updateMetadata: false });
  for (const { largeur, hauteur } of [ECRAN, AUTRE_ECRAN]) document.addPage([(largeur * 72) / 96, (hauteur * 72) / 96]);
  return document.save();
}

const OCTETS = await construirePdf();
const B64 = enBase64(OCTETS);
const PAGES = Object.freeze([
  { page: 1, fichier: '24-badges-controle' },
  { page: 2, fichier: '25-badges-planche' },
]);

// Un chargeur de canevas qui échoue comme un paquet optionnel absent.
const canevasAbsent = () => {
  const erreur = new Error("Cannot find module '@napi-rs/canvas'");
  erreur.code = 'MODULE_NOT_FOUND';
  throw erreur;
};

// Exécute faire(racine) dans un dossier d'épreuve neuf, effacé ensuite.
async function dansUnDossier(faire) {
  const racine = await dossierEpreuve();
  try {
    return await faire(racine);
  } finally {
    await effacerDossierEpreuve(null, racine);
  }
}

// La raison d'un saut quand le canevas manque : le tramage ne s'éprouve que
// là où make captures peut tramer.
const SANS_CANEVAS = 'le canevas de pdfjs (@napi-rs/canvas) manque sur ce système : le tramage ne s’y éprouve pas';

// Le nombre de pixels d'une image PNG plus sombres que le gris moyen.
async function pixelsSombres(octets) {
  const { createCanvas, loadImage } = chargerCanevas();
  const image = await loadImage(Buffer.from(octets));
  const canevas = createCanvas(image.width, image.height);
  const contexte = canevas.getContext('2d');
  contexte.drawImage(image, 0, 0);
  const { data } = contexte.getImageData(0, 0, image.width, image.height);
  let sombres = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i] + data[i + 1] + data[i + 2] < 3 * 128) sombres += 1;
  return sombres;
}

describe('tramerPdf : la lecture des pages d’un PDF (§ 19.6)', () => {
  test('déclarée parmi les commandes, exportée sous son nom', () => {
    assert.ok(COMMANDES.includes('tramerPdf'));
    assert.equal(typeof tramerPdf, 'function');
  });

  test('sans écrire : le texte, les traits et la taille à 96 ppp de chaque page demandée, l’empreinte des octets ; aucun canevas chargé, rien d’écrit', async () => {
    await dansUnDossier(async (racine) => {
      const lu = await tramer({ octetsB64: B64, pages: PAGES, racine, ecrire: false }, { chargerCanevas: canevasAbsent });
      assert.equal(lu.pdf, sha256(OCTETS));
      assert.equal(lu.mode, MODE_TRAMAGE);
      assert.equal(PPP_TRAMAGE, 96);
      assert.deepEqual(
        lu.pages.map(({ fichier, page, cadre, chemin }) => ({ fichier, page, cadre, chemin })),
        [
          { fichier: '24-badges-controle', page: 1, cadre: enPixels(A4), chemin: null },
          { fichier: '25-badges-planche', page: 2, cadre: enPixels(A6), chemin: null },
        ],
      );
      assert.deepEqual(enPixels(A4), { largeur: 794, hauteur: 1123 });
      assert.deepEqual(lu.pages[0].textes, [LIGNE_A4]);
      assert.deepEqual(lu.pages[1].textes, [NOM_A6]);
      // pdf-lib écrit ses coordonnées en points à six décimales au plus.
      const pres = (a, b) => Math.abs(a - b) < 1e-3;
      const horizontaux = lu.pages[0].segments.filter(({ y1, y2 }) => pres(y1, y2));
      assert.equal(horizontaux.length, 1);
      const [trait] = horizontaux;
      assert.ok(pres(Math.abs(trait.x2 - trait.x1), TRAIT.longueur), JSON.stringify(trait));
      assert.ok(pres(trait.y1, TRAIT.y), JSON.stringify(trait));
      assert.deepEqual(lu.pages[1].segments, []);
      assert.deepEqual(await empreintesDossier(null, { racine }), []);
    });
  });

  test('une seule page, la seconde : seule lue', async () => {
    const lu = await tramer({ octetsB64: B64, pages: [PAGES[1]], ecrire: false }, { chargerCanevas: canevasAbsent });
    assert.deepEqual(lu.pages.map(({ fichier, textes }) => [fichier, textes]), [['25-badges-planche', [NOM_A6]]]);
  });

  test('refus nommés, rien d’écrit : octets hors du base64, PDF illisible, aucune page, page hors du document, nom refusé, nom en double', async () => {
    await dansUnDossier(async (racine) => {
      const essayer = (args) => tramer({ racine, ecrire: true, ...args }, { chargerCanevas: canevasAbsent });
      await assert.rejects(essayer({ octetsB64: 42, pages: PAGES }), /tramerPdf : octetsB64/);
      await assert.rejects(essayer({ octetsB64: 'pas du base64 !', pages: PAGES }), /tramerPdf : octetsB64/);
      await assert.rejects(essayer({ octetsB64: enBase64(new TextEncoder().encode('%PDF-1.7 tronqué')), pages: PAGES }), /tramerPdf : PDF illisible/);
      await assert.rejects(essayer({ octetsB64: B64, pages: [] }), /tramerPdf : aucune page demandée/);
      await assert.rejects(essayer({ octetsB64: B64, pages: [{ page: 3, fichier: '25-badges-planche' }] }), /tramerPdf : page 3 hors du document de 2 pages/);
      await assert.rejects(essayer({ octetsB64: B64, pages: [{ page: 0, fichier: '25-badges-planche' }] }), /tramerPdf : page 0 hors du document de 2 pages/);
      await assert.rejects(essayer({ octetsB64: B64, pages: [{ page: 1, fichier: '../hors' }] }), /nom de capture refusé/);
      await assert.rejects(
        essayer({ octetsB64: B64, pages: [PAGES[0], { page: 2, fichier: PAGES[0].fichier }] }),
        /tramerPdf : « 24-badges-controle » demandée deux fois/,
      );
      assert.deepEqual(await empreintesDossier(null, { racine }), []);
    });
  });
});

describe('tramerPdf : le tramage, sous make captures (§ 19.6, décision 2)', () => {
  test('canevas absent : le refus nomme le paquet, sa cause et make captures ; rien d’écrit', async () => {
    await dansUnDossier(async (racine) => {
      await assert.rejects(
        tramer({ octetsB64: B64, pages: PAGES, racine, ecrire: true }, { chargerCanevas: canevasAbsent }),
        (erreur) => {
          assert.match(erreur.message, /^tramerPdf : le canevas « @napi-rs\/canvas » manque/);
          assert.match(erreur.message, /make captures/);
          assert.match(erreur.message, /Cannot find module/);
          return true;
        },
      );
      assert.deepEqual(await empreintesDossier(null, { racine }), []);
    });
  });

  test('chaque page demandée tramée en PNG sous le dossier d’attente, à la taille de sa page à 96 ppp, son encre rendue', async (contexte) => {
    if (!canevasDisponible()) contexte.skip(SANS_CANEVAS);
    await dansUnDossier(async (racine) => {
      const lu = await tramerPdf(null, { octetsB64: B64, pages: PAGES, racine });
      assert.equal(lu.pdf, sha256(OCTETS));
      for (const [rang, format] of [A4, A6].entries()) {
        const { fichier, chemin, cadre } = lu.pages[rang];
        assert.equal(chemin, deposee(racine, fichier));
        const octets = new Uint8Array(await readFile(chemin));
        assert.deepEqual(lireEntetePng(octets), enPixels(format), fichier);
        assert.deepEqual(cadre, enPixels(format), fichier);
        assert.ok((await pixelsSombres(octets)) > 0, `${fichier} : aucune encre tramée`);
      }
      const ecrits = (await empreintesDossier(null, { racine })).map(([chemin]) => chemin);
      assert.deepEqual(ecrits, [`${ATTENTE}/24-badges-controle.png`, `${ATTENTE}/25-badges-planche.png`]);
    });
  });

  test('les mêmes octets de PDF donnent les mêmes octets de PNG', async (contexte) => {
    if (!canevasDisponible()) contexte.skip(SANS_CANEVAS);
    const tramees = [];
    for (let fois = 0; fois < 2; fois += 1) {
      tramees.push(
        await dansUnDossier(async (racine) => {
          const { pages } = await tramerPdf(null, { octetsB64: B64, pages: PAGES, racine });
          return Promise.all(pages.map(async ({ chemin }) => sha256(await readFile(chemin))));
        }),
      );
    }
    assert.deepEqual(tramees[1], tramees[0]);
    assert.notEqual(tramees[0][0], tramees[0][1]);
  });
});

// Le contexte de commande que lit la publication : la version du navigateur,
// inconnue ici.
const CONTEXTE = Object.freeze({ page: { context: () => ({ browser: () => null }) } });

const ECRANS = await construireEcrans();

// Dépose sous le dossier d'attente une capture de la source donnée : la page
// donnée, tramée par tramerPdf, en est l'image, et sa taille le cadre. Une
// page de PDF se tire du PDF des épreuves, une capture du navigateur des
// pages d'écran.
async function deposer(racine, { fichier, etape, source, page }) {
  const octets = source === 'pdf' ? OCTETS : ECRANS;
  const { pdf, mode, pages } = await tramerPdf(null, { octetsB64: enBase64(octets), pages: [{ page, fichier }], racine });
  const [{ cadre, chemin }] = pages;
  const entree = {
    fichier,
    etape,
    source,
    versionReelle: VERSION.affichee,
    graine: null,
    cadre,
    facteurEchelle: 1,
    mode: source === 'pdf' ? mode : 'chromium-headless-shell',
    theme: 'clair',
    instant: '2031-05-06T20:15:00-04:00',
    texte: [fichier],
    styles: { clair: [], sombre: [] },
    etat: null,
    pdf: source === 'pdf' ? pdf : null,
  };
  return deposerCapture(null, { fichier, entree, chemin, racine });
}

// Les images s'y écrivent par tramerPdf : sans canevas, ces épreuves ne
// s'y jouent pas.
describe('publierCaptures : une page de PDF à côté des captures du navigateur (§ 19.5, § 19.6)', () => {
  test('une capture du navigateur et une page de PDF de cadres différents se publient ensemble ; le pilote porte le cadre du navigateur', async (contexte) => {
    if (!canevasDisponible()) contexte.skip(SANS_CANEVAS);
    await dansUnDossier(async (racine) => {
      await deposer(racine, { fichier: '01-premier-ecran', etape: '1', source: 'navigateur', page: 1 });
      await deposer(racine, { fichier: '24-badges-controle', etape: '12', source: 'pdf', page: 1 });
      const bilan = await publierCaptures(CONTEXTE, {
        declarees: ['01-premier-ecran', '24-badges-controle'],
        racine,
        racineNeutre: RACINE_NEUTRE,
      });
      assert.deepEqual(bilan.ecrites, ['01-premier-ecran', '24-badges-controle']);
      const manifeste = await lireManifeste(null, { racine });
      assert.deepEqual(manifeste.pilote.cadre, ECRAN);
      assert.deepEqual(
        manifeste.captures.map(({ fichier, source, cadre, pdf }) => ({ fichier, source, cadre, pdf })),
        [
          { fichier: '01-premier-ecran', source: 'navigateur', cadre: ECRAN, pdf: null },
          { fichier: '24-badges-controle', source: 'pdf', cadre: enPixels(A4), pdf: sha256(OCTETS) },
        ],
      );
      const ecrits = (await empreintesDossier(null, { racine })).map(([chemin]) => chemin);
      assert.deepEqual(ecrits, [`${DOSSIER_CAPTURES}/01-premier-ecran.png`, `${DOSSIER_CAPTURES}/24-badges-controle.png`, CHEMIN_MANIFESTE]);
    });
  });

  test('deux captures du navigateur de cadres différents refusent toujours la publication, rien de publié', async (contexte) => {
    if (!canevasDisponible()) contexte.skip(SANS_CANEVAS);
    await dansUnDossier(async (racine) => {
      await deposer(racine, { fichier: '01-premier-ecran', etape: '1', source: 'navigateur', page: 1 });
      await deposer(racine, { fichier: '02-import-apercu', etape: '2', source: 'navigateur', page: 2 });
      await assert.rejects(
        publierCaptures(CONTEXTE, { declarees: ['01-premier-ecran', '02-import-apercu'], racine, racineNeutre: RACINE_NEUTRE }),
        /publication : 02-import-apercu n’a pas le cadre ni le facteur d’échelle de 01-premier-ecran/,
      );
      assert.deepEqual(await empreintesDossier(null, { racine }), []);
    });
  });

  test('une page de PDF seule, sans capture du navigateur, ne donne aucun pilote : refusée, rien de publié', async (contexte) => {
    if (!canevasDisponible()) contexte.skip(SANS_CANEVAS);
    await dansUnDossier(async (racine) => {
      await deposer(racine, { fichier: '24-badges-controle', etape: '12', source: 'pdf', page: 1 });
      await assert.rejects(
        publierCaptures(CONTEXTE, { declarees: ['24-badges-controle'], racine, racineNeutre: RACINE_NEUTRE }),
        /publication : aucune capture du navigateur/,
      );
      assert.deepEqual(await empreintesDossier(null, { racine }), []);
    });
  });
});
