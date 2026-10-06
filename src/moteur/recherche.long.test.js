// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves lourdes de la recherche (§ 5.10, § 14.10, § 15.3). Sur chacune
// des quatre démonstrations, une suite déterministe de mouvements, acceptés
// ou défaits, confronte l'état tenu à jour au recalcul complet à 1, 10, 100,
// 1 000 et 10 000 mouvements appliqués, et non au seul terme : une dérive qui
// se compense passe inaperçue à la fin, et le palier où un désaccord affleure
// est le chiffre que l'épreuve rend. Le relevé liste chaque désaccord, palier
// et grandeur, au lieu de s'arrêter au premier. La petite démonstration et sa
// variante conflit atteignent ensuite leur optimum sur vingt graines, trois
// propositions chacune ; une recherche longue sur la grande démonstration
// rend des plans que jugent verifierInvariants et verifierIndicateurs.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { CATALOGUE } from '../demo/catalogue.js';
import { FLUX, creerPcg32 } from '../demo/prng.js';
import { indexerPlan, normaliser } from './configuration.js';
import { mesurer } from './indicateurs.js';
import { plafondsAPriori, plafondsRealises } from './plafond.js';
import {
  creerEtat,
  defaire,
  proposerEtAppliquer,
  rechercher,
  scoreComplet,
  scoreIncremental,
} from './recherche.js';
import { verifierIndicateurs, verifierInvariants } from './verification.js';

const PALIERS = [1, 10, 100, 1_000, 10_000];
// Graine des suites de mouvements, écrite ici.
const GRAINE = 271_828;
// Un mouvement appliqué sur trois est défait : la suite passe par les deux
// chemins, l'acceptation et le retour en arrière.
const DEFAIT_TOUS_LES = 3;
// Propositions de mouvement au-delà desquelles une suite renonce : une
// instance où aucun mouvement ne s'applique n'atteindrait jamais le dernier
// palier.
const ESSAIS_MAX = 100 * PALIERS.at(-1);

// Vrai quand deux listes de nombres ont la même longueur et les mêmes
// valeurs, rang par rang, chacune un nombre fini : deux champs absents, deux
// undefined, ne s'accordent pas.
const egales = (a, b) =>
  a.length === b.length && a.every((valeur, i) => Number.isFinite(valeur) && valeur === b[i]);

// Ajoute à releve un libellé « palier : grandeur » pour chaque grandeur où
// l'état tenu à jour diffère du recalcul complet.
function relever(etat, instance, palier, releve) {
  const mesures = mesurer(instance, etat.tableDe);
  const confronter = (grandeur, tenue, recalculee) => {
    if (!egales(tenue, recalculee)) releve.push(`${palier} : ${grandeur}`);
  };
  confronter('score', scoreIncremental(etat), scoreComplet(etat));
  confronter('rencontres', Array.from(etat.rencontres), mesures.rencontres);
  confronter('affilies', Array.from(etat.affilies), mesures.affilies);
  confronter('appartenancesVues', Array.from(etat.appartenancesVues), mesures.appartenancesVues);
  confronter('collisionsCumulees', [etat.collisionsCumulees], [mesures.collisionsCumulees]);
  confronter('excedentCollisions', [etat.excedentCollisions], [mesures.excedentCollisions]);
  confronter('totalRetoursChoisis', [etat.totalRetoursChoisis], [mesures.totalRetoursChoisis]);
  confronter('totalRedondance', [etat.totalRedondance], [mesures.totalRedondance]);
}

