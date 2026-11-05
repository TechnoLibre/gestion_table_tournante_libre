// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les inclusions d'un placement (§ 5.4, § 5.8, § 7.5, § 12.15), pures : la
// vue « Inclusions » de la page de qualité (VueInclusions.svelte), la liste
// de travail du plan (ListesTravail.svelte), la rubrique « Inclusions du
// placement » de la fiche et la colonne du même nom de la grille les
// rendent. Rien ne se mesure ici : tout se lit dans les inclusions nommées
// d'une ligne de la table d'évaluation (evaluation, propositions/modele.js)
// ou du détail du placement (detaillerQualite), chaque personne par son
// identifiant, et dans les inclusions hors d'atteinte du diagnostic.
//
// Un avis est une rencontre demandée que le placement ne fait pas, dans
// l'ordre de la mesure : la personne qui le porte, la personne incluse ou
// l'organisation incluse, et reciproque quand les deux personnes de la
// paire la demandent, qui n'en font qu'un. Une personne dont la liste
// dépasse ce qu'elle peut rencontrer n'en porte aucun : ses inclusions
// atteignables moins ses inclusions satisfaites disent combien en restent
// possibles sans être atteintes, une information. Une inclusion hors
// d'atteinte n'est jamais un avis : sa raison dit pourquoi aucun placement
// ne la satisfait.
import { evaluation } from '../propositions/modele.js';

/** Le critère des inclusions, sous son nom du registre (§ 5.7). */
const CRITERE = 'inclusionsNonSatisfaites';

/** Les raisons d'une inclusion hors d'atteinte (§ 4), dans l'ordre où la
 *  configuration les éprouve. */
export const RAISONS = Object.freeze(['exclue', 'sansPresent', 'conflit', 'sansTourCommun', 'tablesImposees', 'pleine']);

/**
 * La clé du texte d'une raison de RAISONS.
 *
 * @param {string} raison
 * @returns {string}
 * @throws {RangeError} une autre raison
 */
export function cleDeRaison(raison) {
  if (!RAISONS.includes(raison)) throw new RangeError(`raison inconnue : ${JSON.stringify(raison)}`);
  return `qualite.inclusions.raison.${raison}`;
}

// Une cible nommée : {sorte: 'participant', id, nom} ou {sorte:
// 'organisation', nom}, le libellé de l'organisation pour nom.
const cibleNommee = (cible, nommer) =>
  Object.hasOwn(cible, 'organisation')
    ? { sorte: 'organisation', nom: cible.organisation }
    : { sorte: 'participant', id: cible.participant, nom: nommer(cible.participant) };

/**
 * Un avis nommé, pour une phrase : source, la personne qui le porte, {id,
 * nom} ; cible, nommée ({sorte, id?, nom}) ; reciproque recopié.
 *
 * @param {{participant: number, cible: {participant: number}|{organisation: string}, reciproque: boolean}} avis
 *        un avis d'InclusionsNommees ; partenaire n'est pas lu
 * @param {(id: number) => string|null} nommer   le nom affiché d'une personne
 */
export function avisNomme({ participant, cible, reciproque }, nommer) {
  return { source: { id: participant, nom: nommer(participant) }, cible: cibleNommee(cible, nommer), reciproque };
}

// Une inclusion hors d'atteinte nommée : sa source, sa cible et sa raison.
const horsDAtteinteNommee = ({ participant, cible, raison }, nommer) => ({
  source: { id: participant, nom: nommer(participant) },
  cible: cibleNommee(cible, nommer),
  raison,
});

/**
 * Les personnes au-delà de leur plafond (§ 5.4) dans des inclusions
 * nommées, par identifiant croissant : chacune {id, nom, actives, besoin,
 * plafond, atteignables, satisfaites, possibles}, possibles valant ses
 * inclusions atteignables moins ses satisfaites — celles qui restent
 * possibles sans que le placement les atteigne.
 *
 * @param {{parPersonne: Array<Object>}} inclusions   InclusionsNommees
 * @param {(id: number) => string|null} nommer
 */
export function auDelaDuPlafond({ parPersonne }, nommer) {
  return parPersonne
    .filter(({ auDelaDuPlafond: auDela }) => auDela)
    .map(({ participant, actives, besoin, plafond, atteignables, satisfaites }) => ({
      id: participant,
      nom: nommer(participant),
      actives,
      besoin,
      plafond,
      atteignables,
      satisfaites,
      possibles: atteignables - satisfaites,
    }));
}

/**
 * Le modèle de la vue « Inclusions » de la page de qualité (§ 12.15), ou ce
 * qui la remplace.
 *
 * - null sans détail mesuré ;
 * - {cas: 'aucun', horsDAtteinte} sans inclusion active : le critère est
 *   sans objet, et la vue cède la place à sa phrase (§ 12.6), suivie des
 *   inclusions hors d'atteinte quand les listes en portent ;
 * - sinon {cas: 'inclusions', synthese, avis, auDela, horsDAtteinte} :
 *   synthese, {avis, cible}, les rencontres demandées que le placement ne
 *   fait pas sur celles qui font les avis ; avis, chaque avis nommé
 *   (avisNomme), à place fixe en tête, dans l'ordre de la mesure ; auDela,
 *   les personnes au-delà de leur plafond (auDelaDuPlafond).
 *
 * horsDAtteinte, dans les deux cas, chaque inclusion hors d'atteinte du
 * diagnostic, {source, cible, raison}, dans son ordre. Elle et auDela sont
 * des informations, jamais des avis.
 *
 * @param {Object|null} detail   le détail du placement (detaillerQualite)
 * @param {(id: number) => string|null} nommer   le nom affiché d'une
 *        personne de la charge, exclue comprise
 */
