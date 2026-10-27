// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de ce que les inclusions demandent à chacun (§ 4, § 5.4) : les
// inclusions atteignables I(p) contre une énumération des ensembles de
// personnes qu'un plan peut faire rencontrer, les deux régimes, et les unités
// qui font les avis, une même rencontre demandée comptant une fois.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { FLUX, creerPcg32 } from '../demo/prng.js';
import { normaliser } from './configuration.js';
import { ciblesDesInclusions } from './inclusions.js';
import { plafondsAPriori } from './plafond.js';

const SANS_CONTRAINTE = {
  separerOrganisations: false,
  nouveauxVoisins: false,
  nouvelleTable: false,
  varierOrganisations: false,
};

const membre = (id, organisation, champs = {}) => ({ id, nom: `P${id}`, organisation, ...champs });

// L'instance de participants assis autour de T tables de capacite places,
// pendant tours tours, sans réservation.
const salle = (participants, { T = 2, capacite = 3, tours = 1 } = {}) =>
  normaliser({
    participants,
    tables: Array.from({ length: T }, (_, t) => ({ id: t + 1, numero: t + 1, capacite })),
    tours,
    reservations: [],
    contraintes: SANS_CONTRAINTE,
  });

// Le plus de lignes actives de p qu'un ensemble M de K personnes au plus,
// autres que p, satisfait : une ligne de personne quand M la contient, une
// ligne d'organisation quand M contient un de ses membres. Chaque partie de
// l'ensemble des autres se compte.
function plusGrandSatisfait({ N, groupe, inclusionDebut, inclusionCible }, p, K) {
  const autres = Array.from({ length: N }, (_, q) => q).filter((q) => q !== p);
  const lignes = Array.from(inclusionCible.subarray(inclusionDebut[p], inclusionDebut[p + 1]));
  let plus = 0;
  for (let masque = 0; masque < 2 ** autres.length; masque += 1) {
    const M = autres.filter((_, i) => (masque >> i) & 1);
    if (M.length > K) continue;
    const satisfaites = lignes.filter((c) => (c >= 0 ? M.includes(c) : M.some((q) => groupe[q] === -1 - c))).length;
    plus = Math.max(plus, satisfaites);
  }
  return plus;
}

