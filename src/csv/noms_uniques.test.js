// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de « Rendre les noms uniques » (§ 10.1) : le nom que reçoit
// chaque ligne d'un doublon, la première ligne qui garde le sien, le suffixe
// à deux chiffres puis trois, le numéro libre suivant quand un nom suffixé
// existe déjà, le doublon qui recoupe l'événement, la mise à jour qui garde
// le nom de la personne qu'elle met à jour, le remplacement qui ne lit pas
// l'événement, et l'aperçu recalculé sur les noms rendus, sans doublon, ses
// seules lignes renommées marquées du nom numéroté. Les noms d'épreuve sont
// inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { apercevoir, issuesDeMiseAJour } from './apercu.js';
import { rendreNomsUniques } from './noms_uniques.js';

// Texte d'un CSV : chaque ligne donnée, terminée par CRLF.
const csv = (...lignes) => lignes.map((ligne) => `${ligne}\r\n`).join('');

// Participant existant, ses autres champs vides.
const existant = (id, nom, prenom = null, organisation = null) => ({
  id, nom, prenom, organisation, courriel: null, titrePressenti: null, notes: null, exclu: false,
});

// Les noms rendus, en paires [ligne, nom], dans l'ordre de la Map.
const paires = (noms) => [...noms.entries()];

describe('rendreNomsUniques : le nom de chaque ligne d’un doublon (§ 10.1)', () => {
  test('la première ligne du fichier garde son nom ; les suivantes reçoivent au nom « 01 », « 02 », le prénom intact', () => {
    const texte = csv('nom;prenom', 'Galet;Roger', 'Houle;Aurèle', 'GALET; roger ', 'galet;Roger');
    const apercu = apercevoir(texte);
    assert.deepEqual(paires(rendreNomsUniques(apercu)), [
      [4, 'GALET 01'],
      [5, 'galet 02'],
    ]);
  });

  test('un groupe qui recoupe une personne de l’événement : la première ligne importée est déjà un doublon, et prend « 01 »', () => {
    const participants = [existant(7, 'Galet', 'Roger')];
    const apercu = apercevoir(csv('nom;prenom', 'Galet;Roger', 'Galet;Roger'), { participants });
    assert.deepEqual(paires(rendreNomsUniques(apercu, participants)), [
      [2, 'Galet 01'],
      [3, 'Galet 02'],
    ]);
  });

  test('un nom suffixé qui existe déjà, dans le fichier ou dans l’événement, saute au numéro libre suivant', () => {
    const participants = [existant(3, 'galet  02', 'Lise')];
    const apercu = apercevoir(
      csv('nom;prenom;exclu', 'Galet;Roger;', 'Galet 01;Aurèle;', 'Galet;Roger;', 'Galet 04;Iris;peut-être', 'Galet;Roger;'),
      { participants },
    );
    // « Galet 01 » est une ligne valide, « galet 02 » une personne de
    // l'événement, « Galet 04 » une ligne refusée du même fichier.
    assert.deepEqual(apercu.refusees.map(({ ligne }) => ligne), [5]);
    assert.deepEqual(paires(rendreNomsUniques(apercu, participants)), [
      [4, 'Galet 03'],
      [6, 'Galet 05'],
    ]);
  });

  test('deux groupes de même nom, de prénoms distincts : la numérotation du second saute les noms que le premier a reçus', () => {
    const apercu = apercevoir(csv('nom;prenom', 'Galet;Roger', 'Galet;Roger', 'Galet;Aurèle', 'Galet;Aurèle'));
    assert.deepEqual(paires(rendreNomsUniques(apercu)), [
      [3, 'Galet 01'],
      [5, 'Galet 02'],
    ]);
  });

  test('deux chiffres jusqu’à 99, trois au-delà', () => {
    const apercu = apercevoir(csv('nom', ...Array.from({ length: 101 }, () => 'Ocre')));
    const noms = rendreNomsUniques(apercu);
    assert.equal(noms.size, 100);
    assert.equal(noms.has(2), false);
    assert.equal(noms.get(3), 'Ocre 01');
    assert.equal(noms.get(11), 'Ocre 09');
    assert.equal(noms.get(12), 'Ocre 10');
    assert.equal(noms.get(101), 'Ocre 99');
    assert.equal(noms.get(102), 'Ocre 100');
  });

  test('sans doublon, ou sous un refus global : aucun nom', () => {
    assert.deepEqual(paires(rendreNomsUniques(apercevoir(csv('nom;prenom', 'Galet;Roger', 'Galet;Aurèle')))), []);
    const refuse = apercevoir(csv('prenom', 'Roger', 'Roger'));
    assert.equal(refuse.refusGlobal, 'NOM_NON_ASSOCIE');
    assert.deepEqual(paires(rendreNomsUniques(refuse)), []);
  });

  test('l’ordre des participants reçus ne change rien', () => {
    const participants = [existant(1, 'Galet 01', 'Lise'), existant(2, 'Galet', 'Roger'), existant(3, 'Galet 02', 'Iris')];
    const apercu = apercevoir(csv('nom;prenom', 'Galet;Roger', 'Galet;Roger'), { participants });
    const attendu = paires(rendreNomsUniques(apercu, participants));
    assert.deepEqual(attendu, [[2, 'Galet 03'], [3, 'Galet 04']]);
    assert.deepEqual(paires(rendreNomsUniques(apercu, [...participants].reverse())), attendu);
  });
});

