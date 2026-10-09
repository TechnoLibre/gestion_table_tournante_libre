// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les sorties de l'application (§ 11.4, § 11.7, § 11.8, § 18.6) : ce que
// toute sortie — page imprimée, planche de badges, feuille de contrôle — lit
// de la charge pour dire quel placement elle porte. L'horodatage du
// placement, la règle du filigrane BROUILLON et le pied de page n'ont ici
// qu'une implémentation, que l'aperçu et la planche partagent (§ 13.2).
// Chaque fonction lit la charge et rien d'autre : ni horloge, ni disque, ni
// tirage ; deux appels sur la même charge rendent les mêmes valeurs.
//
// Une sortie imprime l'une des trois sources de l'état des places : le
// retenu, une proposition désignée par son identifiant, ou les seules
// réservations quand aucun placement n'est montré.
import { refus } from './erreurs.js';
import { versionVisible } from './version.js';

/**
 * Les sources d'une sortie, celles de l'état des places.
 * @typedef {'retenu'|'proposition'|'reservations'} SourceSortie
 * @type {ReadonlyArray<SourceSortie>}
 */
export const SOURCES_SORTIE = Object.freeze(['retenu', 'proposition', 'reservations']);

// Les états du plan qu'un placement retenu rend définitif (§ 9, § 11.7).
const ETATS_DEFINITIFS = new Set(['retenu', 'bloque']);

// La source, contrôlée : une autre est une faute du code.
function exigerSource(source) {
  if (!SOURCES_SORTIE.includes(source)) {
    throw new TypeError(`source : ${SOURCES_SORTIE.join(', ')} attendue, reçu ${JSON.stringify(source)}`);
  }
}

// Le tour d'une sortie, contrôlé : un entier ≥ 1, ou 'tous' pour la soirée
// entière ; un autre est une faute du code.
function exigerTour(tour) {
  if (tour !== 'tous' && !(Number.isSafeInteger(tour) && tour >= 1)) {
    throw new TypeError(`tour : entier ≥ 1 ou 'tous' attendu, reçu ${JSON.stringify(tour)}`);
  }
}

/**
 * L'horodatage du placement qu'imprime une sortie (§ 11.4, § 11.8) : celui
 * du retenu pour la source retenu ; celui de la proposition d'identifiant
 * proposition pour la source proposition, même quand elle est montrée après
 * la retenue ; null pour les réservations, qui ne sont pas un placement.
 * null aussi quand le placement ne le porte pas — un fichier écrit avant le
 * champ — ou que la charge n'a pas de retenu : l'horodatage est inconnu.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {{source: SourceSortie, proposition?: number|null}} options
 * @returns {string|null}
 * @throws {TypeError} une source inconnue ; pour la source proposition, un
 *         identifiant qui n'est pas un entier
 * @throws {import('./erreurs.js').ErreurCommande} PROPOSITION_INCONNUE {id}
 */
export function horodatagePlacement(charge, { source, proposition = null }) {
  exigerSource(source);
  if (source === 'reservations') return null;
  if (source === 'retenu') return charge.retenu?.horodatage ?? null;
  if (!Number.isSafeInteger(proposition)) {
    throw new TypeError(`proposition : identifiant entier attendu, reçu ${JSON.stringify(proposition)}`);
  }
  const designee = charge.propositions.find(({ id }) => id === proposition);
  if (designee === undefined) throw refus('PROPOSITION_INCONNUE', { id: proposition });
  return designee.horodatage ?? null;
}

/**
 * Vrai quand la sortie porte le filigrane BROUILLON (§ 11.4, § 11.7) : faux
 * seulement quand ce qui s'imprime est le retenu, que le plan est retenu ou
 * bloqué, que la charge porte un retenu, et que le tour imprimé est porté
 * par lui — tour ≤ retenu.tours, ou 'tous' quand le retenu couvre chacun
 * des tours de la soirée, retenu.tours égal à evenement.tours. Une proposition imprimée sur un plan retenu reste
 * un brouillon : l'état seul ne dit pas ce qui s'imprime.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {{source: SourceSortie, tour: number|'tous'}} options
 * @returns {boolean}
 * @throws {TypeError} une source inconnue, un tour qui n'est ni un entier ≥ 1
 *         ni 'tous'
 */
export function estBrouillon(charge, { source, tour }) {
  exigerSource(source);
  exigerTour(tour);
  const { retenu } = charge;
  if (source !== 'retenu' || !ETATS_DEFINITIFS.has(charge.evenement.etat) || retenu === null) return true;
  const porte = tour === 'tous' ? retenu.tours === charge.evenement.tours : tour <= retenu.tours;
  return !porte;
}

/**
 * Le pied de toute page imprimée (§ 11.7, § 18.6) : le nom de l'événement,
 * sa date, le tour imprimé, l'horodatage du placement (horodatagePlacement)
 * et la version visible (versionVisible) — cinq éléments, des données que la
 * vue met en forme. texte compose la marque d'une construction de
 * documentation : t à l'aperçu, libelle sur la feuille de contrôle.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {Object} options
 * @param {SourceSortie} options.source
 * @param {number|null} [options.proposition]   pour la source proposition
 * @param {number|'tous'} options.tour
 * @param {string} options.provenance   le mode de construction de Vite
 * @param {string} options.version      la version affichée
 * @param {(cle: string) => string} options.texte
 * @returns {{nom: string, date: string|null, tour: number|'tous', horodatage: string|null, version: string}}
 * @throws {TypeError} une source ou un tour hors de leur domaine
 * @throws {import('./erreurs.js').ErreurCommande} PROPOSITION_INCONNUE {id}
 */
export function piedDePage(charge, { source, proposition = null, tour, provenance, version, texte }) {
  exigerTour(tour);
  return {
    nom: charge.evenement.nom,
    date: charge.evenement.date,
    tour,
    horodatage: horodatagePlacement(charge, { source, proposition }),
    version: versionVisible(provenance, version, texte),
  };
}
