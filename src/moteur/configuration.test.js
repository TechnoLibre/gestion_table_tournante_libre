// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

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
  planDepuisIndex,
  replierParPopulation,
} from './configuration.js';
import { CRITERES, PRIORITES_PAR_DEFAUT, verifierPriorites } from './criteres.js';
import { mesurer } from './indicateurs.js';
import { plafondsRealises } from './plafond.js';

const { MOBILE, PARTIELLEMENT_FIXE, ANCRE } = STATUT;

const SANS_CONTRAINTE = {
  separerAppartenances: false,
  nouveauxVoisins: false,
  nouvelleTable: false,
  varierAppartenances: false,
};

// Entiers de debut à fin, inclus.
const suite = (debut, fin) => Array.from({ length: fin - debut + 1 }, (_, i) => debut + i);

// Participants des identifiants donnés, sans appartenance.
const personnes = (ids) => ids.map((id) => ({ id, nom: `P${id}`, appartenance: null }));
const exclu = (id) => ({ id, nom: `P${id}`, appartenance: null, exclu: true });

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
  test('STATUT, LIBRE, RESERVE et SANS_GROUPE valent ce que types.js écrit, et STATUT ne se modifie pas', () => {
    // Seule épreuve qui écrit ces valeurs en clair : les autres les
    // importent. LIBRE et RESERVE sont égales : une rangée de instance.fixe se
    // lit comme le plan qui laisse en réserve chaque tour libre.
    assert.deepEqual(STATUT, { MOBILE: 0, PARTIELLEMENT_FIXE: 1, ANCRE: 2 });
    assert.ok(Object.isFrozen(STATUT));
    assert.deepEqual([LIBRE, RESERVE, SANS_GROUPE], [-1, -1, -1]);
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

describe('normaliser : appartenances', () => {
  test('les groupes se numérotent par première apparition en ids croissants, quel que soit l’ordre fourni', () => {
    const fournis = [
      { id: 9, nom: 'P9', appartenance: 'Y' },
      { id: 2, nom: 'P2', appartenance: 'Z' },
      { id: 5, nom: 'P5', appartenance: 'X' },
      { id: 7, nom: 'P7', appartenance: null },
      { id: 3, nom: 'P3', appartenance: 'W', exclu: true },
      { id: 4, nom: 'P4', appartenance: 'Z' },
      { id: 1, nom: 'P1', appartenance: 'Y' },
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
    // La chaîne vide est une appartenance comme une autre : seul null marque
    // l'absence d'appartenance.
    const participants = [
      { id: 1, nom: 'P1', appartenance: 'X' },
      { id: 2, nom: 'P2', appartenance: 'x' },
      { id: 3, nom: 'P3', appartenance: 'X ' },
      { id: 4, nom: 'P4', appartenance: 'X' },
      { id: 5, nom: 'P5', appartenance: '' },
      { id: 6, nom: 'P6', appartenance: null },
      { id: 7, nom: 'P7', appartenance: '' },
    ];
    const instance = normaliser(configuration({ participants, tables: tablesDe([11], 8), tours: 1 }));
    assert.deepEqual(instance.groupes, ['X', 'x', 'X ', '']);
    assert.deepEqual(instance.groupe, Int32Array.from([0, 1, 2, 0, 3, SANS_GROUPE, 3]));
  });
});

describe('normaliser : la configuration reçue', () => {
  test('normaliser ne modifie pas la configuration reçue', () => {
    const recue = geler(configuration({
      participants: [...personnes([9, 2]), exclu(5), { id: 4, nom: 'P4', appartenance: 'X' }],
      tables: tablesDe([30, 10], 4),
      tours: 2,
      reservations: [tous(9, 30), auTour(2, 10, 2)],
    }));
    const instance = normaliser(recue);
    assert.deepEqual(instance.ids, [2, 4, 9]);
    assert.deepEqual(recue.participants.map((participant) => participant.id), [9, 2, 5, 4]);
  });

  test('l’instance copie les contraintes au lieu de les partager', () => {
    const contraintes = { ...SANS_CONTRAINTE, separerAppartenances: true };
    const instance = normaliser(configuration({
      participants: personnes([1, 2]),
      tables: tablesDe([11], 2),
      tours: 1,
      contraintes,
    }));
    contraintes.separerAppartenances = false;
    assert.deepEqual(instance.contraintes, { ...SANS_CONTRAINTE, separerAppartenances: true });
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
      ['appartenance absente', { participants: [{ id: 1, nom: 'P1' }] }],
      ['appartenance numérique', { participants: [{ id: 1, nom: 'P1', appartenance: 7 }] }],
      ...['oui', '', 0, null].map((valeur) => [
        `exclusion ${libelleDe(valeur)}`,
        { participants: [{ id: 1, nom: 'P1', appartenance: null, exclu: valeur }] },
      ]),
      ['portée inconnue', { reservations: [{ participant: 1, table: 11, portee: 'chaque' }] }],
      ['contraintes absentes', { contraintes: undefined }],
      ['une contrainte absente', {
        contraintes: { separerAppartenances: true, nouveauxVoisins: false, nouvelleTable: false },
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
  // guillemets. Deux cases fautives : la première dans l'ordre des cases est
  // nommée, la case 1 (3 au tour 2) avant la case 2 (6 au tour 1).
  const FAUTIFS = [
    ['longueur N × R − 1', TABLE_DE.slice(1), 'plan indexé de 7 cases, N × R = 8 attendues'],
    ['longueur N × R + 1', [...TABLE_DE, RESERVE], 'plan indexé de 9 cases, N × R = 8 attendues'],
    ['longueur N × T', Array(12).fill(RESERVE), 'plan indexé de 12 cases, N × R = 8 attendues'],
    ['index de table T', avecFautes([[0, 3]]), 'participant 3, tour 1, index de table 3'],
    ['index −2', avecFautes([[3, -2]]), 'participant 6, tour 2, index de table -2'],
    ['index non entier', avecFautes([[5, 0.5]]), 'participant 8, tour 2, index de table 0.5'],
    ['index null', avecFautes([[4, null]]), 'participant 8, tour 1, index de table null'],
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
        { id: 2, nom: 'P2', appartenance: null, anime: [1, 2] },
        { id: 4, nom: 'P4', appartenance: 'X', etiquettes: ['finance'] },
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
  appartenance: null,
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
      ['un tour non entier', avecAnime(2, [1.5]), 'ANIMATION_NON_FIXEE', { participant: 2, tour: 1.5 }],
      ['un tour en texte', avecAnime(2, ['1']), 'ANIMATION_NON_FIXEE', { participant: 2, tour: '1' }],
      ['un tour où la personne est libre', avecAnime(1, [1]), 'ANIMATION_NON_FIXEE', { participant: 1, tour: 1 }],
    ]), []);
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
