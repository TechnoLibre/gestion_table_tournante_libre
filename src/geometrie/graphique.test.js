// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de la géométrie des graphiques (§ 12.9, § 14.10) : échelles,
// graduations, escaliers et points, barres, colonnes, grilles, pointage au
// plus proche et troncature. Les chemins se lisent commande par commande :
// un escalier ne porte que M, H et V, et un rang null n'est traversé par
// aucun trait. Les cas chiffrés sont écrits en clair ; les balayages
// vérifient chaque résultat par sa définition, non par une seconde
// implémentation.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { constante } from './constantes.js';
import { CIBLE_MIN_PX } from './cible.js';
import {
  NIVEAUX,
  barres,
  cheminEscalier,
  cheminPoints,
  colonnesJuxtaposees,
  domaineDe,
  echelleLineaire,
  echelleLog10,
  graduations,
  grille,
  niveau,
  pointLePlusProche,
  rangLePlusProche,
  regleOuEscalier,
  tronquer,
} from './graphique.js';

// Les commandes d'un chemin, chacune avec ses nombres : « M 0 10 H 5 » donne
// [['M', 0, 10], ['H', 5]].
function commandes(d) {
  return [...d.matchAll(/([A-Z])([^A-Z]*)/g)].map(([, lettre, reste]) => [
    lettre,
    ...reste.trim().split(/\s+/).filter((mot) => mot !== '').map(Number),
  ]);
}

// Les segments tracés d'un chemin fait de M, H, V et L : chacun de son point
// de départ à son point d'arrivée. Un M ne trace rien, il déplace.
function segments(d) {
  const traces = [];
  let x = Number.NaN;
  let y = Number.NaN;
  for (const [lettre, a, b] of commandes(d)) {
    const depart = { x, y };
    if (lettre === 'M' || lettre === 'L') [x, y] = [a, b];
    else if (lettre === 'H') x = a;
    else if (lettre === 'V') y = a;
    else throw new Error(`commande inattendue : ${lettre}`);
    if (lettre !== 'M') traces.push({ lettre, depart, arrivee: { x, y } });
  }
  return traces;
}

// Un axe de comptes à l'écran : 0 en bas d'un tracé de 200 px de haut.
const axeComptes = (max) => echelleLineaire({ domaine: [0, max], plage: [200, 0] });

// Un axe de rangs de 10 px par rang, de 0 à n.
const axeRangs = (n) => echelleLineaire({ domaine: [0, n], plage: [0, 10 * n] });

