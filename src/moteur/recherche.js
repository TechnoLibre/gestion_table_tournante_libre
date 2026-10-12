// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Recherche reproductible (§ 5.7, § 5.10). Une génération rend plusieurs
// propositions ; chacune sort d'une descente par acceptation tardive (late
// acceptance hill climbing) sur le plan complet, les N participants et les R
// tours, ancrés compris : l'appartenance d'un ancré pèse sur ses voisins de
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
// qui répartit une génération entre plusieurs fils. Les trois passent par la
// même descente, proposer.
//
// Sièges. Chaque tour offre S = Σ c_t sièges, rangés table par table dans
// l'ordre des tables. Les personnes que instance.fixe impose à un tour
// occupent les premiers sièges de leur table, par index croissant, et n'en
// bougent jamais. Les autres sièges sont mobiles : chacun porte une personne
// libre à ce tour, ou une place fantôme, siège vide. Le placement initial
// mélange les personnes libres de chaque tour par melanger, tour après tour,
// et les assied dans les sièges mobiles pris dans l'ordre ; les sièges qui
// restent sont des places fantômes. Sans place manquante, personne n'est en
// réserve.
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
// cumulées de même appartenance et leur excédent ; Σ_paires max(0, M − 1) ;
// les visites par (personne, table), d'où les retours choisis ; par
// personne, le nombre d'affiliés rencontrés de chaque appartenance, d'où
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
// générateur, l'historique au score de ce placement ; la meilleure
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
import { FLUX, creerPcg32 } from '../demo/prng.js';
import {
  LIBRE,
  RESERVE,
  SANS_GROUPE,
  SANS_OBJECTIF,
  nombrePlacesManquantes,
  normaliser,
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
 *
 * @typedef {Object} EtatRecherche
 * Rendu par creerEtat ; les champs qui suivent se lisent, aucun ne s'écrit
 * hors de ce module. Un champ qui tient une grandeur que mesurer rend en
 * porte le nom.
 * @property {Int32Array} tableDe            plan indexé courant, N × R
 * @property {Int32Array} rencontres         |met(p)|, ordre canonique
 * @property {Int32Array} affilies           |F(p)|
 * @property {Int32Array} appartenancesVues  A(p)
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
// ne les tient qu'alors. Lève RangeError pour une grandeur que la
// composition ne sait pas lire.
function composition(instance) {
  const { paliers, ordreScore, ordreContraintes, rangEcart, taille } = compilationDe(instance);
  const { contraintes, modeObjectifs } = instance;
  const parComposante = Array.from({ length: taille }, () => []);
  const poser = (k, nom, poids) => {
    if (nom !== 'rencontresRepetees') {
      const code = CODE_DE.get(nom);
      if (code === undefined) throw new RangeError(`grandeur du score inconnue : ${nom}`);
      parComposante[k].push([code, poids]);
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
// personnes libres de chaque tour par index croissant, le plafond a priori
// de chacun, par (personne, table), le seuil de visites au-delà duquel une
// visite est un retour choisi, et la composition du n-uplet. Lève
// PLACES_MANQUANTES quand les sièges d'un tour ne suffisent pas à asseoir
// tout le monde (§ 5.9).
function preparer(instance) {
  const placesManquantes = nombrePlacesManquantes(instance);
  if (placesManquantes > 0) throw new ErreurConfiguration('PLACES_MANQUANTES', { placesManquantes });
  const { N, T, R, capacite, fixe } = instance;

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
        libresDuTour.push(p);
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
    etat.appartenancesVues[p] += sens;
    vues = sens;
  }
  etat.totalRedondance += sens - vues;
}

// Ajoute sens, 1 ou −1, aux rencontres de la paire (a, b), a ≠ b, et
// propage : les collisions cumulées pour deux personnes de la même
// appartenance. Quand la paire était réunie avant un ajout, ou le reste
// après un retrait, la rencontre ajoutée ou retirée est une répétition :
// elle compte dans Σ max(0, M − 1) et, entre collègues, dans l'excédent de
// collisions, qui vaut Σ max(0, M − 1) sur les paires de même appartenance.
// Sinon la paire devient réunie ou cesse de l'être : les rencontres et les
// affiliés des deux suivent.
function modifierPaire(etat, a, b, sens) {
  const k = a < b ? a * etat.N + b : b * etat.N + a;
  const avant = etat.paires[k];
  const apres = avant + sens;
  etat.paires[k] = apres;
  const ga = etat.groupe[a];
  const gb = etat.groupe[b];
  const memeGroupe = ga === gb && etat.porteAppartenance[a] === 1;
  if (memeGroupe) etat.collisionsCumulees += sens;
  if ((sens > 0 ? avant : apres) !== 0) {
    etat.excedentPaires += sens;
    if (memeGroupe) etat.excedentCollisions += sens;
    return;
  }
  changerRencontres(etat, a, sens);
  changerRencontres(etat, b, sens);
  if (etat.porteAppartenance[b] === 1) changerAffilie(etat, a, gb, sens);
  if (etat.porteAppartenance[a] === 1) changerAffilie(etat, b, ga, sens);
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
// sièges, les libres de chaque tour mélangées puis assises dans l'ordre des
// sièges mobiles. Les compteurs partent de zéro et suivent chaque paire,
// chaque visite et chaque rencontre d'animateur par les mêmes fonctions que
// les mouvements ; les écarts partent du plafond a priori, aucune rencontre
// n'étant encore comptée, et les animateurs non rencontrés de Σ B(p),
// quand l'état les tient (suitAnimateurs de la composition). Les
// tours servis se comptent siège par siège, puis l'histogramme des
// P(p) − s(p) se forme sur les personnes concernées. Chaque personne assise
// l'est à une table qu'elle peut occuper — sa table fixée, ou un siège
// mobile, que seule une table à siège libre offre — : servie et rencontres
// d'animateurs s'y lisent sans autre condition, comme mesurer les lit.
function etatInitial(structure, rng) {
  const { instance, N, T, R, S, mobiles, libres, aPriori, tableDuSiege, debut } = structure;
  const G = instance.groupes.length;
  const { suitAnimateurs } = structure.composition;
  const etat = {
    instance,
    contraintes: instance.contraintes,
    groupe: instance.groupe,
    // porteAppartenance[p] vaut 1 quand p porte une appartenance, 0 pour
    // SANS_GROUPE.
    // modifierPaire le lit au lieu de comparer un groupe à SANS_GROUPE : sous
    // le lanceur d'épreuves, chaque lecture d'une valeur importée passe par
    // un accesseur, que la boucle de recherche paierait à chaque paire.
    porteAppartenance: Uint8Array.from(instance.groupe, (g) => (g === SANS_GROUPE ? 0 : 1)),
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
    tableDe: new Int32Array(N * R),
    paires: R <= UINT16_MAX ? new Uint16Array(N * N) : new Uint32Array(N * N),
    rencontres: new Int32Array(N),
    affilies: new Int32Array(N),
    appartenancesVues: new Int32Array(N),
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
    debutAnimes: instance.debutAnimes,
    animes: instance.animes,
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
  for (let r = 0; r < R; r += 1) {
    const melanges = rng.melanger(Int32Array.from(libres[r]));
    for (let i = 0; i < melanges.length; i += 1) siege[r * S + mobiles[r * S + i]] = melanges[i];
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
// rend { plan, evalues, releves } : la meilleure affectation vue, en plan
// indexé, les mouvements évalués, et les copies de la meilleure affectation
// aux points de relevé, { mouvements, tableDe }, mouvements croissants (en-tête
// du module, « La course »). L'ordre d'acceptation
// suit la meilleure affectation (ordreAccepte). Dans l'ordre des
// contraintes, un score courant inchangé pendant PATIENCE × historique
// itérations fait relancer la descente (en-tête du module). La bascule vers
// cet ordre suit une meilleure affectation, donc un changement du score
// courant, qui remet immobile à zéro. fait compte les mouvements évalués
// depuis le début de la génération, à partir de dejaFaits, ceux des
// propositions précédentes : à chaque multiple de CADENCE,
// progression(fait, total), puis une lecture du signal.
function descendre(structure, rng, { arret, historique, dejaFaits, total, signal, progression }) {
  const { composition: forme } = structure;
  const { taille, ordreScore, ordreContraintes } = forme;
  let etat = etatInitial(structure, rng);
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
  // releve : la prochaine puissance de dix ; i, à la sortie de la boucle, les
  // mouvements évalués.
  const releves = [];
  let releve = 1;
  let i = 0;
  for (; i < arret && !estNul(courant); i += 1) {
    if (immobile >= patience && ordre === ordreContraintes) {
      etat = etatInitial(structure, rng);
      composer(forme, etat, courant);
      remplirMemoire();
      ordre = retenir(ordre);
      immobile = 0;
    }
    const mouvement = proposerEtAppliquer(etat, rng);
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
  return { plan: meilleurPlan, evalues: i, releves };
}

// La descente de la proposition de graine dérivée graineDerivee, depuis
// creerPcg32(graineDerivee, FLUX.RECHERCHE), en plans indexés (descendre).
// rechercher, proposerUne et regenerer l'appellent tous trois. À instance
// égale, le résultat ne dépend que de la graine dérivée, d'options.arret et
// d'options.historique : les autres options ne servent qu'à rapporter
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
 * ('PLACES_MANQUANTES', { placesManquantes }) quand les tables n'offrent pas
 * assez de sièges, placesManquantes étant le nombre de places qui manquent à
 * chaque tour, celui que rend nombrePlacesManquantes.
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
 * module n'est pas garantie régénérable (§ 8.9). Aucun autre champ n'est lu,
 * ni id ni plan. Rend le seul plan, sans la course que rechercher joint à
 * la proposition. Ne modifie ni la configuration ni la proposition.
 *
 * Lève RangeError quand l'un des trois champs n'est pas un entier de son
 * domaine, graine de 0 à 2^32 − 1, arret et historique ≥ 1 : un champ absent
 * ne reçoit pas la valeur par défaut de rechercher, qui ferait régénérer une
 * autre proposition sans le dire. Lève ce que rechercher lève pour la
 * configuration : ErreurConfiguration de normaliser, PLACES_MANQUANTES.
 *
 * @param {import('./types.js').Configuration} configuration
 * @param {{graine: number, arret: number, historique: number}} proposition
 * @returns {import('./types.js').Plan}
 */
export function regenerer(configuration, { graine, arret, historique }) {
  exigerChampsProposition({ graine, arret, historique });
  const instance = normaliser(configuration);
  const { plan } = proposer(preparer(instance), graine, {
    arret,
    historique,
    dejaFaits: 0,
    total: arret,
  });
  return planDepuisIndex(instance, plan);
}

/**
 * État de recherche au placement initial (§ 5.10) : fixés à leurs tables,
 * libres mélangés par rng.melanger, tour après tour, puis assis table après
 * table dans l'ordre des tables. L'état porte la composition du n-uplet de
 * l'instance. Lève ErreurConfiguration('PLACES_MANQUANTES',
 * { placesManquantes }) comme rechercher.
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
  const { R, S, mobiles, nombreMobiles, tableDuSiege, siege } = etat;
  const r = rng.borne(R);
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
