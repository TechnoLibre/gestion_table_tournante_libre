// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le modèle pur de la zone de recherche d'un choix multiple
// (ChoixMultiple.svelte) : les choix qu'une recherche laisse voir. Le
// composant reçoit ses choix tout faits ; la recherche n'en change que la
// part montrée, jamais la saisie, si bien qu'un choix coché que la recherche
// cache reste coché. Aucune fonction ne modifie ce qu'elle reçoit.

/**
 * Les choix que la recherche texte laisse voir, dans l'ordre reçu : ceux dont
 * la clé du texte cherche contient celle de la recherche. Une recherche dont
 * la clé est vide les laisse tous. Rend une liste neuve.
 *
 * @template T
 * @param {Array<{valeur: T, coche: boolean}>} choix
 * @param {string} texte   la recherche saisie
 * @param {(valeur: T) => string} lu   le texte que la recherche lit pour
 *        un choix : le nom seul, sans les marques que son libellé ajoute
 * @param {(texte: string) => string} cle   la clé normalisée
 *        (cleNormalisee, src/application/csv.js)
 * @returns {Array<{valeur: T, coche: boolean}>}
 */
export function choixFiltres(choix, texte, lu, cle) {
  const cherche = cle(texte);
  if (cherche === '') return [...choix];
  return choix.filter(({ valeur }) => cle(lu(valeur)).includes(cherche));
}
