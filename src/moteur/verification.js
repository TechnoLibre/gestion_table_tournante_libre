// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les deux vérificateurs du moteur (§ 14.12), du code de l'application et non
// du code d'épreuve (§ 14.15) : verifierInvariants juge un plan contre
// l'instance, verifierIndicateurs les mesures et les plafonds de chacun
// (§ 12.3). Aucun des deux ne lève sur un défaut du contenu : chaque défaut
// est une violation de la liste rendue, et la liste vide dit que tout tient.
// Aucun ne modifie ce qu'il reçoit. Les formes reçues sont décrites dans
// types.js.
import { LIBRE, decrire } from './configuration.js';

/**
 * @typedef {{code: string, participant?: number, table?: number, tour?: number,
 *            detail?: string}} Violation   ids, tours numérotés à partir de 1
 *
 * @typedef {{code: string, index?: number, groupe?: number,
 *            tour?: number}} ViolationIndicateur
 *          index : rang de la personne dans l'ordre canonique, celui de
 *          instance.ids ; absent d'une violation qui porte sur un total.
 *          groupe : rang de l'appartenance dans instance.groupes, à partir
 *          de 0 ; tour : numéroté à partir de 1. Seuls les restes les portent
 *
 * @typedef {Object} ComplementsIndicateurs   ce que la page de qualité ajoute
 * @property {boolean} planchersValides  vrai quand le plan assoit chacun à
 *           chaque tour et honore les réservations : les planchers n'y valent
 *           que là (§ 12.4)
 * @property {ArrayLike<number>|null} planchersCollisions  plancher des
 *           collisions cumulées par appartenance, ordre de instance.groupes,
 *           0 quand le diagnostic se tait
 * @property {Array<{hors: number|null, plancher: number|null}>|null}
 *           objectifsParTour  un élément par tour ; un tour sans couple
 *           possible porte hors et plancher tous deux null, et la garde ne
 *           le lit pas
 * @property {ArrayLike<number>|null} phiAffilies  Φ_aff(p), borneDiversite
 * @property {ArrayLike<number>|null} aMax         A_max(p), borneDiversite
 */

// Index de table d'une liste que plan.tables ne rattache à aucune table de
// l'instance. Aucune case de instance.fixe ne le porte : une réservation ne
// s'honore jamais dans une telle liste.
const SANS_TABLE = -2;

// Index de table de chaque position de plan.tables : celui de l'id déclaré
// quand c'est sa première déclaration et une table de l'instance, SANS_TABLE
// sinon. Ajoute à violations, dans l'ordre de plan.tables, un TABLE_INCONNUE
// 'inconnue' à la première déclaration d'un id étranger à l'instance, et un
// 'doublon' à la deuxième déclaration d'un id de l'instance : un id de table
// déclaré plusieurs fois se signale une seule fois, en 'doublon' s'il
// appartient à l'instance, en 'inconnue' sinon. Ajoute ensuite un 'absente'
// par table de l'instance non déclarée, dans l'ordre de l'instance. Les
// ensembles ne servent qu'à retrouver un id déjà vu.
function rattacherListes(tables, { idsTables, indexTableDe }, violations) {
  const tableDeListe = [];
  const declarees = new Set();
  const doublons = new Set();
  for (const id of tables) {
    const t = indexTableDe.get(id);
    if (!declarees.has(id)) {
      declarees.add(id);
      if (t === undefined) violations.push({ code: 'TABLE_INCONNUE', table: id, detail: 'inconnue' });
      tableDeListe.push(t ?? SANS_TABLE);
      continue;
    }
    if (t !== undefined && !doublons.has(id)) {
      doublons.add(id);
      violations.push({ code: 'TABLE_INCONNUE', table: id, detail: 'doublon' });
    }
    tableDeListe.push(SANS_TABLE);
  }
  for (const id of idsTables) {
    if (!declarees.has(id)) violations.push({ code: 'TABLE_INCONNUE', table: id, detail: 'absente' });
  }
  return tableDeListe;
}

