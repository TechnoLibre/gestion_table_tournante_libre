// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves des appartenances tirées (§ 15.2) : la loi des tailles, la
// troncature du dernier groupe, les deux inégalités et le tour témoin. Les
// bornes de la loi sont calculées à la main depuis le tableau des poids du
// § 15.2 ; le tour témoin se compare à une recherche exhaustive sur toutes les
// petites instances d'un domaine fixé.
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { describe, test } from '../../test/lanceur.js';
import { POIDS_TAILLES, faisabilite, tirerTailles, tourTemoin } from './appartenances.js';
import { FLUX, creerPcg32 } from './prng.js';

// Générateur scripté : borne(n) rend les valeurs données, dans l'ordre, et
// note chaque n reçu. Un tirage de plus que prévu lève.
function scripte(valeurs) {
  const recus = [];
  return {
    recus,
    borne(n) {
      recus.push(n);
      if (recus.length > valeurs.length) throw new Error(`tirage ${recus.length} non prévu`);
      return valeurs[recus.length - 1];
    },
  };
}

const somme = (liste) => liste.reduce((a, b) => a + b, 0);

// Écarts d'un tour à la définition du tour témoin, une ligne chacun : un index
// de table par membre, les membres numérotés groupe après groupe ; aucune
// table au-delà de sa capacité ; aucun groupe deux fois à une même table.
function ecartsDuTour(tailles, capacites, tour) {
  if (!Array.isArray(tour) || tour.length !== somme(tailles)) {
    return [`${tour?.length} index de table pour ${somme(tailles)} membres`];
  }
  const ecarts = [];
  const occupation = capacites.map(() => 0);
  let membre = 0;
  for (let g = 0; g < tailles.length; g += 1) {
    const tablesDuGroupe = new Set();
    for (let m = 0; m < tailles[g]; m += 1, membre += 1) {
      const t = tour[membre];
      if (!Number.isInteger(t) || t < 0 || t >= capacites.length) {
        ecarts.push(`membre ${membre} : table ${t}`);
        continue;
      }
      if (tablesDuGroupe.has(t)) ecarts.push(`groupe ${g} : deux membres à la table ${t}`);
      tablesDuGroupe.add(t);
      occupation[t] += 1;
    }
  }
  for (let t = 0; t < capacites.length; t += 1) {
    if (occupation[t] > capacites[t]) {
      ecarts.push(`table ${t} : ${occupation[t]} membres pour ${capacites[t]} sièges`);
    }
  }
  return ecarts;
}

// Vrai quand un tour sépare tous les groupes : chaque groupe essaie toutes les
// combinaisons de tables distinctes qui ont encore un siège.
function existeTour(tailles, capacites) {
  const libres = [...capacites];
  const placer = (g) => {
    if (g === tailles.length) return true;
    const choisir = (depuis, restants) => {
      if (restants === 0) return placer(g + 1);
      for (let t = depuis; t < libres.length; t += 1) {
        if (libres[t] === 0) continue;
        libres[t] -= 1;
        const trouve = choisir(t + 1, restants - 1);
        libres[t] += 1;
        if (trouve) return true;
      }
      return false;
    };
    return choisir(0, tailles[g]);
  };
  return placer(0);
}

// Suites de longueur 1 à longueurMax, de valeurs 1 à valeurMax.
function suites(longueurMax, valeurMax) {
  const toutes = [];
  const etendre = (prefixe) => {
    if (prefixe.length > 0) toutes.push(prefixe);
    if (prefixe.length === longueurMax) return;
    for (let v = 1; v <= valeurMax; v += 1) etendre([...prefixe, v]);
  };
  etendre([]);
  return toutes;
}

