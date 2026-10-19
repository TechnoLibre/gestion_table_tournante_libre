// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le départ d'une génération dérivée (§ 5.7, § 8.9, § 14.10), en fonctions
// pures : la filiation qu'une proposition porte (derivationDe), le plan de
// son départ (planDuDepart), le départ ajusté à la présence (departAdapte)
// et ce que le moteur en reçoit (departDuMoteur), les refus que le
// lancement pose avant tout calcul (refusDuDepart), les écarts que la carte
// du départ annonce (ecartsDuDepart, ecartAuRetenu), la recopie des tours
// figés du départ dans le fichier d'une dérivée (recopierPlacement,
// recopierToursFiges) et leur contrôle avant l'enregistrement
// (tourFigeDifferent). Ce module ne lit ni la séance ni l'exécuteur, et ne
// modifie rien de ce qu'il reçoit.
//
// Le départ est une proposition sans faute dont la dérive ne vient que de
// ses participants (raisonsQuiBloquentUnDepart) : une personne ajoutée,
// exclue, supprimée, ou dont la présence a changé. Le moteur part du départ
// ajusté à la présence (ajusterALaPresence) : qui part quitte sa chaise, qui
// arrive attend en réserve aux tours où elle est présente. Ce départ ajusté
// tient les réservations courantes de ses personnes assises : chaque
// réservation couvrante (reservationsCouvrantes : la personne présente au
// tour), à sa table ; et, dans un tour figé, quand le départ et l'événement
// attribuent tous deux les sièges, au siège qu'elle fixe. Une arrivante — une
// personne présente que le départ ajusté laisse en réserve — n'y est pas
// tenue : aux tours non figés, le moteur l'assied à sa table ; à un tour
// figé, il l'assied à une chaise libre de sa table, ou à la meilleure chaise
// libre du tour quand elle est libre, sans déplacer personne, et elle reste
// en réserve quand sa table, ou son siège réservé, n'a plus de place
// (arrivantesSansChaise, que l'application seule décide et passe au moteur).
// Le retenu n'est jamais un départ : il ne porte pas d'identifiant de
// proposition.
//
// Un tour figé se reprend tel quel, chaque table à elle-même, arrivantes
// mises à part. Le schéma ne fixe pas l'ordre des tables qu'un fichier
// déclare, et le départ peut les déclarer dans un autre ordre que la
// dérivée : recopierToursFiges retrouve donc chaque table du fichier dans le
// départ par son identifiant, puis recopie par rang, sur des listes déjà
// dans l'ordre du fichier. tourFigeDifferent, qui contrôle ce qui a été
// recopié, retrouve de même chaque table du départ par son identifiant, et
// ne lit pas les arrivantes.
import { capacite } from '../stockage/document.js';
import { ajusterALaPresence, derive, fautes, planDepuisFichier, raisonsQuiBloquentUnDepart } from '../stockage/placements.js';
import { estPresentAuTour } from '../moteur/presence.js';
import { raisonsNommees } from './avertissements.js';
import { nomAffiche } from './personnes.js';
import { placesTenues, reservationsCouvrantes } from './places.js';
import { sansNullDeFin } from './retenu_lieux.js';

const croissant = (a, b) => a - b;

// Un refus : son code, ses détails, puis le remède, null sans lui.
const refusDe = (code, details, remede) => ({ code, details: { ...details, remede } });

// Les deux remèdes d'un départ : le retirer, ou décocher un tour figé.
const repartirDeZero = () => ({ geste: 'repartirDeZero' });
const libererTour = (tour) => ({ geste: 'libererTour', tour });

// Les détails d'une réservation non tenue, nommés comme une raison de
// dérive : personne et numero s'ajoutent quand la charge les porte.
const nommes = (details, charge) => raisonsNommees([details], charge)[0];

// La proposition d'identifiant id de la charge, ou undefined : une valeur
// qui n'est pas un identifiant de proposition, 'retenu' compris, n'en
// désigne aucune.
const propositionDe = (charge, id) => charge.propositions.find((proposition) => proposition.id === id);

