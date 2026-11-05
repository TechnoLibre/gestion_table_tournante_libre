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
import {
  aDesigner,
  animateursDeLaTable,
  avertissementsDuLot,
  designations,
  repartitionALaCreation,
  statutsPourAnimation,
  tablesAnimees,
} from './animateurs.js';
import { appliquerCommande } from './commandes.js';

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
  test('designations : chaque titre que pourvoit pour la soirée une réservation « tous les tours », ou que pourvoit la désignation suspendue d’une absente, dans l’ordre des titres', () => {
    const charge = chargeAnimee();
    // Capucine, absente au tour 3 : sa réservation « tous les tours » au
    // siège 4 de la table 5, suspendue à ce tour, tient sa désignation.
    assert.deepEqual(designations(charge), [
      { rang: 0, titre: charge.titres[0], reservation: resa(1, 2, 2) },
      { rang: 1, titre: charge.titres[1], reservation: resa(2, 4, 1) },
      { rang: 2, titre: charge.titres[2], reservation: resa(6, 2, 4) },
    ]);
    // Présente à chaque tour, elle anime pour la soirée : la même entrée.
    charge.participants[5] = personne(6);
    assert.deepEqual(designations(charge)[2], { rang: 2, titre: charge.titres[2], reservation: resa(6, 2, 4) });
    // Exclue, rien ne la désigne : l'exclusion suspend toute réservation.
    charge.participants[5] = personne(6, { exclu: true, presence: [1, 2] });
    assert.deepEqual(designations(charge).map(({ rang }) => rang), [0, 1]);
  });

  test('designations : la désignation d’une absente ne prend jamais le titre qu’une présente pourvoit pour la soirée', () => {
    // En mode table, deux réservations « tous » sans siège à la table 3, un
    // seul titre : Théo, présent, le pourvoit ; Capucine, absente au tour 3
    // et d'identifiant plus grand, ne le prend pas, et n'anime pas.
    const charge = chargeAnimee();
    charge.reglages.attribuerSieges = false;
    charge.reservations = [resa(2, 4, null), resa(6, 4, null)];
    charge.titres = [{ table: 4, siege: 1, libelle: 'animation' }];
    assert.deepEqual(designations(charge), [{ rang: 0, titre: charge.titres[0], reservation: resa(2, 4, null) }]);
    // Deux titres, Théo absent au tour 1, Capucine présente : elle pourvoit
    // pour la soirée le premier titre, qu'elle garde ; la désignation
    // suspendue de Théo se répartit sur le seul titre resté sans
    // pourvoyeur, le second, qu'il reçoit.
    const deux = chargeAnimee();
    deux.reglages.attribuerSieges = false;
    deux.participants[1] = personne(2, { presence: [2, 3] });
    deux.participants[5] = personne(6);
    deux.reservations = [resa(2, 4, null), resa(6, 4, null)];
    deux.titres = [
      { table: 4, siege: 1, libelle: 'animation' },
      { table: 4, siege: 2, libelle: 'relève' },
    ];
    assert.deepEqual(designations(deux), [
      { rang: 0, titre: deux.titres[0], reservation: resa(6, 4, null) },
      { rang: 1, titre: deux.titres[1], reservation: resa(2, 4, null) },
    ]);
    // Les mêmes deux titres, Théo présent, Capucine absente au tour 3 et
    // d'identifiant plus grand : Théo garde le premier titre, et lui seul ;
    // la répartition du second ne lit que les réservations « tous » des
    // absentes, où Théo, présent, n'entre pas : Capucine le reçoit.
    const inverse = chargeAnimee();
    inverse.reglages.attribuerSieges = false;
    inverse.reservations = [resa(2, 4, null), resa(6, 4, null)];
    inverse.titres = deux.titres;
    assert.deepEqual(designations(inverse), [
      { rang: 0, titre: inverse.titres[0], reservation: resa(2, 4, null) },
      { rang: 1, titre: inverse.titres[1], reservation: resa(6, 4, null) },
    ]);
    // Théo absent à son tour, Capucine aussi : la première dans l'ordre des
    // réservations tient le titre, et elle seule.
    charge.participants[1] = personne(2, { presence: [2, 3] });
    assert.deepEqual(designations(charge), [{ rang: 0, titre: charge.titres[0], reservation: resa(2, 4, null) }]);
  });

  test('animateursDeLaTable : la personne et le titre qu’elle pourvoit, par siège, absente à un tour comprise ; ni réservation sans titre, ni exclue', () => {
    const charge = chargeAnimee();
    assert.deepEqual(animateursDeLaTable(charge, 2), [
      { participant: 1, siege: 2, libelle: 'animatrice' },
      { participant: 6, siege: 4, libelle: 'veille' },
    ]);
    assert.deepEqual(animateursDeLaTable(charge, 4), [{ participant: 2, siege: 1, libelle: 'animation' }]);
    // Une seconde animatrice au siège 1 passe devant Iris ; l'exclue ne
    // pourvoit rien.
    const deux = chargeAnimee();
    deux.reservations.push(resa(7, 2, 1), resa(5, 2, 3));
    deux.titres.push({ table: 2, siege: 1, libelle: 'accueil' }, { table: 2, siege: 3, libelle: 'relève' });
    assert.deepEqual(animateursDeLaTable(deux, 2), [
      { participant: 7, siege: 1, libelle: 'accueil' },
      { participant: 1, siege: 2, libelle: 'animatrice' },
      { participant: 6, siege: 4, libelle: 'veille' },
    ]);
    assert.throws(() => animateursDeLaTable(charge, 9), TypeError);
  });

  test('l’animatrice absente à un tour se retire comme une autre : sa réservation « tous les tours » et son titre partent, en une entrée', () => {
    const charge = chargeAnimee();
    const { charge: apres, libelle } = appliquerCommande('retirerAnimateur', charge, { table: 2, participant: 6 });
    assert.deepEqual(apres.reservations, [resa(1, 2, 2), resa(2, 4, 1), resa(3, 2, null, 2), resa(4, 4, null)]);
    assert.deepEqual(apres.titres, charge.titres.slice(0, 2));
    assert.equal(libelle, "Retiré l'animateur Capucine Sarcelle de la table 5");
    assert.deepEqual(animateursDeLaTable(apres, 2), [{ participant: 1, siege: 2, libelle: 'animatrice' }]);
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

describe('animateurs : les tables de chaque personne et l’animation réservée (§ 4, § 10.2)', () => {
  test('tablesAnimees : chaque animatrice et les numéros affichés de ses tables, croissants ; une désignation suspendue compte', () => {
    assert.deepEqual([...tablesAnimees(chargeAnimee())], [[1, [5]], [2, [3]], [6, [5]]]);
  });

  test('tablesAnimees : deux tables animées s’écrivent croissantes, chacune une fois', () => {
    const charge = chargeAnimee();
    charge.reservations.push(resa(1, 4, 2));
    charge.titres.push({ table: 4, siege: 2, libelle: 'animatrice' }, { table: 4, siege: 2, libelle: 'veille' });
    assert.deepEqual(tablesAnimees(charge).get(1), [3, 5]);
  });

  test('tablesAnimees : une réservation sans titre, ou de tour désigné, ne fait animer aucune table', () => {
    const animees = tablesAnimees(chargeAnimee());
    assert.equal(animees.has(3), false);
    assert.equal(animees.has(4), false);
  });

  test('aDesigner : les marquées non exclues qui n’animent aucune table, dans l’ordre des participants', () => {
    const charge = chargeAnimee();
    for (const id of [1, 3, 5, 6, 8]) charge.participants[id - 1].animationReservee = true;
    charge.participants[2].presence = [1, 2];
    assert.deepEqual(aDesigner(charge), [3, 8]);
    assert.deepEqual(aDesigner(chargeAnimee()), []);
  });
});

describe('animateurs : la répartition des personnes à désigner sur les tables créées (§ 6.1)', () => {
  // Huit personnes marquées, deux tours, aucune table : l'organisation de
  // chacune, null sans organisation.
  function chargeMarquee(organisations) {
    const charge = creerCharge({ id: 'evt-repartition', nom: 'Soirée des Grèbes', siegesParDefaut: 3, tours: 2 });
    charge.participants = organisations.map((organisation, rang) => personne(rang + 1, { organisation, animationReservee: true }));
    charge.prochainsIds = { participant: organisations.length + 1, table: 1, proposition: 1 };
    return charge;
  }

  test('le moins d’animateurs d’abord, puis une table sans animateur de son organisation, puis le plus petit rang ; au plus places − 1 par table', () => {
    const charge = chargeMarquee(['Héron', 'Héron', 'Grèbe', null, 'Héron', 'Héron', null, 'Grèbe']);
    // Trois tables de trois places, deux animateurs chacune au plus. La 5e
    // évite la table 1, où anime déjà une personne de son organisation ; la
    // 6e y va quand même : le moins d'animateurs passe avant l'organisation.
    assert.deepEqual(repartitionALaCreation(charge, 3, 3), {
      affectations: [
        { participant: 1, rang: 0 },
        { participant: 2, rang: 1 },
        { participant: 3, rang: 2 },
        { participant: 4, rang: 0 },
        { participant: 5, rang: 2 },
        { participant: 6, rang: 1 },
      ],
      restantes: [
        { participant: 7, cause: 'tablesPleines' },
        { participant: 8, cause: 'tablesPleines' },
      ],
    });
    // Deux places par table : un animateur chacune.
    assert.deepEqual(repartitionALaCreation(charge, 2, 2).affectations, [
      { participant: 1, rang: 0 },
      { participant: 2, rang: 1 },
    ]);
  });

  test('par identifiant croissant, quel que soit l’ordre de la liste ; seules les personnes à désigner entrent', () => {
    const charge = chargeMarquee([null, null, null, null]);
    charge.participants.reverse();
    delete charge.participants[0].animationReservee;
    assert.deepEqual(repartitionALaCreation(charge, 2, 8), {
      affectations: [
        { participant: 1, rang: 0 },
        { participant: 2, rang: 1 },
        { participant: 3, rang: 0 },
      ],
      restantes: [],
    });
  });

  test('restent à désigner, dans l’ordre des identifiants : une absente, ses tours ; une personne déjà réservée ; une exclue ou une animatrice n’y figurent pas', () => {
    const charge = chargeAnimee();
    for (const personneMarquee of charge.participants) personneMarquee.animationReservee = true;
    charge.participants[6].presence = [1, 3];
    // Iris, Théo et Capucine animent ; Anouk est exclue. Ondine et Grisaille
    // tiennent une réservation, Amandine manque le tour 2, Basile va à la
    // première table.
    assert.deepEqual(repartitionALaCreation(charge, 2, 4), {
      affectations: [{ participant: 8, rang: 0 }],
      restantes: [
        { participant: 3, cause: 'reservee' },
        { participant: 4, cause: 'reservee' },
        { participant: 7, cause: 'absente', tours: [2] },
      ],
    });
    assert.deepEqual(repartitionALaCreation(chargeAnimee(), 2, 4), { affectations: [], restantes: [] });
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
    assert.deepEqual(animateursDeLaTable(charge, 2), [
      { participant: 1, siege: 2, libelle: 'Accueil' },
      { participant: 6, siege: 4, libelle: 'veille' },
    ]);
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
