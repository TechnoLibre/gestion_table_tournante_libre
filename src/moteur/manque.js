// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le manque, et ce qui s'en lit (§ 5.5, § 12.10). Chaque personne porte quatre
// quantités, rangées sur une ligne (§ 12.10.5) :
//
//   N − 1  ≥  plafond a priori  ≥  plafond réalisé  ≥  rencontres
//
// Trois différences s'en lisent, sous les noms du glossaire du § 5.5 :
// manque = plafond réalisé − rencontres ; écart d'itinéraire = plafond a
// priori − plafond réalisé ; écart au plafond a priori = plafond a priori −
// rencontres, la somme des deux premières. Chacune a sa fonction : manques,
// ecartsItineraire, ecartsAuPlafondAPriori. Chacune est une soustraction sur
// des tableaux que mesurer (indicateurs.js) et plafond.js ont déjà calculés :
// aucune fonction ne relit le plan ni les paires qu'il réunit, et aucune ne
// modifie ce qu'elle reçoit. Tout tableau par personne suit l'ordre
// canonique, celui de instance.ids.
//
// Les agrégats portent sur les trois populations du § 5.4 : tous, les
// mobiles — partiellement fixés compris — et les ancrés, que forme
// replierParPopulation (configuration.js). Une population vide rend null,
// jamais 0.
//
// Le plafond a priori vaut null quand il est inconnu (§ 12.10.9) : seul null
// le dit. undefined, la valeur d'un champ manquant, lève TypeError au lieu
// de passer pour inconnu. Une liste qui n'a pas une case par personne lève
// RangeError : elle décrit une autre population.
import { replierParPopulation } from './configuration.js';

/**
 * @typedef {{tous: number|null, mobiles: number|null, ancres: number|null}} ParPopulation
 *          un chiffre par population ; null pour une population vide
 *
 * @typedef {Object} TroisChiffres  les trois chiffres du § 12.10.4
 * @property {ParPopulation} manqueMax       le plus grand manque
 * @property {ParPopulation} effectifManque  personnes dont le manque vaut au
 *                                           moins 1 ; 0 sur une population
 *                                           non vide sans manque
 * @property {ParPopulation|null} ecartItineraireMax  le plus grand écart
 *           d'itinéraire ; null quand le plafond a priori est inconnu
 *
 * @typedef {{id: number, manque: number, plafondRealise: number}} RangProfil
 *          la personne d'un rang du profil, désignée par son identifiant
 *
 * @typedef {Object} Comparaison
 * @property {boolean} comparable
 * @property {number} [rangsA]          rangs où A sert mieux
 * @property {number} [rangsB]          rangs où B sert mieux
 * @property {number} [egalite]         rangs à manques égaux
 * @property {number|null} [rangBascule]  à partir de 1
 * @property {'A'|'B'|null} [domine]
 */

// Lève TypeError quand valeurs n'est pas une liste, faute de longueur
// numérique ; attendu nomme ce que le paramètre nom admet.
function exigerListe(valeurs, nom, attendu = 'liste') {
  if (typeof valeurs?.length !== 'number') throw new TypeError(`${nom} : ${attendu} attendue`);
}

// Lève TypeError quand valeurs n'est pas une liste, et RangeError quand elle
// n'a pas N cases.
function exigerLongueur(valeurs, N, nom) {
  exigerListe(valeurs, nom);
  if (valeurs.length !== N) {
    throw new RangeError(`${nom} : ${valeurs.length} cases, ${N} attendues`);
  }
}

// Lève TypeError quand plafondsAPriori n'est ni null ni une liste, et
// RangeError quand c'est une liste qui n'a pas N cases.
function exigerAPriori(plafondsAPriori, N) {
  if (plafondsAPriori === null) return;
  exigerListe(plafondsAPriori, 'plafondsAPriori', 'liste ou null');
  exigerLongueur(plafondsAPriori, N, 'plafondsAPriori');
}

// gauche[p] − droite[p] pour chaque personne, deux listes de même longueur.
function soustraire(gauche, droite) {
  const differences = [];
  for (let p = 0; p < gauche.length; p += 1) differences.push(gauche[p] - droite[p]);
  return differences;
}

// Replie valeurs[p] sur les trois populations (replierParPopulation).
// replier(cumul, valeur) rend le cumul suivant ; cumul vaut null au premier
// membre d'une population, et une population sans membre reste à null.
const parPopulation = (valeurs, statut, replier) =>
  replierParPopulation(valeurs, statut, null, replier);

