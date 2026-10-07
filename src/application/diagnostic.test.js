// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du diagnostic d'une charge (§ 5.6, § 15.3) : la valeur rendue est
// celle de diagnostiquer sur la configuration de la charge, sollicitée une
// seconde fois (§ 19.1) ; une configuration qui ne se normalise pas rend son
// code et ses détails, sans lever. Les noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { texteLivre } from '../demo/livrees.js';
import { diagnostiquer } from '../moteur/diagnostic.js';
import { ErreurConfiguration } from '../moteur/erreurs.js';
import { normaliser } from '../moteur/configuration.js';
import { serialiser } from '../stockage/canonique.js';
import { analyser, configurationDepuisCharge, creerCharge } from '../stockage/document.js';
import { VERSION } from '../version.genere.js';
import { diagnostiquerCharge } from './diagnostic.js';

const chargeDemo = (cle) => analyser(texteLivre(cle)).charge;

// La petite démonstration où quatre personnes portent une réservation de
// portée « tous les tours », sans siège, à la table 1, de 3 places.
function quatreReserveesSurTrois() {
  const charge = chargeDemo('petite');
  charge.reservations = [1, 2, 3, 4].map((participant) => ({ participant, table: 1, siege: null, portee: 'tous', tour: null }));
  return charge;
}

describe('diagnostiquerCharge', () => {
  test('petite démonstration : le diagnostic de sa configuration, erreur null', () => {
    const charge = chargeDemo('petite');
    const rendu = diagnostiquerCharge(charge);
    assert.deepEqual(rendu, { diagnostic: diagnostiquer(configurationDepuisCharge(charge)), erreur: null });
    assert.ok(rendu.diagnostic.plafondAPriori.repartition.length > 0);
  });

  test('petite démonstration au conflit inévitable : le plancher du groupe de 5', () => {
    const charge = chargeDemo('petite-conflit');
    const { diagnostic, erreur } = diagnostiquerCharge(charge);
    assert.equal(erreur, null);
    assert.equal(diagnostic.collisions.length, 1);
    assert.deepEqual(diagnostic, diagnostiquer(configurationDepuisCharge(charge)));
  });

  test('quatre réservées sur une table de 3 : analyser admet, normaliser refuse ; le code rendu, sans lever', () => {
    const charge = quatreReserveesSurTrois();
    // Le fichier qui la porte se relit : la charge est admise par le stockage.
    const relue = analyser(serialiser(charge, { revision: 1, produitVersion: VERSION.affichee })).charge;
    assert.equal(relue.reservations.length, 4);
    let attendue = null;
    try {
      normaliser(configurationDepuisCharge(relue));
    } catch (erreur) {
      assert.ok(erreur instanceof ErreurConfiguration);
      attendue = erreur;
    }
    assert.notEqual(attendue, null);
    const rendu = diagnostiquerCharge(relue);
    assert.deepEqual(rendu, { diagnostic: null, erreur: { code: 'SURRESERVATION', details: attendue.details } });
    assert.equal(rendu.erreur.code, attendue.code);
  });

  test('un événement neuf, sans participant ni table : un diagnostic, aucune erreur', () => {
    const charge = creerCharge({ id: 'evt-neuf', nom: 'Club des Merles', siegesParDefaut: 8, tours: 4 });
    const { diagnostic, erreur } = diagnostiquerCharge(charge);
    assert.equal(erreur, null);
    assert.deepEqual(diagnostic, diagnostiquer(configurationDepuisCharge(charge)));
  });

  test('une erreur qui n\u{2019}est pas une ErreurConfiguration remonte', () => {
    const charge = chargeDemo('petite');
    charge.tables = null;
    assert.throws(() => diagnostiquerCharge(charge), TypeError);
  });

  test('la charge reçue ne change pas', () => {
    const charge = quatreReserveesSurTrois();
    const avant = structuredClone(charge);
    diagnostiquerCharge(charge);
    diagnostiquerCharge(chargeDemo('grande'));
    assert.deepEqual(charge, avant);
  });
});
