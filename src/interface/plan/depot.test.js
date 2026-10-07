// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du dépôt d'une personne glissée (§ 5.8, § 5.9, § 7.1, § 7.3,
// § 14.10), sans DOM : la commande se lit sur la cible de l'état des places
// (EtatPlaces.cible, A5), jamais sur la présence d'un retenu ; la place se
// désigne par la géométrie des tables. Les charges d'épreuve se construisent
// par les commandes de l'application et l'état des places se calcule par
// etatPlaces : la même implémentation que celle du plan (§ 19.1). Les noms
// sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { appliquerCommande } from '../../application/commandes.js';
import { etatPlaces } from '../../application/places.js';
import { geometrieTable } from '../../geometrie/tables.js';
import { creerCharge } from '../../stockage/document.js';
import { commandeDeDepot, deposer, reservationTenue } from './depot.js';

const NOMS = [
  ['Ombrelle', 'Iris'],
  ['Pervenche', 'Théo'],
  ['Lacasse', 'Ondine'],
  ['Grisaille', null],
  ['Tourmaline', 'Basile'],
  ['Arrosoir', 'Capucine'],
  ['Cerfeuil', 'Aurèle'],
];

// Sept personnes, trois rondes de trois places, deux tours, et une
// proposition à sièges non attribués : au tour 1, la table 1 est pleine
// (1, 2, 3), la table 2 assied 4 et 5, la table 3 assied 6 et 7 ; au
// tour 2, 1, 4, 6 ; 2, 5, 7 ; 3.
function chargeDepot() {
  const charge = creerCharge({ id: 'evt-depot', nom: 'Club des Merles', siegesParDefaut: 3, tours: 2 });
  charge.participants = NOMS.map(([nom, prenom], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    appartenance: null,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  charge.tables = [1, 2, 3].map((id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 300 * (id - 1), y: 0 } }));
  charge.prochainsIds = { participant: 8, table: 4, proposition: 2 };
  charge.propositions = [
    {
      id: 1,
      graine: 1,
      arret: 40,
      historique: 1000,
      produitVersion: 'epreuve',
      siegesAttribues: false,
      tables: [1, 2, 3],
      capacites: [3, 3, 3],
      tours: 2,
      participants: [1, 2, 3, 4, 5, 6, 7],
      placement: [
        { sieges: [[1, 2, 3], [4, 5], [6, 7]], reserve: [] },
        { sieges: [[1, 4, 6], [2, 5, 7], [3]], reserve: [] },
      ],
    },
  ];
  charge.evenement.etat = 'propose';
  return charge;
}

const executer = (charge, nom, args) => appliquerCommande(nom, charge, args).charge;
const retenue = (charge) => executer(charge, 'retenirProposition', { id: 1 });

// Le dépôt de la personne assise à depuis, lu sur l'état des places du tour.
function depot(etat, depuis, cible, surLeSol = false) {
  const table = etat.tables.find(({ id }) => id === depuis.table);
  const personne = table.chaises[depuis.siege - 1].occupant;
  assert.notEqual(personne, null, `une personne est assise à ${depuis.table}:${depuis.siege}`);
  return commandeDeDepot({ etatPlaces: etat, tour: etat.tour, personne, depuis, cible, surLeSol });
}

