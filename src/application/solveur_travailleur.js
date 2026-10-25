// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le côté travailleur du plancher exact (§ 5.6) : chaque tour, résolu par
// HiGHS sur le texte LP de modele_tour.js. C'est le seul module de src/ qui
// importe highs (§ 13.4) ; il ne s'exécute que dans un travailleur à part,
// dont la résolution, synchrone, bloquerait sinon le fil qui la porte.
//
//   → { type: 'resoudre', numero, urlWasm, tours, limite }
//                                  tours : les DonneesTour (planchers_exacts.js,
//                                  entreesDuSolveur) ; limite : secondes par
//                                  résolution, LIMITE_PAR_TOUR sans elle
//   ← { type: 'tour', numero, r, issue }   une IssueTour par tour, dans
//                                  l'ordre, dès qu'il est résolu : l'interface
//                                  dit « tour k sur R »
//   ← { type: 'fini', numero }
//   ← { type: 'faute', numero, etape: 'chargement'|'calcul', message, pile }
//
// Une seule résolution par tour, en mode AC : une infaisabilité y vaut (A)
// faux. Quand elle s'arrête à sa limite sans aucun placement, une résolution
// en mode A, sous la même limite, tranche la faisabilité ; si elle s'arrête
// aussi, faisable vaut null. minimum et auMoins portent la constante du tour.
//
// HiGHS se charge au premier message et l'instance se garde. Un chargement
// raté se dit en faute d'étape 'chargement', et le message suivant recharge.
// Une erreur de calcul peut passer par l'abandon du module WebAssembly, dont
// l'état n'est plus garanti : elle se dit en faute d'étape 'calcul', et le
// message suivant recharge une instance neuve. Le côté interface termine de
// toute façon le travailleur après toute faute ; l'annulation est, de même,
// terminate() : la résolution, synchrone, ne lit aucun signal.
//
// Un cache sert les tours identiques : texte LP → résultat de resoudreTour,
// en valeurs de l'objectif LP, sans la constante, que chaque tour ajoute
// après la lecture. Un cache texte → issue serait faux : deux tours de même
// texte peuvent avoir des constantes différentes (une organisation
// entièrement réservée n'a aucune variable). Un résultat optimal ou
// infaisable sert sous toute limite ; un résultat arrêté par la limite, ou
// un échec, sous la même limite seulement. Le cache garde au plus
// CAPACITE_DU_CACHE textes, le plus ancien sorti d'abord.
//
// Un message d'un autre type est ignoré ; le gestionnaire ne lève jamais.
import loadHighs from 'highs';
import { creerHorlogeSysteme } from './horloge.js';
import { lpTour } from './modele_tour.js';
import { LIMITE_PAR_TOUR } from './planchers_exacts.js';

/** Textes LP que le cache des résolutions garde au plus. */
export const CAPACITE_DU_CACHE = 256;

// Les réglages de chaque résolution, hors limite de temps : aucune trace,
// l'optimum prouvé à l'unité près — l'objectif d'un placement est entier,
// un écart absolu sous 1 suffit —, et une graine fixe.
const REGLAGES = Object.freeze({ output_flag: false, mip_rel_gap: 0, mip_abs_gap: 0.99, random_seed: 0 });

// primal_solution_status de HiGHS quand un placement réalisable existe.
const SOLUTION_REALISABLE = 2;

/**
 * Le chargeur de HiGHS : sans adresse, le chemin par défaut du module, que
 * node lit sur le disque ; avec une adresse, celle du wasm, seule voie qui
 * marche dans un travailleur servi depuis blob:, où le chemin par défaut
 * n'est pas une adresse valide.
 *
 * @param {string} [url]
 * @returns {Promise<Object>} l'instance de HiGHS
 */
export function chargerHighs(url) {
  return loadHighs(url === undefined ? {} : { locateFile: () => url });
}

// Une info de HiGHS, null quand elle n'est pas un nombre fini : HiGHS rend
// null sans placement ni borne, et un arrondi de null donnerait −0.
const nombreFini = (valeur) => (typeof valeur === 'number' && Number.isFinite(valeur) ? valeur : null);

// La tolérance des arrondis : la tolérance de faisabilité de HiGHS, 1e-6,
// multipliée par des pentes de cordes de l'ordre d'une table, rend l'erreur
// de la borne bien plus grande que 1e-6 ; un arrondi trop serré annoncerait
// un plancher plus haut de 1 que le vrai minimum.
const tolerance = (x) => Math.min(0.5, 1e-4 * Math.max(1, Math.abs(x)));

