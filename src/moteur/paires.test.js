// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves des paires répétées, de la ligne d'une personne et de la matrice
// des rencontres (§ 5.4, § 12.5). Chaque plan s'écrit par identifiants, une
// liste par table, et passe par normaliser et indexerPlan comme un plan
// enregistré. Les valeurs attendues s'écrivent en clair, comptées à la main
// dans le commentaire qui les précède, ou sortent d'une lecture directe du
// plan par identifiants, écrite ici sans rien du moteur : chaque paire, ses
// tables tour par tour, et la réservation des deux membres à chacune.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { indexerPlan, normaliser } from './configuration.js';
import { mesurer, parcourirTours } from './indicateurs.js';
import { matriceRencontres, pairesRepetees, rencontresDe } from './paires.js';

const SANS_CONTRAINTE = Object.freeze({
  separerAppartenances: false,
  nouveauxVoisins: false,
  nouvelleTable: false,
  varierAppartenances: false,
});

// Noms inventés : leur ordre alphabétique est l'inverse de celui des
// identifiants, qui fait l'ordre des index. Un tri sur les noms rendrait
// les paires à rebours.
const NOMS = Object.freeze([
  'Théo Pervenche',
  'Ondine Lacasse',
  'Maëlle Quenouille',
  'Iris Ombrelle',
  'Basile Tourteau',
]);

const tous = (participant, table) => ({ participant, table, portee: 'tous' });
const auTour = (participant, table, tour) => ({ participant, table, portee: 'tour', tour });

/**
 * Instance et plan indexé d'un plan écrit par identifiants. Les
 * participants portent les identifiants 1..N, sauf ceux d'exclus, qui sont
 * exclus et n'entrent dans aucune liste ; les tables portent 1..T, toutes de
 * la capacité donnée ; tours[r][i] liste les participants assis à la table
 * i + 1 au tour r + 1, reserves[r] ceux qui n'y sont assis nulle part.
 */
function preparer({ N, capacite, tours, reserves = tours.map(() => []), reservations = [], exclus = [] }) {
  const participants = Array.from({ length: N }, (_, i) => ({
    id: i + 1,
    nom: NOMS[i % NOMS.length],
    appartenance: i % 2 === 0 ? 'Coopérative Aubier' : 'Atelier Ressac',
    ...(exclus.includes(i + 1) ? { exclu: true } : {}),
  }));
  const tables = tours[0].map((_, i) => ({ id: i + 1, numero: i + 1, capacite }));
  const instance = normaliser({ participants, tables, tours: tours.length, reservations, contraintes: SANS_CONTRAINTE });
  const plan = { tables: tables.map(({ id }) => id), tours, reserves };
  return { instance, tableDe: indexerPlan(instance, plan) };
}

// Vrai quand une réservation assied l'identifiant id à la table d'identifiant
// table au tour r + 1.
const reserve = (reservations, id, table, r) =>
  reservations.some(
    (res) => res.participant === id && res.table === table && (res.portee === 'tous' || res.tour === r + 1),
  );

/**
 * Lecture directe d'un plan par identifiants : chaque paire d'identifiants
 * x < y assise à la même table à un tour au moins, ses rencontres
 * [{tour, t}] dans l'ordre des tours, et vrai sous reservee quand chacune
 * a lieu à une table où les deux sont réservés ce tour-là. Les tables
 * portent l'identifiant i + 1 à l'index i.
 */
function lireDirectement({ tours, reservations = [] }) {
  const paires = new Map();
  tours.forEach((tables, r) => {
    tables.forEach((liste, t) => {
      for (const x of liste) {
        for (const y of liste) {
          if (x >= y) continue;
          const cle = `${x}-${y}`;
          if (!paires.has(cle)) paires.set(cle, { x, y, tours: [], reservee: true });
          const paire = paires.get(cle);
          paire.tours.push({ tour: r, t });
          if (!reserve(reservations, x, t + 1, r) || !reserve(reservations, y, t + 1, r)) paire.reservee = false;
        }
      }
    });
  });
  return [...paires.values()];
}

