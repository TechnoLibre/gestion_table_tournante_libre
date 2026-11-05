// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Ce que les inclusions demandent à chaque personne (§ 4, § 5.4), lu sur
// ses seules lignes actives (configuration.js, relierInclusions) et calculé
// une fois par instance.
//
// Pour une personne p : k°(p), ses lignes actives ; Q(p), ses cibles
// personnes ; d(p), ses organisations incluses qui contiennent une cible de
// Q(p) ; b(p) = k°(p) − d(p), les individus qu'il lui faut rencontrer pour
// tout satisfaire, une personne n'ayant qu'une organisation ; K(p), son
// plafond a priori (plafond.js), le plus de personnes distinctes qu'un plan
// valide lui fait rencontrer. Ses inclusions atteignables valent
//
//   I(p) = min(k°(p), K(p) + min(K(p), d(p)))
//
// et majorent ses lignes satisfaites dans tout plan valide : parmi les M
// personnes qu'elle rencontre, |M| ≤ K(p), chacune satisfait sa ligne de
// personne et au plus une ligne d'organisation, et une cible de Q(p) ne
// touche qu'une organisation couverte, d'où au plus |M| + min(|M|, d(p)).
// Quand b(p) ≤ K(p), I(p) = k°(p) : toute la liste est atteignable. Quand
// b(p) > K(p), la liste dépasse ce que la personne peut rencontrer : elle est
// au-delà du plafond, et ses lignes ne font aucun avis.
//
// Un avis est une unité non satisfaite, et une unité est une rencontre
// demandée, que portent les lignes actives des personnes qui ne sont pas
// au-delà du plafond. Une ligne de personne demande la rencontre de sa
// paire ; une ligne d'organisation dont un seul membre peut partager une
// table avec la source (inclusionPossible) demande la même, car dans un plan
// qui honore les réservations ce membre est le seul qui la satisfasse. Les
// lignes qui demandent la même paire, quel que soit leur sens, font une
// seule unité, portée par la plus petite des sources qui comptent, et chez
// elle par sa ligne de personne quand elle en a une. Une ligne
// d'organisation que plusieurs membres peuvent satisfaire est sa propre
// unité.
//
// plafondsAPriori n'est lu que quand une ligne est active. Aucune fonction
// ne modifie l'instance.
import { SANS_GROUPE, inclusionPossible } from './configuration.js';
import { plafondsAPriori } from './plafond.js';

/**
 * @typedef {Object} CiblesDesInclusions
 * @property {Int32Array} actives       k°(p), lignes actives, ordre canonique
 * @property {Int32Array} besoin        b(p) = k°(p) − d(p)
 * @property {Int32Array} couvertes     d(p)
 * @property {Int32Array} plafond       K(p), le plafond a priori ; 0 partout
 *                                      sans ligne active
 * @property {Int32Array} atteignables  I(p)
 * @property {Uint8Array} auDela        1 quand b(p) > K(p)
 * @property {Int32Array} uniteLigne    rang, dans instance.inclusionCible, de
 *                                      la ligne qui porte chaque unité, par
 *                                      rang croissant
 * @property {Int32Array} uniteSource   index de la source de cette ligne
 * @property {Int32Array} unitePartenaire  index de la personne dont la
 *                                      rencontre satisfait l'unité, −1 pour
 *                                      une organisation que plusieurs membres
 *                                      satisfont
 * @property {Uint8Array} uniteReciproque  1 quand l'unité est une paire que
 *                                      les deux personnes demandent
 */

// Les cibles calculées, par instance ; une instance que plus rien ne retient
// quitte la table avec elles.
const memoire = new WeakMap();

// La personne dont la rencontre satisfait la ligne de rang i, de source p :
// sa cible pour une ligne de personne ; pour une organisation, son seul
// membre que p peut rencontrer, ou −1 quand il y en a plusieurs. Une ligne
// active en a un au moins. O(|g| · R · T) pour une organisation g.
function partenaire(instance, membres, p, i) {
  const q = instance.inclusionCible[i];
  if (q >= 0) return q;
  let seul = -1;
  for (const m of membres[-1 - q]) {
    if (!inclusionPossible(instance, p, m)) continue;
    if (seul >= 0) return -1;
    seul = m;
  }
  return seul;
}

