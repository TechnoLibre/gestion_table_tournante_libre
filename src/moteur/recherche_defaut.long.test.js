// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuve lourde de la recherche sous l'ordre par défaut (§ 5.7, § 15.3) :
// la petite démonstration et sa variante conflit, sans priorités réglées,
// vingt graines, trois propositions chacune, 200 000 mouvements. L'ordre par
// défaut range l'excédent de collisions, les rencontres répétées et les
// collisions cumulées devant l'écart au plafond a priori ; une descente s'y
// arrête parfois sur un plan sans excédent, mais aux collisions cumulées
// au-dessus du plancher, avec ou sans une paire revue et une personne à une
// rencontre de son plafond. L'épreuve ne demande donc pas l'optimum à
// chaque proposition, comme sous l'ordre du registre, mais tient deux
// planchers : le nombre de propositions à l'optimum, et le nombre de graines
// dont une proposition au moins l'atteint. Une recherche qui dégrade le
// défaut sur une petite salle passe sous l'un d'eux.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { CATALOGUE } from '../demo/catalogue.js';
import { indexerPlan, normaliser } from './configuration.js';
import { mesurer } from './indicateurs.js';
import { rechercher } from './recherche.js';

// Graines 0 à GRAINES − 1, trois propositions chacune, à ARRET mouvements.
const GRAINES = 20;
const PAR_GRAINE = 3;
const ARRET = 200_000;

// Par démonstration : le plancher de collisions cumulées de l'optimum —
// aucune dans la petite, une par tour dans la variante, dont le groupe de
// cinq ne se répartit pas sur quatre tables —, puis les deux planchers que
// l'épreuve tient, sur GRAINES × PAR_GRAINE propositions et sur GRAINES
// graines.
const CAS = [
  { cle: 'petite', collisions: 0, propositions: 40, graines: 18 },
  { cle: 'petite-conflit', collisions: 4, propositions: 29, graines: 19 },
];

// Le nombre de propositions examinées par démonstration.
const EXAMINEES = GRAINES * PAR_GRAINE;

describe("recherche : la petite démonstration et sa variante sous l'ordre par défaut (§ 5.7, § 15.3)", () => {
  for (const { cle, collisions, propositions, graines } of CAS) {
    const titre = `${cle} : au moins ${propositions} propositions sur ${EXAMINEES} à l'optimum, `
      + `et ${graines} graines sur ${GRAINES} qui l'atteignent`;
    test(titre, () => {
      const configuration = CATALOGUE.find((entree) => entree.cle === cle).construire();
      assert.equal(configuration.priorites, undefined);
      const instance = normaliser(configuration);
      let examinees = 0;
      let optimales = 0;
      let grainesAtteintes = 0;
      for (let graine = 0; graine < GRAINES; graine += 1) {
        let atteinte = false;
        for (const { plan } of rechercher(configuration, { graine, arret: ARRET, nombre: PAR_GRAINE })) {
          examinees += 1;
          // L'optimum : 8 rencontres pour chacun des douze, aucune paire
          // revue, les collisions au plancher, chacune d'une paire
          // différente.
          const m = mesurer(instance, indexerPlan(instance, plan));
          const optimale = m.rencontres.every((rencontres) => rencontres === 8)
            && m.maxRencontresPaire === 1
            && m.collisionsCumulees === collisions
            && m.pairesDistinctes === collisions;
          if (optimale) {
            optimales += 1;
            atteinte = true;
          }
        }
        if (atteinte) grainesAtteintes += 1;
      }
      assert.equal(examinees, EXAMINEES);
      assert.ok(
        optimales >= propositions,
        `${optimales} propositions sur ${EXAMINEES} à l'optimum, ${propositions} attendues`,
      );
      assert.ok(
        grainesAtteintes >= graines,
        `${grainesAtteintes} graines sur ${GRAINES} à l'optimum, ${graines} attendues`,
      );
    });
  }
});
