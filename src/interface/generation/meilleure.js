// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La meilleure proposition, que la section de la génération annonce en tête
// (§ 5.4, § 5.7), pure : SectionGeneration.svelte la câble.
//
// Elle se lit dans le tableau des propositions, sur la table d'évaluation
// de la charge (evaluation et tableau, propositions/modele.js) : la même
// mesure, le même classement et la même cellule que la section des
// propositions affiche au rang 1 ; aucune valeur ne se recalcule ici. Le
// rang 1 est celui de premiereDuClassement (evaluation.js), la définition
// que la liste des événements lit aussi par resumeDuMeilleur.

import { premiereDuClassement } from '../../application/evaluation.js';
import { COLONNES, evaluation, tableau } from '../propositions/modele.js';

/** La colonne du tableau que l'annonce reprend. */
export const COLONNE_ANNONCEE = 'collisionsCumulees';

/** La clé de l'intitulé de l'annonce : l'en-tête de sa colonne, tel que le
 *  tableau des propositions l'écrit. */
export const CLE_ANNONCEE = COLONNES.find(({ nom }) => nom === COLONNE_ANNONCEE).cle;

/**
 * La proposition au rang 1 du classement, et sa cellule des collisions
 * cumulées.
 *
 * @param {Object} charge  la charge de l'état observable de la séance
 * @returns {null|{id: number, cellule: {colonne: string, valeur: number|null,
 *   cle: string|null, decimales: number}}}  null quand aucune proposition ne
 *   se classe : aucune proposition, aucune comparable — population changée —,
 *   ou une configuration que la mesure refuse ; sinon l'identifiant de la
 *   première ligne du classement et sa cellule, telle que le tableau la porte,
 *   que texteCellule écrit
 */
export function meilleureProposition(charge) {
  const { table } = evaluation(charge);
  if (table === null) return null;
  const premiere = premiereDuClassement(table);
  if (premiere === null) return null;
  const ligne = tableau(table).lignes.find(({ id }) => id === premiere.id);
  return { id: premiere.id, cellule: ligne.cellules.find(({ colonne }) => colonne === COLONNE_ANNONCEE) };
}
