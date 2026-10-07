// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les correctifs du journal (§ 8.6, § 8.9). Un correctif est la liste des
// opérations qui mènent d'une charge à une autre ; le journal en porte un
// dans chaque entrée qui n'est pas un instantané.
//
// Une opération pose une valeur au bout d'un chemin, ou retire
// l'enregistrement qu'il désigne : { op: 'poser', chemin, valeur } ou
// { op: 'retirer', chemin }. Un chemin est une liste d'étapes depuis la
// charge : une clé d'objet, chaîne ; un rang de liste, entier ≥ 0 ; ou
// { id }, qui désigne dans une liste d'enregistrements à identifiant —
// participants, tables, propositions — l'enregistrement de cet identifiant,
// et non une place.
//
// Les deux fonctions travaillent sur les copies canoniques de canonique.js :
// un rang y désigne une place de l'ordre canonique, que la charge seule
// détermine, et non de l'ordre dans lequel une liste s'est remplie en
// mémoire. Un correctif calculé depuis une charge s'applique ainsi à toute
// charge qui lui est égale à l'ordre près, quelle que soit la façon dont
// l'une ou l'autre s'est construite.
//
// Le correctif reste local (§ 8.9). Une personne qui prend, au même tour
// d'une proposition, la place d'une autre à une autre table touche les deux
// listes de ces tables et rien d'autre : une entrée de chacune quand chaque
// personne prend le rang de l'autre, ce que garde l'ordre des sièges quand
// ils sont attribués ; une personne qui quitte sa chaise sans être
// remplacée y laisse null, le marqueur d'une chaise vide, une pose au rang
// de la chaise. Sans attribution, chaque liste se trie par
// identifiant, et l'entrée qui change de rang décale celles qu'elle
// franchit ; une liste d'identifiants de même longueur se pose alors
// entière dès que ses poses rang par rang pèsent plus que cette pose, et
// l'échange ne coûte jamais plus que les deux listes posées entières. Une
// liste qui change de longueur se pose entière.
//
// Une charge que rend appliquer, l'analyse l'admet comme celle qu'il
// reçoit, et chacune de ses propositions suit sa règle, comme dans la
// charge que rend examiner : une valeur posée suit la règle de sa place, sa
// forme entière (premiereFaute), jusque dans les propositions et le retenu,
// que l'analyse ne lit que comme conteneurs (§ 8.9). Le retenu posé entier
// fait seul exception. Un retenu que sa règle refuse, que la lecture admet
// et que le contrôle des placements garde, canonique.js le recopie hors du
// schéma, et difference le pose entier : à sa place, seul son conteneur se
// contrôle (premiereFauteEnPlace), et le journal le libère, le remet en
// place ou le remplace tel quel, quelle que soit sa faute. Sous un tel
// retenu, rien ne se pose : difference ne descend pas en lui.
import { canoniser, retenuHorsDeSaRegle } from './canonique.js';
import { SCHEMA, premiereFaute, premiereFauteEnPlace } from './document.js';
import { ErreurStockage } from './erreurs.js';

/**
 * Une étape d'un chemin : la clé d'un objet, le rang d'un élément de liste,
 * ou { id }, l'enregistrement de cet identifiant dans une liste
 * d'enregistrements à identifiant.
 * @typedef {string|number|{id: number}} Etape
 *
 * @typedef {Object} OperationPoser
 * @property {'poser'} op
 * @property {Etape[]} chemin   non vide
 * @property {*} valeur         valeur JSON, null comprise
 *
 * @typedef {Object} OperationRetirer
 * @property {'retirer'} op
 * @property {Etape[]} chemin   non vide, terminé par { id }
 *
 * @typedef {OperationPoser|OperationRetirer} Operation
 */

// Règles de la charge, du retenu, d'un identifiant et de l'occupant d'une
// liste de table — un identifiant, ou null pour une chaise vide — dans le
// schéma du fichier d'état.
const regleDuChamp = (regle, cle) => regle.champs.find(([nom]) => nom === cle)[1];
const CHARGE = regleDuChamp(SCHEMA, 'charge');
const RETENU = regleDuChamp(CHARGE, 'retenu');
const PROPOSITION = regleDuChamp(CHARGE, 'propositions').element;
const IDENTIFIANT = regleDuChamp(PROPOSITION, 'id');
const OCCUPANT = regleDuChamp(regleDuChamp(PROPOSITION, 'placement').element, 'sieges').element.element;

