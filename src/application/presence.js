// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La présence par tour d'une personne, côté commandes (§ 4, § 5.8, § 8.2,
// § 9) : la commande changerPresence, son registre COMMANDES_PRESENCE, que
// commandes.js réunit aux autres, et ce que les commandes qui changent les
// participants partagent avec elle — la lecture d'une saisie de tours,
// l'ajustement du retenu et les avertissements qui en naissent. Ses imports
// n'atteignent jamais commandes.js : le registre réuni dépend de lui, non
// l'inverse.
//
// Une personne est présente au tour r quand elle est dans la charge, non
// exclue, et que sa présence porte r (R1, places.js) : son masque est la
// liste de ces tours, de 1 à R. Le retenu suit qui est là : chaque geste qui
// change un masque l'ajuste dans la même entrée (retenuAuxPresences), et
// seules les personnes dont le masque change y bougent. Une partante quitte
// sa place aux tours qu'elle perd et y devient absente ; une arrivante
// attend en réserve aux tours qu'elle gagne ; une personne exclue ou
// supprimée quitte chaque tour, joués compris. Personne d'autre ne change
// de chaise (§ 5.8). L'ajustement ne passe pas par le vérificateur des
// retouches : une réservation que l'arrivante ne tient pas en réserve se dit
// RESERVATION_NON_HONOREE après le geste, sans le refuser.
import { pourvoyeursDesTitres } from '../csv/import.js';
import { estPresentAuTour, presenceCanonique } from '../moteur/presence.js';
import { ajusterALaPresence, fautes } from '../stockage/placements.js';
import { refus } from './erreurs.js';
import { libelle } from './libelles.js';
import { nomAffiche } from './personnes.js';
import { couvre, presenceSaisie } from './places.js';
import { controlerPresence, leverRefus } from './pose.js';

const croissant = (a, b) => a - b;

// Un avertissement : il n'empêche rien.
const avertissement = (code, details) => ({ code, details });

/**
 * Une saisie de tours de présence : null pour « tous les tours », ou une
 * liste d'entiers de 1 à R strictement croissante, rendue copiée ; [] passe,
 * et l'appelant le refuse PRESENCE_VIDE. Toute autre forme est une faute du
 * code : l'interface n'offre qu'une case par tour.
 *
 * @param {unknown} tours
 * @param {number} R
 * @returns {number[]|null}
 * @throws {TypeError}
 */
export function lireTours(tours, R) {
  if (tours === null) return null;
  const lisible =
    Array.isArray(tours) &&
    tours.every((tour, rang) => Number.isSafeInteger(tour) && tour >= 1 && tour <= R && (rang === 0 || tour > tours[rang - 1]));
  if (!lisible) {
    throw new TypeError(`tours : null ou liste strictement croissante de tours de 1 à ${R} attendue, reçu ${JSON.stringify(tours)}`);
  }
  return [...tours];
}

// Le masque de chaque personne de la charge (R1) : identifiant → texte de
// ses tours de présence, de 1 à R ; vide pour une exclue.
function masques(charge) {
  const R = charge.evenement.tours;
  const rendus = new Map();
  for (const personne of charge.participants) {
    const tours = [];
    if (!personne.exclu) for (let tour = 1; tour <= R; tour += 1) if (estPresentAuTour(personne, tour)) tours.push(tour);
    rendus.set(personne.id, tours.join(','));
  }
  return rendus;
}

/**
 * Les identifiants, croissants, des personnes dont le masque de présence
 * (R1) diffère entre avant et apres : présence changée, ajout, exclusion,
 * réintégration, suppression. Une personne absente d'une charge y a un
 * masque vide.
 *
 * @param {import('../stockage/types.js').Charge} avant
 * @param {import('../stockage/types.js').Charge} apres
 * @returns {number[]}
 */
export function presencesChangees(avant, apres) {
  const de = masques(avant);
  const a = masques(apres);
  const ids = new Set([...de.keys(), ...a.keys()]);
  return [...ids].filter((id) => (de.get(id) ?? '') !== (a.get(id) ?? '')).sort(croissant);
}

