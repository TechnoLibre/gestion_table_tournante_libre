// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de la proposition choisie, expliquée sous la carte de tout
// l'événement du diagnostic (§ 5.5, § 5.6, § 12.2, § 12.10) : laquelle — la
// proposition demandée au plan, sinon le retenu, sinon la meilleure du
// classement —, puis ce qui est atteint, ce qui manque et pourquoi, et ce
// qu'on peut tenter, chaque phrase portant les chiffres de la ligne
// d'évaluation, ceux que le tableau des propositions écrit. Les charges
// s'écrivent ici, propositions comprises, sur des noms inventés ; chaque
// valeur attendue se compte à la main sur le plan écrit.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { appliquerCommande } from '../../application/commandes.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { capacite, creerCharge } from '../../stockage/document.js';
import { VERSION } from '../../version.genere.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { propositionChoisie } from './proposition.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const P = 'diagnostic.proposition';
const phrase = (cle, details = {}) => ({ cle: `${P}.${cle}`, details });
const bloc = (nom, phrases) => ({ nom, titre: `${P}.bloc.${nom}`, phrases });

// --- Les charges d'épreuve ---------------------------------------------------------

/**
 * Une charge construite : une personne par organisation donnée (null : sans
 * organisation), d'identifiants 1 à N ; une table par capacité, d'identifiant
 * et de numéro 1 à T ; presence[id], quand il est donné, les tours de
 * présence de la personne id ; reglages, les réglages qui changent.
 */
function chargeDe({ organisations, capacites, tours = 4, presence = {}, reglages = {} }) {
  const charge = creerCharge({ id: 'evt-proposition', nom: 'Soirée des Sarcelles', siegesParDefaut: 3, tours });
  charge.participants = organisations.map((organisation, rang) => ({
    id: rang + 1,
    nom: `Ombrelle${rang + 1}`,
    prenom: 'Capucine',
    organisation,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
    ...(presence[rang + 1] === undefined ? {} : { presence: presence[rang + 1] }),
  }));
  charge.tables = capacites.map((c, rang) => ({ id: rang + 1, numero: rang + 1, sieges: c === 3 ? null : c, forme: 'ronde', position: { x: 300 * rang, y: 0 } }));
  charge.prochainsIds = { participant: organisations.length + 1, table: capacites.length + 1, proposition: 1 };
  charge.reglages = { ...charge.reglages, ...reglages };
  return charge;
}

// Une proposition écrite à la main, sur les tables de la charge ; ses listes
// données tour par tour, absents[r] les absents du tour r + 1.
function propositionDe(charge, id, tours, absents = []) {
  return {
    id,
    graine: id,
    arret: 40,
    historique: 1000,
    produitVersion: VERSION.affichee,
    siegesAttribues: false,
    tables: charge.tables.map(({ id: table }) => table),
    capacites: charge.tables.map((table) => capacite(charge, table)),
    tours: tours.length,
    participants: charge.participants.map(({ id: p }) => p),
    placement: tours.map((listes, r) => ({
      sieges: listes.map((liste) => [...liste]),
      reserve: [],
      ...(absents[r] === undefined || absents[r].length === 0 ? {} : { absents: [...absents[r]] }),
    })),
  };
}

// La charge, ses propositions posées, le prochain identifiant après elles.
function avecPropositions(charge, propositions) {
  charge.propositions = propositions;
  charge.prochainsIds.proposition = Math.max(...propositions.map(({ id }) => id)) + 1;
  return charge;
}

const sans = (n) => Array.from({ length: n }, () => null);

// Six personnes, deux tables de 3, quatre tours ; les deux premières sont
// collègues. Le plafond a priori de chacune vaut 5 : les cinq autres.
const SIX = ['Club des Merles', 'Club des Merles', null, null, null, null];
// Les collègues ensemble aux quatre tours : chacun rencontre les cinq
// autres, 4 collisions sur une seule paire, excédent 3.
const ENSEMBLE = [
  [[1, 2, 3], [4, 5, 6]],
  [[1, 2, 4], [3, 5, 6]],
  [[1, 2, 5], [3, 4, 6]],
  [[1, 2, 6], [3, 4, 5]],
];
// Les collègues séparés : chacun n'en rencontre que 4, 12 paires revues,
// au plus 2 fois chacune ; aucune collision.
const SEPARES = [
  [[1, 3, 4], [2, 5, 6]],
  [[1, 5, 6], [2, 3, 4]],
  [[1, 3, 5], [2, 4, 6]],
  [[1, 4, 6], [2, 3, 5]],
];
// Onze personnes, trois tours : la 10 à la quatrième table aux trois tours,
// chaque fois avec une autre ; aucune paire ne se croise deux fois.
const ONZE_INCOMPLETE = [
  [[7, 11, 2], [6, 1, 9], [4, 8, 3], [10, 5]],
  [[6, 8, 7], [3, 11, 9], [5, 4, 1], [10, 2]],
  [[7, 3, 1], [11, 5, 8], [6, 4, 2], [10, 9]],
];
const chargeSix = (reglages = {}) =>
  avecPropositions(chargeDe({ organisations: SIX, capacites: [3, 3], reglages }), [
    propositionDe(chargeDe({ organisations: SIX, capacites: [3, 3] }), 1, ENSEMBLE),
    propositionDe(chargeDe({ organisations: SIX, capacites: [3, 3] }), 2, SEPARES),
  ]);
