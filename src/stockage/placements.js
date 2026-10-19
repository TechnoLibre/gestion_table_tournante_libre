// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les placements du fichier d'état, sous leur forme positionnelle (§ 8.9) :
// la proposition du moteur mise en forme de fichier, et le plan du moteur
// qu'on en tire ; le contrôle de cohérence d'une proposition ou du retenu ;
// leur dérive contre la charge courante, et le partage de ses raisons entre
// celles des participants et celles qui interdisent un départ ; leur
// alignement sur la présence et les participants de la charge ; leur forme
// nommée ; le partage d'une charge lue entre propositions gardées et
// écartées. La course de la
// recherche d'une proposition (§ 5.10) n'est pas dans le fichier d'état :
// ce module la met en forme de fichier, contrôle qu'elle ne contredit pas
// sa proposition et en tire les plans, pour le compagnon des courses
// (courses.js), qui la garde à côté. Les formes sont décrites dans
// types.js, dans la règle ENTREE_DE_COURSE du schéma et dans ce module.
//
// Fautif et périmé sont deux choses (§ 8.9, point 3). Un placement fautif se
// contredit lui-même : fautes nomme chaque contradiction, et examiner écarte
// la proposition fautive de la charge sans refuser le fichier ; chacune tombe
// seule. examiner compare aussi les identifiants des propositions entre eux
// et à prochainsIds.proposition, que l'analyse du fichier ne lit pas, et
// rend ce compteur relevé au-delà de chaque identifiant lu : aucun ne se
// réattribue. Un placement cohérent qui ne décrit plus la configuration
// courante est périmé : derive dit pourquoi, et examiner le garde (§ 9). Un
// placement porte lui-même ses absents, tour par tour : une présence changée
// dans la charge le rend périmé, jamais fautif. Le retenu fautif est signalé
// et gardé : sa reprise par le .precedent appartient au dépôt (§ 8.8).
//
// La forme d'une proposition et du retenu suit les règles de SCHEMA, le
// schéma du fichier d'état, dont l'analyse n'applique que celle du
// conteneur : fautes applique les autres, avant toute cohérence, par le
// parcours même de l'analyse, premiereFaute, qui nomme les chemins à sa
// manière. Une liste de table porte null à la place d'une chaise vide
// (§ 8.9) : la règle l'admet à toute place, et fautes ne le garde que sous
// des sièges attribués, avant le dernier occupant, siège 1 compris. Aucune
// fonction ne modifie ce qu'elle reçoit ; aucune ne lit l'horloge ni un
// aléa.
import { estPresentAuTour } from '../moteur/presence.js';
import { ENTREE_DE_COURSE, SCHEMA, capacite, premiereFaute } from './document.js';
import { ErreurStockage } from './erreurs.js';
import { absentsParTour } from './presence.js';

/**
 * Une faute d'un placement ; types.js en donne la table des codes. FORME :
 * une valeur sort de sa règle, la déclaration se contredit, ou une chaise
 * vide est mal placée — sans attribution des sièges, ou en fin de liste ; chemin
 * désigne l'élément fautif dans le placement, à la manière de l'analyse du
 * fichier, '' pour le placement lui-même. LONGUEUR : une longueur écrite
 * contredit celle que le placement déclare ; tour et table null désignent le
 * nombre de tours, table null seule le nombre de listes du tour. DOUBLON,
 * INCONNU, MANQUANT : un identifiant écrit plus d'une fois, écrit sans être
 * déclaré, déclaré sans être écrit, dans les listes de table, la réserve et
 * les absents d'un tour. Les tours se numérotent à partir de 1, tables et participants
 * par identifiant. Ces quatre codes sont des contradictions internes, que
 * fautes nomme. IDENTIFIANT_REPETE : une proposition cohérente porte
 * l'identifiant d'une proposition gardée avant elle.
 * IDENTIFIANT_HORS_COMPTEUR : une proposition cohérente, ou le retenu par sa
 * proposition d'origine, porte un identifiant qui atteint
 * prochainsIds.proposition. examiner seul nomme ces deux-là, en comparant
 * les propositions entre elles et à la charge. DERIVATION : la dérivation
 * d'une proposition de forme conforme contredit son identifiant ou ses tours
 * déclarés ; raison departNonAnterieur, un depart qui ne précède pas id
 * (chemin depart) ; tourHorsSoiree, un tour figé au-delà de tours (chemin
 * toursFiges[i], le premier) ; tousLesTours, des tours figés qui portent
 * chaque tour (chemin toursFiges) ; sansDepart, des tours figés sans depart
 * (chemin toursFiges). Un depart absent de la liste n'en est pas une.
 *
 * @typedef {{code: 'FORME', chemin: string}
 *   | {code: 'DERIVATION', chemin: string, raison: 'departNonAnterieur'|'tourHorsSoiree'|'tousLesTours'|'sansDepart'}
 *   | {code: 'LONGUEUR', tour: number|null, table: number|null, declare: number, ecrit: number}
 *   | {code: 'DOUBLON'|'INCONNU'|'MANQUANT', tour: number, participant: number}
 *   | {code: 'IDENTIFIANT_REPETE'|'IDENTIFIANT_HORS_COMPTEUR'}} Faute
 *
 * Une raison de dérive d'un placement cohérent contre la charge courante ;
 * tours, croissants et non vides, nomme les tours où la présence a changé.
 *
 * @typedef {{code: 'PARTICIPANT_EXCLU'|'PARTICIPANT_SUPPRIME'|'PARTICIPANT_NON_PLACE', participant: number}
 *   | {code: 'PRESENCE_RETIREE'|'PRESENCE_AJOUTEE', participant: number, tours: number[]}
 *   | {code: 'TABLE_SUPPRIMEE'|'TABLE_AJOUTEE', table: number}
 *   | {code: 'CAPACITE_CHANGEE', table: number, avant: number, maintenant: number}
 *   | {code: 'TOURS_CHANGES', avant: number, maintenant: number}} Raison
 *
 * Une ligne de la forme nommée : une personne placée à un tour.
 *
 * @typedef {Object} Ligne
 * @property {number} tour
 * @property {number|null} table     identifiant ; null pour la réserve
 * @property {number|null} numero    numéro affiché de la table dans la
 *                                   charge ; null pour la réserve et pour
 *                                   une table que la charge n'a plus
 * @property {number|null} siege     rang dans la liste, à partir de 1,
 *                                   chaises vides comprises, quand les
 *                                   sièges sont attribués ; null sinon
 * @property {number} participant
 * @property {string|null} nom       null pour une personne que la charge
 *                                   n'a plus
 * @property {string|null} prenom
 * @property {boolean} reserve      vrai pour une personne de la réserve ;
 *                                   une liste écrite au-delà des tables
 *                                   déclarées n'a pas de table et n'est
 *                                   pas la réserve
 * @property {boolean} absent       vrai pour une personne des absents du
 *                                   tour : table, numero et siege null,
 *                                   reserve faux
 *
 * Ce que rend examiner.
 *
 * @typedef {Object} Examen
 * @property {import('./types.js').Charge} charge   sans les propositions
 *           fautives, son compteur des propositions relevé au-delà de chaque
 *           identifiant lu
 * @property {Array<{rang: number, id: number|null, fautes: Faute[]}>} fautives
 *           par rang dans la liste lue ; id null quand il ne se lit pas
 * @property {Array<{id: number, raisons: Raison[]}>} derives   par identifiant
 * @property {{fautes: Faute[], raisons: Raison[]}} retenu
 */

