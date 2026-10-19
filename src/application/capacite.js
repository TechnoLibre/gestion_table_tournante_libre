// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le contrôle de capacité (§ 6.2, § 7.1) : ce qu'une capacité de table
// refuse et ce dont elle avertit, et le seul — les commandes du mobilier et
// leurs bilans l'appellent, aucun composant ne le refait (§ 13.2). Aussi la
// seule lecture d'un entier saisi (lireEntier), et la réécriture du retenu
// qu'une capacité changée entraîne (retenuAuxCapacites).
//
// Un refus a la forme { code, details }, le remède dans details.remede. Ils
// se contrôlent dans cet ordre, et le premier seul est rendu :
// MOINS_DE_DEUX ; TROP_DE_PLACES, au-delà de SIEGES_MAX, la borne que
// l'analyse du fichier pose aussi ; SOUS_RESERVATIONS, sous le plus grand compte de
// reservationsParTour ; SIEGES_RETIRES, un siège au-delà de la capacité qui
// porte un titre ou une réservation, suspendue comprise — l'analyse du
// fichier refuse un tel siège (§ 6.2) — ; SOUS_OCCUPES, pour la poignée, sous
// l'occupation de chaque tour telle qu'etatPlaces la montre. Le champ et la
// poignée décrivent deux gestes (§ 6.2, § 7.1) : la poignée, geste de
// géométrie fait sans regarder les autres tours, ne désassoit personne ; le
// champ, saisie délibérée, verse dans la réserve les occupants des chaises
// retirées et le dit (SURNUMERAIRES).
//
// Le retenu suit les capacités : ce qui ne tient plus va dans la réserve de
// chaque tour, puis la capacité s'écrit dans retenu.capacites, de sorte que
// le retenu ne gagne aucune raison de dérive. Sièges attribués, le siège est
// le rang : une personne que la table réserve à ce tour, assise sur une
// chaise que le plan montrait et que la nouvelle capacité retire, revient
// d'abord sur une chaise libre dans la capacité, sinon sur celle du plus
// haut rang qu'occupe un non-réservé ; puis les rangs au-delà de la capacité
// partent, et la liste perd ses chaises vides de fin. Aucune réservation que
// le plan montrait tenue ne cesse ainsi de l'être, et un rang au-delà de la
// capacité courante, que le plan ne montre pas, n'assied personne. Sans
// attribution, la liste garde les personnes que
// le plan montre assises à la table avant et après le geste — l'affichage
// élit d'abord celles que la table réserve —, puis, tant qu'elle dépasse,
// perd ses absents, le plus petit identifiant d'abord : un geste n'assied
// personne qu'il ne nomme. Un retenu fautif ne se réécrit pas. Aucune
// fonction ne modifie ce qu'elle reçoit.
//
// Un tour de la soirée se lit sous la règle de présence par tour (R1,
// places.js) : un absent est une personne exclue, supprimée ou absente à ce
// tour, et sa chaise est libre ; seules les réservations couvrantes du tour
// (reservationsCouvrantes) y tiennent une personne. Un tour du retenu que la
// soirée n'a plus garde sa lecture : la présence n'y est pas définie, et un
// absent n'y est qu'une personne exclue ou supprimée.
import { ordreDesReservations } from '../csv/import.js';
import { constante } from '../geometrie/constantes.js';
import { SIEGES_MAX, capacite } from '../stockage/document.js';
import { fautes } from '../stockage/placements.js';
import { couvre, etatPlaces, presents, presentsAuTour, repartirSieges, reservationsActives, reservationsCouvrantes } from './places.js';
import { reservationsParTour } from './pose.js';

const croissant = (a, b) => a - b;
const comparerTextes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Un entier écrit en chiffres décimaux seuls : ni signe, ni séparateur, ni
// exposant.
const CHIFFRES = /^[0-9]+$/;

const ORIGINES = new Set(['champ', 'poignee']);

