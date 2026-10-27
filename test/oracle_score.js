// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// L'oracle du score de la recherche (§ 14.10, § 14.11) : le n-uplet d'un plan
// indexé, recalculé par énumération directe des paires, des tours servis et
// des animateurs rencontrés, sans mesurer ni l'état tenu à jour, puis composé
// palier par palier sur la compilation de l'instance. La série surveillée et
// la série longue le partagent : la première le confronte au score jusqu'à
// 1 000 mouvements, la seconde à 10 000. Seules la compilation et les
// composantes d'un critère viennent du moteur, puisqu'elles disent où chaque
// grandeur se range et non ce qu'elle vaut.
import { LIBRE, RESERVE, SANS_GROUPE } from '../src/moteur/configuration.js';
import { compilationDe, composantesDe } from '../src/moteur/criteres.js';

// Les tours servis et les tours possibles de chaque personne présente, lus
// directement sur la configuration (§ 4.5) : à la table t au tour r,
// l'objectif du tour remplace celui de la soirée ; une personne y correspond
// sous « ou » quand elle porte l'une de ses étiquettes, sous « et » quand
// elle les porte toutes. (p, r) est possible quand sa table fixée lui
// correspond, ou, p libre, quand une table qui garde un siège libre lui
// correspond ; servi quand p est assis à une table qui lui correspond.
function objectifsDirects(configuration, instance, tableDe) {
  const { N, T, R, idsTables, ids, capacite, fixe } = instance;
  const objectifs = configuration.objectifs ?? [];
  const etiquettesDe = new Map(configuration.participants.map(({ id, etiquettes = [] }) => [id, etiquettes]));
  const objectifA = (t, r) =>
    objectifs.find(({ table, tour }) => table === idsTables[t] && tour === r + 1)
    ?? objectifs.find(({ table, tour }) => table === idsTables[t] && (tour === null || tour === undefined))
    ?? null;
  const correspond = (p, t, r) => {
    const objectif = objectifA(t, r);
    if (objectif === null) return false;
    const siennes = etiquettesDe.get(ids[p]);
    return objectif.regle === 'ou'
      ? objectif.etiquettes.some((motCle) => siennes.includes(motCle))
      : objectif.etiquettes.length > 0 && objectif.etiquettes.every((motCle) => siennes.includes(motCle));
  };
  const possibles = Array(N).fill(0);
  const servis = Array(N).fill(0);
  for (let r = 0; r < R; r += 1) {
    const libres = Array.from(capacite);
    for (let p = 0; p < N; p += 1) if (fixe[p * R + r] !== LIBRE) libres[fixe[p * R + r]] -= 1;
    for (let p = 0; p < N; p += 1) {
      const t = fixe[p * R + r];
      const tables = t === LIBRE ? [...Array(T).keys()].filter((u) => libres[u] > 0) : [t];
      if (tables.some((u) => correspond(p, u, r))) possibles[p] += 1;
      if (correspond(p, tableDe[p * R + r], r)) servis[p] += 1;
    }
  }
  return { possibles, servis };
}

// Les animateurs distincts que chaque personne présente rencontre, lus
// directement : f, autre que p, est rencontré quand p partage sa table à un
// tour où f anime — participants[].anime de la configuration.
export function animateursRencontres(configuration, instance, tableDe) {
  const { N, R, indexDe } = instance;
  const animes = configuration.participants
    .filter(({ anime, exclu }) => anime !== undefined && exclu !== true)
    .map(({ id, anime }) => ({ f: indexDe.get(id), tours: anime }));
  return Array.from({ length: N }, (_, p) =>
    animes.filter(({ f, tours }) => f !== p && tours.some((tour) => tableDe[f * R + tour - 1] === tableDe[p * R + tour - 1])).length);
}

// La relation des conflits d'organisation, lue directement sur la
// configuration : enConflit(a, b) est vrai quand une personne de l'unité de
// l'un — son organisation, tous ses membres, exclus compris, ou elle seule
// sans organisation — nomme l'organisation de l'autre, autre que la sienne
// (§ 4).
// Une personne que la configuration ne porte pas n'est en conflit avec
// personne.
export function conflitsDirects(configuration, { ids }) {
  const personneDe = new Map(configuration.participants.map((personne) => [personne.id, personne]));
  const nomme = (x, y) => {
    const px = personneDe.get(ids[x]);
    const py = personneDe.get(ids[y]);
    if (px === undefined || py === undefined) return false;
    const ox = px.organisation;
    const oy = py.organisation;
    if (oy === null || oy === ox) return false;
    const unite = ox === null ? [px] : configuration.participants.filter((q) => q.organisation === ox);
    return unite.some(({ conflits = [] }) => conflits.includes(oy));
  };
  return (a, b) => nomme(a, b) || nomme(b, a);
}

