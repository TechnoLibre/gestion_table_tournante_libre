// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de la désignation (§ 7.3, § 14.10) : le régime des cibles, décidé
// table par table sur le pas de chacune, et le siège que désigne un point de
// dessin, qui est celui que geometrieTable pose — sur les quatre
// démonstrations livrées et sur des carrées, à un zoom où les sièges sont
// des cibles et à un zoom où la table l'est.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { LIVREES } from '../demo/livrees.js';
import { analyser, capacite } from '../stockage/document.js';
import { CIBLE_MIN_PX, designer, regimeCibles, surLeSol } from './designation.js';
import { englobant, geometrieTable } from './tables.js';

const table = (id, forme, x, y) => ({ id, numero: id, sieges: null, forme, position: { x, y } });

const milieu = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// Écart sous le bord d'une cible, en cm.
const EPS = 0.01;

// Un point entre deux chaises voisines d'une table : leur milieu, éloigné de
// 4 cm de la droite qui les joint, du côté opposé au centre de la table. Sur
// un côté de carrée à sièges espacés du pas, le milieu est au bord des deux
// cibles ; éloigné, il est hors des deux et reste dans l'emprise. Quand le
// milieu est le centre — deux chaises opposées, de part et d'autre d'un côté
// sans siège —, le point est sur ce côté, à la distance de la première
// chaise plus 4 cm, du côté où tourne la première dans le sens horaire de
// l'écran.
function entre(g, a, b) {
  const m = milieu(a, b);
  const longueur = Math.hypot(b.x - a.x, b.y - a.y);
  let nx = -(b.y - a.y) / longueur;
  let ny = (b.x - a.x) / longueur;
  const vers = { x: m.x - g.centre.x, y: m.y - g.centre.y };
  const degenere = Math.hypot(vers.x, vers.y) < 1e-6;
  const reference = degenere ? { x: -(a.y - g.centre.y), y: a.x - g.centre.x } : vers;
  if (nx * reference.x + ny * reference.y < 0) {
    nx = -nx;
    ny = -ny;
  }
  const ecart = degenere ? Math.hypot(a.x - g.centre.x, a.y - g.centre.y) + 4 : 4;
  return { x: m.x + nx * ecart, y: m.y + ny * ecart };
}

describe('regimeCibles (§ 7.3)', () => {
  test('le seuil est de 24 px', () => {
    assert.equal(CIBLE_MIN_PX, 24);
  });

  test('ronde de 8, pas 60 : 0,40 px/cm et au-dessus, les sièges', () => {
    const g = geometrieTable(table(1, 'ronde', 0, 0), 8);
    assert.equal(regimeCibles(0.41, g), 'sieges');
    assert.equal(regimeCibles(0.4, g), 'sieges');
    assert.equal(regimeCibles(0.39, g), 'table');
  });

  test('ronde de 3, pas 70π/3 : bascule entre 0,33 et 0,32', () => {
    const g = geometrieTable(table(1, 'ronde', 0, 0), 3);
    assert.equal(regimeCibles(0.33, g), 'sieges');
    assert.equal(regimeCibles(0.32, g), 'table');
  });

  test('carrée de 3, pas 70 : bascule entre 0,35 et 0,34', () => {
    const g = geometrieTable(table(1, 'carree', 0, 0), 3);
    assert.equal(regimeCibles(0.35, g), 'sieges');
    assert.equal(regimeCibles(0.34, g), 'table');
  });

  test('ronde de 7, pas 60 exactement : sièges à 0,40', () => {
    assert.equal(regimeCibles(0.4, geometrieTable(table(1, 'ronde', 0, 0), 7)), 'sieges');
  });
});

