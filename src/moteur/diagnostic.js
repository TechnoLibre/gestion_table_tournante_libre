// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Diagnostic d'une configuration, avant toute recherche (§ 5.6) : ce que la
// configuration impose à tout plan, chiffré. Un plancher est une borne
// inférieure démontrée sur les plans que produit la recherche, ceux qui
// assoient chacun à chaque tour et honorent les réservations ; un plan édité
// à la main qui laisse quelqu'un en réserve (§ 12.6) peut mesurer moins. Un
// plancher s'écrit là où le diagnostic sait le prouver, et vaut null
// ailleurs, jamais 0 par défaut.
//
// Les quantités que le moteur calcule déjà viennent de leur unique
// implémentation (§ 13.2) : nombre de places et places manquantes de
// configuration.js, plafond a priori de plafond.js, retours imposés de la
// mesure d'indicateurs.js. Le diagnostic ne modifie pas la configuration et
// lève ce que normaliser lève.
//
// Un remède se chiffre en sollicitant la même arithmétique sur une
// configuration modifiée — plus de tables, moins de tours —, jamais par une
// forme close de plus (§ 13.2) : la sonde passe par normaliser, puis par la
// fonction qui chiffre la quantité sur la configuration elle-même.

/**
 * @typedef {Object} PlancherCollisions
 * @property {string} groupe                    libellé de l'appartenance
 * @property {number} effectif                  membres présents
 * @property {number} plancherCumulees          collisions cumulées, sur les R tours
 * @property {number} plancherPairesDistinctes
 * @property {number|null} plancherExcedent     null quand il n'est pas
 *                                              strictement positif
 * @property {number|null} tablesManquantes     plus petit nombre de tables, de
 *           la plus grande capacité présente, dont l'ajout ramène ce plancher
 *           à 0 ; null quand l'effectif du groupe n'y suffit pas : les
 *           réservations assoient alors deux membres à une même table d'un tour
 *
 * @typedef {Object} Diagnostic
 * @property {number} placesManquantes          max(0, N − Σ c_t), par tour
 * @property {{min: number|null, max: number|null, parPersonne: number[],
 *             repartition: Array<{valeur: number, ancres: number, mobiles: number}>}} plafondAPriori
 *           parPersonne dans l'ordre de instance.ids ; min et max null pour
 *           une population vide ; repartition, une ligne par valeur
 *           présente, valeurs croissantes, les partiellement fixés parmi les
 *           mobiles
 * @property {PlancherCollisions[]} collisions  groupes dont le plancher de
 *           collisions cumulées est > 0, dans l'ordre de instance.groupes
 * @property {number|null} redondanceMinimale   null sans affilié
 * @property {{toursSansRedondance: number|null}} remedes
 *           toursSansRedondance : plus grand R′ < R où redondanceMinimale vaut
 *           0 ; null quand elle vaut déjà 0 ou null, ou qu'aucun R′ ne l'annule
 * @property {boolean} animateursMemeAppartenance
 * @property {number} redondanceImposeeParAnimateurs   min(R, T) − 1 ou 0
 * @property {boolean} uneSeuleAppartenance     séparation active, une seule
 *           appartenance, portée par chaque présent (§ 15.4)
 * @property {boolean} collisionPartout         tout plan qui assied chacun
 *           porte une collision à chaque table de chaque tour (§ 7.5)
 * @property {Array<{table: number, ancres: number, capacite: number, gelee: boolean,
 *                   moitie: boolean}>} ancrage
 *           chaque table, par identifiant, dans l'ordre de la configuration ;
 *           gelee quand ses ancrés occupent tous ses sièges ; moitie quand ils
 *           en occupent la moitié au moins, sans la geler
 * @property {number} retoursImposes
 * @property {number} ancragesImposantRetours   personnes dont les réservations
 *           imposent un retour
 * @property {{plancher: number, mobilesAuMoins: number}|null} ecartItineraire
 */
import {
  LIBRE,
  SANS_GROUPE,
  STATUT,
  nombrePlaces,
  nombrePlacesManquantes,
  normaliser,
} from './configuration.js';
import { mesurer } from './indicateurs.js';
import { plafondsAPriori } from './plafond.js';

// Paires que forment n personnes : C(n, 2).
const paires = (n) => (n * (n - 1)) / 2;

