// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuve d'intégration lourde du moteur, sur la grande démonstration
// (§ 5.5, § 12.10.4, § 15.1). Trois propositions traversent la chaîne
// d'integration.test.js, de rechercher au certificat. La configuration est
// exactement tendue et impose ses planchers, que le diagnostic chiffre avant
// la recherche : 99 retours imposés par les 33 ancrages ; un écart
// d'itinéraire maximal d'au moins 1, porté par au moins 24 mobiles ; un
// certificat « minimum atteint » hors d'atteinte. Les seuils de qualité sont
// posés après mesure, la mesure en commentaire (§ 14.1).
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { CATALOGUE } from '../demo/catalogue.js';
import { indexerPlan, normaliser } from './configuration.js';
import { diagnostiquer } from './diagnostic.js';
import { mesurer } from './indicateurs.js';
import {
  ecartsAuPlafondAPriori,
  ecartsItineraire,
  minimumAtteint,
  troisChiffres,
} from './manque.js';
import { plafondsAPriori, plafondsRealises } from './plafond.js';
import { rechercher } from './recherche.js';
import { verifierIndicateurs, verifierInvariants } from './verification.js';

// Statut d'un ancré dans instance.statut (§ 4.2) ; les autres sont mobiles.
const ANCRE = 2;

// Compte d'arrêt choisi par la mesure. À 1 000 000 mouvements, chacune des
// trois propositions atteint, sur chaque seuil ci-dessous, la meilleure
// valeur que la configuration permette, sans rencontre répétée ni retour
// choisi. Avec cette graine, chaque seuil tient à partir de son propre
// compte :
// - rencontres minimales 24, sur tous comme sur les ancrés : déjà à
//   100 000 ;
// - écart au plafond a priori maximal 1, et rencontres minimales 27 des
//   mobiles : dès 250 000 ; à 200 000, ils valent 2 et 26 ;
// - manque maximal 0, aucun retour choisi : dès 350 000 ; à 300 000, une
//   proposition garde un manque de 1 et un retour choisi ;
// - aucune collision : dès 450 000 ; à 400 000, les trois propositions en
//   portent 8, 1 et 2.
// 1 000 000 vaut ainsi 4 fois le compte où tiennent l'écart au plafond a
// priori et les mobiles, 2,9 fois celui du manque et des retours choisis,
// 2,2 fois celui des collisions. Sur les graines 1 à 8, les vingt-quatre
// propositions tiennent l'écart au plafond a priori et les mobiles dès
// 250 000, le manque et les retours choisis dès 350 000, les collisions dès
// 500 000 ; à 450 000, deux en portent encore 1 et 5.
const REGLAGES = Object.freeze({ graine: 314_159, arret: 1_000_000, nombre: 3 });

// Seuils de qualité, posés après mesure ; chacun est la meilleure valeur
// que la configuration permette.
//
// Rencontres minimales : 24 mesuré à chacune des trois propositions. C'est
// le plafond a priori des quatre animateurs des tables de 7, qu'aucune
// proposition ne dépasse (§ 15.1) : le minimum global ne peut pas le
// dépasser, et l'épreuve exige qu'il l'atteigne. Les deux lignes
// secondaires du § 5.4 se lisent à part : 24 chez les ancrés, que ces
// quatre animateurs gouvernent ; 27 chez les mobiles. Un mobile assis une
// fois à une table de 7 rencontre 27 personnes au plus, une de moins que
// son plafond a priori de 28, et au moins 24 mobiles y passent (§ 15.1) ;
// l'écart au plafond a priori maximal de 1 interdit à chacun d'en
// rencontrer moins. Un agrégat « tous » qui écarterait les ancrés vaudrait
// 27 (§ 5.4).
const RENCONTRES_MIN = 24;
const RENCONTRES_MIN_ANCRES = 24;
const RENCONTRES_MIN_MOBILES = 27;
// Écart au plafond a priori maximal : 1 mesuré à chacune des trois
// propositions. Il ne descend pas sous l'écart d'itinéraire maximal, dont le
// plancher vaut 1 (§ 12.10.4) : ce seuil aussi est la meilleure valeur
// possible.
const ECART_AU_PLAFOND_A_PRIORI_MAX = 1;
// Collisions cumulées : 0 mesuré à chacune des trois propositions, la
// meilleure valeur possible ; le diagnostic n'impose à cette configuration
// aucun plancher de collisions. Une recherche qui ne sépare pas les
// appartenances en laisse de 14 à 20 à chaque proposition.
const COLLISIONS_CUMULEES_MAX = 0;

// Plus grand élément d'une liste non vide.
const plusGrand = (valeurs) => valeurs.reduce((plus, valeur) => Math.max(plus, valeur));

// La génération et ses mesures, calculées au premier appel puis partagées
// par les épreuves du fichier : la recherche en est le coût. Chaque
// proposition porte la liste de ses violations ; ses mesures, ses plafonds
// réalisés, ses trois chiffres et ses écarts d'itinéraire ne sont calculés
// que pour un plan sans violation. indexerPlan n'examine ni capacités ni
// réservations et lève à la première faute de forme, là où le vérificateur
// les nomme toutes.
let generation = null;
function genererGrande() {
  if (generation !== null) return generation;
  const configuration = CATALOGUE.find(({ cle }) => cle === 'grande').construire();
  const instance = normaliser(configuration);
  const aPriori = plafondsAPriori(instance);
  const propositions = rechercher(configuration, REGLAGES).map(({ id, plan }) => {
    const violations = verifierInvariants(instance, plan);
    if (violations.length > 0) return { id, violations };
    const tableDe = indexerPlan(instance, plan);
    const mesures = mesurer(instance, tableDe);
    const realises = plafondsRealises(instance, tableDe);
    return {
      id,
      violations,
      mesures,
      realises,
      chiffres: troisChiffres(instance, mesures, aPriori, realises),
      ecartsItineraire: ecartsItineraire(aPriori, realises),
    };
  });
  generation = { instance, aPriori, diagnostic: diagnostiquer(configuration), propositions };
  return generation;
}

