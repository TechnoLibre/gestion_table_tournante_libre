// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du contrôle de pose (§ 5.9, § 4.4) : chaque refus d'une pose, son
// remède écrit en entier, le cumul de plusieurs refus, le signal d'une table
// gelée, le compte des réservations par tour, le contrôle d'une
// réintégration et celui d'une présence qui s'étend, sous la règle par tour
// (une réservation ne tient sa personne qu'à ses tours de présence). Les noms
// d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { normaliser } from '../moteur/configuration.js';
import { ErreurConfiguration } from '../moteur/erreurs.js';
import { configurationDepuisCharge, creerCharge } from '../stockage/document.js';
import { COMMANDES } from './commandes.js';
import { ErreurCommande } from './erreurs.js';
import { controlerPose, controlerPresence, controlerReintegration, reservationsParTour } from './pose.js';

const NOMS = [
  ['Ombrelle', 'Iris'],
  ['Pervenche', 'Théo'],
  ['Lacasse', 'Ondine'],
  ['Grisaille', null],
  ['Bruyère', 'Anouk'],
  ['Sarcelle', 'Capucine'],
  ['Ancolie', 'Amandine'],
  ['Mélèze', 'Basile'],
  ['Quenouille', 'Hortense'],
  ['Pivoine', 'Gaspard'],
];

const personne = (id, autres = {}) => ({
  id,
  nom: NOMS[(id - 1) % NOMS.length][0],
  prenom: NOMS[(id - 1) % NOMS.length][1],
  appartenance: null,
  courriel: null,
  titrePressenti: null,
  notes: null,
  exclu: false,
  ...autres,
});

const table = (id, sieges = null) => ({ id, numero: id, sieges, forme: 'ronde', position: { x: 300 * id, y: 0 } });

// Réservation « tous les tours » quand tour est null, du tour donné sinon.
const resa = (participant, idTable, siege, tour = null) => ({
  participant,
  table: idTable,
  siege,
  portee: tour === null ? 'tous' : 'tour',
  tour,
});

// Une charge de R tours, siegesParDefaut places par défaut, qui porte ce
// qu'on lui donne ; les compteurs dépassent chaque identifiant donné.
function chargeDe({
  participants = 10,
  exclus = [],
  tables = [table(1), table(2, 8), table(3)],
  reservations = [],
  titres = [],
  tours = 4,
  sieges = 4,
  attribuerSieges = false,
} = {}) {
  const charge = creerCharge({ id: 'evt-pose', nom: 'Soirée des Lucioles', siegesParDefaut: sieges, tours });
  charge.reglages.attribuerSieges = attribuerSieges;
  charge.participants = Array.from({ length: participants }, (_, rang) =>
    personne(rang + 1, { exclu: exclus.includes(rang + 1) }),
  );
  charge.tables = tables;
  charge.reservations = reservations;
  charge.titres = titres;
  charge.prochainsIds = { participant: participants + 1, table: 10, proposition: 1 };
  return charge;
}

// Le refus d'une ErreurCommande levée par appel, de ce code ; ses détails
// contiennent ceux donnés.
function refuse(appel, code, attendus = {}) {
  assert.throws(appel, (erreur) => {
    assert.ok(erreur instanceof ErreurCommande, `ErreurCommande attendue, reçu ${erreur}`);
    assert.equal(erreur.code, code);
    for (const [cle, valeur] of Object.entries(attendus)) assert.deepEqual(erreur.details[cle], valeur, cle);
    return true;
  });
}

const executer = (nom, charge, args) => COMMANDES.get(nom)(charge, args);

// La charge où la pose serait faite : la réservation ajoutée telle quelle.
const avecPose = (charge, { participant, table: idTable, siege, portee, tour }) => ({
  ...charge,
  reservations: [...charge.reservations, { participant, table: idTable, siege, portee, tour }],
});

