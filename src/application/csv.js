// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le CSV tel que l'interface l'atteint (§ 13.4) : elle passe par
// l'application, jamais par src/csv. Ce module réexporte les fonctions et
// les constantes de src/csv dont un écran a besoin, telles quelles — la
// jointure des étiquettes comprise, qu'un écran écrit comme l'export —, et
// lie le motif du CSV des refus au libellé français : l'interface ne
// choisit pas ce motif, qui est une donnée du fichier écrit, jamais un texte
// de la langue témoin.
import { exporterRefus as exporterRefusCsv } from '../csv/import.js';
import { libelle } from './libelles.js';

export { apercevoir } from '../csv/apercu.js';
export { CHAMPS } from '../csv/colonnes.js';
export { decoder } from '../csv/encodage.js';
export { JOINTURE_ETIQUETTES, exporterParticipants } from '../csv/export.js';
export { bilanRemplacement } from '../csv/import.js';
export { cleNormalisee } from '../csv/normalisation.js';

/**
 * Le CSV des refus d'un aperçu (exporterRefus de src/csv), chaque motif
 * composé par libelle de son code et de ses détails.
 *
 * @param {import('../csv/apercu.js').Apercu} apercu
 * @param {Array<Object>} [refusees]  par défaut ceux de l'aperçu ; après
 *   l'application, resume.refusees
 * @returns {Uint8Array}
 */
export function exporterRefus(apercu, refusees = apercu.refusees) {
  return exporterRefusCsv(apercu, libelle, refusees);
}
