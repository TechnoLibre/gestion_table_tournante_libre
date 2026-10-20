// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Module inventé du petit arbre que test/mutation.long.test.js audite par
// scripts/mutation/audit.js, posé en src/moteur/bornes.js d'un dossier
// temporaire. Chaque fonction porte des sites dont l'issue est connue sous
// bornes.epreuve.js (la série node) et bornes.longue.js (la série longue).

// Le plus grand de deux nombres. « a > b » → « a >= b » rend le même nombre
// pour tout couple : un survivant que ni l'une ni l'autre série ne tue.
export function plusGrand(a, b) {
  return a > b ? a : b;
}

// Le triple d'un nombre. La série node n'en lit que le type, la série longue
// la valeur : « n * 3 » → « n / 3 », « n * 4 », « n * 0 » survivent à la
// première et meurent sous la seconde.
export function triple(n) {
  return n * 3;
}
