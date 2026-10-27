// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les animateurs d'une table et le statut de chaque personne pour en
// désigner (§ 2.1 étape 6, § 4, § 4.1). Aucune case « est animateur » ne
// s'écrit : anime une table la personne dont une réservation « tous les
// tours » pourvoit pour la soirée un titre de cette table, selon la règle
// unique des titres pourvus (pourvoyeursDesTitres, csv/import.js). Une
// personne exclue ne pourvoit rien et n'anime aucune table. Une personne
// absente à un tour ne pourvoit rien pour la soirée, mais sa désignation
// tient tant que sa réservation et son titre existent : sa réservation
// « tous les tours » est suspendue à ses tours d'absence (§ 4.4), et elle
// reste animatrice de la table, que son retrait libère.
//
// La marque de l'animation réservée (§ 4) dit qui est à désigner, jamais
// qui anime : une personne marquée qui n'anime aucune table reste à
// désigner (aDesigner), et une personne qui anime une table l'anime, marquée
// ou non (tablesAnimees). La création des tables qui manquent répartit les
// personnes à désigner sur les tables qu'elle crée (repartitionALaCreation).
//
// Les commandes des places (designerAnimateurs, retirerAnimateur), la
// création des tables qui manquent et son aperçu, la fenêtre d'ajout des
// animateurs, la colonne « Animation » de la grille des participants et le
// rapport d'import lisent ces fonctions. Elles ne modifient rien de ce
// qu'elles reçoivent, et rendent leurs listes dans un ordre que fixent la
// charge et des comparaisons numériques, jamais l'ordre des clés d'un objet.
import { ordreDesReservations, pourvoyeursDesTitres } from '../csv/import.js';
import { estPresentAuTour } from '../moteur/presence.js';
import { fautes } from '../stockage/placements.js';
import { lieuDans } from './retenu_lieux.js';

// L'enregistrement de la table d'identifiant id : une table inconnue est une
// faute de l'appelant.
function tableDe(charge, id) {
  const table = charge.tables.find((candidate) => candidate.id === id);
  if (table === undefined) throw new TypeError(`table inconnue : ${JSON.stringify(id)}`);
  return table;
}

// Deux titres d'une même personne : le plus petit siège d'abord, puis le
// libellé, comparé unité UTF-16 par unité.
const parSiege = (a, b) => a.siege - b.siege || (a.libelle < b.libelle ? -1 : a.libelle > b.libelle ? 1 : 0);

// Une personne absente à un tour, sa présence rendue à chaque tour : la
// copie que lit la répartition des désignations suspendues.
function presenceRendue(personne) {
  const { presence: _presence, ...presente } = personne;
  return presente;
}

/**
 * Les désignations de la charge, dans l'ordre de charge.titres : chaque
 * titre qu'une réservation « tous les tours » pourvoit pour la soirée, puis,
 * sur les titres restés sans pourvoyeur pour la soirée seulement, la
 * désignation suspendue de chaque personne non exclue absente à un tour.
 * Celles-ci se répartissent selon les règles de pourvoyeursDesTitres sur une
 * charge réduite : ces titres, les réservations « tous les tours » de ces
 * absentes, et ces absentes rendues présentes à chaque tour. Un titre déjà
 * pourvu n'entre donc pas dans la répartition : une désignation suspendue ne
 * prend jamais le titre d'une présente, ni ne se décale devant elle. rang est
 * celui du titre dans charge.titres ; reservation, celle de
 * charge.reservations qui le pourvoit.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {Array<{rang: number, titre: Object, reservation: Object}>}
 */
