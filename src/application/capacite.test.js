// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du contrôle de capacité (§ 6.2, § 7.1, § 14.1) : la lecture d'un
// entier saisi, puis les refus d'une capacité — moins de deux places, sous
// les réservations, sièges retirés qui portent une saisie, sous l'occupation
// pour la poignée — et l'avertissement de lisibilité. Les noms d'épreuve sont
// inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { constante } from '../geometrie/constantes.js';
import { serialiser } from '../stockage/canonique.js';
import { SIEGES_MAX, analyser, creerCharge } from '../stockage/document.js';
import { controlerCapacite, lireEntier } from './capacite.js';
import { COMMANDES } from './commandes.js';
import { libelle } from './libelles.js';

const NOMS = ['Ombrelle', 'Pervenche', 'Lacasse', 'Grisaille', 'Bruyère', 'Sarcelle', 'Ancolie', 'Mélèze', 'Quenouille', 'Pivoine'];

const personne = (id, autres = {}) => ({
  id,
  nom: NOMS[(id - 1) % NOMS.length],
  prenom: null,
  appartenance: null,
  courriel: null,
  titrePressenti: null,
  notes: null,
  exclu: false,
  ...autres,
});

const resa = (participant, table, siege, tour = null) => ({ participant, table, siege, portee: tour === null ? 'tous' : 'tour', tour });

const afficherTour = (tour) => ({ geste: 'afficherTour', tour, proposition: null });

// Une charge d'une table d'identifiant 1, numéro 1, qui suit un défaut de
// huit places ; n personnes, R tours.
function chargeUneTable({ n = 8, tours = 3, attribuerSieges = false, reservations = [], titres = [], exclus = [] } = {}) {
  const charge = creerCharge({ id: 'evt-capacite', nom: 'Soirée des Merles', siegesParDefaut: 8, tours });
  charge.reglages.attribuerSieges = attribuerSieges;
  charge.participants = Array.from({ length: n }, (_, rang) => personne(rang + 1, { exclu: exclus.includes(rang + 1) }));
  charge.tables = [{ id: 1, numero: 1, sieges: null, forme: 'ronde', position: { x: 0, y: 0 } }];
  charge.reservations = reservations;
  charge.titres = titres;
  charge.prochainsIds = { participant: n + 1, table: 2, proposition: 1 };
  return charge;
}

// La proposition 1, retenue, dont la table 1 assied listes[r] au tour r + 1 ;
// les autres déclarés attendent en réserve.
function retenir(charge, listes, { siegesAttribues = charge.reglages.attribuerSieges } = {}) {
  const participants = charge.participants.filter(({ exclu }) => !exclu).map(({ id }) => id);
  const plan = {
    siegesAttribues,
    tables: [1],
    capacites: [8],
    tours: listes.length,
    participants,
    placement: listes.map((liste) => ({ sieges: [liste], reserve: participants.filter((id) => !liste.includes(id)) })),
  };
  charge.propositions = [{ id: 1, graine: 7, arret: 40, historique: 1000, produitVersion: 'essai', ...plan }];
  charge.retenu = { proposition: 1, ...structuredClone(plan) };
  charge.evenement.etat = 'retenu';
  charge.prochainsIds.proposition = 2;
  return charge;
}

const champ = (charge, sieges) => controlerCapacite(charge, 1, sieges, { origine: 'champ' });
const poignee = (charge, sieges) => controlerCapacite(charge, 1, sieges, { origine: 'poignee' });

describe("capacité : la lecture d'un entier saisi (§ 6.2)", () => {
  test('un entier sans signe ni décimale se lit ; tout autre texte refuse NON_ENTIER, remède null', () => {
    assert.deepEqual(lireEntier('2'), { valeur: 2 });
    assert.deepEqual(lireEntier('0'), { valeur: 0 });
    assert.deepEqual(lireEntier(' 12 '), { valeur: 12 });
    assert.deepEqual(lireEntier(9), { valeur: 9 });
    const refusees = ['-3', '2.5', '2,5', '8abc', 'huit', '', '+4', '1e3', '9007199254740993', -3, 2.5];
    assert.equal(refusees.length, 11);
    for (const saisie of refusees) {
      assert.deepEqual(lireEntier(saisie), { refus: { code: 'NON_ENTIER', details: { saisie, remede: null } } }, String(saisie));
    }
  });

  test("une saisie qui n'est ni un texte ni un nombre est une faute du code", () => {
    assert.throws(() => lireEntier(null), TypeError);
    assert.throws(() => lireEntier(undefined), TypeError);
  });
});

