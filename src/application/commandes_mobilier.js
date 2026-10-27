// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le registre des commandes du mobilier — tables et leur libellé, sièges,
// tours, réglages, objectifs des tables et leur règle par défaut, ordre des
// priorités et mode des objectifs (§ 4, § 4.5, § 5.3, § 5.7, § 6, § 7.1,
// § 8.2, § 8.9, § 9), que commandes.js réunit aux autres. Ses imports
// n'atteignent jamais commandes.js : le registre réuni dépend de lui, non
// l'inverse.
//
// Chaque commande suit le contrat de commandes.js : une fonction pure
// (charge, arguments) → { charge, libelle, avertissements }, la charge reçue
// intacte ; un refus lève ErreurCommande(code, details), details.remede
// compris, calculé avant toute modification ; un argument de forme fausse ou
// une table inconnue lèvent TypeError, que l'interface n'offre jamais, sauf
// pour un objectif : la table qu'il vise a pu disparaître pendant la saisie
// de ses étiquettes, et TABLE_DISPARUE le dit. Un plan bloqué refuse tout
// (PLAN_BLOQUE). Une saisie de places ou de tours se lit par lireEntier, la
// seule lecture d'un entier saisi.
//
// Une table a un identifiant, tiré de prochainsIds.table, qui ne revient
// jamais, et un numéro affiché, le plus grand plus un, qui ne se renumérote
// pas (§ 4). creerTable crée une table, ou, avec combler, en une seule
// entrée, les tables d'une taille donnée qui assoient chacun, et les
// animateurs à désigner qu'elles reçoivent (designerALaCreation,
// commandes_places.js) : le manque est celui de l'avis PLACES_MANQUANTES, lu
// dans capaciteParTour. Les capacités passent par controlerCapacite
// (capacite.js) ; le retenu les suit, ses surnuméraires versés en réserve,
// et une table créée y entre, vide à chaque tour : elle ne lui donne aucune
// raison de dérive, et une désignation qui la suit pèse sur lui comme toute
// réservation (§ 9). Une proposition ne se réécrit jamais : elle dérive
// (§ 8.9, § 9). Supprimer une table et changer les tours laissent
// propositions et retenu en dérive.
import { constante } from '../geometrie/constantes.js';
import { caseLibre, geometrieTable, listeSurTable } from '../geometrie/tables.js';
import { CRITERES, MODES_OBJECTIFS, POIDS_MAX, seulsASonPalier, verifierPriorites } from '../moteur/criteres.js';
import {
  CASES_FACULTATIVES,
  LIBELLE_TABLE_MAX,
  SCHEMA,
  TOURS_MAX,
  capacite,
  critereCoche,
  modeObjectifs,
  priorites,
  regleObjectifs,
} from '../stockage/document.js';
import { ETIQUETTES_MAX } from '../stockage/etiquettes.js';
import { copieDeTravail } from '../stockage/gel.js';
import { fautes } from '../stockage/placements.js';
import { presencesSousTours } from '../stockage/presence.js';
import { repartitionALaCreation } from './animateurs.js';
import { bilanChangementDefaut, capaciteParTour } from './bilans.js';
import { controlerCapacite, lireEntier, retenuAuxCapacites } from './capacite.js';
import { designerALaCreation } from './commandes_places.js';
import { ErreurCommande, refus } from './erreurs.js';
import { libelle } from './libelles.js';
import { avisDeLObjectif, avisObjectifs, etiquettesDeLEvenement, ordreDesObjectifs, recevoirEtiquettes } from './objectifs.js';
import { nomAffiche } from './personnes.js';
import { leverRefus } from './pose.js';

const FORMES = new Set(['ronde', 'carree']);
// La constante du seuil au-delà duquel le dessin d'une table cesse d'être
// lisible (§ 6.2), que lit constante.
const SEUIL_LISIBLE = { nom: 'SEUIL_SIEGES_LISIBLES' };
const ORIGINES = new Set(['champ', 'poignee']);

// Le plus grand identifiant de table qu'admet la règle du schéma : le
// compteur, qui la suit, n'aurait plus de valeur au-delà de lui.
const regleDuChamp = (regle, cle) => regle.champs.find(([nom]) => nom === cle)[1];
const REGLE_TABLE = regleDuChamp(regleDuChamp(SCHEMA, 'charge'), 'tables').element;
const IDENTIFIANT_MAX = regleDuChamp(REGLE_TABLE, 'id').max;

/** Les bornes du nombre de places d'une table, celles de la règle du
 *  schéma : min et max compris. */
export const PLACES_TABLE = Object.freeze({ min: regleDuChamp(REGLE_TABLE, 'sieges').min, max: regleDuChamp(REGLE_TABLE, 'sieges').max });

// Les réglages que modifierReglage change : un interrupteur, ou un entier ≥ 1
// de la génération (§ 5.3, § 5.10).
const INTERRUPTEURS = new Set(['separerOrganisations', 'nouveauxVoisins', 'nouvelleTable', 'varierOrganisations', 'attribuerSieges']);
const ENTIERS_DE_GENERATION = new Set(['generation.nombre', 'generation.arret', 'generation.historique']);
const REGLES = new Set(['ou', 'et']);

// Le mode des objectifs que les réglages ne portent pas (§ 8.9).
const MODE_PAR_DEFAUT = modeObjectifs({ reglages: {} });

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
  const suivante = copieDeTravail(charge);
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

