// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le registre des commandes des places — réservations, titres, pose (§ 5.8,
// § 5.9, § 8.2), que commandes.js réunit aux autres. Ses imports n'atteignent
// jamais commandes.js : le registre réuni dépend de lui, non l'inverse.

/** @type {Map<string, (charge: Object, args: Object) => Object>} */
export const COMMANDES_PLACES = new Map();