/**
 * Le statut d'une résolution traduit en issue, en valeurs de l'objectif LP.
 * borne = max(0, ⌈b − ε⌉) quand b existe ; valeur = ⌊v + ε⌋ quand un
 * placement existe. Optimal exige les deux d'accord — un c non serré dans un
 * placement trouvé par heuristique rend v fractionnaire, et l'arrondi au plus
 * proche dépasserait le minimum —, sinon il se lit comme une limite.
 * Infaisable, ou infaisable ou non borné : infaisable, le modèle ne pouvant
 * être non borné (y borné, z binaire, c bornée en bas et de coût positif).
 * Limite de temps : la borne et la valeur, chacune null sans elle. Tout
 * autre statut — limite de nœuds ou de solutions, interruption, … — est un
 * échec, jamais lu comme une preuve.
 *
 * @param {Object<string, number>} codes  highs.constants.modelStatus
 * @param {{statut: number, objectif: number|null, borne: number|null, incumbent: boolean}} lu
 * @returns {{statut: 'optimal'|'infaisable'|'limite'|'echec', valeur: number|null, borne: number|null}}
 */
export function issueDuStatut(codes, { statut, objectif, borne: b, incumbent }) {
  if (statut === codes.infeasible || statut === codes.unboundedOrInfeasible) return { statut: 'infaisable', valeur: null, borne: null };
  if (statut !== codes.optimal && statut !== codes.timeLimit) return { statut: 'echec', valeur: null, borne: null };
  const borne = b === null ? null : Math.max(0, Math.ceil(b - tolerance(b)));
  const valeur = incumbent && objectif !== null ? Math.floor(objectif + tolerance(b ?? objectif)) : null;
  if (statut === codes.optimal && borne !== null && borne === valeur) return { statut: 'optimal', valeur, borne };
  return { statut: 'limite', valeur, borne };
}

// L'horloge des durées quand l'appelant n'en donne pas.
const HORLOGE = creerHorlogeSysteme();

/**
 * Une résolution du texte LP, par highs.withModel, qui libère le modèle à la
 * sortie — jamais solve(), qui écrase les statuts au-delà de 15 en
 * « inconnu », ni un modèle créé sans être libéré, qui fuit. Le statut se
 * compare aux codes de highs.constants.modelStatus.
 *
 * @param {Object} highs  l'instance de HiGHS
 * @param {string} lp
 * @param {{limite: number, instant?: () => number, reglages?: Object}} options
 *   limite en secondes ; instant, l'horloge des durées, en millisecondes ;
 *   reglages, des réglages de HiGHS de plus, qui passent après les autres
 * @returns {{statut: 'optimal'|'infaisable'|'limite'|'echec', valeur: number|null,
 *   borne: number|null, duree: number}}
 *   en valeurs de l'objectif LP, constante non comprise ; duree en
 *   millisecondes
 */
export function resoudreTour(highs, lp, { limite, instant = HORLOGE.instant, reglages = {} }) {
  const debut = instant();
  const lu = highs.withModel({ format: 'lp', data: lp }, (modele) => {
    modele.options.set({ ...REGLAGES, time_limit: limite, ...reglages });
    modele.run();
    return {
      statut: modele.getModelStatus(),
      objectif: nombreFini(modele.info.get('objective_function_value')),
      borne: nombreFini(modele.info.get('mip_dual_bound')),
      incumbent: Number(modele.info.get('primal_solution_status')) === SOLUTION_REALISABLE,
    };
  });
  return { ...issueDuStatut(highs.constants.modelStatus, lu), duree: instant() - debut };
}

// Le résultat gardé pour ce texte, undefined quand il ne sert pas sous
// cette limite ; un résultat lu revient en tête de file.
function lireCache(cache, lp, limite) {
  const garde = cache.get(lp);
  if (garde === undefined) return undefined;
  const { resultat } = garde;
  if (resultat.statut !== 'optimal' && resultat.statut !== 'infaisable' && garde.limite !== limite) return undefined;
  cache.delete(lp);
  cache.set(lp, garde);
  return resultat;
}

function ecrireCache(cache, lp, limite, resultat) {
  cache.delete(lp);
  cache.set(lp, { limite, resultat });
  if (cache.size > CAPACITE_DU_CACHE) cache.delete(cache.keys().next().value);
}

