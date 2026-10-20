// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du catalogue de démonstrations (§ 15) : ses quatre entrées, le
// déterminisme, les grandeurs de chacune, l'ordre contractuel des tirages
// (§ 15.5, point 3), le plan parfait de la petite et les refus du générateur
// (§ 15.4). Le profil d'organisations de la grande n'est écrit nulle part ici
// (§ 15.2) : il se recalcule en rejouant le tirage des tailles.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { indexerPlan, normaliser } from '../moteur/configuration.js';
import { ErreurConfiguration } from '../moteur/erreurs.js';
import { tirerTailles, tourTemoin } from './organisations.js';
import { CATALOGUE, PLAN_PARFAIT_PETITE, engendrer } from './catalogue.js';
import { NOMS_LONGS, PRENOMS, organisations, patronymes } from './noms.js';
import { FLUX, creerPcg32 } from './prng.js';

const CLES = ['grande', 'grande-sans-exception', 'petite', 'petite-conflit'];
const TOUTES_ACTIVES = {
  separerOrganisations: true,
  nouveauxVoisins: true,
  nouvelleTable: true,
  varierOrganisations: true,
};

// Organisations de la petite démonstration (§ 15.3), puis de sa variante,
// où la personne 10 passe de C à A.
const A = [1, 5, 8, 12];
const B = [2, 4, 9, 11];
const C = [3, 6, 7, 10];
const A_CONFLIT = [1, 5, 8, 10, 12];
const C_CONFLIT = [3, 6, 7];

// Le plan parfait de la petite démonstration, recopié du tableau du § 15.3 :
// TABLEAU_15_3[r][i] = ids assis à la table i + 1 au tour r + 1.
const TABLEAU_15_3 = [
  [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]],
  [[6, 9, 12], [3, 8, 11], [2, 5, 10], [1, 4, 7]],
  [[4, 8, 10], [2, 7, 12], [1, 6, 11], [3, 5, 9]],
  [[5, 7, 11], [1, 9, 10], [3, 4, 12], [2, 6, 8]],
];

// Entiers de debut à fin, inclus.
const suite = (debut, fin) => Array.from({ length: fin - debut + 1 }, (_, i) => debut + i);
const somme = (liste) => liste.reduce((a, b) => a + b, 0);
const croissant = (a, b) => a - b;
const entree = (cle) => CATALOGUE.find((e) => e.cle === cle);

// Configuration d'une entrée, construite à la première demande puis gardée :
// une entrée absente fait échouer l'épreuve qui la demande, non le chargement
// du fichier. Aucune épreuve ne modifie ce qu'elle reçoit.
const construites = new Map();
function configurationDe(cle) {
  if (!construites.has(cle)) construites.set(cle, entree(cle).construire());
  return construites.get(cle);
}

// Membres de chaque organisation, en ids croissants, les groupes rangés par
// leur plus petit id. La Map retrouve le groupe d'un libellé ; le tri fixe
// l'ordre de sortie.
function groupesDe({ participants }) {
  const membres = new Map();
  for (const { id, organisation } of participants) {
    if (!membres.has(organisation)) membres.set(organisation, []);
    membres.get(organisation).push(id);
  }
  return [...membres.values()].map((ids) => ids.sort(croissant)).sort((a, b) => a[0] - b[0]);
}

// Objets d'une configuration : elle-même, ses listes, leurs éléments et ses
// contraintes.
const objetsDe = (c) => [
  c, c.participants, ...c.participants, c.tables, ...c.tables,
  c.reservations, ...c.reservations, c.contraintes,
];

// Le tirage sans remise que décrit catalogue.js : mélange partiel de Fisher et
// Yates, de la première case vers la dernière, un borne() par élément tiré.
function tirerSansRemise(rng, reservoir, k) {
  const pile = [...reservoir];
  for (let i = 0; i < k; i += 1) {
    const j = i + rng.borne(pile.length - i);
    [pile[i], pile[j]] = [pile[j], pile[i]];
  }
  return pile.slice(0, k);
}

// Tables de 8 sièges, assez nombreuses pour asseoir les membres donnés avec
// une table de marge.
const tablesPour = (membres) => Array(Math.ceil(membres / 8) + 1).fill(8);

