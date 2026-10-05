// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Appartenances d'une démonstration tirée (§ 15.2) : la loi des tailles de
// groupe, et la faisabilité d'un tour qui sépare toutes les appartenances.
// Les fonctions reçoivent des tailles de groupe et des capacités de table,
// jamais des personnes : un membre se désigne par son rang dans la suite des
// groupes, les membres du premier groupe d'abord, puis ceux du deuxième, et
// ainsi de suite. Une table sépare les appartenances quand elle ne reçoit
// jamais deux membres d'un même groupe. Aucune fonction ne modifie les listes
// qu'elle reçoit ; tirerTailles fait avancer le générateur qu'on lui passe.

/** Poids des tailles de groupe 1 à 12 (§ 15.2) : POIDS_TAILLES[s − 1] pèse la taille s. */
export const POIDS_TAILLES = Object.freeze([24, 20, 16, 8, 6, 5, 4, 3, 2, 2, 1, 1]);

/**
 * Somme des nombres d'une liste ; 0 pour une liste vide.
 * @param {number[]} liste
 * @returns {number}
 */
export const somme = (liste) => liste.reduce((a, b) => a + b, 0);
const maximum = (liste) => liste.reduce((a, b) => Math.max(a, b), 0);

const SOMME_POIDS = somme(POIDS_TAILLES);

// Une taille tirée selon POIDS_TAILLES, par un seul borne(92) : le tirage u
// donne la taille s quand la somme des s − 1 premiers poids est ≤ u et que
// celle des s premiers le dépasse.
function tirerTaille(rng) {
  let reste = rng.borne(SOMME_POIDS);
  let rang = 0;
  while (reste >= POIDS_TAILLES[rang]) {
    reste -= POIDS_TAILLES[rang];
    rang += 1;
  }
  return rang + 1;
}

/**
 * Tailles de groupe tirées pour total membres (§ 15.2) : une taille tirée par
 * groupe, tant que la somme des tailles reste sous total, puis le dernier
 * groupe tronqué au reste. La somme rendue vaut total ; total = 0 ne tire rien
 * et rend [].
 *
 * @param {{borne: function(number): number}} rng  générateur de prng.js
 * @param {number} total  membres à répartir, entier ≥ 0
 * @returns {number[]}  tailles, de 1 à 12, dans l'ordre des tirages
 * @throws {RangeError} total n'est pas un entier ≥ 0
 */
export function tirerTailles(rng, total) {
  if (!Number.isInteger(total) || total < 0) {
    throw new RangeError(`total : entier ≥ 0 attendu, reçu ${String(total)}`);
  }
  const tailles = [];
  let couverts = 0;
  while (couverts < total) {
    const taille = Math.min(tirerTaille(rng), total - couverts);
    tailles.push(taille);
    couverts += taille;
  }
  return tailles;
}

/**
 * Les deux inégalités qu'un tour séparant toutes les appartenances exige
 * (§ 15.2), contrôlées dans cet ordre ; la première rompue est nommée.
 * - PLUS_GROS_GROUPE : le plus gros groupe dépasse le nombre de tables, alors
 *   que chacun de ses membres occupe une table différente.
 * - PLUS_GRANDE_CAPACITE : la plus grande capacité, diminuée du surplus de
 *   sièges sur les membres quand il est positif, dépasse le nombre de groupes.
 *   Une table reçoit au moins sa capacité moins ce surplus, chacun de ses
 *   membres d'un groupe différent. Dans une salle exactement pleine, c'est
 *   « plus grande capacité ≤ nombre de groupes ».
 * Nécessaires, elles ne suffisent pas : seul tourTemoin conclut.
 *
 * @param {number[]} tailles  taille de chaque groupe
 * @param {number[]} capacites  sièges de chaque table
 * @returns {{ok: boolean, raison?: 'PLUS_GROS_GROUPE'|'PLUS_GRANDE_CAPACITE'}}
 */
export function faisabilite(tailles, capacites) {
  if (maximum(tailles) > capacites.length) return { ok: false, raison: 'PLUS_GROS_GROUPE' };
  const surplus = Math.max(0, somme(capacites) - somme(tailles));
  if (maximum(capacites) - surplus > tailles.length) {
    return { ok: false, raison: 'PLUS_GRANDE_CAPACITE' };
  }
  return { ok: true };
}

/**
 * Un tour témoin (§ 15.2) : chaque membre assis, aucune table au-delà de sa
 * capacité, aucun groupe deux fois à une même table.
 *
 * Les groupes se placent dans l'ordre reçu, chacun aux tables qui gardent le
 * plus de sièges libres, à égalité la table de plus petit index, ses membres
 * dans l'ordre de ces tables. Ce choix glouton ne manque aucun tour qui
 * existe. Soit un tour qui place le groupe à une table b plutôt qu'à une
 * table a du choix, laquelle gardait au moins autant de sièges libres : ou a
 * garde un siège dans ce tour, et le membre passe de b à a ; ou a est pleine,
 * elle reçoit alors plus de membres des groupes suivants que b, et l'un
 * d'eux, assis en a et non en b, échange sa place avec lui. Répété, l'échange
 * donne un tour qui place le groupe exactement comme le choix glouton : les
 * groupes suivants ont un tour sur les sièges que ce choix leur laisse.
 *
 * @param {number[]} tailles  taille de chaque groupe
 * @param {number[]} capacites  sièges de chaque table
 * @returns {number[]|null}  index de table de chaque membre, dans l'ordre des
 *   membres ; null quand aucun tour ne sépare tous les groupes
 */
export function tourTemoin(tailles, capacites) {
  const libres = [...capacites];
  const ordre = capacites.map((_, t) => t);
  const tour = [];
  for (const taille of tailles) {
    ordre.sort((a, b) => libres[b] - libres[a] || a - b);
    if (taille > ordre.length || libres[ordre[taille - 1]] === 0) return null;
    for (let m = 0; m < taille; m += 1) {
      const t = ordre[m];
      tour.push(t);
      libres[t] -= 1;
    }
  }
  return tour;
}