describe('l’emprise d’une carrée est un carré', () => {
  // Carrée de 12 au centre (0, 0) : côté 180, emprise 90 + 44 = 134 ; le
  // siège 6, dernier du côté droit, est en (112, 60).
  const geometries = [geometrieTable(table(7, 'carree', 0, 0), 12)];

  test('(125, 125) : hors du plateau et des chaises, dans le coin de l’emprise', () => {
    const point = { x: 125, y: 125 };
    assert.deepEqual(designer(point, geometries, 0.2), { table: 7 });
    assert.equal(designer(point, geometries, 1), null);
    assert.equal(surLeSol(point, geometries), false);
  });

  test('(130, 60) : dans la chaise du siège 6, à 143 cm du centre', () => {
    const point = { x: 130, y: 60 };
    assert.deepEqual(designer(point, geometries, 0.2), { table: 7 });
    assert.deepEqual(designer(point, geometries, 1), { table: 7, siege: 6 });
    assert.equal(surLeSol(point, geometries), false);
  });

  test('(140, 0) : hors de l’emprise, mais à 28 cm du siège 5, en (112, 0), dans sa cible de rayon pas/2 = 30', () => {
    const point = { x: 140, y: 0 };
    assert.equal(designer(point, geometries, 0.2), null);
    assert.deepEqual(designer(point, geometries, 1), { table: 7, siege: 5 });
    assert.equal(surLeSol(point, geometries), true);
  });

  test('(150, 0) est le sol', () => {
    const point = { x: 150, y: 0 };
    assert.equal(designer(point, geometries, 0.2), null);
    assert.equal(designer(point, geometries, 1), null);
    assert.equal(surLeSol(point, geometries), true);
  });
});

// Les géométries de chaque démonstration livrée, telles que le dessin les
// pose, puis trois carrées de 3, 8 et 12 : les démonstrations n'ont que des
// rondes.
const JEUX = [
  ...LIVREES.map(({ cle, texte }) => {
    const { charge } = analyser(texte);
    return { nom: cle, geometries: charge.tables.map((t) => geometrieTable(t, capacite(charge, t))) };
  }),
  {
    nom: 'carrées',
    geometries: [
      geometrieTable(table(1, 'carree', 0, 0), 3),
      geometrieTable(table(2, 'carree', 1000, 0), 8),
      geometrieTable(table(3, 'carree', 2000, 0), 12),
    ],
  },
];

describe('le siège désigné est celui que le dessin pose (§ 7.3, § 14.10)', () => {
  const ATTENDUES = { grande: 260, 'grande-sans-exception': 264, petite: 12, 'petite-conflit': 12, 'carrées': 23 };

  test('cinq jeux, dans l’ordre', () => {
    assert.deepEqual(JEUX.map(({ nom }) => nom), ['grande', 'grande-sans-exception', 'petite', 'petite-conflit', 'carrées']);
  });

  for (const { nom, geometries } of JEUX) {
    test(`${nom}, k = 1 : chaque chaise rend sa table et son siège`, () => {
      let chaises = 0;
      for (const g of geometries) {
        assert.equal(regimeCibles(1, g), 'sieges');
        for (const chaise of g.chaises) {
          assert.deepEqual(designer(chaise, geometries, 1), { table: g.id, siege: chaise.siege });
          chaises += 1;
        }
      }
      assert.ok(ATTENDUES[nom] > 0);
      assert.equal(chaises, ATTENDUES[nom]);
    });

    test(`${nom}, k = 1 : ni un point entre deux chaises voisines, à plus de pas/2 de chacune, ni le centre d’une table ne désigne rien`, () => {
      let points = 0;
      for (const g of geometries) {
        const n = g.chaises.length;
        for (let i = 0; i < n; i += 1) {
          const point = entre(g, g.chaises[i], g.chaises[(i + 1) % n]);
          for (const voisine of [g.chaises[i], g.chaises[(i + 1) % n]]) {
            assert.ok(Math.hypot(point.x - voisine.x, point.y - voisine.y) > g.pas / 2, `table ${g.id}, siège ${voisine.siege}`);
          }
          assert.equal(designer(point, geometries, 1), null, `table ${g.id}, sièges ${i + 1} et ${((i + 1) % n) + 1}`);
          assert.equal(surLeSol(point, geometries), false);
          points += 1;
        }
        assert.equal(designer(g.centre, geometries, 1), null, `centre de la table ${g.id}`);
        assert.equal(surLeSol(g.centre, geometries), false);
      }
      assert.equal(points, ATTENDUES[nom]);
    });

    test(`${nom}, au seuil k = 24/pas de chaque table : un point à pas/2 − ε d’une chaise, vers sa voisine, la désigne`, () => {
      let points = 0;
      for (const g of geometries) {
        const k = (CIBLE_MIN_PX / g.pas) * (1 + 1e-12);
        assert.equal(regimeCibles(k, g), 'sieges');
        const n = g.chaises.length;
        for (let i = 0; i < n; i += 1) {
          const chaise = g.chaises[i];
          const voisine = g.chaises[(i + 1) % n];
          const d = Math.hypot(voisine.x - chaise.x, voisine.y - chaise.y);
          const portee = g.pas / 2 - EPS;
          const point = { x: chaise.x + ((voisine.x - chaise.x) * portee) / d, y: chaise.y + ((voisine.y - chaise.y) * portee) / d };
          assert.deepEqual(designer(point, [g], k), { table: g.id, siege: chaise.siege }, `table ${g.id}, siège ${chaise.siege}`);
          points += 1;
        }
      }
      assert.equal(points, ATTENDUES[nom]);
    });

    test(`${nom} : un point à 10 m de tout est le sol`, () => {
      const e = englobant(geometries);
      const loin = { x: e.maxX + 1000, y: e.maxY + 1000 };
      assert.equal(surLeSol(loin, geometries), true);
      assert.equal(designer(loin, geometries, 1), null);
      assert.equal(designer(loin, geometries, 0.2), null);
    });

    test(`${nom}, k = 0,2 : chaque chaise, chaque milieu et chaque centre rendent la table, jamais un siège`, () => {
      let points = 0;
      for (const g of geometries) {
        assert.equal(regimeCibles(0.2, g), 'table');
        const n = g.chaises.length;
        const candidats = [g.centre, ...g.chaises, ...g.chaises.map((c, i) => milieu(c, g.chaises[(i + 1) % n]))];
        for (const point of candidats) {
          assert.deepEqual(designer(point, geometries, 0.2), { table: g.id });
          points += 1;
        }
      }
      assert.equal(points, 2 * ATTENDUES[nom] + geometries.length);
    });
  }
});

