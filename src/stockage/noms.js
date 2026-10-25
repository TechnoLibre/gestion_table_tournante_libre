// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les noms des fichiers d'un événement (§ 8.6, § 8.7) : leurs suffixes, la
// base que le nom de l'événement donne dans un dossier de travail, le
// dossier de l'événement, le dossier daté de la corbeille, les noms de la
// planche de badges et de sa liste en CSV que l'événement produit à côté de
// ses fichiers (§ 11.6), et celui qu'elles prennent quand l'événement change
// de base (§ 8.7). Le module est pur : il ne touche aucun fichier, ne
// lit ni horloge ni aléa, et ne dépend d'aucune langue — la casse se compare
// par toUpperCase ou toLowerCase, jamais par une comparaison localisée.
//
// Les longueurs se comptent en unités UTF-16, comme MAX_PATH de Windows, et
// une coupe ne sépare jamais une paire de substitution. Le chemin complet
// d'un fichier est la racine du dossier de travail, un séparateur, puis un
// chemin relatif. La borne porte sur le plus long chemin relatif que
// l'événement écrit, un fichier au suffixe le plus long que l'écriture
// atomique prolonge de SUFFIXE_ECRITURE : dans le dossier de l'événement,
// qui porte le nom de sa base, si bien que la base y compte deux fois, ou
// dans le dossier daté de la corbeille, qui porte directement les fichiers ;
// ou le logo d'une personne dans ce dossier daté, dont la longueur ne dépend
// pas de la base (logos.js).
// Le plus long suffixe est celui de la planche de badges sans marque. Une
// base qui ne tiendrait que pour l'état laisserait déborder le journal, la
// planche et leurs fichiers d'écriture. Un nom de planche marqué raccourcit
// sa base dans le dossier qui le reçoit, suivie d'un point ; le nom de la
// liste, plus court, suit la même règle. Un nom qui peut se confondre avec
// un autre — base raccourcie, ou base lue sur le disque qui finit par un
// point — se choisit parmi les entrées du dossier.
import { MODELES_BADGE, PAPIERS, estModeleBadge } from '../geometrie/papiers.js';
import { ErreurStockage } from './erreurs.js';
import { cheminLogo } from './logos.js';

// Suffixes des fichiers d'un événement, que précède la base de son nom :
// l'état, son .precedent, le journal, le verrou, le compagnon des courses,
// qui garde la course de la recherche de chaque proposition à côté de l'état
// (courses.js), et l'aperçu de la liste, qui garde les deux résumés que la
// liste montre et l'empreinte des textes d'où ils viennent (apercu.js).
export const SUFFIXES = Object.freeze({
  etat: '.gtt.json',
  precedent: '.gtt.json.precedent',
  journal: '.gtt-journal.jsonl',
  verrou: '.gtt.verrou',
  courses: '.gtt-courses.json',
  apercu: '.gtt-apercu.json',
});

// Ajouté au nom d'un fichier pendant son écriture atomique, puis renommé
// par-dessus la cible.
export const SUFFIXE_ECRITURE = '.ecriture';

// Dossier, à la racine du dossier de travail, où la suppression déplace les
// fichiers d'un événement, dans un dossier daté.
export const DOSSIER_CORBEILLE = 'corbeille';

// MAX_PATH de Windows : 260 unités, le NUL final compris.
export const LONGUEUR_CHEMIN_MAX = 259;

// Les noms des entrées que la racine du dossier de travail porte à côté des
// dossiers d'événement : la corbeille, le fichier des réglages locaux
// (FICHIER_REGLAGES de reglages_locaux.js) et le témoin que la sonde écrit
// (§ 8.6). Un dossier d'événement ne prend aucun de ces noms : deriverBase
// les compte parmi les bases prises, sans égard à la casse.
export const NOMS_RESERVES_RACINE = Object.freeze([DOSSIER_CORBEILLE, 'reglages_locaux.json', '.gtt-temoin']);

// Un dossier daté de la corbeille se nomme AAAA-MM-JJ_HH-MM-SS, suivi de _n
// quand ce nom est pris. Le rang s'arrête à RANG_MAX, deux chiffres : la borne
// du chemin retient ce rang, le plus long que dossierCorbeille rend.
const MODELE_DATE = 'AAAA-MM-JJ_HH-MM-SS';
const RANG_MAX = 99;
const RANG_LE_PLUS_LONG = `_${RANG_MAX}`;

