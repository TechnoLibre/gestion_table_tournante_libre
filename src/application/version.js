// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La version visible (§ 18.6, § 19.4) : ce qui tient lieu de version au
// bandeau, au premier écran, au pied des pages imprimées et sur la feuille
// de contrôle des badges, et la provenance de la construction. La règle vit
// dans l'application, que le papier lit comme l'écran ; src/interface/
// apropos.js la réexporte. texte compose une clé : t à l'écran, libelle
// (français, jamais décoré) sur le papier.

/**
 * Ce qui tient lieu de version : la marque de provenance dans une
 * construction de documentation, dont les captures ne changent pas d'une
 * livraison à l'autre (§ 19.4) ; la version affichée sinon.
 *
 * @param {string} provenance   le mode de construction de Vite
 * @param {string} version      la version affichée
 * @param {(cle: string) => string} texte
 * @returns {string}
 */
export function versionVisible(provenance, version, texte) {
  return provenance === 'documentation' ? texte('sorties.version.documentation') : version;
}

/**
 * La provenance à l'écran : le libellé du mode, clé
 * coquille.provenance.<mode>, par la traduction reçue ; le mode lui-même
 * quand elle n'a pas cette clé — celui d'un « vite build » lancé sans
 * --mode —, qui s'affiche alors comme une donnée, sans la marque de la
 * langue témoin. Une traduction lève RangeError sur une clé qu'elle n'a pas,
 * avant de rien encadrer : c'est ce refus qui dit le mode sans libellé.
 *
 * @param {string} provenance   le mode de construction de Vite
 * @param {(cle: string) => string} texte
 * @returns {string}
 */
export function provenanceVisible(provenance, texte) {
  try {
    return texte(`coquille.provenance.${provenance}`);
  } catch (erreur) {
    if (erreur instanceof RangeError) return provenance;
    throw erreur;
  }
}
