// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le système de fichiers de la coquille (§ 8.6, § 8.8, § 13.1) : les dix-sept
// primitives de l'interface de src/stockage/systeme_fichiers.js, exécutées
// sous Node par le processus principal, et le service qui les offre à la
// page, un canal IPC par primitive, gtt:fichiers:<primitive>.
//
// La page ne désigne jamais un fichier par un chemin absolu : elle donne une
// racine, que ce module connaît par son seul identifiant — portable,
// documents, ou choisi-N qu'a rendu le dialogue de choix d'un dossier —, et
// un chemin relatif à elle. Un chemin que refuse la règle des segments, une
// racine inconnue, ou une cible dont le chemin réel sort de celui de sa
// racine — un lien symbolique en chemin — lèvent CHEMIN_REFUSE avant toute
// écriture.
//
// Le paquet n'emporte de src/ que la page construite (§ 14.15) : ce module ne
// charge que des modules de Node. Ce qu'il partage avec src/stockage — la
// règle des segments, le suffixe .ecriture, les codes d'échec — s'y
// recopie, et test/fichiers_electron.test.js éprouve que les deux
// définitions s'accordent.
//
// Un échec que l'interface nomme lève RefusFichier, porteur du code et des
// détails d'une ErreurStockage. Une erreur ne traverse pas l'IPC : repondre
// fait de chaque appel une réponse { ok: true, valeur } ou { ok: false, code,
// details }, que src/stockage/fichiers_electron.js retransforme en
// ErreurStockage. Une faute du code, ou un argument de forme fausse, lève une
// autre erreur, dont Electron ne transmet que le message.
//
// Deux codes s'ajoutent à ceux de l'interface : LECTURE {chemin, dossier,
// cause}, une lecture que le système refuse autrement que sur un absent — un
// dossier illisible n'est pas un dossier vide —, ou un fichier dont les
// octets ne sont pas de l'UTF-8, cause UTF8_INVALIDE, ses détails portant
// alors aussi octets, un Uint8Array que l'IPC transporte ; et NON_DISPONIBLE
// {cause}, l'explorateur du système qui ne s'ouvre pas.
import { execFile } from 'node:child_process';
import { realpath as realpathRappel } from 'node:fs';
import { lstat, mkdir, open, readdir, readFile, rename, stat, unlink } from 'node:fs/promises';
import { hostname } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

/** Les primitives de l'interface, dans l'ordre où elle les déclare. */
export const PRIMITIVES = Object.freeze([
  'emplacements',
  'racines',
  'choisirDossier',
  'sonder',
  'typeSupport',
  'lireTexte',
  'ecrireAtomique',
  'ajouterLigne',
  'lister',
  'creerDossier',
  'deplacer',
  'supprimer',
  'verrouiller',
  'deverrouiller',
  'ouvrirDansExplorateur',
  'choisirFichierAImporter',
  'enregistrerSous',
]);

/** Le canal d'une primitive est ce préfixe suivi de son nom. */
export const PREFIXE_CANAL = 'gtt:fichiers:';

/** Ajouté au nom d'un fichier pendant son écriture atomique (§ 8.8). */
export const SUFFIXE_ECRITURE = '.ecriture';

/** Le témoin de la sonde d'écriture, à la racine sondée (§ 8.6). */
export const TEMOIN = '.gtt-temoin';

// Ce que la sonde écrit, puis attend à la relecture : un texte en UTF-8 hors
// de l'ASCII, qu'un support qui altère les octets ne rend pas tel quel.
const TEXTE_TEMOIN = 'T\u{E9}moin d\u{2019}\u{E9}criture de Gestion table tournante Libre.\n';

/**
 * Un appel système qu'un antivirus ou un agent de synchronisation peut
 * refuser sous Windows, tant qu'il tient le fichier ouvert (EPERM, EBUSY,
 * EACCES), se réessaie, après son premier essai, REESSAIS_PASSAGERS fois :
 * le renommage de l'écriture atomique, l'ouverture en ajout d'ajouterLigne,
 * le renommage de deplacer, l'effacement de supprimer. La pause entre deux
 * essais part de PAUSE_INITIALE_MS et double jusqu'à PAUSE_MAX_MS : 3,75 s
 * d'attente au plus avant de renoncer.
 */
export const REESSAIS_PASSAGERS = 10;
export const PAUSE_INITIALE_MS = 50;
export const PAUSE_MAX_MS = 500;
const CAUSES_PASSAGERES = new Set(['EPERM', 'EBUSY', 'EACCES']);

/** La commande qui lit le type d'un lecteur sous Windows est bornée à 5 s. */
export const DELAI_SUPPORT_MS = 5000;

// Lit le type du lecteur de la racine que reçoit la variable GTT_RACINE : le
// chemin passe par l'environnement, jamais par le texte de la commande, où
// une apostrophe le ferait lire autrement.
const COMMANDE_LECTEUR = '[System.IO.DriveInfo]::new($env:GTT_RACINE).DriveType';

// Lit l'heure de création du processus dont la variable GTT_PID porte le
// pid, en FILETIME UTC : un entier, le même à chaque lecture. Un processus
// absent, ou d'un autre compte — système, service, élevé — que .NET ne peut
// ouvrir, ne rend aucun nombre : la vie de la séance reste alors inconnue.
const COMMANDE_DEMARRAGE = '(Get-Process -Id $env:GTT_PID -ErrorAction Stop).StartTime.ToFileTimeUtc()';

