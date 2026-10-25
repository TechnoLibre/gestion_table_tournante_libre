// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les textes complets des deux licences du logiciel, et la liste des
// composants tiers avec le texte de la licence de chacun, que le panneau
// « À propos » donne à lire sans réseau (§ 18.6) : les fichiers de
// public/licences/, que la construction copie aussi tels quels dans
// www/licences/, d'où l'exécutable les emporte. chargerTexteLicence et
// chargerComposantsTiers les lisent par un import() différé de
// textes_licences.js : la construction en fait un morceau à part, que la
// page ne télécharge ni ne précharge au lancement. L'analyse de TIERS.txt,
// tiers.js, s'importe de même, avec les textes : rien d'elle n'est lu au
// lancement.

/** Le fichier de la licence de la police, que l'index de TIERS.txt nomme
 *  pour Noto Sans à la place d'une section. */
const TEXTE_DE_LA_POLICE = 'NotoSans-OFL.txt';

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

/**
 * Les composants tiers de public/licences/TIERS.txt, dans l'ordre de son
 * index, chacun avec le texte de sa licence : composantsDesTiers (tiers.js),
 * la police Noto Sans prenant le texte de NotoSans-OFL.txt.
 *
 * @returns {Promise<ReturnType<typeof import('./tiers.js').composantsDesTiers>>}
 */
export async function chargerComposantsTiers() {
  const [{ tiers, police }, { composantsDesTiers }] = await Promise.all([import('./textes_licences.js'), import('./tiers.js')]);
  return composantsDesTiers(tiers, { [TEXTE_DE_LA_POLICE]: police });
}
