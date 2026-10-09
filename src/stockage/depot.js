// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le dépôt des événements (§ 8.1, § 8.2, § 8.4, § 8.6, § 8.8, § 8.9) : lister
// un dossier de travail, créer un événement, l'ouvrir, enregistrer ses gestes,
// nommer ses instants, le reprendre après une panne, l'écrire ailleurs. Chaque
// fonction reçoit le système de fichiers (§ 13.4, § 14.10) ; aucune ne lit
// l'horloge ni un aléa : horodatage et version entrent en paramètre, et les
// libellés, textes figés, viennent de l'appelant (§ 14.6).
//
// Un événement est une paire de fichiers que l'identifiant interne apparie,
// jamais le nom (§ 8.6) : <base>.gtt.json, l'état, et le journal de la même
// base quand il porte cet identifiant, sinon le premier du dossier, par nom,
// qui le porte sans appartenir à sa propre base — dont l'état, ou faute
// d'état lisible le .precedent, porte le même identifiant. Un état copié à la
// main dans le même dossier ne s'apparie donc pas au journal de l'original.
// Un état illisible s'apparie par l'identifiant de son .precedent ; sans
// lui, au journal de sa base, quand aucun état lisible du dossier ne porte
// l'identifiant de ce journal. L'écriture suit la même règle : le journal
// d'un événement dont le journal de la base porte un autre événement s'écrit
// dans celui que son identifiant apparie, et ne se crée sous une base libre
// qu'à défaut. Lister, ouvrir et ouvrir un secours ne font que lire (§ 8.4) :
// ce qu'ils trouvent à réparer, le premier geste le répare.
//
// Un geste écrit le journal d'abord, l'état ensuite (§ 8.2). Le journal reçoit
// une ligne par ajout en fin quand il continue tel quel. Il se réécrit en
// entier, par une écriture atomique, quand il reçoit une entrée de reprise,
// seule ou avant la ligne d'un geste ou d'un jalon, quand sa lecture a écarté
// des lignes, que la lecture suivante ne dépasserait pas, quand il manque, et
// quand il dépasse PLAFOND_ENTREES. Un journal qui a disparu depuis la
// dernière écriture ne reçoit jamais d'ajout, qui commencerait un fichier
// sans sa ligne d'ouverture : il se réécrit en entier, ouverture et entrées
// en mémoire comprises, et l'Ouvert l'annonce, JOURNAL_RECREE. Le correctif
// d'une entrée part de la charge que restitue l'entrée qui la précède dans
// le journal, jamais de la charge ouverte : un correctif appliqué à une autre
// charge que la sienne s'applique sans lever et rend autre chose.
//
// La reprise à l'ouverture (§ 8.8) compare les révisions, jamais la date des
// fichiers (§ 14.10). Un journal en avance d'une entrée sur l'état se
// rattrape en mémoire. Un journal plus en avance, ou en retard, laisse l'état
// tel quel : la première écriture inscrit une entrée de reprise, qui
// restitue la charge ouverte à la suite du journal. La comparaison ne
// rattrape un geste interrompu que si l'état sur le disque porte la révision
// qui précède sa ligne. Quand il en porte une autre — après un rattrapage,
// une reprise, un secours, un état resté non écrit —, le geste pose d'abord
// la reprise, s'il en faut une, puis l'état à la révision de la dernière
// entrée, et seulement ensuite sa ligne : une coupure laisse le journal en
// avance d'une entrée au plus. Un état illisible lève ETAT_ILLISIBLE et nomme
// les secours lisibles, sans jamais ouvrir un événement vide.
//
// Écrire l'événement ailleurs (§ 8.6) pose une paire alignée, comme un
// geste : le journal en mémoire, en entier — suivi de l'entrée de reprise
// quand il finit sur une autre révision que la charge ouverte —, puis l'état
// que restitue sa dernière entrée, à sa révision. Rouvert là-bas,
// l'événement rend la charge écrite sans rien rattraper. Avec un geste, la
// paire porte l'entrée de ce geste à la suite du journal, et sa charge : le
// renommage (§ 8.7) écrit ainsi la paire complète sous le nouveau nom, dans
// le dossier même, sans toucher l'ancienne ni créer le dossier. Son
// .precedent, l'état d'avant le geste, s'écrit avant le journal : la
// nouvelle base appartient à l'événement dès que son journal existe, et
// l'ancienne paire ne s'apparie jamais ce journal.
//
// Un état sur le disque, ou un journal de la base, d'un format plus récent
// que FORMAT garde en lecture seule tout ce qui ouvre l'événement, secours
// compris : rien de ce qu'une construction plus récente a écrit dans l'état
// ou dans le journal de la base ne se remplace (§ 8.8). Un journal de la base
// plus récent, dont ce code ne lit pas l'identifiant, se reconnaît avant tout
// appariement, à l'ouverture comme dans la liste, et son secours se refuse au
// lieu de se dire absent. Un .precedent d'un format plus récent
// ne garde que l'Ouvert que son secours ouvre : un geste parti d'une autre
// ouverture le remplace, comme tout .precedent, quand l'état sur le disque
// se lit.
//
// Un fichier dont les octets ne sont pas de l'UTF-8 — le système de fichiers
// lève LECTURE, cause UTF8_INVALIDE — ne se lit pas, et aucun octet ne s'y
// remplace en silence par U+FFFD. L'état ou le .precedent est illisible,
// raison ENCODAGE : l'état lève ETAT_ILLISIBLE avec ses secours. Le premier
// geste de l'Ouvert d'un secours met cet état dans un dossier daté de la
// corbeille, puis écrit comme pour un état absent : ses octets ne se perdent
// jamais, et le travail reprend sur place. Un journal se décode ligne par
// ligne : la première ligne hors UTF-8 arrête sa lecture comme une ligne
// illisible, elle et les suivantes écartées et comptées, et le premier geste
// le réécrit sans elles ; une coupure au milieu d'un caractère ne gâte que
// la dernière ligne. Le journal de la base dont la ligne d'ouverture n'est
// pas de l'UTF-8 n'est ni lu, ni apparié, ni remplacé : faute d'un autre
// journal que l'identifiant apparie, l'Ouvert l'annonce, JOURNAL_ILLISIBLE,
// et la première écriture pose l'historique sous une base libre, comme pour
// le journal d'un autre événement.
import { canoniser, serialiser } from './canonique.js';
import { FORMAT, analyser } from './document.js';
import { ErreurStockage } from './erreurs.js';
import {
  PLAFOND_ENTREES,
  decoderJournal,
  elaguer,
  estInstantane,
  ligneEntree,
  ligneJalon,
  ligneOuverture,
  lireJournal,
  reconstruire,
  versionDe,
} from './journal.js';
import { DOSSIER_CORBEILLE, SUFFIXES, cleSansCasse, deriverBase, dossierCorbeille } from './noms.js';
import { examiner } from './placements.js';

/**
 * Un événement ouvert. Chaque fonction qui écrit rend l'Ouvert suivant, et ne
 * modifie pas celui qu'elle reçoit.
 *
 * @typedef {Object} Ouvert
 * @property {import('./systeme_fichiers.js').SystemeFichiers} fs
 * @property {import('./systeme_fichiers.js').Racine} racine
 * @property {string} base             base du fichier d'état
 * @property {import('./types.js').Charge} charge   courante, que rend
 *           examiner : propositions fautives écartées, compteur relevé
 * @property {number} revision         révision de la charge courante
 * @property {string} produitVersion   construction qui a produit la charge
 *           courante : en-tête lu, version que le journal note pour sa
 *           révision, ou celle du dernier geste
 * @property {string|null} texteEtat   texte lisible du fichier d'état sur le
 *           disque ; null quand il ne l'est pas, ou qu'il manque
 * @property {number|null} revisionEtat   révision de ce texte, null avec lui :
 *           quand elle n'est pas celle de la dernière entrée du journal, le
 *           geste suivant écrit d'abord l'état à cette entrée
 * @property {import('./journal.js').Journal|null} journal   le journal de
 *           l'événement, lu jusqu'à son dernier instant restituable ; null
 *           quand il n'a aucune entrée à lui
 * @property {string|null} baseJournal  base du fichier du journal, ou de celui
 *           que la prochaine écriture crée ; null quand le fichier de la base
 *           porte un autre événement : la prochaine écriture prend le journal
 *           que l'identifiant de l'événement apparie (apparier), sinon une
 *           base libre que son nom dérive
 * @property {import('./types.js').Charge|null} chargeJournal   charge que
 *           restitue la dernière entrée du journal, d'où part le correctif
 *           de la suivante ; null sans journal
 * @property {boolean} journalAReecrire   le fichier du journal porte des
 *           lignes que la lecture a écartées : la prochaine écriture le
 *           réécrit sans elles
 * @property {boolean} formatPlusRecent   lecture seule (§ 8.8) : l'état sur
 *           le disque, le .precedent qu'un secours ouvre ou le journal de la
 *           base est d'un format plus récent que FORMAT
 * @property {boolean} etatMalEncode   l'état sur le disque, à côté du secours
 *           ouvert, n'est pas de l'UTF-8 : le premier geste le met de côté
 *           dans la corbeille (mettreDeCoteEtatMalEncode) avant d'écrire
 * @property {import('./placements.js').Examen} examen
 * @property {Array<{code: string, details: Object}>} avertissements   dans
 *           cet ordre, chacun au plus une fois : RETENU_FAUTIF {}, un retenu
 *           qui se contredit, ou que l'en-tête annonce et que la charge n'a
 *           pas ; JOURNAL_REPRIS {}, le journal en avance d'une entrée
 *           rattrapé en mémoire ; JOURNAL_EN_AVANCE_DE {n} ou
 *           JOURNAL_INCOMPLET {etat, journal}, le journal qui finit n
 *           révisions après la charge, ou avant elle ; JOURNAL_ECARTEES {n} ;
 *           JOURNAL_RECREE {}, le fichier du journal, disparu depuis
 *           l'écriture précédente, que celle-ci a réécrit en entier ;
 *           JOURNAL_FORMAT_PLUS_RECENT {format}, le journal de la base, d'un
 *           format plus récent, que rien ne lit ni n'écrit ; JOURNAL_ILLISIBLE
 *           {raison: 'ENCODAGE'}, le journal de la base aux octets hors
 *           UTF-8, que rien ne lit ni n'écrit ; JOURNAL_ETRANGER {evenement},
 *           le journal de la base, d'un autre événement, que rien ne lit ;
 *           PROPOSITIONS_FAUTIVES {ids}, par rang, null pour un identifiant
 *           illisible ; PROPOSITIONS_MANQUANTES {n}, le nombre de
 *           propositions que l'en-tête compte sans que la liste les porte ;
 *           DERIVE {ids, retenu}, les
 *           propositions périmées par identifiant, et vrai quand le retenu
 *           l'est (§ 9)
 */

