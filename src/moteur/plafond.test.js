// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves des plafonds (§ 5.5) : la formule sur un itinéraire, le plafond
// réalisé sur l'occupation, le plafond a priori maximisé sur les itinéraires
// admissibles, et l'accord de la programmation dynamique avec l'énumération
// exhaustive qui l'arbitre (§ 14.11, § 14.12). Les valeurs attendues des
// formes nommées sont celles du § 5.5, du § 14.10 et du § 15 ; les autres se
// calculent à la main, table par table, dans le commentaire qui les précède.
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from '../../test/lanceur.js';
import { indexerPlan, normaliser } from './configuration.js';
import { ErreurConfiguration } from './erreurs.js';
import {
  plafondItineraire,
  plafondsAPriori,
  plafondsAPrioriParEnumeration,
  plafondsRealises,
} from './plafond.js';

const SANS_CONTRAINTE = {
  separerAppartenances: false,
  nouveauxVoisins: false,
  nouvelleTable: false,
  varierAppartenances: false,
};

// Graine de la propriété, écrite ici pour que chaque exécution tire les
// mêmes instances (§ 14.12).
const GRAINE = 271_828;

// Entiers de debut à fin, inclus.
const suite = (debut, fin) => Array.from({ length: fin - debut + 1 }, (_, i) => debut + i);

/**
 * Instance d'une forme de salle. capacites[t] et ancres[t] décrivent la
 * table d'index t ; autres compte les participants non ancrés, dont les
 * premiers sont partiellement fixés selon partiels : partiels[j][r] est
 * l'index de table imposé au tour r, −1 pour un tour libre. Les ancrés
 * prennent les identifiants pairs tant qu'il reste des non-ancrés, et les
 * identifiants de table décroissent quand l'index croît : un index lu comme
 * un identifiant désigne une autre personne ou une autre table. Rend
 * l'instance et les index de personne de chaque rôle ; lève ce que
 * normaliser lève.
 */
function forme({ capacites, ancres, autres, tours, partiels = [] }) {
  const T = capacites.length;
  const idTable = (t) => 10 * (T - t);
  const K = ancres.reduce((somme, a) => somme + a, 0);
  const idsAncres = [];
  const idsAutres = [];
  for (const id of suite(1, K + autres)) {
    const resteAutres = autres - idsAutres.length;
    if (idsAncres.length < K && (id % 2 === 0 || resteAutres === 0)) idsAncres.push(id);
    else idsAutres.push(id);
  }
  const reservations = [];
  const ancresParTable = [];
  let premier = 0;
  for (let t = 0; t < T; t += 1) {
    const ids = idsAncres.slice(premier, premier + ancres[t]);
    premier += ancres[t];
    ancresParTable.push(ids);
    for (const id of ids) reservations.push({ participant: id, table: idTable(t), portee: 'tous' });
  }
  partiels.forEach((tables, j) => {
    tables.forEach((t, r) => {
      if (t < 0) return;
      reservations.push({
        participant: idsAutres[j],
        table: idTable(t),
        portee: 'tour',
        tour: r + 1,
      });
    });
  });
  const instance = normaliser({
    participants: suite(1, K + autres).map((id) => ({ id, nom: `P${id}`, appartenance: null })),
    tables: capacites.map((capacite, t) => ({ id: idTable(t), numero: t + 1, capacite })),
    tours,
    reservations,
    contraintes: SANS_CONTRAINTE,
  });
  const index = (id) => instance.indexDe.get(id);
  return {
    instance,
    ancres: ancresParTable.map((ids) => ids.map(index)),
    partiels: idsAutres.slice(0, partiels.length).map(index),
    mobiles: idsAutres.slice(partiels.length).map(index),
  };
}

// Forme de la grande démonstration (§ 15.1) : 29 tables de 8 puis 4 de 7,
// un ancré par table, 227 non-ancrés, 4 tours. Les tables de 7 portent les
// index 29 à 32.
const grandeForme = (partiels = []) =>
  forme({
    capacites: [...Array(29).fill(8), ...Array(4).fill(7)],
    ancres: Array(33).fill(1),
    autres: 227,
    tours: 4,
    partiels,
  });

