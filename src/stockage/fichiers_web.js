// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Système de fichiers de la plateforme web (§ 13.1, § 13.4) : l'interface de
// systeme_fichiers.js portée par l'OPFS du navigateur, que
// navigator.storage.getDirectory() ouvre. Avec fichiers_electron.js, ce module
// est l'une des deux exceptions nommées de la frontière des couches : il
// touche navigator pour l'OPFS, et document pour le champ de fichier et le
// lien de téléchargement. Il n'y touche qu'à l'appel d'une primitive : le
// charger hors d'un navigateur ne lève rien.
//
// Une seule racine, documents : le dossier gestion_table_tournante_libre de
// l'OPFS, affiché « /gestion_table_tournante_libre ». Ni exécutable publié,
// ni données applicatives, ni racine portable ; le support est inconnu.
//
// La plateforme n'offre ni renommage atomique ni verrou (§ 8.8) et le dit :
// renommageAtomique et verrouDisponible sont faux, et l'application
// l'annonce au démarrage. ecrireAtomique, ecrireOctetsAtomique et ajouterLigne
// écrivent par un flux de l'OPFS ouvert sur la cible (createWritable) : le
// contenu n'atteint la
// cible qu'à la fermeture du flux ; un échec avant elle abandonne le flux et
// retire le fichier que l'appel a créé, si bien que la cible reste telle
// qu'avant l'appel. Rien ne garantit ce que devient une fermeture
// interrompue. deplacer copie les octets de la source sous la cible, puis
// retire la source ; un échec du retrait retire la copie. verrouiller rend
// { pris: true } sans rien écrire, et deverrouiller n'efface rien.
//
// supprimerDossier demande au dossier qui porte la cible de retirer son
// entrée, par removeEntry sans l'option recursive : l'OPFS retire alors la
// poignée d'un dossier vide, et refuse un dossier qui porte une entrée par
// InvalidModificationError, que le module lève NON_VIDE ; un fichier
// d'échange .crswap y compte comme toute entrée.
//
// L'OPFS compare les noms à la lettre : la casse et la forme de normalisation
// distinguent deux fichiers, d'où insensibleCasse faux. Il ne date pas un
// dossier, que lister date de 0. Pendant l'écriture d'un flux, Chromium peut
// poser à côté de la cible un fichier d'échange, <nom>.crswap, que lister
// rend comme toute entrée ; un fichier qui disparaît entre la liste et sa
// lecture n'est pas rendu.
//
// L'OPFS et le fichier choisi lèvent des DOMException, que le module traduit
// en codes. Une lecture qui ne trouve pas l'entrée — NotFoundError, ou
// TypeMismatchError pour une entrée d'un autre genre que celui demandé, hors
// le cas d'un nom non converti ci-dessous — lève ABSENT ; toute autre
// exception d'une lecture lève LECTURE, car une panne n'est pas une
// absence ; tout échec d'une écriture lève ECRITURE. Les
// deux portent {chemin, dossier, cause}, dont la cause est le nom de
// l'exception : SecurityError pour un OPFS que le navigateur refuse à
// l'origine, NotReadableError pour un fichier qui change pendant qu'on le
// lit, NotFoundError pour une écriture dans un dossier absent,
// TypeMismatchError, QuotaExceededError… Le chemin '' désigne la racine
// elle-même, un dossier.
//
// Sous des paramètres régionaux qui ne sont pas UTF-8, Chromium sous Linux
// ne convertit pas un nom hors ASCII et le résout sur le dossier qui le
// porte : un dossier de ce nom rend ce dossier sans lever, un fichier de ce
// nom lève TypeMismatchError comme pour une entrée d'un autre genre. Chaque
// dossier du chemin se compare donc au dossier qui le porte (isSameEntry) ;
// une TypeMismatchError sur un fichier se départage en demandant le même nom
// comme dossier, comparé de même. La même entrée lève, cause
// NOM_NON_CONVERTI — LECTURE pour une lecture, ECRITURE pour une écriture —,
// jamais ABSENT ni EXISTE : rien ne se lit ni ne s'écrit dans le dossier qui
// le porte, et un fichier présent ne se lit pas absent.
//
// Sous web, ni explorateur ni dialogue de dossier : ouvrirDansExplorateur,
// le chemin admis, et choisirDossier lèvent NON_DISPONIBLE {primitive}.
// choisirFichierAImporter passe par un champ de fichier, que le navigateur
// n'ouvre que dans le prolongement d'un geste de l'opérateur, et qui ne dit
// du fichier choisi que son nom : l'échec de sa lecture le nomme, dossier
// null. Un genre restreint le champ par accept, et sa taille, connue avant
// la lecture, se compare au plafond du genre. enregistrerSous passe par un
// lien de téléchargement : le navigateur range le fichier sans dire où ni si
// l'opérateur y renonce, et la primitive rend le nom proposé. L'adresse du
// contenu se libère à une minuterie de l'horloge que le système reçoit à sa
// création, celle de l'application (§ 19.4) : le stockage n'arme aucune
// minuterie du moteur d'exécution.
import { ErreurStockage } from './erreurs.js';
import { exigerCheminRelatif, exigerDepuis, exigerOctets, genreAImporter } from './systeme_fichiers.js';

