// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de l'échelle graphique (§ 7.7) : la plus grande longueur ronde, 1,
// 2 ou 5 × 10ⁿ cm, dont la barre tient dans la largeur donnée à l'échelle k.
// Les cas chiffrés sont écrits en clair ; le balayage de k vérifie chaque
// résultat par la définition, non par une seconde implémentation.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { echelleGraphique } from './echelle.js';

// Vrai quand longueur vaut 1, 2 ou 5 × 10ⁿ, n entier de signe quelconque,
// à l'arrondi des nombres flottants près.
function estRonde(longueur) {
  const puissance = 10 ** Math.floor(Math.log10(longueur) + 1e-12);
  const mantisse = longueur / puissance;
  return [1, 2, 5].some((m) => Math.abs(mantisse - m) < 1e-9);
}

// La valeur ronde qui suit longueur : 1 → 2, 2 → 5, 5 → 10.
function rondeSuivante(longueur) {
  const puissance = 10 ** Math.floor(Math.log10(longueur) + 1e-12);
  const mantisse = Math.round(longueur / puissance);
  return (mantisse === 1 ? 2 : mantisse === 2 ? 5 : 10) * puissance;
}

describe("échelle : l'échelle graphique (§ 7.7)", () => {
  test('k = 1, 0,19 et 10 dans 200 px', () => {
    assert.deepEqual(echelleGraphique(1, 200), { longueurCm: 200, largeurPx: 200 });
    const etroite = echelleGraphique(0.19, 200);
    assert.equal(etroite.longueurCm, 1000);
    assert.ok(Math.abs(etroite.largeurPx - 190) < 1e-9, `${etroite.largeurPx}`);
    assert.deepEqual(echelleGraphique(10, 200), { longueurCm: 20, largeurPx: 200 });
    assert.deepEqual(echelleGraphique(10, 5), { longueurCm: 0.5, largeurPx: 5 });
  });

  test('pour chaque k de 0,05 à 10, raison 1,07 : longueur ronde, barre dans 200 px, la ronde suivante dépasserait', () => {
    let comptes = 0;
    for (let k = 0.05; k <= 10; k *= 1.07) {
      const { longueurCm, largeurPx } = echelleGraphique(k, 200);
      assert.ok(estRonde(longueurCm), `k = ${k} : ${longueurCm}`);
      assert.ok(Math.abs(largeurPx - longueurCm * k) < 1e-9, `k = ${k}`);
      assert.ok(largeurPx <= 200, `k = ${k} : ${largeurPx}`);
      assert.ok(rondeSuivante(longueurCm) * k > 200, `k = ${k} : ${longueurCm}`);
      comptes += 1;
    }
    assert.equal(comptes, 79);
  });

  test("k ou largeur qui n'est pas un nombre fini positif est refusé", () => {
    for (const [k, largeur] of [[0, 200], [-1, 200], [Number.NaN, 200], [Number.POSITIVE_INFINITY, 200], [1, 0], [1, -5], [1, Number.NaN], [null, 200]]) {
      assert.throws(() => echelleGraphique(k, largeur), RangeError, `${k}, ${largeur}`);
    }
  });

  test("un rapport largeur / k qui sort des nombres flottants finis et non nuls est refusé, sans boucle", () => {
    // 1e-300 / 1e300 vaut 0, et 1e-300 / 1e10 tombe sous le plus petit
    // nombre normal : la plus grande longueur ronde y serait 0, une barre
    // vide. 1e300 / 1e-300 vaut Infinity, et aucune décade ne s'y atteint.
    const horsDomaine = [[1e300, 1e-300], [1e10, 1e-300], [1e-300, 1e300], [Number.MIN_VALUE, Number.MAX_VALUE]];
    for (const [k, largeur] of horsDomaine) {
      assert.throws(() => echelleGraphique(k, largeur), RangeError, `${k}, ${largeur}`);
    }
  });

  test('aux bords du domaine admis, la longueur reste ronde, finie et non nulle', () => {
    for (const [k, largeur] of [[1e-150, 1e150], [1e150, 1e-150], [1, Number.MAX_VALUE], [1, 2 ** -1022]]) {
      const { longueurCm, largeurPx } = echelleGraphique(k, largeur);
      assert.ok(Number.isFinite(longueurCm) && longueurCm > 0 && largeurPx <= largeur, `${k}, ${largeur} : ${longueurCm}`);
    }
  });
});
