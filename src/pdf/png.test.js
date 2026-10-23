// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de la lecture d'un PNG (§ 8.9) : la signature, l'en-tête IHDR et
// le CRC de chaque morceau, contrôlés sans décoder l'image. Les PNG
// d'épreuve se composent ici, morceau par morceau ; le CRC de référence est
// celui de node:zlib, indépendant du module éprouvé, et les pixels sont
// compressés par deflateSync.
import assert from 'node:assert/strict';
import { crc32, deflateSync } from 'node:zlib';
import { describe, test } from '../../test/lanceur.js';
import { ErreurPng, lirePng } from './png.js';

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const ASCII = new TextEncoder();

// Un entier de 32 bits gros-boutiste, en quatre octets.
const mot = (n) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];

// Un morceau : sa longueur, son type, ses données, son CRC (type et
// données). crc remplace le CRC calculé, longueur la longueur annoncée.
function morceau(type, donnees = [], { crc = null, longueur = null } = {}) {
  const corps = [...ASCII.encode(type), ...donnees];
  return [...mot(longueur ?? donnees.length), ...corps, ...mot(crc ?? crc32(Uint8Array.from(corps)))];
}

// Les treize octets d'un IHDR.
function ihdr({ largeur = 1, hauteur = 1, profondeur = 8, couleur = 6, compression = 0, filtre = 0, entrelacement = 0 } = {}) {
  return [...mot(largeur), ...mot(hauteur), profondeur, couleur, compression, filtre, entrelacement];
}

// Les pixels d'une image largeur × hauteur en RVBA 8 bits, compressés :
// chaque ligne s'ouvre sur l'octet de filtre 0.
function pixels(largeur, hauteur) {
  const ligne = [0, ...Array.from({ length: largeur * 4 }, (_, i) => (i * 37) & 0xff)];
  return [...deflateSync(Uint8Array.from(Array.from({ length: hauteur }, () => ligne).flat()))];
}

// Un PNG bien formé : signature, IHDR, les morceaux donnés (un IDAT des
// pixels par défaut), IEND.
function png({ entete = {}, milieu = null } = {}) {
  const { largeur = 1, hauteur = 1 } = entete;
  const corps = milieu ?? [morceau('IDAT', pixels(largeur, hauteur))];
  return Uint8Array.from([...SIGNATURE, ...morceau('IHDR', ihdr(entete)), ...corps.flat(), ...morceau('IEND')]);
}

// La raison de l'ErreurPng que lève la lecture, ou « lu » quand elle rend.
function raisonDe(octets) {
  try {
    lirePng(octets);
    return 'lu';
  } catch (erreur) {
    if (!(erreur instanceof ErreurPng)) throw erreur;
    return erreur.raison;
  }
}

