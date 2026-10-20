// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le texte canonique du fichier d'état (§ 8.8, § 8.9), par le seul
// sérialiseur du stockage, qui suit le schéma du document. L'ordre des clés
// est celui des champs du schéma, jamais celui dans lequel un objet a reçu
// les siennes ; chaque liste se trie selon sa règle ; les valeurs s'écrivent
// par JSON.stringify. Le texte ne dépend que des arguments : ni horloge ni
// tirage n'y entrent au moment d'écrire.
//
// Mise en page, deux espaces par niveau. Un objet de mise « lignes » — le
// fichier, la charge — porte un champ par ligne, « "clé": valeur ». Une
// liste de mise « lignes » — les collections de la charge, le placement —
// porte un élément par ligne, et s'écrit [] sur la ligne de sa clé quand
// elle est vide. Un objet de mise « ouverte » — une proposition, le retenu —
// s'écrit compact sur la ligne qui l'ouvre, chaque champ selon sa propre
// règle : son placement y ouvre un crochet, porte un tour par ligne un
// niveau plus bas, et le referme au niveau de l'objet. Toute autre valeur
// s'écrit compacte, sur la ligne de sa clé.
//
// Un retenu que sa règle refuse, l'analyse l'admet, puisqu'elle n'en lit
// que le conteneur, et le contrôle des placements le garde en le signalant
// (§ 8.9, point 3). Le schéma ne décrit pas une telle forme : le retenu se
// recopie hors du schéma, ses clés rangées, ses listes dans l'ordre écrit,
// et s'écrit compact à la clé retenu. Le texte se relit ainsi au même
// retenu, et les gestes qui suivent s'enregistrent.
//
// Deux copies canoniques. canoniser rend une copie neuve, modifiable, qui ne
// partage rien. canoniserPartagee rend une copie à lire seulement : chaque
// proposition figée (gel.js) y est remplacée par sa copie canonique, faite
// une fois, figée à son tour et partagée entre les appels. Le texte de
// chacune de ces copies se rend une fois par retrait. Ces caches tiennent
// parce que rien de ce qu'atteint un objet figé ne change, et que la copie
// et le texte d'une proposition ne dépendent que d'elle : son ordre des
// sièges suit son propre drapeau siegesAttribues. Une proposition qui n'est
// pas figée — libre, ou gelée en surface par Object.freeze seul — se recopie
// à chaque appel. Les deux copies écrivent le même texte.
//
// recanoniser refait la copie canonique d'une copie canonique que des
// opérations ont modifiée en place : elle ne refait que les objets et les
// listes que les traces des opérations désignent, et le retenu entier dès
// qu'il est sali, puisqu'un retenu copié hors du schéma n'a pas d'enfants
// canoniques sous sa règle ; elle rend le reste tel quel, partagé avec la
// copie reçue. Le résultat est celui de canoniser.
import { FORMAT, SCHEMA, clesRangees, comptesDe, premiereFaute } from './document.js';
import { estFigee, figer } from './gel.js';

// Règle du champ cle d'un objet du schéma.
const regleDuChamp = (regle, cle) => regle.champs.find(([nom]) => nom === cle)[1];
const ENTETE = regleDuChamp(SCHEMA, 'entete');
const CHARGE = regleDuChamp(SCHEMA, 'charge');
const RETENU = regleDuChamp(CHARGE, 'retenu');
const PROPOSITIONS = regleDuChamp(CHARGE, 'propositions');
const PROPOSITION = PROPOSITIONS.element;
const PLACEMENT = regleDuChamp(PROPOSITION, 'placement');

// Copie canonique de chaque proposition figée, figée elle aussi ; chaque
// copie y est sa propre clé, une copie canonique étant sa propre forme
// canonique. Ne servent de clés que des objets figés et inscrits.
const CANONIQUES = new WeakMap();

