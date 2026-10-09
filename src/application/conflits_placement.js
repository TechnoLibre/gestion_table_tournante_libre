// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les conflits du placement montré (§ 7.5), conflit par conflit, pour une
// lecture hors du plan : la liste des participants les range sous ses
// groupes. Ils se lisent dans etatPlaces (places.js), tour par tour, avec la
// même demande que le plan — la proposition demandée, sinon le retenu — :
// même source, mêmes conflits de conflitsParTable, donc à chaque table
// autant de conflits que sa pastille en compte. Rien ne se recalcule ici
// que les rencontres antérieures d'un conflit, lues dans les occupants des
// tours précédents de la même source que son tour : une proposition plus
// courte que R cède ses derniers tours au retenu, et l'histoire d'un conflit
// lu dans le retenu se relit alors dans le retenu, non dans la proposition.

import { etatPlaces } from './places.js';

/**
 * @typedef {Object} ConflitPlacement
 * @property {number} tour
 * @property {number} table     identifiant
 * @property {number} numero    numéro affiché de la table
 * @property {'separerAppartenances'|'nouveauxVoisins'|'nouvelleTable'} regle
 * @property {number[]} personnes   la paire, croissante, ou la personne revenue
 * @property {Array<{tour: number, numero: number}>} deja
 *           les tours antérieurs où la paire était réunie à une même table
 *           (nouveauxVoisins) ou où la personne était à cette table
 *           (nouvelleTable), dans l'ordre des tours ; vide pour
 *           separerAppartenances
 */

/**
 * Les conflits du placement que le plan montre : à chaque tour dont la
 * source, celle d'etatPlaces(charge, {tour, proposition}), est la
 * proposition demandée ou le retenu, et dont les conflits s'évaluent, une
 * entrée par violation d'une règle active — par paire pour séparer les
 * appartenances et nouveaux voisins, par personne pour nouvelle table —,
 * dans l'ordre des tours, puis des tables de la charge, puis des règles et
 * des paires de conflitsParTable. Un tour dont la source n'est que les
 * réservations n'en rend aucun.
 *
 * Rend null quand aucun tour ne se lit dans une proposition ou un retenu
 * évalué : ni proposition demandée ni retenu, ou une source en dérive, que
 * le plan ne signale pas non plus. Ne modifie pas la charge.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {{proposition?: number|null}} demande   la proposition demandée au plan
 * @param {{etatPlaces?: typeof etatPlaces}} [lecture]  la lecture d'un tour,
 *        etatPlaces par défaut ; une épreuve y compte les lectures
 * @returns {ConflitPlacement[]|null}
 */
export function conflitsDuPlacement(charge, { proposition = null } = {}, { etatPlaces: lire = etatPlaces } = {}) {
  const conflits = [];
  // Chaque tour déjà lu : sa source, sa proposition, et la table de chaque
  // personne assise, {id, numero}.
  const lus = [];
  // Les tours relus dans une autre source que la leur, par proposition de
  // la source (null pour le retenu) puis par rang : chacun ne se relit
  // qu'une fois.
  const relus = new Map();
  let lu = false;
  for (let tour = 1; tour <= charge.evenement.tours; tour += 1) {
    const etat = lire(charge, { tour, proposition });
    if (etat.source !== 'reservations' && etat.evalue) {
      lu = true;
      const tablesParTour = historique(etat, lus, (rang) => {
        if (!relus.has(etat.proposition)) relus.set(etat.proposition, new Map());
        const deLaSource = relus.get(etat.proposition);
        if (!deLaSource.has(rang)) deLaSource.set(rang, tablesDe(lire(charge, { tour: rang + 1, proposition: etat.proposition })));
        return deLaSource.get(rang);
      });
      for (const { id: table, numero, conflits: deTable } of etat.tables) {
        for (const regle of deTable?.regles ?? []) {
          for (const personnes of regle.paires ?? regle.personnes.map((p) => [p])) {
            conflits.push({
              tour,
              table,
              numero,
              regle: regle.regle,
              personnes: [...personnes],
              deja: rencontresAnterieures(regle.regle, personnes, table, tablesParTour),
            });
          }
        }
      }
    }
    lus.push({ source: etat.source, proposition: etat.proposition, tableDe: tablesDe(etat) });
  }
  return lu ? conflits : null;
}

// La table de chaque personne assise d'un EtatPlaces, Map id → {id, numero}.
function tablesDe(etat) {
  const tableDe = new Map();
  for (const { id, numero, chaises } of etat.tables) {
    for (const { occupant } of chaises) if (occupant !== null) tableDe.set(occupant, { id, numero });
  }
  return tableDe;
}

// La table de chaque personne aux tours qui précèdent celui d'etat, lus dans
// la source d'etat : un tour lu dans une autre source se relit par relire(rang),
// la lecture du tour avec la proposition d'etat, null pour le retenu, que
// l'appelant garde. La source d'etat porte son tour, donc tous ceux qui le
// précèdent, et la relecture rend la même source.
function historique(etat, lus, relire) {
  return lus.map(({ source, proposition, tableDe }, rang) =>
    source === etat.source && proposition === etat.proposition ? tableDe : relire(rang),
  );
}

// Les tours antérieurs, dans leur ordre, où les deux personnes d'une paire
// revue étaient à une même table, ou où la personne revenue était à la
// table d'identifiant table, chacun avec le numéro affiché de cette table ;
// aucun pour une paire de même appartenance.
function rencontresAnterieures(regle, personnes, table, tablesParTour) {
  const deja = [];
  if (regle === 'separerAppartenances') return deja;
  tablesParTour.forEach((tableDe, rang) => {
    const premiere = tableDe.get(personnes[0]);
    if (premiere === undefined) return;
    const reunis = regle === 'nouvelleTable' ? premiere.id === table : premiere.id === tableDe.get(personnes[1])?.id;
    if (reunis) deja.push({ tour: rang + 1, numero: premiere.numero });
  });
  return deja;
}