// Dans /proc/<pid>/stat, le démarrage est le champ 22 ; les champs se
// comptent après la parenthèse fermante du nom, le champ 2, qui peut porter
// des espaces et des parenthèses : le champ 3 y a le rang 0.
const RANG_DEMARRAGE_STAT = 22 - 3;

// La règle des segments d'exigerCheminRelatif (src/stockage/systeme_fichiers.js),
// recopiée : un segment ne finit ni par un point ni par une espace — « . »,
// « .. » et ce que Windows y ramène —, et ne porte ni barre oblique inverse,
// ni deux-points, ni caractère nul. Un segment vide vient d'un chemin absolu,
// d'un séparateur doublé ou final.
const SEGMENT_ADMIS = /^[^\\:\u{0}]*[^\\:\u{0}. ]$/u;

// Codes d'une cible absente : elle-même, un dossier parent qui est un
// fichier ; pour une lecture, un dossier là où l'on attend un fichier.
const ABSENCE = new Set(['ENOENT', 'ENOTDIR']);
const ABSENCE_EN_LECTURE = new Set(['ENOENT', 'ENOTDIR', 'EISDIR']);

// Décodage strict d'un fichier lu : un octet hors UTF-8 lève au lieu de se
// lire U+FFFD, et la marque d'ordre d'octets reste dans le texte.
const UTF8_STRICT = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

// Le remplaçant JSON d'un détail : un Uint8Array devient « N octets », comme
// dans le message d'une ErreurStockage.
const sansOctets = (cle, valeur) => (valeur instanceof Uint8Array ? `${valeur.length} octets` : valeur);

/**
 * Un échec que l'interface nomme : le code et les détails d'une
 * ErreurStockage (src/stockage/types.js en donne la table). Le message écrit
 * les détails en JSON, un détail en octets par son seul nombre d'octets.
 */
export class RefusFichier extends Error {
  /**
   * @param {string} code
   * @param {Object} details
   */
  constructor(code, details) {
    super(`${code} ${JSON.stringify(details, sansOctets)}`);
    this.code = code;
    this.details = details;
  }
}
RefusFichier.prototype.name = 'RefusFichier';

/**
 * Les segments d'un chemin relatif à une racine : [] pour '', la racine
 * elle-même. Le contrôle ne lit que le texte.
 *
 * @param {unknown} chemin
 * @returns {string[]}
 * @throws {RefusFichier} CHEMIN_REFUSE {chemin} : autre chose qu'une chaîne,
 *         ou un segment que la règle refuse
 */
export function segmentsAdmis(chemin) {
  if (typeof chemin !== 'string') throw new RefusFichier('CHEMIN_REFUSE', { chemin });
  if (chemin === '') return [];
  const segments = chemin.split('/');
  if (!segments.every((segment) => SEGMENT_ADMIS.test(segment))) {
    throw new RefusFichier('CHEMIN_REFUSE', { chemin });
  }
  return segments;
}

/**
 * Les emplacements et les racines du poste, lus une fois, au démarrage
 * (§ 8.6). Le dossier de l'exécutable est celui que publie le lanceur
 * portable dans PORTABLE_EXECUTABLE_DIR — absente ou vide, aucun —, jamais
 * celui du processus, qui tourne dans le dossier temporaire où l'archive
 * s'extrait. Les données applicatives sont AppData, LOCALAPPDATA quand le
 * poste le définit, et le dossier temporaire. Les chemins se composent à la
 * manière de la plateforme donnée.
 *
 * @param {Object} poste
 * @param {Object<string, string|undefined>} poste.env  l'environnement du processus
 * @param {string} poste.plateforme  process.platform
 * @param {(nom: 'appData'|'temp'|'documents') => string} poste.cheminSysteme
 *        app.getPath d'Electron
 * @param {string} poste.nomProduit  le dossier du produit dans les Documents
 * @returns {{emplacements: Object, racines: {portable: string|null, documents: string}}}
 *          emplacements a la forme Emplacements de src/stockage/systeme_fichiers.js
 */
export function decrireSysteme({ env, plateforme, cheminSysteme, nomProduit }) {
  const chemins = plateforme === 'win32' ? path.win32 : path.posix;
  const executable = env.PORTABLE_EXECUTABLE_DIR || null;
  const donneesApplicatives = [cheminSysteme('appData'), env.LOCALAPPDATA, cheminSysteme('temp')].filter(
    (dossier) => typeof dossier === 'string' && dossier !== '',
  );
  return {
    emplacements: {
      executable,
      donneesApplicatives,
      insensibleCasse: plateforme === 'win32' || plateforme === 'darwin',
      separateur: chemins.sep,
    },
    racines: {
      portable: executable === null ? null : chemins.join(executable, 'data'),
      documents: chemins.join(cheminSysteme('documents'), nomProduit),
    },
  };
}

// Les fonctions de node:fs/promises dont les primitives se servent. realpath
// est celle de node:fs, qui résout les liens segment par segment ; celle de
// node:fs/promises demande au système le chemin final d'un fichier ouvert,
// ce que des lecteurs de Windows refusent.
const FS_NODE = Object.freeze({
  lstat,
  stat,
  realpath: promisify(realpathRappel),
  readFile,
  open,
  rename,
  unlink,
  mkdir,
  readdir,
});