// Texte de chaque copie canonique de CANONIQUES, par retrait : Map(retrait →
// texte). N'y entrent que les retraits où le fichier écrit une proposition,
// 4 sous serialiserCharge et 6 sous serialiser.
const TEXTES = new WeakMap();
const RETRAITS_EN_CACHE = [4, 6];

// Vrai pour un objet qui n'est ni null ni une liste.
const estObjet = (valeur) => typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);

/**
 * Vrai quand valeur, lue à la place que regle décrit, est un retenu que sa
 * règle refuse (premiereFaute) : un objet, que l'analyse admet et que le
 * contrôle des placements garde (§ 8.9, point 3). canoniser le recopie hors
 * du schéma, le texte l'écrit compact, et difference le pose entier. Faux
 * pour toute autre règle, pour null et pour un retenu qui n'est pas un
 * objet, que l'analyse refuse.
 *
 * @param {*} valeur
 * @param {import('./types.js').Regle} regle
 * @returns {boolean}
 */
export function retenuHorsDeSaRegle(valeur, regle) {
  return regle === RETENU && estObjet(valeur) && premiereFaute(valeur, RETENU) !== null;
}

// Copie de valeur hors du schéma : chaque objet refait, ses clés posées par
// unités UTF-16 croissantes, chaque liste dans son ordre, toute autre valeur
// telle quelle. JSON.stringify écrit les clés de la copie dans cet ordre,
// les clés d'index entier en tête, croissantes, comme JavaScript les
// énumère : le texte ne dépend que de l'ensemble des clés. Object.fromEntries
// pose chaque clé en propre, « __proto__ » comprise.
function copierHorsDuSchema(valeur) {
  if (Array.isArray(valeur)) return valeur.map(copierHorsDuSchema);
  if (!estObjet(valeur)) return valeur;
  return Object.fromEntries(clesRangees(valeur).map((cle) => [cle, copierHorsDuSchema(valeur[cle])]));
}

// Copie de valeur selon sa règle : chaque objet refait dans l'ordre de ses
// champs, chaque liste copiée, puis triée quand sa règle le demande ; l'ordre
// de la règle compare ainsi des copies déjà canoniques. Un objet qui a un
// champ siegesAttribues — une proposition, le retenu — en transmet la valeur
// à ce qu'il contient : ses listes de table ne se trient que quand il vaut
// faux. Le réglage attribuerSieges de la charge n'y entre pas. Les clés hors
// du schéma ne sont pas copiées. Un retenu que sa règle refuse se copie hors
// du schéma, entier. Un champ facultatif absent reste absent de la copie ;
// ailleurs, une clé du schéma absente lève TypeError en nommant son chemin :
// JSON.stringify la tairait, et le texte ne se relirait pas.
//
// partage vrai, que seul canoniserPartagee passe, et à la charge seule, fait
// copier la liste des propositions par copierPropositions, qui partage les
// propositions figées. Il ne descend pas plus bas : les propositions ne
// vivent que dans cette liste, et le reste de la copie suit le même chemin
// que sous canoniser.
function copier(valeur, regle, chemin, siegesAttribues, partage) {
  if (valeur === null) return null;
  if (retenuHorsDeSaRegle(valeur, regle)) return copierHorsDuSchema(valeur);
  if (regle.genre === 'objet') {
    const drapeau = regle.cles.has('siegesAttribues') ? valeur.siegesAttribues : siegesAttribues;
    const copie = {};
    for (const [cle, regleDeCle] of regle.champs) {
      const cheminDeCle = `${chemin}.${cle}`;
      if (valeur[cle] === undefined && regleDeCle.optionnel) continue;
      if (valeur[cle] === undefined) throw new TypeError(`${cheminDeCle} absente`);
      copie[cle] =
        partage && regleDeCle === PROPOSITIONS
          ? copierPropositions(valeur[cle], cheminDeCle)
          : copier(valeur[cle], regleDeCle, cheminDeCle, drapeau);
    }
    return copie;
  }
  if (regle.genre === 'liste') {
    const copie = valeur.map((element, rang) => copier(element, regle.element, `${chemin}[${rang}]`, siegesAttribues));
    if (regle.tri !== undefined) copie.sort(regle.tri);
    if (regle.triSansAttribution !== undefined && siegesAttribues === false) copie.sort(regle.triSansAttribution);
    return copie;
  }
  return valeur;
}

