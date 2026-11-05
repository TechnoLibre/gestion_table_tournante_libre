// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Erreurs que lève le moteur. Le code d'une ErreurConfiguration nomme la
// règle enfreinte ; ses détails désignent participants et tables par
// identifiant, les tours par leur numéro à partir de 1, et une réservation,
// qui n'a pas d'identifiant, par son rang à partir de 0 dans la liste qui la
// porte. L'appelant lit le code et les détails ; le message, code et détails
// en JSON, sert au journal et n'est pas un texte affiché, que fournit la
// table des libellés (§ 14.6).

export class ErreurConfiguration extends Error {
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
ErreurConfiguration.prototype.name = 'ErreurConfiguration';

// Levée par une recherche interrompue à la demande : aucun résultat partiel
// ne l'accompagne.
export class ErreurAnnulee extends Error {}
ErreurAnnulee.prototype.name = 'ErreurAnnulee';
