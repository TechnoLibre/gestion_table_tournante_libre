// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les exemples des textes de src/application/libelles/stockage.js, que
// src/application/libelles.test.js réunit. EXEMPLES porte, pour chaque code
// dont cette table a le texte, une paire [code, détails] dont le texte se
// compose une fois ; un code n'a d'exemple que dans le fichier de sa table.
// TEXTES porte des triplets [code, détails, texte attendu], composés mot
// pour mot. Les noms sont inventés.

export const EXEMPLES = [
  // Système de fichiers et dépôt
  ['ABSENT', { chemin: 'Soirée des Lucioles.gtt.json' }],
  ['ECRITURE', { chemin: 'Soirée des Lucioles.gtt.json', dossier: 'E:\\data', cause: 'EROFS' }],
  ['LECTURE', { chemin: 'Soirée des Lucioles.gtt.json', dossier: 'E:\\data', cause: 'EACCES' }],
  ['EXISTE', { chemin: 'Soirée des Lucioles.gtt.json' }],
  ['NON_VIDE', { chemin: 'Soirée des Lucioles' }],
  ['CHEMIN_REFUSE', { chemin: '../ailleurs.gtt.json' }],
  ['ETAT_ILLISIBLE', { base: 'Soirée des Lucioles', raison: 'JSON', chemin: null, secours: { precedent: 4, journal: 5 } }],
  ['CORRECTIF', { rang: 2 }],
  ['CHEMIN_TROP_LONG', { racine: 'E:\\un\\dossier\\profond' }],
  ['IDENTIFIANT_PRESENT', { id: 'evt-lucioles', base: 'Soirée des Lucioles' }],
  ['VERROU_PRIS', { seance: 'seance-autre', depuis: '2031-05-17T08:05:00-04:00', vivant: true }],
  ['LECTURE_SEULE', { raison: 'BLOQUE' }],
  ['ETAT_NON_ECRIT', { chemin: 'Soirée des Lucioles.gtt.json', dossier: 'E:\\data', cause: 'EIO' }],
  ['CORBEILLE_SATUREE', { dossier: 'corbeille/2031-05-17_08-05-00_99' }],
  ['COMPTEUR_SATURE', { compteur: 'proposition' }],
  ['NON_DISPONIBLE', { primitive: 'ouvrirDansExplorateur' }],
  ['TROP_VOLUMINEUX', { chemin: 'affiche-lucioles.png', dossier: 'E:\\images', taille: 31_457_281, max: 26_214_400 }],
  ['LOGOS_NON_COPIES', { evenement: 'Soirée des Lucioles', logos: 2, personnes: 3, imageBadges: false }],
  // Raisons d'un état illisible
  ['VIDE', {}],
  ['JSON', {}],
  ['FORME', { chemin: 'charge.participants[2].nom' }],
  ['COMPTES', { chemin: 'entete.comptes.tables' }],
  ['REFERENCE', { chemin: 'charge.reservations[0].table' }],
  ['FORMAT_INCONNU', { chemin: 'entete.format' }],
  ['FORMAT_PLUS_RECENT', { format: 2 }],
  ['FORMAT_TROP_ANCIEN', { format: 2 }],
  ['ENCODAGE', {}],
  // Fautes d'un placement
  ['LONGUEUR', { tour: 2, table: 4, declare: 8, ecrit: 9 }],
  ['DOUBLON', { tour: 1, participant: 3 }],
  ['INCONNU', { tour: 1, participant: 12 }],
  ['MANQUANT', { tour: 2, participant: 7 }],
  ['IDENTIFIANT_REPETE', {}],
  ['IDENTIFIANT_HORS_COMPTEUR', {}],
  ['DERIVATION', { chemin: 'toursFiges[1]', raison: 'tourHorsSoiree' }],
  // Raisons de dérive
  ['PARTICIPANT_EXCLU', { participant: 3 }],
  ['PARTICIPANT_SUPPRIME', { participant: 4 }],
  ['PARTICIPANT_NON_PLACE', { participant: 9 }],
  ['TABLE_SUPPRIMEE', { table: 2 }],
  ['TABLE_AJOUTEE', { table: 5 }],
  ['CAPACITE_CHANGEE', { table: 1, avant: 8, maintenant: 6 }],
  ['TOURS_CHANGES', { avant: 4, maintenant: 3 }],
  ['PRESENCE_RETIREE', { participant: 6, tours: [3, 4] }],
  ['PRESENCE_AJOUTEE', { participant: 7, tours: [1] }],
  // Avertissements de l'ouverture
  ['RETENU_FAUTIF', {}],
  ['JOURNAL_REPRIS', {}],
  ['JOURNAL_EN_AVANCE_DE', { n: 3 }],
  ['JOURNAL_INCOMPLET', { etat: 9, journal: 6 }],
  ['JOURNAL_ECARTEES', { n: 64 }],
  ['JOURNAL_RECREE', {}],
  ['JOURNAL_FORMAT_PLUS_RECENT', { format: 2 }],
  ['JOURNAL_ILLISIBLE', { raison: 'ENCODAGE' }],
  ['JOURNAL_ETRANGER', { evenement: 'evt-autre' }],
  ['PROPOSITIONS_FAUTIVES', { ids: [3, null] }],
  ['PROPOSITIONS_MANQUANTES', { n: 2 }],
  ['DERIVE', { ids: [1, 2], retenu: true }],
  // Dossier de travail et réglages locaux
  ['NON_PUBLIE', {}],
  ['DONNEES_APPLICATIVES', {}],
  ['SONDE_ECHOUEE', { cause: 'EROFS' }],
  ['RELECTURE_DIFFERENTE', {}],
  ['NOM_NON_CONVERTI', {}],
  ['PORTABLE_NON_INSCRIPTIBLE', { racine: { id: 'portable', chemin: 'E:\\data' }, evenements: 3, cause: 'EROFS' }],
  ['DOCUMENTS_NON_INSCRIPTIBLE', { racine: { id: 'documents', chemin: 'C:\\Documents\\Table' }, evenements: 0, cause: 'EACCES' }],
  ['PLATEFORME_WEB', {}],
  ['SUPPORT_AMOVIBLE', {}],
  ['REGLAGES_ILLISIBLES', { chemin: 'reglages_locaux.json', raison: 'FORME' }],
];

