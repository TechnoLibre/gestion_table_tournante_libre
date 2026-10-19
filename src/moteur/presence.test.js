// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de la lecture de la présence d'une personne : le champ absent vaut
// tous les tours, la liste rendue est neuve, un tour se lit présent ou
// absent, et la forme canonique d'une saisie se trie, se dédoublonne et
// s'efface quand elle couvre la soirée. Les noms sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { estPresentAuTour, presenceCanonique, toursDePresence } from './presence.js';

describe('toursDePresence : la seule lecture de « champ absent = tous les tours »', () => {
  test('le champ absent donne 1..R, croissants', () => {
    assert.deepEqual(toursDePresence({ id: 1, nom: 'Ysaline Brumaire' }, 4), [1, 2, 3, 4]);
    assert.deepEqual(toursDePresence({ id: 1, presence: undefined }, 3), [1, 2, 3]);
  });

  test('R = 1 : le champ absent donne le seul tour', () => {
    assert.deepEqual(toursDePresence({ id: 2 }, 1), [1]);
  });

  test('une présence énumérée se rend telle quelle, sans contrôle', () => {
    assert.deepEqual(toursDePresence({ id: 3, presence: [2, 4] }, 4), [2, 4]);
    assert.deepEqual(toursDePresence({ id: 3, presence: [5] }, 2), [5]);
  });

  test('la liste rendue est neuve : la modifier ne touche ni le participant, ni un appel suivant', () => {
    const presence = Object.freeze([1, 3]);
    const participant = Object.freeze({ id: 4, presence });
    const rendue = toursDePresence(participant, 4);
    assert.notEqual(rendue, presence);
    rendue.push(4);
    assert.deepEqual(participant.presence, [1, 3]);
    const pleine = toursDePresence({ id: 5 }, 2);
    pleine.pop();
    assert.deepEqual(toursDePresence({ id: 5 }, 2), [1, 2]);
  });

  test('presence: null n’est pas le champ absent : la lecture lève', () => {
    assert.throws(() => toursDePresence({ id: 4, presence: null }, 3));
    assert.throws(() => estPresentAuTour({ id: 4, presence: null }, 2));
  });

  test("exclu n'est pas lu", () => {
    assert.deepEqual(toursDePresence({ id: 6, exclu: true }, 2), [1, 2]);
    assert.deepEqual(toursDePresence({ id: 6, exclu: true, presence: [2] }, 2), [2]);
  });
});

describe('estPresentAuTour', () => {
  test('le champ absent : présente à chaque tour', () => {
    for (const tour of [1, 2, 7]) assert.equal(estPresentAuTour({ id: 1 }, tour), true, `tour ${tour}`);
  });

  test('une présence énumérée : présente à ses tours, absente aux autres', () => {
    const participant = { id: 2, presence: [1, 3] };
    assert.deepEqual([1, 2, 3, 4].map((tour) => estPresentAuTour(participant, tour)), [true, false, true, false]);
  });

  test("exclu n'est pas lu", () => {
    assert.equal(estPresentAuTour({ id: 3, exclu: true }, 2), true);
    assert.equal(estPresentAuTour({ id: 3, exclu: true, presence: [1] }, 2), false);
  });
});

describe('presenceCanonique : la forme écrite d’une saisie', () => {
  test('la forme pleine donne undefined, dans tout ordre et avec doublons', () => {
    assert.equal(presenceCanonique([1, 2, 3], 3), undefined);
    assert.equal(presenceCanonique([3, 1, 2, 2], 3), undefined);
    assert.equal(presenceCanonique([1], 1), undefined);
  });

  test('une saisie partielle se rend triée, sans doublon', () => {
    assert.deepEqual(presenceCanonique([3, 1], 4), [1, 3]);
    assert.deepEqual(presenceCanonique([2, 2, 4, 2], 4), [2, 4]);
    assert.deepEqual(presenceCanonique([10, 9, 2], 10), [2, 9, 10]);
  });

  test('la liste rendue est neuve, et la saisie reste intacte', () => {
    const saisie = Object.freeze([4, 2]);
    const rendue = presenceCanonique(saisie, 4);
    assert.deepEqual(rendue, [2, 4]);
    assert.notEqual(rendue, saisie);
    assert.deepEqual(saisie, [4, 2]);
  });

  test('RangeError pour une liste vide, un tour 0, R + 1, ou non entier', () => {
    for (const liste of [[], [0], [5], [1, 5], [1.5], [2, -1], [Number.NaN], ['2']]) {
      assert.throws(() => presenceCanonique(liste, 4), RangeError, JSON.stringify(liste));
    }
  });

  test('le message de la RangeError nomme le tour fautif et R', () => {
    assert.throws(() => presenceCanonique([2, 5], 4), /tour 5 .*1 à 4/);
    assert.throws(() => presenceCanonique([], 4), /vide/);
  });
});
