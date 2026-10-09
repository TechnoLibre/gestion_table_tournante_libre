// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves des indicateurs (§ 5.4, § 12.6, § 14.10). Chaque valeur attendue
// est écrite en clair : recopiée de la spécification, ou comptée à la main
// sur le plan qui la précède, jamais calculée par le module éprouvé. Un plan
// s'écrit par identifiants, une liste par table, et passe par normaliser et
// indexerPlan comme un plan enregistré.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { indexerPlan, normaliser } from './configuration.js';
import { mesurer, parcourirTours } from './indicateurs.js';

const SANS_CONTRAINTE = {
  separerAppartenances: false,
  nouveauxVoisins: false,
  nouvelleTable: false,
  varierAppartenances: false,
};

const tous = (participant, table) => ({ participant, table, portee: 'tous' });
const auTour = (participant, table, tour) => ({ participant, table, portee: 'tour', tour });

// Agrégat d'une population vide.
const AUCUN = { min: null, moyenne: null, effectif: 0 };

// Appartenances des participants 1..N : le libellé du groupe qui contient
// l'identifiant, null hors de tout groupe. groupes est une liste de couples
// [libellé, identifiants].
function appartenances(N, groupes) {
  return Array.from({ length: N }, (_, i) => {
    const groupe = groupes.find(([, membres]) => membres.includes(i + 1));
    return groupe === undefined ? null : groupe[0];
  });
}

// Instance et plan indexé d'un plan écrit par identifiants. Le participant
// i + 1 porte appartenance[i] ; les tables portent les identifiants 1..T,
// toutes de la capacité donnée ; tours[r][i] liste les participants assis à
// la table i + 1 au tour r + 1, et reserves[r] ceux qui n'y sont assis nulle
// part.
function preparer({
  appartenance,
  capacite,
  tours,
  reserves = tours.map(() => []),
  reservations = [],
}) {
  const participants = appartenance.map((libelle, i) => ({
    id: i + 1,
    nom: `P${i + 1}`,
    appartenance: libelle,
  }));
  const tables = tours[0].map((_, i) => ({ id: i + 1, numero: i + 1, capacite }));
  const instance = normaliser({
    participants,
    tables,
    tours: tours.length,
    reservations,
    contraintes: SANS_CONTRAINTE,
  });
  const plan = { tables: tables.map(({ id }) => id), tours, reserves };
  return { instance, tableDe: indexerPlan(instance, plan) };
}

function mesurerPlan(description) {
  const { instance, tableDe } = preparer(description);
  return mesurer(instance, tableDe);
}

// Plan parfait de la petite démonstration (§ 15.3) : quatre tables de trois
// sièges, quatre tours, chaque table réunit à chaque tour un membre de A, de
// B et de C.
const PLAN_PARFAIT = [
  [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]],
  [[6, 9, 12], [3, 8, 11], [2, 5, 10], [1, 4, 7]],
  [[4, 8, 10], [2, 7, 12], [1, 6, 11], [3, 5, 9]],
  [[5, 7, 11], [1, 9, 10], [3, 4, 12], [2, 6, 8]],
];
const PETITE = appartenances(12, [
  ['A', [1, 5, 8, 12]],
  ['B', [2, 4, 9, 11]],
  ['C', [3, 6, 7, 10]],
]);
// Variante « conflit inévitable » : 10 passe de C à A.
const VARIANTE = appartenances(12, [
  ['A', [1, 5, 8, 10, 12]],
  ['B', [2, 4, 9, 11]],
  ['C', [3, 6, 7]],
]);

// Trois tables de trois sièges, quatre tours. 1 est ancré à la table 1 ; 2
// est mobile ; 3, réservé à la table 2 au tour 3, et 4, réservé à la table 3
// aux tours 1 et 3, sont partiellement fixés. Chaque réservation est tenue.
const PLAN_RESERVATIONS = {
  appartenance: [null, null, null, null],
  capacite: 3,
  tours: [
    [[1], [2, 3], [4]],
    [[1, 3], [], [2, 4]],
    [[1, 2], [3], [4]],
    [[1, 4], [2], [3]],
  ],
  reservations: [tous(1, 1), auTour(3, 2, 3), auTour(4, 3, 1), auTour(4, 3, 3)],
};

// Deux ancrés à la table 1, seule table, quatre tours.
const DEUX_ANCRES = {
  appartenance: [null, null],
  capacite: 2,
  tours: [[[1, 2]], [[1, 2]], [[1, 2]], [[1, 2]]],
  reservations: [tous(1, 1), tous(2, 1)],
};

