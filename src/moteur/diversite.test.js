// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de la diversité par animateur (§ 4.5, § 5.4, § 12.13) : les
// personnes, organisations et étiquettes distinctes que chaque animateur
// rencontre en animant, sur la soirée et à chacun de ses tours animés, le
// tri du moins varié au plus varié, les colonnes et les trois nombres de
// chaque colonne. Les cas comptés à la main nomment chacun la règle qu'ils
// éprouvent ; une lecture directe de la configuration, qui n'emprunte rien
// au module, les recoupe sur des plans quelconques, réservations déplacées
// et tables surchargées comprises. Identifiants et index diffèrent, et les
// tables arrivent hors de l'ordre de leurs identifiants.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { RESERVE, normaliser } from './configuration.js';
import { diversiteAnimateurs } from './diversite.js';
import { parcourirTours } from './indicateurs.js';

const AUBIER = 'Coopérative Aubier';
const RESSAC = 'Atelier Ressac';

const SANS_CONTRAINTE = {
  separerOrganisations: false,
  nouveauxVoisins: false,
  nouvelleTable: false,
  varierOrganisations: false,
};

// Participant présent : son organisation, ses étiquettes et les tours où il
// anime, chacun facultatif.
const personne = (id, organisation = null, etiquettes, anime) => ({
  id,
  nom: `P${id}`,
  organisation,
  ...(etiquettes === undefined ? {} : { etiquettes }),
  ...(anime === undefined ? {} : { anime }),
});
const tous = (participant, table) => ({ participant, table, portee: 'tous' });
const auTour = (participant, table, tour) => ({ participant, table, portee: 'tour', tour });

const configuration = ({ participants, tables, tours, reservations = [] }) => ({
  participants,
  tables,
  tours,
  reservations,
  contraintes: SANS_CONTRAINTE,
});

// Plan indexé d'un plan écrit par identifiants : tours[r] associe à chaque
// identifiant de table la liste des identifiants qui s'y assoient ; tout
// présent absent d'un tour va en réserve. Aucune réservation ni capacité
// n'est examinée : le plan peut être ajusté.
function planDe(instance, tours) {
  const { N, R, indexDe, indexTableDe } = instance;
  const tableDe = new Int32Array(N * R).fill(RESERVE);
  tours.forEach((tables, r) => {
    for (const [table, ids] of tables) {
      for (const id of ids) tableDe[indexDe.get(id) * R + r] = indexTableDe.get(table);
    }
  });
  return tableDe;
}

// Lecture directe des § 4.5 et § 5.4 sur la configuration, sans rien du
// module éprouvé : f anime au tour r à la table que sa réservation lui fixe ;
// une personne compte pour f quand elle est assise à cette table, f aussi,
// qu'elle n'est pas f, et qu'elle peut l'occuper — sa table fixée, sinon une
// table dont les réservations des présents laissent un siège. Les lignes
// suivent les animateurs par index croissant.
function lectureDirecte(config, instance, tableDe) {
  const presents = config.participants.filter((p) => p.exclu !== true);
  const presentsParId = new Set(presents.map(({ id }) => id));
  const reservations = config.reservations.filter((res) => presentsParId.has(res.participant));
  const couvre = (res, tour) => res.portee === 'tous' || res.tour === tour;
  const fixee = (id, tour) => reservations.find((res) => res.participant === id && couvre(res, tour))?.table;
  const capacite = (table) => config.tables.find(({ id }) => id === table).capacite;
  const libre = (table, tour) =>
    reservations.filter((res) => res.table === table && couvre(res, tour)).length < capacite(table);
  const peutOccuper = (id, table, tour) => {
    const sienne = fixee(id, tour);
    return sienne === undefined ? libre(table, tour) : sienne === table;
  };
  const assiseA = (id, tour) => {
    const t = tableDe[instance.indexDe.get(id) * instance.R + tour - 1];
    return t === RESERVE ? null : instance.idsTables[t];
  };
  const avecEtiquettes = presents.some(({ etiquettes = [] }) => etiquettes.length > 0);
  const compter = (rencontrees) => ({
    personnes: rencontrees.length,
    organisations: new Set(rencontrees.filter((q) => q.organisation !== null).map((q) => q.organisation)).size,
    etiquettes: avecEtiquettes ? new Set(rencontrees.flatMap(({ etiquettes = [] }) => etiquettes)).size : null,
  });
  return presents
    .filter(({ anime = [] }) => anime.length > 0)
    .sort((a, b) => a.id - b.id)
    .map((f) => {
      const parTour = f.anime.map((tour) => {
        const table = fixee(f.id, tour);
        const rencontrees = assiseA(f.id, tour) !== table ? [] : presents.filter(
          (q) => q.id !== f.id && assiseA(q.id, tour) === table && peutOccuper(q.id, table, tour),
        );
        return { tour: tour - 1, table, rencontrees };
      });
      const soiree = [...new Set(parTour.flatMap(({ rencontrees }) => rencontrees))];
      return {
        p: instance.indexDe.get(f.id),
        toursAnimes: f.anime.length,
        ...compter(soiree),
        parTour: parTour.map(({ tour, table, rencontrees }) => ({
          tour,
          t: instance.indexTableDe.get(table),
          ...compter(rencontrees),
        })),
      };
    });
}

