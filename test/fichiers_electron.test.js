// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du système de fichiers de la coquille (§ 8.6, § 8.8, § 13.1),
// sous node et sans disque réel. electron/fichiers.js y reçoit un disque en
// mémoire qui répond comme node:fs/promises sous POSIX, liens symboliques
// compris, consigne chaque appel et refuse ceux qu'on lui désigne. Les
// dialogues, l'explorateur, le lanceur de commandes, l'horloge, les pauses
// entre deux renommages et le signal aux processus y sont injectés de même.
// Suivent la page, src/stockage/fichiers_electron.js, derrière le vrai
// préchargement, et les définitions que la coquille recopie de src/stockage
// faute de pouvoir les importer. La suite de contrat se joue sur un vrai
// dossier, dans test/fichiers_electron.long.test.js. Les noms d'épreuve sont
// inventés.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileFunction } from 'node:vm';
import {
  DELAI_SUPPORT_MS,
  PAUSE_INITIALE_MS,
  PAUSE_MAX_MS,
  PREFIXE_CANAL,
  PRIMITIVES,
  REESSAIS_PASSAGERS,
  RefusFichier,
  SUFFIXE_ECRITURE,
  TEMOIN,
  creerFichiers,
  decrireSysteme,
  processusVivant,
  repondre,
  segmentsAdmis,
  servir,
} from '../electron/fichiers.js';
import { ErreurStockage } from '../src/stockage/erreurs.js';
import { creerFichiersElectron } from '../src/stockage/fichiers_electron.js';
import { SUFFIXE_ECRITURE as SUFFIXE_DU_STOCKAGE } from '../src/stockage/noms.js';
import { exigerCheminRelatif } from '../src/stockage/systeme_fichiers.js';
import { describe, test } from './lanceur.js';

const PRECHARGEMENT = fileURLToPath(new URL('../electron/preload.cjs', import.meta.url));

// Le périphérique du disque en mémoire, majeur 8 et mineur 1 dans le codage
// de glibc, et la machine du processus d'épreuve.
const DEV_DISQUE = 0x801n;
const HOTE = 'poste-essai';
const PID = 4242;

// L'instant de prise qu'un verrou reçoit, de la forme qu'écrit l'horloge de
// l'application.
const PRISE = '2026-10-06T19:02:11-04:00';

// Les racines de l'épreuve, et ce que les échecs y nomment.
const DOCUMENTS = '/poste/exemple/Documents/Gestion table tournante Libre';
const PUBLIE = '/media/cle/soirees';
const DATA = `${PUBLIE}/data`;
const AILLEURS = '/poste/exemple/ailleurs';
const DOC = { id: 'documents', chemin: DOCUMENTS };
const PORTABLE = { id: 'portable', chemin: DATA };
const FENETRE = { fenetre: 'principale' };

const EMPLACEMENTS = Object.freeze({
  executable: PUBLIE,
  donneesApplicatives: Object.freeze(['/poste/exemple/.config', '/tmp']),
  insensibleCasse: false,
  separateur: '/',
});

// ---------------------------------------------------------------------------
// Le disque en mémoire

// Une erreur du système telle que node:fs la lève : un code, l'appel
// système, le chemin. La coquille ne traduit que celles-là.
function erreurSysteme(code, syscall, chemin) {
  return Object.assign(new Error(`${code}: ${syscall} '${chemin}'`), { code, syscall, path: chemin });
}

/**
 * Disque en mémoire, sous POSIX : dossiers, fichiers et liens symboliques à
 * cible absolue. fs porte les fonctions de node:fs/promises dont la coquille
 * se sert et lève les erreurs du système dans les mêmes cas — ENOENT,
 * ENOTDIR, EISDIR, EEXIST, ELOOP. Un lien se suit partout, sauf en dernier
 * segment de lstat, unlink, rename, mkdir sans recursive et d'une ouverture
 * exclusive (wx). mkdir sans recursive crée un seul dossier, son parent
 * présent ; avec, tous ceux qui manquent. Les noms que rend readdir sortent
 * dans l'ordre inverse de leur création : un tri omis se voit.
 *
 *   appels   chaque appel, « fonction chemin [drapeaux | cible] », les
 *            écritures d'une poignée comprises (write, sync, close)
 *   panne(fonction, code, { fois, chemin })  les fois prochains appels de
 *            cette fonction lèvent ce code, sur ce chemin seulement quand il
 *            est donné
 *   deposer, deposerDossier, deposerLien, contenu, existe  préparent et
 *            lisent le disque sans rien consigner
 */
function creerDisque() {
  const noeuds = new Map([['/', { type: 'dossier', octets: null, cible: null, modifie: 0, dev: DEV_DISQUE }]]);
  const appels = [];
  const pannes = [];
  let horloge = 0;

  const tic = () => {
    horloge += 1000;
    return horloge;
  };

  function appel(fonction, chemin, ...suite) {
    appels.push([fonction, chemin, ...suite].join(' '));
    const panne = pannes.find(
      (p) => p.fonction === fonction && p.fois > 0 && (p.chemin === undefined || p.chemin === chemin),
    );
    if (panne !== undefined) {
      panne.fois -= 1;
      throw erreurSysteme(panne.code, fonction, chemin);
    }
  }

  // Ce que désigne un chemin absolu : son chemin résolu et son nœud,
  // undefined quand le dernier segment manque. Les liens des segments
  // intermédiaires se suivent toujours, celui du dernier quand suivre est
  // vrai.
  function resoudre(chemin, suivre, syscall, profondeur = 0) {
    if (profondeur > 8) throw erreurSysteme('ELOOP', syscall, chemin);
    const segments = chemin.split('/').filter((segment) => segment !== '');
    let courant = '/';
    for (let i = 0; i < segments.length; i += 1) {
      const suivant = posix.join(courant, segments[i]);
      const noeud = noeuds.get(suivant);
      const dernier = i === segments.length - 1;
      if (noeud === undefined) {
        if (dernier) return { chemin: suivant, noeud: undefined };
        throw erreurSysteme('ENOENT', syscall, chemin);
      }
      if (noeud.type === 'lien' && (suivre || !dernier)) {
        return resoudre(posix.join(noeud.cible, ...segments.slice(i + 1)), suivre, syscall, profondeur + 1);
      }
      if (!dernier && noeud.type !== 'dossier') throw erreurSysteme('ENOTDIR', syscall, chemin);
      courant = suivant;
    }
    return { chemin: courant, noeud: noeuds.get(courant) };
  }

  function creer(chemin, type, champs = {}) {
    const parent = noeuds.get(posix.dirname(chemin));
    const noeud = { type, octets: null, cible: null, modifie: tic(), dev: parent?.dev ?? DEV_DISQUE, ...champs };
    noeuds.set(chemin, noeud);
    return noeud;
  }

  function statistiques(noeud, enGrandsEntiers = false) {
    return {
      isFile: () => noeud.type === 'fichier',
      isDirectory: () => noeud.type === 'dossier',
      isSymbolicLink: () => noeud.type === 'lien',
      size: noeud.type === 'fichier' ? noeud.octets.length : 4096,
      mtimeMs: noeud.modifie,
      dev: enGrandsEntiers ? noeud.dev : Number(noeud.dev),
    };
  }

  function poignee(chemin, noeud) {
    return {
      async writeFile(donnees) {
        appel('write', chemin);
        noeud.octets = Buffer.concat([noeud.octets, Buffer.from(donnees)]);
        noeud.modifie = tic();
      },
      async sync() {
        appel('sync', chemin);
      },
      async close() {
        appel('close', chemin);
      },
    };
  }

  const fs = {
    async lstat(chemin) {
      appel('lstat', chemin);
      const { noeud } = resoudre(chemin, false, 'lstat');
      if (noeud === undefined) throw erreurSysteme('ENOENT', 'lstat', chemin);
      return statistiques(noeud);
    },
    async stat(chemin, options) {
      appel('stat', chemin);
      const { noeud } = resoudre(chemin, true, 'stat');
      if (noeud === undefined) throw erreurSysteme('ENOENT', 'stat', chemin);
      return statistiques(noeud, options?.bigint === true);
    },
    async realpath(chemin) {
      appel('realpath', chemin);
      const resolu = resoudre(chemin, true, 'realpath');
      if (resolu.noeud === undefined) throw erreurSysteme('ENOENT', 'realpath', chemin);
      return resolu.chemin;
    },
    async readFile(chemin) {
      appel('readFile', chemin);
      const { noeud } = resoudre(chemin, true, 'open');
      if (noeud === undefined) throw erreurSysteme('ENOENT', 'open', chemin);
      if (noeud.type === 'dossier') throw erreurSysteme('EISDIR', 'read', chemin);
      return Buffer.from(noeud.octets);
    },
    // Les deux appels synchrones de la sortie de la coquille.
    readFileSync(chemin) {
      appel('readFileSync', chemin);
      const { noeud } = resoudre(chemin, true, 'open');
      if (noeud === undefined) throw erreurSysteme('ENOENT', 'open', chemin);
      if (noeud.type === 'dossier') throw erreurSysteme('EISDIR', 'read', chemin);
      return Buffer.from(noeud.octets);
    },
    unlinkSync(chemin) {
      appel('unlinkSync', chemin);
      const { chemin: resolu, noeud } = resoudre(chemin, false, 'unlink');
      if (noeud === undefined) throw erreurSysteme('ENOENT', 'unlink', chemin);
      if (noeud.type === 'dossier') throw erreurSysteme('EISDIR', 'unlink', chemin);
      noeuds.delete(resolu);
    },
    async open(chemin, drapeaux) {
      appel('open', chemin, drapeaux);
      const exclusif = drapeaux === 'wx';
      const resolu = resoudre(chemin, !exclusif, 'open');
      if (exclusif && resolu.noeud !== undefined) throw erreurSysteme('EEXIST', 'open', chemin);
      if (resolu.noeud?.type === 'dossier') throw erreurSysteme('EISDIR', 'open', chemin);
      let noeud = resolu.noeud;
      if (noeud === undefined) noeud = creer(resolu.chemin, 'fichier', { octets: Buffer.alloc(0) });
      else if (drapeaux === 'w') noeud.octets = Buffer.alloc(0);
      return poignee(chemin, noeud);
    },
    async rename(de, vers) {
      appel('rename', de, vers);
      const source = resoudre(de, false, 'rename');
      if (source.noeud === undefined) throw erreurSysteme('ENOENT', 'rename', de);
      const cible = resoudre(vers, false, 'rename');
      if (cible.noeud?.type === 'dossier') throw erreurSysteme('EISDIR', 'rename', vers);
      noeuds.delete(source.chemin);
      noeuds.set(cible.chemin, source.noeud);
    },
    async unlink(chemin) {
      appel('unlink', chemin);
      const { chemin: resolu, noeud } = resoudre(chemin, false, 'unlink');
      if (noeud === undefined) throw erreurSysteme('ENOENT', 'unlink', chemin);
      if (noeud.type === 'dossier') throw erreurSysteme('EISDIR', 'unlink', chemin);
      noeuds.delete(resolu);
    },
    async mkdir(chemin, options) {
      appel('mkdir', chemin);
      if (options === undefined) {
        const { chemin: resolu, noeud } = resoudre(chemin, false, 'mkdir');
        if (noeud !== undefined) throw erreurSysteme('EEXIST', 'mkdir', chemin);
        creer(resolu, 'dossier');
        return;
      }
      assert.deepEqual(options, { recursive: true }, 'mkdir aux options inconnues');
      const segments = chemin.split('/').filter((segment) => segment !== '');
      let courant = '/';
      for (let i = 0; i < segments.length; i += 1) {
        const resolu = resoudre(posix.join(courant, segments[i]), true, 'mkdir');
        if (resolu.noeud === undefined) creer(resolu.chemin, 'dossier');
        else if (resolu.noeud.type !== 'dossier') {
          throw erreurSysteme(i === segments.length - 1 ? 'EEXIST' : 'ENOTDIR', 'mkdir', chemin);
        }
        courant = resolu.chemin;
      }
    },
    async readdir(chemin) {
      appel('readdir', chemin);
      const { chemin: resolu, noeud } = resoudre(chemin, true, 'scandir');
      if (noeud === undefined) throw erreurSysteme('ENOENT', 'scandir', chemin);
      if (noeud.type !== 'dossier') throw erreurSysteme('ENOTDIR', 'scandir', chemin);
      return [...noeuds.keys()]
        .filter((cle) => cle !== '/' && posix.dirname(cle) === resolu)
        .map((cle) => posix.basename(cle))
        .reverse();
    },
  };

  // Crée les dossiers d'un chemin absolu qui manquent, sans rien consigner.
  function dossiers(chemin, champs) {
    let courant = '/';
    for (const segment of chemin.split('/').filter((s) => s !== '')) {
      courant = posix.join(courant, segment);
      if (!noeuds.has(courant)) creer(courant, 'dossier', champs);
    }
  }

  return {
    fs,
    appels,
    panne(fonction, code, { fois = Infinity, chemin } = {}) {
      pannes.push({ fonction, code, fois, chemin });
    },
    deposer(chemin, texte) {
      dossiers(posix.dirname(chemin));
      creer(chemin, 'fichier', { octets: Buffer.from(texte) });
    },
    deposerDossier(chemin, champs = {}) {
      dossiers(chemin, champs);
    },
    deposerLien(chemin, cible) {
      dossiers(posix.dirname(chemin));
      creer(chemin, 'lien', { cible });
    },
    // Le texte d'un fichier, liens suivis ; null pour un absent ou un dossier.
    contenu(chemin) {
      const { noeud } = resoudre(chemin, true, 'contenu');
      return noeud?.type === 'fichier' ? noeud.octets.toString('utf8') : null;
    },
    // Les octets d'un fichier, copiés en Uint8Array, liens suivis ; null pour
    // un absent ou un dossier.
    octets(chemin) {
      const { noeud } = resoudre(chemin, true, 'octets');
      return noeud?.type === 'fichier' ? new Uint8Array(noeud.octets) : null;
    },
    // Vrai quand le chemin désigne un nœud, liens des dossiers parents
    // suivis, celui du dernier segment non.
    existe(chemin) {
      try {
        return resoudre(chemin, false, 'existe').noeud !== undefined;
      } catch {
        return false;
      }
    },
    // Noms des entrées directes d'un dossier, triés.
    noms: (chemin) =>
      [...noeuds.keys()]
        .filter((cle) => cle !== '/' && posix.dirname(cle) === chemin)
        .map((cle) => posix.basename(cle))
        .sort(),
  };
}

