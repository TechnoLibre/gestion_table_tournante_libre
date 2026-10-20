// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du départ d'une génération dérivée (§ 5.7, § 8.9, § 14.10) : la
// filiation lue dans la charge, les refus du lancement dans leur ordre, le
// départ ajusté à la présence et ses écarts, la recopie des tours figés et
// leur contrôle. Les noms d'épreuve sont inventés ; la version vient du
// module engendré.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { creerCharge } from '../stockage/document.js';
import { ajusterALaPresence, derive, planDepuisFichier } from '../stockage/placements.js';
import { VERSION } from '../version.genere.js';
import {
  arrivantesSansChaise,
  departAdapte,
  departDuMoteur,
  derivationDe,
  ecartAuRetenu,
  ecartsDuDepart,
  planDuDepart,
  recopierPlacement,
  recopierToursFiges,
  refusDuDepart,
  siegesDesArrivantes,
  tourFigeDifferent,
} from './depart.js';

const PERSONNES = [
  [1, 'Iris', 'Ombrelle'],
  [2, 'Théo', 'Pervenche'],
  [3, 'Ondine', 'Lacasse'],
  [4, 'Basile', 'Tourteau'],
  [5, 'Maëlle', 'Quenouille'],
];

const personne = ([id, prenom, nom]) => ({
  id,
  nom,
  prenom,
  appartenance: null,
  courriel: null,
  titrePressenti: null,
  notes: null,
  exclu: false,
});

// Deux tables de trois places : l'identifiant 1 porte le numéro 3,
// l'identifiant 2 le numéro 7, pour que le libellé lise le numéro.
const table = (id, numero) => ({ id, numero, sieges: null, forme: 'ronde', position: { x: 300 * id, y: 0 } });

// Trois tours de cinq personnes, listes rangées par identifiant croissant.
const TOURS_RANGES = [
  [[1, 2, 3], [4, 5]],
  [[1, 4, 5], [2, 3]],
  [[2, 4], [1, 3, 5]],
];

// Une proposition de fichier de ces deux tables, chaque tour donné par ses
// listes ; la réserve est vide, tout le monde étant assis.
const propositionDe = (id, tours, { siegesAttribues = false } = {}) => ({
  id,
  graine: 48271 + id,
  arret: 200000,
  historique: 1000,
  produitVersion: VERSION.affichee,
  siegesAttribues,
  tables: [1, 2],
  capacites: [3, 3],
  tours: tours.length,
  participants: [1, 2, 3, 4, 5],
  placement: tours.map((listes) => ({ sieges: listes.map((liste) => [...liste]), reserve: [] })),
});

// Une charge de cinq personnes, deux tables et trois tours, qui porte la
// proposition n° 4, comparable.
function chargeDe({ attribuerSieges = false, propositions = [propositionDe(4, TOURS_RANGES)] } = {}) {
  const charge = creerCharge({ id: 'evt-essai', nom: 'Soirée des Pinsons', siegesParDefaut: 3, tours: 3 });
  charge.participants = PERSONNES.map(personne);
  charge.tables = [table(1, 3), table(2, 7)];
  charge.reglages.attribuerSieges = attribuerSieges;
  charge.propositions = propositions;
  charge.prochainsIds = { participant: 6, table: 3, proposition: 9 };
  charge.evenement.etat = 'propose';
  return charge;
}

// Les mêmes cinq personnes sous des sièges attribués : chaque liste dans
// l'ordre des sièges, une chaise vide au siège 2 de la table 3 au tour 2.
const TOURS_ASSIS = [
  [[2, 1, 3], [5, 4]],
  [[1, null, 4], [3, 2, 5]],
  [[4, 2], [5, 1, 3]],
];

// Une charge sous sièges attribués, des deux côtés quand le départ les
// attribue aussi.
const chargeAssise = ({ departAttribue = true, attribuerSieges = true } = {}) =>
  chargeDe({
    attribuerSieges,
    propositions: [
      departAttribue ? propositionDe(4, TOURS_ASSIS, { siegesAttribues: true }) : propositionDe(4, TOURS_RANGES),
    ],
  });

const resa = (participant, idTable, siege, tour = null) => ({
  participant,
  table: idTable,
  siege,
  portee: tour === null ? 'tous' : 'tour',
  tour,
});

const repartirDeZero = { geste: 'repartirDeZero' };

// Une dérivée de n° 4, sans valider : la charge la lit telle quelle.
const deriveeDe = (id, depart, toursFiges = null) => {
  const derivee = propositionDe(id, TOURS_RANGES);
  const { produitVersion, siegesAttribues, tables, capacites, tours, participants, placement, ...identite } = derivee;
  return {
    ...identite,
    depart,
    ...(toursFiges === null ? {} : { toursFiges }),
    produitVersion,
    siegesAttribues,
    tables,
    capacites,
    tours,
    participants,
    placement,
  };
};

// Le retenu qui reprend une proposition, de la forme Retenu :
// l'identifiant de sa proposition d'origine, puis les seuls champs du
// placement — ni identité, ni filiation, ni version.
const retenuDe = ({ id, graine, arret, historique, depart, toursFiges, produitVersion, ...placement }) => ({
  proposition: id,
  ...placement,
});

// La même proposition, ses tables déclarées dans l'ordre inverse : les
// listes de chaque tour suivent leurs tables.
const tablesInversees = (proposition) => ({
  ...proposition,
  tables: [...proposition.tables].reverse(),
  placement: proposition.placement.map(({ sieges, reserve }) => ({ sieges: [...sieges].reverse(), reserve })),
});

// Une copie gelée en profondeur : toute écriture dans l'argument lève.
function gele(valeur) {
  if (typeof valeur === 'object' && valeur !== null) {
    for (const enfant of Object.values(valeur)) gele(enfant);
    Object.freeze(valeur);
  }
  return valeur;
}

