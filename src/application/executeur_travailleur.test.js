// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de l'exécuteur du travailleur (§ 5.10) : creerExecuteurTravailleur
// sur une fabrique de travailleurs factices. Un travailleur factice garde
// chaque message reçu et compte ses terminate() ; l'épreuve lui fait poster
// les messages du contrat de données par son onmessage, comme le ferait le
// vrai travailleur. Aucun calcul n'a lieu : les propositions et la
// configuration sont des objets d'épreuve.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { creerExecuteurTravailleur } from './executeur_travailleur.js';
import { ErreurAnnulee, ErreurGeneration } from './generation.js';

const CONFIGURATION = Object.freeze({ marque: 'configuration d’épreuve', tours: 3 });
const REGLAGES = Object.freeze({ graine: 11, nombre: 2, arret: 40_000, historique: 1000 });

// Une fabrique de travailleurs factices, et les travailleurs qu'elle a
// rendus, dans l'ordre. Chacun : recus, les messages reçus, clonés ;
// terminaisons, le compte de terminate() ; poster(data), un message du
// travailleur, remis à son onmessage courant.
function fabriqueFactice() {
  const travailleurs = [];
  const fabrique = () => {
    const travailleur = {
      recus: [],
      terminaisons: 0,
      onmessage: null,
      postMessage(message) {
        this.recus.push(structuredClone(message));
      },
      terminate() {
        this.terminaisons += 1;
      },
      poster(data) {
        this.onmessage?.({ data });
      },
    };
    travailleurs.push(travailleur);
    return travailleur;
  };
  return { fabrique, travailleurs };
}

// L'issue d'une promesse, sans attendre plus d'un tour de la file des
// microtâches : { etat: 'attente' }, { etat: 'resolue', valeur } ou
// { etat: 'rejetee', erreur }.
async function issue(promesse) {
  let lue = { etat: 'attente' };
  promesse.then(
    (valeur) => {
      lue = { etat: 'resolue', valeur };
    },
    (erreur) => {
      lue = { etat: 'rejetee', erreur };
    },
  );
  await Promise.resolve();
  await Promise.resolve();
  return lue;
}

