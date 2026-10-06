// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Indicateurs d'un plan (§ 5.4), par recalcul complet : la mesure qui fait
// foi, dont sortent les chiffres affichés et ceux du classement (§ 5.10). Le
// plan se mesure entier, les N participants et les R tours ; les
// réservations ne retirent rien de la mesure, elles séparent seulement, dans
// les retours et les rencontres répétées, ce qu'elles imposent de ce que le
// moteur choisit. Tout tableau par personne suit l'ordre de instance.ids.
//
// Une rencontre est une paire de personnes assises à la même table au même
// tour : la réserve n'est pas une table, une table vide ou à un seul occupant
// ne forme aucune paire, et personne ne se rencontre soi-même. Deux personnes
// sans appartenance ne sont pas collègues. Un ensemble vide rend null, jamais
// 0 : le taux de diversité de qui ne rencontre aucun affilié, le minimum et la
// moyenne d'une population sans membre.
import {
  RESERVE,
  SANS_GROUPE,
  exigerPlanIndexe,
  replierParPopulation,
} from './configuration.js';

/**
 * @typedef {Object} Agregat
 * @property {number|null} min       null pour une population vide
 * @property {number|null} moyenne   null pour une population vide
 * @property {number} effectif
 *
 * @typedef {Object} TroisAgregats
 * @property {Agregat} tous
 * @property {Agregat} mobiles       mobiles et partiellement fixés (§ 5.4)
 * @property {Agregat} ancres
 *
 * @typedef {Object} Mesures
 * @property {number[]} rencontres          |met(p)|, ordre canonique
 * @property {number[]} affilies            |F(p)|
 * @property {number[]} appartenancesVues   A(p) — appartenances des affiliés
 *                                          rencontrés, la sienne comprise quand
 *                                          un collègue est rencontré
 * @property {number[]} redondance          r(p) = |F(p)| − A(p)
 * @property {(number|null)[]} diversite    d(p) = A(p) / |F(p)|, null si |F(p)| = 0
 * @property {number[]} toursAssis
 * @property {number[]} retoursChoisis      par personne
 * @property {number[]} retoursImposes      par personne
 * @property {TroisAgregats} aggRencontres
 * @property {TroisAgregats} aggRedondance
 * @property {number} totalRedondance       Σ_p r(p), le seul total de la
 *                                          redondance : la recherche et le
 *                                          classement le lisent
 * @property {number} collisionsCumulees    Σ paires de même groupe × tours ensemble
 * @property {number} pairesDistinctes      paires de même groupe réunies ≥ 1 fois
 * @property {number} excedentCollisions    cumulées − distinctes
 * @property {{choisies: number, imposees: number}} rencontresRepetees
 *           paires réunies ≥ 2 fois ; « imposée » quand chaque rencontre de la
 *           paire a lieu à une table où les deux sont réservés ce tour-là
 * @property {number} maxRencontresPaire    sur toutes les paires ; 0 si aucune
 * @property {number} totalRetoursChoisis
 * @property {number} totalRetoursImposes
 * @property {Array<{groupe: string, effectif: number, collisionsCumulees: number,
 *                   pairesDistinctes: number, excedent: number}>} parGroupe
 *           ordre de instance.groupes
 */

// Plus grand compte que tient un Uint16Array.
const UINT16_MAX = 0xffff;

// Rang de la paire (a, b), a < b, dans le triangle supérieur d'une matrice
// N × N rangé ligne par ligne : la ligne a s'ouvre après les
// (N − 1) + (N − 2) + … + (N − a) paires des lignes qui la précèdent.
const rangPaire = (N, a, b) => (a * (2 * N - a - 1)) / 2 + (b - a - 1);

