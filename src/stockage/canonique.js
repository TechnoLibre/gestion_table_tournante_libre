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
import { FORMAT, SCHEMA, clesRangees, comptesDe, premiereFaute } from './document.js';

// Règle du champ cle d'un objet du schéma.
const regleDuChamp = (regle, cle) => regle.champs.find(([nom]) => nom === cle)[1];
const ENTETE = regleDuChamp(SCHEMA, 'entete');
const CHARGE = regleDuChamp(SCHEMA, 'charge');
const RETENU = regleDuChamp(CHARGE, 'retenu');
const PLACEMENT = regleDuChamp(regleDuChamp(CHARGE, 'propositions').element, 'placement');

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
function copier(valeur, regle, chemin, siegesAttribues) {
  if (valeur === null) return null;
  if (retenuHorsDeSaRegle(valeur, regle)) return copierHorsDuSchema(valeur);
  if (regle.genre === 'objet') {
    const drapeau = regle.cles.has('siegesAttribues') ? valeur.siegesAttribues : siegesAttribues;
    const copie = {};
    for (const [cle, regleDeCle] of regle.champs) {
      const cheminDeCle = `${chemin}.${cle}`;
      if (valeur[cle] === undefined && regleDeCle.optionnel) continue;
      if (valeur[cle] === undefined) throw new TypeError(`${cheminDeCle} absente`);
      copie[cle] = copier(valeur[cle], regleDeCle, cheminDeCle, drapeau);
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

// Texte de valeur, déjà canonique, selon sa règle, au retrait de sa ligne :
// la première ligne continue celle de la clé, les suivantes portent leur
// propre retrait. Un retenu que sa règle refuse s'écrit compact.
function rendre(valeur, regle, retrait) {
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
 * modifiée, et la copie n'en partage aucun objet.
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
 * Texte canonique du fichier d'état (§ 8.8) : l'en-tête — FORMAT,
 * produitVersion, revision et les comptes de la charge —, la charge
 * canonique, et une fin de ligne finale. Deux charges qui ne diffèrent que
 * par l'ordre de leurs clés, ou par celui d'une liste que canoniser range,
 * s'écrivent octet pour octet pareil : chaque ordre est total. revision ou
 * produitVersion absents lèvent TypeError.
 *
 * @param {import('./types.js').Charge} charge
 * @param {{revision: number, produitVersion: string}} entete
 * @returns {string}
 */
export function serialiser(charge, { revision, produitVersion }) {
  const copie = canoniser(charge);
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
 * de la construction qui a écrit (§ 8.8, § 15.5).
 *
 * @param {import('./types.js').Charge} charge
 * @returns {string}
 */
export function serialiserCharge(charge) {
  return `${rendre(canoniser(charge), CHARGE, 0)}\n`;
}