// Code et détails de l'ErreurConfiguration que lève l'appel ; toute autre
// issue est décrite en une ligne.
function refus(appel) {
  try {
    appel();
  } catch (erreur) {
    if (erreur instanceof ErreurConfiguration) return { code: erreur.code, details: erreur.details };
    return `${erreur.name} : ${erreur.message}`;
  }
  return 'aucune erreur';
}

describe('catalogue : les entrées', () => {
  test('quatre entrées, dans cet ordre, chacune nommée, ensemencée et figée', () => {
    assert.deepEqual(CATALOGUE.map((e) => e.cle), CLES);
    assert.ok(Object.isFrozen(CATALOGUE));
    assert.ok(CATALOGUE.every((e) => Object.isFrozen(e)));
    const noms = CATALOGUE.map((e) => e.nom);
    assert.ok(noms.every((nom) => typeof nom === 'string' && nom.length > 0));
    assert.equal(new Set(noms).size, CLES.length);
    assert.ok(CATALOGUE.every((e) => Number.isInteger(e.graine) && e.graine >= 0 && e.graine < 2 ** 32));
    assert.ok(CATALOGUE.every((e) => typeof e.construire === 'function'));
  });

  test('chaque variante tire avec la graine de sa démonstration', () => {
    assert.equal(entree('grande-sans-exception').graine, entree('grande').graine);
    assert.equal(entree('petite-conflit').graine, entree('petite').graine);
  });
});

describe('catalogue : déterminisme (§ 15.5)', () => {
  test('construire() deux fois rend deux configurations égales', () => {
    assert.equal(CATALOGUE.length, CLES.length);
    for (const e of CATALOGUE) assert.deepStrictEqual(e.construire(), e.construire(), e.cle);
  });

  test('construire() rend des objets neufs, aucun partagé avec un appel précédent', () => {
    assert.equal(CATALOGUE.length, CLES.length);
    for (const e of CATALOGUE) {
      const premiers = new Set(objetsDe(e.construire()));
      assert.equal(objetsDe(e.construire()).filter((objet) => premiers.has(objet)).length, 0, e.cle);
    }
  });
});

