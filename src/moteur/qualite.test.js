// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du détail d'un placement (§ 12, D27 à D37, D51, D52) : le
// pourcentage et ses bords, le profil trié et ses marques, la répartition,
// la synthèse, les bornes des tuiles, les barres des collisions, le mélange
// des organisations à chaque table et ses trois ordres, les objectifs tour
// par tour, le profil des animateurs, et detailler qui les réunit. Chaque
// configuration est inventée et petite ; ses valeurs sont comptées à la main
// dans le commentaire qui la précède, et une lecture directe du plan, qui
// n'emprunte rien au module éprouvé, recoupe les comptes par table et par
// tour. Identifiants et index diffèrent quand l'ordre en dépend.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from '../../test/lanceur.js';
import { CATALOGUE, PLAN_PARFAIT_PETITE } from '../demo/catalogue.js';
import { LIBRE, indexerPlan, normaliser } from './configuration.js';
import { diagnostiquer } from './diagnostic.js';
import { diversiteAnimateurs } from './diversite.js';
import { mesurer, parcourirTours } from './indicateurs.js';
import { troisChiffres } from './manque.js';
import { manques, profilManque } from './manque.js';
import { matriceRencontres, pairesRepetees } from './paires.js';
import { borneDiversite, occupations, plafondsAPriori, plafondsRealises } from './plafond.js';
import {
  barresCollisions,
  bornesDesTuiles,
  detailler,
  mixTables,
  objectifsParTour,
  planchersAtteints,
  planchersDesColonnes,
  planchersParGroupe,
  pourcentage,
  profilAnimateurs,
  profilRencontres,
  repartition,
  synthese,
  teteDesColonnes,
} from './qualite.js';

const AUBIER = 'Coopérative Aubier';
const RESSAC = 'Atelier Ressac';

const SANS_CONTRAINTE = {
  separerOrganisations: false,
  nouveauxVoisins: false,
  nouvelleTable: false,
  varierOrganisations: false,
};

// La clé normalisée d'une organisation, telle que l'appelant la passe : le
// moteur n'importe pas le CSV, et l'épreuve n'en a pas besoin.
const cle = (libelle) => libelle.toLowerCase();

const tous = (participant, table) => ({ participant, table, portee: 'tous' });
const auTour = (participant, table, tour) => ({ participant, table, portee: 'tour', tour });

// Participant présent : [id, organisation, étiquettes, tours animés], les
// trois derniers facultatifs.
const participant = ([id, organisation = null, etiquettes, anime]) => ({
  id,
  nom: `P${id}`,
  organisation,
  ...(etiquettes === undefined ? {} : { etiquettes }),
  ...(anime === undefined ? {} : { anime }),
});

// Configuration, instance et plan indexé. tables : [id, capacité], dans
// l'ordre de la configuration ; plan[r] associe à un identifiant de table
// les identifiants qui s'y assoient au tour r + 1 ; un présent absent d'un
// tour est en réserve ; modeObjectifs, facultatif, le mode des objectifs.
function preparer({ personnes, tables, plan, reservations = [], objectifs = [], contraintes = SANS_CONTRAINTE, modeObjectifs }) {
  const configuration = {
    participants: personnes.map(participant),
    tables: tables.map(([id, capacite], i) => ({ id, numero: i + 1, capacite })),
    tours: plan.length,
    reservations,
    contraintes,
    ...(objectifs.length === 0 ? {} : { objectifs }),
    ...(modeObjectifs === undefined ? {} : { modeObjectifs }),
  };
  const instance = normaliser(configuration);
  const ids = configuration.tables.map(({ id }) => id);
  const tours = plan.map((tour) => ids.map((id) => tour[id] ?? []));
  const reserves = tours.map((listes) => {
    const assis = new Set(listes.flat());
    return instance.ids.filter((id) => !assis.has(id));
  });
  const tableDe = indexerPlan(instance, { tables: ids, tours, reserves });
  return { configuration, instance, tableDe, tours };
}

// Les mesures d'un plan préparé, ses plafonds et sa borne de diversité.
function mesurerTout(prepare) {
  const { instance, tableDe } = prepare;
  return {
    mesures: mesurer(instance, tableDe),
    realises: plafondsRealises(instance, tableDe),
    aPriori: plafondsAPriori(instance),
    aMax: borneDiversite(instance, tableDe).aMax,
  };
}

// Les options de detailler sur un plan préparé et ses mesures : le
// diagnostic de sa configuration, les trois chiffres de sa ligne
// d'évaluation, aucune matrice.
function optionsDe({ configuration, instance }, { mesures, realises, aPriori }, planchersValides = true) {
  return {
    diagnostic: diagnostiquer(configuration),
    mesures,
    plafondsRealises: realises,
    plafondsAPriori: aPriori,
    troisChiffres: troisChiffres(instance, mesures, aPriori, realises),
    planchersValides,
    cle,
    ordreMatrice: null,
  };
}

const index = (instance, id) => instance.indexDe.get(id);
const idsDe = (instance, lignes) => lignes.map(({ p }) => instance.ids[p]);
const somme = (valeurs) => valeurs.reduce((total, valeur) => total + valeur, 0);

describe('pourcentage (D52, § 5.4)', () => {
  test('les bords : 0 à numérateur nul, 100 au numérateur égal, null à dénominateur nul', () => {
    assert.equal(pourcentage(0, 27), 0);
    assert.equal(pourcentage(27, 27), 100);
    assert.equal(pourcentage(5, 0), null);
    assert.equal(pourcentage(0, 0), null);
  });

  test('entre les bords, la partie entière, jamais 0 ni 100 : 259 sur 260 donne 99, 1 sur 300 donne 1', () => {
    assert.equal(pourcentage(259, 260), 99);
    assert.equal(pourcentage(1, 300), 1);
    assert.equal(pourcentage(24, 27), 88);
    assert.equal(pourcentage(2, 3), 66);
    assert.equal(pourcentage(1, 2), 50);
    assert.equal(pourcentage(5, 8), 62);
    // Le centième exact n'est pas arrondi à la baisse d'un cran.
    assert.equal(pourcentage(29, 100), 29);
    assert.equal(pourcentage(57, 100), 57);
  });

  test('au-delà du dénominateur, que la garde refuse, le quotient entier : rien ne le ramène à 100', () => {
    assert.equal(pourcentage(28, 27), 103);
  });

  test('lève RangeError sur un compte qui n’est pas un entier positif ou nul', () => {
    for (const [n, d] of [[-1, 4], [1.5, 4], [1, -4], [1, 2.5], [Number.NaN, 4], ['3', 4], [1, null]]) {
      assert.throws(() => pourcentage(n, d), RangeError, `${String(n)} sur ${String(d)}`);
    }
  });
});

// Six personnes, deux tables de trois, deux tours ; 1 en réserve au tour 2.
// Rencontres et plafonds réalisés, comptés à la main (aucun ancré, n_p = 5) :
// 1 : {2, 3}, 2 sur 2 ; 2 : {1, 3, 4, 5}, 4 sur 4 ; 3 : {1, 2, 6}, 3 sur 3 ;
// 4 : {5, 6, 2}, 3 sur 4 ; 5 : {4, 6, 2}, 3 sur 4 ; 6 : {4, 5, 3}, 3 sur 3.
// À trois rencontres, 4 et 5, au plafond le plus haut, passent devant 3 et
// 6 ; trié sur le pourcentage, 4 et 5, à 75, viendraient en tête.
// Organisations : 1, 3 Aubier ; 2, 4 Ressac ; 5, 6 sans. A(p) vaut 1 pour 4
// et 5 seulement ; A_max(4) = min(Φ_aff = 1, G = 2, 4 − 2 + 1) = 1,
// A_max(5) = min(Φ_aff = 3, 2) = 2.
const PROFIL = {
  personnes: [[1, AUBIER], [2, RESSAC], [3, AUBIER], [4, RESSAC], [5], [6]],
  tables: [[10, 3], [20, 3]],
  plan: [
    { 10: [1, 2, 3], 20: [4, 5, 6] },
    { 10: [2, 4, 5], 20: [3, 6] },
  ],
};

describe('profilRencontres (§ 12.3, D28, D51)', () => {
  test('rencontres croissantes, puis plafond réalisé décroissant, puis identifiant : jamais le pourcentage', () => {
    const prepare = preparer(PROFIL);
    const { instance } = prepare;
    const { mesures, realises, aPriori, aMax } = mesurerTout(prepare);
    const profil = profilRencontres(instance, mesures, realises, aPriori, aMax);
    assert.deepEqual(idsDe(instance, profil), [1, 4, 5, 3, 6, 2]);
    assert.deepEqual(profil.map(({ rencontres, plafondRealise }) => [rencontres, plafondRealise]), [[2, 2], [3, 4], [3, 4], [3, 3], [3, 3], [4, 4]]);
    assert.deepEqual(profil.map(({ pourcent }) => pourcent), [100, 75, 75, 100, 100, 100]);
  });

  test('chaque ligne porte ce que les mesures donnent pour sa personne, lu sans recompte', () => {
    const prepare = preparer(PROFIL);
    const { instance } = prepare;
    const { mesures, realises, aPriori, aMax } = mesurerTout(prepare);
    for (const ligne of profilRencontres(instance, mesures, realises, aPriori, aMax)) {
      const { p } = ligne;
      assert.deepEqual(ligne, {
        p,
        rencontres: mesures.rencontres[p],
        plafondRealise: realises[p],
        pourcent: pourcentage(mesures.rencontres[p], realises[p]),
        plafondAPriori: aPriori[p],
        organisations: mesures.organisationsVues[p],
        affilies: mesures.affilies[p],
        borneDiversite: aMax[p],
        toursNonAssis: 2 - mesures.toursAssis[p],
        toursAbsents: 0,
        marque: p === index(instance, 1) ? 'reserve' : null,
      });
    }
    // A(p) et A_max, comptés à la main.
    assert.deepEqual(mesures.organisationsVues, [2, 2, 2, 1, 1, 2]);
    assert.deepEqual([aMax[3], aMax[4]], [1, 2]);
  });

  test('plafond a priori inconnu : null sur chaque ligne', () => {
    const prepare = preparer(PROFIL);
    const { mesures, realises, aMax } = mesurerTout(prepare);
    const profil = profilRencontres(prepare.instance, mesures, realises, null, aMax);
    assert.ok(profil.every(({ plafondAPriori }) => plafondAPriori === null));
  });

  // Tables 10, 20, 30, 40 de deux places, deux tours. 1 ancré à la table
  // 10 ; 2 réservé à la table 20 au tour 1 seulement, en réserve au tour 2 ;
  // 5 en réserve au tour 1 ; 6 seul à la table 30 aux deux tours, plafond
  // réalisé nul ; 7 seul à la table 40 au tour 1 et en réserve au tour 2,
  // plafond réalisé nul aussi : la réserve passe avant le plafond nul ; 3 et
  // 4 assis aux deux tours, chacun à son plafond.
  test('les marques, la première qui s’applique : ancré, partiellement fixé, en réserve, plafond nul ; le pourcentage null à plafond nul', () => {
    const prepare = preparer({
      personnes: [[1], [2], [3], [4], [5], [6], [7]],
      tables: [[10, 2], [20, 2], [30, 2], [40, 2]],
      plan: [
        { 10: [1, 3], 20: [2, 4], 30: [6], 40: [7] },
        { 10: [1, 5], 20: [3, 4], 30: [6] },
      ],
      reservations: [tous(1, 10), auTour(2, 20, 1)],
    });
    const { instance } = prepare;
    const { mesures, realises, aPriori, aMax } = mesurerTout(prepare);
    const profil = profilRencontres(instance, mesures, realises, aPriori, aMax);
    const deId = (id) => profil.find(({ p }) => p === index(instance, id));
    assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((id) => deId(id).marque), ['ancre', 'partiel', null, null, 'reserve', 'plafondNul', 'reserve']);
    assert.equal(deId(2).toursNonAssis, 1);
    assert.deepEqual([deId(7).toursNonAssis, deId(7).plafondRealise], [1, 0]);
    assert.deepEqual([deId(6).plafondRealise, deId(6).pourcent], [0, null]);
    assert.deepEqual(idsDe(instance, profil).slice(0, 1), [6]);
  });

  test('lève RangeError sur une liste qui n’a pas une case par personne', () => {
    const prepare = preparer(PROFIL);
    const { mesures, realises, aPriori, aMax } = mesurerTout(prepare);
    const { instance } = prepare;
    assert.throws(() => profilRencontres(instance, mesures, realises.slice(1), aPriori, aMax), RangeError);
    assert.throws(() => profilRencontres(instance, mesures, realises, aPriori.slice(1), aMax), RangeError);
    assert.throws(() => profilRencontres(instance, mesures, realises, aPriori, aMax.slice(1)), RangeError);
  });
});