// Plus petit nombre de paires d'un groupe qu'un tour réunit. poses[t] compte
// les membres que les réservations assoient à la table t ce tour-là ; libres,
// les autres. Chaque libre va, l'un après l'autre, à la table qui compte le
// moins de membres, la première par index à égalité, et y forme une paire
// avec chacun. Le coût Σ C(x_t, 2) est séparable et convexe : ce remplissage
// glouton en donne le minimum sous la seule contrainte x_t ≥ poses[t]. Les
// capacités n'y entrent pas : relâchées, elles laissent un minimum qui minore
// celui de tout plan. Sans table, personne ne s'assied et aucune paire ne se
// forme.
function pairesMinimales(poses, libres) {
  const T = poses.length;
  if (T === 0) return 0;
  const membres = Int32Array.from(poses);
  for (let i = 0; i < libres; i += 1) {
    let moins = 0;
    for (let t = 1; t < T; t += 1) if (membres[t] < membres[moins]) moins = t;
    membres[moins] += 1;
  }
  let total = 0;
  for (let t = 0; t < T; t += 1) total += paires(membres[t]);
  return total;
}

// Plancher de collisions de chaque groupe (§ 5.6), dans l'ordre de
// instance.groupes ; un groupe n'y figure que si son plancher de collisions
// cumulées est positif. À chaque tour, les membres que les réservations fixent
// à ce tour, ancrés comme partiellement fixés, sont posés à leur table, et
// pairesMinimales place les autres. Les paires d'un même tour sont
// distinctes : le plus grand minimum d'un tour minore les paires distinctes,
// la somme des minimums les collisions cumulées. Un groupe de s membres
// n'offre que C(s, 2) paires distinctes : l'excédent, cumulées − distinctes,
// ne descend pas sous plancherCumulees − C(s, 2), écrit quand c'est positif.
function planchersCollisions({ N, T, R, groupe, groupes, fixe }) {
  const membres = groupes.map(() => []);
  for (let p = 0; p < N; p += 1) if (groupe[p] !== SANS_GROUPE) membres[groupe[p]].push(p);
  const planchers = [];
  for (let g = 0; g < groupes.length; g += 1) {
    let cumulees = 0;
    let distinctes = 0;
    for (let r = 0; r < R; r += 1) {
      const poses = new Int32Array(T);
      let libres = 0;
      for (const p of membres[g]) {
        const t = fixe[p * R + r];
        if (t === LIBRE) libres += 1;
        else poses[t] += 1;
      }
      const minimum = pairesMinimales(poses, libres);
      cumulees += minimum;
      distinctes = Math.max(distinctes, minimum);
    }
    if (cumulees === 0) continue;
    const excedent = cumulees - paires(membres[g].length);
    planchers.push({
      groupe: groupes[g],
      effectif: membres[g].length,
      plancherCumulees: cumulees,
      plancherPairesDistinctes: distinctes,
      plancherExcedent: excedent > 0 ? excedent : null,
    });
  }
  return planchers;
}

// Redondance minimale (§ 5.6), r_min(p) = max(0, |F(p)| − G) : A(p) ne
// dépasse pas G, et r(p) = |F(p)| − A(p). Elle s'évalue au plus grand |F(p)|
// possible, le plus petit du plafond a priori de p et du nombre d'affiliés
// autres que lui : elle minore la redondance de qui rencontre autant
// d'affiliés, non celle d'un plan qui lui en fait rencontrer moins. Rend le
// plus grand r_min(p) sur tous les participants ; null quand aucun n'est
// affilié.
function redondanceMinimale({ N, groupe, groupes }, aPriori) {
  const G = groupes.length;
  if (G === 0) return null;
  let affilies = 0;
  for (let p = 0; p < N; p += 1) if (groupe[p] !== SANS_GROUPE) affilies += 1;
  let plusGrande = 0;
  for (let p = 0; p < N; p += 1) {
    const autres = groupe[p] === SANS_GROUPE ? affilies : affilies - 1;
    plusGrande = Math.max(plusGrande, Math.min(aPriori[p], autres) - G);
  }
  return plusGrande;
}

// Vrai quand les ancrés, les animateurs, sont au moins deux et portent tous
// la même appartenance déclarée (§ 5.6).
function animateursMemeAppartenance({ N, statut, groupe }) {
  let commun = SANS_GROUPE;
  let animateurs = 0;
  for (let p = 0; p < N; p += 1) {
    if (statut[p] !== STATUT.ANCRE) continue;
    if (groupe[p] === SANS_GROUPE || (animateurs > 0 && groupe[p] !== commun)) return false;
    commun = groupe[p];
    animateurs += 1;
  }
  return animateurs >= 2;
}