describe('catalogue : grande (§ 15.1)', () => {
  test('260 participants, ids 1 à 260, chacun nommé, prénommé et membre d’une organisation', () => {
    const { participants } = configurationDe('grande');
    assert.deepEqual(participants.map((p) => p.id), suite(1, 260));
    const prenoms = new Set(PRENOMS);
    const reservoir = new Set(organisations());
    const ecarts = participants
      .filter((p) => typeof p.nom !== 'string' || !prenoms.has(p.prenom) || !reservoir.has(p.organisation)
        || p.exclu !== undefined)
      .map((p) => p.id);
    assert.deepEqual(ecarts, []);
  });

  test('33 tables, ids et numéros 1 à 33, 8 sièges sauf 30 à 33 à 7 : Σ c_t = 260', () => {
    const { tables } = configurationDe('grande');
    assert.deepEqual(tables, suite(1, 33).map((id) => ({ id, numero: id, capacite: id >= 30 ? 7 : 8 })));
    assert.equal(somme(tables.map((t) => t.capacite)), 260);
  });

  test('4 tours, les quatre contraintes actives', () => {
    const configuration = configurationDe('grande');
    assert.equal(configuration.tours, 4);
    assert.deepEqual(configuration.contraintes, TOUTES_ACTIVES);
  });

  test('33 réservations « tous », une par table, animateurs distincts', () => {
    const { reservations } = configurationDe('grande');
    assert.equal(reservations.length, 33);
    assert.ok(reservations.every((r) => r.portee === 'tous' && !('tour' in r)));
    assert.deepEqual(reservations.map((r) => r.table).sort(croissant), suite(1, 33));
    const animateurs = reservations.map((r) => r.participant);
    assert.equal(new Set(animateurs).size, 33);
    assert.ok(animateurs.every((id) => Number.isInteger(id) && id >= 1 && id <= 260));
  });

  test('les animateurs ne partagent pas tous une même organisation', () => {
    const { participants, reservations } = configurationDe('grande');
    const organisationDe = new Map(participants.map((p) => [p.id, p.organisation]));
    const distinctes = new Set(reservations.map((r) => organisationDe.get(r.participant)));
    assert.ok(distinctes.size > 1);
  });

  test('tailles de groupe de 1 à 12, somme 260 : celles que rejoue le tirage des tailles', () => {
    const configuration = configurationDe('grande');
    const tailles = groupesDe(configuration).map((membres) => membres.length);
    assert.ok(tailles.every((taille) => taille >= 1 && taille <= 12), JSON.stringify(tailles));
    assert.equal(somme(tailles), 260);
    const tirees = tirerTailles(creerPcg32(entree('grande').graine, FLUX.DEMO), 260);
    assert.deepEqual([...tailles].sort(croissant), [...tirees].sort(croissant));
    assert.notEqual(tourTemoin(tirees, configuration.tables.map((t) => t.capacite)), null);
  });

  test('260 patronymes distincts ; les ids 7, 77 et 177 portent les trois noms longs', () => {
    const { participants } = configurationDe('grande');
    const noms = participants.map((p) => p.nom);
    assert.equal(new Set(noms).size, 260);
    assert.deepEqual([noms[6], noms[76], noms[176]], [...NOMS_LONGS]);
    const reservoir = new Set(patronymes());
    const horsReservoir = participants.filter((p) => !reservoir.has(p.nom)).map((p) => p.id);
    assert.deepEqual(horsReservoir, [7, 77, 177]);
  });

  test('exactement tendue : 33 ancrés, 227 mobiles, capacité libre 227', () => {
    const instance = normaliser(configurationDe('grande'));
    assert.deepEqual([instance.N, instance.T, instance.R, instance.k, instance.n], [260, 33, 4, 33, 227]);
    let libre = 0;
    for (let t = 0; t < instance.T; t += 1) libre += instance.capacite[t] - instance.ancresParTable[t];
    assert.equal(libre, instance.n);
  });

  test('l’ordre des tirages suit le contrat (§ 15.5, point 3)', () => {
    const { participants, reservations } = configurationDe('grande');
    const N = 260;
    const rng = creerPcg32(entree('grande').graine, FLUX.DEMO);
    const tailles = tirerTailles(rng, N); // (1)
    const noms = tirerSansRemise(rng, patronymes(), N); // (2)
    const prenoms = suite(1, N).map(() => PRENOMS[rng.borne(PRENOMS.length)]); // (3)
    const libelles = tirerSansRemise(rng, organisations(), tailles.length); // (4)
    const ordre = rng.melanger(suite(1, N)); // (5)
    const animateurs = rng.melanger(suite(1, N)).slice(0, 33); // (6)
    const organisation = [];
    let rang = 0;
    tailles.forEach((taille, g) => {
      for (let m = 0; m < taille; m += 1, rang += 1) organisation[ordre[rang]] = libelles[g];
    });
    const longs = new Map([[7, NOMS_LONGS[0]], [77, NOMS_LONGS[1]], [177, NOMS_LONGS[2]]]);
    assert.deepEqual(
      participants,
      suite(1, N).map((id) => ({
        id,
        nom: longs.get(id) ?? noms[id - 1],
        prenom: prenoms[id - 1],
        organisation: organisation[id],
      })),
    );
    assert.deepEqual(
      reservations,
      animateurs.map((participant, t) => ({ participant, table: t + 1, portee: 'tous' })),
    );
  });
});

describe('catalogue : grande sans exception (§ 15.1)', () => {
  test('mêmes participants, organisations et animateurs que la grande', () => {
    const grande = configurationDe('grande');
    const variante = configurationDe('grande-sans-exception');
    assert.deepStrictEqual(variante.participants, grande.participants);
    assert.deepStrictEqual(variante.reservations, grande.reservations);
    assert.equal(variante.tours, grande.tours);
    assert.deepStrictEqual(variante.contraintes, grande.contraintes);
  });

  test('33 tables de 8, ids et numéros 1 à 33 : 264 sièges', () => {
    assert.deepEqual(
      configurationDe('grande-sans-exception').tables,
      suite(1, 33).map((id) => ({ id, numero: id, capacite: 8 })),
    );
  });
});

