// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le modèle du tableau des propositions (§ 5.4, § 5.5, § 5.7, § 9, § 12.1,
// § 12.6, § 12.9), pur : SectionPropositions.svelte et
// TableauPropositions.svelte le câblent.
//
// Le tableau lit la table d'évaluation d'evaluer (evaluation.js), la seule mesure : chaque
// cellule porte la valeur que la table rend, telle quelle, et sa clé de mise
// en forme ; aucune arithmétique ne s'y fait, aucun plafond ne s'y recompose.
// Des rencontres, il ne porte que le minimum, sur les trois populations du
// § 5.4 — tous, mobiles, ancrés —, en tête des colonnes de mesure ; la moyenne
// n'y entre pas. Le plafond réalisé, individuel, se lit par le manque, dont
// les cellules sont celles de troisChiffres. Les imposés se disent à part, sur
// chaque ligne, jamais ajoutés aux choisis.
//
// Chaque minimum affiché désigne la personne la plus mal servie (§ 12.1) :
// le moins de rencontres, d'appartenances vues, de diversité. La redondance
// r(p) va dans l'autre sens — plus elle est grande, pire est le sort —, et
// son minimum désignerait la personne la mieux servie : elle se lit par sa
// somme Σ r(p), la grandeur que la recherche et le classement lisent.
//
// Une cellule vaut { colonne, valeur, cle, decimales } : cle null, la valeur
// est un nombre que format.nombre écrit avec decimales chiffres après la
// virgule ; sinon le texte est t(cle) — « — » pour une population vide,
// « inconnu » pour une grandeur que l'a priori inconnu ne permet pas, le
// certificat en mots.
import { evaluer } from '../../application/evaluation.js';
import { nomAffiche } from '../../application/personnes.js';

const VIDE = 'format.vide';
const INCONNU = 'propositions.valeur.inconnu';

// Chaque colonne de mesure et la lecture de sa valeur dans une ligne
// comparable de la table d'évaluation, dans l'ordre d'affichage. La Map ne
// sert qu'à retrouver la lecture d'une colonne ; COLONNES fixe l'ordre.
const LECTURES = new Map([
  ['rencontresTous', (l) => l.mesures.aggRencontres.tous.min],
  ['rencontresMobiles', (l) => l.mesures.aggRencontres.mobiles.min],
  ['rencontresAncres', (l) => l.mesures.aggRencontres.ancres.min],
  ['collisionsCumulees', (l) => l.mesures.collisionsCumulees],
  ['pairesDistinctes', (l) => l.mesures.pairesDistinctes],
  ['excedentCollisions', (l) => l.mesures.excedentCollisions],
  ['rencontresRepetees', (l) => l.mesures.rencontresRepetees.choisies],
  ['maxRencontresPaire', (l) => l.mesures.maxRencontresPaire],
  ['retoursChoisis', (l) => l.mesures.totalRetoursChoisis],
  ['appartenancesVues', (l) => l.mesures.aggAppartenancesVues.tous.min],
  ['totalRedondance', (l) => l.mesures.totalRedondance],
  ['diversite', (l) => l.mesures.aggDiversite.tous.min],
  ['manqueMax', (l) => l.troisChiffres.manqueMax.tous],
  ['effectifManque', (l) => l.troisChiffres.effectifManque.tous],
  ['ecartItineraireMax', (l) => l.troisChiffres.ecartItineraireMax?.tous ?? null],
  ['ecartAuPlafondAPriori', (l) => l.ecartAuPlafondAPrioriMax],
  ['certificat', (l) => l.minimumAtteint],
]);

// Les colonnes dont la valeur n'existe pas quand le plafond a priori est
// inconnu : elles s'écrivent « inconnu », jamais « — » (§ 12.6).
const SELON_A_PRIORI = new Set(['ecartItineraireMax', 'ecartAuPlafondAPriori']);

// Le taux de diversité, un rapport, se lit au centième ; les autres colonnes
// sont des comptes.
const DECIMALES = new Map([['diversite', 2]]);

