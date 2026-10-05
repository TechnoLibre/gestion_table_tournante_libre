// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le générateur pseudo-aléatoire unique du projet (§ 15.5, point 1) : PCG32,
// variante XSH RR 64/32 de pcg_basic.c. L'état et l'incrément sont des entiers
// de 64 bits, portés chacun en deux mots non signés de 32 bits, haut et bas.
// Un pas fait état ← état × 6364136223846793005 + incrément, modulo 2^64 ;
// chaque tirage rend 32 bits de l'état d'avant le pas, mélangés par la
// fonction de sortie XSH RR. Tout le calcul tient en entiers exacts sur des
// nombres flottants, sans BigInt ni lecture de l'environnement : même graine,
// même flux, même suite, sur tout moteur d'exécution. L'ordre des tirages
// fait partie du contrat (§ 15.5, point 3) : suivant consomme un tirage ;
// borne, un par essai, rejets compris ; melanger, ceux de ses n − 1 appels à
// borne.

// 6364136223846793005, le multiplicateur de pcg_basic.c, en deux mots.
const MULTIPLICATEUR_HAUT = 0x5851f42d;
const MULTIPLICATEUR_BAS = 0x4c957f2d;
const DEUX_32 = 0x100000000;
const MOT_MAX = 0xffffffff;

/**
 * Flux (initseq de pcg32_srandom_r) réservés, un par usage : à graine égale,
 * deux usages tirent deux suites différentes.
 */
export const FLUX = Object.freeze({ GRAINES: 1, RECHERCHE: 2, DEMO: 3 });

// Produit des 64 bits bas de (ahi:alo) × (bhi:blo). Chaque colonne reste sous
// 2^35, donc exacte en double ; la retenue se propage par division entière.
function mul64(ahi, alo, bhi, blo) {
  const a0 = alo & 0xffff, a1 = alo >>> 16, a2 = ahi & 0xffff, a3 = ahi >>> 16;
  const b0 = blo & 0xffff, b1 = blo >>> 16, b2 = bhi & 0xffff, b3 = bhi >>> 16;
  let t = a0 * b0;
  const r0 = t % 65536; t = Math.floor(t / 65536) + a0 * b1 + a1 * b0;
  const r1 = t % 65536; t = Math.floor(t / 65536) + a0 * b2 + a1 * b1 + a2 * b0;
  const r2 = t % 65536; t = Math.floor(t / 65536) + a0 * b3 + a1 * b2 + a2 * b1 + a3 * b0;
  const r3 = t % 65536;
  return [(r3 * 65536 + r2) >>> 0, (r1 * 65536 + r0) >>> 0];
}

// Écrit une valeur reçue dans un message d'erreur : un nombre tel quel, toute
// autre valeur suivie de son type.
function decrire(valeur) {
  return typeof valeur === 'number' ? String(valeur) : `${String(valeur)} (${typeof valeur})`;
}

// Lève une RangeError nommant le paramètre quand la valeur n'est pas un
// entier de min à max.
function exigerEntier(nom, valeur, min, max) {
  if (!Number.isInteger(valeur) || valeur < min || valeur > max) {
    throw new RangeError(`${nom} : entier de ${min} à ${max} attendu, reçu ${decrire(valeur)}`);
  }
}

/**
 * Générateur PCG32 (XSH RR 64/32), état 64 bits porté en deux mots de 32 bits.
 * Ensemencement identique à pcg32_srandom_r(initstate, initseq).
 *
 * L'objet rendu porte :
 * - suivant() : entier non signé de 32 bits, pcg32_random_r ;
 * - borne(n) : entier uniforme de [0, n), n entier de 1 à 2^32 − 1, par le
 *   rejet de pcg32_boundedrand_r ;
 * - melanger(tab) : mélange tab en place et le rend, par la boucle de
 *   pcg32-demo.c — pour i de n à 2, échange l'élément borne(i) et
 *   l'élément i − 1.
 *
 * @param {number} graine  initstate, entier de 0 à 2^32 − 1
 * @param {number} flux    initseq, entier de 0 à 2^32 − 1 (voir FLUX)
 * @returns {{suivant: function(): number, borne: function(number): number,
 *            melanger: function(Array|Int32Array): (Array|Int32Array)}}
 * @throws {RangeError} graine ou flux hors de cet intervalle ; borne(n) pour
 *   n hors du sien
 */
export function creerPcg32(graine, flux) {
  exigerEntier('graine', graine, 0, MOT_MAX);
  exigerEntier('flux', flux, 0, MOT_MAX);

  // Incrément impair (flux << 1) | 1 : le bit 31 du flux passe au mot haut.
  const incrementHaut = flux >>> 31;
  const incrementBas = ((flux << 1) | 1) >>> 0;
  let haut = 0;
  let bas = 0;

  // état ← état + (h:b), modulo 2^64. La somme des mots bas, sous 2^33, est
  // exacte ; sa retenue passe au mot haut.
  function ajouter(h, b) {
    const somme = bas + b;
    bas = somme >>> 0;
    haut = (haut + h + (somme >= DEUX_32 ? 1 : 0)) >>> 0;
  }

  function suivant() {
    const ancienHaut = haut;
    const ancienBas = bas;
    [haut, bas] = mul64(haut, bas, MULTIPLICATEUR_HAUT, MULTIPLICATEUR_BAS);
    ajouter(incrementHaut, incrementBas);
    // Sortie XSH RR de l'état d'avant le pas : les bits 27 à 58 de
    // état ^ (état >> 18), tournés à droite du nombre que forment les 5 bits
    // hauts de l'état.
    const xHaut = ancienHaut ^ (ancienHaut >>> 18);
    const xBas = ancienBas ^ ((ancienBas >>> 18) | (ancienHaut << 14));
    const melange = (xBas >>> 27) | (xHaut << 5);
    const rotation = ancienHaut >>> 27;
    return ((melange >>> rotation) | (melange << (-rotation & 31))) >>> 0;
  }

  // Les tirages sous le seuil (2^32 − n) mod n sont rejetés : les
  // 2^32 − seuil valeurs restantes, multiple de n, se répartissent également
  // entre les n restes. La garde précède le seuil, qui vaudrait NaN pour
  // n = 0. La boucle tire tant que r < seuil : pour un seuil entier, elle
  // accepte les mêmes tirages que le « r >= seuil » de pcg32_boundedrand_r ;
  // pour un seuil NaN, elle rend après un tirage, là où cette forme ne
  // rendrait jamais. Une garde affaiblie fait ainsi échouer l'épreuve des
  // bornes invalides au lieu de la figer : une boucle synchrone sans fin
  // échappe au délai du lanceur.
  function borne(n) {
    exigerEntier('borne', n, 1, MOT_MAX);
    const seuil = (DEUX_32 - n) % n;
    let r;
    do {
      r = suivant();
    } while (r < seuil);
    return r % n;
  }

  // Un tableau de moins de deux éléments ne consomme aucun tirage.
  function melanger(tab) {
    for (let i = tab.length; i > 1; i -= 1) {
      const j = borne(i);
      const element = tab[j];
      tab[j] = tab[i - 1];
      tab[i - 1] = element;
    }
    return tab;
  }

  // pcg32_srandom_r : état nul, un pas, ajout de la graine, un pas.
  suivant();
  ajouter(0, graine);
  suivant();

  return { suivant, borne, melanger };
}