// Appels qui écrivent, dans l'ordre : ouvertures, écritures, vidages,
// fermetures, renommages, effacements, créations de dossier.
const ECRITURES = /^(open|write|sync|close|rename|unlink|mkdir) /;
const ecritures = (disque) => disque.appels.filter((ligne) => ECRITURES.test(ligne));

// ---------------------------------------------------------------------------
// La coquille sur ce disque

// Un dialogue d'Electron dont chaque appel consigne sa méthode, sa fenêtre
// parente et ses options, puis rend la réponse suivante, ou une annulation.
function dialogueFactice(reponses = []) {
  const appels = [];
  return {
    appels,
    async showOpenDialog(parent, options) {
      appels.push({ methode: 'showOpenDialog', parent, options });
      return reponses.shift() ?? { canceled: true, filePaths: [] };
    },
    async showSaveDialog(parent, options) {
      appels.push({ methode: 'showSaveDialog', parent, options });
      return reponses.shift() ?? { canceled: true, filePath: '' };
    },
  };
}

/**
 * La coquille sur un disque en mémoire où la racine documents existe. Rend
 * le disque, les primitives, et ce que l'épreuve lit des injections : les
 * pauses demandées, les dossiers ouverts dans l'explorateur, les commandes
 * lancées, les pid signalés. demarrage, quand il est donné, remplace la
 * lecture de l'instant de démarrage d'un processus.
 */
function preparer({
  disque = creerDisque(),
  dialog = dialogueFactice(),
  ouvrir = async () => '',
  lancer = async () => '',
  signaler = () => {},
  demarrage,
  plateforme = 'linux',
  hote = HOTE,
  fs = disque.fs,
} = {}) {
  if (!disque.existe(DOCUMENTS)) disque.deposerDossier(DOCUMENTS);
  const pauses = [];
  const ouvertures = [];
  const commandes = [];
  const signaux = [];
  const fichiers = creerFichiers({
    emplacements: EMPLACEMENTS,
    racines: { portable: DATA, documents: DOCUMENTS },
    dialog,
    shell: {
      openPath: async (chemin) => {
        ouvertures.push(chemin);
        return ouvrir(chemin);
      },
    },
    fenetre: () => FENETRE,
    fs,
    chemins: posix,
    plateforme,
    lancer: async (commande, arguments_, options) => {
      commandes.push({ commande, arguments_, options });
      return lancer(commande, arguments_, options);
    },
    attendre: async (ms) => {
      pauses.push(ms);
    },
    signaler: (pid) => {
      signaux.push(pid);
      return signaler(pid);
    },
    demarrage,
    pid: PID,
    hote,
  });
  return { disque, fichiers, dialog, pauses, ouvertures, commandes, signaux };
}

/**
 * Une table de processus du poste : pid → instant de démarrage, null quand
 * la plateforme ne le donne pas. signaler lève ESRCH pour un pid absent de
 * la table ; demarrage rend l'instant de la table et consigne le pid lu.
 *
 * @param {Array<[number, string|null]>} entrees
 */
function tableDeProcessus(entrees) {
  const table = new Map(entrees);
  const lus = [];
  return {
    lus,
    signaler(pid) {
      if (!table.has(pid)) throw erreurSysteme('ESRCH', 'kill', '');
    },
    async demarrage(pid) {
      lus.push(pid);
      return table.has(pid) ? table.get(pid) : null;
    },
  };
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

// Attend un refus de la coquille, de ce code et de ces détails exactement.
async function refuse(promesse, code, details, message = code) {
  const erreur = await rejette(promesse, message);
  assert.ok(erreur instanceof RefusFichier, `${message} : ${erreur}`);
  assert.equal(erreur.code, code, message);
  assert.deepEqual(erreur.details, details, message);
  return erreur;
}

const ecriture = (chemin, dossier, cause) => ({ chemin, dossier, cause });

// Les primitives qui reçoivent un chemin, chacune appelée avec le chemin
// donné à la place qu'elle éprouve. deplacer s'éprouve par sa source, vers
// libre.txt, puis par sa cible, depuis ici.txt : l'épreuve pose ici.txt et
// laisse libre.txt absent, si bien que seul le chemin éprouvé peut faire
// échouer l'appel.
const APPELS_A_CHEMIN = [
  ['lireTexte', (fichiers, racine, chemin) => fichiers.lireTexte(racine, chemin)],
  ['ecrireAtomique', (fichiers, racine, chemin) => fichiers.ecrireAtomique(racine, chemin, 'x')],
  ['ecrireOctetsAtomique', (fichiers, racine, chemin) => fichiers.ecrireOctetsAtomique(racine, chemin, new Uint8Array([0x25]))],
  ['ajouterLigne', (fichiers, racine, chemin) => fichiers.ajouterLigne(racine, chemin, 'x')],
  ['lister', (fichiers, racine, chemin) => fichiers.lister(racine, chemin)],
  ['creerDossier', (fichiers, racine, chemin) => fichiers.creerDossier(racine, chemin)],
  ['deplacer, source', (fichiers, racine, chemin) => fichiers.deplacer(racine, chemin, 'libre.txt')],
  ['deplacer, cible', (fichiers, racine, chemin) => fichiers.deplacer(racine, 'ici.txt', chemin)],
  ['supprimer', (fichiers, racine, chemin) => fichiers.supprimer(racine, chemin)],
  ['verrouiller', (fichiers, racine, chemin) => fichiers.verrouiller(racine, chemin, 'seance-a', PRISE)],
  ['deverrouiller', (fichiers, racine, chemin) => fichiers.deverrouiller(racine, chemin, 'seance-a')],
];

// ---------------------------------------------------------------------------

describe('coquille, fichiers : écriture atomique (§ 8.8)', () => {
  const CIBLE = `${DOCUMENTS}/etat.json`;
  const TEMPORAIRE = `${CIBLE}${SUFFIXE_ECRITURE}`;

  test("écrit <chemin>.ecriture, le vide sur le disque, le ferme, puis le renomme par-dessus la cible, qui n'est jamais ouverte", async () => {
    const { disque, fichiers, pauses } = preparer();
    disque.deposer(CIBLE, 'ancien \u{E9}tat');
    await fichiers.ecrireAtomique(DOC, 'etat.json', 'nouvel \u{E9}tat\n');
    assert.equal(disque.contenu(CIBLE), 'nouvel \u{E9}tat\n');
    assert.equal(disque.existe(TEMPORAIRE), false);
    assert.deepEqual(
      ecritures(disque).filter((ligne) => !ligne.startsWith('unlink ')),
      [
        `open ${TEMPORAIRE} wx`,
        `write ${TEMPORAIRE}`,
        `sync ${TEMPORAIRE}`,
        `close ${TEMPORAIRE}`,
        `rename ${TEMPORAIRE} ${CIBLE}`,
      ],
    );
    assert.deepEqual(disque.appels.filter((ligne) => ligne.startsWith(`open ${CIBLE} `)), []);
    assert.deepEqual(pauses, []);
  });

  test('un renommage refusé deux fois puis accepté réussit, après des pauses de 50 puis 100 ms', async () => {
    const { disque, fichiers, pauses } = preparer();
    disque.deposer(CIBLE, 'ancien');
    disque.panne('rename', 'EBUSY', { fois: 2 });
    await fichiers.ecrireAtomique(DOC, 'etat.json', 'nouveau');
    assert.equal(disque.contenu(CIBLE), 'nouveau');
    assert.equal(disque.existe(TEMPORAIRE), false);
    assert.deepEqual(pauses, [50, 100]);
    assert.equal(disque.appels.filter((ligne) => ligne.startsWith('rename ')).length, 3);
  });

  test('EPERM, EBUSY et EACCES se réessaient dix fois : dix refus passent, onze lèvent ECRITURE {chemin, dossier, cause}, la cible intacte, le temporaire retiré', async () => {
    assert.equal(REESSAIS_PASSAGERS, 10);
    assert.deepEqual([PAUSE_INITIALE_MS, PAUSE_MAX_MS], [50, 500]);
    const PAUSES = [50, 100, 200, 400, 500, 500, 500, 500, 500, 500];
    for (const cause of ['EPERM', 'EBUSY', 'EACCES']) {
      const passe = preparer();
      passe.disque.deposer(CIBLE, 'ancien');
      passe.disque.panne('rename', cause, { fois: 10 });
      await passe.fichiers.ecrireAtomique(DOC, 'etat.json', 'nouveau');
      assert.equal(passe.disque.contenu(CIBLE), 'nouveau', cause);
      assert.deepEqual(passe.pauses, PAUSES, cause);

      const echoue = preparer();
      echoue.disque.deposer(CIBLE, 'ancien');
      echoue.disque.panne('rename', cause, { fois: 11 });
      await refuse(
        echoue.fichiers.ecrireAtomique(DOC, 'etat.json', 'nouveau'),
        'ECRITURE',
        ecriture('etat.json', DOCUMENTS, cause),
        cause,
      );
      assert.equal(echoue.disque.contenu(CIBLE), 'ancien', cause);
      assert.equal(echoue.disque.existe(TEMPORAIRE), false, cause);
      assert.deepEqual(echoue.pauses, PAUSES, cause);
      assert.equal(echoue.disque.appels.filter((ligne) => ligne.startsWith('rename ')).length, 11, cause);
    }
  });

  test('une autre cause de refus du renommage ne se réessaie pas', async () => {
    for (const cause of ['EXDEV', 'EROFS', 'ENOSPC']) {
      const { disque, fichiers, pauses } = preparer();
      disque.deposer(CIBLE, 'ancien');
      disque.panne('rename', cause, { fois: 1 });
      await refuse(fichiers.ecrireAtomique(DOC, 'etat.json', 'nouveau'), 'ECRITURE', ecriture('etat.json', DOCUMENTS, cause), cause);
      assert.deepEqual(pauses, [], cause);
      assert.equal(disque.appels.filter((ligne) => ligne.startsWith('rename ')).length, 1, cause);
      assert.equal(disque.contenu(CIBLE), 'ancien', cause);
      assert.equal(disque.existe(TEMPORAIRE), false, cause);
    }
  });

  test("un temporaire qui ne s'écrit, ne se vide ou ne se ferme pas est retiré sans renommage, et la cible reste intacte", async () => {
    for (const [fonction, cause] of [['open', 'EROFS'], ['write', 'ENOSPC'], ['sync', 'EIO'], ['close', 'EIO']]) {
      const { disque, fichiers } = preparer();
      disque.deposer(CIBLE, 'ancien');
      disque.panne(fonction, cause, { chemin: TEMPORAIRE });
      await refuse(fichiers.ecrireAtomique(DOC, 'etat.json', 'nouveau'), 'ECRITURE', ecriture('etat.json', DOCUMENTS, cause), fonction);
      assert.equal(disque.contenu(CIBLE), 'ancien', fonction);
      assert.equal(disque.existe(TEMPORAIRE), false, fonction);
      assert.deepEqual(disque.appels.filter((ligne) => ligne.startsWith('rename ')), [], fonction);
    }
  });

  test("un temporaire resté d'une écriture interrompue est remplacé, et un lien posé à sa place n'est pas suivi", async () => {
    const { disque, fichiers } = preparer();
    disque.deposer(TEMPORAIRE, 'reste d\u{2019}une panne');
    await fichiers.ecrireAtomique(DOC, 'etat.json', 'neuf');
    assert.equal(disque.contenu(CIBLE), 'neuf');

    disque.deposer(`${AILLEURS}/garde.json`, 'hors de la racine');
    disque.deposerLien(TEMPORAIRE, `${AILLEURS}/garde.json`);
    await fichiers.ecrireAtomique(DOC, 'etat.json', 'encore');
    assert.equal(disque.contenu(CIBLE), 'encore');
    assert.equal(disque.contenu(`${AILLEURS}/garde.json`), 'hors de la racine');
  });

  test("le dossier de la cible doit exister, et une cible qui est un dossier n'est pas remplacée", async () => {
    const { disque, fichiers } = preparer();
    await refuse(
      fichiers.ecrireAtomique(DOC, 'disparu/etat.json', 'x'),
      'ECRITURE',
      ecriture('disparu/etat.json', `${DOCUMENTS}/disparu`, 'ENOENT'),
    );
    assert.equal(disque.existe(`${DOCUMENTS}/disparu`), false);
    disque.deposerDossier(`${DOCUMENTS}/corbeille`);
    const avant = disque.appels.length;
    await refuse(fichiers.ecrireAtomique(DOC, 'corbeille', 'x'), 'ECRITURE', ecriture('corbeille', DOCUMENTS, 'EISDIR'));
    // Refusé avant d'écrire : aucun temporaire, aucun renommage, que Windows
    // réessaierait en vain.
    assert.deepEqual(ecritures({ appels: disque.appels.slice(avant) }), []);
    assert.deepEqual(disque.noms(`${DOCUMENTS}/corbeille`), []);
    assert.deepEqual(disque.noms(DOCUMENTS), ['corbeille']);
  });

  test("le texte doit être une chaîne : autre chose lève TypeError, sans toucher au disque", async () => {
    const { disque, fichiers } = preparer();
    await assert.rejects(fichiers.ecrireAtomique(DOC, 'etat.json', 42), TypeError);
    assert.deepEqual(disque.appels, []);
  });
});

describe('coquille, fichiers : écriture atomique des octets (§ 8.8)', () => {
  const CIBLE = `${DOCUMENTS}/planche.pdf`;
  const TEMPORAIRE = `${CIBLE}${SUFFIXE_ECRITURE}`;
  // L'en-tête d'un PDF, octets hors UTF-8 compris, et ceux d'une planche
  // précédente.
  const OCTETS = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a, 0x00, 0xff]);
  const ANCIENS = 'ancienne planche';

  test("écrit les octets tels quels dans <chemin>.ecriture, le vide sur le disque, le ferme, puis le renomme par-dessus la cible, qui n'est jamais ouverte", async () => {
    const { disque, fichiers, pauses } = preparer();
    disque.deposer(CIBLE, ANCIENS);
    await fichiers.ecrireOctetsAtomique(DOC, 'planche.pdf', OCTETS);
    assert.deepEqual(disque.octets(CIBLE), OCTETS);
    assert.equal(disque.existe(TEMPORAIRE), false);
    assert.deepEqual(
      ecritures(disque).filter((ligne) => !ligne.startsWith('unlink ')),
      [
        `open ${TEMPORAIRE} wx`,
        `write ${TEMPORAIRE}`,
        `sync ${TEMPORAIRE}`,
        `close ${TEMPORAIRE}`,
        `rename ${TEMPORAIRE} ${CIBLE}`,
      ],
    );
    assert.deepEqual(disque.appels.filter((ligne) => ligne.startsWith(`open ${CIBLE} `)), []);
    assert.deepEqual(pauses, []);
  });

  test('un renommage refusé sur une cause passagère se réessaie comme celui du texte : onze refus lèvent ECRITURE, la cible intacte, le temporaire retiré', async () => {
    const passe = preparer();
    passe.disque.deposer(CIBLE, ANCIENS);
    passe.disque.panne('rename', 'EBUSY', { fois: 2 });
    await passe.fichiers.ecrireOctetsAtomique(DOC, 'planche.pdf', OCTETS);
    assert.deepEqual(passe.disque.octets(CIBLE), OCTETS);
    assert.deepEqual(passe.pauses, [50, 100]);

    const echoue = preparer();
    echoue.disque.deposer(CIBLE, ANCIENS);
    echoue.disque.panne('rename', 'EBUSY', { fois: 11 });
    await refuse(echoue.fichiers.ecrireOctetsAtomique(DOC, 'planche.pdf', OCTETS), 'ECRITURE', ecriture('planche.pdf', DOCUMENTS, 'EBUSY'));
    assert.equal(echoue.disque.contenu(CIBLE), ANCIENS);
    assert.equal(echoue.disque.existe(TEMPORAIRE), false);
    assert.equal(echoue.disque.appels.filter((ligne) => ligne.startsWith('rename ')).length, 11);
  });

  test("un temporaire qui ne s'écrit, ne se vide ou ne se ferme pas est retiré sans renommage, et la cible reste intacte", async () => {
    for (const [fonction, cause] of [['open', 'EROFS'], ['write', 'ENOSPC'], ['sync', 'EIO'], ['close', 'EIO']]) {
      const { disque, fichiers } = preparer();
      disque.deposer(CIBLE, ANCIENS);
      disque.panne(fonction, cause, { chemin: TEMPORAIRE });
      await refuse(fichiers.ecrireOctetsAtomique(DOC, 'planche.pdf', OCTETS), 'ECRITURE', ecriture('planche.pdf', DOCUMENTS, cause), fonction);
      assert.equal(disque.contenu(CIBLE), ANCIENS, fonction);
      assert.equal(disque.existe(TEMPORAIRE), false, fonction);
      assert.deepEqual(disque.appels.filter((ligne) => ligne.startsWith('rename ')), [], fonction);
    }
  });

  test("le dossier de la cible doit exister, et une cible qui est un dossier n'est pas remplacée", async () => {
    const { disque, fichiers } = preparer();
    await refuse(
      fichiers.ecrireOctetsAtomique(DOC, 'disparu/planche.pdf', OCTETS),
      'ECRITURE',
      ecriture('disparu/planche.pdf', `${DOCUMENTS}/disparu`, 'ENOENT'),
    );
    assert.equal(disque.existe(`${DOCUMENTS}/disparu`), false);
    disque.deposerDossier(`${DOCUMENTS}/planches`);
    const avant = disque.appels.length;
    await refuse(fichiers.ecrireOctetsAtomique(DOC, 'planches', OCTETS), 'ECRITURE', ecriture('planches', DOCUMENTS, 'EISDIR'));
    assert.deepEqual(ecritures({ appels: disque.appels.slice(avant) }), []);
    assert.deepEqual(disque.noms(DOCUMENTS), ['planches']);
  });

  test("des octets d'une autre forme qu'un Uint8Array lèvent TypeError, sans toucher au disque", async () => {
    const { disque, fichiers } = preparer();
    for (const fautifs of ['%PDF', [0x25], new ArrayBuffer(1), null]) {
      await assert.rejects(fichiers.ecrireOctetsAtomique(DOC, 'planche.pdf', fautifs), TypeError, String(fautifs));
    }
    assert.deepEqual(disque.appels, []);
  });
});