/**
 * Un événement du dossier, tel que lister le résume.
 *
 * Les champs qui viennent de l'état lu — nom, date, etat, participants —
 * valent null quand il ne se lit pas ou qu'il manque. id est celui de l'état
 * lu ; pour un état illisible, celui par lequel il s'apparie
 * (identifiantSansEtat), null quand il n'en a aucun ; pour un journal sans
 * état, l'événement que nomme sa première ligne. Un événement du dossier se
 * reconnaît ainsi à son id, que son état se lise ou non.
 *
 * @typedef {Object} Resume
 * @property {string} base
 * @property {string|null} id
 * @property {string|null} nom
 * @property {string|null} date
 * @property {string|null} etat
 * @property {number|null} participants  exclus compris
 * @property {number} modifie            du fichier d'état, ou du journal sans
 *           état ; pour l'affichage seulement
 * @property {string|null} journal       base du journal apparié
 * @property {string|null} illisible     raison d'un état illisible, ABSENT
 *           pour un journal sans état
 * @property {boolean} doublon           un autre état lisible du dossier porte
 *           le même identifiant
 */

// Suffixes des fichiers d'un événement : une base que l'un d'eux porte dans
// un dossier n'est pas libre.
const SUFFIXES_EVENEMENT = [SUFFIXES.etat, SUFFIXES.precedent, SUFFIXES.journal, SUFFIXES.verrou];

// Deux chaînes, comparées unité UTF-16 par unité.
const comparerTextes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Base d'un nom de fichier qui finit par suffixe, ou null.
const baseDe = (nom, suffixe) => (nom.endsWith(suffixe) ? nom.slice(0, nom.length - suffixe.length) : null);

// Bases que portent les fichiers d'événement d'une liste d'entrées de dossier.
const basesDe = (entrees) =>
  entrees.flatMap(({ nom }) =>
    SUFFIXES_EVENEMENT.map((suffixe) => baseDe(nom, suffixe)).filter((base) => base !== null),
  );

// Bases des fichiers d'une liste d'entrées de dossier dont le nom finit par
// suffixe, dans son ordre.
const basesAuSuffixe = (entrees, suffixe) =>
  entrees
    .filter(({ type }) => type === 'fichier')
    .map(({ nom }) => baseDe(nom, suffixe))
    .filter((base) => base !== null);

// Ce que porte le fichier chemin : { texte, present, octets }. texte est
// null quand il manque, ou quand ses octets ne sont pas de l'UTF-8 (LECTURE,
// cause UTF8_INVALIDE), octets portant alors ceux que le refus rend, null
// sinon ; present ne vaut faux que pour un fichier qui manque. Toute autre
// erreur de lecture remonte telle quelle.
async function lireSiPresent(fs, racine, chemin) {
  try {
    return { texte: await fs.lireTexte(racine, chemin), present: true, octets: null };
  } catch (erreur) {
    if (erreur.code === 'ABSENT') return { texte: null, present: false, octets: null };
    if (erreur.code === 'LECTURE' && erreur.details.cause === 'UTF8_INVALIDE') {
      return { texte: null, present: true, octets: erreur.details.octets };
    }
    throw erreur;
  }
}

// Ce qu'un fichier de journal lu (lireSiPresent) donne à lire : { texte,
// ecartees }. Ses octets hors UTF-8 se décodent ligne par ligne
// (decoderJournal) : texte, les lignes qui précèdent la première qui ne se
// décode pas, null quand c'est l'ouverture, et ecartees, cette ligne et les
// suivantes. Sinon texte est celui du fichier, null quand il manque, et
// ecartees vaut 0.
const journalLisible = ({ texte, octets }) => (octets === null ? { texte, ecartees: 0 } : decoderJournal(octets));

// La lecture d'un journal lisible (journalLisible) : lireJournal de son
// texte, les lignes que le décodage a écartées comptées avec celles que la
// lecture écarte.
function lireLisible({ texte, ecartees }) {
  const lu = lireJournal(texte);
  return { ...lu, ecartees: lu.ecartees + ecartees };
}

// Les détails du refus d'un état ou d'un .precedent dont les octets ne sont
// pas de l'UTF-8, neufs à chaque appel : rien ne s'y désigne.
const malEncode = () => ({ raison: 'ENCODAGE', chemin: null });

// Lecture d'un texte d'état : { lecture } quand l'analyse l'admet, sinon
// { details } de son refus, raison et chemin. analyser ne lève que
// ETAT_ILLISIBLE.
function lireEtat(texte) {
  try {
    return { lecture: analyser(texte), details: null };
  } catch (erreur) {
    return { lecture: null, details: erreur.details };
  }
}

// Ce que l'Ouvert tient de l'état sur le disque, d'après le texte et sa
// lecture (lireEtat), lecture et details null quand il manque : texteEtat et
// revisionEtat quand il se lit, null sinon ; formatPlusRecent quand il vient
// d'un format plus récent, qu'il se lise, réduit, ou que son refus porte ce
// format (analyser). Un tel état garde l'Ouvert en lecture seule, même ouvert
// d'un secours (§ 8.8). etatMalEncode quand ses octets ne sont pas de
// l'UTF-8 : le premier geste parti d'un secours le range d'abord dans la
// corbeille datée (mettreDeCoteEtatMalEncode), puis pose l'état.
function surDisque(texte, { lecture, details }) {
  if (lecture !== null) {
    return {
      texteEtat: texte,
      revisionEtat: lecture.entete.revision,
      formatPlusRecent: lecture.formatPlusRecent,
      etatMalEncode: false,
    };
  }
  return {
    texteEtat: null,
    revisionEtat: null,
    formatPlusRecent: (details?.format ?? FORMAT) > FORMAT,
    etatMalEncode: details?.raison === 'ENCODAGE',
  };
}

// Le texte d'état, que l'analyse doit relire : un état que ce module écrit se
// rouvre toujours. Une charge qu'elle refuserait lève TypeError, avant toute
// écriture.
function relisible(texte, fonction) {
  const { details } = lireEtat(texte);
  if (details !== null) {
    throw new TypeError(`${fonction} : l'état ne se relirait pas, ${details.raison} ${details.chemin}`);
  }
  return texte;
}

// Événement que nomme la première ligne d'un texte de journal, null quand le
// texte manque ou que cette ligne ne se lit pas : la lecture du journal
// réduite à cette ligne.
const evenementDe = (texte) => (texte === null ? null : lireJournal(texte.slice(0, texte.indexOf('\n') + 1)).evenement);

// Format que déclare la première ligne d'un texte de journal quand c'est un
// entier plus grand que FORMAT, null sinon. lireJournal refuse une telle
// ouverture comme toute ligne illisible ; son format dit qu'elle vient d'une
// construction plus récente, dont le journal ne se remplace pas (§ 8.8). Une
// première ligne sans fin de ligne, qui n'est pas du JSON, ou dont la valeur
// est null, ne déclare rien.
function formatPlusRecentDe(texte) {
  let format;
  try {
    format = JSON.parse(texte.slice(0, texte.indexOf('\n') + 1).replace(/^\u{FEFF}/u, '')).format;
  } catch {
    return null;
  }
  return Number.isSafeInteger(format) && format > FORMAT ? format : null;
}

/**
 * Bases que portent les fichiers d'événement — état, .precedent, journal,
 * verrou — à la racine de racine, dans l'ordre de sa liste, sans rien
 * écrire : une base que l'un d'eux porte n'est pas libre (deriverBase). Une
 * base revient une fois par fichier qui la porte.
 *
 * @param {import('./systeme_fichiers.js').SystemeFichiers} fs
 * @param {import('./systeme_fichiers.js').Racine} racine
 * @returns {Promise<string[]>}
 * @throws {ErreurStockage} ABSENT quand la racine n'existe pas
 */
export async function basesPrises(fs, racine) {
  return basesDe(await fs.lister(racine, ''));
}

// Base que prend l'événement nommé nom dans racine (deriverBase) : aucune des
// bases d'autres, ni de celles que portent les fichiers du dossier, à la casse
// près.
async function deriver(fs, racine, nom, autres) {
  const { separateur } = await fs.emplacements();
  const existantes = [...autres, ...(await basesPrises(fs, racine))];
  return deriverBase(nom, { racine: racine.chemin, separateur, existantes });
}