// Les réserves imposées marquées, [p × R + r] → 1 quand la personne p est
// imposée en réserve au tour r ; lève ce que verifierInvariants annonce
// pour une liste mal formée.
function marquerReservesImposees(reservesImposees, { N, R, indexDe }) {
  if (!Array.isArray(reservesImposees)) throw new TypeError('reservesImposees : liste attendue');
  const marque = new Uint8Array(N * R);
  for (const entree of reservesImposees) {
    if (entree === null || typeof entree !== 'object') throw new TypeError('reservesImposees : {participant, tour} attendu');
    const { participant, tour } = entree;
    const p = indexDe.get(participant);
    if (p === undefined) throw new RangeError(`reservesImposees : personne ${decrire(participant)} hors de l'instance`);
    if (!Number.isInteger(tour) || tour < 1 || tour > R) throw new RangeError(`reservesImposees : tour ${decrire(tour)} hors de 1..${R}`);
    marque[p * R + tour - 1] = 1;
  }
  return marque;
}

/**
 * Violations d'un plan par identifiants (§ 8.9), jugé contre l'instance
 * (§ 14.12). Code de l'application : appelé après une génération, après un
 * retour arrière, au chargement d'un fichier. Rend la liste des violations,
 * vide si le plan tient.
 *
 * Codes :
 * - TOURS : plan.tours ou plan.reserves n'a pas R entrées ;
 * - TABLE_INCONNUE : les tables du plan ne reprennent pas celles de
 *   l'instance. detail précise le cas : 'inconnue', un id de plan.tables
 *   étranger à l'instance ; 'doublon', un id que plan.tables déclare plus
 *   d'une fois ; 'absente', une table de l'instance que plan.tables ne
 *   déclare pas ; ces trois-là portent table. 'listes', un tour qui n'a pas
 *   une liste par table déclarée, porte tour. L'ordre de plan.tables est
 *   libre ;
 * - INCONNU : un id ni participant ni exclu de l'instance, à une table ou en
 *   réserve ;
 * - EXCLU_PLACE : un participant exclu, à une table ou en réserve ;
 * - DOUBLE_PLACE : un participant présent plus d'une fois dans un tour,
 *   réserve comprise ;
 * - NON_ASSIS : un participant présent au tour que le plan ne place nulle
 *   part, que la réserve soit permise ou non, ou présent seulement en
 *   réserve quand reserveAutorisee est faux. La réserve est une liste du
 *   plan (§ 8.9) : un participant qui ne figure ni à une table ni en réserve
 *   manque au plan, il n'attend pas. Une réserve imposée en réserve à son
 *   tour n'en relève pas ;
 * - ABSENT_PLACE : un participant absent du tour (instance.present), listé à
 *   une table ou en réserve. Un absent omis du tour est en règle, et ne
 *   relève jamais de NON_ASSIS ni de RESERVATION ;
 * - CAPACITE : une liste plus longue que la capacité de sa table. Le siège
 *   est la position dans la liste : chaque entrée en occupe un, et le siège
 *   au-delà de la capacité est hors de sa table ;
 * - RESERVATION : un participant que instance.fixe impose à une table à un
 *   tour, placé ailleurs à ce tour, à une autre table ou en réserve ; table
 *   nomme la table imposée. La règle ne dépend pas de reserveAutorisee : le
 *   réservé présent seulement en réserve reçoit RESERVATION que la réserve
 *   soit permise ou non, précédée de NON_ASSIS quand elle est interdite. Ce
 *   sont deux règles enfreintes : l'asseoir à une autre table lèverait la
 *   première et non la seconde. Un participant présent que le plan ne place
 *   nulle part ne relève que de NON_ASSIS. Une réservation suspendue par une
 *   absence ne se lit pas : instance.fixe vaut LIBRE à ce tour. Une réserve
 *   imposée en réserve à son tour n'en relève pas ; assise à une table, elle
 *   se contrôle comme les autres.
 *
 * Une liste se rattache à la table que plan.tables déclare à sa position,
 * quand cette déclaration est la première d'un id de l'instance. Une liste
 * sans table de l'instance (id étranger, doublon, position au-delà de
 * plan.tables) n'entre dans aucune capacité ; ses occupants sont placés à une
 * table, donc pas NON_ASSIS, et aucune réservation ne s'y honore. Une table
 * déclarée sans liste à un tour est vide à ce tour. Seuls les tours que le
 * plan porte en entier, listes et réserve, et dont le numéro ne dépasse pas R
 * sont lus : un tour manquant ou incomplet n'est signalé que par TOURS.
 *
 * Un id étranger à l'instance se signale une fois par tour où il figure, et
 * DOUBLE_PLACE ne concerne que les participants. Un id de table déclaré
 * plusieurs fois se signale une seule fois : en 'doublon' s'il appartient à
 * l'instance, en 'inconnue' sinon.
 *
 * Les violations se rangent dans l'ordre de lecture : TOURS ; les ids de
 * plan.tables dans leur ordre, puis les tables absentes dans l'ordre de
 * l'instance ; puis chaque tour lu, par ordre croissant : son nombre de
 * listes ; les ids des listes dans l'ordre déclaré puis ceux de la réserve,
 * un id étranger à sa première apparition dans le tour et DOUBLE_PLACE à la
 * seconde ; les capacités, liste par liste ; enfin les participants par id
 * croissant, chacun avec son NON_ASSIS puis sa RESERVATION, ou, absent du
 * tour, son ABSENT_PLACE. Un absent listé deux fois reçoit donc DOUBLE_PLACE
 * au comptage, avant son ABSENT_PLACE.
 *
 * Lève TypeError quand reservesImposees n'est pas une liste d'objets, et
 * RangeError quand une entrée désigne une personne hors de l'instance ou un
 * tour qui n'est pas un entier de 1 à R : la liste vient du moteur ou de
 * l'application, et l'écart est une faute de code.
 *
 * @param {import('./types.js').Instance} instance
 * @param {import('./types.js').Plan} plan
 * @param {{reserveAutorisee?: boolean,
 *          reservesImposees?: Array<{participant: number, tour: number}>}} [options]
 *        reserveAutorisee, faux par défaut : un participant présent seulement
 *        en réserve est NON_ASSIS (§ 12.6). reservesImposees, vide par
 *        défaut : les présentes qu'un tour figé d'un départ laisse en
 *        réserve (recherche.js, DepartRecherche), par identifiant et tour
 * @returns {Violation[]}
 */
