// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les mesures du texte du plan, au navigateur (§ 7.4, § 14.1) : la hauteur
// d'une ligne de liste et la largeur d'une chaîne, relevées sur la police
// rendue, jamais déduites de la taille de police. La hauteur se mesure dans
// un OffscreenCanvas, hors du document : le plan ne porte aucun <canvas>.

import { GABARIT_HAUTEUR_LIGNE } from '../../geometrie/texte.js';

const SVG = 'http://www.w3.org/2000/svg';

/**
 * Hauteur d'encre du gabarit « Ôjgq Æ W » sur la police calculée de
 * l'élément : actualBoundingBoxAscent + actualBoundingBoxDescent d'un
 * OffscreenCanvas réglé sur elle — style, graisse, corps et famille. Le
 * corps calculé d'un texte du dessin est en unités du dessin : la hauteur
 * rendue est en cm, quel que soit le zoom.
 *
 * @param {Element} elementTexte
 * @returns {number}
 */
export function hauteurLigne(elementTexte) {
  const { fontStyle, fontWeight, fontSize, fontFamily } = getComputedStyle(elementTexte);
  const contexte = new OffscreenCanvas(1, 1).getContext('2d');
  contexte.font = `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`;
  const mesure = contexte.measureText(GABARIT_HAUTEUR_LIGNE);
  return mesure.actualBoundingBoxAscent + mesure.actualBoundingBoxDescent;
}

/**
 * La sonde est-elle rendue : un texte sous un ancêtre en display: none n'a
 * pas de mise en page, et getComputedTextLength y rend 0 pour toute chaîne.
 * La visibilité (visibility: hidden) n'y entre pas : la sonde du plan est
 * cachée ainsi et se mesure.
 *
 * @param {Element} elementTexte
 * @returns {boolean}
 */
export function mesurable(elementTexte) {
  return elementTexte.isConnected && elementTexte.checkVisibility();
}

/**
 * La mesure de largeur d'une chaîne au style de l'élément : un tspan sonde,
 * ajouté à l'élément le temps de getComputedTextLength, puis retiré. Un
 * élément en italique mesure en italique. Chaque chaîne se mesure une fois :
 * la police calculée de l'élément est fixe pour la durée du mesureur. Une
 * largeur nulle d'une chaîne non vide — l'élément n'est pas rendu — ne se
 * retient pas : la chaîne se mesure de nouveau à la demande suivante.
 *
 * @param {Element} elementTexte   un <text> ou un <tspan> du dessin
 * @returns {(chaine: string) => number}   largeur en unités du dessin
 */
export function creerMesureur(elementTexte) {
  const deja = new Map();
  return (chaine) => {
    const connue = deja.get(chaine);
    if (connue !== undefined) return connue;
    const sonde = elementTexte.ownerDocument.createElementNS(SVG, 'tspan');
    sonde.textContent = chaine;
    elementTexte.append(sonde);
    const largeur = sonde.getComputedTextLength();
    sonde.remove();
    if (largeur > 0 || chaine === '') deja.set(chaine, largeur);
    return largeur;
  };
}
