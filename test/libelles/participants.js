// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les exemples des textes de src/application/libelles/participants.js, que
// src/application/libelles.test.js réunit. EXEMPLES porte, pour chaque code
// dont cette table a le texte, une paire [code, détails] dont le texte se
// compose une fois ; un code n'a d'exemple que dans le fichier de sa table.
// TEXTES porte des triplets [code, détails, texte attendu], composés mot
// pour mot. Les noms sont inventés.

export const EXEMPLES = [
  // Refus et avertissements des commandes
  ['NOM_REQUIS', { remede: null }],
  ['PARTICIPANT_INCONNU', { id: 42, remede: null }],
  ['RESERVATIONS_SUSPENDUES', { participant: 1, personne: 'Iris Ombrelle', reservations: 2, titres: 1 }],
  ['RESERVATIONS_RETABLIES', { participant: 1, personne: 'Iris Ombrelle', reservations: 2, titres: 1 }],
  ['RESERVATIONS_RETIREES', { participant: 1, personne: 'Iris Ombrelle', reservations: 1, titres: 1 }],
  ['IMPORT_EN_RETENU', {}],
  ['ETIQUETTE_INVALIDE', { valeur: 'ressources\u{0009}humaines', raison: 'controle', remede: null }],
  ['ETIQUETTES_EN_TROP', { nombre: 21, remede: null }],
  ['ORTHOGRAPHE_RETENUE', { saisie: 'Finance', retenue: 'finance' }],
  // Libellés figés du journal
  ['ENTREE_AJOUTER_PARTICIPANT', { personne: 'Iris Ombrelle' }],
  ['ENTREE_MODIFIER_PARTICIPANT', { personne: 'Iris Ombrelle', champs: ['courriel'], devenu: null }],
  ['ENTREE_EXCLURE_PARTICIPANT', { personne: 'Iris Ombrelle' }],
  ['ENTREE_REINTEGRER_PARTICIPANT', { personne: 'Iris Ombrelle' }],
  ['ENTREE_SUPPRIMER_PARTICIPANT', { personne: 'Iris Ombrelle' }],
  ['ENTREE_CHANGER_ETIQUETTES', { personne: 'Iris Ombrelle', ajoutees: ['Montréal', 'finance'], retirees: ['bénévole'] }],
  ['ENTREE_IMPORTER_PARTICIPANTS', { mode: 'ajouter', ajoutes: 12, misAJour: 0, retires: 0 }],
];

export const TEXTES = [];