describe('graphique : les échelles (§ 12.9, D49)', () => {
  test("l'échelle linéaire rend le pixel d'un nombre et le nombre d'un pixel, dans les deux sens de la plage", () => {
    const ex = echelleLineaire({ domaine: [0, 260], plage: [0, 1000] });
    assert.equal(ex.versPx(0), 0);
    assert.equal(ex.versPx(260), 1000);
    assert.equal(ex.versPx(130), 500);
    assert.equal(ex.depuisPx(500), 130);
    const ey = axeComptes(27);
    assert.equal(ey.versPx(0), 200);
    assert.equal(ey.versPx(27), 0);
    assert.equal(ey.depuisPx(200), 0);
    assert.deepEqual([ey.domaine, ey.plage], [[0, 27], [200, 0]]);
  });

  test("un domaine qui ne part pas de zéro est refusé : chaque axe va de zéro à sa plus grande valeur", () => {
    for (const domaine of [[1, 27], [-1, 27], [14, 27]]) {
      assert.throws(() => echelleLineaire({ domaine, plage: [0, 100] }), /zéro/, String(domaine));
    }
    for (const domaine of [[0, -1], [0, Number.NaN], [0, Number.POSITIVE_INFINITY], [0], 'abc', null]) {
      assert.throws(() => echelleLineaire({ domaine, plage: [0, 100] }), RangeError, String(domaine));
    }
    for (const plage of [[0], [0, Number.NaN], null]) {
      assert.throws(() => echelleLineaire({ domaine: [0, 1], plage }), RangeError, String(plage));
    }
  });

  test('un domaine nul (min = max = 0) pose toute valeur en bord de plage, et tout pixel à zéro', () => {
    const ey = axeComptes(0);
    assert.equal(ey.versPx(0), 200);
    assert.equal(ey.depuisPx(0), 0);
    assert.equal(ey.depuisPx(137), 0);
    // Une plage réduite à un point ne divise pas par zéro non plus.
    const plate = echelleLineaire({ domaine: [0, 5], plage: [40, 40] });
    assert.equal(plate.versPx(3), 40);
    assert.equal(plate.depuisPx(90), 0);
  });

  test("l'axe en pourcentages : une échelle de 0 à 100, graduée d'entiers ronds", () => {
    const ey = echelleLineaire({ domaine: [0, 100], plage: [120, 0] });
    assert.equal(ey.versPx(100), 0);
    assert.equal(ey.versPx(50), 60);
    assert.deepEqual(graduations(0, 100, 5, { entieres: true }), [0, 50, 100]);
    assert.deepEqual(graduations(0, 100, 6, { entieres: true }), [0, 20, 40, 60, 80, 100]);
  });

  test("l'échelle log10 des mouvements, de 1 à 200 000 : 1 au bord gauche, croissante, 200 000 au bord droit", () => {
    const ex = echelleLog10({ domaine: [1, 200_000], plage: [0, 530] });
    assert.equal(ex.versPx(1), 0);
    assert.equal(ex.versPx(200_000), 530);
    const points = [1, 10, 100, 1_000, 10_000, 100_000, 200_000].map((v) => ex.versPx(v));
    for (let i = 1; i < points.length; i += 1) assert.ok(points[i] > points[i - 1], `${points}`);
    // Une décade a la même largeur partout : 530 px pour log10(200 000).
    const decade = 530 / Math.log10(200_000);
    assert.ok(Math.abs(points[1] - decade) < 1e-9 && Math.abs(points[4] - points[3] - decade) < 1e-9);
    assert.deepEqual([ex.domaine, ex.plage], [[1, 200_000], [0, 530]]);
  });

  test("l'échelle log10 d'un seul point de relevé, à 1 mouvement, le pose au bord gauche", () => {
    const ex = echelleLog10({ domaine: [1, 1], plage: [0, 530] });
    assert.equal(ex.versPx(1), 0);
  });

  test("l'échelle log10 refuse un domaine qui ne part pas de 1, et une valeur sous 1 : zéro mouvement n'a pas d'abscisse", () => {
    for (const domaine of [[0, 10], [10, 100], [1, 0.5], [1, Number.NaN], null]) {
      assert.throws(() => echelleLog10({ domaine, plage: [0, 100] }), RangeError, String(domaine));
    }
    assert.throws(() => echelleLog10({ domaine: [1, 10], plage: [0] }), RangeError);
    const ex = echelleLog10({ domaine: [1, 1_000], plage: [0, 300] });
    for (const v of [0, 0.5, -1, Number.NaN]) assert.throws(() => ex.versPx(v), RangeError, String(v));
  });

  test('domaineDe : de zéro à la plus grande valeur de toutes les séries, null ignoré', () => {
    assert.deepEqual(domaineDe([3, 27, null, 14], [26, 28]), [0, 28]);
    assert.deepEqual(domaineDe([null, null]), [0, 0]);
    assert.deepEqual(domaineDe(), [0, 0]);
    assert.deepEqual(domaineDe([0, 0]), [0, 0]);
    for (const fautive of [[-1], [Number.NaN], ['3'], 'abc']) {
      assert.throws(() => domaineDe(fautive), RangeError, String(fautive));
    }
  });
});

