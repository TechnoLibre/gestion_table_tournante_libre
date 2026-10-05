// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Plafonds de rencontres (§ 5.5). Le plafond d'une personne p sur un
// itinéraire — la table qu'elle occupe à chaque tour — vaut
//
//   min(N − 1, Σ_{t∈D} a_t + min(n_p, S))
//
// D est l'ensemble des tables distinctes visitées ; a_t, les ancrés de la
// table t, p non compté ; n_p = n − 1 pour un mobile ou un partiellement
// fixé, n pour un ancré ; S, les sièges qui changent d'occupant, sommés sur
// les tours assis. Les ancrés d'une table visitée comptent une fois, quel
// que soit le nombre de tours passés là ; les sièges se renouvellent à chaque
// tour, sans livrer plus de personnes qu'il n'existe de mobiles. Un tour en
// réserve n'entre ni dans D ni dans S.
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
// Un itinéraire admissible impose les tours fixés par les réservations et
// place chaque tour libre à une table non entièrement ancrée : les ancrés
// d'une telle table occupent chacun de ses sièges à chaque tour. Quand
// aucune table ne l'est, les tours libres restent en réserve.
//
// Le plafond a priori majore le plafond réalisé de tout plan valide. Dans un
// tel plan, l'occupation ne dépasse pas la capacité : le plafond réalisé de p
// ne dépasse pas le plafond de son itinéraire. Cet itinéraire tient ses tours
// fixés et place ses tours libres à des tables admissibles, ou en réserve ;
// asseoir p à une table admissible n'ôte rien au plafond, puisque
// a_t ≥ 0 et c_t − 1 − a_t ≥ 0.
//
// Une personne se désigne par son index dans l'instance, une table par son
// index ; un tableau rendu suit l'ordre de instance.ids. Aucune fonction ne
// modifie l'instance.
import { ErreurConfiguration } from './erreurs.js';

// Statut d'un ancré dans instance.statut (§ 4.2).
const ANCRE = 2;
// Case de instance.fixe sans table imposée, et case d'un itinéraire ou d'un
// plan indexé en réserve : la même valeur, si bien qu'une rangée de fixe se
// lit comme l'itinéraire qui laisse en réserve chaque tour libre.
const LIBRE = -1;
const RESERVE = -1;
// Nombre de multiensembles au-delà duquel l'énumération refuse une
// signature.
const LIMITE_ENUMERATION = 300_000;

// La formule du § 5.5. ancres : Σ a_t sur les tables distinctes ; sieges :
// les sièges qui changent d'occupant ; nP : n_p.
function borne(instance, nP, ancres, sieges) {
  return Math.min(instance.N - 1, ancres + Math.min(nP, sieges));
}

// n_p : les mobiles — partiellement fixés compris — que p peut rencontrer,
// p excepté quand il en est un.
const mobilesRencontrables = (instance, p) =>
  instance.statut[p] === ANCRE ? instance.n : instance.n - 1;

// Table d'ancrage de p, −1 s'il n'est pas ancré.
const ancrageDe = (instance, p) =>
  instance.statut[p] === ANCRE ? instance.fixe[p * instance.R] : -1;

// a_t vu de p : les ancrés de la table t, p non compté.
const ancresVus = (instance, t, ancrage) => instance.ancresParTable[t] - (t === ancrage ? 1 : 0);

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
// tour. occupation porte o_{t,r} en [t × R + r] et fait la base du plafond
// réalisé ; null fait celle des capacités.
function plafondSurRangee(instance, p, cases, debut, occupation) {
  const { R, capacite } = instance;
  const ancrage = ancrageDe(instance, p);
  let ancres = 0;
  let sieges = 0;
  for (let r = 0; r < R; r += 1) {
    const t = cases[debut + r];
    if (t === RESERVE) continue;
    const a = ancresVus(instance, t, ancrage);
    const occupants = occupation === null ? capacite[t] : occupation[t * R + r];
    sieges += occupants - 1 - a;
    if (!dejaVisitee(cases, debut, r)) ancres += a;
  }
  return borne(instance, mobilesRencontrables(instance, p), ancres, sieges);
}

