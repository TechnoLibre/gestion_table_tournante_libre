// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Chaque mode que pose un script npm (« --mode … » dans package.json) a son
// libellé de provenance, comme le mode test que pose Vitest ; un mode sans
// libellé s'affiche sous son propre nom plutôt que de laisser le bandeau muet
// sur la provenance.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from '../../test/lanceur.js';
import { aUnLibelle, libelleProvenance, titreAvecVersion } from './libelles.js';

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
