// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du travailleur de génération (§ 5.10) : brancherTravailleur sur
// une portée factice, qui garde chaque message posté. Les configurations
// viennent des démonstrations livrées et d'une charge aux noms inventés.
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

describe('travailleur de génération (§ 5.10)', () => {
  test("après lancer, des avancements à fait croissant, au plus un tous les CADENCE_AVANCEMENT, puis le résultat de rechercher", () => {
    assert.equal(CADENCE_AVANCEMENT, 50);
    const configuration = configurationDe('petite-conflit');
    const reglages = { graine: 9, nombre: 2, arret: 60000, historique: 1000 };
    const { postes, envoyer } = porteeFactice();
    envoyer({ type: 'lancer', configuration, reglages });
    const avancements = postes.filter(({ type }) => type === 'avancement');
    assert.ok(avancements.length > 0, 'aucun avancement');
    assert.ok(avancements.length <= Math.ceil((reglages.nombre * reglages.arret) / 1000 / CADENCE_AVANCEMENT));
    assert.deepEqual(avancements, [
      { type: 'avancement', fait: 50000, total: 120000 },
      { type: 'avancement', fait: 100000, total: 120000 },
    ]);
    assert.deepEqual(postes.at(-1), { type: 'resultat', propositions: rechercher(configuration, reglages) });
    assert.equal(postes.length, avancements.length + 1);
  });

  test('des places manquantes postent erreur PLACES_MANQUANTES, les détails du moteur', () => {
    const configuration = configurationDe('petite');
    configuration.tables = configuration.tables.slice(1);
    const { postes, envoyer } = porteeFactice();
    envoyer({ type: 'lancer', configuration, reglages: { graine: 1, nombre: 1, arret: 10 } });
    assert.deepEqual(postes, [{ type: 'erreur', code: 'PLACES_MANQUANTES', details: { placesManquantes: 3 } }]);
  });

  test('une graine de 2^32 poste erreur REGLAGE_HORS_DOMAINE, qui nomme le réglage, sans le message du moteur', () => {
    const { postes, envoyer } = porteeFactice();
    envoyer({ type: 'lancer', configuration: configurationDe('petite'), reglages: { graine: 2 ** 32, nombre: 1, arret: 10 } });
    assert.deepEqual(postes, [{ type: 'erreur', code: 'REGLAGE_HORS_DOMAINE', details: { reglage: 'graine', remede: null } }]);
  });

  test("un message d'un autre type ne lance rien", () => {
    const { postes, envoyer } = porteeFactice();
    envoyer({ type: 'inconnu' });
    envoyer(null);
    assert.deepEqual(postes, []);
  });
});
