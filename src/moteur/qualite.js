// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le détail d'un placement pour la page de qualité (§ 12, D27) : le profil
// trié des rencontres et sa répartition, les bornes des tuiles, les barres
// des collisions jointes à leurs planchers, le mélange des organisations à
// chaque table, les objectifs tour par tour, le profil des animateurs. Ces
// mesures décrivent un placement à la fois ; aucune n'entre dans la
// recherche, le classement ni le tableau des propositions, et rien de rendu
// n'est un tableau typé.
//
// Le détail ne recompte rien (§ 13.2) : les comptes par paire, par table et
// par tour sortent de parcourirTours (indicateurs.js), l'occupation de
// occupations (plafond.js), les planchers du diagnostic (diagnostic.js), les
// valeurs par personne des mesures et des plafonds que l'appelant passe,
// comme les trois chiffres de la ligne d'évaluation du plan (manque.js).
// Chaque pourcentage sort de pourcentage, la seule division d'un
// pourcentage (D52), et se rend à côté de ses deux comptes.
//
// Une personne est désignée par son index canonique, son rang dans
// instance.ids, et une table par son index dans l'instance : l'index suit
// l'identifiant, si bien qu'un ordre par index croissant est l'ordre par
// identifiant croissant. La traduction en identifiants revient à
// l'application.
import { STATUT, decrire } from './configuration.js';
import { diversiteAnimateurs } from './diversite.js';
import { parcourirTours } from './indicateurs.js';
import { manques, profilManque, teteDuManque } from './manque.js';
import { matriceRencontres, pairesRepetees } from './paires.js';
import { borneDiversite, occupations } from './plafond.js';

/**
 * @typedef {Object} LigneProfil
 * @property {number} p                 index canonique
 * @property {number} rencontres
 * @property {number} plafondRealise
 * @property {number|null} pourcent     rencontres sur plafond réalisé ;
 *                                      null à plafond nul
 * @property {number|null} plafondAPriori  null quand il est inconnu
 * @property {number} organisations     A(p)
 * @property {number} affilies          |F(p)|
 * @property {number} borneDiversite    A_max(p)
 * @property {number} toursNonAssis     tours de présence passés en réserve
 * @property {number} toursAbsents      tours où la personne est absente,
 *                                      R − tours de présence
 * @property {'ancre'|'partiel'|'reserve'|'absente'|'plafondNul'|null} marque
 *
 * @typedef {Object} TroisComptes
 * @property {number} sieges     c_t − δ_{t,r}
 * @property {number} assis      o_{t,r} − δ_{t,r}
 * @property {number} doublons   α_{t,r} − δ_{t,r}
 *
 * @typedef {Object} CaseMelange
 * @property {number} occupants      o_{t,r}
 * @property {number} affilies       α_{t,r}
 * @property {number} organisations  δ_{t,r}
 * @property {TroisComptes} comptes
 * @property {{sieges: number, assis: number, doublons: number}} pourcents
 *           δ sur c, sur o, sur α
 */

// Les trois positions du sélecteur du mélange des tables (D35), dans
// l'ordre où les objets du détail les portent.
const POSITIONS = Object.freeze(['sieges', 'assis', 'doublons']);

// Le nom du statut d'une personne (§ 4.2), celui de l'interface.
const NOM_DU_STATUT = Object.freeze(['mobile', 'partiel', 'ancre']);

// Vrai pour un entier positif ou nul.
const estCompte = (valeur) => Number.isInteger(valeur) && valeur >= 0;

// Lève RangeError quand la liste n'a pas une case par personne de
// l'instance : elle décrit une autre population.
function exigerParPersonne(liste, N, nom) {
  if (liste.length !== N) throw new RangeError(`${nom} : ${liste.length} cases, ${N} attendues`);
}

/**
 * Le pourcentage de n sur d (§ 5.4, D52) : la partie entière de 100 · n / d,
 * portée à 1 quand 0 < n < d — jamais 0 % tant que le compte n'est pas nul ;
 * la partie entière ne rend jamais 100 sous d, si bien qu'aucun manque ne
 * s'écrit 100 %. 0 à numérateur nul, 100 au numérateur égal au dénominateur,
 * null quand d vaut 0 : la page écrit « — ». Au-delà du dénominateur, qu'un
 * calcul faux seul produit et que la garde refuse (§ 12.3), le quotient
 * entier, au-dessus de 100, que rien ne ramène dans les bornes.
 *
 * La division se fait sur des entiers : 100 · n moins son reste, divisé par
 * d, est exact.
 *
 * @param {number} n   entier positif ou nul
 * @param {number} d   entier positif ou nul
 * @returns {number|null}
 */
export function pourcentage(n, d) {
  if (!estCompte(n) || !estCompte(d)) {
    throw new RangeError(`pourcentage de ${decrire(n)} sur ${decrire(d)} : deux entiers positifs ou nuls attendus`);
  }
  if (d === 0) return null;
  const centuple = 100 * n;
  const quotient = (centuple - (centuple % d)) / d;
  return n > 0 && quotient === 0 ? 1 : quotient;
}

