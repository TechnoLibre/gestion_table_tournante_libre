// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le diagnostic de la configuration d'une charge (§ 5.6), pour l'interface,
// qui n'importe pas le moteur (§ 13.4). Le calcul est celui de diagnostiquer,
// sur configurationDe : ce module n'en refait aucun chiffre.
//
// Une charge ouverte peut ne pas se normaliser — une table surréservée, que
// le stockage admet et que le moteur refuse (CONFIGURATION_INCOHERENTE, A2).
// L'ErreurConfiguration se rend alors par son code et ses détails, au lieu
// de lever : le panneau dit le refus, et l'application reste vivante. Toute
// autre erreur est une faute du code et remonte.
import { diagnostiquer } from '../moteur/diagnostic.js';
import { ErreurConfiguration } from '../moteur/erreurs.js';
import { configurationDe } from './configuration.js';

/**
 * Le diagnostic de la configuration de la charge (§ 5.6). Ne modifie pas la
 * charge.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {{diagnostic: import('../moteur/diagnostic.js').Diagnostic|null,
 *            erreur: {code: string, details: Object}|null}}
 *   diagnostic null et erreur, le code et les détails de l'ErreurConfiguration,
 *   quand la configuration ne se normalise pas ; erreur null sinon
 */
export function diagnostiquerCharge(charge) {
  try {
    return { diagnostic: diagnostiquer(configurationDe(charge)), erreur: null };
  } catch (erreur) {
    if (!(erreur instanceof ErreurConfiguration)) throw erreur;
    return { diagnostic: null, erreur: { code: erreur.code, details: erreur.details } };
  }
}