// Vrai quand la proposition sert de départ : sans faute, et sans autre
// dérive que celle de ses participants. derive lève sur une faute : les
// fautes se lisent d'abord.
const sertDeDepart = (proposition, charge) =>
  fautes(proposition).length === 0 && raisonsQuiBloquentUnDepart(derive(proposition, charge)).length === 0;

// Les personnes assises d'un tour de placement : identifiant → rang de sa
// liste de table. Une chaise vide n'y entre pas.
function assisDuTour({ sieges }) {
  const assis = new Map();
  sieges.forEach((liste, rang) => {
    for (const id of liste) if (id !== null) assis.set(id, rang);
  });
  return assis;
}

/**
 * La filiation d'une proposition (C7, D76) : son départ, ses tours figés,
 * et la présence de ce départ dans la liste.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {number|'retenu'} id
 * @returns {{depart: number, toursFiges: number[], departPresent: boolean}|null}
 *   null pour une proposition sans départ, un identifiant absent, et
 *   'retenu' — le retenu désigne sa proposition, qui porte la filiation ;
 *   toursFiges, une copie, [] quand la proposition n'en porte pas
 */
export function derivationDe(charge, id) {
  const proposition = propositionDe(charge, id);
  if (proposition === undefined || !Object.hasOwn(proposition, 'depart')) return null;
  return {
    depart: proposition.depart,
    toursFiges: [...(proposition.toursFiges ?? [])],
    departPresent: propositionDe(charge, proposition.depart) !== undefined,
  };
}

/**
 * Le plan du départ tel qu'il est enregistré, par identifiants
 * (planDepuisFichier) : tables déclarées, listes rangées par identifiant
 * croissant sans chaise vide, réserves rangées. Le moteur reçoit celui du
 * départ ajusté (departDuMoteur).
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {number} id
 * @returns {import('../moteur/types.js').Plan}
 * @throws {TypeError} un identifiant absent de la liste, ou une proposition
 *   fautive
 */
export function planDuDepart(charge, id) {
  const proposition = propositionDe(charge, id);
  if (proposition === undefined) throw new TypeError(`planDuDepart : proposition ${JSON.stringify(id)} absente de la liste`);
  return planDepuisFichier(proposition);
}

/**
 * Le départ ajusté à la présence : la proposition id, alignée sur les
 * participants de la charge par ajusterALaPresence — la chaise de qui part
 * devient vide sous des sièges attribués, sa liste se resserre sinon ; qui
 * arrive est déclaré, en réserve aux tours où il est présent, aux absents
 * ailleurs. Sans changement de participants, une copie du départ. Une
 * proposition neuve, rien de partagé avec la charge.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {number} id
 * @returns {import('../stockage/types.js').PropositionFichier}
 * @throws {TypeError} un identifiant absent de la liste, ou une proposition
 *   fautive
 */
export function departAdapte(charge, id) {
  const proposition = propositionDe(charge, id);
  if (proposition === undefined) throw new TypeError(`departAdapte : proposition ${JSON.stringify(id)} absente de la liste`);
  return ajusterALaPresence(proposition, charge).placement;
}

// Lève TypeError quand toursFiges n'est pas une liste d'entiers ≥ 1
// strictement croissante : l'état de navigation la garde ainsi, et une autre
// forme est une faute de l'appelant, non un refus.
function exigerToursFiges(toursFiges) {
  const forme =
    Array.isArray(toursFiges) &&
    toursFiges.every((tour, rang) => Number.isSafeInteger(tour) && tour >= 1 && (rang === 0 || tour > toursFiges[rang - 1]));
  if (!forme) throw new TypeError(`refusDuDepart : tours figés croissants ≥ 1 attendus, reçu ${JSON.stringify(toursFiges)}`);
}

