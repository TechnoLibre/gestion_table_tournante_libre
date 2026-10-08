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
import { rechercher } from '../moteur/recherche.js';
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