// Lève RangeError quand une case de cases n'est ni −1 ni un index de table.
function exigerCases(cases, T, quoi) {
  for (let i = 0; i < cases.length; i += 1) {
    const t = cases[i];
    if (!Number.isInteger(t) || t < RESERVE || t >= T) {
      throw new RangeError(`${quoi}, case ${i} : index de table ${String(t)} hors de −1..${T - 1}`);
    }
  }
}

/**
 * Plafond d'une personne sur un itinéraire (index de table par tour, −1 en
 * réserve), calculé sur les capacités :
 * min(N − 1, Σ_{t∈D} a_t + min(n_p, Σ_{t∈D} m_t·v_t)), v_t = c_t − 1 − a_t,
 * a_t excluant p ; n_p = n − 1 pour un mobile ou un partiel, n pour un ancré.
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
  exigerCases(itineraire, T, 'itinéraire');
  return plafondSurRangee(instance, p, itineraire, 0, null);
}

/**
 * Plafond réalisé de chacun, sur l'occupation : v_{t,r} = o_{t,r} − 1 − a_t,
 * somme sur les tours assis ; Σ a_t reste sur les tables distinctes. Un tour
 * en réserve n'entre pas dans le plafond de la personne, ni dans
 * l'occupation d'aucune table.
 *
 * Lève RangeError quand tableDe n'a pas N × R cases, ou qu'une case n'est ni
 * −1 ni un index de table.
 *
 * @param {import('./types.js').Instance} instance
 * @param {ArrayLike<number>} tableDe  plan indexé, [p × R + r]
 * @returns {number[]}
 */
export function plafondsRealises(instance, tableDe) {
  const { N, T, R } = instance;
  if (tableDe.length !== N * R) {
    throw new RangeError(`plan indexé de ${tableDe.length} cases, N × R = ${N * R} attendues`);
  }
  exigerCases(tableDe, T, 'plan indexé');
  const occupation = new Int32Array(T * R);
  for (let p = 0; p < N; p += 1) {
    for (let r = 0; r < R; r += 1) {
      const t = tableDe[p * R + r];
      if (t !== RESERVE) occupation[t * R + r] += 1;
    }
  }
  const plafonds = [];
  for (let p = 0; p < N; p += 1) {
    plafonds.push(plafondSurRangee(instance, p, tableDe, p * R, occupation));
  }
  return plafonds;
}

// Clé de signature de p : statut, table d'ancrage, multiensemble trié des
// tables fixées. Le plafond a priori ne dépend que d'elle : la formule ne lit
// ni l'ordre des tours ni l'identité de p, et les tables admissibles sont les
// mêmes pour tous.
function signature(instance, p) {
  const { R, fixe, statut } = instance;
  const fixees = [];
  for (let r = 0; r < R; r += 1) if (fixe[p * R + r] !== LIBRE) fixees.push(fixe[p * R + r]);
  fixees.sort((x, y) => x - y);
  return `${statut[p]}|${ancrageDe(instance, p)}|${fixees.join(',')}`;
}

