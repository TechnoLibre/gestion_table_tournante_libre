// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du contrôle des chemins relatifs à une racine (§ 13.4, § 14.10) :
// exigerCheminRelatif, que partagent l'implémentation web et celle
// d'épreuve, rend les segments d'un chemin admis, et refuse par
// CHEMIN_REFUSE tout chemin absolu, remontant, ou que Windows lirait
// autrement. Le reste du module est l'interface en JSDoc, que la suite de
// contrat test/contrat_fichiers.js éprouve sur chaque implémentation. Les
// noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { ErreurStockage } from './erreurs.js';
import { exigerCheminRelatif } from './systeme_fichiers.js';

// Rend l'erreur que lève la fonction ; échoue quand elle n'en lève pas.
function erreurDe(fonction) {
  try {
    fonction();
  } catch (erreur) {
    return erreur;
  }
  assert.fail('aucune erreur levée');
}

describe('exigerCheminRelatif', () => {
  test("rend les segments d'un chemin relatif, et aucun pour la racine", () => {
    const cas = [
      ['', []],
      ['soiree.gtt.json', ['soiree.gtt.json']],
      [
        'corbeille/2026-01-02_03-04-05/soiree.gtt.json',
        ['corbeille', '2026-01-02_03-04-05', 'soiree.gtt.json'],
      ],
      ['.gtt-temoin', ['.gtt-temoin']],
      ['..soiree', ['..soiree']],
      [' devant', [' devant']],
      ['Soir\u{E9}e d\u{2019}\u{E9}t\u{E9}.gtt.json', ['Soir\u{E9}e d\u{2019}\u{E9}t\u{E9}.gtt.json']],
    ];
    for (const [chemin, segments] of cas) assert.deepEqual(exigerCheminRelatif(chemin), segments, chemin);
  });

  test('refuse un chemin absolu, remontant, ou que Windows lirait autrement : CHEMIN_REFUSE {chemin}', () => {
    const refuses = [
      // absolus, ou porteurs d'un segment vide
      '/x',
      '//serveur/partage/x',
      'a//b',
      'a/',
      // remontants ou désignant le dossier courant
      '..',
      '../x',
      'a/../../x',
      '.',
      './x',
      'a/./b',
      // ce que Windows ramène à eux, ou à un autre nom, en retirant points et
      // espaces finaux
      '...',
      'a/.. /x',
      'soiree.',
      'soiree ',
      // lecteur, partage, séparateur de Windows, flux de données secondaire
      'C:\\x',
      'C:x',
      'C:/x',
      '\\\\serveur\\partage\\x',
      'a\\b',
      'soiree.gtt.json:flux',
      // caractère nul
      'a\u{0}b',
      // autre chose qu'une chaîne
      null,
      undefined,
      42,
    ];
    for (const chemin of refuses) {
      const erreur = erreurDe(() => exigerCheminRelatif(chemin));
      assert.ok(erreur instanceof ErreurStockage, `${String(chemin)} : ${erreur}`);
      assert.equal(erreur.code, 'CHEMIN_REFUSE', String(chemin));
      assert.deepEqual(erreur.details, { chemin }, String(chemin));
    }
  });
});
