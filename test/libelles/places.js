// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les exemples des textes de src/application/libelles/places.js, que
// src/application/libelles.test.js réunit. EXEMPLES porte, pour chaque code
// dont cette table a le texte, une paire [code, détails] dont le texte se
// compose une fois ; un code n'a d'exemple que dans le fichier de sa table.
// TEXTES porte des triplets [code, détails, texte attendu], composés mot
// pour mot. Les noms sont inventés.

export const EXEMPLES = [
  // Places : refus d'une pose, titres, réservations, retenu
  ['SIEGE_INEXISTANT', { table: 2, siege: 9, capacite: 8, remede: null }],
  ['DEUX_PLACES_MEME_TOUR', { participant: 1, tour: 2, autre: { table: 1, siege: null, portee: 'tous', tour: null }, remede: null }],
  ['PERSONNE_EXCLUE', { participant: 3, remede: null }],
  [
    'PERSONNE_ABSENTE_AU_TOUR',
    { participant: 2, personne: 'Théo Pervenche', tour: 3, remede: { commande: 'changerPresence', arguments: { id: 2, tours: [1, 3, 4] } } },
  ],
  ['PLACE_RESERVEE', { table: 2, siege: 3, tour: 2, titulaire: 2, portee: 'tour', remede: null }],
  ['RESERVEE_AILLEURS', { participant: 1, tour: 2, reservation: { table: 1, siege: null, portee: 'tous', tour: null }, remede: null }],
  ['TABLE_GELEE', { table: 1 }],
  ['LIBELLE_VIDE', { remede: null }],
  ['PLACE_TITREE', { table: 3, siege: 1, libelle: 'accueil', remede: null }],
  ['AUCUN_SIEGE_SANS_TITRE', { table: 1, capacite: 2, remede: null }],
  ['TITRE_ABSENT', { table: 3, siege: 1, remede: null }],
  ['RESERVATION_ABSENTE', { participant: 1, table: 3, portee: 'tour', tour: 2, remede: null }],
  ['CONVERSION_IMPOSSIBLE', { participant: 1, table: 3, remede: null }],
  ['PROPOSITION_MONTREE', { proposition: 4, remede: null }],
  ['SIEGE_OCCUPE', { table: 5, siege: 2, tour: 1, occupant: 2, remede: null }],
  ['TABLE_PLEINE', { table: 5, tour: 1, capacite: 6, remede: null }],
  ['RESERVATION_TOUS_LES_TOURS', { participant: 1, table: 3, remede: null }],
  ['RESERVATION_CE_TOUR', { participant: 1, table: 3, tour: 2, remede: null }],
  ['ABSENT_AU_TOUR', { participant: 6, personne: 'Capucine Sarcelle', tour: 3, remede: null }],
  [
    'ANIMATEUR_REFUSE',
    {
      participant: 5,
      personne: 'Anouk Bruyère',
      refus: { code: 'PERSONNE_EXCLUE', details: { participant: 5, autres: [] } },
      remede: { commande: 'reintegrerParticipant', arguments: { id: 5 } },
    },
  ],
  ['ENTREE_RESERVER', { personne: 'Théo Pervenche', numero: 4, siege: 2, portee: 'tour', tour: 2 }],
  ['ENTREE_RETIRER_RESERVATION', { personne: 'Théo Pervenche', numero: 4, portee: 'tous', tour: null }],
  ['ENTREE_DEPLACER_RESERVATION', { personne: 'Théo Pervenche', de: 4, vers: 7, siege: null, portee: 'tour', tour: 2 }],
  ['ENTREE_POSER_TITRE', { libelle: 'accueil', numero: 3, siege: 1 }],
  ['ENTREE_RETIRER_TITRE', { libelle: 'accueil', numero: 3, siege: 1 }],
  ['ENTREE_DESIGNER', { personne: 'Iris Ombrelle', numero: 3, siege: 1, libelle: 'accueil' }],
  ['ENTREE_DESIGNER_ANIMATEURS', { numero: 5, personnes: ['Iris Ombrelle', 'Théo Pervenche'] }],
  ['ENTREE_RETIRER_ANIMATEUR', { personne: 'Iris Ombrelle', numero: 5 }],
  ['ENTREE_CONVERTIR_EN_TOUS', { personne: 'Iris Ombrelle', numero: 3 }],
  ['ENTREE_DEPLACER_DANS_RETENU', { personne: 'Iris Ombrelle', de: 4, vers: 7, siege: null, tour: 2 }],
  ['ENTREE_ECHANGER_DANS_RETENU', { a: 'Iris Ombrelle', deA: 4, b: 'Théo Pervenche', deB: null, tour: 2 }],
  ['ENTREE_RETIRER_DU_TOUR', { personne: 'Iris Ombrelle', numero: 4, tour: 2 }],
];

