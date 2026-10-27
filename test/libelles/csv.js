// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

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
  ['ANIMATION_INCONNUE', { ligne: 7, valeur: 'Table d’honneur' }],
  ['ETIQUETTE_MAL_FORMEE', { ligne: 6, valeur: 'ressources\thumaines', raison: 'controle' }],
  ['ETIQUETTES_TROP_NOMBREUSES', { ligne: 6, valeur: null, nombre: 21 }],
  ['PRESENCE_ILLISIBLE', { ligne: 6, valeur: '01-mars', raison: 'date' }],
  ['PRESENCE_HORS_TOURS', { ligne: 6, valeur: '2, 5-6', tour: 5, tours: 4 }],
  ['APERCU_TOURS_CHANGES', { tours: 3, toursApercu: 4, remede: null }],
  ['PLUSIEURS_CORRESPONDENT', { ligne: 7, valeur: null, participants: [3, 8] }],
  ['DEJA_DESIGNE', { ligne: 9, valeur: null, participants: [3], premiereLigne: 4 }],
  ['PLAN_BLOQUE', { remede: { geste: 'debloquer' } }],
  ['AMBIGUITE', { champs: ['organisation', 'courriel'] }],
  ['CONFLIT_ORGANISATION_INCONNUE', { ligne: 4, organisation: 'Société Gamma' }],
  ['CONFLIT_ORGANISATION_PROPRE', { ligne: 5, organisation: 'Club des Merles' }],
  ['INCLUSION_ORGANISATION_INCONNUE', { ligne: 4, organisation: 'Société Gamma' }],
  ['INCLUSION_ORGANISATION_PROPRE', { ligne: 5, organisation: 'Club des Merles' }],
  ['INCLUSION_PARTICIPANT_INCONNU', { ligne: 6, nom: 'Iris Ombrel' }],
  ['INCLUSION_PARTICIPANT_AMBIGU', { ligne: 7, nom: 'Théo Pervenche' }],
  ['INCLUSION_PARTICIPANT_SOI', { ligne: 8, nom: 'Ondine Lacasse' }],
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
  ['IMPORT_LOGOS_RETIRES', { logos: 2 }],
  ['ENTREE_IMPORTER_OBJECTIFS', { mode: 'mettreAJour', ajoutes: 3, remplaces: 1, retires: 0 }],
];

export const TEXTES = [
  [
    'CONFLIT_ORGANISATION_INCONNUE',
    { ligne: 4, organisation: 'Société Gamma' },
    "L'organisation « Société Gamma » n'existe pas (ligne 4, colonne des conflits). Rien n'est importé.",
  ],
  [
    'CONFLIT_ORGANISATION_PROPRE',
    { ligne: 5, organisation: 'Club des Merles' },
    "L'organisation « Club des Merles » est celle de la personne (ligne 5, colonne des conflits) : " +
      "une personne ne nomme pas la sienne en conflit. Rien n'est importé.",
  ],
  [
    'INCLUSION_ORGANISATION_INCONNUE',
    { ligne: 4, organisation: 'Société Gamma' },
    "L'organisation « Société Gamma » n'existe pas (ligne 4, colonne des inclusions d'organisation). " +
      "Rien n'est importé.",
  ],
  [
    'INCLUSION_ORGANISATION_PROPRE',
    { ligne: 5, organisation: 'Club des Merles' },
    "L'organisation « Club des Merles » est celle de la personne (ligne 5, colonne des inclusions " +
      "d'organisation) : une inclusion nomme une autre organisation que la sienne. Rien n'est importé.",
  ],
  [
    'INCLUSION_PARTICIPANT_INCONNU',
    { ligne: 6, nom: 'Iris Ombrel' },
    "Aucune personne ne s'appelle « Iris Ombrel » (ligne 6, colonne des inclusions de participant) : " +
      "une inclusion nomme une personne par son prénom et son nom. Rien n'est importé.",
  ],
  [
    'INCLUSION_PARTICIPANT_AMBIGU',
    { ligne: 7, nom: 'Théo Pervenche' },
    "Plusieurs personnes s'appellent « Théo Pervenche » (ligne 7, colonne des inclusions de participant) : " +
      "le nom ne dit pas laquelle rencontrer. Rien n'est importé.",
  ],
  [
    'INCLUSION_PARTICIPANT_SOI',
    { ligne: 8, nom: 'Ondine Lacasse' },
    "« Ondine Lacasse » est la personne de la ligne 8 elle-même (colonne des inclusions de participant) : " +
      "une inclusion nomme une autre personne. Rien n'est importé.",
  ],
  [
    'PRESENCE_ILLISIBLE',
    { ligne: 6, valeur: 'deux', raison: 'syntaxe' },
    "La présence « deux » ne se lit pas : des tours et des plages, comme « 1-3 », « 2, 3 » ou « tours 1 et 2 », " +
      '« tous », ou vide pour tous les tours.',
  ],
  [
    'PRESENCE_ILLISIBLE',
    { ligne: 6, valeur: '3-1', raison: 'intervalle' },
    'La présence « 3-1 » porte une plage à rebours : le premier tour vient avant le dernier, comme « 1-3 ».',
  ],
  [
    'PRESENCE_ILLISIBLE',
    { ligne: 6, valeur: '01-mars', raison: 'date' },
    'La présence « 01-mars » est une date : un tableur a changé la cellule. ' +
      'Mettez la colonne de la présence au format texte, puis saisissez de nouveau ses tours.',
  ],
  [
    'PRESENCE_HORS_TOURS',
    { ligne: 6, valeur: '2, 5-6', tour: 5, tours: 4 },
    "La présence « 2, 5-6 » nomme le tour 5 : la soirée compte 4 tours.",
  ],
  [
    'IMPORT_LOGOS_RETIRES',
    { logos: 3 },
    "Remplacer la liste a retiré 3 logos : le CSV n'en porte pas. Les images restent dans le dossier de l'événement, " +
      'et « Défaire » rend les logos.',
  ],
  [
    'IMPORT_LOGOS_RETIRES',
    { logos: 1 },
    "Remplacer la liste a retiré 1 logo : le CSV n'en porte pas. Les images restent dans le dossier de l'événement, " +
      'et « Défaire » rend les logos.',
  ],
  [
    'APERCU_TOURS_CHANGES',
    { tours: 3, toursApercu: 4, remede: null },
    "Le nombre de tours a changé depuis l'aperçu (4 → 3) : relire le fichier pour refaire l'aperçu.",
  ],
];