export function designations(charge) {
  const pourvoyeurs = pourvoyeursDesTitres(charge);
  const R = charge.evenement.tours;
  const absentes = charge.participants.filter((personne) => !personne.exclu && toursDAbsence(personne, R).length > 0);
  const restants = charge.titres.flatMap((_titre, rang) => (pourvoyeurs[rang].soiree === null ? [rang] : []));
  const suspendues = new Map();
  if (absentes.length > 0 && restants.length > 0) {
    const ids = new Set(absentes.map(({ id }) => id));
    const repartis = pourvoyeursDesTitres({
      ...charge,
      participants: absentes.map(presenceRendue),
      reservations: charge.reservations.filter(({ participant, portee }) => portee === 'tous' && ids.has(participant)),
      titres: restants.map((rang) => charge.titres[rang]),
    });
    restants.forEach((rang, i) => {
      if (repartis[i].soiree !== null) suspendues.set(rang, repartis[i].soiree);
    });
  }
  return charge.titres.flatMap((titre, rang) => {
    const reservation = pourvoyeurs[rang].soiree ?? suspendues.get(rang) ?? null;
    return reservation === null ? [] : [{ rang, titre, reservation }];
  });
}

/**
 * Les animateurs de la table d'identifiant idTable : une entrée par personne,
 * le siège et le libellé du premier titre qu'elle y pourvoit (le plus petit
 * siège, puis le libellé), rangées par ce siège puis par identifiant.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {number} idTable
 * @returns {Array<{participant: number, siege: number, libelle: string}>}
 * @throws {TypeError} une table inconnue
 */
export function animateursDeLaTable(charge, idTable) {
  tableDe(charge, idTable);
  const premiers = new Map();
  for (const { titre, reservation } of designations(charge)) {
    if (titre.table !== idTable) continue;
    const { participant } = reservation;
    const connu = premiers.get(participant);
    if (connu === undefined || parSiege(titre, connu) < 0) premiers.set(participant, { siege: titre.siege, libelle: titre.libelle });
  }
  return [...premiers]
    .map(([participant, { siege, libelle }]) => ({ participant, siege, libelle }))
    .sort((a, b) => a.siege - b.siege || a.participant - b.participant);
}

// Les tables où le retenu lisible assied la personne id, chacune avec ses
// tours croissants, rangées par leur premier tour : [{ table, numero, tours }].
// [] sans retenu, sous un retenu fautif, ou quand il ne l'assied nulle part ;
// une table du retenu que la charge n'a plus ne se nomme pas.
function placementsAuRetenu(charge, id) {
  const { retenu } = charge;
  if (retenu === null || fautes(retenu).length > 0) return [];
  const parTable = new Map();
  for (let tour = 1; tour <= retenu.tours; tour += 1) {
    const lieu = lieuDans(retenu, tour, id);
    if (lieu === null || lieu === 'reserve') continue;
    const idTable = retenu.tables[lieu.table];
    const table = charge.tables.find((candidate) => candidate.id === idTable);
    if (table === undefined) continue;
    if (!parTable.has(idTable)) parTable.set(idTable, { table: idTable, numero: table.numero, tours: [] });
    parTable.get(idTable).tours.push(tour);
  }
  return [...parTable.values()];
}

/**
 * Les tables que chaque personne anime (§ 4, § 10.2) : identifiant de la
 * personne → numéros affichés des tables où une de ses désignations
 * (designations) la fait animer, chaque table une fois, croissants. Une
 * désignation suspendue par une absence compte : la personne reste
 * animatrice de sa table. Une personne qui n'anime aucune table n'y figure
 * pas.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {Map<number, number[]>}
 */
export function tablesAnimees(charge) {
  const numeroDe = new Map(charge.tables.map((table) => [table.id, table.numero]));
  const tablesDe = new Map();
  for (const { titre, reservation } of designations(charge)) {
    if (!tablesDe.has(reservation.participant)) tablesDe.set(reservation.participant, new Set());
    tablesDe.get(reservation.participant).add(titre.table);
  }
  return new Map(
    [...tablesDe].map(([participant, tables]) => [participant, [...tables].map((id) => numeroDe.get(id)).sort((a, b) => a - b)]),
  );
}

/**
 * Les personnes à désigner animatrices (§ 4) : celles qui portent la marque
 * de l'animation réservée, ne sont pas exclues et n'animent aucune table
 * (tablesAnimees), dans l'ordre de charge.participants, par identifiant.
 * Une personne absente à un tour en est : la marque attend sa désignation,
 * que l'absence refuse tant qu'elle dure (§ 5.9).
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {number[]}
 */
