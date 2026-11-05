// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// L'état des places d'un tour (§ 5.8, § 7.5, § 7.6, § 8.9, § 9) : ce que le
// plan dessine et ce qu'un geste de personne modifie, lu dans la charge sans
// rien recalculer du moteur que ses conflits. Aussi la seule répartition par
// siège (repartirSieges), le libellé proposé à la désignation et les statuts
// calculés (§ 4.2). Aucune fonction ne modifie ce qu'elle reçoit.
//
// Une réservation est active quand sa personne est dans la charge et n'est
// pas exclue : celle d'une exclue est suspendue (§ 4.4) et ne tient aucune
// place. Un titre se lit pourvu selon la règle de pourvoyeursDesTitres, la
// seule (src/csv/import.js).
//
// La règle de présence par tour (R1), la seule sous src/application : une
// personne est présente au tour r quand elle est dans la charge, n'est pas
// exclue, et que sa présence porte r (estPresentAuTour, champ absent : tous
// les tours). Une réservation ne tient sa personne qu'à ses tours de
// présence : à un tour d'absence, elle est suspendue comme celle d'une
// exclue, et ne tient ni place ni titre (reservationsCouvrantes). Une
// absente n'est ni assise ni en réserve : l'état d'un tour la range à part
// (absents). presents garde son sens, les non-exclus, pour qui ne raisonne
// pas au tour.
import { ordreDesReservations, pourvoyeursDesTitres } from '../csv/import.js';
import { STATUT, indexerPlan, normaliser } from '../moteur/configuration.js';
import { conflitsParTable } from '../moteur/conflits.js';
import { ErreurConfiguration } from '../moteur/erreurs.js';
import { estPresentAuTour } from '../moteur/presence.js';
import { capacite } from '../stockage/document.js';
import { derive, fautes, planDepuisFichier } from '../stockage/placements.js';
import { configurationDe } from './configuration.js';
import { libelle } from './libelles.js';

const croissant = (a, b) => a - b;
// Deux chaînes, comparées unité UTF-16 par unité.
const comparerTextes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Vrai quand la réservation couvre le tour r : « tous », ou son tour. */
export const couvre = ({ portee, tour }, r) => portee === 'tous' || tour === r;

/** Les identifiants des personnes non exclues de la charge. */
export const presents = (charge) => new Set(charge.participants.filter(({ exclu }) => !exclu).map(({ id }) => id));

/** Les réservations actives — personne présente et non exclue —, dans l'ordre canonique. */
export function reservationsActives(charge) {
  const ids = presents(charge);
  return charge.reservations.filter(({ participant }) => ids.has(participant)).sort(ordreDesReservations);
}

/**
 * La présence saisie d'une personne, lue telle quelle : null quand le champ
 * manque (tous les tours), sinon une copie de sa liste. Ne lit pas exclu.
 *
 * @param {{presence?: readonly number[]}} personne
 * @returns {number[]|null}
 */
export function presenceSaisie(personne) {
  return personne.presence === undefined ? null : [...personne.presence];
}

/**
 * Vrai quand la personne id est présente au tour (R1) : dans la charge, non
 * exclue, et le tour dans sa présence.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {number} id
 * @param {number} tour
 * @returns {boolean}
 */
export function presentAuTour(charge, id, tour) {
  const personne = charge.participants.find((candidate) => candidate.id === id);
  return personne !== undefined && !personne.exclu && estPresentAuTour(personne, tour);
}

/**
 * Les identifiants des personnes présentes au tour (R1), dans l'ordre de la
 * charge.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {number} tour
 * @returns {Set<number>}
 */
export function presentsAuTour(charge, tour) {
  return new Set(charge.participants.filter((personne) => !personne.exclu && estPresentAuTour(personne, tour)).map(({ id }) => id));
}

/**
 * Vrai quand une personne non exclue manque un tour de 1 à R. La présence
 * d'une exclue, suspendue, n'y entre pas.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {boolean}
 */
export function aDesAbsences(charge) {
  const R = charge.evenement.tours;
  return charge.participants.some((personne) => {
    if (personne.exclu) return false;
    for (let tour = 1; tour <= R; tour += 1) if (!estPresentAuTour(personne, tour)) return true;
    return false;
  });
}

/**
 * Les identifiants croissants des personnes non exclues qui portent un champ
 * presence : celles dont la présence ne couvre pas toute la soirée.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {number[]}
 */
