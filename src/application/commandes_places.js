// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le registre des commandes des places — réservations, titres, désignation
// des animateurs, pose (§ 5.8, § 5.9, § 8.2), que commandes.js réunit aux
// autres. Ses imports n'atteignent jamais commandes.js : le registre réuni
// dépend de lui, non l'inverse.
//
// Chaque commande suit le contrat de commandes.js : une fonction pure
// (charge, arguments) → { charge, libelle, avertissements }, la charge reçue
// intacte ; un refus lève ErreurCommande(code, details), details.remede
// compris ; un argument de forme fausse, une table inconnue, un retenu absent
// lèvent TypeError, que l'interface n'offre jamais. Un plan bloqué refuse
// tout (PLAN_BLOQUE). Les poses se contrôlent par controlerPose (pose.js),
// qui rend tous les refus ; la commande lève le premier et porte les autres
// dans details.autres.
//
// Avant la retenue, un geste de personne pose ou déplace une réservation ;
// après, il modifie le retenu, au tour visé seulement, jamais la proposition
// d'où il vient (§ 5.8). Sièges attribués, le siège est le rang dans la
// liste, une chaise vide s'y écrit null et une liste ne finit jamais par
// null : un départ libère sa chaise, et tout autre siège reste le même
// (§ 8.9). Sans attribution, la liste reste triée par identifiant, et chaque
// geste verse d'abord en réserve les présents que le plan ne montre pas
// assis aux tables qu'il touche (reduireAuxAssises) : la liste vaut ce que
// l'affichage assied. Chaque geste lit les places comme le plan les montre
// (placeDe). Une retouche qui ajoute une violation de verifierInvariants au
// retenu reçu est refusée (INVARIANT_VIOLE) ; une violation déjà présente,
// celle d'une dérive (§ 9), ne bloque rien. Une personne absente au tour ne
// s'y assied pas, ni en réserve (PERSONNE_ABSENTE_AU_TOUR, remède sa
// présence étendue à ce tour), et une personne que le retenu ne déclare pas
// y entre en réserve à ses seuls tours de présence, absente aux autres. Les
// lieux d'une personne dans le retenu se lisent et se changent par
// retenu_lieux.js.
import { ordreDesReservations, pourvoyeursDesTitres } from '../csv/import.js';
import { capacite } from '../stockage/document.js';
import { estPresentAuTour, toursDePresence } from '../moteur/presence.js';
import { copieDeTravail } from '../stockage/gel.js';
import { fautes } from '../stockage/placements.js';
import { animateursDeLaTable, avertissementsDuLot, designations, toursDAbsence } from './animateurs.js';
import { violationsDuRetenu } from './avertissements.js';
import { ErreurCommande, refus } from './erreurs.js';
import { libelle } from './libelles.js';
import { conversionsPossibles } from './listes_travail.js';
import { nomAffiche } from './personnes.js';
import { etatPlaces, instanceDe, presents, reservationsCouvrantes } from './places.js';
import { controlerPose, leverRefus } from './pose.js';
import { enReserve, lieuDans, oter, sansNullDeFin } from './retenu_lieux.js';

const croissant = (a, b) => a - b;

// --- Les contrôles communs ---------------------------------------------------

// Un plan bloqué refuse toute modification ; débloquer seul le lève (§ 9).
function exigerModifiable(charge) {
  if (charge.evenement.etat === 'bloque') throw refus('PLAN_BLOQUE', {}, { geste: 'debloquer' });
}

// Le participant d'identifiant id, ou PARTICIPANT_INCONNU.
function personneDe(charge, id) {
  if (!Number.isSafeInteger(id)) throw new TypeError(`participant : entier attendu, reçu ${JSON.stringify(id)}`);
  const personne = charge.participants.find((candidat) => candidat.id === id);
  if (personne === undefined) throw refus('PARTICIPANT_INCONNU', { id });
  return personne;
}

// L'enregistrement de la table d'identifiant id : une table inconnue est
// une faute de l'appelant.
function tableDe(charge, id) {
  const table = charge.tables.find((candidate) => candidate.id === id);
  if (table === undefined) throw new TypeError(`table inconnue : ${JSON.stringify(id)}`);
  return table;
}

// Un siège donné : null, ou un entier ≥ 1.
function exigerSiege(siege) {
  if (siege !== null && !(Number.isSafeInteger(siege) && siege >= 1)) {
    throw new TypeError(`siege : null ou entier ≥ 1 attendu, reçu ${JSON.stringify(siege)}`);
  }
}

// Une portée et son tour : « tous » sans tour, « tour » de 1 à R.
function exigerPortee(charge, portee, tour) {
  if (portee === 'tous' && tour === null) return;
  if (portee === 'tour' && Number.isSafeInteger(tour) && tour >= 1 && tour <= charge.evenement.tours) return;
  throw new TypeError(`portée ${JSON.stringify(portee)}, tour ${JSON.stringify(tour)} : « tous » sans tour ou « tour » de 1 à R attendus`);
}

// Un texte de libellé normalisé : en NFC, ses blancs de bord retirés.
const normaliser = (valeur) => valeur.normalize('NFC').trim();

// Le libellé d'un titre saisi, normalisé ; LIBELLE_VIDE quand il ne reste
// rien.
function libelleSaisi(valeur) {
  if (typeof valeur !== 'string') throw new TypeError(`libelle : chaîne attendue, reçu ${JSON.stringify(valeur)}`);
  const texte = normaliser(valeur);
  if (texte === '') throw refus('LIBELLE_VIDE');
  return texte;
}

// Vrai quand la réservation r est celle que désigne d pour ce participant :
// sa table, sa portée, son tour.
const designee = (r, participant, d) =>
  r.participant === participant && r.table === d.table && r.portee === d.portee && r.tour === (d.portee === 'tous' ? null : d.tour);

// Le premier titre de la place dans l'ordre canonique, ou undefined.
const titreDe = (charge, idTable, siege) =>
  charge.titres
    .filter((titre) => titre.table === idTable && titre.siege === siege)
    .sort((a, b) => (a.libelle < b.libelle ? -1 : a.libelle > b.libelle ? 1 : 0))[0];

// Le remède d'une table qui manque de places : une de plus que places, par
// la saisie de son champ.
const changerPlaces = (idTable, places) => ({
  commande: 'changerPlacesTable',
  arguments: { id: idTable, sieges: places + 1, origine: 'champ' },
});