// Copie de valeur, la liste des propositions de la charge, comme copier la
// ferait, à ceci près que chaque proposition figée y prête sa copie
// canonique partagée (copiePartagee) ; toute autre se recopie. null se rend
// tel quel ; une valeur qui n'est pas une liste lève la TypeError de copier.
function copierPropositions(valeur, chemin) {
  if (valeur === null) return null;
  const copie = valeur.map((proposition, rang) =>
    estFigee(proposition)
      ? copiePartagee(proposition, `${chemin}[${rang}]`)
      : copier(proposition, PROPOSITION, `${chemin}[${rang}]`),
  );
  copie.sort(PROPOSITIONS.tri);
  return copie;
}

// Copie canonique partagée de proposition, une proposition figée : celle de
// CANONIQUES, ou, la première fois, sa copie par copier, figée puis inscrite
// sous la proposition et sous elle-même. Le drapeau siegesAttribues vient de
// la proposition, jamais de son contenant : la copie ne dépend que d'elle.
// Une proposition hors de sa règle lève la TypeError de copier, qui nomme
// chemin, et rien ne s'inscrit.
function copiePartagee(proposition, chemin) {
  let copie = CANONIQUES.get(proposition);
  if (copie === undefined) {
    copie = figer(copier(proposition, PROPOSITION, chemin));
    CANONIQUES.set(proposition, copie);
    CANONIQUES.set(copie, copie);
  }
  return copie;
}

// Copie de valeur selon sa règle, comme copier la ferait, pour une valeur
// qui était une copie canonique avant des modifications en place que traces
// décrit : traces.sales tient chaque objet et chaque liste où une
// modification a eu lieu ou sous lesquels elle a eu lieu ; traces.neufs,
// chaque valeur posée entière et chaque objet dont le drapeau
// siegesAttribues a été posé. Une valeur neuve se recopie entière, par
// copier, sous le drapeau de son contenant. Une valeur qui n'est ni sale ni
// neuve, hors d'un retenu sali, est restée une copie canonique sous le même
// drapeau, et se rend telle quelle, sans être relue. Un retenu sali se
// recopie entier par copier : un retenu que sa règle refusait a été copié
// hors du schéma, ses enfants ne sont donc pas des copies canoniques sous
// sa règle, et le redevenir conforme en place ne les refait pas. Une autre
// valeur sale se refait comme copier la refait : dans l'ordre des champs de
// sa règle pour un objet, son drapeau lu sur lui quand il en porte un ;
// copiée puis triée selon sa règle pour une liste ; chacun de ses éléments
// par recopier. La valeur reçue n'est pas modifiée.
function recopier(valeur, regle, chemin, siegesAttribues, traces) {
  if (valeur === null || typeof valeur !== 'object') return valeur;
  if (traces.neufs.has(valeur)) return copier(valeur, regle, chemin, siegesAttribues);
  if (!traces.sales.has(valeur)) return valeur;
  if (regle === RETENU) return copier(valeur, regle, chemin, siegesAttribues);
  if (regle.genre === 'objet') {
    const drapeau = regle.cles.has('siegesAttribues') ? valeur.siegesAttribues : siegesAttribues;
    const copie = {};
    for (const [cle, regleDeCle] of regle.champs) {
      const cheminDeCle = `${chemin}.${cle}`;
      if (valeur[cle] === undefined && regleDeCle.optionnel) continue;
      if (valeur[cle] === undefined) throw new TypeError(`${cheminDeCle} absente`);
      copie[cle] = recopier(valeur[cle], regleDeCle, cheminDeCle, drapeau, traces);
    }
    return copie;
  }
  if (regle.genre === 'liste') {
    const copie = valeur.map((element, rang) =>
      recopier(element, regle.element, `${chemin}[${rang}]`, siegesAttribues, traces),
    );
    if (regle.tri !== undefined) copie.sort(regle.tri);
    if (regle.triSansAttribution !== undefined && siegesAttribues === false) copie.sort(regle.triSansAttribution);
    return copie;
  }
  return valeur;
}

