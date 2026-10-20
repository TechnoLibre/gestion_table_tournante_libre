// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de la configuration (§ 4, § 5.2, § 5.9) : les valeurs du contrat
// de données, l'instance indexée que rend normaliser et ses refus, le nombre
// de places et de places manquantes, la conversion d'un plan entre la forme
// par identifiants et la forme indexée, la garde de forme d'un plan indexé
// et la répartition des personnes entre les trois populations du § 5.4. Les
// identifiants diffèrent des index qu'ils reçoivent et des tables arrivent
// hors de l'ordre de leurs identifiants : confondre un identifiant et un index
// fait échouer une épreuve au lieu de passer inaperçu.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { ErreurAnnulee, ErreurConfiguration } from './erreurs.js';
import {
  LIBRE,
  NON_ANIMATEUR,
  RESERVE,
  SANS_GROUPE,
  SANS_OBJECTIF,
  STATUT,
  exigerPlanIndexe,
  figerConfiguration,
  indexerPlan,
  nombrePlaces,
  nombrePlacesManquantes,
  normaliser,
  placesManquantesParTour,
  planDepuisIndex,
  replierParPopulation,
} from './configuration.js';
import { CRITERES, PRIORITES_PAR_DEFAUT, verifierPriorites } from './criteres.js';
import { diversiteAnimateurs } from './diversite.js';
import { mesurer } from './indicateurs.js';
import { occupations, plafondsRealises } from './plafond.js';

const { MOBILE, PARTIELLEMENT_FIXE, ANCRE } = STATUT;

const SANS_CONTRAINTE = {
  separerOrganisations: false,
  nouveauxVoisins: false,
  nouvelleTable: false,
  varierOrganisations: false,
};

// Entiers de debut à fin, inclus.
const suite = (debut, fin) => Array.from({ length: fin - debut + 1 }, (_, i) => debut + i);

// Participants des identifiants donnés, sans organisation.
const personnes = (ids) => ids.map((id) => ({ id, nom: `P${id}`, organisation: null }));
const exclu = (id) => ({ id, nom: `P${id}`, organisation: null, exclu: true });

// Tables des identifiants donnés, toutes de la même capacité, numérotées dans
// l'ordre fourni.
const tablesDe = (ids, capacite) => ids.map((id, i) => ({ id, numero: i + 1, capacite }));

const tous = (participant, table) => ({ participant, table, portee: 'tous' });
const auTour = (participant, table, tour) => ({ participant, table, portee: 'tour', tour });

// Libellé d'une valeur de cas : une chaîne se distingue du nombre qu'elle écrit.
const libelleDe = (valeur) => (typeof valeur === 'string' ? `« ${valeur} » en texte` : String(valeur));

const configuration = ({
  participants,
  tables,
  tours,
  reservations = [],
  contraintes = SANS_CONTRAINTE,
}) => ({ participants, tables, tours, reservations, contraintes });

// Gèle une valeur et tout ce qu'elle contient : une écriture y lève
// TypeError, le module s'exécutant en mode strict.
function geler(valeur) {
  if (typeof valeur === 'object' && valeur !== null) {
    for (const enfant of Object.values(valeur)) geler(enfant);
    Object.freeze(valeur);
  }
  return valeur;
}

// Écart entre ce que lève fonction et une ErreurConfiguration du code et des
// détails attendus ; null quand ils concordent.
function ecartDeRefus(fonction, code, details) {
  try {
    fonction();
  } catch (erreur) {
    if (!(erreur instanceof ErreurConfiguration)) {
      return `${erreur?.name} au lieu d'une ErreurConfiguration : ${erreur?.message}`;
    }
    if (erreur.code !== code) return `code ${erreur.code} au lieu de ${code}`;
    try {
      assert.deepEqual(erreur.details, details);
    } catch {
      return `détails ${JSON.stringify(erreur.details)} au lieu de ${JSON.stringify(details)}`;
    }
    return null;
  }
  return 'aucun refus';
}

// Exige de fonction une TypeError au message donné ; libelle nomme le cas
// dans l'échec.
function exigerTypeError(fonction, message, libelle) {
  assert.throws(fonction, (erreur) => {
    assert.ok(erreur instanceof TypeError, `${libelle} : ${erreur?.name} au lieu de TypeError`);
    assert.equal(erreur.message, message, libelle);
    return true;
  });
}

// Chaque cas [libellé, fonction, code, détails] dont le refus s'écarte de
// l'attendu, en une ligne lisible.
function ecartsDeRefus(cas) {
  assert.ok(cas.length > 0, 'aucun cas examiné');
  return cas
    .map(([libelle, fonction, code, details]) => [libelle, ecartDeRefus(fonction, code, details)])
    .filter(([, ecart]) => ecart !== null)
    .map(([libelle, ecart]) => `${libelle} : ${ecart}`);
}

describe('valeurs du contrat de données (types.js)', () => {
  test('STATUT, LIBRE, RESERVE, SANS_GROUPE, SANS_OBJECTIF et NON_ANIMATEUR valent ce que types.js écrit, et STATUT ne se modifie pas', () => {
    // Seule épreuve qui écrit ces valeurs en clair : les autres les
    // importent. LIBRE et RESERVE sont égales : une rangée de instance.fixe se
    // lit comme le plan qui laisse en réserve chaque tour libre.
    assert.deepEqual(STATUT, { MOBILE: 0, PARTIELLEMENT_FIXE: 1, ANCRE: 2 });
    assert.ok(Object.isFrozen(STATUT));
    assert.deepEqual([LIBRE, RESERVE, SANS_GROUPE], [-1, -1, -1]);
    assert.deepEqual([SANS_OBJECTIF, NON_ANIMATEUR], [-1, -1]);
  });
});

describe('normaliser : statuts (§ 4.2, § 4.3)', () => {
  test('le statut se dérive du fait : ancré, partiellement fixé ou mobile', () => {
    const instance = normaliser(configuration({
      participants: personnes(suite(1, 9)),
      tables: tablesDe([11, 12, 13, 14], 4),
      tours: 3,
      reservations: [
        tous(1, 11),
        auTour(2, 12, 3), auTour(2, 12, 1), auTour(2, 12, 2),
        auTour(3, 13, 2),
        auTour(4, 11, 1), auTour(4, 12, 2),
        auTour(5, 13, 1), auTour(5, 13, 2), auTour(5, 14, 3),
        auTour(7, 14, 1),
        auTour(8, 14, 3),
        auTour(9, 12, 1), auTour(9, 13, 2), auTour(9, 12, 3),
      ],
    }));
    // 1 : portée « tous » ; 2 : R tours désignés, même table ; 3 : le seul
    // tour du milieu ; 4 : deux tours, deux tables ; 5 : chaque tour, deux
    // tables ; 6 : aucune réservation ; 7 : le seul premier tour ; 8 : le
    // seul dernier tour ; 9 : chaque tour, la même table au premier et au
    // dernier, une autre entre les deux. Seuls 1 et 2 comptent dans k : un
    // partiellement fixé compte parmi les mobiles.
    assert.deepEqual(instance.statut, Uint8Array.from([
      ANCRE, ANCRE,
      PARTIELLEMENT_FIXE, PARTIELLEMENT_FIXE, PARTIELLEMENT_FIXE,
      MOBILE,
      PARTIELLEMENT_FIXE, PARTIELLEMENT_FIXE, PARTIELLEMENT_FIXE,
    ]));
    assert.deepEqual(instance.fixe, Int32Array.from([
      0, 0, 0,
      1, 1, 1,
      LIBRE, 2, LIBRE,
      0, 1, LIBRE,
      2, 2, 3,
      LIBRE, LIBRE, LIBRE,
      3, LIBRE, LIBRE,
      LIBRE, LIBRE, 3,
      1, 2, 1,
    ]));
    assert.equal(instance.k, 2);
    assert.equal(instance.n, 7);
    assert.deepEqual(instance.ancresParTable, Int32Array.from([1, 1, 0, 0]));

    // À R = 1, une réservation de tour désigné fixe chacun des R tours : ancré.
    const unTour = normaliser(configuration({
      participants: personnes([1, 2]),
      tables: tablesDe([11, 12], 2),
      tours: 1,
      reservations: [auTour(1, 11, 1)],
    }));
    assert.deepEqual(unTour.statut, Uint8Array.from([ANCRE, MOBILE]));
    assert.deepEqual(unTour.fixe, Int32Array.from([0, LIBRE]));
    assert.equal(unTour.k, 1);
  });
});

describe('normaliser : ancrés et instance réduite (§ 5.2)', () => {
  test('k, n = N − k et ancresParTable sur quatre tables de 5 à un ancré chacune', () => {
    const instance = normaliser(configuration({
      participants: personnes(suite(1, 20)),
      tables: tablesDe([11, 12, 13, 14], 5),
      tours: 5,
      reservations: [
        tous(1, 11),
        tous(6, 12),
        ...suite(1, 5).map((tour) => auTour(11, 13, tour)),
        tous(16, 14),
        // Partiellement fixé : compté parmi les mobiles.
        auTour(2, 12, 3),
      ],
    }));
    assert.equal(instance.N, 20);
    assert.equal(instance.T, 4);
    assert.equal(instance.R, 5);
    assert.equal(instance.k, 4);
    assert.equal(instance.n, 16);
    assert.deepEqual(instance.ancresParTable, Int32Array.from([1, 1, 1, 1]));
    assert.equal(instance.statut[instance.indexDe.get(2)], PARTIELLEMENT_FIXE);
  });

  test('ancresParTable suit les index de table, dans l’ordre de configuration.tables', () => {
    const instance = normaliser(configuration({
      participants: personnes(suite(1, 8)),
      tables: tablesDe([13, 11, 14, 12], 5),
      tours: 2,
      reservations: [tous(1, 12), tous(2, 13), tous(3, 12), tous(4, 14)],
    }));
    assert.deepEqual(instance.idsTables, [13, 11, 14, 12]);
    assert.equal(instance.indexTableDe.get(12), 3);
    assert.deepEqual(instance.capacite, Int32Array.from([5, 5, 5, 5]));
    assert.deepEqual(instance.ancresParTable, Int32Array.from([1, 0, 1, 2]));
    assert.equal(instance.k, 4);
  });
});

describe('normaliser : exclusion (§ 4.4)', () => {
  test('un exclu disparaît de ids, figure dans exclus, et sa réservation est suspendue', () => {
    const instance = normaliser(configuration({
      participants: [...personnes([1, 2]), exclu(3), ...personnes([4])],
      tables: tablesDe([11, 12], 2),
      tours: 2,
      reservations: [tous(3, 12)],
    }));
    assert.equal(instance.N, 3);
    assert.deepEqual(instance.ids, [1, 2, 4]);
    assert.equal(instance.indexDe.has(3), false);
    assert.deepEqual([...instance.exclus], [3]);
    assert.equal(instance.k, 0);
    assert.equal(instance.n, 3);
    assert.deepEqual(instance.ancresParTable, Int32Array.from([0, 0]));
    assert.deepEqual(instance.fixe, new Int32Array(6).fill(LIBRE));
    assert.deepEqual(instance.statut, new Uint8Array(3).fill(MOBILE));
  });

  test('la réservation d’un exclu rend sa place : elle n’entre pas dans la surréservation', () => {
    const participants = [...personnes([1, 2]), exclu(3)];
    const avec = (liste) => configuration({
      participants: liste,
      tables: tablesDe([11, 12], 2),
      tours: 2,
      reservations: [tous(1, 11), tous(2, 11), tous(3, 11)],
    });
    const instance = normaliser(avec(participants));
    assert.equal(instance.k, 2);
    assert.deepEqual(instance.ancresParTable, Int32Array.from([2, 0]));
    // Réintégré, le même participant fait déborder la table.
    const reintegres = participants.map((participant) => ({ ...participant, exclu: false }));
    assert.deepEqual(
      ecartsDeRefus([[
        'réintégration',
        () => normaliser(avec(reintegres)),
        'SURRESERVATION',
        { table: 11, tour: 1, reservees: 3, capacite: 2 },
      ]]),
      [],
    );
  });

  test('la réservation suspendue d’un exclu n’interrompt pas la lecture : celles qui la suivent s’appliquent', () => {
    // En tête de liste, la réservation de l'exclu précède celles des présents :
    // un saut qui sortirait de la boucle au lieu de passer à la suivante les
    // perdrait toutes, sans bruit.
    const instance = normaliser(configuration({
      participants: [...personnes([1]), exclu(2)],
      tables: tablesDe([11, 12], 2),
      tours: 2,
      reservations: [tous(2, 11), tous(1, 12)],
    }));
    assert.equal(instance.k, 1);
    assert.deepEqual(instance.statut, Uint8Array.from([ANCRE]));
    assert.deepEqual(instance.fixe, Int32Array.from([1, 1]));
    assert.deepEqual(
      ecartsDeRefus([[
        'trois présents réservés à une table de 2, après l’exclu',
        () => normaliser(configuration({
          participants: [...personnes([1, 2, 3]), exclu(4)],
          tables: tablesDe([11, 12], 2),
          tours: 1,
          reservations: [tous(4, 11), tous(1, 11), tous(2, 11), tous(3, 11)],
        })),
        'SURRESERVATION',
        { table: 11, tour: 1, reservees: 3, capacite: 2 },
      ]]),
      [],
    );
  });

  test('les exclus se rangent par identifiant croissant, quel que soit l’ordre fourni', () => {
    // L'ordre d'un ensemble est celui de ses insertions : il se lit en liste.
    const instance = normaliser(configuration({
      participants: [exclu(7), ...personnes([2]), exclu(3), exclu(5)],
      tables: tablesDe([11], 2),
      tours: 1,
    }));
    assert.deepEqual([...instance.exclus], [3, 5, 7]);
  });

  test('une réservation suspendue reste vérifiée dans sa forme, et n’a aucun effet', () => {
    const avec = (reservations) => configuration({
      participants: [...personnes([1, 2]), exclu(3)],
      tables: tablesDe([11, 12], 2),
      tours: 2,
      reservations,
    });
    // Deux tables au même tour : sans effet, donc sans conflit.
    assert.equal(normaliser(avec([tous(3, 11), auTour(3, 12, 1)])).k, 0);
    assert.deepEqual(
      ecartsDeRefus([
        ['table inconnue', () => normaliser(avec([tous(3, 99)])),
          'RESERVATION_INCONNUE', { reservation: 0, table: 99 }],
        ['tour hors de 1..R', () => normaliser(avec([auTour(3, 11, 3)])),
          'RESERVATION_TOUR', { reservation: 0, tour: 3 }],
      ]),
      [],
    );
  });
});