// Les fichiers de racine tels qu'une lecture les trouve : la liste du
// dossier, ce que chaque journal donne à lire (journalLisible), la présence
// de chaque fichier, et la lecture de chaque texte d'état ou de .precedent
// (lireEtat), chacun lu une fois, à la demande ; toute erreur de lecture
// autre qu'un absent ou des octets hors UTF-8 remonte telle quelle. Les
// décisions d'appariement d'une même opération se prennent ainsi sur les
// mêmes fichiers, sans relire un journal. Une vue ne voit pas ce qui s'écrit
// après sa lecture : chaque ouverture en prend une, et l'écriture qui cherche
// le journal d'un événement en prend une neuve (baseCherchee).
function vueDe(fs, racine) {
  let entrees = null;
  const fichiers = new Map();
  const lectures = new Map();
  const fichier = async (chemin) => {
    if (!fichiers.has(chemin)) fichiers.set(chemin, await lireSiPresent(fs, racine, chemin));
    return fichiers.get(chemin);
  };
  return {
    entrees: async () => {
      entrees ??= await fs.lister(racine, '');
      return entrees;
    },
    // { texte, ecartees } du journal chemin (journalLisible).
    journal: async (chemin) => journalLisible(await fichier(chemin)),
    // Vrai quand le fichier existe, que ses octets soient de l'UTF-8 ou non.
    present: async (chemin) => (await fichier(chemin)).present,
    // { texte, lecture, details } d'un fichier d'état ou d'un .precedent :
    // les trois null quand il manque ; texte et lecture null, details
    // {raison: 'ENCODAGE', chemin: null}, quand ses octets ne sont pas de
    // l'UTF-8.
    lecture: async (chemin) => {
      if (!lectures.has(chemin)) {
        const { texte, present } = await fichier(chemin);
        const illisible = { texte: null, lecture: null, details: present ? malEncode() : null };
        lectures.set(chemin, texte === null ? illisible : { texte, ...lireEtat(texte) });
      }
      return lectures.get(chemin);
    },
  };
}

// L'événement auquel appartient base dans le dossier de la vue : celui que
// porte son état quand il se lit, sinon son .precedent quand il se lit ; null
// sinon. Le journal de base qui porte cet événement est le sien, et ne
// s'apparie à aucune autre base (apparier).
async function proprietaire(vue, base) {
  const { lecture } = await vue.lecture(base + SUFFIXES.etat);
  const lue = lecture ?? (await vue.lecture(base + SUFFIXES.precedent)).lecture;
  return lue?.charge.evenement.id ?? null;
}

// Le journal de l'événement id pour base, dans le dossier de la vue (§ 8.6) :
// { base, texte, ecartees } (journalLisible) du journal de base quand sa
// première ligne nomme id ; sinon du premier journal du dossier, par nom,
// qui le nomme et n'appartient pas à sa propre base (proprietaire) ; null
// quand aucun ne s'apparie. Un
// journal renommé à la main, ou créé sous une base dérivée quand celui de la
// base portait un autre événement, n'a ni état ni .precedent à sa base : il
// s'apparie. Le journal d'un original reste à l'original, et un état copié à
// la main dans le même dossier ne le prend pas. C'est la seule règle
// d'appariement : lister, ouvrir, ouvrir un secours et l'écriture d'un
// journal sans base la suivent, après la préséance du journal de la base
// d'un format plus récent (formatDuJournalDeBase).
async function apparier(vue, base, id) {
  const journal = await vue.journal(base + SUFFIXES.journal);
  if (evenementDe(journal.texte) === id) return { base, ...journal };
  for (const autre of basesAuSuffixe(await vue.entrees(), SUFFIXES.journal)) {
    const journalAutre = await vue.journal(autre + SUFFIXES.journal);
    if (evenementDe(journalAutre.texte) === id && (await proprietaire(vue, autre)) !== id) {
      return { base: autre, ...journalAutre };
    }
  }
  return null;
}

// Identifiants que portent les états lisibles du dossier de la vue, un par
// état, dans l'ordre des noms : le même deux fois, l'événement est en double.
async function identifiantsLisibles(vue) {
  const identifiants = [];
  for (const base of basesAuSuffixe(await vue.entrees(), SUFFIXES.etat)) {
    const { lecture } = await vue.lecture(base + SUFFIXES.etat);
    if (lecture !== null) identifiants.push(lecture.charge.evenement.id);
  }
  return identifiants;
}

// L'identifiant par lequel une base dont l'état ne se lit pas, ou manque,
// s'apparie à un journal (§ 8.6) : celui de son .precedent quand il se lit ;
// sinon celui que nomme la première ligne du journal de la base, quand aucun
// état lisible du dossier ne le porte ; null sinon. Un état lisible de cet
// identifiant passe avant un état qui ne dit pas le sien, et un journal sans
// identifiant lisible n'apparie rien : l'état illisible ne s'apparie jamais
// par le seul nom.
async function identifiantSansEtat(vue, base) {
  const { lecture } = await vue.lecture(base + SUFFIXES.precedent);
  if (lecture !== null) return lecture.charge.evenement.id;
  const id = evenementDe((await vue.journal(base + SUFFIXES.journal)).texte);
  if (id === null || (await identifiantsLisibles(vue)).includes(id)) return null;
  return id;
}

// Le format plus récent que FORMAT que déclare le journal de base dans le
// dossier de la vue, null quand il manque ou n'en déclare pas. Un tel journal
// passe avant tout appariement, à l'ouverture (journalDe) comme dans la liste
// (lister) : son identifiant ne se lit pas, et il reste celui de la base.
async function formatDuJournalDeBase(vue, base) {
  const { texte } = await vue.journal(base + SUFFIXES.journal);
  return texte === null ? null : formatPlusRecentDe(texte);
}

// Le journal de l'événement id pour base, dans le dossier de la vue (§ 8.6) :
// lu, sa base, etranger, l'événement que porte le journal de la base quand
// aucun ne s'apparie et qu'il en nomme un autre, format, et malEncode, vrai
// quand aucun ne s'apparie et que la ligne d'ouverture du journal de la base
// n'est pas de l'UTF-8 — une ligne suivante qui ne l'est pas s'écarte
// seulement : lu et base valent alors null, comme pour un journal étranger,
// que rien ne lit ni ne remplace. Le journal de la
// base qui déclare un format plus récent que FORMAT se reconnaît d'abord,
// avant tout appariement, puisque son identifiant ne se lit pas : lu vaut
// null et format le nomme, ce qui garde l'Ouvert en lecture seule, même
// quand une copie au format courant porte id ailleurs dans le dossier ; rien
// ne le lit ni ne le remplace (§ 8.8). Sinon, c'est le journal qu'apparie
// apparier, aucun quand id est null. Faute de lui, le journal de la base
// reste le sien quand il manque ou que sa première ligne ne se lit pas, une
// écriture le remplaçant. Quand il nomme un autre événement, lu et base
// valent null : rien ne le lit ni ne l'écrit, et l'écriture cherche le
// journal de l'événement (baseCherchee).
async function journalDe(vue, base, id) {
  const aucun = { lu: null, base: null, etranger: null, format: null, malEncode: false };
  const format = await formatDuJournalDeBase(vue, base);
  if (format !== null) return { ...aucun, base, format };
  const chemin = base + SUFFIXES.journal;
  const journal = await vue.journal(chemin);
  const apparie = id === null ? null : await apparier(vue, base, id);
  if (apparie !== null) return { ...aucun, lu: lireLisible(apparie), base: apparie.base };
  if (journal.texte === null && (await vue.present(chemin))) return { ...aucun, malEncode: true };
  if (id === null) return aucun;
  const etranger = evenementDe(journal.texte);
  if (etranger !== null) return { ...aucun, etranger };
  return { ...aucun, lu: journal.texte === null ? null : lireLisible(journal), base };
}

// Le journal d'une base dont l'état ne se lit pas, ou manque : journalDe
// pour l'identifiant que rend identifiantSansEtat, null compris. Le journal
// de la base d'un format plus récent s'y reconnaît sans identifiant.
async function journalSansEtat(vue, base) {
  return journalDe(vue, base, await identifiantSansEtat(vue, base));
}

// Le dernier instant restituable d'un journal lu qui a des entrées : la
// charge de sa dernière entrée ou, quand un correctif ne s'applique pas, de
// la dernière entrée qui le précède (§ 8.6). Les entrées qui suivent cet
// instant et leurs jalons s'écartent et se comptent, comme la lecture compte
// les lignes qu'elle écarte : le journal rendu finit sur lui. La première
// entrée porte un instantané, qui se restitue toujours : la recherche
// s'arrête au plus tard sur elle. Rend null pour un journal absent ou sans
// entrée.
function instantDe(lu) {
  if (lu === null || lu.entrees.length === 0) return null;
  for (let rang = lu.entrees.length - 1; ; rang -= 1) {
    const { revision } = lu.entrees[rang];
    let charge;
    try {
      charge = reconstruire(lu, revision);
    } catch {
      // Un correctif ne s'applique pas : l'entrée qui précède.
      continue;
    }
    const entrees = lu.entrees.slice(0, rang + 1);
    const jalons = lu.jalons.filter((jalon) => jalon.revision <= revision);
    const ecartees = lu.ecartees + lu.entrees.length - entrees.length + lu.jalons.length - jalons.length;
    return { journal: { ...lu, entrees, jalons, ecartees }, charge, revision };
  }
}

// Ce qu'une lecture d'état — l'état ou le .precedent — apporte à l'Ouvert,
// avec ce qu'il tient de l'état sur le disque (surDisque) : la lecture seule
// de l'un ou de l'autre, et ce que l'en-tête annonce sans que la charge le
// porte (manquants).
const depuisLecture = ({ entete, charge, formatPlusRecent, manquants }, disque) => ({
  charge,
  revision: entete.revision,
  produitVersion: entete.produitVersion,
  manquants,
  ...disque,
  formatPlusRecent: formatPlusRecent || disque.formatPlusRecent,
});

// Une charge qui ne vient pas d'une lecture d'état ne manque de rien.
const AUCUN_MANQUANT = Object.freeze({ propositions: 0, retenu: false });

