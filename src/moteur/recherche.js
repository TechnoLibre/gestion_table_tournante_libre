// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Recherche reproductible (§ 5.7, § 5.10). Une génération rend plusieurs
// propositions ; chacune sort d'une descente par acceptation tardive (late
// acceptance hill climbing) sur le plan complet, les N participants et les R
// tours, ancrés compris : l'organisation d'un ancré pèse sur ses voisins de
// table comme celle de tout autre (§ 5.2).
//
// Graines. creerPcg32(graine, FLUX.GRAINES) tire une graine dérivée par
// proposition, la i-ème au i-ème tirage. La proposition i porte l'identifiant
// i et tire tout le reste, placements et mouvements, de
// creerPcg32(graine dérivée, FLUX.RECHERCHE). Elle ne dépend donc que de la
// configuration, de sa graine dérivée, du compte d'arrêt et de la longueur de
// l'historique, trois réglages qu'elle porte : la proposition 2 d'une demande
// de 3 est celle d'une demande de 5, quel que soit l'ordre dans lequel les
// propositions s'achèvent, et regenerer en rend le plan à partir de ces trois
// champs seuls (§ 8.9). proposerUne calcule la proposition d'un seul rang, ce
// qui répartit une génération entre plusieurs fils. repartir et repartirUne
// en sont les pendants sous un départ (paragraphe « Départ »), qui tirent
// leurs graines dérivées de la même suite. Tous passent par la même
// descente, proposer.
//
// Sièges. Chaque tour offre S = Σ c_t sièges, rangés table par table dans
// l'ordre des tables. Les personnes que instance.fixe impose à un tour
// occupent les premiers sièges de leur table, par index croissant, et n'en
// bougent jamais. Les autres sièges sont mobiles : chacun porte une personne
// libre à ce tour, ou une place fantôme, siège vide. Une personne absente à
// un tour n'y a ni siège fixé, sa réservation y étant suspendue, ni place
// parmi les libres : les sièges qu'elle laisse sont des places fantômes de
// plus, et sa case du plan indexé vaut RESERVE, qu'aucun mouvement ne change.
// Le placement initial mélange les personnes libres présentes de chaque tour
// par melanger, tour après tour, et les assied dans les sièges mobiles pris
// dans l'ordre ; les sièges qui restent sont des places fantômes. Sans place
// manquante à aucun tour, chaque présente est assise, et la réserve est
// vide.
//
// Mouvement. Un tour tiré par borne(R), puis deux sièges mobiles de ce tour,
// chacun par borne(m), m le nombre de ses sièges mobiles ; un tour de moins
// de deux sièges mobiles ne tire rien de plus. Deux sièges de la même table,
// ou deux places fantômes, font un mouvement évalué et rejeté, qui ne change
// rien. Sinon les deux occupants s'échangent : un échange avec une place
// fantôme déplace une personne vers le siège vide d'une autre table.
//
// Score. Un n-uplet d'entiers comparé dans l'ordre lexicographique, la forme
// exacte d'une pondération strictement hiérarchique, sans perte de
// précision. Sa forme est la compilation de la liste des priorités de
// l'instance, sous son mode des objectifs (compilationDe, criteres.js) : une
// composante par palier, dans l'ordre des paliers, et plusieurs pour un
// critère seul à son palier qui en descend plusieurs — l'écart au plafond a
// priori, son plus grand écart puis la somme des carrés des écarts ; les
// tours hors objectif, une à trois grandeurs selon le mode. Chaque composante
// vaut Σ poids × grandeur sur les critères de son palier, la grandeur lue
// sous son nom dans l'état ; les rencontres répétées y valent Σ_paires
// max(0, M − 1), M les rencontres de la paire, sous nouveauxVoisins, plus les
// retours choisis sous nouvelleTable. Un critère décoché ou sans objet ne
// pose aucune composante (§ 5.7, D10) : sous l'ordre par défaut, sans
// objectif ni case des animateurs, le n-uplet est celui de l'ordre fixe de
// référence, ses composantes toujours nulles en moins, ce qui ne change
// aucune comparaison. Aucune n'est négative, et le n-uplet nul ne s'améliore
// plus.
//
// Incrémental. L'état tient à jour ce dont le score dépend : la matrice des
// rencontres par paire ; rencontres(p) ; l'histogramme des écarts au plafond
// a priori, d'où leur maximum, et la somme de leurs carrés ; les collisions
// cumulées de même organisation et leur excédent ; Σ_paires max(0, M − 1) ;
// les visites par (personne, table), d'où les retours choisis ; par
// personne, le nombre d'affiliés rencontrés de chaque organisation, d'où
// |F(p)|, A(p) et Σ r(p). Un échange ne touche que les paires des deux tables
// concernées, au tour concerné : O(capacité).
//
// Les objectifs (A13). Les tours servis s(p) suivent la personne déplacée :
// la table de correspondance par objectif distinct dit si la table quittée
// et la table rejointe la servent, et s(p) change d'au plus un. Les tours hors
// objectif H changent de un ; les personnes jamais servies, sur la transition
// de s(p) entre 0 et 1 ; un histogramme des P(p) − s(p) des personnes
// concernées donne le plus grand E, qui ne bouge que de un, comme le plus
// grand écart, et le nombre de personnes à E, nul quand E l'est. O(1) par
// personne déplacée ; les quatre valeurs se tiennent sous tout mode.
//
// Les animateurs (D7, A13). Qui anime au tour r y est fixé : seul le déplacé
// change ses rencontres d'animateurs. Il quitte les animateurs de sa table
// de départ à ce tour et rejoint ceux de sa table d'arrivée, lui-même
// exclu ; un compteur par couple (personne, animateur) dit quand une
// rencontre apparaît ou disparaît, et m(p), avec les animateurs non
// rencontrés Σ (B(p) − m(p)), suit. Partager la table d'un animateur à un
// tour où il n'anime pas n'y compte pas : modifierPaire n'y touche pas.
// O(animateurs des deux tables), au plus O(capacité). L'état ne les tient
// que lorsque le n-uplet les compose, le critère coché et non sans objet :
// sinon aucune composante ne les lit, et la recherche ne paie rien pour
// eux, même quand des personnes animent.
//
// Ce score sert la boucle de recherche et rien d'autre ; scoreComplet
// recompose le même n-uplet à partir de la mesure qui fait foi, dont il lit
// chaque grandeur au lieu de la refaire (§ 5.10, § 13.2).
//
// Acceptation tardive. L'historique H, de longueur L, part du score initial.
// À l'itération i, le candidat est gardé s'il ne dépasse ni le score courant
// ni H[i mod L], défait sinon ; puis H[i mod L] reçoit le score courant. La
// meilleure affectation vue, dans l'ordre du score, est conservée. La
// recherche s'arrête après arret mouvements évalués, ou dès que le score
// courant est le n-uplet nul : sur un compte, jamais sur une durée (§ 5.10).
//
// Deux ordres d'acceptation. L'acceptation compare d'abord dans l'ordre du
// score, celui des paliers. Quand la meilleure affectation porte un écart
// maximal nul — lu au rang que la compilation donne au plus grand écart —,
// chacun atteint son plafond a priori : les composantes de l'écart sont à
// leur minimum prouvé (§ 5.5), et une meilleure affectation ne peut plus
// différer que sur les autres. L'acceptation compare alors dans l'ordre des
// contraintes de la compilation, où le palier de l'écart descend juste avant
// le premier palier « raffinement » qui le suit ; l'historique garde son
// contenu. Sous l'ordre par défaut, les composantes de l'excédent, des
// cumulées, des tours hors objectif et des rencontres répétées y passent
// devant celles de l'écart. L'ordre des contraintes laisse perdre une
// rencontre le temps de défaire une collision. L'ordre du score le refuse
// dès que l'historique ne porte plus que des scores à écart nul : collisions,
// voisins et tables n'y progressent plus que par les rares échanges qui
// conservent toutes les rencontres, et s'arrêtent loin de leur minimum. La
// meilleure affectation, jugée dans l'ordre du score, ne retient que des
// affectations à écart nul. Une instance dont aucun plan n'annule tous les
// écarts garde l'ordre du score de bout en bout.
//
// Relance. Dans l'ordre des contraintes, un score courant inchangé pendant
// PATIENCE × L itérations fait relancer la descente : le reste du compte
// sert une nouvelle descente, depuis un nouveau placement tiré du même
// générateur — pour une dérivée, depuis le plan de son départ (paragraphe
// « Départ ») —, l'historique au score de ce placement ; la meilleure
// affectation, et l'ordre des contraintes qu'elle fixe, sont conservés. Une
// descente de cet ordre s'arrête parfois sur un minimum local des voisins et
// des tables, des rencontres en deçà de leur plafond ; une descente neuve en
// est une tentative indépendante. Dans l'ordre du score, la relance ne joue
// pas : les échanges de même score y sont acceptés, un score courant
// inchangé y marque aussi bien un plateau que la descente parcourt, et une
// relance couperait ce parcours, d'autant plus souvent que L est court.
//
// La course (§ 5.10). Chaque proposition rapporte ses mouvements évalués —
// le compte d'arrêt, moins quand le n-uplet devient nul, zéro quand le
// placement initial l'est déjà — et ses points de relevé : la meilleure
// affectation copiée après k mouvements évalués, pour chaque puissance de
// dix k strictement sous le dernier. Ce dernier point est le plan de la
// proposition, qui ne se copie pas : au plus ⌊log₁₀ arret⌋ + 1 copies. La
// copie se prend à la fin de l'itération de rang k − 1, avant la relance
// que l'itération suivante peut faire ; elle ne tire rien et ne change
// aucune comparaison. La boucle ne lit le compte d'arrêt qu'à sa borne :
// le point k est donc le plan que la même graine rend au compte d'arrêt k.
// La recherche ne lit pas l'horloge et ne date rien.
//
// Départ (§ 5.7). repartir, repartirUne et regenerer sous un départ font
// partir chaque descente du départ ajusté à la présence, tiré du plan d'une
// proposition, au lieu d'un placement tiré : chaque fois que la descente
// tirerait un placement — à son début et à chaque relance —, elle repart de
// cet état, tours figés compris, construit une fois. L'ajustement lit le plan
// tour par tour : un identifiant que l'instance ne connaît pas, exclu ou
// supprimé, et une personne absente au tour sont ignorés, où que le plan les
// liste, et leur chaise devient libre ; une présente en réserve, ou que le
// plan n'assied pas, est à asseoir, sauf une réserve imposée par l'appelant
// (reservesImposees, tours figés seulement), qui reste en réserve à son tour ;
// une fixée à asseoir va à sa table. Aux tours non figés seulement, quand ses
// arrivantes fixées font déborder une table, les libres en trop de cette
// table, par index décroissants, passent à asseoir. Le plan du départ, brut
// ou déjà ajusté par le stockage — absents retirés, arrivantes en réserve —,
// donne ainsi le même état. Le remplissage canonique l'assied sans rien
// tirer : à chaque tour, les fixés à leurs sièges comme ailleurs, une fixée
// en réserve imposée hors du sien ; puis chaque libre gardé, par index
// croissant, au prochain siège mobile de la table que le plan lui donne, ou,
// quand ils manquent, au siège fixé qu'une réserve imposée de sa table
// laisse ; puis chaque libre à asseoir, par index croissant, au premier
// siège mobile resté vide, dans l'ordre des sièges ; l'ordre des listes du
// plan n'y entre pas. Aux tours non figés, ce siège canonique suffit : la
// recherche déplacera l'arrivante. Aux tours figés, aucun mouvement ne la
// déplacera : chaque libre à asseoir essaie la première place fantôme de
// chaque autre table, sa table restant celle de son siège canonique, et
// garde la première table, dans l'ordre des tables, au meilleur score dans
// l'ordre du score ; une fixée reste à sa table. Un tour figé est donc celui du départ, ajusté à la présence : les
// absents et les retirés quittent leur chaise, une arrivante prend la
// meilleure chaise libre admissible, ou reste en réserve quand l'appelant
// l'impose ; personne d'autre ne bouge. Le tour d'un mouvement se tire parmi
// les seuls tours non figés, par borne(k) sur leur liste, puis les deux
// sièges comme ailleurs : un tour figé ne consomme rien du compte, et reste
// celui du départ ajusté dans le plan rendu comme dans chaque point de
// relevé. Un tour figé n'est pas une réservation : instance.fixe ne change
// pas, et le score se compose sur les plafonds de la configuration. Une
// réserve imposée se mesure comme mesurer la lit : une fixée en réserve n'y
// fait aucune visite réservée, une animatrice en réserve n'y est rencontrée
// par personne, et le libre assis à son siège fixé, à une table sans siège
// libre, n'y est ni servi ni ne rencontre d'animateur. La meilleure
// affectation part du départ ajusté et ne change que sur un score
// strictement meilleur : une dérivée n'est jamais pire que son départ ajusté
// dans l'ordre du score, et le rend, case pour case, quand rien ne
// l'améliore. Le départ se contrôle avant tout calcul : un plan malformé ou
// qui contredit le mobilier — un plan qui n'a pas R tours ou pas une liste
// par table, une table inconnue qui assied quelqu'un, une présente assise
// deux fois, une table qui déborde de ses présentes, une présente fixée
// assise à une autre table que la sienne — et, à un tour figé, une table que
// ses arrivantes fixées font déborder faute de réserve imposée, lèvent
// DEPART_INCOMPATIBLE au lieu de partir d'un autre état que le plan. Le
// chemin ordinaire ne tire pas un nombre de plus : sans départ, le mélange
// est celui du paragraphe « Sièges » et le tour se tire par borne(R), comme
// au paragraphe « Mouvement » ; la descente choisit sa fonction de mouvement
// une fois, avant sa boucle.
import { FLUX, creerPcg32 } from '../demo/prng.js';
import {
  LIBRE,
  RESERVE,
  SANS_GROUPE,
  SANS_OBJECTIF,
  normaliser,
  placesManquantesParTour,
  planDepuisIndex,
} from './configuration.js';
import { compilationDe, composantesDe } from './criteres.js';
import { ErreurAnnulee, ErreurConfiguration } from './erreurs.js';
import { mesurer } from './indicateurs.js';
import { ecartsAuPlafondAPriori } from './manque.js';
import { plafondsAPriori } from './plafond.js';

