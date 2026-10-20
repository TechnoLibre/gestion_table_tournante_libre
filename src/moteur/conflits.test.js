// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves des conflits par table (§ 7.5, § 5.4). Chaque plan s'écrit par
// identifiants, une liste par table, et passe par normaliser et indexerPlan
// comme un plan enregistré ; chaque valeur attendue se compte à la main dans
// le commentaire qui la précède. Les mesures citées viennent de mesurer :
// conflitsParTable et elle lisent le même parcours, et leurs chiffres
// s'accordent par construction.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { CATALOGUE, PLAN_PARFAIT_PETITE } from '../demo/catalogue.js';
import { conflitsParTable } from './conflits.js';
import { indexerPlan, normaliser } from './configuration.js';
import { mesurer } from './indicateurs.js';

const TOUTES = Object.freeze({
  separerOrganisations: true,
  nouveauxVoisins: true,
  nouvelleTable: true,
  varierOrganisations: true,
});

const MERLES = 'Club des Merles';

const tous = (participant, table) => ({ participant, table, portee: 'tous' });
const auTour = (participant, table, tour) => ({ participant, table, portee: 'tour', tour });

// Une table sans violation.
const sansConflit = (table) => ({ table, nombre: 0, regles: [] });

/**
 * Instance et plan indexé d'un plan écrit par identifiants. ids[i] porte
 * organisation[i] (par défaut, l'identifiant i + 1) ; idsTables[i] est
 * l'identifiant de la table d'index i (par défaut i + 1), de la capacité
 * donnée ; tours[r][i] liste les participants assis à la table d'index i au
 * tour r + 1.
 */
function preparer({
  organisation,
  ids = organisation.map((_, i) => i + 1),
  capacite,
  idsTables,
  tours,
  reservations = [],
  contraintes = TOUTES,
}) {
  const participants = organisation.map((libelle, i) => ({
    id: ids[i],
    nom: `P${ids[i]}`,
    organisation: libelle,
  }));
  const tables = (idsTables ?? tours[0].map((_, i) => i + 1)).map((id, i) => ({
    id,
    numero: i + 1,
    capacite,
  }));
  const instance = normaliser({
    participants,
    tables,
    tours: tours.length,
    reservations,
    contraintes: { ...contraintes },
  });
  const plan = { tables: tables.map(({ id }) => id), tours, reserves: tours.map(() => []) };
  return { instance, tableDe: indexerPlan(instance, plan) };
}

function conflits(description) {
  const { instance, tableDe } = preparer(description);
  return conflitsParTable(instance, tableDe);
}

function mesures(description) {
  const { instance, tableDe } = preparer(description);
  return mesurer(instance, tableDe);
}

// Six personnes, 1 et 2 du Club des Merles, trois tables de 2, deux tours.
const SIX = [MERLES, MERLES, null, null, null, null];
const TOUR_1 = [[3, 4], [1, 2], [5, 6]];

