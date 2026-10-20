// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de la règle du dossier de travail (§ 8.6, § 13.4, § 14.10), sur
// le système de fichiers d'épreuve : estSous, sur une frontière de segment et
// selon la casse du système ; les cinq issues simulées — chemin publié par le
// lanceur portable, exécutable sous un emplacement de données applicatives,
// sonde qui échoue, exécutable non publié, support amovible — et la
// plateforme web ; puis ce qui arrive ensuite : la question quand un dossier
// qui porte des événements refuse l'écriture, la proposition d'import quand
// le dossier retenu est neuf et vide, le compte des événements, et la
// lecture qui échoue : celle du dossier retenu fait rejeter, celle de l'autre
// emplacement laisse un compte inconnu. La perte d'inscriptibilité en cours
// de séance n'est pas de cette règle, qui ne s'applique qu'une fois.
//
// Le relevé des écritures de la règle — primitive et racine, dans l'ordre des
// appels — montre qu'elle n'en fait pas d'autre que ses sondes. Les noms
// d'épreuve sont inventés ; dans les données d'épreuve, un caractère hors de
// l'ASCII s'écrit en échappement.
import assert from 'node:assert/strict';
import { PanneSimulee, creerFichiersSimules } from '../../test/fichiers_simules.js';
import { describe, test } from '../../test/lanceur.js';
import { determinerDossierTravail, estSous } from './dossier_travail.js';
import { ErreurStockage } from './erreurs.js';

const DOCUMENTS = 'C:\\Users\\Exemple\\Documents\\Gestion table tournante Libre';
const DOC = { id: 'documents', chemin: DOCUMENTS };
const PORTABLE = { id: 'portable', chemin: 'E:\\soirees\\data' };

// Un exécutable publié sous un emplacement de données applicatives, comme
// l'y rangerait un installateur, et son data/.
const SOUS_APPDATA = 'C:\\Users\\Exemple\\AppData\\Local\\Programs\\gtt';
const DATA_SOUS_APPDATA = { id: 'portable', chemin: `${SOUS_APPDATA}\\data` };

const WINDOWS = { insensibleCasse: true, separateur: '\\' };
const UNIX = { insensibleCasse: false, separateur: '/' };

// Réglages du système d'épreuve sous Unix, sensible à la casse.
const SYSTEME_UNIX = {
  separateur: '/',
  insensibleCasse: false,
  documents: '/home/exemple/Documents/Gestion table tournante Libre',
  donneesApplicatives: ['/home/exemple/.config', '/tmp'],
};

// Les primitives d'écriture de l'interface (systeme_fichiers.js).
const PRIMITIVES_ECRITURE = [
  'ecrireAtomique',
  'ajouterLigne',
  'creerDossier',
  'deplacer',
  'supprimer',
  'verrouiller',
  'deverrouiller',
  'sonder',
];

// Un système d'épreuve, et le relevé de ses écritures : [primitive, racine],
// dans l'ordre des appels. Le reste — lectures, pannes, mains de l'épreuve —
// est celui du système simulé.
function preparer(options = {}) {
  const simule = creerFichiersSimules(options);
  const ecritures = [];
  const fs = { ...simule };
  for (const nom of PRIMITIVES_ECRITURE) {
    fs[nom] = (racine, ...reste) => {
      ecritures.push([nom, racine?.id]);
      return simule[nom](racine, ...reste);
    };
  }
  return { fs, ecritures };
}

// Le résultat d'une détermination : les champs donnés, les autres à leur
// valeur quand rien n'est à demander, à proposer ni à annoncer.
const dossier = (champs) => ({ raison: null, cause: null, question: null, autre: null, avertissements: [], ...champs });

// Pose un événement sous une base : son état et son journal. La règle compte
// les fichiers sans les lire : leur contenu n'importe pas.
function poserEvenement(fs, racineId, base) {
  fs.deposer(racineId, `${base}.gtt.json`, '{}\n');
  fs.deposer(racineId, `${base}.gtt-journal.jsonl`, '{}\n');
}

// Rejet de la liste d'un dossier qui n'existe pas.
const absent = (erreur) => erreur instanceof ErreurStockage && erreur.code === 'ABSENT';

// Une lecture que la plateforme refuse. Le contrat ne nomme d'échec de
// lecture que le dossier absent : une ErreurStockage d'un autre code, qui
// porte la cause de la plateforme, en tient lieu.
const lectureRefusee = (racine, cause) => new ErreurStockage('ECRITURE', { chemin: '', dossier: racine.chemin, cause });