// Vrai pour un objet qui n'est ni null ni une liste.
const estObjet = (valeur) => typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);

// Vrai quand chaque élément de liste est un objet dont l'id est un entier
// exact, et qu'aucun id ne s'y répète : la seule forme où { id } désigne un
// enregistrement et un seul. Une copie canonique ne porte que les clés du
// schéma, où seuls les participants, les tables et les propositions ont un
// champ id : aucune autre liste non vide n'a cette forme. Une liste vide
// l'a, quelle que soit sa sorte, sans que comparer en tire un { id } : deux
// listes vides ne donnent rien, et contre une liste non vide, c'est la
// forme de celle-ci qui décide.
function identifiantsDistincts(liste) {
  const vus = new Set();
  for (const element of liste) {
    if (!estObjet(element) || !Number.isSafeInteger(element.id) || vus.has(element.id)) return false;
    vus.add(element.id);
  }
  return true;
}

// Poids d'opérations dans un correctif : la longueur de leur texte JSON, en
// unités UTF-16, des octets pour les chemins du schéma et les identifiants.
const poids = (operations) => JSON.stringify(operations).length;

// Ajoute à operations ce qui mène de a à b, deux valeurs canoniques de la
// règle regle, au bout de chemin. null contre une valeur, et deux scalaires
// différents, posent b. Un retenu que sa règle refuse, d'un côté ou de
// l'autre, n'a pas de champs que le schéma décrive : b se pose entier quand
// les deux copies canoniques s'écrivent autrement, et rien sinon. Deux
// objets se comparent champ par champ, dans l'ordre du schéma. Deux listes
// d'enregistrements à identifiants distincts se comparent par identifiant ;
// deux autres listes, de longueurs différentes, posent b entière, et de même
// longueur se comparent rang par rang — deux listes d'identifiants ou
// d'occupants exceptées, qui posent b entière quand leurs poses rang par
// rang pèsent plus que la sienne.
function comparer(a, b, regle, chemin, operations) {
  if (a === null || b === null || (regle.genre !== 'objet' && regle.genre !== 'liste')) {
    if (a !== b) operations.push({ op: 'poser', chemin, valeur: b });
  } else if (retenuHorsDeSaRegle(a, regle) || retenuHorsDeSaRegle(b, regle)) {
    if (JSON.stringify(a) !== JSON.stringify(b)) operations.push({ op: 'poser', chemin, valeur: b });
  } else if (regle.genre === 'objet') {
    for (const [cle, regleDeCle] of regle.champs) comparer(a[cle], b[cle], regleDeCle, [...chemin, cle], operations);
  } else if (identifiantsDistincts(a) && identifiantsDistincts(b)) {
    comparerParIdentifiant(a, b, regle.element, chemin, operations);
  } else if (a.length !== b.length) {
    operations.push({ op: 'poser', chemin, valeur: b });
  } else if (regle.element === IDENTIFIANT || regle.element === OCCUPANT) {
    comparerIdentifiants(a, b, regle.element, chemin, operations);
  } else {
    a.forEach((element, rang) => comparer(element, b[rang], regle.element, [...chemin, rang], operations));
  }
}

// Ajoute à operations ce qui mène de a à b, deux listes d'identifiants de
// même longueur, d'élément de règle regleElement, au bout de chemin : une
// pose par rang qui change, ou b entière quand ces poses pèsent plus que la
// sienne. Une liste triée par identifiant — une liste de table sans
// attribution, une réserve, les participants d'un plan — décale d'un rang
// chaque entrée qu'un identifiant remplacé franchit, et ses poses rang par
// rang se multiplient ; ce qui s'en écrit ne pèse jamais plus que la liste
// posée entière. Sous des sièges attribués, une chaise libérée ou reprise
// ne change que son rang : une pose, de valeur null ou de l'occupant.
function comparerIdentifiants(a, b, regleElement, chemin, operations) {
  const parRang = [];
  a.forEach((id, rang) => comparer(id, b[rang], regleElement, [...chemin, rang], parRang));
  const entiere = { op: 'poser', chemin, valeur: b };
  operations.push(...(poids(parRang) > poids([entiere]) ? [entiere] : parRang));
}