describe('conflitsParTable', () => {
  test('séparer : la table 2 réunit 1 et 2 au tour 1, une violation ; aucune autre table, à aucun tour', () => {
    // Au tour 2, (2, 6), (3, 5) et (1, 4) se rencontrent pour la première
    // fois, et chacun change de table.
    const description = { organisation: SIX, capacite: 2, tours: [TOUR_1, [[2, 6], [3, 5], [1, 4]]] };
    assert.deepEqual(conflits(description), [
      [
        sansConflit(1),
        { table: 2, nombre: 1, regles: [{ regle: 'separerOrganisations', paires: [[1, 2]] }] },
        sansConflit(3),
      ],
      [sansConflit(1), sansConflit(2), sansConflit(3)],
    ]);
    const sansSeparer = conflits({
      ...description,
      contraintes: { ...TOUTES, separerOrganisations: false },
    });
    assert.deepEqual(sansSeparer, [
      [sansConflit(1), sansConflit(2), sansConflit(3)],
      [sansConflit(1), sansConflit(2), sansConflit(3)],
    ]);
  });

  test('nouvelle table : 3 revient à la table 1, 2 à la table 2 ; une visite réservée deux fois ne se signale pas', () => {
    // Tour 2 : [3, 6], [2, 5], [1, 4]. 3 était à la table 1 au tour 1, 2 à
    // la table 2 ; 6, 5, 1 et 4 découvrent la leur.
    const description = { organisation: SIX, capacite: 2, tours: [TOUR_1, [[3, 6], [2, 5], [1, 4]]] };
    const auTour2 = (resultat) => resultat[1];
    assert.deepEqual(auTour2(conflits(description)), [
      { table: 1, nombre: 1, regles: [{ regle: 'nouvelleTable', personnes: [3] }] },
      { table: 2, nombre: 1, regles: [{ regle: 'nouvelleTable', personnes: [2] }] },
      sansConflit(3),
    ]);
    // 3 ancré à la table 1 : réservé au tour 2 et à sa visite du tour 1, son
    // retour est imposé.
    const ancre = { ...description, reservations: [tous(3, 1)] };
    assert.deepEqual(auTour2(conflits(ancre)), [
      sansConflit(1),
      { table: 2, nombre: 1, regles: [{ regle: 'nouvelleTable', personnes: [2] }] },
      sansConflit(3),
    ]);
    assert.deepEqual(mesures(ancre).retoursImposes, [0, 0, 1, 0, 0, 0]);
    // 3 réservé à la table 1 au seul tour 2 : sa visite du tour 1 était
    // libre, le retour est choisi, et la mesure le compte choisi.
    const tour2 = { ...description, reservations: [auTour(3, 1, 2)] };
    assert.deepEqual(auTour2(conflits(tour2))[0], {
      table: 1,
      nombre: 1,
      regles: [{ regle: 'nouvelleTable', personnes: [3] }],
    });
    assert.deepEqual(mesures(tour2).retoursChoisis, [0, 1, 1, 0, 0, 0]);
    assert.deepEqual(mesures(tour2).retoursImposes, [0, 0, 0, 0, 0, 0]);
  });

  test('nouveaux voisins : une paire réunie librement puis réservée ensemble reste signalée ; réservée aux deux rencontres, elle ne l’est plus', () => {
    // Quatre personnes sans organisation, deux tables de 2. Tour 1 : [1, 2],
    // [3, 4] ; tour 2 : [3, 4], [1, 2]. Personne ne revient à sa table.
    const description = {
      organisation: [null, null, null, null],
      capacite: 2,
      tours: [
        [[1, 2], [3, 4]],
        [[3, 4], [1, 2]],
      ],
      reservations: [auTour(3, 1, 2), auTour(4, 1, 2)],
    };
    assert.deepEqual(conflits(description)[1], [
      { table: 1, nombre: 1, regles: [{ regle: 'nouveauxVoisins', paires: [[3, 4]] }] },
      { table: 2, nombre: 1, regles: [{ regle: 'nouveauxVoisins', paires: [[1, 2]] }] },
    ]);
    assert.deepEqual(mesures(description).rencontresRepetees, { choisies: 2, imposees: 0 });
    // 3 et 4 réservés aussi à la table 2 au tour 1 : chacune de leurs
    // rencontres est réservée pour les deux.
    const imposee = {
      ...description,
      reservations: [...description.reservations, auTour(3, 2, 1), auTour(4, 2, 1)],
    };
    assert.deepEqual(conflits(imposee)[1], [
      sansConflit(1),
      { table: 2, nombre: 1, regles: [{ regle: 'nouveauxVoisins', paires: [[1, 2]] }] },
    ]);
    assert.deepEqual(mesures(imposee).rencontresRepetees, { choisies: 1, imposees: 1 });
  });

  test('les trois règles à une même table, dans leur ordre, comptées ensemble, en identifiants', () => {
    // Participants 5, 9, 14 et 20 ; 5 et 9 de Grisaille. Tables d'identifiants
    // 40 puis 10, dans cet ordre de configuration. Les deux mêmes paires aux
    // deux tours : au tour 2, la table 40 porte (5, 9) collègues et revus, 5
    // et 9 revenus, quatre violations ; la table 10, (14, 20) revus, 14 et
    // 20 revenus, trois.
    const description = {
      organisation: ['Grisaille', 'Grisaille', null, null],
      ids: [5, 9, 14, 20],
      idsTables: [40, 10],
      capacite: 2,
      tours: [
        [[5, 9], [14, 20]],
        [[5, 9], [14, 20]],
      ],
    };
    assert.deepEqual(conflits(description), [
      [
        { table: 40, nombre: 1, regles: [{ regle: 'separerOrganisations', paires: [[5, 9]] }] },
        sansConflit(10),
      ],
      [
        {
          table: 40,
          nombre: 4,
          regles: [
            { regle: 'separerOrganisations', paires: [[5, 9]] },
            { regle: 'nouveauxVoisins', paires: [[5, 9]] },
            { regle: 'nouvelleTable', personnes: [5, 9] },
          ],
        },
        {
          table: 10,
          nombre: 3,
          regles: [
            { regle: 'nouveauxVoisins', paires: [[14, 20]] },
            { regle: 'nouvelleTable', personnes: [14, 20] },
          ],
        },
      ],
    ]);
    // Une règle inactive est omise, les autres gardent leur ordre.
    const sansVoisins = conflits({ ...description, contraintes: { ...TOUTES, nouveauxVoisins: false } });
    assert.deepEqual(sansVoisins[1][0], {
      table: 40,
      nombre: 3,
      regles: [
        { regle: 'separerOrganisations', paires: [[5, 9]] },
        { regle: 'nouvelleTable', personnes: [5, 9] },
      ],
    });
    const sansTable = conflits({ ...description, contraintes: { ...TOUTES, nouvelleTable: false } });
    assert.deepEqual(sansTable[1][1], {
      table: 10,
      nombre: 1,
      regles: [{ regle: 'nouveauxVoisins', paires: [[14, 20]] }],
    });
  });

  test('une table de plusieurs collègues : chaque paire, identifiants croissants, paires dans l’ordre lexicographique', () => {
    // 2, 4, 6 et 8 du Club des Merles, assis tous les quatre à une table de 5
    // avec 3, donné avant eux dans la liste : C(4, 2) = 6 paires.
    const resultat = conflits({
      organisation: [null, MERLES, null, MERLES, MERLES, MERLES],
      ids: [1, 2, 3, 4, 6, 8],
      capacite: 5,
      tours: [[[8, 6, 3, 4, 2], [1]]],
    });
    assert.deepEqual(resultat[0][0], {
      table: 1,
      nombre: 6,
      regles: [
        {
          regle: 'separerOrganisations',
          paires: [[2, 4], [2, 6], [2, 8], [4, 6], [4, 8], [6, 8]],
        },
      ],
    });
  });

  test('une seule table, un seul tour : aucune violation, des répétitions à zéro, sans lever (§ 15.4)', () => {
    // Trois personnes, 3 seule du Club des Merles. 1 et 2 rencontrent un
    // affilié d'une organisation : A = 1, d = 1 ; 3 n'en rencontre aucun :
    // A = 0, et il sort de l'effectif de la diversité.
    const description = {
      organisation: [null, null, MERLES],
      capacite: 3,
      tours: [[[1, 2, 3]]],
    };
    assert.deepEqual(conflits(description), [[sansConflit(1)]]);
    const { rencontresRepetees, aggOrganisationsVues, aggDiversite } = mesures(description);
    assert.deepEqual(rencontresRepetees, { choisies: 0, imposees: 0 });
    assert.deepEqual(aggOrganisationsVues.tous, { min: 0, moyenne: 2 / 3, effectif: 3 });
    assert.deepEqual(aggDiversite.tous, { min: 1, moyenne: 1, effectif: 2 });
  });

  test('aucun présent : une table, deux tours, chacun à zéro, sans lever', () => {
    const instance = normaliser({
      participants: [{ id: 1, nom: 'P1', organisation: MERLES, exclu: true }],
      tables: [{ id: 1, numero: 1, capacite: 2 }],
      tours: 2,
      reservations: [],
      contraintes: { ...TOUTES },
    });
    assert.deepEqual(conflitsParTable(instance, new Int32Array(0)), [[sansConflit(1)], [sansConflit(1)]]);
  });

  test('plan parfait de la petite démonstration : aucune violation, à chaque table de chaque tour', () => {
    const configuration = CATALOGUE.find(({ cle }) => cle === 'petite').construire();
    const instance = normaliser({ ...configuration, contraintes: { ...TOUTES } });
    const resultat = conflitsParTable(instance, indexerPlan(instance, PLAN_PARFAIT_PETITE));
    const cases = resultat.flat();
    assert.equal(cases.length, 16);
    for (const [k, { nombre, regles }] of cases.entries()) {
      assert.equal(nombre, 0, `case ${k}`);
      assert.deepEqual(regles, [], `case ${k}`);
    }
  });

  test("lève ce que lève exigerPlanIndexe, et ne modifie ni l'instance ni le plan", () => {
    const { instance, tableDe } = preparer({
      organisation: SIX,
      capacite: 2,
      tours: [TOUR_1, [[3, 6], [2, 5], [1, 4]]],
    });
    assert.throws(() => conflitsParTable(instance, tableDe.subarray(1)), RangeError);
    const avant = { tableDe: tableDe.slice(), fixe: instance.fixe.slice(), groupe: instance.groupe.slice() };
    conflitsParTable(instance, tableDe);
    assert.deepEqual({ tableDe, fixe: instance.fixe, groupe: instance.groupe }, avant);
  });
});