describe('repartition et synthese (§ 12.3)', () => {
  test('une ligne par valeur présente, croissante, avec l’effectif, le cumul et les personnes à leur plafond, contre une lecture directe', () => {
    const prepare = preparer(PROFIL);
    const { mesures, realises } = mesurerTout(prepare);
    const lignes = repartition(mesures.rencontres, realises);
    assert.deepEqual(lignes, [
      { valeur: 2, effectif: 1, cumul: 1, auPlafond: 1 },
      { valeur: 3, effectif: 4, cumul: 5, auPlafond: 2 },
      { valeur: 4, effectif: 1, cumul: 6, auPlafond: 1 },
    ]);
    const valeurs = [...new Set(mesures.rencontres)].sort((a, b) => a - b);
    assert.deepEqual(lignes.map(({ valeur, effectif, auPlafond }) => ({ valeur, effectif, auPlafond })), valeurs.map((valeur) => ({
      valeur,
      effectif: mesures.rencontres.filter((v) => v === valeur).length,
      auPlafond: mesures.rencontres.filter((v, p) => v === valeur && v === realises[p]).length,
    })));
  });

  test('sans plafonds, auPlafond vaut null ; sans valeur, aucune ligne', () => {
    assert.deepEqual(repartition([3, 1, 3], null), [
      { valeur: 1, effectif: 1, cumul: 1, auPlafond: null },
      { valeur: 3, effectif: 2, cumul: 3, auPlafond: null },
    ]);
    assert.deepEqual(repartition([], []), []);
    assert.throws(() => repartition([1, 2], [1]), RangeError);
  });

  test('avec plafonds, une valeur dont personne n’est à son plafond porte auPlafond 0, jamais null', () => {
    assert.deepEqual(repartition([2, 1, 2], [3, 2, 2]), [
      { valeur: 1, effectif: 1, cumul: 1, auPlafond: 0 },
      { valeur: 2, effectif: 2, cumul: 3, auPlafond: 1 },
    ]);
  });

  test('la synthèse : le minimum, son effectif, et les personnes sous leur plafond réalisé', () => {
    const prepare = preparer(PROFIL);
    const { instance } = prepare;
    const { mesures, realises, aPriori, aMax } = mesurerTout(prepare);
    const resume = synthese(profilRencontres(instance, mesures, realises, aPriori, aMax));
    assert.deepEqual(resume, { minimum: 2, effectifAuMinimum: 1, effectifSousPlafond: 2 });
    assert.equal(resume.minimum, mesures.aggRencontres.tous.min);
    assert.deepEqual(synthese([]), { minimum: null, effectifAuMinimum: 0, effectifSousPlafond: 0 });
  });
});

// Dix « finance », 1 à 5 libres, 4 réservé à la table 2 au tour 1, 6 ancré à
// la table 1 ; 7 à 9 sans étiquette. Table 1, trois places, « finance » aux
// tours 1 et 2 ; tables 2 (trois places) et 3 (quatre places), sans objectif ;
// trois tours, le troisième sans objectif. 9 est en réserve au tour 2.
//
// Couples possibles : tour 1, 1, 2, 3, 5 et 6 (4 est fixé à une table sans
// objectif) ; tour 2, 1 à 6 ; tour 3, aucun. P_r, les non fixés, et L_r, les
// deux sièges libres de la table 1 : planchers 4 − 2 = 2, 5 − 2 = 3, 0.
// Tour 1 : 6, 1, 2 servis ; hors 2, plancher 2, reste 0 ; 4, 7, 8, 9 sans
// table possible. Tour 2 : 6 et 3 servis ; hors 4, plancher 3, reste 1 ; 7
// et 8 sans table possible, 9 en réserve. Tour 3 : rien de possible, les neuf
// assis sans table possible.
// s(p) : 1, 1, 1, 0, 0, 2 ; P(p) : 2, 2, 2, 1, 2, 2. Jamais servies : 5, puis
// 4 ; au minimum de s(p), 5, aux tours possibles les plus nombreux.
const OBJECTIFS = {
  personnes: [[1, null, ['finance']], [2, null, ['finance']], [3, null, ['finance']], [4, null, ['finance']], [5, null, ['finance']], [6, null, ['finance']], [7], [8], [9]],
  tables: [[1, 3], [2, 3], [3, 4]],
  reservations: [tous(6, 1), auTour(4, 2, 1)],
  objectifs: [
    { table: 1, tour: 1, regle: 'ou', etiquettes: ['finance'] },
    { table: 1, tour: 2, regle: 'ou', etiquettes: ['finance'] },
  ],
  plan: [
    { 1: [6, 1, 2], 2: [3, 4, 7], 3: [5, 8, 9] },
    { 1: [6, 3, 7], 2: [1, 2, 8], 3: [4, 5] },
    { 1: [6, 1, 2], 2: [3, 4, 5], 3: [7, 8, 9] },
  ],
};

// Lecture directe des objectifs d'un tour (§ 4.5, § 5.6), sans rien du
// module éprouvé : P_r, les couples possibles dont la personne n'est pas
// fixée ; S^nf_r, les servis non fixés ; σ_r, les assis sans couple possible.
// tour, de 1 à R ; listes, celles du plan préparé à ce tour.
function tourLu(configuration, tour, listes) {
  const { participants, tables, reservations, objectifs = [] } = configuration;
  const couvre = (res) => res.portee === 'tous' || res.tour === tour;
  const fixee = (id) => reservations.find((res) => res.participant === id && couvre(res))?.table;
  const libre = (table) => reservations.filter((res) => res.table === table.id && couvre(res)).length < table.capacite;
  const objectif = (table) => objectifs.find((o) => o.table === table && o.tour === tour) ?? objectifs.find((o) => o.table === table && o.tour === null);
  const correspond = (personne, table) => {
    const o = objectif(table);
    return o !== undefined && o.etiquettes.some((e) => (personne.etiquettes ?? []).includes(e));
  };
  const possible = (personne) => {
    const t = fixee(personne.id);
    return t === undefined ? tables.some((table) => libre(table) && correspond(personne, table.id)) : correspond(personne, t);
  };
  let nonFixes = 0;
  let servisNonFixes = 0;
  let sansCouple = 0;
  for (const personne of participants) {
    const i = listes.findIndex((occupants) => occupants.includes(personne.id));
    if (possible(personne) && fixee(personne.id) === undefined) nonFixes += 1;
    if (i === -1) continue;
    if (!possible(personne)) sansCouple += 1;
    const table = tables[i];
    if (fixee(personne.id) === undefined && libre(table) && correspond(personne, table.id)) servisNonFixes += 1;
  }
  return { nonFixes, servisNonFixes, sansCouple };
}

// Le parcours, le diagnostic et les objectifs par tour d'un plan préparé.
function objectifsDe(prepare) {
  const { configuration, instance, tableDe } = prepare;
  const parcours = parcourirTours(instance, tableDe);
  const diagnostic = diagnostiquer(configuration);
  return { parcours, diagnostic, objectifs: objectifsParTour(instance, parcours, diagnostic.objectifsInevitables.parTour) };
}

describe('objectifsParTour (§ 12.12, D36, B21)', () => {
  test('chaque tour, compté à la main : possibles, servis, pourcentage, hors objectif, plancher, reste, assis sans table possible', () => {
    const { objectifs } = objectifsDe(preparer(OBJECTIFS));
    assert.deepEqual(objectifs.parTour, [
      { possibles: 5, servis: 3, pourcent: 60, hors: 2, plancher: 2, reste: 0, sansCouple: 4 },
      { possibles: 6, servis: 2, pourcent: 33, hors: 4, plancher: 3, reste: 1, sansCouple: 2 },
      { possibles: 0, servis: null, pourcent: null, hors: null, plancher: null, reste: null, sansCouple: 9 },
    ]);
    assert.equal(objectifs.pireTour, 1);
    assert.deepEqual(objectifs.soiree, { possibles: 11, servis: 5, pourcent: 45, hors: 6, plancher: 5 });
  });

  test('les servis des tours somment s(p) ; Π_r − S_r = P_r − S^nf_r ; chaque plancher borne son tour ; σ_r + Π_r ne dépasse pas les présents', () => {
    const prepare = preparer(OBJECTIFS);
    const { configuration, instance, tableDe, tours } = prepare;
    const { objectifs, diagnostic } = objectifsDe(prepare);
    const mesures = mesurer(instance, tableDe);
    assert.equal(somme(objectifs.parTour.map(({ servis }) => servis ?? 0)), somme(mesures.objectifs.tours));
    assert.equal(objectifs.soiree.servis, somme(mesures.objectifs.tours));
    assert.equal(objectifs.soiree.possibles, somme(mesures.objectifs.possibles));
    objectifs.parTour.forEach(({ possibles, servis, hors, plancher, sansCouple }, r) => {
      const lu = tourLu(configuration, r + 1, tours[r]);
      assert.equal(sansCouple, lu.sansCouple, `tour ${r + 1}`);
      assert.ok(sansCouple + possibles <= instance.N, `tour ${r + 1}`);
      if (possibles === 0) return;
      assert.equal(possibles - servis, lu.nonFixes - lu.servisNonFixes, `tour ${r + 1}`);
      assert.ok(plancher <= hors, `tour ${r + 1}`);
    });
    // La somme des planchers des tours est le plancher que le diagnostic écrit.
    assert.equal(objectifs.soiree.plancher, diagnostic.objectifsInevitables.horsObjectif);
  });

  test('les personnes jamais servies : celles de la mesure, aux tours possibles les plus nombreux d’abord ; la répartition de P(p) − s(p), de la plus grande valeur à la plus petite', () => {
    const prepare = preparer(OBJECTIFS);
    const { instance, tableDe } = prepare;
    const { objectifs } = objectifsDe(prepare);
    assert.deepEqual(objectifs.jamaisServies, [{ p: index(instance, 5), possibles: 2 }, { p: index(instance, 4), possibles: 1 }]);
    assert.equal(objectifs.jamaisServies.length, mesurer(instance, tableDe).objectifs.jamaisServies);
    assert.deepEqual(objectifs.repartition, [{ valeur: 2, effectif: 1 }, { valeur: 1, effectif: 4 }, { valeur: 0, effectif: 1 }]);
    // 2 passe le tour 1 à la table 2 : jamais servi, deux tours possibles
    // comme 5 ; à égalité, l'identifiant.
    const plan = OBJECTIFS.plan.map((tour) => ({ ...tour }));
    plan[0] = { 1: [6, 1, 3], 2: [2, 4, 7], 3: [5, 8, 9] };
    const autre = preparer({ ...OBJECTIFS, plan });
    assert.deepEqual(idsDe(autre.instance, objectifsDe(autre).objectifs.jamaisServies), [2, 5, 4]);
  });

  test('à reste égal, le premier tour est le pire ; la personne fixée à une table à objectif est servie hors du plancher', () => {
    // Au tour 2, 1 rejoint 6 et 3 à la table 1 : trois servis, hors 3,
    // plancher 3, reste 0, comme au tour 1. 6, ancré, est servi à chaque
    // tour où la table porte un objectif, sans compter dans P_r.
    const plan = OBJECTIFS.plan.map((tour) => ({ ...tour }));
    plan[1] = { 1: [6, 3, 1], 2: [2, 7, 8], 3: [4, 5] };
    const prepare = preparer({ ...OBJECTIFS, plan });
    const { objectifs } = objectifsDe(prepare);
    assert.deepEqual(objectifs.parTour.map(({ hors, plancher, reste }) => [hors, plancher, reste]), [[2, 2, 0], [3, 3, 0], [null, null, null]]);
    assert.equal(objectifs.pireTour, 0);
    const { tours } = prepare;
    const lu = tourLu(prepare.configuration, 1, tours[0]);
    assert.equal(lu.nonFixes, 4);
    assert.equal(objectifs.parTour[0].possibles, lu.nonFixes + 1);
  });

  test('critère décoché : les planchers des tours sont ceux du diagnostic, non nuls', () => {
    const contraintes = { ...SANS_CONTRAINTE, respecterObjectifs: false };
    const { objectifs } = objectifsDe(preparer({ ...OBJECTIFS, contraintes }));
    assert.deepEqual(objectifs.parTour.map(({ plancher }) => plancher), [2, 3, null]);
  });

  test('sans personne concernée, null ; une liste de planchers d’une autre longueur lève RangeError', () => {
    const prepare = preparer({ ...OBJECTIFS, objectifs: [] });
    const { objectifs, parcours } = objectifsDe(prepare);
    assert.equal(objectifs, null);
    const avec = preparer(OBJECTIFS);
    assert.throws(() => objectifsParTour(avec.instance, parcourirTours(avec.instance, avec.tableDe), [2, 3]), RangeError);
    assert.ok(parcours.possiblesParTour.every((n) => n === 0));
  });
});

// Onze personnes, cinq tables de trois, deux tours, sans réservation.
// « atelier ressac » (1, 2), « Atelier Ressac » (3, 4), « Zinc » (5, 6),
// « Grès » (7, 8, 9), « Coopérative Aubier » (10, 11), dans cet ordre
// d'apparition. Tour 1 : chaque organisation à sa table, Grès à trois. Tour 2 :
// 1, 3, 5 ; 2, 4, 6 ; 7 ; 8 ; 9, 10, 11. Aubier : 2 collisions, 1 paire,
// excédent 1 ; Grès : 3, 3, 0 ; les trois autres : 1, 1, 0.
const COLLISIONS = {
  personnes: [[1, 'atelier ressac'], [2, 'atelier ressac'], [3, RESSAC], [4, RESSAC], [5, 'Zinc'], [6, 'Zinc'], [7, 'Grès'], [8, 'Grès'], [9, 'Grès'], [10, AUBIER], [11, AUBIER]],
  tables: [[1, 3], [2, 3], [3, 3], [4, 3], [5, 3]],
  plan: [
    { 1: [1, 2], 2: [3, 4], 3: [5, 6], 4: [7, 8, 9], 5: [10, 11] },
    { 1: [1, 3, 5], 2: [2, 4, 6], 3: [7], 4: [8], 5: [9, 10, 11] },
  ],
};

