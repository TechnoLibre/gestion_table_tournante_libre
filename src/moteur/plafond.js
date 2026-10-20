// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Plafonds de rencontres (§ 5.5). Le plafond d'une personne p sur un
// itinéraire — la table qu'elle occupe à chaque tour — vaut
//
//   min(C(p), Σ_{t∈D} a_t + min(n_p^C, S))
//
// D est l'ensemble des tables distinctes visitées ; a_t, les ancrés de la
// table t, p non compté ; C(p), les autres personnes présentes à un tour au
// moins où p l'est (instance.coPresents) ; n_p^C, parmi elles, les mobiles et
// partiellement fixés (instance.mobilesCoPresents) ; S, les sièges qui
// changent d'occupant, sommés sur les tours assis. Sans absence, C(p) = N − 1
// et n_p^C = n_p, soit n − 1 pour un mobile ou un partiellement fixé, n pour
// un ancré. Les ancrés d'une table visitée comptent une fois, quel que soit
// le nombre de tours passés là ; les sièges se renouvellent à chaque tour,
// sans livrer plus de personnes que p n'en peut croiser. Un tour en réserve,
// comme un tour d'absence, n'entre ni dans D ni dans S.
//
// La borne reste prouvée sous la présence : p ne rencontre que des
// co-présents, et parmi eux au plus n_p^C mobiles ; un ancré est présent à
// chaque tour (configuration.js), si bien que les a_t ancrés occupent leur
// table à chaque tour, comme sans absence.
//
// La formule s'écrit une fois, dans borne, et se calcule sur deux bases :
// - les capacités, S = Σ_{t∈D} m_t · (c_t − 1 − a_t), m_t les tours passés à
//   t : plafondItineraire, et son maximum sur les itinéraires admissibles, le
//   plafond a priori ;
// - l'occupation, S = Σ_{(t,r)∈I} (o_{t,r} − 1 − a_t), I les couples (table,
//   tour) où p est assis : le plafond réalisé. Sur un plan qui honore les
//   réservations, les a_t ancrés et p occupent la table à chaque tour, et
//   chaque terme est positif ou nul.
//
// Un itinéraire admissible impose les tours fixés par les réservations,
// laisse en réserve les tours d'absence et place chaque tour libre où p est
// présent à une table non entièrement ancrée : les ancrés d'une telle table
// occupent chacun de ses sièges à chaque tour. Quand aucune table ne l'est,
// les tours libres restent en réserve.
//
// Le plafond a priori majore le plafond réalisé de tout plan valide. Dans un
// tel plan, l'occupation ne dépasse pas la capacité : le plafond réalisé de p
// ne dépasse pas le plafond de son itinéraire. Cet itinéraire tient ses tours
// fixés et place ses tours libres à des tables admissibles, ou en réserve ;
// asseoir p à une table admissible n'ôte rien au plafond, puisque
// a_t ≥ 0 et c_t − 1 − a_t ≥ 0.
//
// La même formule borne aussi les affiliés que p rencontre (§ 5.5, B5) : la
// population comptée n'est plus tout le monde mais les seuls affiliés, et
// chaque terme se restreint à eux — N_aff − ε_p au lieu de N − 1, a^aff_t les
// ancrés affiliés, n^aff_p les mobiles affiliés, α_{t,r} les affiliés assis,
// ε_p valant 1 quand p est affilié, 0 sinon. C'est Φ_aff(p), le plafond
// réalisé des affiliés, d'où la borne de diversité A_max(p). Une population
// porte son effectif, ses mobiles, ses ancrés par table et ses membres, et,
// pour tout le monde, les co-présents et les mobiles co-présents de chacun,
// qui remplacent effectif − 1 et mobiles − 1. Les affiliés gardent leurs
// effectifs globaux : une borne plus lâche sous absence, toujours valide.
//
// Une personne se désigne par son index dans l'instance, une table par son
// index ; un tableau rendu suit l'ordre de instance.ids. Aucune fonction ne
// modifie l'instance.
//
// Une case d'itinéraire en réserve vaut RESERVE, et RESERVE vaut LIBRE
// (configuration.js) : une rangée de instance.fixe se lit comme l'itinéraire
// qui laisse en réserve chaque tour libre.
import { LIBRE, RESERVE, SANS_GROUPE, STATUT, decrire, exigerPlanIndexe } from './configuration.js';
import { ErreurConfiguration } from './erreurs.js';

