// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves des animateurs d'une table et des statuts pour en désigner
// (§ 2.1 étape 6, § 4.1) : qui anime se calcule des réservations « tous les
// tours » qui pourvoient un titre, et chaque personne reçoit un statut, qui
// dit si elle se choisit. Les noms d'épreuve sont inventés ; la version vient
// du module engendré.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { creerCharge } from '../stockage/document.js';
import { fautes } from '../stockage/placements.js';
import { VERSION } from '../version.genere.js';
import { animateursDeLaTable, avertissementsDuLot, designations, statutsPourAnimation } from './animateurs.js';

const NOMS = [
  ['Ombrelle', 'Iris'],
  ['Pervenche', 'Théo'],
  ['Lacasse', 'Ondine'],
  ['Grisaille', null],
  ['Bruyère', 'Anouk'],
  ['Sarcelle', 'Capucine'],
  ['Ancolie', 'Amandine'],
  ['Mélèze', 'Basile'],
];

const personne = (id, autres = {}) => ({
  id,
  nom: NOMS[id - 1][0],
  prenom: NOMS[id - 1][1],
  organisation: null,
  courriel: null,
  titrePressenti: null,
  notes: null,
  exclu: false,
  ...autres,
});

const resa = (participant, idTable, siege, tour = null) => ({
  participant,
  table: idTable,
  siege,
  portee: tour === null ? 'tous' : 'tour',
  tour,
});

// Huit personnes, trois tours, les tables numérotées 5 et 3 d'identifiants
// 2 et 4, de quatre places, sans retenu. Iris anime la table 5 au siège 2 ;
// Théo anime la table 3 au siège 1 ; Ondine est réservée à la table 5 au
// tour 2, sans titre ; Grisaille est réservée à la table 3 pour la soirée,
// sans titre ; Anouk est exclue ; Capucine est absente au tour 3, réservée
// « tous les tours » à un siège titré de la table 5 ; Amandine et Basile
// sont libres, Basile avec un titre pressenti.
function chargeAnimee() {
  const charge = creerCharge({ id: 'evt-animation', nom: 'Soirée des Grèbes', siegesParDefaut: 4, tours: 3 });
  charge.participants = [
    personne(1),
    personne(2),
    personne(3),
    personne(4),
    personne(5, { exclu: true }),
    personne(6, { presence: [1, 2] }),
    personne(7),
    personne(8, { titrePressenti: 'hôte' }),
  ];
  charge.tables = [
    { id: 2, numero: 5, sieges: null, forme: 'ronde', position: { x: 0, y: 0 } },
    { id: 4, numero: 3, sieges: null, forme: 'ronde', position: { x: 400, y: 0 } },
  ];
  charge.reservations = [resa(1, 2, 2), resa(2, 4, 1), resa(3, 2, null, 2), resa(4, 4, null), resa(6, 2, 4)];
  charge.titres = [
    { table: 2, siege: 2, libelle: 'animatrice' },
    { table: 4, siege: 1, libelle: 'animation' },
    { table: 2, siege: 4, libelle: 'veille' },
  ];
  charge.prochainsIds = { participant: 9, table: 5, proposition: 1 };
  return charge;
}

// La même charge, la proposition 1 retenue : Amandine à la table 5 aux tours
// 1 et 2, à la table 3 au tour 3 ; Basile en réserve partout.
function chargeRetenue() {
  const charge = chargeAnimee();
  const participants = [1, 2, 3, 4, 6, 7, 8];
  const plan = {
    siegesAttribues: false,
    tables: [2, 4],
    capacites: [4, 4],
    tours: 3,
    participants,
    placement: [
      { sieges: [[1, 3, 6, 7], [2, 4]], reserve: [8] },
      { sieges: [[1, 3, 6, 7], [2, 4]], reserve: [8] },
      { sieges: [[1, 3], [2, 4, 7]], reserve: [8], absents: [6] },
    ],
  };
  charge.propositions = [{ id: 1, graine: 7, arret: 200, historique: 10, produitVersion: VERSION.affichee, ...plan }];
  charge.retenu = { proposition: 1, ...structuredClone(plan) };
  charge.evenement.etat = 'retenu';
  charge.prochainsIds.proposition = 2;
  return charge;
}

const statutDe = (statuts, id) => statuts.find(({ participant }) => participant === id);