describe('inclusions atteignables I(p) (§ 5.4)', () => {
  test('cent configurations tirées : I(p) est le plus de lignes que K(p) personnes satisfont, et b(p) ≤ K(p) rend toute la liste', () => {
    const ORGANISATIONS = ['Rameau', 'Saule', 'Tilleul', null];
    let auDela = 0;
    let dansLePlafond = 0;
    let couvertes = 0;
    for (let i = 0; i < 100; i += 1) {
      const alea = creerPcg32(4_242 + i, FLUX.DEMO);
      const N = 3 + alea.borne(5);
      const ids = Array.from({ length: N }, (_, p) => p + 1);
      const organisations = ids.map(() => ORGANISATIONS[alea.borne(ORGANISATIONS.length)]);
      const participants = ids.map((id, p) => {
        const autres = ids.filter((autre) => autre !== id && alea.borne(2) === 1);
        const incluses = ['Rameau', 'Saule', 'Tilleul'].filter(
          (nom) => nom !== organisations[p] && organisations.includes(nom) && alea.borne(2) === 1,
        );
        return membre(id, organisations[p], { inclusionsOrganisation: incluses, inclusionsParticipant: autres });
      });
      const instance = salle(participants, { T: N, capacite: 2 + alea.borne(2), tours: 1 + alea.borne(2) });
      const cibles = ciblesDesInclusions(instance);
      const K = plafondsAPriori(instance);
      for (let p = 0; p < N; p += 1) {
        const libelle = `configuration ${i}, personne ${p}`;
        assert.equal(cibles.plafond[p], K[p], libelle);
        assert.equal(cibles.atteignables[p], plusGrandSatisfait(instance, p, K[p]), libelle);
        assert.equal(cibles.auDela[p], cibles.besoin[p] > K[p] ? 1 : 0, libelle);
        if (cibles.auDela[p] === 0) {
          assert.equal(cibles.atteignables[p], cibles.actives[p], libelle);
          if (cibles.actives[p] > 0) dansLePlafond += 1;
        } else {
          assert.ok(cibles.atteignables[p] < cibles.actives[p], libelle);
          auDela += 1;
        }
        if (cibles.couvertes[p] > 0) couvertes += 1;
      }
    }
    // Les tirages exercent les deux régimes et des organisations couvertes.
    assert.ok(auDela >= 20, `${auDela} au-delà du plafond`);
    assert.ok(dansLePlafond >= 20, `${dansLePlafond} dans le plafond`);
    assert.ok(couvertes >= 20, `${couvertes} avec une organisation couverte`);
  });

  test('trois cibles de trois organisations, et les trois organisations, sous K = 2 : I = 4', () => {
    // Un tour, deux tables de 3 : chacun rencontre 2 personnes au plus.
    const instance = salle([
      membre(1, null, { inclusionsOrganisation: ['Un', 'Deux', 'Trois'], inclusionsParticipant: [2, 3, 4] }),
      membre(2, 'Un'),
      membre(3, 'Deux'),
      membre(4, 'Trois'),
    ]);
    const cibles = ciblesDesInclusions(instance);
    assert.deepEqual(
      [cibles.actives[0], cibles.couvertes[0], cibles.besoin[0], cibles.plafond[0], cibles.atteignables[0], cibles.auDela[0]],
      [6, 3, 3, 2, 4, 1],
    );
  });

  test('Marie inclut Paul et son organisation, sous K = 1 : I = 2, dans le plafond', () => {
    // Un tour, deux tables de 2 : chacun rencontre une personne au plus.
    const instance = salle([
      membre(1, null, { inclusionsOrganisation: ['Coop'], inclusionsParticipant: [2] }),
      membre(2, 'Coop'),
      membre(3, 'Coop'),
      membre(4, null),
    ], { capacite: 2 });
    const cibles = ciblesDesInclusions(instance);
    assert.deepEqual(
      [cibles.actives[0], cibles.couvertes[0], cibles.besoin[0], cibles.plafond[0], cibles.atteignables[0], cibles.auDela[0]],
      [2, 1, 1, 1, 2, 0],
    );
  });

  test('sans ligne active, tout vaut zéro et le plafond a priori n’est pas lu', () => {
    const instance = salle([membre(1, null, { inclusionsParticipant: [3] }), membre(2, null), membre(3, null, { exclu: true })]);
    const cibles = ciblesDesInclusions(instance);
    assert.deepEqual(Array.from(cibles.plafond), [0, 0]);
    assert.deepEqual(Array.from(cibles.atteignables), [0, 0]);
    assert.equal(cibles.uniteLigne.length, 0);
    assert.notDeepEqual(plafondsAPriori(instance), [0, 0]);
  });

  test('calculé une fois par instance ; le plafond a priori reçu est celui qui se lit', () => {
    const participants = [membre(1, null, { inclusionsParticipant: [2] }), membre(2, null), membre(3, null)];
    const instance = salle(participants);
    assert.equal(ciblesDesInclusions(instance), ciblesDesInclusions(instance));
    // Un plafond reçu, faux exprès, se lit tel quel.
    const autre = salle(participants);
    assert.deepEqual(Array.from(ciblesDesInclusions(autre, [7, 7, 7]).plafond), [7, 7, 7]);
    assert.equal(ciblesDesInclusions(autre, [1, 1, 1]).plafond[0], 7);
  });
});

