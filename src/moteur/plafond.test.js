// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves des plafonds (§ 5.5) : la formule sur un itinéraire, le plafond
// réalisé sur l'occupation, le plafond a priori maximisé sur les itinéraires
// admissibles, et l'accord de la programmation dynamique avec l'énumération
// exhaustive qui l'arbitre (§ 14.11, § 14.12). Les valeurs attendues des
// formes nommées sont celles du § 5.5, du § 14.10 et du § 15 ; les autres se
// calculent à la main, table par table, dans le commentaire qui les précède.
// Un réduit parfait ne prouve pas le plafond complet : l'énumération de
// toutes les affectations du plan affine d'ordre 4 aux tables borne le
// mobile le plus mal servi à 17 sur 19 (§ 5.5).
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from '../../test/lanceur.js';
import {
  LIBRE,
  RESERVE,
  STATUT,
  indexerPlan,
  normaliser,
  planDepuisIndex,
} from './configuration.js';
import { ErreurConfiguration } from './erreurs.js';
import { mesurer } from './indicateurs.js';
import {
  borneDiversite,
  occupations,
  plafondItineraire,
  plafondsAPriori,
  plafondsAPrioriParEnumeration,
  plafondsRealises,
  programmesDuPlafond,
} from './plafond.js';

const SANS_CONTRAINTE = {
  separerOrganisations: false,
  nouveauxVoisins: false,
  nouvelleTable: false,
  varierOrganisations: false,
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
 * l'index de table imposé au tour r, LIBRE pour un tour libre. Les ancrés
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
      if (t === LIBRE) return;
      reservations.push({
        participant: idsAutres[j],
        table: idTable(t),
        portee: 'tour',
        tour: r + 1,
      });
    });
  });
  const instance = normaliser({
    participants: suite(1, K + autres).map((id) => ({ id, nom: `P${id}`, organisation: null })),
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

// Produit dans GF(4), ses éléments écrits 0 à 3, 2 la racine a de
// x² + x + 1 et 3 son carré a² = a + 1 : FOIS_GF4[x][y]. La somme est le ou
// exclusif.
const FOIS_GF4 = [
  [0, 0, 0, 0],
  [0, 1, 2, 3],
  [0, 2, 3, 1],
  [0, 3, 1, 2],
];

// Le plan affine d'ordre 4 : les 16 points de GF(4)², le point (x, y) au
// rang 4x + y, en 5 classes parallèles de 4 blocs de 4 — les droites
// x = c, puis y = mx + c pour chaque pente m. Rend classes[r][b], la liste
// des points du bloc b de la classe r.
function planAffineOrdre4() {
  const quatre = suite(0, 3);
  return [
    quatre.map((c) => quatre.map((y) => 4 * c + y)),
    ...quatre.map((m) => quatre.map((c) => quatre.map((x) => 4 * x + (FOIS_GF4[m][x] ^ c)))),
  ];
}

// Les 24 ordres de 0, 1, 2, 3.
const PERMUTATIONS_4 = (function permuter(reste) {
  if (reste.length === 0) return [[]];
  return reste.flatMap((t) => permuter(reste.filter((u) => u !== t)).map((fin) => [t, ...fin]));
})(suite(0, 3));

/**
 * Énumère les affectations des blocs d'un plan résoluble à 4 tables, une
 * classe par tour : affectation[r][b] est la table du bloc b au tour r. Le
 * premier tour est fixé, bloc b à la table b, puisque renuméroter les tables
 * ne change aucun compte : il reste 24 ordres pour chacun des autres tours.
 * Le compte d'un point est le nombre de tables distinctes qu'il visite.
 * Rend le plus grand minimum de ce compte sur les points, le nombre
 * d'affectations parcourues, et la première affectation qui l'atteint.
 * @param {number[][][]} classes  classes[r][b], les points du bloc b
 * @returns {{meilleur: number, affectations: number, temoin: number[][]}}
 */
function meilleureAffectation(classes) {
  const premier = suite(0, 3);
  const masques = new Array(16).fill(0);
  classes[0].forEach((bloc, t) => {
    for (const p of bloc) masques[p] = 1 << t;
  });
  const bilan = { meilleur: 0, affectations: 0, temoin: null };
  const choix = [premier];
  const descendre = (r, courants) => {
    if (r === classes.length) {
      bilan.affectations += 1;
      const minimum = Math.min(...courants.map((m) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1)));
      if (minimum > bilan.meilleur) Object.assign(bilan, { meilleur: minimum, temoin: [...choix] });
      return;
    }
    for (const ordre of PERMUTATIONS_4) {
      const suivants = courants.slice();
      classes[r].forEach((bloc, b) => {
        for (const p of bloc) suivants[p] |= 1 << ordre[b];
      });
      choix.push(ordre);
      descendre(r + 1, suivants);
      choix.pop();
    }
  };
  descendre(1, masques);
  return bilan;
}

// Plan valide quelconque, que la graine brasse : à chaque tour, chaque
// personne fixée s'assied à sa table ; les autres, dans un ordre brassé,
// prennent tour à tour un siège à la table suivante d'un cycle brassé des
// tables qui en ont encore ; sans siège, une personne va en réserve.
function planBrasse(instance, graine) {
  const { N, T, R, fixe, capacite } = instance;
  const tableDe = new Int32Array(N * R).fill(RESERVE);
  const brassage = (i, r) => ((i + 1) * 2_654_435_761 + (r + 1) * 40_503 + graine * 97) % 1_000_003;
  for (let r = 0; r < R; r += 1) {
    const libres = Int32Array.from(capacite);
    const aPlacer = [];
    for (let p = 0; p < N; p += 1) {
      const t = fixe[p * R + r];
      if (t !== LIBRE) {
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

// Un tour d'un non-ancré : libre (LIBRE) une fois sur deux, fixé sinon à
// l'une des T tables.
const tourDe = (T) => fc.oneof(fc.constant(LIBRE), fc.integer({ min: 0, max: T - 1 }));

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
// d'ancrés. Rend ces comptes ; parStatut associe une valeur de STATUT à son
// compte, et la Map ne sert qu'à retrouver un statut.
function eprouverAccord(arbitraire, parametres) {
  const bilan = { acceptees: 0, parStatut: new Map(), tablesPleines: 0 };
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
      for (const statut of instance.statut) {
        bilan.parStatut.set(statut, (bilan.parStatut.get(statut) ?? 0) + 1);
      }
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

  test('la même instance, réduite au plan affine d’ordre 4 : aucune affectation des blocs aux tables ne sert le pire mobile au-delà de 17 sur 19', () => {
    const { instance, ancres, mobiles } = forme({
      capacites: [5, 5, 5, 5],
      ancres: [1, 1, 1, 1],
      autres: 16,
      tours: 5,
    });
    const classes = planAffineOrdre4();
    // Le réduit est parfait : chacune des 120 paires de points partage un
    // bloc et un seul, et chaque mobile rencontre les 15 autres.
    const paires = new Map();
    for (const bloc of classes.flat()) {
      for (const a of bloc) {
        for (const b of bloc) if (a < b) paires.set(`${a},${b}`, (paires.get(`${a},${b}`) ?? 0) + 1);
      }
    }
    assert.equal(paires.size, 120);
    assert.ok([...paires.values()].every((fois) => fois === 1));
    const { meilleur, affectations, temoin } = meilleureAffectation(classes);
    assert.equal(affectations, 24 ** 4);
    assert.equal(meilleur, 2);
    // Le témoin, assis : l'ancré de la table t à chaque tour, et le point i
    // du plan au rang i des mobiles. Chaque mobile atteint son plafond
    // réalisé, les 15 autres et les ancrés des tables qu'il visite : le pire
    // en visite 2, et reste à 2 de son plafond a priori.
    const idDuPoint = (i) => instance.ids[mobiles[i]];
    const tableDe = planIndexe(
      instance,
      classes.map((classe, r) => {
        const tables = [[], [], [], []];
        classe.forEach((bloc, b) => tables[temoin[r][b]].push(...bloc.map(idDuPoint)));
        return tables.map((ids, t) => [instance.ids[ancres[t][0]], ...ids]);
      }),
    );
    const { rencontres } = mesurer(instance, tableDe);
    const pire = Math.min(...mobiles.map((p) => rencontres[p]));
    assert.equal(pire, 15 + meilleur);
    assert.equal(pire, 17);
    const aPriori = plafondsAPriori(instance);
    const realises = plafondsRealises(instance, tableDe);
    for (const p of mobiles) {
      assert.equal(realises[p], rencontres[p]);
      assert.equal(aPriori[p], 19);
    }
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
    const { instance, partiels, mobiles, ancres } = grandeForme([[29, LIBRE, LIBRE, LIBRE]]);
    const [p] = partiels;
    assert.equal(instance.statut[p], STATUT.PARTIELLEMENT_FIXE);
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

  test('le plafond a priori se mémoïse sur la rangée de la personne, et sur elle seule', () => {
    // Tables d'index 0 et 1 : 8 sièges, v = 7 ; table d'index 2 : 7 sièges,
    // v = 6. Aucun ancré, 24 participants, 2 tours : n_p = 23, N − 1 = 23.
    // Les dix premiers ont pour rangée, index par index :
    //   0 [libre, libre]   1 [1, libre]   2 [1, libre]   3 [libre, libre]
    //   4 [0, 2]           5 à 7 [libre, libre]          8 [0, libre]
    //   9 [2, libre]
    // les suivants sont mobiles. [0, 2] vaut 7 + 6 = 13, [2, libre] 6 + 7 =
    // 13 ; un tour libre prend une table de 8, et toute autre rangée vaut
    // 7 + 7 = 14. Les voisins de 4 et de 8 sont posés pour que [0, 2] et
    // [0, libre] se confondent sous une clé qui lirait, au lieu de la rangée
    // de la personne, la case de la suivante, celle de la précédente ou une
    // case d'un autre rang : l'une recevrait alors le plafond de l'autre.
    const { instance } = forme({
      capacites: [8, 8, 7],
      ancres: [0, 0, 0],
      autres: 24,
      tours: 2,
      partiels: [
        [LIBRE, LIBRE],
        [1, LIBRE],
        [1, LIBRE],
        [LIBRE, LIBRE],
        [0, 2],
        [LIBRE, LIBRE],
        [LIBRE, LIBRE],
        [LIBRE, LIBRE],
        [0, LIBRE],
        [2, LIBRE],
      ],
    });
    const attendu = new Array(24).fill(14);
    attendu[4] = 13;
    attendu[9] = 13;
    assert.deepEqual(instance.ids, suite(1, 24));
    assert.deepEqual(plafondsAPriori(instance), attendu);
    assert.deepEqual(plafondsAPrioriParEnumeration(instance), attendu);
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
      partiels: [[0, LIBRE]],
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
    assert.equal(plafondItineraire(instance, p, [0, RESERVE]), 2);
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
    assert.equal(plafondItineraire(instance, mobiles[0], [RESERVE, RESERVE]), 0);
  });

  test('plafond a priori ≥ plafond réalisé pour chacun, sur trois plans quelconques de chaque forme', () => {
    const formes = [
      forme({ capacites: [5, 5, 5, 5], ancres: [1, 1, 1, 1], autres: 16, tours: 5 }),
      grandeForme(),
      grandeForme([[29, LIBRE, LIBRE, LIBRE], [LIBRE, 30, 30, LIBRE]]),
      forme({ capacites: [3, 3, 3, 3], ancres: [0, 0, 0, 0], autres: 12, tours: 4 }),
      forme({ capacites: [4, 4, 4], ancres: [1, 1, 1], autres: 7, tours: 2 }),
      forme({ capacites: [5, 2], ancres: [0, 2], autres: 3, tours: 2, partiels: [[0, LIBRE]] }),
      // Une place de moins que de participants : chaque plan met quelqu'un
      // en réserve.
      forme({ capacites: [3, 3], ancres: [1, 0], autres: 6, tours: 3, partiels: [[LIBRE, 1, LIBRE]] }),
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

  test('un plan indexé hors forme : plafondsRealises nomme le participant, le tour et la valeur, comme planDepuisIndex', () => {
    // Quatre participants d'identifiants 1 à 4, deux tables, deux tours. La
    // dernière case est celle de l'identifiant 4 au tour 2. La chaîne "-1"
    // n'est pas la réserve : le message la cite entre guillemets, pour
    // qu'elle ne se lise pas comme la valeur qu'elle contient.
    const { instance } = forme({ capacites: [3, 3], ancres: [0, 0], autres: 4, tours: 2 });
    const fautif = [0, 0, 0, 0, 1, 1, 1, '-1'];
    const attendu = {
      name: 'RangeError',
      message: 'plan indexé : participant 4, tour 2, index de table "-1" hors de −1..1',
    };
    assert.throws(() => planDepuisIndex(instance, fautif), attendu);
    assert.throws(() => plafondsRealises(instance, fautif), attendu);
  });

  test('un itinéraire hors forme cite la valeur comme la garde du plan indexé : la chaîne "-1" entre guillemets', () => {
    const { instance } = forme({ capacites: [3, 3], ancres: [0, 0], autres: 4, tours: 2 });
    assert.throws(() => plafondItineraire(instance, 0, [0, '-1']), {
      name: 'RangeError',
      message: 'itinéraire, case 1 : index de table "-1" hors de −1..1',
    });
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

  test("l'énumération visite chaque multiensemble, celui qui répète une table du milieu compris", () => {
    // Tables d'index 0 et 2 : 2 sièges, un ancré, v = 0 ; table d'index 1 :
    // 6 sièges, aucun ancré, v = 5. 20 mobiles, 3 tours : n_p = 19. Le seul
    // meilleur itinéraire d'un mobile passe trois fois par la table 1 :
    // 5 + 5 + 5 = 15. Tout autre multiensemble vaut au plus 1 ancré + 5 + 5
    // = 11 : une énumération qui sauterait {1, 1, 1} — en ne ramenant pas
    // chaque rang qui suit celui qu'elle avance — rendrait 11. Un ancré
    // tient sa table, 1 siège par tour : 3.
    const { instance, ancres } = forme({ capacites: [2, 6, 2], ancres: [1, 0, 1], autres: 20, tours: 3 });
    const attendu = new Array(22).fill(15);
    for (const [p] of [ancres[0], ancres[2]]) attendu[p] = 3;
    assert.deepEqual(plafondsAPrioriParEnumeration(instance), attendu);
    assert.deepEqual(plafondsAPriori(instance), attendu);
  });

  test("à 299 925 multiensembles, sous la limite, l'énumération répond", () => {
    // 774 tables admissibles et 2 tours libres : C(775, 2) = 299 925, sous
    // les 300 000. Le compte avance par 774, puis 774 × 775 / 2 ; un compte
    // qui partirait de 2, ou d'un autre facteur que A − 1 + i, franchirait
    // la limite et refuserait à tort. N − 1 = 1 borne les deux mobiles.
    const { instance } = forme({
      capacites: Array(774).fill(2),
      ancres: Array(774).fill(0),
      autres: 2,
      tours: 2,
    });
    assert.deepEqual(plafondsAPrioriParEnumeration(instance), [1, 1]);
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
    const partiels = parStatut.get(STATUT.PARTIELLEMENT_FIXE) ?? 0;
    const ancres = parStatut.get(STATUT.ANCRE) ?? 0;
    assert.ok(partiels >= 100, `${partiels} partiellement fixés comparés, 100 au moins`);
    assert.ok(ancres >= 100, `${ancres} ancrés comparés, 100 au moins`);
    assert.ok(tablesPleines >= 50, `${tablesPleines} instances à table pleine d'ancrés, 50 au moins`);
  });
});

// Organisations inventées des épreuves de la borne de diversité.
const AUBIER = 'Coopérative Aubier';
const RESSAC = 'Atelier Ressac';
const BRISANT = 'Collectif Brisant';

/**
 * Instance d'une salle aux organisations données. personnes[i] = [id,
 * organisation ou null] ; la table d'index t a la capacité capacites[t] et
 * l'identifiant 10 × (T − t), qu'un index lu comme un identifiant ne désigne
 * pas. reservations : [id, index de table, tour ou null], null pour tous les
 * tours ; exclus : des ids. Lève ce que normaliser lève.
 */
function salle({ personnes, capacites, tours, reservations = [], exclus = [] }) {
  const T = capacites.length;
  const idTable = (t) => 10 * (T - t);
  return normaliser({
    participants: personnes.map(([id, organisation]) => ({
      id,
      nom: `P${id}`,
      organisation,
      ...(exclus.includes(id) ? { exclu: true } : {}),
    })),
    tables: capacites.map((capacite, t) => ({ id: idTable(t), numero: t + 1, capacite })),
    tours,
    reservations: reservations.map(([participant, t, tour]) =>
      tour === null
        ? { participant, table: idTable(t), portee: 'tous' }
        : { participant, table: idTable(t), portee: 'tour', tour },
    ),
    contraintes: SANS_CONTRAINTE,
  });
}

// Vrai quand valeurs est une liste ordinaire, jamais un tableau typé : le
// détail ne rend que des Array (contrainte 42).
const listeOrdinaire = (valeurs) => Array.isArray(valeurs) && !ArrayBuffer.isView(valeurs);

// Les bornes de diversité d'un plan, et ses mesures : A(p) ≤ A_max(p) et
// |F(p)| ≤ Φ_aff(p) pour chacun, que chaque épreuve relit sur ses chiffres.
function bornesEtMesures(instance, tableDe) {
  const bornes = borneDiversite(instance, tableDe);
  const mesures = mesurer(instance, tableDe);
  for (let p = 0; p < instance.N; p += 1) {
    assert.ok(mesures.organisationsVues[p] <= bornes.aMax[p], `A(${instance.ids[p]}) > A_max`);
    assert.ok(mesures.affilies[p] <= bornes.phiAffilies[p], `|F(${instance.ids[p]})| > Φ_aff`);
  }
  return { ...bornes, organisations: mesures.organisationsVues, affilies: mesures.affilies };
}

describe('occupations : o_{t,r} et α_{t,r} (§ 5.4, B4)', () => {
  // Ids 3, 5, 8, 11, 14 aux index 0 à 4 : Aubier, sans, Ressac, Aubier,
  // sans. Deux tables de 3, d'identifiants 20 et 10 ; 14 en réserve au
  // tour 1, 11 au tour 2.
  const instance = salle({
    personnes: [[3, AUBIER], [5, null], [8, RESSAC], [11, AUBIER], [14, null]],
    capacites: [3, 3],
    tours: 2,
  });
  const tableDe = planIndexe(instance, [[[3, 5, 8], [11]], [[3], [5, 8, 14]]], [[14], [11]]);

  test("sans l'option, les occupants seuls, rangés t·R + r ; la réserve n'occupe aucune table", () => {
    const { occupants, affilies } = occupations(instance, tableDe);
    // t0 : 3 puis 1 ; t1 : 1 puis 3.
    assert.deepEqual(occupants, [3, 1, 1, 3]);
    assert.equal(affilies, null);
    assert.ok(listeOrdinaire(occupants));
  });

  test('avec {affilies}, les occupants qui portent une organisation', () => {
    const { occupants, affilies } = occupations(instance, tableDe, { affilies: true });
    // t0 : 3 et 8, puis 3 ; t1 : 11, puis 8 seul (5 et 14 sans organisation).
    assert.deepEqual(occupants, [3, 1, 1, 3]);
    assert.deepEqual(affilies, [2, 1, 1, 1]);
    assert.ok(listeOrdinaire(affilies));
    assert.equal(occupations(instance, tableDe, { affilies: false }).affilies, null);
  });

  test('un plan indexé hors forme lève comme plafondsRealises', () => {
    assert.throws(() => occupations(instance, new Int32Array(9)), RangeError);
    const faux = Int32Array.from(tableDe);
    faux[5] = 2;
    assert.throws(() => occupations(instance, faux, { affilies: true }), /participant 8, tour 2/);
  });
});

describe('borneDiversite : Φ_aff(p) et A_max(p) sur l\u{2019}occupation (§ 5.5, B5, D41)', () => {
  test("tous d'une même organisation : A_max = 1 pour qui rencontre quelqu'un, 0 pour qui ne rencontre personne", () => {
    // Cinq personnes d'Aubier, une table de 4 et une de 2, deux tours : 10
    // est seul à la table de 2 aux deux tours. N_aff = 5, G = 1, g_p = 5 :
    // le troisième terme vaut 1. Pour 2, 4, 6, 8 : 3 sièges par tour, 6 ;
    // n^aff_p = 4 ; Φ_aff = min(4, min(4, 6)) = 4. Pour 10 : 0 siège.
    const instance = salle({
      personnes: [[2, AUBIER], [4, AUBIER], [6, AUBIER], [8, AUBIER], [10, AUBIER]],
      capacites: [4, 2],
      tours: 2,
    });
    const tableDe = planIndexe(instance, [[[2, 4, 6, 8], [10]], [[2, 4, 6, 8], [10]]]);
    const obtenu = bornesEtMesures(instance, tableDe);
    assert.deepEqual(obtenu.phiAffilies, [4, 4, 4, 4, 0]);
    assert.deepEqual(obtenu.aMax, [1, 1, 1, 1, 0]);
    assert.deepEqual(obtenu.organisations, [1, 1, 1, 1, 0]);
    assert.ok(listeOrdinaire(obtenu.phiAffilies) && listeOrdinaire(obtenu.aMax));
  });

  test("Φ_aff l'emporte à une table pauvre en affiliés, G quand on en rencontre beaucoup", () => {
    // Aubier 1, 2, 5 ; Ressac 3, 6 ; Brisant 7, 8 ; 4 sans organisation.
    // Deux tables de 4 : 1, 2, 3, 4 à l'une, 5 à 8 à l'autre. G = 3,
    // N_aff = 7 ; troisième terme 5 pour Aubier, 6 pour les autres.
    const personnes = [[1, AUBIER], [2, AUBIER], [3, RESSAC], [4, null], [5, AUBIER], [6, RESSAC], [7, BRISANT], [8, BRISANT]];
    const listes = [[1, 2, 3, 4], [5, 6, 7, 8]];
    // Un tour : à la première table α = 3, Φ_aff = 3 − 1 = 2 pour 1, 2
    // et 3, sous G = 3 ; 4, sans organisation, n'ôte rien : Φ_aff = 3. À la
    // seconde, α = 4, Φ_aff = 3 pour chacun.
    const unTour = salle({ personnes, capacites: [4, 4], tours: 1 });
    const un = bornesEtMesures(unTour, planIndexe(unTour, [listes]));
    assert.deepEqual(un.phiAffilies, [2, 2, 2, 3, 3, 3, 3, 3]);
    assert.deepEqual(un.aMax, [2, 2, 2, 3, 3, 3, 3, 3]);
    assert.deepEqual(un.organisations, [2, 2, 1, 2, 2, 2, 3, 3]);
    // Deux tours, les mêmes tables : Φ_aff double, plafonné par n^aff_p et
    // N_aff − ε_p ; 5 monte à 6, au-dessus de G = 3 et de son troisième
    // terme 5 : G borne seul.
    const deuxTours = salle({ personnes, capacites: [4, 4], tours: 2 });
    const deux = bornesEtMesures(deuxTours, planIndexe(deuxTours, [listes, listes]));
    assert.deepEqual(deux.phiAffilies, [4, 4, 4, 6, 6, 6, 6, 6]);
    assert.deepEqual(deux.aMax, [3, 3, 3, 3, 3, 3, 3, 3]);
  });

  test('le troisième terme égale G quand chaque autre organisation a une seule personne, sans jamais descendre sous lui', () => {
    // Aubier 1, 2, 3 ; Ressac 4 ; Brisant 5 ; une table de 5, deux tours.
    // N_aff = 5 : pour Aubier, (5 − 3) + 1 = 3 = G ; pour 4 et 5,
    // (5 − 1) + 1 = 5. Φ_aff = min(4, min(4, 8)) = 4 pour chacun.
    // Chaque organisation autre que celle de p compte au moins une
    // personne : N_aff − g_p ≥ G − 1, et le terme ne passe jamais sous G.
    const instance = salle({
      personnes: [[1, AUBIER], [2, AUBIER], [3, AUBIER], [4, RESSAC], [5, BRISANT]],
      capacites: [5],
      tours: 2,
    });
    const obtenu = bornesEtMesures(instance, planIndexe(instance, [[[1, 2, 3, 4, 5]], [[1, 2, 3, 4, 5]]]));
    assert.deepEqual(obtenu.phiAffilies, [4, 4, 4, 4, 4]);
    assert.deepEqual(obtenu.aMax, [3, 3, 3, 3, 3]);
    assert.deepEqual(obtenu.organisations, [3, 3, 3, 2, 2]);
  });

  test('seule de son organisation (g_p = 1), p ne se compte pas parmi les affiliés qu\u{2019}elle rencontre', () => {
    // Ressac 1 seule, avec Aubier 2, 3, 4 à une table de 4 ; Brisant 5 et 6
    // à une table de 2 ; un tour. G = 3, N_aff = 6.
    //   1      α = 4 : Φ_aff = min(5, min(5, 4 − 1)) = 3 ; terme (6 − 1) + 1
    //   2 à 4  Φ_aff = 3, terme (6 − 3) + 1 = 4 ; A_max = 3
    //   5, 6   α = 2 : Φ_aff = 1
    const instance = salle({
      personnes: [[1, RESSAC], [2, AUBIER], [3, AUBIER], [4, AUBIER], [5, BRISANT], [6, BRISANT]],
      capacites: [4, 2],
      tours: 1,
    });
    const obtenu = bornesEtMesures(instance, planIndexe(instance, [[[1, 2, 3, 4], [5, 6]]]));
    assert.deepEqual(obtenu.phiAffilies, [3, 3, 3, 3, 1, 1]);
    assert.deepEqual(obtenu.aMax, [3, 3, 3, 3, 1, 1]);
    assert.deepEqual(obtenu.organisations, [1, 2, 2, 2, 1, 1]);
    assert.deepEqual(obtenu.affilies, [3, 3, 3, 3, 1, 1]);
  });

  test("ancrés affiliés : un par table visitée, une fois ; p ancré ne se compte pas ; un ancré sans organisation n'est pas un affilié", () => {
    // Trois tables de 3, trois tours. 1 (Aubier) ancré à t0, 2 (Ressac) à
    // t1, 9 (sans organisation) à t2 ; mobiles 3, 7 (Aubier), 4 (Ressac),
    // 5, 8 (Brisant), 6 (sans). N_aff = 7, n^aff = 5, G = 3 ; a^aff vaut 1
    // à t0 et t1, 0 à t2.
    const instance = salle({
      personnes: [[1, AUBIER], [2, RESSAC], [3, AUBIER], [4, RESSAC], [5, BRISANT], [6, null], [7, AUBIER], [8, BRISANT], [9, null]],
      capacites: [3, 3, 3],
      tours: 3,
      reservations: [[1, 0, null], [2, 1, null], [9, 2, null]],
    });
    const tableDe = planIndexe(instance, [
      [[1, 3, 4], [2, 5, 6], [9, 7, 8]],
      [[1, 3, 8], [2, 4, 7], [9, 5, 6]],
      [[1, 5, 7], [2, 3, 6], [9, 4, 8]],
    ]);
    // α par tour : t0 3, 3, 3 ; t1 2, 3, 2 ; t2 2, 1, 2.
    //   1  ancré à t0 : a^aff vu 0, sièges 2 + 2 + 2 ; n^aff_p = 5 → 5
    //   2  ancré à t1 : sièges 1 + 2 + 1 = 4 → 4
    //   3  t0, t0, t1 : ancrés 1 + 1 (t0 une fois) ; sièges 1 + 1 + 0 → 4
    //   4  t0, t1, t2 : ancrés 2 ; sièges 1 + 1 + 1 → 5
    //   5  t1, t2, t0 : ancrés 2 ; sièges 0 + 0 + 1 → 3
    //   6  sans organisation, t1, t2, t1 : ancrés 1 ; sièges 1 + 1 + 1 → 4
    //   7  t2, t1, t0 : ancrés 2 ; sièges 1 + 1 + 1 → 5
    //   8  t2, t0, t2 : ancrés 1 ; sièges 1 + 1 + 1 → 4
    //   9  ancré sans organisation à t2 : ancré vu 0, sièges 2 + 1 + 2 → 5
    const obtenu = bornesEtMesures(instance, tableDe);
    assert.deepEqual(obtenu.phiAffilies, [5, 4, 4, 5, 3, 4, 5, 4, 5]);
    assert.deepEqual(obtenu.aMax, [3, 3, 3, 3, 3, 3, 3, 3, 3]);
    // Φ_aff est atteint par 1, 2, 3, 4, 5, 7 et 8.
    assert.deepEqual(obtenu.affilies, [5, 4, 4, 5, 3, 3, 5, 4, 4]);
  });

  test("mobiles affiliés : n^aff_p ne compte pas p, et borne quand les sièges dépassent", () => {
    // 1 (Aubier) ancré à la table de 2 avec 5, sans organisation ; 2
    // (Aubier), 3 et 4 (Ressac) à la table de 5, deux tours. N_aff = 4,
    // n^aff = 3, G = 2.
    //   1     α = 1 à sa table : 0
    //   2..4  sièges 2 + 2 = 4, n^aff_p = 2 : min(3, min(2, 4)) = 2
    //   5     sans organisation, ancré affilié 1 vu, α − a^aff = 0 : 1
    const instance = salle({
      personnes: [[1, AUBIER], [2, AUBIER], [3, RESSAC], [4, RESSAC], [5, null]],
      capacites: [2, 5],
      tours: 2,
      reservations: [[1, 0, null]],
    });
    const obtenu = bornesEtMesures(instance, planIndexe(instance, [[[1, 5], [2, 3, 4]], [[1, 5], [2, 3, 4]]]));
    assert.deepEqual(obtenu.phiAffilies, [0, 2, 2, 2, 1]);
    assert.deepEqual(obtenu.aMax, [0, 2, 2, 2, 1]);
    assert.deepEqual(obtenu.affilies, [0, 2, 2, 2, 1]);
  });

  test("table incomplète : l'occupation, jamais la capacité", () => {
    // Deux tables de 4, occupées par 3 et 2 : Aubier 1, Ressac 2, 3 sans
    // organisation, puis Aubier 4, Ressac 5. G = 2, N_aff = 4. Sur les
    // capacités, Φ_aff de 1 vaudrait 3 ; sur l'occupation, α = 2 : 1.
    const instance = salle({
      personnes: [[1, AUBIER], [2, RESSAC], [3, null], [4, AUBIER], [5, RESSAC]],
      capacites: [4, 4],
      tours: 1,
    });
    const obtenu = bornesEtMesures(instance, planIndexe(instance, [[[1, 2, 3], [4, 5]]]));
    assert.deepEqual(obtenu.phiAffilies, [1, 1, 2, 1, 1]);
    assert.deepEqual(obtenu.aMax, [1, 1, 2, 1, 1]);
  });

  test("personne en réserve : ses tours en réserve n'entrent ni dans son Φ_aff ni dans l'occupation des autres", () => {
    // Aubier 1, 2 ; Ressac 3, 4 ; 5 sans organisation ; deux tables de 3,
    // deux tours ; 1 en réserve au tour 2.
    //   1  tour 1 seul, α = 3 : 2 ; A_max = min(2, 2, 3) = 2
    //   2  α = 3 puis 3 : min(3, min(3, 4)) = 3
    //   3  idem : 3
    //   4  α = 1 (5 sans organisation) puis 3 : 0 + 2 = 2
    //   5  α = 1 puis 0 : 1
    const instance = salle({
      personnes: [[1, AUBIER], [2, AUBIER], [3, RESSAC], [4, RESSAC], [5, null]],
      capacites: [3, 3],
      tours: 2,
    });
    const tableDe = planIndexe(instance, [[[1, 2, 3], [4, 5]], [[2, 3, 4], [5]]], [[], [1]]);
    const obtenu = bornesEtMesures(instance, tableDe);
    assert.deepEqual(obtenu.phiAffilies, [2, 3, 3, 2, 1]);
    assert.deepEqual(obtenu.aMax, [2, 2, 2, 2, 1]);
  });

  test("G compte les organisations des seules personnes présentes : un exclu n'en apporte aucune", () => {
    // Aubier 1, 2, 3 et 4 sans organisation à une table de 4 ; 5, seul de
    // Ressac, exclu. G = 1 : A_max(4) = min(Φ_aff = 3, 1) = 1.
    const instance = salle({
      personnes: [[1, AUBIER], [2, AUBIER], [3, AUBIER], [4, null], [5, RESSAC]],
      capacites: [4],
      tours: 1,
      exclus: [5],
    });
    assert.deepEqual(instance.groupes, [AUBIER]);
    const obtenu = bornesEtMesures(instance, planIndexe(instance, [[[1, 2, 3, 4]]]));
    assert.deepEqual(obtenu.phiAffilies, [2, 2, 2, 3]);
    assert.deepEqual(obtenu.aMax, [1, 1, 1, 1]);
  });

  test('sans aucune organisation, Φ_aff et A_max sont nuls ; un plan hors forme lève', () => {
    const { instance } = forme({ capacites: [3, 3], ancres: [1, 0], autres: 4, tours: 2 });
    const tableDe = planBrasse(instance, 3);
    assert.deepEqual(borneDiversite(instance, tableDe), { phiAffilies: [0, 0, 0, 0, 0], aMax: [0, 0, 0, 0, 0] });
    assert.throws(() => borneDiversite(instance, tableDe.subarray(1)), RangeError);
  });

  test('une salle dont chacun est exclu : N = 0, le plan vide, et chaque fonction rend une liste vide sans lire une case d’une liste vide', () => {
    // Le seul participant est exclu : aucune personne présente, aucune
    // organisation, un plan indexé sans case. Chaque liste vide de
    // l'instance, et le plan, lèvent à la lecture d'un index : une boucle
    // sur les personnes qui tournerait à N = 0 échoue sur sa première
    // lecture, nommée, au lieu de ne jamais finir.
    const brute = salle({ personnes: [[1, AUBIER]], capacites: [3], tours: 2, exclus: [1] });
    assert.equal(brute.N, 0);
    const garder = (liste, nom) => new Proxy(liste, {
      get(cible, cle) {
        if (typeof cle === 'string' && /^\d+$/.test(cle)) throw new RangeError(`lecture de ${nom}[${cle}], liste vide`);
        const valeur = Reflect.get(cible, cle);
        return typeof valeur === 'function' ? valeur.bind(cible) : valeur;
      },
    });
    const instance = { ...brute };
    const gardees = [];
    for (const [nom, valeur] of Object.entries(brute)) {
      if ((Array.isArray(valeur) || ArrayBuffer.isView(valeur)) && valeur.length === 0) {
        instance[nom] = garder(valeur, nom);
        gardees.push(nom);
      }
    }
    assert.ok(['groupe', 'statut', 'fixe', 'ids'].every((nom) => gardees.includes(nom)), gardees.join(', '));
    const tableDe = garder(new Int32Array(0), 'tableDe');
    assert.deepEqual(borneDiversite(instance, tableDe), { phiAffilies: [], aMax: [] });
    assert.deepEqual(plafondsRealises(instance, tableDe), []);
    assert.deepEqual(plafondsAPriori(instance), []);
  });
});

// Instance d'une salle à présences : presences[i] est la présence de la
// personne d'identifiant i + 1, undefined pour tous les tours ; la table
// d'index t a l'identifiant 10 × (t + 1) et la capacité capacites[t] ;
// reservations porte des réservations de portée « tous », [id, index de
// table].
function salleAPresences({ capacites, tours, presences, reservations = [] }) {
  return normaliser({
    participants: presences.map((presence, i) => ({
      id: i + 1,
      nom: `P${i + 1}`,
      organisation: null,
      ...(presence === undefined ? {} : { presence }),
    })),
    tables: capacites.map((capacite, t) => ({ id: 10 * (t + 1), numero: t + 1, capacite })),
    tours,
    reservations: reservations.map(([participant, t]) => ({ participant, table: 10 * (t + 1), portee: 'tous' })),
    contraintes: SANS_CONTRAINTE,
  });
}

describe('plafonds sous la présence par tour : C(p) et n_p^C (§ 5.5)', () => {
  // Deux tables de 3, cinq tours, six personnes : 1 n'est présente qu'au
  // tour 1, 2 aux tours 2 à 5. Elles ne se croisent jamais : C = 4 pour
  // chacune, 5 pour les autres.
  const coPresence = () => salleAPresences({
    capacites: [3, 3],
    tours: 5,
    presences: [[1], [2, 3, 4, 5], undefined, undefined, undefined, undefined],
  });

  test('le plafond se borne aux co-présents : la personne 2 vaut 4, là où N − 1 et n_p diraient 5', () => {
    // 1 : un tour, 2 sièges qui changent d'occupant : min(4, 2) = 2.
    // 2 : quatre tours, 8 sièges, mais 4 co-présents, tous mobiles :
    // min(4, min(4, 8)) = 4. Les autres : 5.
    const instance = coPresence();
    assert.deepEqual(instance.coPresents, Int32Array.from([4, 4, 5, 5, 5, 5]));
    assert.deepEqual(plafondsAPriori(instance), [2, 4, 5, 5, 5, 5]);
    assert.deepEqual(plafondsAPrioriParEnumeration(instance), [2, 4, 5, 5, 5, 5]);
  });

  test('le terme des mobiles est n_p^C : une personne qui ne croise que deux mobiles en rencontre au plus deux', () => {
    // Une table de 4, un ancré présent partout (4), trois tours. 1 n'est
    // présente qu'au tour 1, 2 et 3 qu'au tour 3 : 1 croise l'ancré et
    // aucun mobile, n_p^C = 0 ; 2 croise 3 et l'ancré, n_p^C = 1.
    const instance = salleAPresences({
      capacites: [4, 2],
      tours: 3,
      presences: [[1], [3], [3], undefined],
      reservations: [[4, 0]],
    });
    assert.deepEqual(instance.mobilesCoPresents, Int32Array.from([0, 1, 1, 3]));
    // 1 : min(1, 1 + min(0, 2)) = 1 ; 2 et 3 : min(2, 1 + min(1, 2)) = 2 ;
    // l'ancré : min(3, 0 + min(3, 3 × 3)) = 3.
    assert.deepEqual(plafondsAPriori(instance), [1, 2, 2, 3]);
    assert.deepEqual(plafondsAPrioriParEnumeration(instance), [1, 2, 2, 3]);
  });

  test('n_p^C mord sous C(p) : qui ne visite qu\u{2019}une table d\u{2019}ancré rencontre au plus son ancré et ses mobiles co-présents', () => {
    // Deux tables de 4, deux tours, huit personnes ; 7 est ancré à la table
    // d'index 0, 8 à celle d'index 1. 1 et 2 ne sont présentes qu'au tour 1,
    // 3 à 6 qu'au tour 2. Pour 1 : C = 3 (2, 7 et 8), n_p^C = 1, là où les
    // six mobiles de la salle donneraient n − 1 = 5.
    const instance = salleAPresences({
      capacites: [4, 4],
      tours: 2,
      presences: [[1], [1], [2], [2], [2], [2], undefined, undefined],
      reservations: [[7, 0], [8, 1]],
    });
    assert.deepEqual(instance.coPresents, Int32Array.from([3, 3, 5, 5, 5, 5, 7, 7]));
    assert.deepEqual(instance.mobilesCoPresents, Int32Array.from([1, 1, 3, 3, 3, 3, 6, 6]));
    // 1 assise à la table 0 au tour 1 : un ancré, 4 − 1 − 1 = 2 sièges ;
    // min(3, 1 + min(1, 2)) = 2 : le terme des mobiles mord, C(p) non.
    assert.equal(plafondItineraire(instance, 0, [0, RESERVE]), 2);
    // Assise aussi à la table 1 au tour 2, les deux ancrés comptent :
    // min(3, 2 + min(1, 4)) = 3, et C(p) mord à son tour.
    assert.equal(plafondItineraire(instance, 0, [0, 1]), 3);
    // 1 et 2 : 2 ; 3 à 6 : min(5, 1 + min(3, 2)) = 3 ; 7 et 8, deux tours à
    // leur table, 6 sièges : min(7, 0 + min(6, 6)) = 6.
    assert.deepEqual(plafondsAPriori(instance), [2, 2, 3, 3, 3, 3, 6, 6]);
    assert.deepEqual(plafondsAPrioriParEnumeration(instance), [2, 2, 3, 3, 3, 3, 6, 6]);
  });

  test('deux personnes de même statut et de mêmes tables fixées, présentes à 1 et à 3 tours, ont des plafonds distincts', () => {
    // Deux tables de 3, trois tours. 1 n'est présente qu'au tour 1 : 2 sièges,
    // plafond 2 ; 2 est présente partout : 6 sièges, plafond 5. Une clé de
    // mémoïsation sans le compte des tours libres présents donnerait à l'une
    // le plafond de l'autre.
    const instance = salleAPresences({ capacites: [3, 3], tours: 3, presences: [[1], undefined, undefined, undefined, undefined, undefined] });
    assert.deepEqual(plafondsAPriori(instance), [2, 5, 5, 5, 5, 5]);
    assert.deepEqual(plafondsAPrioriParEnumeration(instance), [2, 5, 5, 5, 5, 5]);
  });

  test('un tour d’absence n’est pas un tour libre : le plafond est celui de l’itinéraire assis au seul tour de présence', () => {
    // Trois tables de 3 et une de 4, trois tours, dix personnes ; 1 n'est
    // présente qu'au tour 1. Sa meilleure table est celle de 4 (index 3).
    const presences = [[1], ...Array(9).fill(undefined)];
    const instance = salleAPresences({ capacites: [3, 3, 3, 4], tours: 3, presences });
    assert.equal(plafondsAPriori(instance)[0], plafondItineraire(instance, 0, [3, RESERVE, RESERVE]));
    assert.equal(plafondsAPriori(instance)[0], 3);
    assert.ok(plafondItineraire(instance, 0, [3, 3, 0]) > 3);
  });

  test('le plafond réalisé ne compte aucun siège à un tour d’absence, et se borne aux co-présents', () => {
    // Le plan de coPresence : au tour 1, 1, 3 et 4 à la table 10, 5 et 6 à
    // 20 ; aux tours 2 à 5, 2, 3 et 4 à 10, 5 et 6 à 20.
    const instance = coPresence();
    const listes = [[[1, 3, 4], [5, 6]], ...Array.from({ length: 4 }, () => [[2, 3, 4], [5, 6]])];
    const tableDe = planIndexe(instance, listes);
    // 1 : un tour à 10, deux sièges : min(4, 2) = 2. 2 : quatre tours à 10,
    // 8 sièges, C = 4 : 4. 3 et 4 : cinq tours à 10, 10 sièges : 5. 5 et
    // 6 : cinq tours à 20, un siège par tour : 5.
    assert.deepEqual(plafondsRealises(instance, tableDe), [2, 4, 5, 5, 5, 5]);
    assert.deepEqual(occupations(instance, tableDe).occupants, [3, 3, 3, 3, 3, 2, 2, 2, 2, 2]);
  });

  test('une signature ne garde ni C(p) ni n_p^C : deux personnes qui ne diffèrent que par eux partagent un programme, et chacune garde son plafond exact', () => {
    // Deux tables de 3, trois tours, six personnes. 1 aux tours 2 et 3, 2
    // aux tours 1 et 2 : même statut, aucune table fixée, deux tours libres
    // présents. 3 et 4 ne sont présentes qu'au tour 1 : 1 ne les croise
    // jamais, C = 3 = n_p^C ; 2 les croise, C = 5. 1 vient avant 2 : un
    // programme calculé pour la première personne de la signature, avec son
    // n_p^C, plafonnerait 2 à 3.
    const instance = salleAPresences({ capacites: [3, 3], tours: 3, presences: [[2, 3], [1, 2], [1], [1], undefined, undefined] });
    assert.deepEqual(instance.coPresents, Int32Array.from([3, 5, 4, 4, 5, 5]));
    // 1 : min(3, min(3, 4)) = 3 ; 2 : min(5, min(5, 4)) = 4 ; 3 et 4 :
    // min(4, 2) = 2 ; 5 et 6 : min(5, 6) = 5.
    assert.deepEqual(plafondsAPriori(instance), [3, 4, 2, 2, 5, 5]);
    assert.deepEqual(plafondsAPrioriParEnumeration(instance), [3, 4, 2, 2, 5, 5]);
    // Trois signatures : deux, un et trois tours libres présents.
    assert.equal(programmesDuPlafond(instance), 3);
  });

  test('sans absence, un programme par signature, comme avant la présence', () => {
    const { instance } = grandeForme();
    // Chacun des 33 ancrés a sa table d'ancrage, donc sa signature ; les 227
    // mobiles en partagent une.
    assert.equal(programmesDuPlafond(instance), 34);
  });
});