// Le dossier du produit dans l'OPFS, et la racine documents qui le désigne.
const DOSSIER_PRODUIT = 'gestion_table_tournante_libre';
const DOCUMENTS = 'documents';
const CHEMIN_DOCUMENTS = `/${DOSSIER_PRODUIT}`;

// Nom du témoin de la sonde (§ 8.6), qui porte aussi ce nom pour texte.
export const TEMOIN = '.gtt-temoin';

// Cause d'une écriture qui vise un dossier — la racine elle-même, ou un
// dossier là où un fichier est attendu —, celle que lève l'OPFS.
const TYPE_DIFFERENT = 'TypeMismatchError';

// L'exception de removeEntry, sans recursive, sur un dossier qui porte une
// entrée.
const DOSSIER_NON_VIDE = 'InvalidModificationError';

// Cause d'une sonde dont le témoin relu diffère du texte écrit.
const RELECTURE_DIFFERENTE = 'RELECTURE_DIFFERENTE';

// Cause d'un nom, de dossier ou de fichier, que l'OPFS résout sur le dossier
// qui le porte.
const NOM_NON_CONVERTI = 'NOM_NON_CONVERTI';

// Un fichier s'écrit en UTF-8 sans marque d'ordre d'octets, et se lit sans
// retirer celle qu'il porte, que Blob.text retirerait. Le décodage est
// strict : un octet qui n'est pas de l'UTF-8 ne se lit pas U+FFFD.
const UTF8 = new TextEncoder();
const DECODEUR = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

// Un nettoyage qui échoue ne masque pas l'échec qu'il suit.
const ignorer = () => {};

// Vrai pour l'exception de l'OPFS qui dit qu'une entrée manque : absente, ou
// d'un autre genre que celui demandé. Une TypeMismatchError de fichier passe
// d'abord par fichierDe, qui lève NOM_NON_CONVERTI à sa place quand le nom
// n'est pas converti.
const estAbsence = (erreur) => erreur?.name === 'NotFoundError' || erreur?.name === TYPE_DIFFERENT;

// Cause d'une ECRITURE ou d'une LECTURE : le nom de l'exception, ou son
// texte quand elle n'en porte pas.
const causeDe = (erreur) => (typeof erreur?.name === 'string' && erreur.name !== '' ? erreur.name : String(erreur));

function exigerChaine(valeur, quoi) {
  if (typeof valeur !== 'string') throw new TypeError(`${quoi} n'est pas une chaîne`);
}

function exigerSeance(seance) {
  if (typeof seance !== 'string' || seance === '') throw new TypeError("la séance n'est pas une chaîne non vide");
}

