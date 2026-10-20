// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de l'état des places d'un tour (§ 5.8, § 7.5, § 7.6, § 8.9, § 9),
// de la répartition par siège, du libellé proposé à la désignation et des
// statuts calculés (§ 4.2). Les noms d'épreuve sont inventés ; la petite
// démonstration livrée se lit telle quelle, et la version vient du module
// engendré.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from '../../test/lanceur.js';
import { LIBRE, STATUT, indexerPlan, normaliser } from '../moteur/configuration.js';
import { conflitsParTable } from '../moteur/conflits.js';
import { analyser, creerCharge } from '../stockage/document.js';
import { planDepuisFichier } from '../stockage/placements.js';
import { VERSION } from '../version.genere.js';
import { invariantViole } from './avertissements.js';
import { bilanChangementDefaut } from './bilans.js';
import { controlerCapacite } from './capacite.js';
import { COMMANDES } from './commandes.js';
import { configurationDe } from './configuration.js';
import { refusDuDepart } from './depart.js';
import { titresNonPourvus } from './listes_travail.js';
import { nomAffiche } from './personnes.js';
import {
  aDesAbsences,
  etatPlaces,
  instanceDe,
  libellePropose,
  presenceSaisie,
  presencesPartielles,
  presentAuTour,
  presentsAuTour,
  repartirSieges,
  reservationsCouvrantes,
  statuts,
} from './places.js';
import { reservationsParTour } from './pose.js';

const executer = (nom, charge, args) => COMMANDES.get(nom)(charge, args);

const personne = (id, nom, prenom = null, autres = {}) => ({
  id,
  nom,
  prenom,
  organisation: null,
  courriel: null,
  titrePressenti: null,
  notes: null,
  exclu: false,
  ...autres,
});

const table = (id, sieges = null, numero = id) => ({ id, numero, sieges, forme: 'ronde', position: { x: 300 * id, y: 0 } });

const resa = (participant, idTable, siege, tour = null) => ({
  participant,
  table: idTable,
  siege,
  portee: tour === null ? 'tous' : 'tour',
  tour,
});

// Un plan de fichier de ces tables et capacités, dont chaque tour est donné
// par ses listes ; la réserve de chaque tour porte les déclarés qu'aucune
// liste n'assied.
function planFichier({ tables, capacites, participants, tours, siegesAttribues = false }) {
  return {
    siegesAttribues,
    tables,
    capacites,
    tours: tours.length,
    participants,
    placement: tours.map((listes) => {
      const assis = new Set(listes.flat());
      return { sieges: listes, reserve: participants.filter((id) => !assis.has(id)) };
    }),
  };
}

const propositionDe = (id, plan) => ({
  id,
  graine: 48271 + id,
  arret: 200000,
  historique: 1000,
  produitVersion: VERSION.affichee,
  ...plan,
});

const retenuDe = (proposition, plan) => ({ proposition, ...plan });

// --- La petite démonstration et un plan parfait ---------------------------

// La petite démonstration livrée : douze personnes, quatre tables de 3,
// quatre tours, aucune réservation.
const petite = () => analyser(readFileSync(new URL('../demo/livrees/petite.gtt.json', import.meta.url), 'utf8')).charge;

// Un plan qui sépare les trois organisations, ne réunit jamais deux fois les
// mêmes voisins et n'assied personne deux fois à la même table.
const PARFAIT = [
  [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]],
  [[5, 9, 10], [1, 7, 11], [2, 6, 12], [3, 4, 8]],
  [[6, 8, 11], [3, 9, 12], [1, 4, 10], [2, 5, 7]],
  [[4, 7, 12], [2, 8, 10], [3, 5, 11], [1, 6, 9]],
];
const DOUZE = Array.from({ length: 12 }, (_, rang) => rang + 1);
// Chaque appel rend des listes neuves : une épreuve qui modifie son plan ne
// touche pas PARFAIT.
const planParfait = (siegesAttribues = false) =>
  planFichier({ tables: [1, 2, 3, 4], capacites: [3, 3, 3, 3], participants: DOUZE, tours: structuredClone(PARFAIT), siegesAttribues });

// La petite démonstration, son plan parfait proposé sous l'identifiant 1, et
// retenu quand retenu est vrai.
function petiteRetenue({ retenu = true } = {}) {
  const charge = petite();
  charge.propositions = [propositionDe(1, planParfait())];
  charge.prochainsIds.proposition = 2;
  charge.retenu = retenu ? retenuDe(1, planParfait()) : null;
  charge.evenement.etat = retenu ? 'retenu' : 'propose';
  return charge;
}

const occupants = (etat, rang) => etat.tables[rang].chaises.map(({ occupant }) => occupant);

// Les conflits que le moteur lit sur ce placement, tour par tour.
function conflitsDuMoteur(charge, placement) {
  const instance = normaliser(configurationDe(charge));
  return conflitsParTable(instance, indexerPlan(instance, planDepuisFichier(placement)));
}

describe('repartirSieges : la seule répartition par siège', () => {
  test('la personne réservée au siège s prend le rang s, les autres les rangs libres par identifiant croissant', () => {
    assert.deepEqual(repartirSieges([4, 9, 2], new Map([[9, 1]]), 4), [9, 2, 4, null]);
    assert.deepEqual(repartirSieges([], new Map(), 3), [null, null, null]);
  });

  test('deux au même siège : le plus petit identifiant ; un siège au-delà des places ne compte pas ; trop de monde : les plus grands restent dehors', () => {
    assert.deepEqual(repartirSieges([7, 3, 5], new Map([[7, 2], [3, 2]]), 3), [5, 3, 7]);
    assert.deepEqual(repartirSieges([1, 2], new Map([[2, 9]]), 3), [1, 2, null]);
    assert.deepEqual(repartirSieges([6, 1, 4, 3], new Map([[6, 3]]), 3), [1, 3, 6]);
  });

  test('les prioritaires prennent les rangs libres avant les autres, puis tous se rangent par identifiant croissant', () => {
    assert.deepEqual(repartirSieges([1, 2, 3, 4, 5, 6], new Map(), 4, new Set([6])), [1, 2, 3, 6]);
    assert.deepEqual(repartirSieges([5, 2, 8, 1], new Map([[8, 1]]), 3, new Set([5])), [8, 1, 5]);
    assert.deepEqual(repartirSieges([9, 4, 7], new Map(), 2, new Set([9, 7])), [7, 9]);
    assert.deepEqual(repartirSieges([3, 1], new Map(), 4, new Set([3])), [1, 3, null, null]);
  });
});

