// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

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
import { ordreDesReservations, pourvoyeursDesTitres } from '../csv/import.js';
import { STATUT, indexerPlan, normaliser } from '../moteur/configuration.js';
import { conflitsParTable } from '../moteur/conflits.js';
import { ErreurConfiguration } from '../moteur/erreurs.js';
import { capacite, configurationDepuisCharge } from '../stockage/document.js';
import { derive, fautes, planDepuisFichier } from '../stockage/placements.js';
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
 * L'instance du moteur de la charge, ou null quand la configuration ne se
 * normalise pas (ErreurConfiguration) ; toute autre erreur passe.
 */
export function instanceDe(charge) {
  try {
    return normaliser(configurationDepuisCharge(charge));
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

// Les places que les réservations actives couvrantes tiennent à une table :
// tenu, Map siège → réservation, la première dans l'ordre canonique de
// chaque siège dans la capacité, une personne n'en tenant qu'un ; sansSiege,
// Map personne → réservation, pour chaque autre personne réservée à la
// table — sans siège, ou dont le siège est pris : elle se lit comme une
// réservation sans siège.
function placesTenues(couvrantes, places) {
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

// Le remplissage et les marques d'une chaise (§ 7.6) : plein et cadenas
// fermé quand une réservation tient la place, l'anneau en plus pour la portée
// « tous les tours » ; sinon cadenas ouvert pour un titre, hachure quand rien
// ne le pourvoit à ce tour.
function aspect(reservation, titre) {
  if (reservation !== null) {
    return { remplissage: 'plein', marques: reservation.portee === 'tous' ? ['cadenasFerme', 'anneau'] : ['cadenasFerme'] };
  }
  if (titre !== null) return { remplissage: titre.pourvu ? 'normal' : 'hachure', marques: ['cadenasOuvert'] };
  return { remplissage: 'normal', marques: [] };
}

/**
 * L'état des places d'un tour (contrat de données, EtatPlaces) : la source
 * — la proposition demandée, le retenu, ou les seules réservations —, ce
 * qu'un geste de personne y modifie, chaque table de la charge dans son
 * ordre avec ses chaises, et la réserve. Sièges attribués, la chaise s porte
 * le rang s de la liste de la source ; sinon, et sous les seules
 * réservations, repartirSieges répartit les occupants de la table, chacun à
 * son siège réservé, une personne réservée sans siège qui pourvoit un titre
 * au siège de ce titre ; quand la liste dépasse la capacité, les personnes
 * réservées à la table passent avant les autres. Un exclu, une personne que la charge n'a plus,
 * n'occupe rien et n'attend pas ; une personne présente qu'aucune chaise ne
 * reçoit attend en réserve. Les conflits sont ceux de conflitsParTable au
 * tour, null quand la source est en dérive ou que la configuration ne se
 * normalise pas.
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
  const ids = presents(charge);
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
  const couvrantes = reservationsActives(charge).filter((reservation) => couvre(reservation, tour));

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
      return { siege, occupant, reservation, titre, ...aspect(reservation, titre) };
    });

    return {
      id,
      numero,
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
    instance = normaliser(configurationDepuisCharge(charge));
  } catch (erreur) {
    if (erreur instanceof ErreurConfiguration) return { parId: new Map(), erreur: erreur.code };
    throw erreur;
  }
  const parId = new Map(instance.ids.map((id, p) => [id, NOMS_DES_STATUTS.get(instance.statut[p])]));
  return { parId, erreur: null };
}
