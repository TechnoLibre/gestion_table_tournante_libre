// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de l'exécuteur du solveur (§ 5.6, § 5.10) : creerExecuteurSolveur
// sur une fabrique de travailleurs factices et l'horloge pilotée. Un
// travailleur factice garde chaque message reçu, cloné comme le navigateur
// le clone, et compte ses terminate() ; l'épreuve lui fait poster les
// messages du protocole de solveur_travailleur.js par son onmessage. Les
// données des tours sont réduites à leur numéro : l'exécuteur ne lit rien
// d'autre.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { creerHorlogePilotee } from '../../application/horloge.js';
import { LIMITE_PAR_TOUR } from '../../application/planchers_exacts.js';
import { creerExecuteurSolveur, delaiDuFilet } from './executeur_solveur.js';

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

// Trois tours, réduits à leur numéro ; une issue exacte de minimum donné.
const TOURS = [{ r: 0 }, { r: 1 }, { r: 2 }];
const issue = (minimum) => ({ faisable: true, minimum, auMoins: null, cause: null, duree: 1, cache: false });

// L'issue d'une promesse, sans l'attendre : réglée ou non, sa valeur ou son
// erreur.
function suivre(promesse) {
  const etat = { regle: false, valeur: undefined, erreur: undefined };
  promesse.then(
    (valeur) => Object.assign(etat, { regle: true, valeur }),
    (erreur) => Object.assign(etat, { regle: true, erreur }),
  );
  return etat;
}

// Laisse passer les réactions des promesses déjà réglées.
const attendreReactions = () => new Promise((fin) => setImmediate(fin));

function monter(options = {}) {
  const { fabrique, travailleurs } = fabriqueFactice();
  const horloge = creerHorlogePilotee();
  const executeur = creerExecuteurSolveur(fabrique, { urlWasm: 'blob:solveur/highs.wasm', horloge, ...options });
  return { executeur, travailleurs, horloge };
}

describe('creerExecuteurSolveur : le protocole', () => {
  test('aucun travailleur avant le premier calcul ; le calcul poste les tours, l’adresse du wasm et la limite par tour', () => {
    const { executeur, travailleurs } = monter();
    assert.equal(travailleurs.length, 0);
    executeur.resoudre(TOURS);
    assert.equal(travailleurs.length, 1);
    assert.deepEqual(travailleurs[0].recus, [
      { type: 'resoudre', numero: 1, urlWasm: 'blob:solveur/highs.wasm', tours: TOURS, limite: LIMITE_PAR_TOUR },
    ]);
  });

  test('chaque tour avance surTour, dans l’ordre, et fini rend les issues ; le travailleur sert le calcul suivant', async () => {
    const { executeur, travailleurs } = monter();
    const vus = [];
    const suivi = suivre(executeur.resoudre(TOURS, { surTour: (faits, lue) => vus.push([faits, lue.minimum]) }));
    const [travailleur] = travailleurs;
    travailleur.poster({ type: 'tour', numero: 1, r: 0, issue: issue(11) });
    travailleur.poster({ type: 'tour', numero: 1, r: 1, issue: issue(10) });
    assert.deepEqual(vus, [[1, 11], [2, 10]]);
    travailleur.poster({ type: 'tour', numero: 1, r: 2, issue: issue(12) });
    travailleur.poster({ type: 'fini', numero: 1 });
    await attendreReactions();
    assert.deepEqual(suivi.valeur, [issue(11), issue(10), issue(12)]);
    assert.equal(travailleur.terminaisons, 0);

    const second = suivre(executeur.resoudre([{ r: 0 }]));
    assert.equal(travailleurs.length, 1);
    assert.equal(travailleur.recus.at(-1).numero, 2);
    travailleur.poster({ type: 'tour', numero: 2, r: 0, issue: issue(4) });
    travailleur.poster({ type: 'fini', numero: 2 });
    await attendreReactions();
    assert.deepEqual(second.valeur, [issue(4)]);
  });

  test('un message d’un autre calcul, d’un autre type ou sans forme est ignoré', async () => {
    const { executeur, travailleurs } = monter();
    const suivi = suivre(executeur.resoudre([{ r: 0 }]));
    const [travailleur] = travailleurs;
    for (const data of [null, 7, 'fini', { type: 'fini', numero: 9 }, { type: 'tour', numero: 9, r: 0, issue: issue(1) }, { type: 'autre', numero: 1 }]) {
      travailleur.poster(data);
    }
    await attendreReactions();
    assert.equal(suivi.regle, false);
    travailleur.poster({ type: 'tour', numero: 1, r: 0, issue: issue(3) });
    travailleur.poster({ type: 'fini', numero: 1 });
    await attendreReactions();
    assert.deepEqual(suivi.valeur, [issue(3)]);
  });

  test('un tour hors de son rang, ou fini avant le dernier tour, rejette par une faute de calcul et termine le travailleur', async () => {
    for (const messages of [
      [{ type: 'tour', numero: 1, r: 1, issue: issue(1) }],
      [{ type: 'tour', numero: 1, r: 0, issue: issue(1) }, { type: 'fini', numero: 1 }],
    ]) {
      const { executeur, travailleurs } = monter();
      const suivi = suivre(executeur.resoudre(TOURS.slice(0, 2)));
      for (const data of messages) travailleurs[0].poster(data);
      await attendreReactions();
      assert.equal(suivi.erreur?.etape, 'calcul', JSON.stringify(messages));
      assert.equal(travailleurs[0].terminaisons, 1);
    }
  });

  test('aucun tour : le calcul rend [] sans faire naître de travailleur', async () => {
    const { executeur, travailleurs } = monter();
    assert.deepEqual(await executeur.resoudre([]), []);
    assert.equal(travailleurs.length, 0);
  });
});

