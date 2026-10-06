// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le Chromium des épreuves du navigateur : celui de Playwright par défaut,
// celui que GTT_CHROMIUM désigne sinon, et vitest.config.js applique la règle.
import assert from 'node:assert/strict';
import configuration from '../vitest.config.js';
import { optionsChromium } from './chromium.js';
import { describe, test } from './lanceur.js';

describe('chromium : l’exécutable des épreuves du navigateur', () => {
  test('sans GTT_CHROMIUM, Playwright lance le Chromium qu’il a téléchargé', () => {
    assert.deepEqual(optionsChromium({}), {});
    assert.deepEqual(optionsChromium({ GTT_CHROMIUM: '' }), {});
  });

  test('GTT_CHROMIUM désigne l’exécutable que Playwright lance', () => {
    assert.deepEqual(optionsChromium({ GTT_CHROMIUM: '/nix/store/abc-chromium/bin/chromium' }), {
      launchOptions: { executablePath: '/nix/store/abc-chromium/bin/chromium' },
    });
  });

  test('vitest.config.js passe au projet navigateur les options de cet environnement', () => {
    const navigateur = configuration.test.projects.find(({ test: { name } }) => name === 'navigateur');
    assert.deepEqual(navigateur.test.browser.provider.options, optionsChromium(process.env));
  });
});
