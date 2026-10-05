// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Contrat de données du moteur : les formes qu'il reçoit et celles qu'il
// rend. Ce module ne porte que des définitions JSDoc et n'exécute rien ; un
// module cite un type par import('./types.js').Instance.

/**
 * @typedef {Object} Participant
 * @property {number} id             entier ≥ 1, unique, jamais réutilisé
 * @property {string} nom
 * @property {string} [prenom]
 * @property {string|null} appartenance  null = sans appartenance ; l'égalité
 *                                       de chaînes fait le groupe (la
 *                                       réconciliation est l'affaire du CSV)
 * @property {boolean} [exclu]       absent = false
 *
 * @typedef {Object} Table
 * @property {number} id             entier ≥ 1, unique
 * @property {number} numero         affiché, ≥ 1
 * @property {number} capacite       entier ≥ 2, défaut déjà résolu
 *
 * @typedef {Object} Reservation
 * @property {number} participant    id
 * @property {number} table          id
 * @property {'tous'|'tour'} portee
 * @property {number} [tour]         1..R, requis quand portee === 'tour'
 *
 * @typedef {Object} Contraintes
 * @property {boolean} separerAppartenances
 * @property {boolean} nouveauxVoisins
 * @property {boolean} nouvelleTable
 * @property {boolean} varierAppartenances
 *
 * @typedef {Object} Configuration
 * @property {Participant[]} participants
 * @property {Table[]} tables
 * @property {number} tours          R ≥ 1
 * @property {Reservation[]} reservations
 * @property {Contraintes} contraintes
 *
 * @typedef {Object} Plan           forme par identifiants (§ 8.9)
 * @property {number[]} tables       ids de table, dans l'ordre des listes
 * @property {number[][][]} tours    tours[r][i] = ids assis à tables[i], croissants
 * @property {number[][]} reserves   reserves[r] = ids assis nulle part au tour r
 *
 * @typedef {Object} Instance       forme indexée, consommée par le moteur
 * @property {number} N              participants non exclus
 * @property {number} T
 * @property {number} R
 * @property {number[]} ids          index → id participant, ordre croissant
 * @property {Map<number, number>} indexDe       id → index
 * @property {Set<number>} exclus    ids exclus (pour le vérificateur)
 * @property {number[]} idsTables    index → id table, ordre de configuration.tables
 * @property {Map<number, number>} indexTableDe
 * @property {Int32Array} capacite   par index de table
 * @property {Int32Array} groupe     par index participant ; −1 sans appartenance
 * @property {string[]} groupes      index de groupe → libellé ; ordre de première
 *                                   apparition en parcourant les ids croissants
 * @property {Int32Array} fixe       [p * R + r] → index de table imposé (r à
 *                                   partir de 0), −1 si libre
 * @property {Uint8Array} statut     0 mobile, 1 partiellement fixé, 2 ancré (§ 4.2)
 * @property {Int32Array} ancresParTable  a_t
 * @property {number} k              ancrés
 * @property {number} n              N − k
 * @property {Contraintes} contraintes
 *
 * Un plan indexé est un Int32Array `tableDe` de longueur N × R :
 * tableDe[p * R + r] = index de table, −1 pour la réserve.
 *
 * L'ordre canonique des tableaux par personne est celui de `instance.ids` :
 * tout tableau rendu par le moteur et indexé par personne suit cet ordre.
 */
