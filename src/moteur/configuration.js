// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Passage de la configuration, forme par identifiants, à l'instance indexée
// que consomme le moteur (§ 4, § 5.2), et conversion d'un plan entre ses deux
// formes (§ 8.9). Les formes sont décrites dans types.js.
//
// Ce module définit aussi, une seule fois pour tout le moteur (§ 13.2), ce
// que les autres modules lisent de ces formes : les valeurs du contrat —
// STATUT, LIBRE, RESERVE, SANS_GROUPE —, la garde de forme d'un plan indexé,
// le nombre de places d'un tour, et la répartition des personnes entre les
// trois populations du § 5.4. Les autres modules et leurs épreuves les
// importent, sans en redéfinir aucun.
//
// Trois familles de refus :
// - ErreurConfiguration, avec un code, pour ce qu'une saisie, un import ou un
//   plan périmé peut porter : une donnée incohérente avec le reste de la
//   configuration, ou une capacité, un nombre de tours, un tour désigné hors
//   de son domaine ;
// - TypeError, quand la configuration sort de l'une des formes que garantit
//   le code qui la bâtit — stockage, import, interface — et qu'aucune saisie
//   ne produit : un identifiant de participant ou de table qui n'est pas un
//   entier ≥ 1, une appartenance ni chaîne ni null, un exclu présent et non
//   booléen, une portée ni « tous » ni « tour », des contraintes qui ne sont
//   pas un objet de quatre booléens, une liste qui n'est pas un tableau. Ces
//   formes sont les seules que normaliser contrôle par TypeError ; une valeur
//   qui en sort est une faute de l'appelant, qu'aucune valeur par défaut ne
//   masque ;
// - RangeError, pour un plan indexé qui n'a pas la forme de l'instance : seul
//   le moteur produit cette forme, et l'écart y est une faute de code.
//
// Les champs que normaliser ne lit pas — nom, prénom, numéro de table — ne
// sont pas examinés. Aucune fonction ne modifie ce qu'elle reçoit.
import { ErreurConfiguration } from './erreurs.js';

/**
 * Statuts d'un participant (§ 4.2), valeurs de instance.statut. normaliser
 * les dérive des réservations ; aucun n'est déclaré. Un partiellement fixé
 * compte parmi les mobiles dans les populations du § 5.4.
 */
export const STATUT = Object.freeze({ MOBILE: 0, PARTIELLEMENT_FIXE: 1, ANCRE: 2 });

/** Case de instance.fixe sans table imposée. */
export const LIBRE = -1;

/**
 * Case d'un plan indexé : la réserve. Elle vaut LIBRE, et une rangée de
 * instance.fixe se lit ainsi comme le plan qui assied chacun à ses seuls
 * tours fixés et le laisse en réserve aux autres : le diagnostic mesure ce
 * plan, le plafond a priori part de cet itinéraire.
 */
export const RESERVE = -1;

/** instance.groupe d'un participant sans appartenance. */
export const SANS_GROUPE = -1;

// Case d'un plan indexé qu'indexerPlan n'a pas encore remplie ; jamais rendue.
const NON_PLACE = -2;

// Plus grand entier que représente un Int32Array : une capacité au-delà s'y
// tronquerait sans bruit.
const ENTIER_32_MAX = 2 ** 31 - 1;

const NOMS_CONTRAINTES = [
  'separerAppartenances',
  'nouveauxVoisins',
  'nouvelleTable',
  'varierAppartenances',
];

// Valeur citée dans un message : une chaîne s'écrit entre guillemets, pour
// ne pas se lire comme le nombre qu'elle contient.
const decrire = (valeur) => (typeof valeur === 'string' ? JSON.stringify(valeur) : String(valeur));

function exigerListe(valeur, nom) {
  if (!Array.isArray(valeur)) throw new TypeError(`configuration.${nom} : liste attendue`);
}

function exigerIdentifiant(id, quoi) {
  if (!Number.isInteger(id) || id < 1) {
    throw new TypeError(`${quoi} d'identifiant ${decrire(id)} : entier ≥ 1 attendu`);
  }
}

