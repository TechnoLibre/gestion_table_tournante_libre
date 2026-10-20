// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le modèle d'une pastille, pur : Pastille.svelte le câble. Une pastille est
// un fond teinté, un signe — une icône ou un point — de la marque de sa
// teinte, et un libellé de l'encre de la page (§ 12.7) : la couleur redit le
// libellé, elle ne le remplace jamais.
//
// La teinte nomme une famille de jetons de jetons.css : --couleur-<teinte>-fond
// et --couleur-<teinte>-marque, que SIGNES (marques.js) valide sur chaque
// fond où le signe se pose.
//
//   sorte 'etat'          valeur : un état du plan (§ 9), son icône propre ;
//   sorte 'appartenance'  valeur : un rang de 1 à RANGS_APPARTENANCE, ou null
//                         pour une appartenance au-delà, neutre ; un point ;
//   sorte 'statut'        valeur : un ton, sans signe par défaut.
//
// Une icône donnée remplace le signe par défaut.

import { RANGS_APPARTENANCE } from '../appartenances.js';
import { NOMS_ICONES } from './icones.js';

/** Les sortes de pastille. */
export const SORTES_PASTILLE = Object.freeze(['etat', 'appartenance', 'statut']);

/** Les états du plan, dans l'ordre du § 9, et l'icône de chacun. */
const ICONES_ETAT = new Map([
  ['brouillon', 'crayon'],
  ['propose', 'listePoints'],
  ['retenu', 'coche'],
  ['bloque', 'cadenas'],
]);
export const ETATS_PASTILLE = Object.freeze([...ICONES_ETAT.keys()]);

/** Les tons d'un statut, et la teinte de chacun : le neutre, ceux des
 *  messages, et celui de l'état retenu. */
const TEINTES_TON = new Map([
  ['neutre', 'neutre'],
  ['information', 'information'],
  ['avis', 'avis'],
  ['refus', 'refus'],
  ['retenu', 'etat-retenu'],
]);
export const TONS_PASTILLE = Object.freeze([...TEINTES_TON.keys()]);

const nommer = (valeur) => JSON.stringify(valeur) ?? String(valeur);

/**
 * Le modèle d'une pastille.
 *
 * @param {'etat'|'appartenance'|'statut'} sorte
 * @param {string|number|null} valeur  selon la sorte : un état, un rang ou
 *        null, un ton
 * @param {string|null} [icone]  une icône de NOMS_ICONES, qui remplace le
 *        signe par défaut
 * @returns {{teinte: string, icone: string|null, point: boolean}}  la
 *   famille de jetons, l'icône dessinée ou null, et vrai quand le signe est
 *   un point
 * @throws {RangeError} une sorte, une valeur ou une icône hors contrat
 */
export function modelePastille(sorte, valeur, icone = null) {
  if (icone !== null && !NOMS_ICONES.includes(icone)) throw new RangeError(`pastille : icône inconnue ${nommer(icone)}`);
  let defaut;
  if (sorte === 'etat') {
    if (!ICONES_ETAT.has(valeur)) throw new RangeError(`pastille : état inconnu ${nommer(valeur)}`);
    defaut = { teinte: `etat-${valeur}`, icone: ICONES_ETAT.get(valeur), point: false };
  } else if (sorte === 'appartenance') {
    const rang = valeur === null || (Number.isInteger(valeur) && valeur >= 1 && valeur <= RANGS_APPARTENANCE);
    if (!rang) throw new RangeError(`pastille : rang d'appartenance hors de 1 à ${RANGS_APPARTENANCE}, ou null : ${nommer(valeur)}`);
    defaut = { teinte: valeur === null ? 'neutre' : `appartenance-${valeur}`, icone: null, point: true };
  } else if (sorte === 'statut') {
    if (!TEINTES_TON.has(valeur)) throw new RangeError(`pastille : ton inconnu ${nommer(valeur)}`);
    defaut = { teinte: TEINTES_TON.get(valeur), icone: null, point: false };
  } else {
    throw new RangeError(`pastille : sorte inconnue ${nommer(sorte)}`);
  }
  return icone === null ? defaut : { teinte: defaut.teinte, icone, point: false };
}