/**
 * Longueur, en unités UTF-16, du plus long chemin relatif que l'événement de
 * base donnée écrit (§ 8.6, § 14.10) : le fichier d'écriture atomique de sa
 * planche au plus long suffixe sans marque, dans le dossier de l'événement,
 * <base>/<base>.badges-9999_<papier>_feuille_<date>.pdf.ecriture, ou dans le
 * dossier daté de la corbeille au rang de collision le plus long,
 * corbeille/AAAA-MM-JJ_HH-MM-SS_99/<base>.badges-…pdf.ecriture, ou le logo
 * d'une personne dans ce dossier daté,
 * corbeille/AAAA-MM-JJ_HH-MM-SS_99/logo/<empreinte>.png, 106 unités quelle
 * que soit la base : le plus long des trois. Le premier compte la base deux
 * fois, le deuxième une, le troisième aucune : le logo l'emporte sous 13
 * unités de base, la corbeille jusqu'à 32, le dossier de l'événement
 * au-delà. Ni l'état ni le journal ne bornent la base ; le logo dans le
 * dossier de l'événement, <base>/logo/<empreinte>.png.ecriture, compte 83
 * unités outre la base, toujours moins que la corbeille.
 *
 * @param {string} base
 * @returns {number}
 */
export function longueurRelativeMax(base) {
  return longueurPourUnites(base.length);
}

// Le plus long chemin relatif d'une base de n unités : il ne dépend que de
// sa longueur, et ne descend jamais sous celui du logo dans la corbeille.
function longueurPourUnites(n) {
  return Math.max(2 * n + LONGUEUR_FIXE, n + LONGUEUR_FIXE_CORBEILLE, LONGUEUR_LOGO_CORBEILLE);
}

