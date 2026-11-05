// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le vecteur de PCG32 vient de l'implémentation de référence, hors de ce
// dépôt : c'est un oracle, non un témoin (§ 14.11). Dépôt
// https://github.com/imneme/pcg-c-basic, commit
// bc39cd76ac3d541e618606bcc6e1e5ba5e5e6aa3 : pcg32-demo.c, compilé avec
// pcg_basic.c et exécuté sans argument, ensemence par
// pcg32_srandom_r(&rng, 42u, 54u) et imprime cinq tours de tirages.
// scripts/oracle/pcg32_reference.sh refait ces gestes ; TOUR_1 recopie le
// premier tour de sa sortie.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { describe, test } from '../../test/lanceur.js';
import { FLUX, creerPcg32 } from './prng.js';

const DEUX_32 = 2 ** 32;

// Premier tour de la démo, ligne par ligne, tel qu'elle l'imprime. Ses tirages
// se suivent dans cet ordre : six sorties de pcg32_random_r ; 65 pièces,
// pcg32_boundedrand_r(&rng, 2), imprimées H pour 1 et T pour 0 ; 33 dés,
// pcg32_boundedrand_r(&rng, 6) + 1 ; puis le mélange d'un paquet de 52 cartes
// numérotées de 0 à 51. La carte c s'imprime par sa valeur, de rang c / 4 en
// division entière dans « A23456789TJQK », puis sa couleur, de rang c % 4 dans
// « hcds ». La démo coupe le paquet en lignes de 22 cartes, jointes ici par
// une espace.
const TOUR_1 = {
  sorties: '0xa15c02b7 0x7b47f409 0xba1d3330 0x83d2f293 0xbfa4784b 0xcbed606e',
  pieces: 'HHTTTHTHHHTHTTTHHHHHTTTHHHTHTHTHTTHTTTHHHHHHTTTTHHTTTTTHTTTTTTTHT',
  des: '3 4 1 1 2 2 3 2 4 3 2 4 3 3 5 2 3 1 3 1 5 1 4 1 5 6 4 6 6 2 6 3 3',
  cartes:
    'Qd Ks 6d 3s 3d 4c 3h Td Kc 5c Jh Kd Jd As 4s 4h Ad Th Ac Jc 7s Qs ' +
    '2s 7h Kh 2d 6c Ah 4d Qh 9h 6s 5s 2c 9c Ts 8d 9s 3c 8c Js 5d 2h 6h ' +
    '7d 8s 9d 5h 8h Qc 7c Tc',
};

// Une sortie de 32 bits, écrite comme la démo l'imprime (« 0x%08x »).
const hexa = (x) => `0x${x.toString(16).padStart(8, '0')}`;

// Une carte, écrite comme la démo l'imprime.
const carte = (c) => 'A23456789TJQK'[Math.floor(c / 4)] + 'hcds'[c % 4];

// Tire le premier tour de la démo, dans son ordre, et l'écrit comme elle.
function premierTour(rng) {
  const sorties = Array.from({ length: 6 }, () => hexa(rng.suivant())).join(' ');
  const pieces = Array.from(TOUR_1.pieces, () => (rng.borne(2) ? 'H' : 'T')).join('');
  const des = TOUR_1.des.split(' ').map(() => rng.borne(6) + 1).join(' ');
  const paquet = Array.from({ length: 52 }, (_, c) => c);
  rng.melanger(paquet);
  return { sorties, pieces, des, cartes: paquet.map(carte).join(' ') };
}

// Transcription de pcg32_srandom_r et pcg32_random_r en BigInt, modulo 2^64 :
// elle ne partage rien de l'arithmétique par mots de 32 bits de prng.js. Rend
// la fonction de tirage, déjà ensemencée.
const MASQUE_64 = (1n << 64n) - 1n;
const MASQUE_32 = (1n << 32n) - 1n;
function transcriptionBigInt(graine, flux) {
  const increment = ((BigInt(flux) << 1n) | 1n) & MASQUE_64;
  let etat = 0n;
  function tirer() {
    const ancien = etat;
    etat = (ancien * 6364136223846793005n + increment) & MASQUE_64;
    const melange = (((ancien >> 18n) ^ ancien) >> 27n) & MASQUE_32;
    const rotation = ancien >> 59n;
    return Number(((melange >> rotation) | (melange << ((32n - rotation) & 31n))) & MASQUE_32);
  }
  tirer();
  etat = (etat + BigInt(graine)) & MASQUE_64;
  tirer();
  return tirer;
}