// Le seuil de lisibilité, nommé dans le registre des constantes mesurées
// (§ 14.1) : un nom de constante, que la table des libellés ne connaît pas.
const SEUIL_LISIBLE = { nom: 'SEUIL_SIEGES_LISIBLES' };

const refusDe = (code, details, remede) => ({ code, details: { ...details, remede } });
const avertissement = (code, details) => ({ code, details });

// Le remède d'une capacité sous un compte : montrer le tour qui l'atteint,
// sur le plan du retenu ou des réservations.
const afficherTour = (tour) => ({ geste: 'afficherTour', tour, proposition: null });

/**
 * Lit un entier saisi (§ 6.2) : des chiffres décimaux seuls, blancs de bord
 * admis, ou un nombre entier ≥ 0 ; tout autre texte — signe, décimale,
 * virgule, lettres, vide, ou un entier au-delà de 2^53 − 1 — refuse
 * NON_ENTIER {saisie}, remède null. Le domaine de la valeur — au moins 2
 * places, au moins un tour — appartient à son contrôle.
 *
 * @param {string|number} saisie
 * @returns {{valeur: number}|{refus: {code: 'NON_ENTIER', details: {saisie: string|number, remede: null}}}}
 * @throws {TypeError} une saisie qui n'est ni un texte ni un nombre
 */
export function lireEntier(saisie) {
  if (typeof saisie === 'number') {
    if (Number.isSafeInteger(saisie) && saisie >= 0) return { valeur: saisie + 0 };
  } else if (typeof saisie === 'string') {
    const texte = saisie.trim();
    const valeur = CHIFFRES.test(texte) ? Number(texte) : Number.NaN;
    if (Number.isSafeInteger(valeur)) return { valeur };
  } else {
    throw new TypeError(`lireEntier : texte ou nombre attendu, reçu ${JSON.stringify(saisie)}`);
  }
  return { refus: refusDe('NON_ENTIER', { saisie }, null) };
}

// L'enregistrement de la table d'identifiant id : une table inconnue est une
// faute de l'appelant, que l'interface n'offre jamais.
function tableDe(charge, id) {
  const table = charge.tables.find((candidate) => candidate.id === id);
  if (table === undefined) throw new TypeError(`table inconnue : ${JSON.stringify(id)}`);
  return table;
}

// Le plus grand compte d'une liste par tour, et le premier tour qui
// l'atteint.
function maximum(comptes) {
  const n = Math.max(0, ...comptes);
  return { n, tour: comptes.indexOf(n) + 1 };
}

// Les sièges au-delà de sieges qui portent une saisie, par numéro
// décroissant ; à un même siège, ses titres par libellé, puis ses
// réservations dans l'ordre canonique. Une réservation suspendue — sa
// personne exclue — y est, sièges attribués ou non.
function siegesPortes(charge, idTable, sieges) {
  const ids = presents(charge);
  const titres = charge.titres.filter(({ table, siege }) => table === idTable && siege > sieges);
  const reservations = charge.reservations.filter(({ table, siege }) => table === idTable && siege !== null && siege > sieges);
  const numeros = [...new Set([...titres, ...reservations].map(({ siege }) => siege))].sort((a, b) => b - a);
  return numeros.flatMap((numero) => [
    ...titres
      .filter(({ siege }) => siege === numero)
      .sort((a, b) => comparerTextes(a.libelle, b.libelle))
      .map(({ siege, libelle }) => ({ siege, cause: 'SIEGE_TITRE', libelle })),
    ...reservations
      .filter(({ siege }) => siege === numero)
      .sort(ordreDesReservations)
      .map(({ siege, participant }) => ({ siege, cause: 'SIEGE_RESERVE', participant, suspendue: !ids.has(participant) })),
  ]);
}