/**
 * @typedef {Object} ReglagesGeneration
 * @property {number} graine        entier 0 ≤ g < 2^32
 * @property {number} arret         mouvements évalués par proposition, ≥ 1
 * @property {number} nombre        propositions demandées, ≥ 1
 * @property {number} [historique=1000]  longueur de l'historique d'acceptation
 *
 * @typedef {Object} Proposition
 * @property {number} id            1..nombre, place dans la suite des graines dérivées
 * @property {number} graine        graine dérivée de cette proposition
 * @property {number} arret
 * @property {number} historique    longueur de l'historique d'acceptation
 * @property {import('./types.js').Plan} plan
 * @property {number} evalues       mouvements évalués, de 0 à arret
 * @property {{mouvements: number, plan: import('./types.js').Plan}[]} releves
 *           les points de relevé copiés, mouvements croissants : chaque
 *           puissance de dix strictement sous evalues ; le dernier point,
 *           evalues, est plan
 * @property {number} [relances]    relances de la descente ; seules les
 *           propositions de repartir et repartirUne le portent
 *
 * @typedef {Object} DepartRecherche
 * @property {import('./types.js').Plan} plan   le plan du départ, par
 *           identifiants
 * @property {number[]} toursFiges   numéros des tours figés, de 1 à R,
 *           strictement croissants, possiblement vide, jamais tous les tours
 * @property {{participant: number, tour: number}[]} [reservesImposees=[]]
 *           les présentes qu'un tour figé laisse en réserve, triées par tour
 *           puis participant : chacune désigne une personne de l'instance,
 *           présente à ce tour, que le plan n'assied à aucune table à ce tour
 *
 * @typedef {Object} EtatRecherche
 * Rendu par creerEtat ; les champs qui suivent se lisent, aucun ne s'écrit
 * hors de ce module. Un champ qui tient une grandeur que mesurer rend en
 * porte le nom.
 * @property {Int32Array} tableDe            plan indexé courant, N × R ;
 *           RESERVE pour un absent, et pour une réserve imposée d'un départ
 * @property {Int32Array} rencontres         |met(p)|, ordre canonique
 * @property {Int32Array} affilies           |F(p)|
 * @property {Int32Array} organisationsVues  A(p)
 * @property {number} collisionsCumulees
 * @property {number} excedentCollisions     collisions cumulées − paires distinctes
 * @property {number} totalRetoursChoisis
 * @property {number} totalRedondance        Σ_p r(p)
 * @property {Int32Array} servis             s(p), tours servis
 * @property {number} horsObjectif           H, sur les personnes concernées
 * @property {number} jamaisServies          J
 * @property {number} horsObjectifMax        E
 * @property {number} personnesAuMax         concernés à E ; 0 quand E = 0
 * @property {boolean} suitAnimateurs   vrai quand le n-uplet compose les
 *           animateurs non rencontrés : l'état ne les tient qu'alors
 * @property {Int32Array|null} rencontresAnimateurs  m(p) ; null quand
 *           le n-uplet ne compose pas les animateurs non rencontrés
 * @property {number|null} animateursNonRencontres   Σ (B(p) − m(p)) ; null
 *           de même
 * @property {Object} composition        la forme du n-uplet de l'instance :
 *           taille, termes de chaque composante, ordres de comparaison,
 *           rang du plus grand écart et suitAnimateurs
 *
 * @typedef {{tour: number, a: number, b: number}} Mouvement
 *          l'échange des occupants des sièges a et b au tour d'index tour
 */

// Siège sans occupant : la place fantôme.
const FANTOME = -1;
// Itérations entre deux appels de progression, et entre deux lectures du
// signal.
const CADENCE = 1_000;
export const HISTORIQUE_PAR_DEFAUT = 1_000;
// Longueurs d'historique sans changement du score courant au-delà desquelles
// une descente se relance, dans l'ordre des contraintes seulement.
const PATIENCE = 10;
const MOT_MAX = 0xffffffff;
// Plus grand compte de rencontres d'une paire que tient un Uint16Array : une
// paire se réunit au plus une fois par tour.
const UINT16_MAX = 0xffff;
// Plus grand compte que tient un Uint8Array : une personne partage la table
// d'un animateur, là où il anime, au plus une fois par tour.
const UINT8_MAX = 0xff;

// Les grandeurs de l'état que le n-uplet compose, chacune par un code : la
// composition lit un code par terme, et ne parcourt les clés d'aucun objet.
const ECART = 0;
const CARRES = 1;
const EXCEDENT = 2;
const CUMULEES = 3;
const HORS_OBJECTIF = 4;
const JAMAIS_SERVIES = 5;
const HORS_OBJECTIF_MAX = 6;
const PERSONNES_AU_MAX = 7;
const EXCEDENT_PAIRES = 8;
const RETOURS = 9;
const ANIMATEURS = 10;
const REDONDANCE = 11;

// Le code de chaque grandeur que composantesDe nomme (criteres.js), les
// rencontres répétées mises à part : leur valeur dépend des cases. La Map ne
// sert qu'à retrouver un code par son nom.
const CODE_DE = new Map([
  ['ecartAuPlafondAPrioriMax', ECART],
  ['carresEcartsAuPlafondAPriori', CARRES],
  ['excedentCollisions', EXCEDENT],
  ['collisionsCumulees', CUMULEES],
  ['toursHorsObjectif', HORS_OBJECTIF],
  ['jamaisServies', JAMAIS_SERVIES],
  ['horsObjectifMax', HORS_OBJECTIF_MAX],
  ['personnesAuMax', PERSONNES_AU_MAX],
  ['animateursNonRencontres', ANIMATEURS],
  ['redondance', REDONDANCE],
]);

// La grandeur de code code, lue sous son nom dans q : l'état de recherche,
// ou les grandeurs que scoreComplet tire de la mesure.
function lire(q, code) {
  switch (code) {
    case ECART: return q.ecartAuPlafondAPrioriMax;
    case CARRES: return q.carresEcartsAuPlafondAPriori;
    case EXCEDENT: return q.excedentCollisions;
    case CUMULEES: return q.collisionsCumulees;
    case HORS_OBJECTIF: return q.horsObjectif;
    case JAMAIS_SERVIES: return q.jamaisServies;
    case HORS_OBJECTIF_MAX: return q.horsObjectifMax;
    case PERSONNES_AU_MAX: return q.personnesAuMax;
    case EXCEDENT_PAIRES: return q.excedentPaires;
    case RETOURS: return q.totalRetoursChoisis;
    case ANIMATEURS: return q.animateursNonRencontres;
    default: return q.totalRedondance;
  }
}

// La composition du n-uplet d'une instance, tirée de sa compilation : pour la
// composante k, les termes de debut[k] à debut[k + 1], chacun un code de
// grandeur et un poids ; puis les deux ordres de comparaison et le rang du
// plus grand écart (en-tête du module). Un critère seul à son palier pose un
// terme par composante qu'il descend ; un palier partagé, un terme par
// critère dans sa composante. Les rencontres répétées posent un terme par
// case cochée de « nouveaux voisins » et « nouvelle table », au même poids.
// suitAnimateurs dit qu'un terme lit les animateurs non rencontrés : l'état
// ne les tient qu'alors. Tout nom que pose la compilation a son code dans
// CODE_DE : compilationDe refuse un critère hors du registre CRITERES, et
// composantesDe ne rend, pour l'écart et les tours hors objectif, que des
// grandeurs de cette table.
function composition(instance) {
  const { paliers, ordreScore, ordreContraintes, rangEcart, taille } = compilationDe(instance);
  const { contraintes, modeObjectifs } = instance;
  const parComposante = Array.from({ length: taille }, () => []);
  const poser = (k, nom, poids) => {
    if (nom !== 'rencontresRepetees') {
      parComposante[k].push([CODE_DE.get(nom), poids]);
      return;
    }
    if (contraintes.nouveauxVoisins) parComposante[k].push([EXCEDENT_PAIRES, poids]);
    if (contraintes.nouvelleTable) parComposante[k].push([RETOURS, poids]);
  };
  for (const { criteres, composantes } of paliers) {
    if (criteres.length === 1) {
      const [{ nom, poids }] = criteres;
      composantesDe(nom, modeObjectifs).forEach((grandeur, i) => poser(composantes[i], grandeur, poids));
    } else {
      for (const { nom, poids } of criteres) poser(composantes[0], nom, poids);
    }
  }
  const debut = new Int32Array(taille + 1);
  for (let k = 0; k < taille; k += 1) debut[k + 1] = debut[k] + parComposante[k].length;
  const termes = parComposante.flat();
  return {
    taille,
    debut,
    codes: Int32Array.from(termes, ([code]) => code),
    poids: Float64Array.from(termes, ([, poids]) => poids),
    ordreScore: Int32Array.from(ordreScore),
    ordreContraintes: Int32Array.from(ordreContraintes),
    rangEcart,
    suitAnimateurs: termes.some(([code]) => code === ANIMATEURS),
  };
}

