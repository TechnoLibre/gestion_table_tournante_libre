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
// fichiers_web.navigateur.test.js. La vue d'un dossier d'événement
// (vueDossier) passe la suite de contrat comme une implémentation, sur deux
// réglages du système d'épreuve, puis ce qui n'appartient qu'à elle : le
// préfixe de ses chemins, le chemin relatif au dossier dans les détails
// d'un refus, et la primitive lue à l'appel. Les noms d'épreuve sont
// inventés.
import assert from 'node:assert/strict';
import { eprouverContrat } from '../../test/contrat_fichiers.js';
import { creerFichiersSimules } from '../../test/fichiers_simules.js';
import { describe, test } from '../../test/lanceur.js';
import { ErreurStockage } from './erreurs.js';
import { exigerCheminRelatif, exigerOctets, vueDossier } from './systeme_fichiers.js';

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
  const DOCUMENTS = 'C:\\Users\\Exemple\\Documents\\Gestion table tournante Libre\\data';
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

describe("vueDossier : un dossier d'événement vu comme une racine (§ 8.6)", () => {
  const DOCUMENTS = 'C:\\Users\\Exemple\\Documents\\Gestion table tournante Libre\\data';
  const DOC = { id: 'documents', chemin: DOCUMENTS };
  const DOSSIER = 'Bal des Hirondelles';

  // Rend la raison du rejet de la promesse ; échoue quand elle se résout.
  async function rejette(promesse, message) {
    let raison;
    await assert.rejects(
      promesse,
      (erreur) => {
        raison = erreur;
        return true;
      },
      message,
    );
    return raison;
  }

  // Attend le rejet d'une ErreurStockage de ce code et de ces détails.
  async function echoue(promesse, code, details) {
    const erreur = await rejette(promesse, code);
    assert.ok(erreur instanceof ErreurStockage, String(erreur));
    assert.deepEqual([erreur.code, erreur.details], [code, details]);
    return erreur;
  }

  // Un système d'épreuve dont la racine documents porte le dossier vide
  // DOSSIER, posé sans compter.
  function preparer(options = {}) {
    const fs = creerFichiersSimules(options);
    fs.deposerDossier('documents', DOSSIER);
    return fs;
  }

  for (const [nom, options] of [
    ['sous Windows', {}],
    ['sous Unix', { separateur: '/', insensibleCasse: false, documents: '/home/exemple/Documents/Gestion table tournante Libre/data' }],
  ]) {
    eprouverContrat(
      `vue d'un dossier d'événement, ${nom}`,
      async () => {
        const fs = preparer(options);
        return { fs: vueDossier(fs, DOSSIER), racine: (await fs.racines()).documents };
      },
      { describe, test, egal: assert.deepStrictEqual, vrai: assert.ok, rejette },
    );
  }

  test("chaque chemin reçu s'écrit sous le dossier, '' désignant le dossier lui-même ; rien ne s'écrit à la racine", async () => {
    const fs = preparer();
    const vue = vueDossier(fs, DOSSIER);
    await vue.ecrireAtomique(DOC, 'Bal.gtt.json', 'état');
    await vue.ajouterLigne(DOC, 'Bal.gtt-journal.jsonl', 'ligne');
    await vue.creerDossier(DOC, 'logo');
    await vue.ecrireOctetsAtomique(DOC, 'logo/a.png', new Uint8Array([1, 2]));
    await vue.deplacer(DOC, 'logo/a.png', 'b.png');
    assert.deepEqual((await vue.lister(DOC, '')).map(({ nom, type }) => [nom, type]), [
      ['Bal.gtt-journal.jsonl', 'fichier'],
      ['Bal.gtt.json', 'fichier'],
      ['b.png', 'fichier'],
      ['logo', 'dossier'],
    ]);
    assert.deepEqual((await fs.lister(DOC, '')).map(({ nom }) => nom), [DOSSIER]);
    assert.equal(fs.contenu('documents', `${DOSSIER}/Bal.gtt.json`), 'état');
    assert.equal(await vue.lireTexte(DOC, 'Bal.gtt-journal.jsonl'), 'ligne\n');
    await vue.supprimerDossier(DOC, 'logo');
    await vue.supprimer(DOC, 'b.png');
    assert.deepEqual((await fs.lister(DOC, DOSSIER)).map(({ nom }) => nom), ['Bal.gtt-journal.jsonl', 'Bal.gtt.json']);
    const pris = await vue.verrouiller(DOC, 'Bal.gtt.verrou', 'seance-a', '2031-05-17T19:42:07-04:00');
    assert.deepEqual(pris, { pris: true });
    assert.notEqual(fs.contenu('documents', `${DOSSIER}/Bal.gtt.verrou`), null);
    await vue.deverrouiller(DOC, 'Bal.gtt.verrou', 'seance-a');
    assert.equal(fs.contenu('documents', `${DOSSIER}/Bal.gtt.verrou`), null);
  });

  test("le chemin d'un refus redevient celui que la vue a reçu ; le dossier d'une ECRITURE reste celui qui porte le fichier", async () => {
    const fs = preparer();
    const vue = vueDossier(fs, DOSSIER);
    await echoue(vue.lireTexte(DOC, 'Bal.gtt.json'), 'ABSENT', { chemin: 'Bal.gtt.json' });
    await echoue(vue.lister(DOC, 'logo'), 'ABSENT', { chemin: 'logo' });
    await echoue(vue.ecrireAtomique(DOC, 'logo/a.txt', 'x'), 'ECRITURE', {
      chemin: 'logo/a.txt',
      dossier: `${DOCUMENTS}\\${DOSSIER}\\logo`,
      cause: 'ENOENT',
    });
    await vue.ecrireAtomique(DOC, 'a.txt', 'a');
    await vue.ecrireAtomique(DOC, 'b.txt', 'b');
    await echoue(vue.deplacer(DOC, 'a.txt', 'b.txt'), 'EXISTE', { chemin: 'b.txt' });
    await vue.creerDossier(DOC, 'plein');
    await vue.ecrireAtomique(DOC, 'plein/c.txt', 'c');
    await echoue(vue.supprimerDossier(DOC, 'plein'), 'NON_VIDE', { chemin: 'plein' });
    fs.pannes.ecriture('documents', 'EROFS');
    await echoue(vue.ecrireAtomique(DOC, 'a.txt', 'z'), 'ECRITURE', {
      chemin: 'a.txt',
      dossier: `${DOCUMENTS}\\${DOSSIER}`,
      cause: 'EROFS',
    });
  });

  test("un chemin que le contrat refuse se refuse tel que reçu, avant tout accès ; '' se refuse à supprimerDossier, le dossier restant", async () => {
    const fs = preparer();
    const vue = vueDossier(fs, DOSSIER);
    for (const chemin of ['../x', `${DOSSIER}/..`, 'a/../../x', '/x', 'C:\\x', 42]) {
      await echoue(vue.lireTexte(DOC, chemin), 'CHEMIN_REFUSE', { chemin });
    }
    await echoue(vue.supprimerDossier(DOC, ''), 'CHEMIN_REFUSE', { chemin: '' });
    assert.deepEqual(fs.compteurs, { ecritures: 0, lectures: 0 });
    assert.deepEqual((await fs.lister(DOC, '')).map(({ nom }) => nom), [DOSSIER]);
  });

  test("un dossier vide, remontant, absolu ou d'autre chose qu'une chaîne se refuse à la création de la vue : CHEMIN_REFUSE", () => {
    const fs = preparer();
    for (const dossier of ['', '..', '../x', '/x', 'C:\\x', null, 7]) {
      const erreur = erreurDe(() => vueDossier(fs, dossier));
      assert.ok(erreur instanceof ErreurStockage, String(dossier));
      assert.deepEqual([erreur.code, erreur.details], ['CHEMIN_REFUSE', { chemin: dossier }]);
    }
  });

  test("sonder éprouve le dossier lui-même : il le crée sous une racine qui existe ; un refus, une relecture fausse ou une racine absente rendent leur cause sans lever", async () => {
    const fs = creerFichiersSimules();
    fs.deposerDossier('documents');
    const vue = vueDossier(fs, DOSSIER);
    assert.deepEqual(await vue.sonder(DOC), { inscriptible: true, cause: null });
    assert.deepEqual((await fs.lister(DOC, '')).map(({ nom, type }) => [nom, type]), [[DOSSIER, 'dossier']]);
    assert.deepEqual(await fs.lister(DOC, DOSSIER), []);

    const lireTexte = fs.lireTexte;
    fs.lireTexte = async () => 'autre chose';
    assert.deepEqual(await vue.sonder(DOC), { inscriptible: false, cause: 'RELECTURE_DIFFERENTE' });
    fs.lireTexte = lireTexte;

    fs.pannes.ecriture('documents', 'EROFS');
    assert.deepEqual(await vue.sonder(DOC), { inscriptible: false, cause: 'EROFS' });

    const sansRacine = vueDossier(creerFichiersSimules(), DOSSIER);
    assert.deepEqual(await sansRacine.sonder(DOC), { inscriptible: false, cause: 'ENOENT' });
    await echoue(sansRacine.sonder({ id: 'inconnue', chemin: 'X:\\nulle-part' }), 'CHEMIN_REFUSE', { chemin: DOSSIER });
  });

  test("la vue porte le dossier et le système qu'elle prolonge, en relaie la nature et les garanties, et lit chaque primitive à l'appel", async () => {
    const fs = preparer({ nature: 'web', renommageAtomique: false, verrouDisponible: false });
    const vue = vueDossier(fs, DOSSIER);
    assert.deepEqual([vue.dossier, vue.systeme, vue.nature, vue.renommageAtomique, vue.verrouDisponible], [
      DOSSIER,
      fs,
      'web',
      false,
      false,
    ]);
    const recus = [];
    fs.lireTexte = async (racine, chemin) => {
      recus.push(chemin);
      return 'remplacée';
    };
    assert.equal(await vue.lireTexte(DOC, 'Bal.gtt.json'), 'remplacée');
    assert.deepEqual(recus, [`${DOSSIER}/Bal.gtt.json`]);
    assert.deepEqual(await vue.racines(), await fs.racines());
  });
});
