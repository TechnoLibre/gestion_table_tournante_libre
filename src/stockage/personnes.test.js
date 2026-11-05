// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du nom affiché (§ 8.2, § 10.1) : la seule composition du nom
// d'une personne. Les noms sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { nomAffiche } from './personnes.js';

describe('personnes : le nom affiché (§ 8.2)', () => {
  test('prénom puis nom ; le nom seul quand le prénom est null', () => {
    assert.equal(nomAffiche({ nom: 'Pervenche', prenom: 'Théo' }), 'Théo Pervenche');
    assert.equal(nomAffiche({ nom: 'Grisaille', prenom: null }), 'Grisaille');
  });

  test('les autres champs de la personne ne comptent pas', () => {
    assert.equal(
      nomAffiche({ id: 4, nom: 'Lacasse', prenom: 'Ondine', organisation: 'Club des Merles', exclu: true }),
      'Ondine Lacasse',
    );
  });
});
