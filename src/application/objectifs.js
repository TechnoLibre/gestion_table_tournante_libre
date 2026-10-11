// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les étiquettes et les objectifs des tables, côté application (§ 4.5,
// § 5.9) : les avis d'un objectif qui ne servira personne ou qui vise une
// étiquette que personne ne porte, et la réception d'une saisie
// d'étiquettes, que les commandes des personnes et des objectifs partagent.
// La forme et la découpe d'une saisie viennent de src/stockage/etiquettes.js,
// l'orthographe reçue de src/csv/etiquettes.js, la correspondance d'une
// personne à un objectif de correspondA (src/moteur/correspondance.js) : ce
// module n'en porte aucune autre arithmétique. Aucune fonction ne modifie ce
// qu'elle reçoit.
import { orthographeRecue } from '../csv/etiquettes.js';
import { correspondA } from '../moteur/correspondance.js';
import { regleObjectifs } from '../stockage/document.js';
import { lireEtiquettes } from '../stockage/etiquettes.js';
import { refus } from './erreurs.js';

// La règle par défaut des objectifs de l'événement, que le stockage seul lit
// (« ou » quand les réglages n'en portent pas) : l'interface, qui n'importe
// pas le stockage, la lit ici.
export { regleObjectifs };

// Deux chaînes comparées unité UTF-16 par unité : l'ordre où le fichier
// d'état range une liste d'étiquettes (§ 8.9).
const comparerTextes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * L'ordre des objectifs d'une table (§ 8.9), comparateur de sort : la
 * soirée, de tour null, avant les tours, puis les tours croissants. Le
 * fichier d'état, les avis et les bilans le lisent tous ici.
 *
 * @param {{tour: number|null}} a
 * @param {{tour: number|null}} b
 * @returns {number}
 */
export const ordreDesObjectifs = (a, b) => (a.tour ?? 0) - (b.tour ?? 0);

/**
 * Une liste d'étiquettes sous la forme que le fichier d'état écrit : une
 * copie triée par unités de code (§ 8.9).
 *
 * @param {Iterable<string>} etiquettes
 * @returns {string[]}
 */
export const etiquettesRangees = (etiquettes) => [...etiquettes].sort(comparerTextes);

/**
 * Les étiquettes de l'événement entier (§ 4.5) : celles de chaque personne,
 * exclue comprise, dans l'ordre de la charge, puis celles de chaque objectif
 * de table, dans l'ordre des tables de la charge. Une étiquette portée deux
 * fois y est deux fois : la réconciliation ne lit que leur ensemble.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {string[]}
 */
export function etiquettesDeLEvenement(charge) {
  return [
    ...charge.participants.flatMap(({ etiquettes = [] }) => etiquettes),
    ...charge.tables.flatMap(({ objectifs = [] }) => objectifs.flatMap(({ etiquettes }) => etiquettes)),
  ];
}

/**
 * Reçoit une saisie d'étiquettes (§ 4.5, D1) : découpée et mise en forme par
 * lireEtiquettes, chaque étiquette prend l'orthographe que l'événement porte
 * déjà pour sa clé — la plus petite par points de code quand il en porte
 * plusieurs —, et une clé que seule la saisie porte, la plus petite des
 * orthographes saisies : « Montréal, MONTRÉAL » n'en fait qu'une. Rend
 * etiquettes, l'ensemble reçu trié par unités de code, vide pour une saisie
 * de blancs et de séparateurs seuls ; et avertissements, un
 * ORTHOGRAPHE_RETENUE {saisie, retenue} par orthographe saisie que remplace
 * une orthographe de l'événement, dans l'ordre de la saisie. Un doublon
 * interne à la saisie, sur une clé que l'événement ne porte pas, se fond
 * sans avertissement (§ 4.5). Le nombre d'étiquettes ne se borne pas ici :
 * l'appelant le compare à ETIQUETTES_MAX sur la liste qu'il pose.
 *
 * @param {Iterable<string>} existantes  les étiquettes de l'événement,
 *   personnes et objectifs confondus (etiquettesDeLEvenement)
 * @param {string} texte  la saisie
 * @returns {{etiquettes: string[], avertissements: Array<{code: string, details: {saisie: string, retenue: string}}>}}
 * @throws {ErreurCommande} ETIQUETTE_INVALIDE {valeur, raison}, remède null,
 *   pour le premier morceau fautif : raison 'controle' ou 'longueur'
 * @throws {TypeError} une saisie qui n'est pas un texte
 */
