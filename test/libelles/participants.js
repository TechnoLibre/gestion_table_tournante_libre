// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

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
  ['ORGANISATION_INCONNUE', { organisation: 'Atelier Pivoine', remede: null }],
  ['CONFLIT_PROPRE_ORGANISATION', { personne: 'Iris Ombrelle', organisation: 'Club des Merles', remede: null }],
  ['INCLUSION_PROPRE_ORGANISATION', { personne: 'Iris Ombrelle', organisation: 'Club des Merles', remede: null }],
  ['INCLUSION_DE_SOI', { personne: 'Iris Ombrelle', remede: null }],
  // Libellés figés du journal
  ['ENTREE_AJOUTER_PARTICIPANT', { personne: 'Iris Ombrelle' }],
  ['ENTREE_MODIFIER_PARTICIPANT', { personne: 'Iris Ombrelle', champs: ['courriel'], devenu: null }],
  ['ENTREE_EXCLURE_PARTICIPANT', { personne: 'Iris Ombrelle' }],
  ['ENTREE_REINTEGRER_PARTICIPANT', { personne: 'Iris Ombrelle' }],
  ['ENTREE_SUPPRIMER_PARTICIPANT', { personne: 'Iris Ombrelle' }],
  ['ENTREE_CHANGER_ETIQUETTES', { personne: 'Iris Ombrelle', ajoutees: ['Montréal', 'finance'], retirees: ['bénévole'] }],
  ['ENTREE_AJOUTER_CONFLIT', { personne: 'Iris Ombrelle', organisation: 'Société Alpha' }],
  ['ENTREE_RETIRER_CONFLIT', { personne: 'Iris Ombrelle', organisation: 'Société Alpha' }],
  ['ENTREE_CHANGER_CONFLITS', { personne: 'Iris Ombrelle', ajoutees: ['Société Alpha', 'Société Beta'], retirees: ['Club des Merles'] }],
  ['ENTREE_CHANGER_INCLUSIONS_ORGANISATION', { personne: 'Iris Ombrelle', ajoutees: ['Société Alpha'], retirees: ['Club des Merles'] }],
  ['ENTREE_CHANGER_INCLUSIONS_PARTICIPANT', { personne: 'Iris Ombrelle', ajoutees: ['Théo Pervenche'], retirees: ['Basile Mélèze'] }],
  ['ENTREE_IMPORTER_PARTICIPANTS', { mode: 'ajouter', ajoutes: 12, misAJour: 0, retires: 0 }],
  // Le logo d'une personne
  ['ENTREE_CHANGER_LOGO', { personne: 'Iris Ombrelle', effet: 'pose' }],
  [
    'LOGO_NON_ECRIT',
    {
      personne: 'Iris Ombrelle',
      chemin: `logo/${'0123456789abcdef'.repeat(4)}.png`,
      dossier: 'C:\\Données\\Soirée des Lucioles',
      cause: 'ENOSPC',
      remede: null,
    },
  ],
  ['LOGO_ILLISIBLE', { fichier: 'IMG_0042.HEIC', remede: null }],
  ['LOGO_TROP_GRAND', { fichier: 'affiche-lucioles.png', largeur: 12_000, hauteur: 9000, max: 50_000_000, remede: null }],
  // La présence par tour
  ['RESERVATIONS_SUSPENDUES_AUX_TOURS', { participant: 1, personne: 'Iris Ombrelle', reservations: 2, tours: [3, 4], titres: 1 }],
  ['RESERVATIONS_RETABLIES_AUX_TOURS', { participant: 1, personne: 'Iris Ombrelle', reservations: 1, tours: [2], titres: 0 }],
  [
    'A_PLACER_DANS_LE_RETENU',
    { participant: 3, personne: 'Théo Pervenche', tours: [2], tousLesTours: false, remede: { geste: 'afficherTour', tour: 2 } },
  ],
  ['RENCONTRES_RETIREES_DU_RETENU', { participant: 1, personne: 'Iris Ombrelle', tours: [1, 2], remede: null }],
  ['ENTREE_CHANGER_PRESENCE', { personne: 'Iris Ombrelle', tours: [1, 2], avant: null, retiree: [3, 4], enReserve: [] }],
];