// Plafond a priori de p, par programmation dynamique. Les tours fixés donnent
// F, ses tables distinctes D₀, ancres0 = Σ_{t∈D₀} a_t et sieges0 =
// Σ_{t∈F} v_t ; restent f tours libres. Un état (s, w) — s tours libres
// attribués, w = min(cap, sièges ajoutés), cap = max(0, n_p − sieges0) —
// porte la plus grande somme d'ancrés ajoutée qui l'atteint, −1 s'il est
// inatteignable. Chaque table admissible, prise une fois, reçoit une
// multiplicité m de 0 à f − s : ses ancrés s'ajoutent si m > 0 et qu'elle
// n'est pas dans D₀, ses sièges m fois. Seuls les états à s = f concluent.
// Plafonner w à cap ne perd rien, la formule bornant les sièges à n_p ; et
// la plus grande somme d'ancrés suffit par état, la formule croissant avec
// elle.
function maximiser(instance, p, admissibles) {
  const { T, R, fixe, capacite } = instance;
  const ancrage = ancrageDe(instance, p);
  const nP = mobilesRencontrables(instance, p);
  const sieges = (t) => capacite[t] - 1 - ancresVus(instance, t, ancrage);
  const dansD0 = new Uint8Array(T);
  let ancres0 = 0;
  let sieges0 = 0;
  let f = 0;
  for (let r = 0; r < R; r += 1) {
    const t = fixe[p * R + r];
    if (t === LIBRE) {
      f += 1;
      continue;
    }
    sieges0 += sieges(t);
    if (dansD0[t] === 0) {
      dansD0[t] = 1;
      ancres0 += ancresVus(instance, t, ancrage);
    }
  }
  // Sans tour libre, l'itinéraire est imposé ; sans table admissible, les
  // tours libres restent en réserve.
  if (f === 0 || admissibles.length === 0) return borne(instance, nP, ancres0, sieges0);

  // Les sièges ajoutés ne dépassent jamais f fois le plus grand v_t : au-delà
  // de cette valeur, w n'a pas de case à remplir.
  let vMax = 0;
  for (const t of admissibles) vMax = Math.max(vMax, sieges(t));
  const W = Math.min(Math.max(0, nP - sieges0), f * vMax);
  const largeur = W + 1;
  let meilleur = new Int32Array((f + 1) * largeur).fill(-1);
  meilleur[0] = 0;
  for (const t of admissibles) {
    const gain = dansD0[t] === 1 ? 0 : ancresVus(instance, t, ancrage);
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
  let plafond = -1;
  for (let w = 0; w <= W; w += 1) {
    const ajout = meilleur[f * largeur + w];
    if (ajout >= 0) plafond = Math.max(plafond, borne(instance, nP, ancres0 + ajout, sieges0 + w));
  }
  return plafond;
}

/**
 * Plafond a priori de chacun, maximisé sur les itinéraires admissibles :
 * tours fixés imposés, tours libres sur toute table non entièrement ancrée.
 * Exact, par programmation dynamique ; mémoïsé par signature.
 *
 * @param {import('./types.js').Instance} instance
 * @returns {number[]}
 */
export function plafondsAPriori(instance) {
  const admissibles = tablesAdmissibles(instance);
  const parSignature = new Map();
  const plafonds = [];
  for (let p = 0; p < instance.N; p += 1) {
    const cle = signature(instance, p);
    let plafond = parSignature.get(cle);
    if (plafond === undefined) {
      plafond = maximiser(instance, p, admissibles);
      parSignature.set(cle, plafond);
    }
    plafonds.push(plafond);
  }
  return plafonds;
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
// admissibles, de la taille du nombre de tours libres, se pose sur ces tours
// dans l'ordre, et plafondItineraire en donne la valeur. La formule ne lisant
// pas l'ordre des tours, un multiensemble suffit pour chaque ensemble
// d'itinéraires qui ne diffèrent que par cet ordre.
function enumerer(instance, p, admissibles) {
  const { R, fixe, ids } = instance;
  const itineraire = Int32Array.from(fixe.subarray(p * R, (p + 1) * R));
  const libres = [];
  for (let r = 0; r < R; r += 1) if (itineraire[r] === LIBRE) libres.push(r);
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
 * d'admissibilité. Elle regroupe les personnes par rangée de tours fixés,
 * plus fine que la signature : si la signature confondait deux personnes de
 * plafonds distincts, les deux fonctions divergeraient sur l'une d'elles.
 *
 * @param {import('./types.js').Instance} instance
 * @returns {number[]}
 */
export function plafondsAPrioriParEnumeration(instance) {
  const { N, R, fixe } = instance;
  const admissibles = tablesAdmissibles(instance);
  const parRangee = new Map();
  const plafonds = [];
  for (let p = 0; p < N; p += 1) {
    const cle = fixe.subarray(p * R, (p + 1) * R).join(',');
    let plafond = parRangee.get(cle);
    if (plafond === undefined) {
      plafond = enumerer(instance, p, admissibles);
      parRangee.set(cle, plafond);
    }
    plafonds.push(plafond);
  }
  return plafonds;
}
