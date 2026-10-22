// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les opérations sur les événements d'un dossier de travail (§ 8.6, § 8.7,
// § 15) : copier, renommer, importer un fichier d'état venu d'ailleurs ou les
// paires de l'autre emplacement, supprimer vers la corbeille, la lister, et
// charger une démonstration livrée. Chaque fonction reçoit le système de
// fichiers (§ 13.4) ; aucune ne lit l'horloge ni un aléa, ni ne porte de
// texte : identifiant, horodatage, version et libellés entrent en paramètre
// (§ 14.6).
//
// Ce qui s'écrit d'un événement passe par le dépôt, qui seul apparie un état
// à son journal et les aligne l'un sur l'autre : copier et charger créent
// par creer ; renommer écrit par enregistrer, en place, ou par
// enregistrerAilleurs, sous le nouveau nom ; le journal d'un événement est
// celui qu'ouvrir lui apparie, ou, faute d'état lisible, celui que lister
// lui apparie. Le compagnon des courses (courses.js) suit la base de l'état :
// copier et renommer le font écrire par le dépôt sous la base neuve ;
// renommer supprime l'ancien, quand il existe, avec l'ancienne paire, ou le
// déplace sous la base neuve quand l'écriture du neuf a été refusée ;
// supprimer l'emporte dans la corbeille. Importer de l'autre emplacement le
// recopie tel quel après l'état, et l'ouverture le revalide (lireCourses) ;
// un fichier d'état venu d'ailleurs n'en a pas, et ses courses sont
// inconnues. Ce module ne fait par lui-même que recopier les octets d'un
// fichier, le déplacer ou le supprimer en entier.
//
// Un fichier d'un format plus récent que FORMAT ne se réécrit sous aucun nom
// (§ 8.8) : la charge que l'analyse en lit tait les clés qu'elle ne connaît
// pas. Copier, renommer et charger le refusent avant toute écriture ;
// importer en recopie les octets, et l'événement importé s'ouvre en lecture
// seule. Un état dont les octets ne sont pas de l'UTF-8 ne s'efface jamais :
// renommer l'Ouvert de son secours le met d'abord dans un dossier daté de la
// corbeille, comme le premier geste (mettreDeCoteEtatMalEncode, du dépôt) ;
// copier en fait un événement neuf, sans le toucher.
//
// Chaque événement a son dossier sous la racine, que la clé <dossier>/<base>
// désigne (cleEvenement) ; ses fichiers se lisent et s'écrivent par la vue de
// ce dossier (vueDossier), celle que porte son Ouvert. Une base se dérive du
// nom de l'événement (deriverBase), libre parmi les noms des entrées de la
// racine (basesPrises), comme le dépôt la dérive pour creer, et nomme le
// dossier neuf de la copie, de l'import, du renommage. Renommer laisse
// l'ancien dossier, vide de la paire, avec ce qui n'est pas à l'événement ;
// supprimer en emporte les fichiers de l'événement dans la corbeille de la
// racine, et laisse le dossier. Un fichier d'événement posé à même la racine
// n'a pas de clé : rien ici ne le lit, ne le déplace ni ne l'importe.
import { canoniser } from './canonique.js';
import { entreesPour } from './courses.js';
import {
  basesPrises,
  creer,
  enregistrer,
  enregistrerAilleurs,
  lister,
  mettreDeCoteEtatMalEncode,
  ouvrir,
  ouvrirSecours,
} from './depot.js';
import { analyser, etatDeduit } from './document.js';
import { ErreurStockage } from './erreurs.js';
import { decoderJournal } from './journal.js';
import {
  DOSSIER_CORBEILLE,
  SUFFIXES,
  SUFFIXE_ECRITURE,
  cleEvenement,
  cleSansCasse,
  decouperCle,
  deriverBase,
  dossierCorbeille,
  dossierEvenement,
} from './noms.js';
import { vueDossier } from './systeme_fichiers.js';

// Deux chaînes, comparées unité UTF-16 par unité.
const comparerTextes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);


// Celui des noms qui désigne le même fichier que nom : nom lui-même quand il
// y est ; sinon, quand le système ignore la casse, le premier dont la clé
// (cleSansCasse) est la sienne ; null sinon. Sur un système sensible à la
// casse, seul le nom exact désigne le fichier.
function nomSurDisque(noms, nom, insensibleCasse) {
  if (noms.includes(nom)) return nom;
  if (!insensibleCasse) return null;
  const cle = cleSansCasse(nom);
  return noms.find((autre) => cleSansCasse(autre) === cle) ?? null;
}

// Entrées du dossier de racine, triées par nom ; aucune quand il manque.
async function entreesDe(fs, racine, dossier) {
  try {
    return [...(await fs.lister(racine, dossier))].sort((a, b) => comparerTextes(a.nom, b.nom));
  } catch (erreur) {
    if (erreur.code === 'ABSENT') return [];
    throw erreur;
  }
}

// Texte du fichier chemin, ou null quand il manque ou que ses octets ne sont
// pas de l'UTF-8 (LECTURE, cause UTF8_INVALIDE) : un texte qui ne se lit pas
// ne se recopie pas. Toute autre erreur remonte telle quelle.
async function texteSiPresent(fs, racine, chemin) {
  try {
    return await fs.lireTexte(racine, chemin);
  } catch (erreur) {
    if (erreur.code === 'ABSENT') return null;
    if (erreur.code === 'LECTURE' && erreur.details.cause === 'UTF8_INVALIDE') return null;
    throw erreur;
  }
}

