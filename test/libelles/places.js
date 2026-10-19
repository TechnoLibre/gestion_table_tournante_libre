// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les exemples des textes de src/application/libelles/places.js, que
// src/application/libelles.test.js réunit. EXEMPLES porte, pour chaque code
// dont cette table a le texte, une paire [code, détails] dont le texte se
// compose une fois ; un code n'a d'exemple que dans le fichier de sa table.
// TEXTES porte des triplets [code, détails, texte attendu], composés mot
// pour mot. Les noms sont inventés.

export const EXEMPLES = [
  // Places : refus d'une pose, titres, réservations, retenu
  ['SIEGE_INEXISTANT', { table: 2, siege: 9, capacite: 8, remede: null }],
  ['DEUX_PLACES_MEME_TOUR', { participant: 1, tour: 2, autre: { table: 1, siege: null, portee: 'tous', tour: null }, remede: null }],
  ['PERSONNE_EXCLUE', { participant: 3, remede: null }],
  ['PLACE_RESERVEE', { table: 2, siege: 3, tour: 2, titulaire: 2, portee: 'tour', remede: null }],
  ['RESERVEE_AILLEURS', { participant: 1, tour: 2, reservation: { table: 1, siege: null, portee: 'tous', tour: null }, remede: null }],
  ['TABLE_GELEE', { table: 1 }],
  ['LIBELLE_VIDE', { remede: null }],
  ['PLACE_TITREE', { table: 3, siege: 1, libelle: 'accueil', remede: null }],
  ['AUCUN_SIEGE_SANS_TITRE', { table: 1, capacite: 2, remede: null }],
  ['TITRE_ABSENT', { table: 3, siege: 1, remede: null }],
  ['RESERVATION_ABSENTE', { participant: 1, table: 3, portee: 'tour', tour: 2, remede: null }],
  ['CONVERSION_IMPOSSIBLE', { participant: 1, table: 3, remede: null }],
  ['PROPOSITION_MONTREE', { proposition: 4, remede: null }],
  ['SIEGE_OCCUPE', { table: 5, siege: 2, tour: 1, occupant: 2, remede: null }],
  ['TABLE_PLEINE', { table: 5, tour: 1, capacite: 6, remede: null }],
  ['RESERVATION_TOUS_LES_TOURS', { participant: 1, table: 3, remede: null }],
  ['RESERVATION_CE_TOUR', { participant: 1, table: 3, tour: 2, remede: null }],
  ['ENTREE_RESERVER', { personne: 'Théo Pervenche', numero: 4, siege: 2, portee: 'tour', tour: 2 }],
  ['ENTREE_RETIRER_RESERVATION', { personne: 'Théo Pervenche', numero: 4, portee: 'tous', tour: null }],
  ['ENTREE_DEPLACER_RESERVATION', { personne: 'Théo Pervenche', de: 4, vers: 7, siege: null, portee: 'tour', tour: 2 }],
  ['ENTREE_POSER_TITRE', { libelle: 'accueil', numero: 3, siege: 1 }],
  ['ENTREE_RETIRER_TITRE', { libelle: 'accueil', numero: 3, siege: 1 }],
  ['ENTREE_DESIGNER', { personne: 'Iris Ombrelle', numero: 3, siege: 1, libelle: 'accueil' }],
  ['ENTREE_CONVERTIR_EN_TOUS', { personne: 'Iris Ombrelle', numero: 3 }],
  ['ENTREE_DEPLACER_DANS_RETENU', { personne: 'Iris Ombrelle', de: 4, vers: 7, siege: null, tour: 2 }],
  ['ENTREE_ECHANGER_DANS_RETENU', { a: 'Iris Ombrelle', deA: 4, b: 'Théo Pervenche', deB: null, tour: 2 }],
  ['ENTREE_RETIRER_DU_TOUR', { personne: 'Iris Ombrelle', numero: 4, tour: 2 }],
];

export const TEXTES = [];