// Lance une commande sans shell, ces variables ajoutées à l'environnement du
// processus, tuée au-delà du délai ; rend sa sortie standard, ou rejette.
function lancerCommande(commande, arguments_, { variables, delai }) {
  return new Promise((resoudre, rejeter) => {
    execFile(
      commande,
      arguments_,
      { env: { ...process.env, ...variables }, timeout: delai, windowsHide: true, encoding: 'utf8' },
      (erreur, sortie) => (erreur ? rejeter(erreur) : resoudre(sortie)),
    );
  });
}

const pause = (ms) => new Promise((resoudre) => setTimeout(resoudre, ms));

// Vrai pour une erreur du système, telle que node:fs la lève : un code et
// l'appel système qui a échoué. Les autres sont des fautes du code.
const estErreurSysteme = (erreur) =>
  erreur instanceof Error && typeof erreur.code === 'string' && typeof erreur.syscall === 'string';

const estObjet = (valeur) => valeur !== null && typeof valeur === 'object';

function exigerTexte(valeur, quoi) {
  if (typeof valeur !== 'string') throw new TypeError(`${quoi} n'est pas une chaîne`);
}

function exigerLigne(ligne) {
  exigerTexte(ligne, 'la ligne');
  if (/[\r\n]/.test(ligne)) throw new TypeError('la ligne porte une fin de ligne');
}

function exigerSeance(seance) {
  if (typeof seance !== 'string' || seance === '') throw new TypeError("la séance n'est pas une chaîne non vide");
}

// Le contenu d'un verrou, {seance, pid, hote, depuis, demarrage}, ou null
// quand le texte n'en est pas un : JSON invalide, champ manquant ou de type
// faux, pid qui ne désigne pas un processus — 0 et les négatifs désignent
// des groupes. demarrage est une chaîne, null quand il est inconnu ; un
// verrou qui ne le porte pas le laisse inconnu. Une autre clé ne compte pas.
function analyserVerrou(texte) {
  let contenu;
  try {
    contenu = JSON.parse(texte);
  } catch {
    return null;
  }
  const valide =
    estObjet(contenu) &&
    typeof contenu.seance === 'string' &&
    Number.isSafeInteger(contenu.pid) &&
    contenu.pid > 0 &&
    typeof contenu.hote === 'string' &&
    typeof contenu.depuis === 'string' &&
    (contenu.demarrage === undefined || contenu.demarrage === null || typeof contenu.demarrage === 'string');
  return valide ? { ...contenu, demarrage: contenu.demarrage ?? null } : null;
}

// Un instant sous la forme de l'horloge de l'application,
// AAAA-MM-JJTHH:MM:SS±HH:MM, à l'heure locale du poste et avec son décalage.
function horodatage(instant) {
  const deux = (n) => String(n).padStart(2, '0');
  const decalage = -instant.getTimezoneOffset();
  const ecart = Math.abs(decalage);
  return (
    `${instant.getFullYear()}-${deux(instant.getMonth() + 1)}-${deux(instant.getDate())}` +
    `T${deux(instant.getHours())}:${deux(instant.getMinutes())}:${deux(instant.getSeconds())}` +
    `${decalage < 0 ? '-' : '+'}${deux(Math.floor(ecart / 60))}:${deux(ecart % 60)}`
  );
}

const parNom = (a, b) => (a.nom < b.nom ? -1 : a.nom > b.nom ? 1 : 0);

/**
 * Vrai quand le processus de ce pid tourne sur ce poste : il répond au
 * signal 0, ou refuse de le recevoir (EPERM) parce qu'il tourne sous un
 * autre utilisateur.
 *
 * @param {number} pid
 * @param {(pid: number) => void} [signaler]  process.kill(pid, 0)
 * @returns {boolean}
 */
export function processusVivant(pid, signaler = (cible) => process.kill(cible, 0)) {
  try {
    signaler(pid);
    return true;
  } catch (erreur) {
    return erreur?.code === 'EPERM';
  }
}

/**
 * Les primitives du système de fichiers, sous Node. Chacune prend les
 * arguments de l'interface, tels que l'IPC les a copiés, et rend sa valeur ou
 * lève : RefusFichier pour un échec que l'interface nomme, TypeError pour un
 * argument de forme fausse.
 *
 * @param {Object} reglages
 * @param {Object} reglages.emplacements  ceux de decrireSysteme
 * @param {{portable: string|null, documents: string}} reglages.racines
 *        chemins absolus des racines du poste
 * @param {Object} reglages.dialog   le module dialog d'Electron
 * @param {Object} reglages.shell    le module shell d'Electron
 * @param {() => Object|null} [reglages.fenetre]  la fenêtre parente des dialogues
 * Le reste remplace le système, pour l'épreuve :
 * @param {Object} [reglages.fs]  lstat, stat, realpath, readFile, open,
 *        rename, unlink, mkdir, readdir, comme ceux de node:fs/promises
 * @param {Object} [reglages.chemins]  node:path, ou l'une de ses variantes
 * @param {string} [reglages.plateforme]  process.platform
 * @param {Function} [reglages.lancer]  (commande, arguments, {variables,
 *        delai}) → la sortie standard de la commande
 * @param {(ms: number) => Promise<void>} [reglages.attendre]
 * @param {(pid: number) => void} [reglages.signaler]  celui de processusVivant
 * @param {(pid: number) => Promise<string|null>} [reglages.demarrage]
 *        l'instant de démarrage d'un processus, null quand il ne se lit pas ;
 *        par défaut, celui que lit la plateforme
 * @param {number} [reglages.pid]
 * @param {string} [reglages.hote]
 * @param {() => Date} [reglages.maintenant]
 * @returns {Object<string, Function>} les primitives, par nom, et
 *          verrousTenus(), qui n'en est pas une
 */
