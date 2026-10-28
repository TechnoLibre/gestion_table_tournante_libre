// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les noms des tours de l'événement (§ 4, § 8.9) : la lecture de
// src/stockage/document.js, réexportée telle quelle pour l'application et
// l'interface, qui n'en ont pas d'autre, et le nom par défaut d'un tour,
// que la commande et la lecture de son champ partagent. Les libellés
// reçoivent cette liste sous la clé nomsTours de leurs détails (aides.js).
import { nomDuTour } from './libelles/aides.js';

export { nomsDesTours } from '../stockage/document.js';

/**
 * Vrai quand texte, déjà en NFC et sans blanc de bord, est le nom par
 * défaut du tour, « Tour 3 » : le texte que les libellés écrivent pour un
 * tour sans nom (nomDuTour). Une saisie qui le porte vaut un tour sans nom,
 * comme une saisie vide : deux états de même effet s'écrivent pareil.
 *
 * @param {number} tour
 * @param {string} texte
 * @returns {boolean}
 */
export const estNomParDefaut = (tour, texte) => texte === nomDuTour(tour);
