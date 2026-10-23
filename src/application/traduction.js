// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le mécanisme de traduction (§ 14.6), unique pour l'application et les
// écrans. Il réunit des tables — chacune une Map clé → chaîne, ou clé →
// fonction (details, texte) → chaîne — et rend t(cle, details), le texte
// d'une clé. Une clé portée par deux tables lève à la création ; une clé
// absente lève RangeError, qui la nomme : l'écran ne montre jamais une clé
// brute ni un texte vide.
//
// texte(cle, details), que reçoit une fonction de table, compose une autre
// clé des mêmes tables, toujours en français ; texte.existe(cle) dit si une
// clé a son texte, pour un détail qui porte un code ou une cause du système.
// En langue témoin, t encadre de la marque son résultat entier, une fois :
// une composition par texte n'en ajoute aucune.
//
// L'option ecran fait de t celui de l'écran : son résultat entier passe une
// fois par typographier, qui pose les insécables de la ponctuation haute,
// avant la marque témoin ; texte, la composition interne, reste brut. Sans
// elle, t rend le texte tel que les tables l'écrivent : c'est le t des
// textes qui quittent l'écran — journal, CSV, PDF, documentation.
import { typographier } from './typographie.js';

/** Les deux marques de la langue témoin, U+2045 et U+2046. */
export const MARQUE_TEMOIN = Object.freeze({ ouverture: '\u{2045}', fermeture: '\u{2046}' });

const LANGUES = ['fr', 'temoin'];

// Deux chaînes, comparées unité UTF-16 par unité.
const comparerTextes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * La traduction de ces tables, dans cette langue.
 *
 * @param {Array<Map<string, string|((details: Object, texte: Function) => string)>>} tables
 * @param {{langue?: 'fr'|'temoin', ecran?: boolean}} [options]  ecran :
 *   vrai pour le t de l'écran, qui typographie son résultat ; faux par
 *   défaut
 * @returns {{t: (cle: string, details?: Object) => string, cles: () => string[], langue: string}}
 *   t lève RangeError sur une clé absente, TypeError quand une fonction de
 *   table ne rend pas une chaîne ; cles() rend toutes les clés, triées par
 *   unités UTF-16
 * @throws {RangeError} une clé de deux tables, une langue inconnue
 * @throws {TypeError} une table qui n'est pas une Map, une entrée ni chaîne
 *   ni fonction, une option ecran qui n'est pas un booléen
 */
export function creerTraduction(tables, { langue = 'fr', ecran = false } = {}) {
  if (!LANGUES.includes(langue)) throw new RangeError(`traduction : langue inconnue ${JSON.stringify(langue)}`);
  if (typeof ecran !== 'boolean') throw new TypeError(`traduction : ecran est un booléen, reçu ${JSON.stringify(ecran)}`);
  const entrees = new Map();
  for (const table of tables) {
    if (!(table instanceof Map)) throw new TypeError('traduction : chaque table est une Map');
    for (const [cle, entree] of table) {
      if (entrees.has(cle)) {
        throw new RangeError(`traduction : la clé ${JSON.stringify(cle)} est portée par deux tables`);
      }
      if (typeof entree !== 'string' && typeof entree !== 'function') {
        throw new TypeError(`traduction : ${JSON.stringify(cle)} n'est ni une chaîne ni une fonction`);
      }
      entrees.set(cle, entree);
    }
  }

  // Le texte français d'une clé : la chaîne, ou ce que rend la fonction de
  // ses détails, un objet vide quand ils manquent.
  function texte(cle, details = {}) {
    const entree = entrees.get(cle);
    if (entree === undefined) throw new RangeError(`traduction : clé inconnue ${JSON.stringify(cle)}`);
    if (typeof entree === 'string') return entree;
    const rendu = entree(details ?? {}, texte);
    if (typeof rendu !== 'string') throw new TypeError(`traduction : ${JSON.stringify(cle)} ne rend pas une chaîne`);
    return rendu;
  }
  texte.existe = (cle) => entrees.has(cle);

  const { ouverture, fermeture } = MARQUE_TEMOIN;
  const rendu = ecran ? (cle, details) => typographier(texte(cle, details)) : (cle, details) => texte(cle, details);
  const t = langue === 'temoin' ? (cle, details) => `${ouverture}${rendu(cle, details)}${fermeture}` : rendu;
  const triees = Object.freeze([...entrees.keys()].sort(comparerTextes));
  return { t, cles: () => [...triees], langue };
}