// Ce que désigne un chemin relatif à la racine : ses segments, ceux du
// dossier qui le porte, son nom — null pour '', la racine elle-même —, et le
// chemin affichable de ce dossier, celui de la racine pour ''. CHEMIN_REFUSE
// pour un chemin refusé ou une racine inconnue, reconnue par son seul
// identifiant.
function localiser(racine, chemin) {
  const segments = exigerCheminRelatif(chemin);
  if (racine?.id !== DOCUMENTS) throw new ErreurStockage('CHEMIN_REFUSE', { chemin });
  const parent = segments.slice(0, -1);
  return {
    chemin,
    segments,
    parent,
    nom: segments.length > 0 ? segments[segments.length - 1] : null,
    dossier: [CHEMIN_DOCUMENTS, ...parent].join('/'),
  };
}

const refus = (loc, cause) => new ErreurStockage('ECRITURE', { chemin: loc.chemin, dossier: loc.dossier, cause });

const absent = (chemin) => new ErreurStockage('ABSENT', { chemin });

// Ce que devient l'exception d'une lecture de loc : ABSENT quand l'entrée
// manque, LECTURE sinon.
const echecLecture = (loc, erreur) =>
  estAbsence(erreur)
    ? absent(loc.chemin)
    : new ErreurStockage('LECTURE', { chemin: loc.chemin, dossier: loc.dossier, cause: causeDe(erreur) });

// Exécute travail, une écriture sur loc, et rend ce qu'il rend : une
// ErreurStockage passe telle quelle, toute autre exception devient ECRITURE.
async function ecrire(loc, travail) {
  try {
    return await travail();
  } catch (erreur) {
    if (erreur instanceof ErreurStockage) throw erreur;
    throw refus(loc, causeDe(erreur));
  }
}

// Poignée du dossier nom sous parent. Lève une DOMException de nom
// NOM_NON_CONVERTI quand l'OPFS rend parent lui-même pour ce nom.
async function sousDossier(parent, nom, options) {
  const dossier = await parent.getDirectoryHandle(nom, options);
  if (await dossier.isSameEntry(parent)) throw new DOMException(nom, NOM_NON_CONVERTI);
  return dossier;
}

// Vrai quand l'OPFS résout nom, demandé comme dossier, sur dossier lui-même ;
// faux pour toute autre poignée, ou quand la demande lève.
async function resoutSurLuiMeme(dossier, nom) {
  try {
    return await (await dossier.getDirectoryHandle(nom)).isSameEntry(dossier);
  } catch {
    return false;
  }
}

// Poignée du fichier nom du dossier. Lève l'exception de l'OPFS, sauf une
// TypeMismatchError dont le nom se résout sur le dossier lui-même, qui
// devient une DOMException de nom NOM_NON_CONVERTI.
async function fichierDe(dossier, nom, options) {
  try {
    return await dossier.getFileHandle(nom, options);
  } catch (erreur) {
    if (erreur?.name === TYPE_DIFFERENT && (await resoutSurLuiMeme(dossier, nom))) {
      throw new DOMException(nom, NOM_NON_CONVERTI);
    }
    throw erreur;
  }
}

// Poignée du dossier que désignent les segments sous le dossier du produit ;
// creer crée ce qui manque sous lui. Le dossier du produit lui-même ne se
// crée que pour des segments vides, qui le désignent : un chemin sous un
// dossier du produit absent lève NotFoundError (§ 8.6). Lève l'exception de
// l'OPFS : NotFoundError pour un dossier absent, TypeMismatchError pour un
// fichier à sa place ; NOM_NON_CONVERTI pour un dossier résolu sur celui qui
// le porte.
async function dossierDe(segments, creer = false) {
  const options = { create: creer };
  const produit = { create: creer && segments.length === 0 };
  let dossier = await sousDossier(await navigator.storage.getDirectory(), DOSSIER_PRODUIT, produit);
  for (const segment of segments) dossier = await sousDossier(dossier, segment, options);
  return dossier;
}

// Le dossier que désignent les segments, ou null quand il n'existe pas.
async function dossierExistant(segments) {
  try {
    return await dossierDe(segments);
  } catch (erreur) {
    if (estAbsence(erreur)) return null;
    throw erreur;
  }
}

