// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La conversion d'un logo dans un vrai moteur de rendu (§ 8.9, § 10.2) :
// une image que le moteur décode devient un PNG d'au plus
// LOGO_PARTICIPANT_COTE_MAX pixels de côté, proportions gardées, jamais
// agrandi, transparence comprise ; l'orientation EXIF d'une photo
// s'applique ; un SVG se rastérise à ce plus grand côté ; des octets
// illisibles, une photo HEIC ou une image TIFF se refusent par
// LOGO_ILLISIBLE, une source de trop de pixels par LOGO_TROP_GRAND, sans
// que createImageBitmap soit appelé ; l'adresse blob: de la source se
// libère quoi qu'il arrive. Chaque image d'épreuve se compose dans
// l'épreuve, sur un canevas hors du document ; les noms de fichier sont
// inventés.
import { describe, expect, test } from 'vitest';
import { LOGO_PARTICIPANT_COTE_MAX } from '../../application/seance.js';
import { lirePng } from '../../pdf/png.js';
import { convertirLogo } from './image_logo.js';

const ROUGE = [220, 30, 30, 255];
const BLEU = [30, 30, 220, 255];

// Les octets d'une image largeur × hauteur, moitié gauche rouge, moitié
// droite bleue, encodée sous le type donné ; dessiner, quand il est donné,
// peint le canevas à la place.
async function image(largeur, hauteur, { type = 'image/png', dessiner = null } = {}) {
  const canevas = new OffscreenCanvas(largeur, hauteur);
  const contexte = canevas.getContext('2d');
  if (dessiner !== null) dessiner(contexte);
  else {
    contexte.fillStyle = `rgb(${ROUGE.slice(0, 3).join(',')})`;
    contexte.fillRect(0, 0, Math.ceil(largeur / 2), hauteur);
    contexte.fillStyle = `rgb(${BLEU.slice(0, 3).join(',')})`;
    contexte.fillRect(Math.ceil(largeur / 2), 0, largeur, hauteur);
  }
  const blob = await canevas.convertToBlob({ type, quality: 1 });
  return new Uint8Array(await blob.arrayBuffer());
}

// Les pixels RGBA d'un PNG, décodé par le moteur : {largeur, hauteur, pixel(x, y)}.
async function pixels(octets) {
  const bitmap = await createImageBitmap(new Blob([octets], { type: 'image/png' }));
  const canevas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const contexte = canevas.getContext('2d');
  contexte.drawImage(bitmap, 0, 0);
  const donnees = contexte.getImageData(0, 0, bitmap.width, bitmap.height).data;
  const largeur = bitmap.width;
  bitmap.close();
  return {
    largeur,
    hauteur: canevas.height,
    pixel: (x, y) => [...donnees.slice((y * largeur + x) * 4, (y * largeur + x) * 4 + 4)],
  };
}

// Deux couleurs proches à une tolérance près, canal par canal : un JPEG
// n'est pas exact.
function proche(recue, attendue, tolerance = 40) {
  expect(recue.length).toBe(4);
  for (let canal = 0; canal < 4; canal += 1) {
    const ecart = Math.abs(recue[canal] - attendue[canal]);
    expect(ecart, `canal ${canal} de ${recue} contre ${attendue}`).toBeLessThanOrEqual(tolerance);
  }
}

// Un JPEG dont le segment APP1 Exif, posé juste après SOI, porte
// l'orientation donnée : un en-tête TIFF gros-boutiste, un IFD d'une
// entrée, l'étiquette 0x0112 de type SHORT.
function avecOrientation(jpeg, orientation) {
  expect([jpeg[0], jpeg[1]]).toEqual([0xff, 0xd8]);
  const entree = [0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0];
  const tiff = [0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8, 0, 1, ...entree, 0, 0, 0, 0];
  const charge = [...new TextEncoder().encode('Exif'), 0, 0, ...tiff];
  const longueur = charge.length + 2;
  const segment = [0xff, 0xe1, longueur >> 8, longueur & 0xff, ...charge];
  return new Uint8Array([0xff, 0xd8, ...segment, ...jpeg.slice(2)]);
}

const texte = (contenu) => new TextEncoder().encode(contenu);

// Le refus attendu d'une conversion : son code et ses détails.
async function refus(promesse) {
  try {
    await promesse;
  } catch (erreur) {
    return { code: erreur.code, details: erreur.details };
  }
  throw new Error('la conversion devait refuser');
}

