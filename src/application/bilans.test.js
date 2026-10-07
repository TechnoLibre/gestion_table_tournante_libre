// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves des bilans du mobilier (§ 6.1, § 6.2, § 2.1 étape 5, § 4.3) : ce
// qu'un changement de défaut, de tours ou une suppression de table emporte,
// énoncé avant d'appliquer, sans rien écrire. Les noms d'épreuve sont
// inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { nombrePlaces, normaliser } from '../moteur/configuration.js';
import { SIEGES_MAX, configurationDepuisCharge, creerCharge } from '../stockage/document.js';
import { bilanChangementDefaut, bilanSuppressionTable, bilanTours } from './bilans.js';
import { COMMANDES } from './commandes.js';

const NOMS = ['Ombrelle', 'Pervenche', 'Lacasse', 'Grisaille', 'Bruyère', 'Sarcelle', 'Ancolie', 'Mélèze', 'Quenouille', 'Pivoine'];

const personne = (id, autres = {}) => ({
  id,
  nom: NOMS[(id - 1) % NOMS.length],
  prenom: id === 2 ? 'Théo' : null,
  appartenance: null,
  courriel: null,
  titrePressenti: null,
  notes: null,
  exclu: false,
  ...autres,
});

const resa = (participant, table, siege, tour = null) => ({ participant, table, siege, portee: tour === null ? 'tous' : 'tour', tour });

// Une charge : les tables données ({id, sieges}, numéro égal à l'identifiant),
// n personnes dont les exclus, R tours, un défaut.
function chargeDe({ tables, n, exclus = [], tours = 2, defaut = 8, attribuerSieges = false, reservations = [], titres = [] }) {
  const charge = creerCharge({ id: 'evt-bilans', nom: 'Soirée des Merles', siegesParDefaut: defaut, tours });
  charge.reglages.attribuerSieges = attribuerSieges;
  charge.participants = Array.from({ length: n }, (_, rang) => personne(rang + 1, { exclu: exclus.includes(rang + 1) }));
  charge.tables = tables.map(({ id, sieges = null }) => ({ id, numero: id, sieges, forme: 'ronde', position: { x: 300 * id, y: 0 } }));
  charge.reservations = reservations;
  charge.titres = titres;
  charge.prochainsIds = { participant: n + 1, table: Math.max(0, ...tables.map(({ id }) => id)) + 1, proposition: 1 };
  return charge;
}

// Ajoute la proposition id, dont les listes de chaque tour suivent l'ordre
// de charge.tables, et la retient quand retenu est vrai.
function placer(charge, listes, { id, retenu = false }) {
  const participants = charge.participants.filter(({ exclu }) => !exclu).map(({ id: p }) => p);
  const plan = {
    siegesAttribues: charge.reglages.attribuerSieges,
    tables: charge.tables.map(({ id: t }) => t),
    capacites: charge.tables.map(({ sieges }) => sieges ?? charge.evenement.siegesParDefaut),
    tours: listes.length,
    participants,
    placement: listes.map((tour) => ({ sieges: tour, reserve: participants.filter((p) => !tour.flat().includes(p)) })),
  };
  charge.propositions.push({ id, graine: id, arret: 40, historique: 1000, produitVersion: 'essai', ...plan });
  charge.prochainsIds.proposition = id + 1;
  if (retenu) {
    charge.retenu = { proposition: id, ...structuredClone(plan) };
    charge.evenement.etat = 'retenu';
  } else if (charge.evenement.etat === 'brouillon') {
    charge.evenement.etat = 'propose';
  }
  return charge;
}

const afficherTour = (tour) => ({ geste: 'afficherTour', tour, proposition: null });

// Treize tables : neuf suivent 8, les tables 3, 6, 9 et 12 sont surchargées à
// 7, 7, 6 et 12 ; 120 personnes, dont 2 exclues.
function treizeTables(options = {}) {
  const surcharges = new Map([[3, 7], [6, 7], [9, 6], [12, 12]]);
  const tables = Array.from({ length: 13 }, (_, rang) => ({ id: rang + 1, sieges: surcharges.get(rang + 1) ?? null }));
  return chargeDe({ tables, n: 120, exclus: [40, 80], ...options });
}