// Les valeurs que l'appel admet, ou refuse par une autre erreur qu'une
// RangeError. Recueillies puis comparées à [], elles sont toutes nommées en un
// seul échec.
function admisesATort(valeurs, appel) {
  return valeurs.filter((valeur) => {
    try {
      appel(valeur);
      return true;
    } catch (erreur) {
      return !(erreur instanceof RangeError);
    }
  });
}

describe('PCG32', () => {
  test('rejoue le premier tour de la démo de référence (graine 42, flux 54)', () => {
    assert.deepEqual(premierTour(creerPcg32(42, 54)), TOUR_1);
  });

  // Le vecteur n'exerce ni le mot haut de l'incrément, nul pour le flux 54,
  // ni la retenue des additions sur 64 bits : celle de l'incrément 109 ne
  // survient que pour un mot bas de produit d'au moins 2^32 − 109, une fois
  // sur quarante millions de pas ; celle de la graine 42, ajoutée à l'état
  // 109, jamais. Un flux d'au moins 2^31 porte le mot haut. Le flux 2^32 − 1
  // déclenche la retenue de l'incrément à presque chaque pas, la graine
  // 2^32 − 1 sous le flux 0 celle de l'ensemencement seule, et les deux
  // ensemble les déclenchent toutes deux. Sur ces cas, le test confronte
  // prng.js à la transcription BigInt. C'est une contre-vérification de la
  // décomposition en mots de 32 bits, non un oracle (§ 14.11) : la
  // transcription ne s'ancre que sur les six sorties du vecteur, qui
  // n'exercent pas ces chemins, et elle suit la même lecture de pcg_basic.c
  // que prng.js. Une erreur de lecture commune aux deux, comme un incrément
  // calculé sur 32 bits, y resterait verte.
  test('concorde avec une transcription BigInt de pcg_basic.c aux graines et flux extrêmes', () => {
    const ancre = transcriptionBigInt(42, 54);
    assert.equal(Array.from({ length: 6 }, () => hexa(ancre())).join(' '), TOUR_1.sorties);

    const cas = [
      [0, 0],
      [0xffffffff, 0],
      [0, 0x80000000],
      [0x80000000, 0x80000000],
      [0, 0xffffffff],
      [0xffffffff, 0xffffffff],
      [42, FLUX.GRAINES],
      [42, FLUX.RECHERCHE],
      [42, FLUX.DEMO],
    ];
    const ecarts = [];
    for (const [graine, flux] of cas) {
      const rng = creerPcg32(graine, flux);
      const reference = transcriptionBigInt(graine, flux);
      for (let tirage = 0; tirage < 1000; tirage += 1) {
        const [obtenu, attendu] = [rng.suivant(), reference()];
        if (obtenu !== attendu) {
          ecarts.push(`graine ${graine}, flux ${flux}, tirage ${tirage} : ${obtenu} au lieu de ${attendu}`);
          break;
        }
      }
    }
    assert.deepEqual(ecarts, []);
  });

  // Chaque générateur porte son propre état et son propre incrément. Deux
  // générateurs vivants à la fois, sur deux flux de FLUX, rendent chacun la
  // suite qu'il rendrait seul. Les tirages alternent : un état ou un
  // incrément rangé hors de l'instance, donc partagé, décale alors les deux
  // suites. Les deux flux donnent deux suites distinctes, sans quoi un
  // incrément partagé ne changerait aucun tirage.
  test('deux générateurs de flux différents, tirés en alternance, gardent chacun sa suite', () => {
    const seul = (flux) => {
      const rng = creerPcg32(42, flux);
      return Array.from({ length: 50 }, () => rng.suivant());
    };
    const attendu = [seul(FLUX.GRAINES), seul(FLUX.RECHERCHE)];
    assert.notDeepEqual(attendu[0], attendu[1]);

    const a = creerPcg32(42, FLUX.GRAINES);
    const b = creerPcg32(42, FLUX.RECHERCHE);
    const obtenu = [[], []];
    for (let i = 0; i < 50; i += 1) {
      obtenu[0].push(a.suivant());
      obtenu[1].push(b.suivant());
    }
    assert.deepEqual(obtenu, attendu);
  });

  // Les bornes du vecteur, 2, 6 puis 52 à 2, ont un seuil sous 2^6 : leur
  // rejet ne survient pratiquement jamais. Le test prend une borne de chaque
  // côté de 2^31. Pour n = 2^31 + 1, 2^32 − n est sous n et le modulo n'agit
  // pas : le seuil vaut 2^31 − 1, et près d'un tirage sur deux est rejeté.
  // Pour n = 2^30 + 1, il agit : le seuil vaut 2^32 − 3n = 2^30 − 3, et un
  // tirage sur quatre environ est rejeté. Une négation sur 32 bits signés,
  // ~n + 1, ne vaut 2^32 − n qu'au-dessus de 2^31 : le seuil qu'elle donne
  // n'est faux que sous 2^31, et seule la seconde borne le voit. borne
  // consomme un tirage par rejet et un par résultat : les résultats attendus
  // sont les tirages acceptés d'un jumeau, réduits modulo n, dans l'ordre.
  test('borne rejette les tirages sous le seuil (2^32 − n) mod n, comme pcg32_boundedrand_r', () => {
    const jumeau = creerPcg32(42, 54);
    const tirages = Array.from({ length: 200 }, () => jumeau.suivant());
    for (const [n, seuil] of [
      [2 ** 31 + 1, 2 ** 31 - 1],
      [2 ** 30 + 1, 2 ** 30 - 3],
    ]) {
      assert.equal((DEUX_32 - n) % n, seuil);
      const acceptes = tirages.filter((r) => r >= seuil);
      assert.ok(acceptes.length > 0, `n = ${n} : aucun tirage accepté`);
      assert.ok(acceptes.length < tirages.length, `n = ${n} : aucun tirage rejeté, le rejet reste inexercé`);

      const rng = creerPcg32(42, 54);
      assert.deepEqual(
        { n, resultats: acceptes.map(() => rng.borne(n)) },
        { n, resultats: acceptes.map((r) => r % n) },
      );
    }
  });

  // Le deuxième tirage du vecteur, 0x7b47f409, est exactement le seuil de
  // n = 2^32 − 0x7b47f409 : n dépasse 2^31, donc (2^32 − n) mod n = 2^32 − n.
  // Accepté, il revient tel quel, puisqu'il est sous n.
  test('borne accepte un tirage égal au seuil', () => {
    const rng = creerPcg32(42, 54);
    rng.suivant();
    assert.equal(rng.borne(DEUX_32 - 0x7b47f409), 0x7b47f409);
  });

  // Pour n = 2^32 − 0x7b47f409 − 1, le seuil vaut de même 2^32 − n, soit
  // 0x7b47f40a, un de plus que le deuxième tirage du vecteur : borne rejette
  // celui-ci et rend le troisième, 0xba1d3330, réduit modulo n. Avec
  // « borne accepte un tirage égal au seuil », ce test fixe le seuil des deux
  // côtés : un seuil calculé sur 2^32 − 1 au lieu de 2^32 accepterait le
  // deuxième tirage et décalerait tous les suivants.
  test('borne rejette un tirage juste sous le seuil', () => {
    const rng = creerPcg32(42, 54);
    rng.suivant();
    const n = DEUX_32 - 0x7b47f409 - 1;
    assert.equal(rng.borne(n), 0xba1d3330 % n);
  });

  test("borne(1) rend toujours 0, au prix d'un tirage comme pcg32_boundedrand_r", () => {
    const rng = creerPcg32(42, 54);
    const jumeau = creerPcg32(42, 54);
    for (let i = 0; i < 1000; i += 1) {
      assert.equal(rng.borne(1), 0);
      jumeau.suivant();
    }
    assert.equal(rng.suivant(), jumeau.suivant());
  });

  // 2^32 − 1 est la plus grande borne de pcg32_boundedrand_r, dont le
  // paramètre est un uint32_t. Son seuil vaut 1 : le premier tirage du
  // vecteur, 0xa15c02b7, passe et revient tel quel, puisqu'il est sous n.
  test('borne admet 2^32 − 1, la plus grande borne de pcg32_boundedrand_r', () => {
    assert.equal(creerPcg32(42, 54).borne(DEUX_32 - 1), 0xa15c02b7);
  });

  test('borne refuse 0, et toute borne hors des entiers de 1 à 2^32 − 1', () => {
    const rng = creerPcg32(42, 54);
    const invalides = [0, -1, 1.5, DEUX_32, NaN, Infinity, '6', 6n, undefined];
    assert.deepEqual(admisesATort(invalides, (n) => rng.borne(n)), []);
  });

  // La boucle de la démo tire borne(i) pour i de n à 2 : un tableau de moins
  // de deux éléments ne consomme aucun tirage. Un tirage de trop en fin de
  // mélange échappe au vecteur, dont le paquet clôt le premier tour ; le
  // jumeau, qui tire les mêmes bornes, le voit au tirage suivant.
  test('melanger suit la boucle de la démo, en place : borne(i) pour i de n à 2', () => {
    const rng = creerPcg32(42, 54);
    const jumeau = creerPcg32(42, 54);
    const tab = [10, 20, 30, 40, 50];
    assert.equal(rng.melanger(tab), tab);
    for (let i = tab.length; i > 1; i -= 1) jumeau.borne(i);
    rng.melanger([]);
    rng.melanger([7]);
    assert.equal(rng.suivant(), jumeau.suivant());
    assert.deepEqual([...tab].sort((a, b) => a - b), [10, 20, 30, 40, 50]);
  });

  // Une graine hors de l'intervalle, tronquée en silence, désignerait une
  // autre graine ; un flux omis deviendrait le flux 0.
  test('creerPcg32 refuse une graine ou un flux hors des entiers de 0 à 2^32 − 1', () => {
    const invalides = [-1, 1.5, DEUX_32, NaN, Infinity, '42', 42n, undefined];
    assert.deepEqual(admisesATort(invalides, (graine) => creerPcg32(graine, 54)), []);
    assert.deepEqual(admisesATort(invalides, (flux) => creerPcg32(42, flux)), []);
  });

  // Témoin, non oracle : changer un flux change chaque graine dérivée et
  // chaque démonstration. Le test fait de ce changement un geste conscient.
  test('FLUX attribue les flux 1, 2 et 3, figés', () => {
    assert.deepEqual(FLUX, { GRAINES: 1, RECHERCHE: 2, DEMO: 3 });
    assert.ok(Object.isFrozen(FLUX));
  });

  // La durée est affichée, jamais affirmée : la cible est sous une seconde,
  // et une machine chargée la dépasse sans que le code soit en cause
  // (§ 14.14). L'assertion porte sur les tirages, entiers non signés de 32
  // bits ; x >>> 0 diffère de x pour toute autre valeur.
  test('1 000 000 tirages : durée affichée, cible sous une seconde', () => {
    const rng = creerPcg32(42, FLUX.DEMO);
    let horsMot = 0;
    const debut = performance.now();
    for (let i = 0; i < 1_000_000; i += 1) {
      const x = rng.suivant();
      if (x !== x >>> 0) horsMot += 1;
    }
    const duree = performance.now() - debut;
    console.log(`PCG32 : 1 000 000 tirages en ${duree.toFixed(1)} ms (cible : moins de 1 000 ms)`);
    assert.equal(horsMot, 0);
  });
});
