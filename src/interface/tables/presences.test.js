// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du modèle du tableau « Personnes présentes par tour » (§ 6.1) :
// rien sans absence, la recopie de capaciteParTour sous absence, et le ton
// de chaque ligne. Les noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { capaciteParTour } from '../../application/bilans.js';
import { creerCharge } from '../../stockage/document.js';
import { lignesPresences } from './presences.js';

const NOMS = [
  ['Ombrelle', 'Iris'],
  ['Pervenche', 'Théo'],
  ['Lacasse', 'Ondine'],
  ['Grisaille', null],
];

// Une personne ; presence, quand elle est donnée, devient son champ.
function personne(id, { exclu = false, presence } = {}) {
  const fiche = {
    id,
    nom: NOMS[(id - 1) % NOMS.length][0],
    prenom: NOMS[(id - 1) % NOMS.length][1],
    appartenance: null,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu,
  };
  if (presence !== undefined) fiche.presence = presence;
  return fiche;
}

// Une charge de deux tables, l'une qui suit le défaut de 2, l'autre
// surchargée à sieges2 ; R tours ; n personnes, dont les présences et les
// exclues données par identifiant.
function chargeDe({ n, tours = 3, sieges2 = 2, presences = {}, exclus = [] }) {
  const charge = creerCharge({ id: 'evt-presences', nom: 'Soirée des Grèbes', siegesParDefaut: 2, tours });
  charge.participants = Array.from({ length: n }, (_, rang) =>
    personne(rang + 1, { exclu: exclus.includes(rang + 1), presence: presences[rang + 1] }),
  );
  charge.tables = [
    { id: 1, numero: 1, sieges: null, forme: 'ronde', position: { x: 0, y: 0 } },
    { id: 2, numero: 2, sieges: sieges2, forme: 'ronde', position: { x: 300, y: 0 } },
  ];
  charge.prochainsIds = { participant: n + 1, table: 3, proposition: 1 };
  return charge;
}

describe('lignesPresences : le tableau des personnes présentes par tour (§ 6.1)', () => {
  test('sans absence : null, même quand une exclue porte une présence partielle', () => {
    assert.equal(lignesPresences(chargeDe({ n: 4 })), null);
    assert.equal(lignesPresences(chargeDe({ n: 4, presences: { 2: [1] }, exclus: [2] })), null);
  });

  test('sous absence : une ligne par tour, recopiée de capaciteParTour, sans rien recalculer', () => {
    const charge = chargeDe({ n: 6, presences: { 1: [1, 3], 2: [2] }, exclus: [6] });
    const lignes = lignesPresences(charge);
    const capacite = capaciteParTour(charge);
    assert.equal(lignes.length, 3);
    assert.deepEqual(
      lignes.map(({ tour, presentes, places, manque }) => ({ tour, presentes, places, manque })),
      capacite,
    );
    assert.deepEqual(
      lignes.map(({ tour, presentes, places, manque }) => [tour, presentes, places, manque]),
      [
        [1, 4, 4, 0],
        [2, 4, 4, 0],
        [3, 4, 4, 0],
      ],
    );
  });

  test('le ton : avis pour un manque positif, neutre pour un manque nul', () => {
    // Six personnes, quatre places : Théo Pervenche absente au tour 1, Iris
    // Ombrelle et Ondine Lacasse absentes au tour 3.
    const charge = chargeDe({ n: 6, presences: { 1: [1, 2], 2: [2, 3], 3: [1, 2] } });
    const lignes = lignesPresences(charge);
    assert.deepEqual(
      lignes.map(({ tour, presentes, manque, ton }) => [tour, presentes, manque, ton]),
      [
        [1, 5, 1, 'avis'],
        [2, 6, 2, 'avis'],
        [3, 4, 0, 'neutre'],
      ],
    );
  });

  test('la charge n’est pas touchée', () => {
    const charge = chargeDe({ n: 5, presences: { 1: [2] } });
    const avant = structuredClone(charge);
    lignesPresences(charge);
    assert.deepEqual(charge, avant);
  });
});