export function verifierInvariants(instance, plan, { reserveAutorisee = false, reservesImposees = [] } = {}) {
  const { N, R, ids, indexDe, exclus, idsTables, capacite, fixe, present } = instance;
  const imposee = marquerReservesImposees(reservesImposees, instance);
  const violations = [];
  if (plan.tours.length !== R || plan.reserves.length !== R) violations.push({ code: 'TOURS' });
  const tableDeListe = rattacherListes(plan.tables, instance, violations);

  // Par participant, au tour lu : ses présences, réserve comprise ; sa
  // présence à une table ; sa présence à la table que fixe lui impose.
  const presences = new Int32Array(N);
  const aUneTable = new Uint8Array(N);
  const aSaTable = new Uint8Array(N);
  const lus = Math.min(R, plan.tours.length, plan.reserves.length);
  for (let r = 0; r < lus; r += 1) {
    const tour = r + 1;
    const listes = plan.tours[r];
    if (listes.length !== tableDeListe.length) {
      violations.push({ code: 'TABLE_INCONNUE', tour, detail: 'listes' });
    }
    presences.fill(0);
    aUneTable.fill(0);
    aSaTable.fill(0);

    // Compte une présence de id à ce tour et rend son index ; −1 pour un id
    // étranger à l'instance, signalé à sa première apparition dans le tour.
    const etrangers = new Set();
    const compter = (id) => {
      const p = indexDe.get(id);
      if (p === undefined) {
        if (!etrangers.has(id)) {
          etrangers.add(id);
          violations.push({ code: exclus.has(id) ? 'EXCLU_PLACE' : 'INCONNU', participant: id, tour });
        }
        return -1;
      }
      presences[p] += 1;
      if (presences[p] === 2) violations.push({ code: 'DOUBLE_PLACE', participant: id, tour });
      return p;
    };
    for (let i = 0; i < listes.length; i += 1) {
      const t = i < tableDeListe.length ? tableDeListe[i] : SANS_TABLE;
      for (const id of listes[i]) {
        const p = compter(id);
        if (p < 0) continue;
        aUneTable[p] = 1;
        if (fixe[p * R + r] === t) aSaTable[p] = 1;
      }
    }
    for (const id of plan.reserves[r]) compter(id);

    for (let i = 0; i < listes.length && i < tableDeListe.length; i += 1) {
      const t = tableDeListe[i];
      if (t !== SANS_TABLE && listes[i].length > capacite[t]) {
        violations.push({ code: 'CAPACITE', table: idsTables[t], tour });
      }
    }

    for (let p = 0; p < N; p += 1) {
      if (present[p * R + r] === 0) {
        if (presences[p] > 0) violations.push({ code: 'ABSENT_PLACE', participant: ids[p], tour });
        continue;
      }
      if (imposee[p * R + r] === 1 && presences[p] > 0 && !aUneTable[p]) continue;
      if (!aUneTable[p] && (presences[p] === 0 || !reserveAutorisee)) {
        violations.push({ code: 'NON_ASSIS', participant: ids[p], tour });
      }
      const table = fixe[p * R + r];
      if (table !== LIBRE && presences[p] > 0 && !aSaTable[p]) {
        violations.push({ code: 'RESERVATION', participant: ids[p], table: idsTables[table], tour });
      }
    }
  }
  return violations;
}

