// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// L'attribution des teintes d'organisation des listes : les organisations
// distinctes de l'événement, rangées par le comparateur de noms du projet,
// reçoivent les rangs 1 à RANGS_ORGANISATION dans l'ordre ; au-delà, null,
// la pastille neutre. L'attribution se calcule sur toute la liste, exclues
// comprises : un filtre, une exclusion ou l'ordre des lignes ne repeint
// rien. Les noms sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { RANGS_ORGANISATION, teintesOrganisations } from './organisations.js';

// Des participants d'épreuve, un par organisation donnée, dans l'ordre reçu.
const personnes = (...organisations) =>
  organisations.map((organisation, rang) => ({ id: rang + 1, nom: `Personne ${rang + 1}`, organisation, exclu: false }));

describe('teintesOrganisations', () => {
  test('six rangs au plus', () => {
    assert.equal(RANGS_ORGANISATION, 6);
  });

  test('les organisations distinctes, rangées par leur clé normalisée, reçoivent 1, 2, 3 ; une Map dans cet ordre', () => {
    const teintes = teintesOrganisations(personnes('Ordre des Pluviers', 'Cercle des Aulnes', 'ordre des pluviers', 'Cercle des Aulnes', 'Bastion des Ifs'));
    assert.ok(teintes instanceof Map);
    assert.deepEqual([...teintes], [
      ['Bastion des Ifs', 1],
      ['Cercle des Aulnes', 2],
      ['Ordre des Pluviers', 3],
      ['ordre des pluviers', 4],
    ]);
  });

  test('casse et accents mis à part, l’ordre est celui de la clé ; deux orthographes de même clé se départagent par leurs points de code', () => {
    const teintes = teintesOrganisations(personnes('Écluse des Saules', 'echo des Noues', 'Ecluse des Saules', 'Dune'));
    assert.deepEqual([...teintes.keys()], ['Dune', 'echo des Noues', 'Ecluse des Saules', 'Écluse des Saules']);
  });

  test('au-delà de six organisations, null ; une personne sans organisation ne compte pas', () => {
    const noms = ['Hêtraie', 'Gué', 'Futaie', 'Estran', 'Dolmen', 'Combe', 'Bocage', 'Aber'];
    const teintes = teintesOrganisations(personnes(...noms, null, null));
    assert.deepEqual([...teintes], [
      ['Aber', 1],
      ['Bocage', 2],
      ['Combe', 3],
      ['Dolmen', 4],
      ['Estran', 5],
      ['Futaie', 6],
      ['Gué', null],
      ['Hêtraie', null],
    ]);
    assert.equal(teintes.has(null), false);
  });

  test('l’ordre des lignes, un filtre ou une exclusion ne changent aucun rang : l’attribution lit toute la liste', () => {
    const liste = personnes('Combe', 'Aber', 'Bocage', 'Aber');
    const reference = teintesOrganisations(liste);
    assert.deepEqual([...teintesOrganisations([...liste].reverse())], [...reference]);
    const exclue = liste.map((p) => (p.organisation === 'Aber' ? { ...p, exclu: true } : p));
    assert.deepEqual([...teintesOrganisations(exclue)], [...reference]);
  });

  test('une liste vide rend une Map vide ; la liste reçue n’est pas modifiée', () => {
    assert.equal(teintesOrganisations([]).size, 0);
    const liste = Object.freeze(personnes('Combe', 'Aber').map((p) => Object.freeze(p)));
    assert.deepEqual([...teintesOrganisations(liste)], [['Aber', 1], ['Combe', 2]]);
  });

  test('une organisation ni chaîne ni null lève TypeError en nommant la personne', () => {
    assert.throws(() => teintesOrganisations([{ id: 7, organisation: 12 }]), (erreur) => erreur instanceof TypeError && /7/.test(erreur.message));
    assert.throws(() => teintesOrganisations([{ id: 8 }]), TypeError);
  });
});
