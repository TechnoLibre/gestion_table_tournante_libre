// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

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
  // Raisons d'un état illisible
  ['VIDE', {}],
  ['JSON', {}],
  ['FORME', { chemin: 'charge.participants[2].nom' }],
  ['COMPTES', { chemin: 'entete.comptes.tables' }],
  ['REFERENCE', { chemin: 'charge.reservations[0].table' }],
  ['FORMAT_INCONNU', { chemin: 'entete.format' }],
  ['FORMAT_PLUS_RECENT', { format: 2 }],
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
  ['PRESENCE_RETIREE', { participant: 6, personne: 'Capucine Ellébore', tours: [3, 4] }, 'Capucine Ellébore est absente aux tours 3 et 4 depuis.'],
  ['PRESENCE_RETIREE', { participant: 6, tours: [2, 3, 4] }, 'La personne n° 6 est absente aux tours 2 à 4 depuis.'],
  ['PRESENCE_AJOUTEE', { participant: 7, personne: 'Dahlia Bourrache', tours: [1] }, 'Dahlia Bourrache est présente au tour 1 depuis.'],
  ['PRESENCE_AJOUTEE', { participant: 7, tours: [1, 3, 5] }, 'La personne n° 7 est présente aux tours 1, 3 et 5 depuis.'],
];