// Texte de valeur, déjà canonique, selon sa règle, au retrait de sa ligne :
// la première ligne continue celle de la clé, les suivantes portent leur
// propre retrait. Une copie canonique partagée d'une proposition, à un
// retrait de RETRAITS_EN_CACHE, prend son texte de TEXTES, rendu la
// première fois par ecrire.
function rendre(valeur, regle, retrait) {
  if (regle === PROPOSITION && CANONIQUES.get(valeur) === valeur && RETRAITS_EN_CACHE.includes(retrait)) {
    let parRetrait = TEXTES.get(valeur);
    if (parRetrait === undefined) {
      parRetrait = new Map();
      TEXTES.set(valeur, parRetrait);
    }
    let texte = parRetrait.get(retrait);
    if (texte === undefined) {
      texte = ecrire(valeur, regle, retrait);
      parRetrait.set(retrait, texte);
    }
    return texte;
  }
  return ecrire(valeur, regle, retrait);
}

// Le texte que rend rendre, sans cache au niveau de valeur ; ses enfants
// passent par rendre. Un retenu que sa règle refuse s'écrit compact.
function ecrire(valeur, regle, retrait) {
  if (valeur === null || regle.mise === undefined || retenuHorsDeSaRegle(valeur, regle)) {
    return JSON.stringify(valeur);
  }
  const dedans = ' '.repeat(retrait + 2);
  const fin = ' '.repeat(retrait);
  if (regle.genre === 'liste') {
    if (valeur.length === 0) return '[]';
    const lignes = valeur.map((element) => dedans + rendre(element, regle.element, retrait + 2));
    return `[\n${lignes.join(',\n')}\n${fin}]`;
  }
  // Un champ facultatif absent ne s'écrit pas.
  const presents = regle.champs.filter(([cle, regleDeCle]) => !(regleDeCle.optionnel && valeur[cle] === undefined));
  if (regle.mise === 'lignes') {
    const lignes = presents.map(
      ([cle, regleDeCle]) => `${dedans}${JSON.stringify(cle)}: ${rendre(valeur[cle], regleDeCle, retrait + 2)}`,
    );
    return `{\n${lignes.join(',\n')}\n${fin}}`;
  }
  // Mise « ouverte » : la syntaxe compacte, chaque champ selon sa règle au
  // retrait de l'objet.
  const champs = presents.map(
    ([cle, regleDeCle]) => `${JSON.stringify(cle)}:${rendre(valeur[cle], regleDeCle, retrait)}`,
  );
  return `{${champs.join(',')}}`;
}

