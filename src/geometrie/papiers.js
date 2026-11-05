// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les papiers des sorties, le badge et ses modèles (§ 11.2), en
// millimètres : la seule définition. Le stockage, l'application,
// l'imposition de la planche et l'impression en tirent leur domaine — les
// clés de PAPIERS et de MODELES_BADGE — et leurs cotes ; aucun autre module
// n'écrit le nom d'un papier ni d'un modèle. Pour l'aperçu d'impression, le
// logiciel n'impose aucun papier : l'opérateur choisit celui de son bac
// (§ 8.5). Les badges partent du modèle Avery 5392, qui fixe son papier.

/** @typedef {'A4'|'Lettre'} Papier */

/** Les papiers, largeur et hauteur en mm, portrait. */
export const PAPIERS = Object.freeze({
  A4: Object.freeze({ largeur: 210, hauteur: 297 }),
  Lettre: Object.freeze({ largeur: 215.9, hauteur: 279.4 }),
});

/** Le badge : un A6 exact, debout, en mm, sur tout papier. */
export const BADGE = Object.freeze({ largeur: 105, hauteur: 148 });

/** @typedef {'avery5392'|'a6'} ModeleBadge */

/**
 * Les modèles de badge, le défaut en tête. Chacun : la largeur et la hauteur
 * du badge en mm, telles que le badge se lit ; le papier qu'il impose, null
 * quand il se pose sur tout papier ; la grille fixe de sa feuille, null quand
 * l'imposition se déduit des cotes (src/pdf/imposition.js).
 *
 * Avery 5392 : la feuille Lettre portrait de six cartes prédécoupées de
 * 4 po × 3 po (101,6 × 76,2 mm), à plat, deux colonnes et trois rangées
 * sans gouttière, à 0,25 po (6,35 mm) des bords latéraux et 1 po (25,4 mm)
 * des bords haut et bas : 2 × 6,35 + 2 × 101,6 = 215,9 et 2 × 25,4 +
 * 3 × 76,2 = 279,4, les cotes du Lettre. A6 : le badge à découper, sur A4
 * ou Lettre.
 */
export const MODELES_BADGE = Object.freeze({
  avery5392: Object.freeze({
    largeur: 101.6,
    hauteur: 76.2,
    papier: 'Lettre',
    grille: Object.freeze({ colonnes: 2, rangees: 3, gauche: 6.35, haut: 25.4 }),
  }),
  a6: Object.freeze({ largeur: BADGE.largeur, hauteur: BADGE.hauteur, papier: null, grille: null }),
});

/** Le modèle des badges tant que l'opérateur n'en a pas choisi (§ 8.5). */
export const MODELE_BADGE_DEFAUT = 'avery5392';

/**
 * Le papier des badges tant que la machine n'en a pas choisi (§ 11.2) :
 * celui de la feuille de cartes Avery 5392, que prend aussi l'A6.
 *
 * @type {Papier}
 */
export const PAPIER_BADGES_DEFAUT = 'Lettre';

/**
 * Vrai pour une clé propre de MODELES_BADGE ; une clé héritée
 * d'Object.prototype n'en est pas une.
 *
 * @param {*} modele
 * @returns {boolean}
 */
export const estModeleBadge = (modele) => typeof modele === 'string' && Object.hasOwn(MODELES_BADGE, modele);