// Nombre de multiensembles au-delà duquel l'énumération refuse une
// signature.
const LIMITE_ENUMERATION = 300_000;

// La population de tout le monde : N personnes, n mobiles, a_t ancrés à la
// table t ; membres null dit que chacun en est ; autres[p], C(p), et
// mobilesVus[p], n_p^C, se lisent par personne.
const tous = (instance) => ({
  effectif: instance.N,
  mobiles: instance.n,
  ancresParTable: instance.ancresParTable,
  membres: null,
  autres: instance.coPresents,
  mobilesVus: instance.mobilesCoPresents,
});

// La population des affiliés : N_aff personnes, n^aff mobiles, a^aff_t
// ancrés affiliés à la table t ; membres[p] vaut 1 pour un affilié.
function affiliesDe({ N, R, T, groupe, statut, fixe }) {
  const membres = new Uint8Array(N);
  const ancresParTable = new Int32Array(T);
  let effectif = 0;
  let mobiles = 0;
  for (let p = 0; p < N; p += 1) {
    if (groupe[p] === SANS_GROUPE) continue;
    membres[p] = 1;
    effectif += 1;
    if (statut[p] === STATUT.ANCRE) ancresParTable[fixe[p * R]] += 1;
    else mobiles += 1;
  }
  return { effectif, mobiles, ancresParTable, membres, autres: null, mobilesVus: null };
}

// ε_p : 1 quand p compte dans la population, 0 sinon.
const epsilon = (population, p) => (population.membres === null ? 1 : population.membres[p]);

// La formule du § 5.5, sur une population. ancres : Σ a_t sur les tables
// distinctes ; sieges : les sièges qui changent d'occupant ; nP : n_p^C. Le
// premier terme compte les autres membres de la population que p peut
// croiser : C(p) pour tout le monde, N_aff − ε_p pour les affiliés. Pour tout
// le monde, il ne mord jamais : C(p) vaut n_p^C plus les ancrés autres que p,
// tous co-présents, que la somme d'ancrés ne dépasse pas ; il garde la
// formule du § 5.5 lisible. Le terme des sièges sature en nP : un nombre de
// sièges au-delà ne donne rien de plus que nP sièges.
function borne(population, p, eps, nP, ancres, sieges) {
  const autres = population.autres === null ? population.effectif - eps : population.autres[p];
  return Math.min(autres, ancres + Math.min(nP, sieges));
}

// n_p^C : les mobiles de la population — partiellement fixés compris — que p
// peut rencontrer, p excepté quand il en est un ; pour tout le monde, ses
// mobiles co-présents.
const mobilesRencontrables = (instance, population, p, eps) =>
  population.mobilesVus === null
    ? population.mobiles - (eps === 1 && instance.statut[p] !== STATUT.ANCRE ? 1 : 0)
    : population.mobilesVus[p];

// Table d'ancrage de p, −1 s'il n'est pas ancré.
const ancrageDe = (instance, p) =>
  instance.statut[p] === STATUT.ANCRE ? instance.fixe[p * instance.R] : -1;

// a_t vu de p : les ancrés de la population à la table t, p non compté
// quand il en est un.
const ancresVus = (population, t, ancrage, eps) =>
  population.ancresParTable[t] - (eps === 1 && t === ancrage ? 1 : 0);

// Tables qu'un tour libre peut recevoir, par index croissant : celles où les
// ancrés laissent au moins un siège.
function tablesAdmissibles({ T, capacite, ancresParTable }) {
  const admissibles = [];
  for (let t = 0; t < T; t += 1) if (ancresParTable[t] < capacite[t]) admissibles.push(t);
  return admissibles;
}

