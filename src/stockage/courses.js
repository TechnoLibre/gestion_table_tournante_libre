// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le compagnon des courses (§ 5.10, § 8.6, § 8.9) : le fichier
// <base>.gtt-courses.json, à côté du fichier d'état, qui garde la course de
// la recherche de chaque proposition — ses mouvements évalués et les
// placements de ses points de relevé. Ni le fichier d'état ni le journal
// ne la portent : la course pèse plusieurs fois la proposition, et l'écrire
// avec l'état ferait payer son poids à chaque geste. Le dépôt n'écrit le
// compagnon que quand l'ensemble des propositions change — génération,
// effacement, retour qui les rend ou les retire —, jamais à un autre geste.
//
// Le texte : une première ligne qui porte le format de ce fichier,
// FORMAT_COURSES, et l'identifiant de l'événement, puis une entrée par
// ligne, puis la fermeture. Une entrée porte l'identité de sa proposition —
// id, graine, arret, historique, l'horodatage de sa génération quand elle
// en a un, et l'empreinte de son placement — puis sa course, sous la règle
// ENTREE_DE_COURSE du schéma. Une entrée ne vaut que pour la proposition de
// la charge qui porte exactement cette identité : une entrée périmée,
// laissée par un effacement, une coupure ou une copie à la main, ne trouve
// pas sa proposition et s'ignore.
//
// Les quatre premiers champs ne suffisent pas : le compteur des
// propositions recule quand l'opérateur reprend un état d'avant une
// génération, et la graine proposée peut être la même. Après un changement
// qui laisse la déclaration intacte — une appartenance, une réservation, un
// réglage —, la recherche suivante porte alors les mêmes quatre champs et
// une autre course, qui finit sur un autre placement ou sur le même.
// L'horodatage les départage : la génération le pose une fois sur chaque
// proposition qu'elle ajoute, à la seconde de l'horloge qui la date
// (appliquerCommande), et les gestes suivants le gardent. Deux propositions
// de même clé portent ainsi les mêmes quatre champs, le même horodatage et
// la même empreinte : deux recherches ne s'y confondent que générées sous
// la même graine à la même seconde de leurs horloges, et finies sur le
// même placement à une collision d'empreinte près. Une proposition sans
// horodatage — d'un fichier écrit avant que la génération ne date ses
// propositions, ou d'une commande appliquée sans instant — n'a que les
// quatre champs et l'empreinte : deux recherches de même identité qui
// finissent sur le même placement s'y confondent, et l'une peut recevoir
// la course de l'autre. Une entrée sans horodatage ne vaut que pour une
// proposition sans horodatage, et l'inverse.
//
// Ce que le compagnon porte se dérive de la recherche : il n'est jamais une
// donnée de l'opérateur. Un compagnon absent, illisible, d'un autre format
// ou d'un autre événement, ou dont une entrée contredit sa proposition, ne
// refuse ni l'ouverture ni l'écriture : les courses qu'il ne confirme pas
// sont inconnues, et la page de qualité dit que la course n'est pas gardée.
//
// En mémoire, les courses sont une Map de cleDeCourse à l'entrée : celles
// que la lecture du compagnon a admises, et celles des générations de la
// séance. Une Map ne se modifie jamais : avecCourses en rend une neuve. Le
// module est pur : il ne touche aucun fichier, ne lit ni horloge ni aléa.
import { texteDuPlacement } from './canonique.js';
import { ENTREE_DE_COURSE, clesRangees, premiereFaute } from './document.js';
import { courseDepuisFichier, fauteDeCourse } from './placements.js';

/**
 * Version du format du compagnon des courses, distincte de celle du
 * fichier d'état. Un compagnon d'un autre format ne se lit pas : ses
 * courses sont inconnues.
 */
export const FORMAT_COURSES = 1;