// Le plus petit siège de la table, de 1 à places, qu'aucun titre ne porte ;
// AUCUN_SIEGE_SANS_TITRE quand tous en portent un.
function siegeSansTitre(charge, idTable, places) {
  const titres = new Set(charge.titres.filter(({ table }) => table === idTable).map(({ siege }) => siege));
  for (let siege = 1; siege <= places; siege += 1) if (!titres.has(siege)) return siege;
  throw refus('AUCUN_SIEGE_SANS_TITRE', { table: idTable, capacite: places }, changerPlaces(idTable, places));
}

// SIEGE_INEXISTANT pour un titre au-delà de la capacité : un titre garde
// toujours un siège de sa table.
function exigerSiegeDeTitre(idTable, siege, places) {
  if (siege > places) {
    throw refus('SIEGE_INEXISTANT', { table: idTable, siege, capacite: places }, {
      commande: 'changerPlacesTable',
      arguments: { id: idTable, sieges: siege, origine: 'champ' },
    });
  }
}

// Les avertissements des signaux d'une pose acceptée.
const avertissementsDe = (signaux) => signaux.map(({ code, table }) => ({ code, details: { table } }));

// --- Les réservations (§ 4, § 5.9) -------------------------------------------

/**
 * reserver {participant, table, siege|null, portee: 'tous'|'tour', tour|null}
 * (§ 4, § 5.9) : une réservation de plus, contrôlée comme une pose. Sans
 * attribution des sièges, un siège au-delà de la capacité s'enregistre null :
 * la place est la table. Une réservation déjà là : SANS_EFFET.
 */
function reserver(charge, { participant, table: idTable, siege = null, portee, tour = null } = {}) {
  exigerModifiable(charge);
  const personne = personneDe(charge, participant);
  const table = tableDe(charge, idTable);
  exigerSiege(siege);
  exigerPortee(charge, portee, tour);
  const places = capacite(charge, table);
  const siegeEcrit = !charge.reglages.attribuerSieges && siege !== null && siege > places ? null : siege;
  const nouvelle = { participant, table: idTable, siege: siegeEcrit, portee, tour };
  if (charge.reservations.some((r) => ordreDesReservations(r, nouvelle) === 0)) {
    throw refus('SANS_EFFET', { commande: 'reserver' });
  }
  const { refus: refusPose, signaux } = controlerPose(charge, nouvelle);
  leverRefus(refusPose);
  const suivante = copieDeTravail(charge);
  suivante.reservations.push(nouvelle);
  return {
    charge: suivante,
    libelle: libelle('ENTREE_RESERVER', { personne: nomAffiche(personne), numero: table.numero, siege: siegeEcrit, portee, tour }),
    avertissements: avertissementsDe(signaux),
  };
}

// Les réservations du participant que désigne { table, portee, tour }, ou
// RESERVATION_ABSENTE.
function reservationsDesignees(charge, participant, designation) {
  exigerPortee(charge, designation.portee, designation.tour ?? null);
  const trouvees = charge.reservations.filter((r) => designee(r, participant, designation));
  if (trouvees.length === 0) {
    const { table, portee, tour = null } = designation;
    throw refus('RESERVATION_ABSENTE', { participant, table, portee, tour });
  }
  return trouvees;
}

/** retirerReservation {participant, table, portee, tour|null} : la réservation ainsi désignée part. */
function retirerReservation(charge, { participant, table: idTable, portee, tour = null } = {}) {
  exigerModifiable(charge);
  const personne = personneDe(charge, participant);
  const table = tableDe(charge, idTable);
  const designation = { table: idTable, portee, tour };
  reservationsDesignees(charge, participant, designation);
  const suivante = copieDeTravail(charge);
  suivante.reservations = suivante.reservations.filter((r) => !designee(r, participant, designation));
  return {
    charge: suivante,
    libelle: libelle('ENTREE_RETIRER_RESERVATION', { personne: nomAffiche(personne), numero: table.numero, portee, tour }),
    avertissements: [],
  };
}

/**
 * deplacerReservation {participant, de: {table, portee, tour|null}, vers:
 * {table, siege|null}} (§ 5.9) : la réservation désignée change de place et
 * garde sa portée ; la pose se contrôle sans elle. Elle garde son rang dans
 * la liste des réservations.
 */
function deplacerReservation(charge, { participant, de, vers } = {}) {
  exigerModifiable(charge);
  const personne = personneDe(charge, participant);
  const depart = tableDe(charge, de.table);
  const arrivee = tableDe(charge, vers.table);
  const siege = vers.siege ?? null;
  exigerSiege(siege);
  const [premiere] = reservationsDesignees(charge, participant, de).sort(ordreDesReservations);
  const places = capacite(charge, arrivee);
  const siegeEcrit = !charge.reglages.attribuerSieges && siege !== null && siege > places ? null : siege;
  const deplacee = { participant, table: vers.table, siege: siegeEcrit, portee: premiere.portee, tour: premiere.tour };
  const { refus: refusPose, signaux } = controlerPose(charge, { ...deplacee, depuis: de });
  leverRefus(refusPose);
  const suivante = copieDeTravail(charge);
  let remplacee = false;
  suivante.reservations = suivante.reservations.flatMap((r) => {
    if (!designee(r, participant, de)) return [r];
    if (remplacee) return [];
    remplacee = true;
    return [deplacee];
  });
  return {
    charge: suivante,
    libelle: libelle('ENTREE_DEPLACER_RESERVATION', {
      personne: nomAffiche(personne),
      de: depart.numero,
      vers: arrivee.numero,
      siege: siegeEcrit,
      portee: premiere.portee,
      tour: premiere.tour,
    }),
    avertissements: avertissementsDe(signaux),
  };
}

/**
 * convertirEnTous {participant, table} (§ 4.2) : les R réservations « tour »
 * de la personne à cette table deviennent une seule « tous les tours », au
 * siège qu'elles portaient toutes, sans siège sinon. CONVERSION_IMPOSSIBLE
 * hors de conversionsPossibles.
 */
function convertirEnTous(charge, { participant, table: idTable } = {}) {
  exigerModifiable(charge);
  const personne = personneDe(charge, participant);
  const table = tableDe(charge, idTable);
  if (!conversionsPossibles(charge).some((c) => c.participant === participant && c.table === idTable)) {
    throw refus('CONVERSION_IMPOSSIBLE', { participant, table: idTable });
  }
  const parTour = (r) => r.participant === participant && r.table === idTable && r.portee === 'tour';
  const sieges = new Set(charge.reservations.filter(parTour).map(({ siege }) => siege));
  const siege = sieges.size === 1 ? [...sieges][0] : null;
  const suivante = copieDeTravail(charge);
  suivante.reservations = suivante.reservations.filter((r) => !parTour(r));
  suivante.reservations.push({ participant, table: idTable, siege, portee: 'tous', tour: null });
  return {
    charge: suivante,
    libelle: libelle('ENTREE_CONVERTIR_EN_TOUS', { personne: nomAffiche(personne), numero: table.numero }),
    avertissements: [],
  };
}

