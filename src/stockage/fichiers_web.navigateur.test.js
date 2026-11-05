// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du système de fichiers de la plateforme web (§ 8.8, § 13.1,
// § 13.4), dans Chromium, sur son OPFS réel, vidé avant chaque épreuve. La
// suite de contrat test/contrat_fichiers.js s'y joue avec expect ; suit ce
// qui n'appartient qu'à la plateforme web : sa nature, ses emplacements, sa
// racine unique — le dossier gestion_table_tournante_libre de l'OPFS —, la
// correspondance des refus de l'OPFS avec les codes du stockage, le verrou
// qui n'en est pas un, les primitives qui n'existent pas sous web, le choix
// d'un fichier à importer et l'enregistrement par téléchargement.
//
// Une panne de l'OPFS se provoque en remplaçant, le temps d'une épreuve, une
// méthode de ses prototypes (vi.spyOn), que afterEach rétablit ; un dialogue,
// en remplaçant le clic du champ de fichier ou du lien. Les mains de
// l'épreuve sur l'OPFS passent par navigator.storage, jamais par le module
// éprouvé. Le projet navigateur n'importe pas node:assert/strict : il emploie
// expect, et prend test, describe et les crochets chez Vitest. Les noms
// d'épreuve sont inventés.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { eprouverContrat } from '../../test/contrat_fichiers.js';
import { ErreurStockage } from './erreurs.js';
import { TEMOIN, creerFichiersWeb } from './fichiers_web.js';
import { LOGO_SOURCE_MAX_OCTETS } from './logos.js';
import { NOMS_RESERVES_RACINE } from './noms.js';

// Le dossier du produit dans l'OPFS, et la racine qui le désigne.
const DOSSIER = 'gestion_table_tournante_libre';
const CHEMIN_DOCUMENTS = '/gestion_table_tournante_libre';
const DOCUMENTS = { id: 'documents', chemin: CHEMIN_DOCUMENTS };

// Octets d'un fichier venu d'ailleurs : marque d'ordre d'octets, CRLF, et un
// octet qui n'est pas de l'UTF-8.
const BRUTS = new Uint8Array([0xef, 0xbb, 0xbf, 0x6e, 0x6f, 0x6d, 0x3b, 0x0d, 0x0a, 0xff]);

const opfs = () => navigator.storage.getDirectory();

// Retire toute entrée de la racine de l'OPFS.
async function viderOpfs() {
  const racine = await opfs();
  const noms = [];
  for await (const nom of racine.keys()) noms.push(nom);
  for (const nom of noms) await racine.removeEntry(nom, { recursive: true });
}

// Noms des entrées de la racine de l'OPFS, triés.
async function nomsOpfs() {
  const noms = [];
  for await (const nom of (await opfs()).keys()) noms.push(nom);
  return noms.sort();
}

// Le dossier du produit, lu dans l'OPFS ; NotFoundError quand il manque.
const dossierProduit = async () => (await opfs()).getDirectoryHandle(DOSSIER);

// Octets du fichier que désignent les segments sous le dossier du produit.
async function octetsOpfs(...segments) {
  let dossier = await dossierProduit();
  for (const segment of segments.slice(0, -1)) dossier = await dossier.getDirectoryHandle(segment);
  const fichier = await (await dossier.getFileHandle(segments.at(-1))).getFile();
  return new Uint8Array(await fichier.arrayBuffer());
}

// Pose des octets sous un nom, à la racine du dossier du produit.
async function poserOpfs(nom, octets) {
  const flux = await (await (await dossierProduit()).getFileHandle(nom, { create: true })).createWritable();
  await flux.write(octets);
  await flux.close();
}

// Un système neuf sur un dossier du produit qui existe et ne porte rien.
async function preparer() {
  await (await opfs()).getDirectoryHandle(DOSSIER, { create: true });
  return creerFichiersWeb();
}

// Rend la raison du rejet de la promesse ; échoue quand elle se résout.
async function rejette(promesse, message) {
  try {
    await promesse;
  } catch (raison) {
    return raison;
  }
  return expect.unreachable(`${message} : la promesse se résout`);
}

// Attend le rejet d'une ErreurStockage de ce code et de ces détails.
async function echoue(promesse, code, details, message = code) {
  const erreur = await rejette(promesse, message);
  expect(erreur, message).toBeInstanceOf(ErreurStockage);
  expect(erreur.code, message).toBe(code);
  expect(erreur.details, message).toStrictEqual(details);
}

const noms = (entrees) => entrees.map((entree) => entree.nom);

beforeEach(viderOpfs);
afterEach(() => {
  vi.restoreAllMocks();
});

eprouverContrat("web, sur l'OPFS de Chromium", async () => {
  const fs = await preparer();
  return { fs, racine: (await fs.racines()).documents };
}, {
  describe,
  test,
  egal: (reel, attendu, message) => expect(reel, message).toStrictEqual(attendu),
  vrai: (valeur, message) => expect(valeur, message).toBeTruthy(),
  rejette,
});

