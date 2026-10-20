// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de la navigation au clavier du plan (§ 7.3, § 13.5), sans DOM :
// la table voisine dans la direction d'une flèche, le siège voisin, ce que
// fait une touche sur l'élément actif, et la vue qui amène une place dans
// le cadre.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { ecranDepuisDessin } from '../../geometrie/vue.js';
import { siegeVoisin, tableVoisine, toucheDuPlan, vueQuiMontre } from './clavier.js';

// Une grille de 3 × 3 tables, au pas de 300 cm, numérotées ligne par ligne :
// 1 2 3 / 4 5 6 / 7 8 9 ; l'identifiant vaut dix fois le numéro.
const GRILLE = Array.from({ length: 9 }, (_, rang) => ({
  id: 10 * (rang + 1),
  numero: rang + 1,
  centre: { x: 300 * (rang % 3), y: 300 * Math.floor(rang / 3) },
}));

const idDuNumero = (numero) => 10 * numero;

describe('tableVoisine : la plus proche dans le cône de la flèche (§ 7.3)', () => {
  test('depuis le centre de la grille : chaque flèche mène à la voisine de son côté', () => {
    assert.equal(GRILLE.length, 9);
    const centre = idDuNumero(5);
    assert.equal(tableVoisine(GRILLE, centre, 'droite'), idDuNumero(6));
    assert.equal(tableVoisine(GRILLE, centre, 'gauche'), idDuNumero(4));
    assert.equal(tableVoisine(GRILLE, centre, 'haut'), idDuNumero(2));
    assert.equal(tableVoisine(GRILLE, centre, 'bas'), idDuNumero(8));
  });

  test('au bord, aucune table dans le cône : la même', () => {
    assert.equal(tableVoisine(GRILLE, idDuNumero(6), 'droite'), idDuNumero(6));
    assert.equal(tableVoisine(GRILLE, idDuNumero(1), 'haut'), idDuNumero(1));
    assert.equal(tableVoisine(GRILLE, idDuNumero(7), 'gauche'), idDuNumero(7));
    assert.equal(tableVoisine(GRILLE, idDuNumero(9), 'bas'), idDuNumero(9));
  });

  test('égalité de distance dans le cône : le plus petit numéro l’emporte, quel que soit l’ordre des géométries', () => {
    // Depuis la table 1, vers la droite et en diagonale à 45° : (300, 300)
    // et (300, −300) sont à égale distance et sur les bords du cône.
    const tables = [
      { id: 1, numero: 1, centre: { x: 0, y: 0 } },
      { id: 2, numero: 7, centre: { x: 300, y: 300 } },
      { id: 3, numero: 4, centre: { x: 300, y: -300 } },
    ];
    assert.equal(tableVoisine(tables, 1, 'droite'), 3);
    assert.equal(tableVoisine([...tables].reverse(), 1, 'droite'), 3);
  });

  test('hors du cône, même plus proche, une table n’est pas voisine', () => {
    const tables = [
      { id: 1, numero: 1, centre: { x: 0, y: 0 } },
      { id: 2, numero: 2, centre: { x: 100, y: 150 } },
      { id: 3, numero: 3, centre: { x: 900, y: 0 } },
    ];
    assert.equal(tableVoisine(tables, 1, 'droite'), 3);
  });

  test('une direction inconnue lève', () => {
    assert.throws(() => tableVoisine(GRILLE, 50, 'nord'), /direction/);
  });
});

describe('siegeVoisin : l’ordre des numéros, circulairement', () => {
  test('suivant et précédent ; 8 → 1 et 1 → 8 sur une table de 8', () => {
    assert.equal(siegeVoisin(8, 8, +1), 1);
    assert.equal(siegeVoisin(8, 1, -1), 8);
    assert.equal(siegeVoisin(8, 3, +1), 4);
    assert.equal(siegeVoisin(8, 3, -1), 2);
    assert.equal(siegeVoisin(2, 2, +1), 1);
  });
});