const ARRET = chargeSix().reglages.generation.arret;

// Ce que la séparation donne, la proposition 2 : rien n'y manque que les
// revoirs.
const BLOCS_SEPARES = [
  bloc('atteint', [
    phrase('rencontres', { minimum: 4, plafond: 5 }),
    phrase('collisions.aucune'),
    phrase('retours', { retours: 14 }),
    phrase('diversite', { organisations: 0, redondance: 4, diversite: 0.5 }),
  ]),
  bloc('manque', [
    phrase('manque.ecart', { ecart: 1 }),
    phrase('manque.itineraireNul'),
    phrase('manque.revoirs', { manque: 1, effectif: 6 }),
    phrase('manque.repetees', { repetees: 12, maxPaire: 2 }),
    phrase('manque.inconnue'),
  ]),
];

// Toutes les phrases d'une proposition choisie, traduites : la carte entière.
const textes = (choisie) => [
  t(choisie.laquelle.cle, choisie.laquelle.details),
  ...(choisie.statut === null ? [] : [t(choisie.statut.cle, choisie.statut.details)]),
  ...choisie.blocs.flatMap(({ titre, phrases }) => [t(titre), ...phrases.map(({ cle, details }) => t(cle, details))]),
];

const executer = (charge, nom, args) => appliquerCommande(nom, charge, args).charge;

// --- Les épreuves ------------------------------------------------------------------

describe('propositionChoisie : laquelle (§ 5.6)', () => {
  test('sans charge, ou une configuration que la mesure refuse : null', () => {
    assert.equal(propositionChoisie(null), null);
    const charge = chargeSix();
    charge.reservations = [1, 2, 3, 4].map((participant) => ({ participant, table: 1, siege: null, portee: 'tous', tour: null }));
    assert.equal(propositionChoisie(charge, { demandee: 1 }), null);
  });

  test('aucune proposition : la carte dit d’en générer une, sans bloc', () => {
    const charge = chargeDe({ organisations: SIX, capacites: [3, 3] });
    assert.deepEqual(propositionChoisie(charge), {
      genre: 'aucune',
      id: null,
      laquelle: phrase('laquelle.aucune'),
      statut: null,
      blocs: [],
    });
  });

  test('la proposition demandée au plan, montrée : la 2, ses trois blocs', () => {
    assert.deepEqual(propositionChoisie(chargeSix(), { demandee: 2 }), {
      genre: 'montree',
      id: 2,
      laquelle: phrase('laquelle.montree', { proposition: 2 }),
      statut: null,
      blocs: [...BLOCS_SEPARES, bloc('tenter', [phrase('tenter.repartir', { proposition: 2, arret: ARRET })])],
    });
  });

  test('sans demande, ou une demande que la liste n’a plus : la meilleure du classement, la 2, devant la 1 que l’excédent recule', () => {
    for (const demandee of [null, 99]) {
      const choisie = propositionChoisie(chargeSix(), { demandee });
      assert.equal(choisie.genre, 'meilleure');
      assert.equal(choisie.id, 2);
      assert.deepEqual(choisie.laquelle, phrase('laquelle.meilleure', { proposition: 2 }));
      assert.deepEqual(choisie.blocs.slice(0, 2), BLOCS_SEPARES);
    }
  });

  test('le retenu, sans demande : « Générer » de nouveau plutôt que « Repartir d’elle », que le retenu n’offre pas ; une demande passe devant lui', () => {
    const retenue = executer(chargeSix(), 'retenirProposition', { id: 2 });
    const choisie = propositionChoisie(retenue);
    assert.equal(choisie.genre, 'retenu');
    assert.equal(choisie.id, 'retenu');
    assert.deepEqual(choisie.laquelle, phrase('laquelle.retenu'));
    assert.deepEqual(choisie.blocs, [...BLOCS_SEPARES, bloc('tenter', [phrase('tenter.generer', { arret: ARRET })])]);
    const demandee = propositionChoisie(retenue, { demandee: 1 });
    assert.equal(demandee.genre, 'montree');
    assert.equal(demandee.id, 1);
  });

  test('une proposition en dérive, demandée : elle le dit, sans chiffres ; sans demande, aucune ne se classe', () => {
    const charge = chargeSix();
    charge.participants[5] = { ...charge.participants[5], exclu: true };
    assert.deepEqual(propositionChoisie(charge, { demandee: 2 }), {
      genre: 'montree',
      id: 2,
      laquelle: phrase('laquelle.demandee', { proposition: 2 }),
      statut: phrase('statut.derive'),
      blocs: [],
    });
    assert.deepEqual(propositionChoisie(charge), {
      genre: 'aucuneClassee',
      id: null,
      laquelle: phrase('laquelle.aucuneClassee'),
      statut: null,
      blocs: [],
    });
  });

  test('une proposition fautive, demandée : elle le dit, sans chiffres', () => {
    const charge = chargeDe({ organisations: sans(6), capacites: [3, 3], tours: 2 });
    avecPropositions(charge, [propositionDe(charge, 1, [[[1, 2, 3], [4, 5, 6]], [[1, 2, 3], [4, 5]]])]);
    assert.deepEqual(propositionChoisie(charge, { demandee: 1 }), {
      genre: 'montree',
      id: 1,
      laquelle: phrase('laquelle.demandee', { proposition: 1 }),
      statut: phrase('statut.fautif'),
      blocs: [],
    });
  });
});