// Les colonnes dont les cellules sont du texte : toutes les autres portent
// un nombre, qui s'aligne à droite en chiffres tabulaires.
const TEXTUELLES = new Set(['proposition', 'certificat', 'imposes', 'commandes']);

/** Les colonnes du tableau, dans l'ordre d'affichage : le rang et
 *  l'identifiant, puis les mesures — les trois minimums des rencontres en
 *  tête —, le certificat, les imposés et les commandes. Chacune porte son nom,
 *  la clé de son en-tête, qui nomme son unité, celle de son explication,
 *  le texte de l'infobulle de son en-tête et du critère qui la désigne, et
 *  nombre, vrai quand ses cellules portent un nombre. */
export const COLONNES = Object.freeze(
  ['rang', 'proposition', ...LECTURES.keys(), 'imposes', 'commandes'].map((nom) =>
    Object.freeze({ nom, cle: `propositions.colonne.${nom}`, explication: `propositions.explication.${nom}`, nombre: !TEXTUELLES.has(nom) }),
  ),
);

// Les groupes d'en-têtes : chacun nomme des colonnes de mesure voisines dans
// COLONNES, sous la clé propositions.groupe.<nom>.
const GROUPES = [
  ['rencontres', ['rencontresTous', 'rencontresMobiles', 'rencontresAncres']],
  ['collisions', ['collisionsCumulees', 'pairesDistinctes', 'excedentCollisions']],
  ['repetitions', ['rencontresRepetees', 'maxRencontresPaire', 'retoursChoisis']],
  ['diversite', ['appartenancesVues', 'totalRedondance', 'diversite']],
  ['manque', ['manqueMax', 'effectifManque', 'ecartItineraireMax', 'ecartAuPlafondAPriori']],
];

// Les segments de la rangée des groupes, dans l'ordre de COLONNES : un
// groupe couvre ses colonnes d'un seul segment, une colonne hors groupe
// forme le sien, sans clé. Un groupe dont les colonnes ne se suivent pas
// dans COLONNES lève au chargement du module.
function segmenter() {
  const noms = COLONNES.map(({ nom }) => nom);
  const segments = [];
  for (let rang = 0; rang < noms.length; ) {
    const groupe = GROUPES.find(([, colonnes]) => colonnes[0] === noms[rang]);
    if (groupe === undefined) {
      if (GROUPES.some(([, colonnes]) => colonnes.includes(noms[rang]))) throw new Error(`colonne groupée hors de son groupe : ${noms[rang]}`);
      segments.push({ cle: null, colonnes: [noms[rang]] });
      rang += 1;
      continue;
    }
    const [nom, colonnes] = groupe;
    colonnes.forEach((colonne, decalage) => {
      if (noms[rang + decalage] !== colonne) throw new Error(`groupe ${nom} : colonnes non voisines`);
    });
    segments.push({ cle: `propositions.groupe.${nom}`, colonnes });
    rang += colonnes.length;
  }
  return segments.map(({ cle, colonnes }) => Object.freeze({ cle, etendue: colonnes.length, colonnes: Object.freeze([...colonnes]) }));
}

/** La rangée des groupes d'en-têtes, au-dessus de celle des colonnes :
 *  { cle, etendue, colonnes } par segment, dans l'ordre de COLONNES — cle,
 *  la clé du libellé du groupe, null pour une colonne hors groupe ;
 *  etendue, le nombre de colonnes couvertes ; colonnes, leurs noms. Les
 *  segments couvrent chaque colonne une fois. */
export const GROUPES_COLONNES = Object.freeze(segmenter());

/**
 * La clé de l'explication d'une colonne : le texte de l'infobulle de son
 * en-tête, et celui du nom de critère qui la désigne dans la phrase de
 * l'ordre (colonneDuCritere) — un critère et sa colonne partagent la même.
 * Lève TypeError pour un nom qui n'est pas une colonne de COLONNES.
 *
 * @param {string} nom  le nom d'une colonne
 * @returns {string}
 */
