// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'imposition de la planche de badges (§ 11.2, § 11.3, § 11.6) : où
// tombent les badges sur une feuille, combien de feuilles, dans quel ordre,
// et où passent les filets de coupe. Fonctions pures, sans bibliothèque ;
// les cotes sont en millimètres, l'origine en haut à gauche de la feuille.
//
// La disposition se déduit des cotes du papier et du badge (papiers.js),
// sans table par papier : un papier ajouté à PAPIERS reçoit la sienne.
// Deux grilles sont candidates, le badge debout (105 de large, 148 de haut)
// ou à plat (148 × 105, tourné de 90° dans le sens trigonométrique) ;
// chacune range autant de colonnes et de rangées entières que la feuille en
// contient. La grille qui porte le plus de badges l'emporte. À égalité,
// celle dont le bloc, centré, laisse la plus grande marge au bord le plus
// proche : un filet trop près du bord tombe dans la marge que l'imprimante
// n'atteint pas. Sur A4, la grille debout porte quatre badges contre deux ;
// sur Lettre, les deux en portent deux, et le bloc à plat laisse 33,95 mm
// au bord quand le bloc debout n'en laisse que 2,95.
//
// Un bloc qui épouse un côté de la feuille part de son coin haut gauche :
// le bord du badge y est le bord de la feuille, sans filet, et ce qui reste
// fait une seule bande au pied (ou à droite), qu'une coupe retire — le
// millimètre perdu de l'A4, jamais réparti dans la hauteur des badges, qui
// restent des A6 exacts. Un bloc qui n'en épouse aucun se centre, et
// l'encadrement complet le détoure.
//
// Les calculs se font en centièmes de millimètre entiers, puis se rendent en
// millimètres : 215,9 − 148 vaut 67,9 sans erreur d'arrondi, deux filets
// colinéaires se reconnaissent par égalité exacte, et 33,95 se lit 33.95.
import { constante } from '../geometrie/constantes.js';
import { BADGE, PAPIERS } from '../geometrie/papiers.js';

/**
 * Une cellule de la planche : la place d'un badge.
 *
 * @typedef {Object} Cellule
 * @property {number} x         mm, bord gauche
 * @property {number} y         mm, bord haut
 * @property {number} largeur   mm
 * @property {number} hauteur   mm
 * @property {boolean} aPlat    le badge tourné de 90° dans le sens
 *           trigonométrique, son haut à gauche
 */

/** @typedef {'feuille'|'pile'} Imposition */

const IMPOSITIONS = new Set(['feuille', 'pile']);

const enCentiemes = (mm) => Math.round(mm * 100);
const enMm = (centiemes) => centiemes / 100;

// Les cotes du papier en centièmes ; TypeError hors de PAPIERS. Une clé
// héritée d'Object.prototype n'en est pas une.
function coteDuPapier(papier) {
  if (typeof papier !== 'string' || !Object.hasOwn(PAPIERS, papier)) {
    throw new TypeError(`papier inconnu : ${JSON.stringify(papier)}`);
  }
  const { largeur, hauteur } = PAPIERS[papier];
  return { W: enCentiemes(largeur), H: enCentiemes(hauteur) };
}

// La grille d'un papier, en centièmes : origine du bloc, colonnes, rangées,
// cote d'une cellule, orientation du badge.
function grilleDe(papier) {
  const { W, H } = coteDuPapier(papier);
  const debout = { l: enCentiemes(BADGE.largeur), h: enCentiemes(BADGE.hauteur), aPlat: false };
  const aPlat = { l: debout.h, h: debout.l, aPlat: true };
  const candidates = [debout, aPlat].map((cellule) => {
    const colonnes = Math.floor(W / cellule.l);
    const rangees = Math.floor(H / cellule.h);
    const bloc = { l: colonnes * cellule.l, h: rangees * cellule.h };
    return { ...cellule, colonnes, rangees, bloc, marge: Math.min(W - bloc.l, H - bloc.h) / 2 };
  });
  const [a, b] = candidates;
  const nombre = (g) => g.colonnes * g.rangees;
  const retenue = nombre(b) > nombre(a) || (nombre(b) === nombre(a) && b.marge > a.marge) ? b : a;
  const epouse = retenue.bloc.l === W || retenue.bloc.h === H;
  return {
    ...retenue,
    W,
    H,
    x0: epouse ? 0 : (W - retenue.bloc.l) / 2,
    y0: epouse ? 0 : (H - retenue.bloc.h) / 2,
  };
}

