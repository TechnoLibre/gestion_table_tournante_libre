// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le départ d'une génération dérivée dans la section de la génération
// (§ 5.7, C6), pur : SectionGeneration.svelte et Depart.svelte le câblent.
//
// La carte du départ se lit dans l'état de navigation (depart, celui
// qu'etat_ui.js tient) et dans le nombre de tours de la charge : le numéro
// du départ, une case par tour de la soirée, cochée pour un tour figé, et
// le libellé que prend « Générer » sous lui. Choisir le départ et cocher un
// tour n'écrivent rien ; que le départ soit encore dans la liste, comparable,
// et que ses tours tiennent dans la soirée, se juge au lancement
// (application/depart.js, refusDuDepart).
//
// L'issue d'une génération se lit dans ce que generation.generer rend et
// dans la table d'évaluation de la charge : la meilleure dérivée est la
// première que l'ordre du classement de la table range, et chaque place est
// le rang que cet ordre lui donne. Rien ne s'y trie ni ne s'y recompte.

/**
 * La carte du départ.
 *
 * @param {{evenement: {tours: number}}} charge
 * @param {null|{id: number, toursFiges: readonly number[]}} depart  le départ
 *        de l'état de navigation
 * @returns {null|{depart: number, cases: Array<{tour: number, coche: boolean}>,
 *   commande: {cle: string, nom: string, details: {depart: number}}}}
 *   null sans départ ; sinon le numéro du départ, une case par tour de 1 au
 *   nombre de tours de la charge — un tour figé au-delà n'a pas de case —, et
 *   la commande de lancement, « Générer depuis n° X »
 */
export function carteDuDepart(charge, depart) {
  if (depart === null) return null;
  const cases = Array.from({ length: charge.evenement.tours }, (_, rang) => ({
    tour: rang + 1,
    coche: depart.toursFiges.includes(rang + 1),
  }));
  return {
    depart: depart.id,
    cases,
    commande: { cle: 'generation.commande.genererDepuis', nom: 'genererDepuis', details: { depart: depart.id } },
  };
}

// La place d'un identifiant dans l'ordre du classement, à partir de 1 ; null
// quand le classement ne le range pas.
function placeDans(ordre, id) {
  const indice = ordre.indexOf(id);
  return indice === -1 ? null : indice + 1;
}

/**
 * L'issue d'une génération, telle que la section l'écrit.
 *
 * Sans départ, ou quand rien n'est ajouté sans que toutes les propositions
 * calculées égalent le départ, l'issue d'une génération ordinaire :
 * generation.issue.ajoutees {ajoutees, identiques}. Quand toutes les
 * propositions calculées — ajoutées et identiques réunies — égalent leur
 * départ : generation.issue.departSansReprise {depart}. Sinon
 * generation.issue.derivee : les propositions ajoutées, la meilleure, sa
 * place et celle du départ, et la paire à comparer, offerte quand la
 * meilleure et le départ sont tous deux classés.
 *
 * @param {Object|null} table  la table d'évaluation de la charge
 *        (evaluation(charge).table), null quand la mesure refuse la
 *        configuration ; seul l'ordre de son classement est lu
 * @param {{ajoutees: number[], identiques: number, identiquesAuDepart: number,
 *   depart: null|{id: number, toursFiges: number[]}}} rendu  ce que rend
 *        generation.generer ; ajoutees croissants
 * @returns {{cle: string, details: Object, comparer: null|{a: number, depart: number}}}
 */
export function issueDerivee(table, rendu) {
  const { ajoutees, identiques, identiquesAuDepart, depart } = rendu;
  if (depart !== null && identiquesAuDepart === ajoutees.length + identiques) {
    return { cle: 'generation.issue.departSansReprise', details: { depart: depart.id }, comparer: null };
  }
  if (depart === null || ajoutees.length === 0) {
    return { cle: 'generation.issue.ajoutees', details: { ajoutees: ajoutees.length, identiques }, comparer: null };
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
    },
    comparer: meilleure === null || placeDepart === null ? null : { a: meilleure, depart: depart.id },
  };
}