/**
 * L'issue d'un tour (planchers_exacts.js, IssueTour). Sans résolution quand
 * les données le disent infaisable (cause 'reserves' ou 'places'), quand une
 * unité n'a aucune table possible ('affectation') ou quand aucune variable
 * n'existe : la constante est alors le minimum. Sinon la résolution AC, puis
 * au besoin A, selon l'en-tête du module.
 *
 * @param {Object|null} highs  l'instance de HiGHS
 * @param {import('./modele_tour.js').DonneesTour} donnees
 * @param {{limite?: number, cache?: Map<string, Object>, instant?: () => number}} [options]
 * @returns {import('./planchers_exacts.js').IssueTour}
 */
export function issueDuTour(highs, donnees, { limite = LIMITE_PAR_TOUR, cache = new Map(), instant = HORLOGE.instant } = {}) {
  const sansResolution = (champs) => ({ faisable: false, minimum: null, auMoins: null, cause: null, ...champs, duree: 0, cache: false });
  if (donnees.infaisable !== null) return sansResolution({ cause: donnees.infaisable });
  const ac = lpTour(donnees);
  if (ac.infaisable !== undefined) return sansResolution({ cause: ac.infaisable });
  if (ac.lp === null) return sansResolution({ faisable: true, minimum: ac.constante });

  let duree = 0;
  let duCache = true;
  const resoudre = (lp) => {
    const garde = lireCache(cache, lp, limite);
    if (garde !== undefined) return garde;
    const resultat = resoudreTour(highs, lp, { limite, instant });
    ecrireCache(cache, lp, limite, resultat);
    duree += resultat.duree;
    duCache = false;
    return resultat;
  };
  const issue = (champs) => ({ faisable: true, minimum: null, auMoins: null, cause: null, ...champs, duree, cache: duCache });

  const resultat = resoudre(ac.lp);
  if (resultat.statut === 'optimal') return issue({ minimum: resultat.valeur + ac.constante });
  if (resultat.statut === 'infaisable') return issue({ faisable: false, cause: 'solveur' });
  if (resultat.statut === 'echec') return issue({ faisable: null, cause: 'echec' });
  const auMoins = resultat.borne === null ? null : resultat.borne + ac.constante;
  if (resultat.valeur !== null) return issue({ auMoins, cause: 'limite' });
  const faisabilite = resoudre(lpTour(donnees, { mode: 'A' }).lp);
  if (faisabilite.statut === 'optimal') return issue({ auMoins, cause: 'limite' });
  if (faisabilite.statut === 'infaisable') return issue({ faisable: false, cause: 'solveur' });
  return issue({ faisable: null, auMoins, cause: faisabilite.statut === 'echec' ? 'echec' : 'limite' });
}

/**
 * Branche une portée de travailleur — { onmessage, postMessage } — sur la
 * résolution des tours, selon les messages de l'en-tête du module.
 *
 * @param {{onmessage: ((evenement: {data: unknown}) => void)|null, postMessage: (message: Object) => void}} portee
 * @param {{chargerHighs?: (url: string|undefined) => Promise<Object>|Object,
 *   horloge?: import('./horloge.js').Horloge}} [options]
 *   chargerHighs, le chargeur de HiGHS, chargerHighs du module par défaut ;
 *   horloge, celle des durées, l'horloge du système par défaut
 */
export function brancherTravailleurSolveur(portee, { chargerHighs: charger = chargerHighs, horloge = HORLOGE } = {}) {
  // chargement : la promesse de l'instance de HiGHS, null avant le premier
  // message et après une faute.
  let chargement = null;
  const cache = new Map();
  const faute = (numero, etape, erreur) =>
    portee.postMessage({ type: 'faute', numero, etape, message: String(erreur?.message ?? erreur), pile: String(erreur?.stack ?? '') });

  async function traiter({ numero, urlWasm, tours, limite = LIMITE_PAR_TOUR }) {
    let highs;
    try {
      chargement ??= Promise.resolve().then(() => charger(urlWasm));
      highs = await chargement;
    } catch (erreur) {
      chargement = null;
      faute(numero, 'chargement', erreur);
      return;
    }
    try {
      for (const donnees of tours) {
        const issue = issueDuTour(highs, donnees, { limite, cache, instant: horloge.instant });
        portee.postMessage({ type: 'tour', numero, r: donnees.r, issue });
      }
    } catch (erreur) {
      chargement = null;
      faute(numero, 'calcul', erreur);
      return;
    }
    portee.postMessage({ type: 'fini', numero });
  }

  portee.onmessage = (evenement) => {
    const data = evenement?.data;
    if (data === null || typeof data !== 'object' || data.type !== 'resoudre') return;
    // Seul postMessage peut encore lever ici, une faute déjà postée ou non :
    // il ne reste rien à dire.
    traiter(data).catch(() => {});
  };
}