describe('barresCollisions et planchersParGroupe (§ 12.4, D31, B13)', () => {
  test('l’excédent décroissant, puis les collisions cumulées, puis la clé normalisée, puis la chaîne ; jamais la longueur de la barre', () => {
    const prepare = preparer(COLLISIONS);
    const { configuration, instance, tableDe } = prepare;
    const mesures = mesurer(instance, tableDe);
    const planchers = planchersParGroupe(instance, diagnostiquer(configuration).collisions);
    const lignes = barresCollisions(instance, mesures, planchers, true, cle);
    assert.deepEqual(lignes.map(({ groupe }) => groupe), [AUBIER, 'Grès', RESSAC, 'atelier ressac', 'Zinc']);
    assert.deepEqual(lignes[0], { g: 4, groupe: AUBIER, effectif: 2, cumulees: 2, prouve: 0, reste: 2, pairesDistinctes: 1, excedent: 1 });
    assert.deepEqual(lignes.map(({ cumulees, pairesDistinctes, excedent }) => [cumulees, pairesDistinctes, excedent]), [[2, 1, 1], [3, 3, 0], [1, 1, 0], [1, 1, 0], [1, 1, 0]]);
    // Sans réservation, le diagnostic se tait : « prouvé inévitable » vaut 0.
    assert.deepEqual(planchers, [0, 0, 0, 0, 0]);
    // Les deux libellés de même clé, présentés dans l'autre ordre : la
    // chaîne les départage encore, et non l'ordre d'apparition.
    const inverse = preparer({
      ...COLLISIONS,
      personnes: [[1, RESSAC], [2, RESSAC], [3, 'atelier ressac'], [4, 'atelier ressac'], ...COLLISIONS.personnes.slice(4)],
    });
    const mesuresInverses = mesurer(inverse.instance, inverse.tableDe);
    assert.deepEqual(inverse.instance.groupes.slice(0, 2), [RESSAC, 'atelier ressac']);
    assert.deepEqual(
      barresCollisions(inverse.instance, mesuresInverses, [0, 0, 0, 0, 0], true, cle).map(({ groupe }) => groupe),
      [AUBIER, 'Grès', RESSAC, 'atelier ressac', 'Zinc'],
    );
  });

  test('hors du domaine des planchers, prouvé et reste valent null ; le compte reste', () => {
    const prepare = preparer(COLLISIONS);
    const { instance, tableDe } = prepare;
    const lignes = barresCollisions(instance, mesurer(instance, tableDe), [0, 0, 0, 0, 0], false, cle);
    assert.ok(lignes.every(({ prouve, reste }) => prouve === null && reste === null));
    assert.equal(somme(lignes.map(({ cumulees }) => cumulees)), 8);
  });

  test('la variante conflit : le plancher du diagnostic, 4, est prouvé inévitable pour l’organisation de cinq', () => {
    const configuration = CATALOGUE.find(({ cle: nom }) => nom === 'petite-conflit').construire();
    const instance = normaliser(configuration);
    const tableDe = indexerPlan(instance, PLAN_PARFAIT_PETITE);
    const planchers = planchersParGroupe(instance, diagnostiquer(configuration).collisions);
    const lignes = barresCollisions(instance, mesurer(instance, tableDe), planchers, true, cle);
    const conflit = lignes.find(({ effectif }) => effectif === 5);
    assert.equal(conflit.prouve, 4);
    assert.equal(conflit.reste, conflit.cumulees - 4);
    assert.ok(lignes.filter((ligne) => ligne !== conflit).every(({ prouve }) => prouve === 0));
  });

  test('un plancher d’une organisation absente de l’instance, ou une liste d’une autre longueur, lève RangeError', () => {
    const { instance, tableDe } = preparer(COLLISIONS);
    assert.throws(() => planchersParGroupe(instance, [{ groupe: 'Ardoise', plancherCumulees: 2 }]), RangeError);
    assert.throws(() => barresCollisions(instance, mesurer(instance, tableDe), [0, 0], true, cle), RangeError);
  });
});

// Lecture directe d'une case (§ 5.4, B4) : capacité, occupants, affiliés et
// organisations distinctes de la table i au tour r, sur le plan préparé.
function caseLue({ configuration, tours }, r, i) {
  const organisation = new Map(configuration.participants.map(({ id, organisation: a }) => [id, a]));
  const occupants = tours[r][i];
  const affilies = occupants.filter((id) => organisation.get(id) !== null);
  return {
    capacite: configuration.tables[i].capacite,
    occupants: occupants.length,
    affilies: affilies.length,
    organisations: new Set(affilies.map((id) => organisation.get(id))).size,
  };
}

// Le mélange d'un plan préparé.
function melange({ instance, tableDe }) {
  return mixTables(instance, tableDe, occupations(instance, tableDe, { affilies: true }));
}

// Une table par cas, un seul tour, quatre organisations : W, en tête de
// l'ordre des tables, quatre places et deux sans organisation ; X, huit
// places, quatre affiliés de quatre organisations et un sans ; Y, quatre
// places, deux Aubier, un Ressac, un Grès ; Z, quatre places, un Aubier et
// trois sans ; V, quatre places, pleine de quatre affiliés de quatre
// organisations. Sièges : —, 4, 1, 3, 0 ; assis : —, 1, 1, 3, 0 ;
// doublons : —, 0, 1, 0, 0. W, à l'index 0, ne finit chaque ordre que par
// la règle des tables toutes « — », non par l'ordre des tables ; V, sans
// rien à compter, finit les tables mesurées.
const TROIS_ORDRES = {
  personnes: [
    [1, AUBIER], [2, RESSAC], [3, 'Grès'], [4, 'Zinc'], [5], [6, AUBIER], [7, AUBIER], [8, RESSAC], [9, 'Grès'], [10, AUBIER], [11], [12], [13], [14], [15],
    [16, AUBIER], [17, RESSAC], [18, 'Grès'], [19, 'Zinc'],
  ],
  tables: [[10, 4], [40, 8], [30, 4], [20, 4], [50, 4]],
  plan: [{ 40: [1, 2, 3, 4, 5], 30: [6, 7, 8, 9], 20: [10, 11, 12, 13], 10: [14, 15], 50: [16, 17, 18, 19] }],
};

describe('mixTables (§ 12.11, D35, B20)', () => {
  test('chaque case, contre une lecture directe : les trois comptes, emboîtés, et leurs trois pourcentages', () => {
    const prepare = preparer(TROIS_ORDRES);
    const { lignes } = melange(prepare);
    assert.deepEqual(lignes.map(({ t, capacite }) => [t, capacite]), [[0, 4], [1, 8], [2, 4], [3, 4], [4, 4]]);
    lignes.forEach(({ t, tours }) => {
      const lu = caseLue(prepare, 0, t);
      const [cas] = tours;
      if (lu.affilies === 0) {
        assert.equal(cas, null);
        return;
      }
      const { capacite: c, occupants: o, affilies: a, organisations: d } = lu;
      assert.deepEqual(cas, {
        occupants: o,
        affilies: a,
        organisations: d,
        comptes: { sieges: c - d, assis: o - d, doublons: a - d },
        pourcents: { sieges: pourcentage(d, c), assis: pourcentage(d, o), doublons: pourcentage(d, a) },
      });
      assert.ok(cas.comptes.sieges >= cas.comptes.assis && cas.comptes.assis >= cas.comptes.doublons && cas.comptes.doublons >= 0);
    });
    // La table incomplète, avec un assis sans organisation : 4 ≥ 1 ≥ 0,
    // quatre organisations pour huit sièges, cinq assis, quatre affiliés.
    assert.deepEqual(lignes[1].tours[0].comptes, { sieges: 4, assis: 1, doublons: 0 });
    assert.deepEqual(lignes[1].tours[0].pourcents, { sieges: 50, assis: 80, doublons: 100 });
    // Le sans-organisation de Z n'est pas un doublon.
    assert.deepEqual(lignes[3].tours[0].comptes, { sieges: 3, assis: 3, doublons: 0 });
    // La table pleine d'affiliés tous distincts : rien à compter.
    assert.deepEqual(lignes[4].tours[0].comptes, { sieges: 0, assis: 0, doublons: 0 });
  });

  test('trois ordres, un par position, qui diffèrent : la pire table d’abord, celle dont toutes les cases sont vides en dernier', () => {
    const { ordres, lignes } = melange(preparer(TROIS_ORDRES));
    // La table toute « — » est la première des tables : seul son rang à part
    // la met en dernier, jamais l'ordre des tables.
    assert.deepEqual(ordres, { sieges: [1, 3, 2, 4, 0], assis: [3, 1, 2, 4, 0], doublons: [2, 1, 3, 4, 0] });
    assert.deepEqual(lignes.map(({ pire }) => pire), [
      null,
      { sieges: 4, assis: 1, doublons: 0 },
      { sieges: 1, assis: 1, doublons: 1 },
      { sieges: 3, assis: 3, doublons: 0 },
      { sieges: 0, assis: 0, doublons: 0 },
    ]);
    assert.equal(lignes[0].somme, null);
  });

  // Deux tours, cinq tables de trois ; 1 à 4 Aubier, les autres sans. A :
  // tour 1, 1, 2 et 5, un doublon ; tour 2, 1, 5, 6, aucun. B : 3, 4, 6, un
  // doublon ; puis 2, 3, 7, un doublon. C : sans affilié au tour 1 ; 4, 8, 9
  // au tour 2. D et E, vides aux deux tours, dans l'ordre des tables.
  test('à pire égal, la somme sur les tours départage, puis l’ordre des tables ; une case vide ou sans affilié est ignorée', () => {
    const prepare = preparer({
      personnes: [[1, AUBIER], [2, AUBIER], [3, AUBIER], [4, AUBIER], [5], [6], [7], [8], [9]],
      tables: [[1, 3], [2, 3], [3, 3], [4, 3], [5, 3]],
      plan: [
        { 1: [1, 2, 5], 2: [3, 4, 6], 3: [7, 8, 9] },
        { 1: [1, 5, 6], 2: [2, 3, 7], 3: [4, 8, 9] },
      ],
    });
    const { ordres, lignes } = melange(prepare);
    assert.deepEqual(lignes.map(({ tours }) => tours.map((cas) => (cas === null ? null : cas.comptes.doublons))), [[1, 0], [1, 1], [null, 0], [null, null], [null, null]]);
    assert.deepEqual(lignes.map(({ somme: s }) => s), [
      { sieges: 4, assis: 4, doublons: 1 },
      { sieges: 4, assis: 4, doublons: 2 },
      { sieges: 2, assis: 2, doublons: 0 },
      null,
      null,
    ]);
    assert.deepEqual(ordres, { sieges: [0, 1, 2, 3, 4], assis: [0, 1, 2, 3, 4], doublons: [1, 0, 2, 3, 4] });
  });

  // Deux tables de trois, trois tours ; 1 à 5 Aubier, les autres sans. La
  // table 1 reçoit trois Aubier au tour 1, un seul ensuite : doublons 2, 0,
  // 0, pire 2, somme 2. La table 2 en reçoit deux à chaque tour : doublons
  // 1, 1, 1, pire 1, somme 3. Le plus grand compte d'une case passe avant la
  // somme : la table 1 vient d'abord.
  test('le plus grand compte d’une case, puis la somme : une seule case lourde l’emporte sur trois cases légères', () => {
    const { ordres, lignes } = melange(
      preparer({
        personnes: [[1, AUBIER], [2, AUBIER], [3, AUBIER], [4, AUBIER], [5, AUBIER], [6], [7], [8]],
        tables: [[1, 3], [2, 3]],
        plan: [
          { 1: [1, 2, 3], 2: [4, 5, 6] },
          { 1: [1, 6, 7], 2: [2, 3, 8] },
          { 1: [4, 6, 7], 2: [1, 5, 8] },
        ],
      }),
    );
    assert.deepEqual(lignes.map(({ tours }) => tours.map(({ comptes }) => comptes.doublons)), [[2, 0, 0], [1, 1, 1]]);
    assert.deepEqual(lignes.map(({ pire, somme: s }) => [pire.doublons, s.doublons]), [[2, 2], [1, 3]]);
    assert.deepEqual(ordres.doublons, [0, 1]);
  });

  test('un doublon d’organisation est non nul exactement là où parcourirTours compte des collègues', () => {
    for (const description of [COLLISIONS, TROIS_ORDRES, PROFIL]) {
      const prepare = preparer(description);
      const { parTour } = parcourirTours(prepare.instance, prepare.tableDe);
      const { lignes } = melange(prepare);
      lignes.forEach(({ t, tours }) => {
        tours.forEach((cas, r) => {
          const doublons = cas === null ? 0 : cas.comptes.doublons;
          assert.equal(doublons > 0, parTour[r][t].collegues.length > 0, `tour ${r + 1}, table ${t}`);
        });
      });
    }
  });

  test('sans les affiliés de l’occupation, lève TypeError', () => {
    const { instance, tableDe } = preparer(TROIS_ORDRES);
    assert.throws(() => mixTables(instance, tableDe, occupations(instance, tableDe)), {
      name: 'TypeError',
      message: 'occupation sans affiliés : occupations(instance, tableDe, {affilies: true}) attendue',
    });
  });
});

// Trois tables de deux, deux tours. 1 anime au tour 1 à la table 1, 2 au
// tour 2 à la table 2 ; 3, ancré à la table 3 où personne n'anime, n'est pas
// concerné (B(3) = 0). B(1) = B(2) = 1, l'autre animateur ; B(4) = B(5) =
// B(6) = 2. 4 rencontre les deux ; 5, 6, 1, 2 aucun. Ordre : 5 et 6, à la
// borne la plus haute, avant 1 et 2, puis 4.
const ANIMATEURS = {
  personnes: [[1, null, undefined, [1]], [2, null, undefined, [2]], [3], [4], [5], [6]],
  tables: [[1, 2], [2, 2], [3, 2]],
  reservations: [auTour(1, 1, 1), auTour(2, 2, 2), tous(3, 3)],
  plan: [
    { 1: [1, 4], 2: [2, 5], 3: [3, 6] },
    { 1: [1, 5], 2: [2, 4], 3: [3, 6] },
  ],
};

