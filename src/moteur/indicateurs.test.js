// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves des indicateurs (§ 5.4, § 12.6, § 14.10). Chaque valeur attendue
// est écrite en clair : recopiée de la spécification, ou comptée à la main
// sur le plan qui la précède, jamais calculée par le module éprouvé. Un plan
// s'écrit par identifiants, une liste par table, et passe par normaliser et
// indexerPlan comme un plan enregistré.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { LIBRE, RESERVE, indexerPlan, normaliser } from './configuration.js';
import { VALEURS_DES_MODES } from './criteres.js';
import { FLUX, creerPcg32 } from '../demo/prng.js';
import { assisAChaqueTourPresent, inclusionSatisfaite, mesurer, parcourirTours } from './indicateurs.js';

const SANS_CONTRAINTE = {
  separerOrganisations: false,
  nouveauxVoisins: false,
  nouvelleTable: false,
  varierOrganisations: false,
};

const tous = (participant, table) => ({ participant, table, portee: 'tous' });
const auTour = (participant, table, tour) => ({ participant, table, portee: 'tour', tour });

// Agrégat d'une population vide.
const AUCUN = { min: null, moyenne: null, effectif: 0 };

// Organisations des participants 1..N : le libellé du groupe qui contient
// l'identifiant, null hors de tout groupe. groupes est une liste de couples
// [libellé, identifiants].
function organisations(N, groupes) {
  return Array.from({ length: N }, (_, i) => {
    const groupe = groupes.find(([, membres]) => membres.includes(i + 1));
    return groupe === undefined ? null : groupe[0];
  });
}