// Le plus grand des valeurs repliées.
const plusGrand = (cumul, valeur) => (cumul === null || valeur > cumul ? valeur : cumul);

// Le nombre de valeurs repliées qui valent au moins 1.
const compterAuMoinsUn = (cumul, valeur) => (cumul ?? 0) + (valeur >= 1 ? 1 : 0);

/**
 * Manque de chacun (§ 12.10.2) : plafond réalisé − rencontres, en personnes,
 * dans l'ordre des deux listes. Un manque négatif est le signe d'un calcul
 * faux, que verifierIndicateurs signale (DEPASSEMENT) ; manques le rend tel
 * quel.
 *
 * Lève TypeError quand l'un des deux arguments n'est pas une liste, et
 * RangeError quand les deux listes n'ont pas la même longueur.
 *
 * @param {ArrayLike<number>} plafondsRealises
 * @param {ArrayLike<number>} rencontres
 * @returns {number[]}
 */
export function manques(plafondsRealises, rencontres) {
  exigerListe(plafondsRealises, 'plafondsRealises');
  exigerLongueur(rencontres, plafondsRealises.length, 'rencontres');
  return soustraire(plafondsRealises, rencontres);
}

/**
 * Écart d'itinéraire de chacun (§ 5.5, § 12.10.4) : plafond a priori −
 * plafond réalisé, ce que l'itinéraire de la proposition retire avant toute
 * rencontre. Une personne en réserve à plusieurs tours le porte quand son
 * manque est nul (§ 12.6). Son plus grand est le troisième des trois chiffres.
 * null quand le plafond a priori est inconnu.
 *
 * Lève TypeError quand plafondsRealises n'est pas une liste, ou que
 * plafondsAPriori n'est ni une liste ni null, et RangeError quand
 * plafondsAPriori n'a pas une case par élément de plafondsRealises.
 *
 * @param {ArrayLike<number>|null} plafondsAPriori
 * @param {ArrayLike<number>} plafondsRealises
 * @returns {number[]|null}
 */
export function ecartsItineraire(plafondsAPriori, plafondsRealises) {
  exigerListe(plafondsRealises, 'plafondsRealises');
  exigerAPriori(plafondsAPriori, plafondsRealises.length);
  return plafondsAPriori === null ? null : soustraire(plafondsAPriori, plafondsRealises);
}

/**
 * Écart au plafond a priori de chacun (§ 5.5) : plafond a priori −
 * rencontres, soit le manque plus l'écart d'itinéraire. Le certificat de
 * « minimum atteint » le lit, et son plus grand ouvre le classement (§ 5.7).
 * null quand le plafond a priori est inconnu.
 *
 * Lève TypeError quand mesures.rencontres n'est pas une liste, ou que
 * plafondsAPriori n'est ni une liste ni null, et RangeError quand
 * plafondsAPriori n'a pas une case par élément de mesures.rencontres.
 *
 * @param {{rencontres: ArrayLike<number>}} mesures  seule la liste rencontres
 *        est lue
 * @param {ArrayLike<number>|null} plafondsAPriori
 * @returns {number[]|null}
 */
export function ecartsAuPlafondAPriori(mesures, plafondsAPriori) {
  const { rencontres } = mesures;
  exigerListe(rencontres, 'mesures.rencontres');
  exigerAPriori(plafondsAPriori, rencontres.length);
  return plafondsAPriori === null ? null : soustraire(plafondsAPriori, rencontres);
}

/**
 * Les trois chiffres de la page de qualité (§ 12.10.4), chacun sur les trois
 * populations du § 5.4 :
 * 1. manqueMax, le plus grand manque ;
 * 2. effectifManque, le nombre de personnes dont le manque vaut au moins 1 :
 *    0 sur une population non vide sans manque, un zéro mesuré ;
 * 3. ecartItineraireMax, le plus grand écart d'itinéraire, plafond a priori
 *    − plafond réalisé, tel que ecartsItineraire le rend. Quand le plafond
 *    a priori est inconnu, ce chiffre vaut null tout entier, et non par
 *    population : il s'écrit « inconnu », non « — » (§ 12.10.9).
 * Une population vide vaut null dans chacun.
 *
 * Le troisième chiffre voit ce que les deux premiers ne voient pas : une
 * personne assise à peu de tours a un plafond réalisé bas, un manque nul, et
 * un grand écart d'itinéraire.
 *
 * Lève RangeError quand mesures.rencontres, plafondsRealises ou
 * plafondsAPriori n'a pas une case par participant de l'instance ; TypeError
 * quand l'une d'elles n'est pas une liste, plafondsAPriori pouvant valoir
 * null.
 *
 * @param {import('./types.js').Instance} instance  N et statut sont lus
 * @param {{rencontres: ArrayLike<number>}} mesures  seule la liste rencontres
 *        est lue
 * @param {ArrayLike<number>|null} plafondsAPriori
 * @param {ArrayLike<number>} plafondsRealises
 * @returns {TroisChiffres}
 */
