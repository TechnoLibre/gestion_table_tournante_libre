// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La liste des composants tiers que le panneau « À propos » affiche
// (§ 18.6), tirée du seul texte de public/licences/TIERS.txt : aucune liste
// n'est recopiée ailleurs. Le fichier porte un index — une ligne par
// composant, entre « Index » souligné de « - » et la première ligne vide —
// puis une section par composant, chacune derrière une ligne de 72 « = ».
//
// Une ligne d'index de paquet se lit « nom version — licence — fichier » ;
// celle d'une œuvre qu'un paquet incorpore, en retrait de deux espaces,
// « incorporé à P : désignation — licence ». La désignation finit par sa
// version quand son dernier mot commence par un chiffre et ne porte que
// lettres, chiffres, points, tirets et « + » ; sinon — « (X 1.2.3) », qui
// ferme une parenthèse — l'œuvre n'a pas de version. L'en-tête d'une
// section reprend la désignation telle quelle — « paquet : nom
// version » ou « incorporé à P : désignation » — et son corps suit le
// premier filet de 72 « - ». Les sections se coupent sur la seule ligne de
// 72 « = » : un texte amont qui trace ses propres filets, comme le
// LICENSE.TXT de LLVM, reste entier, et un filet de « - » dans un corps
// aussi.
//
// Un paquet se nomme par son seul nom, et une œuvre incorporée par celui de
// son hôte : deux versions d'un même paquet dans l'index se refusent, comme
// une ligne en double, plutôt que de rendre ambigu l'hôte de ses œuvres.
// L'épreuve qui lit le vrai TIERS.txt voit donc ce cas avant qu'il ne parte.
//
// La fonction est pure : le texte de la police, que TIERS.txt renvoie à
// NotoSans-OFL.txt, arrive par voisins, sous le nom de son fichier.

const FILET_SECTION = /^={72}$/mu;
const FILET_CORPS = /^-{72}$/mu;
const DEBUT_INDEX = '\nIndex\n-----\n';
const TIRET = ' \u{2014} ';
const INCORPORE = /^ {2}incorporé à (\S+) : (.+)$/u;
const ENTETE_PAQUET = /^paquet : (.+)$/u;
const ENTETE_INCORPORE = /^incorporé à (\S+) : (.+)$/u;
const AVEC_VERSION = /^(.+) (\d[0-9A-Za-z.+-]*)$/u;

/**
 * Les composants tiers de TIERS.txt, dans l'ordre de son index.
 *
 * cle nomme l'entrée de façon stable : le nom d'un paquet, « P : nom » pour
 * une œuvre incorporée à P. licence est celle de la ligne d'index. hote est
 * le paquet qui incorpore l'œuvre, null pour un paquet ; chaque hôte est un
 * paquet de l'index. texte est le corps de sa section, sans les lignes vides
 * qui la terminent, ou, pour un paquet sans section, le texte voisin que
 * nomme sa ligne d'index.
 *
 * @param {string} texte  le contenu de TIERS.txt
 * @param {Record<string, string>} [voisins]  textes des fichiers voisins,
 *   par nom
 * @returns {{ cle: string, nom: string, version: string|null,
 *   licence: string, hote: string|null, texte: string }[]}
 * @throws {SyntaxError} un index absent, vide ou mal formé, une section sans
 *   filet de « - » ou d'un en-tête inconnu, une section en double
 * @throws {Error} une ligne d'index sans section ni voisin, une section sans
 *   ligne d'index, une clé en double — deux versions d'un même paquet
 *   comprises —, un hôte hors des paquets
 */
export function composantsDesTiers(texte, voisins = {}) {
  const [tete, ...blocs] = texte.split(FILET_SECTION);
  const index = lignesDIndex(tete);

  const sections = new Map();
  for (const bloc of blocs) {
    const filet = FILET_CORPS.exec(bloc);
    if (filet === null) throw new SyntaxError(`tiers : section sans filet de « - » : ${JSON.stringify(bloc.slice(0, 80))}`);
    const [entete] = bloc.slice(0, filet.index).trim().split('\n');
    if (!ENTETE_PAQUET.test(entete) && !ENTETE_INCORPORE.test(entete)) {
      throw new SyntaxError(`tiers : en-tête de section inconnu ${JSON.stringify(entete)}`);
    }
    if (sections.has(entete)) throw new SyntaxError(`tiers : section en double ${JSON.stringify(entete)}`);
    sections.set(entete, bloc.slice(filet.index + filet[0].length + 1).trimEnd());
  }

  const composants = [];
  const paquets = new Set();
  for (const ligne of index) {
    const composant = composantDeLigne(ligne);
    const { entete, fichier, ...entree } = composant;
    if (entree.hote !== null && !paquets.has(entree.hote)) {
      throw new Error(`tiers : « ${entree.nom} » incorporé à « ${entree.hote} », qui n'est pas un paquet de l'index`);
    }
    if (composants.some((c) => c.cle === entree.cle)) throw new Error(`tiers : ligne d'index en double ${JSON.stringify(entree.cle)}`);
    if (sections.has(entete)) {
      entree.texte = sections.get(entete);
      sections.delete(entete);
    } else if (fichier !== null && Object.hasOwn(voisins, fichier)) {
      entree.texte = voisins[fichier];
    } else {
      throw new Error(`tiers : ligne d'index sans section ${JSON.stringify(ligne)}`);
    }
    if (entree.hote === null) paquets.add(entree.nom);
    composants.push(entree);
  }
  if (sections.size > 0) throw new Error(`tiers : section sans ligne d'index ${JSON.stringify([...sections.keys()][0])}`);
  return composants;
}

// Les lignes de l'index : de la ligne qui suit « Index » souligné à la
// première ligne vide.
function lignesDIndex(tete) {
  const debut = tete.indexOf(DEBUT_INDEX);
  if (debut < 0) throw new SyntaxError('tiers : aucun index');
  const corps = tete.slice(debut + DEBUT_INDEX.length);
  const fin = corps.indexOf('\n\n');
  const lignes = (fin < 0 ? corps : corps.slice(0, fin)).split('\n').filter((ligne) => ligne !== '');
  if (lignes.length === 0) throw new SyntaxError('tiers : index vide');
  return lignes;
}

// Une ligne d'index lue : l'entrée, sans texte, l'en-tête de la section qui
// lui répond et, pour un paquet, le fichier que nomme sa ligne.
function composantDeLigne(ligne) {
  const incorpore = INCORPORE.exec(ligne);
  const champs = (incorpore === null ? ligne : incorpore[2]).split(TIRET);
  if (champs.length !== (incorpore === null ? 3 : 2)) throw new SyntaxError(`tiers : ligne d'index mal formée ${JSON.stringify(ligne)}`);
  const [designation, licence, fichier = null] = champs;
  const versionnee = AVEC_VERSION.exec(designation);
  if (incorpore === null) {
    if (versionnee === null) throw new SyntaxError(`tiers : paquet sans version ${JSON.stringify(ligne)}`);
    const [, nom, version] = versionnee;
    return { cle: nom, nom, version, licence, hote: null, entete: `paquet : ${designation}`, fichier };
  }
  const hote = incorpore[1];
  const [nom, version] = versionnee === null ? [designation, null] : versionnee.slice(1);
  return { cle: `${hote} : ${nom}`, nom, version, licence, hote, entete: `incorporé à ${hote} : ${designation}`, fichier };
}
