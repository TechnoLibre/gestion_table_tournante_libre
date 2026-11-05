// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Empreintes de référence du moteur, série node-long (§ 5.7, § 14.10,
// § 15.5) : la grande démonstration et sa variante sans exception, puis la
// grande portant les inclusions de
// test/fixtures/moteur/inclusions_grande.json, sous les trois graines et le
// compte réduit de test/empreintes_moteur.js. Chaque plan rendu par
// rechercher se compare, empreinte et grandeurs nommées, au fichier versionné
// test/fixtures/moteur/empreintes_defaut.json, que seule
// src/moteur/empreintes.test.js récrit, sous GTT_EMPREINTES=ecrire : cette
// épreuve-ci ne fait que relire, et refuse de se jouer sous ce mode, où elle
// pourrait lire un fichier en cours d'écriture.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import {
  ARRET,
  GRAINES,
  differences,
  empreintesDesInclusions,
  empreintesDesPlans,
  exigerVerification,
  lireEmpreintes,
} from '../../test/empreintes_moteur.js';
import { HISTORIQUE_PAR_DEFAUT } from './recherche.js';

exigerVerification(process.env);
const REFERENCE = lireEmpreintes();

describe('empreintes de référence : la grande démonstration et sa variante sans exception (§ 14.10)', () => {
  test('la référence a été relevée à l’historique par défaut de la recherche', () => {
    assert.equal(REFERENCE.reglages.historique, HISTORIQUE_PAR_DEFAUT);
  });

  for (const cle of ['grande', 'grande-sans-exception']) {
    test(`${cle} : les plans des graines ${GRAINES.join(', ')}, à ${ARRET} mouvements, sont ceux de la référence`, () => {
      const calcule = empreintesDesPlans(cle);
      assert.deepEqual(differences(cle, calcule, REFERENCE.plans[cle]), []);
      assert.deepEqual(calcule, REFERENCE.plans[cle], cle);
    });
  }

  test(`grande portant les inclusions de la fixture : les plans des graines ${GRAINES.join(', ')}, à ${ARRET} mouvements, et leurs inclusions non satisfaites, sont ceux de la référence`, () => {
    const calcule = empreintesDesInclusions();
    assert.deepEqual(differences('inclusions', calcule, REFERENCE.inclusions), []);
    assert.deepEqual(calcule, REFERENCE.inclusions);
  });
});