function exigerAppartenance({ id, appartenance }) {
  if (appartenance !== null && typeof appartenance !== 'string') {
    throw new TypeError(
      `participant ${id} : appartenance chaîne ou null attendue, reçu ${decrire(appartenance)}`,
    );
  }
}

// Vrai pour un participant exclu ; un champ exclu absent vaut false.
function estExclu({ id, exclu }) {
  if (exclu === undefined) return false;
  if (typeof exclu !== 'boolean') {
    throw new TypeError(`participant ${id} : exclu booléen attendu, reçu ${decrire(exclu)}`);
  }
  return exclu;
}

// Copie des quatre contraintes : une modification ultérieure de la
// configuration n'atteint pas l'instance.
function copierContraintes(contraintes) {
  if (typeof contraintes !== 'object' || contraintes === null) {
    throw new TypeError('configuration.contraintes : objet attendu');
  }
  const copie = {};
  for (const nom of NOMS_CONTRAINTES) {
    if (typeof contraintes[nom] !== 'boolean') {
      throw new TypeError(`contrainte ${nom} : booléen attendu, reçu ${decrire(contraintes[nom])}`);
    }
    copie[nom] = contraintes[nom];
  }
  return copie;
}

// Groupe de chaque participant présent, présents triés par identifiant
// croissant : un libellé reçoit le numéro de sa première apparition,
// SANS_GROUPE marque l'absence d'appartenance. L'égalité de chaînes fait le
// groupe. La Map ne sert qu'à retrouver un libellé déjà numéroté.
function numeroterGroupes(presents) {
  const groupe = new Int32Array(presents.length);
  const groupes = [];
  const numeroDe = new Map();
  for (let p = 0; p < presents.length; p += 1) {
    const { appartenance } = presents[p];
    if (appartenance === null) {
      groupe[p] = SANS_GROUPE;
      continue;
    }
    if (!numeroDe.has(appartenance)) {
      numeroDe.set(appartenance, groupes.length);
      groupes.push(appartenance);
    }
    groupe[p] = numeroDe.get(appartenance);
  }
  return { groupe, groupes };
}

// Tables imposées par les réservations : fixe[p * R + r] = index de table,
// LIBRE sinon. Chaque réservation est vérifiée dans sa forme — participant et
// table connus, tour dans 1..R —, exclus compris ; celle d'un exclu s'arrête
// là, suspendue, sans effet (§ 4.4). Une réservation qui répète la table déjà
// imposée au même tour ne change rien ; une autre table au même tour lève
// RESERVATION_CONFLIT.
function fixerReservations(reservations, contexte) {
  const { connus, indexDe, indexTableDe, idsTables, N, R } = contexte;
  const fixe = new Int32Array(N * R).fill(LIBRE);
  for (let i = 0; i < reservations.length; i += 1) {
    const { participant: id, table: idTable, portee, tour } = reservations[i];
    if (!connus.has(id)) {
      throw new ErreurConfiguration('RESERVATION_INCONNUE', { reservation: i, participant: id });
    }
    const t = indexTableDe.get(idTable);
    if (t === undefined) {
      throw new ErreurConfiguration('RESERVATION_INCONNUE', { reservation: i, table: idTable });
    }
    // Tours couverts, numérotés à partir de 0 : chacun des R tours pour la
    // portée « tous », le tour désigné pour la portée « tour ».
    let premier;
    let dernier;
    if (portee === 'tous') {
      premier = 0;
      dernier = R - 1;
    } else if (portee === 'tour') {
      if (!Number.isInteger(tour) || tour < 1 || tour > R) {
        throw new ErreurConfiguration('RESERVATION_TOUR', { reservation: i, tour });
      }
      premier = tour - 1;
      dernier = tour - 1;
    } else {
      throw new TypeError(
        `réservation ${i} : portée ${decrire(portee)}, « tous » ou « tour » attendue`,
      );
    }
    const p = indexDe.get(id);
    if (p === undefined) continue;
    for (let r = premier; r <= dernier; r += 1) {
      const imposee = fixe[p * R + r];
      if (imposee === LIBRE) {
        fixe[p * R + r] = t;
      } else if (imposee !== t) {
        throw new ErreurConfiguration('RESERVATION_CONFLIT', {
          participant: id,
          tour: r + 1,
          tables: [idsTables[imposee], idTable],
        });
      }
    }
  }
  return fixe;
}

