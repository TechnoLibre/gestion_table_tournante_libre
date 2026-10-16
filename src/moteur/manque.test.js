// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du manque et de ce qui s'en lit (§ 5.5, § 12.10). Chaque valeur
// attendue est écrite en clair : recopiée de la spécification, ou comptée à
// la main sur le plan qui la précède, jamais calculée par le module éprouvé.
// Un plan s'écrit par identifiants et passe par normaliser et indexerPlan
// comme un plan enregistré ; ses rencontres et ses plafonds viennent de
// indicateurs.js et de plafond.js, éprouvés à part. Quand une épreuve les
// recopie en clair, ce sont les termes de la ligne de décomposition
// (§ 12.10.5) dont ses chiffres sont les différences.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { CATALOGUE, PLAN_PARFAIT_PETITE } from '../demo/catalogue.js';
import { indexerPlan, normaliser } from './configuration.js';
import { mesurer } from './indicateurs.js';
import {
  borneHaute,
  comparerProfils,
  ecartsAuPlafondAPriori,
  escalierDuManque,
  ecartsItineraire,
  manques,
  minimumAtteint,
  profilManque,
  troisChiffres,
  valeursDistinctes,
} from './manque.js';
import { plafondsAPriori, plafondsRealises } from './plafond.js';

const SANS_CONTRAINTE = {
  separerAppartenances: false,
  nouveauxVoisins: false,
  nouvelleTable: false,
  varierAppartenances: false,
};

// Un chiffre sur trois populations vides (§ 5.4) : null, jamais 0.
const AUCUN = { tous: null, mobiles: null, ancres: null };

// Huit pour chacun des douze participants de la petite démonstration : leur
// plafond a priori (§ 15.3), et leur plafond réalisé sur tout plan qui
// remplit les quatre tables à chaque tour.
const HUIT = Object.freeze(new Array(12).fill(8));

// Ce qui n'est pas une liste, pour les épreuves des gardes : un nombre plutôt
// qu'undefined. Lire undefined.length lève TypeError, garde ou non ; lire
// (8).length rend undefined sans lever, et seule une garde de liste lève
// alors TypeError. L'épreuve échoue donc quand la garde disparaît.
const PAS_UNE_LISTE = 8;

// Fige une valeur et, à toute profondeur, les objets et les tableaux qu'elle
// contient : une écriture du module éprouvé y lève TypeError.
function figer(valeur) {
  if (typeof valeur !== 'object' || valeur === null || ArrayBuffer.isView(valeur)) return valeur;
  for (const element of Object.values(valeur)) figer(element);
  return Object.freeze(valeur);
}

// Participants d'identifiants donnés, sans appartenance.
const sansAppartenance = (ids) => ids.map((id) => ({ id, nom: `P${id}`, appartenance: null }));

// Tables d'identifiant et de numéro 1 à n, n le nombre de capacités.
const tablesDe = (capacites) =>
  capacites.map((capacite, i) => ({ id: i + 1, numero: i + 1, capacite }));

// La petite démonstration (§ 15.3) : douze participants, quatre tables de 3,
// quatre tours, aucune réservation.
const PETITE = normaliser(CATALOGUE.find(({ cle }) => cle === 'petite').construire());

// Le plan parfait, 3 et 4 échangés au tour 1 : 1 retrouve 4 au tour 2, et 3
// retrouve 5 au tour 3. Ces quatre personnes rencontrent 7 personnes, les
// huit autres toujours 8 ; les tables restent pleines, et le plafond réalisé
// vaut 8 pour chacun.
const PLAN_DEGRADE = {
  tables: [1, 2, 3, 4],
  tours: [[[1, 2, 4], [3, 5, 6], [7, 8, 9], [10, 11, 12]], ...PLAN_PARFAIT_PETITE.tours.slice(1)],
  reserves: [[], [], [], []],
};

// Le plan parfait, 1 et 5 échangés au tour 1. 1 y quitte 2 et 3, et 5 y
// quitte 4 et 6, qu'ils ne voient à aucun autre tour. Chacun s'assoit près de
// deux personnes qu'il revoit à un autre tour : 1 près de 4 et 6, revus aux
// tours 2 et 3 ; 5 près de 2 et 3, revus aux tours 2 et 3. 2, 3, 4 et 6
// perdent celui des deux qui quitte leur table, et revoient ailleurs celui
// qui y arrive. Les tables restent pleines, et le plafond réalisé vaut 8 pour
// chacun.
//
//   id           1  2  3  4  5  6  7 à 12
//   rencontres   6  7  7  7  6  7  8
//   manque       2  1  1  1  2  1  0
const PLAN_DEUX_MANQUES = {
  tables: [1, 2, 3, 4],
  tours: [[[2, 3, 5], [1, 4, 6], [7, 8, 9], [10, 11, 12]], ...PLAN_PARFAIT_PETITE.tours.slice(1)],
  reserves: [[], [], [], []],
};

