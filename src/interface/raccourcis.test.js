// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de la table des raccourcis clavier (§ 7.3, § 13.5, § 19.8) : sa
// forme, figée ; une touche par contexte au plus une fois ; les contextes et
// les effets que le plan, la grille des participants, un champ, une
// commande, le bouton d'un menu, un menu ouvert, un geste et une fenêtre
// lisent, et l'écran de l'événement hors saisie ; effetDe, qui rend
// l'effet d'une touche dans un contexte ; toucheDe, qui nomme la touche
// d'un événement clavier dans la forme de la table ; le libellé de chaque
// clé, que le tableau engendré lit par la traduction.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { TABLES_APPLICATION } from '../application/libelles.js';
import { creerTraduction } from '../application/traduction.js';
import { TABLES_INTERFACE } from './libelles.js';
import { CONTEXTES_RACCOURCIS, RACCOURCIS, effetDe, toucheDe } from './raccourcis.js';

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

  test('les neuf contextes, dans l’ordre du tableau, l’écran de l’événement avant une fenêtre ; chaque entrée en porte un, et chacun a ses entrées, groupées', () => {
    assert.deepEqual(CONTEXTES_RACCOURCIS, ['plan', 'grille', 'champ', 'commande', 'boutonMenu', 'menu', 'geste', 'evenement', 'fenetre']);
    const ordre = RACCOURCIS.map(({ contexte }) => CONTEXTES_RACCOURCIS.indexOf(contexte));
    assert.ok(!ordre.includes(-1), 'contexte hors de la liste');
    assert.deepEqual(ordre, [...ordre].sort((a, b) => a - b));
    assert.deepEqual([...new Set(ordre)], [0, 1, 2, 3, 4, 5, 6, 7, 8]);
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
    assert.deepEqual(partagees('boutonMenu', 'ouvrirPremier'), ['Enter', ' ', 'ArrowDown']);
    assert.deepEqual(partagees('evenement', 'refaire'), ['Ctrl+Maj+Z', 'Ctrl+Y']);
  });

  test('chaque clé a son libellé dans les tables de l’application et de l’interface', () => {
    const cles = [...new Set(RACCOURCIS.map(({ cle }) => cle))];
    const traduites = new Set(clesTraduites());
    assert.deepEqual(cles.filter((cle) => !traduites.has(cle)), []);
    for (const cle of cles) assert.ok(t(cle).length > 0, cle);
  });

  test('les raccourcis du plan, de la grille, d’un champ, d’une commande, d’un menu, d’un geste, de l’écran de l’événement et d’une fenêtre (§ 7.3, § 8.3)', () => {
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
        ['boutonMenu', 'Enter', 'ouvrirPremier'],
        ['boutonMenu', ' ', 'ouvrirPremier'],
        ['boutonMenu', 'ArrowDown', 'ouvrirPremier'],
        ['boutonMenu', 'ArrowUp', 'ouvrirDernier'],
        ['menu', 'ArrowDown', 'suivant'],
        ['menu', 'ArrowUp', 'precedent'],
        ['menu', 'Home', 'premier'],
        ['menu', 'End', 'dernier'],
        ['menu', 'Escape', 'fermer'],
        ['menu', 'Tab', 'quitter'],
        ['geste', 'Escape', 'annuler'],
        ['evenement', 'Ctrl+Z', 'defaire'],
        ['evenement', 'Ctrl+Maj+Z', 'refaire'],
        ['evenement', 'Ctrl+Y', 'refaire'],
        ['fenetre', 'Escape', 'fermer'],
      ],
    );
  });
});

