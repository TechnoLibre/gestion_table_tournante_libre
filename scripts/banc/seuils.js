// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les seuils du banc de mesure (§ 19.10, § 19.4, § 6.2), tirés de mesures
// déjà prises : le plus grand entier qui tient un prédicat, par dichotomie ;
// le plus petit zoom au-delà duquel une courbe de temps par image tient son
// critère ; la tolérance de la chaîne témoin. Module pur, sans import ni
// horloge : il se charge sous node, où ses épreuves le jouent, comme dans la
// page du banc, où les *.banc.js lui passent leurs mesures.

/** Le temps par image qu'un glissement de la grande démonstration doit tenir,
 *  au p95, sur la machine de référence (Q13 b) : le choix de l'utilisateur.
 *  Il juge une garde du banc, pas une constante : il ne vit pas au registre. */
export const CRITERE_TEMPS_IMAGE_MS = 33;

// Le nombre de mesures sous lequel une gigue ne se lit pas (§ 19.4).
const MESURES_MIN = 10;

const estEntier = (valeur) => Number.isSafeInteger(valeur);

// La réponse du prédicat en n, qui doit être un booléen.
async function lire(predicat, n) {
  const reponse = await predicat(n);
  if (typeof reponse !== 'boolean') throw new TypeError(`plusGrandTenant : booléen attendu du prédicat en ${n}, reçu ${String(reponse)}`);
  return reponse;
}

/**
 * Le plus grand entier n de [min, max] où predicat(n) tient, pour un
 * prédicat décroissant — vrai jusqu'à un seuil, faux au-delà. Le prédicat se
 * lit aux deux bornes, puis par dichotomie entre le dernier n qui tient et le
 * premier qui ne tient pas ; enfin le résultat r et ses deux voisins se
 * relisent : r − 1 et r doivent tenir, r + 1 non, quand ils sont dans
 * l'intervalle. Une relecture qui dément la dichotomie — un trou sous le
 * seuil, une mesure qui change d'avis — lève en nommant l'entier fautif.
 * Une monotonie rompue loin du résultat ne se voit pas : la dichotomie ne
 * lit qu'une dizaine de points.
 *
 * @param {(n: number) => boolean|Promise<boolean>} predicat
 * @param {number} min   entier
 * @param {number} max   entier ≥ min
 * @returns {Promise<number|null>}   max quand il tient ; null quand ni min
 *   ni max ne tiennent
 * @throws {TypeError} un prédicat qui n'est pas une fonction ou ne rend pas
 *   un booléen
 * @throws {RangeError} des bornes qui ne sont pas des entiers ordonnés,
 *   avant tout appel ; un prédicat faux en min et vrai en max ; une
 *   relecture qui dément la dichotomie
 */
export async function plusGrandTenant(predicat, min, max) {
  if (typeof predicat !== 'function') throw new TypeError('plusGrandTenant : un prédicat est attendu');
  if (!estEntier(min) || !estEntier(max) || min > max) {
    throw new RangeError(`plusGrandTenant : bornes entières min ≤ max attendues, reçu ${String(min)} et ${String(max)}`);
  }
  const tientMin = await lire(predicat, min);
  const tientMax = min === max ? tientMin : await lire(predicat, max);
  if (!tientMin && tientMax) throw new RangeError(`plusGrandTenant : prédicat non monotone, faux en ${min} et vrai en ${max}`);
  if (!tientMin) return null;
  let resultat = max;
  if (!tientMax) {
    // Invariant : bas tient, haut ne tient pas.
    let bas = min;
    let haut = max;
    while (haut - bas > 1) {
      const milieu = bas + Math.floor((haut - bas) / 2);
      if (await lire(predicat, milieu)) bas = milieu;
      else haut = milieu;
    }
    resultat = bas;
  }
  const attendus = [
    [resultat - 1, true],
    [resultat, true],
    [resultat + 1, false],
  ];
  for (const [n, attendu] of attendus) {
    if (n < min || n > max) continue;
    if ((await lire(predicat, n)) !== attendu) {
      throw new RangeError(`plusGrandTenant : prédicat non monotone, ${attendu ? 'faux' : 'vrai'} en ${n} à la relecture, seuil lu ${resultat}`);
    }
  }
  return resultat;
}

const estPositifFini = (valeur) => typeof valeur === 'number' && Number.isFinite(valeur) && valeur > 0;
const estPositifOuNul = (valeur) => typeof valeur === 'number' && Number.isFinite(valeur) && valeur >= 0;

/**
 * Le plus petit k de la courbe au-delà duquel tout k de la courbe tient le
 * critère : son p95 vaut au plus critereMs. Les points se rangent par k
 * croissant ; le seuil est le point qui suit le dernier échec, ou le premier
 * point quand aucun n'échoue. Une courbe qui échoue à son plus grand k n'a
 * pas de seuil.
 *
 * @param {Array<{k: number, p95Ms: number}>} courbe   k en px/cm, fini > 0 et
 *   sans doublon ; p95Ms fini ≥ 0. La courbe reçue n'est pas modifiée ; ses
 *   autres champs sont ignorés.
 * @param {number} critereMs   fini > 0
 * @returns {{k: number|null, tenuPartout: boolean, jamaisTenu: boolean}}
 * @throws {TypeError} sur autre chose qu'une liste
 * @throws {RangeError} une courbe vide — elle ne prouve rien —, un point
 *   malformé, un k en double, un critère qui n'est pas un nombre fini > 0
 */