// Règle du champ cle d'un objet du schéma.
const regleDuChamp = (regle, cle) => regle.champs.find(([nom]) => nom === cle)[1];
const CHARGE = regleDuChamp(SCHEMA, 'charge');
// Règles d'une proposition et du retenu. Aucune des valeurs qu'elles
// contiennent n'admet null, hors de l'occupant d'une liste de table, la
// chaise vide ; examiner traite le retenu nul, son absence, avant de lire
// le retenu.
const PROPOSITION = regleDuChamp(CHARGE, 'propositions').element;
const RETENU = regleDuChamp(CHARGE, 'retenu');
const IDENTIFIANT = regleDuChamp(PROPOSITION, 'id');
// Règle de la course d'une entrée du compagnon des courses.
const COURSE = regleDuChamp(ENTREE_DE_COURSE, 'course');

const croissant = (a, b) => a - b;
// Deux chaînes, comparées unité UTF-16 par unité.
const comparerTextes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Chemin du second exemplaire du premier identifiant que liste porte deux
// fois, ou null.
function doublon(liste, nom) {
  const vus = new Set();
  for (let rang = 0; rang < liste.length; rang += 1) {
    if (vus.has(liste[rang])) return `${nom}[${rang}]`;
    vus.add(liste[rang]);
  }
  return null;
}

// Chemin de la première contradiction de la déclaration d'un placement de
// forme conforme, ou null, dans l'ordre du schéma : une table déclarée deux
// fois ; des capacités qui ne correspondent pas aux tables rang à rang ; un
// participant déclaré deux fois. D'un doublon, le second est nommé, comme
// l'analyse le fait des identifiants de la charge.
function fauteDeDeclaration({ tables, capacites, participants }) {
  return (
    doublon(tables, 'tables')
    ?? (capacites.length === tables.length ? null : 'capacites')
    ?? doublon(participants, 'participants')
  );
}

// Chemin de la première chaise vide mal placée d'un placement de forme et
// de déclaration conformes, ou null, dans l'ordre des tours, des listes et
// des rangs : un null sous siegesAttribues faux, où l'ordre d'une liste ne
// dit aucun siège, ou au dernier rang d'une liste, qu'une écriture sans
// lui dit pareil. Le chemin suit la convention de premiereFaute.
function fauteDeChaiseVide({ siegesAttribues, placement }) {
  for (let tour = 0; tour < placement.length; tour += 1) {
    const { sieges } = placement[tour];
    for (let table = 0; table < sieges.length; table += 1) {
      const liste = sieges[table];
      const rang = siegesAttribues ? liste.length - 1 : liste.indexOf(null);
      if (rang >= 0 && liste[rang] === null) return `placement[${tour}].sieges[${table}][${rang}]`;
    }
  }
  return null;
}

// Fautes de cohérence d'un placement de forme et de déclaration conformes
// (§ 8.9, points 1 et 2). D'abord le nombre de tours écrits contre celui
// déclaré. Puis, tour après tour : le nombre de listes de table contre celui
// des tables déclarées ; la longueur de chaque liste appariée à une table
// déclarée, dans l'ordre déclaré, contre sa capacité, chaises vides
// comprises ; le multiensemble du tour, listes de table, réserve et absents
// compris, où chaque identifiant déclaré figure exactement une fois —
// doublons, inconnus, puis manquants, chacun nommé une fois par tour, par
// identifiant croissant. Une chaise vide n'y entre pas.
//
// La capacité borne une liste sans la fixer : quand la salle offre plus de
// sièges que de personnes, des tables gardent des places vides, et une liste
// plus courte que sa capacité n'est pas fautive. Un décalage qui remplit une
// table au-delà de sa capacité l'est.
//
// Les occurrences d'un tour se comptent dans un Map ; aucune décision ne
// suit son ordre : doublons et manquants se lisent dans l'ordre des
// identifiants déclarés, triés, et les inconnus se trient avant d'être
// nommés.
function fautesDeCoherence({ tables, capacites, tours, participants, placement }) {
  const liste = [];
  if (placement.length !== tours) {
    liste.push({ code: 'LONGUEUR', tour: null, table: null, declare: tours, ecrit: placement.length });
  }
  const declares = [...participants].sort(croissant);
  const estDeclare = new Set(declares);
  placement.forEach(({ sieges, reserve, absents = [] }, rang) => {
    const tour = rang + 1;
    if (sieges.length !== tables.length) {
      liste.push({ code: 'LONGUEUR', tour, table: null, declare: tables.length, ecrit: sieges.length });
    }
    const appariees = Math.min(sieges.length, tables.length);
    for (let i = 0; i < appariees; i += 1) {
      if (sieges[i].length > capacites[i]) {
        liste.push({ code: 'LONGUEUR', tour, table: tables[i], declare: capacites[i], ecrit: sieges[i].length });
      }
    }
    const occurrences = new Map();
    const inconnus = [];
    for (const ids of [...sieges, reserve, absents]) {
      for (const id of ids) {
        if (id === null) continue;
        const deja = occurrences.get(id) ?? 0;
        occurrences.set(id, deja + 1);
        if (deja === 0 && !estDeclare.has(id)) inconnus.push(id);
      }
    }
    for (const id of declares) {
      if (occurrences.get(id) > 1) liste.push({ code: 'DOUBLON', tour, participant: id });
    }
    for (const id of inconnus.sort(croissant)) liste.push({ code: 'INCONNU', tour, participant: id });
    for (const id of declares) {
      if (!occurrences.has(id)) liste.push({ code: 'MANQUANT', tour, participant: id });
    }
  });
  return liste;
}

// Chemin, sous chemin, de la n-ième occurrence de id (n à partir de 1) dans
// un tour de placement, ses listes de table dans leur ordre, puis sa
// réserve, puis ses absents, chacune dans l'ordre de ses rangs ; le tour en
// porte au moins n.
function cheminDOccurrence({ sieges, reserve, absents = [] }, id, n, chemin) {
  const places = [
    ...sieges.flatMap((liste, table) =>
      liste.map((occupant, rang) => [occupant, `${chemin}.sieges[${table}][${rang}]`]),
    ),
    ...reserve.map((occupant, rang) => [occupant, `${chemin}.reserve[${rang}]`]),
    ...absents.map((occupant, rang) => [occupant, `${chemin}.absents[${rang}]`]),
  ];
  return places.filter(([occupant]) => occupant === id)[n - 1][1];
}

// Chemin, sous chemin — celui d'un placement —, de ce que désigne une faute
// de cohérence de ce placement (fautesDeCoherence), sous la déclaration
// qui l'accompagne : le placement pour son nombre de tours ; la liste des
// tables d'un tour pour leur nombre ; la liste d'une table au-delà de sa
// capacité ; le second exemplaire d'un doublon, le premier d'un inconnu ;
// le tour d'un manquant, qu'aucune place ne porte.
function cheminDeFaute(faute, { tables, placement }, chemin) {
  const { code, tour } = faute;
  if (tour === null) return chemin;
  const cheminDuTour = `${chemin}[${tour - 1}]`;
  if (code === 'LONGUEUR') {
    return faute.table === null ? `${cheminDuTour}.sieges` : `${cheminDuTour}.sieges[${tables.indexOf(faute.table)}]`;
  }
  if (code === 'MANQUANT') return cheminDuTour;
  return cheminDOccurrence(placement[tour - 1], faute.participant, code === 'DOUBLON' ? 2 : 1, cheminDuTour);
}

// Les abscisses des points de relevé d'une course à evalues mouvements
// évalués (§ 5.10) : chaque puissance de dix strictement inférieure à
// evalues, croissantes ; aucune quand evalues vaut 0 ou 1.
function abscisses(evalues) {
  const liste = [];
  for (let mouvements = 1; mouvements < evalues; mouvements *= 10) liste.push(mouvements);
  return liste;
}

