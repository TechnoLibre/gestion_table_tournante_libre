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
// DEUX_PLACES_MEME_TOUR, PERSONNE_EXCLUE, PERSONNE_ABSENTE_AU_TOUR,
// PLACE_RESERVEE, RESERVEE_AILLEURS ; une commande lève le premier et porte
// les suivants dans details.autres (leverRefus). Une réservation suspendue —
// celle d'une personne exclue, ou d'une personne à ses tours d'absence (R1,
// places.js) — ne compte nulle part à ces tours : une pose peut y prendre sa
// place (§ 4.4), et sa réintégration, ou la présence qui s'étend à ces
// tours, se contrôle comme une pose (controlerReintegration,
// controlerPresence). Les réservations de deux personnes ne se disputent
// une place qu'aux tours où l'une et l'autre tiennent ; celles d'une même
// personne s'excluent à chaque tour qu'elles couvrent, présente ou non.
// Aucune fonction ne modifie ce qu'elle reçoit.
import { ordreDesReservations } from '../csv/import.js';
import { estPresentAuTour, toursDePresence } from '../moteur/presence.js';
import { capacite } from '../stockage/document.js';
import { ErreurCommande } from './erreurs.js';
import { nomAffiche } from './personnes.js';
import { couvre, instanceDe, presentsAuTour, reservationsActives, reservationsCouvrantes } from './places.js';

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

// Vrai quand la réservation r tient sa personne au tour : elle couvre le
// tour, et sa personne y est présente (presents, celles du tour).
const tientAuTour = (r, tour, presents) => couvre(r, tour) && presents.has(r.participant);

// Les présentes de chaque tour de 1 à R (R1) : presentes(tour) les lit une
// fois par tour, au premier appel.
function presentesParTour(charge) {
  const memoire = new Map();
  return (tour) => {
    if (!memoire.has(tour)) memoire.set(tour, presentsAuTour(charge, tour));
    return memoire.get(tour);
  };
}

// Les personnes distinctes dont une réservation de la liste tient au tour à
// cette table.
const reserveesAuTour = (actives, idTable, tour, presents) =>
  new Set(actives.filter((r) => r.table === idTable && tientAuTour(r, tour, presents)).map(({ participant }) => participant));

/**
 * [r − 1] : les personnes distinctes dont une réservation couvrante du tour
 * r tient à cette table (reservationsCouvrantes : non exclues, présentes à
 * r) — le compte de SURRESERVATION du moteur, sans lever.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {number} idTable
 * @returns {number[]}   R comptes
 */
