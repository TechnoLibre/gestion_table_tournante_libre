// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de la présence par tour côté fichier : les absents de chaque tour
// qu'une proposition écrit, les exclues ignorées, et la présence d'une charge
// quand le nombre de tours change — listes tronquées, rendues canoniques,
// exclues comprises ; une liste qui se viderait refusée pour une non exclue,
// effacée pour une exclue. Les noms sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { absentsParTour, presencesSousTours } from './presence.js';

// Une personne d'épreuve : présente à tous les tours quand presence manque.
function personne(id, { presence, exclu = false } = {}) {
  const enregistrement = { id, nom: `Ancolie ${id}`, appartenance: null, exclu };
  if (presence !== undefined) enregistrement.presence = presence;
  return enregistrement;
}

// Fige une valeur à toute profondeur et la rend.
function geler(valeur) {
  if (typeof valeur === 'object' && valeur !== null) {
    for (const enfant of Object.values(valeur)) geler(enfant);
    Object.freeze(valeur);
  }
  return valeur;
}

describe('absentsParTour : les absents de chaque tour, exclues ignorées', () => {
  test('une liste par tour, identifiants croissants quel que soit l’ordre reçu ; le champ absent vaut présente partout', () => {
    const participants = [
      personne(7, { presence: [1, 2] }),
      personne(2),
      personne(5, { presence: [3] }),
      personne(3, { presence: [2, 3] }),
    ];
    assert.deepEqual(absentsParTour(participants, 3), [[3, 5], [5], [7]]);
  });

  test('une exclue n’est absente à aucun tour : sa présence est suspendue', () => {
    const participants = [personne(1, { presence: [2], exclu: true }), personne(4, { presence: [1] })];
    assert.deepEqual(absentsParTour(participants, 2), [[], [4]]);
  });

  test('une présence écrite hors de l’ordre croissant se lit tour par tour', () => {
    assert.deepEqual(absentsParTour([personne(9, { presence: [3, 1] })], 4), [[], [9], [], [9]]);
  });

  test('R = 1, sans personne ou sans absence : des listes vides, une par tour', () => {
    assert.deepEqual(absentsParTour([personne(1)], 1), [[]]);
    assert.deepEqual(absentsParTour([], 3), [[], [], []]);
    assert.deepEqual(absentsParTour([personne(1), personne(2)], 2), [[], []]);
  });

  test('ne modifie pas ce qu’elle reçoit, et rend des listes neuves à chaque appel', () => {
    const participants = geler([personne(1, { presence: [1] }), personne(2)]);
    const premier = absentsParTour(participants, 2);
    premier[1].push(99);
    assert.deepEqual(absentsParTour(participants, 2), [[], [1]]);
  });
});

describe('presencesSousTours : la présence quand le nombre de tours change', () => {
  test('à la baisse, chaque liste se tronque ; une liste qui couvre alors tous les tours perd le champ', () => {
    const participants = [
      personne(1, { presence: [1, 4] }),
      personne(2, { presence: [1, 2, 3] }),
      personne(3, { presence: [2] }),
      personne(4),
    ];
    const { participants: rendus, rognees, videes } = presencesSousTours(participants, 3);
    assert.deepEqual(rendus, [personne(1, { presence: [1] }), personne(2), personne(3, { presence: [2] }), personne(4)]);
    assert.equal(Object.hasOwn(rendus[1], 'presence'), false);
    assert.deepEqual(rognees, [
      { participant: 1, avant: [1, 4], apres: [1] },
      { participant: 2, avant: [1, 2, 3], apres: null },
    ]);
    assert.deepEqual(videes, []);
  });

  test('une exclue se rogne comme les autres, et figure dans rognees', () => {
    const { participants, rognees } = presencesSousTours([personne(6, { presence: [2, 5], exclu: true })], 4);
    assert.deepEqual(participants, [personne(6, { presence: [2], exclu: true })]);
    assert.deepEqual(rognees, [{ participant: 6, avant: [2, 5], apres: [2] }]);
  });

  test('une exclue dont la liste se viderait perd le champ, figure dans rognees avec apres null, et pas dans videes', () => {
    const { participants, rognees, videes } = presencesSousTours([personne(8, { presence: [4], exclu: true })], 3);
    assert.deepEqual(participants, [personne(8, { exclu: true })]);
    assert.equal(Object.hasOwn(participants[0], 'presence'), false);
    assert.deepEqual(rognees, [{ participant: 8, avant: [4], apres: null }]);
    assert.deepEqual(videes, []);
  });

  test('une non exclue dont la liste se viderait figure dans videes, croissantes, et sa présence reste celle reçue', () => {
    const participants = [personne(9, { presence: [4] }), personne(3, { presence: [3, 4] }), personne(5, { presence: [1, 3] })];
    const rendu = presencesSousTours(participants, 2);
    assert.deepEqual(rendu.videes, [3, 9]);
    assert.deepEqual(rendu.participants, [personne(9, { presence: [4] }), personne(3, { presence: [3, 4] }), personne(5, { presence: [1] })]);
    assert.deepEqual(rendu.rognees, [{ participant: 5, avant: [1, 3], apres: [1] }]);
  });

  test('rognees se range par identifiant croissant, quel que soit l’ordre des participants', () => {
    const { rognees } = presencesSousTours([personne(7, { presence: [1, 3] }), personne(2, { presence: [2, 3] })], 2);
    assert.deepEqual(rognees.map(({ participant }) => participant), [2, 7]);
  });

  test('au même nombre de tours ou à la hausse, rien ne change : une liste énumérée ne s’étend pas', () => {
    const participants = [personne(1, { presence: [1, 2] }), personne(2)];
    for (const tours of [3, 4, 100]) {
      const rendu = presencesSousTours(participants, tours);
      assert.deepEqual(rendu, { participants, rognees: [], videes: [] }, `${tours} tours`);
    }
  });

  test('pure : la charge reçue n’est pas modifiée, et les listes rendues ne sont pas partagées avec elle', () => {
    const participants = geler([personne(1, { presence: [1, 3] }), personne(2, { presence: [2, 3], exclu: true })]);
    const rendu = presencesSousTours(participants, 2);
    assert.deepEqual(participants[0].presence, [1, 3]);
    rendu.rognees[0].avant.push(42);
    assert.deepEqual(participants[0].presence, [1, 3]);
    assert.notEqual(rendu.participants, participants);
  });

  test('un nombre de tours qui n’est pas un entier ≥ 1 lève TypeError', () => {
    for (const tours of [0, -1, 1.5, '3', undefined]) {
      assert.throws(() => presencesSousTours([personne(1)], tours), TypeError, String(tours));
    }
  });
});
