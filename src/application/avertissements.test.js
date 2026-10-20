// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves des avertissements d'un geste (§ 5.9, § 9, § 14.12), sur des
// charges construites à la main : le manque de places qui croît, la
// configuration qui ne se normalise plus, la dérive qu'un geste ajoute, la
// réservation que le retenu n'honore plus, et les violations du retenu qui
// subsistent hors de la dérive. La valeur attendue du manque vient du moteur
// lui-même, sur la configuration rendue. Les noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { nombrePlacesManquantes, normaliser } from '../moteur/configuration.js';
import { creerCharge } from '../stockage/document.js';
import { examiner } from '../stockage/placements.js';
import { VERSION } from '../version.genere.js';
import { avertissementsApres, deriveNouvelle, examenNomme, invariantViole, raisonsNommees } from './avertissements.js';
import { configurationDe } from './configuration.js';
import { nomAffiche } from './personnes.js';

const personne = (id, nom, exclu = false) => ({
  id,
  nom,
  prenom: null,
  appartenance: null,
  courriel: null,
  titrePressenti: null,
  notes: null,
  exclu,
});

const table = (id, sieges) => ({ id, numero: id, sieges, forme: 'ronde', position: { x: 300 * (id - 1), y: 0 } });

// Une copie modifiée : celle reçue ne change pas.
function avec(charge, modifier) {
  const copie = structuredClone(charge);
  modifier(copie);
  return copie;
}

// Ajoute à la charge les convives de rang premier à dernier, inclus.
function ajouterConvives(charge, premier, dernier) {
  for (let rang = premier; rang <= dernier; rang += 1) charge.participants.push(personne(rang, `Convive ${rang}`));
  charge.prochainsIds.participant = dernier + 1;
}

// Deux tables de huit et seize convives : la salle est pleine.
function sallePleine() {
  const charge = creerCharge({ id: 'evt-merles', nom: 'Soirée des Merles', siegesParDefaut: 8, tours: 2 });
  charge.tables = [table(1, 8), table(2, 8)];
  charge.prochainsIds = { participant: 1, table: 3, proposition: 1 };
  ajouterConvives(charge, 1, 16);
  return charge;
}

const manqueDu = (charge) => nombrePlacesManquantes(normaliser(configurationDe(charge)));

// Quatre personnes, deux tables de deux, deux tours ; Iris Ombrelle réservée
// à la table 1 pour tous les tours. Le placement de la proposition 1 : Iris
// et Grisaille à la table 1 au premier tour, Iris et Pervenche au second.
const PLACEMENT = [
  { sieges: [[1, 2], [3, 4]], reserve: [] },
  { sieges: [[1, 3], [2, 4]], reserve: [] },
];
const plan = () => ({ tables: [1, 2], capacites: [2, 2], tours: 2, participants: [1, 2, 3, 4], placement: structuredClone(PLACEMENT) });
const proposition = (id) => ({
  id,
  graine: id,
  arret: 40,
  historique: 1,
  produitVersion: VERSION.affichee,
  siegesAttribues: false,
  ...plan(),
});

function petiteSoiree({ retenu = true } = {}) {
  const charge = creerCharge({ id: 'evt-lucioles', nom: 'Soirée des Lucioles', siegesParDefaut: 2, tours: 2 });
  charge.participants = [
    personne(1, 'Ombrelle'),
    personne(2, 'Grisaille'),
    personne(3, 'Pervenche'),
    personne(4, 'Lacasse'),
  ];
  charge.tables = [table(1, null), table(2, null)];
  charge.reservations = [{ participant: 1, table: 1, siege: null, portee: 'tous', tour: null }];
  charge.propositions = [proposition(1), proposition(2)];
  charge.retenu = retenu ? { proposition: 1, siegesAttribues: false, ...plan() } : null;
  charge.prochainsIds = { participant: 5, table: 3, proposition: 3 };
  charge.evenement.etat = retenu ? 'retenu' : 'propose';
  return charge;
}

// Grisaille réservée à la table 2 au premier tour : le placement l'assoit à
// la table 1 à ce tour.
const reserverGrisaille = (charge) =>
  charge.reservations.push({ participant: 2, table: 2, siege: null, portee: 'tour', tour: 1 });

// Le retenu se contredit : la personne 2 en réserve au premier tour, alors
// qu'elle y est déjà assise (DOUBLON).
const rendreFautif = (charge) => {
  charge.retenu.placement[0].reserve = [2];
};

const codes = (avertissements) => avertissements.map(({ code }) => code);

