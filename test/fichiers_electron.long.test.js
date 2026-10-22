// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le système de fichiers de la coquille sur un vrai disque (§ 8.6, § 8.8,
// § 14.4). La suite de contrat de test/contrat_fichiers.js s'y joue sur la
// page, src/stockage/fichiers_electron.js, derrière le vrai préchargement,
// devant les primitives d'electron/fichiers.js ; seul l'IPC d'Electron est
// remplacé, et ses arguments et réponses y sont copiés comme il les copie.
// Suivent la sonde d'écriture, qui ne s'éprouve utilement que contre un vrai
// système de fichiers, un dossier en lecture seule, un lien qui sort de la
// racine, un dossier voisin dont le nom prolonge celui de la racine, le
// renommage qui remplace la cible, le verrou d'un processus vivant ou
// terminé, sous Linux celui d'un pid vivant dont le démarrage n'est pas
// celui qu'il inscrit, et le démarrage que ps écrit en temps universel quel
// que soit le fuseau du processus qui le lit. Chaque épreuve écrit sous ses
// propres dossiers temporaires, retirés à sa fin, qu'elle passe ou non.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileFunction } from 'node:vm';
import { TEMOIN, creerFichiers, decrireSysteme, servir } from '../electron/fichiers.js';
import { ErreurStockage } from '../src/stockage/erreurs.js';
import { creerFichiersElectron } from '../src/stockage/fichiers_electron.js';
import { eprouverContrat } from './contrat_fichiers.js';
import { describe, test } from './lanceur.js';

const PRECHARGEMENT = fileURLToPath(new URL('../electron/preload.cjs', import.meta.url));
const NOM_PRODUIT = 'Gestion table tournante Libre';

// Sous Windows, un dossier ne passe pas en lecture seule par ses droits, et
// un lien symbolique demande un privilège : un lien de dossier s'y pose en
// jonction. Sous root, les droits d'un dossier n'arrêtent aucune écriture.
// L'instant de prise qu'un verrou reçoit, de la forme qu'écrit l'horloge de
// l'application.
const PRISE = '2026-10-06T19:00:00-04:00';

const SOUS_WINDOWS = process.platform === 'win32';
const SOUS_LINUX = process.platform === 'linux';
const SOUS_ROOT = typeof process.getuid === 'function' && process.getuid() === 0;

// Dossiers temporaires de l'épreuve en cours.
const ouverts = [];

function dossierTemporaire() {
  const dossier = mkdtempSync(join(tmpdir(), 'gtt-fichiers-'));
  ouverts.push(dossier);
  return dossier;
}

// test du lanceur, dont chaque épreuve retire à sa fin les dossiers
// temporaires qu'elle a ouverts ; le corps reçoit le contexte de l'épreuve.
function testNettoye(nom, ...suite) {
  const corps = suite.pop();
  test(nom, ...suite, async (contexte) => {
    try {
      await corps(contexte);
    } finally {
      for (const dossier of ouverts.splice(0)) rmSync(dossier, { recursive: true, force: true });
    }
  });
}

// Ce que dit une commande lancée par spawnSync : l'exception qui l'a
// empêchée de démarrer, sinon sa sortie d'erreur. Toujours une chaîne,
// seul message que node:assert accepte.
const ditPar = (lancee) => String(lancee.error?.message ?? lancee.stderr ?? '');

// Charge electron/preload.cjs comme un rendu en bac à sable, contre un
// electron dont invoke porte chaque appel au gestionnaire que servir a posé
// sur ce canal ; arguments et réponse sont copiés comme l'IPC les copie, et
// d'une erreur levée ne passe que le message. Rend gtt.fichiers.
function parLePrechargement(fichiers) {
  const gestionnaires = new Map();
  servir(fichiers, (canal, gestionnaire) => gestionnaires.set(canal, gestionnaire));
  let gtt;
  const electron = {
    contextBridge: {
      exposeInMainWorld: (cle, api) => {
        assert.equal(cle, 'gtt');
        gtt = api;
      },
    },
    ipcRenderer: {
      async invoke(canal, ...parametres) {
        const gestionnaire = gestionnaires.get(canal);
        if (gestionnaire === undefined) throw new Error(`No handler registered for '${canal}'`);
        let reponse;
        try {
          reponse = await gestionnaire({ sender: null }, ...structuredClone(parametres));
        } catch (erreur) {
          throw new Error(`Error invoking remote method '${canal}': ${erreur}`);
        }
        return structuredClone(reponse);
      },
    },
  };
  const module = { exports: {} };
  const requerir = (nom) => {
    if (nom === 'electron') return electron;
    throw new Error(`module « ${nom} » indisponible dans un préchargement en bac à sable`);
  };
  compileFunction(readFileSync(PRECHARGEMENT, 'utf8'), ['require', 'module', 'exports'], {
    filename: PRECHARGEMENT,
  })(requerir, module, module.exports);
  return gtt.fichiers;
}

