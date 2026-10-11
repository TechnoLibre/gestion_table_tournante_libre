// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Identité et réconciliation des étiquettes (§ 4.5, § 10.1). Deux étiquettes
// de même clé normalisée sont la même étiquette : une saisie ou une ligne
// importée reçoit l'orthographe que l'événement porte déjà pour sa clé, la
// plus petite par points de code quand il en porte plusieurs, et à défaut la
// plus petite des orthographes lues. Le résultat ne dépend ainsi ni de
// l'ordre des existantes ni de celui des lignes. La forme d'une étiquette et
// la découpe d'une cellule vivent dans src/stockage/etiquettes.js : ce module
// reçoit des étiquettes déjà découpées et n'en juge pas la forme.
import { cleNormalisee } from './normalisation.js';

/**
 * Clé d'identité d'une étiquette : la clé normalisée du § 10.1, la même
 * fonction que celle des appartenances et de la clé de doublon.
 *
 * @type {(texte: string) => string}
 */
export const cleEtiquette = cleNormalisee;

// Ordre par points de code. L'opérateur « < » des chaînes compare des unités
// de code UTF-16 : une lettre hors du plan de base, codée par une paire dont
// la première moitié vaut 0xD800 à 0xDBFF, y passerait avant U+E000 à U+FFFF.
// Deux préfixes égaux ont la même découpe en unités, si bien qu'un seul
// indice parcourt les deux textes ; un préfixe propre vient avant le texte
// qui le prolonge. Rend un nombre négatif, nul ou positif.
function comparerPointsDeCode(a, b) {
  let i = 0;
  while (i < a.length && i < b.length) {
    const pointA = a.codePointAt(i);
    const pointB = b.codePointAt(i);
    if (pointA !== pointB) return pointA - pointB;
    i += pointA > 0xffff ? 2 : 1;
  }
  return a.length - b.length;
}

// La plus petite d'une suite non vide de textes, par points de code.
function plusPetite(textes) {
  let retenue = null;
  for (const texte of textes) {
    if (retenue === null || comparerPointsDeCode(texte, retenue) < 0) retenue = texte;
  }
  return retenue;
}

/**
 * Orthographe que reçoit une saisie (§ 4.5) : la plus petite, par points de
 * code, des existantes de même clé ; la saisie elle-même quand aucune
 * existante ne partage sa clé. Une saisie déjà présente reçoit elle aussi la
 * plus petite de sa clé. L'appelant compare le résultat à la saisie pour
 * savoir s'il doit dire l'orthographe retenue.
 *
 * @param {Iterable<string>} existantes  les étiquettes de l'événement,
 *   personnes et objectifs de table confondus, doublons admis
 * @param {string} saisie  une étiquette déjà mise en forme
 * @returns {string}
 */
export function orthographeRecue(existantes, saisie) {
  const cle = cleEtiquette(saisie);
  return plusPetite([...existantes].filter((texte) => cleEtiquette(texte) === cle)) ?? saisie;
}

/**
 * @typedef {Object} FusionEtiquettes
 * @property {string} retenue  l'orthographe que reçoivent les lignes
 * @property {string[]} orthographes  les orthographes distinctes de la clé,
 *   existantes et lues, retenue comprise, par points de code croissants
 * @property {number} lignes  le nombre de lignes dont la liste porte la clé
 *   sous une autre orthographe que la retenue, donc réécrite
 */

/**
 * Réconcilie les étiquettes des lignes d'un import (§ 10.1) avec celles de
 * l'événement, puis entre elles. Une clé que l'événement porte reçoit la plus
 * petite de ses orthographes existantes ; une clé que seules les lignes
 * portent, la plus petite des orthographes lues. Chaque liste est réécrite
 * dans son ordre, une étiquette prenant l'orthographe de sa clé ; une
 * orthographe qui en rejoint une autre de la même liste se fond à la place
 * de la première. Les existantes ne sont jamais réécrites.
 *
 * Une fusion est rendue pour chaque clé qui réécrit au moins une ligne, et
 * aucune ligne n'est réécrite sans la sienne : une ligne qui porte déjà
 * l'orthographe retenue ne fait pas de fusion, même quand l'événement porte
 * d'autres orthographes de sa clé. Les fusions se rangent par leur première
 * ligne réécrite, puis par l'orthographe retenue.
 *
 * @param {Iterable<string>} existantes  les étiquettes de l'événement,
 *   doublons admis
 * @param {Array<string[]|null>} listes  les étiquettes de chaque ligne, déjà
 *   découpées et mises en forme ; null pour une ligne qui n'en donne pas
 * @returns {{listes: Array<string[]|null>, fusions: FusionEtiquettes[]}}
 *   listes : une liste neuve par ligne, au même rang, null gardé
 */
export function reconcilier(existantes, listes) {
  const groupes = new Map();
  const groupeDe = (texte) => {
    const cle = cleEtiquette(texte);
    let groupe = groupes.get(cle);
    if (groupe === undefined) {
      groupe = { existantes: new Set(), lues: new Set(), retenue: null, reecrites: [] };
      groupes.set(cle, groupe);
    }
    return groupe;
  };
  for (const texte of existantes) groupeDe(texte).existantes.add(texte);
  for (const liste of listes) {
    if (liste !== null) for (const texte of liste) groupeDe(texte).lues.add(texte);
  }
  for (const groupe of groupes.values()) {
    groupe.retenue = plusPetite(groupe.existantes.size > 0 ? groupe.existantes : groupe.lues);
  }

  const reecrites = listes.map((liste, rang) => {
    if (liste === null) return null;
    const vues = new Set();
    for (const texte of liste) {
      const groupe = groupes.get(cleEtiquette(texte));
      if (texte !== groupe.retenue && groupe.reecrites.at(-1) !== rang) groupe.reecrites.push(rang);
      vues.add(groupe.retenue);
    }
    return [...vues];
  });

  const fusions = [...groupes.values()]
    .filter((groupe) => groupe.reecrites.length > 0)
    .sort((a, b) => a.reecrites[0] - b.reecrites[0] || comparerPointsDeCode(a.retenue, b.retenue))
    .map((groupe) => ({
      retenue: groupe.retenue,
      orthographes: [...new Set([...groupe.existantes, ...groupe.lues])].sort(comparerPointsDeCode),
      lignes: groupe.reecrites.length,
    }));
  return { listes: reecrites, fusions };
}
