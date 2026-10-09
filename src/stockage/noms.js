// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les noms des fichiers d'un événement (§ 8.6, § 8.7) : leurs suffixes, la
// base que le nom de l'événement donne dans un dossier de travail, le
// dossier daté de la corbeille, et le nom de la planche de badges que
// l'événement produit à côté de ses fichiers (§ 11.6). Le module est pur :
// il ne touche aucun fichier, ne lit ni horloge ni aléa, et ne dépend
// d'aucune langue — la casse se compare par toUpperCase ou toLowerCase,
// jamais par une comparaison localisée.
//
// Les longueurs se comptent en unités UTF-16, comme MAX_PATH de Windows, et
// une coupe ne sépare jamais une paire de substitution. Le chemin complet
// d'un fichier est la racine du dossier de travail, un séparateur, puis un
// chemin relatif. La borne porte sur le plus long chemin relatif que
// l'événement écrit : un fichier de la corbeille datée, au suffixe le plus
// long, que l'écriture atomique prolonge de SUFFIXE_ECRITURE. Une base qui ne
// tiendrait que pour l'état laisserait déborder le journal, le fichier
// précédent et leurs fichiers d'écriture. Le nom de la planche, posé à la
// racine du dossier de travail, tient sous la même borne : son plus long
// suffixe, prolongé de SUFFIXE_ECRITURE, ne dépasse pas la partie fixe de
// longueurRelativeMax.
import { PAPIERS } from '../geometrie/papiers.js';
import { ErreurStockage } from './erreurs.js';

// Suffixes des fichiers d'un événement, que précède la base de son nom.
export const SUFFIXES = Object.freeze({
  etat: '.gtt.json',
  precedent: '.gtt.json.precedent',
  journal: '.gtt-journal.jsonl',
  verrou: '.gtt.verrou',
});

// Ajouté au nom d'un fichier pendant son écriture atomique, puis renommé
// par-dessus la cible.
export const SUFFIXE_ECRITURE = '.ecriture';

// Dossier, à la racine du dossier de travail, où la suppression déplace les
// fichiers d'un événement, dans un dossier daté.
export const DOSSIER_CORBEILLE = 'corbeille';

// MAX_PATH de Windows : 260 unités, le NUL final compris.
export const LONGUEUR_CHEMIN_MAX = 259;

// Un dossier daté de la corbeille se nomme AAAA-MM-JJ_HH-MM-SS, suivi de _n
// quand ce nom est pris. Le rang s'arrête à RANG_MAX, deux chiffres : la borne
// du chemin retient ce rang, le plus long que dossierCorbeille rend.
const MODELE_DATE = 'AAAA-MM-JJ_HH-MM-SS';
const RANG_MAX = 99;
const RANG_LE_PLUS_LONG = `_${RANG_MAX}`;

// Ce que le plus long chemin relatif porte hors de la base : le dossier daté
// de la corbeille au rang le plus long et son séparateur, puis le plus long
// des suffixes, que l'écriture atomique prolonge de SUFFIXE_ECRITURE. Un
// suffixe ajouté à SUFFIXES s'ajoute aussi à ce maximum.
const LONGUEUR_FIXE =
  `${DOSSIER_CORBEILLE}/${MODELE_DATE}${RANG_LE_PLUS_LONG}/`.length +
  Math.max(SUFFIXES.etat.length, SUFFIXES.precedent.length, SUFFIXES.journal.length, SUFFIXES.verrou.length) +
  SUFFIXE_ECRITURE.length;

/**
 * Longueur, en unités UTF-16, du plus long chemin relatif que l'événement de
 * base donnée écrit : le fichier d'écriture atomique de l'état précédent,
 * dans le dossier daté de la corbeille au rang de collision le plus long, soit
 * corbeille/AAAA-MM-JJ_HH-MM-SS_99/<base>.gtt.json.precedent.ecriture. C'est
 * lui, et non l'état ou le journal du dossier de travail, qui borne la base
 * (§ 8.6, § 14.10).
 *
 * @param {string} base
 * @returns {number}
 */
export function longueurRelativeMax(base) {
  return LONGUEUR_FIXE + base.length;
}