describe('recherche : incrémental contre recalcul complet (§ 5.10, § 14.10)', () => {
  test('le catalogue fournit les quatre démonstrations éprouvées ci-dessous', () => {
    assert.equal(CATALOGUE.length, 4);
  });

  for (const { cle, construire } of CATALOGUE) {
    test(`${cle} : accord à 1, 10, 100, 1 000 et 10 000 mouvements`, () => {
      const instance = normaliser(construire());
      const rng = creerPcg32(GRAINE, FLUX.RECHERCHE);
      const etat = creerEtat(instance, rng);
      const releve = [];
      relever(etat, instance, 0, releve);
      let appliques = 0;
      let defaits = 0;
      let palier = 0;
      for (let essai = 0; palier < PALIERS.length && essai < ESSAIS_MAX; essai += 1) {
        const mouvement = proposerEtAppliquer(etat, rng);
        if (mouvement === null) continue;
        appliques += 1;
        if (appliques % DEFAIT_TOUS_LES === 0) {
          defaire(etat, mouvement);
          defaits += 1;
        }
        if (appliques === PALIERS[palier]) {
          relever(etat, instance, appliques, releve);
          palier += 1;
        }
      }
      assert.equal(appliques, PALIERS.at(-1), `${cle} : mouvements appliqués`);
      assert.equal(defaits, Math.floor(PALIERS.at(-1) / DEFAIT_TOUS_LES));
      assert.deepEqual(releve, [], cle);
    });
  }
});

// Graines 0 à GRAINES − 1, trois propositions chacune : l'optimum se juge sur
// une suite de graines, et non sur une seule, qu'un réglage de l'algorithme
// pourrait servir par hasard.
const GRAINES = 20;

describe('recherche : la petite démonstration et sa variante, sur vingt graines (§ 15.3)', () => {
  // Plancher de collisions cumulées : aucune dans la petite démonstration ;
  // une par tour dans la variante, dont le groupe de cinq ne se répartit pas
  // sur quatre tables, chacune d'une paire différente au mieux.
  for (const [cle, plancher] of [['petite', 0], ['petite-conflit', 4]]) {
    test(`${cle} : chaque proposition rencontre 8 pour les douze, sans répétition, ${plancher} collisions sur ${plancher} paires`, () => {
      const configuration = CATALOGUE.find((entree) => entree.cle === cle).construire();
      const instance = normaliser(configuration);
      const manquees = [];
      let examinees = 0;
      for (let graine = 0; graine < GRAINES; graine += 1) {
        for (const { id, plan } of rechercher(configuration, { graine, arret: 200_000, nombre: 3 })) {
          examinees += 1;
          const m = mesurer(instance, indexerPlan(instance, plan));
          const optimale = m.rencontres.every((rencontres) => rencontres === 8)
            && m.maxRencontresPaire === 1
            && m.collisionsCumulees === plancher
            && m.pairesDistinctes === plancher;
          if (!optimale) {
            manquees.push(
              `graine ${graine}, proposition ${id} : minimum ${m.aggRencontres.tous.min}, `
                + `collisions ${m.collisionsCumulees} sur ${m.pairesDistinctes} paires, `
                + `paire la plus revue ${m.maxRencontresPaire} fois`,
            );
          }
        }
      }
      assert.equal(examinees, 3 * GRAINES);
      assert.deepEqual(manquees, []);
    });
  }
});

describe('recherche : recherche longue sur la grande démonstration (§ 14.12)', () => {
  test('arret 200 000 : plans valides, et rencontres ≤ plafond réalisé ≤ plafond a priori ≤ N − 1', () => {
    const configuration = CATALOGUE.find((entree) => entree.cle === 'grande').construire();
    const instance = normaliser(configuration);
    const aPriori = plafondsAPriori(instance);
    const propositions = rechercher(configuration, { graine: 31, arret: 200_000, nombre: 2 });
    assert.equal(propositions.length, 2);
    for (const { id, plan } of propositions) {
      assert.deepEqual(verifierInvariants(instance, plan), [], `proposition ${id}`);
      const tableDe = indexerPlan(instance, plan);
      const mesures = mesurer(instance, tableDe);
      assert.deepEqual(
        verifierIndicateurs(mesures, aPriori, plafondsRealises(instance, tableDe)),
        [],
        `proposition ${id}`,
      );
    }
  });
});