// Plan indexé d'un plan écrit table par table : listes[r][t] porte les
// identifiants assis à la table d'index t au tour r, reserves[r] ceux du
// tour r en réserve.
const planIndexe = (instance, listes, reserves = listes.map(() => [])) =>
  indexerPlan(instance, { tables: [...instance.idsTables], tours: listes, reserves });

// Plan valide quelconque, que la graine brasse : à chaque tour, chaque
// personne fixée s'assied à sa table ; les autres, dans un ordre brassé,
// prennent tour à tour un siège à la table suivante d'un cycle brassé des
// tables qui en ont encore ; sans siège, une personne va en réserve.
function planBrasse(instance, graine) {
  const { N, T, R, fixe, capacite } = instance;
  const tableDe = new Int32Array(N * R).fill(-1);
  const brassage = (i, r) => ((i + 1) * 2_654_435_761 + (r + 1) * 40_503 + graine * 97) % 1_000_003;
  for (let r = 0; r < R; r += 1) {
    const libres = Int32Array.from(capacite);
    const aPlacer = [];
    for (let p = 0; p < N; p += 1) {
      const t = fixe[p * R + r];
      if (t >= 0) {
        tableDe[p * R + r] = t;
        libres[t] -= 1;
      } else {
        aPlacer.push(p);
      }
    }
    aPlacer.sort((x, y) => brassage(x, r) - brassage(y, r) || x - y);
    const cycle = suite(0, T - 1).sort((x, y) => brassage(N + x, r) - brassage(N + y, r) || x - y);
    let rang = 0;
    for (const p of aPlacer) {
      let essais = 0;
      while (essais < T && libres[cycle[rang % T]] === 0) {
        rang += 1;
        essais += 1;
      }
      if (essais === T) break;
      const t = cycle[rang % T];
      tableDe[p * R + r] = t;
      libres[t] -= 1;
      rang += 1;
    }
  }
  return tableDe;
}

// Ancrés d'une table de capacité c : de 0 à c − 1, ou c une fois sur
// quatre, pour une table entièrement ancrée.
const ancresDe = (c) =>
  fc.oneof(
    { arbitrary: fc.integer({ min: 0, max: c - 1 }), weight: 3 },
    { arbitrary: fc.constant(c), weight: 1 },
  );

// Un tour d'un non-ancré : libre (−1) une fois sur deux, fixé sinon à l'une
// des T tables.
const tourDe = (T) => fc.oneof(fc.constant(-1), fc.integer({ min: 0, max: T - 1 }));

// Description d'une instance tirée dans les bornes données : chaque table
// tire sa capacité puis ses ancrés, chaque partiel un tour par tour. Un
// partiel dont aucun tour n'est fixé est un mobile ; un partiel fixé à la
// même table à chaque tour, un ancré (§ 4.2).
function arbitraireForme({ tables, tours, capacites, mobiles, partiels }) {
  const table = fc
    .integer({ min: capacites[0], max: capacites[1] })
    .chain((c) => fc.tuple(fc.constant(c), ancresDe(c)));
  return fc
    .tuple(
      fc.integer({ min: tables[0], max: tables[1] }),
      fc.integer({ min: tours[0], max: tours[1] }),
    )
    .chain(([T, R]) =>
      fc.record({
        salle: fc.array(table, { minLength: T, maxLength: T }),
        tours: fc.constant(R),
        mobiles: fc.integer({ min: 0, max: mobiles }),
        partiels: fc.array(fc.array(tourDe(T), { minLength: R, maxLength: R }), {
          maxLength: partiels,
        }),
      }),
    );
}

// Compare les deux calculs du plafond a priori sur chaque instance tirée.
// Une instance que normaliser refuse — une table qui reçoit plus de
// personnes fixées que de sièges — ou sans participant n'est pas comptée ;
// une autre l'est, avec ses personnes par statut et ses tables pleines
// d'ancrés. Rend ces comptes.
function eprouverAccord(arbitraire, parametres) {
  const bilan = { acceptees: 0, parStatut: [0, 0, 0], tablesPleines: 0 };
  fc.assert(
    fc.property(arbitraire, ({ salle, tours, mobiles, partiels }) => {
      let instance;
      try {
        ({ instance } = forme({
          capacites: salle.map(([c]) => c),
          ancres: salle.map(([, a]) => a),
          autres: partiels.length + mobiles,
          tours,
          partiels,
        }));
      } catch (erreur) {
        if (erreur instanceof ErreurConfiguration && erreur.code === 'SURRESERVATION') return;
        throw erreur;
      }
      if (instance.N === 0) return;
      bilan.acceptees += 1;
      for (let p = 0; p < instance.N; p += 1) bilan.parStatut[instance.statut[p]] += 1;
      if (salle.some(([c, a]) => a === c)) bilan.tablesPleines += 1;
      assert.deepEqual(plafondsAPriori(instance), plafondsAPrioriParEnumeration(instance));
    }),
    parametres,
  );
  return bilan;
}

