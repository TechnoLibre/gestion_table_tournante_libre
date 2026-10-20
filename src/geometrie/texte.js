// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le texte du plan (§ 7.4) : la troncature d'un nom dans la largeur d'un bloc
// de noms, le repli d'un libellé de table en lignes de largeurs données, et
// les ordonnées des lignes d'une liste, chaque ligne étant un <tspan> à
// décalage explicite. Aucune fonction ne lit le DOM : la largeur
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

// Une suite de blancs, qui sépare deux mots d'un texte à replier.
const BLANCS = /\s+/u;
// Le liant sans chasse, qui soude le caractère qui le précède à celui qui
// le suit.
const LIANT = '\u{200D}';
// Une marque combinante, sélecteurs de variante compris.
const COMBINANTE = /^\p{M}/u;

// Les fins admises d'un préfixe de texte, en unités UTF-16, croissantes, 0
// et texte.length compris : le début de chaque point de code — jamais entre
// les deux moitiés d'une paire de substitution — qui n'est ni une marque
// combinante ni un liant sans chasse, et ne suit pas un liant.
function finsAdmises(texte) {
  const fins = [0];
  let position = 0;
  let precedent = null;
  for (const point of texte) {
    if (position > 0 && precedent !== LIANT && point !== LIANT && !COMBINANTE.test(point)) fins.push(position);
    position += point.length;
    precedent = point;
  }
  if (texte.length > 0) fins.push(texte.length);
  return fins;
}

// La plus grande fin admise de texte (finsAdmises), hors de 0, dont le
// préfixe, mis en forme par habiller, mesure au plus largeur ; 0 quand
// aucune ne tient. La largeur d'un préfixe habillé croît avec sa fin : la
// recherche avance par dichotomie.
function plusLongueFin(texte, largeur, mesurer, habiller = (prefixe) => prefixe) {
  const fins = finsAdmises(texte);
  let bas = 0;
  let haut = fins.length;
  // Invariant : la fin de rang bas tient, ou bas vaut 0 ; celle de rang
  // haut ne tient pas, ou haut est hors de la liste.
  while (haut - bas > 1) {
    const milieu = bas + Math.floor((haut - bas) / 2);
    if (mesurer(habiller(texte.slice(0, fins[milieu]))) <= largeur) bas = milieu;
    else haut = milieu;
  }
  return fins[bas];
}

// Le plus long préfixe de texte qui, ses blancs de fin retirés et suivi de
// la marque, tient dans largeur ; '' quand la marque seule n'y tient pas.
function abreger(texte, largeur, mesurer, marque) {
  if (!(mesurer(marque) <= largeur)) return '';
  const habiller = (prefixe) => `${prefixe.trimEnd()}${marque}`;
  return habiller(texte.slice(0, plusLongueFin(texte, largeur, mesurer, habiller)));
}

/**
 * Les lignes d'un texte replié dans des lignes de largeurs données, une
 * ligne au plus par largeur, dans l'ordre (§ 7.4) : le repli d'un libellé
 * de table dans son plateau. Chaque ligne mesure au plus sa largeur.
 *
 * Le texte se coupe en mots à chaque suite de blancs, et chaque ligne prend
 * autant de mots entiers que sa largeur en tient, séparés d'une espace. Un
 * mot qui ne tient pas seul dans sa ligne s'y coupe entre deux caractères,
 * le plus loin possible, et sa suite ouvre la ligne suivante : une coupe ne
 * tombe jamais entre les deux moitiés d'une paire de substitution, ni devant
 * une marque combinante, ni de part et d'autre d'un liant sans chasse. Ce
 * que la dernière ligne ne tient pas l'abrège : le plus long préfixe de ce
 * qui reste, ses blancs de fin retirés, suivi de la marque. Une ligne trop
 * étroite pour un seul caractère tient lieu de dernière. Une dernière ligne
 * trop étroite pour la marque tombe, et le texte s'arrête à la précédente.
 * Un texte vide, ou fait de blancs, ne rend aucune ligne.
 *
 * @param {string} texte
 * @param {number[]} largeurs   la largeur de chaque ligne, dans l'unité de mesurer
 * @param {function(string): number} mesurer  largeur d'une chaîne
 * @param {string} marque  ce qui suit un texte abrégé
 * @returns {string[]}
 */
export function replier(texte, largeurs, mesurer, marque) {
  // Les mots qui restent à poser, de premier à la fin ; le premier peut
  // être la suite d'un mot coupé.
  const mots = texte.split(BLANCS).filter((mot) => mot !== '');
  const lignes = [];
  let premier = 0;
  for (let rang = 0; rang < largeurs.length && premier < mots.length; rang += 1) {
    const largeur = largeurs[rang];
    let ligne = '';
    let suivant = premier;
    while (suivant < mots.length) {
      const essai = ligne === '' ? mots[suivant] : `${ligne} ${mots[suivant]}`;
      if (mesurer(essai) > largeur) break;
      ligne = essai;
      suivant += 1;
    }
    if (suivant === mots.length) {
      lignes.push(ligne);
      return lignes;
    }
    const coupe = ligne === '' ? plusLongueFin(mots[suivant], largeur, mesurer) : null;
    if (rang === largeurs.length - 1 || coupe === 0) {
      const abregee = abreger(mots.slice(premier).join(' '), largeur, mesurer, marque);
      if (abregee !== '') lignes.push(abregee);
      return lignes;
    }
    if (coupe !== null) {
      ligne = mots[suivant].slice(0, coupe);
      mots[suivant] = mots[suivant].slice(coupe);
    }
    lignes.push(ligne);
    premier = suivant;
  }
  return lignes;
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