// Valeur citée dans un message : un nombre tel quel, toute autre valeur
// suivie de son type.
const decrire = (valeur) =>
  typeof valeur === 'number' ? String(valeur) : `${String(valeur)} (${typeof valeur})`;

// Lève une RangeError qui nomme le réglage quand la valeur n'est pas un
// entier de min à max : son message commence par le nom, et son champ
// reglage le porte.
function exigerReglage(nom, valeur, min, max) {
  if (!Number.isInteger(valeur) || valeur < min || valeur > max) {
    const erreur = new RangeError(`${nom} : entier de ${min} à ${max} attendu, reçu ${decrire(valeur)}`);
    erreur.reglage = nom;
    throw erreur;
  }
}

// Lève une RangeError qui nomme le premier des trois réglages qu'une
// proposition porte à sortir de son domaine, contrôlés dans cet ordre :
// graine de 0 à 2^32 − 1, arret et historique ≥ 1. rechercher et regenerer
// l'appellent tous deux : ce que l'un admet, l'autre l'admet, et regenerer
// accepte les champs de toute proposition que rechercher rend.
function exigerChampsProposition({ graine, arret, historique }) {
  exigerReglage('graine', graine, 0, MOT_MAX);
  exigerReglage('arret', arret, 1, Number.MAX_SAFE_INTEGER);
  exigerReglage('historique', historique, 1, Number.MAX_SAFE_INTEGER);
}

// Ce que toutes les propositions d'une instance partagent : la disposition
// des sièges, les sièges fixés et les sièges mobiles de chaque tour, les
// personnes libres présentes à chaque tour par index croissant, le plafond a
// priori de chacun, par (personne, table), le seuil de visites au-delà duquel
// une visite est un retour choisi, les animateurs de chaque table à chaque
// tour, et la composition du n-uplet. Un absent n'a ni siège fixé, sa
// réservation étant suspendue, ni entrée parmi les libres : les sièges qu'il
// laisse sont des places fantômes. Lève PLACES_MANQUANTES quand les sièges
// d'un tour ne suffisent pas à asseoir ses présents (§ 5.9) : détails
// {placesManquantes}, le plus grand manque, et, dès qu'une absence existe,
// tours, chaque tour à manque positif {tour, manque}, croissants ; sans
// absence, tours manque, et les détails sont ceux du compte sur N.
function preparer(instance) {
  const manques = placesManquantesParTour(instance);
  const placesManquantes = Math.max(...manques);
  if (placesManquantes > 0) {
    const details = instance.absences === 0
      ? { placesManquantes }
      : { placesManquantes, tours: manques.flatMap((manque, r) => (manque > 0 ? [{ tour: r + 1, manque }] : [])) };
    throw new ErreurConfiguration('PLACES_MANQUANTES', details);
  }
  const { N, T, R, capacite, fixe, present } = instance;

  const debut = new Int32Array(T + 1);
  for (let t = 0; t < T; t += 1) debut[t + 1] = debut[t] + capacite[t];
  const S = debut[T];
  const tableDuSiege = new Int32Array(S);
  for (let t = 0; t < T; t += 1) tableDuSiege.fill(t, debut[t], debut[t + 1]);

  // siegesFixes[r × S + s] : la personne fixée au siège s du tour r,
  // FANTOME pour un siège mobile. mobiles[r × S + i], i < nombreMobiles[r] :
  // le i-ème siège mobile du tour r, dans l'ordre des sièges.
  const siegesFixes = new Int32Array(R * S).fill(FANTOME);
  const mobiles = new Int32Array(R * S);
  const nombreMobiles = new Int32Array(R);
  const libres = [];
  const occupes = new Int32Array(T);
  for (let r = 0; r < R; r += 1) {
    occupes.fill(0);
    const libresDuTour = [];
    for (let p = 0; p < N; p += 1) {
      const t = fixe[p * R + r];
      if (t === LIBRE) {
        if (present[p * R + r] === 1) libresDuTour.push(p);
      } else {
        siegesFixes[r * S + debut[t] + occupes[t]] = p;
        occupes[t] += 1;
      }
    }
    libres.push(libresDuTour);
    let m = 0;
    for (let s = 0; s < S; s += 1) {
      if (siegesFixes[r * S + s] === FANTOME) {
        mobiles[r * S + m] = s;
        m += 1;
      }
    }
    nombreMobiles[r] = m;
  }

  // Pour une table visitée m fois, dont f à un tour où la personne y est
  // fixée, les retours choisis valent m − 1 − max(0, f − 1) (indicateurs.js),
  // soit max(0, m − max(1, f)) : le seuil vaut max(1, f).
  const seuilRetour = new Int32Array(N * T);
  for (let p = 0; p < N; p += 1) {
    for (let r = 0; r < R; r += 1) {
      const t = fixe[p * R + r];
      if (t !== LIBRE) seuilRetour[p * T + t] += 1;
    }
  }
  for (let i = 0; i < seuilRetour.length; i += 1) {
    if (seuilRetour[i] === 0) seuilRetour[i] = 1;
  }

  const aPriori = Int32Array.from(plafondsAPriori(instance));
  let plusGrand = 0;
  for (let p = 0; p < N; p += 1) plusGrand = Math.max(plusGrand, aPriori[p]);

  return {
    instance,
    N,
    T,
    R,
    S,
    debut,
    tableDuSiege,
    siegesFixes,
    mobiles,
    nombreMobiles,
    libres,
    seuilRetour,
    debutAnimes: instance.debutAnimes,
    animes: instance.animes,
    aPriori,
    largeurHistogramme: plusGrand + 1,
    composition: composition(instance),
  };
}

// Les écarts au plafond a priori restent dans 0..aPriori[p] : sur un plan
// qui honore fixe et les capacités, rencontres ≤ plafond réalisé ≤ plafond a
// priori (plafond.js). Une hausse des rencontres ne fait baisser l'écart que
// d'un : quand le maximum perd son dernier porteur, e − 1 en a un.
function changerRencontres(etat, p, sens) {
  const { rencontres, histogramme } = etat;
  const avant = etat.aPriori[p] - rencontres[p];
  const apres = avant - sens;
  rencontres[p] += sens;
  histogramme[avant] -= 1;
  histogramme[apres] += 1;
  etat.carresEcartsAuPlafondAPriori += apres * apres - avant * avant;
  if (apres > etat.ecartAuPlafondAPrioriMax) {
    etat.ecartAuPlafondAPrioriMax = apres;
  } else if (avant === etat.ecartAuPlafondAPrioriMax && histogramme[avant] === 0) {
    etat.ecartAuPlafondAPrioriMax = apres;
  }
}

// p commence (sens = 1) ou cesse (sens = −1) de compter parmi ses
// rencontres un affilié du groupe g : |F(p)| suit, A(p) quand c'est le
// premier ou le dernier de ce groupe, et Σ r(p) = Σ (|F(p)| − A(p)) avec eux.
function changerAffilie(etat, p, g, sens) {
  const i = p * etat.G + g;
  const avant = etat.parGroupe[i];
  etat.parGroupe[i] = avant + sens;
  etat.affilies[p] += sens;
  let vues = 0;
  if (avant === (sens > 0 ? 0 : 1)) {
    etat.organisationsVues[p] += sens;
    vues = sens;
  }
  etat.totalRedondance += sens - vues;
}

// Ajoute sens, 1 ou −1, aux rencontres de la paire (a, b), a ≠ b, et
// propage : les collisions cumulées pour deux personnes de la même
// organisation. Quand la paire était réunie avant un ajout, ou le reste
// après un retrait, la rencontre ajoutée ou retirée est une répétition :
// elle compte dans Σ max(0, M − 1) et, entre collègues, dans l'excédent de
// collisions, qui vaut Σ max(0, M − 1) sur les paires de même organisation.
// Sinon la paire devient réunie ou cesse de l'être : les rencontres et les
// affiliés des deux suivent.
function modifierPaire(etat, a, b, sens) {
  const k = a < b ? a * etat.N + b : b * etat.N + a;
  const avant = etat.paires[k];
  const apres = avant + sens;
  etat.paires[k] = apres;
  const ga = etat.groupe[a];
  const gb = etat.groupe[b];
  const memeGroupe = ga === gb && etat.porteOrganisation[a] === 1;
  if (memeGroupe) etat.collisionsCumulees += sens;
  if ((sens > 0 ? avant : apres) !== 0) {
    etat.excedentPaires += sens;
    if (memeGroupe) etat.excedentCollisions += sens;
    return;
  }
  changerRencontres(etat, a, sens);
  changerRencontres(etat, b, sens);
  if (etat.porteOrganisation[b] === 1) changerAffilie(etat, a, gb, sens);
  if (etat.porteOrganisation[a] === 1) changerAffilie(etat, b, ga, sens);
}

// p gagne (sens = 1) ou perd (sens = −1) un tour servi ; p est concerné, et
// P(p) − s(p) reste dans 0..P(p). Les tours hors objectif changent de −sens ;
// les jamais servies, quand s(p) passe de 0 à 1 ou de 1 à 0. Une baisse de
// P(p) − s(p) ne fait baisser le plus grand E que d'un : quand E perd son
// dernier porteur, E − 1 en a un. Le nombre de personnes à E se relit dans
// l'histogramme, et vaut 0 quand E est nul.
function changerServis(etat, p, sens) {
  const { servis, histogrammeObjectifs } = etat;
  const avant = etat.possibles[p] - servis[p];
  const apres = avant - sens;
  servis[p] += sens;
  histogrammeObjectifs[avant] -= 1;
  histogrammeObjectifs[apres] += 1;
  etat.horsObjectif -= sens;
  if (servis[p] === (sens > 0 ? 1 : 0)) etat.jamaisServies -= sens;
  if (apres > etat.horsObjectifMax) {
    etat.horsObjectifMax = apres;
  } else if (avant === etat.horsObjectifMax && histogrammeObjectifs[avant] === 0) {
    etat.horsObjectifMax = apres;
  }
  etat.personnesAuMax = etat.horsObjectifMax === 0 ? 0 : histogrammeObjectifs[etat.horsObjectifMax];
}