describe('graphique : les graduations (§ 14.10)', () => {
  // Vrai quand le pas vaut 1, 2 ou 5 × 10ⁿ, à l'arrondi flottant près.
  const estRond = (pas) => {
    const puissance = 10 ** Math.floor(Math.log10(pas) + 1e-12);
    return [1, 2, 5].some((m) => Math.abs(pas / puissance - m) < 1e-9);
  };

  test('un domaine 0..3, graduations entières : 0, 1, 2, 3, jamais un demi', () => {
    assert.deepEqual(graduations(0, 3, 10, { entieres: true }), [0, 1, 2, 3]);
    // Sans l'exigence d'entiers, le même domaine se gradue de demi en demi.
    assert.deepEqual(graduations(0, 3, 10), [0, 0.5, 1, 1.5, 2, 2.5, 3]);
  });

  test("sur un axe de comptes, aucune graduation n'est fractionnaire : 0..10 en cinq au plus donne 0, 5, 10", () => {
    assert.deepEqual(graduations(0, 10, 5, { entieres: true }), [0, 5, 10]);
    let essais = 0;
    for (let max = 1; max <= 300; max += 1) {
      for (let n = 2; n <= 10; n += 1) {
        const marques = graduations(0, max, n, { entieres: true });
        assert.ok(marques.every((v) => Number.isInteger(v)), `0..${max} en ${n} : ${marques}`);
        assert.ok(marques.length >= 1 && marques.length <= n, `0..${max} en ${n} : ${marques}`);
        assert.equal(marques[0], 0);
        assert.ok(marques.at(-1) <= max, `0..${max} en ${n}`);
        if (marques.length > 1) {
          const pas = marques[1] - marques[0];
          assert.ok(estRond(pas) && pas >= 1, `0..${max} en ${n} : pas ${pas}`);
          // Le pas rond précédent aurait donné trop de graduations.
          essais += 1;
        }
      }
    }
    assert.ok(essais > 2_000, `${essais}`);
  });

  test('le pas est le plus petit pas rond qui tient dans le nombre de graduations demandé', () => {
    assert.deepEqual(graduations(0, 27, 6, { entieres: true }), [0, 5, 10, 15, 20, 25]);
    assert.deepEqual(graduations(0, 27, 5, { entieres: true }), [0, 10, 20]);
    assert.deepEqual(graduations(0, 200_000, 5), [0, 50_000, 100_000, 150_000, 200_000]);
    assert.deepEqual(graduations(0, 0.3, 4), [0, 0.1, 0.2, 0.3]);
    assert.deepEqual(graduations(14, 27, 3, { entieres: true }), [15, 20, 25]);
  });

  test('un domaine nul se gradue de sa seule valeur ; un domaine ou un nombre fautif est refusé', () => {
    assert.deepEqual(graduations(0, 0, 5, { entieres: true }), [0]);
    assert.deepEqual(graduations(7, 7, 5), [7]);
    // Un axe se gradue de deux traits au moins : sous deux, le pas rond
    // suivant pourrait n'avoir aucun multiple dans le domaine.
    for (const [min, max, n] of [[3, 1, 5], [0, Number.NaN, 5], [Number.NEGATIVE_INFINITY, 1, 5], [0, 10, 1], [0, 10, 2.5]]) {
      assert.throws(() => graduations(min, max, n), RangeError, `${min}, ${max}, ${n}`);
    }
  });

  test('deux traits au plus gardent les multiples du pas qui tombent dans le domaine, jamais aucun', () => {
    assert.deepEqual(graduations(0, 10, 2, { entieres: true }), [0, 10]);
    assert.deepEqual(graduations(3, 7, 2, { entieres: true }), [4, 6]);
    assert.deepEqual(graduations(0.6, 0.9, 2), [0.6, 0.8]);
  });

  test('sous entieres, un domaine non nul sans entier ne porte aucune graduation', () => {
    assert.deepEqual(graduations(0.2, 0.8, 5, { entieres: true }), []);
    assert.deepEqual(graduations(0.2, 0.8, 5), [0.2, 0.4, 0.6, 0.8]);
    // Un seul entier dans le domaine suffit à le graduer.
    assert.deepEqual(graduations(0.2, 1.3, 5, { entieres: true }), [1]);
  });
});