describe('profilAnimateurs (§ 12.13, D37)', () => {
  test('les seules personnes concernées, m(p) croissant, puis la borne décroissante, puis l’identifiant, avec leur statut', () => {
    const prepare = preparer(ANIMATEURS);
    const { instance, tableDe } = prepare;
    const mesures = mesurer(instance, tableDe);
    const profil = profilAnimateurs(instance, mesures);
    assert.deepEqual(idsDe(instance, profil), [5, 6, 1, 2, 4]);
    assert.deepEqual(profil.map(({ rencontres, borne, statut }) => [rencontres, borne, statut]), [
      [0, 2, 'mobile'],
      [0, 2, 'mobile'],
      [0, 1, 'partiel'],
      [0, 1, 'partiel'],
      [2, 2, 'mobile'],
    ]);
    assert.deepEqual(Object.keys(profil[0]), ['p', 'rencontres', 'borne', 'statut']);
  });

  test('m(p) croissant, quel que soit l’ordre des index : la personne qui a rencontré l’animateur passe après celle qui ne l’a pas rencontré', () => {
    // 1 anime au tour 1 à la table 1, seul animateur : B(1) = 0, B(2) =
    // B(3) = 1. 2 le rencontre au tour 1, 3 jamais.
    const prepare = preparer({
      personnes: [[1, null, undefined, [1]], [2], [3]],
      tables: [[1, 2], [2, 2]],
      reservations: [auTour(1, 1, 1)],
      plan: [{ 1: [1, 2], 2: [3] }, { 1: [1, 3], 2: [2] }],
    });
    const profil = profilAnimateurs(prepare.instance, mesurer(prepare.instance, prepare.tableDe));
    assert.deepEqual(idsDe(prepare.instance, profil), [3, 2]);
    assert.deepEqual(profil.map(({ rencontres, borne }) => [rencontres, borne]), [[0, 1], [1, 1]]);
  });

  test('sans personne concernée, null', () => {
    const prepare = preparer({ ...ANIMATEURS, personnes: [[1], [2], [3], [4], [5], [6]], reservations: [] });
    assert.equal(profilAnimateurs(prepare.instance, mesurer(prepare.instance, prepare.tableDe)), null);
  });
});

// Ce que bornesDesTuiles lit pour les planchers des tuiles : le diagnostic
// de la configuration préparée, sur un plan du domaine des planchers sauf
// demande contraire, et les trois chiffres que la ligne d'évaluation du
// plan porte sous le plafond a priori reçu.
const duDiagnostic = ({ configuration, instance, tableDe }, plafondsAPriori, planchersValides = true) => ({
  diagnostic: diagnostiquer(configuration),
  planchersValides,
  troisChiffres: troisChiffres(instance, mesurer(instance, tableDe), plafondsAPriori, plafondsRealises(instance, tableDe)),
});

// Les sept tuiles qui peuvent porter un plancher, chacune sans plancher.
const SANS_PLANCHER = {
  conflitsOrganisation: null,
  collisionsCumulees: null,
  pairesDistinctes: null,
  excedentCollisions: null,
  ecartItineraireMax: null,
  jamaisServies: null,
  horsObjectifMax: null,
  toursHorsObjectif: null,
};

describe('bornesDesTuiles (§ 12.2, D29, D34, D52, B11)', () => {
  test('le rang 1 du profil, la tête du profil de manque, le minimum de A(p) au même tri : chacun une personne nommée', () => {
    const prepare = preparer(PROFIL);
    const { instance } = prepare;
    const { mesures, realises, aPriori, aMax } = mesurerTout(prepare);
    const profil = profilRencontres(instance, mesures, realises, aPriori, aMax);
    const bornes = bornesDesTuiles(instance, {
      mesures,
      plafondsRealises: realises,
      aMax,
      profil,
      animateurs: null,
      objectifs: null,
      ...duDiagnostic(prepare, aPriori),
    });
    const un = index(instance, 1);
    assert.deepEqual(bornes.rang1, { p: un, rencontres: 2, plafondRealise: 2, plafondAPriori: aPriori[un], pourcent: 100 });
    // Manque 1 pour 4 et 5, au même plafond 4 : l'identifiant le plus petit,
    // et les deux au manque maximal.
    assert.deepEqual(bornes.manque, { p: index(instance, 4), plafondRealise: 4, effectif: 2 });
    // A(p) = 1 pour 4 et 5 : 5, à la borne de diversité la plus haute.
    assert.deepEqual(bornes.diversite, { p: index(instance, 5), aMax: 2 });
    assert.equal(bornes.animateurs, null);
    assert.equal(bornes.objectifs, null);
    assert.equal(bornes.soiree, null);
  });

  test('aucun pourcentage pour le manque, la diversité ni les animateurs ; celui du minimum de s(p) et de la soirée', () => {
    const avec = preparer(OBJECTIFS);
    const { instance, tableDe } = avec;
    const { mesures, realises, aPriori, aMax } = mesurerTout(avec);
    const profil = profilRencontres(instance, mesures, realises, aPriori, aMax);
    const { objectifs } = objectifsDe(avec);
    const bornes = bornesDesTuiles(instance, {
      mesures,
      plafondsRealises: realises,
      aMax,
      profil,
      animateurs: null,
      objectifs,
      ...duDiagnostic(avec, aPriori),
    });
    // s(p) = 0 pour 4 et 5 : 5, aux tours possibles les plus nombreux.
    assert.deepEqual(bornes.objectifs, { p: index(instance, 5), servis: 0, possibles: 2, pourcent: 0 });
    assert.deepEqual(bornes.soiree, { servis: 5, possibles: 11, pourcent: 45, jamaisServies: 2 });
    assert.equal(bornes.soiree.jamaisServies, mesurer(instance, tableDe).objectifs.jamaisServies);
    assert.deepEqual(Object.keys(bornes.manque), ['p', 'plafondRealise', 'effectif']);
    assert.equal(bornes.diversite, null);

    // La table 1 à quatre places : chaque « finance » libre est servi une
    // fois, 6 deux fois. Le minimum de s(p) vaut 1 chez les concernées ; 7,
    // 8 et 9, à s(p) = P(p) = 0, n'en sont pas et ne le portent jamais.
    const servis = preparer({
      ...OBJECTIFS,
      tables: [[1, 4], [2, 3], [3, 4]],
      plan: [
        { 1: [6, 1, 2, 3], 2: [4, 7, 8], 3: [5, 9] },
        { 1: [6, 4, 5, 7], 2: [1, 2, 8], 3: [3, 9] },
        { 1: [6, 1, 2], 2: [3, 4, 5], 3: [7, 8, 9] },
      ],
    });
    const lu = mesurerTout(servis);
    const parServis = bornesDesTuiles(servis.instance, {
      mesures: lu.mesures,
      plafondsRealises: lu.realises,
      aMax: lu.aMax,
      profil: profilRencontres(servis.instance, lu.mesures, lu.realises, lu.aPriori, lu.aMax),
      animateurs: null,
      objectifs: objectifsDe(servis).objectifs,
      ...duDiagnostic(servis, lu.aPriori),
    });
    assert.deepEqual(lu.mesures.objectifs.tours, [1, 1, 1, 1, 1, 2, 0, 0, 0]);
    // s(p) = 1 pour 1, 2, 3, 5 à P(p) = 2 et pour 4 à P(p) = 1 : 1, le
    // premier aux tours possibles les plus nombreux.
    assert.deepEqual(parServis.objectifs, { p: index(servis.instance, 1), servis: 1, possibles: 2, pourcent: 50 });

    const animes = preparer(ANIMATEURS);
    const m = mesurer(animes.instance, animes.tableDe);
    const tout = mesurerTout(animes);
    const profilA = profilRencontres(animes.instance, m, tout.realises, tout.aPriori, tout.aMax);
    const deAnimateurs = bornesDesTuiles(animes.instance, {
      mesures: m,
      plafondsRealises: tout.realises,
      aMax: tout.aMax,
      profil: profilA,
      animateurs: profilAnimateurs(animes.instance, m),
      objectifs: null,
      ...duDiagnostic(animes, tout.aPriori),
    });
    assert.deepEqual(deAnimateurs.animateurs, { p: index(animes.instance, 5), borne: 2 });

    // Au tour 2, 6 rencontre 2, qui anime, et 5 ne rencontre personne : le
    // rang 1, 5 à la borne 2, précède 1 et 2 à la borne 1, et la tuile porte
    // sa borne à lui.
    const seul = preparer({ ...ANIMATEURS, plan: [ANIMATEURS.plan[0], { 1: [1, 5], 2: [2, 6], 3: [3, 4] }] });
    const lus = mesurerTout(seul);
    const profilSeul = profilAnimateurs(seul.instance, lus.mesures);
    assert.deepEqual(profilSeul.map(({ borne }) => borne).slice(0, 2), [2, 1]);
    const deSeul = bornesDesTuiles(seul.instance, {
      mesures: lus.mesures,
      plafondsRealises: lus.realises,
      aMax: lus.aMax,
      profil: profilRencontres(seul.instance, lus.mesures, lus.realises, lus.aPriori, lus.aMax),
      animateurs: profilSeul,
      objectifs: null,
      ...duDiagnostic(seul, lus.aPriori),
    });
    assert.deepEqual(deSeul.animateurs, { p: index(seul.instance, 5), borne: 2 });
  });

  test('sans personne présente : ni rang 1, ni tête de manque', () => {
    const configuration = {
      participants: [{ id: 1, nom: 'P1', organisation: AUBIER, exclu: true }],
      tables: [{ id: 1, numero: 1, capacite: 2 }],
      tours: 1,
      reservations: [],
      contraintes: SANS_CONTRAINTE,
    };
    const vide = normaliser(configuration);
    const plan = new Int32Array(0);
    const mesures = mesurer(vide, plan);
    const bornes = bornesDesTuiles(vide, {
      mesures,
      plafondsRealises: [],
      aMax: [],
      profil: [],
      animateurs: null,
      objectifs: null,
      ...duDiagnostic({ configuration, instance: vide, tableDe: plan }, []),
    });
    assert.deepEqual(bornes, {
      rang1: null,
      manque: null,
      diversite: null,
      animateurs: null,
      objectifs: null,
      soiree: null,
      planchers: SANS_PLANCHER,
    });
  });
});

// Les bornes des tuiles d'un plan préparé, sous le diagnostic de sa
// configuration ; aPrioriConnu faux passe un plafond a priori inconnu.
function bornesDuPlan(prepare, { planchersValides = true, aPrioriConnu = true } = {}) {
  const { instance } = prepare;
  const { mesures, realises, aPriori, aMax } = mesurerTout(prepare);
  const plafonds = aPrioriConnu ? aPriori : null;
  return bornesDesTuiles(instance, {
    mesures,
    plafondsRealises: realises,
    aMax,
    profil: profilRencontres(instance, mesures, realises, plafonds, aMax),
    animateurs: null,
    objectifs: objectifsDe(prepare).objectifs,
    ...duDiagnostic(prepare, plafonds, planchersValides),
  });
}

// Cinq de la Coopérative Aubier et une personne sans organisation, deux
// tables de trois, trois tours : chaque tour assied trois membres à une
// table et deux à l'autre, quatre collisions. Le diagnostic prouve 12
// collisions cumulées, 4 paires distinctes — le plus grand minimum d'un
// tour — et un excédent de 12 − C(5, 2) = 2.
const CINQ_MEMBRES = {
  personnes: [[1, AUBIER], [2, AUBIER], [3, AUBIER], [4, AUBIER], [5, AUBIER], [6]],
  tables: [[1, 3], [2, 3]],
};
// Les mêmes tables à chaque tour : 4 paires distinctes, revues trois fois,
// excédent 8.
const MEMES_TABLES = [
  { 1: [1, 2, 3], 2: [4, 5, 6] },
  { 1: [1, 2, 3], 2: [4, 5, 6] },
  { 1: [1, 2, 3], 2: [4, 5, 6] },
];
// Chaque tour ne revoit que 1 et 2 : les dix paires de l'organisation,
// excédent 2.
const TABLES_VARIEES = [
  { 1: [1, 2, 3], 2: [4, 5, 6] },
  { 1: [1, 2, 4], 2: [3, 5, 6] },
  { 1: [1, 2, 5], 2: [3, 4, 6] },
];

// Cinq personnes sans organisation, une table de trois et une de deux, deux
// tours : le diagnostic prouve un écart d'itinéraire maximal de 1 au moins
// (diagnostic.test.js, § 12.10.4). Le plan qui fait passer quatre personnes
// distinctes par la table de deux l'atteint ; celui qui y garde les deux
// mêmes laisse 4 et 5 à deux sous leur plafond a priori de 4.
const ITINERAIRE = { personnes: [[1], [2], [3], [4], [5]], tables: [[10, 3], [20, 2]] };
const PAR_LA_TABLE_DE_DEUX = [
  { 10: [1, 2, 3], 20: [4, 5] },
  { 10: [1, 4, 5], 20: [2, 3] },
];
const MEMES_A_LA_TABLE_DE_DEUX = [
  { 10: [1, 2, 3], 20: [4, 5] },
  { 10: [1, 2, 3], 20: [4, 5] },
];

// Cinq « finance » et une autre personne, une table de deux qui attend
// « finance » et une de quatre, deux tours : cinq couples possibles pour
// deux sièges à chaque tour. Le diagnostic prouve 3 + 3 = 6 tours hors
// objectif, 5 − (2 + 2) = 1 personne jamais servie et ⌈6 / 5⌉ = 2 tours
// hors objectif au moins pour une personne.
const DEUX_SIEGES = {
  personnes: [[1, null, ['finance']], [2, null, ['finance']], [3, null, ['finance']], [4, null, ['finance']], [5, null, ['finance']], [6]],
  tables: [[1, 2], [2, 4]],
  objectifs: [{ table: 1, tour: null, regle: 'ou', etiquettes: ['finance'] }],
};
// Quatre « finance » servies une fois chacune, 5 jamais : chaque plancher
// atteint.
const QUATRE_SERVIES = [
  { 1: [1, 2], 2: [3, 4, 5, 6] },
  { 1: [3, 4], 2: [1, 2, 5, 6] },
];