// Les cellules d'une grille, en centièmes, rangée par rangée de haut en bas,
// de gauche à droite dans une rangée.
function cellulesEnCentiemes(grille) {
  const cellulesGrille = [];
  for (let rangee = 0; rangee < grille.rangees; rangee += 1) {
    for (let colonne = 0; colonne < grille.colonnes; colonne += 1) {
      cellulesGrille.push({ x: grille.x0 + colonne * grille.l, y: grille.y0 + rangee * grille.h, l: grille.l, h: grille.h });
    }
  }
  return cellulesGrille;
}

/**
 * Les cellules d'une planche, rangée par rangée de haut en bas, de gauche à
 * droite. A4 : quatre cellules de 105 × 148 depuis (0, 0), la bande perdue
 * de 1 mm au pied. Lettre : deux cellules de 148 × 105 à plat, en un bloc
 * de 148 × 210 centré, à (33,95 ; 34,7) et (33,95 ; 139,7).
 *
 * @param {import('../geometrie/papiers.js').Papier} papier
 * @returns {Cellule[]}   neuves à chaque appel
 * @throws {TypeError} un papier hors de PAPIERS
 */
export function cellules(papier) {
  const grille = grilleDe(papier);
  return cellulesEnCentiemes(grille).map(({ x, y, l, h }) => ({
    x: enMm(x),
    y: enMm(y),
    largeur: enMm(l),
    hauteur: enMm(h),
    aPlat: grille.aPlat,
  }));
}

/**
 * Le nombre de badges d'une planche : 4 sur A4, 2 sur Lettre.
 *
 * @param {import('../geometrie/papiers.js').Papier} papier
 * @returns {number}
 * @throws {TypeError} un papier hors de PAPIERS
 */
export function parPlanche(papier) {
  const { colonnes, rangees } = grilleDe(papier);
  return colonnes * rangees;
}

// n, un entier ≥ 0, ou RangeError.
function compte(n) {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`nombre de badges entier ≥ 0 attendu, reçu ${String(n)}`);
  return n;
}

/**
 * Le nombre de planches de n badges : ⌈n / parPlanche⌉, 0 pour n = 0.
 *
 * @param {number} n   entier ≥ 0, les badges produits
 * @param {import('../geometrie/papiers.js').Papier} papier
 * @returns {number}
 * @throws {RangeError} un n qui n'est pas un entier ≥ 0
 * @throws {TypeError} un papier hors de PAPIERS
 */
export function nombrePlanches(n, papier) {
  return Math.ceil(compte(n) / parPlanche(papier));
}

/**
 * L'ordre des badges sur les planches (§ 11.6) : par planche, l'indice
 * 0…n−1 du badge de chaque cellule, dans l'ordre de cellules(papier), null
 * pour une cellule vide. Avec S planches de P cellules, la cellule p (1…P)
 * de la planche i (1…S) porte le badge P(i−1)+p feuille par feuille, et
 * (p−1)S+i en pile : la rame coupée, la pile de chaque cellule se lit dans
 * l'ordre, et les piles 1…P posées l'une sur l'autre redonnent 1…n. Les
 * cellules vides, au-delà de n, sont au bout de cet ordre.
 *
 * @param {number} n   entier ≥ 0
 * @param {import('../geometrie/papiers.js').Papier} papier
 * @param {Imposition} imposition
 * @returns {Array<Array<number|null>>}   S planches de P places ; [] pour n = 0
 * @throws {RangeError} un n qui n'est pas un entier ≥ 0
 * @throws {TypeError} un papier ou une imposition inconnus
 */
export function imposer(n, papier, imposition) {
  const S = nombrePlanches(n, papier);
  if (!IMPOSITIONS.has(imposition)) throw new TypeError(`imposition inconnue : ${JSON.stringify(imposition)}`);
  const P = parPlanche(papier);
  const planches = [];
  for (let i = 0; i < S; i += 1) {
    const planche = [];
    for (let p = 0; p < P; p += 1) {
      const badge = imposition === 'feuille' ? P * i + p : p * S + i;
      planche.push(badge < n ? badge : null);
    }
    planches.push(planche);
  }
  return planches;
}