// La marque d'un rang du profil (§ 12.3, B12) : la première qui s'applique,
// ancré, partiellement fixé, en réserve à un tour de présence au moins,
// absente à un tour au moins, plafond réalisé nul ; null sinon. La réserve,
// qui appelle un geste, passe avant l'absence, qui est une donnée.
function marqueDe(statut, toursNonAssis, toursAbsents, plafondRealise) {
  if (statut === STATUT.ANCRE) return 'ancre';
  if (statut === STATUT.PARTIELLEMENT_FIXE) return 'partiel';
  if (toursNonAssis > 0) return 'reserve';
  if (toursAbsents > 0) return 'absente';
  if (plafondRealise === 0) return 'plafondNul';
  return null;
}

/**
 * Le profil trié des rencontres (§ 12.3, D28) : une ligne par personne,
 * rencontres croissantes, puis plafond réalisé décroissant — à rencontres
 * égales, le plus grand manque d'abord —, puis index croissant. Le
 * pourcentage de la ligne se lit dans cet ordre (D51) et n'en décide rien.
 * Les tours non assis sont les tours de présence passés en réserve, et les
 * tours absents les autres : le plan indexé range l'absent à la réserve, et
 * toursAssis ne compte que des tours de présence.
 *
 * Lève RangeError quand une liste n'a pas une case par personne.
 *
 * @param {import('./types.js').Instance} instance  N, R, statut et
 *        toursPresents sont lus
 * @param {import('./indicateurs.js').Mesures} mesures
 * @param {ArrayLike<number>} plafondsRealises
 * @param {ArrayLike<number>|null} plafondsAPriori  null quand il est inconnu
 * @param {ArrayLike<number>} aMax   borneDiversite(instance, tableDe).aMax
 * @returns {LigneProfil[]}
 */
export function profilRencontres(instance, mesures, plafondsRealises, plafondsAPriori, aMax) {
  const { N, R, statut, toursPresents } = instance;
  exigerParPersonne(plafondsRealises, N, 'plafondsRealises');
  if (plafondsAPriori !== null) exigerParPersonne(plafondsAPriori, N, 'plafondsAPriori');
  exigerParPersonne(aMax, N, 'aMax');
  const { rencontres, organisationsVues, affilies, toursAssis } = mesures;
  const lignes = [];
  for (let p = 0; p < N; p += 1) {
    const toursNonAssis = toursPresents[p] - toursAssis[p];
    const toursAbsents = R - toursPresents[p];
    lignes.push({
      p,
      rencontres: rencontres[p],
      plafondRealise: plafondsRealises[p],
      pourcent: pourcentage(rencontres[p], plafondsRealises[p]),
      plafondAPriori: plafondsAPriori === null ? null : plafondsAPriori[p],
      organisations: organisationsVues[p],
      affilies: affilies[p],
      borneDiversite: aMax[p],
      toursNonAssis,
      toursAbsents,
      marque: marqueDe(statut[p], toursNonAssis, toursAbsents, plafondsRealises[p]),
    });
  }
  // Les lignes entrent par index croissant, et le tri est stable : à
  // rencontres et plafond égaux, l'index croissant reste.
  return lignes.sort((a, b) => a.rencontres - b.rencontres || b.plafondRealise - a.plafondRealise);
}

/**
 * La répartition d'une valeur par personne (§ 12.3) : une ligne par valeur
 * présente, de la plus basse à la plus haute, avec son effectif, l'effectif
 * cumulé jusqu'à elle, et le nombre de personnes à leur plafond — valeurs[i]
 * égale à plafonds[i] —, null quand plafonds l'est.
 *
 * Lève RangeError quand plafonds n'a pas la longueur de valeurs.
 *
 * @param {ArrayLike<number>} valeurs
 * @param {ArrayLike<number>|null} [plafonds]
 * @returns {Array<{valeur: number, effectif: number, cumul: number, auPlafond: number|null}>}
 */
export function repartition(valeurs, plafonds = null) {
  if (plafonds !== null) exigerParPersonne(plafonds, valeurs.length, 'plafonds');
  const rangs = Array.from({ length: valeurs.length }, (_, i) => i);
  rangs.sort((i, j) => valeurs[i] - valeurs[j]);
  const lignes = [];
  for (const i of rangs) {
    let ligne = lignes[lignes.length - 1];
    if (ligne === undefined || ligne.valeur !== valeurs[i]) {
      ligne = { valeur: valeurs[i], effectif: 0, cumul: 0, auPlafond: plafonds === null ? null : 0 };
      lignes.push(ligne);
    }
    ligne.effectif += 1;
    if (plafonds !== null && valeurs[i] === plafonds[i]) ligne.auPlafond += 1;
  }
  let cumul = 0;
  for (const ligne of lignes) {
    cumul += ligne.effectif;
    ligne.cumul = cumul;
  }
  return lignes;
}

/**
 * La phrase de synthèse du profil (§ 12.3, B12) : le minimum des rencontres,
 * l'effectif à ce minimum, et l'effectif sous son plafond réalisé, lus dans
 * le profil trié, dont le premier rang porte le minimum. Un profil vide rend
 * un minimum null.
 *
 * @param {LigneProfil[]} profil   profilRencontres
 * @returns {{minimum: number|null, effectifAuMinimum: number, effectifSousPlafond: number}}
 */