describe('avertissements : le manque de places (§ 5.9)', () => {
  test('la dix-septième personne : PLACES_MANQUANTES {placesManquantes: 1}, le nombre du moteur', () => {
    const avant = sallePleine();
    const apres = avec(avant, (charge) => ajouterConvives(charge, 17, 17));
    assert.equal(manqueDu(avant), 0);
    const rendu = avertissementsApres(avant, apres);
    assert.deepEqual(rendu, [{ code: 'PLACES_MANQUANTES', details: { placesManquantes: 1 } }]);
    assert.equal(rendu[0].details.placesManquantes, manqueDu(apres));
  });

  test('trois de plus : {placesManquantes: 4}, le compte de la configuration rendue', () => {
    const avant = avec(sallePleine(), (charge) => ajouterConvives(charge, 17, 17));
    const apres = avec(avant, (charge) => ajouterConvives(charge, 18, 20));
    const rendu = avertissementsApres(avant, apres);
    assert.deepEqual(rendu, [{ code: 'PLACES_MANQUANTES', details: { placesManquantes: 4 } }]);
    assert.equal(manqueDu(apres), 4);
  });

  test("un geste qui ne fait pas croître le manque n'en dit rien", () => {
    const pleine = sallePleine();
    const manque = avec(pleine, (charge) => ajouterConvives(charge, 17, 18));
    const cas = [
      [pleine, avec(pleine, (charge) => (charge.participants[0].nom = 'Ancolie'))],
      [manque, avec(manque, (charge) => (charge.participants[0].nom = 'Ancolie'))],
      [manque, avec(manque, (charge) => charge.participants.pop())],
      [manque, avec(manque, (charge) => (charge.tables[0].sieges = 10))],
      [manque, avec(manque, (charge) => (charge.participants[16].exclu = true))],
    ];
    assert.equal(cas.length, 5);
    for (const [avant, apres] of cas) assert.deepEqual(avertissementsApres(avant, apres), []);
  });

  test('ôter une table, ou baisser une capacité, fait croître le manque et le dit', () => {
    const pleine = sallePleine();
    assert.deepEqual(avertissementsApres(pleine, avec(pleine, (charge) => charge.tables.pop())), [
      { code: 'PLACES_MANQUANTES', details: { placesManquantes: 8 } },
    ]);
    assert.deepEqual(avertissementsApres(pleine, avec(pleine, (charge) => (charge.tables[1].sieges = 6))), [
      { code: 'PLACES_MANQUANTES', details: { placesManquantes: 2 } },
    ]);
  });
});

describe('avertissements : une configuration qui ne se normalise plus (§ 5.9)', () => {
  // Iris réservée aussi à la table 2 au premier tour : deux tables au même
  // tour, RESERVATION_CONFLIT.
  const enConflit = (charge) =>
    charge.reservations.push({ participant: 1, table: 2, siege: null, portee: 'tour', tour: 1 });

  test("la configuration rendue lève : CONFIGURATION_INCOHERENTE porte le code et les détails du moteur, et le manque ne se calcule pas", () => {
    const avant = sallePleine();
    avant.reservations = [{ participant: 1, table: 1, siege: null, portee: 'tous', tour: null }];
    const apres = avec(avant, (charge) => {
      enConflit(charge);
      ajouterConvives(charge, 17, 19);
    });
    assert.deepEqual(avertissementsApres(avant, apres), [
      {
        code: 'CONFIGURATION_INCOHERENTE',
        details: { code: 'RESERVATION_CONFLIT', details: { participant: 1, tour: 1, tables: [1, 2] } },
      },
    ]);
  });

  test("déjà incohérente avant le geste : rien ne se répète ; redevenue cohérente, le manque se compte depuis zéro", () => {
    const avant = sallePleine();
    avant.reservations = [{ participant: 1, table: 1, siege: null, portee: 'tous', tour: null }];
    enConflit(avant);
    const encore = avec(avant, (charge) => ajouterConvives(charge, 17, 17));
    assert.deepEqual(avertissementsApres(avant, encore), []);
    const reparee = avec(encore, (charge) => charge.reservations.pop());
    assert.deepEqual(avertissementsApres(encore, reparee), [{ code: 'PLACES_MANQUANTES', details: { placesManquantes: 1 } }]);
  });

  test("une configuration hors de sa forme n'est pas une incohérence : la TypeError du moteur remonte", () => {
    const avant = sallePleine();
    const apres = avec(avant, (charge) => (charge.participants[0].id = 'un'));
    assert.throws(() => avertissementsApres(avant, apres), TypeError);
  });
});

describe('avertissements : la dérive que le geste ajoute (§ 9, § 8.9)', () => {
  test('exclure une personne : DERIVE_NOUVELLE nomme chaque proposition par identifiant, puis le retenu, et la raison', () => {
    const avant = petiteSoiree();
    const apres = avec(avant, (charge) => (charge.participants[2].exclu = true));
    const raisons = [{ code: 'PARTICIPANT_EXCLU', participant: 3, personne: 'Pervenche' }];
    assert.deepEqual(avertissementsApres(avant, apres), [
      {
        code: 'DERIVE_NOUVELLE',
        details: { touchees: [{ id: 1, raisons }, { id: 2, raisons }, { id: 'retenu', raisons }] },
      },
    ]);
  });

  test("une raison que le placement portait déjà ne se redit pas ; une raison au champ changé est nouvelle", () => {
    const une = avec(petiteSoiree(), (charge) => (charge.participants[2].exclu = true));
    const deux = avec(une, (charge) => (charge.participants[3].exclu = true));
    const raisons = [{ code: 'PARTICIPANT_EXCLU', participant: 4, personne: 'Lacasse' }];
    assert.deepEqual(avertissementsApres(une, deux), [
      { code: 'DERIVE_NOUVELLE', details: { touchees: [{ id: 1, raisons }, { id: 2, raisons }, { id: 'retenu', raisons }] } },
    ]);
    assert.deepEqual(avertissementsApres(deux, avec(deux, (charge) => (charge.participants[0].nom = 'Parasol'))), []);
    const trois = avec(petiteSoiree(), (charge) => (charge.tables[0].sieges = 3));
    const quatre = avec(trois, (charge) => (charge.tables[0].sieges = 4));
    const changee = [{ code: 'CAPACITE_CHANGEE', table: 1, avant: 2, maintenant: 4, numero: 1 }];
    assert.deepEqual(avertissementsApres(trois, quatre), [
      {
        code: 'DERIVE_NOUVELLE',
        details: { touchees: [{ id: 1, raisons: changee }, { id: 2, raisons: changee }, { id: 'retenu', raisons: changee }] },
      },
    ]);
  });

  test("un retenu fautif ne dit rien de lui : ni dérive, ni réservation non honorée, et rien ne lève", () => {
    const avant = avec(petiteSoiree(), rendreFautif);
    const apres = avec(avant, (charge) => {
      charge.participants[2].exclu = true;
      reserverGrisaille(charge);
    });
    const raisons = [{ code: 'PARTICIPANT_EXCLU', participant: 3, personne: 'Pervenche' }];
    assert.deepEqual(avertissementsApres(avant, apres), [
      { code: 'DERIVE_NOUVELLE', details: { touchees: [{ id: 1, raisons }, { id: 2, raisons }] } },
    ]);
  });
});