describe('exécuteur du travailleur (§ 5.10)', () => {
  test('un travailleur neuf par lancer, dont le premier message est { type: lancer, configuration, reglages }', () => {
    const { fabrique, travailleurs } = fabriqueFactice();
    const executeur = creerExecuteurTravailleur(fabrique);
    assert.equal(travailleurs.length, 0, 'aucun travailleur avant le premier lancer');
    const premiere = executeur.lancer(CONFIGURATION, REGLAGES);
    const seconde = executeur.lancer(CONFIGURATION, { ...REGLAGES, graine: 12 });
    premiere.resultat.catch(() => undefined);
    seconde.resultat.catch(() => undefined);
    assert.equal(travailleurs.length, 2);
    assert.notEqual(travailleurs[0], travailleurs[1]);
    assert.deepEqual(travailleurs[0].recus, [{ type: 'lancer', configuration: CONFIGURATION, reglages: REGLAGES }]);
    assert.deepEqual(travailleurs[1].recus, [
      { type: 'lancer', configuration: CONFIGURATION, reglages: { ...REGLAGES, graine: 12 } },
    ]);
    assert.deepEqual(
      travailleurs.map(({ terminaisons }) => terminaisons),
      [0, 0],
    );
  });

  test('deux avancements parviennent à surAvancement dans leur ordre ; un abonné retiré ne reçoit plus rien', () => {
    const { fabrique, travailleurs } = fabriqueFactice();
    const execution = creerExecuteurTravailleur(fabrique).lancer(CONFIGURATION, REGLAGES);
    execution.resultat.catch(() => undefined);
    const recus = [];
    const retires = [];
    execution.surAvancement((fait, total) => recus.push([fait, total]));
    const desabonner = execution.surAvancement((fait, total) => retires.push([fait, total]));
    const [travailleur] = travailleurs;
    travailleur.poster({ type: 'avancement', fait: 50_000, total: 80_000 });
    desabonner();
    travailleur.poster({ type: 'avancement', fait: 80_000, total: 80_000 });
    assert.deepEqual(recus, [
      [50_000, 80_000],
      [80_000, 80_000],
    ]);
    assert.deepEqual(retires, [[50_000, 80_000]]);
  });

  test('resultat : la promesse se résout aux propositions reçues, puis le travailleur est terminé ; un message tardif ne change rien', async () => {
    const { fabrique, travailleurs } = fabriqueFactice();
    const execution = creerExecuteurTravailleur(fabrique).lancer(CONFIGURATION, REGLAGES);
    const avancements = [];
    execution.surAvancement((fait) => avancements.push(fait));
    const [travailleur] = travailleurs;
    const propositions = [
      { id: 1, graine: 101, arret: 40_000, historique: 1000, plan: [[[1, 2]]] },
      { id: 2, graine: 102, arret: 40_000, historique: 1000, plan: [[[2, 1]]] },
    ];
    assert.equal((await issue(execution.resultat)).etat, 'attente');
    travailleur.poster({ type: 'resultat', propositions });
    const lue = await issue(execution.resultat);
    assert.equal(lue.etat, 'resolue');
    assert.deepEqual(lue.valeur, propositions);
    assert.equal(travailleur.terminaisons, 1);
    travailleur.poster({ type: 'avancement', fait: 1, total: 2 });
    execution.annuler();
    assert.deepEqual(avancements, []);
    assert.equal(travailleur.terminaisons, 1, 'annuler après le résultat ne termine pas une seconde fois');
  });

  test('erreur { code, details } : rejet par une ErreurGeneration de ce code et de ces détails, le travailleur terminé', async () => {
    const { fabrique, travailleurs } = fabriqueFactice();
    const execution = creerExecuteurTravailleur(fabrique).lancer(CONFIGURATION, REGLAGES);
    const [travailleur] = travailleurs;
    travailleur.poster({ type: 'erreur', code: 'PLACES_MANQUANTES', details: { placesManquantes: 1 } });
    const lue = await issue(execution.resultat);
    assert.equal(lue.etat, 'rejetee');
    assert.ok(lue.erreur instanceof ErreurGeneration, String(lue.erreur));
    assert.equal(lue.erreur.code, 'PLACES_MANQUANTES');
    assert.deepEqual(lue.erreur.details, { placesManquantes: 1 });
    assert.equal(travailleur.terminaisons, 1);
  });

  test("annuler : terminate() aussitôt, rejet par ErreurAnnulee ; un avancement ou un résultat posté ensuite n'atteint plus rien", async () => {
    const { fabrique, travailleurs } = fabriqueFactice();
    const execution = creerExecuteurTravailleur(fabrique).lancer(CONFIGURATION, REGLAGES);
    const avancements = [];
    execution.surAvancement((fait, total) => avancements.push([fait, total]));
    const [travailleur] = travailleurs;
    // Le gestionnaire posé au lancement : un message déjà en file chez le
    // navigateur au moment de l'annulation l'atteindrait encore.
    const gestionnaire = travailleur.onmessage;
    travailleur.poster({ type: 'avancement', fait: 50_000, total: 80_000 });
    execution.annuler();
    assert.equal(travailleur.terminaisons, 1, 'terminate() dans le même tour que annuler()');
    gestionnaire({ data: { type: 'avancement', fait: 80_000, total: 80_000 } });
    gestionnaire({ data: { type: 'resultat', propositions: [] } });
    travailleur.poster({ type: 'avancement', fait: 80_000, total: 80_000 });
    const lue = await issue(execution.resultat);
    assert.equal(lue.etat, 'rejetee');
    assert.ok(lue.erreur instanceof ErreurAnnulee, String(lue.erreur));
    assert.deepEqual(avancements, [[50_000, 80_000]]);
    execution.annuler();
    assert.equal(travailleur.terminaisons, 1, 'une seconde annulation ne termine rien de plus');
  });

  test('le canal d’erreur du travailleur — un script qui ne se charge ou ne se compile pas : rejet par ErreurGeneration TRAVAILLEUR_EN_ECHEC, remède null, sans le message ; l’événement est traité, le travailleur terminé', async () => {
    const { fabrique, travailleurs } = fabriqueFactice();
    const execution = creerExecuteurTravailleur(fabrique).lancer(CONFIGURATION, REGLAGES);
    const [travailleur] = travailleurs;
    assert.equal(typeof travailleur.onerror, 'function');
    const evenement = {
      message: 'faute d’épreuve',
      traite: false,
      preventDefault() {
        this.traite = true;
      },
    };
    travailleur.onerror(evenement);
    const lue = await issue(execution.resultat);
    assert.equal(lue.etat, 'rejetee');
    assert.ok(lue.erreur instanceof ErreurGeneration, String(lue.erreur));
    assert.equal(lue.erreur.code, 'TRAVAILLEUR_EN_ECHEC');
    assert.deepEqual(lue.erreur.details, { remede: null });
    assert.doesNotMatch(JSON.stringify(lue.erreur.details), /épreuve/);
    assert.equal(evenement.traite, true);
    assert.equal(travailleur.terminaisons, 1);
    // Un événement d'erreur sans preventDefault, comme le rendrait une portée factice, ne lève pas.
    const seconde = creerExecuteurTravailleur(fabrique).lancer(CONFIGURATION, REGLAGES);
    travailleurs[1].onerror({});
    assert.equal((await issue(seconde.resultat)).erreur.code, 'TRAVAILLEUR_EN_ECHEC');
  });

  test('une faute pendant le calcul, postée { type: faute, message, pile } : rejet par une Error sans code, qui porte le message et la pile du travailleur ; aucun refus, le travailleur terminé, la suite ignorée', async () => {
    const { fabrique, travailleurs } = fabriqueFactice();
    const execution = creerExecuteurTravailleur(fabrique).lancer(CONFIGURATION, REGLAGES);
    const avancements = [];
    execution.surAvancement((fait, total) => avancements.push([fait, total]));
    const [travailleur] = travailleurs;
    travailleur.poster({ type: 'faute', message: 'TypeError: invariant d’épreuve rompu', pile: 'TypeError: invariant d’épreuve rompu\n    at calcul (épreuve.js:1:1)' });
    travailleur.poster({ type: 'avancement', fait: 1, total: 2 });
    travailleur.poster({ type: 'resultat', propositions: [] });
    const lue = await issue(execution.resultat);
    assert.equal(lue.etat, 'rejetee');
    assert.ok(lue.erreur instanceof Error, String(lue.erreur));
    assert.ok(!(lue.erreur instanceof ErreurGeneration), 'une faute n’est pas un refus');
    assert.ok(!(lue.erreur instanceof ErreurAnnulee));
    assert.equal(lue.erreur.code, undefined);
    assert.match(lue.erreur.message, /TypeError: invariant d’épreuve rompu/);
    assert.match(lue.erreur.stack, /at calcul \(épreuve\.js:1:1\)/);
    assert.deepEqual(avancements, []);
    assert.equal(travailleur.terminaisons, 1);
  });
});
