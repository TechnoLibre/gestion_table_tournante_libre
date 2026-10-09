// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Système de fichiers d'épreuve (§ 13.4) : la troisième implémentation de
// l'interface de src/stockage/systeme_fichiers.js, en mémoire, injectée par
// les épreuves. Elle simule l'échec de renommage du § 8.8 et les cinq issues
// du § 8.6 — chemin publié par le lanceur portable, dossier sous un
// emplacement de données applicatives, sonde qui échoue, perte
// d'inscriptibilité en cours de séance, support amovible —, et compte ses
// lectures et ses écritures : une épreuve affirme ainsi qu'ouvrir n'écrit
// rien (§ 8.4).
//
// Une instance est un processus. Le disque, une Map, se partage : une
// instance créée sur le disque d'une autre est ce processus redémarré, ou un
// second processus de la même machine, d'une autre quand son hôte diffère.
// Le disque porte les fichiers et les dossiers sous leur chemin absolu, replié
// quand la casse ne compte pas ; à côté de lui, hors de la Map, son horloge et
// sa table des processus. Les pannes et les compteurs sont ceux de l'instance.
//
// Une racine n'existe qu'une fois créée — par sonder, creerDossier de '' ou,
// sans compter, deposerDossier —, et aucune écriture ne crée le dossier qui
// porte sa cible, ni creerDossier d'un autre chemin la racine : l'épreuve voit
// ainsi le dossier de travail qu'aucun code n'a créé, ou qui a disparu, comme
// le verrait la coquille.
import { ErreurStockage } from '../src/stockage/erreurs.js';
import { exigerCheminRelatif, exigerDepuis } from '../src/stockage/systeme_fichiers.js';

/**
 * Levée par chaque primitive d'une instance dont le processus est coupé
 * (pannes.couperApres). Ce n'est pas une ErreurStockage : le stockage ne la
 * traite pas, il meurt avec le processus.
 */
export class PanneSimulee extends Error {
  constructor() {
    super('panne simulée : le processus de cette instance est arrêté');
  }
}
PanneSimulee.prototype.name = 'PanneSimulee';

// Suffixe du fichier qu'écrit l'écriture atomique avant de le renommer
// par-dessus sa cible, et nom du témoin de la sonde (§ 8.6, § 8.8).
const SUFFIXE_ECRITURE = '.ecriture';
const TEMOIN = '.gtt-temoin';

// Réessais d'un renommage refusé après le premier essai, ceux de
// l'implémentation de la coquille, sans ses pauses.
const REESSAIS_RENOMMAGE = 10;

// Horloge d'un disque neuf, en millisecondes depuis l'époque Unix : le
// 1er janvier 2026 à minuit UTC. Chaque fichier ou dossier qu'écrit une
// primitive l'avance d'une seconde, si bien que modifie ne dépend que de la
// suite des écritures. L'instant de prise d'un verrou est celui que
// verrouiller reçoit, et non celui de cette horloge.
const ORIGINE_HORLOGE = Date.UTC(2026, 0, 1);
const PAS_HORLOGE = 1000;

// La taille d'un fichier compte les octets de son texte en UTF-8. Un fichier
// porte un texte, ou les octets que deposerOctets a posés tels quels : ceux-ci
// se décodent strictement, comme la coquille et la plateforme web les
// décodent, la marque d'ordre d'octets gardée dans le texte.
const UTF8 = new TextEncoder();
const UTF8_STRICT = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

// Le texte d'un fichier, ou null quand ses octets ne sont pas de l'UTF-8.
function texteDuNoeud({ texte }) {
  if (typeof texte === 'string') return texte;
  try {
    return UTF8_STRICT.decode(texte);
  } catch {
    return null;
  }
}

// Les octets d'un fichier, copiés.
const octetsDuNoeud = ({ texte }) => (typeof texte === 'string' ? UTF8.encode(texte) : new Uint8Array(texte));

// État de chaque disque, hors de sa Map : la casse et le séparateur de sa
// première instance, son horloge, le prochain pid, et ses processus par pid.
const ETATS_DISQUE = new WeakMap();

