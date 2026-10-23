// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les espaces insécables de l'écran (§ 14.6), posées à l'affichage : le t de
// l'écran et l'historique passent leur texte par typographier, les tables et
// les données gardent leurs espaces ordinaires. Deux expressions, chacune lue
// en un seul passage de gauche à droite.
//
// La ponctuation haute : la suite d'espaces — U+0020, U+00A0, U+202F — qui
// suit « ou précède : et » devient une seule insécable U+00A0 ; celle qui
// précède ; ? ! une seule fine insécable U+202F. Une suite se réduit à un
// caractère : une espace ordinaire laissée devant l'insécable rouvrirait la
// coupure de ligne. Le saut de ligne et la tabulation ne font pas partie de
// la suite, et un signe sans espace devant — 21:42, https://, C:\ — reste
// tel. L'espace qui suit « appartient au guillemet, même devant un signe
// (« ; » rend «⍽;⍽», ⍽ pour U+00A0).
//
// Les liaisons : la suite d'espaces entre un nombre — chiffres, groupés par
// U+202F ou décimaux à virgule, qu'aucune lettre ni chiffre ne précède — et
// une unité de UNITES, mot entier ; entre le « h » d'une heure et ses
// minutes sur deux chiffres qu'aucune unité ne suit (« 20 h 30 », et non le
// « h 15 » de « 2 h 15 min ») ; après « n° » ou « N° » devant une lettre ou un
// chiffre ; entre le jour (« 1er » ou un ou deux chiffres) et un mois de
// MOIS, et entre ce mois et une année de quatre chiffres. Elle devient une
// U+00A0 ; une suite qui porte déjà une U+202F, ou qui précède « % », devient
// une U+202F, la forme des pourcentages de la mise en forme. Un mot qui
// commence par une unité sans en être une — « 3 sièges », « 4 tours » —, ou
// qu'une apostrophe ou un trait d'union prolonge — « 3 s'y » —, reste
// sécable, comme l'espace entre « min » et le nombre qui le suit. Le mois,
// l'année et les minutes s'arrêtent à tout ce qui n'est ni lettre ni
// chiffre : le trait d'union d'une plage — « du 3 mai-5 juin », « de 20 h
// 30-22 h 00 » — ou un guillemet simple qui les suit laisse la liaison.
//
// Les deux expressions n'agissent pas sur les mêmes suites, et leur résultat
// ne porte plus aucune suite à réduire : typographier est idempotente.

const INSECABLE = '\u{00A0}';
const FINE = '\u{202F}';
const PONCTUATION_HAUTE = /(«)[ \u{00A0}\u{202F}]+|[ \u{00A0}\u{202F}]+([;:?!»])/gu;

/** Les unités qu'un nombre garde contre lui. */
export const UNITES = Object.freeze(['h', 'min', 's', 'ms', 'mm', 'cm', 'm', 'km', 'po', 'pt', 'px', 'Mo', 'Ko', 'Go', 'Mpx', '%', '°C']);

/** Les mois d'une date en lettres. */
export const MOIS = Object.freeze([
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]);

// Les morceaux des liaisons, en source d'expression : la suite d'espaces, le
// début d'un mot, la fin d'un mot entier — d'un mois, d'une année, de
// minutes —, la fin d'une unité, que l'apostrophe et le trait d'union
// prolongent aussi, un nombre, une unité, un mois.
const SUITE = '[ \\u{00A0}\\u{202F}]+';
const DEBUT = '(?<![\\p{L}\\p{N}])';
const FIN = '(?![\\p{L}\\p{N}])';
const FIN_UNITE = "(?![\\p{L}\\p{N}'\\u{2019}-])";
const NOMBRE = `${DEBUT}\\d[\\d\\u{202F}]*(?:,\\d+)?`;
const UNITE = `(?:${UNITES.join('|')})${FIN_UNITE}`;
const NOM_DE_MOIS = `(?:${MOIS.join('|')})`;

// Une liaison entière, ses suites d'espaces comprises ; les alternatives,
// essayées dans l'ordre à chaque position : la date, le mois et l'année,
// l'heure, le nombre et son unité, « n° ».
const LIAISONS = new RegExp(
  [
    `${DEBUT}(?:1er|\\d{1,2})${SUITE}${NOM_DE_MOIS}(?:${SUITE}\\d{4})?${FIN}`,
    `${DEBUT}${NOM_DE_MOIS}${SUITE}\\d{4}${FIN}`,
    `${NOMBRE}${SUITE}h${SUITE}\\d{2}${FIN}(?!${SUITE}${UNITE})`,
    `${NOMBRE}${SUITE}${UNITE}`,
    `${DEBUT}[nN]°${SUITE}(?=[\\p{L}\\p{N}])`,
  ].join('|'),
  'gu',
);
const SUITES = new RegExp(SUITE, 'gu');

/**
 * Le texte, ses espaces de ponctuation haute, d'unité, de « n° » et de date
 * rendues insécables.
 *
 * @param {string} texte
 * @returns {string}  le même texte, où seules des espaces ont changé
 * @throws {TypeError} un texte qui n'est pas une chaîne
 */
export function typographier(texte) {
  if (typeof texte !== 'string') throw new TypeError(`typographier : une chaîne attendue, reçu ${typeof texte}`);
  return texte
    .replace(PONCTUATION_HAUTE, (_, ouvrant, signe) =>
      ouvrant !== undefined ? `«${INSECABLE}` : `${signe === ':' || signe === '»' ? INSECABLE : FINE}${signe}`,
    )
    .replace(LIAISONS, (liaison) =>
      liaison.replace(SUITES, (suite) => (suite.includes(FINE) || liaison.endsWith('%') ? FINE : INSECABLE)),
    );
}
