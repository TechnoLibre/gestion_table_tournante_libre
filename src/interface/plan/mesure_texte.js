// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les mesures du texte du plan, au navigateur (§ 7.4, § 14.1) : la hauteur
// d'une ligne de liste et la largeur d'une chaîne, relevées sur la police
// rendue, jamais déduites de la taille de police. La hauteur se mesure dans
// un OffscreenCanvas, hors du document : le plan ne porte aucun <canvas>.
// Les graphiques de la page de qualité mesurent par mesuresDuTexte, qui
// garde les largeurs pour la séance et les relève par lots.

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

// Les mesures déjà prises pendant la séance, par style de texte (cleDuStyle)
// : { largeurs, hauteur }, largeurs une Map de la chaîne à sa largeur,
// hauteur celle de hauteurLigne, null tant qu'elle n'est pas lue. Une
// police qui finit de se charger change les largeurs sous le même style
// calculé : chaque fin de chargement du document vide la table.
const MESURES_DE_SEANCE = new Map();
let polices = null;

// La clé du style de texte de l'élément : la densité de pixels de l'écran,
// que le lissage des glyphes suit, puis chaque propriété calculée qui
// change la largeur d'une chaîne.
function cleDuStyle(elementTexte) {
  const style = getComputedStyle(elementTexte);
  const proprietes = [
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontStretch',
    'fontSize',
    'fontFamily',
    'letterSpacing',
    'wordSpacing',
    'fontKerning',
    'fontFeatureSettings',
    'fontVariationSettings',
    'textRendering',
  ];
  return [devicePixelRatio, ...proprietes.map((nom) => style[nom])].join('|');
}

// Les mesures de séance du style de l'élément, créées vides au premier
// appel ; la première écoute aussi les fins de chargement des polices.
function mesuresDuStyle(elementTexte) {
  const documentTexte = elementTexte.ownerDocument;
  if (polices !== documentTexte.fonts) {
    polices = documentTexte.fonts;
    polices.addEventListener('loadingdone', () => MESURES_DE_SEANCE.clear());
  }
  const cle = cleDuStyle(elementTexte);
  let connues = MESURES_DE_SEANCE.get(cle);
  if (connues === undefined) {
    connues = { largeurs: new Map(), hauteur: null };
    MESURES_DE_SEANCE.set(cle, connues);
  }
  return connues;
}

/**
 * Les mesures du texte d'un graphique au style de l'élément, gardées pour
 * la séance : deux éléments du même style calculé, à la même densité de
 * pixels, partagent leurs largeurs. L'élément est un <text> d'un dessin
 * sans viewBox, dont l'unité est le pixel CSS.
 *
 * - mesurer(chaine) : la largeur de la chaîne, mesurée à la première
 *   demande ;
 * - calculer(calcul) : ce que calcul(mesurer) rend, calcul une fonction
 *   pure de ses arguments et des largeurs lues. Les chaînes inconnues se
 *   mesurent par lots : calcul s'exécute avec 0 pour chacune, ce qu'il
 *   a demandé et que la séance ignore se mesure d'un seul relevé, puis il
 *   s'exécute de nouveau, jusqu'à ce qu'il ne demande plus rien
 *   d'inconnu. Le rendu final ne lit que des largeurs mesurées, et le
 *   document ne se met en page qu'une fois par lot, au lieu d'une fois par
 *   chaîne ;
 * - hauteurTexte : hauteurLigne de l'élément, lue une fois par style.
 *
 * Chaque chaîne d'un lot se mesure sur sa propre copie de l'élément
 * (cloneNode, sans enfant), posée juste après lui le temps du relevé puis
 * retirée : même style, même contexte, aucun crénage avec une voisine. Une
 * largeur nulle d'une chaîne non vide — l'élément n'est pas rendu — ne se
 * garde pas, comme pour creerMesureur : elle vaut 0 pour le calcul en
 * cours et se mesure de nouveau à la demande suivante.
 *
 * @param {Element} elementTexte
 * @returns {{mesurer: (chaine: string) => number, calculer: <T>(calcul: (mesurer: (chaine: string) => number) => T) => T, hauteurTexte: number}}
 */
export function mesuresDuTexte(elementTexte) {
  const connues = mesuresDuStyle(elementTexte);
  // Mesure les chaînes d'un seul relevé ; garde les largeurs non nulles,
  // et rend la largeur de chacune, nulle comprise.
  const relever = (chaines) => {
    const copies = chaines.map((chaine) => {
      const copie = elementTexte.cloneNode(false);
      copie.textContent = chaine;
      return copie;
    });
    elementTexte.after(...copies);
    const largeurs = copies.map((copie) => copie.getComputedTextLength());
    for (const copie of copies) copie.remove();
    chaines.forEach((chaine, i) => {
      if (largeurs[i] > 0 || chaine === '') connues.largeurs.set(chaine, largeurs[i]);
    });
    return largeurs;
  };
  const mesurer = (chaine) => connues.largeurs.get(chaine) ?? relever([chaine])[0];
  const calculer = (calcul) => {
    const nulles = new Set();
    for (;;) {
      const inconnues = new Set();
      const resultat = calcul((chaine) => {
        const connue = connues.largeurs.get(chaine);
        if (connue === undefined && !nulles.has(chaine)) inconnues.add(chaine);
        return connue ?? 0;
      });
      if (inconnues.size === 0) return resultat;
      relever([...inconnues]);
      for (const chaine of inconnues) if (!connues.largeurs.has(chaine)) nulles.add(chaine);
    }
  };
  if (connues.hauteur === null) connues.hauteur = hauteurLigne(elementTexte);
  return { mesurer, calculer, hauteurTexte: connues.hauteur };
}
