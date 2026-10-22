// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du système de fichiers d'épreuve (§ 13.4, § 14.10). La suite de
// contrat s'y joue sur trois réglages : Windows, Unix, et celui de la
// plateforme web, sans renommage atomique ni verrou. Suit ce qui n'appartient
// qu'à lui : ses réglages, qui en ressortent tels qu'il les reçoit, ses
// racines et emplacements, la casse des noms, les pannes qu'il simule —
// renommage refusé, support qui refuse l'écriture, processus coupé puis
// rouvert sur le même disque —, le verrou entre processus, les compteurs, et
// ce que l'épreuve pose ou lit sans compter. Les noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { ErreurStockage } from '../src/stockage/erreurs.js';
import { eprouverContrat } from './contrat_fichiers.js';
import { PanneSimulee, creerFichiersSimules } from './fichiers_simules.js';
import { describe, test } from './lanceur.js';

// L'instant de prise d'un verrou que reçoit verrouiller, de la forme
// qu'écrit l'horloge de l'application.
const DEPUIS = '2031-05-17T19:42:07-04:00';

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
  assert.equal(erreur.code, code);
  assert.deepEqual(erreur.details, details);
}

// Rend l'erreur que lève la fonction ; échoue quand elle n'en lève pas.
function erreurDe(fonction) {
  try {
    fonction();
  } catch (erreur) {
    return erreur;
  }
  assert.fail('aucune erreur levée');
}

const noms = (entrees) => entrees.map((entree) => entree.nom);

const DOCUMENTS = 'C:\\Users\\Exemple\\Documents\\Gestion table tournante Libre';
const DOC = { id: 'documents', chemin: DOCUMENTS };
const DATA = 'E:\\soirees\\data';
const PORTABLE = { id: 'portable', chemin: DATA };

// Un système d'épreuve dont la racine documents existe, posée sans compter.
function preparer(options = {}) {
  const fs = creerFichiersSimules(options);
  fs.deposerDossier('documents');
  return fs;
}

// Les trois réglages sur lesquels la suite de contrat se joue.
const REGLAGES = [
  ['épreuve, sous Windows', {}],
  [
    'épreuve, sous Unix',
    {
      separateur: '/',
      insensibleCasse: false,
      documents: '/home/exemple/Documents/Gestion table tournante Libre',
      donneesApplicatives: ['/home/exemple/.config', '/tmp'],
    },
  ],
  [
    'épreuve, comme la plateforme web',
    {
      nature: 'web',
      renommageAtomique: false,
      verrouDisponible: false,
      separateur: '/',
      insensibleCasse: false,
      documents: '/gestion_table_tournante_libre',
    },
  ],
];
for (const [nom, options] of REGLAGES) {
  eprouverContrat(
    nom,
    async () => {
      const fs = preparer(options);
      return { fs, racine: (await fs.racines()).documents };
    },
    { describe, test, egal: assert.deepStrictEqual, vrai: assert.ok, rejette },
  );
}