describe('appartenances : la loi des tailles', () => {
  test('les poids du § 15.2, tailles 1 à 12, somme 92', () => {
    assert.deepEqual(POIDS_TAILLES, [24, 20, 16, 8, 6, 5, 4, 3, 2, 2, 1, 1]);
    assert.ok(Object.isFrozen(POIDS_TAILLES));
  });

  test('un borne(92) par groupe, lu sur les poids cumulés, à chaque frontière', () => {
    // Poids cumulés 24, 44, 60, 68, 74, 79, 83, 86, 88, 90, 91, 92 : la
    // taille s couvre les tirages de la somme des s − 1 premiers poids à celle
    // des s premiers, moins un. Chaque taille est tirée à ses deux bords.
    const valeurs = [0, 23, 24, 43, 44, 59, 60, 67, 68, 73, 74, 78, 79, 82, 83, 85, 86, 87, 88, 89, 90, 91];
    const tailles = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 12];
    const rng = scripte(valeurs);
    assert.deepEqual(tirerTailles(rng, somme(tailles)), tailles);
    assert.deepEqual(rng.recus, valeurs.map(() => 92));
  });

  test('le tirage s’arrête quand la somme atteint le total, le dernier groupe tronqué au reste', () => {
    // [valeurs scriptées, total, tailles attendues]
    const cas = [
      [[91, 91, 91], 30, [12, 12, 6]],
      [[91], 5, [5]],
      [[0], 1, [1]],
      [[24, 0], 3, [2, 1]],
      [[], 0, []],
    ];
    const ecarts = cas
      .map(([valeurs, total, attendu]) => {
        const rng = scripte(valeurs);
        const obtenu = tirerTailles(rng, total);
        return { total, attendu, obtenu, tirages: rng.recus.length, prevus: valeurs.length };
      })
      .filter(({ attendu, obtenu, tirages, prevus }) => !isDeepStrictEqual(obtenu, attendu) || tirages !== prevus)
      .map(({ total, attendu, obtenu, tirages }) =>
        `total ${total} : ${JSON.stringify(obtenu)} en ${tirages} tirages, ${JSON.stringify(attendu)} attendu`);
    assert.deepEqual(ecarts, []);
  });

  test('sous PCG32, les tailles couvrent 260 membres, chacune de 1 à 12', () => {
    const ecarts = [];
    for (let graine = 0; graine < 100; graine += 1) {
      const tailles = tirerTailles(creerPcg32(graine, FLUX.DEMO), 260);
      if (somme(tailles) !== 260) ecarts.push(`graine ${graine} : somme ${somme(tailles)}`);
      if (tailles.some((s) => !Number.isInteger(s) || s < 1 || s > 12)) {
        ecarts.push(`graine ${graine} : ${JSON.stringify(tailles)}`);
      }
    }
    assert.deepEqual(ecarts, []);
  });

  test('un total qui n’est pas un entier ≥ 0 lève RangeError', () => {
    for (const total of [-1, 2.5, Number.NaN, '260', undefined]) {
      assert.throws(() => tirerTailles(scripte([]), total), RangeError, String(total));
    }
  });
});

describe('appartenances : les deux inégalités', () => {
  // [tailles, capacités, verdict attendu, ce que le cas exerce]
  const CAS = [
    [[3, 3, 3, 3], [10, 1, 1], { ok: false, raison: 'PLUS_GRANDE_CAPACITE' },
      '§ 15.2 : la table de 10 exigerait 10 appartenances distinctes'],
    [[2, 2], [3, 1], { ok: false, raison: 'PLUS_GRANDE_CAPACITE' },
      'salle pleine : une table de 3 pour 2 groupes'],
    [[2, 2, 2], [5, 2], { ok: false, raison: 'PLUS_GRANDE_CAPACITE' },
      'une place vide : la table de 5 reçoit au moins 4 membres, pour 3 groupes'],
    [[4, 2], [3, 3, 3], { ok: false, raison: 'PLUS_GROS_GROUPE' }, 'un groupe de 4 pour 3 tables'],
    [[3, 2, 1], [3, 3], { ok: false, raison: 'PLUS_GROS_GROUPE' }, 'un groupe de 3 pour 2 tables'],
    [[3, 3, 3, 3], [10, 1], { ok: false, raison: 'PLUS_GROS_GROUPE' },
      'les deux rompues : la première est nommée'],
    [[2, 2, 1], [3, 2], { ok: true }, 'les deux inégalités à égalité'],
    [[2, 2, 2], [4, 3], { ok: true },
      'une place vide : la table de 4 reçoit au moins 3 membres, pour 3 groupes'],
    [[1, 1, 1], [8, 2], { ok: true }, 'sept places vides'],
    [[2, 2], [2, 1], { ok: true },
      'salle trop petite : aucune place vide, la table de 2 tient dans 2 groupes'],
    [[2, 2, 2], [4, 1], { ok: false, raison: 'PLUS_GRANDE_CAPACITE' },
      'salle trop petite : aucune place vide, la table de 4 dépasse 3 groupes'],
    [[3, 3, 3, 1, 1, 1], [6, 4, 2], { ok: true }, 'inégalités tenues, sans tour pourtant'],
    [[], [8], { ok: true }, 'aucun membre'],
  ];

  test('chaque cas reçoit son verdict', () => {
    const ecarts = CAS
      .map(([tailles, capacites, attendu, quoi]) => ({ quoi, attendu, obtenu: faisabilite(tailles, capacites) }))
      .filter(({ attendu, obtenu }) => !isDeepStrictEqual(obtenu, attendu))
      .map(({ quoi, attendu, obtenu }) =>
        `${quoi} : ${JSON.stringify(obtenu)}, ${JSON.stringify(attendu)} attendu`);
    assert.deepEqual(ecarts, []);
  });
});

