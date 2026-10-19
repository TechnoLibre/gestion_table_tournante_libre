// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du travailleur de génération (§ 5.7, § 5.10) : brancherTravailleur
// sur une portée factice, qui garde chaque message posté. Le travailleur
// calcule une proposition par message, celle du rang demandé ; la valeur
// attendue est la proposition de même rang de rechercher. Les
// configurations viennent des démonstrations livrées.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { texteLivre } from '../demo/livrees.js';
import { rechercher, repartir, repartirUne } from '../moteur/recherche.js';
import { analyser, configurationDepuisCharge } from '../stockage/document.js';
import { CADENCE_AVANCEMENT, brancherTravailleur } from './generation_travailleur.js';

const configurationDe = (cle) => configurationDepuisCharge(analyser(texteLivre(cle)).charge);

// Une portée de travailleur factice : ce que le travailleur poste, et
// l'envoi d'un message au travailleur.
function porteeFactice() {
  const postes = [];
  const portee = {
    onmessage: null,
    postMessage: (message) => postes.push(structuredClone(message)),
  };
  brancherTravailleur(portee);
  return { postes, envoyer: (data) => portee.onmessage({ data }) };
}

describe('travailleur de génération (§ 5.7, § 5.10)', () => {
  test("après proposer, des avancements de la seule proposition, au plus un tous les CADENCE_AVANCEMENT, puis la proposition de ce rang de rechercher", () => {
    assert.equal(CADENCE_AVANCEMENT, 50);
    const configuration = configurationDe('petite-conflit');
    const reglages = { graine: 9, nombre: 3, arret: 120000, historique: 1000 };
    const { postes, envoyer } = porteeFactice();
    envoyer({ type: 'proposer', configuration, reglages, rang: 2 });
    const avancements = postes.filter(({ type }) => type === 'avancement');
    assert.ok(avancements.length > 0, 'aucun avancement');
    assert.ok(avancements.length <= Math.ceil(reglages.arret / 1000 / CADENCE_AVANCEMENT));
    assert.deepEqual(avancements, [
      { type: 'avancement', fait: 50000, total: 120000 },
      { type: 'avancement', fait: 100000, total: 120000 },
    ]);
    const attendue = rechercher(configuration, reglages)[1];
    assert.equal(attendue.id, 2);
    assert.deepEqual(postes.at(-1), { type: 'proposition', proposition: attendue });
    assert.equal(postes.length, avancements.length + 1);
  });

  test("la proposition postée porte la course du moteur, mouvements évalués et points de relevé, sans rien de plus : aucune date, aucune durée", () => {
    const configuration = configurationDe('petite-conflit');
    const reglages = { graine: 9, nombre: 2, arret: 2_500, historique: 100 };
    const { postes, envoyer } = porteeFactice();
    envoyer({ type: 'proposer', configuration, reglages, rang: 2 });
    const [{ proposition }] = postes.filter(({ type }) => type === 'proposition');
    assert.deepEqual(Object.keys(proposition), ['id', 'graine', 'arret', 'historique', 'plan', 'evalues', 'releves']);
    assert.equal(proposition.evalues, 2_500);
    assert.deepEqual(proposition.releves.map(({ mouvements }) => mouvements), [1, 10, 100, 1_000]);
    assert.deepStrictEqual(proposition, rechercher(configuration, reglages)[1]);
  });

  test('le même travailleur répond à chaque proposer, dans un ordre quelconque des rangs', () => {
    const configuration = configurationDe('petite');
    const reglages = { graine: 31, nombre: 4, arret: 2000, historique: 1000 };
    const attendues = rechercher(configuration, reglages);
    const { postes, envoyer } = porteeFactice();
    const rangs = [3, 1, 4];
    for (const rang of rangs) envoyer({ type: 'proposer', configuration, reglages, rang });
    const rendues = postes.filter(({ type }) => type === 'proposition').map(({ proposition }) => proposition);
    assert.equal(rendues.length, rangs.length);
    assert.deepEqual(
      rendues,
      rangs.map((rang) => attendues[rang - 1]),
    );
  });

  test('des places manquantes postent erreur PLACES_MANQUANTES, les détails du moteur', () => {
    const configuration = configurationDe('petite');
    configuration.tables = configuration.tables.slice(1);
    const { postes, envoyer } = porteeFactice();
    envoyer({ type: 'proposer', configuration, reglages: { graine: 1, nombre: 1, arret: 10 }, rang: 1 });
    assert.deepEqual(postes, [{ type: 'erreur', code: 'PLACES_MANQUANTES', details: { placesManquantes: 3 } }]);
  });

  test('une graine de 2^32 poste erreur REGLAGE_HORS_DOMAINE, qui nomme le réglage, sans le message du moteur', () => {
    const { postes, envoyer } = porteeFactice();
    envoyer({ type: 'proposer', configuration: configurationDe('petite'), reglages: { graine: 2 ** 32, nombre: 1, arret: 10 }, rang: 1 });
    assert.deepEqual(postes, [{ type: 'erreur', code: 'REGLAGE_HORS_DOMAINE', details: { reglage: 'graine', remede: null } }]);
  });

  test('une faute que versErreurGeneration ne convertit pas poste { type: faute, message, pile }, sans lever : le canal d’erreur du travailleur reste au script qui ne se charge pas', () => {
    const { postes, envoyer } = porteeFactice();
    assert.doesNotThrow(() => envoyer({ type: 'proposer', configuration: null, reglages: { graine: 1, nombre: 1, arret: 10 }, rang: 1 }));
    assert.equal(postes.length, 1);
    const [faute] = postes;
    assert.deepEqual(Object.keys(faute).sort(), ['message', 'pile', 'type']);
    assert.equal(faute.type, 'faute');
    assert.match(faute.message, /^TypeError: /);
    assert.equal(typeof faute.pile, 'string');
    assert.match(faute.pile, /TypeError/);
  });

  test('un rang hors de 1 à nombre est une faute de l’exécuteur, jamais un refus de réglage', () => {
    const { postes, envoyer } = porteeFactice();
    envoyer({ type: 'proposer', configuration: configurationDe('petite'), reglages: { graine: 1, nombre: 2, arret: 10 }, rang: 3 });
    assert.equal(postes.length, 1);
    assert.equal(postes[0].type, 'faute');
    assert.match(postes[0].message, /^RangeError: rang :/);
  });

  test("un message d'un autre type ne lance rien", () => {
    const { postes, envoyer } = porteeFactice();
    envoyer({ type: 'inconnu' });
    envoyer({ type: 'lancer', configuration: configurationDe('petite'), reglages: { graine: 1, nombre: 1, arret: 10 } });
    envoyer(null);
    assert.deepEqual(postes, []);
  });
});