describe('rendreNomsUniques : selon le mode de l’import (§ 10.1)', () => {
  test('mettre à jour : la ligne qui met à jour une personne garde son nom ; celle que la mise à jour refuserait, DEJA_DESIGNE, prend « 01 »', () => {
    const participants = [existant(4, 'Galet', 'Roger')];
    const apercu = apercevoir(csv('nom;prenom', 'Galet;Roger', 'Galet;Roger'), { participants, mode: 'mettreAJour' });
    assert.deepEqual(apercu.doublons.map(({ lignes, existants }) => [lignes, existants]), [[[2, 3], [4]]]);
    assert.deepEqual(issuesDeMiseAJour(participants, apercu.lignes)[1].refus.code, 'DEJA_DESIGNE');
    assert.deepEqual(paires(rendreNomsUniques(apercu, participants)), [[3, 'Galet 01']]);
  });

  test('mettre à jour : une ligne qui ne fait que mettre à jour sa personne n’a rien à rendre unique ; un homonyme non plus', () => {
    const participants = [existant(4, 'Galet', 'Roger'), existant(5, 'Houle', 'Iris')];
    const apercu = apercevoir(csv('nom;prenom', 'Galet;Roger', 'Houle;Aurèle'), { participants, mode: 'mettreAJour' });
    assert.deepEqual(apercu.doublons.map(({ lignes }) => lignes), [[2]]);
    assert.deepEqual(apercu.homonymes.map(({ ligne }) => ligne), [3]);
    assert.deepEqual(paires(rendreNomsUniques(apercu, participants)), []);
  });

  test('remplacer retire chaque personne : l’événement ne compte ni pour le doublon ni pour le numéro libre', () => {
    const participants = [existant(1, 'Galet', 'Roger'), existant(2, 'Galet 01', 'Lise')];
    const apercu = apercevoir(csv('nom;prenom', 'Galet;Roger', 'Galet;Roger'), { participants, mode: 'remplacer' });
    assert.deepEqual(paires(rendreNomsUniques(apercu, participants)), [[3, 'Galet 01']]);
  });
});