describe('départ : la filiation (C7, D76)', () => {
  test('une dérivée rend son départ, ses tours figés et la présence du départ dans la liste', () => {
    const charge = chargeDe({ propositions: [propositionDe(4, TOURS_RANGES), deriveeDe(6, 4, [1, 3]), deriveeDe(7, 4)] });
    assert.deepEqual(derivationDe(charge, 6), { depart: 4, toursFiges: [1, 3], departPresent: true });
    assert.deepEqual(derivationDe(charge, 7), { depart: 4, toursFiges: [], departPresent: true }, 'sans la clé, aucun tour figé');
  });

  test('un départ effacé : departPresent faux, la dérivée garde sa filiation', () => {
    const charge = chargeDe({ propositions: [deriveeDe(6, 4, [2])] });
    assert.deepEqual(derivationDe(charge, 6), { depart: 4, toursFiges: [2], departPresent: false });
  });

  test('null pour une proposition sans départ, un identifiant absent, et le retenu', () => {
    const charge = chargeDe({ propositions: [propositionDe(4, TOURS_RANGES), deriveeDe(6, 4, [1])] });
    // Le retenu reprend une dérivée : sa proposition porte une filiation,
    // que 'retenu' ne rend pas.
    charge.retenu = retenuDe(deriveeDe(6, 4, [1]));
    assert.equal(derivationDe(charge, 4), null);
    assert.equal(derivationDe(charge, 12), null);
    assert.notEqual(derivationDe(charge, 6), null);
    assert.equal(derivationDe(charge, 'retenu'), null);
  });

  test('les tours figés rendus sont une copie : la charge ne change pas', () => {
    const charge = gele(chargeDe({ propositions: [propositionDe(4, TOURS_RANGES), deriveeDe(6, 4, [1])] }));
    const derivation = derivationDe(charge, 6);
    derivation.toursFiges.push(2);
    assert.deepEqual(charge.propositions[1].toursFiges, [1]);
  });
});

describe('départ : le plan du départ', () => {
  test('le plan par identifiants, listes rangées sans chaise vide', () => {
    const charge = chargeAssise();
    assert.deepEqual(planDuDepart(charge, 4), {
      tables: [1, 2],
      tours: [
        [[1, 2, 3], [4, 5]],
        [[1, 4], [2, 3, 5]],
        [[2, 4], [1, 3, 5]],
      ],
      reserves: [[], [], []],
    });
  });

  test('TypeError pour un identifiant absent ou une proposition fautive', () => {
    assert.throws(() => planDuDepart(chargeDe(), 12), TypeError);
    const fautif = propositionDe(4, [[[1, 2, 2], [4, 5]], ...TOURS_RANGES.slice(1)]);
    assert.throws(() => planDuDepart(chargeDe({ propositions: [fautif] }), 4), TypeError);
  });
});