describe('avertissements : la dérive nomme les personnes et les tables (§ 9)', () => {
  test("une personne se nomme par son nom affiché, une table par son numéro ; celles que le geste retire, par la charge d'avant", () => {
    const avant = avec(petiteSoiree(), (charge) => {
      charge.tables[1].numero = 7;
      charge.participants[1].prenom = 'Aubépine';
    });
    const supprimees = avec(avant, (charge) => {
      charge.participants = charge.participants.filter(({ id }) => id !== 2);
      charge.reservations = charge.reservations.filter(({ participant }) => participant !== 2);
      charge.tables = charge.tables.filter(({ id }) => id !== 2);
    });
    const raisons = [
      { code: 'PARTICIPANT_SUPPRIME', participant: 2, personne: 'Aubépine Grisaille' },
      { code: 'TABLE_SUPPRIMEE', table: 2, numero: 7 },
    ];
    const [derive] = avertissementsApres(avant, supprimees).filter(({ code }) => code === 'DERIVE_NOUVELLE');
    assert.deepEqual(derive.details.touchees, [{ id: 1, raisons }, { id: 2, raisons }, { id: 'retenu', raisons }]);

    const ajoutees = avec(avant, (charge) => {
      charge.participants.push(personne(5, 'Ancolie'));
      charge.tables.push({ ...table(3, null), numero: 9 });
      charge.prochainsIds.participant = 6;
      charge.prochainsIds.table = 4;
    });
    const [nouvelle] = avertissementsApres(avant, ajoutees).filter(({ code }) => code === 'DERIVE_NOUVELLE');
    assert.deepEqual(nouvelle.details.touchees[0].raisons, [
      { code: 'PARTICIPANT_NON_PLACE', participant: 5, personne: 'Ancolie' },
      { code: 'TABLE_AJOUTEE', table: 3, numero: 9 },
    ]);
  });

  test("examenNomme nomme chaque raison de l'examen sur la charge, sans toucher l'examen reçu ; une personne ou une table que la charge n'a plus garde son identifiant", () => {
    const charge = avec(petiteSoiree(), (copie) => {
      copie.participants[2].exclu = true;
      copie.participants.pop();
    });
    const examen = examiner(charge);
    const copie = structuredClone(examen);
    const nomme = examenNomme(examen, charge);
    assert.deepEqual(examen, copie);
    const attendues = [
      { code: 'PARTICIPANT_EXCLU', participant: 3, personne: 'Pervenche' },
      { code: 'PARTICIPANT_SUPPRIME', participant: 4 },
    ];
    assert.deepEqual(nomme.retenu.raisons, attendues);
    assert.deepEqual(nomme.derives.map(({ raisons }) => raisons), [attendues, attendues]);
    assert.deepEqual(nomme.fautives, examen.fautives);
  });
});

describe("avertissements : la réservation que le retenu n'honore plus (§ 5.8, § 14.12)", () => {
  test('une réservation posée après la retenue, que le retenu ne tient pas : RESERVATION_NON_HONOREE {participant, table, tour, personne, numero}', () => {
    const avant = petiteSoiree();
    const apres = avec(avant, reserverGrisaille);
    assert.deepEqual(avertissementsApres(avant, apres), [
      { code: 'RESERVATION_NON_HONOREE', details: { participant: 2, table: 2, tour: 1, personne: 'Grisaille', numero: 2 } },
    ]);
    assert.deepEqual(avertissementsApres(apres, avec(apres, (charge) => (charge.participants[0].nom = 'Parasol'))), []);
  });

  test('la personne se nomme par son nom affiché, et la table par son numéro, distinct de son identifiant', () => {
    const avant = avec(petiteSoiree(), (charge) => {
      charge.tables[1].numero = 7;
      charge.participants[1].prenom = 'Aubépine';
    });
    const apres = avec(avant, reserverGrisaille);
    assert.deepEqual(avertissementsApres(avant, apres), [
      { code: 'RESERVATION_NON_HONOREE', details: { participant: 2, table: 2, tour: 1, personne: 'Aubépine Grisaille', numero: 7 } },
    ]);
  });

  test("retenir une proposition qui ne tient pas une réservation : le retenu nul d'avant n'en comptait aucune", () => {
    const avant = avec(petiteSoiree({ retenu: false }), reserverGrisaille);
    const apres = avec(avant, (charge) => {
      charge.retenu = { proposition: 1, siegesAttribues: false, ...plan() };
      charge.evenement.etat = 'retenu';
    });
    assert.deepEqual(avertissementsApres(avant, apres), [
      { code: 'RESERVATION_NON_HONOREE', details: { participant: 2, table: 2, tour: 1, personne: 'Grisaille', numero: 2 } },
    ]);
  });

  test("le retenu redevenu cohérent compte ses violations contre un avant fautif, qui n'en comptait aucune", () => {
    const avant = avec(avec(petiteSoiree(), reserverGrisaille), rendreFautif);
    const apres = avec(avant, (charge) => (charge.retenu.placement[0].reserve = []));
    assert.deepEqual(avertissementsApres(avant, apres), [
      { code: 'RESERVATION_NON_HONOREE', details: { participant: 2, table: 2, tour: 1, personne: 'Grisaille', numero: 2 } },
    ]);
  });

  test("l'ordre du contrat : le manque, puis la dérive, puis la réservation non honorée", () => {
    const avant = petiteSoiree();
    const apres = avec(avant, (charge) => {
      charge.participants.push(personne(5, 'Ancolie'));
      charge.prochainsIds.participant = 6;
      reserverGrisaille(charge);
    });
    assert.deepEqual(codes(avertissementsApres(avant, apres)), ['PLACES_MANQUANTES', 'DERIVE_NOUVELLE', 'RESERVATION_NON_HONOREE']);
  });
});