export function presencesPartielles(charge) {
  return charge.participants
    .filter((personne) => !personne.exclu && personne.presence !== undefined)
    .map(({ id }) => id)
    .sort(croissant);
}

/**
 * Les réservations actives qui couvrent le tour et dont la personne y est
 * présente (R1), dans l'ordre canonique : celles qui tiennent une place à ce
 * tour. Les mêmes personnes, aux mêmes tables, que fixe le moteur à ce tour.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {number} tour
 * @returns {Object[]}
 */
export function reservationsCouvrantes(charge, tour) {
  const ids = presentsAuTour(charge, tour);
  return charge.reservations.filter((reservation) => ids.has(reservation.participant) && couvre(reservation, tour)).sort(ordreDesReservations);
}

/**
 * L'instance du moteur de la charge, ou null quand la configuration ne se
 * normalise pas (ErreurConfiguration) ; toute autre erreur passe.
 */
export function instanceDe(charge) {
  try {
    return normaliser(configurationDe(charge));
  } catch (erreur) {
    if (erreur instanceof ErreurConfiguration) return null;
    throw erreur;
  }
}

/**
 * La seule répartition par siège : la personne réservée au siège s ≤ places
 * (siegeDe : Map id → s ; deux au même siège, le plus petit identifiant) au
 * rang s, les autres aux rangs libres par identifiant croissant, null aux
 * rangs restés libres. Quand les autres dépassent les rangs libres, les
 * prioritaires y entrent d'abord, puis les plus petits identifiants : les
 * plus grands identifiants non prioritaires restent dehors. etatPlaces la
 * sollicite avec places = capacité, et pour prioritaires les personnes dont
 * une réservation couvrante tient cette table ; une génération à sièges
 * attribués avec places = capacité, puis retire les null de fin : ceux du
 * milieu sont les chaises vides du fichier.
 *
 * @param {number[]} personnes
 * @param {Map<number, number|null>} siegeDe
 * @param {number} places
 * @param {Set<number>} [prioritaires]   vide par défaut
 * @returns {Array<number|null>}   places rangs
 */
export function repartirSieges(personnes, siegeDe, places, prioritaires = new Set()) {
  const rangs = Array.from({ length: places }, () => null);
  const placees = new Set();
  const siegeValide = (id) => {
    const siege = siegeDe.get(id);
    return Number.isInteger(siege) && siege >= 1 && siege <= places;
  };
  for (const id of personnes.filter(siegeValide).sort(croissant)) {
    const rang = siegeDe.get(id) - 1;
    if (rangs[rang] === null) {
      rangs[rang] = id;
      placees.add(id);
    }
  }
  const libres = rangs.filter((occupant) => occupant === null).length;
  const autres = personnes.filter((id) => !placees.has(id)).sort(croissant);
  const elues = [...autres.filter((id) => prioritaires.has(id)), ...autres.filter((id) => !prioritaires.has(id))]
    .slice(0, libres)
    .sort(croissant);
  let suivante = 0;
  for (let rang = 0; rang < places && suivante < elues.length; rang += 1) {
    if (rangs[rang] === null) {
      rangs[rang] = elues[suivante];
      suivante += 1;
    }
  }
  return rangs;
}

// La source d'un tour (contrat de données, « Source ») : la proposition
// demandée quand elle existe, se lit (fautes vide) et porte ce tour ; sinon
// le retenu, s'il se lit et porte ce tour ; sinon les seules réservations.
// cible et refus disent ce qu'un geste de personne y modifie.
function sourceDuTour(charge, tour, proposition) {
  const { retenu } = charge;
  const retenuFautif = retenu !== null && fautes(retenu).length > 0;
  const porte = (placement) => fautes(placement).length === 0 && placement.tours >= tour;
  const demandee = proposition === null ? undefined : charge.propositions.find(({ id }) => id === proposition);
  if (demandee !== undefined && porte(demandee)) {
    if (retenu === null) return { source: 'proposition', placement: demandee, cible: 'reservations', refus: null };
    const remede = { geste: 'afficherTour', tour, proposition: null };
    return {
      source: 'proposition',
      placement: demandee,
      cible: null,
      refus: { code: 'PROPOSITION_MONTREE', details: { proposition: demandee.id, remede } },
    };
  }
  if (retenu !== null && !retenuFautif && porte(retenu)) return { source: 'retenu', placement: retenu, cible: 'retenu', refus: null };
  if (retenuFautif) {
    const remede = { geste: 'ouvrirSecours', source: 'precedent' };
    return { source: 'reservations', placement: null, cible: null, refus: { code: 'RETENU_FAUTIF', details: { remede } } };
  }
  return { source: 'reservations', placement: null, cible: 'reservations', refus: null };
}