export const TEXTES = [
  // Un tour que l'événement nomme : après son numéro dans une phrase, seul
  // dans une mention brève (aides.js).
  [
    'PERSONNE_ABSENTE_AU_TOUR',
    { participant: 2, personne: 'Théo Pervenche', tour: 2, remede: null, nomsTours: [null, 'Plat principal'] },
    "Théo Pervenche est absente au tour 2 (Plat principal) : la marquer présente à ce tour avant de l'y placer.",
  ],
  [
    'ENTREE_DEPLACER_DANS_RETENU',
    { personne: 'Iris Ombrelle', de: 4, vers: 7, siege: null, tour: 2, nomsTours: [null, 'Plat principal'] },
    'Déplacé Iris Ombrelle de la table 4 à la table 7, Plat principal',
  ],
  [
    'ENTREE_RESERVER',
    { personne: 'Théo Pervenche', numero: 4, siege: null, portee: 'tour', tour: 1, nomsTours: ['Apéritif', null] },
    'Réservé Théo Pervenche à la table 4, Apéritif',
  ],
  [
    'PERSONNE_ABSENTE_AU_TOUR',
    { participant: 2, personne: 'Théo Pervenche', tour: 3, remede: null },
    "Théo Pervenche est absente au tour 3 : la marquer présente à ce tour avant de l'y placer.",
  ],
  [
    'ANIMATEUR_REFUSE',
    {
      participant: 2,
      personne: 'Théo Pervenche',
      refus: { code: 'TABLE_PLEINE', details: { table: 5, tour: 1, capacite: 6 } },
      remede: null,
    },
    "Refus pour Théo Pervenche, aucun animateur n'est désigné. La table est pleine au tour 1 : ses 6 places sont occupées.",
  ],
  [
    'ABSENT_AU_TOUR',
    { participant: 6, personne: 'Capucine Sarcelle', tour: 2, remede: null },
    "Cette personne n'est pas présente au tour 2 : une table ne s'anime que par une personne présente à tous les tours.",
  ],
  [
    'ANIMATEUR_REFUSE',
    {
      participant: 6,
      personne: 'Capucine Sarcelle',
      refus: { code: 'ABSENT_AU_TOUR', details: { participant: 6, personne: 'Capucine Sarcelle', tour: 3 } },
      remede: { commande: 'changerPresence', arguments: { id: 6, tours: [1, 2, 3] } },
    },
    "Refus pour Capucine Sarcelle, aucun animateur n'est désigné. " +
      "Cette personne n'est pas présente au tour 3 : une table ne s'anime que par une personne présente à tous les tours.",
  ],
  [
    'ABSENT_AU_TOUR',
    { participant: 6, personne: 'Capucine Sarcelle', tour: 2, nomsTours: [null, 'Plat principal', null], remede: null },
    "Cette personne n'est pas présente au tour 2 (Plat principal) : une table ne s'anime que par une personne présente à tous les tours.",
  ],
  [
    'ANIMATEUR_REFUSE',
    {
      participant: 6,
      personne: 'Capucine Sarcelle',
      refus: { code: 'ABSENT_AU_TOUR', details: { participant: 6, personne: 'Capucine Sarcelle', tour: 3 } },
      nomsTours: [null, null, 'Dessert'],
      remede: { commande: 'changerPresence', arguments: { id: 6, tours: [1, 2, 3] } },
    },
    "Refus pour Capucine Sarcelle, aucun animateur n'est désigné. " +
      "Cette personne n'est pas présente au tour 3 (Dessert) : une table ne s'anime que par une personne présente à tous les tours.",
  ],
  ['ENTREE_DESIGNER_ANIMATEURS', { numero: 5, personnes: ['Iris Ombrelle'] }, 'Désigné 1 animateur à la table 5 : Iris Ombrelle'],
  [
    'ENTREE_DESIGNER_ANIMATEURS',
    { numero: 5, personnes: ['Iris Ombrelle', 'Théo Pervenche', 'Grisaille'] },
    'Désigné 3 animateurs à la table 5 : Iris Ombrelle, Théo Pervenche, Grisaille',
  ],
  ['ENTREE_RETIRER_ANIMATEUR', { personne: 'Iris Ombrelle', numero: 5 }, "Retiré l'animateur Iris Ombrelle de la table 5"],
];
