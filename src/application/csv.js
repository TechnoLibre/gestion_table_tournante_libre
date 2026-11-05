// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le CSV tel que l'interface l'atteint (§ 13.4) : elle passe par
// l'application, jamais par src/csv. Ce module réexporte les fonctions et
// les constantes de src/csv dont un écran a besoin, telles quelles — la
// jointure des étiquettes comprise, qu'un écran écrit comme l'export, le
// CSV des objectifs de table, son aperçu, son export et ce que remplacer y
// touche, et les noms que « Rendre les noms uniques » donne aux doublons —,
// et lie le motif du CSV des refus au libellé français : l'interface ne
// choisit pas ce motif, qui est une donnée du fichier écrit, jamais un texte
// de la langue témoin. Les deux modèles à télécharger se lisent sur la
// charge de l'événement : celui des participants suit son nombre de tours ;
// celui des objectifs, ses tables et ses tours, et se refuse, avec son
// remède, quand il n'a aucune table ou que chacun de ses numéros de table
// est partagé.
import { modeleParticipants as modeleParticipantsCsv } from '../csv/export.js';
import { exporterRefus as exporterRefusCsv } from '../csv/import.js';
import { modeleObjectifs as modeleObjectifsCsv } from '../csv/objectifs.js';
import { refus } from './erreurs.js';
import { libelle } from './libelles.js';

export { apercevoir } from '../csv/apercu.js';
export { CHAMPS } from '../csv/colonnes.js';
export { decoder } from '../csv/encodage.js';
export { JOINTURE_ETIQUETTES, exporterParticipants } from '../csv/export.js';
export { bilanRemplacement } from '../csv/import.js';
export { rendreNomsUniques } from '../csv/noms_uniques.js';
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
 * Le modèle du CSV des participants de l'événement (modeleParticipants de
 * src/csv), sur son nombre de tours, que suit sa colonne de la présence : il
 * s'importe tel quel sous ce nombre. Il n'écrit rien dans la charge.
 *
 * @param {{evenement: {tours: number}}} charge
 * @returns {Uint8Array}
 */
export function modeleParticipants({ evenement }) {
  return modeleParticipantsCsv({ tours: evenement.tours });
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