describe('normaliser : organisations', () => {
  test('les groupes se numérotent par première apparition en ids croissants, quel que soit l’ordre fourni', () => {
    const fournis = [
      { id: 9, nom: 'P9', organisation: 'Y' },
      { id: 2, nom: 'P2', organisation: 'Z' },
      { id: 5, nom: 'P5', organisation: 'X' },
      { id: 7, nom: 'P7', organisation: null },
      { id: 3, nom: 'P3', organisation: 'W', exclu: true },
      { id: 4, nom: 'P4', organisation: 'Z' },
      { id: 1, nom: 'P1', organisation: 'Y' },
    ];
    const ordres = [fournis, [...fournis].reverse(), [3, 6, 0, 5, 1, 4, 2].map((i) => fournis[i])];
    assert.ok(ordres.length > 0, 'aucun ordre examiné');
    for (const participants of ordres) {
      const instance = normaliser(configuration({ participants, tables: tablesDe([11], 8), tours: 1 }));
      assert.deepEqual(instance.ids, [1, 2, 4, 5, 7, 9]);
      assert.deepEqual(instance.groupes, ['Y', 'Z', 'X']);
      assert.deepEqual(instance.groupe, Int32Array.from([0, 1, 1, 2, SANS_GROUPE, 0]));
    }
  });

  test('l’égalité de chaînes fait le groupe : normaliser ne réconcilie rien', () => {
    // La chaîne vide est une organisation comme une autre : seul null marque
    // l'absence d'organisation.
    const participants = [
      { id: 1, nom: 'P1', organisation: 'X' },
      { id: 2, nom: 'P2', organisation: 'x' },
      { id: 3, nom: 'P3', organisation: 'X ' },
      { id: 4, nom: 'P4', organisation: 'X' },
      { id: 5, nom: 'P5', organisation: '' },
      { id: 6, nom: 'P6', organisation: null },
      { id: 7, nom: 'P7', organisation: '' },
    ];
    const instance = normaliser(configuration({ participants, tables: tablesDe([11], 8), tours: 1 }));
    assert.deepEqual(instance.groupes, ['X', 'x', 'X ', '']);
    assert.deepEqual(instance.groupe, Int32Array.from([0, 1, 2, 0, 3, SANS_GROUPE, 3]));
  });
});

describe('normaliser : la configuration reçue', () => {
  test('normaliser ne modifie pas la configuration reçue', () => {
    const recue = geler(configuration({
      participants: [...personnes([9, 2]), exclu(5), { id: 4, nom: 'P4', organisation: 'X' }],
      tables: tablesDe([30, 10], 4),
      tours: 2,
      reservations: [tous(9, 30), auTour(2, 10, 2)],
    }));
    const instance = normaliser(recue);
    assert.deepEqual(instance.ids, [2, 4, 9]);
    assert.deepEqual(recue.participants.map((participant) => participant.id), [9, 2, 5, 4]);
  });

  test('l’instance copie les contraintes au lieu de les partager', () => {
    const contraintes = { ...SANS_CONTRAINTE, separerOrganisations: true };
    const instance = normaliser(configuration({
      participants: personnes([1, 2]),
      tables: tablesDe([11], 2),
      tours: 1,
      contraintes,
    }));
    contraintes.separerOrganisations = false;
    assert.deepEqual(instance.contraintes, { ...SANS_CONTRAINTE, separerOrganisations: true });
  });
});

describe('normaliser : refus (§ 5.9, § 6.2)', () => {
  // Trois participants, deux tables de 2, deux tours : chaque cas n'enfreint
  // qu'une règle.
  const base = configuration({
    participants: personnes([1, 2, 3]),
    tables: tablesDe([11, 12], 2),
    tours: 2,
  });
  const avec = (modification) => () => normaliser({ ...base, ...modification });
  const capacite12 = (capacite) => ({ tables: [...tablesDe([11], 2), { id: 12, numero: 2, capacite }] });

  test('chaque code d’erreur, sur un cas', () => {
    const cas = [
      ['un participant en double', avec({ participants: personnes([1, 2, 2]) }),
        'PARTICIPANT_DOUBLON', { participant: 2 }],
      ['un participant en double, dont un exclu', avec({ participants: [...personnes([1, 2]), exclu(2)] }),
        'PARTICIPANT_DOUBLON', { participant: 2 }],
      ['une table en double', avec({ tables: tablesDe([11, 12, 11], 2) }),
        'TABLE_DOUBLON', { table: 11 }],
      ...[1, 0, -3, 2.5, '8', Number.NaN, 2 ** 31].map((capacite) => [
        `une capacité ${libelleDe(capacite)}`, avec(capacite12(capacite)),
        'CAPACITE', { table: 12, capacite },
      ]),
      ...[0, -1, 1.5, '2', Number.NaN].map((tours) => [
        `${libelleDe(tours)} tours`, avec({ tours }), 'TOURS', { tours },
      ]),
      // Le détail reservation est le rang dans configuration.reservations, à
      // partir de 0 : la réservation fautive se place au rang 0, puis au rang 1.
      // Un participant ou une table désignés par une valeur qui n'est pas un
      // identifiant de la configuration sont inconnus, quelle qu'en soit la
      // forme.
      ['un participant inconnu', avec({ reservations: [tous(9, 11)] }),
        'RESERVATION_INCONNUE', { reservation: 0, participant: 9 }],
      ['un participant inconnu au rang 1', avec({ reservations: [tous(1, 11), tous(9, 11)] }),
        'RESERVATION_INCONNUE', { reservation: 1, participant: 9 }],
      ['un participant désigné en texte', avec({ reservations: [tous('1', 11)] }),
        'RESERVATION_INCONNUE', { reservation: 0, participant: '1' }],
      ['une table inconnue', avec({ reservations: [tous(1, 11), auTour(2, 99, 1)] }),
        'RESERVATION_INCONNUE', { reservation: 1, table: 99 }],
      ['une table désignée en texte', avec({ reservations: [tous(1, '11')] }),
        'RESERVATION_INCONNUE', { reservation: 0, table: '11' }],
      ['un tour désigné absent', avec({ reservations: [{ participant: 1, table: 11, portee: 'tour' }] }),
        'RESERVATION_TOUR', { reservation: 0, tour: undefined }],
      ...[0, 3, 1.5, '1'].map((tour) => [
        `le tour désigné ${libelleDe(tour)}`, avec({ reservations: [auTour(1, 11, tour)] }),
        'RESERVATION_TOUR', { reservation: 0, tour },
      ]),
      ['le tour désigné 3 au rang 1', avec({ reservations: [tous(1, 11), auTour(2, 12, 3)] }),
        'RESERVATION_TOUR', { reservation: 1, tour: 3 }],
      ['deux tables au même tour désigné', avec({ reservations: [auTour(1, 11, 1), auTour(1, 12, 1)] }),
        'RESERVATION_CONFLIT', { participant: 1, tour: 1, tables: [11, 12] }],
      ['la portée « tous » et un tour désigné ailleurs', avec({ reservations: [tous(1, 12), auTour(1, 11, 2)] }),
        'RESERVATION_CONFLIT', { participant: 1, tour: 2, tables: [12, 11] }],
      // Le conflit se découvre aussi en traitant une portée « tous » : elle ne
      // remplace jamais une table déjà imposée à l'un de ses tours.
      ['un tour désigné puis la portée « tous » ailleurs', avec({ reservations: [auTour(1, 11, 2), tous(1, 12)] }),
        'RESERVATION_CONFLIT', { participant: 1, tour: 2, tables: [11, 12] }],
      ['deux portées « tous » à deux tables', avec({ reservations: [tous(1, 11), tous(1, 12)] }),
        'RESERVATION_CONFLIT', { participant: 1, tour: 1, tables: [11, 12] }],
      ['trois réservés à une table de 2 au tour 2',
        avec({ reservations: [tous(1, 11), tous(2, 11), auTour(3, 11, 2)] }),
        'SURRESERVATION', { table: 11, tour: 2, reservees: 3, capacite: 2 }],
    ];
    assert.deepEqual(ecartsDeRefus(cas), []);
  });

  test('une table entièrement gelée, k_t = c_t, est acceptée', () => {
    const instance = normaliser({ ...base, reservations: [tous(1, 11), tous(2, 11)] });
    assert.deepEqual(instance.ancresParTable, Int32Array.from([2, 0]));
  });

  test('une réservation redondante compte une personne, pas deux', () => {
    const instance = normaliser({
      ...base,
      reservations: [tous(1, 11), auTour(1, 11, 2), tous(1, 11), tous(2, 11)],
    });
    assert.equal(instance.k, 2);
    assert.deepEqual(instance.ancresParTable, Int32Array.from([2, 0]));
  });

  test('SURRESERVATION se juge à chaque table et à chaque tour, contre la capacité de cette table', () => {
    // Trois tables hors de l'ordre de leurs identifiants, de capacités
    // distinctes, et T ≠ R. Cinq participants : la plus grande table, pleine
    // plus un, les fixe tous, le dernier compris.
    const tables = [
      { id: 13, numero: 1, capacite: 3 },
      { id: 11, numero: 2, capacite: 2 },
      { id: 12, numero: 3, capacite: 4 },
    ];
    const tours = 2;
    const fixer = (reservations) => () =>
      normaliser(configuration({ participants: personnes(suite(1, 5)), tables, tours, reservations }));
    // c_t + 1 personnes fixées à la table t, au tour r ou à chaque tour par la
    // portée « tous » : refusé, au premier tour qui déborde.
    const debordees = tables.flatMap(({ id, capacite }) => [
      ...suite(1, tours).map((tour) => [
        `${capacite + 1} fixées à la table ${id} au tour ${tour}`,
        fixer(suite(1, capacite + 1).map((p) => auTour(p, id, tour))),
        'SURRESERVATION', { table: id, tour, reservees: capacite + 1, capacite },
      ]),
      [`${capacite + 1} ancrées à la table ${id}`,
        fixer(suite(1, capacite + 1).map((p) => tous(p, id))),
        'SURRESERVATION', { table: id, tour: 1, reservees: capacite + 1, capacite }],
    ]);
    assert.deepEqual(ecartsDeRefus(debordees), []);
    // c_t personnes fixées remplissent la table sans la déborder : accepté.
    const remplies = tables.flatMap(({ id, capacite }) => [
      ...suite(1, tours).map((tour) => [
        `${capacite} fixées à la table ${id} au tour ${tour}`,
        fixer(suite(1, capacite).map((p) => auTour(p, id, tour))),
      ]),
      [`${capacite} ancrées à la table ${id}`, fixer(suite(1, capacite).map((p) => tous(p, id)))],
    ]);
    assert.ok(remplies.length > 0, 'aucun cas examiné');
    const refusees = [];
    for (const [libelle, fonction] of remplies) {
      try {
        fonction();
      } catch (erreur) {
        refusees.push(`${libelle} : ${erreur?.message}`);
      }
    }
    assert.deepEqual(refusees, []);
  });

  test('une capacité de 2³¹ − 1, le plus grand entier d’un Int32Array, est acceptée', () => {
    const instance = normaliser({ ...base, ...capacite12(2 ** 31 - 1) });
    assert.equal(instance.capacite[1], 2 ** 31 - 1);
  });

  test('une valeur hors du contrat de données lève TypeError', () => {
    const cas = [
      ['identifiant de participant 0', { participants: personnes([0, 1]) }],
      ['identifiant de participant 1.5', { participants: personnes([1.5]) }],
      ['identifiant de participant en texte', { participants: personnes(['1']) }],
      ['identifiant de table 0', { tables: tablesDe([0, 12], 2) }],
      ['identifiant de table en texte', { tables: tablesDe(['11', 12], 2) }],
      ['organisation absente', { participants: [{ id: 1, nom: 'P1' }] }],
      ['organisation numérique', { participants: [{ id: 1, nom: 'P1', organisation: 7 }] }],
      ...['oui', '', 0, null].map((valeur) => [
        `exclusion ${libelleDe(valeur)}`,
        { participants: [{ id: 1, nom: 'P1', organisation: null, exclu: valeur }] },
      ]),
      ['portée inconnue', { reservations: [{ participant: 1, table: 11, portee: 'chaque' }] }],
      ['contraintes absentes', { contraintes: undefined }],
      ['une contrainte absente', {
        contraintes: { separerOrganisations: true, nouveauxVoisins: false, nouvelleTable: false },
      }],
      ['une contrainte non booléenne', { contraintes: { ...SANS_CONTRAINTE, nouvelleTable: 1 } }],
      // Une liste absente, puis une valeur qui n'est pas un tableau mais que le
      // code parcourrait sans bruit : un ensemble s'itère, et un objet sans
      // longueur ne fait tourner aucune boucle.
      ['participants absents', { participants: undefined }],
      ['participants en ensemble', { participants: new Set(personnes([1, 2])) }],
      ['tables absentes', { tables: undefined }],
      ['tables en objet', { tables: {} }],
      ['réservations absentes', { reservations: undefined }],
      ['réservations en objet', { reservations: {} }],
    ];
    const ecarts = [];
    for (const [libelle, modification] of cas) {
      try {
        normaliser({ ...base, ...modification });
        ecarts.push(`${libelle} : aucun refus`);
      } catch (erreur) {
        if (!(erreur instanceof TypeError)) {
          ecarts.push(`${libelle} : ${erreur?.name} au lieu de TypeError`);
        }
      }
    }
    assert.ok(cas.length > 0, 'aucun cas examiné');
    assert.deepEqual(ecarts, []);
  });

  test('des contraintes qui ne sont pas un objet lèvent TypeError, au message qui le dit, avant toute case', () => {
    // Sans la garde, une chaîne ou un booléen lèveraient à la première case,
    // sous le message d'une contrainte non booléenne qui « reçoit undefined » ;
    // undefined et null, à la première lecture, sous le message du moteur
    // JavaScript. Seul le message distingue la garde.
    for (const contraintes of [undefined, null, 'separerOrganisations', true]) {
      exigerTypeError(avec({ contraintes }), 'configuration.contraintes : objet attendu', libelleDe(contraintes));
    }
  });
});