// Lève SURRESERVATION quand, à un tour, une table reçoit plus de personnes
// fixées que de sièges (§ 5.9). Le compte porte sur les personnes, lues dans
// fixe : une réservation répétée ne compte qu'une fois. Les tables se
// parcourent par index, chacune par tours croissants.
function verifierSurreservation(fixe, { N, T, R, capacite, idsTables }) {
  const fixees = new Int32Array(T * R);
  for (let p = 0; p < N; p += 1) {
    for (let r = 0; r < R; r += 1) {
      const t = fixe[p * R + r];
      if (t !== LIBRE) fixees[t * R + r] += 1;
    }
  }
  for (let t = 0; t < T; t += 1) {
    for (let r = 0; r < R; r += 1) {
      if (fixees[t * R + r] > capacite[t]) {
        throw new ErreurConfiguration('SURRESERVATION', {
          table: idsTables[t],
          tour: r + 1,
          reservees: fixees[t * R + r],
          capacite: capacite[t],
        });
      }
    }
  }
}

// Statut de chaque participant, dérivé de fixe et non de la forme des
// réservations (§ 4.2) : ancré quand la même table est imposée à chacun des R
// tours, mobile quand aucune ne l'est, partiellement fixé sinon. Un ancré
// compte dans k et dans ancresParTable ; un partiellement fixé compte parmi
// les mobiles.
function deriverStatuts(fixe, N, T, R) {
  const statut = new Uint8Array(N);
  const ancresParTable = new Int32Array(T);
  let k = 0;
  for (let p = 0; p < N; p += 1) {
    const premiere = fixe[p * R];
    let memeTable = true;
    let aucune = true;
    for (let r = 0; r < R; r += 1) {
      const t = fixe[p * R + r];
      if (t !== premiere) memeTable = false;
      if (t !== LIBRE) aucune = false;
    }
    if (aucune) {
      statut[p] = STATUT.MOBILE;
    } else if (memeTable) {
      statut[p] = STATUT.ANCRE;
      ancresParTable[premiere] += 1;
      k += 1;
    } else {
      statut[p] = STATUT.PARTIELLEMENT_FIXE;
    }
  }
  return { statut, ancresParTable, k };
}

/**
 * Instance indexée d'une configuration (§ 4, § 5.2). Les participants exclus
 * en sont absents (§ 4.4) : ni index ni groupe, et leurs réservations,
 * suspendues, ne fixent rien et ne prennent aucun siège.
 *
 * Lève ErreurConfiguration sur la première règle enfreinte — participants,
 * puis tables, nombre de tours, réservations une à une, surréservation :
 * PARTICIPANT_DOUBLON, TABLE_DOUBLON, CAPACITE (non entière, < 2, ou au-delà
 * d'un Int32Array), TOURS (R non entier ou < 1), RESERVATION_INCONNUE
 * (participant ou table), RESERVATION_TOUR (tour absent ou hors de 1..R),
 * RESERVATION_CONFLIT (une personne à deux tables d'un même tour),
 * SURRESERVATION (plus de personnes fixées que de sièges à une table, à un
 * tour). Une salle trop petite n'est pas refusée : nombrePlacesManquantes la
 * chiffre, et la recherche la refuse (§ 5.9). Les détails désignent
 * participants et tables par identifiant, les tours par leur numéro à partir
 * de 1, et la réservation fautive par son rang dans
 * configuration.reservations, à partir de 0.
 *
 * Lève TypeError sur les seules formes qu'énumère l'en-tête du module :
 * identifiants de participant et de table, appartenance, exclu, portée,
 * contraintes, listes. Une capacité, un nombre de tours ou un tour désigné
 * hors de leur forme lèvent CAPACITE, TOURS ou RESERVATION_TOUR ; une
 * réservation qui désigne un participant ou une table absents de la
 * configuration lève RESERVATION_INCONNUE, quelle que soit la forme de la
 * valeur qui les désigne.
 *
 * @param {import('./types.js').Configuration} configuration
 * @returns {import('./types.js').Instance}
 */