describe('commandeDeDepot sous la cible « reservations » : avant la retenue (§ 5.8)', () => {
  const avant = () => etatPlaces(chargeDepot(), { tour: 1, proposition: 1 });

  test('l’état des places le dit : une proposition montrée avant la retenue a pour cible les réservations', () => {
    const etat = avant();
    assert.equal(etat.source, 'proposition');
    assert.equal(etat.cible, 'reservations');
  });

  test('une personne non réservée sur un siège libre → reserver au tour affiché, portée « tour »', () => {
    assert.deepEqual(depot(avant(), { table: 2, siege: 1 }, { table: 3, siege: 3 }), {
      commande: 'reserver',
      arguments: { participant: 4, table: 3, siege: 3, portee: 'tour', tour: 1 },
    });
  });

  test('sur un siège qu’occupe une personne non réservée de la proposition → reserver, comme sur un siège libre', () => {
    assert.deepEqual(depot(avant(), { table: 2, siege: 1 }, { table: 3, siege: 1 }), {
      commande: 'reserver',
      arguments: { participant: 4, table: 3, siege: 1, portee: 'tour', tour: 1 },
    });
  });

  test('une personne réservée → deplacerReservation, la réservation désignée par sa table, sa portée et son tour', () => {
    const charge = executer(chargeDepot(), 'reserver', { participant: 1, table: 1, siege: 1, portee: 'tour', tour: 1 });
    const etat = etatPlaces(charge, { tour: 1, proposition: 1 });
    assert.deepEqual(depot(etat, { table: 1, siege: 1 }, { table: 3, siege: 3 }), {
      commande: 'deplacerReservation',
      arguments: { participant: 1, de: { table: 1, portee: 'tour', tour: 1 }, vers: { table: 3, siege: 3 } },
    });
    const tous = executer(chargeDepot(), 'reserver', { participant: 1, table: 1, siege: 1, portee: 'tous', tour: null });
    assert.deepEqual(depot(etatPlaces(tous, { tour: 2, proposition: 1 }), { table: 1, siege: 1 }, { table: 2, siege: 3 }), {
      commande: 'deplacerReservation',
      arguments: { participant: 1, de: { table: 1, portee: 'tous', tour: null }, vers: { table: 2, siege: 3 } },
    });
  });

  test('reservationTenue : la réservation qui tient la personne à sa chaise d’origine, sinon null', () => {
    // Le fantôme et le dépôt la lisent de la même fonction : le libellé du
    // geste dit la portée que deplacerReservation garde.
    const tous = executer(chargeDepot(), 'reserver', { participant: 1, table: 1, siege: 1, portee: 'tous', tour: null });
    const etat = etatPlaces(tous, { tour: 2, proposition: 1 });
    assert.deepEqual(reservationTenue(etat, 1, { table: 1, siege: 1 }), { participant: 1, portee: 'tous', tour: null });
    assert.equal(reservationTenue(etat, 2, { table: 1, siege: 1 }), null);
    assert.equal(reservationTenue(etat, 1, { table: 2, siege: 1 }), null);
    assert.equal(reservationTenue(etat, 1, null), null);
    const tour = executer(chargeDepot(), 'reserver', { participant: 1, table: 1, siege: 1, portee: 'tour', tour: 1 });
    assert.deepEqual(reservationTenue(etatPlaces(tour, { tour: 1, proposition: 1 }), 1, { table: 1, siege: 1 }), {
      participant: 1,
      portee: 'tour',
      tour: 1,
    });
  });

  test('sur le sol, une réservation « tous les tours » ne se retire pas : { refus } RESERVATION_TOUS_LES_TOURS, son remède retirerReservation de portée « tous », que la charge exécute', () => {
    // Un geste fait à un tour ne change jamais en silence les autres tours :
    // la réservation se défait par sa propre commande (§ 7.1).
    const charge = executer(chargeDepot(), 'reserver', { participant: 1, table: 1, siege: 1, portee: 'tous', tour: null });
    const remede = { commande: 'retirerReservation', arguments: { participant: 1, table: 1, portee: 'tous', tour: null } };
    for (const tour of [1, 2]) {
      const etat = etatPlaces(charge, { tour, proposition: 1 });
      assert.equal(etat.cible, 'reservations');
      assert.deepEqual(depot(etat, { table: 1, siege: 1 }, null, true), {
        refus: { code: 'RESERVATION_TOUS_LES_TOURS', details: { participant: 1, table: 1, remede } },
      });
    }
    const apres = executer(charge, remede.commande, remede.arguments);
    assert.deepEqual(apres.reservations, []);
  });

  test('sur le sol → retirerReservation pour une personne réservée ; null pour une personne qui ne l’est pas', () => {
    const charge = executer(chargeDepot(), 'reserver', { participant: 1, table: 1, siege: 1, portee: 'tour', tour: 1 });
    const etat = etatPlaces(charge, { tour: 1, proposition: 1 });
    assert.deepEqual(depot(etat, { table: 1, siege: 1 }, null, true), {
      commande: 'retirerReservation',
      arguments: { participant: 1, table: 1, portee: 'tour', tour: 1 },
    });
    assert.equal(depot(etat, { table: 2, siege: 1 }, null, true), null);
  });

  test('régime table → le premier siège qu’aucune réservation ne tient ; table pleine de réservations → la même commande, siege: null', () => {
    assert.deepEqual(depot(avant(), { table: 2, siege: 1 }, { table: 3 }), {
      commande: 'reserver',
      arguments: { participant: 4, table: 3, siege: 1, portee: 'tour', tour: 1 },
    });
    let charge = chargeDepot();
    for (const [participant, siege] of [[1, 1], [2, 2], [3, 3]]) {
      charge = executer(charge, 'reserver', { participant, table: 1, siege, portee: 'tour', tour: 1 });
    }
    assert.deepEqual(depot(etatPlaces(charge, { tour: 1, proposition: 1 }), { table: 2, siege: 1 }, { table: 1 }), {
      commande: 'reserver',
      arguments: { participant: 4, table: 1, siege: null, portee: 'tour', tour: 1 },
    });
  });

  test('un tour que le retenu ne porte pas : la cible est « reservations », la commande reserver, quoiqu’un retenu existe', () => {
    const charge = executer(retenue(chargeDepot()), 'changerTours', { tours: '3' });
    const etat = etatPlaces(charge, { tour: 3 });
    assert.notEqual(charge.retenu, null);
    assert.equal(etat.cible, 'reservations');
    const personne = etat.reserve[0];
    assert.equal(personne, 1);
    const rendu = commandeDeDepot({ etatPlaces: etat, tour: 3, personne, depuis: null, cible: { table: 2, siege: 2 }, surLeSol: false });
    assert.deepEqual(rendu, { commande: 'reserver', arguments: { participant: 1, table: 2, siege: 2, portee: 'tour', tour: 3 } });
  });
});

