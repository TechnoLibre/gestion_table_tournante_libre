// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les exemples des textes de src/application/libelles/evenements.js, que
// src/application/libelles.test.js réunit. EXEMPLES porte, pour chaque code
// dont cette table a le texte, une paire [code, détails] dont le texte se
// compose une fois ; un code n'a d'exemple que dans le fichier de sa table.
// TEXTES porte des triplets [code, détails, texte attendu], composés mot
// pour mot. Les noms sont inventés.

export const EXEMPLES = [
  ['PLAN_NON_BLOQUE', { remede: null }],
  // Refus et avertissements des commandes
  ['NOM_EVENEMENT_TROP_LONG', { longueur: 69, maximum: 68, remede: null }],
  ['DATE_INVALIDE', { date: '2031-02-30', remede: null }],
  ['SIEGES_INVALIDES', { sieges: 1, remede: null }],
  ['TOURS_INVALIDES', { tours: 0, remede: null }],
  ['AUCUNE_PROPOSITION', { remede: { geste: 'ouvrirSection', section: 'generation' } }],
  ['AUCUN_RETENU', { remede: { geste: 'ouvrirSection', section: 'propositions' } }],
  // Façade des événements
  ['QUESTION_EN_ATTENTE', { question: 'PORTABLE_NON_INSCRIPTIBLE', remede: null }],
  ['DOSSIER_NON_RETIRE', { dossier: 'E:\\data\\Gala des Saules', cause: 'NON_VIDE' }],
  ['EXPLORATEUR_ABSENT', { remede: null }],
  // Libellés figés du journal
  ['ENTREE_CREATION', { nom: "Soirée d'essai" }],
  ['ENTREE_CHANGER_ETAT', { etat: 'bloque' }],
  ['ENTREE_DEBLOQUER', { etat: 'retenu' }],
  ['ENTREE_COPIE', { source: 'Soirée des Lucioles', instant: "Création de l'événement « Soirée des Lucioles »" }],
  ['ENTREE_RENOMMER', { ancien: 'Soirée des Lucioles', nom: 'Soirée des Cerfs' }],
  ['ENTREE_DEMONSTRATION', { nom: 'Petite démonstration' }],
];

export const TEXTES = [
  [
    'DOSSIER_NON_RETIRE',
    { dossier: 'E:\\data\\Gala des Saules', cause: 'NON_VIDE' },
    "L'événement a quitté le dossier « E:\\data\\Gala des Saules », qui reste sur le disque : " +
      "il porte encore un fichier que l'opération n'a pas emporté. Rien ne s'y est perdu.",
  ],
  [
    'DOSSIER_NON_RETIRE',
    { dossier: 'E:\\data\\Gala des Saules', cause: 'EBUSY' },
    "L'événement a quitté le dossier « E:\\data\\Gala des Saules », qui n'a pas pu être retiré (EBUSY) : " +
      'il reste sur le disque.',
  ],
];