// L'ordre du § 12.13 (D38), écrit à part : organisations, puis étiquettes,
// puis personnes croissantes, puis l'index ; sans la colonne des
// organisations, les étiquettes d'abord, puis personnes et index.
function dansLOrdre(lignes, avecOrganisations) {
  const cle = (l) => [...(avecOrganisations ? [l.organisations] : []), l.etiquettes ?? 0, l.personnes, l.p];
  for (let i = 1; i < lignes.length; i += 1) {
    const [a, b] = [cle(lignes[i - 1]), cle(lignes[i])];
    const k = a.findIndex((v, j) => v !== b[j]);
    if (k === -1 || a[k] > b[k]) return false;
  }
  return true;
}

// Plan quelconque, qu'une graine détermine : chaque case vaut une table ou la
// réserve, sans égard aux réservations ni aux capacités.
function planQuelconque(instance, graine) {
  const { N, T, R } = instance;
  const tableDe = new Int32Array(N * R);
  let etat = graine >>> 0;
  for (let i = 0; i < N * R; i += 1) {
    etat = (Math.imul(etat, 1_103_515_245) + 12_345) >>> 0;
    tableDe[i] = (etat >>> 16) % (T + 1) - 1;
  }
  return tableDe;
}

// Tables 21 (index 0) et 22 (index 1), quatre places, deux tours. 6 anime
// 21 aux deux tours ; 7 anime 21 au tour 1, avec 6 ; 8 anime 22 au tour 1 ;
// 9, exclu, animerait 22 au tour 2 ; 5 est réservé à 22 au tour 2.
const CAS = configuration({
  participants: [
    personne(6, AUBIER, undefined, [1, 2]),
    personne(1, AUBIER, ['finance']),
    personne(2, RESSAC, ['finance', 'Montréal']),
    personne(3, AUBIER),
    personne(4, null, ['bénévole']),
    personne(5, RESSAC),
    personne(7, null, ['finance'], [1]),
    personne(8, RESSAC, undefined, [1]),
    { ...personne(9, AUBIER, ['ressources humaines'], [2]), exclu: true },
  ],
  tables: [{ id: 22, numero: 2, capacite: 4 }, { id: 21, numero: 1, capacite: 4 }],
  tours: 2,
  reservations: [tous(6, 21), auTour(7, 21, 1), auTour(8, 22, 1), auTour(5, 22, 2), tous(9, 22)],
});
// Tour 1 : 6, 7, 1, 2 à 21 ; 8, 3, 4, 5 à 22. Tour 2 : 6, 5, 3, 8 à 21,
// où 5 s'assied hors de sa réservation ; 1, 2, 4, 7 à 22. Le plan honore
// toutes les autres réservations.
const PLAN_CAS = [
  [[21, [6, 7, 1, 2]], [22, [8, 3, 4, 5]]],
  [[21, [6, 5, 3, 8]], [22, [1, 2, 4, 7]]],
];

