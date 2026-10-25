// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du solveur du travailleur (§ 5.6), sur le vrai HiGHS, chargé
// depuis node_modules par le chargeur du module : les minimums exacts de
// tours inventés, comptés à la main ou recoupés par le plancher des étoiles
// (P1) ; la traduction des statuts de HiGHS en issues, sur des triplets
// synthétiques ; une limite de temps réelle, time_limit à 0, déterministe —
// jamais un « cas dur sous une fraction de seconde », dont l'issue dépend de
// la machine ; un échec par la limite de nœuds ; le cache des textes LP ; et
// le protocole des messages. Les charges se construisent ici, sur des noms
// inventés.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { describe, test } from '../../test/lanceur.js';
import { creerCharge } from '../stockage/document.js';
import { diagnostiquerCharge } from './diagnostic.js';
import { lpTour } from './modele_tour.js';
import { LIMITE_PAR_TOUR, entreesDuSolveur } from './planchers_exacts.js';
import { planchersConflits } from './planchers_conflits.js';
import { CAPACITE_DU_CACHE, brancherTravailleurSolveur, chargerHighs, issueDuStatut, issueDuTour, resoudreTour } from './solveur_travailleur.js';

const MERLES = 'Club des Merles';
const HERONS = 'Cercle des Hérons';
const LOUTRES = 'Atelier des Loutres';
const CASTORS = 'Société des Castors';

const highs = await chargerHighs();
const CODES = highs.constants.modelStatus;

/**
 * Une charge construite : effectifs, [organisation, nombre de membres], dans
 * l'ordre où les membres reçoivent leurs identifiants à partir de 1 ;
 * capacites, une table par capacité ; conflits, [organisation, organisations
 * nommées] : le premier membre de la première nomme les autres ;
 * reservations, [participant, table], à tous les tours.
 */
function chargeDe({ effectifs, capacites, tours = 1, conflits = [], reservations = [] }) {
  const charge = creerCharge({ id: 'evt-solveur', nom: 'Soirée des Grèbes', siegesParDefaut: 8, tours });
  charge.participants = effectifs
    .flatMap(([organisation, n]) => Array(n).fill(organisation))
    .map((organisation, rang) => ({
      id: rang + 1,
      nom: `Grèbe${rang + 1}`,
      prenom: 'Iris',
      organisation,
      courriel: null,
      titrePressenti: null,
      notes: null,
      exclu: false,
    }));
  for (const [organisation, nommees] of conflits) {
    charge.participants.find((membre) => membre.organisation === organisation).conflits = nommees;
  }
  charge.tables = capacites.map((sieges, t) => ({ id: t + 1, numero: t + 1, sieges, forme: 'ronde', position: { x: 300 * t, y: 0 } }));
  charge.reservations = reservations.map(([participant, table]) => ({ participant, table, siege: null, portee: 'tous', tour: null }));
  charge.reglages.separerOrganisations = true;
  charge.prochainsIds = { participant: charge.participants.length + 1, table: capacites.length + 1, proposition: 1 };
  return charge;
}

const premierTour = (charge) => entreesDuSolveur(charge).tours[0];
const parGroupe = (charge) => diagnostiquerCharge(charge).diagnostic.collisions.reduce((somme, { plancherCumulees }) => somme + plancherCumulees, 0);

const ETOILE_20_13 = (tours = 1) => chargeDe({ effectifs: [[MERLES, 20], [HERONS, 13]], capacites: Array(22).fill(8), tours, conflits: [[MERLES, [HERONS]]] });
const CAPACITES_11_11_6_5 = [11, 11, 6, 5];

// Deux organisations en conflit, 3 et 2 membres, deux tables de 3 : les 3
// à une table, 3 collisions, les 2 à l'autre, 1.
const PETIT = { r: 0, T: 2, s: [3, 3], unites: [{ groupe: 0, m: 3, a: [0, 0] }, { groupe: 1, m: 2, a: [0, 0] }], remplissage: 0, conflits: [[0, 1]], infaisable: null };

