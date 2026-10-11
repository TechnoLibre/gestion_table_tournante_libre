// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'attribution des teintes d'appartenance des listes : les appartenances
// distinctes de l'événement, rangées par le comparateur de noms du projet,
// reçoivent les rangs 1 à RANGS_APPARTENANCE dans l'ordre ; au-delà, null,
// la pastille neutre. L'attribution se calcule sur toute la liste, exclues
// comprises : un filtre, une exclusion ou l'ordre des lignes ne repeint
// rien. Les noms sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { RANGS_APPARTENANCE, teintesAppartenances } from './appartenances.js';

// Des participants d'épreuve, un par appartenance donnée, dans l'ordre reçu.
const personnes = (...appartenances) =>
  appartenances.map((appartenance, rang) => ({ id: rang + 1, nom: `Personne ${rang + 1}`, appartenance, exclu: false }));

describe('teintesAppartenances', () => {
  test('six rangs au plus', () => {
    assert.equal(RANGS_APPARTENANCE, 6);
  });

  test('les appartenances distinctes, rangées par leur clé normalisée, reçoivent 1, 2, 3 ; une Map dans cet ordre', () => {
    const teintes = teintesAppartenances(personnes('Ordre des Pluviers', 'Cercle des Aulnes', 'ordre des pluviers', 'Cercle des Aulnes', 'Bastion des Ifs'));
    assert.ok(teintes instanceof Map);
    assert.deepEqual([...teintes], [
      ['Bastion des Ifs', 1],
      ['Cercle des Aulnes', 2],
      ['Ordre des Pluviers', 3],
      ['ordre des pluviers', 4],
    ]);
  });

  test('casse et accents mis à part, l’ordre est celui de la clé ; deux orthographes de même clé se départagent par leurs points de code', () => {
    const teintes = teintesAppartenances(personnes('Écluse des Saules', 'echo des Noues', 'Ecluse des Saules', 'Dune'));
    assert.deepEqual([...teintes.keys()], ['Dune', 'echo des Noues', 'Ecluse des Saules', 'Écluse des Saules']);
  });

  test('au-delà de six appartenances, null ; une personne sans appartenance ne compte pas', () => {
    const noms = ['Hêtraie', 'Gué', 'Futaie', 'Estran', 'Dolmen', 'Combe', 'Bocage', 'Aber'];
    const teintes = teintesAppartenances(personnes(...noms, null, null));
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
    const reference = teintesAppartenances(liste);
    assert.deepEqual([...teintesAppartenances([...liste].reverse())], [...reference]);
    const exclue = liste.map((p) => (p.appartenance === 'Aber' ? { ...p, exclu: true } : p));
    assert.deepEqual([...teintesAppartenances(exclue)], [...reference]);
  });

  test('une liste vide rend une Map vide ; la liste reçue n’est pas modifiée', () => {
    assert.equal(teintesAppartenances([]).size, 0);
    const liste = Object.freeze(personnes('Combe', 'Aber').map((p) => Object.freeze(p)));
    assert.deepEqual([...teintesAppartenances(liste)], [['Aber', 1], ['Combe', 2]]);
  });

  test('une appartenance ni chaîne ni null lève TypeError en nommant la personne', () => {
    assert.throws(() => teintesAppartenances([{ id: 7, appartenance: 12 }]), (erreur) => erreur instanceof TypeError && /7/.test(erreur.message));
    assert.throws(() => teintesAppartenances([{ id: 8 }]), TypeError);
  });
});
