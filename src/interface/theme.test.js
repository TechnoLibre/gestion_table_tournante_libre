// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le thème d'un lancement (§ 19.2) : la préférence du système, lue à chaque
// lancement ; rien ne le garde d'une séance à l'autre.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { TABLE as COQUILLE } from './libelles/coquille.js';
import { THEMES, cleDeTheme, themeInitial } from './theme.js';

describe('themeInitial (§ 19.2)', () => {
  test('une préférence sombre donne le thème sombre, toute autre le clair', () => {
    assert.equal(themeInitial(true), 'sombre');
    assert.equal(themeInitial(false), 'clair');
  });

  test('les deux thèmes, dans l’ordre du réglage, figés', () => {
    assert.deepEqual(THEMES, ['clair', 'sombre']);
    assert.ok(Object.isFrozen(THEMES));
  });
});

describe('cleDeTheme', () => {
  test('chaque thème a sa clé coquille.theme.<nom>, avec son texte ; un autre lève RangeError', () => {
    assert.ok(THEMES.length > 0);
    for (const theme of THEMES) {
      assert.equal(cleDeTheme(theme), `coquille.theme.${theme}`);
      assert.equal(typeof COQUILLE.get(cleDeTheme(theme)), 'string', theme);
    }
    assert.throws(() => cleDeTheme('gris'), RangeError);
  });
});
