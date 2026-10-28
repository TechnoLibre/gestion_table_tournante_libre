// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les exemples des textes de src/application/libelles/planche.js, que
// src/application/libelles.test.js réunit. EXEMPLES porte, pour chaque code
// dont cette table a le texte, une paire [code, détails] dont le texte se
// compose une fois ; un code n'a d'exemple que dans le fichier de sa table.
// TEXTES porte des triplets [code, détails, texte attendu], composés mot
// pour mot. Les noms sont inventés.

export const EXEMPLES = [
  // Planche de badges
  ['PLANCHE_SANS_PLACEMENT', { remede: { geste: 'ouvrirSection', section: 'propositions' } }],
  ['PROPOSITION_FAUTIVE', { id: 2, remede: { geste: 'ouvrirSection', section: 'propositions' } }],
  [
    'PLANCHE_DERIVE',
    {
      raisons: [{ code: 'PARTICIPANT_NON_PLACE', participant: 6, personne: 'Ondine Grisaille' }],
      remede: { geste: 'ouvrirSection', section: 'propositions' },
    },
  ],
  ['PLANCHE_TROP_DE_TOURS', { tours: 40, lignesLongues: false, remede: null }],
  ['PLANCHE_NOM_TROP_LONG', { participant: 3, personne: 'Ondine Lacasse', remede: { geste: 'ouvrirSection', section: 'participants' } }],
  [
    'PLANCHE_NON_ECRITE',
    {
      chemin: 'Soirée des Lucioles.badges_A4_feuille_2031-05-17_20-15-07.pdf',
      dossier: 'E:\\data',
      cause: 'EROFS',
      fichier: 'planche',
      remede: { geste: 'enregistrerSous' },
    },
  ],
];

