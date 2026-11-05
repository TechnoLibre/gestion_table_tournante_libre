// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// L'évaluation que partagent Génération et Propositions, dans un vrai
// moteur de rendu (§ 5.7, § 13.3) : tant que la charge de la séance ne
// change pas, revenir à l'une ou l'autre section ne mesure rien de nouveau ;
// une charge écrite se mesure une fois, et la meilleure proposition annoncée
// la suit. Une charge sans proposition n'a pas de table partagée : l'éditeur
// des priorités y lit l'état des critères par une évaluation à lui, une fois
// par charge écrite.
//
// Le module de l'évaluation est remplacé par ses propres fonctions,
// espionnées (vi.mock, spy) : evaluer garde son effet, et ses appels se
// comptent. Chaque épreuve monte App par monterApp, sur le système de
// fichiers simulé, avec l'exécuteur direct ; le rendu se lit par les
// attributs data-… ; les noms d'épreuve sont inventés.
//
// Le projet navigateur emploie expect, vi, et test et describe de Vitest
// (§ 14.8).
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushSync } from 'svelte';
import { evaluer, premiereDuClassement } from '../../application/evaluation.js';
import { creerFormat } from '../../application/format.js';
import { creerExecuteurDirect } from '../../application/generation.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { rechercher } from '../../moteur/recherche.js';
import { configurationDepuisCharge } from '../../stockage/document.js';
import { VERSION } from '../../version.genere.js';
import { fixerCadre } from '../../../test/navigateur/entrees.js';
import { monterApp } from '../../../test/navigateur/montage.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { meilleureProposition } from './meilleure.js';

vi.mock('../../application/evaluation.js', { spy: true });

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const format = creerFormat(t);

// Les montages de l'épreuve, démontés après elle ; le collecteur d'erreurs
// n'a rien reçu pendant l'épreuve.
let montes = [];
async function monter(options) {
  const m = await monterApp(options);
  montes.push(m);
  return m;
}
beforeEach(async () => {
  await fixerCadre(1366, 700);
});
afterEach(() => {
  const erreurs = montes.flatMap((m) => m.erreurs());
  for (const m of montes.reverse()) m.demonter();
  montes = [];
  window.scrollTo(0, 0);
  expect(erreurs, 'erreurs reçues par le collecteur').toEqual([]);
});

const dans = (m, selecteur) => m.racine.querySelector(selecteur);
const charge = (m) => m.seance.etat().charge;
const identifiant = (m) => dans(m, '[data-section="generation"] [data-meilleure] [data-meilleure-id]');
const lignes = (m) => m.racine.querySelectorAll('[data-section="propositions"] tbody tr[data-proposition]');
const appels = () => vi.mocked(evaluer).mock.calls.length;

// Ouvre la section nommée, son rendu à jour.
function aller(m, section) {
  m.ui.allerA(section);
  flushSync();
}

// Une génération du moteur de plus, enregistrée par la séance.
async function enregistrer(m, reglages) {
  const configuration = configurationDepuisCharge(charge(m));
  const propositions = rechercher(configuration, { historique: 1000, ...reglages });
  await m.seance.executer('enregistrerGeneration', { propositions, configuration, produitVersion: VERSION.affichee });
  flushSync();
}

// L'identifiant au rang 1 d'une table neuve de la charge courante, tel que
// le bloc l'écrit.
const rangUnAttendu = (m) => format.nombre(premiereDuClassement(evaluer(charge(m))).id);

describe('Génération et Propositions relisent une même évaluation (§ 5.7, § 13.3)', () => {
  test('revenir à Génération, puis à Propositions, ne mesure rien de nouveau ; une écriture mesure une fois, et l’annonce suit la charge écrite', async () => {
    const m = await monter({ executeur: creerExecuteurDirect() });
    await m.facade.chargerDemonstration('petite-conflit');
    await m.seance.passerEnEcriture();
    await enregistrer(m, { graine: 5, nombre: 3, arret: 300 });
    aller(m, 'participants');
    vi.mocked(evaluer).mockClear();

    aller(m, 'generation');
    expect(appels(), '1re visite de Génération').toBe(1);
    const premiere = identifiant(m).textContent;
    aller(m, 'participants');
    aller(m, 'generation');
    expect(appels(), '2e visite de Génération').toBe(1);
    aller(m, 'propositions');
    expect(lignes(m).length).toBe(3);
    expect(appels(), 'Propositions après Génération').toBe(1);
    aller(m, 'generation');
    expect(appels(), 'Génération après Propositions').toBe(1);
    expect(identifiant(m).textContent).toBe(premiere);
    // Le modèle relit la même table que les deux sections.
    expect(format.nombre(meilleureProposition(charge(m)).id)).toBe(premiere);
    expect(appels(), 'le modèle après les deux sections').toBe(1);

    // Une écriture qui remplace les propositions : la charge écrite se
    // mesure une fois, et l'annonce lit son rang 1, que l'ancienne charge
    // ne portait pas — un identifiant ne se réattribue jamais.
    const anciens = charge(m).propositions.map(({ id }) => id);
    const avantEcriture = appels();
    await m.seance.executer('effacerPropositions', {});
    flushSync();
    expect(appels(), 'la charge sans proposition, évaluée une fois pour l’état des critères').toBe(avantEcriture + 1);
    aller(m, 'participants');
    aller(m, 'generation');
    expect(appels(), 'la charge sans proposition, revisitée').toBe(avantEcriture + 1);
    const avantGeneration = appels();
    await enregistrer(m, { graine: 9, nombre: 2, arret: 300 });
    expect(appels(), 'la charge écrite, mesurée une fois').toBe(avantGeneration + 1);
    const attendu = rangUnAttendu(m);
    const apres = appels();
    expect(identifiant(m).textContent).toBe(attendu);
    expect(anciens.map((id) => format.nombre(id))).not.toContain(attendu);
    aller(m, 'participants');
    aller(m, 'generation');
    expect(identifiant(m).textContent).toBe(attendu);
    aller(m, 'propositions');
    expect(lignes(m).length).toBe(2);
    expect(appels(), 'les deux sections sur la charge écrite').toBe(apres);
  });
});
