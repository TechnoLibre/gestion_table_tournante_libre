// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les exemples des textes de src/application/libelles/csv.js, que
// src/application/libelles.test.js réunit. EXEMPLES porte, pour chaque code
// dont cette table a le texte, une paire [code, détails] dont le texte se
// compose une fois ; un code n'a d'exemple que dans le fichier de sa table.
// TEXTES porte des triplets [code, détails, texte attendu], composés mot
// pour mot. Les noms sont inventés.

export const EXEMPLES = [
  // CSV
  ['UTF16_SANS_MARQUE', { remede: 'ENREGISTRER_EN_UTF8' }],
  ['UTF16_INVALIDE', { remede: 'ENREGISTRER_EN_UTF8' }],
  ['UTF8_INVALIDE', { remede: 'ENREGISTRER_EN_UTF8' }],
  ['CARACTERE_NUL', { remede: 'ENREGISTRER_EN_UTF8' }],
  ['ENREGISTRER_EN_UTF8', {}],
  ['SEPARATEUR_INTROUVABLE', { separateur: ';', ligne: 3, cause: 'NOMBRE_DE_CHAMPS' }],
  ['NOMBRE_DE_CHAMPS', { ligne: 3 }],
  ['GUILLEMET_OUVERT', { ligne: 2 }],
  ['AUCUN_ENTETE', {}],
  ['NOM_NON_ASSOCIE', {}],
  ['AUCUNE_LIGNE_VALIDE', {}],
  ['CHAMPS_EN_TROP', { ligne: 4, valeur: null }],
  ['NOM_ABSENT', { ligne: 5, valeur: null }],
  ['EXCLU_INCONNU', { ligne: 6, valeur: 'peut-être' }],
  ['ETIQUETTE_MAL_FORMEE', { ligne: 6, valeur: 'ressources\thumaines', raison: 'controle' }],
  ['ETIQUETTES_TROP_NOMBREUSES', { ligne: 6, valeur: null, nombre: 21 }],
  ['PLUSIEURS_CORRESPONDENT', { ligne: 7, valeur: null, participants: [3, 8] }],
  ['DEJA_DESIGNE', { ligne: 9, valeur: null, participants: [3], premiereLigne: 4 }],
  ['PLAN_BLOQUE', { remede: { geste: 'debloquer' } }],
  ['AMBIGUITE', { champs: ['appartenance', 'courriel'] }],
  // Le CSV des objectifs de table (§ 10.4)
  ['TABLE_NON_ASSOCIEE', {}],
  ['OBJECTIF_NON_ASSOCIE', {}],
  ['OBJECTIFS_SANS_TABLE', { ligne: null, remede: { geste: 'ouvrirSection', section: 'tables' } }],
  ['OBJECTIFS_NUMEROS_PARTAGES', { remede: { geste: 'ouvrirSection', section: 'tables' } }],
  ['TABLE_ABSENTE', { ligne: 3, valeur: null }],
  ['TABLE_NON_ENTIERE', { ligne: 3, valeur: '3b' }],
  ['NUMERO_TABLE_INCONNU', { ligne: 4, valeur: '9' }],
  ['PLUSIEURS_TABLES', { ligne: 4, valeur: '3' }],
  ['TOUR_NON_ENTIER', { ligne: 5, valeur: 'deux' }],
  ['TOUR_HORS_SOIREE', { ligne: 5, valeur: '9', tours: 4 }],
  ['OBJECTIF_VIDE', { ligne: 6, valeur: null }],
  ['REGLE_INCONNUE', { ligne: 6, valeur: 'peut-être' }],
  ['OBJECTIF_EN_DOUBLE', { ligne: 8, valeur: null, premiereLigne: 3, numero: 1, tour: 2 }],
  ['IMPORT_OBJECTIFS_RECLASSE', {}],
  ['ENTREE_IMPORTER_OBJECTIFS', { mode: 'mettreAJour', ajoutes: 3, remplaces: 1, retires: 0 }],
];

export const TEXTES = [];
