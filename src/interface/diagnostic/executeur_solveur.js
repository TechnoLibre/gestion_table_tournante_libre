// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// L'exécuteur du solveur du plancher exact (§ 5.6, § 5.10), côté interface :
// il parle au travailleur du solveur (travailleur_solveur.js) selon le
// protocole de solveur_travailleur.js, et n'importe pas highs.
//
//   → { type: 'resoudre', numero, urlWasm, tours, limite }
//   ← { type: 'tour', numero, r, issue }   une issue par tour, dans l'ordre
//   ← { type: 'fini', numero }
//   ← { type: 'faute', numero, etape, message, pile }
//
// Un travailleur au plus, né au premier calcul ; il sert les calculs
// suivants, et l'instance de HiGHS qu'il a chargée avec lui. La résolution
// d'un tour est synchrone dans le travailleur et ne lit aucun signal : le
// seul moyen de l'interrompre est terminate(). Un calcul demandé pendant un
// autre termine donc le travailleur, rejette l'ancien calcul par une
// DOMException AbortError, que l'appelant ignore, et en fait naître un neuf
// (son chargement coûte quelques dizaines de millisecondes) ; annuler() fait
// de même sans calcul suivant.
//
// Une faute du travailleur rejette le calcul par une Error qui garde son
// étape — 'chargement' ou 'calcul' — et termine le travailleur : après un
// abandon du module WebAssembly, son état n'est plus garanti. L'échec du
// script du travailleur se dit en faute de chargement. Un message hors de
// son rang — un tour qui n'est pas le suivant, une fin avant le dernier
// tour — est une faute de calcul.
//
// Le filet : une minuterie, réarmée à chaque message reçu, de deux limites
// par tour plus cinq secondes (delaiDuFilet) — un tour peut enchaîner la
// résolution AC puis celle de faisabilité, chacune sous la limite, et HiGHS
// ne tient pas sa limite à la milliseconde. Échue, elle termine le
// travailleur et rejette le calcul par une faute d'étape 'filet' : aucune
// limite non tenue ne gèle le calcul. Un filet global, nombre de tours ×
// (limite + marge), tuerait un calcul légitime dès qu'un tour passe par la
// seconde résolution. La minuterie passe par l'horloge injectée (§ 19.4).
//
// Après terminer(), le calcul en cours est rejeté par une AbortError et
// resoudre rejette par une RangeError, une faute de l'appelant. La fabrique
// est un paramètre : src/main.js la construit sur le travailleur différé ;
// une épreuve, sur des travailleurs factices ou sur le vrai.
import { LIMITE_PAR_TOUR } from '../../application/planchers_exacts.js';

/** La marge du filet au-delà de deux limites par tour, en millisecondes. */
export const MARGE_DU_FILET_MS = 5000;

/**
 * Le délai du filet pour une limite par tour donnée en secondes : deux
 * limites plus la marge, en millisecondes.
 *
 * @param {number} limiteParTour
 * @returns {number}
 */
export const delaiDuFilet = (limiteParTour) => 2 * limiteParTour * 1000 + MARGE_DU_FILET_MS;

// Une faute du solveur : une Error qui garde son étape.
function faute(etape, message, pile = '') {
  const erreur = new Error(`solveur du plancher exact (${etape}) : ${message}`);
  erreur.etape = etape;
  if (pile !== '') erreur.stack = `${erreur.stack}\n${pile}`;
  return erreur;
}

// Le rejet d'un calcul remplacé, annulé ou abandonné.
const abandon = (raison) => new DOMException(raison, 'AbortError');

/**
 * L'exécuteur du solveur sur un travailleur dédié.
 *
 * @param {() => {postMessage: (message: Object) => void, terminate: () => void,
 *   onmessage: ((evenement: {data: unknown}) => void)|null,
 *   onerror?: ((evenement: {preventDefault?: () => void}) => void)|null}} fabrique
 *   rend un travailleur neuf à chaque appel
 * @param {{urlWasm: string|undefined, horloge: import('../../application/horloge.js').Horloge,
 *   limiteParTour?: number}} options
 *   urlWasm, l'adresse du module WebAssembly de HiGHS que le travailleur
 *   charge ; horloge, celle du filet ; limiteParTour, en secondes,
 *   LIMITE_PAR_TOUR par défaut
 * @returns {{resoudre: (tours: Array<{r: number}>, options?: {surTour?: (faits: number, issue: Object) => void}) => Promise<Object[]>,
 *   annuler: () => boolean, terminer: () => void}}
 *   resoudre se résout aux issues des tours, dans leur ordre, et appelle
 *   surTour à chaque tour reçu, avec le nombre de tours faits ; annuler
 *   rend vrai quand il a interrompu un calcul
 */