describe('commandeDeDepot sous la cible « retenu » (§ 5.8, § 7.1)', () => {
  const apres = () => etatPlaces(retenue(chargeDepot()), { tour: 1 });

  test('siège libre → deplacerDansRetenu ; siège occupé → echangerDansRetenu ; sol → retirerDuTour', () => {
    const etat = apres();
    assert.equal(etat.cible, 'retenu');
    assert.deepEqual(depot(etat, { table: 2, siege: 1 }, { table: 3, siege: 3 }), {
      commande: 'deplacerDansRetenu',
      arguments: { tour: 1, participant: 4, table: 3, siege: 3 },
    });
    assert.deepEqual(depot(etat, { table: 2, siege: 1 }, { table: 3, siege: 1 }), {
      commande: 'echangerDansRetenu',
      arguments: { tour: 1, a: 4, b: 6 },
    });
    assert.deepEqual(depot(etat, { table: 2, siege: 1 }, null, true), {
      commande: 'retirerDuTour',
      arguments: { tour: 1, participant: 4 },
    });
  });

  test('régime table → le premier siège libre au tour affiché ; table pleine → la même commande, siege: null', () => {
    const etat = apres();
    assert.deepEqual(depot(etat, { table: 2, siege: 1 }, { table: 3 }), {
      commande: 'deplacerDansRetenu',
      arguments: { tour: 1, participant: 4, table: 3, siege: 3 },
    });
    assert.deepEqual(depot(etat, { table: 2, siege: 1 }, { table: 1 }), {
      commande: 'deplacerDansRetenu',
      arguments: { tour: 1, participant: 4, table: 1, siege: null },
    });
  });

  test('la commande rendue s’exécute : la personne change de table au tour affiché seulement', () => {
    const charge = retenue(chargeDepot());
    const etat = etatPlaces(charge, { tour: 1 });
    const { commande, arguments: args } = depot(etat, { table: 2, siege: 1 }, { table: 3, siege: 3 });
    const suivante = executer(charge, commande, args);
    assert.deepEqual(suivante.retenu.placement[0].sieges, [[1, 2, 3], [5], [4, 6, 7]]);
    assert.deepEqual(suivante.retenu.placement[1], charge.retenu.placement[1]);
  });
});

