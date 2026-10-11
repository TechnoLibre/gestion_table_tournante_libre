// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de la réconciliation des étiquettes (§ 4.5, § 10.1) : la clé, la
// plus petite orthographe par points de code, la réécriture des listes et le
// rapport des fusions. Les lettres décomposées, les espaces insécables et les
// marques combinantes s'écrivent par leur point de code : un éditeur qui
// recompose une lettre ou remplace un caractère invisible changerait
// l'épreuve sans qu'elle le montre.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { cleEtiquette, orthographeRecue, reconcilier } from './etiquettes.js';
import { cleNormalisee } from './normalisation.js';

// « bénévole » composé (NFC) et décomposé (NFD), en capitales.
const BENEVOLE = 'b\u{E9}n\u{E9}vole';
const BENEVOLE_DECOMPOSE = 'BE\u{301}NE\u{301}VOLE';

// Deux orthographes de même clé — « a » suivi d'une marque combinante — dont
// l'ordre par points de code (U+FE20 avant U+1D167) contredit l'ordre par
// unités de code UTF-16 (0xD834, la demi-paire de U+1D167, avant 0xFE20).
const MARQUE_BMP = 'a\u{FE20}';
const MARQUE_ASTRALE = 'a\u{1D167}';

// Toutes les permutations d'une liste courte.
function permutations(liste) {
  if (liste.length <= 1) return [liste];
  return liste.flatMap((tete, i) =>
    permutations([...liste.slice(0, i), ...liste.slice(i + 1)]).map((reste) => [tete, ...reste]),
  );
}

// Nombre de lignes qu'une réconciliation a changées : une liste réécrite
// diffère de celle reçue, élément par élément.
function lignesChangees(avant, apres) {
  return avant.filter((liste, i) => liste !== null && JSON.stringify(liste) !== JSON.stringify(apres[i])).length;
}

// Nombre de couples (ligne, clé) dont la ligne porte la clé sous une autre
// orthographe que celle rendue : une ligne compte une fois par clé réécrite,
// quel que soit le nombre de ses orthographes de cette clé.
function couplesReecrits(avant, apres) {
  let total = 0;
  avant.forEach((liste, i) => {
    if (liste === null) return;
    const recues = new Map(apres[i].map((texte) => [cleEtiquette(texte), texte]));
    const cles = new Set(liste.filter((texte) => texte !== recues.get(cleEtiquette(texte))).map(cleEtiquette));
    total += cles.size;
  });
  return total;
}

describe('cleEtiquette (§ 10.1)', () => {
  test('est la clé normalisée du § 10.1, et non une seconde règle', () => {
    assert.equal(cleEtiquette, cleNormalisee);
  });

  test('ignore la casse, les accents et les blancs', () => {
    for (const texte of ['Finance', 'FINANCE', ' finance ', 'finance']) {
      assert.equal(cleEtiquette(texte), 'finance', texte);
    }
    assert.equal(cleEtiquette(BENEVOLE_DECOMPOSE), 'benevole');
    assert.equal(cleEtiquette('Ressources\u{A0}\u{A0}Humaines'), 'ressources humaines');
  });
});