describe('nombrePlaces (§ 5.9)', () => {
  test('somme les capacités : ni les participants, ni les exclus, ni les réservations ne la changent', () => {
    const tables = [
      { id: 13, numero: 1, capacite: 3 },
      { id: 11, numero: 2, capacite: 2 },
      { id: 12, numero: 3, capacite: 7 },
    ];
    const salle = (participants, reservations = []) =>
      normaliser(configuration({ participants, tables, tours: 2, reservations }));
    assert.equal(nombrePlaces(salle(personnes(suite(1, 4)))), 12);
    assert.equal(nombrePlaces(salle(personnes(suite(1, 20)))), 12);
    assert.equal(nombrePlaces(salle([], [])), 12);
    assert.equal(
      nombrePlaces(salle([...personnes(suite(1, 4)), exclu(5)], [tous(1, 13), auTour(2, 12, 2), tous(5, 11)])),
      12,
    );
  });
});

describe('nombrePlacesManquantes (§ 5.9)', () => {
  const salle = (reservations = [], participants = personnes(suite(1, 15))) =>
    normaliser(configuration({ participants, tables: tablesDe([11, 12, 13], 4), tours: 2, reservations }));

  // Places manquantes lues sur l'instance réduite du § 5.2 : n − Σ (c_t − a_t),
  // l'opposé de l'écart Σ (c_t − k_t) − n du § 5.9.
  function placesManquantesReduites(instance) {
    let placesLibres = 0;
    for (let t = 0; t < instance.T; t += 1) {
      placesLibres += instance.capacite[t] - instance.ancresParTable[t];
    }
    return instance.n - placesLibres;
  }

  test('vaut 3 pour trois tables de 4 et quinze personnes, que normaliser accepte', () => {
    assert.equal(nombrePlacesManquantes(salle()), 3);
  });

  test('ne change pas quand on ajoute ou déplace une réservation', () => {
    const variantes = [
      [],
      [tous(1, 11)],
      [tous(1, 12)],
      [auTour(1, 11, 1)],
      [auTour(1, 11, 1), auTour(1, 12, 2)],
      [tous(1, 11), auTour(2, 12, 2), tous(3, 13), tous(4, 13)],
    ];
    assert.ok(variantes.length > 0, 'aucune variante examinée');
    for (const reservations of variantes) {
      const instance = salle(reservations);
      assert.equal(nombrePlacesManquantes(instance), 3, JSON.stringify(reservations));
      assert.equal(placesManquantesReduites(instance), 3, JSON.stringify(reservations));
    }
  });

  test('vaut 0, jamais un nombre négatif, quand la salle suffit', () => {
    assert.equal(nombrePlacesManquantes(salle([], personnes(suite(1, 12)))), 0);
    assert.equal(nombrePlacesManquantes(salle([], personnes(suite(1, 10)))), 0);
  });

  test('un exclu ne compte pas : sa réintégration fait manquer une place', () => {
    const participants = [...personnes(suite(1, 12)), exclu(13)];
    assert.equal(nombrePlacesManquantes(salle([], participants)), 0);
    const reintegres = participants.map((participant) => ({ ...participant, exclu: false }));
    assert.equal(nombrePlacesManquantes(salle([], reintegres)), 1);
  });
});

describe('plans : forme par identifiants et forme indexée (§ 8.9)', () => {
  // Quatre participants placés, fournis dans le désordre, un exclu ; trois
  // tables hors de l'ordre de leurs identifiants ; deux tours. T ≠ R : la
  // disposition p × R + r se distingue de p × T + r, et la longueur N × R de
  // N × T.
  function instancePlans() {
    return normaliser(configuration({
      participants: [...personnes([3, 8]), exclu(5), ...personnes([11, 6])],
      tables: tablesDe([40, 20, 30], 2),
      tours: 2,
    }));
  }

  // tableDe[p × R + r], p dans l'ordre des ids [3, 6, 8, 11], et le plan par
  // identifiants qui lui correspond. Chaque table reçoit quelqu'un, une table
  // reste vide à un tour, et une liste de table comme une réserve portent
  // deux ids, dont l'ordre croissant se voit.
  const TABLE_DE = [
    RESERVE, 0,
    RESERVE, 1,
    0, 2,
    2, 1,
  ];
  const PLAN = {
    tables: [40, 20, 30],
    tours: [[[8], [], [11]], [[3], [6, 11], [8]]],
    reserves: [[3, 6], []],
  };

  test('planDepuisIndex rend des ids croissants par table et dans la réserve', () => {
    const instance = instancePlans();
    const plan = planDepuisIndex(instance, Int32Array.from(TABLE_DE));
    assert.deepEqual(plan, PLAN);
    // Une liste ordinaire, gelée, convient aussi et reste intacte.
    assert.deepEqual(planDepuisIndex(instance, geler([...TABLE_DE])), PLAN);
    const listes = [...plan.tours.flat(), ...plan.reserves];
    assert.ok(listes.length > 0, 'aucune liste examinée');
    for (const liste of listes) {
      assert.deepEqual(liste, [...liste].sort((a, b) => a - b));
    }
    // Le plan rendu a sa propre liste de tables : la modifier laisse
    // l'instance intacte.
    plan.tables.reverse();
    assert.deepEqual(instance.idsTables, [40, 20, 30]);
  });

  test('indexerPlan ∘ planDepuisIndex est l’identité sur chaque plan indexé de l’instance', () => {
    const instance = instancePlans();
    const cases = instance.N * instance.R;
    // Chaque case prend une valeur de RESERVE, −1, à T − 1.
    const valeurs = instance.T + 1;
    let examines = 0;
    for (let rang = 0; rang < valeurs ** cases; rang += 1) {
      const tableDe = new Int32Array(cases);
      for (let i = 0, reste = rang; i < cases; i += 1, reste = Math.floor(reste / valeurs)) {
        tableDe[i] = RESERVE + (reste % valeurs);
      }
      const retour = indexerPlan(instance, planDepuisIndex(instance, tableDe));
      if (retour.length !== tableDe.length || retour.some((valeur, i) => valeur !== tableDe[i])) {
        assert.deepEqual(retour, tableDe);
      }
      examines += 1;
    }
    assert.equal(examines, 4 ** 8);
  });

  test('indexerPlan lit chaque table par son identifiant, dans l’ordre que le plan déclare', () => {
    const instance = instancePlans();
    assert.deepEqual(indexerPlan(instance, geler(structuredClone(PLAN))), Int32Array.from(TABLE_DE));
    // Le même plan, ses tables déclarées dans un autre ordre, chaque liste et
    // chaque réserve dans le désordre.
    const permute = {
      tables: [30, 40, 20],
      tours: [[[11], [8], []], [[8], [3], [11, 6]]],
      reserves: [[6, 3], []],
    };
    const tableDe = indexerPlan(instance, geler(permute));
    assert.deepEqual(tableDe, Int32Array.from(TABLE_DE));
    assert.deepEqual(planDepuisIndex(instance, tableDe), PLAN);
  });

  test('indexerPlan refuse ce que la forme indexée ne représente pas', () => {
    const instance = instancePlans();
    const variante = (modifier) => () => {
      const plan = structuredClone(PLAN);
      modifier(plan);
      return indexerPlan(instance, plan);
    };
    const cas = [
      ['un participant inconnu', variante((plan) => plan.tours[0][0].push(99)),
        'PLAN_INCONNU', { participant: 99, tour: 1 }],
      ['un participant inconnu en réserve', variante((plan) => plan.reserves[1].push(99)),
        'PLAN_INCONNU', { participant: 99, tour: 2 }],
      ['un participant exclu', variante((plan) => plan.tours[1][1].unshift(5)),
        'PLAN_EXCLU_PLACE', { participant: 5, tour: 2 }],
      ['un participant exclu en réserve', variante((plan) => plan.reserves[0].push(5)),
        'PLAN_EXCLU_PLACE', { participant: 5, tour: 1 }],
      ['une table inconnue', variante((plan) => { plan.tables[1] = 50; }),
        'PLAN_TABLE_INCONNUE', { table: 50 }],
      ['une table en double', variante((plan) => { plan.tables[1] = 30; }),
        'PLAN_TABLE_DOUBLON', { table: 30 }],
      // La table 30 retirée du plan, ses occupants passés en réserve : le plan
      // reste cohérent avec lui-même, mais ne reprend plus chaque table de
      // l'instance.
      ['une table non déclarée', variante((plan) => {
        plan.tables.pop();
        plan.tours.forEach((listes, r) => plan.reserves[r].push(...listes.pop()));
      }), 'PLAN_TABLE_ABSENTE', { table: 30 }],
      // Aucune table déclarée, chacun en réserve : des trois absentes, la
      // première dans l'ordre de l'instance est nommée.
      ['aucune table déclarée', variante((plan) => {
        plan.tables = [];
        plan.tours = [[], []];
        plan.reserves = [[3, 6, 8, 11], [3, 6, 8, 11]];
      }), 'PLAN_TABLE_ABSENTE', { table: 40 }],
      ['un tour de moins', variante((plan) => plan.tours.pop()),
        'PLAN_TOURS', { attendu: 2, tours: 1, reserves: 2 }],
      ['un tour de trop', variante((plan) => plan.tours.push([[], [], []])),
        'PLAN_TOURS', { attendu: 2, tours: 3, reserves: 2 }],
      ['une réserve de trop', variante((plan) => plan.reserves.push([])),
        'PLAN_TOURS', { attendu: 2, tours: 2, reserves: 3 }],
      ['une liste de table de trop', variante((plan) => plan.tours[1].push([])),
        'PLAN_LISTES', { tour: 2, listes: 4, tables: 3 }],
      ['une liste de table de moins', variante((plan) => plan.tours[1].pop()),
        'PLAN_LISTES', { tour: 2, listes: 2, tables: 3 }],
      ['assis et en réserve', variante((plan) => plan.reserves[0].unshift(8)),
        'PLAN_DOUBLE_PLACE', { participant: 8, tour: 1 }],
      ['deux fois à une table', variante((plan) => plan.tours[1][1].push(6)),
        'PLAN_DOUBLE_PLACE', { participant: 6, tour: 2 }],
      ['à deux tables d’un même tour', variante((plan) => plan.tours[0][1].push(8)),
        'PLAN_DOUBLE_PLACE', { participant: 8, tour: 1 }],
      ['deux fois en réserve', variante((plan) => plan.reserves[0].push(3)),
        'PLAN_DOUBLE_PLACE', { participant: 3, tour: 1 }],
      ['absent d’un tour', variante((plan) => plan.reserves[0].pop()),
        'PLAN_NON_ASSIS', { participant: 6, tour: 1 }],
    ];
    assert.deepEqual(ecartsDeRefus(cas), []);
  });

  test('indexerPlan refuse quiconque manque à un tour : chaque participant, à chaque tour', () => {
    const instance = instancePlans();
    // Chaque id de l'instance, du premier index au dernier, retiré de la
    // liste qui le porte à ce tour, table ou réserve.
    const cas = [3, 6, 8, 11].flatMap((id) => [1, 2].map((tour) => [
      `${id} retiré du tour ${tour}`,
      () => {
        const plan = structuredClone(PLAN);
        for (const liste of [...plan.tours[tour - 1], plan.reserves[tour - 1]]) {
          if (liste.includes(id)) liste.splice(liste.indexOf(id), 1);
        }
        return indexerPlan(instance, plan);
      },
      'PLAN_NON_ASSIS',
      { participant: id, tour },
    ]));
    assert.deepEqual(ecartsDeRefus(cas), []);
  });

  // TABLE_DE dont les cases nommées reçoivent une autre valeur : fautes est
  // une liste de couples [case, valeur].
  const avecFautes = (fautes) => {
    const tableDe = [...TABLE_DE];
    for (const [i, valeur] of fautes) tableDe[i] = valeur;
    return tableDe;
  };

  // Plans indexés hors de la forme de l'instance, et le message qui les
  // refuse. Les ids [3, 6, 8, 11] occupent les index 0 à 3 ; la case p × 2 + r
  // est celle de l'index p au tour r + 1. Trois tables : un index de table va
  // de 0 à 2. Une chaîne numérique n'est pas un index, et se cite entre
  // guillemets ; NaN se cite tel quel, et non comme null. Deux cases
  // fautives : la première dans l'ordre des cases est nommée, la case 1 (3 au
  // tour 2) avant la case 2 (6 au tour 1).
  const FAUTIFS = [
    ['longueur N × R − 1', TABLE_DE.slice(1), 'plan indexé de 7 cases, N × R = 8 attendues'],
    ['longueur N × R + 1', [...TABLE_DE, RESERVE], 'plan indexé de 9 cases, N × R = 8 attendues'],
    ['longueur N × T', Array(12).fill(RESERVE), 'plan indexé de 12 cases, N × R = 8 attendues'],
    ['index de table T', avecFautes([[0, 3]]), 'participant 3, tour 1, index de table 3'],
    ['index −2', avecFautes([[3, -2]]), 'participant 6, tour 2, index de table -2'],
    ['index non entier', avecFautes([[5, 0.5]]), 'participant 8, tour 2, index de table 0.5'],
    ['index null', avecFautes([[4, null]]), 'participant 8, tour 1, index de table null'],
    ['index NaN', avecFautes([[2, Number.NaN]]), 'participant 6, tour 1, index de table NaN'],
    ['chaîne "0"', avecFautes([[6, '0']]), 'participant 11, tour 1, index de table "0"'],
    ['chaîne "-1"', avecFautes([[7, '-1']]), 'participant 11, tour 2, index de table "-1"'],
    ['deux cases fautives', avecFautes([[2, 9], [1, 9]]), 'participant 3, tour 2, index de table 9'],
  ].map(([libelle, tableDe, message]) => [
    libelle,
    tableDe,
    message.startsWith('plan indexé de') ? message : `plan indexé : ${message} hors de −1..2`,
  ]);

  // « Nom : message » de l'erreur que lève fonction, « aucun refus » sinon.
  function erreurDe(fonction) {
    try {
      fonction();
    } catch (erreur) {
      return `${erreur?.name} : ${erreur?.message}`;
    }
    return 'aucun refus';
  }

  test('exigerPlanIndexe accepte un plan indexé de la forme de l’instance, Int32Array ou liste, sans le modifier', () => {
    const instance = instancePlans();
    assert.equal(exigerPlanIndexe(instance, Int32Array.from(TABLE_DE)), undefined);
    assert.equal(exigerPlanIndexe(instance, geler([...TABLE_DE])), undefined);
  });

  test('exigerPlanIndexe refuse un plan indexé hors forme : RangeError qui nomme le participant, le tour et la valeur de la première case fautive', () => {
    const instance = instancePlans();
    assert.ok(FAUTIFS.length > 0, 'aucune variante examinée');
    const ecarts = [];
    for (const [libelle, tableDe, message] of FAUTIFS) {
      const recue = erreurDe(() => exigerPlanIndexe(instance, tableDe));
      const attendue = `RangeError : ${message}`;
      if (recue !== attendue) ecarts.push(`${libelle} : « ${recue} » au lieu de « ${attendue} »`);
    }
    assert.deepEqual(ecarts, []);
  });

  test('une seule garde : planDepuisIndex, mesurer et plafondsRealises lèvent l’erreur de exigerPlanIndexe, au même message', () => {
    const instance = instancePlans();
    const appelants = [
      ['planDepuisIndex', (tableDe) => planDepuisIndex(instance, tableDe)],
      ['mesurer', (tableDe) => mesurer(instance, tableDe)],
      ['plafondsRealises', (tableDe) => plafondsRealises(instance, tableDe)],
    ];
    const ecarts = [];
    let confrontees = 0;
    for (const [libelle, tableDe] of FAUTIFS) {
      const attendue = erreurDe(() => exigerPlanIndexe(instance, tableDe));
      for (const [nom, appeler] of appelants) {
        confrontees += 1;
        const recue = erreurDe(() => appeler(tableDe));
        if (recue !== attendue) ecarts.push(`${nom}, ${libelle} : « ${recue} » au lieu de « ${attendue} »`);
      }
    }
    assert.equal(confrontees, 3 * FAUTIFS.length);
    assert.deepEqual(ecarts, []);
  });
});

