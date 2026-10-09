// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du classement des propositions (§ 5.7). Une proposition
// synthétique ne porte que les champs que classer lit, pour trois personnes
// au plafond a priori de 8. Chaque ordre attendu est écrit en clair. Hors des
// épreuves où seul l'identifiant départage, chaque épreuve qui attend un
// ordre non vide en attend au moins un qui diffère de l'ordre des
// identifiants : un classement qui ne lirait aucun critère, et rangerait par
// identifiant, y échoue.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { CATALOGUE, PLAN_PARFAIT_PETITE } from '../demo/catalogue.js';
import { CRITERES, classer } from './classement.js';
import { indexerPlan, normaliser } from './configuration.js';
import { mesurer } from './indicateurs.js';

// Les critères appliqués quand le premier est sauté.
const SANS_A_PRIORI = ['excedentCollisions', 'collisionsCumulees', 'rencontresRepetees', 'redondance'];

// Fige une valeur et, à toute profondeur, les objets et les tableaux qu'elle
// contient : une écriture du module éprouvé y lève TypeError.
function figer(valeur) {
  if (typeof valeur !== 'object' || valeur === null || ArrayBuffer.isView(valeur)) return valeur;
  for (const element of Object.values(valeur)) figer(element);
  return Object.freeze(valeur);
}

// Proposition synthétique de trois personnes. rencontres fixe l'écart au
// plafond a priori de chacun, 8 − rencontres ; collisions est le triplet
// (cumulées, distinctes, excédent) du § 5.4 ; repetees et imposees comptent
// les rencontres répétées que le moteur a choisies et celles qu'imposent les
// réservations ; redondance est Σ_p r(p), le total que mesurer rend sous le
// nom totalRedondance. La liste des r(p) n'y figure pas : classer ne la lit
// pas.
function proposition(
  id,
  {
    rencontres = [8, 8, 8],
    collisions = [0, 0, 0],
    repetees = 0,
    imposees = 0,
    redondance = 0,
  } = {},
) {
  const [collisionsCumulees, pairesDistinctes, excedentCollisions] = collisions;
  return {
    id,
    mesures: {
      rencontres,
      collisionsCumulees,
      pairesDistinctes,
      excedentCollisions,
      rencontresRepetees: { choisies: repetees, imposees },
      totalRedondance: redondance,
    },
    plafondsAPriori: [8, 8, 8],
  };
}

// La même proposition, son plafond a priori inconnu.
const inconnu = (entree) => ({ ...entree, plafondsAPriori: null });

// Les six ordres d'une liste de trois éléments.
const permutations = ([a, b, c]) => [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]];