// Instance et plan indexé d'un plan écrit par identifiants. Le participant
// i + 1 porte organisation[i] ; les tables portent les identifiants 1..T,
// toutes de la capacité donnée ; tours[r][i] liste les participants assis à
// la table i + 1 au tour r + 1, et reserves[r] ceux qui n'y sont assis nulle
// part. conflits[i], quand il est donné et non null, est la liste des
// conflits du participant i + 1.
function preparer({
  organisation,
  capacite,
  tours,
  reserves = tours.map(() => []),
  reservations = [],
  conflits = [],
}) {
  const participants = organisation.map((libelle, i) => ({
    id: i + 1,
    nom: `P${i + 1}`,
    organisation: libelle,
    ...(conflits[i] ? { conflits: conflits[i] } : {}),
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
const PETITE = organisations(12, [
  ['A', [1, 5, 8, 12]],
  ['B', [2, 4, 9, 11]],
  ['C', [3, 6, 7, 10]],
]);
// Variante « conflit inévitable » : 10 passe de C à A.
const VARIANTE = organisations(12, [
  ['A', [1, 5, 8, 10, 12]],
  ['B', [2, 4, 9, 11]],
  ['C', [3, 6, 7]],
]);

// Trois tables de trois sièges, quatre tours. 1 est ancré à la table 1 ; 2
// est mobile ; 3, réservé à la table 2 au tour 3, et 4, réservé à la table 3
// aux tours 1 et 3, sont partiellement fixés. Chaque réservation est tenue.
const PLAN_RESERVATIONS = {
  organisation: [null, null, null, null],
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
  organisation: [null, null],
  capacite: 2,
  tours: [[[1, 2]], [[1, 2]], [[1, 2]], [[1, 2]]],
  reservations: [tous(1, 1), tous(2, 1)],
};

describe('mesurer', () => {
  test('plan parfait de la petite démonstration : huit rencontres chacun, ni collision ni répétition', () => {
    // Aucun retour : chacun visite les quatre tables. Sans réservation, la
    // population des ancrés est vide.
    assert.deepEqual(mesurerPlan({ organisation: PETITE, capacite: 3, tours: PLAN_PARFAIT }), {
      rencontres: new Array(12).fill(8),
      affilies: new Array(12).fill(8),
      organisationsVues: new Array(12).fill(2),
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
      // Chacun croise deux organisations, la sienne exclue : A(p) = 2 pour
      // huit affiliés rencontrés, d(p) = 2 / 8.
      aggOrganisationsVues: {
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
      conflitsOrganisation: null,
      rencontresRepetees: { choisies: 0, imposees: 0 },
      maxRencontresPaire: 1,
      totalRetoursChoisis: 0,
      totalRetoursImposes: 0,
      parGroupe: [
        { groupe: 'A', effectif: 4, collisionsCumulees: 0, pairesDistinctes: 0, excedent: 0 },
        { groupe: 'B', effectif: 4, collisionsCumulees: 0, pairesDistinctes: 0, excedent: 0 },
        { groupe: 'C', effectif: 4, collisionsCumulees: 0, pairesDistinctes: 0, excedent: 0 },
      ],
      objectifs: null,
      animateurs: null,
      inclusions: null,
    });
  });

  test('variante 5, 4, 3 : quatre collisions cumulées sur quatre paires distinctes, excédent nul', () => {
    const mesures = mesurerPlan({ organisation: VARIANTE, capacite: 3, tours: PLAN_PARFAIT });
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
    // propre organisation avec les deux autres. 10 croise A et B, jamais C.
    assert.deepEqual(mesures.organisationsVues, [3, 2, 2, 2, 3, 2, 2, 3, 2, 2, 2, 3]);
  });

  test("l'excédent compte les retrouvailles de collègues au-delà de la première", () => {
    // Deux tables de quatre, trois tours ; X = {1, 2, 3, 4}, les autres sans
    // organisation.
    const organisation = organisations(8, [['X', [1, 2, 3, 4]]]);
    const collisions = ({ collisionsCumulees, pairesDistinctes, excedentCollisions, parGroupe }) => ({
      collisionsCumulees,
      pairesDistinctes,
      excedentCollisions,
      parGroupe,
    });
    const reparti = mesurerPlan({
      organisation,
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
    // sans organisation ne sont pas des collègues.
    const concentre = mesurerPlan({
      organisation,
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
      organisation: ['X', 'X', 'Y', 'X', null],
      capacite: 3,
      tours: [
        [[1, 2, 3], [4], [], [5]],
        [[], [1, 4], [2, 3], [5]],
      ],
    });
    assert.deepEqual(mesures.rencontres, [3, 2, 2, 1, 0]);
    assert.deepEqual(mesures.affilies, [3, 2, 2, 1, 0]);
    assert.deepEqual(mesures.organisationsVues, [2, 2, 1, 1, 0]);
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
      organisation: ['X', 'X', 'Y', 'X', null],
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
    // organisation ; chacune d'elles rencontre un seul affilié, 3.
    const mesures = mesurerPlan({ organisation: [null, null, 'X'], capacite: 3, tours: [[[1, 2, 3]]] });
    assert.deepEqual(mesures.rencontres, [2, 2, 2]);
    assert.deepEqual(mesures.affilies, [1, 1, 0]);
    assert.deepEqual(mesures.organisationsVues, [1, 1, 0]);
    assert.deepEqual(mesures.diversite, [1, 1, null]);
    // La redondance se lit sur les affiliés rencontrés, |F(p)| − A(p), et non
    // sur toutes les rencontres : personne ne recroise une organisation.
    assert.deepEqual(mesures.redondance, [0, 0, 0]);
    assert.deepEqual(mesures.aggRedondance, {
      tous: { min: 0, moyenne: 0, effectif: 3 },
      mobiles: { min: 0, moyenne: 0, effectif: 3 },
      ancres: AUCUN,
    });
    // A(p) se replie sur chacun ; d(p) sur les seuls qui rencontrent un
    // affilié : 3 sort de l'effectif, et son null n'entre ni dans le minimum
    // ni dans la moyenne.
    assert.deepEqual(mesures.aggOrganisationsVues, {
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
    // 1 et 2, sans organisation, sont ancrés à la table 1 ; 3 et 4, de X et
    // de Y, mobiles, la visitent tour à tour. 1 et 2 rencontrent chacun 3 et
    // 4 : d = 2 / 2. 3 rencontre 1 et 2, sans organisation, au tour 1, puis
    // personne : il sort de l'effectif ; de même 4.
    const mesures = mesurerPlan({
      organisation: [null, null, 'X', 'Y'],
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
    assert.deepEqual(mesures.aggOrganisationsVues, {
      tous: { min: 0, moyenne: 1, effectif: 4 },
      mobiles: { min: 0, moyenne: 0, effectif: 2 },
      ancres: { min: 2, moyenne: 2, effectif: 2 },
    });
  });

  test("la réserve n'est pas une table : seuls les tours assis comptent", () => {
    // 6 est en réserve aux tours 1 et 2, 5 au tour 2. Ils partagent
    // l'organisation X et ne sont jamais assis ensemble.
    const mesures = mesurerPlan({
      organisation: [null, null, null, null, 'X', 'X'],
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
      organisation: [null, null, null, null],
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
    const sansAncre = mesurerPlan({ organisation: PETITE, capacite: 3, tours: PLAN_PARFAIT });
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
      organisation: [null, null, null, null],
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
          organisation: [null, null],
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
      organisation: [null, null, null, null],
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
      organisation: [null, null],
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
        organisation: [null, null],
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
        { id: 1, nom: 'P1', organisation: null },
        { id: 2, nom: 'P2', organisation: null },
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
      organisation: [null, null, null],
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
          { id: 1, nom: 'P1', organisation: null },
          { id: 2, nom: 'P2', organisation: null },
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
      organisation: ['X', 'X'],
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
    // instance.groupes range les organisations par première apparition, en
    // parcourant les identifiants croissants : Y, portée par 1, puis X, par
    // 2. 1 et 3, tous deux de Y, se rencontrent une fois.
    const mesures = mesurerPlan({ organisation: ['Y', 'X', 'Y'], capacite: 3, tours: [[[1, 2, 3]]] });
    assert.deepEqual(mesures.parGroupe, [
      { groupe: 'Y', effectif: 2, collisionsCumulees: 1, pairesDistinctes: 1, excedent: 0 },
      { groupe: 'X', effectif: 1, collisionsCumulees: 0, pairesDistinctes: 0, excedent: 0 },
    ]);
  });

  test('sans participant présent : tableaux vides, agrégats à null, compteurs à 0', () => {
    const instance = normaliser({
      participants: [{ id: 1, nom: 'P1', organisation: 'X', exclu: true }],
      tables: [{ id: 1, numero: 1, capacite: 2 }],
      tours: 2,
      reservations: [],
      contraintes: SANS_CONTRAINTE,
    });
    assert.deepEqual(mesurer(instance, new Int32Array(0)), {
      rencontres: [],
      affilies: [],
      organisationsVues: [],
      redondance: [],
      diversite: [],
      toursAssis: [],
      retoursChoisis: [],
      retoursImposes: [],
      aggRencontres: { tous: AUCUN, mobiles: AUCUN, ancres: AUCUN },
      aggRedondance: { tous: AUCUN, mobiles: AUCUN, ancres: AUCUN },
      aggOrganisationsVues: { tous: AUCUN, mobiles: AUCUN, ancres: AUCUN },
      aggDiversite: { tous: AUCUN, mobiles: AUCUN, ancres: AUCUN },
      totalRedondance: 0,
      collisionsCumulees: 0,
      pairesDistinctes: 0,
      excedentCollisions: 0,
      conflitsOrganisation: null,
      rencontresRepetees: { choisies: 0, imposees: 0 },
      maxRencontresPaire: 0,
      totalRetoursChoisis: 0,
      totalRetoursImposes: 0,
      parGroupe: [],
      objectifs: null,
      animateurs: null,
      inclusions: null,
    });
  });

  test("un plan indexé qui n'a pas la forme de l'instance lève RangeError, qui nomme le participant et le tour", () => {
    const { instance, tableDe } = preparer({ organisation: PETITE, capacite: 3, tours: PLAN_PARFAIT });
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
  organisation: ['X', 'X', null, null],
  capacite: 3,
  tours: [
    [[1, 2, 3], [4]],
    [[1, 2], [3, 4]],
    [[1, 3], [2]],
  ],
  reserves: [[], [], [4]],
};

// Six personnes, deux tables de trois, deux tours : 1 et 2 du Rameau, 3 et 4
// du Tilleul, 5 sans organisation, 6 du Saule. 1 nomme le Tilleul, 3 le
// Rameau — le même lien, dans l'autre sens —, 5 le Saule ; 6 nomme sa propre
// organisation et 2 une organisation que personne ne porte, ce qui ne relie
// rien.
const CONFLITS = {
  organisation: ['Rameau', 'Rameau', 'Tilleul', 'Tilleul', null, 'Saule'],
  conflits: [['Tilleul'], ['Inconnue'], ['Rameau'], null, ['Saule'], ['Saule']],
  capacite: 3,
  tours: [
    [[1, 3, 5], [2, 4, 6]],
    [[2, 5, 6], [1, 3, 4]],
  ],
};

describe('mesurer : les conflits d’organisation (§ 5.4)', () => {
  test("chaque paire en conflit assise à une même table compte à chaque tour, sur toute l'organisation, dans les deux sens", () => {
    // Tour 1 : (1, 3), Rameau et Tilleul ; (2, 4), Rameau et Tilleul, bien
    // que 2 n'ait rien nommé. Tour 2 : (5, 6), la personne sans organisation
    // et le Saule qu'elle nomme ; (1, 3) et (1, 4) ; (3, 4) sont collègues,
    // non en conflit. 5 conflits, que le lien posé deux fois ne double pas.
    const { instance, tableDe } = preparer(CONFLITS);
    assert.equal(mesurer(instance, tableDe).conflitsOrganisation, 5);
    assert.deepEqual(
      parcourirTours(instance, tableDe).parTour.map((tables) => tables.map(({ enConflit }) => enConflit)),
      [[[[0, 2]], [[1, 3]]], [[[4, 5]], [[0, 2], [0, 3]]]],
    );
    // Les collisions de même organisation se comptent à part : (3, 4) au tour 2.
    assert.equal(mesurer(instance, tableDe).collisionsCumulees, 1);
  });

  test("sans liste, ou des listes qui ne relient aucun présent : la mesure null, jamais 0, le critère sans objet", () => {
    const sansListe = preparer({ ...CONFLITS, conflits: [] });
    const sansLien = preparer({ ...CONFLITS, conflits: [['Inconnue'], null, ['Tilleul'], null, null, ['Saule']] });
    for (const { instance, tableDe } of [sansListe, sansLien]) {
      assert.equal(mesurer(instance, tableDe).conflitsOrganisation, null);
      assert.equal(instance.pairesEnConflit, 0);
      assert.equal(instance.etatCriteres.find(({ nom }) => nom === 'conflitsOrganisation').sansObjet, true);
    }
    const { instance } = preparer(CONFLITS);
    assert.equal(instance.etatCriteres.find(({ nom }) => nom === 'conflitsOrganisation').sansObjet, false);
  });
});

describe('parcourirTours', () => {
  test('chaque table de chaque tour : collègues, paires revues, personnes revenues, en index croissants', () => {
    // Tour 1 : (0, 1) collègues, rien de revu, personne ne revient. Tour 2 :
    // (0, 1) collègues et revus ; 0 et 1 reviennent à la table d'index 0, 3
    // à celle d'index 1, que 2 découvre. Tour 3 : (0, 2) revus, réunis
    // librement au tour 1 ; 0 revient une deuxième fois, 2 revient ; 1
    // découvre la table d'index 1. Réunies une première fois : (0, 1),
    // (0, 2) et (1, 2) au tour 1, (2, 3) au tour 2.
    const { instance, tableDe } = preparer(PARCOURS);
    const vide = { collegues: [], enConflit: [], revues: [], revenus: [] };
    assert.deepEqual(parcourirTours(instance, tableDe), {
      parTour: [
        [{ collegues: [[0, 1]], enConflit: [], revues: [], revenus: [] }, vide],
        [
          { collegues: [[0, 1]], enConflit: [], revues: [[0, 1]], revenus: [0, 1] },
          { collegues: [], enConflit: [], revues: [], revenus: [3] },
        ],
        [{ collegues: [], enConflit: [], revues: [[0, 2]], revenus: [0, 2] }, vide],
      ],
      parPaire: Uint16Array.of(2, 2, 0, 1, 0, 1),
      reunies: [0, 1, 0, 2, 1, 2, 2, 3],
      toursAssis: [3, 3, 3, 2],
      retours: [2, 1, 1, 1],
      servis: [0, 0, 0, 0],
      rencontresAnimateurs: [0, 0, 0, 0],
      // Sans objectif, aucun couple n'est possible : chaque assis du tour est
      // sans table possible, et 4, en réserve au tour 3, n'y compte pas.
      servisParTour: [0, 0, 0],
      possiblesParTour: [0, 0, 0],
      assisSansCoupleParTour: [4, 4, 3],
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
    assert.deepEqual(parTour[1][0], { collegues: [[0, 1]], enConflit: [], revues: [], revenus: [] });
    assert.deepEqual(parTour[2][0], { collegues: [], enConflit: [], revues: [[0, 2]], revenus: [0, 2] });
    assert.deepEqual(Array.from(parPaire), [2, 2, 0, 1, 0, 1]);
    assert.deepEqual(retours, [2, 1, 1, 1]);
  });

  test('une table, ses tours, et aucune personne présente : chaque case est vide', () => {
    const instance = normaliser({
      participants: [{ id: 1, nom: 'P1', organisation: 'X', exclu: true }],
      tables: [{ id: 1, numero: 1, capacite: 2 }],
      tours: 2,
      reservations: [],
      contraintes: SANS_CONTRAINTE,
    });
    const vide = { collegues: [], enConflit: [], revues: [], revenus: [] };
    assert.deepEqual(parcourirTours(instance, new Int32Array(0)), {
      parTour: [[vide], [vide]],
      parPaire: new Uint16Array(0),
      reunies: [],
      toursAssis: [],
      retours: [],
      servis: [],
      rencontresAnimateurs: [],
      servisParTour: [0, 0],
      possiblesParTour: [0, 0],
      assisSansCoupleParTour: [0, 0],
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

// --- Les objectifs des tables et les animateurs (§ 4.5, § 5.4, A9, A21) -----

// Configuration d'épreuve : personnes [id, étiquettes, tours animés], toutes
// présentes ; tables [id, capacité], dans l'ordre de la configuration ;
// objectifs {table, tour, regle, etiquettes}, règle résolue.
function configurer({ personnes, tables, tours, reservations = [], objectifs = [] }) {
  return {
    participants: personnes.map(([id, etiquettes, anime]) => ({
      id,
      nom: `P${id}`,
      organisation: null,
      ...(etiquettes === undefined ? {} : { etiquettes }),
      ...(anime === undefined ? {} : { anime }),
    })),
    tables: tables.map(([id, capacite], i) => ({ id, numero: i + 1, capacite })),
    tours,
    reservations,
    contraintes: SANS_CONTRAINTE,
    ...(objectifs.length === 0 ? {} : { objectifs }),
  };
}

// Plan indexé d'un plan écrit par identifiants, une liste par table dans
// l'ordre de configuration.tables, sans réserve.
function indexer(instance, configuration, tours) {
  const tables = configuration.tables.map(({ id }) => id);
  return indexerPlan(instance, { tables, tours, reserves: tours.map(() => []) });
}

// Les mesures d'un plan, avec l'instance qui les porte.
function mesurerSur(configuration, tours) {
  const instance = normaliser(configuration);
  return { instance, mesures: mesurer(instance, indexer(instance, configuration, tours)) };
}

// Entiers de debut à fin, inclus.
function suite(debut, fin) {
  return Array.from({ length: fin - debut + 1 }, (_, i) => debut + i);
}

// Dix personnes « finance », 1 à 10, six sans étiquette, 11 à 16 ; la table
// 1, « finance », de huit places ; la table 2, sans objectif, de huit
// places ; quatre tours (A21, « chaque mode compare ce qu'il dit »).
const FINANCE = configurer({
  personnes: [...suite(1, 10).map((id) => [id, ['finance']]), ...suite(11, 16).map((id) => [id])],
  tables: [[1, 8], [2, 8]],
  tours: 4,
  objectifs: [{ table: 1, tour: null, regle: 'ou', etiquettes: ['finance'] }],
});

// Le plan où la table 1 reçoit, à chaque tour, les « finance » hors des deux
// que chaque paire nomme, et la table 2 ces deux-là avec les six autres.
const tenus = (...paires) => paires.map((ecartes) => [
  suite(1, 10).filter((id) => !ecartes.includes(id)),
  [...ecartes, ...suite(11, 16)],
]);

describe('mesurer : les objectifs des tables (§ 5.4, A9, A21)', () => {
  // Trois plans qui servent tous 32 places. Le premier laisse 10 sans tour
  // servi : 1 à 5 en ont 4, 6 à 9 en ont 3. Le deuxième sert chacun une fois
  // au moins : 9 et 10 une seule, 1 et 2 trois, 3 à 8 quatre. Le dernier
  // sert chacun trois tours au moins : 1 à 8 trois, 9 et 10 quatre.
  const PLANS = {
    sansTourServi: tenus([9, 10], [8, 10], [7, 10], [6, 10]),
    chacunUneFois: tenus([9, 10], [9, 10], [9, 10], [1, 2]),
    troisAuMoins: tenus([1, 2], [3, 4], [5, 6], [7, 8]),
  };
  const attendus = {
    sansTourServi: { tours: [4, 4, 4, 4, 4, 3, 3, 3, 3, 0], jamaisServies: 1, horsObjectifMax: 4, personnesAuMax: 1, min: 0 },
    chacunUneFois: { tours: [3, 3, 4, 4, 4, 4, 4, 4, 1, 1], jamaisServies: 0, horsObjectifMax: 3, personnesAuMax: 2, min: 1 },
    troisAuMoins: { tours: [3, 3, 3, 3, 3, 3, 3, 3, 4, 4], jamaisServies: 0, horsObjectifMax: 1, personnesAuMax: 8, min: 3 },
  };

  test('chaque plan, compté à la main : tours servis, tours possibles, et les valeurs des trois modes', () => {
    for (const [nom, tours] of Object.entries(PLANS)) {
      const { objectifs } = mesurerSur(FINANCE, tours).mesures;
      const attendu = attendus[nom];
      assert.deepEqual(objectifs.tours, [...attendu.tours, 0, 0, 0, 0, 0, 0], nom);
      assert.deepEqual(objectifs.possibles, [...new Array(10).fill(4), 0, 0, 0, 0, 0, 0], nom);
      assert.equal(objectifs.horsObjectif, 8, nom);
      assert.equal(objectifs.jamaisServies, attendu.jamaisServies, nom);
      assert.equal(objectifs.horsObjectifMax, attendu.horsObjectifMax, nom);
      assert.equal(objectifs.personnesAuMax, attendu.personnesAuMax, nom);
      assert.equal(objectifs.concernes, 10, nom);
      // Le minimum porte sur les dix concernés, tous mobiles.
      assert.deepEqual(objectifs.agregat.tous, { min: attendu.min, moyenne: 3.2, effectif: 10 }, nom);
      assert.deepEqual(objectifs.agregat.mobiles, { min: attendu.min, moyenne: 3.2, effectif: 10 }, nom);
      assert.deepEqual(objectifs.agregat.ancres, AUCUN, nom);
    }
  });

  test('chaque mode compare ce qu’il dit : égaux sous « places », le premier derrière sous « chacun », le dernier devant sous « minimum »', () => {
    // Les valeurs que chaque mode classe, lues sous leur nom de mesure.
    const NOM_DE_MESURE = { toursHorsObjectif: 'horsObjectif', jamaisServies: 'jamaisServies', horsObjectifMax: 'horsObjectifMax' };
    const cle = (objectifs, mode) => VALEURS_DES_MODES[mode].map((valeur) => objectifs[NOM_DE_MESURE[valeur]]);
    const compare = (a, b) => a.reduce((resultat, x, i) => resultat || x - b[i], 0);
    const mesures = Object.fromEntries(Object.entries(PLANS).map(([nom, tours]) => [nom, mesurerSur(FINANCE, tours).mesures.objectifs]));
    const { sansTourServi: a, chacunUneFois: b, troisAuMoins: c } = mesures;
    assert.equal(compare(cle(a, 'places'), cle(b, 'places')), 0);
    assert.equal(compare(cle(b, 'places'), cle(c, 'places')), 0);
    assert.ok(compare(cle(a, 'chacun'), cle(b, 'chacun')) > 0);
    assert.ok(compare(cle(a, 'chacun'), cle(c, 'chacun')) > 0);
    assert.ok(compare(cle(c, 'minimum'), cle(a, 'minimum')) < 0);
    assert.ok(compare(cle(c, 'minimum'), cle(b, 'minimum')) < 0);
  });

  test('une personne servie par sa réservation n’est jamais comptée jamais servie', () => {
    // 1 est réservé à la table 1 au tour 1, où il est servi, puis tenu à la
    // table 2 : un tour servi, trois hors objectif. Seul 10 n'est jamais
    // servi.
    const reserve = { ...FINANCE, reservations: [{ participant: 1, table: 1, portee: 'tour', tour: 1 }] };
    const { objectifs } = mesurerSur(reserve, tenus([9, 10], [1, 10], [1, 10], [1, 10])).mesures;
    assert.deepEqual(objectifs.tours.slice(0, 10), [1, 4, 4, 4, 4, 4, 4, 4, 3, 0]);
    assert.equal(objectifs.possibles[0], 4);
    assert.equal(objectifs.jamaisServies, 1);
    assert.equal(objectifs.horsObjectif, 8);
    assert.equal(objectifs.horsObjectifMax, 4);
    // 1 est partiellement fixé : il compte parmi les mobiles.
    assert.equal(objectifs.agregat.mobiles.effectif, 10);
  });

  test('une personne réservée à une table dont l’objectif ne lui correspond pas n’est pas concernée ; tous servis, le plus grand nombre et le nombre à ce plus grand valent zéro', () => {
    // 1, « finance », est réservé aux deux tours à la table 2, « bénévole » :
    // aucun tour possible. 2, « finance », et 3, « bénévole », sont servis aux
    // deux tours ; 4 ne porte rien.
    const configuration = configurer({
      personnes: [[1, ['finance']], [2, ['finance']], [3, ['bénévole']], [4]],
      tables: [[1, 2], [2, 2]],
      tours: 2,
      reservations: [{ participant: 1, table: 2, portee: 'tous' }],
      objectifs: [
        { table: 1, tour: null, regle: 'ou', etiquettes: ['finance'] },
        { table: 2, tour: null, regle: 'ou', etiquettes: ['bénévole'] },
      ],
    });
    const { objectifs } = mesurerSur(configuration, [[[2, 4], [1, 3]], [[2, 4], [1, 3]]]).mesures;
    assert.deepEqual(objectifs, {
      tours: [0, 2, 2, 0],
      possibles: [0, 2, 2, 0],
      horsObjectif: 0,
      jamaisServies: 0,
      horsObjectifMax: 0,
      personnesAuMax: 0,
      concernes: 2,
      agregat: { tous: { min: 2, moyenne: 2, effectif: 2 }, mobiles: { min: 2, moyenne: 2, effectif: 2 }, ancres: AUCUN },
    });
  });

  test('un seul tour possible suffit à concerner une personne : P(p) = 1', () => {
    // L'objectif « finance » ne vaut qu'au tour 1 de la table 1 : 1 y a son
    // seul tour possible, et y est servi ; 2 ne porte aucune étiquette.
    const configuration = configurer({
      personnes: [[1, ['finance']], [2]],
      tables: [[1, 2]],
      tours: 2,
      objectifs: [{ table: 1, tour: 1, regle: 'ou', etiquettes: ['finance'] }],
    });
    const { objectifs } = mesurerSur(configuration, [[[1, 2]], [[1, 2]]]).mesures;
    const servi = { min: 1, moyenne: 1, effectif: 1 };
    assert.deepEqual(objectifs, {
      tours: [1, 0],
      possibles: [1, 0],
      horsObjectif: 0,
      jamaisServies: 0,
      horsObjectifMax: 0,
      personnesAuMax: 0,
      concernes: 1,
      agregat: { tous: servi, mobiles: servi, ancres: AUCUN },
    });
  });

  test('sans personne concernée, les objectifs valent null : aucun objectif, ou un objectif que personne ne porte', () => {
    const sans = configurer({ personnes: [[1, ['finance']], [2]], tables: [[1, 2]], tours: 1 });
    assert.equal(mesurerSur(sans, [[[1, 2]]]).mesures.objectifs, null);
    const personne = { ...sans, objectifs: [{ table: 1, tour: null, regle: 'ou', etiquettes: ['bénévole'] }] };
    assert.equal(mesurerSur(personne, [[[1, 2]]]).mesures.objectifs, null);
  });
});

// Lecture directe de m(p) et de B(p) (§ 4.5), sans rien du module éprouvé.
// anime(q, r) : q anime au tour r ; la table fixée d'une personne à un tour
// est celle de sa réservation ; une table garde un siège libre quand ses
// réservations n'occupent pas toute sa capacité.
function lectureDesAnimateurs(configuration) {
  const { participants, tables, reservations, tours: R } = configuration;
  const anime = (q, r) => (q.anime ?? []).includes(r);
  const couvre = (reservation, r) => reservation.portee === 'tous' || reservation.tour === r;
  const tableFixee = (id, r) => reservations.find((res) => res.participant === id && couvre(res, r))?.table;
  const libre = ({ id, capacite }, r) => reservations.filter((res) => res.table === id && couvre(res, r)).length < capacite;
  const animentA = (table, r, sauf) =>
    participants.filter((q) => q.id !== sauf && anime(q, r) && tableFixee(q.id, r) === table).map((q) => q.id);
  const borne = (id) => {
    const phi = new Set();
    let somme = 0;
    for (let r = 1; r <= R; r += 1) {
      const fixee = tableFixee(id, r);
      const occupables = fixee === undefined ? tables.filter((table) => libre(table, r)).map((table) => table.id) : [fixee];
      let plus = 0;
      for (const table of occupables) {
        const ici = animentA(table, r, id);
        for (const f of ici) phi.add(f);
        plus = Math.max(plus, ici.length);
      }
      somme += plus;
    }
    return Math.min(phi.size, somme);
  };
  // tours[r][i] : les personnes de la table configuration.tables[i] au tour r + 1.
  const rencontres = (id, tours) => {
    const vus = new Set();
    tours.forEach((listes, r) => {
      const liste = listes.find((occupants) => occupants.includes(id));
      for (const q of participants) if (q.id !== id && liste.includes(q.id) && anime(q, r + 1)) vus.add(q.id);
    });
    return vus.size;
  };
  return { borne, rencontres };
}

// Tous les plans indexés d'une instance qui assoient chacun à chaque tour,
// honorent les réservations et tiennent les capacités ; le même tableau est
// rendu, rempli, à chaque plan.
function* tousLesPlans({ N, T, R, capacite, fixe }) {
  const tableDe = new Int32Array(N * R);
  const occupation = new Int32Array(T * R);
  function* placer(i) {
    if (i === N * R) {
      yield tableDe;
      return;
    }
    const r = i % R;
    for (let t = 0; t < T; t += 1) {
      if ((fixe[i] !== LIBRE && fixe[i] !== t) || occupation[t * R + r] === capacite[t]) continue;
      occupation[t * R + r] += 1;
      tableDe[i] = t;
      yield* placer(i + 1);
      occupation[t * R + r] -= 1;
    }
  }
  yield* placer(0);
}

describe('mesurer : les animateurs rencontrés (§ 5.4, A9, A21)', () => {
  // Tables 31, 32, 33 de trois places, trois tours. 1 anime aux trois tours à
  // 31 ; 2 au seul tour 2, à 32 ; 3 et 4 aux trois tours à 33, qui porte deux
  // titres ; 5 à 9 sont libres.
  const M = configurer({
    personnes: [[1, undefined, [1, 2, 3]], [2, undefined, [2]], [3, undefined, [1, 2, 3]], [4, undefined, [1, 2, 3]], ...suite(5, 9).map((id) => [id])],
    tables: [[31, 3], [32, 3], [33, 3]],
    tours: 3,
    reservations: [
      { participant: 1, table: 31, portee: 'tous' },
      { participant: 2, table: 32, portee: 'tour', tour: 2 },
      { participant: 3, table: 33, portee: 'tous' },
      { participant: 4, table: 33, portee: 'tous' },
    ],
  });
  // 7 partage la table de 2 au tour 1, où 2 n'anime pas ; 8 la partage au
  // tour 3, et y rencontre 1 ; 3 et 4 se rencontrent à chaque tour.
  const TOURS_M = [
    [[1, 5, 6], [2, 7, 8], [3, 4, 9]],
    [[1, 7, 9], [2, 5, 6], [3, 4, 8]],
    [[1, 2, 8], [5, 7, 9], [3, 4, 6]],
  ];

  test('m(p), B(p), le minimum et les animateurs non rencontrés égalent une lecture faite couple par couple, tour par tour', () => {
    const { borne, rencontres } = lectureDesAnimateurs(M);
    const ids = suite(1, 9);
    const m = ids.map((id) => rencontres(id, TOURS_M));
    const B = ids.map(borne);
    const { animateurs } = mesurerSur(M, TOURS_M).mesures;
    assert.deepEqual(animateurs.rencontres, m);
    assert.deepEqual(animateurs.bornes, B);
    assert.equal(animateurs.nonRencontres, B.reduce((total, b, i) => total + b - m[i], 0));
    const concernes = ids.filter((_, i) => B[i] > 0);
    assert.equal(animateurs.concernes, concernes.length);
    const minDe = (garde) => Math.min(...ids.filter((id, i) => B[i] > 0 && garde(id)).map((id) => m[id - 1]));
    const ANCRES = [1, 3, 4];
    assert.equal(animateurs.agregat.tous.min, minDe(() => true));
    assert.equal(animateurs.agregat.mobiles.min, minDe((id) => !ANCRES.includes(id)));
    assert.equal(animateurs.agregat.ancres.min, minDe((id) => ANCRES.includes(id)));
    // Comptés à la main : 1 ne peut rencontrer personne qui anime (B = 0,
    // hors du minimum) ; 7 ne rencontre que 1, 2 n'animant pas au tour 1 ;
    // 3 rencontre 4 aux trois tours, compté une fois ; 6 rencontre les quatre.
    assert.deepEqual(B, [0, 3, 1, 1, 4, 4, 4, 4, 4]);
    assert.deepEqual(m, [0, 1, 1, 1, 2, 4, 1, 3, 3]);
    assert.equal(animateurs.concernes, 8);
    assert.deepEqual(animateurs.agregat.ancres, { min: 1, moyenne: 1, effectif: 2 });
  });

  test('la borne des animateurs tient sur tous les plans, et un plan l’atteint pour chacun', () => {
    // A : tables 1 et 2 de deux places, trois tours ; 1 anime aux trois tours
    // à 1 ; 2 aux tours 1 et 3 à 2. Le plan qui suit atteint B pour chacun :
    // tour 1, 1 et 4 | 2 et 3 ; tour 2, 1 et 2 | 3 et 4 ; tour 3, 1 et 3 |
    // 2 et 4.
    // B : 1 et 9 animent à 1, gelée avec 5, ancré ; 2 anime à 2, qui garde
    // deux sièges ; 3 et 4, libres, vont à 2 ou à 3. La borne qui
    // oublierait la table fixée de 5 n'y compterait que 2.
    // C : 2 et 3 animent à 2 aux deux tours, 1 à 1, 4 au seul tour 1 à 3 :
    // une table porte deux animateurs à chaque tour, et qui les rejoint en
    // rencontre deux à un même tour.
    const configurations = {
      A: configurer({
        personnes: [[1, undefined, [1, 2, 3]], [2, undefined, [1, 3]], [3], [4]],
        tables: [[1, 2], [2, 2]],
        tours: 3,
        reservations: [
          { participant: 1, table: 1, portee: 'tous' },
          { participant: 2, table: 2, portee: 'tour', tour: 1 },
          { participant: 2, table: 2, portee: 'tour', tour: 3 },
        ],
      }),
      B: configurer({
        personnes: [[1, undefined, [1, 2]], [2, undefined, [1, 2]], [3], [4], [5], [9, undefined, [1, 2]]],
        tables: [[1, 3], [2, 3], [3, 2]],
        tours: 2,
        reservations: [
          { participant: 1, table: 1, portee: 'tous' },
          { participant: 9, table: 1, portee: 'tous' },
          { participant: 5, table: 1, portee: 'tous' },
          { participant: 2, table: 2, portee: 'tous' },
        ],
      }),
      C: configurer({
        personnes: [[1, undefined, [1, 2]], [2, undefined, [1, 2]], [3, undefined, [1, 2]], [4, undefined, [1]], [5], [6], [7], [8]],
        tables: [[1, 2], [2, 3], [3, 3]],
        tours: 2,
        reservations: [
          { participant: 1, table: 1, portee: 'tous' },
          { participant: 2, table: 2, portee: 'tous' },
          { participant: 3, table: 2, portee: 'tous' },
          { participant: 4, table: 3, portee: 'tour', tour: 1 },
        ],
      }),
    };
    const atteintes = {};
    for (const [nom, configuration] of Object.entries(configurations)) {
      const instance = normaliser(configuration);
      let plans = 0;
      let atteinte = false;
      for (const tableDe of tousLesPlans(instance)) {
        plans += 1;
        const { animateurs } = mesurer(instance, tableDe);
        const depasse = animateurs.rencontres.findIndex((m, p) => m > animateurs.bornes[p]);
        assert.equal(depasse, -1, `${nom} : ${tableDe.join(',')}`);
        if (animateurs.nonRencontres === 0) atteinte = true;
      }
      assert.ok(plans > 1, `${nom} : ${plans} plans`);
      atteintes[nom] = atteinte;
    }
    assert.deepEqual(atteintes, { A: true, B: true, C: false });
    const A = normaliser(configurations.A);
    const plan = indexer(A, configurations.A, [[[1, 4], [2, 3]], [[1, 2], [3, 4]], [[1, 3], [2, 4]]]);
    const { animateurs } = mesurer(A, plan);
    assert.deepEqual(animateurs.bornes, [0, 1, 2, 2]);
    assert.deepEqual(animateurs.rencontres, animateurs.bornes);
    // B : 5, ancré à la table gelée, y rencontre ses deux animateurs ; 2
    // anime seul à sa table. C : 4, fixé au tour 1 à 3, où il anime seul,
    // rejoint au tour 2 au plus deux animateurs ; un libre en rencontre au
    // plus trois des quatre en deux tours, sous une borne de quatre.
    assert.deepEqual(Array.from(normaliser(configurations.B).borneAnimateurs), [1, 0, 1, 1, 2, 1]);
    assert.deepEqual(Array.from(normaliser(configurations.C).borneAnimateurs), [0, 1, 1, 2, 4, 4, 4, 4]);
  });

  test('un plan qui déplace une personne réservée ne compte ni tour servi ni rencontre hors des tables qu’elle peut occuper', () => {
    // 1 anime aux deux tours à la table 1, « finance », que 2, « finance »,
    // ancré, remplit avec lui ; 3, « finance », et 4 sont libres. Le plan
    // honoré sert 2 aux deux tours et lui fait rencontrer 1, une fois. Le plan
    // fautif assied 3 à la table 1, sans siège libre, au tour 1, et 2 à la
    // table 2 ; au tour 2, 2 revient à la table 1, que 1 a quittée.
    const configuration = configurer({
      personnes: [[1, undefined, [1, 2]], [2, ['finance']], [3, ['finance']], [4]],
      tables: [[1, 2], [2, 2]],
      tours: 2,
      reservations: [{ participant: 1, table: 1, portee: 'tous' }, { participant: 2, table: 1, portee: 'tous' }],
      objectifs: [{ table: 1, tour: null, regle: 'ou', etiquettes: ['finance'] }],
    });
    const honore = mesurerSur(configuration, [[[1, 2], [3, 4]], [[1, 2], [3, 4]]]).mesures;
    assert.deepEqual(honore.objectifs.tours, [0, 2, 0, 0]);
    assert.deepEqual(honore.animateurs.rencontres, [0, 1, 0, 0]);
    assert.deepEqual(honore.animateurs.bornes, [0, 1, 0, 0]);
    const fautif = mesurerSur(configuration, [[[1, 3], [2, 4]], [[2, 3], [1, 4]]]).mesures;
    assert.deepEqual(fautif.objectifs.tours, [0, 1, 0, 0]);
    assert.deepEqual(fautif.objectifs.possibles, [0, 2, 0, 0]);
    assert.deepEqual(fautif.animateurs.rencontres, [0, 0, 0, 0]);
    assert.equal(fautif.animateurs.nonRencontres, 1);
  });

  test('la première personne de l’ordre canonique compte parmi les concernés, seule concernée', () => {
    // 1, libre, peut rejoindre la table où 2 anime, réservé : B = 1, et le
    // plan l'y assoit. 2 n'a aucun autre animateur à rencontrer : B = 0.
    const configuration = configurer({
      personnes: [[1], [2, undefined, [1]]],
      tables: [[1, 2]],
      tours: 1,
      reservations: [{ participant: 2, table: 1, portee: 'tous' }],
    });
    const { animateurs } = mesurerSur(configuration, [[[1, 2]]]).mesures;
    const rencontre = { min: 1, moyenne: 1, effectif: 1 };
    assert.deepEqual(animateurs, {
      rencontres: [1, 0],
      bornes: [1, 0],
      nonRencontres: 0,
      concernes: 1,
      agregat: { tous: rencontre, mobiles: rencontre, ancres: AUCUN },
    });
  });

  test('sans personne concernée, les animateurs valent null : aucun titre pourvu, ou un seul animateur, seul présent', () => {
    const sans = configurer({ personnes: [[1], [2]], tables: [[1, 2]], tours: 1 });
    assert.equal(mesurerSur(sans, [[[1, 2]]]).mesures.animateurs, null);
    const seul = configurer({
      personnes: [[1, undefined, [1]]],
      tables: [[1, 2]],
      tours: 1,
      reservations: [{ participant: 1, table: 1, portee: 'tous' }],
    });
    assert.equal(mesurerSur(seul, [[[1]]]).mesures.animateurs, null);
  });
});

// Lecture directe de s(p) (§ 4.5) sur un plan qui honore les réservations,
// sans rien du module éprouvé : l'objectif en vigueur à une table est celui
// du tour s'il existe, sinon celui de la soirée ; « ou » demande une
// étiquette commune, « et » chacune. tours[r][i] : les personnes de la table
// configuration.tables[i] au tour r + 1.
function servisLus(configuration, tours) {
  const enVigueur = (table, tour) =>
    configuration.objectifs.find((o) => o.table === table && o.tour === tour)
    ?? configuration.objectifs.find((o) => o.table === table && o.tour === null);
  const correspond = (personne, table, tour) => {
    const o = enVigueur(table, tour);
    if (o === undefined) return false;
    const siennes = personne.etiquettes ?? [];
    return o.regle === 'ou' ? o.etiquettes.some((e) => siennes.includes(e)) : o.etiquettes.every((e) => siennes.includes(e));
  };
  return configuration.participants.map((personne) => {
    let servis = 0;
    tours.forEach((listes, r) => {
      const i = listes.findIndex((occupants) => occupants.includes(personne.id));
      if (correspond(personne, configuration.tables[i].id, r + 1)) servis += 1;
    });
    return servis;
  });
}

// Lecture directe des trois comptes par tour (§ 5.4, B4) sur un plan écrit
// par identifiants, sans rien du module éprouvé. Le couple (p, r) est
// possible quand la table fixée de p à ce tour lui correspond ou, p libre,
// quand une table qui garde un siège libre à ce tour en porte un qui lui
// correspond ; p est servi assis à une table qu'il peut occuper — sa table
// fixée, ou, libre, une table qui garde un siège libre — et dont l'objectif
// lui correspond. Par tour : Π_r, les couples possibles, réserve comprise ;
// S_r, les servis ; σ_r, les assis dont le couple n'est pas possible. Une
// personne absente des listes d'un tour y est en réserve.
function parTourLus(configuration, tours) {
  const { participants, tables, reservations, objectifs = [] } = configuration;
  const couvre = (reservation, tour) => reservation.portee === 'tous' || reservation.tour === tour;
  const fixee = (id, tour) => reservations.find((res) => res.participant === id && couvre(res, tour))?.table;
  const libre = (table, tour) => reservations.filter((res) => res.table === table.id && couvre(res, tour)).length < table.capacite;
  const enVigueur = (table, tour) =>
    objectifs.find((o) => o.table === table && o.tour === tour) ?? objectifs.find((o) => o.table === table && o.tour === null);
  const correspond = (personne, table, tour) => {
    const o = enVigueur(table, tour);
    if (o === undefined) return false;
    const siennes = personne.etiquettes ?? [];
    return o.regle === 'ou' ? o.etiquettes.some((e) => siennes.includes(e)) : o.etiquettes.every((e) => siennes.includes(e));
  };
  const occupable = (personne, table, tour) => {
    const t = fixee(personne.id, tour);
    return t === undefined ? libre(table, tour) : t === table.id;
  };
  const possible = (personne, tour) => {
    const t = fixee(personne.id, tour);
    if (t !== undefined) return correspond(personne, t, tour);
    return tables.some((table) => libre(table, tour) && correspond(personne, table.id, tour));
  };
  const presents = participants.filter((personne) => !personne.exclu);
  const lus = { servisParTour: [], possiblesParTour: [], assisSansCoupleParTour: [] };
  tours.forEach((listes, r) => {
    const tour = r + 1;
    let servis = 0;
    let possibles = 0;
    let sansCouple = 0;
    for (const personne of presents) {
      const ouvert = possible(personne, tour);
      if (ouvert) possibles += 1;
      const i = listes.findIndex((occupants) => occupants.includes(personne.id));
      if (i === -1) continue;
      if (!ouvert) sansCouple += 1;
      const table = tables[i];
      if (occupable(personne, table, tour) && correspond(personne, table.id, tour)) servis += 1;
    }
    lus.servisParTour.push(servis);
    lus.possiblesParTour.push(possibles);
    lus.assisSansCoupleParTour.push(sansCouple);
  });
  return lus;
}

// Les trois comptes par tour de parcourirTours, sur un plan écrit par
// identifiants, réserve comprise.
function parTourMesures(configuration, tours) {
  const instance = normaliser(configuration);
  const tables = configuration.tables.map(({ id }) => id);
  const assis = (r) => new Set(tours[r].flat());
  const reserves = tours.map((_, r) => configuration.participants.map(({ id }) => id).filter((id) => !assis(r).has(id)));
  const parcours = parcourirTours(instance, indexerPlan(instance, { tables, tours, reserves }));
  return {
    servisParTour: parcours.servisParTour,
    possiblesParTour: parcours.possiblesParTour,
    assisSansCoupleParTour: parcours.assisSansCoupleParTour,
    servis: parcours.servis,
  };
}

describe('parcourirTours : les servis, les possibles et les assis sans table possible de chaque tour (§ 5.4, B4, D36)', () => {
  test('dix « finance » pour une table de huit : 10 possibles et 8 servis par tour, les six sans étiquette assis sans table possible', () => {
    const tours = tenus([9, 10], [8, 10], [7, 10], [6, 10]);
    const mesures = parTourMesures(FINANCE, tours);
    assert.deepEqual(mesures.servisParTour, [8, 8, 8, 8]);
    assert.deepEqual(mesures.possiblesParTour, [10, 10, 10, 10]);
    assert.deepEqual(mesures.assisSansCoupleParTour, [6, 6, 6, 6]);
    const { servisParTour, possiblesParTour, assisSansCoupleParTour } = mesures;
    assert.deepEqual({ servisParTour, possiblesParTour, assisSansCoupleParTour }, parTourLus(FINANCE, tours));
  });

  test('une personne en réserve garde son couple possible, n’est ni servie ni assise sans table possible', () => {
    // Au tour 1, 1, « finance », et 11, sans étiquette, sont en réserve :
    // Π_1 garde 1 ; σ_1 perd 11 ; la table 1 sert huit « finance ».
    const tours = tenus([9, 10], [8, 10], [7, 10], [6, 10]);
    tours[0] = [suite(2, 9), [10, ...suite(12, 16)]];
    const { servisParTour, possiblesParTour, assisSansCoupleParTour } = parTourMesures(FINANCE, tours);
    assert.deepEqual(servisParTour, [8, 8, 8, 8]);
    assert.deepEqual(possiblesParTour, [10, 10, 10, 10]);
    assert.deepEqual(assisSansCoupleParTour, [5, 6, 6, 6]);
    assert.deepEqual({ servisParTour, possiblesParTour, assisSansCoupleParTour }, parTourLus(FINANCE, tours));
  });
});

describe('mesurer : un objectif et des sièges libres qui changent d’un tour à l’autre (§ 4.5, A9, A21)', () => {
  // Tables 1, 2, 3 de trois places, trois tours. La table 1 porte « finance »
  // pour la soirée, « bénévole » au tour 2 ; la table 2, « bénévole » pour la
  // soirée, « toutes : finance, Montréal » au tour 3 ; la table 3,
  // « finance » au seul tour 1. 5, 6 et 8 réservés au tour 1 gèlent la
  // table 2 à ce tour ; 8 y anime ; 7, réservé au tour 2 à la table 2, y
  // anime.
  const VARIABLE = configurer({
    personnes: [
      [1, ['finance']],
      [2, ['finance', 'Montréal']],
      [3, ['bénévole']],
      [4, ['bénévole', 'finance']],
      [5],
      [6, ['Montréal']],
      [7, ['finance'], [2]],
      [8, ['bénévole'], [1]],
      [9, ['finance']],
    ],
    tables: [[1, 3], [2, 3], [3, 3]],
    tours: 3,
    reservations: [
      { participant: 5, table: 2, portee: 'tour', tour: 1 },
      { participant: 6, table: 2, portee: 'tour', tour: 1 },
      { participant: 8, table: 2, portee: 'tour', tour: 1 },
      { participant: 7, table: 2, portee: 'tour', tour: 2 },
    ],
    objectifs: [
      { table: 1, tour: null, regle: 'ou', etiquettes: ['finance'] },
      { table: 1, tour: 2, regle: 'ou', etiquettes: ['bénévole'] },
      { table: 2, tour: null, regle: 'ou', etiquettes: ['bénévole'] },
      { table: 2, tour: 3, regle: 'et', etiquettes: ['finance', 'Montréal'] },
      { table: 3, tour: 1, regle: 'ou', etiquettes: ['finance'] },
    ],
  });
  // Au tour 2, 1 et 9, « finance », s'assoient à la table 1 sous
  // « bénévole » ; 3 et 5, libres, à la table 2, gelée au tour 1, où 7 anime.
  const TOURS_V = [
    [[1, 2, 3], [5, 6, 8], [4, 7, 9]],
    [[1, 4, 9], [3, 5, 7], [2, 6, 8]],
    [[3, 5, 7], [2, 4, 6], [1, 8, 9]],
  ];

  test('s(p) et m(p) égalent une lecture directe : l’objectif du tour remplace celui de la soirée, la table gelée à un seul tour sert aux autres', () => {
    const { mesures } = mesurerSur(VARIABLE, TOURS_V);
    const { rencontres } = lectureDesAnimateurs(VARIABLE);
    const s = servisLus(VARIABLE, TOURS_V);
    const m = suite(1, 9).map((id) => rencontres(id, TOURS_V));
    assert.deepEqual(mesures.objectifs.tours, s);
    assert.deepEqual(mesures.animateurs.rencontres, m);
    // Comptés à la main : 1 et 9 ne sont servis qu'au tour 1 ; 3 l'est au
    // tour 2 à la table 2 ; 2 au tour 3 sous « toutes ». 5 rencontre 8 au
    // tour 1, 7 au tour 2 ; 3 rencontre 7.
    assert.deepEqual(s, [1, 2, 1, 2, 0, 0, 2, 1, 1]);
    assert.deepEqual(m, [0, 0, 1, 0, 2, 1, 0, 0, 0]);
  });

  test('S_r, Π_r et σ_r égalent une lecture directe, et S_r somme s(p) : l’objectif du tour remplace celui de la soirée, la table gelée n’offre rien', () => {
    // Comptés à la main. Tour 1 : la table 2, gelée, n'offre rien ; 8 y est
    // fixé sous « bénévole » ; les « finance » libres ont les tables 1 et 3 :
    // Π_1 = 6, tous servis ; 3, 5 et 6 sans table possible. Tour 2 : 7, fixé
    // à la table 2 sous « bénévole », n'a pas de couple ; 3, 4 et 8 en ont
    // un ; 4 et 3 sont servis ; six assis sans table possible. Tour 3 : les
    // cinq « finance », 2 aussi sous « toutes » ; 7 et 2 servis.
    const mesures = parTourMesures(VARIABLE, TOURS_V);
    assert.deepEqual(mesures.servisParTour, [6, 2, 2]);
    assert.deepEqual(mesures.possiblesParTour, [6, 3, 5]);
    assert.deepEqual(mesures.assisSansCoupleParTour, [3, 6, 4]);
    const { servisParTour, possiblesParTour, assisSansCoupleParTour } = mesures;
    assert.deepEqual({ servisParTour, possiblesParTour, assisSansCoupleParTour }, parTourLus(VARIABLE, TOURS_V));
    const somme = (valeurs) => valeurs.reduce((total, valeur) => total + valeur, 0);
    assert.equal(somme(servisParTour), somme(mesures.servis));
    const instance = normaliser(VARIABLE);
    assert.equal(somme(possiblesParTour), somme(instance.possibles));
  });
});

describe('mesurer et assisAChaqueTourPresent : les tours de présence (§ 5.4, § 12.4)', () => {
  // Des personnes sans organisation, d'identifiants 1..presences.length,
  // presences[i] étant la présence de i + 1 (undefined : chaque tour) ; une
  // table de capacité donnée par élément de capacites, d'identifiants 1, 2…
  // tours[r][i] liste les assis de la table i + 1 au tour r + 1, reserves[r]
  // les présents qui n'y sont assis nulle part.
  function avecPresences({ presences, capacites, tours, reserves = tours.map(() => []) }) {
    const participants = presences.map((presence, i) => ({
      id: i + 1,
      nom: `P${i + 1}`,
      organisation: null,
      ...(presence === undefined ? {} : { presence }),
    }));
    const tables = capacites.map((capacite, i) => ({ id: i + 1, numero: i + 1, capacite }));
    const instance = normaliser({ participants, tables, tours: tours.length, reservations: [], contraintes: SANS_CONTRAINTE });
    const tableDe = indexerPlan(instance, { tables: tables.map(({ id }) => id), tours, reserves });
    return { instance, tableDe };
  }

  // Une table de 3, deux tours ; 3 n'est présente qu'au tour 1. Ses
  // rencontres du tour 1 comptent pour 1 et 2, qui se revoient au tour 2 :
  // la paire {1, 2} est la seule répétée, choisie.
  const UNE_ABSENTE = { presences: [undefined, undefined, [1]], capacites: [3], tours: [[[1, 2, 3]], [[1, 2]]] };

  test('une absente vaut la réserve dans le plan indexé, et ses rencontres des tours où elle est assise comptent', () => {
    const { instance, tableDe } = avecPresences(UNE_ABSENTE);
    assert.deepEqual(Array.from(tableDe), [0, 0, 0, 0, 0, RESERVE]);
    const mesures = mesurer(instance, tableDe);
    assert.deepEqual(mesures.rencontres, [2, 2, 2]);
    assert.deepEqual(mesures.toursAssis, [2, 2, 1]);
    assert.deepEqual(mesures.rencontresRepetees, { choisies: 1, imposees: 0 });
    assert.equal(mesures.maxRencontresPaire, 2);
  });

  test('vrai quand chacun est assis à chacun de ses tours de présence, une absente omise comprise', () => {
    const { instance, tableDe } = avecPresences(UNE_ABSENTE);
    assert.equal(assisAChaqueTourPresent(instance, mesurer(instance, tableDe).toursAssis), true);
  });

  test('vrai sans absence quand chacun est assis à chaque tour', () => {
    const { instance, tableDe } = avecPresences({ presences: [undefined, undefined, undefined], capacites: [3], tours: [[[1, 2, 3]], [[1, 2, 3]]] });
    assert.equal(assisAChaqueTourPresent(instance, mesurer(instance, tableDe).toursAssis), true);
  });

  test('faux quand une présente est en réserve, sans absence comme sous absence', () => {
    const sansAbsence = avecPresences({ presences: [undefined, undefined, undefined], capacites: [3], tours: [[[1, 2, 3]], [[1, 2]]], reserves: [[], [3]] });
    assert.equal(assisAChaqueTourPresent(sansAbsence.instance, mesurer(sansAbsence.instance, sansAbsence.tableDe).toursAssis), false);
    // 4 n'est présente qu'au tour 2, où la table de 3 laisse 3 en réserve.
    const sousAbsence = avecPresences({
      presences: [undefined, undefined, undefined, [2]],
      capacites: [3],
      tours: [[[1, 2, 3]], [[1, 2, 4]]],
      reserves: [[], [3]],
    });
    assert.equal(assisAChaqueTourPresent(sousAbsence.instance, mesurer(sousAbsence.instance, sousAbsence.tableDe).toursAssis), false);
  });

  test('lit toursPresents et non R : un tableau de tours assis égal à R partout est faux pour qui n’a qu’un tour de présence', () => {
    const { instance } = avecPresences(UNE_ABSENTE);
    assert.equal(assisAChaqueTourPresent(instance, [2, 2, 2]), false);
    assert.equal(assisAChaqueTourPresent(instance, [2, 2, 1]), true);
  });

  test('chaque personne compte : un seul écart, à la première, à la deuxième ou à la dernière, rend faux', () => {
    // toursPresents vaut [2, 2, 1] ; chaque ligne n'écarte qu'une personne.
    const { instance } = avecPresences(UNE_ABSENTE);
    assert.equal(assisAChaqueTourPresent(instance, [1, 2, 1]), false);
    assert.equal(assisAChaqueTourPresent(instance, [2, 1, 1]), false);
    assert.equal(assisAChaqueTourPresent(instance, [2, 2, 0]), false);
  });
});

describe('mesurer : les inclusions (§ 5.4, § 13.2)', () => {
  // Participants 1..N : organisation[i] et, quand il est donné, champs[i],
  // les listes d'inclusions du participant i + 1. Tables 1..T de la capacité
  // donnée ; tours[r][t] liste les assis de la table t + 1 au tour r + 1.
  function preparerInclusions({ organisation, champs = [], capacite, tours }) {
    const instance = normaliser({
      participants: organisation.map((libelle, i) => ({ id: i + 1, nom: `P${i + 1}`, organisation: libelle, ...champs[i] })),
      tables: tours[0].map((_, t) => ({ id: t + 1, numero: t + 1, capacite })),
      tours: tours.length,
      reservations: [],
      contraintes: SANS_CONTRAINTE,
    });
    const tableDe = indexerPlan(instance, {
      tables: tours[0].map((_, t) => t + 1),
      tours,
      reserves: tours.map(() => []),
    });
    return { instance, tableDe };
  }

  test('lignes satisfaites à n’importe quel tour, une unité par paire réciproque, un avis par unité non satisfaite', () => {
    // Rameau : 1, 2 ; Saule : 3, 5. 1 inclut la Saule, 3 et 6 ; 2 inclut 3 ;
    // 3 inclut 2 ; 4 inclut le Rameau. Deux tours, deux tables de 3 : 1
    // rencontre 3, de la Saule, au tour 2 seulement ; 2 et 3 ne se
    // rencontrent jamais, ni 1 et 6 ; 4 rencontre 1 et 2.
    const { instance, tableDe } = preparerInclusions({
      organisation: ['Rameau', 'Rameau', 'Saule', null, 'Saule', null],
      champs: [
        { inclusionsOrganisation: ['Saule'], inclusionsParticipant: [3, 6] },
        { inclusionsParticipant: [3] },
        { inclusionsParticipant: [2] },
        { inclusionsOrganisation: ['Rameau'] },
      ],
      capacite: 3,
      tours: [[[1, 2, 4], [3, 5, 6]], [[2, 5, 6], [1, 3, 4]]],
    });
    // Groupes : Rameau 0, Saule 1. Cinq unités : 1 → Saule, 1 → 3,
    // 1 → 6, 2 ↔ 3, 4 → Rameau.
    assert.deepEqual(mesurer(instance, tableDe).inclusions, {
      cible: 5,
      satisfaites: 3,
      avis: 2,
      nonSatisfaites: [
        { p: 0, cible: 5, reciproque: false },
        { p: 1, cible: 2, reciproque: true },
      ],
      parPersonne: [
        { p: 0, actives: 3, besoin: 2, plafond: 4, atteignables: 3, satisfaites: 2, auDelaDuPlafond: false },
        { p: 1, actives: 1, besoin: 1, plafond: 4, atteignables: 1, satisfaites: 0, auDelaDuPlafond: false },
        { p: 2, actives: 1, besoin: 1, plafond: 4, atteignables: 1, satisfaites: 0, auDelaDuPlafond: false },
        { p: 3, actives: 1, besoin: 1, plafond: 4, atteignables: 1, satisfaites: 1, auDelaDuPlafond: false },
      ],
    });
  });

  test('une liste au-delà du plafond ne fait aucun avis : ses lignes non satisfaites ne sont que comptées', () => {
    // Un tour, deux tables de 2 : 1 rencontre une personne au plus et en
    // inclut trois.
    const { instance, tableDe } = preparerInclusions({
      organisation: [null, null, null, null],
      champs: [{ inclusionsParticipant: [2, 3, 4] }],
      capacite: 2,
      tours: [[[1, 2], [3, 4]]],
    });
    assert.deepEqual(mesurer(instance, tableDe).inclusions, {
      cible: 0,
      satisfaites: 0,
      avis: 0,
      nonSatisfaites: [],
      parPersonne: [{ p: 0, actives: 3, besoin: 3, plafond: 1, atteignables: 1, satisfaites: 1, auDelaDuPlafond: true }],
    });
  });

  test('sans ligne active, les inclusions valent null, même quand des lignes sont hors d’atteinte', () => {
    const { instance, tableDe } = preparerInclusions({
      organisation: ['Rameau', null],
      champs: [{ inclusionsOrganisation: ['Vigie'] }],
      capacite: 2,
      tours: [[[1, 2]]],
    });
    assert.equal(instance.inclusionsHorsAtteinte.length, 1);
    assert.equal(mesurer(instance, tableDe).inclusions, null);
  });

  test('inclusionSatisfaite lit la paire dans les deux sens, et l’organisation dans vu', () => {
    // 1 et 3 se rencontrent au tour 2 ; 2 ne rencontre personne.
    const { instance, tableDe } = preparerInclusions({
      organisation: ['Rameau', 'Saule', null],
      capacite: 2,
      tours: [[[1], [2], [3]], [[1, 3], [2], []]],
    });
    const { parPaire } = parcourirTours(instance, tableDe);
    // vu[p × G + g] : 1 a vu le Rameau seulement, posé à la main.
    const vu = Uint8Array.from([1, 0, 0, 0, 0, 0]);
    assert.equal(inclusionSatisfaite(instance, { parPaire, vu }, 0, 2), true);
    assert.equal(inclusionSatisfaite(instance, { parPaire, vu }, 2, 0), true);
    assert.equal(inclusionSatisfaite(instance, { parPaire, vu }, 0, 1), false);
    assert.equal(inclusionSatisfaite(instance, { parPaire, vu }, 1, 2), false);
    assert.equal(inclusionSatisfaite(instance, { parPaire, vu }, 0, -1), true);
    assert.equal(inclusionSatisfaite(instance, { parPaire, vu }, 0, -2), false);
    assert.equal(inclusionSatisfaite(instance, { parPaire, vu }, 2, -1), false);
  });

  test('cent plans tirés : les lignes satisfaites et les avis de la mesure sont ceux d’une lecture naïve du plan', () => {
    const ORGANISATIONS = ['Rameau', 'Saule', null];
    let avisVus = 0;
    let satisfaitesVues = 0;
    for (let i = 0; i < 100; i += 1) {
      const alea = creerPcg32(9_100 + i, FLUX.DEMO);
      const N = 3 + alea.borne(6);
      const T = 1 + alea.borne(3);
      const R = 1 + alea.borne(3);
      const organisation = Array.from({ length: N }, () => ORGANISATIONS[alea.borne(ORGANISATIONS.length)]);
      const participants = organisation.map((libelle, p) => ({
        id: p + 1,
        nom: `P${p + 1}`,
        organisation: libelle,
        inclusionsOrganisation: ['Rameau', 'Saule'].filter((nom) => nom !== libelle && alea.borne(3) === 0),
        inclusionsParticipant: Array.from({ length: N }, (_, q) => q + 1).filter((id) => id !== p + 1 && alea.borne(3) === 0),
      }));
      const instance = normaliser({
        participants,
        tables: Array.from({ length: T }, (_, t) => ({ id: t + 1, numero: t + 1, capacite: N })),
        tours: R,
        reservations: [],
        contraintes: SANS_CONTRAINTE,
      });
      const tableDe = Int32Array.from({ length: N * R }, () => alea.borne(T + 1) - 1);
      const { inclusions } = mesurer(instance, tableDe);
      if (instance.inclusionsActives === 0) {
        assert.equal(inclusions, null);
        continue;
      }
      // La lecture naïve : p et q se rencontrent quand un tour les assied à
      // la même table.
      const rencontre = (p, q) => {
        for (let r = 0; r < R; r += 1) {
          if (tableDe[p * R + r] !== RESERVE && tableDe[p * R + r] === tableDe[q * R + r]) return true;
        }
        return false;
      };
      const { groupe, groupes, inclusionDebut, inclusionCible } = instance;
      const satisfaite = (p, c) =>
        c >= 0 ? rencontre(p, c) : Array.from({ length: N }, (_, q) => q).some((q) => q !== p && groupe[q] === -1 - c && rencontre(p, q));
      // Les tables de N places et sans réservation laissent chacun
      // rencontrer chacun : une organisation d'un seul membre demande la
      // rencontre de ce membre, comme une ligne de personne.
      const membres = (g) => Array.from({ length: N }, (_, q) => q).filter((q) => groupe[q] === g);
      const unite = (p, c) => {
        const q = c >= 0 ? c : membres(-1 - c).length === 1 ? membres(-1 - c)[0] : -1;
        return q < 0 ? `${p} → ${groupes[-1 - c]}` : `${Math.min(p, q)} ↔ ${Math.max(p, q)}`;
      };
      const unites = new Set();
      for (const { p, satisfaites, auDelaDuPlafond } of inclusions.parPersonne) {
        const lignes = Array.from(inclusionCible.subarray(inclusionDebut[p], inclusionDebut[p + 1]));
        assert.equal(satisfaites, lignes.filter((c) => satisfaite(p, c)).length, `plan ${i}, personne ${p}`);
        satisfaitesVues += satisfaites;
        if (auDelaDuPlafond) continue;
        for (const c of lignes) {
          if (satisfaite(p, c)) continue;
          unites.add(unite(p, c));
        }
      }
      assert.equal(inclusions.avis, unites.size, `plan ${i}`);
      avisVus += inclusions.avis;
    }
    assert.ok(avisVus >= 50, `${avisVus} avis`);
    assert.ok(satisfaitesVues >= 50, `${satisfaitesVues} lignes satisfaites`);
  });
});