// Ancrés et capacité de chaque table, dans l'ordre de l'instance, qui est
// celui de la configuration ; gelee quand les ancrés occupent tous les sièges
// (§ 5.9) ; moitie quand ils en occupent la moitié au moins, 2 × a_t ≥ c_t,
// sur une table qui tourne encore.
function ancrage({ T, idsTables, capacite, ancresParTable }) {
  return Array.from({ length: T }, (_, t) => {
    const gelee = ancresParTable[t] === capacite[t];
    return {
      table: idsTables[t],
      ancres: ancresParTable[t],
      capacite: capacite[t],
      gelee,
      moitie: !gelee && 2 * ancresParTable[t] >= capacite[t],
    };
  });
}

// Plafonds a priori regroupés par valeur, valeurs croissantes : à chacune,
// les ancrés et les mobiles, partiellement fixés compris (§ 5.4), qui la
// portent. Les personnes se parcourent par plafond, puis par index.
function repartition(aPriori, statut) {
  const ordre = Array.from({ length: aPriori.length }, (_, p) => p);
  ordre.sort((p, q) => aPriori[p] - aPriori[q] || p - q);
  const lignes = [];
  for (const p of ordre) {
    let ligne = lignes[lignes.length - 1];
    if (ligne === undefined || ligne.valeur !== aPriori[p]) {
      ligne = { valeur: aPriori[p], ancres: 0, mobiles: 0 };
      lignes.push(ligne);
    }
    if (statut[p] === STATUT.ANCRE) ligne.ancres += 1;
    else ligne.mobiles += 1;
  }
  return lignes;
}

// Chaque plancher de collisions, complété de tablesManquantes. La sonde à m
// tables ajoute m tables de la plus grande capacité présente, d'identifiants
// au-delà du plus grand, et rechiffre les planchers par planchersCollisions :
// le premier m où le groupe n'y figure plus est son remède. Un groupe de s
// membres se sépare dès que s tables de plus s'offrent à ses membres libres,
// sauf quand des réservations en assoient deux à une même table d'un tour :
// au-delà de s, il garde null. Les capacités, relâchées dans le plancher, ne
// changent pas le compte ; elles disent quelles tables ajouter. Un plancher
// suppose une table au moins.
function avecTablesManquantes(configuration, instance, planchers) {
  const lignes = planchers.map((plancher) => ({ ...plancher, tablesManquantes: null }));
  if (lignes.length === 0) return lignes;
  const enAttente = (m) => lignes.some((l) => l.tablesManquantes === null && m <= l.effectif);
  const capacite = Math.max(...instance.capacite);
  const premierId = Math.max(...instance.idsTables) + 1;
  const ajoutees = [];
  for (let m = 1; enAttente(m); m += 1) {
    ajoutees.push({ id: premierId + m - 1, numero: configuration.tables.length + m, capacite });
    const sonde = normaliser({ ...configuration, tables: [...configuration.tables, ...ajoutees] });
    const restants = new Set(planchersCollisions(sonde).map(({ groupe }) => groupe));
    for (const ligne of lignes) {
      if (ligne.tablesManquantes === null && m <= ligne.effectif && !restants.has(ligne.groupe)) {
        ligne.tablesManquantes = m;
      }
    }
  }
  return lignes;
}

// Plus grand R′ < R où la redondance minimale s'annule, null quand elle vaut
// déjà 0 ou null, ou qu'aucun R′ ne l'annule. La sonde à R′ tours garde les
// réservations de portée « tous », qui couvrent alors ses R′ tours, et retire
// celles d'un tour au-delà de R′, exclus compris : normaliser les refuserait
// (RESERVATION_TOUR). Les R′ se sondent du plus grand au plus petit.
function toursSansRedondance(configuration, R, minimale) {
  if (minimale === null || minimale === 0) return null;
  for (let tours = R - 1; tours >= 1; tours -= 1) {
    const reservations = configuration.reservations.filter(
      ({ portee, tour }) => portee !== 'tour' || tour <= tours,
    );
    const sonde = normaliser({ ...configuration, tours, reservations });
    if (redondanceMinimale(sonde, plafondsAPriori(sonde)) === 0) return tours;
  }
  return null;
}