export function creerFichiers({
  emplacements,
  racines: { portable, documents },
  dialog,
  shell,
  fenetre = () => null,
  fs = FS_NODE,
  chemins = path,
  plateforme = process.platform,
  lancer = lancerCommande,
  attendre = pause,
  signaler,
  demarrage,
  pid = process.pid,
  hote = hostname(),
  maintenant = () => new Date(),
}) {
  // Chemin absolu de chaque racine connue, par identifiant. Une Map : un
  // identifiant reçu de la page ne rencontre aucune propriété héritée.
  const bases = new Map([['documents', documents]]);
  if (portable !== null) bases.set('portable', portable);
  let choisis = 0;
  const demarrageDe = demarrage ?? lireDemarrage;
  // Le démarrage du processus courant, lu une fois qu'il est connu.
  let demarrageCourant = null;
  // Les verrous que verrouiller a pris et que deverrouiller n'a pas rendus :
  // chemin absolu → séance, que verrousTenus rend au processus principal.
  const tenus = new Map();

  // Ce que désigne un chemin relatif à une racine : ses segments, sa racine
  // et sa cible en absolu, et le dossier que nomme un échec — celui qui porte
  // la cible, la racine elle-même pour ''. Seul le texte se lit :
  // CHEMIN_REFUSE pour un chemin que la règle des segments refuse ou une
  // racine inconnue.
  function localiser(racine, chemin) {
    const segments = segmentsAdmis(chemin);
    const base = estObjet(racine) && typeof racine.id === 'string' ? bases.get(racine.id) : undefined;
    if (base === undefined) throw new RefusFichier('CHEMIN_REFUSE', { chemin });
    return {
      chemin,
      segments,
      racine: chemins.join(base),
      absolu: chemins.join(base, ...segments),
      dossier: chemins.join(base, ...segments.slice(0, -1)),
    };
  }

  // Un fichier choisi hors des racines, nommé dans un échec par son nom et
  // son dossier.
  const horsRacine = (absolu) => ({ chemin: chemins.basename(absolu), dossier: chemins.dirname(absolu) });

  const refus = (loc, cause) => new RefusFichier('ECRITURE', { chemin: loc.chemin, dossier: loc.dossier, cause });

  // Ce que devient une erreur levée pendant une lecture, ou une écriture :
  // un refus déjà nommé passe tel quel, une faute du code aussi ; une erreur
  // du système devient ABSENT, LECTURE ou ECRITURE.
  function echecLecture(loc, erreur) {
    if (!estErreurSysteme(erreur)) return erreur;
    if (ABSENCE_EN_LECTURE.has(erreur.code)) return new RefusFichier('ABSENT', { chemin: loc.chemin });
    return new RefusFichier('LECTURE', { chemin: loc.chemin, dossier: loc.dossier, cause: erreur.code });
  }

  const echecEcriture = (loc, erreur) => (estErreurSysteme(erreur) ? refus(loc, erreur.code) : erreur);

  // L'état d'un chemin sans suivre son dernier lien, ou null quand il n'existe
  // pas ; l'état de ce qu'il désigne, liens suivis, ou null quand rien n'y
  // mène — absent, lien sans cible, boucle de liens.
  async function etatDe(absolu) {
    try {
      return await fs.lstat(absolu);
    } catch (erreur) {
      if (ABSENCE.has(erreur?.code)) return null;
      throw erreur;
    }
  }

  async function etatSuivi(absolu) {
    try {
      return await fs.stat(absolu);
    } catch (erreur) {
      if (ABSENCE.has(erreur?.code) || erreur?.code === 'ELOOP') return null;
      throw erreur;
    }
  }

  // Efface un fichier, ou le lien lui-même ; un absent n'est pas une faute.
  async function effacer(absolu) {
    try {
      await fs.unlink(absolu);
    } catch (erreur) {
      if (!ABSENCE.has(erreur?.code)) throw erreur;
    }
  }

  // Écrit dans une poignée ouverte, la vide sur le disque et la ferme ; un
  // échec la ferme aussi, puis se lève.
  async function ecrireDans(poignee, donnees) {
    try {
      await poignee.writeFile(donnees);
      await poignee.sync();
    } catch (erreur) {
      await poignee.close().catch(() => {});
      throw erreur;
    }
    await poignee.close();
  }

  // Chemin réel d'un chemin absolu : celui de son plus long préfixe qui
  // existe, liens résolus, suivi des segments qui n'existent pas encore et
  // qu'aucun lien ne peut donc détourner. Rien n'existe, pas même le
  // volume — une clé retirée — : le chemin tel quel. Un lien sans cible, ou
  // qui boucle, n'a pas de chemin réel : null.
  async function cheminReel(absolu) {
    const absents = [];
    let existant = absolu;
    while ((await etatDe(existant)) === null) {
      const parent = chemins.dirname(existant);
      if (parent === existant) return absolu;
      absents.unshift(chemins.basename(existant));
      existant = parent;
    }
    try {
      return chemins.join(await fs.realpath(existant), ...absents);
    } catch (erreur) {
      if (ABSENCE.has(erreur?.code) || erreur?.code === 'ELOOP') return null;
      throw erreur;
    }
  }

  // Vrai quand un chemin est le dossier donné ou se trouve sous lui, sur une
  // frontière de segment ; la racine d'un volume, qui finit par le
  // séparateur, porte tout le volume.
  function estSous(chemin, dossier) {
    return chemin === dossier || chemin.startsWith(dossier.endsWith(chemins.sep) ? dossier : `${dossier}${chemins.sep}`);
  }

  // Lève CHEMIN_REFUSE quand le chemin réel de la cible n'est ni celui de sa
  // racine ni sous lui : un lien, en chemin ou visé, ne fait pas sortir. Les
  // deux chemins réels se résolvent de la même façon, si bien qu'un lien
  // dans le chemin de la racine elle-même ne compte pas.
  async function confiner(loc) {
    const racineReelle = await cheminReel(loc.racine);
    const cibleReelle = await cheminReel(loc.absolu);
    if (racineReelle === null || cibleReelle === null || !estSous(cibleReelle, racineReelle)) {
      throw new RefusFichier('CHEMIN_REFUSE', { chemin: loc.chemin });
    }
  }

  // Rend ce que rend l'opération, et la réessaie sur une cause passagère,
  // après une pause qui double ; une autre cause, ou la dernière erreur des
  // réessais, se lève. L'opération ne doit rien laisser derrière un échec :
  // elle se rejoue entière.
  async function reessayer(operation) {
    let attente = PAUSE_INITIALE_MS;
    for (let essai = 0; ; essai += 1) {
      try {
        return await operation();
      } catch (erreur) {
        if (essai === REESSAIS_PASSAGERS || !CAUSES_PASSAGERES.has(erreur?.code)) throw erreur;
      }
      await attendre(attente);
      attente = Math.min(2 * attente, PAUSE_MAX_MS);
    }
  }

  // L'écriture atomique d'un chemin absolu (§ 8.8) : <cible>.ecriture,
  // effacé s'il reste d'une écriture interrompue — lien compris, que
  // l'effacement ne suit pas —, créé en exclusif, écrit, vidé sur le disque,
  // fermé, puis renommé par-dessus la cible. La cible n'est jamais ouverte :
  // un échec la laisse intacte, et retire le temporaire.
  async function remplacer(absolu, octets) {
    const temporaire = `${absolu}${SUFFIXE_ECRITURE}`;
    await effacer(temporaire);
    const poignee = await fs.open(temporaire, 'wx');
    try {
      await ecrireDans(poignee, octets);
      await reessayer(() => fs.rename(temporaire, absolu));
    } catch (erreur) {
      await effacer(temporaire).catch(() => {});
      throw erreur;
    }
  }

  // L'instant de démarrage d'un processus de ce poste, tel que la plateforme
  // le donne sans module natif : sous Linux le champ 22 de /proc/<pid>/stat,
  // en tops d'horloge depuis l'amorçage ; sous Windows l'heure de création
  // que lit PowerShell ; sous macOS la colonne lstart de ps, en locale C et
  // en temps universel — ps l'écrit sinon dans le fuseau du poste, qui peut
  // changer entre la prise du verrou et sa relecture. Une
  // lecture qui échoue, une sortie de forme fausse ou une autre plateforme
  // rendent null. Un pid réattribué, après un redémarrage, désigne un
  // processus d'un autre démarrage.
  async function lireDemarrage(cible) {
    try {
      if (plateforme === 'linux') {
        const texte = (await fs.readFile(`/proc/${cible}/stat`)).toString('utf8');
        const fin = texte.lastIndexOf(')');
        if (fin < 0) return null;
        const valeur = texte.slice(fin + 1).trim().split(/\s+/)[RANG_DEMARRAGE_STAT];
        return /^\d+$/.test(valeur ?? '') ? valeur : null;
      }
      if (plateforme === 'win32') {
        const sortie = await lancer('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', COMMANDE_DEMARRAGE], {
          variables: { GTT_PID: String(cible) },
          delai: DELAI_SUPPORT_MS,
        });
        const valeur = String(sortie).trim();
        return /^\d+$/.test(valeur) ? valeur : null;
      }
      if (plateforme === 'darwin') {
        const sortie = await lancer('ps', ['-o', 'lstart=', '-p', String(cible)], {
          variables: { LC_ALL: 'C', TZ: 'UTC' },
          delai: DELAI_SUPPORT_MS,
        });
        const valeur = String(sortie).trim();
        return valeur === '' ? null : valeur;
      }
    } catch {
      // Un processus disparu, une commande qui échoue ou dépasse son délai :
      // le démarrage reste inconnu.
    }
    return null;
  }

  // Le démarrage du processus courant ; un inconnu se relit à l'appel
  // suivant, un connu non.
  async function monDemarrage() {
    if (demarrageCourant === null) demarrageCourant = await demarrageDe(pid);
    return demarrageCourant;
  }

  // La vie de la séance d'un verrou de ce poste. Faux seulement quand sa
  // mort est certaine : aucun processus de ce pid ne répond, ou le
  // démarrage inscrit et celui du processus actuel sont connus tous deux et
  // diffèrent — le pid est passé à un autre processus. Vrai quand les deux
  // démarrages sont connus et égaux. Null sinon : un démarrage inconnu d'un
  // côté ou de l'autre ne prouve ni la vie ni la mort, et une séance dite
  // morte à tort perdrait son verrou au profit d'un second écrivain.
  async function seanceVivante(contenu) {
    if (!processusVivant(contenu.pid, signaler)) return false;
    const actuel = contenu.demarrage === null ? null : await demarrageDe(contenu.pid);
    return actuel === null ? null : actuel === contenu.demarrage;
  }

  // Ce que rend verrouiller d'un verrou présent, ou null quand il a disparu
  // depuis. Un verrou qui ne se lit pas rend seance, depuis et vivant à null.
  async function verrouPresent(absolu) {
    let texte;
    try {
      texte = (await fs.readFile(absolu)).toString('utf8');
    } catch (erreur) {
      if (erreur?.code === 'ENOENT') return null;
      throw erreur;
    }
    const contenu = analyserVerrou(texte);
    if (contenu === null) return { pris: false, seance: null, depuis: null, vivant: null };
    return {
      pris: false,
      seance: contenu.seance,
      depuis: contenu.depuis,
      vivant: contenu.hote === hote ? await seanceVivante(contenu) : null,
    };
  }

  // Le type de support du volume qui porte un chemin, sous Windows : le type
  // de lecteur que rend DriveInfo, par PowerShell.
  async function supportWindows(absolu) {
    const sortie = await lancer('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', COMMANDE_LECTEUR], {
      variables: { GTT_RACINE: absolu },
      delai: DELAI_SUPPORT_MS,
    });
    const type = String(sortie).trim();
    return type === 'Removable' ? 'amovible' : type === 'Fixed' ? 'fixe' : 'inconnu';
  }

  // Sous Linux : l'attribut removable du disque qui porte le plus proche
  // dossier existant du chemin. Le numéro du périphérique se décompose comme
  // le fait glibc ; /sys/dev/block/<majeur>:<mineur> mène au périphérique,
  // dont une partition porte le fichier partition et laisse removable à son
  // disque, le dossier parent. Un périphérique que /sys/dev/block ne décrit
  // pas — tmpfs, btrfs, un partage réseau — rejette.
  async function supportLinux(absolu) {
    let existant = absolu;
    while ((await etatSuivi(existant)) === null && chemins.dirname(existant) !== existant) {
      existant = chemins.dirname(existant);
    }
    const { dev } = await fs.stat(existant, { bigint: true });
    const majeur = ((dev >> 8n) & 0xfffn) | ((dev >> 32n) & ~0xfffn);
    const mineur = (dev & 0xffn) | ((dev >> 12n) & 0xffffff00n);
    const peripherique = await fs.realpath(`/sys/dev/block/${majeur}:${mineur}`);
    const disque = (await etatDe(chemins.join(peripherique, 'partition'))) === null
      ? peripherique
      : chemins.dirname(peripherique);
    const attribut = (await fs.readFile(chemins.join(disque, 'removable'))).toString('utf8').trim();
    return attribut === '1' ? 'amovible' : attribut === '0' ? 'fixe' : 'inconnu';
  }

  return {
    async emplacements() {
      return { ...emplacements, donneesApplicatives: [...emplacements.donneesApplicatives] };
    },

    async racines() {
      return {
        portable: portable === null ? null : { id: 'portable', chemin: portable },
        documents: { id: 'documents', chemin: documents },
      };
    },

    // Le dossier choisi devient une racine pour le reste de la séance.
    async choisirDossier() {
      const { canceled, filePaths } = await dialog.showOpenDialog(fenetre(), {
        properties: ['openDirectory', 'createDirectory'],
      });
      if (canceled || filePaths.length === 0) return null;
      choisis += 1;
      const id = `choisi-${choisis}`;
      bases.set(id, filePaths[0]);
      return { id, chemin: filePaths[0] };
    },

    // Crée la racine et ses parents, efface un témoin resté — ou un lien posé
    // sous son nom, que l'effacement ne suit pas —, écrit le témoin en
    // exclusif, le vide sur le disque, le relit et l'efface. Un échec rend sa
    // cause, et le témoin s'efface.
    async sonder(racine) {
      const loc = localiser(racine, '');
      const temoin = chemins.join(loc.absolu, TEMOIN);
      try {
        await fs.mkdir(loc.absolu, { recursive: true });
        await effacer(temoin);
        await ecrireDans(await fs.open(temoin, 'wx'), TEXTE_TEMOIN);
        const relu = (await fs.readFile(temoin)).toString('utf8');
        await fs.unlink(temoin);
        return relu === TEXTE_TEMOIN ? { inscriptible: true, cause: null } : { inscriptible: false, cause: 'RELECTURE' };
      } catch (erreur) {
        if (!estErreurSysteme(erreur)) throw erreur;
        await effacer(temoin).catch(() => {});
        return { inscriptible: false, cause: erreur.code };
      }
    },

    // Windows et Linux savent le dire ; ailleurs, et quand la commande ou
    // /sys ne répondent pas, inconnu.
    async typeSupport(racine) {
      const loc = localiser(racine, '');
      try {
        if (plateforme === 'win32') return await supportWindows(loc.absolu);
        if (plateforme === 'linux') return await supportLinux(loc.absolu);
      } catch {
        // Une commande qui échoue, qui dépasse son délai, ou un périphérique
        // que /sys ne décrit pas : le type reste inconnu.
      }
      return 'inconnu';
    },

    async lireTexte(racine, chemin) {
      const loc = localiser(racine, chemin);
      let octets;
      try {
        await confiner(loc);
        octets = await fs.readFile(loc.absolu);
      } catch (erreur) {
        throw echecLecture(loc, erreur);
      }
      try {
        return UTF8_STRICT.decode(octets);
      } catch {
        const details = { chemin: loc.chemin, dossier: loc.dossier, cause: 'UTF8_INVALIDE' };
        throw new RefusFichier('LECTURE', { ...details, octets: new Uint8Array(octets) });
      }
    },

    // Une cible qui est un dossier est refusée avant d'écrire : le
    // renommage par-dessus un dossier échouerait, sous Windows après ses
    // réessais.
    async ecrireAtomique(racine, chemin, texte) {
      exigerTexte(texte, 'le texte');
      const loc = localiser(racine, chemin);
      try {
        await confiner(loc);
        if ((await etatDe(loc.absolu))?.isDirectory()) throw refus(loc, 'EISDIR');
        await remplacer(loc.absolu, Buffer.from(texte, 'utf8'));
      } catch (erreur) {
        throw echecEcriture(loc, erreur);
      }
    },

    // Ouvre en ajout — le fichier absent se crée, son dossier jamais —,
    // écrit la ligne et sa fin de ligne, vide sur le disque et ferme. Seule
    // l'ouverture se réessaie : une écriture refusée a pu laisser une partie
    // de la ligne, qu'un second essai prolongerait.
    async ajouterLigne(racine, chemin, ligne) {
      exigerLigne(ligne);
      const loc = localiser(racine, chemin);
      try {
        await confiner(loc);
        await ecrireDans(await reessayer(() => fs.open(loc.absolu, 'a')), `${ligne}\n`);
      } catch (erreur) {
        throw echecEcriture(loc, erreur);
      }
    },

    // Les fichiers et les dossiers, liens suivis ; une entrée qui disparaît
    // entre la liste et son état, ou un lien sans cible, ne compte pas.
    async lister(racine, dossier) {
      const loc = localiser(racine, dossier);
      try {
        await confiner(loc);
        const entrees = [];
        for (const nom of await fs.readdir(loc.absolu)) {
          const etat = await etatSuivi(chemins.join(loc.absolu, nom));
          if (etat?.isFile()) entrees.push({ nom, type: 'fichier', taille: etat.size, modifie: etat.mtimeMs });
          else if (etat?.isDirectory()) entrees.push({ nom, type: 'dossier', taille: 0, modifie: etat.mtimeMs });
        }
        return entrees.sort(parNom);
      } catch (erreur) {
        throw echecLecture(loc, erreur);
      }
    },

    // '' crée la racine, parents compris. Un autre chemin se crée dossier par
    // dossier sous la racine, sans recursive : mkdir lève ENOENT quand son
    // parent manque, si bien qu'une racine qui disparaît, même entre deux
    // appels, ne renaît pas (§ 8.6). Un dossier présent passe ; un fichier en
    // travers lève EEXIST sur le chemin même, ENOTDIR au-dessus.
    async creerDossier(racine, chemin) {
      const loc = localiser(racine, chemin);
      const { segments } = loc;
      try {
        await confiner(loc);
        if (segments.length === 0) await fs.mkdir(loc.absolu, { recursive: true });
        for (let rang = 1; rang <= segments.length; rang += 1) {
          const dossier = chemins.join(loc.racine, ...segments.slice(0, rang));
          try {
            await fs.mkdir(dossier);
          } catch (erreur) {
            if (erreur?.code !== 'EEXIST') throw erreur;
            const cause = rang === segments.length ? 'EEXIST' : 'ENOTDIR';
            if (!(await etatSuivi(dossier))?.isDirectory()) throw refus(loc, cause);
          }
        }
      } catch (erreur) {
        throw echecEcriture(loc, erreur);
      }
    },

    // Un fichier. rename écrase une cible existante sous
    // POSIX : sa présence se contrôle d'abord, comme le système compare les
    // noms, si bien que sans égard à la casse une autre casse du même nom
    // est une cible présente. Un dossier absent sous la cible nomme la
    // cible ; un renommage refusé nomme la source.
    async deplacer(racine, de, vers) {
      const source = localiser(racine, de);
      const cible = localiser(racine, vers);
      let etat;
      try {
        await confiner(source);
        etat = await etatDe(source.absolu);
      } catch (erreur) {
        throw echecEcriture(source, erreur);
      }
      if (etat === null) throw new RefusFichier('ABSENT', { chemin: de });
      if (etat.isDirectory()) throw refus(source, 'EISDIR');
      try {
        await confiner(cible);
        if ((await etatDe(cible.absolu)) !== null) throw new RefusFichier('EXISTE', { chemin: vers });
        if (!(await etatSuivi(chemins.dirname(cible.absolu)))?.isDirectory()) throw refus(cible, 'ENOENT');
      } catch (erreur) {
        throw echecEcriture(cible, erreur);
      }
      try {
        await reessayer(() => fs.rename(source.absolu, cible.absolu));
      } catch (erreur) {
        throw echecEcriture(source, erreur);
      }
    },

    async supprimer(racine, chemin) {
      const loc = localiser(racine, chemin);
      try {
        await confiner(loc);
        const etat = await etatDe(loc.absolu);
        if (etat?.isDirectory()) throw refus(loc, 'EISDIR');
        if (etat !== null) await reessayer(() => effacer(loc.absolu));
      } catch (erreur) {
        throw echecEcriture(loc, erreur);
      }
    },

    // Création exclusive (wx), qui ne suit aucun lien, d'un verrou qui
    // inscrit la séance, le pid, l'hôte, l'instant de la prise et le
    // démarrage du processus, lus avant la création : la création et
    // l'écriture se suivent sans attente. Un verrou présent
    // se lit ; s'il disparaît entre la création refusée et sa lecture, la
    // prise se tente une seconde fois. Un verrou écrit à moitié s'efface.
    async verrouiller(racine, chemin, seance) {
      exigerSeance(seance);
      const loc = localiser(racine, chemin);
      try {
        await confiner(loc);
        const demarrageInscrit = await monDemarrage();
        const inscrit = { seance, pid, hote, depuis: horodatage(maintenant()), demarrage: demarrageInscrit };
        const contenu = `${JSON.stringify(inscrit)}\n`;
        for (let essai = 0; ; essai += 1) {
          let poignee;
          try {
            poignee = await fs.open(loc.absolu, 'wx');
          } catch (erreur) {
            if (erreur?.code !== 'EEXIST') throw erreur;
            const present = await verrouPresent(loc.absolu);
            if (present !== null) return present;
            if (essai === 1) throw erreur;
            continue;
          }
          try {
            await ecrireDans(poignee, contenu);
          } catch (erreur) {
            await effacer(loc.absolu).catch(() => {});
            throw erreur;
          }
          tenus.set(loc.absolu, seance);
          return { pris: true };
        }
      } catch (erreur) {
        throw echecEcriture(loc, erreur);
      }
    },

    // N'efface que le verrou que cette séance a pris ; un verrou absent, un
    // dossier à sa place ou un verrou illisible restent tels.
    async deverrouiller(racine, chemin, seance) {
      exigerSeance(seance);
      const loc = localiser(racine, chemin);
      try {
        await confiner(loc);
        let texte;
        try {
          texte = (await fs.readFile(loc.absolu)).toString('utf8');
        } catch (erreur) {
          if (ABSENCE_EN_LECTURE.has(erreur?.code)) {
            tenus.delete(loc.absolu);
            return;
          }
          throw erreur;
        }
        if (analyserVerrou(texte)?.seance === seance) {
          await effacer(loc.absolu);
          tenus.delete(loc.absolu);
        }
      } catch (erreur) {
        throw echecEcriture(loc, erreur);
      }
    },

    // Hors des primitives, que servir ne publie pas : les verrous pris et
    // pas rendus, [{ chemin, seance }], chemin absolu, dans l'ordre de leur
    // prise. Le processus principal les efface à sa sortie.
    verrousTenus() {
      return [...tenus].map(([chemin, seance]) => ({ chemin, seance }));
    },

    // shell.openPath rend '' quand l'explorateur s'ouvre, et sinon la raison
    // de l'échec.
    async ouvrirDansExplorateur(racine) {
      const loc = localiser(racine, '');
      let etat;
      try {
        etat = await etatSuivi(loc.absolu);
      } catch (erreur) {
        throw echecLecture(loc, erreur);
      }
      if (!etat?.isDirectory()) throw new RefusFichier('ABSENT', { chemin: '' });
      const raison = await shell.openPath(loc.absolu);
      if (raison !== '') throw new RefusFichier('NON_DISPONIBLE', { cause: raison });
    },

    async choisirFichierAImporter() {
      const { canceled, filePaths } = await dialog.showOpenDialog(fenetre(), { properties: ['openFile'] });
      if (canceled || filePaths.length === 0) return null;
      const [absolu] = filePaths;
      try {
        return { nom: chemins.basename(absolu), octets: new Uint8Array(await fs.readFile(absolu)) };
      } catch (erreur) {
        throw echecLecture(horsRacine(absolu), erreur);
      }
    },

    // Le dialogue propose le nom, sans ses dossiers, dans les Documents du
    // poste ; le fichier choisi s'écrit par écriture atomique, le dialogue
    // ayant déjà fait confirmer le remplacement d'un existant.
    async enregistrerSous(nomPropose, octets) {
      exigerTexte(nomPropose, 'le nom proposé');
      if (!(octets instanceof Uint8Array)) throw new TypeError('les octets ne sont pas un Uint8Array');
      const { canceled, filePath } = await dialog.showSaveDialog(fenetre(), {
        defaultPath: chemins.join(chemins.dirname(documents), chemins.basename(nomPropose)),
      });
      if (canceled || !filePath) return null;
      try {
        await remplacer(filePath, octets);
      } catch (erreur) {
        throw echecEcriture(horsRacine(filePath), erreur);
      }
      return filePath;
    },
  };
}

/**
 * La réponse d'un appel de primitive, telle qu'elle traverse l'IPC :
 * { ok: true, valeur }, ou { ok: false, code, details } pour un RefusFichier.
 * Toute autre erreur se lève.
 *
 * @param {() => Promise<unknown>} travail
 */
export async function repondre(travail) {
  try {
    return { ok: true, valeur: await travail() };
  } catch (erreur) {
    if (erreur instanceof RefusFichier) return { ok: false, code: erreur.code, details: erreur.details };
    throw erreur;
  }
}

/**
 * Offre les primitives à la page : pour chacune, dans l'ordre de PRIMITIVES,
 * poser(canal, gestionnaire) — ipcMain.handle dans le processus principal.
 * Le gestionnaire reçoit l'évènement d'Electron, puis les arguments de la
 * primitive, et rend sa réponse.
 *
 * @param {Object<string, Function>} fichiers  ce que rend creerFichiers
 * @param {(canal: string, gestionnaire: Function) => void} poser
 */
export function servir(fichiers, poser) {
  for (const primitive of PRIMITIVES) {
    poser(`${PREFIXE_CANAL}${primitive}`, (_evenement, ...parametres) => repondre(() => fichiers[primitive](...parametres)));
  }
}