describe('bilans : changer le défaut (§ 6.1)', () => {
  test("l'énoncé chiffré du § 6.1 : 9 tables passent de 8 à 10, 4 surchargées ne changent pas, 104 → 122 pour 118", () => {
    const charge = treizeTables();
    const bilan = bilanChangementDefaut(charge, 10);
    assert.deepEqual(bilan, {
      suivent: 9,
      avant: 8,
      apres: 10,
      surchargees: [7, 7, 6, 12],
      totalAvant: 104,
      totalApres: 122,
      participants: 118,
      refus: [],
      avertissements: [],
    });
    // Le total et les participants sont ceux de l'instance de la charge appliquée.
    const apres = COMMANDES.get('changerDefaut')(charge, { sieges: 10, realigner: false }).charge;
    const instance = normaliser(configurationDepuisCharge(apres));
    assert.equal(bilan.totalApres, nombrePlaces(instance));
    assert.equal(bilan.participants, instance.N);
  });

  test('réaligner : les surchargées changent aussi, et leurs refus en sont', () => {
    const charge = treizeTables({ attribuerSieges: true, titres: [{ table: 12, siege: 12, libelle: 'animateur' }] });
    const realigne = bilanChangementDefaut(charge, 10, { realigner: true });
    assert.equal(realigne.totalApres, 130);
    assert.deepEqual(realigne.refus, [
      {
        table: 12,
        code: 'SIEGES_RETIRES',
        details: {
          table: 12,
          sieges: [{ siege: 12, cause: 'SIEGE_TITRE', libelle: 'animateur' }],
          remede: { commande: 'retirerTitre', arguments: { table: 12, siege: 12 } },
        },
      },
    ]);
    assert.deepEqual(bilanChangementDefaut(charge, 10).refus, []);
  });

  test('une baisse se contrôle table par table : la table 2, sous ses 7 réservations, refuse ; les autres non', () => {
    const reservations = [1, 2, 3, 4, 5, 6, 7].map((id) => resa(id, 2, null));
    const charge = chargeDe({ tables: [{ id: 1 }, { id: 2 }, { id: 3 }], n: 20, reservations });
    const bilan = bilanChangementDefaut(charge, 6);
    assert.deepEqual(bilan.refus, [
      { table: 2, code: 'SOUS_RESERVATIONS', details: { table: 2, n: 7, tour: 1, remede: afficherTour(1) } },
    ]);
    assert.equal(bilan.totalApres, 18);
    assert.deepEqual(bilanChangementDefaut(charge, 1).refus, [{ table: null, code: 'MOINS_DE_DEUX', details: { remede: null } }]);
  });

  test("au-delà de SIEGES_MAX, un seul refus pour l'événement, TROP_DE_PLACES, même quand aucune table ne suit le défaut", () => {
    const refus = [{ table: null, code: 'TROP_DE_PLACES', details: { max: SIEGES_MAX, remede: null } }];
    const suivent = chargeDe({ tables: [{ id: 1 }, { id: 2 }], n: 4 });
    assert.deepEqual(bilanChangementDefaut(suivent, SIEGES_MAX + 1).refus, refus);
    const surchargees = chargeDe({ tables: [{ id: 1, sieges: 6 }], n: 4 });
    assert.deepEqual(bilanChangementDefaut(surchargees, SIEGES_MAX + 1).refus, refus);
    assert.deepEqual(bilanChangementDefaut(suivent, SIEGES_MAX).refus, []);
  });

  test('une baisse sous un retenu occupé avertit SURNUMERAIRES : deux personnes de la table 3 au tour 2', () => {
    const charge = chargeDe({ tables: [{ id: 1 }, { id: 2 }, { id: 3 }], n: 18 });
    const suite = (de, a) => Array.from({ length: a - de + 1 }, (_, rang) => de + rang);
    placer(
      charge,
      [
        [suite(1, 6), suite(7, 12), suite(13, 18)],
        [suite(1, 5), suite(6, 10), suite(11, 18)],
      ],
      { id: 1, retenu: true },
    );
    const bilan = bilanChangementDefaut(charge, 6);
    assert.deepEqual(bilan.refus, []);
    assert.deepEqual(bilan.avertissements, [
      { table: 3, code: 'SURNUMERAIRES', details: { table: 3, tour: 2, personnes: [17, 18] } },
    ]);
  });

  test("le bilan n'écrit rien : la charge reçue, gelée, ne change pas", () => {
    const charge = Object.freeze(treizeTables());
    assert.equal(bilanChangementDefaut(charge, 6).totalApres, 9 * 6 + 32);
  });
});

