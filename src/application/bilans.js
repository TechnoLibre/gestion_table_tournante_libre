// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les bilans du mobilier (§ 6.1, § 6.2, § 2.1 étape 5) : ce qu'un changement
// de défaut, de tours ou la suppression d'une table emporterait, compté sur
// la charge courante sans rien écrire, pour l'énoncer avant d'appliquer. La
// commande qui applique lit le même bilan : changerDefaut lève le premier de
// ses refus. Les refus et avertissements d'une capacité sont ceux de
// controlerCapacites (capacite.js), le seul contrôle. Aucune fonction ne
// modifie ce qu'elle reçoit.
import { ordreDesReservations } from '../csv/import.js';
import { capacite } from '../stockage/document.js';
import { controlerCapacites } from './capacite.js';
import { presents } from './places.js';

const croissant = (a, b) => a - b;
const comparerTextes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const parNumero = (a, b) => a.numero - b.numero || a.id - b.id;

// Un nombre entier attendu ; sa lecture depuis une saisie appartient à
// lireEntier.
function exigerEntier(valeur, nom) {
  if (!Number.isSafeInteger(valeur)) throw new TypeError(`${nom} : entier attendu, reçu ${JSON.stringify(valeur)}`);
}

// L'enregistrement de la table d'identifiant id, ou TypeError.
function tableDe(charge, id) {
  const table = charge.tables.find((candidate) => candidate.id === id);
  if (table === undefined) throw new TypeError(`table inconnue : ${JSON.stringify(id)}`);
  return table;
}

// Les identifiants croissants des placements de la liste qui satisfont
// touche ; un placement fautif, de forme quelconque, se lit sans lever.
const identifiants = (placements, touche) =>
  placements.filter((placement) => touche(placement)).map(({ id }) => id).sort(croissant);

/**
 * Le changement du défaut à sieges places (§ 6.1), énoncé avant d'être
 * appliqué : suivent, le nombre de tables qui suivent le défaut ; avant et
 * apres, le défaut d'aujourd'hui et sieges ; surchargees, les capacités des
 * tables surchargées par numéro de table ; totalAvant et totalApres, la
 * somme des capacités avant et après ; participants, les personnes non
 * exclues. realigner : les surchargées passent aussi à sieges.
 *
 * Chaque table dont la capacité change se contrôle comme une saisie au champ
 * (§ 6.2) : refus, le premier de chaque table qui refuse, {table, code,
 * details}, par ordre de charge.tables ; avertissements, de même, ceux des
 * autres — SURNUMERAIRES, AU_DELA_LISIBLE. Moins de 2 places refusent pour
 * l'événement entier : un seul refus, MOINS_DE_DEUX, table null.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {number} sieges
 * @param {{realigner?: boolean}} [options]
 * @returns {{suivent: number, avant: number, apres: number, surchargees: number[], totalAvant: number,
 *            totalApres: number, participants: number, refus: Array<{table: number|null, code: string, details: Object}>,
 *            avertissements: Array<{table: number, code: string, details: Object}>}}
 * @throws {TypeError} sieges qui n'est pas un entier
 */
export function bilanChangementDefaut(charge, sieges, { realigner = false } = {}) {
  exigerEntier(sieges, 'sieges');
  const apresDe = (table) => (table.sieges === null || realigner ? sieges : table.sieges);
  const somme = (valeurs) => valeurs.reduce((total, valeur) => total + valeur, 0);
  const changements = new Map(
    charge.tables.filter((table) => apresDe(table) !== capacite(charge, table)).map((table) => [table.id, apresDe(table)]),
  );
  const controle =
    sieges < 2
      ? { refus: [{ table: null, code: 'MOINS_DE_DEUX', details: { remede: null } }], avertissements: [] }
      : controlerCapacites(charge, changements, { origine: 'champ' });
  return {
    suivent: charge.tables.filter((table) => table.sieges === null).length,
    avant: charge.evenement.siegesParDefaut,
    apres: sieges,
    surchargees: charge.tables
      .filter((table) => table.sieges !== null)
      .sort(parNumero)
      .map((table) => table.sieges),
    totalAvant: somme(charge.tables.map((table) => capacite(charge, table))),
    totalApres: somme(charge.tables.map(apresDe)),
    participants: presents(charge).size,
    refus: controle.refus,
    avertissements: controle.avertissements,
  };
}

/**
 * Le changement du nombre de tours à tours (§ 2.1 étape 5, § 4.3) :
 * reservationsDetruites, les réservations « tour désigné » au-delà, dans
 * l'ordre canonique ; propositionsTouchees, les identifiants croissants des
 * propositions qui ne porteront pas tours tours, et retenuTouche de même
 * pour le retenu — ils restent, en dérive TOURS_CHANGES (§ 9). Le nombre de
 * tours d'aujourd'hui ne touche rien. La portée « tous » ne se détruit
 * jamais : elle n'énumère aucun tour.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {number} tours
 * @returns {{reservationsDetruites: Array<{participant: number, table: number, tour: number}>,
 *            propositionsTouchees: number[], retenuTouche: boolean}}
 * @throws {TypeError} tours qui n'est pas un entier
 */
export function bilanTours(charge, tours) {
  exigerEntier(tours, 'tours');
  const change = tours !== charge.evenement.tours;
  const touche = (placement) => change && placement?.tours !== tours;
  return {
    reservationsDetruites: charge.reservations
      .filter(({ portee, tour }) => portee === 'tour' && tour > tours)
      .sort(ordreDesReservations)
      .map(({ participant, table, tour }) => ({ participant, table, tour })),
    propositionsTouchees: identifiants(charge.propositions, touche),
    retenuTouche: charge.retenu !== null && touche(charge.retenu),
  };
}

/**
 * La suppression de la table id (§ 6.2, § 4) : ses réservations, suspendues
 * comprises, dans l'ordre canonique, et ses titres par siège puis libellé,
 * qui partent avec elle ; propositionsTouchees, les identifiants croissants
 * des propositions qui la déclarent, et retenuTouche de même — ils restent,
 * en dérive TABLE_SUPPRIMEE (§ 9). Une table nue rend deux listes vides.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {number} id
 * @returns {{reservations: Array<{participant: number, portee: 'tous'|'tour', tour: number|null, siege: number|null}>,
 *            titres: Array<{siege: number, libelle: string}>, propositionsTouchees: number[], retenuTouche: boolean}}
 * @throws {TypeError} une table inconnue
 */
export function bilanSuppressionTable(charge, id) {
  tableDe(charge, id);
  const declare = (placement) => Array.isArray(placement?.tables) && placement.tables.includes(id);
  return {
    reservations: charge.reservations
      .filter(({ table }) => table === id)
      .sort(ordreDesReservations)
      .map(({ participant, portee, tour, siege }) => ({ participant, portee, tour, siege })),
    titres: charge.titres
      .filter(({ table }) => table === id)
      .sort((a, b) => a.siege - b.siege || comparerTextes(a.libelle, b.libelle))
      .map(({ siege, libelle }) => ({ siege, libelle })),
    propositionsTouchees: identifiants(charge.propositions, declare),
    retenuTouche: charge.retenu !== null && declare(charge.retenu),
  };
}
