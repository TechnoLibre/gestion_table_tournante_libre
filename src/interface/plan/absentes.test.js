// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La carte « Absentes » du plan (§ 7.1), sans DOM : les personnes absentes
// au tour montré, dans l'ordre de l'état des places, chacune avec son nom
// affiché et sa présence saisie ; aucune sans absente. Les libellés de la
// carte se composent mot pour mot. Les noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { etatPlaces } from '../../application/places.js';
import { creerTraduction } from '../../application/traduction.js';
import { creerCharge } from '../../stockage/document.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { absentesDuTour } from './absentes.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

// Quatre tours, une table de six, cinq personnes, aucune proposition :
// Iris Ombrelle présente aux tours 1 et 2, Grisaille au tour 4, Théo
// Pervenche à tous ; Ondine Lacasse, exclue, présente au tour 1 seulement ;
// Basile Tourmaline aux tours 1, 2 et 4.
function chargeDEpreuve() {
  const charge = creerCharge({ id: 'epreuve-absentes', nom: 'Club des Merles', siegesParDefaut: 6, tours: 4 });
  charge.tables = [{ id: 1, numero: 1, sieges: null, forme: 'ronde', position: { x: 0, y: 0 } }];
  const personne = (id, prenom, nom, champs = {}) => ({
    id,
    nom,
    prenom,
    appartenance: null,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
    ...champs,
  });
  charge.participants = [
    personne(1, 'Iris', 'Ombrelle', { presence: [1, 2] }),
    personne(2, null, 'Grisaille', { presence: [4] }),
    personne(3, 'Théo', 'Pervenche'),
    personne(4, 'Ondine', 'Lacasse', { exclu: true, presence: [1] }),
    personne(5, 'Basile', 'Tourmaline', { presence: [1, 2, 4] }),
  ];
  charge.prochainsIds = { participant: 6, table: 2, proposition: 1 };
  return charge;
}

const absentes = (charge, tour) => absentesDuTour(etatPlaces(charge, { tour }), charge);

describe('absentesDuTour : les absentes du tour montré (§ 7.1)', () => {
  test('dans l’ordre de l’état des places, chacune avec son nom affiché et sa présence saisie', () => {
    const charge = chargeDEpreuve();
    assert.deepEqual(absentes(charge, 3), [
      { id: 1, nom: 'Iris Ombrelle', presence: [1, 2] },
      { id: 2, nom: 'Grisaille', presence: [4] },
      { id: 5, nom: 'Basile Tourmaline', presence: [1, 2, 4] },
    ]);
    assert.deepEqual(absentes(charge, 1), [{ id: 2, nom: 'Grisaille', presence: [4] }]);
  });

  test('l’ordre est celui que l’état des places reçoit, sans nouveau tri', () => {
    const charge = chargeDEpreuve();
    const etat = { ...etatPlaces(charge, { tour: 3 }), absents: [5, 1] };
    assert.deepEqual(absentesDuTour(etat, charge).map(({ id }) => id), [5, 1]);
  });

  test('aucune absente au tour : une liste vide ; une exclue n’y est jamais', () => {
    const charge = chargeDEpreuve();
    charge.participants = charge.participants.filter(({ id }) => id === 3 || id === 4);
    for (const tour of [1, 2, 3, 4]) assert.deepEqual(absentes(charge, tour), [], `tour ${tour}`);
  });
});

describe('les libellés de la carte « Absentes »', () => {
  test('le titre, le sous-titre du tour, la présence de chaque nom', () => {
    assert.equal(t('plan.absentes.titre'), 'Absentes');
    assert.equal(t('plan.absentes.tour', { tour: 3 }), 'Personnes absentes au tour 3, sans chaise ni place en réserve');
    assert.equal(t('plan.absentes.presente', { tours: [1, 2] }), ' \u{2014} présente aux tours 1 et 2');
    assert.equal(t('plan.absentes.presente', { tours: [4] }), ' \u{2014} présente au tour 4');
    assert.equal(t('plan.absentes.presente', { tours: [1, 2, 4] }), ' \u{2014} présente aux tours 1, 2 et 4');
    assert.equal(t('plan.absentes.presente', { tours: null }), '');
  });
});