// 1 quand la table t sert p au tour r : un objectif y est en vigueur, et p
// lui correspond ; 0 sinon.
function sert(etat, p, t, r) {
  const o = etat.objectifDe[t * etat.R + r];
  return o !== SANS_OBJECTIF && etat.correspond[p * etat.O + o] === 1 ? 1 : 0;
}

// p rejoint (sens = 1) ou quitte (sens = −1) les animateurs qui animent à la
// table t au tour r, lui-même exclu : une rencontre apparaît quand le compte
// du couple passe de 0 à 1, disparaît quand il revient à 0.
function changerAnimateurs(etat, p, t, r, sens) {
  const { debutAnimes, animes, rencontresAnimees, A } = etat;
  const ligne = t * etat.R + r;
  const soi = etat.rangAnimateur[p];
  for (let k = debutAnimes[ligne], fin = debutAnimes[ligne + 1]; k < fin; k += 1) {
    const f = animes[k];
    if (f === soi) continue;
    const i = p * A + f;
    const avant = rencontresAnimees[i];
    rencontresAnimees[i] = avant + sens;
    if (avant === (sens > 0 ? 0 : 1)) {
      etat.rencontresAnimateurs[p] += sens;
      etat.animateursNonRencontres -= sens;
    }
  }
}

// p, libre au tour r, passe de la table depart à la table arrivee : ses tours
// servis et, quand l'état les tient, ses rencontres d'animateurs suivent
// (en-tête du module).
function changerTable(etat, p, depart, arrivee, r) {
  if (etat.O > 0) {
    const ecart = sert(etat, p, arrivee, r) - sert(etat, p, depart, r);
    if (ecart !== 0) changerServis(etat, p, ecart);
  }
  if (etat.suitAnimateurs) {
    changerAnimateurs(etat, p, depart, r, -1);
    changerAnimateurs(etat, p, arrivee, r, 1);
  }
}

// Ajoute sens aux visites de p à la table t, et ajuste les retours choisis.
function changerVisite(etat, p, t, sens) {
  const i = p * etat.T + t;
  const avant = etat.visites[i];
  const apres = avant + sens;
  etat.visites[i] = apres;
  const seuil = etat.seuilRetour[i];
  etat.totalRetoursChoisis += Math.max(0, apres - seuil) - Math.max(0, avant - seuil);
}

// Ajoute sens aux rencontres de p avec chaque occupant de la table t au tour
// dont les sièges commencent à base, le siège exclu mis à part.
function voisiner(etat, p, base, t, exclu, sens) {
  const { siege, debut } = etat;
  for (let s = debut[t], fin = debut[t + 1]; s < fin; s += 1) {
    if (s === exclu) continue;
    const q = siege[base + s];
    if (q !== FANTOME) modifierPaire(etat, p, q, sens);
  }
}

// Échange les occupants des sièges a et b, de deux tables différentes, au
// tour r. Chaque occupant quitte d'abord ses voisins, puis rejoint ceux de
// l'autre table, ses tours servis et ses animateurs avec : l'échange est sa
// propre réciproque, et le refaire rend l'état d'avant, compteurs compris.
function echanger(etat, r, a, b) {
  const { siege, tableDe, tableDuSiege, R } = etat;
  const base = r * etat.S;
  const x = siege[base + a];
  const y = siege[base + b];
  const ta = tableDuSiege[a];
  const tb = tableDuSiege[b];
  if (x !== FANTOME) voisiner(etat, x, base, ta, a, -1);
  if (y !== FANTOME) voisiner(etat, y, base, tb, b, -1);
  siege[base + a] = y;
  siege[base + b] = x;
  if (x !== FANTOME) {
    tableDe[x * R + r] = tb;
    changerVisite(etat, x, ta, -1);
    changerVisite(etat, x, tb, 1);
    voisiner(etat, x, base, tb, b, 1);
    changerTable(etat, x, ta, tb, r);
  }
  if (y !== FANTOME) {
    tableDe[y * R + r] = ta;
    changerVisite(etat, y, tb, -1);
    changerVisite(etat, y, ta, 1);
    voisiner(etat, y, base, ta, a, 1);
    changerTable(etat, y, tb, ta, r);
  }
}

// Placement initial d'une instance préparée : les personnes fixées à leurs
// sièges, les libres présentes de chaque tour mélangées puis assises dans
// l'ordre des sièges mobiles ; une case du plan indexé sans siège, celle d'un
// absent, vaut RESERVE. Les compteurs partent de zéro et suivent chaque paire,
// chaque visite et chaque rencontre d'animateur par les mêmes fonctions que
// les mouvements ; les écarts partent du plafond a priori, aucune rencontre
// n'étant encore comptée, et les animateurs non rencontrés de Σ B(p),
// quand l'état les tient (suitAnimateurs de la composition). Les
// tours servis se comptent siège par siège, puis l'histogramme des
// P(p) − s(p) se forme sur les personnes concernées. Chaque personne assise
// l'est à une table qu'elle peut occuper — sa table fixée, ou un siège
// mobile, que seule une table à siège libre offre — : servie et rencontres
// d'animateurs s'y lisent alors, comme mesurer les lit. Un libre que le
// départ assied au siège fixé d'une réserve imposée, à une table sans siège
// libre (paragraphe « Départ »), n'y est ni servi ni ne rencontre
// d'animateur, comme mesurer le lit ; aucun mouvement ne l'y conduit, ce
// siège n'étant pas mobile.
//
// remplir, quand il n'est pas null, assied les libres à la place du
// mélange : remplir(etat) écrit les sièges dans etat.siege, où les fixés
// sont déjà, sans rien tirer de rng (paragraphe « Départ »).
function etatInitial(structure, rng, remplir = null) {
  const { instance, N, T, R, S, mobiles, libres, aPriori, tableDuSiege, debut } = structure;
  const { fixe, siegesLibres } = instance;
  const G = instance.groupes.length;
  const { suitAnimateurs } = structure.composition;
  const etat = {
    instance,
    contraintes: instance.contraintes,
    groupe: instance.groupe,
    // porteOrganisation[p] vaut 1 quand p porte une organisation, 0 pour
    // SANS_GROUPE.
    // modifierPaire le lit au lieu de comparer un groupe à SANS_GROUPE : sous
    // le lanceur d'épreuves, chaque lecture d'une valeur importée passe par
    // un accesseur, que la boucle de recherche paierait à chaque paire.
    porteOrganisation: Uint8Array.from(instance.groupe, (g) => (g === SANS_GROUPE ? 0 : 1)),
    N,
    T,
    R,
    S,
    G,
    debut,
    tableDuSiege,
    mobiles,
    nombreMobiles: structure.nombreMobiles,
    seuilRetour: structure.seuilRetour,
    aPriori,
    siege: Int32Array.from(structure.siegesFixes),
    tableDe: new Int32Array(N * R).fill(RESERVE),
    paires: R <= UINT16_MAX ? new Uint16Array(N * N) : new Uint32Array(N * N),
    rencontres: new Int32Array(N),
    affilies: new Int32Array(N),
    organisationsVues: new Int32Array(N),
    parGroupe: new Int32Array(N * G),
    visites: new Int32Array(N * T),
    histogramme: new Int32Array(structure.largeurHistogramme),
    ecartAuPlafondAPrioriMax: 0,
    carresEcartsAuPlafondAPriori: 0,
    collisionsCumulees: 0,
    excedentCollisions: 0,
    excedentPaires: 0,
    totalRetoursChoisis: 0,
    totalRedondance: 0,
    // Les objectifs : la correspondance par objectif distinct et P(p), de
    // l'instance ; s(p) et l'histogramme des P(p) − s(p), de cet état.
    O: instance.O,
    objectifDe: instance.objectifDe,
    correspond: instance.correspond,
    possibles: instance.possibles,
    servis: new Int32Array(N),
    histogrammeObjectifs: new Int32Array(R + 1),
    horsObjectif: 0,
    jamaisServies: 0,
    horsObjectifMax: 0,
    personnesAuMax: 0,
    // Les animateurs : qui anime à chaque table et chaque tour, de
    // l'instance ; le compte de chaque couple (personne, animateur), m(p) et
    // Σ (B(p) − m(p)), de cet état, null quand il ne les tient pas.
    suitAnimateurs,
    A: instance.A,
    rangAnimateur: instance.rangAnimateur,
    debutAnimes: structure.debutAnimes,
    animes: structure.animes,
    rencontresAnimees: !suitAnimateurs
      ? null
      : R <= UINT8_MAX ? new Uint8Array(N * instance.A) : new Uint32Array(N * instance.A),
    rencontresAnimateurs: suitAnimateurs ? new Int32Array(N) : null,
    animateursNonRencontres: suitAnimateurs ? 0 : null,
  };
  for (let p = 0; p < N; p += 1) {
    etat.histogramme[aPriori[p]] += 1;
    etat.carresEcartsAuPlafondAPriori += aPriori[p] * aPriori[p];
    etat.ecartAuPlafondAPrioriMax = Math.max(etat.ecartAuPlafondAPrioriMax, aPriori[p]);
    if (suitAnimateurs) etat.animateursNonRencontres += instance.borneAnimateurs[p];
  }
  const { siege, tableDe } = etat;
  if (remplir === null) {
    for (let r = 0; r < R; r += 1) {
      const melanges = rng.melanger(Int32Array.from(libres[r]));
      for (let i = 0; i < melanges.length; i += 1) siege[r * S + mobiles[r * S + i]] = melanges[i];
    }
  } else {
    remplir(etat);
  }
  for (let r = 0; r < R; r += 1) {
    const base = r * S;
    for (let s = 0; s < S; s += 1) {
      const p = siege[base + s];
      if (p === FANTOME) continue;
      const t = tableDuSiege[s];
      tableDe[p * R + r] = t;
      changerVisite(etat, p, t, 1);
      for (let voisin = debut[t]; voisin < s; voisin += 1) {
        const q = siege[base + voisin];
        if (q !== FANTOME) modifierPaire(etat, p, q, 1);
      }
      if (fixe[p * R + r] === LIBRE && siegesLibres[t * R + r] === 0) continue;
      if (etat.O > 0) etat.servis[p] += sert(etat, p, t, r);
      if (suitAnimateurs) changerAnimateurs(etat, p, t, r, 1);
    }
  }
  for (let p = 0; p < N; p += 1) {
    const P = etat.possibles[p];
    if (P === 0) continue;
    const hors = P - etat.servis[p];
    etat.histogrammeObjectifs[hors] += 1;
    etat.horsObjectif += hors;
    if (etat.servis[p] === 0) etat.jamaisServies += 1;
    etat.horsObjectifMax = Math.max(etat.horsObjectifMax, hors);
  }
  etat.personnesAuMax = etat.horsObjectifMax === 0 ? 0 : etat.histogrammeObjectifs[etat.horsObjectifMax];
  return etat;
}