export function explicationDeColonne(nom) {
  const colonne = COLONNES.find((candidate) => candidate.nom === nom);
  if (colonne === undefined) throw new TypeError(`colonne inconnue : ${nom}`);
  return colonne.explication;
}

// Une cellule de nombre : null s'écrit « — ».
const nombre = (colonne, valeur) => ({
  colonne,
  valeur,
  cle: valeur === null ? VIDE : null,
  decimales: DECIMALES.get(colonne) ?? 0,
});

// Le certificat en mots (§ 5.5) : « minimum atteint » quand minimumAtteint
// est vrai ; « atteignabilité inconnue » quand il est faux, ou null faute de
// plafond a priori ; « — » sur une population vide.
function certificat(ligne) {
  const valeur = ligne.minimumAtteint;
  let cle = 'propositions.certificat.inconnue';
  if (valeur === true) cle = 'propositions.certificat.atteint';
  else if (ligne.mesures.rencontres.length === 0) cle = VIDE;
  return { colonne: 'certificat', valeur, cle, decimales: 0 };
}

// Les cellules de mesure d'une ligne comparable, dans l'ordre de LECTURES.
// L'a priori est inconnu quand troisChiffres ne porte pas d'écart
// d'itinéraire du tout.
function cellules(ligne) {
  const inconnu = ligne.troisChiffres.ecartItineraireMax === null;
  return [...LECTURES].map(([colonne, lire]) => {
    if (colonne === 'certificat') return certificat(ligne);
    if (inconnu && SELON_A_PRIORI.has(colonne)) return { colonne, valeur: null, cle: INCONNU, decimales: 0 };
    return nombre(colonne, lire(ligne));
  });
}

// Ce que les réservations imposent, énoncé à part (§ 5.4) : les retours et
// les ancrages qui les imposent, les mêmes pour toute ligne ; les rencontres
// répétées imposées, propres au plan.
const imposes = (ligne, { retours, ancrages }) => [
  { cle: 'propositions.imposes.retours', details: { retours, ancrages } },
  { cle: 'propositions.imposes.repetees', details: { repetees: ligne.mesures.rencontresRepetees.imposees } },
];

// Un code et ses détails : une raison de dérive, une faute, une violation.
const codeDe = (raison) => ({ cle: raison.code, details: raison });

// Une raison de dérive : son code, ses détails, et la personne qu'elle nomme,
// null quand elle n'en nomme aucune.
const raisonDe = (raison) => ({ ...codeDe(raison), participant: raison.participant ?? null });

// Les colonnes que couvre la cellule des raisons d'une ligne hors
// classement : celles des mesures et celle des imposés.
const ETENDUE_RAISONS = LECTURES.size + 1;

// La ligne d'un placement mesuré, ou celle d'un placement hors classement.
// rang : la place dans le classement, à partir de 1 ; null hors classement
// et pour le retenu.
function ligneDe(ligne, table, idRetenu, rang = null) {
  const retenue = ligne.id === idRetenu;
  if (ligne.statut !== 'comparable') {
    return {
      id: ligne.id,
      rang: null,
      retenue,
      comparable: false,
      statut: `propositions.statut.${ligne.statut}`,
      raisons: ligne.raisons.map(raisonDe),
    };
  }
  return {
    id: ligne.id,
    rang,
    retenue,
    comparable: true,
    cellules: cellules(ligne),
    imposes: imposes(ligne, table.imposes),
    violations: ligne.violations.map(codeDe),
  };
}

// La colonne que désigne chaque critère du classement (§ 5.7) : celle qui
// porte la grandeur qu'il compare. La Map ne sert qu'à retrouver la colonne
// d'un critère ; la phrase suit l'ordre que le classement rend.
const COLONNE_DU_CRITERE = new Map([
  ['ecartAuPlafondAPrioriMax', 'ecartAuPlafondAPriori'],
  ['excedentCollisions', 'excedentCollisions'],
  ['collisionsCumulees', 'collisionsCumulees'],
  ['rencontresRepetees', 'rencontresRepetees'],
  ['redondance', 'totalRedondance'],
  ['identifiant', 'proposition'],
]);