export function creerExecuteurSolveur(fabrique, { urlWasm, horloge, limiteParTour = LIMITE_PAR_TOUR }) {
  const delai = delaiDuFilet(limiteParTour);
  // travailleur : celui qui sert les calculs, ou null avant le premier et
  // après une terminaison ; calcul : celui en cours, ou null.
  let travailleur = null;
  let calcul = null;
  let numeros = 0;
  let termine = false;

  // Retire les gestionnaires du travailleur et le termine : il ne remet plus
  // rien, même un message déjà en file.
  function arreter() {
    if (travailleur === null) return;
    travailleur.onmessage = null;
    travailleur.onerror = null;
    travailleur.terminate();
    travailleur = null;
  }

  // Le calcul n'est plus en cours : son filet est désarmé.
  function clore(courant) {
    horloge.annuler(courant.minuterie);
    if (calcul === courant) calcul = null;
  }

  // Rejette le calcul et termine le travailleur qui le portait.
  function echouer(courant, erreur) {
    clore(courant);
    arreter();
    courant.rejeter(erreur);
  }

  function armer(courant) {
    horloge.annuler(courant.minuterie);
    courant.minuterie = horloge.planifier(
      () => echouer(courant, faute('filet', `aucun message du travailleur en ${delai} ms`)),
      delai,
    );
  }

  function recevoir(data) {
    if (calcul === null || data === null || typeof data !== 'object' || data.numero !== calcul.numero) return;
    const courant = calcul;
    if (data.type === 'tour') {
      const attendu = courant.tours[courant.issues.length];
      if (attendu === undefined || data.r !== attendu.r) {
        echouer(courant, faute('calcul', `tour ${String(data.r)} reçu hors de son rang`));
        return;
      }
      armer(courant);
      courant.issues.push(data.issue);
      courant.surTour?.(courant.issues.length, data.issue);
    } else if (data.type === 'fini') {
      if (courant.issues.length !== courant.tours.length) {
        echouer(courant, faute('calcul', `fin après ${courant.issues.length} tours sur ${courant.tours.length}`));
        return;
      }
      clore(courant);
      courant.resoudre(courant.issues);
    } else if (data.type === 'faute') {
      const { etape, message, pile = '' } = data;
      echouer(courant, faute(etape, String(message), String(pile)));
    }
  }

  // Le travailleur courant, né au besoin. L'échec de son script rejette le
  // calcul en cours, l'événement traité : le navigateur ne le signale pas en
  // plus comme une faute de la page.
  function courant() {
    if (travailleur !== null) return travailleur;
    const neuf = fabrique();
    neuf.onmessage = ({ data }) => recevoir(data);
    neuf.onerror = (evenement) => {
      evenement?.preventDefault?.();
      if (travailleur !== neuf) return;
      if (calcul === null) arreter();
      else echouer(calcul, faute('chargement', 'le script du travailleur ne se charge pas'));
    };
    travailleur = neuf;
    return neuf;
  }

  // Interrompt le calcul en cours, s'il y en a un : son travailleur est
  // terminé, sa promesse rejetée par une AbortError.
  function interrompre(raison) {
    if (calcul === null) return false;
    echouer(calcul, abandon(raison));
    return true;
  }

  return {
    resoudre(tours, { surTour } = {}) {
      if (termine) return Promise.reject(new RangeError("resoudre : l'exécuteur du solveur est terminé"));
      interrompre('calcul remplacé par un plus récent');
      if (tours.length === 0) return Promise.resolve([]);
      numeros += 1;
      const numero = numeros;
      return new Promise((resoudre, rejeter) => {
        const cible = courant();
        const neuf = { numero, tours, issues: [], surTour, resoudre, rejeter, minuterie: undefined };
        calcul = neuf;
        try {
          cible.postMessage({ type: 'resoudre', numero, urlWasm, tours, limite: limiteParTour });
        } catch (erreur) {
          clore(neuf);
          rejeter(erreur);
          return;
        }
        armer(neuf);
      });
    },
    annuler() {
      return interrompre('calcul annulé');
    },
    terminer() {
      if (termine) return;
      termine = true;
      if (!interrompre("exécuteur du solveur terminé")) arreter();
    },
  };
}
