// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Oracle exhaustif des planchers du diagnostic sous la présence par tour
// (§ 5.6, § 12.4). Sur des instances minuscules — cinq personnes au plus,
// deux tables de trois sièges au plus, trois tours au plus —, chaque masque
// de présence se diagnostique, puis chaque plan du domaine des planchers se
// mesure : chaque présent assis à chacun de ses tours de présence, chaque
// réservation active tenue, aucune capacité dépassée, chaque absent en
// réserve. Jusqu'à quatre personnes, tous les masques ; à cinq, des masques
// tirés d'une graine fixe, et, pour la salle de quatre sièges, chaque masque
// qui retire une personne au plus à chaque tour.
//
// Chaque plancher que le diagnostic garde sous absence est au plus le
// minimum de sa mesure sur l'ensemble des plans : collisions cumulées, paires
// distinctes et excédent de chaque appartenance, tours hors objectif (total,
// par tour, plus grand d'une personne) et personnes jamais servies. Les
// retours imposés égalent ceux de chaque plan. collisionPartout vrai impose
// une collision à chaque table de chaque tour de chaque plan. Un manque de
// places à un tour n'admet aucun plan, et son absence en admet un. Sous
// absence, l'écart d'itinéraire vaut null et se nomme parmi les planchers
// retirés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { FLUX, creerPcg32 } from '../demo/prng.js';
import { LIBRE, RESERVE, SANS_GROUPE, normaliser } from './configuration.js';
import { diagnostiquer } from './diagnostic.js';
import { mesurer, parcourirTours } from './indicateurs.js';

const SEPARER = {
  separerAppartenances: true,
  nouveauxVoisins: false,
  nouvelleTable: false,
  varierAppartenances: false,
};

// Graine des masques tirés à cinq personnes, et leur nombre par gabarit.
const GRAINE = 20_261_018;
const MASQUES_TIRES = 200;

const ancrer = (participant, table) => ({ participant, table, portee: 'tous' });
const fixer = (participant, table, tour) => ({ participant, table, portee: 'tour', tour });

/**
 * Un gabarit : la configuration sans présence. appartenances[j] et
 * etiquettes[j] sont celles du participant d'id j + 1 ; tables, des paires
 * [id, capacité].
 */
function gabarit({ appartenances, etiquettes = [], tables, tours, reservations = [], objectifs = [] }) {
  return {
    participants: appartenances.map((appartenance, j) => ({
      id: j + 1,
      nom: `P${j + 1}`,
      appartenance,
      ...(etiquettes[j] === undefined ? {} : { etiquettes: etiquettes[j] }),
    })),
    tables: tables.map(([id, capacite], i) => ({ id, numero: i + 1, capacite })),
    tours,
    reservations,
    contraintes: { ...SEPARER },
    ...(objectifs.length === 0 ? {} : { objectifs }),
  };
}

const objectif = (table, tour) => ({ table, tour, regle: 'ou', etiquettes: ['x'] });