// Le système d'épreuve dont lister lève erreur sur une racine, et lit les
// autres comme lui.
function listerEnPanne(fs, racineId, erreur) {
  return {
    ...fs,
    async lister(racine, dossier) {
      if (racine.id === racineId) throw erreur;
      return fs.lister(racine, dossier);
    },
  };
}

describe('estSous', () => {
  test("vrai pour le parent et sous lui, sur une frontière de segment : AppDataBis n'est pas sous AppData", () => {
    const appData = 'C:\\Users\\Exemple\\AppData';
    const cas = [
      ['C:\\Users\\Exemple\\AppData\\Local\\Temp\\x', 'C:\\Users\\Exemple\\AppData\\Local', WINDOWS, true],
      [appData, appData, WINDOWS, true],
      ['C:\\Users\\Exemple\\AppDataBis', appData, WINDOWS, false],
      ['C:\\Users\\Exemple\\AppDataBis\\soirees', appData, WINDOWS, false],
      ['C:\\Users\\Exemple', appData, WINDOWS, false],
      ['E:\\soirees', appData, WINDOWS, false],
      ['/home/exemple/.config/outil', '/home/exemple/.config', UNIX, true],
      ['/home/exemple/.configBis', '/home/exemple/.config', UNIX, false],
      // Sous Unix, la barre oblique inverse est un caractère du nom.
      ['/tmp\\x', '/tmp', UNIX, false],
    ];
    for (const [chemin, parent, systeme, attendu] of cas) {
      assert.equal(estSous(chemin, parent, systeme), attendu, `${chemin} sous ${parent}`);
    }
  });

  test("un séparateur final ne compte pas, et la racine d'un volume porte tout le volume", () => {
    const local = 'C:\\Users\\Exemple\\AppData\\Local';
    const cas = [
      [`${local}\\`, local, WINDOWS, true],
      [`${local}\\x`, `${local}\\`, WINDOWS, true],
      [`${local}x`, `${local}\\`, WINDOWS, false],
      ['C:\\soirees', 'C:\\', WINDOWS, true],
      ['C:\\', 'C:\\', WINDOWS, true],
      ['D:\\soirees', 'C:\\', WINDOWS, false],
      ['/tmp/x', '/', UNIX, true],
      ['/tmp', '/tmp/', UNIX, true],
      ['/tmpx', '/tmp/', UNIX, false],
    ];
    for (const [chemin, parent, systeme, attendu] of cas) {
      assert.equal(estSous(chemin, parent, systeme), attendu, `${chemin} sous ${parent}`);
    }
  });

  test("sans égard à la casse là où le système l'ignore, caractère par caractère comme Windows ; sensible ailleurs", () => {
    const cas = [
      ['c:\\users\\exemple\\appdata\\local\\temp\\x', 'C:\\Users\\Exemple\\AppData\\Local', WINDOWS, true],
      ['C:\\USERS\\EXEMPLE\\APPDATA\\ROAMING', 'c:\\users\\exemple\\appdata\\roaming', WINDOWS, true],
      // Au-delà de l'ASCII : É et é se confondent.
      ['C:\\Users\\\u{C9}T\u{C9}\\AppData\\Local\\x', 'C:\\Users\\\u{E9}t\u{E9}\\AppData\\Local', WINDOWS, true],
      // ß n'a pas de majuscule d'un seul caractère : Windows ne le confond
      // pas avec SS, deux noms, deux dossiers.
      ['C:\\Users\\STRASSE\\x', 'C:\\Users\\stra\u{DF}e', WINDOWS, false],
      ['/home/exemple/.config/outil', '/home/exemple/.CONFIG', UNIX, false],
      ['/TMP/x', '/tmp', UNIX, false],
    ];
    for (const [chemin, parent, systeme, attendu] of cas) {
      assert.equal(estSous(chemin, parent, systeme), attendu, `${chemin} sous ${parent}`);
    }
  });
});

