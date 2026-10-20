// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les menus d'actions dans les épreuves du navigateur (§ 14.5) : une ligne du
// tableau des propositions, ou tout conteneur, porte un seul menu, que son
// bouton désigne par data-menu-actions. Fermé, le menu n'a aucun élément ;
// une épreuve qui presse une action ouvre donc d'abord le menu, par le clic
// HTML de son bouton, comme l'opérateur. Chaque aide est synchrone : le clic
// se rend par flushSync, et les éléments sont dans le document au retour.
import { flushSync } from 'svelte';

/** Le bouton du menu d'actions du conteneur ; lève quand il n'en porte
 *  aucun, ou plus d'un. */
export function boutonActions(conteneur) {
  const boutons = conteneur.querySelectorAll('[data-menu-actions]');
  if (boutons.length === 0) throw new Error('menus : aucun menu d’actions dans le conteneur');
  if (boutons.length > 1) throw new Error(`menus : ${boutons.length} menus d’actions dans le conteneur, un seul attendu`);
  return boutons[0];
}

/** Ouvre le menu d'actions du conteneur par un clic sur son bouton, sauf
 *  s'il est déjà ouvert, et rend l'élément role="menu" que le bouton
 *  désigne par aria-controls. */
export function ouvrirActions(conteneur) {
  const bouton = boutonActions(conteneur);
  if (bouton.getAttribute('aria-expanded') !== 'true') {
    bouton.click();
    flushSync();
  }
  return conteneur.ownerDocument.getElementById(bouton.getAttribute('aria-controls'));
}

/** L'élément du menu d'actions du conteneur que désigne nom (data-commande),
 *  le menu ouvert d'abord ; null quand le menu ne l'offre pas. */
export function actionDe(conteneur, nom) {
  return ouvrirActions(conteneur).querySelector(`[role="menuitem"][data-commande="${nom}"]`);
}

/** Les désignations des éléments du menu d'actions du conteneur, dans leur
 *  ordre, le menu ouvert d'abord. */
export function actionsDe(conteneur) {
  return [...ouvrirActions(conteneur).querySelectorAll('[role="menuitem"]')].map((element) => element.dataset.commande);
}