export function normaliser(configuration) {
  const { participants, tables, tours: R, reservations } = configuration;
  exigerListe(participants, 'participants');
  exigerListe(tables, 'tables');
  exigerListe(reservations, 'reservations');
  const contraintes = copierContraintes(configuration.contraintes);

  // connus porte tous les identifiants, exclus compris : un doublon reste un
  // doublon, et la réservation d'un exclu n'est pas inconnue.
  const connus = new Set();
  const presents = [];
  const exclus = [];
  for (const participant of participants) {
    exigerIdentifiant(participant.id, 'participant');
    if (connus.has(participant.id)) {
      throw new ErreurConfiguration('PARTICIPANT_DOUBLON', { participant: participant.id });
    }
    connus.add(participant.id);
    exigerAppartenance(participant);
    if (estExclu(participant)) exclus.push(participant.id);
    else presents.push(participant);
  }
  presents.sort((a, b) => a.id - b.id);
  exclus.sort((a, b) => a - b);

  const T = tables.length;
  const idsTables = [];
  const indexTableDe = new Map();
  const capacite = new Int32Array(T);
  for (let t = 0; t < T; t += 1) {
    const { id, capacite: places } = tables[t];
    exigerIdentifiant(id, 'table');
    if (indexTableDe.has(id)) throw new ErreurConfiguration('TABLE_DOUBLON', { table: id });
    if (!Number.isInteger(places) || places < 2 || places > ENTIER_32_MAX) {
      throw new ErreurConfiguration('CAPACITE', { table: id, capacite: places });
    }
    idsTables.push(id);
    indexTableDe.set(id, t);
    capacite[t] = places;
  }

  if (!Number.isInteger(R) || R < 1) throw new ErreurConfiguration('TOURS', { tours: R });

  const N = presents.length;
  const ids = presents.map((participant) => participant.id);
  const indexDe = new Map(ids.map((id, p) => [id, p]));
  const { groupe, groupes } = numeroterGroupes(presents);
  const fixe = fixerReservations(reservations, { connus, indexDe, indexTableDe, idsTables, N, R });
  verifierSurreservation(fixe, { N, T, R, capacite, idsTables });
  const { statut, ancresParTable, k } = deriverStatuts(fixe, N, T, R);

  return {
    N,
    T,
    R,
    ids,
    indexDe,
    exclus: new Set(exclus),
    idsTables,
    indexTableDe,
    capacite,
    groupe,
    groupes,
    fixe,
    statut,
    ancresParTable,
    k,
    n: N - k,
    contraintes,
  };
}

/**
 * Plan indexé d'un plan par identifiants : tableDe[p * R + r] = index de
 * table, −1 pour la réserve. plan.tables déclare chaque table de l'instance
 * une fois, et chaque liste se rattache à sa table par l'identifiant déclaré
 * à la même position ; l'ordre des tables et celui des ids dans une liste
 * sont indifférents. Un plan accepté revient donc de planDepuisIndex à
 * l'identique, à ces deux ordres près.
 *
 * La forme indexée n'a pas de case pour un participant absent d'un tour,
 * placé deux fois ou étranger à l'instance, ni pour une table que le plan ne
 * déclare pas : au lieu de perdre l'écart, indexerPlan lève
 * ErreurConfiguration — PLAN_TOURS (tours ou réserves en nombre ≠ R),
 * PLAN_TABLE_INCONNUE, PLAN_TABLE_DOUBLON, PLAN_TABLE_ABSENTE (une table de
 * l'instance que plan.tables ne déclare pas), PLAN_LISTES (un tour sans
 * exactement une liste par table déclarée), PLAN_INCONNU, PLAN_EXCLU_PLACE
 * (participant exclu de l'instance), PLAN_DOUBLE_PLACE (deux fois dans un
 * tour, réserve comprise), PLAN_NON_ASSIS (ni à une table ni en réserve à un
 * tour). Les capacités et les réservations ne sont pas examinées.
 *
 * @param {import('./types.js').Instance} instance
 * @param {import('./types.js').Plan} plan
 * @returns {Int32Array}
 */
