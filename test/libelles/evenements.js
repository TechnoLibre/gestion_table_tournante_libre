// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les exemples des textes de src/application/libelles/evenements.js, que
// src/application/libelles.test.js réunit. EXEMPLES porte, pour chaque code
// dont cette table a le texte, une paire [code, détails] dont le texte se
// compose une fois ; un code n'a d'exemple que dans le fichier de sa table.
// TEXTES porte des triplets [code, détails, texte attendu], composés mot
// pour mot. Les noms sont inventés.

export const EXEMPLES = [
  ['PLAN_NON_BLOQUE', { remede: null }],
  // Refus et avertissements des commandes
  ['NOM_EVENEMENT_TROP_LONG', { longueur: 201, maximum: 200, remede: null }],
  ['DATE_INVALIDE', { date: '2031-02-30', remede: null }],
  ['SIEGES_INVALIDES', { sieges: 1, remede: null }],
  ['TOURS_INVALIDES', { tours: 0, remede: null }],
  ['AUCUNE_PROPOSITION', { remede: { geste: 'ouvrirSection', section: 'generation' } }],
  ['AUCUN_RETENU', { remede: { geste: 'ouvrirSection', section: 'propositions' } }],
  // Façade des événements
  ['QUESTION_EN_ATTENTE', { question: 'PORTABLE_NON_INSCRIPTIBLE', remede: null }],
  ['EXPLORATEUR_ABSENT', { remede: null }],
  // Libellés figés du journal
  ['ENTREE_CREATION', { nom: "Soirée d'essai" }],
  ['ENTREE_CHANGER_ETAT', { etat: 'bloque' }],
  ['ENTREE_DEBLOQUER', { etat: 'retenu' }],
  ['ENTREE_COPIE', { source: 'Soirée des Lucioles', instant: "Création de l'événement « Soirée des Lucioles »" }],
  ['ENTREE_RENOMMER', { ancien: 'Soirée des Lucioles', nom: 'Soirée des Cerfs' }],
  ['ENTREE_DEMONSTRATION', { nom: 'Petite démonstration' }],
];

export const TEXTES = [];