// Texte du fichier chemin, ou null quand sa lecture échoue par une
// ErreurStockage — absent, hors UTF-8, refusé — : la lecture du compagnon
// des courses, qui ne refuse jamais rien. Toute autre erreur remonte.
async function texteSiLisible(fs, racine, chemin) {
  try {
    return await fs.lireTexte(racine, chemin);
  } catch (erreur) {
    if (erreur instanceof ErreurStockage) return null;
    throw erreur;
  }
}

// Texte du journal chemin tel que l'ouverture le lit : le fichier entier ;
// quand ses octets ne sont pas tous de l'UTF-8, les lignes qui précèdent la
// première qui ne se décode pas (decoderJournal), celles que la lecture
// écarterait n'étant pas recopiées ; null quand il manque, ou que sa ligne
// d'ouverture ne se décode pas. Toute autre erreur remonte telle quelle.
async function journalSiPresent(fs, racine, chemin) {
  try {
    return await fs.lireTexte(racine, chemin);
  } catch (erreur) {
    if (erreur.code === 'ABSENT') return null;
    if (erreur.code === 'LECTURE' && erreur.details.cause === 'UTF8_INVALIDE') {
      return decoderJournal(erreur.details.octets).texte;
    }
    throw erreur;
  }
}

// Un fichier d'un format plus récent ne se réécrit sous aucun nom (§ 8.8).
function exigerFormatCourant(formatPlusRecent) {
  if (formatPlusRecent) throw new ErreurStockage('LECTURE_SEULE', { raison: 'FORMAT_PLUS_RECENT' });
}

// Une séance est une chaîne non vide : celle sous laquelle supprimer sonde
// le verrou.
function exigerSeance(seance) {
  if (typeof seance !== 'string' || seance === '') {
    throw new TypeError("supprimer : la séance n'est pas une chaîne non vide");
  }
}

/**
 * Libellé de l'instant que restitue l'Ouvert : celui de l'entrée de sa
 * révision au journal ; sans elle — un état sans journal, ou que le journal
 * ne rejoint pas —, libelleReprise, le texte qu'une écriture donnerait à
 * l'entrée de reprise de cet état. La filiation qu'écrit copier le porte, et
 * l'appelant qui compose le libellé de l'entrée de copie le lit ici, avant
 * l'appel.
 *
 * @param {{journal: Object|null, revision: number}} ouvert
 * @param {string} [libelleReprise]
 * @returns {string}
 * @throws {TypeError} quand il le faut et qu'il manque
 */
export function libelleDeLInstant({ journal, revision }, libelleReprise) {
  const libelle = journal?.entrees.find((entree) => entree.revision === revision)?.libelle ?? libelleReprise;
  if (typeof libelle !== 'string' || libelle === '') {
    throw new TypeError(`copier : la révision ${revision} n'a pas d'entrée au journal, libelleReprise requis`);
  }
  return libelle;
}

/**
 * Copie l'événement ouvert dans son dossier (§ 8.7) : un événement neuf,
 * d'identifiant id et de nom nom, que le logiciel demande avant de créer.
 * Sa charge est celle de l'Ouvert ; son état se déduit de son contenu
 * (etatDeduit), jamais bloqué ; sa filiation inscrit la source, son
 * identifiant et son nom, et l'instant copié, la révision de l'Ouvert et le
 * libellé de son entrée au journal. L'historique ne se copie pas : creer
 * écrit un journal d'une entrée, en instantané, au libellé libelle, et son
 * jalon nomJalon, puis l'état, puis le compagnon des courses que l'Ouvert
 * connaît pour ses propositions, sous l'identifiant de la copie, dans un
 * dossier neuf que sa base nomme, sous la racine de l'Ouvert ; sa base se
 * dérive du nom. L'original n'est ni lu ni écrit : la copie part de
 * l'Ouvert, en lecture comme en écriture.
 *
 * @param {import('./depot.js').Ouvert} ouvert
 * @param {Object} options
 * @param {string} options.id               identifiant de la copie
 * @param {string} options.nom              nom de la copie
 * @param {string} options.libelle          texte figé de son entrée
 * @param {string} options.nomJalon         nom du jalon de sa création
 * @param {string} options.horodatage       AAAA-MM-JJTHH:MM:SS±HH:MM
 * @param {string} options.produitVersion   la construction qui écrit
 * @param {string} [options.libelleReprise] libellé de l'instant copié quand
 *        sa révision n'a pas d'entrée au journal ; requis alors
 * @returns {Promise<import('./depot.js').Ouvert>}   l'Ouvert de la copie
 * @throws {ErreurStockage} LECTURE_SEULE {raison: 'FORMAT_PLUS_RECENT'}, sans
 *         rien écrire ; ce que lève creer
 * @throws {TypeError} une valeur que la lecture refuserait, libelleReprise
 *         manquant quand il est requis, avant toute écriture
 */
export async function copier(ouvert, { id, nom, libelle, nomJalon, horodatage, produitVersion, libelleReprise }) {
  exigerFormatCourant(ouvert.formatPlusRecent);
  const source = ouvert.charge.evenement;
  const instant = { revision: ouvert.revision, libelle: libelleDeLInstant(ouvert, libelleReprise) };
  const charge = canoniser(ouvert.charge);
  charge.evenement = {
    ...charge.evenement,
    id,
    nom,
    etat: etatDeduit(charge),
    filiation: { source: { id: source.id, nom: source.nom }, instant },
  };
  const courses = entreesPour(ouvert.courses, charge.propositions);
  return creer(ouvert.systeme, ouvert.racine, charge, { libelle, nomJalon, horodatage, produitVersion, courses });
}

