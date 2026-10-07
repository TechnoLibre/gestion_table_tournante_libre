// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de l'horloge (§ 19.4, § 14.7, § 14.14) : la pilotée déclenche ses
// minuteries dans l'ordre de leur échéance, chacune à son instant, sans rien
// attendre du temps réel ; la système porte l'heure locale et son décalage, et
// aucune épreuve n'attend qu'une de ses minuteries parte. Les quatre lectures
// de chaque horloge répondent détachées de leur objet.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { creerHorlogePilotee, creerHorlogeSysteme } from './horloge.js';

const MINUTE = 60_000;
const FORME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})([+-])(\d{2}):(\d{2})$/;

describe('horloge pilotée : les minuteries (§ 19.4)', () => {
  test("deux minuteries à 10 et 5 min : avancer(6 min) déclenche la seconde seule, avancer(4 min) la première", () => {
    const horloge = creerHorlogePilotee();
    const parties = [];
    horloge.planifier(() => parties.push('dix'), 10 * MINUTE);
    horloge.planifier(() => parties.push('cinq'), 5 * MINUTE);
    assert.equal(horloge.avancer(6 * MINUTE), undefined);
    assert.deepEqual(parties, ['cinq']);
    horloge.avancer(4 * MINUTE);
    assert.deepEqual(parties, ['cinq', 'dix']);
  });

  test('une minuterie annulée ne part jamais', () => {
    const horloge = creerHorlogePilotee();
    const parties = [];
    const id = horloge.planifier(() => parties.push('annulee'), MINUTE);
    horloge.planifier(() => parties.push('gardee'), MINUTE);
    horloge.annuler(id);
    horloge.avancer(10 * MINUTE);
    assert.deepEqual(parties, ['gardee']);
  });

  test("un rappel lit horodatage() et instant() à son échéance, non à la fin de la fenêtre", () => {
    const horloge = creerHorlogePilotee();
    const lus = [];
    horloge.planifier(() => lus.push([horloge.horodatage(), horloge.instant()]), 5 * MINUTE);
    horloge.avancer(10 * MINUTE);
    assert.deepEqual(lus, [['2026-10-06T19:05:00-04:00', 5 * MINUTE]]);
    assert.equal(horloge.horodatage(), '2026-10-06T19:10:00-04:00');
    assert.equal(horloge.instant(), 10 * MINUTE);
  });

  test("une minuterie de 3 min qu'arme un rappel parti à 5 min part dans le même avancer(10 min), à 8 min", () => {
    const horloge = creerHorlogePilotee();
    const parties = [];
    horloge.planifier(() => {
      parties.push(['premiere', horloge.instant()]);
      horloge.planifier(() => parties.push(['armee', horloge.instant()]), 3 * MINUTE);
    }, 5 * MINUTE);
    horloge.avancer(10 * MINUTE);
    assert.deepEqual(parties, [
      ['premiere', 5 * MINUTE],
      ['armee', 8 * MINUTE],
    ]);
    assert.equal(horloge.instant(), 10 * MINUTE);
  });

  test("à échéance égale, l'ordre de création ; une minuterie hors de la fenêtre attend l'avancer suivant", () => {
    const horloge = creerHorlogePilotee();
    const parties = [];
    horloge.planifier(() => parties.push('b'), 2 * MINUTE);
    horloge.planifier(() => parties.push('a1'), MINUTE);
    horloge.planifier(() => parties.push('a2'), MINUTE);
    horloge.planifier(() => parties.push('c'), 3 * MINUTE);
    horloge.avancer(2 * MINUTE);
    assert.deepEqual(parties, ['a1', 'a2', 'b']);
    horloge.avancer(MINUTE - 1);
    assert.deepEqual(parties, ['a1', 'a2', 'b']);
    horloge.avancer(1);
    assert.deepEqual(parties, ['a1', 'a2', 'b', 'c']);
  });

  test('avancer rend undefined ; un ms négatif ou non fini lève', () => {
    const horloge = creerHorlogePilotee();
    assert.equal(horloge.avancer(0), undefined);
    for (const ms of [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      assert.throws(() => horloge.avancer(ms), RangeError, String(ms));
    }
    assert.equal(horloge.instant(), 0);
  });

  test("horodatage avance d'autant, décalage compris, par-delà minuit, la fin du mois et de l'année", () => {
    const horloge = creerHorlogePilotee();
    assert.equal(horloge.horodatage(), '2026-10-06T19:00:00-04:00');
    horloge.avancer(90 * MINUTE + 7_000);
    assert.equal(horloge.horodatage(), '2026-10-06T20:30:07-04:00');
    horloge.avancer(4 * 60 * MINUTE);
    assert.equal(horloge.horodatage(), '2026-10-07T00:30:07-04:00');
    const fin = creerHorlogePilotee({ depart: '2028-12-31T23:59:30+05:30' });
    fin.avancer(45_000);
    assert.equal(fin.horodatage(), '2029-01-01T00:00:15+05:30');
    const bissextile = creerHorlogePilotee({ depart: '2028-02-28T12:00:00+00:00' });
    bissextile.avancer(24 * 60 * MINUTE);
    assert.equal(bissextile.horodatage(), '2028-02-29T12:00:00+00:00');
  });

  test('instant est monotone, et commence à zéro', () => {
    const horloge = creerHorlogePilotee();
    const lus = [horloge.instant()];
    for (const pas of [0, 1, 250, 0, 60_000]) {
      horloge.avancer(pas);
      lus.push(horloge.instant());
    }
    assert.equal(lus[0], 0);
    for (let i = 1; i < lus.length; i += 1) assert.ok(lus[i] >= lus[i - 1], `${lus[i - 1]} puis ${lus[i]}`);
    assert.equal(lus.at(-1), 60_251);
  });

  test("rien n'attend le temps réel : un avancer d'une semaine se rend sur-le-champ", () => {
    const horloge = creerHorlogePilotee();
    let parties = 0;
    for (let i = 1; i <= 100; i += 1) horloge.planifier(() => (parties += 1), i * 60 * MINUTE);
    horloge.avancer(7 * 24 * 60 * MINUTE);
    assert.equal(parties, 100);
  });

  test('un départ hors de la forme AAAA-MM-JJTHH:MM:SS±HH:MM lève', () => {
    for (const depart of ['2026-10-06 19:00:00', '2026-13-01T00:00:00+00:00', '2026-02-30T00:00:00+00:00', 'demain']) {
      assert.throws(() => creerHorlogePilotee({ depart }), RangeError, depart);
    }
  });

  test('planifier refuse un délai négatif ou non fini, et un rappel qui ne se lance pas', () => {
    const horloge = creerHorlogePilotee();
    assert.throws(() => horloge.planifier(() => {}, -5), RangeError);
    assert.throws(() => horloge.planifier(() => {}, Number.NaN), RangeError);
    assert.throws(() => horloge.planifier('rappel', 5), TypeError);
  });
});

describe('horloge système (§ 19.4, § 14.14)', () => {
  test("horodatage a la forme AAAA-MM-JJTHH:MM:SS±HH:MM, l'heure courante, et porte le décalage local", () => {
    const horloge = creerHorlogeSysteme();
    const lu = horloge.horodatage();
    const morceaux = FORME.exec(lu);
    assert.ok(morceaux !== null, lu);
    const instant = Date.parse(lu);
    assert.ok(Math.abs(instant - Date.now()) < 5_000, `${lu} loin de l'heure courante`);
    const [, , , , , , , signe, heures, minutes] = morceaux;
    const decalage = (signe === '-' ? -1 : 1) * (Number(heures) * 60 + Number(minutes));
    assert.equal(decalage, -new Date(instant).getTimezoneOffset());
  });

  test("instant est monotone ; planifier rend un identifiant qu'annuler accepte, sans qu'aucune épreuve n'attende qu'il parte", () => {
    const horloge = creerHorlogeSysteme();
    const avant = horloge.instant();
    assert.ok(horloge.instant() >= avant);
    let partie = false;
    const id = horloge.planifier(() => (partie = true), 60 * MINUTE);
    assert.notEqual(id, undefined);
    assert.equal(horloge.annuler(id), undefined);
    assert.equal(horloge.annuler(id), undefined, 'un identifiant déjà annulé est sans effet');
    assert.equal(horloge.annuler('inconnu'), undefined);
    assert.equal(partie, false);
  });
});

describe('horloges : quatre fermetures appelables détachées', () => {
  test('la pilotée répond détachée comme sur son objet ; une minuterie annulée détachée ne part pas', () => {
    const horloge = creerHorlogePilotee();
    const { horodatage, instant, planifier, annuler } = horloge;
    const parties = [];
    const id = planifier(() => parties.push('annulee'), MINUTE);
    planifier(() => parties.push('gardee'), MINUTE);
    annuler(id);
    horloge.avancer(2 * MINUTE);
    assert.deepEqual(parties, ['gardee']);
    assert.equal(instant(), horloge.instant());
    assert.equal(horodatage(), horloge.horodatage());
    assert.equal(horodatage(), '2026-10-06T19:02:00-04:00');
  });

  test('la système répond détachée : armer puis annuler', () => {
    const { horodatage, instant, planifier, annuler } = creerHorlogeSysteme();
    assert.match(horodatage(), FORME);
    assert.equal(typeof instant(), 'number');
    const id = planifier(() => {
      throw new Error('une minuterie annulée est partie');
    }, 60 * MINUTE);
    assert.equal(annuler(id), undefined);
  });
});
