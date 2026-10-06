// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Classement des propositions (§ 5.7) : un ordre explicite, celui que
// l'interface écrit, et non le scalaire que descend la recherche. Cinq
// critères, chacun à minimiser, s'appliquent dans l'ordre de CRITERES ; deux
// propositions égales sur tous se départagent par identifiant croissant
// (§ 15.5, point 4), jamais par l'ordre reçu.
//
// L'excédent de collisions précède les collisions cumulées : un plan qui
// répartit six collisions sur six paires passe devant un plan qui en
// concentre quatre sur une seule (§ 5.4). Les paires distinctes ne sont pas
// une clé ; elles valent les cumulées moins l'excédent.
import { ecartsAuPlafondAPriori } from './manque.js';

/**
 * Les critères du classement, dans leur ordre d'application :
 * - ecartAuPlafondAPrioriMax : le plus grand écart au plafond a priori,
 *   plafond a priori − rencontres, sur toutes les personnes, sous le nom
 *   que lui donne le glossaire du § 5.5 ;
 * - excedentCollisions et collisionsCumulees, tels que mesurer les rend ;
 * - rencontresRepetees : les rencontres répétées que le moteur a choisies ;
 *   celles qu'imposent les réservations sont les mêmes pour toute
 *   proposition, et ne départagent rien (§ 5.4) ;
 * - redondance : Σ_p r(p), la redondance d'appartenance sommée sur les
 *   personnes, que mesurer rend sous le nom totalRedondance.
 */
export const CRITERES = Object.freeze([
  'ecartAuPlafondAPrioriMax',
  'excedentCollisions',
  'collisionsCumulees',
  'rencontresRepetees',
  'redondance',
]);

// Le critère qui lit le plafond a priori par personne : sauté quand il est
// inconnu (§ 17, point 4).
const CRITERE_A_PRIORI = 'ecartAuPlafondAPrioriMax';

// Le plus grand élément d'une liste ; null pour une liste vide.
function plusGrand(valeurs) {
  let plus = null;
  for (const valeur of valeurs) if (plus === null || valeur > plus) plus = valeur;
  return plus;
}

// Valeur de chaque critère pour une proposition lue : { mesures, ecarts },
// ecarts étant ses écarts au plafond a priori. Chaque grandeur se lit dans
// la mesure ou dans manque.js, aucune ne se refait ici. La Map ne sert qu'à
// retrouver un critère par son nom ; CRITERES en fixe l'ordre.
const VALEUR = new Map([
  ['ecartAuPlafondAPrioriMax', ({ ecarts }) => plusGrand(ecarts)],
  ['excedentCollisions', ({ mesures }) => mesures.excedentCollisions],
  ['collisionsCumulees', ({ mesures }) => mesures.collisionsCumulees],
  ['rencontresRepetees', ({ mesures }) => mesures.rencontresRepetees.choisies],
  ['redondance', ({ mesures }) => mesures.totalRedondance],
]);

// Lève TypeError pour un identifiant qui n'est pas un entier, et RangeError
// pour un identifiant répété : deux entrées de même identifiant ne se
// départagent pas. L'ensemble ne sert qu'à retrouver un identifiant déjà vu.
function exigerIdentifiants(entrees) {
  const vus = new Set();
  for (const { id } of entrees) {
    if (!Number.isInteger(id)) {
      throw new TypeError(`proposition d'identifiant ${String(id)} : entier attendu`);
    }
    if (vus.has(id)) throw new RangeError(`proposition ${id} : identifiant répété`);
    vus.add(id);
  }
}

// Lève RangeError quand deux entrées mesurent des populations de tailles
// différentes : leurs chiffres ne se comparent pas. Les mesures ne portent
// aucun identifiant de personne : deux populations de même taille mais de
// personnes différentes passent, et l'appelant en répond (voir classer).
function exigerMemeTaille(entrees) {
  const [premiere] = entrees;
  for (const { id, mesures } of entrees) {
    const taille = mesures.rencontres.length;
    const attendue = premiere.mesures.rencontres.length;
    if (taille !== attendue) {
      throw new RangeError(
        `proposition ${id} : ${taille} personnes mesurées, `
          + `${attendue} pour la proposition ${premiere.id}`,
      );
    }
  }
}

// Ordre lexicographique de deux clés de même longueur. Sur une population
// vide, le plus grand écart au plafond a priori vaut null pour chaque entrée,
// toutes de même taille : deux null sont égaux.
function comparerCles(a, b) {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

/**
 * Ordre des propositions (§ 5.7), la meilleure d'abord : critère par critère
 * dans l'ordre de CRITERES, chacun croissant, puis identifiant croissant.
 *
 * Chaque entrée porte id, l'identifiant entier de la proposition ; mesures,
 * telles que mesurer les rend ; plafondsAPriori, la liste de plafond.js, ou
 * null quand le plafond a priori est inconnu (§ 17, point 4). Une seule
 * entrée à plafond a priori inconnu fait sauter le premier critère pour
 * toutes : critereSaute le nomme, et criteresAppliques s'ouvre sur le critère
 * appliqué à sa place (§ 5.7). Sinon critereSaute vaut null et
 * criteresAppliques reprend CRITERES.
 *
 * Toutes les entrées sont mesurées sur une même population : leurs chiffres
 * ne se comparent qu'à cette condition. classer n'en contrôle que la taille,
 * les mesures ne portant aucun identifiant de personne ; deux populations de
 * même taille mais de personnes différentes, après une exclusion et un ajout
 * (§ 9, § 12.6), passent sans bruit. Les identifiants sont uniques parmi les
 * entrées, et rechercher numérote les propositions de chaque génération de 1
 * à nombre : l'appelant qui accumule des générations (§ 5.7) les partitionne
 * par population, et donne à chaque proposition un identifiant unique à
 * travers les générations.
 *
 * Lève TypeError pour un identifiant qui n'est pas un entier, ou un
 * plafondsAPriori qui n'est ni une liste ni null ; RangeError pour un
 * identifiant répété, pour des mesures de populations de tailles
 * différentes, ou pour un plafond a priori qui n'a pas une case par
 * personne mesurée. Ne modifie pas ce qu'il reçoit.
 *
 * @param {Array<{id: number, mesures: import('./indicateurs.js').Mesures,
 *                plafondsAPriori: ArrayLike<number>|null}>} entrees
 * @returns {{ordre: number[], criteresAppliques: string[], critereSaute: string|null}}
 */
export function classer(entrees) {
  exigerIdentifiants(entrees);
  exigerMemeTaille(entrees);
  const lues = entrees.map(({ id, mesures, plafondsAPriori }) => ({
    id,
    mesures,
    ecarts: ecartsAuPlafondAPriori(mesures, plafondsAPriori),
  }));
  const saute = lues.some(({ ecarts }) => ecarts === null);
  const criteresAppliques = CRITERES.filter((critere) => !saute || critere !== CRITERE_A_PRIORI);
  const classees = lues.map((lue) => ({
    id: lue.id,
    cle: criteresAppliques.map((critere) => VALEUR.get(critere)(lue)),
  }));
  classees.sort((a, b) => comparerCles(a.cle, b.cle) || a.id - b.id);
  return {
    ordre: classees.map(({ id }) => id),
    criteresAppliques,
    critereSaute: saute ? CRITERE_A_PRIORI : null,
  };
}