// --- Les titres et la désignation (§ 4, § 4.1, § 2.1 étape 6) ---------------

/**
 * poserTitre {table, siege|null, libelle} (§ 4.1) : un titre à une place.
 * Sans siège, le plus petit qui n'en porte pas. Une place titrée refuse
 * PLACE_TITREE, remède le retrait de son titre.
 */
function poserTitre(charge, { table: idTable, siege = null, libelle: saisi } = {}) {
  exigerModifiable(charge);
  const table = tableDe(charge, idTable);
  exigerSiege(siege);
  const texte = libelleSaisi(saisi);
  const places = capacite(charge, table);
  const place = siege ?? siegeSansTitre(charge, idTable, places);
  exigerSiegeDeTitre(idTable, place, places);
  const titre = titreDe(charge, idTable, place);
  if (titre !== undefined) {
    throw refus('PLACE_TITREE', { table: idTable, siege: place, libelle: titre.libelle }, {
      commande: 'retirerTitre',
      arguments: { table: idTable, siege: place },
    });
  }
  const suivante = copieDeTravail(charge);
  suivante.titres.push({ table: idTable, siege: place, libelle: texte });
  return {
    charge: suivante,
    libelle: libelle('ENTREE_POSER_TITRE', { libelle: texte, numero: table.numero, siege: place }),
    avertissements: [],
  };
}

/** retirerTitre {table, siege} : le premier titre de la place part ; TITRE_ABSENT sans lui. */
function retirerTitre(charge, { table: idTable, siege } = {}) {
  exigerModifiable(charge);
  const table = tableDe(charge, idTable);
  const titre = titreDe(charge, idTable, siege);
  if (titre === undefined) throw refus('TITRE_ABSENT', { table: idTable, siege });
  const suivante = copieDeTravail(charge);
  const rang = charge.titres.indexOf(titre);
  suivante.titres.splice(rang, 1);
  return {
    charge: suivante,
    libelle: libelle('ENTREE_RETIRER_TITRE', { libelle: titre.libelle, numero: table.numero, siege }),
    avertissements: [],
  };
}

/**
 * designer {participant, table, siege|null, libelle} (§ 2.1 étape 6, § 5.8) :
 * une réservation « tous les tours » et un titre au même siège, en une
 * entrée. Sans siège, la place du premier titre de la table que rien ne
 * pourvoit pour la soirée, sinon le plus petit siège sans titre. Un titre
 * déjà posé à cette place est pourvu, et aucun second ne s'ajoute.
 */
function designer(charge, { participant, table: idTable, siege = null, libelle: saisi } = {}) {
  exigerModifiable(charge);
  const personne = personneDe(charge, participant);
  const table = tableDe(charge, idTable);
  exigerSiege(siege);
  const texte = libelleSaisi(saisi);
  const places = capacite(charge, table);
  let place = siege;
  if (place === null) {
    const pourvoyeurs = pourvoyeursDesTitres(charge);
    const libres = charge.titres
      .map((titre, rang) => ({ titre, rang }))
      .filter(({ titre, rang }) => titre.table === idTable && pourvoyeurs[rang].soiree === null)
      .sort((a, b) => a.titre.siege - b.titre.siege);
    place = libres.length > 0 ? libres[0].titre.siege : siegeSansTitre(charge, idTable, places);
  }
  exigerSiegeDeTitre(idTable, place, places);
  const reservation = { participant, table: idTable, siege: place, portee: 'tous', tour: null };
  const titre = titreDe(charge, idTable, place);
  const dejaReservee = charge.reservations.some((r) => ordreDesReservations(r, reservation) === 0);
  if (dejaReservee && titre !== undefined) throw refus('SANS_EFFET', { commande: 'designer' });
  const { refus: refusPose, signaux } = controlerPose(charge, reservation);
  leverRefus(refusPose);
  const suivante = copieDeTravail(charge);
  if (!dejaReservee) suivante.reservations.push(reservation);
  if (titre === undefined) suivante.titres.push({ table: idTable, siege: place, libelle: texte });
  return {
    charge: suivante,
    libelle: libelle('ENTREE_DESIGNER', {
      personne: nomAffiche(personne),
      numero: table.numero,
      siege: place,
      libelle: titre?.libelle ?? texte,
    }),
    avertissements: avertissementsDe(signaux),
  };
}

// --- Les animateurs d'une table (§ 2.1 étape 6, § 5.8) ----------------------

// La liste des participants d'un lot : une liste non vide d'identifiants
// distincts ; toute autre forme est une faute de l'appelant.
function exigerLot(participants) {
  if (!Array.isArray(participants) || participants.length === 0) {
    throw new TypeError(`participants : liste non vide attendue, reçu ${JSON.stringify(participants)}`);
  }
  if (new Set(participants).size !== participants.length) {
    throw new TypeError(`participants : identifiants distincts attendus, reçu ${JSON.stringify(participants)}`);
  }
}

// Le siège où designerAnimateurs désigne la personne d'identifiant
// participant : d'abord un siège sans titre que la personne tient déjà à
// cette table, le plus petit, pour qu'elle reçoive le titre de sa propre
// place ; sinon le plus petit siège de la table, de 1 à places, qu'aucun
// titre ne porte et qu'aucune réservation d'une autre personne ne tient. Une
// réservation tient son siège à un tour qu'elle couvre et où sa personne,
// non exclue, est présente (reservationsCouvrantes) : une réservation
// suspendue n'écarte rien. Chaque personne reçoit ainsi son propre titre à
// une place libre, et un titre posé avant elle reste tel quel. null quand
// aucun siège n'est à la fois sans titre et libre : designer choisit alors
// par sa propre règle.
function siegeDuLot(charge, idTable, places, participant) {
  const titres = new Set(charge.titres.filter(({ table }) => table === idTable).map(({ siege }) => siege));
  const admis = (siege) => siege !== null && siege >= 1 && siege <= places && !titres.has(siege);
  const siens = charge.reservations
    .filter((r) => r.table === idTable && r.participant === participant && admis(r.siege))
    .map(({ siege }) => siege)
    .sort((a, b) => a - b);
  if (siens.length > 0) return siens[0];
  const tenus = new Set();
  for (let tour = 1; tour <= charge.evenement.tours; tour += 1) {
    for (const r of reservationsCouvrantes(charge, tour)) {
      if (r.table === idTable && r.siege !== null && r.participant !== participant) tenus.add(r.siege);
    }
  }
  for (let siege = 1; siege <= places; siege += 1) if (admis(siege) && !tenus.has(siege)) return siege;
  return null;
}