/**
 * Chemin de la première contradiction de course, la course de la recherche
 * de la proposition de fichier p (§ 5.10, § 8.9), ou null quand il n'y en
 * a aucune. Le chemin part de « course » : la course elle-même quand elle
 * n'est pas un objet, sinon la première valeur hors de sa règle
 * (ENTREE_DE_COURSE) — aucune valeur mesurée, aucune durée, aucune clé
 * inconnue ; puis evalues au-delà de l'arret de p ; puis, point après
 * point, un point en trop, une abscisse qui n'est pas la puissance de dix
 * de son rang, et le placement de relevé, contrôlé sous la déclaration de
 * p comme son propre placement — chaises vides, puis longueurs et
 * multiensemble, réserve et absents compris, nommés comme fautes les nomme
 * sous course.releves[i].placement —, puis les absents de chacun de ses
 * tours, qui égalent ceux de p au même tour, comme ensembles : la recherche
 * ne déplace jamais une absente, et un écart se nomme
 * course.releves[i].placement[r].absents, la liste manquât-elle d'un côté ;
 * enfin un point qui manque, nommé au rang qui le porterait. Une abscisse égale à evalues est en trop : ce point est
 * le placement de p, qui ne s'écrit pas deux fois. Ne modifie rien ; lève
 * TypeError quand p n'est pas une proposition cohérente (fautes), qui ne
 * déclare rien sous quoi lire la course.
 *
 * @param {import('./types.js').PropositionFichier} p
 * @param {*} course
 * @returns {string|null}
 */
export function fauteDeCourse(p, course) {
  exigerProposition(p, 'fauteDeCourse');
  const forme = premiereFaute(course, COURSE, 'course');
  if (forme !== null) return forme;
  if (course.evalues > p.arret) return 'course.evalues';
  const attendues = abscisses(course.evalues);
  for (let i = 0; i < course.releves.length; i += 1) {
    const chemin = `course.releves[${i}]`;
    if (i >= attendues.length) return chemin;
    const { mouvements, placement } = course.releves[i];
    if (mouvements !== attendues[i]) return `${chemin}.mouvements`;
    const releve = { ...p, placement };
    const chaise = fauteDeChaiseVide(releve);
    if (chaise !== null) return `${chemin}.${chaise}`;
    const [premiere] = fautesDeCoherence(releve);
    if (premiere !== undefined) return cheminDeFaute(premiere, releve, `${chemin}.placement`);
    const ecart = placement.findIndex((tour, rang) => !memesAbsents(tour, p.placement[rang]));
    if (ecart >= 0) return `${chemin}.placement[${ecart}].absents`;
  }
  return course.releves.length < attendues.length ? `course.releves[${course.releves.length}]` : null;
}

// Les absents d'un tour de placement, rangés : une liste neuve, vide quand le
// tour n'en porte pas.
const absentsRanges = ({ absents = [] }) => [...absents].sort(croissant);

// Vrai quand deux tours de placement portent les mêmes absents, comme
// ensembles : une liste absente vaut une liste vide.
function memesAbsents(a, b) {
  const [x, y] = [absentsRanges(a), absentsRanges(b)];
  return x.length === y.length && x.every((id, rang) => id === y[rang]);
}

// Faute de la dérivation d'une proposition de forme conforme (§ 8.9), ou
// null, la première dans cet ordre : un départ qui ne précède pas son
// identifiant ; un tour figé au-delà des tours déclarés, le premier ; des
// tours figés qui portent chaque tour déclaré — une liste strictement
// croissante de tours de 1 à tours qui en compte autant ; des tours figés
// sans départ. La forme garantit des entiers et une liste croissante. Un
// départ absent de la liste n'en est pas une : seule la proposition se lit.
function fauteDeDerivation({ id, depart, toursFiges, tours }) {
  const faute = (chemin, raison) => ({ code: 'DERIVATION', chemin, raison });
  if (depart !== undefined && depart >= id) return faute('depart', 'departNonAnterieur');
  if (toursFiges === undefined) return null;
  const hors = toursFiges.findIndex((tour) => tour > tours);
  if (hors >= 0) return faute(`toursFiges[${hors}]`, 'tourHorsSoiree');
  if (toursFiges.length === tours) return faute('toursFiges', 'tousLesTours');
  if (depart === undefined) return faute('toursFiges', 'sansDepart');
  return null;
}

// Fautes de valeur sous regle : la première faute de forme, seule ; puis,
// d'une proposition, la faute de sa dérivation, seule ; puis la première
// faute de déclaration ou de chaise vide, seule, qui rend la cohérence
// illisible ; sinon les fautes de cohérence.
function fautesSelon(valeur, regle) {
  const forme = premiereFaute(valeur, regle);
  if (forme !== null) return [{ code: 'FORME', chemin: forme }];
  const derivation = regle === PROPOSITION ? fauteDeDerivation(valeur) : null;
  if (derivation !== null) return [derivation];
  const chemin = fauteDeDeclaration(valeur) ?? fauteDeChaiseVide(valeur);
  return chemin === null ? fautesDeCoherence(valeur) : [{ code: 'FORME', chemin }];
}

/**
 * Fautes internes d'un placement, proposition ou retenu (§ 8.9, points 1 et
 * 2) : il se compare à lui-même, jamais à la charge. La règle est celle du
 * retenu quand p porte la clé proposition, celle d'une proposition sinon.
 *
 * La forme se contrôle d'abord, dans l'ordre du schéma — une liste de tours
 * figés vide, désordonnée ou non entière comprise —, puis la dérivation
 * d'une proposition, puis la déclaration, puis les chaises vides : null,
 * admis par la règle d'une liste de table, n'y est cohérent que sous des
 * sièges attribués et avant le dernier rang. La première de ces fautes est
 * seule rendue : { code: 'FORME', chemin }, ou, pour la dérivation,
 * { code: 'DERIVATION', chemin, raison }, que décrit Faute. Un départ
 * absent de la liste n'est pas une faute : fautes ne lit que p. Sinon, dans
 * l'ordre des tours puis des tables :
 * { code: 'LONGUEUR', tour, table, declare, ecrit } — tour null pour le
 * nombre de tours, rendu en premier ; table null pour le nombre de listes
 * d'un tour ; une table pour une liste plus longue que sa capacité — puis,
 * dans chaque tour, { code: 'DOUBLON'|'INCONNU'|'MANQUANT', tour,
 * participant } par identifiant croissant. Rend [] pour un placement
 * cohérent ; ne lève jamais. Une clé course, que le fichier d'état ne
 * connaît pas, est une faute FORME comme toute clé inconnue.
 *
 * Une permutation dans une table, ou l'échange du contenu de deux tables de
 * même capacité, gardent longueurs et multiensemble : rien dans le fichier
 * ne les distingue d'un placement légitime, et fautes rend [].
 *
 * @param {*} p
 * @returns {Faute[]}
 */
export function fautes(p) {
  const retenu = typeof p === 'object' && p !== null && Object.hasOwn(p, 'proposition');
  return fautesSelon(p, retenu ? RETENU : PROPOSITION);
}

// Lève TypeError, au nom de fonction, quand p n'est pas un placement
// cohérent : le lire rendrait sans le dire une lecture fausse.
function exigerCoherent(p, fonction) {
  const [premiere] = fautes(p);
  if (premiere !== undefined) throw new TypeError(`${fonction} : placement fautif ${JSON.stringify(premiere)}`);
}

// Lève TypeError, au nom de fonction, quand p n'est pas une proposition de
// fichier cohérente : un retenu, qui n'a pas de course, ou un placement
// fautif (exigerCoherent).
function exigerProposition(p, fonction) {
  if (typeof p === 'object' && p !== null && Object.hasOwn(p, 'proposition')) {
    throw new TypeError(`${fonction} : proposition attendue, reçu le retenu`);
  }
  exigerCoherent(p, fonction);
}

