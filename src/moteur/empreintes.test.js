// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Empreintes de référence du moteur, série node (§ 5.7, § 14.10, § 15.5) : la
// petite démonstration et sa variante au conflit inévitable, sous les trois
// graines et le compte réduit de test/empreintes_moteur.js, et la petite sous
// chacune des seize combinaisons des quatre cases ; les deux encore sous le
// compte plus long de la section bascule, où l'ordre d'acceptation qui suit
// l'annulation de l'écart laisse sa trace dans le plan. Chaque plan rendu par
// rechercher se compare, empreinte et grandeurs nommées, au fichier versionné
// test/fixtures/moteur/empreintes_defaut.json : une empreinte qui change est
// un défaut, jamais une régénération. Le fichier ne se récrit que sous
// GTT_EMPREINTES=ecrire, par cette seule épreuve, qui recalcule alors toutes
// les sections — la grande et le classement compris — avant de les relire.
// La grande et sa variante sans exception se vérifient dans la série
// node-long (empreintes.long.test.js), le classement par evaluer dans
// src/application/empreintes.test.js.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import {
  ARRET,
  BASCULE,
  CASES,
  CLASSEMENT,
  GRAINES,
  GRANDEURS,
  combinaisons,
  differences,
  ecrireEmpreintes,
  empreinteDe,
  empreinteDuPlan,
  empreintesDesCombinaisons,
  empreintesDesPlans,
  lireEmpreintes,
  modeEmpreintes,
} from '../../test/empreintes_moteur.js';
import { CATALOGUE } from '../demo/catalogue.js';
import { indexerPlan, normaliser } from './configuration.js';
import { HISTORIQUE_PAR_DEFAUT, rechercher } from './recherche.js';

if (modeEmpreintes(process.env) === 'ecrire') ecrireEmpreintes();
const REFERENCE = lireEmpreintes();

// Les configurations de cette série, dans l'ordre du catalogue.
const PETITES = ['petite', 'petite-conflit'];

describe('empreintes de référence : la petite démonstration et sa variante (§ 14.10)', () => {
  for (const cle of PETITES) {
    test(`${cle} : les plans des graines ${GRAINES.join(', ')}, à ${ARRET} mouvements, sont ceux de la référence`, () => {
      const calcule = empreintesDesPlans(cle);
      assert.deepEqual(differences(cle, calcule, REFERENCE.plans[cle]), []);
      assert.deepEqual(calcule, REFERENCE.plans[cle], cle);
    });
  }

  test('petite : sous chacune des seize combinaisons des quatre cases, graine 1, le plan est celui de la référence', () => {
    const calcule = empreintesDesCombinaisons();
    assert.equal(Object.keys(REFERENCE.combinaisons).length, 16);
    assert.deepEqual(differences('petite', calcule, REFERENCE.combinaisons), []);
    assert.deepEqual(calcule, REFERENCE.combinaisons);
  });

  for (const cle of BASCULE.cles) {
    test(`${cle} : à ${BASCULE.arret} mouvements, où la meilleure affectation s’améliore après la bascule, les plans sont ceux de la référence`, () => {
      const calcule = empreintesDesPlans(cle, BASCULE.arret);
      assert.deepEqual(differences(`${cle} (bascule)`, calcule, REFERENCE.bascule[cle]), []);
      assert.deepEqual(calcule, REFERENCE.bascule[cle], cle);
    });
  }

  test('la référence a été relevée sous les réglages de test/empreintes_moteur.js', () => {
    assert.deepEqual(REFERENCE.reglages, {
      graines: [...GRAINES],
      arret: ARRET,
      historique: HISTORIQUE_PAR_DEFAUT,
      cases: [...CASES],
      classement: { ...CLASSEMENT, cles: [...CLASSEMENT.cles] },
      bascule: { ...BASCULE, cles: [...BASCULE.cles] },
    });
  });

  test('la référence couvre les quatre configurations du catalogue, chacune sous chaque graine', () => {
    assert.deepEqual(
      Object.keys(REFERENCE.plans),
      CATALOGUE.map(({ cle }) => cle),
    );
    for (const { cle } of CATALOGUE) {
      assert.deepEqual(Object.keys(REFERENCE.plans[cle]), GRAINES.map(String), cle);
    }
  });
});