/**
 * Copie de la charge dans l'ordre canonique (§ 8.8, § 8.9). Les clés de
 * chaque objet y sont posées dans l'ordre du schéma : JSON.stringify de la
 * copie est canonique lui aussi. Participants et tables s'y rangent par
 * identifiant ; propositions par identifiant, puis graine, compte d'arrêt,
 * historique et texte canonique ; réservations par participant, table,
 * portée — tous avant tour —, tour, siège, null en tête ; titres par table,
 * siège, libellé. Une proposition, ou le retenu, dont siegesAttribues est
 * faux a chaque liste de table de son placement par identifiant croissant ;
 * vrai, l'ordre est celui des sièges et reste tel quel. C'est le drapeau de
 * la proposition qui décide, jamais le réglage attribuerSieges : le changer
 * ne détruit pas l'ordre des sièges d'une proposition déjà produite. Ses
 * participants et chaque réserve, des ensembles, se rangent par identifiant
 * croissant quel que soit le drapeau. L'ordre des tables d'une proposition,
 * qui apparie chaque liste à sa table, est gardé. La charge reçue n'est pas
 * modifiée, et la copie n'en partage aucun objet. La copie est neuve et
 * modifiable à chaque appel, même pour une proposition figée : rien n'y est
 * gelé, et elle ne partage rien avec celle de canoniserPartagee.
 *
 * La charge est celle que rend examiner (placements.js) : l'analyse l'admet,
 * et chaque proposition suit sa règle ; une clé du schéma absente, ailleurs
 * que dans le retenu, lève TypeError. Un retenu que sa règle refuse, et que
 * l'analyse admet, se copie hors du schéma (retenuHorsDeSaRegle) : chaque
 * objet refait, ses clés rangées par unités UTF-16, chaque liste dans
 * l'ordre reçu, ses clés inconnues gardées. Un retenu qui n'est pas un
 * objet lève TypeError.
 *
 * @param {import('./types.js').Charge} charge
 * @returns {import('./types.js').Charge}
 */
export function canoniser(charge) {
  return copier(charge, CHARGE, 'charge');
}

/**
 * Copie de la charge dans l'ordre canonique, à lire seulement : la copie de
 * canoniser, à ceci près que chaque proposition figée (gel.js) y est
 * remplacée par sa copie canonique, figée et partagée — la même à chaque
 * appel, pour la même proposition. Le reste est neuf, comme sous canoniser :
 * la charge, ses listes, la liste des propositions, chaque proposition qui
 * n'est pas figée. JSON.stringify de la copie, et le texte qu'en tire
 * serialiserCanonique, sont ceux de canoniser.
 *
 * Écrire dans une proposition partagée lève TypeError ; le reste se modifie
 * sans toucher la charge reçue. Une copie canonique partagée est sa propre
 * copie : une charge qui en porte la rend telle quelle. Les refus sont ceux
 * de canoniser, une proposition figée hors de sa règle comprise, et rien ne
 * se garde d'un appel qui lève.
 *
 * @param {import('./types.js').Charge} charge
 * @returns {import('./types.js').Charge}
 */
export function canoniserPartagee(charge) {
  return copier(charge, CHARGE, 'charge', undefined, true);
}

/**
 * canoniser(charge) d'une charge qui était une copie canonique — de
 * canoniser, de canoniserPartagee ou d'un recanoniser précédent — avant des
 * modifications en place que traces décrit, sans recopier ce qu'elles n'ont
 * pas touché. Pour le seul stockage : la suite de correctifs, qui modifie
 * en place et tient les traces de chaque opération.
 *
 * traces.sales tient la charge et chaque objet ou liste traversé pour
 * atteindre une valeur modifiée, son conteneur compris ; traces.neufs,
 * chaque objet ou liste posé entier, et chaque objet dont le drapeau
 * siegesAttribues a été posé, que son contenu se range alors sous le
 * nouveau drapeau. Avec des traces ainsi tenues, la copie rendue est égale
 * en profondeur à canoniser(charge), ordre des clés compris, et son texte
 * est le même : chaque valeur sale se refait comme sous canoniser, et
 * chaque valeur neuve se recopie entière. Le retenu, une fois sali, se
 * recopie entier comme sous canoniser, hors du schéma si sa règle le
 * refuse. Un retenu que sa règle refusait a été copié hors du schéma : ses
 * enfants ne sont pas canoniques sous sa règle, et ne le deviennent pas
 * quand il redevient conforme en place. Une valeur que les traces taisent
 * n'est pas relue : une modification non tracée passe inaperçue.
 *
 * La copie partage avec charge chaque objet et chaque liste ni sale ni neuf,
 * hors d'un retenu sali, recopié entier, les propositions partagées de
 * canoniserPartagee comprises ; ce qui est refait ou recopié est neuf, et
 * rien de neuf n'est partagé avec une valeur posée. Sans rien de sali,
 * charge elle-même revient. charge n'est pas modifiée. Les refus sont ceux
 * de canoniser pour ce qui est refait ou recopié : une clé du schéma
 * absente lève TypeError en nommant son chemin.
 *
 * @param {import('./types.js').Charge} charge
 * @param {{sales: Set<Object>, neufs: Set<Object>}} traces
 * @returns {import('./types.js').Charge}
 */
