// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// L'imprimante de la coquille electron, côté page (§ 13.4, § 11.7) : le
// pont window.gtt.imprimer, que remplace ici un pont factice qui consigne
// chaque demande et rend la réponse qu'on lui donne. Ce que le processus
// principal fait de la demande s'éprouve dans test/coquille.test.js.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { PAPIERS } from '../geometrie/papiers.js';
import { creerImprimanteElectron } from './imprimante_electron.js';

// Un pont qui consigne chaque demande d'impression et rend la réponse
// suivante, ou rejette l'erreur donnée.
function pontFactice(reponses = [], rejet = null) {
  const pont = {
    demandes: [],
    async imprimer(options) {
      pont.demandes.push(options);
      if (rejet !== null) throw rejet;
      return reponses.shift();
    },
  };
  return pont;
}

describe('imprimante electron (§ 13.4)', () => {
  test("imprimer passe au pont le papier et l'orientation, eux seuls, une fois, et rend l'issue du processus principal, pour chaque papier et chaque orientation", async () => {
    for (const papier of Object.keys(PAPIERS)) {
      for (const orientation of ['portrait', 'paysage']) {
        const pont = pontFactice([{ issue: 'envoye', cause: null }]);
        const issue = await creerImprimanteElectron(pont).imprimer({ papier, orientation, silent: true });
        assert.deepEqual(issue, { issue: 'envoye', cause: null }, `${papier} ${orientation}`);
        assert.deepEqual(pont.demandes, [{ papier, orientation }], `${papier} ${orientation}`);
      }
    }
  });

  test('les issues annulée et échouée passent telles quelles, cause comprise', async () => {
    const reponses = [
      { issue: 'annule', cause: null },
      { issue: 'echec', cause: 'failed' },
      { issue: 'echec', cause: null },
    ];
    const pont = pontFactice(reponses.map((reponse) => ({ ...reponse })));
    const imprimante = creerImprimanteElectron(pont);
    for (const attendu of reponses) {
      assert.deepEqual(await imprimante.imprimer({ papier: 'A4', orientation: 'paysage' }), attendu);
    }
    assert.equal(pont.demandes.length, 3);
  });

  test('une option hors domaine rejette TypeError sans appeler le pont', async () => {
    const refusees = [
      { papier: 'A3', orientation: 'portrait' },
      { papier: 'toString', orientation: 'portrait' },
      { papier: undefined, orientation: 'portrait' },
      { papier: 'A4', orientation: 'Portrait' },
      { papier: 'A4', orientation: 'landscape' },
      { papier: 'A4' },
    ];
    for (const options of refusees) {
      const pont = pontFactice();
      await assert.rejects(creerImprimanteElectron(pont).imprimer(options), TypeError, JSON.stringify(options));
      assert.deepEqual(pont.demandes, [], JSON.stringify(options));
    }
    const pont = pontFactice();
    await assert.rejects(creerImprimanteElectron(pont).imprimer(), TypeError);
    assert.deepEqual(pont.demandes, []);
  });

  test("une réponse d'une autre forme lève TypeError : issue inconnue de la coquille, cause d'un autre type ou d'une issue qui n'en porte pas, réponse absente", async () => {
    const fautives = [
      undefined,
      null,
      { issue: 'inconnue', cause: null },
      { issue: 'envoye' },
      { issue: 'echec', cause: 3 },
      { issue: 'imprime', cause: null },
      { issue: 'annule', cause: 'cancelled' },
      { issue: 'envoye', cause: 'failed' },
      'envoye',
    ];
    for (const reponse of fautives) {
      const pont = pontFactice([reponse]);
      await assert.rejects(creerImprimanteElectron(pont).imprimer({ papier: 'A4', orientation: 'portrait' }), TypeError, JSON.stringify(reponse));
    }
  });

  test('un refus du processus principal se rejette tel quel', async () => {
    const refus = new Error("Error invoking remote method 'gtt:imprimer': TypeError: impression : option refusée");
    const pont = pontFactice([], refus);
    await assert.rejects(creerImprimanteElectron(pont).imprimer({ papier: 'A4', orientation: 'portrait' }), (erreur) => erreur === refus);
  });

  test('un pont sans imprimer se refuse à la construction', () => {
    for (const pont of [null, undefined, {}, { imprimer: 'oui' }, { fichiers: {} }]) {
      assert.throws(() => creerImprimanteElectron(pont), TypeError, String(pont));
    }
  });
});