describe('catalogue : petite et conflit inévitable (§ 15.3)', () => {
  test('12 participants, 4 tables de 3, 4 tours, aucune réservation, contraintes actives', () => {
    for (const c of [configurationDe('petite'), configurationDe('petite-conflit')]) {
      assert.deepEqual(c.participants.map((p) => p.id), suite(1, 12));
      assert.deepEqual(c.tables, suite(1, 4).map((id) => ({ id, numero: id, capacite: 3 })));
      assert.equal(c.tours, 4);
      assert.deepEqual(c.reservations, []);
      assert.deepEqual(c.contraintes, TOUTES_ACTIVES);
    }
  });

  test('organisations A, B, C : 4, 4, 4 ; dans la variante 5, 4, 3', () => {
    const conflit = configurationDe('petite-conflit');
    assert.deepEqual(groupesDe(configurationDe('petite')), [A, B, C]);
    assert.deepEqual(groupesDe(conflit), [A_CONFLIT, B, C_CONFLIT]);
    assert.deepEqual(groupesDe(conflit).map((g) => g.length), [5, 4, 3]);
  });

  test('trois libellés distincts tirés parmi les organisations ; noms et prénoms des réservoirs', () => {
    const configuration = configurationDe('petite');
    const libelles = new Set(configuration.participants.map((p) => p.organisation));
    assert.equal(libelles.size, 3);
    const reservoir = new Set(organisations());
    assert.ok([...libelles].every((libelle) => reservoir.has(libelle)));
    const noms = configuration.participants.map((p) => p.nom);
    assert.equal(new Set(noms).size, 12);
    const patronymesConnus = new Set(patronymes());
    assert.ok(noms.every((nom) => patronymesConnus.has(nom)));
    assert.ok(configuration.participants.every((p) => PRENOMS.includes(p.prenom)));
  });

  test('la variante ne change que l’organisation de la personne 10', () => {
    const { participants } = configurationDe('petite');
    const conflit = configurationDe('petite-conflit');
    const libelleA = participants[0].organisation;
    assert.deepEqual(
      conflit.participants,
      participants.map((p) => (p.id === 10 ? { ...p, organisation: libelleA } : p)),
    );
  });

  test('l’ordre des tirages : patronymes, prénoms, organisations', () => {
    const configuration = configurationDe('petite');
    const rng = creerPcg32(entree('petite').graine, FLUX.DEMO);
    const noms = tirerSansRemise(rng, patronymes(), 12);
    const prenoms = suite(1, 12).map(() => PRENOMS[rng.borne(PRENOMS.length)]);
    const [a, b, c] = tirerSansRemise(rng, organisations(), 3);
    const libelleDe = (id) => (A.includes(id) ? a : B.includes(id) ? b : c);
    assert.deepEqual(
      configuration.participants,
      suite(1, 12).map((id) => ({ id, nom: noms[id - 1], prenom: prenoms[id - 1], organisation: libelleDe(id) })),
    );
  });
});

describe('catalogue : plan parfait de la petite (§ 15.3)', () => {
  test('le tableau du § 15.3, en ids, sans réserve', () => {
    assert.deepEqual(PLAN_PARFAIT_PETITE, {
      tables: [1, 2, 3, 4],
      tours: TABLEAU_15_3,
      reserves: [[], [], [], []],
    });
  });

  test('partition à chaque tour, aucune paire répétée, 4 tables et 8 rencontres chacun, aucune collision', () => {
    const groupeDe = (id) => (A.includes(id) ? 'A' : B.includes(id) ? 'B' : 'C');
    const ecarts = [];
    const paires = new Set();
    const rencontres = new Map(suite(1, 12).map((id) => [id, new Set()]));
    const visitees = new Map(suite(1, 12).map((id) => [id, new Set()]));
    PLAN_PARFAIT_PETITE.tours.forEach((listes, r) => {
      const assis = listes.flat().sort(croissant);
      if (assis.join() !== suite(1, 12).join()) ecarts.push(`tour ${r + 1} : pas une partition`);
      listes.forEach((liste, i) => {
        const table = PLAN_PARFAIT_PETITE.tables[i];
        if (liste.length !== 3) ecarts.push(`tour ${r + 1}, table ${table} : ${liste.length} assis`);
        if (new Set(liste.map(groupeDe)).size !== liste.length) {
          ecarts.push(`tour ${r + 1}, table ${table} : collision`);
        }
        for (const x of liste) {
          visitees.get(x).add(table);
          for (const y of liste) {
            if (x === y) continue;
            rencontres.get(x).add(y);
            if (x < y) {
              if (paires.has(`${x}-${y}`)) ecarts.push(`paire ${x}-${y} répétée`);
              paires.add(`${x}-${y}`);
            }
          }
        }
      });
    });
    for (const id of suite(1, 12)) {
      if (visitees.get(id).size !== 4) ecarts.push(`${id} : ${visitees.get(id).size} tables`);
      if (rencontres.get(id).size !== 8) ecarts.push(`${id} : ${rencontres.get(id).size} rencontres`);
    }
    assert.deepEqual(ecarts, []);
  });

  test('il s’indexe sur l’instance de la petite démonstration', () => {
    const instance = normaliser(configurationDe('petite'));
    assert.equal(indexerPlan(instance, PLAN_PARFAIT_PETITE).length, 12 * 4);
  });

  test('il est figé jusque dans ses listes', () => {
    const { tables, tours, reserves } = PLAN_PARFAIT_PETITE;
    const objets = [PLAN_PARFAIT_PETITE, tables, tours, ...tours, ...tours.flat(), reserves, ...reserves];
    assert.ok(objets.every((objet) => Object.isFrozen(objet)));
  });
});

