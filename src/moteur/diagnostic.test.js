// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du diagnostic (§ 5.6) : les valeurs que le § 15 donne pour le
// catalogue, chaque règle sur une salle écrite à la main, et, sur des salles
// minuscules, l'énumération de tous les plans, qui arbitre les planchers sans
// rien lire du code éprouvé (§ 14.11) : le plus petit chiffre que mesure un
// plan ne descend sous aucun plancher, et l'atteint là où le commentaire du
// test montre le plan qui l'atteint. Les autres valeurs attendues se calculent
// à la main, dans le commentaire qui les précède.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { CATALOGUE, PLAN_PARFAIT_PETITE } from '../demo/catalogue.js';
import { conflitsParTable } from './conflits.js';
import { LIBRE, STATUT, indexerPlan, normaliser } from './configuration.js';
import { diagnostiquer, planchersCollisions } from './diagnostic.js';
import { ErreurConfiguration } from './erreurs.js';
import { mesurer } from './indicateurs.js';
import { plafondItineraire, plafondsAPriori, plafondsRealises } from './plafond.js';

const SANS_CONTRAINTE = {
  separerAppartenances: false,
  nouveauxVoisins: false,
  nouvelleTable: false,
  varierAppartenances: false,
};
const TOUTES = {
  separerAppartenances: true,
  nouveauxVoisins: true,
  nouvelleTable: true,
  varierAppartenances: true,
};
const SEPARER = { ...SANS_CONTRAINTE, separerAppartenances: true };
const TOUTES_SAUF_SEPARER = { ...TOUTES, separerAppartenances: false };

/**
 * Configuration écrite à la main. tables porte une paire [id, capacité] par
 * table, dans l'ordre de la configuration, le numéro suivant la position ;
 * appartenances[j] est celle du participant d'id j + 1 ; exclus nomme des ids ;
 * contraintes, aucune par défaut.
 * Les identifiants de table diffèrent des index et des numéros : un index lu
 * comme un identifiant désigne une table absente.
 */
function salle({
  tables,
  appartenances,
  tours,
  reservations = [],
  exclus = [],
  contraintes = SANS_CONTRAINTE,
}) {
  return {
    participants: appartenances.map((appartenance, j) => ({
      id: j + 1,
      nom: `P${j + 1}`,
      appartenance,
      exclu: exclus.includes(j + 1),
    })),
    tables: tables.map(([id, capacite], i) => ({ id, numero: i + 1, capacite })),
    tours,
    reservations,
    contraintes: { ...contraintes },
  };
}

const ancrer = (participant, table) => ({ participant, table, portee: 'tous' });
const fixer = (participant, table, tour) => ({ participant, table, portee: 'tour', tour });

// n fois la même appartenance.
const fois = (n, appartenance) => Array(n).fill(appartenance);

function construire(cle) {
  const entree = CATALOGUE.find((e) => e.cle === cle);
  assert.ok(entree, `démonstration ${cle} absente du catalogue`);
  return entree.construire();
}

/**
 * Appelle visiter(tableDe) pour chaque plan indexé qui assied chacun à chaque
 * tour, honore chaque tour fixé et ne dépasse aucune capacité. Les cases
 * [p × R + r] se remplissent dans l'ordre ; le même tableau sert à tous les
 * plans. Rend le nombre de plans visités.
 */
function enumererPlans(instance, visiter) {
  const { N, T, R, capacite, fixe } = instance;
  const tableDe = new Int32Array(N * R);
  const occupation = new Int32Array(T * R);
  const toutes = Array.from({ length: T }, (_, t) => t);
  let plans = 0;
  const remplir = (i) => {
    if (i === N * R) {
      plans += 1;
      visiter(tableDe);
      return;
    }
    const r = i % R;
    for (const t of fixe[i] === LIBRE ? toutes : [fixe[i]]) {
      if (occupation[t * R + r] === capacite[t]) continue;
      occupation[t * R + r] += 1;
      tableDe[i] = t;
      remplir(i + 1);
      occupation[t * R + r] -= 1;
    }
  };
  remplir(0);
  return plans;
}

/**
 * Sur tous les plans de la configuration, la plus petite mesure de chaque
 * groupe : { cumulees, distinctes, excedent }, par libellé. Chaque minimum
 * vient de son propre plan.
 */
function minimumsParGroupe(configuration) {
  const instance = normaliser(configuration);
  const minimums = new Map();
  for (const groupe of instance.groupes) {
    minimums.set(groupe, { cumulees: Infinity, distinctes: Infinity, excedent: Infinity });
  }
  const plans = enumererPlans(instance, (tableDe) => {
    for (const mesure of mesurer(instance, tableDe).parGroupe) {
      const minimum = minimums.get(mesure.groupe);
      minimum.cumulees = Math.min(minimum.cumulees, mesure.collisionsCumulees);
      minimum.distinctes = Math.min(minimum.distinctes, mesure.pairesDistinctes);
      minimum.excedent = Math.min(minimum.excedent, mesure.excedent);
    }
  });
  assert.ok(plans > 0, 'aucun plan énuméré');
  return minimums;
}

/**
 * Sur tous les plans de la configuration : le plus petit écart d'itinéraire
 * maximal, sur tous les participants, et le plus petit nombre de mobiles dont
 * l'écart d'itinéraire atteint seuil. Chaque minimum vient de son propre plan.
 */
function ecartsItineraireSurTousLesPlans(configuration, seuil) {
  const instance = normaliser(configuration);
  const aPriori = plafondsAPriori(instance);
  let plusPetitMaximum = Infinity;
  let moinsDeMobiles = Infinity;
  const plans = enumererPlans(instance, (tableDe) => {
    const realises = plafondsRealises(instance, tableDe);
    let maximum = 0;
    let mobiles = 0;
    for (let p = 0; p < instance.N; p += 1) {
      const ecartItineraire = aPriori[p] - realises[p];
      maximum = Math.max(maximum, ecartItineraire);
      if (instance.statut[p] !== STATUT.ANCRE && ecartItineraire >= seuil) mobiles += 1;
    }
    plusPetitMaximum = Math.min(plusPetitMaximum, maximum);
    moinsDeMobiles = Math.min(moinsDeMobiles, mobiles);
  });
  assert.ok(plans > 0, 'aucun plan énuméré');
  return { plusPetitMaximum, moinsDeMobiles };
}

/**
 * Pour le premier mobile, dans l'ordre de instance.ids : son plafond a
 * priori, et, par index de table, le plafond du meilleur itinéraire qui
 * visite la table, null pour une table qu'aucun itinéraire ne visite. Chaque
 * itinéraire — à chaque tour, une table où les ancrés laissent un siège — est
 * évalué par plafondItineraire, sans rien lire du diagnostic.
 */
function meilleursItineraires(configuration) {
  const instance = normaliser(configuration);
  const { T, R, capacite, ancresParTable } = instance;
  const mobile = instance.statut.indexOf(STATUT.MOBILE);
  assert.notEqual(mobile, -1, 'aucun mobile');
  const admissibles = [];
  for (let t = 0; t < T; t += 1) if (ancresParTable[t] < capacite[t]) admissibles.push(t);
  const parTable = Array(T).fill(null);
  let plafondAPriori = null;
  let itineraires = 0;
  const itineraire = new Int32Array(R);
  const parcourir = (r) => {
    if (r === R) {
      itineraires += 1;
      const plafond = plafondItineraire(instance, mobile, itineraire);
      plafondAPriori = Math.max(plafondAPriori ?? plafond, plafond);
      for (const t of itineraire) parTable[t] = Math.max(parTable[t] ?? plafond, plafond);
      return;
    }
    for (const t of admissibles) {
      itineraire[r] = t;
      parcourir(r + 1);
    }
  };
  parcourir(0);
  assert.ok(itineraires > 0, 'aucun itinéraire énuméré');
  return { plafondAPriori, parTable };
}