export const TEXTES = [
  // Les logos qu'une copie, un import ou l'écriture ailleurs n'ont pas
  // recopiés : le compte des fichiers, accordé, puis celui des personnes qui
  // en portent un, ou, sans personne, l'historique qui seul y renvoie.
  [
    'LOGOS_NON_COPIES',
    { evenement: 'Soirée des Lucioles', logos: 2, personnes: 3, imageBadges: false },
    "« Soirée des Lucioles » : 2 logos ne se sont pas recopiés, et 3 personnes y ont un logo introuvable. " +
      "Les originaux restent dans le dossier logo de l'événement d'origine : les recopier à la main dans " +
      'celui-ci les rend.',
  ],
  [
    'LOGOS_NON_COPIES',
    { evenement: 'Soirée des Lucioles', logos: 1, personnes: 1, imageBadges: false },
    "« Soirée des Lucioles » : 1 logo ne s'est pas recopié, et 1 personne y a un logo introuvable. " +
      "L'original reste dans le dossier logo de l'événement d'origine : le recopier à la main dans " +
      'celui-ci le rend.',
  ],
  [
    'LOGOS_NON_COPIES',
    { evenement: 'Soirée des Lucioles', logos: 1, personnes: 0, imageBadges: false },
    "« Soirée des Lucioles » : 1 logo ne s'est pas recopié ; aucune personne ne le porte. L'original reste " +
      "dans le dossier logo de l'événement d'origine : le recopier à la main dans celui-ci le rend.",
  ],
  // L'image des badges restée en arrière : une phrase le dit, accordée au
  // compte des fichiers.
  [
    'LOGOS_NON_COPIES',
    { evenement: 'Soirée des Lucioles', logos: 1, personnes: 0, imageBadges: true },
    "« Soirée des Lucioles » : 1 logo ne s'est pas recopié ; aucune personne ne le porte. C'est l'image " +
      "des badges : les badges s'impriment sans elle tant qu'elle manque. L'original reste dans le " +
      "dossier logo de l'événement d'origine : le recopier à la main dans celui-ci le rend.",
  ],
  [
    'LOGOS_NON_COPIES',
    { evenement: 'Soirée des Lucioles', logos: 2, personnes: 3, imageBadges: true },
    "« Soirée des Lucioles » : 2 logos ne se sont pas recopiés, et 3 personnes y ont un logo introuvable. " +
      "L'image des badges en est un : les badges s'impriment sans elle tant qu'elle manque. Les originaux " +
      "restent dans le dossier logo de l'événement d'origine : les recopier à la main dans celui-ci les rend.",
  ],
  // La taille se dit en mégaoctets d'une décimale, arrondie au-dessus : un
  // fichier d'un octet de trop ne se dit jamais du poids du plafond.
  [
    'TROP_VOLUMINEUX',
    { chemin: 'affiche-lucioles.png', dossier: null, taille: 26_214_401, max: 26_214_400 },
    "Le fichier « affiche-lucioles.png » pèse 25,1 Mo, au-delà des 25 Mo qu'accepte une image : " +
      "il n'est pas lu. Une image plus petite, ou réenregistrée en JPEG ou en PNG, convient.",
  ],
  [
    'TROP_VOLUMINEUX',
    { chemin: 'affiche-lucioles.png', dossier: 'E:\\images', taille: 31_457_280, max: 26_214_400 },
    "Le fichier « affiche-lucioles.png » pèse 30 Mo, au-delà des 25 Mo qu'accepte une image : " +
      "il n'est pas lu. Une image plus petite, ou réenregistrée en JPEG ou en PNG, convient.",
  ],
  [
    'NON_VIDE',
    { chemin: 'Soirée des Lucioles' },
    "Le dossier « Soirée des Lucioles » n'est pas vide : il reste en place, avec tout ce qu'il contient.",
  ],
  ['PRESENCE_RETIREE', { participant: 6, personne: 'Capucine Ellébore', tours: [3, 4] }, 'Capucine Ellébore est absente aux tours 3 et 4 depuis.'],
  ['PRESENCE_RETIREE', { participant: 6, tours: [2, 3, 4] }, 'La personne n° 6 est absente aux tours 2 à 4 depuis.'],
  ['PRESENCE_AJOUTEE', { participant: 7, personne: 'Dahlia Bourrache', tours: [1] }, 'Dahlia Bourrache est présente au tour 1 depuis.'],
  ['PRESENCE_AJOUTEE', { participant: 7, tours: [1, 3, 5] }, 'La personne n° 7 est présente aux tours 1, 3 et 5 depuis.'],
  ['FORMAT_TROP_ANCIEN', { format: 2 }, "Son format est trop ancien (format 2) : il n'est plus pris en charge."],
  [
    'ETAT_ILLISIBLE',
    {
      base: 'Soirée des Lucioles',
      raison: 'FORMAT_TROP_ANCIEN',
      chemin: 'entete.format',
      format: 1,
      secours: { precedent: null, journal: null },
    },
    "Le fichier d'état de « Soirée des Lucioles » ne s'ouvre pas. Son format est trop ancien (format 1) : " +
      "il n'est plus pris en charge. Aucune version de secours ne se lit.",
  ],
  // L'état manque à côté d'un journal trop ancien : ouvrir le refuse au
  // chemin du journal, sous la base.
  [
    'ETAT_ILLISIBLE',
    {
      base: 'Soirée des Lucioles',
      raison: 'FORMAT_TROP_ANCIEN',
      chemin: 'Soirée des Lucioles.gtt-journal.jsonl',
      format: 1,
      secours: { precedent: null, journal: null },
    },
    "Le fichier d'état de « Soirée des Lucioles » ne s'ouvre pas. Le fichier d'état manque, à côté de son " +
      "historique, dont le format est trop ancien (format 1) : il n'est plus pris en charge. " +
      'Aucune version de secours ne se lit.',
  ],
  // Le secours 'journal' refuse un journal trop ancien, sans base.
  [
    'ETAT_ILLISIBLE',
    { raison: 'FORMAT_TROP_ANCIEN', chemin: 'Soirée des Lucioles.gtt-journal.jsonl', format: 2 },
    "Le fichier ne s'ouvre pas. L'historique « Soirée des Lucioles.gtt-journal.jsonl » a un format trop " +
      "ancien (format 2) : il n'est plus pris en charge.",
  ],
  [
    'JOURNAL_ILLISIBLE',
    { raison: 'FORMAT_TROP_ANCIEN', format: 2 },
    "L'historique à côté de ce fichier ne se lit pas. Son format est trop ancien (format 2) : " +
      "il n'est plus pris en charge. Il est laissé tel quel, et le prochain geste commence l'historique " +
      'dans un nouveau fichier.',
  ],
  // L'ouvreur du système en échec dit que l'ouverture a échoué, sa cause
  // citée ; une commande que la plateforme n'offre pas se dit absente.
  ['NON_DISPONIBLE', { cause: 'xdg-open : statut 3' }, "L'ouverture a échoué (xdg-open : statut 3)."],
  ['NON_DISPONIBLE', { primitive: 'ouvrirDansExplorateur' }, "Cette commande n'est pas offerte ici."],
  // Des réglages locaux qui ne se lisent pas disent la raison en clair :
  // LECTURE ne se cite jamais, la cause du système se cite ; des octets hors
  // UTF-8 et un lien qui sort du dossier ont leur phrase.
  [
    'REGLAGES_ILLISIBLES',
    { chemin: 'reglages_locaux.json', raison: 'LECTURE' },
    'Les réglages locaux « reglages_locaux.json » ne se lisent pas. Le système en refuse la lecture. ' +
      'Le fichier reste tel quel : le papier choisi vaut pour cette séance, sans être retenu sur cette ' +
      "machine, et le cadrage n'est pas retenu.",
  ],
  [
    'REGLAGES_ILLISIBLES',
    { chemin: 'reglages_locaux.json', raison: 'LECTURE', cause: 'EACCES' },
    'Les réglages locaux « reglages_locaux.json » ne se lisent pas. Le système en refuse la lecture (EACCES). ' +
      'Le fichier reste tel quel : le papier choisi vaut pour cette séance, sans être retenu sur cette ' +
      "machine, et le cadrage n'est pas retenu.",
  ],
  [
    'REGLAGES_ILLISIBLES',
    { chemin: 'reglages_locaux.json', raison: 'LECTURE', cause: 'UTF8_INVALIDE' },
    "Les réglages locaux « reglages_locaux.json » ne se lisent pas. Le fichier n'est pas encodé en UTF-8 : " +
      'réenregistré en UTF-8, il se relit. Le fichier reste tel quel : le papier choisi vaut pour cette ' +
      "séance, sans être retenu sur cette machine, et le cadrage n'est pas retenu.",
  ],
  [
    'REGLAGES_ILLISIBLES',
    { chemin: 'reglages_locaux.json', raison: 'CHEMIN_REFUSE' },
    'Les réglages locaux « reglages_locaux.json » ne se lisent pas. Le fichier mène hors du dossier de ' +
      "travail, par un lien : l'application ne le suit pas. Le fichier reste tel quel : le papier choisi " +
      "vaut pour cette séance, sans être retenu sur cette machine, et le cadrage n'est pas retenu.",
  ],
];