// Vrai quand la base que deriver tire du nom, parmi les autres bases, tombe
// sur base à la casse près : rendre base aux bases prises fait alors passer
// la dérivation au rang suivant, ou lever CHEMIN_TROP_LONG quand ce rang ne
// tient pas sous la borne. Sinon les mêmes rangs restent pris, et la
// dérivation ne change pas. Seule deriverBase compare ainsi deux bases.
function tombeSur(deriver, autres, base) {
  const libre = deriver(autres);
  try {
    return deriver([...autres, base]) !== libre;
  } catch (erreur) {
    if (erreur.code === 'CHEMIN_TROP_LONG') return true;
    throw erreur;
  }
}

// Le chemin, relatif à la racine, du fichier de l'Ouvert au suffixe donné,
// dans son dossier.
const cheminDe = ({ dossier, base }, suffixe) => `${dossier}/${base}${suffixe}`;

// Supprime le fichier chemin de racine. Rend vrai quand il n'y est plus, et
// faux quand le système de fichiers refuse de l'effacer, par une
// ErreurStockage, qui ne lève pas. Toute autre erreur remonte.
async function effacerSiPossible(fs, racine, chemin) {
  try {
    await fs.supprimer(racine, chemin);
    return true;
  } catch (erreur) {
    if (!(erreur instanceof ErreurStockage)) throw erreur;
    return false;
  }
}

// Déplace le fichier de dans racine vers vers. Rend vrai quand il y est
// passé, et faux quand le système de fichiers refuse, par une
// ErreurStockage, qui ne lève pas : de reste alors où il est. Toute autre
// erreur remonte.
async function deplacerSiPossible(fs, racine, de, vers) {
  try {
    await fs.deplacer(racine, de, vers);
    return true;
  } catch (erreur) {
    if (!(erreur instanceof ErreurStockage)) throw erreur;
    return false;
  }
}

// Efface ce que la recopie a écrit dans le dossier neuf de la base avant un
// refus, par la vue de ce dossier : le journal quand journal le dit, puis le
// .precedent, et lui seulement une fois le journal parti, puis le dossier,
// quand il est vide. Un journal resté garde ainsi son .precedent, qui le
// tient à la nouvelle base : sans lui, l'ancien état pourrait s'apparier ce
// journal (apparier, dans le dépôt), et le dossier resté réserve son nom. Un
// dossier qui ne se retire pas reste, sans lever.
async function effacerRecopie(systeme, racine, base, { journal }) {
  const fs = vueDossier(systeme, base);
  if (journal && !(await effacerSiPossible(fs, racine, base + SUFFIXES.journal))) return;
  if (!(await effacerSiPossible(fs, racine, base + SUFFIXES.precedent))) return;
  try {
    await systeme.supprimerDossier(racine, base);
  } catch (erreur) {
    if (!(erreur instanceof ErreurStockage)) throw erreur;
  }
}

// Le dossier neuf d'une racine que nomme le chemin affichable dossier d'un
// refus d'écriture : celui d'un fichier écrit dans un dossier de la racine,
// le chemin de la racine suivi d'un séparateur et d'un seul nom. null pour
// un refus de la racine elle-même — la création du dossier neuf, dont le
// dossier est la racine —, ou de tout autre chemin.
function dossierDuRefus(dossier, racine, separateur) {
  const tete = racine.chemin.endsWith(separateur) ? racine.chemin : racine.chemin + separateur;
  if (typeof dossier !== 'string' || !dossier.startsWith(tete)) return null;
  const nom = dossier.slice(tete.length);
  return nom !== '' && !nom.includes(separateur) ? nom : null;
}

// La nouvelle paire de l'Ouvert, que le dépôt écrit dans un dossier neuf de
// sa racine, sous la base que dérive le nom de la charge écrite
// (enregistrerAilleurs, avec le geste d'options) : le dossier, puis l'état
// d'avant au .precedent, puis le journal entier suivi de l'entrée du geste,
// puis l'état. La racine ne se crée pas : un dossier de travail disparu ne
// renaît pas (§ 8.6). Le .precedent, écrit avant le journal, fait de la
// nouvelle base celle de l'événement, et lister tait le journal neuf tant
// que l'ancien état, qui porte son identifiant, se lit.
//
// Un refus avant l'état laisse l'ancienne paire seule à porter l'événement,
// et ce que la recopie a écrit avant lui s'efface, son dossier compris
// (effacerRecopie) : sur un .precedent ou un journal refusés, dans le
// dossier que nomme l'ECRITURE (dossierDuRefus), le .precedent ; sur un état
// refusé, le journal, puis le .precedent. L'ECRITURE remonte telle quelle ;
// le refus de l'état remonte en ECRITURE {chemin, dossier, cause}, sans
// Ouvert : celui de l'appelant décrit encore le disque. Toute autre erreur
// remonte telle quelle.
async function ecrireNouvellePaire(ouvert, options) {
  const { systeme, racine } = ouvert;
  try {
    return await enregistrerAilleurs(ouvert, racine, { ...options, existantes: [], creerRacine: false });
  } catch (erreur) {
    if (!(erreur instanceof ErreurStockage)) throw erreur;
    if (erreur.code === 'ETAT_NON_ECRIT') {
      const { chemin, dossier, cause, ouvert: neuve } = erreur.details;
      await effacerRecopie(systeme, racine, neuve.base, { journal: true });
      throw new ErreurStockage('ECRITURE', { chemin, dossier, cause });
    }
    if (erreur.code === 'ECRITURE') {
      const { separateur } = await systeme.emplacements();
      const neuf = dossierDuRefus(erreur.details.dossier, racine, separateur);
      if (neuf !== null) await effacerRecopie(systeme, racine, neuf, { journal: false });
    }
    throw erreur;
  }
}