// Les avertissements d'un Ouvert, dans l'ordre que décrit le type Ouvert.
// derniere est la révision de la dernière entrée du journal, celle de la
// charge quand il n'y en a pas. Les propositions que l'en-tête compte sans
// que la liste les porte s'annoncent par leur seul nombre, que rien ne
// borne : aucune liste de cette taille ne se construit. Un retenu annoncé
// absent s'annonce comme un retenu fautif.
function avertir({ examen, journal, revision, rattrape, ecartees, recree, format, malEncode, etranger, manquants }) {
  const avertissements = [];
  const ajouter = (code, details = {}) => avertissements.push({ code, details });
  if (examen.retenu.fautes.length > 0 || manquants.retenu) ajouter('RETENU_FAUTIF');
  if (rattrape) ajouter('JOURNAL_REPRIS');
  const derniere = journal === null ? revision : journal.entrees.at(-1).revision;
  if (derniere > revision) ajouter('JOURNAL_EN_AVANCE_DE', { n: derniere - revision });
  if (derniere < revision) ajouter('JOURNAL_INCOMPLET', { etat: revision, journal: derniere });
  if (ecartees > 0) ajouter('JOURNAL_ECARTEES', { n: ecartees });
  if (recree) ajouter('JOURNAL_RECREE');
  if (format !== null) ajouter('JOURNAL_FORMAT_PLUS_RECENT', { format });
  if (malEncode) ajouter('JOURNAL_ILLISIBLE', { raison: 'ENCODAGE' });
  if (etranger !== null) ajouter('JOURNAL_ETRANGER', { evenement: etranger });
  if (examen.fautives.length > 0) ajouter('PROPOSITIONS_FAUTIVES', { ids: examen.fautives.map(({ id }) => id) });
  if (manquants.propositions > 0) ajouter('PROPOSITIONS_MANQUANTES', { n: manquants.propositions });
  const retenu = examen.retenu.raisons.length > 0;
  if (examen.derives.length > 0 || retenu) ajouter('DERIVE', { ids: examen.derives.map(({ id }) => id), retenu });
  return avertissements;
}

/**
 * La règle du rattrapage d'un journal en avance (§ 8.8), pure : le dernier
 * instant restituable du journal apparié, quand sa révision suit d'une seule
 * celle de l'état, donne la charge, canonisée, la révision et la version de
 * l'état rattrapé en mémoire, et ce que l'en-tête de l'état annonce sans que
 * sa charge le porte ne compte plus. Sinon l'état reste tel quel. Rien ne
 * s'écrit : l'ouverture la suit, et le premier geste réécrit l'état.
 *
 * @param {{charge: Object, revision: number, produitVersion: string, manquants: Object}} etat
 * @param {{charge: Object, revision: number, journal: Object}|null} instant
 *        le dernier instant restituable du journal, null sans journal
 * @returns {{charge: Object, revision: number, produitVersion: string, manquants: Object, rattrape: boolean}}
 */
export function rattraper(etat, instant) {
  const { charge, revision, produitVersion, manquants } = etat;
  if (instant === null || instant.revision !== revision + 1) return { charge, revision, produitVersion, manquants, rattrape: false };
  return {
    charge: canoniser(instant.charge),
    revision: instant.revision,
    produitVersion: versionDe(instant.journal, instant.revision),
    manquants: AUCUN_MANQUANT,
    rattrape: true,
  };
}

// L'Ouvert d'une source — état, .precedent ou instant du journal — et du
// journal trouvé pour elle. avecRattrapage : la source suit la règle de
// rattraper. La source d'un format plus récent, ou un journal d'un format
// plus récent, gardent l'Ouvert en lecture seule.
function assembler({ fs, racine, base, source, trouve, instant, avecRattrapage }) {
  const lu = avecRattrapage ? rattraper(source, instant) : { ...source, rattrape: false };
  const { charge, revision, produitVersion, manquants, rattrape } = lu;
  const journal = instant?.journal ?? null;
  const ecartees = journal?.ecartees ?? trouve.lu?.ecartees ?? 0;
  const examen = examiner(charge);
  return {
    fs,
    racine,
    base,
    charge: examen.charge,
    revision,
    produitVersion,
    texteEtat: source.texteEtat,
    revisionEtat: source.revisionEtat,
    journal,
    baseJournal: trouve.base,
    chargeJournal: instant?.charge ?? null,
    journalAReecrire: journal !== null && ecartees > 0,
    formatPlusRecent: source.formatPlusRecent || trouve.format !== null,
    etatMalEncode: source.etatMalEncode,
    examen,
    avertissements: avertir({
      examen,
      journal,
      revision,
      rattrape,
      ecartees,
      recree: false,
      format: trouve.format,
      malEncode: trouve.malEncode,
      etranger: trouve.etranger,
      manquants,
    }),
  };
}

// L'erreur d'un état qui ne s'ouvre pas : ETAT_ILLISIBLE, que details décrit
// — raison, chemin, format —, complété de la base, du format du journal de la
// base quand il est plus récent et que details n'en nomme pas, et des
// secours lisibles : la révision du .precedent et le dernier instant du
// journal que l'identifiant apparie (journalSansEtat), jamais un journal
// pris par son seul nom ; ABSENT quand ni l'état, ni le .precedent, ni le
// journal de la base n'existent — un fichier aux octets hors UTF-8 existe.
async function refuser(vue, base, details) {
  const precedent = await vue.lecture(base + SUFFIXES.precedent);
  const existe = async (suffixe) => vue.present(base + suffixe);
  if (details.raison === 'ABSENT' && !(await existe(SUFFIXES.precedent)) && !(await existe(SUFFIXES.journal))) {
    return new ErreurStockage('ABSENT', { chemin: base + SUFFIXES.etat });
  }
  const trouve = await journalSansEtat(vue, base);
  const format = details.format ?? trouve.format;
  const secours = {
    precedent: precedent.lecture?.entete.revision ?? null,
    journal: instantDe(trouve.lu)?.revision ?? null,
  };
  return new ErreurStockage('ETAT_ILLISIBLE', { base, ...details, ...(format === null ? {} : { format }), secours });
}

/**
 * Événements de racine (§ 8.1, § 8.6), sans rien écrire : un résumé par
 * fichier d'état, lisible ou non, et par journal sans état. Un état
 * s'apparie à son journal par l'identifiant, jamais par le seul nom
 * (apparier) : celui de l'état quand il se lit ; pour un état illisible,
 * celui de son .precedent, ou de son journal quand aucun état lisible ne le
 * porte (identifiantSansEtat). Un journal renommé à la main reste apparié ;
 * le journal d'un original ne s'apparie pas à sa copie faite à la main. Un
 * journal sans état dans sa base se résume quand aucun état ne se l'apparie
 * et qu'aucun état lisible ne porte son identifiant, illisible ABSENT ; il
 * ne se montre pas sinon : une copie d'un journal apparié, ou le journal
 * qu'un état illisible s'apparie par son .precedent. Un identifiant que
 * portent deux états lisibles les signale doublon ; le résumé d'un état
 * illisible porte en id celui qui l'apparie, sans le compter en doublon.
 * Résumés triés par nom, les noms inconnus après les autres, puis par base,
 * unités UTF-16 comparées.
 *
 * @param {import('./systeme_fichiers.js').SystemeFichiers} fs
 * @param {import('./systeme_fichiers.js').Racine} racine
 * @returns {Promise<Resume[]>}
 */
export async function lister(fs, racine) {
  const vue = vueDe(fs, racine);
  const fichiers = (await vue.entrees()).filter(({ type }) => type === 'fichier');
  const identifiants = await identifiantsLisibles(vue);
  const sansLecture = (base, id, modifie, journal, illisible) => ({
    base,
    id,
    nom: null,
    date: null,
    etat: null,
    participants: null,
    modifie,
    journal,
    illisible,
    doublon: false,
  });
  const apparies = new Set();
  const resumes = [];
  for (const { nom, modifie } of fichiers) {
    const base = baseDe(nom, SUFFIXES.etat);
    if (base === null) continue;
    const { lecture, details } = await vue.lecture(nom);
    const id = lecture === null ? await identifiantSansEtat(vue, base) : lecture.charge.evenement.id;
    let journal = null;
    if ((await formatDuJournalDeBase(vue, base)) !== null) journal = base;
    else if (id !== null) journal = (await apparier(vue, base, id))?.base ?? null;
    if (journal !== null) apparies.add(journal);
    if (lecture === null) {
      resumes.push(sansLecture(base, id, modifie, journal, details.raison));
      continue;
    }
    const { evenement, participants } = lecture.charge;
    resumes.push({
      base,
      id: evenement.id,
      nom: evenement.nom,
      date: evenement.date,
      etat: evenement.etat,
      participants: participants.length,
      modifie,
      journal,
      illisible: null,
      doublon: identifiants.indexOf(evenement.id) !== identifiants.lastIndexOf(evenement.id),
    });
  }
  const basesDesEtats = new Set(basesAuSuffixe(fichiers, SUFFIXES.etat));
  for (const { nom, modifie } of fichiers) {
    const base = baseDe(nom, SUFFIXES.journal);
    if (base === null || basesDesEtats.has(base) || apparies.has(base)) continue;
    const evenement = evenementDe((await vue.journal(nom)).texte);
    if (!identifiants.includes(evenement)) resumes.push(sansLecture(base, evenement, modifie, base, 'ABSENT'));
  }
  const nomsConnus = (a, b) => (a === null) - (b === null) || comparerTextes(a ?? '', b ?? '');
  return resumes.sort((a, b) => nomsConnus(a.nom, b.nom) || comparerTextes(a.base, b.base));
}

