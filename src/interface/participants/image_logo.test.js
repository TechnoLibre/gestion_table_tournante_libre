// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les règles pures de la conversion d'un logo (participants/image_logo.js) :
// la taille du PNG d'une image matricielle — plus grand côté d'au plus
// LOGO_PARTICIPANT_COTE_MAX, proportions gardées, jamais agrandie —, celle
// d'un SVG, porté à ce plus grand côté, la reconnaissance d'un SVG par son
// nom ou ses premiers octets, et le plafond des pixels d'une source, refusé
// par LOGO_TROP_GRAND. Le décodage et l'encodage, qui demandent un moteur de
// rendu, s'éprouvent dans image_logo.navigateur.test.js. Les noms de
// fichier sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { LOGO_PARTICIPANT_COTE_MAX } from '../../application/seance.js';
import { LOGO_PIXELS_MAX, estSvg, exigerPixels, tailleDuLogo, tailleDuSvg } from './image_logo.js';

const octetsDe = (texte) => new TextEncoder().encode(texte);

describe('la taille du PNG d’un logo (§ 8.9)', () => {
  test('une image qui tient dans le plus grand côté garde sa taille, sans jamais être agrandie', () => {
    assert.deepEqual(tailleDuLogo(500, 300), { largeur: 500, hauteur: 300 });
    assert.deepEqual(tailleDuLogo(1, 1), { largeur: 1, hauteur: 1 });
    assert.deepEqual(tailleDuLogo(LOGO_PARTICIPANT_COTE_MAX, 7), { largeur: LOGO_PARTICIPANT_COTE_MAX, hauteur: 7 });
    assert.deepEqual(tailleDuLogo(9, LOGO_PARTICIPANT_COTE_MAX), { largeur: 9, hauteur: LOGO_PARTICIPANT_COTE_MAX });
  });

  test('une image plus grande se réduit : son plus grand côté au plafond, l’autre en proportion, arrondi', () => {
    assert.equal(LOGO_PARTICIPANT_COTE_MAX, 1200);
    assert.deepEqual(tailleDuLogo(3000, 1500), { largeur: 1200, hauteur: 600 });
    assert.deepEqual(tailleDuLogo(1500, 3000), { largeur: 600, hauteur: 1200 });
    assert.deepEqual(tailleDuLogo(1201, 1201), { largeur: 1200, hauteur: 1200 });
    // 1000 × 1200 / 3001 = 399,87 : arrondi à 400.
    assert.deepEqual(tailleDuLogo(3001, 1000), { largeur: 1200, hauteur: 400 });
  });

  test('un côté minuscule devant l’autre garde au moins un pixel', () => {
    assert.deepEqual(tailleDuLogo(100_000, 3), { largeur: 1200, hauteur: 1 });
    assert.deepEqual(tailleDuLogo(2, 90_000), { largeur: 1, hauteur: 1200 });
  });

  test('un côté qui n’est pas un entier strictement positif lève TypeError', () => {
    const fautifs = [[0, 10], [10, 0], [-3, 10], [1.5, 10], [10, Number.NaN], ['10', 10], [10, Infinity]];
    for (const [largeur, hauteur] of fautifs) {
      assert.throws(() => tailleDuLogo(largeur, hauteur), TypeError, `${largeur} × ${hauteur}`);
    }
  });

  test('un SVG, sans résolution propre, se rastérise à son plus grand côté au plafond, proportions gardées, plus petit ou plus grand', () => {
    assert.deepEqual(tailleDuSvg(100, 50), { largeur: 1200, hauteur: 600 });
    assert.deepEqual(tailleDuSvg(4000, 8000), { largeur: 600, hauteur: 1200 });
    assert.deepEqual(tailleDuSvg(1200, 1200), { largeur: 1200, hauteur: 1200 });
    assert.deepEqual(tailleDuSvg(3000, 1), { largeur: 1200, hauteur: 1 });
    assert.throws(() => tailleDuSvg(0, 50), TypeError);
  });
});

describe('la reconnaissance d’un SVG', () => {
  test('par l’extension de son nom, quelle que soit la casse', () => {
    assert.equal(estSvg(octetsDe('rien'), 'emblème.svg'), true);
    assert.equal(estSvg(octetsDe('rien'), 'EMBLEME.SVG'), true);
    assert.equal(estSvg(octetsDe('rien'), 'emblème.svg.png'), false);
    assert.equal(estSvg(octetsDe('rien'), null), false);
  });

  test('par ses premiers octets : un texte qui s’ouvre sur une balise et porte <svg>, déclaration, commentaire et BOM admis', () => {
    assert.equal(estSvg(octetsDe('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'logo'), true);
    const prefacee = octetsDe('\u{FEFF}  <?xml version="1.0"?>\n<!-- un pré -->\n<svg width="4">');
    assert.equal(estSvg(prefacee, 'sans-extension'), true);
    assert.equal(estSvg(octetsDe('<SVG>'), 'x'), true);
    assert.equal(estSvg(octetsDe('<html><body>pas un svg</body></html>'), 'page.htm'), false);
    assert.equal(estSvg(octetsDe('texte qui cite <svg> plus loin'), 'note.txt'), false);
    assert.equal(estSvg(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image.png'), false);
  });

  test('une image matricielle nommée « .svg » ne se prend pas pour un SVG', () => {
    const entetes = [
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      [0xff, 0xd8, 0xff, 0xe0],
      [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
      [0x42, 0x4d, 0x36, 0x00],
      [0x00, 0x00, 0x01, 0x00, 0x01, 0x00],
      [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
      [0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66],
    ];
    for (const entete of entetes) assert.equal(estSvg(new Uint8Array(entete), 'emblème.svg'), false, String(entete));
  });

  test('une balise <svg> au-delà des premiers 4 096 octets ne compte pas', () => {
    const loin = `<?xml version="1.0"?><!--${'-'.repeat(4096)}--><svg/>`;
    assert.equal(estSvg(octetsDe(loin), 'loin'), false);
  });
});

describe('le plafond des pixels d’une source', () => {
  test('LOGO_PIXELS_MAX vaut 50 millions de pixels : une photo de 48 millions passe', () => {
    assert.equal(LOGO_PIXELS_MAX, 50_000_000);
    assert.doesNotThrow(() => exigerPixels(8000, 6000, 'photo.jpg'));
    assert.doesNotThrow(() => exigerPixels(10_000, 5000, 'photo.jpg'));
  });

  test('au-delà, LOGO_TROP_GRAND nomme le fichier, ses côtés et le plafond, sans remède', () => {
    assert.throws(
      () => exigerPixels(10_000, 5001, 'affiche géante.png'),
      (erreur) => {
        assert.equal(erreur.code, 'LOGO_TROP_GRAND');
        const attendus = { fichier: 'affiche géante.png', largeur: 10_000, hauteur: 5001, max: LOGO_PIXELS_MAX, remede: null };
        assert.deepEqual(erreur.details, attendus);
        return true;
      },
    );
  });

  test('un plafond donné remplace le plafond par défaut', () => {
    assert.doesNotThrow(() => exigerPixels(100, 100, 'x.png', 10_000));
    const refuse = (erreur) => erreur.code === 'LOGO_TROP_GRAND' && erreur.details.max === 10_000;
    assert.throws(() => exigerPixels(101, 100, 'x.png', 10_000), refuse);
  });
});
