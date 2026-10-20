// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les listes de travail (§ 5.8, § 4.1, § 4.2, § 2.1 étape 6) : le travail qui
// reste, montré plutôt que fait. Les titres de place que rien ne pourvoit
// pour la soirée, les personnes au titre pressenti que rien ne réserve, les
// conversions que le logiciel propose sans les faire, les comptes de
// titres d'une table, et les personnes que le placement retenu laisse en
// réserve, tour par tour. Un titre pourvu se lit selon la seule règle,
// pourvoyeursDesTitres : pour la soirée, par une réservation « tous les
// tours » ; une réservation d'un tour désigné ne le pourvoit qu'à ce tour,
// et le titre reste dans la liste. Aucune fonction ne modifie la charge.
import { pourvoyeursDesTitres } from '../csv/import.js';
import { estPresentAuTour } from '../moteur/presence.js';
import { fautes } from '../stockage/placements.js';
import { presents } from './places.js';

// Deux chaînes, comparées unité UTF-16 par unité.
const comparerTextes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Les titres que rien ne pourvoit pour la soirée (§ 4.1), chacun avec les
 * tours où une réservation d'un tour désigné le pourvoit, croissants ; par
 * numéro de table, puis par siège et par libellé, l'identifiant de table
 * départageant deux numéros égaux.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {Array<{table: number, numero: number, siege: number, libelle: string, pourvuAuxTours: number[]}>}
 */
export function titresNonPourvus(charge) {
  const numeroDe = new Map(charge.tables.map(({ id, numero }) => [id, numero]));
  const pourvoyeurs = pourvoyeursDesTitres(charge);
  return charge.titres
    .map((titre, rang) => ({ titre, ...pourvoyeurs[rang] }))
    .filter(({ soiree }) => soiree === null)
    .map(({ titre: { table, siege, libelle }, tours }) => ({
      table,
      numero: numeroDe.get(table),
      siege,
      libelle,
      pourvuAuxTours: tours.flatMap((reservation, rang) => (reservation === null ? [] : [rang + 1])),
    }))
    .sort((a, b) => a.numero - b.numero || a.table - b.table || a.siege - b.siege || comparerTextes(a.libelle, b.libelle));
}

/**
 * Les personnes non exclues qui portent un titre pressenti et qu'aucune
 * réservation ne place encore (§ 5.8), par identifiant croissant.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {Array<{participant: number, titrePressenti: string}>}
 */
export function pressentisNonReserves(charge) {
  const reservees = new Set(charge.reservations.map(({ participant }) => participant));
  return charge.participants
    .filter(({ id, exclu, titrePressenti }) => !exclu && titrePressenti !== null && !reservees.has(id))
    .map(({ id, titrePressenti }) => ({ participant: id, titrePressenti }))
    .sort((a, b) => a.participant - b.participant);
}

/**
 * Les conversions proposées (§ 4.2) : une personne non exclue dont les
 * réservations « tour désigné » à une même table couvrent chacun des R tours,
 * et qui n'y tient aucune réservation « tous » — R réservations qu'une seule
 * de portée « tous les tours » remplacerait. Par personne, puis par table.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {Array<{participant: number, table: number}>}
 */
export function conversionsPossibles(charge) {
  const ids = presents(charge);
  const R = charge.evenement.tours;
  const toursDe = new Map();
  const tous = new Set();
  for (const { participant, table, portee, tour } of charge.reservations) {
    if (!ids.has(participant)) continue;
    const cle = `${participant}:${table}`;
    if (portee === 'tous') {
      tous.add(cle);
      continue;
    }
    if (!toursDe.has(cle)) toursDe.set(cle, { participant, table, tours: new Set() });
    toursDe.get(cle).tours.add(tour);
  }
  return [...toursDe.entries()]
    .filter(([cle, { tours }]) => !tous.has(cle) && tours.size === R)
    .map(([, { participant, table }]) => ({ participant, table }))
    .sort((a, b) => a.participant - b.participant || a.table - b.table);
}

/**
 * Les titres d'une table et ceux qu'une réservation « tous les tours »
 * pourvoit pour la soirée (§ 2.1 étape 6) ; deux titres sur une même place
 * comptent deux.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {number} idTable
 * @returns {{titres: number, pourvus: number}}
 */
export function comptesTitres(charge, idTable) {
  const pourvoyeurs = pourvoyeursDesTitres(charge);
  const rangs = charge.titres.flatMap(({ table }, rang) => (table === idTable ? [rang] : []));
  return { titres: rangs.length, pourvus: rangs.filter((rang) => pourvoyeurs[rang].soiree !== null).length };
}

/**
 * Les personnes que le placement retenu laisse en réserve (le travail
 * qu'un changement de présence laisse : les arrivantes à placer), chacune
 * avec les tours où il la réserve, croissants ; par identifiant croissant.
 * Un tour ne compte que pour une personne de la charge, non exclue et
 * présente à ce tour, et que s'il est un tour de la soirée (1 à R) : un
 * retenu en dérive ne propose de placer ni une exclue, ni une supprimée,
 * ni une absente. [] sans retenu, et pour un retenu qui se contredit, que
 * rien ne sert à retoucher. La charge n'est pas modifiée.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {Array<{participant: number, tours: number[]}>}
 */
export function enReserveDansLeRetenu(charge) {
  const { retenu } = charge;
  if (retenu === null || fautes(retenu).length > 0) return [];
  const personneDe = new Map(charge.participants.filter(({ exclu }) => !exclu).map((personne) => [personne.id, personne]));
  const toursDe = new Map();
  retenu.placement.slice(0, charge.evenement.tours).forEach(({ reserve }, rang) => {
    const tour = rang + 1;
    for (const id of reserve) {
      const personne = personneDe.get(id);
      if (personne === undefined || !estPresentAuTour(personne, tour)) continue;
      if (!toursDe.has(id)) toursDe.set(id, []);
      toursDe.get(id).push(tour);
    }
  });
  return [...toursDe.entries()]
    .map(([participant, tours]) => ({ participant, tours }))
    .sort((a, b) => a.participant - b.participant);
}
