// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le modèle exact d'un tour (§ 5.6) : les données agrégées de chaque tour,
// lues sur l'instance normalisée, et le texte LP (format CPLEX) que le
// solveur du travailleur résout (solveur_travailleur.js). Pur : aucun
// paquet, aucune plateforme ; il ne modifie pas l'instance.
//
// Les contraintes dures d'un plan — capacité, présence, réservations,
// ancrés — portent chacune sur un seul tour, et conflits comme collisions
// cumulées sont des sommes par tour : chaque tour se résout seul, et la
// somme des minimums des tours est le minimum des collisions cumulées des
// plans sans conflit d'organisation, puisque les optimums des tours se
// recollent en un plan.
//
// Une unité est une organisation présente au tour, ou une personne sans
// organisation qui porte un conflit (uniteConflit ≥ 0), seule de son unité.
// Les autres présents sans organisation ne portent ni collision ni conflit :
// ils forment le remplissage, sans variable, et occupent des sièges que le
// modèle laisse libres ; Σ_t s_t − Σ_u m_u ≥ remplissage suffit à les
// asseoir. Pour l'unité u à la table t, a_ut compte ses réservés, m_u ses
// libres, et s_t les sièges que les réservations de tout le tour laissent
// libres.
//
// Variables, toutes nommées par indices seuls — y3_7, z3_7, c3_7, et r12
// pour une ligne —, jamais d'après un libellé : un nom d'organisation ne peut
// ni devenir un mot-clé du format (inf, free, bin, st), ni commencer par un
// chiffre.
//   y_ut  entier, libres de u assis à t, borné par min(m_u, s_t), et absent
//         (borne 0) à une table où siège un réservé d'une unité en conflit ;
//   z_ut  binaire, u présente à t, seulement pour une unité en conflit sans
//         réservé à t : une unité réservée à t y est présente d'office ;
//   c_ut  continue, collisions de l'organisation u à t (mode AC seulement).
// Contraintes : l'affectation Σ_t y_ut = m_u ; la capacité Σ_u y_ut ≤ s_t,
// écrite seulement quand la somme des bornes la dépasse ; le lien
// y_ut ≤ borne·z_ut ; une ligne Σ z_ut ≤ 1 par clique d'une couverture
// gloutonne du graphe des conflits (cliquesCouvrantes), qui tient chaque
// paire en conflit à l'écart ; les collisions par les cordes de C(x, 2),
// x = a + y : c ≥ k·x − k(k + 1)/2 pour k de max(1, a) à a + borne − 1, et
// c ≥ C(a, 2). Les cordes sont exactes aux x entiers : c'est la meilleure
// enveloppe convexe, et le minimum de Σ c est le minimum des collisions.
//
// Pour une unité qui a un z_ut, la corde s'écrit en perspective,
// c ≥ k·y − k(k + 1)/2 · z (a vaut 0 là) : valide, puisque z = 0 force
// y = 0, et seule capable de voir le conflit dans la relaxation continue.
// Sans elle, la relaxation met z à ½ des deux côtés d'un conflit, la corde
// ordinaire ne coûte plus rien, et la preuve d'optimalité demande des
// dizaines de secondes là où la perspective la rend en une ou deux.
// Aucune brisure de symétrie entre tables interchangeables : elle reste
// valide, mais rend la résolution toujours plus lente.
//
// Le texte est déterministe : mêmes données, même texte à l'octet près. Il
// sert de clé au cache des résolutions du travailleur ; deux tours identiques
// (sans absence ni réservation de tour qui les distingue) ont le même texte.
// La constante — les collisions des réservés d'une organisation qui n'a
// aucune variable à une table — reste hors du texte : deux tours de même
// texte peuvent avoir des constantes différentes.
import { LIBRE, SANS_GROUPE } from '../moteur/configuration.js';

// Paires que forment x personnes : C(x, 2).
const paires = (x) => (x * (x - 1)) / 2;

// Termes d'une somme ou noms d'une liste par ligne du texte : le format
// admet des lignes longues, une ligne courte se relit.
const TERMES_PAR_LIGNE = 24;

/**
 * @typedef {Object} UniteTour
 * @property {number} groupe  index de l'organisation dans instance.groupes,
 *           −1 pour une personne sans organisation en conflit
 * @property {number} m       ses présents libres au tour
 * @property {number[]} a     ses réservés à chaque table, T cases
 */

/**
 * @typedef {Object} DonneesTour
 * @property {number} r          index du tour, de 0 à R − 1
 * @property {number} T          nombre de tables
 * @property {number[]} s        sièges libres de chaque table après les
 *           réservations du tour, T cases
 * @property {UniteTour[]} unites  dans l'ordre de leur premier présent
 * @property {number} remplissage  présents libres sans organisation ni conflit
 * @property {Array<[number, number]>} conflits  paires d'unités en conflit,
 *           [i, j] avec i < j, par i puis j croissants
 * @property {null|'reserves'|'places'} infaisable  'places' quand le tour
 *           manque de sièges pour ses présents (placesManquantesParTour > 0) ;
 *           sinon 'reserves' quand deux unités en conflit ont des réservés à
 *           une même table ; null sinon
 */