// Le placement de fichier d'un plan du moteur (§ 8.9), tour par tour : sans
// attribution de sièges, chaque liste de table triée par identifiant
// croissant ; avec, dans son ordre, celui des sièges, chaises vides
// comprises. La réserve, un ensemble, se trie dans les deux cas. absents[r]
// donne les absents du tour r + 1, que le plan du moteur ne liste pas : la
// clé s'écrit triée quand la liste n'est pas vide, et manque sinon. Rien
// n'est partagé avec le plan ni avec absents.
function placementDeFichier({ tours, reserves }, attribuerSieges, absents) {
  const ordonner = (liste) => (attribuerSieges ? [...liste] : [...liste].sort(croissant));
  return tours.map((listes, rang) => {
    const tour = { sieges: listes.map((liste) => ordonner(liste)), reserve: [...reserves[rang]].sort(croissant) };
    if (absents[rang].length > 0) tour.absents = [...absents[rang]].sort(croissant);
    return tour;
  });
}

// Les champs de dérivation d'une proposition de fichier, dans l'ordre du
// schéma : aucun sans derivation ; depart, puis toursFiges, copiée, quand
// elle porte au moins un tour.
function champsDeDerivation(derivation) {
  if (derivation === null) return {};
  const { depart, toursFiges } = derivation;
  return toursFiges.length === 0 ? { depart } : { depart, toursFiges: [...toursFiges] };
}

/**
 * Forme de fichier d'une proposition du moteur (§ 8.9). Son identifiant est
 * decalage + proposition.id : la place de la proposition dans la suite des
 * graines dérivées de sa génération (§ 5.7), que le moteur numérote à partir
 * de 1, décalée au-delà de tout identifiant de proposition jamais attribué.
 * L'appelant passe pour decalage prochainsIds.proposition − 1, ce compteur
 * lu dans la charge qu'examiner rend, puis porte le compteur au-delà du
 * dernier identifiant écrit. examiner le relève au-delà de chaque
 * identifiant que le fichier porte, propositions écartées et origine du
 * retenu comprises : ce compteur dépasse les identifiants de la liste, celui
 * de la proposition d'origine du retenu et ceux qu'un effacement a retirés,
 * et ne recule jamais, même abaissé à la main dans le fichier. Les
 * générations s'accumulent ainsi (§ 5.7) sans répéter ni réattribuer un
 * identifiant, et examiner, qui écarte à l'ouverture la seconde proposition
 * d'un identifiant répété, les garde toutes.
 *
 * Elle porte ensuite graine, arret et historique de la proposition ; sous
 * derivation, { depart, toursFiges }, depart, un identifiant de fichier, déjà
 * décalé par l'appelant, puis toursFiges, une copie de la liste reçue,
 * absente quand elle est vide ; derivation null, aucun des deux, et la forme
 * reste octet pour octet celle d'une proposition ordinaire ; puis
 * produitVersion, et siegesAttribues, qui vaut attribuerSieges au moment où
 * elle est produite ; puis ce que la configuration déclare : les tables du
 * plan, dans l'ordre de ses listes, chacune avec sa capacité dans la
 * configuration, lue par identifiant ; le nombre de tours ; les participants
 * non exclus, par identifiant croissant. Le placement reprend le plan tour
 * par tour : sans attribution de sièges, chaque liste de table se trie par
 * identifiant croissant ; avec, elle garde son ordre, celui des sièges, et
 * ses chaises vides, null. La réserve, un ensemble, se trie dans les deux
 * cas. Les absents de chaque tour, que le plan du moteur ne liste pas, se
 * tirent de la présence des participants déclarés dans la configuration
 * (absentsParTour) : la clé absents s'écrit au tour qui en a. La course que
 * la proposition du moteur rapporte — evalues, releves
 * — n'y entre pas : courseVersFichier la met en forme pour le compagnon des
 * courses. Les clés suivent l'ordre du schéma ; rien n'est partagé avec les
 * arguments, qui ne sont pas modifiés.
 *
 * Lève ErreurStockage('COMPTEUR_SATURE', { compteur: 'proposition' }), sans
 * rien rendre, quand l'identifiant atteint 2^31 − 1, le plus grand
 * qu'admette la règle d'un identifiant, que suit aussi le compteur, qui
 * n'aurait alors aucune valeur au-delà de lui. Un fichier valide y mène — un
 * compteur écrit à la main à 2^31 − 1, ou un identifiant qui l'y relève — et
 * le compteur ne recule jamais : l'appelant lit ce code avant d'écrire la
 * génération. Lève TypeError, sans rien rendre, quand decalage n'est pas un
 * entier ≥ 0, quand derivation n'est ni null ni un objet qui porte depart
 * et la liste toursFiges, ou quand la forme produite serait fautive :
 * attribuerSieges qui n'est pas un booléen, version vide ou absente, réglage
 * hors de son domaine, plan que la configuration contredit — table inconnue
 * d'elle, nombre de tours, personne non placée, personne assise ou en
 * réserve à un tour où elle est absente, liste au-delà d'une capacité,
 * chaise vide sans attribution ou en fin de liste —, dérivation fautive
 * (fautes : FORME ou DERIVATION).
 *
 * @param {import('../moteur/recherche.js').Proposition} proposition
 * @param {import('../moteur/types.js').Configuration} configuration
 * @param {{produitVersion: string, attribuerSieges: boolean, decalage: number,
 *          derivation?: {depart: number, toursFiges: number[]}|null}} options
 * @returns {import('./types.js').PropositionFichier}
 */
export function versFichier(proposition, configuration, { produitVersion, attribuerSieges, decalage, derivation = null }) {
  // Le décalage se contrôle avant la forme : négatif, il peut rendre un
  // identifiant que la forme admet et qu'une autre proposition porte déjà.
  if (!Number.isSafeInteger(decalage) || decalage < 0) {
    throw new TypeError(`versFichier : décalage entier ≥ 0 attendu, reçu ${JSON.stringify(decalage)}`);
  }
  // Un départ absent laisserait la clé à undefined, que la forme d'un champ
  // facultatif admet : il se refuse ici.
  const derivationLisible =
    derivation === null ||
    (typeof derivation === 'object' && derivation.depart !== undefined && Array.isArray(derivation.toursFiges));
  if (!derivationLisible) {
    throw new TypeError(`versFichier : dérivation {depart, toursFiges} ou null attendue, reçu ${JSON.stringify(derivation)}`);
  }
  // Le compteur que l'appelant porte au-delà de l'identifiant écrit suit la
  // règle d'un identifiant : un identifiant qui atteint le plus grand
  // qu'elle admet ne laisserait aucun compteur au-delà de lui.
  const identifiant = decalage + proposition.id;
  if (identifiant >= IDENTIFIANT.max) throw new ErreurStockage('COMPTEUR_SATURE', { compteur: 'proposition' });
  const { plan } = proposition;
  const capaciteDe = new Map(configuration.tables.map(({ id, capacite: places }) => [id, places]));
  const fichier = {
    id: identifiant,
    graine: proposition.graine,
    arret: proposition.arret,
    historique: proposition.historique,
    ...champsDeDerivation(derivation),
    produitVersion,
    siegesAttribues: attribuerSieges,
    tables: [...plan.tables],
    capacites: plan.tables.map((id) => capaciteDe.get(id)),
    tours: configuration.tours,
    participants: configuration.participants
      .filter(({ exclu }) => exclu !== true)
      .map(({ id }) => id)
      .sort(croissant),
    placement: placementDeFichier(plan, attribuerSieges, absentsParTour(configuration.participants, configuration.tours)),
  };
  exigerCoherent(fichier, 'versFichier');
  return fichier;
}

