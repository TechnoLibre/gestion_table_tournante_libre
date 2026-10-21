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
  ['PLANCHE_TROP_DE_TOURS', { tours: 40, remede: null }],
  ['PLANCHE_NOM_TROP_LONG', { participant: 3, personne: 'Ondine Lacasse', remede: { geste: 'ouvrirSection', section: 'participants' } }],
  ['PLANCHE_NON_ECRITE', { chemin: 'Soirée des Lucioles.badges_A4_feuille_2031-05-17_20-15-07.pdf', dossier: 'E:\\data', cause: 'EROFS', remede: { geste: 'enregistrerSous' } }],
];

export const TEXTES = [
  // Une ligne de tour : la place, « pas de table » en réserve, « absente » à
  // un tour d'absence, où ni table, ni siège, ni titre ne s'écrivent.
  ['planche.absente', {}, 'absente'],
  ['planche.tour', { tour: 2, table: null, siege: null, titre: null, absente: true }, 'Tour 2 \u{2014} absente'],
  ['planche.tour', { tour: 2, table: null, siege: null, titre: null, absente: false }, 'Tour 2 \u{2014} pas de table'],
  ['planche.tour', { tour: 3, table: 7, siege: 2, titre: 'animatrice', absente: false }, 'Tour 3 \u{2014} table 7, siège 2 \u{2014} animatrice'],
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
];