describe('mesurer', () => {
  test('plan parfait de la petite démonstration : huit rencontres chacun, ni collision ni répétition', () => {
    // Aucun retour : chacun visite les quatre tables. Sans réservation, la
    // population des ancrés est vide.
    assert.deepEqual(mesurerPlan({ appartenance: PETITE, capacite: 3, tours: PLAN_PARFAIT }), {
      rencontres: new Array(12).fill(8),
      affilies: new Array(12).fill(8),
      appartenancesVues: new Array(12).fill(2),
      redondance: new Array(12).fill(6),
      diversite: new Array(12).fill(0.25),
      toursAssis: new Array(12).fill(4),
      retoursChoisis: new Array(12).fill(0),
      retoursImposes: new Array(12).fill(0),
      aggRencontres: {
        tous: { min: 8, moyenne: 8, effectif: 12 },
        mobiles: { min: 8, moyenne: 8, effectif: 12 },
        ancres: AUCUN,
      },
      aggRedondance: {
        tous: { min: 6, moyenne: 6, effectif: 12 },
        mobiles: { min: 6, moyenne: 6, effectif: 12 },
        ancres: AUCUN,
      },
      // Chacun croise deux appartenances, la sienne exclue : A(p) = 2 pour
      // huit affiliés rencontrés, d(p) = 2 / 8.
      aggAppartenancesVues: {
        tous: { min: 2, moyenne: 2, effectif: 12 },
        mobiles: { min: 2, moyenne: 2, effectif: 12 },
        ancres: AUCUN,
      },
      aggDiversite: {
        tous: { min: 0.25, moyenne: 0.25, effectif: 12 },
        mobiles: { min: 0.25, moyenne: 0.25, effectif: 12 },
        ancres: AUCUN,
      },
      totalRedondance: 72,
      collisionsCumulees: 0,
      pairesDistinctes: 0,
      excedentCollisions: 0,
      rencontresRepetees: { choisies: 0, imposees: 0 },
      maxRencontresPaire: 1,
      totalRetoursChoisis: 0,
      totalRetoursImposes: 0,
      parGroupe: [
        { groupe: 'A', effectif: 4, collisionsCumulees: 0, pairesDistinctes: 0, excedent: 0 },
        { groupe: 'B', effectif: 4, collisionsCumulees: 0, pairesDistinctes: 0, excedent: 0 },
        { groupe: 'C', effectif: 4, collisionsCumulees: 0, pairesDistinctes: 0, excedent: 0 },
      ],
    });
  });

  test('variante 5, 4, 3 : quatre collisions cumulées sur quatre paires distinctes, excédent nul', () => {
    const mesures = mesurerPlan({ appartenance: VARIANTE, capacite: 3, tours: PLAN_PARFAIT });
    const { collisionsCumulees, pairesDistinctes, excedentCollisions } = mesures;
    assert.deepEqual(
      { collisionsCumulees, pairesDistinctes, excedentCollisions },
      { collisionsCumulees: 4, pairesDistinctes: 4, excedentCollisions: 0 },
    );
    assert.deepEqual(mesures.parGroupe, [
      { groupe: 'A', effectif: 5, collisionsCumulees: 4, pairesDistinctes: 4, excedent: 0 },
      { groupe: 'B', effectif: 4, collisionsCumulees: 0, pairesDistinctes: 0, excedent: 0 },
      { groupe: 'C', effectif: 3, collisionsCumulees: 0, pairesDistinctes: 0, excedent: 0 },
    ]);
    // 1, 5, 8 et 12 croisent chacun 10, leur collègue : A(p) compte leur
    // propre appartenance avec les deux autres. 10 croise A et B, jamais C.
    assert.deepEqual(mesures.appartenancesVues, [3, 2, 2, 2, 3, 2, 2, 3, 2, 2, 2, 3]);
  });

  test("l'excédent compte les retrouvailles de collègues au-delà de la première", () => {
    // Deux tables de quatre, trois tours ; X = {1, 2, 3, 4}, les autres sans
    // appartenance.
    const appartenance = appartenances(8, [['X', [1, 2, 3, 4]]]);
    const collisions = ({ collisionsCumulees, pairesDistinctes, excedentCollisions, parGroupe }) => ({
      collisionsCumulees,
      pairesDistinctes,
      excedentCollisions,
      parGroupe,
    });
    const reparti = mesurerPlan({
      appartenance,
      capacite: 4,
      tours: [
        [[1, 2, 5, 6], [3, 4, 7, 8]],
        [[1, 3, 5, 7], [2, 4, 6, 8]],
        [[1, 4, 5, 8], [2, 3, 6, 7]],
      ],
    });
    assert.deepEqual(collisions(reparti), {
      collisionsCumulees: 6,
      pairesDistinctes: 6,
      excedentCollisions: 0,
      parGroupe: [{ groupe: 'X', effectif: 4, collisionsCumulees: 6, pairesDistinctes: 6, excedent: 0 }],
    });
    // 5 et 6, puis 7 et 8, se retrouvent aussi à chaque tour : deux personnes
    // sans appartenance ne sont pas des collègues.
    const concentre = mesurerPlan({
      appartenance,
      capacite: 4,
      tours: [
        [[1, 2, 5, 6], [3, 4, 7, 8]],
        [[1, 2, 5, 6], [3, 4, 7, 8]],
        [[1, 2, 5, 6], [3, 4, 7, 8]],
      ],
    });
    assert.deepEqual(collisions(concentre), {
      collisionsCumulees: 6,
      pairesDistinctes: 2,
      excedentCollisions: 4,
      parGroupe: [{ groupe: 'X', effectif: 4, collisionsCumulees: 6, pairesDistinctes: 2, excedent: 4 }],
    });
  });

  test("une table vide et une table à un seul occupant n'ajoutent aucune paire ni aucune rencontre de soi", () => {
    // Au tour 1, la table 3 est vide, 4 et 5 sont seuls à leur table. Au
    // tour 2, 5 l'est encore, et la table 1 est vide.
    const mesures = mesurerPlan({
      appartenance: ['X', 'X', 'Y', 'X', null],
      capacite: 3,
      tours: [
        [[1, 2, 3], [4], [], [5]],
        [[], [1, 4], [2, 3], [5]],
      ],
    });
    assert.deepEqual(mesures.rencontres, [3, 2, 2, 1, 0]);
    assert.deepEqual(mesures.affilies, [3, 2, 2, 1, 0]);
    assert.deepEqual(mesures.appartenancesVues, [2, 2, 1, 1, 0]);
    assert.deepEqual(mesures.redondance, [1, 0, 1, 0, 0]);
    // 5 ne rencontre personne : son taux de diversité n'a pas de diviseur.
    assert.deepEqual(mesures.diversite, [2 / 3, 1, 1 / 2, 1, null]);
    // (1, 2) au tour 1 et (1, 4) au tour 2 ; 4, seul de X à sa table au tour
    // 1, ne s'y croise pas lui-même.
    assert.equal(mesures.collisionsCumulees, 2);
    // (2, 3), réunis aux deux tours, est la seule paire répétée.
    assert.equal(mesures.maxRencontresPaire, 2);
    assert.deepEqual(mesures.rencontresRepetees, { choisies: 1, imposees: 0 });
  });

  test('totalRedondance somme r(p) sur les personnes, et non son plus grand', () => {
    // Le plan de l'épreuve précédente : r(p) vaut 1, 0, 1, 0 et 0. Le total
    // est le seul Σ r(p) du moteur ; la recherche et le classement le lisent.
    const mesures = mesurerPlan({
      appartenance: ['X', 'X', 'Y', 'X', null],
      capacite: 3,
      tours: [
        [[1, 2, 3], [4], [], [5]],
        [[], [1, 4], [2, 3], [5]],
      ],
    });
    assert.deepEqual(mesures.redondance, [1, 0, 1, 0, 0]);
    assert.equal(mesures.totalRedondance, 2);
  });

  test("F(p) ne retient que les affiliés : qui ne croise aucun affilié n'a pas de taux de diversité", () => {
    // 3, seul affilié de la table, rencontre deux personnes sans
    // appartenance ; chacune d'elles rencontre un seul affilié, 3.
    const mesures = mesurerPlan({ appartenance: [null, null, 'X'], capacite: 3, tours: [[[1, 2, 3]]] });
    assert.deepEqual(mesures.rencontres, [2, 2, 2]);
    assert.deepEqual(mesures.affilies, [1, 1, 0]);
    assert.deepEqual(mesures.appartenancesVues, [1, 1, 0]);
    assert.deepEqual(mesures.diversite, [1, 1, null]);
    // La redondance se lit sur les affiliés rencontrés, |F(p)| − A(p), et non
    // sur toutes les rencontres : personne ne recroise une appartenance.
    assert.deepEqual(mesures.redondance, [0, 0, 0]);
    assert.deepEqual(mesures.aggRedondance, {
      tous: { min: 0, moyenne: 0, effectif: 3 },
      mobiles: { min: 0, moyenne: 0, effectif: 3 },
      ancres: AUCUN,
    });
    // A(p) se replie sur chacun ; d(p) sur les seuls qui rencontrent un
    // affilié : 3 sort de l'effectif, et son null n'entre ni dans le minimum
    // ni dans la moyenne.
    assert.deepEqual(mesures.aggAppartenancesVues, {
      tous: { min: 0, moyenne: 2 / 3, effectif: 3 },
      mobiles: { min: 0, moyenne: 2 / 3, effectif: 3 },
      ancres: AUCUN,
    });
    assert.deepEqual(mesures.aggDiversite, {
      tous: { min: 1, moyenne: 1, effectif: 2 },
      mobiles: { min: 1, moyenne: 1, effectif: 2 },
      ancres: AUCUN,
    });
  });

  test("le taux de diversité se replie par population : des mobiles qui ne croisent aucun affilié laissent leur ligne vide", () => {
    // 1 et 2, sans appartenance, sont ancrés à la table 1 ; 3 et 4, de X et
    // de Y, mobiles, la visitent tour à tour. 1 et 2 rencontrent chacun 3 et
    // 4 : d = 2 / 2. 3 rencontre 1 et 2, sans appartenance, au tour 1, puis
    // personne : il sort de l'effectif ; de même 4.
    const mesures = mesurerPlan({
      appartenance: [null, null, 'X', 'Y'],
      capacite: 3,
      tours: [
        [[1, 2, 3], [4]],
        [[1, 2, 4], [3]],
      ],
      reservations: [tous(1, 1), tous(2, 1)],
    });
    assert.deepEqual(mesures.diversite, [1, 1, null, null]);
    assert.deepEqual(mesures.aggDiversite, {
      tous: { min: 1, moyenne: 1, effectif: 2 },
      mobiles: AUCUN,
      ancres: { min: 1, moyenne: 1, effectif: 2 },
    });
    assert.deepEqual(mesures.aggAppartenancesVues, {
      tous: { min: 0, moyenne: 1, effectif: 4 },
      mobiles: { min: 0, moyenne: 0, effectif: 2 },
      ancres: { min: 2, moyenne: 2, effectif: 2 },
    });
  });

  test("la réserve n'est pas une table : seuls les tours assis comptent", () => {
    // 6 est en réserve aux tours 1 et 2, 5 au tour 2. Ils partagent
    // l'appartenance X et ne sont jamais assis ensemble.
    const mesures = mesurerPlan({
      appartenance: [null, null, null, null, 'X', 'X'],
      capacite: 3,
      tours: [
        [[1, 2, 5], [3, 4]],
        [[1, 3], [2, 4]],
        [[1, 4, 6], [2, 3, 5]],
      ],
      reserves: [[6], [5, 6], []],
    });
    assert.deepEqual(mesures.toursAssis, [3, 3, 3, 3, 2, 1]);
    assert.deepEqual(mesures.rencontres, [5, 4, 4, 4, 3, 2]);
    assert.equal(mesures.collisionsCumulees, 0);
    // Deux passages en réserve ne font pas un retour.
    assert.deepEqual(mesures.retoursChoisis, [2, 1, 1, 1, 0, 0]);
    // Une personne en réserve à un tour reste dans les agrégats.
    assert.deepEqual(mesures.aggRencontres.tous, { min: 2, moyenne: 22 / 6, effectif: 6 });
  });

  test('les retours imposés par les réservations se comptent à part des retours choisis', () => {
    // 1 visite quatre fois la table 1, réservée à chaque tour : trois retours
    // imposés. 2 visite deux fois la table 2, sans réservation : un retour
    // choisi. 3 est placé à la table 2 au tour 1, puis y revient au tour 3 où
    // il y est réservé : un retour choisi. 4 visite trois fois la table 3,
    // dont deux réservées : un retour imposé et un choisi.
    const mesures = mesurerPlan(PLAN_RESERVATIONS);
    assert.deepEqual(mesures.retoursImposes, [3, 0, 0, 1]);
    assert.deepEqual(mesures.retoursChoisis, [0, 1, 1, 1]);
    assert.equal(mesures.totalRetoursImposes, 4);
    assert.equal(mesures.totalRetoursChoisis, 3);
  });

  test('les agrégats portent sur tous et rangent les partiellement fixés parmi les mobiles', () => {
    // 1 est ancré, 2 mobile, 3 et 4 partiellement fixés.
    const mesures = mesurerPlan(PLAN_RESERVATIONS);
    assert.deepEqual(mesures.rencontres, [3, 3, 2, 2]);
    assert.deepEqual(mesures.aggRencontres, {
      tous: { min: 2, moyenne: 10 / 4, effectif: 4 },
      mobiles: { min: 2, moyenne: 7 / 3, effectif: 3 },
      ancres: { min: 3, moyenne: 3, effectif: 1 },
    });
  });

  test("le minimum d'une population est sa plus petite valeur, où qu'elle se trouve dans l'ordre des personnes", () => {
    // 1 seul à la table 1 ; 2, 3 et 4 ensemble à la table 2. Le plus petit
    // nombre de rencontres est celui de la première personne : un minimum
    // qui retiendrait la dernière valeur lue rendrait 2.
    const mesures = mesurerPlan({
      appartenance: [null, null, null, null],
      capacite: 3,
      tours: [[[1], [2, 3, 4]]],
    });
    assert.deepEqual(mesures.rencontres, [0, 2, 2, 2]);
    assert.deepEqual(mesures.aggRencontres, {
      tous: { min: 0, moyenne: 6 / 4, effectif: 4 },
      mobiles: { min: 0, moyenne: 6 / 4, effectif: 4 },
      ancres: AUCUN,
    });
  });

  test('une population vide rend null, jamais 0 ni Infinity', () => {
    const sansAncre = mesurerPlan({ appartenance: PETITE, capacite: 3, tours: PLAN_PARFAIT });
    assert.deepEqual(sansAncre.aggRencontres.ancres, AUCUN);
    assert.deepEqual(sansAncre.aggRedondance.ancres, AUCUN);
    const sansMobile = mesurerPlan(DEUX_ANCRES);
    assert.deepEqual(sansMobile.aggRencontres.mobiles, AUCUN);
    assert.deepEqual(sansMobile.aggRedondance.mobiles, AUCUN);
  });

  test('deux ancrés à la même table : une rencontre répétée, imposée et non choisie', () => {
    const mesures = mesurerPlan(DEUX_ANCRES);
    assert.deepEqual(mesures.rencontresRepetees, { choisies: 0, imposees: 1 });
    assert.equal(mesures.maxRencontresPaire, 4);
    assert.deepEqual(mesures.retoursImposes, [3, 3]);
    assert.deepEqual(mesures.retoursChoisis, [0, 0]);
  });

  test('une seule rencontre hors réservation rend la répétition choisie', () => {
    // 1 et 2 sont ancrés à la table 1 ; 3 y est réservé au seul tour 1 et y
    // reste au tour 2 ; 4 est mobile. (1, 2) se réunit quatre fois, chaque
    // fois réservés tous deux ; (1, 3) et (2, 3) au tour 1 réservés, au tour
    // 2 non ; (3, 4) aux tours 3 et 4, sans réservation.
    const mesures = mesurerPlan({
      appartenance: [null, null, null, null],
      capacite: 3,
      tours: [
        [[1, 2, 3], [4]],
        [[1, 2, 3], [4]],
        [[1, 2], [3, 4]],
        [[1, 2], [3, 4]],
      ],
      reservations: [tous(1, 1), tous(2, 1), auTour(3, 1, 1)],
    });
    assert.deepEqual(mesures.rencontresRepetees, { choisies: 3, imposees: 1 });
  });

  describe('une rencontre hors réservation rend la répétition choisie, quels que soient son rang et le membre non réservé', () => {
    // 1 et 2 sont assis ensemble à la table 1 aux trois tours. L'un y est
    // ancré ; l'autre n'y est réservé qu'aux deux tours autres que « libre ».
    // La rencontre de ce tour-là n'est réservée que pour l'ancré : la
    // répétition est choisie, que cette rencontre soit la première, celle du
    // milieu ou la dernière, et que le membre non réservé soit le premier de
    // la paire ou le second. Le partiellement fixé visite trois fois la
    // table, dont deux réservées : un retour imposé, un choisi. L'ancré,
    // réservé aux trois visites, compte deux retours imposés. Chaque cas est
    // une épreuve : un écart nomme chacun des cas qu'il touche.
    const cas = [
      { libre: 1, partiel: 1, ancre: 2, retoursImposes: [1, 2], retoursChoisis: [1, 0] },
      { libre: 2, partiel: 1, ancre: 2, retoursImposes: [1, 2], retoursChoisis: [1, 0] },
      { libre: 3, partiel: 1, ancre: 2, retoursImposes: [1, 2], retoursChoisis: [1, 0] },
      { libre: 1, partiel: 2, ancre: 1, retoursImposes: [2, 1], retoursChoisis: [0, 1] },
      { libre: 2, partiel: 2, ancre: 1, retoursImposes: [2, 1], retoursChoisis: [0, 1] },
      { libre: 3, partiel: 2, ancre: 1, retoursImposes: [2, 1], retoursChoisis: [0, 1] },
    ];
    for (const { libre, partiel, ancre, retoursImposes, retoursChoisis } of cas) {
      test(`rencontre du tour ${libre} réservée pour ${ancre} seul`, () => {
        const mesures = mesurerPlan({
          appartenance: [null, null],
          capacite: 2,
          tours: [[[1, 2]], [[1, 2]], [[1, 2]]],
          reservations: [
            tous(ancre, 1),
            ...[1, 2, 3].filter((tour) => tour !== libre).map((tour) => auTour(partiel, 1, tour)),
          ],
        });
        assert.deepEqual(mesures.rencontresRepetees, { choisies: 1, imposees: 0 });
        assert.deepEqual(mesures.retoursImposes, retoursImposes);
        assert.deepEqual(mesures.retoursChoisis, retoursChoisis);
      });
    }
  });

  test('une répétition imposée se lit sur les réservations du tour des deux membres, ancrés ou non', () => {
    // 2 est ancré à la table 1 ; 3 et 4, réservés à la table 2 aux tours 2 et
    // 3, sont partiellement fixés ; 1 est mobile. (1, 2) se réunit aux trois
    // tours : 1, le premier membre de la paire, n'est jamais réservé, la
    // répétition est choisie. (3, 4) se réunit aux tours 2 et 3, chaque fois
    // à la table où tous deux sont réservés ce tour-là : la répétition est
    // imposée, bien qu'aucun des deux ne soit ancré et que 3 ne soit réservé
    // nulle part au tour 1.
    const mesures = mesurerPlan({
      appartenance: [null, null, null, null],
      capacite: 3,
      tours: [
        [[1, 2, 4], [3]],
        [[1, 2], [3, 4]],
        [[1, 2], [3, 4]],
      ],
      reservations: [tous(2, 1), auTour(3, 2, 2), auTour(3, 2, 3), auTour(4, 2, 2), auTour(4, 2, 3)],
    });
    assert.deepEqual(mesures.rencontresRepetees, { choisies: 1, imposees: 1 });
  });

  test("une visite n'est réservée qu'à la table de la réservation : un plan qui ne la tient pas n'impose rien", () => {
    // 1 et 2 sont ancrés à la table 1 ; le plan les assoit ensemble à la
    // table 2 aux deux tours. Un tel plan, en dérive, se conserve et se
    // mesure (§ 9) : la réservation qu'il ne tient pas n'impose ni leurs
    // retours ni leur répétition, qui sont choisis.
    const mesures = mesurerPlan({
      appartenance: [null, null],
      capacite: 2,
      tours: [
        [[], [1, 2]],
        [[], [1, 2]],
      ],
      reservations: [tous(1, 1), tous(2, 1)],
    });
    assert.deepEqual(mesures.rencontresRepetees, { choisies: 1, imposees: 0 });
    assert.deepEqual(mesures.retoursImposes, [0, 0]);
    assert.deepEqual(mesures.retoursChoisis, [1, 1]);
  });

  test("un seul membre réservé ailleurs suffit à rendre la répétition choisie : réservé ce tour-là ne suffit pas, il faut l'être à cette table", () => {
    // Deux plans en dérive, la paire assise à la table 2 aux deux tours. Dans
    // le premier, le premier membre est réservé à la table 1 et le second à la
    // table 2 ; dans le second, l'inverse. Chacun des deux membres est donc
    // tour à tour celui qui n'est pas réservé à la table de la rencontre.
    for (const reservations of [[tous(1, 1), tous(2, 2)], [tous(1, 2), tous(2, 1)]]) {
      const mesures = mesurerPlan({
        appartenance: [null, null],
        capacite: 2,
        tours: [
          [[], [1, 2]],
          [[], [1, 2]],
        ],
        reservations,
      });
      assert.deepEqual(
        mesures.rencontresRepetees,
        { choisies: 1, imposees: 0 },
        JSON.stringify(reservations),
      );
    }
  });

  test("le compte d'une paire tient 65 536 tours", () => {
    const R = 65_536;
    const instance = normaliser({
      participants: [
        { id: 1, nom: 'P1', appartenance: null },
        { id: 2, nom: 'P2', appartenance: null },
      ],
      tables: [{ id: 1, numero: 1, capacite: 2 }],
      tours: R,
      reservations: [],
      contraintes: SANS_CONTRAINTE,
    });
    // Toutes les cases valent 0 : les deux participants partagent la table
    // d'index 0 à chaque tour.
    const mesures = mesurer(instance, new Int32Array(2 * R));
    assert.equal(mesures.maxRencontresPaire, R);
    assert.deepEqual(mesures.rencontres, [1, 1]);
    assert.deepEqual(mesures.rencontresRepetees, { choisies: 1, imposees: 0 });
  });

  test('maxRencontresPaire est le plus grand compte des paires, non celui de la dernière paire réunie', () => {
    // (1, 2) se réunit aux tours 1 et 2, (2, 3) au seul tour 3. Dans l'ordre
    // des paires, (2, 3) vient après (1, 2) : le maximum reste 2.
    const mesures = mesurerPlan({
      appartenance: [null, null, null],
      capacite: 2,
      tours: [
        [[1, 2], [3]],
        [[1, 2], [3]],
        [[1], [2, 3]],
      ],
    });
    assert.deepEqual(mesures.rencontres, [1, 2, 1]);
    assert.equal(mesures.maxRencontresPaire, 2);
    assert.deepEqual(mesures.rencontresRepetees, { choisies: 1, imposees: 0 });
  });

  test("les comptes par paire tiennent dans un Uint16Array jusqu'à 65 535 tours, dans un Uint32Array au-delà", () => {
    // Deux participants à la même table à chaque tour : le compte de leur
    // paire vaut R. À R = 65 535, le plus grand compte qu'un Uint16Array
    // tient, la mémoire des paires reste à deux octets par paire.
    const deux = (R) =>
      normaliser({
        participants: [
          { id: 1, nom: 'P1', appartenance: null },
          { id: 2, nom: 'P2', appartenance: null },
        ],
        tables: [{ id: 1, numero: 1, capacite: 2 }],
        tours: R,
        reservations: [],
        contraintes: SANS_CONTRAINTE,
      });
    const a = parcourirTours(deux(65_535), new Int32Array(2 * 65_535)).parPaire;
    assert.ok(a instanceof Uint16Array, `${a.constructor.name} à 65 535 tours`);
    assert.deepEqual(Array.from(a), [65_535]);
    const b = parcourirTours(deux(65_536), new Int32Array(2 * 65_536)).parPaire;
    assert.ok(b instanceof Uint32Array, `${b.constructor.name} à 65 536 tours`);
    assert.deepEqual(Array.from(b), [65_536]);
  });

  test('personne à la même table : aucune rencontre, maximum par paire à 0', () => {
    const mesures = mesurerPlan({
      appartenance: ['X', 'X'],
      capacite: 2,
      tours: [
        [[1], [2]],
        [[2], [1]],
      ],
    });
    assert.deepEqual(mesures.rencontres, [0, 0]);
    assert.deepEqual(mesures.diversite, [null, null]);
    assert.equal(mesures.maxRencontresPaire, 0);
    assert.equal(mesures.collisionsCumulees, 0);
    // L'effectif d'un groupe compte tous ses membres, qu'ils rencontrent
    // quelqu'un ou non.
    assert.deepEqual(mesures.parGroupe, [
      { groupe: 'X', effectif: 2, collisionsCumulees: 0, pairesDistinctes: 0, excedent: 0 },
    ]);
  });

  test("parGroupe suit l'ordre de instance.groupes, non l'ordre alphabétique", () => {
    // instance.groupes range les appartenances par première apparition, en
    // parcourant les identifiants croissants : Y, portée par 1, puis X, par
    // 2. 1 et 3, tous deux de Y, se rencontrent une fois.
    const mesures = mesurerPlan({ appartenance: ['Y', 'X', 'Y'], capacite: 3, tours: [[[1, 2, 3]]] });
    assert.deepEqual(mesures.parGroupe, [
      { groupe: 'Y', effectif: 2, collisionsCumulees: 1, pairesDistinctes: 1, excedent: 0 },
      { groupe: 'X', effectif: 1, collisionsCumulees: 0, pairesDistinctes: 0, excedent: 0 },
    ]);
  });

  test('sans participant présent : tableaux vides, agrégats à null, compteurs à 0', () => {
    const instance = normaliser({
      participants: [{ id: 1, nom: 'P1', appartenance: 'X', exclu: true }],
      tables: [{ id: 1, numero: 1, capacite: 2 }],
      tours: 2,
      reservations: [],
      contraintes: SANS_CONTRAINTE,
    });
    assert.deepEqual(mesurer(instance, new Int32Array(0)), {
      rencontres: [],
      affilies: [],
      appartenancesVues: [],
      redondance: [],
      diversite: [],
      toursAssis: [],
      retoursChoisis: [],
      retoursImposes: [],
      aggRencontres: { tous: AUCUN, mobiles: AUCUN, ancres: AUCUN },
      aggRedondance: { tous: AUCUN, mobiles: AUCUN, ancres: AUCUN },
      aggAppartenancesVues: { tous: AUCUN, mobiles: AUCUN, ancres: AUCUN },
      aggDiversite: { tous: AUCUN, mobiles: AUCUN, ancres: AUCUN },
      totalRedondance: 0,
      collisionsCumulees: 0,
      pairesDistinctes: 0,
      excedentCollisions: 0,
      rencontresRepetees: { choisies: 0, imposees: 0 },
      maxRencontresPaire: 0,
      totalRetoursChoisis: 0,
      totalRetoursImposes: 0,
      parGroupe: [],
    });
  });

  test("un plan indexé qui n'a pas la forme de l'instance lève RangeError, qui nomme le participant et le tour", () => {
    const { instance, tableDe } = preparer({ appartenance: PETITE, capacite: 3, tours: PLAN_PARFAIT });
    // Douze participants, quatre tours : 48 cases, ni une de moins ni une de
    // trop.
    assert.throws(() => mesurer(instance, tableDe.subarray(1)), RangeError);
    assert.throws(() => mesurer(instance, Int32Array.of(...tableDe, 0)), RangeError);
    // Quatre tables : une case vaut −1 ou un index entier de 0 à 3. Les
    // chaînes "0" et "-1" ne sont ni l'un ni l'autre : une comparaison qui
    // convertit lirait l'une comme la table d'index 0, l'autre comme la
    // réserve. Chaque intrus se pose à la première case, à une case du milieu
    // et à la dernière.
    for (const intrus of [4, -2, 1.5, '0', '-1']) {
      for (const k of [0, 5, 47]) {
        const fautif = Array.from(tableDe);
        fautif[k] = intrus;
        assert.throws(() => mesurer(instance, fautif), RangeError, `case ${k} à ${JSON.stringify(intrus)}`);
      }
    }
    // La case p × R + r est celle du participant d'index p au tour r + 1 : la
    // dernière est celle de 12 au tour 4. Le message cite une chaîne entre
    // guillemets, pour qu'elle ne se lise pas comme l'index qu'elle contient.
    const fautif = Array.from(tableDe);
    fautif[47] = '0';
    assert.throws(() => mesurer(instance, fautif), {
      name: 'RangeError',
      message: /participant 12, tour 4, index de table "0" hors de −1\.\.3/,
    });
  });

  test("mesurer ne modifie ni l'instance ni le plan", () => {
    const { instance, tableDe } = preparer(PLAN_RESERVATIONS);
    const avant = {
      tableDe: tableDe.slice(),
      fixe: instance.fixe.slice(),
      statut: instance.statut.slice(),
      groupe: instance.groupe.slice(),
    };
    mesurer(instance, tableDe);
    assert.deepEqual(
      { tableDe, fixe: instance.fixe, statut: instance.statut, groupe: instance.groupe },
      avant,
    );
  });
});

