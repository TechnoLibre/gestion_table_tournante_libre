// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du contrôle des chemins relatifs à une racine (§ 13.4, § 14.10) :
// exigerCheminRelatif, que partagent l'implémentation web et celle
// d'épreuve, rend les segments d'un chemin admis, et refuse par
// CHEMIN_REFUSE tout chemin absolu, remontant, ou que Windows lirait
// autrement ; exigerOctets, que partagent les trois implémentations côté
// page, n'admet qu'un Uint8Array. Le reste du module est l'interface en
// JSDoc, que la suite de contrat test/contrat_fichiers.js éprouve sur chaque
// implémentation. L'atomicité de l'écriture des octets, qu'une panne seule
// montre, s'éprouve ici sur l'implémentation d'épreuve, la seule qui sache
// refuser un renommage ; celle de la coquille, dans
// test/fichiers_electron.test.js, celle de la plateforme web, dans
// fichiers_web.navigateur.test.js. Les noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { creerFichiersSimules } from '../../test/fichiers_simules.js';
import { describe, test } from '../../test/lanceur.js';
import { ErreurStockage } from './erreurs.js';
import { exigerCheminRelatif, exigerOctets } from './systeme_fichiers.js';

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

describe('exigerOctets', () => {
  test('admet un Uint8Array, vide compris, et ses sous-classes ; refuse tout le reste par TypeError', () => {
    for (const octets of [new Uint8Array(0), new Uint8Array([0x25, 0xff]), Buffer.from('pdf')]) exigerOctets(octets);
    for (const fautifs of ['texte', [1, 2], new ArrayBuffer(2), new Uint16Array(2), new Int8Array(2), null, undefined, { length: 0 }]) {
      assert.throws(() => exigerOctets(fautifs), TypeError, Object.prototype.toString.call(fautifs));
    }
  });
});

describe("ecrireOctetsAtomique sur le système d'épreuve : l'atomicité (§ 8.8)", () => {
  const DOCUMENTS = 'C:\\Users\\Exemple\\Documents\\Gestion table tournante Libre';
  const DOC = { id: 'documents', chemin: DOCUMENTS };
  const ANCIENS = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x0a, 0xe2]);
  const NOUVEAUX = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x32, 0x0a, 0xff]);

  // Un système d'épreuve dont la racine documents porte planche.pdf.
  function preparer(options = {}) {
    const fs = creerFichiersSimules(options);
    fs.deposerOctets('documents', 'planche.pdf', ANCIENS);
    return fs;
  }

  // Rend l'erreur de la promesse ; échoue quand elle se résout.
  async function rejet(promesse) {
    try {
      await promesse;
    } catch (erreur) {
      return erreur;
    }
    return assert.fail('la promesse se résout');
  }

  test("un renommage refusé laisse l'ancien fichier, retire le fichier d'écriture et lève ECRITURE en nommant fichier et dossier", async () => {
    const fs = preparer();
    fs.pannes.renommage('documents');
    const erreur = await rejet(fs.ecrireOctetsAtomique(DOC, 'planche.pdf', NOUVEAUX));
    assert.ok(erreur instanceof ErreurStockage, String(erreur));
    assert.deepEqual([erreur.code, erreur.details], ['ECRITURE', { chemin: 'planche.pdf', dossier: DOCUMENTS, cause: 'EBUSY' }]);
    assert.deepEqual(fs.octets('documents', 'planche.pdf'), ANCIENS);
    assert.equal(fs.octets('documents', 'planche.pdf.ecriture'), null);
    assert.deepEqual((await fs.lister(DOC, '')).map(({ nom }) => nom), ['planche.pdf']);
  });

  test("le renommage se réessaie comme celui d'ecrireAtomique : dix refus et l'écriture passe, onze et elle échoue", async () => {
    const fs = preparer();
    fs.pannes.renommage('documents', 10, 'EPERM');
    await fs.ecrireOctetsAtomique(DOC, 'planche.pdf', NOUVEAUX);
    assert.deepEqual(fs.octets('documents', 'planche.pdf'), NOUVEAUX);
    fs.pannes.renommage('documents', 11, 'EPERM');
    const erreur = await rejet(fs.ecrireOctetsAtomique(DOC, 'planche.pdf', ANCIENS));
    assert.equal(erreur.code, 'ECRITURE');
    assert.deepEqual(fs.octets('documents', 'planche.pdf'), NOUVEAUX);
  });

  test("un support qui refuse l'écriture lève ECRITURE avec sa cause, sans rien changer ; sans renommage atomique, l'écriture va droit sur la cible", async () => {
    const refuse = preparer();
    refuse.pannes.ecriture('documents', 'EROFS');
    const erreur = await rejet(refuse.ecrireOctetsAtomique(DOC, 'planche.pdf', NOUVEAUX));
    assert.deepEqual([erreur.code, erreur.details.cause], ['ECRITURE', 'EROFS']);
    assert.deepEqual(refuse.octets('documents', 'planche.pdf'), ANCIENS);

    const direct = preparer({ renommageAtomique: false });
    direct.pannes.renommage('documents');
    await direct.ecrireOctetsAtomique(DOC, 'planche.pdf', NOUVEAUX);
    assert.deepEqual(direct.octets('documents', 'planche.pdf'), NOUVEAUX);
  });

  test("l'écriture compte parmi les écritures du processus : le compteur la relève, et une coupure l'arrête comme les autres", async () => {
    const fs = preparer();
    await fs.ecrireOctetsAtomique(DOC, 'planche.pdf', NOUVEAUX);
    assert.deepEqual(fs.compteurs, { ecritures: 1, lectures: 0 });
    fs.pannes.couperApres(1);
    await fs.ecrireOctetsAtomique(DOC, 'planche.pdf', ANCIENS);
    const erreur = await rejet(fs.ecrireOctetsAtomique(DOC, 'planche.pdf', NOUVEAUX));
    assert.equal(erreur.name, 'PanneSimulee');
    assert.deepEqual(fs.octets('documents', 'planche.pdf'), ANCIENS);
  });
});