// Écrit dans sortie le n-uplet du score, à partir des grandeurs nommées de
// q, et le rend : chaque composante, Σ poids × grandeur sur ses termes
// (composition). Une seule composition sert le score tenu à jour et le score
// recalculé ; une grandeur que mesurer rend y porte son nom, et la
// composition n'en refait aucune, ni ne tient aucun cumul pondéré.
function composer({ taille, debut, codes, poids }, q, sortie) {
  for (let k = 0; k < taille; k += 1) {
    let somme = 0;
    for (let j = debut[k], fin = debut[k + 1]; j < fin; j += 1) somme += poids[j] * lire(q, codes[j]);
    sortie[k] = somme;
  }
  return sortie;
}

// Signe de la comparaison lexicographique des n-uplets a[ia …] et b[ib …],
// composantes prises dans l'ordre que donne la liste ordre, une par
// composante.
function comparer(ordre, a, ia, b, ib) {
  for (let j = 0; j < ordre.length; j += 1) {
    const k = ordre[j];
    const difference = a[ia + k] - b[ib + k];
    if (difference !== 0) return difference;
  }
  return 0;
}

// Ordre d'acceptation que fixe la meilleure affectation : celui des
// contraintes dès que son écart maximal, au rang que la composition donne au
// plus grand écart, est nul (en-tête du module) ; celui du score quand
// l'écart ne compte pas. Cet écart ne fait que baisser d'une meilleure
// affectation à la suivante : une fois nul, il le reste.
const ordreAccepte = ({ rangEcart, ordreScore, ordreContraintes }, meilleurScore) =>
  rangEcart !== null && meilleurScore[rangEcart] === 0 ? ordreContraintes : ordreScore;

function estNul(score) {
  for (let k = 0; k < score.length; k += 1) if (score[k] !== 0) return false;
  return true;
}

// Lit signal.aborted une fois, et lève ErreurAnnulee s'il est vrai.
function lireSignal(signal) {
  if (signal?.aborted) throw new ErreurAnnulee('recherche annulée');
}

// Descente par acceptation tardive depuis un placement initial tiré de rng ;
// rend { plan, evalues, releves, relances } : la meilleure affectation vue,
// en plan indexé, les mouvements évalués, et les copies de la meilleure
// affectation aux points de relevé, { mouvements, tableDe }, mouvements
// croissants (en-tête du module, « La course »). L'ordre d'acceptation suit
// la meilleure affectation (ordreAccepte). Dans l'ordre des
// contraintes, un score courant inchangé pendant PATIENCE × historique
// itérations fait relancer la descente (en-tête du module). La bascule vers
// cet ordre suit une meilleure affectation, donc un changement du score
// courant, qui remet immobile à zéro. fait compte les mouvements évalués
// depuis le début de la génération, à partir de dejaFaits, ceux des
// propositions précédentes : à chaque multiple de CADENCE,
// progression(fait, total), puis une lecture du signal.
//
// Sous un départ (paragraphe « Départ »), depart() construit l'état du
// départ, au début et à chaque relance, et tirables liste les index des
// tours non figés, où proposerParmi tire chaque mouvement ; null pour l'un
// et l'autre, la descente tire son placement de rng et ses mouvements par
// proposerEtAppliquer. La fonction de mouvement se choisit une fois, avant
// la boucle. Rend aussi relances, le nombre de relances.
function descendre(structure, rng, {
  arret,
  historique,
  dejaFaits,
  total,
  signal,
  progression,
  depart = null,
  tirables = null,
}) {
  const { composition: forme } = structure;
  const { taille, ordreScore, ordreContraintes } = forme;
  const partir = depart ?? (() => etatInitial(structure, rng));
  const mouvoir = tirables === null ? proposerEtAppliquer : (e, g) => proposerParmi(e, g, tirables);
  let etat = partir();
  const courant = composer(forme, etat, new Float64Array(taille));
  const candidat = new Float64Array(taille);
  const meilleurScore = Float64Array.from(courant);
  const meilleurPlan = Int32Array.from(etat.tableDe);
  const memoire = new Float64Array(historique * taille);
  const remplirMemoire = () => {
    for (let v = 0; v < memoire.length; v += taille) memoire.set(courant, v);
  };
  // Garde l'état courant comme meilleure affectation s'il la dépasse dans
  // l'ordre du score, et rend l'ordre d'acceptation qui en découle.
  const retenir = (ordre) => {
    if (comparer(ordreScore, courant, 0, meilleurScore, 0) >= 0) return ordre;
    meilleurScore.set(courant);
    meilleurPlan.set(etat.tableDe);
    return ordreAccepte(forme, meilleurScore);
  };
  remplirMemoire();
  let ordre = ordreAccepte(forme, meilleurScore);
  const patience = PATIENCE * historique;
  let immobile = 0;
  let relances = 0;
  // releve : la prochaine puissance de dix ; i, à la sortie de la boucle, les
  // mouvements évalués.
  const releves = [];
  let releve = 1;
  let i = 0;
  for (; i < arret && !estNul(courant); i += 1) {
    if (immobile >= patience && ordre === ordreContraintes) {
      etat = partir();
      composer(forme, etat, courant);
      remplirMemoire();
      ordre = retenir(ordre);
      immobile = 0;
      relances += 1;
    }
    const mouvement = mouvoir(etat, rng);
    const v = (i % historique) * taille;
    let change = false;
    if (mouvement !== null) {
      composer(forme, etat, candidat);
      if (comparer(ordre, candidat, 0, courant, 0) <= 0
        || comparer(ordre, candidat, 0, memoire, v) <= 0) {
        change = comparer(ordreScore, candidat, 0, courant, 0) !== 0;
        courant.set(candidat);
        ordre = retenir(ordre);
      } else {
        defaire(etat, mouvement);
      }
    }
    memoire.set(courant, v);
    immobile = change ? 0 : immobile + 1;
    // Après releve mouvements évalués : la copie se garde quand la boucle
    // continue, la borne de la boucle relue ; sinon ce point est le plan rendu.
    if (i + 1 === releve) {
      if (i + 1 < arret && !estNul(courant)) {
        releves.push({ mouvements: releve, tableDe: Int32Array.from(meilleurPlan) });
      }
      releve *= 10;
    }
    const fait = dejaFaits + i + 1;
    if (fait % CADENCE === 0) {
      progression?.(fait, total);
      lireSignal(signal);
    }
  }
  return { plan: meilleurPlan, evalues: i, releves, relances };
}

// La descente de la proposition de graine dérivée graineDerivee, depuis
// creerPcg32(graineDerivee, FLUX.RECHERCHE), en plans indexés (descendre).
// rechercher, proposerUne, repartir, repartirUne et regenerer l'appellent
// tous. À instance égale, le résultat ne dépend que de la graine dérivée,
// d'options.arret, d'options.historique et, sous un départ, d'options.depart
// et d'options.tirables : les autres options ne servent qu'à rapporter
// l'avancement et à lire le signal.
function proposer(structure, graineDerivee, options) {
  const rng = creerPcg32(graineDerivee, FLUX.RECHERCHE);
  return descendre(structure, rng, options);
}

// La proposition d'identifiant id : ses trois réglages, puis le plan, les
// mouvements évalués et les points de relevé de sa descente, chaque plan
// rendu par identifiants.
const propositionDe = (instance, { id, graine, arret, historique }, { plan, evalues, releves }) => ({
  id,
  graine,
  arret,
  historique,
  plan: planDepuisIndex(instance, plan),
  evalues,
  releves: releves.map(({ mouvements, tableDe }) => ({ mouvements, plan: planDepuisIndex(instance, tableDe) })),
});

// Cases d'un plan indexé que le départ n'a encore assises nulle part, ou
// qu'il range en réserve.
const NON_ASSIS = -2;
const EN_RESERVE = -3;

// Lève une RangeError dont le message commence par nom et dont le champ
// reglage le porte, comme exigerReglage.
function refuserReglage(nom, raison) {
  const erreur = new RangeError(`${nom} : ${raison}`);
  erreur.reglage = nom;
  throw erreur;
}

// Lève une RangeError de champ reglage 'toursFiges' quand toursFiges n'est
// pas une liste d'entiers de 1 à R strictement croissante, ou qu'elle les
// porte tous : il ne resterait rien à refaire.
function exigerToursFiges(toursFiges, R) {
  const refuser = (raison) => refuserReglage('toursFiges', raison);
  if (!Array.isArray(toursFiges)) refuser(`liste attendue, reçu ${decrire(toursFiges)}`);
  toursFiges.forEach((tour, i) => {
    if (!Number.isInteger(tour) || tour < 1 || tour > R) refuser(`tour de 1 à ${R} attendu, reçu ${decrire(tour)}`);
    if (i > 0 && tour <= toursFiges[i - 1]) refuser('liste strictement croissante attendue');
  });
  if (toursFiges.length === R) refuser(`les ${R} tours figés ne laissent rien à refaire`);
}

// Les réserves imposées du départ, contrôlées : imposee[p × R + r] vaut 1
// quand {participant, tour} désigne la personne d'index p au tour r + 1.
// Chaque entrée nomme un tour figé (fige[r] = 1), une personne de l'instance,
// présente à ce tour et absente des listes de table du plan à ce tour ; les
// entrées croissent strictement par tour, puis par participant. Lève, pour la
// première entrée fautive, une RangeError de champ reglage
// 'reservesImposees' ; une liste qui n'en est pas une la lève aussi. Un tour
// que le plan n'a pas se lit sans liste : DEPART_INCOMPATIBLE le refuse
// ensuite.
function exigerReservesImposees({ instance, N, R }, reservesImposees, fige, plan) {
  const refuser = (raison) => refuserReglage('reservesImposees', raison);
  if (!Array.isArray(reservesImposees)) refuser(`liste attendue, reçu ${decrire(reservesImposees)}`);
  const { indexDe, present } = instance;
  const imposee = new Uint8Array(N * R);
  let precedente = null;
  for (const entree of reservesImposees) {
    const { participant, tour } = entree ?? {};
    if (!Number.isInteger(tour) || tour < 1 || tour > R || fige[tour - 1] === 0) {
      refuser(`tour figé attendu, reçu ${decrire(tour)}`);
    }
    const p = indexDe.get(participant);
    if (p === undefined) refuser(`participant ${decrire(participant)} inconnu de l'instance`);
    if (precedente !== null
      && (tour < precedente.tour || (tour === precedente.tour && participant <= precedente.participant))) {
      refuser('entrées strictement croissantes par tour, puis par participant, attendues');
    }
    if (present[p * R + tour - 1] === 0) refuser(`participant ${participant} absent au tour ${tour}`);
    const listes = plan?.tours?.[tour - 1];
    if (Array.isArray(listes) && listes.some((liste) => Array.isArray(liste) && liste.includes(participant))) {
      refuser(`participant ${participant} assis au tour ${tour} du départ`);
    }
    imposee[p * R + tour - 1] = 1;
    precedente = { participant, tour };
  }
  return imposee;
}