// Deux tables de 3 sièges, quatre tours, six participants sans appartenance.
// 1 est ancré à la table 1 et 2 à la table 2 ; 3, réservé à la table 1 au
// tour 1, est partiellement fixé et compte parmi les mobiles (§ 5.4) ; 4, 5 et
// 6 sont mobiles. 6, assis au seul tour 1, est en réserve ensuite (§ 12.6).
const CONFIGURATION_ANCRAGES = {
  participants: sansAppartenance([1, 2, 3, 4, 5, 6]),
  tables: tablesDe([3, 3]),
  tours: 4,
  reservations: [
    { participant: 1, table: 1, portee: 'tous' },
    { participant: 2, table: 2, portee: 'tous' },
    { participant: 3, table: 1, portee: 'tour', tour: 1 },
  ],
  contraintes: SANS_CONTRAINTE,
};
const ANCRAGES = normaliser(CONFIGURATION_ANCRAGES);
const PLAN_ANCRAGES = {
  tables: [1, 2],
  tours: [
    [[1, 3, 4], [2, 5, 6]],
    [[1, 3, 5], [2, 4]],
    [[1, 4], [2, 3, 5]],
    [[1, 3, 4], [2, 5]],
  ],
  reserves: [[], [6], [6], [6]],
};
// Les termes de PLAN_ANCRAGES, comptés à la main. Occupation des tables 1 et
// 2 : 3 et 3 au tour 1, 3 et 2 au tour 2, 2 et 3 au tour 3, 3 et 2 au tour 4.
// N − 1 = 5 et n = 4 : n_p vaut 4 pour un ancré, 3 pour les autres. Plafond
// réalisé = Σ a_t sur les tables visitées + min(n_p, Σ (o − 1 − a_t) sur les
// tours assis), a_t valant 1 à chaque table, et 0 à la sienne pour un ancré.
//
//   id  rencontrés    rencontres  plafond réalisé            a priori
//   1   3, 4, 5       3           0 + min(4, 2+2+1+2) = 4    4
//   2   3, 4, 5, 6    4           0 + min(4, 2+1+2+1) = 4    4
//   3   1, 2, 4, 5    4           2 + min(3, 1+1+1+1) = 5    5
//   4   1, 2, 3       3           2 + min(3, 1+0+0+1) = 4    5
//   5   1, 2, 3, 6    4           2 + min(3, 1+1+1+0) = 5    5
//   6   2, 5          2           1 + min(3, 1)       = 2    5
//
// Le plafond a priori se lit sur les capacités : 0 + min(4, 4 × 2) pour un
// ancré ; les deux tables visitées, 2 + min(3, 4 × 1), pour les autres.
// Manque = réalisé − rencontres : 1, 0, 1, 1, 1, 0. Écart d'itinéraire = a
// priori − réalisé : 0, 0, 0, 1, 0, 3.
const RENCONTRES_ANCRAGES = [3, 4, 4, 3, 4, 2];
const REALISES_ANCRAGES = [4, 4, 5, 4, 5, 2];
const A_PRIORI_ANCRAGES = [4, 4, 5, 5, 5, 5];

// Quatre participants, deux tables de 3, un tour, deux à chaque table. Chacun
// rencontre la seule personne que sa table lui offre : plafond réalisé 1,
// manque 0. Une table pleine lui en offrait deux : plafond a priori 2, écart
// d'itinéraire 1.
const BAS = normaliser({
  participants: sansAppartenance([1, 2, 3, 4]),
  tables: tablesDe([3, 3]),
  tours: 1,
  reservations: [],
  contraintes: SANS_CONTRAINTE,
});
const PLAN_BAS = { tables: [1, 2], tours: [[[1, 2], [3, 4]]], reserves: [[]] };

// Aucun participant ; le plan n'a aucune case.
const VIDE = normaliser({
  participants: [],
  tables: tablesDe([2]),
  tours: 1,
  reservations: [],
  contraintes: SANS_CONTRAINTE,
});
const PLAN_VIDE = { tables: [1], tours: [[[]]], reserves: [[]] };

// Mesures, plafonds réalisés et plafonds a priori d'un plan par
// identifiants.
function chiffrer(instance, plan) {
  const tableDe = indexerPlan(instance, plan);
  return {
    mesures: mesurer(instance, tableDe),
    realises: plafondsRealises(instance, tableDe),
    aPriori: plafondsAPriori(instance),
  };
}

// Profil de manque d'un plan par identifiants.
function profilDe(instance, plan) {
  const { mesures, realises } = chiffrer(instance, plan);
  return profilManque(instance, manques(realises, mesures.rencontres), realises);
}

// Profil écrit à la main : le manque de chaque rang, le rang 1 d'abord, et
// l'identifiant de la personne à chaque rang, 1 à n par défaut. Le plafond
// réalisé ne départage pas : comparerProfils ne lit que le manque.
const profil = (manquesParRang, ids = manquesParRang.map((_, i) => i + 1)) =>
  manquesParRang.map((manque, i) => ({ id: ids[i], manque, plafondRealise: 10 }));