describe('propositionChoisie : ce qui est atteint, ce qui manque, ce qu’on peut tenter (§ 5.5, § 12.10)', () => {
  test('au minimum : la 1, chacun à son plafond a priori — ce qui manque se dit nul, rien n’est à tenter pour les rencontres, et l’excédent des collisions se reprend par « Repartir d’elle »', () => {
    assert.deepEqual(propositionChoisie(chargeSix(), { demandee: 1 }).blocs, [
      bloc('atteint', [
        phrase('rencontres', { minimum: 5, plafond: 5 }),
        phrase('collisions', { collisions: 4, paires: 1, excedent: 3, plancher: false }),
        phrase('retours', { retours: 14 }),
        phrase('diversite', { organisations: 1, redondance: 4, diversite: 0.5 }),
      ]),
      bloc('manque', [phrase('manque.aucun')]),
      bloc('tenter', [phrase('tenter.rien'), phrase('tenter.repartir', { proposition: 1, arret: ARRET })]),
    ]);
  });

  test('une paire réservée ensemble aux trois tours : les paires choisies revues se comptent, sans maximum par paire, que la paire imposée fausserait', () => {
    // Neuf personnes, trois tables de 3, trois tours ; 1 et 2 réservées à la
    // table 1 : elles se croisent 3 fois, aucune paire choisie plus de 2.
    const charge = chargeDe({ organisations: sans(9), capacites: [3, 3, 3], tours: 3 });
    charge.reservations = [1, 2].map((participant) => ({ participant, table: 1, siege: null, portee: 'tous', tour: null }));
    avecPropositions(charge, [
      propositionDe(charge, 1, [
        [[1, 2, 5], [4, 8, 7], [9, 6, 3]],
        [[1, 2, 5], [9, 3, 7], [4, 8, 6]],
        [[1, 2, 6], [5, 8, 3], [7, 4, 9]],
      ]),
    ]);
    const manque = propositionChoisie(charge, { demandee: 1 }).blocs.find(({ nom }) => nom === 'manque');
    const repetees = manque.phrases.find(({ cle }) => cle === `${P}.manque.repetees`);
    assert.deepEqual(repetees, phrase('manque.repetees', { repetees: 6, maxPaire: null }));
    assert.equal(t(repetees.cle, repetees.details), "6 paires se croisent à plus d'un tour sans qu'une réservation l'impose.");
  });

  test('une règle décochée se tait : sans séparation, sans « nouvelle table », sans variété, seules les rencontres parlent', () => {
    const charge = chargeSix({ separerOrganisations: false, nouvelleTable: false, varierOrganisations: false });
    const { blocs } = propositionChoisie(charge, { demandee: 1 });
    assert.deepEqual(blocs[0], bloc('atteint', [phrase('rencontres', { minimum: 5, plafond: 5 })]));
    // Sans séparation, l'excédent des collisions ne compte plus : au minimum
    // atteint, rien n'est à tenter.
    assert.deepEqual(blocs.at(-1), bloc('tenter', [phrase('tenter.rien')]));
  });

  test('une place vide à chaque tour : la place coûte une rencontre, que nul placement n’évite, et seules les tables la règlent', () => {
    // Huit personnes sans organisation, trois tables de 3, deux tours : les
    // quatre assises à la table incomplète en rencontrent 3 sur 4. Aucun
    // plancher n'est prouvé quand les places dépassent les présents, mais
    // une table incomplète à chaque tour coûte 1 à qui s'y assoit : une
    // relance ne descend pas sous cette perte de 1.
    const charge = chargeDe({ organisations: sans(8), capacites: [3, 3, 3], tours: 2 });
    avecPropositions(charge, [propositionDe(charge, 1, [[[1, 2, 3], [4, 5, 6], [7, 8]], [[1, 4, 7], [2, 5, 8], [3, 6]]])]);
    assert.deepEqual(propositionChoisie(charge, { demandee: 1 }).blocs, [
      bloc('atteint', [phrase('rencontres', { minimum: 3, plafond: 4 }), phrase('retours', { retours: 2 })]),
      bloc('manque', [
        phrase('manque.ecart', { ecart: 1 }),
        phrase('manque.itineraire', { ecart: 1 }),
        phrase('manque.placesVides', { placesVides: 1, places: 9, presents: 8 }),
        phrase('manque.revoirsNul'),
        phrase('manque.inconnue'),
      ]),
      bloc('tenter', [phrase('tenter.tables')]),
    ]);
  });

  test('la même personne à la table incomplète aux trois tours : sans revoir, la perte par la place se reprend par « Repartir d’elle », et les tables', () => {
    // Onze personnes, quatre tables de 3, trois tours : la 10 s'assoit à la
    // table incomplète aux trois tours et ne rencontre que 3 personnes sur
    // les 6 de son plafond a priori ; aucune paire ne se croise deux fois.
    const charge = chargeDe({ organisations: sans(11), capacites: [3, 3, 3, 3], tours: 3 });
    avecPropositions(charge, [propositionDe(charge, 1, ONZE_INCOMPLETE)]);
    assert.deepEqual(propositionChoisie(charge, { demandee: 1 }).blocs.slice(1), [
      bloc('manque', [
        phrase('manque.ecart', { ecart: 3 }),
        phrase('manque.itineraire', { ecart: 3 }),
        phrase('manque.placesVides', { placesVides: 1, places: 12, presents: 11 }),
        phrase('manque.revoirsNul'),
        phrase('manque.inconnue'),
      ]),
      bloc('tenter', [phrase('tenter.repartir', { proposition: 1, arret: ARRET }), phrase('tenter.tables')]),
    ]);
  });

  test('tables pleines, un écart d’itinéraire au-dessus du plancher prouvé, sans revoir : « Repartir d’elle » vise l’écart, le plafond de chacun se dit hors d’atteinte', () => {
    // Le même plan sur des tables de 3, 3, 3 et 2, toutes pleines : le
    // diagnostic prouve un écart d'itinéraire maximal d'au moins 1, pour 2
    // mobiles au moins ; la 10, à la table de 2 aux trois tours, en perd 3.
    const charge = chargeDe({ organisations: sans(11), capacites: [3, 3, 3, 2], tours: 3 });
    avecPropositions(charge, [propositionDe(charge, 1, ONZE_INCOMPLETE)]);
    assert.deepEqual(propositionChoisie(charge, { demandee: 1 }).blocs.slice(1), [
      bloc('manque', [
        phrase('manque.ecart', { ecart: 3 }),
        phrase('manque.itineraire', { ecart: 3 }),
        phrase('manque.plancherItineraire', { plancher: 1, atteint: false }),
        phrase('manque.revoirsNul'),
        phrase('manque.horsAtteinte', { mobiles: 2 }),
      ]),
      bloc('tenter', [phrase('tenter.repartir', { proposition: 1, arret: ARRET }), phrase('tenter.capacites')]),
    ]);
  });

  test('une absence : les plafonds a priori au minimum diffèrent, les places vides varient selon le tour, et les deux plus grands ne s’additionnent pas', () => {
    // Six personnes, deux tables de 3, deux tours ; la 6 n'est là qu'au
    // premier. Chacun rencontre 2 personnes : la 6 sur 2 possibles, les
    // autres sur 4.
    const charge = chargeDe({ organisations: sans(6), capacites: [3, 3], tours: 2, presence: { 6: [1] } });
    avecPropositions(charge, [propositionDe(charge, 1, [[[1, 2, 3], [4, 5, 6]], [[1, 2, 3], [4, 5]]], [[], [6]])]);
    assert.deepEqual(propositionChoisie(charge, { demandee: 1 }).blocs, [
      bloc('atteint', [phrase('rencontres.entre', { minimum: 2, de: 2, a: 4 }), phrase('retours', { retours: 5 })]),
      bloc('manque', [
        phrase('manque.ecart', { ecart: 2 }),
        phrase('manque.itineraire', { ecart: 1 }),
        phrase('manque.placesVidesSelonTour', { placesVides: 1 }),
        phrase('manque.revoirs', { manque: 2, effectif: 5 }),
        phrase('manque.repetees', { repetees: 4, maxPaire: 2 }),
        phrase('manque.nonAdditifs'),
        phrase('manque.inconnue'),
      ]),
      bloc('tenter', [phrase('tenter.repartir', { proposition: 1, arret: ARRET }), phrase('tenter.tables')]),
    ]);
  });

  test('les deux plus grands sur les mêmes personnes : ils s’additionnent, et la phrase qui les dit séparés se tait', () => {
    // La 6 n'est là qu'au premier tour. Au second, la 3 et la 5, déjà
    // réunies, s'assoient seules à une table de 3 : chacune perd une
    // rencontre par la place et une par le revoir, 2 sur son plafond de 4.
    const charge = chargeDe({ organisations: sans(6), capacites: [3, 3], tours: 2, presence: { 6: [1] } });
    avecPropositions(charge, [propositionDe(charge, 1, [[[1, 2, 6], [3, 4, 5]], [[1, 2, 4], [3, 5]]], [[], [6]])]);
    assert.deepEqual(propositionChoisie(charge, { demandee: 1 }).blocs[1], bloc('manque', [
      phrase('manque.ecart', { ecart: 2 }),
      phrase('manque.itineraire', { ecart: 1 }),
      phrase('manque.placesVidesSelonTour', { placesVides: 1 }),
      phrase('manque.revoirs', { manque: 1, effectif: 4 }),
      phrase('manque.repetees', { repetees: 2, maxPaire: 2 }),
      phrase('manque.inconnue'),
    ]));
  });

  test('des capacités différentes : l’écart d’itinéraire à son plancher prouvé, que seules les tables changent, et le plafond de chacun hors d’atteinte', () => {
    // Huit personnes, tables de 3, 3 et 2, toutes pleines, deux tours : le
    // diagnostic prouve un écart d'itinéraire maximal d'au moins 1, pour 2
    // mobiles au moins : aucun placement n'atteint le plafond de chacun.
    const charge = chargeDe({ organisations: sans(8), capacites: [3, 3, 2], tours: 2 });
    avecPropositions(charge, [propositionDe(charge, 1, [[[1, 2, 3], [4, 5, 6], [7, 8]], [[1, 4, 7], [2, 5, 8], [3, 6]]])]);
    const { blocs } = propositionChoisie(charge, { demandee: 1 });
    assert.deepEqual(blocs.slice(1), [
      bloc('manque', [
        phrase('manque.ecart', { ecart: 1 }),
        phrase('manque.itineraire', { ecart: 1 }),
        phrase('manque.plancherItineraire', { plancher: 1, atteint: true }),
        phrase('manque.revoirsNul'),
        phrase('manque.horsAtteinte', { mobiles: 2 }),
      ]),
      bloc('tenter', [phrase('tenter.capacites')]),
    ]);
  });

  test('deux ancrés en conflit, réservés ensemble : les mobiles et les ancrés à part, les conflits imposés ; séparés, aucun conflit', () => {
    const organisations = ['Club des Merles', null, 'Cercle des Hérons', null, null, null];
    const charge = chargeDe({ organisations, capacites: [3, 3], tours: 2 });
    charge.participants[0].conflits = ['Cercle des Hérons'];
    charge.reservations = [1, 3].map((participant) => ({ participant, table: 1, siege: null, portee: 'tous', tour: null }));
    avecPropositions(charge, [propositionDe(charge, 1, [[[1, 2, 3], [4, 5, 6]], [[1, 3, 4], [2, 5, 6]]])]);
    const [atteint] = propositionChoisie(charge, { demandee: 1 }).blocs;
    assert.deepEqual(atteint.phrases.slice(0, 3), [
      phrase('rencontres.entre', { minimum: 3, de: 3, a: 4 }),
      phrase('populations', { mobiles: 3, ancres: 3 }),
      phrase('conflits', { conflits: 2, imposes: true }),
    ]);

    const separee = chargeDe({ organisations, capacites: [3, 3], tours: 2 });
    separee.participants[0].conflits = ['Cercle des Hérons'];
    avecPropositions(separee, [propositionDe(separee, 1, [[[1, 2, 4], [3, 5, 6]], [[1, 5, 6], [2, 3, 4]]])]);
    assert.deepEqual(propositionChoisie(separee, { demandee: 1 }).blocs[0].phrases[1], phrase('conflits.aucun'));
  });

  test('trois collègues pour deux tables : 3 collisions en 3 paires, le plancher que le diagnostic prouve', () => {
    const charge = chargeDe({ organisations: ['Club des Merles', 'Club des Merles', 'Club des Merles', null, null, null], capacites: [3, 3], tours: 3 });
    avecPropositions(charge, [propositionDe(charge, 1, [[[1, 2, 4], [3, 5, 6]], [[1, 3, 5], [2, 4, 6]], [[2, 3, 6], [1, 4, 5]]])]);
    assert.deepEqual(propositionChoisie(charge, { demandee: 1 }).blocs[0].phrases[1], phrase('collisions', { collisions: 3, paires: 3, excedent: 0, plancher: true }));
  });

  test('deux organisations en conflit : au plancher renforcé sans conflit, ses collisions sont au minimum et « Repartir d’elle » ne les vise plus ; un conflit les abaisse au plancher par groupe', () => {
    // Trois collègues du Club des Merles, qui nomme le Cercle des Hérons, un
    // membre ; deux tables de 3, un tour. Seul, le Club porte au moins 1
    // collision ; séparé du Cercle, il n'a qu'une table : au moins 3.
    const organisations = ['Club des Merles', 'Club des Merles', 'Club des Merles', 'Cercle des Hérons', null, null];
    const enConflit = () => {
      const charge = chargeDe({ organisations, capacites: [3, 3], tours: 1 });
      charge.participants[0].conflits = ['Cercle des Hérons'];
      return charge;
    };
    const charge = avecPropositions(enConflit(), [
      propositionDe(enConflit(), 1, [[[1, 2, 3], [4, 5, 6]]]),
      propositionDe(enConflit(), 2, [[[1, 2, 4], [3, 5, 6]]]),
    ]);
    const phrases = (choisie, nom) => choisie.blocs.find((b) => b.nom === nom).phrases;
    const cles = (liste) => liste.map(({ cle }) => cle);

    const separee = propositionChoisie(charge, { demandee: 1 });
    const atteint = phrases(separee, 'atteint');
    const rang = cles(atteint).indexOf(`${P}.collisions`);
    assert.deepEqual(atteint.slice(rang, rang + 2), [
      phrase('collisions', { collisions: 3, paires: 3, excedent: 0, plancher: false }),
      phrase('collisions.minimum'),
    ]);
    assert.ok(cles(atteint).includes(`${P}.conflits.aucun`));
    assert.deepEqual(phrases(separee, 'tenter'), [phrase('tenter.rien')]);

    // Deux conflits : 1 collision, le plancher par groupe, qui vaut pour tout
    // placement ; les conflits se reprennent par « Repartir d’elle ».
    const melee = propositionChoisie(charge, { demandee: 2 });
    assert.ok(phrases(melee, 'atteint').some((p) => p.cle === `${P}.collisions` && p.details.plancher === true));
    assert.ok(!cles(phrases(melee, 'atteint')).includes(`${P}.collisions.minimum`));
    assert.ok(cles(phrases(melee, 'tenter')).includes(`${P}.tenter.repartir`));

    // Sans le conflit, le plancher reste celui du groupe : 3 collisions le
    // dépassent, et « Repartir d’elle » les vise.
    const sansConflit = chargeDe({ organisations, capacites: [3, 3], tours: 1 });
    avecPropositions(sansConflit, [propositionDe(sansConflit, 1, [[[1, 2, 3], [4, 5, 6]]])]);
    const libre = propositionChoisie(sansConflit, { demandee: 1 });
    assert.ok(!cles(phrases(libre, 'atteint')).includes(`${P}.collisions.minimum`));
    assert.ok(cles(phrases(libre, 'tenter')).includes(`${P}.tenter.repartir`));
  });

  test('un plan qui porte des conflits, à collisions égales au plancher renforcé : jamais « au minimum », ce plancher ne vaut que sans conflit', () => {
    // Trois membres du Club des Merles, qui nomme le Cercle des Hérons, un
    // membre ; deux personnes sans organisation ; tables de 4 et de 2, un
    // tour. Séparé du Cercle, le Club n'a qu'une table : au moins 3
    // collisions. Le plan assoit les quatre ensemble : 3 collisions, autant
    // que ce plancher, et 3 conflits.
    const charge = chargeDe({ organisations: ['Club des Merles', 'Club des Merles', 'Club des Merles', 'Cercle des Hérons', null, null], capacites: [4, 2], tours: 1 });
    charge.participants[0].conflits = ['Cercle des Hérons'];
    avecPropositions(charge, [propositionDe(charge, 1, [[[1, 2, 3, 4], [5, 6]]])]);
    const atteint = propositionChoisie(charge, { demandee: 1 }).blocs.find((b) => b.nom === 'atteint').phrases;
    assert.ok(atteint.some((p) => p.cle === `${P}.conflits` && p.details.conflits === 3));
    assert.ok(atteint.some((p) => p.cle === `${P}.collisions` && p.details.collisions === 3));
    assert.ok(!atteint.some(({ cle }) => cle === `${P}.collisions.minimum`));
  });

  test('un plan sans conflit, au plancher renforcé, qui viole une réservation hors de l’étoile : jamais « au minimum », la phrase ne vaut que sur un plan qui honore les réservations', () => {
    // La charge du Club des Merles contre le Cercle des Hérons, tables de 3 ;
    // la personne 5, sans organisation, est réservée à la table 1, et le plan
    // l'assoit à la table 2.
    const charge = chargeDe({ organisations: ['Club des Merles', 'Club des Merles', 'Club des Merles', 'Cercle des Hérons', null, null], capacites: [3, 3], tours: 1 });
    charge.participants[0].conflits = ['Cercle des Hérons'];
    charge.reservations = [{ participant: 5, table: 1, siege: null, portee: 'tous', tour: null }];
    avecPropositions(charge, [propositionDe(charge, 1, [[[1, 2, 3], [4, 5, 6]]])]);
    const atteint = propositionChoisie(charge, { demandee: 1 }).blocs.find((b) => b.nom === 'atteint').phrases;
    assert.ok(atteint.some(({ cle }) => cle === `${P}.conflits.aucun`));
    assert.ok(atteint.some((p) => p.cle === `${P}.collisions` && p.details.collisions === 3));
    assert.ok(!atteint.some(({ cle }) => cle === `${P}.collisions.minimum`));
  });

  test('un objectif et des animateurs, critères comptés : leur phrase chacun ; critère décoché, la phrase se tait, la mesure restant dans la ligne', () => {
    const objectifs = (respecterObjectifs) => {
      const charge = chargeDe({ organisations: sans(6), capacites: [3, 3], tours: 2, reglages: { respecterObjectifs } });
      charge.participants[0].etiquettes = ['finance'];
      charge.participants[1].etiquettes = ['finance'];
      charge.tables[0].objectifs = [{ portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] }];
      return avecPropositions(charge, [propositionDe(charge, 1, [[[1, 3, 4], [2, 5, 6]], [[1, 2, 3], [4, 5, 6]]])]);
    };
    const phraseDe = (charge, cle) => propositionChoisie(charge, { demandee: 1 }).blocs[0].phrases.find((p) => p.cle === `${P}.${cle}`);
    assert.deepEqual(phraseDe(objectifs(true), 'objectifs'), phrase('objectifs', { horsObjectif: 1, jamaisServies: 0 }));
    assert.equal(phraseDe(objectifs(false), 'objectifs'), undefined);

    const animee = (rencontrerAnimateurs) => {
      const charge = chargeDe({ organisations: ['Club des Merles', 'Cercle des Hérons', null, null, null, null], capacites: [3, 3], tours: 2, reglages: { rencontrerAnimateurs } });
      charge.reservations = [1, 2].map((participant) => ({ participant, table: participant, siege: 1, portee: 'tous', tour: null }));
      charge.titres = [1, 2].map((table) => ({ table, siege: 1, libelle: 'Animatrice' }));
      return avecPropositions(charge, [{ ...propositionDe(charge, 1, [[[1, 3, 4], [2, 5, 6]], [[1, 3, 5], [2, 4, 6]]]), siegesAttribues: true }]);
    };
    assert.deepEqual(phraseDe(animee(true), 'animateurs'), phrase('animateurs', { minimum: 1, nonRencontres: 2 }));
    assert.equal(phraseDe(animee(false), 'animateurs'), undefined);
  });

  test('un plan qui viole une réservation : les conflits et les collisions égalent leur plancher, sans s’en réclamer', () => {
    // Les conflits : la 1 et la 3, en conflit, réservées ensemble à la
    // table 1 ; la 5, réservée à la table 2, passe au second tour à la
    // table 1. Les 2 conflits égalent les conflits imposés.
    const organisations = ['Club des Merles', null, 'Cercle des Hérons', null, null, null];
    const conflits = chargeDe({ organisations, capacites: [3, 3], tours: 2 });
    conflits.participants[0].conflits = ['Cercle des Hérons'];
    conflits.reservations = [[1, 1], [3, 1], [5, 2]].map(([participant, table]) => ({ participant, table, siege: null, portee: 'tous', tour: null }));
    avecPropositions(conflits, [propositionDe(conflits, 1, [[[1, 2, 3], [4, 5, 6]], [[1, 3, 5], [2, 4, 6]]])]);
    assert.deepEqual(propositionChoisie(conflits, { demandee: 1 }).blocs[0].phrases[2], phrase('conflits', { conflits: 2, imposes: false }));

    // Les collisions : trois collègues pour deux tables, 3 collisions, le
    // plancher prouvé ; la 4, réservée à la table 1, passe au troisième tour
    // à la table 2.
    const collisions = chargeDe({ organisations: ['Club des Merles', 'Club des Merles', 'Club des Merles', null, null, null], capacites: [3, 3], tours: 3 });
    collisions.reservations = [{ participant: 4, table: 1, siege: null, portee: 'tous', tour: null }];
    avecPropositions(collisions, [propositionDe(collisions, 1, [[[1, 4, 5], [2, 3, 6]], [[1, 3, 4], [2, 5, 6]], [[2, 3, 6], [1, 4, 5]]])]);
    assert.deepEqual(
      propositionChoisie(collisions, { demandee: 1 }).blocs[0].phrases[2],
      phrase('collisions', { collisions: 3, paires: 2, excedent: 1, plancher: false }),
    );
  });
});