// Quatre personnes, 1 et 2 de X, deux tables de 3, trois tours ; 4 attend en
// réserve au tour 3. Les paires se rangent par rangPaire : (0, 1), (0, 2),
// (0, 3), (1, 2), (1, 3), (2, 3), en index de personnes.
const PARCOURS = {
  appartenance: ['X', 'X', null, null],
  capacite: 3,
  tours: [
    [[1, 2, 3], [4]],
    [[1, 2], [3, 4]],
    [[1, 3], [2]],
  ],
  reserves: [[], [], [4]],
};

describe('parcourirTours', () => {
  test('chaque table de chaque tour : collègues, paires revues, personnes revenues, en index croissants', () => {
    // Tour 1 : (0, 1) collègues, rien de revu, personne ne revient. Tour 2 :
    // (0, 1) collègues et revus ; 0 et 1 reviennent à la table d'index 0, 3
    // à celle d'index 1, que 2 découvre. Tour 3 : (0, 2) revus, réunis
    // librement au tour 1 ; 0 revient une deuxième fois, 2 revient ; 1
    // découvre la table d'index 1.
    const { instance, tableDe } = preparer(PARCOURS);
    const vide = { collegues: [], revues: [], revenus: [] };
    assert.deepEqual(parcourirTours(instance, tableDe), {
      parTour: [
        [{ collegues: [[0, 1]], revues: [], revenus: [] }, vide],
        [
          { collegues: [[0, 1]], revues: [[0, 1]], revenus: [0, 1] },
          { collegues: [], revues: [], revenus: [3] },
        ],
        [{ collegues: [], revues: [[0, 2]], revenus: [0, 2] }, vide],
      ],
      parPaire: Uint16Array.of(2, 2, 0, 1, 0, 1),
      toursAssis: [3, 3, 3, 2],
      retours: [2, 1, 1, 1],
    });
  });

  test('une rencontre et une visite que les réservations imposent ne se signalent pas ; elles restent comptées', () => {
    // 1 et 2 sont réservés à la table 1 aux tours 1 et 2 : leur rencontre du
    // tour 2 ne répète qu'une rencontre réservée, et chacun y revient
    // réservé, comme à sa visite du tour 1. Au tour 3, 1 y revient sans
    // réservation : il est revenu. parPaire et retours comptent tout,
    // imposé compris.
    const { instance, tableDe } = preparer({
      ...PARCOURS,
      reservations: [auTour(1, 1, 1), auTour(2, 1, 1), auTour(1, 1, 2), auTour(2, 1, 2)],
    });
    const { parTour, parPaire, retours } = parcourirTours(instance, tableDe);
    assert.deepEqual(parTour[1][0], { collegues: [[0, 1]], revues: [], revenus: [] });
    assert.deepEqual(parTour[2][0], { collegues: [], revues: [[0, 2]], revenus: [0, 2] });
    assert.deepEqual(Array.from(parPaire), [2, 2, 0, 1, 0, 1]);
    assert.deepEqual(retours, [2, 1, 1, 1]);
  });

  test('une table, ses tours, et aucune personne présente : chaque case est vide', () => {
    const instance = normaliser({
      participants: [{ id: 1, nom: 'P1', appartenance: 'X', exclu: true }],
      tables: [{ id: 1, numero: 1, capacite: 2 }],
      tours: 2,
      reservations: [],
      contraintes: SANS_CONTRAINTE,
    });
    const vide = { collegues: [], revues: [], revenus: [] };
    assert.deepEqual(parcourirTours(instance, new Int32Array(0)), {
      parTour: [[vide], [vide]],
      parPaire: new Uint16Array(0),
      toursAssis: [],
      retours: [],
    });
  });

  test("lève ce que lève exigerPlanIndexe, et ne modifie ni l'instance ni le plan", () => {
    const { instance, tableDe } = preparer(PARCOURS);
    assert.throws(() => parcourirTours(instance, tableDe.subarray(1)), RangeError);
    const avant = { tableDe: tableDe.slice(), fixe: instance.fixe.slice(), groupe: instance.groupe.slice() };
    parcourirTours(instance, tableDe);
    assert.deepEqual({ tableDe, fixe: instance.fixe, groupe: instance.groupe }, avant);
  });
});