/**
 * La course de la recherche d'une proposition du moteur mise en forme de
 * fichier (§ 5.10, § 8.9), pour le compagnon des courses : { evalues,
 * releves }, chaque point de relevé { mouvements, placement }, dans l'ordre
 * des points reçus, son placement mis en forme du plan du point comme
 * versFichier met en forme celui de la proposition, sous le même drapeau
 * attribuerSieges, chaque tour avec les absents de fichier au même tour.
 * fichier est la proposition de fichier que versFichier a
 * rendue pour elle, sous laquelle la course se contrôle (fauteDeCourse).
 * Rend null quand proposition.evalues n'est pas un nombre : un appelant qui
 * ne rapporte pas la course. Rien n'est partagé avec les arguments, qui ne
 * sont pas modifiés.
 *
 * Lève TypeError, sans rien rendre, quand la course contredit fichier,
 * nommée par son chemin (fauteDeCourse) — des points de relevé absents
 * laissent releves absente, que la faute nomme —, et quand le plan d'un
 * point de relevé déclare d'autres tables que celui de la proposition,
 * dans un autre ordre compris : ses listes ne s'apparieraient pas aux
 * tables déclarées, et deux tables de même capacité échangées ne se voient
 * pas dans le placement.
 *
 * @param {import('../moteur/recherche.js').Proposition} proposition
 * @param {import('./types.js').PropositionFichier} fichier
 * @param {{attribuerSieges: boolean}} options
 * @returns {{evalues: number, releves: {mouvements: number, placement: import('./types.js').TourDePlacement[]}[]}|null}
 */
export function courseVersFichier(proposition, fichier, { attribuerSieges }) {
  if (typeof proposition.evalues !== 'number') return null;
  const { tables } = proposition.plan;
  const releves = proposition.releves?.map(({ mouvements, plan }, i) => {
    if (plan.tables.length !== tables.length || plan.tables.some((id, rang) => id !== tables[rang])) {
      throw new TypeError(`courseVersFichier : le point de relevé ${i} déclare d'autres tables que le plan`);
    }
    return { mouvements, placement: placementDeFichier(plan, attribuerSieges, fichier.placement.map(absentsRanges)) };
  });
  const course = { evalues: proposition.evalues, releves };
  const faute = fauteDeCourse(fichier, course);
  if (faute !== null) throw new TypeError(`courseVersFichier : course fautive ${JSON.stringify({ chemin: faute })}`);
  return course;
}

/**
 * Plan du moteur d'un placement de fichier, proposition ou retenu : les
 * tables dans l'ordre déclaré, chaque liste de table sans ses chaises
 * vides, et chaque réserve, par identifiant croissant, comme le moteur les
 * rend ; l'ordre des sièges n'y entre pas. Le plan n'a pas d'absents : une
 * absente n'y est listée nulle part, et le moteur lit sa présence dans
 * l'instance. Aucune liste n'est partagée avec p. Lève TypeError quand p
 * n'est pas cohérent (fautes).
 *
 * @param {import('./types.js').PropositionFichier|import('./types.js').Retenu} p
 * @returns {import('../moteur/types.js').Plan}
 */
export function planDepuisFichier(p) {
  exigerCoherent(p, 'planDepuisFichier');
  return planSansRevalider(p);
}

/**
 * planDepuisFichier sans la validation : le même plan, pour un placement
 * dont l'appelant vient de lire fautes(p) vide. evaluer (evaluation.js) est
 * son seul appelant, qui valide chaque placement une fois avant de le lire ;
 * tout autre passe par planDepuisFichier. Un placement fautif y rend un
 * plan faux, sans lever.
 *
 * @param {import('./types.js').PropositionFichier|import('./types.js').Retenu} p
 * @returns {import('../moteur/types.js').Plan}
 */
export function planSansRevalider(p) {
  return {
    tables: [...p.tables],
    tours: p.placement.map(({ sieges }) => sieges.map((liste) => liste.filter((id) => id !== null).sort(croissant))),
    reserves: p.placement.map(({ reserve }) => [...reserve].sort(croissant)),
  };
}

/**
 * Les plans de course, la course de la recherche de la proposition de
 * fichier p (§ 5.10, § 8.9) : { evalues, releves }, chaque point de relevé
 * { mouvements, plan }, son plan rendu comme planDepuisFichier rend celui
 * de p — tables déclarées, listes par identifiant croissant sans chaise
 * vide, réserves rangées —, dans l'ordre des points. Aucune liste n'est
 * partagée avec p ni avec course. Lève TypeError quand p n'est pas une
 * proposition cohérente, et quand course la contredit (fauteDeCourse) :
 * une course contradictoire ne se lit jamais.
 *
 * @param {import('./types.js').PropositionFichier} p
 * @param {{evalues: number, releves: Object[]}} course
 * @returns {{evalues: number, releves: {mouvements: number, plan: import('../moteur/types.js').Plan}[]}}
 */
export function courseDepuisFichier(p, course) {
  const faute = fauteDeCourse(p, course);
  if (faute !== null) throw new TypeError(`courseDepuisFichier : course fautive ${JSON.stringify({ chemin: faute })}`);
  const { evalues, releves } = course;
  return {
    evalues,
    releves: releves.map(({ mouvements, placement }) => ({ mouvements, plan: planSansRevalider({ ...p, placement }) })),
  };
}

// Code, comparé unité UTF-16 par unité, puis identifiant du participant ou
// de la table que la raison désigne ; TOURS_CHANGES n'en désigne aucun et
// n'apparaît qu'une fois.
const ordreDesRaisons = (a, b) =>
  comparerTextes(a.code, b.code) || (a.participant ?? a.table ?? 0) - (b.participant ?? b.table ?? 0);

// Les tours de 1 à n où le placement dit la personne absente et la charge
// présente, puis ceux où il ne la dit pas absente et où la charge la dit
// absente : { ajoutes, retires }, croissants. absentsDuTour[r − 1] est
// l'ensemble des absents du tour r du placement, construit une fois par
// placement : une personne se lit en O(n), sans parcourir une liste de table.
function ecartsDePresence(personne, absentsDuTour, n) {
  const ajoutes = [];
  const retires = [];
  for (let tour = 1; tour <= n; tour += 1) {
    const present = estPresentAuTour(personne, tour);
    const ditAbsente = absentsDuTour[tour - 1].has(personne.id);
    if (present && ditAbsente) ajoutes.push(tour);
    else if (!present && !ditAbsente) retires.push(tour);
  }
  return { ajoutes, retires };
}

// Raisons de dérive d'un placement cohérent, sans contrôle : derive les
// rend après l'avoir contrôlé, examiner après l'avoir fait lui-même,
// deriveSansRevalider après que son appelant l'a fait.
function raisonsDeDerive({ tables, capacites, tours, participants, placement }, charge) {
  const raisons = [];
  const personneDe = new Map(charge.participants.map((personne) => [personne.id, personne]));
  const places = new Set(participants);
  const communs = Math.min(tours, charge.evenement.tours);
  const absentsDuTour = placement.slice(0, communs).map(({ absents = [] }) => new Set(absents));
  for (const id of participants) {
    const personne = personneDe.get(id);
    if (personne === undefined) raisons.push({ code: 'PARTICIPANT_SUPPRIME', participant: id });
    else if (personne.exclu) raisons.push({ code: 'PARTICIPANT_EXCLU', participant: id });
    else {
      const { ajoutes, retires } = ecartsDePresence(personne, absentsDuTour, communs);
      if (retires.length > 0) raisons.push({ code: 'PRESENCE_RETIREE', participant: id, tours: retires });
      if (ajoutes.length > 0) raisons.push({ code: 'PRESENCE_AJOUTEE', participant: id, tours: ajoutes });
    }
  }
  for (const { id, exclu } of charge.participants) {
    if (!exclu && !places.has(id)) raisons.push({ code: 'PARTICIPANT_NON_PLACE', participant: id });
  }
  const tableDe = new Map(charge.tables.map((table) => [table.id, table]));
  tables.forEach((id, rang) => {
    const table = tableDe.get(id);
    if (table === undefined) {
      raisons.push({ code: 'TABLE_SUPPRIMEE', table: id });
      return;
    }
    const maintenant = capacite(charge, table);
    if (maintenant !== capacites[rang]) {
      raisons.push({ code: 'CAPACITE_CHANGEE', table: id, avant: capacites[rang], maintenant });
    }
  });
  const declarees = new Set(tables);
  for (const { id } of charge.tables) {
    if (!declarees.has(id)) raisons.push({ code: 'TABLE_AJOUTEE', table: id });
  }
  if (tours !== charge.evenement.tours) {
    raisons.push({ code: 'TOURS_CHANGES', avant: tours, maintenant: charge.evenement.tours });
  }
  return raisons.sort(ordreDesRaisons);
}