// Les grandeurs brutes d'un plan indexé, chacune sous son nom, recalculées
// par énumération directe des paires, des tours servis et des animateurs
// rencontrés, sans mesurer ni le module éprouvé ; les plafonds a priori et
// les bornes des animateurs de l'instance sont les seules grandeurs reçues.
// Les contraintes n'y entrent pas.
function grandeursBrutes(configuration, instance, tableDe, aPriori) {
  const { N, T, R, groupe, fixe, borneAnimateurs } = instance;
  // M[a × N + b], a < b : le nombre de tours où a et b partagent une table.
  const M = new Int32Array(N * N);
  for (let r = 0; r < R; r += 1) {
    for (let a = 0; a < N; a += 1) {
      for (let b = a + 1; b < N; b += 1) {
        const t = tableDe[a * R + r];
        if (t !== RESERVE && t === tableDe[b * R + r]) M[a * N + b] += 1;
      }
    }
  }
  const rencontres = Array(N).fill(0);
  const affilies = Array(N).fill(0);
  const organisations = Array.from({ length: N }, () => new Set());
  let cumulees = 0;
  let distinctes = 0;
  let excedentPaires = 0;
  let conflits = 0;
  const enConflit = conflitsDirects(configuration, instance);
  for (let a = 0; a < N; a += 1) {
    for (let b = a + 1; b < N; b += 1) {
      const m = M[a * N + b];
      if (m === 0) continue;
      excedentPaires += m - 1;
      if (enConflit(a, b)) conflits += m;
      for (const [p, q] of [[a, b], [b, a]]) {
        rencontres[p] += 1;
        if (groupe[q] !== SANS_GROUPE) {
          affilies[p] += 1;
          organisations[p].add(groupe[q]);
        }
      }
      if (groupe[a] !== SANS_GROUPE && groupe[a] === groupe[b]) {
        cumulees += m;
        distinctes += 1;
      }
    }
  }
  // Une table visitée m fois, dont f à un tour où la personne y est
  // réservée, compte m − 1 − max(0, f − 1) retours choisis (§ 5.4).
  let retours = 0;
  for (let p = 0; p < N; p += 1) {
    for (let t = 0; t < T; t += 1) {
      let visites = 0;
      let reservees = 0;
      for (let r = 0; r < R; r += 1) {
        if (tableDe[p * R + r] !== t) continue;
        visites += 1;
        if (fixe[p * R + r] === t) reservees += 1;
      }
      if (visites > 0) retours += visites - 1 - Math.max(0, reservees - 1);
    }
  }
  const ecarts = aPriori.map((plafond, p) => plafond - rencontres[p]);
  // Les objectifs, sur les personnes concernées, P(p) > 0.
  const { possibles, servis } = objectifsDirects(configuration, instance, tableDe);
  const hors = possibles.flatMap((P, p) => (P > 0 ? [P - servis[p]] : []));
  const horsObjectifMax = Math.max(0, ...hors);
  const m = animateursRencontres(configuration, instance, tableDe);
  return {
    conflitsOrganisation: conflits,
    ecartAuPlafondAPrioriMax: Math.max(...ecarts),
    carresEcartsAuPlafondAPriori: ecarts.reduce((somme, ecart) => somme + ecart * ecart, 0),
    excedentCollisions: cumulees - distinctes,
    collisionsCumulees: cumulees,
    excedentPaires,
    retoursChoisis: retours,
    redondance: affilies.reduce((somme, f, p) => somme + f - organisations[p].size, 0),
    toursHorsObjectif: hors.reduce((somme, h) => somme + h, 0),
    jamaisServies: possibles.filter((P, p) => P > 0 && servis[p] === 0).length,
    horsObjectifMax,
    personnesAuMax: horsObjectifMax === 0 ? 0 : hors.filter((h) => h === horsObjectifMax).length,
    animateursNonRencontres: Array.from(borneAnimateurs).reduce((somme, B, p) => somme + B - m[p], 0),
  };
}

// La valeur que la recherche descend pour une grandeur de composantesDe :
// pour les rencontres répétées, Σ max(0, M − 1) sous « nouveaux voisins »,
// plus les retours choisis sous « nouvelle table » (§ 5.7) ; sinon la
// grandeur brute de ce nom.
export const valeurDescendue = (brutes, nom, contraintes) => (nom === 'rencontresRepetees'
  ? (contraintes.nouveauxVoisins ? brutes.excedentPaires : 0) + (contraintes.nouvelleTable ? brutes.retoursChoisis : 0)
  : brutes[nom]);

// Le n-uplet du paragraphe « Score » de recherche.js, composé palier par
// palier sur la compilation de l'instance, à partir des grandeurs brutes :
// un critère seul à son palier pose une composante par grandeur qu'il
// descend, son poids multiplié par la grandeur ; un palier partagé, une
// seule, la somme sur ses critères du poids multiplié par la grandeur.
// Rend aussi les grandeurs brutes.
export function scoreOracle(instance, tableDe, aPriori, configuration = { participants: [] }) {
  const brutes = grandeursBrutes(configuration, instance, tableDe, aPriori);
  const { paliers, taille } = compilationDe(instance);
  const nUplet = Array(taille).fill(0);
  for (const { criteres, composantes } of paliers) {
    if (criteres.length === 1) {
      const [{ nom, poids }] = criteres;
      composantesDe(nom, instance.modeObjectifs).forEach((grandeur, k) => {
        nUplet[composantes[k]] = poids * valeurDescendue(brutes, grandeur, instance.contraintes);
      });
    } else {
      for (const { nom, poids } of criteres) nUplet[composantes[0]] += poids * valeurDescendue(brutes, nom, instance.contraintes);
    }
  }
  return { nUplet, brutes };
}
