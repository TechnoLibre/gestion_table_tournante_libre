// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de l'exécuteur d'aperçu (§ 8.1) : creerExecuteurApercu sur une
// fabrique de travailleurs factices, et brancherTravailleurApercu, le vrai
// côté travailleur. Un travailleur factice garde chaque message reçu, cloné
// comme le navigateur le clone, et compte ses terminate() ; l'épreuve lui
// fait poster les messages du contrat par son onmessage. Un travailleur
// calculant répond par brancherTravailleurApercu, sur une portée qui clone
// aussi ce qu'il poste : la valeur attendue est celle de resumeDuRetenu et
// resumeDuMeilleur, sollicités une seconde fois sur la même charge.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creerFichiersSimules } from '../../test/fichiers_simules.js';
import { describe, test } from '../../test/lanceur.js';
import { texteLivre } from '../demo/livrees.js';
import { rechercher } from '../moteur/recherche.js';
import { serialiser } from '../stockage/canonique.js';
import { ouvrir } from '../stockage/depot.js';
import { analyser, configurationDepuisCharge } from '../stockage/document.js';
import { SUFFIXES } from '../stockage/noms.js';
import { VERSION } from '../version.genere.js';
import { appliquerCommande } from './commandes.js';
import { resumeDuMeilleur, resumeDuRetenu } from './evaluation.js';
import { brancherTravailleurApercu, creerExecuteurApercu } from './executeur_apercu.js';

// La petite démonstration au conflit inévitable, trois propositions du
// moteur cherchées depuis graine, et la deuxième retenue : une charge dont
// les deux résumés ne sont pas nuls.
function chargeResumee(graine = 6) {
  let charge = analyser(texteLivre('petite-conflit')).charge;
  const configuration = configurationDepuisCharge(charge);
  const propositions = rechercher(configuration, { graine, nombre: 3, arret: 300 });
  charge = appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: VERSION.affichee }).charge;
  return appliquerCommande('retenirProposition', charge, { id: charge.propositions[1].id }).charge;
}

// Les deux résumés d'une charge, calculés sur le fil.
const surLeFil = (charge) => ({ mesuresDuRetenu: resumeDuRetenu(charge), meilleureDuClassement: resumeDuMeilleur(charge) });

// Une fabrique de travailleurs factices, et les travailleurs qu'elle a
// rendus, dans l'ordre. Chacun : recus, les messages reçus, clonés ;
// terminaisons, le compte de terminate() ; poster(data), un message du
// travailleur, remis à son onmessage courant ; echouer(), l'échec de son
// script, remis à son onerror courant, qui rend l'événement ; refuser, une
// erreur que postMessage lève quand elle n'est pas null.
function fabriqueFactice() {
  const travailleurs = [];
  const fabrique = () => {
    const travailleur = {
      recus: [],
      terminaisons: 0,
      refuser: null,
      onmessage: null,
      onerror: null,
      postMessage(message) {
        if (this.refuser !== null) throw this.refuser;
        this.recus.push(structuredClone(message));
      },
      terminate() {
        this.terminaisons += 1;
      },
      poster(data) {
        this.onmessage?.({ data });
      },
      echouer() {
        const evenement = {
          message: 'script introuvable',
          traite: false,
          preventDefault() {
            this.traite = true;
          },
        };
        this.onerror?.(evenement);
        return evenement;
      },
    };
    travailleurs.push(travailleur);
    return travailleur;
  };
  return { fabrique, travailleurs };
}

// Une fabrique de travailleurs calculants : chaque message reçu, cloné, va
// à la portée que brancherTravailleurApercu a branchée ; ce qu'elle poste,
// cloné, revient au onmessage du travailleur à la microtâche suivante.
function fabriqueCalculante() {
  let crees = 0;
  const fabrique = () => {
    crees += 1;
    const portee = { onmessage: null, postMessage: null };
    const travailleur = {
      onmessage: null,
      onerror: null,
      termine: false,
      postMessage(message) {
        const clone = structuredClone(message);
        queueMicrotask(() => {
          if (!travailleur.termine) portee.onmessage({ data: clone });
        });
      },
      terminate() {
        travailleur.termine = true;
      },
    };
    portee.postMessage = (message) => {
      const clone = structuredClone(message);
      queueMicrotask(() => {
        if (!travailleur.termine) travailleur.onmessage?.({ data: clone });
      });
    };
    brancherTravailleurApercu(portee);
    return travailleur;
  };
  return { fabrique, crees: () => crees };
}

