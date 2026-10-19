// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de la présence écrite en texte (§ 10.1, § 10.2) : la grammaire
// d'une cellule, ses fautes et leur raison, l'écriture compacte de l'export,
// et l'aller-retour exhaustif, chaque partie non vide des tours de 1 à 6 se
// relisant à l'identique. Les blancs autres que l'espace, le tiret
// demi-cadratin et les lettres décomposées s'écrivent par leur point de code.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { presenceCanonique } from '../moteur/presence.js';
import { TOURS_MAX } from '../stockage/document.js';
import { JOINTURE_PRESENCE, ecrirePresence, lirePresence } from './presence.js';

// Les tours de 1 à n.
const jusqua = (n) => Array.from({ length: n }, (_, rang) => rang + 1);

describe('lirePresence : la grammaire (§ 10.1)', () => {
  test('chaque forme admise, sous quatre tours : plages, listes, préfixe, séparateurs, fusion des recouvrements', () => {
    const cas = [
      ['1-3', [1, 2, 3]],
      ['2, 3', [2, 3]],
      ['2;3', [2, 3]],
      ['2 3', [2, 3]],
      ['2 et 3', [2, 3]],
      ['tours 1 et 2', [1, 2]],
      ['Tours 2 À 4', [2, 3, 4]],
      ['tour 2', [2]],
      ['TOUR 4', [4]],
      ['1 à 3', [1, 2, 3]],
      ['1\u{2013}3', [1, 2, 3]],
      ['1 - 3', [1, 2, 3]],
      ['1-3, 2', [1, 2, 3]],
      ['3, 1, 3', [1, 3]],
      ['4-4', [4]],
      ['01-02', [1, 2]],
      ['1;2,3 et 4', [1, 2, 3, 4]],
      ['1, 2, 3, 4', [1, 2, 3, 4]],
      ['  3 ,1 ', [1, 3]],
      ['1\u{A0}-\u{A0}3', [1, 2, 3]],
      ['2\u{202F};\u{202F}4', [2, 4]],
      ['1 A\u{300} 3', [1, 2, 3]],
      ['tours 1 à 3 et 4', [1, 2, 3, 4]],
      ['tours 1, 3 et 4', [1, 3, 4]],
    ];
    for (const [texte, attendue] of cas) {
      assert.deepEqual(lirePresence(texte, 4), { presence: attendue }, JSON.stringify(texte));
    }
  });

  test('« tous », sans égard à la casse, et « tous les tours », ce que montre l’aperçu, valent 1..R', () => {
    for (const texte of ['tous', 'Tous', 'TOUS', ' tous ', 'tous les tours', 'Tous  les\u{A0}tours']) {
      assert.deepEqual(lirePresence(texte, 4), { presence: [1, 2, 3, 4] }, JSON.stringify(texte));
      assert.deepEqual(lirePresence(texte, 1), { presence: [1] }, JSON.stringify(texte));
    }
  });

  test('une cellule vide ou blanche vaut null : la ligne ne dit rien de la présence', () => {
    for (const texte of ['', ' ', '\t', '\u{A0}\u{3000}']) {
      assert.deepEqual(lirePresence(texte, 4), { presence: null }, JSON.stringify(texte));
    }
  });

  test('ce que toursNommes écrit se relit : « tour 2 », « tours 1 et 3 », « tours 2 à 4 », « tours 1 à 3 et 5 »', () => {
    assert.deepEqual(lirePresence('tour 2', 5).presence, [2]);
    assert.deepEqual(lirePresence('tours 1 et 3', 5).presence, [1, 3]);
    assert.deepEqual(lirePresence('tours 2 à 4', 5).presence, [2, 3, 4]);
    assert.deepEqual(lirePresence('tours 1 à 3 et 5', 5).presence, [1, 2, 3, 5]);
  });

  test('chaque appel rend une liste neuve', () => {
    const a = lirePresence('tous', 3).presence;
    const b = lirePresence('tous', 3).presence;
    assert.notEqual(a, b);
    a.push(9);
    assert.deepEqual(lirePresence('tous', 3).presence, [1, 2, 3]);
  });
});

