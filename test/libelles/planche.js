// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

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
  ['PAPIER_REQUIS', { remede: { geste: 'choisirPapier' } }],
];

export const TEXTES = [];