describe('etatPlaces : la source et la cible (§ 5.8, § 8.9)', () => {
  test('plan parfait en retenu : occupants 1, 2, 3 aux sièges 1 à 3 de la table 1 ; cible retenu ; réserve vide ; zéro conflit', () => {
    const charge = petiteRetenue();
    const etat = etatPlaces(charge, { tour: 1 });
    assert.equal(etat.tour, 1);
    assert.equal(etat.source, 'retenu');
    assert.equal(etat.proposition, null);
    assert.equal(etat.siegesAttribues, false);
    assert.equal(etat.cible, 'retenu');
    assert.equal(etat.refus, null);
    assert.equal(etat.evalue, true);
    assert.deepEqual(etat.reserve, []);
    assert.equal(etat.tables.length, 4);
    assert.deepEqual(
      etat.tables[0].chaises.map(({ siege, occupant }) => [siege, occupant]),
      [[1, 1], [2, 2], [3, 3]],
    );
    for (const { conflits } of etat.tables) assert.equal(conflits.nombre, 0);
    assert.deepEqual(
      etat.tables.map(({ id, numero, capacite, surchargee, gelee }) => [id, numero, capacite, surchargee, gelee]),
      [[1, 1, 3, false, false], [2, 2, 3, false, false], [3, 3, 3, false, false], [4, 4, 3, false, false]],
    );
  });

  test('chaque table porte son libellé, null quand elle n\u{2019}en a pas ; il ne change ni les chaises ni les conflits', () => {
    const charge = petiteRetenue();
    const sans = etatPlaces(charge, { tour: 1 });
    assert.deepEqual(sans.tables.map(({ libelle }) => libelle), [null, null, null, null]);
    charge.tables[1].libelle = 'Coin des invités';
    const avec = etatPlaces(charge, { tour: 1 });
    assert.deepEqual(avec.tables.map(({ libelle }) => libelle), [null, 'Coin des invités', null, null]);
    assert.deepEqual(
      avec.tables.map(({ libelle, ...reste }) => reste),
      sans.tables.map(({ libelle, ...reste }) => reste),
    );
  });

  test('sans retenu ni proposition : les réservations seules ; la réserve porte les douze, moins une réservée à ce tour', () => {
    const charge = petite();
    const etat = etatPlaces(charge, { tour: 1 });
    assert.equal(etat.source, 'reservations');
    assert.equal(etat.cible, 'reservations');
    assert.equal(etat.siegesAttribues, false);
    assert.deepEqual(etat.reserve, DOUZE);
    charge.reservations = [resa(3, 2, null, 1)];
    const tour1 = etatPlaces(charge, { tour: 1 });
    assert.deepEqual(tour1.reserve, DOUZE.filter((id) => id !== 3));
    assert.deepEqual(occupants(tour1, 1), [3, null, null]);
    assert.deepEqual(tour1.tables[1].chaises[0].reservation, { participant: 3, portee: 'tour', tour: 1 });
    assert.deepEqual(etatPlaces(charge, { tour: 2 }).reserve, DOUZE);
  });

  test('une proposition demandée se montre, avec ou sans retenu ; après la retenue, en vue seule', () => {
    const avant = petiteRetenue({ retenu: false });
    const montree = etatPlaces(avant, { tour: 2, proposition: 1 });
    assert.equal(montree.source, 'proposition');
    assert.equal(montree.proposition, 1);
    assert.equal(montree.cible, 'reservations');
    assert.equal(montree.refus, null);
    assert.deepEqual(occupants(montree, 0), [5, 9, 10]);
    assert.equal(etatPlaces(avant, { tour: 2 }).source, 'reservations');

    const apres = etatPlaces(petiteRetenue(), { tour: 2, proposition: 1 });
    assert.equal(apres.source, 'proposition');
    assert.equal(apres.cible, null);
    assert.deepEqual(apres.refus, {
      code: 'PROPOSITION_MONTREE',
      details: { proposition: 1, remede: { geste: 'afficherTour', tour: 2, proposition: null } },
    });
  });

  test('les conflits de chaque table sont ceux de conflitsParTable sur le même plan, à chaque tour', () => {
    const charge = petiteRetenue();
    // Un plan imparfait : la table 1 réunit deux fois les mêmes voisins.
    const tours = PARFAIT.map((listes) => listes.map((liste) => [...liste]));
    tours[1] = [[1, 2, 10], [5, 7, 11], [6, 9, 12], [3, 4, 8]];
    charge.retenu = retenuDe(1, planFichier({ tables: [1, 2, 3, 4], capacites: [3, 3, 3, 3], participants: DOUZE, tours }));
    const attendus = conflitsDuMoteur(charge, charge.retenu);
    let compte = 0;
    for (let tour = 1; tour <= 4; tour += 1) {
      const etat = etatPlaces(charge, { tour });
      etat.tables.forEach(({ id, conflits }, rang) => {
        assert.deepEqual(conflits, { nombre: attendus[tour - 1][rang].nombre, regles: attendus[tour - 1][rang].regles }, `tour ${tour}, table ${id}`);
        compte += conflits.nombre;
      });
    }
    assert.ok(compte > 0, 'le plan imparfait porte des conflits');
  });

  test('sans source, les conflits sont ceux des seules réservations', () => {
    const charge = petite();
    // 1 et 5 sont de la même organisation : réservés à la même table.
    charge.reservations = [resa(1, 1, null), resa(5, 1, null, 2)];
    const etat = etatPlaces(charge, { tour: 2 });
    assert.equal(etat.evalue, true);
    const instance = normaliser(configurationDe(charge));
    assert.deepEqual(etat.tables[0].conflits, (({ nombre, regles }) => ({ nombre, regles }))(conflitsParTable(instance, instance.fixe)[1][0]));
    assert.ok(etat.tables[0].conflits.nombre > 0);
  });

  test('une source en dérive : evalue faux, conflits null ; un exclu assis ne paraît ni sur sa chaise ni en réserve', () => {
    const charge = petiteRetenue();
    charge.participants[4].exclu = true;
    for (let tour = 1; tour <= 4; tour += 1) {
      const etat = etatPlaces(charge, { tour });
      assert.equal(etat.evalue, false);
      assert.equal(etat.tables.length, 4);
      for (const { conflits } of etat.tables) assert.equal(conflits, null);
      assert.ok(!etat.reserve.includes(5));
      assert.ok(etat.tables.every(({ chaises }) => chaises.every(({ occupant }) => occupant !== 5)));
    }
    assert.deepEqual(occupants(etatPlaces(charge, { tour: 1 }), 1), [4, 6, null]);
  });

  test('sièges non attribués : une personne réservée à un siège s’y affiche, sous le retenu comme sous une proposition ; les autres prennent les chaises libres par identifiant croissant', () => {
    for (const [retenu, proposition, source] of [
      [true, null, 'retenu'],
      [false, 1, 'proposition'],
    ]) {
      const charge = petiteRetenue({ retenu });
      // 2, assis à la table 1 au tour 1, y est réservé « tous » au siège 3.
      charge.reservations = [resa(2, 1, 3)];
      const etat = etatPlaces(charge, { tour: 1, proposition });
      assert.equal(etat.source, source);
      assert.equal(etat.siegesAttribues, false);
      assert.deepEqual(occupants(etat, 0), [1, 3, 2]);
      const chaise = etat.tables[0].chaises[2];
      assert.equal(chaise.remplissage, 'plein');
      assert.deepEqual(chaise.marques, ['cadenasFerme', 'anneau']);
      assert.equal(etat.tables[0].chaises[0].remplissage, 'normal');
    }
  });

  test("sièges attribués : l'ordre d'une liste du retenu fait l'ordre des chaises, chaises vides comprises", () => {
    const charge = petiteRetenue();
    const tours = PARFAIT.map((listes) => listes.map((liste) => [...liste]));
    tours[0][0] = [3, 1, 2];
    tours[0][1] = [null, 6, 4];
    tours[0][2] = [9, null, 5];
    tours[0][3] = [7, 8];
    const plan = planFichier({ tables: [1, 2, 3, 4], capacites: [3, 3, 3, 3], participants: DOUZE, tours, siegesAttribues: true });
    plan.placement[0].reserve = [10, 11, 12];
    charge.retenu = retenuDe(1, plan);
    const etat = etatPlaces(charge, { tour: 1 });
    assert.equal(etat.siegesAttribues, true);
    assert.deepEqual(occupants(etat, 0), [3, 1, 2]);
    assert.deepEqual(occupants(etat, 1), [null, 6, 4]);
    assert.deepEqual(occupants(etat, 2), [9, null, 5]);
    assert.deepEqual(occupants(etat, 3), [7, 8, null]);
    assert.deepEqual(etat.reserve, [10, 11, 12]);
  });
});

