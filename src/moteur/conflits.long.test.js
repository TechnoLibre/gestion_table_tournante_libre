// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves lourdes des conflits par table (§ 7.5, § 13.2) : les violations
// par table, sommées sur un plan entier, rendent les chiffres de la mesure.
// Σ des paires séparer = collisionsCumulees ; Σ des personnes nouvelle table
// = totalRetoursChoisis ; paires distinctes nouveaux voisins =
// rencontresRepetees.choisies. Les deux membres lisent le même parcours du
// plan (parcourirTours) : chacun se confronte aussi à un oracle écrit ici,
// sans le moteur, qui tient les règles d'exemption des réservations. D'abord
// les propositions d'une génération sur la grande démonstration, puis cent
// plans tirés sur de petites configurations, chacun de sa propre graine.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { CATALOGUE } from '../demo/catalogue.js';
import { FLUX, creerPcg32 } from '../demo/prng.js';
import { conflitsParTable } from './conflits.js';
import { LIBRE, SANS_GROUPE, indexerPlan, normaliser, planDepuisIndex } from './configuration.js';
import { mesurer } from './indicateurs.js';
import { rechercher } from './recherche.js';
import { verifierInvariants } from './verification.js';

// Une génération courte : la qualité des propositions n'importe pas ici, et
// des propositions qui portent encore des conflits éprouvent mieux l'accord.
const GENERATION = Object.freeze({ graine: 7, arret: 20_000, nombre: 2 });

// Les cent plans tirés : la graine du plan i est GRAINE + i.
const PLANS = 100;
const GRAINE = 2_718;
const PLANS_ACCEPTES_MIN = 90;

// Planchers des comptes de la boucle, posés au-dessous de ce que donnent les
// graines écrites ci-dessus : 100 plans acceptés ; 69 dont les trois totaux
// sont non nuls ; 32 où une paire réunie librement se retrouve à une table où
// les deux sont réservés ; 41 où une personne assise librement à une table y
// revient réservée. Les deux derniers comptent les cas où les règles
// d'exemption des réservations décident, que l'oracle juge.
const TOUS_NON_NULS_MIN = 55;
const PAIRE_PUIS_RESERVEE_MIN = 25;
const PERSONNE_PUIS_RESERVEE_MIN = 32;

const LIBELLES = Object.freeze(['Grisaille', 'Club des Merles', 'Ondée']);

// Les trois sommes d'un plan, lues dans conflitsParTable : paires séparer,
// personnes nouvelle table, et paires distinctes nouveaux voisins, clé
// « a,b » en identifiants.
function sommer(conflits) {
  let separer = 0;
  let nouvelleTable = 0;
  const revues = new Set();
  for (const tables of conflits) {
    for (const { regles } of tables) {
      for (const { regle, paires, personnes } of regles) {
        if (regle === 'separerOrganisations') separer += paires.length;
        else if (regle === 'nouvelleTable') nouvelleTable += personnes.length;
        else for (const [a, b] of paires) revues.add(`${a},${b}`);
      }
    }
  }
  return { separer, nouvelleTable, nouveauxVoisins: revues.size };
}

// L'oracle des trois sommes d'un plan qui assied chacun, écrit sans le
// moteur, par les règles de l'itération 1. Séparer : chaque paire de même
// organisation réunie, à chaque tour. Nouveaux voisins : une paire réunie
// au moins deux fois est choisie quand une de ses rencontres a lieu hors
// d'une table où les deux sont réservés. Nouvelle table : pour chaque
// personne et chaque table qu'elle visite m fois, dont f réservée, m − 1
// retours, dont max(0, f − 1) imposés, le reste choisi.
function oracle({ N, T, R, groupe, fixe }, tableDe) {
  let separer = 0;
  let nouveauxVoisins = 0;
  for (let a = 0; a < N; a += 1) {
    for (let b = a + 1; b < N; b += 1) {
      let rencontres = 0;
      let horsReservation = false;
      for (let r = 0; r < R; r += 1) {
        const t = tableDe[a * R + r];
        if (t !== tableDe[b * R + r]) continue;
        rencontres += 1;
        if (groupe[a] !== SANS_GROUPE && groupe[a] === groupe[b]) separer += 1;
        if (fixe[a * R + r] !== t || fixe[b * R + r] !== t) horsReservation = true;
      }
      if (rencontres >= 2 && horsReservation) nouveauxVoisins += 1;
    }
  }
  let nouvelleTable = 0;
  for (let p = 0; p < N; p += 1) {
    const visites = new Int32Array(T);
    const reservees = new Int32Array(T);
    for (let r = 0; r < R; r += 1) {
      const t = tableDe[p * R + r];
      visites[t] += 1;
      if (fixe[p * R + r] === t) reservees[t] += 1;
    }
    for (let t = 0; t < T; t += 1) {
      if (visites[t] > 0) nouvelleTable += visites[t] - 1 - Math.max(0, reservees[t] - 1);
    }
  }
  return { separer, nouvelleTable, nouveauxVoisins };
}

