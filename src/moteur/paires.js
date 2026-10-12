// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les paires répétées, la ligne d'une personne et la matrice « qui a
// rencontré qui » (§ 5.4, § 12.5), pour le seul placement que la page de
// qualité montre : aucune n'entre dans la recherche ni dans le classement.
//
// Le compte de chaque paire et sa répartition entre choisies et imposées se
// lisent dans parcourirTours (indicateurs.js), le passage dont mesurer tire
// ses rencontres répétées : parPaire porte les rencontres de chaque paire, et
// une paire figure parmi les revues d'un tour exactement quand elle est
// réunie deux fois au moins et que l'une de ses rencontres, jusqu'à ce tour,
// a lieu hors d'une table où les deux sont réservés — libre[k] de
// parcourirTours. Une paire répétée qui n'est jamais revue est imposée : les
// deux listes ont les longueurs de mesures.rencontresRepetees (§ 13.2).
//
// Les tours d'une paire se lisent dans le plan, case à case : les tours où les
// deux sont assis à la même table, la réserve n'étant pas une table. Ils sont
// autant que son compte.
//
// Chaque fonction prend en dernier paramètre, facultatif, le parcours déjà lu
// du même plan : un appelant qui en tire d'autres mesures ne relit pas le
// plan. Sans lui, la fonction le lit, et lève ce que lève exigerPlanIndexe.
// Rien de rendu n'est un tableau typé.
import { RESERVE } from './configuration.js';
import { parcourirTours } from './indicateurs.js';

/**
 * @typedef {Object} RencontreAuTour
 * @property {number} tour   index du tour, à partir de 0
 * @property {number} t      index de la table
 *
 * @typedef {Object} PaireRepetee
 * @property {number} a      index de personne, a < b
 * @property {number} b
 * @property {number} fois   rencontres de la paire, deux au moins
 * @property {RencontreAuTour[]} tours   tours croissants
 *
 * @typedef {Object} Rencontre
 * @property {number} q      index de la personne rencontrée
 * @property {number} fois   une au moins
 * @property {RencontreAuTour[]} tours   tours croissants
 */

// Rang de la paire (a, b), a < b, dans un triangle supérieur n × n rangé
// ligne par ligne : la ligne a s'ouvre après les (n − 1) + … + (n − a) cases
// des lignes qui la précèdent. C'est le rang sous lequel parPaire range ses
// comptes (indicateurs.js, qui ne l'exporte pas), et celui des cases de la
// matrice.
const rangPaire = (n, a, b) => (a * (2 * n - a - 1)) / 2 + (b - a - 1);

// Rencontres de la paire (a, b), lues dans parPaire.
const compte = (N, parPaire, a, b) => parPaire[a < b ? rangPaire(N, a, b) : rangPaire(N, b, a)];

// Tours où a et b sont assis à la même table, croissants, avec cette table.
function toursEnsemble({ R }, tableDe, a, b) {
  const tours = [];
  for (let r = 0; r < R; r += 1) {
    const t = tableDe[a * R + r];
    if (t !== RESERVE && t === tableDe[b * R + r]) tours.push({ tour: r, t });
  }
  return tours;
}

// Ordre des paires : fois décroissant, puis a, puis b croissants.
const ordrePaires = (x, y) => y.fois - x.fois || x.a - y.a || x.b - y.b;

// Vrai pour un index de personne de l'instance.
const estIndex = ({ N }, p) => Number.isInteger(p) && p >= 0 && p < N;

/**
 * Paires réunies deux fois au moins, en deux listes : choisies, quand une
 * rencontre au moins a lieu hors d'une table où les deux sont réservés ce
 * tour-là ; imposées, quand chacune a lieu à une telle table (§ 5.4, D32).
 * Chaque liste est triée par fois décroissant, puis par a, puis par b
 * croissants ; une paire porte chacun de ses tours de rencontre.
 *
 * @param {import('./types.js').Instance} instance
 * @param {ArrayLike<number>} tableDe
 * @param {ReturnType<typeof parcourirTours>} [parcours]  le même plan, déjà lu
 * @returns {{choisies: PaireRepetee[], imposees: PaireRepetee[]}}
 */