/**
 * Le retenu de apres ajusté aux présences de apres pour les seules
 * personnes dont le masque change entre avant et apres (presencesChangees),
 * par ajusterALaPresence : { retenu, partis, arrives, retires }, les trois
 * listes de ajusterALaPresence. Le retenu de apres est celui que le geste
 * n'a pas encore touché. Sans retenu, retenu vaut null ; un retenu fautif,
 * ou que rien ne touche, se rend tel quel ; les trois listes sont alors
 * vides. Ni avant ni apres ne sont modifiés ; un retenu ajusté est neuf.
 *
 * @param {import('../stockage/types.js').Charge} avant
 * @param {import('../stockage/types.js').Charge} apres
 * @returns {{retenu: Object|null, partis: Array<{participant: number, tours: number[]}>,
 *            arrives: Array<{participant: number, tours: number[]}>, retires: number[]}}
 */
export function retenuAuxPresences(avant, apres) {
  const { retenu } = apres;
  const intact = { retenu, partis: [], arrives: [], retires: [] };
  if (retenu === null || fautes(retenu).length > 0) return intact;
  const ids = presencesChangees(avant, apres);
  if (ids.length === 0) return intact;
  const { placement, partis, arrives, retires } = ajusterALaPresence(retenu, apres, ids);
  return { retenu: placement, partis, arrives, retires };
}

/** Vrai quand l'ajustement a changé le retenu. */
export const retenuChange = ({ partis, arrives, retires }) => partis.length + arrives.length + retires.length > 0;

/**
 * Les avertissements A_PLACER_DANS_LE_RETENU {participant, personne, tours,
 * tousLesTours, remede} des arrivantes d'un ajustement que la charge porte :
 * une par arrivante qui attend en réserve à un tour au moins, dans l'ordre
 * des arrivées. tousLesTours est vrai quand sa présence vaut tous les tours :
 * le texte dit alors de nommer ses tours si elle arrive en cours de soirée.
 * Le remède affiche le premier de ces tours.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {Array<{participant: number, tours: number[]}>} arrives
 * @returns {Array<{code: string, details: Object}>}
 */
export function aPlacerDansLeRetenu(charge, arrives) {
  const personneDe = new Map(charge.participants.map((personne) => [personne.id, personne]));
  return arrives
    .filter(({ participant, tours }) => tours.length > 0 && personneDe.has(participant))
    .map(({ participant, tours }) => {
      const personne = personneDe.get(participant);
      return avertissement('A_PLACER_DANS_LE_RETENU', {
        participant,
        personne: nomAffiche(personne),
        tours: [...tours],
        tousLesTours: personne.presence === undefined,
        remede: { geste: 'afficherTour', tour: tours[0] },
      });
    });
}

/**
 * L'avertissement RENCONTRES_RETIREES_DU_RETENU {participant, personne,
 * tours, remede: null} d'une personne que le geste retire du retenu de
 * avant (retires), quand elle y était assise à une table à un tour au
 * moins : tours, ces tours, croissants. [] sinon, ou sans retenu lisible.
 *
 * @param {import('../stockage/types.js').Charge} avant
 * @param {Object} personne  celle de avant
 * @param {number[]} retires
 * @returns {Array<{code: string, details: Object}>}
 */
export function rencontresRetirees(avant, personne, retires) {
  const { retenu } = avant;
  if (retenu === null || !retires.includes(personne.id)) return [];
  const tours = [];
  retenu.placement.forEach(({ sieges }, rang) => {
    if (sieges.some((liste) => liste.includes(personne.id))) tours.push(rang + 1);
  });
  if (tours.length === 0) return [];
  return [avertissement('RENCONTRES_RETIREES_DU_RETENU', { participant: personne.id, personne: nomAffiche(personne), tours, remede: null })];
}