describe('diagnostic : le catalogue (§ 15)', () => {
  // § 15.1 : 260 sièges pour 260 membres ; les animateurs des tables de 7
  // plafonnent à 24, tout autre à 28 ; 33 ancrages de 4 tours, 3 retours
  // chacun. Les tables de 7 offrent 4 × 6 sièges mobiles à chaque tour, 96
  // sièges-tours qu'un mobile n'occupe que 4 fois au plus : 24 mobiles au
  // moins passent par une table de 7, dont le meilleur itinéraire vaut 27
  // contre 28. Chaque appartenance compte au plus 12 membres pour 33 tables,
  // et les 74 appartenances tirées dépassent tout plafond a priori.
  test('grande : aucune place ne manque, a priori de 24 à 28, 99 retours imposés, écart d’itinéraire plancher à 1 pour 24 mobiles', () => {
    const configuration = construire('grande');
    const diagnostic = diagnostiquer(configuration);
    assert.equal(diagnostic.placesManquantes, 0);
    assert.equal(diagnostic.plafondAPriori.min, 24);
    assert.equal(diagnostic.plafondAPriori.max, 28);
    // parPersonne suit l'ordre de instance.ids : 24 à l'index de chaque
    // animateur d'une table de 7, lu dans les réservations, 28 à tout autre.
    const tablesDeSept = new Set(
      configuration.tables.filter(({ capacite }) => capacite === 7).map(({ id }) => id),
    );
    const { indexDe } = normaliser(configuration);
    const animateursDeSept = new Set(
      configuration.reservations
        .filter(({ table }) => tablesDeSept.has(table))
        .map(({ participant }) => indexDe.get(participant)),
    );
    assert.equal(animateursDeSept.size, 4);
    assert.deepEqual(
      diagnostic.plafondAPriori.parPersonne,
      Array.from({ length: 260 }, (_, p) => (animateursDeSept.has(p) ? 24 : 28)),
    );
    assert.equal(diagnostic.retoursImposes, 99);
    assert.deepEqual(diagnostic.ecartItineraire, { plancher: 1, mobilesAuMoins: 24 });
    assert.equal(diagnostic.animateursMemeAppartenance, false);
    assert.equal(diagnostic.redondanceImposeeParAnimateurs, 0);
    assert.deepEqual(diagnostic.collisions, []);
    assert.equal(diagnostic.redondanceMinimale, 0);
    assert.deepEqual(
      diagnostic.ancrage,
      Array.from({ length: 33 }, (_, t) => ({
        table: t + 1,
        ancres: 1,
        capacite: t < 29 ? 8 : 7,
        gelee: false,
        moitie: false,
      })),
    );
    // 24 aux quatre animateurs des tables de 7, 28 à chacun des autres ; les
    // 227 mobiles sont tous à 28.
    assert.deepEqual(diagnostic.plafondAPriori.repartition, [
      { valeur: 24, ancres: 4, mobiles: 0 },
      { valeur: 28, ancres: 29, mobiles: 227 },
    ]);
    // Chacun des 33 animateurs revient trois fois à sa table.
    assert.equal(diagnostic.ancragesImposantRetours, 33);
    assert.equal(diagnostic.uneSeuleAppartenance, false);
    assert.equal(diagnostic.collisionPartout, false);
    assert.deepEqual(diagnostic.remedes, { toursSansRedondance: null });
  });

  // 264 sièges pour 260 membres : la configuration n'est pas tendue.
  test('grande sans exception : aucun plancher d’écart d’itinéraire', () => {
    const diagnostic = diagnostiquer(construire('grande-sans-exception'));
    assert.equal(diagnostic.ecartItineraire, null);
    assert.equal(diagnostic.placesManquantes, 0);
  });

  // Quatre membres par appartenance, quatre tables : chacun la sienne. La
  // salle est tendue, 12 sièges pour 12, mais ses tables sont identiques :
  // aucune n'est inférieure, et aucun plancher ne s'écrit.
  test('petite : aucun plancher de collisions, aucun plancher d’écart d’itinéraire', () => {
    const diagnostic = diagnostiquer(construire('petite'));
    assert.deepEqual(diagnostic.collisions, []);
    assert.equal(diagnostic.ecartItineraire, null);
  });

  // Cinq membres de A pour quatre tables : deux partagent une table à chaque
  // tour, 4 collisions cumulées, 1 paire distincte au moins ; 4 ≤ C(5, 2) :
  // aucun excédent n'est forcé.
  test('petite-conflit : un groupe de 5, 4 collisions cumulées, 1 paire distincte, aucun plancher d’excédent', () => {
    const configuration = construire('petite-conflit');
    const diagnostic = diagnostiquer(configuration);
    assert.deepEqual(diagnostic.collisions, [
      {
        groupe: configuration.participants[0].appartenance,
        effectif: 5,
        plancherCumulees: 4,
        plancherPairesDistinctes: 1,
        plancherExcedent: null,
        tablesManquantes: 1,
      },
    ]);
  });
});

describe('diagnostic : places manquantes (§ 5.9)', () => {
  // 15 personnes, 3 tables de 4 : 3 places manquent à chaque tour. Le
  // diagnostic les chiffre et ne lève pas.
  test('une salle trop petite se chiffre en places manquantes, sans refus', () => {
    const configuration = salle({
      tables: [[10, 4], [20, 4], [30, 4]],
      appartenances: fois(15, null),
      tours: 3,
    });
    assert.equal(diagnostiquer(configuration).placesManquantes, 3);
  });

  // Tables de 3 et de 2 pour 6 personnes : 1 place manque. La table de 2 y
  // est inférieure, son meilleur itinéraire valant 3 contre P* = 4, comme
  // dans la même salle tendue à 5 personnes, dont le plancher d'écart
  // d'itinéraire vaut 1 pour 2 mobiles (§ 12.10.4). Trop petite, la salle
  // n'en écrit aucun : la tension seule en décide.
  test('une salle trop petite n’écrit aucun plancher d’écart d’itinéraire, même à tables inégales', () => {
    const configuration = salle({
      tables: [[10, 3], [20, 2]],
      appartenances: fois(6, null),
      tours: 2,
    });
    const diagnostic = diagnostiquer(configuration);
    assert.equal(diagnostic.placesManquantes, 1);
    assert.equal(diagnostic.ecartItineraire, null);
  });

  // Un ancré retire une personne des mobiles et un siège de la capacité
  // libre : le nombre de places manquantes ne bouge pas.
  test('le nombre de places manquantes ne dépend d’aucune réservation', () => {
    const configuration = salle({
      tables: [[10, 4], [20, 4], [30, 4]],
      appartenances: fois(15, null),
      tours: 3,
      reservations: [ancrer(1, 10), ancrer(2, 20), fixer(3, 30, 2)],
    });
    assert.equal(diagnostiquer(configuration).placesManquantes, 3);
  });
});

describe('diagnostic : animateurs de même appartenance (§ 5.6)', () => {
  // Trois ancrés de X aux tables 10, 20 et 30 ; quatre tables, quatre tours :
  // min(R, T) − 1 = 3.
  test('trois ancrés de même appartenance sur 4 tables, 4 tours : 3 redondances imposées', () => {
    const configuration = salle({
      tables: [[10, 3], [20, 3], [30, 3], [40, 3]],
      appartenances: [...fois(3, 'X'), ...fois(9, null)],
      tours: 4,
      reservations: [ancrer(1, 10), ancrer(2, 20), ancrer(3, 30)],
    });
    const diagnostic = diagnostiquer(configuration);
    assert.equal(diagnostic.animateursMemeAppartenance, true);
    assert.equal(diagnostic.redondanceImposeeParAnimateurs, 3);
  });

  test('la redondance imposée vaut min(R, T) − 1 : 2 tours sur 4 tables, 5 tours sur 3 tables', () => {
    const quatreTables = salle({
      tables: [[10, 3], [20, 3], [30, 3], [40, 3]],
      appartenances: [...fois(3, 'X'), ...fois(9, null)],
      tours: 2,
      reservations: [ancrer(1, 10), ancrer(2, 20), ancrer(3, 30)],
    });
    assert.equal(diagnostiquer(quatreTables).redondanceImposeeParAnimateurs, 1);
    const troisTables = salle({
      tables: [[10, 3], [20, 3], [30, 3]],
      appartenances: [...fois(3, 'X'), ...fois(6, null)],
      tours: 5,
      reservations: [ancrer(1, 10), ancrer(2, 20), ancrer(3, 30)],
    });
    assert.equal(diagnostiquer(troisTables).redondanceImposeeParAnimateurs, 2);
  });

  // Un seul ancré ; deux ancrés d'appartenances distinctes ; deux sans
  // appartenance ; un de X et un sans appartenance ; deux de X et un sans
  // appartenance. Un ancré sans appartenance rompt l'appartenance commune,
  // même quand tous les autres la partagent.
  test('un seul ancré, des appartenances distinctes ou absentes : rien n’est imposé', () => {
    const cas = [
      { appartenances: ['X', null, null, null, null, null], ancres: [ancrer(1, 10)] },
      { appartenances: ['X', 'Y', null, null, null, null], ancres: [ancrer(1, 10), ancrer(2, 20)] },
      { appartenances: fois(6, null), ancres: [ancrer(1, 10), ancrer(2, 20)] },
      { appartenances: ['X', null, null, null, null, null], ancres: [ancrer(1, 10), ancrer(2, 20)] },
      {
        appartenances: ['X', 'X', null, null, null, null],
        ancres: [ancrer(1, 10), ancrer(2, 20), ancrer(3, 10)],
      },
    ];
    for (const { appartenances, ancres } of cas) {
      const diagnostic = diagnostiquer(
        salle({ tables: [[10, 3], [20, 3]], appartenances, tours: 3, reservations: ancres }),
      );
      assert.equal(diagnostic.animateursMemeAppartenance, false, JSON.stringify(appartenances));
      assert.equal(diagnostic.redondanceImposeeParAnimateurs, 0, JSON.stringify(appartenances));
    }
  });

  // L'ancré de Y est exclu : sa réservation est suspendue (§ 4.4), et les
  // ancrés restants partagent X.
  test('un ancré exclu ne compte pas parmi les animateurs', () => {
    const configuration = salle({
      tables: [[10, 3], [20, 3], [30, 3]],
      appartenances: ['X', 'X', 'Y', ...fois(6, null)],
      tours: 2,
      reservations: [ancrer(1, 10), ancrer(2, 20), ancrer(3, 30)],
      exclus: [3],
    });
    const diagnostic = diagnostiquer(configuration);
    assert.equal(diagnostic.animateursMemeAppartenance, true);
    assert.equal(diagnostic.redondanceImposeeParAnimateurs, 1);
  });

  // 1 et 2, de X, ancrés aux tables 10 et 20 ; 3, de Y, réservé à la table
  // 30 au seul tour 1 : partiellement fixé, il compte parmi les mobiles
  // (§ 5.4), non parmi les animateurs. Les animateurs partagent X ; trois
  // tables, deux tours : min(R, T) − 1 = 1.
  test('un partiellement fixé ne compte pas parmi les animateurs', () => {
    const configuration = salle({
      tables: [[10, 3], [20, 3], [30, 3]],
      appartenances: ['X', 'X', 'Y', ...fois(6, null)],
      tours: 2,
      reservations: [ancrer(1, 10), ancrer(2, 20), fixer(3, 30, 1)],
    });
    const diagnostic = diagnostiquer(configuration);
    assert.equal(diagnostic.animateursMemeAppartenance, true);
    assert.equal(diagnostic.redondanceImposeeParAnimateurs, 1);
  });
});

