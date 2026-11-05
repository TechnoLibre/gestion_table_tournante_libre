// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le plancher des conflits en étoile (§ 5.6) : un plancher de collisions
// cumulées, plus fort que la somme des planchers par groupe du moteur, pour
// des organisations que des conflits d'organisation empêchent de partager
// une table. Il lit l'instance normalisée de la configuration de la charge
// (configurationDe, normaliser), comme diagnostic.js, et l'interface le
// reçoit d'ici, sans importer le moteur (§ 13.4).
//
// Le graphe des conflits relie deux organisations quand l'instance les dit
// en conflit (conflitEntre) ; une personne sans organisation n'y entre pas :
// seule de son unité, elle ne porte aucune collision, et retirer ses
// conflits ne fait que relâcher la contrainte. Une composante connexe est en
// étoile quand une organisation, le centre, est en conflit avec chacune des
// autres, les branches, et qu'aucune autre paire ne l'est ; deux
// organisations seules en conflit forment une étoile à une branche, dont le
// centre est la première dans l'ordre de instance.groupes.
//
// Dans tout plan sans conflit d'organisation, une table d'un tour reçoit
// des membres du centre ou des membres des branches, jamais des deux ; les
// branches, sans conflit entre elles, se partagent les mêmes tables. Au tour
// r, si le centre occupe a des T tables, ses n₀ présents forment au moins
// f(n₀, a) collisions et chaque branche de nᵢ présents au moins
// f(nᵢ, T − a), où f(n, k), le plus petit Σ C(xⱼ, 2) de n personnes sur k
// tables, vient de la répartition la plus égale. Le plancher du tour est le
// minimum sur a de 0 à T ; celui de la composante, la somme sur les tours.
// Les capacités sont relâchées : la borne ne dépasse jamais le vrai minimum.
// Elle suppose chaque membre libre : un membre réservé à une table, même à
// un seul tour, la fait taire, les tables qu'il bloque n'étant pas
// modélisées. Elle se tait aussi quand un tour la rend infinie — une seule
// table pour le centre et une branche présents : aucun plan sans conflit
// n'existe —, et quand la séparation est décochée : les collisions ne
// comptent pas.
//
// Une étoile ne s'écrit que si son plancher dépasse la somme des planchers
// par groupe que le moteur prouve pour ses organisations (planchersCollisions,
// celui du diagnostic) : sinon elle n'apprend rien. Le module ne modifie pas
// la charge et lève ce que normaliser lève.
import { LIBRE, SANS_GROUPE, normaliser } from '../moteur/configuration.js';
import { planchersCollisions } from '../moteur/diagnostic.js';
import { configurationDe } from './configuration.js';

// Paires que forment x personnes : C(x, 2).
const paires = (x) => (x * (x - 1)) / 2;

/**
 * f(n, k) : le plus petit nombre de collisions de n personnes d'une même
 * organisation assises à k tables, capacités relâchées, Σ C(xⱼ, 2) sur la
 * répartition la plus égale — n mod k tables de ⌊n / k⌋ + 1, les autres de
 * ⌊n / k⌋. Infinity quand n > 0 et k = 0 : personne ne s'assied ; 0 pour
 * n = 0.
 *
 * @param {number} n  entier ≥ 0
 * @param {number} k  entier ≥ 0
 * @returns {number}
 */
export function collisionsMinimales(n, k) {
  if (n === 0) return 0;
  if (k === 0) return Infinity;
  const base = Math.floor(n / k);
  const plus = n % k;
  return plus * paires(base + 1) + (k - plus) * paires(base);
}

// Les voisins de chaque organisation dans le graphe des conflits, par index
// croissant. L'unité d'un affilié est son groupe : le rang de son unité,
// uniteConflit[p], désigne ce groupe dans conflitEntre.
function voisinsDesGroupes({ N, groupe, groupes, uniteConflit, unitesConflit, conflitEntre }) {
  const G = groupes.length;
  const rangDe = new Int32Array(G).fill(-1);
  for (let p = 0; p < N; p += 1) if (groupe[p] !== SANS_GROUPE) rangDe[groupe[p]] = uniteConflit[p];
  return Array.from({ length: G }, (_, g) => {
    const voisins = [];
    if (rangDe[g] < 0) return voisins;
    for (let h = 0; h < G; h += 1) {
      if (h !== g && rangDe[h] >= 0 && conflitEntre[rangDe[g] * unitesConflit + rangDe[h]] === 1) voisins.push(h);
    }
    return voisins;
  });
}

// Les composantes d'au moins deux organisations, chacune par index
// croissant, dans l'ordre de leur plus petit index.
function composantes(voisins) {
  const vue = new Uint8Array(voisins.length);
  const liste = [];
  for (let g = 0; g < voisins.length; g += 1) {
    if (vue[g] === 1 || voisins[g].length === 0) continue;
    const membres = [];
    const pile = [g];
    vue[g] = 1;
    while (pile.length > 0) {
      const h = pile.pop();
      membres.push(h);
      for (const v of voisins[h]) {
        if (vue[v] === 0) {
          vue[v] = 1;
          pile.push(v);
        }
      }
    }
    liste.push(membres.sort((a, b) => a - b));
  }
  return liste;
}

