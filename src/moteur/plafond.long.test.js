// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves lourdes des plafonds (§ 14.4, § 14.12) : l'accord de la
// programmation dynamique et de l'énumération sur une grille plus large que
// celle de la série node, jusqu'à 8 tables et 5 tours ; la forme de la grande
// démonstration et sa variante, arbitrées par l'énumération ; la limite de
// l'énumération à sa frontière exacte.
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from '../../test/lanceur.js';
import { LIBRE, STATUT, normaliser } from './configuration.js';
import { ErreurConfiguration } from './erreurs.js';
import { plafondsAPriori, plafondsAPrioriParEnumeration } from './plafond.js';

const SANS_CONTRAINTE = {
  separerAppartenances: false,
  nouveauxVoisins: false,
  nouvelleTable: false,
  varierAppartenances: false,
};

// Graine de la grille, écrite ici (§ 14.12) ; chaque case de la grille en
// dérive la sienne.
const GRAINE = 314_159;

/**
 * Instance d'une salle : capacites[t] et ancres[t] décrivent la table
 * d'index t ; partiels[j][r] est la table imposée au j-ème partiellement
 * fixé au tour r, LIBRE pour un tour libre. Identifiants 1 à N : les ancrés,
 * table par table, puis les partiels, puis les mobiles ; la table d'index t
 * a pour identifiant 100 + t. Lève ce que normaliser lève.
 */
function instanceDe({ capacites, ancres, mobiles, tours, partiels = [] }) {
  const participants = [];
  const reservations = [];
  const nouveau = () => {
    const id = participants.length + 1;
    participants.push({ id, nom: `P${id}`, appartenance: null });
    return id;
  };
  ancres.forEach((a, t) => {
    for (let i = 0; i < a; i += 1) {
      reservations.push({ participant: nouveau(), table: 100 + t, portee: 'tous' });
    }
  });
  for (const tables of partiels) {
    const id = nouveau();
    tables.forEach((t, r) => {
      if (t === LIBRE) return;
      reservations.push({ participant: id, table: 100 + t, portee: 'tour', tour: r + 1 });
    });
  }
  for (let i = 0; i < mobiles; i += 1) nouveau();
  return normaliser({
    participants,
    tables: capacites.map((capacite, t) => ({ id: 100 + t, numero: t + 1, capacite })),
    tours,
    reservations,
    contraintes: SANS_CONTRAINTE,
  });
}

// Une case de la grille : T tables et R tours fixés, capacités de 2 à 6.
// Une table est entièrement ancrée une fois sur quatre, et garde sinon de 1 à
// c sièges libres. Chaque tour d'un partiel est libre une fois sur deux, ou
// désigne par son rang l'une des tables qui gardent un siège, rang pris
// modulo leur nombre : seul l'empilement de partiels à une même table, au
// même tour, fait encore refuser une instance.
function arbitraireCase(T, R) {
  const table = fc
    .integer({ min: 2, max: 6 })
    .chain((c) =>
      fc.tuple(
        fc.constant(c),
        fc.oneof(
          { arbitrary: fc.integer({ min: 0, max: c - 1 }), weight: 3 },
          { arbitrary: fc.constant(c), weight: 1 },
        ),
      ),
    );
  const tour = fc.oneof(fc.constant(LIBRE), fc.integer({ min: 0, max: T - 1 }));
  return fc
    .record({
      salle: fc.array(table, { minLength: T, maxLength: T }),
      mobiles: fc.integer({ min: 0, max: 10 }),
      rangs: fc.array(fc.array(tour, { minLength: R, maxLength: R }), { maxLength: 4 }),
    })
    .map(({ salle, mobiles, rangs }) => {
      const ouvertes = [];
      salle.forEach(([c, a], t) => {
        if (a < c) ouvertes.push(t);
      });
      const partiels = rangs.map((tours) =>
        tours.map((rang) => (rang === LIBRE || ouvertes.length === 0 ? LIBRE : ouvertes[rang % ouvertes.length])),
      );
      return {
        capacites: salle.map(([c]) => c),
        ancres: salle.map(([, a]) => a),
        mobiles,
        tours: R,
        partiels,
      };
    });
}