describe('etatPlaces : les sources qui ne décrivent plus la configuration (§ 8.9, § 9)', () => {
  test('un retenu de trois tours sous R = 4 : au tour 4, source et cible réservations', () => {
    const charge = petiteRetenue();
    charge.retenu = retenuDe(1, planFichier({ tables: [1, 2, 3, 4], capacites: [3, 3, 3, 3], participants: DOUZE, tours: PARFAIT.slice(0, 3) }));
    const etat = etatPlaces(charge, { tour: 4 });
    assert.equal(etat.source, 'reservations');
    assert.equal(etat.cible, 'reservations');
    assert.equal(etatPlaces(charge, { tour: 3 }).source, 'retenu');
  });

  test('un retenu qui déclare une table supprimée : ses occupants en réserve, evalue faux', () => {
    const charge = petiteRetenue();
    charge.tables = charge.tables.filter(({ id }) => id !== 4);
    const etat = etatPlaces(charge, { tour: 1 });
    assert.equal(etat.source, 'retenu');
    assert.equal(etat.evalue, false);
    assert.equal(etat.tables.length, 3);
    assert.deepEqual(etat.reserve, [10, 11, 12]);
  });

  test('une proposition qui assied huit personnes à une table ramenée à 6 : deux dans la réserve', () => {
    const charge = creerCharge({ id: 'evt-huit', nom: 'Soirée des Merles', siegesParDefaut: 8, tours: 1 });
    charge.participants = Array.from({ length: 10 }, (_, rang) => personne(rang + 1, `Merle ${rang + 1}`));
    charge.tables = [table(1, 6), table(2)];
    charge.prochainsIds = { participant: 11, table: 3, proposition: 2 };
    charge.propositions = [
      propositionDe(1, planFichier({ tables: [1, 2], capacites: [8, 8], participants: charge.participants.map(({ id }) => id), tours: [[[1, 2, 3, 4, 5, 6, 7, 8], [9, 10]]] })),
    ];
    const etat = etatPlaces(charge, { tour: 1, proposition: 1 });
    assert.equal(etat.source, 'proposition');
    assert.deepEqual(occupants(etat, 0), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(etat.reserve, [7, 8]);
    assert.equal(etat.evalue, false);
  });

  test('sans attribution, une table ramenée à 6 qui en porte huit : la personne réservée à cette table s’assied avant les autres', () => {
    const charge = creerCharge({ id: 'evt-huit', nom: 'Soirée des Merles', siegesParDefaut: 8, tours: 1 });
    charge.participants = Array.from({ length: 10 }, (_, rang) => personne(rang + 1, `Merle ${rang + 1}`));
    charge.tables = [table(1, 6), table(2)];
    charge.reservations = [resa(8, 1, null)];
    charge.prochainsIds = { participant: 11, table: 3, proposition: 2 };
    const plan = planFichier({ tables: [1, 2], capacites: [8, 8], participants: charge.participants.map(({ id }) => id), tours: [[[1, 2, 3, 4, 5, 6, 7, 8], [9, 10]]] });
    charge.propositions = [propositionDe(1, plan)];
    for (const etat of [etatPlaces(charge, { tour: 1, proposition: 1 }), etatPlaces({ ...charge, retenu: retenuDe(1, plan), evenement: { ...charge.evenement, etat: 'retenu' } }, { tour: 1 })]) {
      assert.deepEqual(occupants(etat, 0), [1, 2, 3, 4, 5, 8]);
      assert.deepEqual(etat.reserve, [6, 7]);
      assert.equal(etat.tables[0].chaises[5].remplissage, 'plein');
      assert.deepEqual(etat.tables[0].chaises[5].marques, ['cadenasFerme', 'anneau']);
    }
  });

  test('un retenu fautif : source réservations, cible null, refus RETENU_FAUTIF, et etatPlaces ne lève à aucun tour', () => {
    const charge = petiteRetenue();
    charge.retenu.placement[0].sieges[0] = [1, 2, 3, 4];
    for (let tour = 1; tour <= 4; tour += 1) {
      const etat = etatPlaces(charge, { tour });
      assert.equal(etat.source, 'reservations');
      assert.equal(etat.cible, null);
      assert.deepEqual(etat.refus, { code: 'RETENU_FAUTIF', details: { remede: { geste: 'ouvrirSecours', source: 'precedent' } } });
    }
  });

  test('une proposition demandée qui n’existe pas ou se contredit ne se montre pas', () => {
    const charge = petiteRetenue({ retenu: false });
    assert.equal(etatPlaces(charge, { tour: 1, proposition: 9 }).source, 'reservations');
    charge.propositions[0].placement[0].reserve = [1];
    assert.equal(etatPlaces(charge, { tour: 1, proposition: 1 }).source, 'reservations');
  });
});

describe('etatPlaces : titres, réservations et marques (§ 4.1, § 4.4, § 7.6)', () => {
  // Cinq tables de 4, mode table ; Grisaille (4) et les autres sans réservation.
  function chargeTitres({ attribuerSieges = false } = {}) {
    const charge = creerCharge({ id: 'evt-titres', nom: 'Soirée des Lucioles', siegesParDefaut: 4, tours: 2 });
    charge.reglages.attribuerSieges = attribuerSieges;
    charge.participants = [
      personne(1, 'Ombrelle', 'Iris'),
      personne(2, 'Pervenche', 'Théo'),
      personne(3, 'Lacasse', 'Ondine'),
      personne(4, 'Grisaille'),
      personne(5, 'Bruyère', 'Anouk'),
    ];
    charge.tables = [1, 2, 3, 4, 5].map((id) => table(id));
    charge.prochainsIds = { participant: 6, table: 6, proposition: 1 };
    return charge;
  }

  test('pourvu par une réservation seulement : le retenu qui assied Grisaille à la table 5 ne pourvoit pas son titre', () => {
    const charge = chargeTitres();
    charge.titres = [{ table: 5, siege: 1, libelle: 'animation' }];
    const plan = planFichier({ tables: [1, 2, 3, 4, 5], capacites: [4, 4, 4, 4, 4], participants: [1, 2, 3, 4, 5], tours: [[[1], [2], [3], [5], [4]], [[2], [3], [5], [1], [4]]] });
    charge.propositions = [propositionDe(1, plan)];
    charge.retenu = retenuDe(1, plan);
    charge.prochainsIds.proposition = 2;
    const chaise = etatPlaces(charge, { tour: 1 }).tables[4].chaises[0];
    assert.equal(chaise.occupant, 4);
    assert.deepEqual(chaise.titre, { libelle: 'animation', pourvu: false });
    assert.equal(chaise.reservation, null);
    assert.equal(chaise.remplissage, 'hachure');
    assert.deepEqual(chaise.marques, ['cadenasOuvert']);
    assert.deepEqual(
      titresNonPourvus(charge).map(({ table: t }) => t),
      [5],
    );
  });

  test('exclusion : Iris désignée puis exclue laisse ses réservations, son titre redevient non pourvu ; réintégrée, il l’est de nouveau', () => {
    const designee = executer('designer', chargeTitres(), { participant: 1, table: 3, siege: null, libelle: 'animatrice' }).charge;
    const exclue = executer('exclureParticipant', designee, { id: 1 }).charge;
    assert.deepEqual(exclue.reservations, designee.reservations);
    const sansIris = etatPlaces(exclue, { tour: 1 }).tables[2];
    assert.deepEqual(sansIris.titres, { titres: 1, pourvus: 0 });
    assert.deepEqual(
      [sansIris.chaises[0].remplissage, sansIris.chaises[0].marques, sansIris.chaises[0].titre.pourvu],
      ['hachure', ['cadenasOuvert'], false],
    );
    const reintegree = executer('reintegrerParticipant', exclue, { id: 1 }).charge;
    const avecIris = etatPlaces(reintegree, { tour: 1 }).tables[2];
    assert.deepEqual(avecIris.titres, { titres: 1, pourvus: 1 });
    assert.deepEqual(
      [avecIris.chaises[0].occupant, avecIris.chaises[0].remplissage, avecIris.chaises[0].marques, avecIris.chaises[0].titre.pourvu],
      [1, 'plein', ['cadenasFerme', 'anneau'], true],
    );
    assert.deepEqual(avecIris.chaises[0].reservation, { participant: 1, portee: 'tous', tour: null });
  });

  test('deux titres sur une place : la chaise montre le premier dans l’ordre canonique, la table en compte deux', () => {
    const charge = chargeTitres();
    charge.titres = [
      { table: 2, siege: 2, libelle: 'hôte' },
      { table: 2, siege: 2, libelle: 'animation' },
    ];
    const deux = etatPlaces(charge, { tour: 1 }).tables[1];
    assert.equal(deux.chaises[1].titre.libelle, 'animation');
    assert.equal(deux.titres.titres, 2);
  });

  test('deux réservations de personnes différentes au même siège et au même tour : la chaise porte la première, la seconde au premier siège libre', () => {
    const charge = chargeTitres({ attribuerSieges: true });
    charge.reservations = [resa(3, 1, 2, 1), resa(2, 1, 2)];
    const premiere = etatPlaces(charge, { tour: 1 }).tables[0];
    assert.deepEqual(
      premiere.chaises.map(({ occupant }) => occupant),
      [3, 2, null, null],
    );
    assert.deepEqual(premiere.chaises[1].reservation, { participant: 2, portee: 'tous', tour: null });
    assert.deepEqual(premiere.chaises[0].reservation, { participant: 3, portee: 'tour', tour: 1 });
    assert.deepEqual(premiere.chaises[0].marques, ['cadenasFerme']);
    // Au tour 2, seule la réservation « tous » tient le siège 2.
    assert.deepEqual(
      etatPlaces(charge, { tour: 2 }).tables[0].chaises.map(({ occupant }) => occupant),
      [null, 2, null, null],
    );
  });

  test('mode table : la personne réservée sans siège qui pourvoit un titre s’affiche sur sa chaise', () => {
    const charge = chargeTitres();
    charge.titres = [{ table: 1, siege: 3, libelle: 'animation' }];
    charge.reservations = [resa(2, 1, null)];
    const premiere = etatPlaces(charge, { tour: 1 }).tables[0];
    assert.deepEqual(
      premiere.chaises.map(({ occupant }) => occupant),
      [null, null, 2, null],
    );
    assert.deepEqual([premiere.chaises[2].remplissage, premiere.chaises[2].titre.pourvu], ['plein', true]);
    assert.deepEqual(premiere.titres, { titres: 1, pourvus: 1 });
  });

  test('une table gelée : k_t = c_t', () => {
    const charge = chargeTitres();
    charge.reservations = [1, 2, 3, 4].map((id) => resa(id, 2, null));
    const etat = etatPlaces(charge, { tour: 1 });
    assert.deepEqual(
      etat.tables.map(({ gelee }) => gelee),
      [false, true, false, false, false],
    );
  });

  test("le marqueur de chaise vide : la liste [12, null, 7] du retenu assied 12 au siège 1 et 7 au siège 3", () => {
    const charge = petiteRetenue();
    charge.tables = [table(1, 4), table(2, 4), table(3, 4), table(4, 4)];
    const plan = planFichier({
      tables: [1, 2, 3, 4],
      capacites: [4, 4, 4, 4],
      participants: DOUZE,
      tours: [[[12, null, 7], [1, 2, 3], [4, 5, 6], [8, 9, 10, 11]], ...PARFAIT.slice(1)],
      siegesAttribues: true,
    });
    charge.retenu = retenuDe(1, plan);
    assert.deepEqual(occupants(etatPlaces(charge, { tour: 1 }), 0), [12, null, 7, null]);
  });
});

describe('etatPlaces : la réservation au siège que le placement ne tient pas (§ 5.8, § 7.6, § 14.12)', () => {
  // La petite démonstration, son plan parfait retenu sous des sièges
  // attribués : au tour 1, la table 1 assied 1, 2, 3 aux sièges 1 à 3.
  function auxSieges() {
    const charge = petite();
    charge.reglages.attribuerSieges = true;
    charge.propositions = [propositionDe(1, planParfait(true))];
    charge.prochainsIds.proposition = 2;
    charge.retenu = retenuDe(1, planParfait(true));
    charge.evenement.etat = 'retenu';
    return charge;
  }

  test("la chaise réservée à 2, qu'occupe 3 : la réservation se lit, mais ne la tient pas — hachure et cadenas fermé, l'anneau de sa portée, le titre pourvu ; la chaise de 2 reste sans marque", () => {
    const charge = auxSieges();
    charge.reservations.push(resa(2, 1, 3));
    charge.titres.push({ table: 1, siege: 3, libelle: 'Animation' });
    const [, deux, trois] = etatPlaces(charge, { tour: 1 }).tables[0].chaises;
    assert.equal(trois.occupant, 3);
    assert.deepEqual(trois.reservation, { participant: 2, portee: 'tous', tour: null });
    assert.deepEqual([trois.remplissage, trois.marques], ['hachure', ['cadenasFerme', 'anneau']]);
    // La hachure dit la réservation non tenue, non le titre : 3, assis au
    // siège titré, le pourvoit (§ 4.1).
    assert.deepEqual(trois.titre, { libelle: 'Animation', pourvu: true });
    assert.deepEqual([deux.occupant, deux.reservation, deux.remplissage, deux.marques], [2, null, 'normal', []]);
  });

  test('vide, la chaise réservée ne se tient pas non plus ; tenue par sa personne, elle est pleine', () => {
    const vide = auxSieges();
    vide.retenu.placement[0].sieges[0] = [1, 2];
    vide.retenu.placement[0].reserve = [3];
    vide.reservations.push(resa(2, 1, 3, 1));
    const chaise = etatPlaces(vide, { tour: 1 }).tables[0].chaises[2];
    assert.deepEqual([chaise.occupant, chaise.reservation?.participant, chaise.remplissage, chaise.marques], [null, 2, 'hachure', ['cadenasFerme']]);

    const tenue = auxSieges();
    tenue.reservations.push(resa(3, 1, 3));
    const pleine = etatPlaces(tenue, { tour: 1 }).tables[0].chaises[2];
    assert.deepEqual([pleine.occupant, pleine.remplissage, pleine.marques], [3, 'plein', ['cadenasFerme', 'anneau']]);
  });

  test("une réservation d'un tour que la chaise vide ne tient pas, et un titre que rien ne pourvoit : deux formes, cadenas fermé d'un côté, ouvert de l'autre (§ 7.6)", () => {
    const charge = auxSieges();
    charge.retenu.placement[0].sieges[0] = [1, 2];
    charge.retenu.placement[0].reserve = [3];
    charge.reservations.push(resa(2, 1, 3, 1));
    charge.titres.push({ table: 2, siege: 1, libelle: 'Accueil' });
    const etat = etatPlaces(charge, { tour: 1 });
    const reservee = etat.tables[0].chaises[2];
    const titree = etat.tables[1].chaises[0];
    assert.deepEqual([reservee.reservation?.participant, reservee.titre, reservee.remplissage, reservee.marques], [2, null, 'hachure', ['cadenasFerme']]);
    assert.deepEqual([titree.reservation, titree.titre, titree.remplissage, titree.marques], [null, { libelle: 'Accueil', pourvu: false }, 'hachure', ['cadenasOuvert']]);
  });
});

describe('libellePropose et statuts (§ 4, § 4.2)', () => {
  test('le titre pressenti, puis le libellé le plus fréquent, le plus petit à égalité, puis « animateur », jamais marqué', () => {
    const charge = creerCharge({ id: 'evt-libelles', nom: 'Soirée des Lucioles', siegesParDefaut: 4, tours: 2 });
    charge.participants = [personne(1, 'Ombrelle', 'Iris', { titrePressenti: 'hôtesse' }), personne(2, 'Pervenche', 'Théo')];
    charge.tables = [table(1), table(2)];
    charge.prochainsIds = { participant: 3, table: 3, proposition: 1 };
    assert.equal(libellePropose(charge, 2), 'animateur');
    assert.equal(libellePropose(charge, 1), 'hôtesse');
    charge.titres = [
      { table: 1, siege: 1, libelle: 'veilleur' },
      { table: 1, siege: 2, libelle: 'accueil' },
      { table: 2, siege: 1, libelle: 'veilleur' },
      { table: 2, siege: 2, libelle: 'accueil' },
      { table: 2, siege: 3, libelle: 'Zélie' },
    ];
    assert.equal(libellePropose(charge, 2), 'accueil');
    charge.titres.push({ table: 1, siege: 3, libelle: 'veilleur' });
    assert.equal(libellePropose(charge, 2), 'veilleur');
    assert.equal(libellePropose(charge, 1), 'hôtesse');
  });

  test('ancré, ancré, partiellement fixé, mobile ; un exclu sans entrée ; chacun égal au statut du moteur', () => {
    const charge = creerCharge({ id: 'evt-statuts', nom: 'Soirée des Lucioles', siegesParDefaut: 4, tours: 3 });
    charge.participants = [
      personne(1, 'Ombrelle', 'Iris'),
      personne(2, 'Pervenche', 'Théo'),
      personne(3, 'Lacasse', 'Ondine'),
      personne(4, 'Grisaille'),
      personne(5, 'Bruyère', 'Anouk', { exclu: true }),
    ];
    charge.tables = [table(1), table(2)];
    charge.prochainsIds = { participant: 6, table: 3, proposition: 1 };
    charge.reservations = [
      resa(1, 1, null),
      resa(2, 1, null, 1), resa(2, 1, null, 2), resa(2, 1, null, 3),
      resa(3, 1, null, 1), resa(3, 2, null, 2),
      resa(5, 2, null),
    ];
    const { parId, erreur } = statuts(charge);
    assert.equal(erreur, null);
    assert.deepEqual([...parId.entries()], [[1, 'ancre'], [2, 'ancre'], [3, 'partiel'], [4, 'mobile']]);
    const instance = normaliser(configurationDe(charge));
    const NOMS = new Map([[STATUT.ANCRE, 'ancre'], [STATUT.PARTIELLEMENT_FIXE, 'partiel'], [STATUT.MOBILE, 'mobile']]);
    assert.ok(parId.size > 0);
    for (const [id, statut] of parId) assert.equal(statut, NOMS.get(instance.statut[instance.indexDe.get(id)]));
  });

  test('une configuration qui ne se normalise pas rend son code au lieu de lever', () => {
    const charge = creerCharge({ id: 'evt-statuts', nom: 'Soirée des Lucioles', siegesParDefaut: 2, tours: 1 });
    charge.participants = [personne(1, 'Ombrelle', 'Iris'), personne(2, 'Pervenche', 'Théo'), personne(3, 'Grisaille')];
    charge.tables = [table(1)];
    charge.prochainsIds = { participant: 4, table: 2, proposition: 1 };
    charge.reservations = [1, 2, 3].map((id) => resa(id, 1, null));
    const { parId, erreur } = statuts(charge);
    assert.equal(erreur, 'SURRESERVATION');
    assert.equal(parId.size, 0);
    assert.doesNotThrow(() => etatPlaces(charge, { tour: 1 }));
    assert.equal(etatPlaces(charge, { tour: 1 }).evalue, false);
  });
});

// --- Sans présence, les valeurs d'avant -------------------------------------

// La charge témoin : la petite démonstration, son plan parfait retenu sous
// des sièges attribués, quatre réservations (une « tous » au siège 3 de la
// table 1, que 3 occupe au tour 1 ; une de tour sans siège ; une « tous » au
// siège 1 de la table 3 ; celle d'une exclue), deux titres, et 12 exclue.
// Aucune personne ne porte de champ presence.
function chargeTemoin() {
  const charge = petite();
  charge.reglages.attribuerSieges = true;
  charge.propositions = [propositionDe(1, planParfait(true))];
  charge.prochainsIds.proposition = 2;
  charge.retenu = retenuDe(1, planParfait(true));
  charge.evenement.etat = 'retenu';
  charge.reservations = [resa(2, 1, 3), resa(5, 2, null, 2), resa(7, 3, 1), resa(12, 4, 2)];
  charge.titres = [{ table: 1, siege: 3, libelle: 'Animation' }, { table: 4, siege: 1, libelle: 'Accueil' }];
  charge.participants.find(({ id }) => id === 12).exclu = true;
  return charge;
}

// Ce qu'un état des places montre, réduit à ce qui se compare : la réserve,
// les absentes, les occupants de chaque table, chaque chaise réservée
// (« table:siège:personne:remplissage ») et les titres pourvus par table.
const resumeEtat = (etat) => ({
  reserve: etat.reserve,
  absents: etat.absents,
  occupants: etat.tables.map(({ chaises }) => chaises.map(({ occupant }) => occupant)),
  tenues: etat.tables.flatMap(({ id, chaises }) =>
    chaises.filter(({ reservation }) => reservation !== null).map(({ siege, reservation, remplissage }) => `${id}:${siege}:${reservation.participant}:${remplissage}`),
  ),
  titres: etat.tables.map(({ titres }) => titres.pourvus),
});

describe('sans aucune présence, la règle par tour rend les valeurs figées d’avant', () => {
  test('la charge témoin : état de chaque tour, réservations par tour, capacités, bilan du défaut, violations du retenu', () => {
    const charge = chargeTemoin();
    assert.equal(aDesAbsences(charge), false);
    assert.deepEqual(presencesPartielles(charge), []);
    const tours = [1, 2, 3, 4].map((tour) => resumeEtat(etatPlaces(charge, { tour })));
    assert.deepEqual(tours, [
      { reserve: [], absents: [], occupants: [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, null]], tenues: ['1:3:2:hachure', '3:1:7:plein'], titres: [1, 0, 0, 0] },
      { reserve: [], absents: [], occupants: [[5, 9, 10], [1, 7, 11], [2, 6, null], [3, 4, 8]], tenues: ['1:3:2:hachure', '3:1:7:hachure'], titres: [1, 0, 0, 0] },
      { reserve: [], absents: [], occupants: [[6, 8, 11], [3, 9, null], [1, 4, 10], [2, 5, 7]], tenues: ['1:3:2:hachure', '3:1:7:hachure'], titres: [1, 0, 0, 0] },
      { reserve: [], absents: [], occupants: [[4, 7, null], [2, 8, 10], [3, 5, 11], [1, 6, 9]], tenues: ['1:3:2:hachure', '3:1:7:hachure'], titres: [1, 0, 0, 0] },
    ]);
    assert.deepEqual(charge.tables.map(({ id }) => reservationsParTour(charge, id)), [[1, 1, 1, 1], [0, 1, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0]]);
    assert.deepEqual(controlerCapacite(charge, 2, 2, { origine: 'poignee' }).refus, {
      code: 'SOUS_OCCUPES',
      details: { table: 2, n: 3, tour: 1, remede: { geste: 'afficherTour', tour: 1, proposition: null } },
    });
    const bilan = bilanChangementDefaut(charge, 2);
    assert.equal(bilan.participants, 11);
    assert.deepEqual(bilan.presentsParTour, [11, 11, 11, 11]);
    assert.deepEqual(bilan.refus.map(({ table, code }) => [table, code]), [[1, 'SIEGES_RETIRES']]);
    assert.deepEqual(
      bilan.avertissements.map(({ details: { table, tour, personnes } }) => [table, tour, ...personnes]),
      [[2, 1, 6], [2, 2, 11], [2, 4, 10], [3, 1, 9], [3, 3, 10], [3, 4, 11], [4, 2, 8], [4, 3, 7], [4, 4, 9]],
    );
    assert.deepEqual(invariantViole(charge).details.violations, [
      { code: 'RESERVATION', participant: 2, table: 1, tour: 2 },
      { code: 'RESERVATION', participant: 5, table: 2, tour: 2 },
      { code: 'RESERVATION', participant: 7, table: 3, tour: 2 },
      { code: 'RESERVATION', participant: 2, table: 1, tour: 3 },
      { code: 'RESERVATION', participant: 7, table: 3, tour: 3 },
      { code: 'RESERVATION', participant: 2, table: 1, tour: 4 },
      { code: 'RESERVATION', participant: 7, table: 3, tour: 4 },
      { code: 'RESERVATION', participant: 2, table: 1, tour: 1, siege: 3, occupant: 3 },
    ]);
  });

  test('la petite démonstration : sans source, chacun en réserve ; retenue sans attribution, le plan parfait, et la capacité au champ verse le plus grand identifiant', () => {
    const libre = petite();
    for (let tour = 1; tour <= 4; tour += 1) {
      const etat = etatPlaces(libre, { tour });
      assert.deepEqual([etat.reserve, etat.absents], [DOUZE, []]);
    }
    assert.deepEqual(bilanChangementDefaut(libre, 2).presentsParTour, [12, 12, 12, 12]);
    assert.equal(bilanChangementDefaut(libre, 2).participants, 12);
    const retenue = petiteRetenue();
    retenue.reservations = [resa(4, 1, null, 3)];
    assert.deepEqual(
      [1, 2, 3, 4].map((tour) => resumeEtat(etatPlaces(retenue, { tour })).occupants),
      PARFAIT,
    );
    assert.deepEqual(controlerCapacite(retenue, 1, 2, { origine: 'champ' }).avertissements, [
      { code: 'SURNUMERAIRES', details: { table: 1, tour: 1, personnes: [3] } },
      { code: 'SURNUMERAIRES', details: { table: 1, tour: 2, personnes: [10] } },
      { code: 'SURNUMERAIRES', details: { table: 1, tour: 3, personnes: [11] } },
      { code: 'SURNUMERAIRES', details: { table: 1, tour: 4, personnes: [12] } },
    ]);
    assert.deepEqual(invariantViole(retenue).details.violations, [{ code: 'RESERVATION', participant: 4, table: 1, tour: 3 }]);
  });

  test('refusDuDepart : la charge témoin, réintégrée puis réduite aux réservations du tour 1, et la petite démonstration sous sièges attribués', () => {
    // Le nom affiché de la personne id de la charge, tel que le refus le porte.
    const nomDe = (charge, id) => nomAffiche(charge.participants.find((personne) => personne.id === id));
    // Une exclue que le départ assied ne le bloque plus : il s'ajuste à la
    // présence, et le refus suivant se lit.
    const temoin = chargeTemoin();
    assert.deepEqual(refusDuDepart(temoin, { id: 1, toursFiges: [1] }), {
      code: 'DEPART_RESERVATION_NON_TENUE',
      details: { depart: 1, participant: 2, table: 1, tour: 2, personne: nomDe(temoin, 2), numero: 1, remede: { geste: 'repartirDeZero' } },
    });
    // Une table agrandie le bloque.
    const agrandie = chargeTemoin();
    agrandie.tables[0].sieges = 9;
    const refusAgrandie = refusDuDepart(agrandie, { id: 1, toursFiges: [1] });
    assert.deepEqual(
      [refusAgrandie.code, refusAgrandie.details.statut, refusAgrandie.details.raisons.map(({ code }) => code)],
      ['DEPART_NON_COMPARABLE', 'derive', ['CAPACITE_CHANGEE']],
    );
    const reintegree = chargeTemoin();
    reintegree.participants.find(({ id }) => id === 12).exclu = false;
    assert.deepEqual(refusDuDepart(reintegree, { id: 1, toursFiges: [1] }), {
      code: 'DEPART_RESERVATION_NON_TENUE',
      details: { depart: 1, participant: 2, table: 1, tour: 2, personne: nomDe(reintegree, 2), numero: 1, remede: { geste: 'repartirDeZero' } },
    });
    const premierTour = structuredClone(reintegree);
    premierTour.reservations = [resa(2, 1, 3, 1), resa(7, 3, 1, 1), resa(12, 4, 2, 1)];
    assert.deepEqual(refusDuDepart(premierTour, { id: 1, toursFiges: [1] }), {
      code: 'DEPART_SIEGE_NON_TENU',
      details: { depart: 1, participant: 2, table: 1, siege: 3, tour: 1, personne: nomDe(premierTour, 2), numero: 1, remede: { geste: 'libererTour', tour: 1 } },
    });
    assert.equal(refusDuDepart(premierTour, { id: 1, toursFiges: [2, 3] }), null);

    // La petite démonstration, son plan parfait proposé sous sièges
    // attribués, sans retenu.
    const attribuee = (reservations) => {
      const charge = petiteRetenue({ retenu: false });
      charge.reglages.attribuerSieges = true;
      charge.propositions = [propositionDe(1, planParfait(true))];
      charge.reservations = reservations;
      return charge;
    };
    assert.equal(refusDuDepart(attribuee([]), { id: 1, toursFiges: [1] }), null);
    const auSiege = attribuee([resa(2, 1, 3, 1)]);
    assert.deepEqual(refusDuDepart(auSiege, { id: 1, toursFiges: [1] }), {
      code: 'DEPART_SIEGE_NON_TENU',
      details: { depart: 1, participant: 2, table: 1, siege: 3, tour: 1, personne: nomDe(auSiege, 2), numero: 1, remede: { geste: 'libererTour', tour: 1 } },
    });
    assert.equal(refusDuDepart(auSiege, { id: 1, toursFiges: [2] }), null);
    const auTour3 = attribuee([resa(4, 1, null, 3)]);
    assert.deepEqual(refusDuDepart(auTour3, { id: 1, toursFiges: [1] }), {
      code: 'DEPART_RESERVATION_NON_TENUE',
      details: { depart: 1, participant: 4, table: 1, tour: 3, personne: nomDe(auTour3, 4), numero: 1, remede: { geste: 'repartirDeZero' } },
    });
  });
});