describe('manques (§ 12.10.2)', () => {
  test('plan parfait de la petite démonstration : douze manques nuls', () => {
    const { mesures, realises } = chiffrer(PETITE, PLAN_PARFAIT_PETITE);
    assert.deepEqual(mesures.rencontres, HUIT);
    assert.deepEqual(realises, HUIT);
    assert.deepEqual(manques(figer(realises), figer(mesures.rencontres)), new Array(12).fill(0));
  });

  test('plan dégradé : un manque de 1 pour les quatre personnes qui perdent une rencontre', () => {
    const { mesures, realises } = chiffrer(PETITE, PLAN_DEGRADE);
    assert.deepEqual(mesures.rencontres, [7, 8, 7, 7, 7, 8, 8, 8, 8, 8, 8, 8]);
    assert.deepEqual(realises, HUIT);
    assert.deepEqual(manques(realises, mesures.rencontres), [1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0]);
  });

  test("ancrés et réserve : plafond réalisé − rencontres, personne par personne", () => {
    const { mesures, realises, aPriori } = chiffrer(ANCRAGES, PLAN_ANCRAGES);
    assert.deepEqual(mesures.rencontres, RENCONTRES_ANCRAGES);
    assert.deepEqual(realises, REALISES_ANCRAGES);
    assert.deepEqual(aPriori, A_PRIORI_ANCRAGES);
    assert.deepEqual(manques(realises, mesures.rencontres), [1, 0, 1, 1, 1, 0]);
    // Les tableaux typés se lisent comme des listes.
    assert.deepEqual(
      manques(Int32Array.from(REALISES_ANCRAGES), Int32Array.from(RENCONTRES_ANCRAGES)),
      [1, 0, 1, 1, 1, 0],
    );
  });

  test('deux listes de longueurs différentes lèvent RangeError', () => {
    assert.throws(() => manques([8, 8], [8]), RangeError);
    assert.throws(() => manques([8], [8, 8]), RangeError);
  });

  test("une valeur qui n'est pas une liste lève TypeError, à l'une ou l'autre place", () => {
    assert.throws(() => manques(PAS_UNE_LISTE, [8]), TypeError);
    assert.throws(() => manques([8], PAS_UNE_LISTE), TypeError);
  });
});

describe('ecartsItineraire (§ 5.5)', () => {
  test('plafond a priori − plafond réalisé, personne par personne', () => {
    const { realises, aPriori } = chiffrer(ANCRAGES, PLAN_ANCRAGES);
    // 4 − 4, 4 − 4, 5 − 5, 5 − 4, 5 − 5, 5 − 2 : 6, en réserve à trois tours,
    // porte l'écart d'itinéraire que son manque nul ne porte pas (§ 12.6).
    assert.deepEqual(ecartsItineraire(figer(aPriori), figer(realises)), [0, 0, 0, 1, 0, 3]);
  });

  test('null quand le plafond a priori est inconnu ; undefined ne passe pas pour inconnu', () => {
    const { realises } = chiffrer(ANCRAGES, PLAN_ANCRAGES);
    assert.equal(ecartsItineraire(null, realises), null);
    assert.throws(() => ecartsItineraire(undefined, realises), TypeError);
  });

  test("un plafond a priori d'une autre longueur lève RangeError ; un nombre seul pour plafonds réalisés, TypeError", () => {
    const { realises } = chiffrer(ANCRAGES, PLAN_ANCRAGES);
    assert.throws(() => ecartsItineraire(A_PRIORI_ANCRAGES.slice(1), realises), RangeError);
    assert.throws(() => ecartsItineraire(null, PAS_UNE_LISTE), TypeError);
  });
});

describe('ecartsAuPlafondAPriori (§ 5.5)', () => {
  test("plafond a priori − rencontres : le manque plus l'écart d'itinéraire, personne par personne", () => {
    const { mesures, aPriori } = chiffrer(ANCRAGES, PLAN_ANCRAGES);
    // 1 + 0, 0 + 0, 1 + 0, 1 + 1, 1 + 0, 0 + 3.
    assert.deepEqual(ecartsAuPlafondAPriori(figer(mesures), figer(aPriori)), [1, 0, 1, 2, 1, 3]);
  });

  test('null quand le plafond a priori est inconnu ; undefined ne passe pas pour inconnu', () => {
    const { mesures } = chiffrer(ANCRAGES, PLAN_ANCRAGES);
    assert.equal(ecartsAuPlafondAPriori(mesures, null), null);
    assert.throws(() => ecartsAuPlafondAPriori(mesures, undefined), TypeError);
  });

  test("un plafond a priori d'une autre longueur que les rencontres lève RangeError", () => {
    const { mesures } = chiffrer(ANCRAGES, PLAN_ANCRAGES);
    assert.throws(() => ecartsAuPlafondAPriori(mesures, [4, 4, 5, 5, 5]), RangeError);
  });

  test('des rencontres qui ne sont pas une liste lèvent TypeError, le plafond a priori connu ou inconnu', () => {
    assert.throws(() => ecartsAuPlafondAPriori({ rencontres: PAS_UNE_LISTE }, A_PRIORI_ANCRAGES), TypeError);
    assert.throws(() => ecartsAuPlafondAPriori({ rencontres: PAS_UNE_LISTE }, null), TypeError);
  });
});

