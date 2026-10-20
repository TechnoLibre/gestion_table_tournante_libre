// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le départ d'une génération dérivée dans la section de la génération
// (§ 5.7, C6), pur : SectionGeneration.svelte et Depart.svelte le câblent.
//
// La carte du départ se lit dans l'état de navigation (depart, celui
// qu'etat_ui.js tient) et dans la charge : le numéro du départ, une case
// par tour de la soirée, cochée pour un tour figé, le libellé que prend
// « Générer » sous lui, puis, avant tout lancement, ce qui sépare le départ
// de la soirée telle qu'elle est. Choisir le départ et cocher un tour
// n'écrivent rien ; que le départ soit encore dans la liste, qu'il serve de
// départ, et que ses tours tiennent dans la soirée, se juge au lancement
// (application/depart.js, refusDuDepart).
//
// Les écarts se lisent dans ecartsDuDepart et ecartAuRetenu
// (application/depart.js), qui seuls les calculent : la carte les range en
// lignes de texte, une par personne, chaque morceau une clé de traduction.
// Un départ comparable n'en a aucun ; un départ en dérive par ses seuls
// participants en a, et la génération part de lui ajusté à la présence.
//
// L'issue d'une génération se lit dans ce que generation.generer rend et
// dans la table d'évaluation de la charge : la meilleure dérivée est la
// première que l'ordre du classement de la table range, et chaque place est
// le rang que cet ordre lui donne. Rien ne s'y trie ni ne s'y recompte.
import { ecartAuRetenu, ecartsDuDepart } from '../../application/depart.js';

/**
 * La carte du départ.
 *
 * @param {Object} charge  la charge de l'événement ouvert
 * @param {null|{id: number, toursFiges: readonly number[]}} depart  le départ
 *        de l'état de navigation
 * @returns {null|{depart: number, cases: Array<{tour: number, coche: boolean}>,
 *   commande: {cle: string, nom: string, details: {depart: number}},
 *   ecarts: Array<{participant: number, nom: {cle: string, details: Object},
 *     morceaux: Array<{cle: string, details: Object}>}>,
 *   ecartRetenu: null|{cle: string, details: {depart: number, tours: number[]}}}}
 *   null sans départ ; sinon le numéro du départ, une case par tour de 1 au
 *   nombre de tours de la charge — un tour figé au-delà n'a pas de case —, la
 *   commande de lancement, « Générer depuis n° X », les lignes des écarts
 *   (lignesDesEcarts), et la phrase de DEPART_ECART_AU_RETENU quand le
 *   retenu, retenu de ce départ, en diffère à un tour figé, null sinon
 */
export function carteDuDepart(charge, depart) {
  if (depart === null) return null;
  const cases = Array.from({ length: charge.evenement.tours }, (_, rang) => ({
    tour: rang + 1,
    coche: depart.toursFiges.includes(rang + 1),
  }));
  const reglage = { id: depart.id, toursFiges: [...depart.toursFiges] };
  const tours = ecartAuRetenu(charge, reglage);
  return {
    depart: depart.id,
    cases,
    commande: { cle: 'generation.commande.genererDepuis', nom: 'genererDepuis', details: { depart: depart.id } },
    ecarts: lignesDesEcarts(charge, ecartsDuDepart(charge, reglage), depart.toursFiges),
    ecartRetenu: tours.length === 0 ? null : { cle: 'DEPART_ECART_AU_RETENU', details: { depart: depart.id, tours } },
  };
}

// Vrai quand la personne a quitté la soirée entière : supprimée, ou exclue.
function quitteLaSoiree(charge, participant) {
  const personne = charge.participants.find(({ id }) => id === participant);
  return personne === undefined || personne.exclu;
}

/**
 * Les lignes des écarts du départ, dans l'ordre d'ecarts : chacune le nom
 * de la personne — generation.depart.personne, qui nomme une supprimée par
 * son identifiant — puis ses morceaux, chacun ouvert par son séparateur, dans
 * cet ordre : retirée (sorties), suivie, pour une exclue ou une supprimée
 * assise à un tour figé, de ses rencontres de ces tours, qui ne comptent
 * plus ; assise à la meilleure chaise libre des tours figés
 * (entreesFigees) ; en réserve imposée, un morceau par tour, avec sa cause
 * (enReserveFigee) ; à asseoir aux tours non figés (entrees). Une liste vide
 * ne donne pas de morceau.
 *
 * @param {Object} charge  la charge de l'événement ouvert
 * @param {ReturnType<typeof ecartsDuDepart>} ecarts
 * @param {readonly number[]} toursFiges
 * @returns {Array<{participant: number, nom: {cle: string, details: Object},
 *   morceaux: Array<{cle: string, details: Object}>}>}
 */
