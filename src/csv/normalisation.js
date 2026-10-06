// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Clés de comparaison des textes saisis (§ 10.1). Deux textes qu'un lecteur
// tient pour le même — casse, accents, blancs mis à part — ont la même clé.
// La réconciliation des appartenances et la clé de doublon comparent par la
// même clé : deux règles divergeraient sans qu'aucune épreuve de l'une ne le
// voie. La clé sert à comparer, jamais à afficher.

// Toute marque combinante : accents, cédille, ogonek, marques englobantes.
const MARQUES = /\p{M}/gu;

// Une suite de blancs : espace, tabulation, fins de ligne, espaces
// insécables et typographiques, marque d'ordre d'octets.
const BLANCS = /\s+/gu;

// Ce qu'une clé d'en-tête ignore en plus : l'espace, le trait de
// soulignement et le trait d'union.
const SEPARATEURS_D_ENTETE = /[ _-]/g;

/**
 * Clé de comparaison d'un texte : décomposition canonique (NFD), marques
 * combinantes retirées, minuscules sans égard à la langue, chaque suite de
 * blancs réduite à une espace, blancs de bord retirés. Une lettre sans
 * décomposition canonique, comme « œ » ou une ligature, reste ; la clé d'une
 * clé est elle-même.
 *
 * @param {string} texte
 * @returns {string}
 */
export function cleNormalisee(texte) {
  return texte.normalize('NFD').replace(MARQUES, '').toLowerCase().replace(BLANCS, ' ').trim();
}

/**
 * Clé d'un en-tête de colonne : la clé normalisée, sans espace, « _ » ni « - »,
 * si bien que « Titre-Pressenti », « titre pressenti » et « titre_pressenti »
 * se reconnaissent ensemble.
 *
 * @param {string} texte
 * @returns {string}
 */
export function cleEntete(texte) {
  return cleNormalisee(texte).replace(SEPARATEURS_D_ENTETE, '');
}