describe('troisChiffres (§ 12.10.4)', () => {
  test('plan parfait de la petite démonstration : 0, un vrai 0, et 0 ; « — » pour les ancrés', () => {
    const { mesures, realises, aPriori } = chiffrer(PETITE, PLAN_PARFAIT_PETITE);
    // Douze personnes mesurées, aucune en manque : l'effectif du manque est un
    // zéro mesuré, non un « — ». Sans réservation, la population des ancrés
    // est vide, et chacun des trois chiffres s'y écrit « — » (§ 15.3).
    assert.deepEqual(troisChiffres(PETITE, figer(mesures), figer(aPriori), figer(realises)), {
      manqueMax: { tous: 0, mobiles: 0, ancres: null },
      effectifManque: { tous: 0, mobiles: 0, ancres: null },
      ecartItineraireMax: { tous: 0, mobiles: 0, ancres: null },
    });
  });

  test('plan dégradé : le plus grand manque vaut 1, et quatre personnes le portent', () => {
    const { mesures, realises, aPriori } = chiffrer(PETITE, PLAN_DEGRADE);
    assert.deepEqual(troisChiffres(PETITE, mesures, aPriori, realises), {
      manqueMax: { tous: 1, mobiles: 1, ancres: null },
      effectifManque: { tous: 4, mobiles: 4, ancres: null },
      ecartItineraireMax: { tous: 0, mobiles: 0, ancres: null },
    });
  });

  test("un manque de 2 : l'effectif compte les personnes, non la somme des manques (§ 12.10.8)", () => {
    const { mesures, realises, aPriori } = chiffrer(PETITE, PLAN_DEUX_MANQUES);
    assert.deepEqual(mesures.rencontres, [6, 7, 7, 7, 6, 7, 8, 8, 8, 8, 8, 8]);
    assert.deepEqual(realises, HUIT);
    // Manques 2, 1, 1, 1, 2, 1, puis six 0 : six personnes en manque, pour
    // une somme de 8.
    assert.deepEqual(troisChiffres(PETITE, mesures, aPriori, realises), {
      manqueMax: { tous: 2, mobiles: 2, ancres: null },
      effectifManque: { tous: 6, mobiles: 6, ancres: null },
      ecartItineraireMax: { tous: 0, mobiles: 0, ancres: null },
    });
  });

  test('le placement du § 12.10.4 : un manque de 13, porté par une seule personne', () => {
    // Chacun atteint un plafond réalisé de 27, sauf une personne qui ne
    // rencontre que 14 : le plus grand manque vaut 13, l'effectif 1.
    // troisChiffres lit des listes, non un plan : celles de l'exemple, écrites
    // à la main sur trois personnes, le plafond a priori inconnu.
    const trois = normaliser({
      participants: sansAppartenance([1, 2, 3]),
      tables: tablesDe([3]),
      tours: 1,
      reservations: [],
      contraintes: SANS_CONTRAINTE,
    });
    assert.deepEqual(troisChiffres(trois, { rencontres: [27, 27, 14] }, null, [27, 27, 27]), {
      manqueMax: { tous: 13, mobiles: 13, ancres: null },
      effectifManque: { tous: 1, mobiles: 1, ancres: null },
      ecartItineraireMax: null,
    });
  });

  test('ancrés, partiellement fixé et réserve : chaque chiffre sur ses trois populations', () => {
    const { mesures, realises, aPriori } = chiffrer(ANCRAGES, PLAN_ANCRAGES);
    // Manque 1, 0, 1, 1, 1, 0 ; écart d'itinéraire 0, 0, 0, 1, 0, 3. Les
    // ancrés sont 1 et 2 ; les mobiles, 3, partiellement fixé, puis 4, 5 et 6.
    // 6, en réserve à trois tours sur quatre, a un manque nul : les deux
    // premiers chiffres ne le voient pas, le troisième le montre (§ 12.10.4).
    assert.deepEqual(troisChiffres(ANCRAGES, mesures, aPriori, realises), {
      manqueMax: { tous: 1, mobiles: 1, ancres: 1 },
      effectifManque: { tous: 4, mobiles: 3, ancres: 1 },
      ecartItineraireMax: { tous: 3, mobiles: 3, ancres: 0 },
    });
  });

  test("plafond a priori inconnu : l'écart d'itinéraire maximal vaut null, les deux autres se mesurent", () => {
    const { mesures, realises } = chiffrer(ANCRAGES, PLAN_ANCRAGES);
    assert.deepEqual(troisChiffres(ANCRAGES, mesures, null, realises), {
      manqueMax: { tous: 1, mobiles: 1, ancres: 1 },
      effectifManque: { tous: 4, mobiles: 3, ancres: 1 },
      ecartItineraireMax: null,
    });
  });

  test("itinéraires bas : aucun manque, et l'écart d'itinéraire le dit (§ 5.5)", () => {
    const { mesures, realises, aPriori } = chiffrer(BAS, PLAN_BAS);
    assert.deepEqual(mesures.rencontres, [1, 1, 1, 1]);
    assert.deepEqual(realises, [1, 1, 1, 1]);
    assert.deepEqual(aPriori, [2, 2, 2, 2]);
    assert.deepEqual(troisChiffres(BAS, mesures, aPriori, realises), {
      manqueMax: { tous: 0, mobiles: 0, ancres: null },
      effectifManque: { tous: 0, mobiles: 0, ancres: null },
      ecartItineraireMax: { tous: 1, mobiles: 1, ancres: null },
    });
  });

  test('population vide : « — » pour chacun des trois chiffres, jamais 0 (§ 5.4)', () => {
    const { mesures, realises, aPriori } = chiffrer(VIDE, PLAN_VIDE);
    assert.deepEqual(aPriori, []);
    assert.deepEqual(troisChiffres(VIDE, mesures, aPriori, realises), {
      manqueMax: AUCUN,
      effectifManque: AUCUN,
      ecartItineraireMax: AUCUN,
    });
  });

  test('une liste sans une case par participant lève RangeError, seule ou avec les deux autres', () => {
    const { mesures, realises, aPriori } = chiffrer(ANCRAGES, PLAN_ANCRAGES);
    const court = (liste) => liste.slice(1);
    assert.throws(() => troisChiffres(ANCRAGES, mesures, aPriori, court(realises)), RangeError);
    assert.throws(() => troisChiffres(ANCRAGES, mesures, court(aPriori), realises), RangeError);
    assert.throws(
      () => troisChiffres(ANCRAGES, { rencontres: court(mesures.rencontres) }, aPriori, realises),
      RangeError,
    );
    // Les trois listes ensemble, mesurées sur une autre population : accordées
    // entre elles, elles passent les gardes de manques et d'ecartsItineraire,
    // qui les comparent l'une à l'autre ; seules celles de troisChiffres les
    // confrontent à l'instance. D'abord une population plus petite d'une
    // personne, puis une proposition mesurée avant l'exclusion de 6 et relue
    // sur l'instance qui l'exclut (§ 9, § 12.6) ; chaque fois l'a priori
    // connu, puis inconnu.
    const plusPetite = { rencontres: court(mesures.rencontres) };
    assert.throws(() => troisChiffres(ANCRAGES, plusPetite, court(aPriori), court(realises)), RangeError);
    assert.throws(() => troisChiffres(ANCRAGES, plusPetite, null, court(realises)), RangeError);
    const sansSix = normaliser({
      ...CONFIGURATION_ANCRAGES,
      participants: CONFIGURATION_ANCRAGES.participants.map((p) => (p.id === 6 ? { ...p, exclu: true } : p)),
    });
    assert.deepEqual(sansSix.ids, [1, 2, 3, 4, 5]);
    assert.throws(() => troisChiffres(sansSix, mesures, aPriori, realises), RangeError);
    assert.throws(() => troisChiffres(sansSix, mesures, null, realises), RangeError);
  });

  test("une valeur qui n'est pas une liste lève TypeError ; un a priori undefined aussi", () => {
    const { mesures, realises, aPriori } = chiffrer(ANCRAGES, PLAN_ANCRAGES);
    assert.throws(() => troisChiffres(ANCRAGES, mesures, aPriori, PAS_UNE_LISTE), TypeError);
    assert.throws(() => troisChiffres(ANCRAGES, { rencontres: PAS_UNE_LISTE }, aPriori, realises), TypeError);
    assert.throws(() => troisChiffres(ANCRAGES, mesures, undefined, realises), TypeError);
  });
});

