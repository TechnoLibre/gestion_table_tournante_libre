// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les exemples des textes de src/application/libelles/generation.js, que
// src/application/libelles.test.js réunit. EXEMPLES porte, pour chaque code
// dont cette table a le texte, une paire [code, détails] dont le texte se
// compose une fois ; un code n'a d'exemple que dans le fichier de sa table.
// TEXTES porte des triplets [code, détails, texte attendu], composés mot
// pour mot. Les noms sont inventés.

export const EXEMPLES = [
  // Génération
  ['GENERATION_EN_COURS', { remede: null }],
  ['TRAVAILLEUR_EN_ECHEC', { remede: null }],
  ['AUCUN_PARTICIPANT', { remede: { geste: 'ouvrirSection', section: 'participants' } }],
  ['AUCUNE_TABLE', { remede: { geste: 'ouvrirSection', section: 'tables' } }],
  [
    'CONFIRMATION_REQUISE',
    {
      estimation: {
        secondes: 1200,
        longue: true,
        auDelaDuPlafond: false,
        mesure: { dureeMs: 2000, mouvements: 1000000, participants: 260, nombre: 5, arret: 200000 },
      },
      remede: null,
    },
  ],
  ['HORS_DOMAINE', { min: 1, max: null, remede: null }],
  ['REGLAGE_HORS_DOMAINE', { reglage: 'arret', remede: null }],
  [
    'GENERATION_INVARIANT_VIOLE',
    {
      rang: 2,
      violations: [
        { code: 'RESERVATION', participant: 4, table: 5, tour: 1 },
        { code: 'CAPACITE', table: 5, tour: 2 },
      ],
      remede: null,
    },
  ],
  // Refus et avertissements des commandes
  ['PROPOSITION_INCONNUE', { id: 17, remede: null }],
  // Libellés figés du journal
  ['ENTREE_ENREGISTRER_GENERATION', { n: 5, premier: 3, dernier: 7 }],
  ['ENTREE_RETENIR_PROPOSITION', { id: 3 }],
  ['ENTREE_EFFACER_PROPOSITIONS', { n: 4, gardee: 2 }],
  ['ENTREE_GARDER_MEILLEURES', { n: 10, effacees: 37, gardee: 42 }],
  ['ENTREE_ENREGISTRER_GENERATION_DERIVEE', { n: 5, premier: 21, dernier: 25, depart: 4, toursFiges: [1, 2] }],
  // Le départ d'une génération dérivée : les refus du lancement
  ['DEPART_ABSENT', { depart: 4, remede: { geste: 'repartirDeZero' } }],
  [
    'DEPART_NON_COMPARABLE',
    {
      depart: 4,
      statut: 'derive',
      raisons: [{ code: 'PARTICIPANT_EXCLU', participant: 5, personne: 'Maëlle Quenouille' }],
      remede: { geste: 'repartirDeZero' },
    },
  ],
  ['TOUR_FIGE_HORS_SOIREE', { tour: 4, tours: 3, remede: { geste: 'libererTour', tour: 4 } }],
  ['TOURS_FIGES_TOUS', { tours: 3, remede: null }],
  [
    'DEPART_RESERVATION_NON_TENUE',
    { depart: 4, participant: 2, table: 1, tour: 2, personne: 'Théo Pervenche', numero: 3, remede: { geste: 'repartirDeZero' } },
  ],
  [
    'DEPART_SIEGE_NON_TENU',
    {
      depart: 4,
      participant: 1,
      table: 1,
      siege: 2,
      tour: 1,
      personne: 'Iris Ombrelle',
      numero: 3,
      remede: { geste: 'libererTour', tour: 1 },
    },
  ],
  // Le tour figé que l'enregistrement trouve différent de son départ
  ['TOUR_FIGE_DIFFERENT', { rang: 3, tour: 2, remede: null }],
];

export const TEXTES = [];