export function modeleInclusions(detail, nommer) {
  if (detail === null) return null;
  const { inclusions, inclusionsHorsDAtteinte } = detail;
  const horsDAtteinte = inclusionsHorsDAtteinte.map((ligne) => horsDAtteinteNommee(ligne, nommer));
  if (inclusions === null) return { cas: 'aucun', horsDAtteinte };
  return {
    cas: 'inclusions',
    synthese: { avis: inclusions.avis, cible: inclusions.cible },
    avis: inclusions.nonSatisfaites.map((avis) => avisNomme(avis, nommer)),
    auDela: auDelaDuPlafond(inclusions, nommer),
    horsDAtteinte,
  };
}

/**
 * Les inclusions du placement que le plan montre, la source de la page de
 * qualité : la proposition demandée au plan quand la liste la porte, sinon
 * le retenu, sinon aucun, comme sourceQualite (source.js) le choisit. La
 * ligne se lit dans la table d'évaluation de la charge, la même que le
 * tableau des propositions écrit.
 *
 * Rend {statut, source, inclusions} : statut,
 * - sansPlacement : ni proposition demandée que la liste porte, ni retenu ;
 * - sansObjet : aucune inclusion n'est active, le critère est sans objet ;
 * - nonMesurable : le placement est en dérive ou fautif, ou la
 *   configuration ne se normalise pas ;
 * - mesuree : inclusions porte les inclusions nommées de sa ligne
 *   d'évaluation (InclusionsNommees) ;
 * source, l'identifiant de la proposition ou 'retenu', null sans
 * placement ; inclusions, null hors de mesuree. Ne modifie pas la charge.
 *
 * @param {Object} charge   la charge de l'état observable de la séance
 * @param {number|null} demandee   la proposition demandée au plan (ui.proposition)
 * @returns {{statut: 'sansPlacement'|'sansObjet'|'nonMesurable'|'mesuree',
 *            source: number|'retenu'|null, inclusions: Object|null}}
 */
export function inclusionsDuPlacement(charge, demandee) {
  let source = null;
  if (demandee !== null && charge.propositions.some(({ id }) => id === demandee)) source = demandee;
  else if (charge.retenu !== null) source = 'retenu';
  const rendu = (statut, inclusions = null) => ({ statut, source, inclusions });
  if (source === null) return rendu('sansPlacement');
  const { table } = evaluation(charge);
  if (table === null) return rendu('nonMesurable');
  if (table.criteres.find(({ nom }) => nom === CRITERE).sansObjet) return rendu('sansObjet');
  const ligne = source === 'retenu' ? table.retenu : table.propositions.find(({ id }) => id === source);
  if (ligne.statut !== 'comparable') return rendu('nonMesurable');
  return rendu('mesuree', ligne.inclusions);
}

/**
 * Ce que les inclusions d'un placement disent d'une personne, pour sa fiche
 * et sa ligne de la grille : compte, {actives, satisfaites}, ses inclusions
 * actives et celles que le placement satisfait, null quand elle n'en porte
 * aucune ; auDela, ses chiffres au-delà du plafond (auDelaDuPlafond), null
 * quand sa liste n'y est pas ; avis, chaque avis qui la concerne, nommé
 * (avisNomme), dans l'ordre de la mesure : celui qu'elle porte, celui dont
 * elle est la personne incluse, et la rencontre qu'elle demande aussi
 * quand l'autre personne la porte par une ligne d'organisation, dont elle
 * est le partenaire ; autres, pour chacun, l'autre partie nommée — la
 * personne incluse ou l'organisation pour un avis qu'elle porte, la
 * personne qui le porte sinon.
 *
 * @param {Object} inclusions   InclusionsNommees d'une ligne mesurée
 * @param {number} id           l'identifiant de la personne
 * @param {(id: number) => string|null} nommer
 */
export function inclusionsDePersonne(inclusions, id, nommer) {
  const ligne = inclusions.parPersonne.find(({ participant }) => participant === id) ?? null;
  const siens = inclusions.nonSatisfaites.filter(
    ({ participant, cible, partenaire, reciproque }) => participant === id || cible.participant === id || (reciproque && partenaire === id),
  );
  const avis = siens.map((element) => avisNomme(element, nommer));
  return {
    compte: ligne === null ? null : { actives: ligne.actives, satisfaites: ligne.satisfaites },
    auDela: ligne === null || !ligne.auDelaDuPlafond ? null : auDelaDuPlafond({ parPersonne: [ligne] }, nommer)[0],
    avis,
    autres: avis.map(({ source, cible }) => (source.id === id ? cible : { sorte: 'participant', id: source.id, nom: source.nom })),
  };
}

/**
 * Les inclusions hors d'atteinte d'une personne, d'une sorte, lues dans
 * celles du diagnostic (§ 5.6) : chaque cible nommée et sa raison, dans
 * l'ordre du diagnostic — l'information que sa fiche pose sous chacune de
 * ses deux listes.
 *
 * @param {Array<{participant: number, cible: Object, raison: string}>} horsDAtteinte
 * @param {number} id
 * @param {'organisation'|'participant'} sorte
 * @param {(id: number) => string|null} nommer
 */
export function horsDAtteinteDePersonne(horsDAtteinte, id, sorte, nommer) {
  return horsDAtteinte
    .filter(({ participant, cible }) => participant === id && Object.hasOwn(cible, sorte))
    .map((ligne) => horsDAtteinteNommee(ligne, nommer));
}
