// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le geste « Comparer » d'une ligne du tableau des propositions (§ 12, C14,
// D56, D58, D85), pur : TableauPropositions.svelte le câble, puis ouvre la
// page de qualité à sa vue de comparaison.
//
// Le premier placement de la vue est la source de la page (sourceQualite,
// qualite/source.js) : la proposition demandée au plan quand la liste l'a,
// sinon le retenu. Le geste se juge donc sur elle, et non sur la seule
// proposition demandée : rien de demandé sous un retenu laisse le retenu en
// premier placement. La ligne devient le second placement quand elle est
// l'un des candidats de cette source (candidatsDeComparaison,
// evaluation.js) ; sinon — aucune source mesurable, la source est la ligne
// même, ou lui est identique : un retenu non ajusté et sa proposition
// d'origine —, la ligne devient la source, et le second placement prend son
// défaut. Le geste ne fait que naviguer : rien ne s'écrit, en lecture comme
// sur un plan bloqué (§ 8.4).
import { candidatsDeComparaison } from '../../application/evaluation.js';

/**
 * Ce que « Comparer » sur une ligne change à l'état de navigation. Ne
 * modifie rien.
 *
 * @param {Object} charge   la charge de l'état observable de la séance
 * @param {import('../../application/evaluation.js').TableEvaluation} table
 *        la table d'évaluation de la charge
 * @param {{source: ReturnType<import('../qualite/source.js').sourceQualite>,
 *          cible: number|'retenu'}} geste
 *   source : la source de la page de qualité, sourceQualite(charge,
 *   {demandee: ui.proposition}) ; cible : la proposition de la ligne, ou
 *   'retenu' pour la ligne du retenu
 * @returns {{montrer: number|null|undefined, comparee: number|'retenu'|null}}
 *   montrer : la proposition à demander au plan, null pour le retenu,
 *   undefined quand la demande ne change pas ; comparee : le second
 *   placement de la vue, null pour son défaut
 */
export function gesteComparer(charge, table, { source, cible }) {
  const a = source.cas === 'mesurable' ? source.id : null;
  const candidate = a !== null && candidatsDeComparaison(charge, table, a).candidats.some(({ cle }) => cle === cible);
  if (candidate) return { montrer: undefined, comparee: cible };
  return { montrer: cible === 'retenu' ? null : cible, comparee: null };
}