// Le nom que prend l'événement quand il ne reste rien de son nom.
const NOM_GENERIQUE = 'evenement';

// Les caractères que Windows refuse dans un nom de fichier : < > : " / \ | ? *
// et les codes U+0000 à U+001F, tabulation et fin de ligne comprises. Ces
// codes partent déjà avec les caractères de contrôle de INVISIBLES ; la classe
// les garde pour énoncer la règle de Windows en entier.
const INTERDITS = /[<>:"\/\\|?*\u0000-\u001f]/g;

// Une suite de blancs : espace, espace insécable, espaces typographiques.
const BLANCS = /\s+/g;

// Les noms de périphériques que Windows réserve, en minuscules : CON, PRN,
// AUX, NUL, COM et LPT suivis d'un chiffre ou d'un exposant ¹ ² ³ (U+00B9,
// U+00B2, U+00B3), CONIN$ et CONOUT$.
const RESERVES = /^(?:con|prn|aux|nul|(?:com|lpt)[0-9\u00b2\u00b3\u00b9]|conin\$|conout\$)$/;

// Le texte sans les espaces ni les points de ses deux bouts, que Windows
// retire d'un nom. Un parcours depuis chaque bout, non une expression
// régulière : une longue suite de points au milieu d'un nom ne coûte qu'une
// passe.
function retirerBords(texte) {
  const estBord = (caractere) => caractere === ' ' || caractere === '.';
  let debut = 0;
  let fin = texte.length;
  while (debut < fin && estBord(texte[debut])) debut += 1;
  while (fin > debut && estBord(texte[fin - 1])) fin -= 1;
  return texte.slice(debut, fin);
}

// Les caractères qu'un nom ne porte pas, parce qu'on ne les voit pas ou qu'ils
// changent ce qu'on voit : les caractères de contrôle (catégorie Cc), soit
// U+0000 à U+001F, tabulation et fin de ligne comprises, U+007F et U+0080 à
// U+009F ; les caractères de format (Cf) — espace, antiliant et liant sans
// chasse, marques, enchâssements et isolats bidirectionnels, trait d'union
// conditionnel, gluon de mots, U+FEFF ; les caractères ignorables par défaut
// (Default_Ignorable_Code_Point), que le rendu laisse vides, dont ceux que la
// catégorie Cf ne range pas : remplisseurs hangul, lien de graphèmes,
// sélecteurs de variante ; et les demi-paires de substitution isolées. Sous le
// drapeau u, l'expression lit le texte par caractère : une paire bien formée
// en est un seul, hors de U+D800 à U+DFFF, et seule une moitié isolée tombe
// dans cette plage.
const INVISIBLES = /[\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}\ud800-\udfff]/gu;

// Le nom nettoyé : sans caractère invisible ni demi-paire isolée, en NFC, sans
// les caractères que Windows refuse, ses blancs réduits à une espace, ses
// espaces et ses points de bord retirés ; le nom générique quand il n'en reste
// rien. Un caractère invisible ne se voit pas, ou retourne l'affichage du texte
// qui le suit : gardé, il donnerait une base invisible, ou qui se lit autrement
// qu'elle s'écrit. Le système de fichiers écrit une demi-paire isolée en
// U+FFFD : deux bases qui ne différeraient que par elle désigneraient le même
// fichier.
//
// L'ordre compte. Le retrait des invisibles vient d'abord : entre une lettre et
// sa marque combinante, un caractère de format empêcherait la composition en
// NFC ; une demi-paire part avant le caractère refusé qui la séparait de
// l'autre moitié, et ne s'y recolle pas ; U+FEFF, que \s compte parmi les
// blancs, part au lieu de devenir une espace, et la tabulation comme la fin de
// ligne, des contrôles, partent sans en laisser une. La première conversion en
// NFC précède le retrait des caractères refusés, car un caractère refusé
// composé avec une marque combinante, comme U+0338, devient un caractère que
// Windows accepte. La seconde le suit : un caractère refusé qui séparait une
// lettre de sa marque combinante les laisse se toucher, et sans elle la base
// ne serait ni en NFC, ni égale à la base qu'on en dérive à son tour. Retirer
// un caractère refusé peut aussi rapprocher deux blancs, que la réduction fond
// ensuite.
function epurer(nom) {
  const visible = nom.replace(INVISIBLES, '');
  const composee = visible.normalize('NFC').replace(INTERDITS, '').normalize('NFC');
  const epure = retirerBords(composee.replace(BLANCS, ' '));
  return epure === '' ? NOM_GENERIQUE : epure;
}

