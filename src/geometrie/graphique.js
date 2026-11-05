// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La géométrie des graphiques de la page de qualité (§ 12.9) : module frère
// de celui du plan, qui n'en importe rien ; les deux ne partagent que le
// seuil des cibles, cible.js. L'unité y est le rang et le nombre, rendus en
// pixels d'écran, jamais le centimètre. Les fonctions sont pures : un
// composant reçoit d'elles des nombres déjà rangés, des pixels et des
// chemins, et n'en calcule aucun.
//
// Un axe des rangs va de 0 à n : le rang r occupe l'intervalle [r − 1, r],
// son centre est r − 0,5. Un axe de comptes va de zéro à sa plus grande
// valeur (D49). Les chemins SVG n'emploient que des commandes absolues, leurs
// nombres arrondis au centième de pixel.

import { CIBLE_MIN_PX } from './cible.js';

/** Les quatre niveaux de l'échelle séquentielle : 0, 1, 2, puis 3 et plus (D33). */
export const NIVEAUX = Object.freeze([0, 1, 2, 3]);

// Mantisses des pas ronds, du plus petit au plus grand.
const MANTISSES = [1, 2, 5];

// m × 10ⁿ, au plus près. Recopiée de ronde (echelle.js), non importée : le
// plan et les graphiques ne partagent que le seuil des cibles, cible.js
// (§ 12.9, § 14.10). Une puissance négative divise par 10⁻ⁿ, que
// l'arithmétique flottante représente exactement, plutôt que de multiplier
// par 10ⁿ, qu'elle arrondit.
const ronde = (m, n) => (n >= 0 ? m * 10 ** n : m / 10 ** -n);

// Tolérance des bornes d'un compte de graduations : un quotient tel que
// 0,3 / 0,1 tombe juste sous l'entier qu'il vaut.
const EPSILON = 1e-9;

const estFini = (v) => typeof v === 'number' && Number.isFinite(v);
const estPositif = (v) => estFini(v) && v >= 0;
const estEntierPositif = (v) => Number.isInteger(v) && v >= 0;

// Le même nombre, zéro négatif ramené à zéro : −0 + 0 vaut 0, et une
// épreuve stricte ou un chemin n'en voient jamais le signe.
const sansZeroNegatif = (v) => v + 0;

function exiger(condition, message) {
  if (!condition) throw new RangeError(message);
}

// Un intervalle [a, b] de deux nombres finis.
const estIntervalle = (paire) => Array.isArray(paire) && paire.length === 2 && estFini(paire[0]) && estFini(paire[1]);

// Un nombre de pixels écrit dans un chemin : arrondi au centième, sans zéro
// négatif.
function px(valeur) {
  return String(sansZeroNegatif(Math.round(valeur * 100) / 100));
}

/**
 * L'échelle linéaire d'un axe de comptes ou de rangs. Le domaine part de
 * zéro (D49) ; un domaine nul, [0, 0], pose toute valeur au premier bord de
 * la plage. La plage va du pixel de zéro à celui du maximum, dans un sens ou
 * dans l'autre : [hauteur, 0] pour un axe vertical. depuisPx rend 0 quand le
 * domaine ou la plage est réduit à un point. Lève RangeError sur un domaine
 * qui ne part pas de zéro, de maximum négatif ou non fini, ou sur une plage
 * qui n'est pas deux nombres finis.
 * @param {{domaine: [number, number], plage: [number, number]}} options
 * @returns {{domaine: number[], plage: number[], versPx: (v: number) => number, depuisPx: (p: number) => number}}
 */