describe("coquille, fichiers : l'ajout en fin", () => {
  const JOURNAL = `${DOCUMENTS}/soiree.gtt-journal.jsonl`;

  test('ouvre en ajout, écrit la ligne et sa fin de ligne, vide sur le disque et ferme ; crée le fichier absent', async () => {
    const { disque, fichiers } = preparer();
    await fichiers.ajouterLigne(DOC, 'soiree.gtt-journal.jsonl', '{"type":"journal"}');
    await fichiers.ajouterLigne(DOC, 'soiree.gtt-journal.jsonl', '{"revision":1}');
    assert.equal(disque.contenu(JOURNAL), '{"type":"journal"}\n{"revision":1}\n');
    assert.deepEqual(ecritures(disque).slice(0, 4), [`open ${JOURNAL} a`, `write ${JOURNAL}`, `sync ${JOURNAL}`, `close ${JOURNAL}`]);
  });

  test("refuse une ligne qui porte une fin de ligne, et un dossier absent lève ECRITURE sans le créer", async () => {
    const { disque, fichiers } = preparer();
    for (const ligne of ['a\nb', 'a\rb', 'fin\n', 42]) {
      await assert.rejects(fichiers.ajouterLigne(DOC, 'journal.jsonl', ligne), TypeError, String(ligne));
    }
    assert.deepEqual(disque.appels, []);
    await refuse(
      fichiers.ajouterLigne(DOC, 'disparu/journal.jsonl', 'x'),
      'ECRITURE',
      ecriture('disparu/journal.jsonl', `${DOCUMENTS}/disparu`, 'ENOENT'),
    );
    assert.equal(disque.existe(`${DOCUMENTS}/disparu`), false);
  });

  test("un ajout que le système refuse lève ECRITURE et ne retire pas le fichier", async () => {
    const { disque, fichiers } = preparer();
    disque.deposer(JOURNAL, '{"type":"journal"}\n');
    disque.panne('write', 'ENOSPC');
    await refuse(fichiers.ajouterLigne(DOC, 'soiree.gtt-journal.jsonl', 'x'), 'ECRITURE', ecriture('soiree.gtt-journal.jsonl', DOCUMENTS, 'ENOSPC'));
    assert.equal(disque.contenu(JOURNAL), '{"type":"journal"}\n');
    assert.ok(disque.appels.includes(`close ${JOURNAL}`), 'poignée non fermée');
  });
});

describe('coquille, fichiers : confinement aux racines', () => {
  test("un chemin absolu, remontant, sous Windows ou porteur d'un NUL lève CHEMIN_REFUSE {chemin} à chaque primitive qui prend un chemin, avant tout accès au disque", async () => {
    const { disque, fichiers } = preparer();
    for (const chemin of ['../x', '/etc/x', 'C:\\x', 'a\u{0}b', 'a/../../x', '..']) {
      for (const [primitive, appel] of APPELS_A_CHEMIN) {
        await refuse(appel(fichiers, DOC, chemin), 'CHEMIN_REFUSE', { chemin }, `${primitive} ${chemin}`);
      }
    }
    assert.deepEqual(disque.appels, []);
  });

  test("une racine inconnue, absente ou de forme fausse lève CHEMIN_REFUSE, même sous le chemin d'une racine connue", async () => {
    const { disque, fichiers } = preparer();
    for (const racine of [{ id: 'choisi-1', chemin: DOCUMENTS }, { id: 'constructor', chemin: DOCUMENTS }, null, 'documents', { chemin: DOCUMENTS }]) {
      await refuse(fichiers.lireTexte(racine, 'x.txt'), 'CHEMIN_REFUSE', { chemin: 'x.txt' }, JSON.stringify(racine));
      await refuse(fichiers.sonder(racine), 'CHEMIN_REFUSE', { chemin: '' }, JSON.stringify(racine));
      await refuse(fichiers.typeSupport(racine), 'CHEMIN_REFUSE', { chemin: '' }, JSON.stringify(racine));
      await refuse(fichiers.ouvrirDansExplorateur(racine), 'CHEMIN_REFUSE', { chemin: '' }, JSON.stringify(racine));
    }
    assert.deepEqual(disque.appels, []);
  });

  test("un lien symbolique qui sort de la racine ne fait pas sortir : dossier en chemin, fichier visé, lien sans cible", async () => {
    const { disque, fichiers } = preparer();
    // Au-dehors, un fichier et un verrou de la séance qui appelle, que
    // deverrouiller effacerait.
    const verrou = `${JSON.stringify({ seance: 'seance-a', pid: 777, hote: HOTE, depuis: '2026-10-06T19:02:11-04:00' })}\n`;
    disque.deposer(`${AILLEURS}/secret.txt`, 'hors de la racine');
    disque.deposer(`${AILLEURS}/soiree.gtt.verrou`, verrou);
    disque.deposerLien(`${DOCUMENTS}/dehors`, AILLEURS);
    disque.deposerLien(`${DOCUMENTS}/secret.txt`, `${AILLEURS}/secret.txt`);
    disque.deposerLien(`${DOCUMENTS}/fuite.jsonl`, `${AILLEURS}/neuf.jsonl`);
    disque.deposer(`${DOCUMENTS}/ici.txt`, 'ici');

    // Par le dossier lié : chaque primitive, sur un absent, sur un fichier,
    // sur le verrou ; et la liste du dossier lié lui-même.
    for (const chemin of ['dehors/neuf.txt', 'dehors/secret.txt', 'dehors/soiree.gtt.verrou']) {
      for (const [primitive, appel] of APPELS_A_CHEMIN) {
        await refuse(appel(fichiers, DOC, chemin), 'CHEMIN_REFUSE', { chemin }, `${primitive} ${chemin}`);
      }
    }
    await refuse(fichiers.lister(DOC, 'dehors'), 'CHEMIN_REFUSE', { chemin: 'dehors' });
    // Par un lien de fichier, et par un lien sans cible, que l'ouverture en
    // ajout suivrait pour créer sa cible au-dehors.
    await refuse(fichiers.lireTexte(DOC, 'secret.txt'), 'CHEMIN_REFUSE', { chemin: 'secret.txt' });
    await refuse(fichiers.ajouterLigne(DOC, 'secret.txt', 'x'), 'CHEMIN_REFUSE', { chemin: 'secret.txt' });
    await refuse(fichiers.ajouterLigne(DOC, 'fuite.jsonl', 'x'), 'CHEMIN_REFUSE', { chemin: 'fuite.jsonl' });
    await refuse(fichiers.deplacer(DOC, 'secret.txt', 'pris.txt'), 'CHEMIN_REFUSE', { chemin: 'secret.txt' });

    assert.deepEqual(ecritures(disque), []);
    assert.deepEqual(disque.noms(AILLEURS), ['secret.txt', 'soiree.gtt.verrou']);
    assert.equal(disque.contenu(`${AILLEURS}/secret.txt`), 'hors de la racine');
    assert.equal(disque.contenu(`${AILLEURS}/soiree.gtt.verrou`), verrou);
    assert.equal(disque.contenu(`${DOCUMENTS}/ici.txt`), 'ici');
  });

  test("un dossier voisin dont le nom prolonge celui de la racine est hors d'elle : les chemins réels se comparent segment par segment", async () => {
    const voisin = `${DOCUMENTS} (copie)`;
    const { disque, fichiers } = preparer();
    disque.deposer(`${voisin}/secret.txt`, 'dans le dossier voisin');
    disque.deposerLien(`${DOCUMENTS}/voisin`, voisin);
    disque.deposer(`${DOCUMENTS}/ici.txt`, 'ici');
    for (const chemin of ['voisin/secret.txt', 'voisin/neuf.txt']) {
      for (const [primitive, appel] of APPELS_A_CHEMIN) {
        await refuse(appel(fichiers, DOC, chemin), 'CHEMIN_REFUSE', { chemin }, `${primitive} ${chemin}`);
      }
    }
    await refuse(fichiers.lister(DOC, 'voisin'), 'CHEMIN_REFUSE', { chemin: 'voisin' });
    assert.deepEqual(ecritures(disque), []);
    assert.deepEqual(disque.noms(voisin), ['secret.txt']);
    assert.equal(disque.contenu(`${voisin}/secret.txt`), 'dans le dossier voisin');
    assert.equal(disque.contenu(`${DOCUMENTS}/ici.txt`), 'ici');
  });

  test("une racine qui finit par le séparateur, celle d'un volume, porte tout ce qu'il contient", async () => {
    // Sous Windows, la racine d'une clé choisie, E:\ ; sur ce disque, /.
    const dialog = dialogueFactice([{ canceled: false, filePaths: ['/'] }]);
    const { disque, fichiers } = preparer({ dialog });
    const volume = await fichiers.choisirDossier();
    assert.deepEqual(volume, { id: 'choisi-1', chemin: '/' });
    await fichiers.ecrireAtomique(volume, 'soiree.gtt.json', 'sur le volume');
    assert.equal(disque.contenu('/soiree.gtt.json'), 'sur le volume');
    assert.equal(await fichiers.lireTexte(volume, 'soiree.gtt.json'), 'sur le volume');
  });

  test("un lien qui reste sous la racine se suit", async () => {
    const { disque, fichiers } = preparer();
    disque.deposerDossier(`${DOCUMENTS}/vrai`);
    disque.deposerLien(`${DOCUMENTS}/alias`, `${DOCUMENTS}/vrai`);
    await fichiers.ecrireAtomique(DOC, 'alias/etat.json', 'par le lien');
    assert.equal(disque.contenu(`${DOCUMENTS}/vrai/etat.json`), 'par le lien');
    assert.equal(await fichiers.lireTexte(DOC, 'alias/etat.json'), 'par le lien');
  });

  test("la racine se résout par son identifiant, et un chemin réel se compare à celui de la racine, liens résolus des deux côtés", async () => {
    const disque = creerDisque();
    disque.deposerDossier('/volume/reel/Documents/Gestion table tournante Libre');
    disque.deposerLien('/poste/exemple/Documents', '/volume/reel/Documents');
    const { fichiers } = preparer({ disque });
    await fichiers.ecrireAtomique(DOC, 'etat.json', 'sous un lien de racine');
    assert.equal(disque.contenu('/volume/reel/Documents/Gestion table tournante Libre/etat.json'), 'sous un lien de racine');
  });
});