// Les intervalles [debut, fin] donnés, réunis quand ils se chevauchent ou
// se touchent, triés par début.
function reunir(intervalles) {
  const tries = [...intervalles].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const reunis = [];
  for (const [debut, fin] of tries) {
    const dernier = reunis.at(-1);
    if (dernier !== undefined && debut <= dernier[1]) dernier[1] = Math.max(dernier[1], fin);
    else reunis.push([debut, fin]);
  }
  return reunis;
}

/**
 * Les filets de coupe d'une planche (§ 11.3) : continus, sur les bords des
 * cellules occupées qui ne sont pas le bord de la feuille, réunis en un
 * segment par axe quand ils se touchent. Un segment ne se trace que s'il
 * borde une cellule occupée : une cellule vide d'une dernière planche reste
 * sans filet ni mention. Les verticaux d'abord, par x puis par y, puis les
 * horizontaux, par y puis par x.
 *
 * A4, planche pleine : x = 105 de y 0 à 296 ; y = 148 et y = 296 de x 0 à
 * 210 — trois axes. Lettre, pleine : x = 33,95 et 181,95 de y 34,7 à
 * 244,7 ; y = 34,7, 139,7 et 244,7 de x 33,95 à 181,95 — cinq axes.
 *
 * @param {import('../geometrie/papiers.js').Papier} papier
 * @param {boolean[]} occupees   une valeur par cellule, dans l'ordre de cellules(papier)
 * @returns {Array<{x1: number, y1: number, x2: number, y2: number}>}   mm, x1 ≤ x2, y1 ≤ y2
 * @throws {TypeError} un papier hors de PAPIERS, une valeur qui n'est pas un booléen
 * @throws {RangeError} une occupation qui n'a pas une valeur par cellule
 */
export function filets(papier, occupees) {
  const grille = grilleDe(papier);
  const toutes = cellulesEnCentiemes(grille);
  if (!Array.isArray(occupees) || occupees.length !== toutes.length) {
    throw new RangeError(`filets : ${toutes.length} occupations attendues, une par cellule`);
  }
  if (!occupees.every((valeur) => typeof valeur === 'boolean')) throw new TypeError('filets : occupation booléenne attendue');
  const verticaux = new Map();
  const horizontaux = new Map();
  const ajouter = (axes, position, intervalle) => axes.set(position, [...(axes.get(position) ?? []), intervalle]);
  toutes.forEach(({ x, y, l, h }, rang) => {
    if (!occupees[rang]) return;
    for (const bord of [x, x + l]) if (bord !== 0 && bord !== grille.W) ajouter(verticaux, bord, [y, y + h]);
    for (const bord of [y, y + h]) if (bord !== 0 && bord !== grille.H) ajouter(horizontaux, bord, [x, x + l]);
  });
  const segments = (axes, vertical) =>
    [...axes.keys()]
      .sort((a, b) => a - b)
      .flatMap((position) =>
        reunir(axes.get(position)).map(([debut, fin]) =>
          vertical
            ? { x1: enMm(position), y1: enMm(debut), x2: enMm(position), y2: enMm(fin) }
            : { x1: enMm(debut), y1: enMm(position), x2: enMm(fin), y2: enMm(position) },
        ),
      );
  return [...segments(verticaux, true), ...segments(horizontaux, false)];
}

/**
 * Le cadre utile d'une cellule : la cellule en retrait de ZONE_SILENCE_MM
 * de chaque bord, où seuls texte et marques se posent (§ 11.3) — 89 × 132
 * pour un badge debout, 132 × 89 à plat.
 *
 * @param {Cellule} cellule
 * @returns {{x: number, y: number, largeur: number, hauteur: number}}   mm
 */
export function cadreUtile({ x, y, largeur, hauteur }) {
  const zone = enCentiemes(constante('ZONE_SILENCE_MM'));
  return {
    x: enMm(enCentiemes(x) + zone),
    y: enMm(enCentiemes(y) + zone),
    largeur: enMm(enCentiemes(largeur) - 2 * zone),
    hauteur: enMm(enCentiemes(hauteur) - 2 * zone),
  };
}