// Supprime l'ancienne paire de l'Ouvert, dans son dossier, par sa vue, la
// nouvelle étant complète : son état d'abord, sans lequel lister ne la montre
// plus, la nouvelle portant son identifiant ; puis son .precedent, le journal
// de l'événement (baseJournal), jamais celui d'un autre, et son compagnon des
// courses quand la liste du dossier le porte, sous son nom sur le disque
// (nomSurDisque) ; un fichier absent n'est pas une faute, ni un dossier
// disparu, dont la liste est vide (entreesDe). Quand l'écriture du compagnon
// neuf a été refusée (nouvelle.compagnon null), l'ancien ne se supprime pas :
// il se déplace sous la nouvelle base, dans le dossier neuf, qui retrouve
// ainsi ses courses à la réouverture, ou reste où il est quand le déplacement
// est refusé ; ni l'un ni l'autre ne lève. Une ErreurStockage reçoit dans ses
// détails ouvert, l'Ouvert de la nouvelle paire, d'où continuer, puis
// remonte : celui que tient l'appelant décrit l'ancienne, et un geste parti
// de lui ferait diverger deux paires du même événement.
async function supprimerAncienne(ouvert, nouvelle) {
  const { fs, racine, base, baseJournal } = ouvert;
  const chemins = [base + SUFFIXES.etat, base + SUFFIXES.precedent];
  if (baseJournal !== null) chemins.push(baseJournal + SUFFIXES.journal);
  try {
    for (const chemin of chemins) await fs.supprimer(racine, chemin);
    const { insensibleCasse } = await fs.emplacements();
    const noms = (await entreesDe(fs, racine, '')).map(({ nom }) => nom);
    const compagnon = nomSurDisque(noms, base + SUFFIXES.courses, insensibleCasse);
    if (compagnon !== null && nouvelle.compagnon !== null) await fs.supprimer(racine, compagnon);
    if (compagnon !== null && nouvelle.compagnon === null) {
      const ancien = `${ouvert.dossier}/${compagnon}`;
      await deplacerSiPossible(ouvert.systeme, racine, ancien, cheminDe(nouvelle, SUFFIXES.courses));
    }
  } catch (erreur) {
    if (erreur instanceof ErreurStockage) erreur.details.ouvert = nouvelle;
    throw erreur;
  }
}

/**
 * Renomme l'événement ouvert (§ 8.7) : nom devient le nom de sa charge, par
 * un geste au libellé libelle. La base du nouveau nom se dérive, libre parmi
 * les noms des entrées de la racine. Quand elle tomberait sur le dossier de
 * l'événement, son nom mis à part — un nom qui ne diffère que par un
 * caractère que Windows refuse, ou par la casse —, le renommage est ce seul
 * geste, en place (enregistrer), dossier et fichiers gardant leur nom.
 * Sinon, le logiciel écrit d'abord la paire complète dans un dossier neuf
 * qui porte la nouvelle base — l'état d'avant au .precedent, le journal
 * recopié suivi de l'entrée du renommage, puis l'état, puis le compagnon des
 * courses —, puis supprime l'ancienne, dans l'ancien dossier : son état, son
 * .precedent, le journal de l'événement et son compagnon quand il existe,
 * jamais l'inverse ; un compagnon neuf refusé laisse l'ancien se déplacer
 * sous la nouvelle base, dans le dossier neuf. L'ancien dossier reste, avec
 * ce qui n'est pas de la paire. Rien de
 * l'ancienne paire ne s'écrit, et le .precedent neuf, posé avant le journal
 * neuf, tient ce journal à la nouvelle base : quel que soit le journal de
 * l'ancienne base — le sien, aucun pour un état importé, un illisible, celui
 * d'un autre événement, le sien rangé sous une autre base —, l'ancienne
 * paire, tant qu'elle existe, s'ouvre sous l'ancien nom, à sa révision, ses
 * octets intacts. Une coupure laisse l'ancienne paire, les deux, ou la
 * nouvelle, jamais aucune. Le journal d'un autre événement, que porterait
 * l'ancienne base, ne se touche pas ; le verrou non plus, que la séance
 * déplace.
 *
 * L'Ouvert d'un secours dont l'état sur le disque n'est pas de l'UTF-8 met
 * d'abord cet état dans un dossier daté de la corbeille, à l'horodatage du
 * renommage (mettreDeCoteEtatMalEncode) : ni la recopie ni la suppression de
 * l'ancienne paire ne le remplacent ni ne l'effacent, et ses octets restent.
 *
 * Un nom inchangé, les blancs de ses deux bouts mis à part — deriverBase
 * les retire aussi —, ne touche à rien : aucune entrée, aucune recopie,
 * aucune suppression, et l'Ouvert reçu revient, même quand le nom dériverait
 * aujourd'hui une autre base que la sienne. Une entrée est exactement ce qui
 * change un fichier d'événement (§ 8.2), et garder son nom n'est pas un geste.
 *
 * Un refus avant que la nouvelle paire soit complète laisse l'ancienne
 * intacte, et l'Ouvert reçu d'où continuer ; ce que la recopie a écrit
 * s'efface quand le support le permet (ecrireNouvellePaire). Un refus
 * pendant la suppression de l'ancienne porte dans ses détails ouvert,
 * l'Ouvert de la nouvelle paire, d'où continuer : l'Ouvert reçu ne décrit
 * plus que des fichiers en partance.
 *
 * @param {import('./depot.js').Ouvert} ouvert   en écriture
 * @param {Object} options
 * @param {string} options.nom
 * @param {string} options.libelle          texte figé de l'entrée
 * @param {string} options.horodatage
 * @param {string} options.produitVersion
 * @param {string} [options.libelleReprise] texte de l'entrée de reprise,
 *        requis quand le journal ne finit pas sur la charge ouverte
 * @returns {Promise<import('./depot.js').Ouvert>}   l'Ouvert renommé, sous la
 *          base que le nom dérive ; l'Ouvert reçu quand le nom ne change pas
 * @throws {ErreurStockage} sans rien écrire : LECTURE_SEULE {raison:
 *         'FORMAT_PLUS_RECENT'}, CHEMIN_TROP_LONG, ABSENT {chemin: ''} quand
 *         le dossier n'existe plus ; en place, ce que lève enregistrer ;
 *         ce que lève la mise de côté d'un état aux octets hors UTF-8
 *         (mettreDeCoteEtatMalEncode), l'ancienne paire sinon intacte ;
 *         ECRITURE {chemin, dossier, cause} du .precedent, du journal ou de
 *         l'état de la nouvelle paire, l'ancienne intacte ; ECRITURE {chemin,
 *         dossier, cause, ouvert} de la suppression de l'ancienne
 * @throws {TypeError} une valeur que la lecture refuserait, avant toute
 *         écriture
 */