describe('fichiers web : la plateforme et sa racine (§ 8.8, § 13.1)', () => {
  test('le témoin que la sonde écrit à la racine est un nom réservé : aucun dossier d’événement ne le prend', () => {
    expect(NOMS_RESERVES_RACINE).toContain(TEMOIN);
  });

  test("nature web, ni renommage atomique ni verrou ; ni exécutable ni données applicatives ; noms comparés à la lettre sous « / » ; support inconnu", async () => {
    const fs = creerFichiersWeb();
    expect(fs.nature).toBe('web');
    expect(fs.renommageAtomique).toBe(false);
    expect(fs.verrouDisponible).toBe(false);
    expect(await fs.emplacements()).toStrictEqual({
      executable: null,
      donneesApplicatives: [],
      insensibleCasse: false,
      separateur: '/',
    });
    expect(await fs.racines()).toStrictEqual({ portable: null, documents: DOCUMENTS });
    expect(await fs.typeSupport(DOCUMENTS)).toBe('inconnu');
  });

  // Sous Linux, Chromium convertit le nom d'une entrée de l'OPFS par les
  // paramètres régionaux de son processus. Hors UTF-8 — LANG absent,
  // LC_ALL=C —, un nom hors ASCII ne se convertit pas et désigne le dossier
  // qui le porte : un fichier y lève TypeMismatchError, un dossier y rend son
  // parent. Les épreuves qui écrivent un nom accentué n'éprouvent alors plus
  // le module ; celle-ci, sur l'OPFS seul, nomme la cause.
  test("l'OPFS de ce Chromium nomme une entrée hors ASCII : un fichier et un dossier accentués se créent et se listent sous leur nom", async () => {
    const racine = await opfs();
    const cause = 'Chromium tourne sous des paramètres régionaux qui ne sont pas UTF-8 : lancer les épreuves sous LANG=C.UTF-8';
    let refus = null;
    try {
      await racine.getFileHandle('\u{E9}t\u{E9}.txt', { create: true });
    } catch (erreur) {
      refus = erreur.name;
    }
    expect(refus, cause).toBeNull();
    const dossier = await racine.getDirectoryHandle('\u{E9}', { create: true });
    expect(await dossier.isSameEntry(racine), cause).toBe(false);
    expect(await nomsOpfs(), cause).toStrictEqual(['\u{E9}', '\u{E9}t\u{E9}.txt']);
  });

  test("la racine documents est le dossier gestion_table_tournante_libre de l'OPFS : ce qui s'y écrit s'y lit en UTF-8 sans marque d'ordre d'octets, et ce qui s'y pose se lit et se liste", async () => {
    const fs = await preparer();
    await fs.creerDossier(DOCUMENTS, 'corbeille');
    await fs.ecrireAtomique(DOCUMENTS, 'corbeille/\u{E9}t\u{E9}.txt', '\u{E9}t\u{E9}');
    await fs.ajouterLigne(DOCUMENTS, 'journal.jsonl', '\u{AB} a \u{BB}');
    expect(await nomsOpfs()).toStrictEqual([DOSSIER]);
    expect(await octetsOpfs('corbeille', '\u{E9}t\u{E9}.txt')).toStrictEqual(
      new Uint8Array([0xc3, 0xa9, 0x74, 0xc3, 0xa9]),
    );
    expect(await octetsOpfs('journal.jsonl')).toStrictEqual(
      new Uint8Array([0xc2, 0xab, 0x20, 0x61, 0x20, 0xc2, 0xbb, 0x0a]),
    );

    // Des octets UTF-8 se lisent tels quels, marque d'ordre d'octets et CRLF
    // compris ; un octet qui n'est pas de l'UTF-8 lève LECTURE, cause
    // UTF8_INVALIDE, au lieu de se lire U+FFFD ; le refus porte les octets
    // du fichier, que le dépôt décode ligne par ligne.
    await poserOpfs('pose.csv', BRUTS.subarray(0, BRUTS.length - 1));
    expect(await fs.lireTexte(DOCUMENTS, 'pose.csv')).toBe('\u{FEFF}nom;\r\n');
    await poserOpfs('pose.csv', BRUTS);
    await echoue(fs.lireTexte(DOCUMENTS, 'pose.csv'), 'LECTURE', {
      chemin: 'pose.csv',
      dossier: CHEMIN_DOCUMENTS,
      cause: 'UTF8_INVALIDE',
      octets: new Uint8Array(BRUTS),
    });
    expect(noms(await fs.lister(DOCUMENTS, ''))).toStrictEqual(['corbeille', 'journal.jsonl', 'pose.csv']);
  });

  test("sonder crée le dossier du produit dans un OPFS vide, et n'y laisse aucun témoin", async () => {
    const fs = creerFichiersWeb();
    expect(await nomsOpfs()).toStrictEqual([]);
    expect(await fs.sonder(DOCUMENTS)).toStrictEqual({ inscriptible: true, cause: null });
    expect(await nomsOpfs()).toStrictEqual([DOSSIER]);
    expect(await fs.lister(DOCUMENTS, '')).toStrictEqual([]);
  });

  test("sans le dossier du produit : une écriture lève ECRITURE sans le recréer, une lecture ABSENT, supprimer et supprimerDossier ne font rien, creerDossier d'un chemin sous lui aussi ; creerDossier de '' le crée", async () => {
    const fs = creerFichiersWeb();
    const refus = (chemin, dossier = CHEMIN_DOCUMENTS) => ({ chemin, dossier, cause: 'NotFoundError' });
    await echoue(fs.ecrireAtomique(DOCUMENTS, 'etat.json', 'x'), 'ECRITURE', refus('etat.json'));
    await echoue(fs.ajouterLigne(DOCUMENTS, 'journal.jsonl', 'x'), 'ECRITURE', refus('journal.jsonl'));
    await echoue(fs.lireTexte(DOCUMENTS, 'etat.json'), 'ABSENT', { chemin: 'etat.json' });
    await echoue(fs.lister(DOCUMENTS, ''), 'ABSENT', { chemin: '' });
    await echoue(fs.deplacer(DOCUMENTS, 'etat.json', 'copie.json'), 'ABSENT', { chemin: 'etat.json' });
    await fs.supprimer(DOCUMENTS, 'etat.json');
    await fs.supprimerDossier(DOCUMENTS, 'corbeille');
    await echoue(
      fs.creerDossier(DOCUMENTS, 'corbeille/2026-01-02_03-04-05'),
      'ECRITURE',
      refus('corbeille/2026-01-02_03-04-05', `${CHEMIN_DOCUMENTS}/corbeille`),
    );
    expect(await nomsOpfs()).toStrictEqual([]);

    await fs.creerDossier(DOCUMENTS, '');
    expect(await nomsOpfs()).toStrictEqual([DOSSIER]);
    expect(await fs.lister(DOCUMENTS, '')).toStrictEqual([]);
    await fs.creerDossier(DOCUMENTS, 'corbeille/2026-01-02_03-04-05');
    expect(noms(await fs.lister(DOCUMENTS, 'corbeille'))).toStrictEqual(['2026-01-02_03-04-05']);
  });
});

