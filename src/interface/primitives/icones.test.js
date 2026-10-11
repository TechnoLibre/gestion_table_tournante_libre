// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le module des icônes des primitives : chaque icône est une liste de tracés
// SVG au trait, dans un carré de 24 unités, sans couleur ni texte ; une icône
// inconnue lève plutôt que de dessiner un vide.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { ICONES, NOMS_ICONES, traceIcone } from './icones.js';

// Les commandes d'un tracé SVG, leurs nombres, leurs séparateurs : rien
// d'autre.
const TRACE = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/;

describe('icônes des primitives', () => {
  test('les icônes du contrat, dans l’ordre, chacune une liste figée de tracés non vides', () => {
    assert.deepEqual(NOMS_ICONES, [
      'crayon', 'listePoints', 'coche', 'cadenas', 'liste', 'importer', 'exporter', 'ajouter', 'chercher',
      'calendrier', 'information', 'triangle', 'interdit', 'dossier', 'oeil', 'stylo', 'defaire', 'imprimer',
      'etoile', 'croix', 'chevron', 'points', 'demarrer', 'etiquettes',
    ]);
    assert.ok(Object.isFrozen(ICONES) && Object.isFrozen(NOMS_ICONES));
    assert.deepEqual(Object.keys(ICONES).sort(), [...NOMS_ICONES].sort());
    for (const nom of NOMS_ICONES) {
      const traces = ICONES[nom];
      assert.ok(Array.isArray(traces) && traces.length > 0 && Object.isFrozen(traces), nom);
      for (const trace of traces) {
        assert.match(trace, TRACE, nom);
        assert.match(trace, /^M/, `${nom} : un tracé commence par M`);
      }
    }
  });

  test('chaque tracé reste dans le carré de 24 unités : ses coordonnées absolues entre 0 et 24', () => {
    for (const nom of NOMS_ICONES) {
      for (const trace of ICONES[nom]) {
        // Les nombres qui suivent une commande absolue M, L, H, V, C, S, Q, T :
        // coordonnées ; ceux des arcs (A, a) et des commandes relatives sont des
        // rayons, des drapeaux ou des écarts, et ne se bornent pas ainsi.
        for (const [, commande, nombres] of trace.matchAll(/([MLHVCSQT])([^A-Za-z]*)/g)) {
          for (const nombre of nombres.match(/-?\d*\.?\d+/g) ?? []) {
            const valeur = Number(nombre);
            assert.ok(valeur >= 0 && valeur <= 24, `${nom} : ${commande}${nombres.trim()} sort du carré`);
          }
        }
      }
    }
  });

  test('traceIcone rend les tracés d’une icône ; un nom inconnu lève RangeError en le nommant', () => {
    assert.equal(traceIcone('coche'), ICONES.coche);
    assert.throws(() => traceIcone('licorne'), (erreur) => erreur instanceof RangeError && /licorne/.test(erreur.message));
    assert.throws(() => traceIcone('toString'), RangeError);
  });
});