describe('apercevoir : les noms rendus uniques, l’aperçu recalculé sur eux (§ 10.1)', () => {
  test('chaque ligne nommée prend son nom ; le texte n’est pas réécrit ; le bloc des doublons se vide ; renommes les range', () => {
    const texte = csv('nom;prenom', 'Galet;Roger', 'Galet;Roger', 'Galet;Roger');
    const apercu = apercevoir(texte);
    assert.deepEqual(apercu.renommes, []);
    const noms = rendreNomsUniques(apercu);
    const rendu = apercevoir(texte, { noms });
    assert.deepEqual(rendu.lignes.map(({ ligne, champs }) => [ligne, champs.nom, champs.prenom]), [
      [2, 'Galet', 'Roger'],
      [3, 'Galet 01', 'Roger'],
      [4, 'Galet 02', 'Roger'],
    ]);
    assert.deepEqual(rendu.lignes.map(({ brut }) => brut), [['Galet', 'Roger'], ['Galet', 'Roger'], ['Galet', 'Roger']]);
    assert.deepEqual(rendu.doublons, []);
    assert.deepEqual(rendu.renommes, [3, 4]);
    assert.deepEqual(paires(rendreNomsUniques(rendu)), []);
  });

  test('la marque du nom numéroté suit les seules lignes renommées, jamais un nom qui porte déjà un numéro', () => {
    const texte = csv('nom;prenom', 'Galet;Roger', 'Galet;Roger', 'Galet 07;Lise', 'Galet;Roger');
    const marques = (apercu) => apercu.lignes.map(({ ligne, champs }) => [ligne, champs.nom, champs.nomNumerote]);
    const apercu = apercevoir(texte);
    assert.deepEqual(marques(apercu), [
      [2, 'Galet', undefined],
      [3, 'Galet', undefined],
      [4, 'Galet 07', undefined],
      [5, 'Galet', undefined],
    ]);
    const rendu = apercevoir(texte, { noms: rendreNomsUniques(apercu) });
    assert.deepEqual(marques(rendu), [
      [2, 'Galet', undefined],
      [3, 'Galet 01', true],
      [4, 'Galet 07', undefined],
      [5, 'Galet 02', true],
    ]);
    assert.deepEqual(rendu.lignes.filter(({ champs }) => champs.nomNumerote).map(({ ligne }) => ligne), rendu.renommes);
  });

  test('mettre à jour : la ligne renommée ne désigne plus personne, et s’ajoute ; la ligne qui met à jour reste désignée', () => {
    const participants = [existant(4, 'Galet', 'Roger')];
    const texte = csv('nom;prenom', 'Galet;Roger', 'Galet;Roger');
    const apercu = apercevoir(texte, { participants, mode: 'mettreAJour' });
    assert.deepEqual(apercu.designees, [2, 3]);
    const rendu = apercevoir(texte, { participants, mode: 'mettreAJour', noms: rendreNomsUniques(apercu, participants) });
    assert.deepEqual(rendu.designees, [2]);
    assert.deepEqual(issuesDeMiseAJour(participants, rendu.lignes), [{ id: 4 }, { id: null }]);
    assert.deepEqual(rendu.doublons.map(({ lignes, existants }) => [lignes, existants]), [[[2], [4]]]);
    assert.deepEqual(rendu.renommes, [3]);
  });

  test('un rang qui n’est pas celui d’une ligne valide est ignoré ; noms doit être une Map, au nom fini par un numéro', () => {
    const texte = csv('nom;exclu', 'Galet;', 'Galet;peut-être');
    const rendu = apercevoir(texte, { noms: new Map([[3, 'Galet 01'], [9, 'Houle']]) });
    assert.deepEqual(rendu.lignes.map(({ champs }) => champs.nom), ['Galet']);
    assert.deepEqual(rendu.refusees.map(({ ligne }) => ligne), [3]);
    assert.deepEqual(rendu.renommes, []);
    assert.throws(() => apercevoir(texte, { noms: { 2: 'Galet 01' } }), TypeError);
    for (const nom of ['Houle', 'Galet 1', 'Galet\u{A0}01', 7]) {
      assert.throws(() => apercevoir(texte, { noms: new Map([[2, nom]]) }), TypeError, String(nom));
    }
  });

  test('sous un refus global, renommes est vide', () => {
    const rendu = apercevoir(csv('prenom', 'Roger'), { noms: new Map([[2, 'Galet 01']]) });
    assert.equal(rendu.refusGlobal, 'NOM_NON_ASSOCIE');
    assert.deepEqual(rendu.renommes, []);
  });
});