describe('diversiteAnimateurs : ce que chaque animateur rencontre en animant (§ 4.5, § 5.4, B4)', () => {
  const instance = normaliser(CAS);
  const diversite = diversiteAnimateurs(instance, planDe(instance, PLAN_CAS));
  const ligneDe = (id) => diversite.lignes.find(({ p }) => p === instance.indexDe.get(id));

  test('compté à la main : la soirée réunit les tours animés, chaque tour garde ses propres comptes', () => {
    // Index : 1 → 0, …, 8 → 7 ; table 21 → 1, 22 → 0.
    // 6, au tour 1 à 21 : 7, 1, 2 — deux organisations, finance et Montréal ;
    // au tour 2 : 3 et 8, 5 n'y pouvant s'asseoir — Aubier et Ressac, aucune
    // étiquette. La soirée : 7, 1, 2, 3, 8.
    assert.deepEqual(ligneDe(6), {
      p: 5,
      toursAnimes: 2,
      personnes: 5,
      organisations: 2,
      etiquettes: 2,
      parTour: [
        { tour: 0, t: 1, personnes: 3, organisations: 2, etiquettes: 2 },
        { tour: 1, t: 1, personnes: 2, organisations: 2, etiquettes: 0 },
      ],
    });
  });

  test('un animateur d’un seul tour a une seule entrée par tour, égale à sa soirée', () => {
    const { parTour, toursAnimes, personnes, organisations, etiquettes } = ligneDe(7);
    assert.equal(toursAnimes, 1);
    assert.deepEqual(parTour, [{ tour: 0, t: 1, personnes, organisations, etiquettes }]);
    assert.deepEqual([personnes, organisations, etiquettes], [3, 2, 2]);
  });

  test('deux animateurs d’une même table au même tour se comptent l’un l’autre, chacun hors de ses propres rencontres', () => {
    // 6 compte 7 au tour 1, 7 compte 6 ; ni l'un ni l'autre ne se compte.
    assert.equal(ligneDe(7).personnes, 3);
    assert.equal(ligneDe(6).parTour[0].personnes, 3);
  });

  test('une personne assise à la table d’un animateur à un tour où il n’anime pas ne compte pas pour lui', () => {
    // 8 n'anime qu'au tour 1 : au tour 2, ni 6 ni 5 ni 3 ne le comptent ; 7
    // n'anime pas au tour 2, où 1, 2 et 4 partagent sa table.
    assert.deepEqual(ligneDe(8).parTour, [{ tour: 0, t: 0, personnes: 3, organisations: 2, etiquettes: 1 }]);
    assert.equal(ligneDe(8).personnes, 3);
  });

  test('une personne assise à une table qu’elle ne peut occuper, sur un plan ajusté, ne compte pas', () => {
    // 5, réservé à 22 au tour 2, est assis à 21 : 6 ne le compte pas.
    assert.equal(ligneDe(6).parTour[1].personnes, 2);
    // Une table sans siège libre à ce tour : 11 et 12 y sont réservés, 13,
    // libre, s'y ajoute sur un plan ajusté.
    const plein = configuration({
      participants: [personne(11, AUBIER, undefined, [1]), personne(12, RESSAC), personne(13, RESSAC, ['finance'])],
      tables: [{ id: 31, numero: 1, capacite: 2 }, { id: 32, numero: 2, capacite: 2 }],
      tours: 1,
      reservations: [tous(11, 31), tous(12, 31)],
    });
    const autre = normaliser(plein);
    const { lignes } = diversiteAnimateurs(autre, planDe(autre, [[[31, [11, 12, 13]]]]));
    assert.deepEqual(lignes[0].parTour, [{ tour: 0, t: 0, personnes: 1, organisations: 1, etiquettes: 0 }]);
  });

  test('une étiquette portée par trois personnes de la table se compte une fois', () => {
    // 6, au tour 1 : 7, 1 et 2 portent finance, 2 porte aussi Montréal.
    assert.equal(ligneDe(6).parTour[0].etiquettes, 2);
  });

  test('un animateur exclu est absent ; les lignes vont du moins varié au plus varié', () => {
    // Organisations égales (2) ; étiquettes 1 pour 8, 2 pour 7 et 6 ; puis 3
    // personnes pour 7, 5 pour 6.
    assert.deepEqual(diversite.lignes.map(({ p }) => instance.ids[p]), [8, 7, 6]);
    assert.deepEqual(diversite.colonnes, { organisations: true, etiquettes: true });
    assert.deepEqual(diversite.equite, {
      organisations: { moins: 2, plus: 2, auMinimum: 3 },
      etiquettes: { moins: 1, plus: 2, auMinimum: 1 },
    });
  });

  test('le tri et les trois nombres ne lisent que la soirée', () => {
    // Au seul tour 2, 6 n'aurait aucune étiquette et passerait en tête ; au
    // seul tour 1, il précéderait 7 à comptes égaux.
    assert.deepEqual(diversite.lignes.map(({ p }) => instance.ids[p]), [8, 7, 6]);
    assert.equal(diversite.equite.etiquettes.moins, 1);
  });

  test('le détail ne rend que des listes et des objets simples', () => {
    assert.ok(Array.isArray(diversite.lignes));
    for (const ligne of diversite.lignes) {
      assert.ok(Array.isArray(ligne.parTour));
      assert.equal(Object.getPrototypeOf(ligne), Object.prototype);
    }
  });

  test('un plan hors de la forme de l’instance lève RangeError', () => {
    assert.throws(() => diversiteAnimateurs(instance, new Int32Array(3)), RangeError);
  });
});