// Le remède d'un siège retiré : le retrait de son titre, ou de sa
// réservation, désignée par ses quatre arguments.
function remedeDuSiege(charge, idTable, retire) {
  if (retire.cause === 'SIEGE_TITRE') return { commande: 'retirerTitre', arguments: { table: idTable, siege: retire.siege } };
  const { portee, tour } = charge.reservations
    .filter((r) => r.table === idTable && r.siege === retire.siege && r.participant === retire.participant)
    .sort(ordreDesReservations)[0];
  return { commande: 'retirerReservation', arguments: { participant: retire.participant, table: idTable, portee, tour } };
}

// L'occupation de la table à chaque tour, lue dans etatPlaces : les chaises
// qui portent un occupant ou une réservation ; sièges attribués, le plus
// haut numéro de ces chaises quand il est plus grand.
function occupation(charge, idTable) {
  return Array.from({ length: charge.evenement.tours }, (_, rang) => {
    const etat = etatPlaces(charge, { tour: rang + 1 });
    const { chaises } = etat.tables.find(({ id }) => id === idTable);
    const portees = chaises.filter(({ occupant, reservation }) => occupant !== null || reservation !== null);
    const plusHaut = portees.length === 0 ? 0 : portees.at(-1).siege;
    return etat.siegesAttribues ? Math.max(portees.length, plusHaut) : portees.length;
  });
}

// Le premier refus d'une capacité, ou null.
function refusDeCapacite(charge, idTable, sieges, origine) {
  if (sieges < 2) return refusDe('MOINS_DE_DEUX', {}, null);
  if (sieges > SIEGES_MAX) return refusDe('TROP_DE_PLACES', { max: SIEGES_MAX }, null);
  const reservees = maximum(reservationsParTour(charge, idTable));
  if (sieges < reservees.n) {
    return refusDe('SOUS_RESERVATIONS', { table: idTable, ...reservees }, afficherTour(reservees.tour));
  }
  const retires = siegesPortes(charge, idTable, sieges);
  if (retires.length > 0) {
    const titres = charge.reglages.attribuerSieges ? {} : { titres: retires.filter(({ cause }) => cause === 'SIEGE_TITRE').length };
    return refusDe('SIEGES_RETIRES', { table: idTable, sieges: retires, ...titres }, remedeDuSiege(charge, idTable, retires[0]));
  }
  if (origine === 'poignee') {
    const occupees = maximum(occupation(charge, idTable));
    if (sieges < occupees.n) return refusDe('SOUS_OCCUPES', { table: idTable, ...occupees }, afficherTour(occupees.tour));
  }
  return null;
}

// Les personnes que le plan montre assises à la table au tour, dans l'ordre
// de leurs chaises : celles d'etatPlaces (etat) pour un tour de la soirée.
// Un tour du retenu que la soirée n'a plus ne se montre pas : il se lit
// selon la même règle, la liste de la source répartie aux places courantes
// par repartirSieges, les réservations « tous » de la table seules
// couvrantes.
function assises(charge, etat, idTable, tour) {
  if (etat !== null) {
    return etat.tables
      .find(({ id }) => id === idTable)
      .chaises.map(({ occupant }) => occupant)
      .filter((occupant) => occupant !== null);
  }
  const { retenu } = charge;
  const ids = presents(charge);
  const places = capacite(charge, tableDe(charge, idTable));
  const liste = retenu.placement[tour - 1].sieges[retenu.tables.indexOf(idTable)];
  if (retenu.siegesAttribues) return liste.slice(0, places).filter((id) => id !== null && ids.has(id));
  const tous = reservationsActives(charge).filter(({ table, portee }) => table === idTable && portee === 'tous');
  const siegeDe = new Map();
  for (const { participant, siege } of tous) if (siege !== null && !siegeDe.has(participant)) siegeDe.set(participant, siege);
  const prioritaires = new Set(tous.map(({ participant }) => participant));
  return repartirSieges(liste.filter((id) => ids.has(id)), siegeDe, places, prioritaires).filter((id) => id !== null);
}