export function echelleLineaire({ domaine, plage }) {
  exiger(estIntervalle(domaine), `domaine : deux nombres finis attendus, reçu ${String(domaine)}`);
  exiger(domaine[0] === 0, `domaine : un axe part de zéro, reçu ${domaine[0]}`);
  exiger(domaine[1] >= 0, `domaine : maximum ≥ 0 attendu, reçu ${domaine[1]}`);
  exiger(estIntervalle(plage), `plage : deux nombres finis attendus, reçu ${String(plage)}`);
  const [, max] = domaine;
  const [p0, p1] = plage;
  return {
    domaine: [0, max],
    plage: [p0, p1],
    versPx: (v) => sansZeroNegatif(max === 0 ? p0 : p0 + (v / max) * (p1 - p0)),
    depuisPx: (p) => (max === 0 || p1 === p0 ? 0 : sansZeroNegatif(((p - p0) / (p1 - p0)) * max)),
  };
}

/**
 * L'échelle logarithmique des mouvements évalués (§ 12.14) : 1 mouvement au
 * premier bord de la plage, le maximum au second. Un domaine [1, 1], un seul
 * point de relevé, pose 1 au premier bord. versPx lève RangeError sous 1 :
 * zéro mouvement n'a pas d'abscisse, et la vue l'écrit au lieu de le tracer.
 * Lève RangeError sur un domaine qui ne part pas de 1 ou de maximum sous 1,
 * ou sur une plage qui n'est pas deux nombres finis.
 * @param {{domaine: [number, number], plage: [number, number]}} options
 * @returns {{domaine: number[], plage: number[], versPx: (v: number) => number}}
 */
export function echelleLog10({ domaine, plage }) {
  exiger(estIntervalle(domaine), `domaine : deux nombres finis attendus, reçu ${String(domaine)}`);
  exiger(domaine[0] === 1 && domaine[1] >= 1, `domaine : [1, max ≥ 1] attendu, reçu ${String(domaine)}`);
  exiger(estIntervalle(plage), `plage : deux nombres finis attendus, reçu ${String(plage)}`);
  const [, max] = domaine;
  const [p0, p1] = plage;
  const decades = Math.log10(max);
  return {
    domaine: [1, max],
    plage: [p0, p1],
    versPx: (v) => {
      exiger(estFini(v) && v >= 1, `mouvements : nombre fini ≥ 1 attendu, reçu ${String(v)}`);
      return sansZeroNegatif(decades === 0 ? p0 : p0 + (Math.log10(v) / decades) * (p1 - p0));
    },
  };
}

/**
 * Le domaine d'un axe de comptes : [0, la plus grande valeur de toutes les
 * listes reçues], null ignoré ; [0, 0] sans valeur. Lève RangeError sur ce
 * qui n'est pas une liste, ou sur une valeur qui n'est ni null ni un nombre
 * fini ≥ 0.
 * @param {...Array<number|null>} listes
 * @returns {[number, number]}
 */
export function domaineDe(...listes) {
  let max = 0;
  for (const liste of listes) {
    exiger(Array.isArray(liste), `domaine : liste attendue, reçu ${String(liste)}`);
    for (const v of liste) {
      if (v === null) continue;
      exiger(estPositif(v), `domaine : nombre fini ≥ 0 ou null attendu, reçu ${String(v)}`);
      if (v > max) max = v;
    }
  }
  return [0, max];
}

/**
 * Les graduations d'un axe : les multiples du plus petit pas rond — 1, 2 ou 5
 * × 10ᵏ — dont au plus n tombent dans [min, max], croissants. Sous entieres,
 * le pas est un entier, 1 au moins : un axe de comptes ne porte jamais de
 * graduation fractionnaire. La recherche part de la décade de (max − min) / n
 * et monte, mantisse par mantisse ; d'un pas qui donne trois graduations ou
 * plus, le pas rond suivant en garde au moins une : pour n ≥ 2, la liste
 * n'est vide que si le premier pas essayé n'a aucun multiple dans le domaine.
 * Sans entieres, ce pas ne dépasse pas (max − min) / n et le domaine en porte
 * toujours un ; sous entieres, il vaut 1 au moins, et un domaine non nul sans
 * entier, tel 0,2..0,8, rend la liste vide. Un domaine nul se gradue de sa
 * seule valeur. Lève RangeError sur des bornes non finies, min > max, ou un n
 * qui n'est pas un entier ≥ 2.
 * @param {number} min
 * @param {number} max
 * @param {number} n  nombre maximal de graduations
 * @param {{entieres?: boolean}} [options]
 * @returns {number[]}
 */