describe('figerConfiguration : une normalisation par configuration figée', () => {
  // 2 anime aux deux tours, réservé à la table 10 ; 4 porte « finance », que
  // vise la table 30 pour la soirée.
  const recue = () => ({
    ...configuration({
      participants: [
        ...personnes([9]),
        { id: 2, nom: 'P2', organisation: null, anime: [1, 2] },
        { id: 4, nom: 'P4', organisation: 'X', etiquettes: ['finance'] },
      ],
      tables: tablesDe([30, 10], 4),
      tours: 2,
      reservations: [tous(9, 30), tous(2, 10)],
    }),
    objectifs: [{ table: 30, tour: null, regle: 'ou', etiquettes: ['finance'] }],
    priorites: PRIORITES_PAR_DEFAUT.map((palier) => palier.map((entree) => ({ ...entree }))),
  });

  test('fige ce que normaliser lit et rend la configuration ; normaliser rend alors la même instance à chaque appel, celle d’une copie non figée', () => {
    const figee = recue();
    assert.equal(figerConfiguration(figee), figee);
    const lues = [
      figee, figee.participants, figee.participants[0], figee.participants[1].anime, figee.participants[2].etiquettes,
      figee.tables, figee.tables[1], figee.reservations, figee.reservations[1], figee.contraintes,
      figee.objectifs, figee.objectifs[0], figee.objectifs[0].etiquettes, figee.priorites, figee.priorites[3], figee.priorites[3][0],
    ];
    assert.deepEqual(lues.filter((valeur) => !Object.isFrozen(valeur)), []);
    const premiere = normaliser(figee);
    assert.equal(normaliser(figee), premiere);
    assert.deepEqual(premiere, normaliser(recue()));
    const libre = recue();
    assert.notEqual(normaliser(libre), normaliser(libre));
  });

  test('une configuration figée que normaliser refuse lève à chaque appel', () => {
    const figee = figerConfiguration({ ...recue(), tours: 0 });
    for (let appel = 0; appel < 2; appel += 1) {
      assert.throws(() => normaliser(figee), (erreur) => erreur instanceof ErreurConfiguration && erreur.code === 'TOURS');
    }
  });

  test('figer de nouveau une configuration déjà normalisée garde son instance', () => {
    const figee = figerConfiguration(recue());
    const premiere = normaliser(figee);
    assert.equal(figerConfiguration(figee), figee);
    assert.equal(normaliser(figee), premiere);
  });

  test('seuls les objets se figent : une fonction atteinte reste telle quelle', () => {
    // Une fonction, que typeof distingue d'un objet, n'est pas une donnée de
    // configuration : figerConfiguration la laisse modifiable.
    const fonction = () => 0;
    figerConfiguration({ ...recue(), contraintes: fonction });
    assert.equal(Object.isFrozen(fonction), false);
  });
});

describe('replierParPopulation (§ 5.4)', () => {
  test('chacun compte dans tous, puis parmi les ancrés ou parmi les mobiles, partiellement fixés compris, dans l’ordre canonique', () => {
    const statut = Uint8Array.from([ANCRE, MOBILE, PARTIELLEMENT_FIXE, ANCRE, MOBILE, PARTIELLEMENT_FIXE]);
    const enListe = (cumul, valeur) => [...cumul, valeur];
    assert.deepEqual(replierParPopulation([10, 11, 12, 13, 14, 15], statut, [], enListe), {
      tous: [10, 11, 12, 13, 14, 15],
      mobiles: [11, 12, 14, 15],
      ancres: [10, 13],
    });
  });

  test('les trois populations partent de la valeur initiale ; une population sans membre la garde', () => {
    const plusGrand = (cumul, valeur) => (cumul === null || valeur > cumul ? valeur : cumul);
    assert.deepEqual(
      replierParPopulation([4, 9], Uint8Array.from([MOBILE, PARTIELLEMENT_FIXE]), null, plusGrand),
      { tous: 9, mobiles: 9, ancres: null },
    );
    assert.deepEqual(
      replierParPopulation([3], Uint8Array.from([ANCRE]), null, plusGrand),
      { tous: 3, mobiles: null, ancres: 3 },
    );
    assert.deepEqual(
      replierParPopulation([], new Uint8Array(0), 'vide', plusGrand),
      { tous: 'vide', mobiles: 'vide', ancres: 'vide' },
    );
  });
});

describe('erreurs du moteur', () => {
  test('ErreurConfiguration porte son code et ses détails', () => {
    const erreur = new ErreurConfiguration('CAPACITE', { table: 12, capacite: 1 });
    assert.ok(erreur instanceof Error);
    assert.equal(erreur.name, 'ErreurConfiguration');
    assert.equal(erreur.code, 'CAPACITE');
    assert.deepEqual(erreur.details, { table: 12, capacite: 1 });
    assert.match(erreur.message, /CAPACITE/);
    assert.deepEqual(new ErreurConfiguration('TOURS').details, {});
  });

  test('ErreurAnnulee est une Error qui porte son nom', () => {
    const erreur = new ErreurAnnulee();
    assert.ok(erreur instanceof Error);
    assert.equal(erreur.name, 'ErreurAnnulee');
  });
});

// --- Les étiquettes, les objectifs, les animateurs (§ 4.5, A7, A21) ---------

// Participant présent qui porte des étiquettes, et éventuellement les tours
// où il anime.
const etiquete = (id, etiquettes, anime) => ({
  id,
  nom: `P${id}`,
  organisation: null,
  ...(etiquettes === undefined ? {} : { etiquettes }),
  ...(anime === undefined ? {} : { anime }),
});
const objectif = (table, tour, regle, etiquettes) => ({ table, tour, regle, etiquettes });

// La configuration de la correspondance : trois tables, dont 22 gelée au
// tour 2 par deux réservations ; des objectifs de soirée et de tour, des deux
// règles, déclarés hors de l'ordre des tables, dont deux identiques sur deux
// tables ; une personne réservée à une table sans objectif quand une autre la
// servait, une autre réservée à une table dont l'objectif ne lui correspond
// pas ; un exclu qui porte des étiquettes.
const CORRESPONDANCE = configuration({
  participants: [
    etiquete(2, ['finance']),
    etiquete(3, ['finance', 'Montréal']),
    etiquete(4, ['ressources humaines']),
    etiquete(5),
    etiquete(6, ['Montréal']),
    etiquete(7, ['bénévole', 'finance']),
    etiquete(8, ['bénévole']),
    { ...etiquete(9, ['finance']), exclu: true },
    etiquete(10, ['bénévole']),
  ],
  tables: [{ id: 21, numero: 1, capacite: 4 }, { id: 23, numero: 2, capacite: 2 }, { id: 22, numero: 3, capacite: 2 }],
  tours: 3,
  reservations: [auTour(4, 23, 1), auTour(6, 21, 3), tous(7, 22), auTour(8, 22, 2), tous(9, 21)],
});
CORRESPONDANCE.objectifs = [
  objectif(23, 3, 'ou', ['Montréal']),
  objectif(21, null, 'ou', ['finance', 'ressources humaines']),
  objectif(22, 1, 'ou', ['finance', 'ressources humaines']),
  objectif(21, 2, 'et', ['finance', 'Montréal']),
  objectif(22, null, 'ou', ['bénévole']),
];

// Lecture directe du § 4.5, sans rien du module éprouvé : l'objectif en
// vigueur à la table au tour r est celui du tour s'il existe, sinon celui de
// la soirée ; « ou » demande une étiquette commune, « et » chacune ; une
// table garde un siège libre quand ses réservations présentes n'occupent pas
// toute sa capacité ; un couple fixé n'est possible qu'à sa table.
function lectureDirecte(config) {
  const presents = config.participants.filter((personne) => personne.exclu !== true);
  const enVigueur = (table, tour) =>
    config.objectifs.find((o) => o.table === table && o.tour === tour)
    ?? config.objectifs.find((o) => o.table === table && o.tour === null);
  const correspond = (personne, table, tour) => {
    const o = enVigueur(table, tour);
    if (o === undefined) return false;
    const siennes = personne.etiquettes ?? [];
    return o.regle === 'ou' ? o.etiquettes.some((e) => siennes.includes(e)) : o.etiquettes.every((e) => siennes.includes(e));
  };
  const couvre = (reservation, tour) => reservation.portee === 'tous' || reservation.tour === tour;
  const presentes = config.reservations.filter((reservation) => presents.some(({ id }) => id === reservation.participant));
  const tableFixee = (personne, tour) =>
    presentes.find((reservation) => reservation.participant === personne.id && couvre(reservation, tour))?.table;
  const libre = (table, tour) =>
    presentes.filter((reservation) => reservation.table === table.id && couvre(reservation, tour)).length < table.capacite;
  const possible = (personne, tour) => {
    const fixee = tableFixee(personne, tour);
    if (fixee !== undefined) return correspond(personne, fixee, tour);
    return config.tables.some((table) => libre(table, tour) && correspond(personne, table.id, tour));
  };
  return { presents, correspond, possible };
}