describe('controlerPose : les refus de pose (§ 5.9)', () => {
  test('quatre réservations « tous » à une table de 4 : la cinquième SURRESERVATION aux détails du moteur, la quatrième gelée', () => {
    const quatre = chargeDe({ reservations: [1, 2, 3, 4].map((id) => resa(id, 1, null)) });
    const pose = { participant: 5, table: 1, siege: null, portee: 'tous', tour: null };
    const { refus, signaux } = controlerPose(quatre, pose);
    assert.equal(refus.length, 1);
    assert.equal(refus[0].code, 'SURRESERVATION');
    const { remede, ...details } = refus[0].details;
    assert.deepEqual(details, { table: 1, tour: 1, reservees: 5, capacite: 4 });
    assert.deepEqual(remede, { commande: 'changerPlacesTable', arguments: { id: 1, sieges: 5, origine: 'champ' } });
    let duMoteur = null;
    try {
      normaliser(configurationDepuisCharge(avecPose(quatre, pose)));
    } catch (erreur) {
      duMoteur = erreur;
    }
    assert.ok(duMoteur instanceof ErreurConfiguration);
    assert.equal(duMoteur.code, 'SURRESERVATION');
    assert.deepEqual(duMoteur.details, details);
    assert.deepEqual(signaux, []);

    const trois = chargeDe({ reservations: [1, 2, 3].map((id) => resa(id, 1, null)) });
    const quatrieme = controlerPose(trois, { participant: 4, table: 1, siege: null, portee: 'tous', tour: null });
    assert.deepEqual(quatrieme, { refus: [], signaux: [{ code: 'TABLE_GELEE', table: 1 }] });
    assert.deepEqual(reservationsParTour(quatre, 1), [4, 4, 4, 4]);
    assert.deepEqual(reservationsParTour(quatre, 2), [0, 0, 0, 0]);
  });

  test("reservationsParTour compte les personnes distinctes non exclues dont une réservation couvre le tour", () => {
    const charge = chargeDe({
      exclus: [4],
      reservations: [resa(1, 1, null), resa(1, 1, 2, 3), resa(2, 1, null, 2), resa(3, 1, null, 2), resa(4, 1, null)],
    });
    assert.deepEqual(reservationsParTour(charge, 1), [1, 3, 1, 1]);
  });

  test('sièges attribués, le siège 9 d’une table de 8 : SIEGE_INEXISTANT ; sans attribution, aucun', () => {
    const pose = { participant: 1, table: 2, siege: 9, portee: 'tous', tour: null };
    const { refus } = controlerPose(chargeDe({ attribuerSieges: true }), pose);
    assert.deepEqual(refus, [
      {
        code: 'SIEGE_INEXISTANT',
        details: {
          table: 2,
          siege: 9,
          capacite: 8,
          remede: { commande: 'changerPlacesTable', arguments: { id: 2, sieges: 9, origine: 'champ' } },
        },
      },
    ]);
    assert.deepEqual(controlerPose(chargeDe(), pose).refus, []);
    const { charge } = executer('reserver', chargeDe(), { participant: 1, table: 2, siege: 9, portee: 'tous', tour: null });
    assert.deepEqual(charge.reservations, [resa(1, 2, null)]);
  });

  test('« tous » à la table 1 puis le tour 2 à la table 2 : DEUX_PLACES_MEME_TOUR, et son remède déplace la première', () => {
    const charge = chargeDe({ reservations: [resa(1, 1, null)] });
    const { refus } = controlerPose(charge, { participant: 1, table: 2, siege: 4, portee: 'tour', tour: 2 });
    assert.deepEqual(refus, [
      {
        code: 'DEUX_PLACES_MEME_TOUR',
        details: {
          participant: 1,
          tour: 2,
          autre: { table: 1, siege: null, portee: 'tous', tour: null },
          remede: {
            commande: 'deplacerReservation',
            arguments: { participant: 1, de: { table: 1, portee: 'tous', tour: null }, vers: { table: 2, siege: 4 } },
          },
        },
      },
    ]);
  });

  test("deux sièges d'une même table au même tour : DEUX_PLACES_MEME_TOUR, que normaliser accepterait", () => {
    const charge = chargeDe({ attribuerSieges: true, reservations: [resa(1, 1, 1, 3)] });
    const pose = { participant: 1, table: 1, siege: 2, portee: 'tour', tour: 3 };
    assert.doesNotThrow(() => normaliser(configurationDepuisCharge(avecPose(charge, pose))));
    const { refus } = controlerPose(charge, pose);
    assert.deepEqual(
      refus.map(({ code, details }) => [code, details.tour, details.autre]),
      [['DEUX_PLACES_MEME_TOUR', 3, { table: 1, siege: 1, portee: 'tour', tour: 3 }]],
    );
  });

  test('déplacer sa propre réservation ne la compte pas contre la pose (depuis)', () => {
    const charge = chargeDe({ reservations: [1, 2, 3, 4].map((id) => resa(id, 1, null)) });
    const pose = { participant: 4, table: 2, siege: null, portee: 'tous', tour: null, depuis: { table: 1, portee: 'tous', tour: null } };
    assert.deepEqual(controlerPose(charge, pose), { refus: [], signaux: [] });
  });

  test('une personne exclue : PERSONNE_EXCLUE, remède la réintégration', () => {
    const { refus } = controlerPose(chargeDe({ exclus: [3] }), { participant: 3, table: 1, siege: null, portee: 'tour', tour: 1 });
    assert.deepEqual(refus, [
      {
        code: 'PERSONNE_EXCLUE',
        details: { participant: 3, remede: { commande: 'reintegrerParticipant', arguments: { id: 3 } } },
      },
    ]);
  });

  test("une place réservée à une autre : PLACE_RESERVEE, remède choisir une place pour la réservation de la titulaire", () => {
    const charge = chargeDe({ attribuerSieges: true, reservations: [resa(2, 2, 3, 2)] });
    const { refus } = controlerPose(charge, { participant: 1, table: 2, siege: 3, portee: 'tous', tour: null });
    assert.deepEqual(refus, [
      {
        code: 'PLACE_RESERVEE',
        details: {
          table: 2,
          siege: 3,
          tour: 2,
          titulaire: 2,
          portee: 'tour',
          remede: {
            geste: 'choisirPlace',
            puis: { commande: 'deplacerReservation', arguments: { participant: 2, de: { table: 2, portee: 'tour', tour: 2 } } },
          },
        },
      },
    ]);
    // Sans attribution des sièges, la place réservée reste refusée.
    const sansAttribution = { ...charge, reglages: { ...charge.reglages, attribuerSieges: false } };
    assert.deepEqual(
      controlerPose(sansAttribution, { participant: 1, table: 2, siege: 3, portee: 'tour', tour: 2 }).refus.map(({ code }) => code),
      ['PLACE_RESERVEE'],
    );
    // Une titulaire « tous » : le remède désigne sa réservation sans tour.
    const tous = chargeDe({ attribuerSieges: true, reservations: [resa(2, 2, 3)] });
    const [place] = controlerPose(tous, { participant: 1, table: 2, siege: 3, portee: 'tour', tour: 4 }).refus;
    assert.deepEqual(place.details.remede.puis.arguments.de, { table: 2, portee: 'tous', tour: null });
    assert.equal(place.details.portee, 'tous');
  });

  test('une réservation suspendue ne compte pas : sa place et son siège sont libres pour une pose', () => {
    const charge = chargeDe({ attribuerSieges: true, exclus: [2], reservations: [resa(2, 1, 1), resa(3, 1, 2), resa(4, 1, 3), resa(5, 1, 4)] });
    assert.deepEqual(controlerPose(charge, { participant: 1, table: 1, siege: 1, portee: 'tous', tour: null }).refus, []);
    assert.deepEqual(reservationsParTour(charge, 1), [3, 3, 3, 3]);
  });

  test('dans le retenu, une personne réservée ailleurs : RESERVEE_AILLEURS, remède le déplacement de sa réservation', () => {
    const charge = chargeDe({ reservations: [resa(1, 1, null)] });
    const { refus } = controlerPose(charge, { participant: 1, table: 2, siege: 5, portee: 'tour', tour: 2, retenu: true });
    assert.deepEqual(refus, [
      {
        code: 'RESERVEE_AILLEURS',
        details: {
          participant: 1,
          tour: 2,
          reservation: { table: 1, siege: null, portee: 'tous', tour: null },
          remede: {
            commande: 'deplacerReservation',
            arguments: { participant: 1, de: { table: 1, portee: 'tous', tour: null }, vers: { table: 2, siege: 5 } },
          },
        },
      },
    ]);
    // Le retenu ne pose aucune réservation : ni surréservation ni double place.
    const pleine = chargeDe({ reservations: [2, 3, 4, 5].map((id) => resa(id, 1, null)) });
    assert.deepEqual(controlerPose(pleine, { participant: 1, table: 1, siege: null, portee: 'tour', tour: 1, retenu: true }), {
      refus: [],
      signaux: [],
    });
  });

  test('une pose qui cumule des refus les rend tous, dans l’ordre du contrat, chacun avec un remède non nul', () => {
    const charge = chargeDe({
      attribuerSieges: true,
      exclus: [1],
      reservations: [resa(1, 3, 1, 2), resa(2, 2, 3, 2), ...[3, 4, 5, 6, 7, 8, 9].map((id) => resa(id, 2, null))],
    });
    const { refus } = controlerPose(charge, { participant: 1, table: 2, siege: 9, portee: 'tour', tour: 2 });
    assert.deepEqual(
      refus.map(({ code }) => code),
      ['SIEGE_INEXISTANT', 'PERSONNE_EXCLUE'],
    );
    const cumul = chargeDe({ attribuerSieges: true, exclus: [1], reservations: [resa(2, 2, 3, 2)] });
    const deux = controlerPose(cumul, { participant: 1, table: 2, siege: 3, portee: 'tour', tour: 2 }).refus;
    assert.deepEqual(
      deux.map(({ code }) => code),
      ['PERSONNE_EXCLUE', 'PLACE_RESERVEE'],
    );
    const actif = chargeDe({ attribuerSieges: true, reservations: [resa(1, 1, null), resa(2, 2, 3, 2), ...[3, 4, 5, 6, 7, 8, 9].map((id) => resa(id, 2, null))] });
    const tous = controlerPose(actif, { participant: 1, table: 2, siege: 3, portee: 'tour', tour: 2 }).refus;
    assert.deepEqual(
      tous.map(({ code }) => code),
      ['SURRESERVATION', 'DEUX_PLACES_MEME_TOUR', 'PLACE_RESERVEE'],
    );
    for (const { details } of [...refus, ...deux, ...tous]) {
      assert.ok(details.remede !== null && typeof details.remede === 'object', 'remède non nul');
    }
  });

  test('une commande lève le premier refus et porte les suivants dans details.autres', () => {
    const charge = chargeDe({ attribuerSieges: true, exclus: [1], reservations: [resa(2, 2, 3, 2)] });
    refuse(() => executer('reserver', charge, { participant: 1, table: 2, siege: 3, portee: 'tour', tour: 2 }), 'PERSONNE_EXCLUE', {
      participant: 1,
      autres: controlerPose(charge, { participant: 1, table: 2, siege: 3, portee: 'tour', tour: 2 }).refus.slice(1),
    });
  });
});