describe('profilManque (§ 12.10.6)', () => {
  test('manque décroissant, puis plafond réalisé croissant, puis identifiant croissant', () => {
    // Identifiants 10 à 50, reçus dans le désordre ; les listes suivent
    // l'ordre canonique, celui de instance.ids.
    const instance = normaliser({
      participants: sansAppartenance([30, 10, 50, 20, 40]),
      tables: tablesDe([5]),
      tours: 1,
      reservations: [],
      contraintes: SANS_CONTRAINTE,
    });
    assert.deepEqual(instance.ids, [10, 20, 30, 40, 50]);
    //   id               10  20  30  40  50
    //   manque            1   2   1   1   0
    //   plafond réalisé   5   3   4   5   2
    assert.deepEqual(profilManque(instance, figer([1, 2, 1, 1, 0]), figer([5, 3, 4, 5, 2])), [
      { id: 20, manque: 2, plafondRealise: 3 },
      { id: 30, manque: 1, plafondRealise: 4 },
      { id: 10, manque: 1, plafondRealise: 5 },
      { id: 40, manque: 1, plafondRealise: 5 },
      { id: 50, manque: 0, plafondRealise: 2 },
    ]);
  });

  test("plan dégradé : les quatre personnes en manque d'abord, chaque palier par identifiant", () => {
    const ids = profilDe(PETITE, PLAN_DEGRADE).map(({ id }) => id);
    assert.deepEqual(ids, [1, 3, 4, 5, 2, 6, 7, 8, 9, 10, 11, 12]);
  });

  test("une liste sans une case par participant lève RangeError", () => {
    assert.throws(() => profilManque(PETITE, new Array(11).fill(0), HUIT), RangeError);
    assert.throws(() => profilManque(PETITE, new Array(12).fill(0), HUIT.slice(1)), RangeError);
  });
});

// Les plans voisins du plan parfait de la petite démonstration : à un tour,
// deux personnes assises à deux tables différentes échangent leurs places.
// Quatre tours, six paires de tables, neuf échanges par paire : 216 plans.
function voisinsDuParfait() {
  const { tours } = PLAN_PARFAIT_PETITE;
  const voisins = [];
  for (let r = 0; r < tours.length; r += 1) {
    for (let i = 0; i < tours[r].length; i += 1) {
      for (let j = i + 1; j < tours[r].length; j += 1) {
        for (const x of tours[r][i]) {
          for (const y of tours[r][j]) {
            const tour = tours[r].map((liste, t) => {
              if (t === i) return liste.map((id) => (id === x ? y : id));
              if (t === j) return liste.map((id) => (id === y ? x : id));
              return liste;
            });
            voisins.push({
              nom: `${x} et ${y} échangés au tour ${r + 1}`,
              plan: { ...PLAN_PARFAIT_PETITE, tours: tours.map((t, q) => (q === r ? tour : t)) },
            });
          }
        }
      }
    }
  }
  return voisins;
}

