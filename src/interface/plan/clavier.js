// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La navigation au clavier du plan (§ 7.3, § 13.5), pure : le plan est un
// seul arrêt de tabulation, et l'élément actif — une table, ou un siège
// d'une table, {table, siege|null} — se déplace par les flèches, selon la
// position des tables sur le plan ; l'entrée descend dans les sièges,
// l'échappement remonte. Aucune fonction ne lit le DOM : Plan.svelte
// applique l'élément actif rendu et l'effet qui l'accompagne. Les touches
// se lisent dans la table des raccourcis, contexte 'plan' : ce module n'en
// nomme aucune.
import { ecranDepuisDessin } from '../../geometrie/vue.js';
import { effetDe } from '../raccourcis.js';

/** Les directions des flèches, sur l'écran (y vers le bas). */
const VECTEURS = new Map([
  ['droite', { x: 1, y: 0 }],
  ['gauche', { x: -1, y: 0 }],
  ['haut', { x: 0, y: -1 }],
  ['bas', { x: 0, y: 1 }],
]);

/**
 * Chaque effet de flèche de la table des raccourcis : la direction où il
 * mène sur le plan, et le sens où il fait tourner les sièges.
 */
const FLECHES = new Map([
  ['droite', { direction: 'droite', sens: 1 }],
  ['bas', { direction: 'bas', sens: 1 }],
  ['gauche', { direction: 'gauche', sens: -1 }],
  ['haut', { direction: 'haut', sens: -1 }],
]);

/**
 * La table voisine dans la direction d'une flèche : la plus proche, par la
 * distance des centres, de celles dont le centre est dans le cône de ±45°
 * autour de la direction — bords compris ; à égalité de distance, le plus
 * petit numéro ; aucune → la même.
 *
 * @param {Array<{id: number, numero: number, centre: {x: number, y: number}}>} geometries
 * @param {number} depuis   identifiant de la table de départ
 * @param {'droite'|'gauche'|'haut'|'bas'} direction
 * @returns {number}   identifiant
 */
export function tableVoisine(geometries, depuis, direction) {
  const vecteur = VECTEURS.get(direction);
  if (vecteur === undefined) throw new RangeError(`direction inconnue : ${JSON.stringify(direction)}`);
  const origine = geometries.find(({ id }) => id === depuis);
  if (origine === undefined) return depuis;
  let meilleure = null;
  for (const candidate of geometries) {
    if (candidate.id === depuis) continue;
    const dx = candidate.centre.x - origine.centre.x;
    const dy = candidate.centre.y - origine.centre.y;
    // Composante le long de la direction et composante transverse : le cône
    // de ±45° est l'ensemble où la première est positive et au moins égale
    // à la valeur absolue de la seconde.
    const long = dx * vecteur.x + dy * vecteur.y;
    const travers = Math.abs(dx * vecteur.y - dy * vecteur.x);
    if (long <= 0 || long < travers) continue;
    const distance = dx * dx + dy * dy;
    if (
      meilleure === null ||
      distance < meilleure.distance ||
      (distance === meilleure.distance && candidate.numero < meilleure.numero)
    ) {
      meilleure = { id: candidate.id, numero: candidate.numero, distance };
    }
  }
  return meilleure === null ? depuis : meilleure.id;
}

/**
 * Le siège suivant (sens +1) ou précédent (sens −1), dans l'ordre des
 * numéros de 1 à capacite, circulairement.
 *
 * @param {number} capacite  @param {number} siege  @param {1|-1} sens
 * @returns {number}
 */
export function siegeVoisin(capacite, siege, sens) {
  return ((((siege - 1 + sens) % capacite) + capacite) % capacite) + 1;
}

