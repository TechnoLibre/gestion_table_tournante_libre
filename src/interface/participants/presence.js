// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le modèle pur de la saisie de la présence par tour, que câblent la grille
// (Grille.svelte), la fiche (Fiche.svelte) et leurs cases
// (CasesPresence.svelte). Il ne lit aucune règle : la présence d'une
// personne vient de presenceSaisie (src/application/places.js), null pour
// tous les tours, et la commande changerPresence décide seule de ce qu'elle
// admet. Les mots viennent des libellés.
//
// Une saisie est le texte canonique d'un ensemble de tours : les tours
// croissants, sans doublon, joints par « , », '' pour aucun. Deux ensembles
// égaux ont la même saisie : la machine de champ (primitives/champ.js)
// reconnaît ainsi « rien de changé » à l'égalité de deux chaînes, et cocher
// puis décocher un tour ne valide rien. Aucune fonction ne modifie ce
// qu'elle reçoit.

import { presenceSaisie } from '../../application/places.js';

// Les tours de 1 à R, croissants.
const lesTours = (tours) => Array.from({ length: tours }, (_, rang) => rang + 1);

// Les tours d'une saisie, croissants ; [] pour la saisie vide.
const toursDeSaisie = (saisie) => (saisie === '' ? [] : saisie.split(',').map(Number));

/**
 * La saisie canonique d'une liste de tours : les tours croissants joints par
 * « , », '' pour aucun.
 *
 * @param {number[]} tours  entiers, dans un ordre quelconque, doublons admis
 * @returns {string}
 */
export function saisieDeTours(tours) {
  return [...new Set(tours)].sort((a, b) => a - b).join(',');
}

/**
 * La lecture d'une saisie canonique pour une soirée de R tours, celle que
 * creerMachineChamp reçoit pour lire : { valeur: null } quand la saisie
 * couvre 1..R (tous les tours, le champ se retire), sinon { valeur } avec la
 * liste de ses tours, vide comprise. Elle ne refuse jamais : une présence
 * vide va à la commande, qui la refuse (PRESENCE_VIDE).
 *
 * @param {number} tours  R, entier ≥ 1
 * @returns {(texte: string) => {valeur: number[]|null}}
 */
export function lecturePresence(tours) {
  const pleine = saisieDeTours(lesTours(tours));
  return (texte) => ({ valeur: texte === pleine ? null : toursDeSaisie(texte) });
}

/**
 * Les cases d'un éditeur : une par tour de 1 à R, cochée quand le tour est
 * dans la saisie. Rend une liste neuve.
 *
 * @param {string} saisie
 * @param {number} tours  R
 * @returns {Array<{tour: number, coche: boolean}>}
 */
export function casesDeSaisie(saisie, tours) {
  const cochees = new Set(toursDeSaisie(saisie));
  return lesTours(tours).map((tour) => ({ tour, coche: cochees.has(tour) }));
}

/**
 * La saisie après la bascule d'une case : le tour ajouté quand elle se
 * coche, retiré quand elle se décoche.
 *
 * @param {string} saisie
 * @param {number} tour
 * @param {boolean} coche
 * @returns {string}
 */
export function saisieApresBascule(saisie, tour, coche) {
  const autres = toursDeSaisie(saisie).filter((autre) => autre !== tour);
  return saisieDeTours(coche ? [...autres, tour] : autres);
}

/**
 * La saisie où chaque tour de 1 à R est coché : « Tous les tours » de la
 * fiche.
 *
 * @param {number} tours  R
 * @returns {string}
 */
export const saisiePleine = (tours) => saisieDeTours(lesTours(tours));

/**
 * La saisie de la présence enregistrée d'une personne : ses tours, chaque
 * tour de 1 à R quand son champ manque. L'exclusion n'est pas lue : la
 * présence d'une exclue, suspendue, reste la sienne.
 *
 * @param {{presence?: readonly number[]}} personne
 * @param {number} tours  R
 * @returns {string}
 */
export function saisieEnregistree(personne, tours) {
  return saisieDeTours(presenceSaisie(personne) ?? lesTours(tours));
}

/**
 * L'affichage d'une présence — cellule, fiche, en-tête de groupe — : la clé
 * de son libellé, ses détails et sa sorte. 'tous' : la clé
 * participants.presence.tous, sans détails ; 'partielle' : la clé
 * participants.presence.tours et ses tours, une liste neuve.
 *
 * @param {number[]|null} presence   celle de presenceSaisie
 * @returns {{cle: string, details: Object, sorte: 'tous'|'partielle'}}
 */
export function affichagePresence(presence) {
  if (presence === null) return { cle: 'participants.presence.tous', details: {}, sorte: 'tous' };
  return { cle: 'participants.presence.tours', details: { tours: [...presence] }, sorte: 'partielle' };
}

/**
 * L'affichage de la présence de chaque personne, par identifiant, dans
 * l'ordre reçu : ce que la grille lit pour ses cellules au repos.
 *
 * @param {Array<{id: number, presence?: readonly number[]}>} personnes
 * @returns {Map<number, {cle: string, details: Object, sorte: 'tous'|'partielle'}>}
 */
export function affichagesPresence(personnes) {
  return new Map(personnes.map((personne) => [personne.id, affichagePresence(presenceSaisie(personne))]));
}

/**
 * La valeur de tri et de groupement d'une présence : '' pour tous, sinon
 * chaque tour sur trois chiffres, joints par « , » ('001,002'). Comparées
 * unité par unité, ces chaînes donnent un ordre total, qui range « tous » en
 * tête dans le sens croissant, puis [1,2] avant [1,3] avant [2].
 *
 * @param {number[]|null} presence   celle de presenceSaisie
 * @returns {string}
 */
export function clePresence(presence) {
  return presence === null ? '' : presence.map((tour) => String(tour).padStart(3, '0')).join(',');
}

/**
 * La case voisine dans un éditeur de R cases, selon l'effet du contexte
 * 'cases' (raccourcis.js) : precedente et suivante passent à la case d'à
 * côté et restent sur place au bord, premiere et derniere vont aux bouts.
 * null pour un autre effet.
 *
 * @param {number} tour     la case qui a le focus
 * @param {string|null} effet
 * @param {number} tours    R
 * @returns {number|null}
 */
export function caseSuivante(tour, effet, tours) {
  switch (effet) {
    case 'precedente':
      return tour > 1 ? tour - 1 : 1;
    case 'suivante':
      return tour < tours ? tour + 1 : tours;
    case 'premiere':
      return 1;
    case 'derniere':
      return tours;
    default:
      return null;
  }
}