// Le libellé que designerAnimateurs donne au titre de la personne : son
// titre pressenti, normalisé comme un libellé saisi, quand il ne se réduit
// pas à des blancs ; sinon texte, le libellé reçu du lot.
function titreDuLot(personne, texte) {
  const pressenti = normaliser(personne.titrePressenti ?? '');
  return pressenti === '' ? texte : pressenti;
}

// ANIMATEUR_REFUSE pour la personne, sa cause {code, details} et le remède
// de la cause, qui devient celui du lot.
const animateurRefuse = (personne, cause, remede) =>
  refus('ANIMATEUR_REFUSE', { participant: personne.id, personne: nomAffiche(personne), refus: cause }, remede);

/**
 * designerAnimateurs {table, participants: [id…], libelle} (§ 2.1 étape 6,
 * § 5.8) : designer pour chaque personne dans l'ordre reçu, chacune sur la
 * charge que la précédente laisse, en une entrée qui les nomme. Chaque
 * personne dont le titre pressenti ne se réduit pas à des blancs reçoit le
 * sien ; le libellé reçu sert aux autres (titreDuLot). Une personne qui
 * anime déjà cette table (animateursDeLaTable) est passée, absente à un tour
 * comprise quand sa désignation suspendue l'y garde ; quand toutes l'animent
 * déjà, SANS_EFFET.
 *
 * Le siège de chaque personne est celui que rend siegeDuLot — un siège sans
 * titre qu'elle tient déjà à la table, sinon le plus petit siège sans titre
 * qu'aucune réservation active d'une autre personne ne tient : elle y reçoit
 * une réservation « tous les tours » et son propre titre, un titre non pourvu
 * posé avant le lot reste non pourvu, à sa place, et une place réservée à la
 * main ne fait pas refuser le lot PLACE_RESERVEE tant qu'un siège reste
 * libre. Quand aucun siège n'est à la fois sans titre et libre, designer
 * choisit sans siège, par sa règle : il pourvoit le premier titre non pourvu
 * de la table, et ce titre est alors celui que retirerAnimateur retire.
 *
 * Refus, dans cet ordre : PLAN_BLOQUE ; LIBELLE_VIDE ; PARTICIPANT_INCONNU ;
 * puis, avant toute désignation, la première personne non exclue du lot qui
 * n'est pas présente à chaque tour : ANIMATEUR_REFUSE qui la nomme, cause
 * ABSENT_AU_TOUR {participant, personne, tour}, tour son premier tour
 * d'absence, remède sa présence étendue à tous les tours ; sa réservation
 * « tous les tours » ne pourvoirait aucun titre pour la soirée. Puis le
 * refus de designer pour une personne — table pleine, exclue, réservée
 * ailleurs… — refuse le lot entier : ANIMATEUR_REFUSE {participant,
 * personne, refus: {code, details}}, la personne nommée par son nom affiché,
 * la cause et ses détails sans le remède, qui devient celui du lot. Rien
 * n'est posé quand le lot est refusé.
 *
 * Avertissements : ceux des désignations, cumulés dans leur ordre, chaque
 * paire (code, détails) une fois, à son premier rang (avertissementsDuLot) :
 * une personne qui tient déjà la réservation de son siège laisse la table
 * gelée sans l'agrandir, et TABLE_GELEE y revient sinon.
 * Une liste vide, ou qui porte deux fois un identifiant, lève TypeError.
 */
function designerAnimateurs(charge, { table: idTable, participants, libelle: saisi } = {}) {
  exigerModifiable(charge);
  const table = tableDe(charge, idTable);
  exigerLot(participants);
  const texte = libelleSaisi(saisi);
  const personnes = participants.map((id) => personneDe(charge, id));
  const animent = new Set(animateursDeLaTable(charge, idTable).map(({ participant }) => participant));
  const nouvelles = personnes.filter(({ id }) => !animent.has(id));
  if (nouvelles.length === 0) throw refus('SANS_EFFET', { commande: 'designerAnimateurs' });
  const R = charge.evenement.tours;
  for (const personne of nouvelles) {
    if (personne.exclu) continue;
    const [tour] = toursDAbsence(personne, R);
    if (tour === undefined) continue;
    const tous = Array.from({ length: R }, (_, rang) => rang + 1);
    throw animateurRefuse(
      personne,
      { code: 'ABSENT_AU_TOUR', details: { participant: personne.id, personne: nomAffiche(personne), tour } },
      { commande: 'changerPresence', arguments: { id: personne.id, tours: tous } },
    );
  }
  const places = capacite(charge, table);
  let courante = charge;
  const listes = [];
  for (const personne of nouvelles) {
    let rendu;
    try {
      const siege = siegeDuLot(courante, idTable, places, personne.id);
      rendu = designer(courante, { participant: personne.id, table: idTable, siege, libelle: titreDuLot(personne, texte) });
    } catch (erreur) {
      if (!(erreur instanceof ErreurCommande)) throw erreur;
      const { remede = null, ...details } = erreur.details;
      throw animateurRefuse(personne, { code: erreur.code, details }, remede);
    }
    courante = rendu.charge;
    listes.push(rendu.avertissements);
  }
  return {
    charge: courante,
    libelle: libelle('ENTREE_DESIGNER_ANIMATEURS', { numero: table.numero, personnes: nouvelles.map(nomAffiche) }),
    avertissements: avertissementsDuLot(listes),
  };
}

/**
 * Les désignations que « Créer les tables… » fait sur les tables qu'il vient
 * de poser (§ 2.1 étape 6, § 6.1) : designer pour chaque {participant,
 * table} reçu, dans l'ordre reçu, chacune sur la charge que la précédente
 * laisse, sans siège — le plus petit siège sans titre de la table neuve. Le
 * titre est le titre pressenti de la personne quand il ne se réduit pas à
 * des blancs, sinon le titre par défaut (places.titreParDefaut), comme pour
 * un lot (titreDuLot). La création, qui répartit (repartitionALaCreation,
 * animateurs.js), n'envoie que des personnes présentes à chaque tour, sans
 * réservation, sous la garde k_t < c_t : designer ne les refuse pas, et un
 * refus remonterait tel quel. Rend la charge et les avertissements cumulés
 * (avertissementsDuLot) ; la charge reçue reste intacte.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {Array<{participant: number, table: number}>} affectations
 * @returns {{charge: import('../stockage/types.js').Charge, avertissements: Array<{code: string, details: Object}>}}
 */