// Rencontres de chaque paire, rangées par rangPaire, en parcourant chaque
// table de chaque tour. choisie vaut 1 pour une paire dont une rencontre au
// moins a lieu hors d'une table où les deux sont réservés ce tour-là. Une
// paire se réunit au plus une fois par tour : R borne chaque compte, qu'un
// Uint16Array tient tant que R ≤ 65 535.
function compterRencontres({ N, T, R, fixe }, tableDe) {
  const paires = (N * (N - 1)) / 2;
  const compte = R <= UINT16_MAX ? new Uint16Array(paires) : new Uint32Array(paires);
  const choisie = new Uint8Array(paires);
  for (let r = 0; r < R; r += 1) {
    // Occupants de chaque table, par index croissants : a < b pour toute
    // paire (liste[i], liste[j]) avec i < j. La boucle intérieure part du
    // voisin suivant : une liste vide ou d'un seul occupant ne forme aucune
    // paire, et nul n'est apparié à lui-même.
    const assis = Array.from({ length: T }, () => []);
    for (let p = 0; p < N; p += 1) {
      const t = tableDe[p * R + r];
      if (t !== RESERVE) assis[t].push(p);
    }
    for (let t = 0; t < T; t += 1) {
      const liste = assis[t];
      for (let i = 0; i < liste.length; i += 1) {
        const a = liste[i];
        const aReserve = fixe[a * R + r] === t;
        for (let j = i + 1; j < liste.length; j += 1) {
          const b = liste[j];
          const k = rangPaire(N, a, b);
          compte[k] += 1;
          if (!aReserve || fixe[b * R + r] !== t) choisie[k] = 1;
        }
      }
    }
  }
  return { compte, choisie };
}

// Lecture du triangle des paires, dans l'ordre de rangPaire. Par personne :
// |met(p)|, |F(p)| et A(p), vu[p * G + g] notant que p a déjà croisé un
// affilié du groupe g. Par groupe : une paire de collègues réunie n fois
// porte n collisions cumulées et une paire distincte. Sur toutes les paires :
// les rencontres répétées, choisies ou imposées, et le plus grand compte.
function lirePaires({ N, groupe, groupes }, { compte, choisie }) {
  const G = groupes.length;
  const rencontres = new Int32Array(N);
  const affilies = new Int32Array(N);
  const vues = new Int32Array(N);
  const vu = new Uint8Array(N * G);
  const collisions = new Array(G).fill(0);
  const distinctes = new Array(G).fill(0);
  let choisies = 0;
  let imposees = 0;
  let maxRencontresPaire = 0;

  // p rencontre q : q compte dans met(p) ; un affilié compte aussi dans F(p),
  // et son groupe compte dans A(p) au premier membre de ce groupe que p
  // rencontre.
  const rencontrer = (p, q) => {
    rencontres[p] += 1;
    const g = groupe[q];
    if (g === SANS_GROUPE) return;
    affilies[p] += 1;
    if (vu[p * G + g] === 0) {
      vu[p * G + g] = 1;
      vues[p] += 1;
    }
  };

  let k = 0;
  for (let a = 0; a < N; a += 1) {
    for (let b = a + 1; b < N; b += 1, k += 1) {
      const n = compte[k];
      if (n === 0) continue;
      rencontrer(a, b);
      rencontrer(b, a);
      if (n > maxRencontresPaire) maxRencontresPaire = n;
      if (n >= 2) {
        if (choisie[k] === 1) choisies += 1;
        else imposees += 1;
      }
      const g = groupe[a];
      if (g !== SANS_GROUPE && g === groupe[b]) {
        collisions[g] += n;
        distinctes[g] += 1;
      }
    }
  }
  return {
    rencontres,
    affilies,
    vues,
    collisions,
    distinctes,
    rencontresRepetees: { choisies, imposees },
    maxRencontresPaire,
  };
}

// Tours assis et retours de chaque personne (§ 5.4). Pour une table visitée
// m fois, dont f à un tour où la personne y est réservée : max(0, f − 1)
// retours imposés et (m − 1) − imposés retours choisis. visites et reservees
// comptent par table les tours de la personne en cours ; le second parcours
// de ses tours solde chaque table à sa première occurrence et remet ses
// compteurs à zéro, si bien que la personne suivante les trouve nuls.
function compterRetours({ N, T, R, fixe }, tableDe) {
  const toursAssis = [];
  const retoursChoisis = [];
  const retoursImposes = [];
  const visites = new Int32Array(T);
  const reservees = new Int32Array(T);
  for (let p = 0; p < N; p += 1) {
    let assis = 0;
    for (let r = 0; r < R; r += 1) {
      const t = tableDe[p * R + r];
      if (t === RESERVE) continue;
      assis += 1;
      visites[t] += 1;
      if (fixe[p * R + r] === t) reservees[t] += 1;
    }
    let choisis = 0;
    let imposes = 0;
    for (let r = 0; r < R; r += 1) {
      const t = tableDe[p * R + r];
      if (t === RESERVE || visites[t] === 0) continue;
      const imposesTable = Math.max(0, reservees[t] - 1);
      imposes += imposesTable;
      choisis += visites[t] - 1 - imposesTable;
      visites[t] = 0;
      reservees[t] = 0;
    }
    toursAssis.push(assis);
    retoursChoisis.push(choisis);
    retoursImposes.push(imposes);
  }
  return { toursAssis, retoursChoisis, retoursImposes };
}

