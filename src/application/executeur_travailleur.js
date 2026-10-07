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
//   ← { type: 'faute', message, pile }              rejette par une Error, une faute
//   ✕ canal d'erreur du travailleur                 rejette par TRAVAILLEUR_EN_ECHEC
//
// Le travailleur poste ses fautes de calcul en message : son canal d'erreur
// ne porte que l'échec de son script, qui ne se charge ou ne se compile pas.
//
// Chaque lancer prend un travailleur neuf de la fabrique et le termine à
// l'issue : résultat, erreur, faute, échec du script ou annulation. Terminé,
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
 *   ErreurGeneration(code, details) ; faute {message, pile} → rejet par
 *   une Error sans code, dont le message porte celui du travailleur et la
 *   pile la sienne : elle remonte comme une faute, comme sous l'exécuteur
 *   direct ; canal d'erreur du travailleur — son script ne se charge ou ne
 *   se compile pas —, → rejet par ErreurGeneration('TRAVAILLEUR_EN_ECHEC',
 *   { remede: null }), l'événement traité : aucun geste de la page ne
 *   relance un travailleur que le navigateur refuse, et le texte du refus
 *   nomme sa cause (§ 5.9) ;
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
        } else if (data.type === 'faute') {
          const faute = new Error(`travailleur de génération : ${data.message}`);
          faute.stack = `${faute.stack}\n${data.pile}`;
          rejeter(faute);
          terminer();
        }
      };
      // Le script du travailleur ne se charge ou ne se compile pas : le refus
      // TRAVAILLEUR_EN_ECHEC, que la commande « Générer » pose à côté
      // d'elle, jamais le message du moteur d'exécution. L'événement est
      // traité : le navigateur ne le signale pas en plus comme une faute de
      // la page. Une faute du calcul arrive en message, jamais ici.
      travailleur.onerror = (evenement) => {
        evenement?.preventDefault?.();
        if (termine) return;
        rejeter(new ErreurGeneration('TRAVAILLEUR_EN_ECHEC', { remede: null }));
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
