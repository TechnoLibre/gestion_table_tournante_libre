// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Erreurs que lève la lecture d'un CSV. Le code d'une ErreurCsv nomme le
// refus ; ses détails portent ce que l'appelant lit pour agir, comme le
// remède d'un refus d'encodage. Le message, code et détails en JSON, sert au
// diagnostic et n'est pas un texte affiché, que fournit la table des libellés
// (§ 14.6).

export class ErreurCsv extends Error {
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
ErreurCsv.prototype.name = 'ErreurCsv';