// Vrai quand la table de la case debut + r figure déjà à l'un des tours
// précédents de la rangée.
function dejaVisitee(cases, debut, r) {
  for (let q = 0; q < r; q += 1) if (cases[debut + q] === cases[debut + r]) return true;
  return false;
}

// Plafond de p sur la rangée cases[debut … debut + R − 1], une table par
// tour, pour la population donnée. occupation porte, en [t × R + r], les
// membres de la population assis à t au tour r et fait la base du plafond
// réalisé ; null fait celle des capacités, qui ne sert qu'à tout le monde.
function plafondSurRangee(instance, population, p, cases, debut, occupation) {
  const { R, capacite } = instance;
  const ancrage = ancrageDe(instance, p);
  const eps = epsilon(population, p);
  let ancres = 0;
  let sieges = 0;
  for (let r = 0; r < R; r += 1) {
    const t = cases[debut + r];
    if (t === RESERVE) continue;
    const a = ancresVus(population, t, ancrage, eps);
    const occupants = occupation === null ? capacite[t] : occupation[t * R + r];
    sieges += occupants - eps - a;
    if (!dejaVisitee(cases, debut, r)) ancres += a;
  }
  return borne(population, p, eps, mobilesRencontrables(instance, population, p, eps), ancres, sieges);
}

// Lève RangeError quand une case de l'itinéraire n'est ni RESERVE ni un index
// de table. Un plan indexé passe par exigerPlanIndexe (configuration.js).
function exigerCases(itineraire, T) {
  for (let i = 0; i < itineraire.length; i += 1) {
    const t = itineraire[i];
    if (t !== RESERVE && !(Number.isInteger(t) && t >= 0 && t < T)) {
      throw new RangeError(`itinéraire, case ${i} : index de table ${decrire(t)} hors de −1..${T - 1}`);
    }
  }
}

/**
 * Plafond d'une personne sur un itinéraire (index de table par tour, −1 en
 * réserve), calculé sur les capacités :
 * min(C(p), Σ_{t∈D} a_t + min(n_p^C, Σ_{t∈D} m_t·v_t)), v_t = c_t − 1 − a_t,
 * a_t excluant p ; C(p) ses co-présents, n_p^C ses mobiles co-présents, soit
 * N − 1 et n_p sans absence.
 *
 * L'itinéraire n'est pas confronté aux réservations : la formule vaut pour
 * tout itinéraire, et le plafond a priori en prend le maximum sur les
 * itinéraires admissibles. Lève RangeError quand p n'est pas un index de
 * personne, ou que l'itinéraire n'a pas R cases, chacune −1 ou un index de
 * table.
 *
 * @param {import('./types.js').Instance} instance
 * @param {number} p  index de la personne
 * @param {ArrayLike<number>} itineraire
 * @returns {number}
 */
export function plafondItineraire(instance, p, itineraire) {
  const { N, T, R } = instance;
  if (!Number.isInteger(p) || p < 0 || p >= N) {
    throw new RangeError(`personne d'index ${String(p)} hors de 0..${N - 1}`);
  }
  if (itineraire.length !== R) {
    throw new RangeError(`itinéraire de ${itineraire.length} tours, ${R} attendus`);
  }
  exigerCases(itineraire, T);
  return plafondSurRangee(instance, tous(instance), p, itineraire, 0, null);
}

/**
 * L'occupation d'un plan (§ 5.4, B4), rangée t × R + r : occupants, o_{t,r},
 * les personnes assises à la table t au tour r ; affilies, α_{t,r}, celles
 * d'entre elles qui portent une organisation, compté seulement sous l'option
 * {affilies}, null sans elle. Un tour en réserve n'occupe aucune table. Des
 * Array, jamais un tableau typé.
 *
 * Lève ce que lève exigerPlanIndexe (configuration.js).
 *
 * @param {import('./types.js').Instance} instance
 * @param {ArrayLike<number>} tableDe  plan indexé, [p × R + r]
 * @param {{affilies?: boolean}} [options]
 * @returns {{occupants: number[], affilies: number[]|null}}
 */