// Ajoute à suivante, la copie de travail, une table de la forme donnée,
// à sieges places — null, elle suit le défaut —, d'identifiant
// prochainsIds.table, numérotée après la plus grande, posée sur la première
// case libre (caseLibre) de la grille, au pas que donnent les tables déjà
// posées, chacune à sa capacité, et la nouvelle. Sous un retenu lisible
// (dansLeRetenu), elle y entre avec sa capacité et une liste vide à chaque
// tour. Rend son numéro.
function poserTable(suivante, forme, sieges, dansLeRetenu) {
  const id = suivante.prochainsIds.table;
  const numero = Math.max(0, ...suivante.tables.map((table) => table.numero)) + 1;
  const places = sieges ?? suivante.evenement.siegesParDefaut;
  const posees = suivante.tables.map((table) => ({ position: table.position, forme: table.forme, places: capacite(suivante, table) }));
  const position = caseLibre(posees, { forme, places });
  suivante.tables.push({ id, numero, sieges, forme, position });
  suivante.prochainsIds.table = id + 1;
  if (dansLeRetenu) {
    suivante.retenu.tables.push(id);
    suivante.retenu.capacites.push(places);
    for (const etage of suivante.retenu.placement) etage.sieges.push([]);
  }
  return numero;
}

// Vrai quand le retenu de la charge se lit : une table créée y entre.
const retenuLisible = ({ retenu }) => retenu !== null && fautes(retenu).length === 0;

/**
 * Les tables qui manquent pour asseoir chacun, à sieges places par table
 * (§ 6.1) : manque, le plus grand manque d'un même tour — celui de l'avis
 * PLACES_MANQUANTES, max(0, présents du tour − places), lu dans
 * capaciteParTour —, 0 quand les places suffisent ; presentes, le plus grand
 * nombre de personnes présentes à un même tour, non exclues, qui vaut sans
 * absence le nombre de non-exclues ; places, la somme des capacités ;
 * tables, ceil(manque / sieges), 0 sans manque ; placesApres, les places
 * une fois ces tables créées. sieges n'est pas borné ici : la commande le
 * borne.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {number} sieges   un entier positif
 * @returns {{manque: number, presentes: number, places: number, tables: number, sieges: number, placesApres: number}}
 * @throws {TypeError} sieges qui n'est pas un entier positif
 */
export function bilanTablesManquantes(charge, sieges) {
  if (!Number.isSafeInteger(sieges) || sieges < 1) throw new TypeError(`sieges : entier positif attendu, reçu ${JSON.stringify(sieges)}`);
  const parTour = capaciteParTour(charge);
  const places = charge.tables.reduce((total, table) => total + capacite(charge, table), 0);
  const manque = Math.max(0, ...parTour.map((tour) => tour.manque));
  const presentes = Math.max(0, ...parTour.map((tour) => tour.presentes));
  const tables = Math.ceil(manque / sieges);
  return { manque, presentes, places, tables, sieges, placesApres: places + tables * sieges };
}

/**
 * La forme que « Créer les tables » propose (§ 6.1) : celle de la table la
 * plus récemment créée de l'événement — le plus grand identifiant, qui ne
 * revient jamais, quels que soient son numéro et son rang dans la liste —,
 * 'ronde' sans table. Elle se lit dans les tables : le fichier ne la porte
 * pas.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {'ronde'|'carree'}
 */
export function formeParDefaut(charge) {
  let derniere = null;
  for (const table of charge.tables) if (derniere === null || table.id > derniere.id) derniere = table;
  return derniere === null ? 'ronde' : derniere.forme;
}