// Les dialogues et l'explorateur ne servent à aucune de ces épreuves.
const SANS_APPEL = new Proxy({}, {
  get: (_, nom) => () => assert.fail(`appel inattendu : ${String(nom)}`),
});

/**
 * Le système de la page sur un dossier temporaire neuf : les Documents du
 * poste y sont Documents/, et le dossier publié par le lanceur portable,
 * quand il est donné, y est relatif. Rend le système et le chemin de ses
 * racines sur le disque.
 */
function systemeSur(dossier, { publie = null } = {}) {
  const chemins = { appData: join(dossier, 'AppData'), temp: tmpdir(), documents: join(dossier, 'Documents') };
  const systeme = decrireSysteme({
    env: publie === null ? {} : { PORTABLE_EXECUTABLE_DIR: join(dossier, publie) },
    plateforme: process.platform,
    cheminSysteme: (nom) => chemins[nom],
    nomProduit: NOM_PRODUIT,
  });
  const fs = creerFichiersElectron(parLePrechargement(creerFichiers({ ...systeme, dialog: SANS_APPEL, shell: SANS_APPEL })));
  return { fs, ...systeme.racines };
}

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
async function echoue(promesse, code, details, message = code) {
  const erreur = await rejette(promesse, message);
  assert.ok(erreur instanceof ErreurStockage, `${message} : ${erreur}`);
  assert.equal(erreur.code, code, message);
  assert.deepEqual(erreur.details, details, message);
}

eprouverContrat(
  'electron, sur un vrai dossier',
  async () => {
    const { fs, documents } = systemeSur(dossierTemporaire());
    mkdirSync(documents, { recursive: true });
    return { fs, racine: (await fs.racines()).documents };
  },
  {
    describe,
    test: testNettoye,
    egal: (reel, attendu, message) => assert.deepEqual(reel, attendu, message),
    vrai: (valeur, message) => assert.ok(valeur, message),
    rejette,
  },
);

