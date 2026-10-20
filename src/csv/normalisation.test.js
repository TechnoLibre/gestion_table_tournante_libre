// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves des clés de comparaison (§ 10.1) : la clé normalisée, que
// partagent la réconciliation des organisations et la clé de doublon, et la
// clé d'en-tête, qui en dérive. Les lettres décomposées et les blancs autres
// que l'espace s'écrivent par leur point de code : un éditeur qui recompose
// une lettre ou remplace un caractère invisible changerait l'épreuve sans
// qu'elle le montre.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { cleEntete, cleNormalisee } from './normalisation.js';

describe('cleNormalisee (§ 10.1)', () => {
  test('la casse et les accents sont ignorés', () => {
    for (const texte of ['Coopérative Bleue', 'COOPÉRATIVE BLEUE', 'coopérative bleue', 'Cooperative Bleue']) {
      assert.equal(cleNormalisee(texte), 'cooperative bleue', texte);
    }
    assert.equal(cleNormalisee('Ça gèle à Noël, où ?'), 'ca gele a noel, ou ?');
  });

  test('une lettre accentuée, composée ou décomposée, donne la même clé', () => {
    const composee = 'Th\u{E9}o';
    const decomposee = 'The\u{301}o';
    assert.notEqual(composee, decomposee);
    assert.equal(cleNormalisee(composee), 'theo');
    assert.equal(cleNormalisee(decomposee), 'theo');
  });

  test('toute marque combinante est retirée, pas seulement les accents du français', () => {
    // Cédille, rond en chef, tréma, double accent aigu, ogonek, puis un
    // cercle englobant, marque combinante qui n'est pas un accent.
    assert.equal(cleNormalisee('Gar\u{E7}on'), 'garcon');
    assert.equal(cleNormalisee('\u{C5}ngstr\u{F6}m'), 'angstrom');
    assert.equal(cleNormalisee('\u{150}rs\u{105}'), 'orsa');
    assert.equal(cleNormalisee('a\u{20DD}b'), 'ab');
  });

  test('la décomposition est canonique : une ligature ou une lettre sans décomposition reste', () => {
    assert.equal(cleNormalisee('\u{152}uvre'), '\u{153}uvre');
    assert.equal(cleNormalisee('\u{FB01}n'), '\u{FB01}n');
    assert.equal(cleNormalisee('\u{141}ukasz'), '\u{142}ukasz');
  });

  test('les blancs se réduisent à une espace, les bouts retirés', () => {
    assert.equal(cleNormalisee('  cooperative   bleue  '), 'cooperative bleue');
    assert.equal(cleNormalisee('club\tdes\u{A0}merles\r\nnord'), 'club des merles nord');
    assert.equal(cleNormalisee('\u{202F}chorale\u{3000}du\u{2009}givre\u{FEFF}'), 'chorale du givre');
  });

  test("le trait d'union, le trait de soulignement et l'espace restent : seule la clé d'en-tête les retire", () => {
    // La réconciliation des organisations et la clé de doublon comparent par
    // cette clé : « Club-des-Merles » et « Club des Merles » y restent deux.
    assert.equal(cleNormalisee('Club-des-Merles'), 'club-des-merles');
    assert.equal(cleNormalisee('Club_des_Merles'), 'club_des_merles');
    assert.equal(cleNormalisee('Clubdes Merles'), 'clubdes merles');
    assert.notEqual(cleNormalisee('Val-Brume'), cleNormalisee('Val Brume'));
  });

  test('un texte vide ou blanc donne la clé vide', () => {
    for (const texte of ['', ' ', '\t\r\n', '\u{A0}\u{3000}\u{202F}']) {
      assert.equal(cleNormalisee(texte), '', JSON.stringify(texte));
    }
  });

  test('les minuscules ne suivent aucune langue', () => {
    // Une minuscule turque ferait de I un ı sans point.
    assert.equal(cleNormalisee('IRIS'), 'iris');
    // I à point suscrit : le point est une marque, retirée.
    assert.equal(cleNormalisee('\u{130}LE'), 'ile');
  });

  test('la clé est un point fixe : la normaliser de nouveau ne la change pas', () => {
    for (const texte of ['Coopérative Bleue', ' The\u{301}o  PERVENCHE ', '\u{130}LE', 'a\u{20DD}b', '\u{152}UVRE']) {
      const cle = cleNormalisee(texte);
      assert.equal(cleNormalisee(cle), cle, texte);
    }
  });
});

describe('cleEntete (§ 10.1)', () => {
  test('sans égard à la casse, aux accents, aux espaces, à « _ » ni à « - »', () => {
    const cas = [
      ['NOM', 'nom'],
      [' Prénom ', 'prenom'],
      ['Équipe', 'equipe'],
      ['Rôle', 'role'],
      ['E X C L U', 'exclu'],
      ['titre_pressenti', 'titrepressenti'],
      ['Titre-Pressenti', 'titrepressenti'],
      ['titre pressenti', 'titrepressenti'],
      ['titre\u{A0}_\u{9}pressenti', 'titrepressenti'],
      [' Ti_tre--Pres sen-ti ', 'titrepressenti'],
    ];
    assert.deepEqual(
      cas.map(([entete]) => cleEntete(entete)),
      cas.map(([, cle]) => cle),
    );
  });

  test('seuls les blancs, « _ » et « - » sont retirés', () => {
    assert.equal(cleEntete('titre.pressenti'), 'titre.pressenti');
    assert.equal(cleEntete('nom/prenom'), 'nom/prenom');
    assert.equal(cleEntete('titre\u{2013}pressenti'), 'titre\u{2013}pressenti');
  });

  test('un en-tête vide ou fait de blancs, de « _ » et de « - » donne la clé vide', () => {
    for (const entete of ['', '   ', '_-_', ' - ']) assert.equal(cleEntete(entete), '', JSON.stringify(entete));
  });
});
