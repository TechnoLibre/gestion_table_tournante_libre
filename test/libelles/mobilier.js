// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les exemples des textes de src/application/libelles/mobilier.js, que
// src/application/libelles.test.js réunit. EXEMPLES porte, pour chaque code
// dont cette table a le texte, une paire [code, détails] dont le texte se
// compose une fois ; un code n'a d'exemple que dans le fichier de sa table.
// TEXTES porte des triplets [code, détails, texte attendu], composés mot
// pour mot. Les noms sont inventés.

export const EXEMPLES = [
  // Mobilier : saisies, capacité, sièges retirés, libellés figés
  ['NON_ENTIER', { saisie: '8abc', remede: null }],
  ['MOINS_DE_DEUX', { remede: null }],
  ['MOINS_D_UN_TOUR', { tours: 0, remede: null }],
  ['TROP_DE_PLACES', { max: 1000, remede: null }],
  ['TROP_DE_TOURS', { max: 100, remede: null }],
  ['SOUS_RESERVATIONS', { table: 2, n: 7, tour: 1, remede: { geste: 'afficherTour', tour: 1, proposition: null } }],
  ['SOUS_OCCUPES', { table: 2, n: 7, tour: 3, remede: { geste: 'afficherTour', tour: 3, proposition: null } }],
  [
    'SIEGES_RETIRES',
    {
      table: 2,
      sieges: [
        { siege: 8, cause: 'SIEGE_TITRE', libelle: 'animateur' },
        { siege: 7, cause: 'SIEGE_RESERVE', participant: 1, suspendue: true },
      ],
      remede: { commande: 'retirerTitre', arguments: { table: 2, siege: 8 } },
    },
  ],
  ['SIEGE_RESERVE', { siege: 7, participant: 1, suspendue: false }],
  ['SIEGE_TITRE', { siege: 8, libelle: 'animateur' }],
  ['SURNUMERAIRES', { table: 3, tour: 2, personnes: [16, 17] }],
  ['AU_DELA_LISIBLE', { seuil: 16 }],
  ['LISTE_SUR_VOISINE', { table: 4, voisine: 7, numero: 3, numeroVoisine: 5, remede: { commande: 'deplacerTable', arguments: { id: 7, position: { x: 1626, y: 0 } } } }],
  ['ENTREE_CREER_TABLE', { numero: 3 }],
  ['ENTREE_SUPPRIMER_TABLE', { numero: 2, reservations: 2, titres: 1 }],
  ['ENTREE_DEPLACER_TABLE', { numero: 3 }],
  ['ENTREE_CHANGER_PLACES_TABLE', { numero: 5, sieges: 10 }],
  ['ENTREE_REALIGNER_TABLE', { numero: 5, sieges: 8 }],
  ['ENTREE_CHANGER_DEFAUT', { sieges: 10, realignees: 4 }],
  ['ENTREE_CHANGER_TOURS', { tours: 3, retirees: 2 }],
  [
    'PRESENCE_VIDEE_PAR_TOURS',
    { participants: [{ participant: 4, personne: 'Iris Ombrelle' }], tours: 3, remede: { geste: 'ouvrirSection', section: 'participants' } },
  ],
  ['PRESENCE_TOURS_AJOUTES', { personnes: [{ participant: 2, personne: 'Théo Pervenche' }] }],
  ['ENTREE_MODIFIER_REGLAGE', { cle: 'separerAppartenances', valeur: false }],
  // Objectifs des tables
  ['OBJECTIF_HORS_SOIREE', { tour: 5, remede: null }],
  ['OBJECTIF_SANS_ETIQUETTE', { table: 2, tour: 3, remede: { commande: 'retirerObjectif', arguments: { table: 2, tour: 3 } } }],
  ['TABLE_DISPARUE', { table: 9, remede: null }],
  ['OBJECTIF_SANS_CORRESPONDANT', { table: 2, tour: null }],
  ['ETIQUETTE_ORPHELINE', { etiquette: 'Finance', voisine: 'finance' }],
  ['ENTREE_POSER_OBJECTIF', { numero: 3, tour: 2, regle: 'et', etiquettes: ['Montréal', 'finance'] }],
  ['ENTREE_RETIRER_OBJECTIF', { numero: 3, tour: null }],
  ['ENTREE_CHANGER_REGLE_OBJECTIFS', { regle: 'et' }],
  // Ordre des priorités et mode des objectifs
  ['PRIORITES_INVALIDES', { faute: 'seulASonPalier', critere: 'ecartAuPlafondAPrioriMax', palier: 0, remede: null }],
  ['POIDS_HORS_DOMAINE', { valeur: 0, remede: null }],
  ['OBJECTIFS_PALIER_PARTAGE', { mode: 'chacun', palier: 1, remede: null }],
  ['ENTREE_CHANGER_PRIORITES', { criteres: ['collisionsCumulees'], palier: 1, paliers: 6, avec: ['excedentCollisions'], poids: null }],
  ['ENTREE_RETABLIR_PRIORITES', {}],
];

export const TEXTES = [
  [
    'PRESENCE_VIDEE_PAR_TOURS',
    { participants: [{ participant: 4, personne: 'Iris Ombrelle' }], tours: 3, remede: { geste: 'ouvrirSection', section: 'participants' } },
    "Avec 3 tours, Iris Ombrelle ne serait présente à aucun tour : changer d'abord sa présence, ou l'exclure.",
  ],
  [
    'PRESENCE_VIDEE_PAR_TOURS',
    {
      participants: [
        { participant: 4, personne: 'Iris Ombrelle' },
        { participant: 6, personne: 'Théo Pervenche' },
      ],
      tours: 1,
      remede: { geste: 'ouvrirSection', section: 'participants' },
    },
    "Avec 1 tour, Iris Ombrelle et Théo Pervenche ne seraient présentes à aucun tour : changer d'abord leur présence, ou les exclure.",
  ],
  [
    'PRESENCE_TOURS_AJOUTES',
    { personnes: [{ participant: 2, personne: 'Théo Pervenche' }] },
    "Théo Pervenche reste absente aux tours ajoutés : une présence qui nomme ses tours ne s'étend pas d'elle-même. " +
      "Changer sa présence pour l'y compter.",
  ],
  [
    'PRESENCE_TOURS_AJOUTES',
    { personnes: [{ participant: 2, personne: 'Théo Pervenche' }, { participant: 5, personne: 'Grisaille' }] },
    "Théo Pervenche et Grisaille restent absentes aux tours ajoutés : une présence qui nomme ses tours ne s'étend pas " +
      "d'elle-même. Changer leur présence pour les y compter.",
  ],
  ['ENTREE_CHANGER_TOURS', { tours: 3, retirees: 0, presencesRognees: 1 }, 'Nombre de tours : 3 ; 1 présence rognée'],
  [
    'ENTREE_CHANGER_TOURS',
    { tours: 3, retirees: 2, objectifsRetires: 1, presencesRognees: 2 },
    'Nombre de tours : 3 ; 2 réservations retirées, 1 objectif retiré, 2 présences rognées',
  ],
];