describe('controlerReintegration : la place d’une suspendue (§ 4.4, § 5.9)', () => {
  // Sièges attribués : Iris désignée au siège 1 de la table 3, puis exclue.
  function irisDesigneeExclue() {
    const charge = chargeDe({ attribuerSieges: true });
    const designee = executer('designer', charge, { participant: 1, table: 3, siege: 1, libelle: 'animatrice' }).charge;
    return executer('exclureParticipant', designee, { id: 1 }).charge;
  }

  test('désigner Théo à la place d’Iris exclue passe ; réintégrer Iris est refusé PLACE_RESERVEE, sans rien écrire', () => {
    const exclue = irisDesigneeExclue();
    const avecTheo = executer('designer', exclue, { participant: 2, table: 3, siege: 1, libelle: 'animatrice' }).charge;
    assert.deepEqual(
      avecTheo.reservations.filter(({ table: t }) => t === 3),
      [resa(1, 3, 1), resa(2, 3, 1)],
    );
    const avant = structuredClone(avecTheo);
    assert.deepEqual(
      controlerReintegration(avecTheo, 1).map(({ code, details }) => [code, details.table, details.siege, details.titulaire]),
      [['PLACE_RESERVEE', 3, 1, 2]],
    );
    refuse(() => executer('reintegrerParticipant', avecTheo, { id: 1 }), 'PLACE_RESERVEE', {
      table: 3,
      siege: 1,
      titulaire: 2,
      autres: [],
    });
    assert.deepEqual(avecTheo, avant);
  });

  test('une table de 4 dont une réservation est suspendue reçoit une cinquième ; réintégrer est alors refusé SURRESERVATION', () => {
    const charge = chargeDe({ exclus: [1], reservations: [1, 2, 3, 4].map((id) => resa(id, 1, null)) });
    const cinq = executer('reserver', charge, { participant: 5, table: 1, siege: null, portee: 'tous', tour: null }).charge;
    assert.deepEqual(
      controlerReintegration(cinq, 1).map(({ code, details: { remede, ...details } }) => [code, details]),
      [['SURRESERVATION', { table: 1, tour: 1, reservees: 5, capacite: 4 }]],
    );
    refuse(() => executer('reintegrerParticipant', cinq, { id: 1 }), 'SURRESERVATION', { table: 1, reservees: 5 });
  });

  test('sans conflit, la réintégration passe et rend les réservations', () => {
    const exclue = irisDesigneeExclue();
    assert.deepEqual(controlerReintegration(exclue, 1), []);
    const { charge, avertissements } = executer('reintegrerParticipant', exclue, { id: 1 });
    assert.equal(charge.participants[0].exclu, false);
    assert.deepEqual(charge.reservations, exclue.reservations);
    assert.deepEqual(
      avertissements.map(({ code }) => code),
      ['RESERVATIONS_RETABLIES'],
    );
  });

  test('une personne présente n’a rien à contrôler', () => {
    assert.deepEqual(controlerReintegration(chargeDe({ reservations: [resa(1, 1, null)] }), 1), []);
  });
});

