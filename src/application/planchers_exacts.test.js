// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves des planchers exacts (§ 5.6), sans solveur : les entrées du
// solveur tirées d'une charge — null sur une charge null, refusée, qui
// manque de places ou sans séparation —, l'assemblage des issues des tours,
// synthétiques, et le plancher retenu, qui ne vaut que pour un plan sans
// conflit d'organisation. Les charges se construisent ici, sur des noms
// inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { creerCharge } from '../stockage/document.js';
import { LIMITE_PAR_TOUR, assemblerPlanchers, entreesDuSolveur, plancherRetenu } from './planchers_exacts.js';

const MERLES = 'Club des Merles';
const HERONS = 'Cercle des Hérons';

/**
 * Une charge construite : effectifs, [organisation, nombre de membres] ;
 * capacites, une table par capacité ; conflits, [organisation,
 * organisations nommées] : le premier membre de la première nomme les
 * autres.
 */
function chargeDe({ effectifs, capacites, tours = 3, conflits = [], separer = true }) {
  const charge = creerCharge({ id: 'evt-exact', nom: 'Soirée des Grèbes', siegesParDefaut: 8, tours });
  charge.participants = effectifs
    .flatMap(([organisation, n]) => Array(n).fill(organisation))
    .map((organisation, rang) => ({
      id: rang + 1,
      nom: `Grèbe${rang + 1}`,
      prenom: 'Iris',
      organisation,
      courriel: null,
      titrePressenti: null,
      notes: null,
      exclu: false,
    }));
  for (const [organisation, nommees] of conflits) {
    charge.participants.find((membre) => membre.organisation === organisation).conflits = nommees;
  }
  charge.tables = capacites.map((sieges, t) => ({ id: t + 1, numero: t + 1, sieges, forme: 'ronde', position: { x: 300 * t, y: 0 } }));
  charge.reglages.separerOrganisations = separer;
  charge.prochainsIds = { participant: charge.participants.length + 1, table: capacites.length + 1, proposition: 1 };
  return charge;
}

const ETOILE = () => chargeDe({ effectifs: [[MERLES, 6], [HERONS, 4]], capacites: [4, 4, 4], conflits: [[MERLES, [HERONS]]] });

// Une issue de tour synthétique, exacte par défaut.
const issue = (champs) => ({ faisable: true, minimum: 0, auMoins: null, cause: null, duree: 1, cache: false, ...champs });
const tours = (R) => Array.from({ length: R }, (_, r) => ({ r }));

describe('LIMITE_PAR_TOUR : la limite de temps de chaque tour', () => {
  test('30 secondes', () => {
    assert.equal(LIMITE_PAR_TOUR, 30);
  });
});

describe('entreesDuSolveur : les données des tours d’une charge, et leur clé', () => {
  test('les données de chaque tour, et pour clé leur JSON', () => {
    const entrees = entreesDuSolveur(ETOILE());
    assert.equal(entrees.tours.length, 3);
    assert.deepEqual(entrees.tours[1].unites.map(({ m }) => m), [6, 4]);
    assert.equal(entrees.cle, JSON.stringify(entrees.tours));
  });

  test('la clé ne change pas avec ce que le modèle ne lit pas, et change avec une capacité', () => {
    const charge = ETOILE();
    const cle = entreesDuSolveur(charge).cle;
    charge.participants[0].nom = 'Sterne';
    charge.participants[2].courriel = 'bec@exemple.invalid';
    charge.evenement.nom = 'Soirée des Sternes';
    assert.equal(entreesDuSolveur(charge).cle, cle);
    charge.tables[0].sieges = 5;
    assert.notEqual(entreesDuSolveur(charge).cle, cle);
  });

  test('null pour une charge null', () => {
    assert.equal(entreesDuSolveur(null), null);
  });

  test('null pour une configuration refusée ; toute autre erreur remonte', () => {
    const surreservee = ETOILE();
    surreservee.reservations = [1, 2, 3, 4, 5].map((participant) => ({ participant, table: 1, siege: null, portee: 'tous', tour: null }));
    assert.equal(entreesDuSolveur(surreservee), null);
    const fautive = ETOILE();
    fautive.reglages.separerOrganisations = 'oui';
    assert.throws(() => entreesDuSolveur(fautive), TypeError);
  });

  test('null quand un tour manque de places : aucun plan n’existe, le solveur n’a rien à prouver', () => {
    const charge = chargeDe({ effectifs: [[MERLES, 6], [HERONS, 4]], capacites: [4, 4], conflits: [[MERLES, [HERONS]]] });
    assert.equal(entreesDuSolveur(charge), null);
    charge.participants[0].presence = [1, 2];
    charge.participants[1].presence = [1, 3];
    assert.equal(entreesDuSolveur(charge), null);
  });

  test('null sous séparation décochée : les collisions ne comptent pas', () => {
    const charge = chargeDe({ effectifs: [[MERLES, 6], [HERONS, 4]], capacites: [4, 4, 4], separer: false });
    assert.equal(entreesDuSolveur(charge), null);
  });

  test('un tour « reserves » passe : le travailleur le dit, sans résolution', () => {
    const charge = ETOILE();
    charge.reservations = [
      { participant: 1, table: 1, siege: null, portee: 'tour', tour: 2 },
      { participant: 7, table: 1, siege: null, portee: 'tour', tour: 2 },
    ];
    const entrees = entreesDuSolveur(charge);
    assert.deepEqual(entrees.tours.map(({ infaisable }) => infaisable), [null, 'reserves', null]);
  });
});

