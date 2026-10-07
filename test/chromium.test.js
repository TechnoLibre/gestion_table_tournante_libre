// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le Chromium des épreuves du navigateur : celui de Playwright par défaut,
// celui que GTT_CHROMIUM désigne sinon ; sous des paramètres régionaux qui ne
// sont pas UTF-8, il reçoit l'environnement sous LANG=C.UTF-8. vitest.config.js
// applique la règle.
import assert from 'node:assert/strict';
import configuration from '../vitest.config.js';
import { optionsChromium } from './chromium.js';
import { describe, test } from './lanceur.js';

// Un environnement d'épreuve, sous des paramètres régionaux UTF-8.
const UTF8 = { PATH: '/usr/bin', LANG: 'fr_CA.UTF-8' };

describe('chromium : l’exécutable des épreuves du navigateur', () => {
  test('sans GTT_CHROMIUM, Playwright lance le Chromium qu’il a téléchargé', () => {
    assert.deepEqual(optionsChromium(UTF8), {});
    assert.deepEqual(optionsChromium({ ...UTF8, GTT_CHROMIUM: '' }), {});
  });

  test('GTT_CHROMIUM désigne l’exécutable que Playwright lance', () => {
    assert.deepEqual(optionsChromium({ ...UTF8, GTT_CHROMIUM: '/nix/store/abc-chromium/bin/chromium' }), {
      launchOptions: { executablePath: '/nix/store/abc-chromium/bin/chromium' },
    });
  });

  test('vitest.config.js passe au projet navigateur les options de cet environnement', () => {
    const navigateur = configuration.test.projects.find(({ test: { name } }) => name === 'navigateur');
    assert.deepEqual(navigateur.test.browser.provider.options, optionsChromium(process.env));
  });
});

describe('chromium : les paramètres régionaux du navigateur des épreuves', () => {
  test('des paramètres régionaux UTF-8 laissent Chromium hériter de l’environnement : LC_ALL, puis LC_CTYPE, puis LANG décident', () => {
    const utf8 = [
      { LANG: 'C.UTF-8' },
      { LANG: 'C.utf8' },
      { LANG: 'de_DE.UTF-8@euro' },
      { LANG: 'C', LC_CTYPE: 'fr_CA.utf8' },
      { LANG: 'C', LC_CTYPE: 'C', LC_ALL: 'fr_CA.UTF-8' },
      { LANG: 'fr_CA.UTF-8', LC_ALL: '', LC_CTYPE: '' },
    ];
    for (const env of utf8) assert.deepEqual(optionsChromium(env), {}, JSON.stringify(env));
  });

  test('hors UTF-8, Chromium reçoit une copie de l’environnement sous LANG=C.UTF-8, sans LC_ALL ni LC_CTYPE', () => {
    const cas = [
      [{}, {}],
      [{ PATH: '/usr/bin', LC_ALL: 'C' }, { PATH: '/usr/bin' }],
      [{ PATH: '/usr/bin', LANG: 'POSIX', LC_MESSAGES: 'fr_CA.UTF-8' }, { PATH: '/usr/bin', LC_MESSAGES: 'fr_CA.UTF-8' }],
      [{ LANG: 'fr_CA.UTF-8', LC_CTYPE: 'C' }, {}],
      [{ LANG: 'fr_CA.UTF-8', LC_ALL: 'fr_CA.ISO-8859-1' }, {}],
      [{ LANG: 'C.UTF-8-ancien' }, {}],
    ];
    for (const [env, reste] of cas) {
      const avant = { ...env };
      assert.deepEqual(
        optionsChromium(env),
        { launchOptions: { env: { ...reste, LANG: 'C.UTF-8' } } },
        JSON.stringify(env),
      );
      assert.deepEqual(env, avant, `${JSON.stringify(env)} : l'environnement reçu reste tel quel`);
    }
  });

  test('hors UTF-8, GTT_CHROMIUM désigne toujours l’exécutable, que l’environnement accompagne', () => {
    const env = { LC_ALL: 'C', GTT_CHROMIUM: '/opt/essai/chromium' };
    assert.deepEqual(optionsChromium(env), {
      launchOptions: { executablePath: '/opt/essai/chromium', env: { GTT_CHROMIUM: '/opt/essai/chromium', LANG: 'C.UTF-8' } },
    });
  });
});