export function occupations(instance, tableDe, { affilies = false } = {}) {
  exigerPlanIndexe(instance, tableDe);
  const { N, T, R, groupe } = instance;
  const occupants = new Array(T * R).fill(0);
  const assisAffilies = affilies ? new Array(T * R).fill(0) : null;
  for (let p = 0; p < N; p += 1) {
    const affilie = assisAffilies !== null && groupe[p] !== SANS_GROUPE;
    for (let r = 0; r < R; r += 1) {
      const t = tableDe[p * R + r];
      if (t === RESERVE) continue;
      occupants[t * R + r] += 1;
      if (affilie) assisAffilies[t * R + r] += 1;
    }
  }
  return { occupants, affilies: assisAffilies };
}

/**
 * Plafond réalisé de chacun, sur l'occupation : v_{t,r} = o_{t,r} − 1 − a_t,
 * somme sur les tours assis ; Σ a_t reste sur les tables distinctes ; le
 * premier terme est C(p), le terme des mobiles n_p^C. Un tour en réserve ou
 * d'absence n'entre pas dans le plafond de la personne, ni dans
 * l'occupation d'aucune table.
 *
 * Lève ce que lève exigerPlanIndexe (configuration.js).
 *
 * @param {import('./types.js').Instance} instance
 * @param {ArrayLike<number>} tableDe  plan indexé, [p × R + r]
 * @returns {number[]}
 */
export function plafondsRealises(instance, tableDe) {
  const { occupants } = occupations(instance, tableDe);
  const { N, R } = instance;
  const population = tous(instance);
  const plafonds = [];
  for (let p = 0; p < N; p += 1) {
    plafonds.push(plafondSurRangee(instance, population, p, tableDe, p * R, occupants));
  }
  return plafonds;
}

/**
 * Borne de diversité de chacun (§ 5.5, B5), sur l'occupation du plan :
 *
 *   A_max(p) = min(Φ_aff(p), G, (N_aff − g_p) + 1)   p affilié
 *   A_max(p) = min(Φ_aff(p), G)                      sinon
 *
 * Φ_aff(p), rendu en phiAffilies, est le plafond réalisé des affiliés :
 * min(N_aff − ε_p, Σ_{t∈D} a^aff_t + min(n^aff_p, Σ_{(t,r)∈I} v^aff_{t,r})),
 * v^aff_{t,r} = α_{t,r} − ε_p − a^aff_t, chaque terme compté sur les seuls
 * affiliés, p non compté. Il borne |F(p)|, les affiliés que p rencontre. G
 * compte les organisations des personnes présentes (instance.groupes) ;
 * N_aff, les présents affiliés ; g_p, l'effectif de l'organisation de p.
 *
 * Chaque organisation autre que celle de p compte au moins une personne :
 * N_aff − g_p ≥ G − 1, et le troisième terme ne descend jamais sous G. Il
 * s'écrit pour que le code se lise contre la formule du § 5.5.
 *
 * Deux Array dans l'ordre canonique. Lève ce que lève exigerPlanIndexe.
 *
 * @param {import('./types.js').Instance} instance
 * @param {ArrayLike<number>} tableDe  plan indexé, [p × R + r]
 * @returns {{phiAffilies: number[], aMax: number[]}}
 */
export function borneDiversite(instance, tableDe) {
  const { affilies } = occupations(instance, tableDe, { affilies: true });
  const { N, R, groupe, groupes } = instance;
  const G = groupes.length;
  const population = affiliesDe(instance);
  const effectifs = new Int32Array(G);
  for (let p = 0; p < N; p += 1) if (groupe[p] !== SANS_GROUPE) effectifs[groupe[p]] += 1;
  const phiAffilies = [];
  const aMax = [];
  for (let p = 0; p < N; p += 1) {
    const phi = plafondSurRangee(instance, population, p, tableDe, p * R, affilies);
    phiAffilies.push(phi);
    const g = groupe[p];
    aMax.push(g === SANS_GROUPE ? Math.min(phi, G) : Math.min(phi, G, population.effectif - effectifs[g] + 1));
  }
  return { phiAffilies, aMax };
}