// Les gabarits de l'oracle, chacun avec ce que ses masques éprouvent et la
// famille de ses masques (masques).
const GABARITS = [
  // Trois « A » et un « B », tables de 2 et de 3 ; 2 réservée à la table 10
  // au tour 1 ; la table 10 attend « x » pour la soirée, que 1, 3 et 4
  // portent : plus de couples possibles que de sièges libres.
  ['trois A et un B, un tour réservé, un objectif de soirée', gabarit({
    appartenances: ['A', 'A', 'A', 'B'],
    etiquettes: [['x'], undefined, ['x'], ['x']],
    tables: [[10, 2], [20, 3]],
    tours: 3,
    reservations: [fixer(2, 10, 1)],
    objectifs: [objectif(10, null)],
  }), 'tous'],
  // Deux « A » réservées ensemble à la table 10 aux tours 1 et 3 : un
  // excédent forcé, que leur absence à l'un de ces tours défait ; 3 ancrée
  // à la table 20 ; la table 10 attend « x » au tour 2.
  ['deux A réservées ensemble, une ancrée, un objectif de tour', gabarit({
    appartenances: ['A', 'A', null, null],
    etiquettes: [['x'], ['x'], ['x']],
    tables: [[10, 2], [20, 2]],
    tours: 3,
    reservations: [fixer(1, 10, 1), fixer(2, 10, 1), fixer(1, 10, 3), fixer(2, 10, 3), ancrer(3, 20)],
    objectifs: [objectif(10, 2)],
  }), 'tous'],
  // Quatre « A », deux tables de 2, deux tours : la collision est forcée à
  // chaque table quand chacun est présent.
  ['quatre A sur quatre sièges, deux tours', gabarit({
    appartenances: ['A', 'A', 'A', 'A'],
    tables: [[10, 2], [20, 2]],
    tours: 2,
  }), 'tous'],
  // Trois « A » et deux « B », tables de 2 et de 3 ; 4 réservée à la table
  // 20 au tour 3 ; la table 10 attend « x » pour la soirée, que 1, 2, 3 et 5
  // portent.
  ['trois A et deux B, un tour réservé, un objectif de soirée', gabarit({
    appartenances: ['A', 'A', 'A', 'B', 'B'],
    etiquettes: [['x'], ['x'], ['x'], undefined, ['x']],
    tables: [[10, 2], [20, 3]],
    tours: 3,
    reservations: [fixer(4, 20, 3)],
    objectifs: [objectif(10, null)],
  }), 'tires'],
  // Cinq « A » pour quatre sièges : un tour sans absente manque d'une place,
  // un tour à quatre présentes force la collision à chaque table.
  ['cinq A pour quatre sièges', gabarit({
    appartenances: ['A', 'A', 'A', 'A', 'A'],
    tables: [[10, 2], [20, 2]],
    tours: 3,
  }), 'uneAbsenteAuPlus'],
];

// La présence d'un motif : les tours dont le bit r − 1 est levé, undefined
// quand il les lève tous.
function presenceDuMotif(motif, R) {
  const tours = [];
  for (let r = 0; r < R; r += 1) if ((motif >> r) & 1) tours.push(r + 1);
  return tours.length === R ? undefined : tours;
}

// Les masques d'un gabarit, chacun une liste d'un motif par personne, de 1 à
// 2^R − 1, selon famille : 'tous', dans l'ordre d'un compteur ; 'tires',
// MASQUES_TIRES tirés de rng ; 'uneAbsenteAuPlus', chaque choix, tour par
// tour, d'aucune absente ou d'une seule, sauf celui qui retirerait une même
// personne de chaque tour.
function masques(famille, N, R, rng) {
  const motifs = (1 << R) - 1;
  if (famille === 'uneAbsenteAuPlus') {
    const rendus = [];
    const absente = new Array(R).fill(-1);
    const choisir = (r) => {
      if (r === R) {
        const masque = Array.from({ length: N }, (_, p) => absente.reduce((motif, q, tour) => (q === p ? motif & ~(1 << tour) : motif), motifs));
        if (masque.every((motif) => motif !== 0)) rendus.push(masque);
        return;
      }
      for (let p = -1; p < N; p += 1) {
        absente[r] = p;
        choisir(r + 1);
      }
    };
    choisir(0);
    return rendus;
  }
  if (famille === 'tous') {
    const tous = [];
    const courant = new Array(N).fill(1);
    for (;;) {
      tous.push([...courant]);
      let i = 0;
      while (i < N && courant[i] === motifs) {
        courant[i] = 1;
        i += 1;
      }
      if (i === N) return tous;
      courant[i] += 1;
    }
  }
  return Array.from({ length: MASQUES_TIRES }, () => Array.from({ length: N }, () => 1 + rng.borne(motifs)));
}

/**
 * Appelle visiter(tableDe) pour chaque plan indexé du domaine des
 * planchers : un absent en réserve, un présent fixé à sa table, un présent
 * libre à une table, aucune capacité dépassée. Le même tableau sert à tous
 * les plans. Rend le nombre de plans visités.
 */