export function designerALaCreation(charge, affectations) {
  const defaut = libelle('places.titreParDefaut');
  let courante = charge;
  const listes = [];
  for (const { participant, table } of affectations) {
    const personne = personneDe(courante, participant);
    const rendu = designer(courante, { participant, table, siege: null, libelle: titreDuLot(personne, defaut) });
    courante = rendu.charge;
    listes.push(rendu.avertissements);
  }
  return { charge: courante, avertissements: avertissementsDuLot(listes) };
}

// Le premier de titres dans l'ordre canonique : le plus petit siège, puis
// le libellé, comparé unité UTF-16 par unité, puis le rang dans
// charge.titres.
const premierTitre = (titres) =>
  [...titres].sort(
    (a, b) =>
      a.titre.siege - b.titre.siege ||
      (a.titre.libelle < b.titre.libelle ? -1 : a.titre.libelle > b.titre.libelle ? 1 : 0) ||
      a.rang - b.rang,
  )[0];

/**
 * retirerAnimateur {table, participant} (§ 2.1 étape 6) : la personne cesse
 * d'animer la table. Part, en une entrée, chaque réservation « tous les
 * tours » de la personne qui pourvoit pour la soirée un titre de la table,
 * ou qui en pourvoit un par sa désignation suspendue quand elle est absente
 * à un tour (designations), et avec elle un seul titre : le fichier ne garde pas quel
 * geste a posé un titre, si bien que le titre retiré est le premier, dans
 * l'ordre canonique (premierTitre), de ceux qu'elle pourvoit — celui de son
 * siège, quand elle en porte un. designerAnimateurs pose le titre de chaque
 * personne au siège de sa réservation : ce titre part, et un titre posé avant
 * la désignation, à un autre siège, reste. Un second titre au même siège
 * reste, non pourvu. Les autres réservations de la personne, et les titres
 * et réservations des autres personnes, restent. Refus : PLAN_BLOQUE ;
 * PARTICIPANT_INCONNU ; une personne qui n'anime pas la table, SANS_EFFET.
 */
function retirerAnimateur(charge, { table: idTable, participant } = {}) {
  exigerModifiable(charge);
  const personne = personneDe(charge, participant);
  const table = tableDe(charge, idTable);
  const siennes = designations(charge).filter(({ titre, reservation }) => titre.table === idTable && reservation.participant === participant);
  if (siennes.length === 0) throw refus('SANS_EFFET', { commande: 'retirerAnimateur' });
  const pourvoyeuses = [];
  for (const { reservation } of siennes) {
    if (!pourvoyeuses.some((connue) => ordreDesReservations(connue, reservation) === 0)) pourvoyeuses.push(reservation);
  }
  const rangs = new Set(
    pourvoyeuses.map(
      (reservation) => premierTitre(siennes.filter((d) => ordreDesReservations(d.reservation, reservation) === 0)).rang,
    ),
  );
  const suivante = copieDeTravail(charge);
  suivante.titres = suivante.titres.filter((_, rang) => !rangs.has(rang));
  suivante.reservations = suivante.reservations.filter((r) => !pourvoyeuses.some((p) => ordreDesReservations(r, p) === 0));
  return {
    charge: suivante,
    libelle: libelle('ENTREE_RETIRER_ANIMATEUR', { personne: nomAffiche(personne), numero: table.numero }),
    avertissements: [],
  };
}

// --- Le retenu (§ 7.1, § 8.9, § 9) -------------------------------------------

// Le retenu de la charge à ce tour, lisible : sans retenu, ou à un tour qu'il
// ne porte pas, TypeError — la cible d'etatPlaces ne l'offre jamais ; fautif,
// RETENU_FAUTIF, remède la version précédente du fichier (§ 8.8).
function exigerRetenu(charge, tour) {
  const { retenu } = charge;
  if (retenu === null) throw new TypeError('retenu : aucun placement retenu');
  if (fautes(retenu).length > 0) throw refus('RETENU_FAUTIF', {}, { geste: 'ouvrirSecours', source: 'precedent' });
  if (!Number.isSafeInteger(tour) || tour < 1 || tour > retenu.tours) {
    throw new TypeError(`tour : de 1 à ${retenu.tours} attendu, reçu ${JSON.stringify(tour)}`);
  }
}

// Déclare la personne dans le retenu qui ne la place pas encore : parmi ses
// participants, puis en réserve à chaque tour où elle est présente et parmi
// les absents des tours de 1 à R où elle ne l'est pas — l'opérateur seul
// décide où elle s'assied (§ 9). Au-delà de R, un tour que la charge n'a
// plus, elle attend en réserve.
function declarer(retenu, personne, R) {
  const { id } = personne;
  retenu.participants = [...retenu.participants, id].sort(croissant);
  retenu.placement.forEach((etage, rang) => {
    if (rang < R && !estPresentAuTour(personne, rang + 1)) etage.absents = [...(etage.absents ?? []), id].sort(croissant);
    else etage.reserve = [...etage.reserve, id].sort(croissant);
  });
}

// Le rang de la table idTable dans le retenu, la table ajoutée vide à chaque
// tour quand il ne la déclare pas encore — une table créée après la
// retenue, que creerTable y ajoute aussi.
function rangDeTable(retenu, idTable, places) {
  const rang = retenu.tables.indexOf(idTable);
  if (rang >= 0) return rang;
  retenu.tables.push(idTable);
  retenu.capacites.push(places);
  for (const tour of retenu.placement) tour.sieges.push([]);
  return retenu.tables.length - 1;
}

// PERSONNE_ABSENTE_AU_TOUR pour une personne absente au tour : une absente
// ne s'assied pas, ni en réserve, à son tour d'absence. Le remède la dit
// présente à ce tour en plus de ses tours de présence, croissants, comme le
// refus du contrôle de pose (pose.js).
function exigerPresente(charge, personne, tour) {
  if (estPresentAuTour(personne, tour)) return;
  const tours = [...new Set([...toursDePresence(personne, charge.evenement.tours), tour])].sort(croissant);
  throw refus('PERSONNE_ABSENTE_AU_TOUR', { participant: personne.id, personne: nomAffiche(personne), tour }, {
    commande: 'changerPresence',
    arguments: { id: personne.id, tours },
  });
}