// creerTable {forme, combler} : les tables de combler places qui
// assoient chacun (bilanTablesManquantes), en une entrée. combler se lit
// par lireEntier et se borne comme une capacité (PLACES_TABLE) :
// MOINS_DE_DEUX, TROP_DE_PLACES {max}, remède null. Sans manque :
// PLACES_SUFFISANTES {places, presentes}, remède null. Un compteur qui ne
// suffit pas à toutes refuse COMPTEUR_SATURE, et rien ne se crée. Une
// table à la taille du défaut le suit ; une autre est surchargée.
//
// Dans la même entrée, les personnes à désigner animatrices (aDesigner)
// sont désignées sur les tables créées, selon repartitionALaCreation, par
// designerALaCreation : chacune reçoit une réservation « tous les tours »
// et son titre pressenti, ou le titre par défaut, au plus petit siège libre
// de sa table. Le libellé compte les animateurs désignés. Une désignation
// suit la règle du § 5.9 : l'écart des places manquantes ne bouge sous
// aucune réservation, et le bilan reste juste. Avertissements, dans cet
// ordre : AU_DELA_LISIBLE {seuil} au-delà du seuil lisible, comme une
// saisie de places ; ceux des désignations ; puis ANIMATEURS_A_DESIGNER
// {personnes: [{participant, personne, cause, tours?}]}, chaque personne
// que la répartition laisse à désigner, nommée par son nom affiché, avec sa
// cause et, absente, ses tours d'absence. Elles n'arrêtent pas la
// création : la rangée « Animateurs » d'une table les désigne ensuite.
function creerTablesManquantes(charge, forme, saisie) {
  const sieges = entierSaisi(saisie);
  if (sieges < PLACES_TABLE.min) throw refus('MOINS_DE_DEUX');
  if (sieges > PLACES_TABLE.max) throw refus('TROP_DE_PLACES', { max: PLACES_TABLE.max });
  const bilan = bilanTablesManquantes(charge, sieges);
  if (bilan.tables === 0) throw refus('PLACES_SUFFISANTES', { places: bilan.places, presentes: bilan.presentes });
  if (charge.prochainsIds.table + bilan.tables - 1 >= IDENTIFIANT_MAX) throw refus('COMPTEUR_SATURE', { compteur: 'table' });
  const suivante = copieDeTravail(charge);
  const dansLeRetenu = retenuLisible(suivante);
  const surcharge = sieges === charge.evenement.siegesParDefaut ? null : sieges;
  const premierId = suivante.prochainsIds.table;
  const numeros = Array.from({ length: bilan.tables }, () => poserTable(suivante, forme, surcharge, dansLeRetenu));
  const { affectations, restantes } = repartitionALaCreation(charge, bilan.tables, sieges);
  const designees = designerALaCreation(
    suivante,
    affectations.map(({ participant, rang }) => ({ participant, table: premierId + rang })),
  );
  const seuil = constante(SEUIL_LISIBLE.nom);
  const avertissements = sieges > seuil ? [{ code: 'AU_DELA_LISIBLE', details: { seuil } }] : [];
  avertissements.push(...designees.avertissements);
  if (restantes.length > 0) {
    const personneDe = new Map(charge.participants.map((personne) => [personne.id, personne]));
    const personnes = restantes.map(({ participant, ...cause }) => ({ participant, personne: nomAffiche(personneDe.get(participant)), ...cause }));
    avertissements.push({ code: 'ANIMATEURS_A_DESIGNER', details: { personnes } });
  }
  return {
    charge: designees.charge,
    libelle: libelle('ENTREE_CREER_TABLES', { premier: numeros[0], dernier: numeros.at(-1), sieges, animateurs: affectations.length }),
    avertissements,
  };
}

/**
 * creerTable {forme, combler?} (§ 4, § 6.1) : sans combler, une table qui
 * suit le défaut, d'identifiant prochainsIds.table, numérotée après la plus
 * grande, posée sur la première case libre (caseLibre) de la grille des
 * démonstrations, au pas que donnent les tables posées, chacune à sa
 * capacité, et la nouvelle. Sous un retenu lisible, elle y entre avec sa
 * capacité et une liste vide à chaque tour ; elle ne reçoit aucun animateur.
 * Avec combler, les places par table saisies, les tables qui comblent le
 * manque et les animateurs à désigner qu'elles reçoivent
 * (creerTablesManquantes).
 */
function creerTable(charge, { forme, combler } = {}) {
  exigerModifiable(charge);
  if (!FORMES.has(forme)) throw new TypeError(`forme : 'ronde' ou 'carree' attendue, reçu ${JSON.stringify(forme)}`);
  if (combler !== undefined) return creerTablesManquantes(charge, forme, combler);
  if (charge.prochainsIds.table >= IDENTIFIANT_MAX) throw refus('COMPTEUR_SATURE', { compteur: 'table' });
  const suivante = copieDeTravail(charge);
  const numero = poserTable(suivante, forme, null, retenuLisible(suivante));
  return { charge: suivante, libelle: libelle('ENTREE_CREER_TABLE', { numero }), avertissements: [] };
}

/**
 * supprimerTable {id} (§ 6.2, § 9) : la table part, et avec elle, dans la
 * même entrée, ses réservations — suspendues comprises —, ses titres et ses
 * objectifs, qu'elle porte ; les autres tables gardent leur numéro,
 * propositions et retenu restent, en dérive TABLE_SUPPRIMEE.
 */