describe('bornesDesTuiles : les planchers des tuiles (§ 12.2, § 5.6, B11)', () => {
  test('rouge : les collisions cumulées, les paires distinctes et l’excédent portent la somme des planchers du diagnostic ; atteint quand la mesure les égale', () => {
    const memes = preparer({ ...CINQ_MEMBRES, plan: MEMES_TABLES });
    const lu = mesurer(memes.instance, memes.tableDe);
    assert.deepEqual([lu.collisionsCumulees, lu.pairesDistinctes, lu.excedentCollisions], [12, 4, 8]);
    assert.deepEqual(
      diagnostiquer(memes.configuration).collisions.map(({ plancherCumulees, plancherPairesDistinctes, plancherExcedent }) => [
        plancherCumulees,
        plancherPairesDistinctes,
        plancherExcedent,
      ]),
      [[12, 4, 2]],
    );
    assert.deepEqual(bornesDuPlan(memes).planchers, {
      ...SANS_PLANCHER,
      collisionsCumulees: { plancher: 12, atteint: true },
      pairesDistinctes: { plancher: 4, atteint: true },
      excedentCollisions: { plancher: 2, atteint: false },
    });
    const variees = preparer({ ...CINQ_MEMBRES, plan: TABLES_VARIEES });
    assert.equal(mesurer(variees.instance, variees.tableDe).pairesDistinctes, 10);
    assert.deepEqual(bornesDuPlan(variees).planchers, {
      ...SANS_PLANCHER,
      collisionsCumulees: { plancher: 12, atteint: true },
      pairesDistinctes: { plancher: 4, atteint: false },
      excedentCollisions: { plancher: 2, atteint: true },
    });
  });

  test('rouge : deux organisations en collision : chaque plancher somme ceux des deux, l’excédent ceux qui en écrivent un', () => {
    // Trois de la Coopérative Aubier et trois de l'Atelier Ressac, deux
    // tables de trois, trois tours : un tour réunit au moins deux membres
    // de chacune, une collision ; 3 cumulées, 1 distincte, excédent 3 − 3 =
    // 0, que le diagnostic n'écrit pas, pour chacune.
    const deux = preparer({
      personnes: [[1, AUBIER], [2, AUBIER], [3, AUBIER], [4, RESSAC], [5, RESSAC], [6, RESSAC]],
      tables: [[1, 3], [2, 3]],
      plan: [
        { 1: [1, 2, 4], 2: [3, 5, 6] },
        { 1: [1, 3, 5], 2: [2, 4, 6] },
        { 1: [2, 3, 6], 2: [1, 4, 5] },
      ],
    });
    assert.deepEqual(
      diagnostiquer(deux.configuration).collisions.map(({ plancherCumulees, plancherPairesDistinctes, plancherExcedent }) => [
        plancherCumulees,
        plancherPairesDistinctes,
        plancherExcedent,
      ]),
      [[3, 1, null], [3, 1, null]],
    );
    const lu = mesurer(deux.instance, deux.tableDe);
    assert.deepEqual([lu.collisionsCumulees, lu.pairesDistinctes], [6, 6]);
    assert.deepEqual(bornesDuPlan(deux).planchers, {
      ...SANS_PLANCHER,
      collisionsCumulees: { plancher: 6, atteint: true },
      pairesDistinctes: { plancher: 2, atteint: false },
    });
  });

  test('rouge : l’écart d’itinéraire maximal porte le plancher du diagnostic, atteint ou non ; aucun sous un plafond a priori inconnu', () => {
    const distincts = preparer({ ...ITINERAIRE, plan: PAR_LA_TABLE_DE_DEUX });
    assert.deepEqual(diagnostiquer(distincts.configuration).ecartItineraire, { plancher: 1, mobilesAuMoins: 2 });
    assert.deepEqual(bornesDuPlan(distincts).planchers, { ...SANS_PLANCHER, ecartItineraireMax: { plancher: 1, atteint: true } });
    const memes = preparer({ ...ITINERAIRE, plan: MEMES_A_LA_TABLE_DE_DEUX });
    assert.deepEqual(bornesDuPlan(memes).planchers, { ...SANS_PLANCHER, ecartItineraireMax: { plancher: 1, atteint: false } });
    assert.deepEqual(bornesDuPlan(distincts, { aPrioriConnu: false }).planchers, SANS_PLANCHER);
  });

  test('rouge : l’écart d’itinéraire se dit atteint sur la valeur que la ligne d’évaluation porte, reçue, jamais recomptée', () => {
    const memes = preparer({ ...ITINERAIRE, plan: MEMES_A_LA_TABLE_DE_DEUX });
    const { instance } = memes;
    const { mesures, realises, aPriori, aMax } = mesurerTout(memes);
    const ligne = troisChiffres(instance, mesures, aPriori, realises);
    assert.equal(ligne.ecartItineraireMax.tous, 2);
    const lus = {
      mesures,
      plafondsRealises: realises,
      aMax,
      profil: profilRencontres(instance, mesures, realises, aPriori, aMax),
      animateurs: null,
      objectifs: null,
      diagnostic: diagnostiquer(memes.configuration),
      planchersValides: true,
    };
    // Une ligne qui porterait 1 : le détail la lit telle quelle, sans
    // remesurer le plan, qui en donnerait 2.
    const recue = { ...ligne, ecartItineraireMax: { ...ligne.ecartItineraireMax, tous: 1 } };
    assert.deepEqual(bornesDesTuiles(instance, { ...lus, troisChiffres: recue }).planchers.ecartItineraireMax, {
      plancher: 1,
      atteint: true,
    });
    // Une ligne sans écart d'itinéraire, sous un plafond a priori inconnu :
    // la tuile écrit « inconnu », et aucun plancher.
    const sansEcart = { ...ligne, ecartItineraireMax: null };
    assert.equal(bornesDesTuiles(instance, { ...lus, troisChiffres: sansEcart }).planchers.ecartItineraireMax, null);
  });

  test('rouge : les personnes jamais servies, le plus de tours hors objectif d’une personne et les tours hors objectif portent ceux du diagnostic, chacun sous le mode qui le compare', () => {
    const servies = preparer({ ...DEUX_SIEGES, plan: QUATRE_SERVIES });
    assert.deepEqual(diagnostiquer(servies.configuration).objectifsInevitables, {
      horsObjectif: 6,
      jamaisServies: 1,
      horsObjectifMax: 2,
      parTour: [3, 3],
    });
    const objectifsDuPlan = (prepare) => {
      const { jamaisServies, horsObjectifMax, toursHorsObjectif } = bornesDuPlan(prepare).planchers;
      return [jamaisServies, horsObjectifMax, toursHorsObjectif];
    };
    assert.deepEqual(objectifsDuPlan(preparer({ ...DEUX_SIEGES, plan: QUATRE_SERVIES, modeObjectifs: 'chacun' })), [
      { plancher: 1, atteint: true },
      null,
      { plancher: 6, atteint: true },
    ]);
    assert.deepEqual(objectifsDuPlan(preparer({ ...DEUX_SIEGES, plan: QUATRE_SERVIES, modeObjectifs: 'minimum' })), [
      null,
      { plancher: 2, atteint: true },
      { plancher: 6, atteint: true },
    ]);
    // 1 et 2 servies aux deux tours : autant de tours hors objectif, mais 3,
    // 4 et 5 jamais servies.
    const memes = [
      { 1: [1, 2], 2: [3, 4, 5, 6] },
      { 1: [1, 2], 2: [3, 4, 5, 6] },
    ];
    const chacun = preparer({ ...DEUX_SIEGES, plan: memes, modeObjectifs: 'chacun' });
    assert.equal(mesurer(chacun.instance, chacun.tableDe).objectifs.jamaisServies, 3);
    assert.deepEqual(objectifsDuPlan(chacun), [{ plancher: 1, atteint: false }, null, { plancher: 6, atteint: true }]);
    assert.deepEqual(objectifsDuPlan(preparer({ ...DEUX_SIEGES, plan: memes, modeObjectifs: 'minimum' })), [
      null,
      { plancher: 2, atteint: true },
      { plancher: 6, atteint: true },
    ]);
    // Le siège d'une « finance » donné à 6, qui n'attend rien : un tour
    // hors objectif de plus.
    const cede = bornesDuPlan(preparer({ ...DEUX_SIEGES, plan: [QUATRE_SERVIES[0], { 1: [3, 6], 2: [1, 2, 4, 5] }] })).planchers;
    assert.deepEqual(cede.toursHorsObjectif, { plancher: 6, atteint: false });
  });

  test('rouge : un plancher des objectifs ne s’écrit que pour une valeur que le mode réglé compare, critère coché, comme au diagnostic (§ 5.6)', () => {
    // Sous le mode par défaut, seuls les tours hors objectif se comparent :
    // le diagnostic prouve 1 personne jamais servie et 2 tours hors
    // objectif pour une personne, et aucune tuile ne les écrit.
    const desObjectifs = ({ jamaisServies, horsObjectifMax, toursHorsObjectif }) => [jamaisServies, horsObjectifMax, toursHorsObjectif];
    const parDefaut = bornesDuPlan(preparer({ ...DEUX_SIEGES, plan: QUATRE_SERVIES })).planchers;
    assert.deepEqual(desObjectifs(parDefaut), [null, null, { plancher: 6, atteint: true }]);
    // Le critère décoché ne compare rien, sous aucun mode, et les mesures
    // des objectifs restent : aucun plancher.
    for (const modeObjectifs of ['places', 'chacun', 'minimum']) {
      const decoche = preparer({
        ...DEUX_SIEGES,
        plan: QUATRE_SERVIES,
        modeObjectifs,
        contraintes: { ...SANS_CONTRAINTE, respecterObjectifs: false },
      });
      assert.notEqual(mesurer(decoche.instance, decoche.tableDe).objectifs, null, modeObjectifs);
      assert.deepEqual(desObjectifs(bornesDuPlan(decoche).planchers), [null, null, null], modeObjectifs);
    }
  });

  test('rouge : hors du domaine des planchers, aucun ; un plancher nul ne s’écrit pas, jamais 0', () => {
    assert.deepEqual(bornesDuPlan(preparer({ ...CINQ_MEMBRES, plan: MEMES_TABLES }), { planchersValides: false }).planchers, SANS_PLANCHER);
    assert.deepEqual(bornesDuPlan(preparer({ ...DEUX_SIEGES, plan: QUATRE_SERVIES }), { planchersValides: false }).planchers, SANS_PLANCHER);
    // Deux membres par organisation pour deux tables, aucune table
    // inférieure, aucun objectif : le diagnostic ne prouve rien.
    const rien = preparer(PROFIL);
    const diagnostic = diagnostiquer(rien.configuration);
    assert.deepEqual([diagnostic.collisions, diagnostic.ecartItineraire], [[], null]);
    assert.deepEqual(bornesDuPlan(rien).planchers, SANS_PLANCHER);
    // Cinq sièges pour cinq « finance » : des planchers des objectifs nuls,
    // que la tuile tait.
    const large = preparer({
      ...DEUX_SIEGES,
      tables: [[1, 5], [2, 2]],
      plan: [
        { 1: [1, 2, 3, 4, 5], 2: [6] },
        { 1: [1, 2, 3, 4, 5], 2: [6] },
      ],
    });
    assert.deepEqual(diagnostiquer(large.configuration).objectifsInevitables, {
      horsObjectif: 0,
      jamaisServies: 0,
      horsObjectifMax: 0,
      parTour: [0, 0],
    });
    const planchers = bornesDuPlan(large).planchers;
    assert.deepEqual([planchers.jamaisServies, planchers.horsObjectifMax, planchers.toursHorsObjectif], [null, null, null]);
  });
});

// Tous les plans indexés d'une instance qui assoient chacun à chaque tour,
// honorent les réservations et tiennent les capacités ; le même tableau est
// rendu, rempli, à chaque plan.
function* tousLesPlans({ N, T, R, capacite, fixe }) {
  const tableDe = new Int32Array(N * R);
  const occupation = new Int32Array(T * R);
  function* placer(i) {
    if (i === N * R) {
      yield tableDe;
      return;
    }
    const r = i % R;
    for (let t = 0; t < T; t += 1) {
      if ((fixe[i] !== LIBRE && fixe[i] !== t) || occupation[t * R + r] === capacite[t]) continue;
      occupation[t * R + r] += 1;
      tableDe[i] = t;
      yield* placer(i + 1);
      occupation[t * R + r] -= 1;
    }
  }
  yield* placer(0);
}

describe('le détail sur chaque plan d’une petite configuration (§ 14.10, B25)', () => {
  // Six personnes, trois tables de deux, deux tours ; 1 ancré à la table 1,
  // « finance » pour la soirée ; la table 2, « finance » au seul tour 2 ; la
  // table 3 sans objectif. Trente plans par tour, neuf cents en tout.
  test('les comptes par table et par tour tiennent leurs identités sur chacun des neuf cents plans', () => {
    const configuration = {
      participants: [
        participant([1, AUBIER, ['finance']]),
        participant([2, AUBIER, ['finance']]),
        participant([3, RESSAC, ['finance']]),
        participant([4, RESSAC]),
        participant([5, null, ['finance']]),
        participant([6]),
      ],
      tables: [{ id: 1, numero: 1, capacite: 2 }, { id: 2, numero: 2, capacite: 2 }, { id: 3, numero: 3, capacite: 2 }],
      tours: 2,
      reservations: [tous(1, 1)],
      contraintes: SANS_CONTRAINTE,
      objectifs: [
        { table: 1, tour: null, regle: 'ou', etiquettes: ['finance'] },
        { table: 2, tour: 2, regle: 'ou', etiquettes: ['finance'] },
      ],
    };
    const instance = normaliser(configuration);
    const { N, R, T, ids } = instance;
    const diagnostic = diagnostiquer(configuration);
    const organisation = new Map(configuration.participants.map(({ id, organisation: a }) => [id, a]));
    let plans = 0;
    for (const tableDe of tousLesPlans(instance)) {
      plans += 1;
      const tours = Array.from({ length: R }, (_, r) => Array.from({ length: T }, (__, t) => ids.filter((___, p) => tableDe[p * R + r] === t)));
      const parcours = parcourirTours(instance, tableDe);
      const { lignes } = mixTables(instance, tableDe, occupations(instance, tableDe, { affilies: true }), parcours);
      for (const { t, tours: cases } of lignes) {
        cases.forEach((cas, r) => {
          const affilies = tours[r][t].filter((id) => organisation.get(id) !== null);
          if (affilies.length === 0) {
            assert.equal(cas, null);
            return;
          }
          const d = new Set(affilies.map((id) => organisation.get(id))).size;
          assert.equal(cas.organisations, d);
          assert.equal(cas.comptes.doublons, affilies.length - d);
          assert.equal(cas.comptes.doublons > 0, parcours.parTour[r][t].collegues.length > 0);
          assert.ok(cas.comptes.sieges >= cas.comptes.assis && cas.comptes.assis >= cas.comptes.doublons);
        });
      }
      const objectifs = objectifsParTour(instance, parcours, diagnostic.objectifsInevitables.parTour);
      assert.equal(objectifs.soiree.servis, somme(parcours.servis));
      assert.equal(objectifs.soiree.plancher, diagnostic.objectifsInevitables.horsObjectif);
      objectifs.parTour.forEach(({ possibles, servis, hors, plancher, sansCouple }, r) => {
        const lu = tourLu(configuration, r + 1, tours[r]);
        assert.equal(sansCouple, lu.sansCouple);
        assert.ok(sansCouple + possibles <= N);
        assert.equal(possibles - servis, lu.nonFixes - lu.servisNonFixes);
        assert.ok(plancher <= hors);
      });
    }
    assert.equal(plans, 900);
  });
});

