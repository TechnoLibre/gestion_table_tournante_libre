// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Ce que le bandeau dit de l'événement ouvert, en clés de la table de la
// coquille : le libellé de mode (§ 8.4, § 8.5), calculé ici une fois pour le
// bandeau, la bande de mode et la barre de l'événement, et l'annonce de la version de format du
// fichier (§ 18.6). Les deux se lisent dans l'état observable de la séance.

// La clé de chaque annonce de format de la séance.
const ANNONCES = new Map([
  ['plusRecent', 'coquille.format.plusRecent'],
  ['plusAncien', 'coquille.format.plusAncien'],
]);

/**
 * La clé du libellé de mode : null sans événement ; 'coquille.mode.bloque'
 * pour un plan bloqué, que la séance tient en lecture ;
 * 'coquille.mode.lecture' ou 'coquille.mode.ecriture' sinon, le mode de la
 * séance.
 *
 * @param {{mode: 'lecture'|'ecriture', evenement: null|{etat: string}}} etatSeance
 * @returns {null|'coquille.mode.lecture'|'coquille.mode.ecriture'|'coquille.mode.bloque'}
 */
export function cleDeMode(etatSeance) {
  if (etatSeance.evenement === null) return null;
  if (etatSeance.evenement.etat === 'bloque') return 'coquille.mode.bloque';
  return etatSeance.mode === 'ecriture' ? 'coquille.mode.ecriture' : 'coquille.mode.lecture';
}

/**
 * La clé de l'annonce de format du bandeau : null sans événement ou quand le
 * fichier est au format courant ; sinon celle de l'annonce de la séance,
 * plus récent ou plus ancien.
 *
 * @param {{evenement: null|{annonceFormat: null|'plusRecent'|'plusAncien'}}} etatSeance
 * @returns {null|'coquille.format.plusRecent'|'coquille.format.plusAncien'}
 * @throws {RangeError} une annonce que la séance ne rend pas
 */
export function cleAnnonceFormat(etatSeance) {
  const annonce = etatSeance.evenement?.annonceFormat ?? null;
  if (annonce === null) return null;
  const cle = ANNONCES.get(annonce);
  if (cle === undefined) throw new RangeError(`annonce de format inconnue : ${JSON.stringify(annonce)}`);
  return cle;
}