/**
 * Raisons de dérive d'un placement cohérent, proposition ou retenu, contre
 * la charge courante (§ 8.9, point 3 ; § 9) : ce qu'il déclare comparé à la
 * configuration d'aujourd'hui. Une personne qu'il place et que la charge
 * exclut (§ 4.4), ou n'a plus : PARTICIPANT_EXCLU, PARTICIPANT_SUPPRIME
 * {participant}. Une personne non exclue qu'il ne place pas, ajoutée ou
 * réintégrée depuis : PARTICIPANT_NON_PLACE {participant}. Une personne
 * qu'il déclare, que la charge porte sans l'exclure, et dont la présence a
 * changé depuis, sur les tours de 1 au plus petit de ses tours et de ceux de
 * l'événement : PRESENCE_RETIREE {participant, tours} pour les tours où il
 * l'assied ou la réserve et où la charge la dit absente, PRESENCE_AJOUTEE
 * {participant, tours} pour ceux où il la dit absente et la charge
 * présente, tours croissants et non vides. Une table qu'il
 * déclare et que la charge n'a plus, ou une table de la charge qu'il ne
 * déclare pas : TABLE_SUPPRIMEE, TABLE_AJOUTEE {table}. Une capacité
 * déclarée qui n'est plus la capacité courante de sa table :
 * CAPACITE_CHANGEE {table, avant, maintenant}. Un nombre de tours qui n'est
 * plus celui de l'événement : TOURS_CHANGES {avant, maintenant}.
 *
 * Triées par code, unité UTF-16 par unité, puis par identifiant ; [] quand
 * le placement décrit la configuration courante : son plan passe alors
 * indexerPlan du moteur sur elle. Le coût est linéaire en participants
 * déclarés et en tours : les absents de chaque tour s'indexent une fois. Noms, appartenances, numéros, positions,
 * formes de table et réglages n'entrent pas dans la dérive. Lève TypeError
 * quand p n'est pas cohérent (fautes).
 *
 * @param {import('./types.js').PropositionFichier|import('./types.js').Retenu} p
 * @param {import('./types.js').Charge} charge
 * @returns {Raison[]}
 */
export function derive(p, charge) {
  exigerCoherent(p, 'derive');
  return raisonsDeDerive(p, charge);
}

/**
 * derive sans la validation : les mêmes raisons, pour un placement dont
 * l'appelant vient de lire fautes(p) vide. evaluer (evaluation.js) est son
 * seul appelant, qui valide chaque placement une fois avant de le lire ;
 * tout autre passe par derive. Un placement fautif y rend des raisons
 * fausses, sans lever.
 *
 * @param {import('./types.js').PropositionFichier|import('./types.js').Retenu} p
 * @param {import('./types.js').Charge} charge
 * @returns {Raison[]}
 */
export function deriveSansRevalider(p, charge) {
  return raisonsDeDerive(p, charge);
}

// Les raisons de dérive des participants, rangées : une dérivée les absorbe
// en alignant son départ sur la charge (ajusterALaPresence).
const CODES_DE_PARTICIPANTS = new Set([
  'PARTICIPANT_EXCLU',
  'PARTICIPANT_NON_PLACE',
  'PARTICIPANT_SUPPRIME',
  'PRESENCE_AJOUTEE',
  'PRESENCE_RETIREE',
]);

/**
 * Les raisons de dérive des participants (§ 5.7) : PARTICIPANT_EXCLU,
 * PARTICIPANT_NON_PLACE, PARTICIPANT_SUPPRIME, PRESENCE_AJOUTEE et
 * PRESENCE_RETIREE. Une proposition qui ne dérive que par elles peut servir
 * de départ : ajusterALaPresence l'aligne sur la charge. La vue est gelée
 * et ne lit qu'un ensemble privé au module : ni add, ni delete, ni clear ;
 * elle itère les codes par unités UTF-16 croissantes.
 *
 * @type {Readonly<{has: (code: string) => boolean, [Symbol.iterator]: () => Iterator<string>}>}
 */
export const RAISONS_DE_PARTICIPANTS = Object.freeze({
  has: (code) => CODES_DE_PARTICIPANTS.has(code),
  [Symbol.iterator]: () => CODES_DE_PARTICIPANTS.values(),
});

/**
 * Les raisons qui interdisent qu'un placement serve de départ : la
 * sous-liste des raisons reçues hors de RAISONS_DE_PARTICIPANTS — tables,
 * capacités, tours —, dans l'ordre reçu, chacune telle quelle. [] quand le
 * placement ne dérive que par ses participants. Ne modifie pas la liste.
 *
 * @param {Raison[]} raisons
 * @returns {Raison[]}
 */
export function raisonsQuiBloquentUnDepart(raisons) {
  return raisons.filter(({ code }) => !CODES_DE_PARTICIPANTS.has(code));
}

// Lieux d'une personne à un tour, dans l'index d'un tour de placement : le
// rang de sa liste de table, ou l'un de ces deux marqueurs.
const EN_RESERVE = -1;
const ABSENTE = -2;

// L'index d'un tour de placement : identifiant → lieu, le rang d'une liste
// de table, EN_RESERVE ou ABSENTE. Une chaise vide n'y entre pas.
function indexDuTour({ sieges, reserve, absents = [] }) {
  const index = new Map();
  sieges.forEach((liste, rang) => {
    for (const id of liste) if (id !== null) index.set(id, rang);
  });
  for (const id of reserve) index.set(id, EN_RESERVE);
  for (const id of absents) index.set(id, ABSENTE);
  return index;
}

// Retire id de son lieu dans le tour, en place, et de l'index : sous des
// sièges attribués, sa chaise devient null et les null de fin de liste
// partent ; sans attribution, il quitte sa liste, qui garde son ordre. La
// clé absents part quand sa liste se vide.
function retirerDuTour(tour, index, id, siegesAttribues) {
  const lieu = index.get(id);
  index.delete(id);
  if (lieu >= 0) {
    const liste = tour.sieges[lieu];
    const rang = liste.indexOf(id);
    if (siegesAttribues) {
      liste[rang] = null;
      while (liste.length > 0 && liste.at(-1) === null) liste.pop();
    } else {
      liste.splice(rang, 1);
    }
    return;
  }
  const cle = lieu === EN_RESERVE ? 'reserve' : 'absents';
  tour[cle].splice(tour[cle].indexOf(id), 1);
  if (cle === 'absents' && tour.absents.length === 0) delete tour.absents;
}

// Pose id dans la réserve ou les absents du tour, en place, et dans
// l'index ; la liste touchée se range par identifiant croissant, et absents
// s'écrit après reserve quand le tour n'en portait pas.
function poserDansLeTour(tour, index, id, lieu) {
  const cle = lieu === EN_RESERVE ? 'reserve' : 'absents';
  tour[cle] = [...(tour[cle] ?? []), id].sort(croissant);
  index.set(id, lieu);
}