// Genre de l'entrée nom du dossier : 'fichier', 'dossier', ou null quand elle
// n'existe pas. Un nom non converti lève NOM_NON_CONVERTI.
async function genreDe(dossier, nom) {
  try {
    await fichierDe(dossier, nom);
    return 'fichier';
  } catch (erreur) {
    if (erreur?.name === TYPE_DIFFERENT) return 'dossier';
    if (erreur?.name === 'NotFoundError') return null;
    throw erreur;
  }
}

// Retire l'entrée nom du dossier ; une entrée absente n'est pas une faute.
async function retirer(dossier, nom) {
  try {
    await dossier.removeEntry(nom);
  } catch (erreur) {
    if (erreur?.name !== 'NotFoundError') throw erreur;
  }
}

// Retire le dossier vide que désigne loc, sans jamais toucher à ce qu'il
// porte : sa poignée se demande d'abord comme dossier — un fichier à sa
// place lève ECRITURE TypeMismatchError, un nom résolu sur le dossier qui le
// porte NOM_NON_CONVERTI —, puis le dossier qui le porte retire l'entrée
// sans recursive. Un dossier absent, ou sous un parent absent, ne lève pas ;
// un dossier qui porte une entrée lève NON_VIDE et reste. removeEntry retire
// l'entrée du nom quel que soit son genre : un autre onglet qui mettrait un
// fichier à la place du dossier entre les deux appels le verrait retiré, le
// web n'ayant pas de verrou entre onglets. Un dossier qu'un autre onglet
// retire entre les deux appels est absent, et ne lève pas.
async function retirerDossierVide(loc) {
  const parent = await dossierExistant(loc.parent);
  if (parent === null) return;
  try {
    await sousDossier(parent, loc.nom);
  } catch (erreur) {
    if (erreur?.name === 'NotFoundError') return;
    throw erreur;
  }
  try {
    await parent.removeEntry(loc.nom);
  } catch (erreur) {
    if (erreur?.name === 'NotFoundError') return;
    if (erreur?.name === DOSSIER_NON_VIDE) throw new ErreurStockage('NON_VIDE', { chemin: loc.chemin });
    throw erreur;
  }
}

// Les octets d'un fichier, dans un tableau neuf.
const octetsDe = async (poignee) => new Uint8Array(await (await poignee.getFile()).arrayBuffer());

// Ce que porte un fichier : { texte, octets }, ses octets et leur décodage
// tel quel ; texte null quand ils ne sont pas de l'UTF-8.
async function lire(poignee) {
  const octets = await octetsDe(poignee);
  try {
    return { texte: DECODEUR.decode(octets), octets };
  } catch {
    return { texte: null, octets };
  }
}

// Écrit le fichier nom du dossier par un flux de l'OPFS, que remplir(flux,
// poignee) alimente ; garder ouvre le flux sur le contenu présent, sinon sur
// un contenu vide. Le contenu n'atteint le fichier qu'à la fermeture du flux.
// Un échec abandonne le flux, retire le fichier quand l'appel l'a créé, puis
// se relance : le fichier reste tel qu'avant l'appel.
async function ecrireParFlux(dossier, nom, garder, remplir) {
  let poignee;
  let cree = false;
  try {
    poignee = await fichierDe(dossier, nom);
  } catch (erreur) {
    if (erreur?.name !== 'NotFoundError') throw erreur;
    poignee = await dossier.getFileHandle(nom, { create: true });
    cree = true;
  }
  let flux = null;
  try {
    flux = await poignee.createWritable({ keepExistingData: garder });
    await remplir(flux, poignee);
    await flux.close();
  } catch (erreur) {
    if (flux !== null) await flux.abort().catch(ignorer);
    if (cree) await dossier.removeEntry(nom).catch(ignorer);
    throw erreur;
  }
}

// Description d'une entrée d'un dossier, ou null pour un fichier disparu
// entre la liste et sa lecture.
async function decrire(poignee) {
  if (poignee.kind === 'directory') return { nom: poignee.name, type: 'dossier', taille: 0, modifie: 0 };
  try {
    const fichier = await poignee.getFile();
    return { nom: poignee.name, type: 'fichier', taille: fichier.size, modifie: fichier.lastModified };
  } catch (erreur) {
    if (erreur?.name === 'NotFoundError') return null;
    throw erreur;
  }
}