describe('avertissements : les violations du retenu hors de la dérive (§ 14.12, § 14.15)', () => {
  test('une réservation non honorée : INVARIANT_VIOLE {proposition, violations}, sans les violations que la dérive nomme', () => {
    const charge = avec(petiteSoiree(), (copie) => {
      reserverGrisaille(copie);
      copie.participants[3].exclu = true;
    });
    assert.deepEqual(invariantViole(charge), {
      code: 'INVARIANT_VIOLE',
      details: { proposition: 1, violations: [{ code: 'RESERVATION', participant: 2, table: 2, tour: 1 }] },
    });
  });

  test("chaque violation que la dérive nomme se tait : exclus, supprimés, non placés, tables, capacités, tours", () => {
    const cas = [
      (charge) => (charge.participants[3].exclu = true),
      (charge) => charge.participants.pop(),
      (charge) => {
        charge.participants.push(personne(5, 'Ancolie'));
        charge.prochainsIds.participant = 6;
      },
      (charge) => {
        charge.tables.push(table(3, null));
        charge.prochainsIds.table = 4;
      },
      (charge) => {
        charge.tables[1].sieges = 2;
        charge.retenu.capacites = [2, 3];
        for (const tour of charge.retenu.placement) tour.sieges = [[1], [2, 3, 4]];
      },
      (charge) => {
        charge.tables[1].id = 3;
        charge.prochainsIds.table = 4;
      },
      (charge) => (charge.evenement.tours = 3),
    ];
    assert.equal(cas.length, 7);
    for (const modifier of cas) assert.equal(invariantViole(avec(petiteSoiree(), modifier)), null, String(modifier));
  });

  test('un retenu aux surnuméraires versés en réserve est sans violation ; sans retenu, ou fautif, ou sur une configuration incohérente, rien', () => {
    const reserve = avec(petiteSoiree(), (charge) => {
      charge.participants.push(personne(5, 'Ancolie'));
      charge.prochainsIds.participant = 6;
      charge.retenu.participants = [1, 2, 3, 4, 5];
      for (const tour of charge.retenu.placement) tour.reserve = [5];
    });
    assert.equal(invariantViole(reserve), null);
    assert.equal(invariantViole(petiteSoiree({ retenu: false })), null);
    assert.equal(invariantViole(avec(avec(petiteSoiree(), reserverGrisaille), rendreFautif)), null);
    const incoherente = avec(petiteSoiree(), (charge) => {
      reserverGrisaille(charge);
      charge.reservations.push({ participant: 2, table: 1, siege: null, portee: 'tour', tour: 1 });
    });
    assert.equal(invariantViole(incoherente), null);
  });
});

// Huit personnes, deux tables de quatre, un tour, sièges attribués : le
// retenu assied 1 à 4 aux sièges 1 à 4 de la table 1, et 5 à 8 à la table 2.
function soireeAuxSieges() {
  const charge = creerCharge({ id: 'evt-sieges', nom: 'Soirée des Chaises', siegesParDefaut: 4, tours: 1 });
  const ids = [1, 2, 3, 4, 5, 6, 7, 8];
  charge.participants = ids.map((id) => personne(id, `Convive ${id}`));
  charge.tables = [table(1, null), table(2, null)];
  charge.reglages.attribuerSieges = true;
  const plan = { tables: [1, 2], capacites: [4, 4], tours: 1, participants: ids, placement: [{ sieges: [[1, 2, 3, 4], [5, 6, 7, 8]], reserve: [] }] };
  charge.propositions = [
    { id: 1, graine: 1, arret: 40, historique: 1, produitVersion: VERSION.affichee, siegesAttribues: true, ...structuredClone(plan) },
  ];
  charge.retenu = { proposition: 1, siegesAttribues: true, ...structuredClone(plan) };
  charge.prochainsIds = { participant: 9, table: 3, proposition: 2 };
  charge.evenement.etat = 'retenu';
  return charge;
}

const reserverAuSiege = (participant, idTable, siege) => (charge) =>
  charge.reservations.push({ participant, table: idTable, siege, portee: 'tous', tour: null });
const deCode = (code) => (avertissements) => avertissements.filter((avertissement) => avertissement.code === code);