describe('normaliser : objectifs des tables et correspondance (§ 4.5, A7, A21)', () => {
  test('une correspondance se décide par la règle : chaque couple (personne, table, tour) et chaque couple possible égalent la lecture directe du § 4.5', () => {
    const instance = normaliser(CORRESPONDANCE);
    const { presents, correspond, possible } = lectureDirecte(CORRESPONDANCE);
    const { N, T, R, O, objectifDe } = instance;
    assert.deepEqual(instance.ids, presents.map(({ id }) => id));
    const ecarts = [];
    for (let p = 0; p < N; p += 1) {
      for (let r = 0; r < R; r += 1) {
        for (let t = 0; t < T; t += 1) {
          const o = objectifDe[t * R + r];
          const lu = o !== SANS_OBJECTIF && instance.correspond[p * O + o] === 1;
          if (lu !== correspond(presents[p], instance.idsTables[t], r + 1)) {
            ecarts.push(`personne ${instance.ids[p]}, table ${instance.idsTables[t]}, tour ${r + 1} : ${lu}`);
          }
        }
        const lu = instance.possible[p * R + r] === 1;
        if (lu !== possible(presents[p], r + 1)) ecarts.push(`possible ${instance.ids[p]}, tour ${r + 1} : ${lu}`);
      }
    }
    assert.deepEqual(ecarts, []);
  });

  test('le compte de chacun, compté à la main : l’objectif du tour remplace celui de la soirée, la table sans siège libre ne sert personne, la réservation tient hors objectif', () => {
    const instance = normaliser(CORRESPONDANCE);
    assert.deepEqual(instance.ids, [2, 3, 4, 5, 6, 7, 8, 10]);
    // 2 : « finance » sert aux tours 1 et 3 à la table 21, mais au tour 2
    // l'objectif « toutes : finance, Montréal » remplace celui de la soirée.
    // 4 : réservé au tour 1 à 23, sans objectif, quand 21 le servait.
    // 6 : réservé au tour 3 à 21, dont l'objectif ne lui correspond pas,
    // quand 23 le servait. 10 : au tour 2, seule 22, gelée, lui correspond.
    assert.deepEqual(instance.possibles, Int32Array.from([2, 3, 1, 0, 0, 3, 2, 1]));
    assert.deepEqual(instance.siegesLibres, Int32Array.from([4, 4, 3, 1, 2, 2, 1, 0, 1]));
  });

  test('les objectifs distincts se numérotent par table d’identifiant croissant, soirée puis tours, deux objectifs identiques en un seul', () => {
    const instance = normaliser(CORRESPONDANCE);
    // Index de table 0, 1, 2 : identifiants 21, 23, 22. 21 soirée → 0,
    // 21 tour 2 → 1, 22 soirée → 2, 22 tour 1 → 0 (le même que 21 soirée),
    // 23 tour 3 → 3.
    assert.equal(instance.O, 4);
    assert.deepEqual(instance.objectifDe, Int32Array.from([0, 1, 0, SANS_OBJECTIF, SANS_OBJECTIF, 3, 0, 2, 2]));
    assert.equal(instance.correspond.length, instance.N * 4);
  });

  test('sans objectif ni étiquette ni animateur, chaque champ nouveau prend sa valeur vide, et les cases facultatives restent absentes', () => {
    const instance = normaliser(configuration({ participants: personnes([3, 1]), tables: tablesDe([12, 11], 2), tours: 2 }));
    assert.equal(instance.O, 0);
    assert.deepEqual(instance.objectifDe, new Int32Array(4).fill(SANS_OBJECTIF));
    assert.deepEqual(instance.correspond, new Uint8Array(0));
    assert.deepEqual(instance.possible, new Uint8Array(4));
    assert.deepEqual(instance.possibles, new Int32Array(2));
    assert.equal(instance.modeObjectifs, 'places');
    assert.equal(instance.A, 0);
    assert.deepEqual(instance.rangAnimateur, new Int32Array(2).fill(NON_ANIMATEUR));
    assert.deepEqual(instance.animateurs, new Int32Array(0));
    assert.deepEqual(instance.debutAnimes, new Int32Array(5));
    assert.deepEqual(instance.animes, new Int32Array(0));
    assert.deepEqual(instance.borneAnimateurs, new Int32Array(2));
    assert.deepEqual(instance.contraintes, SANS_CONTRAINTE);
    assert.deepEqual(instance.priorites, PRIORITES_PAR_DEFAUT);
    assert.notEqual(instance.priorites, PRIORITES_PAR_DEFAUT);
  });

  test('un objectif sans champ tour vaut pour la soirée, comme un tour nul', () => {
    const avecObjectifs = (objectifs) => normaliser({
      ...configuration({ participants: [etiquete(1, ['finance'])], tables: tablesDe([12, 11], 2), tours: 2 }),
      objectifs,
    });
    const sansTour = avecObjectifs([{ table: 11, regle: 'ou', etiquettes: ['finance'] }]);
    assert.deepEqual(sansTour.objectifDe, Int32Array.from([SANS_OBJECTIF, SANS_OBJECTIF, 0, 0]));
    assert.deepEqual(sansTour, avecObjectifs([objectif(11, null, 'ou', ['finance'])]));
  });

  test('les deux cases facultatives se copient quand la configuration les porte, et aucune autre clé', () => {
    const contraintes = { ...SANS_CONTRAINTE, respecterObjectifs: false, rencontrerAnimateurs: true, autre: true };
    const instance = normaliser(configuration({ participants: personnes([1]), tables: tablesDe([11], 2), tours: 1, contraintes }));
    contraintes.rencontrerAnimateurs = false;
    assert.deepEqual(instance.contraintes, { ...SANS_CONTRAINTE, respecterObjectifs: false, rencontrerAnimateurs: true });
  });
});

describe('normaliser : animateurs et borne des animateurs (§ 4.5, D6, D21)', () => {
  // Tables 41 et 42 de trois places, deux tours. 5 anime aux deux tours à
  // 42 ; 3 anime au seul tour 2 à 41 ; 7 au seul tour 1 à 42 ; 9, exclu,
  // n'anime pas ; 1 et 2 sont libres.
  const ANIMATION = configuration({
    participants: [
      etiquete(5, undefined, [1, 2]),
      etiquete(1),
      etiquete(7, undefined, [1]),
      etiquete(3, undefined, [2]),
      etiquete(2),
      { ...etiquete(9, undefined, [1]), exclu: true },
    ],
    tables: tablesDe([41, 42], 3),
    tours: 2,
    reservations: [tous(5, 42), auTour(3, 41, 2), auTour(7, 42, 1), tous(9, 41)],
  });

  test('rangs des animateurs par identifiant croissant, et rangs de ceux qui animent à chaque table, à chaque tour', () => {
    const instance = normaliser(ANIMATION);
    assert.deepEqual(instance.ids, [1, 2, 3, 5, 7]);
    assert.equal(instance.A, 3);
    assert.deepEqual(instance.rangAnimateur, Int32Array.from([NON_ANIMATEUR, NON_ANIMATEUR, 0, 1, 2]));
    assert.deepEqual(instance.animateurs, Int32Array.from([2, 3, 4]));
    // Lignes t × R + r : (41, 1) aucun, (41, 2) 3, (42, 1) 5 et 7, (42, 2) 5.
    assert.deepEqual(instance.debutAnimes, Int32Array.from([0, 0, 1, 3, 4]));
    assert.deepEqual(instance.animes, Int32Array.from([0, 1, 2, 1]));
  });

  test('B(p) = min(#Φ(p), Σ φ_r(p)), compté à la main', () => {
    const instance = normaliser(ANIMATION);
    // 1 et 2, libres : Φ = {5, 7} au tour 1, {3, 5} au tour 2, soit trois ;
    // φ = 2 au tour 1 (5 et 7 à 42), 1 au tour 2 : B = 3.
    // 3 : libre au tour 1, Φ = {5, 7}, φ = 2 ; fixé à 41 au tour 2, où il
    // anime seul : B = 2. 5 : fixé à 42, n'y rencontre que 7 au tour 1 : B = 1.
    // 7 : fixé à 42 au tour 1, avec 5 ; libre au tour 2, Φ = {3, 5}, φ = 1 :
    // B = min(2, 2) = 2.
    assert.deepEqual(instance.borneAnimateurs, Int32Array.from([3, 3, 2, 1, 2]));
  });

  test('ANIMATION_NON_FIXEE : un tour hors de 1 à R, ou où la personne n’est pas fixée', () => {
    const base = configuration({ participants: personnes([1, 2]), tables: tablesDe([11], 2), tours: 2, reservations: [tous(2, 11)] });
    const avecAnime = (id, anime) => () => normaliser({
      ...base,
      participants: base.participants.map((personne) => (personne.id === id ? { ...personne, anime } : personne)),
    });
    assert.deepEqual(ecartsDeRefus([
      ['un tour 3 sur deux', avecAnime(2, [1, 3]), 'ANIMATION_NON_FIXEE', { participant: 2, tour: 3 }],
      ['un tour 0', avecAnime(2, [0]), 'ANIMATION_NON_FIXEE', { participant: 2, tour: 0 }],
      // Le tour 0 de la première personne désignerait la case qui précède
      // instance.fixe : il se refuse avant toute lecture de case.
      ['un tour 0 de la première personne', avecAnime(1, [0]), 'ANIMATION_NON_FIXEE', { participant: 1, tour: 0 }],
      ['un tour non entier', avecAnime(2, [1.5]), 'ANIMATION_NON_FIXEE', { participant: 2, tour: 1.5 }],
      ['un tour en texte', avecAnime(2, ['1']), 'ANIMATION_NON_FIXEE', { participant: 2, tour: '1' }],
      ['un tour où la personne est libre', avecAnime(1, [1]), 'ANIMATION_NON_FIXEE', { participant: 1, tour: 1 }],
    ]), []);
  });
});

describe('normaliser : animateurs, formes de la liste des tours animés', () => {
  const avecAnime = (anime) => normaliser(configuration({
    participants: [etiquete(1, undefined, anime), etiquete(2)],
    tables: tablesDe([11], 2),
    tours: 2,
    reservations: [tous(1, 11)],
  }));

  test('une liste vide : la personne n’anime pas et ne reçoit aucun rang', () => {
    const instance = avecAnime([]);
    assert.equal(instance.A, 0);
    assert.deepEqual(instance.rangAnimateur, Int32Array.from([NON_ANIMATEUR, NON_ANIMATEUR]));
    assert.deepEqual(instance.animateurs, new Int32Array(0));
  });

  test('des tours animés qui ne sont pas une liste lèvent TypeError, au message qui le dit', () => {
    // Une chaîne se parcourrait caractère par caractère, un nombre ne se
    // parcourt pas : chacun se refuse avant le premier tour.
    for (const anime of [1, '12', { 0: 1, length: 1 }]) {
      exigerTypeError(() => avecAnime(anime), 'participant 1 : tours animés en liste attendus', libelleDe(anime));
    }
  });
});

describe('normaliser : la borne des animateurs, tables pleines et tours fixés', () => {
  test('une table sans siège libre au tour ne compte pas pour qui y est libre ; un fixé y rencontre ceux qui l’animent, à chaque tour', () => {
    // Tables 11 et 12 de deux places, deux tours. 2 anime au tour 2 à 12, où
    // 3 est aussi fixé : la table 12, d'index 1, y est pleine. 1, libre aux
    // deux tours, n'y peut pas siéger au tour 2 : B = 0. 3 rencontre 2 au
    // tour 2 : B = min(1, 1) = 1. 2 ne se rencontre pas lui-même.
    const instance = normaliser(configuration({
      participants: [etiquete(1), etiquete(2, undefined, [2]), etiquete(3)],
      tables: tablesDe([11, 12], 2),
      tours: 2,
      reservations: [auTour(2, 12, 2), auTour(3, 12, 2)],
    }));
    assert.deepEqual(instance.siegesLibres, Int32Array.from([2, 2, 2, 0]));
    assert.deepEqual(instance.borneAnimateurs, Int32Array.from([0, 0, 1]));
  });

  test('chaque animateur de la table fixée compte une fois dans Σ φ_r(p), qui borne alors #Φ(p)', () => {
    // Trois tables de trois places, deux tours. 5 anime au tour 1 à 11 ; 6 et
    // 7 animent au tour 2, à 12 et à 13. 1, fixé à 11 au tour 1, y rencontre
    // 5 : φ_1 = 1. Libre au tour 2, il peut rejoindre 6 ou 7, une table à la
    // fois : φ_2 = 1. #Φ(1) = 3, Σ φ = 2 : B = 2.
    const instance = normaliser(configuration({
      participants: [etiquete(1), etiquete(5, undefined, [1]), etiquete(6, undefined, [2]), etiquete(7, undefined, [2])],
      tables: tablesDe([11, 12, 13], 3),
      tours: 2,
      reservations: [auTour(1, 11, 1), tous(5, 11), auTour(6, 12, 2), auTour(7, 13, 2)],
    }));
    assert.equal(instance.borneAnimateurs[instance.indexDe.get(1)], 2);
  });
});

