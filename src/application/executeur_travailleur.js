// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'exécuteur de production de la génération (§ 5.10, § 13.4) : la
// recherche tourne dans un travailleur, hors du fil de l'interface, et
// l'exécuteur adapte son protocole — celui de generation_travailleur.js —
// au contrat Executeur du contrôleur de génération (generation.js).
//
//   → { type: 'lancer', configuration, reglages }   le premier et seul message
//   ← { type: 'avancement', fait, total }           remis aux abonnés
//   ← { type: 'resultat', propositions }            résout le résultat
//   ← { type: 'erreur', code, details }             rejette par ErreurGeneration
//
// Chaque lancer prend un travailleur neuf de la fabrique et le termine à
// l'issue : résultat, erreur, faute du travailleur ou annulation. Terminé,
// le travailleur ne remet plus rien : un message déjà en file à cet instant
// ne parvient ni aux abonnés ni au résultat. L'annulation est terminate(),
// dans le même tour : immédiate, sans résultat partiel. La fabrique est un
// paramètre : src/main.js la construit sur le travailleur inclus dans la
// page, une épreuve sur un travailleur factice. Ce module ne touche aucune
// plateforme.
import { ErreurAnnulee, ErreurGeneration } from './generation.js';

/**
 * L'exécuteur du travailleur.
 *
 * @param {() => {postMessage: (message: Object) => void, terminate: () => void,
 *   onmessage: ((evenement: {data: Object}) => void)|null,
 *   onerror?: ((evenement: {message?: string}) => void)|null}} fabrique
 *   rend un travailleur neuf à chaque appel
 * @returns {import('./generation.js').Executeur}
 *   lancer(configuration, reglages) rend une Execution : avancement →
 *   surAvancement ; resultat → la promesse résolue aux propositions reçues,
 *   puis terminate() ; erreur {code, details} → rejet par
 *   ErreurGeneration(code, details) ; faute du travailleur, son canal
 *   d'erreur, → rejet par une Error sans code, qui remonte comme une faute ;
 *   annuler() → terminate() aussitôt, rejet par ErreurAnnulee, plus aucun
 *   avancement. Après l'issue, annuler() ne fait rien.
 */
export function creerExecuteurTravailleur(fabrique) {
  return {
    lancer(configuration, reglages) {
      const travailleur = fabrique();
      const abonnes = new Set();
      let termine = false;
      let resoudre;
      let rejeter;
      const resultat = new Promise((ok, ko) => {
        resoudre = ok;
        rejeter = ko;
      });

      // L'issue : le travailleur se termine, ses gestionnaires sont retirés,
      // et rien de ce qu'il remettrait encore ne passe.
      function terminer() {
        termine = true;
        travailleur.onmessage = null;
        travailleur.onerror = null;
        travailleur.terminate();
      }

      travailleur.onmessage = ({ data }) => {
        if (termine) return;
        if (data.type === 'avancement') {
          for (const fn of [...abonnes]) fn(data.fait, data.total);
        } else if (data.type === 'resultat') {
          resoudre(data.propositions);
          terminer();
        } else if (data.type === 'erreur') {
          rejeter(new ErreurGeneration(data.code, data.details));
          terminer();
        }
      };
      travailleur.onerror = (evenement) => {
        if (termine) return;
        rejeter(new Error(`travailleur de génération : ${evenement?.message ?? 'faute sans message'}`));
        terminer();
      };
      travailleur.postMessage({ type: 'lancer', configuration, reglages });

      return {
        surAvancement(fn) {
          abonnes.add(fn);
          return () => {
            abonnes.delete(fn);
          };
        },
        resultat,
        annuler() {
          if (termine) return;
          terminer();
          rejeter(new ErreurAnnulee());
        },
      };
    },
  };
}
