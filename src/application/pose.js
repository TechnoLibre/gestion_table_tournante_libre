// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le contrôle de pose (§ 5.9) : ce que le logiciel refuse au moment du geste,
// avant toute écriture, et le seul — les commandes l'appellent, aucun
// composant ne le refait (§ 13.2). Le moteur ignore sièges et titres et
// s'arrête au premier refus par une exception ; controlerPose rend tous les
// refus d'une pose, chacun avec le remède qui le lève, écrit en entier : une
// commande et ses arguments, exécutables tels quels, ou un geste.
//
// Un refus a la forme { code, details }, le remède dans details.remede.
// Plusieurs se rangent dans l'ordre SURRESERVATION, SIEGE_INEXISTANT,
// DEUX_PLACES_MEME_TOUR, PERSONNE_EXCLUE, PLACE_RESERVEE, RESERVEE_AILLEURS ;
// une commande lève le premier et porte les suivants dans details.autres
// (leverRefus). Une réservation suspendue — celle d'une personne exclue —
// ne compte nulle part : une pose peut prendre sa place (§ 4.4), et sa
// réintégration se contrôle comme une pose (controlerReintegration). Aucune
// fonction ne modifie ce qu'elle reçoit.
import { ordreDesReservations } from '../csv/import.js';
import { capacite } from '../stockage/document.js';
import { ErreurCommande } from './erreurs.js';
import { couvre, instanceDe, reservationsActives } from './places.js';

// Un refus : son code, ses détails, et le remède parmi eux.
const refusDe = (code, details, remede) => ({ code, details: { ...details, remede } });

// Le remède d'une capacité trop petite : la table portée à sieges places,
// par la saisie de son champ.
const changerPlaces = (table, sieges) => ({ commande: 'changerPlacesTable', arguments: { id: table, sieges, origine: 'champ' } });

// Ce qui désigne une réservation dans une commande : sa table, sa portée, son
// tour, null pour la portée « tous ».
const designation = ({ table, portee, tour }) => ({ table, portee, tour: portee === 'tous' ? null : tour });

// Vrai quand la réservation r est celle que désigne d, pour ce participant.
const designee = (r, participant, d) =>
  r.participant === participant && r.table === d.table && r.portee === d.portee && r.tour === (d.portee === 'tous' ? null : d.tour);

// Les tours qu'une réservation couvre, croissants.
function toursCouverts(charge, { portee, tour }) {
  if (portee === 'tous') return Array.from({ length: charge.evenement.tours }, (_, rang) => rang + 1);
  return [tour];
}

// L'enregistrement de la table d'identifiant id ; une table inconnue est une
// faute de l'appelant, que l'interface n'offre jamais.
function tableDe(charge, id) {
  const table = charge.tables.find((candidate) => candidate.id === id);
  if (table === undefined) throw new TypeError(`table inconnue : ${JSON.stringify(id)}`);
  return table;
}

// Les personnes distinctes dont une réservation de la liste couvre le tour
// à cette table.
const reserveesAuTour = (actives, idTable, tour) =>
  new Set(actives.filter((r) => r.table === idTable && couvre(r, tour)).map(({ participant }) => participant));

/**
 * [r − 1] : les personnes distinctes non exclues dont une réservation couvre
 * le tour r à cette table — le compte de SURRESERVATION du moteur, sans
 * lever.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {number} idTable
 * @returns {number[]}   R comptes
 */
export function reservationsParTour(charge, idTable) {
  const actives = reservationsActives(charge);
  return Array.from({ length: charge.evenement.tours }, (_, rang) => reserveesAuTour(actives, idTable, rang + 1).size);
}