export function aDesigner(charge) {
  const animent = tablesAnimees(charge);
  return charge.participants
    .filter((personne) => personne.animationReservee === true && !personne.exclu && !animent.has(personne.id))
    .map(({ id }) => id);
}

/**
 * La répartition des personnes à désigner (aDesigner) sur nombre tables
 * neuves, sans titre ni réservation, de places sièges chacune : celles que
 * « Créer les tables… » crée (§ 6.1). Les personnes passent par identifiant
 * croissant. Chacune va à la table qui a le moins d'animateurs, puis à celle
 * dont aucun animateur ne porte son organisation, puis à celle de plus petit
 * rang ; une table reçoit au plus places − 1 animateurs, pour garder une
 * chaise qui tourne (k_t < c_t, § 5.9). Restent à désigner, dans le même
 * ordre, chacune avec sa cause : 'absente' {tours}, absente à un tour, ses
 * tours d'absence croissants — sa réservation « tous les tours » ne
 * pourvoirait aucun titre pour la soirée ; 'reservee', qui tient déjà une
 * réservation, qu'une désignation mettrait à deux places d'un même tour ;
 * 'tablesPleines', quand chaque table a déjà places − 1 animateurs. Une
 * personne exclue n'est pas à désigner et n'y figure pas. rang est celui de
 * la table parmi les tables neuves, de 0 à nombre − 1.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {number} nombre   le nombre de tables neuves
 * @param {number} places   les sièges de chacune
 * @returns {{affectations: Array<{participant: number, rang: number}>,
 *   restantes: Array<{participant: number, cause: 'absente'|'reservee'|'tablesPleines', tours?: number[]}>}}
 */
export function repartitionALaCreation(charge, nombre, places) {
  const personneDe = new Map(charge.participants.map((personne) => [personne.id, personne]));
  const reservees = new Set(charge.reservations.map(({ participant }) => participant));
  const tables = Array.from({ length: nombre }, () => ({ animateurs: 0, organisations: new Set() }));
  const affectations = [];
  const restantes = [];
  for (const id of [...aDesigner(charge)].sort((a, b) => a - b)) {
    const personne = personneDe.get(id);
    const tours = toursDAbsence(personne, charge.evenement.tours);
    if (tours.length > 0) {
      restantes.push({ participant: id, cause: 'absente', tours });
      continue;
    }
    if (reservees.has(id)) {
      restantes.push({ participant: id, cause: 'reservee' });
      continue;
    }
    const { organisation } = personne;
    const partage = (table) => organisation !== null && table.organisations.has(organisation);
    let choisi = -1;
    tables.forEach((table, rang) => {
      if (table.animateurs >= places - 1) return;
      const meilleure = tables[choisi];
      if (
        choisi === -1 ||
        table.animateurs < meilleure.animateurs ||
        (table.animateurs === meilleure.animateurs && partage(meilleure) && !partage(table))
      ) {
        choisi = rang;
      }
    });
    if (choisi === -1) {
      restantes.push({ participant: id, cause: 'tablesPleines' });
      continue;
    }
    tables[choisi].animateurs += 1;
    if (organisation !== null) tables[choisi].organisations.add(organisation);
    affectations.push({ participant: id, rang: choisi });
  }
  return { affectations, restantes };
}

/**
 * Les tours de 1 à R où la personne est absente, croissants ; [] quand elle
 * est présente à chacun. L'exclusion ne s'y lit pas.
 *
 * @param {import('../stockage/types.js').Participant} personne
 * @param {number} R  le nombre de tours de la soirée
 * @returns {number[]}
 */
export function toursDAbsence(personne, R) {
  const tours = [];
  for (let tour = 1; tour <= R; tour += 1) if (!estPresentAuTour(personne, tour)) tours.push(tour);
  return tours;
}