describe('effetDe : l’effet d’une touche dans un contexte', () => {
  test('chaque entrée se retrouve par son contexte et sa touche', () => {
    for (const { contexte, touche, effet } of RACCOURCIS) assert.equal(effetDe(contexte, touche), effet);
  });

  test('une même touche agit selon son contexte : Échap remonte, efface, rend, annule ou ferme ; une commande et le bouton d’un menu ne la prennent pas', () => {
    assert.deepEqual(
      CONTEXTES_RACCOURCIS.map((contexte) => effetDe(contexte, 'Escape')),
      ['remonter', 'effacer', 'rendre', null, null, 'fermer', 'annuler', null, 'fermer'],
    );
  });

  test('↓ ouvre le menu depuis son bouton, puis passe à l’élément suivant dans le menu ouvert ; Entrée ouvre le menu, et le menu ouvert la laisse aux commandes de ses éléments', () => {
    assert.deepEqual([effetDe('boutonMenu', 'ArrowDown'), effetDe('menu', 'ArrowDown')], ['ouvrirPremier', 'suivant']);
    assert.deepEqual([effetDe('boutonMenu', 'Enter'), effetDe('menu', 'Enter'), effetDe('commande', 'Enter')], ['ouvrirPremier', null, 'activer']);
    assert.equal(effetDe('boutonMenu', 'Home'), null);
  });

  test('une touche que le contexte ne prend pas : null, majuscule et code physique compris', () => {
    assert.equal(effetDe('champ', ' '), null);
    assert.equal(effetDe('plan', 'a'), null);
    assert.equal(effetDe('plan', 'escape'), null);
    assert.equal(effetDe('plan', 'Space'), null);
    assert.equal(effetDe('geste', 'Enter'), null);
    assert.equal(effetDe('grille', 'Shift+Tab'), null);
    assert.equal(effetDe('plan', 'Tab'), null);
    assert.equal(effetDe('evenement', 'Ctrl+z'), null);
    assert.equal(effetDe('evenement', 'z'), null);
    assert.equal(effetDe('evenement', 'Ctrl+Shift+Z'), null);
    assert.equal(effetDe('evenement', null), null);
  });

  test('un contexte inconnu lève, et nomme le contexte', () => {
    assert.throws(() => effetDe('tiroir', 'Escape'), { name: 'RangeError', message: /"tiroir"/ });
    assert.throws(() => effetDe('toString', 'Escape'), RangeError);
  });
});

describe('toucheDe : la touche d’un événement clavier, dans la forme de la table', () => {
  // Un événement clavier inventé : key, et les modificateurs à faux.
  const appui = (key, modificateurs = {}) => ({ key, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...modificateurs });

  test('Ctrl+ devant la touche quand Ctrl est tenu ; une lettre se nomme en majuscule, que Maj soit tenue ou non', () => {
    assert.equal(toucheDe(appui('z', { ctrlKey: true })), 'Ctrl+Z');
    assert.equal(toucheDe(appui('Z', { ctrlKey: true })), 'Ctrl+Z');
    assert.equal(toucheDe(appui('y', { ctrlKey: true })), 'Ctrl+Y');
    assert.equal(toucheDe(appui('é', { ctrlKey: true })), 'Ctrl+É');
    assert.equal(toucheDe(appui('z')), 'Z');
  });

  test('Maj+ devant une lettre ou Tab quand Maj est tenue, après Ctrl+ ; Maj+Tab garde sa forme', () => {
    assert.equal(toucheDe(appui('Z', { ctrlKey: true, shiftKey: true })), 'Ctrl+Maj+Z');
    assert.equal(toucheDe(appui('Tab', { shiftKey: true })), 'Maj+Tab');
    assert.equal(toucheDe(appui('Tab', { shiftKey: true, ctrlKey: true })), 'Ctrl+Maj+Tab');
    assert.equal(toucheDe(appui('a', { shiftKey: true })), 'Maj+A');
  });

  test('Maj tenue sur une autre touche ne s’écrit pas : la touche garde sa valeur de key', () => {
    assert.equal(toucheDe(appui('Enter', { shiftKey: true })), 'Enter');
    assert.equal(toucheDe(appui('ArrowDown', { shiftKey: true })), 'ArrowDown');
    assert.equal(toucheDe(appui('?', { shiftKey: true })), '?');
    assert.equal(toucheDe(appui('5', { shiftKey: true })), '5');
    assert.equal(toucheDe(appui(' ', { shiftKey: true })), ' ');
  });

  test('sans modificateur, la valeur de key telle quelle : chaque touche de la table s’y retrouve', () => {
    for (const touche of ['Escape', 'Enter', ' ', 'ArrowUp', 'F2', 'Home', 'Tab']) assert.equal(toucheDe(appui(touche)), touche);
    assert.equal(toucheDe(appui('Escape', { ctrlKey: true })), 'Ctrl+Escape');
  });

  test('Alt ou Méta tenue : null, aucune touche de la table', () => {
    assert.equal(toucheDe(appui('z', { ctrlKey: true, altKey: true })), null);
    assert.equal(toucheDe(appui('z', { metaKey: true })), null);
    assert.equal(toucheDe(appui('Escape', { altKey: true })), null);
  });

  test('la touche nommée mène à l’effet de la table : Ctrl+Z défait, Ctrl+Maj+Z et Ctrl+Y refont, sur l’écran de l’événement', () => {
    const effet = (key, modificateurs) => effetDe('evenement', toucheDe(appui(key, modificateurs)));
    assert.equal(effet('z', { ctrlKey: true }), 'defaire');
    assert.equal(effet('Z', { ctrlKey: true, shiftKey: true }), 'refaire');
    assert.equal(effet('y', { ctrlKey: true }), 'refaire');
    assert.equal(effet('Y', { ctrlKey: true, shiftKey: true }), null);
    assert.equal(effet('z', {}), null);
    assert.equal(effet('z', { ctrlKey: true, altKey: true }), null);
  });
});