// La plus longue base, en unités, dont le plus long chemin relatif tient en
// disponibles unités : la plus grande longueur n telle que
// longueurPourUnites(n) ne dépasse pas disponibles, 0 quand même une base
// d'une unité ne tient pas. Le parcours suit longueurPourUnites, si bien que
// la dérivation borne la base sur la longueur même que longueurRelativeMax
// rend ; il compte au plus LONGUEUR_CHEMIN_MAX pas.
function longueurBaseMax(disponibles) {
  let n = 0;
  while (longueurPourUnites(n + 1) <= disponibles) n += 1;
  return n;
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

// Les clés des noms réservés de la racine, comparées comme les bases.
const CLES_RESERVEES_RACINE = new Set(NOMS_RESERVES_RACINE.map(cle));

// La clé de la corbeille, à laquelle se compare le dossier d'une clé
// d'événement (decouperCle).
const CLE_CORBEILLE = cle(DOSSIER_CORBEILLE);

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
 * LONGUEUR_CHEMIN_MAX : la base y compte deux fois, au dossier de l'événement
 * et à ses fichiers. Une base qui heurte l'une des existantes, ou l'un des
 * NOMS_RESERVES_RACINE, comparées par la majuscule de leur NFC comme Windows
 * compare les noms de fichier, prend « (2) », « (3) »… après une espace ; la
 * base se raccourcit alors pour que ce rang, compté deux fois lui aussi,
 * tienne dans la borne.
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
  const libres = longueurBaseMax(LONGUEUR_CHEMIN_MAX - (unitesRacine + 1));
  const prises = new Set([...CLES_RESERVEES_RACINE, ...Array.from(existantes, cle)]);
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

/**
 * Chemin relatif, à la racine du dossier de travail, du dossier d'un
 * événement de base donnée (§ 8.6) : la base elle-même. deriverBase la rend
 * sans séparateur, sans aucun des NOMS_RESERVES_RACINE, et sous une borne qui
 * compte ce dossier en plus du fichier. Un nom que Windows ne crée pas tel
 * quel se refuse : il retirerait le point ou l'espace final, et
 * « corbeille. » prendrait la place de la corbeille.
 *
 * @param {string} base
 * @returns {string}
 * @throws {TypeError} une base vide ou autre chose qu'une chaîne, « . » ou
 *         « .. », une base qui porte un caractère que Windows refuse
 *         (séparateurs compris), qui finit par un point ou une espace, qui
 *         nomme un périphérique, ou l'un des NOMS_RESERVES_RACINE, comparé
 *         sans égard à la casse
 */
export function dossierEvenement(base) {
  const forme =
    typeof base === 'string' &&
    base !== '' &&
    base !== '.' &&
    base !== '..' &&
    base.search(INTERDITS) === -1 &&
    !base.endsWith('.') &&
    !base.endsWith(' ') &&
    ecarterReserve(base) === base;
  if (!forme || CLES_RESERVEES_RACINE.has(cle(base))) {
    throw new TypeError(`dossierEvenement : base de dossier attendue, reçu ${JSON.stringify(base)}`);
  }
  return base;
}

// Un segment de clé : une chaîne non vide, sans « / », autre que « . » et
// « .. ».
const estSegment = (texte) =>
  typeof texte === 'string' && texte !== '' && texte !== '.' && texte !== '..' && !texte.includes('/');

/**
 * La clé d'un événement du dossier de travail (§ 8.1, § 8.6) : son dossier,
 * relatif à la racine, et la base de ses fichiers, joints par « / ». Elle
 * identifie la ligne de la liste, et l'événement à ouvrir, à copier, à
 * renommer ou à supprimer. Le dossier porte la base quand le logiciel le
 * crée ; une copie faite à la main dans l'explorateur donne un autre
 * dossier, que la clé garde.
 *
 * @param {string} dossier
 * @param {string} base
 * @returns {string}
 * @throws {TypeError} un dossier ou une base vide, « . », « .. », qui porte
 *         « / », ou autre chose qu'une chaîne
 */
export function cleEvenement(dossier, base) {
  if (!estSegment(dossier) || !estSegment(base)) {
    throw new TypeError(`cleEvenement : dossier et base attendus, reçu ${JSON.stringify([dossier, base])}`);
  }
  return `${dossier}/${base}`;
}

/**
 * Le dossier et la base d'une clé d'événement (cleEvenement). Une clé sans
 * dossier désignerait un fichier posé à même la racine : rien ne l'ouvre.
 * La corbeille, comparée sans égard à la casse, n'est pas le dossier d'un
 * événement. Le reste du contrôle d'un chemin appartient au système de
 * fichiers (exigerCheminRelatif).
 *
 * @param {string} cle
 * @returns {{dossier: string, base: string}}
 * @throws {ErreurStockage} CHEMIN_REFUSE {chemin: cle} : autre chose qu'une
 *         chaîne, une clé qui n'a pas exactement deux segments valides
 *         (estSegment), ou dont le dossier est la corbeille
 */
export function decouperCle(cle) {
  const segments = typeof cle === 'string' ? cle.split('/') : [];
  const [dossier, base] = segments;
  if (segments.length !== 2 || !estSegment(dossier) || !estSegment(base) || cleSansCasse(dossier) === CLE_CORBEILLE) {
    throw new ErreurStockage('CHEMIN_REFUSE', { chemin: cle });
  }
  return { dossier, base };
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

// Les ordres de la pile (§ 11.6) : l'ordre par table se marque dans le nom,
// l'ordre alphabétique, celui par défaut, ne s'y écrit pas.
const ORDRES = Object.freeze(['alphabetique', 'table']);

// Une réédition compte au plus REEDITION_MAX badges, quatre chiffres : le
// plus long suffixe sans marque de la planche,
// « .badges-9999_<papier>_feuille_<date>.pdf », en tient compte sous la borne
// du chemin.
const REEDITION_MAX = 9999;

// Ce qui tient lieu de date et d'heure quand le placement n'en porte pas.
const HORODATAGE_INCONNU = 'horodatage-inconnu';

// Ce qui suit une base raccourcie dans le nom de la planche : un point. Une
// base que rend deriverBase ne finit jamais par un point, si bien que son nom
// entier ne se confond avec aucun nom raccourci. Une base lue sur le disque,
// celle de « Gala..gtt.json », peut finir par un point : son nom entier est
// alors aussi celui qu'une base plus longue raccourcit en la même tête, et il
// se choisit parmi les entrées du dossier comme un nom raccourci. La planche
// entière d'une base qui tient ne remplace donc jamais la planche raccourcie
// d'une autre.
const MARQUE_COUPE = '.';

// Le dossier où la planche se dépose, contrôlé : null, ou son chemin, son
// séparateur et les noms qu'il porte déjà.
function dossierLu(dossier) {
  if (dossier === null) return null;
  const forme =
    typeof dossier === 'object' &&
    typeof dossier.racine === 'string' &&
    (dossier.separateur === '\\' || dossier.separateur === '/') &&
    typeof dossier.existants?.[Symbol.iterator] === 'function';
  if (!forme) throw new TypeError('nomPlanche : dossier {racine, separateur, existants} ou null attendu');
  return dossier;
}

// Ce qui ouvre le suffixe de chaque fichier d'une planche : ses badges, et
// la feuille de contrôle à part d'un modèle à cartes prédécoupées.
const FICHIERS_PLANCHE = Object.freeze({ badges: '.badges', controle: '.controle' });

// Ce que les noms d'une planche et de sa liste en CSV partagent, contrôlé
// au nom de la fonction `qui` : la base, le dossier lu, et les marques de la
// pile — la source « -p<id> », le compte « -<k> » d'une réédition, l'ordre
// « _table » — et la date du placement. Lève comme nomPlanche.
function communes(qui, base, { horodatage, reedition = null, proposition = null, ordre = 'alphabetique', dossier = null }) {
  if (typeof base !== 'string' || base === '') throw new TypeError(`${qui} : base attendue, reçu ${JSON.stringify(base)}`);
  if (proposition !== null && !(Number.isSafeInteger(proposition) && proposition >= 1)) {
    throw new TypeError(`${qui} : identifiant de proposition attendu, reçu ${JSON.stringify(proposition)}`);
  }
  if (!ORDRES.includes(ordre)) throw new TypeError(`${qui} : ordre inconnu ${JSON.stringify(ordre)}`);
  const leDossier = dossierLu(dossier);
  const date = horodatage === null ? HORODATAGE_INCONNU : jourEtHeure(horodatage);
  let compte = '';
  if (reedition !== null) {
    if (!Array.isArray(reedition?.ids)) throw new TypeError(`${qui} : réédition sans tableau ids`);
    const k = reedition.ids.length;
    if (k < 1 || k > REEDITION_MAX) throw new RangeError(`${qui} : réédition de ${k} badges, de 1 à ${REEDITION_MAX} admis`);
    compte = `-${k}`;
  }
  return {
    leDossier,
    reedition: reedition !== null,
    source: proposition === null ? '' : `-p${proposition}`,
    compte,
    marqueOrdre: ordre === 'table' ? '_table' : '',
    date,
  };
}

// Les options de nomPlanche contrôlées, et ce qu'il en tire : le dossier lu,
// les noms de rang donné — [badges], et [badges, controle] pour un modèle à
// cartes prédécoupées —, et si les noms se choisissent parmi les entrées du
// dossier (rangeable). Lève comme nomPlanche.
function composer(base, options = {}) {
  const { papier, imposition, modeleBadge = 'a6' } = options;
  const { leDossier, reedition, source, compte, marqueOrdre, date } = communes('nomPlanche', base, options);
  if (typeof papier !== 'string' || !Object.hasOwn(PAPIERS, papier)) {
    throw new TypeError(`nomPlanche : papier inconnu ${JSON.stringify(papier)}`);
  }
  if (!estModeleBadge(modeleBadge)) throw new TypeError(`nomPlanche : modèle de badge inconnu ${JSON.stringify(modeleBadge)}`);
  const cartes = MODELES_BADGE[modeleBadge].grille !== null;
  if (cartes && papier !== MODELES_BADGE[modeleBadge].papier) {
    throw new TypeError(`nomPlanche : le modèle ${modeleBadge} se pose sur ${MODELES_BADGE[modeleBadge].papier}, reçu ${papier}`);
  }
  if (!IMPOSITIONS.includes(imposition)) throw new TypeError(`nomPlanche : imposition inconnue ${JSON.stringify(imposition)}`);
  // L'A6 nomme son papier et son imposition ; un modèle à cartes
  // prédécoupées, qui impose l'un et n'offre pas l'autre, se nomme lui-même.
  const support = cartes ? `_${modeleBadge}` : `_${papier}_${imposition}`;
  const ouvertures = cartes ? [FICHIERS_PLANCHE.badges, FICHIERS_PLANCHE.controle] : [FICHIERS_PLANCHE.badges];
  const suffixes = (rang) =>
    ouvertures.map((ouverture) => `${ouverture}${source}${compte}${support}${marqueOrdre}_${date}${rang === 1 ? '' : `_${rang}`}.pdf`);
  return rangeable(base, leDossier, suffixes, reedition);
}

// La marque d'une liste en CSV tirée d'un placement qui n'est pas retenu :
// le CSV n'a pas de filigrane, son nom le dit.
const MARQUE_BROUILLON = '_BROUILLON';

// Les options de nomCsvBadges contrôlées, et ce qu'il en tire, comme
// composer : un seul nom par rang, [liste]. Lève comme nomCsvBadges.
function composerCsv(base, options = {}) {
  const { brouillon = false } = options;
  const { leDossier, reedition, source, compte, marqueOrdre, date } = communes('nomCsvBadges', base, options);
  if (typeof brouillon !== 'boolean') throw new TypeError(`nomCsvBadges : brouillon booléen attendu, reçu ${JSON.stringify(brouillon)}`);
  const marque = brouillon ? MARQUE_BROUILLON : '';
  const suffixes = (rang) => [`${FICHIERS_PLANCHE.badges}${source}${compte}${marqueOrdre}${marque}_${date}${rang === 1 ? '' : `_${rang}`}.csv`];
  return rangeable(base, leDossier, suffixes, reedition);
}

// Le plus long suffixe sans marque qu'un fichier de l'événement porte après
// sa base : ceux de SUFFIXES, et ceux de la planche, de sa feuille de
// contrôle et de sa liste en CSV, composés comme composer et composerCsv les
// composent, sur chaque papier, imposition et modèle, au compte de
// réédition le plus long, à la date et sans elle, en brouillon ou non, sans
// source, sans ordre par table et sans rang. Une marque ou un rang allonge
// le nom au-delà, et sa base se raccourcit alors (rangeable). Les clés de
// PAPIERS et de MODELES_BADGE ne décident d'aucun ordre : seul leur maximum
// compte. Un suffixe ajouté à SUFFIXES s'ajoute aussi à ce maximum.
function suffixePlusLong() {
  const fixes = [
    SUFFIXES.etat,
    SUFFIXES.precedent,
    SUFFIXES.journal,
    SUFFIXES.verrou,
    SUFFIXES.courses,
    SUFFIXES.apercu,
  ];
  const base = 'b';
  const reedition = { ids: new Array(REEDITION_MAX) };
  const dates = ['2000-01-01T00:00:00+00:00', null];
  const supports = Object.keys(MODELES_BADGE).flatMap((modeleBadge) => {
    const { papier } = MODELES_BADGE[modeleBadge];
    const papiers = papier === null ? Object.keys(PAPIERS) : [papier];
    return papiers.flatMap((lepapier) => IMPOSITIONS.map((imposition) => ({ papier: lepapier, imposition, modeleBadge })));
  });
  const noms = dates.flatMap((horodatage) => [
    ...supports.flatMap((support) => composer(base, { ...support, horodatage, reedition }).nomsDeRang(1)),
    ...[false, true].flatMap((brouillon) => composerCsv(base, { horodatage, reedition, brouillon }).nomsDeRang(1)),
  ]);
  return Math.max(...fixes.map((suffixe) => suffixe.length), ...noms.map((nom) => nom.length - base.length));
}

// La partie de longueurRelativeMax qui ne dépend pas de la base. Le plus
// long suffixe, celui de la planche, .badges-9999_<papier>_feuille_<date>.pdf,
// compte 7 + 5 + 1 + 6 + 8 + 1 + 19 + 4 = 51 unités, <papier> au plus long
// de 6 et <date> de 19, AAAA-MM-JJ_HH-MM-SS. Dans le dossier de l'événement,
// <base>/<base><suffixe>.ecriture : le séparateur, 1, le suffixe, 51, et
// .ecriture, 9, soit 1 + 51 + 9 = 61 unités outre les deux bases. Dans la
// corbeille, corbeille/AAAA-MM-JJ_HH-MM-SS_99/<base><suffixe>.ecriture : le
// dossier daté au rang le plus long et son séparateur, 33, puis 51 et 9,
// soit 33 + 51 + 9 = 93 unités outre la base.
const SUFFIXE_PLUS_LONG = suffixePlusLong();
const LONGUEUR_FIXE = 1 + SUFFIXE_PLUS_LONG + SUFFIXE_ECRITURE.length;
const LONGUEUR_FIXE_CORBEILLE =
  `${DOSSIER_CORBEILLE}/${MODELE_DATE}${RANG_LE_PLUS_LONG}/`.length + SUFFIXE_PLUS_LONG + SUFFIXE_ECRITURE.length;
// Le logo dans la corbeille, corbeille/AAAA-MM-JJ_HH-MM-SS_99/logo/<64
// chiffres>.png : 33 + 73 = 106 unités, sans base. La suppression le déplace
// sans écriture atomique, d'où aucun .ecriture.
const LONGUEUR_LOGO_CORBEILLE =
  `${DOSSIER_CORBEILLE}/${MODELE_DATE}${RANG_LE_PLUS_LONG}/`.length + cheminLogo('0'.repeat(64)).length;

// Ce qui précède un suffixe de unites unités dans un nom de la planche posé
// dans le dossier { racine, separateur } : la base entière quand le chemin
// complet, en écriture atomique, tient sous la borne ; sinon la plus longue
// tête de la base que tenir rend, suivie de MARQUE_COUPE ; la base entière
// quand même un caractère n'y tient pas. Une racine qui finit par le
// séparateur ne compte pas un séparateur de plus.
function debutTenu(base, { racine, separateur }, unites) {
  const unitesRacine = racine.endsWith(separateur) ? racine.length - 1 : racine.length;
  const libres = LONGUEUR_CHEMIN_MAX - (unitesRacine + 1) - SUFFIXE_ECRITURE.length - unites;
  const tete = base.length <= libres ? null : tenir(base, libres - MARQUE_COUPE.length);
  return tete === null ? base : tete + MARQUE_COUPE;
}

// Les noms de rang donné sous le dossier lu, de suffixes(rang), et si ces
// noms se choisissent parmi les entrées du dossier — une réédition, une
// base qui finit par MARQUE_COUPE, ou une base que la borne raccourcit dès
// le premier rang. Les noms d'un même rang partagent leur tête : la coupe
// se règle sur le plus long suffixe.
function rangeable(base, leDossier, suffixes, reedition) {
  const entiers = (rang) => suffixes(rang).map((fin) => base + fin);
  if (leDossier === null) return { leDossier, nomsDeRang: entiers, exigeListe: false };

  // Les noms de rang donné, sous la tête que debutTenu règle sur le plus
  // long suffixe.
  const nomsDeRang = (rang) => {
    const fins = suffixes(rang);
    const debut = debutTenu(base, leDossier, Math.max(...fins.map((fin) => fin.length)));
    return fins.map((fin) => debut + fin);
  };
  const exigeListe = reedition || base.endsWith(MARQUE_COUPE) || nomsDeRang(1)[0] !== entiers(1)[0];
  return { leDossier, nomsDeRang, exigeListe };
}

// Les noms qu'une composition donne, au premier rang où aucun n'est pris
// dans le dossier quand ils se choisissent parmi ses entrées, au rang 1
// sinon.
function nomsLibres({ leDossier, nomsDeRang, exigeListe }) {
  if (!exigeListe) return nomsDeRang(1);
  const pris = new Set(Array.from(leDossier.existants, cle));
  let rang = 1;
  let candidats = nomsDeRang(rang);
  while (candidats.some((nom) => pris.has(cle(nom)))) {
    rang += 1;
    candidats = nomsDeRang(rang);
  }
  return candidats;
}

// Les noms de la planche, [badges] ou [badges, controle] (nomsLibres).
const nomsPlanche = (base, options) => nomsLibres(composer(base, options));

/**
 * Nom du fichier de la planche de badges (§ 11.6), posé dans le dossier de
 * l'événement :
 * <base>.badges[-p<id>][-<k>]_<papier>_<imposition>[_table]_<date>[_<n>].pdf
 * pour l'A6, <base>.badges[-p<id>][-<k>]_avery5392[_table]_<date>[_<n>].pdf
 * pour Avery 5392, dont la feuille de contrôle à part (nomControle) prend
 * le même nom, « .controle » à la place de « .badges » : les deux se
 * choisissent ensemble, au même rang et sous la même tête,
 * où id est l'identifiant de la proposition imprimée — rien pour le
 * retenu —, k le nombre de badges d'une réédition, papier une clé de
 * PAPIERS, imposition feuille ou pile, « _table » l'ordre par table — rien
 * pour l'ordre alphabétique —, date le jour et l'heure de l'horodatage du
 * placement, AAAA-MM-JJ_HH-MM-SS, décalage retiré, « horodatage-inconnu »
 * quand il manque, et n le rang d'un nom déjà pris que le dossier départage.
 * Le nom ne porte aucun deux-points.
 *
 * Le nom est injectif sur ce qui change la pile : deux propositions d'une
 * même génération, qui partagent leur horodatage, ou les deux ordres d'un
 * même placement donnent deux noms. Même base, même source, même papier,
 * même imposition, même ordre, même placement : même nom, et la planche
 * entière d'un placement remplace la sienne quand sa base tient entière.
 * Un nom qui se choisit parmi les entrées du dossier — celui d'une
 * réédition, celui d'une base qui finit par un point, ou celui dont la base
 * se raccourcit (nomPlancheExigeListe) — ne remplace jamais un fichier :
 * quand le dossier porte déjà ce nom, comparé par la majuscule de sa NFC
 * comme Windows compare les noms, il prend le premier rang libre, « _2 »,
 * « _3 »…, comme le dossier daté de la corbeille. Deux bases qui ne
 * diffèrent qu'au-delà de la coupe, celle d'un événement et celle de sa
 * copie, se raccourcissent en une même tête : la seconde planche prend un
 * rang plutôt que de remplacer la première.
 *
 * La borne du chemin (§ 8.6) : le plus long suffixe sans marque, 51 unités,
 * prolongé de SUFFIXE_ECRITURE, fait la partie fixe de longueurRelativeMax,
 * et la base d'un événement, que deriverBase borne, laisse place à sa
 * planche dans le dossier de l'événement, racine + séparateur + dossier.
 * Les marques et le rang l'allongent au-delà : quand le dossier est donné,
 * la base du nom se raccourcit, sans couper une paire de substitution,
 * espaces et points finaux retirés, sans laisser un nom réservé, et prend
 * un point à sa suite, jusqu'à ce que racine + séparateur + nom +
 * SUFFIXE_ECRITURE tienne en LONGUEUR_CHEMIN_MAX ; le suffixe reste entier.
 * Aucune base que rend deriverBase ne finit par un point : un nom raccourci
 * ne se confond avec aucun nom entier. Une base lue sur le disque peut finir
 * par un point, et son nom entier être celui qu'une autre base raccourcit :
 * il se choisit parmi les entrées du dossier. Quand même un caractère de
 * base ne tient pas, le nom garde sa base entière : l'écriture refusée par
 * le support se dit, et « Enregistrer sous… » la dépose ailleurs. Sans
 * dossier — sous web, où la planche se télécharge, et pour le dialogue
 * d'enregistrement —, ni rang ni coupe.
 *
 * @param {string} base  celle de l'événement, que rend deriverBase ou que
 *        donne le nom d'un fichier d'état lu sur le disque
 * @param {Object} options
 * @param {import('../geometrie/papiers.js').Papier} options.papier
 * @param {'feuille'|'pile'} options.imposition
 * @param {string|null} options.horodatage  AAAA-MM-JJTHH:MM:SS±HH:MM, ou null
 * @param {null|{ids: number[]}} [options.reedition]  les badges réédités ;
 *        null ou absent pour une planche entière
 * @param {number|null} [options.proposition]  l'identifiant de la
 *        proposition imprimée ; null ou absent pour le retenu
 * @param {'alphabetique'|'table'} [options.ordre]  'alphabetique' par défaut
 * @param {import('../geometrie/papiers.js').ModeleBadge} [options.modeleBadge]  'a6' par défaut
 * @param {null|{racine: string, separateur: '\\'|'/', existants: Iterable<string>}} [options.dossier]
 *        le dossier où la planche se dépose : racine, son chemin en entier,
 *        celui du dossier de l'événement ; son séparateur ; les noms des
 *        entrées qu'il porte déjà
 * @returns {string}
 * @throws {TypeError} une base vide ou autre chose qu'une chaîne, un papier
 *         hors de PAPIERS, une imposition hors de feuille et pile, un
 *         horodatage d'une autre forme, une réédition sans tableau ids, une
 *         proposition qui n'est pas un entier ≥ 1, un ordre inconnu, un
 *         dossier d'une autre forme, un modèle de badge inconnu ou posé sur
 *         un papier qu'il n'admet pas
 * @throws {RangeError} une réédition de 0 badge ou de plus de 9 999
 */
export function nomPlanche(base, options) {
  return nomsPlanche(base, options)[0];
}

/**
 * Nom du fichier de la feuille de contrôle à part d'un modèle à cartes
 * prédécoupées (§ 11.3, § 11.6) : celui de nomPlanche aux mêmes options,
 * « .controle » à la place de « .badges », au même rang et sous la même
 * tête. Le plus long, .controle-9999_avery5392_<date>.pdf, compte 48 unités,
 * sous les 51 du plus long suffixe de l'A6.
 *
 * @param {string} base
 * @param {Object} options  celles de nomPlanche
 * @returns {string}
 * @throws {TypeError|RangeError} comme nomPlanche, et un modèle de badge
 *         sans cartes prédécoupées, dont la feuille de contrôle est la
 *         page 1 de la planche
 */
export function nomControle(base, options) {
  const [, controle] = nomsPlanche(base, options);
  if (controle === undefined) throw new TypeError('nomControle : un modèle de badge à cartes prédécoupées attendu');
  return controle;
}

/**
 * Vrai quand le nom de la planche (nomPlanche), sous le dossier donné, se
 * choisit parmi les entrées du dossier : pour une réédition, pour une base
 * qui finit par un point, ou quand la borne raccourcit la base. Faux sans
 * dossier. Les entrées du dossier n'y sont pas lues : l'appelant liste le
 * dossier seulement quand il le faut.
 *
 * @param {string} base
 * @param {Object} options  celles de nomPlanche
 * @returns {boolean}
 * @throws {TypeError|RangeError} comme nomPlanche
 */
export function nomPlancheExigeListe(base, options) {
  return composer(base, options).exigeListe;
}

/**
 * Nom du fichier de la liste des badges en CSV (§ 11.6), posé dans le
 * dossier de l'événement à côté de la planche :
 * <base>.badges[-p<id>][-<k>][_table][_BROUILLON]_<date>[_<n>].csv
 * — les marques de la planche (nomPlanche), sans papier, imposition ni
 * modèle, qui ne changent pas la liste ; « _BROUILLON » quand le placement
 * n'est pas retenu, le CSV n'ayant pas de filigrane : toujours pour une
 * proposition. Le rang et la coupe suivent les règles de nomPlanche : une
 * réédition, une base qui finit par un point ou une base que la borne
 * raccourcit se choisit parmi les entrées du dossier, et ne remplace jamais
 * un fichier ; sans dossier, ni rang ni coupe. Le plus long suffixe sans
 * marque, .badges-9999_BROUILLON_<date>.csv, compte 46 unités, sous les 51
 * de la planche : la borne du chemin (§ 8.6) le tient.
 *
 * @param {string} base
 * @param {Object} options
 * @param {string|null} options.horodatage  AAAA-MM-JJTHH:MM:SS±HH:MM, ou null
 * @param {null|{ids: number[]}} [options.reedition]
 * @param {number|null} [options.proposition]
 * @param {'alphabetique'|'table'} [options.ordre]
 * @param {boolean} [options.brouillon]   faux par défaut
 * @param {null|{racine: string, separateur: '\\'|'/', existants: Iterable<string>}} [options.dossier]
 * @returns {string}
 * @throws {TypeError} une base vide, un horodatage d'une autre forme, une
 *         réédition sans tableau ids, une proposition qui n'est pas un
 *         entier ≥ 1, un ordre inconnu, un brouillon qui n'est pas un
 *         booléen, un dossier d'une autre forme
 * @throws {RangeError} une réédition de 0 badge ou de plus de 9 999
 */
export function nomCsvBadges(base, options) {
  return nomsLibres(composerCsv(base, options))[0];
}

/**
 * Vrai quand le nom de la liste (nomCsvBadges), sous le dossier donné, se
 * choisit parmi les entrées du dossier, comme nomPlancheExigeListe.
 *
 * @param {string} base
 * @param {Object} options  celles de nomCsvBadges
 * @returns {boolean}
 * @throws {TypeError|RangeError} comme nomCsvBadges
 */
export function nomCsvBadgesExigeListe(base, options) {
  return composerCsv(base, options).exigeListe;
}

// Ce qui suit la base dans le nom d'une sortie de la planche : « .badges » ou
// « .controle », puis un trait d'union ou un souligné qui ouvre les marques,
// le support ou la date, et l'extension du PDF ou du CSV.
const RESTE_DE_SORTIE = /^\.(?:badges|controle)[-_].*\.(?:pdf|csv)$/su;

// Ce qui suit la base ancienne dans nom, une sortie de la planche : après la
// base entière, ou après une tête plus courte de cette base suivie de
// MARQUE_COUPE, celle d'un nom que la borne a raccourci ; null quand nom
// n'est la sortie de la planche d'aucune des deux. La base entière se
// cherche d'abord, puis les têtes, de la plus longue à la plus courte.
function resteDeSortie(nom, ancienne) {
  if (nom.startsWith(ancienne) && RESTE_DE_SORTIE.test(nom.slice(ancienne.length))) return nom.slice(ancienne.length);
  for (let longueur = ancienne.length - 1; longueur > 0; longueur -= 1) {
    const debut = ancienne.slice(0, longueur) + MARQUE_COUPE;
    if (nom.startsWith(debut) && RESTE_DE_SORTIE.test(nom.slice(debut.length))) return nom.slice(debut.length);
  }
  return null;
}

/**
 * Le nom qu'une sortie de la planche prend quand son événement change de
 * base (§ 8.7, § 11.6) : la planche, sa feuille de contrôle à part et sa
 * liste en CSV, dont le nom commence par l'ancienne base, entière ou
 * raccourcie par la borne (nomPlanche), suivie de « .badges » ou de
 * « .controle ». La base nouvelle remplace la tête ; le reste du nom —
 * marques, support, date, rang, extension — reste tel quel. La nouvelle
 * base se raccourcit, suivie d'un point, comme nomPlanche la raccourcit,
 * jusqu'à ce que le chemin du dossier neuf, un séparateur, le nom et
 * SUFFIXE_ECRITURE tiennent en LONGUEUR_CHEMIN_MAX ; elle reste entière
 * quand même un caractère n'y tient pas. Le nom rendu ne se choisit pas
 * parmi les entrées du dossier : un nom déjà pris se refuse au déplacement,
 * qui ne remplace jamais un fichier.
 *
 * @param {string} nom   le nom d'un fichier du dossier de l'événement
 * @param {Object} renommage
 * @param {string} renommage.ancienne   la base de l'événement avant
 * @param {string} renommage.nouvelle   sa base après
 * @param {{racine: string, separateur: '\\'|'/'}} renommage.dossier  le
 *        chemin du dossier neuf, où la sortie passe, et le séparateur
 * @returns {string|null}   null quand nom n'est pas une sortie de la planche
 *          de l'ancienne base
 */
export function nomSortieRenommee(nom, { ancienne, nouvelle, dossier }) {
  const reste = resteDeSortie(nom, ancienne);
  return reste === null ? null : debutTenu(nouvelle, dossier, reste.length) + reste;
}