// La première réservation couvrante qu'une liste du départ ajusté ne tient
// pas à sa table, tour par tour, dans l'ordre canonique des réservations à
// chaque tour ; null quand il les tient toutes. Une arrivante, que le départ
// ajusté n'assied pas à ce tour, est sautée. Une table que le départ ne
// déclare pas ne tient personne.
function reservationNonTenue(charge, adapte) {
  for (let tour = 1; tour <= adapte.tours; tour += 1) {
    const assis = assisDuTour(adapte.placement[tour - 1]);
    for (const { participant, table } of reservationsCouvrantes(charge, tour)) {
      if (!assis.has(participant) || adapte.tables[assis.get(participant)] === table) continue;
      return refusDe(
        'DEPART_RESERVATION_NON_TENUE',
        nommes({ depart: adapte.id, participant, table, tour }, charge),
        repartirDeZero(),
      );
    }
  }
  return null;
}

// Le premier siège réservé qu'un tour figé du départ ajusté ne tient pas,
// sous sièges attribués du départ et de l'événement ; null sinon. Les sièges
// tenus suivent la règle de l'affichage (placesTenues) : la première
// réservation couvrante de chaque siège dans la capacité courante. Par tour
// figé croissant, dans l'ordre des tables du départ, par siège croissant. La
// personne est déjà à sa table : reservationNonTenue passe avant. Une
// arrivante est sautée : son siège est l'affaire d'arrivantesSansChaise.
function siegeNonTenu(charge, adapte, toursFiges) {
  if (!adapte.siegesAttribues || !charge.reglages.attribuerSieges) return null;
  const enregistrementDe = new Map(charge.tables.map((enregistrement) => [enregistrement.id, enregistrement]));
  for (const tour of toursFiges) {
    const listes = adapte.placement[tour - 1].sieges;
    const assis = assisDuTour(adapte.placement[tour - 1]);
    const couvrantes = reservationsCouvrantes(charge, tour);
    for (const [rang, table] of adapte.tables.entries()) {
      const { tenu } = placesTenues(
        couvrantes.filter((reservation) => reservation.table === table),
        capacite(charge, enregistrementDe.get(table)),
      );
      for (const siege of [...tenu.keys()].sort(croissant)) {
        const { participant } = tenu.get(siege);
        if (!assis.has(participant) || listes[rang][siege - 1] === participant) continue;
        return refusDe(
          'DEPART_SIEGE_NON_TENU',
          nommes({ depart: adapte.id, participant, table, siege, tour }, charge),
          libererTour(tour),
        );
      }
    }
  }
  return null;
}

/**
 * Le premier refus que le lancement d'une génération dérivée pose, avant
 * tout calcul (C6, C24, D72, D73), dans cet ordre :
 * DEPART_ABSENT {depart} ; DEPART_NON_COMPARABLE {depart, statut, raisons}
 * — statut 'fautif', ses fautes, ou 'derive', ses raisons de dérive qui ne
 * viennent pas des participants (raisonsQuiBloquentUnDepart : tables,
 * capacités, tours), nommées ; une dérive de participants seule n'est pas
 * refusée, le départ s'ajuste à la présence ; TOUR_FIGE_HORS_SOIREE {tour,
 * tours}, le premier tour figé au-delà de la soirée ; TOURS_FIGES_TOUS
 * {tours} ; DEPART_RESERVATION_NON_TENUE {depart, participant, table, tour},
 * à n'importe quel tour ; DEPART_SIEGE_NON_TENU {depart, participant, table,
 * siege, tour}, dans un tour figé seulement. Ces deux derniers se lisent sur
 * le départ ajusté et sautent les arrivantes ; ils portent en plus personne
 * et numero quand la charge les a. Chaque refus porte son remède dans
 * details.remede : repartirDeZero, libererTour {tour} pour un tour figé,
 * null pour tous les tours figés.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {{id: number|'retenu', toursFiges: number[]}} depart
 * @returns {{code: string, details: Object}|null}
 * @throws {TypeError} des tours figés qui ne sont pas une liste d'entiers ≥ 1
 *   strictement croissante
 */