export function troisChiffres(instance, mesures, plafondsAPriori, plafondsRealises) {
  const { N, statut } = instance;
  // Ces gardes confrontent chaque liste à l'instance. Celles de manques et
  // d'ecartsItineraire ne comparent les listes qu'entre elles, et laissent
  // passer trois listes accordées mais mesurées sur une autre population,
  // celles d'une proposition mesurée avant une exclusion par exemple. La case
  // p n'y désigne plus la personne p de l'instance, et parPopulation lirait
  // sans bruit le statut d'une autre personne, ou au-delà de N.
  exigerLongueur(mesures.rencontres, N, 'mesures.rencontres');
  exigerLongueur(plafondsRealises, N, 'plafondsRealises');
  exigerAPriori(plafondsAPriori, N);
  const manque = manques(plafondsRealises, mesures.rencontres);
  const ecarts = ecartsItineraire(plafondsAPriori, plafondsRealises);
  return {
    manqueMax: parPopulation(manque, statut, plusGrand),
    effectifManque: parPopulation(manque, statut, compterAuMoinsUn),
    ecartItineraireMax: ecarts === null ? null : parPopulation(ecarts, statut, plusGrand),
  };
}

/**
 * Profil de manque d'une proposition (§ 12.10.6) : une entrée par
 * participant, triée par manque décroissant, puis par plafond réalisé
 * croissant — à manque égal, la personne au plafond le plus bas,
 * proportionnellement la plus privée, d'abord (§ 12.10.3) —, puis par
 * identifiant croissant. Deux participants n'ont jamais le même identifiant :
 * la clé ordonne tout, sans dépendre de l'ordre reçu.
 *
 * Lève RangeError quand manques ou plafondsRealises n'a pas une case par
 * participant.
 *
 * @param {import('./types.js').Instance} instance  N et ids sont lus
 * @param {ArrayLike<number>} manques  ordre canonique
 * @param {ArrayLike<number>} plafondsRealises  ordre canonique
 * @returns {RangProfil[]}
 */
export function profilManque(instance, manques, plafondsRealises) {
  const { N, ids } = instance;
  exigerLongueur(manques, N, 'manques');
  exigerLongueur(plafondsRealises, N, 'plafondsRealises');
  const profil = [];
  for (let p = 0; p < N; p += 1) {
    profil.push({ id: ids[p], manque: manques[p], plafondRealise: plafondsRealises[p] });
  }
  return profil.sort(
    (a, b) => b.manque - a.manque || a.plafondRealise - b.plafondRealise || a.id - b.id,
  );
}

/**
 * La tête d'un profil de manque (§ 12.2, § 12.10.6) : la personne au rang 1,
 * son plafond réalisé, et l'effectif au manque maximal — les rangs dont le
 * manque égale celui du rang 1, à ne pas confondre avec l'effectif du
 * manque de troisChiffres, qui compte les manques d'au moins 1. Le profil
 * suit l'ordre de profilManque, manque décroissant : ces rangs sont ceux
 * de tête, et le parcours s'arrête au premier manque plus petit. L'effectif
 * vaut celui que escalierDuManque porte à la valeur du rang 1. Le rang 1
 * compte sans comparaison, les suivants par égalité stricte à son manque :
 * un manque NaN, égal à aucune valeur, donne l'effectif 1. null pour un
 * profil vide.
 *
 * Lève TypeError quand profil n'est pas une liste.
 *
 * @param {RangProfil[]} profil   profilManque
 * @returns {{id: number, plafondRealise: number, effectif: number}|null}
 */
export function teteDuManque(profil) {
  exigerListe(profil, 'profil');
  if (profil.length === 0) return null;
  const [{ id, manque, plafondRealise }] = profil;
  let effectif = 1;
  while (effectif < profil.length && profil[effectif].manque === manque) effectif += 1;
  return { id, plafondRealise, effectif };
}