// Deux autres plans parfaits : les tours du plan parfait dans l'ordre
// inverse, et chaque tour décalé d'une table. Les rencontres restent les
// mêmes.
const AUTRES_PARFAITS = [
  {
    nom: 'tours inversés',
    plan: { ...PLAN_PARFAIT_PETITE, tours: [...PLAN_PARFAIT_PETITE.tours].reverse() },
  },
  {
    nom: 'tables décalées',
    plan: { ...PLAN_PARFAIT_PETITE, tours: PLAN_PARFAIT_PETITE.tours.map((t) => [...t.slice(1), t[0]]) },
  },
];

// Vrai quand chacun des douze rencontre huit personnes distinctes, compté sur
// les listes du plan sans passer par le moteur. Sur un plan qui remplit les
// quatre tables à chaque tour, le plafond réalisé vaut 8 pour chacun : c'est
// exactement le cas d'un manque nul pour tous.
function chacunRencontreHuit(plan) {
  const rencontres = new Map();
  for (const tour of plan.tours) {
    for (const liste of tour) {
      for (const a of liste) {
        if (!rencontres.has(a)) rencontres.set(a, new Set());
        for (const b of liste) if (b !== a) rencontres.get(a).add(b);
      }
    }
  }
  return rencontres.size === 12 && [...rencontres.values()].every((vus) => vus.size === 8);
}

describe('comparerProfils : dominance de profil (§ 12.10.7)', () => {
  test("petite démonstration : le plan parfait domine tout plan qui n'est pas à manque nul, et rien ne le domine", () => {
    const parfait = profilDe(PETITE, PLAN_PARFAIT_PETITE);
    const concurrents = [...voisinsDuParfait(), ...AUTRES_PARFAITS];
    // Le test refuse de passer sans concurrent, et sans concurrent de chaque
    // sorte (§ 14.2). Un échange retire à la personne déplacée deux voisins
    // qu'elle ne retrouve à aucun autre tour, et l'assoit près d'une personne
    // au moins qu'elle rencontre à un autre tour : elle perd deux rencontres
    // et en gagne une au plus. Aucun voisin n'est donc à manque nul.
    assert.equal(concurrents.length, 218);
    assert.deepEqual(
      concurrents.filter(({ plan }) => chacunRencontreHuit(plan)).map(({ nom }) => nom),
      ['tours inversés', 'tables décalées'],
    );
    const ecarts = concurrents.flatMap(({ nom, plan }) => {
      const autre = profilDe(PETITE, plan);
      const nul = chacunRencontreHuit(plan);
      const lus = [
        ['parfait contre lui', comparerProfils(parfait, autre).domine, nul ? null : 'A'],
        ['lui contre parfait', comparerProfils(autre, parfait).domine, nul ? null : 'B'],
      ];
      return lus
        .filter(([, obtenu, attendu]) => obtenu !== attendu)
        .map(([sens, obtenu, attendu]) => `${nom}, ${sens} : ${obtenu} au lieu de ${attendu}`);
    });
    assert.deepEqual(ecarts, []);
  });

  test('plan parfait contre plan dégradé : quatre rangs à A, huit égalités, aucune bascule', () => {
    const parfait = profilDe(PETITE, PLAN_PARFAIT_PETITE);
    const degrade = profilDe(PETITE, PLAN_DEGRADE);
    assert.deepEqual(comparerProfils(figer(parfait), figer(degrade)), {
      comparable: true,
      rangsA: 4,
      rangsB: 0,
      egalite: 8,
      rangBascule: null,
      domine: 'A',
    });
  });

  test("deux profils tout à zéro ne se dominent pas", () => {
    assert.deepEqual(comparerProfils(profil([0, 0, 0]), profil([0, 0, 0], [3, 2, 1])), {
      comparable: true,
      rangsA: 0,
      rangsB: 0,
      egalite: 3,
      rangBascule: null,
      domine: null,
    });
  });

  test("A domine B quand il sert au moins aussi bien à chaque rang, et mieux à l'un d'eux", () => {
    // Manque de A − manque de B, rang par rang : 0, 0, −1.
    assert.deepEqual(comparerProfils(profil([3, 2, 0]), profil([3, 2, 1], [2, 3, 1])), {
      comparable: true,
      rangsA: 1,
      rangsB: 0,
      egalite: 2,
      rangBascule: null,
      domine: 'A',
    });
    assert.deepEqual(comparerProfils(profil([3, 2, 1], [2, 3, 1]), profil([3, 2, 0])), {
      comparable: true,
      rangsA: 0,
      rangsB: 1,
      egalite: 2,
      rangBascule: null,
      domine: 'B',
    });
  });
});