describe("avertissements : la réservation que le retenu n'honore pas au siège (§ 5.8, § 14.12)", () => {
  test('sièges attribués, une réservation au siège 3 que le retenu donne à un autre, la personne assise à la même table : RESERVATION_NON_HONOREE au siège, avec son occupant', () => {
    const avant = soireeAuxSieges();
    const apres = avec(avant, reserverAuSiege(2, 1, 3));
    assert.deepEqual(avertissementsApres(avant, apres), [
      {
        code: 'RESERVATION_NON_HONOREE',
        details: { participant: 2, table: 1, tour: 1, personne: 'Convive 2', numero: 1, siege: 3, occupant: 3 },
      },
    ]);
    assert.deepEqual(invariantViole(apres), {
      code: 'INVARIANT_VIOLE',
      details: { proposition: 1, violations: [{ code: 'RESERVATION', participant: 2, table: 1, tour: 1, siege: 3, occupant: 3 }] },
    });
    assert.deepEqual(avertissementsApres(apres, avec(apres, (charge) => (charge.participants[0].nom = 'Parasol'))), []);
  });

  test("la chaise réservée vide : l'occupant est null", () => {
    const avant = avec(soireeAuxSieges(), (charge) => {
      charge.retenu.placement[0].sieges[0] = [1, 2, null, 4];
      charge.retenu.placement[0].reserve = [3];
    });
    const apres = avec(avant, reserverAuSiege(2, 1, 3));
    assert.deepEqual(deCode('RESERVATION_NON_HONOREE')(avertissementsApres(avant, apres)), [
      {
        code: 'RESERVATION_NON_HONOREE',
        details: { participant: 2, table: 1, tour: 1, personne: 'Convive 2', numero: 1, siege: 3, occupant: null },
      },
    ]);
  });

  test("tenue à son siège, réservée sans siège, ou sans attribution des sièges : rien au siège", () => {
    const avant = soireeAuxSieges();
    assert.deepEqual(avertissementsApres(avant, avec(avant, reserverAuSiege(3, 1, 3))), []);
    assert.deepEqual(avertissementsApres(avant, avec(avant, reserverAuSiege(2, 1, null))), []);
    const sansAttribution = avec(avant, (charge) => {
      charge.reglages.attribuerSieges = false;
      charge.retenu.siegesAttribues = false;
      charge.propositions[0].siegesAttribues = false;
    });
    assert.deepEqual(avertissementsApres(sansAttribution, avec(sansAttribution, reserverAuSiege(2, 1, 3))), []);
    assert.equal(invariantViole(avec(sansAttribution, reserverAuSiege(2, 1, 3))), null);
  });

  test('deux réservations au même siège : la première dans l’ordre canonique le tient, la seconde se lit sans siège', () => {
    const avant = soireeAuxSieges();
    const apres = avec(avant, (charge) => {
      reserverAuSiege(3, 1, 3)(charge);
      reserverAuSiege(4, 1, 3)(charge);
    });
    assert.deepEqual(avertissementsApres(avant, apres), []);
  });
});

describe("avertissements : la réservation d'une personne que le retenu ne place pas (§ 9, § 14.12)", () => {
  test("une personne ajoutée après la retenue et réservée : RESERVATION_NON_HONOREE, en plus de la dérive qui la dit non placée ; INVARIANT_VIOLE la garde", () => {
    const avant = soireeAuxSieges();
    const apres = avec(avant, (charge) => {
      charge.participants.push(personne(9, 'Ancolie'));
      charge.prochainsIds.participant = 10;
      reserverAuSiege(9, 2, null)(charge);
    });
    const rendus = avertissementsApres(avant, apres);
    assert.deepEqual(codes(rendus), ['PLACES_MANQUANTES', 'DERIVE_NOUVELLE', 'RESERVATION_NON_HONOREE']);
    assert.deepEqual(deCode('RESERVATION_NON_HONOREE')(rendus)[0].details, {
      participant: 9,
      table: 2,
      tour: 1,
      personne: 'Ancolie',
      numero: 2,
    });
    assert.deepEqual(invariantViole(apres).details.violations, [{ code: 'RESERVATION', participant: 9, table: 2, tour: 1 }]);
  });

  test("non réservée, la personne ajoutée ne relève que de la dérive", () => {
    const avant = soireeAuxSieges();
    const apres = avec(avant, (charge) => {
      charge.participants.push(personne(9, 'Ancolie'));
      charge.prochainsIds.participant = 10;
    });
    assert.deepEqual(deCode('RESERVATION_NON_HONOREE')(avertissementsApres(avant, apres)), []);
    assert.equal(invariantViole(apres), null);
  });
});

// La charge où chaque personne de presences ({id: liste}) porte cette
// présence.
const presentes = (presences) => (charge) => {
  for (const personne of charge.participants) if (Object.hasOwn(presences, personne.id)) personne.presence = presences[personne.id];
};

describe('avertissements : le manque de places par tour (§ 5.9)', () => {
  test('la dix-septième personne, présente au tour 2 seulement : PLACES_MANQUANTES nomme le tour 2', () => {
    const avant = sallePleine();
    const apres = avec(avant, (charge) => {
      ajouterConvives(charge, 17, 17);
      presentes({ 17: [2] })(charge);
    });
    assert.deepEqual(avertissementsApres(avant, apres), [
      { code: 'PLACES_MANQUANTES', details: { placesManquantes: 1, tours: [{ tour: 2, manque: 1 }] } },
    ]);
  });

  test('un tour qui empire : tours liste chaque tour à manque positif, et placesManquantes le plus grand', () => {
    const avant = avec(sallePleine(), (charge) => {
      ajouterConvives(charge, 17, 18);
      presentes({ 17: [2], 18: [2] })(charge);
    });
    const apres = avec(avant, (charge) => {
      ajouterConvives(charge, 19, 19);
      presentes({ 19: [1] })(charge);
    });
    assert.deepEqual(avertissementsApres(avant, apres), [
      { code: 'PLACES_MANQUANTES', details: { placesManquantes: 2, tours: [{ tour: 1, manque: 1 }, { tour: 2, manque: 2 }] } },
    ]);
  });

  test("un geste qui n'aggrave aucun tour n'en dit rien, même quand un manque demeure ; un manque qui gagne un tour le dit", () => {
    const deux = avec(sallePleine(), (charge) => {
      ajouterConvives(charge, 17, 18);
      presentes({ 17: [2], 18: [2] })(charge);
    });
    assert.deepEqual(avertissementsApres(deux, avec(deux, (charge) => charge.participants.pop())), []);
    assert.deepEqual(avertissementsApres(deux, avec(deux, presentes({ 18: [1, 2] }))), [
      { code: 'PLACES_MANQUANTES', details: { placesManquantes: 2, tours: [{ tour: 1, manque: 1 }, { tour: 2, manque: 2 }] } },
    ]);
    assert.deepEqual(avertissementsApres(deux, avec(deux, (charge) => (charge.participants[0].nom = 'Ancolie'))), []);
  });

  test('sans aucune présence, un tour ajouté au même manque ne dit rien, comme avant', () => {
    const manque = avec(sallePleine(), (charge) => ajouterConvives(charge, 17, 17));
    assert.deepEqual(avertissementsApres(manque, avec(manque, (charge) => (charge.evenement.tours = 3))), []);
    assert.deepEqual(avertissementsApres(manque, avec(manque, (charge) => (charge.evenement.tours = 1))), []);
  });
});