// Vrai quand les deux profils portent les mêmes identifiants, chacun autant
// de fois : leurs listes d'identifiants, triées, coïncident.
function memesPersonnes(profilA, profilB) {
  if (profilA.length !== profilB.length) return false;
  const croissants = (profil) => profil.map(({ id }) => id).sort((x, y) => x - y);
  const idsB = croissants(profilB);
  return croissants(profilA).every((id, i) => id === idsB[i]);
}

/**
 * Compare deux profils de manque rang par rang (§ 12.10.6, § 12.10.7). Chaque
 * profil vient de profilManque et suit son propre ordre : le rang i désigne
 * en général deux personnes différentes, et la comparaison ne dit rien d'une
 * personne.
 *
 * Deux profils qui ne portent pas les mêmes identifiants rendent
 * { comparable: false } : leurs rangs ne se correspondent pas (§ 12.6).
 * Sinon, au rang i, la proposition au plus petit manque sert mieux, et la
 * comparaison porte :
 * - rangsA, rangsB, egalite : les rangs où A sert mieux, où B sert mieux, où
 *   les deux manques sont égaux ;
 * - rangBascule : quand le signe de manqueA(i) − manqueB(i), les égalités
 *   omises, change une fois et une seule, le rang, compté à partir de 1, où
 *   la proposition qui servait moins bien commence à servir strictement
 *   mieux. Avant lui, elle ne sert mieux à aucun rang ; à partir de lui,
 *   l'autre ne sert plus mieux à aucun. null quand le signe ne change pas, ou
 *   change plusieurs fois ;
 * - domine : 'A' quand A sert au moins aussi bien que B à chaque rang et
 *   strictement mieux à l'un d'eux, 'B' dans le cas symétrique, null sinon.
 *   Deux profils égaux à chaque rang ne se dominent pas.
 * Un parcours des rangs, après la comparaison des identifiants, suffit.
 *
 * @param {RangProfil[]} profilA
 * @param {RangProfil[]} profilB
 * @returns {Comparaison}
 */
export function comparerProfils(profilA, profilB) {
  if (!memesPersonnes(profilA, profilB)) return { comparable: false };
  let rangsA = 0;
  let rangsB = 0;
  let egalite = 0;
  // Signe du dernier rang à manques différents : −1 quand A y sert mieux, +1
  // quand B y sert mieux, 0 avant le premier.
  let signe = 0;
  let changements = 0;
  let bascule = null;
  for (let i = 0; i < profilA.length; i += 1) {
    const difference = profilA[i].manque - profilB[i].manque;
    if (difference === 0) {
      egalite += 1;
      continue;
    }
    const signeRang = difference < 0 ? -1 : 1;
    if (signeRang < 0) rangsA += 1;
    else rangsB += 1;
    if (signe !== 0 && signeRang !== signe) {
      changements += 1;
      if (changements === 1) bascule = i + 1;
    }
    signe = signeRang;
  }
  let domine = null;
  if (rangsA > 0 && rangsB === 0) domine = 'A';
  if (rangsB > 0 && rangsA === 0) domine = 'B';
  return {
    comparable: true,
    rangsA,
    rangsB,
    egalite,
    rangBascule: changements === 1 ? bascule : null,
    domine,
  };
}

// Le plus grand manque de deux profils réunis ; null quand les deux sont
// vides.
function plusGrandManque(profilA, profilB) {
  let plus = null;
  for (const profil of [profilA, profilB]) {
    for (const { manque } of profil) if (plus === null || manque > plus) plus = manque;
  }
  return plus;
}

// Les effectifs d'un profil par valeur de manque, de 0 à haut : effectifs[v]
// compte les rangs de manque v. Lève RangeError pour un manque qui n'est
// pas un entier positif ou nul, signe d'un calcul faux que la garde de la
// ligne d'évaluation refuse avant toute comparaison (§ 12.10.5).
function effectifsParValeur(profil, haut, nom) {
  const effectifs = new Array(haut + 1).fill(0);
  for (const { manque } of profil) {
    if (!Number.isInteger(manque) || manque < 0) {
      throw new RangeError(`${nom} : manque ${String(manque)}, entier positif ou nul attendu`);
    }
    effectifs[manque] += 1;
  }
  return effectifs;
}