export function graduations(min, max, n, { entieres = false } = {}) {
  exiger(estFini(min) && estFini(max) && min <= max, `graduations : min ≤ max finis attendus, reçu ${min}, ${max}`);
  exiger(Number.isInteger(n) && n >= 2, `graduations : entier ≥ 2 attendu, reçu ${String(n)}`);
  if (min === max) return [min];
  const depart = Math.floor(Math.log10((max - min) / n));
  for (let k = entieres ? Math.max(depart, 0) : depart; ; k += 1) {
    for (const m of MANTISSES) {
      // Les multiples i × m × 10ᵏ du domaine, i de premier à dernier, chacun
      // écrit par ronde(i × m, k), au plus près.
      const pas = ronde(m, k);
      const premier = Math.ceil(min / pas - EPSILON);
      const dernier = Math.floor(max / pas + EPSILON);
      if (dernier - premier + 1 > n) continue;
      const marques = [];
      for (let i = premier; i <= dernier; i += 1) marques.push(sansZeroNegatif(ronde(i * m, k)));
      return marques;
    }
  }
}

// Les valeurs d'un tracé : une liste de nombres finis ou de null.
function exigerValeurs(valeurs) {
  exiger(Array.isArray(valeurs), `valeurs : liste attendue, reçu ${String(valeurs)}`);
  for (const v of valeurs) exiger(v === null || estFini(v), `valeur : nombre fini ou null attendu, reçu ${String(v)}`);
}

/**
 * Le chemin en escalier d'une série par rang (§ 12.3) : valeurs[i] est celle
 * du rang i + 1. Chaque rang porte un trait horizontal sur son intervalle ;
 * un trait vertical relie deux rangs voisins de valeurs différentes ; aucun
 * segment n'est oblique. Une valeur null interrompt le chemin, qui reprend
 * au rang suivant par un déplacement sans trait (D51) : aucun segment ne
 * passe au-dessus d'un rang null. '' quand aucune valeur n'est un nombre.
 * Lève RangeError sur une valeur qui n'est ni null ni un nombre fini.
 * @param {Array<number|null>} valeurs
 * @param {{versPx: (v: number) => number}} ex  axe des rangs, de 0 à n
 * @param {{versPx: (v: number) => number}} ey  axe des valeurs
 * @returns {string}
 */
export function cheminEscalier(valeurs, ex, ey) {
  exigerValeurs(valeurs);
  const morceaux = [];
  let precedente = null;
  valeurs.forEach((v, i) => {
    if (v === null) {
      precedente = null;
      return;
    }
    if (precedente === null) morceaux.push(`M ${px(ex.versPx(i))} ${px(ey.versPx(v))}`);
    else if (v !== precedente) morceaux.push(`V ${px(ey.versPx(v))}`);
    morceaux.push(`H ${px(ex.versPx(i + 1))}`);
    precedente = v;
  });
  return morceaux.join(' ');
}

/**
 * Le tracé d'un repère par rang — plafond réalisé, borne, règle à 100 % : une
 * règle horizontale sur tous les rangs quand la valeur est la même partout,
 * l'escalier de cheminEscalier sinon (§ 12.3 : une règle unique mentirait).
 * Une valeur null rend la série non constante. Aucun rang : une règle vide.
 * @param {Array<number|null>} plafonds
 * @param {{versPx: (v: number) => number}} ex  axe des rangs, de 0 à n
 * @param {{versPx: (v: number) => number}} ey  axe des valeurs
 * @returns {{forme: 'regle'|'escalier', d: string}}
 */