// Vrai quand gauche ≥ droite et que les deux sont des nombres : NaN, ou une
// valeur d'un autre type, fait tomber l'inégalité au lieu d'y être convertie.
const tient = (gauche, droite) =>
  typeof gauche === 'number' && typeof droite === 'number' && gauche >= droite;

// Lève TypeError quand valeurs n'a pas de longueur, n'étant pas une liste,
// et RangeError quand elle n'a pas N cases. attendu nomme ce que le paramètre
// nom admet.
function exigerLongueur(valeurs, N, nom, attendu) {
  if (typeof valeurs?.length !== 'number') throw new TypeError(`${nom} : ${attendu} attendue`);
  if (valeurs.length !== N) {
    throw new RangeError(`${nom} : ${valeurs.length} cases, ${N} attendues comme mesures.rencontres`);
  }
}

// Les dépassements de la diversité d'une personne, ajoutés à violations,
// quand la garde a ses compléments : A(p) ≤ rencontres(p), A(p) ≤ |F(p)|,
// |F(p)| ≤ Φ_aff(p), A(p) ≤ A_max(p), les deux derniers quand la borne est
// donnée. complements vaut null sans compléments.
function verifierDiversite(p, rencontres, mesures, complements, violations) {
  if (complements === null) return;
  const { appartenancesVues: vues, affilies } = mesures;
  if (!tient(rencontres[p], vues[p])) violations.push({ code: 'DIVERSITE_RENCONTRES', index: p });
  if (!tient(affilies[p], vues[p])) violations.push({ code: 'DIVERSITE_AFFILIES', index: p });
  const { phiAffilies, aMax } = complements;
  if (phiAffilies !== null && !tient(phiAffilies[p], affilies[p])) violations.push({ code: 'AFFILIES_PLAFOND', index: p });
  if (aMax !== null && !tient(aMax[p], vues[p])) violations.push({ code: 'BORNE_DIVERSITE', index: p });
}