describe('classer : les critères et leur ordre (§ 5.7)', () => {
  test('CRITERES nomme les cinq critères dans leur ordre, et ne se modifie pas', () => {
    assert.deepEqual(CRITERES, [
      'ecartAuPlafondAPrioriMax',
      'excedentCollisions',
      'collisionsCumulees',
      'rencontresRepetees',
      'redondance',
    ]);
    assert.ok(Object.isFrozen(CRITERES));
  });

  test("l'ordre de l'opérateur (§ 5.4) : l'excédent d'abord, le volume ensuite", () => {
    // Les trois plans du § 5.4, au même écart au plafond a priori, en
    // (cumulées, distinctes, excédent) : un collègue retrouvé quatre fois,
    // deux collègues retrouvés deux fois chacun, six collègues retrouvés une
    // fois chacun. Les rencontres répétées suivent : une paire réunie quatre
    // fois, deux paires réunies deux fois, aucune.
    const concentre = proposition(1, { collisions: [4, 1, 3], repetees: 1 });
    const deuxFois = proposition(2, { collisions: [4, 2, 2], repetees: 2 });
    const reparti = proposition(3, { collisions: [6, 6, 0] });
    const entrees = [concentre, deuxFois, reparti];
    for (const ordreRecu of permutations(entrees)) {
      assert.deepEqual(classer(ordreRecu).ordre, [3, 2, 1]);
    }
    // La raison de la clé : un tri sur les seules collisions cumulées, ou sur
    // les seules paires distinctes, met le plan réparti en dernier.
    const triSur = (champ) =>
      [...entrees].sort((a, b) => a.mesures[champ] - b.mesures[champ] || a.id - b.id).map(({ id }) => id);
    assert.equal(triSur('collisionsCumulees').at(-1), 3);
    assert.equal(triSur('pairesDistinctes').at(-1), 3);
  });

  test('chaque critère départage à son rang, avant tous les suivants', () => {
    // Chaque proposition perd sur un seul critère et gagne sur tous les
    // autres ; la proposition qui la suit perd sur le critère suivant. Seul
    // l'ordre des critères les range, à l'envers de leurs identifiants.
    const entrees = [
      proposition(1, { rencontres: [7, 8, 8] }), // écart au plafond a priori 1
      proposition(2, { collisions: [2, 1, 1], repetees: 1 }), // excédent 1
      proposition(3, { collisions: [3, 3, 0] }), // 3 cumulées, excédent 0
      proposition(4, { repetees: 1 }), // une rencontre répétée
      proposition(5, { redondance: 1 }), // redondance 1
      proposition(6),
    ];
    assert.deepEqual(classer(figer(entrees)), {
      ordre: [6, 5, 4, 3, 2, 1],
      criteresAppliques: [...CRITERES],
      critereSaute: null,
    });
  });

  test('le premier critère est le plus grand écart au plafond a priori, ni sa somme ni son minimum', () => {
    // Écarts au plafond a priori, personne par personne :
    // 1 : 2, 0, 0 ; le plus grand 2, la somme 2, le minimum 0.
    // 2 : 1, 1, 1 ; le plus grand 1, la somme 3, le minimum 1.
    const entrees = [proposition(1, { rencontres: [6, 8, 8] }), proposition(2, { rencontres: [7, 7, 7] })];
    assert.deepEqual(classer(entrees).ordre, [2, 1]);
  });

  test("le plus grand écart se lit sur toute la liste, non sur sa première valeur non nulle", () => {
    // Écarts au plafond a priori, personne par personne :
    // 1 : 1, 3, 0 ; le plus grand 3, la première valeur non nulle 1.
    // 2 : 2, 2, 2 ; le plus grand 2.
    const entrees = [proposition(1, { rencontres: [7, 5, 8] }), proposition(2, { rencontres: [6, 6, 6] })];
    assert.deepEqual(classer(entrees).ordre, [2, 1]);
  });

  test('seules les rencontres répétées que le moteur a choisies comptent (§ 5.4)', () => {
    // 1 : une répétition choisie ; 2 : cinq qu'imposent les réservations.
    const entrees = [proposition(1, { repetees: 1 }), proposition(2, { imposees: 5 })];
    assert.deepEqual(classer(entrees).ordre, [2, 1]);
  });

  test('la redondance se lit sur totalRedondance, la somme que mesurer rend', () => {
    // 1 : r(p) vaut 1, 1, 1, somme 3 et plus grand 1 ; 2 : r(p) vaut 2, 0,
    // 0, somme 2 et plus grand 2. La somme range 2 devant 1, le plus grand
    // ferait l'inverse.
    const entrees = [proposition(1, { redondance: 3 }), proposition(2, { redondance: 2 })];
    assert.deepEqual(classer(entrees).ordre, [2, 1]);
  });
});

describe('classer : le critère sauté (§ 5.7, § 12.6)', () => {
  test('un plafond a priori inconnu saute le premier critère pour toutes, et classer le nomme', () => {
    // 1 : écart au plafond a priori 0, excédent 2.
    // 2 : écart au plafond a priori 1, excédent 0.
    const premiere = proposition(1, { collisions: [4, 2, 2], repetees: 2 });
    const seconde = proposition(2, { rencontres: [7, 8, 8] });
    assert.deepEqual(classer([premiere, seconde]), {
      ordre: [1, 2],
      criteresAppliques: [...CRITERES],
      critereSaute: null,
    });
    // Un seul a priori inconnu suffit : l'excédent ouvre alors le classement
    // de toutes, y compris de celle dont l'a priori est connu.
    const attendu = { ordre: [2, 1], criteresAppliques: SANS_A_PRIORI, critereSaute: 'ecartAuPlafondAPrioriMax' };
    assert.deepEqual(classer([premiere, inconnu(seconde)]), attendu);
    assert.deepEqual(classer([inconnu(premiere), seconde]), attendu);
    assert.deepEqual(classer([inconnu(premiere), inconnu(seconde)]), attendu);
  });
});

describe('classer : le départage par identifiant (§ 15.5, point 4)', () => {
  test("à égalité sur les cinq critères, l'identifiant croissant, quel que soit l'ordre reçu", () => {
    const egales = [7, 3, 5].map((id) =>
      proposition(id, { rencontres: [7, 8, 8], collisions: [2, 1, 1], repetees: 1, redondance: 1 }),
    );
    for (const ordreRecu of permutations(egales)) {
      assert.deepEqual(classer(ordreRecu).ordre, [3, 5, 7]);
    }
  });
});