export function seuilDepuisCourbe(courbe, critereMs) {
  if (!Array.isArray(courbe)) throw new TypeError('seuilDepuisCourbe : une courbe est attendue');
  if (courbe.length === 0) throw new RangeError('seuilDepuisCourbe : courbe vide');
  if (!estPositifFini(critereMs)) throw new RangeError(`seuilDepuisCourbe : critère fini > 0 attendu, reçu ${String(critereMs)}`);
  for (const point of courbe) {
    if (!estPositifFini(point?.k) || !estPositifOuNul(point?.p95Ms)) {
      throw new RangeError(`seuilDepuisCourbe : point refusé, k ${String(point?.k)} et p95 ${String(point?.p95Ms)}`);
    }
  }
  const points = [...courbe].sort((a, b) => a.k - b.k);
  for (let i = 1; i < points.length; i += 1) {
    if (points[i].k === points[i - 1].k) throw new RangeError(`seuilDepuisCourbe : k ${points[i].k} en double`);
  }
  const tient = points.map(({ p95Ms }) => p95Ms <= critereMs);
  const dernierEchec = tient.lastIndexOf(false);
  return {
    k: dernierEchec === points.length - 1 ? null : points[dernierEchec + 1].k,
    tenuPartout: dernierEchec === -1,
    jamaisTenu: !tient.includes(true),
  };
}

// La médiane d'une liste non vide, la moyenne des deux du milieu pour une
// longueur paire.
function mediane(valeurs) {
  const triees = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(triees.length / 2);
  return triees.length % 2 === 1 ? triees[milieu] : (triees[milieu - 1] + triees[milieu]) / 2;
}

// Une valeur > 0 arrondie par excès à deux chiffres significatifs : le
// registre l'écrit telle quelle, et elle ne passe jamais sous la valeur
// reçue. toPrecision ôte le bruit du flottant que le produit laisse.
function parExces(valeur) {
  const pas = 10 ** (Math.floor(Math.log10(valeur)) - 1);
  let crans = Math.ceil(valeur / pas - 1e-9);
  if (Number((crans * pas).toPrecision(2)) < valeur) crans += 1;
  return Number((crans * pas).toPrecision(2));
}

// Les mesures d'une série : au moins MESURES_MIN longueurs finies > 0.
function exigerMesures(nom, mesures) {
  if (!Array.isArray(mesures) || mesures.length < MESURES_MIN || !mesures.every(estPositifFini)) {
    throw new RangeError(`toleranceTemoin : ${nom}, au moins ${MESURES_MIN} longueurs finies > 0 attendues`);
  }
}

/**
 * La tolérance relative de la chaîne témoin (§ 19.4) : le plus grand du
 * quart de l'écart relatif qu'introduit le repli et de trois fois la gigue
 * de la police embarquée, arrondi par excès à deux chiffres significatifs.
 * Chaque écart se rapporte à la longueur attendue, celle que donnent les
 * avances de la police :
 *  - ecartRepli : |médiane(repliPx) − attenduePx| / attenduePx ;
 *  - gigue : (max − min) des mesures de la police embarquée / attenduePx ;
 *  - biais : |médiane(embarqueePx) − attenduePx| / attenduePx.
 * La tolérance se refuse — valeur null, refus qui dit pourquoi — quand elle
 * n'écarte pas le repli (valeur ≥ ecartRepli) ou qu'elle rejetterait la
 * police embarquée elle-même (biais > valeur) : la mesure ne voit alors pas
 * ce qu'elle doit voir.
 *
 * @param {{attenduePx: number, embarqueePx: number[], repliPx: number[]}} mesures
 *   au moins dix longueurs rendues de chaque police, en px
 * @returns {{valeur: number|null, ecartRepli: number, gigue: number, biais: number, refus: string|null}}
 * @throws {RangeError} une longueur attendue qui n'est pas finie > 0, moins
 *   de dix mesures, une mesure qui n'est pas finie > 0
 */
export function toleranceTemoin({ attenduePx, embarqueePx, repliPx }) {
  if (!estPositifFini(attenduePx)) throw new RangeError(`toleranceTemoin : longueur attendue finie > 0, reçu ${String(attenduePx)}`);
  exigerMesures('police embarquée', embarqueePx);
  exigerMesures('repli', repliPx);
  const relatif = (ecart) => Number((ecart / attenduePx).toPrecision(12));
  const ecartRepli = relatif(Math.abs(mediane(repliPx) - attenduePx));
  const gigue = relatif(Math.max(...embarqueePx) - Math.min(...embarqueePx));
  const biais = relatif(Math.abs(mediane(embarqueePx) - attenduePx));
  const brute = Math.max(ecartRepli / 4, 3 * gigue);
  const mesure = { ecartRepli, gigue, biais };
  if (brute === 0 || parExces(brute) >= ecartRepli) {
    return { valeur: null, ...mesure, refus: 'la tolérance n’écarte pas le repli : le témoin ne distingue pas les deux polices' };
  }
  const valeur = parExces(brute);
  if (biais > valeur) {
    return { valeur: null, ...mesure, refus: 'la police embarquée s’écarte de ses avances au-delà de la tolérance : ce n’est pas elle qui est rendue' };
  }
  return { valeur, ...mesure, refus: null };
}
