// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les papiers des sorties et le badge (§ 11.2), en millimètres, portrait :
// la seule définition. Le stockage, l'application, l'imposition de la
// planche et l'impression en tirent leur domaine — les clés de PAPIERS —
// et leurs cotes ; aucun autre module n'écrit le nom d'un papier. Le
// logiciel n'en impose aucun par défaut : l'opérateur choisit celui de son
// bac (§ 8.5).

/** @typedef {'A4'|'Lettre'} Papier */

/** Les papiers, largeur et hauteur en mm, portrait. */
export const PAPIERS = Object.freeze({
  A4: Object.freeze({ largeur: 210, hauteur: 297 }),
  Lettre: Object.freeze({ largeur: 215.9, hauteur: 279.4 }),
});

/** Le badge : un A6 exact, debout, en mm, sur tout papier. */
export const BADGE = Object.freeze({ largeur: 105, hauteur: 148 });