describe('avertissements : les violations que nomme une dérive de présence (§ 14.12)', () => {
  test('le retenu assied Lacasse au tour 2, où elle est absente : ABSENT_PLACE se tait, nommée par PRESENCE_RETIREE', () => {
    const charge = avec(petiteSoiree(), presentes({ 4: [1] }));
    assert.deepEqual(
      examiner(charge).retenu.raisons.map(({ code }) => code),
      ['PRESENCE_RETIREE'],
    );
    assert.equal(invariantViole(charge), null);
  });

  test('une présence retirée avertit au geste qui la retire, puis plus aux gestes suivants', () => {
    const avant = petiteSoiree();
    const retiree = avec(avant, presentes({ 4: [1] }));
    const derive = avertissementsApres(avant, retiree).find(({ code }) => code === 'DERIVE_NOUVELLE');
    assert.ok(derive.details.touchees.some(({ raisons }) => raisons.some(({ code }) => code === 'PRESENCE_RETIREE')));
    const suivante = avec(retiree, (charge) => (charge.participants[0].exclu = true));
    const raisonsSuivantes = avertissementsApres(retiree, suivante)
      .filter(({ code }) => code === 'DERIVE_NOUVELLE')
      .flatMap(({ details }) => details.touchees.flatMap(({ raisons }) => raisons.map(({ code }) => code)));
    assert.equal(raisonsSuivantes.includes('PRESENCE_RETIREE'), false, raisonsSuivantes.join(', '));
    assert.ok(raisonsSuivantes.includes('PARTICIPANT_EXCLU'));
  });

  test('le retenu dit Lacasse absente au tour 2, où elle est présente : NON_ASSIS se tait, nommée par PRESENCE_AJOUTEE ; une autre violation reste', () => {
    const absente = (charge) => {
      charge.retenu.placement[1] = { sieges: [[1, 3], [2]], reserve: [], absents: [4] };
    };
    const charge = avec(petiteSoiree(), absente);
    assert.deepEqual(
      examiner(charge).retenu.raisons.map(({ code }) => code),
      ['PRESENCE_AJOUTEE'],
    );
    assert.equal(invariantViole(charge), null);
    const reservee = avec(charge, reserverGrisaille);
    assert.deepEqual(invariantViole(reservee).details.violations, [{ code: 'RESERVATION', participant: 2, table: 2, tour: 1 }]);
  });

  // La petite soirée sous sièges attribués : le réglage, le retenu et les
  // propositions.
  const attribuer = (charge) => {
    charge.reglages.attribuerSieges = true;
    charge.retenu.siegesAttribues = true;
    for (const proposition of charge.propositions) proposition.siegesAttribues = true;
  };

  test('sièges attribués : la réservation au siège 2 de Lacasse, absente au tour 2, ne tient pas ce siège à ce tour ; seule PRESENCE_RETIREE, sans violation', () => {
    const charge = avec(petiteSoiree(), (copie) => {
      attribuer(copie);
      copie.reservations.push({ participant: 4, table: 2, siege: 2, portee: 'tous', tour: null });
      copie.retenu.placement[1].sieges = [[1, 3], [4, 2]];
      presentes({ 4: [1] })(copie);
    });
    assert.deepEqual(
      examiner(charge).retenu.raisons.map(({ code }) => code),
      ['PRESENCE_RETIREE'],
    );
    assert.equal(invariantViole(charge), null);
  });

  test('sièges attribués : le siège réservé à Grisaille au tour 2, occupé par Lacasse absente à ce tour, a pour occupant null', () => {
    const charge = avec(petiteSoiree(), (copie) => {
      attribuer(copie);
      copie.reservations.push({ participant: 2, table: 2, siege: 2, portee: 'tour', tour: 2 });
      presentes({ 4: [1] })(copie);
    });
    assert.deepEqual(invariantViole(charge).details.violations, [
      { code: 'RESERVATION', participant: 2, table: 2, tour: 2, siege: 2, occupant: null },
    ]);
  });
});

// Une liste sous un Proxy qui compte les éléments lus : chaque lecture d'un
// indice entier ajoute un à compte.lus.
function listeComptee(liste) {
  const compte = { lus: 0 };
  const vue = new Proxy(liste, {
    get(cible, cle, recepteur) {
      if (typeof cle === 'string' && /^\d+$/.test(cle)) compte.lus += 1;
      return Reflect.get(cible, cle, recepteur);
    },
  });
  return { vue, compte };
}

