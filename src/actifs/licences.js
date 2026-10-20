// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les textes complets des deux licences du logiciel, que le panneau
// « À propos » donne à lire sans réseau (§ 18.6) : les fichiers de
// public/licences/, que la construction copie aussi tels quels dans
// www/licences/, d'où l'exécutable les emporte. chargerTexteLicence les lit
// par un import() différé de textes_licences.js : la construction en fait
// un morceau à part, que la page ne télécharge ni ne précharge au
// lancement.

/** Les licences, dans l'ordre du panneau : leur nom, que porte la commande
 *  qui ouvre leur texte, et leur fichier sous public/licences/. */
export const LICENCES = Object.freeze([
  Object.freeze({ nom: 'agpl', fichier: 'AGPL-3.0-or-later.txt' }),
  Object.freeze({ nom: 'liliq', fichier: 'LiLiQ-Rplus-1.1.txt' }),
]);

/**
 * Le texte complet d'une licence.
 *
 * @param {string} nom  un nom de LICENCES
 * @returns {Promise<string>}
 * @throws {RangeError} (rejet) un nom hors de LICENCES
 */
export async function chargerTexteLicence(nom) {
  if (!LICENCES.some((licence) => licence.nom === nom)) {
    throw new RangeError(`licences : licence inconnue ${JSON.stringify(nom)}`);
  }
  const textes = await import('./textes_licences.js');
  return textes[nom];
}