// Vrai quand la promesse est réglée après une vingtaine de microtâches,
// bien plus que n'en demande une réponse déjà remise.
async function reglee(promesse) {
  let fait = false;
  promesse.then(
    () => (fait = true),
    () => (fait = true),
  );
  for (let tour = 0; tour < 20; tour += 1) await Promise.resolve();
  return fait;
}

describe('creerExecuteurApercu (§ 8.1)', () => {
  test('les deux résumés d’une charge, calculés par le travailleur, sont ceux du calcul sur le fil ; la charge reçue n’est pas modifiée', async () => {
    const { fabrique, crees } = fabriqueCalculante();
    const executeur = creerExecuteurApercu(fabrique);
    const charge = chargeResumee();
    const avant = structuredClone(charge);
    const attendu = surLeFil(chargeResumee());
    assert.notEqual(attendu.mesuresDuRetenu, null);
    assert.notEqual(attendu.meilleureDuClassement, null);
    assert.deepEqual(await executeur.calculer(charge), attendu);
    assert.deepEqual(charge, avant);
    assert.equal(crees(), 1);
    executeur.terminer();
  });

  test('la charge que l’ouverture examine traverse le clonage des deux côtés : ses résumés sont ceux du calcul sur le fil', async () => {
    const fs = creerFichiersSimules();
    fs.deposer('documents', `vigie/vigie${SUFFIXES.etat}`, serialiser(chargeResumee(9), { revision: 1, produitVersion: VERSION.affichee }));
    const racines = await fs.racines();
    const { charge } = await ouvrir(fs, racines.documents, 'vigie/vigie');
    const attendu = surLeFil(charge);
    assert.notEqual(attendu.mesuresDuRetenu, null);
    assert.notEqual(attendu.meilleureDuClassement, null);
    const { fabrique } = fabriqueCalculante();
    const executeur = creerExecuteurApercu(fabrique);
    assert.deepEqual(await executeur.calculer(charge), attendu);
    executeur.terminer();
  });

  test('aucun travailleur avant le premier calcul ; un seul pour tous les calculs, même lancés ensemble ; chaque promesse reçoit les résumés de sa charge', async () => {
    const { fabrique, crees } = fabriqueCalculante();
    const executeur = creerExecuteurApercu(fabrique);
    assert.equal(crees(), 0);
    const charges = [chargeResumee(6), chargeResumee(9)];
    const recus = await Promise.all(charges.map((charge) => executeur.calculer(charge)));
    assert.deepEqual(recus, charges.map(surLeFil));
    assert.deepEqual(await executeur.calculer(charges[0]), surLeFil(charges[0]));
    assert.equal(crees(), 1);
    executeur.terminer();
  });

  test('le message porte le type, un numéro propre à chaque calcul et la charge ; une réponse se range par son numéro, quel que soit l’ordre', async () => {
    const { fabrique, travailleurs } = fabriqueFactice();
    const executeur = creerExecuteurApercu(fabrique);
    const premier = executeur.calculer({ marque: 'a' });
    const second = executeur.calculer({ marque: 'b' });
    assert.equal(travailleurs.length, 1);
    const [travailleur] = travailleurs;
    assert.deepEqual(
      travailleur.recus.map(({ type, charge }) => ({ type, charge })),
      [
        { type: 'resumer', charge: { marque: 'a' } },
        { type: 'resumer', charge: { marque: 'b' } },
      ],
    );
    const [na, nb] = travailleur.recus.map(({ numero }) => numero);
    assert.notEqual(na, nb);
    travailleur.poster({ type: 'resumes', numero: nb, mesuresDuRetenu: null, meilleureDuClassement: { id: 2 } });
    travailleur.poster({ type: 'resumes', numero: na, mesuresDuRetenu: { collisionsCumulees: 5, rencontresRepetees: 1 }, meilleureDuClassement: null });
    assert.deepEqual(await premier, { mesuresDuRetenu: { collisionsCumulees: 5, rencontresRepetees: 1 }, meilleureDuClassement: null });
    assert.deepEqual(await second, { mesuresDuRetenu: null, meilleureDuClassement: { id: 2 } });
    // Une réponse répétée, d'un numéro inconnu ou d'un autre type ne règle rien
    // ni ne lève.
    travailleur.poster({ type: 'resumes', numero: na, mesuresDuRetenu: null, meilleureDuClassement: null });
    travailleur.poster({ type: 'resumes', numero: 999, mesuresDuRetenu: null, meilleureDuClassement: null });
    travailleur.poster({ type: 'autre', numero: nb });
    assert.equal(travailleur.terminaisons, 0);
    executeur.terminer();
  });

  test('une faute du calcul rejette ce seul calcul par une Error qui porte le message et la pile du travailleur ; le travailleur sert le suivant', async () => {
    const { fabrique, travailleurs } = fabriqueFactice();
    const executeur = creerExecuteurApercu(fabrique);
    const fautif = executeur.calculer({ marque: 'a' });
    const sain = executeur.calculer({ marque: 'b' });
    const [travailleur] = travailleurs;
    const [na, nb] = travailleur.recus.map(({ numero }) => numero);
    travailleur.poster({ type: 'faute', numero: na, message: 'charge inattendue', pile: 'pile du travailleur' });
    await assert.rejects(fautif, (erreur) => {
      assert.ok(erreur instanceof Error);
      assert.equal(erreur.code, undefined);
      assert.match(erreur.message, /charge inattendue/);
      assert.match(erreur.stack, /pile du travailleur/);
      return true;
    });
    assert.equal(await reglee(sain), false);
    travailleur.poster({ type: 'resumes', numero: nb, mesuresDuRetenu: null, meilleureDuClassement: null });
    assert.deepEqual(await sain, { mesuresDuRetenu: null, meilleureDuClassement: null });
    assert.equal(travailleurs.length, 1);
    assert.equal(travailleur.terminaisons, 0);
    executeur.terminer();
  });

  test('le côté travailleur poste la faute d’une charge que les résumés refusent, sous son numéro, sans lever ; il ignore un message d’un autre type', async () => {
    const postes = [];
    const portee = { onmessage: null, postMessage: (message) => postes.push(message) };
    brancherTravailleurApercu(portee);
    assert.doesNotThrow(() => portee.onmessage({ data: { type: 'resumer', numero: 7, charge: null } }));
    assert.equal(postes.length, 1);
    assert.equal(postes[0].type, 'faute');
    assert.equal(postes[0].numero, 7);
    assert.equal(typeof postes[0].message, 'string');
    assert.equal(typeof postes[0].pile, 'string');
    for (const data of [null, 'resumer', { type: 'proposer', numero: 1 }]) portee.onmessage({ data });
    assert.equal(postes.length, 1);
    const charge = chargeResumee();
    portee.onmessage({ data: { type: 'resumer', numero: 8, charge } });
    assert.deepEqual(postes[1], { type: 'resumes', numero: 8, ...surLeFil(chargeResumee()) });
  });

  test('le côté travailleur se branche après celui de la génération, sur la même portée : un message d’un autre type va au gestionnaire d’avant, un message resumer ne lui va pas', () => {
    const postes = [];
    const avant = [];
    const portee = { onmessage: (evenement) => avant.push(evenement.data), postMessage: (message) => postes.push(message) };
    brancherTravailleurApercu(portee);
    const proposer = { type: 'proposer', rang: 1 };
    for (const data of [null, 'resumer', proposer]) portee.onmessage({ data });
    assert.deepEqual(avant, [null, 'resumer', proposer]);
    portee.onmessage({ data: { type: 'resumer', numero: 3, charge: chargeResumee() } });
    assert.equal(avant.length, 3);
    assert.deepEqual(postes, [{ type: 'resumes', numero: 3, ...surLeFil(chargeResumee()) }]);
  });

  test('l’échec du script du travailleur rejette chaque calcul en cours comme une faute, l’événement traité, et termine ce travailleur ; le calcul suivant en fait naître un neuf', async () => {
    const { fabrique, travailleurs } = fabriqueFactice();
    const executeur = creerExecuteurApercu(fabrique);
    const enCours = [executeur.calculer({ marque: 'a' }), executeur.calculer({ marque: 'b' })];
    const [premier] = travailleurs;
    const evenement = premier.echouer();
    assert.equal(evenement.traite, true);
    for (const calcul of enCours) {
      await assert.rejects(calcul, (erreur) => erreur instanceof Error && erreur.code === undefined);
    }
    assert.equal(premier.terminaisons, 1);
    assert.equal(premier.onmessage, null);
    assert.equal(premier.onerror, null);
    const suivant = executeur.calculer({ marque: 'c' });
    assert.equal(travailleurs.length, 2);
    const [, second] = travailleurs;
    second.poster({ type: 'resumes', numero: second.recus[0].numero, mesuresDuRetenu: null, meilleureDuClassement: { id: 1 } });
    assert.deepEqual(await suivant, { mesuresDuRetenu: null, meilleureDuClassement: { id: 1 } });
    executeur.terminer();
  });

  test('une charge que le clonage refuse rejette ce seul calcul ; le travailleur reste', async () => {
    const { fabrique, travailleurs } = fabriqueFactice();
    const executeur = creerExecuteurApercu(fabrique);
    const sain = executeur.calculer({ marque: 'a' });
    const [travailleur] = travailleurs;
    const refus = new Error('clonage refusé');
    travailleur.refuser = refus;
    await assert.rejects(executeur.calculer({ marque: 'b' }), (erreur) => erreur === refus);
    travailleur.refuser = null;
    travailleur.poster({ type: 'resumes', numero: travailleur.recus[0].numero, mesuresDuRetenu: null, meilleureDuClassement: null });
    assert.deepEqual(await sain, { mesuresDuRetenu: null, meilleureDuClassement: null });
    assert.equal(travailleur.terminaisons, 0);
    assert.equal(travailleurs.length, 1);
    executeur.terminer();
  });

  test('terminer() termine le travailleur une fois, sans régler le calcul en cours ; après lui, un calcul rejette sans travailleur neuf ; sans travailleur, il n’en fait naître aucun', async () => {
    const { fabrique, travailleurs } = fabriqueFactice();
    const executeur = creerExecuteurApercu(fabrique);
    const enCours = executeur.calculer({ marque: 'a' });
    const [travailleur] = travailleurs;
    const { numero } = travailleur.recus[0];
    executeur.terminer();
    executeur.terminer();
    assert.equal(travailleur.terminaisons, 1);
    assert.equal(travailleur.onmessage, null);
    assert.equal(travailleur.onerror, null);
    // Un message déjà en file au moment de la terminaison ne parvient pas.
    travailleur.poster({ type: 'resumes', numero, mesuresDuRetenu: null, meilleureDuClassement: null });
    assert.equal(await reglee(enCours), false);
    await assert.rejects(executeur.calculer({ marque: 'b' }), RangeError);
    assert.equal(travailleurs.length, 1);

    const vierge = fabriqueFactice();
    const sansCalcul = creerExecuteurApercu(vierge.fabrique);
    sansCalcul.terminer();
    assert.equal(vierge.travailleurs.length, 0);
  });
});

