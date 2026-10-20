// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves des conflits du placement montré (§ 7.5) : la proposition
// demandée, sinon le retenu, lus tour par tour comme le plan les lit, en
// conflits nommés — tour, table, règle, personnes et rencontres
// antérieures. Les noms d'épreuve sont inventés ; la petite démonstration
// au conflit livrée se lit telle quelle, et la version vient du module
// engendré.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { texteLivre } from '../demo/livrees.js';
import { rechercher } from '../moteur/recherche.js';
import { analyser, configurationDepuisCharge, creerCharge } from '../stockage/document.js';
import { VERSION } from '../version.genere.js';
import { COMMANDES } from './commandes.js';
import { conflitsDuPlacement } from './conflits_placement.js';
import { etatPlaces } from './places.js';

const executer = (nom, charge, args) => COMMANDES.get(nom)(charge, args);

const personne = (id, nom, prenom, organisation) => ({
  id,
  nom,
  prenom,
  organisation,
  courriel: null,
  titrePressenti: null,
  notes: null,
  exclu: false,
});

// Deux tables de trois places dont les numéros affichés diffèrent des
// identifiants : la table 1 porte le numéro 4, la table 2 le numéro 1.
const TABLES = [
  { id: 1, numero: 4, sieges: null, forme: 'ronde', position: { x: 0, y: 0 } },
  { id: 2, numero: 1, sieges: null, forme: 'ronde', position: { x: 300, y: 0 } },
];

// Six personnes : 1 et 2 du Club des Merles, 3 et 4 des Pinsons, 5 et 6
// sans organisation.
const PERSONNES = [
  personne(1, 'Ombrelle', 'Iris', 'Club des Merles'),
  personne(2, 'Fontaine', 'Noé', 'Club des Merles'),
  personne(3, 'Pervenche', 'Théo', 'Pinsons'),
  personne(4, 'Lacasse', 'Ondine', 'Pinsons'),
  personne(5, 'Grisaille', null, null),
  personne(6, 'Bruyère', 'Anouk', null),
];

// Tour 1 : 1 et 2, collègues, à la table 1 (numéro 4). Tour 2 : 4 et 5
// se revoient à la table 1, déjà réunis à la table 2 (numéro 1) ; 2 et 3
// se revoient à la table 2, déjà réunis à la table 1 ; 1 revient à la table
// 1, 6 à la table 2.
const PLAN = [
  [[1, 2, 3], [4, 5, 6]],
  [[1, 4, 5], [2, 3, 6]],
];
// Le même plan, ses tables échangées au tour 2 : 2 et 3 se revoient à la
// table 1 et y reviennent, 4 et 5 de même à la table 2.
const AUTRE = [
  [[1, 2, 3], [4, 5, 6]],
  [[2, 3, 6], [1, 4, 5]],
];

const ATTENDUS = [
  { tour: 1, table: 1, numero: 4, regle: 'separerOrganisations', personnes: [1, 2], deja: [] },
  { tour: 2, table: 1, numero: 4, regle: 'nouveauxVoisins', personnes: [4, 5], deja: [{ tour: 1, numero: 1 }] },
  { tour: 2, table: 1, numero: 4, regle: 'nouvelleTable', personnes: [1], deja: [{ tour: 1, numero: 4 }] },
  { tour: 2, table: 2, numero: 1, regle: 'nouveauxVoisins', personnes: [2, 3], deja: [{ tour: 1, numero: 4 }] },
  { tour: 2, table: 2, numero: 1, regle: 'nouvelleTable', personnes: [6], deja: [{ tour: 1, numero: 1 }] },
];

const AUTRES_ATTENDUS = [
  ATTENDUS[0],
  { tour: 2, table: 1, numero: 4, regle: 'nouveauxVoisins', personnes: [2, 3], deja: [{ tour: 1, numero: 4 }] },
  { tour: 2, table: 1, numero: 4, regle: 'nouvelleTable', personnes: [2], deja: [{ tour: 1, numero: 4 }] },
  { tour: 2, table: 1, numero: 4, regle: 'nouvelleTable', personnes: [3], deja: [{ tour: 1, numero: 4 }] },
  { tour: 2, table: 2, numero: 1, regle: 'nouveauxVoisins', personnes: [4, 5], deja: [{ tour: 1, numero: 1 }] },
  { tour: 2, table: 2, numero: 1, regle: 'nouvelleTable', personnes: [4], deja: [{ tour: 1, numero: 1 }] },
  { tour: 2, table: 2, numero: 1, regle: 'nouvelleTable', personnes: [5], deja: [{ tour: 1, numero: 1 }] },
];

// Un plan de fichier sur les deux tables, sièges non attribués, chaque tour
// donné par ses listes.
function planFichier(tours, siegesAttribues = false) {
  const participants = PERSONNES.map(({ id }) => id);
  return {
    siegesAttribues,
    tables: TABLES.map(({ id }) => id),
    capacites: [3, 3],
    tours: tours.length,
    participants,
    placement: tours.map((listes) => ({ sieges: structuredClone(listes), reserve: [] })),
  };
}