describe("fichiers web : retirer un dossier de l'OPFS", () => {
  test("supprimerDossier retire la poignée d'un dossier vide par removeEntry, sans recursive, du dossier qui le porte", async () => {
    const fs = await preparer();
    await fs.creerDossier(DOCUMENTS, 'Gala des Saules/logo');
    const retraits = [];
    const retirer = FileSystemDirectoryHandle.prototype.removeEntry;
    vi.spyOn(FileSystemDirectoryHandle.prototype, 'removeEntry').mockImplementation(
      async function removeEntry(...parametres) {
        retraits.push([this.name, ...parametres]);
        return retirer.apply(this, parametres);
      },
    );
    await fs.supprimerDossier(DOCUMENTS, 'Gala des Saules/logo');
    await fs.supprimerDossier(DOCUMENTS, 'Gala des Saules');
    expect(retraits).toStrictEqual([
      ['Gala des Saules', 'logo'],
      [DOSSIER, 'Gala des Saules'],
    ]);
    expect(await fs.lister(DOCUMENTS, '')).toStrictEqual([]);
    expect(await nomsOpfs()).toStrictEqual([DOSSIER]);
  });

  test("un dossier non vide — un fichier d'échange .crswap de Chromium compris — lève NON_VIDE, que l'OPFS refuse par InvalidModificationError, et rien n'en part", async () => {
    const fs = await preparer();
    await fs.creerDossier(DOCUMENTS, 'Gala des Saules');
    const dossier = await (await dossierProduit()).getDirectoryHandle('Gala des Saules');
    await dossier.getFileHandle('etat.json.crswap', { create: true });
    await echoue(fs.supprimerDossier(DOCUMENTS, 'Gala des Saules'), 'NON_VIDE', { chemin: 'Gala des Saules' });
    expect(await fs.lister(DOCUMENTS, 'Gala des Saules')).toMatchObject([{ nom: 'etat.json.crswap', type: 'fichier' }]);
  });

  test("un autre refus de removeEntry lève ECRITURE de sa cause, et le dossier reste", async () => {
    const fs = await preparer();
    await fs.creerDossier(DOCUMENTS, 'Gala des Saules');
    vi.spyOn(FileSystemDirectoryHandle.prototype, 'removeEntry').mockRejectedValue(
      new DOMException('refus', 'NoModificationAllowedError'),
    );
    await echoue(fs.supprimerDossier(DOCUMENTS, 'Gala des Saules'), 'ECRITURE', {
      chemin: 'Gala des Saules',
      dossier: CHEMIN_DOCUMENTS,
      cause: 'NoModificationAllowedError',
    });
    vi.restoreAllMocks();
    expect(await fs.lister(DOCUMENTS, '')).toMatchObject([{ nom: 'Gala des Saules', type: 'dossier' }]);
  });
});