// La sémantique de référence de raisonsNommees : un find par raison et par
// charge, la première charge qui porte l'identifiant tranche.
function nommeesParRecherche(raisons, ...charges) {
  const premiere = (id, cle) => {
    for (const charge of charges) {
      const trouvee = charge[cle].find((candidate) => candidate.id === id);
      if (trouvee !== undefined) return { trouvee };
    }
    return null;
  };
  return raisons.map((raison) => {
    const nommee = { ...raison };
    if (raison.participant !== undefined) {
      const lue = premiere(raison.participant, 'participants');
      const nom = lue === null ? null : nomAffiche(lue.trouvee);
      if (nom !== null) nommee.personne = nom;
    }
    if (raison.table !== undefined) {
      const lue = premiere(raison.table, 'tables');
      const numero = lue === null ? null : lue.trouvee.numero;
      if (numero !== null) nommee.numero = numero;
    }
    return nommee;
  });
}

describe('avertissements : les raisons se nomment par un index des charges (§ 9)', () => {
  // Deux charges réduites à leurs listes : la première porte deux fois la
  // personne 2 et la table 2, une personne sans nom ni prénom, une personne
  // d'identifiant NaN, une table de numéro null et une sans numéro ; la
  // seconde redit ces identifiants autrement, et seule porte la personne 6
  // et la table 6.
  const premiere = () => ({
    participants: [
      personne(1, 'Mélilot'),
      { ...personne(2, 'Bourrache'), prenom: 'Odile' },
      personne(2, 'Cardère'),
      personne(3, null),
      personne(Number.NaN, 'Escourgeon'),
    ],
    tables: [
      { ...table(1, 4), numero: 11 },
      { ...table(2, 4), numero: 12 },
      { ...table(2, 4), numero: 99 },
      { ...table(3, 4), numero: null },
      (({ numero, ...reste }) => reste)(table(4, 4)),
    ],
  });
  const seconde = () => ({
    participants: [personne(2, 'Salicorne'), personne(3, 'Pimprenelle'), personne(6, 'Tormentille')],
    tables: [
      { ...table(2, 4), numero: 22 },
      { ...table(3, 4), numero: 33 },
      { ...table(6, 4), numero: 66 },
    ],
  });
  const raisons = [
    { code: 'PARTICIPANT_EXCLU', participant: 2 },
    { code: 'PARTICIPANT_SUPPRIME', participant: 3 },
    { code: 'PARTICIPANT_NON_PLACE', participant: 6 },
    { code: 'PARTICIPANT_SUPPRIME', participant: 7 },
    { code: 'PARTICIPANT_EXCLU', participant: Number.NaN },
    { code: 'CAPACITE_CHANGEE', table: 2, avant: 4, maintenant: 5 },
    { code: 'TABLE_SUPPRIMEE', table: 3 },
    { code: 'TABLE_AJOUTEE', table: 4 },
    { code: 'TABLE_AJOUTEE', table: 6 },
    { code: 'TABLE_SUPPRIMEE', table: 8 },
    { code: 'TOURS_CHANGES', avant: 2, maintenant: 3 },
  ];

  test('la première charge, et en elle la première entrée, tranche ; un nom ou un numéro null ne passe pas à la charge suivante ; un introuvable reste sans clé', () => {
    const nommees = raisonsNommees(raisons, premiere(), seconde());
    assert.deepEqual(nommees, [
      { code: 'PARTICIPANT_EXCLU', participant: 2, personne: 'Odile Bourrache' },
      { code: 'PARTICIPANT_SUPPRIME', participant: 3 },
      { code: 'PARTICIPANT_NON_PLACE', participant: 6, personne: 'Tormentille' },
      { code: 'PARTICIPANT_SUPPRIME', participant: 7 },
      { code: 'PARTICIPANT_EXCLU', participant: Number.NaN },
      { code: 'CAPACITE_CHANGEE', table: 2, avant: 4, maintenant: 5, numero: 12 },
      { code: 'TABLE_SUPPRIMEE', table: 3 },
      { code: 'TABLE_AJOUTEE', table: 4, numero: undefined },
      { code: 'TABLE_AJOUTEE', table: 6, numero: 66 },
      { code: 'TABLE_SUPPRIMEE', table: 8 },
      { code: 'TOURS_CHANGES', avant: 2, maintenant: 3 },
    ]);
    assert.equal(Object.hasOwn(nommees[3], 'personne'), false);
    assert.equal(Object.hasOwn(nommees[7], 'numero'), true);
    assert.equal(Object.hasOwn(nommees[9], 'numero'), false);
    assert.deepEqual(raisonsNommees(raisons, seconde(), premiere()), nommeesParRecherche(raisons, seconde(), premiere()));
    assert.deepEqual(raisonsNommees(raisons, premiere(), seconde()), nommeesParRecherche(raisons, premiere(), seconde()));
    assert.deepEqual(raisonsNommees(raisons), nommeesParRecherche(raisons));
    assert.deepEqual(raisonsNommees([], premiere()), []);
  });

  test('les raisons rendues sont neuves : celles reçues ne changent pas', () => {
    const recues = structuredClone(raisons);
    const nommees = raisonsNommees(recues, premiere(), seconde());
    assert.deepEqual(recues, raisons);
    nommees.forEach((nommee, rang) => assert.notEqual(nommee, recues[rang]));
  });

  test("raisonsNommees lit chaque personne et chaque table au plus une fois par charge, quel que soit le nombre de raisons, et aucune sans raison", () => {
    const charges = [premiere(), seconde()].map((charge) => {
      const participants = listeComptee(charge.participants);
      const tables = listeComptee(charge.tables);
      return {
        charge: { participants: participants.vue, tables: tables.vue },
        comptes: [participants.compte, tables.compte],
        tailles: [charge.participants.length, charge.tables.length],
      };
    });
    raisonsNommees([], ...charges.map(({ charge }) => charge));
    for (const { comptes } of charges) comptes.forEach((compte) => assert.equal(compte.lus, 0));
    const nombreuses = [...raisons, ...raisons, ...raisons];
    raisonsNommees(nombreuses, ...charges.map(({ charge }) => charge));
    for (const { comptes, tailles } of charges) {
      comptes.forEach((compte, rang) =>
        assert.ok(compte.lus <= tailles[rang], `${compte.lus} lectures pour ${tailles[rang]} éléments`),
      );
    }
  });

  test("examenNomme lit chaque personne et chaque table de la charge au plus une fois pour tout l'examen", () => {
    const charge = avec(petiteSoiree(), (copie) => {
      copie.participants[2].exclu = true;
      copie.participants[3].exclu = true;
      copie.tables[1].sieges = 3;
    });
    const examen = examiner(charge);
    const attendu = examenNomme(examen, charge);
    const participants = listeComptee(charge.participants);
    const tables = listeComptee(charge.tables);
    const nomme = examenNomme(examen, { ...charge, participants: participants.vue, tables: tables.vue });
    assert.deepEqual(nomme, attendu);
    assert.ok(participants.compte.lus <= charge.participants.length, `${participants.compte.lus} lectures de personnes`);
    assert.ok(tables.compte.lus <= charge.tables.length, `${tables.compte.lus} lectures de tables`);
  });
});