export async function renommer(ouvert, { nom, libelle, horodatage, produitVersion, libelleReprise }) {
  exigerFormatCourant(ouvert.formatPlusRecent);
  if (nom.trim() === ouvert.charge.evenement.nom.trim()) return ouvert;
  const { systeme, racine, dossier } = ouvert;
  const autres = (await basesPrises(systeme, racine)).filter((autre) => autre !== dossier);
  const { separateur } = await systeme.emplacements();
  const deriver = (existantes) => deriverBase(nom, { racine: racine.chemin, separateur, existantes });
  const apres = { ...ouvert.charge, evenement: { ...ouvert.charge.evenement, nom } };
  if (tombeSur(deriver, autres, dossier)) {
    return enregistrer(ouvert, apres, { libelle, horodatage, produitVersion, libelleReprise });
  }
  const geste = { apres, libelle, produitVersion };
  const depart = await mettreDeCoteEtatMalEncode(ouvert, horodatage);
  const nouvelle = await ecrireNouvellePaire(depart, { geste, libelleReprise, horodatage });
  await supprimerAncienne(depart, nouvelle);
  return nouvelle;
}

// Décodage strict : une suite d'octets qui n'est pas de l'UTF-8 lève, et la
// marque d'ordre d'octets reste dans le texte. Le texte décodé se réencode
// ainsi en UTF-8 sur exactement les octets reçus.
const UTF8_STRICT = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

// Texte des octets d'un fichier d'état. Des octets qui ne sont pas de l'UTF-8
// ne sont pas un texte : ETAT_ILLISIBLE, raison ENCODAGE, comme le dépôt le
// lève d'un état du dossier aux octets hors UTF-8.
function decoder(octets) {
  if (!(octets instanceof Uint8Array)) throw new TypeError('importer : les octets du fichier sont un Uint8Array');
  try {
    return UTF8_STRICT.decode(octets);
  } catch {
    throw new ErreurStockage('ETAT_ILLISIBLE', { raison: 'ENCODAGE', chemin: null });
  }
}

// Écrit dans racine l'événement id, nom, dans un dossier neuf que nomme une
// base libre parmi les noms des entrées de la racine, que nom dérive : le
// dossier d'abord, puis ses fichiers, tels quels, chacun quand il est
// donné — le .precedent d'abord, qui tient la base à l'événement (apparier,
// dans le dépôt), puis le journal, puis l'état, puis le compagnon des
// courses. Rend { cle, base }. IDENTIFIANT_PRESENT quand lister nomme id
// dans un dossier de la racine, que son état se lise ou non : l'événement y
// est déjà, et une seconde copie de son identifiant dériverait (§ 8.6). Le
// refus d'écrire le compagnon, par une ErreurStockage, ne lève pas :
// l'événement est là, ses courses inconnues.
async function deposer(fs, racine, { id, nom, texteEtat, textePrecedent = null, texteJournal, texteCourses = null }) {
  const present = (await lister(fs, racine)).find((resume) => resume.id === id);
  if (present !== undefined) throw new ErreurStockage('IDENTIFIANT_PRESENT', { id, base: present.base, dossier: present.dossier });
  const { separateur } = await fs.emplacements();
  const existantes = await basesPrises(fs, racine);
  const base = deriverBase(nom, { racine: racine.chemin, separateur, existantes });
  const dossier = dossierEvenement(base);
  await fs.creerDossier(racine, dossier);
  const local = vueDossier(fs, dossier);
  if (textePrecedent !== null) await local.ecrireAtomique(racine, base + SUFFIXES.precedent, textePrecedent);
  if (texteJournal !== null) await local.ecrireAtomique(racine, base + SUFFIXES.journal, texteJournal);
  if (texteEtat !== null) await local.ecrireAtomique(racine, base + SUFFIXES.etat, texteEtat);
  if (texteCourses !== null) {
    try {
      await local.ecrireAtomique(racine, base + SUFFIXES.courses, texteCourses);
    } catch (erreur) {
      if (!(erreur instanceof ErreurStockage)) throw erreur;
    }
  }
  return { cle: cleEvenement(dossier, base), base };
}

/**
 * Importe un fichier d'état venu d'ailleurs (§ 8.7) : ses octets, lus en
 * UTF-8, se copient tels quels — marque d'ordre d'octets, fins de ligne et
 * mise en page comprises — dans un dossier neuf, sous une base libre que
 * dérive le nom qu'il porte. Aucun journal ne s'écrit, et rien ne se
 * convertit : un fichier d'un format plus récent, que l'analyse lit réduit à
 * ce qu'elle connaît, s'ouvre ensuite en lecture seule.
 *
 * @param {import('./systeme_fichiers.js').SystemeFichiers} fs
 * @param {import('./systeme_fichiers.js').Racine} racine
 * @param {Uint8Array} octets
 * @returns {Promise<{cle: string, base: string}>}   la clé de l'événement
 *          importé (cleEvenement) et sa base
 * @throws {ErreurStockage} ETAT_ILLISIBLE {raison, chemin, [format]} de
 *         l'analyse, raison ENCODAGE pour des octets hors UTF-8 ; ni base ni
 *         secours : le fichier n'est pas du dossier. IDENTIFIANT_PRESENT {id,
 *         base} quand lister nomme son identifiant dans le dossier, que
 *         l'état qui le porte se lise ou non ;
 *         CHEMIN_TROP_LONG ; ECRITURE. Rien ne s'écrit avant le dossier,
 *         puis l'état
 * @throws {TypeError} des octets qui ne sont pas un Uint8Array
 */
