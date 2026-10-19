// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de l'exécuteur du travailleur (§ 5.7, § 5.10) : le groupe de
// travailleurs de creerExecuteurTravailleur, sur une fabrique de
// travailleurs factices. Un travailleur factice garde chaque message reçu et
// compte ses terminate() ; l'épreuve lui fait poster les messages du contrat
// par son onmessage, comme le ferait le vrai travailleur. Les travailleurs
// calculants, eux, répondent par brancherTravailleur, le vrai côté
// travailleur, dans l'ordre que l'épreuve choisit : la valeur attendue est
// alors celle de rechercher, sollicité une seconde fois.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { texteLivre } from '../demo/livrees.js';
import { rechercher, repartir } from '../moteur/recherche.js';
import { analyser, configurationDepuisCharge } from '../stockage/document.js';
import { creerExecuteurTravailleur } from './executeur_travailleur.js';
import { ErreurAnnulee, ErreurGeneration, creerExecuteurDirect } from './generation.js';
import { brancherTravailleur } from './generation_travailleur.js';

const CONFIGURATION = Object.freeze({ marque: 'configuration d’épreuve', tours: 3 });
const REGLAGES = Object.freeze({ graine: 11, nombre: 2, arret: 40_000, historique: 1000 });

// Une proposition d'épreuve du rang donné, sans calcul.
const propositionDe = (rang) => ({ id: rang, graine: 100 + rang, arret: 40_000, historique: 1000, plan: [[[rang]]] });

// Une fabrique de travailleurs factices, et les travailleurs qu'elle a
// rendus, dans l'ordre. Chacun : recus, les messages reçus, clonés ;
// terminaisons, le compte de terminate() ; poster(data), un message du
// travailleur, remis à son onmessage courant ; rang(), celui du dernier
// proposer reçu.
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
      rang() {
        return this.recus.at(-1)?.rang ?? null;
      },
      // Poste la proposition du rang en cours.
      rendre() {
        this.poster({ type: 'proposition', proposition: propositionDe(this.rang()) });
      },
    };
    travailleurs.push(travailleur);
    return travailleur;
  };
  return { fabrique, travailleurs };
}