/**
 * Ouvre l'événement de base dans racine, sans rien écrire (§ 8.4, § 8.8) :
 * la charge de son état, examinée (examiner), et son journal, apparié par
 * l'identifiant. Un journal en avance d'une entrée donne sa charge, rattrapée
 * en mémoire, JOURNAL_REPRIS ; l'état se réécrira au premier geste. Un journal
 * plus en avance ou en retard laisse la charge de l'état, et le premier geste
 * inscrit une entrée de reprise. Une proposition fautive s'écarte et se
 * nomme ; une périmée se garde et se signale ; un retenu fautif se garde et
 * se signale en premier (§ 8.9). Un format plus récent s'ouvre en lecture
 * seule ; un format plus ancien se lit, et ne se convertit qu'au premier
 * geste. Le journal de la base d'un format plus récent ne se lit pas, et
 * garde l'Ouvert en lecture seule, JOURNAL_FORMAT_PLUS_RECENT, même quand une
 * copie au format courant porte l'identifiant ailleurs dans le dossier.
 *
 * @param {import('./systeme_fichiers.js').SystemeFichiers} fs
 * @param {import('./systeme_fichiers.js').Racine} racine
 * @param {string} base
 * @returns {Promise<Ouvert>}
 * @throws {ErreurStockage} ETAT_ILLISIBLE {base, raison, chemin, [format],
 *         secours} : l'état ne se lit pas — raison ENCODAGE pour des octets
 *         hors UTF-8 —, ou manque à côté de son .precedent ou de son
 *         journal, fût-il aux octets hors UTF-8 (raison ABSENT) ; format est
 *         celui de l'état quand son refus en nomme un, sinon celui du journal de la base
 *         quand il est plus récent ; secours nomme la révision lisible du
 *         .precedent et le dernier instant du journal que l'identifiant du
 *         .precedent apparie — ou, sans .precedent lisible, celui du journal
 *         de la base qu'aucun état lisible ne porte —, null pour ce qui ne se
 *         lit pas ou ne s'apparie pas. ABSENT {chemin} quand aucun fichier de
 *         l'événement n'existe
 */
export async function ouvrir(fs, racine, base) {
  const vue = vueDe(fs, racine);
  const etat = await vue.lecture(base + SUFFIXES.etat);
  if (etat.lecture === null) throw await refuser(vue, base, etat.details ?? { raison: 'ABSENT', chemin: null });
  const trouve = await journalDe(vue, base, etat.lecture.charge.evenement.id);
  const source = depuisLecture(etat.lecture, surDisque(etat.texte, etat));
  return assembler({ fs, racine, base, source, trouve, instant: instantDe(trouve.lu), avecRattrapage: true });
}

/**
 * Ouvre l'événement de base depuis un secours, sans rien écrire (§ 8.8) :
 * source 'precedent', la charge du .precedent, que le journal de son
 * identifiant suit sans être rattrapé ; source 'journal', le dernier instant
 * restituable du journal, apparié par l'identifiant de l'état quand il se lit,
 * sinon par celui du .precedent, et sans .precedent lisible, le journal de
 * la base quand aucun état lisible du dossier ne porte son identifiant
 * (journalSansEtat) : jamais un journal pris par son seul nom, ni celui d'un
 * autre événement. texteEtat est le texte de l'état quand il se lit : le
 * premier geste le met au .precedent, et ne met jamais un état illisible.
 * L'état sur le disque d'un format plus récent, qu'il se lise ou non, garde
 * le secours en lecture seule, comme un journal de la base d'un format plus
 * récent : aucun geste de ce secours ne remplace l'état ou le journal qu'une
 * construction plus récente a écrits (§ 8.8). Un .precedent d'un format plus
 * récent garde en lecture seule le secours 'precedent', qui le lit, et non le
 * secours 'journal'. Un journal plus récent ne s'ouvre pas en secours, et ne
 * se dit pas absent : il existe, et ce code ne le lit pas.
 *
 * @param {import('./systeme_fichiers.js').SystemeFichiers} fs
 * @param {import('./systeme_fichiers.js').Racine} racine
 * @param {string} base
 * @param {'precedent'|'journal'} source
 * @returns {Promise<Ouvert>}
 * @throws {ErreurStockage} ABSENT {chemin} : le .precedent manque, ou aucun
 *         journal ne s'apparie, ou il n'a aucune entrée, chemin nommant alors
 *         le journal de la base ; ETAT_ILLISIBLE {raison, chemin, [format]} :
 *         celui de l'analyse d'un .precedent illisible, raison ENCODAGE et
 *         chemin null pour des octets hors UTF-8, ou, source 'journal',
 *         {raison: 'FORMAT_PLUS_RECENT', chemin: le journal de la base,
 *         format} quand ce journal est d'un format plus récent, {raison:
 *         'ENCODAGE', chemin: le journal de la base} quand sa ligne
 *         d'ouverture n'est pas de l'UTF-8 et qu'aucun autre ne s'apparie
 * @throws {RangeError} une autre source
 */
export async function ouvrirSecours(fs, racine, base, source) {
  if (source !== 'precedent' && source !== 'journal') {
    throw new RangeError(`ouvrirSecours : source precedent ou journal attendue, reçu ${JSON.stringify(source)}`);
  }
  const vue = vueDe(fs, racine);
  const etat = await vue.lecture(base + SUFFIXES.etat);
  const disque = surDisque(etat.texte, etat);
  if (source === 'precedent') {
    const precedent = await vue.lecture(base + SUFFIXES.precedent);
    if (precedent.details === null && precedent.lecture === null) {
      throw new ErreurStockage('ABSENT', { chemin: base + SUFFIXES.precedent });
    }
    if (precedent.lecture === null) throw new ErreurStockage('ETAT_ILLISIBLE', precedent.details);
    const { lecture } = precedent;
    const trouve = await journalDe(vue, base, lecture.charge.evenement.id);
    const depuis = depuisLecture(lecture, disque);
    return assembler({ fs, racine, base, source: depuis, trouve, instant: instantDe(trouve.lu), avecRattrapage: false });
  }
  const trouve = await (etat.lecture === null
    ? journalSansEtat(vue, base)
    : journalDe(vue, base, etat.lecture.charge.evenement.id));
  if (trouve.format !== null) {
    throw new ErreurStockage('ETAT_ILLISIBLE', {
      raison: 'FORMAT_PLUS_RECENT',
      chemin: base + SUFFIXES.journal,
      format: trouve.format,
    });
  }
  if (trouve.malEncode) {
    throw new ErreurStockage('ETAT_ILLISIBLE', { ...malEncode(), chemin: base + SUFFIXES.journal });
  }
  const instant = instantDe(trouve.lu);
  if (instant === null) throw new ErreurStockage('ABSENT', { chemin: base + SUFFIXES.journal });
  const depuis = {
    charge: canoniser(instant.charge),
    revision: instant.revision,
    produitVersion: versionDe(instant.journal, instant.revision),
    manquants: AUCUN_MANQUANT,
    ...disque,
  };
  return assembler({ fs, racine, base, source: depuis, trouve, instant, avecRattrapage: false });
}

// Un Ouvert en lecture seule — un fichier qu'il a lu est d'un format plus
// récent — ne s'écrit jamais (§ 8.8).
function exigerEcriture({ formatPlusRecent }) {
  if (formatPlusRecent) throw new ErreurStockage('LECTURE_SEULE', { raison: 'FORMAT_PLUS_RECENT' });
}


// version quand l'entrée qui suit revision la note, null sinon : à la première
// entrée, et quand la construction diffère de la précédente (§ 8.8).
const versionNotee = (version, journal, revision) => (version === versionDe(journal, revision) ? null : version);

// Le journal en mémoire, la ligne écrite ajoutée à ses entrées ou à ses jalons.
function avec(journal, ligne) {
  const lue = JSON.parse(ligne);
  if (lue.type === 'jalon') return { ...journal, jalons: [...journal.jalons, lue] };
  return { ...journal, entrees: [...journal.entrees, lue] };
}

// Texte d'un journal en mémoire : son ouverture, puis chaque entrée suivie
// des jalons de sa révision, dans leur ordre. Une entrée lue se récrit par
// JSON.stringify, comme ligneEntree l'a écrite : ses clés dans l'ordre lu.
function texteDe({ evenement, entrees, jalons }) {
  const lignes = [ligneOuverture(evenement)];
  for (const entree of entrees) {
    lignes.push(JSON.stringify(entree));
    for (const jalon of jalons) {
      if (jalon.revision === entree.revision) lignes.push(ligneJalon(jalon));
    }
  }
  return `${lignes.join('\n')}\n`;
}

// Le journal de l'Ouvert prêt à recevoir une ligne, en mémoire : avant, le
// journal tel que le fichier le porte, vide quand il manque ; reprise, la
// ligne de l'entrée de reprise qui le fait finir sur la charge ouverte, ou
// null ; journal, avant suivi de la reprise ; charge, ce que restitue sa
// dernière entrée ; entier, vrai quand le fichier se réécrit en entier à sa
// prochaine écriture : il manque, sa lecture a écarté des lignes, ou il
// reçoit la reprise. Sans journal, la reprise le commence, instantané de la
// charge ouverte à sa révision et à sa version. Un journal qui finit sur une
// autre révision que la charge ouverte reçoit la reprise à la révision qui
// suit la sienne, qui restitue la charge ouverte. libelleReprise manque :
// ligneEntree lève TypeError, avant toute écriture.
function preparer(ouvert, { libelleReprise, horodatage }) {
  const { journal, revision, charge, produitVersion } = ouvert;
  if (journal === null) {
    const reprise = ligneEntree({
      revision,
      libelle: libelleReprise,
      horodatage,
      produitVersion,
      apres: charge,
      instantane: true,
    });
    const vide = { evenement: charge.evenement.id, entrees: [], jalons: [], ecartees: 0 };
    return { avant: vide, reprise, journal: avec(vide, reprise), charge: canoniser(charge), entier: true };
  }
  const derniere = journal.entrees.at(-1).revision;
  if (derniere === revision) {
    return { avant: journal, reprise: null, journal, charge: ouvert.chargeJournal, entier: ouvert.journalAReecrire };
  }
  const suivante = derniere + 1;
  const reprise = ligneEntree({
    revision: suivante,
    libelle: libelleReprise,
    horodatage,
    produitVersion: versionNotee(produitVersion, journal, derniere),
    avant: ouvert.chargeJournal,
    apres: charge,
    instantane: estInstantane(suivante, journal.entrees[0].revision),
  });
  return { avant: journal, reprise, journal: avec(journal, reprise), charge: canoniser(charge), entier: true };
}

