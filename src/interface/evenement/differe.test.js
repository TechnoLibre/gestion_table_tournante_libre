// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La demande unique d'une section chargée à part (differe.js) : un
// composant rendu tel quel se rend de façon synchrone, sans rappel ; une
// promesse se partage d'une demande à l'autre, puis cède la place au
// composant résolu ; un rejet oublie le chargement, et la demande suivante
// rappelle charger ; ce qui n'est pas un composant est refusé. Les
// composants sont des fonctions inventées.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { creerChargeurSection } from './differe.js';

// Un chargeur qui compte ses appels et rend, à chacun, la valeur suivante
// de rendus.
function compteur(...rendus) {
  const suivi = { appels: 0 };
  suivi.charger = () => {
    suivi.appels += 1;
    return rendus[suivi.appels - 1];
  };
  return suivi;
}

function Composant() {}

describe('creerChargeurSection (differe.js)', () => {
  test('un composant rendu tel quel se rend aussitôt, sans promesse, et charger ne sert qu’une fois', () => {
    const suivi = compteur(Composant);
    const demander = creerChargeurSection(suivi.charger);
    assert.equal(suivi.appels, 0);
    assert.equal(demander(), Composant);
    assert.equal(demander(), Composant);
    assert.equal(suivi.appels, 1);
  });

  test('une promesse se partage entre les demandes, puis le composant résolu se rend de façon synchrone', async () => {
    let resoudre;
    const suivi = compteur(new Promise((r) => (resoudre = r)));
    const demander = creerChargeurSection(suivi.charger);
    const premiere = demander();
    assert.equal(typeof premiere.then, 'function');
    assert.equal(demander(), premiere);
    resoudre(Composant);
    assert.equal(await premiere, Composant);
    assert.equal(demander(), Composant);
    assert.equal(suivi.appels, 1);
  });

  test('un rejet oublie le chargement : la demande suivante rappelle charger', async () => {
    const panne = new Error('morceau introuvable');
    const suivi = compteur(Promise.reject(panne), Promise.resolve(Composant));
    const demander = creerChargeurSection(suivi.charger);
    await assert.rejects(demander(), (erreur) => erreur === panne);
    const reprise = demander();
    assert.equal(suivi.appels, 2);
    assert.equal(await reprise, Composant);
    assert.equal(demander(), Composant);
  });

  test('ce qui n’est pas un composant est refusé : levé tout de suite, ou rejeté, puis redemandé', async () => {
    assert.throws(() => creerChargeurSection(null), TypeError);
    assert.throws(() => creerChargeurSection(() => ({ default: Composant }))(), /composant attendu, reçu object/);
    const suivi = compteur(Promise.resolve(null), Promise.resolve(Composant));
    const demander = creerChargeurSection(suivi.charger);
    await assert.rejects(demander(), /composant attendu, reçu null/);
    assert.equal(await demander(), Composant);
    assert.equal(suivi.appels, 2);
  });
});