describe("graphique : l'escalier et la règle (§ 12.3, D51)", () => {
  test('un pas par rang, H et V seulement, jamais une diagonale', () => {
    const d = cheminEscalier([3, 5, 5, 2], axeRangs(4), axeComptes(10));
    assert.equal(d, 'M 0 140 H 10 V 100 H 20 H 30 V 160 H 40');
    for (const { lettre, depart, arrivee } of segments(d)) {
      assert.ok(lettre === 'H' || lettre === 'V', lettre);
      assert.ok(depart.x === arrivee.x || depart.y === arrivee.y, `${JSON.stringify(depart)} → ${JSON.stringify(arrivee)}`);
    }
    assert.equal(commandes(d).filter(([l]) => l === 'H').length, 4);
  });

  test('à valeurs égales, un trait horizontal par rang et aucun vertical', () => {
    const d = cheminEscalier([27, 27, 27], axeRangs(3), axeComptes(27));
    assert.equal(d, 'M 0 0 H 10 H 20 H 30');
  });

  test('260 rangs sur 1 000 px : 260 pas, du bord gauche au bord droit, aucun segment oblique', () => {
    const valeurs = Array.from({ length: 260 }, (_, i) => 14 + (i % 14));
    const ex = echelleLineaire({ domaine: [0, 260], plage: [0, 1000] });
    const d = cheminEscalier(valeurs, ex, axeComptes(27));
    const liste = commandes(d);
    assert.deepEqual(liste[0].slice(0, 2), ['M', 0]);
    assert.deepEqual(liste.at(-1), ['H', 1000]);
    assert.equal(liste.filter(([l]) => l === 'H').length, 260);
    assert.ok(segments(d).every(({ lettre }) => lettre === 'H' || lettre === 'V'));
  });

  test("un rang null interrompt l'escalier : aucun segment ne le traverse, au milieu, au premier ou au dernier rang", () => {
    const ex = axeRangs(5);
    const ey = axeComptes(100);
    // Au milieu : le tracé reprend au rang 4 par un déplacement.
    const milieu = cheminEscalier([90, 80, null, 70, 100], ex, ey);
    assert.equal(milieu, 'M 0 20 H 10 V 40 H 20 M 30 60 H 40 V 0 H 50');
    // Au premier rang : le tracé commence au bord du rang 2.
    assert.equal(cheminEscalier([null, 80, 80, 80, 80], ex, ey), 'M 10 40 H 20 H 30 H 40 H 50');
    // Au dernier rang : le tracé s'arrête au bord droit du rang 4.
    assert.equal(cheminEscalier([80, 80, 80, 80, null], ex, ey), 'M 0 40 H 10 H 20 H 30 H 40');
    for (const [valeurs, nul] of [[[90, 80, null, 70, 100], 3], [[null, 80, 80, 80, 80], 1], [[80, 80, 80, 80, null], 5]]) {
      const gauche = ex.versPx(nul - 1);
      const droite = ex.versPx(nul);
      for (const { depart, arrivee } of segments(cheminEscalier(valeurs, ex, ey))) {
        const [a, b] = [Math.min(depart.x, arrivee.x), Math.max(depart.x, arrivee.x)];
        assert.ok(b <= gauche || a >= droite, `rang ${nul} traversé : ${a} → ${b}`);
      }
    }
  });

  test('un rang isolé entre deux nulls garde son pas ; tout null, ou aucun rang, ne trace rien', () => {
    assert.equal(cheminEscalier([null, 50, null], axeRangs(3), axeComptes(100)), 'M 10 100 H 20');
    assert.equal(cheminEscalier([null, null], axeRangs(2), axeComptes(100)), '');
    assert.equal(cheminEscalier([], axeRangs(1), axeComptes(100)), '');
  });

  test('une valeur fautive est refusée', () => {
    for (const valeurs of [[1, Number.NaN], [1, '2'], [1, undefined], 'abc']) {
      assert.throws(() => cheminEscalier(valeurs, axeRangs(2), axeComptes(10)), RangeError, String(valeurs));
    }
  });

  test('la règle quand le plafond est constant, l’escalier dès qu’il varie', () => {
    assert.deepEqual(regleOuEscalier([27, 27, 27, 27], axeRangs(4), axeComptes(27)), { forme: 'regle', d: 'M 0 0 H 40' });
    assert.deepEqual(regleOuEscalier([100, 100], axeRangs(2), axeComptes(100)), { forme: 'regle', d: 'M 0 0 H 20' });
    assert.deepEqual(regleOuEscalier([27, 26, 27], axeRangs(3), axeComptes(27)), {
      forme: 'escalier',
      d: cheminEscalier([27, 26, 27], axeRangs(3), axeComptes(27)),
    });
    // Un plafond null n'est pas constant : son rang interrompt le tracé.
    assert.deepEqual(regleOuEscalier([27, null], axeRangs(2), axeComptes(27)), { forme: 'escalier', d: 'M 0 0 H 10' });
    assert.deepEqual(regleOuEscalier([], axeRangs(1), axeComptes(27)), { forme: 'regle', d: '' });
  });
});