// Ordre des entrées : leurs noms comparés par unités UTF-16, une à une.
const parNom = (a, b) => (a.nom < b.nom ? -1 : a.nom > b.nom ? 1 : 0);

// La source de deplacer : le dossier qui la porte et ses octets. ABSENT quand
// elle n'existe pas ; ECRITURE TypeMismatchError quand c'est un dossier ;
// NOM_NON_CONVERTI, que genreDe lève, avant toute lecture de ses octets.
async function lireSource(loc) {
  if (loc.nom === null) throw refus(loc, TYPE_DIFFERENT);
  const dossier = await dossierExistant(loc.parent);
  const genre = dossier === null ? null : await genreDe(dossier, loc.nom);
  if (genre === null) throw absent(loc.chemin);
  if (genre === 'dossier') throw refus(loc, TYPE_DIFFERENT);
  const fichier = await (await dossier.getFileHandle(loc.nom)).getFile();
  return { dossier, octets: await fichier.arrayBuffer() };
}

// Écrit les octets sous la cible de deplacer, et rend le dossier qui la
// porte. EXISTE quand une entrée y porte déjà ce nom, quel qu'en soit le
// genre, et pour '', la racine elle-même.
async function copierVers(loc, octets) {
  if (loc.nom === null) throw new ErreurStockage('EXISTE', { chemin: loc.chemin });
  const dossier = await dossierDe(loc.parent);
  if ((await genreDe(dossier, loc.nom)) !== null) throw new ErreurStockage('EXISTE', { chemin: loc.chemin });
  await ecrireParFlux(dossier, loc.nom, false, (flux) => flux.write(octets));
  return dossier;
}

// Ouvre le dialogue du navigateur par un champ de fichier, hors du document,
// et rend le nom et les octets du fichier choisi ; null quand l'opérateur
// annule — l'événement cancel — ou que le champ revient sans fichier. Un
// genre, de genreAImporter, donne au champ son accept, et un fichier plus
// lourd que son plafond lève TROP_VOLUMINEUX sans être lu. Un fichier
// choisi qui ne se lit pas lève ABSENT ou LECTURE sous son nom.
function choisirFichier(genre) {
  return new Promise((resoudre, rejeter) => {
    const champ = document.createElement('input');
    champ.type = 'file';
    if (genre !== null) champ.accept = genre.accept;
    champ.addEventListener('cancel', () => resoudre(null), { once: true });
    champ.addEventListener(
      'change',
      () => {
        const fichier = champ.files[0];
        if (fichier === undefined) {
          resoudre(null);
          return;
        }
        if (genre !== null && fichier.size > genre.maxOctets) {
          const details = { chemin: fichier.name, dossier: null, taille: fichier.size, max: genre.maxOctets };
          rejeter(new ErreurStockage('TROP_VOLUMINEUX', details));
          return;
        }
        fichier.arrayBuffer().then(
          (tampon) => resoudre({ nom: fichier.name, octets: new Uint8Array(tampon) }),
          (erreur) => rejeter(echecLecture({ chemin: fichier.name, dossier: null }, erreur)),
        );
      },
      { once: true },
    );
    champ.click();
  });
}

/**
 * Système de fichiers de la plateforme web, sur l'OPFS. Chaque appel rend un
 * système neuf ; tous partagent l'OPFS de l'origine. horloge est celle de
 * l'application, dont il n'appelle que planifier.
 *
 * @param {{planifier: (fn: () => void, ms: number) => unknown}} horloge
 * @returns {import('./systeme_fichiers.js').SystemeFichiers}
 * @throws {TypeError} une horloge sans planifier
 */
