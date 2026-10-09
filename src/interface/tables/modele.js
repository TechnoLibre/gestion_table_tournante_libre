// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le modèle de la section des tables et des tours (§ 4, § 6, § 2.1 étapes 4
// et 5), pur : les composants de tables/ le câblent. Il lit la charge et les
// bilans de src/application/bilans.js — bilanChangementDefaut, bilanTours,
// bilanSuppressionTable — et rend des clés de libellé et leurs détails,
// jamais un texte : la traduction les compose. Il ne refait aucun contrôle :
// un refus vient d'un bilan ou de la commande elle-même, essayée sur la
// charge sans rien écrire. Aucune fonction ne modifie ce qu'elle reçoit.
import { appliquerCommande } from '../../application/commandes.js';
import { nomAffiche } from '../../application/personnes.js';

const parNumero = (a, b) => a.numero - b.numero || a.id - b.id;

// Le numéro affiché de la table d'identifiant id parmi tables ; une table
// inconnue est une faute de l'appelant.
function numeroDe(tables, id) {
  const table = tables.find((candidate) => candidate.id === id);
  if (table === undefined) throw new TypeError(`table inconnue : ${JSON.stringify(id)}`);
  return table.numero;
}

// Le nom affiché du participant d'identifiant id ; une personne inconnue
// est une faute de l'appelant.
function nomDe(charge, id) {
  const personne = charge.participants.find((candidate) => candidate.id === id);
  if (personne === undefined) throw new TypeError(`participant inconnu : ${JSON.stringify(id)}`);
  return nomAffiche(personne);
}

// La clé du nom de chaque forme de table (§ 4).
const FORMES = new Map([
  ['ronde', 'tables.forme.ronde'],
  ['carree', 'tables.forme.carree'],
]);

/** La clé du nom d'une forme de table ; RangeError pour une forme inconnue. */
export function cleForme(forme) {
  if (!FORMES.has(forme)) throw new RangeError(`forme inconnue : ${JSON.stringify(forme)}`);
  return FORMES.get(forme);
}

/** Les tables de la charge par numéro affiché croissant, à identifiant égal du plus petit. */
export function tablesParNumero(charge) {
  return [...charge.tables].sort(parNumero);
}

/**
 * L'état d'une table en texte : « suit le défaut » ou « surchargée », et sa
 * capacité ; realignable, vrai pour une table surchargée, offre
 * « Réaligner » (§ 6.1). Une table surchargée à la valeur du défaut a la
 * même capacité qu'une table qui le suit, et un autre état.
 *
 * @param {{sieges: number|null}} table
 * @param {number} siegesParDefaut
 * @returns {{cle: string, capacite: number, realignable: boolean}}
 */
export function etatTable(table, siegesParDefaut) {
  const surchargee = table.sieges !== null;
  return {
    cle: surchargee ? 'tables.etat.surchargee' : 'tables.etat.suitDefaut',
    capacite: surchargee ? table.sieges : siegesParDefaut,
    realignable: surchargee,
  };
}

/**
 * L'énoncé du § 6.1, en clés et détails, depuis bilanChangementDefaut ; ses
 * phrases se lisent séparées d'une espace. Accepté : la phrase
 * d'application — les tables qui suivent le défaut et ce qu'elles
 * deviennent, puis les surchargées, qui ne changent pas — et celle du total.
 * Refusé : une phrase d'en-tête, puis chaque refus de bilan.refus, sa table
 * nommée par son numéro (numero null pour un refus de l'événement entier),
 * et aucune forme d'application. Avec realigner, le bilan est celui de
 * bilanChangementDefaut(…, {realigner: true}) : l'en-tête d'un refus dit
 * que le réalignement est refusé, le changement seul restant possible.
 *
 * @param {ReturnType<import('../../application/bilans.js').bilanChangementDefaut>} bilan
 * @param {Array<{id: number, numero: number}>} [tables]   celles de la charge,
 *        qui donnent son numéro à une table qui refuse
 * @param {{realigner?: boolean}} [options]
 * @returns {Array<{cle: string, details: Object}>}
 * @throws {TypeError} une table de bilan.refus absente de tables
 */