// Les écarts entre les sommes par table, la mesure du même plan et l'oracle.
function ecarts(nom, instance, tableDe) {
  const sommes = sommer(conflitsParTable(instance, tableDe));
  const mesures = mesurer(instance, tableDe);
  const attendu = {
    separer: mesures.collisionsCumulees,
    nouvelleTable: mesures.totalRetoursChoisis,
    nouveauxVoisins: mesures.rencontresRepetees.choisies,
  };
  const devine = oracle(instance, tableDe);
  const fautes = [];
  for (const cle of ['separer', 'nouvelleTable', 'nouveauxVoisins']) {
    if (sommes[cle] !== attendu[cle]) {
      fautes.push(`${nom} : ${cle} ${sommes[cle]} par table, ${attendu[cle]} mesurés`);
    }
    if (attendu[cle] !== devine[cle]) {
      fautes.push(`${nom} : ${cle} ${attendu[cle]} mesurés, ${devine[cle]} par l'oracle`);
    }
  }
  return { fautes, sommes };
}

// Une petite configuration tirée de rng : de 2 à 6 tables de 2 à 5 sièges,
// de 1 à 5 tours, de la moitié des sièges à tous occupés ; une organisation
// parmi trois, ou aucune, pour chacun. Un participant sur cinq est ancré, un
// sur trois réservé à une partie des tours quand R ≥ 2, chacun à une table
// où il reste un siège à chacun de ses tours : normaliser l'accepte toujours.
// Séparer, nouveaux voisins et nouvelle table sont actifs.
function tirerConfiguration(rng) {
  const T = 2 + rng.borne(5);
  const capacites = Array.from({ length: T }, () => 2 + rng.borne(4));
  const R = 1 + rng.borne(5);
  const S = capacites.reduce((somme, c) => somme + c, 0);
  const N = S - rng.borne(Math.floor(S / 2) + 1);
  const fixees = new Int32Array(T * R);
  const siegeLibre = (t, r) => fixees[t * R + r] < capacites[t];
  const participants = [];
  const reservations = [];
  for (let id = 1; id <= N; id += 1) {
    const g = rng.borne(LIBELLES.length + 1);
    participants.push({ id, nom: `P${id}`, organisation: g < LIBELLES.length ? LIBELLES[g] : null });
    const role = rng.borne(15);
    if (role < 3) {
      const t = rng.borne(T);
      if (Array.from({ length: R }, (_, r) => r).every((r) => siegeLibre(t, r))) {
        for (let r = 0; r < R; r += 1) fixees[t * R + r] += 1;
        reservations.push({ participant: id, table: t + 1, portee: 'tous' });
      }
    } else if (role < 8 && R >= 2) {
      for (let r = 0; r < R; r += 1) {
        if (rng.borne(2) === 0) continue;
        const t = rng.borne(T);
        if (!siegeLibre(t, r)) continue;
        fixees[t * R + r] += 1;
        reservations.push({ participant: id, table: t + 1, portee: 'tour', tour: r + 1 });
      }
    }
  }
  return {
    participants,
    tables: capacites.map((capacite, t) => ({ id: t + 1, numero: t + 1, capacite })),
    tours: R,
    reservations,
    contraintes: {
      separerOrganisations: true,
      nouveauxVoisins: true,
      nouvelleTable: true,
      varierOrganisations: rng.borne(2) === 0,
    },
  };
}