// L'en-tête de l'état que restitue la dernière entrée d'un journal : la
// révision de cette entrée, et la version de la construction qui l'a
// produite (§ 8.8). L'état qui le porte, avec la charge de cette entrée,
// fait une paire avec le journal (§ 8.2).
function enteteDeLaDerniere(journal) {
  const revision = journal.entrees.at(-1).revision;
  return { revision, produitVersion: versionDe(journal, revision) };
}

// Le texte d'état que le disque doit porter avant la ligne d'un geste, ou
// null quand il le porte : un état lisible sur le disque, à une autre
// révision que la dernière entrée du journal préparé, reçoit d'abord la
// charge que restitue cette entrée, sous son en-tête (enteteDeLaDerniere).
// Sans ce pas, une coupure entre la ligne du geste et l'état laisserait le
// journal en avance de plus d'une entrée, ou à la révision de l'état avec
// une autre charge, et la comparaison des révisions ne rattraperait pas le
// geste (§ 8.2). Un état illisible ou absent n'a pas de révision : ouvrir le
// refuse et nomme le journal en secours. Une charge que l'analyse refuserait
// lève TypeError, avant toute écriture.
function etatAligne(ouvert, { journal, charge }) {
  const entete = enteteDeLaDerniere(journal);
  if (ouvert.revisionEtat === null || ouvert.revisionEtat === entete.revision) return null;
  return relisible(serialiser(charge, entete), 'enregistrer');
}

// Pose texte, que etatAligne a calculé, avant la ligne d'un geste : la
// reprise seule d'abord, que preparer fait écrire en entier, puis l'état à la
// révision de la dernière entrée du journal. Rend l'Ouvert dont le disque
// porte cet état et la préparation de la ligne qui suit. Un refus d'écriture
// remonte tel quel : le geste n'est pas au journal, et l'Ouvert reçu reste
// celui d'où le réessayer. Le nouvel essai réécrit en entier le journal où la
// reprise est déjà, celui de la base de l'Ouvert ou, sans base, celui que
// l'identifiant de l'événement désigne (baseCherchee) : la reprise s'y
// remplace au lieu de s'y doubler.
async function aligner(ouvert, preparation, texte) {
  let { journal, entier } = preparation;
  let depart = ouvert;
  if (preparation.reprise !== null) {
    const ecrit = await ecrireJournal(ouvert, { journal: preparation.avant, entier }, preparation.reprise);
    ({ journal } = ecrit);
    depart = { ...ouvert, journal, baseJournal: ecrit.baseJournal, journalAReecrire: false };
    entier = false;
  }
  const aligne = await poserEtat({ ...depart, revision: journal.entrees.at(-1).revision }, texte);
  return { depart: aligne, preparation: { journal, entier } };
}

// Le texte entier d'un journal en mémoire, élagué au-delà de PLAFOND_ENTREES
// (elaguer), et le journal que ce texte porte, sans ligne écartée : ce que
// le fichier porte une fois écrit d'un bloc.
function textePlein(journal) {
  const texte = texteDe(journal);
  const elague = elaguer(texte);
  if (elague === null) return { texte, journal: { ...journal, ecartees: 0 } };
  return { texte: elague, journal: lireJournal(elague) };
}

// L'ECRITURE d'une recherche dans le dossier de racine qui échoue avant une
// écriture du journal chemin — le dossier qui ne se liste plus, ou un
// fichier qui ne se lit plus : ABSENT quand le dossier a disparu avec son
// support, cause ENOENT ; LECTURE quand la lecture est refusée, sa cause —,
// chemin le journal, dossier le chemin de la racine, qui porte les fichiers
// de l'événement. L'application nomme ainsi le fichier et son dossier, et
// propose d'écrire ailleurs (§ 8.6). Toute autre erreur reste telle quelle.
function enEcriture(erreur, chemin, racine) {
  if (erreur.code !== 'ABSENT' && erreur.code !== 'LECTURE') return erreur;
  const cause = erreur.code === 'ABSENT' ? 'ENOENT' : erreur.details.cause;
  return new ErreurStockage('ECRITURE', { chemin, dossier: racine.chemin, cause });
}

// La base où s'écrit le journal d'un Ouvert sans base de journal, celui de
// sa base portant un autre événement : la base du journal que l'identifiant
// de l'événement apparie dans le dossier tel qu'il est (apparier), sinon une
// base libre que son nom dérive. L'essai repris après un refus réécrit
// ainsi, avec sa reprise, le journal que l'essai refusé a créé, au lieu d'en
// dériver un second que l'ouverture n'apparierait pas. Une recherche qui
// échoue lève ECRITURE sur le journal de la base, comme l'écriture qu'elle
// précède (enEcriture) ; toute autre erreur remonte telle quelle.
async function baseCherchee(ouvert, evenement) {
  const { fs, racine, base } = ouvert;
  try {
    return (
      (await apparier(vueDe(fs, racine), base, evenement))?.base ??
      (await deriver(fs, racine, ouvert.charge.evenement.nom, []))
    );
  } catch (erreur) {
    throw enEcriture(erreur, base + SUFFIXES.journal, racine);
  }
}

// Vrai quand le dossier de l'Ouvert porte encore le fichier chemin, son nom
// comparé comme le système compare les noms : sans égard à la casse par
// cleSansCasse quand le système l'ignore, à la lettre sinon. Ne lit que la
// liste du dossier, jamais le fichier. Un dossier qui ne se liste plus lève
// ECRITURE sur ce fichier (enEcriture).
async function fichierPresent({ fs, racine }, chemin) {
  let entrees;
  try {
    entrees = await fs.lister(racine, '');
  } catch (erreur) {
    throw enEcriture(erreur, chemin, racine);
  }
  const { insensibleCasse } = await fs.emplacements();
  const cle = insensibleCasse ? cleSansCasse : (nom) => nom;
  return entrees.some(({ nom }) => cle(nom) === cle(chemin));
}

// Écrit au journal la ligne à la suite de journal, le journal en mémoire que
// le fichier porte (§ 8.2, § 8.6) : par un ajout en fin, ou en entier par une
// écriture atomique, élaguée au-delà de PLAFOND_ENTREES (textePlein), quand
// entier le demande, que le plafond est dépassé, ou que le fichier a disparu
// (fichierPresent) : un ajout le recommencerait sans sa ligne d'ouverture, et
// la lecture l'écarterait en entier. Sans base, le journal prend celle que
// baseCherchee trouve. Rend le journal en mémoire, qui est le fichier, sa
// base, et recree, vrai quand le fichier disparu s'est réécrit.
async function ecrireJournal(ouvert, preparation, ligne) {
  let journal = avec(preparation.journal, ligne);
  const { fs, racine } = ouvert;
  const base = ouvert.baseJournal ?? (await baseCherchee(ouvert, journal.evenement));
  const chemin = base + SUFFIXES.journal;
  const entier = preparation.entier || journal.entrees.length > PLAFOND_ENTREES;
  const recree = !entier && !(await fichierPresent(ouvert, chemin));
  if (entier || recree) {
    const plein = textePlein(journal);
    journal = plein.journal;
    await fs.ecrireAtomique(racine, chemin, plein.texte);
  } else {
    await fs.ajouterLigne(racine, chemin, ligne);
  }
  return { journal: { ...journal, ecartees: 0 }, baseJournal: base, journalAReecrire: false, recree };
}

/**
 * Met de côté l'état aux octets hors UTF-8 d'un Ouvert de secours (§ 8.8),
 * avant le premier geste qui le remplace : le fichier passe tel quel dans un
 * dossier neuf de la corbeille, daté de l'horodatage (dossierCorbeille), créé
 * d'abord, comme supprimer y range un événement. Ses octets ne se perdent
 * jamais, et l'écriture qui suit pose l'état comme pour un état absent :
 * l'Ouvert rendu ne le tient plus pour mal encodé. Un Ouvert dont l'état se
 * lit, ou manque, revient tel quel, sans rien écrire. Un état qui n'est plus
 * dans le dossier — une mise de côté déjà faite, que suit un geste refusé
 * réessayé du même Ouvert — ne se déplace pas une seconde fois. Un refus
 * remonte tel quel : l'état reste à sa place ou dans la corbeille.
 *
 * @param {Ouvert} ouvert
 * @param {string} horodatage   AAAA-MM-JJTHH:MM:SS±HH:MM
 * @returns {Promise<Ouvert>}
 * @throws {ErreurStockage} ECRITURE du dossier ou de la corbeille qui ne se
 *         listent plus, de la création du dossier daté ou du déplacement ;
 *         CORBEILLE_SATUREE, sans rien écrire
 * @throws {TypeError} un horodatage hors de sa forme, sans rien écrire
 */
export async function mettreDeCoteEtatMalEncode(ouvert, horodatage) {
  if (!ouvert.etatMalEncode) return ouvert;
  const { fs, racine, base } = ouvert;
  const chemin = base + SUFFIXES.etat;
  if (!(await fichierPresent(ouvert, chemin))) return { ...ouvert, etatMalEncode: false };
  let existants = [];
  try {
    existants = (await fs.lister(racine, DOSSIER_CORBEILLE)).map(({ nom }) => nom);
  } catch (erreur) {
    // Une corbeille absente est vide.
    if (erreur.code !== 'ABSENT') throw enEcriture(erreur, DOSSIER_CORBEILLE, racine);
  }
  const dossier = dossierCorbeille(horodatage, existants);
  await fs.creerDossier(racine, dossier);
  await fs.deplacer(racine, chemin, `${dossier}/${chemin}`);
  return { ...ouvert, etatMalEncode: false };
}