export const TEXTES = [
  [
    'RESERVATIONS_SUSPENDUES_AUX_TOURS',
    { participant: 1, personne: 'Iris Ombrelle', reservations: 2, tours: [3, 4], titres: 1 },
    "Absence de Iris Ombrelle aux tours 3 et 4 : 2 réservations suspendues, ses places y reviennent aux autres, et 1 titre de place n'y est plus pourvu.",
  ],
  [
    'RESERVATIONS_SUSPENDUES_AUX_TOURS',
    { participant: 3, personne: 'Théo Pervenche', reservations: 1, tours: [2], titres: 0 },
    'Absence de Théo Pervenche au tour 2 : 1 réservation suspendue, sa place y revient aux autres.',
  ],
  [
    'RESERVATIONS_RETABLIES_AUX_TOURS',
    { participant: 3, personne: 'Théo Pervenche', reservations: 2, tours: [2, 3, 4], titres: 2 },
    'Présence de Théo Pervenche aux tours 2 à 4 : 2 réservations rétablies, et 2 titres de place de nouveau pourvus.',
  ],
  [
    'A_PLACER_DANS_LE_RETENU',
    { participant: 3, personne: 'Théo Pervenche', tours: [2], tousLesTours: false, remede: { geste: 'afficherTour', tour: 2 } },
    'Théo Pervenche attend en réserve du placement retenu au tour 2 : à placer à la main, ou par une proposition dérivée.',
  ],
  [
    'A_PLACER_DANS_LE_RETENU',
    { participant: 8, personne: 'Hortense Quenouille', tours: [1, 2, 3, 4], tousLesTours: true, remede: { geste: 'afficherTour', tour: 1 } },
    'Hortense Quenouille attend en réserve du placement retenu aux tours 1 à 4 : à placer à la main, ou par une proposition ' +
      'dérivée. Si elle arrive en cours de soirée, dire à quels tours elle est présente.',
  ],
  [
    'RENCONTRES_RETIREES_DU_RETENU',
    { participant: 1, personne: 'Iris Ombrelle', tours: [1, 2], remede: null },
    "Iris Ombrelle était assise aux tours 1 et 2 du placement retenu : ses rencontres de ces tours n'y comptent plus. " +
      'Pour les garder, défaire, puis la dire présente aux tours 1 et 2 seulement.',
  ],
  [
    'ENTREE_CHANGER_PRESENCE',
    { personne: 'Iris Ombrelle', tours: [1, 2], avant: null, retiree: [3, 4], enReserve: [] },
    'Présence de Iris Ombrelle : tours 1 et 2, au lieu de tous les tours ; retirée du placement retenu aux tours 3 et 4',
  ],
  [
    'ENTREE_CHANGER_PRESENCE',
    { personne: 'Théo Pervenche', tours: [2, 3, 4], avant: [3, 4], retiree: [], enReserve: [2] },
    'Présence de Théo Pervenche : tours 2 à 4, au lieu des tours 3 et 4 ; mise en réserve au tour 2',
  ],
  [
    'ENTREE_CHANGER_PRESENCE',
    { personne: 'Basile Mélèze', tours: null, avant: [1], retiree: [], enReserve: [] },
    'Présence de Basile Mélèze : tous les tours, au lieu du tour 1',
  ],
  [
    'ENTREE_CHANGER_PRESENCE',
    { personne: 'Basile Mélèze', tours: [2, 3], avant: [1, 2], retiree: [1], enReserve: [3] },
    'Présence de Basile Mélèze : tours 2 et 3, au lieu des tours 1 et 2 ; retirée du placement retenu au tour 1, mise en réserve au tour 3',
  ],
  ['ENTREE_AJOUTER_PARTICIPANT', { personne: 'Iris Ombrelle', ajuste: true }, 'Ajouté Iris Ombrelle ; placement retenu ajusté'],
  ['ENTREE_AJOUTER_PARTICIPANT', { personne: 'Iris Ombrelle', ajuste: false }, 'Ajouté Iris Ombrelle'],
  ['ENTREE_EXCLURE_PARTICIPANT', { personne: 'Iris Ombrelle', ajuste: true }, 'Exclu Iris Ombrelle ; placement retenu ajusté'],
  ['ENTREE_REINTEGRER_PARTICIPANT', { personne: 'Iris Ombrelle', ajuste: true }, 'Réintégré Iris Ombrelle ; placement retenu ajusté'],
  ['ENTREE_SUPPRIMER_PARTICIPANT', { personne: 'Iris Ombrelle', ajuste: true }, 'Supprimé Iris Ombrelle ; placement retenu ajusté'],
  [
    'ENTREE_SUPPRIMER_PARTICIPANT',
    { personne: 'Iris Ombrelle', ajuste: false, conflits: { renommee: null, retirees: ['Club des Merles'], propres: 0 } },
    'Supprimé Iris Ombrelle ; « Club des Merles » quitte les conflits',
  ],
  [
    'ENTREE_MODIFIER_PARTICIPANT',
    {
      personne: 'Iris Ombrelle',
      champs: ['organisation'],
      devenu: null,
      conflits: { renommee: { de: 'Club des Merles', vers: 'Club des Mésanges' }, retirees: [], propres: 1 },
    },
    'Modifié Iris Ombrelle : organisation ; « Club des Merles » devient « Club des Mésanges » dans les conflits ; ' +
      '1 conflit avec sa propre organisation retiré',
  ],
  [
    'ENTREE_IMPORTER_PARTICIPANTS',
    { mode: 'remplacer', ajoutes: 3, misAJour: 0, retires: 4, conflits: { renommee: null, retirees: ['Club des Merles', 'Société Alpha'], propres: 0 } },
    'Remplacé la liste par import : 4 retirés, 3 ajoutés ; « Club des Merles » et « Société Alpha » quittent les conflits',
  ],
  ['ENTREE_AJOUTER_CONFLIT', { personne: 'Iris Ombrelle', organisation: 'Société Alpha' }, 'Conflits de Iris Ombrelle : ajouté « Société Alpha »'],
  ['ENTREE_RETIRER_CONFLIT', { personne: 'Iris Ombrelle', organisation: 'Société Alpha' }, 'Conflits de Iris Ombrelle : retiré « Société Alpha »'],
  [
    'ENTREE_CHANGER_CONFLITS',
    { personne: 'Iris Ombrelle', ajoutees: ['Société Alpha', 'Société Beta'], retirees: ['Club des Merles'] },
    'Conflits de Iris Ombrelle : ajouté « Société Alpha » et « Société Beta » ; retiré « Club des Merles »',
  ],
  ['ENTREE_CHANGER_CONFLITS', { personne: 'Iris Ombrelle', ajoutees: [], retirees: ['Club des Merles'] }, 'Conflits de Iris Ombrelle : retiré « Club des Merles »'],
  [
    'ENTREE_CHANGER_INCLUSIONS_ORGANISATION',
    { personne: 'Iris Ombrelle', ajoutees: ['Société Alpha', 'Société Beta'], retirees: ['Club des Merles'] },
    "Inclusions d'organisation de Iris Ombrelle : ajouté « Société Alpha » et « Société Beta » ; retiré « Club des Merles »",
  ],
  [
    'ENTREE_CHANGER_INCLUSIONS_ORGANISATION',
    { personne: 'Iris Ombrelle', ajoutees: [], retirees: ['Club des Merles'] },
    "Inclusions d'organisation de Iris Ombrelle : retiré « Club des Merles »",
  ],
  [
    'ENTREE_CHANGER_INCLUSIONS_PARTICIPANT',
    { personne: 'Iris Ombrelle', ajoutees: ['Théo Pervenche', 'Ondine Lacasse', 'Basile Mélèze'], retirees: ['Hortense Quenouille'] },
    'Inclusions de participant de Iris Ombrelle : ajouté Théo Pervenche, Ondine Lacasse et Basile Mélèze ; retiré Hortense Quenouille',
  ],
  [
    'ENTREE_CHANGER_INCLUSIONS_PARTICIPANT',
    { personne: 'Iris Ombrelle', ajoutees: ['Théo Pervenche'], retirees: [] },
    'Inclusions de participant de Iris Ombrelle : ajouté Théo Pervenche',
  ],
  [
    'ENTREE_SUPPRIMER_PARTICIPANT',
    {
      personne: 'Théo Pervenche',
      ajuste: true,
      conflits: { renommee: null, retirees: ['Club des Merles'], propres: 0 },
      inclusions: { renommee: null, retirees: ['Club des Merles'], propres: 0 },
      listesDInclusions: 2,
    },
    "Supprimé Théo Pervenche ; placement retenu ajusté ; « Club des Merles » quitte les conflits ; « Club des Merles » quitte les " +
      "inclusions ; retirée de 2 listes d'inclusions",
  ],
  [
    'ENTREE_SUPPRIMER_PARTICIPANT',
    { personne: 'Théo Pervenche', ajuste: false, conflits: null, inclusions: null, listesDInclusions: 1 },
    "Supprimé Théo Pervenche ; retirée de 1 liste d'inclusions",
  ],
  [
    'ENTREE_SUPPRIMER_PARTICIPANT',
    { personne: 'Théo Pervenche', ajuste: false, conflits: null, inclusions: null, listesDInclusions: 0 },
    'Supprimé Théo Pervenche',
  ],
  [
    'ENTREE_MODIFIER_PARTICIPANT',
    {
      personne: 'Iris Ombrelle',
      champs: ['organisation'],
      devenu: null,
      conflits: null,
      inclusions: { renommee: { de: 'Club des Merles', vers: 'Club des Mésanges' }, retirees: [], propres: 2 },
    },
    'Modifié Iris Ombrelle : organisation ; « Club des Merles » devient « Club des Mésanges » dans les inclusions ; ' +
      '2 inclusions de leur propre organisation retirées',
  ],
  [
    'ENTREE_IMPORTER_PARTICIPANTS',
    {
      mode: 'mettreAJour',
      ajoutes: 0,
      misAJour: 1,
      retires: 0,
      conflits: { renommee: null, retirees: [], propres: 1 },
      inclusions: { renommee: null, retirees: ['Société Alpha', 'Société Beta'], propres: 1 },
    },
    'Mis à jour la liste par import : 0 ajouté, 1 modifié ; 1 conflit avec sa propre organisation retiré ; ' +
      '« Société Alpha » et « Société Beta » quittent les inclusions ; 1 inclusion de sa propre organisation retirée',
  ],
  [
    'ORGANISATION_INCONNUE',
    { organisation: 'Atelier Pivoine', remede: null },
    "L'organisation « Atelier Pivoine » n'existe pas : aucune personne de l'événement ne la porte.",
  ],
  [
    'CONFLIT_PROPRE_ORGANISATION',
    { personne: 'Iris Ombrelle', organisation: 'Club des Merles', remede: null },
    "Iris Ombrelle appartient à « Club des Merles » : une organisation n'est pas en conflit avec elle-même.",
  ],
  [
    'INCLUSION_PROPRE_ORGANISATION',
    { personne: 'Iris Ombrelle', organisation: 'Club des Merles', remede: null },
    'Iris Ombrelle appartient à « Club des Merles » : une inclusion nomme une autre organisation que la sienne.',
  ],
  [
    'INCLUSION_DE_SOI',
    { personne: 'Iris Ombrelle', remede: null },
    'Iris Ombrelle ne se rencontre pas elle-même : une inclusion nomme une autre personne.',
  ],
  [
    'ENTREE_IMPORTER_PARTICIPANTS',
    { mode: 'mettreAJour', ajoutes: 1, misAJour: 2, retires: 0, ajuste: true },
    'Mis à jour la liste par import : 1 ajouté, 2 modifiés ; placement retenu ajusté',
  ],
  ['ENTREE_CHANGER_LOGO', { personne: 'Iris Ombrelle', effet: 'pose' }, 'Logo de Iris Ombrelle : posé'],
  ['ENTREE_CHANGER_LOGO', { personne: 'Théo Pervenche', effet: 'remplace' }, 'Logo de Théo Pervenche : remplacé'],
  ['ENTREE_CHANGER_LOGO', { personne: 'Basile Mélèze', effet: 'retire' }, 'Logo de Basile Mélèze : retiré'],
  [
    'LOGO_NON_ECRIT',
    {
      personne: 'Iris Ombrelle',
      chemin: `logo/${'0123456789abcdef'.repeat(4)}.png`,
      dossier: 'C:\\Données\\Soirée des Lucioles',
      cause: 'ENOSPC',
      remede: null,
    },
    `Le logo de Iris Ombrelle n'a pas pu s'écrire : « logo/${'0123456789abcdef'.repeat(4)}.png » dans le dossier ` +
      "« C:\\Données\\Soirée des Lucioles » (ENOSPC). Rien n'est enregistré : la personne garde son logo d'avant, ou aucun.",
  ],
  [
    'LOGO_NON_ECRIT',
    { personne: 'Théo Pervenche', chemin: `logo/${'fedcba9876543210'.repeat(4)}.png`, dossier: 'Soirée des Lucioles', cause: null, remede: null },
    `Le logo de Théo Pervenche n'a pas pu s'écrire : « logo/${'fedcba9876543210'.repeat(4)}.png » dans le dossier ` +
      "« Soirée des Lucioles ». Rien n'est enregistré : la personne garde son logo d'avant, ou aucun.",
  ],
  [
    'LOGO_ILLISIBLE',
    { fichier: 'IMG_0042.HEIC', remede: null },
    "Le fichier « IMG_0042.HEIC » ne s'ouvre pas comme une image : un logo se lit d'un fichier PNG, JPEG, GIF, WebP, " +
      "AVIF, BMP, ICO ou SVG. Une photo HEIC ou une image TIFF s'exporte d'abord en JPEG ou en PNG.",
  ],
  [
    'LOGO_TROP_GRAND',
    { fichier: 'affiche-lucioles.png', largeur: 12_000, hauteur: 9000, max: 50_000_000, remede: null },
    "L'image « affiche-lucioles.png » compte 12000 × 9000 pixels, au-delà des 50 millions de pixels qu'accepte un " +
      "logo : elle n'est pas ouverte. Une image réduite, exportée en JPEG ou en PNG, convient.",
  ],
  [
    'LOGO_TROP_GRAND',
    { fichier: 'bannière.webp', largeur: 400, hauteur: 300, max: 100_000, remede: null },
    "L'image « bannière.webp » compte 400 × 300 pixels, au-delà des 100000 pixels qu'accepte un " +
      "logo : elle n'est pas ouverte. Une image réduite, exportée en JPEG ou en PNG, convient.",
  ],
  [
    'IMPORT_EN_RETENU',
    {},
    "L'import change la liste après le choix d'un placement : le placement retenu suit la présence de chacun, " +
      "les arrivées en réserve et les départs laissant leur chaise vide, sans que personne d'autre n'y change de place ; " +
      "à vous de juger s'il convient encore.",
  ],
];
