// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Décodage des octets d'un fichier CSV en texte (§ 10.1). Une détection qui se
// trompe ne fait échouer aucun calcul : un nom décodé de travers se découvre
// sur le plan imprimé. La détection suit donc quatre temps dans un ordre fixe,
// et n'emploie que les décodeurs que nomme le § 10.1. Un fichier que ces temps
// ne lisent pas sûrement est refusé, et le refus nomme le remède.

import { ErreurCsv } from './erreurs.js';

// Quatre kibioctets : la part du fichier où se cherche un octet nul.
const OCTETS_SONDES = 4096;

const MARQUE_UTF8 = [0xef, 0xbb, 0xbf];
const MARQUE_UTF16LE = [0xff, 0xfe];
const MARQUE_UTF16BE = [0xfe, 0xff];

// Vrai quand octets s'ouvre sur marque ; un fichier plus court qu'elle ne la
// porte pas.
const commencePar = (octets, marque) => marque.every((octet, i) => octets[i] === octet);

// Refus d'encodage de code donné. Chaque refus a ses propres détails, et tous
// renvoient au même remède : un fichier réenregistré en UTF-8.
const refuser = (code) => new ErreurCsv(code, { remede: 'ENREGISTRER_EN_UTF8' });

/**
 * Vrai quand le texte porte le caractère nul (U+0000), qu'aucun CSV ne porte.
 * decoder refuse le texte qu'il décode quand il en porte un ; la même fonction
 * contrôle un texte qui n'est pas passé par decoder.
 *
 * @param {string} texte
 * @returns {boolean}
 */
export function contientNul(texte) {
  return texte.includes('\0');
}

// Octets de l'entrée : un Uint8Array, dont un Buffer, tel quel ; un ArrayBuffer
// par une vue sur lui. Les deux se reconnaissent à leur étiquette de type, non
// par instanceof, que fait échouer un tampon venu d'un autre contexte
// d'exécution. Tout autre argument est refusé : new Uint8Array en ferait un
// fichier vide, d'une promesse non attendue comme d'un Blob.
function enOctets(entree) {
  const genre = Object.prototype.toString.call(entree);
  if (genre === '[object Uint8Array]') return entree;
  if (genre === '[object ArrayBuffer]') return new Uint8Array(entree);
  throw new TypeError('octets : Uint8Array ou ArrayBuffer attendu');
}

// Texte UTF-16 des octets, la marque déjà retirée ; encodage est 'utf-16le' ou
// 'utf-16be', l'étiquette même du décodeur. Le décodage est strict : un nombre
// impair d'octets ou un substitut isolé lève UTF16_INVALIDE, là où le décodeur
// sèmerait des caractères de remplacement dans les noms.
function lireUtf16(octets, encodage) {
  try {
    return { texte: new TextDecoder(encodage, { fatal: true }).decode(octets), encodage };
  } catch {
    throw refuser('UTF16_INVALIDE');
  }
}

// Texte UTF-8 des octets, ou null quand ils ne sont pas de l'UTF-8 valide.
function lireUtf8(octets) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(octets);
  } catch {
    return null;
  }
}

// Les quatre temps de decoder, sans le contrôle du caractère nul.
function lireOctets(octets) {
  if (commencePar(octets, MARQUE_UTF8)) {
    const texte = lireUtf8(octets.subarray(MARQUE_UTF8.length));
    if (texte === null) throw refuser('UTF8_INVALIDE');
    return { texte, encodage: 'utf-8-bom' };
  }
  if (commencePar(octets, MARQUE_UTF16LE)) {
    return lireUtf16(octets.subarray(MARQUE_UTF16LE.length), 'utf-16le');
  }
  if (commencePar(octets, MARQUE_UTF16BE)) {
    return lireUtf16(octets.subarray(MARQUE_UTF16BE.length), 'utf-16be');
  }
  if (octets.subarray(0, OCTETS_SONDES).includes(0)) throw refuser('UTF16_SANS_MARQUE');
  const texte = lireUtf8(octets);
  if (texte !== null) return { texte, encodage: 'utf-8' };
  // windows-1252 donne un caractère à chaque octet : le repli n'échoue jamais.
  return { texte: new TextDecoder('windows-1252').decode(octets), encodage: 'windows-1252' };
}

/**
 * Décode les octets d'un fichier CSV et rend le texte avec l'encodage retenu,
 * en quatre temps, dans cet ordre :
 *   1. la marque d'ordre d'octets UTF-8, qui déclare l'encodage : des octets
 *      qui ne sont pas de l'UTF-8 valide sont refusés ;
 *   2. la marque UTF-16, LE puis BE, qui déclare l'encodage : des octets qui ne
 *      sont pas de l'UTF-16 valide, nombre impair d'octets ou substitut isolé,
 *      sont refusés ;
 *   3. sans marque, un octet nul parmi les 4 096 premiers octets : refus ;
 *   4. UTF-8 strict, sinon windows-1252.
 * La marque n'entre pas dans le texte rendu. Quel que soit le temps qui a
 * décodé, un texte qui porte le caractère nul est refusé.
 *
 * Le troisième temps précède le quatrième parce qu'un texte UTF-16 sans marque
 * se lit sans erreur dans l'un ou l'autre des décodeurs suivants : en UTF-8
 * quand il n'a pas d'accent, chaque octet nul s'y lisant comme le caractère
 * nul, en windows-1252 quand il en a, ce décodeur acceptant tout octet. Le
 * texte rendu serait entrelardé de caractères nuls, sans qu'aucun calcul
 * n'échoue. Le refus du caractère nul rattrape ce que ce temps ne voit pas :
 * un nul au-delà des 4 096 premiers octets, et un texte que sa marque fait lire
 * sans erreur, comme l'UTF-32 LE, dont la marque FF FE 00 00 commence par celle
 * de l'UTF-16 LE.
 *
 * Sous la marque UTF-8, un repli sur windows-1252 changerait chaque accent de la
 * partie valide en caractères parasites, sans qu'aucun calcul n'échoue : le
 * fichier est refusé.
 *
 * @param {Uint8Array|ArrayBuffer} octets  l'un ou l'autre, de n'importe quel
 *   contexte d'exécution
 * @returns {{ texte: string, encodage: 'utf-8-bom'|'utf-16le'|'utf-16be'|'utf-8'|'windows-1252' }}
 * @throws {ErreurCsv} UTF16_SANS_MARQUE, UTF16_INVALIDE, UTF8_INVALIDE ou
 *   CARACTERE_NUL, chacun de détails { remede: 'ENREGISTRER_EN_UTF8' }
 * @throws {TypeError} quand octets n'est ni un Uint8Array ni un ArrayBuffer
 */
export function decoder(octets) {
  const lu = lireOctets(enOctets(octets));
  if (contientNul(lu.texte)) throw refuser('CARACTERE_NUL');
  return lu;
}