const propositionDe = (id, tours) => ({
  id,
  graine: id,
  arret: 40,
  historique: 1000,
  produitVersion: VERSION.affichee,
  ...planFichier(tours),
});

// La charge des six personnes, R tours, ses propositions numérotées depuis
// 1 dans l'ordre des plans donnés, et le plan de rang retenu (compté depuis
// 0) retenu quand il est donné.
function charge({ plans = [PLAN], retenu = null, tours = 2 } = {}) {
  const c = creerCharge({ id: 'evt-conflits', nom: 'Soirée des Merles', siegesParDefaut: 3, tours });
  c.participants = structuredClone(PERSONNES);
  c.tables = structuredClone(TABLES);
  c.prochainsIds = { participant: 7, table: 3, proposition: plans.length + 1 };
  c.propositions = plans.map((tours_, rang) => propositionDe(rang + 1, tours_));
  c.evenement.etat = retenu === null ? 'propose' : 'retenu';
  c.retenu = retenu === null ? null : { proposition: retenu + 1, ...planFichier(plans[retenu]) };
  return c;
}

// La somme des pastilles du plan à chaque tour : le nombre de chaque table
// d'etatPlaces, 0 pour une table sans conflit évalué.
const pastilles = (c, proposition) =>
  Array.from({ length: c.evenement.tours }, (_, r) =>
    etatPlaces(c, { tour: r + 1, proposition }).tables.reduce((somme, { conflits }) => somme + (conflits?.nombre ?? 0), 0),
  );

const parTour = (conflits, R) => Array.from({ length: R }, (_, r) => conflits.filter(({ tour }) => tour === r + 1).length);