describe("plafond a priori : la programmation dynamique contre l'énumération, grille large", () => {
  test('de 2 à 8 tables et de 2 à 5 tours, chaque case de la grille : le même plafond pour chacun', () => {
    const parCase = [];
    // Une valeur de STATUT et son compte ; la Map ne sert qu'à retrouver un
    // statut.
    const parStatut = new Map();
    for (let T = 2; T <= 8; T += 1) {
      for (let R = 2; R <= 5; R += 1) {
        let acceptees = 0;
        fc.assert(
          fc.property(arbitraireCase(T, R), (description) => {
            let instance;
            try {
              instance = instanceDe(description);
            } catch (erreur) {
              if (erreur instanceof ErreurConfiguration && erreur.code === 'SURRESERVATION') return;
              throw erreur;
            }
            if (instance.N === 0) return;
            acceptees += 1;
            for (const statut of instance.statut) parStatut.set(statut, (parStatut.get(statut) ?? 0) + 1);
            assert.deepEqual(plafondsAPriori(instance), plafondsAPrioriParEnumeration(instance));
          }),
          { seed: GRAINE + 10 * T + R, numRuns: 300 },
        );
        parCase.push([T, R, acceptees]);
      }
    }
    // Chaque case compte ses instances acceptées : une case que le
    // générateur viderait n'éprouverait rien.
    assert.equal(parCase.length, 28);
    const maigres = parCase
      .filter(([, , acceptees]) => acceptees < 200)
      .map(([T, R, n]) => `${T} tables, ${R} tours : ${n} acceptées sur 300, 200 au moins`);
    assert.deepEqual(maigres, []);
    const partiels = parStatut.get(STATUT.PARTIELLEMENT_FIXE) ?? 0;
    const ancres = parStatut.get(STATUT.ANCRE) ?? 0;
    assert.ok(partiels >= 5000, `${partiels} partiellement fixés comparés, 5000 au moins`);
    assert.ok(ancres >= 5000, `${ancres} ancrés comparés, 5000 au moins`);
  });

  test("forme de la grande démonstration et sa variante : la programmation dynamique égale l'énumération", () => {
    // Principale : 29 tables de 8 puis 4 de 7, un ancré par table. Variante :
    // 33 tables de 8, 4 places libres. 227 mobiles, 4 tours ; un mobile
    // énumère C(36, 4) = 58 905 multiensembles.
    const principale = instanceDe({
      capacites: [...Array(29).fill(8), ...Array(4).fill(7)],
      ancres: Array(33).fill(1),
      mobiles: 227,
      tours: 4,
    });
    // Les ancrés portent les identifiants 1 à 33, table par table.
    const attendu = new Array(260).fill(28);
    for (let t = 29; t < 33; t += 1) attendu[t] = 24;
    assert.deepEqual(plafondsAPriori(principale), attendu);
    assert.deepEqual(plafondsAPrioriParEnumeration(principale), attendu);

    const variante = instanceDe({
      capacites: Array(33).fill(8),
      ancres: Array(33).fill(1),
      mobiles: 227,
      tours: 4,
    });
    const vingtHuit = new Array(260).fill(28);
    assert.deepEqual(plafondsAPriori(variante), vingtHuit);
    assert.deepEqual(plafondsAPrioriParEnumeration(variante), vingtHuit);
  });

  test("la limite de l'énumération : 300 000 multiensembles passent, un de plus est refusé", () => {
    // Un tour libre : le compte est celui des tables admissibles.
    const unTour = (tables) =>
      instanceDe({ capacites: Array(tables).fill(2), ancres: [], mobiles: 1, tours: 1 });
    assert.deepEqual(plafondsAPrioriParEnumeration(unTour(300_000)), [0]);
    assert.throws(
      () => plafondsAPrioriParEnumeration(unTour(300_001)),
      (erreur) =>
        erreur instanceof ErreurConfiguration
        && erreur.code === 'ENUMERATION_TROP_GRANDE'
        && erreur.details.tablesAdmissibles === 300_001
        && erreur.details.toursLibres === 1,
    );
    // Deux tours libres : C(775, 2) = 299 925 passent, là où 774² le
    // refuserait ; C(776, 2) = 300 700 est refusé.
    const deuxTours = (tables) =>
      instanceDe({ capacites: Array(tables).fill(2), ancres: [], mobiles: 2, tours: 2 });
    const passe = deuxTours(774);
    assert.deepEqual(plafondsAPrioriParEnumeration(passe), plafondsAPriori(passe));
    assert.throws(
      () => plafondsAPrioriParEnumeration(deuxTours(775)),
      (erreur) => erreur instanceof ErreurConfiguration && erreur.code === 'ENUMERATION_TROP_GRANDE',
    );
  });
});
