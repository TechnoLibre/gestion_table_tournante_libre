// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La machine d'un menu d'actions (§ 14.5), pure : MenuActions.svelte la
// câble. Le menu suit le motif du bouton de menu de WAI-ARIA ; les touches
// se lisent par effetDe (raccourcis.js), contextes 'boutonMenu' et 'menu',
// et ce module ne reçoit que leurs effets.
//
// Sur le bouton, ouvrirPremier ouvre le menu sur son premier élément,
// ouvrirDernier sur le dernier. Dans le menu ouvert, suivant et precedent
// passent à l'élément voisin et bouclent d'un bout à l'autre ; premier et
// dernier vont aux bouts. fermer et quitter ne déplacent rien : le composant
// ferme le menu, et rend le focus au bouton pour fermer seulement.
//
// Un élément est { cle, nom?, details?, nomAccessible?, executer } : son
// libellé, la clé cle traduite sous details ; sa désignation, nom, ou à
// défaut le dernier segment de cle, comme celle d'une commande ; son nom
// accessible, déjà traduit, ou null quand son libellé le nomme ; executer,
// son geste. La liste des éléments n'est jamais vide, et deux éléments n'y
// partagent pas une désignation.

/**
 * La désignation d'un élément : nom, ou à défaut le dernier segment de cle.
 *
 * @param {{cle: string, nom?: string|null}} element
 * @returns {string}
 */
export function designationDe({ cle, nom = null }) {
  return nom ?? cle.slice(cle.lastIndexOf('.') + 1);
}

/**
 * Les éléments d'un menu, rendus tels quels.
 *
 * @param {ReadonlyArray<{cle: string, nom?: string|null}>} elements
 * @returns {typeof elements}
 * @throws {RangeError} une liste vide ; une désignation vide, ou en double,
 *   qu'elle nomme
 */
export function exigerElements(elements) {
  if (elements.length === 0) throw new RangeError('menu : liste d’éléments vide');
  const vues = new Set();
  for (const element of elements) {
    const designation = designationDe(element);
    if (designation === '') throw new RangeError(`menu : élément sans désignation, clé ${JSON.stringify(element.cle)}`);
    if (vues.has(designation)) throw new RangeError(`menu : désignation en double ${JSON.stringify(designation)}`);
    vues.add(designation);
  }
  return elements;
}

// Un menu de total éléments, total entier d'au moins 1.
function exigerTotal(total) {
  if (!(Number.isInteger(total) && total >= 1)) throw new RangeError(`menu : menu vide (${total} éléments)`);
}

/**
 * Le rang de l'élément qui reçoit le focus à l'ouverture.
 *
 * @param {'ouvrirPremier'|'ouvrirDernier'} effet  l'effet de la touche sur
 *   le bouton (contexte 'boutonMenu')
 * @param {number} total  le nombre d'éléments
 * @returns {number}  0 pour ouvrirPremier, total - 1 pour ouvrirDernier
 * @throws {RangeError} un autre effet, qu'elle nomme ; un menu vide
 */
export function rangOuverture(effet, total) {
  exigerTotal(total);
  if (effet === 'ouvrirPremier') return 0;
  if (effet === 'ouvrirDernier') return total - 1;
  throw new RangeError(`menu : effet d’ouverture inconnu ${JSON.stringify(effet) ?? 'undefined'}`);
}

/**
 * Le rang de l'élément qui reçoit le focus après un déplacement.
 *
 * @param {'suivant'|'precedent'|'premier'|'dernier'} effet  l'effet de la
 *   touche dans le menu ouvert (contexte 'menu')
 * @param {number} rang  celui de l'élément qui a le focus, de 0 à total - 1
 * @param {number} total  le nombre d'éléments
 * @returns {number}
 * @throws {RangeError} un effet qui ne déplace pas, qu'elle nomme ; un rang
 *   hors du menu ; un menu vide
 */
export function rangApres(effet, rang, total) {
  exigerTotal(total);
  if (!(Number.isInteger(rang) && rang >= 0 && rang < total)) throw new RangeError(`menu : rang ${rang} hors d’un menu de ${total} éléments`);
  switch (effet) {
    case 'suivant':
      return (rang + 1) % total;
    case 'precedent':
      return (rang - 1 + total) % total;
    case 'premier':
      return 0;
    case 'dernier':
      return total - 1;
    default:
      throw new RangeError(`menu : effet de déplacement inconnu ${JSON.stringify(effet) ?? 'undefined'}`);
  }
}

// Vrai quand l'appui { clientX, clientY } tombe à rayon px au plus du point
// { x, y } sur chacun des deux axes, bornes comprises.
export function presDe({ clientX, clientY }, { x, y }, rayon) {
  return Math.abs(clientX - x) <= rayon && Math.abs(clientY - y) <= rayon;
}
