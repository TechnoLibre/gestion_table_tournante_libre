// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le côté travailleur de la génération (§ 5.10) : la recherche du moteur
// hors du fil de l'interface. Le travailleur reçoit un message, calcule, et
// poste ses avancements puis son résultat ou son erreur :
//
//   → { type: 'lancer', configuration, reglages }
//   ← { type: 'avancement', fait, total }   au plus une fois toutes les
//                                           CADENCE_AVANCEMENT progressions
//                                           du moteur, fait croissant
//   ← { type: 'resultat', propositions }    celles de rechercher, telles quelles
//   ← { type: 'erreur', code, details }     REGLAGE_HORS_DOMAINE {reglage}
//                                           d'exigerReglages, avant tout
//                                           calcul ; puis, par
//                                           versErreurGeneration, le code et
//                                           les détails d'une
//                                           ErreurConfiguration
//   ← { type: 'faute', message, pile }     une erreur que versErreurGeneration
//                                           ne convertit pas : une faute de
//                                           programmation, son texte et sa
//                                           pile, que l'exécuteur relève
//                                           comme une faute
//
// L'annulation est terminate() du côté de l'interface : immédiate, sans
// résultat partiel ; le travailleur ne lit aucun signal. Un message d'un
// autre type ne lance rien. Le gestionnaire ne lève jamais : le canal
// d'erreur du travailleur ne porte ainsi que l'échec de son script — qui ne
// se charge ou ne se compile pas —, et l'exécuteur ne confond pas les deux.
import { rechercher } from '../moteur/recherche.js';
import { ErreurGeneration, exigerReglages, versErreurGeneration } from './generation.js';

/** Progressions du moteur — une toutes les 1 000 itérations — entre deux messages d'avancement. */
export const CADENCE_AVANCEMENT = 50;

/**
 * Branche une portée de travailleur — { onmessage, postMessage } — sur
 * rechercher, selon les messages de l'en-tête du module.
 *
 * @param {{onmessage: ((evenement: {data: unknown}) => void)|null, postMessage: (message: Object) => void}} portee
 */
export function brancherTravailleur(portee) {
  portee.onmessage = ({ data }) => {
    if (data === null || typeof data !== 'object' || data.type !== 'lancer') return;
    let progressions = 0;
    const progression = (fait, total) => {
      progressions += 1;
      if (progressions % CADENCE_AVANCEMENT === 0) portee.postMessage({ type: 'avancement', fait, total });
    };
    try {
      exigerReglages(data.reglages);
      const propositions = rechercher(data.configuration, data.reglages, { progression });
      portee.postMessage({ type: 'resultat', propositions });
    } catch (erreur) {
      const convertie = versErreurGeneration(erreur);
      if (convertie instanceof ErreurGeneration) {
        portee.postMessage({ type: 'erreur', code: convertie.code, details: convertie.details });
      } else {
        const message = String(convertie);
        const pile = typeof convertie?.stack === 'string' ? convertie.stack : message;
        portee.postMessage({ type: 'faute', message, pile });
      }
    }
  };
}