// Le départ ajusté à la présence, contrôlé contre la structure (paragraphe
// « Départ »). Rend tableDe[p × R + r], l'index de la table où le départ
// garde p, RESERVE pour un absent, une réserve imposée et une personne à
// asseoir ; et aAsseoir[r], les présents que le départ n'assied pas au tour
// r, réserves imposées mises à part, ou qu'une arrivante fixée chasse de sa
// table, index croissants. Un identifiant étranger à l'instance (exclu,
// supprimé) et une personne absente du tour sont ignorés, où que le plan les
// liste : leur chaise devient libre, et ils ne comptent dans aucune table.
// Lève ErreurConfiguration('DEPART_INCOMPATIBLE', {tour, table,
// participant}), tour de 1 à R, table et participant par identifiant ou
// null, pour le premier écart, tour après tour : un plan qui n'a pas R tours
// (tour, le premier qui manque ou qui est de trop) ou pas une liste par table
// déclarée ; une table inconnue qui assied quelqu'un, même un ignoré
// (table) ; une présente assise deux fois, réserve comprise (table et
// participant, table null pour la réserve) ; une table qui déborde de ses
// présentes (table) ; une présente fixée assise ailleurs (participant, et
// table, celle où elle est fixée) ; à un tour figé, une table que ses
// arrivantes fixées font déborder (table). À un tour non figé, ce
// débordement fait passer à asseoir ses libres en trop, par index
// décroissants : le nombre de sièges suffit, preparer ayant garanti n_r ≤ S.
// L'ordre des listes et des tables n'y entre pas.
function tableDuDepart(structure, plan, fige, imposee) {
  const { instance, N, T, R } = structure;
  const { ids, idsTables, indexDe, indexTableDe, capacite, fixe, present } = instance;
  const refuser = (tour, table, participant) => {
    throw new ErreurConfiguration('DEPART_INCOMPATIBLE', { tour, table, participant });
  };
  if (plan.tours.length !== R) refuser(Math.min(plan.tours.length, R) + 1, null, null);
  const tableDe = new Int32Array(N * R).fill(NON_ASSIS);
  const aAsseoir = [];
  const occupants = new Int32Array(T);
  for (let r = 0; r < R; r += 1) {
    const tour = r + 1;
    const listes = plan.tours[r];
    if (listes.length !== plan.tables.length) refuser(tour, null, null);
    occupants.fill(0);
    listes.forEach((liste, i) => {
      const table = plan.tables[i];
      const t = indexTableDe.get(table);
      if (t === undefined && liste.length > 0) refuser(tour, table, null);
      for (const participant of liste) {
        const p = indexDe.get(participant);
        if (p === undefined || present[p * R + r] === 0) continue;
        if (tableDe[p * R + r] !== NON_ASSIS) refuser(tour, table, participant);
        tableDe[p * R + r] = t;
        occupants[t] += 1;
      }
    });
    for (let t = 0; t < T; t += 1) if (occupants[t] > capacite[t]) refuser(tour, idsTables[t], null);
    for (const participant of plan.reserves?.[r] ?? []) {
      const p = indexDe.get(participant);
      if (p === undefined || present[p * R + r] === 0) continue;
      if (tableDe[p * R + r] !== NON_ASSIS) refuser(tour, null, participant);
      tableDe[p * R + r] = EN_RESERVE;
    }
    const duTour = [];
    for (let p = 0; p < N; p += 1) {
      const i = p * R + r;
      const t = tableDe[i];
      const fixee = fixe[i];
      if (present[i] === 0) {
        tableDe[i] = RESERVE;
      } else if (t >= 0) {
        if (fixee !== LIBRE && fixee !== t) refuser(tour, idsTables[fixee], ids[p]);
      } else {
        tableDe[i] = RESERVE;
        if (imposee[i] === 1) continue;
        duTour.push(p);
        if (fixee !== LIBRE) occupants[fixee] += 1;
      }
    }
    for (let t = 0; t < T; t += 1) {
      let enTrop = occupants[t] - capacite[t];
      if (enTrop <= 0) continue;
      if (fige[r] === 1) refuser(tour, idsTables[t], null);
      for (let p = N - 1; p >= 0 && enTrop > 0; p -= 1) {
        if (tableDe[p * R + r] !== t || fixe[p * R + r] !== LIBRE) continue;
        tableDe[p * R + r] = RESERVE;
        duTour.push(p);
        enTrop -= 1;
      }
    }
    aAsseoir.push(Int32Array.from(duTour).sort());
  }
  return { tableDe, aAsseoir };
}

// La structure sous laquelle se mesure un départ à réserves imposées :
// structure elle-même quand aucune réserve imposée n'est fixée à son tour,
// sinon une copie dont le seuil des retours ne compte plus, parmi les tours
// fixés d'une personne, ceux où elle est en réserve imposée, et dont les
// animateurs d'une table n'y comptent plus une animatrice en réserve
// imposée à ce tour. mesurer lit ainsi le même plan : une fixée en réserve
// n'y fait aucune visite réservée, une animatrice en réserve n'y est
// rencontrée par personne.
function structureDuDepart(structure, imposee) {
  const { instance, N, T, R } = structure;
  const { fixe, debutAnimes, animes, animateurs } = instance;
  let fixeeImposee = false;
  for (let i = 0; i < N * R; i += 1) if (imposee[i] === 1 && fixe[i] !== LIBRE) fixeeImposee = true;
  if (!fixeeImposee) return structure;
  const seuilRetour = new Int32Array(N * T);
  for (let p = 0; p < N; p += 1) {
    for (let r = 0; r < R; r += 1) {
      const t = fixe[p * R + r];
      if (t !== LIBRE && imposee[p * R + r] === 0) seuilRetour[p * T + t] += 1;
    }
  }
  for (let i = 0; i < seuilRetour.length; i += 1) {
    if (seuilRetour[i] === 0) seuilRetour[i] = 1;
  }
  const debut = new Int32Array(T * R + 1);
  const gardes = [];
  for (let ligne = 0; ligne < T * R; ligne += 1) {
    const r = ligne % R;
    for (let k = debutAnimes[ligne]; k < debutAnimes[ligne + 1]; k += 1) {
      if (imposee[animateurs[animes[k]] * R + r] === 0) gardes.push(animes[k]);
    }
    debut[ligne + 1] = gardes.length;
  }
  return { ...structure, seuilRetour, debutAnimes: debut, animes: Int32Array.from(gardes) };
}

// Le remplissage canonique du départ ajusté (paragraphe « Départ ») :
// remplir(etat) écrit les sièges dans etat.siege, où les fixés sont déjà,
// sans rien tirer. À chaque tour, une fixée en réserve imposée quitte son
// siège fixé ; chaque libre que le départ garde, par index croissant, va au
// prochain siège mobile de sa table, ou, quand ils manquent, au prochain siège
// fixé laissé par une réserve imposée de sa table ; puis chaque libre à
// asseoir, par index croissant, va au premier siège mobile resté vide, dans
// l'ordre des sièges. Une fixée à asseoir est déjà à son siège fixé. Les
// fixés occupant les premiers sièges de leur table (preparer), ses sièges
// mobiles suivent, et ceux qui restent sont des places fantômes.
function remplisseur(structure, { tableDe, aAsseoir }, imposee) {
  const { instance, T, R, S, debut, siegesFixes, libres, mobiles } = structure;
  const { fixe } = instance;
  const prochain = new Int32Array(T);
  const laisse = new Int32Array(T);
  return (etat) => {
    const { siege } = etat;
    for (let r = 0; r < R; r += 1) {
      const base = r * S;
      for (let s = 0; s < S; s += 1) {
        const p = siegesFixes[base + s];
        if (p !== FANTOME && imposee[p * R + r] === 1) siege[base + s] = FANTOME;
      }
      for (let t = 0; t < T; t += 1) {
        let s = debut[t];
        while (s < debut[t + 1] && siegesFixes[base + s] !== FANTOME) s += 1;
        prochain[t] = s;
        laisse[t] = debut[t];
      }
      for (const p of libres[r]) {
        const t = tableDe[p * R + r];
        if (t === RESERVE) continue;
        if (prochain[t] < debut[t + 1]) {
          siege[base + prochain[t]] = p;
          prochain[t] += 1;
        } else {
          while (siege[base + laisse[t]] !== FANTOME) laisse[t] += 1;
          siege[base + laisse[t]] = p;
          laisse[t] += 1;
        }
      }
      let i = 0;
      for (const p of aAsseoir[r]) {
        if (fixe[p * R + r] !== LIBRE) continue;
        while (siege[base + mobiles[base + i]] !== FANTOME) i += 1;
        siege[base + mobiles[base + i]] = p;
      }
    }
  };
}

// Aux tours figés, aucun mouvement ne déplacera une arrivante : chaque libre
// de aAsseoir[r], r figé, par tours puis index croissants, essaie chaque
// table dans l'ordre des tables — la sienne en restant à son siège
// canonique, une autre en passant, par echanger, à sa première place
// fantôme, l'échange défait après le score composé — et garde la première
// table au meilleur score dans l'ordre du score : à égalité, une table qui
// précède celle de son siège canonique l'emporte. Les compteurs suivent
// l'échange gardé. Une fixée reste à sa table. Rien n'est tiré.
function placerArrivantsFiges(etat, structure, aAsseoir, fige) {
  const { instance, T, R, S, debut, tableDuSiege, composition: forme } = structure;
  const { fixe } = instance;
  const { siege } = etat;
  const meilleur = new Float64Array(forme.taille);
  const essai = new Float64Array(forme.taille);
  for (let r = 0; r < R; r += 1) {
    if (fige[r] === 0) continue;
    const base = r * S;
    for (const p of aAsseoir[r]) {
      if (fixe[p * R + r] !== LIBRE) continue;
      const a = siege.subarray(base, base + S).indexOf(p);
      const ta = tableDuSiege[a];
      let choix = -1;
      for (let t = 0; t < T; t += 1) {
        let b = a;
        if (t === ta) {
          composer(forme, etat, essai);
        } else {
          b = debut[t];
          while (b < debut[t + 1] && siege[base + b] !== FANTOME) b += 1;
          if (b === debut[t + 1]) continue;
          echanger(etat, r, a, b);
          composer(forme, etat, essai);
          echanger(etat, r, a, b);
        }
        if (choix === -1 || comparer(forme.ordreScore, essai, 0, meilleur, 0) < 0) {
          meilleur.set(essai);
          choix = b;
        }
      }
      if (choix !== a) echanger(etat, r, a, choix);
    }
  }
}

