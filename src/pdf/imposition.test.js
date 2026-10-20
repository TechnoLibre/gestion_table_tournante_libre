// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// L'imposition de la planche (§ 11.2, § 11.3, § 11.6), éprouvée à égalité
// sur les deux papiers : les cellules au millimètre, la bande perdue de
// l'A4, le bloc centré du Lettre, les filets qui ne bordent que des
// cellules occupées, le cadre utile en retrait de la zone de silence, la
// pagination sur les comptes qui séparent troncature et arrondi par excès,
// et l'ordre des deux impositions.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { constante } from '../geometrie/constantes.js';
import { PAPIERS } from '../geometrie/papiers.js';
import { cadreUtile, cellules, filets, imposer, nombrePlanches, parPlanche } from './imposition.js';

const IMPOSITIONS = ['feuille', 'pile'];
const NOMS_PAPIERS = ['A4', 'Lettre'];

// Égalité à un millionième de millimètre : les cotes du Lettre ne sont pas
// des entiers.
const proche = (a, b) => Math.abs(a - b) < 1e-6;

describe('imposition : les cellules (§ 11.2)', () => {
  test('A4 : quatre cellules de 105 × 148 exactement, deux colonnes et deux rangées depuis le coin haut gauche, debout', () => {
    assert.deepEqual(cellules('A4'), [
      { x: 0, y: 0, largeur: 105, hauteur: 148, aPlat: false },
      { x: 105, y: 0, largeur: 105, hauteur: 148, aPlat: false },
      { x: 0, y: 148, largeur: 105, hauteur: 148, aPlat: false },
      { x: 105, y: 148, largeur: 105, hauteur: 148, aPlat: false },
    ]);
  });

  test('A4 : les deux colonnes occupent toute la largeur, et une bande perdue de 1 mm reste au pied', () => {
    const toutes = cellules('A4');
    assert.equal(Math.max(...toutes.map((c) => c.x + c.largeur)), PAPIERS.A4.largeur);
    assert.equal(PAPIERS.A4.hauteur - Math.max(...toutes.map((c) => c.y + c.hauteur)), 1);
  });

  test('Lettre : deux cellules de 148 × 105 à plat, en un bloc de 148 × 210 centré sur la feuille', () => {
    const toutes = cellules('Lettre');
    assert.deepEqual(toutes, [
      { x: 33.95, y: 34.7, largeur: 148, hauteur: 105, aPlat: true },
      { x: 33.95, y: 139.7, largeur: 148, hauteur: 105, aPlat: true },
    ]);
    const { largeur, hauteur } = PAPIERS.Lettre;
    const gauche = toutes[0].x;
    const droite = largeur - (toutes[0].x + toutes[0].largeur);
    const haut = toutes[0].y;
    const bas = hauteur - (toutes[1].y + toutes[1].hauteur);
    assert.ok(proche(gauche, droite) && proche(haut, bas), `${gauche} ${droite} ${haut} ${bas}`);
  });

  test('chaque appel rend des cellules neuves ; un papier hors de PAPIERS lève TypeError', () => {
    const a = cellules('A4');
    a[0].x = 99;
    assert.equal(cellules('A4')[0].x, 0);
    for (const papier of ['A5', 'lettre', '', null, undefined, 'toString', '__proto__']) {
      assert.throws(() => cellules(papier), TypeError, String(papier));
      assert.throws(() => parPlanche(papier), TypeError, String(papier));
    }
  });
});

describe('imposition : la pagination (§ 11.2)', () => {
  test('parPlanche : 4 sur A4, 2 sur Lettre', () => {
    assert.equal(parPlanche('A4'), 4);
    assert.equal(parPlanche('Lettre'), 2);
  });

  test('A4 : n = 1, 4, 5, 259, 261 donnent 1, 1, 2, 65, 66 planches ; Lettre : n = 1, 2, 3, 257 donnent 1, 1, 2, 129', () => {
    assert.deepEqual([1, 4, 5, 259, 261].map((n) => nombrePlanches(n, 'A4')), [1, 1, 2, 65, 66]);
    assert.deepEqual([1, 2, 3, 257].map((n) => nombrePlanches(n, 'Lettre')), [1, 1, 2, 129]);
  });

  test('n = 0 ne donne aucune planche, sur les deux papiers ; un compte qui n’est pas un entier ≥ 0 lève RangeError', () => {
    assert.equal(nombrePlanches(0, 'A4'), 0);
    assert.equal(nombrePlanches(0, 'Lettre'), 0);
    for (const n of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '3', null]) {
      assert.throws(() => nombrePlanches(n, 'A4'), RangeError, String(n));
      assert.throws(() => imposer(n, 'A4', 'feuille'), RangeError, String(n));
    }
    assert.throws(() => nombrePlanches(3, 'A5'), TypeError);
  });
});