// Le plan indexé dont se lisent les conflits du tour, ou null quand ils ne
// s'évaluent pas : la configuration ne se normalise pas, ou la source est en
// dérive. Sans source, la rangée des réservations de l'instance
// (instance.fixe) se lit comme le plan qui n'assied que les réservés.
function planEvalue(charge, instance, placement) {
  if (instance === null) return null;
  if (placement === null) return instance.fixe;
  if (derive(placement, charge).length > 0) return null;
  try {
    return indexerPlan(instance, planDepuisFichier(placement));
  } catch (erreur) {
    if (erreur instanceof ErreurConfiguration) return null;
    throw erreur;
  }
}

/**
 * Les places que les réservations actives couvrantes d'une table tiennent,
 * la règle de l'affichage : tenu, Map siège → réservation, la première dans
 * l'ordre canonique de chaque siège dans la capacité, une personne n'en
 * tenant qu'un ; siegeDe, Map personne → son siège tenu ; sansSiege, Map
 * personne → réservation, pour chaque autre personne réservée à la table —
 * sans siège, ou dont le siège est pris : elle se lit comme une réservation
 * sans siège.
 *
 * @param {Object[]} couvrantes   les réservations actives qui couvrent le tour à
 *        cette table, ordre canonique
 * @param {number} places         la capacité courante de la table
 * @returns {{tenu: Map<number, Object>, siegeDe: Map<number, number>, sansSiege: Map<number, Object>}}
 */
export function placesTenues(couvrantes, places) {
  const tenu = new Map();
  const siegeDe = new Map();
  const sansSiege = new Map();
  for (const reservation of couvrantes) {
    const { siege, participant } = reservation;
    if (siege !== null && siege <= places && !tenu.has(siege) && !siegeDe.has(participant)) {
      tenu.set(siege, reservation);
      siegeDe.set(participant, siege);
    }
  }
  for (const reservation of couvrantes) {
    if (!siegeDe.has(reservation.participant) && !sansSiege.has(reservation.participant)) {
      sansSiege.set(reservation.participant, reservation);
    }
  }
  return { tenu, siegeDe, sansSiege };
}

// Le remplissage et les marques d'une chaise (§ 7.6) : une réservation
// porte le cadenas fermé, l'anneau en plus pour la portée « tous les
// tours » ; la chaise est pleine quand le placement la tient, hachurée quand
// il la laisse vide ou y assied une autre personne — la réservation n'y est
// pas tenue. Cette hachure ne dit rien du titre de la chaise, que la chaise
// porte à part, pourvu ou non selon pourvoyeursDesTitres (§ 4.1). Le cadenas
// ouvert reste au titre seul, que la chaise ne lie à aucune réservation :
// plein quand une réservation le pourvoit pourtant à ce tour — sans siège,
// sa personne assise ailleurs ou nulle part —, hachuré quand rien ne le
// pourvoit. La forme distingue toujours une réservation d'un titre.
function aspect(reservation, occupant, titre) {
  if (reservation !== null) {
    const anneau = reservation.portee === 'tous' ? ['anneau'] : [];
    const remplissage = reservation.participant === occupant ? 'plein' : 'hachure';
    return { remplissage, marques: ['cadenasFerme', ...anneau] };
  }
  if (titre !== null) return { remplissage: titre.pourvu ? 'plein' : 'hachure', marques: ['cadenasOuvert'] };
  return { remplissage: 'normal', marques: [] };
}