describe('orthographeRecue (§ 4.5)', () => {
  test("une saisie sans orthographe existante de même clé se garde telle quelle", () => {
    assert.equal(orthographeRecue([], 'Finance'), 'Finance');
    assert.equal(orthographeRecue(['Montréal', BENEVOLE], 'Finance'), 'Finance');
  });

  test("la casse est ignorée : la saisie reçoit l'orthographe existante", () => {
    assert.equal(orthographeRecue(['finance'], 'Finance'), 'finance');
    assert.equal(orthographeRecue(['finance'], 'FINANCE'), 'finance');
    assert.equal(orthographeRecue(['FINANCE'], 'finance'), 'FINANCE');
  });

  test('les accents composés, décomposés ou absents sont ignorés', () => {
    assert.equal(orthographeRecue([BENEVOLE], BENEVOLE_DECOMPOSE), BENEVOLE);
    assert.equal(orthographeRecue([BENEVOLE], 'Benevole'), BENEVOLE);
    assert.equal(orthographeRecue(['benevole'], BENEVOLE), 'benevole');
  });

  test('les blancs intérieurs et de bord sont ignorés', () => {
    assert.equal(orthographeRecue(['ressources humaines'], 'Ressources\u{A0}humaines'), 'ressources humaines');
    assert.equal(orthographeRecue(['ressources humaines'], 'ressources  humaines'), 'ressources humaines');
  });

  test("deux orthographes existantes : la plus petite par points de code, quel que soit l'ordre", () => {
    for (const existantes of permutations(['finance', 'Finance', 'FINANCE'])) {
      assert.equal(orthographeRecue(existantes, 'fInance'), 'FINANCE', existantes.join(' / '));
    }
  });

  test('la plus petite se lit par points de code, non par unités de code', () => {
    for (const existantes of permutations([MARQUE_ASTRALE, MARQUE_BMP])) {
      assert.equal(orthographeRecue(existantes, 'A'), MARQUE_BMP);
    }
  });

  test("un préfixe propre est la plus petite orthographe, quel que soit l'ordre", () => {
    // « a » et « a » suivi d'une marque combinante sans forme précomposée ont
    // la même clé et ne diffèrent que par leur longueur.
    for (const existantes of permutations([MARQUE_BMP, 'a'])) {
      assert.equal(orthographeRecue(existantes, 'A'), 'a', existantes.join(' / '));
    }
  });

  test("une saisie déjà présente reçoit encore la plus petite orthographe de sa clé", () => {
    assert.equal(orthographeRecue(['finance'], 'finance'), 'finance');
    assert.equal(orthographeRecue(['finance', 'Finance'], 'finance'), 'Finance');
    assert.equal(orthographeRecue(['finance', 'Finance', 'finance'], 'Finance'), 'Finance');
  });

  test("l'existante l'emporte sur une saisie plus petite", () => {
    assert.equal(orthographeRecue(['finance'], 'Finance'), 'finance');
  });

  test("accepte un itérable quelconque d'existantes", () => {
    assert.equal(orthographeRecue(new Set(['finance', 'Finance']), 'FINANCE'), 'Finance');
  });
});