describe('départ : les refus du lancement (C6, C24, D73)', () => {
  test('un départ en dérive par ses seuls participants sert de départ : une ajoutée, une ajoutée au seul tour 3, une exclue, une supprimée, une présence réduite aux tours 1 et 2', () => {
    const cas = [
      ['ajoutée', (charge) => charge.participants.push(personne([6, 'Aurèle', 'Pimprenelle']))],
      ['ajoutée au tour 3', (charge) => charge.participants.push({ ...personne([6, 'Aurèle', 'Pimprenelle']), presence: [3] })],
      ['exclue', (charge) => {
        charge.participants[4].exclu = true;
      }],
      ['supprimée', (charge) => {
        charge.participants = charge.participants.filter(({ id }) => id !== 5);
      }],
      ['réduite', (charge) => {
        charge.participants[2].presence = [1, 2];
      }],
    ];
    for (const [nom, changer] of cas) {
      const charge = chargeDe();
      changer(charge);
      assert.ok(derive(charge.propositions[0], charge).length > 0, `${nom} : le départ ne dérive pas`);
      for (const toursFiges of [[], [1, 2]]) {
        assert.equal(refusDuDepart(charge, { id: 4, toursFiges }), null, `${nom}, figés ${toursFiges}`);
      }
    }
  });

  test('un départ comparable qui tient les réservations n’est pas refusé, tours figés ou non', () => {
    const charge = chargeDe();
    charge.reservations = [resa(1, 1, null, 1), resa(5, 2, null, 3)];
    assert.equal(refusDuDepart(charge, { id: 4, toursFiges: [] }), null);
    assert.equal(refusDuDepart(charge, { id: 4, toursFiges: [1, 2] }), null);
  });

  test('DEPART_ABSENT : un identifiant hors de la liste, le retenu, ou l’origine effacée d’un retenu ajusté', () => {
    const charge = chargeDe();
    assert.deepEqual(refusDuDepart(charge, { id: 12, toursFiges: [] }), {
      code: 'DEPART_ABSENT',
      details: { depart: 12, remede: repartirDeZero },
    });
    // Un retenu ajusté n'est le plan d'aucune proposition : ni sous 'retenu',
    // ni sous l'identifiant de sa proposition d'origine, effacée.
    charge.retenu = retenuDe(propositionDe(2, TOURS_RANGES));
    assert.equal(refusDuDepart(charge, { id: 'retenu', toursFiges: [] }).code, 'DEPART_ABSENT');
    assert.deepEqual(refusDuDepart(charge, { id: 2, toursFiges: [1] }).details, { depart: 2, remede: repartirDeZero });
  });

  test('DEPART_ABSENT : le retenu n’est pas un départ, même quand sa proposition d’origine en est un', () => {
    const charge = chargeDe();
    charge.retenu = retenuDe(propositionDe(4, TOURS_RANGES));
    assert.equal(refusDuDepart(charge, { id: 4, toursFiges: [] }), null);
    assert.deepEqual(refusDuDepart(charge, { id: 'retenu', toursFiges: [] }), {
      code: 'DEPART_ABSENT',
      details: { depart: 'retenu', remede: repartirDeZero },
    });
  });

  test('DEPART_NON_COMPARABLE en dérive : le mobilier changé, seul ou mêlé aux participants, ne nomme que les raisons du mobilier', () => {
    const attendu = {
      code: 'DEPART_NON_COMPARABLE',
      details: {
        depart: 4,
        statut: 'derive',
        raisons: [{ code: 'CAPACITE_CHANGEE', table: 2, avant: 3, maintenant: 4, numero: 7 }],
        remede: repartirDeZero,
      },
    };
    const mobilier = chargeDe();
    mobilier.tables[1].sieges = 4;
    assert.deepEqual(refusDuDepart(mobilier, { id: 4, toursFiges: [] }), attendu);

    const meles = chargeDe();
    meles.tables[1].sieges = 4;
    meles.participants[4].exclu = true;
    meles.participants[2].presence = [1, 3];
    meles.participants.push(personne([6, 'Aurèle', 'Pimprenelle']));
    assert.deepEqual(
      derive(meles.propositions[0], meles).map(({ code }) => code),
      ['CAPACITE_CHANGEE', 'PARTICIPANT_EXCLU', 'PARTICIPANT_NON_PLACE', 'PRESENCE_RETIREE'],
    );
    assert.deepEqual(refusDuDepart(meles, { id: 4, toursFiges: [1] }), attendu);

    // Le nombre de tours changé bloque aussi.
    const tours = chargeDe();
    tours.evenement.tours = 4;
    const refus = refusDuDepart(tours, { id: 4, toursFiges: [] });
    assert.deepEqual([refus.code, refus.details.raisons.map(({ code }) => code)], ['DEPART_NON_COMPARABLE', ['TOURS_CHANGES']]);
  });

  test('DEPART_RESERVATION_NON_TENUE saute une arrivante, à un tour figé ou non, et refuse encore un départ qui assied une personne à une autre table que sa réservation', () => {
    const charge = chargeDe();
    charge.participants.push(personne([6, 'Aurèle', 'Pimprenelle']));
    // Au tour 1, figé, la table 7 a une chaise libre ; au tour 2, non figé, la
    // table 3 est pleine.
    charge.reservations = [resa(6, 2, null, 1), resa(6, 1, null, 2)];
    assert.equal(refusDuDepart(charge, { id: 4, toursFiges: [1] }), null);
    assert.equal(refusDuDepart(charge, { id: 4, toursFiges: [] }), null);
    // Une personne qui revient au tour 3, que le départ dit absente, est une
    // arrivante comme une ajoutée.
    const depart = propositionDe(4, TOURS_RANGES);
    depart.placement[2] = { sieges: [[2, 4], [1, 5]], reserve: [], absents: [3] };
    const revenue = chargeDe({ propositions: [depart] });
    revenue.reservations = [resa(3, 1, null, 3)];
    assert.equal(refusDuDepart(revenue, { id: 4, toursFiges: [] }), null);
    // Assise ailleurs que sa réservation, elle n'est pas une arrivante.
    charge.reservations.push(resa(4, 1, null, 1));
    assert.deepEqual(refusDuDepart(charge, { id: 4, toursFiges: [1] }), {
      code: 'DEPART_RESERVATION_NON_TENUE',
      details: { depart: 4, participant: 4, table: 1, tour: 1, personne: 'Basile Tourteau', numero: 3, remede: repartirDeZero },
    });
  });

  test('DEPART_SIEGE_NON_TENU saute une arrivante : son siège pris la met en réserve, sans refus', () => {
    const charge = chargeAssise();
    charge.participants.push({ ...personne([6, 'Aurèle', 'Pimprenelle']), presence: [1] });
    charge.participants[0].presence = [2, 3];
    // Le siège 1 de la table 7, au tour 1, est celui de Maëlle Quenouille.
    charge.reservations = [resa(6, 2, 1, 1)];
    assert.equal(refusDuDepart(charge, { id: 4, toursFiges: [1] }), null);
    assert.deepEqual(arrivantesSansChaise(charge, departAdapte(charge, 4), [1]), [{ participant: 6, tour: 1, cause: 'siege' }]);
  });

  test('DEPART_NON_COMPARABLE fautif : ses fautes pour raisons, le même remède', () => {
    const fautif = propositionDe(4, [[[1, 2, 2], [4, 5]], ...TOURS_RANGES.slice(1)]);
    const refus = refusDuDepart(chargeDe({ propositions: [fautif] }), { id: 4, toursFiges: [] });
    assert.equal(refus.code, 'DEPART_NON_COMPARABLE');
    assert.equal(refus.details.statut, 'fautif');
    assert.ok(refus.details.raisons.length > 0);
    assert.ok(refus.details.raisons.every(({ code }) => typeof code === 'string'));
    assert.deepEqual(refus.details.remede, repartirDeZero);
  });

  test('TOUR_FIGE_HORS_SOIREE nomme le premier tour hors de la soirée, remède libererTour', () => {
    assert.deepEqual(refusDuDepart(chargeDe(), { id: 4, toursFiges: [2, 4, 5] }), {
      code: 'TOUR_FIGE_HORS_SOIREE',
      details: { tour: 4, tours: 3, remede: { geste: 'libererTour', tour: 4 } },
    });
  });

  test('TOURS_FIGES_TOUS : le refus se pose contre les cases, sans remède', () => {
    assert.deepEqual(refusDuDepart(chargeDe(), { id: 4, toursFiges: [1, 2, 3] }), {
      code: 'TOURS_FIGES_TOUS',
      details: { tours: 3, remede: null },
    });
  });

  test('DEPART_RESERVATION_NON_TENUE : une réservation à une table posée depuis, dans un tour non figé', () => {
    const charge = chargeDe();
    charge.reservations = [resa(2, 1, null, 2)];
    const attendu = {
      code: 'DEPART_RESERVATION_NON_TENUE',
      details: { depart: 4, participant: 2, table: 1, tour: 2, personne: 'Théo Pervenche', numero: 3, remede: repartirDeZero },
    };
    assert.deepEqual(refusDuDepart(charge, { id: 4, toursFiges: [1] }), attendu, 'tour 2 non figé');
    assert.deepEqual(refusDuDepart(charge, { id: 4, toursFiges: [] }), attendu, 'aucun tour figé');
  });

  test('DEPART_RESERVATION_NON_TENUE à n’importe quel tour : une réservation « tous les tours » que le départ ne tient qu’aux deux premiers', () => {
    const charge = chargeDe();
    charge.reservations = [resa(1, 1, null)];
    const refus = refusDuDepart(charge, { id: 4, toursFiges: [] });
    assert.equal(refus.code, 'DEPART_RESERVATION_NON_TENUE');
    assert.equal(refus.details.tour, 3);
  });

  test('DEPART_RESERVATION_NON_TENUE : une table inconnue de la charge garde son seul identifiant', () => {
    const charge = chargeDe();
    charge.reservations = [resa(3, 99, null, 1)];
    assert.deepEqual(refusDuDepart(charge, { id: 4, toursFiges: [] }).details, {
      depart: 4,
      participant: 3,
      table: 99,
      tour: 1,
      personne: 'Ondine Lacasse',
      remede: repartirDeZero,
    });
  });

  test('DEPART_SIEGE_NON_TENU : une réservation à un siège dans un tour figé, sous sièges attribués des deux côtés', () => {
    const charge = chargeAssise();
    charge.reservations = [resa(1, 1, 1, 1)];
    assert.deepEqual(refusDuDepart(charge, { id: 4, toursFiges: [1] }), {
      code: 'DEPART_SIEGE_NON_TENU',
      details: {
        depart: 4,
        participant: 1,
        table: 1,
        siege: 1,
        tour: 1,
        personne: 'Iris Ombrelle',
        numero: 3,
        remede: { geste: 'libererTour', tour: 1 },
      },
    });
  });

  test('pas de refus de siège hors d’un tour figé, ni quand le départ ou l’événement n’attribue pas les sièges', () => {
    const reservations = [resa(1, 1, 1, 1)];
    const assise = chargeAssise();
    assise.reservations = reservations;
    assert.equal(refusDuDepart(assise, { id: 4, toursFiges: [2] }), null, 'tour 1 non figé');
    const sansEvenement = chargeAssise({ attribuerSieges: false });
    sansEvenement.reservations = reservations;
    assert.equal(refusDuDepart(sansEvenement, { id: 4, toursFiges: [1] }), null, 'l’événement n’attribue pas');
    const sansDepart = chargeAssise({ departAttribue: false });
    sansDepart.reservations = reservations;
    assert.equal(refusDuDepart(sansDepart, { id: 4, toursFiges: [1] }), null, 'le départ n’attribue pas');
  });

  test('un siège tenu ne refuse rien ; une chaise vide ou une liste plus courte ne tient pas le siège ; un siège hors de la capacité ne compte pas', () => {
    const tenu = chargeAssise();
    tenu.reservations = [resa(1, 1, 2, 1), resa(5, 2, 1, 3)];
    assert.equal(refusDuDepart(tenu, { id: 4, toursFiges: [1, 3] }), null);

    const vide = chargeAssise();
    vide.reservations = [resa(4, 1, 2, 2)];
    const refus = refusDuDepart(vide, { id: 4, toursFiges: [2] });
    assert.deepEqual([refus.code, refus.details.siege, refus.details.tour], ['DEPART_SIEGE_NON_TENU', 2, 2]);

    const courte = chargeAssise();
    courte.reservations = [resa(2, 1, 3, 3)];
    assert.equal(refusDuDepart(courte, { id: 4, toursFiges: [3] }).details.siege, 3);

    const horsCapacite = chargeAssise();
    horsCapacite.reservations = [resa(2, 1, 5, 1)];
    assert.equal(refusDuDepart(horsCapacite, { id: 4, toursFiges: [1] }), null);
  });

  test('deux causes à la fois : la première dans l’ordre du contrat', () => {
    const absent = chargeDe();
    assert.equal(refusDuDepart(absent, { id: 12, toursFiges: [1, 2, 3, 4] }).code, 'DEPART_ABSENT');

    const enDerive = chargeDe();
    enDerive.tables[0].sieges = 4;
    assert.equal(refusDuDepart(enDerive, { id: 4, toursFiges: [1, 2, 3, 4] }).code, 'DEPART_NON_COMPARABLE');
    // Une dérive de participants seule laisse passer au refus suivant.
    const exclue = chargeDe();
    exclue.participants[0].exclu = true;
    assert.equal(refusDuDepart(exclue, { id: 4, toursFiges: [1, 2, 3, 4] }).code, 'TOUR_FIGE_HORS_SOIREE');

    const reservee = chargeAssise();
    reservee.reservations = [resa(2, 1, null, 2), resa(1, 1, 1, 1)];
    assert.equal(refusDuDepart(reservee, { id: 4, toursFiges: [1, 2, 5] }).code, 'TOUR_FIGE_HORS_SOIREE');
    assert.equal(refusDuDepart(reservee, { id: 4, toursFiges: [1, 2, 3] }).code, 'TOURS_FIGES_TOUS');
    assert.equal(refusDuDepart(reservee, { id: 4, toursFiges: [1] }).code, 'DEPART_RESERVATION_NON_TENUE');
  });

  test('des tours figés qui ne sont pas une liste d’entiers ≥ 1 strictement croissante : TypeError', () => {
    const charge = chargeDe();
    for (const toursFiges of [null, [0], [1.5], [2, 1], [1, 1], ['1']]) {
      assert.throws(() => refusDuDepart(charge, { id: 4, toursFiges }), TypeError, JSON.stringify(toursFiges));
    }
  });
});

