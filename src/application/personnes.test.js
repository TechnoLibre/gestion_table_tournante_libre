// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du nom affiché (§ 8.2) : la seule composition du nom d'une
// personne, celle des libellés figés et du plan. Les noms sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { nomAffiche as nomDesCommandes } from './commandes.js';
import { libelle } from './libelles.js';
import { nomAffiche } from './personnes.js';

describe('personnes : le nom affiché (§ 8.2)', () => {
  test('prénom puis nom ; le nom seul quand le prénom est null', () => {
    assert.equal(nomAffiche({ nom: 'Pervenche', prenom: 'Théo' }), 'Théo Pervenche');
    assert.equal(nomAffiche({ nom: 'Grisaille', prenom: null }), 'Grisaille');
  });

  test('les autres champs de la personne ne comptent pas', () => {
    assert.equal(
      nomAffiche({ id: 4, nom: 'Lacasse', prenom: 'Ondine', appartenance: 'Club des Merles', exclu: true }),
      'Ondine Lacasse',
    );
  });

  test('nomAffiche importé de commandes.js est celui de personnes.js', () => {
    assert.equal(nomDesCommandes, nomAffiche);
  });

  test('un libellé figé qui nomme une personne la nomme par nomAffiche', () => {
    const personne = nomAffiche({ nom: 'Ombrelle', prenom: 'Iris' });
    assert.equal(libelle('ENTREE_AJOUTER_PARTICIPANT', { personne }), 'Ajouté Iris Ombrelle');
  });
});
