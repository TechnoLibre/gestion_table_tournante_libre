// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// L'imprimante de la coquille electron, côté page (§ 11.7, § 13.4) : la
// frontière de plateforme « impression » sous la coquille, qui passe par la
// fonction imprimer du pont gtt que le préchargement pose sur la fenêtre.
// La demande ne porte que le papier et l'orientation ; le processus
// principal (electron/impression.js) en compose les options de
// webContents.print — la boîte de dialogue du système, le format de page du
// papier, le paysage — et rend l'issue de son rappel : envoyée, annulée ou
// échouée, la raison de l'échec pour cause. Le papier et l'orientation se
// jugent ici avant le pont, comme sous web, et la réponse du pont à son
// retour : une réponse d'une autre forme est une faute de la coquille.
// src/main.js seul l'importe, et lui passe ce pont, qu'il est seul à lire
// avec le système de fichiers de la coquille ; les épreuves lui passent un
// pont factice.
import { PAPIERS } from '../geometrie/papiers.js';

const ORIENTATIONS = new Set(['portrait', 'paysage']);

// Les issues que la coquille rend ; seule celle d'un échec porte une cause.
const ISSUES = new Set(['envoye', 'annule', 'echec']);

// Vrai pour une réponse du pont du contrat : une issue de la coquille, une
// cause chaîne pour un échec ou null, null pour les autres issues.
function estReponse(reponse) {
  if (reponse === null || typeof reponse !== 'object' || !ISSUES.has(reponse.issue)) return false;
  return reponse.cause === null || (reponse.issue === 'echec' && typeof reponse.cause === 'string');
}

/**
 * L'imprimante de la coquille electron.
 *
 * @param {{imprimer: (demande: {papier: string, orientation: string}) => Promise<unknown>}} pont
 *        le pont gtt que le préchargement expose sur la fenêtre
 * @returns {import('./imprimante_web.js').Imprimante}   imprimer passe au
 *          pont {papier, orientation}, eux seuls, une fois, et rend
 *          {issue, cause} ; une option hors de son domaine — un papier hors
 *          de PAPIERS, une orientation autre que portrait ou paysage —
 *          rejette TypeError sans rien appeler ; une réponse du pont d'une
 *          autre forme rejette TypeError ; un refus du pont se rejette tel
 *          quel
 * @throws {TypeError} un pont sans fonction imprimer
 */
export function creerImprimanteElectron(pont) {
  if (typeof pont?.imprimer !== 'function') throw new TypeError('creerImprimanteElectron : pont sans fonction imprimer');
  return {
    async imprimer({ papier, orientation } = {}) {
      if (typeof papier !== 'string' || !Object.hasOwn(PAPIERS, papier)) {
        throw new TypeError(`imprimer : papier inconnu ${JSON.stringify(papier)}`);
      }
      if (!ORIENTATIONS.has(orientation)) throw new TypeError(`imprimer : orientation inconnue ${JSON.stringify(orientation)}`);
      const reponse = await pont.imprimer({ papier, orientation });
      if (!estReponse(reponse)) throw new TypeError(`imprimer : réponse de la coquille illisible ${JSON.stringify(reponse)}`);
      return { issue: reponse.issue, cause: reponse.cause };
    },
  };
}