export function synthese(profil) {
  const minimum = profil.length === 0 ? null : profil[0].rencontres;
  let effectifAuMinimum = 0;
  let effectifSousPlafond = 0;
  for (const { rencontres, plafondRealise } of profil) {
    if (rencontres === minimum) effectifAuMinimum += 1;
    if (rencontres < plafondRealise) effectifSousPlafond += 1;
  }
  return { minimum, effectifAuMinimum, effectifSousPlafond };
}

// Le premier index p de 0..N − 1 où estCandidat(p) est vrai, selon avant(p,
// q), vrai quand p précède q ; null sans candidat. Les index se parcourent
// croissants : à égalité, le plus petit reste.
function premier(N, estCandidat, avant) {
  let tete = null;
  for (let p = 0; p < N; p += 1) {
    if (estCandidat(p) && (tete === null || avant(p, tete))) tete = p;
  }
  return tete;
}

/**
 * La tête des colonnes de la comparaison (§ 12.10.6, D67, D83) : les trois
 * chiffres dont la tuile porte un pourcentage (§ 12.2), chacun le pire cas
 * du placement, lus dans les seules mesures et plafonds réalisés de sa ligne
 * d'évaluation — ni profil, ni objectifs par tour, ni diagnostic :
 * - rang1 : la personne au rang 1 du profil des rencontres, au tri du profil
 *   (rencontres croissantes, plafond réalisé décroissant, index croissant,
 *   D28), ses rencontres, son plafond réalisé et leur pourcentage, null à
 *   plafond réalisé nul ; sans plafond a priori, que la ligne ne connaît
 *   pas ; null sans personne ;
 * - objectifs : au plus petit s(p) des concernées, P(p) > 0, à égalité les
 *   tours possibles les plus nombreux, puis l'index, la personne, ses servis,
 *   ses possibles et leur pourcentage ; null sans personne concernée ;
 * - soiree : Σ_p s(p) sur Σ_p P(p) — la somme des tours, Σ_r S_r sur Σ_r Π_r,
 *   un servi ayant son couple possible —, leur pourcentage, jamais une
 *   moyenne des personnes, et les personnes jamais servies de la mesure ;
 *   null sans personne concernée.
 * Personnes par index canonique.
 *
 * Lève RangeError quand mesures.rencontres ou plafondsRealises n'a pas une
 * case par personne.
 *
 * @param {import('./types.js').Instance} instance  N est lu
 * @param {import('./indicateurs.js').Mesures} mesures  rencontres et
 *        objectifs sont lus
 * @param {ArrayLike<number>} plafondsRealises
 * @returns {{rang1: {p: number, rencontres: number, plafondRealise: number, pourcent: number|null}|null,
 *            objectifs: {p: number, servis: number, possibles: number, pourcent: number|null}|null,
 *            soiree: {servis: number, possibles: number, pourcent: number|null, jamaisServies: number}|null}}
 */
export function teteDesColonnes(instance, mesures, plafondsRealises) {
  const { N } = instance;
  const { rencontres } = mesures;
  exigerParPersonne(rencontres, N, 'mesures.rencontres');
  exigerParPersonne(plafondsRealises, N, 'plafondsRealises');
  const r1 = premier(
    N,
    () => true,
    (x, y) => rencontres[x] < rencontres[y] || (rencontres[x] === rencontres[y] && plafondsRealises[x] > plafondsRealises[y]),
  );
  const rang1 =
    r1 === null
      ? null
      : { p: r1, rencontres: rencontres[r1], plafondRealise: plafondsRealises[r1], pourcent: pourcentage(rencontres[r1], plafondsRealises[r1]) };

  let objectifs = null;
  let soiree = null;
  if (mesures.objectifs !== null) {
    const { tours: s, possibles: P, jamaisServies } = mesures.objectifs;
    const p = premier(N, (x) => P[x] > 0, (x, y) => s[x] < s[y] || (s[x] === s[y] && P[x] > P[y]));
    objectifs = { p, servis: s[p], possibles: P[p], pourcent: pourcentage(s[p], P[p]) };
    let servis = 0;
    let possibles = 0;
    for (let q = 0; q < N; q += 1) {
      servis += s[q];
      possibles += P[q];
    }
    soiree = { servis, possibles, pourcent: pourcentage(servis, possibles), jamaisServies };
  }
  return { rang1, objectifs, soiree };
}

