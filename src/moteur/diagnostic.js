// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Diagnostic d'une configuration, avant toute recherche (§ 5.6) : ce que la
// configuration impose à tout plan, chiffré. Un plancher est une borne
// inférieure démontrée sur les plans que produit la recherche, ceux qui
// assoient chacun à chacun de ses tours de présence et honorent les
// réservations ; un plan édité à la main qui laisse une présente en réserve
// (§ 12.6) peut mesurer moins. Un plancher s'écrit là où le diagnostic sait
// le prouver, et vaut null ailleurs, jamais 0 par défaut.
//
// Sous la présence par tour, chaque plancher se raisonne sur les présents
// de chaque tour : un absent n'occupe aucun siège et ne forme aucune paire.
// Seul l'écart d'itinéraire perd sa preuve, qui suppose chaque siège rempli
// à chaque tour : il vaut null dès qu'une absence existe, et planchersRetires
// le nomme.
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
 * @property {number} placesManquantes          le plus grand des manques par
 *                                              tour
 * @property {number[]} placesManquantesParTour max(0, n_r − Σ c_t), R cases
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
 * @property {{horsObjectif: number, jamaisServies: number, horsObjectifMax: number,
 *             parTour: number[]}} objectifsInevitables
 *           planchers immédiats des trois valeurs des modes des objectifs
 *           (D16, A10) ; 0 quand rien n'est prouvé, chacun calculé sous tout
 *           mode, critère coché ou non ; parTour, le plancher de chaque tour,
 *           max(0, P_r − L_r), R cases, dont horsObjectif est la somme
 * @property {{absences: number, presentsParTour: number[]}} presence
 *           absences, Σ_p (R − tours de présence de p) ; presentsParTour, n_r,
 *           R cases
 * @property {string[]} planchersRetires   les planchers que la présence par
 *           tour retire : ['ecartItineraire'] dès qu'une absence existe, []
 *           sinon
 */