describe('conflitsDuPlacement : la proposition montrée, sinon le retenu (§ 7.5)', () => {
  test('la proposition demandée, sans retenu : chaque violation nommée, tour, table et numéro affiché, règle, personnes et rencontres antérieures', () => {
    const c = charge();
    assert.deepEqual(conflitsDuPlacement(c, { proposition: 1 }), ATTENDUS);
  });

  test('le retenu, sans proposition demandée : le même plan rend les mêmes conflits', () => {
    const c = charge({ retenu: 0 });
    assert.deepEqual(conflitsDuPlacement(c, { proposition: null }), ATTENDUS);
  });

  test('une proposition demandée alors qu’un retenu existe : la proposition se lit, non le retenu', () => {
    const c = charge({ plans: [AUTRE, PLAN], retenu: 0 });
    assert.deepEqual(conflitsDuPlacement(c, { proposition: 2 }), ATTENDUS);
    assert.deepEqual(conflitsDuPlacement(c, { proposition: null }), AUTRES_ATTENDUS);
  });

  test('ni proposition demandée ni retenu : null, quelles que soient les propositions de la charge', () => {
    assert.equal(conflitsDuPlacement(charge(), { proposition: null }), null);
    assert.equal(conflitsDuPlacement(charge({ plans: [] }), { proposition: null }), null);
    assert.equal(conflitsDuPlacement(charge(), {}), null);
  });

  test('une proposition demandée qui n’existe pas : le retenu, ou null sans lui', () => {
    assert.equal(conflitsDuPlacement(charge(), { proposition: 9 }), null);
    assert.deepEqual(conflitsDuPlacement(charge({ retenu: 0 }), { proposition: 9 }), ATTENDUS);
  });

  test('une règle inactive ne rend aucun conflit ; un placement sans violation rend une liste vide', () => {
    const c = charge();
    c.reglages.nouvelleTable = false;
    c.reglages.nouveauxVoisins = false;
    assert.deepEqual(conflitsDuPlacement(c, { proposition: 1 }), [ATTENDUS[0]]);
    c.reglages.separerOrganisations = false;
    assert.deepEqual(conflitsDuPlacement(c, { proposition: 1 }), []);
  });

  test('sièges attribués : la même lecture', () => {
    const c = charge();
    c.propositions[0] = { ...c.propositions[0], ...planFichier(PLAN, true) };
    assert.deepEqual(conflitsDuPlacement(c, { proposition: 1 }), ATTENDUS);
  });

  test('une paire revue deux fois avant : chaque rencontre antérieure, dans l’ordre des tours', () => {
    // Tour 3 : 2 et 3 à la table 1, déjà réunis à la table 1 (numéro 4) au
    // tour 1 et à la table 2 (numéro 1) au tour 2.
    const plan = [...PLAN, [[2, 3, 4], [1, 5, 6]]];
    const c = charge({ plans: [plan], tours: 3 });
    const conflits = conflitsDuPlacement(c, { proposition: 1 });
    const paire = conflits.find(({ tour, regle, personnes }) => tour === 3 && regle === 'nouveauxVoisins' && personnes.join() === '2,3');
    assert.deepEqual(paire, {
      tour: 3,
      table: 1,
      numero: 4,
      regle: 'nouveauxVoisins',
      personnes: [2, 3],
      deja: [
        { tour: 1, numero: 4 },
        { tour: 2, numero: 1 },
      ],
    });
  });

  test('une proposition en dérive plus courte que R : ses tours se lisent en elle, les suivants dans le retenu, avec les rencontres antérieures du retenu', () => {
    // La proposition 1 porte deux tours sur trois, la 2, retenue, les trois :
    // le tour 3 se lit dans le retenu, et l'histoire de ses conflits aussi.
    const c = charge({ plans: [AUTRE, [...PLAN, [[2, 3, 4], [1, 5, 6]]]], retenu: 1, tours: 3 });
    assert.equal(c.propositions[0].tours, 2);
    assert.equal(etatPlaces(c, { tour: 3, proposition: 1 }).source, 'retenu');
    const auTour3 = (conflits) => conflits.filter(({ tour }) => tour === 3);
    const duRetenu = auTour3(conflitsDuPlacement(c, { proposition: null }));
    assert.ok(duRetenu.length > 0);
    assert.deepEqual(auTour3(conflitsDuPlacement(c, { proposition: 1 })), duRetenu);
    const paire = duRetenu.find(({ regle, personnes }) => regle === 'nouveauxVoisins' && personnes.join() === '2,3');
    assert.deepEqual(paire.deja, [
      { tour: 1, numero: 4 },
      { tour: 2, numero: 1 },
    ]);
  });

  test('une proposition plus courte que R : chaque tour se lit une fois, et ses tours une fois de plus dans le retenu, non à chaque tour du retenu', () => {
    // La proposition 1 porte deux tours sur cinq : les tours 3 à 5 se lisent
    // dans le retenu, et l'histoire de leurs conflits relit les tours 1 et 2
    // dans le retenu. Borne : R lectures, plus une par tour relu.
    const suite = [[[2, 3, 4], [1, 5, 6]], [[1, 3, 5], [2, 4, 6]], [[1, 4, 6], [2, 3, 5]]];
    const c = charge({ plans: [AUTRE, [...PLAN, ...suite]], retenu: 1, tours: 5 });
    const lus = [];
    const espion = (charge_, demande) => {
      lus.push(demande);
      return etatPlaces(charge_, demande);
    };
    const conflits = conflitsDuPlacement(c, { proposition: 1 }, { etatPlaces: espion });
    assert.deepEqual(conflits, conflitsDuPlacement(c, { proposition: 1 }));
    assert.ok(conflits.some(({ tour }) => tour === 5));
    assert.ok(lus.length <= 5 + 2, JSON.stringify(lus));
    assert.equal(lus.length, 7);
  });

  test('un retenu en dérive — une personne ajoutée qu’il ne place pas — ne s’évalue pas : null, comme les pastilles absentes du plan', () => {
    // La personne entre dans la charge sans la commande, qui l'ajouterait à
    // la réserve du retenu : un fichier écrit ainsi le laisse en dérive.
    const c = structuredClone(charge({ retenu: 0 }));
    const id = c.prochainsIds.participant;
    c.participants.push({ ...structuredClone(c.participants[0]), id, nom: 'Sarcelle', prenom: 'Capucine' });
    c.prochainsIds.participant = id + 1;
    assert.ok(etatPlaces(c, { tour: 1 }).evalue === false);
    assert.equal(conflitsDuPlacement(c, { proposition: null }), null);
  });

  test('ne modifie pas la charge reçue', () => {
    const c = charge({ plans: [AUTRE, PLAN], retenu: 0 });
    const avant = structuredClone(c);
    conflitsDuPlacement(c, { proposition: 2 });
    conflitsDuPlacement(c, { proposition: null });
    assert.deepEqual(c, avant);
  });

  test('d’accord avec les pastilles du plan sur la petite démonstration au conflit : même somme à chaque tour, même nombre à chaque table', () => {
    let c = analyser(texteLivre('petite-conflit')).charge;
    const configuration = configurationDepuisCharge(c);
    const propositions = rechercher(configuration, { graine: 2, nombre: 2, arret: 300, historique: 1000 });
    c = executer('enregistrerGeneration', c, { propositions, configuration, produitVersion: VERSION.affichee }).charge;
    const R = c.evenement.tours;
    assert.ok(R >= 2);
    for (const { id } of c.propositions) {
      const conflits = conflitsDuPlacement(c, { proposition: id });
      assert.ok(conflits.length > 0, `proposition ${id} : des conflits attendus`);
      assert.deepEqual(parTour(conflits, R), pastilles(c, id));
      for (let tour = 1; tour <= R; tour += 1) {
        for (const { id: table, numero, conflits: deTable } of etatPlaces(c, { tour, proposition: id }).tables) {
          const ici = conflits.filter((conflit) => conflit.tour === tour && conflit.table === table);
          assert.equal(ici.length, deTable?.nombre ?? 0, `tour ${tour}, table ${table}`);
          for (const conflit of ici) assert.equal(conflit.numero, numero);
        }
      }
    }
    const retenue = executer('retenirProposition', c, { id: c.propositions[1].id }).charge;
    const duRetenu = conflitsDuPlacement(retenue, { proposition: null });
    assert.deepEqual(parTour(duRetenu, R), pastilles(retenue, null));
    assert.deepEqual(duRetenu, conflitsDuPlacement(c, { proposition: c.propositions[1].id }));
  });
});
