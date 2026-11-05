// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le modèle pur de la saisie des conflits d'organisation d'une personne
// (§ 4, § 10.2), que câblent la grille (Grille.svelte), la fiche
// (Fiche.svelte) et leur éditeur à choix multiple (ChoixMultiple.svelte). Il
// ne lit aucune règle : changerConflits décide seule de ce qu'elle admet, et
// la liste offerte se tire des organisations que l'appelant lit dans la
// charge.
//
// Une saisie est le texte canonique d'une liste d'organisations : la liste
// rangée par unités de code, sans doublon, écrite en JSON, '[]' pour aucune.
// Deux listes égales ont la même saisie : la machine de champ
// (primitives/champ.js) reconnaît ainsi « rien de changé » à l'égalité de
// deux chaînes, et cocher puis décocher une organisation ne valide rien. Le
// JSON garde chaque nom entier, quels que soient les signes qu'il porte.
// Aucune fonction ne modifie ce qu'elle reçoit.

// Deux chaînes, comparées unité UTF-16 par unité : l'ordre du fichier.
const comparerTextes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// La liste d'une saisie, rangée.
const listeDeSaisie = (saisie) => JSON.parse(saisie);

/**
 * La saisie canonique d'une liste d'organisations.
 *
 * @param {string[]} noms   dans un ordre quelconque, doublons admis
 * @returns {string}
 */
export function saisieDeConflits(noms) {
  return JSON.stringify([...new Set(noms)].sort(comparerTextes));
}

/**
 * La saisie des conflits enregistrés d'une personne : sa liste, la liste vide
 * quand le champ manque.
 *
 * @param {{conflits?: readonly string[]}} personne
 * @returns {string}
 */
export function saisieConflitsEnregistree(personne) {
  return saisieDeConflits(personne.conflits ?? []);
}

/**
 * La lecture d'une saisie, celle que creerMachineChamp reçoit pour lire : {
 * valeur } avec sa liste, vide comprise. Elle ne refuse jamais : les
 * commandes jugent chaque organisation.
 *
 * @param {string} texte
 * @returns {{valeur: string[]}}
 */
export function lectureConflits(texte) {
  return { valeur: listeDeSaisie(texte) };
}

/**
 * Les choix d'un éditeur : chaque organisation de l'événement hors propre,
 * celle de la personne, puis chaque nom de la saisie que l'événement ne
 * porte plus, pour qu'il se décoche ; chacun coché quand la saisie le nomme.
 * Rangés par clé normalisée, deux graphies de même clé par unités de code :
 * une organisation se trouve à sa place alphabétique, sans égard à la casse
 * ni aux accents. Rend une liste neuve.
 *
 * @param {string} saisie
 * @param {Iterable<string>} organisations   celles de l'événement
 * @param {string|null} propre   l'organisation de la personne
 * @param {(texte: string) => string} cleNormalisee
 * @returns {Array<{valeur: string, coche: boolean}>}
 */
export function choixDeConflits(saisie, organisations, propre, cleNormalisee) {
  const cochees = new Set(listeDeSaisie(saisie));
  const offertes = new Set([...organisations].filter((nom) => nom !== propre));
  for (const nom of cochees) offertes.add(nom);
  const cles = new Map([...offertes].map((nom) => [nom, cleNormalisee(nom)]));
  return [...offertes]
    .sort((a, b) => comparerTextes(cles.get(a), cles.get(b)) || comparerTextes(a, b))
    .map((valeur) => ({ valeur, coche: cochees.has(valeur) }));
}

/**
 * La saisie après la bascule d'un choix : le nom ajouté quand il se coche,
 * retiré quand il se décoche.
 *
 * @param {string} saisie
 * @param {string} nom
 * @param {boolean} coche
 * @returns {string}
 */
export function saisieApresBasculeConflit(saisie, nom, coche) {
  const autres = listeDeSaisie(saisie).filter((autre) => autre !== nom);
  return saisieDeConflits(coche ? [...autres, nom] : autres);
}

/**
 * La commande qu'exécute une saisie validée : changerConflits de la liste
 * saisie entière, qui pose ajouts et retraits en un geste, une entrée
 * d'historique, quel que soit le nombre d'organisations qui changent.
 *
 * @param {number} id
 * @param {readonly string[]} organisations   la liste saisie
 * @returns {{nom: 'changerConflits', args: {id: number, organisations: string[]}}}
 */
export function commandeDeConflits(id, organisations) {
  return { nom: 'changerConflits', args: { id, organisations: [...organisations] } };
}

/**
 * La valeur de tri d'une liste de conflits : null sans liste ; sinon la clé
 * normalisée de chaque nom, rangées par unités de code, jointes par une fin
 * de ligne, qu'aucune clé ne porte — cleNormalisee réduit chaque blanc à
 * une espace.
 *
 * @param {readonly string[]|undefined} conflits
 * @param {(texte: string) => string} cleNormalisee
 * @returns {string|null}
 */
export function cleTriConflits(conflits, cleNormalisee) {
  if (conflits === undefined) return null;
  return conflits.map(cleNormalisee).sort(comparerTextes).join('\n');
}
