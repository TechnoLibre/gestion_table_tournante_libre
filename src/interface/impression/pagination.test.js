// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La pagination des listes imprimées (§ 11.7), sans DOM : des hauteurs
// mesurées, la hauteur utile d'une page et celle de l'en-tête que chaque
// page répète, et les pages qu'elles donnent — aux bords exacts, une ligne
// plus haute qu'une page, une liste vide, plusieurs feuilles bout à bout.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { mesurerPlace, paginer, paginerFeuilles } from './pagination.js';

describe('paginer : les lignes d’une liste en pages', () => {
  test('une somme exactement égale à la hauteur utile, en-tête compris, tient sur une page ; + 0,01 en donne deux', () => {
    const options = { hauteurUtile: 100, hauteurEntete: 10 };
    assert.deepEqual(paginer([25.5, 30.25, 34.25], options), [{ debut: 0, fin: 3, seule: false }]);
    assert.deepEqual(paginer([25.5, 30.25, 34.26], options), [
      { debut: 0, fin: 2, seule: false },
      { debut: 2, fin: 3, seule: false },
    ]);
  });

  test('le bruit de l’arithmétique flottante ne pousse pas une ligne sur la page suivante : 0,1 + 0,2 tient dans 0,3', () => {
    assert.ok(0.1 + 0.2 > 0.3);
    assert.deepEqual(paginer([0.1, 0.2], { hauteurUtile: 0.3, hauteurEntete: 0 }), [{ debut: 0, fin: 2, seule: false }]);
  });

  test('l’en-tête se répète sur chaque page : chacune le retranche de sa hauteur utile', () => {
    const pages = paginer([30, 30, 30, 30, 30, 30, 30], { hauteurUtile: 100, hauteurEntete: 10 });
    assert.deepEqual(pages, [
      { debut: 0, fin: 3, seule: false },
      { debut: 3, fin: 6, seule: false },
      { debut: 6, fin: 7, seule: false },
    ]);
    // Sans en-tête, trois lignes de 30 laissent la place d'une quatrième de 10.
    assert.deepEqual(paginer([30, 30, 30, 10], { hauteurUtile: 100, hauteurEntete: 0 }), [{ debut: 0, fin: 4, seule: false }]);
    assert.deepEqual(paginer([30, 30, 30, 10], { hauteurUtile: 100, hauteurEntete: 10 }), [
      { debut: 0, fin: 3, seule: false },
      { debut: 3, fin: 4, seule: false },
    ]);
    // La deuxième page retranche aussi l'en-tête : deux lignes de 50 n'y
    // tiennent pas ensemble, quand elles rempliraient une page sans lui.
    assert.deepEqual(paginer([45, 45, 50, 50], { hauteurUtile: 100, hauteurEntete: 10 }), [
      { debut: 0, fin: 2, seule: false },
      { debut: 2, fin: 3, seule: false },
      { debut: 3, fin: 4, seule: false },
    ]);
  });

  test('une ligne plus haute qu’une page est seule sur la sienne, et seule à porter seule vrai', () => {
    const pages = paginer([20, 95, 20, 20], { hauteurUtile: 100, hauteurEntete: 10 });
    assert.deepEqual(pages, [
      { debut: 0, fin: 1, seule: false },
      { debut: 1, fin: 2, seule: true },
      { debut: 2, fin: 4, seule: false },
    ]);
    // Une ligne qui tient juste n'est pas signalée, même seule sur sa page.
    assert.deepEqual(paginer([20, 90], { hauteurUtile: 100, hauteurEntete: 10 }), [
      { debut: 0, fin: 1, seule: false },
      { debut: 1, fin: 2, seule: false },
    ]);
    assert.deepEqual(paginer([200], { hauteurUtile: 100, hauteurEntete: 10 }), [{ debut: 0, fin: 1, seule: true }]);
  });

  test('une liste vide donne une page, son en-tête seul ; une ligne, une page', () => {
    assert.deepEqual(paginer([], { hauteurUtile: 100, hauteurEntete: 10 }), [{ debut: 0, fin: 0, seule: false }]);
    assert.deepEqual(paginer([5], { hauteurUtile: 100, hauteurEntete: 10 }), [{ debut: 0, fin: 1, seule: false }]);
  });

  test('chaque ligne est sur une page et une seule, dans l’ordre, et aucune page ne dépasse sa hauteur utile', () => {
    const hauteurs = Array.from({ length: 257 }, (_, i) => 4 + ((i * 7) % 11));
    const options = { hauteurUtile: 120, hauteurEntete: 13 };
    const pages = paginer(hauteurs, options);
    assert.equal(pages[0].debut, 0);
    assert.equal(pages.at(-1).fin, hauteurs.length);
    for (let i = 1; i < pages.length; i += 1) assert.equal(pages[i].debut, pages[i - 1].fin);
    for (const { debut, fin } of pages) {
      const somme = hauteurs.slice(debut, fin).reduce((a, b) => a + b, options.hauteurEntete);
      assert.ok(somme <= options.hauteurUtile, `${debut}..${fin} : ${somme}`);
      // La ligne suivante n'y tenait pas.
      if (fin < hauteurs.length) assert.ok(somme + hauteurs[fin] > options.hauteurUtile, `${debut}..${fin} pouvait prendre ${fin}`);
    }
  });

  test('des hauteurs ou des options hors de leur domaine lèvent RangeError ; un en-tête qui remplit la page aussi', () => {
    const options = { hauteurUtile: 100, hauteurEntete: 10 };
    for (const hauteurs of [[-1], [Number.NaN], [Number.POSITIVE_INFINITY], ['3']]) {
      assert.throws(() => paginer(hauteurs, options), RangeError, JSON.stringify(hauteurs));
    }
    assert.throws(() => paginer('abc', options), TypeError);
    for (const fautives of [{ hauteurUtile: 0, hauteurEntete: 0 }, { hauteurUtile: 100, hauteurEntete: -1 }, { hauteurUtile: 100, hauteurEntete: 100 }, { hauteurUtile: Number.NaN, hauteurEntete: 0 }]) {
      assert.throws(() => paginer([1], fautives), RangeError, JSON.stringify(fautives));
    }
  });
});