describe('imposition : l’ordre des badges (§ 11.6)', () => {
  test('cinq badges sur A4 : feuille par feuille, puis en pile', () => {
    assert.deepEqual(imposer(5, 'A4', 'feuille'), [
      [0, 1, 2, 3],
      [4, null, null, null],
    ]);
    assert.deepEqual(imposer(5, 'A4', 'pile'), [
      [0, 2, 4, null],
      [1, 3, null, null],
    ]);
    assert.deepEqual(imposer(3, 'Lettre', 'pile'), [
      [0, 2],
      [1, null],
    ]);
    assert.deepEqual(imposer(0, 'Lettre', 'feuille'), []);
  });

  test('n de 1 à 40, deux papiers, deux impositions : chaque badge une fois ; en pile, empiler les piles 1…P redonne 1…n puis des blancs seulement', () => {
    for (const papier of NOMS_PAPIERS) {
      const P = parPlanche(papier);
      for (const imposition of IMPOSITIONS) {
        for (let n = 1; n <= 40; n += 1) {
          const planches = imposer(n, papier, imposition);
          const S = nombrePlanches(n, papier);
          const cas = `${papier} ${imposition} n=${n}`;
          assert.equal(planches.length, S, cas);
          assert.ok(planches.every((planche) => planche.length === P), cas);
          const places = planches.flat();
          assert.deepEqual(places.filter((b) => b !== null).sort((a, b) => a - b), [...Array(n).keys()], cas);
          // L'ordre de lecture de l'imposition : planche après planche pour
          // la feuille ; pour la pile, la pile de la cellule 1 sur toutes les
          // planches, puis celle de la cellule 2, et ainsi de suite.
          const lecture =
            imposition === 'feuille'
              ? places
              : [...Array(P).keys()].flatMap((p) => planches.map((planche) => planche[p]));
          const blancs = lecture.slice(n);
          assert.deepEqual(lecture.slice(0, n), [...Array(n).keys()], cas);
          assert.ok(blancs.every((b) => b === null), cas);
          assert.equal(blancs.length, S * P - n, cas);
        }
      }
    }
  });

  test('une imposition inconnue, ou un papier inconnu, lève TypeError', () => {
    for (const imposition of ['', 'Feuille', 'pages', null]) {
      assert.throws(() => imposer(4, 'A4', imposition), TypeError, String(imposition));
    }
    assert.throws(() => imposer(4, 'A3', 'feuille'), TypeError);
  });
});

