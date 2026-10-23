// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les espaces de la ponctuation haute (§ 14.6), posées à l'affichage : le t
// de l'écran et l'historique passent leur texte par typographier, les tables
// et les données gardent leurs espaces ordinaires. La suite d'espaces —
// U+0020, U+00A0, U+202F — qui suit « ou précède : et » devient une seule
// insécable U+00A0 ; celle qui précède ; ? ! une seule fine insécable
// U+202F. Une suite se réduit à un caractère : une espace ordinaire laissée
// devant l'insécable rouvrirait la coupure de ligne. Le saut de ligne et la
// tabulation ne font pas partie de la suite, et un signe sans espace devant
// — 21:42, https://, C:\ — reste tel. L'expression se lit en un seul passage,
// de gauche à droite : l'espace qui suit « appartient au guillemet, même
// devant un signe (« ; » rend «⍽;⍽», ⍽ pour U+00A0). Le résultat ne porte
// plus aucune suite à réduire : typographier est idempotente.

const INSECABLE = '\u{00A0}';
const FINE = '\u{202F}';
const PONCTUATION_HAUTE = /(«)[ \u{00A0}\u{202F}]+|[ \u{00A0}\u{202F}]+([;:?!»])/gu;

/**
 * Le texte, ses espaces de ponctuation haute rendues insécables.
 *
 * @param {string} texte
 * @returns {string}  le même texte, où seules des espaces ont changé
 * @throws {TypeError} un texte qui n'est pas une chaîne
 */
export function typographier(texte) {
  if (typeof texte !== 'string') throw new TypeError(`typographier : une chaîne attendue, reçu ${typeof texte}`);
  return texte.replace(PONCTUATION_HAUTE, (_, ouvrant, signe) =>
    ouvrant !== undefined ? `«${INSECABLE}` : `${signe === ':' || signe === '»' ? INSECABLE : FINE}${signe}`,
  );
}
