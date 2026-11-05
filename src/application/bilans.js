// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les bilans du mobilier (§ 6.1, § 6.2, § 2.1 étape 5, § 4.5) : ce qu'un
// changement de défaut, de tours ou la suppression d'une table emporterait,
// objectifs des tables compris, compté sur la charge courante sans rien
// écrire, pour l'énoncer avant d'appliquer. La commande qui applique lit le
// même bilan : changerDefaut lève le premier de ses refus. Les refus et
// avertissements d'une capacité sont ceux de controlerCapacites
// (capacite.js), le seul contrôle ; l'ordre des objectifs, ordreDesObjectifs
// (objectifs.js). Les personnes se comptent par tour, sous la règle de
// présence par tour (presentsAuTour, places.js) ; la présence après un
// changement de tours, rognée, se lit dans presencesSousTours
// (stockage/presence.js), la seule. Aucune fonction ne modifie ce qu'elle
// reçoit.
import { ordreDesReservations } from '../csv/import.js';
import { SIEGES_MAX, capacite, nomsDesTours } from '../stockage/document.js';
import { presencesSousTours } from '../stockage/presence.js';
import { controlerCapacites } from './capacite.js';
import { ordreDesObjectifs } from './objectifs.js';
import { presentsAuTour } from './places.js';

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

// La somme d'une liste de nombres.
const somme = (valeurs) => valeurs.reduce((total, valeur) => total + valeur, 0);

// Le nombre de personnes présentes à chaque tour de 1 à R.
const presentsParTourDe = (charge) => Array.from({ length: charge.evenement.tours }, (_, rang) => presentsAuTour(charge, rang + 1).size);

/**
 * La capacité de la salle tour par tour (§ 6.1, § 5.9) : à chaque tour de 1
 * à R, les personnes présentes (règle par tour), les places, somme des
 * capacités courantes, et le manque, max(0, presentes − places). Sans
 * absence, chaque tour compte les non-exclus.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {Array<{tour: number, presentes: number, places: number, manque: number}>}
 */
export function capaciteParTour(charge) {
  const places = somme(charge.tables.map((table) => capacite(charge, table)));
  return presentsParTourDe(charge).map((presentes, rang) => ({ tour: rang + 1, presentes, places, manque: Math.max(0, presentes - places) }));
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
 * somme des capacités avant et après ; presentsParTour, les personnes
 * présentes à chaque tour de 1 à R ; participants, le plus grand de ces
 * comptes — sans absence, les personnes non exclues. realigner : les
 * surchargées passent aussi à sieges.
 *
 * Chaque table dont la capacité change se contrôle comme une saisie au champ
 * (§ 6.2) : refus, le premier de chaque table qui refuse, {table, code,
 * details}, par ordre de charge.tables ; avertissements, de même, ceux des
 * autres — SURNUMERAIRES, AU_DELA_LISIBLE. Moins de 2 places, ou plus de
 * SIEGES_MAX, refusent pour l'événement entier, qu'une table suive le
 * défaut ou non : un seul refus, MOINS_DE_DEUX ou TROP_DE_PLACES {max},
 * table null.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {number} sieges
 * @param {{realigner?: boolean}} [options]
 * @returns {{suivent: number, avant: number, apres: number, surchargees: number[], totalAvant: number,
 *            totalApres: number, participants: number, presentsParTour: number[],
 *            refus: Array<{table: number|null, code: string, details: Object}>,
 *            avertissements: Array<{table: number, code: string, details: Object}>}}
 * @throws {TypeError} sieges qui n'est pas un entier
 */
export function bilanChangementDefaut(charge, sieges, { realigner = false } = {}) {
  exigerEntier(sieges, 'sieges');
  const apresDe = (table) => (table.sieges === null || realigner ? sieges : table.sieges);
  const presentsParTour = presentsParTourDe(charge);
  const changements = new Map(
    charge.tables.filter((table) => apresDe(table) !== capacite(charge, table)).map((table) => [table.id, apresDe(table)]),
  );
  const pourLEvenement = (code, details) => ({ refus: [{ table: null, code, details: { ...details, remede: null } }], avertissements: [] });
  let controle;
  if (sieges < 2) controle = pourLEvenement('MOINS_DE_DEUX', {});
  else if (sieges > SIEGES_MAX) controle = pourLEvenement('TROP_DE_PLACES', { max: SIEGES_MAX });
  else controle = controlerCapacites(charge, changements, { origine: 'champ' });
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
    participants: Math.max(0, ...presentsParTour),
    presentsParTour,
    refus: controle.refus,
    avertissements: controle.avertissements,
  };
}

