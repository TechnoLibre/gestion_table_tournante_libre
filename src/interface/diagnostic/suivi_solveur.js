// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le suivi du plancher exact dans l'interface (§ 5.6, § 5.10) : un magasin
// lisible au contrat de la séance — subscribe(fn) appelle fn tout de suite
// puis à chaque changement, et rend la fonction qui désabonne —, que App
// pose au contexte sous la clé 'solveur' et que le Diagnostic lit.
//
// demander(charge), que App appelle à chaque charge de l'état observable :
// la clé de ses entrées (entreesDuSolveur) ne change que si le modèle
// change — ni un plan, ni une proposition, ni un nom ne la touchent. Même
// clé que la dernière demandée : rien. Autre clé : le calcul en cours
// s'interrompt, et le nouveau part après le délai, DELAI_SOLVEUR_MS, qu'une
// autre demande réarme ; une saisie qui change le modèle à chaque frappe ne
// lance que le dernier. L'exécuteur se charge au premier calcul, par
// chargerExecuteur, qu'un import différé porte. Une charge null ne fait
// rien ; une charge sans entrées — configuration refusée, places qui
// manquent, séparation décochée — interrompt le calcul et oublie la clé.
//
// pour(charge) rend l'état de cette charge seulement — { etat, exacts,
// faits, total, tour }, tour étant celui qui se résout, à partir de 1 et
// borné au dernier, 0 sans tour —, jamais celui d'une autre configuration :
// 'absent' sans
// clé, pendant le délai ou pour une clé qui n'est pas la dernière demandée ;
// 'enCours', faits tours résolus sur total ; 'pret', exacts portant les
// planchers assemblés (assemblerPlanchers) ; 'annule' après annuler() ;
// 'indisponible' après une faute. Les entrées d'une charge se gardent par
// son identité (WeakMap) : la charge figée de la séance ne se relit pas.
//
// annuler() interrompt le calcul en cours, ou le délai, et l'état passe à
// 'annule' : la même clé ne relance rien tant que le modèle ne change pas.
//
// Les fautes. Un échec de CHARGEMENT — l'import différé rejeté, ou une faute
// d'étape 'chargement' — rend le solveur indisponible pour toute la séance :
// l'erreur va une fois à signaler, et aucune clé neuve ne relance, ce qui
// rechargerait le wasm et signalerait la même erreur à chaque frappe sur une
// plateforme qui le refuse. Une faute de CALCUL, ou le filet, rend
// indisponible cette clé seule, signalée ; une autre clé relance. Une
// AbortError — un calcul remplacé ou annulé — ne change rien. Le délai
// passe par l'horloge injectée (§ 19.4).
import { assemblerPlanchers, entreesDuSolveur } from '../../application/planchers_exacts.js';

/** Le délai entre une charge qui change le modèle et le calcul, en ms. */
export const DELAI_SOLVEUR_MS = 400;

const ABSENT = Object.freeze({ etat: 'absent', exacts: null, faits: 0, total: 0, tour: 0 });

// Le tour qui se résout, à partir de 1, borné au dernier ; 0 sans tour.
const tourDe = (faits, total) => Math.min(faits + 1, total);

/**
 * Le suivi du solveur.
 *
 * @param {() => Promise<{resoudre: Function, annuler: () => boolean, terminer: () => void}>} chargerExecuteur
 *   rend l'exécuteur du solveur (executeur_solveur.js), appelé au premier
 *   calcul seulement
 * @param {{horloge: import('../../application/horloge.js').Horloge, delai?: number,
 *   signaler?: (erreur: unknown) => void}} options
 *   horloge, celle du délai ; delai, DELAI_SOLVEUR_MS par défaut ; signaler,
 *   qui reçoit chaque faute (reportError dans la page)
 * @returns {{subscribe: (fn: (etat: Object) => void) => () => void, demander: (charge: Object|null) => void,
 *   pour: (charge: Object|null) => {etat: string, exacts: Object|null, faits: number, total: number, tour: number},
 *   annuler: () => void, terminer: () => void}}
 */