describe('comparerProfils : rangs et bascule (§ 12.10.6)', () => {
  test("un seul changement de signe : le rang de bascule, premier rang où l'autre sert mieux", () => {
    // −1, −1, +1, +1, 0 : A sert mieux aux rangs 1 et 2, B aux rangs 3 et 4.
    assert.deepEqual(comparerProfils(profil([5, 3, 2, 1, 0]), profil([6, 4, 1, 0, 0], [5, 4, 3, 2, 1])), {
      comparable: true,
      rangsA: 2,
      rangsB: 2,
      egalite: 1,
      rangBascule: 3,
      domine: null,
    });
    // +1, +1, −1 : B sert mieux d'abord, A à partir du rang 3.
    assert.deepEqual(comparerProfils(profil([6, 4, 1]), profil([5, 3, 2])), {
      comparable: true,
      rangsA: 1,
      rangsB: 2,
      egalite: 0,
      rangBascule: 3,
      domine: null,
    });
  });

  test("une égalité au croisement n'est pas un changement de signe", () => {
    // −1, 0, +1, +1 : une seule bascule, au rang 3, où B sert strictement mieux.
    assert.deepEqual(comparerProfils(profil([5, 3, 2, 1]), profil([6, 3, 1, 0])), {
      comparable: true,
      rangsA: 1,
      rangsB: 2,
      egalite: 1,
      rangBascule: 3,
      domine: null,
    });
    // 0, 0, −1, +1 : les égalités de tête ne fixent aucun signe ; bascule au rang 4.
    assert.deepEqual(comparerProfils(profil([4, 3, 1, 1]), profil([4, 3, 2, 0])), {
      comparable: true,
      rangsA: 1,
      rangsB: 1,
      egalite: 2,
      rangBascule: 4,
      domine: null,
    });
  });

  test('deux changements de signe ou plus : aucun rang de bascule (§ 12.6)', () => {
    // −1, +1, −1, 0.
    assert.deepEqual(comparerProfils(profil([4, 3, 1, 0]), profil([5, 2, 2, 0])), {
      comparable: true,
      rangsA: 2,
      rangsB: 1,
      egalite: 1,
      rangBascule: null,
      domine: null,
    });
    // −1, +1, −1, +1.
    assert.deepEqual(comparerProfils(profil([4, 3, 1, 1]), profil([5, 2, 2, 0])), {
      comparable: true,
      rangsA: 2,
      rangsB: 2,
      egalite: 0,
      rangBascule: null,
      domine: null,
    });
  });
});

describe('comparerProfils : populations (§ 12.6)', () => {
  test('populations différentes : { comparable: false }', () => {
    assert.deepEqual(comparerProfils(profil([1, 0, 0]), profil([1, 0, 0], [1, 2, 4])), {
      comparable: false,
    });
    assert.deepEqual(comparerProfils(profil([1, 0, 0]), profil([1, 0])), { comparable: false });
    assert.deepEqual(comparerProfils(profil([1, 0]), profil([1, 0, 0])), { comparable: false });
  });

  test("les mêmes personnes à d'autres rangs restent comparables, et deux profils vides aussi", () => {
    assert.equal(comparerProfils(profil([1, 0, 0]), profil([1, 0, 0], [3, 1, 2])).comparable, true);
    assert.deepEqual(comparerProfils([], []), {
      comparable: true,
      rangsA: 0,
      rangsB: 0,
      egalite: 0,
      rangBascule: null,
      domine: null,
    });
  });
});

describe('minimumAtteint : le certificat du § 5.5', () => {
  test('vrai sur le plan parfait de la petite démonstration', () => {
    const { mesures, aPriori } = chiffrer(PETITE, PLAN_PARFAIT_PETITE);
    assert.deepEqual(aPriori, HUIT);
    assert.equal(minimumAtteint(figer(mesures), figer(aPriori)), true);
  });

  test("faux après l'échange de deux personnes au tour 1, qui crée deux répétitions", () => {
    const { mesures, aPriori } = chiffrer(PETITE, PLAN_DEGRADE);
    assert.equal(mesures.rencontresRepetees.choisies, 2);
    assert.equal(minimumAtteint(mesures, aPriori), false);
  });

  test('se lit contre le plafond a priori, jamais sur le seul manque', () => {
    // Des itinéraires bas : chacun atteint son plafond réalisé, aucun son
    // plafond a priori.
    const { mesures, realises, aPriori } = chiffrer(BAS, PLAN_BAS);
    assert.deepEqual(manques(realises, mesures.rencontres), [0, 0, 0, 0]);
    assert.equal(minimumAtteint(mesures, aPriori), false);
  });

  test('égaler le plafond a priori, non le dépasser : un dépassement ne certifie rien', () => {
    // 9 rencontres pour un plafond a priori de 8 rompent la ligne de
    // décomposition (§ 12.10.5) : un calcul faux, que le certificat ne couvre
    // pas.
    assert.equal(minimumAtteint({ rencontres: [9, 8] }, [8, 8]), false);
  });

  test('null quand le plafond a priori est inconnu, et sur une population vide', () => {
    assert.equal(minimumAtteint(chiffrer(PETITE, PLAN_PARFAIT_PETITE).mesures, null), null);
    const { mesures, aPriori } = chiffrer(VIDE, PLAN_VIDE);
    assert.equal(minimumAtteint(mesures, aPriori), null);
  });

  test("un a priori undefined lève TypeError ; d'une autre longueur, RangeError", () => {
    const { mesures } = chiffrer(PETITE, PLAN_PARFAIT_PETITE);
    assert.throws(() => minimumAtteint(mesures, undefined), TypeError);
    assert.throws(() => minimumAtteint(mesures, HUIT.slice(1)), RangeError);
  });

  test('des rencontres qui ne sont pas une liste lèvent TypeError, le plafond a priori connu ou inconnu', () => {
    assert.throws(() => minimumAtteint({ rencontres: PAS_UNE_LISTE }, HUIT), TypeError);
    assert.throws(() => minimumAtteint({ rencontres: PAS_UNE_LISTE }, null), TypeError);
  });
});

// Deux profils écrits à la main, à trous : A prend les valeurs 5, 2 et 0, B
// les valeurs 3, 1 et 0. Ni 4 ni l'une des valeurs de l'autre n'est commune
// aux deux, hors 0 : les cinq valeurs réunies sont 0, 1, 2, 3 et 5.
const A_TROUS = profil([5, 2, 2, 0]);
const B_TROUS = profil([3, 3, 1, 0], [4, 3, 2, 1]);

