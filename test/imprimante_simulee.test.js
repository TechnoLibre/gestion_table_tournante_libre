// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// L'imprimante d'épreuve (§ 13.4) : la troisième implémentation de la
// frontière « impression », qui relève ses appels et rend l'issue qu'on lui
// règle. Son câblage — src/main.js, le montage des épreuves, App — se garde
// dans test/arborescence.test.js, que leurs motifs de surveillance relancent.
import assert from 'node:assert/strict';
import { PAPIERS } from '../src/geometrie/papiers.js';
import { creerImprimanteSimulee } from './imprimante_simulee.js';
import { describe, test } from './lanceur.js';

describe("imprimante d'épreuve", () => {
  test('par défaut, chaque impression est envoyée, sans cause, et chaque appel se relève avec ses options, dans l’ordre', async () => {
    const imprimante = creerImprimanteSimulee();
    const demandes = [];
    for (const papier of Object.keys(PAPIERS)) {
      for (const orientation of ['portrait', 'paysage']) {
        demandes.push({ papier, orientation });
        assert.deepEqual(await imprimante.imprimer({ papier, orientation }), { issue: 'envoye', cause: null });
      }
    }
    assert.deepEqual(imprimante.appels(), demandes);
  });

  test("l'issue et la cause réglées se rendent à chaque appel : annulée, échouée et sa cause, inconnue", async () => {
    for (const reglage of [
      { issue: 'annule', cause: null },
      { issue: 'echec', cause: 'failed' },
      { issue: 'inconnue', cause: null },
    ]) {
      const imprimante = creerImprimanteSimulee(reglage);
      assert.deepEqual(await imprimante.imprimer({ papier: 'A4', orientation: 'portrait' }), reglage);
      assert.deepEqual(await imprimante.imprimer({ papier: 'A4', orientation: 'paysage' }), reglage);
      assert.equal(imprimante.appels().length, 2);
    }
  });

  test('le relevé est une copie : ni les options reçues, ni le tableau rendu ne le changent ; seuls papier et orientation y entrent', async () => {
    const imprimante = creerImprimanteSimulee();
    const options = { papier: 'A4', orientation: 'portrait', silent: true };
    await imprimante.imprimer(options);
    options.papier = 'Lettre';
    imprimante.appels().push({ papier: 'A4', orientation: 'paysage' });
    imprimante.appels()[0].orientation = 'paysage';
    assert.deepEqual(imprimante.appels(), [{ papier: 'A4', orientation: 'portrait' }]);
  });

  test('une option hors domaine rejette TypeError, comme les deux imprimantes réelles, et ne se relève pas', async () => {
    const imprimante = creerImprimanteSimulee();
    for (const options of [
      { papier: 'A3', orientation: 'portrait' },
      { papier: 'toString', orientation: 'portrait' },
      { papier: 'A4', orientation: 'landscape' },
      { papier: 'A4' },
      undefined,
    ]) {
      await assert.rejects(imprimante.imprimer(options), TypeError, JSON.stringify(options));
    }
    assert.deepEqual(imprimante.appels(), []);
  });

  test("un réglage hors du contrat se refuse à la construction : issue inconnue, cause d'un autre type, cause pour une issue qui n'en porte pas", () => {
    for (const reglage of [
      { issue: 'imprime' },
      { issue: 'echec', cause: 3 },
      { issue: 'envoye', cause: 'failed' },
      { issue: 'annule', cause: 'cancelled' },
      null,
    ]) {
      assert.throws(() => creerImprimanteSimulee(reglage), TypeError, JSON.stringify(reglage));
    }
  });
});