// Les cibles, calculées à neuf (ciblesDesInclusions).
function calculer(instance, aPriori) {
  const { N, groupe, groupes, inclusionDebut, inclusionCible, inclusionsActives } = instance;
  const actives = new Int32Array(N);
  const besoin = new Int32Array(N);
  const couvertes = new Int32Array(N);
  const plafond = new Int32Array(N);
  const atteignables = new Int32Array(N);
  const auDela = new Uint8Array(N);
  if (inclusionsActives === 0) {
    const vide = new Int32Array(0);
    return {
      actives,
      besoin,
      couvertes,
      plafond,
      atteignables,
      auDela,
      uniteLigne: vide,
      uniteSource: vide,
      unitePartenaire: vide,
      uniteReciproque: new Uint8Array(0),
    };
  }
  const K = aPriori ?? plafondsAPriori(instance);
  // incluse[g] vaut p quand p inclut l'organisation g ; couverte[g] vaut p
  // quand une cible de p l'a déjà couverte : les marques, datées par
  // personne, n'ont pas à se remettre à zéro.
  const incluse = new Int32Array(groupes.length).fill(-1);
  const couverte = new Int32Array(groupes.length).fill(-1);
  for (let p = 0; p < N; p += 1) {
    const debut = inclusionDebut[p];
    const fin = inclusionDebut[p + 1];
    for (let i = debut; i < fin; i += 1) if (inclusionCible[i] < 0) incluse[-1 - inclusionCible[i]] = p;
    let d = 0;
    for (let i = debut; i < fin; i += 1) {
      const q = inclusionCible[i];
      if (q < 0) continue;
      const g = groupe[q];
      if (g === SANS_GROUPE || incluse[g] !== p || couverte[g] === p) continue;
      couverte[g] = p;
      d += 1;
    }
    actives[p] = fin - debut;
    couvertes[p] = d;
    besoin[p] = actives[p] - d;
    plafond[p] = K[p];
    atteignables[p] = Math.min(actives[p], K[p] + Math.min(K[p], d));
    auDela[p] = besoin[p] > K[p] ? 1 : 0;
  }
  // Le partenaire de chaque ligne et la paire qu'elle demande, min × N + max,
  // ou −1 ; puis, par paire, ses demandeurs : bit 1 pour la plus petite des
  // deux personnes, bit 2 pour l'autre, sources au-delà du plafond comprises.
  const membres = groupes.map(() => []);
  for (let p = 0; p < N; p += 1) if (groupe[p] !== SANS_GROUPE) membres[groupe[p]].push(p);
  const partenaireDe = new Int32Array(inclusionsActives);
  const paire = new Float64Array(inclusionsActives);
  const demandeurs = new Map();
  for (let p = 0; p < N; p += 1) {
    for (let i = inclusionDebut[p]; i < inclusionDebut[p + 1]; i += 1) {
      const q = partenaire(instance, membres, p, i);
      partenaireDe[i] = q;
      paire[i] = q < 0 ? -1 : Math.min(p, q) * N + Math.max(p, q);
      if (q >= 0) demandeurs.set(paire[i], (demandeurs.get(paire[i]) ?? 0) | (p < q ? 1 : 2));
    }
  }
  // porte[i] vaut 1 pour la ligne qui porte une unité. Une source réserve
  // les paires de ses personnes avant celles de ses organisations, qui les
  // précèdent pourtant dans inclusionCible.
  const porte = new Uint8Array(inclusionsActives);
  const reservee = new Set();
  const reserver = (i) => {
    if (paire[i] >= 0) {
      if (reservee.has(paire[i])) return;
      reservee.add(paire[i]);
    }
    porte[i] = 1;
  };
  for (let p = 0; p < N; p += 1) {
    if (auDela[p] === 1) continue;
    for (let i = inclusionDebut[p]; i < inclusionDebut[p + 1]; i += 1) if (inclusionCible[i] >= 0) reserver(i);
    for (let i = inclusionDebut[p]; i < inclusionDebut[p + 1]; i += 1) if (inclusionCible[i] < 0) reserver(i);
  }
  const lignes = [];
  const sources = [];
  const reciproques = [];
  for (let p = 0; p < N; p += 1) {
    for (let i = inclusionDebut[p]; i < inclusionDebut[p + 1]; i += 1) {
      if (porte[i] === 0) continue;
      lignes.push(i);
      sources.push(p);
      reciproques.push(paire[i] >= 0 && demandeurs.get(paire[i]) === 3 ? 1 : 0);
    }
  }
  return {
    actives,
    besoin,
    couvertes,
    plafond,
    atteignables,
    auDela,
    uniteLigne: Int32Array.from(lignes),
    uniteSource: Int32Array.from(sources),
    unitePartenaire: Int32Array.from(lignes, (i) => partenaireDe[i]),
    uniteReciproque: Uint8Array.from(reciproques),
  };
}

/**
 * Ce que les inclusions demandent à chacun (§ 5.4) : k°(p), d(p), b(p),
 * K(p), I(p), le régime de chacun, et les unités qui font les avis. Calculé
 * une fois par instance : un appel suivant rend le même objet, que
 * l'appelant lit sans le modifier. aPriori, quand l'appelant le tient déjà,
 * évite de recalculer le plafond a priori ; il doit être celui de
 * l'instance.
 *
 * @param {import('./types.js').Instance} instance
 * @param {ArrayLike<number>|null} [aPriori]  plafondsAPriori(instance)
 * @returns {CiblesDesInclusions}
 */
export function ciblesDesInclusions(instance, aPriori = null) {
  let cibles = memoire.get(instance);
  if (cibles === undefined) {
    cibles = calculer(instance, aPriori);
    memoire.set(instance, cibles);
  }
  return cibles;
}