describe('lirePng : un PNG bien formé rend ses dimensions (§ 8.9)', () => {
  test('une image de 1 × 1 en RVBA, puis 3 × 2, 1200 × 600 et 1 × 1200 : la largeur et la hauteur de l’IHDR', () => {
    assert.deepEqual(lirePng(png()), { largeur: 1, hauteur: 1 });
    assert.deepEqual(lirePng(png({ entete: { largeur: 3, hauteur: 2 } })), { largeur: 3, hauteur: 2 });
    // Les pixels ne se décodent pas : un IDAT court suffit à une grande image.
    const court = [morceau('IDAT', pixels(1, 1))];
    assert.deepEqual(lirePng(png({ entete: { largeur: 1200, hauteur: 600 }, milieu: court })), { largeur: 1200, hauteur: 600 });
    assert.deepEqual(lirePng(png({ entete: { largeur: 1, hauteur: 1200 }, milieu: court })), { largeur: 1, hauteur: 1200 });
  });

  test('les dimensions vont jusqu’à 2^31 − 1, la borne du format', () => {
    const court = [morceau('IDAT', pixels(1, 1))];
    assert.deepEqual(lirePng(png({ entete: { largeur: 2 ** 31 - 1, hauteur: 7 }, milieu: court })), { largeur: 2 ** 31 - 1, hauteur: 7 });
  });

  test('chaque couple admis de profondeur et de type de couleur se lit ; une palette précède les données', () => {
    const ADMIS = [
      [0, [1, 2, 4, 8, 16]],
      [2, [8, 16]],
      [3, [1, 2, 4, 8]],
      [4, [8, 16]],
      [6, [8, 16]],
    ];
    for (const [couleur, profondeurs] of ADMIS) {
      for (const profondeur of profondeurs) {
        const milieu = [...(couleur === 3 ? [morceau('PLTE', [0, 0, 0])] : []), morceau('IDAT', [1, 2, 3])];
        assert.equal(raisonDe(png({ entete: { couleur, profondeur }, milieu })), 'lu', `${couleur}/${profondeur}`);
      }
    }
  });

  test('l’entrelacement Adam7, des morceaux annexes et plusieurs IDAT qui se suivent se lisent', () => {
    assert.equal(raisonDe(png({ entete: { entrelacement: 1 } })), 'lu');
    const annexes = [
      morceau('tEXt', [...ASCII.encode('Title'), 0, ...ASCII.encode('Logo')]),
      morceau('pHYs', [...mot(2835), ...mot(2835), 1]),
      morceau('IDAT', pixels(1, 1).slice(0, 4)),
      morceau('IDAT', pixels(1, 1).slice(4)),
      morceau('tIME', [7, 235, 5, 17, 20, 15, 0]),
    ];
    assert.equal(raisonDe(png({ milieu: annexes })), 'lu');
  });

  test('une vue décalée dans un tampon plus grand se lit par ses seuls octets, et rien de reçu ne change', () => {
    const octets = png({ entete: { largeur: 5, hauteur: 4 } });
    const tampon = new Uint8Array(octets.length + 10).fill(0xee);
    tampon.set(octets, 3);
    const vue = tampon.subarray(3, 3 + octets.length);
    const copie = Uint8Array.from(tampon);
    assert.deepEqual(lirePng(vue), { largeur: 5, hauteur: 4 });
    assert.deepEqual(tampon, copie);
  });
});