// Un problème inventé de partage de sommes sur des binaires, que HiGHS ne
// résout pas à la racine : sous mip_max_nodes à 0, la limite de nœuds.
function partageDeSommes() {
  let graine = 7;
  const tirer = () => (graine = (graine * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const lignes = [];
  for (let i = 0; i < 4; i += 1) {
    const poids = Array.from({ length: 30 }, () => Math.floor(tirer() * 100));
    const moitie = Math.floor(poids.reduce((somme, p) => somme + p, 0) / 2);
    lignes.push(` r${i}: ${poids.map((p, j) => `${p} x${j}`).join(' + ')} + p${i} - q${i} = ${moitie}`);
  }
  const ecarts = Array.from({ length: 4 }, (_, i) => `p${i} + q${i}`).join(' + ');
  const binaires = Array.from({ length: 30 }, (_, j) => `x${j}`).join(' ');
  return ['Minimize', ` obj: ${ecarts}`, 'Subject To', ...lignes, 'Binary', ` ${binaires}`, 'End', ''].join('\n');
}

// Un HiGHS qui sert le vrai solveur, sauf time_limit forcé à 0 pour tout
// texte qui porte un objectif (mode AC) : la résolution (A) qui suit tourne
// normalement.
const highsAcALimite = {
  constants: highs.constants,
  withModel: (source, operation) =>
    highs.withModel(source, (modele) => {
      const options = modele.options;
      const ac = !/^ obj: 0 /m.test(source.data);
      return operation({
        options: { set: (reglages) => options.set(ac ? { ...reglages, time_limit: 0 } : reglages) },
        run: () => modele.run(),
        getModelStatus: () => modele.getModelStatus(),
        info: modele.info,
      });
    }),
};

describe('issueDuTour : le minimum exact d’un tour, par le vrai HiGHS', () => {
  test('20 contre 13 sur 22 tables de 8 : 11, le plancher de l’étoile (P1)', () => {
    const charge = ETOILE_20_13();
    const issue = issueDuTour(highs, premierTour(charge));
    assert.equal(issue.minimum, 11);
    assert.equal(planchersConflits(charge)[0].parTour[0], 11);
    assert.deepEqual({ ...issue, duree: 0 }, { faisable: true, minimum: 11, auMoins: null, cause: null, duree: 0, cache: false });
  });

  test('un centre de 27 contre 10, 13 et 13 : 24, le plancher de l’étoile (P1)', () => {
    const charge = chargeDe({
      effectifs: [[HERONS, 10], [MERLES, 27], [LOUTRES, 13], [CASTORS, 13]],
      capacites: Array(22).fill(8),
      conflits: [[MERLES, [HERONS, LOUTRES, CASTORS]]],
    });
    assert.equal(issueDuTour(highs, premierTour(charge)).minimum, 24);
    assert.equal(planchersConflits(charge)[0].parTour[0], 24);
  });

  test('un triangle 12, 12, 12 sur 9 tables de 8 : 54, là où P1 se tait et la somme par groupe dit 9', () => {
    const charge = chargeDe({
      effectifs: [[MERLES, 12], [HERONS, 12], [LOUTRES, 12]],
      capacites: Array(9).fill(8),
      conflits: [[MERLES, [HERONS, LOUTRES]], [HERONS, [LOUTRES]]],
    });
    assert.equal(issueDuTour(highs, premierTour(charge)).minimum, 54);
    assert.deepEqual(planchersConflits(charge), []);
    assert.equal(parGroupe(charge), 9);
  });

  test('20 et 13 sans conflit sur des tables de 11, 11, 6 et 5 : les capacités lient, 63 contre 55 par groupe', () => {
    const charge = chargeDe({ effectifs: [[MERLES, 20], [HERONS, 13]], capacites: CAPACITES_11_11_6_5 });
    assert.equal(issueDuTour(highs, premierTour(charge)).minimum, 63);
    assert.equal(parGroupe(charge), 55);
  });

  test('les mêmes en conflit : aucun placement sans conflit, que le solveur prouve', () => {
    const charge = chargeDe({ effectifs: [[MERLES, 20], [HERONS, 13]], capacites: CAPACITES_11_11_6_5, conflits: [[MERLES, [HERONS]]] });
    assert.deepEqual({ ...issueDuTour(highs, premierTour(charge)), duree: 0 }, {
      faisable: false,
      minimum: null,
      auMoins: null,
      cause: 'solveur',
      duree: 0,
      cache: false,
    });
  });

  test('un réservé ferme sa table à l’organisation en conflit : 3 à sa table, 1 à l’autre, 4', () => {
    const charge = chargeDe({ effectifs: [[MERLES, 3], [HERONS, 2]], capacites: [4, 4], conflits: [[MERLES, [HERONS]]], reservations: [[1, 1]] });
    assert.equal(issueDuTour(highs, premierTour(charge)).minimum, 4);
  });

  test('sans résolution : des réservés en conflit à une même table, une unité sans table, aucune variable', () => {
    const reserves = chargeDe({ effectifs: [[MERLES, 3], [HERONS, 2]], capacites: [4, 4], conflits: [[MERLES, [HERONS]]], reservations: [[1, 1], [4, 1]] });
    assert.deepEqual(issueDuTour(null, premierTour(reserves)), { faisable: false, minimum: null, auMoins: null, cause: 'reserves', duree: 0, cache: false });
    const sansTable = { ...PETIT, T: 1, s: [3], unites: [{ groupe: 0, m: 0, a: [1] }, { groupe: -1, m: 1, a: [0] }] };
    assert.equal(issueDuTour(null, sansTable).cause, 'affectation');
    const reservesSeuls = chargeDe({ effectifs: [[MERLES, 3]], capacites: [4, 4], reservations: [[1, 1], [2, 1], [3, 2]] });
    assert.deepEqual(issueDuTour(null, premierTour(reservesSeuls)), { faisable: true, minimum: 1, auMoins: null, cause: null, duree: 0, cache: false });
  });

  test('time_limit à 0 : la limite, sans borne ni placement, puis la résolution (A), elle aussi à sa limite', () => {
    const issue = issueDuTour(highs, premierTour(ETOILE_20_13()), { limite: 0 });
    assert.deepEqual({ ...issue, duree: 0 }, { faisable: null, minimum: null, auMoins: null, cause: 'limite', duree: 0, cache: false });
  });

  test('(AC) à sa limite sans placement : la résolution (A) tranche la faisabilité, dans un sens ou dans l’autre', () => {
    const faisable = issueDuTour(highsAcALimite, premierTour(ETOILE_20_13()));
    assert.deepEqual({ ...faisable, duree: 0 }, { faisable: true, minimum: null, auMoins: null, cause: 'limite', duree: 0, cache: false });
    const impossible = chargeDe({ effectifs: [[MERLES, 20], [HERONS, 13]], capacites: CAPACITES_11_11_6_5, conflits: [[MERLES, [HERONS]]] });
    assert.equal(issueDuTour(highsAcALimite, premierTour(impossible)).cause, 'solveur');
  });

  test('(AC) à sa limite avec une borne et sans placement : la borne prouvée reste « au moins » quand (A) est faisable ; (A) en échec rend la faisabilité inconnue', () => {
    const estAC = (lp) => !/^ obj: 0 /m.test(lp);
    const acALimite = { statut: 'timeLimit', borne: 40.3 };
    const faisable = issueDuTour(highsFactice((lp) => (estAC(lp) ? acALimite : { statut: 'optimal', objectif: 0, borne: 0, incumbent: true })), PETIT);
    const { constante } = lpTour(PETIT);
    assert.deepEqual({ ...faisable, duree: 0 }, { faisable: true, minimum: null, auMoins: 41 + constante, cause: 'limite', duree: 0, cache: false });
    const enEchec = issueDuTour(highsFactice((lp) => (estAC(lp) ? acALimite : { statut: 'solutionLimit' })), PETIT);
    assert.deepEqual({ ...enEchec, duree: 0 }, { faisable: null, minimum: null, auMoins: 41 + constante, cause: 'echec', duree: 0, cache: false });
  });

  test('le cache garde CAPACITE_DU_CACHE textes : le plus anciennement lu sort d’abord, un texte relu revient en tête', () => {
    // Une organisation de k + 1 personnes libres sur deux tables de 1000
    // places : un texte LP par k.
    const tour = (k) => ({ r: 0, T: 2, s: [1000, 1000], unites: [{ groupe: 0, m: k + 1, a: [0, 0] }], remplissage: 0, conflits: [], infaisable: null });
    assert.notEqual(lpTour(tour(0)).lp, lpTour(tour(1)).lp);
    const factice = highsFactice(() => ({ statut: 'optimal', objectif: 0, borne: 0, incumbent: true }));
    const cache = new Map();
    for (let k = 0; k < CAPACITE_DU_CACHE; k += 1) issueDuTour(factice, tour(k), { cache });
    assert.equal(factice.resolutions, CAPACITE_DU_CACHE);
    assert.equal(issueDuTour(factice, tour(0), { cache }).cache, true);
    issueDuTour(factice, tour(CAPACITE_DU_CACHE), { cache });
    assert.equal(cache.size, CAPACITE_DU_CACHE);
    assert.equal(issueDuTour(factice, tour(0), { cache }).cache, true);
    assert.equal(issueDuTour(factice, tour(1), { cache }).cache, false);
    assert.equal(factice.resolutions, CAPACITE_DU_CACHE + 2);
  });

  test('la limite de temps par défaut, 30 s, et les réglages de HiGHS : sans trace, écart relatif nul, graine fixe', () => {
    const recus = [];
    const factice = {
      constants: highs.constants,
      withModel: (source, operation) =>
        operation({
          options: { set: (reglages) => recus.push(reglages) },
          run: () => {},
          getModelStatus: () => CODES.optimal,
          info: { get: (nom) => ({ objective_function_value: 4, mip_dual_bound: 4, primal_solution_status: 2 })[nom] },
        }),
    };
    assert.equal(issueDuTour(factice, PETIT).minimum, 4);
    assert.deepEqual(recus, [{ output_flag: false, mip_rel_gap: 0, mip_abs_gap: 0.99, random_seed: 0, time_limit: 30 }]);
  });
});

describe('resoudreTour : une résolution, en valeurs de l’objectif LP, constante non comprise', () => {
  test('optimal : la valeur et la borne s’accordent ; la durée se lit sur l’horloge donnée', () => {
    const instants = [100, 250];
    const resultat = resoudreTour(highs, lpTour(PETIT).lp, { limite: 30, instant: () => instants.shift() });
    assert.deepEqual(resultat, { statut: 'optimal', valeur: 4, borne: 4, duree: 150 });
  });

  test('la constante n’y entre pas : une organisation réservée sans variable laisse le texte inchangé', () => {
    const tour = { ...PETIT, unites: [...PETIT.unites, { groupe: 2, m: 0, a: [2, 0] }] };
    const { lp, constante } = lpTour(tour);
    assert.equal(lp, lpTour(PETIT).lp);
    assert.equal(constante, 1);
    assert.equal(resoudreTour(highs, lp, { limite: 30 }).valeur, 4);
  });

  test('infaisable : ni valeur ni borne', () => {
    const tour = premierTour(chargeDe({ effectifs: [[MERLES, 20], [HERONS, 13]], capacites: CAPACITES_11_11_6_5, conflits: [[MERLES, [HERONS]]] }));
    assert.deepEqual({ ...resoudreTour(highs, lpTour(tour).lp, { limite: 30 }), duree: 0 }, { statut: 'infaisable', valeur: null, borne: null, duree: 0 });
  });

  test('time_limit à 0 : la limite, avec des infos nulles, jamais −0', () => {
    const resultat = resoudreTour(highs, lpTour(premierTour(ETOILE_20_13())).lp, { limite: 0 });
    assert.deepEqual({ ...resultat, duree: 0 }, { statut: 'limite', valeur: null, borne: null, duree: 0 });
  });

  test('la limite de nœuds, statut que la traduction ne connaît pas : un échec', () => {
    const resultat = resoudreTour(highs, partageDeSommes(), { limite: 30, reglages: { mip_max_nodes: 0 } });
    assert.equal(resultat.statut, 'echec');
    assert.equal(resultat.valeur, null);
  });
});

describe('issueDuStatut : le statut de HiGHS traduit, sur des triplets synthétiques', () => {
  const lire = (statut, objectif, borne, incumbent = objectif !== null) => issueDuStatut(CODES, { statut, objectif, borne, incumbent });

  test('optimal : la borne arrondie au-dessus, la valeur au-dessous, d’accord ; une valeur fractionnaire ne monte pas', () => {
    assert.deepEqual(lire(CODES.optimal, 11, 11), { statut: 'optimal', valeur: 11, borne: 11 });
    assert.deepEqual(lire(CODES.optimal, 11.6, 10.99995), { statut: 'optimal', valeur: 11, borne: 11 });
    assert.deepEqual(lire(CODES.optimal, 0, 0), { statut: 'optimal', valeur: 0, borne: 0 });
  });

  test('la tolérance suit la borne : 1e-4 en relatif, une erreur de 5e-4 sur 11 ne monte pas le plancher', () => {
    assert.deepEqual(lire(CODES.optimal, 11.0004, 11.0005), { statut: 'optimal', valeur: 11, borne: 11 });
    assert.deepEqual(lire(CODES.optimal, 11.0004, 11.01), { statut: 'limite', valeur: 11, borne: 12 });
  });

  test('optimal en désaccord : lu comme une limite', () => {
    assert.deepEqual(lire(CODES.optimal, 12, 10.5), { statut: 'limite', valeur: 12, borne: 11 });
    assert.deepEqual(lire(CODES.optimal, 12, null), { statut: 'limite', valeur: 12, borne: null });
  });

  test('infaisable, ou infaisable ou non borné : infaisable', () => {
    assert.deepEqual(lire(CODES.infeasible, null, null), { statut: 'infaisable', valeur: null, borne: null });
    assert.deepEqual(lire(CODES.unboundedOrInfeasible, null, null), { statut: 'infaisable', valeur: null, borne: null });
  });

  test('limite de temps : la borne prouvée, la valeur d’un placement s’il existe ; sans borne, null et jamais −0', () => {
    assert.deepEqual(lire(CODES.timeLimit, 15, 9.2), { statut: 'limite', valeur: 15, borne: 10 });
    assert.deepEqual(lire(CODES.timeLimit, null, 9.2), { statut: 'limite', valeur: null, borne: 10 });
    assert.deepEqual(lire(CODES.timeLimit, 15, 9.2, false), { statut: 'limite', valeur: null, borne: 10 });
    assert.deepEqual(lire(CODES.timeLimit, null, null), { statut: 'limite', valeur: null, borne: null });
    const negative = lire(CODES.timeLimit, null, -0.3);
    assert.ok(Object.is(negative.borne, 0));
  });

  test('tout autre statut — limite de solutions ou de nœuds, interruption, inconnu — : un échec', () => {
    for (const statut of [CODES.solutionLimit, CODES.interrupted, CODES.unknown, CODES.iterationLimit, CODES.solveError]) {
      assert.deepEqual(lire(statut, 3, 3), { statut: 'echec', valeur: null, borne: null }, String(statut));
    }
  });
});

// Une portée de travailleur factice : envoyer(message) poste le message et
// Un HiGHS factice : chaque résolution rend les infos que donne lire(texte
// LP, rang de la résolution) — { statut, objectif, borne, incumbent } — et
// relève ses réglages dans reglages.
function highsFactice(lire) {
  const factice = { constants: highs.constants, resolutions: 0, reglages: [] };
  factice.withModel = (source, operation) => {
    const rang = factice.resolutions;
    factice.resolutions += 1;
    const { statut, objectif = null, borne = null, incumbent = false } = lire(source.data, rang);
    return operation({
      options: { set: (reglages) => factice.reglages.push(reglages) },
      run: () => {},
      getModelStatus: () => CODES[statut],
      info: { get: (nom) => ({ objective_function_value: objectif, mip_dual_bound: borne, primal_solution_status: incumbent ? 2 : 0 })[nom] },
    });
  };
  return factice;
}

// rend la promesse des messages de son numero, jusqu'à « fini » ou « faute ».
function porteeFactice() {
  const portee = { onmessage: null, recus: [] };
  const attentes = new Map();
  portee.postMessage = (message) => {
    portee.recus.push(message);
    const attente = attentes.get(message.numero);
    attente.messages.push(message);
    if (message.type === 'fini' || message.type === 'faute') attente.resoudre(attente.messages);
  };
  portee.envoyer = (message) =>
    new Promise((resoudre) => {
      attentes.set(message.numero, { messages: [], resoudre });
      portee.onmessage({ data: message });
    });
  return portee;
}

describe('brancherTravailleurSolveur : le protocole', () => {
  test('un message par tour, dans l’ordre, puis fini ; HiGHS se charge une fois, à l’adresse donnée', async () => {
    const adresses = [];
    const portee = porteeFactice();
    brancherTravailleurSolveur(portee, { chargerHighs: async (url) => (adresses.push(url), highs) });
    const { tours } = entreesDuSolveur(ETOILE_20_13(4));
    const messages = await portee.envoyer({ type: 'resoudre', numero: 1, urlWasm: 'blob:wasm', tours, limite: 30 });
    assert.deepEqual(messages.map(({ type, numero, r }) => [type, numero, r]), [['tour', 1, 0], ['tour', 1, 1], ['tour', 1, 2], ['tour', 1, 3], ['fini', 1, undefined]]);
    assert.deepEqual(messages.slice(0, 4).map(({ issue }) => issue.minimum), [11, 11, 11, 11]);
    // Quatre tours identiques : une seule résolution, trois issues du cache.
    assert.deepEqual(messages.slice(0, 4).map(({ issue }) => issue.cache), [false, true, true, true]);
    assert.equal(messages[1].issue.duree, 0);
    await portee.envoyer({ type: 'resoudre', numero: 2, urlWasm: 'blob:wasm', tours: tours.slice(0, 1), limite: 30 });
    assert.deepEqual(adresses, ['blob:wasm']);
  });

  test('un message sans limite : chaque résolution tourne sous LIMITE_PAR_TOUR', async () => {
    const factice = highsFactice(() => ({ statut: 'optimal', objectif: 4, borne: 4, incumbent: true }));
    const portee = porteeFactice();
    brancherTravailleurSolveur(portee, { chargerHighs: async () => factice });
    const messages = await portee.envoyer({ type: 'resoudre', numero: 1, tours: [PETIT] });
    assert.deepEqual(messages.map(({ type }) => type), ['tour', 'fini']);
    assert.deepEqual(factice.reglages.map(({ time_limit: limite }) => limite), [LIMITE_PAR_TOUR]);
  });

  test('deux tours de même texte LP et de constantes différentes : deux minimums, le cache garde l’objectif sans la constante', async () => {
    // Une organisation réservée à la seconde table, 3 puis 4 personnes ; une
    // autre de 2 libres. Tables de 10 places.
    const tour = (r, reserves) => ({
      r,
      T: 2,
      s: [10, 10 - reserves],
      unites: [{ groupe: 0, m: 0, a: [0, reserves] }, { groupe: 1, m: 2, a: [0, 0] }],
      remplissage: 0,
      conflits: [],
      infaisable: null,
    });
    assert.equal(lpTour(tour(0, 3)).lp, lpTour(tour(1, 4)).lp);
    const portee = porteeFactice();
    brancherTravailleurSolveur(portee, { chargerHighs: async () => highs });
    const messages = await portee.envoyer({ type: 'resoudre', numero: 1, tours: [tour(0, 3), tour(1, 4)], limite: 30 });
    assert.deepEqual(messages.slice(0, 2).map(({ issue }) => [issue.minimum, issue.cache]), [[3, false], [6, true]]);
  });

  test('un résultat à la limite ne sert pas sous une autre limite ; un résultat exact sert', async () => {
    const portee = porteeFactice();
    brancherTravailleurSolveur(portee, { chargerHighs: async () => highs });
    const { tours } = entreesDuSolveur(ETOILE_20_13());
    const [aLimite] = await portee.envoyer({ type: 'resoudre', numero: 1, tours, limite: 0 });
    assert.equal(aLimite.issue.cause, 'limite');
    const [exact] = await portee.envoyer({ type: 'resoudre', numero: 2, tours, limite: 30 });
    assert.deepEqual([exact.issue.minimum, exact.issue.cache], [11, false]);
    const [encore] = await portee.envoyer({ type: 'resoudre', numero: 3, tours, limite: 0 });
    assert.deepEqual([encore.issue.minimum, encore.issue.cache], [11, true]);
  });

  test('un chargement raté : une faute d’étape « chargement » ; le message suivant recharge', async () => {
    const portee = porteeFactice();
    let essais = 0;
    brancherTravailleurSolveur(portee, {
      chargerHighs: (url) => {
        essais += 1;
        return essais === 1 ? chargerHighs(url) : highs;
      },
    });
    const tours = [PETIT];
    const [faute] = await portee.envoyer({ type: 'resoudre', numero: 1, urlWasm: '/inexistant/highs.wasm', tours, limite: 30 });
    assert.equal(faute.type, 'faute');
    assert.equal(faute.etape, 'chargement');
    assert.match(faute.message, /inexistant/);
    assert.equal(typeof faute.pile, 'string');
    const messages = await portee.envoyer({ type: 'resoudre', numero: 2, tours, limite: 30 });
    assert.deepEqual(messages.map(({ type }) => type), ['tour', 'fini']);
    assert.equal(messages[0].issue.minimum, 4);
  });

  test('une erreur de calcul — un texte que HiGHS refuse et abandonne — : une faute d’étape « calcul » ; le message suivant est servi', async () => {
    const portee = porteeFactice();
    const fautif = {
      constants: highs.constants,
      withModel: (source, operation) => highs.withModel({ format: 'lp', data: 'Minimize\n obj: x +\nSubject To\n faux faux\nEnd\n' }, operation),
    };
    const charges = [];
    brancherTravailleurSolveur(portee, { chargerHighs: async () => (charges.push(1), charges.length === 1 ? fautif : highs) });
    const [faute] = await portee.envoyer({ type: 'resoudre', numero: 1, tours: [PETIT], limite: 30 });
    assert.deepEqual([faute.type, faute.numero, faute.etape], ['faute', 1, 'calcul']);
    const messages = await portee.envoyer({ type: 'resoudre', numero: 2, tours: [PETIT], limite: 30 });
    assert.deepEqual(messages.map(({ type }) => type), ['tour', 'fini']);
    assert.equal(charges.length, 2);
  });

  test('des tours mal formés : une faute de calcul, jamais une exception du gestionnaire', async () => {
    const portee = porteeFactice();
    brancherTravailleurSolveur(portee, { chargerHighs: async () => highs });
    const [faute] = await portee.envoyer({ type: 'resoudre', numero: 1, tours: null, limite: 30 });
    assert.deepEqual([faute.type, faute.etape], ['faute', 'calcul']);
  });

  test('un message d’un autre type, ou sans données, est ignoré, sans lever', async () => {
    const portee = porteeFactice();
    brancherTravailleurSolveur(portee, { chargerHighs: async () => highs });
    portee.onmessage({ data: { type: 'resumer', numero: 1 } });
    portee.onmessage({ data: null });
    portee.onmessage({});
    portee.onmessage(null);
    // Un message valide ensuite : seules ses réponses arrivent.
    await portee.envoyer({ type: 'resoudre', numero: 2, tours: [PETIT], limite: 30 });
    assert.deepEqual(portee.recus.map(({ type, numero }) => [type, numero]), [['tour', 2], ['fini', 2]]);
  });

  test('le chargeur du module lit le wasm à l’adresse donnée', async () => {
    const adresse = fileURLToPath(new URL('../../node_modules/highs/build/highs.wasm', import.meta.url));
    const charge = await chargerHighs(adresse);
    assert.equal(issueDuTour(charge, PETIT).minimum, 4);
  });
});

describe('entreesDuSolveur et le solveur : une charge inventée de bout en bout', () => {
  test('les données d’une charge résolues tour par tour, une absence comprise', () => {
    const charge = ETOILE_20_13(2);
    for (const membre of charge.participants.slice(20, 26)) membre.presence = [1];
    const tours = entreesDuSolveur(charge).tours;
    // Au tour 2, 20 contre 7 : 5, le plancher de l'étoile à ce tour.
    assert.deepEqual(tours.map((tour) => issueDuTour(highs, tour).minimum), [11, 5]);
    assert.deepEqual(planchersConflits(charge)[0].parTour, [11, 5]);
  });
});
