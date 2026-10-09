// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La feuille de style que le pilotage injecte (§ 19.2, § 19.4) : elle annule
// toute transition et toute animation, l'icône de chargement de l'accueil
// comprise. Une capture d'écran prise à mi-transition serait une image
// différente à chaque exécution, et un écran qui attendrait transitionend
// ne viendrait jamais : le parcours photographié et l'épreuve transversale
// posent la même feuille, d'ici seul.
//
// La feuille posée porte l'attribut data-feuille-capture : photographier
// (captures.js) la cherche dans le document et refuse une capture sans elle.

/** Le texte de la feuille : transitions et animations annulées sur tout
 *  élément et ses pseudo-éléments. */
export const SANS_MOUVEMENT = '*,*::before,*::after{transition:none!important;animation:none!important}';

/** L'attribut qui désigne la feuille posée. */
export const ATTRIBUT_FEUILLE = 'data-feuille-capture';

/**
 * Pose la feuille dans <head> et rend la fonction qui la retire. Deux poses
 * posent deux feuilles, chacune retirée par sa propre fonction.
 *
 * @param {Document} [document]
 * @returns {() => void}
 */
export function poserFeuille(document = globalThis.document) {
  const feuille = document.createElement('style');
  feuille.setAttribute(ATTRIBUT_FEUILLE, '');
  feuille.textContent = SANS_MOUVEMENT;
  document.head.append(feuille);
  return () => feuille.remove();
}

/** Vrai quand une feuille posée par poserFeuille est dans le document, au
 *  texte de SANS_MOUVEMENT. */
export function feuillePosee(document = globalThis.document) {
  return [...document.head.querySelectorAll(`style[${ATTRIBUT_FEUILLE}]`)].some((feuille) => feuille.textContent === SANS_MOUVEMENT);
}