describe('plafonds : valeurs exactes (§ 5.5, § 15)', () => {
  test('4 tables de 5, un ancré chacune, 5 tours : un ancré 16, un mobile 19', () => {
    const { instance, ancres, mobiles } = forme({
      capacites: [5, 5, 5, 5],
      ancres: [1, 1, 1, 1],
      autres: 16,
      tours: 5,
    });
    assert.equal(instance.N, 20);
    assert.equal(instance.k, 4);
    assert.equal(instance.n, 16);
    // L'écart entre les deux valeurs est l'objet du test. Un ancré ne
    // rencontre jamais les ancrés des autres tables : ses 5 tours × 4
    // sièges ne livrent que les 16 mobiles. Sans le terme min(n_p, …), il
    // monterait à 19 avec le mobile.
    const attendu = new Array(20).fill(19);
    for (const [p] of ancres) attendu[p] = 16;
    assert.deepEqual(plafondsAPriori(instance), attendu);
    assert.deepEqual(plafondsAPrioriParEnumeration(instance), attendu);
    assert.equal(plafondItineraire(instance, ancres[0][0], [0, 0, 0, 0, 0]), 16);
    assert.equal(plafondItineraire(instance, mobiles[0], [0, 1, 2, 3, 0]), 19);
  });

  test('forme de la grande démonstration : mobile 28, animateur 28 à une table de 8, 24 à une table de 7', () => {
    const { instance, ancres, mobiles } = grandeForme();
    assert.equal(instance.N, 260);
    assert.equal(instance.k, 33);
    assert.equal(instance.n, 227);
    const attendu = new Array(260).fill(28);
    for (let t = 29; t < 33; t += 1) attendu[ancres[t][0]] = 24;
    assert.deepEqual(plafondsAPriori(instance), attendu);
    // Un mobile qui passe une fois par une table de 7 : 4 ancrés, 3 × 6 + 5
    // sièges, 27. Par quatre tables de 8 : 28.
    assert.equal(plafondItineraire(instance, mobiles[0], [0, 1, 2, 29]), 27);
    assert.equal(plafondItineraire(instance, mobiles[0], [0, 1, 2, 3]), 28);
  });

  test('petite démonstration : 8 pour chacun, que le plan parfait atteint (§ 15.3)', () => {
    const { instance } = forme({
      capacites: [3, 3, 3, 3],
      ancres: [0, 0, 0, 0],
      autres: 12,
      tours: 4,
    });
    const huit = new Array(12).fill(8);
    assert.deepEqual(plafondsAPriori(instance), huit);
    assert.deepEqual(plafondsAPrioriParEnumeration(instance), huit);
    // Le plan parfait du § 15.3, la table k du tableau à l'index k − 1. Les
    // tables y sont pleines à chaque tour : le réalisé égale l'a priori.
    const parfait = planIndexe(instance, [
      [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]],
      [[6, 9, 12], [3, 8, 11], [2, 5, 10], [1, 4, 7]],
      [[4, 8, 10], [2, 7, 12], [1, 6, 11], [3, 5, 9]],
      [[5, 7, 11], [1, 9, 10], [3, 4, 12], [2, 6, 8]],
    ]);
    assert.deepEqual(plafondsRealises(instance, parfait), huit);
  });

  test("plafond réalisé sur l'occupation : 3 tables de 4, un ancré chacune, N = 10, 2 tours", () => {
    const { instance } = forme({ capacites: [4, 4, 4], ancres: [1, 1, 1], autres: 7, tours: 2 });
    assert.equal(instance.n, 7);
    // Ancrés 2, 4 et 6 aux tables d'index 0, 1 et 2 ; les mobiles 1 et 3
    // passent les deux tours à la table d'index 0, occupée par 3.
    const tableDe = planIndexe(instance, [
      [[1, 2, 3], [4, 5, 7, 8], [6, 9, 10]],
      [[1, 2, 3], [4, 9, 10], [5, 6, 7, 8]],
    ]);
    // Par identifiant, l'index valant id − 1 ; N − 1 = 9, n_p = 6 pour un
    // mobile et 7 pour un ancré. Un tour à une table d'occupation o apporte
    // o − 1 − a_t sièges, a_t = 1 pour un mobile et 0 pour l'ancré de la
    // table :
    //   1, 3     table 0 deux fois, o = 3 : 1 ancré + 1 + 1   = 3
    //   5, 7, 8  tables 1 puis 2, o = 4 : 2 ancrés + 2 + 2    = 6
    //   9, 10    tables 2 puis 1, o = 3 : 2 ancrés + 1 + 1    = 4
    //   2        sa table, o = 3 puis 3 : 2 + 2               = 4
    //   4        sa table, o = 4 puis 3 : 3 + 2               = 5
    //   6        sa table, o = 3 puis 4 : 2 + 3               = 5
    const realises = plafondsRealises(instance, tableDe);
    assert.deepEqual(realises, [3, 4, 3, 5, 6, 5, 6, 6, 4, 4]);
    // A priori, sur les capacités : un mobile visite deux tables, 2 + 2 × 2 ;
    // un ancré tient sa table, 2 × 3.
    const aPriori = plafondsAPriori(instance);
    assert.deepEqual(aPriori, new Array(10).fill(6));
    const p = instance.indexDe.get(1);
    assert.equal(realises[p], 3);
    assert.equal(aPriori[p], 6);
    // Écart d'itinéraire du mobile 1 : 3.
    assert.equal(aPriori[p] - realises[p], 3);
  });

  test('partiellement fixé : sa table fixée entre dans F, seuls ses tours libres varient', () => {
    // Un non-ancré de la grande forme, fixé au tour 1 à une table de 7.
    const { instance, partiels, mobiles, ancres } = grandeForme([[29, -1, -1, -1]]);
    const [p] = partiels;
    assert.equal(instance.statut[p], 1);
    assert.equal(instance.k, 33);
    const aPriori = plafondsAPriori(instance);
    // La table de 7 entre dans F : 1 ancré et 5 sièges ; ses trois tours
    // libres prennent trois tables de 8 : 3 ancrés et 18 sièges. 27.
    assert.equal(aPriori[p], 27);
    assert.equal(aPriori[mobiles[0]], 28);
    assert.equal(aPriori[ancres[29][0]], 24);
    // Libéré de son tour fixé, l'itinéraire atteindrait 28 : le maximum ne
    // déplace pas ce tour.
    assert.equal(plafondItineraire(instance, p, [0, 1, 2, 3]), 28);
    assert.equal(plafondItineraire(instance, p, [29, 0, 1, 2]), 27);
    assert.equal(plafondsAPrioriParEnumeration(instance)[p], 27);
  });

  test("une table pleine d'ancrés n'est pas admissible ; un partiellement fixé compte parmi les mobiles", () => {
    // Table d'index 0 : 5 sièges, aucun ancré. Table d'index 1 : 2 sièges,
    // 2 ancrés, pleine. Le partiellement fixé est fixé au tour 1 à la table
    // 0 ; N = 5, k = 2, n = 3, 2 tours.
    const { instance, ancres, partiels, mobiles } = forme({
      capacites: [5, 2],
      ancres: [0, 2],
      autres: 3,
      tours: 2,
      partiels: [[0, -1]],
    });
    assert.equal(instance.n, 3);
    // Partiel et mobiles : seule la table 0 est admissible, 0 ancré et
    // 4 + 4 sièges, bornés par n_p = n − 1 = 2. La table pleine, admise, leur
    // donnerait 4 : 2 ancrés, et v = 2 − 1 − 2 = −1 ; n_p = n en donnerait 3.
    // Ancrés : 1 ancré voisin, 0 siège qui change d'occupant. 1.
    const attendu = new Array(5).fill(-1);
    for (const p of [...partiels, ...mobiles]) attendu[p] = 2;
    for (const p of ancres[1]) attendu[p] = 1;
    assert.deepEqual(plafondsAPriori(instance), attendu);
    assert.deepEqual(plafondsAPrioriParEnumeration(instance), attendu);
  });

  test('réserve : une personne en réserve à un tour a un plafond réalisé sur ses seuls tours assis', () => {
    // Deux tables de 3, le participant 2 ancré à la table d'index 0 ;
    // 4 mobiles, 2 tours. Le mobile 3 est en réserve au tour 2.
    const { instance } = forme({ capacites: [3, 3], ancres: [1, 0], autres: 4, tours: 2 });
    const tableDe = planIndexe(
      instance,
      [
        [[1, 2, 3], [4, 5]],
        [[2, 4], [1, 5]],
      ],
      [[], [3]],
    );
    // N − 1 = 4, n_p = 3 pour un mobile et 4 pour l'ancré :
    //   1   table 0 (3 occupants, 1 ancré) puis 1 (2) : 1 ancré + 1 + 1 = 3
    //   2   sa table, occupée par 3 puis 2 : 2 + 1                     = 3
    //   3   table 0 au seul tour 1 : 1 ancré + 1                       = 2
    //   4   table 1 (2) puis 0 (2, 1 ancré) : 1 ancré + 1 + 0          = 2
    //   5   table 1, occupée par 2 aux deux tours : 1 + 1              = 2
    assert.deepEqual(plafondsRealises(instance, tableDe), [3, 3, 2, 2, 2]);
    const p = instance.indexDe.get(3);
    assert.equal(plafondItineraire(instance, p, [0, -1]), 2);
    // L'écart d'itinéraire porte ce que le manque ne porte pas : 4 − 2.
    assert.deepEqual(plafondsAPriori(instance), [4, 4, 4, 4, 4]);
  });

  test('sans table admissible, les tours libres restent en réserve', () => {
    // Deux tables entièrement ancrées et un mobile, qui ne peut s'asseoir
    // nulle part. Ancrés de la table de 2 : 1 voisin, 0 siège. Ancrés de la
    // table de 3 : 2 voisins, 0 siège. Le mobile : 0.
    const { instance, ancres, mobiles } = forme({
      capacites: [2, 3],
      ancres: [2, 3],
      autres: 1,
      tours: 2,
    });
    const attendu = new Array(6).fill(-1);
    for (const p of ancres[0]) attendu[p] = 1;
    for (const p of ancres[1]) attendu[p] = 2;
    attendu[mobiles[0]] = 0;
    assert.deepEqual(plafondsAPriori(instance), attendu);
    assert.deepEqual(plafondsAPrioriParEnumeration(instance), attendu);
    assert.equal(plafondItineraire(instance, mobiles[0], [-1, -1]), 0);
  });

  test('plafond a priori ≥ plafond réalisé pour chacun, sur trois plans quelconques de chaque forme', () => {
    const formes = [
      forme({ capacites: [5, 5, 5, 5], ancres: [1, 1, 1, 1], autres: 16, tours: 5 }),
      grandeForme(),
      grandeForme([[29, -1, -1, -1], [-1, 30, 30, -1]]),
      forme({ capacites: [3, 3, 3, 3], ancres: [0, 0, 0, 0], autres: 12, tours: 4 }),
      forme({ capacites: [4, 4, 4], ancres: [1, 1, 1], autres: 7, tours: 2 }),
      forme({ capacites: [5, 2], ancres: [0, 2], autres: 3, tours: 2, partiels: [[0, -1]] }),
      // Une place de moins que de participants : chaque plan met quelqu'un
      // en réserve.
      forme({ capacites: [3, 3], ancres: [1, 0], autres: 6, tours: 3, partiels: [[-1, 1, -1]] }),
    ];
    const ecarts = [];
    let comparaisons = 0;
    for (let rang = 0; rang < formes.length; rang += 1) {
      const { instance } = formes[rang];
      const aPriori = plafondsAPriori(instance);
      for (const graine of [1, 2, 3]) {
        const realises = plafondsRealises(instance, planBrasse(instance, graine));
        for (let p = 0; p < instance.N; p += 1) {
          comparaisons += 1;
          if (realises[p] > aPriori[p]) {
            ecarts.push(
              `forme ${rang}, graine ${graine}, index ${p} : `
                + `réalisé ${realises[p]} > a priori ${aPriori[p]}`,
            );
          }
        }
      }
    }
    assert.equal(comparaisons, 3 * formes.reduce((somme, { instance }) => somme + instance.N, 0));
    assert.ok(comparaisons > 0, 'aucune comparaison');
    assert.deepEqual(ecarts, []);
  });

  test("un itinéraire ou un plan indexé hors de la forme de l'instance lève RangeError", () => {
    const { instance } = forme({ capacites: [3, 3], ancres: [0, 0], autres: 4, tours: 2 });
    const cas = [
      ['itinéraire de 1 tour sur 2', () => plafondItineraire(instance, 0, [0])],
      ["table d'index 2 sur 2 tables", () => plafondItineraire(instance, 0, [0, 2])],
      ["table d'index −2", () => plafondItineraire(instance, 0, [-2, 0])],
      ["table d'index non entier", () => plafondItineraire(instance, 0, [0, 0.5])],
      ["personne d'index 4 sur 4", () => plafondItineraire(instance, 4, [0, 0])],
      ["personne d'index −1", () => plafondItineraire(instance, -1, [0, 0])],
      ['plan de 7 cases sur 8', () => plafondsRealises(instance, new Int32Array(7))],
      ['plan à une case −2', () => plafondsRealises(instance, Int32Array.of(0, 0, 0, 0, 1, 1, 1, -2))],
      ['plan à une case 2', () => plafondsRealises(instance, Int32Array.of(0, 0, 0, 0, 1, 1, 1, 2))],
    ];
    const ecarts = cas
      .map(([libelle, fonction]) => {
        try {
          fonction();
        } catch (erreur) {
          if (erreur instanceof RangeError) return null;
          return `${libelle} : ${erreur?.name} au lieu de RangeError`;
        }
        return `${libelle} : aucun refus`;
      })
      .filter((ecart) => ecart !== null);
    assert.deepEqual(ecarts, []);
  });
});