// Fusion de deux listes d'enregistrements rangées par identifiant croissant,
// comme les laisse canoniser : un identifiant de a seul est retiré, un
// identifiant de b seul est posé entier, un identifiant commun se compare
// champ par champ. Les opérations suivent l'ordre des identifiants.
function comparerParIdentifiant(a, b, regleElement, chemin, operations) {
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    const idA = i < a.length ? a[i].id : Infinity;
    const idB = j < b.length ? b[j].id : Infinity;
    if (idA < idB) {
      operations.push({ op: 'retirer', chemin: [...chemin, { id: idA }] });
      i += 1;
    } else if (idB < idA) {
      operations.push({ op: 'poser', chemin: [...chemin, { id: idB }], valeur: b[j] });
      j += 1;
    } else {
      comparer(a[i], b[j], regleElement, [...chemin, { id: idA }], operations);
      i += 1;
      j += 1;
    }
  }
}

/**
 * Correctif menant de a à b (§ 8.6), calculé entre leurs copies canoniques :
 * [] quand elles sont égales, c'est-à-dire quand a et b ne diffèrent que par
 * l'ordre de leurs clés ou d'une liste que canoniser range. Les opérations
 * suivent l'ordre du schéma, puis celui des identifiants, puis celui des
 * rangs : le correctif ne dépend que des deux charges. Une valeur posée est
 * prise à la copie canonique de b, et ne partage aucun objet avec b. Ni a ni
 * b ne sont modifiées.
 *
 * Règles : les objets clé par clé dans l'ordre du schéma ; les listes
 * d'enregistrements à identifiant — participants, tables, propositions —
 * par identifiant : retirés, posés entiers, communs comparés ; une telle
 * liste dont un identifiant se répète, ce que la lecture admet pour deux
 * propositions, se compare comme les autres listes ; les autres listes de
 * longueurs différentes posées entières, et de même longueur rang par rang,
 * sauf une liste d'identifiants dont les poses rang par rang pèsent plus,
 * en JSON, que sa pose entière : elle se pose entière ; null contre une
 * valeur, et deux scalaires différents, posent la valeur de b ; un retenu
 * que sa règle refuse, dans a ou dans b, se pose entier quand les deux
 * diffèrent, sans rien pour lui sinon. L'échange de deux personnes, au même
 * tour d'une proposition, ne touche ainsi que les listes de leurs deux
 * tables, et ne pèse jamais plus que ces deux listes posées entières,
 * attribution des sièges ou non (§ 8.9).
 *
 * @param {import('./types.js').Charge} a
 * @param {import('./types.js').Charge} b
 * @returns {Operation[]}
 */
export function difference(a, b) {
  const operations = [];
  comparer(canoniser(a), canoniser(b), CHARGE, [], operations);
  return operations;
}

// Règle de ce que désigne etape dans une valeur de règle regle, lue dans le
// schéma : pour un objet, le champ de cette clé ; pour une liste, son
// élément, la valeur refusant toute étape qui n'y est ni un rang ni { id }.
// undefined quand l'étape sort du schéma — une clé que porte un retenu
// recopié hors du schéma, par exemple —, et pour toute étape qui la suit.
function regleSuivante(regle, etape) {
  if (regle?.genre === 'objet') return regle.champs.find(([cle]) => cle === etape)?.[1];
  return regle?.genre === 'liste' ? regle.element : undefined;
}

// Vrai quand regle est celle d'une liste d'enregistrements à identifiant,
// dont l'élément a un champ id : participants, tables, propositions.
const estListeDEnregistrements = (regle) => regle?.element?.cles?.has('id') === true;

// Lecture de chemin dans le schéma, depuis la charge : { regle }, la règle
// de la place qu'il désigne, undefined quand une étape sort du schéma ; null
// quand une étape { id } ne tombe pas dans une liste d'enregistrements à
// identifiant. C'est le schéma qui en décide, et non le contenu de la
// liste : une liste vide n'a aucun élément qui montre la forme des autres,
// et tout identifiant y est absent, ce qui ouvrirait une insertion par
// { id } dans une réserve, une liste de table ou les réservations. Une clé
// et un rang se contrôlent sur la valeur, qui les porte ou non.
function lireChemin(chemin) {
  let regle = CHARGE;
  for (const etape of chemin) {
    if (estObjet(etape) && !estListeDEnregistrements(regle)) return null;
    regle = regleSuivante(regle, etape);
  }
  return { regle };
}