describe('diagnostic : planchers de collisions (§ 5.6)', () => {
  // Trois membres de X, deux tables de 2, cinq tours : à chaque tour, deux
  // membres de X partagent une table, soit 5 collisions cumulées pour
  // C(3, 2) = 3 paires possibles ; l'excédent ne descend pas sous 2. Le plan
  // qui fait se retrouver chacune des trois paires l'atteint ; celui qui garde
  // la même paire cinq fois atteint 1 paire distincte.
  test('un groupe de 3 sur 2 tables pendant 5 tours : plancher d’excédent 2, atteint', () => {
    const configuration = salle({
      tables: [[10, 2], [20, 2]],
      appartenances: ['X', 'X', 'X', null],
      tours: 5,
    });
    assert.deepEqual(diagnostiquer(configuration).collisions, [
      {
        groupe: 'X',
        effectif: 3,
        plancherCumulees: 5,
        plancherPairesDistinctes: 1,
        plancherExcedent: 2,
        tablesManquantes: 1,
      },
    ]);
    assert.deepEqual(minimumsParGroupe(configuration).get('X'), {
      cumulees: 5,
      distinctes: 1,
      excedent: 2,
    });
  });

  // Trois membres de X, deux tables de 2, quatre tours : une paire de X par
  // tour, 4 collisions cumulées pour C(3, 2) = 3 paires possibles ;
  // l'excédent ne descend pas sous 1, le plus petit plancher strictement
  // positif. Le plan qui fait se retrouver chacune des trois paires
  // l'atteint ; celui qui garde la même paire quatre fois atteint 1 paire
  // distincte.
  // Plus de deux membres d'un groupe à une même table : le remplissage glouton
  // y compte C(m, 2) paires, et le plancher de paires distinctes y dépasse 1.
  // L'exemple du § 5.6 — six membres sur quatre tables, quatre tours — est
  // trop grand pour l'énumération ; les deux salles suivantes s'énumèrent, et
  // leurs planchers égalent les minimums exacts.
  test('l’exemple du § 5.6 : au moins 8 collisions cumulées sur 4 tours, portées par au moins 2 paires distinctes', () => {
    const configuration = salle({
      tables: [[10, 4], [20, 4], [30, 4], [40, 4]],
      appartenances: [...fois(6, 'X'), ...fois(10, null)],
      tours: 4,
    });
    assert.deepEqual(diagnostiquer(configuration).collisions, [
      {
        groupe: 'X',
        effectif: 6,
        plancherCumulees: 8,
        plancherPairesDistinctes: 2,
        plancherExcedent: null,
        tablesManquantes: 2,
      },
    ]);
  });

  test('six membres sur deux tables de 3, deux tours : trois par table, 6 paires par tour', () => {
    const configuration = salle({
      tables: [[10, 3], [20, 3]],
      appartenances: fois(6, 'X'),
      tours: 2,
    });
    assert.deepEqual(diagnostiquer(configuration).collisions, [
      {
        groupe: 'X',
        effectif: 6,
        plancherCumulees: 12,
        plancherPairesDistinctes: 6,
        plancherExcedent: null,
        tablesManquantes: 4,
      },
    ]);
    const exacts = minimumsParGroupe(configuration).get('X');
    assert.equal(exacts.cumulees, 12);
    assert.equal(exacts.distinctes, 6);
  });

  test('cinq membres sur deux tables de 3, trois tours : 4 paires par tour, plancher d’excédent 2, atteint', () => {
    const configuration = salle({
      tables: [[10, 3], [20, 3]],
      appartenances: [...fois(5, 'X'), null],
      tours: 3,
    });
    assert.deepEqual(diagnostiquer(configuration).collisions, [
      {
        groupe: 'X',
        effectif: 5,
        plancherCumulees: 12,
        plancherPairesDistinctes: 4,
        plancherExcedent: 2,
        tablesManquantes: 3,
      },
    ]);
    assert.deepEqual(minimumsParGroupe(configuration).get('X'), { cumulees: 12, distinctes: 4, excedent: 2 });
  });

  test('un groupe de 3 sur 2 tables pendant 4 tours : plancher d’excédent 1, atteint', () => {
    const configuration = salle({
      tables: [[10, 2], [20, 2]],
      appartenances: ['X', 'X', 'X', null],
      tours: 4,
    });
    assert.deepEqual(diagnostiquer(configuration).collisions, [
      {
        groupe: 'X',
        effectif: 3,
        plancherCumulees: 4,
        plancherPairesDistinctes: 1,
        plancherExcedent: 1,
        tablesManquantes: 1,
      },
    ]);
    assert.deepEqual(minimumsParGroupe(configuration).get('X'), {
      cumulees: 4,
      distinctes: 1,
      excedent: 1,
    });
  });

  // 1 et 2, de X, sont ancrés ensemble à la table 10 : une paire à chaque
  // tour, 3 en tout, quand trois membres sur trois tables n'en forceraient
  // aucune. 4 et 5, de Y, sont réservés ensemble à la table 20 au seul
  // tour 1 : une paire ce tour-là, aucune aux deux autres. Chaque plan atteint
  // les deux planchers, la table 10 étant pleine de ses ancrés ; celui qui
  // sépare 4 et 5 aux tours 2 et 3 n'en compte qu'une rencontre.
  test('un ancré pèse à chaque tour, un partiellement fixé à son seul tour réservé', () => {
    const configuration = salle({
      tables: [[10, 2], [20, 2], [30, 2]],
      appartenances: ['X', 'X', 'X', 'Y', 'Y', null],
      tours: 3,
      reservations: [ancrer(1, 10), ancrer(2, 10), fixer(4, 20, 1), fixer(5, 20, 1)],
    });
    assert.deepEqual(diagnostiquer(configuration).collisions, [
      {
        groupe: 'X',
        effectif: 3,
        plancherCumulees: 3,
        plancherPairesDistinctes: 1,
        plancherExcedent: null,
        tablesManquantes: null,
      },
      {
        groupe: 'Y',
        effectif: 2,
        plancherCumulees: 1,
        plancherPairesDistinctes: 1,
        plancherExcedent: null,
        tablesManquantes: null,
      },
    ]);
    const minimums = minimumsParGroupe(configuration);
    assert.deepEqual(minimums.get('X'), { cumulees: 3, distinctes: 1, excedent: 2 });
    assert.deepEqual(minimums.get('Y'), { cumulees: 1, distinctes: 1, excedent: 0 });
  });

  // Deux ancrés de X à la même table pendant 3 tours : la même paire 3 fois,
  // pour C(2, 2) = 1 paire possible : l'excédent ne descend pas sous 2.
  test('une paire d’ancrés réunie à chaque tour force un excédent', () => {
    const configuration = salle({
      tables: [[10, 3], [20, 3], [30, 3]],
      appartenances: ['X', 'X', ...fois(7, null)],
      tours: 3,
      reservations: [ancrer(1, 10), ancrer(2, 10)],
    });
    assert.deepEqual(diagnostiquer(configuration).collisions, [
      {
        groupe: 'X',
        effectif: 2,
        plancherCumulees: 3,
        plancherPairesDistinctes: 1,
        plancherExcedent: 2,
        tablesManquantes: null,
      },
    ]);
  });

  // Trente membres de X, dont deux ancrés à la même table : la paire qu'ils
  // forment ne se défait par aucune table ajoutée. Le remède ne se sonde pas
  // jusqu'à l'effectif : un chiffrage de plus, celui des seules places
  // réservées, suffit à le dire sans remède.
  test('un groupe que ses réservations réunissent ne se sonde pas table après table : deux chiffrages au plus', () => {
    const configuration = salle({
      tables: [[10, 20], [20, 20]],
      appartenances: fois(30, 'X'),
      tours: 2,
      reservations: [ancrer(1, 10), ancrer(2, 10)],
    });
    let chiffrages = 0;
    const espion = (...parametres) => {
      chiffrages += 1;
      return planchersCollisions(...parametres);
    };
    const { collisions } = diagnostiquer(configuration, { planchersCollisions: espion });
    assert.deepEqual(collisions, diagnostiquer(configuration).collisions);
    assert.deepEqual(collisions.map(({ groupe, effectif, tablesManquantes }) => [groupe, effectif, tablesManquantes]), [['X', 30, null]]);
    assert.ok(chiffrages <= 2, `${chiffrages} chiffrages`);
  });

  // X compte quatre membres dont un exclu : trois sur deux tables, une paire
  // par tour, deux tours.
  test('un membre exclu sort de l’effectif et du plancher', () => {
    const configuration = salle({
      tables: [[10, 4], [20, 4]],
      appartenances: ['X', 'X', 'X', 'X', null, null],
      tours: 2,
      exclus: [4],
    });
    assert.deepEqual(diagnostiquer(configuration).collisions, [
      {
        groupe: 'X',
        effectif: 3,
        plancherCumulees: 2,
        plancherPairesDistinctes: 1,
        plancherExcedent: null,
        tablesManquantes: 1,
      },
    ]);
  });

  test('les participants sans appartenance ne forment pas un groupe (§ 12.4)', () => {
    const configuration = salle({
      tables: [[10, 5], [20, 5]],
      appartenances: fois(10, null),
      tours: 3,
    });
    assert.deepEqual(diagnostiquer(configuration).collisions, []);
  });

  // Y paraît au participant 1, X au participant 2 : les groupes suivent
  // l'ordre de première apparition par ids croissants.
  test('les groupes se rangent dans l’ordre de instance.groupes', () => {
    const configuration = salle({
      tables: [[10, 3], [20, 3]],
      appartenances: ['Y', 'X', 'X', 'X', 'Y', 'Y'],
      tours: 1,
    });
    assert.deepEqual(
      diagnostiquer(configuration).collisions.map(({ groupe }) => groupe),
      ['Y', 'X'],
    );
  });
});