describe('engendrer : refus (§ 15.4, § 15.6)', () => {
  // Les quatre refus du § 14.10 — zéro participant, zéro table, aucun tour
  // témoin, réservoir de noms dépassé —, chacun sur un ou plusieurs cas, une
  // épreuve par cas. Un cas qui rompt deux règles à la fois attend la
  // première dans l'ordre du contrôle : participants, tables, réservoirs,
  // tour témoin.
  const nombreOrganisations = organisations().length;
  const nombrePatronymes = patronymes().length;
  // Des groupes de deux, juste assez pour dépasser les patronymes et pas les
  // organisations ; des tables de 8 en nombre suffisant pour un tour.
  const paires = Math.floor(nombrePatronymes / 2) + 1;
  // Un groupe d'une personne de plus qu'il n'y a d'organisations.
  const tropDeGroupes = Object.freeze(Array(nombreOrganisations + 1).fill(1));
  const organisationsDepassees = {
    code: 'DEMO_RESERVOIR',
    details: { reservoir: 'organisations', demandes: nombreOrganisations + 1, disponibles: nombreOrganisations },
  };
  // [cas, définition, refus attendu]
  const cas = [
    ['zéro participant', { graine: 1, effectif: 0, capacites: [8, 8], tours: 4 },
      { code: 'DEMO_SANS_PARTICIPANT', details: {} }],
    ['zéro participant, tailles fixées', { graine: 1, tailles: [], capacites: [8, 8], tours: 4 },
      { code: 'DEMO_SANS_PARTICIPANT', details: {} }],
    ['zéro participant et zéro table : les participants d’abord',
      { graine: 1, tailles: [], capacites: [], tours: 4 },
      { code: 'DEMO_SANS_PARTICIPANT', details: {} }],
    ['zéro table', { graine: 1, effectif: 260, capacites: [], tours: 4 },
      { code: 'DEMO_SANS_TABLE', details: {} }],
    ['zéro table et plus de groupes que d’organisations : les tables d’abord',
      { graine: 1, tailles: tropDeGroupes, capacites: [], tours: 4 },
      { code: 'DEMO_SANS_TABLE', details: {} }],
    ['§ 15.2 : tables de 10, 1 et 1 pour quatre groupes de 3',
      { graine: 1, tailles: [3, 3, 3, 3], capacites: [10, 1, 1], tours: 4 },
      { code: 'DEMO_SANS_TOUR_TEMOIN', details: { graine: 1, raison: 'PLUS_GRANDE_CAPACITE' } }],
    ['un groupe de 4 pour 3 tables', { graine: 1, tailles: [4, 2], capacites: [3, 3, 3], tours: 4 },
      { code: 'DEMO_SANS_TOUR_TEMOIN', details: { graine: 1, raison: 'PLUS_GROS_GROUPE' } }],
    ['inégalités tenues, aucun tour : tables de 6, 4 et 2',
      { graine: 1, tailles: [3, 3, 3, 1, 1, 1], capacites: [6, 4, 2], tours: 4 },
      { code: 'DEMO_SANS_TOUR_TEMOIN', details: { graine: 1, raison: 'CONSTRUCTION' } }],
    ['plus de groupes que d’organisations',
      { graine: 1, tailles: tropDeGroupes, capacites: tablesPour(nombreOrganisations + 1), tours: 4 },
      organisationsDepassees],
    ['plus de groupes que d’organisations, sur une seule table : les réservoirs avant le tour témoin',
      { graine: 1, tailles: tropDeGroupes, capacites: [8], tours: 4 },
      organisationsDepassees],
    ['plus de membres que de patronymes',
      { graine: 1, tailles: Array(paires).fill(2), capacites: tablesPour(2 * paires), tours: 4 },
      { code: 'DEMO_RESERVOIR',
        details: { reservoir: 'patronymes', demandes: 2 * paires, disponibles: nombrePatronymes } }],
  ];

  test('les réservoirs laissent à chaque cas une seule règle de réservoir rompue', () => {
    assert.ok(nombreOrganisations + 1 <= nombrePatronymes, 'trop peu de patronymes pour le cas des organisations');
    assert.ok(paires <= nombreOrganisations, 'trop peu d’organisations pour le cas des patronymes');
  });

  for (const [quoi, definition, attendu] of cas) {
    test(`${quoi} : ${attendu.code}`, () => {
      assert.deepEqual(refus(() => engendrer(definition)), attendu);
    });
  }

  test('un réservoir employé jusqu’à son dernier nom suffit', () => {
    const parOrganisation = engendrer({
      graine: 1,
      tailles: Array(nombreOrganisations).fill(1),
      capacites: tablesPour(nombreOrganisations),
      tours: 4,
    });
    assert.equal(new Set(parOrganisation.participants.map((p) => p.organisation)).size, nombreOrganisations);
    const tailles = Array(Math.floor(nombrePatronymes / 2)).fill(2);
    if (nombrePatronymes % 2 === 1) tailles.push(1);
    const parPatronyme = engendrer({ graine: 1, tailles, capacites: tablesPour(nombrePatronymes), tours: 4 });
    assert.equal(new Set(parPatronyme.participants.map((p) => p.nom)).size, nombrePatronymes);
  });

  test('une définition qui donne à la fois un effectif et des tailles lève TypeError', () => {
    assert.throws(
      () => engendrer({ graine: 1, effectif: 12, tailles: [4, 4, 4], capacites: [3, 3, 3, 3], tours: 4 }),
      TypeError,
    );
  });

  test('une taille fixée qui n’est pas un entier ≥ 1 lève RangeError', () => {
    // Sur deux tables de 8, chacune de ces définitions rend, sans le
    // contrôle, une configuration aux groupes faussés ou un refus étranger à
    // la taille fautive.
    const ecarts = [[-2, 2, 2], [1.5, 1.5], [0, 2], ['2', 2]]
      .map((tailles) => [tailles, refus(() => engendrer({ graine: 1, tailles, capacites: [8, 8], tours: 4 }))])
      .filter(([, issue]) => typeof issue !== 'string' || !issue.startsWith('RangeError : tailles'))
      .map(([tailles, issue]) => `${JSON.stringify(tailles)} : ${JSON.stringify(issue)}`);
    assert.deepEqual(ecarts, []);
  });

  test('moins de membres que de tables lève RangeError : un animateur par table', () => {
    assert.throws(
      () => engendrer({ graine: 1, tailles: [1, 1], capacites: [8, 8, 8], tours: 4 }),
      RangeError,
    );
  });

  test('autant de membres que de tables : chacun anime une table, sur les tours de la définition', () => {
    const { participants, reservations, tours } = engendrer({
      graine: 1,
      tailles: [1, 1, 1],
      capacites: [8, 8, 8],
      tours: 3,
    });
    assert.equal(tours, 3);
    assert.deepEqual(participants.map((p) => p.id), [1, 2, 3]);
    assert.deepEqual(reservations.map((r) => r.table), [1, 2, 3]);
    assert.deepEqual(reservations.map((r) => r.participant).sort(croissant), [1, 2, 3]);
  });
});