// Un plan qui assied chacun à chaque tour : les réservés à leur table, puis
// chaque autre, par index croissants, à une table tirée parmi celles qui lui
// laissent un siège.
function tirerPlan(rng, instance) {
  const { N, T, R, capacite, fixe } = instance;
  const tableDe = new Int32Array(N * R);
  for (let r = 0; r < R; r += 1) {
    const occupation = new Int32Array(T);
    for (let p = 0; p < N; p += 1) {
      const t = fixe[p * R + r];
      if (t === LIBRE) continue;
      tableDe[p * R + r] = t;
      occupation[t] += 1;
    }
    for (let p = 0; p < N; p += 1) {
      if (fixe[p * R + r] !== LIBRE) continue;
      const ouvertes = [];
      for (let t = 0; t < T; t += 1) if (occupation[t] < capacite[t]) ouvertes.push(t);
      const t = ouvertes[rng.borne(ouvertes.length)];
      tableDe[p * R + r] = t;
      occupation[t] += 1;
    }
  }
  return tableDe;
}

// Vrai quand une paire réunie à une table où les deux ne sont pas réservés
// se retrouve, à un tour suivant, à une table où les deux le sont.
function pairePuisReservee({ N, R, fixe }, tableDe) {
  for (let a = 0; a < N; a += 1) {
    for (let b = a + 1; b < N; b += 1) {
      let libre = false;
      for (let r = 0; r < R; r += 1) {
        const t = tableDe[a * R + r];
        if (t !== tableDe[b * R + r]) continue;
        const reservee = fixe[a * R + r] === t && fixe[b * R + r] === t;
        if (reservee && libre) return true;
        if (!reservee) libre = true;
      }
    }
  }
  return false;
}

// Vrai quand une personne assise sans réservation à une table y revient, à
// un tour suivant, réservée.
function personnePuisReservee({ N, T, R, fixe }, tableDe) {
  for (let p = 0; p < N; p += 1) {
    const libreA = new Uint8Array(T);
    for (let r = 0; r < R; r += 1) {
      const t = tableDe[p * R + r];
      if (fixe[p * R + r] !== t) libreA[t] = 1;
      else if (libreA[t] === 1) return true;
    }
  }
  return false;
}

describe('conflits par table : leurs sommes rendent la mesure (§ 7.5, § 13.2)', () => {
  test('grande démonstration, deux propositions de 20 000 mouvements', () => {
    const configuration = CATALOGUE.find(({ cle }) => cle === 'grande').construire();
    const instance = normaliser(configuration);
    const propositions = rechercher(configuration, GENERATION);
    assert.equal(propositions.length, GENERATION.nombre);
    const fautes = [];
    for (const { id, plan } of propositions) {
      assert.deepEqual(verifierInvariants(instance, plan), [], `proposition ${id}`);
      fautes.push(...ecarts(`proposition ${id}`, instance, indexerPlan(instance, plan)).fautes);
    }
    assert.deepEqual(fautes, []);
  });

  test('cent plans tirés sur de petites configurations, ancrés et partiellement fixés', () => {
    const fautes = [];
    const comptes = { acceptes: 0, tousNonNuls: 0, pairePuisReservee: 0, personnePuisReservee: 0 };
    for (let i = 1; i <= PLANS; i += 1) {
      const rng = creerPcg32(GRAINE + i, FLUX.DEMO);
      const instance = normaliser(tirerConfiguration(rng));
      const tableDe = tirerPlan(rng, instance);
      const violations = verifierInvariants(instance, planDepuisIndex(instance, tableDe));
      if (violations.length > 0) {
        fautes.push(`graine ${GRAINE + i} : plan refusé, ${JSON.stringify(violations)}`);
        continue;
      }
      comptes.acceptes += 1;
      const { fautes: fautesPlan, sommes } = ecarts(`graine ${GRAINE + i}`, instance, tableDe);
      fautes.push(...fautesPlan);
      if (sommes.separer > 0 && sommes.nouvelleTable > 0 && sommes.nouveauxVoisins > 0) {
        comptes.tousNonNuls += 1;
      }
      if (pairePuisReservee(instance, tableDe)) comptes.pairePuisReservee += 1;
      if (personnePuisReservee(instance, tableDe)) comptes.personnePuisReservee += 1;
    }
    assert.deepEqual(fautes, []);
    assert.ok(comptes.acceptes >= PLANS_ACCEPTES_MIN, JSON.stringify(comptes));
    assert.ok(comptes.tousNonNuls >= TOUS_NON_NULS_MIN, JSON.stringify(comptes));
    assert.ok(comptes.pairePuisReservee >= PAIRE_PUIS_RESERVEE_MIN, JSON.stringify(comptes));
    assert.ok(comptes.personnePuisReservee >= PERSONNE_PUIS_RESERVEE_MIN, JSON.stringify(comptes));
  });
});
