// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La vue du plan (§ 7.2) : trois nombres, k en px/cm, tx et ty en px CSS, que
// le dessin écrit dans un seul attribut, transform="translate(tx,ty) scale(k)",
// sur le groupe [data-vue] d'un <svg data-plan> sans viewBox. Toute
// conversion entre l'écran et le dessin passe par ce module : le dessin, la
// désignation d'un siège et le dépôt d'un glissement lisent la même formule.
// Aucune fonction ne lit le DOM : le cadre, rectangle du <svg> à l'écran, est
// un paramètre que l'appelant relit au pointerdown.

/** @typedef {{k: number, tx: number, ty: number}} Vue */
/** @typedef {{gauche: number, haut: number, largeur: number, hauteur: number}} Cadre */
/** @typedef {{x: number, y: number}} Point */
/** @typedef {{minX: number, minY: number, maxX: number, maxY: number}} Englobant */

/** Borne haute du zoom, en px/cm (§ 7.2). */
export const K_MAX = 10;
/** k_min = FACTEUR_K_MIN × k_ajusté ; aucune borne basse absolue (§ 7.2). */
export const FACTEUR_K_MIN = 0.5;
/** k ajusté d'un plan sans table, en px/cm : sans englobant, rien ne fixe d'échelle. */
export const K_PLAN_VIDE = 1;
/** Marge laissée de chaque côté du cadre par l'ajustement, en px. */
export const MARGE_AJUSTEMENT_PX = 16;
/** Facteur de zoom d'un cran de molette. */
export const FACTEUR_CRAN = 1.1;

// Longueur d'un cran de molette, par valeur de WheelEvent.deltaMode : en
// pixels, en lignes, en pages.
const CRAN_PAR_MODE = [100, 3, 1];

/**
 * Point de dessin, en cm, sous le point écran (xEcran, yEcran), en px CSS de
 * la fenêtre : la formule du § 7.2, cadre soustrait avant la translation, la
 * division par k en dernier.
 * @param {Vue} vue  @param {Cadre} cadre
 * @returns {Point}
 */
export function dessinDepuisEcran(vue, cadre, xEcran, yEcran) {
  return { x: (xEcran - cadre.gauche - vue.tx) / vue.k, y: (yEcran - cadre.haut - vue.ty) / vue.k };
}

/**
 * Point écran, en px CSS de la fenêtre, du point de dessin (x, y) en cm : la
 * réciproque de dessinDepuisEcran.
 * @param {Vue} vue  @param {Cadre} cadre
 * @returns {Point}
 */
export function ecranDepuisDessin(vue, cadre, x, y) {
  return { x: cadre.gauche + vue.tx + vue.k * x, y: cadre.haut + vue.ty + vue.k * y };
}

/**
 * Le k qui fait tenir l'englobant dans le cadre moins ses marges, plafonné à
 * K_MAX ; K_PLAN_VIDE sans englobant. Null quand la largeur ou la hauteur du
 * cadre ne dépasse pas 2 × MARGE_AJUSTEMENT_PX, plan vide compris : aucun k
 * positif n'y fait rien tenir, et un cadre de taille nulle est celui d'un plan
 * monté caché. Un englobant plat dans une direction n'y contraint rien, et un
 * englobant réduit à un point prend K_MAX. Tout k rendu est fini et > 0.
 * @param {Englobant|null} englobant  @param {Cadre} cadre
 * @returns {number|null}
 */
export function kAjuste(englobant, cadre) {
  const utileX = cadre.largeur - 2 * MARGE_AJUSTEMENT_PX;
  const utileY = cadre.hauteur - 2 * MARGE_AJUSTEMENT_PX;
  if (!(utileX > 0 && utileY > 0)) return null;
  if (englobant === null) return K_PLAN_VIDE;
  const etendueX = englobant.maxX - englobant.minX;
  const etendueY = englobant.maxY - englobant.minY;
  // Une étendue nulle donne Infinity, que le plafond ramène à K_MAX.
  const kX = etendueX > 0 ? utileX / etendueX : Number.POSITIVE_INFINITY;
  const kY = etendueY > 0 ? utileY / etendueY : Number.POSITIVE_INFINITY;
  return Math.min(K_MAX, kX, kY);
}

/**
 * La vue ajustée : k = kAjuste, centre de l'englobant au centre du cadre ; un
 * plan vide met l'origine du dessin au centre. Null quand kAjuste l'est :
 * l'appelant garde la vue en place.
 * @param {Englobant|null} englobant  @param {Cadre} cadre
 * @returns {Vue|null}
 */
export function ajuster(englobant, cadre) {
  const k = kAjuste(englobant, cadre);
  if (k === null) return null;
  const cx = englobant === null ? 0 : (englobant.minX + englobant.maxX) / 2;
  const cy = englobant === null ? 0 : (englobant.minY + englobant.maxY) / 2;
  return { k, tx: cadre.largeur / 2 - k * cx, ty: cadre.hauteur / 2 - k * cy };
}

/**
 * Bornes du zoom : kMin = FACTEUR_K_MIN × kAjuste, kMax = K_MAX. Lève
 * RangeError sur un kAjuste qui n'est pas un nombre fini > 0, null compris :
 * 0,5 × null vaudrait 0, et la borne basse disparaîtrait sans bruit.
 * @param {number} kAjuste
 * @returns {{kMin: number, kMax: number}}
 */
export function bornesZoom(kAjuste) {
  if (typeof kAjuste !== 'number' || !Number.isFinite(kAjuste) || kAjuste <= 0) {
    throw new RangeError(`k ajusté : nombre fini > 0 attendu, reçu ${String(kAjuste)}`);
  }
  return { kMin: FACTEUR_K_MIN * kAjuste, kMax: K_MAX };
}

