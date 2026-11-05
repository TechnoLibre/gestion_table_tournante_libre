// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// L'échelle de la taille du texte de l'écran (§ 8.5, § 18.6) : la seule
// définition de ses paliers. Le stockage en tire le domaine de la clé
// taille_texte de reglages_locaux.json, l'application celui du choix, et
// l'interface les choix qu'elle offre et la taille de police qu'elle pose sur
// la racine du document. Les jetons de l'écran sont en rem : ils suivent
// cette taille. Le dessin du plan, en unités du plan, et le papier, dont les
// jetons sont épinglés en px sous l'impression (jetons.css), ne la suivent
// pas.

/** Les paliers, en pour cent de la taille de base, croissants. */
export const PALIERS_TAILLE_TEXTE = Object.freeze([90, 100, 115, 130, 150]);

/** Le palier d'un poste qui n'en a pas choisi. */
export const TAILLE_TEXTE_DEFAUT = 100;

/**
 * Vrai pour l'un des paliers, un nombre : un texte qui en a la forme n'en
 * est pas un.
 *
 * @param {unknown} valeur
 * @returns {boolean}
 */
export function estPalierTailleTexte(valeur) {
  return typeof valeur === 'number' && PALIERS_TAILLE_TEXTE.includes(valeur);
}

/**
 * La taille de police de la racine du document pour un palier, en pour cent
 * de la taille de base du navigateur : « 115% ».
 *
 * @param {number} palier   l'un de PALIERS_TAILLE_TEXTE
 * @returns {string}
 * @throws {RangeError} hors des paliers
 */
export function taillePoliceRacine(palier) {
  if (!estPalierTailleTexte(palier)) throw new RangeError(`taille du texte hors des paliers : ${String(palier)}`);
  return `${palier}%`;
}
