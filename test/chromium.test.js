// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le Chromium des épreuves du navigateur : celui de Playwright par défaut,
// celui que GTT_CHROMIUM désigne sinon ; sous des paramètres régionaux qui ne
// sont pas UTF-8, il reçoit l'environnement sous LANG=C.UTF-8. Le projet
// navigateur le lance sans réseau hors de la boucle locale, au facteur
// d'échelle 1 (§ 19.2, § 19.4), et lui donne les commandes et le mode des
// captures d'écran (§ 19.5), et la commande d'impression (§ 11.7).
// vitest.config.js applique la règle ; le Makefile lance la publication.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import configuration from '../vitest.config.js';
import { ARGUMENTS_NAVIGATEUR, MODE_AFFICHAGE, horsBoucle, optionsChromium, optionsNavigateur, suivreRequetes } from './chromium.js';
import { describe, test } from './lanceur.js';
import * as commandesDocumentation from './navigateur/commandes_documentation.js';
import * as commandesImpression from './navigateur/commandes_impression.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));

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

  test('vitest.config.js passe au projet navigateur les options de cet environnement, réseau et échelle compris', () => {
    const navigateur = configuration.test.projects.find(({ test: { name } }) => name === 'navigateur');
    assert.deepEqual(navigateur.test.browser.provider.options, optionsNavigateur(process.env));
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

describe('chromium : aucun réseau hors de la boucle locale, le facteur d’échelle 1 (§ 19.2, § 19.4)', () => {
  test('les arguments du navigateur : le résolveur ne résout que la boucle locale, un mandataire mort reçoit le reste, le facteur d’échelle est fixé au lancement', () => {
    assert.deepEqual(ARGUMENTS_NAVIGATEUR, [
      '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost',
      '--proxy-server=127.0.0.1:9',
      '--force-device-scale-factor=1',
    ]);
    // La boucle locale contourne le mandataire d'office ; <-loopback> la
    // ferait passer par lui, et la page des épreuves ne se chargerait plus.
    assert.equal(ARGUMENTS_NAVIGATEUR.some((argument) => argument.includes('<-loopback>')), false);
    assert.equal(Object.isFrozen(ARGUMENTS_NAVIGATEUR), true);
  });

  test('optionsNavigateur : les options de optionsChromium, les arguments ajoutés, un contexte au facteur 1 ; l’environnement reçu reste tel quel', () => {
    assert.deepEqual(optionsNavigateur({ LANG: 'fr_CA.UTF-8' }), {
      launchOptions: { args: [...ARGUMENTS_NAVIGATEUR] },
      contextOptions: { deviceScaleFactor: 1 },
    });
    const env = { LC_ALL: 'C', GTT_CHROMIUM: '/opt/essai/chromium' };
    assert.deepEqual(optionsNavigateur(env), {
      launchOptions: {
        executablePath: '/opt/essai/chromium',
        env: { GTT_CHROMIUM: '/opt/essai/chromium', LANG: 'C.UTF-8' },
        args: [...ARGUMENTS_NAVIGATEUR],
      },
      contextOptions: { deviceScaleFactor: 1 },
    });
    assert.deepEqual(env, { LC_ALL: 'C', GTT_CHROMIUM: '/opt/essai/chromium' });
  });

  test('horsBoucle : une adresse hors de la boucle locale est relevée ; la boucle locale et les adresses sans réseau ne le sont pas', () => {
    const dehors = [
      'http://192.0.2.1/',
      'https://exemple.invalid/police.woff2',
      'ws://198.51.100.7:8080/',
      'http://localhost.exemple.invalid/',
      'http://127.0.0.1.exemple.invalid/',
      'http://[2001:db8::1]/',
      'ftp://exemple.invalid/x',
      'gopher://exemple.invalid/',
    ];
    const dedans = [
      'http://localhost:63315/__vitest_test__/',
      'ws://localhost:63315/__vitest_browser_api__',
      'http://LOCALHOST/',
      'http://127.0.0.1:5173/collecteur.js',
      'http://127.8.9.10/',
      'http://[::1]:63315/',
      'data:text/plain,x',
      'blob:http://localhost:63315/0f3c',
      'about:blank',
    ];
    for (const adresse of dehors) assert.equal(horsBoucle(adresse), true, adresse);
    for (const adresse of dedans) assert.equal(horsBoucle(adresse), false, adresse);
    assert.equal(horsBoucle('pas une adresse'), true);
  });

  test('suivreRequetes : chaque requête hors boucle de la page, relevée une fois et dans l’ordre ; un second suivi de la même page reprend le premier', () => {
    const ecouteurs = [];
    const page = { on: (evenement, fn) => ecouteurs.push([evenement, fn]) };
    const requete = (adresse) => ({ url: () => adresse });
    const suivi = suivreRequetes(page);
    assert.deepEqual(ecouteurs.map(([evenement]) => evenement), ['request', 'requestfailed']);
    const [[, ecouter]] = ecouteurs;
    ecouter(requete('http://localhost:63315/a.js'));
    ecouter(requete('http://192.0.2.1/'));
    ecouter(requete('https://exemple.invalid/b'));
    assert.deepEqual(suivreRequetes(page).relever(), ['http://192.0.2.1/', 'https://exemple.invalid/b']);
    assert.equal(ecouteurs.length, 2);
    assert.deepEqual(suivi.relever(), []);
    ecouter(requete('http://192.0.2.1/c'));
    assert.deepEqual(suivi.relever(), ['http://192.0.2.1/c']);
    assert.deepEqual(suivreRequetes({ on: () => {} }).relever(), []);
  });

  test('suivreRequetes : chaque échec d’une requête hors boucle, avec sa cause, relevé une fois ; ceux de la boucle locale ne le sont pas', () => {
    const ecouteurs = new Map();
    const page = { on: (evenement, fn) => ecouteurs.set(evenement, fn) };
    const suivi = suivreRequetes(page);
    assert.deepEqual([...ecouteurs.keys()], ['request', 'requestfailed']);
    const echec = (adresse, errorText) => ({ url: () => adresse, failure: () => (errorText === null ? null : { errorText }) });
    ecouteurs.get('requestfailed')(echec('http://localhost:63315/a.js', 'net::ERR_ABORTED'));
    ecouteurs.get('requestfailed')(echec('http://192.0.2.1/', 'net::ERR_PROXY_CONNECTION_FAILED'));
    ecouteurs.get('requestfailed')(echec('http://192.0.2.1/b', null));
    assert.deepEqual(suivi.releverEchecs(), [
      { adresse: 'http://192.0.2.1/', cause: 'net::ERR_PROXY_CONNECTION_FAILED' },
      { adresse: 'http://192.0.2.1/b', cause: null },
    ]);
    assert.deepEqual(suivi.releverEchecs(), []);
    assert.deepEqual(suivi.relever(), []);
  });
});

describe('le projet navigateur : les commandes et le mode des captures d’écran (§ 19.5)', () => {
  const navigateur = configuration.test.projects.find(({ test: { name } }) => name === 'navigateur');

  // Un seul mode d'affichage, nommé au manifeste (§ 19.4) : le projet
  // navigateur lance Chromium sans tête, et photographier refuse une page
  // dont le userAgent ne le dit pas.
  test('le projet navigateur tourne sans tête, et MODE_AFFICHAGE le nomme', () => {
    assert.equal(navigateur.test.browser.headless, true);
    assert.deepEqual(navigateur.test.browser.instances, [{ browser: 'chromium' }]);
    assert.equal(MODE_AFFICHAGE, 'chromium-headless-shell');
  });

  test('modeCaptures : verifier par défaut, ecrire sous GTT_CAPTURES=ecrire ; une autre valeur lève en la nommant', () => {
    assert.equal(commandesDocumentation.modeCaptures({}), 'verifier');
    assert.equal(commandesDocumentation.modeCaptures({ GTT_CAPTURES: '' }), 'verifier');
    assert.equal(commandesDocumentation.modeCaptures({ GTT_CAPTURES: 'verifier' }), 'verifier');
    assert.equal(commandesDocumentation.modeCaptures({ GTT_CAPTURES: 'ecrire' }), 'ecrire');
    assert.throws(() => commandesDocumentation.modeCaptures({ GTT_CAPTURES: 'ecrir' }), /GTT_CAPTURES.*« ecrir »/);
  });

  test('vitest.config.js fournit le mode à la page par provide, et déclare chaque commande de commandes_documentation.js et de commandes_impression.js, et elles seules', () => {
    assert.deepEqual(navigateur.test.provide, { captures: { mode: commandesDocumentation.modeCaptures(process.env) } });
    const declarees = navigateur.test.browser.commands;
    const modules = [commandesDocumentation, commandesImpression];
    const noms = modules.flatMap(({ COMMANDES }) => COMMANDES);
    assert.equal(new Set(noms).size, noms.length, 'un nom de commande dans deux modules');
    assert.deepEqual(Object.keys(declarees).sort(), [...noms].sort());
    for (const module of modules) {
      assert.ok(module.COMMANDES.length > 0);
      for (const nom of module.COMMANDES) {
        assert.equal(typeof module[nom], 'function', nom);
        assert.equal(declarees[nom], module[nom], nom);
      }
    }
    assert.deepEqual(commandesImpression.COMMANDES, ['imprimerEnPdf']);
  });

  test('make captures lance le parcours du projet navigateur sous GTT_CAPTURES=ecrire, par avec_node ; .gitignore tait le dossier d’attente', () => {
    const makefile = readFileSync(join(RACINE, 'Makefile'), 'utf8');
    assert.match(makefile, /^\.PHONY: captures$/m);
    assert.match(makefile, /^captures: export GTT_CAPTURES := ecrire$/m);
    assert.match(
      makefile,
      /^captures: ## Photographie le parcours et publie doc\/captures \(§ 19\.5\)\n\t\$\(AVEC_NODE\) npx vitest run --project navigateur src\/interface\/parcours\.navigateur\.test\.js$/m,
    );
    const ignores = readFileSync(join(RACINE, '.gitignore'), 'utf8').split('\n');
    assert.ok(ignores.includes('doc/captures/.attente/'), ignores.join(' | '));
    assert.equal(ignores.some((ligne) => /^doc\/captures\/?$|^doc\/?$|\*\.png/.test(ligne)), false);
  });
});