/**
 * Le placement p — proposition, retenu ou départ — aligné sur les
 * participants de la charge pour les identifiants ids, sans rien d'autre
 * (§ 5.7, § 5.8, § 8.9). ids vaut par défaut chaque personne de la charge et
 * chaque participant que p déclare ; un identifiant que ni l'une ni l'autre
 * ne porte est ignoré. R est le nombre de tours de l'événement. Pour chaque
 * identifiant, par ordre croissant :
 * - absent de la charge, ou exclu, et déclaré : il quitte chaque liste de
 *   chaque tour — sous des sièges attribués sa chaise devient null et les
 *   null de fin de liste partent, sans attribution sa liste se resserre —,
 *   la réserve, les absents et la déclaration ; il va dans retires ;
 * - présent dans la charge, non exclu, non déclaré : il est déclaré, puis
 *   va à la réserve des tours de p où il est présent, R au plus, et aux
 *   absents des autres ; il va dans arrives avec ces tours de réserve, une
 *   liste vide quand il n'est présent à aucun tour de p ;
 * - déclaré, présent dans la charge, non exclu, à chaque tour r de 1 au
 *   plus petit de p.tours et de R : absent à r et assis ou en réserve, il
 *   quitte sa place et va aux absents de r (partis) ; présent à r et dans
 *   les absents de r, il va à la réserve de r (arrives). Une présente en
 *   réserve y reste : une réserve imposée d'une dérivée n'est pas défaite.
 * Les tables, les capacités, les tours au-delà de R et horodatage ne sont
 * pas touchés : l'appelant date un retenu changé. Une liste de réserve ou
 * d'absents qui reçoit quelqu'un se range ; une autre garde son ordre, et la
 * déclaration ne se récrit, rangée, que lorsqu'elle change.
 *
 * Idempotente : ajuster le placement rendu ne change plus rien. Rien n'est
 * partagé avec p ni avec la charge, qui ne sont pas modifiés. Invariant :
 * derive(placement rendu, charge) ne porte plus aucune raison de
 * RAISONS_DE_PARTICIPANTS pour un identifiant de ids, et le placement rendu
 * est cohérent. Chaque tour s'indexe une fois : le coût est linéaire en
 * participants et en tours. Lève TypeError quand p n'est pas cohérent
 * (fautes).
 *
 * @template {import('./types.js').PropositionFichier|import('./types.js').Retenu} P
 * @param {P} p
 * @param {import('./types.js').Charge} charge
 * @param {Iterable<number>} [ids]
 * @returns {{placement: P, partis: Array<{participant: number, tours: number[]}>,
 *            arrives: Array<{participant: number, tours: number[]}>, retires: number[]}}
 *          rangés par participant ; tous vides si et seulement si placement
 *          est égal à p
 */
export function ajusterALaPresence(p, charge, ids) {
  exigerCoherent(p, 'ajusterALaPresence');
  const ajuste = structuredClone(p);
  const R = charge.evenement.tours;
  const communs = Math.min(p.tours, R);
  const personneDe = new Map(charge.participants.map((personne) => [personne.id, personne]));
  const declares = new Set(p.participants);
  const demandes = ids === undefined ? [...personneDe.keys(), ...declares] : [...ids];
  const index = ajuste.placement.map(indexDuTour);
  const partis = [];
  const arrives = [];
  const retires = [];
  const nouveaux = [];
  for (const id of [...new Set(demandes)].sort(croissant)) {
    const personne = personneDe.get(id);
    const declare = declares.has(id);
    if (personne === undefined || personne.exclu === true) {
      if (!declare) continue;
      ajuste.placement.forEach((tour, rang) => retirerDuTour(tour, index[rang], id, ajuste.siegesAttribues));
      retires.push(id);
    } else if (!declare) {
      const tours = [];
      ajuste.placement.forEach((tour, rang) => {
        const present = rang < R && estPresentAuTour(personne, rang + 1);
        poserDansLeTour(tour, index[rang], id, present ? EN_RESERVE : ABSENTE);
        if (present) tours.push(rang + 1);
      });
      nouveaux.push(id);
      arrives.push({ participant: id, tours });
    } else {
      const quitte = [];
      const vient = [];
      for (let rang = 0; rang < communs; rang += 1) {
        const present = rang < R && estPresentAuTour(personne, rang + 1);
        if (present !== (index[rang].get(id) === ABSENTE)) continue;
        retirerDuTour(ajuste.placement[rang], index[rang], id, ajuste.siegesAttribues);
        poserDansLeTour(ajuste.placement[rang], index[rang], id, present ? EN_RESERVE : ABSENTE);
        (present ? vient : quitte).push(rang + 1);
      }
      if (quitte.length > 0) partis.push({ participant: id, tours: quitte });
      if (vient.length > 0) arrives.push({ participant: id, tours: vient });
    }
  }
  if (retires.length > 0 || nouveaux.length > 0) {
    const partants = new Set(retires);
    ajuste.participants = [...ajuste.participants.filter((id) => !partants.has(id)), ...nouveaux].sort(croissant);
  }
  return { placement: ajuste, partis, arrives, retires };
}

// Ordre d'affichage des tables : numéro croissant, une table absente de la
// charge — numéro null — après les autres ; à numéro égal, identifiant
// croissant.
const ordreDesTables = (a, b) =>
  (a.numero === null) - (b.numero === null) || a.numero - b.numero || a.id - b.id;

/**
 * Forme nommée d'un placement, proposition ou retenu (§ 8.9, point 4) : une
 * ligne par identifiant écrit à un tour, { tour, table, numero, siege,
 * participant, nom, prenom, reserve, absent }, pour la lecture et le
 * signalement
 * d'un défaut. Les lignes se rangent par tour, puis par numéro de table —
 * une table que la charge n'a plus vient après les autres, sans numéro, et
 * l'identifiant départage deux numéros égaux —, puis par rang dans la
 * liste ; la réserve suit les tables de son tour, table et numéro null ;
 * les absents suivent la réserve, table, numéro et siège null, reserve faux
 * et absent vrai, le seul cas où absent est vrai.
 * siege est le rang à partir de 1 quand le placement attribue les sièges,
 * null sinon et dans la réserve ; une chaise vide, null dans la liste,
 * garde son rang et n'a pas de ligne. Nom et prénom viennent de la charge ; une
 * personne qu'elle n'a plus, ou qu'elle n'a jamais eue, les a null.
 *
 * Un placement incohérent (fautes : LONGUEUR, DOUBLON, INCONNU, MANQUANT)
 * se rend tel qu'il est écrit, pour que son défaut se lise : un identifiant
 * écrit deux fois donne deux lignes, un manquant aucune ; les tours écrits,
 * qu'ils soient plus ou moins nombreux que ceux déclarés ; une table
 * déclarée sans liste n'a pas de ligne, et une liste écrite au-delà des
 * tables déclarées suit les tables de son tour, sans table ni numéro, avant
 * la réserve. Ses fautes se lisent par fautes(p), que l'appelant rend à
 * côté. Lève TypeError quand la forme ou la déclaration de p est fausse
 * (faute FORME) : ses listes ne se lisent pas.
 *
 * @param {import('./types.js').PropositionFichier|import('./types.js').Retenu} p
 * @param {import('./types.js').Charge} charge
 * @returns {Ligne[]}
 */
