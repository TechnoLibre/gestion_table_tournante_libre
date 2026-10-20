// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le modèle des objectifs de table à l'écran (§ 4.5, § 5.9, § 10.4, D3),
// pur : ListeTables et RegleObjectifs le câblent. Il lit la charge et rend,
// pour chaque objectif d'une table — la soirée, puis chaque tour —, ce que
// l'écran montre : ses étiquettes en texte, jointes comme l'export les
// joint, sa règle, l'état « suit le défaut » ou « règle propre », et ses
// avis, ceux d'avisDeLObjectif (src/application/objectifs.js), qui décide
// seul de la correspondance. Il rend des clés de libellé et leurs détails,
// jamais un texte. Aucune fonction ne modifie ce qu'elle reçoit.
import { JOINTURE_ETIQUETTES } from '../../application/csv.js';
import { avisDeLObjectif, etiquettesDeLEvenement, regleObjectifs } from '../../application/objectifs.js';

// Deux chaînes comparées unité UTF-16 par unité.
const comparerTextes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * La règle par défaut des objectifs de l'événement (§ 4.5, D3) : celle des
 * réglages, « ou » quand ils n'en portent pas. C'est regleObjectifs, la
 * seule lecture de ce défaut, que les commandes et les avis lisent aussi.
 *
 * @param {{reglages: {regleObjectifs?: 'et'}}} charge
 * @returns {'ou'|'et'}
 */
export const regleParDefaut = regleObjectifs;

/** Les deux règles que le défaut de l'événement peut prendre, chacune sa clé de libellé. */
export const OPTIONS_REGLE_PAR_DEFAUT = Object.freeze([
  Object.freeze({ valeur: 'ou', cle: 'tables.regle.ou' }),
  Object.freeze({ valeur: 'et', cle: 'tables.regle.et' }),
]);

/**
 * Les choix de la règle d'un objectif (§ 4.5) : la valeur vide, qui suit le
 * défaut de l'événement et le nomme, puis « au moins une (OU) » et
 * « toutes (ET) », deux règles propres. Un choix est {valeur, cle, details}.
 *
 * @param {'ou'|'et'} regle   la règle par défaut de l'événement
 * @returns {Array<{valeur: ''|'ou'|'et', cle: string, details: Object}>}
 */
export function optionsRegle(regle) {
  return [
    { valeur: '', cle: 'tables.objectif.regleDefaut', details: { regle } },
    ...OPTIONS_REGLE_PAR_DEFAUT.map(({ valeur, cle }) => ({ valeur, cle, details: {} })),
  ];
}

/**
 * La règle que poserObjectif reçoit pour un choix : null pour la valeur
 * vide, qui suit le défaut, la règle propre sinon.
 *
 * @param {string} valeur
 * @returns {'ou'|'et'|null}
 * @throws {RangeError} une valeur hors des choix d'optionsRegle
 */
export function regleChoisie(valeur) {
  if (valeur === '') return null;
  if (valeur === 'ou' || valeur === 'et') return valeur;
  throw new RangeError(`règle inconnue : ${JSON.stringify(valeur)}`);
}

/**
 * La clé d'un objectif à l'écran : l'identifiant de sa table pour la soirée,
 * ‹table›-‹tour› pour un tour désigné. Elle nomme son champ, son choix de
 * règle et sa désignation data-objectif.
 *
 * @param {number} table
 * @param {number|null} tour
 * @returns {string}
 */
export const cleObjectif = (table, tour) => (tour === null ? String(table) : `${table}-${tour}`);

/**
 * Ce que l'écran montre de l'objectif de la table au tour donné, null pour
 * la soirée. existe dit si la table le porte ; texte, ses étiquettes dans
 * l'ordre du fichier, jointes par JOINTURE_ETIQUETTES, vide sans objectif ;
 * regle, la valeur de son choix de règle — '' quand il suit le défaut ou
 * n'existe pas ; etat, la clé et le ton de « suit le défaut » ou « règle
 * propre » (D3), null sans objectif : une règle propre égale au défaut
 * garde son état propre ; avis, ceux d'avisDeLObjectif.
 *
 * @param {Object} charge
 * @param {{id: number, objectifs?: Array<{tour: number|null, regle: 'ou'|'et'|null, etiquettes: string[]}>}} table
 * @param {number|null} tour
 * @returns {{cle: string, tour: number|null, existe: boolean, texte: string,
 *            regle: ''|'ou'|'et', etat: {cle: string, ton: 'neutre'|'information'}|null,
 *            avis: Array<{code: string, details: Object}>}}
 */
export function vueObjectif(charge, table, tour) {
  const objectif = (table.objectifs ?? []).find((candidat) => candidat.tour === tour);
  const base = { cle: cleObjectif(table.id, tour), tour };
  if (objectif === undefined) return { ...base, existe: false, texte: '', regle: '', etat: null, avis: [] };
  const propre = objectif.regle !== null;
  return {
    ...base,
    existe: true,
    texte: objectif.etiquettes.join(JOINTURE_ETIQUETTES),
    regle: objectif.regle ?? '',
    etat: propre
      ? { cle: 'tables.objectif.reglePropre', ton: 'information' }
      : { cle: 'tables.objectif.suitDefaut', ton: 'neutre' },
    avis: avisDeLObjectif(charge, table.id, tour),
  };
}

/**
 * Les objectifs d'une table à l'écran : celui de la soirée, puis un par tour
 * de 1 à R, chacun par vueObjectif ; parTour, le nombre de tours qui en
 * portent un, que dit le bouton qui déplie leur liste.
 *
 * @param {Object} charge
 * @param {Object} table
 * @returns {{soiree: ReturnType<typeof vueObjectif>, tours: Array<ReturnType<typeof vueObjectif>>, parTour: number}}
 */
export function objectifsDeLaTable(charge, table) {
  const tours = Array.from({ length: charge.evenement.tours }, (_, rang) => vueObjectif(charge, table, rang + 1));
  return {
    soiree: vueObjectif(charge, table, null),
    tours,
    parTour: tours.filter(({ existe }) => existe).length,
  };
}

/**
 * Les étiquettes que la saisie d'un objectif propose (§ 4.5) : celles de
 * l'événement, personnes et objectifs confondus, chacune une fois, triées
 * par unités de code.
 *
 * @param {Object} charge
 * @returns {string[]}
 */
export const etiquettesConnues = (charge) => [...new Set(etiquettesDeLEvenement(charge))].sort(comparerTextes);

/**
 * Le nom proposé à l'enregistrement de l'export des objectifs (§ 10.4) :
 * ‹base›-objectifs.csv, sur le patron de celui des participants.
 *
 * @param {string} base
 * @returns {string}
 */
export const nomExportObjectifs = (base) => `${base}-objectifs.csv`;

/**
 * Les tables dont les objectifs par tour sont dépliés, après un clic sur
 * celui de la table id : elle s'y ajoute, ou s'en retire. Un ensemble neuf.
 *
 * @param {Set<number>} ouvertes
 * @param {number} id
 * @returns {Set<number>}
 */
export function basculerTable(ouvertes, id) {
  const suivantes = new Set(ouvertes);
  if (suivantes.has(id)) suivantes.delete(id);
  else suivantes.add(id);
  return suivantes;
}
