// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La police embarquée lue sous node : les épreuves y lisent les fichiers de
// src/polices par le disque, là où la page les reçoit de Vite par « ?inline »
// (src/polices/chargement.js), syntaxe que node ne connaît pas (§ 14.8).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DOSSIER = new URL('../src/polices/', import.meta.url);

/** Les fichiers de la police, par graisse. */
export const FICHIERS_POLICES = Object.freeze({
  regulier: 'NotoSans-Regular.ttf',
  gras: 'NotoSans-Bold.ttf',
});

/** Le chemin absolu d'un fichier de src/polices. */
export const cheminPolice = (nom) => fileURLToPath(new URL(nom, DOSSIER));

/**
 * Les octets des deux graisses, lus du disque à chaque appel.
 *
 * @returns {{regulier: Uint8Array, gras: Uint8Array}}
 */
export function lirePolices() {
  return {
    regulier: new Uint8Array(readFileSync(cheminPolice(FICHIERS_POLICES.regulier))),
    gras: new Uint8Array(readFileSync(cheminPolice(FICHIERS_POLICES.gras))),
  };
}
