// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de typographier (§ 14.6) : la suite d'espaces après « et devant
// : » devient une insécable U+00A0, devant ; ? ! une fine insécable U+202F ;
// un signe sans espace devant, le saut de ligne et la tabulation restent ;
// un seul passage de gauche à droite ; la fonction est idempotente et ne
// change que des espaces. Les textes sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { typographier } from './typographie.js';

// L'insécable et la fine insécable, écrites par leur point de code.
const I = '\u{00A0}';
const F = '\u{202F}';

// [entrée, attendu] : la règle sur les formes qu'en portent les textes de
// l'écran, puis les signes qu'elle laisse.
const CAS = [
  ['Tour 1 : table 3', `Tour 1${I}: table 3`],
  ['Supprimer la table 3 ? Ces saisies partent avec elle :', `Supprimer la table 3${F}? Ces saisies partent avec elle${I}:`],
  ['retenue comprise ; le placement', `retenue comprise${F}; le placement`],
  ['Attention !', `Attention${F}!`],
  ['Le dossier « Mes événements » est trop profond', `Le dossier «${I}Mes événements${I}» est trop profond`],
  ['par « ; », « , » ou', `par «${I};${I}», «${I},${I}» ou`],
  ['« x » ;', `«${I}x${I}»${F};`],
  ['Vraiment ? »', `Vraiment${F}?${I}»`],
  [' : 3 conflits', `${I}: 3 conflits`],
  ['« ', `«${I}`],
  ['\u{2045}« x »\u{2046}', `\u{2045}«${I}x${I}»\u{2046}`],
  ['mot  :', `mot${I}:`],
  [`mot ${I} ;`, `mot${F};`],
  ['21:42:30', '21:42:30'],
  ['20 h 30', '20 h 30'],
  ['avec https://technolibre.ca pour', 'avec https://technolibre.ca pour'],
  ['site : https://technolibre.ca/?a=1', `site${I}: https://technolibre.ca/?a=1`],
  ['C:\\Dossiers\\x', 'C:\\Dossiers\\x'],
  ['d(p) : A(p)', `d(p)${I}: A(p)`],
  ['«\nligne', '«\nligne'],
  ['mot\n:', 'mot\n:'],
  ['mot\t?', 'mot\t?'],
  ['GNU Affero General Public License v3.0', 'GNU Affero General Public License v3.0'],
  ['', ''],
  ['?', '?'],
];

// Des textes de plus pour les propriétés : insécables déjà posées, suites
// mêlées, milliers et pourcentage à la fine insécable.
const AUTRES = [
  `Tour 1${I}: table 3`,
  `«${F}x${F}»`,
  `mot ${F}${I} !`,
  `1${F}200 places : 3 tables`,
  `12${F}% des places`,
  'Iris Ombrelle : « Qui ? Moi » ; puis !',
  '« « ; » »',
];

describe('typographier : la ponctuation haute (§ 14.6)', () => {
  test('vingt-cinq cas : U+00A0 après « et devant : », U+202F devant ; ? !, rien sans espace devant', () => {
    assert.equal(CAS.length, 25);
    for (const [entree, attendu] of CAS) assert.equal(typographier(entree), attendu, JSON.stringify(entree));
  });

  test('un seul passage, de gauche à droite : l’espace qui suit « appartient au guillemet, même devant un signe', () => {
    assert.equal(typographier('« « ; » »'), `«${I}«${I};${I}»${I}»`);
    assert.equal(typographier('« ? »'), `«${I}?${I}»`);
  });

  test('la fine insécable des milliers et du pourcentage reste ; une suite qui la contient se réduit', () => {
    assert.equal(typographier(`1${F}200 places : 3 tables`), `1${F}200 places${I}: 3 tables`);
    assert.equal(typographier(`12${F}% des places`), `12${F}% des places`);
    assert.equal(typographier(`mot ${F}${I} !`), `mot${F}!`);
    assert.equal(typographier(`«${F}x${F}»`), `«${I}x${I}»`);
  });

  test('idempotente : un texte déjà typographié ne change plus', () => {
    for (const texte of [...CAS.map(([entree]) => entree), ...AUTRES]) {
      const une = typographier(texte);
      assert.equal(typographier(une), une, JSON.stringify(texte));
    }
  });

  test('seules les espaces changent : sans elles, le texte est le même ; les insécables ramenées à l’espace, aussi', () => {
    const sansEspaces = (texte) => texte.replace(/[ \u{00A0}\u{202F}]/gu, '');
    const ramene = (texte) => texte.replace(/[ \u{00A0}\u{202F}]+/gu, ' ');
    for (const texte of [...CAS.map(([entree]) => entree), ...AUTRES]) {
      const rendu = typographier(texte);
      assert.equal(sansEspaces(rendu), sansEspaces(texte), JSON.stringify(texte));
      assert.equal(ramene(rendu), ramene(texte), JSON.stringify(texte));
    }
  });

  test('aucune espace ordinaire ne reste devant ; : ? ! » ni après «', () => {
    for (const texte of [...CAS.map(([entree]) => entree), ...AUTRES]) {
      const rendu = typographier(texte);
      assert.doesNotMatch(rendu, / [;:?!»]/u, JSON.stringify(texte));
      assert.doesNotMatch(rendu, /« /u, JSON.stringify(texte));
    }
  });

  test('ce qui n’est pas une chaîne lève TypeError', () => {
    assert.throws(() => typographier(undefined), TypeError);
    assert.throws(() => typographier(3), TypeError);
  });
});