describe('avertissements : une liste de raisons partagée par les deux examens ne se compare pas (§ 9)', () => {
  // Les raisons d'un examen sous des Proxy qui comptent les clés lues, et
  // un examen d'après qui partage, pour chaque placement dont les raisons
  // sont champ pour champ celles d'avant, la liste d'avant elle-même.
  function examensPartages(avant, apres) {
    const compte = { cles: 0 };
    const compter = (liste) =>
      liste.map(
        (raison) =>
          new Proxy(raison, {
            ownKeys(cible) {
              compte.cles += 1;
              return Reflect.ownKeys(cible);
            },
          }),
      );
    const examenAvant = examiner(avant);
    const sousCompte = {
      ...examenAvant,
      derives: examenAvant.derives.map((derive) => ({ ...derive, raisons: compter(derive.raisons) })),
      retenu: { ...examenAvant.retenu, raisons: compter(examenAvant.retenu.raisons) },
    };
    const examenApres = examiner(apres);
    const memes = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const avantDe = new Map(sousCompte.derives.map((derive) => [derive.id, derive.raisons]));
    const partage = {
      ...examenApres,
      derives: examenApres.derives.map((derive) =>
        avantDe.has(derive.id) && memes(avantDe.get(derive.id), derive.raisons) ? { ...derive, raisons: avantDe.get(derive.id) } : derive,
      ),
      retenu: memes(sousCompte.retenu.raisons, examenApres.retenu.raisons)
        ? { ...examenApres.retenu, raisons: sousCompte.retenu.raisons }
        : examenApres.retenu,
    };
    return { examenAvant: sousCompte, examenApres, partage, compte };
  }

  test('même DERIVE_NOUVELLE avec et sans partage ; les raisons partagées ne sont pas relues', () => {
    // Pervenche est exclue avant le geste, Lacasse l'est par le geste.
    // L'examen d'après donne à la proposition 2 la liste d'avant elle-même :
    // elle n'a rien de neuf, et ses raisons ne se lisent pas.
    const avant = avec(petiteSoiree(), (charge) => (charge.participants[2].exclu = true));
    const apres = avec(avant, (charge) => (charge.participants[3].exclu = true));
    const { examenAvant, examenApres, partage, compte } = examensPartages(avant, apres);
    assert.deepEqual(
      deriveNouvelle(examenAvant, examenApres, apres, avant),
      avertissementsApres(avant, apres).find(({ code }) => code === 'DERIVE_NOUVELLE'),
    );
    const garde = { ...partage, derives: partage.derives.map((derive) => (derive.id === 2 ? examenAvant.derives[1] : derive)) };
    const copiee = { ...garde, derives: garde.derives.map((derive) => ({ ...derive, raisons: [...derive.raisons] })) };
    const lectures = (examen) => {
      compte.cles = 0;
      const rendu = deriveNouvelle(examenAvant, examen, apres, avant);
      return { rendu, cles: compte.cles };
    };
    const avecPartage = lectures(garde);
    const sansPartage = lectures(copiee);
    const raisons = [{ code: 'PARTICIPANT_EXCLU', participant: 4, personne: 'Lacasse' }];
    assert.deepEqual(avecPartage.rendu, {
      code: 'DERIVE_NOUVELLE',
      details: { touchees: [{ id: 1, raisons }, { id: 'retenu', raisons }] },
    });
    assert.deepEqual(sansPartage.rendu, avecPartage.rendu);
    assert.ok(avecPartage.cles < sansPartage.cles, `${avecPartage.cles} clés lues avec partage, ${sansPartage.cles} sans`);

    const inchangee = examensPartages(avant, avant);
    inchangee.compte.cles = 0;
    assert.equal(deriveNouvelle(inchangee.examenAvant, inchangee.partage, avant, avant), null);
    assert.equal(inchangee.compte.cles, 0);
    assert.equal(deriveNouvelle(inchangee.examenAvant, inchangee.examenApres, avant, avant), null);
  });
});
