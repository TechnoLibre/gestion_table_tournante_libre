// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

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
// lui apparie. Ce module ne fait par lui-même que recopier les octets d'un
// fichier, le déplacer ou le supprimer en entier.
//
// Un fichier d'un format plus récent que FORMAT ne se réécrit sous aucun nom
// (§ 8.8) : la charge que l'analyse en lit tait les clés qu'elle ne connaît
// pas. Copier, renommer et charger le refusent avant toute écriture ;
// importer en recopie les octets, et l'événement importé s'ouvre en lecture
// seule.
//
// Une base se dérive du nom de l'événement (deriverBase), libre parmi les
// bases que portent les fichiers d'événement à la racine du dossier
// (basesPrises), comme le dépôt la dérive pour creer.
import { canoniser } from './canonique.js';
import { basesPrises, creer, enregistrer, enregistrerAilleurs, lister, ouvrir } from './depot.js';
import { analyser, etatDeduit } from './document.js';
import { ErreurStockage } from './erreurs.js';
import { DOSSIER_CORBEILLE, SUFFIXES, SUFFIXE_ECRITURE, cleSansCasse, deriverBase, dossierCorbeille } from './noms.js';

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

// Texte du fichier chemin, ou null quand il manque.
async function texteSiPresent(fs, racine, chemin) {
  try {
    return await fs.lireTexte(racine, chemin);
  } catch (erreur) {
    if (erreur.code === 'ABSENT') return null;
    throw erreur;
  }
}

// Un fichier d'un format plus récent ne se réécrit sous aucun nom (§ 8.8).
function exigerFormatCourant(formatPlusRecent) {
  if (formatPlusRecent) throw new ErreurStockage('LECTURE_SEULE', { raison: 'FORMAT_PLUS_RECENT' });
}

