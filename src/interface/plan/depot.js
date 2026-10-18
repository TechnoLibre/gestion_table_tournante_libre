// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le dépôt d'une personne glissée sur le plan (§ 5.8, § 5.9, § 7.1, § 7.3,
// § 14.10), pur : la place se désigne par la géométrie des tables — celles
// mêmes que le dessin pose —, jamais dans le DOM, et la commande se lit sur
// la cible de l'état des places (EtatPlaces.cible, places.js), jamais sur la
// présence d'un retenu. L'interface ne choisit rien : la cible dit ce que
// le geste modifie, et la commande juge la pose et la capacité.
import { designer, surLeSol as horsDesTables } from '../../geometrie/designation.js';

/**
 * Codes d'un refus que le dépôt lève lui-même, leur texte dans
 * src/application/libelles/places.js :
 *   RESERVATION_TOUS_LES_TOURS {participant, table, remede} : sous la cible
 *     'reservations' comme sous 'retenu', une personne que sa réservation
 *     « tous les tours » tient à sa table, déposée hors des tables ou
 *     retirée du tour par son menu ; remède { commande:
 *     'retirerReservation', arguments: {participant, table, portee: 'tous',
 *     tour: null} }.
 *   RESERVATION_CE_TOUR {participant, table, tour, remede} : sous la cible
 *     'retenu', une personne que sa réservation « ce tour » tient à sa table
 *     au tour affiché, déposée hors des tables ou retirée du tour par son
 *     menu ; remède { commande: 'retirerReservation', arguments:
 *     {participant, table, portee: 'tour', tour} }.
 */

// La chaise d'une table de l'état des places, ou undefined.
function chaiseDe(etatPlaces, { table, siege }) {
  return etatPlaces.tables.find(({ id }) => id === table)?.chaises[siege - 1];
}

// Le premier siège libre d'une table au tour affiché, ou null : sous le
// retenu, une chaise que personne n'occupe ; sous les réservations, une
// chaise qu'aucune réservation ne tient — l'occupant non réservé d'une
// proposition montrée ne la prend pas.
function premierLibre(etatPlaces, table, libre) {
  const chaise = etatPlaces.tables.find(({ id }) => id === table).chaises.find(libre);
  return chaise === undefined ? null : chaise.siege;
}

/**
 * La réservation qui tient une personne à la table de sa chaise d'origine,
 * telle que l'état des places la porte — {participant, portee, tour} —,
 * sinon null : pas de chaise d'origine, ou aucune chaise de cette table que
 * sa réservation tient. Elle se lit sur toute la table : sièges attribués,
 * la personne peut s'asseoir à une chaise et sa réservation en tenir une
 * autre, que l'état des places montre hachurée ; une personne ne porte
 * qu'une réservation par table et par tour dans l'état des places
 * (placesTenues, places.js). Le dépôt et le libellé du fantôme la lisent ici
 * tous deux.
 *
 * @param {Object} etatPlaces   EtatPlaces du tour affiché
 * @param {number} personne
 * @param {{table: number, siege: number}|null} depuis
 * @returns {{participant: number, portee: 'tous'|'tour', tour: number|null}|null}
 */
export function reservationTenue(etatPlaces, personne, depuis) {
  const table = depuis === null ? undefined : etatPlaces.tables.find(({ id }) => id === depuis.table);
  return table?.chaises.find(({ reservation }) => reservation?.participant === personne)?.reservation ?? null;
}

// Le refus d'un dépôt sur le sol d'une personne que sa réservation tient à
// la table, son remède le retrait de cette réservation : « tous les tours »
// sous les deux cibles, « ce tour » sous le retenu seul.
function refusDuSol(personne, table, { portee, tour }) {
  const remede = { commande: 'retirerReservation', arguments: { participant: personne, table, portee, tour } };
  if (portee === 'tous') return { refus: { code: 'RESERVATION_TOUS_LES_TOURS', details: { participant: personne, table, remede } } };
  return { refus: { code: 'RESERVATION_CE_TOUR', details: { participant: personne, table, tour, remede } } };
}

/**
 * La commande d'un dépôt de personne, lue sur etatPlaces.cible (contrat,
 * « Source ») :
 *  - 'reservations' — avant la retenue, ou à un tour que le retenu ne porte
 *    pas — : une personne que sa réservation tient à sa table
 *    (reservationTenue) déplace sa réservation (deplacerReservation), qui
 *    garde portée et tour — le fantôme le dit pendant le geste, « tous les
 *    tours » compris ; une autre reçoit une réservation de portée « tour »
 *    au tour affiché (reserver) ; sur le sol, la réservation « ce tour »
 *    glissée part (retirerReservation), et rien pour une personne non
 *    réservée. Une réservation « tous les tours » ne part pas : un geste fait
 *    à un tour ne change pas les autres tours en silence, et une réservation
 *    se défait par sa propre commande (§ 7.1) ; le dépôt rend le refus
 *    RESERVATION_TOUS_LES_TOURS {participant, table}, dont le remède est ce
 *    retrait, de portée « tous ». Un siège qu'occupe une personne non
 *    réservée de la proposition montrée vaut un siège libre : la proposition
 *    reste identique, et dérive ;
 *  - 'retenu' : un siège libre → deplacerDansRetenu, un siège occupé par une
 *    autre → echangerDansRetenu, le sol → retirerDuTour. Sur le sol, une
 *    personne que sa réservation tient à sa table rend un refus, le retrait
 *    du tour enfreignant cette réservation (retirerDuTour lèverait
 *    INVARIANT_VIOLE) : RESERVATION_TOUS_LES_TOURS, comme sous
 *    'reservations', ou RESERVATION_CE_TOUR, selon la portée que l'état des
 *    places montre. Les deux portées à la même table, il montre « tous les
 *    tours » (placesTenues) : son retrait fait voir « ce tour », et le dépôt
 *    suivant la refuse à son tour ;
 *  - null — proposition montrée après la retenue, retenu fautif — : un dépôt
 *    sur un siège, une table ou le sol rend { refus: etatPlaces.refus }, et
 *    rien n'est exécuté.
 * En régime table — cible {table} —, le premier siège libre de la table au
 * tour affiché, sinon la table sans siège (siege: null), dont la commande
 * juge la capacité. Null quand le dépôt manque — entre deux chaises, sur un
 * plateau, sur la chaise d'origine, ou, sous 'reservations', sur la chaise
 * que tient déjà la réservation de la personne, hachurée quand elle est
 * assise ailleurs : deplacerReservation y lèverait SANS_EFFET — : la
 * personne revient.
 *
 * @param {Object} options
 * @param {Object} options.etatPlaces   EtatPlaces du tour affiché
 * @param {number} options.tour         le tour affiché
 * @param {number} options.personne     l'identifiant de la personne glissée
 * @param {{table: number, siege: number}|null} options.depuis   sa chaise d'origine
 * @param {{table: number, siege?: number}|null} options.cible   le rendu de designer
 * @param {boolean} options.surLeSol    le rendu de surLeSol
 * @returns {{commande: string, arguments: Object}|{refus: Object}|null}
 */