describe('tables qui se recouvrent : la dernière reçue, peinte au-dessus', () => {
  test('deux tables au même centre : la seconde', () => {
    const geometries = [geometrieTable(table(1, 'ronde', 0, 0), 8), geometrieTable(table(2, 'ronde', 0, 0), 8)];
    const chaise = geometries[0].chaises[2];
    assert.deepEqual(designer(chaise, geometries, 1), { table: 2, siege: 3 });
    assert.deepEqual(designer({ x: 0, y: 0 }, geometries, 0.2), { table: 2 });
  });

  test('régime sièges : le plateau du dessus cache la chaise de dessous', () => {
    // Rondes de 8 en (0, 0) et (100, 0) : le siège 3 de la première, en
    // (98,394 ; 0), tombe dans le plateau de la seconde, de rayon 76,394.
    const premiere = geometrieTable(table(1, 'ronde', 0, 0), 8);
    const seconde = geometrieTable(table(2, 'ronde', 100, 0), 8);
    const cachee = premiere.chaises[2];
    assert.equal(designer(cachee, [premiere, seconde], 1), null);
    assert.deepEqual(designer(cachee, [seconde, premiere], 1), { table: 1, siege: 3 });
    assert.deepEqual(designer(premiere.chaises[6], [premiere, seconde], 1), { table: 1, siege: 7 });
  });

  test('régimes différents : chaque table se juge sur son propre pas', () => {
    // À k = 0,35, la ronde de 8 (pas 60) est en régime table, la carrée de 3
    // (pas 70) en régime sièges.
    const ronde = geometrieTable(table(1, 'ronde', 0, 0), 8);
    const carree = geometrieTable(table(2, 'carree', 1000, 0), 3);
    const geometries = [ronde, carree];
    assert.deepEqual(designer(ronde.chaises[0], geometries, 0.35), { table: 1 });
    assert.deepEqual(designer(carree.chaises[0], geometries, 0.35), { table: 2, siege: 1 });
  });

  test('sans table, aucun point n’est désigné et tout est le sol', () => {
    assert.equal(designer({ x: 0, y: 0 }, [], 1), null);
    assert.equal(surLeSol({ x: 0, y: 0 }, []), true);
  });
});