/**
 * La colonne du tableau que désigne un critère du classement, ou
 * 'identifiant', le dernier départage, qui désigne la colonne des
 * propositions. Lève TypeError pour un critère sans colonne : un critère
 * ajouté au classement doit dire laquelle il compare.
 *
 * @param {string} critere  un nom de CRITERES (moteur), ou 'identifiant'
 * @returns {string}  le nom d'une colonne de COLONNES
 */
export function colonneDuCritere(critere) {
  const colonne = COLONNE_DU_CRITERE.get(critere);
  if (colonne === undefined) throw new TypeError(`critère sans colonne : ${critere}`);
  return colonne;
}

// Un morceau de phrase : un texte de liaison, ou un nom qui désigne une
// colonne.
const liaison = (cle, details = {}) => ({ cle, details, critere: null, colonne: null });
const designant = (critere, cle) => ({ cle, details: {}, critere, colonne: colonneDuCritere(critere) });

// La phrase des critères appliqués, morceau par morceau : le début, chaque
// critère par son nom moteur.critere.<nom>, puis l'identifiant croissant,
// séparés, et la fin. Bout à bout, les morceaux traduits composent le texte
// de propositions.ordre.criteres.
function phraseDesCriteres(criteresAppliques) {
  const noms = [
    ...criteresAppliques.map((critere) => designant(critere, `moteur.critere.${critere}`)),
    designant('identifiant', 'propositions.ordre.identifiant'),
  ];
  return [
    liaison('propositions.ordre.debut'),
    ...noms.flatMap((nom, rang) => (rang === 0 ? [nom] : [liaison('propositions.ordre.separateur'), nom])),
    liaison('propositions.ordre.fin'),
  ];
}

// Les phrases de l'ordre (§ 5.7), chacune une liste de morceaux : le critère
// sauté et celui appliqué à sa place quand le plafond a priori manque, puis
// les critères appliqués.
function ordre({ criteresAppliques, critereSaute }) {
  const phrases = [];
  if (critereSaute !== null) {
    phrases.push([liaison('propositions.ordre.saute', { saute: critereSaute, applique: criteresAppliques[0] })]);
  }
  phrases.push(phraseDesCriteres(criteresAppliques));
  return phrases;
}

/**
 * Le tableau d'une table d'évaluation (evaluer, evaluation.js).
 *
 * @param {import('../../application/evaluation.js').TableEvaluation} tableEvaluation
 * @param {{ajuste?: boolean}} [options]  ajuste : le retenu ne porte plus le
 *   placement de sa proposition d'origine (retenuAjuste) ; il choisit le
 *   libellé de la ligne du retenu
 * @returns {{ordre: Array<Array<{cle: string, details: Object, critere: string|null,
 *   colonne: string|null}>>, colonnes: typeof COLONNES,
 *   etendueRaisons: number, lignes: Object[], horsClassement: Object[], retenu: Object|null}}
 *   ordre : les phrases de l'ordre, chacune une liste de morceaux que t
 *   traduit et que l'affichage met bout à bout ; un morceau qui nomme un
 *   critère, ou l'identifiant croissant, porte critere et la colonne qu'il
 *   désigne, null pour un texte de liaison ; lignes : les comparables dans
 *   l'ordre du classement, chacune { id, rang, retenue, comparable: true,
 *   cellules, imposes, violations } ;
 *   horsClassement : les autres par identifiant, { id, rang: null, retenue,
 *   comparable: false, statut, raisons } — statut la clé de « non comparable »,
 *   raisons leurs codes, chacune { cle, details, participant }, participant
 *   l'identifiant de la personne en cause ou null ; etendueRaisons : le nombre
 *   de colonnes que couvre la cellule des raisons ; retenu : la ligne du
 *   retenu sous l'une ou l'autre forme, plus libelle { cle, details } — « tel
 *   que » ou « ajusté » —, null sans retenu. retenue marque la proposition
 *   d'origine du retenu.
 */
