// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de la machine d'un menu d'actions (§ 14.5) : l'élément que reçoit
// le focus à l'ouverture, selon la touche pressée sur le bouton ; les
// déplacements dans le menu ouvert, qui bouclent d'un bout à l'autre ; la
// liste des éléments, qui ne s'admet que non vide et sans désignation en
// double. Les noms d'éléments sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { effetDe } from '../raccourcis.js';
import { designationDe, exigerElements, presDe, rangApres, rangOuverture } from './menu.js';

const element = (nom) => ({ cle: `essai.${nom}`, nom, executer: () => null });

describe('rangOuverture : le premier ou le dernier élément, selon la touche', () => {
  test('Entrée, Espace et ↓ ouvrent sur le premier ; ↑ sur le dernier', () => {
    for (const touche of ['Enter', ' ', 'ArrowDown']) assert.equal(rangOuverture(effetDe('boutonMenu', touche), 4), 0, touche);
    assert.equal(rangOuverture(effetDe('boutonMenu', 'ArrowUp'), 4), 3);
    assert.equal(rangOuverture('ouvrirDernier', 1), 0);
  });

  test('un autre effet, ou un menu vide, lève en le nommant', () => {
    assert.throws(() => rangOuverture('suivant', 3), { name: 'RangeError', message: /"suivant"/ });
    assert.throws(() => rangOuverture(null, 3), RangeError);
    assert.throws(() => rangOuverture('ouvrirPremier', 0), { name: 'RangeError', message: /vide/ });
  });
});

describe('rangApres : se déplacer dans le menu ouvert', () => {
  test('↓ passe au suivant et revient du dernier au premier ; ↑ au précédent et va du premier au dernier', () => {
    const suivant = effetDe('menu', 'ArrowDown');
    const precedent = effetDe('menu', 'ArrowUp');
    assert.deepEqual([0, 1, 2].map((rang) => rangApres(suivant, rang, 3)), [1, 2, 0]);
    assert.deepEqual([0, 1, 2].map((rang) => rangApres(precedent, rang, 3)), [2, 0, 1]);
  });

  test('Début va au premier, Fin au dernier, d’où que parte le focus', () => {
    for (const rang of [0, 2, 4]) {
      assert.equal(rangApres(effetDe('menu', 'Home'), rang, 5), 0);
      assert.equal(rangApres(effetDe('menu', 'End'), rang, 5), 4);
    }
  });

  test('un menu d’un seul élément y reste', () => {
    for (const effet of ['suivant', 'precedent', 'premier', 'dernier']) assert.equal(rangApres(effet, 0, 1), 0, effet);
  });

  test('un effet qui ne déplace pas, un rang hors du menu ou un menu vide lèvent', () => {
    for (const effet of ['fermer', 'quitter', 'ouvrirPremier', 'activer']) {
      assert.throws(() => rangApres(effet, 0, 3), { name: 'RangeError', message: new RegExp(`"${effet}"`) });
    }
    assert.throws(() => rangApres('suivant', 3, 3), { name: 'RangeError', message: /rang 3/ });
    assert.throws(() => rangApres('suivant', -1, 3), RangeError);
    assert.throws(() => rangApres('suivant', 0.5, 3), RangeError);
    assert.throws(() => rangApres('suivant', 0, 0), { name: 'RangeError', message: /vide/ });
  });
});

describe('exigerElements : les éléments d’un menu', () => {
  test('une liste non vide, aux désignations distinctes, se rend telle quelle', () => {
    const elements = [element('ouvrir'), element('ranger'), element('vider')];
    assert.equal(exigerElements(elements), elements);
  });

  test('une liste vide, une désignation vide ou en double lèvent, et nomment la désignation', () => {
    assert.throws(() => exigerElements([]), { name: 'RangeError', message: /vide/ });
    assert.throws(() => exigerElements([element('ouvrir'), element('ouvrir')]), { name: 'RangeError', message: /"ouvrir"/ });
    assert.throws(() => exigerElements([element('ouvrir'), { ...element('x'), nom: '' }]), RangeError);
    // Sans nom, la désignation est le dernier segment de la clé, comme pour
    // une commande : elle entre en double avec « ouvrir ».
    assert.throws(() => exigerElements([{ cle: 'essai.groupe.ouvrir', executer: () => null }, element('ouvrir')]), { name: 'RangeError', message: /"ouvrir"/ });
  });
});

describe('designationDe : la désignation d’un élément', () => {
  test('son nom, ou à défaut le dernier segment de sa clé', () => {
    assert.equal(designationDe(element('ranger')), 'ranger');
    assert.equal(designationDe({ cle: 'propositions.commande.retenir', executer: () => null }), 'retenir');
    assert.equal(designationDe({ cle: 'seul', executer: () => null }), 'seul');
  });
});

describe('presDe : un appui près du point d’un clic', () => {
  test('à rayon px au plus sur chaque axe, bornes comprises ; au-delà sur un axe, non', () => {
    const clic = { x: 100, y: 50 };
    for (const [x, y] of [[100, 50], [108, 42], [92, 58], [108, 58]]) assert.equal(presDe({ clientX: x, clientY: y }, clic, 8), true, `${x},${y}`);
    for (const [x, y] of [[109, 50], [100, 41], [91, 59], [200, 50]]) assert.equal(presDe({ clientX: x, clientY: y }, clic, 8), false, `${x},${y}`);
  });
});