describe('escalierDuManque (§ 12.10.6, D61, C20)', () => {
  test('rouge : l’effectif cumulé d’une ligne est le dernier rang où la courbe atteint sa valeur', () => {
    // Une ligne par entier de 5 à 0, 4 compris, qu'aucun profil ne prend.
    // effectif : les rangs de manque égal à la valeur ; cumul : les rangs de
    // manque au moins égal, comptés à la main sur chaque profil.
    assert.deepEqual(escalierDuManque(A_TROUS, B_TROUS), [
      { valeur: 5, a: { effectif: 1, cumul: 1 }, b: { effectif: 0, cumul: 0 } },
      { valeur: 4, a: { effectif: 0, cumul: 1 }, b: { effectif: 0, cumul: 0 } },
      { valeur: 3, a: { effectif: 0, cumul: 1 }, b: { effectif: 2, cumul: 2 } },
      { valeur: 2, a: { effectif: 2, cumul: 3 }, b: { effectif: 0, cumul: 2 } },
      { valeur: 1, a: { effectif: 0, cumul: 3 }, b: { effectif: 1, cumul: 3 } },
      { valeur: 0, a: { effectif: 1, cumul: 4 }, b: { effectif: 1, cumul: 4 } },
    ]);
  });

  test('le cumul de chaque ligne recoupe la courbe : le dernier rang, compté de 1, dont le manque atteint la valeur', () => {
    const dernierRang = (profilLu, valeur) => {
      let rang = 0;
      profilLu.forEach(({ manque }, i) => {
        if (manque >= valeur) rang = i + 1;
      });
      return rang;
    };
    for (const { valeur, a, b } of escalierDuManque(A_TROUS, B_TROUS)) {
      assert.equal(a.cumul, dernierRang(A_TROUS, valeur), `A, ${valeur}`);
      assert.equal(b.cumul, dernierRang(B_TROUS, valeur), `B, ${valeur}`);
    }
  });

  test('la plus grande valeur des deux ouvre l’escalier, qu’elle soit à A ou à B ; l’ordre des arguments ne fait qu’échanger les colonnes', () => {
    const inverse = escalierDuManque(B_TROUS, A_TROUS);
    assert.deepEqual(
      inverse.map(({ valeur }) => valeur),
      [5, 4, 3, 2, 1, 0],
    );
    assert.deepEqual(
      inverse.map(({ valeur, a, b }) => ({ valeur, a: b, b: a })),
      escalierDuManque(A_TROUS, B_TROUS),
    );
  });

  test('manques tous nuls : une seule ligne, 0, qui porte chaque rang', () => {
    assert.deepEqual(escalierDuManque(profil([0, 0, 0]), profil([0, 0, 0])), [
      { valeur: 0, a: { effectif: 3, cumul: 3 }, b: { effectif: 3, cumul: 3 } },
    ]);
  });

  test('deux profils vides : la ligne 0, sans rang', () => {
    assert.deepEqual(escalierDuManque([], []), [{ valeur: 0, a: { effectif: 0, cumul: 0 }, b: { effectif: 0, cumul: 0 } }]);
  });

  test('ne modifie pas les profils reçus', () => {
    assert.doesNotThrow(() => escalierDuManque(figer(profil([2, 1, 0])), figer(profil([1, 1, 0]))));
  });

  test('un profil qui n’est pas une liste lève TypeError ; un manque négatif ou non entier, RangeError', () => {
    assert.throws(() => escalierDuManque(PAS_UNE_LISTE, A_TROUS), TypeError);
    assert.throws(() => escalierDuManque(A_TROUS, PAS_UNE_LISTE), TypeError);
    assert.throws(() => escalierDuManque(profil([1, -1]), A_TROUS), RangeError);
    assert.throws(() => escalierDuManque(A_TROUS, profil([1.5, 0])), RangeError);
  });
});

describe('valeursDistinctes (§ 12.6, D62)', () => {
  test('rouge : les valeurs des deux profils réunis, chacune comptée une fois', () => {
    assert.equal(valeursDistinctes(A_TROUS, B_TROUS), 5);
    // 2 et 0 pour A, 1 et 0 pour B : trois valeurs réunies, deux pour chaque
    // profil, quatre en les ajoutant.
    assert.equal(valeursDistinctes(profil([2, 0]), profil([1, 0])), 3);
    assert.equal(valeursDistinctes(profil([1, 0]), profil([1, 0])), 2);
  });

  test('manques tous nuls : une valeur ; deux profils vides : aucune', () => {
    assert.equal(valeursDistinctes(profil([0, 0]), profil([0, 0])), 1);
    assert.equal(valeursDistinctes([], []), 0);
  });
});

describe('borneHaute (§ 12.10.4, § 12.10.6, D60, C19)', () => {
  test('rouge : le plus grand des deux manques maximaux, au moins 1', () => {
    assert.equal(borneHaute(A_TROUS, B_TROUS), 5);
    assert.equal(borneHaute(B_TROUS, A_TROUS), 5);
    assert.equal(borneHaute(profil([0, 0]), profil([2, 0])), 2);
    assert.equal(borneHaute(profil([0, 0]), profil([0, 0])), 1);
    assert.equal(borneHaute([], []), 1);
  });
});