export function formeNommee(p, charge) {
  const [premiere] = fautes(p);
  if (premiere?.code === 'FORME') throw new TypeError(`formeNommee : placement fautif ${JSON.stringify(premiere)}`);
  const personneDe = new Map(charge.participants.map((personne) => [personne.id, personne]));
  const numeroDe = new Map(charge.tables.map(({ id, numero }) => [id, numero]));
  const tables = p.tables
    .map((id, rang) => ({ id, rang, numero: numeroDe.get(id) ?? null }))
    .sort(ordreDesTables);
  const lignes = [];
  const ajouter = (tour, table, numero, siege, participant, reserve, absent = false) => {
    const personne = personneDe.get(participant);
    lignes.push({
      tour,
      table,
      numero,
      siege,
      participant,
      nom: personne?.nom ?? null,
      prenom: personne?.prenom ?? null,
      reserve,
      absent,
    });
  };
  // Les personnes d'une liste de table, sans table pour une liste écrite
  // au-delà des tables déclarées.
  const ajouterListe = (tour, ids, table, numero) => {
    ids.forEach((participant, position) => {
      if (participant === null) return;
      ajouter(tour, table, numero, p.siegesAttribues ? position + 1 : null, participant, false);
    });
  };
  p.placement.forEach(({ sieges, reserve, absents = [] }, rangDuTour) => {
    const tour = rangDuTour + 1;
    for (const { id, rang, numero } of tables) ajouterListe(tour, sieges[rang] ?? [], id, numero);
    for (const ids of sieges.slice(p.tables.length)) ajouterListe(tour, ids, null, null);
    for (const participant of reserve) ajouter(tour, null, null, null, participant, true);
    for (const participant of absents) ajouter(tour, null, null, null, participant, false, true);
  });
  return lignes;
}

// valeur quand elle est un identifiant de proposition, null sinon : un
// entier au-delà de 2^31 − 1 n'en est pas un.
const identifiantLisible = (valeur) => (premiereFaute(valeur, IDENTIFIANT) === null ? valeur : null);

// Compteur des propositions de la charge que rend examiner : celui de la
// charge, relevé au-delà de plusGrand, le plus grand identifiant lu, 0 quand
// aucun ne se lit ; il ne recule jamais. Le compteur suit la règle d'un
// identifiant : relevé, il s'arrête au plus grand qu'elle admet, 2^31 − 1,
// et un identifiant de cette valeur reste hors de lui.
const compteurReleve = (charge, plusGrand) =>
  Math.max(charge.prochainsIds.proposition, Math.min(plusGrand + 1, IDENTIFIANT.max));

// Faute d'un identifiant de proposition que la charge a attribué au-delà de
// son compteur, ou [] : prochainsIds.proposition dépasse tout identifiant
// attribué (§ 5.7).
const fautesDuCompteur = (id, charge) =>
  id >= charge.prochainsIds.proposition ? [{ code: 'IDENTIFIANT_HORS_COMPTEUR' }] : [];

// Fautes et raisons du retenu, examiné sous sa propre règle. Un retenu qui
// se contredit n'a que ses fautes ; un retenu cohérent a ses raisons de
// dérive, et la faute d'une proposition d'origine qui atteint le compteur ;
// un retenu nul n'a ni l'un ni l'autre.
function examinerRetenu(charge) {
  const { retenu } = charge;
  if (retenu === null) return { fautes: [], raisons: [] };
  const liste = fautesSelon(retenu, RETENU);
  if (liste.length > 0) return { fautes: liste, raisons: [] };
  return { fautes: fautesDuCompteur(retenu.proposition, charge), raisons: raisonsDeDerive(retenu, charge) };
}

/**
 * Partage les placements d'une charge lue (§ 8.9, point 3). L'analyse du
 * fichier admet toute proposition et tout retenu ; examiner les contrôle.
 *
 * Chaque élément de la liste est examiné dans son ordre, sous la règle
 * d'une proposition, même quand il porte la clé d'un retenu : fautif, il
 * est écarté et nommé dans fautives, { rang, id, fautes }, rang étant sa
 * place dans la liste et id son identifiant, null quand il n'en est pas un ;
 * cohérente, elle est gardée, et ses raisons de dérive, s'il y en a, vont
 * dans derives, { id, raisons }, rangées par identifiant. Une proposition
 * cohérente qui porte l'identifiant d'une proposition déjà gardée est
 * fautive, { code: 'IDENTIFIANT_REPETE' } ; celle dont l'identifiant atteint
 * prochainsIds.proposition aussi, { code: 'IDENTIFIANT_HORS_COMPTEUR' } :
 * l'identifiant d'une proposition est unique dans la charge rendue, et sous
 * le compteur, et le fichier s'ouvre sans elle. Un compteur abaissé écarte
 * ainsi les propositions qu'il ne couvre plus, qui se recalculent, sans
 * fermer la saisie. Une proposition écartée n'en écarte aucune autre : une
 * cohérente qui porte l'identifiant d'une fautive n'est pas une répétition,
 * et une fautive se nomme par ses propres fautes.
 *
 * Le retenu n'est jamais retiré : retenu porte ses fautes, sous la règle du
 * retenu. Cohérent, il porte aussi ses raisons de dérive, et pour faute
 * { code: 'IDENTIFIANT_HORS_COMPTEUR' } quand sa proposition d'origine
 * atteint prochainsIds.proposition. Un retenu nul n'a ni l'un ni l'autre.
 *
 * Ces fautes se jugent contre le compteur reçu. La charge rendue porte le
 * compteur relevé au-delà de chaque identifiant lu : prochainsIds.proposition
 * y vaut le plus grand du compteur reçu et du plus grand identifiant lu plus
 * un — celui de chaque élément de la liste, gardé ou écarté, quelle que soit
 * sa faute, et la proposition d'origine du retenu, fautif ou non ; une
 * valeur qui n'est pas un identifiant, un entier au-delà de 2^31 − 1
 * compris, n'y entre pas : la proposition qui la porte est fautive, FORME,
 * le retenu aussi. Le compteur ne recule donc jamais, et une génération
 * numérotée depuis lui, comme le dit versFichier, ne réattribue ni
 * l'identifiant d'une proposition écartée ni celui de l'origine du retenu :
 * le retenu ne désigne jamais une autre proposition que la sienne. Le
 * compteur suit la règle d'un identifiant, qui s'arrête à 2^31 − 1 ; un
 * identifiant de cette valeur reste hors de lui, et
 * IDENTIFIANT_HORS_COMPTEUR le nomme tant que le fichier le porte. Un
 * compteur à 2^31 − 1 ne numérote plus aucune génération : versFichier lève
 * COMPTEUR_SATURE.
 *
 * Rend une charge neuve, dont propositions ne porte que les gardées, dans
 * l'ordre de la liste, et prochainsIds un objet neuf, son compteur des
 * propositions relevé ; tout le reste, propositions gardées et retenu
 * compris, est celui de la charge reçue, qui n'est pas modifiée. Cette
 * charge s'écrit et se compare telle quelle : chaque proposition y suit sa
 * règle, et un retenu qui ne suit pas la sienne, canonique.js le recopie
 * hors du schéma (retenuHorsDeSaRegle).
 *
 * @param {import('./types.js').Charge} charge
 * @returns {Examen}
 */
export function examiner(charge) {
  const gardees = [];
  const fautives = [];
  const derives = [];
  const identifiants = new Set();
  let plusGrand = identifiantLisible(charge.retenu?.proposition) ?? 0;
  charge.propositions.forEach((proposition, rang) => {
    const id = identifiantLisible(proposition?.id);
    plusGrand = Math.max(plusGrand, id ?? 0);
    let liste = fautesSelon(proposition, PROPOSITION);
    if (liste.length === 0 && identifiants.has(proposition.id)) liste = [{ code: 'IDENTIFIANT_REPETE' }];
    if (liste.length === 0) liste = fautesDuCompteur(proposition.id, charge);
    if (liste.length > 0) {
      fautives.push({ rang, id, fautes: liste });
      return;
    }
    identifiants.add(proposition.id);
    gardees.push(proposition);
    const raisons = raisonsDeDerive(proposition, charge);
    if (raisons.length > 0) derives.push({ id: proposition.id, raisons });
  });
  derives.sort((a, b) => a.id - b.id);
  const prochainsIds = { ...charge.prochainsIds, proposition: compteurReleve(charge, plusGrand) };
  return {
    charge: { ...charge, prochainsIds, propositions: gardees },
    fautives,
    derives,
    retenu: examinerRetenu(charge),
  };
}