// --- La règle R1 : présente au tour -----------------------------------------

// Le plan parfait de la petite démonstration, où 4 est absente aux tours 3 et
// 4 : elle quitte sa liste et va aux absents de ces tours.
function planSans4() {
  const plan = planParfait();
  for (const rang of [2, 3]) {
    const etage = plan.placement[rang];
    etage.sieges = etage.sieges.map((liste) => liste.filter((id) => id !== 4));
    etage.absents = [4];
  }
  return plan;
}

describe('la règle R1 : une personne présente au tour, et ses réservations (§ 5.8)', () => {
  test('presenceSaisie lit le champ : null pour tous les tours, sinon une copie de la liste', () => {
    const iris = personne(1, 'Ombrelle', 'Iris');
    assert.equal(presenceSaisie(iris), null);
    const theo = personne(2, 'Pervenche', 'Théo', { presence: [1, 3] });
    const lue = presenceSaisie(theo);
    assert.deepEqual(lue, [1, 3]);
    lue.push(4);
    assert.deepEqual(theo.presence, [1, 3]);
  });

  test('présente au tour : dans la charge, non exclue, et le tour dans sa présence ; presentsAuTour, aDesAbsences, presencesPartielles', () => {
    const charge = petite();
    charge.participants[3].presence = [1, 2];
    charge.participants[6].presence = [2];
    charge.participants[6].exclu = true;
    assert.deepEqual([1, 2, 3, 4].map((tour) => presentAuTour(charge, 4, tour)), [true, true, false, false]);
    assert.deepEqual([1, 2, 3, 4].map((tour) => presentAuTour(charge, 7, tour)), [false, false, false, false]);
    assert.equal(presentAuTour(charge, 99, 1), false);
    assert.deepEqual([...presentsAuTour(charge, 3)].sort((a, b) => a - b), [1, 2, 3, 5, 6, 8, 9, 10, 11, 12]);
    assert.equal(presentsAuTour(charge, 1).size, 11);
    assert.equal(aDesAbsences(charge), true);
    assert.deepEqual(presencesPartielles(charge), [4]);
    // L'exclue seule porte une présence partielle : aucune absence ne compte.
    delete charge.participants[3].presence;
    assert.equal(aDesAbsences(charge), false);
    assert.deepEqual(presencesPartielles(charge), []);
  });

  test('une réservation « tous » de 4, présente aux tours 1 et 2, ne la tient pas au tour 3 : ni assise, ni en réserve, mais absente', () => {
    const charge = petite();
    charge.participants[3].presence = [1, 2];
    charge.reservations = [resa(4, 2, null), resa(7, 2, null, 3)];
    assert.deepEqual(reservationsCouvrantes(charge, 1), [resa(4, 2, null)]);
    assert.deepEqual(reservationsCouvrantes(charge, 3), [resa(7, 2, null, 3)]);
    const tour1 = etatPlaces(charge, { tour: 1 });
    assert.deepEqual(occupants(tour1, 1), [4, null, null]);
    assert.deepEqual(tour1.absents, []);
    const tour3 = etatPlaces(charge, { tour: 3 });
    assert.deepEqual(occupants(tour3, 1), [7, null, null]);
    assert.ok(tour3.tables.every(({ chaises }) => chaises.every(({ occupant, reservation }) => occupant !== 4 && reservation?.participant !== 4)));
    assert.deepEqual(tour3.reserve, DOUZE.filter((id) => id !== 4 && id !== 7));
    assert.deepEqual(tour3.absents, [4]);
  });

  test('un retenu ajusté à la présence : au tour 3, la chaise de 4 est libre, la réserve vide, 4 absente ; un retenu qui l’assied encore ne la montre pas', () => {
    const charge = petiteRetenue();
    charge.participants[3].presence = [1, 2];
    charge.retenu = retenuDe(1, planSans4());
    const ajuste = etatPlaces(charge, { tour: 3 });
    assert.equal(ajuste.evalue, true);
    assert.deepEqual(occupants(ajuste, 2), [1, 10, null]);
    assert.deepEqual([ajuste.reserve, ajuste.absents], [[], [4]]);
    assert.deepEqual(etatPlaces(charge, { tour: 2 }).absents, []);

    const enDerive = petiteRetenue();
    enDerive.participants[3].presence = [1, 2];
    const tour3 = etatPlaces(enDerive, { tour: 3 });
    assert.equal(tour3.evalue, false);
    assert.deepEqual(occupants(tour3, 2), [1, 10, null]);
    assert.deepEqual([tour3.reserve, tour3.absents], [[], [4]]);
    // Une exclue n'est pas absente : elle n'est nulle part.
    enDerive.participants[4].exclu = true;
    enDerive.participants[4].presence = [1];
    assert.deepEqual(etatPlaces(enDerive, { tour: 3 }).absents, [4]);
  });
});