export function regleOuEscalier(plafonds, ex, ey) {
  exigerValeurs(plafonds);
  if (plafonds.length === 0) return { forme: 'regle', d: '' };
  const premier = plafonds[0];
  if (premier !== null && plafonds.every((v) => v === premier)) {
    return { forme: 'regle', d: `M ${px(ex.versPx(0))} ${px(ey.versPx(premier))} H ${px(ex.versPx(plafonds.length))}` };
  }
  return { forme: 'escalier', d: cheminEscalier(plafonds, ex, ey) };
}

/**
 * Le chemin qui relie des points de relevé (§ 12.14, D49) : un segment de
 * chaque point au suivant, à l'abscisse de ses mouvements. Un point de
 * valeur null n'est pas relié : le chemin reprend au point suivant par un
 * déplacement. Le point lui-même se marque à part, par le composant. ''
 * sans point. Lève RangeError sur un point qui n'est pas {x, y}, x fini et
 * y fini ou null.
 * @param {Array<{x: number, y: number|null}>} points  x en mouvements
 * @param {{versPx: (v: number) => number}} ex  échelle des mouvements
 * @param {{versPx: (v: number) => number}} ey  axe des valeurs
 * @returns {string}
 */
export function cheminPoints(points, ex, ey) {
  exiger(Array.isArray(points), `points : liste attendue, reçu ${String(points)}`);
  const morceaux = [];
  let relie = false;
  for (const point of points) {
    exiger(typeof point === 'object' && point !== null && estFini(point.x), `point : {x, y} attendu, reçu ${String(point)}`);
    exiger(point.y === null || estFini(point.y), `point : y fini ou null attendu, reçu ${String(point.y)}`);
    if (point.y === null) {
      relie = false;
      continue;
    }
    morceaux.push(`${relie ? 'L' : 'M'} ${px(ex.versPx(point.x))} ${px(ey.versPx(point.y))}`);
    relie = true;
  }
  return morceaux.join(' ');
}

/**
 * Le rang sous un pixel, sur un axe des rangs de 0 à n (§ 12.7, pointage au
 * plus proche) : le rang r dont l'intervalle [r − 1, r[ contient le pixel,
 * borné à 1 et à n hors du tracé. Lève RangeError sur un pixel non fini ou
 * un n qui n'est pas un entier ≥ 1.
 * @param {number} pixel
 * @param {{depuisPx: (p: number) => number}} ex
 * @param {number} n
 * @returns {number}
 */
export function rangLePlusProche(pixel, ex, n) {
  exiger(estFini(pixel), `pixel : nombre fini attendu, reçu ${String(pixel)}`);
  exiger(Number.isInteger(n) && n >= 1, `rangs : entier ≥ 1 attendu, reçu ${String(n)}`);
  const rang = Math.floor(ex.depuisPx(pixel)) + 1;
  return Math.min(n, Math.max(1, rang));
}

/**
 * L'indice du point de relevé le plus proche d'un pixel, sur l'abscisse
 * commune des petits multiples (§ 12.7) : la plus petite distance, le
 * premier à égalité. Lève RangeError sur un pixel ou une abscisse non finis,
 * ou une liste vide.
 * @param {number} pixel
 * @param {number[]} abscisses  pixels des points, dans leur ordre
 * @returns {number}
 */
export function pointLePlusProche(pixel, abscisses) {
  exiger(estFini(pixel), `pixel : nombre fini attendu, reçu ${String(pixel)}`);
  exiger(Array.isArray(abscisses) && abscisses.length > 0, 'abscisses : liste non vide attendue');
  let meilleur = 0;
  abscisses.forEach((x, i) => {
    exiger(estFini(x), `abscisse : nombre fini attendu, reçu ${String(x)}`);
    if (Math.abs(x - pixel) < Math.abs(abscisses[meilleur] - pixel)) meilleur = i;
  });
  return meilleur;
}