/**
 * Les bornes des tuiles (§ 12.2, D29, D34, D52, B11), chacune celle d'une
 * personne nommée, et les planchers, qui ne nomment personne :
 * - rang1 : la personne au rang 1 du profil, ses rencontres, son plafond
 *   réalisé, son plafond a priori et leur pourcentage ; null sans personne ;
 *   teteDesColonnes le donne, et le profil y ajoute le plafond a priori ;
 * - manque : la tête du profil de manque (teteDuManque, § 12.10.6), son
 *   plafond réalisé et l'effectif au manque maximal, sans pourcentage ;
 *   null sans personne ;
 * - diversite : au plus petit A(p), à égalité la plus grande borne de
 *   diversité, puis l'index — le tri du profil sur A(p) —, la personne et
 *   sa borne, sans pourcentage ; null sans organisation présente ;
 * - animateurs : le rang 1 du profil des animateurs et sa borne B(p), sans
 *   pourcentage ; null sans personne concernée ;
 * - objectifs : au plus petit s(p) des concernées, à égalité les tours
 *   possibles les plus nombreux, puis l'index, la personne, ses servis, ses
 *   possibles et leur pourcentage ; null sans personne concernée ;
 * - soiree : Σ S_r, Σ Π_r et leur pourcentage, et les personnes jamais
 *   servies de la mesure ; null sans personne concernée ;
 * - planchers : le plancher de chaque tuile qui en porte un, le même
 *   pour toute personne (planchersDe).
 * rang1, objectifs et soiree sont ceux de teteDesColonnes, que les colonnes
 * de la comparaison lisent aussi : une seule arithmétique pour les tuiles et
 * pour les colonnes.
 *
 * @param {import('./types.js').Instance} instance  N, ids, indexDe, statut,
 *        groupes et etatCriteres sont lus
 * @param {{mesures: import('./indicateurs.js').Mesures,
 *          plafondsRealises: ArrayLike<number>, aMax: ArrayLike<number>,
 *          profil: LigneProfil[], animateurs: Array<Object>|null,
 *          diagnostic: import('./diagnostic.js').Diagnostic,
 *          planchersValides: boolean,
 *          troisChiffres: import('./manque.js').TroisChiffres}} lus
 *        profil, profilRencontres ; animateurs, profilAnimateurs ;
 *        diagnostic, celui de la
 *        configuration ; planchersValides, vrai sur un plan du domaine des
 *        planchers ; troisChiffres, ceux que la ligne d'évaluation du plan
 *        porte, lus sans être recomptés
 */
export function bornesDesTuiles(instance, lus) {
  const { mesures, plafondsRealises, aMax, profil, animateurs } = lus;
  const { N, indexDe, groupes } = instance;
  const tete = teteDesColonnes(instance, mesures, plafondsRealises);
  let rang1 = null;
  let manque = null;
  if (tete.rang1 !== null) {
    // Le profil suit le tri de teteDesColonnes : son premier rang est la
    // même personne, dont il porte le plafond a priori.
    const { p, rencontres, plafondRealise, pourcent } = tete.rang1;
    rang1 = { p, rencontres, plafondRealise, plafondAPriori: profil[0].plafondAPriori, pourcent };
    const { id, plafondRealise: plafondManque, effectif } = teteDuManque(
      profilManque(instance, manques(plafondsRealises, mesures.rencontres), plafondsRealises),
    );
    manque = { p: indexDe.get(id), plafondRealise: plafondManque, effectif };
  }

  let diversite = null;
  if (groupes.length > 0) {
    const A = mesures.organisationsVues;
    const p = premier(N, () => true, (x, y) => A[x] < A[y] || (A[x] === A[y] && aMax[x] > aMax[y]));
    diversite = { p, aMax: aMax[p] };
  }

  return {
    rang1,
    manque,
    diversite,
    animateurs: animateurs === null ? null : { p: animateurs[0].p, borne: animateurs[0].borne },
    objectifs: tete.objectifs,
    soiree: tete.soiree,
    planchers: planchersDe(instance, lus),
  };
}

// Un plancher strictement positif et la valeur mesurée qu'il borne :
// {plancher, atteint}, atteint quand la valeur l'égale ; null pour un
// plancher nul, que le diagnostic ne prouve pas, ou absent (null).
const plancherDe = (plancher, valeur) => (plancher > 0 ? { plancher, atteint: valeur === plancher } : null);

// La somme d'un champ des planchers de collisions du diagnostic, un par
// organisation en collision ; un champ null compte pour 0.
const sommeDe = (collisions, champ) => collisions.reduce((total, ligne) => total + (ligne[champ] ?? 0), 0);

// Les colonnes de collisions, chacune avec le champ qui porte son plancher
// dans chaque ligne de diagnostic.collisions ; la mesure porte la valeur
// sous le nom de la colonne.
const COLONNES_DE_COLLISIONS = [
  ['collisionsCumulees', 'plancherCumulees'],
  ['pairesDistinctes', 'plancherPairesDistinctes'],
  ['excedentCollisions', 'plancherExcedent'],
];

// Le nom du critère des objectifs dans instance.etatCriteres, et, pour
// chaque valeur qu'il peut comparer, sous le nom de sa colonne, le champ
// qui la porte dans objectifsInevitables comme dans mesures.objectifs.
const CRITERE_DES_OBJECTIFS = 'toursHorsObjectif';
const CHAMPS_DES_OBJECTIFS = [
  ['jamaisServies', 'jamaisServies'],
  ['horsObjectifMax', 'horsObjectifMax'],
  ['toursHorsObjectif', 'horsObjectif'],
];

// Les sept colonnes qui peuvent porter un plancher, chacune sans plancher,
// dans l'ordre où le détail et les colonnes les rendent.
const aucunPlancher = () => ({
  collisionsCumulees: null,
  pairesDistinctes: null,
  excedentCollisions: null,
  ecartItineraireMax: null,
  jamaisServies: null,
  horsObjectifMax: null,
  toursHorsObjectif: null,
});