export function enonceDefaut(bilan, tables = [], { realigner = false } = {}) {
  const { avant, apres } = bilan;
  if (bilan.refus.length > 0) {
    return [
      { cle: realigner ? 'tables.defaut.realignementRefuse' : 'tables.defaut.refusee', details: { avant, apres } },
      ...bilan.refus.map(({ table, code, details }) => ({
        cle: 'tables.defaut.refusTable',
        details: { numero: table === null ? null : numeroDe(tables, table), refus: { code, details } },
      })),
    ];
  }
  return [
    { cle: 'tables.defaut.application', details: { suivent: bilan.suivent, avant, apres, surchargees: bilan.surchargees } },
    {
      cle: 'tables.defaut.total',
      details: { totalAvant: bilan.totalAvant, totalApres: bilan.totalApres, participants: bilan.participants },
    },
  ];
}

/**
 * Le refus qu'un nouveau défaut reçoit sur son champ : celui du bilan qui
 * ne nomme aucune table — moins de 2 places refusent pour l'événement
 * entier —, ou null. Les refus d'une table s'énoncent (enonceDefaut).
 *
 * @param {{refus: Array<{table: number|null, code: string, details: Object}>}} bilan
 * @returns {{code: string, details: Object}|null}
 */
export function refusDuChampDefaut(bilan) {
  const refus = bilan.refus.find(({ table }) => table === null);
  return refus === undefined ? null : { code: refus.code, details: refus.details };
}

/**
 * Ce qu'un réalignement de toutes les tables efface : la surcharge de
 * chaque table surchargée, par numéro de table (§ 6.1).
 *
 * @param {Object} charge
 * @returns {Array<{cle: string, details: {numero: number, sieges: number}}>}
 */
export function surchargesPerdues(charge) {
  return tablesParNumero(charge)
    .filter(({ sieges }) => sieges !== null)
    .map(({ numero, sieges }) => ({ cle: 'tables.defaut.surchargePerdue', details: { numero, sieges } }));
}

/**
 * Vrai quand le changement de avant à apres tours s'annonce avant d'être
 * appliqué (§ 2.1 étape 5) : il détruit une réservation « tour désigné »
 * au-delà, ou, pour une baisse, il laisse en dérive un placement engendré,
 * entier mais qui porte des tours que l'événement n'a plus. Une hausse ne
 * détruit rien : les placements qu'elle laisse en dérive restent entiers,
 * et la séance en avertit (DERIVE_NOUVELLE) sans fenêtre (§ 5.9).
 *
 * @param {ReturnType<import('../../application/bilans.js').bilanTours>} bilan
 * @param {number} avant   le nombre de tours enregistré
 * @param {number} apres   le nombre de tours demandé
 * @returns {boolean}
 */
export const annonceTours = (bilan, avant, apres) =>
  bilan.reservationsDetruites.length > 0 ||
  (apres < avant && (bilan.propositionsTouchees.length > 0 || bilan.retenuTouche));

// Les placements qu'un changement laisse en dérive : chaque proposition,
// puis le retenu.
const touches = (bilan) => [
  ...bilan.propositionsTouchees.map((id) => ({ cle: 'tables.touchee.proposition', details: { id } })),
  ...(bilan.retenuTouche ? [{ cle: 'tables.touchee.retenu', details: {} }] : []),
];

/**
 * Ce que nomme la fenêtre d'un changement de tours (§ 2.1 étape 5) : chaque
 * réservation détruite, sa personne et le numéro de sa table, dans l'ordre
 * du bilan, puis les placements touchés.
 *
 * @param {Object} charge
 * @param {ReturnType<import('../../application/bilans.js').bilanTours>} bilan
 * @returns {Array<{cle: string, details: Object}>}
 */
export function elementsTours(charge, bilan) {
  return [
    ...bilan.reservationsDetruites.map(({ participant, table, tour }) => ({
      cle: 'tables.tours.reservation',
      details: { nom: nomDe(charge, participant), numero: numeroDe(charge.tables, table), tour },
    })),
    ...touches(bilan),
  ];
}