describe('diversiteAnimateurs : le tri du moins varié au plus varié (§ 12.13, D38, B22)', () => {
  // Tables 41 à 44, trois places — quatre pour larges —, un tour ; un
  // animateur réservé à chacune.
  const tables = [41, 42, 43, 44].map((id, i) => ({ id, numero: i + 1, capacite: 3 }));
  const larges = tables.map((table) => ({ ...table, capacite: 4 }));
  const reservations = [tous(10, 41), tous(20, 42), tous(30, 43), tous(40, 44)];

  test('les organisations d’abord, avant les personnes ; à égalité de tout, l’index', () => {
    // 10 rencontre trois personnes d'une organisation ; 20, deux personnes
    // de deux organisations ; 30 et 40, une personne chacun.
    const config = configuration({
      participants: [
        personne(10, null, undefined, [1]), personne(20, null, undefined, [1]),
        personne(30, null, undefined, [1]), personne(40, null, undefined, [1]),
        personne(1, AUBIER), personne(2, AUBIER), personne(3, AUBIER),
        personne(4, AUBIER), personne(5, RESSAC), personne(6, AUBIER), personne(7, RESSAC),
      ],
      tables: larges,
      tours: 1,
      reservations,
    });
    const instance = normaliser(config);
    const plan = planDe(instance, [[[41, [10, 1, 2, 3]], [42, [20, 4, 5]], [43, [30, 6]], [44, [40, 7]]]]);
    const { lignes, colonnes, equite } = diversiteAnimateurs(instance, plan);
    // Une organisation pour 30, 40 (une personne) et 10 (trois), deux pour
    // 20 : par les personnes d'abord, 20 précéderait 10. 30 et 40, égaux en
    // tout, se rangent par l'index.
    assert.deepEqual(lignes.map(({ p }) => instance.ids[p]), [30, 40, 10, 20]);
    assert.deepEqual(colonnes, { organisations: true, etiquettes: false });
    // Sans étiquette portée : la colonne manque, chaque compte vaut null.
    assert.ok(lignes.every(({ etiquettes, parTour }) => etiquettes === null && parTour.every((tour) => tour.etiquettes === null)));
    assert.deepEqual(equite, { organisations: { moins: 1, plus: 2, auMinimum: 3 }, etiquettes: null });
  });

  test('une seule organisation et des étiquettes : la colonne des étiquettes seule, qui ordonne avant les personnes', () => {
    // 10 : 1, Aubier, finance — 1 organisation, 1 étiquette, 1 personne.
    // 20 : 2 et 3 sans organisation, tous deux finance — 0, 1, 2.
    // 30 : 4, Aubier, finance et Montréal — 1, 2, 1. 40 : personne.
    const config = configuration({
      participants: [
        personne(10, null, undefined, [1]), personne(20, null, undefined, [1]),
        personne(30, null, undefined, [1]), personne(40, null, undefined, [1]),
        personne(1, AUBIER, ['finance']), personne(2, null, ['finance']),
        personne(3, null, ['finance']), personne(4, AUBIER, ['finance', 'Montréal']),
      ],
      tables,
      tours: 1,
      reservations,
    });
    const instance = normaliser(config);
    const plan = planDe(instance, [[[41, [10, 1]], [42, [20, 2, 3]], [43, [30, 4]], [44, [40]]]]);
    const { lignes, colonnes, equite } = diversiteAnimateurs(instance, plan);
    assert.deepEqual(colonnes, { organisations: false, etiquettes: true });
    // Étiquettes 0 pour 40 ; 1 pour 10 (une personne) et 20 (deux) ; 2 pour
    // 30. Les organisations, qu'aucune colonne ne montre, ne départagent pas
    // 10 et 20 : 20 n'en a aucune et viendrait sinon en tête des deux.
    assert.deepEqual(lignes.map(({ p }) => instance.ids[p]), [40, 10, 20, 30]);
    assert.deepEqual(lignes.map(({ organisations }) => organisations), [0, 1, 0, 1]);
    assert.deepEqual(equite, { organisations: null, etiquettes: { moins: 0, plus: 2, auMinimum: 1 } });
  });

  test('les trois nombres de chaque colonne se lisent sur toutes les lignes, non sur la première du tri', () => {
    // 10 rencontre 1, Aubier, finance et Montréal : 1 organisation, 2
    // étiquettes. 20 rencontre 2, Aubier, et 3, Ressac, sans étiquette : 2
    // organisations, 0 étiquette. Le tri met 10 en tête, et le minimum des
    // étiquettes, 0, est à la seconde ligne.
    const config = configuration({
      participants: [
        personne(10, null, undefined, [1]), personne(20, null, undefined, [1]),
        personne(1, AUBIER, ['finance', 'Montréal']), personne(2, AUBIER), personne(3, RESSAC),
      ],
      tables,
      tours: 1,
      reservations: reservations.slice(0, 2),
    });
    const instance = normaliser(config);
    const { lignes, colonnes, equite } = diversiteAnimateurs(instance, planDe(instance, [[[41, [10, 1]], [42, [20, 2, 3]]]]));
    assert.deepEqual(colonnes, { organisations: true, etiquettes: true });
    assert.deepEqual(lignes.map(({ p, organisations, etiquettes }) => [instance.ids[p], organisations, etiquettes]), [[10, 1, 2], [20, 2, 0]]);
    assert.deepEqual(equite, {
      organisations: { moins: 1, plus: 2, auMinimum: 1 },
      etiquettes: { moins: 0, plus: 2, auMinimum: 1 },
    });
  });

  test('ni étiquette ni plus d’une organisation : aucune colonne, les comptes de personnes restent', () => {
    const config = configuration({
      participants: [personne(10, null, undefined, [1]), personne(20, null, undefined, [1]), personne(1), personne(2), personne(3)],
      tables,
      tours: 1,
      reservations: reservations.slice(0, 2),
    });
    const instance = normaliser(config);
    const { lignes, colonnes, equite } = diversiteAnimateurs(instance, planDe(instance, [[[41, [10, 1, 2]], [42, [20, 3]]]]));
    assert.deepEqual(colonnes, { organisations: false, etiquettes: false });
    assert.deepEqual(lignes.map(({ p, personnes }) => [instance.ids[p], personnes]), [[20, 1], [10, 2]]);
    assert.deepEqual(equite, { organisations: null, etiquettes: null });
  });

  test('sans animateur, aucune ligne et aucun des trois nombres', () => {
    const config = configuration({
      participants: [personne(1, AUBIER, ['finance']), personne(2, RESSAC), { ...personne(3, AUBIER, undefined, [1]), exclu: true }],
      tables: tables.slice(0, 1),
      tours: 2,
      reservations: [tous(3, 41)],
    });
    const instance = normaliser(config);
    const diversite = diversiteAnimateurs(instance, planDe(instance, [[[41, [1, 2]]], [[41, [1, 2]]]]));
    assert.deepEqual(diversite, {
      colonnes: { organisations: true, etiquettes: true },
      lignes: [],
      equite: { organisations: null, etiquettes: null },
    });
  });
});