/**
 * L'état des places d'un tour (contrat de données, EtatPlaces) : la source —
 * la proposition demandée, le retenu, ou les seules réservations —, ce qu'un
 * geste de personne y modifie, chaque table de la charge dans son ordre avec
 * son libellé, null quand elle n'en porte pas, et ses chaises, la réserve,
 * qui ne liste que des présentes du tour, et absents, les non-exclues
 * absentes du tour, croissantes. Sièges attribués, la chaise s porte le
 * rang s de la liste de la source, et la source se lit telle quelle : la
 * réservation qui tient un siège que la liste donne à une autre personne, ou
 * laisse vide, se lit sur la chaise sans la remplir — hachure et cadenas
 * fermé —, et sa personne est là où la liste l'assied. Sans attribution,
 * repartirSieges répartit les occupants de la liste, chacun à son siège
 * réservé, une personne réservée sans siège qui pourvoit un titre au siège de
 * ce titre ; quand la liste dépasse la capacité, les personnes réservées à la
 * table passent avant les autres. Sous les seules réservations, les personnes
 * que les réservations du tour tiennent à la table s'y répartissent de même.
 * Un exclu, une personne que la charge n'a plus, n'occupe rien et n'attend
 * pas ; une personne absente au tour (R1) non plus, et absents la nomme ; une
 * personne déjà assise à une table précédente de la charge ne s'assied pas
 * une seconde fois ; une personne présente au tour qu'aucune chaise ne reçoit
 * attend en réserve. Seules les réservations couvrantes du tour
 * (reservationsCouvrantes) tiennent une chaise. Les conflits sont ceux de
 * conflitsParTable au tour, null quand la source est en dérive ou que la
 * configuration ne se normalise pas ; evalue le dit.
 *
 * Ne lève sur aucune charge que l'analyse admet, pour tout tour de 1 à R.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {{tour: number, proposition?: number|null}} demande
 * @returns {Object}   EtatPlaces
 * @throws {TypeError} un tour hors de 1 à R
 */
export function etatPlaces(charge, { tour, proposition = null }) {
  if (!Number.isInteger(tour) || tour < 1 || tour > charge.evenement.tours) {
    throw new TypeError(`etatPlaces : tour de 1 à ${charge.evenement.tours} attendu, reçu ${JSON.stringify(tour)}`);
  }
  const { source, placement, cible, refus } = sourceDuTour(charge, tour, proposition);
  const siegesAttribues = placement === null ? charge.reglages.attribuerSieges : placement.siegesAttribues;
  const ids = presentsAuTour(charge, tour);
  const instance = instanceDe(charge);
  const tableDe = planEvalue(charge, instance, placement);
  const conflitsDe = new Map(
    tableDe === null ? [] : conflitsParTable(instance, tableDe)[tour - 1].map(({ table, nombre, regles }) => [table, { nombre, regles }]),
  );

  const { titres } = charge;
  const pourvoyeurs = pourvoyeursDesTitres(charge);
  const ordreDesTitres = titres
    .map((_, rang) => rang)
    .sort((a, b) => titres[a].table - titres[b].table || titres[a].siege - titres[b].siege || comparerTextes(titres[a].libelle, titres[b].libelle));
  const titreDePlace = new Map();
  for (const rang of ordreDesTitres) {
    const cle = `${titres[rang].table}:${titres[rang].siege}`;
    if (!titreDePlace.has(cle)) titreDePlace.set(cle, rang);
  }
  const pourvuAuTour = (rang) => pourvoyeurs[rang].tours[tour - 1] !== null;
  const couvrantes = reservationsCouvrantes(charge, tour);

  const assis = new Set();
  const tables = charge.tables.map((enregistrement) => {
    const { id, numero, forme, position } = enregistrement;
    const places = capacite(charge, enregistrement);
    const { tenu, siegeDe, sansSiege } = placesTenues(
      couvrantes.filter(({ table }) => table === id),
      places,
    );
    const titresDeLaTable = ordreDesTitres.filter((rang) => titres[rang].table === id);
    // Une personne réservée sans siège qui pourvoit un titre s'assied au
    // siège de ce titre, quand nul ne le tient.
    const pris = new Set(siegeDe.values());
    const siegesVoulus = new Map(siegeDe);
    for (const rang of titresDeLaTable) {
      const pourvoyeur = pourvoyeurs[rang].tours[tour - 1];
      const { siege } = titres[rang];
      if (pourvoyeur === null || !sansSiege.has(pourvoyeur.participant) || siegesVoulus.has(pourvoyeur.participant)) continue;
      if (pris.has(siege) || siege > places) continue;
      siegesVoulus.set(pourvoyeur.participant, siege);
      pris.add(siege);
    }

    let occupants;
    if (placement === null) {
      const reserves = [...siegeDe.keys(), ...sansSiege.keys()].filter((personne) => !assis.has(personne));
      occupants = repartirSieges(reserves, siegesVoulus, places);
    } else {
      const rang = placement.tables.indexOf(id);
      const liste = rang < 0 ? [] : placement.placement[tour - 1].sieges[rang];
      const lisible = (personne) => personne !== null && ids.has(personne) && !assis.has(personne);
      if (placement.siegesAttribues) {
        occupants = Array.from({ length: places }, (_, i) => (i < liste.length && lisible(liste[i]) ? liste[i] : null));
      } else {
        // Les personnes que réserve cette table s'assoient avant les autres :
        // une capacité réduite, jamais sous ses réservations (§ 6.2), n'en
        // verse aucune en réserve.
        const reservees = new Set([...siegeDe.keys(), ...sansSiege.keys()]);
        occupants = repartirSieges(liste.filter(lisible), siegesVoulus, places, reservees);
      }
    }
    for (const personne of occupants) if (personne !== null) assis.add(personne);

    const chaises = occupants.map((occupant, rang) => {
      const siege = rang + 1;
      const tenue = tenu.get(siege) ?? (occupant !== null && sansSiege.has(occupant) ? sansSiege.get(occupant) : null);
      const reservation = tenue === null ? null : { participant: tenue.participant, portee: tenue.portee, tour: tenue.tour };
      const rangTitre = titreDePlace.get(`${id}:${siege}`);
      const titre = rangTitre === undefined ? null : { libelle: titres[rangTitre].libelle, pourvu: pourvuAuTour(rangTitre) };
      return { siege, occupant, reservation, titre, ...aspect(reservation, occupant, titre) };
    });

    return {
      id,
      numero,
      libelle: enregistrement.libelle ?? null,
      forme,
      position: { x: position.x, y: position.y },
      capacite: places,
      surchargee: enregistrement.sieges !== null,
      gelee: instance !== null && instance.ancresParTable[instance.indexTableDe.get(id)] === places,
      titres: { titres: titresDeLaTable.length, pourvus: titresDeLaTable.filter(pourvuAuTour).length },
      conflits: tableDe === null ? null : conflitsDe.get(id),
      chaises,
    };
  });

  return {
    tour,
    source,
    proposition: source === 'proposition' ? placement.id : null,
    siegesAttribues,
    tables,
    reserve: [...ids].filter((personne) => !assis.has(personne)).sort(croissant),
    absents: charge.participants
      .filter((personne) => !personne.exclu && !ids.has(personne.id))
      .map(({ id }) => id)
      .sort(croissant),
    evalue: tableDe !== null,
    cible,
    refus,
  };
}