// Un tirage déterministe : un générateur congruentiel de graine fixe, dont
// tire(n) rend un entier de 0 à n − 1.
function tirage(graine) {
  let etat = graine >>> 0;
  return (n) => {
    etat = (Math.imul(etat, 1103515245) + 12345) >>> 0;
    return (etat >>> 16) % n;
  };
}

// Une charge tirée : huit personnes, trois tables de quatre, de un à quatre
// tours, des présences, des exclues et des réservations quelconques. Elle ne
// se normalise pas toujours.
function chargeTiree(tire) {
  const tours = 1 + tire(4);
  const charge = creerCharge({ id: 'evt-tirage', nom: 'Soirée des Lucioles', siegesParDefaut: 4, tours });
  charge.tables = [table(1), table(2), table(3)];
  charge.participants = Array.from({ length: 8 }, (_, rang) => {
    const autres = { exclu: tire(8) === 0 };
    const presence = Array.from({ length: tours }, (__, r) => r + 1).filter(() => tire(3) > 0);
    if (tire(2) === 0 && presence.length > 0 && presence.length < tours) autres.presence = presence;
    return personne(rang + 1, `Tirée ${rang + 1}`, null, autres);
  });
  charge.reservations = Array.from({ length: tire(7) }, () =>
    resa(1 + tire(8), 1 + tire(3), tire(2) === 0 ? null : 1 + tire(4), tire(2) === 0 ? null : 1 + tire(tours)),
  );
  charge.prochainsIds = { participant: 9, table: 4, proposition: 1 };
  return charge;
}

