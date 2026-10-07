// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le refus d'une commande (§ 8.2, § 14.6), que lèvent les registres de
// commandes et leurs contrôles : un code, et des détails qui portent le
// remède, details.remede, null quand aucun geste ne lève le refus.

/**
 * Le refus d'une commande : son code, et des détails que l'appelant lit pour
 * agir, remede compris. Le message, code et détails en JSON, sert aux traces ;
 * le texte affiché vient de la table des libellés (§ 14.6).
 */
export class ErreurCommande extends Error {
  /**
   * @param {string} code
   * @param {Object} [details]
   */
  constructor(code, details = {}) {
    super(`${code} ${JSON.stringify(details)}`);
    this.code = code;
    this.details = details;
  }
}
ErreurCommande.prototype.name = 'ErreurCommande';

/**
 * Le refus de code donné : ses détails, puis le remède, null sans lui.
 *
 * @param {string} code
 * @param {Object} [details]
 * @param {Object|null} [remede]
 * @returns {ErreurCommande}
 */
export function refus(code, details = {}, remede = null) {
  return new ErreurCommande(code, { ...details, remede });
}