/**
 * Les barres horizontales d'une vue (§ 12.4) : une ligne par entrée, l'une
 * sous l'autre, chacune de un ou deux segments empilés depuis zéro sur l'axe
 * commun ex — le second commence où finit le premier. Un segment nul garde
 * sa place, de largeur nulle. hauteurTotale compte les lignes et les écarts
 * entre elles. Lève RangeError sur une ligne qui n'a pas un ou deux segments,
 * un segment qui n'est pas un nombre fini ≥ 0, ou une hauteur ou un écart
 * qui ne l'est pas.
 * @param {number[][]} lignes
 * @param {{versPx: (v: number) => number}} ex
 * @param {number} hauteur  hauteur d'une ligne, en px
 * @param {number} ecart    espace entre deux lignes, en px
 * @returns {{lignes: Array<{y: number, hauteur: number, segments: Array<{x: number, largeur: number}>}>, hauteurTotale: number}}
 */
export function barres(lignes, ex, hauteur, ecart) {
  exiger(Array.isArray(lignes), `barres : liste attendue, reçu ${String(lignes)}`);
  exiger(estPositif(hauteur) && estPositif(ecart), `barres : hauteur et écart ≥ 0 attendus, reçu ${hauteur}, ${ecart}`);
  const rendues = lignes.map((segments, i) => {
    exiger(Array.isArray(segments) && segments.length >= 1 && segments.length <= 2, 'barre : un ou deux segments attendus');
    let cumul = 0;
    const traces = segments.map((v) => {
      exiger(estPositif(v), `segment : nombre fini ≥ 0 attendu, reçu ${String(v)}`);
      const x = ex.versPx(cumul);
      cumul += v;
      return { x, largeur: ex.versPx(cumul) - x };
    });
    return { y: i * (hauteur + ecart), hauteur, segments: traces };
  });
  const hauteurTotale = lignes.length === 0 ? 0 : lignes.length * hauteur + (lignes.length - 1) * ecart;
  return { lignes: rendues, hauteurTotale };
}

/**
 * n colonnes de barres côte à côte, de même largeur, séparées par ecart —
 * chacune porte son propre axe (§ 12.13) : jamais empilées, jamais sur un
 * axe commun. Une largeur plus petite que les écarts laisse des colonnes de
 * largeur nulle. Lève RangeError sur un n qui n'est pas un entier ≥ 1, ou
 * une largeur ou un écart qui n'est pas un nombre fini ≥ 0.
 * @param {number} largeur
 * @param {number} n
 * @param {number} ecart
 * @returns {Array<{x: number, largeur: number}>}
 */
export function colonnesJuxtaposees(largeur, n, ecart) {
  exiger(Number.isInteger(n) && n >= 1, `colonnes : entier ≥ 1 attendu, reçu ${String(n)}`);
  exiger(estPositif(largeur) && estPositif(ecart), `colonnes : largeur et écart ≥ 0 attendus, reçu ${largeur}, ${ecart}`);
  const colonne = Math.max(0, (largeur - (n - 1) * ecart) / n);
  return Array.from({ length: n }, (_, i) => ({ x: i * (colonne + ecart), largeur: colonne }));
}

