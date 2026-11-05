// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La police embarquée vue des épreuves, sous node comme dans le navigateur :
// ce module ne lit aucun fichier. Il porte la chaîne témoin du § 19.4 et sa
// longueur attendue, calculée des avances de la police par fontkit — jamais
// saisie (contrainte 26) —, et la lecture du fichier src/polices/PROVENANCE,
// dont le texte lui arrive de l'appelant : readFileSync sous node, « ?raw »
// sous Vite.
import fontkit from '@pdf-lib/fontkit';

/** La chaîne témoin : une capitale accentuée haute, des jambages, une
 *  ligature (« fi »), un tiret cadratin, les capitales larges, des
 *  diacritiques. Sa longueur rendue trahit une police de repli. */
export const CHAINE_TEMOIN = 'Ôjgq Æ W — Benoît Œuvre fi';

/**
 * La longueur de texte, en px, au corps corpsPx, de la police dont octets
 * sont le fichier : la somme des avances des glyphes de chaque point de
 * code, sans crénage ni ligature : la mise en forme de fontkit sans ses
 * traits « kern » et « liga » la redonne. Un rendu qui la compare doit les
 * couper lui aussi (font-kerning: none, font-variant-ligatures: none) :
 * dans Noto Sans Bold, la ligature « fi » avance d'une unité de moins que
 * « f » puis « i ».
 *
 * @param {Uint8Array} octets   un fichier TrueType ou OpenType
 * @param {number} corpsPx      nombre fini > 0
 * @param {string} [texte]      CHAINE_TEMOIN par défaut
 * @returns {number}
 * @throws {RangeError} un corps qui n'est pas un nombre fini > 0
 */
export function longueurTemoin(octets, corpsPx, texte = CHAINE_TEMOIN) {
  if (!Number.isFinite(corpsPx) || corpsPx <= 0) {
    throw new RangeError(`longueurTemoin : corps fini > 0 attendu, reçu ${String(corpsPx)}`);
  }
  const police = fontkit.create(octets);
  let unites = 0;
  for (const caractere of texte) unites += police.glyphForCodePoint(caractere.codePointAt(0)).advanceWidth;
  return (unites / police.unitsPerEm) * corpsPx;
}

// Une ligne « fichier <nom> : <chemin amont>, <n> octets, sha256 <hex> » de
// PROVENANCE, et la ligne « clé : valeur » de l'en-tête.
const LIGNE_FICHIER = /^fichier (\S+) : (\S+), (\d+) octets, sha256 ([0-9a-f]{64})$/gm;
const LIGNE_CLE = (cle) => new RegExp(`^${cle} : (.+)$`, 'm');

/**
 * Ce que src/polices/PROVENANCE déclare : la version amont, et pour chaque
 * fichier versionné — les deux polices, la licence — sa taille et son
 * empreinte SHA-256, dans l'ordre du texte.
 *
 * @param {string} texte   le contenu de PROVENANCE
 * @returns {{version: string|null, fichiers: Array<{nom: string, amont: string, octets: number, sha256: string}>}}
 */
export function lireProvenance(texte) {
  const version = LIGNE_CLE('version').exec(texte)?.[1] ?? null;
  const fichiers = [...texte.matchAll(LIGNE_FICHIER)].map(([, nom, amont, octets, sha256]) => ({
    nom,
    amont,
    octets: Number(octets),
    sha256,
  }));
  return { version, fichiers };
}
