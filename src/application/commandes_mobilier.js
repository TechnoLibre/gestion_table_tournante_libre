// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le registre des commandes du mobilier — tables, sièges, tours, réglages
// (§ 4, § 6, § 7.1, § 8.2, § 9), que commandes.js réunit aux autres. Ses
// imports n'atteignent jamais commandes.js : le registre réuni dépend de lui,
// non l'inverse.
//
// Chaque commande suit le contrat de commandes.js : une fonction pure
// (charge, arguments) → { charge, libelle, avertissements }, la charge reçue
// intacte ; un refus lève ErreurCommande(code, details), details.remede
// compris, calculé avant toute modification ; un argument de forme fausse ou
// une table inconnue lèvent TypeError, que l'interface n'offre jamais. Un
// plan bloqué refuse tout (PLAN_BLOQUE). Une saisie de places ou de tours se
// lit par lireEntier, la seule lecture d'un entier saisi.
//
// Une table a un identifiant, tiré de prochainsIds.table, qui ne revient
// jamais, et un numéro affiché, le plus grand plus un, qui ne se renumérote
// pas (§ 4). Les capacités passent par controlerCapacite (capacite.js) ; le
// retenu les suit, ses surnuméraires versés en réserve, et une table créée y
// entre, vide à chaque tour : il ne gagne aucune raison de dérive. Une
// proposition ne se réécrit jamais : elle dérive (§ 8.9, § 9). Supprimer une
// table et changer les tours laissent propositions et retenu en dérive.
import { caseLibre } from '../geometrie/tables.js';
import { SCHEMA, capacite } from '../stockage/document.js';
import { fautes } from '../stockage/placements.js';
import { bilanChangementDefaut } from './bilans.js';
import { controlerCapacite, lireEntier, retenuAuxCapacites } from './capacite.js';
import { ErreurCommande, refus } from './erreurs.js';
import { libelle } from './libelles.js';
import { leverRefus } from './pose.js';

const FORMES = new Set(['ronde', 'carree']);
const ORIGINES = new Set(['champ', 'poignee']);

// Le plus grand identifiant de table qu'admet la règle du schéma : le
// compteur, qui la suit, n'aurait plus de valeur au-delà de lui.
const regleDuChamp = (regle, cle) => regle.champs.find(([nom]) => nom === cle)[1];
const IDENTIFIANT_MAX = regleDuChamp(regleDuChamp(regleDuChamp(SCHEMA, 'charge'), 'tables').element, 'id').max;

// Les réglages que modifierReglage change : un interrupteur, ou un entier ≥ 1
// de la génération (§ 5.3, § 5.10).
const INTERRUPTEURS = new Set(['separerAppartenances', 'nouveauxVoisins', 'nouvelleTable', 'varierAppartenances', 'attribuerSieges']);
const ENTIERS_DE_GENERATION = new Set(['generation.nombre', 'generation.arret', 'generation.historique']);

// Un plan bloqué refuse toute modification ; débloquer seul le lève (§ 9).
function exigerModifiable(charge) {
  if (charge.evenement.etat === 'bloque') throw refus('PLAN_BLOQUE', {}, { geste: 'debloquer' });
}

// L'enregistrement de la table d'identifiant id : une table inconnue est une
// faute de l'appelant.
function tableDe(charge, id) {
  const table = charge.tables.find((candidate) => candidate.id === id);
  if (table === undefined) throw new TypeError(`table inconnue : ${JSON.stringify(id)}`);
  return table;
}

// La valeur d'un entier saisi, ou le refus NON_ENTIER levé.
function entierSaisi(saisie) {
  const lu = lireEntier(saisie);
  if (lu.refus) throw new ErreurCommande(lu.refus.code, lu.refus.details);
  return lu.valeur;
}

// La charge reçue, copiée, chaque table de changements (Map identifiant →
// sieges) à son nombre de sièges, null pour une table qui suit le défaut, et
// le retenu aux capacités qui en résultent.
function avecSieges(charge, changements, defaut = charge.evenement.siegesParDefaut) {
  const suivante = structuredClone(charge);
  suivante.evenement.siegesParDefaut = defaut;
  for (const table of suivante.tables) if (changements.has(table.id)) table.sieges = changements.get(table.id);
  const capacites = new Map(suivante.tables.map((table) => [table.id, capacite(suivante, table)]));
  const touchees = new Map(
    charge.tables
      .filter((table) => changements.has(table.id) || capacites.get(table.id) !== capacite(charge, table))
      .map(({ id }) => [id, capacites.get(id)]),
  );
  suivante.retenu = structuredClone(retenuAuxCapacites(charge, touchees));
  return suivante;
}

// Le rendu d'un contrôle de capacité accepté : ses avertissements, ou son
// refus levé.
function exigerCapacite(charge, id, sieges, origine) {
  const { refus: refuse, avertissements } = controlerCapacite(charge, id, sieges, { origine });
  if (refuse !== null) throw new ErreurCommande(refuse.code, refuse.details);
  return avertissements;
}