describe('diagnostic : plancher de l’écart d’itinéraire (§ 12.10.4)', () => {
  // Tables de 3 et de 2, cinq mobiles, deux tours : P* = 4 par deux tours à
  // la table de 3 ; le meilleur itinéraire qui passe par la table de 2 vaut
  // 2 + 1 = 3. Ses 2 sièges × 2 tours reçoivent 2 mobiles au moins, chacun à
  // 1 au moins sous son plafond a priori. Le plan qui y met quatre personnes
  // distinctes atteint l'écart d'itinéraire maximal 1 ; celui qui y garde les
  // deux mêmes n'en met que 2 sous leur plafond.
  test('une table inférieure dans une salle tendue : plancher 1, au moins 2 mobiles, atteints', () => {
    const configuration = salle({
      tables: [[10, 3], [20, 2]],
      appartenances: fois(5, null),
      tours: 2,
    });
    assert.deepEqual(diagnostiquer(configuration).ecartItineraire, {
      plancher: 1,
      mobilesAuMoins: 2,
    });
    assert.deepEqual(ecartsItineraireSurTousLesPlans(configuration, 1), {
      plusPetitMaximum: 1,
      moinsDeMobiles: 2,
    });
  });

  // Tables de 3 et de 2, cinq mobiles, un seul tour : P* = 2, les deux
  // voisins d'une table de 3 ; la table de 2 n'en offre qu'un : elle est
  // inférieure. Ses 2 sièges reçoivent 2 mobiles, chacun à 1 sous P*, dans
  // chacun des 10 plans. Le diagnostic éprouve une table en y réservant un
  // tour au mobile ; à un seul tour, cette réservation les couvre tous et
  // l'ancre (§ 4.2), sans changer le plafond du même itinéraire.
  test('à un seul tour, une table inférieure fait aussi le plancher : plancher 1, au moins 2 mobiles, atteints', () => {
    const configuration = salle({
      tables: [[10, 3], [20, 2]],
      appartenances: fois(5, null),
      tours: 1,
    });
    assert.deepEqual(diagnostiquer(configuration).ecartItineraire, {
      plancher: 1,
      mobilesAuMoins: 2,
    });
    assert.deepEqual(ecartsItineraireSurTousLesPlans(configuration, 1), {
      plusPetitMaximum: 1,
      moinsDeMobiles: 2,
    });
  });

  // Un ancré à la table de 3 : un mobile qui passe une fois par chaque table
  // y rencontre l'ancré et un siège renouvelé à chacune, 1 + 1 + 1 = 3, son
  // plafond a priori. Aucune table n'est inférieure, et le plan où chaque
  // mobile visite les deux tables n'a aucun écart d'itinéraire.
  test('une salle tendue sans table inférieure : aucun plancher, jamais 0', () => {
    const configuration = salle({
      tables: [[10, 3], [20, 2]],
      appartenances: fois(5, null),
      tours: 2,
      reservations: [ancrer(1, 10)],
    });
    assert.equal(diagnostiquer(configuration).ecartItineraire, null);
    assert.equal(ecartsItineraireSurTousLesPlans(configuration, 1).plusPetitMaximum, 0);
  });

  // Tables de 4, 4 et 2, dix mobiles, deux tours : P* = 3 + 3 = 6 ; par la
  // table de 2, 3 + 1 = 4 au mieux. Ses 4 sièges-tours reçoivent 2 mobiles
  // au moins, chacun à 2 au moins sous son plafond. Avec neuf mobiles, une
  // place reste libre et la salle n'est plus tendue : rien ne s'écrit.
  test('le plancher est la différence au meilleur itinéraire de la table inférieure, dans une salle tendue seulement', () => {
    const tables = [[10, 4], [20, 4], [30, 2]];
    const tendue = salle({ tables, appartenances: fois(10, null), tours: 2 });
    assert.deepEqual(diagnostiquer(tendue).ecartItineraire, {
      plancher: 2,
      mobilesAuMoins: 2,
    });
    const placeLibre = salle({ tables, appartenances: fois(9, null), tours: 2 });
    assert.equal(diagnostiquer(placeLibre).ecartItineraire, null);
  });

  // Tables de 4, 4, 3 et 2, treize mobiles, deux tours : P* = 6 ; par la
  // table de 3, 5 ; par celle de 2, 4. Deux tables inférieures, (3 + 2) × 2
  // = 10 sièges-tours : 5 mobiles au moins ; l'écart d'itinéraire le plus
  // petit, 1, fait le plancher.
  test('plusieurs tables inférieures : leurs sièges s’additionnent, le plus petit écart d’itinéraire fait le plancher', () => {
    const configuration = salle({
      tables: [[10, 4], [20, 4], [30, 3], [40, 2]],
      appartenances: fois(13, null),
      tours: 2,
    });
    assert.deepEqual(diagnostiquer(configuration).ecartItineraire, {
      plancher: 1,
      mobilesAuMoins: 5,
    });
  });

  // Tables de 2, 3 et 2, sept personnes, deux tours ; 1 et 2 ancrés à la
  // table 10, qu'ils gèlent (§ 5.9 l'accepte) : aucun itinéraire de mobile
  // n'y passe. P* = 4 par deux tours à la table 20 ; par la table 30,
  // 2 + 1 = 3. Ses 2 sièges × 2 tours reçoivent 2 mobiles au moins, chacun à
  // 1 au moins sous P*. La table gelée est sautée : y réserver le siège d'un
  // mobile la surréserverait. Le plan qui met quatre mobiles distincts à la
  // table 30 atteint l'écart d'itinéraire maximal 1 ; celui qui y garde les
  // deux mêmes n'en met que 2 sous leur plafond.
  test('une table gelée dans une salle tendue est sautée, sans refus', () => {
    const configuration = salle({
      tables: [[10, 2], [20, 3], [30, 2]],
      appartenances: fois(7, null),
      tours: 2,
      reservations: [ancrer(1, 10), ancrer(2, 10)],
    });
    const diagnostic = diagnostiquer(configuration);
    assert.equal(diagnostic.ancrage[0].gelee, true);
    assert.deepEqual(diagnostic.ecartItineraire, { plancher: 1, mobilesAuMoins: 2 });
    assert.deepEqual(ecartsItineraireSurTousLesPlans(configuration, 1), {
      plusPetitMaximum: 1,
      moinsDeMobiles: 2,
    });
  });

  // Tables de 2, 3 et 3, huit personnes, deux tours ; 1 ancré à la table 10,
  // qui ne laisse qu'un siège mobile et aucun siège qui tourne : v_t = 0.
  // P* = 4, par (20, 30) ; le meilleur itinéraire qui passe par la table 10
  // vaut 1 + 0 + 2 = 3, son ancré compris : elle est inférieure. Son siège
  // × 2 tours reçoit 1 mobile au moins, à 1 au moins sous P*. Le plan qui y
  // met deux mobiles distincts atteint l'écart d'itinéraire maximal 1 ;
  // celui qui y garde le même n'en met qu'un sous son plafond.
  test('une table qui ne laisse qu’un siège mobile peut être inférieure : plancher 1, au moins 1 mobile, atteints', () => {
    const configuration = salle({
      tables: [[10, 2], [20, 3], [30, 3]],
      appartenances: fois(8, null),
      tours: 2,
      reservations: [ancrer(1, 10)],
    });
    assert.deepEqual(diagnostiquer(configuration).ecartItineraire, {
      plancher: 1,
      mobilesAuMoins: 1,
    });
    assert.deepEqual(ecartsItineraireSurTousLesPlans(configuration, 1), {
      plusPetitMaximum: 1,
      moinsDeMobiles: 1,
    });
  });

  // Tables de 10, 3 et 3, seize personnes, trois tours ; 1 ancré à la table
  // 20. Un mobile rencontre au plus n_p = 14 autres mobiles, et l'ancré de la
  // table 20 s'y ajoute : P* = 1 + min(14, 1 + 9 + 9) = 15, par
  // (20, 10, 10). La table 30, de même capacité que la 20 mais sans ancré,
  // plafonne à min(14, 2 + 9 + 9) = 14 par (30, 10, 10) : elle est
  // inférieure, la 20 ne l'est pas. Ses 3 sièges × 3 tours reçoivent
  // 3 mobiles au moins, chacun à 1 au moins sous P*. Les deux tables ne
  // diffèrent que par leurs ancrés : P*_t ne se reprend pas d'une table à
  // l'autre sur la seule capacité. L'énumération des itinéraires arbitre P*
  // et chaque P*_t.
  test('deux tables de même capacité, l’une ancrée : le meilleur itinéraire de chacune compte ses ancrés', () => {
    const configuration = salle({
      tables: [[10, 10], [20, 3], [30, 3]],
      appartenances: fois(16, null),
      tours: 3,
      reservations: [ancrer(1, 20)],
    });
    assert.deepEqual(meilleursItineraires(configuration), {
      plafondAPriori: 15,
      parTable: [15, 15, 14],
    });
    assert.deepEqual(diagnostiquer(configuration).ecartItineraire, {
      plancher: 1,
      mobilesAuMoins: 3,
    });
  });

  // Tables de 4, 4 et 3, onze personnes, deux tours ; 1 ancré à la table 10.
  // Pour un mobile, a_t vaut 1, 0, 0 et v_t vaut 2, 3, 2 ; n_p = 9 ne borne
  // aucun itinéraire. P* = 6, par (10, 20) ou (20, 20). Le meilleur
  // itinéraire qui passe par la table 30 vaut 5, par (20, 30) ou (10, 30) :
  // elle est inférieure. Ses 3 sièges × 2 tours reçoivent 3 mobiles au
  // moins, chacun à 1 au moins sous P*. Les tables 10 et 30 laissent les
  // mêmes 3 sièges libres, d'où les mêmes 2 sièges qui tournent, mais l'ancré
  // de la table 10 s'ajoute au plafond de qui y passe : le terme a_t du
  // § 5.5 compte les ancrés d'une table, pas ses sièges libres, et P*_t ne se
  // reprend pas d'une table à l'autre sur les sièges libres. L'énumération
  // des itinéraires arbitre P* et chaque P*_t.
  test('deux tables aux mêmes sièges libres, l’une ancrée : son ancré s’ajoute au meilleur itinéraire qui la visite', () => {
    const configuration = salle({
      tables: [[10, 4], [20, 4], [30, 3]],
      appartenances: fois(11, null),
      tours: 2,
      reservations: [ancrer(1, 10)],
    });
    assert.deepEqual(meilleursItineraires(configuration), {
      plafondAPriori: 6,
      parTable: [6, 6, 5],
    });
    assert.deepEqual(diagnostiquer(configuration).ecartItineraire, {
      plancher: 1,
      mobilesAuMoins: 3,
    });
  });

  // Tables de 10, 4 et 4, dix-huit personnes, trois tours ; 1 ancré à la
  // table 20, 2 et 3 à la table 30. Pour un mobile, a_t vaut 0, 1, 2 et v_t
  // vaut 9, 2, 1 ; n_p = 14 borne les sièges qui tournent, et les ancrés
  // s'y ajoutent. P* = 2 + 14 = 16, par (10, 10, 30). Le meilleur itinéraire
  // qui passe par la table 20 vaut 15, par (10, 10, 20) : 1 + 14, ou par
  // (10, 20, 30) : 3 + 12. Elle est inférieure, la table 30 ne l'est pas. Ses
  // 3 sièges × 3 tours reçoivent 3 mobiles au moins, chacun à 1 au moins
  // sous P*. Les deux tables ont la même capacité et portent toutes deux des
  // ancrés : leur nombre, a_t, fait le meilleur itinéraire, non leur seule
  // présence. L'énumération des itinéraires arbitre P* et chaque P*_t.
  test('deux tables de même capacité, ancrées l’une d’un, l’autre de deux : le nombre d’ancrés fait le meilleur itinéraire', () => {
    const configuration = salle({
      tables: [[10, 10], [20, 4], [30, 4]],
      appartenances: fois(18, null),
      tours: 3,
      reservations: [ancrer(1, 20), ancrer(2, 30), ancrer(3, 30)],
    });
    assert.deepEqual(meilleursItineraires(configuration), {
      plafondAPriori: 16,
      parTable: [16, 15, 16],
    });
    assert.deepEqual(diagnostiquer(configuration).ecartItineraire, {
      plancher: 1,
      mobilesAuMoins: 3,
    });
  });

  // Tables de 5, 7, 5, 3 et 6, vingt-six personnes, trois tours ; ancrés : 4
  // à la table 20, 2 à la 30, 1 à la 40, 2 à la 50. Pour un mobile, table par
  // table, a_t vaut 0, 4, 2, 1, 2 et v_t vaut 4, 2, 2, 1, 3 ; n_p = 16 ne
  // borne aucun itinéraire. P* = 15, par (20, 30, 50) : 8 + 7. Le meilleur
  // itinéraire qui passe par la table 40 la complète par les tables ancrées
  // 20 et 50 : 7 + 6 = 13 ; par chaque autre table passe un itinéraire à 15.
  // Seule la table 40 est inférieure : ses 2 sièges mobiles × 3 tours reçoivent
  // 2 mobiles au moins, chacun à 2 au moins sous P*. Lue sans ses ancrés, la
  // salle offrirait par la table 40 l'itinéraire (40, 20, 20) à
  // 2 + 6 + 6 = 14 : P*_t se calcule sur les réservations de la
  // configuration. L'énumération des itinéraires arbitre P* et chaque P*_t.
  test('le meilleur itinéraire qui visite une table inférieure compte les ancrés des tables où il passe', () => {
    const configuration = salle({
      tables: [[10, 5], [20, 7], [30, 5], [40, 3], [50, 6]],
      appartenances: fois(26, null),
      tours: 3,
      reservations: [
        ancrer(1, 20),
        ancrer(2, 20),
        ancrer(3, 20),
        ancrer(4, 20),
        ancrer(5, 30),
        ancrer(6, 30),
        ancrer(7, 40),
        ancrer(8, 50),
        ancrer(9, 50),
      ],
    });
    assert.deepEqual(meilleursItineraires(configuration), {
      plafondAPriori: 15,
      parTable: [15, 15, 15, 13, 15],
    });
    assert.deepEqual(diagnostiquer(configuration).ecartItineraire, {
      plancher: 2,
      mobilesAuMoins: 2,
    });
  });

  test('un partiellement fixé, ou aucun mobile, et rien ne s’écrit', () => {
    const avecPartiel = salle({
      tables: [[10, 3], [20, 2]],
      appartenances: fois(5, null),
      tours: 2,
      reservations: [fixer(1, 10, 1)],
    });
    assert.equal(diagnostiquer(avecPartiel).ecartItineraire, null);
    const sansMobile = salle({
      tables: [[10, 2], [20, 2]],
      appartenances: fois(4, null),
      tours: 2,
      reservations: [ancrer(1, 10), ancrer(2, 10), ancrer(3, 20), ancrer(4, 20)],
    });
    assert.equal(diagnostiquer(sansMobile).ecartItineraire, null);
  });
});

