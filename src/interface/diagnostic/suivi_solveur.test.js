// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du suivi du solveur (§ 5.6, § 5.10) : creerSuiviSolveur sur un
// exécuteur factice et l'horloge pilotée. L'exécuteur factice garde chaque
// calcul demandé — ses tours, son surTour, et de quoi le régler —, et
// compte ses annulations et sa terminaison ; l'épreuve règle elle-même
// chaque calcul. Les charges se construisent ici, sur des noms inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { creerHorlogePilotee } from '../../application/horloge.js';
import { assemblerPlanchers, entreesDuSolveur } from '../../application/planchers_exacts.js';
import { creerCharge } from '../../stockage/document.js';
import { DELAI_SOLVEUR_MS, creerSuiviSolveur } from './suivi_solveur.js';

const MERLES = 'Club des Merles';
const HERONS = 'Cercle des Hérons';

// Six membres du Club, qui nomme le Cercle, quatre membres ; tables de
// capacités données ; tours tours.
function chargeDe({ capacites = [4, 4, 4], tours = 3, separer = true } = {}) {
  const charge = creerCharge({ id: 'evt-suivi', nom: 'Soirée des Grèbes', siegesParDefaut: 8, tours });
  charge.participants = [...Array(6).fill(MERLES), ...Array(4).fill(HERONS)].map((organisation, rang) => ({
    id: rang + 1,
    nom: `Grèbe${rang + 1}`,
    prenom: 'Iris',
    organisation,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  charge.participants[0].conflits = [HERONS];
  charge.tables = capacites.map((sieges, t) => ({ id: t + 1, numero: t + 1, sieges, forme: 'ronde', position: { x: 300 * t, y: 0 } }));
  charge.reglages.separerOrganisations = separer;
  charge.prochainsIds = { participant: 11, table: capacites.length + 1, proposition: 1 };
  return charge;
}

// La même configuration sous une autre identité, un nom changé : sa clé est
// la même.
const renommee = (charge) => ({ ...structuredClone(charge), evenement: { ...charge.evenement, nom: 'Soirée renommée' } });

const issue = (minimum) => ({ faisable: true, minimum, auMoins: null, cause: null, duree: 1, cache: false });

// Un exécuteur factice : calculs, les calculs demandés, chacun {tours,
// surTour, rendre(issues), rejeter(erreur)} ; annulations et terminaisons,
// leurs comptes. Annuler ou remplacer un calcul le rejette par une
// AbortError, comme le vrai.
function executeurFactice() {
  const calculs = [];
  const executeur = {
    calculs,
    annulations: 0,
    terminaisons: 0,
    resoudre(tours, { surTour } = {}) {
      return new Promise((rendre, rejeter) => {
        calculs.push({ tours, surTour, rendre, rejeter });
      });
    },
    annuler() {
      executeur.annulations += 1;
      calculs.at(-1)?.rejeter(new DOMException('annulé', 'AbortError'));
      return true;
    },
    terminer() {
      executeur.terminaisons += 1;
    },
  };
  return executeur;
}

const attendreReactions = () => new Promise((fin) => setImmediate(fin));

// Le suivi monté : chargements, le compte des appels du chargeur ; signalees,
// les erreurs signalées ; publies, les états publiés depuis l'abonnement.
function monter({ charger } = {}) {
  const horloge = creerHorlogePilotee();
  const executeur = executeurFactice();
  const signalees = [];
  const compte = { chargements: 0 };
  const suivi = creerSuiviSolveur(
    async () => {
      compte.chargements += 1;
      return charger === undefined ? executeur : charger();
    },
    { horloge, signaler: (erreur) => signalees.push(erreur) },
  );
  const publies = [];
  suivi.subscribe((etat) => publies.push(etat));
  return { suivi, horloge, executeur, signalees, compte, publies };
}

const etatDe = (suivi, charge) => {
  const { etat, faits, total, tour } = suivi.pour(charge);
  return { etat, faits, total, tour };
};

describe('creerSuiviSolveur : le délai et la clé', () => {
  test('rien avant le délai de 400 ms ; puis l’exécuteur se charge une fois, le calcul part, faits avance à chaque tour, et pret porte les planchers assemblés', async () => {
    assert.equal(DELAI_SOLVEUR_MS, 400);
    const { suivi, horloge, executeur, compte } = monter();
    const charge = chargeDe();
    assert.deepEqual(etatDe(suivi, charge), { etat: 'absent', faits: 0, total: 0, tour: 0 });
    suivi.demander(charge);
    horloge.avancer(399);
    await attendreReactions();
    assert.equal(compte.chargements, 0);
    assert.equal(suivi.pour(charge).etat, 'absent');
    horloge.avancer(1);
    await attendreReactions();
    assert.equal(compte.chargements, 1);
    assert.deepEqual(etatDe(suivi, charge), { etat: 'enCours', faits: 0, total: 3, tour: 1 });
    const [calcul] = executeur.calculs;
    assert.deepEqual(calcul.tours, entreesDuSolveur(charge).tours);
    calcul.surTour(1, issue(2));
    assert.deepEqual(etatDe(suivi, charge), { etat: 'enCours', faits: 1, total: 3, tour: 2 });
    calcul.surTour(3, issue(2));
    assert.equal(suivi.pour(charge).tour, 3);
    const issues = [issue(2), issue(2), issue(2)];
    calcul.rendre(issues);
    await attendreReactions();
    assert.deepEqual(suivi.pour(charge), { etat: 'pret', exacts: assemblerPlanchers(calcul.tours, issues), faits: 3, total: 3, tour: 3 });
  });

  test('une charge de même clé ne relance rien ; une autre clé relance après le délai, en remplaçant le calcul en cours ; l’ancienne clé ne s’affiche plus', async () => {
    const { suivi, horloge, executeur } = monter();
    const charge = chargeDe();
    suivi.demander(charge);
    horloge.avancer(400);
    await attendreReactions();
    suivi.demander(renommee(charge));
    horloge.avancer(10_000);
    await attendreReactions();
    assert.equal(executeur.calculs.length, 1);
    assert.equal(suivi.pour(renommee(charge)).etat, 'enCours');

    const autre = chargeDe({ capacites: [4, 4, 4, 4] });
    suivi.demander(autre);
    assert.equal(executeur.annulations, 1);
    assert.equal(suivi.pour(charge).etat, 'absent');
    horloge.avancer(400);
    await attendreReactions();
    assert.equal(executeur.calculs.length, 2);
    // Le calcul remplacé ne pose rien, même réglé après coup.
    executeur.calculs[0].rendre([issue(9), issue(9), issue(9)]);
    await attendreReactions();
    assert.equal(suivi.pour(autre).etat, 'enCours');
    assert.equal(suivi.pour(charge).etat, 'absent');
  });

  test('deux charges dans le délai : seul le dernier modèle se calcule', async () => {
    const { suivi, horloge, executeur } = monter();
    suivi.demander(chargeDe());
    horloge.avancer(200);
    const derniere = chargeDe({ capacites: [5, 5, 5] });
    suivi.demander(derniere);
    horloge.avancer(399);
    await attendreReactions();
    assert.equal(executeur.calculs.length, 0);
    horloge.avancer(1);
    await attendreReactions();
    assert.equal(executeur.calculs.length, 1);
    assert.deepEqual(executeur.calculs[0].tours, entreesDuSolveur(derniere).tours);
  });

  test('demander(null) ne fait rien ; une charge sans entrées — séparation décochée — arrête le calcul et vaut absent', async () => {
    const { suivi, horloge, executeur } = monter();
    suivi.demander(null);
    assert.equal(suivi.pour(null).etat, 'absent');
    const charge = chargeDe();
    suivi.demander(charge);
    horloge.avancer(400);
    await attendreReactions();
    suivi.demander(null);
    assert.equal(suivi.pour(charge).etat, 'enCours');
    const decochee = chargeDe({ separer: false });
    suivi.demander(decochee);
    assert.equal(executeur.annulations, 1);
    assert.equal(suivi.pour(decochee).etat, 'absent');
    assert.equal(suivi.pour(charge).etat, 'absent');
    // Recochée, la même clé se calcule de nouveau.
    suivi.demander(charge);
    horloge.avancer(400);
    await attendreReactions();
    assert.equal(executeur.calculs.length, 2);
  });

  test('le magasin publie chaque changement d’état, et rend la fonction qui désabonne', async () => {
    const { suivi, horloge, publies } = monter();
    assert.equal(publies.length, 1);
    const recus = [];
    const desabonner = suivi.subscribe((etat) => recus.push(etat));
    assert.equal(recus.length, 1);
    desabonner();
    suivi.demander(chargeDe());
    horloge.avancer(400);
    await attendreReactions();
    assert.equal(recus.length, 1);
    assert.ok(publies.length >= 3, `${publies.length} états publiés`);
  });
});

describe('creerSuiviSolveur : l’annulation', () => {
  test('annuler termine le calcul en cours, l’état passe à annule, et la même clé ne relance rien ; une autre clé relance', async () => {
    const { suivi, horloge, executeur } = monter();
    const charge = chargeDe();
    suivi.demander(charge);
    horloge.avancer(400);
    await attendreReactions();
    suivi.annuler();
    await attendreReactions();
    assert.equal(executeur.annulations, 1);
    assert.deepEqual(suivi.pour(charge), { etat: 'annule', exacts: null, faits: 0, total: 3, tour: 1 });
    suivi.demander(renommee(charge));
    horloge.avancer(10_000);
    await attendreReactions();
    assert.equal(executeur.calculs.length, 1);
    assert.equal(suivi.pour(charge).etat, 'annule');
    const autre = chargeDe({ capacites: [4, 4, 4, 4] });
    suivi.demander(autre);
    horloge.avancer(400);
    await attendreReactions();
    assert.equal(executeur.calculs.length, 2);
    assert.equal(suivi.pour(autre).etat, 'enCours');
  });

  test('annuler pendant le délai empêche le calcul de partir ; sans calcul ni délai, annuler ne fait rien', async () => {
    const { suivi, horloge, executeur, compte } = monter();
    suivi.annuler();
    const charge = chargeDe();
    suivi.demander(charge);
    suivi.annuler();
    horloge.avancer(10_000);
    await attendreReactions();
    assert.equal(compte.chargements, 0);
    assert.equal(executeur.calculs.length, 0);
    assert.equal(suivi.pour(charge).etat, 'annule');
  });

  test('annuler pendant le chargement de l’exécuteur : aucun calcul ne part', async () => {
    let liberer;
    const attente = new Promise((fin) => {
      liberer = fin;
    });
    const executeur = executeurFactice();
    const { suivi, horloge } = monter({ charger: () => attente.then(() => executeur) });
    const charge = chargeDe();
    suivi.demander(charge);
    horloge.avancer(400);
    await attendreReactions();
    suivi.annuler();
    liberer();
    await attendreReactions();
    assert.equal(executeur.calculs.length, 0);
    assert.equal(suivi.pour(charge).etat, 'annule');
  });
});

describe('creerSuiviSolveur : les échecs', () => {
  test('un import différé rejeté : indisponible pour toute la séance, signalé une fois, et aucune clé neuve ne relance', async () => {
    const refus = new Error('morceau du solveur introuvable');
    const { suivi, horloge, signalees, compte } = monter({ charger: () => Promise.reject(refus) });
    const charge = chargeDe();
    suivi.demander(charge);
    horloge.avancer(400);
    await attendreReactions();
    assert.equal(suivi.pour(charge).etat, 'indisponible');
    assert.deepEqual(signalees, [refus]);
    const autre = chargeDe({ capacites: [4, 4, 4, 4] });
    suivi.demander(autre);
    horloge.avancer(400);
    await attendreReactions();
    assert.equal(compte.chargements, 1);
    assert.equal(suivi.pour(autre).etat, 'indisponible');
    assert.deepEqual(signalees, [refus]);
  });

  test('une faute de chargement du travailleur : indisponible pour la séance, l’exécuteur terminé, aucune relance', async () => {
    const { suivi, horloge, executeur, signalees } = monter();
    suivi.demander(chargeDe());
    horloge.avancer(400);
    await attendreReactions();
    const faute = Object.assign(new Error('wasm refusé'), { etape: 'chargement' });
    executeur.calculs[0].rejeter(faute);
    await attendreReactions();
    assert.deepEqual(signalees, [faute]);
    assert.equal(executeur.terminaisons, 1);
    const autre = chargeDe({ capacites: [4, 4, 4, 4] });
    suivi.demander(autre);
    horloge.avancer(400);
    await attendreReactions();
    assert.equal(executeur.calculs.length, 1);
    assert.equal(suivi.pour(autre).etat, 'indisponible');
  });

  test('une faute de calcul ou du filet : indisponible pour cette clé seule, signalée ; une autre clé relance', async () => {
    for (const etape of ['calcul', 'filet']) {
      const { suivi, horloge, executeur, signalees } = monter();
      const charge = chargeDe();
      suivi.demander(charge);
      horloge.avancer(400);
      await attendreReactions();
      const faute = Object.assign(new Error('abandon'), { etape });
      executeur.calculs[0].rejeter(faute);
      await attendreReactions();
      assert.equal(suivi.pour(charge).etat, 'indisponible', etape);
      assert.deepEqual(signalees, [faute]);
      suivi.demander(renommee(charge));
      horloge.avancer(400);
      await attendreReactions();
      assert.equal(executeur.calculs.length, 1, etape);
      const autre = chargeDe({ capacites: [4, 4, 4, 4] });
      suivi.demander(autre);
      horloge.avancer(400);
      await attendreReactions();
      assert.equal(executeur.calculs.length, 2, etape);
      assert.equal(suivi.pour(autre).etat, 'enCours', etape);
    }
  });

  test('une AbortError ne change rien et ne se signale pas', async () => {
    const { suivi, horloge, executeur, signalees } = monter();
    const charge = chargeDe();
    suivi.demander(charge);
    horloge.avancer(400);
    await attendreReactions();
    executeur.calculs[0].rejeter(new DOMException('remplacé', 'AbortError'));
    await attendreReactions();
    assert.deepEqual(signalees, []);
    assert.equal(suivi.pour(charge).etat, 'enCours');
  });

  test('terminer désarme le délai et termine l’exécuteur chargé ; ensuite, demander ne fait rien', async () => {
    const { suivi, horloge, executeur, compte } = monter();
    suivi.demander(chargeDe());
    horloge.avancer(400);
    await attendreReactions();
    suivi.demander(chargeDe({ capacites: [4, 4, 4, 4] }));
    suivi.terminer();
    assert.equal(executeur.terminaisons, 1);
    horloge.avancer(10_000);
    suivi.demander(chargeDe({ capacites: [5, 5, 5] }));
    horloge.avancer(10_000);
    await attendreReactions();
    assert.equal(compte.chargements, 1);
    assert.equal(executeur.calculs.length, 1);
  });
});
