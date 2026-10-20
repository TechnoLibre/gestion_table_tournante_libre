// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le projet node n'expose aucun DOM et ne compile aucun composant : un module
// qui toucherait document ou window, ou qui importerait un composant Svelte,
// y échoue au lieu de passer sur un environnement que la série node ne doit
// pas fournir (§ 14.4, § 14.8).
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { describe, test } from './lanceur.js';

describe('projet node', () => {
  test('globalThis.document vaut undefined', () => {
    assert.equal(globalThis.document, undefined);
  });

  test('globalThis.window vaut undefined', () => {
    assert.equal(globalThis.window, undefined);
  });

  test('un composant Svelte ne se charge pas', async () => {
    // Le composant existe, et son import échoue sur la lecture du source :
    // sans greffon Svelte, l'analyse des imports de Vite rejette la syntaxe
    // d'un .svelte, et sous « node --test » Node en refuse l'extension. Un
    // refus venu d'ailleurs, comme un module qui lirait window au chargement,
    // fait échouer l'épreuve au lieu de la satisfaire.
    assert.ok(existsSync(new URL('../src/interface/App.svelte', import.meta.url)));
    await assert.rejects(
      import('../src/interface/App.svelte'),
      /Failed to parse source for import analysis|Unknown file extension/,
    );
  });
});