/**
 * Le changement du nombre de tours à tours (§ 2.1 étape 5, § 4.3, § 4.5) :
 * reservationsDetruites, les réservations « tour désigné » au-delà, dans
 * l'ordre canonique ; objectifsDetruits, les objectifs de table des tours
 * au-delà, par identifiant de table puis tour croissants — ceux de la
 * soirée restent ; propositionsTouchees, les identifiants croissants des
 * propositions qui ne porteront pas tours tours, et retenuTouche de même
 * pour le retenu — ils restent, en dérive TOURS_CHANGES (§ 9). Le nombre de
 * tours d'aujourd'hui ne touche rien. La portée « tous » ne se détruit
 * jamais : elle n'énumère aucun tour. presencesRognees, chaque présence que
 * la baisse tronque, exclues comprises, {participant, avant, apres}, apres
 * null quand le champ part (tous les tours), par identifiant croissant ;
 * presencesVidees, les identifiants croissants des non-exclues dont la
 * présence se viderait, que le changement de tours refuse. Une exclue dont
 * la présence se viderait perd le champ, et figure dans presencesRognees
 * (presencesSousTours). Une hausse ne rogne rien : une présence énumérée ne
 * s'étend pas. Sous un tour, nombre que le changement de tours refuse,
 * aucune présence ne se rogne. nomsRetires, les noms des tours au-delà,
 * {tour, nom}, par tour croissant ; un tour sans nom n'y figure pas.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {number} tours
 * @returns {{reservationsDetruites: Array<{participant: number, table: number, tour: number}>,
 *            objectifsDetruits: Array<{table: number, tour: number}>, propositionsTouchees: number[],
 *            retenuTouche: boolean, presencesRognees: Array<{participant: number, avant: number[], apres: number[]|null}>,
 *            presencesVidees: number[], nomsRetires: Array<{tour: number, nom: string}>}}
 * @throws {TypeError} tours qui n'est pas un entier
 */
export function bilanTours(charge, tours) {
  exigerEntier(tours, 'tours');
  const change = tours !== charge.evenement.tours;
  const touche = (placement) => change && placement?.tours !== tours;
  const { rognees, videes } = tours >= 1 ? presencesSousTours(charge.participants, tours) : { rognees: [], videes: [] };
  return {
    reservationsDetruites: charge.reservations
      .filter(({ portee, tour }) => portee === 'tour' && tour > tours)
      .sort(ordreDesReservations)
      .map(({ participant, table, tour }) => ({ participant, table, tour })),
    objectifsDetruits: [...charge.tables]
      .sort((a, b) => a.id - b.id)
      .flatMap(({ id, objectifs = [] }) =>
        objectifs
          .filter(({ portee, tour }) => portee === 'tour' && tour > tours)
          .map(({ tour }) => ({ table: id, tour }))
          .sort((a, b) => a.tour - b.tour),
      ),
    propositionsTouchees: identifiants(charge.propositions, touche),
    retenuTouche: charge.retenu !== null && touche(charge.retenu),
    presencesRognees: rognees,
    presencesVidees: videes,
    nomsRetires: nomsDesTours(charge)
      .map((nom, rang) => ({ tour: rang + 1, nom }))
      .filter(({ tour, nom }) => tour > tours && nom !== null),
  };
}

/**
 * La suppression de la table id (§ 6.2, § 4, § 4.5) : ses réservations,
 * suspendues comprises, dans l'ordre canonique, ses titres par siège puis
 * libellé, et ses objectifs {tour, regle, etiquettes}, la soirée d'abord
 * puis les tours croissants, qui partent avec elle ; propositionsTouchees,
 * les identifiants croissants des propositions qui la déclarent, et
 * retenuTouche de même — ils restent, en dérive TABLE_SUPPRIMEE (§ 9). Une
 * table nue rend trois listes vides.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {number} id
 * @returns {{reservations: Array<{participant: number, portee: 'tous'|'tour', tour: number|null, siege: number|null}>,
 *            titres: Array<{siege: number, libelle: string}>,
 *            objectifs: Array<{tour: number|null, regle: 'ou'|'et'|null, etiquettes: string[]}>,
 *            propositionsTouchees: number[], retenuTouche: boolean}}
 * @throws {TypeError} une table inconnue
 */
export function bilanSuppressionTable(charge, id) {
  const table = tableDe(charge, id);
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
    objectifs: [...(table.objectifs ?? [])]
      .sort(ordreDesObjectifs)
      .map(({ tour, regle, etiquettes }) => ({ tour, regle, etiquettes: [...etiquettes] })),
    propositionsTouchees: identifiants(charge.propositions, declare),
    retenuTouche: charge.retenu !== null && declare(charge.retenu),
  };
}
