// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Contrat de données du moteur : les formes qu'il reçoit et celles qu'il
// rend. Ce module ne porte que des définitions JSDoc et n'exécute rien ; un
// module cite un type par import('./types.js').Instance. Les valeurs que ces
// formes portent — STATUT, LIBRE, RESERVE, SANS_GROUPE, SANS_OBJECTIF,
// NON_ANIMATEUR — sont définies et exportées par configuration.js, leur seul
// propriétaire.
//
// « Ancré » nomme la personne fixée à une même table à chaque tour (§ 4.2) ;
// « animateur » ne nomme que la personne qui anime à un tour au moins (§ 4.5,
// D6), que portent rangAnimateur et animes.

/**
 * @typedef {Object} Participant
 * @property {number} id             entier ≥ 1, unique, jamais réutilisé
 * @property {string} nom
 * @property {string} [prenom]
 * @property {string|null} organisation  null = sans organisation ; l'égalité
 *                                       de chaînes fait le groupe (la
 *                                       réconciliation est l'affaire du CSV)
 * @property {boolean} [exclu]       absent = false
 * @property {string[]} [etiquettes] absent = aucune ; l'égalité de chaînes
 *                                   les compare (§ 4.5)
 * @property {number[]} [anime]      tours, de 1 à R, strictement croissants,
 *                                   où la personne pourvoit un titre, fixée à
 *                                   la table du titre (D6) ; absent = n'anime
 *                                   à aucun tour
 * @property {number[]} [presence]   tours, de 1 à R, strictement croissants,
 *                                   où la personne est présente ; liste non
 *                                   vide ; absent = chacun des R tours, que
 *                                   lit toursDePresence (presence.js) ; une
 *                                   liste qui couvre 1..R vaut le champ absent
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
 * @typedef {Object} Objectif     objectif d'une table (§ 4.5)
 * @property {number} table          id
 * @property {number|null} tour      1..R ; null pour la soirée
 * @property {'ou'|'et'} regle       résolue : la règle propre, sinon le défaut
 * @property {string[]} etiquettes
 *
 * @typedef {Object} Contraintes
 * @property {boolean} separerOrganisations
 * @property {boolean} nouveauxVoisins
 * @property {boolean} nouvelleTable
 * @property {boolean} varierOrganisations
 * @property {boolean} [respecterObjectifs]    absent = vrai (A16)
 * @property {boolean} [rencontrerAnimateurs]  absent = faux (A16)
 *
 * @typedef {Object} Configuration
 * @property {Participant[]} participants
 * @property {Table[]} tables
 * @property {number} tours          R ≥ 1
 * @property {Reservation[]} reservations
 * @property {Contraintes} contraintes
 * @property {Objectif[]} [objectifs]          absent = aucun
 * @property {'chacun'|'minimum'} [modeObjectifs]  absent = 'places' (D20)
 * @property {Array<Array<{critere: string, poids: number}>>} [priorites]
 *                                   absent = PRIORITES_PAR_DEFAUT (criteres.js)
 *
 * @typedef {Object} Plan           forme par identifiants (§ 8.9)
 * @property {number[]} tables       ids de table, dans l'ordre des listes
 * @property {number[][][]} tours    tours[r][i] = ids assis à tables[i], croissants
 * @property {number[][]} reserves   reserves[r] = ids présents au tour r et
 *                                   assis nulle part ; un absent du tour ne
 *                                   figure dans aucune liste de ce tour
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
 * @property {Int32Array} groupe     par index participant ; SANS_GROUPE (−1)
 *                                   sans organisation
 * @property {string[]} groupes      index de groupe → libellé ; ordre de première
 *                                   apparition en parcourant les ids croissants
 * @property {Int32Array} debutEtiquettes N + 1 cases : les étiquettes de la
 *                                   personne p vont, dans etiquettes, de
 *                                   debutEtiquettes[p] à debutEtiquettes[p + 1] ;
 *                                   que des zéros sans étiquette
 * @property {Int32Array} etiquettes index dans libellesEtiquettes des
 *                                   étiquettes distinctes de chacun,
 *                                   croissants, personne par personne
 * @property {string[]} libellesEtiquettes  index d'étiquette → libellé : les
 *                                   étiquettes distinctes des présents,
 *                                   rangées par unités de code ; [] sans
 *                                   étiquette
 * @property {Int32Array} fixe       [p * R + r] → index de table imposé (r à
 *                                   partir de 0), LIBRE (−1) si libre ou
 *                                   absent au tour
 * @property {Uint8Array} statut     STATUT.MOBILE (0), STATUT.PARTIELLEMENT_FIXE
 *                                   (1), STATUT.ANCRE (2) (§ 4.2)
 * @property {Int32Array} ancresParTable  a_t
 * @property {number} k              ancrés
 * @property {number} n              N − k
 * @property {Uint8Array} present    [p * R + r] → 1 quand p est présent au
 *                                   tour r, 0 quand il est absent
 * @property {Int32Array} toursPresents   tours de présence de chacun, ≥ 1
 * @property {Int32Array} presentsParTour n_r, les présents de chaque tour, R
 *                                   cases
 * @property {number} absences       Σ_p (R − toursPresents[p]) ; 0 quand
 *                                   chacun est présent à chaque tour
 * @property {Int32Array} coPresents C(p) : les autres personnes présentes à
 *                                   un tour au moins où p l'est ; N − 1 sans
 *                                   absence
 * @property {Int32Array} mobilesCoPresents  n_p^C : parmi elles, les
 *                                   non-ancrées ; n − 1 pour un non-ancré, n
 *                                   pour un ancré, sans absence
 * @property {Contraintes} contraintes   copie ; les cases facultatives n'y
 *                                   figurent que si la configuration les porte
 * @property {Int32Array} siegesLibres    [t * R + r] → c_t moins les personnes
 *                                   que fixe y assied au tour r
 * @property {number} O              objectifs distincts : même règle, mêmes
 *                                   étiquettes dans le même ordre ; numérotés
 *                                   dans l'ordre des tables par identifiant
 *                                   croissant, la soirée puis les tours
 * @property {Int32Array} objectifDe [t * R + r] → objectif distinct en vigueur,
 *                                   celui du tour sinon celui de la soirée ;
 *                                   SANS_OBJECTIF (−1) sans objectif
 * @property {Uint8Array} correspond [p * O + o] → 1 quand p correspond à o
 *                                   (correspondA)
 * @property {Uint8Array} possible   [p * R + r] → 1 quand le couple (p, r) est
 *                                   possible (§ 4.5)
 * @property {Int32Array} possibles  P(p), tours possibles de chacun
 * @property {'places'|'chacun'|'minimum'} modeObjectifs
 * @property {number} A              animateurs
 * @property {Int32Array} rangAnimateur   par index participant : rang 0..A − 1,
 *                                   dans l'ordre des ids ; NON_ANIMATEUR (−1)
 * @property {Int32Array} animateurs rang → index participant
 * @property {Int32Array} debutAnimes     T × R + 1 cases : la ligne t * R + r
 *                                   de animes va de debutAnimes[t * R + r] à
 *                                   debutAnimes[t * R + r + 1]
 * @property {Int32Array} animes     rangs des animateurs qui animent à la table
 *                                   t au tour r, croissants, ligne par ligne
 * @property {Int32Array} borneAnimateurs B(p), la borne des animateurs
 *                                   (§ 4.5, D21) : le plus petit du nombre
 *                                   d'animateurs que p peut rejoindre et de la
 *                                   somme, sur les tours, du plus grand nombre
 *                                   d'animateurs à une table qu'il peut occuper
 * @property {Array<{nom: string, coche: boolean, sansObjet: boolean,
 *                   valeurs: string[]}>} etatCriteres
 *           un état par critère, dans l'ordre de CRITERES (criteres.js)
 * @property {Array<Array<{critere: string, poids: number}>>} priorites
 *           la liste complète (completerPriorites), valide sous le mode
 *
 * Un plan indexé est un Int32Array `tableDe` de longueur N × R :
 * tableDe[p * R + r] = index de table, RESERVE (−1) pour la réserve. Une
 * personne absente au tour r y vaut RESERVE : present[p * R + r] = 0 ⇒
 * tableDe[p * R + r] = RESERVE, et seul le masque la distingue d'une
 * personne en réserve. exigerPlanIndexe (configuration.js) en garde la
 * forme.
 *
 * L'ordre canonique des tableaux par personne est celui de `instance.ids` :
 * tout tableau rendu par le moteur et indexé par personne suit cet ordre.
 *
 * Une personne que le moteur désigne sans identifiant l'est par son index
 * canonique, son rang dans `instance.ids`, et `instance.ids[index]` en donne
 * l'identifiant. C'est le cas d'une violation de verifierIndicateurs,
 * { code, index } : ses trois listes ne portent pas d'identifiant, et la
 * traduction revient à l'appelant, qui tient l'instance. Les détails d'une
 * ErreurConfiguration et les violations de verifierInvariants désignent au
 * contraire les participants par identifiant.
 */