describe('diagnostic : redondance minimale (§ 5.6)', () => {
  // Neuf personnes, trois tables de 3, six appartenances. En 4 tours, le
  // plafond a priori vaut 4 × 2 = 8, autant que les affiliés autres que soi :
  // 8 − 6 = 2. En 3 tours, il vaut 6 : 6 − 6 = 0.
  test('six appartenances : 2 redondances en 4 tours, aucune en 3', () => {
    const appartenances = ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'E', 'F'];
    const tables = [[10, 3], [20, 3], [30, 3]];
    assert.equal(diagnostiquer(salle({ tables, appartenances, tours: 4 })).redondanceMinimale, 2);
    assert.equal(diagnostiquer(salle({ tables, appartenances, tours: 3 })).redondanceMinimale, 0);
  });

  // Trois affiliés de A parmi neuf : un non-affilié en rencontre 3 au plus,
  // 3 − 1 = 2 ; un affilié 2, 2 − 1 = 1. Le plafond a priori, 8, ne borne
  // rien ici.
  test('les affiliés autres que soi bornent la redondance, et le plus grand l’emporte', () => {
    const configuration = salle({
      tables: [[10, 3], [20, 3], [30, 3]],
      appartenances: [...fois(3, 'A'), ...fois(6, null)],
      tours: 4,
    });
    assert.equal(diagnostiquer(configuration).redondanceMinimale, 2);
  });

  // 1 et 2, sans appartenance, ancrés à la table 10 de 3 sièges ; quatre
  // mobiles de X, deux tours. Un mobile rencontre au plus 4 personnes, les
  // deux ancrés au tour qu'il passe à la table 10, deux mobiles à l'autre,
  // mais seulement 3 affiliés autres que lui : 3 − 1 = 2. Un ancré plafonne à
  // 1 + 2 × 1 = 3 : 3 − 1 = 2.
  test('un affilié ne se compte pas parmi les affiliés qu’il rencontre', () => {
    const configuration = salle({
      tables: [[10, 3], [20, 3]],
      appartenances: [null, null, ...fois(4, 'X')],
      tours: 2,
      reservations: [ancrer(1, 10), ancrer(2, 10)],
    });
    const diagnostic = diagnostiquer(configuration);
    assert.deepEqual(diagnostic.plafondAPriori.parPersonne, [3, 3, 4, 4, 4, 4]);
    assert.equal(diagnostic.redondanceMinimale, 2);
  });

  // Petite démonstration : 8 rencontres au plus, 11 affiliés autres que soi,
  // 3 appartenances : qui rencontre 8 affiliés en recroise au moins
  // 8 − 3 = 5. Le plan parfait (§ 15.3) fait rencontrer 8 affiliés à chacun,
  // tous d'une autre appartenance que la sienne : A(p) = 2, et chacun mesure
  // 6, au-dessus du plancher, qui suppose les trois appartenances croisées.
  test('petite : 5 redondances au moins pour qui rencontre 8 affiliés ; le plan parfait en mesure 6', () => {
    const configuration = construire('petite');
    assert.equal(diagnostiquer(configuration).redondanceMinimale, 5);
    const instance = normaliser(configuration);
    const mesures = mesurer(instance, indexerPlan(instance, PLAN_PARFAIT_PETITE));
    assert.deepEqual(mesures.affilies, fois(12, 8));
    assert.deepEqual(mesures.redondance, fois(12, 6));
  });

  test('sans affilié, la redondance minimale est null', () => {
    const configuration = salle({
      tables: [[10, 3], [20, 3]],
      appartenances: fois(6, null),
      tours: 4,
    });
    assert.equal(diagnostiquer(configuration).redondanceMinimale, null);
  });
});