/**
 * Les planchers prouvés des colonnes (§ 5.6, § 12.2, D84), communs à tous
 * les placements d'une configuration : lus dans son diagnostic, une fois,
 * avant d'être confrontés aux mesures de chaque placement
 * (planchersAtteints). Sous le nom de chaque colonne (§ 5.7) :
 * - collisionsCumulees, pairesDistinctes, excedentCollisions : la somme des
 *   planchers de chaque organisation en collision ; chaque mesure somme
 *   celles des organisations, et chaque plancher minore la sienne ; 0 quand
 *   le diagnostic n'en nomme aucune ;
 * - ecartItineraireMax : le plancher de l'écart d'itinéraire maximal, null
 *   quand le diagnostic n'en porte pas ;
 * - jamaisServies, horsObjectifMax, toursHorsObjectif : le plancher de
 *   chaque valeur que le critère des objectifs compare sous le mode réglé,
 *   0 quand il est nul, null pour une valeur que le mode ne compare pas ;
 *   tous null quand le critère est décoché ou sans objet, qui ne compare
 *   rien.
 * Un plancher est un nombre là où la tuile peut en porter un, null là où
 * elle n'en porte jamais.
 *
 * @param {import('./types.js').Instance} instance  etatCriteres est lu
 * @param {import('./diagnostic.js').Diagnostic} diagnostic  celui de la
 *        configuration
 * @returns {{collisionsCumulees: number, pairesDistinctes: number, excedentCollisions: number,
 *            ecartItineraireMax: number|null, jamaisServies: number|null,
 *            horsObjectifMax: number|null, toursHorsObjectif: number|null}}
 */
export function planchersDesColonnes({ etatCriteres }, diagnostic) {
  const { collisions, ecartItineraire, objectifsInevitables } = diagnostic;
  const planchers = aucunPlancher();
  for (const [colonne, champ] of COLONNES_DE_COLLISIONS) planchers[colonne] = sommeDe(collisions, champ);
  if (ecartItineraire !== null) planchers.ecartItineraireMax = ecartItineraire.plancher;
  const critere = etatCriteres.find(({ nom }) => nom === CRITERE_DES_OBJECTIFS);
  if (critere.coche && !critere.sansObjet) {
    for (const [colonne, champ] of CHAMPS_DES_OBJECTIFS) {
      if (critere.valeurs.includes(colonne)) planchers[colonne] = objectifsInevitables[champ];
    }
  }
  return planchers;
}

/**
 * Les planchers des colonnes d'un placement, jugés atteints ou non (§ 12.2,
 * B11) : par colonne, {plancher, atteint} — atteint quand la valeur que la
 * tuile écrit l'égale — ou null, jamais 0 : pour un plancher nul, que le
 * diagnostic ne prouve pas, ou null. atteint compare au plancher la valeur
 * même que la tuile écrit, lue sans recompte : les mesures du placement, et
 * l'écart d'itinéraire maximal des trois chiffres de sa ligne d'évaluation,
 * null quand cette ligne n'en porte pas — plafond a priori inconnu, la tuile
 * écrit « inconnu ». Hors du domaine des planchers — un placement qui laisse
 * quelqu'un en réserve ou ne tient pas une réservation —, aucun ne tient :
 * tous null. Une colonne des objectifs sans plancher ne lit pas
 * mesures.objectifs, null sans personne concernée.
 *
 * @param {ReturnType<typeof planchersDesColonnes>} planchers
 * @param {{mesures: import('./indicateurs.js').Mesures,
 *          troisChiffres: import('./manque.js').TroisChiffres,
 *          planchersValides: boolean}} lus
 * @returns {Record<string, {plancher: number, atteint: boolean}|null>}
 *          les sept colonnes de planchersDesColonnes, dans son ordre
 */
export function planchersAtteints(planchers, { mesures, troisChiffres, planchersValides }) {
  const atteints = aucunPlancher();
  if (!planchersValides) return atteints;
  for (const [colonne] of COLONNES_DE_COLLISIONS) atteints[colonne] = plancherDe(planchers[colonne], mesures[colonne]);
  const { ecartItineraireMax } = troisChiffres;
  if (ecartItineraireMax !== null) atteints.ecartItineraireMax = plancherDe(planchers.ecartItineraireMax, ecartItineraireMax.tous);
  for (const [colonne, champ] of CHAMPS_DES_OBJECTIFS) {
    if (planchers[colonne] !== null) atteints[colonne] = plancherDe(planchers[colonne], mesures.objectifs[champ]);
  }
  return atteints;
}

// Le plancher de chaque tuile qui en porte un (§ 5.6, § 12.2, B11), sous le
// nom de sa colonne : les planchers des colonnes, lus dans le diagnostic de
// la configuration, jugés sur les mesures et les trois chiffres reçus.
function planchersDe(instance, lus) {
  return planchersAtteints(planchersDesColonnes(instance, lus.diagnostic), lus);
}

/**
 * Le plancher des collisions cumulées de chaque organisation (§ 5.6), dans
 * l'ordre de instance.groupes, lu dans le diagnostic : 0 pour une
 * organisation qu'il ne nomme pas, dont le plancher est nul. La forme que
 * barresCollisions et la garde (verifierIndicateurs) reçoivent.
 *
 * Lève RangeError quand le diagnostic nomme une organisation absente de
 * l'instance : il décrit une autre configuration.
 *
 * @param {import('./types.js').Instance} instance  groupes est lu
 * @param {Array<{groupe: string, plancherCumulees: number}>} collisions
 *        diagnostiquer(configuration).collisions
 * @returns {number[]}
 */
