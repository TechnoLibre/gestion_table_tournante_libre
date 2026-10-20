// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Ce qui s'inscrit sur le plateau d'une table (§ 7.5, § 7.7), en cm de
// dessin, l'axe y vers le bas : le numéro de la table, la marque de gel et la
// pastille des conflits. Les places se tirent de la géométrie de la table
// (tables.js) ; aucune ne dépend du zoom, de l'écran ou de l'impression, et
// aucune ne lit le DOM.
import { TAILLE_TEXTE_LISTE_CM } from './texte.js';

/** Part de la largeur du plateau que prend le corps du numéro de la table. */
export const PROPORTION_NUMERO = 0.4;

/** Distance entre le haut du plateau et le centre de la marque de gel, en cm. */
export const RETRAIT_GEL = 13;
/** Demi-hauteur, et demi-largeur au plus, de la marque de gel, en cm. */
export const DEMI_HAUTEUR_GEL = 8;

/** Rayon du disque de la pastille, en cm de dessin. */
export const RAYON_PASTILLE = 15;

// L'angle de la diagonale haut droite, y vers le bas, en radians.
const DIAGONALE = -Math.PI / 4;

/**
 * Corps du numéro d'une table, en cm : PROPORTION_NUMERO de la largeur du
 * plateau, jamais moins que le corps des listes de noms, que l'impression
 * tient pour le corps minimal du dessin (§ 11.7).
 *
 * @param {number} demiTaille  rayon du plateau (ronde) ou demi-côté (carrée), en cm
 * @returns {number} cm
 */
export function corpsNumero(demiTaille) {
  return Math.max(TAILLE_TEXTE_LISTE_CM, PROPORTION_NUMERO * 2 * demiTaille);
}

/**
 * Le centre de la marque de gel : sur l'axe vertical du plateau, RETRAIT_GEL
 * sous son haut.
 *
 * @param {import('./tables.js').GeometrieTable} geometrie
 * @returns {{x: number, y: number}}
 */
export function placeGel({ centre, demiTaille }) {
  return { x: centre.x, y: centre.y - demiTaille + RETRAIT_GEL };
}

/**
 * La place du numéro d'une table : x et y, le centre de son cadratin —
 * l'ancre d'un <text> centré, text-anchor middle et dominant-baseline
 * central —, et son corps, en cm.
 *
 * Sans libellé, le numéro se pose au centre du plateau, au corps de
 * corpsNumero. Avec un libellé, qui se pose dessous, il monte dans la bande
 * qui va du bas de la marque de gel au centre du plateau : son cadratin la
 * remplit, au corps de la bande, plafonné à corpsNumero. Une bande plus
 * étroite que le corps des listes donne ce corps au numéro, son cadratin
 * posé sous la marque de gel : il descend alors sous le centre, mais reste
 * au-dessus du point où il se poserait seul. La place ne dépend pas de la
 * présence de la marque de gel : geler une table ne déplace pas son numéro.
 *
 * @param {import('./tables.js').GeometrieTable} geometrie
 * @param {{libelle?: boolean}} [options]   libelle : vrai quand un libellé suit le numéro
 * @returns {{x: number, y: number, corps: number}}
 */
export function placeNumero(geometrie, { libelle = false } = {}) {
  const { centre, demiTaille } = geometrie;
  const corps = corpsNumero(demiTaille);
  if (!libelle) return { x: centre.x, y: centre.y, corps };
  const basGel = placeGel(geometrie).y + DEMI_HAUTEUR_GEL;
  const corpsMonte = Math.min(corps, Math.max(TAILLE_TEXTE_LISTE_CM, centre.y - basGel));
  return { x: centre.x, y: Math.max(centre.y - corpsMonte / 2, basGel + corpsMonte / 2), corps: corpsMonte };
}

/**
 * Le centre de la pastille d'une table, posée en haut à droite du plateau,
 * sur son bord, comme un badge : au coin haut droit d'une carrée ; sur le
 * cercle d'une ronde, à la diagonale −45°, à moins qu'une chaise ne touche
 * là le disque de la pastille — alors au milieu de l'intervalle entre deux
 * chaises voisines le plus proche de la diagonale, celui du haut quand deux
 * le sont autant.
 *
 * Les chaises d'une ronde se posent à −90° + 360° × (s − 1) / places
 * (tables.js) ; deux voisines sont à un pas d'au moins 60 cm au bord du
 * plateau, et le milieu de leur intervalle est à plus de RAYON_PASTILLE +
 * RAYON_CHAISE du centre de chacune. Le coin d'une carrée en est aussi loin :
 * la chaise la plus proche est à un demi-pas au moins le long du côté, et
 * RAYON_CHAISE au-delà du bord. La pastille ne couvre aucune chaise.
 *
 * @param {import('./tables.js').GeometrieTable} geometrie
 * @returns {{x: number, y: number}}
 */
export function placePastille({ forme, centre, demiTaille, chaises }) {
  if (forme !== 'ronde') return { x: centre.x + demiTaille, y: centre.y - demiTaille };
  const auBord = (angle) => ({ x: centre.x + demiTaille * Math.cos(angle), y: centre.y + demiTaille * Math.sin(angle) });
  const degagee = (point) => chaises.every((chaise) => Math.hypot(chaise.x - point.x, chaise.y - point.y) >= RAYON_PASTILLE + chaise.rayon);
  const diagonale = auBord(DIAGONALE);
  if (degagee(diagonale)) return diagonale;
  const pas = (2 * Math.PI) / chaises.length;
  let meilleur = null;
  for (let i = 0; i < chaises.length; i += 1) {
    const angle = -Math.PI / 2 + (i + 0.5) * pas;
    const ecart = Math.abs(Math.atan2(Math.sin(angle - DIAGONALE), Math.cos(angle - DIAGONALE)));
    // Les milieux croissent avec i depuis le haut : à écart égal, le premier
    // trouvé est celui du haut.
    if (meilleur === null || ecart < meilleur.ecart - 1e-9) meilleur = { angle, ecart };
  }
  return auBord(meilleur.angle);
}
