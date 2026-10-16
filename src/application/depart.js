// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le départ d'une génération dérivée (§ 5.7, § 8.9, § 14.10), en fonctions
// pures : la filiation qu'une proposition porte (derivationDe), le plan de
// son départ (planDuDepart), les refus que le lancement pose avant tout
// calcul (refusDuDepart), la recopie des tours figés du départ dans le
// fichier d'une dérivée (recopierPlacement, recopierToursFiges) et leur
// contrôle avant l'enregistrement (tourFigeDifferent). Ce module ne lit ni
// la séance ni l'exécuteur, et ne modifie rien de ce qu'il reçoit.
//
// Le départ est une proposition comparable — sans faute, sans dérive — qui
// tient les réservations courantes : chaque réservation active, à chaque
// tour qu'elle couvre, à sa table ; et, dans un tour figé, quand le départ
// et l'événement attribuent tous deux les sièges, au siège qu'elle fixe. Le
// retenu n'est jamais un départ : il ne porte pas d'identifiant de
// proposition, et rien ici ne le lit.
//
// Un tour figé se reprend tel quel, chaque table à elle-même. Le schéma ne
// fixe pas l'ordre des tables qu'un fichier déclare, et le départ peut les
// déclarer dans un autre ordre que la dérivée : recopierToursFiges retrouve
// donc chaque table du fichier dans le départ par son identifiant, puis
// recopie par rang (recopierPlacement), sur des listes déjà dans l'ordre du
// fichier. tourFigeDifferent, qui contrôle ce qui a été recopié, retrouve de
// même chaque table du départ par son identifiant.
import { capacite } from '../stockage/document.js';
import { derive, fautes, planDepuisFichier } from '../stockage/placements.js';
import { raisonsNommees } from './avertissements.js';
import { couvre, placesTenues, reservationsActives } from './places.js';

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
 * Le plan du départ, par identifiants (planDepuisFichier) : tables
 * déclarées, listes rangées par identifiant croissant sans chaise vide,
 * réserves rangées.
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

// Lève TypeError quand toursFiges n'est pas une liste d'entiers ≥ 1
// strictement croissante : l'état de navigation la garde ainsi, et une autre
// forme est une faute de l'appelant, non un refus.
function exigerToursFiges(toursFiges) {
  const forme =
    Array.isArray(toursFiges) &&
    toursFiges.every((tour, rang) => Number.isSafeInteger(tour) && tour >= 1 && (rang === 0 || tour > toursFiges[rang - 1]));
  if (!forme) throw new TypeError(`refusDuDepart : tours figés croissants ≥ 1 attendus, reçu ${JSON.stringify(toursFiges)}`);
}

// La première réservation active qu'une liste du départ ne tient pas à sa
// table, tour par tour, dans l'ordre canonique des réservations à chaque
// tour ; null quand le départ les tient toutes. Une table que le départ ne
// déclare pas ne tient personne.
function reservationNonTenue(charge, depart) {
  const actives = reservationsActives(charge);
  for (let tour = 1; tour <= depart.tours; tour += 1) {
    const listes = depart.placement[tour - 1].sieges;
    for (const { participant, table, ...portee } of actives) {
      if (!couvre(portee, tour)) continue;
      const rang = depart.tables.indexOf(table);
      if (rang >= 0 && listes[rang].includes(participant)) continue;
      return refusDe(
        'DEPART_RESERVATION_NON_TENUE',
        nommes({ depart: depart.id, participant, table, tour }, charge),
        repartirDeZero(),
      );
    }
  }
  return null;
}