// Vrai quand la séparation est active et que les présents portent tous une
// même appartenance, la seule (§ 15.4) ; faux dès qu'un présent est sans
// appartenance : la séparation y garde un sens.
function uneSeuleAppartenance({ groupe, groupes, contraintes }) {
  return contraintes.separerAppartenances && groupes.length === 1 && !groupe.includes(SANS_GROUPE);
}

// Vrai quand tout plan qui assied chacun porte une collision à chaque table
// de chaque tour (§ 7.5). Les autres tables tiennent au plus Σ c − c_t
// personnes : la table t en reçoit au moins N − (Σ c − c_t). Sans collision,
// elle n'assied qu'un membre de chacune des G appartenances et les U présents
// sans appartenance : au-delà de G + U, la collision est forcée. Faux quand
// la séparation est inactive, qu'une place manque — aucun plan n'assied
// chacun —, ou sans table : rien ne le prouve.
function collisionPartout(instance, placesManquantes) {
  const { N, T, capacite, groupe, groupes, contraintes } = instance;
  if (!contraintes.separerAppartenances || placesManquantes > 0 || T === 0) return false;
  let sansAppartenance = 0;
  for (let p = 0; p < N; p += 1) if (groupe[p] === SANS_GROUPE) sansAppartenance += 1;
  const places = nombrePlaces(instance);
  for (let t = 0; t < T; t += 1) {
    if (N - (places - capacite[t]) <= groupes.length + sansAppartenance) return false;
  }
  return true;
}

// Plafond du meilleur itinéraire d'un mobile p qui passe par la table t : le
// plafond a priori de p, la table t réservée au tour 1. La formule ne lit pas
// l'ordre des tours. Pour R ≥ 2, la réservation d'un seul tour rend p
// partiellement fixé (§ 4.2), ce qui ne change ni n ni les ancrés (§ 5.9) :
// seul l'itinéraire est contraint. Pour R = 1, elle couvre chacun des R tours
// et ancre p à la table t : a_t vu de p l'exclut, et n_p, le n de la sonde,
// vaut n − 1 comme pour un mobile ; le plafond est celui du même itinéraire.
// Sans partiellement fixé, seuls les ancrés occupent t au tour 1 ; une table
// où ils laissent un siège reçoit la réservation sans que normaliser lève
// SURRESERVATION.
function plafondPassantPar(configuration, instance, p, t) {
  const sonde = normaliser({
    ...configuration,
    reservations: [
      ...configuration.reservations,
      { participant: instance.ids[p], table: instance.idsTables[t], portee: 'tour', tour: 1 },
    ],
  });
  return plafondsAPriori(sonde)[p];
}

// Plancher de l'écart d'itinéraire maximal (§ 12.10.4), écrit pour une
// configuration tendue, Σ c_t = N, sans partiellement fixé ; null ailleurs.
// Là, tout plan qui assied chacun remplit chaque siège à chaque tour :
// l'occupation vaut la capacité, et le plafond réalisé d'un mobile vaut le
// plafond de son itinéraire. Les mobiles partagent alors un plafond a priori
// P*. Une table est inférieure quand le meilleur itinéraire qui passe par elle
// vaut P*_t < P*. Ses c_t − k_t sièges mobiles reçoivent un mobile à chacun
// des R tours : M_inf sièges-tours sur les tables inférieures, dont un mobile
// n'occupe que R au plus. Au moins ⌈M_inf / R⌉ mobiles passent donc par une
// table inférieure et finissent au moins P* − P*_t sous leur plafond a
// priori. Sans table inférieure, rien n'est prouvé : null.
//
// Deux tables de même capacité et de mêmes ancrés s'échangent sans changer
// aucun plafond : P*_t se calcule une fois par couple (c_t, k_t), que la Map
// retrouve. Le couple ne se réduit pas aux sièges libres c_t − k_t : à sièges
// libres égaux, les sièges qui tournent sont les mêmes, et les k_t ancrés
// s'ajoutent au plafond hors du terme que n_p borne.
function ecartItineraire(configuration, instance, aPriori) {
  const { N, T, R, capacite, ancresParTable, statut } = instance;
  if (nombrePlaces(instance) !== N || statut.includes(STATUT.PARTIELLEMENT_FIXE)) return null;
  const mobile = statut.indexOf(STATUT.MOBILE);
  if (mobile === -1) return null;
  const plafondCommun = aPriori[mobile];
  const parGabarit = new Map();
  let siegesToursInferieurs = 0;
  let plancher = null;
  for (let t = 0; t < T; t += 1) {
    const sieges = capacite[t] - ancresParTable[t];
    // Une table gelée n'a aucun siège mobile, aucun itinéraire n'y passe, et
    // la sonde la surréserverait.
    if (sieges === 0) continue;
    const gabarit = `${capacite[t]}|${ancresParTable[t]}`;
    let passant = parGabarit.get(gabarit);
    if (passant === undefined) {
      passant = plafondPassantPar(configuration, instance, mobile, t);
      parGabarit.set(gabarit, passant);
    }
    if (passant < plafondCommun) {
      siegesToursInferieurs += sieges * R;
      const ecartPassant = plafondCommun - passant;
      if (plancher === null || ecartPassant < plancher) plancher = ecartPassant;
    }
  }
  if (siegesToursInferieurs === 0) return null;
  return { plancher, mobilesAuMoins: Math.ceil(siegesToursInferieurs / R) };
}