describe("fichiers web : ce que l'OPFS refuse", () => {
  test("une entrée d'un autre genre que celui demandé : lire ou lister lèvent ABSENT, écrire ECRITURE TypeMismatchError, qui nomme le dossier affichable de l'entrée", async () => {
    const fs = await preparer();
    await fs.ecrireAtomique(DOCUMENTS, 'note.txt', 'note');
    await fs.creerDossier(DOCUMENTS, 'corbeille');
    const refus = (chemin, dossier) => ({ chemin, dossier, cause: 'TypeMismatchError' });

    // Un dossier là où un fichier est attendu, et la racine elle-même.
    await echoue(fs.lireTexte(DOCUMENTS, 'corbeille'), 'ABSENT', { chemin: 'corbeille' });
    await echoue(fs.lireTexte(DOCUMENTS, ''), 'ABSENT', { chemin: '' });
    await echoue(fs.ecrireAtomique(DOCUMENTS, 'corbeille', 'x'), 'ECRITURE', refus('corbeille', CHEMIN_DOCUMENTS));
    await echoue(fs.ecrireAtomique(DOCUMENTS, '', 'x'), 'ECRITURE', refus('', CHEMIN_DOCUMENTS));
    await echoue(fs.ajouterLigne(DOCUMENTS, 'corbeille', 'x'), 'ECRITURE', refus('corbeille', CHEMIN_DOCUMENTS));
    await echoue(fs.ajouterLigne(DOCUMENTS, '', 'x'), 'ECRITURE', refus('', CHEMIN_DOCUMENTS));
    await echoue(fs.supprimer(DOCUMENTS, 'corbeille'), 'ECRITURE', refus('corbeille', CHEMIN_DOCUMENTS));
    await echoue(fs.supprimer(DOCUMENTS, ''), 'ECRITURE', refus('', CHEMIN_DOCUMENTS));
    await echoue(fs.supprimerDossier(DOCUMENTS, ''), 'CHEMIN_REFUSE', { chemin: '' });
    await echoue(fs.deplacer(DOCUMENTS, 'corbeille', 'ailleurs'), 'ECRITURE', refus('corbeille', CHEMIN_DOCUMENTS));
    await echoue(fs.deplacer(DOCUMENTS, '', 'ailleurs'), 'ECRITURE', refus('', CHEMIN_DOCUMENTS));
    await echoue(fs.deplacer(DOCUMENTS, 'note.txt', 'corbeille'), 'EXISTE', { chemin: 'corbeille' });
    await echoue(fs.deplacer(DOCUMENTS, 'note.txt', ''), 'EXISTE', { chemin: '' });

    // Un fichier là où un dossier est attendu.
    const sousNote = `${CHEMIN_DOCUMENTS}/note.txt`;
    await echoue(fs.lister(DOCUMENTS, 'note.txt'), 'ABSENT', { chemin: 'note.txt' });
    await echoue(fs.lireTexte(DOCUMENTS, 'note.txt/x.txt'), 'ABSENT', { chemin: 'note.txt/x.txt' });
    await echoue(fs.deplacer(DOCUMENTS, 'note.txt/x.txt', 'x.txt'), 'ABSENT', { chemin: 'note.txt/x.txt' });
    await echoue(fs.ecrireAtomique(DOCUMENTS, 'note.txt/x.txt', 'x'), 'ECRITURE', refus('note.txt/x.txt', sousNote));
    await echoue(fs.ajouterLigne(DOCUMENTS, 'note.txt/x.txt', 'x'), 'ECRITURE', refus('note.txt/x.txt', sousNote));
    await echoue(fs.creerDossier(DOCUMENTS, 'note.txt/sous'), 'ECRITURE', refus('note.txt/sous', sousNote));
    await echoue(fs.deplacer(DOCUMENTS, 'note.txt', 'note.txt/x.txt'), 'ECRITURE', refus('note.txt/x.txt', sousNote));
    await fs.supprimer(DOCUMENTS, 'note.txt/x.txt');
    await echoue(fs.supprimerDossier(DOCUMENTS, 'note.txt'), 'ECRITURE', refus('note.txt', CHEMIN_DOCUMENTS));
    await fs.supprimerDossier(DOCUMENTS, 'note.txt/sous');

    expect(await fs.lister(DOCUMENTS, '')).toMatchObject([
      { nom: 'corbeille', type: 'dossier' },
      { nom: 'note.txt', type: 'fichier' },
    ]);
    expect(await fs.lister(DOCUMENTS, 'corbeille')).toStrictEqual([]);
    expect(await fs.lireTexte(DOCUMENTS, 'note.txt')).toBe('note');
  });

  // Sous des paramètres régionaux qui ne sont pas UTF-8, Chromium résout un
  // nom de dossier hors ASCII sur le dossier qui le porte, sans lever. La
  // doublure rend ce dossier pour le nom « é » : aucun geste ne lit ni n'écrit
  // alors dans le dossier qui le porte, où un fichier de même nom attend.
  test("un dossier dont la poignée est celle du dossier qui le porte lève NOM_NON_CONVERTI, ECRITURE à l'écriture et LECTURE à la lecture, et le dossier qui le porte reste intact", async () => {
    const fs = await preparer();
    await fs.ecrireAtomique(DOCUMENTS, 'etat.json', 'parent');
    const poignee = FileSystemDirectoryHandle.prototype.getDirectoryHandle;
    vi.spyOn(FileSystemDirectoryHandle.prototype, 'getDirectoryHandle').mockImplementation(
      async function getDirectoryHandle(nom, options) {
        return nom === '\u{E9}' ? this : poignee.call(this, nom, options);
      },
    );
    const sous = `${CHEMIN_DOCUMENTS}/\u{E9}`;
    const refus = (chemin, dossier = sous) => ({ chemin, dossier, cause: 'NOM_NON_CONVERTI' });
    const enfant = '\u{E9}/etat.json';

    await echoue(fs.creerDossier(DOCUMENTS, '\u{E9}'), 'ECRITURE', refus('\u{E9}', CHEMIN_DOCUMENTS), 'creerDossier');
    await echoue(fs.creerDossier(DOCUMENTS, '\u{E9}/sous'), 'ECRITURE', refus('\u{E9}/sous'), 'creerDossier dessous');
    await echoue(fs.ecrireAtomique(DOCUMENTS, enfant, 'enfant'), 'ECRITURE', refus(enfant), 'ecrireAtomique');
    await echoue(fs.ajouterLigne(DOCUMENTS, enfant, 'enfant'), 'ECRITURE', refus(enfant), 'ajouterLigne');
    await echoue(fs.supprimer(DOCUMENTS, enfant), 'ECRITURE', refus(enfant), 'supprimer');
    await echoue(fs.deplacer(DOCUMENTS, enfant, 'copie.json'), 'ECRITURE', refus(enfant), 'deplacer depuis');
    await echoue(fs.deplacer(DOCUMENTS, 'etat.json', '\u{E9}/neuf.json'), 'ECRITURE', refus('\u{E9}/neuf.json'), 'deplacer vers');
    await echoue(fs.lireTexte(DOCUMENTS, enfant), 'LECTURE', refus(enfant), 'lireTexte');
    await echoue(fs.lireOctets(DOCUMENTS, enfant), 'LECTURE', refus(enfant), 'lireOctets');
    await echoue(fs.lister(DOCUMENTS, '\u{E9}'), 'LECTURE', refus('\u{E9}', CHEMIN_DOCUMENTS), 'lister');
    await echoue(fs.supprimerDossier(DOCUMENTS, '\u{E9}'), 'ECRITURE', refus('\u{E9}', CHEMIN_DOCUMENTS), 'supprimerDossier');
    vi.restoreAllMocks();
    expect(await fs.lister(DOCUMENTS, '')).toMatchObject([{ nom: 'etat.json', type: 'fichier' }]);
    expect(await fs.lireTexte(DOCUMENTS, 'etat.json')).toBe('parent');

    // Le dossier du produit se contrôle comme tout autre : une poignée qui
    // serait la racine de l'OPFS fait échouer la sonde, qui n'y écrit rien.
    vi.spyOn(FileSystemDirectoryHandle.prototype, 'getDirectoryHandle').mockImplementation(
      async function getDirectoryHandle(nom, options) {
        return nom === DOSSIER ? this : poignee.call(this, nom, options);
      },
    );
    expect(await fs.sonder(DOCUMENTS)).toStrictEqual({ inscriptible: false, cause: 'NOM_NON_CONVERTI' });
    await echoue(fs.lireTexte(DOCUMENTS, 'etat.json'), 'LECTURE', refus('etat.json', CHEMIN_DOCUMENTS), 'produit');
    vi.restoreAllMocks();
    expect(await nomsOpfs()).toStrictEqual([DOSSIER]);
  });

  // Sous les mêmes paramètres régionaux, un nom de fichier hors ASCII se
  // résout lui aussi sur le dossier qui le porte : getFileHandle lève
  // TypeMismatchError, et getDirectoryHandle rend ce dossier. La doublure
  // reproduit les deux pour le nom « ô.txt ». Le refus n'est alors ni une
  // absence ni une entrée d'un autre genre : un état présent ne se lit pas
  // ABSENT, une cible libre ne se dit pas EXISTE.
  test("un fichier que l'OPFS résout sur le dossier qui le porte lève NOM_NON_CONVERTI, LECTURE à la lecture et ECRITURE à l'écriture, jamais ABSENT ni EXISTE", async () => {
    const fs = await preparer();
    await fs.ecrireAtomique(DOCUMENTS, 'source.txt', 'source');
    const nom = '\u{F4}.txt';
    const fichier = FileSystemDirectoryHandle.prototype.getFileHandle;
    const dossier = FileSystemDirectoryHandle.prototype.getDirectoryHandle;
    vi.spyOn(FileSystemDirectoryHandle.prototype, 'getFileHandle').mockImplementation(
      async function getFileHandle(entree, options) {
        if (entree === nom) throw new DOMException(entree, 'TypeMismatchError');
        return fichier.call(this, entree, options);
      },
    );
    vi.spyOn(FileSystemDirectoryHandle.prototype, 'getDirectoryHandle').mockImplementation(
      async function getDirectoryHandle(entree, options) {
        return entree === nom ? this : dossier.call(this, entree, options);
      },
    );
    const refus = { chemin: nom, dossier: CHEMIN_DOCUMENTS, cause: 'NOM_NON_CONVERTI' };

    await echoue(fs.lireTexte(DOCUMENTS, nom), 'LECTURE', refus, 'lireTexte');
    await echoue(fs.lireOctets(DOCUMENTS, nom), 'LECTURE', refus, 'lireOctets');
    await echoue(fs.ecrireAtomique(DOCUMENTS, nom, 'x'), 'ECRITURE', refus, 'ecrireAtomique');
    await echoue(fs.ajouterLigne(DOCUMENTS, nom, 'x'), 'ECRITURE', refus, 'ajouterLigne');
    await echoue(fs.supprimer(DOCUMENTS, nom), 'ECRITURE', refus, 'supprimer');
    await echoue(fs.deplacer(DOCUMENTS, nom, 'copie.txt'), 'ECRITURE', refus, 'deplacer depuis');
    await echoue(fs.deplacer(DOCUMENTS, 'source.txt', nom), 'ECRITURE', refus, 'deplacer vers');
    await echoue(fs.supprimerDossier(DOCUMENTS, nom), 'ECRITURE', refus, 'supprimerDossier');

    // Un vrai dossier reste une entrée d'un autre genre : ABSENT à la lecture.
    await fs.creerDossier(DOCUMENTS, 'corbeille');
    await echoue(fs.lireTexte(DOCUMENTS, 'corbeille'), 'ABSENT', { chemin: 'corbeille' }, 'vrai dossier');
    vi.restoreAllMocks();
    expect(await fs.lister(DOCUMENTS, '')).toMatchObject([
      { nom: 'corbeille', type: 'dossier' },
      { nom: 'source.txt', type: 'fichier' },
    ]);
    expect(await fs.lireTexte(DOCUMENTS, 'source.txt')).toBe('source');
  });

  // Chaque panne frappe un temps de l'écriture par flux : son ouverture,
  // l'écriture, la fermeture qui porte le contenu sur la cible.
  const PANNES = [
    ['ouverture du flux', () => FileSystemFileHandle.prototype, 'createWritable', 'NoModificationAllowedError'],
    ["écriture dans le flux", () => FileSystemWritableFileStream.prototype, 'write', 'QuotaExceededError'],
    ['fermeture du flux', () => FileSystemWritableFileStream.prototype, 'close', 'InvalidStateError'],
  ];

  test("une panne de l'OPFS lève ECRITURE avec le nom de son exception, laisse la cible intacte et ne laisse aucun fichier neuf ni fichier d'échange", async () => {
    const fs = await preparer();
    await fs.ecrireAtomique(DOCUMENTS, 'etat.json', 'avant');
    await fs.ajouterLigne(DOCUMENTS, 'journal.jsonl', 'premiere');
    for (const [temps, prototype, methode, cause] of PANNES) {
      vi.spyOn(prototype(), methode).mockRejectedValue(new DOMException(temps, cause));
      const appels = [
        ['etat.json', () => fs.ecrireAtomique(DOCUMENTS, 'etat.json', 'apres')],
        ['neuf.json', () => fs.ecrireAtomique(DOCUMENTS, 'neuf.json', 'apres')],
        ['journal.jsonl', () => fs.ajouterLigne(DOCUMENTS, 'journal.jsonl', 'seconde')],
        ['neuf.jsonl', () => fs.ajouterLigne(DOCUMENTS, 'neuf.jsonl', 'seconde')],
      ];
      for (const [chemin, appel] of appels) {
        await echoue(appel(), 'ECRITURE', { chemin, dossier: CHEMIN_DOCUMENTS, cause }, `${temps} : ${chemin}`);
      }
      vi.restoreAllMocks();
      expect(await fs.lireTexte(DOCUMENTS, 'etat.json'), temps).toBe('avant');
      expect(await fs.lireTexte(DOCUMENTS, 'journal.jsonl'), temps).toBe('premiere\n');
      expect(noms(await fs.lister(DOCUMENTS, '')), temps).toStrictEqual(['etat.json', 'journal.jsonl']);
    }

    // Un rejet qui n'est pas une exception nommée donne son texte pour cause.
    vi.spyOn(FileSystemWritableFileStream.prototype, 'write').mockRejectedValueOnce('flux rompu');
    await echoue(fs.ecrireAtomique(DOCUMENTS, 'etat.json', 'apres'), 'ECRITURE', {
      chemin: 'etat.json',
      dossier: CHEMIN_DOCUMENTS,
      cause: 'flux rompu',
    });
    expect(await fs.lireTexte(DOCUMENTS, 'etat.json')).toBe('avant');
  });

  test("ecrireOctetsAtomique écrit les octets tels quels par un flux ; une panne de l'OPFS lève ECRITURE avec le nom de son exception, laisse la cible intacte et ne laisse aucun fichier neuf", async () => {
    const fs = await preparer();
    await fs.ecrireOctetsAtomique(DOCUMENTS, 'planche.pdf', new Uint8Array(40).fill(0x41));
    await fs.ecrireOctetsAtomique(DOCUMENTS, 'planche.pdf', BRUTS);
    expect(await octetsOpfs('planche.pdf')).toStrictEqual(BRUTS);
    for (const [temps, prototype, methode, cause] of PANNES) {
      vi.spyOn(prototype(), methode).mockRejectedValue(new DOMException(temps, cause));
      for (const chemin of ['planche.pdf', 'neuve.pdf']) {
        await echoue(
          fs.ecrireOctetsAtomique(DOCUMENTS, chemin, new Uint8Array([0x25, 0x50])),
          'ECRITURE',
          { chemin, dossier: CHEMIN_DOCUMENTS, cause },
          `${temps} : ${chemin}`,
        );
      }
      vi.restoreAllMocks();
      expect(await octetsOpfs('planche.pdf'), temps).toStrictEqual(BRUTS);
      expect(noms(await fs.lister(DOCUMENTS, '')), temps).toStrictEqual(['planche.pdf']);
    }
  });

  test('deplacer copie les octets de la source puis la retire ; un échec de la copie ou du retrait laisse la source seule', async () => {
    const fs = await preparer();
    await fs.creerDossier(DOCUMENTS, 'corbeille');
    await poserOpfs('source.csv', BRUTS);

    vi.spyOn(FileSystemWritableFileStream.prototype, 'write').mockRejectedValue(
      new DOMException('copie', 'QuotaExceededError'),
    );
    await echoue(fs.deplacer(DOCUMENTS, 'source.csv', 'corbeille/source.csv'), 'ECRITURE', {
      chemin: 'corbeille/source.csv',
      dossier: `${CHEMIN_DOCUMENTS}/corbeille`,
      cause: 'QuotaExceededError',
    });
    vi.restoreAllMocks();
    expect(await fs.lister(DOCUMENTS, 'corbeille')).toStrictEqual([]);
    expect(await octetsOpfs('source.csv')).toStrictEqual(BRUTS);

    vi.spyOn(FileSystemDirectoryHandle.prototype, 'removeEntry').mockRejectedValueOnce(
      new DOMException('retrait', 'NoModificationAllowedError'),
    );
    await echoue(fs.deplacer(DOCUMENTS, 'source.csv', 'corbeille/source.csv'), 'ECRITURE', {
      chemin: 'source.csv',
      dossier: CHEMIN_DOCUMENTS,
      cause: 'NoModificationAllowedError',
    });
    vi.restoreAllMocks();
    expect(await fs.lister(DOCUMENTS, 'corbeille')).toStrictEqual([]);
    expect(await octetsOpfs('source.csv')).toStrictEqual(BRUTS);

    await fs.deplacer(DOCUMENTS, 'source.csv', 'corbeille/source.csv');
    expect(await octetsOpfs('corbeille', 'source.csv')).toStrictEqual(BRUTS);
    expect(noms(await fs.lister(DOCUMENTS, ''))).toStrictEqual(['corbeille']);
  });

  // Une lecture tombe en panne à l'un de ses temps : l'OPFS, que le
  // navigateur refuse à l'origine ; la description d'un fichier ; ses octets,
  // quand il change pendant qu'on le lit.
  test("une lecture qui échoue autrement qu'en ne trouvant pas l'entrée lève LECTURE avec le nom de son exception, qui nomme le dossier affichable de l'entrée : une panne n'est pas une absence", async () => {
    const fs = await preparer();
    await fs.creerDossier(DOCUMENTS, 'corbeille');
    await fs.ecrireAtomique(DOCUMENTS, 'corbeille/etat.json', 'etat');
    const corbeille = `${CHEMIN_DOCUMENTS}/corbeille`;
    const lecture = (chemin, dossier, cause) => ({ chemin, dossier, cause });
    const etat = 'corbeille/etat.json';

    vi.spyOn(Blob.prototype, 'arrayBuffer').mockRejectedValueOnce(new DOMException('change', 'NotReadableError'));
    await echoue(fs.lireTexte(DOCUMENTS, etat), 'LECTURE', lecture(etat, corbeille, 'NotReadableError'), 'octets');
    vi.spyOn(Blob.prototype, 'arrayBuffer').mockRejectedValueOnce(new DOMException('change', 'NotReadableError'));
    await echoue(fs.lireOctets(DOCUMENTS, etat), 'LECTURE', lecture(etat, corbeille, 'NotReadableError'), 'lireOctets');
    vi.spyOn(FileSystemFileHandle.prototype, 'getFile').mockRejectedValueOnce(
      new DOMException('illisible', 'NotReadableError'),
    );
    await echoue(
      fs.lister(DOCUMENTS, 'corbeille'),
      'LECTURE',
      lecture('corbeille', CHEMIN_DOCUMENTS, 'NotReadableError'),
      'description',
    );

    // Un rejet qui n'est pas une exception nommée donne son texte pour cause.
    vi.spyOn(Blob.prototype, 'arrayBuffer').mockRejectedValueOnce('flux rompu');
    await echoue(fs.lireTexte(DOCUMENTS, etat), 'LECTURE', lecture(etat, corbeille, 'flux rompu'), 'rejet sans nom');

    vi.spyOn(StorageManager.prototype, 'getDirectory').mockRejectedValue(new DOMException('refus', 'SecurityError'));
    await echoue(fs.lireTexte(DOCUMENTS, etat), 'LECTURE', lecture(etat, corbeille, 'SecurityError'), 'lireTexte');
    await echoue(fs.lireOctets(DOCUMENTS, etat), 'LECTURE', lecture(etat, corbeille, 'SecurityError'), 'lireOctets');
    await echoue(fs.lister(DOCUMENTS, ''), 'LECTURE', lecture('', CHEMIN_DOCUMENTS, 'SecurityError'), 'lister');
    vi.restoreAllMocks();
    expect(await fs.lireTexte(DOCUMENTS, etat)).toBe('etat');
  });

  test("lister omet un fichier qui disparaît pendant la liste, prend la date d'un fichier dans l'OPFS et date un dossier de 0", async () => {
    const fs = await preparer();
    await fs.creerDossier(DOCUMENTS, 'corbeille');
    await fs.ecrireAtomique(DOCUMENTS, 'reste.txt', 'reste');
    await fs.ecrireAtomique(DOCUMENTS, 'fugace.txt', 'fugace');
    const modifie = (await (await (await dossierProduit()).getFileHandle('reste.txt')).getFile()).lastModified;

    const lire = FileSystemFileHandle.prototype.getFile;
    vi.spyOn(FileSystemFileHandle.prototype, 'getFile').mockImplementation(function getFile() {
      return this.name === 'fugace.txt' ? Promise.reject(new DOMException('disparu', 'NotFoundError')) : lire.call(this);
    });
    expect(await fs.lister(DOCUMENTS, '')).toStrictEqual([
      { nom: 'corbeille', type: 'dossier', taille: 0, modifie: 0 },
      { nom: 'reste.txt', type: 'fichier', taille: 5, modifie },
    ]);
  });

  test("sonder rend la cause que lève l'OPFS, ou RELECTURE_DIFFERENTE, sans lever, et ne laisse aucun témoin", async () => {
    const fs = creerFichiersWeb();
    vi.spyOn(StorageManager.prototype, 'getDirectory').mockRejectedValueOnce(new DOMException('refus', 'SecurityError'));
    expect(await fs.sonder(DOCUMENTS)).toStrictEqual({ inscriptible: false, cause: 'SecurityError' });
    expect(await nomsOpfs()).toStrictEqual([]);

    vi.spyOn(FileSystemFileHandle.prototype, 'createWritable').mockRejectedValueOnce(
      new DOMException('tenu', 'NoModificationAllowedError'),
    );
    expect(await fs.sonder(DOCUMENTS)).toStrictEqual({ inscriptible: false, cause: 'NoModificationAllowedError' });
    expect(await fs.lister(DOCUMENTS, '')).toStrictEqual([]);

    vi.spyOn(Blob.prototype, 'arrayBuffer').mockResolvedValueOnce(new TextEncoder().encode('autre').buffer);
    expect(await fs.sonder(DOCUMENTS)).toStrictEqual({ inscriptible: false, cause: 'RELECTURE_DIFFERENTE' });
    expect(await fs.lister(DOCUMENTS, '')).toStrictEqual([]);

    // Une relecture qui échoue suit l'écriture du témoin, que la sonde efface.
    vi.spyOn(Blob.prototype, 'arrayBuffer').mockRejectedValueOnce(new DOMException('illisible', 'NotReadableError'));
    expect(await fs.sonder(DOCUMENTS)).toStrictEqual({ inscriptible: false, cause: 'NotReadableError' });
    expect(await fs.lister(DOCUMENTS, '')).toStrictEqual([]);

    vi.restoreAllMocks();
    expect(await fs.sonder(DOCUMENTS)).toStrictEqual({ inscriptible: true, cause: null });
  });
});