// Les options de descendre sous un départ {plan, toursFiges,
// reservesImposees}, contrôlé avant tout calcul : depart, le constructeur de
// l'état du départ ajusté, et tirables, les index des tours non figés. L'état
// ajusté se construit une fois — remplissage canonique, puis
// placerArrivantsFiges —, et depart() en recopie les sièges dans un état
// neuf, ses compteurs recomptés. Lève la RangeError d'exigerToursFiges, puis
// celle d'exigerReservesImposees, puis DEPART_INCOMPATIBLE (tableDuDepart).
function preparerDepart(structure, { plan, toursFiges, reservesImposees = [] }) {
  const { R } = structure;
  exigerToursFiges(toursFiges, R);
  const fige = new Uint8Array(R);
  for (const tour of toursFiges) fige[tour - 1] = 1;
  const imposee = exigerReservesImposees(structure, reservesImposees, fige, plan);
  const ajuste = tableDuDepart(structure, plan, fige, imposee);
  const mesure = structureDuDepart(structure, imposee);
  const etat = etatInitial(mesure, null, remplisseur(mesure, ajuste, imposee));
  placerArrivantsFiges(etat, mesure, ajuste.aAsseoir, fige);
  const sieges = Int32Array.from(etat.siege);
  const tirables = [];
  for (let r = 0; r < R; r += 1) if (fige[r] === 0) tirables.push(r);
  return {
    depart: () => etatInitial(mesure, null, (neuf) => neuf.siege.set(sieges)),
    tirables: Int32Array.from(tirables),
  };
}

/**
 * Les propositions d'une génération dérivée (§ 5.7) : celles de rechercher,
 * mêmes identifiants, mêmes graines dérivées, mêmes réglages, mêmes
 * avancement et annulation, chaque descente partie du départ ajusté à la
 * présence au lieu d'un placement tiré, au début et à chaque relance, et ne
 * tirant ses mouvements que dans les tours non figés (paragraphe
 * « Départ »). Chacune porte en plus relances, le nombre de relances de sa
 * descente. À configuration, réglages et départ égaux, réserves imposées
 * comprises, le résultat est identique. Ne modifie ni la configuration ni le
 * départ.
 *
 * Lève ce que rechercher lève, puis, avant tout calcul, une RangeError de
 * champ reglage 'toursFiges' pour une liste qui n'est pas strictement
 * croissante, un tour hors de 1 à R, ou tous les tours ; une RangeError de
 * champ reglage 'reservesImposees' pour une liste mal formée ou dont une
 * entrée ne désigne pas une présente de l'instance qu'un tour figé du plan
 * n'assied pas ; ErreurConfiguration ('DEPART_INCOMPATIBLE', {tour, table,
 * participant}) pour un plan malformé ou qui contredit le mobilier, et, à un
 * tour figé, pour une table que ses arrivantes fixées font déborder faute de
 * réserve imposée (paragraphe « Départ ») : une garde, l'application
 * refusant ces départs avant.
 *
 * @param {import('./types.js').Configuration} configuration
 * @param {ReglagesGeneration} reglages
 * @param {DepartRecherche} depart
 * @param {{signal?: {aborted: boolean}, progression?: function(number, number): void}} [options]
 * @returns {Proposition[]}
 */
export function repartir(configuration, reglages, depart, { signal, progression } = {}) {
  verifierReglages(reglages);
  const { graine, arret, nombre, historique = HISTORIQUE_PAR_DEFAUT } = reglages;
  const instance = normaliser(configuration);
  const structure = preparer(instance);
  const options = preparerDepart(structure, depart);
  const graines = creerPcg32(graine, FLUX.GRAINES);
  const total = nombre * arret;
  const propositions = [];
  for (let id = 1; id <= nombre; id += 1) {
    lireSignal(signal);
    const graineDerivee = graines.suivant();
    const descente = proposer(structure, graineDerivee, {
      arret,
      historique,
      dejaFaits: (id - 1) * arret,
      total,
      signal,
      progression,
      ...options,
    });
    propositions.push({
      ...propositionDe(instance, { id, graine: graineDerivee, arret, historique }, descente),
      relances: descente.relances,
    });
  }
  return propositions;
}

/**
 * La proposition de rang rang d'une génération dérivée : celle que
 * repartir(configuration, reglages, depart) rend à l'indice rang − 1, octet
 * pour octet, comme proposerUne l'est pour rechercher. L'avancement et le
 * signal sont ceux de proposerUne.
 *
 * Lève ce que proposerUne lève, contrôle de rang compris, puis ce que
 * repartir lève pour le départ, avant tout calcul.
 *
 * @param {import('./types.js').Configuration} configuration
 * @param {ReglagesGeneration} reglages
 * @param {DepartRecherche} depart
 * @param {number} rang   1 à reglages.nombre
 * @param {{signal?: {aborted: boolean}, progression?: function(number, number): void}} [options]
 * @returns {Proposition}
 */
export function repartirUne(configuration, reglages, depart, rang, { signal, progression } = {}) {
  verifierReglages(reglages);
  const { graine, arret, nombre, historique = HISTORIQUE_PAR_DEFAUT } = reglages;
  exigerReglage('rang', rang, 1, nombre);
  const instance = normaliser(configuration);
  const structure = preparer(instance);
  const options = preparerDepart(structure, depart);
  const graines = creerPcg32(graine, FLUX.GRAINES);
  let graineDerivee = 0;
  for (let tirage = 1; tirage <= rang; tirage += 1) graineDerivee = graines.suivant();
  lireSignal(signal);
  const descente = proposer(structure, graineDerivee, {
    arret,
    historique,
    dejaFaits: 0,
    total: arret,
    signal,
    progression,
    ...options,
  });
  return {
    ...propositionDe(instance, { id: rang, graine: graineDerivee, arret, historique }, descente),
    relances: descente.relances,
  };
}

/**
 * Propositions de placement d'une configuration (§ 5.7) : nombre
 * propositions, d'identifiants 1 à nombre, chacune la meilleure affectation
 * vue en arret mouvements évalués, relances comprises (en-tête du module).
 * Chacune porte sa graine dérivée, arret et historique, défaut résolu : les
 * trois décident de son plan, que regenerer rend à partir d'eux. Elle porte
 * aussi sa course, evalues et releves (en-tête du module) : le point de
 * relevé k est le plan que regenerer rend au compte d'arrêt k. À
 * configuration et réglages égaux, le résultat est identique. Ne modifie pas
 * la configuration.
 *
 * Toutes les 1 000 itérations, comptées sur la génération entière,
 * progression(fait, total) reçoit le rang du mouvement en cours parmi
 * total = nombre × arret ; une proposition arrêtée tôt sur un score nul
 * laisse la suivante partir de son propre rang, (id − 1) × arret. Le signal
 * se lit à chacun de ces instants et avant chaque proposition : vrai, il
 * fait lever ErreurAnnulee, et aucune proposition n'est rendue (§ 5.10).
 *
 * Lève RangeError quand un réglage n'est pas un entier de son domaine —
 * graine de 0 à 2^32 − 1, arret, nombre et historique ≥ 1 ;
 * ErreurConfiguration de normaliser ; ErreurConfiguration
 * ('PLACES_MANQUANTES', { placesManquantes, tours? }) quand les tables
 * n'offrent pas assez de sièges à un tour pour ses présents :
 * placesManquantes, le plus grand manque d'un tour, celui que rend
 * nombrePlacesManquantes ; tours, dès qu'une personne est absente à un tour,
 * chaque tour à manque positif {tour, manque}, croissants, et absent sinon.
 *
 * @param {import('./types.js').Configuration} configuration
 * @param {ReglagesGeneration} reglages
 * @param {{signal?: {aborted: boolean}, progression?: function(number, number): void}} [options]
 * @returns {Proposition[]}
 */
export function rechercher(configuration, reglages, { signal, progression } = {}) {
  verifierReglages(reglages);
  const { graine, arret, nombre, historique = HISTORIQUE_PAR_DEFAUT } = reglages;
  const instance = normaliser(configuration);
  const structure = preparer(instance);
  const graines = creerPcg32(graine, FLUX.GRAINES);
  const total = nombre * arret;
  const propositions = [];
  for (let id = 1; id <= nombre; id += 1) {
    lireSignal(signal);
    const graineDerivee = graines.suivant();
    const descente = proposer(structure, graineDerivee, {
      arret,
      historique,
      dejaFaits: (id - 1) * arret,
      total,
      signal,
      progression,
    });
    propositions.push(propositionDe(instance, { id, graine: graineDerivee, arret, historique }, descente));
  }
  return propositions;
}

/**
 * La proposition de rang rang d'une génération (§ 5.7) : celle que
 * rechercher(configuration, reglages) rend à l'indice rang − 1, octet pour
 * octet. Sa graine dérivée est le rang-ième tirage de creerPcg32(graine,
 * FLUX.GRAINES), et sa descente celle de rechercher : le résultat ne dépend
 * ni de l'ordre dans lequel les rangs se calculent, ni du fil qui les
 * calcule. Plusieurs fils calculent ainsi les propositions d'une même
 * génération, chacun les siennes, et les rangent par identifiant.
 *
 * Toutes les 1 000 itérations, progression(fait, total) reçoit le rang du
 * mouvement en cours dans cette seule proposition, total valant arret. Le
 * signal se lit avant la descente et à chacun de ces instants : vrai, il
 * fait lever ErreurAnnulee, et rien n'est rendu (§ 5.10).
 *
 * Lève ce que rechercher lève : la RangeError de verifierReglages,
 * ErreurConfiguration de normaliser, PLACES_MANQUANTES ; et une RangeError
 * qui nomme rang, champ reglage compris, quand rang n'est pas un entier de
 * 1 à reglages.nombre.
 *
 * @param {import('./types.js').Configuration} configuration
 * @param {ReglagesGeneration} reglages
 * @param {number} rang   1 à reglages.nombre
 * @param {{signal?: {aborted: boolean}, progression?: function(number, number): void}} [options]
 * @returns {Proposition}
 */
export function proposerUne(configuration, reglages, rang, { signal, progression } = {}) {
  verifierReglages(reglages);
  const { graine, arret, nombre, historique = HISTORIQUE_PAR_DEFAUT } = reglages;
  exigerReglage('rang', rang, 1, nombre);
  const instance = normaliser(configuration);
  const structure = preparer(instance);
  const graines = creerPcg32(graine, FLUX.GRAINES);
  let graineDerivee = 0;
  for (let tirage = 1; tirage <= rang; tirage += 1) graineDerivee = graines.suivant();
  lireSignal(signal);
  const descente = proposer(structure, graineDerivee, {
    arret,
    historique,
    dejaFaits: 0,
    total: arret,
    signal,
    progression,
  });
  return propositionDe(instance, { id: rang, graine: graineDerivee, arret, historique }, descente);
}

/**
 * Le contrôle des réglages que rechercher applique avant tout calcul : graine
 * de 0 à 2^32 − 1, puis arret, historique et nombre ≥ 1, un historique absent
 * valant HISTORIQUE_PAR_DEFAUT. Lève, pour le premier réglage hors de son
 * domaine dans cet ordre, une RangeError dont le message commence par son nom
 * et dont le champ reglage le porte ; ne rend rien sinon. rechercher
 * l'appelle : ce qu'il admet, rechercher l'admet.
 *
 * @param {ReglagesGeneration} reglages
 */
export function verifierReglages({ graine, arret, nombre, historique = HISTORIQUE_PAR_DEFAUT }) {
  exigerChampsProposition({ graine, arret, historique });
  exigerReglage('nombre', nombre, 1, Number.MAX_SAFE_INTEGER);
}