// Plus petite et plus grande valeur, null pour une liste vide.
function etendue(valeurs) {
  if (valeurs.length === 0) return { min: null, max: null };
  let min = valeurs[0];
  let max = valeurs[0];
  for (const valeur of valeurs) {
    if (valeur < min) min = valeur;
    if (valeur > max) max = valeur;
  }
  return { min, max };
}

/**
 * Diagnostic d'une configuration, avant la recherche (§ 5.6).
 *
 * - placesManquantes : nombrePlacesManquantes ; la recherche refuse une
 *   configuration où elles sont positives, le diagnostic les chiffre (§ 5.9).
 * - plafondAPriori : plafondsAPriori, son étendue et sa répartition par
 *   valeur.
 * - collisions : planchers de collisions par groupe, posés sur les tours
 *   fixés, capacités relâchées ; chacun avec les tables qui l'annulent.
 * - redondanceMinimale : max_p max(0, min(a priori(p), affiliés autres que
 *   p) − G) ; remedes.toursSansRedondance, le nombre de tours qui l'annule.
 * - animateursMemeAppartenance, et redondanceImposeeParAnimateurs : la forme
 *   close min(R, T) − 1 du § 5.6, qui compte un animateur à chaque table
 *   visitée ; 0 quand les animateurs ne partagent pas une appartenance.
 * - uneSeuleAppartenance et collisionPartout : une séparation vide de sens,
 *   une collision forcée à chaque table.
 * - ancrage : ancrés, capacité, gel et demi-ancrage de chaque table.
 * - retoursImposes : la rangée de instance.fixe se lit comme le plan qui
 *   assied chacun aux seuls tours fixés, en réserve ailleurs ; sa mesure
 *   compte max(0, f − 1) retours pour f tours réservés à une même table, ce
 *   que mesure tout plan qui honore les réservations (§ 5.4) ;
 *   ancragesImposantRetours, les personnes qui en portent un au moins.
 * - ecartItineraire : plancher de l'écart d'itinéraire maximal, ou null.
 *
 * @param {import('./types.js').Configuration} configuration
 * @returns {Diagnostic}
 */
export function diagnostiquer(configuration) {
  const instance = normaliser(configuration);
  const aPriori = plafondsAPriori(instance);
  const memeAppartenance = animateursMemeAppartenance(instance);
  const placesManquantes = nombrePlacesManquantes(instance);
  const minimale = redondanceMinimale(instance, aPriori);
  const imposes = mesurer(instance, instance.fixe);
  return {
    placesManquantes,
    plafondAPriori: {
      ...etendue(aPriori),
      parPersonne: aPriori,
      repartition: repartition(aPriori, instance.statut),
    },
    collisions: avecTablesManquantes(configuration, instance, planchersCollisions(instance)),
    redondanceMinimale: minimale,
    remedes: { toursSansRedondance: toursSansRedondance(configuration, instance.R, minimale) },
    animateursMemeAppartenance: memeAppartenance,
    redondanceImposeeParAnimateurs: memeAppartenance ? Math.min(instance.R, instance.T) - 1 : 0,
    uneSeuleAppartenance: uneSeuleAppartenance(instance),
    collisionPartout: collisionPartout(instance, placesManquantes),
    ancrage: ancrage(instance),
    retoursImposes: imposes.totalRetoursImposes,
    ancragesImposantRetours: imposes.retoursImposes.filter((retours) => retours > 0).length,
    ecartItineraire: ecartItineraire(configuration, instance, aPriori),
  };
}
