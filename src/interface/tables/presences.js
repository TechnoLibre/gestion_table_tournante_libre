// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le modèle du tableau « Personnes présentes par tour » (§ 6.1), pur :
// PresencesParTour.svelte le câble. Il recopie capaciteParTour
// (src/application/bilans.js) et n'y ajoute que le ton de chaque ligne :
// aucun compte ni aucune soustraction ne se fait ici. Il ne modifie pas la
// charge.
import { capaciteParTour } from '../../application/bilans.js';
import { aDesAbsences } from '../../application/places.js';

/**
 * Les lignes du tableau, une par tour de 1 à R, ou null quand aucune
 * personne non exclue ne manque un tour (aDesAbsences) : sans absence, le
 * tableau ne se montre pas. Chaque ligne recopie celle de capaciteParTour,
 * et son ton vaut 'avis' quand le manque est positif, 'neutre' sinon.
 *
 * @param {Object} charge   la charge de l'événement
 * @returns {Array<{tour: number, presentes: number, places: number, manque: number, ton: 'avis'|'neutre'}>|null}
 */
export function lignesPresences(charge) {
  if (!aDesAbsences(charge)) return null;
  return capaciteParTour(charge).map((ligne) => ({ ...ligne, ton: ligne.manque > 0 ? 'avis' : 'neutre' }));
}