describe('coquille, fichiers : lecture, liste, dossiers, déplacement, suppression', () => {
  test("lireTexte rend le texte tel qu'écrit, marque d'ordre d'octets comprise ; ABSENT pour un absent, un dossier ou un parent fichier ; LECTURE pour un autre refus", async () => {
    const { disque, fichiers } = preparer();
    disque.deposer(`${DOCUMENTS}/bom.csv`, '\u{FEFF}nom;pr\u{E9}nom\r\n');
    assert.equal(await fichiers.lireTexte(DOC, 'bom.csv'), '\u{FEFF}nom;pr\u{E9}nom\r\n');
    disque.deposerDossier(`${DOCUMENTS}/corbeille`);
    for (const chemin of ['absent.gtt.json', 'corbeille', 'bom.csv/x']) {
      await refuse(fichiers.lireTexte(DOC, chemin), 'ABSENT', { chemin }, chemin);
    }
    disque.panne('readFile', 'EACCES');
    await refuse(fichiers.lireTexte(DOC, 'bom.csv'), 'LECTURE', { chemin: 'bom.csv', dossier: DOCUMENTS, cause: 'EACCES' });
  });

  test("lireTexte décode strictement : des octets hors UTF-8 lèvent LECTURE {chemin, dossier, cause: UTF8_INVALIDE, octets}, sans rien remplacer par U+FFFD ; octets est un Uint8Array, que l'IPC transporte, et le message n'en dit que le nombre", async () => {
    const { disque, fichiers } = preparer();
    // Un « è » enregistré en windows-1252, l'octet E8, au milieu d'un texte.
    const octets = new Uint8Array([0x7b, 0x22, 0x69, 0xe8, 0x22, 0x7d]);
    disque.deposer(`${DOCUMENTS}/archives/soiree.gtt.json`, octets);
    const refus = await refuse(fichiers.lireTexte(DOC, 'archives/soiree.gtt.json'), 'LECTURE', {
      chemin: 'archives/soiree.gtt.json',
      dossier: `${DOCUMENTS}/archives`,
      cause: 'UTF8_INVALIDE',
      octets,
    });
    assert.equal(Object.getPrototypeOf(refus.details.octets), Uint8Array.prototype);
    assert.equal(
      refus.message,
      `LECTURE {"chemin":"archives/soiree.gtt.json","dossier":"${DOCUMENTS}/archives","cause":"UTF8_INVALIDE","octets":"6 octets"}`,
    );
    // Une suite tronquée en fin de fichier n'est pas de l'UTF-8 non plus.
    disque.deposer(`${DOCUMENTS}/tronque.jsonl`, new Uint8Array([0x61, 0xc3]));
    await refuse(fichiers.lireTexte(DOC, 'tronque.jsonl'), 'LECTURE', {
      chemin: 'tronque.jsonl',
      dossier: DOCUMENTS,
      cause: 'UTF8_INVALIDE',
      octets: new Uint8Array([0x61, 0xc3]),
    });
  });

  test("lister trie par unités UTF-16, type les entrées, donne 0 octet à un dossier et passe un lien sans cible", async () => {
    const { disque, fichiers } = preparer();
    disque.deposer(`${DOCUMENTS}/b.txt`, 'bb');
    disque.deposerDossier(`${DOCUMENTS}/corbeille`);
    disque.deposer(`${DOCUMENTS}/\u{E9}.txt`, '\u{E9}');
    disque.deposer(`${DOCUMENTS}/Z.txt`, '\u{1D11E}');
    disque.deposer(`${DOCUMENTS}/a.txt`, '');
    disque.deposerLien(`${DOCUMENTS}/mort`, `${DOCUMENTS}/nulle-part`);
    disque.deposerLien(`${DOCUMENTS}/vers-b`, `${DOCUMENTS}/b.txt`);
    const entrees = await fichiers.lister(DOC, '');
    assert.deepEqual(
      entrees.map(({ nom, type, taille }) => ({ nom, type, taille })),
      [
        { nom: 'Z.txt', type: 'fichier', taille: 4 },
        { nom: 'a.txt', type: 'fichier', taille: 0 },
        { nom: 'b.txt', type: 'fichier', taille: 2 },
        { nom: 'corbeille', type: 'dossier', taille: 0 },
        { nom: 'vers-b', type: 'fichier', taille: 2 },
        { nom: '\u{E9}.txt', type: 'fichier', taille: 2 },
      ],
    );
    assert.ok(entrees.every((entree) => Number.isFinite(entree.modifie)), 'modifie');
  });

  test("lister d'un dossier absent ou d'un fichier lève ABSENT, et un autre refus LECTURE", async () => {
    const { disque, fichiers } = preparer();
    disque.deposer(`${DOCUMENTS}/fichier.txt`, 'x');
    await refuse(fichiers.lister(DOC, 'absent'), 'ABSENT', { chemin: 'absent' });
    await refuse(fichiers.lister(DOC, 'fichier.txt'), 'ABSENT', { chemin: 'fichier.txt' });
    disque.panne('readdir', 'EACCES');
    await refuse(fichiers.lister(DOC, ''), 'LECTURE', { chemin: '', dossier: DOCUMENTS, cause: 'EACCES' });
  });

  test("creerDossier crée les parents ; un fichier en travers lève ECRITURE", async () => {
    const { disque, fichiers } = preparer();
    await fichiers.creerDossier(DOC, 'corbeille/2026-01-02_03-04-05');
    await fichiers.creerDossier(DOC, 'corbeille');
    assert.deepEqual(disque.noms(`${DOCUMENTS}/corbeille`), ['2026-01-02_03-04-05']);
    disque.deposer(`${DOCUMENTS}/occupe`, 'x');
    await refuse(fichiers.creerDossier(DOC, 'occupe'), 'ECRITURE', ecriture('occupe', DOCUMENTS, 'EEXIST'));
    await refuse(fichiers.creerDossier(DOC, 'occupe/sous'), 'ECRITURE', ecriture('occupe/sous', `${DOCUMENTS}/occupe`, 'ENOTDIR'));
  });

  test("creerDossier de '' crée la racine, parents compris ; sous une racine absente, un autre chemin lève ECRITURE, ENOENT, sans rien créer", async () => {
    const { disque, fichiers } = preparer();
    await refuse(
      fichiers.creerDossier(PORTABLE, 'corbeille/2026-01-02_03-04-05'),
      'ECRITURE',
      ecriture('corbeille/2026-01-02_03-04-05', `${DATA}/corbeille`, 'ENOENT'),
    );
    assert.equal(disque.existe(PUBLIE), false);
    await fichiers.creerDossier(PORTABLE, '');
    assert.deepEqual(disque.noms(DATA), []);
    await fichiers.creerDossier(PORTABLE, 'corbeille/2026-01-02_03-04-05');
    assert.deepEqual(disque.noms(`${DATA}/corbeille`), ['2026-01-02_03-04-05']);
  });

  test("deplacer porte un fichier ; EXISTE pour une cible présente, ABSENT pour une source absente, ECRITURE pour un dossier, un dossier de cible absent ou un renommage refusé pour une cause durable, essayé une fois", async () => {
    const { disque, fichiers, pauses } = preparer();
    disque.deposer(`${DOCUMENTS}/soiree.gtt.json`, '\u{E9}tat');
    disque.deposerDossier(`${DOCUMENTS}/corbeille`);
    await fichiers.deplacer(DOC, 'soiree.gtt.json', 'corbeille/soiree.gtt.json');
    assert.equal(disque.contenu(`${DOCUMENTS}/corbeille/soiree.gtt.json`), '\u{E9}tat');
    assert.equal(disque.existe(`${DOCUMENTS}/soiree.gtt.json`), false);

    disque.deposer(`${DOCUMENTS}/source.txt`, 'source');
    disque.deposer(`${DOCUMENTS}/cible.txt`, 'cible');
    await refuse(fichiers.deplacer(DOC, 'source.txt', 'cible.txt'), 'EXISTE', { chemin: 'cible.txt' });
    await refuse(fichiers.deplacer(DOC, 'absent.txt', 'ailleurs.txt'), 'ABSENT', { chemin: 'absent.txt' });
    await refuse(fichiers.deplacer(DOC, 'corbeille', 'poubelle'), 'ECRITURE', ecriture('corbeille', DOCUMENTS, 'EISDIR'));
    await refuse(
      fichiers.deplacer(DOC, 'source.txt', 'disparu/source.txt'),
      'ECRITURE',
      ecriture('disparu/source.txt', `${DOCUMENTS}/disparu`, 'ENOENT'),
    );
    disque.panne('rename', 'EROFS');
    await refuse(fichiers.deplacer(DOC, 'source.txt', 'autre.txt'), 'ECRITURE', ecriture('source.txt', DOCUMENTS, 'EROFS'));
    assert.equal(disque.appels.filter((ligne) => ligne.startsWith(`rename ${DOCUMENTS}/source.txt`)).length, 1);
    assert.deepEqual(pauses, []);
    assert.equal(disque.contenu(`${DOCUMENTS}/source.txt`), 'source');
    assert.equal(disque.contenu(`${DOCUMENTS}/cible.txt`), 'cible');
  });

  test("supprimer retire un fichier ; un absent n'est pas une faute ; un dossier lève ECRITURE", async () => {
    const { disque, fichiers } = preparer();
    disque.deposer(`${DOCUMENTS}/retire.txt`, 'x');
    disque.deposerDossier(`${DOCUMENTS}/corbeille`);
    await fichiers.supprimer(DOC, 'retire.txt');
    await fichiers.supprimer(DOC, 'retire.txt');
    assert.deepEqual(disque.noms(DOCUMENTS), ['corbeille']);
    await refuse(fichiers.supprimer(DOC, 'corbeille'), 'ECRITURE', ecriture('corbeille', DOCUMENTS, 'EISDIR'));
    disque.deposer(`${DOCUMENTS}/tenu.txt`, 'x');
    disque.panne('unlink', 'EBUSY');
    await refuse(fichiers.supprimer(DOC, 'tenu.txt'), 'ECRITURE', ecriture('tenu.txt', DOCUMENTS, 'EBUSY'));
  });
});