function etatDuDisque(disque, insensibleCasse, separateur) {
  const etat = ETATS_DISQUE.get(disque);
  if (etat === undefined) {
    const neuf = { insensibleCasse, separateur, horloge: ORIGINE_HORLOGE, prochainPid: 1, processus: new Map() };
    ETATS_DISQUE.set(disque, neuf);
    return neuf;
  }
  if (etat.insensibleCasse !== insensibleCasse || etat.separateur !== separateur) {
    throw new Error('un disque partagé garde la casse et le séparateur de sa première instance');
  }
  return etat;
}

// Clé d'un chemin quand la casse ne compte pas : chaque caractère vers sa
// majuscule, quand elle tient en un caractère, sans regarder le contexte,
// comme Windows compare deux noms. Un sigma final rejoint ainsi sa
// majuscule, et ß, dont la majuscule s'écrit SS, reste lui-même.
function replier(texte) {
  return Array.from(texte, (caractere) => {
    const majuscule = caractere.toUpperCase();
    return Array.from(majuscule).length === 1 ? majuscule : caractere;
  }).join('');
}

function exigerChaine(valeur, quoi) {
  if (typeof valeur !== 'string') throw new TypeError(`${quoi} n'est pas une chaîne`);
}

function exigerSeance(seance) {
  if (typeof seance !== 'string' || seance === '') throw new TypeError("la séance n'est pas une chaîne non vide");
}

// Un chemin absolu, comme le rend un dialogue de dossier : un lecteur suivi
// d'un séparateur, ou un séparateur en tête.
const CHEMIN_ABSOLU = /^(?:[A-Za-z]:[\\/]|[\\/])/;

// Vrai pour le contenu lu d'un verrou : {seance, pid, hote, depuis}.
const estContenuVerrou = (contenu) =>
  contenu !== null &&
  typeof contenu === 'object' &&
  typeof contenu.seance === 'string' &&
  Number.isInteger(contenu.pid) &&
  typeof contenu.hote === 'string' &&
  typeof contenu.depuis === 'string';