// Les tours libres de p où il est présent : ni fixés, ni d'absence. Un tour
// d'absence vaut LIBRE dans fixe, la réservation y étant suspendue.
function toursLibresPresents({ R, fixe, present }, p) {
  let f = 0;
  for (let r = 0; r < R; r += 1) if (fixe[p * R + r] === LIBRE && present[p * R + r] === 1) f += 1;
  return f;
}

// Clé de signature de p : statut, table d'ancrage, multiensemble trié des
// tables fixées, nombre de tours libres présents. Le programme dynamique de
// maximiser ne dépend que d'elle : la formule ne lit ni l'ordre des tours ni
// l'identité de p, et les tables admissibles sont les mêmes pour tous. C(p)
// et n_p^C n'y entrent pas : chaque personne les applique à la lecture du
// programme, par borne, si bien que le nombre de programmes ne croît pas avec
// le nombre de motifs de présence.
function signature(instance, p) {
  const { R, fixe, statut } = instance;
  const fixees = [];
  for (let r = 0; r < R; r += 1) if (fixe[p * R + r] !== LIBRE) fixees.push(fixe[p * R + r]);
  fixees.sort((x, y) => x - y);
  return `${statut[p]}|${ancrageDe(instance, p)}|${fixees.join(',')}|${toursLibresPresents(instance, p)}`;
}

// Le programme dynamique d'une signature, calculé pour p, l'un de ses
// membres, et pour nPMax, le plus grand n_p^C de ses membres. Les tours fixés
// donnent F, ses tables distinctes D₀, ancres0 = Σ_{t∈D₀} a_t et sieges0 =
// Σ_{t∈F} v_t ; restent f tours libres présents. Un état (s, w) — s tours
// libres attribués, w = min(W, sièges ajoutés), W = min(max(0, nPMax −
// sieges0), f · vMax) — porte la plus grande somme d'ancrés ajoutée qui
// l'atteint, −1 s'il est inatteignable. Chaque table admissible, prise une
// fois, reçoit une multiplicité m de 0 à f − s : ses ancrés s'ajoutent si
// m > 0 et qu'elle n'est pas dans D₀, ses sièges m fois. Seuls les états à
// s = f concluent : rangee[w] en garde la somme d'ancrés, null sans tour
// libre présent ou sans table admissible, l'itinéraire étant alors imposé.
// Plafonner w à W ne perd rien pour aucun membre : borne sature les sièges
// en n_p^C ≤ nPMax, et f · vMax en borne la somme ; la plus grande somme
// d'ancrés suffit par état, la formule croissant avec elle.
function maximiser(instance, p, admissibles, nPMax) {
  const { T, R, fixe, capacite } = instance;
  const population = tous(instance);
  const ancrage = ancrageDe(instance, p);
  const vus = (t) => ancresVus(population, t, ancrage, 1);
  const sieges = (t) => capacite[t] - 1 - vus(t);
  const dansD0 = new Uint8Array(T);
  let ancres0 = 0;
  let sieges0 = 0;
  for (let r = 0; r < R; r += 1) {
    const t = fixe[p * R + r];
    if (t === LIBRE) continue;
    sieges0 += sieges(t);
    if (dansD0[t] === 0) {
      dansD0[t] = 1;
      ancres0 += vus(t);
    }
  }
  const f = toursLibresPresents(instance, p);
  // Sans tour libre présent, l'itinéraire est imposé ; sans table
  // admissible, les tours libres restent en réserve.
  if (f === 0 || admissibles.length === 0) return { ancres0, sieges0, rangee: null };

  // Les sièges ajoutés ne dépassent jamais f fois le plus grand v_t : au-delà
  // de cette valeur, w n'a pas de case à remplir.
  let vMax = 0;
  for (const t of admissibles) vMax = Math.max(vMax, sieges(t));
  const W = Math.min(Math.max(0, nPMax - sieges0), f * vMax);
  const largeur = W + 1;
  let meilleur = new Int32Array((f + 1) * largeur).fill(-1);
  meilleur[0] = 0;
  for (const t of admissibles) {
    const gain = dansD0[t] === 1 ? 0 : vus(t);
    const v = sieges(t);
    const suivant = meilleur.slice();
    for (let s = 0; s < f; s += 1) {
      for (let w = 0; w <= W; w += 1) {
        const atteint = meilleur[s * largeur + w];
        if (atteint < 0) continue;
        for (let m = 1; s + m <= f; m += 1) {
          const cible = (s + m) * largeur + Math.min(W, w + m * v);
          if (atteint + gain > suivant[cible]) suivant[cible] = atteint + gain;
        }
      }
    }
    meilleur = suivant;
  }
  return { ancres0, sieges0, rangee: meilleur.subarray(f * largeur, (f + 1) * largeur) };
}

