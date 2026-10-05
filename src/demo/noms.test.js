// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves des réservoirs de noms du générateur (§ 15.4, § 15.6) : tailles,
// unicité, ordre des produits, forme des fragments, noms longs. Ce fichier
// n'écrit aucun nom forgé : il les lit dans noms.js, seul fichier où le
// balayage de catalogue.long.test.js les admet.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import {
  NOMS_LONGS,
  PREFIXES,
  PRENOMS,
  RACINES,
  TERMINAISONS,
  TETES,
  organisations,
  patronymes,
} from './noms.js';

// [nom de la liste, liste, taille minimale du plan]
const LISTES = [
  ['PRENOMS', PRENOMS, 40],
  ['PREFIXES', PREFIXES, 20],
  ['TERMINAISONS', TERMINAISONS, 16],
  ['TETES', TETES, 10],
  ['RACINES', RACINES, 26],
];

const distincts = (liste) => new Set(liste).size;

// Un mot : une capitale suivie de minuscules, sans espace, trait d'union ni
// chiffre. Un nom de cette forme se cherche en mot entier sans ambiguïté.
const MOT = /^\p{Lu}\p{Ll}+$/u;

// Caractères d'une chaîne, en points de code.
const caracteres = (texte) => [...texte];

describe('noms : listes', () => {
  test('chaque liste atteint sa taille minimale, sans doublon, figée et en NFC', () => {
    const ecarts = [];
    for (const [nom, liste, minimum] of LISTES) {
      if (liste.length < minimum) ecarts.push(`${nom} : ${liste.length} éléments, minimum ${minimum}`);
      if (distincts(liste) !== liste.length) ecarts.push(`${nom} : doublon`);
      if (!Object.isFrozen(liste)) ecarts.push(`${nom} : modifiable`);
      if (liste.some((element) => element !== element.normalize('NFC'))) {
        ecarts.push(`${nom} : élément hors NFC`);
      }
    }
    assert.deepEqual(ecarts, []);
  });

  test('les fragments forgés et les têtes ont la forme de mots', () => {
    assert.ok([PREFIXES, TERMINAISONS, RACINES, TETES].every((liste) => liste.length > 0), 'liste vide');
    const ecarts = [
      ...PREFIXES.filter((p) => !/^\p{Lu}\p{Ll}*$/u.test(p)).map((p) => `préfixe ${p}`),
      ...TERMINAISONS.filter((t) => !/^\p{Ll}+$/u.test(t)).map((t) => `terminaison ${t}`),
      ...RACINES.filter((r) => !MOT.test(r)).map((r) => `racine ${r}`),
      ...TETES.filter((t) => !MOT.test(t)).map((t) => `tête ${t}`),
    ];
    assert.deepEqual(ecarts, []);
  });
});

describe('noms : patronymes', () => {
  test('au moins 320 patronymes distincts, chacun un mot', () => {
    const liste = patronymes();
    assert.ok(liste.length >= 320, `${liste.length} patronymes`);
    assert.equal(distincts(liste), liste.length);
    assert.deepEqual(liste.filter((p) => !MOT.test(p)).length, 0);
  });

  test('le produit PREFIXES × TERMINAISONS, préfixe par préfixe', () => {
    assert.ok(PREFIXES.length > 0 && TERMINAISONS.length > 0, 'liste vide');
    assert.deepEqual(
      patronymes(),
      PREFIXES.flatMap((prefixe) => TERMINAISONS.map((terminaison) => prefixe + terminaison)),
    );
  });

  test('chaque appel rend une liste neuve', () => {
    const premiere = patronymes();
    assert.ok(premiere.length > 0, 'aucun patronyme');
    premiere.length = 0;
    assert.equal(patronymes().length, PREFIXES.length * TERMINAISONS.length);
  });
});

describe('noms : organisations', () => {
  test('au moins 260 organisations distinctes', () => {
    const liste = organisations();
    assert.ok(liste.length >= 260, `${liste.length} organisations`);
    assert.equal(distincts(liste), liste.length);
  });

  test('le produit TETES × RACINES, tête par tête, séparées par une espace', () => {
    assert.ok(TETES.length > 0 && RACINES.length > 0, 'liste vide');
    assert.deepEqual(
      organisations(),
      TETES.flatMap((tete) => RACINES.map((racine) => `${tete} ${racine}`)),
    );
  });

  test('chaque appel rend une liste neuve', () => {
    const premiere = organisations();
    assert.ok(premiere.length > 0, 'aucune organisation');
    premiere.length = 0;
    assert.equal(organisations().length, TETES.length * RACINES.length);
  });

  test('aucune racine n’est aussi un patronyme', () => {
    const noms = new Set(patronymes());
    assert.ok(noms.size > 0 && RACINES.length > 0, 'liste vide');
    assert.deepEqual(RACINES.filter((racine) => noms.has(racine)).length, 0);
  });
});

describe('noms : noms longs (§ 15.4)', () => {
  test('trois noms distincts, figés, en NFC, hors du réservoir des patronymes et des racines', () => {
    assert.equal(NOMS_LONGS.length, 3);
    assert.equal(distincts(NOMS_LONGS), 3);
    assert.ok(Object.isFrozen(NOMS_LONGS));
    const reservoir = new Set([...patronymes(), ...RACINES]);
    assert.deepEqual(
      NOMS_LONGS.filter((nom) => reservoir.has(nom) || nom !== nom.normalize('NFC')).length,
      0,
    );
  });

  test('chacun compte au moins 20 caractères, plus que tout patronyme du réservoir', () => {
    const plusLong = Math.max(...patronymes().map((nom) => caracteres(nom).length));
    assert.ok(Number.isInteger(plusLong), 'aucun patronyme');
    assert.ok(NOMS_LONGS.length > 0, 'aucun nom long');
    const seuil = Math.max(20, plusLong + 1);
    // [rang du nom long, caractères] de chaque nom sous le seuil.
    const courts = NOMS_LONGS.map((nom, rang) => [rang, caracteres(nom).length]).filter(([, n]) => n < seuil);
    assert.deepEqual(courts, []);
  });

  test('le premier est fait de glyphes larges : M et W pour au moins la moitié de ses caractères', () => {
    const tous = caracteres(NOMS_LONGS[0]);
    const larges = tous.filter((c) => /[MWmw]/u.test(c));
    assert.ok(larges.length > 0 && larges.length * 2 >= tous.length, `${larges.length} sur ${tous.length}`);
  });

  test('le deuxième porte au moins cinq lettres à diacritique', () => {
    const marques = [...NOMS_LONGS[1].normalize('NFD')].filter((c) => /\p{M}/u.test(c));
    assert.ok(marques.length >= 5, `${marques.length} diacritiques`);
  });

  test('le troisième est le plus long, et compte au moins 40 caractères', () => {
    const [large, accentue, long] = NOMS_LONGS.map((nom) => caracteres(nom).length);
    assert.ok(long >= 40, `${long} caractères`);
    assert.ok(long > large && long > accentue);
  });
});