// Les données du tour r.
function donneesDuTour({ N, T, R, groupe, uniteConflit, unitesConflit, conflitEntre, present, fixe, siegesLibres }, r) {
  // indexDe : clé de l'unité (groupe ou personne) → son index ; rangs[u] :
  // le rang de son unité de conflit, −1 sans conflit.
  const indexDe = new Map();
  const unites = [];
  const rangs = [];
  let remplissage = 0;
  for (let p = 0; p < N; p += 1) {
    if (present[p * R + r] === 0) continue;
    const t = fixe[p * R + r];
    let cle;
    if (groupe[p] !== SANS_GROUPE) cle = `g${groupe[p]}`;
    else if (uniteConflit[p] >= 0) cle = `p${p}`;
    else {
      if (t === LIBRE) remplissage += 1;
      continue;
    }
    if (!indexDe.has(cle)) {
      indexDe.set(cle, unites.length);
      unites.push({ groupe: groupe[p], m: 0, a: new Array(T).fill(0) });
      rangs.push(uniteConflit[p]);
    }
    const unite = unites[indexDe.get(cle)];
    if (t === LIBRE) unite.m += 1;
    else unite.a[t] += 1;
  }
  const s = Array.from({ length: T }, (_, t) => siegesLibres[t * R + r]);
  const conflits = [];
  for (let i = 0; i < unites.length; i += 1) {
    for (let j = i + 1; j < unites.length; j += 1) {
      if (rangs[i] >= 0 && rangs[j] >= 0 && conflitEntre[rangs[i] * unitesConflit + rangs[j]] === 1) conflits.push([i, j]);
    }
  }
  const libres = s.reduce((somme, sieges) => somme + sieges, 0) - unites.reduce((somme, { m }) => somme + m, 0);
  let infaisable = null;
  if (libres < remplissage) infaisable = 'places';
  else if (conflits.some(([i, j]) => unites[i].a.some((reserves, t) => reserves > 0 && unites[j].a[t] > 0))) infaisable = 'reserves';
  return { r, T, s, unites, remplissage, conflits, infaisable };
}

/**
 * Les données agrégées de chaque tour de l'instance normalisée (§ 5.6), une
 * par tour, dans l'ordre des tours. Ne modifie pas l'instance.
 *
 * @param {import('../moteur/types.js').Instance} instance
 * @returns {DonneesTour[]}
 */
export function donneesDesTours(instance) {
  return Array.from({ length: instance.R }, (_, r) => donneesDuTour(instance, r));
}

/**
 * Une couverture du graphe des conflits par cliques, gloutonne : chaque
 * paire que nulle clique ne couvre encore en ouvre une, étendue par les
 * voisins communs de ses deux membres, du plus haut degré au plus bas, à
 * degré égal par index croissant. Chaque clique se rend par index
 * croissants, dans l'ordre de leur ouverture ; chaque paire en conflit est
 * dans l'une d'elles au moins.
 *
 * @param {number} U  nombre d'unités
 * @param {Array<[number, number]>} conflits  paires [i, j], i < j
 * @returns {number[][]}
 */
export function cliquesCouvrantes(U, conflits) {
  const voisins = Array.from({ length: U }, () => new Set());
  for (const [i, j] of conflits) {
    voisins[i].add(j);
    voisins[j].add(i);
  }
  const couverte = new Set();
  const cliques = [];
  for (const [i, j] of conflits) {
    if (couverte.has(i * U + j)) continue;
    const clique = [i, j];
    const communs = [...voisins[i]]
      .filter((v) => v !== j && voisins[j].has(v))
      .sort((v, w) => voisins[w].size - voisins[v].size || v - w);
    for (const v of communs) if (clique.every((w) => voisins[v].has(w))) clique.push(v);
    clique.sort((v, w) => v - w);
    for (const v of clique) for (const w of clique) if (v < w) couverte.add(v * U + w);
    cliques.push(clique);
  }
  return cliques;
}

// Une somme de termes [coefficient, nom], écrite « c0_1 - 2 y0_1 + 3 z0_1 »
// — le coefficient 1 se tait —, coupée toutes les TERMES_PAR_LIGNE termes.
function somme(termes) {
  return termes
    .map(([coefficient, nom], rang) => {
      const valeur = Math.abs(coefficient) === 1 ? nom : `${Math.abs(coefficient)} ${nom}`;
      const signe = coefficient < 0 ? '-' : '+';
      const coupure = rang > 0 && rang % TERMES_PAR_LIGNE === 0 ? '\n ' : ' ';
      if (rang === 0) return coefficient < 0 ? `-${valeur}` : valeur;
      return `${coupure}${signe} ${valeur}`;
    })
    .join('');
}

// Une liste de noms, TERMES_PAR_LIGNE par ligne, chaque ligne ouverte par un
// blanc.
function listeDeNoms(noms) {
  const lignes = [];
  for (let debut = 0; debut < noms.length; debut += TERMES_PAR_LIGNE) lignes.push(` ${noms.slice(debut, debut + TERMES_PAR_LIGNE).join(' ')}`);
  return lignes;
}