export function planchersParGroupe({ groupes }, collisions) {
  const rang = new Map(groupes.map((libelle, g) => [libelle, g]));
  const planchers = new Array(groupes.length).fill(0);
  for (const { groupe, plancherCumulees } of collisions) {
    const g = rang.get(groupe);
    if (g === undefined) throw new RangeError(`plancher d'une organisation absente : ${decrire(groupe)}`);
    planchers[g] = plancherCumulees;
  }
  return planchers;
}

/**
 * Les barres des collisions d'organisation (§ 12.4, D31, B13) : une ligne
 * par organisation, ses collisions cumulées, paires distinctes et excédent
 * lus dans mesures.parGroupe, et, sur le domaine des planchers, ses deux
 * segments : prouvé inévitable, le plancher du diagnostic, et le reste,
 * cumulées moins ce plancher. Hors du domaine — un plan qui laisse
 * quelqu'un en réserve ou ne tient pas une réservation —, prouve et reste
 * valent null. Les lignes vont de l'excédent le plus grand au plus petit,
 * puis des collisions cumulées décroissantes, puis par la clé normalisée de
 * l'organisation, puis par sa chaîne, comparées par unités de code.
 *
 * Lève RangeError quand planchers n'a pas une case par organisation.
 *
 * @param {import('./types.js').Instance} instance  groupes est lu
 * @param {import('./indicateurs.js').Mesures} mesures
 * @param {ArrayLike<number>} planchers   planchersParGroupe
 * @param {boolean} planchersValides
 * @param {(libelle: string) => string} cle  la clé normalisée (§ 10.1),
 *        que l'appelant fournit : le moteur n'importe pas le CSV
 * @returns {Array<{g: number, groupe: string, effectif: number, cumulees: number,
 *                  prouve: number|null, reste: number|null, pairesDistinctes: number,
 *                  excedent: number}>}
 */
export function barresCollisions(instance, mesures, planchers, planchersValides, cle) {
  const G = instance.groupes.length;
  if (planchers.length !== G) throw new RangeError(`planchers : ${planchers.length} cases, ${G} attendues`);
  const lignes = mesures.parGroupe.map(({ groupe, effectif, collisionsCumulees, pairesDistinctes, excedent }, g) => {
    const prouve = planchersValides ? planchers[g] : null;
    return {
      g,
      groupe,
      effectif,
      cumulees: collisionsCumulees,
      prouve,
      reste: prouve === null ? null : collisionsCumulees - prouve,
      pairesDistinctes,
      excedent,
    };
  });
  const cles = lignes.map(({ groupe }) => cle(groupe));
  const comparer = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  return lignes.sort(
    (a, b) => b.excedent - a.excedent || b.cumulees - a.cumulees || comparer(cles[a.g], cles[b.g]) || comparer(a.groupe, b.groupe),
  );
}

/**
 * Le mélange des organisations à chaque table (§ 12.11, D35, B20). Une
 * ligne par table, dans l'ordre de l'instance, et par tour une case : ses
 * occupants o, ses affiliés α, ses organisations distinctes δ, les trois
 * comptes — sièges c − δ, assis o − δ, doublons α − δ, emboîtés — et leurs
 * trois pourcentages, δ sur c, sur o, sur α. La case vaut null quand α est
 * nul, table vide comprise.
 *
 * Les doublons se lisent dans les collègues de parcourirTours : chaque
 * affilié assis après un premier membre de son organisation, dans l'ordre
 * des index, est le second terme d'une paire de collègues, si bien que les
 * seconds termes distincts sont α − δ, et un doublon est non nul exactement
 * là où la table compte une collision ce tour-là. Une personne sans
 * organisation n'en forme aucune.
 *
 * Par position, pire et somme sont le plus grand compte et la somme des
 * comptes des cases non null de la ligne ; ils valent null, tous deux,
 * quand chaque case l'est. ordres porte, par position, les index de lignes
 * de la pire à la meilleure : pire décroissant, puis somme décroissante,
 * puis l'ordre des tables, les lignes à pire null en dernier.
 *
 * Lève TypeError quand l'occupation ne porte pas les affiliés.
 *
 * @param {import('./types.js').Instance} instance
 * @param {ArrayLike<number>} tableDe
 * @param {{occupants: number[], affilies: number[]|null}} occupation
 *        occupations(instance, tableDe, {affilies: true})
 * @param {ReturnType<typeof parcourirTours>} [parcours]  le même plan, déjà lu
 * @returns {{lignes: Array<{t: number, capacite: number, tours: Array<CaseMelange|null>,
 *            pire: TroisComptes|null, somme: TroisComptes|null}>,
 *            ordres: {sieges: number[], assis: number[], doublons: number[]}}}
 */