export async function importer(fs, racine, octets) {
  const texte = decoder(octets);
  const { id, nom } = analyser(texte).charge.evenement;
  return deposer(fs, racine, { id, nom, texteEtat: texte, texteJournal: null });
}

// Les fichiers de l'événement de clé cle dans depuis, dont l'état ne se lit
// pas, recopiés tels quels dans vers (deposer), lus dans son dossier par la
// vue de l'Ouvert du secours : le .precedent et l'état, chacun quand il
// existe et que ses octets sont de l'UTF-8, et le journal que le secours
// source apparie, par ses lignes lisibles (journalSiPresent). Le secours
// source — 'precedent' ou 'journal' (ouvrirSecours) — donne l'identifiant et
// le nom. Rend la clé dans vers.
async function importerSecours(fs, depuis, vers, cle, source) {
  const { charge, baseJournal, base, fs: local } = await ouvrirSecours(fs, depuis, cle, source);
  const { id, nom } = charge.evenement;
  const lire = (chemin) => texteSiPresent(local, depuis, chemin);
  const journal = baseJournal === null ? null : baseJournal + SUFFIXES.journal;
  const { cle: nouvelle } = await deposer(fs, vers, {
    id,
    nom,
    textePrecedent: await lire(base + SUFFIXES.precedent),
    texteJournal: journal === null ? null : await journalSiPresent(local, depuis, journal),
    texteEtat: await lire(base + SUFFIXES.etat),
  });
  return nouvelle;
}

// Importe l'événement de clé cle de depuis dans vers (importerDepuis) et
// rend sa clé là-bas. Ses fichiers se lisent dans son dossier, par la vue de
// son Ouvert. Un état lisible s'importe avec son journal et son
// compagnon des courses, tel quel, quand ses octets se lisent
// (texteSiLisible) : l'ouverture là-bas le revalide entrée par entrée. Un
// état illisible qui a un secours lisible s'importe par ses fichiers
// (importerSecours), le .precedent pour source quand il se lit ; sans
// secours, son refus remonte.
async function importerUn(fs, depuis, vers, cle) {
  let ouvert;
  try {
    ouvert = await ouvrir(fs, depuis, cle);
  } catch (erreur) {
    if (erreur.code !== 'ETAT_ILLISIBLE') throw erreur;
    const { precedent, journal } = erreur.details.secours;
    if (precedent === null && journal === null) throw erreur;
    return importerSecours(fs, depuis, vers, cle, precedent === null ? 'journal' : 'precedent');
  }
  const { texteEtat, baseJournal, base, fs: local } = ouvert;
  const { id, nom } = analyser(texteEtat).charge.evenement;
  const journal = baseJournal === null ? null : baseJournal + SUFFIXES.journal;
  const texteJournal = journal === null ? null : await journalSiPresent(local, depuis, journal);
  const texteCourses = await texteSiLisible(local, depuis, base + SUFFIXES.courses);
  return (await deposer(fs, vers, { id, nom, texteEtat, texteJournal, texteCourses })).cle;
}

/**
 * Importe des événements de l'autre emplacement (§ 8.6) : pour chaque clé
 * de depuis (cleEvenement), dans l'ordre reçu, le journal qu'ouvrir lui
 * apparie, son état, puis son compagnon des courses quand il se lit, se
 * copient tels quels dans vers, dans un dossier neuf, sous une base libre
 * que dérive le nom que porte l'état ; le refus d'écrire le compagnon ne
 * refuse pas l'import. Une clé sans dossier — un fichier posé à même la
 * racine — se refuse CHEMIN_REFUSE, sans rien lire. Le .precedent ne se
 * copie pas. Un événement dont l'état ne se lit pas, mais dont le
 * .precedent ou le journal se lisent (§ 8.8), se copie par ses fichiers,
 * tels quels : le .precedent, le journal que son secours apparie, et
 * l'état, chacun quand ses octets sont de l'UTF-8 ; il s'ouvre là-bas en
 * secours. Un journal dont une ligne n'est pas de l'UTF-8 se copie par les
 * lignes qui la précèdent, celles que l'ouverture lit (journalSiPresent).
 * Les originaux restent où ils sont, sans qu'aucune écriture ne touche
 * depuis. Une clé qui ne s'importe pas se refuse par son code —
 * ETAT_ILLISIBLE sans secours lisible, ABSENT, IDENTIFIANT_PRESENT,
 * ECRITURE, CHEMIN_REFUSE… —, sans arrêter les suivantes ; l'écriture
 * refusée d'un fichier laisse dans vers ceux déjà écrits.
 *
 * @param {import('./systeme_fichiers.js').SystemeFichiers} fs
 * @param {import('./systeme_fichiers.js').Racine} depuis
 * @param {import('./systeme_fichiers.js').Racine} vers
 * @param {Iterable<string>} cles   clés des événements de depuis
 * @returns {Promise<{importes: Array<{cle: string, nouvelle: string}>, refuses: Array<{cle: string, code: string}>}>}
 *          importes : chaque clé importée et sa clé dans vers ; refuses :
 *          chaque clé refusée et le code de son refus ; l'un et l'autre
 *          dans l'ordre des clés reçues. Une erreur qui n'est pas une
 *          ErreurStockage remonte telle quelle
 */