describe('reconcilier (§ 10.1)', () => {
  test('sans orthographe concurrente, les listes reviennent égales et aucune fusion', () => {
    const listes = [['finance', 'Montréal'], [], null, [BENEVOLE]];
    const resultat = reconcilier(['finance', 'ressources humaines'], listes);
    assert.deepEqual(resultat, { listes: [['finance', 'Montréal'], [], null, [BENEVOLE]], fusions: [] });
  });

  test("entre les lignes, la plus petite orthographe lue est reçue, et la fusion se dit", () => {
    const { listes, fusions } = reconcilier([], [['finance'], ['Finance'], ['finance', BENEVOLE]]);
    assert.deepEqual(listes, [['Finance'], ['Finance'], ['Finance', BENEVOLE]]);
    assert.deepEqual(fusions, [{ retenue: 'Finance', orthographes: ['Finance', 'finance'], lignes: 2 }]);
  });

  test("l'orthographe de l'événement l'emporte sur celles des lignes", () => {
    const { listes, fusions } = reconcilier(['finance', 'Montréal'], [['FINANCE'], ['Finance'], ['finance']]);
    assert.deepEqual(listes, [['finance'], ['finance'], ['finance']]);
    assert.deepEqual(fusions, [{ retenue: 'finance', orthographes: ['FINANCE', 'Finance', 'finance'], lignes: 2 }]);
  });

  test("deux orthographes dans l'événement : la plus petite est reçue", () => {
    for (const existantes of permutations(['finance', 'Finance', 'FINANCE'])) {
      const { listes, fusions } = reconcilier(existantes, [['finance'], ['Finance']]);
      assert.deepEqual(listes, [['FINANCE'], ['FINANCE']], existantes.join(' / '));
      assert.deepEqual(fusions, [{ retenue: 'FINANCE', orthographes: ['FINANCE', 'Finance', 'finance'], lignes: 2 }]);
    }
  });

  test("une ligne qui porte déjà l'orthographe reçue n'est pas une fusion", () => {
    const { listes, fusions } = reconcilier(['finance', 'Finance'], [['Finance'], ['Montréal']]);
    assert.deepEqual(listes, [['Finance'], ['Montréal']]);
    assert.deepEqual(fusions, []);
  });

  test("accents composés et décomposés, blancs : une seule étiquette", () => {
    const { listes, fusions } = reconcilier([BENEVOLE], [[BENEVOLE_DECOMPOSE], ['Ressources\u{A0}humaines'], ['ressources humaines']]);
    assert.deepEqual(listes, [[BENEVOLE], ['Ressources\u{A0}humaines'], ['Ressources\u{A0}humaines']]);
    assert.deepEqual(fusions, [
      { retenue: BENEVOLE, orthographes: [BENEVOLE_DECOMPOSE, BENEVOLE], lignes: 1 },
      { retenue: 'Ressources\u{A0}humaines', orthographes: ['Ressources\u{A0}humaines', 'ressources humaines'], lignes: 1 },
    ]);
  });

  test("deux orthographes d'une même ligne n'en font qu'une, à la place de la première", () => {
    const { listes, fusions } = reconcilier([], [[BENEVOLE, 'finance', 'Montréal', 'Finance']]);
    assert.deepEqual(listes, [[BENEVOLE, 'Finance', 'Montréal']]);
    assert.deepEqual(fusions, [{ retenue: 'Finance', orthographes: ['Finance', 'finance'], lignes: 1 }]);
  });

  test("une ligne qui porte deux orthographes réécrites d'une clé compte une fois", () => {
    const { listes, fusions } = reconcilier([BENEVOLE], [['BENEVOLE', 'Benevole']]);
    assert.deepEqual(listes, [[BENEVOLE]]);
    assert.deepEqual(fusions, [{ retenue: BENEVOLE, orthographes: ['BENEVOLE', 'Benevole', BENEVOLE], lignes: 1 }]);
  });

  test('la plus petite se lit par points de code, non par unités de code', () => {
    for (const lignes of permutations([[MARQUE_ASTRALE], [MARQUE_BMP]])) {
      const { listes, fusions } = reconcilier([], lignes);
      assert.deepEqual(listes, [[MARQUE_BMP], [MARQUE_BMP]]);
      assert.deepEqual(fusions, [{ retenue: MARQUE_BMP, orthographes: [MARQUE_BMP, MARQUE_ASTRALE], lignes: 1 }]);
    }
  });

  test("l'ordre des lignes ne change ni l'orthographe reçue ni le groupe", () => {
    const lignes = [['finance'], ['FINANCE', BENEVOLE], ['Finance'], [BENEVOLE_DECOMPOSE]];
    for (const ordre of permutations(lignes)) {
      const { listes, fusions } = reconcilier(['Montréal'], ordre);
      assert.deepEqual(
        listes.map((liste) => liste.join('|')).sort(),
        [`FINANCE|${BENEVOLE_DECOMPOSE}`, BENEVOLE_DECOMPOSE, 'FINANCE', 'FINANCE'].sort(),
      );
      assert.deepEqual(
        fusions.map(({ retenue, orthographes, lignes: nombre }) => [retenue, orthographes, nombre]).sort(),
        [
          [BENEVOLE_DECOMPOSE, [BENEVOLE_DECOMPOSE, BENEVOLE], 1],
          ['FINANCE', ['FINANCE', 'Finance', 'finance'], 2],
        ].sort(),
      );
    }
  });

  test('les fusions se rangent par la première ligne réécrite', () => {
    const existantes = ['finance', BENEVOLE];
    const avant = reconcilier(existantes, [['Benevole'], ['Finance']]).fusions.map(({ retenue }) => retenue);
    const apres = reconcilier(existantes, [['Finance'], ['Benevole']]).fusions.map(({ retenue }) => retenue);
    assert.deepEqual(avant, [BENEVOLE, 'finance']);
    assert.deepEqual(apres, ['finance', BENEVOLE]);
    // « finance » est réécrite aux lignes 0 et 2, « Montréal » à la ligne 1
    // seulement : la première ligne réécrite range, non la dernière.
    const lignes = [['Finance'], ['montréal'], ['FINANCE']];
    const fusions = reconcilier(['finance', 'Montréal'], lignes).fusions.map(({ retenue }) => retenue);
    assert.deepEqual(fusions, ['finance', 'Montréal']);
  });

  test("à première ligne égale, les fusions se rangent par l'orthographe retenue", () => {
    // Les deux clés sont réécrites pour la première fois à la ligne 0 ;
    // l'ordre des existantes, qui est celui de leur découverte, ne range pas.
    for (const existantes of permutations(['finance', BENEVOLE])) {
      const { fusions } = reconcilier(existantes, [['Finance', 'Benevole']]);
      assert.deepEqual(fusions.map(({ retenue }) => retenue), [BENEVOLE, 'finance'], existantes.join(' / '));
    }
  });

  test("un préfixe propre est la plus petite orthographe, quel que soit l'ordre des lignes", () => {
    // « a » et « a » suivi d'une marque combinante sans forme précomposée ont
    // la même clé et ne diffèrent que par leur longueur.
    for (const lignes of permutations([[MARQUE_BMP], ['a']])) {
      const { listes, fusions } = reconcilier([], lignes);
      assert.deepEqual(listes, [['a'], ['a']]);
      assert.deepEqual(fusions, [{ retenue: 'a', orthographes: ['a', MARQUE_BMP], lignes: 1 }]);
    }
  });

  test("aucune fusion silencieuse : chaque ligne changée est comptée par une fusion", () => {
    const cas = [
      [[], [['finance'], ['Finance'], ['Montréal']]],
      [['finance'], [['FINANCE', 'Montréal'], ['montreal'], null, []]],
      [['finance', 'Finance'], [['finance'], ['Finance', 'finance'], [BENEVOLE_DECOMPOSE]]],
      [[BENEVOLE], [[BENEVOLE_DECOMPOSE, 'Benevole'], ['Montréal', 'MONTRÉAL']]],
    ];
    for (const [existantes, lignes] of cas) {
      const { listes, fusions } = reconcilier(existantes, lignes);
      const comptees = fusions.reduce((total, { lignes: nombre }) => total + nombre, 0);
      assert.ok(fusions.every(({ lignes: nombre }) => nombre > 0), JSON.stringify(fusions));
      assert.ok(comptees >= lignesChangees(lignes, listes), JSON.stringify({ existantes, lignes }));
      assert.equal(comptees, couplesReecrits(lignes, listes), JSON.stringify({ existantes, lignes }));
      assert.ok(lignesChangees(lignes, listes) > 0);
    }
  });

  test('une ligne absente reste absente et ne compte pas', () => {
    const { listes, fusions } = reconcilier(['finance'], [null, ['Finance'], null]);
    assert.deepEqual(listes, [null, ['finance'], null]);
    assert.deepEqual(fusions, [{ retenue: 'finance', orthographes: ['Finance', 'finance'], lignes: 1 }]);
  });

  test('ne modifie ni les existantes ni les listes reçues, et ne les partage pas', () => {
    const existantes = ['finance', 'Finance'];
    const lignes = [['finance', 'Montréal'], ['Montréal']];
    const copies = structuredClone({ existantes, lignes });
    const { listes } = reconcilier(existantes, lignes);
    assert.deepEqual({ existantes, lignes }, copies);
    listes[1].push('bénévole');
    assert.deepEqual(lignes[1], ['Montréal']);
  });
});