export function commandeDeDepot({ etatPlaces, tour, personne, depuis, cible, surLeSol }) {
  if (cible === null && !surLeSol) return null;
  if (etatPlaces.cible === null) return { refus: etatPlaces.refus };
  const surSiege = cible !== null && cible.siege !== undefined;
  if (surSiege && depuis !== null && cible.table === depuis.table && cible.siege === depuis.siege) return null;

  if (etatPlaces.cible === 'retenu') {
    if (cible === null) {
      const tenue = reservationTenue(etatPlaces, personne, depuis);
      if (tenue !== null) return refusDuSol(personne, depuis.table, tenue);
      return { commande: 'retirerDuTour', arguments: { tour, participant: personne } };
    }
    const siege = surSiege ? cible.siege : premierLibre(etatPlaces, cible.table, ({ occupant }) => occupant === null);
    const occupant = siege === null ? null : chaiseDe(etatPlaces, { table: cible.table, siege }).occupant;
    if (occupant !== null && occupant !== personne) {
      return { commande: 'echangerDansRetenu', arguments: { tour, a: personne, b: occupant } };
    }
    return { commande: 'deplacerDansRetenu', arguments: { tour, participant: personne, table: cible.table, siege } };
  }

  if (surSiege && chaiseDe(etatPlaces, cible)?.reservation?.participant === personne) return null;
  const tenue = reservationTenue(etatPlaces, personne, depuis);
  if (cible === null) {
    if (tenue === null) return null;
    if (tenue.portee === 'tous') return refusDuSol(personne, depuis.table, tenue);
    return { commande: 'retirerReservation', arguments: { participant: personne, table: depuis.table, portee: tenue.portee, tour: tenue.tour } };
  }
  const siege = surSiege ? cible.siege : premierLibre(etatPlaces, cible.table, ({ reservation }) => reservation === null);
  if (tenue !== null) {
    return {
      commande: 'deplacerReservation',
      arguments: {
        participant: personne,
        de: { table: depuis.table, portee: tenue.portee, tour: tenue.tour },
        vers: { table: cible.table, siege },
      },
    };
  }
  return { commande: 'reserver', arguments: { participant: personne, table: cible.table, siege, portee: 'tour', tour } };
}

/**
 * Ce que désigne un point de dessin, tel que le dépôt le lit : la place de
 * designer sur les géométries au zoom k, et surLeSol, vrai seulement quand
 * aucune place n'est désignée et que le point tombe hors de toute table.
 * Entre deux chaises ou sur un plateau, les deux disent rien. Le dépôt et le
 * libellé du fantôme pendant le geste le lisent ici tous deux.
 *
 * @param {{x: number, y: number}} point   cm
 * @param {Object[]} geometries   TableDessin.geometrie de chaque table, dans
 *   l'ordre du dessin
 * @param {number} k
 * @returns {{cible: {table: number, siege?: number}|null, surLeSol: boolean}}
 */
export function designerAuPoint(point, geometries, k) {
  const cible = designer(point, geometries, k);
  return { cible, surLeSol: cible === null && horsDesTables(point, geometries) };
}

/**
 * Le dépôt au point de dessin : la place que désigne designerAuPoint sur
 * les géométries du modèle de dessin, au zoom k, et la commande de
 * commandeDeDepot. place est la place où poser un refus : la place
 * désignée — chaise ou table —, sinon la chaise d'origine.
 *
 * @param {Object} options   ceux de commandeDeDepot, cible et surLeSol exceptés, plus :
 * @param {{x: number, y: number}} options.point   cm
 * @param {Object[]} options.geometries   TableDessin.geometrie de chaque table,
 *   dans l'ordre du dessin
 * @param {number} options.k
 * @returns {{resultat: ReturnType<typeof commandeDeDepot>, place: Object|null}}
 */
export function deposer({ etatPlaces, tour, personne, depuis, point, geometries, k }) {
  const { cible, surLeSol } = designerAuPoint(point, geometries, k);
  const resultat = commandeDeDepot({ etatPlaces, tour, personne, depuis, cible, surLeSol });
  return { resultat, place: cible ?? depuis };
}