// L'instant de prise qu'un verrou reçoit, de la forme qu'écrit l'horloge de
// l'application ; la plateforme ne l'écrit nulle part.
const PRISE = '2031-05-17T19:42:07-04:00';

describe('fichiers web : ni verrou, ni explorateur, ni dossier choisi (§ 8.8)', () => {
  test("verrouiller rend { pris: true } sans rien écrire, et deverrouiller n'efface aucun verrou", async () => {
    const fs = await preparer();
    expect(await fs.verrouiller(DOCUMENTS, 'soiree.gtt.verrou', 'seance-a', PRISE)).toStrictEqual({ pris: true });
    expect(await fs.verrouiller(DOCUMENTS, 'soiree.gtt.verrou', 'seance-a', PRISE)).toStrictEqual({ pris: true });
    expect(await fs.lister(DOCUMENTS, '')).toStrictEqual([]);

    // Un verrou venu d'un dossier de la coquille reste où il est.
    const verrou = '{"seance":"seance-b","pid":4321,"hote":"poste-voisin","depuis":"jamais"}\n';
    await fs.ecrireAtomique(DOCUMENTS, 'soiree.gtt.verrou', verrou);
    await fs.deverrouiller(DOCUMENTS, 'soiree.gtt.verrou', 'seance-b');
    expect(await fs.lireTexte(DOCUMENTS, 'soiree.gtt.verrou')).toBe(verrou);
    expect(await fs.verrouiller(DOCUMENTS, 'soiree.gtt.verrou', 'seance-c', PRISE)).toStrictEqual({ pris: true });
    expect(await fs.lireTexte(DOCUMENTS, 'soiree.gtt.verrou')).toBe(verrou);
  });

  test("ouvrirDansExplorateur et choisirDossier lèvent NON_DISPONIBLE {primitive} ; une racine inconnue lève d'abord CHEMIN_REFUSE", async () => {
    const fs = await preparer();
    await echoue(fs.ouvrirDansExplorateur(DOCUMENTS), 'NON_DISPONIBLE', { primitive: 'ouvrirDansExplorateur' });
    await fs.creerDossier(DOCUMENTS, 'Gala des Saules');
    await echoue(fs.ouvrirDansExplorateur(DOCUMENTS, 'Gala des Saules'), 'NON_DISPONIBLE', {
      primitive: 'ouvrirDansExplorateur',
    });
    await echoue(fs.ouvrirDansExplorateur(DOCUMENTS, '../x'), 'CHEMIN_REFUSE', { chemin: '../x' });
    await echoue(fs.choisirDossier(), 'NON_DISPONIBLE', { primitive: 'choisirDossier' });
    const inconnue = { id: 'portable', chemin: CHEMIN_DOCUMENTS };
    await echoue(fs.ouvrirDansExplorateur(inconnue), 'CHEMIN_REFUSE', { chemin: '' });
    await echoue(fs.typeSupport(inconnue), 'CHEMIN_REFUSE', { chemin: '' });
  });

  test("deux casses ou deux formes de normalisation d'un nom sont deux fichiers, et deplacer vers une autre casse ne trouve pas de cible existante", async () => {
    const fs = await preparer();
    await fs.ecrireAtomique(DOCUMENTS, 'casse.txt', 'minuscules');
    await fs.ecrireAtomique(DOCUMENTS, 'CASSE.txt', 'capitales');
    await fs.ecrireAtomique(DOCUMENTS, '\u{E9}.txt', 'NFC');
    await fs.ecrireAtomique(DOCUMENTS, 'e\u{301}.txt', 'NFD');
    expect(noms(await fs.lister(DOCUMENTS, ''))).toStrictEqual(['CASSE.txt', 'casse.txt', 'e\u{301}.txt', '\u{E9}.txt']);
    expect(await fs.lireTexte(DOCUMENTS, 'casse.txt')).toBe('minuscules');
    expect(await fs.lireTexte(DOCUMENTS, '\u{E9}.txt')).toBe('NFC');

    await fs.deplacer(DOCUMENTS, 'casse.txt', 'Casse.txt');
    expect(noms(await fs.lister(DOCUMENTS, ''))).toStrictEqual(['CASSE.txt', 'Casse.txt', 'e\u{301}.txt', '\u{E9}.txt']);
    expect(await fs.lireTexte(DOCUMENTS, 'Casse.txt')).toBe('minuscules');
    expect(await fs.lireTexte(DOCUMENTS, 'CASSE.txt')).toBe('capitales');
  });
});