// Clé d'une violation : ses champs, dans un ordre fixe ; l'occupant d'un
// siège réservé n'y entre pas, la réservation non tenue reste la même.
const cleDeViolation = ({ code, participant, table, tour, detail, siege }) =>
  JSON.stringify([code, participant, table, tour, detail, siege]);

// Les violations du retenu (violationsDuRetenu, celles de verifierInvariants,
// la réserve étant une place du plan, et les réservations non tenues qu'il
// ne relève pas) que suivant ajoute au retenu precedent : celles dont la
// clé n'y apparaît pas. Un retenu lisible déclare chaque table et chaque
// personne une fois, et n'y rend jamais deux violations de même clé. []
// quand la configuration ne se normalise pas.
function violationsNouvelles(charge, precedent, suivant) {
  const instance = instanceDe(charge);
  if (instance === null) return [];
  const juger = (retenu) => violationsDuRetenu(charge, retenu, instance);
  const connues = new Set(juger(precedent).map(cleDeViolation));
  return juger(suivant).filter((violation) => !connues.has(cleDeViolation(violation)));
}

// La charge suivante d'une retouche, ou INVARIANT_VIOLE quand elle ajoute
// une violation au retenu reçu, son remède celui que remedeDe(violations)
// rend, null par défaut. Le versement en réserve des personnes que le plan
// n'assied pas (reduireAuxAssises, versLaReserveAffichee) n'en ajoute
// aucune : l'affichage assied d'abord, à leur table, les personnes qu'elle
// réserve, et une capacité ne descend jamais sous ses réservations (§ 6.2).
function retouche(charge, suivante, remedeDe = () => null) {
  const violations = violationsNouvelles(charge, charge.retenu, suivante.retenu);
  if (violations.length > 0) {
    throw refus('INVARIANT_VIOLE', { proposition: charge.retenu.proposition, violations }, remedeDe(violations));
  }
  return suivante;
}

// Le remède d'un retrait du tour que la réservation de la personne à sa
// table interdit : le retrait de cette réservation, celle qui tient la
// personne à la table de la violation au tour, la plus étroite d'abord —
// « ce tour » avant « tous les tours », puis l'ordre canonique. Quand les
// deux portées coexistent, retirer « ce tour » lève le refus et garde les
// autres tours, que retirer « tous les tours » perdrait. null quand aucune
// violation RESERVATION ne nomme la personne.
function remedeDuRetrait(charge, participant, tour, violations) {
  const violation = violations.find((v) => v.code === 'RESERVATION' && v.participant === participant);
  if (violation === undefined) return null;
  const largeur = ({ portee }) => (portee === 'tous' ? 1 : 0);
  const [tenue] = charge.reservations
    .filter((r) => r.participant === participant && r.table === violation.table && (r.portee === 'tous' || r.tour === tour))
    .sort((a, b) => largeur(a) - largeur(b) || ordreDesReservations(a, b));
  if (tenue === undefined) return null;
  return {
    commande: 'retirerReservation',
    arguments: { participant, table: tenue.table, portee: tenue.portee, tour: tenue.tour },
  };
}

// Le numéro de la table où le retenu place id à ce tour, null en réserve,
// hors du retenu, ou à une table que la charge n'a plus.
function numeroDuLieu(charge, tour, id) {
  const lieu = lieuDans(charge.retenu, tour, id);
  if (lieu === null || lieu === 'reserve') return null;
  return charge.tables.find(({ id: idTable }) => idTable === charge.retenu.tables[lieu.table])?.numero ?? null;
}

/**
 * deplacerDansRetenu {tour, participant, table, siege|null} (§ 7.1, § 9) :
 * la personne s'assied à cette table au tour donné, et sa place d'avant se
 * libère. Sièges attribués, au siège donné — sans siège, celui que sa
 * réservation lui tient à cette table, sinon la première chaise libre que
 * ne tient pas la réservation d'un autre —, les rangs sautés à null ; la chaise d'un présent refuse
 * SIEGE_OCCUPE, remède l'échange ; celle d'un absent — exclu, ou que la
 * charge n'a plus — l'envoie en réserve. Sans attribution, la liste reste
 * triée ; une table pleine de présents refuse TABLE_PLEINE, et, pleine
 * d'une liste qui porte un absent, envoie le plus petit en réserve. Une
 * personne absente au tour refuse PERSONNE_ABSENTE_AU_TOUR (controlerPose).
 * Une personne que le retenu ne place pas y entre, en réserve aux autres
 * tours de sa présence.
 * Le lieu de départ est celui que le plan du tour montre (placeDe) : une
 * personne qu'il ne montre pas assise part de la réserve.
 */