describe('empreintes de référence : ce que porte une empreinte', () => {
  // Un plan de la petite variante et son instance, la configuration du
  // catalogue sous la graine 1.
  function unPlan() {
    const configuration = CATALOGUE.find(({ cle }) => cle === 'petite-conflit').construire();
    const [{ plan }] = rechercher(configuration, { graine: 1, arret: 2_000, nombre: 1 });
    return { instance: normaliser(configuration), plan };
  }

  test('les grandeurs nommées sont les six du § 14.10, dans cet ordre, et aucune composante du n-uplet', () => {
    assert.deepEqual(GRANDEURS, [
      'ecartAuPlafondAPrioriMax',
      'excedentCollisions',
      'collisionsCumulees',
      'rencontresRepeteesChoisies',
      'retoursChoisis',
      'redondance',
    ]);
    const { instance, plan } = unPlan();
    assert.deepEqual(Object.keys(empreinteDuPlan(instance, plan).grandeurs), GRANDEURS);
  });

  test('deux plans qui ne diffèrent que par la table d’une personne à un tour ont deux empreintes', () => {
    const { instance, plan } = unPlan();
    const avant = empreinteDuPlan(instance, plan);
    // La première personne des deux premières tables du tour 1 échange sa
    // place : les grandeurs peuvent rester égales, le plan ne l'est pas.
    const tours = plan.tours.map((tour) => tour.map((liste) => [...liste]));
    const [a] = tours[0][0];
    const [b] = tours[0][1];
    tours[0][0][0] = b;
    tours[0][1][0] = a;
    const apres = empreinteDuPlan(instance, { ...plan, tours });
    assert.notEqual(apres.empreinte, avant.empreinte);
    assert.notDeepEqual(indexerPlan(instance, { ...plan, tours }), indexerPlan(instance, plan));
  });

  test('l’empreinte lit chaque grandeur sous son nom : une grandeur changée change l’empreinte', () => {
    const { instance, plan } = unPlan();
    const { empreinte, grandeurs } = empreinteDuPlan(instance, plan);
    const tableDe = indexerPlan(instance, plan);
    for (const nom of GRANDEURS) {
      const autre = { ...grandeurs, [nom]: grandeurs[nom] + 1 };
      assert.notEqual(empreinteDe(tableDe, autre), empreinte, nom);
    }
    assert.equal(empreinteDe(tableDe, grandeurs), empreinte);
  });

  test('les seize combinaisons sont distinctes, chacune nommée par ses cases cochées', () => {
    const toutes = combinaisons();
    assert.equal(toutes.length, 16);
    assert.equal(new Set(toutes.map(({ cle }) => cle)).size, 16);
    assert.deepEqual(toutes[0], { cle: CASES.join('+'), contraintes: Object.fromEntries(CASES.map((c) => [c, true])) });
    assert.deepEqual(toutes.at(-1), { cle: 'aucune', contraintes: Object.fromEntries(CASES.map((c) => [c, false])) });
    for (const { cle, contraintes } of toutes) {
      assert.deepEqual(Object.keys(contraintes), CASES, cle);
      const cochees = CASES.filter((c) => contraintes[c]);
      assert.equal(cle, cochees.length === 0 ? 'aucune' : cochees.join('+'));
    }
  });

  test('differences nomme la configuration, la graine absente de la référence et la grandeur changée', () => {
    const attendu = { 1: { empreinte: 'a', grandeurs: { excedentCollisions: 2, redondance: 5 } } };
    assert.deepEqual(differences('petite', attendu, attendu), []);
    assert.deepEqual(
      differences('petite', { 4: attendu[1] }, attendu),
      ['petite, 4 : absente de la référence', 'petite, 1 : référence non recalculée'],
    );
    assert.deepEqual(
      differences('petite', { 1: { empreinte: 'b', grandeurs: { excedentCollisions: 3, redondance: 5 } } }, attendu),
      ['petite, 1 : excedentCollisions 2 → 3'],
    );
    assert.deepEqual(
      differences('petite', { 1: { empreinte: 'b', grandeurs: attendu[1].grandeurs } }, attendu),
      ['petite, 1 : plan changé, grandeurs égales'],
    );
  });
});

describe('GTT_EMPREINTES : verifier par défaut, ecrire sur demande', () => {
  test('absente ou vide : verifier ; verifier et ecrire se lisent tels quels ; une autre valeur lève en la nommant', () => {
    assert.equal(modeEmpreintes({}), 'verifier');
    assert.equal(modeEmpreintes({ GTT_EMPREINTES: '' }), 'verifier');
    assert.equal(modeEmpreintes({ GTT_EMPREINTES: 'verifier' }), 'verifier');
    assert.equal(modeEmpreintes({ GTT_EMPREINTES: 'ecrire' }), 'ecrire');
    assert.throws(() => modeEmpreintes({ GTT_EMPREINTES: 'ecrir' }), /GTT_EMPREINTES.*« ecrir »/);
  });
});