export function refusDuDepart(charge, { id, toursFiges }) {
  exigerToursFiges(toursFiges);
  const depart = propositionDe(charge, id);
  if (depart === undefined) return refusDe('DEPART_ABSENT', { depart: id }, repartirDeZero());
  const sesFautes = fautes(depart);
  if (sesFautes.length > 0) {
    return refusDe('DEPART_NON_COMPARABLE', { depart: id, statut: 'fautif', raisons: sesFautes }, repartirDeZero());
  }
  const raisons = raisonsQuiBloquentUnDepart(derive(depart, charge));
  if (raisons.length > 0) {
    return refusDe(
      'DEPART_NON_COMPARABLE',
      { depart: id, statut: 'derive', raisons: raisonsNommees(raisons, charge) },
      repartirDeZero(),
    );
  }
  const { tours } = charge.evenement;
  const horsSoiree = toursFiges.find((tour) => tour > tours);
  if (horsSoiree !== undefined) return refusDe('TOUR_FIGE_HORS_SOIREE', { tour: horsSoiree, tours }, libererTour(horsSoiree));
  if (toursFiges.length === tours) return refusDe('TOURS_FIGES_TOUS', { tours }, null);
  const adapte = ajusterALaPresence(depart, charge).placement;
  return reservationNonTenue(charge, adapte) ?? siegeNonTenu(charge, adapte, toursFiges);
}

// Les arrivantes réservées d'un tour figé du départ ajusté — présentes, en
// réserve au départ ajusté, tenues à une table par une réservation
// couvrante —, par identifiant croissant : { participant, siege, cause }.
// siege est le siège que sa réservation tient (placesTenues), sous sièges
// attribués du départ et de l'événement, undefined sinon ; cause vaut
// 'table' quand les occupants de sa table au départ ajusté, plus les
// arrivantes admises avant elle à cette table, en atteignent la capacité
// courante ; 'siege' quand son siège tenu est occupé au départ ajusté ; null
// quand elle a sa chaise, et elle est alors admise. Une arrivante libre n'y
// figure pas : preparer garantit une chaise libre à chaque présente.
function arrivantesReservees(charge, adapte, tour) {
  const parSiege = adapte.siegesAttribues && charge.reglages.attribuerSieges;
  const enregistrementDe = new Map(charge.tables.map((enregistrement) => [enregistrement.id, enregistrement]));
  const { sieges: listes, reserve } = adapte.placement[tour - 1];
  const couvrantes = reservationsCouvrantes(charge, tour);
  // La première réservation couvrante de chacun, dans l'ordre canonique :
  // lue à rebours, la première écrase les suivantes.
  const reservationDe = new Map([...couvrantes].reverse().map((reservation) => [reservation.participant, reservation]));
  const admises = new Map();
  const rendues = [];
  for (const participant of [...reserve].sort(croissant)) {
    const reservation = reservationDe.get(participant);
    if (reservation === undefined) continue;
    const { table } = reservation;
    const liste = listes[adapte.tables.indexOf(table)];
    const places = capacite(charge, enregistrementDe.get(table));
    const avant = admises.get(table) ?? 0;
    const siege = parSiege
      ? placesTenues(couvrantes.filter((autre) => autre.table === table), places).siegeDe.get(participant)
      : undefined;
    let cause = null;
    if (liste.filter((id) => id !== null).length + avant >= places) cause = 'table';
    else if (siege !== undefined && siege <= liste.length && liste[siege - 1] !== null) cause = 'siege';
    if (cause === null) admises.set(table, avant + 1);
    rendues.push({ participant, siege, cause });
  }
  return rendues;
}

/**
 * Les arrivantes réservées d'un départ ajusté que ses tours figés ne peuvent
 * pas asseoir, personne d'autre n'y bougeant (§ 5.7) : à chaque tour figé
 * croissant, chaque arrivante — présente au tour, en réserve au départ
 * ajusté —, par identifiant croissant, avec sa cause : 'table' quand elle
 * est réservée à une table dont les occupants du départ ajusté, plus les
 * arrivantes déjà admises à cette table ce tour, atteignent la capacité
 * courante ; 'siege' quand, sous sièges attribués du départ et de
 * l'événement, son siège tenu (placesTenues) n'est pas vide au départ
 * ajusté. Une arrivante libre n'y figure jamais : chaque tour a assez de
 * places pour ses présentes. Le moteur garde chacune en réserve à son tour
 * (reservesImposees). Pure.
 *
 * Le départ ajusté est celui d'un départ que refusDuDepart accepte : ses
 * tables sont celles de la charge, et toursFiges ne dépasse pas la soirée.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {import('../stockage/types.js').PropositionFichier} adapte   departAdapte
 * @param {number[]} toursFiges   croissants
 * @returns {Array<{participant: number, tour: number, cause: 'table'|'siege'}>}
 *   triées par tour puis par participant
 */