describe('propositionChoisie : les phrases à l’écran (§ 5.6)', () => {
  test('chaque phrase de chaque cas se traduit, sans clé ni chiffre manquant', () => {
    const cas = [
      propositionChoisie(chargeDe({ organisations: SIX, capacites: [3, 3] })),
      propositionChoisie(chargeSix(), { demandee: 1 }),
      propositionChoisie(chargeSix(), { demandee: 2 }),
      propositionChoisie(executer(chargeSix(), 'retenirProposition', { id: 2 })),
    ];
    for (const choisie of cas) {
      for (const texte of textes(choisie)) {
        assert.equal(typeof texte, 'string');
        assert.ok(texte.length > 0);
        assert.doesNotMatch(texte, /undefined|NaN|null|diagnostic\./);
      }
    }
  });

  test('le texte de quelques phrases, sur des chiffres inventés : les collisions sans retrouvailles, les places vides, la diversité au centième, le compte d’arrêt mis en forme', () => {
    assert.equal(
      t(`${P}.collisions`, { collisions: 9, paires: 9, excedent: 0, plancher: false }),
      "9 fois, deux personnes d'une même organisation partagent une table, toujours des paires différentes : aucune paire de collègues ne se retrouve deux fois.",
    );
    assert.match(t(`${P}.manque.placesVides`, { placesVides: 3, places: 120, presents: 117 }), /^3 places restent vides à chaque tour, 117 personnes pour 120 places : /);
    assert.match(t(`${P}.diversite`, { organisations: 17, redondance: 310, diversite: 0.7 }), /0,70/);
    assert.match(t(`${P}.tenter.repartir`, { proposition: 7, arret: 150000 }), /n° 7/);
    assert.match(t(`${P}.tenter.repartir`, { proposition: 7, arret: 150000 }), /150\u{202F}000|150\u{00A0}000|150 000/u);
    assert.doesNotMatch(t(`${P}.tenter.tables`), /aucune relance/);
    assert.match(t(`${P}.tenter.tables`), /si leurs capacités diffèrent alors, le diagnostic dit l'écart d'itinéraire qui demeure/);
    assert.equal(
      t(`${P}.collisions.minimum`),
      "Ses collisions sont au minimum : aucune relance ne les fera baisser sans créer de conflit d'organisation.",
    );
    assert.match(t(`${P}.manque.horsAtteinte`, { mobiles: 5 }), /au moins 5 mobiles/);
    assert.doesNotMatch(t(`${P}.manque.horsAtteinte`, { mobiles: 5 }), /ni le contraire/);
    assert.equal(
      t(`${P}.rencontres`, { minimum: 23, plafond: 27 }),
      'Le moins bien servi rencontre 23 personnes différentes, sur les 27 que son plafond a priori permet.',
    );
  });
});
