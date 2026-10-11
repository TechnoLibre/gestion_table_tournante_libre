// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

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
import { avertissementsApres, examenNomme, invariantViole } from './avertissements.js';
import { configurationDe } from './configuration.js';

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