describe('diagnostic : ancrage et retours imposés (§ 5.4, § 5.6)', () => {
  // Table 30 : deux ancrés pour deux sièges, gelée ; table 10 : deux ancrés
  // pour trois sièges, le troisième libre : elle n'est pas gelée ; table 20 :
  // aucun. L'ordre est celui de la configuration.
  test('chaque table, dans l’ordre de la configuration, avec ses ancrés et son gel', () => {
    const configuration = salle({
      tables: [[30, 2], [10, 3], [20, 2]],
      appartenances: fois(5, null),
      tours: 2,
      reservations: [ancrer(1, 30), ancrer(2, 30), ancrer(3, 10), ancrer(4, 10)],
    });
    assert.deepEqual(diagnostiquer(configuration).ancrage, [
      { table: 30, ancres: 2, capacite: 2, gelee: true, moitie: false },
      { table: 10, ancres: 2, capacite: 3, gelee: false, moitie: true },
      { table: 20, ancres: 0, capacite: 2, gelee: false, moitie: false },
    ]);
  });

  // Quatre tours. 1, ancré : 3 retours. 2, réservé aux tours 1 et 3 à la
  // table 20 : 1. 3, réservé à deux tables différentes : 0. 4, exclu : sa
  // réservation est suspendue. 5, réservé aux quatre tours à la table 10,
  // donc ancré (§ 4.2) : 3. En tout 7.
  test('retours imposés : R − 1 par ancré, un par tour réservé de plus à une même table, aucun pour un exclu', () => {
    const configuration = salle({
      tables: [[10, 4], [20, 4]],
      appartenances: fois(6, null),
      tours: 4,
      reservations: [
        ancrer(1, 10),
        fixer(2, 20, 1),
        fixer(2, 20, 3),
        fixer(3, 10, 1),
        fixer(3, 20, 2),
        ancrer(4, 20),
        fixer(5, 10, 1),
        fixer(5, 10, 2),
        fixer(5, 10, 3),
        fixer(5, 10, 4),
      ],
      exclus: [4],
    });
    const diagnostic = diagnostiquer(configuration);
    assert.equal(diagnostic.retoursImposes, 7);
    // 1, 2 et 5 portent des retours imposés ; 3 n'en porte aucun.
    assert.equal(diagnostic.ancragesImposantRetours, 3);
    assert.deepEqual(
      diagnostic.ancrage.map(({ ancres }) => ancres),
      [2, 0],
    );
  });

  // Ancrés 1 et 2 à la table 10 pendant 3 tours : 2 × 2 retours. Chaque plan
  // qui honore les réservations mesure les mêmes 4.
  test('les retours imposés sont ceux que mesure chaque plan qui honore les réservations', () => {
    const configuration = salle({
      tables: [[10, 2], [20, 2], [30, 2]],
      appartenances: ['X', 'X', 'X', 'Y', 'Y', null],
      tours: 3,
      reservations: [ancrer(1, 10), ancrer(2, 10), fixer(4, 20, 1), fixer(5, 20, 1)],
    });
    const { retoursImposes } = diagnostiquer(configuration);
    assert.equal(retoursImposes, 4);
    const instance = normaliser(configuration);
    const mesures = new Set();
    const plans = enumererPlans(instance, (tableDe) => {
      mesures.add(mesurer(instance, tableDe).totalRetoursImposes);
    });
    assert.ok(plans > 0, 'aucun plan énuméré');
    assert.deepEqual([...mesures], [retoursImposes]);
  });
});