export function arrivantesSansChaise(charge, adapte, toursFiges) {
  return toursFiges.flatMap((tour) =>
    arrivantesReservees(charge, adapte, tour)
      .filter(({ cause }) => cause !== null)
      .map(({ participant, cause }) => ({ participant, tour, cause })),
  );
}

/**
 * Les sièges que la recopie d'un tour figé donne aux arrivantes admises
 * (recopierToursFiges) : par tour figé, une Map participant → siège tenu par
 * sa réservation, sous sièges attribués du départ et de l'événement ; une
 * Map vide sinon, ou quand aucune admise n'a de siège tenu. Une arrivante
 * qu'arrivantesSansChaise garde en réserve n'y figure pas. Pure.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {import('../stockage/types.js').PropositionFichier} adapte   departAdapte
 * @param {number[]} toursFiges
 * @returns {Map<number, Map<number, number>>}
 */
export function siegesDesArrivantes(charge, adapte, toursFiges) {
  return new Map(
    toursFiges.map((tour) => [
      tour,
      new Map(
        arrivantesReservees(charge, adapte, tour)
          .filter(({ siege, cause }) => cause === null && siege !== undefined)
          .map(({ participant, siege }) => [participant, siege]),
      ),
    ]),
  );
}

/**
 * Le départ que le moteur reçoit (repartir, regenerer, les messages du
 * travailleur) : le plan du départ ajusté (planDepuisFichier, sans
 * absents), une copie des tours figés, et les réserves imposées
 * (arrivantesSansChaise, sans leur cause), triées par tour puis participant.
 * Sans changement de participants, le plan du départ et aucune réserve
 * imposée.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {{id: number, toursFiges: number[]}} depart   accepté par refusDuDepart
 * @returns {{plan: import('../moteur/types.js').Plan, toursFiges: number[],
 *            reservesImposees: Array<{participant: number, tour: number}>}}
 */
export function departDuMoteur(charge, { id, toursFiges }) {
  const adapte = departAdapte(charge, id);
  return {
    plan: planDepuisFichier(adapte),
    toursFiges: [...toursFiges],
    reservesImposees: arrivantesSansChaise(charge, adapte, toursFiges).map(({ participant, tour }) => ({ participant, tour })),
  };
}

/**
 * Les écarts du départ à la soirée, que la carte du départ montre avant le
 * lancement : une ligne par personne qui en a, par identifiant croissant,
 * { participant, personne, entrees, entreesFigees, enReserveFigee, sorties }
 * — entrees, les tours non figés où elle est présente sans que le départ
 * ajusté l'asseye ; entreesFigees, les tours figés où le moteur l'assiéra à
 * la meilleure chaise libre ; enReserveFigee, [{tour, cause}], ses réserves
 * imposées (arrivantesSansChaise) ; sorties, les tours où le départ
 * l'assied alors qu'elle est absente, exclue ou supprimée. personne est son
 * nom affiché, null pour une supprimée. Chaque liste de tours est
 * croissante. [] sans écart, et pour un départ absent, fautif ou dont la
 * dérive ne vient pas que des participants. Un tour figé au-delà de la
 * soirée ne compte pas.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {{id: number, toursFiges: number[]}} depart
 * @returns {Array<{participant: number, personne: string|null, entrees: number[], entreesFigees: number[],
 *            enReserveFigee: Array<{tour: number, cause: 'table'|'siege'}>, sorties: number[]}>}
 */