describe('fichiers web : importer et enregistrer', () => {
  test('choisirFichierAImporter ouvre un champ de fichier unique, hors du document, et rend le nom et les octets choisis tels quels', async () => {
    const fs = creerFichiersWeb();
    const champs = [];
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function cliquer() {
      champs.push({ type: this.type, multiple: this.multiple, dansLeDocument: this.isConnected });
      const transfert = new DataTransfer();
      transfert.items.add(new File([BRUTS], 'invit\u{E9}s.csv'));
      this.files = transfert.files;
      this.dispatchEvent(new Event('change'));
    });
    const choisi = await fs.choisirFichierAImporter();
    expect(champs).toStrictEqual([{ type: 'file', multiple: false, dansLeDocument: false }]);
    expect(choisi).toStrictEqual({ nom: 'invit\u{E9}s.csv', octets: BRUTS });
  });

  test("choisirFichierAImporter rend null quand l'opérateur annule, ou que le champ revient sans fichier", async () => {
    const fs = creerFichiersWeb();
    const clic = vi.spyOn(HTMLInputElement.prototype, 'click');
    clic.mockImplementationOnce(function annuler() {
      this.dispatchEvent(new Event('cancel'));
    });
    expect(await fs.choisirFichierAImporter()).toBeNull();
    clic.mockImplementationOnce(function revenirVide() {
      this.dispatchEvent(new Event('change'));
    });
    expect(await fs.choisirFichierAImporter()).toBeNull();
  });

  test("sans genre, le champ n'accepte rien de particulier ; le genre image le restreint aux images par accept", async () => {
    const fs = creerFichiersWeb();
    const accepts = [];
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function annuler() {
      accepts.push(this.accept);
      this.dispatchEvent(new Event('cancel'));
    });
    expect(await fs.choisirFichierAImporter()).toBeNull();
    expect(await fs.choisirFichierAImporter({ genre: 'image' })).toBeNull();
    expect(accepts).toStrictEqual(['', 'image/*']);
  });

  test("le genre image lit la taille du fichier avant ses octets : au plafond, il le lit ; au-delà, TROP_VOLUMINEUX {chemin, dossier: null, taille, max} sans rien lire ; sans genre, aucun plafond", async () => {
    const fs = creerFichiersWeb();
    const lectures = vi.spyOn(Blob.prototype, 'arrayBuffer');
    const aServir = [
      new File([new Uint8Array(LOGO_SOURCE_MAX_OCTETS + 1)], 'trop-lourde.jpg'),
      new File([new Uint8Array(LOGO_SOURCE_MAX_OCTETS)], 'au-plafond.png'),
      new File([new Uint8Array(LOGO_SOURCE_MAX_OCTETS + 1)], 'sauvegarde.gtt.json'),
    ];
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function cliquer() {
      const transfert = new DataTransfer();
      transfert.items.add(aServir.shift());
      this.files = transfert.files;
      this.dispatchEvent(new Event('change'));
    });
    await echoue(fs.choisirFichierAImporter({ genre: 'image' }), 'TROP_VOLUMINEUX', {
      chemin: 'trop-lourde.jpg',
      dossier: null,
      taille: LOGO_SOURCE_MAX_OCTETS + 1,
      max: LOGO_SOURCE_MAX_OCTETS,
    });
    expect(lectures).not.toHaveBeenCalled();
    const auPlafond = await fs.choisirFichierAImporter({ genre: 'image' });
    expect([auPlafond.nom, auPlafond.octets.length]).toStrictEqual(['au-plafond.png', LOGO_SOURCE_MAX_OCTETS]);
    const sansGenre = await fs.choisirFichierAImporter();
    expect([sansGenre.nom, sansGenre.octets.length]).toStrictEqual(['sauvegarde.gtt.json', LOGO_SOURCE_MAX_OCTETS + 1]);
    expect(lectures).toHaveBeenCalledTimes(2);
  });

  test("un genre inconnu ou une option de forme fausse lève TypeError avant d'ouvrir le champ", async () => {
    const fs = creerFichiersWeb();
    const clic = vi.spyOn(HTMLInputElement.prototype, 'click');
    for (const options of [null, 'image', {}, { genre: 'csv' }, { genre: 'toString' }]) {
      await expect(fs.choisirFichierAImporter(options), JSON.stringify(options)).rejects.toThrow(TypeError);
    }
    expect(clic).not.toHaveBeenCalled();
  });

  test("un fichier choisi qui ne se lit pas lève LECTURE, ou ABSENT quand il a disparu, et se nomme par son seul nom : le navigateur tait son dossier", async () => {
    const fs = creerFichiersWeb();
    vi.spyOn(Blob.prototype, 'arrayBuffer')
      .mockRejectedValueOnce(new DOMException('change', 'NotReadableError'))
      .mockRejectedValueOnce(new DOMException('disparu', 'NotFoundError'));
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function cliquer() {
      const transfert = new DataTransfer();
      transfert.items.add(new File([BRUTS], 'invit\u{E9}s.csv'));
      this.files = transfert.files;
      this.dispatchEvent(new Event('change'));
    });
    await echoue(fs.choisirFichierAImporter(), 'LECTURE', {
      chemin: 'invit\u{E9}s.csv',
      dossier: null,
      cause: 'NotReadableError',
    });
    await echoue(fs.choisirFichierAImporter(), 'ABSENT', { chemin: 'invit\u{E9}s.csv' });
  });

  test("enregistrerSous remet au navigateur un lien de téléchargement des octets sous le nom proposé, rend ce nom, puis libère l'adresse", async () => {
    const fs = creerFichiersWeb();
    const creer = vi.spyOn(URL, 'createObjectURL');
    const liberer = vi.spyOn(URL, 'revokeObjectURL');
    const liens = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function cliquer() {
      liens.push({
        href: this.href,
        download: this.download,
        dansLeDocument: this.isConnected,
        liberee: liberer.mock.calls.length > 0,
      });
    });
    expect(await fs.enregistrerSous('invit\u{E9}s.csv', BRUTS)).toBe('invit\u{E9}s.csv');
    expect(creer).toHaveBeenCalledTimes(1);
    const [contenu] = creer.mock.calls[0];
    const adresse = creer.mock.results[0].value;
    expect(contenu).toBeInstanceOf(Blob);
    expect(contenu.type).toBe('application/octet-stream');
    expect(new Uint8Array(await contenu.arrayBuffer())).toStrictEqual(BRUTS);
    expect(liens).toStrictEqual([
      { href: adresse, download: 'invit\u{E9}s.csv', dansLeDocument: false, liberee: false },
    ]);
    await vi.waitFor(() => expect(liberer).toHaveBeenCalledWith(adresse));
    expect(liberer).toHaveBeenCalledTimes(1);
  });
});