describe('fichiers simulés : racines et emplacements', () => {
  test('par défaut : Windows, sans égard à la casse, sans exécutable publié, la seule racine documents', async () => {
    const fs = creerFichiersSimules();
    assert.equal(fs.nature, 'epreuve');
    assert.equal(fs.renommageAtomique, true);
    assert.equal(fs.verrouDisponible, true);
    assert.deepEqual(await fs.emplacements(), {
      executable: null,
      donneesApplicatives: ['C:\\Users\\Exemple\\AppData\\Roaming', 'C:\\Users\\Exemple\\AppData\\Local'],
      insensibleCasse: true,
      separateur: '\\',
    });
    assert.deepEqual(await fs.racines(), { portable: null, documents: DOC });
    await echoue(fs.lireTexte(PORTABLE, 'soiree.gtt.json'), 'CHEMIN_REFUSE', { chemin: 'soiree.gtt.json' });
  });

  test('les réglages donnés en ressortent tels quels : nature, garanties, hôte, emplacements, racine documents', async () => {
    // Chaque réglage diffère de sa valeur par défaut : une valeur que le
    // double figerait au lieu de la reprendre fait échouer l'épreuve.
    // donneesApplicatives est la seule voie par laquelle il simule un
    // dossier de travail sous un emplacement de données applicatives
    // (§ 8.6, point 2).
    const documents = '/home/exemple/Documents/Gestion table tournante Libre';
    const fs = creerFichiersSimules({
      documents,
      donneesApplicatives: ['/home/exemple/.config', '/tmp'],
      separateur: '/',
      insensibleCasse: false,
      nature: 'web',
      renommageAtomique: false,
      verrouDisponible: false,
      hote: 'autre-poste',
    });
    assert.equal(fs.nature, 'web');
    assert.equal(fs.renommageAtomique, false);
    assert.equal(fs.verrouDisponible, false);
    assert.equal(fs.hote, 'autre-poste');
    assert.deepEqual(await fs.emplacements(), {
      executable: null,
      donneesApplicatives: ['/home/exemple/.config', '/tmp'],
      insensibleCasse: false,
      separateur: '/',
    });
    assert.deepEqual(await fs.racines(), { portable: null, documents: { id: 'documents', chemin: documents } });
  });

  test("un exécutable publié ouvre la racine portable, data/ à côté de lui, au séparateur du système", async () => {
    const cas = [
      [{ executable: 'E:\\soirees' }, 'E:\\soirees\\data'],
      [{ executable: 'E:\\' }, 'E:\\data'],
      [{ executable: '/media/cle/soirees', separateur: '/', insensibleCasse: false }, '/media/cle/soirees/data'],
    ];
    for (const [options, chemin] of cas) {
      const fs = creerFichiersSimules(options);
      assert.deepEqual((await fs.racines()).portable, { id: 'portable', chemin });
      assert.equal((await fs.emplacements()).executable, options.executable);
    }
  });

  test('typeSupport rend le support déclaré pour une racine, fixe par défaut', async () => {
    const fs = creerFichiersSimules({ executable: 'E:\\soirees', support: { portable: 'amovible' } });
    assert.equal(await fs.typeSupport(PORTABLE), 'amovible');
    assert.equal(await fs.typeSupport(DOC), 'fixe');
  });

  test("une racine n'existe qu'une fois créée : avant, lister lève ABSENT et écrire ECRITURE (ENOENT) ; sonder la crée", async () => {
    const fs = creerFichiersSimules();
    const absent = (chemin) => ({ chemin, dossier: DOCUMENTS, cause: 'ENOENT' });
    await echoue(fs.lister(DOC, ''), 'ABSENT', { chemin: '' });
    await echoue(fs.ecrireAtomique(DOC, 'soiree.gtt.json', 'x'), 'ECRITURE', absent('soiree.gtt.json'));
    await echoue(fs.ajouterLigne(DOC, 'soiree.gtt-journal.jsonl', 'x'), 'ECRITURE', absent('soiree.gtt-journal.jsonl'));
    await echoue(fs.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-a', DEPUIS), 'ECRITURE', absent('soiree.gtt.verrou'));
    assert.deepEqual(await fs.sonder(DOC), { inscriptible: true, cause: null });
    assert.deepEqual(await fs.lister(DOC, ''), []);
  });

  test('deplacer vers un dossier absent nomme la cible et son dossier, et laisse la source', async () => {
    const fs = preparer();
    fs.deposer('documents', 'soiree.gtt.json', 'état');
    await echoue(fs.deplacer(DOC, 'soiree.gtt.json', 'corbeille/soiree.gtt.json'), 'ECRITURE', {
      chemin: 'corbeille/soiree.gtt.json',
      dossier: `${DOCUMENTS}\\corbeille`,
      cause: 'ENOENT',
    });
    assert.equal(fs.contenu('documents', 'soiree.gtt.json'), 'état');
  });

  test('une sonde déclarée en échec rend sa cause, et sa racine refuse toute écriture', async () => {
    const fs = creerFichiersSimules({ executable: 'E:\\soirees', sonde: { portable: 'EACCES' } });
    assert.deepEqual(await fs.sonder(PORTABLE), { inscriptible: false, cause: 'EACCES' });
    await echoue(fs.creerDossier(PORTABLE, ''), 'ECRITURE', { chemin: '', dossier: DATA, cause: 'EACCES' });
    assert.deepEqual(await fs.sonder(DOC), { inscriptible: true, cause: null });
  });

  test("un fichier qui occupe le chemin de la racine fait échouer la sonde, sans lever (EEXIST)", async () => {
    // L'exécutable est publié dans E:\soirees, que la racine documents
    // désigne aussi : un fichier data y occupe le chemin de la racine portable.
    const fs = creerFichiersSimules({ executable: 'E:\\soirees', documents: 'E:\\soirees' });
    fs.deposer('documents', 'data', 'un fichier, pas un dossier');
    assert.deepEqual(await fs.sonder(PORTABLE), { inscriptible: false, cause: 'EEXIST' });
    assert.equal(fs.contenu('documents', 'data'), 'un fichier, pas un dossier');
  });

  test("les dialogues natifs rendent null, comme quand l'opérateur annule ; ouvrir une racine inconnue est refusé", async () => {
    const fs = preparer();
    assert.equal(await fs.choisirDossier(), null);
    assert.equal(await fs.choisirFichierAImporter(), null);
    assert.equal(await fs.enregistrerSous('liste.csv', new Uint8Array([0x61])), null);
    assert.equal(await fs.ouvrirDansExplorateur(DOC), undefined);
    await echoue(fs.ouvrirDansExplorateur(PORTABLE), 'CHEMIN_REFUSE', { chemin: '' });
  });

  test("ouvrirDansExplorateur ouvre la racine ou l'un de ses dossiers ; un dossier absent, ou un fichier, lève ABSENT {chemin}, comme dans la coquille", async () => {
    const fs = preparer();
    fs.deposerDossier('documents', 'Gala des Saules/logo');
    fs.deposer('documents', 'note.txt', 'note');
    assert.equal(await fs.ouvrirDansExplorateur(DOC, ''), undefined);
    assert.equal(await fs.ouvrirDansExplorateur(DOC, 'Gala des Saules/logo'), undefined);
    await echoue(fs.ouvrirDansExplorateur(DOC, 'Absent'), 'ABSENT', { chemin: 'Absent' });
    await echoue(fs.ouvrirDansExplorateur(DOC, 'note.txt'), 'ABSENT', { chemin: 'note.txt' });
    await echoue(fs.ouvrirDansExplorateur(DOC, '../x'), 'CHEMIN_REFUSE', { chemin: '../x' });
    const sansRacine = creerFichiersSimules({ executable: 'E:\\soirees' });
    await echoue(sansRacine.ouvrirDansExplorateur(PORTABLE), 'ABSENT', { chemin: '' });
    assert.deepEqual(fs.compteurs, { ecritures: 0, lectures: 0 });
  });

  test("dossiersChoisis : choisirDossier rend chacun dans l'ordre, choisi-<n>, puis null ; la racine rendue s'inscrit, et n'existe qu'une fois créée", async () => {
    const SECOURS = 'D:\\Secours';
    const fs = creerFichiersSimules({ dossiersChoisis: [SECOURS, 'F:\\Repli'] });
    const choisi = { id: 'choisi-1', chemin: SECOURS };
    // Avant le choix, la racine n'est pas connue du système.
    await echoue(fs.lister(choisi, ''), 'CHEMIN_REFUSE', { chemin: '' });
    const avant = { ...fs.compteurs };
    assert.deepEqual(await fs.choisirDossier(), choisi);
    assert.deepEqual(await fs.choisirDossier(), { id: 'choisi-2', chemin: 'F:\\Repli' });
    assert.equal(await fs.choisirDossier(), null);
    assert.equal(await fs.choisirDossier(), null);
    assert.deepEqual(fs.compteurs, avant, 'le dialogue ne compte pas');
    assert.deepEqual(await fs.racines(), { portable: null, documents: DOC }, 'les racines du système restent les deux');
    await echoue(fs.lister(choisi, ''), 'ABSENT', { chemin: '' });
    const absent = { chemin: 'soiree.gtt.json', dossier: SECOURS, cause: 'ENOENT' };
    await echoue(fs.ecrireAtomique(choisi, 'soiree.gtt.json', 'x'), 'ECRITURE', absent);
    await fs.creerDossier(choisi, '');
    await fs.ecrireAtomique(choisi, 'soiree.gtt.json', 'état');
    assert.equal(fs.contenu('choisi-1', 'soiree.gtt.json'), 'état');
    assert.deepEqual(noms(await fs.lister(choisi, '')), ['soiree.gtt.json']);
    fs.pannes.ecriture('choisi-2');
    await echoue(fs.creerDossier({ id: 'choisi-2', chemin: 'F:\\Repli' }, ''), 'ECRITURE', {
      chemin: '',
      dossier: 'F:\\Repli',
      cause: 'EROFS',
    });
    await echoue(fs.lister({ id: 'choisi-3', chemin: 'G:\\' }, ''), 'CHEMIN_REFUSE', { chemin: '' });
  });

  test('dossiersChoisis : un chemin qui n\u{2019}est pas une chaîne non vide, ou pas un chemin absolu, lève TypeError à la création', () => {
    for (const fautif of [[''], [null], 'D:\\Secours', ['Secours'], ['secours\\soirees'], ['D:\\Secours', './Repli']]) {
      assert.ok(erreurDe(() => creerFichiersSimules({ dossiersChoisis: fautif })) instanceof TypeError, JSON.stringify(fautif));
    }
  });
});

describe('fichiers simulés : casse des noms', () => {
  test('sans égard à la casse, une autre casse désigne le même fichier, et lister rend la casse de sa création', async () => {
    const fs = preparer();
    await fs.ecrireAtomique(DOC, 'Soir\u{E9}e.gtt.json', 'état');
    assert.equal(await fs.lireTexte(DOC, 'SOIR\u{C9}E.GTT.JSON'), 'état');
    await fs.ajouterLigne(DOC, 'Soir\u{E9}e.gtt-journal.jsonl', 'a');
    await fs.ajouterLigne(DOC, 'soir\u{E9}e.GTT-JOURNAL.jsonl', 'b');
    assert.deepEqual(noms(await fs.lister(DOC, '')), [
      'Soir\u{E9}e.gtt-journal.jsonl',
      'Soir\u{E9}e.gtt.json',
    ]);
    assert.equal(fs.contenu('documents', 'SOIR\u{C9}E.gtt-journal.jsonl'), 'a\nb\n');
  });

  test('la casse se replie caractère par caractère, comme Windows : un sigma final rejoint sa majuscule, un eszett ne devient pas SS', async () => {
    const fs = preparer();
    await fs.ecrireAtomique(DOC, '\u{3A3}\u{391}\u{3A3}.txt', 'majuscules');
    assert.equal(await fs.lireTexte(DOC, '\u{3C3}\u{3B1}\u{3C2}.txt'), 'majuscules');
    await fs.ecrireAtomique(DOC, 'stra\u{DF}e.txt', 'eszett');
    await fs.ecrireAtomique(DOC, 'STRASSE.txt', 'deux s');
    assert.equal(await fs.lireTexte(DOC, 'stra\u{DF}e.txt'), 'eszett');
    assert.equal(await fs.lireTexte(DOC, 'STRASSE.txt'), 'deux s');
  });

  test('renommer par-dessus donne au fichier la casse du nouveau nom ; deplacer vers une autre casse du même nom lève EXISTE', async () => {
    const fs = preparer();
    await fs.ecrireAtomique(DOC, 'Soir\u{E9}e.gtt.json', 'un');
    await fs.ecrireAtomique(DOC, 'soir\u{E9}e.gtt.json', 'deux');
    assert.deepEqual(noms(await fs.lister(DOC, '')), ['soir\u{E9}e.gtt.json']);
    assert.equal(fs.contenu('documents', 'SOIR\u{C9}E.gtt.json'), 'deux');
    await echoue(fs.deplacer(DOC, 'soir\u{E9}e.gtt.json', 'SOIR\u{C9}E.gtt.json'), 'EXISTE', {
      chemin: 'SOIR\u{C9}E.gtt.json',
    });
  });

  test('sensible à la casse, deux casses font deux fichiers', async () => {
    const racine = '/home/exemple/Documents/Gestion table tournante Libre';
    const fs = preparer({ separateur: '/', insensibleCasse: false, documents: racine });
    const doc = { id: 'documents', chemin: racine };
    await fs.ecrireAtomique(doc, 'soir\u{E9}e.gtt.json', 'minuscule');
    await fs.ecrireAtomique(doc, 'Soir\u{E9}e.gtt.json', 'majuscule');
    assert.deepEqual(noms(await fs.lister(doc, '')), ['Soir\u{E9}e.gtt.json', 'soir\u{E9}e.gtt.json']);
    await echoue(fs.lireTexte(doc, 'SOIR\u{C9}E.GTT.JSON'), 'ABSENT', { chemin: 'SOIR\u{C9}E.GTT.JSON' });
  });

  test('un disque partagé garde la casse et le séparateur de sa première instance', () => {
    const disque = new Map();
    creerFichiersSimules({ disque });
    assert.throws(() => creerFichiersSimules({ disque, insensibleCasse: false }));
    assert.throws(() => creerFichiersSimules({ disque, separateur: '/' }));
    creerFichiersSimules({ disque });
  });
});

describe('fichiers simulés : renommage refusé (§ 8.8, § 14.10)', () => {
  test("un renommage refusé laisse la cible intacte, retire le fichier d'écriture et lève ECRITURE en nommant fichier et dossier", async () => {
    const fs = preparer();
    fs.deposer('documents', 'soiree.gtt.json', 'avant');
    fs.pannes.renommage('documents');
    await echoue(fs.ecrireAtomique(DOC, 'soiree.gtt.json', 'après'), 'ECRITURE', {
      chemin: 'soiree.gtt.json',
      dossier: DOCUMENTS,
      cause: 'EBUSY',
    });
    assert.equal(fs.contenu('documents', 'soiree.gtt.json'), 'avant');
    assert.equal(fs.contenu('documents', 'soiree.gtt.json.ecriture'), null);
    assert.deepEqual(noms(await fs.lister(DOC, '')), ['soiree.gtt.json']);
  });

  test("l'écriture réessaie le renommage : dix refus et elle passe, onze et elle échoue", async () => {
    const fs = preparer();
    fs.pannes.renommage('documents', 10, 'EPERM');
    await fs.ecrireAtomique(DOC, 'etat.json', 'après dix refus');
    assert.equal(fs.contenu('documents', 'etat.json'), 'après dix refus');
    fs.pannes.renommage('documents', 11, 'EPERM');
    await echoue(fs.ecrireAtomique(DOC, 'etat.json', 'après onze refus'), 'ECRITURE', {
      chemin: 'etat.json',
      dossier: DOCUMENTS,
      cause: 'EPERM',
    });
    assert.equal(fs.contenu('documents', 'etat.json'), 'après dix refus');
  });

  test('la panne de renommage ne touche que sa racine, et refuse aussi deplacer', async () => {
    const fs = preparer({ executable: 'E:\\soirees' });
    fs.deposer('portable', 'soiree.gtt.json', 'état');
    fs.pannes.renommage('portable');
    await fs.ecrireAtomique(DOC, 'ailleurs.json', 'passe');
    assert.equal(fs.contenu('documents', 'ailleurs.json'), 'passe');
    await echoue(fs.deplacer(PORTABLE, 'soiree.gtt.json', 'soiree-2.gtt.json'), 'ECRITURE', {
      chemin: 'soiree.gtt.json',
      dossier: DATA,
      cause: 'EBUSY',
    });
    assert.equal(fs.contenu('portable', 'soiree.gtt.json'), 'état');
    assert.equal(fs.contenu('portable', 'soiree-2.gtt.json'), null);
  });

  test("sans renommage atomique, ecrireAtomique écrit droit sur la cible : une panne de renommage ne l'arrête pas", async () => {
    const fs = preparer({ renommageAtomique: false });
    fs.deposer('documents', 'etat.json', 'avant');
    fs.pannes.renommage('documents');
    await fs.ecrireAtomique(DOC, 'etat.json', 'après');
    assert.equal(fs.contenu('documents', 'etat.json'), 'après');
    assert.deepEqual(noms(await fs.lister(DOC, '')), ['etat.json']);
  });
});

describe('fichiers simulés : dossier non retiré', () => {
  test("par défaut, un dossier vide reste et lève NON_VIDE {chemin}, comme un fichier en attente de suppression que le système tient encore", async () => {
    const fs = preparer();
    fs.deposerDossier('documents', 'Gala des Saules');
    fs.pannes.dossierNonRetire('documents');
    await echoue(fs.supprimerDossier(DOC, 'Gala des Saules'), 'NON_VIDE', { chemin: 'Gala des Saules' });
    assert.deepEqual(noms(await fs.lister(DOC, '')), ['Gala des Saules']);
    assert.deepEqual(await fs.lister(DOC, 'Gala des Saules'), []);
  });

  test("le retrait se réessaie comme le renommage : dix refus et il passe, onze et il échoue ; une autre cause lève ECRITURE avec elle", async () => {
    const fs = preparer();
    fs.deposerDossier('documents', 'premier');
    fs.deposerDossier('documents', 'second');
    fs.deposerDossier('documents', 'tenu');
    fs.pannes.dossierNonRetire('documents', 10);
    await fs.supprimerDossier(DOC, 'premier');
    fs.pannes.dossierNonRetire('documents', 11);
    await echoue(fs.supprimerDossier(DOC, 'second'), 'NON_VIDE', { chemin: 'second' });
    fs.pannes.dossierNonRetire('documents', Infinity, 'EBUSY');
    await echoue(fs.supprimerDossier(DOC, 'tenu'), 'ECRITURE', { chemin: 'tenu', dossier: DOCUMENTS, cause: 'EBUSY' });
    assert.deepEqual(noms(await fs.lister(DOC, '')), ['second', 'tenu']);
  });

  test("la panne ne touche que sa racine et les dossiers présents : un absent ne la consomme pas, l'autre racine retire les siens", async () => {
    const fs = preparer({ executable: 'E:\\soirees' });
    fs.deposerDossier('documents', 'ici');
    fs.deposerDossier('portable', 'la-bas');
    fs.pannes.dossierNonRetire('documents', 11);
    await fs.supprimerDossier(PORTABLE, 'la-bas');
    await fs.supprimerDossier(DOC, 'absent');
    await echoue(fs.supprimerDossier(DOC, 'ici'), 'NON_VIDE', { chemin: 'ici' });
    assert.deepEqual(await fs.lister(PORTABLE, ''), []);
    assert.deepEqual(noms(await fs.lister(DOC, '')), ['ici']);
  });

  test("dossierNonRetire refuse un compte qui n'est ni un entier positif ou nul ni Infinity", () => {
    const fs = preparer();
    for (const n of [-1, 1.5, '3', null]) {
      assert.throws(() => fs.pannes.dossierNonRetire('documents', n), TypeError, String(n));
    }
  });
});

describe("fichiers simulés : support qui refuse l'écriture", () => {
  test("après pannes.ecriture, chaque primitive d'écriture de la racine lève ECRITURE avec la cause, la sonde échoue, et rien ne change", async () => {
    const fs = preparer({ executable: 'E:\\soirees' });
    fs.deposer('portable', 'soiree.gtt.json', 'état');
    fs.deposer('portable', 'soiree.gtt-journal.jsonl', 'ligne\n');
    fs.deposer('portable', 'soiree.gtt.verrou', '{"seance":"seance-a"}');
    fs.deposerDossier('portable', 'vide');
    fs.pannes.ecriture('portable');
    const refus = (chemin) => ({ chemin, dossier: DATA, cause: 'EROFS' });
    await echoue(fs.ecrireAtomique(PORTABLE, 'soiree.gtt.json', 'nouveau'), 'ECRITURE', refus('soiree.gtt.json'));
    await echoue(
      fs.ajouterLigne(PORTABLE, 'soiree.gtt-journal.jsonl', 'suite'),
      'ECRITURE',
      refus('soiree.gtt-journal.jsonl'),
    );
    await echoue(fs.creerDossier(PORTABLE, 'corbeille'), 'ECRITURE', refus('corbeille'));
    await echoue(fs.deplacer(PORTABLE, 'soiree.gtt.json', 'autre.gtt.json'), 'ECRITURE', refus('soiree.gtt.json'));
    await echoue(fs.supprimer(PORTABLE, 'soiree.gtt.json'), 'ECRITURE', refus('soiree.gtt.json'));
    await echoue(fs.supprimerDossier(PORTABLE, 'vide'), 'ECRITURE', refus('vide'));
    await echoue(fs.verrouiller(PORTABLE, 'neuf.gtt.verrou', 'seance-b', DEPUIS), 'ECRITURE', refus('neuf.gtt.verrou'));
    await echoue(fs.deverrouiller(PORTABLE, 'soiree.gtt.verrou', 'seance-a'), 'ECRITURE', refus('soiree.gtt.verrou'));
    assert.deepEqual(await fs.sonder(PORTABLE), { inscriptible: false, cause: 'EROFS' });

    assert.deepEqual(noms(await fs.lister(PORTABLE, '')), [
      'soiree.gtt-journal.jsonl',
      'soiree.gtt.json',
      'soiree.gtt.verrou',
      'vide',
    ]);
    assert.equal(await fs.lireTexte(PORTABLE, 'soiree.gtt.json'), 'état');
    assert.equal(await fs.lireTexte(PORTABLE, 'soiree.gtt-journal.jsonl'), 'ligne\n');
  });

  test("une cause donnée remplace EROFS, et l'autre racine écrit encore", async () => {
    const fs = preparer({ executable: 'E:\\soirees' });
    fs.deposerDossier('portable');
    fs.pannes.ecriture('documents', 'ENOSPC');
    await echoue(fs.ecrireAtomique(DOC, 'soiree.gtt.json', 'x'), 'ECRITURE', {
      chemin: 'soiree.gtt.json',
      dossier: DOCUMENTS,
      cause: 'ENOSPC',
    });
    await fs.ecrireAtomique(PORTABLE, 'soiree.gtt.json', 'écrit ailleurs');
    assert.equal(fs.contenu('portable', 'soiree.gtt.json'), 'écrit ailleurs');
  });
});

describe('fichiers simulés : processus coupé (couperApres)', () => {
  test('après n écritures réussies, toute primitive lève PanneSimulee ; une nouvelle instance sur le même disque relit les n écritures et écrit à son tour', async () => {
    const disque = new Map();
    const premiere = creerFichiersSimules({ disque });
    premiere.deposerDossier('documents');
    premiere.deposer('documents', 'soiree.gtt.json', 'révision 1');
    premiere.pannes.couperApres(2);
    await premiere.ajouterLigne(DOC, 'soiree.gtt-journal.jsonl', '{"revision":2}');
    await premiere.ecrireAtomique(DOC, 'soiree.gtt.json.precedent', 'révision 1');

    const panne = await rejette(premiere.ecrireAtomique(DOC, 'soiree.gtt.json', 'révision 2'));
    assert.ok(panne instanceof PanneSimulee, String(panne));
    assert.ok(!(panne instanceof ErreurStockage));
    await assert.rejects(premiere.lireTexte(DOC, 'soiree.gtt.json'), PanneSimulee);
    await assert.rejects(premiere.lister(DOC, ''), PanneSimulee);
    await assert.rejects(premiere.emplacements(), PanneSimulee);
    await assert.rejects(premiere.sonder(DOC), PanneSimulee);

    const reouverte = creerFichiersSimules({ disque });
    assert.equal(await reouverte.lireTexte(DOC, 'soiree.gtt-journal.jsonl'), '{"revision":2}\n');
    assert.equal(await reouverte.lireTexte(DOC, 'soiree.gtt.json.precedent'), 'révision 1');
    assert.equal(await reouverte.lireTexte(DOC, 'soiree.gtt.json'), 'révision 1');
    await reouverte.ecrireAtomique(DOC, 'soiree.gtt.json', 'révision 2');
    assert.equal(premiere.contenu('documents', 'soiree.gtt.json'), 'révision 2');
  });

  test('une écriture refusée ne compte pas parmi les n', async () => {
    const fs = preparer();
    fs.pannes.renommage('documents');
    fs.pannes.couperApres(1);
    const refus = await rejette(fs.ecrireAtomique(DOC, 'soiree.gtt.json', 'x'));
    assert.equal(refus.code, 'ECRITURE');
    await fs.creerDossier(DOC, 'corbeille');
    await assert.rejects(fs.lister(DOC, ''), PanneSimulee);
  });

  test('couperApres(0) arrête le processus sur-le-champ', async () => {
    const fs = preparer();
    fs.pannes.couperApres(0);
    await assert.rejects(fs.lister(DOC, ''), PanneSimulee);
  });

  test("les pannes refusent un compte qui n'est pas un entier positif ou nul", () => {
    const fs = preparer();
    assert.throws(() => fs.pannes.renommage('documents', -1), TypeError);
    assert.throws(() => fs.pannes.renommage('documents', 1.5), TypeError);
    assert.throws(() => fs.pannes.couperApres(-1), TypeError);
    assert.throws(() => fs.pannes.couperApres(Infinity), TypeError);
  });
});

describe('fichiers simulés : verrou', () => {
  test("le fichier de verrou porte la séance, le pid et l'hôte du processus, et l'instant de sa prise qu'il a reçu, tel quel", async () => {
    const fs = preparer();
    const avant = fs.compteurs.ecritures;
    assert.deepEqual(await fs.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-a', DEPUIS), { pris: true });
    const texte = fs.contenu('documents', 'soiree.gtt.verrou');
    assert.equal(texte, `${JSON.stringify({ seance: 'seance-a', pid: fs.pid, hote: 'poste-epreuve', depuis: DEPUIS })}\n`);
    assert.equal(fs.hote, 'poste-epreuve');
    assert.deepEqual(await fs.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-b', '2031-05-17T20:00:00-04:00'), {
      pris: false,
      seance: 'seance-a',
      depuis: DEPUIS,
      vivant: true,
    });
    assert.equal(fs.compteurs.ecritures, avant + 2);
  });

  test('la création est exclusive, même pour la séance qui tient le verrou', async () => {
    const fs = preparer();
    await fs.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-a', DEPUIS);
    const second = await fs.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-a', DEPUIS);
    assert.deepEqual([second.pris, second.seance, second.vivant], [false, 'seance-a', true]);
  });

  test('vivant : vrai pour un processus en vie sur la même machine, faux pour un processus coupé, null pour une autre machine', async () => {
    const disque = new Map();
    const a = creerFichiersSimules({ disque });
    const b = creerFichiersSimules({ disque });
    const ailleurs = creerFichiersSimules({ disque, hote: 'autre-poste' });
    a.deposerDossier('documents');
    assert.notEqual(a.pid, b.pid);

    await a.verrouiller(DOC, 'a.gtt.verrou', 'seance-a', DEPUIS);
    const vuDeB = await b.verrouiller(DOC, 'a.gtt.verrou', 'seance-b', DEPUIS);
    assert.deepEqual([vuDeB.seance, vuDeB.vivant], ['seance-a', true]);

    await ailleurs.verrouiller(DOC, 'c.gtt.verrou', 'seance-c', DEPUIS);
    const vuDeA = await a.verrouiller(DOC, 'c.gtt.verrou', 'seance-x', DEPUIS);
    assert.deepEqual([vuDeA.seance, vuDeA.vivant], ['seance-c', null]);

    // Le pid d'un processus de l'autre machine ne désigne aucun processus de
    // celle-ci.
    const usurpe = { seance: 'seance-u', pid: ailleurs.pid, hote: 'poste-epreuve', depuis: '2026-01-01T08:00:00+00:00' };
    a.deposer('documents', 'u.gtt.verrou', JSON.stringify(usurpe));
    assert.equal((await a.verrouiller(DOC, 'u.gtt.verrou', 'seance-x', DEPUIS)).vivant, false);

    a.pannes.couperApres(0);
    const apresCoupure = await b.verrouiller(DOC, 'a.gtt.verrou', 'seance-b', DEPUIS);
    assert.deepEqual([apresCoupure.seance, apresCoupure.vivant], ['seance-a', false]);
  });

  test("un verrou illisible ne se lit ni ne s'efface ; un pid absent de la machine est mort", async () => {
    const fs = preparer();
    const illisible = { pris: false, seance: null, depuis: null, vivant: null };
    fs.deposer('documents', 'tronque.gtt.verrou', '{"seance":');
    assert.deepEqual(await fs.verrouiller(DOC, 'tronque.gtt.verrou', 'seance-a', DEPUIS), illisible);
    await fs.deverrouiller(DOC, 'tronque.gtt.verrou', 'seance-a');
    assert.equal(fs.contenu('documents', 'tronque.gtt.verrou'), '{"seance":');

    fs.deposer('documents', 'forme.gtt.verrou', '{"seance":"seance-a","pid":"7","hote":"poste-epreuve","depuis":"x"}');
    assert.deepEqual(await fs.verrouiller(DOC, 'forme.gtt.verrou', 'seance-b', DEPUIS), illisible);

    const ancien = { seance: 'ancienne', pid: 4242, hote: 'poste-epreuve', depuis: '2026-01-01T08:00:00+00:00' };
    fs.deposer('documents', 'mort.gtt.verrou', JSON.stringify(ancien));
    assert.deepEqual(await fs.verrouiller(DOC, 'mort.gtt.verrou', 'seance-b', DEPUIS), {
      pris: false,
      seance: 'ancienne',
      depuis: '2026-01-01T08:00:00+00:00',
      vivant: false,
    });
  });

  test("sans verrou disponible, verrouiller rend pris sans rien écrire et deverrouiller n'efface rien", async () => {
    const fs = preparer({ verrouDisponible: false });
    fs.deposer('documents', 'soiree.gtt.verrou', '{"seance":"seance-a"}');
    assert.deepEqual(await fs.verrouiller(DOC, 'neuf.gtt.verrou', 'seance-a', DEPUIS), { pris: true });
    assert.deepEqual(await fs.verrouiller(DOC, 'neuf.gtt.verrou', 'seance-b', DEPUIS), { pris: true });
    await fs.deverrouiller(DOC, 'soiree.gtt.verrou', 'seance-a');
    assert.deepEqual(noms(await fs.lister(DOC, '')), ['soiree.gtt.verrou']);
  });
});

describe('fichiers simulés : compteurs, préparation, horloge', () => {
  test("chaque appel d'une primitive de lecture compte une lecture et chaque appel d'une primitive d'écriture une écriture, refusé compris ; les autres ne comptent pas", async () => {
    const fs = preparer();
    await fs.ecrireAtomique(DOC, 'a.txt', 'a');
    await fs.ajouterLigne(DOC, 'journal.jsonl', 'ligne');
    await fs.creerDossier(DOC, 'corbeille');
    await fs.deplacer(DOC, 'a.txt', 'corbeille/a.txt');
    await fs.supprimer(DOC, 'corbeille/a.txt');
    await fs.supprimerDossier(DOC, 'corbeille');
    await fs.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-a', DEPUIS);
    await fs.deverrouiller(DOC, 'soiree.gtt.verrou', 'seance-a');
    await fs.sonder(DOC);
    await assert.rejects(fs.ecrireAtomique(DOC, '../a.txt', 'a'));
    await fs.lireTexte(DOC, 'journal.jsonl');
    await fs.lister(DOC, '');
    await assert.rejects(fs.lireTexte(DOC, 'absent.txt'));
    await fs.emplacements();
    await fs.racines();
    await fs.typeSupport(DOC);
    await fs.choisirDossier();
    await fs.ouvrirDansExplorateur(DOC);
    await fs.choisirFichierAImporter();
    await fs.enregistrerSous('liste.csv', new Uint8Array([0x61]));
    fs.contenu('documents', 'journal.jsonl');
    fs.deposer('documents', 'pose.txt', 'posé');
    assert.deepEqual(fs.compteurs, { ecritures: 10, lectures: 3 });
  });

  test('deposer et deposerDossier posent sans compter, dossiers parents compris ; contenu lit sans compter et rend null hors d\u{2019}un fichier', async () => {
    const fs = creerFichiersSimules();
    fs.deposerDossier('documents', 'corbeille/2026-01-02_03-04-05');
    fs.deposer('documents', 'archives/2025/soiree.gtt.json', 'état', 5);
    assert.equal(fs.contenu('documents', 'archives/2025/soiree.gtt.json'), 'état');
    assert.equal(fs.contenu('documents', 'ARCHIVES/2025/SOIREE.GTT.JSON'), 'état');
    assert.equal(fs.contenu('documents', 'archives/2025'), null);
    assert.equal(fs.contenu('documents', 'absent.txt'), null);
    assert.deepEqual(fs.compteurs, { ecritures: 0, lectures: 0 });
    assert.deepEqual(await fs.lister(DOC, 'archives/2025'), [
      { nom: 'soiree.gtt.json', type: 'fichier', taille: 5, modifie: 5 },
    ]);
    assert.deepEqual(noms(await fs.lister(DOC, '')), ['archives', 'corbeille']);
    assert.equal(erreurDe(() => fs.deposer('inconnue', 'x.txt', 'x')).code, 'CHEMIN_REFUSE');
    assert.equal(erreurDe(() => fs.pannes.ecriture('inconnue')).code, 'CHEMIN_REFUSE');
  });

  test("modifie suit l'horloge du disque : chaque écriture l'avance ; deposer pose l'instant courant, ou celui qu'on lui donne", async () => {
    const fs = preparer();
    fs.deposer('documents', 'a.txt', 'a');
    fs.deposer('documents', 'b.txt', 'b');
    fs.deposer('documents', 'c.txt', 'c', 7);
    await fs.ecrireAtomique(DOC, 'd.txt', 'd');
    await fs.ecrireAtomique(DOC, 'e.txt', 'e');
    const [a, b, c, d, e] = await fs.lister(DOC, '');
    assert.equal(a.modifie, b.modifie);
    assert.equal(c.modifie, 7);
    assert.ok(d.modifie > a.modifie, `${d.modifie} > ${a.modifie}`);
    assert.ok(e.modifie > d.modifie, `${e.modifie} > ${d.modifie}`);
  });
});

describe('fichiers simulés : octets déposés et décodage strict', () => {
  // « Selvi » puis l'octet E8, un « è » enregistré en windows-1252 : une suite
  // qui n'est pas de l'UTF-8.
  const HORS_UTF8 = new Uint8Array([0x7b, 0x22, 0x53, 0x65, 0x6c, 0x76, 0x69, 0xe8, 0x22, 0x7d]);

  test("lireTexte refuse des octets qui ne sont pas de l'UTF-8 : LECTURE {chemin, dossier, cause: UTF8_INVALIDE, octets}, comptée, ses octets une copie dont le message ne dit que le nombre ; lister en donne la taille, octets les rend tels quels", async () => {
    const fs = preparer();
    fs.deposerOctets('documents', 'archives/soiree.gtt.json', HORS_UTF8);
    await echoue(fs.lireTexte(DOC, 'archives/soiree.gtt.json'), 'LECTURE', {
      chemin: 'archives/soiree.gtt.json',
      dossier: `${DOCUMENTS}\\archives`,
      cause: 'UTF8_INVALIDE',
      octets: HORS_UTF8,
    });
    const refus = await rejette(fs.lireTexte(DOC, 'archives/soiree.gtt.json'), 'LECTURE');
    assert.equal(
      refus.message,
      `LECTURE {"chemin":"archives/soiree.gtt.json","dossier":${JSON.stringify(`${DOCUMENTS}\\archives`)},"cause":"UTF8_INVALIDE","octets":"10 octets"}`,
    );
    refus.details.octets[0] = 0;
    assert.deepEqual(fs.octets('documents', 'archives/soiree.gtt.json'), HORS_UTF8);
    assert.deepEqual(fs.compteurs, { ecritures: 0, lectures: 2 });
    assert.deepEqual(await fs.lister(DOC, 'archives'), [
      { nom: 'soiree.gtt.json', type: 'fichier', taille: 10, modifie: (await fs.lister(DOC, 'archives'))[0].modifie },
    ]);
    assert.deepEqual(fs.octets('documents', 'archives/soiree.gtt.json'), HORS_UTF8);
    assert.equal(erreurDe(() => fs.contenu('documents', 'archives/soiree.gtt.json')).name, 'TypeError');
  });

  test("des octets UTF-8 déposés se lisent tels quels, marque d'ordre d'octets comprise ; un ajout en fin garde les octets d'avant, une écriture atomique les remplace", async () => {
    const fs = preparer();
    fs.deposerOctets('documents', 'bom.csv', new Uint8Array([0xef, 0xbb, 0xbf, 0xc3, 0xa9, 0x0d, 0x0a]));
    assert.equal(await fs.lireTexte(DOC, 'bom.csv'), '\u{FEFF}\u{E9}\r\n');
    assert.equal(fs.contenu('documents', 'bom.csv'), '\u{FEFF}\u{E9}\r\n');
    fs.deposerOctets('documents', 'journal.jsonl', HORS_UTF8);
    await fs.ajouterLigne(DOC, 'journal.jsonl', '\u{E9}');
    assert.deepEqual(fs.octets('documents', 'journal.jsonl'), new Uint8Array([...HORS_UTF8, 0xc3, 0xa9, 0x0a]));
    await fs.ecrireAtomique(DOC, 'journal.jsonl', 'neuf');
    assert.equal(await fs.lireTexte(DOC, 'journal.jsonl'), 'neuf');
    assert.deepEqual(fs.octets('documents', 'journal.jsonl'), new Uint8Array([0x6e, 0x65, 0x75, 0x66]));
    assert.equal(fs.octets('documents', 'absent.txt'), null);
    assert.equal(erreurDe(() => fs.deposerOctets('documents', 'x.txt', 'x')).name, 'TypeError');
  });

  test("un verrou aux octets hors UTF-8 se lit comme un verrou illisible", async () => {
    const fs = preparer();
    fs.deposerOctets('documents', 'soiree.gtt.verrou', HORS_UTF8);
    assert.deepEqual(await fs.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-b', DEPUIS), {
      pris: false,
      seance: null,
      depuis: null,
      vivant: null,
    });
    await fs.deverrouiller(DOC, 'soiree.gtt.verrou', 'seance-b');
    assert.deepEqual(fs.octets('documents', 'soiree.gtt.verrou'), HORS_UTF8);
  });
});