// L'empreinte du texte : un entier de 0 à 2^53 − 1, le même sur toute
// machine, qui ne lit que les unités UTF-16 du texte. Deux états de 32 bits
// absorbent chaque unité par un ou exclusif puis une multiplication
// (Math.imul) par un grand impair, chacun le sien ; un mélange croisé les
// brasse ensuite, et 21 bits de l'un suivis des 32 de l'autre font l'entier.
// Elle n'est pas cryptographique : elle départage deux placements qui
// partagent déjà les autres champs de l'identité.
function empreinteDuTexte(texte) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < texte.length; i += 1) {
    const unite = texte.charCodeAt(i);
    h1 = Math.imul(h1 ^ unite, 2654435761);
    h2 = Math.imul(h2 ^ unite, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (h2 & 0x1fffff) + (h1 >>> 0);
}

// Les empreintes déjà calculées, par objet placement, chacune avec le
// drapeau siegesAttribues sous lequel elle l'a été. Un placement de
// proposition ne se modifie jamais en place : une commande en fait un neuf,
// ou modifie une copie (structuredClone) avant toute lecture. Chaque
// placement se hache ainsi une fois. Une datation, qui recopie la
// proposition sans copier son placement, retrouve la sienne ; la copie
// qu'un geste fait d'un placement qu'il garde reçoit celle de l'original
// (heriterEmpreintes).
const EMPREINTES = new WeakMap();

/**
 * L'empreinte du placement de la proposition p : celle de son texte
 * canonique (texteDuPlacement), un entier de 0 à 2^53 − 1. Ni
 * l'horodatage, ni produitVersion, ni l'ordre qu'une liste de table sans
 * sièges attribués ou une réserve reçoit n'y entrent. p.placement est un
 * objet, qui ne se modifie plus après cet appel (EMPREINTES).
 *
 * @param {{placement: Object[], siegesAttribues: boolean}} p
 * @returns {number}
 */
export function empreinteDe(p) {
  const connue = EMPREINTES.get(p.placement);
  if (connue !== undefined && connue.siegesAttribues === p.siegesAttribues) return connue.empreinte;
  const empreinte = empreinteDuTexte(texteDuPlacement(p));
  EMPREINTES.set(p.placement, { siegesAttribues: p.siegesAttribues, empreinte });
  return empreinte;
}

// Vrai quand les listes a et b portent les mêmes valeurs dans le même
// ordre, comparées par ===.
function memeListe(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

// Vrai quand les placements a et b, chacun de la forme du schéma — une
// entrée par tour, { sieges, reserve, absents? } —, portent les mêmes
// listes : leurs textes canoniques sont alors égaux sous un même drapeau
// siegesAttribues, puisque texteDuPlacement ne lit que ces trois champs. Une
// liste absents qui manque vaut une liste vide. La comparaison lit chaque
// occupant une fois et n'alloue rien.
const AUCUN = Object.freeze([]);
function memePlacement(a, b) {
  if (a.length !== b.length) return false;
  for (let tour = 0; tour < a.length; tour += 1) {
    const x = a[tour];
    const y = b[tour];
    if (!memeListe(x.reserve, y.reserve) || !memeListe(x.absents ?? AUCUN, y.absents ?? AUCUN)) return false;
    if (x.sieges.length !== y.sieges.length) return false;
    for (let table = 0; table < x.sieges.length; table += 1) {
      if (!memeListe(x.sieges[table], y.sieges[table])) return false;
    }
  }
  return true;
}

/**
 * Reporte les empreintes déjà calculées des propositions precedentes sur
 * leurs copies dans suivantes, sans rien hacher. Une proposition de
 * suivantes reçoit l'empreinte de la proposition de precedentes de même
 * identifiant quand celle-ci en a une (EMPREINTES) et que leurs
 * placements portent les mêmes listes (memePlacement) ; une proposition
 * dont le placement diffère, même sous la même identité, ne reçoit rien
 * et se hachera à sa prochaine clé. Le drapeau siegesAttribues suit
 * l'empreinte reportée : sous un autre drapeau, empreinteDe la recalcule.
 * Ne modifie aucune proposition. Un geste copie la charge entière
 * (structuredClone) : sans ce report, chaque geste hacherait de nouveau
 * chaque placement qu'il garde.
 *
 * @param {{id: number, placement: Object[]}[]} precedentes
 * @param {{id: number, placement: Object[]}[]} suivantes   propositions
 *        qui suivent le schéma, comme celles d'une charge examinée
 */
export function heriterEmpreintes(precedentes, suivantes) {
  const parId = new Map(precedentes.map((p) => [p.id, p]));
  for (const q of suivantes) {
    const p = parId.get(q.id);
    if (p === undefined || p.placement === q.placement || EMPREINTES.has(q.placement)) continue;
    const connue = EMPREINTES.get(p.placement);
    if (connue !== undefined && memePlacement(p.placement, q.placement)) EMPREINTES.set(q.placement, connue);
  }
}

// L'identité d'une proposition ou d'une entrée hors empreinte : son
// identifiant, sa graine, son compte d'arrêt, son historique et son
// horodatage, vide quand x n'en porte pas, joints par « | ».
const identiteDe = (x) => `${x.id}|${x.graine}|${x.arret}|${x.historique}|${x.horodatage ?? ''}`;

/**
 * La clé d'une proposition dans les courses en mémoire : son identifiant,
 * sa graine, son compte d'arrêt, son historique, son horodatage — vide
 * quand x n'en porte pas — et l'empreinte de son placement, joints par
 * « | ». x est une entrée du compagnon, qui porte son empreinte, ou une
 * proposition, dont l'empreinte se calcule (empreinteDe). Deux
 * propositions de même clé portent ces six valeurs ; une proposition dont
 * l'une change n'a plus la course de l'autre. Ce que la clé garantit, et
 * ce qu'elle ne garantit pas sans horodatage : l'en-tête du module.
 *
 * @param {{id: number, graine: number, arret: number, historique: number, horodatage?: string}} x
 * @returns {string}
 */
export function cleDeCourse(x) {
  const empreinte = Object.hasOwn(x, 'empreinte') ? x.empreinte : empreinteDe(x);
  return `${identiteDe(x)}|${empreinte}`;
}

/**
 * L'entrée du compagnon de la proposition de fichier p, pour sa course
 * mise en forme de fichier (courseVersFichier) : { id, graine, arret,
 * historique, horodatage, empreinte, course }, dans cet ordre de clés,
 * horodatage celui de p, absent quand p n'en porte pas, empreinte celle
 * du placement de p (empreinteDe), une copie de course, rien n'étant
 * partagé avec les arguments. Ne contrôle rien : fauteDeCourse a contrôlé
 * la course à sa mise en forme.
 *
 * @param {import('./types.js').PropositionFichier} p
 * @param {{evalues: number, releves: Object[]}} course
 * @returns {{id: number, graine: number, arret: number, historique: number, horodatage?: string, empreinte: number, course: Object}}
 */
export function entreeDeCourse(p, course) {
  const { id, graine, arret, historique, horodatage } = p;
  const date = horodatage === undefined ? {} : { horodatage };
  return { id, graine, arret, historique, ...date, empreinte: empreinteDe(p), course: structuredClone(course) };
}

/**
 * Le texte du compagnon de l'événement d'identifiant evenement, portant
 * entrees dans leur ordre : la ligne d'ouverture, une entrée par ligne
 * (JSON.stringify, ses clés dans l'ordre d'entreeDeCourse), la fermeture,
 * puis une fin de ligne. Sans entrée, une seule ligne.
 *
 * @param {string} evenement
 * @param {Object[]} entrees
 * @returns {string}
 */
export function texteDesCourses(evenement, entrees) {
  const ouverture = `{"format":${FORMAT_COURSES},"evenement":${JSON.stringify(evenement)},"courses":[`;
  if (entrees.length === 0) return `${ouverture}]}\n`;
  return `${ouverture}\n${entrees.map((entree) => JSON.stringify(entree)).join(',\n')}\n]}\n`;
}

// Les clés de la racine d'un compagnon, rangées comme clesRangees les rend.
const RACINE_RANGEE = ['courses', 'evenement', 'format'].join('|');

// La liste des entrées d'un texte de compagnon pour l'événement evenement,
// ou null quand le texte ne se lit pas : absent, hors JSON — une marque
// d'ordre d'octets en tête mise à part —, une racine qui n'a pas exactement
// les clés format, evenement et courses, un autre format, un autre
// événement, des courses qui ne sont pas une liste.
function entreesDuTexte(texte, evenement) {
  if (typeof texte !== 'string') return null;
  let lu;
  try {
    lu = JSON.parse(texte.replace(/^\u{FEFF}/u, ''));
  } catch {
    return null;
  }
  if (typeof lu !== 'object' || lu === null || Array.isArray(lu)) return null;
  if (clesRangees(lu).join('|') !== RACINE_RANGEE) return null;
  if (lu.format !== FORMAT_COURSES || lu.evenement !== evenement || !Array.isArray(lu.courses)) return null;
  return lu.courses;
}

/**
 * Les courses qu'un texte de compagnon confirme pour charge, en mémoire :
 * une Map de cleDeCourse à l'entrée, dans l'ordre du texte. Ne lève jamais.
 * Un texte null, illisible, d'un autre format ou d'un autre événement que
 * charge.evenement.id ne confirme rien (entreesDuTexte). Une entrée se
 * garde quand elle suit sa règle (ENTREE_DE_COURSE), qu'une proposition de
 * charge porte exactement son identité, qu'aucune entrée gardée avant elle
 * n'a sa clé, et que sa course ne contredit pas cette proposition
 * (fauteDeCourse) ; toute autre s'ignore seule. Une course contradictoire
 * n'entre ainsi jamais en mémoire depuis le disque. charge est celle
 * qu'examiner rend, dont chaque proposition est cohérente.
 *
 * @param {string|null} texte
 * @param {import('./types.js').Charge} charge
 * @returns {Map<string, Object>}
 */
export function lireCourses(texte, charge) {
  const courses = new Map();
  const entrees = entreesDuTexte(texte, charge.evenement.id);
  if (entrees === null) return courses;
  const proposition = new Map(charge.propositions.map((p) => [cleDeCourse(p), p]));
  for (const entree of entrees) {
    if (premiereFaute(entree, ENTREE_DE_COURSE) !== null) continue;
    const cle = cleDeCourse(entree);
    const p = proposition.get(cle);
    if (p === undefined || courses.has(cle) || fauteDeCourse(p, entree.course) !== null) continue;
    courses.set(cle, entree);
  }
  return courses;
}

/**
 * Une Map neuve : courses, puis chaque entrée d'entrees sous sa clé, la
 * dernière d'une même clé gardée. courses n'est pas modifiée.
 *
 * @param {Map<string, Object>} courses
 * @param {Object[]} entrees
 * @returns {Map<string, Object>}
 */
export function avecCourses(courses, entrees) {
  const suite = new Map(courses);
  for (const entree of entrees) suite.set(cleDeCourse(entree), entree);
  return suite;
}

/**
 * Les entrées de courses pour les propositions données, dans leur ordre :
 * celle de la clé de chacune, quand courses la connaît. C'est ce que le
 * compagnon d'une charge porte. Seule une proposition dont l'identité hors
 * empreinte est celle d'une entrée de courses peut avoir la sienne : la
 * clé, et donc l'empreinte, ne se calcule que pour elle.
 *
 * @param {Map<string, Object>} courses
 * @param {Object[]} propositions
 * @returns {Object[]}
 */
export function entreesPour(courses, propositions) {
  if (courses.size === 0) return [];
  const identites = new Set();
  for (const entree of courses.values()) identites.add(identiteDe(entree));
  const entrees = [];
  for (const p of propositions) {
    const entree = identites.has(identiteDe(p)) ? courses.get(cleDeCourse(p)) : undefined;
    if (entree !== undefined) entrees.push(entree);
  }
  return entrees;
}

/**
 * La course de la proposition id de charge, en plans par identifiants
 * (courseDepuisFichier), ou null : aucune proposition id, aucune course de
 * son identité dans courses, ou une course qui la contredit. La course se
 * contrôle ici, contre la proposition que la charge porte : une course
 * contradictoire n'atteint jamais le détail, d'où qu'elle vienne. charge
 * est celle d'un Ouvert, dont chaque proposition est cohérente.
 *
 * @param {{charge: import('./types.js').Charge, courses: Map<string, Object>}} ouvert
 * @param {number} id
 * @returns {{evalues: number, releves: {mouvements: number, plan: import('../moteur/types.js').Plan}[]}|null}
 */
export function courseDe({ charge, courses }, id) {
  const p = charge.propositions.find((candidate) => candidate.id === id);
  if (p === undefined) return null;
  const entree = courses.get(cleDeCourse(p));
  if (entree === undefined) return null;
  try {
    return courseDepuisFichier(p, entree.course);
  } catch (erreur) {
    // courseDepuisFichier lève TypeError sur une course qui contredit p.
    if (erreur instanceof TypeError) return null;
    throw erreur;
  }
}