// Iris Ombrelle exclue, Basile Tourteau supprimé, Théo Pervenche absent au
// tour 2, Aurèle Pimprenelle ajoutée aux tours 2 et 3 ; les sièges
// attribués ou non.
function chargeChangee(assise) {
  const charge = assise ? chargeAssise() : chargeDe();
  charge.participants = charge.participants.filter(({ id }) => id !== 4);
  charge.participants[0].exclu = true;
  charge.participants[1].presence = [1, 3];
  charge.participants.push({ ...personne([6, 'Aurèle', 'Pimprenelle']), presence: [2, 3] });
  return charge;
}

describe('départ : le départ ajusté à la présence (§ 5.7)', () => {
  test('departAdapte : la chaise de qui part reste vide sous sièges attribués, sa liste se resserre sinon ; ni exclue ni supprimée ; l’arrivante en réserve à ses tours, absente aux autres ; la charge intacte', () => {
    const assise = gele(chargeChangee(true));
    const adapte = departAdapte(assise, 4);
    assert.deepEqual(adapte.participants, [2, 3, 5, 6]);
    assert.deepEqual(adapte.placement, [
      { sieges: [[2, null, 3], [5]], reserve: [], absents: [6] },
      { sieges: [[], [3, null, 5]], reserve: [6], absents: [2] },
      { sieges: [[null, 2], [5, null, 3]], reserve: [6] },
    ]);
    assert.deepEqual(adapte, ajusterALaPresence(assise.propositions[0], assise).placement);
    const libre = gele(chargeChangee(false));
    assert.deepEqual(departAdapte(libre, 4).placement, [
      { sieges: [[2, 3], [5]], reserve: [], absents: [6] },
      { sieges: [[5], [3]], reserve: [6], absents: [2] },
      { sieges: [[2], [3, 5]], reserve: [6] },
    ]);
    // Sans changement, le départ tel quel.
    assert.deepEqual(departAdapte(chargeDe(), 4), chargeDe().propositions[0]);
    assert.throws(() => departAdapte(chargeDe(), 12), TypeError);
  });

  test('departDuMoteur : le plan du départ ajusté, sans absents, une copie des tours figés et les réserves imposées, sans leur cause', () => {
    const charge = gele(chargeChangee(true));
    const toursFiges = [2];
    const depart = departDuMoteur(charge, { id: 4, toursFiges });
    assert.deepEqual(depart, { plan: planDepuisFichier(departAdapte(charge, 4)), toursFiges: [2], reservesImposees: [] });
    assert.notEqual(depart.toursFiges, toursFiges);
    assert.deepEqual(depart.plan.reserves, [[], [6], [6]]);
    // Sans changement, le plan du départ.
    assert.deepEqual(departDuMoteur(chargeDe(), { id: 4, toursFiges: [1] }), {
      plan: planDuDepart(chargeDe(), 4),
      toursFiges: [1],
      reservesImposees: [],
    });
    // Réservée à une table pleine d'un tour figé : sa réserve imposée.
    const pleine = chargeDe();
    pleine.participants[0].presence = [2, 3];
    pleine.participants.push({ ...personne([6, 'Aurèle', 'Pimprenelle']), presence: [1] });
    pleine.reservations = [resa(6, 1, null, 1), resa(2, 1, null, 1)];
    pleine.participants.push({ ...personne([7, 'Églantine', 'Cormier']), presence: [1] });
    pleine.participants[3].presence = [2, 3];
    pleine.reservations.push(resa(7, 1, null, 1));
    assert.deepEqual(departDuMoteur(pleine, { id: 4, toursFiges: [1] }).reservesImposees, [{ participant: 7, tour: 1 }]);
  });

  test('arrivantesSansChaise : une arrivante réservée à une table que ses occupants, et les arrivantes admises avant elle, remplissent ; une libre jamais ; un tour non figé jamais', () => {
    const charge = chargeDe();
    // Iris Ombrelle et Basile Tourteau absents au tour 1 : la table 7 n'y
    // garde que Maëlle Quenouille.
    charge.participants[0].presence = [2, 3];
    charge.participants[3].presence = [2, 3];
    for (const [id, prenom, nom] of [[6, 'Aurèle', 'Pimprenelle'], [7, 'Églantine', 'Cormier'], [8, 'Faustine', 'Lupin']]) {
      charge.participants.push({ ...personne([id, prenom, nom]), presence: [1] });
    }
    charge.reservations = [resa(8, 2, null, 1), resa(6, 2, null, 1), resa(7, 2, null, 1)];
    const adapte = departAdapte(charge, 4);
    assert.deepEqual(adapte.placement[0], { sieges: [[2, 3], [5]], reserve: [6, 7, 8], absents: [1, 4] });
    assert.deepEqual(arrivantesSansChaise(charge, adapte, [1]), [{ participant: 8, tour: 1, cause: 'table' }]);
    assert.deepEqual(arrivantesSansChaise(charge, adapte, [2]), []);
    assert.deepEqual(arrivantesSansChaise(charge, adapte, []), []);
    // Libre, la même arrivante n'y figure pas.
    charge.reservations = charge.reservations.filter(({ participant }) => participant !== 8);
    assert.deepEqual(arrivantesSansChaise(charge, adapte, [1]), []);
    // La capacité courante compte : une table de quatre places l'admet.
    charge.reservations.push(resa(8, 2, null, 1));
    charge.tables[1].sieges = 4;
    assert.deepEqual(arrivantesSansChaise(charge, adapte, [1]), []);
  });

  test('arrivantesSansChaise sous sièges attribués du départ et de l’événement : un siège tenu pris est la cause ; libre, vide ou au-delà de la liste, il admet ; siegesDesArrivantes rend le siège des admises', () => {
    const charge = chargeAssise();
    charge.participants[0].presence = [2, 3];
    charge.participants[3].presence = [2, 3];
    for (const [id, prenom, nom] of [[6, 'Aurèle', 'Pimprenelle'], [7, 'Églantine', 'Cormier'], [8, 'Faustine', 'Lupin']]) {
      charge.participants.push({ ...personne([id, prenom, nom]), presence: [1] });
    }
    // Au tour 1 : table 3 [Théo, —, Ondine], table 7 [Maëlle].
    charge.reservations = [resa(6, 2, 1, 1), resa(7, 1, 2, 1), resa(8, 2, 3, 1)];
    const adapte = departAdapte(charge, 4);
    assert.deepEqual(adapte.placement[0].sieges, [[2, null, 3], [5]]);
    assert.deepEqual(arrivantesSansChaise(charge, adapte, [1]), [{ participant: 6, tour: 1, cause: 'siege' }]);
    assert.deepEqual(siegesDesArrivantes(charge, adapte, [1]), new Map([[1, new Map([[7, 2], [8, 3]])]]));
    assert.deepEqual(siegesDesArrivantes(charge, adapte, [2]), new Map([[2, new Map()]]));
    // L'événement sans attribution : la table seule compte.
    charge.reglages.attribuerSieges = false;
    assert.deepEqual(arrivantesSansChaise(charge, adapte, [1]), []);
    assert.deepEqual(siegesDesArrivantes(charge, adapte, [1]), new Map([[1, new Map()]]));
  });

  test('ecartsDuDepart : les entrées hors des tours figés, les entrées figées, les réserves imposées et les sorties de chacun, par identifiant ; [] sans écart, sans départ, ou sous une dérive du mobilier', () => {
    for (const assise of [false, true]) {
      assert.deepEqual(ecartsDuDepart(gele(chargeChangee(assise)), { id: 4, toursFiges: [2] }), [
        { participant: 1, personne: 'Iris Ombrelle', entrees: [], entreesFigees: [], enReserveFigee: [], sorties: [1, 2, 3] },
        { participant: 2, personne: 'Théo Pervenche', entrees: [], entreesFigees: [], enReserveFigee: [], sorties: [2] },
        { participant: 4, personne: null, entrees: [], entreesFigees: [], enReserveFigee: [], sorties: [1, 2, 3] },
        { participant: 6, personne: 'Aurèle Pimprenelle', entrees: [3], entreesFigees: [2], enReserveFigee: [], sorties: [] },
      ], `sièges attribués : ${assise}`);
    }
    const pleine = chargeDe();
    pleine.participants[0].presence = [2, 3];
    pleine.participants[3].presence = [2, 3];
    for (const [id, prenom, nom] of [[6, 'Aurèle', 'Pimprenelle'], [7, 'Églantine', 'Cormier'], [8, 'Faustine', 'Lupin']]) {
      pleine.participants.push({ ...personne([id, prenom, nom]), presence: [1] });
    }
    pleine.reservations = [resa(6, 2, null, 1), resa(7, 2, null, 1), resa(8, 2, null, 1)];
    assert.deepEqual(ecartsDuDepart(pleine, { id: 4, toursFiges: [1] }).map(({ participant, entreesFigees, enReserveFigee }) => [participant, entreesFigees, enReserveFigee]), [
      [1, [], []],
      [4, [], []],
      [6, [1], []],
      [7, [1], []],
      [8, [], [{ tour: 1, cause: 'table' }]],
    ]);
    assert.deepEqual(ecartsDuDepart(chargeDe(), { id: 4, toursFiges: [1] }), []);
    // Un tour figé au-delà de la soirée ne compte pas.
    assert.deepEqual(
      ecartsDuDepart(chargeChangee(false), { id: 4, toursFiges: [2, 5] }),
      ecartsDuDepart(chargeChangee(false), { id: 4, toursFiges: [2] }),
    );
    assert.deepEqual(ecartsDuDepart(chargeChangee(false), { id: 12, toursFiges: [] }), []);
    const fautif = chargeChangee(false);
    fautif.propositions[0].placement[0].sieges[0].push(2);
    assert.deepEqual(ecartsDuDepart(fautif, { id: 4, toursFiges: [] }), []);
    const mobilier = chargeChangee(false);
    mobilier.tables[1].sieges = 4;
    assert.deepEqual(ecartsDuDepart(mobilier, { id: 4, toursFiges: [] }), []);
  });

  test('ecartAuRetenu : les tours figés où le retenu, retenu de ce départ, diffère du départ ajusté — occupants par table, réserve, chaises sous sièges attribués des deux côtés ; [] autrement', () => {
    const charge = chargeDe({ propositions: [propositionDe(4, TOURS_RANGES), propositionDe(5, TOURS_RANGES)] });
    assert.deepEqual(ecartAuRetenu(charge, { id: 4, toursFiges: [1] }), [], 'sans retenu');
    // Ondine Lacasse et Basile Tourteau échangés à la main au tour 1.
    charge.retenu = retenuDe(propositionDe(4, [[[1, 2, 4], [3, 5]], TOURS_RANGES[1], TOURS_RANGES[2]]));
    assert.deepEqual(ecartAuRetenu(charge, { id: 4, toursFiges: [1, 2] }), [1]);
    assert.deepEqual(ecartAuRetenu(charge, { id: 4, toursFiges: [2, 3] }), []);
    assert.deepEqual(ecartAuRetenu(charge, { id: 5, toursFiges: [1, 2] }), [], 'une autre proposition');
    const efface = { ...charge, propositions: [charge.propositions[1]] };
    assert.deepEqual(ecartAuRetenu(efface, { id: 4, toursFiges: [1] }), [], 'le départ effacé');
    const fautif = structuredClone(charge);
    fautif.retenu.placement[0].sieges[1].push(1);
    assert.deepEqual(ecartAuRetenu(fautif, { id: 4, toursFiges: [1] }), [], 'retenu fautif');

    // Le retenu seulement ajusté à la présence : aucun écart.
    const ajuste = chargeChangee(false);
    ajuste.retenu = ajusterALaPresence(retenuDe(ajuste.propositions[0]), ajuste).placement;
    assert.deepEqual(ecartAuRetenu(ajuste, { id: 4, toursFiges: [1, 2, 3] }), []);
    // L'arrivante assise à la main au tour 2 : la table et la réserve diffèrent.
    ajuste.retenu.placement[1] = { sieges: [[5, 6], [3]], reserve: [], absents: [2] };
    assert.deepEqual(ecartAuRetenu(ajuste, { id: 4, toursFiges: [1, 2, 3] }), [2]);
    // La réserve seule diffère : Aurèle Pimprenelle dite absente au tour 3.
    ajuste.retenu.placement[2] = { sieges: [[2], [3, 5]], reserve: [], absents: [6] };
    assert.deepEqual(ecartAuRetenu(ajuste, { id: 4, toursFiges: [3] }), [3]);

    // Deux chaises échangées dans une table : un écart sous sièges attribués
    // des deux côtés seulement.
    const assise = chargeAssise();
    assise.retenu = retenuDe(propositionDe(4, [[[1, 2, 3], [5, 4]], TOURS_ASSIS[1], TOURS_ASSIS[2]], { siegesAttribues: true }));
    assert.deepEqual(ecartAuRetenu(assise, { id: 4, toursFiges: [1] }), [1]);
    assise.retenu.siegesAttribues = false;
    assert.deepEqual(ecartAuRetenu(assise, { id: 4, toursFiges: [1] }), []);

    // Un tour figé au-delà du retenu ou du départ ne compte pas ; un départ
    // fautif ne se compare pas.
    const court = chargeDe();
    court.retenu = retenuDe(propositionDe(4, TOURS_RANGES.slice(0, 2)));
    assert.deepEqual(ecartAuRetenu(court, { id: 4, toursFiges: [3] }), [], 'au-delà du retenu');
    court.retenu = retenuDe(propositionDe(4, [[[1, 2, 4], [3, 5]], TOURS_RANGES[1], TOURS_RANGES[2]]));
    assert.deepEqual(ecartAuRetenu(court, { id: 4, toursFiges: [1, 4] }), [1], 'au-delà du départ');
    const departFautif = structuredClone(court);
    departFautif.propositions[0].placement[0].sieges[1].push(1);
    assert.deepEqual(ecartAuRetenu(departFautif, { id: 4, toursFiges: [1] }), [], 'départ fautif');
  });

  test('ecartAuRetenu : une personne qui quitte un tour figé puis y revient attend en réserve au retenu, le départ ajusté l’assied encore à sa chaise — un écart, comme sa chaise prise à la main', () => {
    for (const assise of [false, true]) {
      const charge = assise ? chargeAssise() : chargeDe();
      charge.retenu = retenuDe(charge.propositions[0]);
      // Ondine Lacasse quitte le tour 1, puis y revient : le retenu s'ajuste
      // à chaque geste, le départ à la présence du moment.
      charge.participants[2].presence = [2, 3];
      charge.retenu = ajusterALaPresence(charge.retenu, charge, [3]).placement;
      delete charge.participants[2].presence;
      charge.retenu = ajusterALaPresence(charge.retenu, charge, [3]).placement;
      assert.deepEqual(charge.retenu.placement[0].reserve, [3], `sièges attribués : ${assise}`);
      assert.deepEqual(ecartAuRetenu(gele(structuredClone(charge)), { id: 4, toursFiges: [1, 2] }), [1], `sièges attribués : ${assise}`);
      // Basile Tourteau mis à la main dans sa chaise restée libre, la
      // troisième de la table 3 : la table 7 du retenu n'est plus celle du
      // départ.
      const prise = structuredClone(charge);
      const [liste3, liste7] = prise.retenu.placement[0].sieges;
      liste3[2] = 4;
      liste7.splice(liste7.indexOf(4), 1);
      assert.deepEqual(ecartAuRetenu(prise, { id: 4, toursFiges: [1, 2] }), [1], `sièges attribués : ${assise}`);
    }
    // Retirée du tour à la main, sa chaise laissée libre : un écart.
    for (const assise of [false, true]) {
      const charge = assise ? chargeAssise() : chargeDe();
      charge.retenu = structuredClone(retenuDe(charge.propositions[0]));
      const tour = charge.retenu.placement[0];
      for (const liste of tour.sieges) {
        const rang = liste.indexOf(3);
        if (rang < 0) continue;
        if (assise) liste[rang] = null;
        else liste.splice(rang, 1);
        while (liste.at(-1) === null) liste.pop();
      }
      tour.reserve = [3];
      assert.deepEqual(ecartAuRetenu(charge, { id: 4, toursFiges: [1] }), [1], `sièges attribués : ${assise}`);
    }
    // En réserve au retenu sans que le départ ajusté l'asseye — Aurèle
    // Pimprenelle, absente au tour 1 : ce n'est pas une revenue, la réserve
    // diffère.
    const ajuste = chargeChangee(false);
    ajuste.retenu = ajusterALaPresence(retenuDe(ajuste.propositions[0]), ajuste).placement;
    ajuste.retenu.placement[0] = { sieges: [[2, 3], [5]], reserve: [6] };
    assert.deepEqual(ecartAuRetenu(ajuste, { id: 4, toursFiges: [1] }), [1]);
  });
});