/**
 * Les avertissements d'un lot de désignations : les listes reçues, une par
 * désignation dans l'ordre du lot, mises bout à bout, chaque paire (code,
 * détails) gardée une fois, à son premier rang. Deux détails sont les mêmes
 * quand leurs textes JSON le sont : les commandes les composent toujours
 * dans le même ordre de champs.
 *
 * @param {Array<Array<{code: string, details: Object}>>} listes
 * @returns {Array<{code: string, details: Object}>}
 */
export function avertissementsDuLot(listes) {
  const vus = new Set();
  const cumules = [];
  for (const avertissement of listes.flat()) {
    const cle = JSON.stringify([avertissement.code, avertissement.details]);
    if (vus.has(cle)) continue;
    vus.add(cle);
    cumules.push(avertissement);
  }
  return cumules;
}

/**
 * Le statut de chaque personne pour animer la table idTable, une entrée par
 * participant, dans l'ordre de charge.participants. Chaque entrée porte
 * participant, statut, choisissable, et titrePressenti (celui de la fiche,
 * null sans lui) ; le premier cas qui s'applique donne le statut :
 * - 'exclue' : non choisissable ;
 * - 'absente' {tours} : absente à un tour au moins, ses tours d'absence
 *   croissants ; non choisissable, puisque sa réservation « tous les tours »
 *   ne pourvoit aucun titre pour la soirée. Le cas passe avant
 *   'animeCetteTable' et 'animeAutreTable' : une animatrice absente, que
 *   designations garde par sa désignation suspendue, se lit absente dans la
 *   fenêtre ;
 * - 'animeCetteTable' {siege, libelle} : déjà animatrice ici, son premier
 *   titre ; non choisissable ;
 * - 'animeAutreTable' {table, numero} : animatrice d'une autre table, la
 *   première dans l'ordre des titres ; non choisissable ;
 * - 'reservee' {reservations} : une réservation au moins, posée à la main,
 *   qui ne pourvoit aucun titre pour la soirée — chacune {table, numero,
 *   siege, portee, tour}, dans l'ordre canonique ; non choisissable ;
 * - 'placeeAuRetenu' {placements} : le retenu l'assied, sans réservation —
 *   chaque table {table, numero, tours} ; choisissable, le retenu passant en
 *   dérive comme pour toute réservation (§ 9) ;
 * - 'libre' : choisissable.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {number} idTable
 * @returns {Array<Object>}
 * @throws {TypeError} une table inconnue
 */
export function statutsPourAnimation(charge, idTable) {
  tableDe(charge, idTable);
  const animatrices = new Map();
  for (const { titre, reservation } of designations(charge)) {
    if (!animatrices.has(reservation.participant)) animatrices.set(reservation.participant, []);
    animatrices.get(reservation.participant).push(titre);
  }
  const numeroDe = (id) => charge.tables.find((table) => table.id === id)?.numero ?? null;
  return charge.participants.map((personne) => {
    const { id } = personne;
    const titrePressenti = personne.titrePressenti ?? null;
    const statut = (genre, choisissable, details = {}) => ({ participant: id, statut: genre, choisissable, ...details, titrePressenti });
    if (personne.exclu) return statut('exclue', false);
    const absences = toursDAbsence(personne, charge.evenement.tours);
    if (absences.length > 0) return statut('absente', false, { tours: absences });
    const titres = animatrices.get(id) ?? [];
    const ici = titres.filter(({ table }) => table === idTable).sort(parSiege);
    if (ici.length > 0) return statut('animeCetteTable', false, { siege: ici[0].siege, libelle: ici[0].libelle });
    if (titres.length > 0) return statut('animeAutreTable', false, { table: titres[0].table, numero: numeroDe(titres[0].table) });
    const reservations = charge.reservations.filter(({ participant }) => participant === id).sort(ordreDesReservations);
    if (reservations.length > 0) {
      return statut('reservee', false, {
        reservations: reservations.map(({ table, siege, portee, tour }) => ({ table, numero: numeroDe(table), siege, portee, tour })),
      });
    }
    const placements = placementsAuRetenu(charge, id);
    if (placements.length > 0) return statut('placeeAuRetenu', true, { placements });
    return statut('libre', true);
  });
}