// Ce que rend ou lève agir, et, pendant qu'il court, les adresses blob:
// créées et libérées, puis le nombre d'appels à createImageBitmap ; les
// fonctions d'origine reviennent quoi qu'il arrive.
async function sonder(agir) {
  const { createObjectURL: creer, revokeObjectURL: liberer } = URL;
  const decoder = globalThis.createImageBitmap;
  const sonde = { creees: [], liberees: [], decodages: 0, erreur: null };
  URL.createObjectURL = (objet) => {
    const adresse = creer.call(URL, objet);
    sonde.creees.push(adresse);
    return adresse;
  };
  URL.revokeObjectURL = (adresse) => {
    sonde.liberees.push(adresse);
    liberer.call(URL, adresse);
  };
  globalThis.createImageBitmap = (...args) => {
    sonde.decodages += 1;
    return decoder.apply(globalThis, args);
  };
  try {
    sonde.resultat = await agir();
  } catch (erreur) {
    sonde.erreur = erreur;
  } finally {
    URL.createObjectURL = creer;
    URL.revokeObjectURL = liberer;
    globalThis.createImageBitmap = decoder;
  }
  return sonde;
}

// Chaque adresse blob: créée par la conversion est libérée, une fois.
function toutLibere(sonde, message) {
  expect(sonde.creees.length, message).toBeGreaterThan(0);
  expect([...sonde.liberees].sort(), message).toEqual([...sonde.creees].sort());
}