describe('creerExecuteurSolveur : supersession et annulation', () => {
  test('un calcul demandé pendant un autre termine le travailleur, rejette l’ancien par une AbortError et fait naître un travailleur neuf', async () => {
    const { executeur, travailleurs } = monter();
    const premier = suivre(executeur.resoudre(TOURS));
    travailleurs[0].poster({ type: 'tour', numero: 1, r: 0, issue: issue(11) });
    const second = suivre(executeur.resoudre([{ r: 0 }]));
    await attendreReactions();
    assert.equal(premier.erreur instanceof DOMException, true);
    assert.equal(premier.erreur.name, 'AbortError');
    assert.equal(travailleurs[0].terminaisons, 1);
    assert.equal(travailleurs[0].onmessage, null);
    assert.equal(travailleurs.length, 2);
    assert.equal(travailleurs[1].recus[0].numero, 2);
    // L'ancien travailleur ne remet plus rien, même un message en file.
    travailleurs[0].poster({ type: 'fini', numero: 1 });
    travailleurs[1].poster({ type: 'tour', numero: 2, r: 0, issue: issue(5) });
    travailleurs[1].poster({ type: 'fini', numero: 2 });
    await attendreReactions();
    assert.deepEqual(second.valeur, [issue(5)]);
  });

  test('annuler termine le travailleur du calcul en cours et le rejette par une AbortError ; le calcul suivant fait naître un travailleur neuf', async () => {
    const { executeur, travailleurs } = monter();
    assert.equal(executeur.annuler(), false);
    const premier = suivre(executeur.resoudre(TOURS));
    assert.equal(executeur.annuler(), true);
    await attendreReactions();
    assert.equal(premier.erreur.name, 'AbortError');
    assert.equal(travailleurs[0].terminaisons, 1);
    assert.equal(executeur.annuler(), false);
    executeur.resoudre(TOURS);
    assert.equal(travailleurs.length, 2);
  });

  test('après terminer, le calcul en cours est rejeté par une AbortError, et resoudre rejette par une RangeError', async () => {
    const { executeur, travailleurs } = monter();
    const premier = suivre(executeur.resoudre(TOURS));
    executeur.terminer();
    executeur.terminer();
    await attendreReactions();
    assert.equal(premier.erreur.name, 'AbortError');
    assert.equal(travailleurs[0].terminaisons, 1);
    await assert.rejects(executeur.resoudre(TOURS), RangeError);
    assert.equal(travailleurs.length, 1);
  });
});