/**
 * Système de fichiers d'épreuve, en mémoire, qui sait tomber en panne.
 * `disque` se partage entre deux instances : une instance « redémarrée » relit
 * ce que l'autre a écrit. Racines : portable dès qu'executable est donné — la
 * règle du dossier de travail décide de s'en servir (§ 8.6) —, et documents.
 *
 * @param {Object} [reglages]
 * @param {Map} [reglages.disque]       une Map neuve, ou le disque d'une autre
 *        instance, dont il faut garder la casse et le séparateur
 * @param {string|null} [reglages.executable]  dossier publié par le lanceur ;
 *        la racine portable est son data/
 * @param {string[]} [reglages.donneesApplicatives]
 * @param {string} [reglages.documents]  chemin de la racine documents
 * @param {'\\'|'/'} [reglages.separateur]
 * @param {boolean} [reglages.insensibleCasse]
 * @param {'electron'|'web'|'epreuve'} [reglages.nature]
 * @param {boolean} [reglages.renommageAtomique]  faux : ecrireAtomique écrit
 *        droit sur la cible, sans fichier .ecriture ni renommage
 * @param {boolean} [reglages.verrouDisponible]   faux : verrouiller rend
 *        { pris: true } sans rien écrire, deverrouiller ne fait rien
 * @param {Object<string, string>} [reglages.sonde]  cause d'échec par racine,
 *        { portable: 'EACCES' } : la sonde de cette racine la rend, et la
 *        racine refuse toute écriture avec elle, comme après pannes.ecriture
 * @param {Object<string, 'amovible'|'fixe'|'inconnu'>} [reglages.support]
 *        ce que rend typeSupport, 'fixe' pour une racine absente de l'objet
 * @param {string} [reglages.hote]  machine du processus ; un verrou d'un autre
 *        hôte rend vivant à null
 * @param {string[]} [reglages.dossiersChoisis]  chemins absolus que rend
 *        choisirDossier — un autre chemin lève TypeError à la création —, un
 *        par appel, dans l'ordre, puis null comme quand
 *        l'opérateur annule : chacun sous l'identifiant choisi-<n>, n compté
 *        depuis 1, et inscrit parmi les racines du système, comme le fait la
 *        coquille (electron/fichiers.js). La racine choisie n'existe qu'une
 *        fois créée ; racines() ne la rend pas
 * @returns {import('../src/stockage/systeme_fichiers.js').SystemeFichiers & Object}
 *   le système, et pour l'épreuve :
 *   - pid, hote : ceux du processus, qu'écrit son verrou ; les pid d'un disque
 *     se suivent, 1, 2, 3…, dans l'ordre de création des instances ;
 *   - pannes.renommage(racineId, n = Infinity, cause = 'EBUSY') : les n
 *     prochains renommages de la racine sont refusés — chaque essai de
 *     l'écriture atomique, qui en fait onze, et deplacer ;
 *   - pannes.ecriture(racineId, cause = 'EROFS') : dès lors, toute primitive
 *     d'écriture de la racine lève ECRITURE, et sa sonde rend la cause ;
 *   - pannes.couperApres(n) : après n primitives d'écriture réussies —
 *     rendues sans lever —, toute primitive lève PanneSimulee : le processus
 *     est mort, la table des processus du disque le dit à ses verrous, et
 *     l'on rouvre par une nouvelle instance sur le même disque ;
 *   - compteurs.ecritures, compteurs.lectures : les appels des primitives
 *     d'écriture (ecrireAtomique, ajouterLigne, creerDossier, deplacer,
 *     supprimer, verrouiller, deverrouiller, sonder) et de lecture (lireTexte,
 *     lister), refusés compris ; les autres ne comptent pas ;
 *   - deposer(racineId, chemin, texte, modifie = l'instant courant) : pose un
 *     fichier, dossiers parents compris, sans compter ni avancer l'horloge ;
 *   - deposerOctets(racineId, chemin, octets, modifie = l'instant courant) :
 *     pose un fichier de ces octets, tels quels, de même ; lireTexte les
 *     décode strictement et lève LECTURE {chemin, dossier, cause:
 *     'UTF8_INVALIDE', octets} quand ils ne sont pas de l'UTF-8, octets en
 *     étant une copie, et un ajout en fin les garde ;
 *   - deposerDossier(racineId, chemin = '') : pose un dossier, parents compris,
 *     de même ;
 *   - contenu(racineId, chemin) : le texte d'un fichier, sans compter ; null
 *     pour un absent ou un dossier ; TypeError pour des octets hors UTF-8 ;
 *   - octets(racineId, chemin) : les octets d'un fichier, sans compter ; null
 *     pour un absent ou un dossier.
 *   deposer, deposerOctets, deposerDossier, contenu et octets servent encore
 *   après une coupure : ils sont les mains de l'épreuve sur le disque, non
 *   celles du processus.
 */
