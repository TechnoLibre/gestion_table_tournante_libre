// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le CSV tel que l'interface l'atteint (§ 13.4) : elle passe par
// l'application, jamais par src/csv. Ce module réexporte les fonctions et
// les constantes de src/csv dont un écran a besoin, telles quelles — la
// jointure des étiquettes comprise, qu'un écran écrit comme l'export, et le
// CSV des objectifs de table, son aperçu, son export et ce que remplacer y
// touche, et le modèle des participants à télécharger —, et
// lie le motif du CSV des refus au libellé français : l'interface ne
// choisit pas ce motif, qui est une donnée du fichier écrit, jamais un texte
// de la langue témoin. Le modèle des objectifs se lit sur la charge de
// l'événement, et se refuse, avec son remède, quand il n'a aucune table ou
// que chacun de ses numéros de table est partagé.
import { exporterRefus as exporterRefusCsv } from '../csv/import.js';
import { modeleObjectifs as modeleObjectifsCsv } from '../csv/objectifs.js';
import { refus } from './erreurs.js';
import { libelle } from './libelles.js';

export { apercevoir } from '../csv/apercu.js';
export { CHAMPS } from '../csv/colonnes.js';
export { decoder } from '../csv/encodage.js';
export { JOINTURE_ETIQUETTES, exporterParticipants, modeleParticipants } from '../csv/export.js';
export { bilanRemplacement } from '../csv/import.js';
export { cleNormalisee } from '../csv/normalisation.js';
export { CHAMPS_OBJECTIFS, apercevoirObjectifs, bilanRemplacementObjectifs, exporterObjectifs } from '../csv/objectifs.js';

/**
 * Le CSV des refus d'un aperçu (exporterRefus de src/csv), chaque motif
 * composé par libelle de son code et de ses détails. L'aperçu est celui des
 * participants ou celui des objectifs de table : les deux portent l'en-tête,
 * le séparateur et les lignes refusées telles que découpées.
 *
 * @param {import('../csv/apercu.js').Apercu|import('../csv/objectifs.js').ApercuObjectifs} apercu
 * @param {Array<Object>} [refusees]  par défaut ceux de l'aperçu ; après
 *   l'application, resume.refusees
 * @returns {Uint8Array}
 */
export function exporterRefus(apercu, refusees = apercu.refusees) {
  return exporterRefusCsv(apercu, libelle, refusees);
}

/**
 * Le modèle du CSV des objectifs de l'événement (modeleObjectifs de
 * src/csv), sur ses tables et son nombre de tours. Il n'écrit rien dans la
 * charge.
 *
 * @param {{evenement: {tours: number}, tables: Array<Object>}} charge
 * @returns {Uint8Array}
 * @throws {import('./erreurs.js').ErreurCommande} OBJECTIFS_SANS_TABLE pour
 *   un événement sans table, OBJECTIFS_NUMEROS_PARTAGES pour un événement
 *   dont chaque numéro de table est porté par au moins deux tables : dans
 *   l'un et l'autre, aucune ligne du modèle ne s'importerait. Le remède
 *   ouvre la section des tables, comme celui de l'import
 */
export function modeleObjectifs({ evenement, tables }) {
  const remede = { geste: 'ouvrirSection', section: 'tables' };
  if (tables.length === 0) throw refus('OBJECTIFS_SANS_TABLE', {}, remede);
  const portees = new Map();
  for (const { numero } of tables) portees.set(numero, (portees.get(numero) ?? 0) + 1);
  if (![...portees.values()].includes(1)) throw refus('OBJECTIFS_NUMEROS_PARTAGES', {}, remede);
  return modeleObjectifsCsv(tables, evenement.tours);
}