describe('toucheDuPlan : ce que fait une touche sur l’élément actif (§ 7.3)', () => {
  const regimes = new Map([[10, 'sieges'], [20, 'table']]);
  const contexte = {
    geometries: [
      { id: 10, numero: 1, centre: { x: 0, y: 0 } },
      { id: 20, numero: 2, centre: { x: 300, y: 0 } },
    ],
    regimeDe: (id) => regimes.get(id),
    capaciteDe: () => 6,
  };

  test('sans élément actif, une flèche ou l’entrée active la première table ; une autre touche ne fait rien', () => {
    assert.deepEqual(toucheDuPlan(null, 'ArrowRight', contexte), { actif: { table: 10, siege: null }, effet: null });
    assert.deepEqual(toucheDuPlan(null, 'Enter', contexte), { actif: { table: 10, siege: null }, effet: null });
    assert.equal(toucheDuPlan(null, 'a', contexte), null);
    assert.equal(toucheDuPlan(null, 'ArrowRight', { ...contexte, geometries: [] }), null);
  });

  test('une flèche sur une table mène à sa voisine ; sur un siège, au siège voisin', () => {
    assert.deepEqual(toucheDuPlan({ table: 10, siege: null }, 'ArrowRight', contexte), { actif: { table: 20, siege: null }, effet: null });
    assert.deepEqual(toucheDuPlan({ table: 10, siege: 6 }, 'ArrowRight', contexte), { actif: { table: 10, siege: 1 }, effet: null });
    assert.deepEqual(toucheDuPlan({ table: 10, siege: 1 }, 'ArrowUp', contexte), { actif: { table: 10, siege: 6 }, effet: null });
    assert.deepEqual(toucheDuPlan({ table: 10, siege: 2 }, 'ArrowDown', contexte), { actif: { table: 10, siege: 3 }, effet: null });
  });

  test('l’entrée descend dans les sièges en régime sièges ; en régime table, ouvre le panneau de la table', () => {
    assert.deepEqual(toucheDuPlan({ table: 10, siege: null }, 'Enter', contexte), { actif: { table: 10, siege: 1 }, effet: null });
    assert.deepEqual(toucheDuPlan({ table: 20, siege: null }, 'Enter', contexte), {
      actif: { table: 20, siege: null },
      effet: { type: 'ouvrirTable', table: 20 },
    });
    assert.deepEqual(toucheDuPlan({ table: 10, siege: null }, ' ', contexte), { actif: { table: 10, siege: 1 }, effet: null });
  });

  test('l’entrée sur un siège le sélectionne ; l’échappement remonte à la table, puis oublie', () => {
    assert.deepEqual(toucheDuPlan({ table: 10, siege: 4 }, 'Enter', contexte), {
      actif: { table: 10, siege: 4 },
      effet: { type: 'selectionner', place: { table: 10, siege: 4 } },
    });
    assert.deepEqual(toucheDuPlan({ table: 10, siege: 4 }, 'Escape', contexte), { actif: { table: 10, siege: null }, effet: null });
    assert.deepEqual(toucheDuPlan({ table: 10, siege: null }, 'Escape', contexte), {
      actif: { table: 10, siege: null },
      effet: { type: 'remonter' },
    });
  });

  test('un siège d’une table passée en régime table se lit comme sa table', () => {
    assert.deepEqual(toucheDuPlan({ table: 20, siege: 3 }, 'ArrowLeft', contexte), { actif: { table: 10, siege: null }, effet: null });
    assert.deepEqual(toucheDuPlan({ table: 20, siege: 3 }, 'Enter', contexte), {
      actif: { table: 20, siege: null },
      effet: { type: 'ouvrirTable', table: 20 },
    });
  });

  test('un élément actif dont la table n’existe plus repart de la première', () => {
    assert.deepEqual(toucheDuPlan({ table: 99, siege: 2 }, 'ArrowRight', contexte), { actif: { table: 10, siege: null }, effet: null });
  });
});

describe('vueQuiMontre : la place dans le cadre, sans changer k (§ 5.8)', () => {
  const cadre = { gauche: 40, haut: 30, largeur: 800, hauteur: 600 };
  const vue = { k: 0.5, tx: 100, ty: 50 };

  test('un point déjà dans le cadre, marge comprise : la même vue', () => {
    assert.equal(vueQuiMontre(vue, cadre, { x: 200, y: 200 }), vue);
  });

  test('un point hors du cadre : k inchangé, le point au centre du cadre', () => {
    for (const point of [{ x: 3000, y: 100 }, { x: -900, y: 100 }, { x: 100, y: 5000 }, { x: 100, y: -400 }]) {
      const montree = vueQuiMontre(vue, cadre, point);
      assert.equal(montree.k, vue.k);
      const ecran = ecranDepuisDessin(montree, cadre, point.x, point.y);
      assert.equal(ecran.x, cadre.gauche + cadre.largeur / 2);
      assert.equal(ecran.y, cadre.haut + cadre.hauteur / 2);
    }
  });

  test('sans vue, ou dans un cadre nul, rien ne change', () => {
    assert.equal(vueQuiMontre(null, cadre, { x: 0, y: 0 }), null);
    const nul = { gauche: 0, haut: 0, largeur: 0, hauteur: 0 };
    assert.equal(vueQuiMontre(vue, nul, { x: 9000, y: 0 }), vue);
  });
});