// Une fabrique de travailleurs calculants : chaque proposer reçu attend que
// l'épreuve le serve ; servir(choisir) traite les demandes en attente une à
// une, choisir désignant chaque fois l'indice de la suivante parmi elles, et
// remet au travailleur ce que brancherTravailleur a posté. Un travailleur
// terminé ne reçoit plus rien.
function fabriqueCalculante() {
  const enAttente = [];
  let crees = 0;
  const fabrique = () => {
    crees += 1;
    const travailleur = {
      onmessage: null,
      termine: false,
      postMessage(message) {
        enAttente.push({ travailleur, message: structuredClone(message) });
      },
      terminate() {
        travailleur.termine = true;
      },
    };
    return travailleur;
  };
  function servir(choisir) {
    while (enAttente.length > 0) {
      const [{ travailleur, message }] = enAttente.splice(choisir(enAttente.length), 1);
      if (travailleur.termine) continue;
      const postes = [];
      const portee = { onmessage: null, postMessage: (m) => postes.push(structuredClone(m)) };
      brancherTravailleur(portee);
      portee.onmessage({ data: message });
      for (const data of postes) if (!travailleur.termine) travailleur.onmessage?.({ data });
    }
  }
  return { fabrique, servir, crees: () => crees };
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

const configurationDe = (cle) => configurationDepuisCharge(analyser(texteLivre(cle)).charge);

describe('exécuteur du travailleur : le groupe (§ 5.7, § 5.10)', () => {
  test('coeursDisponibles : un entier d’au moins 1 tel quel, toute autre valeur 1 ; 1 sans option', () => {
    const { fabrique } = fabriqueFactice();
    const cas = [
      [8, 8],
      [1, 1],
      [undefined, 1],
      [0, 1],
      [2.5, 1],
      ['4', 1],
      [null, 1],
    ];
    assert.equal(cas.length, 7);
    for (const [donnee, attendue] of cas) {
      assert.equal(creerExecuteurTravailleur(fabrique, { coeursDisponibles: donnee }).coeursDisponibles, attendue, String(donnee));
    }
    assert.equal(creerExecuteurTravailleur(fabrique).coeursDisponibles, 1);
  });

  test('min(nombre, coeurs) travailleurs, nés au lancer ; le travailleur k reçoit d’abord le rang k ; sans option, un seul', () => {
    const cas = [
      { coeurs: 3, nombre: 5, attendus: 3 },
      { coeurs: 8, nombre: 3, attendus: 3 },
      { coeurs: 1, nombre: 5, attendus: 1 },
      { coeurs: undefined, nombre: 4, attendus: 1 },
    ];
    assert.equal(cas.length, 4);
    for (const { coeurs, nombre, attendus } of cas) {
      const { fabrique, travailleurs } = fabriqueFactice();
      const executeur = creerExecuteurTravailleur(fabrique, { coeursDisponibles: 16 });
      assert.equal(travailleurs.length, 0, 'aucun travailleur avant le lancer');
      const reglages = { ...REGLAGES, nombre };
      const execution = executeur.lancer(CONFIGURATION, reglages, coeurs === undefined ? undefined : { coeurs });
      execution.resultat.catch(() => undefined);
      assert.equal(travailleurs.length, attendus, JSON.stringify({ coeurs, nombre }));
      assert.equal(execution.coeurs, attendus);
      assert.equal(new Set(travailleurs).size, attendus);
      travailleurs.forEach((travailleur, k) => {
        assert.deepEqual(travailleur.recus, [{ type: 'proposer', configuration: CONFIGURATION, reglages, rang: k + 1 }]);
        assert.equal(travailleur.terminaisons, 0);
      });
      execution.annuler();
    }
  });

  test('le rang suivant va au premier travailleur libéré ; celui qui n’a plus rien à faire est terminé ; le résultat suit les identifiants, non l’ordre d’achèvement', async () => {
    const { fabrique, travailleurs } = fabriqueFactice();
    const reglages = { ...REGLAGES, nombre: 5 };
    const execution = creerExecuteurTravailleur(fabrique).lancer(CONFIGURATION, reglages, { coeurs: 2 });
    const [premier, second] = travailleurs;
    second.rendre(); // rang 2
    assert.equal(second.rang(), 3);
    second.rendre(); // rang 3
    assert.equal(second.rang(), 4);
    premier.rendre(); // rang 1
    assert.equal(premier.rang(), 5);
    premier.rendre(); // rang 5 : plus rien pour le premier
    assert.equal(premier.terminaisons, 1);
    assert.equal(second.terminaisons, 0);
    assert.equal((await issue(execution.resultat)).etat, 'attente');
    second.rendre(); // rang 4
    const lue = await issue(execution.resultat);
    assert.equal(lue.etat, 'resolue');
    assert.deepEqual(lue.valeur, [1, 2, 3, 4, 5].map(propositionDe));
    assert.deepEqual(
      travailleurs.map(({ terminaisons }) => terminaisons),
      [1, 1],
    );
    assert.deepEqual(
      travailleurs.map(({ recus }) => recus.map(({ rang }) => rang)),
      [
        [1, 5],
        [2, 3, 4],
      ],
    );
    execution.annuler();
    assert.deepEqual(
      travailleurs.map(({ terminaisons }) => terminaisons),
      [1, 1],
      'annuler après le résultat ne termine rien de plus',
    );
  });

  test('travailleurs calculants : pour 1, 2 et 3 cœurs et 5 propositions, servis dans trois ordres, le résultat sérialisé égale celui de rechercher, octet pour octet', async () => {
    const configuration = configurationDe('petite-conflit');
    const reglages = { graine: 77, nombre: 5, arret: 3_000, historique: 1000 };
    const attendu = JSON.stringify(rechercher(configuration, reglages));
    const ordres = {
      fifo: () => 0,
      lifo: (n) => n - 1,
      milieu: (n) => Math.floor(n / 2),
    };
    const coeurs = [1, 2, 3];
    let comparaisons = 0;
    for (const w of coeurs) {
      for (const [nom, choisir] of Object.entries(ordres)) {
        const { fabrique, servir, crees } = fabriqueCalculante();
        const execution = creerExecuteurTravailleur(fabrique).lancer(configuration, reglages, { coeurs: w });
        assert.equal(crees(), w);
        servir(choisir);
        const lue = await issue(execution.resultat);
        assert.equal(lue.etat, 'resolue', `${w} cœurs, ${nom}`);
        assert.equal(JSON.stringify(lue.valeur), attendu, `${w} cœurs, ${nom}`);
        comparaisons += 1;
      }
    }
    assert.equal(comparaisons, 9);
  });

  test("la course de chaque proposition traverse le groupe telle quelle, sans date : l'exécuteur direct rend la même, quel que soit l'ordre d'achèvement", async () => {
    const configuration = configurationDe('petite-conflit');
    const reglages = { graine: 23, nombre: 4, arret: 3_000, historique: 100 };
    const direct = await creerExecuteurDirect().lancer(configuration, reglages).resultat;
    assert.ok(direct.every(({ evalues, releves }) => evalues === 3_000 && releves.length === 4));
    for (const choisir of [() => 0, (n) => n - 1]) {
      const { fabrique, servir } = fabriqueCalculante();
      const execution = creerExecuteurTravailleur(fabrique).lancer(configuration, reglages, { coeurs: 3 });
      servir(choisir);
      const lue = await issue(execution.resultat);
      assert.equal(lue.etat, 'resolue');
      assert.deepStrictEqual(lue.valeur, direct);
      for (const proposition of lue.valeur) {
        assert.deepEqual(Object.keys(proposition), ['id', 'graine', 'arret', 'historique', 'plan', 'evalues', 'releves']);
      }
    }
  });

  test('l’avancement est la somme des avancements de chaque proposition, sur nombre × arret ; une proposition rendue compte pour son arret entier', () => {
    const { fabrique, travailleurs } = fabriqueFactice();
    const reglages = { ...REGLAGES, nombre: 3, arret: 100 };
    const execution = creerExecuteurTravailleur(fabrique).lancer(CONFIGURATION, reglages, { coeurs: 2 });
    execution.resultat.catch(() => undefined);
    const recus = [];
    execution.surAvancement((fait, total) => recus.push([fait, total]));
    const [premier, second] = travailleurs;
    premier.poster({ type: 'avancement', fait: 40, total: 100 });
    second.poster({ type: 'avancement', fait: 30, total: 100 });
    premier.poster({ type: 'proposition', proposition: propositionDe(1) });
    premier.poster({ type: 'avancement', fait: 50, total: 100 });
    second.poster({ type: 'avancement', fait: 90, total: 100 });
    assert.deepEqual(recus, [
      [40, 300],
      [70, 300],
      [130, 300],
      [180, 300],
      [240, 300],
    ]);
    execution.annuler();
  });

  test('l’avancement ne décroît jamais : un avancement plus petit, ou égal, que le dernier de sa proposition ne publie rien', () => {
    const { fabrique, travailleurs } = fabriqueFactice();
    const reglages = { ...REGLAGES, nombre: 2, arret: 100 };
    const execution = creerExecuteurTravailleur(fabrique).lancer(CONFIGURATION, reglages, { coeurs: 2 });
    execution.resultat.catch(() => undefined);
    const recus = [];
    execution.surAvancement((fait, total) => recus.push([fait, total]));
    const [premier, second] = travailleurs;
    premier.poster({ type: 'avancement', fait: 60, total: 100 });
    premier.poster({ type: 'avancement', fait: 20, total: 100 });
    second.poster({ type: 'avancement', fait: 50, total: 100 });
    second.poster({ type: 'avancement', fait: 50, total: 100 });
    premier.poster({ type: 'proposition', proposition: propositionDe(1) });
    second.poster({ type: 'avancement', fait: 40, total: 100 });
    assert.deepEqual(recus, [
      [60, 200],
      [110, 200],
      [150, 200],
    ]);
    for (let i = 1; i < recus.length; i += 1) assert.ok(recus[i][0] >= recus[i - 1][0], `avancement ${i}`);
    execution.annuler();
  });

  test('un abonné retiré ne reçoit plus rien', () => {
    const { fabrique, travailleurs } = fabriqueFactice();
    const execution = creerExecuteurTravailleur(fabrique).lancer(CONFIGURATION, REGLAGES);
    execution.resultat.catch(() => undefined);
    const recus = [];
    const retires = [];
    execution.surAvancement((fait, total) => recus.push([fait, total]));
    const desabonner = execution.surAvancement((fait, total) => retires.push([fait, total]));
    const [travailleur] = travailleurs;
    travailleur.poster({ type: 'avancement', fait: 20_000, total: 40_000 });
    desabonner();
    travailleur.poster({ type: 'avancement', fait: 30_000, total: 40_000 });
    assert.deepEqual(recus, [
      [20_000, 80_000],
      [30_000, 80_000],
    ]);
    assert.deepEqual(retires, [[20_000, 80_000]]);
    execution.annuler();
  });

  test("annuler : chaque travailleur terminé aussitôt, rejet par ErreurAnnulee ; rien de ce qu'un travailleur poste ensuite n'atteint plus rien", async () => {
    const { fabrique, travailleurs } = fabriqueFactice();
    const execution = creerExecuteurTravailleur(fabrique).lancer(CONFIGURATION, { ...REGLAGES, nombre: 5 }, { coeurs: 3 });
    const avancements = [];
    execution.surAvancement((fait, total) => avancements.push([fait, total]));
    // Les gestionnaires posés au lancement : un message déjà en file chez
    // le navigateur au moment de l'annulation les atteindrait encore.
    const gestionnaires = travailleurs.map(({ onmessage }) => onmessage);
    travailleurs[1].poster({ type: 'avancement', fait: 10_000, total: 40_000 });
    execution.annuler();
    assert.deepEqual(
      travailleurs.map(({ terminaisons }) => terminaisons),
      [1, 1, 1],
      'terminate() de chacun dans le même tour que annuler()',
    );
    for (const gestionnaire of gestionnaires) {
      gestionnaire({ data: { type: 'avancement', fait: 40_000, total: 40_000 } });
      gestionnaire({ data: { type: 'proposition', proposition: propositionDe(1) } });
    }
    const lue = await issue(execution.resultat);
    assert.equal(lue.etat, 'rejetee');
    assert.ok(lue.erreur instanceof ErreurAnnulee, String(lue.erreur));
    assert.deepEqual(avancements, [[10_000, 200_000]]);
    assert.deepEqual(
      travailleurs.map(({ recus }) => recus.length),
      [1, 1, 1],
      'aucun rang donné après l’annulation',
    );
    execution.annuler();
    assert.deepEqual(
      travailleurs.map(({ terminaisons }) => terminaisons),
      [1, 1, 1],
      'une seconde annulation ne termine rien de plus',
    );
  });

  test('erreur { code, details } d’un travailleur : rejet par une ErreurGeneration de ce code et de ces détails, chaque travailleur terminé, la suite ignorée', async () => {
    const { fabrique, travailleurs } = fabriqueFactice();
    const execution = creerExecuteurTravailleur(fabrique).lancer(CONFIGURATION, { ...REGLAGES, nombre: 4 }, { coeurs: 3 });
    const avancements = [];
    execution.surAvancement((fait) => avancements.push(fait));
    travailleurs[0].rendre();
    travailleurs[1].poster({ type: 'erreur', code: 'PLACES_MANQUANTES', details: { placesManquantes: 1 } });
    travailleurs[2].rendre();
    travailleurs[0].poster({ type: 'avancement', fait: 1, total: 2 });
    const lue = await issue(execution.resultat);
    assert.equal(lue.etat, 'rejetee');
    assert.ok(lue.erreur instanceof ErreurGeneration, String(lue.erreur));
    assert.equal(lue.erreur.code, 'PLACES_MANQUANTES');
    assert.deepEqual(lue.erreur.details, { placesManquantes: 1 });
    assert.deepEqual(
      travailleurs.map(({ terminaisons }) => terminaisons),
      [1, 1, 1],
    );
    assert.deepEqual(avancements, [40_000]);
  });

  test('le canal d’erreur d’un travailleur — un script qui ne se charge ou ne se compile pas : rejet par ErreurGeneration TRAVAILLEUR_EN_ECHEC, remède null, sans le message ; l’événement est traité, chaque travailleur terminé', async () => {
    const { fabrique, travailleurs } = fabriqueFactice();
    const execution = creerExecuteurTravailleur(fabrique).lancer(CONFIGURATION, REGLAGES, { coeurs: 2 });
    assert.equal(travailleurs.length, 2);
    assert.ok(travailleurs.every(({ onerror }) => typeof onerror === 'function'));
    const evenement = {
      message: 'faute d’épreuve',
      traite: false,
      preventDefault() {
        this.traite = true;
      },
    };
    travailleurs[1].onerror(evenement);
    const lue = await issue(execution.resultat);
    assert.equal(lue.etat, 'rejetee');
    assert.ok(lue.erreur instanceof ErreurGeneration, String(lue.erreur));
    assert.equal(lue.erreur.code, 'TRAVAILLEUR_EN_ECHEC');
    assert.deepEqual(lue.erreur.details, { remede: null });
    assert.doesNotMatch(JSON.stringify(lue.erreur.details), /épreuve/);
    assert.equal(evenement.traite, true);
    assert.deepEqual(
      travailleurs.map(({ terminaisons }) => terminaisons),
      [1, 1],
    );
    // Un événement d'erreur sans preventDefault, comme le rendrait une portée factice, ne lève pas.
    const seconde = creerExecuteurTravailleur(fabrique).lancer(CONFIGURATION, REGLAGES);
    travailleurs[2].onerror({});
    assert.equal((await issue(seconde.resultat)).erreur.code, 'TRAVAILLEUR_EN_ECHEC');
  });

  test('une faute pendant le calcul, postée { type: faute, message, pile } : rejet par une Error sans code, qui porte le message et la pile du travailleur ; aucun refus, chaque travailleur terminé, la suite ignorée', async () => {
    const { fabrique, travailleurs } = fabriqueFactice();
    const execution = creerExecuteurTravailleur(fabrique).lancer(CONFIGURATION, REGLAGES, { coeurs: 2 });
    const avancements = [];
    execution.surAvancement((fait, total) => avancements.push([fait, total]));
    const [travailleur, autre] = travailleurs;
    travailleur.poster({ type: 'faute', message: 'TypeError: invariant d’épreuve rompu', pile: 'TypeError: invariant d’épreuve rompu\n    at calcul (épreuve.js:1:1)' });
    travailleur.poster({ type: 'avancement', fait: 1, total: 2 });
    autre.rendre();
    const lue = await issue(execution.resultat);
    assert.equal(lue.etat, 'rejetee');
    assert.ok(lue.erreur instanceof Error, String(lue.erreur));
    assert.ok(!(lue.erreur instanceof ErreurGeneration), 'une faute n’est pas un refus');
    assert.ok(!(lue.erreur instanceof ErreurAnnulee));
    assert.equal(lue.erreur.code, undefined);
    assert.match(lue.erreur.message, /TypeError: invariant d’épreuve rompu/);
    assert.match(lue.erreur.stack, /at calcul \(épreuve\.js:1:1\)/);
    assert.deepEqual(avancements, []);
    assert.deepEqual(
      travailleurs.map(({ terminaisons }) => terminaisons),
      [1, 1],
    );
  });

  test('un réglage hors de son domaine rejette REGLAGE_HORS_DOMAINE sans faire naître de travailleur ; un nombre de cœurs qui n’est pas un entier d’au moins 1 lève une RangeError', async () => {
    const { fabrique, travailleurs } = fabriqueFactice();
    const executeur = creerExecuteurTravailleur(fabrique, { coeursDisponibles: 4 });
    const execution = executeur.lancer(CONFIGURATION, { ...REGLAGES, nombre: 0 }, { coeurs: 2 });
    const lue = await issue(execution.resultat);
    assert.equal(lue.etat, 'rejetee');
    assert.equal(lue.erreur.code, 'REGLAGE_HORS_DOMAINE');
    assert.deepEqual(lue.erreur.details, { reglage: 'nombre', remede: null });
    assert.equal(execution.coeurs, 0);
    assert.doesNotThrow(() => execution.annuler());
    for (const coeurs of [0, 1.5, '2']) {
      assert.throws(() => executeur.lancer(CONFIGURATION, REGLAGES, { coeurs }), RangeError, String(coeurs));
    }
    assert.equal(travailleurs.length, 0);
  });
});

describe('exécuteur du travailleur : le départ (§ 5.7, § 5.10, C8, C24)', () => {
  // Un départ d'épreuve, que le groupe transmet sans le lire.
  const DEPART = Object.freeze({ plan: { tables: [1], tours: [[[1]]], reserves: [[]] }, toursFiges: [1] });

  // Le départ du moteur sur une configuration : la première proposition à un
  // compte court, tours 1 et 3 figés.
  const departDe = (configuration) => ({
    plan: rechercher(configuration, { graine: 5, arret: 40, nombre: 1 })[0].plan,
    toursFiges: [1, 3],
  });

  test('sous un départ, chaque proposer le porte, rangs suivants compris ; sans départ — option absente ou null —, le message n’a pas de clé depart', () => {
    const { fabrique, travailleurs } = fabriqueFactice();
    const reglages = { ...REGLAGES, nombre: 3 };
    const execution = creerExecuteurTravailleur(fabrique).lancer(CONFIGURATION, reglages, { coeurs: 2, depart: DEPART });
    execution.resultat.catch(() => undefined);
    travailleurs[0].rendre();
    assert.deepEqual(
      travailleurs.flatMap(({ recus }) => recus),
      [1, 3, 2].map((rang) => ({ type: 'proposer', configuration: CONFIGURATION, reglages, rang, depart: DEPART })),
    );
    execution.annuler();
    for (const options of [{ coeurs: 2 }, { coeurs: 2, depart: null }]) {
      const ordinaire = fabriqueFactice();
      const sans = creerExecuteurTravailleur(ordinaire.fabrique).lancer(CONFIGURATION, reglages, options);
      sans.resultat.catch(() => undefined);
      ordinaire.travailleurs[0].rendre();
      const messages = ordinaire.travailleurs.flatMap(({ recus }) => recus);
      assert.equal(messages.length, 3, JSON.stringify(options));
      for (const message of messages) assert.equal(Object.hasOwn(message, 'depart'), false, JSON.stringify(options));
      sans.annuler();
    }
  });

  test('travailleurs calculants sous un départ : pour 1, 2 et 3 cœurs, servis dans trois ordres, le résultat sérialisé égale celui de repartir, et l’exécuteur direct rend le même', async () => {
    const configuration = configurationDe('petite-conflit');
    const reglages = { graine: 77, nombre: 5, arret: 3_000, historique: 100 };
    const depart = departDe(configuration);
    const attendues = repartir(configuration, reglages, depart);
    const attendu = JSON.stringify(attendues);
    assert.notEqual(attendu, JSON.stringify(rechercher(configuration, reglages)));
    const ordres = [() => 0, (n) => n - 1, (n) => Math.floor(n / 2)];
    let comparaisons = 0;
    for (const w of [1, 2, 3]) {
      for (const choisir of ordres) {
        const { fabrique, servir } = fabriqueCalculante();
        const execution = creerExecuteurTravailleur(fabrique).lancer(configuration, reglages, { coeurs: w, depart });
        servir(choisir);
        const lue = await issue(execution.resultat);
        assert.equal(lue.etat, 'resolue', `${w} cœurs`);
        assert.equal(JSON.stringify(lue.valeur), attendu, `${w} cœurs`);
        comparaisons += 1;
      }
    }
    assert.equal(comparaisons, 9);
    const direct = await creerExecuteurDirect().lancer(configuration, reglages, { coeurs: 3, depart }).resultat;
    assert.deepStrictEqual(direct, attendues);
    const sansDepart = await creerExecuteurDirect().lancer(configuration, reglages, { depart: null }).resultat;
    assert.deepStrictEqual(sansDepart, rechercher(configuration, reglages));
  });

  test('l’exécuteur direct sous un départ : un départ que le moteur refuse rejette ErreurGeneration DEPART_INCOMPATIBLE ; l’annulation lève ErreurAnnulee', async () => {
    const configuration = configurationDe('petite');
    const reglages = { graine: 2, nombre: 2, arret: 3_000, historique: 100 };
    const { plan } = departDe(configuration);
    // Au tour 2, la première personne de la première table est assise une
    // seconde fois, à la dernière table : le moteur refuse ce départ.
    const tronque = structuredClone(plan);
    tronque.tours[1].at(-1).push(tronque.tours[1][0][0]);
    const refus = await issue(creerExecuteurDirect().lancer(configuration, reglages, { depart: { plan: tronque, toursFiges: [] } }).resultat);
    assert.equal(refus.etat, 'rejetee');
    assert.ok(refus.erreur instanceof ErreurGeneration, String(refus.erreur));
    assert.equal(refus.erreur.code, 'DEPART_INCOMPATIBLE');
    assert.equal(refus.erreur.details.tour, 2);
    const execution = creerExecuteurDirect().lancer(configuration, reglages, { depart: { plan, toursFiges: [2] } });
    execution.annuler();
    const lue = await issue(execution.resultat);
    assert.equal(lue.etat, 'rejetee');
    assert.ok(lue.erreur instanceof ErreurAnnulee);
  });
});