// Population sans membre. min reste null tant qu'aucune valeur n'y entre :
// aucun Infinity ne sert de minimum initial.
const VIDE = Object.freeze({ min: null, somme: 0, effectif: 0 });

// La population, une valeur de plus ; celle qu'elle reçoit reste intacte.
const ajouter = ({ min, somme, effectif }, valeur) => ({
  min: min === null || valeur < min ? valeur : min,
  somme: somme + valeur,
  effectif: effectif + 1,
});

// Agrégat d'une population ; la moyenne d'une population vide vaut null.
const conclure = ({ min, somme, effectif }) => ({
  min,
  moyenne: effectif === 0 ? null : somme / effectif,
  effectif,
});

// Minimum, moyenne et effectif de valeurs[p] sur les trois populations du
// § 5.4, que replierParPopulation forme.
function troisAgregats(valeurs, statut) {
  const { tous, mobiles, ancres } = replierParPopulation(valeurs, statut, VIDE, ajouter);
  return { tous: conclure(tous), mobiles: conclure(mobiles), ancres: conclure(ancres) };
}

const somme = (valeurs) => valeurs.reduce((total, valeur) => total + valeur, 0);

/**
 * Mesure complète d'un plan indexé : la mesure qui fait foi (§ 5.10). Ne
 * modifie ni l'instance ni le plan. Lève ce que lève exigerPlanIndexe
 * (configuration.js) avant de lire une case : une case manquante ou d'une
 * autre forme lèverait plus loin une erreur qui ne nommerait ni la personne
 * ni le tour.
 *
 * @param {import('./types.js').Instance} instance
 * @param {ArrayLike<number>} tableDe  tableDe[p * R + r] = index de table, RESERVE pour la réserve
 * @returns {Mesures}
 */
export function mesurer(instance, tableDe) {
  exigerPlanIndexe(instance, tableDe);
  const { N, groupe, groupes, statut } = instance;
  const paires = lirePaires(instance, compterRencontres(instance, tableDe));
  const { collisions, distinctes } = paires;

  const rencontres = Array.from(paires.rencontres);
  const affilies = Array.from(paires.affilies);
  const appartenancesVues = Array.from(paires.vues);
  const redondance = affilies.map((f, p) => f - appartenancesVues[p]);
  const diversite = affilies.map((f, p) => (f === 0 ? null : appartenancesVues[p] / f));

  const effectifs = new Array(groupes.length).fill(0);
  for (let p = 0; p < N; p += 1) {
    if (groupe[p] !== SANS_GROUPE) effectifs[groupe[p]] += 1;
  }
  const parGroupe = groupes.map((libelle, g) => ({
    groupe: libelle,
    effectif: effectifs[g],
    collisionsCumulees: collisions[g],
    pairesDistinctes: distinctes[g],
    excedent: collisions[g] - distinctes[g],
  }));
  const collisionsCumulees = somme(collisions);
  const pairesDistinctes = somme(distinctes);

  const { toursAssis, retoursChoisis, retoursImposes } = compterRetours(instance, tableDe);

  return {
    rencontres,
    affilies,
    appartenancesVues,
    redondance,
    diversite,
    toursAssis,
    retoursChoisis,
    retoursImposes,
    aggRencontres: troisAgregats(rencontres, statut),
    aggRedondance: troisAgregats(redondance, statut),
    totalRedondance: somme(redondance),
    collisionsCumulees,
    pairesDistinctes,
    excedentCollisions: collisionsCumulees - pairesDistinctes,
    rencontresRepetees: paires.rencontresRepetees,
    maxRencontresPaire: paires.maxRencontresPaire,
    totalRetoursChoisis: somme(retoursChoisis),
    totalRetoursImposes: somme(retoursImposes),
    parGroupe,
  };
}