describe('determinerDossierTravail : les cinq issues (§ 8.6, § 13.4)', () => {
  test("publié sur E:\\soirees, sonde réussie : data/ est le dossier de travail, créé par la sonde, et rien ne s'écrit hors de lui", async () => {
    const { fs, ecritures } = preparer({ executable: 'E:\\soirees' });
    assert.deepEqual(await determinerDossierTravail(fs), dossier({ racine: PORTABLE, mode: 'portable' }));
    assert.deepEqual(ecritures, [['sonder', 'portable']]);
    assert.deepEqual(await fs.lister(PORTABLE, ''), []);
    await assert.rejects(fs.lister(DOC, ''), absent);
  });

  test('publié sous AppData\\Local\\Temp : documents, DONNEES_APPLICATIVES, et data/ ni sondé ni créé', async () => {
    const executable = 'C:\\Users\\Exemple\\AppData\\Local\\Temp\\x';
    const { fs, ecritures } = preparer({ executable });
    assert.deepEqual(
      await determinerDossierTravail(fs),
      dossier({ racine: DOC, mode: 'documents', raison: 'DONNEES_APPLICATIVES' }),
    );
    assert.deepEqual(ecritures, [['sonder', 'documents']]);
    await assert.rejects(fs.lister({ id: 'portable', chemin: `${executable}\\data` }, ''), absent);
    assert.deepEqual(await fs.lister(DOC, ''), []);
  });

  test("l'exécutable se compare aux données applicatives selon la casse et le séparateur du système", async () => {
    // AppData lui-même, et non ses seuls Roaming et Local : tout ce qu'il
    // contient est sous lui, et rien de ce qui prolonge son nom.
    const appData = ['C:\\Users\\Exemple\\AppData'];
    const cas = [
      [{ executable: 'c:\\users\\exemple\\appdata\\roaming\\outil' }, ['documents', 'DONNEES_APPLICATIVES']],
      [{ donneesApplicatives: appData, executable: 'C:\\Users\\Exemple\\AppData\\LocalLow\\soirees' }, ['documents', 'DONNEES_APPLICATIVES']],
      [{ donneesApplicatives: appData, executable: 'C:\\Users\\Exemple\\AppDataBis\\soirees' }, ['portable', null]],
      [{ ...SYSTEME_UNIX, executable: '/tmp/montage-gtt' }, ['documents', 'DONNEES_APPLICATIVES']],
      [{ ...SYSTEME_UNIX, executable: '/TMP/soirees' }, ['portable', null]],
      [{ ...SYSTEME_UNIX, executable: '/media/cle/soirees' }, ['portable', null]],
    ];
    for (const [options, attendu] of cas) {
      const { fs } = preparer(options);
      const { mode, raison } = await determinerDossierTravail(fs);
      assert.deepEqual([mode, raison], attendu, options.executable);
    }
  });

  test('la sonde de data/ échoue (EACCES) : documents, SONDE_ECHOUEE et sa cause ; data/ ne porte rien, rien à demander', async () => {
    const { fs, ecritures } = preparer({ executable: 'E:\\soirees', sonde: { portable: 'EACCES' } });
    assert.deepEqual(
      await determinerDossierTravail(fs),
      dossier({ racine: DOC, mode: 'documents', raison: 'SONDE_ECHOUEE', cause: 'EACCES' }),
    );
    assert.deepEqual(ecritures, [
      ['sonder', 'portable'],
      ['sonder', 'documents'],
    ]);
    assert.deepEqual(await fs.lister(DOC, ''), []);
  });

  test('non publié : documents, NON_PUBLIE, et le dossier des Documents créé par sa sonde', async () => {
    const { fs, ecritures } = preparer();
    assert.deepEqual(await determinerDossierTravail(fs), dossier({ racine: DOC, mode: 'documents', raison: 'NON_PUBLIE' }));
    assert.deepEqual(ecritures, [['sonder', 'documents']]);
    assert.deepEqual(await fs.lister(DOC, ''), []);
  });

  test('support amovible : SUPPORT_AMOVIBLE, pour le seul dossier de travail retenu', async () => {
    const cas = [
      [{ executable: 'E:\\soirees', support: { portable: 'amovible' } }, ['portable', ['SUPPORT_AMOVIBLE']]],
      // data/ sur la clé refuse l'écriture : le dossier retenu est fixe.
      [{ executable: 'E:\\soirees', support: { portable: 'amovible' }, sonde: { portable: 'EROFS' } }, ['documents', []]],
      [{ support: { documents: 'amovible' } }, ['documents', ['SUPPORT_AMOVIBLE']]],
      // Un support inconnu n'est pas annoncé amovible.
      [{ executable: 'E:\\soirees', support: { portable: 'inconnu' } }, ['portable', []]],
      // Les deux avertissements, dans l'ordre que le résultat promet.
      [{ ...SYSTEME_UNIX, nature: 'web', support: { documents: 'amovible' } }, ['web', ['PLATEFORME_WEB', 'SUPPORT_AMOVIBLE']]],
    ];
    for (const [options, attendu] of cas) {
      const { fs } = preparer(options);
      const { mode, avertissements } = await determinerDossierTravail(fs);
      assert.deepEqual([mode, avertissements], attendu, JSON.stringify(options));
    }
  });

  test("web : la racine documents, mode web, PLATEFORME_WEB ; un dossier publié n'y désigne rien", async () => {
    const racine = { id: 'documents', chemin: '/gestion_table_tournante_libre' };
    const { fs, ecritures } = preparer({
      nature: 'web',
      renommageAtomique: false,
      verrouDisponible: false,
      separateur: '/',
      insensibleCasse: false,
      documents: racine.chemin,
      executable: '/media/cle/soirees',
    });
    poserEvenement(fs, 'portable', 'gala-printemps');
    assert.deepEqual(
      await determinerDossierTravail(fs),
      dossier({ racine, mode: 'web', avertissements: ['PLATEFORME_WEB'] }),
    );
    assert.deepEqual(ecritures, [['sonder', 'documents']]);
  });
});