/**
 * Contrôle d'une pose (§ 5.9), sans rien écrire ; pose : { participant,
 * table, siege, portee, tour, depuis?, retenu? } — depuis : la réservation
 * que la pose déplace, { table, portee, tour }, qui ne compte plus ;
 * retenu : vrai pour un dépôt dans le placement retenu au tour donné, qui ne
 * pose aucune réservation. Chaque remède s'écrit en entier. Rend tous les
 * refus, dans l'ordre du contrat :
 * - SURRESERVATION {table, tour, reservees, capacite} : le code et les
 *   détails de l'ErreurConfiguration du moteur, reservees compté après la
 *   pose, au premier tour couvert qui déborde ; remède la table portée à
 *   reservees places ;
 * - SIEGE_INEXISTANT {table, siege, capacite} : sièges attribués seulement ;
 *   remède la table portée à siege places ;
 * - DEUX_PLACES_MEME_TOUR {participant, tour, autre} : une autre réservation
 *   active de la personne couvre un tour de la pose, à une autre table, ou à
 *   un autre siège de la même ; remède le déplacement de cette réservation
 *   vers la place de la pose ;
 * - PERSONNE_EXCLUE {participant} : remède la réintégration ;
 * - PLACE_RESERVEE {table, siege, tour, titulaire, portee} : la réservation
 *   active d'une autre personne tient ce siège à un tour de la pose, dans les
 *   deux modes ; remède le choix d'une place pour la réservation de la
 *   titulaire ;
 * - RESERVEE_AILLEURS {participant, tour, reservation} : dans le retenu, la
 *   personne est réservée à ce tour à une autre table — ou, sièges du retenu
 *   attribués, à un autre siège ; remède le déplacement de sa réservation
 *   vers le dépôt.
 * Les trois premiers ne valent que pour une réservation. signaux porte
 * TABLE_GELEE {table} quand, la pose faite, les ancrés de la table en
 * occupent toutes les places (k_t = c_t) : accepté, mais rarement voulu.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {Object} pose
 * @returns {{refus: Array<{code: string, details: Object}>, signaux: Array<{code: 'TABLE_GELEE', table: number}>}}
 */
export function controlerPose(charge, pose) {
  const { participant, table: idTable, siege = null, portee, tour = null, depuis = null, retenu = false } = pose;
  const places = capacite(charge, tableDe(charge, idTable));
  const exclu = charge.participants.some(({ id, exclu: estExclu }) => id === participant && estExclu);
  const couverts = retenu ? [tour] : toursCouverts(charge, { portee, tour });
  const actives = reservationsActives(charge).filter((r) => depuis === null || !designee(r, participant, depuis));
  const premierCommun = (r) => couverts.find((t) => couvre(r, t));
  const refus = [];

  if (!retenu) {
    for (const t of couverts) {
      const reservees = reserveesAuTour(actives, idTable, t);
      if (!exclu) reservees.add(participant);
      if (reservees.size > places) {
        const details = { table: idTable, tour: t, reservees: reservees.size, capacite: places };
        refus.push(refusDe('SURRESERVATION', details, changerPlaces(idTable, reservees.size)));
        break;
      }
    }
    if (charge.reglages.attribuerSieges && siege !== null && siege > places) {
      refus.push(refusDe('SIEGE_INEXISTANT', { table: idTable, siege, capacite: places }, changerPlaces(idTable, siege)));
    }
    const autre = actives.find(
      (r) =>
        r.participant === participant &&
        premierCommun(r) !== undefined &&
        (r.table !== idTable || (r.siege !== null && siege !== null && r.siege !== siege)),
    );
    if (autre !== undefined) {
      const remede = {
        commande: 'deplacerReservation',
        arguments: { participant, de: designation(autre), vers: { table: idTable, siege } },
      };
      const details = {
        participant,
        tour: premierCommun(autre),
        autre: { table: autre.table, siege: autre.siege, portee: autre.portee, tour: autre.tour },
      };
      refus.push(refusDe('DEUX_PLACES_MEME_TOUR', details, remede));
    }
  }

  if (exclu) {
    refus.push(refusDe('PERSONNE_EXCLUE', { participant }, { commande: 'reintegrerParticipant', arguments: { id: participant } }));
  }

  if (siege !== null) {
    const titulaire = actives.find(
      (r) => r.participant !== participant && r.table === idTable && r.siege === siege && premierCommun(r) !== undefined,
    );
    if (titulaire !== undefined) refus.push(placeReservee(titulaire, premierCommun(titulaire)));
  }

  if (retenu && !exclu) {
    const attribues = charge.retenu?.siegesAttribues === true;
    const propre = actives.find(
      (r) =>
        r.participant === participant &&
        couvre(r, tour) &&
        (r.table !== idTable || (attribues && r.siege !== null && siege !== null && r.siege !== siege)),
    );
    if (propre !== undefined) {
      const remede = {
        commande: 'deplacerReservation',
        arguments: { participant, de: designation(propre), vers: { table: idTable, siege } },
      };
      const reservation = { table: propre.table, siege: propre.siege, portee: propre.portee, tour: propre.tour };
      refus.push(refusDe('RESERVEE_AILLEURS', { participant, tour, reservation }, remede));
    }
  }

  return { refus, signaux: retenu ? [] : signauxDe(charge, pose, places) };
}

