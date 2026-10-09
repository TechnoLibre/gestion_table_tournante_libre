// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'imprimante de la plateforme web (§ 11.7, § 13.4) : la frontière de
// plateforme « impression » sous un navigateur, qui n'offre que sa boîte de
// dialogue. Le papier et l'orientation de la page sont ceux que pose la
// feuille d'impression (@page) ; la boîte de dialogue ne dit pas ce
// qu'elle en a fait — envoyée, annulée, échouée —, d'où l'issue
// « inconnue ». src/main.js seul l'importe, et lui passe la fenêtre de la
// page ; les épreuves lui passent une fenêtre factice.
import { PAPIERS } from '../geometrie/papiers.js';

const ORIENTATIONS = new Set(['portrait', 'paysage']);

/**
 * @typedef {Object} Imprimante
 * @property {(options: {papier: import('../geometrie/papiers.js').Papier, orientation: 'portrait'|'paysage'})
 *            => Promise<{issue: 'envoye'|'annule'|'echec'|'inconnue', cause: string|null}>} imprimer
 */

/**
 * L'imprimante d'une fenêtre de navigateur.
 *
 * @param {{print: () => void}} fenetre   window, sous la page
 * @returns {Imprimante}   imprimer appelle fenetre.print() une fois et rend
 *          {issue: 'inconnue', cause: null} ; une option hors de son
 *          domaine — un papier hors de PAPIERS, une orientation autre que
 *          portrait ou paysage — rejette TypeError sans rien appeler
 * @throws {TypeError} une fenêtre sans méthode print
 */
export function creerImprimanteWeb(fenetre) {
  if (typeof fenetre?.print !== 'function') throw new TypeError('creerImprimanteWeb : fenêtre sans méthode print');
  return {
    async imprimer({ papier, orientation } = {}) {
      if (typeof papier !== 'string' || !Object.hasOwn(PAPIERS, papier)) {
        throw new TypeError(`imprimer : papier inconnu ${JSON.stringify(papier)}`);
      }
      if (!ORIENTATIONS.has(orientation)) throw new TypeError(`imprimer : orientation inconnue ${JSON.stringify(orientation)}`);
      fenetre.print();
      return { issue: 'inconnue', cause: null };
    },
  };
}
