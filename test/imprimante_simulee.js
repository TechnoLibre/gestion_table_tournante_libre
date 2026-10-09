// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'imprimante d'épreuve (§ 13.4) : la troisième implémentation de la
// frontière « impression », qui n'imprime rien. Elle juge le papier et
// l'orientation comme les deux imprimantes réelles, relève chaque demande
// admise et rend l'issue qu'on lui règle à sa création. Le montage des
// épreuves du navigateur la passe à App par défaut ; une épreuve y lit ce
// que l'aperçu a demandé d'imprimer.
import { PAPIERS } from '../src/geometrie/papiers.js';

const ORIENTATIONS = new Set(['portrait', 'paysage']);

// Les issues d'une impression ; seules celles d'un échec portent une cause.
const ISSUES = new Set(['envoye', 'annule', 'echec', 'inconnue']);

/**
 * Une imprimante d'épreuve.
 *
 * @param {{issue?: 'envoye'|'annule'|'echec'|'inconnue', cause?: string|null}} [reglage]
 *        l'issue que rend chaque impression, envoyée par défaut, et sa
 *        cause, null par défaut, une chaîne pour un échec seulement
 * @returns {{imprimer: (options: {papier: string, orientation: 'portrait'|'paysage'})
 *             => Promise<{issue: string, cause: string|null}>,
 *           appels: () => Array<{papier: string, orientation: string}>}}
 *          l'interface Imprimante de src/impression, et le relevé :
 *          imprimer rejette TypeError pour un papier hors de PAPIERS ou une
 *          orientation autre que portrait ou paysage, sans rien relever ;
 *          appels() rend une copie des demandes admises, dans l'ordre,
 *          papier et orientation seuls
 * @throws {TypeError} un réglage hors du contrat
 */
export function creerImprimanteSimulee(reglage = {}) {
  if (reglage === null || typeof reglage !== 'object') throw new TypeError("creerImprimanteSimulee : le réglage n'est pas un objet");
  const { issue = 'envoye', cause = null } = reglage;
  if (!ISSUES.has(issue)) throw new TypeError(`creerImprimanteSimulee : issue inconnue ${JSON.stringify(issue)}`);
  if (!(cause === null || (issue === 'echec' && typeof cause === 'string'))) {
    throw new TypeError(`creerImprimanteSimulee : cause ${JSON.stringify(cause)} pour l'issue ${issue}`);
  }
  const demandes = [];
  return {
    async imprimer({ papier, orientation } = {}) {
      if (typeof papier !== 'string' || !Object.hasOwn(PAPIERS, papier)) {
        throw new TypeError(`imprimer : papier inconnu ${JSON.stringify(papier)}`);
      }
      if (!ORIENTATIONS.has(orientation)) throw new TypeError(`imprimer : orientation inconnue ${JSON.stringify(orientation)}`);
      demandes.push({ papier, orientation });
      return { issue, cause };
    },
    appels: () => demandes.map((demande) => ({ ...demande })),
  };
}
