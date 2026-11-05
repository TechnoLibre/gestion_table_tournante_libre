// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Module inventé que mute test/mutation.long.test.js : chaque fonction porte
// un site dont le mutant a une issue connue sous calcul.epreuve.js.

// La somme des entiers de 1 à n. « total += i » → « total -= i » change la
// somme ; « i++ » → « i-- » ne termine pas dès que n ≥ 1.
export function somme(n) {
  let total = 0;
  for (let i = 1; i <= n; i++) total += i;
  return total;
}

// Le plus grand de deux nombres. « a > b » → « a >= b » rend le même nombre
// pour tout couple : un mutant équivalent, qui survit.
export function plusGrand(a, b) {
  return a > b ? a : b;
}
