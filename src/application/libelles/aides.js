// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les aides de composition que partagent les tables de l'application : citer,
// compter, énumérer, dater, nommer un état ou des tours. Ce module n'est pas
// une table et n'exporte aucune TABLE. Une aide qui lit le texte d'une autre
// clé reçoit texte, la fonction de composition que la traduction passe à chaque
// entrée (traduction.js) : elle ne connaît pas l'assemblage des tables.
//
// Les aides ne lisent ni l'horloge ni la langue du système : un horodatage se
// met en mots à partir de sa seule forme, AAAA-MM-JJTHH:MM:SS±HH:MM.
import { lireHorodatage } from '../format.js';

const NOMS_DES_ETATS = new Map([
  ['brouillon', 'Brouillon'],
  ['propose', 'Proposé'],
  ['retenu', 'Retenu'],
  ['bloque', 'Bloqué'],
]);

/** Valeur d'une table de noms, ou RangeError qui la nomme. */
export function nomDans(table, valeur, quoi) {
  if (!table.has(valeur)) throw new RangeError(`libelle : ${quoi} inconnu ${JSON.stringify(valeur)}`);
  return table.get(valeur);
}

/** Le nom d'un état du plan (§ 9) ; un état inconnu lève RangeError. */
export const nomEtat = (etat) => nomDans(NOMS_DES_ETATS, etat, 'état');

/** Un texte cité entre guillemets français. */
export const cite = (texte) => `« ${texte} »`;

/** Un compte et son nom, au singulier jusqu'à un, comme le veut le français. */
export const compte = (n, singulier, pluriel) => `${n} ${n <= 1 ? singulier : pluriel}`;

/** Une énumération : « a », « a et b », « a, b et c ». */
export function enumeration(termes) {
  if (termes.length <= 1) return termes.join('');
  return `${termes.slice(0, -1).join(', ')} et ${termes.at(-1)}`;
}

/** La première lettre en capitale. */
export const capitale = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);

/** Le chemin de l'élément fautif, rien quand il manque ou désigne la racine. */
export const element = (chemin) => (typeof chemin === 'string' && chemin !== '' ? ` (${chemin})` : '');

/** Le chemin affichable d'une racine, reçue entière ou par son seul chemin. */
export const cheminDe = (racine) => (typeof racine === 'string' ? racine : racine?.chemin);

/**
 * Une cause entre parenthèses, rien quand elle manque : son texte quand les
 * tables en portent un, sinon la cause telle que le système la nomme.
 */
export function causeEntreParentheses(cause, texte) {
  if (cause === null || cause === undefined || cause === '') return '';
  return ` (${texte.existe(cause) ? texte(cause) : cause})`;
}

/** Ce qu'un refus d'écriture nomme : le fichier, son dossier, la cause. */
export const ouEcrire = ({ chemin, dossier, cause }, texte) =>
  `${cite(chemin)} dans le dossier ${cite(dossier)}${causeEntreParentheses(cause, texte)}`;

/**
 * Une raison codée en une phrase : son texte quand les tables en portent un
 * et que les détails reçus lui suffisent ; sinon une phrase générique qui la
 * cite telle quelle. Un texte qui attend ses propres détails lève ou rend
 * « undefined » sans eux : la phrase générique le remplace alors.
 */
export function phraseDeRaison(raison, details, texte) {
  const generique = `La raison donnée est ${cite(String(raison))}.`;
  if (!texte.existe(raison)) return generique;
  try {
    const rendu = texte(raison, details);
    return typeof rendu === 'string' && !rendu.includes('undefined') ? rendu : generique;
  } catch {
    return generique;
  }
}

/** Des numéros de proposition, un illisible nommé comme tel. */
export const numeros = (ids) => enumeration(ids.map((id) => (id === null ? 'sans numéro lisible' : `n° ${id}`)));

/**
 * Un horodatage AAAA-MM-JJTHH:MM:SS±HH:MM en mots, « le 17 mai 2031 à
 * 8 h 05 », à l'heure qu'il porte, par les textes de la mise en forme
 * (format.date, format.heure) : date, heure et minute se lisent, les
 * secondes et le décalage se taisent. Il se lit par lireHorodatage
 * (format.js) ; ce qu'elle refuse se cite tel quel.
 */
export function dater(horodatage, texte) {
  let lu;
  try {
    lu = lireHorodatage(horodatage);
  } catch {
    return String(horodatage);
  }
  const { annee, mois, jour, heure, minute } = lu;
  return `le ${texte('format.date', { annee, mois, jour })} à ${texte('format.heure', { heure, minute })}`;
}

/** « depuis » et l'horodatage en mots, rien quand il manque. */
export const depuisQuand = (depuis, texte) =>
  depuis === null || depuis === undefined ? '' : ` depuis ${dater(depuis, texte)}`;

/**
 * Des tours nommés : « tous les tours » pour null, sinon « tour 2 »,
 * « tours 1 et 3 », « tours 2 à 4 », « tours 1 à 3 et 5 »,
 * « tours 1, 3 et 5 ». Une suite d'au moins trois tours consécutifs se lit
 * « a à b » ; deux tours consécutifs restent deux termes. La liste reçue est
 * non vide, d'entiers positifs strictement croissants, sinon RangeError ;
 * elle n'est pas modifiée.
 */
export function toursNommes(tours) {
  if (tours === null) return 'tous les tours';
  exigerToursCroissants(tours);
  const termes = [];
  let debut = 0;
  for (let i = 1; i <= tours.length; i += 1) {
    if (i < tours.length && tours[i] === tours[i - 1] + 1) continue;
    const suite = tours.slice(debut, i);
    if (suite.length >= 3) termes.push(`${suite[0]} à ${suite.at(-1)}`);
    else termes.push(...suite.map(String));
    debut = i;
  }
  return `${tours.length === 1 ? 'tour' : 'tours'} ${enumeration(termes)}`;
}

/** « à tous les tours » (null), « au tour 3 », « aux tours 3 et 4 » ; mêmes refus que toursNommes. */
export function auxToursNommes(tours) {
  if (tours === null) return 'à tous les tours';
  return `${tours?.length === 1 ? 'au' : 'aux'} ${toursNommes(tours)}`;
}

// Une liste de tours non vide, d'entiers positifs strictement croissants, ou
// RangeError qui la cite.
function exigerToursCroissants(tours) {
  const valide =
    Array.isArray(tours) &&
    tours.length > 0 &&
    tours.every((tour, i) => Number.isInteger(tour) && tour >= 1 && (i === 0 || tour > tours[i - 1]));
  if (!valide) throw new RangeError(`libelle : tours ${JSON.stringify(tours)}, liste croissante d'entiers positifs attendue`);
}
