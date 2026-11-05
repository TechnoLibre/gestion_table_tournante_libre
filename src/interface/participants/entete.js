// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// L'en-tête de la liste des participants, pur : la ligne de comptes de la
// carte, la légende des organisations et celle des étiquettes. Toutes se
// lisent sur la liste entière, exclues comprises — la population de
// l'attribution des teintes (teintesOrganisations, organisations.js) — : un
// filtre ne change ni un compte ni une teinte. Seul le compte des présences
// partielles laisse les exclues : leur présence, suspendue, ne dit rien de
// la soirée. Aucune fonction ne modifie ce qu'elle reçoit.

import { cleNormalisee } from '../../application/csv.js';
import { comparerPointsDeCode } from '../../application/planche.js';
import { presenceSaisie } from '../../application/places.js';

/**
 * La ligne de comptes de la carte des participants.
 *
 * @param {Array<{organisation: string|null, exclu: boolean, presence?: readonly number[]}>} participants
 *   tous ceux de l'événement
 * @returns {{personnes: number, aPlacer: number, exclues: number, organisations: number, partielles: number}}
 *   les personnes, celles que le placement assoit — les non exclues —, les
 *   exclues, les organisations distinctes par égalité de chaîne, comme le
 *   moteur les distingue, et les présences partielles : les non exclues
 *   dont la présence ne couvre pas toute la soirée (presenceSaisie non null)
 */
export function comptesEntete(participants) {
  const organisations = new Set();
  let exclues = 0;
  let partielles = 0;
  for (const personne of participants) {
    if (personne.exclu) exclues += 1;
    else if (presenceSaisie(personne) !== null) partielles += 1;
    if (personne.organisation !== null) organisations.add(personne.organisation);
  }
  return { personnes: participants.length, aPlacer: participants.length - exclues, exclues, organisations: organisations.size, partielles };
}

/**
 * La légende des organisations : une entrée par organisation de teintes,
 * dans l'ordre de la Map, avec le nombre de personnes de participants qui
 * la portent. Une organisation que personne ne porte dans participants n'y
 * figure pas.
 *
 * @param {Array<{organisation: string|null}>} participants
 * @param {Map<string, number|null>} teintes  celles de teintesOrganisations,
 *        calculées sur la liste entière
 * @returns {Array<{nom: string, rang: number|null, compte: number}>}
 */
export function legendeOrganisations(participants, teintes) {
  const comptes = new Map();
  for (const { organisation } of participants) {
    if (organisation !== null) comptes.set(organisation, (comptes.get(organisation) ?? 0) + 1);
  }
  const legende = [];
  for (const [nom, rang] of teintes) {
    if (comptes.has(nom)) legende.push({ nom, rang, compte: comptes.get(nom) });
  }
  return legende;
}

/**
 * La légende des étiquettes (§ 10.2) : une entrée par étiquette portée,
 * avec le nombre de personnes qui la portent, exclues comprises. Deux
 * orthographes sont deux étiquettes, comme pour le moteur (§ 4.5) ; elles
 * se rangent comme les organisations : par clé normalisée (§ 10.1),
 * comparée point de code par point de code, puis par leur chaîne. L'ordre
 * ne dépend donc pas de celui de la liste. Vide quand personne ne porte
 * d'étiquette : la section ne montre alors aucune légende.
 *
 * @param {Array<{etiquettes?: string[]}>} participants  tous ceux de
 *   l'événement
 * @returns {Array<{nom: string, compte: number}>}
 */
export function legendeEtiquettes(participants) {
  const comptes = new Map();
  for (const { etiquettes = [] } of participants) {
    for (const motCle of new Set(etiquettes)) comptes.set(motCle, (comptes.get(motCle) ?? 0) + 1);
  }
  return [...comptes]
    .map(([nom, compte]) => ({ nom, compte, cle: cleNormalisee(nom) }))
    .sort((a, b) => comparerPointsDeCode(a.cle, b.cle) || comparerPointsDeCode(a.nom, b.nom))
    .map(({ nom, compte }) => ({ nom, compte }));
}