export async function importerDepuis(fs, depuis, vers, cles) {
  const importes = [];
  const refuses = [];
  for (const cle of cles) {
    try {
      importes.push({ cle, nouvelle: await importerUn(fs, depuis, vers, cle) });
    } catch (erreur) {
      if (!(erreur instanceof ErreurStockage)) throw erreur;
      refuses.push({ cle, code: erreur.code });
    }
  }
  return { importes, refuses };
}

// Base du journal de l'événement de clé cle, dans son dossier : celle
// qu'ouvrir lui apparie quand son état se lit ; sinon celle que lister lui
// apparie par l'identifiant de son .precedent, ou du journal sans état, le
// résumé de sa base se trouvant parmi ceux de son dossier comme un nom de
// fichier (nomSurDisque) ; null quand aucun ne lui revient. Le journal d'un
// autre événement n'est jamais le sien. Sur un système qui ignore la casse,
// la base rendue peut différer par la casse du nom du journal sur le disque.
async function baseDuJournal(fs, racine, cle, insensibleCasse) {
  try {
    return (await ouvrir(fs, racine, cle)).baseJournal;
  } catch (erreur) {
    if (erreur.code === 'ABSENT') return null;
    if (erreur.code !== 'ETAT_ILLISIBLE') throw erreur;
  }
  const { dossier, base } = decouperCle(cle);
  const resumes = (await lister(fs, racine)).filter((resume) => resume.dossier === dossier);
  const trouvee = nomSurDisque(resumes.map((resume) => resume.base), base, insensibleCasse);
  return resumes.find((resume) => resume.base === trouvee)?.journal ?? null;
}

/**
 * Supprime l'événement de clé cle (§ 8.7) : ses fichiers passent de son
 * dossier dans un dossier neuf de la corbeille de la racine, daté de
 * l'horodatage (dossierCorbeille), créé d'abord — _2, _3… quand la seconde a
 * déjà le sien —, qui les porte directement. Le dossier de l'événement
 * reste, avec ce qui n'est pas à l'événement. Partent l'état, le
 * .precedent, le journal de l'événement (baseDuJournal), jamais celui d'un
 * autre, le verrou, le compagnon des courses, et chacun de leurs fichiers
 * d'écriture atomique restés ; ceux-ci d'abord, puis le verrou, le
 * compagnon, le journal, le .precedent, et l'état en dernier. Sur un
 * système de fichiers qui ignore la casse, un fichier se reconnaît à la clé
 * de son nom, la majuscule de sa NFC, comme deriverBase compare les bases,
 * et part sous son nom sur le disque : un journal, un .precedent, un
 * compagnon ou un verrou d'une autre casse est le même fichier. Sur un
 * système sensible à la casse, seul le nom exact compte. Chaque déplacement
 * porte un fichier entier : une coupure laisse
 * chacun à sa place ou dans la corbeille, jamais perdu, et l'événement se
 * liste encore tant que son état n'est pas parti. Rien ne vide la corbeille.
 *
 * Une autre séance qui tient l'événement en écriture y écrit encore : avant
 * tout déplacement, supprimer sonde le verrou en le prenant sous seance, la
 * séance qui supprime (§ 8.8). Un verrou d'une séance vivante, d'un autre
 * poste ou illisible — vivant n'y est pas faux — lève VERROU_PRIS, sans rien
 * déplacer. Le verrou d'une séance morte, celui de seance, ou celui que la
 * sonde vient de prendre part avec le reste ; un refus qui suit la sonde
 * rend le verrou qu'elle a pris. Là où le système n'a pas de verrou
 * (verrouDisponible faux), la sonde ne pose rien.
 *
 * Le dossier daté se crée sous la racine, que creerDossier ne crée pas : un
 * dossier de travail qui disparaît pendant la suppression ne renaît pas
 * (§ 8.6). Disparu avant la création du dossier daté, il fait lever
 * ECRITURE, cause ENOENT ; après, le déplacement du premier fichier qui n'est
 * plus là lève ABSENT.
 *
 * @param {import('./systeme_fichiers.js').SystemeFichiers} fs
 * @param {import('./systeme_fichiers.js').Racine} racine
 * @param {string} cle   cleEvenement(dossier, base)
 * @param {{horodatage: string, seance: string}} options   horodatage
 *        AAAA-MM-JJTHH:MM:SS±HH:MM ; seance, la séance qui supprime
 * @returns {Promise<{dossier: string}>}   chemin relatif du dossier daté
 * @throws {ErreurStockage} CHEMIN_REFUSE {chemin: cle} d'une clé sans
 *         dossier ou dans la corbeille (decouperCle) ; ABSENT {chemin}, le
 *         chemin de l'état relatif au dossier, quand l'événement n'a aucun
 *         fichier, CORBEILLE_SATUREE, l'un et l'autre sans rien écrire ;
 *         VERROU_PRIS {seance, depuis, vivant}, sans rien déplacer ;
 *         ECRITURE de la création du dossier daté ou d'un déplacement
 *         refusé ; EXISTE ; ABSENT {chemin} d'un fichier qui disparaît
 *         pendant les déplacements
 * @throws {TypeError} un horodatage hors de sa forme, une séance qui n'est
 *         pas une chaîne non vide, sans rien écrire
 */