// Les compléments lus, chacun null quand il manque ; null sans compléments.
// Lève TypeError quand complements n'est ni un objet ni null, que
// planchersValides n'est pas un booléen, qu'une liste attendue n'en est pas
// une, qu'un élément de objectifsParTour n'est pas un objet, ou que mesures
// n'a pas les listes que les compléments font lire ;
// RangeError quand une liste n'a pas la longueur de sa population : N pour
// les personnes, mesures.parGroupe pour les appartenances.
function lireComplements(complements, mesures, N) {
  if (complements === null) return null;
  if (typeof complements !== 'object') throw new TypeError('complements : objet ou null attendu');
  const { planchersValides, planchersCollisions = null, objectifsParTour = null } = complements;
  const { phiAffilies = null, aMax = null } = complements;
  if (typeof planchersValides !== 'boolean') throw new TypeError('complements.planchersValides : booléen attendu');
  exigerLongueur(mesures.appartenancesVues, N, 'appartenancesVues', 'liste');
  exigerLongueur(mesures.affilies, N, 'affilies', 'liste');
  if (phiAffilies !== null) exigerLongueur(phiAffilies, N, 'phiAffilies', 'liste ou null');
  if (aMax !== null) exigerLongueur(aMax, N, 'aMax', 'liste ou null');
  if (planchersCollisions !== null) {
    if (!Array.isArray(mesures.parGroupe)) throw new TypeError('parGroupe : liste attendue avec planchersCollisions');
    if (planchersCollisions.length !== mesures.parGroupe.length) {
      throw new RangeError(
        `planchersCollisions : ${planchersCollisions.length} cases, ${mesures.parGroupe.length} attendues comme parGroupe`,
      );
    }
  }
  if (objectifsParTour !== null) {
    if (!Array.isArray(objectifsParTour)) throw new TypeError('objectifsParTour : liste ou null attendue');
    objectifsParTour.forEach((element, r) => {
      if (element === null || typeof element !== 'object') {
        throw new TypeError(`objectifsParTour[${r}] : objet attendu, {hors, plancher}`);
      }
    });
  }
  return { planchersValides, planchersCollisions, objectifsParTour, phiAffilies, aMax };
}

// Les restes négatifs, ajoutés à violations, sur un plan où les planchers
// valent : collisions cumulées sous leur plancher, appartenance par
// appartenance, puis hors objectif sous leur plancher, tour par tour. Un
// tour dont hors et plancher sont tous deux null est sans objet et passe ;
// un seul des deux null fait tomber l'inégalité, comme toute non-valeur.
function verifierRestes(complements, parGroupe, violations) {
  if (complements === null || !complements.planchersValides) return;
  const { planchersCollisions, objectifsParTour } = complements;
  if (planchersCollisions !== null) {
    for (let g = 0; g < planchersCollisions.length; g += 1) {
      if (!tient(parGroupe[g].collisionsCumulees, planchersCollisions[g])) {
        violations.push({ code: 'RESTE_NEGATIF', groupe: g });
      }
    }
  }
  if (objectifsParTour !== null) {
    for (let r = 0; r < objectifsParTour.length; r += 1) {
      const { hors, plancher } = objectifsParTour[r];
      if (hors === null && plancher === null) continue;
      if (!tient(hors, plancher)) violations.push({ code: 'RESTE_OBJECTIFS_NEGATIF', tour: r + 1 });
    }
  }
}