describe('diversiteAnimateurs : recoupements sur des plans quelconques', () => {
  // Trois tables, trois tours, des animateurs d'un, deux et trois tours, deux
  // qui animent une même table au même tour, un exclu, des réservations de
  // personnes qui n'animent pas. 5 anime 52 (index 2) au tour 1 puis 53
  // (index 0) au tour 3 : ses tours animés, rangés par table, sortiraient
  // décroissants. Au tour 2, 3, 4 et 9 remplissent les trois places de 52,
  // que 3 et 4 animent : une personne libre qu'un plan y assied ne compte
  // pour aucun des deux.
  const config = configuration({
    participants: [
      personne(2, AUBIER, ['finance'], [1, 2, 3]),
      personne(3, RESSAC, undefined, [2]),
      personne(4, null, ['Montréal', 'bénévole'], [2]),
      personne(5, AUBIER, ['bénévole'], [1, 3]),
      personne(6, RESSAC, ['finance']),
      personne(7, null),
      personne(8, AUBIER, ['ressources humaines', 'finance']),
      personne(9, RESSAC, ['Montréal']),
      personne(10, RESSAC),
      personne(11, null, ['bénévole']),
      { ...personne(12, AUBIER, ['finance'], [1]), exclu: true },
    ],
    tables: [{ id: 53, numero: 3, capacite: 3 }, { id: 51, numero: 1, capacite: 4 }, { id: 52, numero: 2, capacite: 3 }],
    tours: 3,
    reservations: [
      tous(2, 51), auTour(3, 52, 2), auTour(4, 52, 2), auTour(9, 52, 2), auTour(5, 52, 1), auTour(5, 53, 3),
      auTour(6, 53, 1), auTour(7, 53, 1), auTour(8, 51, 2), tous(12, 52),
    ],
  });
  const instance = normaliser(config);
  const GRAINES = Array.from({ length: 40 }, (_, i) => i + 1);

  test('chaque ligne égale la lecture directe de la configuration', () => {
    const ecarts = [];
    for (const graine of GRAINES) {
      const plan = planQuelconque(instance, graine);
      const lues = [...diversiteAnimateurs(instance, plan).lignes].sort((a, b) => a.p - b.p);
      try {
        assert.deepEqual(lues, lectureDirecte(config, instance, plan));
      } catch {
        ecarts.push(graine);
      }
    }
    assert.deepEqual(ecarts, []);
  });

  test('les lignes suivent l’ordre du § 12.13 et les trois nombres lisent la soirée', () => {
    for (const graine of GRAINES) {
      const { lignes, equite } = diversiteAnimateurs(instance, planQuelconque(instance, graine));
      assert.ok(dansLOrdre(lignes, true), `graine ${graine}`);
      for (const nom of ['organisations', 'etiquettes']) {
        const valeurs = lignes.map((ligne) => ligne[nom]);
        const moins = Math.min(...valeurs);
        assert.deepEqual(equite[nom], {
          moins,
          plus: Math.max(...valeurs),
          auMinimum: valeurs.filter((v) => v === moins).length,
        }, `graine ${graine}, ${nom}`);
      }
    }
  });

  test('chaque tour reste sous la soirée, et la soirée ne dépasse pas la somme de ses tours', () => {
    for (const graine of GRAINES) {
      const plan = planQuelconque(instance, graine);
      const directes = lectureDirecte(config, instance, plan);
      const { lignes } = diversiteAnimateurs(instance, plan);
      assert.deepEqual(lignes.map(({ p }) => instance.ids[p]).sort((a, b) => a - b), [2, 3, 4, 5]);
      for (const ligne of lignes) {
        assert.equal(ligne.parTour.length, ligne.toursAnimes);
        assert.deepEqual(ligne.parTour.map(({ tour }) => tour), [...ligne.parTour.map(({ tour }) => tour)].sort((a, b) => a - b));
        for (const tour of ligne.parTour) {
          for (const nom of ['personnes', 'organisations', 'etiquettes']) assert.ok(tour[nom] <= ligne[nom], `graine ${graine}`);
        }
        const directe = directes.find(({ p }) => p === ligne.p);
        assert.ok(ligne.personnes <= ligne.parTour.reduce((somme, tour) => somme + tour.personnes, 0));
        assert.equal(ligne.personnes, directe.personnes);
      }
    }
  });

  test('les personnes rencontrées en animant, sommées sur les animateurs, égalent les animateurs rencontrés de parcourirTours', () => {
    for (const graine of GRAINES) {
      const plan = planQuelconque(instance, graine);
      const sommeU = diversiteAnimateurs(instance, plan).lignes.reduce((somme, { personnes }) => somme + personnes, 0);
      const sommeM = parcourirTours(instance, plan).rencontresAnimateurs.reduce((somme, m) => somme + m, 0);
      assert.equal(sommeU, sommeM, `graine ${graine}`);
    }
  });

  test('un animateur absent de sa table au tour qu’il anime n’y rencontre personne, et son tour reste écrit', () => {
    const plan = planQuelconque(instance, 1);
    const p = instance.indexDe.get(2);
    // 2 anime 51 (index 1) aux trois tours ; on l'assied à 53 au tour 1.
    plan[p * instance.R] = 0;
    const ligne = diversiteAnimateurs(instance, plan).lignes.find((l) => l.p === p);
    assert.deepEqual(ligne.parTour[0], { tour: 0, t: 1, personnes: 0, organisations: 0, etiquettes: 0 });
  });
});