export const TEXTES = [
  // Une ligne de tour : la place, « pas de table » en réserve, « absente » à
  // un tour d'absence, où ni table, ni siège, ni titre ne s'écrivent.
  ['planche.absente', {}, 'absente'],
  // Le pied TechnoLibre d'origine, mot pour mot : celui d'une machine qui
  // n'en garde pas d'autre, dont les octets de la planche dépendent.
  [
    'planche.technolibre',
    {},
    'Demander un d\u{E9}veloppement logiciel personnalis\u{E9} avec https://technolibre.ca pour votre entreprise',
  ],
  ['planche.tour', { tour: 2, table: null, siege: null, titre: null, absente: true }, 'Tour 2 \u{2014} absente'],
  ['planche.tour', { tour: 2, table: null, siege: null, titre: null, absente: false }, 'Tour 2 \u{2014} pas de table'],
  ['planche.tour', { tour: 3, table: 7, siege: 2, titre: 'animatrice', absente: false }, 'Tour 3 \u{2014} table 7, siège 2 \u{2014} animatrice'],
  // Le libellé de la table, entre parenthèses après son numéro.
  [
    'planche.tour',
    { tour: 1, table: 5, libelleTable: 'Terrasse', siege: 3, titre: 'animation', absente: false },
    'Tour 1 \u{2014} table 5 (Terrasse), siège 3 \u{2014} animation',
  ],
  ['planche.touteLaSoiree', { table: 13, libelleTable: 'Verrière', siege: null, titre: null }, 'Toute la soirée \u{2014} table 13 (Verrière)'],
  // La liste des badges en CSV d'une colonne par tour : la tête d'un tour
  // sans nom, et la place seule sous elle.
  ['planche.liste.tour', { tour: 3 }, 'Tour 3'],
  [
    'planche.liste.place',
    { tour: 1, table: 5, libelleTable: 'Terrasse', siege: 3, titre: 'animation', absente: false },
    'table 5 (Terrasse), siège 3 \u{2014} animation',
  ],
  ['planche.liste.place', { tour: 2, table: null, siege: null, titre: null, absente: false }, 'pas de table'],
  ['planche.liste.place', { tour: 2, table: null, siege: null, titre: null, absente: true }, 'absente'],
  // Des lignes de tour repliées qui débordent : le refus nomme la personne
  // et ce qui se raccourcit, plutôt que le nombre de tours.
  [
    'PLANCHE_TROP_DE_TOURS',
    {
      tours: 8,
      lignesLongues: true,
      participant: 4,
      personne: 'Iris Ombrelle',
      remede: { geste: 'ouvrirSection', section: 'tables' },
    },
    'Les lignes de tour de Iris Ombrelle, repliées par un nom de tour, un libellé de table ou un titre long, ne tiennent pas ' +
      'sur son badge, même sur deux colonnes au plus petit corps : raccourcissez ce nom, ce libellé ou ce titre. ' +
      "La planche n'est pas produite, plutôt qu'une liste de tours tronquée.",
  ],
  // L'écriture refusée nomme le fichier qui manque ; la feuille de contrôle,
  // aussi les cartes déjà déposées.
  [
    'PLANCHE_NON_ECRITE',
    {
      chemin: 'Soirée des Lucioles.controle_avery5392_2031-05-17_20-15-07.pdf',
      dossier: 'E:\\data\\Soirée des Lucioles',
      cause: null,
      fichier: 'controle',
      deposee: 'E:\\data\\Soirée des Lucioles\\Soirée des Lucioles.badges_avery5392_2031-05-17_20-15-07.pdf',
    },
    "La feuille de contrôle n'a pas pu s'écrire : « Soirée des Lucioles.controle_avery5392_2031-05-17_20-15-07.pdf » " +
      'dans le dossier « E:\\data\\Soirée des Lucioles ». Les cartes, elles, sont déposées : ' +
      'E:\\data\\Soirée des Lucioles\\Soirée des Lucioles.badges_avery5392_2031-05-17_20-15-07.pdf. « Enregistrer sous\u{2026} » dépose les deux fichiers ailleurs.',
  ],
  [
    'PLANCHE_NON_ECRITE',
    { chemin: 'Soirée des Lucioles.badges_2031-05-17_20-15-07.csv', dossier: 'E:\\data', cause: null, fichier: 'liste' },
    "La liste des badges n'a pas pu s'écrire : « Soirée des Lucioles.badges_2031-05-17_20-15-07.csv » " +
      'dans le dossier « E:\\data ». « Enregistrer sous\u{2026} » la dépose ailleurs.',
  ],
  // Le dossier de l'événement disparu : la phrase le nomme, sans le fichier.
  [
    'PLANCHE_NON_ECRITE',
    {
      chemin: 'Soirée des Lucioles.badges_A4_feuille_2031-05-17_20-15-07.pdf',
      dossier: 'E:\\data\\Soirée des Lucioles',
      cause: 'DOSSIER_EVENEMENT_ABSENT',
      fichier: 'planche',
    },
    "La planche n'a pas pu s'écrire : le dossier de l'événement « E:\\data\\Soirée des Lucioles » est " +
      'introuvable, et il ne se recrée pas. « Enregistrer sous\u{2026} » la dépose ailleurs.',
  ],
  // Le badge de la feuille de contrôle, par modèle ; la consigne de la
  // feuille à part d'Avery 5392.
  ['planche.controle.badge', { largeur: 105, hauteur: 148, modeleBadge: 'a6' }, 'Badge : 105 × 148 mm (A6)'],
  [
    'planche.controle.badge',
    { largeur: 101.6, hauteur: 76.2, modeleBadge: 'avery5392' },
    'Badge : 101,6 × 76,2 mm (Avery 5392, six cartes prédécoupées par feuille)',
  ],
  [
    'planche.controle.cartes',
    { modeleBadge: 'avery5392' },
    'Imprimer cette feuille sur papier ordinaire : posée sur une feuille Avery 5392, le contour des six cartes tombe sur leurs prédécoupes',
  ],
  // Les comptes des logos des participants, accordés au nombre.
  ['planche.controle.logos', { poses: 12, sansPlace: 3, introuvables: 2 }, 'Logos : 12 posés, 3 sans place, 2 introuvables'],
  ['planche.controle.logos', { poses: 1, sansPlace: 0, introuvables: 0 }, 'Logos : 1 posé, 0 sans place, 0 introuvable'],
  // Les données que les cases de la section retirent des badges, nommées
  // dans l'ordre des cases.
  ['planche.controle.retirees', { donnees: ['horodatage'] }, 'Donn\u{E9}es retir\u{E9}es des badges : date du placement'],
  [
    'planche.controle.retirees',
    { donnees: ['organisation', 'evenement', 'date', 'horodatage', 'identifiant'] },
    'Donn\u{E9}es retir\u{E9}es des badges : organisation, nom de l\u{2019}\u{E9}v\u{E9}nement, ' +
      'date de l\u{2019}\u{E9}v\u{E9}nement, date du placement et identifiant',
  ],
];