// La charge où chaque personne de presences ({id: liste}) porte cette
// présence ; une liste null retire le champ (tous les tours).
function avecPresences(charge, presences) {
  return {
    ...charge,
    participants: charge.participants.map((personne) => {
      if (!Object.hasOwn(presences, personne.id)) return personne;
      const rendue = { ...personne };
      if (presences[personne.id] === null) delete rendue.presence;
      else rendue.presence = presences[personne.id];
      return rendue;
    }),
  };
}

describe('controlerPose : la présence par tour (§ 5.8, § 5.9)', () => {
  test('une réservation « tour » à un tour d’absence : PERSONNE_ABSENTE_AU_TOUR, son remède dit présente à ce tour en plus, tours triés', () => {
    const charge = avecPresences(chargeDe(), { 2: [1, 4] });
    const { refus } = controlerPose(charge, { participant: 2, table: 1, siege: null, portee: 'tour', tour: 2 });
    assert.deepEqual(refus, [
      {
        code: 'PERSONNE_ABSENTE_AU_TOUR',
        details: {
          participant: 2,
          personne: 'Théo Pervenche',
          tour: 2,
          remede: { commande: 'changerPresence', arguments: { id: 2, tours: [1, 2, 4] } },
        },
      },
    ]);
    const dernier = controlerPose(avecPresences(chargeDe(), { 4: [1, 2] }), { participant: 4, table: 2, siege: 3, portee: 'tour', tour: 3 });
    assert.deepEqual(dernier.refus.map(({ code, details }) => [code, details.personne, details.remede.arguments]), [
      ['PERSONNE_ABSENTE_AU_TOUR', 'Grisaille', { id: 4, tours: [1, 2, 3] }],
    ]);
    refuse(() => executer('reserver', charge, { participant: 2, table: 1, siege: null, portee: 'tour', tour: 3 }), 'PERSONNE_ABSENTE_AU_TOUR', {
      tour: 3,
      remede: { commande: 'changerPresence', arguments: { id: 2, tours: [1, 3, 4] } },
    });
  });

  test('un dépôt dans le retenu à un tour d’absence : le même refus ; à un tour de présence, ou « tous les tours », aucun', () => {
    const charge = avecPresences(chargeDe(), { 2: [1, 4] });
    assert.deepEqual(
      controlerPose(charge, { participant: 2, table: 2, siege: null, portee: 'tour', tour: 3, retenu: true }).refus.map(({ code, details }) => [
        code,
        details.tour,
        details.remede.arguments.tours,
      ]),
      [['PERSONNE_ABSENTE_AU_TOUR', 3, [1, 3, 4]]],
    );
    assert.deepEqual(controlerPose(charge, { participant: 2, table: 2, siege: null, portee: 'tour', tour: 4, retenu: true }).refus, []);
    assert.deepEqual(controlerPose(charge, { participant: 2, table: 2, siege: null, portee: 'tour', tour: 1 }).refus, []);
    assert.deepEqual(controlerPose(charge, { participant: 2, table: 2, siege: 2, portee: 'tous', tour: null }).refus, []);
  });

  test('une exclue absente au tour : PERSONNE_EXCLUE seul, sa présence est suspendue', () => {
    const charge = avecPresences(chargeDe({ exclus: [3] }), { 3: [1] });
    assert.deepEqual(
      controlerPose(charge, { participant: 3, table: 1, siege: null, portee: 'tour', tour: 2 }).refus.map(({ code }) => code),
      ['PERSONNE_EXCLUE'],
    );
  });

  test('une réservation à un tour d’absence ne compte pas : ni dans reservationsParTour, ni contre une pose, ni pour sa place', () => {
    const charge = avecPresences(chargeDe({ reservations: [1, 2, 3, 4].map((id) => resa(id, 1, id)) }), { 4: [1, 2, 4] });
    assert.deepEqual(reservationsParTour(charge, 1), [4, 4, 3, 4]);
    assert.deepEqual(controlerPose(charge, { participant: 5, table: 1, siege: 4, portee: 'tour', tour: 3 }), { refus: [], signaux: [] });
    const tous = controlerPose(charge, { participant: 5, table: 1, siege: null, portee: 'tous', tour: null });
    assert.deepEqual(tous.refus.map(({ code, details: { remede, ...details } }) => [code, details]), [
      ['SURRESERVATION', { table: 1, tour: 1, reservees: 5, capacite: 4 }],
    ]);
    // Absente aux tours 1, 2 et 4, une personne posée « tous » ne compte qu'au
    // tour 3, où la place de 4 est libre.
    const partielle = avecPresences(charge, { 5: [3] });
    assert.deepEqual(controlerPose(partielle, { participant: 5, table: 1, siege: 4, portee: 'tous', tour: null }).refus, []);
  });

  test('deux réservations de la même personne à deux tables, l’une à ses seuls tours d’absence : DEUX_PLACES_MEME_TOUR quand même, ses réservations s’excluent quelle que soit sa présence', () => {
    const attendu = [
      {
        code: 'DEUX_PLACES_MEME_TOUR',
        details: {
          participant: 2,
          tour: 3,
          autre: { table: 1, siege: null, portee: 'tour', tour: 3 },
          remede: { commande: 'deplacerReservation', arguments: { participant: 2, de: { table: 1, portee: 'tour', tour: 3 }, vers: { table: 2, siege: null } } },
        },
      },
    ];
    const charge = avecPresences(chargeDe({ reservations: [resa(2, 1, null, 3)] }), { 2: [1, 2] });
    assert.deepEqual(controlerPose(charge, { participant: 2, table: 2, siege: null, portee: 'tous', tour: null }).refus, attendu);
    const presente = chargeDe({ reservations: [resa(2, 1, null, 3)] });
    assert.deepEqual(controlerPose(presente, { participant: 2, table: 2, siege: null, portee: 'tous', tour: null }).refus, attendu);
  });

  test('la chaîne pose puis présence rendue : une pose acceptée, puis une présence que controlerPresence accepte, laissent une charge qui se normalise', () => {
    const charge = avecPresences(chargeDe({ reservations: [resa(2, 1, null, 3)] }), { 2: [1, 2, 4] });
    refuse(() => executer('reserver', charge, { participant: 2, table: 2, siege: null, portee: 'tous', tour: null }), 'DEUX_PLACES_MEME_TOUR', {
      tour: 3,
    });
    // Chaque pose de 2, à chaque table, chaque portée et deux sièges : une
    // pose sans refus, écrite, puis la présence rendue à tous les tours ; si
    // controlerPresence n'y oppose rien, la charge rendue se normalise.
    const portees = [{ portee: 'tous', tour: null }, ...[1, 2, 3, 4].map((tour) => ({ portee: 'tour', tour }))];
    let acceptees = 0;
    for (const idTable of [1, 2, 3]) {
      for (const siege of [null, 2]) {
        for (const { portee, tour } of portees) {
          const pose = { participant: 2, table: idTable, siege, portee, tour };
          if (controlerPose(charge, pose).refus.length > 0) continue;
          const posee = avecPose(charge, pose);
          const rendue = avecPresences(posee, { 2: null });
          if (controlerPresence(posee, rendue, [2]).length > 0) continue;
          acceptees += 1;
          assert.doesNotThrow(() => normaliser(configurationDepuisCharge(rendue)), JSON.stringify(pose));
        }
      }
    }
    assert.ok(acceptees >= 6, `${acceptees} poses acceptées`);
  });

  test('sièges attribués, un siège inexistant à un tour d’absence : SIEGE_INEXISTANT puis PERSONNE_ABSENTE_AU_TOUR, dans cet ordre', () => {
    const charge = avecPresences(chargeDe({ attribuerSieges: true }), { 2: [1, 4] });
    const pose = { participant: 2, table: 1, siege: 9, portee: 'tour', tour: 2 };
    const { refus } = controlerPose(charge, pose);
    assert.deepEqual(refus.map(({ code }) => code), ['SIEGE_INEXISTANT', 'PERSONNE_ABSENTE_AU_TOUR']);
    refuse(() => executer('reserver', charge, pose), 'SIEGE_INEXISTANT', {
      siege: 9,
      autres: [
        {
          code: 'PERSONNE_ABSENTE_AU_TOUR',
          details: { participant: 2, personne: 'Théo Pervenche', tour: 2, remede: { commande: 'changerPresence', arguments: { id: 2, tours: [1, 2, 4] } } },
        },
      ],
    });
  });
});

