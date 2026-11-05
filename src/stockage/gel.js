// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le gel en profondeur, et le registre de ce qu'il a gelé. Un objet inscrit
// au registre est gelé, et tout ce qu'il atteint l'est aussi : figer
// n'inscrit un objet qu'une fois chacun de ses enfants gelé et inscrit, puis
// lui-même gelé. Un cache gardé par l'identité d'un objet inscrit ne sert donc
// jamais une valeur périmée, puisque rien de ce que l'objet atteint ne change
// plus. Object.isFrozen ne prouve qu'un gel de surface : un objet gelé
// ailleurs, par Object.freeze seul, n'entre pas au registre, et figer le
// parcourt comme un autre.
//
// Le registre est un WeakSet : il ne retient aucun objet, et ne s'itère pas.
// Les clés d'un objet se parcourent par clesRangees, le seul parcours de clés
// admis du stockage ; l'ordre n'y décide d'ailleurs de rien, puisque figer ne
// rend que la valeur reçue.
import { clesRangees } from './document.js';

const FIGES = new WeakSet();

/**
 * Gèle valeur et tout ce qu'elle atteint, les enfants avant le parent, puis
 * la rend. Un objet déjà inscrit se garde tel quel, sans parcours : partager
 * un sous-arbre figé ne coûte rien. Une valeur qui n'est pas un objet se rend
 * telle quelle. Le parcours suit les éléments d'un tableau et les clés propres
 * énumérables d'un objet : valeur est une donnée sans cycle, comme le JSON
 * qu'elle décrit. Une exception levée en cours de parcours laisse inscrits les
 * seuls sous-arbres achevés, jamais un objet dont un enfant reste libre.
 *
 * @template T
 * @param {T} valeur
 * @returns {T}
 */
export function figer(valeur) {
  if (valeur === null || typeof valeur !== 'object' || FIGES.has(valeur)) return valeur;
  if (Array.isArray(valeur)) for (const element of valeur) figer(element);
  else for (const cle of clesRangees(valeur)) figer(valeur[cle]);
  Object.freeze(valeur);
  FIGES.add(valeur);
  return valeur;
}

/**
 * Vrai quand figer a figé x : rien de ce que x atteint ne change plus. Faux
 * pour toute valeur qui n'est pas un objet.
 *
 * @param {unknown} x
 * @returns {boolean}
 */
export const estFigee = (x) => FIGES.has(x);

/**
 * Fige, en place, chaque proposition objet de charge.propositions, puis rend
 * la charge. Ni la liste ni la charge ne sont gelées : un tableau gelé quitte
 * les chemins rapides du moteur JavaScript pour find, some et slice, et la
 * liste reste celle que les commandes recomposent. Une proposition qui n'est
 * pas un objet se laisse telle quelle, et une liste qui n'est pas un tableau
 * aussi : le refus d'une charge mal formée reste celui de son contrôle.
 *
 * @template {{propositions?: unknown}} C
 * @param {C} charge
 * @returns {C}
 */
export function gelerPropositions(charge) {
  if (Array.isArray(charge.propositions)) for (const proposition of charge.propositions) figer(proposition);
  return charge;
}

/**
 * Copie de travail d'une charge : l'égale de structuredClone(charge), clés
 * dans le même ordre à toute profondeur, qui partage les propositions figées
 * au lieu de les recopier. Tout le reste est neuf, la liste des propositions
 * comprise, et se modifie sans toucher la charge reçue.
 *
 * Un seul structuredClone recopie la charge, chaque proposition figée
 * remplacée par null dans une liste intermédiaire ; chacune reprend ensuite
 * sa place, même objet. Les alias que structuredClone garde se gardent donc
 * aussi : deux références au même objet libre restent deux références à sa
 * seule copie, et une proposition figée répétée reste un seul objet. Une
 * liste de propositions qui n'est pas un tableau se recopie comme le reste.
 *
 * @template {{propositions?: unknown}} C
 * @param {C} charge
 * @returns {C}
 */
export function copieDeTravail(charge) {
  const { propositions } = charge;
  if (!Array.isArray(propositions)) return structuredClone(charge);
  const copie = structuredClone({ ...charge, propositions: propositions.map((p) => (estFigee(p) ? null : p)) });
  propositions.forEach((p, rang) => {
    if (estFigee(p)) copie.propositions[rang] = p;
  });
  return copie;
}