// Vrai quand valeur, posée au bout de chemin dans charge, à la place de
// règle regle, suit cette règle, sa forme entière (premiereFaute),
// propositions et retenu compris : une proposition qui suit sa règle la
// suit encore après la pose, et canoniser comme serialiser la lisent. À la
// place du retenu, son conteneur seul (premiereFauteEnPlace) : un retenu que
// sa règle refuse se pose entier. Sous le retenu, une valeur ne se pose que
// quand il suit sa règle, et une valeur qui suit la sienne l'y garde. Une
// place hors du schéma n'en admet aucune.
function valeurAdmise(charge, chemin, regle, valeur) {
  if (regle === undefined) return false;
  if (regle === RETENU) return premiereFauteEnPlace(valeur, RETENU) === null;
  if (chemin[0] === 'retenu' && premiereFaute(charge.retenu, RETENU) !== null) return false;
  return premiereFaute(valeur, regle) === null;
}

// Rangs des éléments de liste dont l'id vaut id, ou null quand id n'est pas
// un entier exact : { id } n'y désigne rien. liste est une liste
// d'enregistrements du schéma — participants, tables, propositions —,
// chacun un objet à id entier, que l'analyse et valeurAdmise gardent
// conformes à leur règle.
function rangsDeLIdentifiant(liste, id) {
  if (!Number.isSafeInteger(id)) return null;
  const rangs = [];
  for (let rang = 0; rang < liste.length; rang += 1) {
    if (liste[rang].id === id) rangs.push(rang);
  }
  return rangs;
}

// Vrai quand etape est une clé propre de l'objet conteneur. Une clé héritée
// du prototype commun des objets — __proto__, constructor, toString — n'en
// est pas une : aucune opération ne lit ni n'écrit ce prototype, que partage
// tout le processus.
const estCleDe = (conteneur, etape) =>
  typeof etape === 'string' && estObjet(conteneur) && Object.hasOwn(conteneur, etape);
// Vrai quand etape est un rang de la liste conteneur.
const estRangDe = (conteneur, etape) =>
  Number.isSafeInteger(etape) && etape >= 0 && Array.isArray(conteneur) && etape < conteneur.length;
// Rangs que désigne l'étape { id } dans conteneur, ou null.
const rangsDe = (conteneur, etape) => (estObjet(etape) ? rangsDeLIdentifiant(conteneur, etape.id) : null);

// Valeur que désigne etape dans conteneur, ou undefined : une clé absente,
// un rang hors de la liste, un { id } qui ne désigne pas exactement un
// enregistrement, une étape d'une autre sorte. Aucune valeur d'une charge
// n'est undefined.
function descendre(conteneur, etape) {
  if (estCleDe(conteneur, etape) || estRangDe(conteneur, etape)) return conteneur[etape];
  const rangs = rangsDe(conteneur, etape);
  return rangs?.length === 1 ? conteneur[rangs[0]] : undefined;
}

// Pose une copie de valeur à la place que désigne etape dans conteneur :
// une clé qu'il porte déjà, un rang qu'il contient, ou { id } absent de la
// liste, quand valeur, un enregistrement que valeurAdmise a contrôlé, porte
// cet id ; l'enregistrement s'insère alors avant le premier d'id plus
// grand, ce qui garde une liste rangée par identifiant croissant. Rend faux
// quand etape ne désigne aucune de ces places.
function poser(conteneur, etape, valeur) {
  if (estCleDe(conteneur, etape) || estRangDe(conteneur, etape)) {
    conteneur[etape] = structuredClone(valeur);
    return true;
  }
  if (rangsDe(conteneur, etape)?.length !== 0 || valeur.id !== etape.id) return false;
  const suivant = conteneur.findIndex((element) => element.id > etape.id);
  conteneur.splice(suivant === -1 ? conteneur.length : suivant, 0, structuredClone(valeur));
  return true;
}

