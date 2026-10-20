// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les libellés de la liste d'accueil et de la feuille par table imprimées
// (§ 11.7) : titres, en-têtes de bloc de tours, têtes de colonnes,
// places. Chaque clé commence par « feuilles. ». Un numéro de table, de
// siège ou de tour entre dans le texte ; une donnée de la charge — nom,
// prénom, appartenance, libellé d'un titre — n'entre dans aucun : la vue la
// pose dans son propre nœud.
export const TABLE = new Map([
  // --- Les têtes de colonnes communes ----------------------------------------
  ['feuilles.tour', ({ tour }) => `Tour ${tour}`],

  // --- La liste d'accueil ------------------------------------------------------
  ['feuilles.accueil.titre', "Liste d'accueil"],
  ['feuilles.accueil.nom', 'Nom'],
  ['feuilles.accueil.prenom', 'Prénom'],
  ['feuilles.accueil.appartenance', 'Appartenance'],
  ['feuilles.accueil.table', ({ table }) => `Table ${table}`],
  ['feuilles.accueil.tableSiege', ({ table, siege }) => `Table ${table}, siège ${siege}`],
  ['feuilles.accueil.reserve', 'Réserve'],
  // Un tour où la personne est absente : ni table, ni siège, ni réserve.
  ['feuilles.accueil.absente', 'absente'],
  // L'en-tête d'un bloc de tours consécutifs, quand les tours ne tiennent
  // pas tous côte à côte : « Tours 1 à 34 », « Tour 7 » pour un seul.
  ['feuilles.accueil.tours', ({ premier, dernier }) => (premier === dernier ? `Tour ${premier}` : `Tours ${premier} à ${dernier}`)],

  // --- La feuille par table ----------------------------------------------------
  ['feuilles.tables.titre', ({ table }) => `Table ${table}`],
  ['feuilles.tables.place', 'Place'],
  ['feuilles.tables.vide', 'Place vide'],
  ['feuilles.tables.titreNonPourvu', '(titre non pourvu)'],
  ['feuilles.tables.aucune', 'Aucune table'],
]);