/**
 * Le libellé proposé à la désignation de participant (§ 4, § 2.1 étape 6) :
 * son titre pressenti ; à défaut, le libellé le plus fréquent des titres de
 * la charge, le plus petit par unités UTF-16 à égalité ; à défaut, le
 * français de la clé places.titreParDefaut. Il devient une donnée du
 * fichier : il se lit par libelle, jamais par la traduction de l'écran.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {number} participant   identifiant
 * @returns {string}
 */
export function libellePropose(charge, participant) {
  const personne = charge.participants.find(({ id }) => id === participant);
  if (personne !== undefined && personne.titrePressenti !== null) return personne.titrePressenti;
  const comptes = new Map();
  for (const { libelle: texte } of charge.titres) comptes.set(texte, (comptes.get(texte) ?? 0) + 1);
  let meilleur = null;
  for (const [texte, nombre] of comptes) {
    const ecart = meilleur === null ? 1 : nombre - comptes.get(meilleur);
    if (ecart > 0 || (ecart === 0 && comparerTextes(texte, meilleur) < 0)) meilleur = texte;
  }
  return meilleur ?? libelle('places.titreParDefaut');
}

// Le nom de chaque statut du moteur.
const NOMS_DES_STATUTS = new Map([
  [STATUT.ANCRE, 'ancre'],
  [STATUT.PARTIELLEMENT_FIXE, 'partiel'],
  [STATUT.MOBILE, 'mobile'],
]);

/**
 * Le statut calculé de chaque participant non exclu (§ 4.2), lu dans
 * l'instance du moteur : ancré, partiellement fixé ou mobile ; un exclu n'a
 * pas d'entrée. Une configuration qui ne se normalise pas rend son code dans
 * erreur, et aucun statut, au lieu de lever.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {{parId: Map<number, 'ancre'|'partiel'|'mobile'>, erreur: string|null}}
 */
export function statuts(charge) {
  let instance;
  try {
    instance = normaliser(configurationDe(charge));
  } catch (erreur) {
    if (erreur instanceof ErreurConfiguration) return { parId: new Map(), erreur: erreur.code };
    throw erreur;
  }
  const parId = new Map(instance.ids.map((id, p) => [id, NOMS_DES_STATUTS.get(instance.statut[p])]));
  return { parId, erreur: null };
}
