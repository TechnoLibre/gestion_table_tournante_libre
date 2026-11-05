// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La zone de recherche d'un choix multiple (participants/choix_multiple.js) :
// les choix qu'une recherche laisse voir, lus par la clé normalisée du texte
// qu'elle cherche. Les noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { cleNormalisee } from '../../application/csv.js';
import { choixFiltres } from './choix_multiple.js';

const NOMS = new Map([
  [3, 'Iris Ombrelle'],
  [5, 'Théo Pervenche'],
  [8, 'Ondine Lacasse'],
]);
const libelle = (id) => NOMS.get(id);
const CHOIX = [
  { valeur: 8, coche: false },
  { valeur: 3, coche: true },
  { valeur: 5, coche: false },
];

describe('choixFiltres : les choix que la recherche laisse voir', () => {
  test('une recherche vide, ou de blancs seuls, les laisse tous, dans l’ordre reçu, dans une liste neuve', () => {
    for (const texte of ['', '   ']) {
      const rendus = choixFiltres(CHOIX, texte, libelle, cleNormalisee);
      assert.deepEqual(rendus, CHOIX);
      assert.notEqual(rendus, CHOIX);
    }
  });

  test('la clé du texte cherché contient celle de la recherche : casse, accents et blancs ignorés, l’ordre reçu gardé', () => {
    assert.deepEqual(choixFiltres(CHOIX, 'theo', libelle, cleNormalisee), [{ valeur: 5, coche: false }]);
    assert.deepEqual(choixFiltres(CHOIX, ' OM', libelle, cleNormalisee), [{ valeur: 3, coche: true }]);
    assert.deepEqual(
      choixFiltres(CHOIX, 'e', libelle, cleNormalisee).map(({ valeur }) => valeur),
      [8, 3, 5],
    );
  });

  test('un choix coché que la recherche cache sort de la liste montrée, sans rien changer à ce qu’elle reçoit', () => {
    const copie = structuredClone(CHOIX);
    assert.deepEqual(choixFiltres(CHOIX, 'lacasse', libelle, cleNormalisee), [{ valeur: 8, coche: false }]);
    assert.deepEqual(choixFiltres(CHOIX, 'zéphyr', libelle, cleNormalisee), []);
    assert.deepEqual(CHOIX, copie);
  });
});