export function tableau(tableEvaluation, { ajuste = false } = {}) {
  const idRetenu = tableEvaluation.retenu?.id ?? null;
  // Les comparables ouvrent la liste, dans l'ordre du classement : leur
  // place y est leur rang.
  const toutes = tableEvaluation.propositions.map((ligne, place) => ligneDe(ligne, tableEvaluation, idRetenu, place + 1));
  return {
    ordre: ordre(tableEvaluation.classement),
    colonnes: COLONNES,
    etendueRaisons: ETENDUE_RAISONS,
    lignes: toutes.filter(({ comparable }) => comparable),
    horsClassement: toutes.filter(({ comparable }) => !comparable),
    retenu: tableEvaluation.retenu === null ? null : ligneDuRetenu(tableEvaluation, idRetenu, ajuste),
  };
}

// La ligne du retenu, et son libellé : « tel que » la proposition d'origine,
// ou « ajusté » depuis elle.
function ligneDuRetenu(tableEvaluation, idRetenu, ajuste) {
  const cle = ajuste ? 'propositions.retenu.ajuste' : 'propositions.retenu.origine';
  return { ...ligneDe(tableEvaluation.retenu, tableEvaluation, idRetenu), libelle: { cle, details: { proposition: idRetenu } } };
}

/**
 * La colonne que la phrase de l'ordre surligne (§ 5.7), de deux états
 * tenus à part : celle du nom survolé, sinon celle du nom qui a le focus,
 * sinon null. Quitter l'un rend l'autre : un survol qui passe ne retire pas
 * le surlignage du focus.
 *
 * @param {string|null} survolee   la colonne du nom sous le pointeur
 * @param {string|null} focalisee  la colonne du nom qui a le focus
 * @returns {string|null}
 */
export function surlignee(survolee, focalisee) {
  return survolee ?? focalisee;
}

/**
 * Le texte d'une cellule : t(cle) quand elle porte une clé, sinon son nombre
 * mis en forme.
 *
 * @param {{valeur: number|boolean|null, cle: string|null, decimales: number}} cellule
 * @param {{t: Function, format: {nombre: Function}}} outils
 * @returns {string}
 */
export function texteCellule({ valeur, cle, decimales }, { t, format }) {
  return cle === null ? format.nombre(valeur, { decimales }) : t(cle);
}

// Égalité en profondeur de deux valeurs du fichier d'état : nombres,
// chaînes, booléens, null, listes et objets simples.
function egaux(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const clesA = Object.keys(a);
  if (clesA.length !== Object.keys(b).length) return false;
  return clesA.every((cle) => Object.hasOwn(b, cle) && egaux(a[cle], b[cle]));
}

// Ce que le retenu copie de sa proposition d'origine, et que retenirProposition
// remplacerait.
const CHAMPS_DU_PLACEMENT = ['siegesAttribues', 'tables', 'capacites', 'tours', 'participants', 'placement'];

/** Vrai quand un retenu existe et ne porte plus le placement de sa proposition d'origine :
 *  tables, capacités, tours, participants ou placement diffèrent, en profondeur, de ceux
 *  de la proposition retenu.proposition, ou celle-ci n'est plus dans la liste. */
export function retenuAjuste(charge) {
  const { retenu } = charge;
  if (retenu === null) return false;
  const origine = charge.propositions.find(({ id }) => id === retenu.proposition);
  if (origine === undefined) return true;
  return !CHAMPS_DU_PLACEMENT.every((champ) => egaux(retenu[champ], origine[champ]));
}

