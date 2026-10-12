// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Chaque mode que pose un script npm (« --mode … » dans package.json) a son
// libellé de provenance, comme le mode test que pose Vitest ; un mode sans
// libellé s'affiche sous son propre nom plutôt que de laisser le bandeau muet
// sur la provenance.
//
// Les textes des écrans se partagent en tables, une par écran, sous
// libelles/ : chacune exporte TABLE, une Map de libellés, et libelles.js les
// assemble par ordre alphabétique des fichiers.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { TABLES_APPLICATION } from '../application/libelles.js';
import { creerTraduction } from '../application/traduction.js';
import { describe, test } from '../../test/lanceur.js';
import { TABLES_INTERFACE, aUnLibelle, libelleProvenance, titreAvecVersion } from './libelles.js';

// Modes nommés par les scripts de package.json, triés, sans doublon.
function modesDesScripts() {
  const paquet = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
  );
  const modes = new Set();
  for (const commande of Object.values(paquet.scripts)) {
    for (const [, mode] of commande.matchAll(/--mode[= ](\S+)/g)) {
      modes.add(mode);
    }
  }
  return [...modes].sort();
}

describe('libellés', () => {
  test('libelleProvenance nomme les quatre modes de construction', () => {
    assert.equal(libelleProvenance('developpement'), 'développement');
    assert.equal(libelleProvenance('livraison'), 'livraison');
    assert.equal(libelleProvenance('documentation'), 'documentation');
    assert.equal(libelleProvenance('test'), 'épreuve');
  });

  test('chaque mode que pose un script npm a un libellé de provenance', () => {
    const modes = modesDesScripts();
    assert.ok(modes.length > 0, 'aucun « --mode » dans les scripts de package.json');
    assert.deepEqual(modes.filter((mode) => !aUnLibelle(mode)), []);
  });

  test('libelleProvenance rend un mode sans libellé sous son propre nom', () => {
    assert.equal(libelleProvenance('production'), 'production');
    assert.equal(libelleProvenance('constructor'), 'constructor');
    assert.equal(aUnLibelle('constructor'), false);
  });

  test('titreAvecVersion joint le nom et la version par un tiret cadratin', () => {
    assert.equal(titreAvecVersion('X'), 'Gestion table tournante Libre — X');
  });
});

// Les modules de table de libelles/, épreuves exceptées, par ordre
// alphabétique, et ce que chacun exporte.
async function tablesDuDossier() {
  const noms = readdirSync(new URL('./libelles/', import.meta.url))
    .filter((nom) => nom.endsWith('.js') && !nom.endsWith('.test.js'))
    .sort();
  return Promise.all(noms.map(async (nom) => ({ table: nom.slice(0, -3), module: await import(`./libelles/${nom}`) })));
}

describe('libellés : les tables des écrans (§ 14.6)', () => {
  test('chaque module de libelles/ exporte TABLE, une Map ; TABLES_INTERFACE les assemble, dix-sept, par ordre alphabétique', async () => {
    const tables = await tablesDuDossier();
    assert.equal(tables.length, 17);
    assert.deepEqual(tables.map(({ table }) => table), [
      'accueil', 'badges', 'communs', 'coquille', 'diagnostic', 'evenement', 'feuilles', 'generation', 'graphiques',
      'import', 'impression', 'participants', 'plan', 'propositions', 'qualite', 'raccourcis', 'tables',
    ]);
    for (const { table, module } of tables) assert.ok(module.TABLE instanceof Map, table);
    assert.equal(TABLES_INTERFACE.length, tables.length);
    tables.forEach(({ table, module }, rang) => assert.equal(TABLES_INTERFACE[rang], module.TABLE, table));
  });

  test("les tables d'écran ne portent que des libellés, chacun préfixé du nom de sa table", async () => {
    const tables = await tablesDuDossier();
    let comptees = 0;
    for (const { table, module } of tables) {
      const forme = new RegExp(`^${table}(?:\\.[a-z][A-Za-z0-9]*)+$`);
      for (const cle of module.TABLE.keys()) {
        comptees += 1;
        assert.match(cle, forme, table);
      }
    }
    assert.ok(comptees > 0, 'aucune clé');
  });

  test("les tables de l'application et des écrans se réunissent sans clé partagée", () => {
    assert.ok(TABLES_APPLICATION.length > 0 && TABLES_INTERFACE.length > 0);
    const { cles } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
    assert.ok(cles().length > 0);
  });

  test("la coquille se lit en français dans coquille.js : son titre est celui de titreAvecVersion, ses provenances celles de libelleProvenance", () => {
    const { t } = creerTraduction(TABLES_INTERFACE);
    assert.equal(t('coquille.titre', { version: 'X' }), titreAvecVersion('X'));
    assert.equal(t('coquille.nom'), 'Gestion table tournante Libre');
    for (const mode of ['developpement', 'livraison', 'documentation', 'test']) {
      assert.equal(t(`coquille.provenance.${mode}`), libelleProvenance(mode), mode);
    }
  });
});