describe('propriété : les réservations couvrantes sont celles que le moteur fixe', () => {
  test('sur des charges tirées (graine fixe), reservationsCouvrantes(charge, r) désigne exactement les personnes que instance.fixe fixe au tour r, à la même table', () => {
    const tire = tirage(20261018);
    let comparees = 0;
    let suspendues = 0;
    for (let essai = 0; essai < 150; essai += 1) {
      const charge = chargeTiree(tire);
      const instance = instanceDe(charge);
      if (instance === null) continue;
      comparees += 1;
      const { R, ids, idsTables, fixe } = instance;
      for (let tour = 1; tour <= R; tour += 1) {
        const couvrantes = new Map(reservationsCouvrantes(charge, tour).map(({ participant, table: idTable }) => [participant, idTable]));
        const fixees = new Map();
        ids.forEach((id, p) => {
          if (fixe[p * R + tour - 1] !== LIBRE) fixees.set(id, idsTables[fixe[p * R + tour - 1]]);
        });
        const trie = (carte) => [...carte].sort((a, b) => a[0] - b[0]);
        assert.deepEqual(trie(couvrantes), trie(fixees), `essai ${essai}, tour ${tour}`);
        suspendues += charge.reservations.filter(
          (r) => (r.portee === 'tous' || r.tour === tour) && charge.participants.some(({ id, presence }) => id === r.participant && presence !== undefined && !presence.includes(tour)),
        ).length;
      }
    }
    assert.ok(comparees >= 60, `${comparees} charges normalisées`);
    assert.ok(suspendues >= 20, `${suspendues} réservations suspendues par une absence`);
  });
});