describe('paginerFeuilles : plusieurs listes, chacune sur ses propres pages', () => {
  test('chaque feuille commence une page ; ses pages se suivent, son en-tête retranché de chacune', () => {
    const pages = paginerFeuilles(
      [
        { entete: 10, lignes: [30, 30, 30, 30] },
        { entete: 20, lignes: [] },
        { entete: 5, lignes: [50, 45] },
      ],
      100,
    );
    assert.deepEqual(pages, [
      { rang: 0, feuille: 0, debut: 0, fin: 3, seule: false },
      { rang: 1, feuille: 0, debut: 3, fin: 4, seule: false },
      { rang: 2, feuille: 1, debut: 0, fin: 0, seule: false },
      { rang: 3, feuille: 2, debut: 0, fin: 2, seule: false },
    ]);
  });

  test('aucune feuille, aucune page', () => {
    assert.deepEqual(paginerFeuilles([], 100), []);
  });
});

describe('mesurerPlace : la part de la largeur d’une liste que prend son plus large libellé de tour', () => {
  // Un élément réduit à sa boîte rendue, de la largeur donnée en px.
  const boite = (width) => ({ getBoundingClientRect: () => ({ width }) });

  test('la largeur de la sonde, plus un pixel d’arrondi, sur celle du tableau, en pour cent', () => {
    assert.equal(mesurerPlace(boite(79), boite(800)), 10);
    assert.equal(mesurerPlace(boite(0), boite(400)), 0.25);
  });

  test('un tableau sans largeur lève RangeError', () => {
    assert.throws(() => mesurerPlace(boite(10), boite(0)), RangeError);
  });
});