// Les dépassements des objectifs et des animateurs d'une personne (§ 5.4,
// A9), ajoutés à violations : s(p) ≤ P(p), s(p) ≤ tours assis, m(p) ≤ B(p).
// P(p) ne se compare pas aux tours assis : un plan édité qui laisse une
// personne en réserve à un tour possible tient P(p) au-delà.
function verifierPersonne(p, { toursAssis, objectifs, animateurs }, violations) {
  if (objectifs !== null) {
    if (!tient(objectifs.possibles[p], objectifs.tours[p])) violations.push({ code: 'TOURS_SERVIS', index: p });
    if (!tient(toursAssis[p], objectifs.tours[p])) violations.push({ code: 'TOURS_SERVIS_NON_ASSIS', index: p });
  }
  if (animateurs !== null && !tient(animateurs.bornes[p], animateurs.rencontres[p])) {
    violations.push({ code: 'ANIMATEURS_RENCONTRES', index: p });
  }
}

/**
 * Garde du § 12.3 : éprouve, pour chacun, la ligne de décomposition du
 * § 12.10.5, N − 1 ≥ plafond a priori ≥ plafond réalisé ≥ rencontres, une
 * inégalité entre deux termes voisins à la fois ; ensemble, elles ordonnent
 * toute la ligne. Une violation désigne un calcul faux, sur lequel le profil
 * ne se dessine pas.
 *
 * Quand les mesures portent les objectifs des tables ou les animateurs, non
 * null (A9), elle éprouve aussi, pour chacun, les tours servis contre ses
 * tours possibles (TOURS_SERVIS) et ses tours assis (TOURS_SERVIS_NON_ASSIS),
 * les animateurs rencontrés contre la borne (ANIMATEURS_RENCONTRES) ; puis,
 * sur les totaux, sans index, les personnes jamais servies contre les
 * concernées (JAMAIS_SERVIES) et le plus de tours hors objectif d'une
 * personne contre le plus de tours possibles (HORS_OBJECTIF_MAX). Une mesure
 * absente se lit comme null : seule la liste rencontres est exigée.
 *
 * Avec ses compléments, que seule la page de qualité lui passe (§ 12.3, D42),
 * elle éprouve en plus, pour chacun, A(p) ≤ rencontres(p)
 * (DIVERSITE_RENCONTRES), A(p) ≤ |F(p)| (DIVERSITE_AFFILIES), |F(p)| ≤
 * Φ_aff(p) (AFFILIES_PLAFOND) et A(p) ≤ A_max(p) (BORNE_DIVERSITE), A(p) et
 * |F(p)| lus dans mesures.appartenancesVues et mesures.affilies, les deux
 * derniers seulement quand la borne est donnée ; puis, sur un plan où les
 * planchers valent, que le reste n'est jamais négatif : les collisions
 * cumulées de chaque appartenance, mesures.parGroupe, au moins son plancher
 * (RESTE_NEGATIF, groupe), et les tours hors objectif de chaque tour au moins
 * le sien (RESTE_OBJECTIFS_NEGATIF, tour), un tour sans couple possible,
 * hors et plancher null, n'étant pas lu. Un complément null n'est pas lu.
 * Sans compléments, null ou absents, la sortie est celle des trois premiers
 * paramètres seuls.
 *
 * Les trois listes suivent l'ordre canonique, celui de instance.ids, et N est
 * la longueur de mesures.rencontres. plafondsAPriori vaut null quand le
 * plafond a priori est inconnu (§ 12.6) : la ligne perd ce terme, et seule la
 * chaîne N − 1 ≥ réalisé ≥ rencontres est éprouvée. Une inégalité ne tient
 * qu'entre deux nombres : NaN, ou une valeur d'un autre type, la fait tomber
 * au lieu d'y être convertie.
 *
 * Codes : PLAFOND_A_PRIORI (a priori > N − 1), ORDRE_PLAFONDS (a priori <
 * réalisé), PLAFOND_REALISE (réalisé > N − 1, a priori inconnu), DEPASSEMENT
 * (rencontres > réalisé). La fonction ne reçoit pas les identifiants : une
 * violation désigne la personne par index, son rang dans l'ordre canonique,
 * que instance.ids[index] traduit. Les violations se rangent par index
 * croissant, puis de gauche à droite sur la ligne, suivie des dépassements
 * de la personne, puis de sa diversité ; les deux violations des totaux
 * viennent ensuite, et les restes en dernier, appartenances puis tours.
 *
 * Lève RangeError quand une liste de plafonds, ou une liste par personne des
 * objectifs, des animateurs ou des tours assis, n'a pas N cases : elle décrit
 * une autre population, et l'écart est une faute de code. Lève TypeError
 * quand plafondsRealises n'est pas une liste, ou plafondsAPriori ni une liste
 * ni null : seul null dit l'a priori inconnu. undefined, la valeur d'un champ
 * manquant, ne passe pas pour lui : il ôterait deux inégalités à la garde
 * sans rien signaler.
 *
 * @param {{rencontres: ArrayLike<number>, toursAssis?: ArrayLike<number>,
 *          objectifs?: Object|null, animateurs?: Object|null}} mesures
 *        les mesures d'un plan ; toursAssis n'est lu qu'avec les objectifs
 * @param {ArrayLike<number>|null} plafondsAPriori
 * @param {ArrayLike<number>} plafondsRealises
 * @param {ComplementsIndicateurs|null} [complements]
 * @returns {ViolationIndicateur[]}
 */
