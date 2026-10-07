// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les aides de composition que partagent les tables de l'application : citer,
// compter, énumérer, dater, nommer un état. Ce module n'est pas une table et
// n'exporte aucune TABLE. Une aide qui lit le texte d'une autre clé reçoit
// texte, la fonction de composition que la traduction passe à chaque entrée
// (traduction.js) : elle ne connaît pas l'assemblage des tables.
//
// Les aides ne lisent ni l'horloge ni la langue du système : un horodatage se
// met en mots à partir de sa seule forme, AAAA-MM-JJTHH:MM:SS±HH:MM.

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

// La forme d'un horodatage : date, heure et minute se lisent, les secondes et
// le décalage se taisent.
const HORODATAGE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):\d{2}[+-]\d{2}:\d{2}$/;

/**
 * Un horodatage AAAA-MM-JJTHH:MM:SS±HH:MM en mots, « le 17 mai 2031 à
 * 8 h 05 », à l'heure qu'il porte, par les textes de la mise en forme
 * (format.date, format.heure) ; une autre forme se cite telle quelle.
 */
export function dater(horodatage, texte) {
  const morceaux = HORODATAGE.exec(String(horodatage));
  if (morceaux === null) return String(horodatage);
  const [annee, mois, jour, heure, minute] = morceaux.slice(1).map(Number);
  if (mois < 1 || mois > 12) return String(horodatage);
  return `le ${texte('format.date', { annee, mois, jour })} à ${texte('format.heure', { heure, minute })}`;
}

/** « depuis » et l'horodatage en mots, rien quand il manque. */
export const depuisQuand = (depuis, texte) =>
  depuis === null || depuis === undefined ? '' : ` depuis ${dater(depuis, texte)}`;