/**
 * Le plan d'une proposition, régénéré à partir de ses seuls champs (§ 5.7,
 * § 8.9) : la descente part de proposition.graine, la graine dérivée qu'elle
 * porte, et compte proposition.arret mouvements sous un historique de
 * proposition.historique cases. Ces trois champs décident du plan : à
 * configuration égale, regenerer rend le plan que rechercher a rendu pour
 * cette proposition, quel que soit son rang dans sa génération. La descente
 * elle-même fait aussi partie du résultat, ordre des tirages, PATIENCE et
 * ordres d'acceptation : une proposition rendue par une autre version de ce
 * module n'est pas garantie régénérable (§ 8.9). Rend le seul plan, sans la
 * course que rechercher joint à la proposition. Ne modifie ni la
 * configuration, ni la proposition, ni le plan du départ.
 *
 * Une proposition dérivée porte en plus depart, l'identifiant de son départ,
 * et toursFiges quand elle en a : sa descente part alors du départ ajusté de
 * options.planDuDepart, sous ses tours figés, toursFiges absent valant aucun,
 * et sous options.reservesImposees, vide par défaut, et regenerer rend le
 * plan que repartir a rendu pour elle sous les mêmes réserves imposées. Sans
 * depart ni toursFiges, options.planDuDepart n'est pas lu. Aucun autre
 * champ n'est lu, ni id ni plan : un fichier de proposition entier se passe
 * tel quel.
 *
 * Lève RangeError quand l'un des trois champs n'est pas un entier de son
 * domaine, graine de 0 à 2^32 − 1, arret et historique ≥ 1 : un champ absent
 * ne reçoit pas la valeur par défaut de rechercher, qui ferait régénérer une
 * autre proposition sans le dire. Lève ensuite une RangeError de champ
 * reglage 'toursFiges' pour toursFiges présent sans depart, et de champ
 * reglage 'depart' pour un depart qui n'est pas un entier ≥ 1 ou qui vient
 * sans planDuDepart : sans lui, la descente rendrait en silence la
 * proposition ordinaire de même graine ; de champ reglage
 * 'reservesImposees' pour des réserves imposées non vides sans depart, qui
 * ne désignent aucun tour figé. Lève ce que rechercher lève pour la
 * configuration : ErreurConfiguration de normaliser, PLACES_MANQUANTES ;
 * puis ce que repartir lève pour le départ.
 *
 * @param {import('./types.js').Configuration} configuration
 * @param {{graine: number, arret: number, historique: number, depart?: number, toursFiges?: number[]}} proposition
 * @param {{planDuDepart?: import('./types.js').Plan|null,
 *          reservesImposees?: {participant: number, tour: number}[]}} [options]
 * @returns {import('./types.js').Plan}
 */
export function regenerer(
  configuration,
  { graine, arret, historique, depart, toursFiges },
  { planDuDepart = null, reservesImposees = [] } = {},
) {
  exigerChampsProposition({ graine, arret, historique });
  if (depart === undefined && toursFiges !== undefined) {
    refuserReglage('toursFiges', 'des tours figés sans depart ne désignent aucun plan');
  }
  if (depart === undefined && !(Array.isArray(reservesImposees) && reservesImposees.length === 0)) {
    refuserReglage('reservesImposees', 'des réserves imposées sans depart ne désignent aucun tour figé');
  }
  if (depart !== undefined) {
    exigerReglage('depart', depart, 1, Number.MAX_SAFE_INTEGER);
    if (planDuDepart === null) {
      refuserReglage('depart', `le plan du départ n° ${depart} est requis pour régénérer une dérivée`);
    }
  }
  const instance = normaliser(configuration);
  const structure = preparer(instance);
  const options = depart === undefined
    ? {}
    : preparerDepart(structure, { plan: planDuDepart, toursFiges: toursFiges ?? [], reservesImposees });
  const { plan } = proposer(structure, graine, {
    arret,
    historique,
    dejaFaits: 0,
    total: arret,
    ...options,
  });
  return planDepuisIndex(instance, plan);
}

/**
 * État de recherche au placement initial (§ 5.10) : fixés à leurs tables,
 * libres présents mélangés par rng.melanger, tour après tour, puis assis
 * table après table dans l'ordre des tables ; un absent n'occupe aucun siège.
 * L'état porte la composition du n-uplet de l'instance. Lève
 * ErreurConfiguration('PLACES_MANQUANTES') comme rechercher.
 *
 * @param {import('./types.js').Instance} instance
 * @param {ReturnType<typeof creerPcg32>} rng
 * @returns {EtatRecherche}
 */
export function creerEtat(instance, rng) {
  const structure = preparer(instance);
  const etat = etatInitial(structure, rng);
  etat.composition = structure.composition;
  return etat;
}

/**
 * État de recherche au départ ajusté à la présence (paragraphe « Départ ») :
 * celui dont part chaque descente de repartir, repartirUne et regenerer sous
 * ce départ, au début et à chaque relance. L'état porte la composition du
 * n-uplet de l'instance. Lève ce que creerEtat lève, puis ce que repartir
 * lève pour le départ, dans le même ordre.
 *
 * @param {import('./types.js').Instance} instance
 * @param {DepartRecherche} depart
 * @returns {EtatRecherche}
 */
export function creerEtatDuDepart(instance, depart) {
  const structure = preparer(instance);
  const etat = preparerDepart(structure, depart).depart();
  etat.composition = structure.composition;
  return etat;
}

/**
 * Le n-uplet du score, tel que l'état le tient à jour, de la longueur que la
 * compilation de l'instance lui donne.
 *
 * @param {EtatRecherche} etat
 * @returns {number[]}
 */
export function scoreIncremental(etat) {
  return composer(etat.composition, etat, new Array(etat.composition.taille));
}

/**
 * Le même n-uplet, recalculé de zéro sur etat.tableDe à partir de la mesure
 * qui fait foi, dont chaque grandeur se lit au lieu de se refaire : les
 * écarts au plafond a priori par ecartsAuPlafondAPriori (manque.js), sur les
 * plafonds de plafondsAPriori ; l'excédent de collisions, les collisions
 * cumulées, les retours choisis, Σ r(p), les quatre valeurs des objectifs et
 * les animateurs non rencontrés par mesurer — nulles quand la mesure n'a
 * personne de concerné. Une redéfinition de l'une d'elles dans son module
 * change donc ce score, et son accord avec le score tenu à jour tombe.
 *
 * Seule Σ_paires max(0, M − 1), que la mesure ne rend pas, se calcule ici :
 * elle vaut Σ_paires M − Σ_paires min(M, 1). Le premier terme compte les
 * paires réunies à chaque table de chaque tour, o(o − 1)/2 pour o
 * occupants ; le second, les paires réunies au moins une fois,
 * Σ_p rencontres(p) / 2.
 *
 * @param {EtatRecherche} etat
 * @returns {number[]}
 */
export function scoreComplet(etat) {
  const { instance, tableDe } = etat;
  const { N, T, R } = instance;
  const mesures = mesurer(instance, tableDe);
  let ecartAuPlafondAPrioriMax = 0;
  let carresEcartsAuPlafondAPriori = 0;
  for (const ecart of ecartsAuPlafondAPriori(mesures, plafondsAPriori(instance))) {
    ecartAuPlafondAPrioriMax = Math.max(ecartAuPlafondAPrioriMax, ecart);
    carresEcartsAuPlafondAPriori += ecart * ecart;
  }
  const occupation = new Int32Array(T * R);
  for (let p = 0; p < N; p += 1) {
    for (let r = 0; r < R; r += 1) {
      const t = tableDe[p * R + r];
      if (t !== RESERVE) occupation[t * R + r] += 1;
    }
  }
  let reunions = 0;
  for (const o of occupation) reunions += (o * (o - 1)) / 2;
  let sommeRencontres = 0;
  for (const rencontres of mesures.rencontres) sommeRencontres += rencontres;
  const objectifs = mesures.objectifs ?? { horsObjectif: 0, jamaisServies: 0, horsObjectifMax: 0, personnesAuMax: 0 };
  const grandeurs = {
    ecartAuPlafondAPrioriMax,
    carresEcartsAuPlafondAPriori,
    excedentCollisions: mesures.excedentCollisions,
    collisionsCumulees: mesures.collisionsCumulees,
    excedentPaires: reunions - sommeRencontres / 2,
    totalRetoursChoisis: mesures.totalRetoursChoisis,
    totalRedondance: mesures.totalRedondance,
    horsObjectif: objectifs.horsObjectif,
    jamaisServies: objectifs.jamaisServies,
    horsObjectifMax: objectifs.horsObjectifMax,
    personnesAuMax: objectifs.personnesAuMax,
    animateursNonRencontres: mesures.animateurs?.nonRencontres ?? 0,
  };
  return composer(etat.composition, grandeurs, new Array(etat.composition.taille));
}

/**
 * Un mouvement (en-tête du module), appliqué à l'état. Rend de quoi le
 * défaire, ou null pour un mouvement évalué et rejeté, qui n'a rien changé.
 *
 * @param {EtatRecherche} etat
 * @param {ReturnType<typeof creerPcg32>} rng
 * @returns {Mouvement|null}
 */
export function proposerEtAppliquer(etat, rng) {
  return mouvoirDans(etat, rng, rng.borne(etat.R));
}

/**
 * Un mouvement d'une dérivée (paragraphe « Départ ») : son tour se tire
 * parmi tirables, les index des tours non figés, par borne(k) sur leur
 * nombre k, puis ses deux sièges comme ceux de proposerEtAppliquer. Aucun
 * mouvement ne tombe dans un tour hors de tirables. Rend de quoi le défaire,
 * ou null pour un mouvement évalué et rejeté.
 *
 * @param {EtatRecherche} etat
 * @param {ReturnType<typeof creerPcg32>} rng
 * @param {ArrayLike<number>} tirables   index de tours, non vide
 * @returns {Mouvement|null}
 */
export function proposerParmi(etat, rng, tirables) {
  return mouvoirDans(etat, rng, tirables[rng.borne(tirables.length)]);
}

// Les deux sièges mobiles du tour r, tirés chacun par borne(m), puis
// l'échange de leurs occupants (en-tête du module, « Mouvement ») ; null
// pour un mouvement évalué et rejeté.
function mouvoirDans(etat, rng, r) {
  const { S, mobiles, nombreMobiles, tableDuSiege, siege } = etat;
  const m = nombreMobiles[r];
  if (m < 2) return null;
  const base = r * S;
  const a = mobiles[base + rng.borne(m)];
  const b = mobiles[base + rng.borne(m)];
  if (tableDuSiege[a] === tableDuSiege[b]) return null;
  if (siege[base + a] === FANTOME && siege[base + b] === FANTOME) return null;
  echanger(etat, r, a, b);
  return { tour: r, a, b };
}

/**
 * Défait mouvement, le dernier appliqué à l'état : l'état revient à
 * l'identique, compteurs compris. Une suite de mouvements se défait à
 * rebours, le dernier d'abord. Un mouvement null ne fait rien.
 *
 * @param {EtatRecherche} etat
 * @param {Mouvement|null} mouvement
 */
export function defaire(etat, mouvement) {
  if (mouvement !== null) echanger(etat, mouvement.tour, mouvement.a, mouvement.b);
}