// Libellé de l'instant que restitue l'Ouvert : celui de l'entrée de sa
// révision au journal ; sans elle — un état sans journal, ou que le journal
// ne rejoint pas —, libelleReprise, le texte qu'une écriture donnerait à
// l'entrée de reprise de cet état. TypeError quand il le faut et qu'il manque.
function libelleDeLInstant({ journal, revision }, libelleReprise) {
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
 * jalon nomJalon, puis l'état ; sa base se dérive du nom. L'original n'est
 * ni lu ni écrit : la copie part de l'Ouvert, en lecture comme en écriture.
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
  return creer(ouvert.fs, ouvert.racine, charge, { libelle, nomJalon, horodatage, produitVersion });
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

// Efface ce que la recopie a écrit sous base avant un refus : le journal
// quand journal le dit, puis le .precedent, et lui seulement une fois le
// journal parti. Un journal resté garde ainsi son .precedent, qui le tient à
// la nouvelle base : sans lui, l'ancien état pourrait s'apparier ce journal
// (apparier, dans le dépôt).
async function effacerRecopie(fs, racine, base, { journal }) {
  if (journal && !(await effacerSiPossible(fs, racine, base + SUFFIXES.journal))) return;
  await effacerSiPossible(fs, racine, base + SUFFIXES.precedent);
}

// La nouvelle paire de l'Ouvert, que le dépôt écrit dans son dossier sous la
// base que dérive le nom de la charge écrite (enregistrerAilleurs, avec le
// geste d'options) : l'état d'avant au .precedent, puis le journal entier
// suivi de l'entrée du geste, puis l'état. Le dossier ne se crée pas : un
// dossier de travail disparu ne renaît pas (§ 8.6). Le .precedent, écrit
// avant le journal, fait de la nouvelle base celle de l'événement : le
// journal neuf ne s'apparie qu'à elle, jamais à l'ancien état, que le journal
// de l'ancienne base soit le sien ou non, et lister le tait tant que l'ancien
// état se lit.
//
// Un refus avant l'état laisse l'ancienne paire seule à porter l'événement,
// et ce que la recopie a écrit avant lui s'efface (effacerRecopie) : sur un
// journal refusé, que nomme le chemin de l'ECRITURE, le .precedent ; sur un
// état refusé, le journal, puis le .precedent. L'ECRITURE d'un journal
// remonte telle quelle ; le refus de l'état remonte en ECRITURE {chemin,
// dossier, cause}, sans Ouvert : celui de l'appelant décrit encore le disque.
// Toute autre erreur remonte telle quelle.
async function ecrireNouvellePaire(ouvert, options) {
  const { fs, racine } = ouvert;
  try {
    return await enregistrerAilleurs(ouvert, racine, { ...options, existantes: [], creerRacine: false });
  } catch (erreur) {
    if (!(erreur instanceof ErreurStockage)) throw erreur;
    if (erreur.code === 'ETAT_NON_ECRIT') {
      const { chemin, dossier, cause, ouvert: neuve } = erreur.details;
      await effacerRecopie(fs, racine, neuve.base, { journal: true });
      throw new ErreurStockage('ECRITURE', { chemin, dossier, cause });
    }
    const { chemin } = erreur.details;
    if (erreur.code === 'ECRITURE' && chemin.endsWith(SUFFIXES.journal)) {
      await effacerRecopie(fs, racine, chemin.slice(0, -SUFFIXES.journal.length), { journal: false });
    }
    throw erreur;
  }
}

// Supprime l'ancienne paire de l'Ouvert, la nouvelle étant complète : son
// état d'abord, sans lequel lister ne la montre plus, la nouvelle portant
// son identifiant ; puis son .precedent et le journal de l'événement
// (baseJournal), jamais celui d'un autre ; un fichier absent n'est pas une
// faute. Une ErreurStockage reçoit dans ses détails ouvert, l'Ouvert de la
// nouvelle paire, d'où continuer, puis remonte : celui que tient l'appelant
// décrit l'ancienne, et un geste parti de lui ferait diverger deux paires du
// même événement.
async function supprimerAncienne(ouvert, nouvelle) {
  const { fs, racine, base, baseJournal } = ouvert;
  const chemins = [base + SUFFIXES.etat, base + SUFFIXES.precedent];
  if (baseJournal !== null) chemins.push(baseJournal + SUFFIXES.journal);
  try {
    for (const chemin of chemins) await fs.supprimer(racine, chemin);
  } catch (erreur) {
    if (erreur instanceof ErreurStockage) erreur.details.ouvert = nouvelle;
    throw erreur;
  }
}

/**
 * Renomme l'événement ouvert (§ 8.7) : nom devient le nom de sa charge, par
 * un geste au libellé libelle. La base du nouveau nom se dérive, libre dans
 * le dossier. Quand elle tomberait sur la base de l'événement, ses fichiers
 * mis à part — un nom qui ne diffère que par un caractère que Windows
 * refuse, ou par la casse —, le renommage est ce seul geste, en place
 * (enregistrer). Sinon, le logiciel écrit d'abord la paire complète sous la
 * nouvelle base — l'état d'avant au .precedent, le journal recopié suivi de
 * l'entrée du renommage, puis l'état —, puis supprime l'ancienne : son état,
 * son .precedent et le journal de l'événement, jamais l'inverse. Rien de
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
 *         ECRITURE {chemin, dossier, cause} du .precedent, du journal ou de
 *         l'état de la nouvelle paire, l'ancienne intacte ; ECRITURE {chemin,
 *         dossier, cause, ouvert} de la suppression de l'ancienne
 * @throws {TypeError} une valeur que la lecture refuserait, avant toute
 *         écriture
 */
export async function renommer(ouvert, { nom, libelle, horodatage, produitVersion, libelleReprise }) {
  exigerFormatCourant(ouvert.formatPlusRecent);
  if (nom.trim() === ouvert.charge.evenement.nom.trim()) return ouvert;
  const { fs, racine, base } = ouvert;
  const autres = (await basesPrises(fs, racine)).filter((autre) => autre !== base);
  const { separateur } = await fs.emplacements();
  const deriver = (existantes) => deriverBase(nom, { racine: racine.chemin, separateur, existantes });
  const apres = { ...ouvert.charge, evenement: { ...ouvert.charge.evenement, nom } };
  if (tombeSur(deriver, autres, base)) {
    return enregistrer(ouvert, apres, { libelle, horodatage, produitVersion, libelleReprise });
  }
  const geste = { apres, libelle, produitVersion };
  const nouvelle = await ecrireNouvellePaire(ouvert, { geste, libelleReprise, horodatage });
  await supprimerAncienne(ouvert, nouvelle);
  return nouvelle;
}

// Décodage strict : une suite d'octets qui n'est pas de l'UTF-8 lève, et la
// marque d'ordre d'octets reste dans le texte. Le texte décodé se réencode
// ainsi en UTF-8 sur exactement les octets reçus.
const UTF8_STRICT = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

// Texte des octets d'un fichier d'état. Des octets qui ne sont pas de l'UTF-8
// ne sont pas un texte JSON : ETAT_ILLISIBLE, raison JSON, comme l'analyse le
// lèverait d'un texte qui ne se lit pas.
function decoder(octets) {
  if (!(octets instanceof Uint8Array)) throw new TypeError('importer : les octets du fichier sont un Uint8Array');
  try {
    return UTF8_STRICT.decode(octets);
  } catch {
    throw new ErreurStockage('ETAT_ILLISIBLE', { raison: 'JSON', chemin: null });
  }
}

// Écrit dans racine l'événement id, nom : texteJournal, quand il est donné,
// puis texteEtat, tels quels, sous une base libre que nom dérive. Rend cette
// base. IDENTIFIANT_PRESENT quand un état lisible du dossier porte déjà id.
async function deposer(fs, racine, { id, nom, texteEtat, texteJournal }) {
  const present = (await lister(fs, racine)).find((resume) => resume.illisible === null && resume.id === id);
  if (present !== undefined) throw new ErreurStockage('IDENTIFIANT_PRESENT', { id, base: present.base });
  const { separateur } = await fs.emplacements();
  const existantes = await basesPrises(fs, racine);
  const base = deriverBase(nom, { racine: racine.chemin, separateur, existantes });
  if (texteJournal !== null) await fs.ecrireAtomique(racine, base + SUFFIXES.journal, texteJournal);
  await fs.ecrireAtomique(racine, base + SUFFIXES.etat, texteEtat);
  return base;
}

/**
 * Importe un fichier d'état venu d'ailleurs (§ 8.7) : ses octets, lus en
 * UTF-8, se copient tels quels — marque d'ordre d'octets, fins de ligne et
 * mise en page comprises — sous une base libre que dérive le nom qu'il
 * porte. Aucun journal ne s'écrit, et rien ne se convertit : un fichier d'un
 * format plus récent, que l'analyse lit réduit à ce qu'elle connaît, s'ouvre
 * ensuite en lecture seule.
 *
 * @param {import('./systeme_fichiers.js').SystemeFichiers} fs
 * @param {import('./systeme_fichiers.js').Racine} racine
 * @param {Uint8Array} octets
 * @returns {Promise<{base: string}>}
 * @throws {ErreurStockage} ETAT_ILLISIBLE {raison, chemin, [format]} de
 *         l'analyse, raison JSON pour des octets hors UTF-8 ; ni base ni
 *         secours : le fichier n'est pas du dossier. IDENTIFIANT_PRESENT {id,
 *         base} quand un état lisible du dossier porte son identifiant ;
 *         CHEMIN_TROP_LONG ; ECRITURE. Rien ne s'écrit avant l'écriture de
 *         l'état
 * @throws {TypeError} des octets qui ne sont pas un Uint8Array
 */
export async function importer(fs, racine, octets) {
  const texte = decoder(octets);
  const { id, nom } = analyser(texte).charge.evenement;
  return { base: await deposer(fs, racine, { id, nom, texteEtat: texte, texteJournal: null }) };
}

/**
 * Importe des événements de l'autre emplacement (§ 8.6) : pour chaque base
 * de depuis, dans l'ordre reçu, l'état et le journal qu'ouvrir lui apparie
 * se copient tels quels dans vers, le journal d'abord, sous une base libre
 * que dérive le nom que porte l'état. Le .precedent ne se copie pas. Les
 * originaux restent où ils sont, sans qu'aucune écriture ne touche depuis.
 * Une base qui ne s'importe pas se refuse par son code — ETAT_ILLISIBLE,
 * ABSENT, IDENTIFIANT_PRESENT, ECRITURE… —, sans arrêter les suivantes ;
 * l'écriture refusée de son état laisse dans vers le journal déjà écrit.
 *
 * @param {import('./systeme_fichiers.js').SystemeFichiers} fs
 * @param {import('./systeme_fichiers.js').Racine} depuis
 * @param {import('./systeme_fichiers.js').Racine} vers
 * @param {Iterable<string>} bases   bases de depuis
 * @returns {Promise<{importes: Array<{base: string, nouvelle: string}>, refuses: Array<{base: string, code: string}>}>}
 *          importes : chaque base importée et sa base dans vers ; refuses :
 *          chaque base refusée et le code de son refus ; l'un et l'autre
 *          dans l'ordre des bases reçues. Une erreur qui n'est pas une
 *          ErreurStockage remonte telle quelle
 */
export async function importerDepuis(fs, depuis, vers, bases) {
  const importes = [];
  const refuses = [];
  for (const base of bases) {
    try {
      const { texteEtat, baseJournal } = await ouvrir(fs, depuis, base);
      const { id, nom } = analyser(texteEtat).charge.evenement;
      const texteJournal =
        baseJournal === null ? null : await texteSiPresent(fs, depuis, baseJournal + SUFFIXES.journal);
      importes.push({ base, nouvelle: await deposer(fs, vers, { id, nom, texteEtat, texteJournal }) });
    } catch (erreur) {
      if (!(erreur instanceof ErreurStockage)) throw erreur;
      refuses.push({ base, code: erreur.code });
    }
  }
  return { importes, refuses };
}

// Base du journal de l'événement de base : celle qu'ouvrir lui apparie quand
// son état se lit ; sinon celle que lister lui apparie par l'identifiant de
// son .precedent, ou du journal sans état, le résumé de base se trouvant
// comme un nom de fichier (nomSurDisque) ; null quand aucun ne lui revient.
// Le journal d'un autre événement n'est jamais le sien. Sur un système qui
// ignore la casse, la base rendue peut différer par la casse du nom du
// journal sur le disque.
async function baseDuJournal(fs, racine, base, insensibleCasse) {
  try {
    return (await ouvrir(fs, racine, base)).baseJournal;
  } catch (erreur) {
    if (erreur.code === 'ABSENT') return null;
    if (erreur.code !== 'ETAT_ILLISIBLE') throw erreur;
  }
  const resumes = await lister(fs, racine);
  const trouvee = nomSurDisque(resumes.map((resume) => resume.base), base, insensibleCasse);
  return resumes.find((resume) => resume.base === trouvee)?.journal ?? null;
}

/**
 * Supprime l'événement de base (§ 8.7) : ses fichiers passent dans un
 * dossier neuf de la corbeille, daté de l'horodatage (dossierCorbeille),
 * créé d'abord — _2, _3… quand la seconde a déjà le sien. Partent l'état, le
 * .precedent, le journal de l'événement (baseDuJournal), jamais celui d'un
 * autre, le verrou, et chacun de leurs fichiers d'écriture atomique restés ;
 * ceux-ci d'abord, puis le verrou, le journal, le .precedent, et l'état en
 * dernier. Sur un système de fichiers qui ignore la casse, un fichier se
 * reconnaît à la clé de son nom, la majuscule de sa NFC, comme deriverBase
 * compare les bases, et part sous son nom sur le disque : un journal, un
 * .precedent ou un verrou d'une autre casse est le même fichier. Sur un
 * système sensible à la casse, seul le nom exact compte. Chaque déplacement
 * porte un fichier entier : une coupure laisse
 * chacun à sa place ou dans la corbeille, jamais perdu, et l'événement se
 * liste encore tant que son état n'est pas parti. Rien ne vide la corbeille.
 *
 * Le dossier daté se crée sous la racine, que creerDossier ne crée pas : un
 * dossier de travail qui disparaît pendant la suppression ne renaît pas
 * (§ 8.6). Disparu avant la création du dossier daté, il fait lever
 * ECRITURE, cause ENOENT ; après, le déplacement du premier fichier qui n'est
 * plus là lève ABSENT.
 *
 * @param {import('./systeme_fichiers.js').SystemeFichiers} fs
 * @param {import('./systeme_fichiers.js').Racine} racine
 * @param {string} base
 * @param {{horodatage: string}} options   AAAA-MM-JJTHH:MM:SS±HH:MM
 * @returns {Promise<{dossier: string}>}   chemin relatif du dossier daté
 * @throws {ErreurStockage} ABSENT {chemin} quand l'événement n'a aucun
 *         fichier, CORBEILLE_SATUREE, l'un et l'autre sans rien écrire ;
 *         ECRITURE de la création du dossier daté ou d'un déplacement
 *         refusé ; EXISTE ; ABSENT {chemin} d'un fichier qui disparaît
 *         pendant les déplacements
 * @throws {TypeError} un horodatage hors de sa forme, sans rien écrire
 */
export async function supprimer(fs, racine, base, { horodatage }) {
  const { insensibleCasse } = await fs.emplacements();
  const journal = await baseDuJournal(fs, racine, base, insensibleCasse);
  const fichiers = [
    base + SUFFIXES.verrou,
    ...(journal === null ? [] : [journal + SUFFIXES.journal]),
    base + SUFFIXES.precedent,
    base + SUFFIXES.etat,
  ];
  const presents = (await fs.lister(racine, ''))
    .filter(({ type }) => type === 'fichier')
    .map(({ nom }) => nom)
    .sort(comparerTextes);
  const partants = [...fichiers.map((nom) => nom + SUFFIXE_ECRITURE), ...fichiers]
    .map((nom) => nomSurDisque(presents, nom, insensibleCasse))
    .filter((nom) => nom !== null);
  if (partants.length === 0) throw new ErreurStockage('ABSENT', { chemin: base + SUFFIXES.etat });
  const existants = (await entreesDe(fs, racine, DOSSIER_CORBEILLE)).map(({ nom }) => nom);
  const dossier = dossierCorbeille(horodatage, existants);
  await fs.creerDossier(racine, dossier);
  for (const nom of partants) await fs.deplacer(racine, nom, `${dossier}/${nom}`);
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