// La tête du texte, d'au plus limite unités. La coupe tombe entre deux
// caractères : une paire de substitution tient tout entière ou n'y est pas.
function tete(texte, limite) {
  let fin = 0;
  for (const caractere of texte) {
    if (fin + caractere.length > limite) break;
    fin += caractere.length;
  }
  return texte.slice(0, fin);
}

// La base, avec « _ » ajouté à sa partie réservée. Windows reconnaît un
// périphérique dans le nom dont la partie avant le premier point, espaces
// finaux retirés, est un nom réservé : « con.soirée » comme « con ».
function ecarterReserve(base) {
  const point = base.indexOf('.');
  const partie = (point === -1 ? base : base.slice(0, point)).trimEnd();
  return RESERVES.test(partie.toLowerCase()) ? `${partie}_${base.slice(partie.length)}` : base;
}

// La plus longue tête de brut dont la base, une fois ses espaces et points
// finaux retirés et son nom réservé écarté, tient en limite unités ; null
// quand aucune ne tient. Le « _ » d'un nom réservé compte dans la longueur :
// une coupe qui laisse « con » dans un nom plus long donne « co » quand
// « con_ » ne tient pas, et jamais un nom réservé.
function tenir(brut, limite) {
  for (let taille = limite; taille > 0; taille -= 1) {
    const base = ecarterReserve(retirerBords(tete(brut, taille)));
    if (base !== '' && base.length <= limite) return base;
  }
  return null;
}

// Clé de comparaison de deux bases : la majuscule de leur NFC. Windows compare
// deux noms de fichier par leur majuscule, un caractère après l'autre et sans
// regarder le contexte ; toLowerCase en diffère, car il écrit « ς » le Σ qui
// finit un mot et « σ » les autres, si bien que « ΣΑΣ » et « σασ » auraient
// deux clés pour un seul fichier. La NFC réunit les deux écritures d'un même
// nom, qui se lisent pareil à l'écran. Une majuscule de plusieurs lettres (ß
// donne SS) réunit des noms que Windows distingue : un rang de plus, jamais un
// fichier écrasé.
// Exportée : supprimer et le rang d'une démonstration (operations.js)
// comparent les noms de fichier par cette même clé.
export const cleSansCasse = (base) => base.normalize('NFC').toUpperCase();
const cle = cleSansCasse;

/**
 * Base de nom de fichier d'un nom d'événement dans un dossier de travail
 * (§ 8.6) : ce que précèdent les suffixes de SUFFIXES. Les caractères
 * invisibles — de contrôle (catégorie Cc), de format (Cf), ignorables par
 * défaut — et les demi-paires de substitution isolées sont retirés d'abord ;
 * le nom passe en NFC ; les caractères que Windows refuse sont retirés, puis le
 * nom repasse en NFC, car ce retrait peut rapprocher une lettre de sa marque
 * combinante ; les blancs consécutifs se réduisent à une espace ; les espaces
 * et les points des deux bouts sont retirés ; quand il ne reste rien, la base
 * est « evenement », jamais une base invisible. Un nom réservé
 * — CON, PRN, AUX, NUL, COM0 à COM9, COM¹ à COM³, LPT0 à LPT9, LPT¹ à LPT³,
 * CONIN$, CONOUT$ — comparé sans égard à la casse sur la partie avant le
 * premier point reçoit « _ » à cette partie. La base se tronque, sans couper
 * une paire de substitution, espaces et points finaux retirés, jusqu'à ce que
 * racine + séparateur + longueurRelativeMax(base) ne dépasse pas
 * LONGUEUR_CHEMIN_MAX. Une base qui heurte l'une des existantes, comparées par
 * la majuscule de leur NFC comme Windows compare les noms de fichier, prend
 * « (2) », « (3) »… après une espace ; la base se raccourcit alors pour que ce
 * rang tienne dans la borne.
 * Une racine qui finit par le séparateur ne compte pas un séparateur de plus.
 *
 * @param {string} nom  le nom de l'événement, qui reste l'autorité (§ 8.6)
 * @param {Object} contexte
 * @param {string} contexte.racine      chemin du dossier de travail
 * @param {'\\'|'/'} contexte.separateur  celui du système de fichiers
 * @param {Iterable<string>} contexte.existantes  bases déjà présentes dans le
 *           dossier de travail
 * @returns {string}
 * @throws {ErreurStockage} CHEMIN_TROP_LONG {racine} : aucune base tirée du
 *           nom ne tient sous la borne, ou plus aucun rang
 */