describe('PERSONNE_ABSENTE_AU_TOUR : le remède s’exécute (§ 2.1, garantie 3)', () => {
  test('présente aux tours 3 et 4, réservée au tour 1 : le remède porte les tours 1, 3 et 4, croissants, changerPresence l’exécute, puis la réservation passe', () => {
    const charge = avecPresences(chargeDe(), { 2: [3, 4] });
    const pose = { participant: 2, table: 1, siege: null, portee: 'tour', tour: 1 };
    let leve = null;
    try {
      executer('reserver', charge, pose);
    } catch (erreur) {
      leve = erreur;
    }
    assert.ok(leve instanceof ErreurCommande);
    assert.equal(leve.code, 'PERSONNE_ABSENTE_AU_TOUR');
    const { remede } = leve.details;
    assert.deepEqual(remede, { commande: 'changerPresence', arguments: { id: 2, tours: [1, 3, 4] } });
    const presente = executer(remede.commande, charge, remede.arguments).charge;
    assert.deepEqual(presente.participants[1].presence, [1, 3, 4]);
    const { charge: reservee } = executer('reserver', presente, pose);
    assert.deepEqual(reservee.reservations, [resa(2, 1, null, 1)]);
  });
});

describe('controlerPresence : une présence qui s’étend (§ 5.9)', () => {
  test('deux réservations « tous » sur la dernière place de la table 1, l’une d’une personne absente au tour 3 : lui rendre le tour 3 refuse SURRESERVATION', () => {
    const charge = avecPresences(chargeDe({ reservations: [1, 2, 3, 4].map((id) => resa(id, 1, null)) }), { 4: [1, 2, 4] });
    const reserveeEnPlus = executer('reserver', charge, { participant: 5, table: 1, siege: null, portee: 'tour', tour: 3 }).charge;
    const apres = avecPresences(reserveeEnPlus, { 4: null });
    assert.deepEqual(controlerPresence(reserveeEnPlus, apres, [4]), [
      {
        code: 'SURRESERVATION',
        details: { table: 1, tour: 3, reservees: 5, capacite: 4, remede: { commande: 'changerPlacesTable', arguments: { id: 1, sieges: 5, origine: 'champ' } } },
      },
    ]);
  });

  test('deux réservations du même siège, l’une suspendue par une absence : lui rendre ce tour refuse PLACE_RESERVEE, le remède déplace celle de la titulaire', () => {
    const charge = avecPresences(chargeDe({ attribuerSieges: true, reservations: [resa(1, 3, 2), resa(2, 3, 2, 2)] }), { 1: [1, 3, 4] });
    const apres = avecPresences(charge, { 1: [1, 2, 3, 4] });
    assert.deepEqual(controlerPresence(charge, apres, [1]), [
      {
        code: 'PLACE_RESERVEE',
        details: {
          table: 3,
          siege: 2,
          tour: 2,
          titulaire: 2,
          portee: 'tour',
          remede: { geste: 'choisirPlace', puis: { commande: 'deplacerReservation', arguments: { participant: 2, de: { table: 3, portee: 'tour', tour: 2 } } } },
        },
      },
    ]);
    // Rendre le tour 2 à la titulaire seule ne gagne rien pour 1 : aucun refus.
    assert.deepEqual(controlerPresence(charge, avecPresences(charge, { 1: [1, 3] }), [1]), []);
  });

  test('une présence qui ne gagne aucun tour, ou qui gagne un tour sans réservation en conflit, rend []', () => {
    const charge = avecPresences(chargeDe({ reservations: [1, 2, 3, 4].map((id) => resa(id, 1, null)) }), { 4: [1, 2] });
    assert.deepEqual(controlerPresence(charge, avecPresences(charge, { 4: [2] }), [4]), []);
    assert.deepEqual(controlerPresence(charge, avecPresences(charge, { 4: null }), [4]), []);
    assert.deepEqual(controlerPresence(charge, charge, [1, 2, 3, 4]), []);
  });
});