// Le centre d'une composante en étoile, null quand elle n'en est pas une :
// k − 1 conflits seulement, tous portés par une même organisation. À deux
// organisations, la première.
function centreDe(membres, voisins) {
  const k = membres.length;
  const conflits = membres.reduce((somme, g) => somme + voisins[g].length, 0) / 2;
  if (conflits !== k - 1) return null;
  return membres.find((g) => voisins[g].length === k - 1) ?? null;
}

// Vrai quand un membre présent d'une des organisations est réservé à une
// table à l'un de ses tours de présence ; fixe vaut LIBRE aux tours
// d'absence.
function unMembreFixe({ N, R, groupe, fixe }, dans) {
  for (let p = 0; p < N; p += 1) {
    if (groupe[p] === SANS_GROUPE || !dans.has(groupe[p])) continue;
    for (let r = 0; r < R; r += 1) if (fixe[p * R + r] !== LIBRE) return true;
  }
  return false;
}

// Le plancher de chaque tour de l'étoile, null quand un tour le rend infini.
function parTourDe({ N, T, R, groupe, present }, centre, branches) {
  const rangDans = new Map([centre, ...branches].map((g, i) => [g, i]));
  const parTour = [];
  for (let r = 0; r < R; r += 1) {
    const presents = new Array(rangDans.size).fill(0);
    for (let p = 0; p < N; p += 1) {
      if (present[p * R + r] === 0 || groupe[p] === SANS_GROUPE || !rangDans.has(groupe[p])) continue;
      presents[rangDans.get(groupe[p])] += 1;
    }
    let minimum = Infinity;
    for (let a = 0; a <= T; a += 1) {
      let total = collisionsMinimales(presents[0], a);
      for (let i = 1; i < presents.length; i += 1) total += collisionsMinimales(presents[i], T - a);
      if (total < minimum) minimum = total;
    }
    if (minimum === Infinity) return null;
    parTour.push(minimum);
  }
  return parTour;
}

/**
 * @typedef {Object} PlancherConflits
 * @property {string[]} organisations   le libellé du centre, puis ceux des
 *           branches, dans l'ordre de instance.groupes
 * @property {number} plancherCumulees  collisions cumulées de ces
 *           organisations sur les R tours, dans tout plan sans conflit
 *           d'organisation
 * @property {number[]} parTour         le plancher de chaque tour, R cases
 * @property {number} gain              plancherCumulees moins la somme des
 *           planchers par groupe du moteur pour ces organisations, > 0
 */

/**
 * Les planchers des conflits en étoile de la charge (§ 5.6), un par
 * composante en étoile dont le plancher dépasse la somme des planchers par
 * groupe, dans l'ordre de instance.groupes de leur centre ; aucun quand la
 * séparation est décochée. Ne modifie pas la charge.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {PlancherConflits[]}
 */
export function planchersConflits(charge) {
  const instance = normaliser(configurationDe(charge));
  if (!instance.contraintes.separerOrganisations) return [];
  const voisins = voisinsDesGroupes(instance);
  const etoiles = composantes(voisins).flatMap((membres) => {
    const centre = centreDe(membres, voisins);
    if (centre === null || unMembreFixe(instance, new Set(membres))) return [];
    const branches = membres.filter((g) => g !== centre);
    const parTour = parTourDe(instance, centre, branches);
    return parTour === null ? [] : [{ centre, branches, parTour }];
  });
  if (etoiles.length === 0) return [];
  const parGroupe = new Map(planchersCollisions(instance).map(({ groupe, plancherCumulees }) => [groupe, plancherCumulees]));
  return etoiles
    .sort((a, b) => a.centre - b.centre)
    .flatMap(({ centre, branches, parTour }) => {
      const organisations = [centre, ...branches].map((g) => instance.groupes[g]);
      const plancherCumulees = parTour.reduce((somme, plancher) => somme + plancher, 0);
      const gain = plancherCumulees - organisations.reduce((somme, libelle) => somme + (parGroupe.get(libelle) ?? 0), 0);
      return gain > 0 ? [{ organisations, plancherCumulees, parTour, gain }] : [];
    });
}

/**
 * Le plancher total des collisions cumulées d'un plan sans conflit
 * d'organisation : la somme des planchers par groupe du diagnostic, plus le
 * gain de chaque étoile — le plancher d'une étoile remplace la somme par
 * groupe de ses organisations. Sans étoile, la somme par groupe, qui vaut
 * pour tout plan.
 *
 * @param {Array<{plancherCumulees: number}>} collisions  diagnostic.collisions
 * @param {Array<{gain: number}>} conflits  ceux de planchersConflits
 * @returns {number}
 */
export function plancherCollisionsTotal(collisions, conflits) {
  const parGroupe = collisions.reduce((somme, { plancherCumulees }) => somme + plancherCumulees, 0);
  return conflits.reduce((somme, { gain }) => somme + gain, parGroupe);
}