/**
 * Ce que fait une touche sur l'élément actif du plan (§ 7.3).
 *
 * Sans élément actif, ou quand sa table n'existe plus, une flèche ou
 * l'entrée active la première table des géométries. Sur une table, une
 * flèche mène à tableVoisine ; l'entrée — Enter ou l'espace — descend au
 * siège 1 en régime sièges, et en régime table, où aucune chaise n'est
 * dessinée, rend l'effet ouvrirTable : le siège se choisit dans le panneau
 * de la table. Sur un siège, les flèches droite et bas mènent au suivant,
 * gauche et haut au précédent ; l'entrée rend l'effet selectionner de la
 * place. L'échappement remonte du siège à sa table, puis, sur une table,
 * rend l'effet remonter : le choix en attente et la sélection s'oublient.
 * Un siège d'une table passée en régime table se lit comme sa table. Les
 * flèches, l'entrée et l'échappement sont les touches des effets droite,
 * bas, gauche, haut, entrer et remonter du contexte 'plan' de RACCOURCIS.
 *
 * @param {{table: number, siege: number|null}|null} actif
 * @param {string} cle   KeyboardEvent.key
 * @param {{geometries: Array<{id: number, numero: number, centre: Object}>,
 *          regimeDe: (id: number) => 'sieges'|'table',
 *          capaciteDe: (id: number) => number}} contexte
 * @returns {null|{actif: {table: number, siege: number|null},
 *   effet: null|{type: 'ouvrirTable', table: number}|{type: 'selectionner', place: Object}|{type: 'remonter'}}}
 *   null pour une touche que le plan ne prend pas, ou sans table
 */
export function toucheDuPlan(actif, cle, { geometries, regimeDe, capaciteDe }) {
  const effet = effetDe('plan', cle);
  const fleche = effet === null ? undefined : FLECHES.get(effet);
  const entree = effet === 'entrer';
  const echap = effet === 'remonter';
  if (fleche === undefined && !entree && !echap) return null;
  if (geometries.length === 0) return null;

  const existe = actif !== null && geometries.some(({ id }) => id === actif.table);
  if (!existe) {
    if (echap) return null;
    return { actif: { table: geometries[0].id, siege: null }, effet: null };
  }
  const { table } = actif;
  const siege = actif.siege !== null && regimeDe(table) === 'sieges' ? actif.siege : null;

  if (siege === null) {
    if (fleche !== undefined) return { actif: { table: tableVoisine(geometries, table, fleche.direction), siege: null }, effet: null };
    if (echap) return { actif: { table, siege: null }, effet: { type: 'remonter' } };
    if (regimeDe(table) === 'sieges') return { actif: { table, siege: 1 }, effet: null };
    return { actif: { table, siege: null }, effet: { type: 'ouvrirTable', table } };
  }
  if (fleche !== undefined) return { actif: { table, siege: siegeVoisin(capaciteDe(table), siege, fleche.sens) }, effet: null };
  if (echap) return { actif: { table, siege: null }, effet: null };
  return { actif: { table, siege }, effet: { type: 'selectionner', place: { table, siege } } };
}

/** Marge qui garde une place à l'intérieur du cadre, en px d'écran. */
export const MARGE_MONTRER_PX = 24;

/**
 * La vue qui amène un point du dessin dans le cadre, k inchangé : la même
 * vue quand le point y est déjà, à MARGE_MONTRER_PX du bord au moins ; sinon
 * la vue translatée qui pose le point au centre du cadre. Sans vue, ou dans
 * un cadre trop petit pour sa marge, la vue reçue.
 *
 * @param {{k: number, tx: number, ty: number}|null} vue
 * @param {{gauche: number, haut: number, largeur: number, hauteur: number}} cadre
 * @param {{x: number, y: number}} point   cm
 * @returns {{k: number, tx: number, ty: number}|null}
 */
export function vueQuiMontre(vue, cadre, point) {
  if (vue === null || cadre.largeur <= 2 * MARGE_MONTRER_PX || cadre.hauteur <= 2 * MARGE_MONTRER_PX) return vue;
  const ecran = ecranDepuisDessin(vue, cadre, point.x, point.y);
  const x = ecran.x - cadre.gauche;
  const y = ecran.y - cadre.haut;
  const dedans =
    x >= MARGE_MONTRER_PX && x <= cadre.largeur - MARGE_MONTRER_PX && y >= MARGE_MONTRER_PX && y <= cadre.hauteur - MARGE_MONTRER_PX;
  if (dedans) return vue;
  return { k: vue.k, tx: cadre.largeur / 2 - point.x * vue.k, ty: cadre.hauteur / 2 - point.y * vue.k };
}