export function deriverBase(nom, { racine, separateur, existantes }) {
  const brut = epurer(nom);
  const unitesRacine = racine.endsWith(separateur) ? racine.length - 1 : racine.length;
  const libres = LONGUEUR_CHEMIN_MAX - (unitesRacine + 1) - longueurRelativeMax('');
  const prises = new Set(Array.from(existantes, cle));
  // La base de rang donné : brut tel quel au rang 1, puis suivi de « (n) », le
  // rang prenant sa place dans la borne. Un rang qui ne tient plus ne tiendra
  // pas davantage au rang suivant.
  const proposer = (rang) => {
    const suffixe = rang === 1 ? '' : ` (${rang})`;
    const base = tenir(brut, libres - suffixe.length);
    if (base === null) throw new ErreurStockage('CHEMIN_TROP_LONG', { racine });
    return base + suffixe;
  };
  let rang = 1;
  let candidat = proposer(rang);
  while (prises.has(cle(candidat))) {
    rang += 1;
    candidat = proposer(rang);
  }
  return candidat;
}

// Un horodatage de l'horloge de l'application : AAAA-MM-JJTHH:MM:SS±HH:MM. Le
// chemin du dossier ne retient que les chiffres du jour et de l'heure.
const HORODATAGE = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})[+-]\d{2}:\d{2}$/;

// Le jour et l'heure d'un horodatage, AAAA-MM-JJ_HH-MM-SS : tels qu'écrits,
// sans le décalage, les deux-points, que Windows refuse dans un nom, devenus
// des traits d'union. TypeError pour une autre forme.
function jourEtHeure(horodatage) {
  const lu = typeof horodatage === 'string' ? HORODATAGE.exec(horodatage) : null;
  if (lu === null) {
    throw new TypeError(`horodatage AAAA-MM-JJTHH:MM:SS±HH:MM attendu, reçu ${JSON.stringify(horodatage)}`);
  }
  const [, jour, heures, minutes, secondes] = lu;
  return `${jour}_${heures}-${minutes}-${secondes}`;
}

const PREFIXE_CORBEILLE = `${DOSSIER_CORBEILLE}/`;

/**
 * Chemin relatif du dossier de corbeille d'un horodatage (§ 8.7) :
 * corbeille/AAAA-MM-JJ_HH-MM-SS, auquel _2, _3… s'ajoute tant que ce nom est
 * pris, le premier rang libre l'emportant. La date et l'heure sont gardées
 * telles qu'écrites, sans le décalage ; les deux-points, que Windows refuse,
 * deviennent des traits d'union. Le rang s'arrête à 99 : longueurRelativeMax
 * en réserve deux chiffres, et au rang 100 le plus long chemin d'un événement
 * dont la base remplit la borne dépasserait LONGUEUR_CHEMIN_MAX.
 *
 * @param {string} horodatage  AAAA-MM-JJTHH:MM:SS±HH:MM
 * @param {Iterable<string>} existants  entrées déjà présentes de la
 *           corbeille, par leur nom ou par leur chemin relatif
 * @returns {string}
 * @throws {TypeError} horodatage d'une autre forme : le chemin ne porte que
 *           des chiffres
 * @throws {ErreurStockage} CORBEILLE_SATUREE {dossier} : le nom et ses rangs 2
 *           à 99 sont pris ; dossier est le chemin relatif du nom sans rang
 */