describe('assemblerPlanchers : les issues des tours, assemblées', () => {
  test('tous exacts : la somme des minimums, exacte, sans conflit possible', () => {
    const issues = [issue({ minimum: 11 }), issue({ minimum: 9 }), issue({ minimum: 11 })];
    assert.deepEqual(assemblerPlanchers(tours(3), issues), {
      sansConflit: true,
      toursSansIssue: [],
      plancherCumulees: 31,
      exact: true,
      parTour: [
        { minimum: 11, auMoins: null },
        { minimum: 9, auMoins: null },
        { minimum: 11, auMoins: null },
      ],
      toursALimite: [],
    });
  });

  test('un tour à sa limite : au moins, la borne prouvée, et le tour nommé ; sans borne, il compte pour 0', () => {
    const issues = [
      issue({ minimum: 11 }),
      issue({ minimum: null, auMoins: 7, cause: 'limite' }),
      issue({ faisable: true, minimum: null, auMoins: null, cause: 'limite' }),
    ];
    const planchers = assemblerPlanchers(tours(3), issues);
    assert.equal(planchers.sansConflit, true);
    assert.equal(planchers.plancherCumulees, 18);
    assert.equal(planchers.exact, false);
    assert.deepEqual(planchers.toursALimite, [2, 3]);
    assert.deepEqual(planchers.parTour[1], { minimum: null, auMoins: 7 });
  });

  test('un tour sans placement sans conflit : aucun plan sans conflit, le tour nommé, aucun plancher', () => {
    const issues = [issue({ minimum: 4 }), issue({ faisable: false, minimum: null, cause: 'solveur' }), issue({ faisable: false, minimum: null, cause: 'affectation' })];
    const planchers = assemblerPlanchers(tours(3), issues);
    assert.equal(planchers.sansConflit, false);
    assert.deepEqual(planchers.toursSansIssue, [2, 3]);
    assert.equal(planchers.plancherCumulees, null);
  });

  test('un tour « reserves » : aucun plan sans conflit, mais aucun tour nommé, les conflits imposés le disent déjà', () => {
    const issues = [issue({ faisable: false, minimum: null, cause: 'reserves' }), issue({ minimum: 2 })];
    const planchers = assemblerPlanchers(tours(2), issues);
    assert.equal(planchers.sansConflit, false);
    assert.deepEqual(planchers.toursSansIssue, []);
    assert.equal(planchers.plancherCumulees, null);
  });

  test('une faisabilité inconnue : aucune affirmation, le plancher reste borne ; un tour impossible l’emporte', () => {
    const inconnu = issue({ faisable: null, minimum: null, auMoins: 3, cause: 'limite' });
    const planchers = assemblerPlanchers(tours(2), [issue({ minimum: 5 }), inconnu]);
    assert.equal(planchers.sansConflit, null);
    assert.equal(planchers.plancherCumulees, 8);
    assert.equal(planchers.exact, false);
    const avecImpossible = assemblerPlanchers(tours(2), [issue({ faisable: false, minimum: null, cause: 'solveur' }), inconnu]);
    assert.equal(avecImpossible.sansConflit, false);
  });

  test('un échec du solveur : aucun plancher, jamais lu comme une preuve', () => {
    const planchers = assemblerPlanchers(tours(2), [issue({ minimum: 5 }), issue({ faisable: null, minimum: null, cause: 'echec' })]);
    assert.equal(planchers.sansConflit, null);
    assert.equal(planchers.plancherCumulees, null);
    assert.equal(planchers.exact, false);
  });

  test('les numéros des tours viennent de leurs données, à partir de 1', () => {
    const planchers = assemblerPlanchers([{ r: 0 }, { r: 3 }], [issue({ minimum: 1 }), issue({ minimum: null, auMoins: 2, cause: 'limite' })]);
    assert.deepEqual(planchers.toursALimite, [4]);
  });

  test('autant d’issues que de tours, sinon une RangeError', () => {
    assert.throws(() => assemblerPlanchers(tours(3), [issue({}), issue({})]), RangeError);
  });
});

describe('plancherRetenu : le plancher des collisions qu’un plan doit atteindre', () => {
  const collisions = [{ plancherCumulees: 4 }, { plancherCumulees: 6 }];
  const etoiles = [{ gain: 20 }];
  const exacts = (champs) => ({ sansConflit: true, toursSansIssue: [], plancherCumulees: 54, exact: true, parTour: [], toursALimite: [], ...champs });

  test('le plus grand de la somme renforcée par les étoiles et du plancher exact', () => {
    assert.equal(plancherRetenu(collisions, etoiles, exacts({})), 54);
    assert.equal(plancherRetenu(collisions, etoiles, exacts({ plancherCumulees: 12 })), 30);
  });

  test('sans planchers exacts, ou sans leur plancher, la somme renforcée seule', () => {
    assert.equal(plancherRetenu(collisions, etoiles, null), 30);
    assert.equal(plancherRetenu(collisions, etoiles, exacts({ sansConflit: null, plancherCumulees: null })), 30);
  });

  test('aucun plan sans conflit : les étoiles se taisent, leur promesse est vide', () => {
    assert.equal(plancherRetenu(collisions, etoiles, exacts({ sansConflit: false, plancherCumulees: null })), 10);
  });

  test('un plan qui a des conflits : la somme par groupe seule, ni étoile ni plancher exact', () => {
    assert.equal(plancherRetenu(collisions, etoiles, exacts({}), { conflitsDuPlan: 2 }), 10);
    assert.equal(plancherRetenu(collisions, etoiles, exacts({}), { conflitsDuPlan: 0 }), 54);
  });
});