// Les tours de 1 à R où le masque de id passe de présent à absent (perdus)
// et d'absent à présent (gagnes) entre avant et apres.
function toursChanges(avant, apres, id) {
  const R = apres.evenement.tours;
  const presente = (charge, tour) => {
    const personne = charge.participants.find((candidate) => candidate.id === id);
    return personne !== undefined && !personne.exclu && estPresentAuTour(personne, tour);
  };
  const perdus = [];
  const gagnes = [];
  for (let tour = 1; tour <= R; tour += 1) {
    const de = presente(avant, tour);
    const a = presente(apres, tour);
    if (de && !a) perdus.push(tour);
    else if (!de && a) gagnes.push(tour);
  }
  return { perdus, gagnes };
}

// Le bilan d'une personne sur des tours dont sa présence change : ses
// réservations qui couvrent l'un d'eux, ces tours parmi eux, et les titres
// qu'une de ses réservations pourvoit à l'un de ces tours dans tient et
// qu'aucune ne pourvoit à ce tour dans lache — tient, la charge où elle est
// présente ; lache, celle où elle ne l'est pas.
function bilanDesTours(tient, lache, id, tours) {
  const siennes = tient.reservations.filter((r) => r.participant === id && tours.some((tour) => couvre(r, tour)));
  if (siennes.length === 0) return { reservations: 0, tours: [], titres: 0 };
  const touches = tours.filter((tour) => siennes.some((r) => couvre(r, tour)));
  const pourvus = pourvoyeursDesTitres(tient);
  const restes = pourvoyeursDesTitres(lache);
  const titres = pourvus.filter((pourvoyeur, rang) =>
    touches.some((tour) => pourvoyeur.tours[tour - 1]?.participant === id && restes[rang].tours[tour - 1] === null),
  ).length;
  return { reservations: siennes.length, tours: touches, titres };
}

/**
 * Les avertissements des réservations d'une personne dont la présence
 * change, sans exclusion ni suppression : RESERVATIONS_SUSPENDUES_AUX_TOURS
 * {participant, personne, reservations, tours, titres} pour les tours
 * qu'elle perd, puis RESERVATIONS_RETABLIES_AUX_TOURS {…} pour ceux qu'elle
 * gagne. reservations compte ses réservations qui couvrent l'un de ces
 * tours ; tours, ceux qu'elles couvrent ; titres, les titres de place
 * qu'elles cessent de pourvoir à l'un d'eux, ou pourvoient de nouveau
 * (pourvoyeursDesTitres). Chacun ne sort que lorsqu'une réservation est en
 * jeu. Les réservations ne changent pas : la normalisation les suspend aux
 * tours d'absence.
 *
 * @param {import('../stockage/types.js').Charge} avant
 * @param {import('../stockage/types.js').Charge} apres
 * @param {Object} personne  celle de apres
 * @returns {Array<{code: string, details: Object}>}
 */
export function reservationsAuxTours(avant, apres, personne) {
  const { id } = personne;
  const { perdus, gagnes } = toursChanges(avant, apres, id);
  const details = (bilan) => ({ participant: id, personne: nomAffiche(personne), ...bilan });
  const suspendues = bilanDesTours(avant, apres, id, perdus);
  const retablies = bilanDesTours(apres, avant, id, gagnes);
  return [
    ...(suspendues.reservations > 0 ? [avertissement('RESERVATIONS_SUSPENDUES_AUX_TOURS', details(suspendues))] : []),
    ...(retablies.reservations > 0 ? [avertissement('RESERVATIONS_RETABLIES_AUX_TOURS', details(retablies))] : []),
  ];
}

// Un plan bloqué refuse toute modification ; débloquer seul le lève (§ 9).
function exigerModifiable(charge) {
  if (charge.evenement.etat === 'bloque') throw refus('PLAN_BLOQUE', {}, { geste: 'debloquer' });
}