export function mixTables(instance, tableDe, occupation, parcours = parcourirTours(instance, tableDe)) {
  const { N, T, R, capacite } = instance;
  if (occupation.affilies === null) throw new TypeError('occupation sans affiliés : occupations(instance, tableDe, {affilies: true}) attendue');
  const { occupants, affilies } = occupation;
  // vu[b] vaut le jeton de la case où b est déjà compté comme second terme.
  const vu = new Int32Array(N).fill(-1);
  const lignes = [];
  for (let t = 0; t < T; t += 1) {
    const c = capacite[t];
    const tours = [];
    let pire = null;
    let somme = null;
    for (let r = 0; r < R; r += 1) {
      const o = occupants[t * R + r];
      const a = affilies[t * R + r];
      if (a === 0) {
        tours.push(null);
        continue;
      }
      const jeton = t * R + r;
      let doublons = 0;
      for (const [, b] of parcours.parTour[r][t].collegues) {
        if (vu[b] === jeton) continue;
        vu[b] = jeton;
        doublons += 1;
      }
      const d = a - doublons;
      const comptes = { sieges: c - d, assis: o - d, doublons };
      tours.push({
        occupants: o,
        affilies: a,
        organisations: d,
        comptes,
        pourcents: { sieges: pourcentage(d, c), assis: pourcentage(d, o), doublons: pourcentage(d, a) },
      });
      if (pire === null) {
        pire = { ...comptes };
        somme = { ...comptes };
        continue;
      }
      for (const position of POSITIONS) {
        pire[position] = Math.max(pire[position], comptes[position]);
        somme[position] += comptes[position];
      }
    }
    lignes.push({ t, capacite: c, tours, pire, somme });
  }
  // Les rangs entrent dans l'ordre des tables, et le tri est stable : à
  // égalité, l'ordre des tables reste.
  const ordre = (position) => {
    const rangs = Array.from({ length: T }, (_, i) => i);
    return rangs.sort((i, j) => {
      const x = lignes[i];
      const y = lignes[j];
      if (x.pire === null || y.pire === null) return (x.pire === null) - (y.pire === null);
      return y.pire[position] - x.pire[position] || y.somme[position] - x.somme[position];
    });
  };
  return { lignes, ordres: { sieges: ordre('sieges'), assis: ordre('assis'), doublons: ordre('doublons') } };
}

/**
 * Les objectifs des tables tour par tour (§ 12.12, D36, B21), lus dans
 * parcourirTours et dans les planchers par tour du diagnostic, sans recompte.
 * Par tour : possibles, Π_r ; servis, S_r ; leur pourcentage ; hors, Π_r −
 * S_r ; plancher, le plancher du tour ; reste, hors − plancher, le second
 * segment de la barre du tour (B21) ; sansCouple, σ_r, les assis sans table
 * possible. Un tour sans couple possible a possibles 0, servis, pourcent,
 * hors, plancher et reste null, et garde sansCouple.
 *
 * pireTour : l'index du tour au plus grand reste, le premier à égalité.
 * soiree : les sommes des tours, Σ S_r sur Σ Π_r, la seule somme d'un
 * pourcentage admise (D52), et la somme des planchers.
 * jamaisServies : les concernées dont s(p) est nul, avec leurs tours
 * possibles, les plus nombreux d'abord, puis par index. repartition :
 * P(p) − s(p) sur les concernées, de la plus grande valeur à la plus petite.
 *
 * Rend null sans personne concernée. Lève RangeError quand planchers n'a pas
 * une case par tour.
 *
 * @param {import('./types.js').Instance} instance  N, R et possibles sont lus
 * @param {ReturnType<typeof parcourirTours>} parcours
 * @param {ArrayLike<number>} planchers
 *        diagnostiquer(configuration).objectifsInevitables.parTour
 */
export function objectifsParTour(instance, parcours, planchers) {
  const { N, R, possibles: P } = instance;
  if (planchers.length !== R) throw new RangeError(`planchers : ${planchers.length} cases, ${R} attendues`);
  const { servisParTour, possiblesParTour, assisSansCoupleParTour, servis: s } = parcours;
  const soiree = { possibles: 0, servis: 0, pourcent: null, hors: 0, plancher: 0 };
  const parTour = [];
  let pireTour = null;
  let pireReste = 0;
  for (let r = 0; r < R; r += 1) {
    const possibles = possiblesParTour[r];
    const sansCouple = assisSansCoupleParTour[r];
    if (possibles === 0) {
      parTour.push({ possibles, servis: null, pourcent: null, hors: null, plancher: null, reste: null, sansCouple });
      continue;
    }
    const servis = servisParTour[r];
    const hors = possibles - servis;
    const plancher = planchers[r];
    const reste = hors - plancher;
    parTour.push({ possibles, servis, pourcent: pourcentage(servis, possibles), hors, plancher, reste, sansCouple });
    soiree.possibles += possibles;
    soiree.servis += servis;
    soiree.hors += hors;
    soiree.plancher += plancher;
    if (pireTour === null || reste > pireReste) {
      pireTour = r;
      pireReste = reste;
    }
  }
  if (soiree.possibles === 0) return null;
  soiree.pourcent = pourcentage(soiree.servis, soiree.possibles);

  const jamaisServies = [];
  const horsParPersonne = [];
  for (let p = 0; p < N; p += 1) {
    if (P[p] === 0) continue;
    if (s[p] === 0) jamaisServies.push({ p, possibles: P[p] });
    horsParPersonne.push(P[p] - s[p]);
  }
  // Les personnes entrent par index croissant, et le tri est stable.
  jamaisServies.sort((a, b) => b.possibles - a.possibles);
  const lignes = repartition(horsParPersonne).reverse();
  return {
    parTour,
    pireTour,
    soiree,
    jamaisServies,
    repartition: lignes.map(({ valeur, effectif }) => ({ valeur, effectif })),
  };
}