// Plafond a priori de p lu sur le programme de sa signature, avec ses C(p)
// et n_p^C : le meilleur, sur les cases atteintes, de la formule appliquée à
// ancres0 plus la somme d'ancrés de la case, et à sieges0 plus w.
function lireProgramme(instance, population, p, { ancres0, sieges0, rangee }) {
  const nP = mobilesRencontrables(instance, population, p, 1);
  if (rangee === null) return borne(population, p, 1, nP, ancres0, sieges0);
  let plafond = -1;
  for (let w = 0; w < rangee.length; w += 1) {
    const ajout = rangee[w];
    if (ajout >= 0) plafond = Math.max(plafond, borne(population, p, 1, nP, ancres0 + ajout, sieges0 + w));
  }
  return plafond;
}

// Les plafonds a priori et les programmes qui les donnent, un par signature :
// un premier passage relève la signature de chacun et le plus grand n_p^C de
// chaque signature, le second calcule chaque programme une fois, au premier
// membre rencontré, et le lit pour chacun. Une lecture se garde par
// signature, C(p) et n_p^C : sans absence, ceux-ci sont les mêmes pour tous
// les membres d'une signature, et chacune ne se lit qu'une fois. Les Map ne
// servent qu'à retrouver une clé.
function plafondsEtProgrammes(instance) {
  const { N } = instance;
  const admissibles = tablesAdmissibles(instance);
  const population = tous(instance);
  const cles = [];
  const nPMaxDe = new Map();
  for (let p = 0; p < N; p += 1) {
    const cle = signature(instance, p);
    cles.push(cle);
    const nP = mobilesRencontrables(instance, population, p, 1);
    const connu = nPMaxDe.get(cle);
    if (connu === undefined || nP > connu) nPMaxDe.set(cle, nP);
  }
  const programmes = new Map();
  const lectures = new Map();
  const plafonds = [];
  for (let p = 0; p < N; p += 1) {
    const cle = cles[p];
    let programme = programmes.get(cle);
    if (programme === undefined) {
      programme = maximiser(instance, p, admissibles, nPMaxDe.get(cle));
      programmes.set(cle, programme);
    }
    const lecture = `${cle}|${population.autres[p]}|${population.mobilesVus[p]}`;
    let plafond = lectures.get(lecture);
    if (plafond === undefined) {
      plafond = lireProgramme(instance, population, p, programme);
      lectures.set(lecture, plafond);
    }
    plafonds.push(plafond);
  }
  return { plafonds, programmes: programmes.size };
}

/**
 * Plafond a priori de chacun, maximisé sur les itinéraires admissibles :
 * tours fixés imposés, tours d'absence en réserve, tours libres présents sur
 * toute table non entièrement ancrée. Exact, par programmation dynamique ;
 * un programme par signature (statut, ancrage, tables fixées, tours libres
 * présents), que chacun lit avec ses C(p) et n_p^C.
 *
 * @param {import('./types.js').Instance} instance
 * @returns {number[]}
 */
export function plafondsAPriori(instance) {
  return plafondsEtProgrammes(instance).plafonds;
}

/**
 * Le nombre de programmes dynamiques que plafondsAPriori calcule sur
 * l'instance : un par signature distincte. Il ne dépend pas du nombre de
 * motifs de présence ; les épreuves du coût le lisent.
 *
 * @param {import('./types.js').Instance} instance
 * @returns {number}
 */
export function programmesDuPlafond(instance) {
  return plafondsEtProgrammes(instance).programmes;
}