// Les paires répétées attendues, en index, rangées par fois décroissant puis
// par index, à partir de la lecture directe.
function attendues(description, instance) {
  const choisies = [];
  const imposees = [];
  for (const { x, y, tours, reservee } of lireDirectement(description)) {
    if (tours.length < 2) continue;
    const ligne = { a: instance.indexDe.get(x), b: instance.indexDe.get(y), fois: tours.length, tours };
    (reservee ? imposees : choisies).push(ligne);
  }
  const ordre = (u, v) => v.fois - u.fois || u.a - v.a || u.b - v.b;
  return { choisies: choisies.sort(ordre), imposees: imposees.sort(ordre) };
}

// Rencontres de chaque paire d'index, lues directement : comptes[a][b].
function comptesDirects(description, instance) {
  const comptes = Array.from({ length: instance.N }, () => new Array(instance.N).fill(0));
  for (const { x, y, tours } of lireDirectement(description)) {
    const a = instance.indexDe.get(x);
    const b = instance.indexDe.get(y);
    comptes[a][b] = tours.length;
    comptes[b][a] = tours.length;
  }
  return comptes;
}

// Plan de la configuration construite du § 12.5 : 12 personnes, 4 tables de
// 3, 6 tours. Chaque tour est une permutation des identifiants, tirée d'un
// générateur de Park et Miller semé par graine, découpée en tables de trois.
function planConstruit(graine) {
  let etat = graine;
  const suivant = () => {
    etat = (etat * 48271) % 2147483647;
    return etat;
  };
  return Array.from({ length: 6 }, () => {
    const ids = Array.from({ length: 12 }, (_, i) => i + 1);
    for (let i = ids.length - 1; i > 0; i -= 1) {
      const j = suivant() % (i + 1);
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return [0, 1, 2, 3].map((t) => ids.slice(3 * t, 3 * t + 3).sort((u, v) => u - v));
  });
}

// Rang de la case (i, j), i < j, d'un triangle n × n rangé ligne par ligne,
// écrit ici en clair : la ligne i s'ouvre après n − 1, n − 2, … n − i cases.
function rangCase(n, i, j) {
  let rang = 0;
  for (let ligne = 0; ligne < i; ligne += 1) rang += n - 1 - ligne;
  return rang + (j - i - 1);
}

// Réservées ensemble aux tours 1 et 2 à la table 1, Théo (1) et Ondine (2)
// sont réunis par le moteur au tour 3, à la table 2 : leur répétition est
// choisie. Maëlle (3) et Iris (4) se réunissent aux trois tours, sans
// réservation : choisie aussi.
const RESERVEES_PUIS_REUNIES = Object.freeze({
  N: 4,
  capacite: 2,
  tours: [
    [[1, 2], [3, 4]],
    [[1, 2], [3, 4]],
    [[3, 4], [1, 2]],
  ],
  reservations: [auTour(1, 1, 1), auTour(2, 1, 1), auTour(1, 1, 2), auTour(2, 1, 2)],
});

// Théo (1) et Ondine (2), ancrés à la table 1, s'y retrouvent aux trois
// tours : répétition imposée. Maëlle (3) et Iris (4) se réunissent aux tours
// 1 et 3 à la table 2 : choisie. Maëlle passe le tour 2 à la table 1.
const ANCRES_ENSEMBLE = Object.freeze({
  N: 4,
  capacite: 3,
  tours: [
    [[1, 2], [3, 4]],
    [[1, 2, 3], [4]],
    [[1, 2], [3, 4]],
  ],
  reservations: [tous(1, 1), tous(2, 1)],
});

// Cinq personnes, trois tours. Au tour 1, Iris (4) et Basile (5) occupent
// la table 1, les trois autres la table 2 ; aux tours 2 et 3, tous sont à la
// table 1. Les paires de {1, 2, 3} et la paire (4, 5) se voient trois fois,
// les six paires croisées deux fois. La première paire réunie est (4, 5),
// au tour 1, à la table 1 : un ordre de première rencontre la rangerait en
// tête.
const EGALITES = Object.freeze({
  N: 5,
  capacite: 5,
  tours: [
    [[4, 5], [1, 2, 3]],
    [[1, 2, 3, 4, 5], []],
    [[1, 2, 3, 4, 5], []],
  ],
});

// Trois paires imposées, toutes réservées ensemble à chacune de leurs
// rencontres. Au tour 1 : Maëlle (3) et Basile (5) à la table 1, Iris (4) et
// le sixième à la table 2, Théo (1) et Ondine (2), ancrés, à la table 3. Au
// tour 2, Iris rejoint Maëlle et Basile à la table 1 ; au tour 3, Maëlle et
// Iris y restent seuls. En index : (2, 4) deux fois, réunie la première ;
// (0, 1) trois fois, réunie ensuite ; (2, 3) deux fois, réunie au tour 2.
// L'ordre de première rencontre est (2, 4), (0, 1), (2, 3) ; le tri rend
// (0, 1), puis (2, 3) avant (2, 4), départagées par b.
const IMPOSEES_A_TRIER = Object.freeze({
  N: 6,
  capacite: 3,
  tours: [
    [[3, 5], [4, 6], [1, 2]],
    [[3, 4, 5], [6], [1, 2]],
    [[3, 4], [5, 6], [1, 2]],
  ],
  reservations: [
    tous(1, 3),
    tous(2, 3),
    tous(3, 1),
    auTour(4, 1, 2),
    auTour(4, 1, 3),
    auTour(5, 1, 1),
    auTour(5, 1, 2),
  ],
});

describe('paires : les paires répétées (§ 5.4, § 12.5)', () => {
  test('réservées ensemble à deux tours et réunies par le moteur au troisième : la paire est choisie', () => {
    const { instance, tableDe } = preparer(RESERVEES_PUIS_REUNIES);
    assert.deepEqual(pairesRepetees(instance, tableDe), {
      choisies: [
        {
          a: 0,
          b: 1,
          fois: 3,
          tours: [
            { tour: 0, t: 0 },
            { tour: 1, t: 0 },
            { tour: 2, t: 1 },
          ],
        },
        {
          a: 2,
          b: 3,
          fois: 3,
          tours: [
            { tour: 0, t: 1 },
            { tour: 1, t: 1 },
            { tour: 2, t: 0 },
          ],
        },
      ],
      imposees: [],
    });
  });

  test('réservées ensemble à tous leurs tours : la paire est imposée, et ne se range pas parmi les choisies', () => {
    const { instance, tableDe } = preparer(ANCRES_ENSEMBLE);
    assert.deepEqual(pairesRepetees(instance, tableDe), {
      choisies: [
        {
          a: 2,
          b: 3,
          fois: 2,
          tours: [
            { tour: 0, t: 1 },
            { tour: 2, t: 1 },
          ],
        },
      ],
      imposees: [
        {
          a: 0,
          b: 1,
          fois: 3,
          tours: [
            { tour: 0, t: 0 },
            { tour: 1, t: 0 },
            { tour: 2, t: 0 },
          ],
        },
      ],
    });
  });

  test('les imposées se trient comme les choisies : fois décroissant, puis a, puis b, jamais la première rencontre', () => {
    const { instance, tableDe } = preparer(IMPOSEES_A_TRIER);
    assert.deepEqual(pairesRepetees(instance, tableDe), {
      choisies: [],
      imposees: [
        {
          a: 0,
          b: 1,
          fois: 3,
          tours: [
            { tour: 0, t: 2 },
            { tour: 1, t: 2 },
            { tour: 2, t: 2 },
          ],
        },
        {
          a: 2,
          b: 3,
          fois: 2,
          tours: [
            { tour: 1, t: 0 },
            { tour: 2, t: 0 },
          ],
        },
        {
          a: 2,
          b: 4,
          fois: 2,
          tours: [
            { tour: 0, t: 0 },
            { tour: 1, t: 0 },
          ],
        },
      ],
    });
  });

  test("R = 1 : aucune paire ne se répète, quelle que soit l'occupation", () => {
    const { instance, tableDe } = preparer({ N: 5, capacite: 5, tours: [[[1, 2, 3, 4, 5]]], reservations: [tous(1, 1)] });
    assert.deepEqual(pairesRepetees(instance, tableDe), { choisies: [], imposees: [] });
  });

  test('égalité de fois : les index départagent, a puis b, jamais la première rencontre ni les noms', () => {
    // fois 3 : (1, 2), (1, 3), (2, 3), (4, 5) ; fois 2 : (1, 4), (1, 5),
    // (2, 4), (2, 5), (3, 4), (3, 5) — en index, un de moins.
    const { instance, tableDe } = preparer(EGALITES);
    const { choisies, imposees } = pairesRepetees(instance, tableDe);
    assert.deepEqual(
      choisies.map(({ a, b, fois }) => [a, b, fois]),
      [
        [0, 1, 3],
        [0, 2, 3],
        [1, 2, 3],
        [3, 4, 3],
        [0, 3, 2],
        [0, 4, 2],
        [1, 3, 2],
        [1, 4, 2],
        [2, 3, 2],
        [2, 4, 2],
      ],
    );
    assert.deepEqual(choisies[3].tours, [
      { tour: 0, t: 0 },
      { tour: 1, t: 0 },
      { tour: 2, t: 0 },
    ]);
    assert.deepEqual(imposees, []);
  });

  test('la réserve ne réunit personne : deux personnes en réserve au même tour ne se rencontrent pas', () => {
    // Théo (1) et Ondine (2), ensemble aux tours 1 et 3, tous deux en réserve
    // au tour 2 : deux rencontres, pas trois.
    const { instance, tableDe } = preparer({
      N: 3,
      capacite: 3,
      tours: [[[1, 2, 3]], [[3]], [[1, 2]]],
      reserves: [[], [1, 2], [3]],
    });
    assert.deepEqual(pairesRepetees(instance, tableDe), {
      choisies: [
        {
          a: 0,
          b: 1,
          fois: 2,
          tours: [
            { tour: 0, t: 0 },
            { tour: 2, t: 0 },
          ],
        },
      ],
      imposees: [],
    });
  });

  test('les paires se désignent par index : un exclu décale les index, pas les tours', () => {
    // Ondine (2) est exclue : Théo (1) a l'index 0, Maëlle (3) l'index 1.
    const { instance, tableDe } = preparer({ N: 3, capacite: 2, tours: [[[1, 3]], [[1, 3]]], exclus: [2] });
    assert.deepEqual(pairesRepetees(instance, tableDe), {
      choisies: [
        {
          a: 0,
          b: 1,
          fois: 2,
          tours: [
            { tour: 0, t: 0 },
            { tour: 1, t: 0 },
          ],
        },
      ],
      imposees: [],
    });
  });

  describe('la partition choisies / imposées égale la lecture directe et mesures.rencontresRepetees', () => {
    const cas = [
      ['réservées puis réunies', RESERVEES_PUIS_REUNIES],
      ['ancrés ensemble', ANCRES_ENSEMBLE],
      ['égalités', EGALITES],
      ['imposées à trier', IMPOSEES_A_TRIER],
      [
        'une rencontre hors réservation, au milieu, rend la répétition choisie',
        {
          N: 3,
          capacite: 3,
          tours: [[[1, 2, 3]], [[1, 2, 3]], [[1, 2, 3]]],
          reservations: [tous(1, 1), auTour(2, 1, 1), auTour(2, 1, 3), tous(3, 1)],
        },
      ],
      [
        'deux partiellement fixés réservés ensemble à chaque rencontre',
        {
          N: 4,
          capacite: 3,
          tours: [
            [[1, 2, 4], [3]],
            [[1, 2], [3, 4]],
            [[1, 2], [3, 4]],
          ],
          reservations: [tous(2, 1), auTour(3, 2, 2), auTour(3, 2, 3), auTour(4, 2, 2), auTour(4, 2, 3)],
        },
      ],
    ];
    for (const [nom, description] of cas) {
      test(nom, () => {
        const { instance, tableDe } = preparer(description);
        const paires = pairesRepetees(instance, tableDe);
        assert.deepEqual(paires, attendues(description, instance));
        assert.deepEqual(
          { choisies: paires.choisies.length, imposees: paires.imposees.length },
          mesurer(instance, tableDe).rencontresRepetees,
        );
      });
    }
  });

  test('un parcours déjà lu rend les mêmes paires que celui que la fonction lit elle-même', () => {
    const { instance, tableDe } = preparer(ANCRES_ENSEMBLE);
    const parcours = parcourirTours(instance, tableDe);
    assert.deepEqual(pairesRepetees(instance, tableDe, parcours), pairesRepetees(instance, tableDe));
  });
});

describe("paires : la ligne d'une personne (§ 12.5)", () => {
  test("les personnes rencontrées, les plus revues d'abord, puis par index ; une seule rencontre compte", () => {
    // Iris (4) : Basile (5) trois fois ; Théo, Ondine, Maëlle deux fois.
    const { instance, tableDe } = preparer(EGALITES);
    assert.deepEqual(rencontresDe(instance, tableDe, 3), [
      {
        q: 4,
        fois: 3,
        tours: [
          { tour: 0, t: 0 },
          { tour: 1, t: 0 },
          { tour: 2, t: 0 },
        ],
      },
      {
        q: 0,
        fois: 2,
        tours: [
          { tour: 1, t: 0 },
          { tour: 2, t: 0 },
        ],
      },
      {
        q: 1,
        fois: 2,
        tours: [
          { tour: 1, t: 0 },
          { tour: 2, t: 0 },
        ],
      },
      {
        q: 2,
        fois: 2,
        tours: [
          { tour: 1, t: 0 },
          { tour: 2, t: 0 },
        ],
      },
    ]);
    // Maëlle (3) d'ANCRES_ENSEMBLE : Iris deux fois, Théo et Ondine une fois,
    // au tour 2.
    const ancres = preparer(ANCRES_ENSEMBLE);
    assert.deepEqual(rencontresDe(ancres.instance, ancres.tableDe, 2), [
      {
        q: 3,
        fois: 2,
        tours: [
          { tour: 0, t: 1 },
          { tour: 2, t: 1 },
        ],
      },
      { q: 0, fois: 1, tours: [{ tour: 1, t: 0 }] },
      { q: 1, fois: 1, tours: [{ tour: 1, t: 0 }] },
    ]);
  });

  test('une personne qui ne rencontre personne a une ligne vide', () => {
    const { instance, tableDe } = preparer({ N: 3, capacite: 2, tours: [[[1, 2], [3]]] });
    assert.deepEqual(rencontresDe(instance, tableDe, 2), []);
    // La première personne seule, les deux autres ensemble : la ligne ne
    // parcourt que les index de l'instance, et la paire des deux autres n'y
    // entre pas.
    const premiere = preparer({ N: 3, capacite: 2, tours: [[[2, 3], [1]]] });
    assert.deepEqual(rencontresDe(premiere.instance, premiere.tableDe, 0), []);
  });

  test('un parcours déjà lu rend la même ligne', () => {
    const { instance, tableDe } = preparer(EGALITES);
    assert.deepEqual(rencontresDe(instance, tableDe, 0, parcourirTours(instance, tableDe)), rencontresDe(instance, tableDe, 0));
  });

  test("un index hors de l'instance lève", () => {
    const { instance, tableDe } = preparer(EGALITES);
    for (const p of [-1, 5, 1.5, '1', null]) {
      assert.throws(() => rencontresDe(instance, tableDe, p), RangeError);
    }
  });
});

describe('paires : la matrice des rencontres (§ 12.5)', () => {
  test("le triangle dans l'ordre donné porte le compte exact de chaque paire, sans diagonale", () => {
    // Ordre : Basile, Théo, Iris, Ondine, Maëlle (index 4, 0, 3, 1, 2).
    // Basile–Théo 2, Basile–Iris 3, Basile–Ondine 2, Basile–Maëlle 2 ;
    // Théo–Iris 2, Théo–Ondine 3, Théo–Maëlle 3 ; Iris–Ondine 2, Iris–Maëlle
    // 2 ; Ondine–Maëlle 3.
    const { instance, tableDe } = preparer(EGALITES);
    const matrice = matriceRencontres(instance, tableDe, [4, 0, 3, 1, 2]);
    assert.ok(Array.isArray(matrice));
    assert.deepEqual(matrice, [2, 3, 2, 2, 2, 3, 3, 2, 2, 3]);
  });

  test('un compte au-delà de trois reste exact ; une paire jamais réunie vaut 0', () => {
    // Théo et Ondine, ancrés ensemble à quatre tours ; Maëlle seule à la
    // table 2.
    const { instance, tableDe } = preparer({
      N: 3,
      capacite: 2,
      tours: [
        [[1, 2], [3]],
        [[1, 2], [3]],
        [[1, 2], [3]],
        [[1, 2], [3]],
      ],
      reservations: [tous(1, 1), tous(2, 1)],
    });
    assert.deepEqual(matriceRencontres(instance, tableDe, [0, 1, 2]), [4, 0, 0]);
  });

  test("un ordre d'une ou de zéro personne rend un triangle vide ; un sous-ensemble se lit dans son ordre", () => {
    const { instance, tableDe } = preparer(EGALITES);
    assert.deepEqual(matriceRencontres(instance, tableDe, []), []);
    assert.deepEqual(matriceRencontres(instance, tableDe, [2]), []);
    assert.deepEqual(matriceRencontres(instance, tableDe, [3, 4]), [3]);
  });

  test('un parcours déjà lu rend la même matrice', () => {
    const { instance, tableDe } = preparer(EGALITES);
    const ordre = [4, 3, 2, 1, 0];
    assert.deepEqual(
      matriceRencontres(instance, tableDe, ordre, parcourirTours(instance, tableDe)),
      matriceRencontres(instance, tableDe, ordre),
    );
  });

  test("un ordre qui répète une personne ou sort de l'instance lève", () => {
    const { instance, tableDe } = preparer(EGALITES);
    for (const ordre of [[0, 0], [0, 5], [-1, 0], [0.5, 1], ['0', 1]]) {
      assert.throws(() => matriceRencontres(instance, tableDe, ordre), RangeError);
    }
  });
});

describe('paires : la configuration construite du § 12.5 (12 personnes, 4 tables de 3, 6 tours)', () => {
  // Douze créneaux de voisinage pour onze autres : au moins une répétition
  // pour chacun, quel que soit le plan. Vingt plans tirés.
  for (let graine = 1; graine <= 20; graine += 1) {
    test(`plan tiré de la graine ${graine}`, () => {
      const description = { N: 12, capacite: 3, tours: planConstruit(graine) };
      const { instance, tableDe } = preparer(description);
      const paires = pairesRepetees(instance, tableDe);
      assert.deepEqual(paires, attendues(description, instance));
      assert.deepEqual(paires.imposees, []);
      assert.deepEqual(
        { choisies: paires.choisies.length, imposees: 0 },
        mesurer(instance, tableDe).rencontresRepetees,
      );
      const repetes = new Set(paires.choisies.flatMap(({ a, b }) => [a, b]));
      assert.equal(repetes.size, 12);

      // La ligne de chaque personne égale sa ligne de la matrice, lue dans
      // un ordre qui n'est pas celui des index, et la lecture directe.
      const comptes = comptesDirects(description, instance);
      const ordre = Array.from({ length: 12 }, (_, i) => (5 * i + graine) % 12);
      const matrice = matriceRencontres(instance, tableDe, ordre);
      assert.equal(matrice.length, 66);
      for (let i = 0; i < 12; i += 1) {
        for (let j = i + 1; j < 12; j += 1) {
          assert.equal(matrice[rangCase(12, i, j)], comptes[ordre[i]][ordre[j]]);
        }
      }
      for (let p = 0; p < 12; p += 1) {
        const ligne = rencontresDe(instance, tableDe, p);
        assert.ok(ligne.some(({ fois }) => fois >= 2), `personne ${p} sans répétition`);
        const position = ordre.indexOf(p);
        for (let q = 0; q < 12; q += 1) {
          if (q === p) continue;
          const autre = ordre.indexOf(q);
          const cellule = matrice[rangCase(12, Math.min(position, autre), Math.max(position, autre))];
          const trouvee = ligne.find((rencontre) => rencontre.q === q);
          assert.equal(trouvee === undefined ? 0 : trouvee.fois, cellule);
          assert.equal(cellule, comptes[p][q]);
          if (trouvee !== undefined) assert.equal(trouvee.tours.length, trouvee.fois);
        }
        for (let k = 1; k < ligne.length; k += 1) {
          const [avant, apres] = [ligne[k - 1], ligne[k]];
          assert.ok(avant.fois > apres.fois || (avant.fois === apres.fois && avant.q < apres.q));
        }
      }
    });
  }
});