import {
  LIBRE,
  SANS_GROUPE,
  SANS_OBJECTIF,
  STATUT,
  nombrePlaces,
  nombrePlacesManquantes,
  normaliser,
  placesManquantesParTour,
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
// pairesMinimales place les autres ; un membre absent du tour ne s'y assied
// pas et n'y compte pas. Les paires d'un même tour sont
// distinctes : le plus grand minimum d'un tour minore les paires distinctes,
// la somme des minimums les collisions cumulées. Un groupe de s membres
// n'offre que C(s, 2) paires distinctes : l'excédent, cumulées − distinctes,
// ne descend pas sous plancherCumulees − C(s, 2), écrit quand c'est positif.
// Exporté pour qu'une épreuve en compte les appels (diagnostiquer).
//
// avecLibres faux : les membres libres ne comptent pas. Le plancher est
// alors celui des seules places réservées, la limite du plancher quand les
// tables ajoutées sont assez nombreuses pour asseoir chaque libre seul.
export function planchersCollisions({ N, T, R, groupe, groupes, fixe, present }, { avecLibres = true } = {}) {
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
        if (present[p * R + r] === 0) continue;
        const t = fixe[p * R + r];
        if (t !== LIBRE) poses[t] += 1;
        else if (avecLibres) libres += 1;
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
// portent. Les personnes se parcourent par plafond, puis par index : le tri
// est stable et part de l'ordre des index.
function repartition(aPriori, statut) {
  const ordre = Array.from({ length: aPriori.length }, (_, p) => p);
  ordre.sort((p, q) => aPriori[p] - aPriori[q]);
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
// au-delà du plus grand, et rechiffre les planchers par chiffrer : le
// premier m où le groupe n'y figure plus est son remède. Un groupe de s
// membres se sépare dès que s tables de plus s'offrent à ses membres libres,
// sauf quand des réservations en assoient deux à une même table d'un tour :
// le plancher des seules places réservées (avecLibres faux), qu'aucune table
// ajoutée n'abaisse, le dit d'un seul chiffrage, et le groupe garde null
// sans être sondé. Les capacités, relâchées dans le plancher, ne changent
// pas le compte ; elles disent quelles tables ajouter. Un plancher suppose
// une table au moins.
function avecTablesManquantes(configuration, instance, planchers, chiffrer) {
  const lignes = planchers.map((plancher) => ({ ...plancher, tablesManquantes: null }));
  if (lignes.length === 0) return lignes;
  const sansRemede = new Set(chiffrer(instance, { avecLibres: false }).map(({ groupe }) => groupe));
  const enAttente = (m) => lignes.some((l) => l.tablesManquantes === null && !sansRemede.has(l.groupe) && m <= l.effectif);
  const capacite = Math.max(...instance.capacite);
  const premierId = Math.max(...instance.idsTables) + 1;
  const ajoutees = [];
  for (let m = 1; enAttente(m); m += 1) {
    ajoutees.push({ id: premierId + m - 1, numero: configuration.tables.length + m, capacite });
    const sonde = normaliser({ ...configuration, tables: [...configuration.tables, ...ajoutees] });
    const restants = new Set(chiffrer(sonde).map(({ groupe }) => groupe));
    for (const ligne of lignes) {
      if (ligne.tablesManquantes === null && !sansRemede.has(ligne.groupe) && m <= ligne.effectif && !restants.has(ligne.groupe)) {
        ligne.tablesManquantes = m;
      }
    }
  }
  return lignes;
}

// La configuration ramenée à ses R′ premiers tours : les réservations de
// portée « tous », qui couvrent alors ses R′ tours, restent, et celles d'un
// tour au-delà de R′ se retirent, exclus compris ; de même les objectifs d'un
// tour au-delà de R′, les tours animés au-delà de R′ et les tours de
// présence au-delà de R′, exclus compris. normaliser les refuserait
// (RESERVATION_TOUR, OBJECTIF_TOUR, ANIMATION_NON_FIXEE, PRESENCE_TOUR) ; un
// tour animé gardé reste fixé, sa réservation couvrant un tour de 1 à R′, et
// un tour de présence. Une personne qui ne garde aucun tour de présence
// sort de la sonde, exclue et sans présence : une liste vide lèverait
// PRESENCE_VIDE.
function surMoinsDeTours(configuration, tours) {
  const avant = (tour) => tour <= tours;
  const reduite = {
    ...configuration,
    tours,
    reservations: configuration.reservations.filter(({ portee, tour }) => portee !== 'tour' || avant(tour)),
    participants: configuration.participants.map((personne) => {
      const ramenee = personne.anime === undefined ? personne : { ...personne, anime: personne.anime.filter(avant) };
      if (personne.presence === undefined) return ramenee;
      const presence = personne.presence.filter(avant);
      if (presence.length > 0) return { ...ramenee, presence };
      const sortie = { ...ramenee, exclu: true };
      delete sortie.presence;
      return sortie;
    }),
  };
  if (configuration.objectifs !== undefined) {
    reduite.objectifs = configuration.objectifs.filter(({ tour }) => tour === null || tour === undefined || avant(tour));
  }
  return reduite;
}

// Plus grand R′ < R où la redondance minimale s'annule, null quand elle vaut
// déjà 0 ou null, ou qu'aucun R′ ne l'annule. La sonde à R′ tours est la
// configuration ramenée à ses R′ premiers tours. Les R′ se sondent du plus
// grand au plus petit.
function toursSansRedondance(configuration, R, minimale) {
  if (minimale === null || minimale === 0) return null;
  for (let tours = R - 1; tours >= 1; tours -= 1) {
    const sonde = normaliser(surMoinsDeTours(configuration, tours));
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
// de chaque tour (§ 7.5). Au tour r, les autres tables tiennent au plus
// Σ c − c_t personnes : la table t reçoit au moins n_r − (Σ c − c_t) des
// n_r présents du tour. Sans collision, elle n'assied qu'un membre de
// chacune des G_r appartenances présentes au tour et les U_r présents sans
// appartenance : au-delà de G_r + U_r, la collision est forcée. Vrai quand
// elle l'est à chaque table de chaque tour. Faux quand la séparation est
// inactive, qu'une place manque à un tour — aucun plan n'assied chacun —, ou
// sans table : rien ne le prouve.
function collisionPartout(instance, placesManquantes) {
  const { N, T, R, capacite, groupe, groupes, contraintes, present, presentsParTour } = instance;
  if (!contraintes.separerAppartenances || placesManquantes > 0 || T === 0) return false;
  const places = nombrePlaces(instance);
  let plusPetite = capacite[0];
  for (let t = 1; t < T; t += 1) if (capacite[t] < plusPetite) plusPetite = capacite[t];
  const vue = new Uint8Array(groupes.length);
  for (let r = 0; r < R; r += 1) {
    vue.fill(0);
    let appartenances = 0;
    let sansAppartenance = 0;
    for (let p = 0; p < N; p += 1) {
      if (present[p * R + r] === 0) continue;
      const g = groupe[p];
      if (g === SANS_GROUPE) sansAppartenance += 1;
      else if (vue[g] === 0) {
        vue[g] = 1;
        appartenances += 1;
      }
    }
    // La plus petite table reçoit le moins de personnes : elle décide du
    // tour.
    if (presentsParTour[r] - (places - plusPetite) <= appartenances + sansAppartenance) return false;
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
// configuration tendue, Σ c_t = N, sans partiellement fixé ni absence ; null
// ailleurs. Une absence laisse des sièges vides à un tour au moins, et la
// preuve qui suit ne tient plus.
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
  const { N, T, R, capacite, ancresParTable, statut, absences } = instance;
  if (absences > 0 || nombrePlaces(instance) !== N || statut.includes(STATUT.PARTIELLEMENT_FIXE)) return null;
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

// Planchers immédiats des objectifs (D16, A10). Au tour r, une personne
// servie qui n'est pas fixée occupe un siège libre d'une table dont
// l'objectif est en vigueur : P_r compte les couples possibles non fixés,
// L_r ces sièges libres, et les tours hors objectif du tour sont au moins
// max(0, P_r − L_r), rendu par tour dans parTour ; leur somme sur les tours
// est le plancher des tours hors objectif. Un siège libre ne sert qu'une
// personne par tour : parmi C′, les concernées qu'aucune réservation ne
// sert, au moins #C′ − Σ_r min(L_r, P′_r) ne le sont jamais, P′_r comptant
// celles de C′ dont le tour r est possible — tous non fixés, un couple fixé
// possible étant servi. Le plus grand nombre de tours hors objectif d'une
// personne ne descend pas sous la moyenne : le premier plancher divisé par
// le nombre de personnes qui ont un tour possible non fixé, arrondi
// au-dessus. Les fixés ne comptent ni parmi les couples ni parmi les sièges
// libres. O(T · R + N · R) une fois les couples possibles connus. Rien ne
// lit l'état des critères : les planchers se chiffrent critère coché ou non.
function objectifsInevitables({ N, T, R, fixe, possible, objectifDe, siegesLibres }) {
  const parTour = new Array(R).fill(0);
  let servisAuPlus = 0;
  const libresAuTour = new Int32Array(R);
  for (let t = 0; t < T; t += 1) {
    for (let r = 0; r < R; r += 1) {
      if (objectifDe[t * R + r] !== SANS_OBJECTIF) libresAuTour[r] += siegesLibres[t * R + r];
    }
  }
  // Par personne : un couple possible fixé, qui la sert d'office ; un couple
  // possible non fixé, qui la fait compter dans P_r, et dans P′_r quand
  // aucune réservation ne la sert.
  const servieDOffice = new Uint8Array(N);
  const aUnTourLibre = new Uint8Array(N);
  for (let p = 0; p < N; p += 1) {
    for (let r = 0; r < R; r += 1) {
      if (possible[p * R + r] === 0) continue;
      if (fixe[p * R + r] === LIBRE) aUnTourLibre[p] = 1;
      else servieDOffice[p] = 1;
    }
  }
  let concerneesLibres = 0;
  let avecTourLibre = 0;
  for (let p = 0; p < N; p += 1) {
    if (aUnTourLibre[p] === 1) avecTourLibre += 1;
    if (aUnTourLibre[p] === 1 && servieDOffice[p] === 0) concerneesLibres += 1;
  }
  for (let r = 0; r < R; r += 1) {
    let couples = 0;
    let parmiC = 0;
    for (let p = 0; p < N; p += 1) {
      if (possible[p * R + r] === 0 || fixe[p * R + r] !== LIBRE) continue;
      couples += 1;
      if (servieDOffice[p] === 0) parmiC += 1;
    }
    parTour[r] = Math.max(0, couples - libresAuTour[r]);
    servisAuPlus += Math.min(libresAuTour[r], parmiC);
  }
  const horsObjectif = parTour.reduce((somme, plancher) => somme + plancher, 0);
  return {
    horsObjectif,
    jamaisServies: Math.max(0, concerneesLibres - servisAuPlus),
    horsObjectifMax: horsObjectif === 0 ? 0 : Math.ceil(horsObjectif / avecTourLibre),
    parTour,
  };
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
 * - placesManquantes : nombrePlacesManquantes, le plus grand manque d'un
 *   tour ; la recherche refuse une configuration où il est positif, le
 *   diagnostic le chiffre (§ 5.9) ; placesManquantesParTour, le manque de
 *   chaque tour sur ses présents.
 * - plafondAPriori : plafondsAPriori, son étendue et sa répartition par
 *   valeur.
 * - collisions : planchers de collisions par groupe, posés sur les tours
 *   fixés, capacités relâchées, sur les seuls membres présents à chaque
 *   tour ; chacun avec les tables qui l'annulent.
 * - redondanceMinimale : max_p max(0, min(a priori(p), affiliés autres que
 *   p) − G) ; remedes.toursSansRedondance, le nombre de tours qui l'annule.
 * - animateursMemeAppartenance, et redondanceImposeeParAnimateurs : la forme
 *   close min(R, T) − 1 du § 5.6, qui compte un animateur à chaque table
 *   visitée ; 0 quand les animateurs ne partagent pas une appartenance.
 * - uneSeuleAppartenance et collisionPartout : une séparation vide de sens,
 *   une collision forcée à chaque table de chaque tour, jugée sur les
 *   présents du tour.
 * - ancrage : ancrés, capacité, gel et demi-ancrage de chaque table.
 * - retoursImposes : la rangée de instance.fixe se lit comme le plan qui
 *   assied chacun aux seuls tours fixés, en réserve ailleurs ; sa mesure
 *   compte max(0, f − 1) retours pour f tours réservés à une même table, ce
 *   que mesure tout plan qui honore les réservations (§ 5.4) ;
 *   ancragesImposantRetours, les personnes qui en portent un au moins.
 * - ecartItineraire : plancher de l'écart d'itinéraire maximal, ou null ;
 *   null dès qu'une absence existe, et planchersRetires le nomme alors.
 * - presence : le nombre d'absences et les présents de chaque tour, lus
 *   dans l'instance, en listes neuves.
 * - objectifsInevitables : planchers immédiats des tours hors objectif, des
 *   personnes jamais servies et du plus de tours hors objectif d'une
 *   personne, nuls sans objectif ; l'interface écrit ceux que le mode
 *   compare. parTour porte le plancher de chaque tour, que le détail de la
 *   page de qualité lit sans le recompter (qualite.js).
 *   animateursMemeAppartenance garde son sens : les ancrés.
 *
 * @param {import('./types.js').Configuration} configuration
 * @param {{planchersCollisions?: typeof planchersCollisions}} [calcul]
 *        le chiffrage des planchers de collisions, planchersCollisions par
 *        défaut ; une épreuve y compte les appels
 * @returns {Diagnostic}
 */
export function diagnostiquer(configuration, { planchersCollisions: chiffrer = planchersCollisions } = {}) {
  const instance = normaliser(configuration);
  const aPriori = plafondsAPriori(instance);
  const memeAppartenance = animateursMemeAppartenance(instance);
  const placesManquantes = nombrePlacesManquantes(instance);
  const avecAbsences = instance.absences > 0;
  const minimale = redondanceMinimale(instance, aPriori);
  const imposes = mesurer(instance, instance.fixe);
  return {
    placesManquantes,
    plafondAPriori: {
      ...etendue(aPriori),
      parPersonne: aPriori,
      repartition: repartition(aPriori, instance.statut),
    },
    collisions: avecTablesManquantes(configuration, instance, chiffrer(instance), chiffrer),
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
    objectifsInevitables: objectifsInevitables(instance),
    placesManquantesParTour: placesManquantesParTour(instance),
    presence: { absences: instance.absences, presentsParTour: Array.from(instance.presentsParTour) },
    planchersRetires: avecAbsences ? ['ecartItineraire'] : [],
  };
}
