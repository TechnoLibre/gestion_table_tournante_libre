// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// L'aperçu de la liste (§ 8.1, § 8.6) : <base>.gtt-apercu.json, à côté du
// fichier d'état, garde les deux résumés que la liste montre pour
// l'événement — les mesures de son retenu et la meilleure proposition de son
// classement — avec l'empreinte des textes dont ils ont été calculés. La
// liste les montre dès l'ouverture, et ne les recalcule que quand
// l'empreinte des textes sur le disque n'est plus celle de l'aperçu.
//
// Le fichier est une ligne de JSON, ses clés dans cet ordre :
// {"format":1,"produit":…,"empreinte":…,"mesuresDuRetenu":…,
// "meilleureDuClassement":…}, des nombres seulement, aucun nom. Un aperçu
// illisible, d'une autre forme, d'un autre format ou d'une autre
// construction vaut absent : sa lecture ne lève jamais et n'annonce rien.
//
// L'empreinte est un texte, FNV-1a 64 bits sur les octets UTF-8 du texte de
// l'état, puis sur ceux de la dernière ligne complète du journal, deux
// moitiés jointes par « : ». Le calcul est pur et synchrone, sans
// crypto.subtle, absent hors d'un contexte sécurisé. Le module est pur : il
// ne touche aucun fichier, ne lit ni horloge ni aléa.
import { clesRangees } from './document.js';

/** Version du format de l'aperçu, distincte de celle du fichier d'état. */
export const FORMAT_APERCU = 1;

// Les clés de la racine, rangées comme clesRangees les rend.
const RACINE_RANGEE = ['empreinte', 'format', 'meilleureDuClassement', 'mesuresDuRetenu', 'produit'].join('|');

// Vrai pour un objet qui n'est pas une liste.
const estObjet = (valeur) => typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);

// Vrai pour un entier sûr au moins égal à minimum.
const entierDes = (valeur, minimum) => Number.isSafeInteger(valeur) && valeur >= minimum;

// Vrai pour les mesures d'un retenu, resumeDuRetenu : null, ou exactement
// deux clés, collisionsCumulees et rencontresRepetees, deux entiers ≥ 0 —
// deux clés dont ces deux-là se lisent ne laissent place à aucune autre. Les
// noms des mesures ne s'écrivent pas en liste hors du registre des critères
// (moteur/criteres.js).
const mesuresLisibles = (mesures) =>
  mesures === null ||
  (estObjet(mesures) &&
    clesRangees(mesures).length === 2 &&
    entierDes(mesures.collisionsCumulees, 0) &&
    entierDes(mesures.rencontresRepetees, 0));

// Vrai pour la meilleure proposition, resumeDuMeilleur : null, ou exactement
// id, un entier ≥ 1.
const meilleureLisible = (meilleure) =>
  meilleure === null || (estObjet(meilleure) && clesRangees(meilleure).join('|') === 'id' && entierDes(meilleure.id, 1));

/**
 * Le texte de l'aperçu : une ligne de JSON suivie de sa fin de ligne, ses
 * clés dans l'ordre du format, les résumés recopiés champ par champ.
 *
 * @param {Object} apercu
 * @param {string} apercu.produitVersion   la construction qui a calculé
 * @param {string} apercu.empreinte        empreinteApercu des textes lus
 * @param {{collisionsCumulees: number, rencontresRepetees: number}|null} apercu.mesuresDuRetenu
 * @param {{id: number}|null} apercu.meilleureDuClassement
 * @returns {string}
 * @throws {TypeError} une valeur que lireApercu ne relirait pas, avant de
 *         rien composer
 */
export function texteApercu({ produitVersion, empreinte, mesuresDuRetenu, meilleureDuClassement }) {
  if (typeof produitVersion !== 'string') throw new TypeError('texteApercu : produitVersion, une chaîne, attendu');
  if (typeof empreinte !== 'string') throw new TypeError('texteApercu : empreinte, une chaîne, attendue');
  if (!mesuresLisibles(mesuresDuRetenu)) {
    throw new TypeError(`texteApercu : mesuresDuRetenu illisibles, reçu ${JSON.stringify(mesuresDuRetenu)}`);
  }
  if (!meilleureLisible(meilleureDuClassement)) {
    throw new TypeError(`texteApercu : meilleureDuClassement illisible, reçu ${JSON.stringify(meilleureDuClassement)}`);
  }
  const mesures =
    mesuresDuRetenu === null
      ? null
      : { collisionsCumulees: mesuresDuRetenu.collisionsCumulees, rencontresRepetees: mesuresDuRetenu.rencontresRepetees };
  const meilleure = meilleureDuClassement === null ? null : { id: meilleureDuClassement.id };
  const ligne = {
    format: FORMAT_APERCU,
    produit: produitVersion,
    empreinte,
    mesuresDuRetenu: mesures,
    meilleureDuClassement: meilleure,
  };
  return `${JSON.stringify(ligne)}\n`;
}

/**
 * L'aperçu que porte un texte, quand il est de la construction
 * produitVersion : { empreinte, mesuresDuRetenu, meilleureDuClassement },
 * des objets neufs. null, sans lever, pour ce qui n'est pas un texte, un
 * texte hors JSON — une marque d'ordre d'octets en tête mise à part —, une
 * racine qui n'a pas exactement les clés du format, un autre format, une
 * autre construction, une empreinte qui n'est pas une chaîne, des résumés
 * d'une autre forme.
 *
 * @param {unknown} texte
 * @param {string} produitVersion
 * @returns {{empreinte: string, mesuresDuRetenu: Object|null, meilleureDuClassement: Object|null}|null}
 */