describe("capacité : les refus d'une capacité (§ 6.2)", () => {
  test('moins de deux places : MOINS_DE_DEUX, remède null ; deux places passent', () => {
    const charge = chargeUneTable();
    for (const sieges of [1, 0]) {
      assert.deepEqual(champ(charge, sieges).refus, { code: 'MOINS_DE_DEUX', details: { remede: null } });
    }
    assert.equal(champ(charge, 2).refus, null);
  });

  test('au-delà de SIEGES_MAX places : TROP_DE_PLACES {max}, remède null, au champ comme à la poignée ; SIEGES_MAX passe, et la charge se relit', () => {
    const charge = chargeUneTable();
    for (const sieges of [SIEGES_MAX + 1, 99_999_999_999, 2 ** 32]) {
      assert.deepEqual(champ(charge, sieges).refus, { code: 'TROP_DE_PLACES', details: { max: SIEGES_MAX, remede: null } });
      assert.deepEqual(poignee(charge, sieges).refus, { code: 'TROP_DE_PLACES', details: { max: SIEGES_MAX, remede: null } });
    }
    assert.equal(champ(charge, SIEGES_MAX).refus, null);
    const { charge: rendue } = COMMANDES.get('changerPlacesTable')(charge, { id: 1, sieges: String(SIEGES_MAX), origine: 'champ' });
    assert.doesNotThrow(() => analyser(serialiser(rendue, { revision: 1, produitVersion: 'essai' })));
  });

  test('sous les réservations : le plus grand compte de reservationsParTour, au premier tour qui l\'atteint', () => {
    const cinq = chargeUneTable({ reservations: [1, 2, 3, 4, 5].map((id) => resa(id, 1, null)) });
    assert.deepEqual(champ(cinq, 4).refus, {
      code: 'SOUS_RESERVATIONS',
      details: { table: 1, n: 5, tour: 1, remede: afficherTour(1) },
    });
    assert.equal(champ(cinq, 5).refus, null);

    // Trois réservations « tour », chacune à un tour différent : une à la fois.
    const parTour = chargeUneTable({ reservations: [resa(1, 1, null, 1), resa(2, 1, null, 2), resa(3, 1, null, 3)] });
    assert.equal(champ(parTour, 2).refus, null);
    // Deux au tour 3 : le premier tour qui atteint deux est le 3.
    parTour.reservations.push(resa(4, 1, null, 3));
    assert.deepEqual(champ(parTour, 1).refus.code, 'MOINS_DE_DEUX');
    parTour.reservations.push(resa(5, 1, null, 3));
    assert.deepEqual(champ(parTour, 2).refus, { code: 'SOUS_RESERVATIONS', details: { table: 1, n: 3, tour: 3, remede: afficherTour(3) } });

    // La réservation « tous » d'une personne exclue est suspendue : elle ne compte pas.
    const exclue = chargeUneTable({ reservations: [1, 2, 3, 4, 5].map((id) => resa(id, 1, null)), exclus: [5] });
    assert.equal(champ(exclue, 4).refus, null);
  });

  test('sièges retirés : réservation au siège 7 et titre au siège 8, listés par numéro décroissant, remède du premier', () => {
    const titre = { table: 1, siege: 8, libelle: 'animateur' };
    const charge = chargeUneTable({ attribuerSieges: true, reservations: [resa(1, 1, 7)], titres: [titre] });
    const reservee = { siege: 7, cause: 'SIEGE_RESERVE', participant: 1, suspendue: false };
    const titree = { siege: 8, cause: 'SIEGE_TITRE', libelle: 'animateur' };
    assert.deepEqual(champ(charge, 6).refus, {
      code: 'SIEGES_RETIRES',
      details: { table: 1, sieges: [titree, reservee], remede: { commande: 'retirerTitre', arguments: { table: 1, siege: 8 } } },
    });
    assert.deepEqual(champ(charge, 7).refus.details.sieges, [titree]);

    // Sans le titre : la réservation seule, et son remède s'exécute tel quel.
    const sansTitre = chargeUneTable({ attribuerSieges: true, reservations: [resa(1, 1, 7)] });
    const refus = champ(sansTitre, 6).refus;
    const remede = { commande: 'retirerReservation', arguments: { participant: 1, table: 1, portee: 'tous', tour: null } };
    assert.deepEqual(refus, { code: 'SIEGES_RETIRES', details: { table: 1, sieges: [reservee], remede } });
    const leve = COMMANDES.get(remede.commande)(sansTitre, remede.arguments);
    assert.equal(champ(leve.charge, 6).refus, null);

    // Une réservation « tour » : le remède porte sa portée et son tour, et
    // s'exécute tel quel.
    const duTour = chargeUneTable({ attribuerSieges: true, reservations: [resa(1, 1, 7, 2)] });
    const remedeDuTour = { commande: 'retirerReservation', arguments: { participant: 1, table: 1, portee: 'tour', tour: 2 } };
    assert.deepEqual(champ(duTour, 6).refus, { code: 'SIEGES_RETIRES', details: { table: 1, sieges: [reservee], remede: remedeDuTour } });
    const leveDuTour = COMMANDES.get(remedeDuTour.commande)(duTour, remedeDuTour.arguments);
    assert.deepEqual(leveDuTour.charge.reservations, []);
    assert.equal(champ(leveDuTour.charge, 6).refus, null);

    // La personne du siège 7 exclue : sa réservation suspendue reste listée.
    const suspendue = chargeUneTable({ attribuerSieges: true, reservations: [resa(1, 1, 7)], exclus: [1] });
    assert.deepEqual(champ(suspendue, 6).refus.details.sieges, [{ ...reservee, suspendue: true }]);

    // Sièges non attribués : la même liste, et le compte des titres.
    const enTable = chargeUneTable({ reservations: [resa(1, 1, 7)], titres: [titre] });
    assert.deepEqual(champ(enTable, 6).refus.details, {
      table: 1,
      sieges: [titree, reservee],
      titres: 1,
      remede: { commande: 'retirerTitre', arguments: { table: 1, siege: 8 } },
    });
  });

  test('deux titres à un même siège se listent par libellé ; le texte du refus les énonce dans cet ordre', () => {
    const titres = [{ table: 1, siege: 8, libelle: 'animateur' }, { table: 1, siege: 8, libelle: 'accueil' }];
    const charge = chargeUneTable({ attribuerSieges: true, reservations: [resa(1, 1, 7)], titres, exclus: [1] });
    const { refus } = champ(charge, 6);
    assert.deepEqual(refus.details.sieges.map(({ siege, libelle: texte }) => [siege, texte ?? null]), [[8, 'accueil'], [8, 'animateur'], [7, null]]);
    assert.equal(
      libelle(refus.code, refus.details),
      'Réduire la table retire des sièges qui portent une saisie : le siège 8 porte le titre « accueil », ' +
        'le siège 8 porte le titre « animateur » et le siège 7 est réservé, par une réservation suspendue.',
    );
    const enTable = chargeUneTable({ reservations: [resa(1, 1, 7)], titres });
    const refusEnTable = champ(enTable, 6).refus;
    assert.equal(refusEnTable.details.titres, 2);
    assert.equal(
      libelle(refusEnTable.code, refusEnTable.details),
      'Réduire la table retire des sièges qui portent une saisie : le siège 7 est réservé et 2 sièges portent un titre.',
    );
  });

  test('chaque refus et chaque avertissement de capacité se dit en français, ses nombres compris', () => {
    const cinq = chargeUneTable({ reservations: [1, 2, 3, 4, 5].map((id) => resa(id, 1, null)) });
    const textes = [
      libelle('MOINS_DE_DEUX', champ(cinq, 1).refus.details),
      libelle('SOUS_RESERVATIONS', champ(cinq, 4).refus.details),
      libelle('NON_ENTIER', lireEntier('8abc').refus.details),
      libelle('NON_ENTIER', lireEntier('').refus.details),
      libelle('AU_DELA_LISIBLE', { seuil: 16 }),
      libelle('SOUS_OCCUPES', { table: 1, n: 7, tour: 3 }),
      libelle('SURNUMERAIRES', { table: 1, tour: 2, personnes: [4] }),
      libelle('SURNUMERAIRES', { table: 1, tour: 2, personnes: [4, 5] }),
      libelle('MOINS_D_UN_TOUR', { tours: 0 }),
    ];
    assert.deepEqual(textes, [
      'Une table compte au moins 2 places : seule à sa table, une personne ne rencontrerait personne.',
      'La table porte 5 réservations au tour 1 : elle ne descend pas sous 5 places.',
      '« 8abc » n\'est pas un nombre entier : un nombre entier, sans signe ni décimale, est attendu.',
      'La saisie est vide : un nombre entier, sans signe ni décimale, est attendu.',
      "Au-delà de 16 places, la liste des noms de la table cesse d'être lisible sur le plan.",
      'Au tour 3, la table occupe 7 places : la poignée ne descend pas en deçà.',
      "Au tour 2, 1 personne passe dans la réserve : la table n'a plus de chaise pour elle.",
      "Au tour 2, 2 personnes passent dans la réserve : la table n'a plus de chaise pour elles.",
      'Une soirée compte au moins un tour.',
    ]);
  });

  test("sièges retirés : la charge réduite sans ce refus, suspendue ou en mode table, est celle que l'analyse refuse", () => {
    for (const charge of [
      chargeUneTable({ attribuerSieges: true, reservations: [resa(1, 1, 7)], exclus: [1] }),
      chargeUneTable({ reservations: [resa(1, 1, 7)] }),
    ]) {
      assert.equal(champ(charge, 6).refus.code, 'SIEGES_RETIRES');
      const reduite = structuredClone(charge);
      reduite.tables[0].sieges = 6;
      assert.throws(
        () => analyser(serialiser(reduite, { revision: 1, produitVersion: 'essai' })),
        (erreur) => erreur.code === 'ETAT_ILLISIBLE' && erreur.details.raison === 'REFERENCE',
      );
    }
  });

  test('une table inconnue, ou une capacité qui n\'est pas un entier, est une faute du code', () => {
    const charge = chargeUneTable();
    assert.throws(() => controlerCapacite(charge, 9, 6, { origine: 'champ' }), TypeError);
    assert.throws(() => controlerCapacite(charge, 1, '6', { origine: 'champ' }), TypeError);
    assert.throws(() => controlerCapacite(charge, 1, 6, { origine: 'clavier' }), TypeError);
  });
});

