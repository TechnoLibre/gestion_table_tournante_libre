// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du plancher des conflits en étoile (§ 5.6) : f(n, k), le
// plancher d'une étoile tour par tour, ses silences — un cycle, un membre
// réservé, une séparation décochée, des tables trop peu nombreuses — et la
// règle qui ne l'écrit que lorsqu'il dépasse la somme des planchers par
// groupe du moteur. Chaque valeur attendue se compte à la main sur la
// formule ; une recherche exhaustive, sur de petites instances, vérifie que
// le plancher ne dépasse jamais le vrai minimum. Les charges se construisent
// ici, sur des noms inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { creerCharge } from '../stockage/document.js';
import { diagnostiquerCharge } from './diagnostic.js';
import { collisionsMinimales, plancherCollisionsTotal, planchersConflits } from './planchers_conflits.js';

const MERLES = 'Club des Merles';
const HERONS = 'Cercle des Hérons';
const LOUTRES = 'Atelier des Loutres';
const CASTORS = 'Société des Castors';
const PLUVIERS = 'Amicale des Pluviers';

/**
 * Une charge construite : effectifs, [organisation, nombre de membres], dans
 * l'ordre où les membres reçoivent leurs identifiants à partir de 1 ;
 * sansOrganisation personnes de plus, sans organisation ; tables tables de
 * capacite places ; conflits, [organisation, organisations nommées] : le
 * premier membre de la première nomme les autres ; separer, la case de la
 * séparation.
 */
