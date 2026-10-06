// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Erreurs que lève le stockage. Le code d'une ErreurStockage nomme l'échec,
// et ses détails ce que l'appelant en lit — chemin, raison, révisions de
// secours — ; types.js en donne la table, code par code. L'appelant lit le
// code et les détails ; le message, code et détails en JSON, sert aux traces
// de diagnostic et n'est pas un texte affiché, que fournit la table des
// libellés de l'application (§ 14.6).

export class ErreurStockage extends Error {
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
ErreurStockage.prototype.name = 'ErreurStockage';