describe("capacité : la poignée, sous l'occupation de tous les tours (§ 7.1)", () => {
  test('sièges non attribués : 5, 5, 7 et 5 personnes aux tours 1 à 4 ; 6 refuse SOUS_OCCUPES {n: 7, tour: 3}', () => {
    const cinq = [1, 2, 3, 4, 5];
    const charge = retenir(chargeUneTable({ n: 7, tours: 4 }), [cinq, cinq, [1, 2, 3, 4, 5, 6, 7], cinq]);
    assert.deepEqual(poignee(charge, 6).refus, {
      code: 'SOUS_OCCUPES',
      details: { table: 1, n: 7, tour: 3, remede: afficherTour(3) },
    });
    assert.equal(poignee(charge, 7).refus, null);
    // Le champ, lui, accepte et avertit.
    assert.equal(champ(charge, 6).refus, null);
    assert.deepEqual(poignee(charge, 1).refus, { code: 'MOINS_DE_DEUX', details: { remede: null } });
  });

  test("sièges attribués : huit occupants au tour 3 refusent 7 ; une réservation ou un titre au siège 8 refusent SIEGES_RETIRES d'abord", () => {
    const cinq = [1, 2, 3, 4, 5];
    const huit = retenir(chargeUneTable({ n: 8, attribuerSieges: true }), [cinq, cinq, [1, 2, 3, 4, 5, 6, 7, 8]]);
    assert.deepEqual(poignee(huit, 7).refus, { code: 'SOUS_OCCUPES', details: { table: 1, n: 8, tour: 3, remede: afficherTour(3) } });

    const assise = [1, 2, 3, 4, 5, null, null, 6];
    const reservee = retenir(chargeUneTable({ n: 6, attribuerSieges: true, reservations: [resa(6, 1, 8)] }), [assise, assise, assise]);
    const refus = poignee(reservee, 7).refus;
    assert.equal(refus.code, 'SIEGES_RETIRES');
    assert.deepEqual(refus.details.sieges, [{ siege: 8, cause: 'SIEGE_RESERVE', participant: 6, suspendue: false }]);

    const titree = retenir(chargeUneTable({ n: 5, attribuerSieges: true, titres: [{ table: 1, siege: 8, libelle: 'accueil' }] }), [cinq, cinq, cinq]);
    assert.deepEqual(poignee(titree, 7).refus.details.sieges, [{ siege: 8, cause: 'SIEGE_TITRE', libelle: 'accueil' }]);

    // Six occupants, deux chaises vides avant le sixième, aucune saisie : le
    // plus haut numéro occupé, 8, compte plus que les six occupants.
    const creuse = retenir(chargeUneTable({ n: 6, attribuerSieges: true }), [assise, assise, assise]);
    assert.deepEqual(poignee(creuse, 7).refus, { code: 'SOUS_OCCUPES', details: { table: 1, n: 8, tour: 1, remede: afficherTour(1) } });
  });

  test("la poignée ne reçoit aucun tour affiché : l'occupation se lit à chaque tour du retenu", () => {
    const cinq = [1, 2, 3, 4, 5];
    const charge = retenir(chargeUneTable({ n: 7, tours: 4 }), [cinq, cinq, cinq, [1, 2, 3, 4, 5, 6, 7]]);
    assert.deepEqual(poignee(charge, 6).refus.details, { table: 1, n: 7, tour: 4, remede: afficherTour(4) });
  });
});

