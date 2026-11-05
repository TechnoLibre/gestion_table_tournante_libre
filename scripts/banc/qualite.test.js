// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du banc des deux seuils de la page de qualité (§ 14.1, § 19.10),
// sous node : le nom de référence que le banc compose pour la largeur de
// troncature (nomDeReference, seuils.js), sur des largeurs écrites, dont le
// glyphe le plus large se lit à la main ; puis la sortie que le banc écrit
// (qualite.banc.js), rangée dans un relevé, que la garde du relevé accepte
// telle quelle et refuse dès qu'une valeur y nomme la machine. Le nom d'hôte
// et le chemin de compte de ces épreuves sont inventés.
import assert from 'node:assert/strict';
import { CONSTANTES } from '../../src/geometrie/constantes.js';
import { describe, test } from '../../test/lanceur.js';
import { verifierReleve } from './releve.js';
import { nomDeReference } from './seuils.js';

// Des largeurs écrites, en px, par glyphe ; un texte de plusieurs glyphes
// mesure la somme des siens. Chaque appel est noté.
const LARGEURS = new Map([
  ['a', 7],
  ['W', 12.5],
  ['M', 11],
  ['\u{152}', 12.5],
  ['i', 3],
  ['Q', 12.1],
]);
function mesureur() {
  const appels = [];
  const mesurer = (texte) => {
    appels.push(texte);
    return [...texte].reduce((somme, glyphe) => somme + LARGEURS.get(glyphe), 0);
  };
  return { mesurer, appels };
}

describe('nomDeReference : le glyphe le plus large, répété (§ 14.1)', () => {
  test('le glyphe le plus large de l’alphabet, répété longueur fois ; sa largeur mesurée, arrondie au pixel supérieur', () => {
    const { mesurer, appels } = mesureur();
    assert.deepEqual(nomDeReference('aMWi', 3, mesurer), {
      glyphe: 'W',
      largeurGlyphe: 12.5,
      nom: 'WWW',
      largeur: 37.5,
      valeur: 38,
    });
    // Chaque glyphe se mesure une fois, puis le nom composé, entier.
    assert.deepEqual(appels, ['a', 'M', 'W', 'i', 'WWW']);
  });

  test('une partie fractionnaire sous le demi-pixel s’arrondit aussi au pixel supérieur', () => {
    const { mesurer } = mesureur();
    assert.deepEqual(nomDeReference('aQ', 2, mesurer), { glyphe: 'Q', largeurGlyphe: 12.1, nom: 'QQ', largeur: 24.2, valeur: 25 });
  });

  test('à égalité, le premier glyphe de l’alphabet ; une largeur entière reste entière', () => {
    const { mesurer } = mesureur();
    assert.equal(nomDeReference('ia\u{152}W', 2, mesurer).glyphe, '\u{152}');
    assert.equal(nomDeReference('iaW\u{152}', 2, mesurer).glyphe, 'W');
    assert.deepEqual(nomDeReference('aM', 4, mesurer), { glyphe: 'M', largeurGlyphe: 11, nom: 'MMMM', largeur: 44, valeur: 44 });
  });

  test('l’alphabet se parcourt par points de code : un glyphe hors du plan de base compte pour un', () => {
    const largeurs = new Map([
      ['a', 7],
      ['\u{1D400}', 15],
    ]);
    const mesurer = (texte) => [...texte].reduce((somme, glyphe) => somme + largeurs.get(glyphe), 0);
    assert.deepEqual(nomDeReference('a\u{1D400}', 2, mesurer), {
      glyphe: '\u{1D400}',
      largeurGlyphe: 15,
      nom: '\u{1D400}\u{1D400}',
      largeur: 30,
      valeur: 30,
    });
  });

  test('refuse un alphabet vide, une longueur qui n’est pas un entier ≥ 1, un mesureur absent', () => {
    const { mesurer } = mesureur();
    assert.throws(() => nomDeReference('', 3, mesurer), RangeError);
    assert.throws(() => nomDeReference(['a'], 3, mesurer), TypeError);
    for (const longueur of [0, -1, 2.5, Number.NaN, '3']) {
      assert.throws(() => nomDeReference('aW', longueur, mesurer), RangeError, String(longueur));
    }
    assert.throws(() => nomDeReference('aW', 3, null), TypeError);
  });

  test('refuse une largeur nulle ou non finie — un texte qui n’est pas rendu ne mesure rien — en nommant le texte', () => {
    assert.throws(() => nomDeReference('aW', 2, (texte) => (texte === 'W' ? 0 : 7)), /« W »/);
    assert.throws(() => nomDeReference('aW', 2, (texte) => (texte === 'W' ? Number.NaN : 7)), /« W »/);
    assert.throws(() => nomDeReference('aW', 2, (texte) => (texte.length > 1 ? 0 : 7)), /« aa »/);
  });
});

// La sortie du banc de la page de qualité, de valeurs inventées, à la forme
// que qualite.banc.js écrit : les deux mesures, puis leurs sondes.
const sortie = () => ({
  format: 1,
  mesures: [
    {
      nom: 'SEUIL_MATRICE_PARTICIPANTS',
      unite: 'participants',
      valeurProposee: 37,
      critere: 'case de 24 px dans la largeur de la carte, noms en tête compris',
      police: 'Noto Sans',
      ralentissementCpu: 1,
      sondes: [{ participants: 37, dessinee: true, cotePx: 24, largeurCartePx: 1100, tient: true }],
      refus: null,
    },
    {
      nom: 'LARGEUR_TRONCATURE_NOM_PX',
      unite: 'px',
      valeurProposee: 190,
      critere: 'nom de référence de 14 glyphes',
      police: 'Noto Sans',
      ralentissementCpu: 1,
      glyphe: '\u{152}',
      largeurGlyphePx: 13.5,
      nomReference: '\u{152}'.repeat(14),
      largeurNomPx: 189.1,
      refus: null,
    },
  ],
});

// La sortie rangée dans un relevé, comme le banc le vérifie avant de
// l'écrire.
const releveDe = (s) => ({
  format: 1,
  configuration: {
    cadre: { largeur: 1366, hauteur: 700 },
    facteurEchelle: 1,
    navigateur: null,
    node: null,
    processeursLogiques: null,
    ralentissementCpu: 1,
    police: 'Noto Sans',
  },
  mesures: s.mesures,
});

describe('la sortie du banc de la page de qualité, rangée dans un relevé (§ 19.10)', () => {
  test('conforme : les deux constantes du banc, à l’unité du registre', () => {
    assert.deepEqual(verifierReleve(releveDe(sortie()), CONSTANTES), []);
  });

  test('un nom d’hôte inventé dans une sonde est refusé, par son chemin', () => {
    const s = sortie();
    s.mesures[0].sondes[0].hote = 'poste-grebiche-07';
    assert.deepEqual(verifierReleve(releveDe(s), CONSTANTES), [
      { chemin: 'mesures[0].sondes[0].hote', faute: 'un relevé ne nomme pas sa machine : ni hôte, ni utilisateur, ni date' },
    ]);
  });

  test('un nom de machine inventé au sommet d’une mesure, et un chemin de compte inventé dans son critère, sont refusés', () => {
    const s = sortie();
    s.mesures[1].nomMachine = 'poste-grebiche-07';
    s.mesures[1].critere = 'mesuré depuis /home/grebiche/banc';
    assert.deepEqual(
      verifierReleve(releveDe(s), CONSTANTES).map(({ chemin }) => chemin),
      ['mesures[1].critere', 'mesures[1].nomMachine'],
    );
  });
});