/**
 * Le profil des animateurs rencontrés (§ 12.13, D37) : une ligne par
 * personne concernée, B(p) > 0, avec m(p), sa borne B(p) et son statut ; m(p)
 * croissant, puis la borne décroissante, puis l'index. Ni manque ni
 * pourcentage : la borne ne se garantit pas (§ 4.5). Rend null sans personne
 * concernée.
 *
 * @param {import('./types.js').Instance} instance  N et statut sont lus
 * @param {import('./indicateurs.js').Mesures} mesures
 * @returns {Array<{p: number, rencontres: number, borne: number,
 *                  statut: 'mobile'|'partiel'|'ancre'}>|null}
 */
export function profilAnimateurs({ N, statut }, mesures) {
  if (mesures.animateurs === null) return null;
  const { rencontres, bornes } = mesures.animateurs;
  const lignes = [];
  for (let p = 0; p < N; p += 1) {
    if (bornes[p] === 0) continue;
    lignes.push({ p, rencontres: rencontres[p], borne: bornes[p], statut: NOM_DU_STATUT[statut[p]] });
  }
  // Les lignes entrent par index croissant, et le tri est stable.
  return lignes.sort((a, b) => a.rencontres - b.rencontres || b.borne - a.borne);
}

/**
 * Le détail d'un placement (§ 12.9, D27), pour lui seul : parcourirTours et
 * occupations se lisent une fois chacun, et chaque partie en dérive.
 *
 * - profil, synthese, repartitionRencontres, bornes : profilRencontres et ce
 *   qu'on en tire, les planchers des tuiles lus dans le diagnostic sous
 *   planchersValides, jugés atteints sur les mesures et les trois chiffres
 *   reçus ;
 * - collisions : {planchersValides, lignes}, les barres, les planchers lus
 *   dans diagnostic.collisions ;
 * - tables : mixTables ; paires : pairesRepetees ;
 * - matrice : {ordre, comptes}, matriceRencontres dans ordreMatrice, une
 *   copie de la liste reçue ; null quand ordreMatrice l'est ;
 * - objectifs : objectifsParTour sur diagnostic.objectifsInevitables.parTour ;
 * - animateurs : {profil, repartition, diversite}, le profil des animateurs,
 *   la répartition de m(p) sur ses lignes, la diversité par animateur ;
 *   profil et repartition null sans personne concernée ; null en entier sans
 *   personne concernée ni animateur.
 *
 * aMax, la borne de diversité, se calcule quand l'appelant ne la passe pas ;
 * l'appelant qui la tient déjà pour la garde la passe. Ne rend que des
 * listes et des objets simples ; ne modifie ni l'instance ni le plan ; lève
 * ce que lèvent les fonctions qu'il appelle.
 *
 * @param {import('./types.js').Instance} instance
 * @param {ArrayLike<number>} tableDe
 * @param {{diagnostic: import('./diagnostic.js').Diagnostic,
 *          mesures: import('./indicateurs.js').Mesures,
 *          plafondsRealises: ArrayLike<number>,
 *          plafondsAPriori: ArrayLike<number>|null,
 *          troisChiffres: import('./manque.js').TroisChiffres,
 *          planchersValides: boolean,
 *          cle: (libelle: string) => string,
 *          ordreMatrice?: number[]|null,
 *          aMax?: ArrayLike<number>}} options
 */
export function detailler(instance, tableDe, options) {
  const { diagnostic, mesures, plafondsRealises, plafondsAPriori, troisChiffres, planchersValides, cle, ordreMatrice = null } = options;
  const aMax = options.aMax ?? borneDiversite(instance, tableDe).aMax;
  const parcours = parcourirTours(instance, tableDe);
  const occupation = occupations(instance, tableDe, { affilies: true });

  const profil = profilRencontres(instance, mesures, plafondsRealises, plafondsAPriori, aMax);
  const objectifs = objectifsParTour(instance, parcours, diagnostic.objectifsInevitables.parTour);
  const profilDesAnimateurs = profilAnimateurs(instance, mesures);
  const diversite = diversiteAnimateurs(instance, tableDe);
  const planchers = planchersParGroupe(instance, diagnostic.collisions);

  return {
    profil,
    synthese: synthese(profil),
    repartitionRencontres: repartition(mesures.rencontres, plafondsRealises),
    bornes: bornesDesTuiles(instance, {
      mesures,
      plafondsRealises,
      troisChiffres,
      aMax,
      profil,
      animateurs: profilDesAnimateurs,
      diagnostic,
      planchersValides,
    }),
    collisions: { planchersValides, lignes: barresCollisions(instance, mesures, planchers, planchersValides, cle) },
    tables: mixTables(instance, tableDe, occupation, parcours),
    paires: pairesRepetees(instance, tableDe, parcours),
    matrice: ordreMatrice === null ? null : { ordre: [...ordreMatrice], comptes: matriceRencontres(instance, tableDe, ordreMatrice, parcours) },
    objectifs,
    animateurs:
      profilDesAnimateurs === null && diversite.lignes.length === 0
        ? null
        : {
            profil: profilDesAnimateurs,
            repartition: profilDesAnimateurs === null ? null : repartition(profilDesAnimateurs.map(({ rencontres }) => rencontres)),
            diversite,
          },
  };
}