export function ecartsDuDepart(charge, { id, toursFiges }) {
  const depart = propositionDe(charge, id);
  if (depart === undefined || !sertDeDepart(depart, charge)) return [];
  const adapte = ajusterALaPresence(depart, charge).placement;
  const figes = toursFiges.filter((tour) => tour <= adapte.tours);
  const imposees = new Map(arrivantesSansChaise(charge, adapte, figes).map(({ participant, tour, cause }) => [`${participant}|${tour}`, cause]));
  const personneDe = new Map(charge.participants.map((personne) => [personne.id, personne]));
  const ecarts = new Map();
  const ecartDe = (participant) => {
    if (!ecarts.has(participant)) ecarts.set(participant, { entrees: [], entreesFigees: [], enReserveFigee: [], sorties: [] });
    return ecarts.get(participant);
  };
  for (let tour = 1; tour <= adapte.tours; tour += 1) {
    for (const participant of adapte.placement[tour - 1].reserve) {
      const cause = imposees.get(`${participant}|${tour}`);
      if (!figes.includes(tour)) ecartDe(participant).entrees.push(tour);
      else if (cause === undefined) ecartDe(participant).entreesFigees.push(tour);
      else ecartDe(participant).enReserveFigee.push({ tour, cause });
    }
    for (const participant of depart.placement[tour - 1].sieges.flat()) {
      const personne = personneDe.get(participant);
      const sort = participant !== null && (personne === undefined || personne.exclu || !estPresentAuTour(personne, tour));
      if (sort) ecartDe(participant).sorties.push(tour);
    }
  }
  return [...ecarts.keys()].sort(croissant).map((participant) => {
    const personne = personneDe.get(participant);
    return { participant, personne: personne === undefined ? null : nomAffiche(personne), ...ecarts.get(participant) };
  });
}

// La lecture d'une liste de table pour la comparer : sous sièges attribués,
// la liste dans l'ordre des sièges, chaque identifiant d'ecartes changé en
// chaise vide et les chaises vides de fin retirées ; sinon ses occupants
// hors d'ecartes, rangés. Une chaîne, que deux listes égales partagent.
function lecture(ordonnee, ecartes) {
  if (ordonnee) {
    return (liste) => {
      const lue = liste.map((id) => (ecartes.has(id) ? null : id));
      sansNullDeFin(lue);
      return JSON.stringify(lue);
    };
  }
  return (liste) => JSON.stringify(liste.filter((id) => id !== null && !ecartes.has(id)).sort(croissant));
}

// Vrai quand une table du départ n'a pas, dans p au tour, les occupants que
// lue lit dans le départ : chaque table se compare à elle-même, par son
// identifiant, et une table que p ne déclare pas diffère.
function tablesDifferent(p, depart, tour, lue) {
  const listes = p.placement[tour - 1].sieges;
  const listesDuDepart = depart.placement[tour - 1].sieges;
  return depart.tables.some((table, rang) => {
    const ici = p.tables.indexOf(table);
    return ici < 0 || lue(listes[ici]) !== lue(listesDuDepart[rang]);
  });
}

/**
 * Les tours figés où le retenu diffère du départ ajusté (§ 5.7), quand le
 * retenu a été retenu de ce départ (retenu.proposition === id) : occupants
 * de chaque table, par identifiant de table, et réserve ; dans l'ordre des
 * chaises quand le retenu et le départ attribuent tous deux les sièges, la
 * chaise vide de fin ne comptant pas. La comparaison est stricte : une
 * personne retirée du tour à la main, sa chaise laissée libre, fait un
 * écart. Une personne qui quitte un tour puis y revient en fait un aussi,
 * puisque le retenu, ajusté geste après geste, l'attend en réserve là où le
 * départ, ajusté d'un coup, l'assied encore à sa chaise.
 * [] sans retenu, quand il vient d'une autre proposition, quand le départ a
 * quitté la liste, et pour un retenu ou un départ fautif : aucune
 * comparaison. Un tour figé au-delà du retenu ou du départ ne compte pas.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {{id: number, toursFiges: number[]}} depart
 * @returns {number[]}   croissants
 */