describe('normaliser : les étiquettes des personnes, en index (§ 4.5, D39)', () => {
  test('les étiquettes distinctes des présents se rangent par unités de code ; chacun porte les siennes en index croissants, une fois chacune', () => {
    const instance = normaliser(configuration({
      participants: [
        etiquete(4, ['finance', 'Montréal', 'finance']),
        etiquete(2, ['Écoute', 'bénévole']),
        etiquete(3),
        etiquete(6, ['Finance']),
        { ...etiquete(5, ['ressources humaines', 'finance']), exclu: true },
        etiquete(7, []),
      ],
      tables: tablesDe([11, 12], 4),
      tours: 1,
    }));
    assert.deepEqual(instance.ids, [2, 3, 4, 6, 7]);
    // Par unités de code, « F » (0x46) < « M » < « b » < « f » < « É »
    // (0xC9), là où l'ordre alphabétique mettrait « Écoute » en deuxième ;
    // deux orthographes font deux étiquettes, et « ressources humaines », que
    // seul l'exclu porte, n'y entre pas.
    assert.deepEqual(instance.libellesEtiquettes, ['Finance', 'Montréal', 'bénévole', 'finance', 'Écoute']);
    // 2 : bénévole (2), Écoute (4) ; 3 : aucune ; 4 : Montréal (1), finance
    // (3), qu'il porte deux fois ; 6 : Finance (0) ; 7 : aucune.
    assert.deepEqual(instance.debutEtiquettes, Int32Array.from([0, 2, 2, 4, 5, 5]));
    assert.deepEqual(instance.etiquettes, Int32Array.from([2, 4, 1, 3, 0]));
  });

  test('chaque personne retrouve ses étiquettes distinctes, et seulement elles : lecture directe de la configuration', () => {
    const instance = normaliser(CORRESPONDANCE);
    const { presents } = lectureDirecte(CORRESPONDANCE);
    const lues = presents.map((_, p) =>
      [...instance.etiquettes.subarray(instance.debutEtiquettes[p], instance.debutEtiquettes[p + 1])]
        .map((e) => instance.libellesEtiquettes[e]));
    const attendues = presents.map(({ etiquettes = [] }) =>
      [...new Set(etiquettes)].sort((a, b) => instance.libellesEtiquettes.indexOf(a) - instance.libellesEtiquettes.indexOf(b)));
    assert.deepEqual(lues, attendues);
    assert.deepEqual(instance.libellesEtiquettes, ['Montréal', 'bénévole', 'finance', 'ressources humaines']);
    assert.equal(instance.debutEtiquettes.length, instance.N + 1);
  });

  test('une étiquette répétée ne s’inscrit qu’une fois, en tête ou en fin de liste comme ailleurs', () => {
    // 1 répète la seule étiquette qu'il porte ; 2 répète sa plus petite, puis
    // sa plus grande.
    const instance = normaliser(configuration({
      participants: [etiquete(1, ['tricot', 'tricot']), etiquete(2, ['voile', 'aquarelle', 'aquarelle', 'voile'])],
      tables: tablesDe([11], 2),
      tours: 1,
    }));
    assert.deepEqual(instance.libellesEtiquettes, ['aquarelle', 'tricot', 'voile']);
    assert.deepEqual(instance.debutEtiquettes, Int32Array.from([0, 1, 3]));
    assert.deepEqual(instance.etiquettes, Int32Array.from([1, 0, 2]));
  });

  test('sans étiquette : aucun libellé, aucune entrée, et debutEtiquettes ne porte que des zéros', () => {
    const instance = normaliser(configuration({
      participants: [...personnes([3, 1]), etiquete(2, []), { ...etiquete(4, ['finance']), exclu: true }],
      tables: tablesDe([12, 11], 2),
      tours: 2,
    }));
    assert.deepEqual(instance.libellesEtiquettes, []);
    assert.deepEqual(instance.debutEtiquettes, new Int32Array(4));
    assert.deepEqual(instance.etiquettes, new Int32Array(0));
  });
});

describe('normaliser : refus des objectifs, du mode et des priorités (A12, A16)', () => {
  const base = configuration({ participants: personnes([1, 2, 3]), tables: tablesDe([11, 12], 2), tours: 2 });
  const avec = (modification) => () => normaliser({ ...base, ...modification });
  const ordre = (...paliers) => paliers.map((palier) => palier.map((critere) => ({ critere, poids: 1 })));
  const [ecart, excedent, collisions, horsObjectif, repetees, animateurs, redondance] = CRITERES;

  test('chaque code, sur un cas', () => {
    assert.deepEqual(ecartsDeRefus([
      ['un objectif sur une table inconnue', avec({ objectifs: [objectif(99, null, 'ou', ['finance'])] }),
        'OBJECTIF_INCONNU', { table: 99 }],
      ...[0, 3, 1.5, '1'].map((tour) => [
        `un objectif au tour ${libelleDe(tour)}`, avec({ objectifs: [objectif(12, tour, 'ou', ['finance'])] }),
        'OBJECTIF_TOUR', { table: 12, tour },
      ]),
      ['deux objectifs de soirée', avec({ objectifs: [objectif(11, null, 'ou', ['finance']), objectif(11, null, 'et', ['bénévole'])] }),
        'OBJECTIF_CONFLIT', { table: 11, tour: null }],
      ['deux objectifs du tour 2', avec({ objectifs: [objectif(12, 2, 'ou', ['finance']), objectif(12, 2, 'ou', ['finance'])] }),
        'OBJECTIF_CONFLIT', { table: 12, tour: 2 }],
      // Un objectif sans champ tour est de soirée : le conflit le dit au tour nul.
      ['deux objectifs de soirée, le second sans champ tour',
        avec({ objectifs: [objectif(11, null, 'ou', ['finance']), { table: 11, regle: 'et', etiquettes: ['bénévole'] }] }),
        'OBJECTIF_CONFLIT', { table: 11, tour: null }],
      ['une liste de priorités qui n’est pas une liste', avec({ priorites: 'ordre' }), 'PRIORITES', { faute: 'forme' }],
      ['un palier vide', avec({ priorites: [[]] }), 'PRIORITES', { faute: 'palierVide', palier: 0 }],
      ['un poids hors domaine', avec({ priorites: [[{ critere: excedent, poids: 101 }]] }),
        'PRIORITES', { faute: 'poids', critere: excedent, palier: 0 }],
      ['les tours hors objectif joints sous « chacun au moins une fois »',
        avec({
          modeObjectifs: 'chacun',
          priorites: ordre([ecart], [excedent], [collisions, horsObjectif], [repetees], [animateurs], [redondance]),
        }),
        'PRIORITES', { faute: 'seulASonPalier', critere: horsObjectif, palier: 2 }],
    ]), []);
  });

  test('une liste incomplète se complète par l’ordre par défaut avant d’être jugée', () => {
    const instance = normaliser({ ...base, priorites: ordre([redondance], [ecart]) });
    assert.deepEqual(instance.priorites, ordre([redondance], [ecart], [excedent], [collisions], [horsObjectif], [repetees], [animateurs]));
    assert.equal(verifierPriorites(instance.priorites, 'places'), null);
    // Le même partage, sous le mode par défaut, est reçu.
    const partage = ordre([ecart], [excedent], [collisions, horsObjectif], [repetees], [animateurs], [redondance]);
    assert.deepEqual(normaliser({ ...base, priorites: partage }).priorites, partage);
  });

  test('une forme hors du contrat lève TypeError', () => {
    const cas = [
      ['des objectifs en objet', { objectifs: {} }],
      ['une règle non résolue', { objectifs: [objectif(11, null, null, ['finance'])] }],
      ['une règle inconnue', { objectifs: [objectif(11, null, 'toutes', ['finance'])] }],
      ['des étiquettes d’objectif en texte', { objectifs: [objectif(11, null, 'ou', 'finance')] }],
      ['une étiquette d’objectif numérique', { objectifs: [objectif(11, null, 'ou', [7])] }],
      ['des étiquettes de personne en texte', { participants: [etiquete(1, 'finance')] }],
      ['une étiquette de personne nulle', { participants: [etiquete(1, [null])] }],
      ['un mode inconnu', { modeObjectifs: 'egal' }],
      ['une case des objectifs non booléenne', { contraintes: { ...SANS_CONTRAINTE, respecterObjectifs: 'oui' } }],
      ['une case des animateurs non booléenne', { contraintes: { ...SANS_CONTRAINTE, rencontrerAnimateurs: 1 } }],
      ['des tours animés en nombre', { participants: [etiquete(1, undefined, 1)], reservations: [tous(1, 11)] }],
      ['des tours animés décroissants', { participants: [etiquete(1, undefined, [2, 1])], reservations: [tous(1, 11)] }],
      ['un tour animé répété', { participants: [etiquete(1, undefined, [1, 1])], reservations: [tous(1, 11)] }],
    ];
    const ecarts = [];
    for (const [libelle, modification] of cas) {
      try {
        normaliser({ ...base, ...modification });
        ecarts.push(`${libelle} : aucun refus`);
      } catch (erreur) {
        if (!(erreur instanceof TypeError)) ecarts.push(`${libelle} : ${erreur?.name} au lieu de TypeError`);
      }
    }
    assert.deepEqual(ecarts, []);
  });
});

describe('normaliser : état des critères (§ 5.3, A8, D10)', () => {
  const etat = (instance, nom) => instance.etatCriteres.find((critere) => critere.nom === nom);

  test('un état par critère, dans l’ordre du registre ; sans objectif ni animateur, les deux critères nouveaux sont sans objet', () => {
    const instance = normaliser(configuration({ participants: personnes([1, 2]), tables: tablesDe([11], 2), tours: 2 }));
    assert.deepEqual(instance.etatCriteres.map(({ nom }) => nom), [...CRITERES]);
    assert.deepEqual(etat(instance, 'toursHorsObjectif'), {
      nom: 'toursHorsObjectif', coche: true, sansObjet: true, valeurs: ['toursHorsObjectif'],
    });
    assert.deepEqual(etat(instance, 'animateursNonRencontres'), {
      nom: 'animateursNonRencontres', coche: false, sansObjet: true, valeurs: ['animateursNonRencontres'],
    });
    assert.deepEqual(etat(instance, 'rencontresRepetees'), {
      nom: 'rencontresRepetees', coche: false, sansObjet: false, valeurs: ['retoursChoisis'],
    });
    assert.deepEqual(etat(instance, 'ecartAuPlafondAPrioriMax'), {
      nom: 'ecartAuPlafondAPrioriMax', coche: true, sansObjet: false, valeurs: ['ecartAuPlafondAPrioriMax'],
    });
  });

  test('un couple possible donne un objet aux objectifs, une borne non nulle aux animateurs ; le mode choisit les valeurs', () => {
    const instance = normaliser({
      ...configuration({
        participants: [etiquete(1, ['finance']), etiquete(2, undefined, [1]), etiquete(3)],
        tables: tablesDe([11, 12], 2),
        tours: 1,
        reservations: [tous(2, 12)],
        contraintes: { ...SANS_CONTRAINTE, nouveauxVoisins: true, respecterObjectifs: false, rencontrerAnimateurs: true },
      }),
      objectifs: [objectif(11, null, 'ou', ['finance'])],
      modeObjectifs: 'minimum',
    });
    assert.equal(instance.modeObjectifs, 'minimum');
    assert.deepEqual(etat(instance, 'toursHorsObjectif'), {
      nom: 'toursHorsObjectif', coche: false, sansObjet: false, valeurs: ['horsObjectifMax', 'toursHorsObjectif'],
    });
    assert.deepEqual(etat(instance, 'animateursNonRencontres'), {
      nom: 'animateursNonRencontres', coche: true, sansObjet: false, valeurs: ['animateursNonRencontres'],
    });
    assert.deepEqual(etat(instance, 'rencontresRepetees').valeurs, ['rencontresRepeteesChoisies']);
  });

  test('un objectif que personne ne porte laisse les objectifs sans objet', () => {
    const instance = normaliser({
      ...configuration({ participants: [etiquete(1, ['finance']), etiquete(2)], tables: tablesDe([11], 2), tours: 1 }),
      objectifs: [objectif(11, null, 'et', ['finance', 'Montréal'])],
    });
    assert.equal(instance.O, 1);
    assert.equal(etat(instance, 'toursHorsObjectif').sansObjet, true);
  });
});

// --- La présence par tour (§ 4.4, § 5.2, § 5.9) ------------------------------

// Participant présent aux seuls tours de presence ; etiquettes et anime, quand
// ils sont donnés, comme etiquete.
const presente = (id, presence, { etiquettes, anime } = {}) => ({ ...etiquete(id, etiquettes, anime), presence });