/**
 * Le texte LP du tour (§ 5.6), selon la formulation de l'en-tête du module.
 * En mode 'AC', l'objectif est le minimum des collisions du tour parmi ses
 * placements sans conflit d'organisation : ce minimum vaut l'objectif de
 * l'optimum plus constante. En mode 'A', le même domaine, sans variable c,
 * sous un objectif nul : seule la faisabilité compte, et constante vaut 0.
 * Les données d'un tour dont infaisable n'est pas null ne se donnent pas.
 *
 * @param {DonneesTour} donnees
 * @param {{mode?: 'A'|'AC'}} [options]
 * @returns {{lp: string|null, constante: number}|{infaisable: 'affectation'}}
 *   lp null quand aucune variable n'existe : la constante est alors la
 *   réponse ; infaisable 'affectation' quand une unité qui a des libres n'a
 *   aucune table possible
 */
export function lpTour({ T, s, unites, conflits }, { mode = 'AC' } = {}) {
  const U = unites.length;
  const enConflit = new Array(U).fill(false);
  for (const [i, j] of conflits) {
    enConflit[i] = true;
    enConflit[j] = true;
  }
  // borne[u][t] : la borne de y_ut, 0 là où un réservé d'une unité en
  // conflit siège.
  const borne = unites.map(({ m }) => s.map((sieges) => Math.min(m, sieges)));
  for (const [i, j] of conflits) {
    for (let t = 0; t < T; t += 1) {
      if (unites[i].a[t] > 0) borne[j][t] = 0;
      if (unites[j].a[t] > 0) borne[i][t] = 0;
    }
  }
  const aUnZ = (u, t) => enConflit[u] && unites[u].a[t] === 0 && borne[u][t] > 0;
  const lignes = [];
  const objectif = [];
  const bornes = [];
  const entieres = [];
  const binaires = [];
  let constante = 0;
  const ligne = (termes, sens, droite) => lignes.push(`${somme(termes)} ${sens} ${droite}`);

  for (let u = 0; u < U; u += 1) {
    for (let t = 0; t < T; t += 1) {
      const a = unites[u].a[t];
      const b = borne[u][t];
      const y = `y${u}_${t}`;
      const z = `z${u}_${t}`;
      const c = `c${u}_${t}`;
      if (b > 0) {
        entieres.push(y);
        bornes.push(`0 <= ${y} <= ${b}`);
      }
      if (aUnZ(u, t)) {
        binaires.push(z);
        ligne([[1, y], [-b, z]], '<=', 0);
      }
      if (mode !== 'AC' || unites[u].groupe === SANS_GROUPE) continue;
      if (b === 0 || a + b < 2) {
        constante += paires(a);
        continue;
      }
      objectif.push([1, c]);
      bornes.push(`${c} >= ${paires(a)}`);
      for (let k = Math.max(1, a); k < a + b; k += 1) {
        if (aUnZ(u, t)) ligne([[1, c], [-k, y], [paires(k + 1), z]], '>=', 0);
        else ligne([[1, c], [-k, y]], '>=', k * a - paires(k + 1));
      }
    }
  }
  for (let u = 0; u < U; u += 1) {
    if (unites[u].m === 0) continue;
    const termes = [];
    for (let t = 0; t < T; t += 1) if (borne[u][t] > 0) termes.push([1, `y${u}_${t}`]);
    if (termes.length === 0) return { infaisable: 'affectation' };
    ligne(termes, '=', unites[u].m);
  }
  const cliques = cliquesCouvrantes(U, conflits);
  for (let t = 0; t < T; t += 1) {
    const termes = [];
    let bornesDeLaTable = 0;
    for (let u = 0; u < U; u += 1) {
      if (borne[u][t] === 0) continue;
      termes.push([1, `y${u}_${t}`]);
      bornesDeLaTable += borne[u][t];
    }
    if (bornesDeLaTable > s[t]) ligne(termes, '<=', s[t]);
    for (const clique of cliques) {
      const ici = clique.filter((u) => aUnZ(u, t));
      if (ici.length >= 2) ligne(ici.map((u) => [1, `z${u}_${t}`]), '<=', 1);
    }
  }
  if (entieres.length + binaires.length === 0) return { lp: null, constante };
  // Sans variable c, l'objectif nul nomme une variable, que le format exige.
  const lp = [
    'Minimize',
    ` obj: ${objectif.length > 0 ? somme(objectif) : `0 ${entieres[0] ?? binaires[0]}`}`,
    'Subject To',
    ...lignes.map((texte, rang) => ` r${rang}: ${texte}`),
    'Bounds',
    ...bornes.map((texte) => ` ${texte}`),
    ...(entieres.length > 0 ? ['General', ...listeDeNoms(entieres)] : []),
    ...(binaires.length > 0 ? ['Binary', ...listeDeNoms(binaires)] : []),
    'End',
    '',
  ].join('\n');
  return { lp, constante };
}