describe('coquille, fichiers : réessais sur une cause passagère (§ 8.8)', () => {
  const JOURNAL = `${DOCUMENTS}/soiree.gtt-journal.jsonl`;
  const PAUSES = [50, 100, 200, 400, 500, 500, 500, 500, 500, 500];

  // Chaque primitive, l'appel système qu'un antivirus ou un agent de
  // synchronisation peut refuser sous Windows, le disque préparé, l'appel,
  // ce qu'il laisse quand il réussit, et quand il échoue.
  const CAS = [
    {
      primitive: 'ajouterLigne',
      fonction: 'open',
      chemin: JOURNAL,
      poser: (disque) => disque.deposer(JOURNAL, '{"type":"journal"}\n'),
      appeler: (fichiers) => fichiers.ajouterLigne(DOC, 'soiree.gtt-journal.jsonl', '{"revision":1}'),
      reussi: (disque) => assert.equal(disque.contenu(JOURNAL), '{"type":"journal"}\n{"revision":1}\n'),
      intact: (disque) => assert.equal(disque.contenu(JOURNAL), '{"type":"journal"}\n'),
      refus: ecriture('soiree.gtt-journal.jsonl', DOCUMENTS, null),
    },
    {
      primitive: 'deplacer',
      fonction: 'rename',
      chemin: `${DOCUMENTS}/soiree.gtt.json`,
      poser: (disque) => {
        disque.deposer(`${DOCUMENTS}/soiree.gtt.json`, '\u{E9}tat');
        disque.deposerDossier(`${DOCUMENTS}/corbeille`);
      },
      appeler: (fichiers) => fichiers.deplacer(DOC, 'soiree.gtt.json', 'corbeille/soiree.gtt.json'),
      reussi: (disque) => {
        assert.equal(disque.contenu(`${DOCUMENTS}/corbeille/soiree.gtt.json`), '\u{E9}tat');
        assert.equal(disque.existe(`${DOCUMENTS}/soiree.gtt.json`), false);
      },
      intact: (disque) => {
        assert.equal(disque.contenu(`${DOCUMENTS}/soiree.gtt.json`), '\u{E9}tat');
        assert.equal(disque.existe(`${DOCUMENTS}/corbeille/soiree.gtt.json`), false);
      },
      refus: ecriture('soiree.gtt.json', DOCUMENTS, null),
    },
    {
      primitive: 'supprimer',
      fonction: 'unlink',
      chemin: `${DOCUMENTS}/ancienne.gtt.json`,
      poser: (disque) => disque.deposer(`${DOCUMENTS}/ancienne.gtt.json`, 'x'),
      appeler: (fichiers) => fichiers.supprimer(DOC, 'ancienne.gtt.json'),
      reussi: (disque) => assert.equal(disque.existe(`${DOCUMENTS}/ancienne.gtt.json`), false),
      intact: (disque) => assert.equal(disque.contenu(`${DOCUMENTS}/ancienne.gtt.json`), 'x'),
      refus: ecriture('ancienne.gtt.json', DOCUMENTS, null),
    },
  ];
  const essais = (disque, { fonction, chemin }) =>
    disque.appels.filter((ligne) => ligne.startsWith(`${fonction} ${chemin}`)).length;

  for (const cas of CAS) {
    test(`${cas.primitive} : refusé deux fois sur une cause passagère puis accepté, réussit après des pauses de 50 puis 100 ms`, async () => {
      for (const cause of ['EPERM', 'EBUSY', 'EACCES']) {
        const { disque, fichiers, pauses } = preparer();
        cas.poser(disque);
        disque.panne(cas.fonction, cause, { fois: 2, chemin: cas.chemin });
        await cas.appeler(fichiers);
        cas.reussi(disque);
        assert.deepEqual(pauses, [50, 100], cause);
        assert.equal(essais(disque, cas), 3, cause);
      }
    });

    test(`${cas.primitive} : toujours refusé sur une cause passagère, lève ECRITURE au onzième essai, après les pauses du renommage, et ne touche à rien`, async () => {
      for (const cause of ['EPERM', 'EBUSY', 'EACCES']) {
        const { disque, fichiers, pauses } = preparer();
        cas.poser(disque);
        disque.panne(cas.fonction, cause, { chemin: cas.chemin });
        await refuse(cas.appeler(fichiers), 'ECRITURE', { ...cas.refus, cause }, cause);
        cas.intact(disque);
        assert.deepEqual(pauses, PAUSES, cause);
        assert.equal(essais(disque, cas), REESSAIS_PASSAGERS + 1, cause);
      }
    });

    test(`${cas.primitive} : une cause durable ne se réessaie pas`, async () => {
      for (const cause of ['EROFS', 'ENOSPC', 'EIO']) {
        const { disque, fichiers, pauses } = preparer();
        cas.poser(disque);
        disque.panne(cas.fonction, cause, { chemin: cas.chemin });
        await refuse(cas.appeler(fichiers), 'ECRITURE', { ...cas.refus, cause }, cause);
        cas.intact(disque);
        assert.deepEqual(pauses, [], cause);
        assert.equal(essais(disque, cas), 1, cause);
      }
    });
  }

  test("ajouterLigne ne réessaie que l'ouverture : une écriture refusée ne se répète pas, une ligne n'est jamais écrite deux fois", async () => {
    const { disque, fichiers, pauses } = preparer();
    disque.deposer(JOURNAL, '{"type":"journal"}\n');
    disque.panne('write', 'EBUSY', { chemin: JOURNAL });
    await refuse(fichiers.ajouterLigne(DOC, 'soiree.gtt-journal.jsonl', 'x'), 'ECRITURE', ecriture('soiree.gtt-journal.jsonl', DOCUMENTS, 'EBUSY'));
    assert.deepEqual(pauses, []);
    assert.equal(disque.appels.filter((ligne) => ligne.startsWith(`write ${JOURNAL}`)).length, 1);
  });

  test("supprimer : un fichier qui disparaît pendant les réessais est supprimé, sans faute", async () => {
    const CIBLE = `${DOCUMENTS}/ancienne.gtt.json`;
    const disque = creerDisque();
    // Le premier effacement retire le fichier mais répond EBUSY, comme un
    // effacement que le système ne fait qu'au dernier fichier fermé : le
    // réessai trouve ENOENT.
    let premier = true;
    const fs = {
      ...disque.fs,
      async unlink(chemin) {
        await disque.fs.unlink(chemin);
        if (premier && chemin === CIBLE) {
          premier = false;
          throw erreurSysteme('EBUSY', 'unlink', chemin);
        }
      },
    };
    const { fichiers, pauses } = preparer({ disque, fs });
    disque.deposer(CIBLE, 'x');
    await fichiers.supprimer(DOC, 'ancienne.gtt.json');
    assert.equal(disque.existe(CIBLE), false);
    assert.deepEqual(pauses, [50]);
    assert.equal(disque.appels.filter((ligne) => ligne.startsWith(`unlink ${CIBLE}`)).length, 2);
  });
});