export function reservationsParTour(charge, idTable) {
  return Array.from(
    { length: charge.evenement.tours },
    (_, rang) => new Set(reservationsCouvrantes(charge, rang + 1).filter((r) => r.table === idTable).map(({ participant }) => participant)).size,
  );
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
 *   un autre siège de la même — à ses tours d'absence compris, où la présence
 *   rendue les ferait tenir ensemble ; tour, le premier tour commun ; remède
 *   le déplacement de cette réservation vers la place de la pose ;
 * - PERSONNE_EXCLUE {participant} : remède la réintégration ;
 * - PERSONNE_ABSENTE_AU_TOUR {participant, personne, tour} : une
 *   réservation de tour désigné, ou un dépôt dans le retenu, à un tour où la
 *   personne, non exclue, est absente ; personne, son nom affiché ; remède
 *   changerPresence {id, tours}, tours sa présence plus ce tour, croissants
 *   et sans doublon. Une réservation « tous les tours » ne le reçoit
 *   jamais : elle ne tient qu'aux tours de présence ;
 * - PLACE_RESERVEE {table, siege, tour, titulaire, portee} : la réservation
 *   active d'une autre personne tient ce siège à un tour de la pose, dans les
 *   deux modes ; remède le choix d'une place pour la réservation de la
 *   titulaire ;
 * - RESERVEE_AILLEURS {participant, tour, reservation} : dans le retenu, la
 *   personne est réservée à ce tour à une autre table — ou, sièges du retenu
 *   attribués, à un autre siège ; remède le déplacement de sa réservation
 *   vers le dépôt.
 * Les trois premiers ne valent que pour une réservation. Les tours d'une
 * pose ne comptent qu'où la personne est présente : à ses tours d'absence,
 * une pose « tous les tours » n'occupe rien et ne dispute rien aux autres
 * personnes ; seules ses propres réservations s'y excluent encore
 * (DEUX_PLACES_MEME_TOUR). signaux porte
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
  const personne = charge.participants.find(({ id }) => id === participant);
  const exclu = personne !== undefined && personne.exclu;
  // La présence se lit sans l'exclusion, qui a son propre refus.
  const presenteA = (t) => personne === undefined || estPresentAuTour(personne, t);
  const couverts = retenu ? [tour] : toursCouverts(charge, { portee, tour });
  const tenus = couverts.filter(presenteA);
  const presentes = presentesParTour(charge);
  const actives = reservationsActives(charge).filter((r) => depuis === null || !designee(r, participant, depuis));
  const premierCommun = (r) => tenus.find((t) => tientAuTour(r, t, presentes(t)));
  // Les réservations de la personne s'excluent à chaque tour couvert, présente
  // ou non : une présence rendue ensuite les ferait tenir ensemble.
  const premierCouvert = (r) => couverts.find((t) => couvre(r, t));
  const refus = [];

  if (!retenu) {
    for (const t of couverts) {
      const reservees = reserveesAuTour(actives, idTable, t, presentes(t));
      if (!exclu && presenteA(t)) reservees.add(participant);
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
        premierCouvert(r) !== undefined &&
        (r.table !== idTable || (r.siege !== null && siege !== null && r.siege !== siege)),
    );
    if (autre !== undefined) {
      const remede = {
        commande: 'deplacerReservation',
        arguments: { participant, de: designation(autre), vers: { table: idTable, siege } },
      };
      const details = {
        participant,
        tour: premierCouvert(autre),
        autre: { table: autre.table, siege: autre.siege, portee: autre.portee, tour: autre.tour },
      };
      refus.push(refusDe('DEUX_PLACES_MEME_TOUR', details, remede));
    }
  }

  if (exclu) {
    refus.push(refusDe('PERSONNE_EXCLUE', { participant }, { commande: 'reintegrerParticipant', arguments: { id: participant } }));
  }

  if (!exclu && personne !== undefined && (retenu || portee === 'tour') && !presenteA(tour)) {
    const tours = [...new Set([...toursDePresence(personne, charge.evenement.tours), tour])].sort((a, b) => a - b);
    const details = { participant, personne: nomAffiche(personne), tour };
    refus.push(refusDe('PERSONNE_ABSENTE_AU_TOUR', details, { commande: 'changerPresence', arguments: { id: participant, tours } }));
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
        tenus.includes(tour) &&
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

// Les refus qu'opposent les réservations de id, dans la charge apres, aux
// seuls tours gagnes (croissants) où elle se met à tenir : SURRESERVATION
// quand une de ses tables ne peut plus les recevoir, au premier tour gagné
// qui déborde, une fois par table, dans l'ordre de ses réservations ; puis
// PLACE_RESERVEE, une par réservation à un siège qu'une autre personne tient
// à un tour gagné qu'elle couvre.
function refusDesToursGagnes(apres, id, gagnes) {
  const siennes = apres.reservations.filter(({ participant }) => participant === id).sort(ordreDesReservations);
  const refus = [];
  const vues = new Set();
  for (const { table: idTable } of siennes) {
    if (vues.has(idTable)) continue;
    vues.add(idTable);
    const places = capacite(apres, tableDe(apres, idTable));
    const comptes = reservationsParTour(apres, idTable);
    const tour = gagnes.find((t) => comptes[t - 1] > places);
    if (tour !== undefined) {
      const details = { table: idTable, tour, reservees: comptes[tour - 1], capacite: places };
      refus.push(refusDe('SURRESERVATION', details, changerPlaces(idTable, comptes[tour - 1])));
    }
  }
  const presentes = presentesParTour(apres);
  const autres = reservationsActives(apres).filter(({ participant }) => participant !== id);
  for (const sienne of siennes) {
    if (sienne.siege === null) continue;
    const couverts = toursCouverts(apres, sienne).filter((t) => gagnes.includes(t));
    const tenueA = (r) => couverts.find((t) => tientAuTour(r, t, presentes(t)));
    const autre = autres.find((r) => r.table === sienne.table && r.siege === sienne.siege && tenueA(r) !== undefined);
    if (autre !== undefined) refus.push(placeReservee(autre, tenueA(autre)));
  }
  return refus;
}

/**
 * Les refus de la réintégration de id (§ 4.4, § 5.9) : ses réservations
 * suspendues, posées contre les actives, à ses seuls tours de présence (R1).
 * SURRESERVATION quand une table ne peut plus les recevoir, au premier tour
 * qui déborde, une fois par table, dans l'ordre de ses réservations ; puis
 * PLACE_RESERVEE, une par réservation à un siège qu'une autre personne a
 * pris depuis à un tour de présence qu'elle couvre. [] quand rien ne s'y
 * oppose, et pour une personne qui n'est pas exclue.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {number} id
 * @returns {Array<{code: string, details: Object}>}
 */
export function controlerReintegration(charge, id) {
  const exclue = charge.participants.find((personne) => personne.id === id && personne.exclu);
  if (exclue === undefined) return [];
  const apres = {
    ...charge,
    participants: charge.participants.map((personne) => (personne.id === id ? { ...personne, exclu: false } : personne)),
  };
  return refusDesToursGagnes(apres, id, toursDePresence(exclue, charge.evenement.tours));
}

/**
 * Les refus d'une présence qui s'étend (§ 5.9), de la forme de ceux de
 * controlerReintegration, sans rien écrire : pour chaque identifiant de
 * ids, par identifiant croissant, sur les seuls tours où il passe d'absent
 * à présent (R1) entre charge et apres, SURRESERVATION (remède
 * changerPlacesTable) quand une de ses tables ne peut plus recevoir ses
 * réservations à un tour gagné, puis PLACE_RESERVEE (remède le choix d'une
 * place pour la titulaire) quand son siège réservé est tenu par une autre à
 * un tour gagné. Une réservation suspendue par une absence redevient active
 * quand la présence s'étend : ce contrôle refuse le geste avant qu'il
 * n'écrive une surréservation ou un siège réservé deux fois. [] quand rien
 * ne s'y oppose ; le geste refuse sur le premier.
 *
 * @param {import('../stockage/types.js').Charge} charge   avant le geste
 * @param {import('../stockage/types.js').Charge} apres    la charge où la présence a changé
 * @param {number[]} ids
 * @returns {Array<{code: string, details: Object}>}
 */
export function controlerPresence(charge, apres, ids) {
  const R = apres.evenement.tours;
  const avantA = presentesParTour(charge);
  const apresA = presentesParTour(apres);
  const refus = [];
  for (const id of [...ids].sort((a, b) => a - b)) {
    const gagnes = [];
    for (let tour = 1; tour <= R; tour += 1) if (!avantA(tour).has(id) && apresA(tour).has(id)) gagnes.push(tour);
    if (gagnes.length > 0) refus.push(...refusDesToursGagnes(apres, id, gagnes));
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