// Écrit texteEtat, l'état de l'Ouvert à sa révision : le .precedent d'abord,
// quand l'état sur le disque se lit, puis l'état (§ 8.8). Rend l'Ouvert dont
// le disque porte ce texte. Un refus remonte tel quel.
async function poserEtat(ouvert, texteEtat) {
  const { fs, racine, base } = ouvert;
  if (ouvert.texteEtat !== null) await fs.ecrireAtomique(racine, base + SUFFIXES.precedent, ouvert.texteEtat);
  await fs.ecrireAtomique(racine, base + SUFFIXES.etat, texteEtat);
  return { ...ouvert, texteEtat, revisionEtat: ouvert.revision };
}

// Écrit l'état de l'Ouvert avancé, dont le geste est déjà au journal
// (poserEtat). Un refus d'écriture lève ETAT_NON_ECRIT, ses détails — chemin,
// dossier, cause — complétés de l'Ouvert avancé, qui garde le texte de l'état
// resté sur le disque. L'Ouvert s'ajoute après la construction de l'erreur :
// son message, fait pour les traces, ne porte ni la charge ni le journal.
async function ecrireEtat(avance, texteEtat) {
  try {
    return await poserEtat(avance, texteEtat);
  } catch (erreur) {
    if (erreur.code !== 'ECRITURE') throw erreur;
    const refus = new ErreurStockage('ETAT_NON_ECRIT', { ...erreur.details });
    refus.details.ouvert = avance;
    throw refus;
  }
}

// L'Ouvert d'une charge écrite : examinée, ses avertissements ceux de ses
// placements, d'un journal qui finit ailleurs que sur elle, et du journal
// disparu que l'écriture a réécrit (recree).
function apresEcriture(ouvert, { charge, revision, journal, recree = false }) {
  const examen = examiner(charge);
  const avertissements = avertir({
    examen,
    journal,
    revision,
    rattrape: false,
    ecartees: 0,
    recree,
    format: null,
    malEncode: false,
    etranger: null,
    manquants: AUCUN_MANQUANT,
  });
  return { ...ouvert, charge: examen.charge, revision, examen, avertissements };
}

// La ligne de l'entrée d'un geste à la suite du journal que preparer a
// préparé, et sa révision, celle qui suit la dernière entrée de ce journal :
// un correctif depuis la charge que restitue cette entrée, ou un instantané à
// la cadence du journal ; produitVersion n'y paraît que quand la construction
// change (versionNotee). Une ligne que la lecture refuserait lève TypeError
// (ligneEntree), avant toute écriture.
function ligneDuGeste(preparation, apres, { libelle, horodatage, produitVersion, sens, retour }) {
  const derniere = preparation.journal.entrees.at(-1).revision;
  const revision = derniere + 1;
  const ligne = ligneEntree({
    revision,
    libelle,
    horodatage,
    sens,
    retour,
    produitVersion: versionNotee(produitVersion, preparation.journal, derniere),
    avant: preparation.charge,
    apres,
    instantane: estInstantane(revision, preparation.journal.entrees[0].revision),
  });
  return { ligne, revision };
}

/**
 * Crée l'événement de charge dans racine (§ 8.1, § 8.2) : sa base dérive de
 * son nom (deriverBase), libre dans le dossier. Le journal d'abord, écrit
 * d'un bloc — ouverture, entrée 1 en instantané, jalon nomJalon sur elle —,
 * puis l'état, à la révision 1.
 *
 * @param {import('./systeme_fichiers.js').SystemeFichiers} fs
 * @param {import('./systeme_fichiers.js').Racine} racine
 * @param {import('./types.js').Charge} charge
 * @param {{libelle: string, nomJalon: string, horodatage: string, produitVersion: string}} options
 * @returns {Promise<Ouvert>}
 * @throws {TypeError} une charge, un libellé, un nom ou un horodatage que la
 *         lecture refuserait, avant toute écriture
 * @throws {ErreurStockage} ECRITURE : le journal n'a pas pu s'écrire, et rien
 *         n'est écrit ; ETAT_NON_ECRIT : le journal est écrit, l'état non ;
 *         CHEMIN_TROP_LONG (deriverBase) ; ABSENT : racine n'existe pas
 */
export async function creer(fs, racine, charge, { libelle, nomJalon, horodatage, produitVersion }) {
  const base = await deriver(fs, racine, charge.evenement.nom, []);
  const entree = ligneEntree({ revision: 1, libelle, horodatage, produitVersion, apres: charge, instantane: true });
  const jalon = ligneJalon({ revision: 1, nom: nomJalon, horodatage });
  const vide = { evenement: charge.evenement.id, entrees: [], jalons: [], ecartees: 0 };
  const journal = avec(avec(vide, entree), jalon);
  const texteEtat = relisible(serialiser(charge, { revision: 1, produitVersion }), 'creer');
  await fs.ecrireAtomique(racine, base + SUFFIXES.journal, texteDe(journal));
  const cree = {
    fs,
    racine,
    base,
    produitVersion,
    texteEtat: null,
    revisionEtat: null,
    journal,
    baseJournal: base,
    chargeJournal: canoniser(charge),
    journalAReecrire: false,
    formatPlusRecent: false,
    etatMalEncode: false,
  };
  return ecrireEtat(apresEcriture(cree, { charge, revision: 1, journal }), texteEtat);
}

/**
 * Enregistre un geste (§ 8.2) : apres devient la charge, à la révision qui
 * suit la dernière entrée du journal. (1) Un journal qui manque, ou finit
 * ailleurs que sur la charge ouverte, reçoit d'abord une entrée de reprise
 * qui la restitue, au libellé libelleReprise ; (2) l'entrée du geste,
 * correctif depuis la charge que restitue l'entrée qui la précède, ou
 * instantané à la cadence du journal ; le journal s'écrit d'un ajout en fin,
 * ou en entier quand (1) a lieu, quand sa lecture a écarté des lignes, et
 * au-delà de PLAFOND_ENTREES, élagué ; (3) le .precedent reçoit texteEtat,
 * s'il est lisible ; (4) l'état, son nouveau texte. Un format plus ancien
 * s'écrit au format courant : la conversion tombe au premier geste. Avant
 * (1), l'état aux octets hors UTF-8 d'un Ouvert de secours passe dans un
 * dossier daté de la corbeille, à l'horodatage du geste
 * (mettreDeCoteEtatMalEncode).
 *
 * Quand l'état lisible sur le disque ne porte pas la révision de la dernière
 * entrée du journal — reprise comprise —, la reprise s'écrit seule, puis le
 * .precedent et l'état à la révision de cette entrée, et alors seulement (2),
 * (3) et (4) : une coupure laisse le journal en avance d'une entrée au plus,
 * que l'ouverture rattrape (§ 8.2).
 *
 * Un geste refusé n'écrit rien : chaque ligne et chaque texte d'état se
 * calculent, et se relisent, avant la première écriture.
 *
 * @param {Ouvert} ouvert
 * @param {import('./types.js').Charge} apres
 * @param {Object} options
 * @param {string} options.libelle          texte figé de l'entrée
 * @param {string} options.horodatage       AAAA-MM-JJTHH:MM:SS±HH:MM
 * @param {string} options.produitVersion   la construction qui écrit
 * @param {null|'defaire'|'refaire'|'revenir'} [options.sens]
 * @param {number|null} [options.retour]    révision visée par un retour
 * @param {string} [options.libelleReprise] texte de l'entrée de reprise,
 *        requis quand elle a lieu
 * @returns {Promise<Ouvert>}
 * @throws {ErreurStockage} LECTURE_SEULE {raison: 'FORMAT_PLUS_RECENT'} ;
 *         ce que lève la mise de côté d'un état aux octets hors UTF-8
 *         (mettreDeCoteEtatMalEncode), avant le journal ;
 *         ECRITURE {chemin, dossier, cause} en (1), (2) ou pendant
 *         l'alignement, la recherche du journal d'un Ouvert sans base de
 *         journal comprise (baseCherchee) : le geste n'est pas au journal, et
 *         l'Ouvert reçu reste celui d'où le réessayer ; ETAT_NON_ECRIT
 *         {chemin, dossier, cause, ouvert} en (3) ou (4), le geste au journal
 *         et ouvert l'Ouvert avancé ; CHEMIN_TROP_LONG pour un journal à créer
 *         sous une base libre
 * @throws {TypeError} une ligne, une charge ou un état que la lecture
 *         refuserait, avant toute écriture
 */
export async function enregistrer(ouvert, apres, options) {
  const { horodatage, produitVersion, libelleReprise } = options;
  exigerEcriture(ouvert);
  const preparation = preparer(ouvert, { libelleReprise, horodatage });
  const { ligne, revision } = ligneDuGeste(preparation, apres, options);
  const texteEtat = relisible(serialiser(apres, { revision, produitVersion }), 'enregistrer');
  const aligne = etatAligne(ouvert, preparation);
  const depart = await mettreDeCoteEtatMalEncode(ouvert, horodatage);
  const suite = aligne === null ? { depart, preparation } : await aligner(depart, preparation, aligne);
  const { recree, ...ecrit } = await ecrireJournal(suite.depart, suite.preparation, ligne);
  const avance = { ...suite.depart, ...ecrit, produitVersion, chargeJournal: canoniser(apres) };
  return ecrireEtat(apresEcriture(avance, { charge: apres, revision, journal: ecrit.journal, recree }), texteEtat);
}

/**
 * Pose le jalon nom sur l'instant courant (§ 8.3) : une ligne du journal,
 * qui ne prend pas de révision ; l'état ne s'écrit pas. Un journal qui manque
 * ou finit ailleurs que sur la charge ouverte reçoit d'abord l'entrée de
 * reprise, comme pour enregistrer, et le jalon nomme alors son instant.
 *
 * @param {Ouvert} ouvert
 * @param {{nom: string, horodatage: string, libelleReprise?: string}} options
 * @returns {Promise<Ouvert>}
 * @throws {ErreurStockage} LECTURE_SEULE ; ECRITURE, et rien n'a changé
 * @throws {TypeError} un nom vide, un horodatage hors de sa forme
 */