// PLACE_RESERVEE de la réservation r d'une titulaire, au tour donné : le
// remède fait choisir une place sur le plan, l'écrit dans
// puis.arguments.vers, puis déplace la réservation de la titulaire.
function placeReservee(r, tour) {
  const remede = {
    geste: 'choisirPlace',
    puis: { commande: 'deplacerReservation', arguments: { participant: r.participant, de: designation(r) } },
  };
  return refusDe('PLACE_RESERVEE', { table: r.table, siege: r.siege, tour, titulaire: r.participant, portee: r.portee }, remede);
}

// TABLE_GELEE quand la charge où la pose serait faite se normalise et que
// les ancrés de la table en occupent toutes les places.
function signauxDe(charge, { participant, table: idTable, siege = null, portee, tour = null, depuis = null }, places) {
  const gardees = charge.reservations.filter((r) => depuis === null || !designee(r, participant, depuis));
  const posee = { participant, table: idTable, siege, portee, tour: portee === 'tous' ? null : tour };
  const instance = instanceDe({ ...charge, reservations: [...gardees, posee] });
  if (instance === null || instance.ancresParTable[instance.indexTableDe.get(idTable)] !== places) return [];
  return [{ code: 'TABLE_GELEE', table: idTable }];
}

/**
 * Les refus de la réintégration de id (§ 4.4, § 5.9) : ses réservations
 * suspendues, posées contre les actives. SURRESERVATION quand une table ne
 * peut plus les recevoir, au premier tour qui déborde, une fois par table,
 * dans l'ordre de ses réservations ; puis PLACE_RESERVEE, une par
 * réservation à un siège qu'une autre personne a pris depuis à un tour
 * qu'elle couvre. [] quand rien ne s'y oppose, et pour une personne qui
 * n'est pas exclue.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {number} id
 * @returns {Array<{code: string, details: Object}>}
 */
export function controlerReintegration(charge, id) {
  if (!charge.participants.some((personne) => personne.id === id && personne.exclu)) return [];
  const apres = {
    ...charge,
    participants: charge.participants.map((personne) => (personne.id === id ? { ...personne, exclu: false } : personne)),
  };
  const siennes = charge.reservations.filter(({ participant }) => participant === id).sort(ordreDesReservations);
  const refus = [];
  const vues = new Set();
  for (const { table: idTable } of siennes) {
    if (vues.has(idTable)) continue;
    vues.add(idTable);
    const places = capacite(apres, tableDe(apres, idTable));
    const comptes = reservationsParTour(apres, idTable);
    const rang = comptes.findIndex((n) => n > places);
    if (rang >= 0) {
      const details = { table: idTable, tour: rang + 1, reservees: comptes[rang], capacite: places };
      refus.push(refusDe('SURRESERVATION', details, changerPlaces(idTable, comptes[rang])));
    }
  }
  const actives = reservationsActives(charge);
  for (const sienne of siennes) {
    if (sienne.siege === null) continue;
    const couverts = toursCouverts(charge, sienne);
    const autre = actives.find(
      (r) => r.table === sienne.table && r.siege === sienne.siege && couverts.some((t) => couvre(r, t)),
    );
    if (autre !== undefined) refus.push(placeReservee(autre, couverts.find((t) => couvre(autre, t))));
  }
  return refus;
}

/**
 * Lève le premier refus d'une liste, en ErreurCommande de son code et de ses
 * détails, remède compris, les suivants dans details.autres ; ne fait rien
 * d'une liste vide.
 *
 * @param {Array<{code: string, details: Object}>} refus
 * @throws {ErreurCommande}
 */
export function leverRefus(refus) {
  if (refus.length === 0) return;
  const [premier, ...autres] = refus;
  throw new ErreurCommande(premier.code, { ...premier.details, autres });
}