describe('normaliser : la présence par tour, le masque et ses comptes', () => {
  // Trois tours, deux tables de 3 déclarées hors de l'ordre de leurs
  // identifiants, cinq personnes d'identifiants pairs, fournies dans le
  // désordre : 4 est présente aux tours 1 et 3, 10 au seul tour 2.
  const MASQUE = configuration({
    participants: [presente(10, [2]), ...personnes([2, 6]), presente(4, [1, 3]), ...personnes([8])],
    tables: tablesDe([12, 11], 3),
    tours: 3,
  });

  test('le masque present, les tours de présence de chacun, les présents de chaque tour et le compte des absences', () => {
    const instance = normaliser(MASQUE);
    assert.deepEqual(instance.ids, [2, 4, 6, 8, 10]);
    // Rangées p × R + r, ids [2, 4, 6, 8, 10].
    assert.deepEqual(instance.present, Uint8Array.from([
      1, 1, 1,
      1, 0, 1,
      1, 1, 1,
      1, 1, 1,
      0, 1, 0,
    ]));
    assert.deepEqual(instance.toursPresents, Int32Array.from([3, 2, 3, 3, 1]));
    assert.deepEqual(instance.presentsParTour, Int32Array.from([4, 4, 4]));
    assert.equal(instance.absences, 3);
  });

  test('une présence qui couvre chaque tour vaut le champ absent : la même instance, champ pour champ', () => {
    const avecReservation = { reservations: [tous(2, 11), auTour(6, 12, 2)] };
    const sans = normaliser({ ...MASQUE, participants: personnes([10, 2, 6, 4, 8]), ...avecReservation });
    const pleine = normaliser({
      ...MASQUE,
      participants: [presente(10, [1, 2, 3]), ...personnes([2]), presente(6, [1, 2, 3]), ...personnes([4, 8])],
      ...avecReservation,
    });
    assert.deepEqual(pleine, sans);
  });

  test('sans aucune présence, chaque champ de la présence prend sa valeur neutre : tous présents, N − 1 co-présents, n_p mobiles co-présents', () => {
    // 3 est ancré à la table 11 : n = 4, n_p = 3 pour un non-ancré, 4 pour
    // l'ancré.
    const instance = normaliser(configuration({
      participants: personnes([5, 1, 3, 9, 7]),
      tables: tablesDe([12, 11], 3),
      tours: 2,
      reservations: [tous(3, 11)],
    }));
    assert.deepEqual(instance.present, new Uint8Array(10).fill(1));
    assert.deepEqual(instance.toursPresents, new Int32Array(5).fill(2));
    assert.deepEqual(instance.presentsParTour, new Int32Array(2).fill(5));
    assert.equal(instance.absences, 0);
    assert.deepEqual(instance.coPresents, new Int32Array(5).fill(4));
    assert.deepEqual(instance.mobilesCoPresents, Int32Array.from([3, 4, 3, 3, 3]));
  });

  test('la présence d’un exclu ne change rien à l’instance', () => {
    const base = configuration({ participants: [...personnes([1, 2]), exclu(3)], tables: tablesDe([11], 2), tours: 3 });
    const avecPresence = { ...base, participants: [...personnes([1, 2]), { ...exclu(3), presence: [2] }] };
    assert.deepEqual(normaliser(avecPresence), normaliser(base));
  });

  test('co-présence : les autres personnes présentes avec p à un tour au moins, et parmi elles les non-ancrées', () => {
    // Six personnes, trois tours, deux tables de 3. 1 n'est présente qu'au
    // tour 1, 2 qu'aux tours 2 et 3 : elles ne se croisent jamais, et chacune
    // a 4 co-présents ; les autres en ont 5.
    const participants = [presente(1, [1]), presente(2, [2, 3]), ...personnes([3, 4, 5, 6])];
    const sansAncre = normaliser(configuration({ participants, tables: tablesDe([12, 11], 3), tours: 3 }));
    assert.deepEqual(sansAncre.coPresents, Int32Array.from([4, 4, 5, 5, 5, 5]));
    assert.deepEqual(sansAncre.mobilesCoPresents, Int32Array.from([4, 4, 5, 5, 5, 5]));
    // 6, ancrée à la table 11, est présente partout : chacun la compte parmi
    // ses co-présents, aucun parmi ses mobiles co-présents ; elle-même voit
    // les cinq autres, toutes mobiles (n = 5).
    const avecAncre = normaliser(configuration({
      participants,
      tables: tablesDe([12, 11], 3),
      tours: 3,
      reservations: [tous(6, 11)],
    }));
    assert.deepEqual(avecAncre.statut, Uint8Array.from([MOBILE, MOBILE, MOBILE, MOBILE, MOBILE, ANCRE]));
    assert.deepEqual(avecAncre.coPresents, Int32Array.from([4, 4, 5, 5, 5, 5]));
    assert.deepEqual(avecAncre.mobilesCoPresents, Int32Array.from([3, 3, 4, 4, 4, 5]));
  });

  test('co-présence : deux personnes au même motif de présence lisent le même compte, deux motifs disjoints aucun co-présent de l’autre', () => {
    // Trois tours. 1 et 2 aux tours 1 et 2, 3 au seul tour 3, 4 partout.
    const instance = normaliser(configuration({
      participants: [presente(1, [1, 2]), presente(2, [1, 2]), presente(3, [3]), ...personnes([4])],
      tables: tablesDe([11], 4),
      tours: 3,
    }));
    assert.deepEqual(instance.coPresents, Int32Array.from([2, 2, 1, 3]));
  });

  test('co-présence au-delà de 32 personnes : chaque compte vaut le décompte paire par paire, bits 31 et 32 et au-delà compris', () => {
    // Quarante personnes (index = id − 1), trois tours, six tables de 8. Les
    // présences partielles tombent sur le dernier bit du premier mot (index
    // 31) et dans le second mot (index 32, 35, 39) ; 1 à 10 ne sont qu'au
    // tour 1. 20 et 34, ancrées, sont présentes partout.
    const presences = new Map([[32, [2]], [33, [1, 2]], [36, [1, 3]], [40, [3]]]);
    for (const id of suite(1, 10)) presences.set(id, [1]);
    const ancrees = new Set([20, 34]);
    const ids = suite(1, 40);
    const participants = ids.map((id) => (presences.has(id) ? presente(id, presences.get(id)) : personnes([id])[0]));
    const instance = normaliser(configuration({
      participants,
      tables: tablesDe(suite(101, 106), 8),
      tours: 3,
      reservations: [tous(20, 101), tous(34, 102)],
    }));
    // Le décompte direct : q ≠ p partage un tour de présence avec p ; parmi
    // elles, les mobiles co-présentes ne sont pas ancrées.
    const toursDe = (id) => presences.get(id) ?? [1, 2, 3];
    const croise = (a, b) => toursDe(a).some((tour) => toursDe(b).includes(tour));
    const attendus = ids.map((p) => ids.filter((q) => q !== p && croise(p, q)));
    assert.deepEqual(instance.ids, ids);
    assert.deepEqual(instance.coPresents, Int32Array.from(attendus, (autres) => autres.length));
    assert.deepEqual(
      instance.mobilesCoPresents,
      Int32Array.from(attendus, (autres) => autres.filter((q) => !ancrees.has(q)).length),
    );
    // Deux comptes lus en clair : le tour 1 a 38 présents (tous sauf 32 et
    // 40), d'où 37 pour 1 ; le tour 2 en a 28 (tous sauf 1 à 10, 36 et 40),
    // d'où 27 pour 32.
    assert.equal(instance.coPresents[0], 37);
    assert.equal(instance.coPresents[31], 27);
  });

  test('co-présence à 33 personnes : la 33e, seule dans le second mot de 32 bits, garde ses comptes et ceux des autres', () => {
    // Trente-trois personnes (index = id − 1), deux tours, cinq tables de 8.
    // 1 n'est présente qu'au tour 1, 33 qu'au tour 2 : elles ne se croisent
    // pas et ont chacune 31 co-présents ; les 31 autres, présentes partout,
    // en ont 32.
    const participants = [presente(1, [1]), ...personnes(suite(2, 32)), presente(33, [2])];
    const instance = normaliser(configuration({ participants, tables: tablesDe(suite(101, 105), 8), tours: 2 }));
    const attendus = Int32Array.from(suite(1, 33), (id) => (id === 1 || id === 33 ? 31 : 32));
    assert.equal(instance.absences, 2);
    assert.deepEqual(instance.coPresents, attendus);
    assert.deepEqual(instance.mobilesCoPresents, attendus);
  });
});

describe('normaliser : la présence par tour, ses refus', () => {
  // Trois personnes, deux tables de 2, trois tours ; 3 est exclue.
  const base = configuration({
    participants: [...personnes([1, 2]), exclu(3)],
    tables: tablesDe([11, 12], 2),
    tours: 3,
  });
  // La configuration où la personne id porte presence.
  const avecPresence = (id, presence, modification = {}) => () => normaliser({
    ...base,
    participants: base.participants.map((personne) => (personne.id === id ? { ...personne, presence } : personne)),
    ...modification,
  });

  test('chaque code, sur une présente et sur une exclue', () => {
    const cas = [2, 3].flatMap((id) => [
      ...[0, 4, 1.5, '1', -1].map((tour) => [
        `${id} au tour ${libelleDe(tour)}`, avecPresence(id, [tour]), 'PRESENCE_TOUR', { participant: id, tour },
      ]),
      [`${id} au tour 4 après le tour 1`, avecPresence(id, [1, 4]), 'PRESENCE_TOUR', { participant: id, tour: 4 }],
      [`${id} présente à aucun tour`, avecPresence(id, []), 'PRESENCE_VIDE', { participant: id }],
    ]);
    assert.deepEqual(ecartsDeRefus(cas), []);
  });

  test('une exclue présente au seul tour 5 de quatre tours lève PRESENCE_TOUR : le contrôle couvre les exclus', () => {
    assert.deepEqual(ecartsDeRefus([
      ['exclue au tour 5 sur quatre', avecPresence(3, [5], { tours: 4 }), 'PRESENCE_TOUR', { participant: 3, tour: 5 }],
    ]), []);
  });

  test('une présence qui n’est pas une liste strictement croissante lève TypeError, exclus compris', () => {
    for (const id of [2, 3]) {
      for (const presence of ['x', null, 2, { 0: 1 }]) {
        exigerTypeError(avecPresence(id, presence), `participant ${id} : présence en liste attendue`, `${id}, ${String(presence)}`);
      }
      for (const presence of [[2, 1], [1, 1], [1, 3, 2]]) {
        exigerTypeError(
          avecPresence(id, presence),
          `participant ${id} : tours de présence strictement croissants attendus`,
          `${id}, [${presence.join(', ')}]`,
        );
      }
    }
  });

  test('la présence se contrôle après le nombre de tours, et avant les réservations', () => {
    assert.deepEqual(ecartsDeRefus([
      ['des tours faux et une présence fautive', avecPresence(2, [9], { tours: 0 }), 'TOURS', { tours: 0 }],
      ['une réservation fautive et une présence fautive', avecPresence(2, [9], { reservations: [tous(42, 11)] }),
        'PRESENCE_TOUR', { participant: 2, tour: 9 }],
      ['une réservation fautive et une présence vide', avecPresence(1, [], { reservations: [auTour(1, 11, 7)] }),
        'PRESENCE_VIDE', { participant: 1 }],
    ]), []);
  });
});