describe('graphique : les points de relevé (§ 12.14, D49)', () => {
  const ex = echelleLog10({ domaine: [1, 1_000], plage: [0, 300] });
  const ey = axeComptes(20);

  test('des segments entre points de relevé, à leurs abscisses en mouvements', () => {
    const d = cheminPoints([{ x: 1, y: 0 }, { x: 10, y: 10 }, { x: 100, y: 15 }, { x: 1_000, y: 20 }], ex, ey);
    assert.equal(d, 'M 0 200 L 100 100 L 200 50 L 300 0');
  });

  test("un seul point de relevé : un déplacement, aucun trait ; aucun point, aucun chemin", () => {
    assert.equal(cheminPoints([{ x: 1, y: 5 }], ex, ey), 'M 0 150');
    assert.equal(cheminPoints([], ex, ey), '');
  });

  test('une valeur null interrompt les segments, qui reprennent au point suivant', () => {
    const d = cheminPoints([{ x: 1, y: 0 }, { x: 10, y: null }, { x: 100, y: 15 }, { x: 1_000, y: 20 }], ex, ey);
    assert.equal(d, 'M 0 200 M 200 50 L 300 0');
  });

  test('un point fautif est refusé', () => {
    for (const points of [[{ x: 1, y: Number.NaN }], [{ x: 1 }], [null], 'abc']) {
      assert.throws(() => cheminPoints(points, ex, ey), RangeError, JSON.stringify(points));
    }
  });
});

describe('graphique : le pointage au plus proche (§ 12.7)', () => {
  test('260 rangs sur 1 000 px : chaque pixel désigne un rang, chaque rang est atteint, dans l’ordre', () => {
    const ex = echelleLineaire({ domaine: [0, 260], plage: [0, 1000] });
    const vus = new Set();
    let precedent = 1;
    for (let px = 0; px <= 1000; px += 1) {
      const rang = rangLePlusProche(px, ex, 260);
      assert.ok(Number.isInteger(rang) && rang >= 1 && rang <= 260, `${px} → ${rang}`);
      assert.ok(rang >= precedent, `${px} → ${rang}`);
      precedent = rang;
      vus.add(rang);
    }
    assert.equal(vus.size, 260);
    for (let rang = 1; rang <= 260; rang += 1) assert.equal(rangLePlusProche(ex.versPx(rang - 0.5), ex, 260), rang);
  });

  test('un seul rang : tout pixel le désigne', () => {
    const ex = axeRangs(1);
    for (const px of [-50, 0, 5, 10, 900]) assert.equal(rangLePlusProche(px, ex, 1), 1);
  });

  test('hors du tracé, le rang se borne au premier et au dernier : jamais le rang 0, jamais n + 1', () => {
    const ex = axeRangs(26);
    assert.equal(rangLePlusProche(-1, ex, 26), 1);
    assert.equal(rangLePlusProche(-400, ex, 26), 1);
    assert.equal(rangLePlusProche(260, ex, 26), 26);
    assert.equal(rangLePlusProche(5_000, ex, 26), 26);
  });

  test('un pixel ou un nombre de rangs fautif est refusé', () => {
    for (const [px, n] of [[Number.NaN, 3], [0, 0], [0, 2.5], [0, -1]]) {
      assert.throws(() => rangLePlusProche(px, axeRangs(3), n), RangeError, `${px}, ${n}`);
    }
  });

  test('le point de relevé le plus proche, le premier à égalité, borné aux points existants', () => {
    const abscisses = [0, 100, 200, 300];
    assert.equal(pointLePlusProche(-40, abscisses), 0);
    assert.equal(pointLePlusProche(49, abscisses), 0);
    assert.equal(pointLePlusProche(50, abscisses), 0);
    assert.equal(pointLePlusProche(51, abscisses), 1);
    assert.equal(pointLePlusProche(260, abscisses), 3);
    assert.equal(pointLePlusProche(9_999, abscisses), 3);
    assert.equal(pointLePlusProche(123, [42]), 0);
    for (const [px, liste] of [[0, []], [Number.NaN, [1]], [0, [Number.NaN]], [0, 'abc']]) {
      assert.throws(() => pointLePlusProche(px, liste), RangeError, `${px}, ${liste}`);
    }
  });
});