describe('imposition : les filets de coupe (§ 11.3)', () => {
  test('A4, planche pleine : trois axes — x = 105 de y 0 à 296, y = 148 et y = 296 de x 0 à 210', () => {
    assert.deepEqual(filets('A4', [true, true, true, true]), [
      { x1: 105, y1: 0, x2: 105, y2: 296 },
      { x1: 0, y1: 148, x2: 210, y2: 148 },
      { x1: 0, y1: 296, x2: 210, y2: 296 },
    ]);
  });

  test('Lettre, planche pleine : cinq axes, l’encadrement complet du bloc', () => {
    assert.deepEqual(filets('Lettre', [true, true]), [
      { x1: 33.95, y1: 34.7, x2: 33.95, y2: 244.7 },
      { x1: 181.95, y1: 34.7, x2: 181.95, y2: 244.7 },
      { x1: 33.95, y1: 34.7, x2: 181.95, y2: 34.7 },
      { x1: 33.95, y1: 139.7, x2: 181.95, y2: 139.7 },
      { x1: 33.95, y1: 244.7, x2: 181.95, y2: 244.7 },
    ]);
  });

  test('une dernière planche partielle ne trace que les segments qui bordent ses cellules occupées', () => {
    const derniere = (n, papier) => imposer(n, papier, 'feuille').at(-1).map((badge) => badge !== null);
    assert.deepEqual(filets('A4', derniere(5, 'A4')), [
      { x1: 105, y1: 0, x2: 105, y2: 148 },
      { x1: 0, y1: 148, x2: 105, y2: 148 },
    ]);
    assert.deepEqual(filets('A4', derniere(7, 'A4')), [
      { x1: 105, y1: 0, x2: 105, y2: 296 },
      { x1: 0, y1: 148, x2: 210, y2: 148 },
      { x1: 0, y1: 296, x2: 105, y2: 296 },
    ]);
    assert.deepEqual(filets('Lettre', derniere(3, 'Lettre')), [
      { x1: 33.95, y1: 34.7, x2: 33.95, y2: 139.7 },
      { x1: 181.95, y1: 34.7, x2: 181.95, y2: 139.7 },
      { x1: 33.95, y1: 34.7, x2: 181.95, y2: 34.7 },
      { x1: 33.95, y1: 139.7, x2: 181.95, y2: 139.7 },
    ]);
    assert.deepEqual(filets('A4', [false, false, false, false]), []);
  });

  test('pour chaque occupation, chaque bord d’une cellule occupée hors du bord de la feuille est sur un filet, et chaque filet ne court que le long de cellules occupées', () => {
    for (const papier of NOMS_PAPIERS) {
      const toutes = cellules(papier);
      const { largeur, hauteur } = PAPIERS[papier];
      for (let masque = 0; masque < 2 ** toutes.length; masque += 1) {
        const occupees = toutes.map((_, rang) => (masque & (1 << rang)) !== 0);
        const traces = filets(papier, occupees);
        const bords = toutes
          .filter((_, rang) => occupees[rang])
          .flatMap(({ x, y, largeur: l, hauteur: h }) => [
            { x1: x, y1: y, x2: x + l, y2: y },
            { x1: x, y1: y + h, x2: x + l, y2: y + h },
            { x1: x, y1: y, x2: x, y2: y + h },
            { x1: x + l, y1: y, x2: x + l, y2: y + h },
          ])
          .filter((b) => !(b.x1 === b.x2 && (proche(b.x1, 0) || proche(b.x1, largeur))))
          .filter((b) => !(b.y1 === b.y2 && (proche(b.y1, 0) || proche(b.y1, hauteur))));
        const couvre = (f, b) =>
          (f.x1 === f.x2 && b.x1 === b.x2 && proche(f.x1, b.x1) && f.y1 <= b.y1 + 1e-6 && b.y2 <= f.y2 + 1e-6) ||
          (f.y1 === f.y2 && b.y1 === b.y2 && proche(f.y1, b.y1) && f.x1 <= b.x1 + 1e-6 && b.x2 <= f.x2 + 1e-6);
        const cas = `${papier} ${occupees}`;
        assert.ok(bords.every((b) => traces.some((f) => couvre(f, b))), cas);
        // Un filet est la réunion de bords de cellules occupées : sa longueur
        // ne dépasse pas celle des bords qu'il couvre.
        for (const f of traces) {
          const couverts = bords.filter((b) => couvre(f, b));
          const longueur = (s) => Math.abs(s.x2 - s.x1) + Math.abs(s.y2 - s.y1);
          const union = new Set(couverts.map((b) => `${b.x1},${b.y1},${b.x2},${b.y2}`));
          const somme = [...union].map((cle) => cle.split(',').map(Number)).reduce((s, [x1, y1, x2, y2]) => s + longueur({ x1, y1, x2, y2 }), 0);
          assert.ok(longueur(f) <= somme + 1e-6, `${cas} ${JSON.stringify(f)}`);
        }
      }
    }
  });

  test('une occupation qui n’a pas une valeur par cellule lève RangeError ; une valeur qui n’est pas un booléen, TypeError', () => {
    assert.throws(() => filets('A4', [true, true]), RangeError);
    assert.throws(() => filets('Lettre', [true, true, true]), RangeError);
    assert.throws(() => filets('A4', null), RangeError);
    assert.throws(() => filets('A4', [1, 0, 0, 0]), TypeError);
    assert.throws(() => filets('Lettre', [true, 'oui']), TypeError);
  });
});

describe('imposition : le cadre utile (§ 11.3)', () => {
  test('la zone de silence retire ZONE_SILENCE_MM de chaque bord : 89 × 132 debout, 132 × 89 à plat', () => {
    const zone = constante('ZONE_SILENCE_MM');
    assert.equal(zone, 8);
    assert.deepEqual(cadreUtile(cellules('A4')[3]), { x: 113, y: 156, largeur: 89, hauteur: 132 });
    const aPlat = cadreUtile(cellules('Lettre')[1]);
    assert.ok(proche(aPlat.x, 41.95) && proche(aPlat.y, 147.7), JSON.stringify(aPlat));
    assert.deepEqual([aPlat.largeur, aPlat.hauteur], [132, 89]);
  });
});