// --- Le câblage de production (§ 8.1) ------------------------------------------

describe('le câblage de l’exécuteur d’aperçu dans src/main.js (§ 8.1)', () => {
  // La source de src/main.js, lue par le disque : le module touche le
  // navigateur et ne s'importe pas sous node.
  const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8');

  test('src/main.js passe à App, en executeurApercu, un exécuteur dont la fabrique rend le travailleur de la génération, importé une seule fois, et un seul', () => {
    const importations = [...source.matchAll(/^import\s+(\w+)\s+from\s+'([^']+)';$/gm)];
    const travailleurs = importations.filter(([, , specificateur]) => specificateur.endsWith('?worker&inline'));
    assert.deepEqual(
      travailleurs.map(([, , specificateur]) => specificateur),
      ['./interface/generation/travailleur.js?worker&inline'],
      'un seul travailleur inclus dans la page, celui de la génération',
    );
    const [[, nom]] = travailleurs;
    const appels = [...source.matchAll(/creerExecuteurApercu\(/g)];
    assert.equal(appels.length, 1, 'un seul exécuteur d’aperçu');
    assert.match(source, new RegExp(`\\bexecuteurApercu:\\s*creerExecuteurApercu\\(\\s*\\(\\)\\s*=>\\s*new\\s+${nom}\\(\\s*\\)\\s*\\),`));
  });
});