function enumererPlans(instance, visiter) {
  const { N, T, R, capacite, fixe, present } = instance;
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
    if (present[i] === 0) {
      tableDe[i] = RESERVE;
      remplir(i + 1);
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

// Vrai quand chaque table porte, à chaque tour, deux personnes de même
// appartenance, lu case à case sur le plan.
function collisionAChaqueTable({ N, T, R, groupe }, tableDe) {
  for (let r = 0; r < R; r += 1) {
    for (let t = 0; t < T; t += 1) {
      const vus = new Set();
      let collision = false;
      for (let p = 0; p < N && !collision; p += 1) {
        if (tableDe[p * R + r] !== t || groupe[p] === SANS_GROUPE) continue;
        collision = vus.has(groupe[p]);
        vus.add(groupe[p]);
      }
      if (!collision) return false;
    }
  }
  return true;
}

// Le plus petit de chaque mesure que borne un plancher, sur tous les plans
// d'une instance, et ce que la boucle a vu : le nombre de plans, les retours
// imposés distincts, et vrai quand chaque plan porte une collision à chaque
// table de chaque tour.
function minimumsSurLesPlans(instance) {
  const parGroupe = new Map();
  const parTour = new Array(instance.R).fill(Infinity);
  const objectifs = { horsObjectif: Infinity, jamaisServies: Infinity, horsObjectifMax: Infinity };
  const retoursImposes = new Set();
  let collisionPartout = true;
  const plans = enumererPlans(instance, (tableDe) => {
    const mesures = mesurer(instance, tableDe);
    for (const { groupe, collisionsCumulees, pairesDistinctes, excedent } of mesures.parGroupe) {
      const minimum = parGroupe.get(groupe) ?? { collisionsCumulees: Infinity, pairesDistinctes: Infinity, excedent: Infinity };
      minimum.collisionsCumulees = Math.min(minimum.collisionsCumulees, collisionsCumulees);
      minimum.pairesDistinctes = Math.min(minimum.pairesDistinctes, pairesDistinctes);
      minimum.excedent = Math.min(minimum.excedent, excedent);
      parGroupe.set(groupe, minimum);
    }
    if (mesures.objectifs !== null) {
      for (const champ of ['horsObjectif', 'jamaisServies', 'horsObjectifMax']) objectifs[champ] = Math.min(objectifs[champ], mesures.objectifs[champ]);
      const { possiblesParTour, servisParTour } = parcourirTours(instance, tableDe);
      for (let r = 0; r < instance.R; r += 1) parTour[r] = Math.min(parTour[r], possiblesParTour[r] - servisParTour[r]);
    }
    retoursImposes.add(mesures.totalRetoursImposes);
    if (collisionPartout && !collisionAChaqueTable(instance, tableDe)) collisionPartout = false;
  });
  return { plans, parGroupe, parTour, objectifs, retoursImposes, collisionPartout };
}

// Les fautes du diagnostic d'une configuration contre l'oracle, chacune en
// une ligne nommée ; comptes reçoit ce que la configuration a éprouvé.
function juger(nom, configuration, comptes) {
  const fautes = [];
  const instance = normaliser(configuration);
  const diagnostic = diagnostiquer(configuration);
  const oracle = minimumsSurLesPlans(instance);
  const manque = diagnostic.placesManquantesParTour.some((places) => places > 0);
  if (instance.absences > 0) {
    comptes.sousAbsence += 1;
    if (diagnostic.ecartItineraire !== null) fautes.push(`${nom} : écart d'itinéraire ${JSON.stringify(diagnostic.ecartItineraire)} sous absence`);
    if (JSON.stringify(diagnostic.planchersRetires) !== '["ecartItineraire"]') fautes.push(`${nom} : planchers retirés ${diagnostic.planchersRetires}`);
  }
  if (manque) {
    comptes.manques += 1;
    if (oracle.plans > 0) fautes.push(`${nom} : ${oracle.plans} plans malgré des places manquantes`);
    return fautes;
  }
  if (oracle.plans === 0) {
    fautes.push(`${nom} : aucun plan sans places manquantes`);
    return fautes;
  }
  comptes.plans += oracle.plans;
  for (const plancher of diagnostic.collisions) {
    const minimum = oracle.parGroupe.get(plancher.groupe);
    if (instance.absences > 0) comptes.collisions += 1;
    if (plancher.plancherCumulees > minimum.collisionsCumulees
      || plancher.plancherPairesDistinctes > minimum.pairesDistinctes
      || (plancher.plancherExcedent !== null && plancher.plancherExcedent > minimum.excedent)) {
      fautes.push(`${nom}, ${plancher.groupe} : plancher ${JSON.stringify(plancher)}, minimums ${JSON.stringify(minimum)}`);
    }
    if (plancher.plancherExcedent !== null && instance.absences > 0) comptes.excedents += 1;
  }
  const inevitables = diagnostic.objectifsInevitables;
  if (instance.O > 0) {
    for (const champ of ['horsObjectif', 'jamaisServies', 'horsObjectifMax']) {
      if (inevitables[champ] > oracle.objectifs[champ]) {
        fautes.push(`${nom} : ${champ} ${inevitables[champ]}, minimum ${oracle.objectifs[champ]}`);
      }
    }
    inevitables.parTour.forEach((plancher, r) => {
      if (plancher > oracle.parTour[r]) fautes.push(`${nom} : tour ${r + 1}, plancher ${plancher}, minimum ${oracle.parTour[r]}`);
    });
    if (inevitables.horsObjectif > 0 && instance.absences > 0) comptes.objectifs += 1;
  }
  if (oracle.retoursImposes.size !== 1 || !oracle.retoursImposes.has(diagnostic.retoursImposes)) {
    fautes.push(`${nom} : retours imposés ${diagnostic.retoursImposes}, mesurés ${[...oracle.retoursImposes]}`);
  }
  if (diagnostic.retoursImposes > 0 && instance.absences > 0) comptes.retours += 1;
  if (diagnostic.collisionPartout) {
    if (instance.absences > 0) comptes.collisionPartout += 1;
    if (!oracle.collisionPartout) fautes.push(`${nom} : collisionPartout vrai, un plan laisse une table sans collision`);
  }
  return fautes;
}

// Ce que l'oracle doit avoir éprouvé sous absence, pour que ses propriétés
// disent quelque chose (§ 14.2). Chaque plancher est posé sous le compte que
// donnent les gabarits et la graine écrite, en commentaire.
const PLANCHERS = Object.freeze([
  ['masques à une absence au moins', 'sousAbsence', 4_800], // 5 290
  ['masques à places manquantes', 'manques', 80], // 91
  ['plans mesurés', 'plans', 230_000], // 261 596
  ['planchers de collisions sous absence', 'collisions', 2_500], // 2 850
  ["planchers d'excédent sous absence", 'excedents', 170], // 195
  ['planchers des objectifs sous absence', 'objectifs', 1_500], // 1 754
  ['retours imposés sous absence', 'retours', 1_600], // 1 875
  ['collision forcée partout sous absence', 'collisionPartout', 100], // 120
]);

describe('diagnostic : oracle exhaustif des planchers sous la présence par tour (§ 5.6, § 12.4)', () => {
  test('chaque plancher gardé sous absence minore sa mesure sur chaque plan ; collisionPartout tient sur chacun ; les places manquantes par tour décident qu’un plan existe', () => {
    const rng = creerPcg32(GRAINE, FLUX.DEMO);
    const comptes = { sousAbsence: 0, manques: 0, plans: 0, collisions: 0, excedents: 0, objectifs: 0, retours: 0, collisionPartout: 0 };
    const fautes = [];
    for (const [libelle, base, famille] of GABARITS) {
      const N = base.participants.length;
      for (const motifs of masques(famille, N, base.tours, rng)) {
        const configuration = {
          ...base,
          participants: base.participants.map((personne, j) => {
            const presence = presenceDuMotif(motifs[j], base.tours);
            return presence === undefined ? personne : { ...personne, presence };
          }),
        };
        fautes.push(...juger(`${libelle}, motifs ${motifs.join(' ')}`, configuration, comptes));
      }
    }
    // Les vingt premières fautes suffisent à désigner un défaut ; le message
    // en donne le nombre.
    assert.deepEqual(fautes.slice(0, 20), [], `${fautes.length} fautes`);
    const sousLePlancher = PLANCHERS
      .filter(([, cle, plancher]) => comptes[cle] < plancher)
      .map(([nom, cle, plancher]) => `${nom} : ${comptes[cle]}, plancher ${plancher}`);
    assert.deepEqual(sousLePlancher, [], JSON.stringify(comptes));
  });
});
