// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le modèle de la page de qualité (§ 12.9, D27, D40), pur :
// SectionQualite.svelte le câble.
//
// Le détail d'un placement se calcule pour lui seul, par detaillerQualite
// (evaluation.js), et se garde sous l'identité de la charge, puis sous
// l'identifiant du placement : une proposition, ou 'retenu'. La charge de
// l'état observable de la séance est figée en profondeur et remplacée par
// une copie neuve à chaque changement — un réglage, un objectif, l'ordre
// des priorités : la charge changée n'est pas dans le cache, et son détail
// se mesure à sa première demande, pour le seul placement que la page
// montre, ses points de relevé remesurés sous ses réglages. Le détail d'une
// charge n'est jamais rendu pour une autre. Une charge qui n'est pas figée
// partout se mesure à chaque demande, son contenu pouvant changer sous la
// même identité. Le cache suit celui de la table d'évaluation
// (propositions/modele.js) : l'exception voulue à la réactivité de Svelte
// (§ 13.3), tenue par l'immuabilité de son entrée.
//
// La séance fournit ce que la charge ne porte pas : la course de la
// recherche, lue dans le compagnon des courses (seance.courseDe), et la
// génération qui a produit la proposition (generationDe du contrôleur de la
// génération). Le détail les lit à sa mesure, une fois par charge.
import { detaillerQualite } from '../../application/evaluation.js';
import { figeePartout } from '../propositions/modele.js';

// Le détail de chaque placement de chaque charge figée partout : charge →
// Map(identifiant → détail).
const details = new WeakMap();

// Fige une valeur neuve et tout ce qu'elle atteint.
function figer(valeur) {
  if (valeur === null || typeof valeur !== 'object' || Object.isFrozen(valeur)) return valeur;
  for (const cle of Object.keys(valeur)) figer(valeur[cle]);
  return Object.freeze(valeur);
}

/**
 * Le détail du placement id de la charge (detaillerQualite), figé en
 * profondeur ; null quand la charge n'a pas ce placement. Pour une charge
 * figée partout, le même objet à chaque demande, mesuré à la première : la
 * course et la génération sont lues à ce moment.
 *
 * @param {Object} charge   la charge de l'état observable de la séance
 * @param {number|'retenu'} id   le placement que la page mesure
 * @param {{courseDe?: ((id: number) => Object|null)|null,
 *          generationDe?: ((id: number) => Object|null)|null}} [seance]
 *        courseDe : seance.courseDe ; generationDe : celui du contrôleur
 *        de la génération ; absents, aucune course ni génération
 * @returns {Object|null}
 */
export function detailDe(charge, id, { courseDe = null, generationDe = null } = {}) {
  const connus = details.get(charge);
  if (connus?.has(id)) return connus.get(id);
  const detail = figer(detaillerQualite(charge, id, { courseDe, generationDe }));
  if (connus !== undefined) connus.set(id, detail);
  else if (figeePartout(charge)) details.set(charge, new Map([[id, detail]]));
  return detail;
}
