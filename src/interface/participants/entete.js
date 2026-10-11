// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'en-tête de la liste des participants, pur : la ligne de comptes de la
// carte et la légende des appartenances. Les deux se lisent sur la liste
// entière, exclues comprises — la population de l'attribution des teintes
// (teintesAppartenances, appartenances.js) — : un filtre ne change ni un
// compte ni une teinte. Aucune fonction ne modifie ce qu'elle reçoit.

/**
 * La ligne de comptes de la carte des participants.
 *
 * @param {Array<{appartenance: string|null, exclu: boolean}>} participants
 *   tous ceux de l'événement
 * @returns {{personnes: number, aPlacer: number, exclues: number, appartenances: number}}
 *   les personnes, celles que le placement assoit — les non exclues —, les
 *   exclues, et les appartenances distinctes par égalité de chaîne, comme
 *   le moteur les distingue
 */
export function comptesEntete(participants) {
  const appartenances = new Set();
  let exclues = 0;
  for (const { appartenance, exclu } of participants) {
    if (exclu) exclues += 1;
    if (appartenance !== null) appartenances.add(appartenance);
  }
  return { personnes: participants.length, aPlacer: participants.length - exclues, exclues, appartenances: appartenances.size };
}

/**
 * La légende des appartenances : une entrée par appartenance de teintes,
 * dans l'ordre de la Map, avec le nombre de personnes de participants qui
 * la portent. Une appartenance que personne ne porte dans participants n'y
 * figure pas.
 *
 * @param {Array<{appartenance: string|null}>} participants
 * @param {Map<string, number|null>} teintes  celles de teintesAppartenances,
 *        calculées sur la liste entière
 * @returns {Array<{nom: string, rang: number|null, compte: number}>}
 */
export function legendeAppartenances(participants, teintes) {
  const comptes = new Map();
  for (const { appartenance } of participants) {
    if (appartenance !== null) comptes.set(appartenance, (comptes.get(appartenance) ?? 0) + 1);
  }
  const legende = [];
  for (const [nom, rang] of teintes) {
    if (comptes.has(nom)) legende.push({ nom, rang, compte: comptes.get(nom) });
  }
  return legende;
}