/**
 * creerTable {forme} (§ 4, § 6.1) : une table qui suit le défaut, d'identifiant
 * prochainsIds.table, numérotée après la plus grande, posée sur la première
 * case libre (caseLibre) de la grille des démonstrations, au pas que donnent
 * les tables posées, chacune à sa capacité, et la nouvelle. Sous un retenu
 * lisible, elle y entre avec sa capacité et une liste vide à chaque tour.
 */
function creerTable(charge, { forme } = {}) {
  exigerModifiable(charge);
  if (!FORMES.has(forme)) throw new TypeError(`forme : 'ronde' ou 'carree' attendue, reçu ${JSON.stringify(forme)}`);
  const id = charge.prochainsIds.table;
  if (id >= IDENTIFIANT_MAX) throw refus('COMPTEUR_SATURE', { compteur: 'table' });
  const numero = Math.max(0, ...charge.tables.map((table) => table.numero)) + 1;
  const posees = charge.tables.map((table) => ({ position: table.position, forme: table.forme, places: capacite(charge, table) }));
  const position = caseLibre(posees, { forme, places: charge.evenement.siegesParDefaut });
  const suivante = structuredClone(charge);
  suivante.tables.push({ id, numero, sieges: null, forme, position });
  suivante.prochainsIds.table = id + 1;
  const { retenu } = suivante;
  if (retenu !== null && fautes(retenu).length === 0) {
    retenu.tables.push(id);
    retenu.capacites.push(charge.evenement.siegesParDefaut);
    for (const etage of retenu.placement) etage.sieges.push([]);
  }
  return { charge: suivante, libelle: libelle('ENTREE_CREER_TABLE', { numero }), avertissements: [] };
}

/**
 * supprimerTable {id} (§ 6.2, § 9) : la table part, et avec elle, dans la
 * même entrée, ses réservations — suspendues comprises — et ses titres ; les
 * autres tables gardent leur numéro, propositions et retenu restent, en
 * dérive TABLE_SUPPRIMEE.
 */
function supprimerTable(charge, { id } = {}) {
  exigerModifiable(charge);
  const table = tableDe(charge, id);
  const suivante = structuredClone(charge);
  suivante.tables = suivante.tables.filter((candidate) => candidate.id !== id);
  suivante.reservations = suivante.reservations.filter((reservation) => reservation.table !== id);
  suivante.titres = suivante.titres.filter((titre) => titre.table !== id);
  const details = {
    numero: table.numero,
    reservations: charge.reservations.length - suivante.reservations.length,
    titres: charge.titres.length - suivante.titres.length,
  };
  return { charge: suivante, libelle: libelle('ENTREE_SUPPRIMER_TABLE', details), avertissements: [] };
}

/** deplacerTable {id, position: {x, y}} (§ 7.1) : la position du centre, arrondie au centimètre. */
function deplacerTable(charge, { id, position } = {}) {
  exigerModifiable(charge);
  const table = tableDe(charge, id);
  if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) {
    throw new TypeError(`position : {x, y} finis attendus, reçu ${JSON.stringify(position)}`);
  }
  const suivante = structuredClone(charge);
  // + 0 écrit 0 là où l'arrondi d'une petite valeur négative rend −0.
  suivante.tables.find((candidate) => candidate.id === id).position = { x: Math.round(position.x) + 0, y: Math.round(position.y) + 0 };
  return { charge: suivante, libelle: libelle('ENTREE_DEPLACER_TABLE', { numero: table.numero }), avertissements: [] };
}

/**
 * changerPlacesTable {id, sieges, origine: 'champ'|'poignee'} (§ 6.2, § 7.1) :
 * la table est surchargée à sieges places, lues par lireEntier, contrôlées
 * par controlerCapacite selon leur origine ; le retenu suit.
 */
function changerPlacesTable(charge, { id, sieges: saisie, origine } = {}) {
  exigerModifiable(charge);
  const table = tableDe(charge, id);
  if (!ORIGINES.has(origine)) throw new TypeError(`origine : 'champ' ou 'poignee' attendue, reçu ${JSON.stringify(origine)}`);
  const sieges = entierSaisi(saisie);
  const avertissements = exigerCapacite(charge, id, sieges, origine);
  return {
    charge: avecSieges(charge, new Map([[id, sieges]])),
    libelle: libelle('ENTREE_CHANGER_PLACES_TABLE', { numero: table.numero, sieges }),
    avertissements,
  };
}

/**
 * realignerTable {id} (§ 6.1) : la table suit de nouveau le défaut ; une
 * table surchargée au-dessus de lui subit une réduction, sous la règle du
 * champ (§ 6.2). Le retenu suit.
 */