export function creerFichiersWeb(horloge) {
  if (typeof horloge?.planifier !== 'function') throw new TypeError("l'horloge n'a pas de planifier");
  const { planifier } = horloge;
  return {
    nature: 'web',
    renommageAtomique: false,
    verrouDisponible: false,

    emplacements: async () => ({ executable: null, donneesApplicatives: [], insensibleCasse: false, separateur: '/' }),

    racines: async () => ({ portable: null, documents: { id: DOCUMENTS, chemin: CHEMIN_DOCUMENTS } }),

    choisirDossier: async () => {
      throw new ErreurStockage('NON_DISPONIBLE', { primitive: 'choisirDossier' });
    },

    // Crée le dossier du produit, efface un témoin resté, écrit le témoin, le
    // relit, l'efface. Un échec rend sa cause et efface le témoin qu'il
    // laisse ; seule une racine inconnue lève.
    sonder: async (racine) => {
      localiser(racine, '');
      let dossier = null;
      try {
        dossier = await dossierDe([], true);
        await retirer(dossier, TEMOIN);
        await ecrireParFlux(dossier, TEMOIN, false, (flux) => flux.write(UTF8.encode(TEMOIN)));
        const { texte: relu } = await lire(await dossier.getFileHandle(TEMOIN));
        await retirer(dossier, TEMOIN);
        return relu === TEMOIN
          ? { inscriptible: true, cause: null }
          : { inscriptible: false, cause: RELECTURE_DIFFERENTE };
      } catch (erreur) {
        if (dossier !== null) await retirer(dossier, TEMOIN).catch(ignorer);
        return { inscriptible: false, cause: causeDe(erreur) };
      }
    },

    typeSupport: async (racine) => {
      localiser(racine, '');
      return 'inconnu';
    },

    // Des octets hors UTF-8 lèvent LECTURE, cause UTF8_INVALIDE, qui porte
    // ces octets.
    lireTexte: async (racine, chemin) => {
      const loc = localiser(racine, chemin);
      if (loc.nom === null) throw absent(chemin);
      let lu;
      try {
        lu = await lire(await fichierDe(await dossierDe(loc.parent), loc.nom));
      } catch (erreur) {
        throw echecLecture(loc, erreur);
      }
      if (lu.texte === null) {
        const details = { chemin: loc.chemin, dossier: loc.dossier, cause: 'UTF8_INVALIDE', octets: lu.octets };
        throw new ErreurStockage('LECTURE', details);
      }
      return lu.texte;
    },

    lireOctets: async (racine, chemin) => {
      const loc = localiser(racine, chemin);
      if (loc.nom === null) throw absent(chemin);
      try {
        return await octetsDe(await fichierDe(await dossierDe(loc.parent), loc.nom));
      } catch (erreur) {
        throw echecLecture(loc, erreur);
      }
    },

    ecrireAtomique: async (racine, chemin, texte) => {
      exigerChaine(texte, 'le texte');
      const loc = localiser(racine, chemin);
      await ecrire(loc, async () => {
        if (loc.nom === null) throw refus(loc, TYPE_DIFFERENT);
        const octets = UTF8.encode(texte);
        await ecrireParFlux(await dossierDe(loc.parent), loc.nom, false, (flux) => flux.write(octets));
      });
    },

    // Le flux reçoit une copie des octets, prise avant toute attente :
    // l'appelant qui réemploie son tableau ne change pas le fichier.
    ecrireOctetsAtomique: async (racine, chemin, octets) => {
      exigerOctets(octets);
      const copie = new Uint8Array(octets);
      const loc = localiser(racine, chemin);
      await ecrire(loc, async () => {
        if (loc.nom === null) throw refus(loc, TYPE_DIFFERENT);
        await ecrireParFlux(await dossierDe(loc.parent), loc.nom, false, (flux) => flux.write(copie));
      });
    },

    // Le flux garde le contenu présent et écrit la ligne à sa fin.
    ajouterLigne: async (racine, chemin, ligne) => {
      exigerChaine(ligne, 'la ligne');
      if (/[\r\n]/.test(ligne)) throw new TypeError('la ligne porte une fin de ligne');
      const loc = localiser(racine, chemin);
      await ecrire(loc, async () => {
        if (loc.nom === null) throw refus(loc, TYPE_DIFFERENT);
        const octets = UTF8.encode(`${ligne}\n`);
        await ecrireParFlux(await dossierDe(loc.parent), loc.nom, true, async (flux, poignee) => {
          const { size } = await poignee.getFile();
          await flux.write({ type: 'write', position: size, data: octets });
        });
      });
    },

    lister: async (racine, chemin) => {
      const loc = localiser(racine, chemin);
      const entrees = [];
      try {
        for await (const poignee of (await dossierDe(loc.segments)).values()) {
          const entree = await decrire(poignee);
          if (entree !== null) entrees.push(entree);
        }
      } catch (erreur) {
        throw echecLecture(loc, erreur);
      }
      return entrees.sort(parNom);
    },

    creerDossier: async (racine, chemin) => {
      const loc = localiser(racine, chemin);
      await ecrire(loc, () => dossierDe(loc.segments, true));
    },

    // '', le dossier du produit lui-même, se refuse avant tout accès.
    supprimerDossier: async (racine, chemin) => {
      const loc = localiser(racine, chemin);
      if (loc.nom === null) throw new ErreurStockage('CHEMIN_REFUSE', { chemin });
      await ecrire(loc, () => retirerDossierVide(loc));
    },

    // Un échec de la lecture de la source ou de son retrait nomme la source ;
    // un échec de la copie nomme la cible.
    deplacer: async (racine, de, vers) => {
      const source = localiser(racine, de);
      const cible = localiser(racine, vers);
      const { dossier: dossierSource, octets } = await ecrire(source, () => lireSource(source));
      const dossierCible = await ecrire(cible, () => copierVers(cible, octets));
      await ecrire(source, async () => {
        try {
          await dossierSource.removeEntry(source.nom);
        } catch (erreur) {
          await dossierCible.removeEntry(cible.nom).catch(ignorer);
          throw erreur;
        }
      });
    },

    // Retire un fichier ; un dossier, la racine comprise, lève ECRITURE
    // TypeMismatchError et reste.
    supprimer: async (racine, chemin) => {
      const loc = localiser(racine, chemin);
      await ecrire(loc, async () => {
        if (loc.nom === null) throw refus(loc, TYPE_DIFFERENT);
        const dossier = await dossierExistant(loc.parent);
        const genre = dossier === null ? null : await genreDe(dossier, loc.nom);
        if (genre === 'dossier') throw refus(loc, TYPE_DIFFERENT);
        if (genre === 'fichier') await retirer(dossier, loc.nom);
      });
    },

    verrouiller: async (racine, chemin, seance, depuis) => {
      exigerSeance(seance);
      exigerDepuis(depuis);
      localiser(racine, chemin);
      return { pris: true };
    },

    deverrouiller: async (racine, chemin, seance) => {
      exigerSeance(seance);
      localiser(racine, chemin);
    },

    ouvrirDansExplorateur: async (racine, chemin = '') => {
      localiser(racine, chemin);
      throw new ErreurStockage('NON_DISPONIBLE', { primitive: 'ouvrirDansExplorateur' });
    },

    // Le genre se contrôle avant que le champ ne s'ouvre.
    choisirFichierAImporter: async (options) => choisirFichier(genreAImporter(options)),

    // Le clic remet au navigateur l'adresse du contenu, qui se libère à la
    // minuterie de délai nul que l'horloge arme.
    enregistrerSous: async (nomPropose, octets) => {
      if (typeof nomPropose !== 'string' || nomPropose === '') {
        throw new TypeError("le nom proposé n'est pas une chaîne non vide");
      }
      if (!(octets instanceof Uint8Array)) throw new TypeError("les octets ne sont pas un Uint8Array");
      const adresse = URL.createObjectURL(new Blob([octets], { type: 'application/octet-stream' }));
      const lien = document.createElement('a');
      lien.href = adresse;
      lien.download = nomPropose;
      lien.click();
      planifier(() => URL.revokeObjectURL(adresse), 0);
      return nomPropose;
    },
  };
}
