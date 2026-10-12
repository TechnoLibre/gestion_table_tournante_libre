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
//
// Une seule lecture du plan décide qu'une paire est réunie, collègue ou revue,
// qu'une personne revient, qu'elle est servie par l'objectif de sa table et
// quels animateurs elle rencontre : parcourirTours. mesurer en tire chacun de
// ses chiffres, conflitsParTable (conflits.js) le détail par table, si
// bien que la somme des violations par table égale le compte de la mesure
// (§ 13.2), et le détail de la page de qualité (qualite.js) ses comptes par
// tour.
//
// Un tour servi et une rencontre d'animateur ne se comptent qu'à une table
// que la personne peut occuper à ce tour : sa table fixée, ou, libre, une
// table qui garde un siège libre (§ 4.5). Un plan qui honore les
// réservations n'assied personne ailleurs ; un plan édité qui en déplace
// une garde ainsi s(p) ≤ P(p) et m(p) ≤ B(p), que verifierIndicateurs
// éprouve.
import {
  LIBRE,
  RESERVE,
  SANS_GROUPE,
  SANS_OBJECTIF,
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
 * @typedef {Object} MesuresObjectifs   null sans personne concernée (A9)
 * @property {number[]} tours            s(p), tours servis, ordre canonique
 * @property {number[]} possibles        P(p), tours possibles (§ 4.5)
 * @property {number} horsObjectif       H = Σ (P(p) − s(p))
 * @property {number} jamaisServies      J, concernés dont s(p) = 0
 * @property {number} horsObjectifMax    E = max (P(p) − s(p)) sur les concernés
 * @property {number} personnesAuMax     concernés à E ; 0 quand E = 0
 * @property {number} concernes          personnes dont P(p) > 0
 * @property {TroisAgregats} agregat     s(p) sur les concernés
 *
 * @typedef {Object} MesuresAnimateurs  null sans personne concernée (A9)
 * @property {number[]} rencontres       m(p), animateurs distincts rencontrés
 *                                       là où ils animent
 * @property {number[]} bornes           B(p), instance.borneAnimateurs
 * @property {number} nonRencontres      Σ (B(p) − m(p)) sur toutes les personnes
 * @property {number} concernes          personnes dont B(p) > 0
 * @property {TroisAgregats} agregat     m(p) sur les concernés
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
 * @property {number[]} retoursChoisis      par personne : ses occurrences
 *                                          parmi les revenus de parcourirTours
 * @property {number[]} retoursImposes      par personne : ses retours moins
 *                                          ses retours choisis
 * @property {TroisAgregats} aggRencontres
 * @property {TroisAgregats} aggRedondance
 * @property {TroisAgregats} aggAppartenancesVues   A(p)
 * @property {TroisAgregats} aggDiversite   d(p), sur les seules personnes qui
 *                                          rencontrent un affilié
 * @property {number} totalRedondance       Σ_p r(p), le seul total de la
 *                                          redondance : la recherche et le
 *                                          classement le lisent
 * @property {number} collisionsCumulees    Σ paires de même groupe × tours ensemble
 * @property {number} pairesDistinctes      paires de même groupe réunies ≥ 1 fois
 * @property {number} excedentCollisions    cumulées − distinctes
 * @property {{choisies: number, imposees: number}} rencontresRepetees
 *           paires réunies ≥ 2 fois ; « imposée » quand chaque rencontre de la
 *           paire a lieu à une table où les deux sont réservés ce tour-là ;
 *           choisies, les paires distinctes des revues de parcourirTours
 * @property {number} maxRencontresPaire    sur toutes les paires ; 0 si aucune
 * @property {number} totalRetoursChoisis
 * @property {number} totalRetoursImposes
 * @property {Array<{groupe: string, effectif: number, collisionsCumulees: number,
 *                   pairesDistinctes: number, excedent: number}>} parGroupe
 *           ordre de instance.groupes
 * @property {MesuresObjectifs|null} objectifs
 * @property {MesuresAnimateurs|null} animateurs
 */

// Plus grand compte que tient un Uint16Array.
const UINT16_MAX = 0xffff;

// Rang de la paire (a, b), a < b, dans le triangle supérieur d'une matrice
// N × N rangé ligne par ligne : la ligne a s'ouvre après les
// (N − 1) + (N − 2) + … + (N − a) paires des lignes qui la précèdent.
const rangPaire = (N, a, b) => (a * (2 * N - a - 1)) / 2 + (b - a - 1);

/**
 * Le plan lu tour par tour, puis table par table, par index croissants : le
 * seul code qui décide qu'une paire est réunie, de même appartenance ou
 * revue, et qu'une personne revient. mesurer en tire chacun de ses chiffres,
 * conflitsParTable (conflits.js) le détail par table.
 *
 * parTour[r][t], en index de personnes, chaque paire [a, b] avec a < b,
 * chaque liste croissante — paires dans l'ordre de a, puis de b :
 * - collegues : paires de même appartenance assises à t au tour r ;
 * - revues : paires assises à t au tour r et réunies à un tour antérieur,
 *   sauf quand chacune de leurs rencontres jusqu'à r a lieu à une table où
 *   les deux sont réservés ce tour-là ;
 * - revenus : personnes assises à t au tour r et à un tour antérieur, sauf
 *   quand elles y sont réservées au tour r et lors d'une visite antérieure
 *   à t.
 * parPaire : les rencontres de chaque paire, rangées par rangPaire ; une
 * paire se réunit au plus une fois par tour, R borne chaque compte, qu'un
 * Uint16Array tient tant que R ≤ 65 535. reunies : chaque paire réunie au
 * moins une fois, une seule fois, a puis b à plat, dans l'ordre de sa
 * première rencontre ; lirePaires n'en parcourt pas d'autre, au lieu du
 * triangle entier. toursAssis, et retours — visites
 * d'une table déjà visitée, imposées comprises —, par personne. servis,
 * s(p) : les tours où p est assis, à une table qu'il peut occuper, sous un
 * objectif en vigueur qui lui correspond. rencontresAnimateurs, m(p) : les
 * animateurs distincts, autres que p, qui animent à sa table, à un tour où
 * il l'occupe et peut l'occuper, et y sont assis.
 *
 * Par tour, au même passage que servis (§ 5.4, B4) : servisParTour, S_r,
 * les tours servis du tour r, si bien que leur somme sur les tours est celle
 * de servis ; possiblesParTour, Π_r, les couples (p, r) possibles du tour,
 * instance.possible, fixés et personnes en réserve compris, si bien que leur
 * somme est celle de P(p) ; assisSansCoupleParTour, σ_r, les personnes
 * assises à une table au tour r dont le couple (p, r) n'est pas possible,
 * concernées ou non. Un servi a son couple possible : S_r ≤ Π_r, et σ_r + Π_r
 * ne dépasse pas les présents.
 *
 * Ne modifie ni l'instance ni le plan ; lève ce que lève exigerPlanIndexe.
 *
 * @param {import('./types.js').Instance} instance
 * @param {ArrayLike<number>} tableDe
 * @returns {{parTour: Array<Array<{collegues: number[][], revues: number[][], revenus: number[]}>>,
 *            parPaire: Uint16Array|Uint32Array, reunies: number[], toursAssis: number[], retours: number[],
 *            servis: number[], rencontresAnimateurs: number[], servisParTour: number[],
 *            possiblesParTour: number[], assisSansCoupleParTour: number[]}}
 */
export function parcourirTours(instance, tableDe) {
  exigerPlanIndexe(instance, tableDe);
  const { N, T, R, fixe, groupe, siegesLibres, O, objectifDe, correspond, possible } = instance;
  const { A, rangAnimateur, animateurs, debutAnimes, animes } = instance;

  // Personne par personne, ses tours dans l'ordre : visites[t] compte ses
  // passages à la table t, reserveeAvant[t] note qu'un passage antérieur y
  // était réservé. revenu[p × R + r] marque la visite répétée que la
  // personne choisit. Le second parcours de ses tours remet à zéro les
  // tables qu'elle a visitées : la personne suivante les trouve nulles.
  //
  // Au même passage, à chaque table que la personne peut occuper : un tour
  // servi quand l'objectif en vigueur lui correspond, et chaque animateur qui
  // anime là et y est assis, autre qu'elle, rencontré. rencontre[f] vaut p
  // quand p a déjà rencontré l'animateur de rang f : la marque, datée par
  // personne, n'a pas à se remettre à zéro. Le couple (p, r) possible compte
  // dans Π_r avant que la réserve ne l'écarte ; assis, il entre dans σ_r
  // quand il ne l'est pas, et un tour servi entre aussi dans S_r.
  const toursAssis = new Array(N).fill(0);
  const retours = new Array(N).fill(0);
  const servis = new Array(N).fill(0);
  const rencontresAnimateurs = new Array(N).fill(0);
  const servisParTour = new Array(R).fill(0);
  const possiblesParTour = new Array(R).fill(0);
  const assisSansCoupleParTour = new Array(R).fill(0);
  const revenu = new Uint8Array(N * R);
  const visites = new Int32Array(T);
  const reserveeAvant = new Uint8Array(T);
  const rencontre = new Int32Array(A).fill(-1);
  for (let p = 0; p < N; p += 1) {
    const soi = rangAnimateur[p];
    for (let r = 0; r < R; r += 1) {
      const couple = possible[p * R + r];
      possiblesParTour[r] += couple;
      const t = tableDe[p * R + r];
      if (t === RESERVE) continue;
      toursAssis[p] += 1;
      if (couple === 0) assisSansCoupleParTour[r] += 1;
      const imposee = fixe[p * R + r];
      const ligne = t * R + r;
      if (imposee === LIBRE ? siegesLibres[ligne] > 0 : imposee === t) {
        const o = objectifDe[ligne];
        if (o !== SANS_OBJECTIF && correspond[p * O + o] === 1) {
          servis[p] += 1;
          servisParTour[r] += 1;
        }
        for (let k = debutAnimes[ligne], fin = debutAnimes[ligne + 1]; k < fin; k += 1) {
          const f = animes[k];
          if (f === soi || rencontre[f] === p || tableDe[animateurs[f] * R + r] !== t) continue;
          rencontre[f] = p;
          rencontresAnimateurs[p] += 1;
        }
      }
      const reservee = imposee === t;
      if (visites[t] > 0) {
        retours[p] += 1;
        if (!reservee || reserveeAvant[t] === 0) revenu[p * R + r] = 1;
      }
      visites[t] += 1;
      if (reservee) reserveeAvant[t] = 1;
    }
    for (let r = 0; r < R; r += 1) {
      const t = tableDe[p * R + r];
      if (t === RESERVE) continue;
      visites[t] = 0;
      reserveeAvant[t] = 0;
    }
  }

  // Tour par tour : occupants de chaque table, par index croissants, a < b
  // pour toute paire (liste[i], liste[j]) avec i < j. La boucle intérieure
  // part du voisin suivant : une liste vide ou d'un seul occupant ne forme
  // aucune paire, et nul n'est apparié à lui-même. libre[k] note qu'une
  // rencontre de la paire, jusqu'au tour courant compris, a eu lieu hors
  // d'une table où les deux sont réservés.
  const nombrePaires = (N * (N - 1)) / 2;
  const parPaire = R <= UINT16_MAX ? new Uint16Array(nombrePaires) : new Uint32Array(nombrePaires);
  const libre = new Uint8Array(nombrePaires);
  const reunies = [];
  const parTour = [];
  for (let r = 0; r < R; r += 1) {
    const assis = Array.from({ length: T }, () => []);
    for (let p = 0; p < N; p += 1) {
      const t = tableDe[p * R + r];
      if (t !== RESERVE) assis[t].push(p);
    }
    const tables = [];
    for (let t = 0; t < T; t += 1) {
      const liste = assis[t];
      const collegues = [];
      const revues = [];
      const revenus = [];
      for (let i = 0; i < liste.length; i += 1) {
        const a = liste[i];
        if (revenu[a * R + r] === 1) revenus.push(a);
        const aReserve = fixe[a * R + r] === t;
        const g = groupe[a];
        for (let j = i + 1; j < liste.length; j += 1) {
          const b = liste[j];
          const k = rangPaire(N, a, b);
          parPaire[k] += 1;
          if (parPaire[k] === 1) reunies.push(a, b);
          if (!aReserve || fixe[b * R + r] !== t) libre[k] = 1;
          if (g !== SANS_GROUPE && g === groupe[b]) collegues.push([a, b]);
          if (parPaire[k] >= 2 && libre[k] === 1) revues.push([a, b]);
        }
      }
      tables.push({ collegues, revues, revenus });
    }
    parTour.push(tables);
  }
  return {
    parTour,
    parPaire,
    reunies,
    toursAssis,
    retours,
    servis,
    rencontresAnimateurs,
    servisParTour,
    possiblesParTour,
    assisSansCoupleParTour,
  };
}

// Lecture des paires réunies (reunies de parcourirTours), leurs comptes dans
// parPaire : une paire jamais réunie ne change aucun chiffre, et l'ordre de
// lecture n'en change aucun non plus. Par personne : |met(p)|, |F(p)| et
// A(p), vu[p * G + g] notant que p a déjà croisé un affilié du groupe g. Sur
// toutes les paires : les paires réunies deux fois au moins, et le plus
// grand compte. O(paires réunies), et non O(N²).
function lirePaires({ N, groupe, groupes }, parPaire, reunies) {
  const G = groupes.length;
  const rencontres = new Int32Array(N);
  const affilies = new Int32Array(N);
  const vues = new Int32Array(N);
  const vu = new Uint8Array(N * G);
  let repetees = 0;
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

  for (let i = 0; i < reunies.length; i += 2) {
    const a = reunies[i];
    const b = reunies[i + 1];
    const n = parPaire[rangPaire(N, a, b)];
    rencontrer(a, b);
    rencontrer(b, a);
    if (n > maxRencontresPaire) maxRencontresPaire = n;
    if (n >= 2) repetees += 1;
  }
  return { rencontres, affilies, vues, repetees, maxRencontresPaire };
}

// Lecture des listes de parcourirTours. Une paire de collègues réunie n fois
// porte n collisions cumulées et compte une fois parmi les paires
// distinctes de son groupe ; une paire revue compte une fois parmi les
// rencontres répétées choisies, à quelque tour qu'elle le soit ; chaque
// occurrence d'une personne revenue est un retour choisi.
function lireTours({ N, groupe, groupes }, parTour) {
  const nombrePaires = (N * (N - 1)) / 2;
  const collisions = new Array(groupes.length).fill(0);
  const distinctes = new Array(groupes.length).fill(0);
  const collegueVu = new Uint8Array(nombrePaires);
  const revueVue = new Uint8Array(nombrePaires);
  const retoursChoisis = new Array(N).fill(0);
  let choisies = 0;
  for (const tables of parTour) {
    for (const { collegues, revues, revenus } of tables) {
      for (const [a, b] of collegues) {
        const g = groupe[a];
        const k = rangPaire(N, a, b);
        collisions[g] += 1;
        if (collegueVu[k] === 0) {
          collegueVu[k] = 1;
          distinctes[g] += 1;
        }
      }
      for (const [a, b] of revues) {
        const k = rangPaire(N, a, b);
        if (revueVue[k] === 0) {
          revueVue[k] = 1;
          choisies += 1;
        }
      }
      for (const p of revenus) retoursChoisis[p] += 1;
    }
  }
  return { collisions, distinctes, choisies, retoursChoisis };
}

// Population sans membre. min reste null tant qu'aucune valeur n'y entre :
// aucun Infinity ne sert de minimum initial.
const VIDE = Object.freeze({ min: null, somme: 0, effectif: 0 });

// La population, une valeur de plus. VIDE, que les trois populations
// partagent au départ, reste intact : la première valeur ouvre un cumul
// neuf, que les suivantes complètent en place, sans un objet par personne.
function ajouter(cumul, valeur) {
  if (cumul === VIDE) return { min: valeur, somme: valeur, effectif: 1 };
  if (valeur < cumul.min) cumul.min = valeur;
  cumul.somme += valeur;
  cumul.effectif += 1;
  return cumul;
}

// Agrégat d'une population ; la moyenne d'une population vide vaut null.
const conclure = ({ min, somme, effectif }) => ({
  min,
  moyenne: effectif === 0 ? null : somme / effectif,
  effectif,
});

// La population, une valeur de plus quand elle en est une : null n'y entre
// pas, et la personne qui le porte sort de l'effectif.
const ajouterSiDefinie = (cumul, valeur) => (valeur === null ? cumul : ajouter(cumul, valeur));

// Minimum, moyenne et effectif de valeurs[p] sur les trois populations du
// § 5.4, que replierParPopulation forme ; replier y range chaque valeur.
function troisAgregats(valeurs, statut, replier = ajouter) {
  const { tous, mobiles, ancres } = replierParPopulation(valeurs, statut, VIDE, replier);
  return { tous: conclure(tous), mobiles: conclure(mobiles), ancres: conclure(ancres) };
}

const somme = (valeurs) => valeurs.reduce((total, valeur) => total + valeur, 0);

// Les objectifs des tables mesurés (A9), sur les personnes concernées, celles
// dont P(p) > 0 : null sans aucune. Pour chacune, P(p) − s(p) entre dans H ;
// s(p) nul, elle est jamais servie ; E et le nombre de personnes à E se
// tiennent en un passage, ce nombre ramené à 0 quand E l'est. servis est le
// tableau neuf de parcourirTours, que la mesure rend tel quel sous tours.
function lireObjectifs({ N, possibles: P, statut }, servis) {
  let concernes = 0;
  for (let p = 0; p < N; p += 1) if (P[p] > 0) concernes += 1;
  if (concernes === 0) return null;
  const possibles = new Array(N);
  // s(p) des concernés, null pour les autres : l'agrégat n'en compte aucun.
  const selonObjectif = new Array(N);
  let horsObjectif = 0;
  let jamaisServies = 0;
  let horsObjectifMax = 0;
  let auMax = 0;
  for (let p = 0; p < N; p += 1) {
    possibles[p] = P[p];
    if (P[p] === 0) {
      selonObjectif[p] = null;
      continue;
    }
    selonObjectif[p] = servis[p];
    const hors = P[p] - servis[p];
    horsObjectif += hors;
    if (servis[p] === 0) jamaisServies += 1;
    if (hors > horsObjectifMax) {
      horsObjectifMax = hors;
      auMax = 0;
    }
    if (hors === horsObjectifMax) auMax += 1;
  }
  return {
    tours: servis,
    possibles,
    horsObjectif,
    jamaisServies,
    horsObjectifMax,
    personnesAuMax: horsObjectifMax === 0 ? 0 : auMax,
    concernes,
    agregat: troisAgregats(selonObjectif, statut, ajouterSiDefinie),
  };
}

// Les animateurs rencontrés mesurés (A9), sur les personnes concernées,
// celles dont B(p) > 0 : null sans aucune. Les animateurs non rencontrés
// somment B(p) − m(p) sur toutes les personnes, une non concernée y valant
// zéro. rencontres est le tableau neuf de parcourirTours, rendu tel quel.
function lireAnimateurs({ N, borneAnimateurs, statut }, rencontres) {
  let concernes = 0;
  for (let p = 0; p < N; p += 1) if (borneAnimateurs[p] > 0) concernes += 1;
  if (concernes === 0) return null;
  const bornes = new Array(N);
  // m(p) des concernés, null pour les autres : l'agrégat n'en compte aucun.
  const selonBorne = new Array(N);
  let nonRencontres = 0;
  for (let p = 0; p < N; p += 1) {
    const borne = borneAnimateurs[p];
    bornes[p] = borne;
    nonRencontres += borne - rencontres[p];
    selonBorne[p] = borne > 0 ? rencontres[p] : null;
  }
  return {
    rencontres,
    bornes,
    nonRencontres,
    concernes,
    agregat: troisAgregats(selonBorne, statut, ajouterSiDefinie),
  };
}

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
  const { N, groupe, groupes, statut } = instance;
  const { parTour, parPaire, reunies, toursAssis, retours, servis, rencontresAnimateurs } = parcourirTours(instance, tableDe);
  const paires = lirePaires(instance, parPaire, reunies);
  const { collisions, distinctes, choisies, retoursChoisis } = lireTours(instance, parTour);

  const rencontres = Array.from(paires.rencontres);
  const affilies = Array.from(paires.affilies);
  const appartenancesVues = Array.from(paires.vues);
  const redondance = affilies.map((f, p) => f - appartenancesVues[p]);
  const diversite = affilies.map((f, p) => (f === 0 ? null : appartenancesVues[p] / f));
  const retoursImposes = retours.map((total, p) => total - retoursChoisis[p]);

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
    aggAppartenancesVues: troisAgregats(appartenancesVues, statut),
    aggDiversite: troisAgregats(diversite, statut, ajouterSiDefinie),
    totalRedondance: somme(redondance),
    collisionsCumulees,
    pairesDistinctes,
    excedentCollisions: collisionsCumulees - pairesDistinctes,
    rencontresRepetees: { choisies, imposees: paires.repetees - choisies },
    maxRencontresPaire: paires.maxRencontresPaire,
    totalRetoursChoisis: somme(retoursChoisis),
    totalRetoursImposes: somme(retoursImposes),
    parGroupe,
    objectifs: lireObjectifs(instance, servis),
    animateurs: lireAnimateurs(instance, rencontresAnimateurs),
  };
}