describe('normaliser : la présence par tour, les réservations, les couples et les animateurs', () => {
  // Tables 20 puis 10, de 3 places : la table 10 a l'index 1.
  const tables = tablesDe([20, 10], 3);

  test('une réservation est suspendue aux tours d’absence : la personne n’y est pas fixée, et n’est plus ancrée', () => {
    const avec = (presence) => normaliser(configuration({
      participants: [presente(1, presence), ...personnes([2])],
      tables,
      tours: 3,
      reservations: [tous(1, 10)],
    }));
    const partielle = avec([1, 2]);
    assert.deepEqual(partielle.fixe.subarray(0, 3), Int32Array.from([1, 1, LIBRE]));
    assert.equal(partielle.statut[0], PARTIELLEMENT_FIXE);
    assert.equal(partielle.k, 0);
    assert.deepEqual(partielle.ancresParTable, Int32Array.from([0, 0]));
    // Sièges libres de la table d'index 1 aux trois tours : sa place se rend
    // au tour 3.
    assert.deepEqual(partielle.siegesLibres.subarray(3, 6), Int32Array.from([2, 2, 3]));
    const pleine = avec(undefined);
    assert.deepEqual(pleine.fixe.subarray(0, 3), Int32Array.from([1, 1, 1]));
    assert.equal(pleine.statut[0], ANCRE);
    assert.equal(pleine.k, 1);
  });

  test('deux réservations contraires à un tour d’absence ne sont pas en conflit', () => {
    const avec = (presence) => () => normaliser(configuration({
      participants: [presente(1, presence), ...personnes([2])],
      tables,
      tours: 3,
      reservations: [tous(1, 10), auTour(1, 20, 3)],
    }));
    assert.deepEqual(avec([1, 2])().fixe.subarray(0, 3), Int32Array.from([1, 1, LIBRE]));
    assert.deepEqual(ecartsDeRefus([
      ['sans la présence', avec(undefined), 'RESERVATION_CONFLIT', { participant: 1, tour: 3, tables: [10, 20] }],
    ]), []);
  });

  test('une absence au tour réservé ne fait pas surréserver : la place se rend', () => {
    // Table 10 de 3 places, quatre réservations « tous » ; 4 est absente au
    // tour 2.
    const avec = (presence) => () => normaliser(configuration({
      participants: [...personnes([1, 2, 3]), presente(4, presence)],
      tables,
      tours: 2,
      reservations: [tous(1, 10), tous(2, 10), tous(3, 10), auTour(4, 10, 2)],
    }));
    assert.equal(avec([1])().siegesLibres[1 * 2 + 1], 0);
    assert.deepEqual(ecartsDeRefus([
      ['présente au tour 2', avec([2]), 'SURRESERVATION', { table: 10, tour: 2, reservees: 4, capacite: 3 }],
    ]), []);
  });

  test('ANIMATION_ABSENTE : un tour animé où la personne est absente, contrôlé avant ANIMATION_NON_FIXEE', () => {
    const avec = (anime, presence) => () => normaliser(configuration({
      participants: [presente(1, presence, { anime }), ...personnes([2])],
      tables,
      tours: 3,
      reservations: [tous(1, 10)],
    }));
    assert.deepEqual(ecartsDeRefus([
      // La réservation, suspendue au tour 3, n'y fixe plus la personne :
      // ANIMATION_NON_FIXEE y dirait un motif faux.
      ['un tour animé d’absence', avec([3], [1, 2]), 'ANIMATION_ABSENTE', { participant: 1, tour: 3 }],
      ['le second tour animé d’absence', avec([1, 3], [1, 2]), 'ANIMATION_ABSENTE', { participant: 1, tour: 3 }],
      // Un tour hors de 1..R se refuse avant toute lecture du masque.
      ['un tour animé hors des tours', avec([4], [1, 2]), 'ANIMATION_NON_FIXEE', { participant: 1, tour: 4 }],
      ['un tour animé 0', avec([0], [1, 2]), 'ANIMATION_NON_FIXEE', { participant: 1, tour: 0 }],
    ]), []);
    // Présente et réservée à chacun de ses tours animés : elle anime.
    assert.equal(avec([1, 2], [1, 2])().A, 1);
  });

  test('ANIMATION_ABSENTE se lit dans la rangée du masque de l’animatrice, quel que soit son index', () => {
    // 7, d'index 2, réservée partout, est absente au tour 2 qu'elle anime ;
    // 3 et 5 sont présentes partout.
    const refus = () => normaliser(configuration({
      participants: [...personnes([3, 5]), presente(7, [1, 3], { anime: [2] })],
      tables,
      tours: 3,
      reservations: [tous(7, 10)],
    }));
    assert.deepEqual(ecartsDeRefus([
      ['7 anime le tour 2 de son absence', refus, 'ANIMATION_ABSENTE', { participant: 7, tour: 2 }],
    ]), []);
  });

  test('un couple (personne, tour) n’est pas possible à un tour d’absence', () => {
    // L'objectif « x » vaut pour la soirée à la table 10 ; 1 porte « x ».
    const avec = (presence) => normaliser({
      ...configuration({ participants: [presente(1, presence, { etiquettes: ['x'] }), ...personnes([2])], tables, tours: 3 }),
      objectifs: [objectif(10, null, 'ou', ['x'])],
    });
    const partielle = avec([1, 3]);
    assert.deepEqual(partielle.possible.subarray(0, 3), Uint8Array.from([1, 0, 1]));
    assert.equal(partielle.possibles[0], 2);
    assert.equal(partielle.etatCriteres.find(({ nom }) => nom === 'toursHorsObjectif').sansObjet, false);
    assert.deepEqual(avec(undefined).possible.subarray(0, 3), Uint8Array.from([1, 1, 1]));
  });

  test('la borne des animateurs ne compte que les tours de présence', () => {
    // 1 anime à la table 10 au tour 1, 2 à la table 20 au tour 2 ; 3 est
    // libre. Présente aux deux tours, 3 peut rejoindre l'un puis l'autre :
    // B = 2 ; présente au seul tour 1 : B = 1.
    const avec = (presence) => normaliser(configuration({
      participants: [etiquete(1, undefined, [1]), etiquete(2, undefined, [2]), presente(3, presence)],
      tables,
      tours: 2,
      reservations: [auTour(1, 10, 1), auTour(2, 20, 2)],
    }));
    assert.equal(avec(undefined).borneAnimateurs[2], 2);
    assert.equal(avec([1]).borneAnimateurs[2], 1);
    assert.equal(avec([2]).borneAnimateurs[2], 1);
  });

  test('figerConfiguration fige aussi la présence de chaque participant', () => {
    const figee = figerConfiguration(configuration({
      participants: [presente(1, [2]), ...personnes([2])],
      tables,
      tours: 2,
    }));
    assert.equal(Object.isFrozen(figee.participants[0].presence), true);
    assert.equal(normaliser(figee), normaliser(figee));
  });
});

describe('placesManquantesParTour (§ 5.9)', () => {
  // Deux tables de 2, soit 4 places, cinq personnes, deux tours.
  const salle = (participants) => normaliser(configuration({ participants, tables: tablesDe([12, 11], 2), tours: 2 }));

  test('sans absence, le même manque à chaque tour, celui de nombrePlacesManquantes', () => {
    const instance = salle(personnes(suite(1, 5)));
    assert.deepEqual(placesManquantesParTour(instance), [1, 1]);
    assert.equal(nombrePlacesManquantes(instance), 1);
  });

  test('par tour, sur les présents : une absente au tour 2 y rend la place qui manque', () => {
    const instance = salle([...personnes([1, 2, 3, 4]), presente(5, [1])]);
    assert.deepEqual(placesManquantesParTour(instance), [1, 0]);
    assert.equal(nombrePlacesManquantes(instance), 1);
  });

  test('une salle trop petite pour tous suffit aux présents de chaque tour', () => {
    const instance = salle([...personnes([1, 2, 3]), presente(4, [1]), presente(5, [2])]);
    assert.deepEqual(placesManquantesParTour(instance), [0, 0]);
    assert.equal(nombrePlacesManquantes(instance), 0);
  });

  test('nombrePlacesManquantes rend le plus grand manque d’un tour', () => {
    const instance = salle([...personnes(suite(1, 5)), presente(6, [2]), presente(7, [2])]);
    assert.deepEqual(placesManquantesParTour(instance), [1, 3]);
    assert.equal(nombrePlacesManquantes(instance), 3);
  });
});

describe('plans : la présence par tour (§ 8.9)', () => {
  // Deux tables de 2, d'identifiants 12 puis 11, cinq personnes, deux
  // tours : 4 n'est présente qu'au tour 1, 5 qu'au tour 2.
  const instanceAbsences = () => normaliser(configuration({
    participants: [...personnes([1, 2, 3]), presente(4, [1]), presente(5, [2])],
    tables: tablesDe([12, 11], 2),
    tours: 2,
  }));
  // Tour 1 : 1 et 2 à 12, 3 et 4 à 11 ; tour 2 : 1 et 2 à 12, 3 et 5 à 11.
  // Rangées p × R + r, ids 1 à 5.
  const TABLE_DE = [
    0, 0,
    0, 0,
    1, 1,
    1, RESERVE,
    RESERVE, 1,
  ];
  const PLAN = {
    tables: [12, 11],
    tours: [[[1, 2], [3, 4]], [[1, 2], [3, 5]]],
    reserves: [[], []],
  };

  test('planDepuisIndex ne liste un absent nulle part : les réserves ne portent que des présents', () => {
    const instance = instanceAbsences();
    assert.deepEqual(planDepuisIndex(instance, Int32Array.from(TABLE_DE)), PLAN);
    // 1 en réserve au tour 1 y figure, 5, absente, non.
    const tableDe = Int32Array.from(TABLE_DE);
    tableDe[0] = RESERVE;
    assert.deepEqual(planDepuisIndex(instance, tableDe).reserves, [[1], []]);
  });

  test('indexerPlan : un absent placé à une table ou en réserve lève PLAN_ABSENT_PLACE ; omis, il vaut RESERVE', () => {
    const instance = instanceAbsences();
    const variante = (modifier) => () => {
      const plan = structuredClone(PLAN);
      modifier(plan);
      return indexerPlan(instance, plan);
    };
    assert.deepEqual(ecartsDeRefus([
      ['5 assise au tour 1', variante((plan) => plan.tours[0][1].push(5)), 'PLAN_ABSENT_PLACE', { participant: 5, tour: 1 }],
      ['5 en réserve au tour 1', variante((plan) => plan.reserves[0].push(5)), 'PLAN_ABSENT_PLACE', { participant: 5, tour: 1 }],
      ['4 assise au tour 2', variante((plan) => plan.tours[1][0].push(4)), 'PLAN_ABSENT_PLACE', { participant: 4, tour: 2 }],
      // Le placement d'un absent se refuse là où il se lit, avant qu'un
      // doublon ne se voie.
      ['5 assise deux fois au tour 1', variante((plan) => plan.tours[0][0].push(5, 5)), 'PLAN_ABSENT_PLACE', { participant: 5, tour: 1 }],
      // Une présente omise reste refusée.
      ['3 omise au tour 2', variante((plan) => plan.tours[1][1].shift()), 'PLAN_NON_ASSIS', { participant: 3, tour: 2 }],
    ]), []);
    assert.deepEqual(indexerPlan(instance, PLAN), Int32Array.from(TABLE_DE));
  });

  test('indexerPlan ∘ planDepuisIndex est l’identité sur chaque plan indexé à absents', () => {
    const instance = instanceAbsences();
    const { N, R, T, present } = instance;
    // Chaque case de présence prend une valeur de RESERVE à T − 1 ; une case
    // d'absence reste RESERVE.
    const presentes = [];
    for (let i = 0; i < N * R; i += 1) if (present[i] === 1) presentes.push(i);
    const valeurs = T + 1;
    const ecarts = [];
    let examines = 0;
    for (let rang = 0; rang < valeurs ** presentes.length; rang += 1) {
      const tableDe = new Int32Array(N * R).fill(RESERVE);
      let reste = rang;
      for (const i of presentes) {
        tableDe[i] = (reste % valeurs) - 1;
        reste = Math.floor(reste / valeurs);
      }
      const retour = indexerPlan(instance, planDepuisIndex(instance, tableDe));
      if (!retour.every((t, i) => t === tableDe[i])) ecarts.push(`${[...tableDe]} → ${[...retour]}`);
      examines += 1;
    }
    assert.equal(examines, 3 ** 8);
    assert.deepEqual(ecarts, []);
  });

  test('exigerPlanIndexe refuse un absent à une table : RangeError qui nomme le participant, le tour et la table, première case fautive', () => {
    const instance = instanceAbsences();
    const avec = (fautes) => {
      const tableDe = [...TABLE_DE];
      for (const [i, valeur] of fautes) tableDe[i] = valeur;
      return tableDe;
    };
    const cas = [
      ['5 à la table 0 au tour 1', avec([[8, 0]]), 'plan indexé : participant 5, absent au tour 1, à la table 0'],
      ['4 à la table 1 au tour 2', avec([[7, 1]]), 'plan indexé : participant 4, absent au tour 2, à la table 1'],
      // Une case hors forme qui précède l'absent est nommée d'abord, et
      // l'inverse.
      ['une case hors forme avant', avec([[8, 0], [5, 7]]), 'plan indexé : participant 3, tour 2, index de table 7 hors de −1..1'],
      ['un absent avant', avec([[7, 0], [9, 7]]), 'plan indexé : participant 4, absent au tour 2, à la table 0'],
    ];
    const appelants = [
      ['exigerPlanIndexe', (tableDe) => exigerPlanIndexe(instance, tableDe)],
      ['planDepuisIndex', (tableDe) => planDepuisIndex(instance, tableDe)],
      ['mesurer', (tableDe) => mesurer(instance, tableDe)],
      ['occupations', (tableDe) => occupations(instance, tableDe)],
      ['plafondsRealises', (tableDe) => plafondsRealises(instance, tableDe)],
      ['diversiteAnimateurs', (tableDe) => diversiteAnimateurs(instance, tableDe)],
    ];
    const ecarts = [];
    for (const [libelle, tableDe, message] of cas) {
      for (const [nom, appeler] of appelants) {
        try {
          appeler(tableDe);
          ecarts.push(`${nom}, ${libelle} : aucun refus`);
        } catch (erreur) {
          const recue = `${erreur?.name} : ${erreur?.message}`;
          if (recue !== `RangeError : ${message}`) ecarts.push(`${nom}, ${libelle} : « ${recue} »`);
        }
      }
    }
    assert.deepEqual(ecarts, []);
    assert.equal(exigerPlanIndexe(instance, TABLE_DE), undefined);
  });

  test('exigerPlanIndexe lit le masque dès une seule absence : l’absente à une table lève RangeError', () => {
    // Trois personnes, deux tours, deux tables de 2 : 2 n'est absente qu'au
    // tour 2, la seule absence de l'instance.
    const instance = normaliser(configuration({
      participants: [...personnes([1, 3]), presente(2, [1])],
      tables: tablesDe([12, 11], 2),
      tours: 2,
    }));
    assert.equal(instance.absences, 1);
    // Rangées p × R + r, ids 1 à 3 : 1 et 2 à 12, 3 à 11, aux deux tours.
    const tableDe = [0, 0, 0, 0, 1, 1];
    assert.throws(() => exigerPlanIndexe(instance, tableDe), (erreur) => {
      assert.ok(erreur instanceof RangeError, `${erreur?.name} au lieu de RangeError`);
      assert.equal(erreur.message, 'plan indexé : participant 2, absent au tour 2, à la table 0');
      return true;
    });
    tableDe[3] = RESERVE;
    assert.equal(exigerPlanIndexe(instance, tableDe), undefined);
  });
});