function deplacerDansRetenu(charge, { tour, participant, table: idTable, siege = null } = {}) {
  exigerModifiable(charge);
  exigerRetenu(charge, tour);
  const personne = personneDe(charge, participant);
  const table = tableDe(charge, idTable);
  exigerSiege(siege);
  const places = capacite(charge, table);
  if (siege !== null && siege > places) throw new TypeError(`siege : de 1 à ${places} attendu, reçu ${siege}`);
  leverRefus(controlerPose(charge, { participant, table: idTable, siege, portee: 'tour', tour, retenu: true }).refus);

  const ids = presents(charge);
  const assisesDuTour = assisesAffichees(charge, tour);
  const place = placeDe(charge, tour, participant, assisesDuTour);
  const de = place === null ? null : numeroDuLieu(charge, tour, participant);
  const memeTable = place !== null && place.table === idTable;
  const suivante = copieDeTravail(charge);
  const { retenu } = suivante;
  const rangTable = rangDeTable(retenu, idTable, places);
  if (lieuDans(retenu, tour, participant) === null) declarer(retenu, personne, charge.evenement.tours);
  // La table d'arrivée n'a rien à verser : une liste qui porte plus de
  // présents que de places refuse TABLE_PLEINE, et une autre les assied tous.
  reduireAuxAssises(retenu, tour, rangsDesTables(retenu, tour, [participant]), assisesDuTour, ids);
  versLaReserveAffichee(retenu, tour, participant, place);
  const etage = retenu.placement[tour - 1];
  let siegeLibelle = null;

  if (retenu.siegesAttribues) {
    const liste = etage.sieges[rangTable];
    let cible = siege;
    if (cible === null) {
      // Sans siège, la chaise que la réservation de la personne lui tient à
      // cette table, sinon la première chaise libre — vide ou d'un absent —
      // que ne tient pas la réservation active d'un autre : le contrôle de
      // pose ne juge que le siège donné.
      const tenues = siegesTenus(charge, tour, idTable);
      const sienne = [...tenues.keys()].find((numero) => tenues.get(numero) === participant);
      const libre = (numero) => {
        const assis = liste[numero - 1] ?? null;
        return (assis === null || !ids.has(assis)) && (!tenues.has(numero) || tenues.get(numero) === participant);
      };
      if (sienne !== undefined && (liste[sienne - 1] ?? null) === participant) {
        throw refus('SANS_EFFET', { commande: 'deplacerDansRetenu' });
      }
      if (sienne !== undefined && libre(sienne)) {
        cible = sienne;
      } else {
        cible = 1;
        while (cible <= places && !libre(cible)) cible += 1;
      }
      if (cible > places) throw refus('TABLE_PLEINE', { table: idTable, tour, capacite: places }, changerPlaces(idTable, places));
    }
    const occupant = liste[cible - 1] ?? null;
    if (occupant === participant) throw refus('SANS_EFFET', { commande: 'deplacerDansRetenu' });
    if (occupant !== null && ids.has(occupant)) {
      throw refus('SIEGE_OCCUPE', { table: idTable, siege: cible, tour, occupant }, {
        commande: 'echangerDansRetenu',
        arguments: { tour, a: participant, b: occupant },
      });
    }
    if (occupant !== null) {
      liste[cible - 1] = null;
      enReserve(retenu, tour, occupant);
    }
    oter(retenu, tour, participant);
    const garnie = etage.sieges[rangTable];
    while (garnie.length < cible) garnie.push(null);
    garnie[cible - 1] = participant;
    sansNullDeFin(garnie);
    if (garnie.length > retenu.capacites[rangTable]) retenu.capacites[rangTable] = places;
    if (memeTable) siegeLibelle = cible;
  } else {
    const liste = etage.sieges[rangTable];
    if (liste.includes(participant)) throw refus('SANS_EFFET', { commande: 'deplacerDansRetenu' });
    const assises = liste.filter((id) => ids.has(id)).length;
    if (assises >= places) throw refus('TABLE_PLEINE', { table: idTable, tour, capacite: places }, changerPlaces(idTable, places));
    if (liste.length >= places) {
      const absent = liste.filter((id) => !ids.has(id)).sort(croissant)[0];
      if (absent !== undefined) {
        liste.splice(liste.indexOf(absent), 1);
        enReserve(retenu, tour, absent);
      }
    }
    oter(retenu, tour, participant);
    const garnie = etage.sieges[rangTable];
    garnie.push(participant);
    garnie.sort(croissant);
    if (garnie.length > retenu.capacites[rangTable]) retenu.capacites[rangTable] = places;
  }

  return {
    charge: retouche(charge, suivante),
    libelle: libelle('ENTREE_DEPLACER_DANS_RETENU', {
      personne: nomAffiche(personne),
      de,
      vers: table.numero,
      siege: siegeLibelle,
      tour,
    }),
    avertissements: [],
  };
}

// Les sièges de la table idTable que tient au tour une réservation active,
// tels que le plan les montre (etatPlaces) : Map siège → titulaire.
function siegesTenus(charge, tour, idTable) {
  const { chaises } = etatPlaces(charge, { tour }).tables.find(({ id }) => id === idTable);
  return new Map(chaises.filter(({ reservation }) => reservation !== null).map(({ siege, reservation }) => [siege, reservation.participant]));
}

// Les personnes que le plan du tour montre assises (etatPlaces, source le
// retenu). Une place du retenu à une table que la charge n'a plus, ou à un
// rang au-delà de sa capacité courante, n'y figure pas : elle se lit comme
// la réserve.
function assisesAffichees(charge, tour) {
  const assises = new Set();
  for (const { chaises } of etatPlaces(charge, { tour }).tables) {
    for (const { occupant } of chaises) if (occupant !== null) assises.add(occupant);
  }
  return assises;
}

// La place qu'une personne occupe au tour telle que le plan la montre :
// { table, siege }, ou null quand le plan ne l'assied pas — en réserve, hors
// du retenu, ou absente d'assises (assisesAffichees) : à une table que la
// charge n'a plus, à un rang au-delà de la capacité courante, ou, sans
// attribution, parmi les présents qu'une liste porte au-delà des places. Le
// siège est le rang sous des sièges attribués ; sans attribution, celui de sa
// réservation à un siège à cette table, null sans elle. Les gestes du retenu
// y lisent le lieu de départ, et la pose de l'autre sur elle s'y contrôle.
function placeDe(charge, tour, id, assises) {
  const lieu = lieuDans(charge.retenu, tour, id);
  if (lieu === null || lieu === 'reserve' || !assises.has(id)) return null;
  const idTable = charge.retenu.tables[lieu.table];
  if (charge.retenu.siegesAttribues) return { table: idTable, siege: lieu.rang + 1 };
  const tenue = charge.reservations.find(
    (r) => r.participant === id && r.table === idTable && r.siege !== null && (r.portee === 'tous' || r.tour === tour),
  );
  return { table: idTable, siege: tenue?.siege ?? null };
}

// Verse dans la réserve du tour une personne que le retenu range à une table
// alors que le plan ne la montre pas assise (place null, de placeDe) : sa
// liste la perd, et le geste part de la réserve, comme l'affichage. Personne
// n'entre ainsi dans la liste d'une table que la charge n'a plus.
function versLaReserveAffichee(retenu, tour, id, place) {
  const lieu = lieuDans(retenu, tour, id);
  if (place === null && lieu !== null && lieu !== 'reserve') {
    oter(retenu, tour, id);
    enReserve(retenu, tour, id);
  }
}

// Sans attribution, verse dans la réserve du tour chaque présent (ids) que
// le plan ne montre pas assis (assises) aux tables des rangs donnés : leur
// liste vaut alors ce que l'affichage y assied, et le tri qui suit le geste
// n'assied personne d'autre que ceux qu'il nomme. Sous des sièges attribués,
// le rang est le siège et ne glisse pas : rien ne change.
function reduireAuxAssises(retenu, tour, rangs, assises, ids) {
  if (retenu.siegesAttribues) return;
  const etage = retenu.placement[tour - 1];
  for (const rang of rangs) {
    for (const id of etage.sieges[rang].filter((autre) => ids.has(autre) && !assises.has(autre))) {
      oter(retenu, tour, id);
      enReserve(retenu, tour, id);
    }
  }
}