/**
 * La fenêtre à confirmer avant de retenir la proposition id (§ 2.1) : retenir
 * remplace le retenu, et détruit ses ajustements quand il en porte. Elle
 * s'ouvre quand la séance accepterait le geste — etat.refus null — et que le
 * retenu est ajusté, y compris pour re-retenir sa proposition d'origine ; un
 * geste que la séance refuserait s'exécute sans fenêtre, et son refus
 * s'affiche.
 *
 * @param {{refus: Object|null, charge: Object|null}} etat  l'état observable de la séance
 * @param {number} id  la proposition à retenir
 * @returns {null|{id: number, titre: {cle: string, details: Object},
 *   elements: Array<{cle: string, details: Object}>}}  null sans fenêtre ;
 *   sinon la proposition demandée, le titre, puis les éléments qui nomment le
 *   retenu ajusté et la proposition qui le remplace
 */
export function demandeConfirmation({ refus, charge }, id) {
  if (refus !== null || charge === null || !retenuAjuste(charge)) return null;
  return {
    id,
    titre: { cle: 'propositions.confirmation.titre', details: { proposition: id } },
    elements: [
      { cle: 'propositions.confirmation.retenuAjuste', details: { proposition: charge.retenu.proposition } },
      { cle: 'propositions.confirmation.remplacant', details: { proposition: id } },
    ],
  };
}

// La table d'évaluation de chaque charge figée en profondeur, sous l'identité
// de la charge. La charge de l'état observable de la séance est une copie
// figée en profondeur (seance.js, figer), remplacée par une copie neuve à
// chaque changement de l'événement ouvert et gardée telle quelle sinon : son
// identité suffit à dire que son contenu n'a pas changé, et Génération et
// Propositions relisent la même table. Une charge qui n'est pas figée
// partout se mesure à chaque appel, son contenu pouvant changer sous la
// même identité. Le § 13.3 compte sur la réactivité de Svelte plutôt que sur
// une mémoïsation posée à la main ; ce cache en est l'exception voulue, posé
// dans le modèle pur et tenu par l'immuabilité de son entrée.
const evaluees = new WeakMap();

// Vrai quand chaque objet atteint depuis valeur est figé. Un objet figé ne
// redevient jamais modifiable : vrai une fois, vrai pour toujours.
function figeePartout(valeur) {
  if (valeur === null || typeof valeur !== 'object') return true;
  if (!Object.isFrozen(valeur)) return false;
  for (const cle of Object.keys(valeur)) if (!figeePartout(valeur[cle])) return false;
  return true;
}

// Fige une valeur neuve et tout ce qu'elle atteint.
function figer(valeur) {
  if (valeur === null || typeof valeur !== 'object' || Object.isFrozen(valeur)) return valeur;
  for (const cle of Object.keys(valeur)) figer(valeur[cle]);
  return Object.freeze(valeur);
}

// La table d'une charge, mesurée à neuf.
function evaluationNeuve(charge) {
  if (charge.propositions.length === 0 && charge.retenu === null) return { table: null, refus: null };
  try {
    return { table: evaluer(charge), refus: null };
  } catch (erreur) {
    if (typeof erreur?.code !== 'string') throw erreur;
    return { table: null, refus: { code: erreur.code, details: erreur.details ?? {} } };
  }
}

/**
 * La table d'évaluation d'une charge, ou ce qui l'empêche : null sans
 * proposition ni retenu, rien n'étant à mesurer ; le refus de normaliser —
 * une erreur qui porte un code — quand la configuration ne se tient pas.
 * Toute autre erreur remonte, et rien n'est retenu. Le résultat est figé en
 * profondeur ; pour une charge figée partout, c'est le même objet à chaque
 * appel, mesuré au premier.
 *
 * @param {Object} charge
 * @returns {{table: Object|null, refus: null|{code: string, details: Object}}}
 */
export function evaluation(charge) {
  const connue = evaluees.get(charge);
  if (connue !== undefined) return connue;
  const evaluee = figer(evaluationNeuve(charge));
  if (figeePartout(charge)) evaluees.set(charge, evaluee);
  return evaluee;
}

/** Le nom affiché de la personne id de la charge, exclue comprise ; null
 *  pour une personne que la charge n'a plus, et pour id null. */
export function nomDe(charge, id) {
  const personne = charge.participants.find((candidate) => candidate.id === id);
  return personne === undefined ? null : nomAffiche(personne);
}