describe('animateurs : qui anime une table se calcule (§ 2.1 étape 6, § 4.1)', () => {
  test('designations : chaque titre que pourvoit pour la soirée une réservation « tous les tours », dans l’ordre des titres', () => {
    const charge = chargeAnimee();
    assert.deepEqual(designations(charge), [
      { rang: 0, titre: charge.titres[0], reservation: resa(1, 2, 2) },
      { rang: 1, titre: charge.titres[1], reservation: resa(2, 4, 1) },
    ]);
  });

  test('animateursDeLaTable : la personne et le titre qu’elle pourvoit, par siège ; ni réservation sans titre, ni absente à un tour, ni exclue', () => {
    const charge = chargeAnimee();
    assert.deepEqual(animateursDeLaTable(charge, 2), [{ participant: 1, siege: 2, libelle: 'animatrice' }]);
    assert.deepEqual(animateursDeLaTable(charge, 4), [{ participant: 2, siege: 1, libelle: 'animation' }]);
    // Une seconde animatrice au siège 1 passe devant Iris ; l'exclue ne
    // pourvoit rien.
    const deux = chargeAnimee();
    deux.reservations.push(resa(7, 2, 1), resa(5, 2, 3));
    deux.titres.push({ table: 2, siege: 1, libelle: 'accueil' }, { table: 2, siege: 3, libelle: 'relève' });
    assert.deepEqual(animateursDeLaTable(deux, 2), [
      { participant: 7, siege: 1, libelle: 'accueil' },
      { participant: 1, siege: 2, libelle: 'animatrice' },
    ]);
    assert.throws(() => animateursDeLaTable(charge, 9), TypeError);
  });

  test('la charge reçue reste intacte', () => {
    const charge = chargeRetenue();
    const texte = JSON.stringify(charge);
    animateursDeLaTable(charge, 2);
    statutsPourAnimation(charge, 2);
    designations(charge);
    assert.equal(JSON.stringify(charge), texte);
  });
});