describe('creerExecuteurSolveur : les fautes', () => {
  test('une faute rejette par une Error qui garde son étape, son message et sa pile, et termine le travailleur ; le calcul suivant en fait naître un neuf', async () => {
    for (const etape of ['chargement', 'calcul']) {
      const { executeur, travailleurs } = monter();
      const suivi = suivre(executeur.resoudre(TOURS));
      travailleurs[0].poster({ type: 'faute', numero: 1, etape, message: 'wasm refusé', pile: 'pile du travailleur' });
      await attendreReactions();
      assert.equal(suivi.erreur instanceof Error, true);
      assert.equal(suivi.erreur.etape, etape);
      assert.match(suivi.erreur.message, /wasm refusé/);
      assert.match(suivi.erreur.stack, /pile du travailleur/);
      assert.equal(travailleurs[0].terminaisons, 1);
      executeur.resoudre(TOURS);
      assert.equal(travailleurs.length, 2);
    }
  });

  test('l’échec du script du travailleur rejette par une faute de chargement, l’événement traité', async () => {
    const { executeur, travailleurs } = monter();
    const suivi = suivre(executeur.resoudre(TOURS));
    const evenement = travailleurs[0].echouer();
    await attendreReactions();
    assert.equal(evenement.traite, true);
    assert.equal(suivi.erreur.etape, 'chargement');
    assert.equal(travailleurs[0].terminaisons, 1);
  });

  test('un postMessage qui lève rejette le calcul par son erreur', async () => {
    const { fabrique, travailleurs } = fabriqueFactice();
    const refus = new Error('clonage refusé');
    const avecRefus = creerExecuteurSolveur(
      () => {
        const travailleur = fabrique();
        travailleur.refuser = refus;
        return travailleur;
      },
      { urlWasm: 'x', horloge: creerHorlogePilotee() },
    );
    await assert.rejects(avecRefus.resoudre(TOURS), (erreur) => erreur === refus);
    assert.equal(travailleurs.length, 1);
    assert.equal(travailleurs[0].terminaisons, 0);
  });
});

describe('creerExecuteurSolveur : le filet', () => {
  test('le filet vaut deux limites et cinq secondes : sans message pendant ce délai, le calcul rejette par une faute du filet et le travailleur est terminé', async () => {
    assert.equal(delaiDuFilet(30), 65_000);
    assert.equal(delaiDuFilet(LIMITE_PAR_TOUR), 2 * LIMITE_PAR_TOUR * 1000 + 5000);
    const { executeur, travailleurs, horloge } = monter({ limiteParTour: 1 });
    const suivi = suivre(executeur.resoudre(TOURS));
    horloge.avancer(6999);
    await attendreReactions();
    assert.equal(suivi.regle, false);
    horloge.avancer(1);
    await attendreReactions();
    assert.equal(suivi.erreur?.etape, 'filet');
    assert.equal(travailleurs[0].terminaisons, 1);
  });

  test('chaque message du travailleur réarme le filet : un calcul dont chaque tour arrive sous le délai n’est jamais tué', async () => {
    const { executeur, travailleurs, horloge } = monter({ limiteParTour: 1 });
    const suivi = suivre(executeur.resoudre(TOURS));
    for (const r of [0, 1, 2]) {
      horloge.avancer(6000);
      travailleurs[0].poster({ type: 'tour', numero: 1, r, issue: issue(r) });
    }
    horloge.avancer(6000);
    travailleurs[0].poster({ type: 'fini', numero: 1 });
    // Réglé, le calcul ne laisse aucune minuterie armée.
    horloge.avancer(60_000);
    await attendreReactions();
    assert.deepEqual(suivi.valeur, [issue(0), issue(1), issue(2)]);
    assert.equal(travailleurs[0].terminaisons, 0);
  });

  test('un calcul remplacé, annulé ou en faute désarme son filet', async () => {
    const { executeur, travailleurs, horloge } = monter({ limiteParTour: 1 });
    suivre(executeur.resoudre(TOURS));
    const second = suivre(executeur.resoudre(TOURS));
    horloge.avancer(6000);
    travailleurs[1].poster({ type: 'tour', numero: 2, r: 0, issue: issue(0) });
    horloge.avancer(6000);
    await attendreReactions();
    assert.equal(second.regle, false);
    executeur.annuler();
    horloge.avancer(60_000);
    assert.equal(travailleurs[1].terminaisons, 1);
    // En faute, le calcul garde l'étape de sa faute : le filet échu ensuite
    // ne le rejette pas une seconde fois et ne termine rien de plus.
    const troisieme = suivre(executeur.resoudre(TOURS));
    travailleurs[2].poster({ type: 'faute', numero: 3, etape: 'calcul', message: 'modèle refusé', pile: '' });
    horloge.avancer(60_000);
    await attendreReactions();
    assert.equal(troisieme.erreur.etape, 'calcul');
    assert.equal(travailleurs[2].terminaisons, 1);
    assert.equal(travailleurs.length, 3);
  });
});
