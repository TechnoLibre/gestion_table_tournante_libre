// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'imprimante de la plateforme web (§ 13.4, § 11.7) : la boîte de dialogue
// du navigateur, sans retour sur ce qu'elle devient. Une fenêtre factice
// compte ses appels à print.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { PAPIERS } from '../geometrie/papiers.js';
import { creerImprimanteWeb } from './imprimante_web.js';

// Une fenêtre qui ne sait qu'imprimer, et compte ses appels.
function fenetreFactice() {
  const fenetre = {
    appels: 0,
    print() {
      fenetre.appels += 1;
    },
  };
  return fenetre;
}

describe('imprimante web (§ 13.4)', () => {
  test('imprimer appelle print une fois, et rend l’issue inconnue sans cause, pour chaque papier et chaque orientation', async () => {
    for (const papier of Object.keys(PAPIERS)) {
      for (const orientation of ['portrait', 'paysage']) {
        const fenetre = fenetreFactice();
        const issue = await creerImprimanteWeb(fenetre).imprimer({ papier, orientation });
        assert.deepEqual(issue, { issue: 'inconnue', cause: null }, `${papier} ${orientation}`);
        assert.equal(fenetre.appels, 1, `${papier} ${orientation}`);
      }
    }
  });

  test('chaque impression appelle print à nouveau : l’imprimante ne garde aucun état', async () => {
    const fenetre = fenetreFactice();
    const imprimante = creerImprimanteWeb(fenetre);
    await imprimante.imprimer({ papier: 'A4', orientation: 'portrait' });
    await imprimante.imprimer({ papier: 'A4', orientation: 'paysage' });
    assert.equal(fenetre.appels, 2);
  });

  test('une option hors domaine rejette TypeError sans appeler print', async () => {
    const refusees = [
      { papier: 'A3', orientation: 'portrait' },
      { papier: 'toString', orientation: 'portrait' },
      { papier: undefined, orientation: 'portrait' },
      { papier: 'A4', orientation: 'Portrait' },
      { papier: 'A4', orientation: 'landscape' },
      { papier: 'A4' },
    ];
    for (const options of refusees) {
      const fenetre = fenetreFactice();
      await assert.rejects(creerImprimanteWeb(fenetre).imprimer(options), TypeError, JSON.stringify(options));
      assert.equal(fenetre.appels, 0, JSON.stringify(options));
    }
    const fenetre = fenetreFactice();
    await assert.rejects(creerImprimanteWeb(fenetre).imprimer(), TypeError);
    assert.equal(fenetre.appels, 0);
  });

  test('une fenêtre sans print se refuse à la construction', () => {
    for (const fenetre of [null, undefined, {}, { print: 'oui' }]) {
      assert.throws(() => creerImprimanteWeb(fenetre), TypeError, String(fenetre));
    }
  });
});