describe('coquille sur un vrai disque', () => {
  testNettoye("la sonde crée la racine et ses parents, efface un témoin resté, et ne laisse que les autres fichiers", async () => {
    const { fs, portable } = systemeSur(dossierTemporaire(), { publie: join('cle', 'soirees') });
    const racine = (await fs.racines()).portable;
    assert.equal(racine.chemin, portable);
    assert.deepEqual(await fs.sonder(racine), { inscriptible: true, cause: null });
    assert.deepEqual(readdirSync(portable), []);
    writeFileSync(join(portable, TEMOIN), 'resté d\u{2019}une séance précédente');
    writeFileSync(join(portable, 'garde.txt'), 'garde');
    assert.deepEqual(await fs.sonder(racine), { inscriptible: true, cause: null });
    assert.deepEqual(readdirSync(portable), ['garde.txt']);
  });

  testNettoye("creerDossier de '' crée la racine, parents compris ; sous une racine absente, un autre chemin lève ECRITURE, ENOENT, sans rien créer", async () => {
    const dossier = dossierTemporaire();
    const { fs, portable } = systemeSur(dossier, { publie: join('cle', 'soirees') });
    const racine = (await fs.racines()).portable;
    await echoue(fs.creerDossier(racine, 'corbeille/2026-01-02_03-04-05'), 'ECRITURE', {
      chemin: 'corbeille/2026-01-02_03-04-05',
      dossier: join(portable, 'corbeille'),
      cause: 'ENOENT',
    });
    assert.deepEqual(readdirSync(dossier), []);
    await fs.creerDossier(racine, '');
    assert.deepEqual(readdirSync(portable), []);
    await fs.creerDossier(racine, 'corbeille/2026-01-02_03-04-05');
    assert.deepEqual(readdirSync(join(portable, 'corbeille')), ['2026-01-02_03-04-05']);
  });

  testNettoye(
    "un dossier en lecture seule fait échouer la sonde sur EACCES, qu'elle doive y écrire ou y créer la racine",
    { skip: SOUS_ROOT || SOUS_WINDOWS },
    async () => {
      const { fs, documents, portable } = systemeSur(dossierTemporaire(), {
        publie: join('Documents', NOM_PRODUIT, 'data', 'cle'),
      });
      mkdirSync(documents, { recursive: true });
      chmodSync(documents, 0o555);
      try {
        const racines = await fs.racines();
        assert.deepEqual(await fs.sonder(racines.documents), { inscriptible: false, cause: 'EACCES' });
        assert.deepEqual(await fs.sonder(racines.portable), { inscriptible: false, cause: 'EACCES' });
        assert.ok(portable.startsWith(documents), portable);
        assert.deepEqual(readdirSync(documents), []);
      } finally {
        chmodSync(documents, 0o755);
      }
    },
  );

  testNettoye("un lien qui sort de la racine lève CHEMIN_REFUSE, et rien ne s'écrit, ne se lit ni ne s'efface au-dehors", async () => {
    const dossier = dossierTemporaire();
    const dehors = join(dossierTemporaire(), 'dehors');
    // Au-dehors, un fichier et un verrou de la séance qui appelle, que
    // deverrouiller effacerait.
    const verrou = `${JSON.stringify({ seance: 'seance-a', pid: 777, hote: 'poste-essai', depuis: '2026-10-06T19:02:11-04:00' })}\n`;
    mkdirSync(dehors);
    writeFileSync(join(dehors, 'secret.txt'), 'hors de la racine');
    writeFileSync(join(dehors, 'soiree.gtt.verrou'), verrou);
    const { fs, documents } = systemeSur(dossier);
    mkdirSync(documents, { recursive: true });
    writeFileSync(join(documents, 'ici.txt'), 'ici');
    symlinkSync(dehors, join(documents, 'lien'), SOUS_WINDOWS ? 'junction' : 'dir');
    const racine = (await fs.racines()).documents;
    await echoue(fs.lireTexte(racine, 'lien/secret.txt'), 'CHEMIN_REFUSE', { chemin: 'lien/secret.txt' });
    await echoue(fs.ecrireAtomique(racine, 'lien/neuf.txt', 'x'), 'CHEMIN_REFUSE', { chemin: 'lien/neuf.txt' });
    await echoue(fs.ajouterLigne(racine, 'lien/secret.txt', 'x'), 'CHEMIN_REFUSE', { chemin: 'lien/secret.txt' });
    await echoue(fs.lister(racine, 'lien'), 'CHEMIN_REFUSE', { chemin: 'lien' });
    await echoue(fs.deplacer(racine, 'ici.txt', 'lien/vole.txt'), 'CHEMIN_REFUSE', { chemin: 'lien/vole.txt' });
    await echoue(fs.verrouiller(racine, 'lien/neuf.gtt.verrou', 'seance-a', PRISE), 'CHEMIN_REFUSE', { chemin: 'lien/neuf.gtt.verrou' });
    await echoue(fs.deverrouiller(racine, 'lien/soiree.gtt.verrou', 'seance-a'), 'CHEMIN_REFUSE', { chemin: 'lien/soiree.gtt.verrou' });
    if (!SOUS_WINDOWS) {
      symlinkSync(join(dehors, 'secret.txt'), join(documents, 'secret.txt'));
      await echoue(fs.lireTexte(racine, 'secret.txt'), 'CHEMIN_REFUSE', { chemin: 'secret.txt' });
      await echoue(fs.ajouterLigne(racine, 'secret.txt', 'x'), 'CHEMIN_REFUSE', { chemin: 'secret.txt' });
    }
    assert.deepEqual(readdirSync(dehors).sort(), ['secret.txt', 'soiree.gtt.verrou']);
    assert.equal(readFileSync(join(dehors, 'secret.txt'), 'utf8'), 'hors de la racine');
    assert.equal(readFileSync(join(dehors, 'soiree.gtt.verrou'), 'utf8'), verrou);
    assert.equal(readFileSync(join(documents, 'ici.txt'), 'utf8'), 'ici');
  });

  testNettoye("un dossier voisin dont le nom prolonge celui de la racine est hors d'elle, et reste intact", async () => {
    const { fs, documents } = systemeSur(dossierTemporaire());
    const voisin = `${documents} (copie)`;
    mkdirSync(documents, { recursive: true });
    mkdirSync(voisin);
    writeFileSync(join(voisin, 'secret.txt'), 'dans le dossier voisin');
    writeFileSync(join(documents, 'ici.txt'), 'ici');
    symlinkSync(voisin, join(documents, 'voisin'), SOUS_WINDOWS ? 'junction' : 'dir');
    const racine = (await fs.racines()).documents;
    await echoue(fs.lireTexte(racine, 'voisin/secret.txt'), 'CHEMIN_REFUSE', { chemin: 'voisin/secret.txt' });
    await echoue(fs.ecrireAtomique(racine, 'voisin/neuf.txt', 'x'), 'CHEMIN_REFUSE', { chemin: 'voisin/neuf.txt' });
    await echoue(fs.deplacer(racine, 'ici.txt', 'voisin/vole.txt'), 'CHEMIN_REFUSE', { chemin: 'voisin/vole.txt' });
    assert.deepEqual(readdirSync(voisin), ['secret.txt']);
    assert.equal(readFileSync(join(voisin, 'secret.txt'), 'utf8'), 'dans le dossier voisin');
    assert.equal(readFileSync(join(documents, 'ici.txt'), 'utf8'), 'ici');
  });

  testNettoye("l'écriture atomique remplace la cible par un renommage : le nom passe à un autre fichier, sans résidu", async () => {
    const { fs, documents } = systemeSur(dossierTemporaire());
    mkdirSync(documents, { recursive: true });
    const racine = (await fs.racines()).documents;
    const cible = join(documents, 'soiree.gtt.json');
    writeFileSync(cible, 'ancien');
    const avant = statSync(cible).ino;
    await fs.ecrireAtomique(racine, 'soiree.gtt.json', 'nouveau');
    assert.equal(readFileSync(cible, 'utf8'), 'nouveau');
    assert.notEqual(statSync(cible).ino, avant);
    assert.deepEqual(readdirSync(documents), ['soiree.gtt.json']);
  });

  testNettoye("le verrou d'un processus vivant de ce poste se dit vivant, celui d'un processus terminé non", async () => {
    const { fs, documents } = systemeSur(dossierTemporaire());
    mkdirSync(documents, { recursive: true });
    const racine = (await fs.racines()).documents;
    assert.deepEqual(await fs.verrouiller(racine, 'soiree.gtt.verrou', 'seance-a', PRISE), { pris: true });
    const pose = JSON.parse(readFileSync(join(documents, 'soiree.gtt.verrou'), 'utf8'));
    assert.deepEqual([pose.pid, pose.hote], [process.pid, hostname()]);
    const tenu = await fs.verrouiller(racine, 'soiree.gtt.verrou', 'seance-b', PRISE);
    assert.deepEqual(tenu, { pris: false, seance: 'seance-a', depuis: pose.depuis, vivant: true });

    const termine = spawnSync(process.execPath, ['-e', '']);
    assert.equal(termine.status, 0);
    const depuis = '2026-10-06T19:02:11-04:00';
    writeFileSync(
      join(documents, 'ancienne.gtt.verrou'),
      `${JSON.stringify({ seance: 'seance-terminee', pid: termine.pid, hote: hostname(), depuis })}\n`,
    );
    assert.deepEqual(await fs.verrouiller(racine, 'ancienne.gtt.verrou', 'seance-b', PRISE), {
      pris: false,
      seance: 'seance-terminee',
      depuis,
      vivant: false,
    });
  });

  testNettoye(
    "sous Linux, le verrou inscrit le champ 22 de /proc/<pid>/stat ; un pid vivant d'un autre démarrage est une séance morte, et un verrou sans démarrage laisse vivant inconnu",
    { skip: !SOUS_LINUX },
    async () => {
      // Le démarrage d'un processus, lu ici sans passer par la coquille.
      const demarrageDe = (cible) => {
        const texte = readFileSync(`/proc/${cible}/stat`, 'utf8');
        return texte.slice(texte.lastIndexOf(')') + 1).trim().split(/\s+/)[19];
      };
      const { fs, documents } = systemeSur(dossierTemporaire());
      mkdirSync(documents, { recursive: true });
      const racine = (await fs.racines()).documents;
      await fs.verrouiller(racine, 'soiree.gtt.verrou', 'seance-a', PRISE);
      const pose = JSON.parse(readFileSync(join(documents, 'soiree.gtt.verrou'), 'utf8'));
      assert.deepEqual(Object.keys(pose), ['seance', 'pid', 'hote', 'depuis', 'demarrage']);
      assert.equal(pose.demarrage, demarrageDe(process.pid));

      // Le processus parent vit ; un verrou à son pid ne vit qu'avec son
      // démarrage, et sans démarrage inscrit, rien ne dit s'il vit encore.
      const parent = process.ppid;
      const depuis = '2026-10-06T19:02:11-04:00';
      for (const [nom, inscrit, vivant] of [
        ['son démarrage', { demarrage: demarrageDe(parent) }, true],
        ['son démarrage, une clé étrangère', { demarrage: demarrageDe(parent), inconnue: 1 }, true],
        ['un autre démarrage', { demarrage: `${demarrageDe(parent)}0` }, false],
        ['sans démarrage', {}, null],
      ]) {
        writeFileSync(
          join(documents, 'parent.gtt.verrou'),
          `${JSON.stringify({ seance: 'seance-p', pid: parent, hote: hostname(), depuis, ...inscrit })}\n`,
        );
        assert.deepEqual(
          await fs.verrouiller(racine, 'parent.gtt.verrou', 'seance-b', PRISE),
          { pris: false, seance: 'seance-p', depuis, vivant },
          nom,
        );
      }
    },
  );

  testNettoye(
    "la lecture par ps (macOS) passe TZ=UTC et LC_ALL=C à la commande : le démarrage inscrit est en temps universel, et un processus d'un autre fuseau lit la séance vivante",
    { skip: SOUS_WINDOWS },
    async (contexte) => {
      // L'épreuve joue macOS avec le ps de l'hôte. Sous Linux, la coquille
      // lit /proc et ne demande pas ps, qu'une image de système minimale ne
      // porte pas : sans lui, l'épreuve se saute et dit pourquoi.
      if (spawnSync('ps', ['-p', String(process.pid)]).error?.code === 'ENOENT') {
        contexte.skip("ps introuvable sur ce système : la lecture du démarrage par ps ne s'y éprouve pas");
        return;
      }
      const documents = join(dossierTemporaire(), 'Documents');
      mkdirSync(documents, { recursive: true });
      const fichiers = creerFichiers({
        emplacements: {},
        racines: { portable: null, documents },
        dialog: SANS_APPEL,
        shell: SANS_APPEL,
        plateforme: 'darwin',
      });
      assert.deepEqual(await fichiers.verrouiller({ id: 'documents' }, 'soiree.gtt.verrou', 'seance-a', PRISE), { pris: true });
      const pose = JSON.parse(readFileSync(join(documents, 'soiree.gtt.verrou'), 'utf8'));
      const enUtc = spawnSync('ps', ['-o', 'lstart=', '-p', String(process.pid)], {
        env: { ...process.env, LC_ALL: 'C', TZ: 'UTC' },
        encoding: 'utf8',
      });
      assert.equal(enUtc.status, 0, ditPar(enUtc));
      assert.equal(pose.demarrage, enUtc.stdout.trim());

      // Un second processus, dans un fuseau qui n'est pas celui de
      // l'épreuve, relit le verrou par la même coquille.
      const autre = Intl.DateTimeFormat().resolvedOptions().timeZone === 'Pacific/Kiritimati' ? 'Pacific/Pago_Pago' : 'Pacific/Kiritimati';
      const lecteur = [
        'const { creerFichiers } = await import(process.env.GTT_MODULE);',
        'const fichiers = creerFichiers({ emplacements: {}, racines: { portable: null, documents: process.env.GTT_DOCUMENTS }, dialog: {}, shell: {}, plateforme: "darwin" });',
        'const tenu = await fichiers.verrouiller({ id: "documents" }, "soiree.gtt.verrou", "seance-b", "2026-10-06T19:05:00-04:00");',
        'process.stdout.write(JSON.stringify({ fuseau: Intl.DateTimeFormat().resolvedOptions().timeZone, tenu }));',
      ].join('\n');
      const relu = spawnSync(process.execPath, ['--input-type=module', '-e', lecteur], {
        env: {
          ...process.env,
          TZ: autre,
          GTT_MODULE: new URL('../electron/fichiers.js', import.meta.url).href,
          GTT_DOCUMENTS: documents,
        },
        encoding: 'utf8',
      });
      assert.equal(relu.status, 0, ditPar(relu));
      assert.deepEqual(JSON.parse(relu.stdout), {
        fuseau: autre,
        tenu: { pris: false, seance: 'seance-a', depuis: pose.depuis, vivant: true },
      });
    },
  );
});