// Sièges attribués, la liste de la table réduite à ses limite premiers
// rangs, sans chaise vide de fin. reservees (Map personne → siège réservé ou
// null) : les personnes que la table réserve à ce tour. Chacune, assise à un
// rang que le plan montrait — de limite à montres, la capacité courante — et
// que la réduction retire, revient, dans l'ordre des rangs, à son siège
// réservé quand il est libre, sinon à la première chaise libre — vide, ou
// d'un absent, qui passe alors en réserve —, sinon à la chaise du plus haut
// rang qu'occupe un non-réservé, qui passe en réserve. Un rang à partir de
// montres ne ramène personne : une hausse (limite égale à montres) n'en
// ramène aucun. La capacité a passé SIEGES_RETIRES et SOUS_RESERVATIONS :
// chaque siège réservé est dans limite, et les réservés de la table à ce
// tour n'y sont pas plus nombreux que les chaises ; une chaise se trouve
// toujours.
function ramenerReservees(liste, limite, montres, reservees, ids) {
  const reste = Array.from({ length: limite }, (_, rang) => liste[rang] ?? null);
  const libre = (occupant) => occupant === null || !ids.has(occupant);
  for (const id of liste.slice(limite, montres)) {
    if (id === null || !reservees.has(id)) continue;
    const voulu = reservees.get(id);
    let rang = voulu !== null && libre(reste[voulu - 1]) ? voulu - 1 : reste.findIndex(libre);
    if (rang < 0) rang = reste.findLastIndex((occupant) => !reservees.has(occupant));
    reste[rang] = id;
  }
  while (reste.length > 0 && reste.at(-1) === null) reste.pop();
  return reste;
}

// Les personnes que la table idTable réserve au tour, chacune avec son siège
// réservé ou null : parmi couvrantes (dans l'ordre canonique), celles qui
// couvrent ce tour ; un tour que la soirée n'a plus, l'analyse n'admettant
// aucune portée « tour » au-delà des tours, seules les « tous » le couvrent.
// Le siège réservé d'une personne est le premier siège non nul de ses
// réservations, comme l'affichage le lit.
function reserveesAuTour(couvrantes, idTable, tour) {
  const reservees = new Map();
  for (const reservation of couvrantes) {
    const { table, participant, siege } = reservation;
    if (table !== idTable || !couvre(reservation, tour)) continue;
    if (!reservees.has(participant) || reservees.get(participant) === null) reservees.set(participant, siege);
  }
  return reservees;
}

// La charge où chaque table de changements (Map identifiant → places) porte
// ses nouvelles places, le retenu tel quel.
const avecCapacites = (charge, changements) => ({
  ...charge,
  tables: charge.tables.map((table) => (changements.has(table.id) ? { ...table, sieges: changements.get(table.id) } : table)),
});

/**
 * Ce que de nouvelles capacités font au retenu de la charge, par table de
 * changements qu'il déclare, dans l'ordre de charge.tables, et par tour du
 * retenu : la liste qui reste, ce qui en est versé à la réserve, et les
 * personnes que le plan du tour montrait assises à la table et qui passent
 * dans la réserve, dans l'ordre de leurs chaises — pour un tour que la
 * soirée n'a plus, celles qu'assises y lit. null sans retenu, ou pour un
 * retenu fautif, qui ne se réécrit pas.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {Map<number, number>} changements   identifiant de table → places
 * @returns {null|Array<{table: number, rang: number, sieges: number,
 *           tours: Array<{tour: number, liste: Array<number|null>, verses: number[], personnes: number[]}>}>}
 */
