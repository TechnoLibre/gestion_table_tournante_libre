// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le logo d'une personne dans le dossier de son événement (§ 8.6, § 8.7) :
// un fichier logo/<empreinte>.png, nommé par le SHA-256 de ses octets en 64
// chiffres hexadécimaux minuscules. Le nom suit le contenu : les mêmes
// octets donnent le même fichier, qui ne s'écrit qu'une fois, et deux images
// distinctes ne se remplacent jamais. Aucun logo ne s'efface ici : un
// fichier que plus rien ne désigne reste, et part avec le dossier de
// l'événement.
//
// Le SHA-256 est écrit ici, en JavaScript, d'après FIPS 180-4 : il ne
// dépend d'aucune API de la plateforme, se calcule de la même façon sous
// node, sous web et sous la page de la coquille, et ne lit ni horloge ni
// aléa. Le module ne touche aucun fichier qu'à travers le SystemeFichiers
// qu'il reçoit.

/** Le dossier des logos, dans le dossier de l'événement. */
export const DOSSIER_LOGO = 'logo';

/**
 * Le plafond d'une image source choisie pour un logo : 25 Mo, comptés en
 * mébioctets comme l'explorateur de Windows les affiche. Le dialogue
 * d'import le lit avant les octets (systeme_fichiers.js, genre image).
 */
export const LOGO_SOURCE_MAX_OCTETS = 25 * 1024 * 1024;

// Un chemin de logo : logo/, 64 chiffres hexadécimaux minuscules, .png, rien
// avant ni après.
const FORME_CHEMIN = /^logo\/[0-9a-f]{64}\.png$/;
const FORME_EMPREINTE = /^[0-9a-f]{64}$/;

// Les constantes de FIPS 180-4, § 4.2.2 : les 32 premiers bits des parties
// fractionnaires des racines cubiques des 64 premiers nombres premiers.
const K = Uint32Array.of(
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
);

// La valeur initiale de FIPS 180-4, § 5.3.3 : les 32 premiers bits des
// parties fractionnaires des racines carrées des 8 premiers nombres premiers.
const H0 = Uint32Array.of(
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
);

// Rotation à droite d'un mot de 32 bits ; le résultat, signé, se ramène à
// 32 bits sans signe par >>> 0 là où il s'additionne.
const rotr = (mot, n) => (mot >>> n) | (mot << (32 - n));

function exigerOctets(octets) {
  if (!(octets instanceof Uint8Array)) {
    throw new TypeError(`octets : Uint8Array attendu, reçu ${Object.prototype.toString.call(octets)}`);
  }
}

/**
 * L'empreinte SHA-256 des octets (FIPS 180-4), en 64 chiffres hexadécimaux
 * minuscules. Seuls comptent les octets de la vue reçue, qui reste telle.
 * Le message se complète d'un octet 0x80, de zéros, puis de sa longueur en
 * bits sur 64 bits gros-boutistes, jusqu'à un multiple de 64 octets.
 *
 * @param {Uint8Array} octets
 * @returns {string}
 * @throws {TypeError} des octets d'une autre forme qu'un Uint8Array
 */
export function empreinteSha256(octets) {
  exigerOctets(octets);
  const longueur = octets.length;
  const message = new Uint8Array(Math.ceil((longueur + 9) / 64) * 64);
  message.set(octets);
  message[longueur] = 0x80;
  const vue = new DataView(message.buffer);
  vue.setBigUint64(message.length - 8, BigInt(longueur) * 8n);
  const h = Uint32Array.from(H0);
  const w = new Uint32Array(64);
  for (let bloc = 0; bloc < message.length; bloc += 64) {
    for (let t = 0; t < 16; t += 1) w[t] = vue.getUint32(bloc + 4 * t);
    for (let t = 16; t < 64; t += 1) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = w[t - 16] + s0 + w[t - 7] + s1;
    }
    let [a, b, c, d, e, f, g, k] = h;
    for (let t = 0; t < 64; t += 1) {
      const t1 = (k + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + w[t]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      k = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    // Un Uint32Array ramène chaque somme à 32 bits.
    h[0] += a;
    h[1] += b;
    h[2] += c;
    h[3] += d;
    h[4] += e;
    h[5] += f;
    h[6] += g;
    h[7] += k;
  }
  return Array.from(h, (mot) => mot.toString(16).padStart(8, '0')).join('');
}

/**
 * Le chemin d'un logo, relatif au dossier de son événement :
 * logo/<empreinte>.png, 73 unités.
 *
 * @param {string} empreinte  64 chiffres hexadécimaux minuscules
 * @returns {string}
 * @throws {TypeError} une empreinte d'une autre forme
 */
export function cheminLogo(empreinte) {
  if (typeof empreinte !== 'string' || !FORME_EMPREINTE.test(empreinte)) {
    const recu = JSON.stringify(empreinte);
    throw new TypeError(`cheminLogo : empreinte de 64 chiffres hexadécimaux attendue, reçu ${recu}`);
  }
  return `${DOSSIER_LOGO}/${empreinte}.png`;
}

/**
 * Vrai pour un chemin de la forme que rend cheminLogo, et pour lui seul :
 * aucune autre casse, extension ou longueur, rien avant ni après. Un chemin
 * lu dans un fichier ne désigne ainsi qu'un fichier de logo/, jamais l'état,
 * le journal ou un fichier hors du dossier de l'événement.
 *
 * @param {unknown} chemin
 * @returns {boolean}
 */
export function estCheminLogo(chemin) {
  return typeof chemin === 'string' && FORME_CHEMIN.test(chemin);
}

// Vrai quand deux tableaux d'octets portent les mêmes octets.
function memesOctets(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Écrit un logo dans le dossier de son événement et rend son chemin,
 * logo/<empreinte>.png, relatif à ce dossier. Le fichier présent sous ce nom
 * qui porte déjà ces octets reste tel, sans aucune écriture, logo/ compris ;
 * absent, ou d'autres octets — une écriture interrompue là où le renommage
 * n'est pas atomique —, logo/ se crée au besoin, puis le fichier s'écrit par
 * ecrireOctetsAtomique. Aucun autre fichier n'est touché.
 *
 * @param {import('./systeme_fichiers.js').SystemeFichiers} fs  la vue du
 *        dossier de l'événement (vueDossier)
 * @param {import('./systeme_fichiers.js').Racine} racine
 * @param {Uint8Array} octets  ceux du PNG
 * @returns {Promise<string>}
 * @throws {TypeError} des octets d'une autre forme qu'un Uint8Array, avant
 *         tout accès
 * @throws {import('./erreurs.js').ErreurStockage} LECTURE quand le fichier
 *         présent ne se lit pas ; ECRITURE quand logo/ ou le fichier ne
 *         s'écrivent pas — un fichier logo en travers du dossier compris
 */
export async function ecrireLogo(fs, racine, octets) {
  exigerOctets(octets);
  const chemin = cheminLogo(empreinteSha256(octets));
  let present = null;
  try {
    present = await fs.lireOctets(racine, chemin);
  } catch (erreur) {
    if (erreur?.code !== 'ABSENT') throw erreur;
  }
  if (present !== null && memesOctets(present, octets)) return chemin;
  await fs.creerDossier(racine, DOSSIER_LOGO);
  await fs.ecrireOctetsAtomique(racine, chemin, octets);
  return chemin;
}