describe('lirePng : ce qui n’est pas un PNG bien formé lève ErreurPng, sa raison nommée (§ 8.9)', () => {
  test('une signature fausse ou incomplète : SIGNATURE', () => {
    const faux = png();
    faux[1] = 0x51;
    assert.equal(raisonDe(faux), 'SIGNATURE');
    assert.equal(raisonDe(new Uint8Array(0)), 'SIGNATURE');
    assert.equal(raisonDe(Uint8Array.from(SIGNATURE.slice(0, 7))), 'SIGNATURE');
    assert.equal(raisonDe(ASCII.encode('GIF89a\u{0001}\u{0000}\u{0001}\u{0000}')), 'SIGNATURE');
    // Un JPEG commence par FF D8 FF.
    assert.equal(raisonDe(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...SIGNATURE])), 'SIGNATURE');
  });

  test('un morceau qui déborde, ou une fin sans IEND : TRONQUE', () => {
    const entier = png();
    assert.equal(raisonDe(entier.subarray(0, entier.length - 1)), 'TRONQUE');
    assert.equal(raisonDe(entier.subarray(0, entier.length - 12)), 'TRONQUE');
    assert.equal(raisonDe(Uint8Array.from(SIGNATURE)), 'TRONQUE');
    assert.equal(raisonDe(Uint8Array.from([...SIGNATURE, 0, 0, 0, 13, 0x49, 0x48])), 'TRONQUE');
    const long = [morceau('IDAT', [1, 2, 3], { longueur: 4000 })];
    assert.equal(raisonDe(png({ milieu: long })), 'TRONQUE');
  });

  test('un CRC faux, sur l’IHDR, un IDAT, un morceau annexe ou l’IEND : CRC', () => {
    const entete = png();
    entete[8 + 8 + 13] ^= 0x01;
    assert.equal(raisonDe(entete), 'CRC');
    const donnees = png();
    donnees[8 + 25 + 8] ^= 0x80;
    assert.equal(raisonDe(donnees), 'CRC');
    assert.equal(raisonDe(png({ milieu: [morceau('tEXt', [65, 0, 66], { crc: 7 }), morceau('IDAT', [1])] })), 'CRC');
    const fin = png();
    fin[fin.length - 1] ^= 0xff;
    assert.equal(raisonDe(fin), 'CRC');
  });

  test('un premier morceau qui n’est pas un IHDR de treize octets, ou un IHDR hors de ses règles : IHDR', () => {
    const sansEntete = Uint8Array.from([...SIGNATURE, ...morceau('IDAT', [1]), ...morceau('IEND')]);
    assert.equal(raisonDe(sansEntete), 'IHDR');
    const court = Uint8Array.from([...SIGNATURE, ...morceau('IHDR', ihdr().slice(0, 12)), ...morceau('IDAT', [1]), ...morceau('IEND')]);
    assert.equal(raisonDe(court), 'IHDR');
    const long = Uint8Array.from([...SIGNATURE, ...morceau('IHDR', [...ihdr(), 0]), ...morceau('IDAT', [1]), ...morceau('IEND')]);
    assert.equal(raisonDe(long), 'IHDR');
    const fautifs = [
      { largeur: 0 },
      { hauteur: 0 },
      { largeur: 2 ** 31 },
      { hauteur: 2 ** 32 - 1 },
      { couleur: 1 },
      { couleur: 5 },
      { couleur: 7 },
      { couleur: 2, profondeur: 4 },
      { couleur: 3, profondeur: 16 },
      { couleur: 0, profondeur: 3 },
      { couleur: 6, profondeur: 1 },
      { compression: 1 },
      { filtre: 1 },
      { entrelacement: 2 },
    ];
    for (const entete of fautifs) {
      const milieu = [morceau('PLTE', [0, 0, 0]), morceau('IDAT', [1])];
      assert.equal(raisonDe(png({ entete, milieu: entete.couleur === 3 ? milieu : [milieu[1]] })), 'IHDR', JSON.stringify(entete));
    }
  });

  test('un second IHDR, aucun IDAT, des IDAT séparés, une palette absente, un IEND non vide, des octets après lui, un type illisible : STRUCTURE', () => {
    const donnees = morceau('IDAT', [1, 2]);
    const cas = [
      ['un second IHDR', png({ milieu: [morceau('IHDR', ihdr()), donnees] })],
      ['aucun IDAT', png({ milieu: [morceau('tEXt', [65, 0, 66])] })],
      ['des IDAT séparés', png({ milieu: [donnees, morceau('tEXt', [65, 0, 66]), donnees] })],
      ['type 3 sans palette', png({ entete: { couleur: 3 }, milieu: [donnees] })],
      ['type 3, palette après les données', png({ entete: { couleur: 3 }, milieu: [donnees, morceau('PLTE', [0, 0, 0])] })],
      ['IEND non vide', Uint8Array.from([...SIGNATURE, ...morceau('IHDR', ihdr()), ...donnees, ...morceau('IEND', [0])])],
      ['un octet après IEND', Uint8Array.from([...png(), 0])],
      ['un morceau après IEND', Uint8Array.from([...png(), ...morceau('tEXt', [65, 0, 66])])],
      ['un type qui n’est pas en lettres', png({ milieu: [morceau('ID4T', [1]), donnees] })],
      ['une longueur au-delà de 2^31 − 1', png({ milieu: [morceau('IDAT', [1], { longueur: 2 ** 31 })] })],
    ];
    assert.deepEqual(cas.map(([nom, octets]) => [nom, raisonDe(octets)]), cas.map(([nom]) => [nom, 'STRUCTURE']));
  });

  test('ErreurPng porte sa raison et un message qui la nomme ; des octets d’une autre forme qu’un Uint8Array lèvent TypeError', () => {
    const faux = png();
    faux[0] = 0;
    assert.throws(() => lirePng(faux), (erreur) => {
      assert.ok(erreur instanceof ErreurPng && erreur instanceof Error);
      assert.equal(erreur.name, 'ErreurPng');
      assert.equal(erreur.raison, 'SIGNATURE');
      assert.match(erreur.message, /^SIGNATURE /);
      return true;
    });
    for (const valeur of [null, undefined, 'png', [...png()], png().buffer, new Uint16Array(4)]) {
      assert.throws(() => lirePng(valeur), TypeError, String(valeur));
    }
  });
});