/**
 * La grille d'une matrice ou des tables par tour (§ 12.5, D33) : des cases
 * carrées d'un nombre entier de pixels, autant que la largeur disponible en
 * tient par colonne. Elle est dessinable quand elle a au moins une ligne et
 * une colonne et que sa case tient la cible de CIBLE_MIN_PX et la hauteur
 * du texte qu'elle porte : la largeur réelle de la carte décide, quel que
 * soit le seuil mesuré au cadre du banc. coteMax borne la case par en
 * haut, sans borne par défaut : peu de colonnes dans une carte large ne
 * font pas de cases géantes ; une borne sous la cible rend la grille non
 * dessinable, comme une carte trop étroite. largeur et hauteur sont celles
 * des cases seules. Lève RangeError sur des comptes qui ne sont pas des
 * entiers ≥ 0, une largeur ou une hauteur de texte qui n'est pas un nombre
 * fini ≥ 0, ou une borne qui n'est ni un nombre fini ≥ 0 ni Infinity.
 * @param {number} lignes
 * @param {number} colonnes
 * @param {number} largeurDispo  px
 * @param {number} hauteurTexte  px, la hauteur de ligne du compte écrit
 * @param {number} [coteMax]     px, la plus grande case, Infinity par défaut
 * @returns {{cote: number, dessinable: boolean, largeur: number, hauteur: number}}
 */
export function grille(lignes, colonnes, largeurDispo, hauteurTexte, coteMax = Number.POSITIVE_INFINITY) {
  exiger(
    estEntierPositif(lignes) && estEntierPositif(colonnes),
    `grille : comptes entiers ≥ 0 attendus, reçu ${lignes}, ${colonnes}`,
  );
  exiger(
    estPositif(largeurDispo) && estPositif(hauteurTexte),
    `grille : largeur et texte ≥ 0 attendus, reçu ${largeurDispo}, ${hauteurTexte}`,
  );
  exiger(
    estPositif(coteMax) || coteMax === Number.POSITIVE_INFINITY,
    `grille : borne de case ≥ 0 attendue, reçu ${coteMax}`,
  );
  const cote = colonnes === 0 ? 0 : Math.min(Math.floor(largeurDispo / colonnes), Math.floor(coteMax));
  const dessinable = lignes >= 1 && colonnes >= 1 && cote >= CIBLE_MIN_PX && cote >= hauteurTexte;
  return { cote, dessinable, largeur: cote * colonnes, hauteur: cote * lignes };
}

/**
 * Le niveau d'un compte sur l'échelle séquentielle (D33, D35) : le compte
 * lui-même jusqu'à 2, puis 3 pour 3 et plus. Lève RangeError sur ce qui
 * n'est pas un entier ≥ 0.
 * @param {number} valeur
 * @returns {number}
 */
export function niveau(valeur) {
  exiger(estEntierPositif(valeur), `niveau : entier ≥ 0 attendu, reçu ${String(valeur)}`);
  return Math.min(valeur, NIVEAUX[NIVEAUX.length - 1]);
}

/**
 * Le nombre de caractères qu'une étiquette garde dans maxPx (§ 12.6), sur des
 * largeurs mesurées par l'appelant, sur la police rendue : pour un nom de L
 * caractères, largeurs[k] est celle de ses k + 1 premiers caractères suivis
 * de la marque de troncature, pour k < L − 1, et largeurs[L − 1] celle du nom
 * entier. Rend L quand le nom entier tient ; sinon le plus grand k + 1 dont
 * la largeur tient, l'appelant écrivant ce préfixe suivi de la marque ; 0
 * quand rien ne tient, et pour un nom vide. Aucune monotonie n'est supposée.
 * Lève RangeError sur une largeur ou un maximum qui n'est pas un nombre fini
 * ≥ 0.
 * @param {number[]} largeurs  px
 * @param {number} maxPx
 * @returns {number}
 */
export function tronquer(largeurs, maxPx) {
  exiger(Array.isArray(largeurs), `largeurs : liste attendue, reçu ${String(largeurs)}`);
  exiger(estPositif(maxPx), `largeur maximale : nombre fini ≥ 0 attendu, reçu ${String(maxPx)}`);
  for (const l of largeurs) exiger(estPositif(l), `largeur : nombre fini ≥ 0 attendu, reçu ${String(l)}`);
  for (let k = largeurs.length - 1; k >= 0; k -= 1) {
    if (largeurs[k] <= maxPx) return k + 1;
  }
  return 0;
}
