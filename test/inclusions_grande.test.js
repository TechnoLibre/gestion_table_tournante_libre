// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de la fixture de mesure des inclusions (test/inclusions_grande.js) :
// le fichier est ce que le tirage rend, et porte ce que la mesure demande —
// une personne sur cinq à trois inclusions de personnes et une
// d'organisation, des rencontres demandées des deux côtés, une inclusion
// contredite par un conflit et une hors d'atteinte.
import assert from 'node:assert/strict';
import { normaliser } from '../src/moteur/configuration.js';
import { ciblesDesInclusions } from '../src/moteur/inclusions.js';
import { GRAINE, grande, grandeAvecInclusions, lireInclusions, tirerInclusions } from './inclusions_grande.js';
import { describe, test } from './lanceur.js';

describe('la fixture des inclusions sur la grande démonstration', () => {
  test('le fichier est le tirage de sa graine sur la grande démonstration', () => {
    assert.equal(GRAINE, 61);
    assert.deepEqual(lireInclusions(), tirerInclusions(grande()));
  });

  test('une personne sur cinq porte trois inclusions de personnes et une d’organisation ; réciproques, contredite et hors d’atteinte y sont', () => {
    const personnes = grande().participants.sort((a, b) => a.id - b.id);
    const parId = new Map(lireInclusions().map((entree) => [entree.id, entree]));
    const porteuses = personnes.filter((_, rang) => rang % 5 === 0);
    assert.equal(porteuses.length, 52);
    for (const { id } of porteuses) {
      const { inclusionsParticipant = [], organisationsDe = [] } = parId.get(id);
      assert.ok(inclusionsParticipant.length >= 3, `${id}`);
      assert.equal(organisationsDe.length, 1, `${id}`);
    }
    // Les organisations se lisent sur la configuration, sous ses noms.
    const avec = new Map(grandeAvecInclusions().participants.map((personne) => [personne.id, personne]));
    const [premiere] = porteuses;
    assert.deepEqual(avec.get(premiere.id).inclusionsOrganisation, [avec.get(parId.get(premiere.id).organisationsDe[0]).organisation]);
    assert.deepEqual(avec.get(premiere.id).conflits, [avec.get(parId.get(premiere.id).conflitsDe[0]).organisation]);
    const instance = normaliser(grandeAvecInclusions());
    const raisons = new Set(instance.inclusionsHorsAtteinte.map(({ raison }) => raison));
    assert.ok(raisons.has('conflit') && raisons.has('tablesImposees'), [...raisons].join(', '));
    const { uniteReciproque, auDela } = ciblesDesInclusions(instance);
    assert.ok(uniteReciproque.some((r) => r === 1));
    assert.ok(instance.inclusionsActives > 200);
    assert.ok(auDela.every((a) => a === 0));
  });
});
