// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le registre des commandes du mobilier — tables, sièges, tours, réglages,
// cible de la somme de redondance (§ 4, § 6, § 7.1, § 8.2, § 8.9, § 9), que
// commandes.js réunit aux autres. Ses
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
import { caseLibre, geometrieTable, listeSurTable } from '../geometrie/tables.js';
import { CIBLE_REDONDANCE_PAR_DEFAUT, SCHEMA, TOURS_MAX, capacite, cibleRedondance } from '../stockage/document.js';
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

// Les recouvrements qu'un agrandissement fait naître : pour chaque
// table dont la capacité croît d'avant à apres, chaque autre table que sa
// liste couvre désormais, ou dont la liste couvre désormais son emprise
// agrandie — listeSurTable, d'un côté ou de l'autre —, quand ce
// recouvrement n'existait pas avant le geste. LISTE_SUR_VOISINE {table,
// voisine, numero, numeroVoisine}, remède le déplacement de la voisine vers
// caseLibre des autres tables, chacune à sa capacité d'apres : un geste ne
// bouge que ce qu'il nomme, et l'opérateur choisit.
//
// Une paire de tables se dit une fois, quel que soit le nombre de ses
// tables agrandies : deux remèdes, l'un déplaçant chaque table, se
// contrediraient. table est toujours une table agrandie, que le texte dit
// telle. Quand les deux le sont, table est celle dont la liste couvre
// l'autre, et le remède déplace la couverte ; si chacune couvre l'autre, la
// première de la charge. Dans l'ordre des tables agrandies, puis des
// voisines, celui de la charge.
function listesSurVoisines(avant, apres) {
  const geometrieDe = (charge, table) => geometrieTable(table, capacite(charge, table));
  const listeSur = (charge, a, b) => listeSurTable(geometrieDe(charge, a), capacite(charge, a), geometrieDe(charge, b));
  const couvre = (charge, a, b) => listeSur(charge, a, b) || listeSur(charge, b, a);
  const anterieure = (table) => avant.tables.find(({ id }) => id === table.id);
  const agrandie = (table) => capacite(apres, table) > capacite(avant, anterieure(table));
  const dites = new Set();
  // Les remèdes se suivent : une voisine déjà envoyée ailleurs compte à sa
  // destination, pour que deux remèdes ne visent jamais la même case.
  const destinations = new Map();
  const avertissements = [];
  for (const grande of apres.tables) {
    if (!agrandie(grande)) continue;
    for (const autre of apres.tables) {
      if (autre.id === grande.id || !couvre(apres, grande, autre)) continue;
      const paire = `${Math.min(grande.id, autre.id)}:${Math.max(grande.id, autre.id)}`;
      if (dites.has(paire) || couvre(avant, anterieure(grande), anterieure(autre))) continue;
      dites.add(paire);
      const inverse = !listeSur(apres, grande, autre) && agrandie(autre) && listeSur(apres, autre, grande);
      const [table, voisine] = inverse ? [autre, grande] : [grande, autre];
      const autres = apres.tables
        .filter(({ id }) => id !== voisine.id)
        .map((place) => ({
          position: destinations.get(place.id) ?? place.position,
          forme: place.forme,
          places: capacite(apres, place),
        }));
      const position = destinations.get(voisine.id)
        ?? caseLibre(autres, { forme: voisine.forme, places: capacite(apres, voisine) });
      destinations.set(voisine.id, position);
      avertissements.push({
        code: 'LISTE_SUR_VOISINE',
        details: {
          table: table.id,
          voisine: voisine.id,
          numero: table.numero,
          numeroVoisine: voisine.numero,
          remede: { commande: 'deplacerTable', arguments: { id: voisine.id, position } },
        },
      });
    }
  }
  return avertissements;
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
 * par controlerCapacite selon leur origine ; le retenu suit. Un
 * agrandissement qui porte une liste sur une voisine le dit, après les
 * avertissements de la capacité : LISTE_SUR_VOISINE (listesSurVoisines).
 */
function changerPlacesTable(charge, { id, sieges: saisie, origine } = {}) {
  exigerModifiable(charge);
  const table = tableDe(charge, id);
  if (!ORIGINES.has(origine)) throw new TypeError(`origine : 'champ' ou 'poignee' attendue, reçu ${JSON.stringify(origine)}`);
  const sieges = entierSaisi(saisie);
  const avertissements = exigerCapacite(charge, id, sieges, origine);
  const suivante = avecSieges(charge, new Map([[id, sieges]]));
  return {
    charge: suivante,
    libelle: libelle('ENTREE_CHANGER_PLACES_TABLE', { numero: table.numero, sieges }),
    avertissements: [...avertissements, ...listesSurVoisines(charge, suivante)],
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
  const suivante = avecSieges(charge, new Map([[id, null]]));
  return {
    charge: suivante,
    libelle: libelle('ENTREE_REALIGNER_TABLE', { numero: table.numero, sieges }),
    avertissements: [...avertissements, ...listesSurVoisines(charge, suivante)],
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
  const suivante = avecSieges(charge, new Map(realignees.map((table) => [table.id, null])), sieges);
  avertissements.push(...listesSurVoisines(charge, suivante));
  return {
    charge: suivante,
    libelle: libelle('ENTREE_CHANGER_DEFAUT', { sieges, realignees: realignees.length }),
    avertissements,
  };
}

/**
 * changerTours {tours} (§ 2.1 étape 5, § 4.3) : le nombre de tours, lu par
 * lireEntier ; MOINS_D_UN_TOUR {tours} sous 1, TROP_DE_TOURS {max} au-delà
 * de TOURS_MAX, la borne que l'analyse pose aussi, remède null. Retirer des tours
 * détruit les réservations « tour désigné » au-delà, dans la même entrée ;
 * la portée « tous » reste, symbolique. Propositions et retenu restent, en
 * dérive TOURS_CHANGES, jamais tronqués.
 */
function changerTours(charge, { tours: saisie } = {}) {
  exigerModifiable(charge);
  const tours = entierSaisi(saisie);
  if (tours < 1) throw refus('MOINS_D_UN_TOUR', { tours });
  if (tours > TOURS_MAX) throw refus('TROP_DE_TOURS', { max: TOURS_MAX });
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

/**
 * changerCibleRedondance {cible} (§ 5.4, § 8.1, § 8.9) : la cible de la
 * somme de redondance de l'événement, que la liste des événements compare à
 * Σ r(p) du retenu ; une saisie lue par lireEntier, un entier ≥ 0, NON_ENTIER
 * sinon — un signe moins compris —, remède null. La valeur par défaut,
 * CIBLE_REDONDANCE_PAR_DEFAUT, retire le champ des réglages : la charge
 * s'écrit alors comme une charge qui ne l'a jamais porté. La même valeur que
 * la cible courante, lue par cibleRedondance, est SANS_EFFET, champ écrit ou
 * non : une cible de 1000 écrite au fichier ne se retire pas par une saisie
 * qui ne change rien.
 */
function changerCibleRedondance(charge, { cible: saisie } = {}) {
  exigerModifiable(charge);
  const cible = entierSaisi(saisie);
  if (cible === cibleRedondance(charge)) throw refus('SANS_EFFET', { commande: 'changerCibleRedondance' });
  const suivante = structuredClone(charge);
  if (cible === CIBLE_REDONDANCE_PAR_DEFAUT) delete suivante.reglages.cibleRedondance;
  else suivante.reglages.cibleRedondance = cible;
  return { charge: suivante, libelle: libelle('ENTREE_CHANGER_CIBLE_REDONDANCE', { cible }), avertissements: [] };
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
  ['changerCibleRedondance', changerCibleRedondance],
]);