export async function supprimer(fs, racine, cle, { horodatage, seance }) {
  exigerSeance(seance);
  const { dossier: evenement, base } = decouperCle(cle);
  const local = vueDossier(fs, evenement);
  const { insensibleCasse } = await fs.emplacements();
  const journal = await baseDuJournal(fs, racine, cle, insensibleCasse);
  const verrou = base + SUFFIXES.verrou;
  const fichiers = [
    verrou,
    base + SUFFIXES.courses,
    ...(journal === null ? [] : [journal + SUFFIXES.journal]),
    base + SUFFIXES.precedent,
    base + SUFFIXES.etat,
  ];
  // Les noms des fichiers du dossier de l'événement, triés, aucun quand il
  // manque ; ceux de l'événement parmi eux, sous leur nom sur le disque,
  // dans l'ordre de leur départ.
  const nomsSurDisque = async () =>
    (await entreesDe(local, racine, ''))
      .filter(({ type }) => type === 'fichier')
      .map(({ nom }) => nom);
  const partantsParmi = (presents) =>
    [...fichiers.map((nom) => nom + SUFFIXE_ECRITURE), ...fichiers]
      .map((nom) => nomSurDisque(presents, nom, insensibleCasse))
      .filter((nom) => nom !== null);
  let presents = await nomsSurDisque();
  if (partantsParmi(presents).length === 0) throw new ErreurStockage('ABSENT', { chemin: base + SUFFIXES.etat });
  const existants = (await entreesDe(fs, racine, DOSSIER_CORBEILLE)).map(({ nom }) => nom);
  const dossier = dossierCorbeille(horodatage, existants);
  // La sonde vise le verrou sous son nom sur le disque, celui qui part.
  const nomDuVerrou = nomSurDisque(presents, verrou, insensibleCasse) ?? verrou;
  const sonde = await local.verrouiller(racine, nomDuVerrou, seance, horodatage);
  if (!sonde.pris && sonde.seance !== seance && sonde.vivant !== false) {
    throw new ErreurStockage('VERROU_PRIS', { seance: sonde.seance, depuis: sonde.depuis, vivant: sonde.vivant });
  }
  try {
    if (sonde.pris) presents = await nomsSurDisque();
    await fs.creerDossier(racine, dossier);
    for (const nom of partantsParmi(presents)) await fs.deplacer(racine, `${evenement}/${nom}`, `${dossier}/${nom}`);
  } catch (erreur) {
    // Un nettoyage qui échoue ne masque pas l'échec qu'il suit.
    if (sonde.pris) await local.deverrouiller(racine, nomDuVerrou, seance).catch(() => {});
    throw erreur;
  }
  return { dossier };
}

/**
 * Le contenu de la corbeille de racine (§ 8.7), sans rien écrire : un
 * élément par dossier daté, son chemin relatif et les noms de ses fichiers,
 * les dossiers et les fichiers triés par nom. Une corbeille absente est
 * vide ; ce qui n'est pas un dossier daté ne s'y liste pas.
 *
 * @param {import('./systeme_fichiers.js').SystemeFichiers} fs
 * @param {import('./systeme_fichiers.js').Racine} racine
 * @returns {Promise<Array<{dossier: string, fichiers: string[]}>>}
 */
export async function listerCorbeille(fs, racine) {
  const contenu = [];
  for (const { nom, type } of await entreesDe(fs, racine, DOSSIER_CORBEILLE)) {
    if (type !== 'dossier') continue;
    const dossier = `${DOSSIER_CORBEILLE}/${nom}`;
    const entrees = await entreesDe(fs, racine, dossier);
    const fichiers = entrees.filter((entree) => entree.type === 'fichier').map((entree) => entree.nom);
    contenu.push({ dossier, fichiers });
  }
  return contenu;
}

/**
 * Charge une démonstration livrée (§ 15) : un événement neuf, d'identifiant
 * id, nommé d'après la démonstration suivie d'un rang, « ‹nom› N », N le
 * premier rang libre à partir de 1 parmi les noms des événements lisibles du
 * dossier. Les noms se comparent en NFC et, quand le système de fichiers
 * ignore la casse, par leur majuscule, comme deriverBase compare les bases.
 * Son état se déduit de son contenu ; creer l'écrit, journal d'une entrée au
 * libellé libelle et son jalon nomJalon, sous une base que le nom dérive. Le
 * texte livré ne fait que se lire ; ni lui ni l'événement courant ne
 * changent. Le mode de l'événement chargé, la lecture, appartient à la
 * séance.
 *
 * @param {import('./systeme_fichiers.js').SystemeFichiers} fs
 * @param {import('./systeme_fichiers.js').Racine} racine
 * @param {string} texteLivre   le fichier d'état livré
 * @param {{id: string, libelle: string, nomJalon: string, horodatage: string, produitVersion: string}} options
 * @returns {Promise<import('./depot.js').Ouvert>}
 * @throws {ErreurStockage} ETAT_ILLISIBLE de l'analyse ; LECTURE_SEULE
 *         {raison: 'FORMAT_PLUS_RECENT'} ; l'un et l'autre sans rien écrire ;
 *         ce que lève creer
 */
export async function chargerDemonstration(
  fs,
  racine,
  texteLivre,
  { id, libelle, nomJalon, horodatage, produitVersion },
) {
  const { charge, formatPlusRecent } = analyser(texteLivre);
  exigerFormatCourant(formatPlusRecent);
  const { insensibleCasse } = await fs.emplacements();
  const cle = (nom) => (insensibleCasse ? cleSansCasse(nom) : nom.normalize('NFC'));
  const pris = new Set(
    (await lister(fs, racine)).filter((resume) => resume.nom !== null).map((resume) => cle(resume.nom)),
  );
  let rang = 1;
  while (pris.has(cle(`${charge.evenement.nom} ${rang}`))) rang += 1;
  const evenement = { ...charge.evenement, id, nom: `${charge.evenement.nom} ${rang}`, etat: etatDeduit(charge) };
  return creer(fs, racine, { ...charge, evenement }, { libelle, nomJalon, horodatage, produitVersion });
}