// Les propositions de la génération, chacune jugée par verifierInvariants
// avant toute lecture de ses mesures. Un parcours vide ne prouverait rien
// (§ 14.2).
function propositionsValides() {
  const { propositions } = genererGrande();
  assert.equal(propositions.length, REGLAGES.nombre);
  for (const { id, violations } of propositions) {
    assert.deepEqual(violations, [], `proposition ${id}`);
  }
  return propositions;
}

describe('intégration : la grande démonstration de bout en bout (§ 5.5, § 12.10.4, § 15.1)', () => {
  test('chaque proposition tient invariants et indicateurs, porte les 99 retours imposés du diagnostic et aucun retour choisi', () => {
    const { aPriori, diagnostic } = genererGrande();
    // 33 ancrages de 4 tours, 3 retours chacun : attribués aux réservations,
    // les mêmes pour toute proposition (§ 5.4).
    assert.equal(diagnostic.retoursImposes, 99);
    for (const { id, mesures, realises } of propositionsValides()) {
      assert.deepEqual(verifierIndicateurs(mesures, aPriori, realises), [], `proposition ${id}`);
      assert.equal(mesures.totalRetoursImposes, diagnostic.retoursImposes, `proposition ${id}`);
      // Retours choisis : 0 mesuré à chacune des trois propositions, la
      // meilleure valeur possible ; avec cette graine, dès 350 000
      // mouvements (REGLAGES). Les deux comptes restent séparés, chacun à sa
      // valeur : leur somme afficherait 99 retours choisis à chaque
      // proposition, une constante où la différence entre propositions ne se
      // lit plus (§ 5.4, § 14.10).
      assert.equal(mesures.totalRetoursChoisis, 0, `proposition ${id}`);
    }
  });

  test("le plancher du diagnostic tient : écart d'itinéraire maximal ≥ 1, au moins 24 mobiles sous leur plafond a priori", () => {
    const { instance, diagnostic } = genererGrande();
    // Les tables de 7 offrent 96 sièges-tours mobiles, qu'un mobile n'occupe
    // que 4 fois au plus : au moins 24 mobiles y passent, et chacun y perd au
    // moins 1 sur son plafond a priori de 28 avant toute rencontre, son écart
    // d'itinéraire (§ 12.10.4). Sans ce plancher écrit, les comparaisons
    // ci-dessous n'éprouveraient rien.
    assert.deepEqual(diagnostic.ecartItineraire, { plancher: 1, mobilesAuMoins: 24 });
    const { plancher, mobilesAuMoins } = diagnostic.ecartItineraire;
    for (const { id, chiffres, ecartsItineraire: ecarts } of propositionsValides()) {
      assert.ok(
        chiffres.ecartItineraireMax.tous >= plancher,
        `proposition ${id} : écart d'itinéraire maximal ${chiffres.ecartItineraireMax.tous}, plancher ${plancher}`,
      );
      let mobilesSous = 0;
      for (let p = 0; p < instance.N; p += 1) {
        if (instance.statut[p] !== ANCRE && ecarts[p] >= plancher) mobilesSous += 1;
      }
      assert.ok(
        mobilesSous >= mobilesAuMoins,
        `proposition ${id} : ${mobilesSous} mobiles sous leur plafond a priori, au moins ${mobilesAuMoins} attendus`,
      );
    }
  });

  test('jamais « minimum atteint » (§ 15.1), même quand chacun atteint son plafond réalisé', () => {
    const { aPriori } = genererGrande();
    for (const { id, mesures, chiffres } of propositionsValides()) {
      // Manque maximal, seuil posé après mesure : 0 à chacune des trois
      // propositions, sur les 260 personnes. Chacun rencontre tout ce que son
      // itinéraire permet ; un certificat lu sur le seul manque serait
      // décerné, et il ne l'est pas : il se lit contre le plafond a priori
      // (§ 5.5).
      assert.equal(chiffres.manqueMax.tous, 0, `proposition ${id}`);
      assert.equal(minimumAtteint(mesures, aPriori), false, `proposition ${id}`);
    }
  });

  test('seuils de qualité posés après mesure : rencontres minimales et leurs lignes secondaires, écart au plafond a priori maximal, collisions cumulées', () => {
    const { aPriori } = genererGrande();
    for (const { id, mesures } of propositionsValides()) {
      const { tous, ancres, mobiles } = mesures.aggRencontres;
      assert.equal(tous.min, RENCONTRES_MIN, `proposition ${id} : rencontres minimales`);
      assert.equal(ancres.min, RENCONTRES_MIN_ANCRES, `proposition ${id} : rencontres minimales des ancrés`);
      assert.equal(mobiles.min, RENCONTRES_MIN_MOBILES, `proposition ${id} : rencontres minimales des mobiles`);
      const ecartMax = plusGrand(ecartsAuPlafondAPriori(mesures, aPriori));
      assert.ok(
        ecartMax <= ECART_AU_PLAFOND_A_PRIORI_MAX,
        `proposition ${id} : écart au plafond a priori maximal ${ecartMax}, seuil ${ECART_AU_PLAFOND_A_PRIORI_MAX}`,
      );
      assert.ok(
        mesures.collisionsCumulees <= COLLISIONS_CUMULEES_MAX,
        `proposition ${id} : ${mesures.collisionsCumulees} collisions cumulées, seuil ${COLLISIONS_CUMULEES_MAX}`,
      );
    }
  });
});