/** Vrai quand supprimer la table détruit une réservation ou un titre. */
export const annonceSuppression = (bilan) => bilan.reservations.length > 0 || bilan.titres.length > 0;

/**
 * Ce que nomme la fenêtre de la suppression d'une table (§ 6.2) : ses
 * réservations, leur personne, leur portée et leur siège, puis ses titres,
 * dans l'ordre du bilan ; puis les placements touchés. Rien pour une table
 * nue, que la suppression ne demande pas de confirmer.
 *
 * @param {Object} charge
 * @param {ReturnType<import('../../application/bilans.js').bilanSuppressionTable>} bilan
 * @returns {Array<{cle: string, details: Object}>}
 */
export function elementsSuppression(charge, bilan) {
  if (!annonceSuppression(bilan)) return [];
  return [
    ...bilan.reservations.map(({ participant, portee, tour, siege }) => ({
      cle: 'tables.suppression.reservation',
      details: { nom: nomDe(charge, participant), portee, tour, siege },
    })),
    ...bilan.titres.map(({ siege, libelle }) => ({ cle: 'tables.suppression.titre', details: { siege, libelle } })),
    ...touches(bilan),
  ];
}

/**
 * Les sièges qu'un refus SIEGES_RETIRES retire, nommés : chaque siège dans
 * l'ordre du refus, son titre, ou le nom de la personne qui le réserve —
 * le texte du refus désigne les personnes par identifiant. Sous des sièges
 * non attribués, le refus compte ses titres sans les lister : ils ne le
 * sont pas ici non plus. Rien pour un autre refus.
 *
 * @param {Object} charge
 * @param {{code: string, details: Object}} refus
 * @returns {Array<{cle: string, details: Object, nom: string|null}>}
 */
export function siegesRetiresNommes(charge, refus) {
  if (refus.code !== 'SIEGES_RETIRES') return [];
  const comptes = refus.details.titres !== undefined;
  return refus.details.sieges
    .filter(({ cause }) => !(comptes && cause === 'SIEGE_TITRE'))
    .map((retire) =>
      retire.cause === 'SIEGE_TITRE'
        ? { cle: 'tables.siegeRetire.titre', details: { siege: retire.siege, libelle: retire.libelle }, nom: null }
        : {
            cle: 'tables.siegeRetire.reserve',
            details: { siege: retire.siege, suspendue: retire.suspendue },
            nom: nomDe(charge, retire.participant),
          },
    );
}

/**
 * Les avertissements d'un geste, nommés : numero, celui de la table qu'ils
 * désignent — details.table, ou table pour un avertissement d'un bilan —,
 * null sinon ; noms, les personnes de details.personnes dans leur ordre.
 *
 * @param {Object} charge
 * @param {Array<{code: string, details: Object, table?: number}>} avertissements
 * @returns {Array<{code: string, details: Object, numero: number|null, noms: string[]}>}
 */
export function avertissementsNommes(charge, avertissements) {
  return avertissements.map(({ code, details, table }) => {
    const id = details.table ?? table ?? null;
    return {
      code,
      details,
      numero: id === null ? null : numeroDe(charge.tables, id),
      noms: (details.personnes ?? []).map((personne) => nomDe(charge, personne)),
    };
  });
}

/**
 * Le refus que la commande nom lèverait sur la charge, essayée sans rien
 * écrire, ou null quand elle passe. Les fenêtres l'appellent avant de
 * s'ouvrir : une saisie que la commande refuse reçoit son refus sur le
 * champ, et aucune fenêtre n'annonce ce qui ne s'appliquera pas.
 *
 * @param {Object} charge
 * @param {string} nom
 * @param {Object} args
 * @returns {{code: string, details: Object}|null}
 * @throws {TypeError} une commande inconnue, un argument de forme fausse
 */
export function refusDeCommande(charge, nom, args) {
  try {
    appliquerCommande(nom, charge, args);
    return null;
  } catch (erreur) {
    if (typeof erreur?.code !== 'string') throw erreur;
    return { code: erreur.code, details: erreur.details };
  }
}