function chargeDe({ effectifs, sansOrganisation = 0, tables, capacite = 8, tours = 4, conflits = [], separer = true }) {
  const charge = creerCharge({ id: 'evt-etoile', nom: 'Soirée des Grèbes', siegesParDefaut: capacite, tours });
  const organisations = [...effectifs.flatMap(([organisation, n]) => Array(n).fill(organisation)), ...Array(sansOrganisation).fill(null)];
  charge.participants = organisations.map((organisation, rang) => ({
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
    charge.participants.find((personne) => personne.organisation === organisation).conflits = nommees;
  }
  charge.tables = Array.from({ length: tables }, (_, t) => ({ id: t + 1, numero: t + 1, sieges: null, forme: 'ronde', position: { x: 300 * t, y: 0 } }));
  charge.reglages.separerOrganisations = separer;
  charge.prochainsIds = { participant: organisations.length + 1, table: tables + 1, proposition: 1 };
  return charge;
}

// La somme des planchers par groupe du moteur, pour les organisations
// données, lue dans le diagnostic de la charge.
function sommeParGroupe(charge, organisations) {
  const { diagnostic } = diagnostiquerCharge(charge);
  return diagnostic.collisions.filter(({ groupe }) => organisations.includes(groupe)).reduce((somme, { plancherCumulees }) => somme + plancherCumulees, 0);
}

describe('collisionsMinimales : f(n, k), n personnes sur k tables, réparties au plus égal', () => {
  test('les valeurs comptées à la main', () => {
    assert.equal(collisionsMinimales(0, 0), 0);
    assert.equal(collisionsMinimales(0, 5), 0);
    assert.equal(collisionsMinimales(1, 1), 0);
    assert.equal(collisionsMinimales(5, 1), 10);
    assert.equal(collisionsMinimales(20, 11), 9);
    assert.equal(collisionsMinimales(13, 11), 2);
    assert.equal(collisionsMinimales(27, 13), 15);
    assert.equal(collisionsMinimales(13, 9), 4);
    assert.equal(collisionsMinimales(10, 9), 1);
    assert.equal(collisionsMinimales(7, 7), 0);
    assert.equal(collisionsMinimales(7, 20), 0);
  });

  test('personne à asseoir sans table : infini ; personne, aucune collision', () => {
    assert.equal(collisionsMinimales(1, 0), Infinity);
    assert.equal(collisionsMinimales(12, 0), Infinity);
  });

  test('égale le minimum d’une recherche exhaustive des répartitions, jusqu’à 9 personnes sur 4 tables', () => {
    // C(x, 2), 0 et non −0 pour x = 0 : l'égalité stricte les distingue.
    const paires = (x) => (x < 2 ? 0 : (x * (x - 1)) / 2);
    // Le plus petit Σ C(x_j, 2) sur toutes les répartitions de n en k parts.
    const exhaustif = (n, k) => {
      if (k === 0) return n === 0 ? 0 : Infinity;
      if (k === 1) return paires(n);
      let meilleur = Infinity;
      for (let x = 0; x <= n; x += 1) meilleur = Math.min(meilleur, paires(x) + exhaustif(n - x, k - 1));
      return meilleur;
    };
    for (let n = 0; n <= 9; n += 1) for (let k = 0; k <= 4; k += 1) assert.equal(collisionsMinimales(n, k), exhaustif(n, k), `${n} sur ${k}`);
  });
});

describe('planchersConflits : l’étoile, tour par tour', () => {
  test('deux organisations de 20 et 13 en conflit, 22 tables de 8, quatre tours : 11 par tour, 44, tout le gain', () => {
    const charge = chargeDe({ effectifs: [[MERLES, 20], [HERONS, 13]], tables: 22, conflits: [[MERLES, [HERONS]]] });
    assert.equal(sommeParGroupe(charge, [MERLES, HERONS]), 0);
    assert.deepEqual(planchersConflits(charge), [{ organisations: [MERLES, HERONS], plancherCumulees: 44, parTour: [11, 11, 11, 11], gain: 44 }]);
  });

  test('le conflit nommé par l’autre côté donne la même étoile, dans l’ordre des organisations', () => {
    const charge = chargeDe({ effectifs: [[MERLES, 20], [HERONS, 13]], tables: 22, conflits: [[HERONS, [MERLES]]] });
    assert.deepEqual(planchersConflits(charge).map(({ organisations }) => organisations), [[MERLES, HERONS]]);
  });

  test('un centre de 27 contre 10, 13 et 13, 22 tables : 24 par tour, 96, moins les 20 que le moteur prouve déjà pour le centre', () => {
    const charge = chargeDe({
      effectifs: [[HERONS, 10], [MERLES, 27], [LOUTRES, 13], [CASTORS, 13]],
      tables: 22,
      conflits: [[MERLES, [HERONS, LOUTRES, CASTORS]]],
    });
    // Seul le centre, 27 personnes pour 22 tables, a un plancher par groupe :
    // 5 collisions par tour.
    assert.equal(sommeParGroupe(charge, [MERLES, HERONS, LOUTRES, CASTORS]), 20);
    assert.deepEqual(planchersConflits(charge), [
      { organisations: [MERLES, HERONS, LOUTRES, CASTORS], plancherCumulees: 96, parTour: [24, 24, 24, 24], gain: 76 },
    ]);
  });

  test('une absence à un tour : le plancher de ce tour se compte sur les présents', () => {
    const charge = chargeDe({ effectifs: [[MERLES, 20], [HERONS, 13]], tables: 22, conflits: [[MERLES, [HERONS]]] });
    // Un membre du Club des Merles absent au tour 2 : 19 et 13 sur 22
    // tables, au mieux 10 (a = 11 : 8 + 2).
    charge.participants[1].presence = [1, 3, 4];
    assert.deepEqual(planchersConflits(charge), [{ organisations: [MERLES, HERONS], plancherCumulees: 43, parTour: [11, 10, 11, 11], gain: 43 }]);
  });

  test('une organisation entière absente à un tour : ce tour ne coûte que l’autre seule', () => {
    const charge = chargeDe({ effectifs: [[MERLES, 6], [HERONS, 4]], tables: 4, capacite: 4, tours: 2, conflits: [[MERLES, [HERONS]]] });
    // Tour 1 : 6 et 4 sur 4 tables, au mieux 8 (a = 2 : 6 + 2 ; a = 3 :
    // 3 + 6). Tour 2, le Cercle absent : 6 sur 4 tables, 2, ce que le
    // moteur prouve déjà. Le moteur : 2 + 0 au tour 1, 2 au tour 2.
    for (const personne of charge.participants.filter(({ organisation }) => organisation === HERONS)) personne.presence = [1];
    assert.equal(sommeParGroupe(charge, [MERLES, HERONS]), 4);
    assert.deepEqual(planchersConflits(charge), [{ organisations: [MERLES, HERONS], plancherCumulees: 10, parTour: [8, 2], gain: 6 }]);
  });

  test('le centre entier absent à un tour : ce tour ne coûte que les branches, sur toutes les tables', () => {
    const charge = chargeDe({ effectifs: [[MERLES, 6], [HERONS, 4]], tables: 4, capacite: 4, tours: 2, conflits: [[MERLES, [HERONS]]] });
    // Tour 1 : 8, comme ci-dessus. Tour 2, le Club, centre, absent : le
    // Cercle prend les 4 tables (a = 0), f(4, 4) = 0. Le moteur : 2 au tour
    // 1 pour le Club, rien d'autre.
    for (const personne of charge.participants.filter(({ organisation }) => organisation === MERLES)) personne.presence = [1];
    assert.equal(sommeParGroupe(charge, [MERLES, HERONS]), 2);
    assert.deepEqual(planchersConflits(charge), [{ organisations: [MERLES, HERONS], plancherCumulees: 8, parTour: [8, 0], gain: 6 }]);
  });

  test('l’ordre des étoiles suit celui de leur centre, non celui de leur première organisation', () => {
    // Ordre des organisations : Loutres 0, Merles 1, Hérons 2, Castors 3,
    // Pluviers 4. L'étoile des Hérons (2) contient les Loutres (0) ; celle
    // des Merles (1) a son centre entre les deux. 3 contre 3 sur 2 tables :
    // f(3, 1) + f(3, 1) = 6 ; 3 contre 3 et 3 : 3 + 6 = 9 ; f(3, 2) = 1 par
    // groupe au moteur.
    const charge = chargeDe({
      effectifs: [[LOUTRES, 3], [MERLES, 3], [HERONS, 3], [CASTORS, 3], [PLUVIERS, 3]],
      tables: 2,
      tours: 1,
      conflits: [[HERONS, [LOUTRES, CASTORS]], [MERLES, [PLUVIERS]]],
    });
    assert.deepEqual(planchersConflits(charge), [
      { organisations: [MERLES, PLUVIERS], plancherCumulees: 6, parTour: [6], gain: 4 },
      { organisations: [HERONS, LOUTRES, CASTORS], plancherCumulees: 9, parTour: [9], gain: 6 },
    ]);
  });

  test('deux étoiles séparées : une ligne chacune, dans l’ordre des organisations de leur centre', () => {
    const charge = chargeDe({
      effectifs: [[CASTORS, 6], [LOUTRES, 6], [MERLES, 6], [HERONS, 6]],
      tables: 5,
      capacite: 6,
      tours: 1,
      conflits: [[HERONS, [MERLES]], [CASTORS, [LOUTRES]]],
    });
    // 6 et 6 sur 5 tables : f(6, 2) + f(6, 3) = 6 + 3 = 9, au mieux. Le
    // moteur : f(6, 5) = 1 par groupe.
    assert.deepEqual(planchersConflits(charge), [
      { organisations: [CASTORS, LOUTRES], plancherCumulees: 9, parTour: [9], gain: 7 },
      { organisations: [MERLES, HERONS], plancherCumulees: 9, parTour: [9], gain: 7 },
    ]);
  });
});

describe('planchersConflits : ses silences', () => {
  test('un cycle de trois organisations n’est pas une étoile : rien', () => {
    const charge = chargeDe({
      effectifs: [[MERLES, 10], [HERONS, 10], [LOUTRES, 10]],
      tables: 6,
      conflits: [[MERLES, [HERONS, LOUTRES]], [HERONS, [LOUTRES]]],
    });
    assert.deepEqual(planchersConflits(charge), []);
  });

  test('une chaîne de trois est une étoile, centrée sur le milieu', () => {
    const charge = chargeDe({ effectifs: [[MERLES, 10], [HERONS, 10], [LOUTRES, 10]], tables: 6, tours: 1, conflits: [[HERONS, [MERLES, LOUTRES]]] });
    // Le Cercle au centre, 10 contre 10 et 10 sur 6 tables : a = 3,
    // 3 × f(10, 3) = 3 × 12 = 36 ; a = 2, f(10, 2) + 2 f(10, 4) = 20 + 16,
    // 36 aussi ; a = 4, 8 + 40.
    const [ligne] = planchersConflits(charge);
    assert.deepEqual(ligne.organisations, [HERONS, MERLES, LOUTRES]);
    assert.deepEqual(ligne.parTour, [36]);
  });

  test('un membre de la composante réservé à une table : rien ; un membre d’une autre organisation réservé : l’étoile reste', () => {
    const charge = chargeDe({ effectifs: [[MERLES, 20], [HERONS, 13]], sansOrganisation: 2, tables: 22, conflits: [[MERLES, [HERONS]]] });
    charge.reservations = [{ participant: 34, table: 1, siege: null, portee: 'tous', tour: null }];
    assert.equal(planchersConflits(charge).length, 1);
    charge.reservations = [{ participant: 25, table: 1, siege: null, portee: 'tour', tour: 2 }];
    assert.deepEqual(planchersConflits(charge), []);
  });

  test('une seule table : aucun plan sans conflit n’existe, et le plancher se tait', () => {
    const charge = chargeDe({ effectifs: [[MERLES, 3], [HERONS, 3]], tables: 1, tours: 2, conflits: [[MERLES, [HERONS]]] });
    assert.deepEqual(planchersConflits(charge), []);
  });

  test('assez de tables pour asseoir chacun seul : le plancher vaut 0, ne dépasse rien, et ne s’écrit pas', () => {
    const charge = chargeDe({ effectifs: [[MERLES, 6], [HERONS, 4]], tables: 10, capacite: 2, conflits: [[MERLES, [HERONS]]] });
    assert.deepEqual(planchersConflits(charge), []);
  });

  test('un plancher qui égale la somme par groupe n’apprend rien et ne s’écrit pas', () => {
    // 4 et 1 sur 3 tables : f(4, 2) + f(1, 1) = 2 dépasse f(4, 3) = 1, que
    // le moteur prouve déjà. Sur 5 tables, f(4, 4) + f(1, 1) = 0 = f(4, 5).
    const dense = chargeDe({ effectifs: [[MERLES, 4], [HERONS, 1]], tables: 3, tours: 1, conflits: [[MERLES, [HERONS]]] });
    assert.deepEqual(planchersConflits(dense), [{ organisations: [MERLES, HERONS], plancherCumulees: 2, parTour: [2], gain: 1 }]);
    const large = chargeDe({ effectifs: [[MERLES, 4], [HERONS, 1]], tables: 5, tours: 1, conflits: [[MERLES, [HERONS]]] });
    assert.deepEqual(planchersConflits(large), []);
  });

  test('la séparation décochée : rien, les collisions ne comptent pas', () => {
    const charge = chargeDe({ effectifs: [[MERLES, 20], [HERONS, 13]], tables: 22, conflits: [[MERLES, [HERONS]]], separer: false });
    assert.deepEqual(planchersConflits(charge), []);
  });

  test('sans conflit, ou un conflit nommé par une personne sans organisation : rien', () => {
    assert.deepEqual(planchersConflits(chargeDe({ effectifs: [[MERLES, 20], [HERONS, 13]], tables: 22 })), []);
    const seule = chargeDe({ effectifs: [[MERLES, 20], [HERONS, 13]], sansOrganisation: 1, tables: 22 });
    seule.participants[33].conflits = [MERLES, HERONS];
    assert.deepEqual(planchersConflits(seule), []);
  });

  test('une personne sans organisation en conflit avec une branche ne défait pas l’étoile', () => {
    const charge = chargeDe({ effectifs: [[MERLES, 20], [HERONS, 13]], sansOrganisation: 1, tables: 22, conflits: [[MERLES, [HERONS]]] });
    charge.participants[33].conflits = [HERONS];
    assert.deepEqual(planchersConflits(charge).map(({ plancherCumulees }) => plancherCumulees), [44]);
  });
});

describe('planchersConflits : une borne, jamais au-dessus du vrai minimum', () => {
  // Le plus petit Σ C(x, 2) d'un tour sur toutes les affectations sans
  // conflit de n0 membres du centre et des branches à T tables, capacités
  // relâchées : chaque table reçoit des membres du centre ou des branches,
  // jamais des deux.
  function minimumExhaustif(n0, branches, T) {
    const paires = (x) => (x * (x - 1)) / 2;
    const effectifs = [n0, ...branches];
    let meilleur = Infinity;
    const tables = Array.from({ length: T }, () => Array(effectifs.length).fill(0));
    function placer(organisation, restants) {
      if (organisation === effectifs.length) {
        const sansConflit = tables.every((table) => table[0] === 0 || table.slice(1).every((x) => x === 0));
        if (sansConflit) meilleur = Math.min(meilleur, tables.reduce((s, table) => s + table.reduce((u, x) => u + paires(x), 0), 0));
        return;
      }
      if (restants === 0) {
        placer(organisation + 1, effectifs[organisation + 1] ?? 0);
        return;
      }
      for (const table of tables) {
        table[organisation] += 1;
        placer(organisation, restants - 1);
        table[organisation] -= 1;
      }
    }
    placer(0, effectifs[0]);
    return meilleur;
  }

  test('sur des étoiles de 2 à 3 branches, jusqu’à 4 tables : le plancher d’un tour égale le minimum exhaustif', () => {
    const cas = [
      [3, [2], 2],
      [3, [3], 3],
      [4, [2], 3],
      [2, [2, 2], 3],
      [3, [1, 2], 4],
      [4, [3], 4],
    ];
    for (const [n0, branches, T] of cas) {
      const noms = [LOUTRES, CASTORS];
      const charge = chargeDe({
        effectifs: [[MERLES, n0], ...branches.map((n, i) => [[HERONS, ...noms][i], n])],
        tables: T,
        capacite: 12,
        tours: 1,
        conflits: [[MERLES, [HERONS, ...noms].slice(0, branches.length)]],
      });
      // Chaque cas dépasse la somme par groupe : sa ligne s'écrit.
      const [ligne] = planchersConflits(charge);
      assert.notEqual(ligne, undefined, `${n0} contre ${branches} sur ${T}`);
      assert.equal(ligne.parTour[0], minimumExhaustif(n0, branches, T), `${n0} contre ${branches} sur ${T}`);
    }
  });

  test('le centre absent ou réduit au second tour : le plancher de ce tour égale encore le minimum exhaustif', () => {
    // Le centre a 3 membres au premier tour, n0 au second ; les branches sont
    // entières aux deux. Le premier tour fait le gain qui écrit la ligne.
    const cas = [
      [0, [3], 2],
      [0, [2, 2], 3],
      [1, [3], 2],
      [2, [2], 3],
    ];
    for (const [n0, branches, T] of cas) {
      const noms = [LOUTRES, CASTORS];
      const charge = chargeDe({
        effectifs: [[MERLES, 3], ...branches.map((n, i) => [[HERONS, ...noms][i], n])],
        tables: T,
        capacite: 12,
        tours: 2,
        conflits: [[MERLES, [HERONS, ...noms].slice(0, branches.length)]],
      });
      for (const personne of charge.participants.slice(n0, 3)) personne.presence = [1];
      const [ligne] = planchersConflits(charge);
      assert.notEqual(ligne, undefined, `${n0} contre ${branches} sur ${T}`);
      assert.equal(ligne.parTour[1], minimumExhaustif(n0, branches, T), `${n0} contre ${branches} sur ${T}`);
    }
  });
});

describe('plancherCollisionsTotal : la somme par groupe, renforcée par chaque étoile', () => {
  test('sans étoile, la somme des planchers par groupe ; avec, plus chaque gain', () => {
    const collisions = [{ plancherCumulees: 20 }, { plancherCumulees: 3 }];
    assert.equal(plancherCollisionsTotal(collisions, []), 23);
    assert.equal(plancherCollisionsTotal(collisions, [{ gain: 76 }, { gain: 2 }]), 101);
    assert.equal(plancherCollisionsTotal([], []), 0);
  });

  test('la charge reçue ne change pas', () => {
    const charge = chargeDe({ effectifs: [[MERLES, 20], [HERONS, 13]], tables: 22, conflits: [[MERLES, [HERONS]]] });
    const avant = structuredClone(charge);
    planchersConflits(charge);
    assert.deepEqual(charge, avant);
  });
});