describe('graphique : les barres et les colonnes (§ 12.4, § 12.13)', () => {
  const ex = echelleLineaire({ domaine: [0, 10], plage: [0, 200] });

  test('un ou deux segments empilés, depuis zéro, une ligne sous l’autre', () => {
    const { lignes, hauteurTotale } = barres([[3, 2], [6], [0, 4]], ex, 20, 4);
    assert.deepEqual(lignes, [
      { y: 0, hauteur: 20, segments: [{ x: 0, largeur: 60 }, { x: 60, largeur: 40 }] },
      { y: 24, hauteur: 20, segments: [{ x: 0, largeur: 120 }] },
      { y: 48, hauteur: 20, segments: [{ x: 0, largeur: 0 }, { x: 0, largeur: 80 }] },
    ]);
    assert.equal(hauteurTotale, 68);
    assert.deepEqual(barres([], ex, 20, 4), { lignes: [], hauteurTotale: 0 });
  });

  test('une ligne sans segment, à trois segments, ou un segment négatif est refusée', () => {
    for (const lignes of [[[]], [[1, 2, 3]], [[-1]], [[Number.NaN]], ['abc'], 'abc']) {
      assert.throws(() => barres(lignes, ex, 20, 4), RangeError, JSON.stringify(lignes));
    }
    assert.throws(() => barres([[1]], ex, -1, 4), RangeError);
    assert.throws(() => barres([[1]], ex, 20, Number.NaN), RangeError);
  });

  test('deux colonnes juxtaposées partagent la largeur, chacune son axe', () => {
    assert.deepEqual(colonnesJuxtaposees(500, 2, 20), [
      { x: 0, largeur: 240 },
      { x: 260, largeur: 240 },
    ]);
    assert.deepEqual(colonnesJuxtaposees(300, 1, 20), [{ x: 0, largeur: 300 }]);
    // Plus étroite que ses écarts, une colonne garde une largeur nulle.
    assert.deepEqual(colonnesJuxtaposees(10, 2, 20), [
      { x: 0, largeur: 0 },
      { x: 20, largeur: 0 },
    ]);
    for (const [largeur, n, ecart] of [[500, 0, 20], [500, 1.5, 20], [-1, 2, 20], [500, 2, -1]]) {
      assert.throws(() => colonnesJuxtaposees(largeur, n, ecart), RangeError, `${largeur}, ${n}, ${ecart}`);
    }
  });
});

