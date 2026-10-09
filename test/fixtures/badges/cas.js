// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les petites charges des épreuves de la planche (§ 11.4 à § 11.8) : une
// soirée construite par ses personnes, ses tables et un plan écrit tour par
// tour, sous la forme positionnelle du fichier d'état (§ 8.9). Le plan d'un
// tour se donne comme le fichier l'écrit — une liste par table, dans l'ordre
// de charge.tables, et la réserve — ; sans attribution des sièges, chaque
// liste se trie par identifiant, comme le veut le format. Chaque appel rend
// une charge neuve, que l'épreuve modifie à son gré. Les noms sont inventés,
// hors du réservoir des démonstrations ; la version vient du module engendré.
import { creerCharge } from '../../../src/stockage/document.js';
import { VERSION } from '../../../src/version.genere.js';

/** L'horodatage du retenu des soirées construites, et celui d'une retouche. */
export const H_RETENU = '2031-05-17T20:15:07-04:00';
export const H_RETOUCHE = '2031-05-17T21:42:30-04:00';
/** L'horodatage des propositions construites. */
export const H_PROPOSITION = '2031-05-17T19:05:00-04:00';

/**
 * Une personne de la charge : identifiant, prénom (null admis), nom ;
 * appartenance, courriel, titre pressenti et notes à null, non exclue,
 * sauf ce que champs remplace.
 *
 * @param {number} id
 * @param {string|null} prenom
 * @param {string} nom
 * @param {Object} [champs]
 * @returns {import('../../../src/stockage/types.js').Participant}
 */
export function personne(id, prenom, nom, champs = {}) {
  return {
    id,
    nom,
    prenom,
    appartenance: null,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
    ...champs,
  };
}

/**
 * Une table : son identifiant, son numéro affiché, ses sièges (null : le
 * défaut de la soirée), ronde, posée en rangée par identifiant.
 *
 * @param {number} id
 * @param {number} numero
 * @param {number|null} [sieges]
 */
export function table(id, numero, sieges = null) {
  return { id, numero, sieges, forme: 'ronde', position: { x: 300 * (id - 1), y: 0 } };
}

// La capacité courante d'une table de la charge.
const capaciteDe = (charge, { sieges }) => sieges ?? charge.evenement.siegesParDefaut;

/**
 * La forme positionnelle d'un plan sur les tables de la charge : tables et
 * capacités de charge.tables, dans leur ordre ; un tour par élément de plan,
 * { sieges: (number|null)[][], reserve?: number[] } ; les participants, ceux
 * que le premier tour écrit, triés. Sans attribution, chaque liste se trie
 * par identifiant ; avec, elle garde l'ordre des sièges et ses null.
 *
 * @param {Object} charge
 * @param {Array<{sieges: Array<Array<number|null>>, reserve?: number[]}>} plan
 * @param {{siegesAttribues?: boolean}} [options]
 */
export function placementDe(charge, plan, { siegesAttribues = false } = {}) {
  const placement = plan.map(({ sieges, reserve = [] }) => ({
    sieges: sieges.map((liste) => (siegesAttribues ? [...liste] : [...liste].sort((a, b) => a - b))),
    reserve: [...reserve].sort((a, b) => a - b),
  }));
  const premier = placement[0];
  const participants = [...premier.sieges.flat(), ...premier.reserve].filter((id) => id !== null).sort((a, b) => a - b);
  return {
    siegesAttribues,
    tables: charge.tables.map(({ id }) => id),
    capacites: charge.tables.map((enregistrement) => capaciteDe(charge, enregistrement)),
    tours: plan.length,
    participants,
    placement,
  };
}

/**
 * Une proposition de la charge, d'identifiant id, sur ce plan ; datée de
 * horodatage, sans le champ quand il vaut null — un fichier écrit avant le
 * champ.
 */
export function proposition(charge, id, plan, { siegesAttribues = false, horodatage = H_PROPOSITION } = {}) {
  const p = {
    id,
    graine: id,
    arret: 40,
    historique: 500,
    produitVersion: VERSION.affichee,
    ...placementDe(charge, plan, { siegesAttribues }),
  };
  return horodatage === null ? p : { ...p, horodatage };
}

/**
 * Une soirée construite. personnes et tables sont les listes de la charge
 * (personne, table) ; plan, le plan du retenu, null pour une soirée sans
 * retenu ; propositions, des paires [id, plan] ; le retenu vient de la
 * proposition 1, daté de horodatage (null : sans le champ). Les
 * compteurs passent au-delà de chaque identifiant posé.
 *
 * @returns {import('../../../src/stockage/types.js').Charge}
 */
export function soiree({
  personnes,
  tables,
  plan = null,
  siegesParDefaut = 8,
  siegesAttribues = false,
  etat = 'retenu',
  horodatage = H_RETENU,
  nom = 'Soirée des Lucioles',
  date = '2031-05-17',
  reservations = [],
  titres = [],
  propositions = [],
}) {
  const tours = plan?.length ?? propositions[0]?.[1].length ?? 1;
  const charge = creerCharge({ id: 'evt-lucioles', nom, date, siegesParDefaut, tours });
  charge.evenement.etat = etat;
  charge.reglages.attribuerSieges = siegesAttribues;
  charge.participants = personnes;
  charge.tables = tables;
  charge.reservations = reservations;
  charge.titres = titres;
  charge.propositions = propositions.map(([id, leur]) => proposition(charge, id, leur, { siegesAttribues }));
  const ids = [1, ...propositions.map(([id]) => id)];
  charge.prochainsIds = {
    participant: Math.max(0, ...personnes.map(({ id }) => id)) + 1,
    table: Math.max(0, ...tables.map(({ id }) => id)) + 1,
    proposition: Math.max(...ids) + 1,
  };
  if (plan !== null) {
    const retenu = { proposition: 1, ...placementDe(charge, plan, { siegesAttribues }) };
    charge.retenu = horodatage === null ? retenu : { ...retenu, horodatage };
  }
  return charge;
}