export function ecartAuRetenu(charge, { id, toursFiges }) {
  const { retenu } = charge;
  const depart = propositionDe(charge, id);
  if (retenu === null || retenu.proposition !== id || depart === undefined) return [];
  if (fautes(retenu).length > 0 || fautes(depart).length > 0) return [];
  const adapte = ajusterALaPresence(depart, charge).placement;
  const ordonnee = retenu.siegesAttribues && adapte.siegesAttribues;
  return toursFiges.filter((tour) => {
    if (tour > Math.min(retenu.tours, adapte.tours)) return false;
    const reserveLue = (p) => JSON.stringify([...p.placement[tour - 1].reserve].sort(croissant));
    return tablesDifferent(retenu, adapte, tour, lecture(ordonnee, new Set())) || reserveLue(retenu) !== reserveLue(adapte);
  });
}

// Un tour de placement neuf : les listes et la réserve de source, copiées,
// puis les absents de entree quand il en porte.
function copieDuTour({ sieges, reserve }, { absents }) {
  const tour = { sieges: sieges.map((liste) => [...liste]), reserve: [...reserve] };
  if (absents !== undefined) tour.absents = [...absents];
  return tour;
}

/**
 * Un placement dont chaque tour figé est recopié du départ (D72) : ses
 * listes de table, ordre et chaises vides compris, et sa réserve ; les
 * autres tours tels quels. Chaque tour garde ses absents, ceux du placement
 * reçu : le départ ajusté et le fichier les tirent de la même charge.
 * Placement d'un fichier comme d'un point de relevé, de la forme du schéma :
 * une entrée par tour, {sieges, reserve, absents?}. La recopie va par rang :
 * placementDuDepart range ses listes dans l'ordre des tables de placement.
 * Pour un point de relevé, qui déclare les tables de sa proposition, le
 * placement du fichier recopié (recopierToursFiges) l'est déjà. Rend des
 * listes neuves ; ne modifie pas ses arguments.
 *
 * @param {{sieges: Array<Array<number|null>>, reserve: number[], absents?: number[]}[]} placement
 * @param {{sieges: Array<Array<number|null>>, reserve: number[]}[]} placementDuDepart
 * @param {number[]} toursFiges
 * @returns {{sieges: Array<Array<number|null>>, reserve: number[], absents?: number[]}[]}
 */
export function recopierPlacement(placement, placementDuDepart, toursFiges) {
  const figes = new Set(toursFiges);
  return placement.map((entree, rang) => copieDuTour(figes.has(rang + 1) ? placementDuDepart[rang] : entree, entree));
}

// Le placement du départ, ses listes dans l'ordre des tables du fichier :
// chaque table du fichier prend la liste que le départ lui donne. Une table
// que le départ ne déclare pas garde la liste du fichier ; tourFigeDifferent
// signale alors la table du départ que le fichier n'a pas.
function placementDansOrdreDe(fichier, fichierDuDepart) {
  const rangDe = new Map(fichierDuDepart.tables.map((table, rang) => [table, rang]));
  return fichierDuDepart.placement.map(({ sieges, reserve }, tour) => ({
    sieges: fichier.tables.map((table, ici) =>
      rangDe.has(table) ? sieges[rangDe.get(table)] : fichier.placement[tour].sieges[ici],
    ),
    reserve,
  }));
}

