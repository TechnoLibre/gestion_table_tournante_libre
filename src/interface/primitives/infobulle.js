// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La place d'une infobulle à côté du terme qu'elle explique, pure :
// Infobulle.svelte la calcule à chaque ouverture, défilement et
// redimensionnement, sur les rectangles relus du rendu. Toutes les
// grandeurs sont en px CSS, dans le repère de la fenêtre.
//
// L'infobulle se pose sous le terme, à ECART_INFOBULLE_PX de lui, quand
// elle y tient ; au-dessus sinon : elle ne couvre jamais le terme qu'elle
// explique dès qu'un des deux côtés la reçoit. Quand aucun ne la reçoit, elle
// prend le plus grand et reste dans le cadre, quitte à couvrir le terme.
// Horizontalement, elle s'aligne sur le bord gauche du terme, puis recule
// pour garder MARGE_INFOBULLE_PX entre elle et chaque bord du cadre ; plus
// large que le cadre, elle se colle à la marge gauche.

/** Distance entre le terme et l'infobulle, en px. */
export const ECART_INFOBULLE_PX = 6;

/** Distance minimale entre l'infobulle et chaque bord du cadre, en px. */
export const MARGE_INFOBULLE_PX = 8;

/**
 * La place d'une infobulle.
 *
 * @param {{gauche: number, haut: number, droite: number, bas: number}} ancre
 *   le rectangle du terme expliqué
 * @param {{largeur: number, hauteur: number}} taille  celle de l'infobulle
 * @param {{largeur: number, hauteur: number}} cadre  la partie visible de la
 *   fenêtre, barres de défilement exclues
 * @returns {{gauche: number, haut: number, cote: 'dessous'|'dessus'}}  le coin
 *   haut gauche de l'infobulle, et le côté du terme où elle se pose
 */
export function placerInfobulle(ancre, { largeur, hauteur }, cadre) {
  const gaucheMax = cadre.largeur - MARGE_INFOBULLE_PX - largeur;
  const gauche = Math.max(MARGE_INFOBULLE_PX, Math.min(ancre.gauche, gaucheMax));

  const dessous = ancre.bas + ECART_INFOBULLE_PX;
  const dessus = ancre.haut - ECART_INFOBULLE_PX - hauteur;
  const basMax = cadre.hauteur - MARGE_INFOBULLE_PX;
  if (dessous + hauteur <= basMax) return { gauche, haut: dessous, cote: 'dessous' };
  if (dessus >= MARGE_INFOBULLE_PX) return { gauche, haut: dessus, cote: 'dessus' };

  // Aucun côté ne la reçoit : le plus grand, la boîte ramenée dans le cadre.
  const placeDessous = basMax - dessous;
  const placeDessus = ancre.haut - ECART_INFOBULLE_PX - MARGE_INFOBULLE_PX;
  const cote = placeDessous >= placeDessus ? 'dessous' : 'dessus';
  const voulu = cote === 'dessous' ? dessous : dessus;
  const haut = Math.max(MARGE_INFOBULLE_PX, Math.min(voulu, basMax - hauteur));
  return { gauche, haut, cote };
}