export function creerSuiviSolveur(chargerExecuteur, { horloge, delai = DELAI_SOLVEUR_MS, signaler = () => {} }) {
  const abonnes = new Set();
  const entrees = new WeakMap();
  // courant : la dernière clé demandée et son état — 'attente' pendant le
  // délai, puis 'enCours', 'pret', 'annule' ou 'indisponible' —, ou une clé
  // null.
  let courant = Object.freeze({ cle: null, etat: 'absent', exacts: null, faits: 0, total: 0 });
  let minuterie = null;
  let chargement = null;
  let executeur = null;
  let horsService = false;
  let termine = false;

  function publier(champs) {
    courant = Object.freeze({ ...courant, ...champs });
    for (const fn of [...abonnes]) fn(courant);
  }

  function entreesDe(charge) {
    if (!entrees.has(charge)) entrees.set(charge, entreesDuSolveur(charge));
    return entrees.get(charge);
  }

  // Le délai désarmé et le calcul en cours interrompu, s'il y en a un.
  function interrompre() {
    if (minuterie !== null) horloge.annuler(minuterie);
    minuterie = null;
    if (courant.etat === 'enCours') executeur?.annuler();
  }

  // Le chargement unique de l'exécuteur.
  function charger() {
    chargement ??= Promise.resolve()
      .then(chargerExecuteur)
      .then((charge) => {
        executeur = charge;
        return charge;
      });
    return chargement;
  }

  // Le solveur indisponible pour la séance : l'erreur signalée, l'exécuteur
  // terminé.
  function perdre(erreur) {
    horsService = true;
    signaler(erreur);
    executeur?.terminer();
    publier({ etat: 'indisponible', exacts: null });
  }

  // Vrai tant que le calcul de cle reste celui qu'on attend.
  const attendu = (cle) => !termine && !horsService && courant.cle === cle && courant.etat === 'enCours';

  async function lancer({ cle, tours }) {
    publier({ etat: 'enCours', faits: 0 });
    let charge;
    try {
      charge = await charger();
    } catch (erreur) {
      if (!termine && !horsService) perdre(erreur);
      return;
    }
    if (!attendu(cle)) return;
    try {
      const issues = await charge.resoudre(tours, {
        surTour: (faits) => {
          if (attendu(cle)) publier({ faits });
        },
      });
      if (attendu(cle)) publier({ etat: 'pret', exacts: assemblerPlanchers(tours, issues), faits: tours.length });
    } catch (erreur) {
      if (erreur?.name === 'AbortError' || termine || horsService) return;
      if (erreur?.etape === 'chargement') {
        perdre(erreur);
        return;
      }
      signaler(erreur);
      if (courant.cle === cle) publier({ etat: 'indisponible', exacts: null });
    }
  }

  return {
    subscribe(fn) {
      abonnes.add(fn);
      fn(courant);
      return () => {
        abonnes.delete(fn);
      };
    },
    demander(charge) {
      if (termine || horsService || charge === null) return;
      const lues = entreesDe(charge);
      if (lues === null) {
        interrompre();
        if (courant.cle !== null) publier({ cle: null, etat: 'absent', exacts: null, faits: 0, total: 0 });
        return;
      }
      if (lues.cle === courant.cle) return;
      interrompre();
      publier({ cle: lues.cle, etat: 'attente', exacts: null, faits: 0, total: lues.tours.length });
      minuterie = horloge.planifier(() => {
        minuterie = null;
        lancer(lues);
      }, delai);
    },
    pour(charge) {
      if (charge === null) return ABSENT;
      const lues = entreesDe(charge);
      if (lues === null) return ABSENT;
      if (horsService) return { etat: 'indisponible', exacts: null, faits: 0, total: lues.tours.length, tour: tourDe(0, lues.tours.length) };
      if (lues.cle !== courant.cle || courant.etat === 'attente') return ABSENT;
      const { etat, exacts, faits, total } = courant;
      return { etat, exacts, faits, total, tour: tourDe(faits, total) };
    },
    annuler() {
      if (courant.etat !== 'attente' && courant.etat !== 'enCours') return;
      interrompre();
      publier({ etat: 'annule', exacts: null });
    },
    terminer() {
      if (termine) return;
      termine = true;
      if (minuterie !== null) horloge.annuler(minuterie);
      minuterie = null;
      executeur?.terminer();
    },
  };
}