describe('graphique : la grille et ses niveaux (§ 12.5, D33, B29)', () => {
  test(`une case tient ${CIBLE_MIN_PX} px : dessinable ; à 23 px, non`, () => {
    assert.deepEqual(grille(10, 10, 240, 16), { cote: 24, dessinable: true, largeur: 240, hauteur: 240 });
    assert.deepEqual(grille(10, 10, 239, 16), { cote: 23, dessinable: false, largeur: 230, hauteur: 230 });
    assert.equal(CIBLE_MIN_PX, 24);
  });

  test('au seuil de la matrice, la case tient la cible dans la largeur qui le définit ; au seuil plus un, non', () => {
    const seuil = constante('SEUIL_MATRICE_PARTICIPANTS');
    const largeur = seuil * CIBLE_MIN_PX;
    assert.equal(grille(seuil, seuil, largeur, 16).dessinable, true);
    assert.equal(grille(seuil + 1, seuil + 1, largeur, 16).dessinable, false);
  });

  test("sous le seuil, une carte plus étroite que n cases de la cible ne dessine pas la matrice : la largeur réelle décide", () => {
    const n = constante('SEUIL_MATRICE_PARTICIPANTS') - 1;
    // Le seuil compte des personnes, non des pixels : un pixel de moins que
    // n cases de CIBLE_MIN_PX suffit à faire tomber la grille.
    const etroite = grille(n, n, n * CIBLE_MIN_PX - 1, 16);
    assert.equal(etroite.dessinable, false);
    assert.ok(etroite.cote < CIBLE_MIN_PX);
    // 30 cases de 24 px demandent 720 px.
    assert.equal(grille(30, 30, 700, 16).dessinable, false);
  });

  test('la borne de la case : peu de colonnes dans une carte large ne font pas de cases plus grandes qu’elle', () => {
    assert.deepEqual(grille(4, 2, 1200, 16), { cote: 600, dessinable: true, largeur: 1200, hauteur: 2400 });
    assert.deepEqual(grille(4, 2, 1200, 16, 40), { cote: 40, dessinable: true, largeur: 80, hauteur: 160 });
    assert.deepEqual(grille(4, 2, 1200, 16, 40.7), { cote: 40, dessinable: true, largeur: 80, hauteur: 160 });
    // Une carte étroite décide sous la borne, et une borne sous la cible
    // rend la grille non dessinable.
    assert.equal(grille(4, 40, 900, 16, 40).cote, 22);
    assert.equal(grille(4, 2, 1200, 16, CIBLE_MIN_PX - 1).dessinable, false);
    for (const borne of [-1, Number.NaN, Number.NEGATIVE_INFINITY]) {
      assert.throws(() => grille(4, 2, 1200, 16, borne), RangeError, String(borne));
    }
  });

  test('une case qui ne tient pas la hauteur de son texte, une grille vide, ne se dessinent pas', () => {
    assert.equal(grille(4, 4, 120, 31).dessinable, false);
    assert.equal(grille(4, 4, 120, 30).dessinable, true);
    assert.deepEqual(grille(0, 3, 120, 16), { cote: 40, dessinable: false, largeur: 120, hauteur: 0 });
    assert.deepEqual(grille(3, 0, 120, 16), { cote: 0, dessinable: false, largeur: 0, hauteur: 0 });
    for (const args of [[1.5, 3, 100, 16], [3, -1, 100, 16], [3, 3, Number.NaN, 16], [3, 3, 100, -1]]) {
      assert.throws(() => grille(...args), RangeError, `${args}`);
    }
  });

  test('quatre niveaux aux bornes fixes : 0, 1, 2, puis 3 et plus', () => {
    assert.deepEqual([...NIVEAUX], [0, 1, 2, 3]);
    assert.ok(Object.isFrozen(NIVEAUX));
    assert.deepEqual([0, 1, 2, 3, 7].map(niveau), [0, 1, 2, 3, 3]);
    for (const v of [-1, 1.5, Number.NaN, '2']) assert.throws(() => niveau(v), RangeError, String(v));
  });
});

describe('graphique : la troncature sur des largeurs mesurées (§ 12.6)', () => {
  // Les largeurs d'un nom de cinq lettres : les quatre préfixes suivis de la
  // marque, puis le nom entier.
  const largeurs = [18, 27, 36, 45, 48];

  test('le nom entier quand il tient, sinon le plus long préfixe qui tient suivi de la marque', () => {
    assert.equal(tronquer(largeurs, 48), 5);
    assert.equal(tronquer(largeurs, 100), 5);
    assert.equal(tronquer(largeurs, 47), 4);
    assert.equal(tronquer(largeurs, 30), 2);
    assert.equal(tronquer(largeurs, 18), 1);
  });

  test('rien ne tient : zéro ; un nom vide reste vide', () => {
    assert.equal(tronquer(largeurs, 17), 0);
    assert.equal(tronquer([20], 19), 0);
    assert.equal(tronquer([20], 20), 1);
    assert.equal(tronquer([], 50), 0);
  });

  test('une largeur fautive est refusée', () => {
    for (const [liste, max] of [[[Number.NaN], 10], [[-1], 10], [[1], Number.NaN], [[1], -1], ['abc', 10]]) {
      assert.throws(() => tronquer(liste, max), RangeError, `${liste}, ${max}`);
    }
  });
});
