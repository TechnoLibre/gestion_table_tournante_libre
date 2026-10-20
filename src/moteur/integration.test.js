// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuve d'intégration du moteur, de la configuration au classement, sur la
// petite démonstration et sa variante conflit (§ 5.5, § 5.6, § 5.7,
// § 15.3). Chaque proposition de rechercher traverse la chaîne entière :
// verifierInvariants juge son plan ; mesurer et plafondsRealises le
// mesurent ; verifierIndicateurs éprouve la ligne de chacun contre le
// plafond a priori ; classer ordonne les propositions, et minimumAtteint lit
// le certificat de la première ; diagnostiquer fournit les planchers que la
// meilleure respecte. Chaque quantité vient de son module (§ 13.2) :
// l'épreuve n'en recalcule aucune.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { CATALOGUE, PLAN_PARFAIT_PETITE } from '../demo/catalogue.js';
import { CRITERES, classer } from './classement.js';
import { indexerPlan, normaliser } from './configuration.js';
import { diagnostiquer } from './diagnostic.js';
import { mesurer } from './indicateurs.js';
import { minimumAtteint } from './manque.js';
import { plafondsAPriori, plafondsRealises } from './plafond.js';
import { rechercher } from './recherche.js';
import { verifierIndicateurs, verifierInvariants } from './verification.js';

// Réglages de la génération : une graine fixée, écrite ici (§ 15.5, point 2).
// À 100 000 mouvements, avec cette graine, les trois propositions de chaque
// démonstration rencontrent 8 pour les douze, sans rencontre répétée, et ne
// portent que les collisions que le diagnostic impose : aucune dans la
// petite démonstration, 4 dans sa variante. Une proposition de la variante
// garde 15 retours choisis, les cinq autres aucun. Les assertions des
// épreuves tiennent avec cette graine dès 80 000 mouvements, soit une marge
// de 1,25 ; en deçà, les trois propositions de la petite démonstration
// gardent des retours choisis. La marge est celle de cette graine : sur les
// graines 1 à 64, les assertions tiennent pour 43 à 100 000, pour toutes à
// 200 000.
//
// Le compte pèse sur la relance sous surveillance (§ 14.14) : toute
// modification du moteur, ou du générateur que lit le catalogue, rejoue ce
// fichier.
const REGLAGES = Object.freeze({ graine: 314_159, arret: 100_000, nombre: 3 });

// La même génération, arrêtée au premier mouvement. Aucune de ses
// propositions n'atteint son plafond a priori : avec cette graine, leurs
// écarts au plafond a priori maximaux valent 2, 3 et 3, et sur les graines
// 1 à 64, aucune proposition brève ne l'atteint non plus.
const REGLAGES_BREVES = Object.freeze({ ...REGLAGES, arret: 1 });

// Configuration neuve d'une démonstration du catalogue.
const demo = (cle) => CATALOGUE.find((entree) => entree.cle === cle).construire();

// Génère les propositions d'une configuration et les fait traverser la
// chaîne. Chaque plan est jugé par verifierInvariants avant d'être indexé :
// indexerPlan n'examine ni capacités ni réservations et lève à la première
// faute de forme, là où le vérificateur les nomme toutes. Vient ensuite la
// ligne N − 1 ≥ a priori ≥ réalisé ≥ rencontres de chacun. decalage
// s'ajoute aux identifiants que rend rechercher, comme l'appelant qui
// accumule des générations donne à chaque proposition un identifiant unique
// (§ 5.7). Rend le plafond a priori de chacun, et les propositions dans
// l'ordre de leurs identifiants, avec leurs mesures.
function generer(configuration, etiquette, reglages, decalage = 0) {
  const instance = normaliser(configuration);
  const aPriori = plafondsAPriori(instance);
  const propositions = rechercher(configuration, reglages).map(({ id, plan }) => {
    const nom = `${etiquette}, proposition ${id + decalage}`;
    assert.deepEqual(verifierInvariants(instance, plan), [], nom);
    const tableDe = indexerPlan(instance, plan);
    const mesures = mesurer(instance, tableDe);
    const realises = plafondsRealises(instance, tableDe);
    assert.deepEqual(verifierIndicateurs(mesures, aPriori, realises), [], nom);
    return { id: id + decalage, mesures };
  });
  // Un parcours vide ne prouverait rien (§ 14.2).
  assert.equal(propositions.length, reglages.nombre, etiquette);
  return { aPriori, propositions };
}