// Un objet simple ou une liste, à toute profondeur, sans tableau typé.
function sansTableauType(valeur, chemin = 'détail') {
  if (valeur === null || typeof valeur !== 'object') return;
  assert.ok(!ArrayBuffer.isView(valeur), `${chemin} est un tableau typé`);
  assert.ok(Array.isArray(valeur) || Object.getPrototypeOf(valeur) === Object.prototype, `${chemin} n'est ni une liste ni un objet simple`);
  for (const [cle2, element] of Object.entries(valeur)) sansTableauType(element, `${chemin}.${cle2}`);
}

describe('detailler (§ 12.9, D27)', () => {
  // Les deux configurations réunies : organisations, objectifs et animateurs.
  function complet() {
    const prepare = preparer({
      ...OBJECTIFS,
      personnes: OBJECTIFS.personnes.map(([id, , etiquettes], i) => [id, [AUBIER, RESSAC, null][i % 3], etiquettes, id === 7 ? [2] : undefined]),
      reservations: [...OBJECTIFS.reservations, auTour(7, 1, 2)],
    });
    const { instance, tableDe } = prepare;
    const { mesures, realises, aPriori, aMax } = mesurerTout(prepare);
    const options = optionsDe(prepare, { mesures, realises, aPriori });
    return { prepare, instance, tableDe, mesures, realises, aPriori, aMax, options };
  }

  test('réunit chaque fonction du détail sur le même plan, et ne rend aucun tableau typé', () => {
    const { instance, tableDe, mesures, realises, aPriori, aMax, options } = complet();
    const detail = detailler(instance, tableDe, options);
    sansTableauType(detail);
    const profil = profilRencontres(instance, mesures, realises, aPriori, aMax);
    assert.deepEqual(detail.profil, profil);
    assert.deepEqual(detail.synthese, synthese(profil));
    assert.deepEqual(detail.repartitionRencontres, repartition(mesures.rencontres, realises));
    assert.deepEqual(detail.collisions, {
      planchersValides: true,
      lignes: barresCollisions(instance, mesures, planchersParGroupe(instance, options.diagnostic.collisions), true, cle),
    });
    assert.deepEqual(detail.tables, mixTables(instance, tableDe, occupations(instance, tableDe, { affilies: true })));
    assert.deepEqual(detail.paires, pairesRepetees(instance, tableDe));
    assert.equal(detail.paires.choisies.length, mesures.rencontresRepetees.choisies);
    assert.equal(detail.paires.imposees.length, mesures.rencontresRepetees.imposees);
    const parcours = parcourirTours(instance, tableDe);
    const objectifs = objectifsParTour(instance, parcours, options.diagnostic.objectifsInevitables.parTour);
    assert.deepEqual(detail.objectifs, objectifs);
    const animateurs = profilAnimateurs(instance, mesures);
    assert.deepEqual(detail.animateurs, {
      profil: animateurs,
      repartition: repartition(animateurs.map(({ rencontres }) => rencontres), null),
      diversite: diversiteAnimateurs(instance, tableDe),
    });
    assert.deepEqual(
      detail.bornes,
      bornesDesTuiles(instance, {
        mesures,
        plafondsRealises: realises,
        aMax,
        profil,
        animateurs,
        objectifs,
        diagnostic: options.diagnostic,
        planchersValides: true,
        troisChiffres: options.troisChiffres,
      }),
    );
    assert.equal(detail.matrice, null);
  });

  test('la borne de diversité reçue sert telle quelle ; la matrice suit l’ordre demandé', () => {
    const { instance, tableDe, options } = complet();
    const aMax = new Array(instance.N).fill(1);
    const ordre = [4, 0, 2];
    const detail = detailler(instance, tableDe, { ...options, aMax, ordreMatrice: ordre });
    assert.ok(detail.profil.every(({ borneDiversite: b }) => b === 1));
    assert.deepEqual(detail.matrice, { ordre, comptes: matriceRencontres(instance, tableDe, ordre) });
    assert.notEqual(detail.matrice.ordre, ordre);
    sansTableauType(detail);
  });

  test('sans animateur ni personne concernée, les animateurs valent null ; hors du domaine, les barres n’ont qu’un segment', () => {
    const prepare = preparer(PROFIL);
    const { instance, tableDe } = prepare;
    const detail = detailler(instance, tableDe, optionsDe(prepare, mesurerTout(prepare), false));
    assert.equal(detail.animateurs, null);
    assert.equal(detail.objectifs, null);
    assert.ok(detail.collisions.lignes.every(({ prouve, reste }) => prouve === null && reste === null));
    assert.equal(detail.collisions.planchersValides, false);
  });

  test('hors du domaine des planchers, aucune tuile ne porte de plancher, même prouvé par le diagnostic', () => {
    // Cinq membres d'une organisation, 5 en réserve à chaque tour : deux
    // collisions par tour, 6 en tout, sous les 12 que le diagnostic prouve
    // pour un plan qui assoit chacun. Ce plancher ne tient pas ici.
    const prepare = preparer({ ...CINQ_MEMBRES, plan: [0, 1, 2].map(() => ({ 1: [1, 2, 6], 2: [3, 4] })) });
    const { instance, tableDe } = prepare;
    const lu = mesurerTout(prepare);
    const options = optionsDe(prepare, lu, false);
    assert.deepEqual(options.diagnostic.collisions.map(({ plancherCumulees }) => plancherCumulees), [12]);
    assert.equal(lu.mesures.collisionsCumulees, 6);
    const detail = detailler(instance, tableDe, options);
    assert.deepEqual(detail.bornes.planchers, SANS_PLANCHER);
    assert.equal(detail.collisions.planchersValides, false);
  });

  test('rouge : les trois chiffres reçus passent aux tuiles : le plancher de l’écart d’itinéraire, atteint ou non, aucun sous un plafond a priori inconnu', () => {
    for (const [plan, atteint] of [
      [PAR_LA_TABLE_DE_DEUX, true],
      [MEMES_A_LA_TABLE_DE_DEUX, false],
    ]) {
      const prepare = preparer({ ...ITINERAIRE, plan });
      const lu = mesurerTout(prepare);
      const detail = detailler(prepare.instance, prepare.tableDe, optionsDe(prepare, lu));
      assert.deepEqual(detail.bornes.planchers, { ...SANS_PLANCHER, ecartItineraireMax: { plancher: 1, atteint } }, `${atteint}`);
      const inconnu = detailler(prepare.instance, prepare.tableDe, optionsDe(prepare, { ...lu, aPriori: null }));
      assert.deepEqual(inconnu.bornes.planchers, SANS_PLANCHER, `${atteint}`);
    }
    // Les chiffres reçus font foi, même quand le plan en donnerait
    // d'autres : 1 reçu pour les mêmes à la table de deux, qui mesurent 2.
    const memes = preparer({ ...ITINERAIRE, plan: MEMES_A_LA_TABLE_DE_DEUX });
    const options = optionsDe(memes, mesurerTout(memes));
    assert.equal(options.troisChiffres.ecartItineraireMax.tous, 2);
    const recus = { ...options.troisChiffres, ecartItineraireMax: { ...options.troisChiffres.ecartItineraireMax, tous: 1 } };
    const detail = detailler(memes.instance, memes.tableDe, { ...options, troisChiffres: recus });
    assert.deepEqual(detail.bornes.planchers.ecartItineraireMax, { plancher: 1, atteint: true });
  });

  test('des animateurs sans personne concernée : le profil et sa répartition valent null, la diversité reste', () => {
    // 1 anime, seul présent : il ne se rencontre pas lui-même, et personne
    // d'autre ne peut le rejoindre.
    const prepare = preparer({
      personnes: [[1, null, undefined, [1]]],
      tables: [[1, 2]],
      reservations: [auTour(1, 1, 1)],
      plan: [{ 1: [1] }],
    });
    const { instance, tableDe } = prepare;
    const lu = mesurerTout(prepare);
    assert.equal(lu.mesures.animateurs, null);
    const detail = detailler(instance, tableDe, optionsDe(prepare, lu));
    assert.equal(detail.animateurs.profil, null);
    assert.equal(detail.animateurs.repartition, null);
    assert.equal(detail.animateurs.diversite.lignes.length, 1);
  });
});

describe('profilRencontres : la présence par tour (§ 12.3, § 12.6)', () => {
  // Deux tables de 3, trois tours. 1 est ancrée à la table 10. 5 n'est
  // présente qu'aux tours 1 et 3, assise à chacun. 4 n'est présente qu'aux
  // tours 1 et 3, et en réserve au tour 3.
  function prepareAbsences() {
    const configuration = {
      participants: [1, 2, 3, 4, 5].map((id) => ({
        id,
        nom: `P${id}`,
        organisation: null,
        ...(id >= 4 ? { presence: [1, 3] } : {}),
      })),
      tables: [{ id: 10, numero: 1, capacite: 3 }, { id: 20, numero: 2, capacite: 3 }],
      tours: 3,
      reservations: [tous(1, 10)],
      contraintes: SANS_CONTRAINTE,
    };
    const instance = normaliser(configuration);
    const tableDe = indexerPlan(instance, {
      tables: [10, 20],
      tours: [
        [[1, 2, 3], [4, 5]],
        [[1, 2], [3]],
        [[1, 3, 5], [2]],
      ],
      reserves: [[], [], [4]],
    });
    return { instance, tableDe };
  }

  test('une absente au tour 2, assise à ses autres tours : un tour absent, aucun tour non assis, la marque « absente »', () => {
    const prepare = prepareAbsences();
    const { instance } = prepare;
    const { mesures, realises, aPriori, aMax } = mesurerTout(prepare);
    const profil = profilRencontres(instance, mesures, realises, aPriori, aMax);
    const deId = (id) => profil.find(({ p }) => p === index(instance, id));
    assert.deepEqual([deId(5).toursAbsents, deId(5).toursNonAssis, deId(5).marque], [1, 0, 'absente']);
  });

  test('absente et en réserve : la réserve passe avant l’absence ; l’ancrée reste « ancre »', () => {
    const prepare = prepareAbsences();
    const { instance } = prepare;
    const { mesures, realises, aPriori, aMax } = mesurerTout(prepare);
    const profil = profilRencontres(instance, mesures, realises, aPriori, aMax);
    const deId = (id) => profil.find(({ p }) => p === index(instance, id));
    assert.deepEqual([deId(4).toursAbsents, deId(4).toursNonAssis, deId(4).marque], [1, 1, 'reserve']);
    assert.deepEqual([deId(1).toursAbsents, deId(1).toursNonAssis, deId(1).marque], [0, 0, 'ancre']);
    assert.deepEqual([2, 3].map((id) => [deId(id).toursAbsents, deId(id).toursNonAssis, deId(id).marque]), [[0, 0, null], [0, 0, null]]);
  });

  test('l’absence passe avant le plafond réalisé nul', () => {
    // Une table de 3, deux tours ; 2 n'est présente qu'au tour 2, seule à la
    // table 20 : plafond réalisé nul, mais absente au tour 1.
    const configuration = {
      participants: [{ id: 1, nom: 'P1', organisation: null }, { id: 2, nom: 'P2', organisation: null, presence: [2] }, { id: 3, nom: 'P3', organisation: null }],
      tables: [{ id: 10, numero: 1, capacite: 3 }, { id: 20, numero: 2, capacite: 3 }],
      tours: 2,
      reservations: [],
      contraintes: SANS_CONTRAINTE,
    };
    const instance = normaliser(configuration);
    const tableDe = indexerPlan(instance, { tables: [10, 20], tours: [[[1, 3], []], [[1, 3], [2]]], reserves: [[], []] });
    const { mesures, realises, aPriori, aMax } = mesurerTout({ instance, tableDe });
    const profil = profilRencontres(instance, mesures, realises, aPriori, aMax);
    const ligne = profil.find(({ p }) => p === index(instance, 2));
    assert.deepEqual([ligne.plafondRealise, ligne.toursAbsents, ligne.toursNonAssis, ligne.marque], [0, 1, 0, 'absente']);
  });
});

