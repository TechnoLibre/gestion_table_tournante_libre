// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La diversité par animateur (§ 4.5, § 5.4, § 12.13) : pour chaque
// animateur, les personnes, appartenances et étiquettes distinctes qu'il
// rencontre en animant, sur la soirée — l'union de ses tours animés — et à
// chacun de ses tours animés. Ces mesures décrivent un plan et ne classent
// rien : ni la recherche ni le classement ne les lisent.
//
// L'animateur f anime au tour r à la table que sa réservation lui fixe
// (instance.animes). Une personne q compte pour f à ce tour quand f et q y
// sont assis tous deux, que q n'est pas f, et que q peut occuper cette table
// à ce tour : sa table fixée quand une réservation le fixe, sinon une table
// qui garde un siège libre. C'est la relation que lisent les animateurs
// rencontrés de parcourirTours (indicateurs.js) : la somme, sur les
// animateurs, des personnes rencontrées en animant égale celle, sur les
// personnes, des animateurs rencontrés. Un animateur qu'un plan ajusté
// assied ailleurs qu'à sa table à un tour qu'il anime n'y rencontre
// personne ; le tour reste écrit, à comptes nuls.
//
// Une appartenance compte une fois, quels que soient ses affiliés ; une
// étiquette, une fois, quels que soient ses porteurs. Les comptes d'un tour
// se lisent au même passage que ceux de la soirée : chaque table animée se
// parcourt une fois par animateur qui l'anime.
import { LIBRE, RESERVE, SANS_GROUPE, exigerPlanIndexe } from './configuration.js';

/**
 * @typedef {Object} DiversiteTour
 * @property {number} tour          index du tour, à partir de 0
 * @property {number} t             index de la table animée
 * @property {number} personnes     U_{f,r}
 * @property {number} appartenances A_{f,r}
 * @property {number|null} etiquettes  E_{f,r} ; null sans étiquette portée
 *
 * @typedef {Object} DiversiteLigne
 * @property {number} p             index canonique de l'animateur
 * @property {number} toursAnimes   T_f
 * @property {number} personnes     U_f
 * @property {number} appartenances A_f
 * @property {number|null} etiquettes  E_f ; null sans étiquette portée
 * @property {DiversiteTour[]} parTour  un par tour animé, tours croissants
 *
 * @typedef {{moins: number, plus: number, auMinimum: number}} TroisNombres
 *   la plus petite valeur, la plus grande, et les animateurs à la plus petite
 */

/**
 * La diversité par animateur d'un plan indexé (§ 12.13, D38).
 *
 * colonnes.appartenances est faux quand les présents portent au plus une
 * appartenance ; colonnes.etiquettes, quand aucun présent ne porte
 * d'étiquette, et chaque compte d'étiquettes vaut alors null. Les lignes vont
 * du moins varié au plus varié, sur la soirée seule : appartenances
 * croissantes, puis étiquettes (null compté 0), puis personnes, puis l'index ;
 * sans la colonne des appartenances, ce compte, qu'aucune colonne ne montre,
 * ne départage pas : étiquettes, puis personnes, puis l'index. equite porte,
 * pour chaque colonne présente, ses trois nombres sur la soirée ; null pour
 * une colonne absente ou sans animateur. Aucun animateur : lignes vide.
 *
 * Ne rend que des listes et des objets simples ; ne modifie ni l'instance ni
 * le plan ; lève ce que lève exigerPlanIndexe.
 *
 * @param {import('./types.js').Instance} instance
 * @param {ArrayLike<number>} tableDe
 * @returns {{colonnes: {appartenances: boolean, etiquettes: boolean},
 *            lignes: DiversiteLigne[],
 *            equite: {appartenances: TroisNombres|null, etiquettes: TroisNombres|null}}}
 */