describe('lirePresence : les fautes et leur raison (§ 10.1)', () => {
  test('une plage inversée : intervalle', () => {
    assert.deepEqual(lirePresence('3-1', 4), { faute: { raison: 'intervalle', valeur: '3-1' } });
    assert.deepEqual(lirePresence('1, 4 à 2', 4), { faute: { raison: 'intervalle', valeur: '1, 4 à 2' } });
  });

  test('un tour hors de la soirée : horsTours, le premier tour fautif dans l’ordre écrit', () => {
    assert.deepEqual(lirePresence('0', 4), { faute: { raison: 'horsTours', valeur: '0', tour: 0 } });
    assert.deepEqual(lirePresence('5', 4), { faute: { raison: 'horsTours', valeur: '5', tour: 5 } });
    assert.deepEqual(lirePresence('2, 6-8', 4), { faute: { raison: 'horsTours', valeur: '2, 6-8', tour: 6 } });
    assert.deepEqual(lirePresence('3-6', 4), { faute: { raison: 'horsTours', valeur: '3-6', tour: 5 } });
    assert.deepEqual(lirePresence('0-2', 4), { faute: { raison: 'horsTours', valeur: '0-2', tour: 0 } });
    assert.deepEqual(lirePresence('9, 0', 4), { faute: { raison: 'horsTours', valeur: '9, 0', tour: 9 } });
    assert.deepEqual(lirePresence('2', 1), { faute: { raison: 'horsTours', valeur: '2', tour: 2 } });
    assert.deepEqual(
      lirePresence('1-99999999999999999999', 4),
      { faute: { raison: 'horsTours', valeur: '1-99999999999999999999', tour: 5 } },
    );
  });

  test('une plage changée en date par un tableur : date', () => {
    for (const texte of [
      '2026-03-01', '2026-3-1', '2026-03-01 00:00:00', '1/3', '01/03', '1/3/2026', '1/3/26', '1-mars', '01-mars',
      '1-Mar', '1-mar.', '3-févr.', '2-janv', 'mars-13', 'Mar-13', '1 mars', '13-mai',
    ]) {
      assert.deepEqual(lirePresence(texte, 4), { faute: { raison: 'date', valeur: texte.trim() } }, JSON.stringify(texte));
    }
  });

  test('rien de la grammaire : syntaxe', () => {
    for (const texte of [
      'deux', '1-', ',', '1,,2', '1, 2,', 'tours', 'tour2', '1.5', '2 3-', '\u{663}', '1--3', 'à 3', 'tous 2',
      'et 1', '1 et', '- 1', '1 ou 2', 'tous les', 'les tours',
    ]) {
      assert.deepEqual(lirePresence(texte, 4), { faute: { raison: 'syntaxe', valeur: texte.trim() } }, JSON.stringify(texte));
    }
  });

  test('la valeur citée est la cellule en NFC, sans ses blancs de bord, casse gardée', () => {
    assert.deepEqual(lirePresence('  Deux\u{A0}', 4), { faute: { raison: 'syntaxe', valeur: 'Deux' } });
    assert.deepEqual(lirePresence(' 1 a\u{300} 9 ', 4), { faute: { raison: 'horsTours', valeur: '1 \u{E0} 9', tour: 5 } });
  });

  test('tours qui n’est pas un entier de 1 à TOURS_MAX : TypeError', () => {
    for (const tours of [0, TOURS_MAX + 1, 2.5, '4', undefined, null, Number.NaN]) {
      assert.throws(() => lirePresence('1', tours), TypeError, String(tours));
    }
    assert.deepEqual(lirePresence('1', TOURS_MAX), { presence: [1] });
  });

  test('un texte qui n’est pas une chaîne : TypeError', () => {
    for (const texte of [null, undefined, 3, ['1']]) assert.throws(() => lirePresence(texte, 4), TypeError);
  });
});

describe('ecrirePresence : la forme compacte de l’export (§ 10.2)', () => {
  test('vide sans champ ; une suite d’au moins trois tours en « a-b », les autres un à un, joints par « , »', () => {
    const cas = [
      [undefined, ''],
      [[1, 2, 3], '1-3'],
      [[2, 3], '2, 3'],
      [[1, 2, 3, 5], '1-3, 5'],
      [[1, 3], '1, 3'],
      [[1, 2, 4, 5, 6], '1, 2, 4-6'],
      [[7], '7'],
      [[1, 3, 4, 5, 7, 8, 9, 10], '1, 3-5, 7-10'],
    ];
    for (const [presence, attendu] of cas) assert.equal(ecrirePresence(presence), attendu, JSON.stringify(presence));
    assert.equal(JOINTURE_PRESENCE, ', ');
  });

  test('une présence qui ne s’écrit pas : TypeError (liste vide, désordonnée, doublon, tour non entier ou nul, autre genre)', () => {
    for (const presence of [[], [3, 2], [1, 1], [0], [1.5], ['1'], null, '1-3', 3]) {
      assert.throws(() => ecrirePresence(presence), TypeError, JSON.stringify(presence));
    }
  });
});

describe('présence : l’aller-retour exhaustif (§ 10.1, § 10.2)', () => {
  test('pour R de 1 à 6, chaque partie non vide se relit à l’identique ; la partie pleine, sans champ, s’écrit vide', () => {
    for (let R = 1; R <= 6; R += 1) {
      for (let masque = 1; masque < 2 ** R; masque += 1) {
        const partie = jusqua(R).filter((tour) => masque & (2 ** (tour - 1)));
        assert.deepEqual(lirePresence(ecrirePresence(partie), R), { presence: partie }, `R = ${R}, ${partie}`);
        const canonique = presenceCanonique(partie, R);
        if (partie.length === R) {
          assert.equal(canonique, undefined);
          assert.equal(ecrirePresence(canonique), '');
          assert.deepEqual(lirePresence('', R), { presence: null });
        } else {
          assert.equal(ecrirePresence(canonique), ecrirePresence(partie));
        }
      }
    }
  });
});
