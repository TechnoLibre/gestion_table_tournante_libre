// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le geste qu'une primitive tient ouvert sur la séance (§ 8.4), sur une
// séance factice qui compte ses gestes comme celle d'A1 : debuterGeste et
// finirGeste s'emboîtent, un fini de trop ne compte pas, et le retour
// explicite en lecture remet le compte à zéro avant d'annoncer l'annulation.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { creerGeste } from './geste.js';

function seanceFactice(mode = 'ecriture') {
  const abonnes = new Set();
  const annulations = new Set();
  const seance = {
    mode,
    gestes: 0,
    appels: [],
    subscribe(fn) {
      abonnes.add(fn);
      fn({ mode: seance.mode });
      return () => abonnes.delete(fn);
    },
    surAnnulation(fn) {
      annulations.add(fn);
      return () => annulations.delete(fn);
    },
    debuterGeste() {
      seance.gestes += 1;
      seance.appels.push('debuter');
    },
    finirGeste() {
      seance.gestes = Math.max(0, seance.gestes - 1);
      seance.appels.push('finir');
    },
    passerEnLecture() {
      seance.gestes = 0;
      seance.mode = 'lecture';
      for (const fn of [...annulations]) fn();
      for (const fn of [...abonnes]) fn({ mode: seance.mode });
    },
    passerEnEcriture() {
      seance.mode = 'ecriture';
      for (const fn of [...abonnes]) fn({ mode: seance.mode });
    },
    abonnes,
    annulations,
  };
  return seance;
}

describe('geste : le geste tenu par une primitive', () => {
  test('tenir en écriture ouvre un geste, une seule fois ; ne plus le tenir le finit', () => {
    const seance = seanceFactice();
    const geste = creerGeste(seance);
    geste.tenir(true);
    geste.tenir(true);
    assert.equal(seance.gestes, 1);
    geste.tenir(false);
    geste.tenir(false);
    assert.equal(seance.gestes, 0);
    assert.deepEqual(seance.appels, ['debuter', 'finir']);
  });

  test("en lecture, rien ne s'ouvre ; le passage en écriture ouvre le geste tenu", () => {
    const seance = seanceFactice('lecture');
    const geste = creerGeste(seance);
    geste.tenir(true);
    assert.equal(seance.gestes, 0);
    seance.passerEnEcriture();
    assert.equal(seance.gestes, 1);
  });

  test("le retour en lecture remet le compte à zéro : le geste n'est plus tenu, et le passage en écriture suivant le rouvre", () => {
    const seance = seanceFactice();
    const geste = creerGeste(seance);
    geste.tenir(true);
    seance.passerEnLecture();
    assert.equal(seance.gestes, 0);
    seance.passerEnEcriture();
    assert.equal(seance.gestes, 1, 'le geste se rouvre');
    seance.passerEnLecture();
    geste.tenir(false);
    assert.deepEqual(seance.appels, ['debuter', 'debuter'], "aucun finir sur un compte que la séance a remis à zéro");
  });

  test("un geste d'une autre primitive n'est pas fini par celle dont la séance a oublié le sien", () => {
    const seance = seanceFactice();
    const premier = creerGeste(seance);
    const second = creerGeste(seance);
    premier.tenir(true);
    seance.passerEnLecture();
    seance.passerEnEcriture();
    second.tenir(true);
    assert.equal(seance.gestes, 2);
    premier.tenir(false);
    assert.equal(seance.gestes, 1, 'le geste du second reste compté');
  });

  test('liberer finit le geste tenu et désabonne', () => {
    const seance = seanceFactice();
    const geste = creerGeste(seance);
    assert.equal(seance.abonnes.size, 1);
    assert.equal(seance.annulations.size, 1);
    geste.tenir(true);
    geste.liberer();
    assert.equal(seance.gestes, 0);
    assert.equal(seance.abonnes.size, 0);
    assert.equal(seance.annulations.size, 0);
    seance.passerEnEcriture();
    assert.equal(seance.gestes, 0);
  });
});