// Un tour figé de la dérivée, où personne d'autre ne bouge (§ 5.7) : les
// listes du départ, dans l'ordre des tables du fichier, où entrent les
// arrivantes — en réserve au départ — que le moteur assied dans entree,
// chacune à la table qu'il lui donne : d'abord celles dont siegeDe porte
// le siège tenu, à ce siège quand il est vide ; puis les autres, par
// identifiant croissant, à la première chaise vide de la liste, sinon en
// fin de liste. La réserve est celle du départ, moins les arrivantes
// assises : une réserve imposée y reste. Les absents sont ceux d'entree.
function tourFige(entree, duDepart, siegeDe) {
  const tour = copieDuTour(duDepart, entree);
  const arrivantes = new Set(duDepart.reserve);
  const assises = [];
  entree.sieges.forEach((liste, rang) => {
    for (const id of liste) if (arrivantes.has(id)) assises.push({ id, rang });
  });
  assises.sort((a, b) => a.id - b.id);
  const ailleurs = [];
  for (const { id, rang } of assises) {
    const liste = tour.sieges[rang];
    const siege = siegeDe.get(id);
    if (siege !== undefined && (siege > liste.length || liste[siege - 1] === null)) {
      while (liste.length < siege) liste.push(null);
      liste[siege - 1] = id;
    } else {
      ailleurs.push({ id, rang });
    }
  }
  for (const { id, rang } of ailleurs) {
    const liste = tour.sieges[rang];
    const vide = liste.indexOf(null);
    if (vide >= 0) liste[vide] = id;
    else liste.push(id);
  }
  const placees = new Set(assises.map(({ id }) => id));
  tour.reserve = tour.reserve.filter((id) => !placees.has(id));
  return tour;
}

/**
 * Le fichier d'une dérivée dont les tours figés reprennent les listes du
 * départ — le départ ajusté à la présence : quand le fichier et le départ
 * attribuent tous deux les sièges, un fichier neuf dont chaque tour figé
 * reprend, table par table quel que soit l'ordre où chacun déclare ses
 * tables, la liste du départ, ses arrivantes posées à la table que le moteur
 * leur donne (au siège que sieges.get(tour) leur tient d'abord, puis à la
 * première chaise vide, sinon en fin de liste) et retirées de la réserve,
 * où une réserve imposée reste ; les autres tours tels quels. Sinon le
 * fichier lui-même, ses listes rangées comme toute proposition.
 *
 * @param {import('../stockage/types.js').PropositionFichier} fichier
 * @param {import('../stockage/types.js').PropositionFichier} fichierDuDepart   le départ ajusté
 * @param {number[]} toursFiges
 * @param {Map<number, Map<number, number>>} [sieges]   siegesDesArrivantes ;
 *        aucun siège tenu par défaut
 * @returns {import('../stockage/types.js').PropositionFichier}
 */
export function recopierToursFiges(fichier, fichierDuDepart, toursFiges, sieges = new Map()) {
  if (!fichier.siegesAttribues || !fichierDuDepart.siegesAttribues) return fichier;
  const duDepart = placementDansOrdreDe(fichier, fichierDuDepart);
  const figes = new Set(toursFiges);
  return {
    ...fichier,
    placement: fichier.placement.map((entree, rang) =>
      figes.has(rang + 1) ? tourFige(entree, duDepart[rang], sieges.get(rang + 1) ?? new Map()) : copieDuTour(entree, entree),
    ),
  };
}

/**
 * Le premier tour figé où une table du départ n'a pas, dans le fichier, les
 * occupants qu'elle a dans le départ — dans le même ordre, chaises vides
 * comprises sauf en fin de liste, quand les deux attribuent les sièges et
 * que la recopie a eu lieu ; comme ensemble sinon. Les arrivantes du tour —
 * en réserve au départ, que le moteur assied ou garde en réserve — ne
 * comptent pas : leur chaise se lit vide. Chaque table se compare à
 * elle-même, par son identifiant : deux tables échangées diffèrent, bien que
 * le tour garde ses occupants. Un point de relevé se contrôle en passant
 * {...fichier, placement: releve.placement}.
 *
 * @param {import('../stockage/types.js').PropositionFichier} fichier
 * @param {import('../stockage/types.js').PropositionFichier} fichierDuDepart   le départ ajusté
 * @param {number[]} toursFiges
 * @returns {number|null}   le tour, null quand chaque tour figé est celui du départ
 */
export function tourFigeDifferent(fichier, fichierDuDepart, toursFiges) {
  const ordonnee = fichier.siegesAttribues && fichierDuDepart.siegesAttribues;
  for (const tour of toursFiges) {
    const lue = lecture(ordonnee, new Set(fichierDuDepart.placement[tour - 1].reserve));
    if (tablesDifferent(fichier, fichierDuDepart, tour, lue)) return tour;
  }
  return null;
}