export function indexerPlan(instance, plan) {
  const { N, T, R, ids, idsTables, indexDe, indexTableDe, exclus } = instance;
  if (plan.tours.length !== R || plan.reserves.length !== R) {
    throw new ErreurConfiguration('PLAN_TOURS', {
      attendu: R,
      tours: plan.tours.length,
      reserves: plan.reserves.length,
    });
  }
  // Index de table de chaque liste, par position dans plan.tables.
  const tableDeListe = [];
  const declarees = new Set();
  for (const id of plan.tables) {
    const t = indexTableDe.get(id);
    if (t === undefined) throw new ErreurConfiguration('PLAN_TABLE_INCONNUE', { table: id });
    if (declarees.has(id)) throw new ErreurConfiguration('PLAN_TABLE_DOUBLON', { table: id });
    declarees.add(id);
    tableDeListe.push(t);
  }
  // Sans id inconnu ni doublon, une table manque exactement quand le plan en
  // déclare moins que l'instance ; la première absente, dans l'ordre de
  // l'instance, est nommée.
  if (tableDeListe.length !== T) {
    const absente = idsTables.find((id) => !declarees.has(id));
    throw new ErreurConfiguration('PLAN_TABLE_ABSENTE', { table: absente });
  }

  const tableDe = new Int32Array(N * R).fill(NON_PLACE);
  const placer = (id, r, t) => {
    const p = indexDe.get(id);
    if (p === undefined) {
      const code = exclus.has(id) ? 'PLAN_EXCLU_PLACE' : 'PLAN_INCONNU';
      throw new ErreurConfiguration(code, { participant: id, tour: r + 1 });
    }
    if (tableDe[p * R + r] !== NON_PLACE) {
      throw new ErreurConfiguration('PLAN_DOUBLE_PLACE', { participant: id, tour: r + 1 });
    }
    tableDe[p * R + r] = t;
  };
  for (let r = 0; r < R; r += 1) {
    const listes = plan.tours[r];
    if (listes.length !== tableDeListe.length) {
      throw new ErreurConfiguration('PLAN_LISTES', {
        tour: r + 1,
        listes: listes.length,
        tables: tableDeListe.length,
      });
    }
    for (let i = 0; i < listes.length; i += 1) {
      for (const id of listes[i]) placer(id, r, tableDeListe[i]);
    }
    for (const id of plan.reserves[r]) placer(id, r, RESERVE);
    for (let p = 0; p < N; p += 1) {
      if (tableDe[p * R + r] === NON_PLACE) {
        throw new ErreurConfiguration('PLAN_NON_ASSIS', { participant: ids[p], tour: r + 1 });
      }
    }
  }
  return tableDe;
}

/**
 * La garde de forme d'un plan indexé, la seule du moteur : planDepuisIndex,
 * mesurer et plafondsRealises l'appellent avant de lire une case. Lève
 * RangeError quand tableDe n'a pas N × R cases, ou qu'une case n'est ni
 * RESERVE ni un index de table entier de 0 à T − 1. Le message nomme alors
 * le participant, par identifiant, le tour et la valeur de la première case
 * fautive dans l'ordre des cases, p × R + r croissant ; une chaîne s'y cite
 * entre guillemets, pour ne pas se lire comme le nombre qu'elle contient.
 *
 * Sans elle, une case de trop serait ignorée, et une chaîne numérique comme
 * "0" assiérait la personne à la table qu'elle désigne là où une
 * comparaison stricte à instance.fixe n'y reconnaîtrait pas sa réservation.
 *
 * @param {import('./types.js').Instance} instance
 * @param {ArrayLike<number>} tableDe
 */