function versements(charge, changements) {
  const { retenu } = charge;
  if (retenu === null || fautes(retenu).length > 0) return null;
  const hypothese = avecCapacites(charge, changements);
  const nonExclus = presents(charge);
  const actives = reservationsActives(charge);
  const touchees = charge.tables
    .filter(({ id }) => changements.has(id) && retenu.tables.includes(id))
    .map(({ id }) => ({ table: id, rang: retenu.tables.indexOf(id), sieges: changements.get(id), tours: [] }));
  for (let tour = 1; tour <= retenu.tours; tour += 1) {
    const visible = tour <= charge.evenement.tours;
    // Les présentes du tour et ses réservations couvrantes ; au-delà de la
    // soirée, les non-exclus et les réservations actives.
    const ids = visible ? presentsAuTour(charge, tour) : nonExclus;
    const couvrantes = visible ? reservationsCouvrantes(charge, tour) : actives;
    const etatAvant = visible ? etatPlaces(charge, { tour }) : null;
    // Sièges attribués, ce qui reste ne se lit pas dans le plan d'après.
    const etatApres = visible && !retenu.siegesAttribues ? etatPlaces(hypothese, { tour }) : null;
    for (const touchee of touchees) {
      const { table, rang, sieges } = touchee;
      const liste = retenu.placement[tour - 1].sieges[rang];
      const avant = assises(charge, etatAvant, table, tour);
      let reste;
      if (retenu.siegesAttribues) {
        // Le siège est le rang : un rang au-delà des places d'aujourd'hui ne
        // se montre pas, et une hausse ne l'assied pas.
        const montres = capacite(charge, tableDe(charge, table));
        const limite = Math.min(sieges, montres);
        reste = ramenerReservees(liste, limite, montres, reserveesAuTour(couvrantes, table, tour), ids);
      } else {
        const apres = new Set(assises(hypothese, etatApres, table, tour));
        const gardees = new Set(avant.filter((id) => apres.has(id)));
        reste = liste.filter((id) => !ids.has(id) || gardees.has(id));
        const absents = reste.filter((id) => !ids.has(id)).sort(croissant);
        // Les présents gardés tiennent dans sieges : ôter les absents suffit.
        while (reste.length > sieges && absents.length > 0) {
          const absent = absents.shift();
          reste = reste.filter((id) => id !== absent);
        }
      }
      const restants = new Set(reste);
      const verses = liste.filter((id) => id !== null && !restants.has(id));
      const personnes = avant.filter((id) => !restants.has(id));
      touchee.tours.push({ tour, liste: reste, verses, personnes });
    }
  }
  return touchees;
}

/**
 * Le retenu de la charge aux nouvelles capacités (§ 6.2, § 9) : à chaque
 * tour, ce qui ne tient plus versé dans la réserve, puis la capacité de
 * chaque table touchée écrite dans retenu.capacites. Un objet neuf ; le
 * retenu reçu tel quel sans retenu, pour un retenu fautif, ou quand il ne
 * déclare aucune table touchée.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {Map<number, number>} changements   identifiant de table → places
 * @returns {import('../stockage/types.js').Retenu|null}
 */
export function retenuAuxCapacites(charge, changements) {
  const touchees = versements(charge, changements);
  if (touchees === null || touchees.length === 0) return charge.retenu;
  const retenu = structuredClone(charge.retenu);
  for (const { rang, sieges, tours } of touchees) {
    for (const { tour, liste, verses } of tours) {
      const etage = retenu.placement[tour - 1];
      etage.sieges[rang] = liste;
      etage.reserve = [...etage.reserve, ...verses].sort(croissant);
    }
    retenu.capacites[rang] = sieges;
  }
  return retenu;
}

/**
 * Les refus et les avertissements de plusieurs capacités à la fois, chacune
 * contrôlée comme le ferait controlerCapacite, sur la même charge : les
 * tables ne partagent aucune chaise. Les tables de changements dans l'ordre
 * de charge.tables ; refus, le premier de chaque table qui refuse ;
 * avertissements, ceux des tables qui ne refusent pas.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {Map<number, number>} changements   identifiant de table → places
 * @param {{origine: 'champ'|'poignee'}} options
 * @returns {{refus: Array<{table: number, code: string, details: Object}>,
 *            avertissements: Array<{table: number, code: string, details: Object}>}}
 * @throws {TypeError} une table inconnue, des places qui ne sont pas un entier, une origine inconnue
 */