describe('les unités des avis (§ 5.4)', () => {
  // Les unités, chacune [source, rang de ligne, partenaire, réciproque].
  const unites = ({ uniteLigne, uniteSource, unitePartenaire, uniteReciproque }) =>
    Array.from(uniteLigne, (ligne, u) => [uniteSource[u], ligne, unitePartenaire[u], uniteReciproque[u]]);

  test('« a inclut b » et « b inclut a » font une unité, portée par la plus petite source ; une organisation que deux membres satisfont est sa propre unité', () => {
    // 1 inclut 2 et le Fanal (4 et 5) ; 2 inclut 1 ; 3 inclut 1. Lignes :
    // 1 → Fanal (rang 0), 1 → 2 (rang 1), 2 → 1 (rang 2), 3 → 1 (rang 3).
    const instance = salle([
      membre(1, null, { inclusionsOrganisation: ['Fanal'], inclusionsParticipant: [2] }),
      membre(2, null, { inclusionsParticipant: [1] }),
      membre(3, null, { inclusionsParticipant: [1] }),
      membre(4, 'Fanal'),
      membre(5, 'Fanal'),
    ], { T: 2, capacite: 4, tours: 2 });
    assert.deepEqual(unites(ciblesDesInclusions(instance)), [[0, 0, -1, 0], [0, 1, 1, 1], [2, 3, 0, 0]]);
  });

  test('une organisation dont un seul membre est rencontrable demande sa paire : avec la ligne de ce membre, une unité, portée par la personne', () => {
    // 1 inclut 2 et le Fanal, où 2 est seul. Lignes : 1 → Fanal (rang 0),
    // 1 → 2 (rang 1) ; une rencontre les satisfait toutes deux.
    const instance = salle([
      membre(1, null, { inclusionsOrganisation: ['Fanal'], inclusionsParticipant: [2] }),
      membre(2, 'Fanal'),
      membre(3, null),
    ]);
    assert.deepEqual(unites(ciblesDesInclusions(instance)), [[0, 1, 1, 0]]);
  });

  test('l’organisation d’un seul membre rencontrable et la réciproque de ce membre font une unité, dans les deux sens', () => {
    // Le Fanal : 2, et 3, présent au tour 2 seulement, que 1, présent au
    // tour 1 seulement, ne peut rencontrer. 1 inclut le Fanal (rang 0) ; 2
    // inclut 1 (rang 1).
    const instance = salle([
      membre(1, null, { inclusionsOrganisation: ['Fanal'], presence: [1] }),
      membre(2, 'Fanal', { inclusionsParticipant: [1] }),
      membre(3, 'Fanal', { presence: [2] }),
    ], { tours: 2 });
    assert.deepEqual(unites(ciblesDesInclusions(instance)), [[0, 0, 1, 1]]);
    // Les sources inversées : 1, seul du Rameau, inclut 2 (rang 0) ; 2
    // inclut le Rameau (rang 1). La plus petite source porte l'unité.
    const inverse = salle([
      membre(1, 'Rameau', { inclusionsParticipant: [2] }),
      membre(2, null, { inclusionsOrganisation: ['Rameau'] }),
      membre(3, null),
    ]);
    assert.deepEqual(unites(ciblesDesInclusions(inverse)), [[0, 0, 1, 1]]);
  });

  test('une source au-delà du plafond ne porte aucune unité ; sa réciproque passe à l’autre source', () => {
    // Un tour, deux tables de 2 : K = 1 pour chacun. 1 inclut 2, 3 et 4,
    // au-delà du plafond ; 2 inclut 1, dans le plafond : l'unité de la paire
    // passe à 2, réciproque. 3 inclut 4 et 1 : au-delà, aucune unité.
    const instance = salle([
      membre(1, null, { inclusionsParticipant: [2, 3, 4] }),
      membre(2, null, { inclusionsParticipant: [1] }),
      membre(3, null, { inclusionsParticipant: [1, 4] }),
      membre(4, null),
    ], { capacite: 2 });
    const cibles = ciblesDesInclusions(instance);
    assert.deepEqual(Array.from(cibles.auDela), [1, 0, 1, 0]);
    assert.deepEqual(unites(cibles), [[1, 3, 0, 1]]);
  });
});
