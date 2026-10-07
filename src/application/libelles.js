// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'assemblage des textes de l'application (§ 14.6) : chaque code que lèvent
// ou rendent src/stockage, src/csv et src/application — refus, avertissements,
// raisons, causes et remèdes de leurs détails —, chaque libellé figé d'une
// entrée ou d'un jalon du journal, et les textes de la mise en forme ont leur
// texte français dans l'une des tables de libelles/, une par domaine. Ce
// module les réunit par le mécanisme de traduction (traduction.js), dans
// l'ordre alphabétique de leurs fichiers ; aucune table ne l'importe.
//
// Un code sans texte lève : l'écran ne montre jamais un code brut. Une valeur
// codée d'un détail — état, champ, mode, échec — que la table ne connaît pas
// lève aussi, au lieu de se taire.
//
// Un libellé d'entrée se compose une fois, à l'écriture du geste, et le
// journal en garde le texte, jamais le code (§ 8.2) : changer un texte ici ne
// change aucun libellé déjà écrit. libelle compose toujours en français : un
// texte qui devient une donnée — libellé figé, motif du CSV des refus — ne
// passe jamais par la langue témoin.
import { TABLE as CSV } from './libelles/csv.js';
import { TABLE as EVENEMENTS } from './libelles/evenements.js';
import { TABLE as FORMAT } from './libelles/format.js';
import { TABLE as GENERATION } from './libelles/generation.js';
import { TABLE as MOBILIER } from './libelles/mobilier.js';
import { TABLE as MOTEUR } from './libelles/moteur.js';
import { TABLE as PARTICIPANTS } from './libelles/participants.js';
import { TABLE as PLACES } from './libelles/places.js';
import { TABLE as SEANCE } from './libelles/seance.js';
import { TABLE as STOCKAGE } from './libelles/stockage.js';
import { creerTraduction } from './traduction.js';

/** Les tables de libelles/, dans l'ordre alphabétique de leurs fichiers. */
export const TABLES_APPLICATION = Object.freeze([
  CSV,
  EVENEMENTS,
  FORMAT,
  GENERATION,
  MOBILIER,
  MOTEUR,
  PARTICIPANTS,
  PLACES,
  SEANCE,
  STOCKAGE,
]);

const FRANCAIS = creerTraduction(TABLES_APPLICATION);

// Un code : des capitales, des chiffres, des soulignés entre deux mots. Un
// libellé, préfixé du nom de sa table, porte au moins un point.
const FORME_CODE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

/** Les clés de forme code, seules, triées par unités UTF-16 croissantes. */
export const CODES = Object.freeze(FRANCAIS.cles().filter((cle) => FORME_CODE.test(cle)));

/**
 * Le texte français d'une clé et de ses détails (§ 14.6) : un refus, un
 * avertissement, une raison, le libellé figé d'une entrée ou d'un jalon, ou
 * un libellé de l'application.
 *
 * @param {string} cle
 * @param {Object} [details]
 * @returns {string}
 * @throws {RangeError} une clé sans texte, ou une valeur codée de ses détails
 *         — état, champ, mode, échec — que la table ne connaît pas ; jamais
 *         une raison, qu'une phrase générique nomme
 */
export function libelle(cle, details = {}) {
  return FRANCAIS.t(cle, details);
}