/**
 * L'escalier du manque (§ 12.10.6, D61), jumeau tabulaire de la comparaison
 * : une ligne par entier, de la plus grande valeur de manque des deux
 * profils jusqu'à 0, que la valeur soit prise ou non, et, par profil,
 * effectif — les rangs de manque égal à la valeur — et cumul — les rangs de
 * manque au moins égal. Un profil trié par manque décroissant atteint donc
 * la valeur v jusqu'au rang cumul et pas au-delà : le cumul est le dernier
 * rang où la courbe atteint v, la courbe lue à l'envers, sans trou. Deux
 * profils vides rendent la seule ligne 0.
 *
 * Le cumul se fait de la plus grande valeur vers 0 ; les effectifs ne lisent
 * que les manques, si bien que l'ordre des rangs reçus n'y change rien.
 *
 * Lève TypeError quand un profil n'est pas une liste, et RangeError pour un
 * manque qui n'est pas un entier positif ou nul.
 *
 * @param {RangProfil[]} profilA   profilManque
 * @param {RangProfil[]} profilB   profilManque
 * @returns {Array<{valeur: number, a: {effectif: number, cumul: number}, b: {effectif: number, cumul: number}}>}
 */
export function escalierDuManque(profilA, profilB) {
  exigerListe(profilA, 'profilA');
  exigerListe(profilB, 'profilB');
  const haut = Math.max(plusGrandManque(profilA, profilB) ?? 0, 0);
  const effectifsA = effectifsParValeur(profilA, haut, 'profilA');
  const effectifsB = effectifsParValeur(profilB, haut, 'profilB');
  const lignes = [];
  let cumulA = 0;
  let cumulB = 0;
  for (let valeur = haut; valeur >= 0; valeur -= 1) {
    cumulA += effectifsA[valeur];
    cumulB += effectifsB[valeur];
    lignes.push({
      valeur,
      a: { effectif: effectifsA[valeur], cumul: cumulA },
      b: { effectif: effectifsB[valeur], cumul: cumulB },
    });
  }
  return lignes;
}

/**
 * Le nombre de valeurs de manque distinctes des deux profils réunis (§ 12.6,
 * D62) : une valeur prise par l'un et par l'autre compte une fois. Sous le
 * seuil du registre, VALEURS_MANQUE_COURBE, la comparaison écrit une phrase
 * au lieu de tracer ; la règle porte sur la réunion, jamais sur chaque
 * profil. 0 pour deux profils vides.
 *
 * L'ensemble ne sert qu'à compter : aucun ordre n'en sort.
 *
 * @param {RangProfil[]} profilA
 * @param {RangProfil[]} profilB
 * @returns {number}
 */
export function valeursDistinctes(profilA, profilB) {
  const valeurs = new Set();
  for (const profil of [profilA, profilB]) {
    for (const { manque } of profil) valeurs.add(manque);
  }
  return valeurs.size;
}

/**
 * La borne haute de l'axe de la comparaison (§ 12.10.6, D60, C19) : le plus
 * grand des deux manques maximaux, au moins 1, pour que des manques tous
 * nuls gardent un axe. Le majorant du § 12.10.4, le plus grand plafond
 * réalisé, borne le manque, pas l'axe : il écraserait les courbes contre le
 * zéro.
 *
 * @param {RangProfil[]} profilA
 * @param {RangProfil[]} profilB
 * @returns {number}
 */
export function borneHaute(profilA, profilB) {
  return Math.max(plusGrandManque(profilA, profilB) ?? 1, 1);
}

/**
 * Certificat de « minimum atteint » (§ 5.5) : vrai quand chacun atteint son
 * plafond a priori, son écart au plafond a priori valant 0 ; faux sinon. Le
 * certificat se lit contre le plafond a priori, jamais sur le seul manque :
 * une proposition qui assoit chacun sur un itinéraire bas atteint partout son
 * plafond réalisé, et ne prouve rien.
 *
 * null quand le plafond a priori est inconnu, le certificat restant hors
 * d'atteinte (§ 12.6), et sur une population vide, où il n'y a personne à
 * servir (§ 5.4).
 *
 * Lève TypeError quand mesures.rencontres n'est pas une liste, ou que
 * plafondsAPriori n'est ni une liste ni null, et RangeError quand
 * plafondsAPriori n'a pas une case par élément de mesures.rencontres.
 *
 * @param {{rencontres: ArrayLike<number>}} mesures  seule la liste rencontres
 *        est lue
 * @param {ArrayLike<number>|null} plafondsAPriori
 * @returns {boolean|null}
 */
export function minimumAtteint(mesures, plafondsAPriori) {
  const ecarts = ecartsAuPlafondAPriori(mesures, plafondsAPriori);
  if (ecarts === null || ecarts.length === 0) return null;
  return ecarts.every((ecart) => ecart === 0);
}