export function dossierCorbeille(horodatage, existants) {
  const nom = jourEtHeure(horodatage);
  const pris = new Set(
    Array.from(existants, (entree) =>
      entree.startsWith(PREFIXE_CORBEILLE) ? entree.slice(PREFIXE_CORBEILLE.length) : entree,
    ),
  );
  let rang = 1;
  let candidat = nom;
  while (pris.has(candidat)) {
    rang += 1;
    candidat = `${nom}_${rang}`;
  }
  if (rang > RANG_MAX) {
    throw new ErreurStockage('CORBEILLE_SATUREE', { dossier: `${PREFIXE_CORBEILLE}${nom}` });
  }
  return `${PREFIXE_CORBEILLE}${candidat}`;
}

// Les impositions de la planche (§ 11.6), telles que le nom du fichier les
// écrit.
const IMPOSITIONS = Object.freeze(['feuille', 'pile']);

// Une réédition compte au plus REEDITION_MAX badges, quatre chiffres : le
// plus long suffixe de la planche, « .badges-9999_<papier>_feuille_<date>.pdf »,
// en tient compte sous la borne du chemin.
const REEDITION_MAX = 9999;

// Ce qui tient lieu de date et d'heure quand le placement n'en porte pas.
const HORODATAGE_INCONNU = 'horodatage-inconnu';

/**
 * Nom du fichier de la planche de badges (§ 11.6), posé à la racine du
 * dossier de travail : <base>.badges[-<k>]_<papier>_<imposition>_<date>.pdf,
 * où k est le nombre de badges d'une réédition, papier une clé de PAPIERS,
 * imposition feuille ou pile, et date le jour et l'heure de l'horodatage du
 * placement, AAAA-MM-JJ_HH-MM-SS, décalage retiré — « horodatage-inconnu »
 * quand il manque. Le nom ne porte aucun deux-points. Même base, même
 * papier, même imposition, même placement : même nom. Le plus long suffixe,
 * 51 unités, prolongé de SUFFIXE_ECRITURE, tient sous la partie fixe de
 * longueurRelativeMax : la base d'un événement, que deriverBase borne, laisse
 * donc place à sa planche.
 *
 * @param {string} base  celle de l'événement, que rend deriverBase
 * @param {Object} options
 * @param {import('../geometrie/papiers.js').Papier} options.papier
 * @param {'feuille'|'pile'} options.imposition
 * @param {string|null} options.horodatage  AAAA-MM-JJTHH:MM:SS±HH:MM, ou null
 * @param {null|{ids: number[]}} [options.reedition]  les badges réédités ;
 *        null ou absent pour une planche entière
 * @returns {string}
 * @throws {TypeError} une base vide ou autre chose qu'une chaîne, un papier
 *         hors de PAPIERS, une imposition hors de feuille et pile, un
 *         horodatage d'une autre forme, une réédition sans tableau ids
 * @throws {RangeError} une réédition de 0 badge ou de plus de 9 999
 */
export function nomPlanche(base, { papier, imposition, horodatage, reedition = null } = {}) {
  if (typeof base !== 'string' || base === '') throw new TypeError(`nomPlanche : base attendue, reçu ${JSON.stringify(base)}`);
  if (typeof papier !== 'string' || !Object.hasOwn(PAPIERS, papier)) {
    throw new TypeError(`nomPlanche : papier inconnu ${JSON.stringify(papier)}`);
  }
  if (!IMPOSITIONS.includes(imposition)) throw new TypeError(`nomPlanche : imposition inconnue ${JSON.stringify(imposition)}`);
  const date = horodatage === null ? HORODATAGE_INCONNU : jourEtHeure(horodatage);
  let rang = '';
  if (reedition !== null) {
    if (!Array.isArray(reedition?.ids)) throw new TypeError('nomPlanche : réédition sans tableau ids');
    const k = reedition.ids.length;
    if (k < 1 || k > REEDITION_MAX) throw new RangeError(`nomPlanche : réédition de ${k} badges, de 1 à ${REEDITION_MAX} admis`);
    rang = `-${k}`;
  }
  return `${base}.badges${rang}_${papier}_${imposition}_${date}.pdf`;
}
