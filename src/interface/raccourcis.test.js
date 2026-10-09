// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de la table des raccourcis clavier (§ 7.3, § 13.5, § 19.8) : sa
// forme, figée ; une touche par contexte au plus une fois ; les contextes et
// les effets que le plan, la grille des participants, un champ, une
// commande, un geste et une fenêtre lisent ; et effetDe, qui rend l'effet
// d'une touche dans un contexte ; le libellé de chaque clé, que le tableau
// engendré lit par la traduction.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { TABLES_APPLICATION } from '../application/libelles.js';
import { creerTraduction } from '../application/traduction.js';
import { TABLES_INTERFACE } from './libelles.js';
import { CONTEXTES_RACCOURCIS, RACCOURCIS, effetDe } from './raccourcis.js';

const { t, cles: clesTraduites } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

describe('RACCOURCIS : la table, seule source des touches (§ 19.8)', () => {
  test('chaque entrée porte touche, contexte, effet et cle, dans cet ordre, et la table comme chaque entrée sont figées', () => {
    assert.ok(RACCOURCIS.length > 0, 'table vide');
    assert.ok(Object.isFrozen(RACCOURCIS));
    for (const entree of RACCOURCIS) {
      assert.deepEqual(Object.keys(entree), ['touche', 'contexte', 'effet', 'cle']);
      assert.ok(Object.isFrozen(entree), JSON.stringify(entree));
      assert.equal(typeof entree.touche, 'string');
      assert.ok(entree.touche.length > 0);
      assert.match(entree.effet, /^[a-z][A-Za-z]*$/);
    }
    assert.ok(Object.isFrozen(CONTEXTES_RACCOURCIS));
    assert.throws(() => RACCOURCIS.push({}), TypeError);
  });

  test('les six contextes, dans l’ordre du tableau ; chaque entrée en porte un, et chacun a ses entrées, groupées', () => {
    assert.deepEqual(CONTEXTES_RACCOURCIS, ['plan', 'grille', 'champ', 'commande', 'geste', 'fenetre']);
    const ordre = RACCOURCIS.map(({ contexte }) => CONTEXTES_RACCOURCIS.indexOf(contexte));
    assert.ok(!ordre.includes(-1), 'contexte hors de la liste');
    assert.deepEqual(ordre, [...ordre].sort((a, b) => a - b));
    assert.deepEqual([...new Set(ordre)], [0, 1, 2, 3, 4, 5]);
  });

  test('une touche au plus une fois par contexte : son effet n’est jamais ambigu', () => {
    const paires = RACCOURCIS.map(({ contexte, touche }) => `${contexte}:${touche}`);
    assert.equal(new Set(paires).size, paires.length);
  });

  test('la clé du libellé est raccourcis.<contexte>.<effet> : deux touches d’un même effet la partagent', () => {
    for (const { contexte, effet, cle } of RACCOURCIS) assert.equal(cle, `raccourcis.${contexte}.${effet}`);
    const partagees = (contexte, effet) => RACCOURCIS.filter((entree) => entree.contexte === contexte && entree.effet === effet).map(({ touche }) => touche);
    assert.deepEqual(partagees('plan', 'entrer'), ['Enter', ' ']);
    assert.deepEqual(partagees('grille', 'editer'), ['Enter', 'F2']);
    assert.deepEqual(partagees('commande', 'activer'), ['Enter', ' ']);
  });

  test('chaque clé a son libellé dans les tables de l’application et de l’interface', () => {
    const cles = [...new Set(RACCOURCIS.map(({ cle }) => cle))];
    const traduites = new Set(clesTraduites());
    assert.deepEqual(cles.filter((cle) => !traduites.has(cle)), []);
    for (const cle of cles) assert.ok(t(cle).length > 0, cle);
  });

  test('les raccourcis du plan, de la grille, d’un champ, d’une commande, d’un geste et d’une fenêtre (§ 7.3)', () => {
    assert.deepEqual(
      RACCOURCIS.map(({ touche, contexte, effet }) => [contexte, touche, effet]),
      [
        ['plan', 'ArrowRight', 'droite'],
        ['plan', 'ArrowDown', 'bas'],
        ['plan', 'ArrowLeft', 'gauche'],
        ['plan', 'ArrowUp', 'haut'],
        ['plan', 'Enter', 'entrer'],
        ['plan', ' ', 'entrer'],
        ['plan', 'Escape', 'remonter'],
        ['grille', 'ArrowRight', 'droite'],
        ['grille', 'ArrowDown', 'bas'],
        ['grille', 'ArrowLeft', 'gauche'],
        ['grille', 'ArrowUp', 'haut'],
        ['grille', 'Tab', 'suivante'],
        ['grille', 'Maj+Tab', 'precedente'],
        ['grille', 'Enter', 'editer'],
        ['grille', 'F2', 'editer'],
        ['grille', 'Escape', 'effacer'],
        ['champ', 'Enter', 'valider'],
        ['champ', 'Escape', 'rendre'],
        ['commande', 'Enter', 'activer'],
        ['commande', ' ', 'activer'],
        ['geste', 'Escape', 'annuler'],
        ['fenetre', 'Escape', 'fermer'],
      ],
    );
  });
});

describe('effetDe : l’effet d’une touche dans un contexte', () => {
  test('chaque entrée se retrouve par son contexte et sa touche', () => {
    for (const { contexte, touche, effet } of RACCOURCIS) assert.equal(effetDe(contexte, touche), effet);
  });

  test('une même touche agit selon son contexte : Échap remonte, efface, rend, annule ou ferme ; une commande ne la prend pas', () => {
    assert.deepEqual(
      CONTEXTES_RACCOURCIS.map((contexte) => effetDe(contexte, 'Escape')),
      ['remonter', 'effacer', 'rendre', null, 'annuler', 'fermer'],
    );
  });

  test('une touche que le contexte ne prend pas : null, majuscule et code physique compris', () => {
    assert.equal(effetDe('champ', ' '), null);
    assert.equal(effetDe('plan', 'a'), null);
    assert.equal(effetDe('plan', 'escape'), null);
    assert.equal(effetDe('plan', 'Space'), null);
    assert.equal(effetDe('geste', 'Enter'), null);
    assert.equal(effetDe('grille', 'Shift+Tab'), null);
    assert.equal(effetDe('plan', 'Tab'), null);
  });

  test('un contexte inconnu lève, et nomme le contexte', () => {
    assert.throws(() => effetDe('tiroir', 'Escape'), { name: 'RangeError', message: /"tiroir"/ });
    assert.throws(() => effetDe('toString', 'Escape'), RangeError);
  });
});
