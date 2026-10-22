// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le logo vectoriel de TechnoLibre lu sous node : les épreuves lisent le
// fichier de src/actifs par le disque, là où la page le reçoit de Vite par
// « ?raw » (src/actifs/logo.js), syntaxe que node ne connaît pas (§ 14.8).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Le chemin absolu du SVG du logo. */
export const CHEMIN_LOGO = fileURLToPath(new URL('../src/actifs/full_logo_technolibre_2023.svg', import.meta.url));

/**
 * Les octets du SVG du logo, lus du disque à chaque appel.
 *
 * @returns {Uint8Array}
 */
export function lireLogo() {
  return new Uint8Array(readFileSync(CHEMIN_LOGO));
}
