// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le texte du plan (§ 7.4) : la troncature d'un nom dans la largeur d'un bloc
// de noms, et les ordonnées des lignes d'une liste, chaque ligne étant un
// <tspan> à décalage explicite. Aucune fonction ne lit le DOM : la largeur
// d'une chaîne vient d'une mesure injectée, getComputedTextLength au
// navigateur, sur la police rendue (§ 14.1).

/**
 * Gabarit dont se mesure la hauteur de ligne d'une liste : capitales
 * accentuées et jambages, jamais une chaîne moyenne (§ 7.4).
 */
export const GABARIT_HAUTEUR_LIGNE = 'Ôjgq Æ W';

/**
 * Corps du texte des listes de noms, en cm dans le dessin : les étiquettes ne
 * sont pas à l'échelle du mobilier (§ 7.7), et ce corps fixe leur taille dans
 * le dessin, que le zoom agrandit avec le reste.
 */
export const TAILLE_TEXTE_LISTE_CM = 18;

// Vrai pour la première, ou la seconde, moitié d'une paire de substitution.
const estPremiereMoitie = (code) => code >= 0xd800 && code <= 0xdbff;
const estSecondeMoitie = (code) => code >= 0xdc00 && code <= 0xdfff;

/**
 * Le texte entier s'il tient dans largeurMax ; sinon le plus long préfixe
 * qui, suivi de la marque, y tient ; '' quand la marque seule n'y tient pas ;
 * '' reste ''. Le résultat ne dépasse jamais largeurMax.
 *
 * La recherche avance par dichotomie sur le nombre d'unités de code du
 * préfixe, la largeur d'un préfixe croissant avec sa longueur. Une coupe qui
 * tomberait entre les deux moitiés d'une paire de substitution recule d'une
 * unité : le préfixe ne finit jamais sur une moitié de lettre.
 *
 * @param {string} texte
 * @param {number} largeurMax
 * @param {function(string): number} mesurer  largeur d'une chaîne, dans l'unité de largeurMax
 * @param {string} marque  ce qui suit un préfixe tronqué
 * @returns {string}
 */
export function tronquer(texte, largeurMax, mesurer, marque) {
  if (texte === '' || mesurer(texte) <= largeurMax) return texte;
  if (!(mesurer(marque) <= largeurMax)) return '';
  // Fin d'un préfixe de n unités, ramenée hors d'une paire de substitution.
  const coupe = (n) =>
    n > 0 && estPremiereMoitie(texte.charCodeAt(n - 1)) && estSecondeMoitie(texte.charCodeAt(n)) ? n - 1 : n;
  const avecMarque = (n) => texte.slice(0, coupe(n)) + marque;
  // Invariant : le préfixe de bas unités tient, suivi de la marque ; celui de
  // haut unités ne tient pas, le texte entier, suivi de la marque, compris.
  let bas = 0;
  let haut = texte.length;
  while (haut - bas > 1) {
    const milieu = bas + Math.floor((haut - bas) / 2);
    if (mesurer(avecMarque(milieu)) <= largeurMax) bas = milieu;
    else haut = milieu;
  }
  return avecMarque(bas);
}

/**
 * Ordonnées des n lignes d'une liste, la première à 0, chacune d'une hauteur
 * de ligne sous la précédente. Lève RangeError sur un n qui n'est pas un
 * entier ≥ 0.
 * @param {number} n
 * @param {number} hauteurLigne
 * @returns {number[]}
 */
export function decalagesLignes(n, hauteurLigne) {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`nombre de lignes : entier ≥ 0 attendu, reçu ${String(n)}`);
  }
  return Array.from({ length: n }, (_, i) => i * hauteurLigne);
}
