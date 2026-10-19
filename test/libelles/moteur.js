// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les exemples des textes de src/application/libelles/moteur.js, que
// src/application/libelles.test.js réunit. EXEMPLES porte, pour chaque code
// dont cette table a le texte, une paire [code, détails] dont le texte se
// compose une fois ; un code n'a d'exemple que dans le fichier de sa table.
// TEXTES porte des triplets [code, détails, texte attendu], composés mot
// pour mot. Les noms sont inventés.

export const EXEMPLES = [
  // Moteur
  ['PLACES_MANQUANTES', { placesManquantes: 3 }],
  ['SURRESERVATION', { table: 2, tour: 1, reservees: 9, capacite: 8, remede: null }],
  ['CAPACITE', { table: 2, capacite: 1 }],
  ['TOURS', { tours: 0 }],
  ['PARTICIPANT_DOUBLON', { participant: 4 }],
  ['TABLE_DOUBLON', { table: 3 }],
  ['RESERVATION_INCONNUE', { reservation: 0, participant: 42 }],
  ['RESERVATION_TOUR', { reservation: 2, tour: 5 }],
  ['RESERVATION_CONFLIT', { participant: 4, tour: 2, tables: [1, 3] }],
  ['ENUMERATION_TROP_GRANDE', { participant: 7, tablesAdmissibles: 40, toursLibres: 9, limite: 1000000 }],
  ['PLAN_TOURS', { attendu: 4, tours: 3, reserves: 3 }],
  ['PLAN_TABLE_INCONNUE', { table: 9 }],
  ['PLAN_TABLE_DOUBLON', { table: 2 }],
  ['PLAN_TABLE_ABSENTE', { table: 5 }],
  ['PLAN_LISTES', { tour: 2, listes: 3, tables: 4 }],
  ['PLAN_INCONNU', { participant: 42, tour: 1 }],
  ['PLAN_EXCLU_PLACE', { participant: 3, tour: 2 }],
  ['PLAN_DOUBLE_PLACE', { participant: 5, tour: 3 }],
  ['PLAN_NON_ASSIS', { participant: 6, tour: 4 }],
  ['DEPART_INCOMPATIBLE', { tour: 2, table: 10, participant: 4 }],
  ['TABLE_INCONNUE', { table: 9, detail: 'inconnue' }],
  ['DOUBLE_PLACE', { participant: 5, tour: 3 }],
  ['EXCLU_PLACE', { participant: 3, tour: 2 }],
  ['NON_ASSIS', { participant: 6, tour: 4 }],
  ['RESERVATION', { participant: 4, table: 5, tour: 1 }],
  ['PLAFOND_A_PRIORI', { index: 2, participant: 3 }],
  ['ORDRE_PLAFONDS', { index: 2, participant: 3 }],
  ['PLAFOND_REALISE', { index: 0, participant: 1 }],
  ['DEPASSEMENT', { index: 4, participant: 9 }],
  ['OBJECTIF_INCONNU', { table: 9 }],
  ['OBJECTIF_TOUR', { table: 2, tour: 5 }],
  ['OBJECTIF_CONFLIT', { table: 2, tour: null }],
  ['PRIORITES', { faute: 'seulASonPalier', critere: 'toursHorsObjectif', palier: 2 }],
  ['ANIMATION_NON_FIXEE', { participant: 4, tour: 3 }],
  ['TOURS_SERVIS', { index: 2, participant: 3 }],
  ['TOURS_SERVIS_NON_ASSIS', { index: 2, participant: 3 }],
  ['ANIMATEURS_RENCONTRES', { index: 4, participant: 9 }],
  ['JAMAIS_SERVIES', {}],
  ['HORS_OBJECTIF_MAX', {}],
  ['RESTE_NEGATIF', { groupe: 1, appartenance: 'Atelier Ressac' }],
  ['RESTE_OBJECTIFS_NEGATIF', { tour: 2 }],
  ['DIVERSITE_RENCONTRES', { index: 4, participant: 9 }],
  ['DIVERSITE_AFFILIES', { index: 4, participant: 9 }],
  ['AFFILIES_PLAFOND', { index: 4, participant: 9 }],
  ['BORNE_DIVERSITE', { index: 4, participant: 9 }],
];

export const TEXTES = [];