export function verifierIndicateurs(mesures, plafondsAPriori, plafondsRealises, complements = null) {
  const { rencontres } = mesures;
  const N = rencontres.length;
  exigerLongueur(plafondsRealises, N, 'plafondsRealises', 'liste');
  if (plafondsAPriori !== null) exigerLongueur(plafondsAPriori, N, 'plafondsAPriori', 'liste ou null');
  const lus = lireComplements(complements, mesures, N);
  const lues = { toursAssis: mesures.toursAssis, objectifs: mesures.objectifs ?? null, animateurs: mesures.animateurs ?? null };
  if (lues.objectifs !== null) {
    exigerLongueur(lues.objectifs.tours, N, 'objectifs.tours', 'liste');
    exigerLongueur(lues.objectifs.possibles, N, 'objectifs.possibles', 'liste');
    exigerLongueur(lues.toursAssis, N, 'toursAssis', 'liste');
  }
  if (lues.animateurs !== null) {
    exigerLongueur(lues.animateurs.rencontres, N, 'animateurs.rencontres', 'liste');
    exigerLongueur(lues.animateurs.bornes, N, 'animateurs.bornes', 'liste');
  }
  const violations = [];
  for (let p = 0; p < N; p += 1) {
    const realise = plafondsRealises[p];
    if (plafondsAPriori === null) {
      if (!tient(N - 1, realise)) violations.push({ code: 'PLAFOND_REALISE', index: p });
    } else {
      const aPriori = plafondsAPriori[p];
      if (!tient(N - 1, aPriori)) violations.push({ code: 'PLAFOND_A_PRIORI', index: p });
      if (!tient(aPriori, realise)) violations.push({ code: 'ORDRE_PLAFONDS', index: p });
    }
    if (!tient(realise, rencontres[p])) violations.push({ code: 'DEPASSEMENT', index: p });
    verifierPersonne(p, lues, violations);
    verifierDiversite(p, rencontres, mesures, lus, violations);
  }
  if (lues.objectifs !== null) {
    const { jamaisServies, concernes, horsObjectifMax, possibles } = lues.objectifs;
    if (!tient(concernes, jamaisServies)) violations.push({ code: 'JAMAIS_SERVIES' });
    const plusDePossibles = Array.prototype.reduce.call(possibles, (plus, n) => Math.max(plus, n), 0);
    if (!tient(plusDePossibles, horsObjectifMax)) violations.push({ code: 'HORS_OBJECTIF_MAX' });
  }
  verifierRestes(lus, mesures.parGroupe, violations);
  return violations;
}