export function creerFichiersSimules({
  disque = new Map(),
  executable = null,
  donneesApplicatives = ['C:\\Users\\Exemple\\AppData\\Roaming', 'C:\\Users\\Exemple\\AppData\\Local'],
  documents = 'C:\\Users\\Exemple\\Documents\\Gestion table tournante Libre',
  separateur = '\\',
  insensibleCasse = true,
  nature = 'epreuve',
  renommageAtomique = true,
  verrouDisponible = true,
  sonde = {},
  support = {},
  hote = 'poste-epreuve',
  dossiersChoisis = [],
} = {}) {
  if (!Array.isArray(dossiersChoisis) || dossiersChoisis.some((chemin) => typeof chemin !== 'string' || !CHEMIN_ABSOLU.test(chemin))) {
    throw new TypeError('dossiersChoisis : un tableau de chemins absolus');
  }
  const etat = etatDuDisque(disque, insensibleCasse, separateur);
  const pid = etat.prochainPid;
  etat.prochainPid += 1;

  // Chemin absolu de chaque racine connue, par identifiant.
  const joindre = (dossier, nom) => (dossier.endsWith(separateur) ? dossier + nom : dossier + separateur + nom);
  const racines = new Map([['documents', documents]]);
  if (executable !== null) racines.set('portable', joindre(executable, 'data'));
  // Les dossiers que le dialogue rendra encore, et le nombre de ceux qu'il a
  // rendus.
  const aChoisir = [...dossiersChoisis];
  let choisis = 0;

  // Cause qui refuse toute écriture d'une racine : celle de sa sonde déclarée,
  // puis celle de pannes.ecriture. Renommages refusés restants d'une racine,
  // et leur cause.
  const refusEcriture = new Map();
  for (const id of racines.keys()) if (Object.hasOwn(sonde, id)) refusEcriture.set(id, sonde[id]);
  const refusRenommage = new Map();

  // Écritures réussies que le processus fait encore avant sa coupure ; null
  // tant que couperApres n'est pas appelé. Le processus meurt à zéro.
  let restantes = null;
  const estMort = () => restantes === 0;
  etat.processus.set(pid, { hote, estMort });

  const compteurs = { ecritures: 0, lectures: 0 };

  const avancer = () => {
    etat.horloge += PAS_HORLOGE;
    return etat.horloge;
  };
  const maintenant = () => etat.horloge;

  // Ce que désigne un chemin relatif à une racine : son chemin absolu en
  // parties, la clé dans le disque de chacun de ses préfixes, sa clé, celle
  // de son parent et celle de la racine, son nom, et le dossier que nomme une
  // ECRITURE — celui qui le porte, ou la racine elle-même pour ''.
  // CHEMIN_REFUSE pour un chemin refusé ou une racine inconnue.
  function localiser(racine, chemin) {
    const segments = exigerCheminRelatif(chemin);
    const base = racines.get(racine?.id);
    if (base === undefined) throw new ErreurStockage('CHEMIN_REFUSE', { chemin });
    const parties = [...base.split(separateur), ...segments];
    const absolu = (n) => parties.slice(0, n).join(separateur);
    const cleDe = (n) => (insensibleCasse ? replier(absolu(n)) : absolu(n));
    const n = parties.length;
    return {
      racine: racine.id,
      chemin,
      parties,
      cleDe,
      cle: cleDe(n),
      cleParent: n > 1 ? cleDe(n - 1) : null,
      cleRacine: cleDe(n - segments.length),
      nom: parties[n - 1],
      dossier: absolu(segments.length > 0 ? n - 1 : n),
    };
  }

  const refus = (loc, cause) => new ErreurStockage('ECRITURE', { chemin: loc.chemin, dossier: loc.dossier, cause });

  function exigerInscriptible(loc) {
    const cause = refusEcriture.get(loc.racine);
    if (cause !== undefined) throw refus(loc, cause);
  }

  function exigerDossierParent(loc) {
    if (disque.get(loc.cleParent)?.type !== 'dossier') throw refus(loc, 'ENOENT');
  }

  function exigerPasDossier(loc) {
    if (disque.get(loc.cle)?.type === 'dossier') throw refus(loc, 'EISDIR');
  }

  // Crée, dans l'ordre, les dossiers des n premières parties du chemin absolu
  // qui manquent, datés par horloge(). Un fichier en travers lève ECRITURE :
  // EEXIST quand il occupe le chemin même, ENOTDIR un dossier parent.
  function creerDossiers(loc, n, horloge) {
    for (let k = 1; k <= n; k += 1) {
      const noeud = disque.get(loc.cleDe(k));
      if (noeud === undefined) {
        disque.set(loc.cleDe(k), {
          nom: loc.parties[k - 1],
          type: 'dossier',
          texte: null,
          modifie: horloge(),
          parent: k > 1 ? loc.cleDe(k - 1) : null,
        });
      } else if (noeud.type !== 'dossier') {
        throw refus(loc, k === loc.parties.length ? 'EEXIST' : 'ENOTDIR');
      }
    }
  }

  // Écrit le texte d'un fichier : un fichier présent garde son nom, un fichier
  // neuf prend celui du chemin.
  function poserFichier(loc, texte, modifie) {
    const present = disque.get(loc.cle);
    disque.set(loc.cle, { nom: present?.nom ?? loc.nom, type: 'fichier', texte, modifie, parent: loc.cleParent });
  }

  // Porte le fichier de la source à la cible, sous le nom de la cible : un
  // renommage par-dessus donne au fichier la casse du nouveau nom.
  function renommer(source, cible) {
    const noeud = disque.get(source.cle);
    disque.delete(source.cle);
    disque.set(cible.cle, { ...noeud, nom: cible.nom, parent: cible.cleParent });
  }

  // Cause du refus du prochain renommage de la racine, ou null ; chaque refus
  // en consomme un.
  function renommageRefuse(racineId) {
    const panne = refusRenommage.get(racineId);
    if (panne === undefined || panne.restants === 0) return null;
    panne.restants -= 1;
    return panne.cause;
  }

  // Ce que rend verrouiller d'un verrou présent, d'après son texte, null pour
  // des octets hors UTF-8 : sa séance, l'instant de sa prise, et vivant —
  // null pour un autre hôte ; pour celui-ci, vrai quand le disque porte un
  // processus de cet hôte sous ce pid, et que ce processus n'est pas coupé.
  // Un verrou qui ne se lit pas rend seance, depuis et vivant à null.
  function verrouPresent(texte) {
    let contenu;
    try {
      contenu = JSON.parse(texte);
    } catch {
      contenu = null;
    }
    if (!estContenuVerrou(contenu)) return { pris: false, seance: null, depuis: null, vivant: null };
    let vivant = null;
    if (contenu.hote === hote) {
      const processus = etat.processus.get(contenu.pid);
      vivant = processus !== undefined && processus.hote === hote && !processus.estMort();
    }
    return { pris: false, seance: contenu.seance, depuis: contenu.depuis, vivant };
  }

  // Une primitive : le processus coupé lève PanneSimulee avant tout ; l'appel
  // compte selon son genre — 'ecritures', 'lectures' ou null ; une primitive
  // d'écriture rendue sans lever rapproche la coupure.
  function primitive(genre, travail) {
    return async (...parametres) => {
      if (estMort()) throw new PanneSimulee();
      if (genre !== null) compteurs[genre] += 1;
      const resultat = travail(...parametres);
      if (genre === 'ecritures' && restantes !== null) restantes -= 1;
      return resultat;
    };
  }

  return {
    nature,
    renommageAtomique,
    verrouDisponible,
    pid,
    hote,

    emplacements: primitive(null, () => ({
      executable,
      donneesApplicatives: [...donneesApplicatives],
      insensibleCasse,
      separateur,
    })),

    racines: primitive(null, () => ({
      portable: racines.has('portable') ? { id: 'portable', chemin: racines.get('portable') } : null,
      documents: { id: 'documents', chemin: documents },
    })),

    // Les dialogues natifs rendent null, comme quand l'opérateur annule ;
    // choisirDossier rend d'abord les dossiersChoisis, chacun inscrit comme
    // racine pour le reste du processus.
    choisirDossier: primitive(null, () => {
      if (aChoisir.length === 0) return null;
      const chemin = aChoisir.shift();
      choisis += 1;
      const id = `choisi-${choisis}`;
      racines.set(id, chemin);
      return { id, chemin };
    }),

    // Le témoin s'écrit par-dessus celui qu'une séance précédente a pu
    // laisser, puis s'efface ; sa relecture ne peut différer de ce qui vient
    // de s'écrire en mémoire. La sonde échoue sur la cause qui refuse
    // l'écriture de la racine, ou sur un fichier qui occupe son chemin.
    sonder: primitive('ecritures', (racine) => {
      const loc = localiser(racine, '');
      const cause = refusEcriture.get(loc.racine);
      if (cause !== undefined) return { inscriptible: false, cause };
      try {
        creerDossiers(loc, loc.parties.length, avancer);
      } catch (erreur) {
        return { inscriptible: false, cause: erreur.details.cause };
      }
      const temoin = localiser(racine, TEMOIN);
      poserFichier(temoin, TEMOIN, avancer());
      disque.delete(temoin.cle);
      return { inscriptible: true, cause: null };
    }),

    typeSupport: primitive(null, (racine) => {
      const { racine: id } = localiser(racine, '');
      return Object.hasOwn(support, id) ? support[id] : 'fixe';
    }),

    // Des octets déposés qui ne sont pas de l'UTF-8 lèvent LECTURE, cause
    // UTF8_INVALIDE, qui en porte une copie : aucun octet ne se remplace en
    // silence par U+FFFD.
    lireTexte: primitive('lectures', (racine, chemin) => {
      const loc = localiser(racine, chemin);
      const noeud = disque.get(loc.cle);
      if (noeud?.type !== 'fichier') throw new ErreurStockage('ABSENT', { chemin });
      const texte = texteDuNoeud(noeud);
      if (texte === null) {
        const octets = octetsDuNoeud(noeud);
        throw new ErreurStockage('LECTURE', { chemin, dossier: loc.dossier, cause: 'UTF8_INVALIDE', octets });
      }
      return texte;
    }),

    ecrireAtomique: primitive('ecritures', (racine, chemin, texte) => {
      exigerChaine(texte, 'le texte');
      const cible = localiser(racine, chemin);
      exigerInscriptible(cible);
      exigerDossierParent(cible);
      exigerPasDossier(cible);
      if (!renommageAtomique) {
        poserFichier(cible, texte, avancer());
        return;
      }
      const ecriture = localiser(racine, chemin + SUFFIXE_ECRITURE);
      poserFichier(ecriture, texte, avancer());
      let cause = null;
      for (let essai = 0; essai <= REESSAIS_RENOMMAGE; essai += 1) {
        cause = renommageRefuse(cible.racine);
        if (cause === null) {
          renommer(ecriture, cible);
          return;
        }
      }
      disque.delete(ecriture.cle);
      throw refus(cible, cause);
    }),

    ajouterLigne: primitive('ecritures', (racine, chemin, ligne) => {
      exigerChaine(ligne, 'la ligne');
      if (/[\r\n]/.test(ligne)) throw new TypeError('la ligne porte une fin de ligne');
      const loc = localiser(racine, chemin);
      exigerInscriptible(loc);
      exigerDossierParent(loc);
      exigerPasDossier(loc);
      const avant = disque.get(loc.cle)?.texte ?? '';
      const ajout = `${ligne}\n`;
      const texte = typeof avant === 'string' ? avant + ajout : new Uint8Array([...avant, ...UTF8.encode(ajout)]);
      poserFichier(loc, texte, avancer());
    }),

    lister: primitive('lectures', (racine, dossier) => {
      const loc = localiser(racine, dossier);
      if (disque.get(loc.cle)?.type !== 'dossier') throw new ErreurStockage('ABSENT', { chemin: dossier });
      const entrees = [];
      for (const noeud of disque.values()) {
        if (noeud.parent !== loc.cle) continue;
        const taille = noeud.type === 'fichier' ? octetsDuNoeud(noeud).length : 0;
        entrees.push({ nom: noeud.nom, type: noeud.type, taille, modifie: noeud.modifie });
      }
      return entrees.sort((a, b) => (a.nom < b.nom ? -1 : a.nom > b.nom ? 1 : 0));
    }),

    // '' crée la racine, parents compris ; un autre chemin ne crée que ce qui
    // manque sous elle, et une racine absente lève ECRITURE, ENOENT.
    creerDossier: primitive('ecritures', (racine, chemin) => {
      const loc = localiser(racine, chemin);
      exigerInscriptible(loc);
      if (chemin !== '' && !disque.has(loc.cleRacine)) throw refus(loc, 'ENOENT');
      creerDossiers(loc, loc.parties.length, avancer);
    }),

    // Un dossier absent sous la cible nomme la cible ; une panne nomme la
    // source, que le renommage n'a pas pu porter.
    deplacer: primitive('ecritures', (racine, de, vers) => {
      const source = localiser(racine, de);
      const cible = localiser(racine, vers);
      exigerInscriptible(source);
      const noeud = disque.get(source.cle);
      if (noeud === undefined) throw new ErreurStockage('ABSENT', { chemin: de });
      if (noeud.type === 'dossier') throw refus(source, 'EISDIR');
      if (disque.has(cible.cle)) throw new ErreurStockage('EXISTE', { chemin: vers });
      exigerDossierParent(cible);
      const cause = renommageRefuse(source.racine);
      if (cause !== null) throw refus(source, cause);
      renommer(source, cible);
    }),

    supprimer: primitive('ecritures', (racine, chemin) => {
      const loc = localiser(racine, chemin);
      exigerInscriptible(loc);
      exigerPasDossier(loc);
      disque.delete(loc.cle);
    }),

    verrouiller: primitive('ecritures', (racine, chemin, seance, depuis) => {
      exigerSeance(seance);
      exigerDepuis(depuis);
      const loc = localiser(racine, chemin);
      if (!verrouDisponible) return { pris: true };
      exigerInscriptible(loc);
      exigerDossierParent(loc);
      exigerPasDossier(loc);
      const present = disque.get(loc.cle);
      if (present !== undefined) return verrouPresent(texteDuNoeud(present));
      poserFichier(loc, `${JSON.stringify({ seance, pid, hote, depuis })}\n`, avancer());
      return { pris: true };
    }),

    deverrouiller: primitive('ecritures', (racine, chemin, seance) => {
      exigerSeance(seance);
      const loc = localiser(racine, chemin);
      if (!verrouDisponible) return;
      exigerInscriptible(loc);
      const present = disque.get(loc.cle);
      if (present?.type === 'fichier' && verrouPresent(texteDuNoeud(present)).seance === seance) disque.delete(loc.cle);
    }),

    ouvrirDansExplorateur: primitive(null, (racine) => {
      localiser(racine, '');
    }),

    choisirFichierAImporter: primitive(null, () => null),

    enregistrerSous: primitive(null, () => null),

    pannes: {
      renommage(racineId, n = Infinity, cause = 'EBUSY') {
        if (n !== Infinity && !(Number.isInteger(n) && n >= 0)) {
          throw new TypeError('pannes.renommage : n est un entier positif ou nul, ou Infinity');
        }
        refusRenommage.set(localiser({ id: racineId }, '').racine, { restants: n, cause });
      },
      ecriture(racineId, cause = 'EROFS') {
        refusEcriture.set(localiser({ id: racineId }, '').racine, cause);
      },
      couperApres(n) {
        if (!(Number.isInteger(n) && n >= 0)) throw new TypeError('pannes.couperApres : n est un entier positif ou nul');
        restantes = n;
      },
    },

    compteurs,

    deposer(racineId, chemin, texte, modifie = maintenant()) {
      exigerChaine(texte, 'le texte');
      const loc = localiser({ id: racineId }, chemin);
      creerDossiers(loc, loc.parties.length - 1, maintenant);
      exigerPasDossier(loc);
      poserFichier(loc, texte, modifie);
    },

    deposerOctets(racineId, chemin, octets, modifie = maintenant()) {
      if (!(octets instanceof Uint8Array)) throw new TypeError("les octets ne sont pas un Uint8Array");
      const loc = localiser({ id: racineId }, chemin);
      creerDossiers(loc, loc.parties.length - 1, maintenant);
      exigerPasDossier(loc);
      poserFichier(loc, new Uint8Array(octets), modifie);
    },

    deposerDossier(racineId, chemin = '') {
      const loc = localiser({ id: racineId }, chemin);
      creerDossiers(loc, loc.parties.length, maintenant);
    },

    contenu(racineId, chemin) {
      const noeud = disque.get(localiser({ id: racineId }, chemin).cle);
      if (noeud?.type !== 'fichier') return null;
      const texte = texteDuNoeud(noeud);
      if (texte === null) throw new TypeError(`contenu : ${chemin} porte des octets hors UTF-8, que rend octets`);
      return texte;
    },

    octets(racineId, chemin) {
      const noeud = disque.get(localiser({ id: racineId }, chemin).cle);
      return noeud?.type === 'fichier' ? octetsDuNoeud(noeud) : null;
    },
  };
}