export function controlerCapacites(charge, changements, { origine }) {
  if (!ORIGINES.has(origine)) throw new TypeError(`origine : 'champ' ou 'poignee' attendue, reçu ${JSON.stringify(origine)}`);
  for (const [idTable, sieges] of changements) {
    tableDe(charge, idTable);
    if (!Number.isSafeInteger(sieges)) throw new TypeError(`places : entier attendu, reçu ${JSON.stringify(sieges)}`);
  }
  const ordre = charge.tables.filter(({ id }) => changements.has(id)).map(({ id }) => id);
  const refus = [];
  const acceptees = new Map();
  for (const idTable of ordre) {
    const premier = refusDeCapacite(charge, idTable, changements.get(idTable), origine);
    if (premier === null) acceptees.set(idTable, changements.get(idTable));
    else refus.push({ table: idTable, ...premier });
  }
  const parTable = new Map(ordre.map((id) => [id, []]));
  for (const { table, tours } of versements(charge, acceptees) ?? []) {
    for (const { tour, personnes } of tours) {
      if (personnes.length > 0) parTable.get(table).push(avertissement('SURNUMERAIRES', { table, tour, personnes }));
    }
  }
  const seuil = constante(SEUIL_LISIBLE.nom);
  const avertissements = [];
  for (const [idTable, sieges] of acceptees) {
    for (const { code, details } of parTable.get(idTable)) avertissements.push({ table: idTable, code, details });
    if (sieges > seuil) avertissements.push({ table: idTable, code: 'AU_DELA_LISIBLE', details: { seuil } });
  }
  return { refus, avertissements };
}

/**
 * Le contrôle d'une capacité (§ 6.2, § 7.1), sans rien écrire : sieges
 * places pour la table idTable, saisies au champ ou tirées à la poignée.
 * refus, le premier dans l'ordre de l'en-tête du module, ou null ;
 * avertissements, quand il n'y a pas de refus : SURNUMERAIRES {table, tour,
 * personnes}, un par tour du retenu — un tour que la soirée n'a plus
 * compris — où il verse dans la réserve des personnes que le plan montrait
 * assises à la table, nommées dans
 * l'ordre de leurs chaises — la poignée, qui refuse sous l'occupation, n'en
 * verse aucune ; puis AU_DELA_LISIBLE {seuil} au-delà de
 * SEUIL_SIEGES_LISIBLES places.
 *
 * Refus : MOINS_DE_DEUX {}, remède null ; TROP_DE_PLACES {max}, au-delà de
 * SIEGES_MAX, remède null ; SOUS_RESERVATIONS {table, n,
 * tour} et SOUS_OCCUPES {table, n, tour}, tour le premier qui atteint n,
 * remède { geste: 'afficherTour', tour, proposition: null } ;
 * SIEGES_RETIRES {table, sieges, titres?} — chaque siège retiré qui porte un
 * titre {siege, cause: 'SIEGE_TITRE', libelle} ou une réservation {siege,
 * cause: 'SIEGE_RESERVE', participant, suspendue}, par numéro décroissant ;
 * titres, le compte des titres, sous des sièges non attribués seulement —,
 * remède celui du premier siège listé, retirerTitre ou retirerReservation.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {number} idTable
 * @param {number} sieges
 * @param {{origine: 'champ'|'poignee'}} options
 * @returns {{refus: {code: string, details: Object}|null, avertissements: Array<{code: string, details: Object}>}}
 * @throws {TypeError} une table inconnue, des places qui ne sont pas un entier, une origine inconnue
 */
export function controlerCapacite(charge, idTable, sieges, { origine }) {
  const { refus, avertissements } = controlerCapacites(charge, new Map([[idTable, sieges]]), { origine });
  if (refus.length > 0) return { refus: { code: refus[0].code, details: refus[0].details }, avertissements: [] };
  return { refus: null, avertissements: avertissements.map(({ code, details }) => ({ code, details })) };
}