// Le participant d'identifiant id, ou PARTICIPANT_INCONNU.
function participantDe(charge, id) {
  if (!Number.isSafeInteger(id)) throw new TypeError(`id : entier attendu, reçu ${JSON.stringify(id)}`);
  const participant = charge.participants.find((candidat) => candidat.id === id);
  if (participant === undefined) throw refus('PARTICIPANT_INCONNU', { id });
  return participant;
}

// Vrai quand deux présences canoniques sont la même : undefined (tous les
// tours) des deux côtés, ou les mêmes tours rang à rang.
const memePresence = (a, b) =>
  a === undefined || b === undefined ? a === b : a.length === b.length && a.every((tour, rang) => tour === b[rang]);

/**
 * changerPresence {id, tours} (§ 4, § 5.8, § 8.2) : tours, null pour tous
 * les tours, ou une liste strictement croissante de tours de 1 à R. La
 * présence s'écrit canonique : le champ part quand elle couvre tous les
 * tours. Refus, dans cet ordre : PLAN_BLOQUE ; un id qui n'est pas un entier
 * sûr, TypeError ; PARTICIPANT_INCONNU {id} ; des tours d'une autre forme,
 * TypeError ; aucun tour, PRESENCE_VIDE {participant, personne}, remède
 * null — le texte nomme l'exclusion, qui retire aussi la personne des tours
 * joués du retenu ; une présence égale, SANS_EFFET ; puis le premier refus
 * de controlerPresence, quand une réservation que la présence rétablit ne
 * tient plus sa place. Le retenu suit dans la même entrée
 * (retenuAuxPresences). Une exclue reçoit la présence sans autre effet :
 * son masque reste vide. Avertissements : RESERVATIONS_SUSPENDUES_AUX_TOURS,
 * RESERVATIONS_RETABLIES_AUX_TOURS (reservationsAuxTours), puis
 * A_PLACER_DANS_LE_RETENU. Le libellé ENTREE_CHANGER_PRESENCE nomme la
 * présence d'après, celle d'avant, et les tours où le retenu la retire ou
 * la met en réserve.
 */
function changerPresence(charge, { id, tours } = {}) {
  exigerModifiable(charge);
  const personne = participantDe(charge, id);
  const R = charge.evenement.tours;
  const lus = lireTours(tours, R);
  if (lus !== null && lus.length === 0) throw refus('PRESENCE_VIDE', { participant: id, personne: nomAffiche(personne) });
  const presence = lus === null ? undefined : presenceCanonique(lus, R);
  const avant = personne.presence === undefined ? undefined : presenceCanonique(personne.presence, R);
  if (memePresence(presence, avant)) throw refus('SANS_EFFET', { commande: 'changerPresence' });
  const suivante = structuredClone(charge);
  suivante.participants = suivante.participants.map((candidate) => {
    if (candidate.id !== id) return candidate;
    const reste = { ...candidate };
    delete reste.presence;
    return presence === undefined ? reste : { ...reste, presence };
  });
  leverRefus(controlerPresence(charge, suivante, [id]));
  const ajustement = retenuAuxPresences(charge, suivante);
  suivante.retenu = ajustement.retenu;
  const toursDe = (liste) => liste.find(({ participant }) => participant === id)?.tours ?? [];
  const renduePersonne = suivante.participants.find((candidate) => candidate.id === id);
  return {
    charge: suivante,
    libelle: libelle('ENTREE_CHANGER_PRESENCE', {
      personne: nomAffiche(personne),
      tours: presence ?? null,
      avant: presenceSaisie(personne),
      retiree: toursDe(ajustement.partis),
      enReserve: toursDe(ajustement.arrives),
    }),
    avertissements: [
      ...reservationsAuxTours(charge, suivante, renduePersonne),
      ...aPlacerDansLeRetenu(suivante, ajustement.arrives),
    ],
  };
}

/** @type {Map<string, (charge: Object, args: Object) => Object>} */
export const COMMANDES_PRESENCE = new Map([['changerPresence', changerPresence]]);
