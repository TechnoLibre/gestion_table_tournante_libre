// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du mécanisme de traduction (§ 14.6) : une clé absente lève et se
// nomme, une clé de deux tables lève à la création, les clés s'énumèrent
// triées, une entrée en compose une autre, et la langue témoin encadre le
// résultat entier de t d'une seule paire de marques. Les tables d'épreuve sont
// inventées.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { MARQUE_TEMOIN, creerTraduction } from './traduction.js';

const { ouverture: O, fermeture: F } = MARQUE_TEMOIN;

const TABLE_A = new Map([
  ['essai.vide', '\u{2014}'],
  ['essai.salut', ({ nom }) => `Bonjour ${nom}`],
  ['essai.compose', ({ nom }, texte) => `${texte('essai.salut', { nom })}, ${texte('essai.vide')}`],
]);
const TABLE_B = new Map([
  ['AUTRE_CODE', () => 'Un code d’essai.'],
  ['autre.libelle', 'Un libellé'],
]);

describe('traduction : le mécanisme (§ 14.6)', () => {
  test('les deux marques de la langue témoin sont U+2045 et U+2046, et figées', () => {
    assert.equal(O, '\u{2045}');
    assert.equal(F, '\u{2046}');
    assert.ok(Object.isFrozen(MARQUE_TEMOIN));
  });

  test('une clé absente lève RangeError, et le message nomme la clé ; jamais la clé brute, jamais une chaîne vide', () => {
    const { t } = creerTraduction([TABLE_A]);
    assert.throws(() => t('essai.inconnue'), (erreur) => {
      assert.ok(erreur instanceof RangeError);
      assert.match(erreur.message, /essai\.inconnue/);
      return true;
    });
    assert.throws(() => t(undefined), RangeError);
    assert.throws(() => t('constructor'), RangeError);
  });

  test('une clé portée par deux tables lève à la création, et se nomme', () => {
    const doublon = new Map([['essai.salut', 'Salut']]);
    assert.throws(() => creerTraduction([TABLE_A, doublon]), (erreur) => {
      assert.ok(erreur instanceof RangeError);
      assert.match(erreur.message, /essai\.salut/);
      return true;
    });
  });

  test('cles() énumère toutes les clés des tables, triées par unités UTF-16', () => {
    const { cles } = creerTraduction([TABLE_A, TABLE_B]);
    const attendues = ['AUTRE_CODE', 'autre.libelle', 'essai.compose', 'essai.salut', 'essai.vide'];
    assert.equal(cles().length, 5);
    assert.deepEqual(cles(), attendues);
  });

  test('une chaîne se rend telle quelle, une fonction reçoit ses détails, et une entrée en compose une autre par texte', () => {
    const { t, langue } = creerTraduction([TABLE_A, TABLE_B]);
    assert.equal(langue, 'fr');
    assert.equal(t('autre.libelle'), 'Un libellé');
    assert.equal(t('essai.salut', { nom: 'Iris Ombrelle' }), 'Bonjour Iris Ombrelle');
    assert.equal(t('essai.compose', { nom: 'Théo Pervenche' }), 'Bonjour Théo Pervenche, \u{2014}');
    assert.equal(t('AUTRE_CODE'), 'Un code d’essai.');
  });

  test("une fonction appelée sans détails en reçoit un objet vide ; une entrée qui ne rend pas une chaîne lève", () => {
    const table = new Map([
      ['essai.details', (details) => `${Object.keys(details).length}`],
      ['essai.nombre', () => 3],
    ]);
    const { t } = creerTraduction([table]);
    assert.equal(t('essai.details'), '0');
    assert.equal(t('essai.details', null), '0');
    assert.throws(() => t('essai.nombre'), TypeError);
  });

  test("une table qui n'est pas une Map, une entrée ni chaîne ni fonction, une langue inconnue lèvent à la création", () => {
    assert.throws(() => creerTraduction([{ 'essai.objet': 'x' }]), TypeError);
    assert.throws(() => creerTraduction([new Map([['essai.nombre', 4]])]), TypeError);
    assert.throws(() => creerTraduction([TABLE_A], { langue: 'en' }), RangeError);
  });
});

describe('traduction : la langue témoin (§ 14.6)', () => {
  test('t encadre son résultat de la marque, une fois', () => {
    const { t, langue } = creerTraduction([TABLE_A, TABLE_B], { langue: 'temoin' });
    assert.equal(langue, 'temoin');
    assert.equal(t('essai.vide'), `${O}\u{2014}${F}`);
    assert.equal(t('autre.libelle'), `${O}Un libellé${F}`);
  });

  test('une fonction de détails est décorée sur son résultat entier', () => {
    const { t } = creerTraduction([TABLE_A], { langue: 'temoin' });
    assert.equal(t('essai.salut', { nom: 'Ondine Lacasse' }), `${O}Bonjour Ondine Lacasse${F}`);
  });

  test("une composition ne porte qu'une paire de marques : texte compose en français", () => {
    const { t } = creerTraduction([TABLE_A], { langue: 'temoin' });
    const rendu = t('essai.compose', { nom: 'Grisaille' });
    assert.equal(rendu, `${O}Bonjour Grisaille, \u{2014}${F}`);
    assert.equal(rendu.split(O).length - 1, 1);
    assert.equal(rendu.split(F).length - 1, 1);
  });

  test('une clé absente lève en langue témoin comme en français', () => {
    const { t } = creerTraduction([TABLE_A], { langue: 'temoin' });
    assert.throws(() => t('essai.inconnue'), RangeError);
  });
});