// Le premier siège réservé qu'un tour figé du départ ne tient pas, sous
// sièges attribués du départ et de l'événement ; null sinon. Les sièges
// tenus suivent la règle de l'affichage (placesTenues) : la première
// réservation de chaque siège dans la capacité courante. Par tour figé
// croissant, dans l'ordre des tables du départ, par siège croissant. La
// personne est déjà à sa table : reservationNonTenue passe avant.
function siegeNonTenu(charge, depart, toursFiges) {
  if (!depart.siegesAttribues || !charge.reglages.attribuerSieges) return null;
  const actives = reservationsActives(charge);
  const enregistrementDe = new Map(charge.tables.map((enregistrement) => [enregistrement.id, enregistrement]));
  for (const tour of toursFiges) {
    const listes = depart.placement[tour - 1].sieges;
    for (const [rang, table] of depart.tables.entries()) {
      const couvrantes = actives.filter((reservation) => reservation.table === table && couvre(reservation, tour));
      const { tenu } = placesTenues(couvrantes, capacite(charge, enregistrementDe.get(table)));
      for (const siege of [...tenu.keys()].sort(croissant)) {
        const { participant } = tenu.get(siege);
        if (listes[rang][siege - 1] === participant) continue;
        return refusDe(
          'DEPART_SIEGE_NON_TENU',
          nommes({ depart: depart.id, participant, table, siege, tour }, charge),
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
 * — statut 'fautif', ses fautes, ou 'derive', ses raisons de dérive
 * nommées ; TOUR_FIGE_HORS_SOIREE {tour, tours}, le premier tour figé
 * au-delà de la soirée ; TOURS_FIGES_TOUS {tours} ;
 * DEPART_RESERVATION_NON_TENUE {depart, participant, table, tour}, à
 * n'importe quel tour ; DEPART_SIEGE_NON_TENU {depart, participant, table,
 * siege, tour}, dans un tour figé seulement. Les deux derniers portent en
 * plus personne et numero quand la charge les a. Chaque refus porte son
 * remède dans details.remede : repartirDeZero, libererTour {tour} pour un
 * tour figé, null pour tous les tours figés.
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
  const raisons = derive(depart, charge);
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
  return reservationNonTenue(charge, depart) ?? siegeNonTenu(charge, depart, toursFiges);
}

/**
 * Un placement dont chaque tour figé est recopié du départ (D72) : ses
 * listes de table, ordre et chaises vides compris, et sa réserve ; les
 * autres tours tels quels. Placement d'un fichier comme d'un point de
 * relevé, de la forme du schéma : une entrée par tour, {sieges, reserve}.
 * La recopie va par rang : placementDuDepart range ses listes dans l'ordre
 * des tables de placement. Pour un point de relevé, qui déclare les tables
 * de sa proposition, le placement du fichier recopié (recopierToursFiges)
 * l'est déjà. Rend des listes neuves ; ne modifie pas ses arguments.
 *
 * @param {{sieges: Array<Array<number|null>>, reserve: number[]}[]} placement
 * @param {{sieges: Array<Array<number|null>>, reserve: number[]}[]} placementDuDepart
 * @param {number[]} toursFiges
 * @returns {{sieges: Array<Array<number|null>>, reserve: number[]}[]}
 */
export function recopierPlacement(placement, placementDuDepart, toursFiges) {
  const figes = new Set(toursFiges);
  return placement.map((entree, rang) => {
    const { sieges, reserve } = figes.has(rang + 1) ? placementDuDepart[rang] : entree;
    return { sieges: sieges.map((liste) => [...liste]), reserve: [...reserve] };
  });
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

/**
 * Le fichier d'une dérivée dont les tours figés reprennent les listes du
 * départ : quand le fichier et celui du départ attribuent tous deux les
 * sièges, un fichier neuf au placement recopié (recopierPlacement), chaque
 * table recevant la liste que le départ donne à la même table, quel que soit
 * l'ordre où chacun déclare ses tables ; sinon le fichier lui-même, ses
 * listes rangées comme toute proposition.
 *
 * @param {import('../stockage/types.js').PropositionFichier} fichier
 * @param {import('../stockage/types.js').PropositionFichier} fichierDuDepart
 * @param {number[]} toursFiges
 * @returns {import('../stockage/types.js').PropositionFichier}
 */
export function recopierToursFiges(fichier, fichierDuDepart, toursFiges) {
  if (!fichier.siegesAttribues || !fichierDuDepart.siegesAttribues) return fichier;
  return {
    ...fichier,
    placement: recopierPlacement(fichier.placement, placementDansOrdreDe(fichier, fichierDuDepart), toursFiges),
  };
}

/**
 * Le premier tour figé où une table du départ n'a pas, dans le fichier, les
 * occupants qu'elle a dans le départ — dans le même ordre, chaises vides
 * comprises, quand les deux attribuent les sièges et que la recopie a eu
 * lieu ; comme ensemble sinon. Chaque table se compare à elle-même, par son
 * identifiant : deux tables échangées diffèrent, bien que le tour garde ses
 * occupants. Un point de relevé se contrôle en passant {...fichier,
 * placement: releve.placement}.
 *
 * @param {import('../stockage/types.js').PropositionFichier} fichier
 * @param {import('../stockage/types.js').PropositionFichier} fichierDuDepart
 * @param {number[]} toursFiges
 * @returns {number|null}   le tour, null quand chaque tour figé est celui du départ
 */
export function tourFigeDifferent(fichier, fichierDuDepart, toursFiges) {
  const ordonnee = fichier.siegesAttribues && fichierDuDepart.siegesAttribues;
  const lue = ordonnee
    ? (liste) => JSON.stringify(liste)
    : (liste) => JSON.stringify(liste.filter((id) => id !== null).sort(croissant));
  for (const tour of toursFiges) {
    const listes = fichier.placement[tour - 1].sieges;
    const listesDuDepart = fichierDuDepart.placement[tour - 1].sieges;
    const differe = fichierDuDepart.tables.some((table, rang) => {
      const ici = fichier.tables.indexOf(table);
      return ici < 0 || lue(listes[ici]) !== lue(listesDuDepart[rang]);
    });
    if (differe) return tour;
  }
  return null;
}
