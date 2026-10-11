// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le modèle des étiquettes de la fiche d'une personne (§ 4.5, § 10.2,
// § 5.9), pur : Fiche.svelte le câble. Les pastilles sont les étiquettes de
// la personne dans l'ordre de la charge ; l'ajout et le retrait passent par
// la seule commande changerEtiquettes, la saisie entière telle que tapée :
// la découpe, la forme, la réconciliation des orthographes et les refus
// sont ceux de la commande (src/application/objectifs.js), jamais refaits
// ici. Le signal d'orthographe est l'avertissement ORTHOGRAPHE_RETENUE que
// l'ajout rend, gardé contre le champ tant que la révision qui l'a produit
// est la courante et la fiche celle de la personne. Aucune fonction ne
// modifie ce qu'elle reçoit.

// La commande des étiquettes d'une personne.
const COMMANDE = 'changerEtiquettes';

// Le code de l'avertissement que la fiche pose contre son champ.
const ORTHOGRAPHE = 'ORTHOGRAPHE_RETENUE';

/**
 * Les pastilles de la fiche : les étiquettes de la personne, dans l'ordre
 * de la charge, en copie ; aucune quand le champ est absent.
 *
 * @param {{etiquettes?: string[]}} participant
 * @returns {string[]}
 */
export const etiquettesDeLaFiche = (participant) => [...(participant.etiquettes ?? [])];

/**
 * L'ajout d'une saisie aux étiquettes de la personne id : la commande et
 * ses arguments, la saisie telle que tapée.
 *
 * @param {number} id
 * @param {string} texte
 * @returns {{nom: string, args: {id: number, ajouter: string}}}
 */
export const ajoutEtiquettes = (id, texte) => ({ nom: COMMANDE, args: { id, ajouter: texte } });

/**
 * Le retrait d'une étiquette de la personne id, nommée par sa chaîne exacte.
 *
 * @param {number} id
 * @param {string} motCle
 * @returns {{nom: string, args: {id: number, retirer: string}}}
 */
export const retraitEtiquette = (id, motCle) => ({ nom: COMMANDE, args: { id, retirer: motCle } });

/**
 * Ce que le champ garde après un ajout abouti : vide quand il porte encore
 * la saisie envoyée, sinon ce qui a été tapé pendant l'écriture.
 *
 * @param {string} envoyee
 * @param {string} courante
 * @returns {string}
 */
export const saisieApresAjout = (envoyee, courante) => (courante === envoyee ? '' : courante);

/**
 * Les signaux d'orthographe que la fiche pose contre son champ : les
 * avertissements ORTHOGRAPHE_RETENUE du dernier ajout abouti, dans leur
 * ordre, quand sa révision est la courante et sa personne celle de la
 * fiche ; aucun sinon.
 *
 * @param {{revision: number, participant: number, avertissements: Array<{code: string, details: Object}>}|null} dernier
 * @param {{revision: number, participant: number}} courant
 * @returns {Array<{code: string, details: {saisie: string, retenue: string}}>}
 */
export function signauxOrthographe(dernier, { revision, participant }) {
  if (dernier === null || dernier.revision !== revision || dernier.participant !== participant) return [];
  return dernier.avertissements.filter(({ code }) => code === ORTHOGRAPHE);
}