describe('animateurs : le statut de chaque personne pour animer une table (§ 2.1 étape 6)', () => {
  test('sans retenu : un statut par personne, dans l’ordre des participants, et qui se choisit', () => {
    const statuts = statutsPourAnimation(chargeAnimee(), 2);
    assert.deepEqual(
      statuts.map(({ participant }) => participant),
      [1, 2, 3, 4, 5, 6, 7, 8],
    );
    assert.deepEqual(statutDe(statuts, 1), {
      participant: 1,
      statut: 'animeCetteTable',
      choisissable: false,
      siege: 2,
      libelle: 'animatrice',
      titrePressenti: null,
    });
    assert.deepEqual(statutDe(statuts, 2), {
      participant: 2,
      statut: 'animeAutreTable',
      choisissable: false,
      table: 4,
      numero: 3,
      titrePressenti: null,
    });
    assert.deepEqual(statutDe(statuts, 3), {
      participant: 3,
      statut: 'reservee',
      choisissable: false,
      reservations: [{ table: 2, numero: 5, siege: null, portee: 'tour', tour: 2 }],
      titrePressenti: null,
    });
    assert.deepEqual(statutDe(statuts, 4), {
      participant: 4,
      statut: 'reservee',
      choisissable: false,
      reservations: [{ table: 4, numero: 3, siege: null, portee: 'tous', tour: null }],
      titrePressenti: null,
    });
    assert.deepEqual(statutDe(statuts, 5), { participant: 5, statut: 'exclue', choisissable: false, titrePressenti: null });
    // Absente au tour 3, sa réservation ne pourvoit pas le titre pour la
    // soirée : elle n'anime pas, et l'absence se dit avant la réservation.
    assert.deepEqual(statutDe(statuts, 6), {
      participant: 6,
      statut: 'absente',
      choisissable: false,
      tours: [3],
      titrePressenti: null,
    });
    assert.deepEqual(statutDe(statuts, 7), { participant: 7, statut: 'libre', choisissable: true, titrePressenti: null });
    assert.deepEqual(statutDe(statuts, 8), { participant: 8, statut: 'libre', choisissable: true, titrePressenti: 'hôte' });
  });

  test('vu de l’autre table, Iris anime la table 5 et Théo anime cette table', () => {
    const statuts = statutsPourAnimation(chargeAnimee(), 4);
    assert.equal(statutDe(statuts, 1).statut, 'animeAutreTable');
    assert.equal(statutDe(statuts, 1).numero, 5);
    assert.equal(statutDe(statuts, 2).statut, 'animeCetteTable');
  });

  test('une exclue réservée reste « exclue », et ses réservations ne la font pas animer', () => {
    const charge = chargeAnimee();
    charge.reservations.push(resa(5, 2, 3));
    charge.titres.push({ table: 2, siege: 3, libelle: 'relève' });
    assert.deepEqual(statutDe(statutsPourAnimation(charge, 2), 5), {
      participant: 5,
      statut: 'exclue',
      choisissable: false,
      titrePressenti: null,
    });
  });

  test('avec un retenu : la personne qu’il place sans réservation se choisit, ses tables et leurs tours dits', () => {
    const statuts = statutsPourAnimation(chargeRetenue(), 2);
    assert.deepEqual(statutDe(statuts, 7), {
      participant: 7,
      statut: 'placeeAuRetenu',
      choisissable: true,
      placements: [
        { table: 2, numero: 5, tours: [1, 2] },
        { table: 4, numero: 3, tours: [3] },
      ],
      titrePressenti: null,
    });
    // En réserve à chaque tour, Basile est libre ; la réservation prime sur
    // la place au retenu.
    assert.equal(statutDe(statuts, 8).statut, 'libre');
    assert.equal(statutDe(statuts, 3).statut, 'reservee');
    assert.equal(statutDe(statuts, 1).statut, 'animeCetteTable');
  });

  test('une absente à un tour au moins ne se choisit pas : ses tours d’absence, avant la réservation, la place au retenu et « libre »', () => {
    const charge = chargeAnimee();
    charge.participants[2].presence = [2];
    charge.participants[7].presence = [1, 3];
    const statuts = statutsPourAnimation(charge, 2);
    // Ondine, réservée au tour 2 : absente aux tours 1 et 3.
    assert.deepEqual(statutDe(statuts, 3), { participant: 3, statut: 'absente', choisissable: false, tours: [1, 3], titrePressenti: null });
    // Basile, sans réservation : absente au tour 2, son titre pressenti gardé.
    assert.deepEqual(statutDe(statuts, 8), { participant: 8, statut: 'absente', choisissable: false, tours: [2], titrePressenti: 'hôte' });
    // Une exclue absente reste « exclue ».
    charge.participants[4].presence = [1];
    assert.equal(statutDe(statutsPourAnimation(charge, 2), 5).statut, 'exclue');
    // Au retenu, Amandine absente au tour 3 et assise aux tours 1 et 2 :
    // « absente », non « placeeAuRetenu ».
    const retenue = chargeRetenue();
    retenue.participants[6].presence = [1, 2];
    for (const plan of [retenue.retenu, retenue.propositions[0]]) {
      plan.placement[2] = { sieges: [[1, 3], [2, 4]], reserve: [8], absents: [6, 7] };
    }
    assert.deepEqual(fautes(retenue.retenu), []);
    assert.deepEqual(statutDe(statutsPourAnimation(retenue, 2), 7), {
      participant: 7,
      statut: 'absente',
      choisissable: false,
      tours: [3],
      titrePressenti: null,
    });
  });

  test('plusieurs réservations à la main : dans l’ordre canonique, la table par identifiant, « tous » avant « tour », puis le tour', () => {
    const charge = chargeAnimee();
    charge.reservations = charge.reservations.filter(({ participant }) => participant !== 4);
    charge.reservations.push(resa(4, 4, null, 3), resa(4, 2, null, 2), resa(4, 4, null, 1), resa(4, 4, 3));
    assert.deepEqual(statutDe(statutsPourAnimation(charge, 2), 4).reservations, [
      { table: 2, numero: 5, siege: null, portee: 'tour', tour: 2 },
      { table: 4, numero: 3, siege: 3, portee: 'tous', tour: null },
      { table: 4, numero: 3, siege: null, portee: 'tour', tour: 1 },
      { table: 4, numero: 3, siege: null, portee: 'tour', tour: 3 },
    ]);
  });

  test('deux titres au même siège : le premier par libellé, comparé unité UTF-16 par unité, nomme l’animatrice', () => {
    const charge = chargeAnimee();
    charge.titres.push({ table: 2, siege: 2, libelle: 'Accueil' });
    assert.deepEqual(animateursDeLaTable(charge, 2), [{ participant: 1, siege: 2, libelle: 'Accueil' }]);
    const statut = statutDe(statutsPourAnimation(charge, 2), 1);
    assert.equal(statut.libelle, 'Accueil');
    assert.equal(statut.siege, 2);
  });

  test('une table du retenu que la charge n’a plus ne se nomme pas ; un retenu fautif ne dit aucune place', () => {
    const charge = chargeRetenue();
    charge.tables = charge.tables.filter(({ id }) => id !== 4);
    charge.reservations = charge.reservations.filter(({ table }) => table !== 4);
    charge.titres = charge.titres.filter(({ table }) => table !== 4);
    assert.deepEqual(statutDe(statutsPourAnimation(charge, 2), 7).placements, [{ table: 2, numero: 5, tours: [1, 2] }]);
    const fautive = chargeRetenue();
    fautive.retenu.placement[0].sieges[0].push(7);
    assert.equal(statutDe(statutsPourAnimation(fautive, 2), 7).statut, 'libre');
  });
});

describe('animateurs : les avertissements d’un lot de désignations (§ 5.9)', () => {
  test('cumulés dans l’ordre des désignations, une paire (code, détails) une seule fois, à son premier rang', () => {
    const gelee = (table) => ({ code: 'TABLE_GELEE', details: { table } });
    const autre = { code: 'AUTRE_SIGNAL', details: { table: 2, tour: 1 } };
    assert.deepEqual(avertissementsDuLot([]), []);
    assert.deepEqual(avertissementsDuLot([[], [gelee(2)], [gelee(2)]]), [gelee(2)]);
    // La première désignation porte ce que la dernière ne porte pas.
    assert.deepEqual(avertissementsDuLot([[autre, gelee(2)], [gelee(4)], [gelee(2)]]), [autre, gelee(2), gelee(4)]);
    // Le même code sous d'autres détails reste.
    assert.deepEqual(avertissementsDuLot([[gelee(2), gelee(4)], [gelee(4), gelee(2)]]), [gelee(2), gelee(4)]);
  });
});
