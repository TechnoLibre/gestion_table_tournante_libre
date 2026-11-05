// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les exemples des textes de src/application/libelles/seance.js, que
// src/application/libelles.test.js réunit. EXEMPLES porte, pour chaque code
// dont cette table a le texte, une paire [code, détails] dont le texte se
// compose une fois ; un code n'a d'exemple que dans le fichier de sa table.
// TEXTES porte des triplets [code, détails, texte attendu], composés mot
// pour mot. Les noms sont inventés.

export const EXEMPLES = [
  // Dossier de travail et réglages locaux
  ['REGLAGES_NON_ECRITS', { chemin: 'reglages_locaux.json', dossier: 'E:\\data', cause: 'EROFS' }],
  // Séance
  ['AUCUN_EVENEMENT', {}],
  ['MODE_LECTURE', {}],
  ['FORMAT', {}],
  ['BLOQUE', {}],
  ['SUPPORT_ROMPU', { echec: 'ECRITURE', chemin: 'Soirée des Lucioles.gtt-journal.jsonl', dossier: 'E:\\data', cause: 'EROFS' }],
  ['SUPPORT_INTACT', {}],
  ['SUPPORT_ROMPU_NON_SAUVE', { echec: 'ETAT_NON_ECRIT', chemin: 'Soirée des Lucioles.gtt.json', dossier: 'E:\\data', cause: 'EIO' }],
  ['EVENEMENT_CHANGE', { revision: 7 }],
  ['VERROU_REPRIS', { seance: 'seance-morte', depuis: '2031-05-01T21:40:00-04:00' }],
  ['VERROU_NON_RENDU', { chemin: 'Soirée des Lucioles.gtt.verrou', dossier: 'E:\\data', cause: 'EROFS' }],
  ['RIEN_A_DEFAIRE', {}],
  ['RIEN_A_REFAIRE', {}],
  ['INSTANT_NON_RESTITUABLE', { revision: 3 }],
  ['JALON_NON_ECRIT', { chemin: 'Soirée des Lucioles.gtt-journal.jsonl', dossier: 'E:\\data', cause: 'EROFS' }],
  ['SANS_EFFET', { commande: 'modifierParticipant', remede: null }],
  ['RETOUR_AUTOMATIQUE', {}],
  ['DOSSIER_EVENEMENT_ABSENT', { dossier: 'E:\\data\\Soirée des Lucioles' }],
  [
    'DERIVE_NOUVELLE',
    {
      touchees: [
        { id: 'retenu', raisons: [{ code: 'TABLE_SUPPRIMEE', table: 2 }] },
        { id: 3, raisons: [{ code: 'CAPACITE_CHANGEE', table: 1, avant: 8, maintenant: 6 }] },
      ],
    },
  ],
  ['RESERVATION_NON_HONOREE', { participant: 4, table: 5, tour: 1 }],
  [
    'INVARIANT_VIOLE',
    {
      proposition: 1,
      violations: [
        { code: 'RESERVATION', participant: 4, table: 5, tour: 1 },
        { code: 'CAPACITE', table: 5, tour: 2 },
      ],
      remede: null,
    },
  ],
  ['CONFIGURATION_INCOHERENTE', { code: 'SURRESERVATION', details: { table: 2, tour: 1, reservees: 9, capacite: 8 } }],
  // Libellés figés du journal
  ['JALON_CREATION', {}],
  ['JALON_ETAT', { etat: 'retenu' }],
  ['JALON_AVANT_GENERATION', {}],
  ['ENTREE_REPRISE', {}],
  ['ENTREE_DEFAIRE', { libelle: 'Ajouté Théo Pervenche' }],
  ['ENTREE_REFAIRE', { libelle: 'Ajouté Théo Pervenche' }],
  ['ENTREE_REVENIR', { libelle: 'Ajouté Iris Ombrelle' }],
];

export const TEXTES = [
  // Le dossier de l'événement disparu pendant la séance.
  [
    'DOSSIER_EVENEMENT_ABSENT',
    { dossier: 'E:\\data\\Soirée des Lucioles' },
    "Le dossier de l'événement « E:\\data\\Soirée des Lucioles » est introuvable : déplacé, renommé ou " +
      "retiré hors de l'application, il ne se recrée pas.",
  ],
];