export function lireApercu(texte, produitVersion) {
  if (typeof texte !== 'string') return null;
  let lu;
  try {
    lu = JSON.parse(texte.replace(/^\u{FEFF}/u, ''));
  } catch {
    return null;
  }
  if (!estObjet(lu) || clesRangees(lu).join('|') !== RACINE_RANGEE) return null;
  if (lu.format !== FORMAT_APERCU || lu.produit !== produitVersion || typeof lu.empreinte !== 'string') return null;
  if (!mesuresLisibles(lu.mesuresDuRetenu) || !meilleureLisible(lu.meilleureDuClassement)) return null;
  const { mesuresDuRetenu, meilleureDuClassement } = lu;
  return {
    empreinte: lu.empreinte,
    mesuresDuRetenu:
      mesuresDuRetenu === null
        ? null
        : { collisionsCumulees: mesuresDuRetenu.collisionsCumulees, rencontresRepetees: mesuresDuRetenu.rencontresRepetees },
    meilleureDuClassement: meilleureDuClassement === null ? null : { id: meilleureDuClassement.id },
  };
}

/**
 * FNV-1a 64 bits des octets UTF-8 d'un texte, en 16 chiffres hexadécimaux
 * minuscules. L'état tient en quatre mots de 16 bits, du poids faible au
 * poids fort, pour que chaque produit reste exact en nombre flottant : le
 * premier FNV, 0x100000001b3, vaut 0x1b3 sur le mot 0 et 0x100 sur le
 * mot 2. Un caractère se code comme TextEncoder le code : une paire de
 * substitution en quatre octets, une moitié seule comme U+FFFD.
 *
 * @param {string} texte
 * @returns {string}
 */
export function fnv1a64(texte) {
  let h0 = 0x2325;
  let h1 = 0x8422;
  let h2 = 0x9ce4;
  let h3 = 0xcbf2;
  const octet = (valeur) => {
    h0 ^= valeur;
    const t0 = h0 * 0x1b3;
    const t1 = h1 * 0x1b3 + (t0 >>> 16);
    const t2 = h2 * 0x1b3 + h0 * 0x100 + (t1 >>> 16);
    const t3 = h3 * 0x1b3 + h1 * 0x100 + (t2 >>> 16);
    h0 = t0 & 0xffff;
    h1 = t1 & 0xffff;
    h2 = t2 & 0xffff;
    h3 = t3 & 0xffff;
  };
  for (let i = 0; i < texte.length; i += 1) {
    let point = texte.charCodeAt(i);
    if (point >= 0xd800 && point <= 0xdfff) {
      const suivant = i + 1 < texte.length ? texte.charCodeAt(i + 1) : 0;
      if (point <= 0xdbff && suivant >= 0xdc00 && suivant <= 0xdfff) {
        point = 0x10000 + ((point - 0xd800) << 10) + (suivant - 0xdc00);
        i += 1;
      } else {
        point = 0xfffd;
      }
    }
    if (point < 0x80) {
      octet(point);
    } else if (point < 0x800) {
      octet(0xc0 | (point >> 6));
      octet(0x80 | (point & 0x3f));
    } else if (point < 0x10000) {
      octet(0xe0 | (point >> 12));
      octet(0x80 | ((point >> 6) & 0x3f));
      octet(0x80 | (point & 0x3f));
    } else {
      octet(0xf0 | (point >> 18));
      octet(0x80 | ((point >> 12) & 0x3f));
      octet(0x80 | ((point >> 6) & 0x3f));
      octet(0x80 | (point & 0x3f));
    }
  }
  const mot = (valeur) => valeur.toString(16).padStart(4, '0');
  return mot(h3) + mot(h2) + mot(h1) + mot(h0);
}

// La dernière ligne complète d'un texte de journal, sans sa fin de ligne :
// ce qui précède le dernier LF, depuis le LF d'avant ou le début ; null sans
// LF. Une ligne finale sans fin de ligne, que la lecture du journal écarte,
// n'y compte pas.
function derniereLigneComplete(texte) {
  const fin = texte.lastIndexOf('\n');
  if (fin === -1) return null;
  return texte.slice(texte.lastIndexOf('\n', fin - 1) + 1, fin);
}

/**
 * L'empreinte des textes dont dépendent les résumés d'un événement :
 * fnv1a64 du texte de l'état, « : », puis fnv1a64 de la dernière ligne
 * complète du journal que l'ouverture lit, ou « - » sans journal ou sans
 * ligne complète. Un geste réécrit l'état ; une coupure entre le journal et
 * l'état laisse le journal en avance d'une entrée, que l'ouverture rattrape :
 * sa dernière ligne change l'empreinte, l'état restant le même.
 *
 * @param {string} texteEtat
 * @param {string|null} texteJournal
 * @returns {string}
 */
export function empreinteApercu(texteEtat, texteJournal) {
  const derniere = texteJournal === null ? null : derniereLigneComplete(texteJournal);
  return `${fnv1a64(texteEtat)}:${derniere === null ? '-' : fnv1a64(derniere)}`;
}