describe('capacité : la lisibilité (§ 6.2, § 14.1)', () => {
  test('S + 1 places avertissent AU_DELA_LISIBLE {seuil: S} ; S places, non', () => {
    const seuil = constante('SEUIL_SIEGES_LISIBLES');
    assert.ok(Number.isInteger(seuil) && seuil > 2);
    const charge = chargeUneTable();
    for (const origine of ['champ', 'poignee']) {
      const au = controlerCapacite(charge, 1, seuil + 1, { origine });
      assert.equal(au.refus, null);
      assert.deepEqual(au.avertissements, [{ code: 'AU_DELA_LISIBLE', details: { seuil } }]);
      assert.deepEqual(controlerCapacite(charge, 1, seuil, { origine }).avertissements, []);
    }
  });
});

// La charge où chaque personne de presences ({id: liste}) porte cette
// présence.
function avecPresences(charge, presences) {
  for (const personne of charge.participants) if (Object.hasOwn(presences, personne.id)) personne.presence = presences[personne.id];
  return charge;
}

describe('capacité : la présence par tour (§ 5.8, § 6.2)', () => {
  test('sous les réservations : une réservation à un tour d’absence ne compte pas', () => {
    const reservations = [...[1, 2, 3, 4, 5, 6].map((id) => resa(id, 1, null)), resa(7, 1, null, 2), resa(8, 1, null, 2)];
    const presentes = chargeUneTable({ tours: 2, reservations });
    assert.deepEqual(champ(presentes, 6).refus, { code: 'SOUS_RESERVATIONS', details: { table: 1, n: 8, tour: 2, remede: afficherTour(2) } });
    const absentes = avecPresences(chargeUneTable({ tours: 2, reservations }), { 1: [1], 2: [1] });
    assert.equal(champ(absentes, 6).refus, null);
    assert.deepEqual(champ(absentes, 5).refus, { code: 'SOUS_RESERVATIONS', details: { table: 1, n: 6, tour: 1, remede: afficherTour(1) } });
  });

  test("la poignée : une personne absente au tour 3, que le retenu y assied encore, n'occupe pas de chaise", () => {
    const cinq = [1, 2, 3, 4, 5];
    const charge = avecPresences(retenir(chargeUneTable({ n: 7, tours: 4 }), [cinq, cinq, [1, 2, 3, 4, 5, 6, 7], cinq]), { 7: [1, 2, 4] });
    assert.equal(poignee(charge, 6).refus, null);
    assert.deepEqual(poignee(charge, 5).refus, { code: 'SOUS_OCCUPES', details: { table: 1, n: 6, tour: 3, remede: afficherTour(3) } });
  });

  test('le champ : une absente que le retenu assied encore part sans être annoncée ; sa chaise reçoit, sièges attribués, la personne réservée que la baisse déplace', () => {
    const huit = [1, 2, 3, 4, 5, 6, 7, 8];
    const libres = avecPresences(retenir(chargeUneTable({ tours: 2 }), [huit, huit]), { 8: [1] });
    assert.deepEqual(champ(libres, 7).avertissements, [{ code: 'SURNUMERAIRES', details: { table: 1, tour: 1, personnes: [8] } }]);

    const cinq = [1, 2, 3, 4, 5];
    const attribues = avecPresences(
      retenir(chargeUneTable({ n: 5, tours: 2, attribuerSieges: true, reservations: [resa(5, 1, null)] }), [cinq, cinq]),
      { 2: [2] },
    );
    assert.deepEqual(champ(attribues, 4).avertissements, [{ code: 'SURNUMERAIRES', details: { table: 1, tour: 2, personnes: [4] } }]);
  });

  test('le champ, sièges attribués : la réservation au siège 2 d’une absente au tour 2 ne retient pas sa chaise à ce tour, et ne déplace personne', () => {
    const cinq = [1, 2, 3, 4, 5];
    const charge = avecPresences(
      retenir(chargeUneTable({ n: 5, tours: 2, attribuerSieges: true, reservations: [resa(5, 1, 2)] }), [cinq, cinq]),
      { 5: [1] },
    );
    assert.deepEqual(champ(charge, 4).avertissements, [{ code: 'SURNUMERAIRES', details: { table: 1, tour: 1, personnes: [4] } }]);
  });
});