describe('controlerReintegration : sur les seuls tours de présence (§ 4.4)', () => {
  test('une exclue présente aux tours 1 et 2, réservée « tous » au siège 1 que tient une autre au tour 3 : réintégrer passe', () => {
    const charge = avecPresences(chargeDe({ attribuerSieges: true, exclus: [1], reservations: [resa(1, 3, 1), resa(2, 3, 1, 3)] }), { 1: [1, 2] });
    assert.deepEqual(controlerReintegration(charge, 1), []);
    const toutes = avecPresences(charge, { 1: null });
    assert.deepEqual(controlerReintegration(toutes, 1).map(({ code, details }) => [code, details.tour]), [['PLACE_RESERVEE', 3]]);
  });

  test('une table pleine au tour 3 seulement : réintégrer une exclue absente au tour 3 passe ; présente, SURRESERVATION au tour 3', () => {
    const reservations = [resa(1, 1, null), resa(2, 1, null), resa(3, 1, null), resa(4, 1, null, 3), resa(5, 1, null)];
    const charge = avecPresences(chargeDe({ exclus: [1], reservations }), { 1: [1, 2, 4] });
    assert.deepEqual(controlerReintegration(charge, 1), []);
    const presente = avecPresences(charge, { 1: null });
    assert.deepEqual(controlerReintegration(presente, 1).map(({ code, details }) => [code, details.tour, details.reservees]), [['SURRESERVATION', 3, 5]]);
  });
});