describe('départ : la recopie des tours figés (D72)', () => {
  test('recopierPlacement : chaque table d’un tour figé recopiée du départ, ordre et chaise vide compris ; les autres tours tels quels', () => {
    const placement = gele(propositionDe(6, TOURS_RANGES, { siegesAttribues: true }).placement);
    const duDepart = gele(propositionDe(4, TOURS_ASSIS, { siegesAttribues: true }).placement);
    const recopie = recopierPlacement(placement, duDepart, [2]);
    assert.deepEqual(recopie, [
      { sieges: [[1, 2, 3], [4, 5]], reserve: [] },
      { sieges: [[1, null, 4], [3, 2, 5]], reserve: [] },
      { sieges: [[2, 4], [1, 3, 5]], reserve: [] },
    ]);
    recopie[1].sieges[0].push(9);
    recopie[0].sieges[0].push(9);
    assert.deepEqual(duDepart[1].sieges[0], [1, null, 4], 'aucune liste partagée avec le départ');
    assert.deepEqual(placement[0].sieges[0], [1, 2, 3], 'aucune liste partagée avec le placement');
  });

  test('recopierPlacement sur le placement nu d’un point de relevé', () => {
    const releve = [
      { sieges: [[3, 4, 5], [1, 2]], reserve: [] },
      { sieges: [[1, 2, 3], [4, 5]], reserve: [] },
      { sieges: [[1, 2], [3, 4, 5]], reserve: [] },
    ];
    const duDepart = propositionDe(4, TOURS_ASSIS, { siegesAttribues: true }).placement;
    assert.deepEqual(recopierPlacement(releve, duDepart, [1, 3]), [
      { sieges: [[2, 1, 3], [5, 4]], reserve: [] },
      releve[1],
      { sieges: [[4, 2], [5, 1, 3]], reserve: [] },
    ]);
  });

  test('recopierToursFiges : sous sièges attribués des deux côtés, le placement recopié, le reste du fichier tel quel', () => {
    const fichier = gele(propositionDe(6, TOURS_RANGES, { siegesAttribues: true }));
    const duDepart = gele(propositionDe(4, TOURS_ASSIS, { siegesAttribues: true }));
    const recopie = recopierToursFiges(fichier, duDepart, [1]);
    assert.notEqual(recopie, fichier);
    assert.deepEqual(recopie, { ...fichier, placement: recopierPlacement(fichier.placement, duDepart.placement, [1]) });
    assert.deepEqual(recopie.placement[0].sieges, [[2, 1, 3], [5, 4]]);
  });

  test('recopierToursFiges : chaque table reçoit sa liste du départ, quel que soit l’ordre où le départ déclare ses tables', () => {
    const duDepart = gele(tablesInversees(propositionDe(4, TOURS_ASSIS, { siegesAttribues: true })));
    const fichier = gele(propositionDe(6, TOURS_RANGES, { siegesAttribues: true }));
    const recopie = recopierToursFiges(fichier, duDepart, [1, 2]);
    assert.deepEqual(recopie.tables, [1, 2]);
    assert.deepEqual(
      recopie.placement.map(({ sieges }) => sieges),
      [TOURS_ASSIS[0], TOURS_ASSIS[1], TOURS_RANGES[2]],
    );
    assert.equal(tourFigeDifferent(recopie, duDepart, [1, 2]), null);
  });

  test('recopierToursFiges : une table que le départ ne déclare pas garde sa liste, et le contrôle la voit', () => {
    const duDepart = gele({ ...propositionDe(4, TOURS_ASSIS, { siegesAttribues: true }), tables: [1, 8] });
    const fichier = gele(propositionDe(6, TOURS_RANGES, { siegesAttribues: true }));
    const recopie = recopierToursFiges(fichier, duDepart, [1]);
    assert.deepEqual(recopie.placement[0].sieges, [[2, 1, 3], [4, 5]]);
    assert.equal(tourFigeDifferent(recopie, duDepart, [1]), 1);
  });

  test('la réserve d’un tour figé est celle du départ, par recopierPlacement ; recopierToursFiges en retire l’arrivante que la dérivée assied', () => {
    // Au tour 1, figé, le fichier laisse la personne 5 en réserve et le départ
    // la personne 4 ; au tour 2, non figé, le fichier garde la sienne.
    const avecReserves = (id, tours) => ({
      ...propositionDe(id, TOURS_RANGES, { siegesAttribues: true }),
      placement: tours.map(([sieges, reserve]) => ({ sieges: sieges.map((liste) => [...liste]), reserve })),
    });
    const fichier = gele(
      avecReserves(6, [
        [[[1, 2, 3], [4]], [5]],
        [[[1, 4], [2, 3]], [5]],
        [TOURS_RANGES[2], []],
      ]),
    );
    const duDepart = gele(
      avecReserves(4, [
        [[[2, 1, 3], [5]], [4]],
        [[[1, null, 5], [3, 2]], [4]],
        [TOURS_ASSIS[2], []],
      ]),
    );
    const attendues = [[4], [5], []];
    const recopie = recopierPlacement(fichier.placement, duDepart.placement, [1]);
    assert.deepEqual(recopie.map(({ reserve }) => reserve), attendues);
    // Une réserve partagée avec le départ, gelé, lèverait ici.
    recopie[0].reserve.push(9);
    // Au tour 1, la dérivée assied la personne 4, en réserve au départ : une
    // arrivante, qui rejoint sa table en fin de liste et quitte la réserve.
    const derivee = recopierToursFiges(fichier, duDepart, [1]);
    assert.deepEqual(derivee.placement.map(({ reserve }) => reserve), [[], [5], []]);
    assert.deepEqual(derivee.placement[0].sieges, [[2, 1, 3], [5, 4]]);
  });

  test('recopierToursFiges : une arrivante d’un tour figé va au siège que sa réservation tient, d’abord ; les autres, par identifiant, à la première chaise vide, sinon en fin de liste ; la réserve imposée reste ; les absents du fichier restent', () => {
    // Au départ ajusté du tour 1 : Iris Ombrelle, Théo Pervenche et Basile
    // Tourteau absents ; quatre arrivantes en réserve. La dérivée en assied
    // trois et laisse la quatrième, 8, en réserve imposée.
    const avecTour1 = (id, tour1) => ({
      ...propositionDe(id, TOURS_ASSIS, { siegesAttribues: true }),
      placement: [tour1, ...propositionDe(id, TOURS_ASSIS, { siegesAttribues: true }).placement.slice(1)],
    });
    const duDepart = gele(avecTour1(4, { sieges: [[null, null, 3], [5]], reserve: [6, 7, 8, 9], absents: [1, 2, 4] }));
    const fichier = gele(avecTour1(10, { sieges: [[3, 6, 7], [5, 9]], reserve: [8], absents: [1, 2, 4] }));
    const sieges = new Map([[1, new Map([[7, 1], [9, 3]])]]);
    const recopie = recopierToursFiges(fichier, duDepart, [1, 2], sieges);
    assert.deepEqual(recopie.placement[0], { sieges: [[7, 6, 3], [5, null, 9]], reserve: [8], absents: [1, 2, 4] });
    assert.deepEqual(recopie.placement[1], duDepart.placement[1]);
    assert.equal(tourFigeDifferent(recopie, duDepart, [1, 2]), null);
    // Sans siège tenu : par identifiant, à la première chaise vide.
    assert.deepEqual(recopierToursFiges(fichier, duDepart, [1]).placement[0].sieges, [[6, 7, 3], [5, 9]]);
    // Un siège tenu déjà pris ne déloge personne : l'arrivante va à la
    // première chaise vide.
    const pris = recopierToursFiges(fichier, duDepart, [1], new Map([[1, new Map([[7, 3]])]]));
    assert.deepEqual(pris.placement[0].sieges, [[6, 7, 3], [5, 9]]);
  });

  test('recopierToursFiges rend le fichier tel quel quand l’un des deux n’attribue pas les sièges', () => {
    const assis = propositionDe(4, TOURS_ASSIS, { siegesAttribues: true });
    const range = propositionDe(6, TOURS_RANGES);
    assert.equal(recopierToursFiges(range, assis, [1]), range);
    const fichier = propositionDe(6, TOURS_RANGES, { siegesAttribues: true });
    assert.equal(recopierToursFiges(fichier, propositionDe(4, TOURS_RANGES), [1]), fichier);
  });
});