describe('qualite : la source du module', () => {
  const source = readFileSync(new URL('./qualite.js', import.meta.url), 'utf8');

  test('rouge : aucune mesure de la ligne d’évaluation recomptée : les trois chiffres se reçoivent', () => {
    assert.doesNotMatch(source, /\btroisChiffres\(/);
    // Ni importés sous un autre nom : aucun import n'en nomme.
    assert.doesNotMatch(source, /^import[^;]*\btroisChiffres\b/m);
  });

  test('aucun couple possible ni correspondance relus : les comptes par tour viennent de parcourirTours', () => {
    assert.doesNotMatch(source, /\bpossible\[/);
    assert.doesNotMatch(source, /\bcorrespond\[/);
    assert.doesNotMatch(source, /\bobjectifDe\[/);
  });

  test('une seule multiplication par cent : celle de pourcentage', () => {
    assert.equal(source.match(/\b100\s*\*/g).length, 1);
  });

  test('aucun plan relu case à case : le détail lit le parcours et l’occupation', () => {
    assert.doesNotMatch(source, /\btableDe\[/);
  });
});

// La tête des colonnes de la comparaison et les planchers des colonnes
// (§ 12.10.6, D67, D84, C20). Les valeurs attendues sont comptées à la main
// dans le commentaire de chaque configuration, plus haut. bornesDeReference
// calcule les bornes des tuiles sans teteDesColonnes ni planchersAtteints :
// rang 1 lu dans le profil trié, soirée lue dans les objectifs par tour,
// planchers sommés du diagnostic. bornesDesTuiles lui est égal en copie
// profonde sur chaque configuration de ce fichier et sur les neuf cents plans
// de la petite.

// Les colonnes de collisions, le champ du plancher de chaque organisation
// dans le diagnostic ; les colonnes des objectifs, leur champ dans
// objectifsInevitables comme dans mesures.objectifs.
const COLLISIONS_DE_REFERENCE = [
  ['collisionsCumulees', 'plancherCumulees'],
  ['pairesDistinctes', 'plancherPairesDistinctes'],
  ['excedentCollisions', 'plancherExcedent'],
];
const OBJECTIFS_DE_REFERENCE = [
  ['jamaisServies', 'jamaisServies'],
  ['horsObjectifMax', 'horsObjectifMax'],
  ['toursHorsObjectif', 'horsObjectif'],
];

// Les bornes des tuiles calculées sans teteDesColonnes ni planchersAtteints :
// rang 1 lu dans le profil, minimum de s(p) par un parcours des index, soirée
// lue dans les objectifs par tour, planchers sommés du diagnostic.
function bornesDeReference(instance, { mesures, plafondsRealises, aMax, profil, animateurs, objectifs, diagnostic, planchersValides, troisChiffres: chiffres }) {
  const { N, indexDe, groupes, etatCriteres } = instance;
  const premierIndex = (estCandidat, avant) => {
    let tete = null;
    for (let p = 0; p < N; p += 1) if (estCandidat(p) && (tete === null || avant(p, tete))) tete = p;
    return tete;
  };
  let rang1 = null;
  let manque = null;
  if (profil.length > 0) {
    const { p, rencontres, plafondRealise, plafondAPriori, pourcent } = profil[0];
    rang1 = { p, rencontres, plafondRealise, plafondAPriori, pourcent };
    const manquesLus = manques(plafondsRealises, mesures.rencontres);
    const [tete] = profilManque(instance, manquesLus, plafondsRealises);
    const q = indexDe.get(tete.id);
    // L'effectif au manque maximal, compté sur la liste des manques.
    const effectif = Array.from(manquesLus).filter((valeur) => valeur === tete.manque).length;
    manque = { p: q, plafondRealise: plafondsRealises[q], effectif };
  }
  let diversite = null;
  if (groupes.length > 0) {
    const A = mesures.organisationsVues;
    const p = premierIndex(() => true, (x, y) => A[x] < A[y] || (A[x] === A[y] && aMax[x] > aMax[y]));
    diversite = { p, aMax: aMax[p] };
  }
  let parObjectif = null;
  let soiree = null;
  if (mesures.objectifs !== null) {
    const { tours: s, possibles: P, jamaisServies } = mesures.objectifs;
    const p = premierIndex((x) => P[x] > 0, (x, y) => s[x] < s[y] || (s[x] === s[y] && P[x] > P[y]));
    parObjectif = { p, servis: s[p], possibles: P[p], pourcent: pourcentage(s[p], P[p]) };
    const { servis, possibles, pourcent } = objectifs.soiree;
    soiree = { servis, possibles, pourcent, jamaisServies };
  }
  const plancher = (valeur, mesure) => (valeur > 0 ? { plancher: valeur, atteint: mesure === valeur } : null);
  const planchers = { ...SANS_PLANCHER };
  if (planchersValides) {
    if (instance.pairesEnConflit > 0) {
      planchers.conflitsOrganisation = plancher(diagnostic.conflitsImposes, mesures.conflitsOrganisation);
    }
    for (const [colonne, champ] of COLLISIONS_DE_REFERENCE) {
      planchers[colonne] = plancher(somme(diagnostic.collisions.map((ligne) => ligne[champ] ?? 0)), mesures[colonne]);
    }
    if (diagnostic.ecartItineraire !== null && chiffres.ecartItineraireMax !== null) {
      planchers.ecartItineraireMax = plancher(diagnostic.ecartItineraire.plancher, chiffres.ecartItineraireMax.tous);
    }
    const critere = etatCriteres.find(({ nom }) => nom === 'toursHorsObjectif');
    if (critere.coche && !critere.sansObjet) {
      for (const [colonne, champ] of OBJECTIFS_DE_REFERENCE) {
        if (critere.valeurs.includes(colonne)) planchers[colonne] = plancher(diagnostic.objectifsInevitables[champ], mesures.objectifs[champ]);
      }
    }
  }
  return {
    rang1,
    manque,
    diversite,
    animateurs: animateurs === null ? null : { p: animateurs[0].p, borne: animateurs[0].borne },
    objectifs: parObjectif,
    soiree,
    planchers,
  };
}

// Ce que bornesDesTuiles lit pour un plan préparé : tout, objectifs par tour
// et profil des animateurs compris, sous le plafond a priori calculé ou
// inconnu, dans le domaine des planchers ou non.
function lusDuPlan(prepare, { planchersValides = true, aPrioriConnu = true } = {}) {
  const { instance } = prepare;
  const { mesures, realises, aPriori, aMax } = mesurerTout(prepare);
  const plafonds = aPrioriConnu ? aPriori : null;
  return {
    mesures,
    plafondsRealises: realises,
    aMax,
    profil: profilRencontres(instance, mesures, realises, plafonds, aMax),
    animateurs: profilAnimateurs(instance, mesures),
    objectifs: objectifsDe(prepare).objectifs,
    ...duDiagnostic(prepare, plafonds, planchersValides),
  };
}

// Six personnes, la sixième seule à la table 30 aux deux tours : plafond
// réalisé nul, aucune rencontre. Elle est au rang 1 du profil, à 0
// rencontre, avant la septième, en réserve au tour 2, au même plafond nul
// (épreuve des marques de profilRencontres).
const PLAFOND_NUL = {
  personnes: [[1], [2], [3], [4], [5], [6], [7]],
  tables: [[10, 2], [20, 2], [30, 2], [40, 2]],
  plan: [
    { 10: [1, 3], 20: [2, 4], 30: [6], 40: [7] },
    { 10: [1, 5], 20: [3, 4], 30: [6] },
  ],
  reservations: [tous(1, 10), auTour(2, 20, 1)],
};

// Chaque configuration préparée de ce fichier, sous son nom, avec ses
// variantes de mode et de critère : celles des épreuves de bornesDesTuiles.
function configurationsDuFichier() {
  const decoche = (modeObjectifs) => ({ ...DEUX_SIEGES, plan: QUATRE_SERVIES, modeObjectifs, contraintes: { ...SANS_CONTRAINTE, respecterObjectifs: false } });
  return [
    ['PROFIL', PROFIL],
    ['PLAFOND_NUL', PLAFOND_NUL],
    ['OBJECTIFS', OBJECTIFS],
    ['COLLISIONS', COLLISIONS],
    ['ANIMATEURS', ANIMATEURS],
    ['CINQ_MEMBRES, mêmes tables', { ...CINQ_MEMBRES, plan: MEMES_TABLES }],
    ['CINQ_MEMBRES, tables variées', { ...CINQ_MEMBRES, plan: TABLES_VARIEES }],
    ['CINQ_MEMBRES, cinq en réserve', { ...CINQ_MEMBRES, plan: [0, 1, 2].map(() => ({ 1: [1, 2, 6], 2: [3, 4] })) }],
    ['ITINERAIRE, par la table de deux', { ...ITINERAIRE, plan: PAR_LA_TABLE_DE_DEUX }],
    ['ITINERAIRE, mêmes à la table de deux', { ...ITINERAIRE, plan: MEMES_A_LA_TABLE_DE_DEUX }],
    ...['places', 'chacun', 'minimum'].flatMap((modeObjectifs) => [
      [`DEUX_SIEGES, ${modeObjectifs}`, { ...DEUX_SIEGES, plan: QUATRE_SERVIES, modeObjectifs }],
      [`DEUX_SIEGES décoché, ${modeObjectifs}`, decoche(modeObjectifs)],
    ]),
    ['DEUX_SIEGES, siège cédé', { ...DEUX_SIEGES, plan: [QUATRE_SERVIES[0], { 1: [3, 6], 2: [1, 2, 4, 5] }] }],
  ].map(([nom, donnees]) => [nom, preparer(donnees)]);
}

describe('teteDesColonnes (§ 12.10.6, D67, D28)', () => {
  test('rouge : le rang 1 du profil des rencontres, ses rencontres, son plafond réalisé et leur pourcentage, sans plafond a priori', () => {
    const prepare = preparer(PROFIL);
    const { instance } = prepare;
    const { mesures, realises } = mesurerTout(prepare);
    const tete = teteDesColonnes(instance, mesures, realises);
    assert.deepEqual(tete.rang1, { p: index(instance, 1), rencontres: 2, plafondRealise: 2, pourcent: 100 });
    assert.deepEqual(Object.keys(tete.rang1), ['p', 'rencontres', 'plafondRealise', 'pourcent']);
    // Aucun objectif : ni minimum de s(p), ni soirée.
    assert.equal(tete.objectifs, null);
    assert.equal(tete.soiree, null);
  });

  test('rouge : plafond réalisé nul au rang 1 : le pourcentage vaut null, jamais 0, les comptes restent', () => {
    const prepare = preparer(PLAFOND_NUL);
    const { instance } = prepare;
    const { mesures, realises } = mesurerTout(prepare);
    assert.deepEqual(teteDesColonnes(instance, mesures, realises).rang1, { p: index(instance, 6), rencontres: 0, plafondRealise: 0, pourcent: null });
  });

  test('rouge : le minimum de s(p) parmi les concernées, et la soirée, Σ s(p) sur Σ P(p), jamais une moyenne des personnes', () => {
    // s(p) : 1, 1, 1, 0, 0, 2 ; P(p) : 2, 2, 2, 1, 2, 2 ; 7, 8 et 9 ne sont
    // pas concernées. Σ s = 5, Σ P = 11 : 45 %. La moyenne des pourcentages
    // par personne, (50 + 50 + 50 + 0 + 0 + 100) / 6, en donnerait 41.
    const prepare = preparer(OBJECTIFS);
    const { instance, tableDe } = prepare;
    const { mesures, realises } = mesurerTout(prepare);
    const tete = teteDesColonnes(instance, mesures, realises);
    assert.deepEqual(tete.objectifs, { p: index(instance, 5), servis: 0, possibles: 2, pourcent: 0 });
    assert.deepEqual(tete.soiree, { servis: 5, possibles: 11, pourcent: 45, jamaisServies: 2 });
    assert.equal(tete.soiree.jamaisServies, mesurer(instance, tableDe).objectifs.jamaisServies);
  });

  test('une personne à un seul tour possible est concernée : jamais servie, elle porte le minimum de s(p)', () => {
    // 5 servi au tour 2 à la place de 7 : s(p) 1, 1, 1, 0, 1, 2 ; 4, à P(p)
    // = 1, reste seule au minimum.
    const prepare = preparer({ ...OBJECTIFS, plan: [OBJECTIFS.plan[0], { 1: [6, 3, 5], 2: [1, 2, 8], 3: [4, 7] }, OBJECTIFS.plan[2]] });
    const { mesures, realises } = mesurerTout(prepare);
    assert.deepEqual(mesures.objectifs.tours.slice(0, 6), [1, 1, 1, 0, 1, 2]);
    assert.deepEqual(teteDesColonnes(prepare.instance, mesures, realises).objectifs, {
      p: index(prepare.instance, 4),
      servis: 0,
      possibles: 1,
      pourcent: 0,
    });
  });

  test('sans personne présente : rang 1, objectifs et soirée null', () => {
    const configuration = {
      participants: [{ id: 1, nom: 'P1', organisation: AUBIER, exclu: true }],
      tables: [{ id: 1, numero: 1, capacite: 2 }],
      tours: 1,
      reservations: [],
      contraintes: SANS_CONTRAINTE,
    };
    const vide = normaliser(configuration);
    const plan = new Int32Array(0);
    assert.deepEqual(teteDesColonnes(vide, mesurer(vide, plan), []), { rang1: null, objectifs: null, soiree: null });
  });

  test('ne lit que les mesures et les plafonds réalisés : un plafond réalisé d’une autre population lève RangeError', () => {
    const prepare = preparer(PROFIL);
    const { mesures, realises } = mesurerTout(prepare);
    assert.throws(() => teteDesColonnes(prepare.instance, mesures, realises.slice(1)), RangeError);
    assert.throws(() => teteDesColonnes(prepare.instance, { ...mesures, rencontres: mesures.rencontres.slice(1) }, realises), RangeError);
  });

  test('sur chacun des neuf cents plans de la petite configuration : la soirée égale celle des objectifs par tour, et le rang 1 la tête du profil trié', () => {
    const configuration = {
      participants: [
        participant([1, AUBIER, ['finance']]),
        participant([2, AUBIER, ['finance']]),
        participant([3, RESSAC, ['finance']]),
        participant([4, RESSAC]),
        participant([5, null, ['finance']]),
        participant([6]),
      ],
      tables: [{ id: 1, numero: 1, capacite: 2 }, { id: 2, numero: 2, capacite: 2 }, { id: 3, numero: 3, capacite: 2 }],
      tours: 2,
      reservations: [tous(1, 1)],
      contraintes: SANS_CONTRAINTE,
      objectifs: [
        { table: 1, tour: null, regle: 'ou', etiquettes: ['finance'] },
        { table: 2, tour: 2, regle: 'ou', etiquettes: ['finance'] },
      ],
    };
    const instance = normaliser(configuration);
    const diagnostic = diagnostiquer(configuration);
    const aPriori = plafondsAPriori(instance);
    let plans = 0;
    for (const tableDe of tousLesPlans(instance)) {
      plans += 1;
      const mesures = mesurer(instance, tableDe);
      const realises = plafondsRealises(instance, tableDe);
      const tete = teteDesColonnes(instance, mesures, realises);
      const { soiree } = objectifsParTour(instance, parcourirTours(instance, tableDe), diagnostic.objectifsInevitables.parTour);
      assert.deepEqual(tete.soiree, { servis: soiree.servis, possibles: soiree.possibles, pourcent: soiree.pourcent, jamaisServies: mesures.objectifs.jamaisServies });
      const [premiere] = profilRencontres(instance, mesures, realises, aPriori, borneDiversite(instance, tableDe).aMax);
      assert.deepEqual(tete.rang1, { p: premiere.p, rencontres: premiere.rencontres, plafondRealise: premiere.plafondRealise, pourcent: premiere.pourcent });
    }
    assert.equal(plans, 900);
  });
});

describe('bornesDesTuiles lit teteDesColonnes et planchersAtteints (§ 12.2, D67)', () => {
  test('sur chaque configuration de ce fichier, la même valeur que bornesDeReference, copie profonde comparée : plafond a priori calculé ou inconnu, dans le domaine des planchers ou non', () => {
    const configurations = configurationsDuFichier();
    assert.equal(configurations.length, 17);
    for (const [nom, prepare] of configurations) {
      for (const options of [{}, { aPrioriConnu: false }, { planchersValides: false }]) {
        const lus = lusDuPlan(prepare, options);
        assert.deepEqual(bornesDesTuiles(prepare.instance, lus), bornesDeReference(prepare.instance, lus), `${nom}, ${JSON.stringify(options)}`);
      }
    }
  });

  test('sur chacun des neuf cents plans de la petite configuration, la même valeur que bornesDeReference', () => {
    const configuration = {
      participants: [
        participant([1, AUBIER, ['finance']]),
        participant([2, AUBIER, ['finance']]),
        participant([3, RESSAC, ['finance']]),
        participant([4, RESSAC]),
        participant([5, null, ['finance']]),
        participant([6]),
      ],
      tables: [{ id: 1, numero: 1, capacite: 2 }, { id: 2, numero: 2, capacite: 2 }, { id: 3, numero: 3, capacite: 2 }],
      tours: 2,
      reservations: [tous(1, 1)],
      contraintes: SANS_CONTRAINTE,
      objectifs: [
        { table: 1, tour: null, regle: 'ou', etiquettes: ['finance'] },
        { table: 2, tour: 2, regle: 'ou', etiquettes: ['finance'] },
      ],
    };
    const instance = normaliser(configuration);
    let plans = 0;
    for (const tableDe of tousLesPlans(instance)) {
      plans += 1;
      const lus = lusDuPlan({ configuration, instance, tableDe });
      assert.deepEqual(bornesDesTuiles(instance, lus), bornesDeReference(instance, lus));
    }
    assert.equal(plans, 900);
  });

  test('rouge : la soirée se lit dans teteDesColonnes : des objectifs par tour absents n’y changent rien', () => {
    const prepare = preparer(OBJECTIFS);
    const lus = lusDuPlan(prepare);
    const sans = bornesDesTuiles(prepare.instance, { ...lus, objectifs: undefined });
    assert.deepEqual(sans, bornesDesTuiles(prepare.instance, lus));
    assert.deepEqual(sans.soiree, { servis: 5, possibles: 11, pourcent: 45, jamaisServies: 2 });
  });

  test('rouge : le rang 1 se lit dans teteDesColonnes : un profil forgé n’en fournit que le plafond a priori', () => {
    const prepare = preparer(PROFIL);
    const { instance } = prepare;
    const lus = lusDuPlan(prepare);
    const tete = teteDesColonnes(instance, lus.mesures, lus.plafondsRealises).rang1;
    // La deuxième ligne du profil (personne 4 : 3 rencontres, plafond 4, 75 %)
    // passe en tête, avec un plafond a priori qu'aucune mesure ne donne.
    const forgee = { ...lus.profil[1], plafondAPriori: 17 };
    assert.notEqual(forgee.p, tete.p);
    assert.notEqual(forgee.rencontres, tete.rencontres);
    assert.notEqual(forgee.plafondRealise, tete.plafondRealise);
    assert.notEqual(forgee.pourcent, tete.pourcent);
    const bornes = bornesDesTuiles(instance, { ...lus, profil: [forgee, ...lus.profil.slice(2)] });
    assert.deepEqual(bornes.rang1, { ...tete, plafondAPriori: 17 });
  });

  test('rouge : la source de bornesDesTuiles appelle teteDesColonnes et planchersAtteints, et ne calcule aucun pourcentage elle-même', () => {
    const source = readFileSync(new URL('./qualite.js', import.meta.url), 'utf8');
    const debut = source.indexOf('export function bornesDesTuiles(');
    const corps = source.slice(debut, source.indexOf('\n}\n', debut));
    assert.ok(debut > 0);
    assert.match(corps, /\bteteDesColonnes\(/);
    assert.match(corps, /\bplanchersDe\(|\bplanchersAtteints\(/);
    assert.doesNotMatch(corps, /\bpourcentage\(/);
    assert.doesNotMatch(corps, /\bpremier\(N, \(x\) => P\[x\]/);
  });
});

describe('planchersDesColonnes (§ 12.2, § 5.6, D84)', () => {
  test('rouge : la somme des planchers de collisions du diagnostic, 0 quand il se tait ; l’écart d’itinéraire, null sans plancher a priori', () => {
    const memes = preparer({ ...CINQ_MEMBRES, plan: MEMES_TABLES });
    assert.deepEqual(planchersDesColonnes(memes.instance, diagnostiquer(memes.configuration)), {
      conflitsOrganisation: null,
      collisionsCumulees: 12,
      pairesDistinctes: 4,
      excedentCollisions: 2,
      ecartItineraireMax: null,
      jamaisServies: null,
      horsObjectifMax: null,
      toursHorsObjectif: null,
    });
    const rien = preparer(PROFIL);
    assert.deepEqual(planchersDesColonnes(rien.instance, diagnostiquer(rien.configuration)), {
      ...SANS_PLANCHER,
      collisionsCumulees: 0,
      pairesDistinctes: 0,
      excedentCollisions: 0,
    });
    const itineraire = preparer({ ...ITINERAIRE, plan: PAR_LA_TABLE_DE_DEUX });
    assert.equal(planchersDesColonnes(itineraire.instance, diagnostiquer(itineraire.configuration)).ecartItineraireMax, 1);
  });

  test('rouge : les objectifs, chaque valeur que le mode réglé compare, critère coché ; un plancher nul reste 0', () => {
    const objectifsDu = (donnees) => {
      const { instance, configuration } = preparer(donnees);
      const { jamaisServies, horsObjectifMax, toursHorsObjectif } = planchersDesColonnes(instance, diagnostiquer(configuration));
      return [jamaisServies, horsObjectifMax, toursHorsObjectif];
    };
    assert.deepEqual(objectifsDu({ ...DEUX_SIEGES, plan: QUATRE_SERVIES }), [null, null, 6]);
    assert.deepEqual(objectifsDu({ ...DEUX_SIEGES, plan: QUATRE_SERVIES, modeObjectifs: 'chacun' }), [1, null, 6]);
    assert.deepEqual(objectifsDu({ ...DEUX_SIEGES, plan: QUATRE_SERVIES, modeObjectifs: 'minimum' }), [null, 2, 6]);
    const large = {
      ...DEUX_SIEGES,
      tables: [[1, 5], [2, 2]],
      plan: [
        { 1: [1, 2, 3, 4, 5], 2: [6] },
        { 1: [1, 2, 3, 4, 5], 2: [6] },
      ],
    };
    assert.deepEqual(objectifsDu(large), [null, null, 0]);
  });

  test('rouge : critère des objectifs décoché : aucun plancher des objectifs, sous aucun mode', () => {
    for (const modeObjectifs of ['places', 'chacun', 'minimum']) {
      const { instance, configuration } = preparer({
        ...DEUX_SIEGES,
        plan: QUATRE_SERVIES,
        modeObjectifs,
        contraintes: { ...SANS_CONTRAINTE, respecterObjectifs: false },
      });
      const planchers = planchersDesColonnes(instance, diagnostiquer(configuration));
      assert.deepEqual([planchers.jamaisServies, planchers.horsObjectifMax, planchers.toursHorsObjectif], [null, null, null], modeObjectifs);
    }
  });
});

describe('planchersAtteints (§ 12.2, B11)', () => {
  // Des planchers de colonnes forgés, et les mesures d'un plan qui en égale
  // certains : 12 collisions cumulées, 4 paires distinctes, un excédent de 8 ;
  // un écart d'itinéraire maximal de 2 ; 6 tours hors objectif, 1 personne
  // jamais servie, 2 tours hors objectif au plus pour une personne.
  const planchers = {
    conflitsOrganisation: null,
    collisionsCumulees: 12,
    pairesDistinctes: 0,
    excedentCollisions: 2,
    ecartItineraireMax: 2,
    jamaisServies: 1,
    horsObjectifMax: null,
    toursHorsObjectif: 7,
  };
  const mesures = {
    collisionsCumulees: 12,
    pairesDistinctes: 4,
    excedentCollisions: 8,
    objectifs: { horsObjectif: 6, jamaisServies: 1, horsObjectifMax: 2 },
  };
  const chiffres = { ecartItineraireMax: { tous: 2, mobiles: 2, ancres: null } };

  test('rouge : par colonne {plancher, atteint}, atteint quand la mesure l’égale ; null pour un plancher nul ou absent', () => {
    assert.deepEqual(planchersAtteints(planchers, { mesures, troisChiffres: chiffres, planchersValides: true }), {
      conflitsOrganisation: null,
      collisionsCumulees: { plancher: 12, atteint: true },
      pairesDistinctes: null,
      excedentCollisions: { plancher: 2, atteint: false },
      ecartItineraireMax: { plancher: 2, atteint: true },
      jamaisServies: { plancher: 1, atteint: true },
      horsObjectifMax: null,
      toursHorsObjectif: { plancher: 7, atteint: false },
    });
  });

  test('rouge : hors du domaine des planchers, tous null ; une ligne sans écart d’itinéraire, aucun pour lui', () => {
    assert.deepEqual(planchersAtteints(planchers, { mesures, troisChiffres: chiffres, planchersValides: false }), SANS_PLANCHER);
    assert.equal(planchersAtteints(planchers, { mesures, troisChiffres: { ecartItineraireMax: null }, planchersValides: true }).ecartItineraireMax, null);
  });

  test("rouge : le conflit d'organisation porte les conflits que les réservations imposent, quand il a un objet ; atteint quand la mesure les égale", () => {
    const etatAvec = (sansObjet) => ({
      etatCriteres: [
        { nom: 'toursHorsObjectif', coche: true, sansObjet: true, valeurs: ['toursHorsObjectif'] },
        { nom: 'conflitsOrganisation', coche: true, sansObjet, valeurs: ['conflitsOrganisation'] },
      ],
    });
    const diagnostic = { collisions: [], ecartItineraire: null, objectifsInevitables: null, conflitsImposes: 2 };
    assert.equal(planchersDesColonnes(etatAvec(false), diagnostic).conflitsOrganisation, 2);
    assert.equal(planchersDesColonnes(etatAvec(true), diagnostic).conflitsOrganisation, null);
    const lus = (conflitsOrganisation, planchersValides = true) =>
      planchersAtteints({ ...planchers, conflitsOrganisation: 2 }, {
        mesures: { ...mesures, conflitsOrganisation }, troisChiffres: chiffres, planchersValides,
      }).conflitsOrganisation;
    assert.deepEqual(lus(2), { plancher: 2, atteint: true });
    assert.deepEqual(lus(5), { plancher: 2, atteint: false });
    assert.equal(lus(2, false), null);
    // Un plancher nul ne s'écrit pas.
    const nul = planchersAtteints({ ...planchers, conflitsOrganisation: 0 }, {
      mesures: { ...mesures, conflitsOrganisation: 0 }, troisChiffres: chiffres, planchersValides: true,
    });
    assert.equal(nul.conflitsOrganisation, null);
  });

  test('des objectifs sans plancher ne lisent pas les mesures des objectifs, absentes sans personne concernée', () => {
    const sansObjectif = { ...planchers, jamaisServies: null, toursHorsObjectif: null };
    const lus = planchersAtteints(sansObjectif, { mesures: { ...mesures, objectifs: null }, troisChiffres: chiffres, planchersValides: true });
    assert.deepEqual([lus.jamaisServies, lus.horsObjectifMax, lus.toursHorsObjectif], [null, null, null]);
  });

  test('composés, ils redonnent les planchers des tuiles sur chaque configuration de ce fichier', () => {
    for (const [nom, prepare] of configurationsDuFichier()) {
      for (const options of [{}, { aPrioriConnu: false }, { planchersValides: false }]) {
        const lus = lusDuPlan(prepare, options);
        assert.deepEqual(
          planchersAtteints(planchersDesColonnes(prepare.instance, lus.diagnostic), lus),
          bornesDesTuiles(prepare.instance, lus).planchers,
          `${nom}, ${JSON.stringify(options)}`,
        );
      }
    }
  });
});