describe('diagnostic : population vide, forme, refus', () => {
  // Aucun participant : chaque agrégat d'une population vide est null
  // (§ 5.4), chaque compte est un vrai 0. Les mêmes chiffres quand tous sont
  // exclus : leurs réservations sont suspendues (§ 4.4).
  test('une population vide rend null, jamais 0, là où rien ne se mesure', () => {
    const attendu = {
      placesManquantes: 0,
      plafondAPriori: { min: null, max: null, parPersonne: [], repartition: [] },
      collisions: [],
      redondanceMinimale: null,
      remedes: { toursSansRedondance: null },
      animateursMemeAppartenance: false,
      redondanceImposeeParAnimateurs: 0,
      uneSeuleAppartenance: false,
      collisionPartout: false,
      ancrage: [{ table: 10, ancres: 0, capacite: 4, gelee: false, moitie: false }],
      retoursImposes: 0,
      ancragesImposantRetours: 0,
      ecartItineraire: null,
    };
    // Les mêmes chiffres, séparation active ou non : sans présent, aucune
    // appartenance n'est portée par chacun, et aucune table n'est forcée.
    for (const contraintes of [SANS_CONTRAINTE, TOUTES]) {
      const vide = salle({ tables: [[10, 4]], appartenances: [], tours: 2, contraintes });
      assert.deepEqual(diagnostiquer(vide), attendu);
      const tousExclus = salle({
        tables: [[10, 4]],
        appartenances: ['X', 'X', 'X'],
        tours: 2,
        reservations: [ancrer(1, 10), ancrer(2, 10)],
        exclus: [1, 2, 3],
        contraintes,
      });
      assert.deepEqual(diagnostiquer(tousExclus), attendu);
    }
  });

  test('le diagnostic ne modifie pas la configuration', () => {
    const configuration = construire('grande');
    const avant = structuredClone(configuration);
    diagnostiquer(configuration);
    assert.deepEqual(configuration, avant);
  });

  // Trois ancrés pour deux sièges : normaliser refuse, et le diagnostic
  // laisse passer le refus.
  test('une configuration que normaliser refuse lève le même refus', () => {
    const configuration = salle({
      tables: [[10, 2], [20, 2]],
      appartenances: fois(4, null),
      tours: 2,
      reservations: [ancrer(1, 10), ancrer(2, 10), ancrer(3, 10)],
    });
    assert.throws(
      () => diagnostiquer(configuration),
      (erreur) => erreur instanceof ErreurConfiguration && erreur.code === 'SURRESERVATION',
    );
  });
});

describe('diagnostic : répartition du plafond a priori (§ 5.6)', () => {
  // 1 et 2, sans appartenance, ancrés à la table 10 de 3 sièges ; quatre
  // mobiles de X, deux tours : les ancrés plafonnent à 3, les mobiles à 4
  // (voir « un affilié ne se compte pas parmi les affiliés qu'il
  // rencontre »).
  test('une ligne par valeur, croissante, ancrés et mobiles comptés à part', () => {
    const configuration = salle({
      tables: [[10, 3], [20, 3]],
      appartenances: [null, null, ...fois(4, 'X')],
      tours: 2,
      reservations: [ancrer(1, 10), ancrer(2, 10)],
    });
    assert.deepEqual(diagnostiquer(configuration).plafondAPriori.repartition, [
      { valeur: 3, ancres: 2, mobiles: 0 },
      { valeur: 4, ancres: 0, mobiles: 4 },
    ]);
  });

  // Un partiellement fixé compte parmi les mobiles (§ 5.4) : 1, réservé à la
  // table 10 au seul tour 1, plafonne comme les autres, la table 10 restant
  // libre à l'autre tour. Six personnes sur deux tables de 3, deux tours :
  // chacun rencontre 2 voisins par tour, 4 en tout.
  test('un partiellement fixé se compte parmi les mobiles', () => {
    const configuration = salle({
      tables: [[10, 3], [20, 3]],
      appartenances: fois(6, null),
      tours: 2,
      reservations: [fixer(1, 10, 1)],
    });
    assert.deepEqual(diagnostiquer(configuration).plafondAPriori.repartition, [
      { valeur: 4, ancres: 0, mobiles: 6 },
    ]);
  });
});

describe('diagnostic : tables manquantes (§ 5.6, § 15.3)', () => {
  // Le remède compte des tables de la plus grande capacité présente ; le
  // plancher, capacités relâchées, n'en dépend pas. Tables de 2 et de 6 :
  // quatre membres de X pour deux tables, deux de plus les séparent.
  test('des tables de capacités inégales : le compte ne lit que le plancher', () => {
    const configuration = salle({
      tables: [[10, 2], [20, 6]],
      appartenances: [...fois(4, 'X'), ...fois(4, null)],
      tours: 2,
    });
    assert.deepEqual(
      diagnostiquer(configuration).collisions.map(({ tablesManquantes }) => tablesManquantes),
      [2],
    );
  });

  // Deux groupes : Y, réservé ensemble à la table 10 au tour 2, n'a pas de
  // remède ; X, cinq membres libres sur trois tables, en a un, 2 tables.
  test('un groupe sans remède n’empêche pas le remède d’un autre', () => {
    const configuration = salle({
      tables: [[10, 4], [20, 4], [30, 4]],
      appartenances: [...fois(5, 'X'), 'Y', 'Y', null],
      tours: 2,
      reservations: [fixer(6, 10, 2), fixer(7, 10, 2)],
    });
    assert.deepEqual(
      diagnostiquer(configuration).collisions.map(({ groupe, tablesManquantes }) => [groupe, tablesManquantes]),
      [
        ['X', 2],
        ['Y', null],
      ],
    );
  });
});

describe('diagnostic : remède en tours (§ 5.6)', () => {
  // 28 personnes, dix appartenances de 2 et huit de 1, G = 18 ; quatre
  // tables de 7. Un participant rencontre au plus 6 personnes par tour. En
  // 4 tours : min(24, 27 affiliés autres que soi) − 18 = 6. En 3 tours :
  // 18 − 18 = 0.
  const DIX_PAIRES_HUIT_SEULS = [
    ...Array.from({ length: 10 }, (_, g) => fois(2, `Grisaille ${g + 1}`)).flat(),
    ...Array.from({ length: 8 }, (_, g) => `Club des Merles ${g + 1}`),
  ];
  const QUATRE_TABLES_DE_SEPT = [[10, 7], [20, 7], [30, 7], [40, 7]];

  test('28 personnes en 18 appartenances, quatre tours : 6 redondances, aucune en 3 tours', () => {
    assert.equal(DIX_PAIRES_HUIT_SEULS.length, 28);
    const configuration = salle({
      tables: QUATRE_TABLES_DE_SEPT,
      appartenances: DIX_PAIRES_HUIT_SEULS,
      tours: 4,
    });
    const diagnostic = diagnostiquer(configuration);
    assert.equal(diagnostic.redondanceMinimale, 6);
    assert.deepEqual(diagnostic.remedes, { toursSansRedondance: 3 });
  });

  // La réservation du tour 4 ne tient pas dans une configuration de 3
  // tours : la sonde la retire, et celle d'un exclu aussi, au lieu de lever
  // RESERVATION_TOUR. La réservation de portée « tous » couvre les trois.
  test('une réservation d’un tour au-delà de R′ se retire de la sonde, sans lever', () => {
    const configuration = salle({
      tables: QUATRE_TABLES_DE_SEPT,
      appartenances: [...DIX_PAIRES_HUIT_SEULS, 'Club des Merles 1'],
      tours: 4,
      reservations: [fixer(1, 10, 4), ancrer(2, 20), fixer(29, 30, 4)],
      exclus: [29],
    });
    assert.deepEqual(diagnostiquer(configuration).remedes, { toursSansRedondance: 3 });
  });

  // Trois tables de 2, P1 sans appartenance, P2 et P3 de la même. En 3
  // tours, P1, fixé à la table 3 à chaque tour, y retrouve P3 au tour 2 et
  // P2 au tour 3 : 2 − 1 = 1. En 2 tours, P2 et P3 occupent la table 2 au
  // tour 1 et P1 n'y retrouve que P3 au tour 2 : 1 − 1 = 0. Le remède, 2,
  // tient aux réservations des tours 1 et 2, que la sonde garde.
  test('les réservations d’un tour jusqu’à R′ restent dans la sonde', () => {
    const configuration = salle({
      tables: [[1, 2], [2, 2], [3, 2]],
      appartenances: [null, 'Grisaille', 'Grisaille'],
      tours: 3,
      reservations: [
        fixer(1, 3, 1), fixer(1, 3, 2), fixer(1, 3, 3),
        fixer(2, 2, 1), fixer(2, 2, 2), fixer(2, 3, 3),
        fixer(3, 2, 1), fixer(3, 3, 2), fixer(3, 2, 3),
      ],
      contraintes: TOUTES,
    });
    const diagnostic = diagnostiquer(configuration);
    assert.equal(diagnostic.redondanceMinimale, 1);
    assert.deepEqual(diagnostic.remedes, { toursSansRedondance: 2 });
  });

  // Deux tables de 3, P1 sans appartenance ancré à la table 10, P2 et P3 de
  // la même appartenance, fixés aux tables 10 et 20 aux tours 1 et 2. En 3
  // tours, le tour 3 libre réunit P1 et P3 : 2 − 1 = 1. En 2 tours, P1 ne
  // rencontre que P2 : 0. Le remède, 2, tient à l'ancrage, qui couvre les
  // tours de la sonde, et aux réservations du tour 2, R′ lui-même.
  test('l’ancrage et les réservations du tour R′ lui-même restent dans la sonde', () => {
    const configuration = salle({
      tables: [[10, 3], [20, 3]],
      appartenances: [null, 'Grisaille', 'Grisaille'],
      tours: 3,
      reservations: [ancrer(1, 10), fixer(2, 10, 1), fixer(3, 20, 1), fixer(2, 10, 2), fixer(3, 20, 2)],
    });
    const diagnostic = diagnostiquer(configuration);
    assert.equal(diagnostic.redondanceMinimale, 1);
    assert.deepEqual(diagnostic.remedes, { toursSansRedondance: 2 });
  });

  // Deux appartenances de 14 : en un seul tour, 6 − 2 = 4 ; aucun R′ ne
  // l'annule.
  test('deux appartenances de 14 : aucun nombre de tours n’annule la redondance', () => {
    const configuration = salle({
      tables: QUATRE_TABLES_DE_SEPT,
      appartenances: [...fois(14, 'Grisaille'), ...fois(14, 'Club des Merles')],
      tours: 4,
    });
    const diagnostic = diagnostiquer(configuration);
    assert.equal(diagnostic.redondanceMinimale, 22);
    assert.deepEqual(diagnostic.remedes, { toursSansRedondance: null });
  });

  test('sans affilié, ou à redondance déjà nulle : aucun remède', () => {
    const sansAffilie = salle({ tables: QUATRE_TABLES_DE_SEPT, appartenances: fois(28, null), tours: 4 });
    assert.deepEqual(diagnostiquer(sansAffilie).remedes, { toursSansRedondance: null });
    const dejaNulle = salle({ tables: QUATRE_TABLES_DE_SEPT, appartenances: DIX_PAIRES_HUIT_SEULS, tours: 3 });
    assert.equal(diagnostiquer(dejaNulle).redondanceMinimale, 0);
    assert.deepEqual(diagnostiquer(dejaNulle).remedes, { toursSansRedondance: null });
  });
});