// Un plan de la variante « conflit inévitable » (§ 15.3), où A = {1, 5, 8,
// 10, 12}, B = {2, 4, 9, 11} et C = {3, 6, 7}. 1 et 5 restent ensemble aux
// quatre tours, avec un membre de B ; chaque autre table réunit un membre de
// A, de B et de C. Quatre collisions cumulées sur une seule paire.
const CONCENTRE = {
  tables: [1, 2, 3, 4],
  tours: [
    [[1, 2, 5], [3, 4, 8], [6, 9, 10], [7, 11, 12]],
    [[1, 4, 5], [6, 8, 9], [7, 10, 11], [2, 3, 12]],
    [[1, 5, 9], [7, 8, 11], [2, 3, 10], [4, 6, 12]],
    [[1, 5, 11], [2, 6, 8], [3, 4, 10], [7, 9, 12]],
  ],
  reserves: [[], [], [], []],
};

describe('classer : petite démonstration, conflit inévitable (§ 14.10, § 15.3)', () => {
  test('le plan qui répartit ses quatre collisions passe devant celui qui les concentre', () => {
    const instance = normaliser(CATALOGUE.find(({ cle }) => cle === 'petite-conflit').construire());
    const mesures = (plan) => mesurer(instance, indexerPlan(instance, plan));
    const collisions = (m) => [m.collisionsCumulees, m.pairesDistinctes, m.excedentCollisions];
    // Le plan parfait de la petite démonstration répartit les siennes : 10
    // rencontre 12 au tour 1, 5 au tour 2, 8 au tour 3 et 1 au tour 4.
    const concentre = mesures(CONCENTRE);
    const reparti = mesures(PLAN_PARFAIT_PETITE);
    assert.deepEqual(collisions(concentre), [4, 1, 3]);
    assert.deepEqual(collisions(reparti), [4, 4, 0]);
    // Nul ne rencontre plus de 8 personnes sur 11 (§ 15.3).
    const huit = new Array(12).fill(8);
    const entrees = [
      { id: 1, mesures: concentre, plafondsAPriori: huit },
      { id: 2, mesures: reparti, plafondsAPriori: huit },
    ];
    assert.deepEqual(classer(entrees).ordre, [2, 1]);
    // Le plafond a priori inconnu, l'excédent décide seul : 0 contre 3.
    assert.deepEqual(classer(entrees.map(inconnu)), {
      ordre: [2, 1],
      criteresAppliques: SANS_A_PRIORI,
      critereSaute: 'ecartAuPlafondAPrioriMax',
    });
  });
});

describe('classer : les entrées reçues', () => {
  test("une liste vide rend un ordre vide, tous les critères appliqués", () => {
    assert.deepEqual(classer([]), { ordre: [], criteresAppliques: [...CRITERES], critereSaute: null });
  });

  test("population vide, plafond a priori connu : le premier critère s'applique, sans rien départager", () => {
    // Une population vide n'a pas de plus grand écart au plafond a priori ;
    // ce n'est pas un plafond a priori inconnu, et rien n'est sauté.
    const vide = (id) => ({ ...proposition(id, { rencontres: [] }), plafondsAPriori: [] });
    assert.deepEqual(classer([vide(2), vide(1)]), {
      ordre: [1, 2],
      criteresAppliques: [...CRITERES],
      critereSaute: null,
    });
  });

  test('un identifiant répété lève RangeError ; un identifiant non entier, TypeError', () => {
    assert.throws(() => classer([proposition(1), proposition(2), proposition(1)]), RangeError);
    assert.throws(() => classer([proposition('1')]), TypeError);
    assert.throws(() => classer([proposition(1.5)]), TypeError);
  });

  test("un plafond a priori undefined lève TypeError ; d'une autre longueur que les rencontres, RangeError", () => {
    const sansAPriori = { ...proposition(2), plafondsAPriori: undefined };
    assert.throws(() => classer([proposition(1), sansAPriori]), TypeError);
    assert.throws(() => classer([{ ...proposition(1), plafondsAPriori: [8, 8] }]), RangeError);
  });

  test('des mesures de populations de tailles différentes lèvent RangeError', () => {
    const quatre = {
      ...proposition(2, { rencontres: [8, 8, 8, 8] }),
      plafondsAPriori: [8, 8, 8, 8],
    };
    assert.throws(() => classer([proposition(1), quatre]), RangeError);
  });
});
