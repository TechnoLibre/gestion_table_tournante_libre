// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le réglage de thème (§ 19.2), que le panneau « Paramètres » porte. Chaque
// lancement repart de la préférence du système ; le choix de l'opérateur vaut
// ensuite pour la séance, tenu en mémoire par l'état de navigation
// (etat_ui.js), qu'App pose en data-theme sur <html> (jetons.css). Rien ne
// l'enregistre : ni fichier, ni stockage du navigateur. Le module n'importe
// rien : l'état de navigation en tire son domaine.

// Chaque thème et la clé de son nom, dans l'ordre du réglage.
const CLES = new Map([
  ['clair', 'coquille.theme.clair'],
  ['sombre', 'coquille.theme.sombre'],
]);

/** Les deux thèmes, dans l'ordre du réglage. */
export const THEMES = Object.freeze([...CLES.keys()]);

/** Le thème d'un lancement : la préférence du système, à chaque lancement ; le
 *  réglage de l'opérateur vaut ensuite pour la séance, en mémoire, et rien ne
 *  l'enregistre. systemeSombre : la préférence sombre du système est posée. */
export function themeInitial(systemeSombre) {
  return systemeSombre === true ? 'sombre' : 'clair';
}

/**
 * La clé du nom d'un thème, coquille.theme.<nom>.
 *
 * @param {string} theme
 * @returns {string}
 * @throws {RangeError} hors de THEMES
 */
export function cleDeTheme(theme) {
  const cle = CLES.get(theme);
  if (cle === undefined) throw new RangeError(`thème inconnu : ${JSON.stringify(theme)}`);
  return cle;
}