describe('fichiers web : fautes de programmation', () => {
  test('un texte, une ligne, une séance, un nom ou des octets mal formés lèvent TypeError, sans rien écrire ni rien proposer', async () => {
    const fs = await preparer();
    const creer = vi.spyOn(URL, 'createObjectURL');
    const fautes = [
      () => fs.ecrireAtomique(DOCUMENTS, 'etat.json', 42),
      () => fs.ajouterLigne(DOCUMENTS, 'journal.jsonl', 42),
      () => fs.ajouterLigne(DOCUMENTS, 'journal.jsonl', 'deux\nlignes'),
      () => fs.ajouterLigne(DOCUMENTS, 'journal.jsonl', 'retour\rchariot'),
      () => fs.verrouiller(DOCUMENTS, 'soiree.gtt.verrou', '', PRISE),
      () => fs.verrouiller(DOCUMENTS, 'soiree.gtt.verrou', 'seance-a', '2031-05-17T19:42:07Z'),
      () => fs.deverrouiller(DOCUMENTS, 'soiree.gtt.verrou', null),
      () => fs.enregistrerSous('', BRUTS),
      () => fs.enregistrerSous('liste.csv', 'nom;prenom'),
      () => fs.ecrireOctetsAtomique(DOCUMENTS, 'planche.pdf', 'texte'),
      () => fs.ecrireOctetsAtomique(DOCUMENTS, 'planche.pdf', new ArrayBuffer(2)),
    ];
    for (const faute of fautes) await expect(faute(), String(faute)).rejects.toThrow(TypeError);
    expect(creer).not.toHaveBeenCalled();
    expect(await fs.lister(DOCUMENTS, '')).toStrictEqual([]);
  });
});
