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
  ['ENTREE_RETENIR_PROPOSITION', { id: 3, ajuste: false }],
  ['ENTREE_EFFACER_PROPOSITIONS', { n: 4, gardee: 2 }],
  ['ENTREE_GARDER_MEILLEURES', { n: 10, effacees: 37, gardee: 42 }],
  ['NETTOYAGE_SANS_CLASSEMENT', { n: 10, classees: 2, nonClassees: 3, remede: null }],
  ['ENTREE_ENREGISTRER_GENERATION_DERIVEE', { n: 5, premier: 21, dernier: 25, depart: 4, toursFiges: [1, 2] }],
  // Le départ d'une génération dérivée : les refus du lancement
  ['DEPART_ABSENT', { depart: 4, remede: { geste: 'repartirDeZero' } }],
  [
    'DEPART_NON_COMPARABLE',
    {
      depart: 4,
      statut: 'derive',
      raisons: [{ code: 'CAPACITE_CHANGEE', table: 2, avant: 3, maintenant: 4, numero: 7 }],
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
  // L'issue d'une génération dérivée dont le retenu vient du départ
  ['DEPART_ECART_AU_RETENU', { depart: 4, tours: [1, 2] }],
];

export const TEXTES = [
  ['ENTREE_RETENIR_PROPOSITION', { id: 3, ajuste: false }, 'Retenu la proposition n° 3'],
  ['ENTREE_RETENIR_PROPOSITION', { id: 3, ajuste: true }, 'Retenu la proposition n° 3 ; ajusté à la présence'],
  [
    'DEPART_ECART_AU_RETENU',
    { depart: 4, tours: [1, 2] },
    "Les tours figés 1 et 2 viennent de la proposition n° 4 : les retouches du placement retenu à ces tours n'y sont pas.",
  ],
  [
    'DEPART_ECART_AU_RETENU',
    { depart: 4, tours: [3] },
    "Le tour figé 3 vient de la proposition n° 4 : les retouches du placement retenu à ce tour n'y sont pas.",
  ],
  [
    'NETTOYAGE_SANS_CLASSEMENT',
    { n: 10, classees: 2, nonClassees: 3, remede: null },
    '3 propositions ne sont pas classées depuis le changement de participants : garder les 10 meilleures les effacerait ' +
      "sans les avoir comparées. Générer d'abord une dérivée.",
  ],
  [
    'NETTOYAGE_SANS_CLASSEMENT',
    { n: 1, classees: 0, nonClassees: 1, remede: null },
    "1 proposition n'est pas classée depuis le changement de participants : garder la meilleure l'effacerait " +
      "sans l'avoir comparée. Générer d'abord une dérivée.",
  ],
];