describe('la conversion d’un logo en PNG (§ 8.9)', () => {
  test('3000 × 1500 devient un PNG de 1200 × 600, que lirePng accepte, ses deux moitiés gardées', async () => {
    const png = await convertirLogo(await image(3000, 1500), { fichier: 'bandeau.png' });
    expect(lirePng(png)).toEqual({ largeur: 1200, hauteur: 600 });
    const vue = await pixels(png);
    proche(vue.pixel(100, 300), ROUGE, 2);
    proche(vue.pixel(1100, 300), BLEU, 2);
  });

  test('une image haute se réduit sur sa hauteur ; 500 × 300 reste 500 × 300, jamais agrandie', async () => {
    const haute = await convertirLogo(await image(900, 2400), { fichier: 'oriflamme.png' });
    expect(lirePng(haute)).toEqual({ largeur: 450, hauteur: 1200 });
    const petit = await convertirLogo(await image(500, 300), { fichier: 'vignette.png' });
    expect(lirePng(petit)).toEqual({ largeur: 500, hauteur: 300 });
    expect(Math.max(...Object.values(lirePng(petit)))).toBeLessThanOrEqual(LOGO_PARTICIPANT_COTE_MAX);
  });

  test('la transparence passe au PNG', async () => {
    const source = await image(40, 20, {
      dessiner: (contexte) => {
        contexte.fillStyle = 'rgb(20, 120, 40)';
        contexte.fillRect(0, 0, 20, 20);
      },
    });
    const vue = await pixels(await convertirLogo(source, { fichier: 'découpe.png' }));
    expect(vue.pixel(30, 10)[3]).toBe(0);
    proche(vue.pixel(10, 10), [20, 120, 40, 255], 2);
  });

  test('un JPEG d’orientation EXIF 6 — tourné d’un quart de tour horaire — passe de 2 × 1 à 1 × 2, puis de 40 × 20 à 20 × 40, sa moitié gauche en haut', async () => {
    const minuscule = avecOrientation(await image(2, 1, { type: 'image/jpeg' }), 6);
    expect(lirePng(await convertirLogo(minuscule, { fichier: 'photo.jpg' }))).toEqual({ largeur: 1, hauteur: 2 });
    const photo = avecOrientation(await image(40, 20, { type: 'image/jpeg' }), 6);
    const png = await convertirLogo(photo, { fichier: 'photo.jpg' });
    expect(lirePng(png)).toEqual({ largeur: 20, hauteur: 40 });
    const vue = await pixels(png);
    proche(vue.pixel(10, 5), ROUGE);
    proche(vue.pixel(10, 35), BLEU);
    // Sans orientation, la même photo reste couchée.
    const couchee = await convertirLogo(await image(40, 20, { type: 'image/jpeg' }), { fichier: 'photo.jpg' });
    expect(lirePng(couchee)).toEqual({ largeur: 40, hauteur: 20 });
  });

  test('un SVG de 100 × 50 se rastérise en 1200 × 600, reconnu par son nom ou par ses octets', async () => {
    const svg = texte(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50">' +
        '<rect width="50" height="50" fill="rgb(220,30,30)"/><rect x="50" width="50" height="50" fill="rgb(30,30,220)"/>' +
        '</svg>',
    );
    for (const fichier of ['emblème.svg', 'emblème-sans-extension']) {
      const png = await convertirLogo(svg, { fichier });
      expect(lirePng(png), fichier).toEqual({ largeur: 1200, hauteur: 600 });
      const vue = await pixels(png);
      proche(vue.pixel(300, 300), ROUGE, 2);
      proche(vue.pixel(900, 300), BLEU, 2);
    }
  });

  test('un SVG sans largeur ni hauteur prend les proportions de sa viewBox', async () => {
    const svg = texte('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 10"><rect width="30" height="10"/></svg>');
    expect(lirePng(await convertirLogo(svg, { fichier: 'frise.svg' }))).toEqual({ largeur: 1200, hauteur: 400 });
  });

  test('des octets quelconques, une photo HEIC, une image TIFF, un texte : LOGO_ILLISIBLE, qui nomme le fichier, sans remède', async () => {
    const heic = new Uint8Array([0, 0, 0, 0x18, ...texte('ftypheic'), 0, 0, 0, 0, ...texte('mif1heic'), ...new Array(64).fill(0)]);
    const tiff = new Uint8Array([0x49, 0x49, 0x2a, 0, 8, 0, 0, 0, 0, 0, ...new Uint8Array(64)]);
    const quelconques = new Uint8Array(512).map((_, rang) => (rang * 73 + 11) % 256);
    for (const [fichier, octets] of [
      ['bruit.png', quelconques],
      ['IMG_0042.HEIC', heic],
      ['numérisation.tif', tiff],
      ['notes.txt', texte('pas une image')],
      ['vide.png', new Uint8Array(0)],
      ['cassé.svg', texte('<svg xmlns="http://www.w3.org/2000/svg"><rect')],
    ]) {
      const attendu = { code: 'LOGO_ILLISIBLE', details: { fichier, remede: null } };
      expect(await refus(convertirLogo(octets, { fichier })), fichier).toEqual(attendu);
    }
  });

  test('une source de plus de pixels que le plafond : LOGO_TROP_GRAND, ses côtés nommés, sans être décodée', async () => {
    const source = await image(300, 200);
    const refusee = await sonder(() => convertirLogo(source, { fichier: 'affiche.png', pixelsMax: 59_999 }));
    expect({ code: refusee.erreur?.code, details: refusee.erreur?.details }).toEqual({
      code: 'LOGO_TROP_GRAND',
      details: { fichier: 'affiche.png', largeur: 300, hauteur: 200, max: 59_999, remede: null },
    });
    expect(refusee.decodages, 'décodages avant le refus').toBe(0);
    const juste = await sonder(() => convertirLogo(source, { fichier: 'affiche.png', pixelsMax: 60_000 }));
    expect(juste.erreur).toBeNull();
    expect(lirePng(juste.resultat)).toEqual({ largeur: 300, hauteur: 200 });
    expect(juste.decodages).toBe(1);
  });

  test('l’adresse blob: de la source se libère, que la conversion aboutisse, lise mal ou refuse une image trop grande', async () => {
    const source = await image(300, 200);
    const reussie = await sonder(() => convertirLogo(source, { fichier: 'affiche.png' }));
    expect(reussie.erreur).toBeNull();
    toutLibere(reussie, 'aboutie');
    const svg = await sonder(() =>
      convertirLogo(texte('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="2"/>'), { fichier: 'trait.svg' }),
    );
    expect(svg.erreur).toBeNull();
    toutLibere(svg, 'SVG');
    const illisible = await sonder(() => convertirLogo(texte('pas une image'), { fichier: 'notes.png' }));
    expect(illisible.erreur?.code).toBe('LOGO_ILLISIBLE');
    toutLibere(illisible, 'LOGO_ILLISIBLE');
    const tropGrande = await sonder(() => convertirLogo(source, { fichier: 'affiche.png', pixelsMax: 10 }));
    expect(tropGrande.erreur?.code).toBe('LOGO_TROP_GRAND');
    toutLibere(tropGrande, 'LOGO_TROP_GRAND');
  });

  test('des octets qui ne sont pas un Uint8Array lèvent TypeError, une faute du code', async () => {
    await expect(convertirLogo([1, 2, 3], { fichier: 'x.png' })).rejects.toThrow(TypeError);
    await expect(convertirLogo(new ArrayBuffer(4), { fichier: 'x.png' })).rejects.toThrow(TypeError);
  });
});