describe("plafond a priori : la programmation dynamique contre l'énumération (§ 14.11, § 14.12)", () => {
  test("au-delà de 300 000 multiensembles, l'énumération refuse ; la programmation dynamique répond", () => {
    // 775 tables admissibles et 2 tours libres : C(776, 2) = 300 700
    // multiensembles pour la signature des mobiles. Le premier d'entre eux
    // dans l'ordre des index est nommé.
    const { instance, mobiles } = forme({
      capacites: Array(775).fill(2),
      ancres: Array(775).fill(0),
      autres: 2,
      tours: 2,
    });
    assert.throws(
      () => plafondsAPrioriParEnumeration(instance),
      (erreur) => {
        assert.ok(erreur instanceof ErreurConfiguration, `${erreur?.name} : ${erreur?.message}`);
        assert.equal(erreur.code, 'ENUMERATION_TROP_GRANDE');
        assert.deepEqual(erreur.details, {
          participant: instance.ids[mobiles[0]],
          tablesAdmissibles: 775,
          toursLibres: 2,
          limite: 300_000,
        });
        return true;
      },
    );
    // N − 1 = 1 borne les deux mobiles.
    assert.deepEqual(plafondsAPriori(instance), [1, 1]);
  });

  test('2 à 5 tables, 2 à 4 tours, capacités 2 à 5, ancrés et partiels : le même plafond pour chacun', () => {
    const bilan = eprouverAccord(
      arbitraireForme({ tables: [2, 5], tours: [2, 4], capacites: [2, 5], mobiles: 6, partiels: 3 }),
      { seed: GRAINE, numRuns: 500 },
    );
    // Une instance que normaliser refuse n'éprouve rien : la boucle compte
    // les acceptées, et les personnes comparées de chaque statut.
    const { acceptees, parStatut, tablesPleines } = bilan;
    assert.ok(acceptees >= 200, `${acceptees} instances acceptées, 200 au moins`);
    assert.ok(parStatut[1] >= 100, `${parStatut[1]} partiellement fixés comparés, 100 au moins`);
    assert.ok(parStatut[2] >= 100, `${parStatut[2]} ancrés comparés, 100 au moins`);
    assert.ok(tablesPleines >= 50, `${tablesPleines} instances à table pleine d'ancrés, 50 au moins`);
  });
});
