// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'échelle graphique du plan (§ 7.7) : une barre d'une longueur ronde, que le
// lecteur reporte sur le dessin. Une barre reste juste quand une impression
// change le facteur d'échelle, là où un rapport écrit en chiffres deviendrait
// faux.

// Mantisses des longueurs rondes, de la plus grande à la plus petite.
const MANTISSES = [5, 2, 1];

// m × 10ⁿ, au plus près : une puissance négative divise par 10⁻ⁿ, que
// l'arithmétique flottante représente exactement, plutôt que de multiplier
// par 10ⁿ, qu'elle arrondit.
const ronde = (m, n) => (n >= 0 ? m * 10 ** n : m / 10 ** -n);

/**
 * La plus grande longueur ronde — 1, 2 ou 5 × 10ⁿ cm, n entier de signe
 * quelconque — dont la barre tient dans largeurMaxPx à l'échelle k, et la
 * largeur de cette barre, longueurCm × k. La recherche part de la décade
 * au-dessus de largeurMaxPx / k et descend, mantisse par mantisse, jusqu'à la
 * première longueur qui tient : l'arrondi du logarithme ne fait rien manquer.
 * Lève RangeError quand k ou largeurMaxPx n'est pas un nombre fini > 0.
 * @param {number} k  px/cm
 * @param {number} largeurMaxPx
 * @returns {{longueurCm: number, largeurPx: number}}
 */
export function echelleGraphique(k, largeurMaxPx) {
  for (const [nom, valeur] of [['k', k], ['largeur', largeurMaxPx]]) {
    if (typeof valeur !== 'number' || !Number.isFinite(valeur) || valeur <= 0) {
      throw new RangeError(`${nom} : nombre fini > 0 attendu, reçu ${String(valeur)}`);
    }
  }
  for (let n = Math.floor(Math.log10(largeurMaxPx / k)) + 1; ; n -= 1) {
    for (const m of MANTISSES) {
      const longueurCm = ronde(m, n);
      if (longueurCm * k <= largeurMaxPx) return { longueurCm, largeurPx: longueurCm * k };
    }
  }
}