describe('determinerDossierTravail : ce qui arrive ensuite (§ 8.6)', () => {
  test("data/ porte deux événements et refuse l'écriture : question avec le compte, et rien ne bascule en silence", async () => {
    const { fs, ecritures } = preparer({ executable: 'E:\\soirees', sonde: { portable: 'EROFS' } });
    poserEvenement(fs, 'portable', 'gala-printemps');
    poserEvenement(fs, 'portable', 'souper-benefice');
    const avant = await fs.lister(PORTABLE, '');
    assert.deepEqual(
      await determinerDossierTravail(fs),
      dossier({
        racine: DOC,
        mode: 'documents',
        raison: 'SONDE_ECHOUEE',
        cause: 'EROFS',
        question: { code: 'PORTABLE_NON_INSCRIPTIBLE', racine: PORTABLE, evenements: 2, cause: 'EROFS' },
        autre: { racine: PORTABLE, evenements: 2 },
      }),
    );
    // Seules les sondes écrivent : data/ reste tel quel, et rien n'en est
    // copié dans les Documents avant que l'opérateur ait répondu.
    assert.deepEqual(ecritures, [
      ['sonder', 'portable'],
      ['sonder', 'documents'],
    ]);
    assert.deepEqual(await fs.lister(PORTABLE, ''), avant);
    assert.deepEqual(await fs.lister(DOC, ''), []);
  });

  test("un événement compte par ses deux fichiers, à la racine du dossier : un état, un journal, ou les deux sous la même base", async () => {
    const { fs } = preparer({ executable: 'E:\\soirees', sonde: { portable: 'EROFS' } });
    // Trois événements : état et journal, état seul, journal seul.
    poserEvenement(fs, 'portable', 'gala');
    fs.deposer('portable', 'souper.gtt.json', '{}\n');
    fs.deposer('portable', 'tournoi.gtt-journal.jsonl', '{}\n');
    // Aucun des suivants n'en est un.
    fs.deposer('portable', 'kermesse.gtt.json.precedent', '{}\n');
    fs.deposer('portable', 'kermesse.gtt.verrou', '{}\n');
    fs.deposer('portable', 'kermesse.gtt.json.ecriture', '{}\n');
    fs.deposer('portable', 'reglages_locaux.json', '{}\n');
    fs.deposer('portable', 'corbeille/2026-01-02_03-04-05/bazar.gtt.json', '{}\n');
    fs.deposerDossier('portable', 'archives.gtt.json');
    const { question } = await determinerDossierTravail(fs);
    assert.deepEqual(question, { code: 'PORTABLE_NON_INSCRIPTIBLE', racine: PORTABLE, evenements: 3, cause: 'EROFS' });
  });

  test("data/ qui ne porte que des restes d'événements ne fait rien demander", async () => {
    const { fs } = preparer({ executable: 'E:\\soirees', sonde: { portable: 'EROFS' } });
    fs.deposer('portable', 'kermesse.gtt.json.precedent', '{}\n');
    fs.deposer('portable', 'corbeille/2026-01-02_03-04-05/bazar.gtt.json', '{}\n');
    const { question, raison } = await determinerDossierTravail(fs);
    assert.deepEqual([question, raison], [null, 'SONDE_ECHOUEE']);
  });

  test("le dossier retenu neuf et vide, l'autre emplacement porte des événements : autre, dans les deux sens", async () => {
    const versDocuments = preparer({ executable: 'E:\\soirees' });
    for (const base of ['gala', 'souper', 'tournoi']) poserEvenement(versDocuments.fs, 'documents', base);
    assert.deepEqual(
      await determinerDossierTravail(versDocuments.fs),
      dossier({ racine: PORTABLE, mode: 'portable', autre: { racine: DOC, evenements: 3 } }),
    );

    // data/ sous AppData se lit sans se sonder.
    const versData = preparer({ executable: SOUS_APPDATA });
    poserEvenement(versData.fs, 'portable', 'gala');
    assert.deepEqual(
      await determinerDossierTravail(versData.fs),
      dossier({
        racine: DOC,
        mode: 'documents',
        raison: 'DONNEES_APPLICATIVES',
        autre: { racine: DATA_SOUS_APPDATA, evenements: 1 },
      }),
    );
    assert.deepEqual(versData.ecritures, [['sonder', 'documents']]);
  });

  test("un dossier retenu qui porte la moindre entrée n'est pas neuf, et un emplacement sans événement ne propose rien", async () => {
    // data/ a servi : sa corbeille le dit.
    const corbeille = preparer({ executable: 'E:\\soirees' });
    corbeille.fs.deposerDossier('portable', 'corbeille/2026-01-02_03-04-05');
    poserEvenement(corbeille.fs, 'documents', 'gala');
    // Les Documents ont servi : leurs réglages locaux le disent.
    const reglages = preparer({ executable: SOUS_APPDATA });
    reglages.fs.deposer('documents', 'reglages_locaux.json', '{}\n');
    poserEvenement(reglages.fs, 'portable', 'gala');
    // Les Documents n'ont que des restes d'événements.
    const restes = preparer({ executable: 'E:\\soirees' });
    restes.fs.deposer('documents', 'gala.gtt.json.precedent', '{}\n');
    restes.fs.deposerDossier('documents', 'corbeille');
    for (const [nom, { fs }] of [['corbeille', corbeille], ['reglages', reglages], ['restes', restes]]) {
      assert.equal((await determinerDossierTravail(fs)).autre, null, nom);
    }
  });

  test("un témoin resté d'une séance précédente ne compte pas : la sonde l'efface avant que la règle lise le dossier", async () => {
    const portable = preparer({ executable: 'E:\\soirees' });
    portable.fs.deposer('portable', '.gtt-temoin', '.gtt-temoin');
    poserEvenement(portable.fs, 'documents', 'gala');
    assert.deepEqual((await determinerDossierTravail(portable.fs)).autre, { racine: DOC, evenements: 1 });
    assert.equal(portable.fs.contenu('portable', '.gtt-temoin'), null);

    const documents = preparer({ executable: SOUS_APPDATA });
    documents.fs.deposer('documents', '.gtt-temoin', '.gtt-temoin');
    poserEvenement(documents.fs, 'portable', 'gala');
    assert.deepEqual((await determinerDossierTravail(documents.fs)).autre, { racine: DATA_SOUS_APPDATA, evenements: 1 });
    assert.equal(documents.fs.contenu('documents', '.gtt-temoin'), null);
  });

  test("la sonde du dossier retenu échoue : DOCUMENTS_NON_INSCRIPTIBLE ; data/ qui porte des événements garde la priorité", async () => {
    const nonPublie = preparer({ sonde: { documents: 'EPERM' } });
    poserEvenement(nonPublie.fs, 'documents', 'gala');
    assert.deepEqual(
      await determinerDossierTravail(nonPublie.fs),
      dossier({
        racine: DOC,
        mode: 'documents',
        raison: 'NON_PUBLIE',
        question: { code: 'DOCUMENTS_NON_INSCRIPTIBLE', racine: DOC, evenements: 1, cause: 'EPERM' },
      }),
    );

    const racineWeb = { id: 'documents', chemin: '/gestion_table_tournante_libre' };
    const web = preparer({ ...SYSTEME_UNIX, nature: 'web', documents: racineWeb.chemin, sonde: { documents: 'QuotaExceededError' } });
    assert.deepEqual(
      (await determinerDossierTravail(web.fs)).question,
      { code: 'DOCUMENTS_NON_INSCRIPTIBLE', racine: racineWeb, evenements: 0, cause: 'QuotaExceededError' },
    );

    const lesDeux = { executable: 'E:\\soirees', sonde: { portable: 'EROFS', documents: 'EPERM' } };
    const avecEvenements = preparer(lesDeux);
    poserEvenement(avecEvenements.fs, 'portable', 'gala');
    assert.deepEqual(
      (await determinerDossierTravail(avecEvenements.fs)).question,
      { code: 'PORTABLE_NON_INSCRIPTIBLE', racine: PORTABLE, evenements: 1, cause: 'EROFS' },
    );
    const sansEvenement = preparer(lesDeux);
    assert.deepEqual(
      (await determinerDossierTravail(sansEvenement.fs)).question,
      { code: 'DOCUMENTS_NON_INSCRIPTIBLE', racine: DOC, evenements: 0, cause: 'EPERM' },
    );
  });

  test("la lecture du dossier retenu qui échoue autrement que sur un dossier absent remonte : une panne n'est pas un dossier vide", async () => {
    // Le processus meurt après la sonde de data/, sa seule écriture.
    const coupe = preparer({ executable: 'E:\\soirees' });
    coupe.fs.pannes.couperApres(1);
    await assert.rejects(determinerDossierTravail(coupe.fs), PanneSimulee);

    // data/ retenu, puis les Documents retenus, refusent leur lecture.
    const cas = [
      [{ executable: 'E:\\soirees' }, PORTABLE],
      [{ executable: 'E:\\soirees', sonde: { portable: 'EACCES' } }, DOC],
    ];
    for (const [options, racine] of cas) {
      const refus = lectureRefusee(racine, 'EIO');
      const { fs } = preparer(options);
      await assert.rejects(determinerDossierTravail(listerEnPanne(fs, racine.id, refus)), (erreur) => erreur === refus, racine.id);
    }
  });

  test("la lecture de l'autre emplacement qui échoue laisse le dossier retenu : rien ne se propose, et data/ qui refuse l'écriture fait demander, compte inconnu", async () => {
    // Les Documents, sur un partage injoignable, portent peut-être des
    // événements : data/ reste le dossier de travail, sans proposition.
    const portable = preparer({ executable: 'E:\\soirees' });
    poserEvenement(portable.fs, 'documents', 'gala');
    assert.deepEqual(
      await determinerDossierTravail(listerEnPanne(portable.fs, 'documents', lectureRefusee(DOC, 'ETIMEDOUT'))),
      dossier({ racine: PORTABLE, mode: 'portable' }),
    );

    // data/ sous AppData ne se lit pas : rien à proposer, rien à demander.
    const sousAppData = preparer({ executable: SOUS_APPDATA });
    poserEvenement(sousAppData.fs, 'portable', 'gala');
    assert.deepEqual(
      await determinerDossierTravail(listerEnPanne(sousAppData.fs, 'portable', lectureRefusee(DATA_SOUS_APPDATA, 'EPERM'))),
      dossier({ racine: DOC, mode: 'documents', raison: 'DONNEES_APPLICATIVES' }),
    );

    // data/ refuse l'écriture et la lecture, sous des droits posés par un
    // autre poste : ce qu'il porte est inconnu, et la règle demande plutôt
    // que de basculer en silence.
    const etranger = preparer({ executable: 'E:\\soirees', sonde: { portable: 'EPERM' } });
    poserEvenement(etranger.fs, 'portable', 'gala');
    assert.deepEqual(
      await determinerDossierTravail(listerEnPanne(etranger.fs, 'portable', lectureRefusee(PORTABLE, 'EPERM'))),
      dossier({
        racine: DOC,
        mode: 'documents',
        raison: 'SONDE_ECHOUEE',
        cause: 'EPERM',
        question: { code: 'PORTABLE_NON_INSCRIPTIBLE', racine: PORTABLE, evenements: null, cause: 'EPERM' },
      }),
    );
  });

  test("un chemin refusé, ou une erreur hors du stockage, remonte même de l'autre emplacement : une faute du code n'est pas un état du disque", async () => {
    for (const erreur of [new ErreurStockage('CHEMIN_REFUSE', { chemin: '' }), new Error('canal rompu')]) {
      const { fs } = preparer({ executable: 'E:\\soirees' });
      await assert.rejects(determinerDossierTravail(listerEnPanne(fs, 'documents', erreur)), (recue) => recue === erreur, erreur.message);
    }
  });
});