describe('diagnostic : une seule appartenance (§ 15.4)', () => {
  const tables = [[10, 3], [20, 3], [30, 3], [40, 3]];

  test('douze personnes d’une appartenance, séparation active : annoncée ; désactivée : non', () => {
    const active = salle({ tables, appartenances: fois(12, 'Grisaille'), tours: 4, contraintes: SEPARER });
    assert.equal(diagnostiquer(active).uneSeuleAppartenance, true);
    const inactive = salle({ tables, appartenances: fois(12, 'Grisaille'), tours: 4, contraintes: TOUTES_SAUF_SEPARER });
    assert.equal(diagnostiquer(inactive).uneSeuleAppartenance, false);
  });

  // Les présents sans appartenance se séparent des trois membres : la
  // séparation y garde un sens.
  test('la même appartenance portée par 3 des 12 : faux', () => {
    const configuration = salle({
      tables,
      appartenances: [...fois(3, 'Grisaille'), ...fois(9, null)],
      tours: 4,
      contraintes: SEPARER,
    });
    assert.equal(diagnostiquer(configuration).uneSeuleAppartenance, false);
  });

  // L'appartenance du seul membre exclu ne compte pas : les présents n'en
  // portent qu'une.
  test('un exclu d’une autre appartenance ne compte pas', () => {
    const configuration = salle({
      tables,
      appartenances: [...fois(11, 'Grisaille'), 'Club des Merles'],
      tours: 4,
      contraintes: SEPARER,
      exclus: [12],
    });
    assert.equal(diagnostiquer(configuration).uneSeuleAppartenance, true);
  });
});

describe('diagnostic : collision à chaque table (§ 7.5)', () => {
  // Douze personnes en deux appartenances de six, quatre tables de 3 : une
  // table reçoit au moins 12 − 9 = 3 personnes, plus que G + U = 2.
  const DEUX_FOIS_SIX = [...fois(6, 'Grisaille'), ...fois(6, 'Club des Merles')];
  const QUATRE_DE_TROIS = [[10, 3], [20, 3], [30, 3], [40, 3]];

  test('deux appartenances de six sur quatre tables de 3 : vrai ; désactivée, faux ; une cinquième table, faux', () => {
    const active = salle({ tables: QUATRE_DE_TROIS, appartenances: DEUX_FOIS_SIX, tours: 4, contraintes: SEPARER });
    assert.equal(diagnostiquer(active).collisionPartout, true);
    const inactive = salle({
      tables: QUATRE_DE_TROIS,
      appartenances: DEUX_FOIS_SIX,
      tours: 4,
      contraintes: TOUTES_SAUF_SEPARER,
    });
    assert.equal(diagnostiquer(inactive).collisionPartout, false);
    // Une table de 3 de plus : chaque table peut rester vide, 12 − 12 = 0.
    const cinqTables = salle({
      tables: [...QUATRE_DE_TROIS, [50, 3]],
      appartenances: DEUX_FOIS_SIX,
      tours: 4,
      contraintes: SEPARER,
    });
    assert.equal(diagnostiquer(cinqTables).collisionPartout, false);
  });

  // Trois membres de chacune des trois appartenances par table de 3 : un
  // plan sans collision existe, le plan parfait.
  test('la petite : faux', () => {
    assert.equal(diagnostiquer(construire('petite')).collisionPartout, false);
  });

  // Un présent sans appartenance : 6 − 3 = 3 places au moins par table, et
  // G + U = 3 personnes s'y assoient sans collision.
  test('un présent sans appartenance peut rompre la preuve : faux', () => {
    const configuration = salle({
      tables: [[10, 3], [20, 3]],
      appartenances: ['Grisaille', 'Grisaille', 'Grisaille', 'Club des Merles', 'Club des Merles', null],
      tours: 2,
      contraintes: SEPARER,
    });
    assert.equal(diagnostiquer(configuration).collisionPartout, false);
  });

  // Sept personnes pour six sièges : aucun plan n'assied chacun, rien ne se
  // prouve. Sans table, rien non plus.
  test('des places manquantes, ou aucune table : faux', () => {
    const tropPetite = salle({
      tables: [[10, 3], [20, 3]],
      appartenances: [...fois(4, 'Grisaille'), ...fois(3, 'Club des Merles')],
      tours: 2,
      contraintes: SEPARER,
    });
    assert.equal(diagnostiquer(tropPetite).placesManquantes, 1);
    assert.equal(diagnostiquer(tropPetite).collisionPartout, false);
    const sansTable = salle({ tables: [], appartenances: [], tours: 2, contraintes: SEPARER });
    assert.equal(diagnostiquer(sansTable).collisionPartout, false);
  });

  // Deux appartenances de trois, deux tables de 3, deux tours : 6 − 3 = 3
  // > 2. L'énumération le confirme sans lire le diagnostic : chacun des
  // C(6, 3)² = 400 plans porte une violation de séparation à chaque table de
  // chaque tour.
  test('deux appartenances de trois sur deux tables de 3 : vrai, et chacun des 400 plans le confirme', () => {
    const configuration = salle({
      tables: [[10, 3], [20, 3]],
      appartenances: [...fois(3, 'Grisaille'), ...fois(3, 'Club des Merles')],
      tours: 2,
      contraintes: SEPARER,
    });
    assert.equal(diagnostiquer(configuration).collisionPartout, true);
    const instance = normaliser(configuration);
    const fautes = [];
    const plans = enumererPlans(instance, (tableDe) => {
      const cases = conflitsParTable(instance, tableDe).flat();
      if (cases.length !== 4) fautes.push(`${cases.length} cases`);
      for (const { table, regles } of cases) {
        if (regles.every(({ regle }) => regle !== 'separerAppartenances')) {
          fautes.push(`table ${table} sans collision : ${Array.from(tableDe)}`);
        }
      }
    });
    assert.equal(plans, 400);
    assert.deepEqual(fautes, []);
  });
});

describe('diagnostic : ancrage par table (§ 5.6)', () => {
  test('trois ancrés pour trois sièges : gelée, non à moitié ; deux pour quatre : à moitié', () => {
    const configuration = salle({
      tables: [[10, 3], [20, 4], [30, 4]],
      appartenances: fois(9, null),
      tours: 2,
      reservations: [ancrer(1, 10), ancrer(2, 10), ancrer(3, 10), ancrer(4, 20), ancrer(5, 20), ancrer(6, 30)],
    });
    assert.deepEqual(diagnostiquer(configuration).ancrage, [
      { table: 10, ancres: 3, capacite: 3, gelee: true, moitie: false },
      { table: 20, ancres: 2, capacite: 4, gelee: false, moitie: true },
      { table: 30, ancres: 1, capacite: 4, gelee: false, moitie: false },
    ]);
  });
});