// Vrai quand C(A + f − 1, f), le nombre de multiensembles de f tables parmi
// A, dépasse limite. Le produit avance par C(A − 1 + i, i), entier et
// croissant en i : il s'arrête dès qu'il dépasse, avant d'excéder les
// entiers qu'un nombre représente exactement.
function multiensemblesAuDela(A, f, limite) {
  let compte = 1;
  for (let i = 1; i <= f; i += 1) {
    compte = (compte * (A - 1 + i)) / i;
    if (compte > limite) return true;
  }
  return false;
}

// Plafond a priori de p par énumération : chaque multiensemble de tables
// admissibles, de la taille du nombre de tours libres présents, se pose sur
// ces tours dans l'ordre, et plafondItineraire en donne la valeur ; un tour
// d'absence reste en réserve. La formule ne lisant pas l'ordre des tours, un
// multiensemble suffit pour chaque ensemble d'itinéraires qui ne diffèrent
// que par cet ordre.
function enumerer(instance, p, admissibles) {
  const { R, fixe, ids, present } = instance;
  const itineraire = Int32Array.from(fixe.subarray(p * R, (p + 1) * R));
  const libres = [];
  for (let r = 0; r < R; r += 1) if (itineraire[r] === LIBRE && present[p * R + r] === 1) libres.push(r);
  const f = libres.length;
  const A = admissibles.length;
  // Sans table admissible, les tours libres restent à −1, en réserve.
  if (f === 0 || A === 0) return plafondItineraire(instance, p, itineraire);
  if (multiensemblesAuDela(A, f, LIMITE_ENUMERATION)) {
    throw new ErreurConfiguration('ENUMERATION_TROP_GRANDE', {
      participant: ids[p],
      tablesAdmissibles: A,
      toursLibres: f,
      limite: LIMITE_ENUMERATION,
    });
  }
  // choix[i] : rang, dans admissibles, de la table du i-ème tour libre. Les
  // suites non décroissantes se suivent dans l'ordre lexicographique, de
  // (0, …, 0) à (A − 1, …, A − 1).
  const choix = new Int32Array(f);
  let plafond = -1;
  for (;;) {
    for (let i = 0; i < f; i += 1) itineraire[libres[i]] = admissibles[choix[i]];
    plafond = Math.max(plafond, plafondItineraire(instance, p, itineraire));
    let i = f - 1;
    while (i >= 0 && choix[i] === A - 1) i -= 1;
    if (i < 0) return plafond;
    choix[i] += 1;
    for (let j = i + 1; j < f; j += 1) choix[j] = choix[i];
  }
}

/**
 * Oracle : même résultat par énumération des multiensembles de tables des
 * tours libres. Lève ErreurConfiguration('ENUMERATION_TROP_GRANDE') au-delà de
 * 300 000 multiensembles pour une signature, avec pour détails le
 * participant, par identifiant, le premier dans l'ordre des index dont
 * l'énumération dépasse, le nombre de tables admissibles, celui de ses tours
 * libres, et la limite.
 *
 * L'énumération ne partage avec plafondsAPriori que la formule et la règle
 * d'admissibilité. Elle regroupe les personnes par rangée de tours fixés et
 * rangée de présence, plus fine que la signature : si la signature
 * confondait deux personnes de plafonds distincts, les deux fonctions
 * divergeraient sur l'une d'elles.
 *
 * @param {import('./types.js').Instance} instance
 * @returns {number[]}
 */
export function plafondsAPrioriParEnumeration(instance) {
  const { N, R, fixe, present } = instance;
  const admissibles = tablesAdmissibles(instance);
  const parRangee = new Map();
  const plafonds = [];
  for (let p = 0; p < N; p += 1) {
    const cle = `${fixe.subarray(p * R, (p + 1) * R).join(',')}|${present.subarray(p * R, (p + 1) * R).join('')}`;
    let plafond = parRangee.get(cle);
    if (plafond === undefined) {
      plafond = enumerer(instance, p, admissibles);
      parRangee.set(cle, plafond);
    }
    plafonds.push(plafond);
  }
  return plafonds;
}
