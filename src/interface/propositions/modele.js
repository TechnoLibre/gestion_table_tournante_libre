// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le modèle du tableau des propositions (§ 5.4, § 5.5, § 5.7, § 9, § 12.1,
// § 12.6, § 12.9), pur : SectionPropositions.svelte et
// TableauPropositions.svelte le câblent.
//
// Le tableau lit la table d'évaluation d'evaluer (evaluation.js), la seule
// mesure : chaque cellule porte la valeur que la table rend, telle quelle, et
// sa clé de mise en forme ; aucune arithmétique ne s'y fait, aucun plafond
// ne s'y recompose. Des rencontres, il ne porte que le minimum, sur les trois
// populations du § 5.4 — tous, mobiles, ancrés —, en tête des colonnes de
// mesure ; la moyenne n'y entre pas. Le plafond réalisé, individuel, se lit
// par le manque, dont les cellules sont celles de troisChiffres. Les imposés
// se disent à part, sur chaque ligne, jamais ajoutés aux choisis.
//
// Chaque minimum affiché désigne la personne la plus mal servie (§ 12.1) :
// le moins de rencontres, d'organisations vues, de diversité. La redondance
// r(p) va dans l'autre sens — plus elle est grande, pire est le sort —, et
// son minimum désignerait la personne la mieux servie : elle se lit par sa
// somme Σ r(p), la grandeur que la recherche et le classement lisent.
//
// Les objectifs des tables et les animateurs (A9, A11) forment un sixième
// groupe de colonnes, présentes chacune quand son critère compte — coché et
// avec un objet, tel que l'état des critères de la table le dit — : le
// tableau ne recalcule ni « sans objet » ni le mode, qu'il lit dans les
// valeurs que le critère des objectifs classe. Les conflits d'organisation
// ouvrent le groupe des collisions, sous la même condition : sans paire de
// présents en conflit, la colonne n'y est pas.
//
// Une cellule vaut { colonne, valeur, cle, decimales } : cle null, la valeur
// est un nombre que format.nombre écrit avec decimales chiffres après la
// virgule ; sinon le texte est t(cle) — « — » pour une population vide,
// « inconnu » pour une grandeur que l'a priori inconnu ne permet pas, le
// certificat en mots.
import { lireEntier } from '../../application/capacite.js';
import { evaluer, nettoyage, retenuAjuste, retenuRetouche } from '../../application/evaluation.js';
import { nomAffiche } from '../../application/personnes.js';
import { presencesPartielles } from '../../application/places.js';

const VIDE = 'format.vide';
const INCONNU = 'propositions.valeur.inconnu';

// Chaque colonne de mesure et la lecture de sa valeur dans une ligne
// comparable de la table d'évaluation, dans l'ordre d'affichage. La Map ne
// sert qu'à retrouver la lecture d'une colonne ; COLONNES fixe l'ordre.
const LECTURES = new Map([
  ['rencontresTous', (l) => l.mesures.aggRencontres.tous.min],
  ['rencontresMobiles', (l) => l.mesures.aggRencontres.mobiles.min],
  ['rencontresAncres', (l) => l.mesures.aggRencontres.ancres.min],
  ['conflitsOrganisation', (l) => l.mesures.conflitsOrganisation],
  ['collisionsCumulees', (l) => l.mesures.collisionsCumulees],
  ['pairesDistinctes', (l) => l.mesures.pairesDistinctes],
  ['excedentCollisions', (l) => l.mesures.excedentCollisions],
  ['rencontresRepetees', (l) => l.mesures.rencontresRepetees.choisies],
  ['maxRencontresPaire', (l) => l.mesures.maxRencontresPaire],
  ['retoursChoisis', (l) => l.mesures.totalRetoursChoisis],
  ['organisationsVues', (l) => l.mesures.aggOrganisationsVues.tous.min],
  ['totalRedondance', (l) => l.mesures.totalRedondance],
  ['diversite', (l) => l.mesures.aggDiversite.tous.min],
  ['manqueMax', (l) => l.troisChiffres.manqueMax.tous],
  ['effectifManque', (l) => l.troisChiffres.effectifManque.tous],
  ['ecartItineraireMax', (l) => l.troisChiffres.ecartItineraireMax?.tous ?? null],
  ['ecartAuPlafondAPriori', (l) => l.ecartAuPlafondAPrioriMax],
  ['jamaisServies', (l) => l.mesures.objectifs?.jamaisServies ?? null],
  ['horsObjectifMax', (l) => l.mesures.objectifs?.horsObjectifMax ?? null],
  ['toursHorsObjectif', (l) => l.mesures.objectifs?.horsObjectif ?? null],
  ['toursSelonObjectif', (l) => l.mesures.objectifs?.agregat.tous.min ?? null],
  ['animateursRencontres', (l) => l.mesures.animateurs?.agregat.tous.min ?? null],
  ['animateursNonRencontres', (l) => l.mesures.animateurs?.nonRencontres ?? null],
  ['certificat', (l) => l.minimumAtteint],
]);

