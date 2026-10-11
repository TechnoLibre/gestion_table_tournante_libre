// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La forme d'une étiquette et la découpe d'une saisie (§ 4.5). C'est le seul
// lieu de cette règle : le schéma du fichier, le CSV, les commandes et
// l'écran l'importent d'ici. L'identité de deux orthographes — la clé
// normalisée — et leur réconciliation vivent dans src/csv/etiquettes.js.
//
// Une étiquette est un texte en NFC, sans blanc en bord, ses blancs
// intérieurs réduits à une espace U+0020, de 1 à ETIQUETTE_LONGUEUR_MAX
// points de code. Elle ne porte aucun séparateur d'une cellule, aucun
// caractère de contrôle ou invisible ni moitié de paire de substitution
// isolée. Un caractère invisible ne se voit pas, ou retourne l'affichage du
// texte qui le suit : gardé, il ferait deux étiquettes d'apparence égale que
// le moteur, qui compare par égalité de chaînes, tiendrait pour deux. Ce sont
// les caractères de contrôle (catégorie Cc, tabulation comprise), de format
// (Cf : trait d'union conditionnel, espace, liant et antiliant sans chasse,
// gluon de mots, enchâssements, forçages et isolats bidirectionnels, U+FEFF)
// et ignorables par défaut (Default_Ignorable_Code_Point, dont remplisseurs
// hangul, lien de graphèmes et sélecteurs de variante), la même famille que
// celle qu'un nom de fichier perd (src/stockage/noms.js). Un blanc est un
// caractère d'espacement Unicode qui n'est pas un caractère de contrôle :
// aucun n'est de format ni ignorable, la tabulation n'en est jamais un, et la
// saisie qui la porte, au bord comme au milieu, est fautive au lieu d'être
// nettoyée.

/** Le plus grand nombre de points de code d'une étiquette (§ 4.5). */
export const ETIQUETTE_LONGUEUR_MAX = 40;

/** Le plus grand nombre d'étiquettes d'une personne ou d'un objectif (§ 4.5). */
export const ETIQUETTES_MAX = 20;

/**
 * Les caractères qui séparent deux étiquettes d'une saisie ou d'une cellule
 * CSV (§ 4.5, § 10.1) : la virgule, le point-virgule, la barre verticale, et
 * les deux caractères d'une fin de ligne, CR et LF.
 * @type {ReadonlyArray<string>}
 */
export const SEPARATEURS_ETIQUETTES = Object.freeze([',', ';', '|', '\u{000D}', '\u{000A}']);

// La découpe : une classe de chaque séparateur, chacun écrit par son point
// de code, que le drapeau u admet quel que soit le caractère.
const DECOUPE = new RegExp(
  `[${SEPARATEURS_ETIQUETTES.map((separateur) => `\\u{${separateur.codePointAt(0).toString(16)}}`).join('')}]`,
  'u',
);
// Une suite de blancs : espacement Unicode hors des caractères de contrôle.
const BLANCS = /(?:(?!\p{Cc})\p{White_Space})+/gu;
// Un caractère de contrôle ou invisible, au sens de l'en-tête.
const CONTROLE = /[\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}]/u;

// Le texte en NFC, chaque suite de blancs réduite à une espace, sans espace
// en bord.
function mettreEnForme(texte) {
  const reduit = texte.normalize('NFC').replace(BLANCS, ' ');
  return reduit.slice(reduit.startsWith(' ') ? 1 : 0, reduit.endsWith(' ') ? -1 : undefined);
}

// La raison qui rend fautive une valeur déjà mise en forme et non vide, ou
// null : 'controle' pour un caractère de contrôle ou invisible ou une moitié
// de paire isolée, qui passe avant 'longueur', au-delà
// d'ETIQUETTE_LONGUEUR_MAX points de code.
function raisonDeFaute(valeur) {
  if (CONTROLE.test(valeur) || !valeur.isWellFormed()) return 'controle';
  if ([...valeur].length > ETIQUETTE_LONGUEUR_MAX) return 'longueur';
  return null;
}

/**
 * Vrai quand texte a la forme d'une étiquette (§ 4.5) : un texte en NFC,
 * déjà mis en forme — ni blanc en bord, ni blanc autre qu'une espace seule
 * —, sans séparateur, sans caractère de contrôle ou invisible ni moitié de
 * paire isolée, de 1 à ETIQUETTE_LONGUEUR_MAX points de code. Faux pour ce
 * qui n'est pas un texte.
 *
 * @param {unknown} texte
 * @returns {boolean}
 */
export function estEtiquetteBienFormee(texte) {
  return (
    typeof texte === 'string' &&
    texte !== '' &&
    !DECOUPE.test(texte) &&
    mettreEnForme(texte) === texte &&
    raisonDeFaute(texte) === null
  );
}

/**
 * Découpe une saisie en étiquettes (§ 4.5) : coupée à chaque séparateur
 * (SEPARATEURS_ETIQUETTES), chaque morceau mis en NFC, ses blancs réduits à
 * une espace et ses bords nettoyés ; un morceau vide s'écarte sans faute.
 * Rend etiquettes, les morceaux bien formés dans l'ordre de la saisie, un
 * doublon exact fondu à sa première place, et fautes, les morceaux fautifs
 * mis en forme { valeur, raison } dans le même ordre, chaque valeur une
 * fois ; raison vaut 'controle' pour un caractère de contrôle ou invisible ou
 * une moitié de paire isolée, 'longueur' au-delà d'ETIQUETTE_LONGUEUR_MAX
 * points de code. Le nombre d'étiquettes ne se borne pas ici : l'appelant le
 * compare à ETIQUETTES_MAX. Deux orthographes de même clé restent deux
 * étiquettes : leur réconciliation appartient à src/csv/etiquettes.js. Chaque
 * étiquette rendue satisfait estEtiquetteBienFormee.
 *
 * @param {string} texte
 * @returns {{etiquettes: string[], fautes: Array<{valeur: string, raison: 'controle'|'longueur'}>}}
 * @throws {TypeError} quand texte n'est pas un texte
 */
export function lireEtiquettes(texte) {
  if (typeof texte !== 'string') {
    throw new TypeError(`lireEtiquettes : texte attendu, reçu ${JSON.stringify(texte) ?? String(texte)}`);
  }
  const etiquettes = [];
  const fautes = [];
  const vues = new Set();
  for (const morceau of texte.split(DECOUPE)) {
    const valeur = mettreEnForme(morceau);
    if (valeur === '' || vues.has(valeur)) continue;
    vues.add(valeur);
    const raison = raisonDeFaute(valeur);
    if (raison === null) etiquettes.push(valeur);
    else fautes.push({ valeur, raison });
  }
  return { etiquettes, fautes };
}
