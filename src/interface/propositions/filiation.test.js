// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La phrase qui rattache une proposition dérivée à son départ (§ 5.7, D76,
// C7) : ses cinq formes, mot pour mot, et le vocabulaire du départ (D80) —
// jamais « variante » pour une dérivée.
import assert from 'node:assert/strict';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerFormat } from '../../application/format.js';
import { creerTraduction } from '../../application/traduction.js';
import { describe, test } from '../../../test/lanceur.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { TABLE } from '../libelles/propositions.js';
import { texteFiliation } from './filiation.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const format = creerFormat(t);

// Une filiation de la forme que rend derivationDe (src/application/depart.js).
const filiation = (depart, toursFiges = [], departPresent = true) => ({ depart, toursFiges, departPresent });

describe('la filiation d’une dérivée (§ 5.7, D76, C7)', () => {
  test('null pour une proposition qui n’est pas une dérivée', () => {
    assert.equal(texteFiliation(null, { t, format }), null);
  });

  test('les cinq formes : sans tour figé, un, deux, trois tours figés, et le départ qui n’est plus dans la liste', () => {
    assert.equal(texteFiliation(filiation(4), { t, format }), 'Dérivée de n° 4.');
    assert.equal(texteFiliation(filiation(4, [1]), { t, format }), 'Dérivée de n° 4, tour 1 figé.');
    assert.equal(texteFiliation(filiation(4, [1, 2]), { t, format }), 'Dérivée de n° 4, tours 1 et 2 figés.');
    assert.equal(texteFiliation(filiation(4, [1, 2, 3]), { t, format }), 'Dérivée de n° 4, tours 1, 2 et 3 figés.');
    assert.equal(texteFiliation(filiation(4, [], false), { t, format }), "Dérivée de n° 4, qui n'est plus dans la liste.");
  });

  test('le départ absent ne nomme que lui, tours figés ou non : la phrase ne désigne aucune autre proposition', () => {
    assert.equal(texteFiliation(filiation(12, [2, 3], false), { t, format }), "Dérivée de n° 12, qui n'est plus dans la liste.");
  });

  test('les tours s’écrivent par format.nombre, dans l’ordre reçu, et le départ sous son numéro', () => {
    const recus = [];
    const formatEspion = { nombre: (n) => (recus.push(n), `«${n}»`) };
    assert.equal(texteFiliation(filiation(37, [2, 5]), { t, format: formatEspion }), 'Dérivée de n° 37, tours «2» et «5» figés.');
    assert.deepEqual(recus, [2, 5]);
    assert.equal(texteFiliation(filiation(1000, [10]), { t, format }), 'Dérivée de n° 1000, tour 10 figé.');
  });

  test('les clés propositions.filiation.* sont trois, et aucune de leurs valeurs ne dit « variante »', () => {
    const cles = [...TABLE.keys()].filter((cle) => cle.startsWith('propositions.filiation.'));
    assert.deepEqual(cles, ['propositions.filiation.derivee', 'propositions.filiation.deriveeFiges', 'propositions.filiation.departAbsent']);
    for (const cle of cles) {
      const texte = t(cle, { depart: 4, tours: ['1', '2'] });
      assert.doesNotMatch(texte, /variante/i, cle);
      assert.match(texte, /^Dérivée de n° 4/, cle);
    }
  });
});