// Le classement de propositions mesurées sur une même configuration, et
// celle qu'il met en tête.
function classerPropositions({ aPriori, propositions }) {
  const classement = classer(
    propositions.map(({ id, mesures }) => ({ id, mesures, plafondsAPriori: aPriori })),
  );
  const premiere = propositions.find(({ id }) => id === classement.ordre[0]);
  return { classement, premiere };
}

// La génération de la variante conflit aux réglages de l'épreuve, calculée
// au premier appel puis partagée par les deux épreuves qui la lisent : la
// recherche en est le coût.
let variante = null;
function genererVariante() {
  variante ??= generer(demo('petite-conflit'), 'petite-conflit', REGLAGES);
  return variante;
}

// Le plan écrit du § 15.3 fait visiter les quatre tables à chacun : aucun
// retour choisi. Le classement ne lit pas les retours (§ 5.7) : entre
// propositions égales sur ses cinq critères, l'identifiant désigne la
// première, qu'elle garde des retours ou non. L'épreuve exige donc le zéro
// d'une proposition au moins, la preuve que la recherche tient compte de
// nouvelleTable.
function exigerUneSansRetourChoisi(etiquette, propositions) {
  const retours = propositions.map(({ mesures }) => mesures.totalRetoursChoisis);
  assert.ok(retours.includes(0), `${etiquette} : retours choisis par proposition ${retours.join(', ')}`);
}