function supprimerTable(charge, { id } = {}) {
  exigerModifiable(charge);
  const table = tableDe(charge, id);
  const suivante = copieDeTravail(charge);
  suivante.tables = suivante.tables.filter((candidate) => candidate.id !== id);
  suivante.reservations = suivante.reservations.filter((reservation) => reservation.table !== id);
  suivante.titres = suivante.titres.filter((titre) => titre.table !== id);
  const details = {
    numero: table.numero,
    reservations: charge.reservations.length - suivante.reservations.length,
    titres: charge.titres.length - suivante.titres.length,
    objectifs: table.objectifs?.length ?? 0,
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
  const suivante = copieDeTravail(charge);
  // + 0 écrit 0 là où l'arrondi d'une petite valeur négative rend −0.
  suivante.tables.find((candidate) => candidate.id === id).position = { x: Math.round(position.x) + 0, y: Math.round(position.y) + 0 };
  return { charge: suivante, libelle: libelle('ENTREE_DEPLACER_TABLE', { numero: table.numero }), avertissements: [] };
}

/**
 * changerLibelleTable {id, libelle} (§ 4, § 8.9) : le libellé saisi entre
 * en NFC, ses blancs de bord retirés, chaque moitié de paire de substitution
 * isolée remplacée par le caractère de remplacement ; vide, il retire le
 * champ. Au-delà de LIBELLE_TABLE_MAX points de code, comptés sur le texte
 * entré : LIBELLE_TABLE_TROP_LONG {longueur, maximum}, remède nul — la
 * saisie se corrige dans son champ. Le moteur ne lit pas le libellé :
 * propositions et retenu restent tels quels, sans dérive. Le même libellé,
 * ou un retrait sans libellé, ne change rien : l'exécution le refuse,
 * SANS_EFFET.
 */
function changerLibelleTable(charge, { id, libelle: saisie } = {}) {
  exigerModifiable(charge);
  const table = tableDe(charge, id);
  if (typeof saisie !== 'string') throw new TypeError(`libelle : chaîne attendue, reçu ${JSON.stringify(saisie)}`);
  const texte = saisie.toWellFormed().normalize('NFC').trim();
  const longueur = [...texte].length;
  if (longueur > LIBELLE_TABLE_MAX) throw refus('LIBELLE_TABLE_TROP_LONG', { longueur, maximum: LIBELLE_TABLE_MAX });
  const suivante = copieDeTravail(charge);
  const libellee = suivante.tables.find((candidate) => candidate.id === id);
  if (texte === '') delete libellee.libelle;
  else libellee.libelle = texte;
  return {
    charge: suivante,
    libelle: libelle('ENTREE_CHANGER_LIBELLE_TABLE', { numero: table.numero, libelle: texte === '' ? null : texte }),
    avertissements: [],
  };
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

// PRESENCE_TOURS_AJOUTES des non-exclues dont la présence nomme ses tours,
// par identifiant croissant, quand il y en a.
function presencesNonEtendues(charge, nommees) {
  const ids = charge.participants
    .filter(({ exclu, presence }) => !exclu && presence !== undefined)
    .map(({ id }) => id)
    .sort((a, b) => a - b);
  return ids.length > 0 ? [{ code: 'PRESENCE_TOURS_AJOUTES', details: { personnes: nommees(ids) } }] : [];
}

/**
 * changerTours {tours} (§ 2.1 étape 5, § 4.3, § 4.5) : le nombre de tours,
 * lu par lireEntier ; MOINS_D_UN_TOUR {tours} sous 1, TROP_DE_TOURS {max}
 * au-delà de TOURS_MAX, la borne que l'analyse pose aussi, remède null.
 * Retirer des tours détruit, dans la même entrée, les réservations « tour
 * désigné » et les objectifs de table de ces tours, que le libellé compte ;
 * une table qui n'en garde aucun perd son champ objectifs. La portée
 * « tous » reste, symbolique, et l'objectif de la soirée aussi. Remettre le
 * tour ne rend rien de ce qui est détruit. Propositions et retenu restent,
 * en dérive TOURS_CHANGES, jamais tronqués.
 *
 * La présence de chacun suit (presencesSousTours) : à la baisse, chaque
 * présence se rogne aux tours qui restent, canonique, exclues comprises, et
 * le libellé compte celles qui changent. Une non-exclue qui ne serait plus
 * présente à aucun tour refuse le geste, PRESENCE_VIDEE_PAR_TOURS
 * {participants: [{participant, personne}], tours}, remède la section des
 * participants : personne n'est exclu en silence. Une exclue dans ce cas
 * perd son champ, sans refus, et réintégrée elle vient à tous les tours. À
 * la hausse, une présence qui nomme ses tours ne s'étend pas :
 * PRESENCE_TOURS_AJOUTES {personnes: [{participant, personne}]} nomme les
 * non-exclues qui en portent une. Le masque de présence des tours qui
 * restent ne change pour personne : le retenu n'a rien à suivre.
 */
function changerTours(charge, { tours: saisie } = {}) {
  exigerModifiable(charge);
  const tours = entierSaisi(saisie);
  if (tours < 1) throw refus('MOINS_D_UN_TOUR', { tours });
  if (tours > TOURS_MAX) throw refus('TROP_DE_TOURS', { max: TOURS_MAX });
  const personneDe = new Map(charge.participants.map((personne) => [personne.id, personne]));
  const nommees = (ids) => ids.map((id) => ({ participant: id, personne: nomAffiche(personneDe.get(id)) }));
  const { participants, rognees, videes } = presencesSousTours(charge.participants, tours);
  if (videes.length > 0) {
    throw refus('PRESENCE_VIDEE_PAR_TOURS', { participants: nommees(videes), tours }, { geste: 'ouvrirSection', section: 'participants' });
  }
  const suivante = copieDeTravail(charge);
  suivante.evenement.tours = tours;
  suivante.participants = structuredClone(participants);
  suivante.reservations = suivante.reservations.filter(({ portee, tour }) => portee === 'tous' || tour <= tours);
  let objectifsRetires = 0;
  for (const table of suivante.tables) {
    if (table.objectifs === undefined) continue;
    const gardes = table.objectifs.filter(({ portee, tour }) => portee === 'tous' || tour <= tours);
    objectifsRetires += table.objectifs.length - gardes.length;
    if (gardes.length > 0) table.objectifs = gardes;
    else delete table.objectifs;
  }
  return {
    charge: suivante,
    libelle: libelle('ENTREE_CHANGER_TOURS', {
      tours,
      retirees: charge.reservations.length - suivante.reservations.length,
      objectifsRetires,
      presencesRognees: rognees.length,
    }),
    avertissements: tours > charge.evenement.tours ? presencesNonEtendues(charge, nommees) : [],
  };
}

/**
 * modifierReglage {cle, valeur} (§ 5.3, § 8.9, § 15.4) : un interrupteur des
 * contraintes ou de l'attribution des sièges, un booléen ; l'une des deux
 * cases facultatives, respecterObjectifs ou rencontrerAnimateurs, un
 * booléen écrit seulement hors de son défaut — y revenir retire le champ, et
 * la valeur courante est SANS_EFFET ; le mode des objectifs, modeObjectifs,
 * l'un de MODES_OBJECTIFS (changerModeObjectifs) ; ou generation.nombre,
 * generation.arret, generation.historique, un entier ≥ 1, que le contrôleur
 * de génération a lu et borné. Une autre clé, ou une autre valeur, est une
 * faute du code.
 */
function modifierReglage(charge, { cle, valeur } = {}) {
  exigerModifiable(charge);
  const suivante = copieDeTravail(charge);
  if (INTERRUPTEURS.has(cle)) {
    if (typeof valeur !== 'boolean') throw new TypeError(`${cle} : booléen attendu, reçu ${JSON.stringify(valeur)}`);
    suivante.reglages[cle] = valeur;
  } else if (CASES_FACULTATIVES.has(cle)) {
    if (typeof valeur !== 'boolean') throw new TypeError(`${cle} : booléen attendu, reçu ${JSON.stringify(valeur)}`);
    if (valeur === critereCoche(charge, cle)) throw refus('SANS_EFFET', { commande: 'modifierReglage' });
    if (valeur === CASES_FACULTATIVES.get(cle)) delete suivante.reglages[cle];
    else suivante.reglages[cle] = valeur;
  } else if (cle === 'modeObjectifs') {
    changerModeObjectifs(charge, suivante, valeur);
  } else if (ENTIERS_DE_GENERATION.has(cle)) {
    if (!Number.isSafeInteger(valeur) || valeur < 1) throw new TypeError(`${cle} : entier ≥ 1 attendu, reçu ${JSON.stringify(valeur)}`);
    suivante.reglages.generation[cle.slice('generation.'.length)] = valeur;
  } else {
    throw new TypeError(`réglage inconnu : ${JSON.stringify(cle)}`);
  }
  return { charge: suivante, libelle: libelle('ENTREE_MODIFIER_REGLAGE', { cle, valeur }), avertissements: [] };
}

// L'enregistrement de la table d'identifiant id qu'un objectif vise, ou
// TABLE_DISPARUE {table}, remède null : aucun geste ne rend une table
// supprimée.
function tableDeLObjectif(charge, id) {
  const table = charge.tables.find((candidate) => candidate.id === id);
  if (table === undefined) throw refus('TABLE_DISPARUE', { table: id });
  return table;
}

// Le tour d'un objectif, null pour la soirée ou un entier ; une autre valeur
// est une faute du code. Un entier hors de 1 à R est OBJECTIF_HORS_SOIREE
// {tour}, remède null : le tour se choisit parmi ceux de la soirée.
function tourDeLObjectif(charge, tour) {
  if (tour !== null && !Number.isSafeInteger(tour)) {
    throw new TypeError(`tour : null ou entier attendu, reçu ${JSON.stringify(tour)}`);
  }
  if (tour !== null && (tour < 1 || tour > charge.evenement.tours)) throw refus('OBJECTIF_HORS_SOIREE', { tour });
  return tour;
}

// La charge reçue, copiée, la table id portant les objectifs que rend
// modifier de sa liste — sans eux, le champ retiré —, rangés la soirée
// d'abord, puis les tours croissants (§ 8.9).
function avecObjectifs(charge, id, modifier) {
  const suivante = copieDeTravail(charge);
  const table = suivante.tables.find((candidate) => candidate.id === id);
  const objectifs = modifier(table.objectifs ?? []).sort(ordreDesObjectifs);
  if (objectifs.length > 0) table.objectifs = objectifs;
  else delete table.objectifs;
  return suivante;
}

// Deux listes d'étiquettes portent le même ensemble.
const memesEtiquettes = (a, b) => a.length === b.length && a.every((motCle) => b.includes(motCle));

/**
 * poserObjectif {table, tour, etiquettes, regle} (§ 4.5, § 5.9) : l'objectif
 * de la table d'identifiant table pour la soirée (tour null) ou pour le tour
 * donné, qui remplace celui du même couple. etiquettes est une saisie, reçue
 * (recevoirEtiquettes) sur les étiquettes de l'événement entier sans
 * l'objectif remplacé ; regle, 'ou' ou 'et' pour une règle propre, null pour
 * suivre le défaut. Le même objectif — même règle, même ensemble
 * d'étiquettes — est SANS_EFFET. Refus : TABLE_DISPARUE {table} ;
 * OBJECTIF_HORS_SOIREE {tour} ; ETIQUETTE_INVALIDE {valeur, raison} ;
 * OBJECTIF_SANS_ETIQUETTE {table, tour}, une saisie qui ne donne aucune
 * étiquette, de remède « Retirer l'objectif » quand le couple en porte un —
 * vider la liste, c'est le retirer —, null sinon ; ETIQUETTES_EN_TROP
 * {nombre} au-delà d'ETIQUETTES_MAX. Avertissements : ORTHOGRAPHE_RETENUE,
 * puis les avis de l'objectif posé (avisDeLObjectif), acceptés et signalés.
 */
function poserObjectif(charge, { table: id, tour: saisi, etiquettes: texte, regle } = {}) {
  exigerModifiable(charge);
  if (regle !== null && !REGLES.has(regle)) throw new TypeError(`regle : 'ou', 'et' ou null attendu, reçu ${JSON.stringify(regle)}`);
  const table = tableDeLObjectif(charge, id);
  const tour = tourDeLObjectif(charge, saisi);
  const ancien = (table.objectifs ?? []).find((objectif) => objectif.tour === tour);
  const sansLui = avecObjectifs(charge, id, (objectifs) => objectifs.filter((objectif) => objectif.tour !== tour));
  const recues = recevoirEtiquettes(etiquettesDeLEvenement(sansLui), texte);
  if (recues.etiquettes.length === 0) {
    const remede = ancien === undefined ? null : { commande: 'retirerObjectif', arguments: { table: id, tour } };
    throw refus('OBJECTIF_SANS_ETIQUETTE', { table: id, tour }, remede);
  }
  if (recues.etiquettes.length > ETIQUETTES_MAX) throw refus('ETIQUETTES_EN_TROP', { nombre: recues.etiquettes.length });
  if (ancien !== undefined && ancien.regle === regle && memesEtiquettes(ancien.etiquettes, recues.etiquettes)) {
    throw refus('SANS_EFFET', { commande: 'poserObjectif' });
  }
  const objectif = { portee: tour === null ? 'tous' : 'tour', tour, regle, etiquettes: recues.etiquettes };
  const suivante = avecObjectifs(sansLui, id, (objectifs) => [...objectifs, objectif]);
  return {
    charge: suivante,
    libelle: libelle('ENTREE_POSER_OBJECTIF', { numero: table.numero, tour, regle, etiquettes: recues.etiquettes }),
    avertissements: [...recues.avertissements, ...avisDeLObjectif(suivante, id, tour)],
  };
}

/**
 * retirerObjectif {table, tour} (§ 4.5, D19) : l'objectif de la soirée (tour
 * null) ou du tour donné part, sans fenêtre à confirmer : un retour à
 * l'instant précédent le rend. Le dernier retiré retire le champ objectifs.
 * Un couple sans objectif est SANS_EFFET ; TABLE_DISPARUE {table} pour une
 * table supprimée.
 */
function retirerObjectif(charge, { table: id, tour } = {}) {
  exigerModifiable(charge);
  if (tour !== null && !Number.isSafeInteger(tour)) throw new TypeError(`tour : null ou entier attendu, reçu ${JSON.stringify(tour)}`);
  const table = tableDeLObjectif(charge, id);
  if (!(table.objectifs ?? []).some((objectif) => objectif.tour === tour)) throw refus('SANS_EFFET', { commande: 'retirerObjectif' });
  return {
    charge: avecObjectifs(charge, id, (objectifs) => objectifs.filter((objectif) => objectif.tour !== tour)),
    libelle: libelle('ENTREE_RETIRER_OBJECTIF', { numero: table.numero, tour }),
    avertissements: [],
  };
}

// Un avis rendu comparable : son code et ses détails, en texte.
const cleDAvis = ({ code, details }) => JSON.stringify([code, details]);

/**
 * changerRegleObjectifs {regle} (§ 4.5, § 8.9, D3) : la règle par défaut des
 * objectifs, 'ou' ou 'et' ; le défaut, que regleObjectifs lit sur des
 * réglages qui ne la portent pas, retire le champ des réglages, et la règle
 * courante (regleObjectifs) est SANS_EFFET. Aucune règle propre ne change.
 * Avertissements : les avis que le changement fait naître (avisObjectifs),
 * ceux d'un objectif qui suit le défaut et ne sert plus personne.
 */
function changerRegleObjectifs(charge, { regle } = {}) {
  exigerModifiable(charge);
  if (!REGLES.has(regle)) throw new TypeError(`regle : 'ou' ou 'et' attendu, reçu ${JSON.stringify(regle)}`);
  if (regle === regleObjectifs(charge)) throw refus('SANS_EFFET', { commande: 'changerRegleObjectifs' });
  const suivante = copieDeTravail(charge);
  if (regle === regleObjectifs({ reglages: {} })) delete suivante.reglages.regleObjectifs;
  else suivante.reglages.regleObjectifs = regle;
  const connus = new Set(avisObjectifs(charge).map(cleDAvis));
  return {
    charge: suivante,
    libelle: libelle('ENTREE_CHANGER_REGLE_OBJECTIFS', { regle }),
    avertissements: avisObjectifs(suivante).filter((avis) => !connus.has(cleDAvis(avis))),
  };
}

// --- L'ordre des priorités et le mode des objectifs (§ 5.3, § 5.7, § 5.9) ---

// La liste que reçoit changerPriorites, contrôlée dans sa forme : une liste
// de paliers, chacun une liste d'entrées {critere, poids}, critere une
// chaîne, poids un nombre. Une autre forme est une faute du code, que
// l'éditeur n'offre jamais : TypeError. Rend une copie, chaque entrée réduite
// à ces deux clés, dans l'ordre reçu.
function lirePaliers(paliers) {
  const faute = (attendu) => new TypeError(`paliers : ${attendu}, reçu ${JSON.stringify(paliers)}`);
  if (!Array.isArray(paliers)) throw faute('une liste de paliers attendue');
  return paliers.map((palier) => {
    if (!Array.isArray(palier)) throw faute('chaque palier, une liste');
    return palier.map((entree) => {
      const forme =
        typeof entree === 'object' &&
        entree !== null &&
        !Array.isArray(entree) &&
        typeof entree.critere === 'string' &&
        typeof entree.poids === 'number';
      if (!forme) throw faute('chaque entrée, {critere: chaîne, poids: nombre}');
      return { critere: entree.critere, poids: entree.poids };
    });
  });
}

/** Le plus grand poids d'un critère (§ 5.7), celui du moteur : l'écran en
 *  borne le champ du poids, que changerPriorites contrôle. */
export { POIDS_MAX };

// Vrai pour un poids du domaine : un entier de 1 à POIDS_MAX (§ 5.7).
const poidsAdmis = (poids) => Number.isInteger(poids) && poids >= 1 && poids <= POIDS_MAX;

// Le rang d'un critère dans le registre ; −1 pour un nom inconnu, que
// verifierPriorites relève ensuite.
const rangDuCritere = (nom) => CRITERES.indexOf(nom);

// Une liste de priorités rangée : les critères de chaque palier dans l'ordre
// du registre (A16), et le poids d'un critère seul à son palier ramené à 1.
// Seul, un poids multiplie la seule valeur de son palier et ne départage
// rien : deux listes de même effet s'écrivent pareil, et un mode sous lequel
// le critère compare deux valeurs, qui ne le pondère pas (D8), l'admet. Rend
// une liste neuve.
function rangerPaliers(liste) {
  return liste.map((palier) => {
    const range = [...palier].sort((a, b) => rangDuCritere(a.critere) - rangDuCritere(b.critere));
    return range.length === 1 ? [{ critere: range[0].critere, poids: 1 }] : range.map(({ critere, poids }) => ({ critere, poids }));
  });
}

// Deux listes rangées identiques, palier par palier, entrée par entrée.
const memesPriorites = (a, b) =>
  a.length === b.length &&
  a.every((palier, i) => palier.length === b[i].length && palier.every(({ critere, poids }, k) => critere === b[i][k].critere && poids === b[i][k].poids));

// L'ordre par défaut, rangé : celui que lit priorites sur des réglages qui
// ne portent pas le champ.
const PAR_DEFAUT = rangerPaliers(priorites({ reglages: {} }));

// La place de chaque critère d'une liste rangée : l'index de son palier,
// ses compagnons de palier et son poids.
function placesDes(liste) {
  const places = new Map();
  liste.forEach((palier, index) => {
    for (const { critere, poids } of palier) {
      const compagnons = palier.map((autre) => autre.critere).filter((autre) => autre !== critere);
      places.set(critere, { index, compagnons, poids });
    }
  });
  return places;
}

// Les détails du libellé figé de changerPriorites : le critère que le geste
// déplace, ou les critères du palier déplacé entier, l'index du palier où il
// arrive, le nombre de paliers, ses compagnons d'arrivée, et son poids quand
// le geste ne change que lui. avant et apres sont deux listes rangées
// différentes ; les candidats se lisent dans l'ordre d'apres.
// - Joindre, séparer : parmi les critères dont les compagnons changent,
//   celui qui en gagne ou en perd le plus — le critère joint ou séparé, et
//   non ceux du palier qu'il quitte ou rejoint, qui n'en gagnent ou n'en
//   perdent qu'un — ; à égalité, celui dont le palier change d'index.
// - Déplacer un palier sans rien regrouper : celui qui va le plus loin ; à
//   égalité, celui qui monte — monter d'un palier passe le palier voisin,
//   qui descend d'autant.
// - Rien d'autre : le critère dont le poids change.
function changementDesPriorites(avant, apres) {
  const ancienne = placesDes(avant);
  const nouvelle = placesDes(apres);
  const noms = apres.flat().map(({ critere }) => critere);
  const ecartDIndex = (nom) => nouvelle.get(nom).index - ancienne.get(nom).index;
  const paliers = apres.length;
  const changes = (nom) => {
    const [gardes, prises] = [ancienne.get(nom).compagnons, nouvelle.get(nom).compagnons];
    return gardes.filter((autre) => !prises.includes(autre)).length + prises.filter((autre) => !gardes.includes(autre)).length;
  };
  const regroupes = noms.filter((nom) => changes(nom) > 0);
  if (regroupes.length > 0) {
    const plus = Math.max(...regroupes.map(changes));
    const candidats = regroupes.filter((nom) => changes(nom) === plus);
    const nom = candidats.find((candidat) => ecartDIndex(candidat) !== 0) ?? candidats[0];
    const { index, compagnons } = nouvelle.get(nom);
    return { criteres: [nom], palier: index, paliers, avec: compagnons, poids: null };
  }
  const deplaces = noms.filter((nom) => ecartDIndex(nom) !== 0);
  if (deplaces.length > 0) {
    const loin = Math.max(...deplaces.map((nom) => Math.abs(ecartDIndex(nom))));
    const candidats = deplaces.filter((nom) => Math.abs(ecartDIndex(nom)) === loin);
    const { index } = nouvelle.get(candidats.find((nom) => ecartDIndex(nom) < 0) ?? candidats[0]);
    return { criteres: apres[index].map(({ critere }) => critere), palier: index, paliers, avec: [], poids: null };
  }
  const nom = noms.find((candidat) => nouvelle.get(candidat).poids !== ancienne.get(candidat).poids);
  const { index, poids } = nouvelle.get(nom);
  return { criteres: [nom], palier: index, paliers, avec: [], poids };
}

/**
 * changerPriorites {paliers} (§ 5.7, § 5.9, A11, A12) : l'ordre des
 * priorités de l'événement, une liste complète de paliers, chacun une liste
 * d'entrées {critere, poids}. Elle s'écrit rangée (rangerPaliers) ; égale à
 * l'ordre par défaut, elle retire le champ des réglages. Une liste dont
 * l'effet égale l'ordre courant (priorites) est SANS_EFFET. Refus, remède
 * null, dans cet ordre : POIDS_HORS_DOMAINE {valeur}, le premier poids qui
 * n'est pas un entier de 1 à POIDS_MAX ; PRIORITES_INVALIDES {faute,
 * critere?, palier?}, la faute que verifierPriorites relève sous le mode des
 * objectifs de l'événement — palier, l'index du palier à partir de 0. Une
 * liste de forme fausse est une faute du code (lirePaliers). Le libellé
 * figé nomme le critère déplacé et son palier (changementDesPriorites).
 */
function changerPriorites(charge, { paliers } = {}) {
  exigerModifiable(charge);
  const recue = lirePaliers(paliers);
  const horsDomaine = recue.flat().find(({ poids }) => !poidsAdmis(poids));
  if (horsDomaine !== undefined) throw refus('POIDS_HORS_DOMAINE', { valeur: horsDomaine.poids });
  const liste = rangerPaliers(recue);
  const faute = verifierPriorites(liste, modeObjectifs(charge));
  if (faute !== null) throw refus('PRIORITES_INVALIDES', faute);
  const courante = rangerPaliers(priorites(charge));
  if (memesPriorites(liste, courante)) throw refus('SANS_EFFET', { commande: 'changerPriorites' });
  const suivante = copieDeTravail(charge);
  if (memesPriorites(liste, PAR_DEFAUT)) delete suivante.reglages.priorites;
  else suivante.reglages.priorites = liste;
  return {
    charge: suivante,
    libelle: libelle('ENTREE_CHANGER_PRIORITES', changementDesPriorites(courante, liste)),
    avertissements: [],
  };
}

/**
 * retablirPriorites {} (§ 5.7, D19) : l'ordre par défaut, sans fenêtre à
 * confirmer — un retour à l'instant précédent rend l'ordre réglé. Le champ
 * des réglages part ; sans lui, SANS_EFFET.
 */
function retablirPriorites(charge) {
  exigerModifiable(charge);
  if (charge.reglages.priorites === undefined) throw refus('SANS_EFFET', { commande: 'retablirPriorites' });
  const suivante = copieDeTravail(charge);
  delete suivante.reglages.priorites;
  return { charge: suivante, libelle: libelle('ENTREE_RETABLIR_PRIORITES'), avertissements: [] };
}

// modifierReglage {cle: 'modeObjectifs', valeur} (§ 5.3, § 8.9, A12, D23),
// sur suivante, la copie de charge : valeur, l'un de MODES_OBJECTIFS, sinon
// TypeError ; le mode courant est SANS_EFFET ; le défaut retire le champ.
// Un mode sous lequel un critère se range seul à son palier — les tours hors
// objectif sous les modes qui comparent deux valeurs — se refuse tant que ce
// critère partage le sien : OBJECTIFS_PALIER_PARTAGE {mode, palier}, palier
// à partir de 0, remède null, le mode inchangé. Séparer d'office déplacerait
// des critères que le choix ne nomme pas : aucun critère ne se déplace. Un
// ordre écrit se réécrit rangé (rangerPaliers) : le poids d'un critère seul,
// qu'un fichier écrit ailleurs peut porter, revient à 1, et l'ordre reste
// valide sous le mode choisi.
function changerModeObjectifs(charge, suivante, valeur) {
  if (!MODES_OBJECTIFS.includes(valeur)) {
    throw new TypeError(`modeObjectifs : ${MODES_OBJECTIFS.join(', ')} attendu, reçu ${JSON.stringify(valeur)}`);
  }
  if (valeur === modeObjectifs(charge)) throw refus('SANS_EFFET', { commande: 'modifierReglage' });
  const liste = rangerPaliers(priorites(charge));
  const seuls = seulsASonPalier(valeur);
  const partage = liste.findIndex((palier) => palier.length > 1 && palier.some(({ critere }) => seuls.includes(critere)));
  if (partage >= 0) throw refus('OBJECTIFS_PALIER_PARTAGE', { mode: valeur, palier: partage });
  if (valeur === MODE_PAR_DEFAUT) delete suivante.reglages.modeObjectifs;
  else suivante.reglages.modeObjectifs = valeur;
  if (charge.reglages.priorites === undefined) return;
  if (memesPriorites(liste, PAR_DEFAUT)) delete suivante.reglages.priorites;
  else suivante.reglages.priorites = liste;
}

/** @type {Map<string, (charge: Object, args: Object) => Object>} */
export const COMMANDES_MOBILIER = new Map([
  ['creerTable', creerTable],
  ['supprimerTable', supprimerTable],
  ['deplacerTable', deplacerTable],
  ['changerLibelleTable', changerLibelleTable],
  ['changerPlacesTable', changerPlacesTable],
  ['realignerTable', realignerTable],
  ['changerDefaut', changerDefaut],
  ['changerTours', changerTours],
  ['modifierReglage', modifierReglage],
  ['poserObjectif', poserObjectif],
  ['retirerObjectif', retirerObjectif],
  ['changerRegleObjectifs', changerRegleObjectifs],
  ['changerPriorites', changerPriorites],
  ['retablirPriorites', retablirPriorites],
]);