describe('commandeDeDepot : ce qui ne désigne rien, et la cible null (contrat, « Source »)', () => {
  test('entre deux chaises, ou sur le plateau : null, la personne revient', () => {
    for (const etat of [etatPlaces(chargeDepot(), { tour: 1, proposition: 1 }), etatPlaces(retenue(chargeDepot()), { tour: 1 })]) {
      assert.equal(depot(etat, { table: 2, siege: 1 }, null, false), null);
    }
  });

  test('relâchée sur sa propre chaise : null', () => {
    assert.equal(depot(etatPlaces(retenue(chargeDepot()), { tour: 1 }), { table: 2, siege: 1 }, { table: 2, siege: 1 }), null);
  });

  test('une proposition montrée après la retenue → { refus } PROPOSITION_MONTREE, remède afficherTour, sur un siège, une table comme sur le sol', () => {
    const etat = etatPlaces(retenue(chargeDepot()), { tour: 1, proposition: 1 });
    assert.equal(etat.cible, null);
    const attendu = {
      refus: { code: 'PROPOSITION_MONTREE', details: { proposition: 1, remede: { geste: 'afficherTour', tour: 1, proposition: null } } },
    };
    assert.deepEqual(depot(etat, { table: 2, siege: 1 }, { table: 3, siege: 3 }), attendu);
    assert.deepEqual(depot(etat, { table: 2, siege: 1 }, { table: 3 }), attendu);
    assert.deepEqual(depot(etat, { table: 2, siege: 1 }, null, true), attendu);
  });

  test('un retenu fautif → { refus } RETENU_FAUTIF', () => {
    const charge = retenue(chargeDepot());
    charge.retenu.placement[0].sieges[1].push(1);
    const etat = etatPlaces(charge, { tour: 1 });
    assert.equal(etat.cible, null);
    assert.equal(etat.refus.code, 'RETENU_FAUTIF');
    const rendu = commandeDeDepot({ etatPlaces: etat, tour: 1, personne: 4, depuis: { table: 2, siege: 1 }, cible: { table: 3, siege: 3 }, surLeSol: false });
    assert.deepEqual(rendu, { refus: etat.refus });
  });
});

describe('deposer : la place se désigne par la géométrie (§ 7.3, § 14.10)', () => {
  const geometries = (etat) => etat.tables.map((table) => geometrieTable(table, table.capacite));

  test('au centre d’une chaise libre d’une autre table → la commande nomme cette table et ce siège, et la place est ce siège', () => {
    const etat = etatPlaces(retenue(chargeDepot()), { tour: 1 });
    const g = geometries(etat);
    assert.equal(g.length, 3);
    const chaise = g[2].chaises[2];
    const rendu = deposer({ etatPlaces: etat, tour: 1, personne: 4, depuis: { table: 2, siege: 1 }, point: { x: chaise.x, y: chaise.y }, geometries: g, k: 1 });
    assert.deepEqual(rendu, {
      resultat: { commande: 'deplacerDansRetenu', arguments: { tour: 1, participant: 4, table: 3, siege: 3 } },
      place: { table: 3, siege: 3 },
    });
  });

  test('sur le plateau : rien, la place est celle d’où vient la personne ; loin des tables : le sol', () => {
    const etat = etatPlaces(retenue(chargeDepot()), { tour: 1 });
    const g = geometries(etat);
    const commun = { etatPlaces: etat, tour: 1, personne: 4, depuis: { table: 2, siege: 1 }, geometries: g, k: 1 };
    assert.deepEqual(deposer({ ...commun, point: g[2].centre }), { resultat: null, place: { table: 2, siege: 1 } });
    assert.deepEqual(deposer({ ...commun, point: { x: 150, y: 400 } }), {
      resultat: { commande: 'retirerDuTour', arguments: { tour: 1, participant: 4 } },
      place: { table: 2, siege: 1 },
    });
  });

  test('au zoom où la table est la cible, le point au centre désigne la table, et la place est la table', () => {
    const etat = etatPlaces(retenue(chargeDepot()), { tour: 1 });
    const g = geometries(etat);
    const rendu = deposer({ etatPlaces: etat, tour: 1, personne: 4, depuis: { table: 2, siege: 1 }, point: g[0].centre, geometries: g, k: 0.1 });
    assert.deepEqual(rendu, {
      resultat: { commande: 'deplacerDansRetenu', arguments: { tour: 1, participant: 4, table: 1, siege: null } },
      place: { table: 1 },
    });
  });
});
