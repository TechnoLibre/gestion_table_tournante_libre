// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La correspondance d'une personne à un objectif de table (§ 4.5, D18) : la
// seule fonction qui la décide. Le moteur, les avis de l'application et
// l'import la lisent ; aucune autre arithmétique de la correspondance n'existe.
//
// Les étiquettes se comparent par égalité de chaînes, comme les
// organisations (§ 5.2) : la forme et la réconciliation des orthographes se
// font à l'entrée (src/stockage/etiquettes.js, src/csv/etiquettes.js), et
// deux orthographes qu'un fichier retouché à la main porterait restent deux
// étiquettes ici.

/**
 * Vrai quand la personne qui porte ces étiquettes correspond à l'objectif
 * selon sa règle : « ou », au moins une des étiquettes de l'objectif ; « et »,
 * chacune d'elles. Une personne sans étiquette ne correspond à aucun
 * objectif, et un objectif sans étiquette n'attend personne, sous l'une et
 * l'autre règle : « toutes » d'une liste vide ne fait correspondre personne.
 *
 * La règle est résolue : un objectif qui suit le défaut de l'événement
 * (regle nulle dans la charge) reçoit la règle par défaut avant l'appel.
 * Lève RangeError pour toute autre règle que 'ou' et 'et'. Ne modifie pas ce
 * qu'elle reçoit.
 *
 * @param {readonly string[]} etiquettes  les étiquettes de la personne
 * @param {{regle: 'ou'|'et', etiquettes: readonly string[]}} objectif
 * @returns {boolean}
 */
export function correspondA(etiquettes, { regle, etiquettes: visees }) {
  if (regle !== 'ou' && regle !== 'et') {
    throw new RangeError(`règle d'objectif ${String(regle)} : 'ou' ou 'et' attendu`);
  }
  if (etiquettes.length === 0 || visees.length === 0) return false;
  const portee = (motCle) => etiquettes.includes(motCle);
  return regle === 'ou' ? visees.some(portee) : visees.every(portee);
}