describe('fichiers simulés : préconditions et dossiers', () => {
  test("ajouterLigne refuse une ligne qui porte une fin de ligne ; ecrireAtomique, un texte qui n'est pas une chaîne ; verrouiller, une séance vide", async () => {
    const fs = preparer();
    await assert.rejects(fs.ajouterLigne(DOC, 'journal.jsonl', 'a\nb'), TypeError);
    await assert.rejects(fs.ajouterLigne(DOC, 'journal.jsonl', 'a\r'), TypeError);
    await assert.rejects(fs.ecrireAtomique(DOC, 'etat.json', new Uint8Array([0x61])), TypeError);
    await assert.rejects(fs.verrouiller(DOC, 'soiree.gtt.verrou', '', DEPUIS), TypeError);
    assert.deepEqual(await fs.lister(DOC, ''), []);
  });

  test('un dossier ne se lit, ne s\u{2019}écrit, ne se déplace ni ne se supprime comme un fichier, et un fichier ne se liste pas', async () => {
    const fs = preparer();
    fs.deposerDossier('documents', 'corbeille');
    fs.deposer('documents', 'soiree.gtt.json', 'état');
    const refus = (chemin, cause, dossier = DOCUMENTS) => ({ chemin, dossier, cause });
    await echoue(fs.lireTexte(DOC, 'corbeille'), 'ABSENT', { chemin: 'corbeille' });
    await echoue(fs.lister(DOC, 'soiree.gtt.json'), 'ABSENT', { chemin: 'soiree.gtt.json' });
    await echoue(fs.ecrireAtomique(DOC, 'corbeille', 'x'), 'ECRITURE', refus('corbeille', 'EISDIR'));
    await echoue(fs.ajouterLigne(DOC, 'corbeille', 'x'), 'ECRITURE', refus('corbeille', 'EISDIR'));
    await echoue(fs.verrouiller(DOC, 'corbeille', 'seance-a', DEPUIS), 'ECRITURE', refus('corbeille', 'EISDIR'));
    await echoue(fs.deplacer(DOC, 'corbeille', 'ailleurs'), 'ECRITURE', refus('corbeille', 'EISDIR'));
    await echoue(fs.supprimer(DOC, 'corbeille'), 'ECRITURE', refus('corbeille', 'EISDIR'));
    await echoue(fs.supprimerDossier(DOC, 'soiree.gtt.json'), 'ECRITURE', refus('soiree.gtt.json', 'ENOTDIR'));
    await echoue(fs.creerDossier(DOC, 'soiree.gtt.json'), 'ECRITURE', refus('soiree.gtt.json', 'EEXIST'));
    await echoue(
      fs.creerDossier(DOC, 'soiree.gtt.json/sous'),
      'ECRITURE',
      refus('soiree.gtt.json/sous', 'ENOTDIR', `${DOCUMENTS}\\soiree.gtt.json`),
    );
    assert.deepEqual(noms(await fs.lister(DOC, '')), ['corbeille', 'soiree.gtt.json']);
  });

  test("creerDossier de '' crée la racine, parents compris ; sous une racine absente, un autre chemin lève ECRITURE, ENOENT, sans rien créer", async () => {
    const fs = creerFichiersSimules({ executable: 'E:\\soirees' });
    await echoue(fs.creerDossier(PORTABLE, 'corbeille/2026-01-02_03-04-05'), 'ECRITURE', {
      chemin: 'corbeille/2026-01-02_03-04-05',
      dossier: `${DATA}\\corbeille`,
      cause: 'ENOENT',
    });
    await echoue(fs.lister(PORTABLE, ''), 'ABSENT', { chemin: '' });
    await fs.creerDossier(PORTABLE, '');
    assert.deepEqual(await fs.lister(PORTABLE, ''), []);
    await fs.creerDossier(PORTABLE, 'corbeille/2026-01-02_03-04-05');
    assert.deepEqual(noms(await fs.lister(PORTABLE, 'corbeille')), ['2026-01-02_03-04-05']);
  });
});