// Les colonnes que le tableau ne porte que sous une condition : [critère,
// valeur], la colonne présente quand le critère compte et, valeur non
// null, quand il classe cette valeur — les conflits d'organisation dès
// qu'une paire de présents est en conflit, les personnes jamais servies
// sous « chacun au moins une fois », le plus de tours hors objectif d'une
// personne sous le troisième mode. Toute autre colonne est toujours là. La
// Map ne sert qu'à retrouver la condition d'une colonne.
const SOUS_CONDITION = new Map([
  ['conflitsOrganisation', ['conflitsOrganisation', 'conflitsOrganisation']],
  ['jamaisServies', ['toursHorsObjectif', 'jamaisServies']],
  ['horsObjectifMax', ['toursHorsObjectif', 'horsObjectifMax']],
  ['toursHorsObjectif', ['toursHorsObjectif', 'toursHorsObjectif']],
  ['toursSelonObjectif', ['toursHorsObjectif', null]],
  ['animateursRencontres', ['animateursNonRencontres', null]],
  ['animateursNonRencontres', ['animateursNonRencontres', 'animateursNonRencontres']],
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
 *  tête, celles des objectifs et des animateurs en dernier —, le certificat,
 *  les imposés et les commandes ; toutes celles qu'un tableau peut porter,
 *  tableau() rendant celles que porte le sien. Chacune porte son nom,
 *  la clé de son en-tête, qui nomme son unité, celle de son explication,
 *  le texte de l'infobulle de son en-tête et de la valeur appliquée qui la
 *  désigne, et nombre, vrai quand ses cellules portent un nombre. */
export const COLONNES = Object.freeze(
  ['rang', 'proposition', ...LECTURES.keys(), 'imposes', 'commandes'].map((nom) =>
    Object.freeze({ nom, cle: `propositions.colonne.${nom}`, explication: `propositions.explication.${nom}`, nombre: !TEXTUELLES.has(nom) }),
  ),
);

// La colonne des conflits d'organisation, qui ouvre le groupe des
// collisions : son nom est celui de son critère.
const COLONNE_DES_CONFLITS = 'conflitsOrganisation';

// Les groupes d'en-têtes : chacun nomme des colonnes de mesure voisines dans
// COLONNES, sous la clé propositions.groupe.<nom>.
const GROUPES = [
  ['rencontres', ['rencontresTous', 'rencontresMobiles', 'rencontresAncres']],
  ['collisions', [COLONNE_DES_CONFLITS, 'collisionsCumulees', 'pairesDistinctes', 'excedentCollisions']],
  ['repetitions', ['rencontresRepetees', 'maxRencontresPaire', 'retoursChoisis']],
  ['diversite', ['organisationsVues', 'totalRedondance', 'diversite']],
  ['manque', ['manqueMax', 'effectifManque', 'ecartItineraireMax', 'ecartAuPlafondAPriori']],
  ['objectifs', ['jamaisServies', 'horsObjectifMax', 'toursHorsObjectif', 'toursSelonObjectif', 'animateursRencontres', 'animateursNonRencontres']],
];

// Les segments de la rangée des groupes sur les colonnes noms, une suite de
// COLONNES : un groupe couvre celles de ses colonnes que noms porte d'un seul
// segment, une colonne hors groupe forme le sien, sans clé ; un groupe dont
// noms ne porte aucune colonne n'a pas de segment. Un groupe dont les
// colonnes ne se suivent pas dans noms lève : au chargement du module pour
// COLONNES entier.
function segmenter(noms) {
  const segments = [];
  for (let rang = 0; rang < noms.length; ) {
    const groupe = GROUPES.find(([, colonnes]) => colonnes.includes(noms[rang]));
    if (groupe === undefined) {
      segments.push({ cle: null, colonnes: [noms[rang]] });
      rang += 1;
      continue;
    }
    const [nom, colonnes] = groupe;
    const portees = colonnes.filter((colonne) => noms.includes(colonne));
    portees.forEach((colonne, decalage) => {
      if (noms[rang + decalage] !== colonne) throw new Error(`groupe ${nom} : colonnes non voisines`);
    });
    segments.push({ cle: `propositions.groupe.${nom}`, colonnes: portees });
    rang += portees.length;
  }
  return Object.freeze(
    segments.map(({ cle, colonnes }) => Object.freeze({ cle, etendue: colonnes.length, colonnes: Object.freeze([...colonnes]) })),
  );
}

/** La rangée des groupes d'en-têtes de COLONNES entier, au-dessus de celle
 *  des colonnes : { cle, etendue, colonnes } par segment, dans l'ordre de
 *  COLONNES — cle, la clé du libellé du groupe, null pour une colonne hors
 *  groupe ; etendue, le nombre de colonnes couvertes ; colonnes, leurs noms.
 *  Les segments couvrent chaque colonne une fois. tableau() rend ceux des
 *  colonnes que porte le sien. */
export const GROUPES_COLONNES = segmenter(COLONNES.map(({ nom }) => nom));

// Les colonnes que porte le tableau d'une table d'évaluation, dans l'ordre de
// COLONNES : chacune hors de SOUS_CONDITION, et celles dont la condition
// tient sur l'état des critères de la table, {nom, coche, sansObjet,
// valeurs}. Un critère compte quand il est coché et a un objet.
function colonnesPortees(criteres) {
  const comptent = new Map(criteres.filter(({ coche, sansObjet }) => coche && !sansObjet).map(({ nom, valeurs }) => [nom, valeurs]));
  return COLONNES.filter(({ nom }) => {
    const condition = SOUS_CONDITION.get(nom);
    if (condition === undefined) return true;
    const [critere, valeur] = condition;
    const valeurs = comptent.get(critere);
    return valeurs !== undefined && (valeur === null || valeurs.includes(valeur));
  });
}

/**
 * La clé de l'explication d'une colonne : le texte de l'infobulle de son
 * en-tête, et celui du nom qui la désigne dans la phrase de l'ordre
 * (colonneDeValeur) — une valeur appliquée et sa colonne partagent la même.
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

/**
 * La cellule d'une colonne de mesure pour une ligne comparable de la table
 * d'évaluation : { colonne, valeur, cle, decimales }, celle que le tableau
 * écrit sous cette colonne. La mesure se lit dans la ligne par le nom de sa
 * colonne, que le tableau porte la colonne ou non : une tuile de la page de
 * qualité lit ainsi la même mesure qu'une colonne absente — critère décoché,
 * valeur que le mode réglé ne compare pas — porterait (§ 12.2, D48). L'a
 * priori est inconnu quand troisChiffres ne porte pas d'écart d'itinéraire
 * du tout : ses deux colonnes s'écrivent alors « inconnu ». Lève TypeError
 * pour un nom qui n'est pas celui d'une colonne de mesure.
 *
 * @param {import('../../application/evaluation.js').LigneEvaluation} ligne  comparable
 * @param {string} nom  le nom d'une colonne de mesure de COLONNES
 * @returns {{colonne: string, valeur: number|boolean|null, cle: string|null, decimales: number}}
 */
export function lireColonne(ligne, nom) {
  const lire = LECTURES.get(nom);
  if (lire === undefined) throw new TypeError(`colonne de mesure inconnue : ${nom}`);
  if (nom === 'certificat') return certificat(ligne);
  if (ligne.troisChiffres.ecartItineraireMax === null && SELON_A_PRIORI.has(nom)) {
    return { colonne: nom, valeur: null, cle: INCONNU, decimales: 0 };
  }
  return nombre(nom, lire(ligne));
}

// Les cellules de mesure d'une ligne comparable, une par colonne de mesure
// portée, dans l'ordre de LECTURES.
function cellules(ligne, portees) {
  return [...LECTURES.keys()].filter((colonne) => portees.has(colonne)).map((colonne) => lireColonne(ligne, colonne));
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

// La phrase des conflits d'organisation qu'une ligne laisse (§ 5.3, § 5.7) :
// « N conflits restants », quand sa mesure en compte ; null à zéro, et
// quand le critère est sans objet — la mesure vaut alors null.
const conflitsRestants = ({ mesures }) =>
  mesures.conflitsOrganisation > 0 ? { cle: 'propositions.conflitsRestants', details: { nombre: mesures.conflitsOrganisation } } : null;

// Une raison de dérive : son code, ses détails, et la personne qu'elle nomme,
// null quand elle n'en nomme aucune.
const raisonDe = (raison) => ({ ...codeDe(raison), participant: raison.participant ?? null });

// La ligne d'un placement mesuré, ou celle d'un placement hors classement.
// portees : les noms des colonnes que porte le tableau ; rang : la place
// dans le classement, à partir de 1 ; null hors classement et pour le
// retenu. sertDeDepart se recopie de la table : vrai pour une comparable et
// pour une ligne en dérive par ses seuls participants.
function ligneDe(ligne, table, idRetenu, portees, rang = null) {
  const retenue = ligne.id === idRetenu;
  if (ligne.statut !== 'comparable') {
    return {
      id: ligne.id,
      rang: null,
      retenue,
      comparable: false,
      sertDeDepart: ligne.sertDeDepart,
      statut: `propositions.statut.${ligne.statut}`,
      raisons: ligne.raisons.map(raisonDe),
    };
  }
  return {
    id: ligne.id,
    rang,
    retenue,
    comparable: true,
    sertDeDepart: ligne.sertDeDepart,
    cellules: cellules(ligne, portees),
    imposes: imposes(ligne, table.imposes),
    violations: ligne.violations.map(codeDe),
    conflitsRestants: conflitsRestants(ligne),
  };
}

// La colonne que désigne chaque valeur qui classe (§ 5.7, A11) : celle qui
// la porte ; l'identifiant croissant, le dernier départage, désigne la
// colonne des propositions. La Map ne sert qu'à retrouver la colonne d'une
// valeur ; la phrase suit l'ordre que le classement rend.
const COLONNE_DE_VALEUR = new Map([
  ['conflitsOrganisation', 'conflitsOrganisation'],
  ['ecartAuPlafondAPrioriMax', 'ecartAuPlafondAPriori'],
  ['excedentCollisions', 'excedentCollisions'],
  ['collisionsCumulees', 'collisionsCumulees'],
  ['jamaisServies', 'jamaisServies'],
  ['horsObjectifMax', 'horsObjectifMax'],
  ['toursHorsObjectif', 'toursHorsObjectif'],
  ['rencontresRepeteesChoisies', 'rencontresRepetees'],
  ['retoursChoisis', 'retoursChoisis'],
  ['animateursNonRencontres', 'animateursNonRencontres'],
  ['redondance', 'totalRedondance'],
  ['identifiant', 'proposition'],
]);

/**
 * La colonne du tableau que désigne une valeur qui classe (valeursQuiClassent,
 * criteres.js), ou 'identifiant', le dernier départage, qui désigne la
 * colonne des propositions. Lève TypeError pour un nom que la table ne
 * connaît pas : une valeur ajoutée au classement doit dire laquelle elle
 * compare.
 *
 * @param {string} valeur  une valeur qui classe, ou 'identifiant'
 * @returns {string}  le nom d'une colonne de COLONNES
 */
export function colonneDeValeur(valeur) {
  const colonne = COLONNE_DE_VALEUR.get(valeur);
  if (colonne === undefined) throw new TypeError(`valeur sans colonne : ${valeur}`);
  return colonne;
}

// Un morceau de phrase : un texte de liaison, ou un nom qui désigne une
// colonne — celui d'une valeur appliquée, sous la clé
// moteur.valeur.<valeur>, avec le critère qui la classe.
const liaison = (cle, details = {}) => ({ cle, details, critere: null, valeur: null, colonne: null });
const designant = (critere, valeur, cle = `moteur.valeur.${valeur}`) => ({ cle, details: {}, critere, valeur, colonne: colonneDeValeur(valeur) });

// Des listes de morceaux mises bout à bout, le morceau separateur entre deux.
const joindre = (listes, separateur) => listes.flatMap((morceaux, rang) => (rang === 0 ? morceaux : [separateur(), ...morceaux]));

// Les noms d'un critère appliqué, {nom, valeurs, poids} : chaque valeur
// qu'il classe, dans l'ordre, séparées par « puis » comme deux paliers.
const nomsDuCritere = ({ nom, valeurs }) =>
  joindre(
    valeurs.map((valeur) => [designant(nom, valeur)]),
    () => liaison('propositions.ordre.separateur'),
  );

// Un palier appliqué en morceaux : les noms de son critère, seul ; pour un
// palier partagé, « ensemble, » puis chaque critère suivi de son poids,
// séparés par une virgule.
function palierEnMorceaux({ criteres }) {
  if (criteres.length === 1) return nomsDuCritere(criteres[0]);
  return [
    liaison('propositions.ordre.ensemble'),
    ...joindre(
      criteres.map((critere) => [...nomsDuCritere(critere), liaison('propositions.ordre.poids', { poids: critere.poids })]),
      () => liaison('propositions.ordre.virgule'),
    ),
  ];
}

// La phrase des critères appliqués, morceau par morceau (A11) : le début,
// chaque palier appliqué dans l'ordre, puis l'identifiant croissant, séparés
// par « puis », et la fin. Chaque nom est celui de la valeur que le palier
// applique — « retours » pour les rencontres répétées sous « nouvelle
// table » seule. Sous l'ordre par défaut et les quatre cases cochées, sans
// objectif ni case des animateurs, chaque palier porte un critère qui
// classe une valeur du nom de son critère, et les morceaux traduits bout à
// bout composent le texte de propositions.ordre.criteres, celui de l'ordre
// fixe de référence.
function phraseDesCriteres(criteresAppliques) {
  const paliers = [...criteresAppliques.map(palierEnMorceaux), [designant('identifiant', 'identifiant', 'propositions.ordre.identifiant')]];
  return [
    liaison('propositions.ordre.debut'),
    ...joindre(paliers, () => liaison('propositions.ordre.separateur')),
    liaison('propositions.ordre.fin'),
  ];
}

// Le palier qui prend la place du palier sauté : ses critères {nom, poids,
// valeurs}, ceux du palier appliqué au rang rangSaute ; null quand aucun
// palier ne suit le palier sauté.
function palierAppliqueASaPlace({ criteresAppliques, rangSaute }) {
  const palier = criteresAppliques[rangSaute];
  return palier === undefined ? null : palier.criteres.map(({ nom, poids, valeurs }) => ({ nom, poids, valeurs: [...valeurs] }));
}

// Les phrases de l'ordre (§ 5.7), chacune une liste de morceaux : quand le
// plafond a priori manque, le critère sauté et le palier appliqué à sa
// place, s'il en est un ; puis les paliers appliqués.
function ordre(classement) {
  const { criteresAppliques, critereSaute } = classement;
  const phrases = [];
  if (critereSaute !== null) {
    phrases.push([liaison('propositions.ordre.saute', { saute: critereSaute, applique: palierAppliqueASaPlace(classement) })]);
  }
  phrases.push(phraseDesCriteres(criteresAppliques));
  return phrases;
}

/**
 * Le tableau d'une table d'évaluation (evaluer, evaluation.js).
 *
 * @param {import('../../application/evaluation.js').TableEvaluation} tableEvaluation
 * @param {{ajuste?: boolean, retouche?: boolean}} [options]  ajuste : le
 *   retenu ne porte plus le placement de sa proposition d'origine
 *   (retenuAjuste) ; retouche, ajuste par défaut : il porte une retouche que
 *   retenir sa proposition détruirait (retenuRetouche). Ils choisissent le
 *   libellé de la ligne du retenu
 * @returns {{ordre: Array<Array<{cle: string, details: Object, critere: string|null,
 *   valeur: string|null, colonne: string|null}>>, colonnes: typeof COLONNES,
 *   groupes: typeof GROUPES_COLONNES, etendueRaisons: number, lignes: Object[],
 *   horsClassement: Object[], retenu: Object|null}}
 *   ordre : les phrases de l'ordre, chacune une liste de morceaux que t
 *   traduit et que l'affichage met bout à bout ; un morceau qui nomme une
 *   valeur appliquée, ou l'identifiant croissant, porte le critère qui la
 *   classe, la valeur et la colonne qu'elle désigne — 'identifiant' pour
 *   le dernier départage —, null pour un texte de liaison ; colonnes : celles
 *   de COLONNES que le tableau porte, les colonnes des objectifs et des
 *   animateurs selon l'état des critères de la table ; groupes : les
 *   segments de la rangée des groupes sur ces colonnes ; lignes : les
 *   comparables dans l'ordre du classement, chacune { id, rang, retenue, comparable: true,
 *   sertDeDepart, cellules, imposes, violations, conflitsRestants } —
 *   conflitsRestants, la phrase { cle, details } des conflits
 *   d'organisation que la ligne laisse, null quand elle n'en laisse aucun ;
 *   horsClassement : les autres par identifiant, { id, rang: null, retenue,
 *   comparable: false, sertDeDepart, statut, raisons } — sertDeDepart vrai
 *   pour une ligne en dérive par ses seuls participants, que « Repartir
 *   d'elle » offre de dériver ; statut la clé de « non comparable »,
 *   raisons leurs codes, chacune { cle, details, participant }, participant
 *   l'identifiant de la personne en cause ou null ; etendueRaisons : le nombre
 *   de colonnes que couvre la cellule des raisons ; retenu : la ligne du
 *   retenu sous l'une ou l'autre forme, plus libelle { cle, details } — « tel
 *   que », « ajusté aux participants » ou « ajusté à la main » —, null sans
 *   retenu. retenue marque la proposition
 *   d'origine du retenu.
 */
export function tableau(tableEvaluation, { ajuste = false, retouche = ajuste } = {}) {
  const idRetenu = tableEvaluation.retenu?.id ?? null;
  const colonnes = colonnesPortees(tableEvaluation.criteres);
  const portees = new Set(colonnes.map(({ nom }) => nom));
  // Les comparables ouvrent la liste, dans l'ordre du classement : leur
  // place y est leur rang.
  const toutes = tableEvaluation.propositions.map((ligne, place) => ligneDe(ligne, tableEvaluation, idRetenu, portees, place + 1));
  return {
    ordre: ordre(tableEvaluation.classement),
    colonnes,
    groupes: segmenter(colonnes.map(({ nom }) => nom)),
    // La cellule des raisons d'une ligne hors classement couvre les colonnes
    // de mesure portées et celle des imposés.
    etendueRaisons: [...LECTURES.keys()].filter((nom) => portees.has(nom)).length + 1,
    lignes: toutes.filter(({ comparable }) => comparable),
    horsClassement: toutes.filter(({ comparable }) => !comparable),
    retenu: tableEvaluation.retenu === null ? null : ligneDuRetenu(tableEvaluation, idRetenu, portees, cleDuRetenu(ajuste, retouche)),
  };
}

// La clé du libellé du retenu : « tel que » la proposition d'origine,
// « ajusté aux participants » quand seuls les gestes qui changent les
// participants l'en écartent, « ajusté à la main » quand il porte une
// retouche.
function cleDuRetenu(ajuste, retouche) {
  if (retouche) return 'propositions.retenu.ajuste';
  return ajuste ? 'propositions.retenu.presence' : 'propositions.retenu.origine';
}

// La ligne du retenu, et son libellé, de clé cle (cleDuRetenu).
function ligneDuRetenu(tableEvaluation, idRetenu, portees, cle) {
  return { ...ligneDe(tableEvaluation.retenu, tableEvaluation, idRetenu, portees), libelle: { cle, details: { proposition: idRetenu } } };
}

/**
 * La note des présences, au-dessus du tableau (§ 5.7) : ses phrases, chacune
 * {cle, details}, dans l'ordre. Quand une personne non exclue n'est pas
 * présente à chaque tour, le compte de ces personnes
 * (propositions.presences.note {absentes}) : chaque chiffre du tableau se lit
 * sur leurs tours de présence. Quand aucune ligne n'est classée et qu'une au
 * moins sert de départ, la phrase qui nomme « Repartir d'elle »
 * (propositions.presences.toutesEnDerive) : un changement de participants
 * déclasse toutes les propositions, et une dérivée les classe de nouveau.
 * [] sans tableau.
 *
 * @param {Object} charge  la charge de l'événement ouvert
 * @param {null|{lignes: Object[], horsClassement: Object[]}} vue  ce que rend
 *        tableau(), toutes ses lignes
 * @returns {Array<{cle: string, details: Object}>}
 */
export function notePresences(charge, vue) {
  if (vue === null) return [];
  const phrases = [];
  const absentes = presencesPartielles(charge).length;
  if (absentes > 0) phrases.push({ cle: 'propositions.presences.note', details: { absentes } });
  if (vue.lignes.length === 0 && vue.horsClassement.some(({ sertDeDepart }) => sertDeDepart)) {
    phrases.push({ cle: 'propositions.presences.toutesEnDerive', details: {} });
  }
  return phrases;
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

// Le retenu ajusté se définit une fois, dans l'évaluation, que la page de
// qualité lit aussi : le tableau et la page s'accordent sur le même retenu.
// Le retenu retouché aussi, à côté de lui.
export { retenuAjuste, retenuRetouche };

/**
 * La fenêtre à confirmer avant de retenir la proposition id (§ 2.1) : retenir
 * remplace le retenu, et détruit ses retouches à la main quand il en porte.
 * Elle s'ouvre quand la séance accepterait le geste — etat.refus null — et
 * que le retenu est retouché (retenuRetouche), y compris pour re-retenir sa
 * proposition d'origine ; un geste que la séance refuserait s'exécute sans
 * fenêtre, et son refus s'affiche. Un retenu que seuls les gestes sur les
 * participants ont ajusté n'en ouvre pas : retenirProposition ajuste de même
 * la proposition à la présence.
 *
 * @param {{refus: Object|null, charge: Object|null}} etat  l'état observable de la séance
 * @param {number} id  la proposition à retenir
 * @returns {null|{id: number, titre: {cle: string, details: Object},
 *   elements: Array<{cle: string, details: Object}>}}  null sans fenêtre ;
 *   sinon la proposition demandée, le titre, puis les éléments qui nomment le
 *   retenu ajusté et la proposition qui le remplace
 */
export function demandeConfirmation({ refus, charge }, id) {
  if (refus !== null || charge === null || !retenuRetouche(charge)) return null;
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
// de la charge. La charge de l'état observable de la séance est figée en
// profondeur (seance.js, copiePubliee) : une charge neuve à chaque changement
// de l'événement ouvert, gardée telle quelle sinon, dont les propositions
// figées sont partagées d'une charge à la suivante. L'identité de la charge
// suffit donc à dire que son contenu n'a pas changé, et Génération et
// Propositions relisent la même table. La table dépend de la charge
// entière : elle se garde sous la charge, jamais sous une proposition que
// deux charges partagent. Une charge qui n'est pas figée partout se mesure à
// chaque appel, son contenu pouvant changer sous la même identité. Le § 13.3
// compte sur la réactivité de Svelte plutôt que sur une mémoïsation posée à
// la main ; ce cache en est l'exception voulue, posé dans le modèle pur et
// tenu par l'immuabilité de son entrée.
const evaluees = new WeakMap();

/** Vrai quand chaque objet atteint depuis valeur est figé. Un objet figé ne
 *  redevient jamais modifiable : vrai une fois, vrai pour toujours. */
export function figeePartout(valeur) {
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

/** Le nombre de propositions qu'une page du tableau montre (§ 5.7) : le
 *  classement entier se découpe en pages de TAILLE_PAGE lignes, la ligne du
 *  retenu en plus, hors du compte. */
export const TAILLE_PAGE = 100;

/** Le nombre de pages d'un tableau de total propositions : une au moins,
 *  la page d'un tableau vide comprise. */
export function nombreDePages(total) {
  return Math.max(1, Math.ceil(total / TAILLE_PAGE));
}

// La page bornée aux pages existantes : la première en deçà, la dernière
// au-delà.
const bornee = (page, pages) => Math.min(Math.max(1, page), pages);

/**
 * La page d'un tableau (tableau()) : le classement unique découpé, jamais
 * retrié. Les propositions se comptent dans l'ordre où le tableau les
 * montre — les classées dans l'ordre du classement, puis celles hors
 * classement —, et la page p porte celles de rang (p − 1) × TAILLE_PAGE + 1
 * à p × TAILLE_PAGE. Chaque ligne garde le rang global que tableau() lui a
 * donné. La page demandée se borne aux pages existantes.
 *
 * @param {{lignes: Object[], horsClassement: Object[]}} vue
 * @param {number} page  entière, à partir de 1
 * @returns {{lignes: Object[], horsClassement: Object[], page: number,
 *   pages: number, premier: number, dernier: number, total: number,
 *   paginee: boolean}}  lignes et horsClassement : celles de la page, dans
 *   l'ordre de la vue ; page : la page bornée ; pages : leur nombre ;
 *   premier et dernier : les places, à partir de 1, de la première et de la
 *   dernière proposition de la page, 0 et 0 sans proposition ; total : le
 *   nombre de propositions de la vue ; paginee : vrai au-delà d'une page,
 *   seul cas où des commandes de page existent
 */
export function pagine(vue, page) {
  const classees = vue.lignes.length;
  const total = classees + vue.horsClassement.length;
  const pages = nombreDePages(total);
  const montree = bornee(page, pages);
  const debut = (montree - 1) * TAILLE_PAGE;
  const fin = Math.min(debut + TAILLE_PAGE, total);
  return {
    lignes: vue.lignes.slice(debut, fin),
    horsClassement: vue.horsClassement.slice(Math.max(0, debut - classees), Math.max(0, fin - classees)),
    page: montree,
    pages,
    premier: total === 0 ? 0 : debut + 1,
    dernier: fin,
    total,
    paginee: total > TAILLE_PAGE,
  };
}

/**
 * La page du tableau qui porte la proposition id, classée ou hors
 * classement ; null quand la vue ne la porte pas.
 *
 * @param {{lignes: Object[], horsClassement: Object[]}} vue
 * @param {number|null} id
 * @returns {number|null}
 */
export function pageDe(vue, id) {
  const place = [...vue.lignes, ...vue.horsClassement].findIndex((ligne) => ligne.id === id);
  return place === -1 ? null : Math.floor(place / TAILLE_PAGE) + 1;
}

// Ce qui distingue une proposition d'une autre : son identifiant, et ce qui
// la régénère. Un retour arrière rend des identifiants que la génération
// suivante réattribue, sous d'autres graines : l'identifiant seul ne dirait
// pas qu'elle est nouvelle.
const cleDe = ({ id, graine, arret, historique }) => `${id}/${graine}/${arret}/${historique}`;

/**
 * @typedef {Readonly<{cles: ReadonlyArray<string>, visee: number, page: number,
 *   pages: number}>} SuiviDePage
 *   la page du tableau que l'état de navigation retient pour l'événement
 *   ouvert : les clés des propositions vues (cleDe), le numéro de la
 *   dernière visée prise en compte (EtatUi.visee), la page, et le nombre de
 *   pages
 */

// Vrai quand deux listes de clés portent les mêmes clés, dans le même ordre.
const memesCles = (a, b) => a.length === b.length && a.every((cle, place) => cle === b[place]);

/**
 * La page à montrer, du suivi que l'état de navigation retient et de ce que
 * l'écran montre maintenant (§ 8.4 : un état d'interface, que rien
 * n'écrit) :
 *
 * - la première, sans suivi retenu — l'état de navigation le remet à null à
 *   chaque ouverture d'un événement —, ou quand une proposition est
 *   nouvelle : une génération montre son classement depuis le meilleur ;
 * - sinon la page retenue, bornée à la dernière qui existe encore ;
 * - à chaque visée nouvelle — un numéro de visée autre que celui du suivi :
 *   « Voir sur le plan », un remède qui montre une proposition, même celle
 *   que le plan montrait déjà —, la page qui porte la proposition visée, si
 *   la vue la porte. Une visée retirée (vise null) n'amène rien.
 *
 * Rien de changé, le suivi retenu revient lui-même : l'état de navigation,
 * qui ne publie qu'un état différent, ne republie pas.
 *
 * @param {SuiviDePage|null} retenue
 * @param {{vue: {lignes: Object[], horsClassement: Object[]},
 *   propositions: Object[], vise: number|null, visee: number}} observee  le
 *   tableau, les propositions de la charge, la proposition que l'état de
 *   navigation demande au plan, et le numéro de cette visée
 * @returns {SuiviDePage}  le suivi à retenir, celui de la page montrée
 */
export function suivrePage(retenue, { vue, propositions, vise, visee }) {
  const cles = propositions.map(cleDe);
  const pages = nombreDePages(vue.lignes.length + vue.horsClassement.length);
  const connues = new Set(retenue?.cles ?? []);
  const neuve = retenue === null || cles.some((cle) => !connues.has(cle));
  let page = neuve ? 1 : retenue.page;
  const visant = vise !== null && (retenue === null || visee !== retenue.visee) ? pageDe(vue, vise) : null;
  if (visant !== null) page = visant;
  page = bornee(page, pages);
  if (retenue !== null && retenue.visee === visee && retenue.page === page && retenue.pages === pages && memesCles(retenue.cles, cles)) {
    return retenue;
  }
  return Object.freeze({ cles: Object.freeze(cles), visee, page, pages });
}

/**
 * Le suivi à la page demandée, bornée aux pages existantes.
 *
 * @param {SuiviDePage} suivi
 * @param {number} page
 * @returns {SuiviDePage}
 */
export function changerDePage(suivi, page) {
  return Object.freeze({ ...suivi, page: bornee(page, suivi.pages) });
}

/**
 * Le texte de l'étendue d'une page (pagine) : « Propositions 101 à 200 sur
 * 237 », au singulier pour une page d'une seule proposition. Ses nombres se
 * mettent en forme par format.nombre ; le compte de la page accorde le nom.
 *
 * @param {{premier: number, dernier: number, total: number}} page
 * @param {{t: Function, format: {nombre: Function}}} outils  la traduction
 *   et la mise en forme du contexte
 * @returns {string}
 */
export function texteEtendue({ premier, dernier, total }, { t, format }) {
  return t('propositions.pages.etendue', {
    premier: format.nombre(premier),
    dernier: format.nombre(dernier),
    total: format.nombre(total),
    nombre: dernier - premier + 1,
  });
}

/** Le nombre de propositions que « Garder les N meilleures » garde au
 *  départ (§ 5.7). Le nombre réglé est une saisie de la section, que ni le
 *  fichier ni le journal ne portent. */
export const GARDEES_PAR_DEFAUT = 10;

/**
 * Lit la saisie du nombre de propositions à garder : un entier
 * (lireEntier, NON_ENTIER {saisie}), puis au moins 1 (HORS_DOMAINE {min: 1,
 * max: null}) ; chaque refus porte un remède nul, la valeur se corrigeant
 * dans le champ même.
 *
 * @param {string} saisie
 * @returns {{valeur: number}|{refus: {code: string, details: Object}}}
 */
export function lireGardees(saisie) {
  const lu = lireEntier(saisie);
  if (lu.refus !== undefined) return { refus: { code: lu.refus.code, details: lu.refus.details } };
  if (lu.valeur < 1) return { refus: { code: 'HORS_DOMAINE', details: { min: 1, max: null, remede: null } } };
  return { valeur: lu.valeur };
}

/**
 * La fenêtre à confirmer avant de garder les n meilleures propositions
 * (§ 5.7) : elle dit combien s'effacent, combien restent, et que la
 * proposition du retenu reste aussi quand elle vient après les n premières.
 * Le partage est celui de nettoyage (evaluation.js), sur la table que le
 * tableau montre (evaluation) : la fenêtre ne range rien elle-même. Sans
 * fenêtre — null —, le geste part tel quel et son refus s'affiche : quand la
 * séance le refuserait (etat.refus), quand rien ne se classe, faute de
 * charge ou de table, quand rien ne s'effacerait, et quand la commande
 * refuserait NETTOYAGE_SANS_CLASSEMENT : le classement compte moins de n
 * lignes, et une ligne à effacer sert de départ sans être classée — la règle
 * de garderMeilleures, lue sur la même table.
 *
 * @param {{refus: Object|null, charge: Object|null}} etat  l'état observable de la séance
 * @param {number} n  entier ≥ 1, le nombre à garder
 * @returns {null|{n: number, effacees: number, titre: {cle: string, details: Object},
 *   elements: Array<{cle: string, details: Object}>}}  null sans fenêtre ;
 *   sinon n, le nombre d'effacées, le titre, puis les éléments : les
 *   premières qui restent, la proposition du retenu quand elle reste en
 *   plus, et le retour que « Défaire » offre
 */
export function demandeNettoyage({ refus, charge }, n) {
  if (refus !== null || charge === null) return null;
  const { table } = evaluation(charge);
  if (table === null) return null;
  const { effacees, origineEnPlus } = nettoyage(table, n);
  if (effacees.length === 0 || sansClassement(table, n, effacees)) return null;
  const nombre = effacees.length;
  return {
    n,
    effacees: nombre,
    titre: { cle: 'propositions.nettoyage.titre', details: { n, effacees: nombre } },
    elements: [
      { cle: 'propositions.nettoyage.gardees', details: { n } },
      ...(origineEnPlus === null ? [] : [{ cle: 'propositions.nettoyage.origine', details: { proposition: origineEnPlus } }]),
      { cle: 'propositions.nettoyage.defaire', details: { effacees: nombre } },
    ],
  };
}

// Vrai quand garderMeilleures {n} refuserait NETTOYAGE_SANS_CLASSEMENT sur
// la table : le classement compte moins de n lignes, et une des effacees
// sert de départ sans être comparable.
function sansClassement(table, n, effacees) {
  if (table.classement.ordre.length >= n) return false;
  const aEffacer = new Set(effacees);
  return table.propositions.some(({ id, statut, sertDeDepart }) => aEffacer.has(id) && sertDeDepart && statut !== 'comparable');
}

/**
 * L'annonce qui suit le nettoyage : le nombre de propositions effacées, tel
 * que la commande garderMeilleures le rend dans son résumé.
 *
 * @param {number} effacees  resume.effacees du geste abouti
 * @returns {{cle: string, details: {effacees: number}}}
 */
export function annonceNettoyage(effacees) {
  return { cle: 'propositions.nettoyage.annonce', details: { effacees } };
}

/**
 * La page après un nettoyage : la première quand la page montrée avant,
 * pageAvant, n'existe plus — le suivi recalé par suivrePage la bornerait à
 * la dernière —, le suivi tel quel sinon, null compris.
 *
 * @param {SuiviDePage|null} suivi  le suivi recalé sur le tableau d'après
 * @param {number} pageAvant
 * @returns {SuiviDePage|null}
 */
export function pageApresNettoyage(suivi, pageAvant) {
  return suivi !== null && pageAvant > suivi.pages ? changerDePage(suivi, 1) : suivi;
}