function realignerTable(charge, { id } = {}) {
  exigerModifiable(charge);
  const table = tableDe(charge, id);
  const sieges = charge.evenement.siegesParDefaut;
  const avertissements = exigerCapacite(charge, id, sieges, 'champ');
  return {
    charge: avecSieges(charge, new Map([[id, null]])),
    libelle: libelle('ENTREE_REALIGNER_TABLE', { numero: table.numero, sieges }),
    avertissements,
  };
}

/**
 * changerDefaut {sieges, realigner: boolean} (§ 6.1) : le défaut change, et
 * avec lui chaque table qui le suit ; realigner, les surchargées le suivent
 * aussi. Une seule entrée. Chaque table touchée se contrôle avant
 * d'appliquer (bilanChangementDefaut) : un seul refus refuse le tout, le
 * premier levé, les suivants dans details.autres. Les avertissements sont
 * ceux du bilan ; AU_DELA_LISIBLE, de mêmes détails à chaque table, n'est
 * dit qu'une fois. Le retenu suit.
 */
function changerDefaut(charge, { sieges: saisie, realigner } = {}) {
  exigerModifiable(charge);
  if (typeof realigner !== 'boolean') throw new TypeError(`realigner : booléen attendu, reçu ${JSON.stringify(realigner)}`);
  const sieges = entierSaisi(saisie);
  const bilan = bilanChangementDefaut(charge, sieges, { realigner });
  leverRefus(bilan.refus.map(({ code, details }) => ({ code, details })));
  const avertissements = [];
  for (const { code, details } of bilan.avertissements) {
    if (code === 'AU_DELA_LISIBLE' && avertissements.some((deja) => deja.code === code)) continue;
    avertissements.push({ code, details });
  }
  const realignees = realigner ? charge.tables.filter((table) => table.sieges !== null) : [];
  return {
    charge: avecSieges(charge, new Map(realignees.map((table) => [table.id, null])), sieges),
    libelle: libelle('ENTREE_CHANGER_DEFAUT', { sieges, realignees: realignees.length }),
    avertissements,
  };
}

/**
 * changerTours {tours} (§ 2.1 étape 5, § 4.3) : le nombre de tours, lu par
 * lireEntier ; MOINS_D_UN_TOUR {tours} sous 1, remède null. Retirer des tours
 * détruit les réservations « tour désigné » au-delà, dans la même entrée ;
 * la portée « tous » reste, symbolique. Propositions et retenu restent, en
 * dérive TOURS_CHANGES, jamais tronqués.
 */
function changerTours(charge, { tours: saisie } = {}) {
  exigerModifiable(charge);
  const tours = entierSaisi(saisie);
  if (tours < 1) throw refus('MOINS_D_UN_TOUR', { tours });
  const suivante = structuredClone(charge);
  suivante.evenement.tours = tours;
  suivante.reservations = suivante.reservations.filter(({ portee, tour }) => portee === 'tous' || tour <= tours);
  return {
    charge: suivante,
    libelle: libelle('ENTREE_CHANGER_TOURS', { tours, retirees: charge.reservations.length - suivante.reservations.length }),
    avertissements: [],
  };
}

/**
 * modifierReglage {cle, valeur} (§ 5.3, § 15.4) : un interrupteur des
 * contraintes ou de l'attribution des sièges, un booléen ; ou generation.nombre,
 * generation.arret, generation.historique, un entier ≥ 1, que le contrôleur
 * de génération a lu et borné. Une autre clé, ou une autre valeur, est une
 * faute du code.
 */
function modifierReglage(charge, { cle, valeur } = {}) {
  exigerModifiable(charge);
  const suivante = structuredClone(charge);
  if (INTERRUPTEURS.has(cle)) {
    if (typeof valeur !== 'boolean') throw new TypeError(`${cle} : booléen attendu, reçu ${JSON.stringify(valeur)}`);
    suivante.reglages[cle] = valeur;
  } else if (ENTIERS_DE_GENERATION.has(cle)) {
    if (!Number.isSafeInteger(valeur) || valeur < 1) throw new TypeError(`${cle} : entier ≥ 1 attendu, reçu ${JSON.stringify(valeur)}`);
    suivante.reglages.generation[cle.slice('generation.'.length)] = valeur;
  } else {
    throw new TypeError(`réglage inconnu : ${JSON.stringify(cle)}`);
  }
  return { charge: suivante, libelle: libelle('ENTREE_MODIFIER_REGLAGE', { cle, valeur }), avertissements: [] };
}

/** @type {Map<string, (charge: Object, args: Object) => Object>} */
export const COMMANDES_MOBILIER = new Map([
  ['creerTable', creerTable],
  ['supprimerTable', supprimerTable],
  ['deplacerTable', deplacerTable],
  ['changerPlacesTable', changerPlacesTable],
  ['realignerTable', realignerTable],
  ['changerDefaut', changerDefaut],
  ['changerTours', changerTours],
  ['modifierReglage', modifierReglage],
]);
