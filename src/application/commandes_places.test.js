// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves des commandes des places (§ 4, § 4.1, § 5.8, § 5.9, § 7.1, § 8.2,
// § 8.9, § 9, § 14.12) : réservations, titres, désignation, conversion,
// retouches du retenu et leur vérificateur d'invariants, rangement par siège
// d'une génération. Les noms d'épreuve sont inventés ; la version vient du
// module engendré.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { FLUX, creerPcg32 } from '../demo/prng.js';
import { normaliser } from '../moteur/configuration.js';
import { rechercher } from '../moteur/recherche.js';
import { serialiser } from '../stockage/canonique.js';
import { analyser, configurationDepuisCharge, creerCharge } from '../stockage/document.js';
import { gelerPropositions } from '../stockage/gel.js';
import { ajusterALaPresence, derive, fautes } from '../stockage/placements.js';
import { VERSION } from '../version.genere.js';
import { avertissementsApres } from './avertissements.js';
import { COMMANDES, appliquerCommande } from './commandes.js';
import { COMMANDES_PLACES } from './commandes_places.js';
import { ErreurCommande } from './erreurs.js';
import { libelle } from './libelles.js';
import { TABLE as TEXTES_DES_PLACES } from './libelles/places.js';
import { conversionsPossibles } from './listes_travail.js';
import { etatPlaces } from './places.js';

const executer = (nom, charge, args) => COMMANDES.get(nom)(charge, args);

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
  ['Aubépine', 'Colombe'],
  ['Lavande', 'Ysolde'],
  ['Zéphyrin', 'Lucioles'],
];