// Retire de conteneur l'enregistrement que désigne l'étape { id } ; rend
// faux quand elle n'en désigne pas exactement un. Une clé ou un rang ne se
// retirent pas : les objets de la charge ont les clés du schéma, et une
// liste sans identifiants se pose entière quand sa longueur change.
function retirer(conteneur, etape) {
  const rangs = rangsDe(conteneur, etape);
  if (rangs?.length !== 1) return false;
  conteneur.splice(rangs[0], 1);
  return true;
}

// Applique operation à charge, en place ; rend faux, sans rien changer,
// quand elle est mal formée, qu'une étape { id } de son chemin tombe hors
// d'une liste d'enregistrements, que ce chemin ne désigne pas une place de
// charge, ou que la valeur posée n'y suivrait pas sa règle (valeurAdmise).
// Un chemin vide n'a pas de dernière étape, et undefined n'en désigne
// aucune. Une opération poser porte une valeur : JSON n'en écrit pas
// d'undefined.
function executer(charge, operation) {
  if (!estObjet(operation) || !Array.isArray(operation.chemin)) return false;
  const { op, chemin, valeur } = operation;
  const lecture = lireChemin(chemin);
  if (lecture === null) return false;
  let conteneur = charge;
  for (const etape of chemin.slice(0, -1)) {
    conteneur = descendre(conteneur, etape);
    if (conteneur === undefined) return false;
  }
  const derniere = chemin[chemin.length - 1];
  if (op === 'poser') {
    if (valeur === undefined || !valeurAdmise(charge, chemin, lecture.regle, valeur)) return false;
    return poser(conteneur, derniere, valeur);
  }
  if (op === 'retirer') return retirer(conteneur, derniere);
  return false;
}

/**
 * Applique un correctif à la copie canonique de a (§ 8.6), opération après
 * opération, et rend cette copie : une charge neuve, qui ne partage aucun
 * objet avec a ni avec le correctif. a n'est pas modifiée ; c'est une charge
 * que l'analyse admet et dont chaque proposition suit sa règle, comme celle
 * que rend examiner (placements.js). Appliqué à a, le correctif de
 * difference(a, b) rend la copie canonique de b. Une insertion par { id }
 * garde l'ordre des identifiants.
 *
 * Lève ErreurStockage('CORRECTIF', { rang }) à la première opération qui ne
 * s'applique pas — rang est sa place dans le correctif, à partir de 0 — :
 * une opération mal formée ; une étape { id } hors des participants, des
 * tables et des propositions, même dans une liste vide ; une étape qui ne
 * trouve pas sa clé, que l'objet porte en propre et n'hérite pas, son rang
 * ou exactement un enregistrement ; poser à une clé que l'objet ne porte
 * pas ou au-delà de la fin d'une liste ; poser par { id } un identifiant
 * déjà présent, ou une valeur qui n'est pas l'enregistrement de cet
 * identifiant ; poser une valeur qui sort de la règle de sa place, en
 * genre, en domaine, null compris, ou en clés, jusque dans les propositions
 * et le retenu ; à la place du retenu, autre chose qu'un objet ou null ;
 * sous un retenu que sa règle refuse, quoi que ce soit ; retirer autre
 * chose qu'un enregistrement par { id }. Une charge rendue garde ainsi
 * chaque proposition dans sa règle, et canoniser, difference et serialiser
 * la lisent sans lever. Le contrôle porte sur la forme : une opération ne
 * porte pas la valeur qu'elle remplace, et un correctif dont chaque chemin
 * existe aussi dans une autre charge s'y applique sans lever. Un correctif
 * qui n'est pas une liste lève TypeError.
 *
 * @param {import('./types.js').Charge} a
 * @param {Operation[]} correctif
 * @returns {import('./types.js').Charge}
 */
export function appliquer(a, correctif) {
  if (!Array.isArray(correctif)) {
    throw new TypeError(`appliquer : liste d'opérations attendue, reçu ${JSON.stringify(correctif)}`);
  }
  const charge = canoniser(a);
  correctif.forEach((operation, rang) => {
    if (!executer(charge, operation)) throw new ErreurStockage('CORRECTIF', { rang });
  });
  return charge;
}