describe('intégration : de la configuration au classement (§ 5.5, § 5.7, § 15.3)', () => {
  test('petite : chaque proposition tient invariants et indicateurs et ne porte aucune collision, une au moins aucun retour choisi ; la première du classement porte « minimum atteint »', () => {
    const generation = generer(demo('petite'), 'petite', REGLAGES);
    const { classement, premiere } = classerPropositions(generation);
    // Le plafond a priori est connu : aucun critère n'est sauté, et le
    // certificat se lit contre lui (§ 5.5). Les critères appliqués, palier
    // après palier, aplatis en noms, sont ceux de l'ordre fixe de référence.
    const appliques = classement.criteresAppliques.flatMap(({ criteres }) => criteres.map(({ nom }) => nom));
    assert.deepEqual(appliques, [...CRITERES]);
    assert.equal(classement.critereSaute, null);
    assert.equal(minimumAtteint(premiere.mesures, generation.aPriori), true);
    // Le certificat ne lit que les rencontres : il se décerne aussi à un plan
    // qui réunit des collègues. Chaque organisation de quatre membres peut
    // se répartir sur les quatre tables à chaque tour, comme dans le plan
    // écrit du § 15.3 : aucune proposition ne réunit de collègues, et le
    // compteur de collisions se mesure à zéro (§ 15.3).
    for (const { id, mesures } of generation.propositions) {
      assert.equal(mesures.collisionsCumulees, 0, `proposition ${id}`);
    }
    exigerUneSansRetourChoisi('petite', generation.propositions);
  });

  test('petite-conflit : chaque proposition porte les 4 collisions du plancher du diagnostic, une au moins aucun retour choisi ; la meilleure respecte les planchers, rencontre 8 pour les douze, sur 4 paires, excédent 0', () => {
    const configuration = demo('petite-conflit');
    // Le groupe de cinq ne se répartit pas sur quatre tables : au moins une
    // collision par tour, 4 cumulées sur les 4 tours, portées par une paire
    // distincte au moins (§ 15.3). Le diagnostic les chiffre ; une liste vide
    // laisserait la boucle ci-dessous sans rien éprouver.
    const { collisions } = diagnostiquer(configuration);
    assert.deepEqual(
      collisions.map(({ plancherCumulees, plancherPairesDistinctes }) => [
        plancherCumulees,
        plancherPairesDistinctes,
      ]),
      [[4, 1]],
    );
    const generation = genererVariante();
    const { premiere } = classerPropositions(generation);
    // Tout plan valide respecte ces planchers : ils éprouvent l'accord du
    // diagnostic et de la mesure, non la recherche.
    for (const plancher of collisions) {
      const mesure = premiere.mesures.parGroupe.find(({ groupe }) => groupe === plancher.groupe);
      assert.ok(
        mesure.collisionsCumulees >= plancher.plancherCumulees,
        `${plancher.groupe} : ${mesure.collisionsCumulees} collisions cumulées, plancher ${plancher.plancherCumulees}`,
      );
      assert.ok(
        mesure.pairesDistinctes >= plancher.plancherPairesDistinctes,
        `${plancher.groupe} : ${mesure.pairesDistinctes} paires distinctes, plancher ${plancher.plancherPairesDistinctes}`,
      );
    }
    assert.deepEqual(premiere.mesures.rencontres, Array(12).fill(8));
    // La recherche se juge à ses collisions : chaque proposition atteint le
    // plancher des collisions cumulées sans le dépasser. La meilleure les
    // porte sur 4 paires distinctes, comme le plan écrit du § 15.3 (épreuve
    // suivante).
    for (const { id, mesures } of generation.propositions) {
      assert.equal(mesures.collisionsCumulees, collisions[0].plancherCumulees, `proposition ${id}`);
    }
    assert.equal(premiere.mesures.pairesDistinctes, 4);
    // Deux voisins par tour, quatre tours : qui rencontre 8 personnes n'en
    // revoit aucune. Chaque paire se réunit donc une fois au plus, et
    // l'excédent 0 découle de 8 pour les douze. Il éprouve mesurer, non la
    // recherche.
    assert.equal(premiere.mesures.excedentCollisions, 0);
    exigerUneSansRetourChoisi('petite-conflit', generation.propositions);
  });

  test('le plan écrit du § 15.3, mesuré sur la variante conflit : 8 pour les douze, 4 collisions sur 4 paires, excédent 0', () => {
    // Le témoin de l'épreuve précédente : la personne passée de C à A
    // retrouve un membre de A à chacun des quatre tours, chaque fois un
    // autre. Ce que l'épreuve exige de la recherche est donc atteignable.
    const instance = normaliser(demo('petite-conflit'));
    const mesures = mesurer(instance, indexerPlan(instance, PLAN_PARFAIT_PETITE));
    assert.deepEqual(mesures.rencontres, Array(12).fill(8));
    assert.equal(mesures.collisionsCumulees, 4);
    assert.equal(mesures.pairesDistinctes, 4);
    assert.equal(mesures.excedentCollisions, 0);
  });

  test('petite-conflit, deux générations accumulées : classer met la plus longue en tête, numérotée après la brève, et départage ses propositions égales par identifiant croissant (§ 5.7, § 15.5)', () => {
    // La génération brève prend les identifiants 1 à 3, la longue 4 à 6 :
    // l'ordre attendu contredit l'ordre des identifiants, et seul un
    // classement qui applique ses critères peut le rendre.
    const breve = generer(demo('petite-conflit'), 'petite-conflit, génération brève', REGLAGES_BREVES);
    const variante = genererVariante();
    const longue = {
      aPriori: variante.aPriori,
      propositions: variante.propositions.map(({ id, mesures }) => ({ id: id + REGLAGES.nombre, mesures })),
    };
    // Ce que l'ordre départage, mesuré avant d'être lu. Chaque proposition
    // longue atteint son plafond a priori, et les trois sont égales sur les
    // quatre autres critères du classement ; aucune brève n'atteint le sien.
    // Sur une même population, la redondance moyenne ordonne comme la somme
    // que lit le classement.
    const autresCriteres = ({ mesures }) => [
      mesures.excedentCollisions,
      mesures.collisionsCumulees,
      mesures.rencontresRepetees.choisies,
      mesures.aggRedondance.tous.moyenne,
    ];
    for (const proposition of longue.propositions) {
      const nom = `proposition ${proposition.id}`;
      assert.equal(minimumAtteint(proposition.mesures, longue.aPriori), true, nom);
      assert.deepEqual(autresCriteres(proposition), autresCriteres(longue.propositions[0]), nom);
    }
    for (const { id, mesures } of breve.propositions) {
      assert.equal(minimumAtteint(mesures, breve.aPriori), false, `proposition ${id}`);
    }
    // Le premier critère renvoie les brèves derrière les longues ; les
    // longues, égales sur les cinq, se départagent par identifiant croissant
    // (§ 15.5, point 4).
    const { classement } = classerPropositions({
      aPriori: longue.aPriori,
      propositions: [...breve.propositions, ...longue.propositions],
    });
    assert.deepEqual(classement.ordre.slice(0, REGLAGES.nombre), [4, 5, 6]);
    assert.deepEqual([...classement.ordre.slice(REGLAGES.nombre)].sort((a, b) => a - b), [1, 2, 3]);
  });
});
