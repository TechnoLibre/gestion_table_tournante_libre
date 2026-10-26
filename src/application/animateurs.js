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
// Les commandes des places (designerAnimateurs, retirerAnimateur) et la
// fenêtre d'ajout des animateurs lisent ces fonctions. Elles ne modifient
// rien de ce qu'elles reçoivent, et rendent leurs listes dans un ordre que
// fixent la charge et des comparaisons numériques, jamais l'ordre des clés
// d'un objet.
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