export function pairesRepetees(instance, tableDe, parcours = parcourirTours(instance, tableDe)) {
  const { N } = instance;
  const { parTour, parPaire, reunies } = parcours;
  const revue = new Uint8Array(parPaire.length);
  for (const tables of parTour) {
    for (const { revues } of tables) {
      for (const [a, b] of revues) revue[rangPaire(N, a, b)] = 1;
    }
  }
  const choisies = [];
  const imposees = [];
  for (let i = 0; i < reunies.length; i += 2) {
    const a = reunies[i];
    const b = reunies[i + 1];
    const k = rangPaire(N, a, b);
    const fois = parPaire[k];
    if (fois < 2) continue;
    const paire = { a, b, fois, tours: toursEnsemble(instance, tableDe, a, b) };
    (revue[k] === 1 ? choisies : imposees).push(paire);
  }
  return { choisies: choisies.sort(ordrePaires), imposees: imposees.sort(ordrePaires) };
}

/**
 * La ligne de la personne p (§ 12.5, D33) : chaque personne qu'elle
 * rencontre, avec le nombre de fois et les tours, par fois décroissant puis
 * par index croissant. Choisies et imposées ne s'y séparent pas.
 *
 * @param {import('./types.js').Instance} instance
 * @param {ArrayLike<number>} tableDe
 * @param {number} p   index de personne ; lève RangeError hors de 0..N − 1
 * @param {ReturnType<typeof parcourirTours>} [parcours]  le même plan, déjà lu
 * @returns {Rencontre[]}
 */
export function rencontresDe(instance, tableDe, p, parcours = parcourirTours(instance, tableDe)) {
  if (!estIndex(instance, p)) throw new RangeError(`personne ${p} hors des index 0..${instance.N - 1}`);
  const { N } = instance;
  const ligne = [];
  for (let q = 0; q < N; q += 1) {
    if (q === p) continue;
    const fois = compte(N, parcours.parPaire, p, q);
    if (fois > 0) ligne.push({ q, fois, tours: toursEnsemble(instance, tableDe, p, q) });
  }
  // Les personnes entrent par index croissant, et le tri est stable.
  return ligne.sort((x, y) => y.fois - x.fois);
}

/**
 * Les comptes de rencontres des personnes d'ordre, deux à deux : le triangle
 * supérieur strict, sans diagonale, rangé ligne par ligne — la case (i, j),
 * i < j, au rang i · (2n − i − 1) / 2 + (j − i − 1), n la longueur d'ordre,
 * porte les rencontres de ordre[i] et ordre[j]. Le compte est exact ; les
 * niveaux de l'échelle se lisent ailleurs (niveau, géométrie).
 *
 * @param {import('./types.js').Instance} instance
 * @param {ArrayLike<number>} tableDe
 * @param {number[]} ordre   index de personnes distincts ; lève RangeError
 *                           sur un index hors de 0..N − 1 ou répété
 * @param {ReturnType<typeof parcourirTours>} [parcours]  le même plan, déjà lu
 * @returns {number[]}   n · (n − 1) / 2 comptes
 */
export function matriceRencontres(instance, tableDe, ordre, parcours = parcourirTours(instance, tableDe)) {
  const { N } = instance;
  const vu = new Uint8Array(N);
  for (const p of ordre) {
    if (!estIndex(instance, p) || vu[p] === 1) throw new RangeError(`ordre : personne ${p} hors des index ou répétée`);
    vu[p] = 1;
  }
  const n = ordre.length;
  const comptes = new Array((n * (n - 1)) / 2);
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      comptes[rangPaire(n, i, j)] = compte(N, parcours.parPaire, ordre[i], ordre[j]);
    }
  }
  return comptes;
}