describe('départ : le contrôle des tours figés (D72, § 14.12)', () => {
  const duDepart = propositionDe(4, TOURS_ASSIS, { siegesAttribues: true });
  const recopie = () => recopierToursFiges(propositionDe(6, TOURS_RANGES, { siegesAttribues: true }), duDepart, [1, 2]);

  test('après la recopie, aucun tour figé ne diffère', () => {
    assert.equal(tourFigeDifferent(recopie(), duDepart, [1, 2]), null);
  });

  test('deux tables échangées dans un tour figé : les mêmes occupants au tour, pas à chaque table', () => {
    const fichier = recopie();
    fichier.placement[0].sieges = [[5, 4, null], [2, 1, 3]];
    fichier.placement[0].sieges[0].pop();
    assert.equal(tourFigeDifferent(fichier, duDepart, [1, 2]), 1);
  });

  test('une personne déplacée d’une table à l’autre : le premier tour figé qui diffère', () => {
    const fichier = recopie();
    fichier.placement[1].sieges = [[1, null, 4, 3], [2, 5]];
    assert.equal(tourFigeDifferent(fichier, duDepart, [1, 2]), 2);
  });

  test('l’ordre changé après la recopie diffère ; sans recopie, seuls les occupants comptent', () => {
    const fichier = recopie();
    fichier.placement[0].sieges[0] = [1, 2, 3];
    assert.equal(tourFigeDifferent(fichier, duDepart, [1]), 1);
    const range = propositionDe(6, TOURS_RANGES);
    assert.equal(tourFigeDifferent(range, duDepart, [1, 3]), null, 'le fichier n’attribue pas : listes rangées');
    assert.equal(tourFigeDifferent(fichier, propositionDe(4, TOURS_RANGES), [1, 3]), null, 'le départ n’attribue pas');
  });

  test('un tour non figé qui diffère ne compte pas', () => {
    const fichier = recopie();
    assert.equal(tourFigeDifferent(fichier, duDepart, [1, 2]), null);
    assert.notDeepEqual(fichier.placement[2].sieges, duDepart.placement[2].sieges);
  });

  test('un point de relevé se recopie depuis le fichier recopié, puis se contrôle sous la forme d’un fichier', () => {
    const fichier = recopie();
    const releve = recopierPlacement(propositionDe(6, TOURS_RANGES).placement, fichier.placement, [1, 2]);
    assert.equal(tourFigeDifferent({ ...fichier, placement: releve }, duDepart, [1]), null);
    assert.equal(tourFigeDifferent({ ...fichier, placement: releve }, duDepart, [1, 2]), null);
    const ecarte = recopierPlacement(releve, fichier.placement, []);
    ecarte[1].sieges = [[1, 4], [2, 3, 5]];
    assert.equal(tourFigeDifferent({ ...fichier, placement: ecarte }, duDepart, [1, 2]), 2);
  });

  test('un point de relevé sous un départ aux tables dans un autre ordre, recopié depuis le fichier recopié, ne diffère pas', () => {
    const inverse = tablesInversees(duDepart);
    const fichier = recopierToursFiges(propositionDe(6, TOURS_RANGES, { siegesAttribues: true }), inverse, [1]);
    const releve = recopierPlacement(propositionDe(6, TOURS_RANGES).placement, fichier.placement, [1]);
    assert.deepEqual(releve[0].sieges, TOURS_ASSIS[0]);
    assert.equal(tourFigeDifferent({ ...fichier, placement: releve }, inverse, [1]), null);
  });

  test('une table du départ absente du fichier diffère', () => {
    const fichier = { ...recopie(), tables: [1] };
    assert.equal(tourFigeDifferent(fichier, duDepart, [2]), 2);
  });

  test('les arrivantes du tour figé — en réserve au départ — ne comptent pas, assises ou en réserve dans la dérivée ; toute autre personne qui bouge compte, avec ou sans sièges attribués', () => {
    const avecArrivantes = (id, tour1, siegesAttribues) => {
      const proposition = propositionDe(id, TOURS_ASSIS, { siegesAttribues });
      return { ...proposition, placement: [tour1, ...proposition.placement.slice(1)] };
    };
    const depart = (siegesAttribues) =>
      avecArrivantes(4, { sieges: [[null, null, 3], [5]], reserve: [6, 7], absents: [1, 2, 4] }, siegesAttribues);
    for (const siegesAttribues of [true, false]) {
      const ici = `sièges attribués : ${siegesAttribues}`;
      const assises = avecArrivantes(9, { sieges: [[6, null, 3], [5, 7]], reserve: [], absents: [1, 2, 4] }, siegesAttribues);
      assert.equal(tourFigeDifferent(assises, depart(siegesAttribues), [1]), null, ici);
      const enReserve = avecArrivantes(9, { sieges: [[null, 6, 3], [5]], reserve: [7], absents: [1, 2, 4] }, siegesAttribues);
      assert.equal(tourFigeDifferent(enReserve, depart(siegesAttribues), [1]), null, ici);
      const deplacee = avecArrivantes(9, { sieges: [[6, 5, 3], [7]], reserve: [], absents: [1, 2, 4] }, siegesAttribues);
      assert.equal(tourFigeDifferent(deplacee, depart(siegesAttribues), [1]), 1, ici);
    }
  });
});