describe('coquille, fichiers : le verrou (§ 8.8)', () => {
  const VERROU = `${DOCUMENTS}/soiree.gtt.verrou`;
  const deposerVerrou = (disque, contenu) => disque.deposer(VERROU, `${JSON.stringify(contenu)}\n`);

  test("se crée en exclusif, porte {seance, pid, hote, depuis, demarrage} et une fin de ligne ; depuis est l'instant reçu, tel quel", async () => {
    const processus = tableDeProcessus([[PID, '918273']]);
    const { disque, fichiers } = preparer(processus);
    const recu = '2026-10-07T04:32:11+05:30';
    assert.deepEqual(await fichiers.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-a', recu), { pris: true });
    assert.deepEqual(ecritures(disque).slice(0, 4), [`open ${VERROU} wx`, `write ${VERROU}`, `sync ${VERROU}`, `close ${VERROU}`]);
    const texte = disque.contenu(VERROU);
    assert.ok(texte.endsWith('}\n'), texte);
    const contenu = JSON.parse(texte);
    assert.deepEqual(Object.keys(contenu), ['seance', 'pid', 'hote', 'depuis', 'demarrage']);
    assert.deepEqual(contenu, { seance: 'seance-a', pid: PID, hote: HOTE, depuis: recu, demarrage: '918273' });
    assert.deepEqual(processus.lus, [PID]);
  });

  test("un instant de prise qui n'est pas une chaîne lève TypeError, sans rien lire ni créer", async () => {
    const { disque, fichiers } = preparer();
    for (const depuis of [undefined, null, 1_950_000_000_000, new Date(0)]) {
      await assert.rejects(fichiers.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-a', depuis), TypeError, String(depuis));
    }
    assert.deepEqual(disque.appels, []);
  });

  test("rendreVerrousTenus efface, d'un trait et sans attendre, chaque verrou pris et pas rendu qui porte encore sa séance ; un verrou repris, illisible ou absent reste tel", async () => {
    const { disque, fichiers } = preparer();
    const chemin = (nom) => `${DOCUMENTS}/${nom}`;
    for (const nom of ['garde.gtt.verrou', 'repris.gtt.verrou', 'illisible.gtt.verrou', 'parti.gtt.verrou', 'rendu.gtt.verrou']) {
      assert.deepEqual(await fichiers.verrouiller(DOC, nom, 'seance-a', PRISE), { pris: true }, nom);
    }
    await fichiers.deverrouiller(DOC, 'rendu.gtt.verrou', 'seance-a');
    const reprise = `${JSON.stringify({ seance: 'seance-b', pid: 777, hote: HOTE, depuis: PRISE, demarrage: null })}\n`;
    disque.deposer(chemin('repris.gtt.verrou'), reprise);
    disque.deposer(chemin('illisible.gtt.verrou'), '{"seance":');
    await fichiers.supprimer(DOC, 'parti.gtt.verrou');
    disque.deposer(chemin('rendu.gtt.verrou'), reprise.replace('seance-b', 'seance-a'));
    const avant = disque.appels.length;
    assert.equal(fichiers.rendreVerrousTenus(), undefined);
    assert.deepEqual(disque.appels.slice(avant), [
      `readFileSync ${chemin('garde.gtt.verrou')}`,
      `unlinkSync ${chemin('garde.gtt.verrou')}`,
      `readFileSync ${chemin('repris.gtt.verrou')}`,
      `readFileSync ${chemin('illisible.gtt.verrou')}`,
      `readFileSync ${chemin('parti.gtt.verrou')}`,
    ]);
    assert.equal(disque.existe(chemin('garde.gtt.verrou')), false);
    assert.equal(disque.contenu(chemin('repris.gtt.verrou')), reprise);
    assert.equal(disque.contenu(chemin('illisible.gtt.verrou')), '{"seance":');
    // Le verrou rendu par deverrouiller n'est plus tenu : un verrou de même
    // séance posé depuis à sa place reste.
    assert.notEqual(disque.contenu(chemin('rendu.gtt.verrou')), null);
    // Un second appel n'a plus rien à rendre.
    const apres = disque.appels.length;
    fichiers.rendreVerrousTenus();
    assert.deepEqual(disque.appels.slice(apres), []);
  });

  test("rendreVerrousTenus ne lève pas : une lecture ou un effacement refusés laissent le verrou, et les suivants se rendent", async () => {
    const { disque, fichiers } = preparer();
    const chemin = (nom) => `${DOCUMENTS}/${nom}`;
    for (const nom of ['a.gtt.verrou', 'b.gtt.verrou', 'c.gtt.verrou']) await fichiers.verrouiller(DOC, nom, 'seance-a', PRISE);
    disque.panne('readFileSync', 'EACCES', { chemin: chemin('a.gtt.verrou') });
    disque.panne('unlinkSync', 'EBUSY', { chemin: chemin('b.gtt.verrou') });
    fichiers.rendreVerrousTenus();
    assert.deepEqual(['a', 'b', 'c'].map((nom) => disque.existe(chemin(`${nom}.gtt.verrou`))), [true, true, false]);
  });

  test("un verrou présent rend sa séance : morte quand son pid ne répond pas ; sans démarrage inscrit, un pid qui répond, même sans droit de le signaler, laisse vivant inconnu", async () => {
    for (const [nom, signaler, vivant] of [
      ['répond', () => {}, null],
      ['EPERM', () => { throw erreurSysteme('EPERM', 'kill', ''); }, null],
      ['ESRCH', () => { throw erreurSysteme('ESRCH', 'kill', ''); }, false],
    ]) {
      const { disque, fichiers, signaux } = preparer({ signaler });
      deposerVerrou(disque, { seance: 'seance-a', pid: 777, hote: HOTE, depuis: '2026-10-06T19:02:11-04:00' });
      assert.deepEqual(
        await fichiers.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-b', PRISE),
        { pris: false, seance: 'seance-a', depuis: '2026-10-06T19:02:11-04:00', vivant },
        nom,
      );
      assert.deepEqual(signaux, [777], nom);
    }
  });

  test("sans instant de démarrage que la plateforme donne, le verrou porte demarrage à null ; un démarrage courant inconnu se relit à la prise suivante, un connu ne se relit pas", async () => {
    // Le démarrage du processus courant ne se lit pas la première fois.
    const reponses = [null, '918273'];
    const lus = [];
    const { disque, fichiers } = preparer({
      demarrage: async (cible) => {
        lus.push(cible);
        return reponses.length > 1 ? reponses.shift() : reponses[0];
      },
    });
    await fichiers.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-a', PRISE);
    assert.equal(JSON.parse(disque.contenu(VERROU)).demarrage, null);
    await fichiers.deverrouiller(DOC, 'soiree.gtt.verrou', 'seance-a');
    await fichiers.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-a', PRISE);
    assert.equal(JSON.parse(disque.contenu(VERROU)).demarrage, '918273');
    await fichiers.deverrouiller(DOC, 'soiree.gtt.verrou', 'seance-a');
    await fichiers.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-a', PRISE);
    assert.equal(JSON.parse(disque.contenu(VERROU)).demarrage, '918273');
    assert.deepEqual(lus, [PID, PID]);
  });

  test("vivant : faux seulement quand la mort est certaine — pid qui ne répond pas, ou deux démarrages connus et différents ; vrai pour deux démarrages connus et égaux ; inconnu (null) sinon", async () => {
    const DEPUIS = '2026-10-06T19:02:11-04:00';
    const tenu = (vivant) => ({ pris: false, seance: 'seance-a', depuis: DEPUIS, vivant });
    // Un démarrage inscrit inconnu ne demande pas celui du pid. Une clé
    // Une clé que le contenu d'un verrou ne définit pas ne compte pas.
    for (const [nom, demarrageLu, inscrit, vivant, lus] of [
      ['même démarrage', '5000', { demarrage: '5000' }, true, [PID, 777]],
      ['pid réattribué', '5000', { demarrage: '4000' }, false, [PID, 777]],
      ['démarrage inscrit inconnu', '5000', { demarrage: null }, null, [PID]],
      ['verrou sans démarrage', '5000', {}, null, [PID]],
      ['démarrage actuel inconnu', null, { demarrage: '4000' }, null, [PID, 777]],
      ['même démarrage, clé étrangère', '5000', { demarrage: '5000', inconnue: 1 }, true, [PID, 777]],
      ['démarrage actuel inconnu, clé étrangère', null, { demarrage: '4000', inconnue: 1 }, null, [PID, 777]],
    ]) {
      const processus = tableDeProcessus([[PID, '1'], [777, demarrageLu]]);
      const { disque, fichiers } = preparer(processus);
      deposerVerrou(disque, { seance: 'seance-a', pid: 777, hote: HOTE, depuis: DEPUIS, ...inscrit });
      assert.deepEqual(await fichiers.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-b', PRISE), tenu(vivant), nom);
      // Le démarrage du processus courant se lit avant la prise, celui du
      // pid inscrit une fois le verrou trouvé.
      assert.deepEqual(processus.lus, lus, nom);
    }
    // Un pid qui ne répond pas est mort, sans lecture de son démarrage ; celui
    // du processus courant, lu une fois, ne se relit pas.
    const processus = tableDeProcessus([[PID, '1']]);
    const { disque, fichiers } = preparer(processus);
    deposerVerrou(disque, { seance: 'seance-a', pid: 777, hote: HOTE, depuis: DEPUIS, demarrage: '5000' });
    assert.deepEqual(await fichiers.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-b', PRISE), tenu(false));
    assert.deepEqual(await fichiers.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-b', PRISE), tenu(false));
    assert.deepEqual(processus.lus, [PID]);
  });

  test("un démarrage inscrit qui n'est ni une chaîne ni null rend le verrou illisible", async () => {
    const { disque, fichiers } = preparer(tableDeProcessus([[777, '5000']]));
    for (const inscrit of [{ demarrage: 5000 }, { demarrage: true }, { demarrage: {} }]) {
      deposerVerrou(disque, { seance: 'seance-a', pid: 777, hote: HOTE, depuis: 'x', ...inscrit });
      assert.deepEqual(
        await fichiers.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-b', PRISE),
        { pris: false, seance: null, depuis: null, vivant: null },
        JSON.stringify(inscrit),
      );
    }
  });

  test("sous Linux, le démarrage est le champ 22 de /proc/<pid>/stat, compté après la parenthèse fermante du nom ; un fichier absent ou de forme fausse le rend inconnu, et vivant avec lui", async () => {
    // Champs 3 à 22 : l'état, puis dix-huit nombres, le dernier étant le
    // démarrage ; le nom porte une espace et une parenthèse fermante.
    const stat = (pid, debut) => `${pid} (nom ) bizarre) S ${Array.from({ length: 18 }, (_, i) => i + 1).join(' ')} ${debut} 99 0\n`;
    const disque = creerDisque();
    disque.deposer(`/proc/${PID}/stat`, stat(PID, 31337));
    disque.deposer('/proc/777/stat', stat(777, 5000));
    disque.deposer('/proc/778/stat', stat(778, 4000));
    disque.deposer('/proc/779/stat', '779 (court) S 1 2 3\n');
    disque.deposer('/proc/780/stat', stat(780, 'x'));
    // Sans parenthèse fermante, aucun champ ne se compte, même quand la
    // ligne en porte assez.
    disque.deposer('/proc/782/stat', stat(782, 5000).replace(/[()]/g, ''));
    const { fichiers } = preparer({ disque, signaler: () => {} });
    await fichiers.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-a', PRISE);
    assert.equal(JSON.parse(disque.contenu(VERROU)).demarrage, '31337');
    for (const [pid, vivant] of [[777, true], [778, false], [779, null], [780, null], [781, null], [782, null]]) {
      deposerVerrou(disque, { seance: 'seance-x', pid, hote: HOTE, depuis: 'x', demarrage: '5000' });
      assert.equal((await fichiers.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-b', PRISE)).vivant, vivant, String(pid));
    }
  });

  test("sous Windows, le démarrage est l'heure de création que rend PowerShell, le pid passé par l'environnement, borné à cinq secondes ; un échec le rend inconnu, et vivant avec lui", async () => {
    const reponses = new Map([['777', '133725000000000000\r\n'], ['778', '133700000000000000\r\n'], ['779', '\r\n']]);
    const { disque, fichiers, commandes } = preparer({
      plateforme: 'win32',
      lancer: async (_commande, _arguments, { variables }) => {
        if (variables.GTT_PID === String(PID)) return '133725999999999999\r\n';
        if (!reponses.has(variables.GTT_PID)) throw new Error('Get-Process : aucun processus');
        return reponses.get(variables.GTT_PID);
      },
    });
    await fichiers.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-a', PRISE);
    assert.equal(JSON.parse(disque.contenu(VERROU)).demarrage, '133725999999999999');
    assert.deepEqual(commandes.map(({ commande }) => commande), ['powershell.exe']);
    const [{ arguments_, options }] = commandes;
    assert.deepEqual(arguments_.slice(0, 3), ['-NoProfile', '-NonInteractive', '-Command']);
    assert.match(arguments_[3], /\$env:GTT_PID/);
    assert.match(arguments_[3], /\.StartTime\.ToFileTimeUtc\(\)$/);
    assert.deepEqual(options, { variables: { GTT_PID: String(PID) }, delai: DELAI_SUPPORT_MS });
    for (const [pid, vivant] of [[777, true], [778, false], [779, null], [780, null]]) {
      deposerVerrou(disque, { seance: 'seance-x', pid, hote: HOTE, depuis: 'x', demarrage: '133725000000000000' });
      assert.equal((await fichiers.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-b', PRISE)).vivant, vivant, String(pid));
    }
  });

  test("sous Windows, un pid qui refuse le signal et dont l'heure de création ne se lit pas — le processus d'un autre compte — laisse vivant inconnu, jamais faux", async () => {
    const DEPUIS = '2026-10-06T19:02:11-04:00';
    const { disque, fichiers, signaux } = preparer({
      plateforme: 'win32',
      signaler: () => {
        throw erreurSysteme('EPERM', 'kill', '');
      },
      lancer: async (_commande, _arguments, { variables }) => {
        if (variables.GTT_PID === String(PID)) return '133725999999999999\r\n';
        throw new Error('Get-Process : accès refusé');
      },
    });
    deposerVerrou(disque, { seance: 'seance-a', pid: 4312, hote: HOTE, depuis: DEPUIS, demarrage: '133725000000000000' });
    assert.deepEqual(await fichiers.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-b', PRISE), {
      pris: false,
      seance: 'seance-a',
      depuis: DEPUIS,
      vivant: null,
    });
    assert.deepEqual(signaux, [4312]);
  });

  test("sous macOS, le démarrage est la colonne lstart de ps, en locale C et en temps universel ; une sortie vide le rend inconnu, et vivant avec lui ; ailleurs, inconnu, sans commande", async () => {
    const sorties = new Map([['777', 'Tue Oct  6 19:02:11 2026\n'], ['779', '\n']]);
    const { disque, fichiers, commandes } = preparer({
      plateforme: 'darwin',
      lancer: async (_commande, arguments_) => sorties.get(arguments_[3]) ?? 'Wed Oct  7 08:00:00 2026\n',
    });
    await fichiers.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-a', PRISE);
    assert.equal(JSON.parse(disque.contenu(VERROU)).demarrage, 'Wed Oct  7 08:00:00 2026');
    assert.deepEqual(commandes[0], {
      commande: 'ps',
      arguments_: ['-o', 'lstart=', '-p', String(PID)],
      options: { variables: { LC_ALL: 'C', TZ: 'UTC' }, delai: DELAI_SUPPORT_MS },
    });
    for (const [pid, vivant] of [[777, true], [778, false], [779, null]]) {
      deposerVerrou(disque, { seance: 'seance-x', pid, hote: HOTE, depuis: 'x', demarrage: 'Tue Oct  6 19:02:11 2026' });
      assert.equal((await fichiers.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-b', PRISE)).vivant, vivant, String(pid));
    }

    const ailleurs = preparer({ plateforme: 'freebsd' });
    await ailleurs.fichiers.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-a', PRISE);
    assert.equal(JSON.parse(ailleurs.disque.contenu(VERROU)).demarrage, null);
    assert.deepEqual(ailleurs.commandes, []);
  });

  test("sous macOS, une séance vivante reste vivante quand le fuseau du poste change entre la prise et la lecture", async () => {
    // Un ps factice : le même démarrage, écrit dans le fuseau que donne TZ,
    // ou à défaut dans celui du poste au moment de la commande.
    const ecrit = new Map([
      ['UTC', 'Tue Oct  6 23:02:11 2026'],
      ['America/Montreal', 'Tue Oct  6 19:02:11 2026'],
      ['Europe/Paris', 'Wed Oct  7 01:02:11 2026'],
    ]);
    let fuseauDuPoste = 'America/Montreal';
    const lancer = async (_commande, _arguments, { variables }) => `${ecrit.get(variables.TZ ?? fuseauDuPoste)}\n`;
    const premiere = preparer({ plateforme: 'darwin', lancer });
    assert.deepEqual(await premiere.fichiers.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-a', PRISE), { pris: true });
    fuseauDuPoste = 'Europe/Paris';
    const seconde = preparer({ disque: premiere.disque, plateforme: 'darwin', lancer });
    const tenu = await seconde.fichiers.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-b', PRISE);
    assert.deepEqual({ seance: tenu.seance, vivant: tenu.vivant }, { seance: 'seance-a', vivant: true });
  });

  test("le verrou d'une autre machine rend vivant à null sans signaler personne ; un verrou illisible rend tout à null", async () => {
    const { disque, fichiers, signaux } = preparer();
    deposerVerrou(disque, { seance: 'seance-a', pid: 777, hote: 'poste-voisin', depuis: '2026-10-06T19:02:11-04:00' });
    assert.deepEqual(await fichiers.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-b', PRISE), {
      pris: false,
      seance: 'seance-a',
      depuis: '2026-10-06T19:02:11-04:00',
      vivant: null,
    });
    assert.deepEqual(signaux, []);
    const illisible = { pris: false, seance: null, depuis: null, vivant: null };
    for (const texte of ['{"seance":"seance-a"', '{"seance":"seance-a","pid":0,"hote":"poste-essai","depuis":"x"}', '[]']) {
      disque.deposer(VERROU, texte);
      assert.deepEqual(await fichiers.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-b', PRISE), illisible, texte);
    }
    assert.deepEqual(signaux, []);
  });

  test("deverrouiller n'efface que le verrou de sa séance ; ni un absent ni un illisible ne sont des fautes", async () => {
    const { disque, fichiers } = preparer();
    await fichiers.deverrouiller(DOC, 'soiree.gtt.verrou', 'seance-a');
    await fichiers.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-a', PRISE);
    await fichiers.deverrouiller(DOC, 'soiree.gtt.verrou', 'seance-b');
    assert.equal(disque.existe(VERROU), true);
    await fichiers.deverrouiller(DOC, 'soiree.gtt.verrou', 'seance-a');
    assert.equal(disque.existe(VERROU), false);
    disque.deposer(VERROU, 'illisible');
    await fichiers.deverrouiller(DOC, 'soiree.gtt.verrou', 'seance-a');
    assert.equal(disque.contenu(VERROU), 'illisible');
  });

  test("un verrou qui ne s'écrit pas jusqu'au bout est retiré, et lève ECRITURE ; un dossier à sa place lève ECRITURE", async () => {
    const { disque, fichiers } = preparer();
    disque.panne('write', 'ENOSPC', { chemin: VERROU });
    await refuse(fichiers.verrouiller(DOC, 'soiree.gtt.verrou', 'seance-a', PRISE), 'ECRITURE', ecriture('soiree.gtt.verrou', DOCUMENTS, 'ENOSPC'));
    assert.equal(disque.existe(VERROU), false);
    disque.deposerDossier(`${DOCUMENTS}/dossier.gtt.verrou`);
    await refuse(fichiers.verrouiller(DOC, 'dossier.gtt.verrou', 'seance-a', PRISE), 'ECRITURE', ecriture('dossier.gtt.verrou', DOCUMENTS, 'EISDIR'));
  });

  test("processusVivant : un processus qui répond au signal 0 vit, comme celui qu'on n'a pas le droit de signaler ; un absent non", () => {
    const signaux = [];
    const signalerEnPanne = (code) => (pid) => {
      signaux.push(pid);
      if (code !== null) throw erreurSysteme(code, 'kill', '');
    };
    assert.equal(processusVivant(31, signalerEnPanne(null)), true);
    assert.equal(processusVivant(32, signalerEnPanne('EPERM')), true);
    assert.equal(processusVivant(33, signalerEnPanne('ESRCH')), false);
    assert.deepEqual(signaux, [31, 32, 33]);
    assert.equal(processusVivant(process.pid), true);
  });

  test('la séance est une chaîne non vide', async () => {
    const { disque, fichiers } = preparer();
    for (const seance of ['', null, 7]) {
      await assert.rejects(fichiers.verrouiller(DOC, 'soiree.gtt.verrou', seance, PRISE), TypeError, String(seance));
      await assert.rejects(fichiers.deverrouiller(DOC, 'soiree.gtt.verrou', seance), TypeError, String(seance));
    }
    assert.deepEqual(disque.appels, []);
  });
});

describe("coquille, fichiers : la sonde d'écriture (§ 8.6)", () => {
  const TEMOIN_DATA = `${DATA}/${TEMOIN}`;

  test('crée la racine et ses parents, efface un témoin resté, écrit un témoin en exclusif, le vide, le relit et l\u{2019}efface', async () => {
    const { disque, fichiers } = preparer();
    assert.equal(TEMOIN, '.gtt-temoin');
    assert.deepEqual(await fichiers.sonder(PORTABLE), { inscriptible: true, cause: null });
    assert.deepEqual(disque.noms(DATA), []);
    const suite = ecritures(disque).filter((ligne) => !ligne.startsWith('unlink ') || ligne === `unlink ${TEMOIN_DATA}`);
    assert.deepEqual(suite, [
      `mkdir ${DATA}`,
      `unlink ${TEMOIN_DATA}`,
      `open ${TEMOIN_DATA} wx`,
      `write ${TEMOIN_DATA}`,
      `sync ${TEMOIN_DATA}`,
      `close ${TEMOIN_DATA}`,
      `unlink ${TEMOIN_DATA}`,
    ]);
    assert.ok(disque.appels.includes(`readFile ${TEMOIN_DATA}`), 'témoin non relu');

    disque.deposer(TEMOIN_DATA, 'resté d\u{2019}une séance précédente');
    disque.deposer(`${DATA}/garde.txt`, 'garde');
    assert.deepEqual(await fichiers.sonder(PORTABLE), { inscriptible: true, cause: null });
    assert.deepEqual(disque.noms(DATA), ['garde.txt']);
  });

  test("rend la cause d'un échec sans lever, et ne laisse aucun témoin", async () => {
    for (const [fonction, cause] of [['mkdir', 'EACCES'], ['open', 'EROFS'], ['write', 'ENOSPC'], ['readFile', 'EIO'], ['unlink', 'EPERM']]) {
      const { disque, fichiers } = preparer();
      disque.panne(fonction, cause, fonction === 'unlink' ? { fois: 1 } : {});
      assert.deepEqual(await fichiers.sonder(PORTABLE), { inscriptible: false, cause }, fonction);
      assert.deepEqual(disque.existe(DATA) ? disque.noms(DATA) : [], [], fonction);
    }
  });

  test('un témoin relu autrement qu\u{2019}écrit fait échouer la sonde : RELECTURE', async () => {
    const disque = creerDisque();
    const fs = {
      ...disque.fs,
      readFile: async (chemin) => (chemin.endsWith(TEMOIN) ? Buffer.from('autre chose') : disque.fs.readFile(chemin)),
    };
    const { fichiers } = preparer({ disque, fs });
    assert.deepEqual(await fichiers.sonder(PORTABLE), { inscriptible: false, cause: 'RELECTURE' });
    assert.deepEqual(disque.noms(DATA), []);
  });

  test("une racine occupée par un fichier ne s'éprouve pas : sa cause est rendue", async () => {
    const { disque, fichiers } = preparer();
    disque.deposer(DATA, 'un fichier, pas un dossier');
    assert.deepEqual(await fichiers.sonder(PORTABLE), { inscriptible: false, cause: 'EEXIST' });
    assert.equal(disque.contenu(DATA), 'un fichier, pas un dossier');
  });
});

describe('coquille, fichiers : le support de la racine (§ 8.6)', () => {
  // Numéro de périphérique d'un majeur et d'un mineur dans le codage de
  // glibc : les douze bits bas du majeur au-dessus des huit bits bas du
  // mineur, le reste du mineur au-dessus, le reste du majeur au-dessus de
  // tout.
  const peripherique = (majeur, mineur) =>
    BigInt(mineur & 0xff) |
    (BigInt(majeur & 0xfff) << 8n) |
    (BigInt(mineur & ~0xff) << 12n) |
    (BigInt(Math.floor(majeur / 0x1000)) << 44n);

  // Un disque dont la racine documents est sur le périphérique donné, et
  // dont /sys/dev/block décrit ce périphérique comme le fait Linux.
  function surPeripherique(majeur, mineur, { partition, amovible }) {
    const disque = creerDisque();
    disque.deposerDossier('/poste', { dev: peripherique(majeur, mineur) });
    disque.deposerDossier(DOCUMENTS);
    const bloc = '/sys/devices/pci0000:00/usb1/1-1/block/sdq';
    const appareil = partition ? `${bloc}/sdq1` : bloc;
    disque.deposerDossier(appareil);
    if (partition) disque.deposer(`${appareil}/partition`, '1\n');
    disque.deposer(`${bloc}/removable`, `${amovible}\n`);
    disque.deposerLien(`/sys/dev/block/${majeur}:${mineur}`, appareil);
    return disque;
  }

  test("sous Linux, l'attribut removable du disque qui porte la racine : celui du parent pour une partition, le sien pour un disque entier", async () => {
    for (const [majeur, mineur, partition, amovible, attendu] of [
      [8, 17, true, 1, 'amovible'],
      [8, 300, true, 0, 'fixe'],
      [259, 3, false, 1, 'amovible'],
      [4097, 5, true, 1, 'amovible'],
    ]) {
      const { fichiers } = preparer({ disque: surPeripherique(majeur, mineur, { partition, amovible }) });
      assert.equal(await fichiers.typeSupport(DOC), attendu, `${majeur}:${mineur}`);
    }
  });

  test("sous Linux, une racine pas encore créée se lit sur son plus proche parent, et un périphérique que /sys ne décrit pas rend inconnu", async () => {
    const disque = surPeripherique(8, 17, { partition: true, amovible: 1 });
    const { fichiers } = preparer({ disque });
    // data/ et le dossier publié manquent : le plus proche parent est la
    // racine du disque, sur un périphérique que /sys/dev/block ne décrit pas.
    assert.equal(await fichiers.typeSupport(PORTABLE), 'inconnu');
    disque.deposerDossier(PUBLIE, { dev: peripherique(8, 17) });
    assert.equal(await fichiers.typeSupport(PORTABLE), 'amovible');
  });

  test("sous Windows, DriveInfo par PowerShell, la racine passée par l'environnement, borné à cinq secondes", async () => {
    assert.equal(DELAI_SUPPORT_MS, 5000);
    for (const [sortie, attendu] of [['Removable\r\n', 'amovible'], ['Fixed\r\n', 'fixe'], ['Network\r\n', 'inconnu'], ['', 'inconnu']]) {
      const { fichiers, commandes } = preparer({ plateforme: 'win32', lancer: async () => sortie });
      assert.equal(await fichiers.typeSupport(DOC), attendu, sortie);
      assert.deepEqual(commandes, [
        {
          commande: 'powershell.exe',
          arguments_: ['-NoProfile', '-NonInteractive', '-Command', '[System.IO.DriveInfo]::new($env:GTT_RACINE).DriveType'],
          options: { variables: { GTT_RACINE: DOCUMENTS }, delai: 5000 },
        },
      ]);
    }
    const { fichiers: enEchec } = preparer({
      plateforme: 'win32',
      lancer: async () => {
        throw Object.assign(new Error('délai dépassé'), { killed: true, signal: 'SIGTERM' });
      },
    });
    assert.equal(await enEchec.typeSupport(DOC), 'inconnu');
  });

  test('ailleurs, inconnu, sans commande', async () => {
    const { fichiers, commandes } = preparer({ plateforme: 'darwin' });
    assert.equal(await fichiers.typeSupport(DOC), 'inconnu');
    assert.deepEqual(commandes, []);
  });
});

describe('coquille, fichiers : dialogues et explorateur', () => {
  test("choisirDossier ouvre le dialogue sur la fenêtre et rend une racine choisi-N, que les primitives connaissent dès lors ; une annulation rend null", async () => {
    const choisi = '/poste/exemple/Bureau/soirees';
    const dialog = dialogueFactice([
      { canceled: false, filePaths: [choisi] },
      { canceled: true, filePaths: [] },
      { canceled: false, filePaths: [AILLEURS] },
    ]);
    const { disque, fichiers } = preparer({ dialog });
    disque.deposerDossier(choisi);
    const racine = await fichiers.choisirDossier();
    assert.deepEqual(racine, { id: 'choisi-1', chemin: choisi });
    assert.equal(await fichiers.choisirDossier(), null);
    assert.deepEqual(await fichiers.choisirDossier(), { id: 'choisi-2', chemin: AILLEURS });
    assert.deepEqual(
      dialog.appels.map(({ methode, parent, options }) => ({ methode, parent, options })),
      Array(3).fill({ methode: 'showOpenDialog', parent: FENETRE, options: { properties: ['openDirectory', 'createDirectory'] } }),
    );
    await fichiers.ecrireAtomique({ id: 'choisi-1' }, 'etat.json', 'choisi');
    assert.equal(disque.contenu(`${choisi}/etat.json`), 'choisi');
    await refuse(fichiers.lireTexte({ id: 'choisi-3' }, 'etat.json'), 'CHEMIN_REFUSE', { chemin: 'etat.json' });
  });

  test("choisirFichierAImporter rend le nom et les octets du fichier choisi ; une annulation rend null", async () => {
    const fichier = '/poste/exemple/T\u{E9}l\u{E9}chargements/liste.csv';
    const dialog = dialogueFactice([{ canceled: false, filePaths: [fichier] }]);
    const { disque, fichiers } = preparer({ dialog });
    disque.deposer(fichier, 'nom\r\n\u{C9}lan\r\n');
    const choisi = await fichiers.choisirFichierAImporter();
    assert.equal(choisi.nom, 'liste.csv');
    assert.ok(choisi.octets instanceof Uint8Array);
    assert.deepEqual([...choisi.octets], [...Buffer.from('nom\r\n\u{C9}lan\r\n')]);
    assert.deepEqual(dialog.appels.map(({ parent, options }) => ({ parent, options })), [{ parent: FENETRE, options: { properties: ['openFile'] } }]);
    assert.equal(await fichiers.choisirFichierAImporter(), null);
  });

  test("enregistrerSous propose le nom dans les Documents, écrit le fichier choisi par écriture atomique et rend son chemin ; une annulation n'écrit rien", async () => {
    const choisi = '/poste/exemple/Documents/liste-retenue.csv';
    const dialog = dialogueFactice([{ canceled: false, filePath: choisi }]);
    const { disque, fichiers } = preparer({ dialog });
    const octets = new Uint8Array(Buffer.from('nom\n\u{C9}lan\n'));
    assert.equal(await fichiers.enregistrerSous('liste.csv', octets), choisi);
    assert.equal(disque.contenu(choisi), 'nom\n\u{C9}lan\n');
    assert.ok(ecritures(disque).includes(`rename ${choisi}${SUFFIXE_ECRITURE} ${choisi}`), 'pas de renommage');
    assert.equal(await fichiers.enregistrerSous('../../liste.csv', octets), null);
    assert.deepEqual(
      dialog.appels.map(({ parent, options }) => ({ parent, options })),
      [
        { parent: FENETRE, options: { defaultPath: '/poste/exemple/Documents/liste.csv' } },
        { parent: FENETRE, options: { defaultPath: '/poste/exemple/Documents/liste.csv' } },
      ],
    );
    await assert.rejects(fichiers.enregistrerSous('liste.csv', 'pas des octets'), TypeError);
    assert.equal(dialog.appels.length, 2);
  });

  test("enregistrerSous qui ne peut écrire lève ECRITURE en nommant le fichier et son dossier", async () => {
    const choisi = '/poste/exemple/Documents/liste.csv';
    const dialog = dialogueFactice([{ canceled: false, filePath: choisi }]);
    const { disque, fichiers } = preparer({ dialog });
    disque.panne('open', 'EROFS');
    await refuse(fichiers.enregistrerSous('liste.csv', new Uint8Array(1)), 'ECRITURE', ecriture('liste.csv', '/poste/exemple/Documents', 'EROFS'));
  });

  test("ouvrirDansExplorateur ouvre la racine ; une racine absente lève ABSENT sans rien ouvrir, un refus de l'explorateur NON_DISPONIBLE", async () => {
    const { fichiers, ouvertures } = preparer();
    await fichiers.ouvrirDansExplorateur(DOC);
    assert.deepEqual(ouvertures, [DOCUMENTS]);
    await refuse(fichiers.ouvrirDansExplorateur(PORTABLE), 'ABSENT', { chemin: '' });
    assert.deepEqual(ouvertures, [DOCUMENTS]);
    const { fichiers: sansExplorateur } = preparer({ ouvrir: async () => 'Failed to open path' });
    await refuse(sansExplorateur.ouvrirDansExplorateur(DOC), 'NON_DISPONIBLE', { cause: 'Failed to open path' });
  });
});

describe('coquille, fichiers : emplacements et racines du système (§ 8.6)', () => {
  // app.getPath d'un poste d'épreuve, par plateforme.
  const CHEMINS = {
    win32: {
      appData: 'C:\\Users\\Exemple\\AppData\\Roaming',
      temp: 'C:\\Users\\Exemple\\AppData\\Local\\Temp',
      documents: 'C:\\Users\\Exemple\\Documents',
    },
    linux: { appData: '/poste/exemple/.config', temp: '/tmp', documents: '/poste/exemple/Documents' },
    darwin: {
      appData: '/Users/exemple/Library/Application Support',
      temp: '/var/folders/xy/T',
      documents: '/Users/exemple/Documents',
    },
  };
  const decrire = (plateforme, env) =>
    decrireSysteme({
      env,
      plateforme,
      cheminSysteme: (nom) => {
        assert.ok(Object.hasOwn(CHEMINS[plateforme], nom), `app.getPath('${nom}')`);
        return CHEMINS[plateforme][nom];
      },
      nomProduit: 'Gestion table tournante Libre',
    });

  test("sous Windows : le dossier publié et son data/, les Documents du produit, AppData, LOCALAPPDATA et le temporaire, sans égard à la casse", () => {
    assert.deepEqual(
      decrire('win32', { PORTABLE_EXECUTABLE_DIR: 'E:\\soirees', LOCALAPPDATA: 'C:\\Users\\Exemple\\AppData\\Local' }),
      {
        emplacements: {
          executable: 'E:\\soirees',
          donneesApplicatives: [
            'C:\\Users\\Exemple\\AppData\\Roaming',
            'C:\\Users\\Exemple\\AppData\\Local',
            'C:\\Users\\Exemple\\AppData\\Local\\Temp',
          ],
          insensibleCasse: true,
          separateur: '\\',
        },
        racines: {
          portable: 'E:\\soirees\\data',
          documents: 'C:\\Users\\Exemple\\Documents\\Gestion table tournante Libre',
        },
      },
    );
  });

  test('sans dossier publié, ou publié vide, ni exécutable ni racine portable', () => {
    for (const env of [{}, { PORTABLE_EXECUTABLE_DIR: '' }]) {
      const { emplacements, racines } = decrire('win32', env);
      assert.equal(emplacements.executable, null, JSON.stringify(env));
      assert.equal(racines.portable, null, JSON.stringify(env));
      assert.deepEqual(emplacements.donneesApplicatives, [
        'C:\\Users\\Exemple\\AppData\\Roaming',
        'C:\\Users\\Exemple\\AppData\\Local\\Temp',
      ]);
    }
  });

  test('sous Linux la casse compte, sous macOS non ; le séparateur suit la plateforme', () => {
    const linux = decrire('linux', { PORTABLE_EXECUTABLE_DIR: '/media/cle/soirees' });
    assert.deepEqual(linux.emplacements, {
      executable: '/media/cle/soirees',
      donneesApplicatives: ['/poste/exemple/.config', '/tmp'],
      insensibleCasse: false,
      separateur: '/',
    });
    assert.deepEqual(linux.racines, {
      portable: '/media/cle/soirees/data',
      documents: '/poste/exemple/Documents/Gestion table tournante Libre',
    });
    assert.equal(decrire('darwin', {}).emplacements.insensibleCasse, true);
  });

  test('emplacements et racines rendent à chaque appel des copies de ce que la coquille a reçu', async () => {
    const { fichiers } = preparer();
    const premier = await fichiers.emplacements();
    assert.deepEqual(premier, EMPLACEMENTS);
    premier.donneesApplicatives.push('/ajout');
    premier.executable = null;
    assert.deepEqual(await fichiers.emplacements(), EMPLACEMENTS);
    assert.deepEqual(await fichiers.racines(), { portable: PORTABLE, documents: DOC });
    const sansPortable = creerFichiers({
      emplacements: { ...EMPLACEMENTS, executable: null },
      racines: { portable: null, documents: DOCUMENTS },
      fs: creerDisque().fs,
      chemins: posix,
    });
    assert.deepEqual(await sansPortable.racines(), { portable: null, documents: DOC });
    await refuse(sansPortable.lireTexte(PORTABLE, 'x.txt'), 'CHEMIN_REFUSE', { chemin: 'x.txt' });
  });
});

describe('coquille, fichiers : le service IPC', () => {
  test('servir pose un canal gtt:fichiers:<primitive> par primitive, dans l\u{2019}ordre de l\u{2019}interface', () => {
    assert.equal(PREFIXE_CANAL, 'gtt:fichiers:');
    const canaux = [];
    servir(preparer().fichiers, (canal, gestionnaire) => {
      assert.equal(typeof gestionnaire, 'function');
      canaux.push(canal);
    });
    assert.deepEqual(canaux, PRIMITIVES.map((primitive) => `gtt:fichiers:${primitive}`));
    assert.equal(PRIMITIVES.length, 18);
    assert.equal(PRIMITIVES.indexOf('ecrireOctetsAtomique'), PRIMITIVES.indexOf('ecrireAtomique') + 1);
    assert.ok(Object.isFrozen(PRIMITIVES));
  });

  test("repondre rend { ok: true, valeur } ou, pour un refus, { ok: false, code, details } ; toute autre erreur se lève", async () => {
    assert.deepEqual(await repondre(async () => 3), { ok: true, valeur: 3 });
    assert.deepEqual(await repondre(async () => undefined), { ok: true, valeur: undefined });
    assert.deepEqual(await repondre(async () => { throw new RefusFichier('EXISTE', { chemin: 'a.txt' }); }), {
      ok: false,
      code: 'EXISTE',
      details: { chemin: 'a.txt' },
    });
    await assert.rejects(repondre(async () => { throw new TypeError('faute'); }), TypeError);
  });

  test("le gestionnaire d'un canal reçoit l'évènement d'Electron, puis les arguments de la primitive", async () => {
    const gestionnaires = new Map();
    const { disque, fichiers } = preparer();
    servir(fichiers, (canal, gestionnaire) => gestionnaires.set(canal, gestionnaire));
    const evenement = { sender: null };
    assert.deepEqual(await gestionnaires.get('gtt:fichiers:ecrireAtomique')(evenement, DOC, 'etat.json', 'servi'), { ok: true, valeur: undefined });
    assert.equal(disque.contenu(`${DOCUMENTS}/etat.json`), 'servi');
    assert.deepEqual(await gestionnaires.get('gtt:fichiers:lireTexte')(evenement, DOC, 'absent.txt'), {
      ok: false,
      code: 'ABSENT',
      details: { chemin: 'absent.txt' },
    });
  });
});

describe('coquille, fichiers : ce que la coquille recopie de src/stockage', () => {
  test('la règle des segments est celle de exigerCheminRelatif, chemin par chemin', () => {
    const chemins = [
      '', 'soiree.gtt.json', 'corbeille/2026-01-02_03-04-05/soiree.gtt.json', '.gtt-temoin', '..soiree', ' devant',
      'Soir\u{E9}e d\u{2019}\u{E9}t\u{E9}.gtt.json', '/x', '//serveur/partage/x', 'a//b', 'a/', '..', '../x', 'a/../../x',
      '.', './x', 'a/./b', '...', 'a/.. /x', 'soiree.', 'soiree ', 'C:\\x', 'C:x', 'C:/x', '\\\\serveur\\partage\\x',
      'a\\b', 'soiree.gtt.json:flux', 'a\u{0}b', null, undefined, 42,
    ];
    for (const chemin of chemins) {
      let attendu;
      try {
        attendu = { segments: exigerCheminRelatif(chemin) };
      } catch (erreur) {
        assert.ok(erreur instanceof ErreurStockage, String(erreur));
        attendu = { code: erreur.code, details: erreur.details };
      }
      let obtenu;
      try {
        obtenu = { segments: segmentsAdmis(chemin) };
      } catch (erreur) {
        assert.ok(erreur instanceof RefusFichier, String(erreur));
        obtenu = { code: erreur.code, details: erreur.details };
      }
      assert.deepEqual(obtenu, attendu, String(chemin));
    }
  });

  test("le suffixe de l'écriture atomique est celui de src/stockage/noms.js", () => {
    assert.equal(SUFFIXE_ECRITURE, SUFFIXE_DU_STOCKAGE);
  });
});

// ---------------------------------------------------------------------------
// La page derrière le pont

// Charge electron/preload.cjs comme un rendu en bac à sable, contre un
// electron dont invoke porte chaque appel au gestionnaire que servir a posé
// sur ce canal ; arguments et réponse sont copiés comme l'IPC les copie, et
// une erreur levée n'en laisse passer que le message. Rend ce que le
// préchargement expose sous gtt, et les canaux invoqués.
function parLePrechargement(fichiers) {
  const gestionnaires = new Map();
  servir(fichiers, (canal, gestionnaire) => gestionnaires.set(canal, gestionnaire));
  const exposes = new Map();
  const invoques = [];
  const electron = {
    contextBridge: {
      exposeInMainWorld: (cle, api) => exposes.set(cle, api),
    },
    ipcRenderer: {
      async invoke(canal, ...parametres) {
        invoques.push(canal);
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
  assert.deepEqual([...exposes.keys()], ['gtt']);
  return { gtt: exposes.get('gtt'), invoques };
}

describe('page : src/stockage/fichiers_electron.js', () => {
  // Un pont qui consigne chaque appel et rend la réponse suivante.
  function pontFactice(reponses) {
    const appels = [];
    const pont = {};
    for (const primitive of PRIMITIVES) {
      pont[primitive] = async (...parametres) => {
        appels.push([primitive, ...parametres]);
        return reponses.shift();
      };
    }
    return { pont, appels };
  }

  test('nature electron, renommage atomique et verrou ; les dix-huit primitives, dans l\u{2019}ordre de la coquille', () => {
    const fs = creerFichiersElectron(pontFactice([]).pont);
    assert.deepEqual(
      { nature: fs.nature, renommageAtomique: fs.renommageAtomique, verrouDisponible: fs.verrouDisponible },
      { nature: 'electron', renommageAtomique: true, verrouDisponible: true },
    );
    assert.deepEqual(
      Object.keys(fs).filter((cle) => typeof fs[cle] === 'function'),
      [...PRIMITIVES],
    );
  });

  test('chaque primitive passe ses arguments, et eux seuls, à la fonction du même nom du pont, et rend sa valeur', async () => {
    const octets = new Uint8Array([1, 2]);
    const appels = [
      ['emplacements', []],
      ['racines', []],
      ['choisirDossier', []],
      ['sonder', [DOC]],
      ['typeSupport', [DOC]],
      ['lireTexte', [DOC, 'a.txt']],
      ['ecrireAtomique', [DOC, 'a.txt', 'texte']],
      ['ecrireOctetsAtomique', [DOC, 'a.pdf', octets]],
      ['ajouterLigne', [DOC, 'a.jsonl', 'ligne']],
      ['lister', [DOC, '']],
      ['creerDossier', [DOC, 'corbeille']],
      ['deplacer', [DOC, 'a.txt', 'b.txt']],
      ['supprimer', [DOC, 'a.txt']],
      ['verrouiller', [DOC, 'a.gtt.verrou', 'seance-a', PRISE]],
      ['deverrouiller', [DOC, 'a.gtt.verrou', 'seance-a']],
      ['ouvrirDansExplorateur', [DOC]],
      ['choisirFichierAImporter', []],
      ['enregistrerSous', ['liste.csv', octets]],
    ];
    const { pont, appels: recus } = pontFactice(appels.map((_, rang) => ({ ok: true, valeur: rang })));
    const fs = creerFichiersElectron(pont);
    for (const [rang, [primitive, parametres]] of appels.entries()) {
      assert.equal(await fs[primitive](...parametres, 'argument en trop'), rang, primitive);
    }
    assert.deepEqual(recus, appels.map(([primitive, parametres]) => [primitive, ...parametres]));
  });

  test("verrouiller refuse, avant le pont, un instant de prise qui n'a pas la forme d'un horodatage : TypeError", async () => {
    const { pont, appels } = pontFactice([]);
    const fs = creerFichiersElectron(pont);
    for (const depuis of [undefined, '', '2026-10-06T19:02:11Z', '2026-10-06 19:02:11-04:00']) {
      const erreur = await rejette(fs.verrouiller(DOC, 'a.gtt.verrou', 'seance-a', depuis));
      assert.ok(erreur instanceof TypeError, `${String(depuis)} : ${erreur}`);
    }
    assert.deepEqual(appels, []);
  });

  test("ecrireOctetsAtomique refuse, avant le pont, des octets d'une autre forme qu'un Uint8Array : TypeError", async () => {
    const { pont, appels } = pontFactice([]);
    const fs = creerFichiersElectron(pont);
    for (const fautifs of ['%PDF', [0x25], new ArrayBuffer(1), undefined]) {
      const erreur = await rejette(fs.ecrireOctetsAtomique(DOC, 'a.pdf', fautifs));
      assert.ok(erreur instanceof TypeError, `${String(fautifs)} : ${erreur}`);
    }
    assert.deepEqual(appels, []);
  });

  test("une réponse { ok: false } devient l'ErreurStockage de ce code et de ces détails ; une réponse d'une autre forme, une TypeError", async () => {
    const { pont } = pontFactice([
      { ok: false, code: 'ECRITURE', details: { chemin: 'a.txt', dossier: DOCUMENTS, cause: 'EBUSY' } },
      { ok: false, code: 'CHEMIN_REFUSE', details: { chemin: '../x' } },
      undefined,
      { ok: 'oui', valeur: 1 },
      { ok: false, details: {} },
    ]);
    const fs = creerFichiersElectron(pont);
    const premiere = await rejette(fs.ecrireAtomique(DOC, 'a.txt', 'x'));
    assert.ok(premiere instanceof ErreurStockage);
    assert.deepEqual([premiere.code, premiere.details], ['ECRITURE', { chemin: 'a.txt', dossier: DOCUMENTS, cause: 'EBUSY' }]);
    const seconde = await rejette(fs.lireTexte(DOC, '../x'));
    assert.deepEqual([seconde.code, seconde.details], ['CHEMIN_REFUSE', { chemin: '../x' }]);
    for (let i = 0; i < 3; i += 1) {
      const erreur = await rejette(fs.lister(DOC, ''));
      assert.ok(erreur instanceof TypeError && !(erreur instanceof ErreurStockage), String(erreur));
    }
  });

  test("à travers le vrai préchargement : chaque primitive de la page appelle son canal, et un refus de la coquille revient en ErreurStockage", async () => {
    const { disque, fichiers } = preparer();
    const { gtt, invoques } = parLePrechargement(fichiers);
    assert.deepEqual(Object.keys(gtt), ['fichiers', 'copier', 'imprimer']);
    assert.equal(typeof gtt.copier, 'function');
    assert.equal(typeof gtt.imprimer, 'function');
    assert.deepEqual(Object.keys(gtt.fichiers), [...PRIMITIVES]);
    assert.ok(Object.values(gtt.fichiers).every((fonction) => typeof fonction === 'function'));

    const fs = creerFichiersElectron(gtt.fichiers);
    const planche = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x0a, 0xe2, 0xe3, 0x00, 0xff]);
    await fs.ecrireOctetsAtomique(DOC, 'soiree.badges.pdf', planche);
    assert.deepEqual(disque.octets(`${DOCUMENTS}/soiree.badges.pdf`), planche);
    await fs.ecrireAtomique(DOC, 'soiree.gtt.json', '{"entete":{}}\n');
    assert.equal(await fs.lireTexte(DOC, 'soiree.gtt.json'), '{"entete":{}}\n');
    assert.equal(disque.contenu(`${DOCUMENTS}/soiree.gtt.json`), '{"entete":{}}\n');
    const refus = await rejette(fs.deplacer(DOC, 'soiree.gtt.json', '../dehors.json'));
    assert.ok(refus instanceof ErreurStockage, String(refus));
    assert.deepEqual([refus.code, refus.details], ['CHEMIN_REFUSE', { chemin: '../dehors.json' }]);
    const faute = await rejette(fs.ecrireAtomique(DOC, 'soiree.gtt.json', 42));
    assert.ok(!(faute instanceof ErreurStockage), String(faute));
    assert.match(faute.message, /gtt:fichiers:ecrireAtomique/);
    assert.deepEqual(invoques, [
      'gtt:fichiers:ecrireOctetsAtomique',
      'gtt:fichiers:ecrireAtomique',
      'gtt:fichiers:lireTexte',
      'gtt:fichiers:deplacer',
      'gtt:fichiers:ecrireAtomique',
    ]);
  });
});