describe('bilans : changer les tours (§ 2.1 étape 5, § 4.3)', () => {
  // R = 4 : deux réservations au tour 4, une au tour 2, une « tous » ; deux
  // propositions et un retenu.
  function quatreTours() {
    const reservations = [resa(1, 1, null, 4), resa(2, 2, null, 4), resa(3, 1, null, 2), resa(4, 2, null)];
    const charge = chargeDe({ tables: [{ id: 1, sieges: 4 }, { id: 2, sieges: 4 }], n: 8, tours: 4, reservations });
    const tour = [[1, 2, 3, 5], [4, 6, 7, 8]];
    const listes = [tour, [[1, 3, 5, 6], [2, 4, 7, 8]], [[1, 5, 6, 7], [2, 3, 4, 8]], [[1, 3, 5, 7], [2, 4, 6, 8]]];
    placer(charge, listes, { id: 1 });
    placer(charge, listes, { id: 2, retenu: true });
    return charge;
  }

  test('retirer le tour 4 détruit ses deux réservations « tour » ; propositions et retenu touchés', () => {
    const charge = quatreTours();
    assert.deepEqual(bilanTours(charge, 3), {
      reservationsDetruites: [
        { participant: 1, table: 1, tour: 4 },
        { participant: 2, table: 2, tour: 4 },
      ],
      propositionsTouchees: [1, 2],
      retenuTouche: true,
    });
  });

  test("le même nombre ne touche rien ; en ajouter ne détruit rien, mais périme les placements", () => {
    const charge = quatreTours();
    assert.deepEqual(bilanTours(charge, 4), { reservationsDetruites: [], propositionsTouchees: [], retenuTouche: false });
    assert.deepEqual(bilanTours(charge, 5), { reservationsDetruites: [], propositionsTouchees: [1, 2], retenuTouche: true });
  });
});

describe("bilans : supprimer une table (§ 6.2, § 4)", () => {
  function garnie() {
    const charge = chargeDe({
      tables: [{ id: 1 }, { id: 2 }, { id: 3 }],
      n: 6,
      reservations: [resa(2, 2, 2), resa(5, 1, null)],
      titres: [{ table: 2, siege: 2, libelle: 'animateur' }, { table: 1, siege: 1, libelle: 'accueil' }],
    });
    const listes = [[[1, 5], [2, 3], [4, 6]], [[3, 5], [2, 6], [1, 4]]];
    placer(charge, listes, { id: 1 });
    placer(charge, listes, { id: 2, retenu: true });
    return charge;
  }

  test('la table 2 porte la réservation « tous » de Théo Pervenche et un titre : le bilan les nomme, et les placements touchés', () => {
    assert.deepEqual(bilanSuppressionTable(garnie(), 2), {
      reservations: [{ participant: 2, portee: 'tous', tour: null, siege: 2 }],
      titres: [{ siege: 2, libelle: 'animateur' }],
      propositionsTouchees: [1, 2],
      retenuTouche: true,
    });
  });

  test('une table nue : deux listes vides ; une table créée après les placements ne les touche pas', () => {
    const charge = garnie();
    const nue = bilanSuppressionTable(charge, 3);
    assert.deepEqual([nue.reservations, nue.titres], [[], []]);
    const creee = COMMANDES.get('creerTable')(charge, { forme: 'carree' }).charge;
    const idCree = creee.tables.at(-1).id;
    // creerTable fait entrer la table au retenu ; aucune proposition ne la déclare.
    assert.deepEqual(bilanSuppressionTable(creee, idCree), { reservations: [], titres: [], propositionsTouchees: [], retenuTouche: true });
  });

  test('les titres se rangent par siège puis libellé', () => {
    const charge = garnie();
    charge.titres.push({ table: 2, siege: 1, libelle: 'hôte' }, { table: 2, siege: 2, libelle: 'accueil' });
    assert.deepEqual(bilanSuppressionTable(charge, 2).titres, [
      { siege: 1, libelle: 'hôte' },
      { siege: 2, libelle: 'accueil' },
      { siege: 2, libelle: 'animateur' },
    ]);
  });

  test('une table inconnue est une faute du code ; des places ou des tours non entiers aussi', () => {
    assert.throws(() => bilanChangementDefaut(garnie(), '6'), TypeError);
    assert.throws(() => bilanTours(garnie(), 2.5), TypeError);
    assert.throws(() => bilanSuppressionTable(garnie(), 9), TypeError);
  });
});