const personne = (id, autres = {}) => ({
  id,
  nom: NOMS[(id - 1) % NOMS.length][0],
  prenom: NOMS[(id - 1) % NOMS.length][1],
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

// Le refus d'une ErreurCommande levée par appel, de ce code ; ses détails
// contiennent ceux donnés.
function refuse(appel, code, attendus = {}) {
  let leve = null;
  try {
    appel();
  } catch (erreur) {
    leve = erreur;
  }
  assert.ok(leve instanceof ErreurCommande, `ErreurCommande ${code} attendue, reçu ${leve}`);
  assert.equal(leve.code, code, leve.message);
  for (const [cle, valeur] of Object.entries(attendus)) assert.deepEqual(leve.details[cle], valeur, cle);
  return leve;
}

// Gèle une valeur en profondeur : une commande qui la modifierait lèverait.
function figer(valeur) {
  if (valeur !== null && typeof valeur === 'object' && !Object.isFrozen(valeur)) {
    Object.freeze(valeur);
    for (const element of Object.values(valeur)) figer(element);
  }
  return valeur;
}

// La commande nom sur une copie de charge aux propositions figées : la charge
// rendue garde chaque proposition reçue, même objet au même rang, dans une
// liste neuve, et la charge reçue s'écrit comme avant.
function partageLesPropositions(nom, charge, args) {
  const recue = gelerPropositions(structuredClone(charge));
  const texte = JSON.stringify(recue);
  const { charge: rendue } = executer(nom, recue, args);
  assert.notEqual(rendue.propositions, recue.propositions, nom);
  assert.equal(rendue.propositions.length, recue.propositions.length, nom);
  recue.propositions.forEach((p, rang) => assert.equal(rendue.propositions[rang], p, `${nom} : proposition ${p.id} recopiée`));
  assert.equal(JSON.stringify(recue), texte, nom);
}

// Un plan de fichier ; la réserve de chaque tour porte les déclarés qu'aucune
// liste n'assied.
function planFichier({ tables, capacites, participants, tours, siegesAttribues }) {
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

const DOUZE = Array.from({ length: 12 }, (_, rang) => rang + 1);

// Douze personnes, trois tours, les tables numérotées 4 et 7 d'identifiants
// 5 et 8, de huit places ; la proposition 1, retenue, que tours donne.
function chargeRetenue({ siegesAttribues = true, tours, capacite = 8, reservations = [] } = {}) {
  const charge = creerCharge({ id: 'evt-retenu', nom: 'Soirée des Lucioles', siegesParDefaut: capacite, tours: 3 });
  charge.reglages.attribuerSieges = siegesAttribues;
  charge.participants = DOUZE.map((id) => personne(id));
  charge.tables = [
    { id: 5, numero: 4, sieges: null, forme: 'ronde', position: { x: 0, y: 0 } },
    { id: 8, numero: 7, sieges: null, forme: 'carree', position: { x: 400, y: 0 } },
  ];
  charge.reservations = reservations;
  const plan = planFichier({
    tables: [5, 8],
    capacites: [capacite, capacite],
    participants: DOUZE,
    siegesAttribues,
    tours: tours ?? [
      [[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]],
      [[1, 8, 9, 10, 11, 12], [7, 2, 3, 4, 5, 6]],
      [[1, 2, 3, 7, 8, 9], [4, 5, 6, 10, 11, 12]],
    ],
  });
  charge.propositions = [{ id: 1, graine: 48272, arret: 200000, historique: 1000, produitVersion: VERSION.affichee, ...plan }];
  charge.retenu = { proposition: 1, ...structuredClone(plan) };
  charge.evenement.etat = 'retenu';
  charge.prochainsIds = { participant: 13, table: 9, proposition: 2 };
  return charge;
}

const listes = (charge, tour) => charge.retenu.placement[tour - 1].sieges;
const reserveDe = (charge, tour) => charge.retenu.placement[tour - 1].reserve;

describe('commandes des places : le registre (§ 8.2)', () => {
  test('COMMANDES_PLACES porte les douze commandes des places, réunies dans COMMANDES', () => {
    assert.deepEqual([...COMMANDES_PLACES.keys()].sort(), [
      'convertirEnTous',
      'deplacerDansRetenu',
      'deplacerReservation',
      'designer',
      'designerAnimateurs',
      'echangerDansRetenu',
      'poserTitre',
      'reserver',
      'retirerAnimateur',
      'retirerDuTour',
      'retirerReservation',
      'retirerTitre',
    ]);
    for (const [nom, commande] of COMMANDES_PLACES) assert.equal(COMMANDES.get(nom), commande);
  });

  test('un plan bloqué refuse chaque commande des places, remède débloquer', () => {
    const charge = chargeRetenue();
    charge.evenement.etat = 'bloque';
    const essais = [
      ['reserver', { participant: 1, table: 5, siege: 1, portee: 'tous', tour: null }],
      ['retirerReservation', { participant: 1, table: 5, portee: 'tous', tour: null }],
      ['deplacerReservation', { participant: 1, de: { table: 5, portee: 'tous', tour: null }, vers: { table: 8, siege: 1 } }],
      ['poserTitre', { table: 5, siege: 1, libelle: 'animation' }],
      ['retirerTitre', { table: 5, siege: 1 }],
      ['designer', { participant: 1, table: 5, siege: 1, libelle: 'animation' }],
      ['designerAnimateurs', { table: 5, participants: [1, 2], libelle: 'animation' }],
      ['retirerAnimateur', { table: 5, participant: 1 }],
      ['convertirEnTous', { participant: 1, table: 5 }],
      ['deplacerDansRetenu', { tour: 1, participant: 1, table: 8, siege: 7 }],
      ['echangerDansRetenu', { tour: 1, a: 1, b: 7 }],
      ['retirerDuTour', { tour: 1, participant: 1 }],
    ];
    assert.equal(essais.length, COMMANDES_PLACES.size);
    for (const [nom, args] of essais) refuse(() => executer(nom, charge, args), 'PLAN_BLOQUE', { remede: { geste: 'debloquer' } });
  });

  test('sur une charge aux propositions figées, chaque commande des places les partage sans les écrire', () => {
    const charge = chargeRetenue({ reservations: [resa(3, 5, 3), resa(10, 8, 2), ...[1, 2, 3].map((tour) => resa(9, 8, null, tour))] });
    charge.titres = [{ table: 8, siege: 2, libelle: 'accueil' }];
    const essais = [
      ['reserver', { participant: 1, table: 5, siege: 1, portee: 'tous', tour: null }],
      ['retirerReservation', { participant: 3, table: 5, portee: 'tous', tour: null }],
      ['deplacerReservation', { participant: 3, de: { table: 5, portee: 'tous', tour: null }, vers: { table: 8, siege: null } }],
      ['poserTitre', { table: 5, siege: 1, libelle: 'animation' }],
      ['retirerTitre', { table: 8, siege: 2 }],
      ['designer', { participant: 1, table: 5, siege: 1, libelle: 'animation' }],
      ['designerAnimateurs', { table: 5, participants: [1, 2], libelle: 'animation' }],
      ['retirerAnimateur', { table: 8, participant: 10 }],
      ['convertirEnTous', { participant: 9, table: 8 }],
      ['deplacerDansRetenu', { tour: 1, participant: 1, table: 8, siege: 7 }],
      ['echangerDansRetenu', { tour: 1, a: 1, b: 7 }],
      ['retirerDuTour', { tour: 1, participant: 1 }],
    ];
    assert.equal(essais.length, COMMANDES_PLACES.size);
    for (const [nom, args] of essais) partageLesPropositions(nom, charge, args);
  });
});

describe('commandes des places : réservations et libellés figés (§ 5.9, § 8.2)', () => {
  test('reserver : la réservation, et le libellé qui nomme la personne et le numéro de la table', () => {
    const charge = chargeRetenue();
    const { charge: apres, libelle, avertissements } = executer('reserver', charge, {
      participant: 2,
      table: 5,
      siege: 2,
      portee: 'tour',
      tour: 2,
    });
    assert.equal(libelle, 'Réservé Théo Pervenche à la table 4, siège 2, tour 2');
    assert.deepEqual(apres.reservations, [resa(2, 5, 2, 2)]);
    assert.deepEqual(avertissements, []);
    assert.equal(
      executer('reserver', charge, { participant: 4, table: 8, siege: null, portee: 'tous', tour: null }).libelle,
      'Réservé Grisaille à la table 7, tous les tours',
    );
  });

  test('reserver une réservation qui existe déjà : SANS_EFFET ; une table gelée avertit', () => {
    const charge = chargeRetenue({ capacite: 2, tours: [[[1, 2], [3, 4]], [[1, 3], [2, 4]], [[1, 4], [2, 3]]] });
    const une = executer('reserver', charge, { participant: 1, table: 5, siege: null, portee: 'tous', tour: null }).charge;
    refuse(() => executer('reserver', une, { participant: 1, table: 5, siege: null, portee: 'tous', tour: null }), 'SANS_EFFET', {
      commande: 'reserver',
    });
    const { avertissements } = executer('reserver', une, { participant: 2, table: 5, siege: null, portee: 'tous', tour: null });
    assert.deepEqual(avertissements, [{ code: 'TABLE_GELEE', details: { table: 5 } }]);
  });

  test('retirer, déplacer : la réservation désignée par sa table et sa portée ; une réservation absente est refusée', () => {
    const charge = chargeRetenue({ reservations: [resa(1, 5, 1), resa(2, 8, 2, 2)] });
    const retiree = executer('retirerReservation', charge, { participant: 2, table: 8, portee: 'tour', tour: 2 });
    assert.deepEqual(retiree.charge.reservations, [resa(1, 5, 1)]);
    assert.equal(retiree.libelle, 'Réservation retirée : Théo Pervenche, table 7, tour 2');
    refuse(() => executer('retirerReservation', charge, { participant: 2, table: 8, portee: 'tous', tour: null }), 'RESERVATION_ABSENTE', {
      participant: 2,
      remede: null,
    });
    const deplacee = executer('deplacerReservation', charge, {
      participant: 1,
      de: { table: 5, portee: 'tous', tour: null },
      vers: { table: 8, siege: 3 },
    });
    assert.deepEqual(deplacee.charge.reservations, [resa(1, 8, 3), resa(2, 8, 2, 2)]);
    assert.equal(deplacee.libelle, 'Réservation déplacée : Iris Ombrelle, de la table 4 à la table 7, siège 3, tous les tours');
    refuse(
      () => executer('deplacerReservation', charge, { participant: 1, de: { table: 5, portee: 'tous', tour: null }, vers: { table: 8, siege: 2 } }),
      'PLACE_RESERVEE',
      { titulaire: 2 },
    );
  });
});

describe('commandes des places : titres et désignation (§ 4, § 4.1, § 2.1 étape 6)', () => {
  // Deux tables, l'une de 2 places, trois tours, sans retenu.
  function chargeTitres(attribuerSieges = false) {
    const charge = creerCharge({ id: 'evt-titres', nom: 'Soirée des Lucioles', siegesParDefaut: 6, tours: 3 });
    charge.reglages.attribuerSieges = attribuerSieges;
    charge.participants = [1, 2, 3, 4].map((id) => personne(id));
    charge.tables = [
      { id: 1, numero: 1, sieges: 2, forme: 'ronde', position: { x: 0, y: 0 } },
      { id: 3, numero: 3, sieges: null, forme: 'ronde', position: { x: 400, y: 0 } },
    ];
    charge.prochainsIds = { participant: 5, table: 4, proposition: 1 };
    return charge;
  }

  test('désigner Iris à la table 3 : une réservation « tous » et un titre au même siège, une entrée', () => {
    const { charge, libelle } = executer('designer', chargeTitres(true), { participant: 1, table: 3, siege: 2, libelle: 'animatrice' });
    assert.deepEqual(charge.reservations, [resa(1, 3, 2)]);
    assert.deepEqual(charge.titres, [{ table: 3, siege: 2, libelle: 'animatrice' }]);
    assert.equal(libelle, 'Désigné Iris Ombrelle à la table 3, siège 2 : « animatrice »');
  });

  test('un titre non pourvu déjà posé à cette place est pourvu, aucun second', () => {
    const titree = executer('poserTitre', chargeTitres(), { table: 3, siege: 4, libelle: 'hôte' }).charge;
    const { charge } = executer('designer', titree, { participant: 2, table: 3, siege: null, libelle: 'animateur' });
    assert.deepEqual(charge.titres, [{ table: 3, siege: 4, libelle: 'hôte' }]);
    assert.deepEqual(charge.reservations, [resa(2, 3, 4)]);
    const deuxieme = executer('designer', charge, { participant: 3, table: 3, siege: null, libelle: 'veille' }).charge;
    assert.deepEqual(deuxieme.titres, [{ table: 3, siege: 4, libelle: 'hôte' }, { table: 3, siege: 1, libelle: 'veille' }]);
    assert.deepEqual(deuxieme.reservations.at(-1), resa(3, 3, 1));
  });

  test('poserTitre : vide refusé LIBELLE_VIDE sans écriture ; NFC sans blancs de bord ; place titrée PLACE_TITREE', () => {
    const charge = figer(chargeTitres(true));
    for (const libelle of ['', '  ']) {
      refuse(() => executer('poserTitre', charge, { table: 3, siege: 1, libelle }), 'LIBELLE_VIDE', { remede: null });
      refuse(() => executer('designer', charge, { participant: 1, table: 3, siege: 1, libelle }), 'LIBELLE_VIDE', { remede: null });
    }
    const nfd = '  Ho\u{0302}tesse\u{00A0}';
    const { charge: titree, libelle } = executer('poserTitre', charge, { table: 3, siege: 1, libelle: nfd });
    assert.deepEqual(titree.titres, [{ table: 3, siege: 1, libelle: 'H\u{00F4}tesse' }]);
    assert.equal(libelle, 'Posé le titre « H\u{00F4}tesse » à la table 3, siège 1');
    refuse(() => executer('poserTitre', titree, { table: 3, siege: 1, libelle: 'hôte' }), 'PLACE_TITREE', {
      table: 3,
      siege: 1,
      libelle: 'H\u{00F4}tesse',
      remede: { commande: 'retirerTitre', arguments: { table: 3, siege: 1 } },
    });
    refuse(() => executer('poserTitre', titree, { table: 3, siege: 7, libelle: 'hôte' }), 'SIEGE_INEXISTANT', { siege: 7, capacite: 6 });
    const retire = executer('retirerTitre', titree, { table: 3, siege: 1 });
    assert.deepEqual(retire.charge.titres, []);
    assert.equal(retire.libelle, 'Retiré le titre « H\u{00F4}tesse » de la table 3, siège 1');
    refuse(() => executer('retirerTitre', retire.charge, { table: 3, siege: 1 }), 'TITRE_ABSENT', { remede: null });
  });

  test('mode table : un titre sans siège prend le plus petit sans titre ; une table de 2 aux deux sièges titrés refuse AUCUN_SIEGE_SANS_TITRE', () => {
    let charge = chargeTitres();
    charge = executer('poserTitre', charge, { table: 1, siege: 2, libelle: 'accueil' }).charge;
    charge = executer('poserTitre', charge, { table: 1, siege: null, libelle: 'animation' }).charge;
    assert.deepEqual(charge.titres.at(-1), { table: 1, siege: 1, libelle: 'animation' });
    refuse(() => executer('poserTitre', charge, { table: 1, siege: null, libelle: 'veille' }), 'AUCUN_SIEGE_SANS_TITRE', {
      table: 1,
      capacite: 2,
      remede: { commande: 'changerPlacesTable', arguments: { id: 1, sieges: 3, origine: 'champ' } },
    });
  });

  test('convertirEnTous : refusé sans les R réservations « tour » à une table ; libellé', () => {
    let charge = chargeTitres();
    refuse(() => executer('convertirEnTous', charge, { participant: 1, table: 3 }), 'CONVERSION_IMPOSSIBLE', { remede: null });
    for (const tour of [1, 2, 3]) charge = executer('reserver', charge, { participant: 1, table: 3, siege: 5, portee: 'tour', tour }).charge;
    const { charge: convertie, libelle } = executer('convertirEnTous', charge, { participant: 1, table: 3 });
    assert.deepEqual(convertie.reservations, [resa(1, 3, 5)]);
    assert.equal(libelle, 'Converti en « tous les tours » : Iris Ombrelle, table 3');
  });
});

describe('commandes des places : animateurs en lot et retrait (§ 2.1 étape 6, § 5.8)', () => {
  // L'en-tête du texte canonique qui compare deux charges.
  const ESSAI = { revision: 1, produitVersion: 'essai' };

  // Six personnes, trois tours, sans retenu : la table numérotée 5
  // d'identifiant 2, de trois places, et la table numérotée 3 d'identifiant
  // 4, de quatre ; Anouk est exclue.
  function chargeAnimation({ attribuerSieges = false } = {}) {
    const charge = creerCharge({ id: 'evt-animation', nom: 'Soirée des Lucioles', siegesParDefaut: 4, tours: 3 });
    charge.reglages.attribuerSieges = attribuerSieges;
    charge.participants = [1, 2, 3, 4, 5, 6].map((id) => personne(id, id === 5 ? { exclu: true } : {}));
    charge.tables = [
      { id: 2, numero: 5, sieges: 3, forme: 'ronde', position: { x: 0, y: 0 } },
      { id: 4, numero: 3, sieges: null, forme: 'ronde', position: { x: 400, y: 0 } },
    ];
    charge.prochainsIds = { participant: 7, table: 5, proposition: 1 };
    return charge;
  }

  test('lot de 1 : une réservation « tous les tours » et un titre, une entrée au singulier', () => {
    const charge = figer(chargeAnimation());
    const { charge: apres, libelle, avertissements } = executer('designerAnimateurs', charge, {
      table: 2,
      participants: [1],
      libelle: 'animateur',
    });
    assert.deepEqual(apres.reservations, [resa(1, 2, 1)]);
    assert.deepEqual(apres.titres, [{ table: 2, siege: 1, libelle: 'animateur' }]);
    assert.equal(libelle, 'Désigné 1 animateur à la table 5 : Iris Ombrelle');
    assert.deepEqual(avertissements, []);
  });

  test('lot de 3 : designer pour chacune dans l’ordre reçu, une seule entrée qui les nomme ; k_t = c_t signalé une fois', () => {
    const charge = figer(chargeAnimation());
    const { charge: apres, libelle, avertissements } = executer('designerAnimateurs', charge, {
      table: 2,
      participants: [3, 1, 2],
      libelle: '  Animation ',
    });
    let attendue = charge;
    for (const participant of [3, 1, 2]) {
      attendue = executer('designer', attendue, { participant, table: 2, siege: null, libelle: 'Animation' }).charge;
    }
    assert.equal(serialiser(apres, ESSAI), serialiser(attendue, ESSAI));
    assert.deepEqual(apres.reservations, [resa(3, 2, 1), resa(1, 2, 2), resa(2, 2, 3)]);
    assert.deepEqual(
      apres.titres.map(({ siege, libelle: texte }) => [siege, texte]),
      [
        [1, 'Animation'],
        [2, 'Animation'],
        [3, 'Animation'],
      ],
    );
    assert.equal(libelle, 'Désigné 3 animateurs à la table 5 : Ondine Lacasse, Iris Ombrelle, Théo Pervenche');
    assert.deepEqual(avertissements, [{ code: 'TABLE_GELEE', details: { table: 2 } }]);
  });

  test('un titre non pourvu posé avant reste non pourvu : chacune reçoit son propre titre, au plus petit siège sans titre', () => {
    const charge = figer(executer('poserTitre', chargeAnimation(), { table: 4, siege: 1, libelle: 'hôte' }).charge);
    const { charge: apres, libelle: texte } = executer('designerAnimateurs', charge, { table: 4, participants: [1, 2], libelle: 'animateur' });
    assert.deepEqual(apres.titres, [
      { table: 4, siege: 1, libelle: 'hôte' },
      { table: 4, siege: 2, libelle: 'animateur' },
      { table: 4, siege: 3, libelle: 'animateur' },
    ]);
    assert.deepEqual(apres.reservations, [resa(1, 4, 2), resa(2, 4, 3)]);
    assert.equal(texte, 'Désigné 2 animateurs à la table 3 : Iris Ombrelle, Théo Pervenche');
  });

  test('quand chaque siège porte déjà un titre, la règle de designer demeure : le titre non pourvu est pourvu, sans second titre', () => {
    const titres = [
      { table: 2, siege: 1, libelle: 'veille' },
      { table: 2, siege: 2, libelle: 'hôte' },
      { table: 2, siege: 3, libelle: 'relève' },
    ];
    const charge = figer({ ...chargeAnimation(), reservations: [resa(3, 2, 1)], titres });
    const { charge: apres } = executer('designerAnimateurs', charge, { table: 2, participants: [1], libelle: 'animateur' });
    assert.deepEqual(apres.titres, titres);
    assert.deepEqual(apres.reservations, [resa(3, 2, 1), resa(1, 2, 2)]);
  });

  test('un siège sans titre que tient la réservation d’une autre personne est passé : la personne du lot reçoit le suivant, avec son titre', () => {
    // Iris tient le siège 1 de la table 5, à la main, sans titre : pour la
    // soirée, puis pour le seul tour 2 ; dans les deux modes de sièges.
    for (const attribuerSieges of [false, true]) {
      for (const tenue of [resa(1, 2, 1), resa(1, 2, 1, 2)]) {
        const charge = figer({ ...chargeAnimation({ attribuerSieges }), reservations: [tenue] });
        const { charge: apres } = executer('designerAnimateurs', charge, { table: 2, participants: [2], libelle: 'animateur' });
        assert.deepEqual(apres.reservations, [tenue, resa(2, 2, 2)]);
        assert.deepEqual(apres.titres, [{ table: 2, siege: 2, libelle: 'animateur' }]);
      }
    }
    // La réservation d'une personne exclue ne tient aucun siège.
    const exclue = figer({ ...chargeAnimation(), reservations: [resa(5, 2, 1)] });
    const { charge: libre } = executer('designerAnimateurs', exclue, { table: 2, participants: [2], libelle: 'animateur' });
    assert.deepEqual(libre.titres, [{ table: 2, siege: 1, libelle: 'animateur' }]);
    // La réservation de la personne du lot elle-même ne l'écarte pas de son
    // siège : Théo, qui tient le siège 1, y reçoit le titre.
    const sienne = figer({ ...chargeAnimation(), reservations: [resa(2, 2, 1)] });
    const { charge: titree } = executer('designerAnimateurs', sienne, { table: 2, participants: [2], libelle: 'animateur' });
    assert.deepEqual(titree.reservations, [resa(2, 2, 1)]);
    assert.deepEqual(titree.titres, [{ table: 2, siege: 1, libelle: 'animateur' }]);
    // Son propre siège passe avant le plus petit siège libre : Théo, au
    // siège 2, y reçoit son titre, et Iris prend le siège 1.
    const deuxieme = figer({ ...chargeAnimation(), reservations: [resa(2, 2, 2)] });
    const { charge: chacun } = executer('designerAnimateurs', deuxieme, { table: 2, participants: [2, 1], libelle: 'animateur' });
    assert.deepEqual(chacun.reservations, [resa(2, 2, 2), resa(1, 2, 1)]);
    assert.deepEqual(chacun.titres, [
      { table: 2, siege: 2, libelle: 'animateur' },
      { table: 2, siege: 1, libelle: 'animateur' },
    ]);
    // Une réservation suspendue ne tient pas son siège : Iris, réservée au
    // siège 1 pour le seul tour 2 où elle est absente, ne l'écarte pas, et le
    // titre non pourvu du siège 2 reste non pourvu.
    const suspendue = chargeAnimation();
    suspendue.participants[0] = personne(1, { presence: [1, 3] });
    const avecVeille = figer({ ...suspendue, reservations: [resa(1, 2, 1, 2)], titres: [{ table: 2, siege: 2, libelle: 'veille' }] });
    const { charge: libreAuTour } = executer('designerAnimateurs', avecVeille, { table: 2, participants: [2], libelle: 'animateur' });
    assert.deepEqual(libreAuTour.titres, [
      { table: 2, siege: 2, libelle: 'veille' },
      { table: 2, siege: 1, libelle: 'animateur' },
    ]);
    // Chaque siège sans titre tenu : la règle de designer choisit, et
    // pourvoit le titre non pourvu du siège 2 plutôt que de buter sur le 1.
    const veille = [
      { table: 2, siege: 2, libelle: 'veille' },
      { table: 2, siege: 3, libelle: 'hôte' },
    ];
    const tenus = figer({ ...chargeAnimation(), reservations: [resa(1, 2, 1)], titres: veille });
    const { charge: pourvue } = executer('designerAnimateurs', tenus, { table: 2, participants: [2], libelle: 'animateur' });
    assert.deepEqual(pourvue.titres, veille);
    assert.deepEqual(pourvue.reservations, [resa(1, 2, 1), resa(2, 2, 2)]);
  });

  test('une personne absente à un tour est refusée avant toute désignation, nommée, première ou au milieu du lot ; rien n’est posé', () => {
    const absente = (charge) => {
      charge.participants[5] = personne(6, { presence: [1, 2] });
      return figer(charge);
    };
    const attendus = {
      participant: 6,
      personne: 'Capucine Sarcelle',
      refus: { code: 'ABSENT_AU_TOUR', details: { participant: 6, personne: 'Capucine Sarcelle', tour: 3 } },
      remede: { commande: 'changerPresence', arguments: { id: 6, tours: [1, 2, 3] } },
    };
    for (const participants of [
      [6, 1, 2],
      [1, 6, 2],
    ]) {
      const charge = absente(chargeAnimation());
      const leve = refuse(() => executer('designerAnimateurs', charge, { table: 2, participants, libelle: 'animateur' }), 'ANIMATEUR_REFUSE', attendus);
      assert.equal(
        libelle(leve.code, leve.details),
        "Refus pour Capucine Sarcelle, aucun animateur n'est désigné. " +
          "Cette personne n'est pas présente au tour 3 : une table ne s'anime que par une personne présente à tous les tours.",
      );
      assert.deepEqual(charge.reservations, []);
      assert.deepEqual(charge.titres, []);
    }
    // Avant toute désignation : Théo, réservé ailleurs au tour 2, vient
    // d'abord, et c'est l'absente que le refus nomme.
    const ailleurs = absente({ ...chargeAnimation(), reservations: [resa(2, 4, null, 2)] });
    refuse(() => executer('designerAnimateurs', ailleurs, { table: 2, participants: [2, 6], libelle: 'animateur' }), 'ANIMATEUR_REFUSE', attendus);
    // Absente au tour 1 et 3 : le premier tour d'absence est nommé.
    const deux = chargeAnimation();
    deux.participants[5] = personne(6, { presence: [2] });
    const premier = refuse(() => executer('designerAnimateurs', figer(deux), { table: 2, participants: [6], libelle: 'animateur' }), 'ANIMATEUR_REFUSE');
    assert.equal(premier.details.refus.details.tour, 1);
    assert.deepEqual(premier.details.remede.arguments.tours, [1, 2, 3]);
  });

  test('une personne du lot tient déjà la réservation au siège choisi : TABLE_GELEE ne vient qu’une fois, au rang de la première désignation qui la signale', () => {
    // Table 5 de deux places : Théo, réservé « tous les tours » au siège 2
    // sans titre, tient déjà une place. Iris prend le siège 1 et gèle la
    // table ; Théo reçoit le titre de son siège, et la table reste gelée.
    const charge = figer({ ...chargeAnimation(), tables: [{ ...chargeAnimation().tables[0], sieges: 2 }, chargeAnimation().tables[1]] });
    const reservee = figer({ ...charge, reservations: [resa(2, 2, 2)] });
    const { charge: apres, avertissements, libelle: texte } = executer('designerAnimateurs', reservee, {
      table: 2,
      participants: [1, 2],
      libelle: 'animateur',
    });
    assert.deepEqual(apres.reservations, [resa(2, 2, 2), resa(1, 2, 1)]);
    assert.deepEqual(apres.titres, [
      { table: 2, siege: 1, libelle: 'animateur' },
      { table: 2, siege: 2, libelle: 'animateur' },
    ]);
    assert.deepEqual(avertissements, [{ code: 'TABLE_GELEE', details: { table: 2 } }]);
    assert.equal(texte, 'Désigné 2 animateurs à la table 5 : Iris Ombrelle, Théo Pervenche');
  });

  test('une seule personne refusée : rien n’est posé, et le refus la nomme, avec la cause et son remède', () => {
    const charge = figer(chargeAnimation());
    const exclue = refuse(() => executer('designerAnimateurs', charge, { table: 2, participants: [1, 5, 2], libelle: 'animateur' }), 'ANIMATEUR_REFUSE', {
      participant: 5,
      personne: 'Anouk Bruyère',
      refus: { code: 'PERSONNE_EXCLUE', details: { participant: 5, autres: [] } },
      remede: { commande: 'reintegrerParticipant', arguments: { id: 5 } },
    });
    assert.equal(
      libelle(exclue.code, exclue.details),
      "Refus pour Anouk Bruyère, aucun animateur n'est désigné. " +
        "Cette personne est exclue : elle n'est placée nulle part tant qu'elle n'est pas réintégrée.",
    );
  });

  test('k_t > c_t refusé : la personne qui ferait déborder la table est nommée, rien n’est posé', () => {
    // Capucine, réservée à la main pour la soirée sans titre, tient déjà
    // une des trois places : la troisième animatrice déborde.
    const charge = figer({ ...chargeAnimation(), reservations: [resa(6, 2, null)] });
    const leve = refuse(() => executer('designerAnimateurs', charge, { table: 2, participants: [1, 2, 3], libelle: 'animateur' }), 'ANIMATEUR_REFUSE', {
      participant: 3,
      personne: 'Ondine Lacasse',
      remede: { commande: 'changerPlacesTable', arguments: { id: 2, sieges: 4, origine: 'champ' } },
    });
    assert.equal(leve.details.refus.code, 'SURRESERVATION');
    assert.deepEqual(charge.reservations, [resa(6, 2, null)]);
    // Trois titres déjà posés : la quatrième ne trouve aucun siège.
    const pleine = figer({ ...chargeAnimation(), titres: [1, 2, 3].map((siege) => ({ table: 2, siege, libelle: 'veille' })) });
    const titres = refuse(
      () => executer('designerAnimateurs', pleine, { table: 2, participants: [1, 2, 3, 4], libelle: 'animateur' }),
      'ANIMATEUR_REFUSE',
      { participant: 4, personne: 'Grisaille' },
    );
    assert.equal(titres.details.refus.code, 'AUCUN_SIEGE_SANS_TITRE');
  });

  test('une personne réservée ailleurs pour un tour est refusée, nommée, et le remède déplace sa réservation', () => {
    const charge = figer({ ...chargeAnimation(), reservations: [resa(2, 4, null, 2)] });
    const leve = refuse(() => executer('designerAnimateurs', charge, { table: 2, participants: [1, 2], libelle: 'animateur' }), 'ANIMATEUR_REFUSE', {
      participant: 2,
      personne: 'Théo Pervenche',
    });
    assert.equal(leve.details.refus.code, 'DEUX_PLACES_MEME_TOUR');
    assert.equal(leve.details.remede.commande, 'deplacerReservation');
    assert.match(libelle(leve.code, leve.details), /^Refus pour Théo Pervenche, aucun animateur n'est désigné\. Cette personne a déjà une place au tour 2/);
  });

  test('refus de forme : liste vide, doublon, autre chose qu’une liste ; libellé vide, personne inconnue, plan bloqué refusés tels quels', () => {
    const charge = figer(chargeAnimation());
    for (const participants of [[], [1, 2, 1], 3, undefined]) {
      assert.throws(() => executer('designerAnimateurs', charge, { table: 2, participants, libelle: 'animateur' }), TypeError);
    }
    assert.throws(() => executer('designerAnimateurs', charge, { table: 9, participants: [1], libelle: 'animateur' }), TypeError);
    refuse(() => executer('designerAnimateurs', charge, { table: 2, participants: [1], libelle: '  ' }), 'LIBELLE_VIDE', { remede: null });
    refuse(() => executer('designerAnimateurs', charge, { table: 2, participants: [1, 42], libelle: 'animateur' }), 'PARTICIPANT_INCONNU', { id: 42 });
    const bloquee = figer({ ...chargeAnimation(), evenement: { ...chargeAnimation().evenement, etat: 'bloque' } });
    refuse(() => executer('designerAnimateurs', bloquee, { table: 2, participants: [1], libelle: 'animateur' }), 'PLAN_BLOQUE');
  });

  test('qui anime déjà cette table est passé ; quand toutes l’animent déjà, SANS_EFFET', () => {
    const une = executer('designerAnimateurs', chargeAnimation(), { table: 2, participants: [1], libelle: 'animateur' }).charge;
    refuse(() => executer('designerAnimateurs', une, { table: 2, participants: [1], libelle: 'animateur' }), 'SANS_EFFET', {
      commande: 'designerAnimateurs',
    });
    const { charge: deux, libelle: texte } = executer('designerAnimateurs', une, { table: 2, participants: [1, 2], libelle: 'animateur' });
    assert.deepEqual(deux.reservations, [resa(1, 2, 1), resa(2, 2, 2)]);
    assert.equal(texte, 'Désigné 1 animateur à la table 5 : Théo Pervenche');
  });

  test('retirerAnimateur : la réservation « tous les tours » et le titre partent ensemble, une entrée ; la table redevient comme avant', () => {
    const charge = chargeAnimation({ attribuerSieges: true });
    const designee = executer('designerAnimateurs', charge, { table: 2, participants: [1], libelle: 'animateur' }).charge;
    const { charge: retiree, libelle: texte, avertissements } = executer('retirerAnimateur', figer(designee), { table: 2, participant: 1 });
    assert.equal(serialiser(retiree, ESSAI), serialiser(charge, ESSAI));
    assert.equal(texte, "Retiré l'animateur Iris Ombrelle de la table 5");
    assert.deepEqual(avertissements, []);
  });

  test('retirerAnimateur ne retire que ce qui appartient à la désignation : les autres titres et réservations de la table restent', () => {
    let charge = executer('designerAnimateurs', chargeAnimation(), { table: 4, participants: [3, 1, 2], libelle: 'animateur' }).charge;
    charge = executer('reserver', charge, { participant: 1, table: 4, siege: null, portee: 'tour', tour: 2 }).charge;
    charge = executer('reserver', charge, { participant: 4, table: 4, siege: null, portee: 'tous', tour: null }).charge;
    charge = executer('poserTitre', charge, { table: 4, siege: 4, libelle: 'veille' }).charge;
    const { charge: retiree } = executer('retirerAnimateur', figer(charge), { table: 4, participant: 1 });
    assert.deepEqual(retiree.reservations, [resa(3, 4, 1), resa(2, 4, 3), resa(1, 4, null, 2), resa(4, 4, null)]);
    assert.deepEqual(retiree.titres, [
      { table: 4, siege: 1, libelle: 'animateur' },
      { table: 4, siege: 3, libelle: 'animateur' },
      { table: 4, siege: 4, libelle: 'veille' },
    ]);
  });

  test('retirerAnimateur après un titre posé avant la désignation : ce titre reste, seul part celui que la désignation a posé', () => {
    const charge = figer(executer('poserTitre', chargeAnimation(), { table: 4, siege: 1, libelle: 'hôte' }).charge);
    const designee = executer('designerAnimateurs', charge, { table: 4, participants: [1], libelle: 'animateur' }).charge;
    const { charge: retiree } = executer('retirerAnimateur', figer(designee), { table: 4, participant: 1 });
    assert.equal(serialiser(retiree, ESSAI), serialiser(charge, ESSAI));
    assert.deepEqual(retiree.titres, [{ table: 4, siege: 1, libelle: 'hôte' }]);
  });

  test('retirerAnimateur, deux titres au siège de la réservation retirée : un seul part, le premier par libellé ; l’autre reste, non pourvu', () => {
    const charge = figer({
      ...chargeAnimation(),
      reservations: [resa(1, 4, 2)],
      titres: [
        { table: 4, siege: 2, libelle: 'veille' },
        { table: 4, siege: 2, libelle: 'accueil' },
        { table: 4, siege: 3, libelle: 'relève' },
      ],
    });
    const { charge: retiree, libelle: texte } = executer('retirerAnimateur', charge, { table: 4, participant: 1 });
    assert.deepEqual(retiree.reservations, []);
    assert.deepEqual(retiree.titres, [
      { table: 4, siege: 2, libelle: 'veille' },
      { table: 4, siege: 3, libelle: 'relève' },
    ]);
    assert.equal(texte, "Retiré l'animateur Iris Ombrelle de la table 3");
  });

  test('retirerAnimateur refuse SANS_EFFET qui n’anime pas la table : réservée sans titre, animatrice ailleurs, libre ; plan bloqué refusé', () => {
    let charge = executer('designerAnimateurs', chargeAnimation(), { table: 2, participants: [1], libelle: 'animateur' }).charge;
    charge = executer('reserver', charge, { participant: 2, table: 2, siege: null, portee: 'tous', tour: null }).charge;
    charge = figer(charge);
    for (const [table, participant] of [
      [2, 2],
      [4, 1],
      [2, 3],
    ]) {
      refuse(() => executer('retirerAnimateur', charge, { table, participant }), 'SANS_EFFET', { commande: 'retirerAnimateur', remede: null });
    }
    refuse(() => executer('retirerAnimateur', charge, { table: 2, participant: 42 }), 'PARTICIPANT_INCONNU');
    assert.throws(() => executer('retirerAnimateur', charge, { table: 9, participant: 1 }), TypeError);
    const bloquee = figer({ ...charge, evenement: { ...charge.evenement, etat: 'bloque' } });
    refuse(() => executer('retirerAnimateur', bloquee, { table: 2, participant: 1 }), 'PLAN_BLOQUE', { remede: { geste: 'debloquer' } });
    assert.deepEqual(bloquee.reservations, charge.reservations);
  });
});

describe('commandes des places : les invariants des réservations (§ 5.9, § 14.12)', () => {
  // Σ (c_t − k_t) − n de l'instance, et ses ancrés par table.
  const ecart = ({ capacite, ancresParTable, n }) =>
    capacite.reduce((somme, c) => somme + c, 0) - ancresParTable.reduce((somme, k) => somme + k, 0) - n;

  // Une petite configuration tirée : deux à quatre tables de 2 à 5 places,
  // un à trois tours, trois à douze personnes dont parfois une exclue.
  function configurationTiree(rng) {
    const tours = 1 + rng.borne(3);
    const charge = creerCharge({ id: 'evt-grille', nom: 'Soirée des Lucioles', siegesParDefaut: 2 + rng.borne(4), tours });
    charge.reglages.attribuerSieges = rng.borne(2) === 1;
    const nombre = 3 + rng.borne(10);
    charge.participants = Array.from({ length: nombre }, (_, rang) => personne(rang + 1, { exclu: rng.borne(6) === 0 }));
    const tables = 2 + rng.borne(3);
    charge.tables = Array.from({ length: tables }, (_, rang) => ({
      id: rang + 1,
      numero: rang + 1,
      sieges: rng.borne(2) === 0 ? null : 2 + rng.borne(4),
      forme: 'ronde',
      position: { x: 300 * rang, y: 0 },
    }));
    charge.prochainsIds = { participant: nombre + 1, table: tables + 1, proposition: 1 };
    return charge;
  }

  // Une commande de réservation tirée sur la charge, et les tables qu'elle
  // touche : arguments valides en forme, que la commande accepte ou refuse.
  function commandeTiree(rng, charge) {
    const R = charge.evenement.tours;
    const participant = 1 + rng.borne(charge.participants.length);
    const idTable = 1 + rng.borne(charge.tables.length);
    const siege = rng.borne(3) === 0 ? null : 1 + rng.borne(5);
    const portee = rng.borne(2) === 0 ? 'tous' : 'tour';
    const tour = portee === 'tous' ? null : 1 + rng.borne(R);
    const existante = charge.reservations.length > 0 ? charge.reservations[rng.borne(charge.reservations.length)] : null;
    const choix = rng.borne(6);
    if (choix <= 1 || existante === null) return ['reserver', { participant, table: idTable, siege, portee, tour }, [idTable]];
    if (choix === 2) {
      const { participant: p, table: t, portee: po, tour: to } = existante;
      return ['retirerReservation', { participant: p, table: t, portee: po, tour: to }, [t]];
    }
    if (choix === 3) {
      const { participant: p, table: t, portee: po, tour: to } = existante;
      return ['deplacerReservation', { participant: p, de: { table: t, portee: po, tour: to }, vers: { table: idTable, siege } }, [t, idTable]];
    }
    if (choix === 4) {
      const possibles = conversionsPossibles(charge);
      const cible = possibles.length > 0 ? possibles[rng.borne(possibles.length)] : { participant, table: idTable };
      return ['convertirEnTous', cible, [cible.table]];
    }
    return ['designer', { participant, table: idTable, siege, libelle: 'animation' }, [idTable]];
  }

  test('Σ (c_t − k_t) − n ne change pas ; la charge rendue se relit et se normalise ; les ancrés ne bougent qu’aux tables touchées', () => {
    assert.ok(!Object.values(FLUX).includes(7), 'le flux 7 est hors de FLUX');
    const rng = creerPcg32(48271, 7);
    let acceptees = 0;
    const parCommande = new Map();
    for (let essai = 0; essai < 300; essai += 1) {
      let charge = configurationTiree(rng);
      for (let geste = 0; geste < 6; geste += 1) {
        const avant = normaliser(configurationDepuisCharge(charge));
        const [nom, args, touchees] = commandeTiree(rng, charge);
        let rendu;
        try {
          rendu = appliquerCommande(nom, charge, args);
        } catch (erreur) {
          if (erreur instanceof ErreurCommande) continue;
          throw erreur;
        }
        acceptees += 1;
        parCommande.set(nom, (parCommande.get(nom) ?? 0) + 1);
        const texte = serialiser(rendu.charge, { revision: 1, produitVersion: 'essai' });
        assert.doesNotThrow(() => analyser(texte), `${nom} ${JSON.stringify(args)}`);
        const apres = normaliser(configurationDepuisCharge(rendu.charge));
        assert.equal(ecart(apres), ecart(avant), `${nom} ${JSON.stringify(args)}`);
        avant.ancresParTable.forEach((k, t) => {
          const delta = apres.ancresParTable[t] - k;
          const idTable = avant.idsTables[t];
          if (nom === 'convertirEnTous' || !touchees.includes(idTable)) assert.equal(delta, 0, `${nom} table ${idTable}`);
          else assert.ok(Math.abs(delta) <= 1, `${nom} table ${idTable} : ${delta}`);
        });
        charge = rendu.charge;
      }
    }
    assert.ok(acceptees >= 200, `${acceptees} gestes acceptés`);
    for (const nom of ['reserver', 'retirerReservation', 'deplacerReservation', 'convertirEnTous', 'designer']) {
      assert.ok((parCommande.get(nom) ?? 0) > 0, `${nom} jamais accepté`);
    }
  });
});

describe('commandes des places : le retenu (§ 7.1, § 8.2, § 8.9)', () => {
  test('au tour 2, déplacer, échanger, retirer ne changent que le tour 2 du retenu, jamais la proposition', () => {
    const charge = figer(chargeRetenue());
    const deplace = executer('deplacerDansRetenu', charge, { tour: 2, participant: 1, table: 8, siege: 7 });
    assert.equal(deplace.libelle, 'Déplacé Iris Ombrelle de la table 4 à la table 7, tour 2');
    assert.deepEqual(listes(deplace.charge, 2), [[null, 8, 9, 10, 11, 12], [7, 2, 3, 4, 5, 6, 1]]);
    const echange = executer('echangerDansRetenu', charge, { tour: 2, a: 1, b: 2 });
    assert.deepEqual(listes(echange.charge, 2), [[2, 8, 9, 10, 11, 12], [7, 1, 3, 4, 5, 6]]);
    assert.equal(echange.libelle, 'Échangé Iris Ombrelle (table 4) et Théo Pervenche (table 7), tour 2');
    const retire = executer('retirerDuTour', charge, { tour: 2, participant: 9 });
    assert.equal(retire.libelle, 'Retiré Hortense Quenouille de la table 4, tour 2');
    assert.deepEqual(reserveDe(retire.charge, 2), [9]);
    assert.deepEqual(etatPlaces(retire.charge, { tour: 2 }).reserve, [9]);
    for (const tour of [1, 3]) assert.deepEqual(etatPlaces(retire.charge, { tour }).reserve, []);
    for (const { charge: apres } of [deplace, echange, retire]) {
      assert.deepEqual(apres.propositions, charge.propositions);
      for (const tour of [1, 3]) assert.deepEqual(apres.retenu.placement[tour - 1], charge.retenu.placement[tour - 1]);
      assert.deepEqual(fautes(apres.retenu), []);
    }
  });

  test('sièges attribués : un départ laisse sa chaise vide, et tout autre siège reste le même', () => {
    const charge = chargeRetenue();
    const sans3 = executer('retirerDuTour', charge, { tour: 1, participant: 3 }).charge;
    assert.deepEqual(listes(sans3, 1)[0], [1, 2, null, 4, 5, 6]);
    const sans6 = executer('retirerDuTour', sans3, { tour: 1, participant: 6 }).charge;
    assert.deepEqual(listes(sans6, 1)[0], [1, 2, null, 4, 5]);
    assert.deepEqual(fautes(sans6.retenu), []);
    const retour = executer('deplacerDansRetenu', sans6, { tour: 1, participant: 12, table: 5, siege: 3 }).charge;
    assert.deepEqual(listes(retour, 1), [[1, 2, 12, 4, 5], [7, 8, 9, 10, 11]]);
    // La personne qui quitte sa table pour une autre libère aussi sa chaise.
    const quitte = executer('deplacerDansRetenu', charge, { tour: 1, participant: 9, table: 5, siege: 7 }).charge;
    assert.deepEqual(listes(quitte, 1), [[1, 2, 3, 4, 5, 6, 9], [7, 8, null, 10, 11, 12]]);
  });

  test('sièges attribués : un dépôt sur la chaise 8 d’une table de 8 qui en tient cinq, les rangs sautés à null', () => {
    const charge = chargeRetenue({
      tours: [
        [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10, 11, 12]],
        [[1, 8, 9, 10, 11, 12], [7, 2, 3, 4, 5, 6]],
        [[1, 2, 3, 7, 8, 9], [4, 5, 6, 10, 11, 12]],
      ],
    });
    const { charge: apres } = executer('deplacerDansRetenu', charge, { tour: 1, participant: 6, table: 5, siege: 8 });
    assert.deepEqual(listes(apres, 1), [[1, 2, 3, 4, 5, null, null, 6], [null, 7, 8, 9, 10, 11, 12]]);
    assert.deepEqual(fautes(apres.retenu), []);
    refuse(() => executer('deplacerDansRetenu', charge, { tour: 1, participant: 6, table: 5, siege: 2 }), 'SIEGE_OCCUPE', {
      table: 5,
      siege: 2,
      tour: 1,
      occupant: 2,
      remede: { commande: 'echangerDansRetenu', arguments: { tour: 1, a: 6, b: 2 } },
    });
  });

  test('sans attribution : la liste reste triée, une table pleine de présents refuse TABLE_PLEINE', () => {
    const charge = figer(chargeRetenue({ siegesAttribues: false, capacite: 6 }));
    // La table 4 tient six présents : refusée ; libérée d'un, elle reçoit.
    refuse(() => executer('deplacerDansRetenu', charge, { tour: 1, participant: 12, table: 5, siege: null }), 'TABLE_PLEINE', {
      table: 5,
      tour: 1,
      capacite: 6,
      remede: { commande: 'changerPlacesTable', arguments: { id: 5, sieges: 7, origine: 'champ' } },
    });
    const libre = executer('retirerDuTour', charge, { tour: 1, participant: 2 }).charge;
    assert.deepEqual(listes(libre, 1)[0], [1, 3, 4, 5, 6]);
    const recue = executer('deplacerDansRetenu', libre, { tour: 1, participant: 12, table: 5, siege: null }).charge;
    assert.deepEqual(listes(recue, 1), [[1, 3, 4, 5, 6, 12], [7, 8, 9, 10, 11]]);
  });

  test('une retouche qui assiérait cinq personnes à une table de 4 au tour 2 est refusée, sans écriture', () => {
    const charge = figer(
      chargeRetenue({
        siegesAttribues: false,
        capacite: 4,
        tours: [
          [[1, 2, 3, 4], [5, 6, 7, 8]],
          [[1, 2, 3, 4], [5, 6, 7, 8]],
          [[1, 2, 3, 4], [5, 6, 7, 8]],
        ],
      }),
    );
    refuse(() => appliquerCommande('deplacerDansRetenu', charge, { tour: 2, participant: 9, table: 5, siege: null }), 'TABLE_PLEINE');
  });

  test('la proposition montrée n’est jamais la cible : sans retenu, ou à un tour qu’il ne porte pas, une retouche est une faute du code', () => {
    const sans = chargeRetenue();
    sans.retenu = null;
    assert.throws(() => executer('retirerDuTour', sans, { tour: 1, participant: 1 }), TypeError);
    assert.throws(() => executer('retirerDuTour', chargeRetenue(), { tour: 4, participant: 1 }), TypeError);
  });

  test('un retenu fautif refuse ses retouches RETENU_FAUTIF, remède la version précédente', () => {
    const charge = chargeRetenue();
    charge.retenu.placement[0].reserve = [1];
    for (const [nom, args] of [
      ['deplacerDansRetenu', { tour: 2, participant: 1, table: 8, siege: 7 }],
      ['echangerDansRetenu', { tour: 2, a: 1, b: 2 }],
      ['retirerDuTour', { tour: 2, participant: 1 }],
    ]) {
      refuse(() => executer(nom, charge, args), 'RETENU_FAUTIF', { remede: { geste: 'ouvrirSecours', source: 'precedent' } });
    }
  });

  test('une place réservée à B : refusée PLACE_RESERVEE par dépôt, puis par échange', () => {
    const charge = chargeRetenue({ reservations: [resa(2, 8, 8, 2), resa(7, 8, 1)] });
    refuse(() => executer('deplacerDansRetenu', charge, { tour: 2, participant: 9, table: 8, siege: 8 }), 'PLACE_RESERVEE', {
      titulaire: 2,
      table: 8,
      siege: 8,
    });
    refuse(() => executer('echangerDansRetenu', charge, { tour: 2, a: 9, b: 7 }), 'PLACE_RESERVEE', { titulaire: 7, siege: 1 });
    // Contre sa propre réservation : RESERVEE_AILLEURS.
    refuse(() => executer('deplacerDansRetenu', charge, { tour: 2, participant: 7, table: 5, siege: 7 }), 'RESERVEE_AILLEURS', {
      participant: 7,
      tour: 2,
    });
  });
});

describe('commandes des places : le retenu et la dérive (§ 9, § 4.4)', () => {
  test('une personne ajoutée après la retenue attend en réserve ; déplacée au tour 2, elle y est assise et attend aux autres', () => {
    const charge = chargeRetenue();
    charge.participants.push(personne(13));
    charge.prochainsIds.participant = 14;
    for (const tour of [1, 2, 3]) assert.ok(etatPlaces(charge, { tour }).reserve.includes(13));
    const { charge: apres, libelle } = executer('deplacerDansRetenu', charge, { tour: 2, participant: 13, table: 8, siege: 8 });
    assert.equal(libelle, 'Déplacé Lucioles Zéphyrin de la réserve à la table 7, tour 2');
    assert.deepEqual(listes(apres, 2)[1], [7, 2, 3, 4, 5, 6, null, 13]);
    assert.deepEqual(reserveDe(apres, 1), [13]);
    assert.deepEqual(reserveDe(apres, 3), [13]);
    assert.ok(apres.retenu.participants.includes(13));
    assert.deepEqual(fautes(apres.retenu), []);
    assert.ok(!derive(apres.retenu, apres).some(({ participant }) => participant === 13));
    assert.equal(etatPlaces(apres, { tour: 2 }).tables[1].chaises[7].occupant, 13);
  });

  test('Iris, exclue après la retenue, au siège 3 du tour 2 : y déposer Théo l’envoie en réserve, sans renuméroter personne', () => {
    const charge = chargeRetenue({
      tours: [
        [[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]],
        [[8, 9, 1, 10, 11, 12], [7, 2, 3, 4, 5, 6]],
        [[1, 2, 3, 7, 8, 9], [4, 5, 6, 10, 11, 12]],
      ],
    });
    charge.participants[0].exclu = true;
    const { charge: apres } = executer('deplacerDansRetenu', charge, { tour: 2, participant: 2, table: 5, siege: 3 });
    assert.deepEqual(listes(apres, 2), [[8, 9, 2, 10, 11, 12], [7, null, 3, 4, 5, 6]]);
    assert.deepEqual(reserveDe(apres, 2), [1]);
    refuse(() => executer('deplacerDansRetenu', charge, { tour: 2, participant: 1, table: 8, siege: 8 }), 'PERSONNE_EXCLUE', {
      participant: 1,
    });
  });

  test('sans attribution, une table pleine qui porte un exclu reçoit le dépôt ; l’exclu au plus petit identifiant va en réserve', () => {
    const charge = chargeRetenue({ siegesAttribues: false, capacite: 6 });
    charge.participants[1].exclu = true;
    charge.participants[3].exclu = true;
    const { charge: apres } = executer('deplacerDansRetenu', charge, { tour: 1, participant: 12, table: 5, siege: null });
    assert.deepEqual(listes(apres, 1), [[1, 3, 4, 5, 6, 12], [7, 8, 9, 10, 11]]);
    assert.deepEqual(reserveDe(apres, 1), [2]);
  });

  test('une table créée après la retenue, écrite comme creerTable la laissera, reçoit un dépôt', () => {
    const charge = chargeRetenue();
    charge.tables.push({ id: 9, numero: 9, sieges: null, forme: 'ronde', position: { x: 800, y: 0 } });
    charge.prochainsIds.table = 10;
    charge.retenu.tables.push(9);
    charge.retenu.capacites.push(8);
    for (const tour of charge.retenu.placement) tour.sieges.push([]);
    const { charge: apres } = executer('deplacerDansRetenu', charge, { tour: 2, participant: 4, table: 9, siege: 1 });
    assert.deepEqual(listes(apres, 2), [[1, 8, 9, 10, 11, 12], [7, 2, 3, null, 5, 6], [4]]);
    assert.deepEqual(fautes(apres.retenu), []);
  });

  test('une table supprimée après la retenue : ses occupants attendent en réserve, et le remède de SIEGE_OCCUPE s’exécute tel quel', () => {
    const charge = chargeRetenue();
    charge.tables = charge.tables.filter(({ id }) => id !== 8);
    assert.deepEqual(etatPlaces(charge, { tour: 1 }).reserve, [7, 8, 9, 10, 11, 12]);
    const occupe = refuse(() => executer('deplacerDansRetenu', charge, { tour: 1, participant: 7, table: 5, siege: 1 }), 'SIEGE_OCCUPE', {
      occupant: 1,
    });
    const { commande, arguments: args } = occupe.details.remede;
    assert.deepEqual([commande, args], ['echangerDansRetenu', { tour: 1, a: 7, b: 1 }]);
    const { charge: apres } = executer(commande, charge, args);
    // 7 prend la chaise 1 ; 1 attend en réserve, et personne n'entre dans la
    // liste de la table que la charge n'a plus.
    assert.deepEqual(listes(apres, 1), [[7, 2, 3, 4, 5, 6], [null, 8, 9, 10, 11, 12]]);
    assert.deepEqual(reserveDe(apres, 1), [1]);
    assert.deepEqual(listes(apres, 2), listes(charge, 2));
    const etat = etatPlaces(apres, { tour: 1 });
    assert.equal(etat.tables.length, 1);
    assert.equal(etat.tables[0].chaises[0].occupant, 7);
    assert.deepEqual(etat.reserve, [1, 8, 9, 10, 11, 12]);
  });

  test('une table réduite après la retenue : un rang au-delà de sa capacité se lit comme la réserve, dans l’échange aussi', () => {
    const charge = chargeRetenue();
    charge.tables[0].sieges = 4;
    assert.deepEqual(etatPlaces(charge, { tour: 1 }).reserve, [5, 6]);
    const occupe = refuse(() => executer('deplacerDansRetenu', charge, { tour: 1, participant: 5, table: 5, siege: 1 }), 'SIEGE_OCCUPE', {
      occupant: 1,
    });
    const { charge: apres } = executer(occupe.details.remede.commande, charge, occupe.details.remede.arguments);
    assert.deepEqual(listes(apres, 1)[0], [5, 2, 3, 4, null, 6]);
    assert.deepEqual(reserveDe(apres, 1), [1]);
    assert.deepEqual(etatPlaces(apres, { tour: 1 }).reserve, [1, 6]);
  });

  test('sans attribution, une table réduite après la retenue : une personne que le plan montre en réserve s’y trouve pour déplacer et retirer', () => {
    const charge = chargeRetenue({ siegesAttribues: false });
    charge.tables[0].sieges = 4;
    assert.deepEqual(etatPlaces(charge, { tour: 1 }).reserve, [5, 6]);
    // La table affichée assied quatre présents : pleine, et non SANS_EFFET.
    const pleine = refuse(() => executer('deplacerDansRetenu', charge, { tour: 1, participant: 6, table: 5, siege: null }), 'TABLE_PLEINE', {
      table: 5,
      tour: 1,
      capacite: 4,
    });
    assert.deepEqual(pleine.details.remede, { commande: 'changerPlacesTable', arguments: { id: 5, sieges: 5, origine: 'champ' } });
    // Déjà en réserve à l'affichage : retirer du tour n'a pas d'effet.
    refuse(() => executer('retirerDuTour', charge, { tour: 1, participant: 6 }), 'SANS_EFFET');
    // Vers une autre table, elle part de la réserve.
    const { charge: apres, libelle } = executer('deplacerDansRetenu', charge, { tour: 1, participant: 6, table: 8, siege: null });
    assert.equal(libelle, 'Déplacé Capucine Sarcelle de la réserve à la table 7, tour 1');
    assert.deepEqual(listes(apres, 1), [[1, 2, 3, 4], [6, 7, 8, 9, 10, 11, 12]]);
    assert.deepEqual(reserveDe(apres, 1), [5]);
    assert.deepEqual(etatPlaces(apres, { tour: 1 }).reserve, [5]);
  });

  test('sans attribution, une table réduite après la retenue : chaque geste verse d’abord en réserve ceux que le plan n’y montre pas, et n’assied que ceux qu’il nomme', () => {
    const charge = chargeRetenue({ siegesAttribues: false });
    charge.tables[0].sieges = 4;
    figer(charge);
    const occupants = (apres) => etatPlaces(apres, { tour: 1 }).tables.map(({ chaises }) => chaises.map(({ occupant }) => occupant));
    assert.deepEqual(occupants(charge), [
      [1, 2, 3, 4],
      [7, 8, 9, 10, 11, 12, null, null],
    ]);
    assert.deepEqual(etatPlaces(charge, { tour: 1 }).reserve, [5, 6]);

    // 6, en réserve à l'affichage, prend la chaise de 2 ; 5 reste en réserve.
    const echange = executer('echangerDansRetenu', charge, { tour: 1, a: 6, b: 2 }).charge;
    assert.deepEqual(occupants(echange), [
      [1, 3, 4, 6],
      [7, 8, 9, 10, 11, 12, null, null],
    ]);
    assert.deepEqual(etatPlaces(echange, { tour: 1 }).reserve, [2, 5]);
    assert.deepEqual(listes(echange, 1), [[1, 3, 4, 6], [7, 8, 9, 10, 11, 12]]);
    assert.deepEqual(reserveDe(echange, 1), [2, 5]);

    // 7, venu d'une autre table, prend la chaise de 2 et s'y voit assis.
    const croise = executer('echangerDansRetenu', charge, { tour: 1, a: 7, b: 2 }).charge;
    assert.deepEqual(occupants(croise), [
      [1, 3, 4, 7],
      [2, 8, 9, 10, 11, 12, null, null],
    ]);
    assert.deepEqual(etatPlaces(croise, { tour: 1 }).reserve, [5, 6]);

    // 2, de la table réduite, prend la chaise de 7 : la table de a se verse
    // aussi, et 7 s'assied à la chaise de 2 sans que 5 la lui dispute.
    const inverse = executer('echangerDansRetenu', charge, { tour: 1, a: 2, b: 7 }).charge;
    assert.deepEqual(occupants(inverse), [
      [1, 3, 4, 7],
      [2, 8, 9, 10, 11, 12, null, null],
    ]);
    assert.deepEqual(etatPlaces(inverse, { tour: 1 }).reserve, [5, 6]);
    assert.deepEqual(listes(inverse, 1), [[1, 3, 4, 7], [2, 8, 9, 10, 11, 12]]);

    // Le départ de 2 libère sa chaise : 5 ne s'y assied pas.
    const retire = executer('retirerDuTour', charge, { tour: 1, participant: 2 }).charge;
    assert.deepEqual(occupants(retire), [
      [1, 3, 4, null],
      [7, 8, 9, 10, 11, 12, null, null],
    ]);
    assert.deepEqual(etatPlaces(retire, { tour: 1 }).reserve, [2, 5, 6]);
    assert.deepEqual(listes(retire, 1), [[1, 3, 4], [7, 8, 9, 10, 11, 12]]);

    const deplace = executer('deplacerDansRetenu', charge, { tour: 1, participant: 2, table: 8, siege: null }).charge;
    assert.deepEqual(occupants(deplace), [
      [1, 3, 4, null],
      [2, 7, 8, 9, 10, 11, 12, null],
    ]);
    assert.deepEqual(etatPlaces(deplace, { tour: 1 }).reserve, [5, 6]);
    assert.deepEqual(listes(deplace, 1), [[1, 3, 4], [2, 7, 8, 9, 10, 11, 12]]);

    for (const apres of [echange, croise, inverse, retire, deplace]) {
      assert.deepEqual(fautes(apres.retenu), []);
      for (const tour of [2, 3]) assert.deepEqual(apres.retenu.placement[tour - 1], charge.retenu.placement[tour - 1]);
    }
  });

  test('sans attribution, une table réduite : la personne réservée à cette table y reste assise, et un autre départ ne la verse pas en réserve', () => {
    // 6, réservé à la table 4 sans siège, est au-delà de ses quatre places
    // dans la liste : l'affichage l'assied avant 4 et 5, sans réservation.
    const charge = chargeRetenue({ siegesAttribues: false, reservations: [resa(6, 5, null)] });
    charge.tables[0].sieges = 4;
    figer(charge);
    const occupantsTable4 = (etat) => etat.tables[0].chaises.map(({ occupant }) => occupant);
    assert.deepEqual(occupantsTable4(etatPlaces(charge, { tour: 1 })), [1, 2, 3, 6]);
    assert.deepEqual(etatPlaces(charge, { tour: 1 }).reserve, [4, 5]);
    const { charge: apres } = executer('retirerDuTour', charge, { tour: 1, participant: 2 });
    // Seule la chaise que 2 libère reste vide.
    assert.deepEqual(occupantsTable4(etatPlaces(apres, { tour: 1 })), [1, 3, 6, null]);
    assert.deepEqual(listes(apres, 1), [[1, 3, 6], [7, 8, 9, 10, 11, 12]]);
    assert.deepEqual(reserveDe(apres, 1), [2, 4, 5]);
    assert.deepEqual(etatPlaces(apres, { tour: 1 }).reserve, [2, 4, 5]);
    assert.deepEqual(
      avertissementsApres(charge, apres).filter(({ code }) => code === 'RESERVATION_NON_HONOREE'),
      [],
    );
  });

  test('sièges attribués, une table réduite après la retenue : le rang au-delà de sa capacité part de la réserve vers une chaise libre', () => {
    const charge = chargeRetenue({
      tours: [
        [[1, null, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]],
        [[1, 8, 9, 10, 11, 12], [7, 2, 3, 4, 5, 6]],
        [[1, 2, 3, 7, 8, 9], [4, 5, 6, 10, 11, 12]],
      ],
    });
    charge.tables[0].sieges = 4;
    assert.deepEqual(etatPlaces(charge, { tour: 1 }).reserve, [2, 5, 6]);
    refuse(() => executer('retirerDuTour', charge, { tour: 1, participant: 5 }), 'SANS_EFFET');
    const { charge: apres, libelle } = executer('deplacerDansRetenu', charge, { tour: 1, participant: 5, table: 5, siege: 2 });
    assert.equal(libelle, 'Déplacé Anouk Bruyère de la réserve à la table 4, tour 1');
    assert.deepEqual(listes(apres, 1)[0], [1, 5, 3, 4, null, 6]);
    assert.deepEqual(reserveDe(apres, 1), [2]);
    assert.deepEqual(etatPlaces(apres, { tour: 1 }).reserve, [2, 6]);
    assert.deepEqual(fautes(apres.retenu), []);
  });
});

describe('commandes des places : le vérificateur d’invariants du retenu (§ 14.12, § 14.15)', () => {
  test('retirer du tour une personne réservée à sa table : INVARIANT_VIOLE, les seules violations nouvelles, remède le retrait de la réservation', () => {
    // Le retenu reçu porte déjà une violation : 7, réservé à la table 4 au
    // tour 2, y est assis à la table 7 ; elle n'entre pas dans le refus.
    const charge = figer(chargeRetenue({ reservations: [resa(4, 5, null, 1), resa(7, 5, null, 2)] }));
    const leve = refuse(() => executer('retirerDuTour', charge, { tour: 1, participant: 4 }), 'INVARIANT_VIOLE', {
      proposition: 1,
      violations: [{ code: 'RESERVATION', participant: 4, table: 5, tour: 1 }],
      remede: { commande: 'retirerReservation', arguments: { participant: 4, table: 5, portee: 'tour', tour: 1 } },
    });
    // Le remède lève le refus : la réservation retirée, le retrait passe.
    const { commande, arguments: argumentsDuRemede } = leve.details.remede;
    const { charge: sansReservation } = executer(commande, charge, argumentsDuRemede);
    const { charge: retire } = executer('retirerDuTour', sansReservation, { tour: 1, participant: 4 });
    assert.deepEqual(reserveDe(retire, 1), [4]);
    const { charge: apres } = executer('retirerDuTour', charge, { tour: 1, participant: 5 });
    assert.deepEqual(reserveDe(apres, 1), [5]);
  });

  test('retirer du tour une personne réservée « tous les tours » à sa table : le remède désigne cette réservation', () => {
    const charge = figer(chargeRetenue({ reservations: [resa(4, 5, null)] }));
    refuse(() => executer('retirerDuTour', charge, { tour: 1, participant: 4 }), 'INVARIANT_VIOLE', {
      remede: { commande: 'retirerReservation', arguments: { participant: 4, table: 5, portee: 'tous', tour: null } },
    });
  });

  test('deux réservations de la personne à sa table, « tous les tours » et « ce tour » : le remède retire la plus étroite d’abord, puis l’autre, et le retrait passe', () => {
    // Chacune tient à elle seule la personne à la table au tour 1 : aucun
    // retrait unique ne lève le refus. Le premier remède garde « tous les
    // tours », qui réserve encore les tours 2 et 3 ; le refus qui suit
    // nomme alors celle-ci.
    const charge = figer(chargeRetenue({ reservations: [resa(4, 5, null), resa(4, 5, null, 1)] }));
    const remede = (portee, tour) => ({ commande: 'retirerReservation', arguments: { participant: 4, table: 5, portee, tour } });
    const premier = refuse(() => executer('retirerDuTour', charge, { tour: 1, participant: 4 }), 'INVARIANT_VIOLE', {
      remede: remede('tour', 1),
    });
    const { charge: sansTour } = executer(premier.details.remede.commande, charge, premier.details.remede.arguments);
    assert.deepEqual(sansTour.reservations, [resa(4, 5, null)]);
    const second = refuse(() => executer('retirerDuTour', sansTour, { tour: 1, participant: 4 }), 'INVARIANT_VIOLE', {
      remede: remede('tous', null),
    });
    const { charge: sansReservation } = executer(second.details.remede.commande, sansTour, second.details.remede.arguments);
    const { charge: retire } = executer('retirerDuTour', sansReservation, { tour: 1, participant: 4 });
    assert.deepEqual(reserveDe(retire, 1), [4]);
  });

  test('une violation déjà présente, celle d’une dérive, ne bloque pas la retouche suivante', () => {
    const charge = chargeRetenue({ reservations: [resa(4, 8, null, 1)] });
    charge.participants.push(personne(13));
    charge.prochainsIds.participant = 14;
    const { charge: apres } = executer('retirerDuTour', charge, { tour: 2, participant: 9 });
    assert.deepEqual(reserveDe(apres, 2), [9]);
    const { charge: ensuite } = executer('echangerDansRetenu', apres, { tour: 2, a: 9, b: 10 });
    assert.deepEqual(reserveDe(ensuite, 2), [10]);
  });
});

describe('commandes des places : le dépôt sans siège et les réservations au siège (§ 5.9, § 8.9)', () => {
  // À chaque tour, la table 4 assied 1, 2, 3 aux sièges 1 à 3, la table 7
  // assied 4 à 11, et 12 attend en réserve.
  const tours = [1, 2, 3].map(() => [[1, 2, 3], [4, 5, 6, 7, 8, 9, 10, 11]]);

  test('sièges attribués, un dépôt sans siège saute la chaise que tient la réservation active d’un autre', () => {
    const charge = figer(chargeRetenue({ tours, reservations: [resa(9, 5, 4)] }));
    const { charge: apres } = executer('deplacerDansRetenu', charge, { tour: 1, participant: 12, table: 5, siege: null });
    assert.deepEqual(listes(apres, 1)[0], [1, 2, 3, null, 12]);
    const chaise4 = etatPlaces(apres, { tour: 1 }).tables[0].chaises[3];
    assert.deepEqual([chaise4.occupant, chaise4.reservation?.participant], [null, 9]);
  });

  test('sièges attribués, sans siège, la personne réservée à un siège de la table y va ; déjà assise sur lui, SANS_EFFET', () => {
    const charge = figer(chargeRetenue({ tours, reservations: [resa(10, 5, 6)] }));
    const { charge: apres } = executer('deplacerDansRetenu', charge, { tour: 1, participant: 10, table: 5, siege: null });
    assert.deepEqual(listes(apres, 1)[0], [1, 2, 3, null, null, 10]);
    refuse(() => executer('deplacerDansRetenu', apres, { tour: 1, participant: 10, table: 5, siege: null }), 'SANS_EFFET');
  });

  test('une personne ajoutée après la retenue et réservée à une table : déposée à cette table au tour 2, elle y est assise, sans INVARIANT_VIOLE', () => {
    const charge = chargeRetenue();
    charge.participants.push(personne(13));
    charge.prochainsIds.participant = 14;
    charge.reservations.push(resa(13, 5, null));
    const { charge: apres } = executer('deplacerDansRetenu', charge, { tour: 2, participant: 13, table: 5, siege: null });
    assert.deepEqual(listes(apres, 2)[0], [1, 8, 9, 10, 11, 12, 13]);
    assert.deepEqual(reserveDe(apres, 1), [13]);
  });

  test('sièges attribués, désigner au siège 3 la personne assise au siège 2 : le retenu reste tel quel, RESERVATION_NON_HONOREE au siège, et son remède, l’échange, la lève', () => {
    const charge = chargeRetenue();
    const { charge: designee } = appliquerCommande('designer', charge, { participant: 2, table: 5, siege: 3, libelle: 'Animation' });
    assert.deepEqual(designee.retenu, charge.retenu);
    // Au tour 2, le retenu assied 2 à la table 7 : la réservation n'y est
    // pas tenue à sa table ; aux tours 1 et 3, à la table 4, mais au siège 2.
    const nonTenues = (avant, apres) =>
      avertissementsApres(avant, apres)
        .filter(({ code }) => code === 'RESERVATION_NON_HONOREE')
        .map(({ details }) => [details.tour, details.siege ?? null, details.occupant ?? null]);
    assert.deepEqual(nonTenues(charge, designee), [[2, null, null], [1, 3, 3], [3, 3, 3]]);
    const { charge: echangee } = executer('echangerDansRetenu', designee, { tour: 1, a: 2, b: 3 });
    assert.deepEqual(listes(echangee, 1)[0], [1, 3, 2, 4, 5, 6]);
    assert.deepEqual(nonTenues(charge, echangee), [[2, null, null], [3, 3, 3]]);
  });
});

describe('enregistrerGeneration : les sièges réservés dans une génération (§ 4, § 5.3, § 8.9)', () => {
  // Douze personnes, deux tables, Théo réservé « tous » au siège siege de la
  // table 2, sièges attribués.
  function chargeGeneration({ siege, capacite = 8, attribuerSieges = true }) {
    const charge = creerCharge({ id: 'evt-generation', nom: 'Soirée des Lucioles', siegesParDefaut: capacite, tours: 3 });
    charge.reglages.attribuerSieges = attribuerSieges;
    charge.participants = DOUZE.map((id) => personne(id));
    charge.tables = [
      { id: 1, numero: 1, sieges: null, forme: 'ronde', position: { x: 0, y: 0 } },
      { id: 2, numero: 2, sieges: null, forme: 'ronde', position: { x: 400, y: 0 } },
    ];
    charge.reservations = [resa(2, 2, siege)];
    charge.prochainsIds = { participant: 13, table: 3, proposition: 1 };
    return charge;
  }

  test('Théo, réservé au siège 3 de la table 2, y prend le rang 3 à chaque tour de chaque proposition', () => {
    const charge = chargeGeneration({ siege: 3 });
    const configuration = configurationDepuisCharge(charge);
    const propositions = rechercher(configuration, { graine: 7, arret: 60, nombre: 2 });
    const { charge: apres } = executer('enregistrerGeneration', charge, { propositions, configuration, produitVersion: VERSION.affichee });
    assert.equal(apres.propositions.length, 2);
    for (const proposition of apres.propositions) {
      assert.deepEqual(fautes(proposition), []);
      const rang = proposition.tables.indexOf(2);
      assert.equal(proposition.placement.length, 3);
      for (const { sieges } of proposition.placement) {
        assert.equal(sieges[rang][2], 2);
        assert.notEqual(sieges[rang].at(-1), null);
      }
    }
  });

  test('réservé au siège 8 d’une table de 8 qui en assied six : au rang 8, les rangs 6 et 7 à null', () => {
    const charge = chargeGeneration({ siege: 8 });
    const configuration = configurationDepuisCharge(charge);
    const tour = { tables: [1, 2], tours: [[1, 3, 4, 5, 6, 7], [12, 2, 8, 11, 9, 10]] };
    const proposition = {
      id: 1,
      graine: 48271,
      arret: 60,
      historique: 1000,
      plan: { tables: tour.tables, tours: [tour.tours, tour.tours, tour.tours], reserves: [[], [], []] },
    };
    const { charge: apres } = executer('enregistrerGeneration', charge, { propositions: [proposition], configuration, produitVersion: VERSION.affichee });
    assert.equal(apres.propositions[0].placement.length, 3);
    for (const { sieges } of apres.propositions[0].placement) {
      assert.deepEqual(sieges, [[1, 3, 4, 5, 6, 7], [8, 9, 10, 11, 12, null, null, 2]]);
    }
    // Sans attribution, la liste reste triée par identifiant.
    const libre = chargeGeneration({ siege: 8, attribuerSieges: false });
    const { charge: triee } = executer('enregistrerGeneration', libre, {
      propositions: [proposition],
      configuration: configurationDepuisCharge(libre),
      produitVersion: VERSION.affichee,
    });
    assert.deepEqual(triee.propositions[0].placement[0].sieges, [[1, 3, 4, 5, 6, 7], [2, 8, 9, 10, 11, 12]]);
  });

  test('une table supprimée et une capacité réduite pendant la génération : la proposition s’enregistre, rangée sur la configuration, en dérive', () => {
    const charge = chargeGeneration({ siege: 3 });
    charge.tables.push({ id: 3, numero: 3, sieges: null, forme: 'ronde', position: { x: 800, y: 0 } });
    charge.prochainsIds.table = 4;
    const configuration = configurationDepuisCharge(charge);
    const tours = [[1, 3, 4], [5, 6, 2, 7, 8, 9, 10, 11], [12]];
    const proposition = {
      id: 1,
      graine: 48271,
      arret: 60,
      historique: 1000,
      plan: { tables: [1, 2, 3], tours: [tours, tours, tours], reserves: [[], [], []] },
    };
    // Entre la recherche et l'enregistrement : la table 3 disparaît, la
    // table 2 passe à six places alors que la proposition y en assied huit.
    charge.tables = charge.tables.filter(({ id }) => id !== 3);
    charge.tables[1].sieges = 6;
    const { charge: apres } = executer('enregistrerGeneration', charge, { propositions: [proposition], configuration, produitVersion: VERSION.affichee });
    assert.equal(apres.propositions.length, 1);
    const [enregistree] = apres.propositions;
    assert.deepEqual(fautes(enregistree), []);
    assert.equal(enregistree.placement.length, 3);
    for (const { sieges } of enregistree.placement) assert.deepEqual(sieges, [[1, 3, 4], [5, 6, 2, 7, 8, 9, 10, 11], [12]]);
    assert.ok(derive(enregistree, apres).length > 0);
  });

  test('une table agrandie pendant la génération, puis réservée à un siège nouveau : le rangement suit la capacité de la configuration', () => {
    const charge = chargeGeneration({ siege: null });
    charge.reservations = [];
    const configuration = configurationDepuisCharge(charge);
    const tours = [[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]];
    const proposition = {
      id: 1,
      graine: 48271,
      arret: 60,
      historique: 1000,
      plan: { tables: [1, 2], tours: [tours, tours, tours], reserves: [[], [], []] },
    };
    // Entre la recherche et l'enregistrement : la table 2 passe à dix places,
    // et 7 y est réservé au siège 9, au-delà des huit de la configuration.
    charge.tables[1].sieges = 10;
    charge.reservations = [resa(7, 2, 9)];
    const { charge: apres } = executer('enregistrerGeneration', charge, { propositions: [proposition], configuration, produitVersion: VERSION.affichee });
    assert.equal(apres.propositions.length, 1);
    const [enregistree] = apres.propositions;
    assert.deepEqual(fautes(enregistree), []);
    assert.equal(enregistree.placement.length, 3);
    // Le siège 9 n'existe pas dans la configuration : 7 se range par identifiant.
    for (const { sieges } of enregistree.placement) assert.deepEqual(sieges, tours);
  });
});

describe('commandes des places : le retenu et la présence par tour (§ 5.8, § 7.1)', () => {
  // La charge retenue où chaque personne de presences ({id: liste}) porte
  // cette présence, le retenu aligné sur elle (ajusterALaPresence) : ses
  // absentes n'y ont ni chaise ni réserve aux tours d'absence.
  function presentes(presences, options = {}) {
    const charge = chargeRetenue(options);
    for (const p of charge.participants) if (Object.hasOwn(presences, p.id)) p.presence = presences[p.id];
    charge.retenu = { proposition: 1, ...ajusterALaPresence(charge.retenu, charge).placement };
    assert.deepEqual(derive(charge.retenu, charge), []);
    return charge;
  }

  test('déposer une absente à son tour d’absence : PERSONNE_ABSENTE_AU_TOUR ; le remède, présente aux tours 1 à 3, s’exécute, puis le dépôt passe', () => {
    const charge = presentes({ 2: [2, 3] });
    assert.deepEqual(listes(charge, 1), [[1, null, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]]);
    const leve = refuse(() => executer('deplacerDansRetenu', charge, { tour: 1, participant: 2, table: 5, siege: 2 }), 'PERSONNE_ABSENTE_AU_TOUR', {
      participant: 2,
      personne: 'Théo Pervenche',
      tour: 1,
      remede: { commande: 'changerPresence', arguments: { id: 2, tours: [1, 2, 3] } },
    });
    const { remede } = leve.details;
    const presente = executer(remede.commande, charge, remede.arguments).charge;
    assert.deepEqual(reserveDe(presente, 1), [2]);
    const deposee = executer('deplacerDansRetenu', presente, { tour: 1, participant: 2, table: 5, siege: 2 }).charge;
    assert.deepEqual(listes(deposee, 1), [[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]]);
    assert.deepEqual(derive(deposee.retenu, deposee), []);
  });

  test('échanger avec une absente à son tour d’absence : PERSONNE_ABSENTE_AU_TOUR, qu’elle soit a ou b, l’autre assise ou non', () => {
    const charge = presentes({ 2: [2, 3] });
    for (const [a, b] of [
      [2, 7],
      [7, 2],
    ]) {
      refuse(() => executer('echangerDansRetenu', charge, { tour: 1, a, b }), 'PERSONNE_ABSENTE_AU_TOUR', {
        participant: 2,
        tour: 1,
        remede: { commande: 'changerPresence', arguments: { id: 2, tours: [1, 2, 3] } },
      });
    }
    // 7 retirée dans la réserve du tour 1 : l'échange avec l'absente n'est
    // pas SANS_EFFET, il est refusé de même.
    const enReserve = executer('retirerDuTour', charge, { tour: 1, participant: 7 }).charge;
    refuse(() => executer('echangerDansRetenu', enReserve, { tour: 1, a: 7, b: 2 }), 'PERSONNE_ABSENTE_AU_TOUR', { participant: 2 });
  });

  test('retirer du tour une absente, que le plan ne montre pas assise : SANS_EFFET', () => {
    const charge = presentes({ 2: [2, 3] });
    refuse(() => executer('retirerDuTour', charge, { tour: 1, participant: 2 }), 'SANS_EFFET', { commande: 'retirerDuTour' });
  });

  test('une personne que le retenu ne déclare pas y entre en réserve à ses tours de présence, absente aux autres', () => {
    const charge = chargeRetenue();
    charge.participants.push(personne(13, { presence: [1, 2] }));
    charge.prochainsIds.participant = 14;
    const { charge: apres } = executer('deplacerDansRetenu', charge, { tour: 1, participant: 13, table: 5, siege: 7 });
    assert.deepEqual(listes(apres, 1)[0], [1, 2, 3, 4, 5, 6, 13]);
    assert.deepEqual(reserveDe(apres, 2), [13]);
    assert.deepEqual(apres.retenu.placement[2].absents, [13]);
    assert.deepEqual(derive(apres.retenu, apres), []);
  });

  test('enregistrerGeneration, sièges attribués : le siège réservé d’une absente revient à qui le réserve à ce tour', () => {
    // 2 réservée « tous » au siège 3 de la table 2, absente au tour 2 ; 5
    // réservée au même siège au tour 2 seulement.
    const charge = creerCharge({ id: 'evt-generation', nom: 'Soirée des Lucioles', siegesParDefaut: 8, tours: 3 });
    charge.reglages.attribuerSieges = true;
    charge.participants = DOUZE.map((id) => personne(id, id === 2 ? { presence: [1, 3] } : {}));
    charge.tables = [
      { id: 1, numero: 1, sieges: null, forme: 'ronde', position: { x: 0, y: 0 } },
      { id: 2, numero: 2, sieges: null, forme: 'ronde', position: { x: 400, y: 0 } },
    ];
    charge.reservations = [resa(2, 2, 3), resa(5, 2, 3, 2)];
    charge.prochainsIds = { participant: 13, table: 3, proposition: 1 };
    const configuration = configurationDepuisCharge(charge);
    const tours = [
      [[1, 3, 4, 6, 7, 8], [2, 9, 10, 11, 12, 5]],
      [[1, 3, 4, 6, 7, 8], [5, 9, 10, 11, 12]],
      [[1, 3, 4, 6, 7, 8], [2, 9, 10, 11, 12, 5]],
    ];
    const proposition = { id: 1, graine: 48271, arret: 60, historique: 1000, plan: { tables: [1, 2], tours, reserves: [[], [], []] } };
    const { charge: apres } = executer('enregistrerGeneration', charge, { propositions: [proposition], configuration, produitVersion: VERSION.affichee });
    const [{ placement }] = apres.propositions;
    assert.deepEqual(placement[1].sieges[1], [9, 10, 5, 11, 12]);
    assert.deepEqual(placement[1].absents, [2]);
    for (const rang of [0, 2]) assert.equal(placement[rang].sieges[1][2], 2);
  });
});

describe('commandes des places : les textes de leurs codes (§ 14.6)', () => {
  // Détails d'exemple de chaque code de libelles/places.js, hors libellés
  // figés, que les commandes composent ci-dessus.
  const EXEMPLES = new Map([
    ['SIEGE_INEXISTANT', [{ table: 2, siege: 9, capacite: 8 }, '9']],
    ['DEUX_PLACES_MEME_TOUR', [{ participant: 1, tour: 2, autre: { table: 1, siege: null, portee: 'tous', tour: null } }, 'tour 2']],
    ['PERSONNE_EXCLUE', [{ participant: 3 }, 'exclue']],
    ['PERSONNE_ABSENTE_AU_TOUR', [{ participant: 2, personne: 'Théo Pervenche', tour: 3 }, 'absente au tour 3']],
    ['PLACE_RESERVEE', [{ table: 2, siege: 3, tour: 2, titulaire: 2, portee: 'tour' }, 'au tour 2']],
    ['RESERVEE_AILLEURS', [{ participant: 1, tour: 2, reservation: { table: 1, siege: null, portee: 'tous', tour: null } }, 'tour 2']],
    ['TABLE_GELEE', [{ table: 1 }, 'réservées']],
    ['LIBELLE_VIDE', [{}, 'vide']],
    ['PLACE_TITREE', [{ table: 3, siege: 1, libelle: 'hôte' }, '« hôte »']],
    ['AUCUN_SIEGE_SANS_TITRE', [{ table: 1, capacite: 2 }, '2 sièges']],
    ['TITRE_ABSENT', [{ table: 3, siege: 1 }, 'siège 1']],
    ['RESERVATION_ABSENTE', [{ participant: 1, table: 3, portee: 'tour', tour: 2 }, 'réservation']],
    ['CONVERSION_IMPOSSIBLE', [{ participant: 1, table: 3 }, 'convertir']],
    ['PROPOSITION_MONTREE', [{ proposition: 4 }, 'n° 4']],
    ['SIEGE_OCCUPE', [{ table: 5, siege: 2, tour: 1, occupant: 2 }, 'siège 2']],
    ['TABLE_PLEINE', [{ table: 5, tour: 1, capacite: 6 }, '6 places']],
    // Le refus du dépôt sur le sol (src/interface/plan/depot.js) et de
    // « Retirer du tour », dont le texte vit ici.
    ['RESERVATION_TOUS_LES_TOURS', [{ participant: 1, table: 3 }, 'tous les tours']],
    // Le refus du dépôt sur le sol et de « Retirer du tour » sous le
    // retenu, pour une réservation de ce tour.
    ['RESERVATION_CE_TOUR', [{ participant: 1, table: 3, tour: 2 }, 'au tour 2']],
    // La cause du refus d'une personne absente à un tour, dans un lot de
    // designerAnimateurs.
    ['ABSENT_AU_TOUR', [{ participant: 6, personne: 'Capucine Sarcelle', tour: 2 }, 'présente au tour 2']],
    // Le refus d'une personne d'un lot de designerAnimateurs : son nom, puis
    // le texte de sa cause.
    [
      'ANIMATEUR_REFUSE',
      [{ participant: 3, personne: 'Ondine Lacasse', refus: { code: 'PERSONNE_EXCLUE', details: { participant: 3 } } }, 'Ondine Lacasse'],
    ],
  ]);

  test('chaque code de la table des places a son texte, composé de ses détails', () => {
    const codes = [...TEXTES_DES_PLACES.keys()].filter((cle) => /^[A-Z][A-Z0-9_]*$/.test(cle) && !cle.startsWith('ENTREE_'));
    assert.ok(codes.length > 0);
    assert.deepEqual(codes.sort(), [...EXEMPLES.keys()].sort());
    for (const [code, [details, attendu]] of EXEMPLES) {
      const texte = libelle(code, { ...details, remede: null });
      assert.ok(texte.includes(attendu), `${code} : ${texte}`);
      assert.ok(!texte.includes('undefined'), `${code} : ${texte}`);
    }
    assert.ok(libelle('PLACE_RESERVEE', { siege: 3, tour: null, portee: 'tous' }).includes('à tous les tours'));
    // Le refus du dépôt sur le sol, et de « Retirer du tour », dit ce que le
    // retrait d'un seul tour ne fait pas, sans rien promettre du glissement
    // vers une autre chaise : deplacerReservation y garde la portée « tous »,
    // et la déplace à chaque tour.
    const tous = libelle('RESERVATION_TOUS_LES_TOURS', { participant: 1, table: 3, remede: null });
    assert.ok(tous.includes('pour un seul tour'), tous);
    assert.ok(!tous.includes('ne change que'), tous);
    // Celui d'une réservation de ce tour dit que seule celle-ci part.
    const ceTour = libelle('RESERVATION_CE_TOUR', { participant: 1, table: 3, tour: 2, remede: null });
    assert.ok(ceTour.includes('ce tour seulement'), ceTour);
    assert.equal(libelle('places.titreParDefaut'), 'animateur');
  });
});
