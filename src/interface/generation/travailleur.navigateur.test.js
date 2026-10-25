// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le travailleur de la génération, au service de la vue d'ensemble, dans un
// vrai moteur de rendu (§ 8.1) : le point d'entrée travailleur.js, inclus en
// ligne par « ?worker&inline » comme src/main.js l'inclut, sous l'exécuteur
// d'aperçu de production (executeur_apercu.js). La charge traverse le vrai
// clonage structuré du navigateur dans les deux sens ; la valeur attendue
// est celle de resumeDuRetenu et resumeDuMeilleur, sollicités sur le fil
// pour la même charge. Un point d'entrée qui ne branche pas sa portée
// laisse le calcul sans issue : l'épreuve échoue à son délai.
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import { describe, expect, test } from 'vitest';
import { appliquerCommande } from '../../application/commandes.js';
import { resumeDuMeilleur, resumeDuRetenu } from '../../application/evaluation.js';
import { creerExecuteurApercu } from '../../application/executeur_apercu.js';
import { texteLivre } from '../../demo/livrees.js';
import { rechercher } from '../../moteur/recherche.js';
import { analyser, configurationDepuisCharge } from '../../stockage/document.js';
import { VERSION } from '../../version.genere.js';
import Travailleur from './travailleur.js?worker&inline';

// Le délai de chaque épreuve : un travailleur qui ne répond pas la fait
// échouer bien avant celui du projet.
const DELAI = 30_000;

// La petite démonstration au conflit inévitable, trois propositions du
// moteur cherchées depuis graine, et la deuxième retenue : une charge dont
// les deux résumés ne sont pas nuls.
function chargeResumee(graine) {
  let charge = analyser(texteLivre('petite-conflit')).charge;
  const configuration = configurationDepuisCharge(charge);
  const propositions = rechercher(configuration, { graine, nombre: 3, arret: 300 });
  charge = appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: VERSION.affichee }).charge;
  return appliquerCommande('retenirProposition', charge, { id: charge.propositions[1].id }).charge;
}

// Les deux résumés d'une charge, calculés sur le fil.
const surLeFil = (charge) => ({ mesuresDuRetenu: resumeDuRetenu(charge), meilleureDuClassement: resumeDuMeilleur(charge) });

describe('le travailleur de la génération, au service de la vue d’ensemble, inclus en ligne (§ 8.1)', () => {
  test(
    'deux charges confiées ensemble au vrai travailleur rendent chacune les deux résumés du calcul sur le fil, par un seul travailleur',
    async () => {
      let crees = 0;
      const executeur = creerExecuteurApercu(() => {
        crees += 1;
        return new Travailleur();
      });
      try {
        const charges = [chargeResumee(6), chargeResumee(9)];
        const attendus = charges.map(surLeFil);
        for (const attendu of attendus) {
          expect(attendu.mesuresDuRetenu).not.toBeNull();
          expect(attendu.meilleureDuClassement).not.toBeNull();
        }
        expect(attendus[0]).not.toEqual(attendus[1]);
        expect(await Promise.all(charges.map((charge) => executeur.calculer(charge)))).toEqual(attendus);
        expect(crees).toBe(1);
      } finally {
        executeur.terminer();
      }
    },
    DELAI,
  );

  test(
    'une charge que les résumés refusent rejette ce seul calcul par la faute du travailleur ; le même travailleur sert le calcul suivant',
    async () => {
      let crees = 0;
      const executeur = creerExecuteurApercu(() => {
        crees += 1;
        return new Travailleur();
      });
      try {
        const faute = await executeur.calculer(null).then(
          () => null,
          (erreur) => erreur,
        );
        expect(faute).toBeInstanceOf(Error);
        expect(faute.message).toMatch(/^travailleur de la vue d'ensemble : /);
        const charge = chargeResumee(6);
        expect(await executeur.calculer(charge)).toEqual(surLeFil(charge));
        expect(crees).toBe(1);
      } finally {
        executeur.terminer();
      }
    },
    DELAI,
  );
});