export async function nommer(ouvert, { nom, horodatage, libelleReprise }) {
  exigerEcriture(ouvert);
  const preparation = preparer(ouvert, { libelleReprise, horodatage });
  const revision = preparation.journal.entrees.at(-1).revision;
  const { recree, ...ecrit } = await ecrireJournal(ouvert, preparation, ligneJalon({ revision, nom, horodatage }));
  const nomme = { ...ouvert, ...ecrit, chargeJournal: preparation.charge };
  return apresEcriture(nomme, { charge: ouvert.charge, revision, journal: ecrit.journal, recree });
}

/**
 * Prend le verrou de la séance sur l'événement (§ 8.8), daté de depuis, que
 * la séance lit à son horloge : le Verrou que rend le système de fichiers,
 * tel quel.
 *
 * @param {Ouvert} ouvert
 * @param {string} seance
 * @param {string} depuis  AAAA-MM-JJTHH:MM:SS±HH:MM ; une autre forme lève
 *        TypeError sans rien créer
 * @returns {Promise<import('./systeme_fichiers.js').Verrou>}
 */
export async function verrouiller({ fs, racine, base }, seance, depuis) {
  return fs.verrouiller(racine, base + SUFFIXES.verrou, seance, depuis);
}

/**
 * Rend le verrou de la séance : seul le sien s'efface.
 *
 * @param {Ouvert} ouvert
 * @param {string} seance
 * @returns {Promise<void>}
 */
export async function deverrouiller({ fs, racine, base }, seance) {
  await fs.deverrouiller(racine, base + SUFFIXES.verrou, seance);
}

// L'état d'avant un geste, que le .precedent garde (§ 8.8) : le texte de
// l'état sur le disque quand il se lit ; sinon, pour un Ouvert de secours, la
// charge ouverte sous son en-tête, celle que l'entrée de reprise restitue.
// Une charge que l'analyse refuserait lève TypeError, avant toute écriture.
function etatDAvant({ texteEtat, charge, revision, produitVersion }) {
  return texteEtat ?? relisible(serialiser(charge, { revision, produitVersion }), 'enregistrerAilleurs');
}

// La paire qu'enregistrerAilleurs écrit, calculée sans rien écrire. Sans
// journal ni geste, l'état seul : la charge ouverte, à sa révision et à sa
// version. Sinon le journal préparé (preparer), suivi de l'entrée de reprise
// quand il finit sur une autre révision que la charge ouverte, ou qu'il
// manque, puis de l'entrée du geste quand il y en a un (ligneDuGeste), en
// entier et élagué au-delà de PLAFOND_ENTREES (textePlein) ; puis l'état que
// restitue sa dernière entrée : la charge du geste, à sa révision et sous sa
// version, comme l'écrit enregistrer ; sans geste, la charge préparée sous
// l'en-tête de cette entrée (enteteDeLaDerniere), comme l'état qu'aligne un
// geste. La dernière entrée du journal écrit restitue l'état écrit (§ 8.2),
// et la réouverture n'a rien à rattraper. Une reprise sans libelleReprise, ou
// un geste dont la ligne ne se relirait pas, lève TypeError.
function paireAilleurs(ouvert, { libelleReprise, horodatage, geste }) {
  if (ouvert.journal === null && geste === null) {
    const { charge, revision, produitVersion } = ouvert;
    return { journal: null, texteJournal: null, charge, chargeJournal: null, revision, produitVersion };
  }
  const preparation = preparer(ouvert, { libelleReprise, horodatage });
  if (geste === null) {
    const { texte, journal } = textePlein(preparation.journal);
    const { charge } = preparation;
    return { journal, texteJournal: texte, charge, chargeJournal: charge, ...enteteDeLaDerniere(journal) };
  }
  const { apres, produitVersion } = geste;
  const { ligne, revision } = ligneDuGeste(preparation, apres, { ...geste, horodatage });
  const { texte, journal } = textePlein(avec(preparation.journal, ligne));
  return { journal, texteJournal: texte, charge: apres, chargeJournal: canoniser(apres), revision, produitVersion };
}

/**
 * Écrit l'événement ouvert sous une base libre d'une racine : dans une autre
 * racine (§ 8.6), la réponse à une écriture qui échoue, l'Ouvert reçu étant
 * celui d'avant le geste refusé (ECRITURE) ou l'Ouvert avancé
 * d'ETAT_NON_ECRIT ; ou, avec un geste, sous le nom que ce geste donne, dans
 * le dossier même, ce qu'écrit le renommage (§ 8.7). Une racine que
 * l'opérateur a choisie, que rien n'a sondée — documents en mode portable —,
 * se crée d'abord, parents compris, un dossier existant restant tel quel ;
 * creerRacine faux ne la crée pas : le dossier de travail qui disparaît en
 * cours de séance ne renaît pas vide (§ 8.6). La base dérive du nom que porte
 * la charge écrite (deriverBase), libre parmi existantes et les bases du
 * dossier. La paire s'y écrit alignée, comme après un geste (§ 8.2) : le
 * journal en mémoire, en entier — suivi d'une entrée de reprise, au libellé
 * libelleReprise, quand il finit sur une autre révision que la charge
 * ouverte, puis de l'entrée du geste, et élagué au-delà de PLAFOND_ENTREES —,
 * puis l'état que restitue sa dernière entrée, à la révision et à la version
 * de celle-ci. Rouvert là-bas, l'événement rend cette charge sans rien
 * rattraper. Un événement sans journal ni geste n'écrit que son état : la
 * charge ouverte, à sa révision ; avec un geste, l'entrée de reprise commence
 * son journal. Le .precedent de l'Ouvert ne se recopie pas. Avec un geste, la
 * nouvelle base reçoit d'abord le sien, l'état d'avant le geste (etatDAvant),
 * comme enregistrer le pose, mais avant le journal : la base appartient alors
 * à l'événement (proprietaire), si bien qu'aucun autre état de son
 * identifiant — l'ancienne paire d'un renommage interrompu, dont le journal
 * de la base n'est pas le sien — ne s'apparie le journal neuf (apparier). La
 * paire va sous une base qu'aucun fichier du dossier ne porte : elle n'y
 * remplace rien, pas même la paire de l'Ouvert quand ce dossier est le sien.
 * Les lignes et les textes d'état se calculent, et se relisent, avant la
 * première écriture, celle de la racine comprise.
 *
 * @param {Ouvert} ouvert
 * @param {import('./systeme_fichiers.js').Racine} racine
 * @param {Object} options
 * @param {Iterable<string>} options.existantes   bases à ne pas prendre
 *        là-bas, en plus de celles du dossier
 * @param {string} [options.libelleReprise]   texte de l'entrée de reprise,
 *        requis quand elle a lieu
 * @param {string} [options.horodatage]       AAAA-MM-JJTHH:MM:SS±HH:MM de
 *        l'entrée de reprise et de celle du geste, requis avec elles
 * @param {{apres: import('./types.js').Charge, libelle: string, produitVersion: string}|null} [options.geste]
 *        un geste à la suite de la charge ouverte, comme enregistrer le
 *        reçoit : apres devient la charge écrite, à la révision qui suit la
 *        dernière entrée du journal, l'entrée au libellé libelle, l'état
 *        sous la version produitVersion ; null par défaut
 * @param {boolean} [options.creerRacine]   faux : la racine n'est pas créée,
 *        et doit exister ; vrai par défaut
 * @returns {Promise<Ouvert>}   l'Ouvert dans racine : le journal et la
 *          révision écrits, chargeJournal la charge de l'état écrit, et
 *          charge celle qu'en rend examiner
 * @throws {ErreurStockage} LECTURE_SEULE ; ECRITURE quand la racine ne se
 *         crée pas, ou que le .precedent d'un geste n'a pas pu s'écrire, rien
 *         d'autre n'étant écrit, ou que le journal n'a pas pu s'écrire, le
 *         .precedent d'un geste restant écrit avant lui ; ABSENT {chemin: ''}
 *         quand creerRacine est faux et que la racine n'existe pas, rien
 *         n'étant écrit ; ETAT_NON_ECRIT quand l'état n'a pas pu s'écrire,
 *         ouvert étant l'Ouvert dans racine ; CHEMIN_TROP_LONG
 * @throws {TypeError} une reprise sans libelleReprise ou horodatage, un geste
 *         ou un état que la lecture refuserait, avant toute écriture
 */
export async function enregistrerAilleurs(
  ouvert,
  racine,
  { existantes, libelleReprise, horodatage, geste = null, creerRacine = true },
) {
  exigerEcriture(ouvert);
  const { fs } = ouvert;
  const paire = paireAilleurs(ouvert, { libelleReprise, horodatage, geste });
  const { journal, charge, revision, produitVersion } = paire;
  const texteEtat = relisible(serialiser(charge, { revision, produitVersion }), 'enregistrerAilleurs');
  const precedent = geste === null ? null : etatDAvant(ouvert);
  if (creerRacine) await fs.creerDossier(racine, '');
  const base = await deriver(fs, racine, charge.evenement.nom, [...existantes]);
  if (precedent !== null) await fs.ecrireAtomique(racine, base + SUFFIXES.precedent, precedent);
  if (journal !== null) await fs.ecrireAtomique(racine, base + SUFFIXES.journal, paire.texteJournal);
  const ailleurs = {
    ...ouvert,
    racine,
    base,
    produitVersion,
    texteEtat: null,
    revisionEtat: null,
    journal,
    baseJournal: base,
    chargeJournal: paire.chargeJournal,
    journalAReecrire: false,
    etatMalEncode: false,
  };
  return ecrireEtat(apresEcriture(ailleurs, { charge, revision, journal }), texteEtat);
}