export function diversiteAnimateurs(instance, tableDe) {
  exigerPlanIndexe(instance, tableDe);
  const { N, T, R, fixe, siegesLibres, groupe, groupes, A, animateurs, debutAnimes, animes } = instance;
  const { debutEtiquettes, etiquettes, libellesEtiquettes } = instance;
  const colonnes = { appartenances: groupes.length > 1, etiquettes: libellesEtiquettes.length > 0 };

  // Les assis de chaque table à chaque tour, ligne t × R + r de debutAssis à
  // la suivante, par index croissants.
  const debutAssis = new Int32Array(T * R + 1);
  for (let i = 0; i < N * R; i += 1) {
    if (tableDe[i] !== RESERVE) debutAssis[tableDe[i] * R + (i % R) + 1] += 1;
  }
  for (let ligne = 0; ligne < T * R; ligne += 1) debutAssis[ligne + 1] += debutAssis[ligne];
  const assis = new Int32Array(debutAssis[T * R]);
  const rempli = debutAssis.slice(0, T * R);
  for (let i = 0; i < N * R; i += 1) {
    if (tableDe[i] === RESERVE) continue;
    const ligne = tableDe[i] * R + (i % R);
    assis[rempli[ligne]] = Math.floor(i / R);
    rempli[ligne] += 1;
  }

  // Les tours animés de chaque animateur, par rang : les tours parcourus
  // dans l'ordre, chacun table par table, les rend croissants.
  const lignesAnimees = Array.from({ length: A }, () => []);
  for (let r = 0; r < R; r += 1) {
    for (let t = 0; t < T; t += 1) {
      const ligne = t * R + r;
      for (let k = debutAnimes[ligne]; k < debutAnimes[ligne + 1]; k += 1) lignesAnimees[animes[k]].push(ligne);
    }
  }

  // Marques datées : une personne, un groupe ou une étiquette marqués du rang
  // de l'animateur sont déjà comptés pour sa soirée ; marqués du jeton du
  // tour en cours, pour ce tour. Aucune remise à zéro.
  const personneVue = new Int32Array(N).fill(-1);
  const groupeVu = new Int32Array(groupes.length).fill(-1);
  const groupeVuAuTour = new Int32Array(groupes.length).fill(-1);
  const etiquetteVue = new Int32Array(libellesEtiquettes.length).fill(-1);
  const etiquetteVueAuTour = new Int32Array(libellesEtiquettes.length).fill(-1);
  let jeton = -1;

  const lignes = [];
  for (let f = 0; f < A; f += 1) {
    const soi = animateurs[f];
    const soiree = { personnes: 0, appartenances: 0, etiquettes: 0 };
    const parTour = [];
    for (const ligne of lignesAnimees[f]) {
      jeton += 1;
      const t = Math.floor(ligne / R);
      const r = ligne % R;
      const tour = { tour: r, t, personnes: 0, appartenances: 0, etiquettes: 0 };
      const present = tableDe[soi * R + r] === t;
      for (let k = debutAssis[ligne]; present && k < debutAssis[ligne + 1]; k += 1) {
        const q = assis[k];
        const imposee = fixe[q * R + r];
        if (q === soi || (imposee === LIBRE ? siegesLibres[ligne] === 0 : imposee !== t)) continue;
        tour.personnes += 1;
        if (personneVue[q] !== f) {
          personneVue[q] = f;
          soiree.personnes += 1;
        }
        const g = groupe[q];
        if (g !== SANS_GROUPE) {
          if (groupeVuAuTour[g] !== jeton) {
            groupeVuAuTour[g] = jeton;
            tour.appartenances += 1;
          }
          if (groupeVu[g] !== f) {
            groupeVu[g] = f;
            soiree.appartenances += 1;
          }
        }
        for (let j = debutEtiquettes[q]; j < debutEtiquettes[q + 1]; j += 1) {
          const e = etiquettes[j];
          if (etiquetteVueAuTour[e] !== jeton) {
            etiquetteVueAuTour[e] = jeton;
            tour.etiquettes += 1;
          }
          if (etiquetteVue[e] !== f) {
            etiquetteVue[e] = f;
            soiree.etiquettes += 1;
          }
        }
      }
      if (!colonnes.etiquettes) tour.etiquettes = null;
      parTour.push(tour);
    }
    lignes.push({
      p: soi,
      toursAnimes: parTour.length,
      personnes: soiree.personnes,
      appartenances: soiree.appartenances,
      etiquettes: colonnes.etiquettes ? soiree.etiquettes : null,
      parTour,
    });
  }

  const avant = (a, b) => (a.etiquettes ?? 0) - (b.etiquettes ?? 0) || a.personnes - b.personnes || a.p - b.p;
  lignes.sort(colonnes.appartenances ? (a, b) => a.appartenances - b.appartenances || avant(a, b) : avant);
  return {
    colonnes,
    lignes,
    equite: {
      appartenances: colonnes.appartenances ? troisNombres(lignes, 'appartenances') : null,
      etiquettes: colonnes.etiquettes ? troisNombres(lignes, 'etiquettes') : null,
    },
  };
}

// Les trois nombres d'une colonne sur la soirée : la plus petite valeur, la
// plus grande, et le nombre de lignes à la plus petite ; null sans ligne.
function troisNombres(lignes, nom) {
  if (lignes.length === 0) return null;
  const valeurs = lignes.map((ligne) => ligne[nom]);
  const moins = valeurs.reduce((a, b) => Math.min(a, b));
  const plus = valeurs.reduce((a, b) => Math.max(a, b));
  return { moins, plus, auMinimum: valeurs.filter((valeur) => valeur === moins).length };
}