export function exigerPlanIndexe({ N, T, R, ids }, tableDe) {
  if (tableDe.length !== N * R) {
    throw new RangeError(`plan indexé de ${tableDe.length} cases, N × R = ${N * R} attendues`);
  }
  for (let i = 0; i < tableDe.length; i += 1) {
    const t = tableDe[i];
    if (t !== RESERVE && !(Number.isInteger(t) && t >= 0 && t < T)) {
      throw new RangeError(
        `plan indexé : participant ${ids[Math.floor(i / R)]}, tour ${(i % R) + 1}, `
          + `index de table ${decrire(t)} hors de −1..${T - 1}`,
      );
    }
  }
}

/**
 * Plan par identifiants d'un plan indexé : les tables dans l'ordre de
 * l'instance, chaque liste de table et chaque réserve en ids croissants
 * (§ 8.9). Lève ce que lève exigerPlanIndexe.
 *
 * @param {import('./types.js').Instance} instance
 * @param {ArrayLike<number>} tableDe
 * @returns {import('./types.js').Plan}
 */
export function planDepuisIndex(instance, tableDe) {
  exigerPlanIndexe(instance, tableDe);
  const { N, T, R, ids, idsTables } = instance;
  const tours = [];
  const reserves = [];
  for (let r = 0; r < R; r += 1) {
    const listes = Array.from({ length: T }, () => []);
    const reserve = [];
    // Les ids croissent avec l'index : parcourir les participants par index
    // range chaque liste en ids croissants, sans tri.
    for (let p = 0; p < N; p += 1) {
      const t = tableDe[p * R + r];
      if (t === RESERVE) reserve.push(ids[p]);
      else listes[t].push(ids[p]);
    }
    tours.push(listes);
    reserves.push(reserve);
  }
  return { tables: [...idsTables], tours, reserves };
}

/**
 * Places qu'offre chaque tour : Σ c_t, la somme des capacités. Ni les
 * participants ni les réservations n'y entrent. Le nombre de places
 * manquantes et le diagnostic d'une salle tendue la lisent ici.
 *
 * @param {import('./types.js').Instance} instance  T et capacite sont lus
 * @returns {number}
 */
export function nombrePlaces({ T, capacite }) {
  let places = 0;
  for (let t = 0; t < T; t += 1) places += capacite[t];
  return places;
}

/**
 * Places qui manquent à chaque tour pour asseoir tous les participants :
 * max(0, N − Σ c_t). La quantité égale max(0, n − Σ (c_t − a_t)) et ne
 * dépend d'aucune réservation (§ 5.9) : un ancré retire une personne des
 * mobiles et un siège de la capacité libre, un partiellement fixé reste
 * parmi les mobiles et ne retire rien.
 *
 * @param {import('./types.js').Instance} instance
 * @returns {number}
 */
export function nombrePlacesManquantes(instance) {
  return Math.max(0, instance.N - nombrePlaces(instance));
}

/**
 * Replie valeurs[p] sur les trois populations du § 5.4, en un passage, dans
 * l'ordre canonique : chacun compte dans « tous », puis parmi les ancrés, ou
 * parmi les mobiles, partiellement fixés compris. C'est le seul endroit qui
 * range une personne dans sa population : les agrégats des indicateurs et
 * les chiffres du manque le lisent tous deux.
 *
 * replier(cumul, valeur) rend le cumul suivant sans modifier celui qu'il
 * reçoit : les trois populations partent du même initial, et une population
 * sans membre le garde.
 *
 * @template C
 * @param {ArrayLike<*>} valeurs  une par personne, dans l'ordre de instance.ids
 * @param {ArrayLike<number>} statut  instance.statut
 * @param {C} initial
 * @param {function(C, *): C} replier
 * @returns {{tous: C, mobiles: C, ancres: C}}
 */
export function replierParPopulation(valeurs, statut, initial, replier) {
  let tous = initial;
  let mobiles = initial;
  let ancres = initial;
  for (let p = 0; p < valeurs.length; p += 1) {
    const valeur = valeurs[p];
    tous = replier(tous, valeur);
    if (statut[p] === STATUT.ANCRE) ancres = replier(ancres, valeur);
    else mobiles = replier(mobiles, valeur);
  }
  return { tous, mobiles, ancres };
}
