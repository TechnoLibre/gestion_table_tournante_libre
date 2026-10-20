// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

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

/** Bornes de l'encre d'un chiffre de la face grasse de Noto Sans, en part
 *  du corps. Sa chasse, 0,572 : les chiffres y sont tabulaires, et l'encre
 *  d'un nombre tient dans la somme de leurs chasses. Puis l'encre au-dessus
 *  et au-dessous de l'ancre d'un <text> en dominant-baseline central :
 *  l'ancre est au milieu de la boîte de la police (ascendante 1,069,
 *  descendante 0,293), la ligne de base 0,388 sous elle, et l'encre d'un
 *  chiffre monte de 0,735 au plus au-dessus de la base, descend de 0,016 au
 *  plus dessous : 0,347 au-dessus de l'ancre, 0,404 au-dessous, bornés par
 *  excès. */
export const AVANCE_CHIFFRE = 0.572;
export const ENCRE_HAUT_CHIFFRE = 0.35;
export const ENCRE_BAS_CHIFFRE = 0.41;
/** Décalage vertical de l'encre d'un <text> en dominant-baseline central,
 *  en cm, au plus : le moteur de rendu tire le milieu de la boîte de la
 *  police de son ascendante et de sa descendante arrondies à l'unité du
 *  dessin, et la ligne de base s'écarte d'un demi-cm au plus de celle que la
 *  police donne, à tout zoom. */
export const DECALAGE_ANCRE = 0.5;
/** Écart minimal entre l'encre du numéro et la pastille, la marque de gel ou
 *  le bord du plateau, en cm. */
export const ECART_NUMERO = 1.5;

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

// Les pas de la dichotomie qui cherche le corps du numéro : chacun divise
// par deux un intervalle de quelques centaines de cm au plus.
const PAS_DU_CORPS = 40;

// La boîte qui borne l'encre d'un numéro de chiffres chiffres, ancré en
// (x, y) au corps corps, en cm.
function encreBornee(x, y, corps, chiffres) {
  const demi = (chiffres * AVANCE_CHIFFRE * corps) / 2;
  return {
    gauche: x - demi,
    droite: x + demi,
    haut: y - ENCRE_HAUT_CHIFFRE * corps - DECALAGE_ANCRE,
    bas: y + ENCRE_BAS_CHIFFRE * corps + DECALAGE_ANCRE,
  };
}

// Vrai quand l'encre bornée encre se tient à ECART_NUMERO au moins du
// disque de la pastille centré en pastille, du bas de la marque de gel,
// basGel, et du bord du plateau : le coin de la boîte le plus loin du centre
// reste dans le disque d'une ronde, ou le carré d'une carrée, rétréci de
// l'écart.
function degagee({ forme, centre, demiTaille }, pastille, basGel, encre) {
  const dx = Math.max(0, encre.gauche - pastille.x, pastille.x - encre.droite);
  const dy = Math.max(0, encre.haut - pastille.y, pastille.y - encre.bas);
  const lx = Math.max(centre.x - encre.gauche, encre.droite - centre.x);
  const ly = Math.max(centre.y - encre.haut, encre.bas - centre.y);
  return (
    Math.hypot(dx, dy) >= RAYON_PASTILLE + ECART_NUMERO &&
    encre.haut >= basGel + ECART_NUMERO &&
    (forme === 'ronde' ? Math.hypot(lx, ly) : Math.max(lx, ly)) <= demiTaille - ECART_NUMERO
  );
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
 * au-dessus du point où il se poserait seul.
 *
 * Ce corps est un plafond. L'encre du numéro, que bornent ses chiffres
 * (AVANCE_CHIFFRE, ENCRE_HAUT_CHIFFRE, ENCRE_BAS_CHIFFRE) et l'arrondi du
 * rendu (DECALAGE_ANCRE), se tient à ECART_NUMERO de la pastille, du bas de
 * la marque de gel et du bord du plateau : quand elle ne le fait pas au
 * plafond, le corps est le plus grand qui l'y tient, cherché par
 * dichotomie, à la même place. Il ne descend jamais sous le corps des
 * listes : un numéro que ce corps ne dégage pas le garde. Jusqu'à deux
 * chiffres, aucun plateau ne réduit le corps.
 *
 * La place ne dépend que de la forme, des places et du nombre de chiffres,
 * pas de la présence de la pastille ni de la marque de gel : un conflit ou
 * le gel d'une table ne déplace pas son numéro, ni n'en change le corps.
 *
 * @param {import('./tables.js').GeometrieTable} geometrie
 * @param {{libelle?: boolean}} [options]   libelle : vrai quand un libellé suit le numéro
 * @returns {{x: number, y: number, corps: number}}
 */
export function placeNumero(geometrie, { libelle = false } = {}) {
  const { centre, demiTaille } = geometrie;
  const basGel = placeGel(geometrie).y + DEMI_HAUTEUR_GEL;
  const corpsMax = corpsNumero(demiTaille);
  const plafond = libelle ? Math.min(corpsMax, Math.max(TAILLE_TEXTE_LISTE_CM, centre.y - basGel)) : corpsMax;
  // L'ordonnée de l'ancre au corps c. Avec un libellé, sous le plafond, le
  // cadratin touche le centre par le bas, ou se pose sous la marque de gel.
  const ancre = libelle ? (c) => Math.max(centre.y - c / 2, basGel + c / 2) : () => centre.y;
  const chiffres = String(geometrie.numero).length;
  const pastille = placePastille(geometrie);
  const tient = (c) => degagee(geometrie, pastille, basGel, encreBornee(centre.x, ancre(c), c, chiffres));
  let corps = plafond;
  if (!tient(plafond)) {
    // Sous le plafond, un corps plus petit rétrécit l'encre autour de son
    // ancre, qui ne monte pas : tient est vrai jusqu'à un corps, faux
    // au-delà.
    let [bas, haut] = [TAILLE_TEXTE_LISTE_CM, plafond];
    if (tient(bas)) {
      for (let pas = 0; pas < PAS_DU_CORPS; pas += 1) {
        const milieu = (bas + haut) / 2;
        if (tient(milieu)) bas = milieu;
        else haut = milieu;
      }
    }
    corps = bas;
  }
  return { x: centre.x, y: ancre(corps), corps };
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