describe('appartenances : le tour témoin', () => {
  test('un tour qui sépare chaque groupe quand il en existe un', () => {
    // [tailles, capacités], chacun admettant un tour
    const cas = [
      [[2, 2, 1], [3, 2]],
      [[2, 2, 2], [4, 3]],
      [[1, 1, 1], [8, 2]],
      [[4, 4, 4], [3, 3, 3, 3]],
      [[5, 3, 1, 1], [3, 3, 2, 2, 2]],
    ];
    const ecarts = cas.flatMap(([tailles, capacites]) => {
      const tour = tourTemoin(Object.freeze([...tailles]), Object.freeze([...capacites]));
      const quoi = `${JSON.stringify(tailles)} / ${JSON.stringify(capacites)}`;
      if (tour === null) return [`${quoi} : null`];
      return ecartsDuTour(tailles, capacites, tour).map((e) => `${quoi} : ${e}`);
    });
    assert.deepEqual(ecarts, []);
  });

  test('null quand aucun tour ne sépare tous les groupes', () => {
    const cas = [
      [[3, 3, 3, 3], [10, 1, 1]],
      [[3, 3, 3, 1, 1, 1], [6, 4, 2]],
      [[3, 3, 1, 1], [4, 3, 1]],
      [[1, 1], [1]],
      [[2], []],
    ];
    const rendus = cas.filter(([tailles, capacites]) => tourTemoin(tailles, capacites) !== null);
    assert.deepEqual(rendus, []);
  });

  test('aucun membre : un tour vide', () => {
    assert.deepEqual(tourTemoin([], [8]), []);
  });

  test('chaque groupe prend les tables aux sièges libres les plus nombreux, à égalité la plus petite', () => {
    // Deux tables de 2 : le premier membre prend la table 0 ; le second, la
    // table 1, qui garde alors plus de sièges libres.
    assert.deepEqual(tourTemoin([1, 1], [2, 2]), [0, 1]);
    // Les tables 1 et 2 gardent 2 sièges, la table 0 un seul : les membres
    // du groupe suivent l'ordre des tables choisies.
    assert.deepEqual(tourTemoin([2], [1, 2, 2]), [1, 2]);
  });

  // Sur chaque instance du domaine : tourTemoin rend un tour valide quand la
  // recherche exhaustive en trouve un, null sinon ; faisabilite n'en refuse
  // aucune qui a un tour.
  test('petites instances : un tour quand, et seulement quand, la recherche exhaustive en trouve un', () => {
    // Domaine : 1 à 4 groupes de 1 à 4 membres, 1 à 4 tables de 1 à 4 sièges,
    // soit 340 × 340 instances. Il contient des instances sans tour où les
    // deux inégalités tiennent, et des instances à places vides dont la
    // plus grande table dépasse le nombre de groupes et qui ont un tour.
    const ecarts = [];
    let avecTour = 0;
    let sansTourInegalitesTenues = 0;
    let avecTourTableAuDelaDesGroupes = 0;
    for (const tailles of suites(4, 4)) {
      for (const capacites of suites(4, 4)) {
        const quoi = () => `${JSON.stringify(tailles)} / ${JSON.stringify(capacites)}`;
        const existe = existeTour(tailles, capacites);
        const tour = tourTemoin(tailles, capacites);
        const verdict = faisabilite(tailles, capacites);
        if (existe) avecTour += 1;
        if (!existe && verdict.ok) sansTourInegalitesTenues += 1;
        if (existe && Math.max(...capacites) > tailles.length) avecTourTableAuDelaDesGroupes += 1;
        if ((tour !== null) !== existe) {
          const recherche = existe ? 'en trouve un' : 'n’en trouve aucun';
          ecarts.push(`${quoi()} : ${tour === null ? 'null' : 'un tour'}, la recherche ${recherche}`);
        } else if (tour !== null) {
          ecarts.push(...ecartsDuTour(tailles, capacites, tour).map((e) => `${quoi()} : ${e}`));
        }
        if (existe && !verdict.ok) {
          ecarts.push(`${quoi()} : faisabilite refuse (${verdict.raison}) une instance qui a un tour`);
        }
      }
    }
    assert.deepEqual(ecarts.slice(0, 12), []);
    assert.ok(avecTour > 0, 'aucune instance avec tour');
    assert.ok(sansTourInegalitesTenues > 0, 'aucune instance où seul le tour témoin conclut');
    assert.ok(avecTourTableAuDelaDesGroupes > 0, 'aucune instance où les places vides comptent');
  });
});