export function recevoirEtiquettes(existantes, texte) {
  if (typeof texte !== 'string') throw new TypeError(`etiquettes : texte attendu, reçu ${JSON.stringify(texte) ?? String(texte)}`);
  const { etiquettes: lues, fautes } = lireEtiquettes(texte);
  if (fautes.length > 0) throw refus('ETIQUETTE_INVALIDE', fautes[0]);
  const connues = [...existantes];
  const etiquettes = new Set();
  const avertissements = [];
  for (const saisie of lues) {
    // existante vaut la saisie quand l'événement ne porte pas sa clé, ou
    // quand il la porte sous cette orthographe-là, la plus petite : rien
    // n'est alors à dire. La saisie se fond d'abord en la plus petite des
    // siennes, puis l'existante l'emporte.
    const existante = orthographeRecue(connues, saisie);
    etiquettes.add(orthographeRecue(connues, orthographeRecue(lues, saisie)));
    if (existante !== saisie) avertissements.push({ code: 'ORTHOGRAPHE_RETENUE', details: { saisie, retenue: existante } });
  }
  return { etiquettes: etiquettesRangees(etiquettes), avertissements };
}

// Ce que les avis lisent de la charge : les listes d'étiquettes des
// personnes présentes, que lit la correspondance ; les étiquettes de toutes
// les personnes, exclues comprises, à la suite, que lisent les orphelines
// (A12 : « qu'aucune personne ne porte ») ; et la règle par défaut.
function lectureDesAvis(charge) {
  const presentes = charge.participants.filter(({ exclu }) => !exclu).map(({ etiquettes = [] }) => etiquettes);
  const portees = charge.participants.flatMap(({ etiquettes = [] }) => etiquettes);
  return { presentes, portees, portee: new Set(portees), parDefaut: regleObjectifs(charge) };
}

// Les avis d'un objectif de la table id, sur la lecture donnée : celui de
// la correspondance, puis une étiquette orpheline par étiquette que personne
// ne porte et que taire n'écarte pas, dans l'ordre de sa liste.
function avisDe(lecture, id, { tour, regle, etiquettes }, taire = () => false) {
  const avis = [];
  const visee = { regle: regle ?? lecture.parDefaut, etiquettes };
  if (!lecture.presentes.some((siennes) => correspondA(siennes, visee))) {
    avis.push({ code: 'OBJECTIF_SANS_CORRESPONDANT', details: { table: id, tour } });
  }
  for (const motCle of etiquettes) {
    if (lecture.portee.has(motCle) || taire(motCle)) continue;
    const voisine = orthographeRecue(lecture.portees, motCle);
    avis.push({ code: 'ETIQUETTE_ORPHELINE', details: { etiquette: motCle, voisine: voisine === motCle ? null : voisine } });
  }
  return avis;
}

/**
 * Les avis des objectifs de l'événement (§ 5.9) : acceptés et signalés, ils
 * n'empêchent rien. Pour chaque objectif — les tables par identifiant
 * croissant, puis la soirée et les tours croissants —, d'abord
 * OBJECTIF_SANS_CORRESPONDANT {table, tour} quand aucune personne présente ne
 * lui correspond sous sa règle, la propre ou celle de l'événement
 * (regleObjectifs) ; puis ETIQUETTE_ORPHELINE {etiquette, voisine} pour
 * chacune de ses étiquettes qu'aucune personne ne porte, exclue comprise
 * (A12), dans l'ordre de sa liste, une étiquette se disant à son premier
 * objectif seulement. voisine est l'orthographe de même clé qu'une personne
 * porte, la plus petite par points de code, null quand il n'y en a pas.
 * table est l'identifiant de la table ; tour est null pour l'objectif de la
 * soirée.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {Array<{code: 'OBJECTIF_SANS_CORRESPONDANT'|'ETIQUETTE_ORPHELINE', details: Object}>}
 */
export function avisObjectifs(charge) {
  const lecture = lectureDesAvis(charge);
  const dites = new Set();
  const taire = (motCle) => {
    const deja = dites.has(motCle);
    dites.add(motCle);
    return deja;
  };
  return [...charge.tables]
    .sort((a, b) => a.id - b.id)
    .flatMap(({ id, objectifs = [] }) => [...objectifs].sort(ordreDesObjectifs).flatMap((objectif) => avisDe(lecture, id, objectif, taire)));
}

/**
 * Les avis du seul objectif de la table id au tour donné, null pour la
 * soirée, sous la forme d'avisObjectifs : chacune de ses étiquettes
 * orphelines se dit, même quand un autre objectif la vise aussi. [] quand
 * la table ne porte pas cet objectif.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {number} id
 * @param {number|null} tour
 * @returns {Array<{code: string, details: Object}>}
 */
export function avisDeLObjectif(charge, id, tour) {
  const objectif = charge.tables.find((table) => table.id === id)?.objectifs?.find((candidat) => candidat.tour === tour);
  return objectif === undefined ? [] : avisDe(lectureDesAvis(charge), id, objectif);
}