// k ramené dans les bornes.
const dansBornes = (k, bornes) => Math.min(bornes.kMax, Math.max(bornes.kMin, k));

// La vue d'échelle k dont le point écran (xCadre, yCadre), relatif au coin du
// cadre, montre le même point de dessin que dans vue.
function versK(vue, xCadre, yCadre, k) {
  const x = (xCadre - vue.tx) / vue.k;
  const y = (yCadre - vue.ty) / vue.k;
  return { k, tx: xCadre - k * x, ty: yCadre - k * y };
}

/**
 * La vue, son k ramené dans les bornes, le point de dessin au centre du cadre
 * restant au centre ; inchangée quand k y est déjà. Un cadrage mémorisé,
 * restitué dans un autre cadre, y passe.
 * @param {Vue} vue  @param {Cadre} cadre  @param {{kMin: number, kMax: number}} bornes
 * @returns {Vue}
 */
export function borner(vue, cadre, bornes) {
  const k = dansBornes(vue.k, bornes);
  if (k === vue.k) return { k: vue.k, tx: vue.tx, ty: vue.ty };
  return versK(vue, cadre.largeur / 2, cadre.hauteur / 2, k);
}

/**
 * Zoom d'un facteur sous le point écran (xEcran, yEcran) : k devient
 * k × facteur ramené dans les bornes, puis la translation se calcule sur ce k
 * borné, de sorte que le point de dessin sous le pointeur y reste, à une borne
 * comprise. Lève RangeError sur un facteur qui n'est pas un nombre fini > 0.
 * @param {Vue} vue  @param {Cadre} cadre  @param {number} facteur
 * @param {{kMin: number, kMax: number}} bornes
 * @returns {Vue}
 */
export function zoomerSous(vue, cadre, xEcran, yEcran, facteur, bornes) {
  if (!Number.isFinite(facteur) || facteur <= 0) {
    throw new RangeError(`facteur de zoom : nombre fini > 0 attendu, reçu ${String(facteur)}`);
  }
  return versK(vue, xEcran - cadre.gauche, yEcran - cadre.haut, dansBornes(vue.k * facteur, bornes));
}

/**
 * Position d'une table glissée, en cm : positionInitiale + (pointeur −
 * pointeurInitial) / k. Le calcul se fait en écart : la table garde le
 * décalage où le pointeur l'a saisie, et un mouvement nul la laisse en place.
 * @param {Point} positionInitiale  cm  @param {Point} pointeurInitial  px
 * @param {Point} pointeur  px  @param {number} k
 * @returns {Point}
 */
export function deplacer(positionInitiale, pointeurInitial, pointeur, k) {
  return {
    x: positionInitiale.x + (pointeur.x - pointeurInitial.x) / k,
    y: positionInitiale.y + (pointeur.y - pointeurInitial.y) / k,
  };
}

/**
 * Vue glissée par le sol : tx, ty + (pointeur − pointeurInitial), en px ; k
 * inchangé.
 * @param {Vue} vueInitiale  @param {Point} pointeurInitial  @param {Point} pointeur
 * @returns {Vue}
 */
export function deplacerVue(vueInitiale, pointeurInitial, pointeur) {
  return {
    k: vueInitiale.k,
    tx: vueInitiale.tx + (pointeur.x - pointeurInitial.x),
    ty: vueInitiale.ty + (pointeur.y - pointeurInitial.y),
  };
}

/**
 * Facteur de zoom d'un événement de molette : FACTEUR_CRAN puissance le
 * nombre de crans, un cran valant 100 px, 3 lignes ou une page selon deltaMode
 * (0, 1, 2) ; > 1 vers le haut (deltaY négatif), 1 sans mouvement. Lève
 * RangeError sur un autre deltaMode.
 * @param {number} deltaY  @param {number} deltaMode
 * @returns {number}
 */
export function facteurMolette(deltaY, deltaMode) {
  const cran = CRAN_PAR_MODE[deltaMode];
  if (!Number.isInteger(deltaMode) || cran === undefined) {
    throw new RangeError(`deltaMode : 0, 1 ou 2 attendu, reçu ${String(deltaMode)}`);
  }
  return FACTEUR_CRAN ** (-deltaY / cran);
}

/**
 * Valeur de l'attribut transform du groupe [data-vue] : chaque nombre écrit
 * par String, que Number relit à l'identique.
 * @param {Vue} vue
 * @returns {string}
 */
export function transformDe(vue) {
  return `translate(${String(vue.tx)},${String(vue.ty)}) scale(${String(vue.k)})`;
}

// Un nombre tel que String l'écrit : signe, chiffres, partie décimale,
// exposant.
const NOMBRE = String.raw`-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?`;
const FORME_TRANSFORM = new RegExp(`^translate\\((${NOMBRE}),(${NOMBRE})\\) scale\\((${NOMBRE})\\)$`);

/**
 * La vue que décrit un attribut transform de la forme qu'écrit transformDe.
 * Lève SyntaxError sur toute autre forme, et sur un k qui n'est pas > 0.
 * @param {string} texte
 * @returns {Vue}
 */
export function vueDepuisTransform(texte) {
  const lu = FORME_TRANSFORM.exec(texte);
  const k = lu === null ? Number.NaN : Number(lu[3]);
  if (lu === null || !(k > 0) || !Number.isFinite(k)) {
    throw new SyntaxError(`transform de vue attendu, reçu ${JSON.stringify(texte)}`);
  }
  return { k, tx: Number(lu[1]), ty: Number(lu[2]) };
}