describe('travailleur de génération : le départ (§ 5.7, § 5.10, C8, C24)', () => {
  // Le départ du moteur : la première proposition de la petite
  // démonstration à un compte court, tours 1 et 3 figés.
  const departDe = (configuration) => ({
    plan: rechercher(configuration, { graine: 5, arret: 40, nombre: 1 })[0].plan,
    toursFiges: [1, 3],
  });

  test('proposer avec depart : la proposition de ce rang de repartir, relances comprises ; le même message sans depart, celle de rechercher', () => {
    const configuration = configurationDe('petite');
    const reglages = { graine: 31, nombre: 4, arret: 2_000, historique: 100 };
    const depart = departDe(configuration);
    const { postes, envoyer } = porteeFactice();
    for (const rang of [3, 1]) envoyer({ type: 'proposer', configuration, reglages, rang, depart });
    envoyer({ type: 'proposer', configuration, reglages, rang: 3 });
    const rendues = postes.filter(({ type }) => type === 'proposition').map(({ proposition }) => proposition);
    const derivees = repartir(configuration, reglages, depart);
    assert.deepStrictEqual(rendues, [derivees[2], derivees[0], rechercher(configuration, reglages)[2]]);
    assert.ok(Object.hasOwn(rendues[0], 'relances'));
    assert.notDeepEqual(rendues[0].plan, rendues[2].plan);
  });

  test('un départ que le moteur refuse poste erreur DEPART_INCOMPATIBLE, ses détails ; des tours figés hors domaine, une faute', () => {
    const configuration = configurationDe('petite');
    const reglages = { graine: 1, nombre: 2, arret: 10 };
    const { plan } = departDe(configuration);
    // Au tour 1, la première personne de la première table est assise une
    // seconde fois, à la dernière table.
    const tronque = structuredClone(plan);
    tronque.tours[0].at(-1).push(tronque.tours[0][0][0]);
    let attendue = null;
    try {
      repartirUne(configuration, reglages, { plan: tronque, toursFiges: [] }, 1);
    } catch (erreur) {
      attendue = erreur;
    }
    assert.equal(attendue?.code, 'DEPART_INCOMPATIBLE');
    const { postes, envoyer } = porteeFactice();
    envoyer({ type: 'proposer', configuration, reglages, rang: 1, depart: { plan: tronque, toursFiges: [] } });
    assert.deepEqual(postes, [{ type: 'erreur', code: 'DEPART_INCOMPATIBLE', details: attendue.details }]);
    envoyer({ type: 'proposer', configuration, reglages, rang: 1, depart: { plan, toursFiges: [1, 2, 3, 4] } });
    assert.equal(postes.length, 2);
    assert.equal(postes[1].type, 'faute');
    assert.match(postes[1].message, /^RangeError: /);
  });
});