function lignesDesEcarts(charge, ecarts, toursFiges) {
  return ecarts.map(({ participant, personne, entrees, entreesFigees, enReserveFigee, sorties }) => {
    const morceaux = [];
    if (sorties.length > 0) {
      morceaux.push({ cle: 'generation.depart.retiree', details: { tours: sorties } });
      const figees = sorties.filter((tour) => toursFiges.includes(tour));
      if (figees.length > 0 && quitteLaSoiree(charge, participant)) {
        morceaux.push({ cle: 'generation.depart.rencontresFigees', details: { tours: figees } });
      }
    }
    if (entreesFigees.length > 0) morceaux.push({ cle: 'generation.depart.aAsseoirFige', details: { tours: entreesFigees } });
    for (const { tour, cause } of enReserveFigee) morceaux.push({ cle: 'generation.depart.enReserveFige', details: { tour, cause } });
    if (entrees.length > 0) morceaux.push({ cle: 'generation.depart.aAsseoir', details: { tours: entrees } });
    return { participant, nom: { cle: 'generation.depart.personne', details: { personne, participant } }, morceaux };
  });
}

// La place d'un identifiant dans l'ordre du classement, à partir de 1 ; null
// quand le classement ne le range pas.
function placeDans(ordre, id) {
  const indice = ordre.indexOf(id);
  return indice === -1 ? null : indice + 1;
}

/**
 * L'issue d'une génération, telle que la section l'écrit, et les
 * avertissements que la génération rend, chacun {cle, details} : son code
 * et ses détails, tels quels.
 *
 * Sans départ, ou quand rien n'est ajouté sans que toutes les propositions
 * calculées égalent le départ, l'issue d'une génération ordinaire :
 * generation.issue.ajoutees {ajoutees, identiques}. Quand toutes les
 * propositions calculées — ajoutées et identiques réunies — égalent leur
 * départ : generation.issue.departSansReprise {depart}. Sinon
 * generation.issue.derivee : les propositions ajoutées, la meilleure, sa
 * place et celle du départ, et la paire à comparer, offerte quand la
 * meilleure et le départ sont tous deux classés. Un départ en dérive par
 * ses participants (departEnDerive) n'est pas classé : la phrase le dit à la
 * place de son rang, et rien n'est à comparer.
 *
 * @param {Object|null} table  la table d'évaluation de la charge
 *        (evaluation(charge).table), null quand la mesure refuse la
 *        configuration ; seul l'ordre de son classement est lu
 * @param {{ajoutees: number[], identiques: number, identiquesAuDepart: number,
 *   depart: null|{id: number, toursFiges: number[]}, departEnDerive: boolean,
 *   avertissements: Array<{code: string, details: Object}>}} rendu  ce que
 *        rend generation.generer ; ajoutees croissants
 * @returns {{cle: string, details: Object, comparer: null|{a: number, depart: number},
 *   avertissements: Array<{cle: string, details: Object}>}}
 */
export function issueDerivee(table, rendu) {
  const { ajoutees, identiques, identiquesAuDepart, depart } = rendu;
  const avertissements = (rendu.avertissements ?? []).map(({ code, details }) => ({ cle: code, details }));
  if (depart !== null && identiquesAuDepart === ajoutees.length + identiques) {
    return { cle: 'generation.issue.departSansReprise', details: { depart: depart.id }, comparer: null, avertissements };
  }
  if (depart === null || ajoutees.length === 0) {
    return { cle: 'generation.issue.ajoutees', details: { ajoutees: ajoutees.length, identiques }, comparer: null, avertissements };
  }
  const ordre = table === null ? [] : table.classement.ordre;
  const meilleure = ordre.find((id) => ajoutees.includes(id)) ?? null;
  const placeMeilleure = meilleure === null ? null : placeDans(ordre, meilleure);
  const placeDepart = placeDans(ordre, depart.id);
  return {
    cle: 'generation.issue.derivee',
    details: {
      ajoutees: ajoutees.length,
      premier: ajoutees[0],
      dernier: ajoutees.at(-1),
      depart: depart.id,
      meilleure,
      placeMeilleure,
      placeDepart,
      identiques,
      departEnDerive: rendu.departEnDerive === true,
    },
    comparer: meilleure === null || placeDepart === null ? null : { a: meilleure, depart: depart.id },
    avertissements,
  };
}