// Les rangs des tables où le retenu place ces personnes au tour.
function rangsDesTables(retenu, tour, personnes) {
  return personnes.map((id) => lieuDans(retenu, tour, id)).filter((lieu) => lieu !== null && lieu !== 'reserve').map(({ table }) => table);
}

/**
 * echangerDansRetenu {tour, a, b} (§ 7.1) : a prend la place de b et b celle
 * de a, au tour donné ; une place peut être la réserve. Une exclue refuse
 * PERSONNE_EXCLUE, puis une absente au tour PERSONNE_ABSENTE_AU_TOUR, même
 * quand aucune des deux n'est assise. Chaque arrivée se contrôle comme un
 * dépôt : PLACE_RESERVEE, RESERVEE_AILLEURS. Une personne que le retenu ne
 * place pas y entre, en réserve aux autres tours de sa présence.
 */
function echangerDansRetenu(charge, { tour, a, b } = {}) {
  exigerModifiable(charge);
  exigerRetenu(charge, tour);
  if (a === b) throw new TypeError('echangerDansRetenu : deux personnes distinctes attendues');
  const personneA = personneDe(charge, a);
  const personneB = personneDe(charge, b);
  for (const personne of [personneA, personneB]) {
    if (personne.exclu) {
      throw refus('PERSONNE_EXCLUE', { participant: personne.id }, { commande: 'reintegrerParticipant', arguments: { id: personne.id } });
    }
  }
  for (const personne of [personneA, personneB]) exigerPresente(charge, personne, tour);
  const assises = assisesAffichees(charge, tour);
  const placeA = placeDe(charge, tour, a, assises);
  const placeB = placeDe(charge, tour, b, assises);
  if (placeA === null && placeB === null) throw refus('SANS_EFFET', { commande: 'echangerDansRetenu' });
  const poses = [];
  if (placeB !== null) poses.push(...controlerPose(charge, { participant: a, ...placeB, portee: 'tour', tour, retenu: true }).refus);
  if (placeA !== null) poses.push(...controlerPose(charge, { participant: b, ...placeA, portee: 'tour', tour, retenu: true }).refus);
  leverRefus(poses);

  const deA = placeA === null ? null : numeroDuLieu(charge, tour, a);
  const deB = placeB === null ? null : numeroDuLieu(charge, tour, b);
  const suivante = copieDeTravail(charge);
  const { retenu } = suivante;
  for (const personne of [personneA, personneB]) {
    if (lieuDans(retenu, tour, personne.id) === null) declarer(retenu, personne, charge.evenement.tours);
  }
  reduireAuxAssises(retenu, tour, rangsDesTables(retenu, tour, [a, b]), assises, presents(charge));
  // L'autre remplace dans la réserve une personne que le plan n'y montre pas assise.
  versLaReserveAffichee(retenu, tour, a, placeA);
  versLaReserveAffichee(retenu, tour, b, placeB);
  const lieuA = lieuDans(retenu, tour, a);
  const lieuB = lieuDans(retenu, tour, b);
  const etage = retenu.placement[tour - 1];
  const poser = (lieu, id) => {
    if (lieu === 'reserve') enReserve(retenu, tour, id);
    else etage.sieges[lieu.table][lieu.rang] = id;
  };
  if (lieuA === 'reserve') etage.reserve = etage.reserve.filter((id) => id !== a);
  if (lieuB === 'reserve') etage.reserve = etage.reserve.filter((id) => id !== b);
  poser(lieuB, a);
  poser(lieuA, b);
  if (!retenu.siegesAttribues) for (const liste of etage.sieges) liste.sort(croissant);

  return {
    charge: retouche(charge, suivante),
    libelle: libelle('ENTREE_ECHANGER_DANS_RETENU', { a: nomAffiche(personneA), deA, b: nomAffiche(personneB), deB, tour }),
    avertissements: [],
  };
}

/**
 * retirerDuTour {tour, participant} (§ 7.1) : la personne quitte sa table au
 * tour donné et attend dans la réserve de ce tour ; sa chaise se libère.
 * Une personne que le plan du tour ne montre pas assise (placeDe) — en
 * réserve, hors du retenu, à une table que la charge n'a plus ou à un rang
 * au-delà de sa capacité courante — refuse SANS_EFFET. Une personne que sa
 * réservation tient à cette table refuse INVARIANT_VIOLE, remède le retrait
 * de cette réservation.
 */
function retirerDuTour(charge, { tour, participant } = {}) {
  exigerModifiable(charge);
  exigerRetenu(charge, tour);
  const personne = personneDe(charge, participant);
  if (personne.exclu) {
    throw refus('PERSONNE_EXCLUE', { participant }, { commande: 'reintegrerParticipant', arguments: { id: participant } });
  }
  const assises = assisesAffichees(charge, tour);
  if (placeDe(charge, tour, participant, assises) === null) {
    throw refus('SANS_EFFET', { commande: 'retirerDuTour' });
  }
  const numero = numeroDuLieu(charge, tour, participant);
  const suivante = copieDeTravail(charge);
  reduireAuxAssises(suivante.retenu, tour, rangsDesTables(suivante.retenu, tour, [participant]), assises, presents(charge));
  oter(suivante.retenu, tour, participant);
  enReserve(suivante.retenu, tour, participant);
  return {
    charge: retouche(charge, suivante, (violations) => remedeDuRetrait(charge, participant, tour, violations)),
    libelle: libelle('ENTREE_RETIRER_DU_TOUR', { personne: nomAffiche(personne), numero, tour }),
    avertissements: [],
  };
}

/** @type {Map<string, (charge: Object, args: Object) => Object>} */
export const COMMANDES_PLACES = new Map([
  ['reserver', reserver],
  ['retirerReservation', retirerReservation],
  ['deplacerReservation', deplacerReservation],
  ['poserTitre', poserTitre],
  ['retirerTitre', retirerTitre],
  ['designer', designer],
  ['designerAnimateurs', designerAnimateurs],
  ['retirerAnimateur', retirerAnimateur],
  ['convertirEnTous', convertirEnTous],
  ['deplacerDansRetenu', deplacerDansRetenu],
  ['echangerDansRetenu', echangerDansRetenu],
  ['retirerDuTour', retirerDuTour],
]);
