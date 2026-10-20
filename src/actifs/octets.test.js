// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le décodage d'une URL data: en base64, par lequel chargerLogo rend les
// octets du PNG. Le chargement lui-même passe par Vite (« ?raw »,
// « ?inline ») et s'éprouve dans le navigateur (actifs.navigateur.test.js).
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { octetsDeDonnees } from './octets.js';

describe('octetsDeDonnees', () => {
  test('rend les octets d’une URL data: en base64, paramètres compris, dans un tableau neuf à chaque appel', () => {
    const octets = [0, 1, 127, 128, 254, 255, 0x89, 0x50];
    const url = `data:image/png;base64,${Buffer.from(octets).toString('base64')}`;
    assert.deepEqual([...octetsDeDonnees(url)], octets);
    assert.ok(octetsDeDonnees(url) instanceof Uint8Array);
    assert.notEqual(octetsDeDonnees(url), octetsDeDonnees(url));
    assert.deepEqual([...octetsDeDonnees('data:image/png;nom=x;base64,AAE=')], [0, 1]);
    assert.deepEqual([...octetsDeDonnees('data:;base64,')], []);
  });

  test('tout autre texte lève TypeError : une adresse d’actif, une URL data: sans base64, même quand ses données en ont l’alphabet, des données hors de l’alphabet, une valeur qui n’est pas une chaîne', () => {
    const fautes = ['./assets/logo.png', 'data:image/svg+xml,%3Csvg%3E', 'data:text/plain,QUJD', 'texte:;base64,QUJD', 'data:image/png;base64,@@', null, 7];
    for (const faux of fautes) {
      assert.throws(() => octetsDeDonnees(faux), TypeError, String(faux));
    }
  });
});