export function recanoniser(charge, traces) {
  return recopier(charge, CHARGE, 'charge', undefined, traces);
}

/**
 * Texte canonique du fichier d'état (§ 8.8) : l'en-tête — FORMAT,
 * produitVersion, revision et les comptes de la charge —, la charge
 * canonique, et une fin de ligne finale. Deux charges qui ne diffèrent que
 * par l'ordre de leurs clés, ou par celui d'une liste que canoniser range,
 * s'écrivent octet pour octet pareil : chaque ordre est total. Le texte est
 * serialiserCanonique de canoniserPartagee(charge) : une proposition figée
 * y prête sa copie et son texte, qu'un appel précédent a faits, et le texte
 * est celui qu'écrirait sa copie libre. Un en-tête absent lève TypeError
 * avant la copie, revision ou produitVersion absents après elle.
 *
 * @param {import('./types.js').Charge} charge
 * @param {{revision: number, produitVersion: string}} entete
 * @returns {string}
 */
export function serialiser(charge, { revision, produitVersion }) {
  return serialiserCanonique(canoniserPartagee(charge), { revision, produitVersion });
}

/**
 * Texte canonique du fichier d'état (§ 8.8) d'une copie déjà canonique,
 * celle de canoniser ou de canoniserPartagee : l'en-tête — FORMAT,
 * produitVersion, revision et les comptes de la copie —, la copie, et une
 * fin de ligne finale. La copie n'est ni recopiée ni rangée : une charge qui
 * n'est pas canonique s'écrit dans son propre ordre, et son texte n'est pas
 * canonique. revision ou produitVersion absents lèvent TypeError.
 *
 * @param {import('./types.js').Charge} copie
 * @param {{revision: number, produitVersion: string}} entete
 * @returns {string}
 */
export function serialiserCanonique(copie, { revision, produitVersion }) {
  const entete = copier({ format: FORMAT, produitVersion, revision, comptes: comptesDe(copie) }, ENTETE, 'entete');
  return `${rendre({ entete, charge: copie }, SCHEMA, 0)}\n`;
}

/**
 * Texte canonique du placement d'une proposition : JSON.stringify de sa
 * copie canonique, sur une ligne. Chaque réserve s'y range par identifiant
 * croissant ; chaque liste de table aussi quand siegesAttribues est faux,
 * et reste dans l'ordre des sièges quand il est vrai. Deux placements qui
 * ne diffèrent que par un ordre que canoniser range ont le même texte. La
 * proposition reçue n'est pas modifiée ; un placement hors de sa règle lève
 * TypeError ou rend un texte quelconque, comme copier.
 *
 * @param {{placement: Object[], siegesAttribues: boolean}} proposition
 * @returns {string}
 */
export function texteDuPlacement({ placement, siegesAttribues }) {
  return JSON.stringify(copier(placement, PLACEMENT, 'placement', siegesAttribues));
}

/**
 * Texte canonique de la charge seule, dans la mise en page du fichier, sans
 * en-tête, et une fin de ligne finale : ce que comparent l'empreinte des
 * démonstrations et l'aller-retour des fichiers livrés, qui ne dépendent pas
 * de la construction qui a écrit (§ 8.8, § 15.5). Il se tire de
 * canoniserPartagee(charge), comme serialiser.
 *
 * @param {import('./types.js').Charge} charge
 * @returns {string}
 */
export function serialiserCharge(charge) {
  return `${rendre(canoniserPartagee(charge), CHARGE, 0)}\n`;
}
