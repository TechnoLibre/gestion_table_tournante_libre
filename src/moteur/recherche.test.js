// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de la recherche (§ 5.2, § 5.7, § 5.9, § 5.10, § 14.10) : à graine
// et entrée égales, propositions identiques ; l'identifiant d'une proposition
// est son rang dans la suite des graines dérivées, et son plan sort de sa
// graine dérivée, de son compte d'arrêt et de son historique, trois champs à
// partir desquels regenerer le rend ; chaque plan rendu tient les invariants
// et les réservations, et l'appartenance d'un ancré y pèse comme une autre ;
// une salle trop petite est refusée avec le nombre de places manquantes ;
// l'avancement se rapporte toutes les 1 000 itérations, une descente
// s'arrête sur un score nul, une annulation ne rend rien ; le placement
// initial égale celui que décrit le paragraphe « Sièges » de l'en-tête de
// recherche.js, récrit ici à la lettre ; un échange avec une place fantôme
// fait passer une personne à une autre table, comme le dit son paragraphe
// « Mouvement » ; la descente égale l'acceptation tardive de son paragraphe
// « Acceptation tardive », récrite de même, là où ni bascule ni relance ne
// jouent, et sinon augmentée de la bascule et de la relance de son
// paragraphe « Deux ordres d'acceptation » ; le score tenu à jour et le score
// recalculé égalent un n-uplet recalculé ici par énumération des paires, des
// tours servis et des animateurs rencontrés, composé palier par palier sur
// la compilation de l'instance ; la petite démonstration atteint son plan
// parfait sans cas particulier. Sur une configuration inventée à objectifs et
// animateurs, sous chacun des trois modes et sous un ordre réglé, l'état tenu
// à jour s'accorde au recalcul ; la bascule suit l'ordre réglé ; chaque mode
// descend jusqu'aux planchers du diagnostic, et le mode ou l'ordre ne
// changent aucun tirage. Une génération sans départ tire les nombres que
// comptent des littéraux. Une dérivée égale la descente du paragraphe
// « Départ », récrite de même, relances comprises ; ses tours figés ne
// bougent pas, elle n'est jamais pire que son départ, rend le plan parfait
// dont elle part, et son point de relevé k égale regenerer au compte k sous
// le même départ ; un départ que l'instance ne peut pas asseoir tel quel est
// refusé avant tout calcul. Un plan rendu se juge par verifierInvariants et
// se mesure par mesurer, deux modules distincts du module éprouvé.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { CATALOGUE, PLAN_PARFAIT_PETITE } from '../demo/catalogue.js';
import { FLUX, creerPcg32 } from '../demo/prng.js';
import {
  LIBRE,
  RESERVE,
  SANS_GROUPE,
  indexerPlan,
  normaliser,
  planDepuisIndex,
} from './configuration.js';
import { CRITERES, compilationDe, composantesDe } from './criteres.js';
import { diagnostiquer } from './diagnostic.js';
import { ErreurAnnulee, ErreurConfiguration } from './erreurs.js';
import { mesurer } from './indicateurs.js';
import { plafondsAPriori } from './plafond.js';
import {
  creerEtat,
  defaire,
  proposerEtAppliquer,
  proposerParmi,
  proposerUne,
  rechercher,
  regenerer,
  repartir,
  repartirUne,
  scoreComplet,
  scoreIncremental,
  verifierReglages,
} from './recherche.js';
import { verifierInvariants } from './verification.js';
import {
  BASCULE,
  differences,
  empreintesDesCombinaisons,
  empreintesDesPlans,
  exigerVerification,
  lireEmpreintes,
} from '../../test/empreintes_moteur.js';

const SANS_CONTRAINTE = {
  separerAppartenances: false,
  nouveauxVoisins: false,
  nouvelleTable: false,
  varierAppartenances: false,
};
const TOUTES_CONTRAINTES = {
  separerAppartenances: true,
  nouveauxVoisins: true,
  nouvelleTable: true,
  varierAppartenances: true,
};
const NOMS_CONTRAINTES = [
  'separerAppartenances',
  'nouveauxVoisins',
  'nouvelleTable',
  'varierAppartenances',
];
// Longueur d'historique que rechercher prend quand les réglages n'en donnent
// pas (plan, ReglagesGeneration).
const HISTORIQUE_PAR_DEFAUT = 1_000;

// Configuration neuve d'une démonstration du catalogue.
const demo = (cle) => CATALOGUE.find((entree) => entree.cle === cle).construire();

const tous = (participant, table) => ({ participant, table, portee: 'tous' });
const auTour = (participant, table, tour) => ({ participant, table, portee: 'tour', tour });

// Configuration dont le participant d'id i + 1 porte appartenances[i] ; les
// tables reçoivent leurs numéros dans l'ordre de la liste ; un id cité dans
// exclus est exclu.
function configurationDe({
  appartenances,
  tables,
  tours,
  reservations = [],
  contraintes = SANS_CONTRAINTE,
  exclus = [],
}) {
  return {
    participants: appartenances.map((appartenance, i) => ({
      id: i + 1,
      nom: `P${i + 1}`,
      appartenance,
      exclu: exclus.includes(i + 1),
    })),
    tables: tables.map(({ id, capacite }, i) => ({ id, numero: i + 1, capacite })),
    tours,
    reservations,
    contraintes: { ...contraintes },
  };
}

// Trois tables, d'ids 10, 20 et 30 et de 4, 3 et 3 sièges, pour neuf
// participants sur trois tours : une place reste vide à chaque tour. Le
// participant 1 est ancré à la table 20 ; le 2 n'est réservé qu'au tour 2, à
// la table 10 ; le 3 l'est aux tours 1 et 3, à la table 30 ; le 4 au tour 1
// à la table 10 et au tour 3 à la table 20. Huit couples (réservation, tour).
const salleReservee = () =>
  configurationDe({
    appartenances: ['A', 'B', 'A', null, 'B', 'A', null, 'B', null],
    tables: [
      { id: 10, capacite: 4 },
      { id: 20, capacite: 3 },
      { id: 30, capacite: 3 },
    ],
    tours: 3,
    reservations: [
      tous(1, 20),
      auTour(2, 10, 2),
      auTour(3, 30, 1),
      auTour(3, 30, 3),
      auTour(4, 10, 1),
      auTour(4, 20, 3),
    ],
    contraintes: TOUTES_CONTRAINTES,
  });

// Réservations qu'un plan n'honore pas, chacune « participant@table, tour
// n », et le nombre de couples (réservation, tour) examinés.
function reservationsRompues(configuration, plan) {
  const rompues = [];
  let examines = 0;
  for (const { participant, table, portee, tour } of configuration.reservations) {
    const numeros = portee === 'tous' ? plan.tours.map((_, r) => r + 1) : [tour];
    for (const numero of numeros) {
      examines += 1;
      const liste = plan.tours[numero - 1][plan.tables.indexOf(table)];
      if (!liste.includes(participant)) rompues.push(`${participant}@${table}, tour ${numero}`);
    }
  }
  return { rompues, examines };
}

// Six participants sans appartenance, trois tables de 2, un tour, aucune
// contrainte : chacun rencontre son seul voisin, qui est son plafond a
// priori, quel que soit le placement. Le score est nul dès le placement
// initial, et chaque descente rend ce placement.
const troisTablesDeDeux = () =>
  configurationDe({
    appartenances: Array(6).fill(null),
    tables: [
      { id: 1, capacite: 2 },
      { id: 2, capacite: 2 },
      { id: 3, capacite: 2 },
    ],
    tours: 1,
  });

// Placement initial du paragraphe « Sièges » de recherche.js, récrit à la
// lettre : tour après
// tour, les fixés à leur table ; les autres, par index croissant, mélangés
// par rng.melanger, puis assis table après table dans l'ordre des tables,
// aux places que les fixés laissent libres. Rend le plan indexé.
function placementLitteral(instance, rng) {
  const { N, R, capacite, fixe } = instance;
  const tableDe = new Int32Array(N * R);
  for (let r = 0; r < R; r += 1) {
    const restantes = Array.from(capacite);
    const libres = [];
    for (let p = 0; p < N; p += 1) {
      const t = fixe[p * R + r];
      if (t === LIBRE) {
        libres.push(p);
      } else {
        tableDe[p * R + r] = t;
        restantes[t] -= 1;
      }
    }
    let t = 0;
    for (const p of rng.melanger(libres)) {
      while (restantes[t] === 0) t += 1;
      tableDe[p * R + r] = t;
      restantes[t] -= 1;
    }
  }
  return tableDe;
}

// Les tours servis et les tours possibles de chaque personne présente, lus
// directement sur la configuration (§ 4.5) : à la table t au tour r,
// l'objectif du tour remplace celui de la soirée ; une personne y correspond
// sous « ou » quand elle porte l'une de ses étiquettes, sous « et » quand
// elle les porte toutes. (p, r) est possible quand sa table fixée lui
// correspond, ou, p libre, quand une table qui garde un siège libre lui
// correspond ; servi quand p est assis à une table qui lui correspond.
function objectifsDirects(configuration, instance, tableDe) {
  const { N, T, R, idsTables, ids, capacite, fixe } = instance;
  const objectifs = configuration.objectifs ?? [];
  const etiquettesDe = new Map(configuration.participants.map(({ id, etiquettes = [] }) => [id, etiquettes]));
  const objectifA = (t, r) =>
    objectifs.find(({ table, tour }) => table === idsTables[t] && tour === r + 1)
    ?? objectifs.find(({ table, tour }) => table === idsTables[t] && (tour === null || tour === undefined))
    ?? null;
  const correspond = (p, t, r) => {
    const objectif = objectifA(t, r);
    if (objectif === null) return false;
    const siennes = etiquettesDe.get(ids[p]);
    return objectif.regle === 'ou'
      ? objectif.etiquettes.some((motCle) => siennes.includes(motCle))
      : objectif.etiquettes.length > 0 && objectif.etiquettes.every((motCle) => siennes.includes(motCle));
  };
  const possibles = Array(N).fill(0);
  const servis = Array(N).fill(0);
  for (let r = 0; r < R; r += 1) {
    const libres = Array.from(capacite);
    for (let p = 0; p < N; p += 1) if (fixe[p * R + r] !== LIBRE) libres[fixe[p * R + r]] -= 1;
    for (let p = 0; p < N; p += 1) {
      const t = fixe[p * R + r];
      const tables = t === LIBRE ? [...Array(T).keys()].filter((u) => libres[u] > 0) : [t];
      if (tables.some((u) => correspond(p, u, r))) possibles[p] += 1;
      if (correspond(p, tableDe[p * R + r], r)) servis[p] += 1;
    }
  }
  return { possibles, servis };
}

// Les animateurs distincts que chaque personne présente rencontre, lus
// directement : f, autre que p, est rencontré quand p partage sa table à un
// tour où f anime — participants[].anime de la configuration.
function animateursRencontres(configuration, instance, tableDe) {
  const { N, R, indexDe } = instance;
  const animes = configuration.participants
    .filter(({ anime, exclu }) => anime !== undefined && exclu !== true)
    .map(({ id, anime }) => ({ f: indexDe.get(id), tours: anime }));
  return Array.from({ length: N }, (_, p) =>
    animes.filter(({ f, tours }) => f !== p && tours.some((tour) => tableDe[f * R + tour - 1] === tableDe[p * R + tour - 1])).length);
}

// Les grandeurs brutes d'un plan indexé, chacune sous son nom, recalculées
// par énumération directe des paires, des tours servis et des animateurs
// rencontrés, sans mesurer ni le module éprouvé ; les plafonds a priori et
// les bornes des animateurs de l'instance sont les seules grandeurs reçues.
// Les contraintes n'y entrent pas.
function grandeursBrutes(configuration, instance, tableDe, aPriori) {
  const { N, T, R, groupe, fixe, borneAnimateurs } = instance;
  // M[a × N + b], a < b : le nombre de tours où a et b partagent une table.
  const M = new Int32Array(N * N);
  for (let r = 0; r < R; r += 1) {
    for (let a = 0; a < N; a += 1) {
      for (let b = a + 1; b < N; b += 1) {
        const t = tableDe[a * R + r];
        if (t !== RESERVE && t === tableDe[b * R + r]) M[a * N + b] += 1;
      }
    }
  }
  const rencontres = Array(N).fill(0);
  const affilies = Array(N).fill(0);
  const appartenances = Array.from({ length: N }, () => new Set());
  let cumulees = 0;
  let distinctes = 0;
  let excedentPaires = 0;
  for (let a = 0; a < N; a += 1) {
    for (let b = a + 1; b < N; b += 1) {
      const m = M[a * N + b];
      if (m === 0) continue;
      excedentPaires += m - 1;
      for (const [p, q] of [[a, b], [b, a]]) {
        rencontres[p] += 1;
        if (groupe[q] !== SANS_GROUPE) {
          affilies[p] += 1;
          appartenances[p].add(groupe[q]);
        }
      }
      if (groupe[a] !== SANS_GROUPE && groupe[a] === groupe[b]) {
        cumulees += m;
        distinctes += 1;
      }
    }
  }
  // Une table visitée m fois, dont f à un tour où la personne y est
  // réservée, compte m − 1 − max(0, f − 1) retours choisis (§ 5.4).
  let retours = 0;
  for (let p = 0; p < N; p += 1) {
    for (let t = 0; t < T; t += 1) {
      let visites = 0;
      let reservees = 0;
      for (let r = 0; r < R; r += 1) {
        if (tableDe[p * R + r] !== t) continue;
        visites += 1;
        if (fixe[p * R + r] === t) reservees += 1;
      }
      if (visites > 0) retours += visites - 1 - Math.max(0, reservees - 1);
    }
  }
  const ecarts = aPriori.map((plafond, p) => plafond - rencontres[p]);
  // Les objectifs, sur les personnes concernées, P(p) > 0.
  const { possibles, servis } = objectifsDirects(configuration, instance, tableDe);
  const hors = possibles.flatMap((P, p) => (P > 0 ? [P - servis[p]] : []));
  const horsObjectifMax = Math.max(0, ...hors);
  const m = animateursRencontres(configuration, instance, tableDe);
  return {
    ecartAuPlafondAPrioriMax: Math.max(...ecarts),
    carresEcartsAuPlafondAPriori: ecarts.reduce((somme, ecart) => somme + ecart * ecart, 0),
    excedentCollisions: cumulees - distinctes,
    collisionsCumulees: cumulees,
    excedentPaires,
    retoursChoisis: retours,
    redondance: affilies.reduce((somme, f, p) => somme + f - appartenances[p].size, 0),
    toursHorsObjectif: hors.reduce((somme, h) => somme + h, 0),
    jamaisServies: possibles.filter((P, p) => P > 0 && servis[p] === 0).length,
    horsObjectifMax,
    personnesAuMax: horsObjectifMax === 0 ? 0 : hors.filter((h) => h === horsObjectifMax).length,
    animateursNonRencontres: Array.from(borneAnimateurs).reduce((somme, B, p) => somme + B - m[p], 0),
  };
}

// La valeur que la recherche descend pour une grandeur de composantesDe :
// pour les rencontres répétées, Σ max(0, M − 1) sous « nouveaux voisins »,
// plus les retours choisis sous « nouvelle table » (§ 5.7) ; sinon la
// grandeur brute de ce nom.
const valeurDescendue = (brutes, nom, contraintes) => (nom === 'rencontresRepetees'
  ? (contraintes.nouveauxVoisins ? brutes.excedentPaires : 0) + (contraintes.nouvelleTable ? brutes.retoursChoisis : 0)
  : brutes[nom]);

// Le n-uplet du paragraphe « Score » de recherche.js, composé palier par
// palier sur la compilation de l'instance, à partir des grandeurs brutes :
// un critère seul à son palier pose une composante par grandeur qu'il
// descend, son poids multiplié par la grandeur ; un palier partagé, une
// seule, la somme sur ses critères du poids multiplié par la grandeur.
// Rend aussi les grandeurs brutes.
function scoreOracle(instance, tableDe, aPriori, configuration = { participants: [] }) {
  const brutes = grandeursBrutes(configuration, instance, tableDe, aPriori);
  const { paliers, taille } = compilationDe(instance);
  const nUplet = Array(taille).fill(0);
  for (const { criteres, composantes } of paliers) {
    if (criteres.length === 1) {
      const [{ nom, poids }] = criteres;
      composantesDe(nom, instance.modeObjectifs).forEach((grandeur, k) => {
        nUplet[composantes[k]] = poids * valeurDescendue(brutes, grandeur, instance.contraintes);
      });
    } else {
      for (const { nom, poids } of criteres) nUplet[composantes[0]] += poids * valeurDescendue(brutes, nom, instance.contraintes);
    }
  }
  return { nUplet, brutes };
}

// Les deux ordres de comparaison du n-uplet et le rang de la composante du
// plus grand écart, tels que la compilation de l'instance les donne : celui
// du score, et celui des contraintes, qui passe les paliers « contrainte »
// devant celui de l'écart (en-tête de recherche.js).
function ordresDe(instance) {
  const { ordreScore, ordreContraintes, rangEcart } = compilationDe(instance);
  return { ORDRE_DU_SCORE: ordreScore, ORDRE_DES_CONTRAINTES: ordreContraintes, rangEcart };
}
// Longueurs d'historique sans changement du score courant au-delà desquelles
// une descente se relance (en-tête de recherche.js).
const PATIENCE = 10;

// Signe de la comparaison lexicographique de deux n-uplets, composantes
// prises dans l'ordre donné.
function comparerDans(ordre, a, b) {
  for (const k of ordre) if (a[k] !== b[k]) return a[k] - b[k];
  return 0;
}

// Une descente selon les paragraphes « Mouvement » à « Deux ordres
// d'acceptation » de recherche.js, écrite avec les primitives
// publiques : placement initial par creerEtat ; à l'itération i, un
// mouvement de proposerEtAppliquer, gardé si son score est ≤ courant ou
// ≤ H[i mod L] dans l'ordre d'acceptation, défait sinon ; puis H[i mod L]
// reçoit le score courant. La meilleure affectation change sur un score
// strictement meilleur dans l'ordre du score. Arrêt après arret mouvements
// évalués, ou sur le n-uplet nul.
//
// Sans bascule, l'ordre d'acceptation reste celui du score : c'est
// l'acceptation tardive seule, à la lettre (§ 5.10). Avec, il devient l'ordre des contraintes dès que la
// meilleure affectation porte un écart maximal nul, lu au rang que la
// compilation donne au plus grand écart ; dans cet ordre, un score courant
// inchangé pendant PATIENCE × L itérations fait repartir la descente d'un
// placement neuf, tiré du même générateur, l'historique à son score (en-tête
// de recherche.js). Rend le plan et quatre comptes : bascules, relances,
// meilleures affectations trouvées après une relance, et meilleures
// affectations qu'un mouvement trouve après la dernière relance (zéro sans
// relance).
//
// rng, le générateur des mouvements, est par défaut celui de la graine
// dérivée ; partir() construit l'état du début et de chaque relance,
// creerEtat sur rng par défaut ; mouvoir(etat, rng) tire et applique un
// mouvement, proposerEtAppliquer par défaut. Une dérivée (paragraphe
// « Départ ») se récrit en passant l'état de son départ et proposerParmi.
function descendreALaLettre(instance, graineDerivee, arret, L, {
  bascule,
  rng = creerPcg32(graineDerivee, FLUX.RECHERCHE),
  partir = () => creerEtat(instance, rng),
  mouvoir = proposerEtAppliquer,
}) {
  const { ORDRE_DU_SCORE, ORDRE_DES_CONTRAINTES, rangEcart } = ordresDe(instance);
  let etat = partir();
  let courant = scoreIncremental(etat);
  let meilleur = courant;
  let meilleurPlan = Int32Array.from(etat.tableDe);
  let H = Array(L).fill(courant);
  let ordre = ORDRE_DU_SCORE;
  let immobile = 0;
  const comptes = { bascules: 0, relances: 0, apresRelance: 0, apresDerniere: 0 };
  const basculer = () => {
    if (!bascule || ordre === ORDRE_DES_CONTRAINTES || rangEcart === null || meilleur[rangEcart] !== 0) return;
    ordre = ORDRE_DES_CONTRAINTES;
    comptes.bascules += 1;
  };
  const retenir = (parMouvement) => {
    if (comparerDans(ORDRE_DU_SCORE, courant, meilleur) >= 0) return;
    meilleur = courant;
    meilleurPlan = Int32Array.from(etat.tableDe);
    if (comptes.relances > 0) comptes.apresRelance += 1;
    if (comptes.relances > 0 && parMouvement) comptes.apresDerniere += 1;
    basculer();
  };
  basculer();
  for (let i = 0; i < arret && courant.some((composante) => composante !== 0); i += 1) {
    if (immobile >= PATIENCE * L && ordre === ORDRE_DES_CONTRAINTES) {
      etat = partir();
      courant = scoreIncremental(etat);
      H = Array(L).fill(courant);
      comptes.relances += 1;
      comptes.apresDerniere = 0;
      retenir(false);
      immobile = 0;
    }
    const mouvement = mouvoir(etat, rng);
    let change = false;
    if (mouvement !== null) {
      const candidat = scoreIncremental(etat);
      if (comparerDans(ordre, candidat, courant) <= 0 || comparerDans(ordre, candidat, H[i % L]) <= 0) {
        change = comparerDans(ORDRE_DU_SCORE, candidat, courant) !== 0;
        courant = candidat;
        retenir(true);
      } else {
        defaire(etat, mouvement);
      }
    }
    H[i % L] = courant;
    immobile = change ? 0 : immobile + 1;
  }
  return { plan: planDepuisIndex(instance, meilleurPlan), ...comptes };
}

// Les descentes à la lettre pour ces réglages, historique compris : la
// i-ème part de la i-ème graine que FLUX.GRAINES tire de graine (paragraphe
// « Graines » de recherche.js, § 5.7).
function descentesALaLettre(configuration, { graine, arret, nombre, historique }, options) {
  const instance = normaliser(configuration);
  const graines = creerPcg32(graine, FLUX.GRAINES);
  return Array.from({ length: nombre }, () =>
    descendreALaLettre(instance, graines.suivant(), arret, historique, options));
}

// Les plans de l'acceptation tardive seule, à la lettre : sans bascule ni
// relance.
const plansLitteraux = (configuration, reglages) =>
  descentesALaLettre(configuration, reglages, { bascule: false }).map(({ plan }) => plan);

describe('rechercher : reproductibilité et identifiants (§ 5.7, § 19.4)', () => {
  test('mêmes configuration et réglages : propositions identiques ; une autre graine change au moins un plan', () => {
    const reglages = { graine: 11, arret: 2_000, nombre: 2 };
    const premieres = rechercher(demo('grande'), reglages);
    assert.equal(premieres.length, 2);
    assert.deepStrictEqual(rechercher(demo('grande'), reglages), premieres);
    const autres = rechercher(demo('grande'), { ...reglages, graine: 12 });
    assert.notDeepStrictEqual(
      autres.map((proposition) => proposition.plan),
      premieres.map((proposition) => proposition.plan),
    );
  });

  test("l'identifiant est le rang dans la suite des graines dérivées ; la proposition 2 de 3 égale celle de 5", () => {
    const trois = rechercher(demo('petite'), { graine: 7, arret: 3_000, nombre: 3 });
    const cinq = rechercher(demo('petite'), { graine: 7, arret: 3_000, nombre: 5 });
    const graines = creerPcg32(7, FLUX.GRAINES);
    const derivees = Array.from({ length: 5 }, () => graines.suivant());
    assert.deepEqual(cinq.map((proposition) => proposition.id), [1, 2, 3, 4, 5]);
    assert.deepEqual(cinq.map((proposition) => proposition.graine), derivees);
    assert.deepEqual(cinq.map((proposition) => proposition.arret), [3_000, 3_000, 3_000, 3_000, 3_000]);
    assert.deepStrictEqual(trois[1], cinq[1]);
    assert.deepStrictEqual(trois, cinq.slice(0, 3));
  });

  test("chaque proposition porte la longueur d'historique qui l'a produite (§ 5.7, § 8.9)", () => {
    // Graine, arret et historique décident ensemble du plan : une
    // proposition qui ne porterait pas le troisième ne se régénérerait que
    // sous la valeur par défaut.
    const parDefaut = rechercher(demo('petite'), { graine: 7, arret: 500, nombre: 2 });
    assert.deepEqual(parDefaut.map((proposition) => proposition.historique), [
      HISTORIQUE_PAR_DEFAUT,
      HISTORIQUE_PAR_DEFAUT,
    ]);
    const reglee = rechercher(demo('petite'), { graine: 7, arret: 500, nombre: 2, historique: 37 });
    assert.deepEqual(reglee.map((proposition) => proposition.historique), [37, 37]);
  });

  test('chaque proposition est le placement que sa graine dérivée tire par le flux de la recherche', () => {
    // Score nul dès le placement : chaque descente rend son placement
    // initial, que creerEtat redonne à partir de la seule graine de la
    // proposition. Les quatre placements diffèrent : un générateur partagé
    // entre les propositions, ou tiré d'une autre graine ou d'un autre flux,
    // en donnerait d'autres.
    const configuration = troisTablesDeDeux();
    const instance = normaliser(configuration);
    const propositions = rechercher(configuration, { graine: 21, arret: 1_000, nombre: 4 });
    const attendus = propositions.map(({ graine }) =>
      planDepuisIndex(instance, creerEtat(instance, creerPcg32(graine, FLUX.RECHERCHE)).tableDe));
    assert.deepStrictEqual(propositions.map(({ plan }) => plan), attendus);
    assert.equal(new Set(attendus.map((plan) => JSON.stringify(plan))).size, 4);
  });

  test('rechercher ne modifie pas la configuration reçue', () => {
    const configuration = salleReservee();
    rechercher(configuration, { graine: 1, arret: 500, nombre: 1 });
    assert.deepStrictEqual(configuration, salleReservee());
  });

  test('réglage hors de son domaine : RangeError qui le nomme', () => {
    const cas = [
      [{ graine: -1, arret: 10, nombre: 1 }, 'graine'],
      [{ graine: 2 ** 32, arret: 10, nombre: 1 }, 'graine'],
      [{ graine: 1.5, arret: 10, nombre: 1 }, 'graine'],
      [{ graine: 1, arret: 0, nombre: 1 }, 'arret'],
      [{ graine: 1, arret: 2.5, nombre: 1 }, 'arret'],
      [{ graine: 1, arret: '10', nombre: 1 }, 'arret'],
      [{ graine: 1, arret: 10, nombre: 0 }, 'nombre'],
      [{ graine: 1, arret: 10, nombre: 1, historique: 0 }, 'historique'],
    ];
    for (const [reglages, nom] of cas) {
      assert.throws(
        () => rechercher(demo('petite'), reglages),
        (erreur) => erreur instanceof RangeError && erreur.message.startsWith(`${nom} :`),
        JSON.stringify(reglages),
      );
    }
  });

  test("le message cite le domaine et la valeur reçue : un nombre tel quel, toute autre valeur suivie de son type", () => {
    const cas = [
      [{ graine: -1, arret: 10, nombre: 1 }, 'graine : entier de 0 à 4294967295 attendu, reçu -1'],
      [{ graine: 1, arret: '10', nombre: 1 }, `arret : entier de 1 à ${Number.MAX_SAFE_INTEGER} attendu, reçu 10 (string)`],
      [{ graine: 1, arret: 10, nombre: null }, `nombre : entier de 1 à ${Number.MAX_SAFE_INTEGER} attendu, reçu null (object)`],
    ];
    for (const [reglages, message] of cas) {
      assert.throws(() => rechercher(demo('petite'), reglages), { name: 'RangeError', message }, JSON.stringify(reglages));
    }
  });

  test('verifierReglages : la règle de rechercher, la même RangeError, qui porte le nom du réglage', () => {
    const cas = [
      [{ graine: 2 ** 32, arret: 10, nombre: 1 }, 'graine'],
      [{ graine: 1, arret: 2.5, nombre: 1 }, 'arret'],
      [{ graine: 1, arret: 10, nombre: 0 }, 'nombre'],
      [{ graine: 1, arret: 10, nombre: 1, historique: 0 }, 'historique'],
      [{ graine: -1, arret: 0, nombre: 0, historique: 0 }, 'graine'],
    ];
    for (const [reglages, nom] of cas) {
      let leve = null;
      try {
        verifierReglages(reglages);
      } catch (erreur) {
        leve = erreur;
      }
      assert.ok(leve instanceof RangeError, JSON.stringify(reglages));
      assert.equal(leve.reglage, nom);
      assert.throws(
        () => rechercher(demo('petite'), reglages),
        (erreur) => erreur instanceof RangeError && erreur.message === leve.message && erreur.reglage === nom,
      );
    }
    // L'historique absent prend la valeur par défaut de rechercher.
    assert.equal(verifierReglages({ graine: 0, arret: 1, nombre: 1 }), undefined);
    assert.equal(verifierReglages({ graine: 2 ** 32 - 1, arret: 1, nombre: 1, historique: 1 }), undefined);
  });
});

describe('proposerUne : une proposition par son rang (§ 5.7, § 5.10)', () => {
  test('pour chaque rang de 1 à nombre, la proposition de ce rang de rechercher, octet pour octet', () => {
    const cles = ['petite', 'petite-conflit'];
    assert.equal(cles.length, 2);
    for (const cle of cles) {
      const reglages = { graine: 4_242, arret: 3_000, nombre: 5, historique: 200 };
      const attendues = rechercher(demo(cle), reglages);
      assert.equal(attendues.length, 5);
      for (let rang = 1; rang <= reglages.nombre; rang += 1) {
        const une = proposerUne(demo(cle), reglages, rang);
        assert.equal(JSON.stringify(une), JSON.stringify(attendues[rang - 1]), `${cle}, rang ${rang}`);
        assert.deepStrictEqual(une, attendues[rang - 1]);
      }
    }
  });

  test("le rang dans un ordre quelconque, l'historique absent : la même proposition, à l'historique par défaut", () => {
    const reglages = { graine: 9, arret: 1_500, nombre: 4 };
    const attendues = rechercher(demo('petite'), reglages);
    const desordre = [3, 1, 4, 2].map((rang) => proposerUne(demo('petite'), reglages, rang));
    assert.deepStrictEqual(
      [...desordre].sort((a, b) => a.id - b.id),
      attendues,
    );
    assert.deepEqual(desordre.map(({ historique }) => historique), [1_000, 1_000, 1_000, 1_000]);
  });

  test("l'avancement se compte dans la seule proposition : fait de 1 000 en 1 000, sur arret", () => {
    const etapes = [];
    proposerUne(
      demo('petite-conflit'),
      { graine: 3, arret: 2_500, nombre: 3 },
      2,
      { progression: (fait, total) => etapes.push([fait, total]) },
    );
    assert.deepEqual(etapes, [
      [1_000, 2_500],
      [2_000, 2_500],
    ]);
  });

  test('un signal levé avant le départ, ou à sa deuxième lecture, fait lever ErreurAnnulee sans rien rendre', () => {
    assert.throws(
      () => proposerUne(demo('petite'), { graine: 3, arret: 5_000, nombre: 2 }, 1, { signal: { aborted: true } }),
      ErreurAnnulee,
    );
    let lectures = 0;
    const signal = {
      get aborted() {
        lectures += 1;
        return lectures >= 2;
      },
    };
    const etapes = [];
    assert.throws(
      () =>
        proposerUne(
          demo('petite-conflit'),
          { graine: 3, arret: 5_000, nombre: 2 },
          2,
          { signal, progression: (fait, total) => etapes.push([fait, total]) },
        ),
      ErreurAnnulee,
    );
    assert.equal(lectures, 2);
    assert.deepEqual(etapes, [[1_000, 5_000]]);
  });

  test('un rang hors de 1 à nombre, ou non entier, lève une RangeError qui nomme rang ; un réglage hors de son domaine, celle de verifierReglages', () => {
    const reglages = { graine: 1, arret: 10, nombre: 3 };
    const rangs = [0, 4, 1.5, '1', -1];
    assert.equal(rangs.length, 5);
    for (const rang of rangs) {
      assert.throws(
        () => proposerUne(demo('petite'), reglages, rang),
        (erreur) => erreur instanceof RangeError && erreur.reglage === 'rang' && erreur.message.startsWith('rang :'),
        String(rang),
      );
    }
    assert.throws(
      () => proposerUne(demo('petite'), { ...reglages, graine: 2 ** 32 }, 1),
      (erreur) => erreur instanceof RangeError && erreur.reglage === 'graine',
    );
    assert.throws(
      () => proposerUne(demo('petite'), { ...reglages, nombre: 0 }, 1),
      (erreur) => erreur instanceof RangeError && erreur.reglage === 'nombre',
    );
  });

  test('ne modifie pas la configuration reçue ; une salle trop petite lève PLACES_MANQUANTES comme rechercher', () => {
    const configuration = salleReservee();
    proposerUne(configuration, { graine: 1, arret: 500, nombre: 2 }, 2);
    assert.deepStrictEqual(configuration, salleReservee());
    const petite = demo('petite');
    petite.tables = petite.tables.slice(1);
    assert.throws(
      () => proposerUne(petite, { graine: 1, arret: 10, nombre: 1 }, 1),
      (erreur) => erreur.code === 'PLACES_MANQUANTES' && erreur.details.placesManquantes === 3,
    );
  });
});

describe('regenerer : une proposition depuis ses seuls champs (§ 5.7, § 8.9)', () => {
  test("pour chaque proposition d'une génération, regenerer rend le même plan à partir de ses trois champs, sans lire ni son plan ni son rang", () => {
    // arret 5 000 n'est pas un multiple de l'historique 37 : une descente
    // dont le plan dépendrait de son rang dans la génération, par le compte
    // des mouvements que la génération a déjà faits, ne se régénérerait pas
    // au-delà de la première proposition. Les propositions se régénèrent de
    // la dernière à la première, et regenerer ne reçoit que leur graine
    // dérivée, leur compte d'arrêt et leur historique, ni leur plan ni leur
    // identifiant : chacune sort de ces trois champs, et non de son rang ou
    // d'un état que la précédente aurait laissé. salleReservee porte des
    // places fantômes et des partiellement fixés.
    const reglages = { graine: 5, arret: 5_000, nombre: 3, historique: 37 };
    let regenerees = 0;
    let conflit = null;
    for (const [nom, construire] of [
      ['salleReservee', salleReservee],
      ['petite-conflit', () => demo('petite-conflit')],
    ]) {
      const configuration = construire();
      const propositions = rechercher(configuration, reglages);
      for (const { id, graine, arret, historique, plan } of [...propositions].reverse()) {
        assert.deepStrictEqual(
          regenerer(configuration, { graine, arret, historique }),
          plan,
          `${nom}, proposition ${id}`,
        );
        regenerees += 1;
      }
      assert.deepStrictEqual(configuration, construire(), nom);
      // L'historique décide du plan : sous la longueur par défaut, les mêmes
      // graines donnent d'autres plans, ceux que rendrait une régénération
      // qui ignorerait ce champ.
      assert.notDeepStrictEqual(
        rechercher(configuration, { ...reglages, historique: HISTORIQUE_PAR_DEFAUT }).map(({ plan }) => plan),
        propositions.map(({ plan }) => plan),
        nom,
      );
      conflit = propositions;
    }
    assert.equal(regenerees, 6);
    // Dans la variante conflit, chaque descente atteint un écart nul,
    // bascule, puis relance : la réplique littérale rend les mêmes plans, et
    // compte bascules et relances. La régénération rejoue donc aussi le
    // placement neuf qu'une relance tire.
    const repliques = descentesALaLettre(demo('petite-conflit'), reglages, { bascule: true });
    assert.deepStrictEqual(repliques.map(({ plan }) => plan), conflit.map(({ plan }) => plan));
    assert.deepEqual(
      repliques.map(({ bascules, relances }) => [bascules, relances > 0]),
      [
        [1, true],
        [1, true],
        [1, true],
      ],
    );
  });

  test("le compte d'arrêt décide du plan : à chaque compte de 1 à 32, regenerer rend chaque plan, et un compte au moins change un plan du précédent ; à 100, regenerer rend chaque plan, et la moitié comme le double de ce compte en donnent d'autres", () => {
    // Là où la descente ne progresse plus, comme à 5 000 mouvements dans
    // l'épreuve précédente, la moitié ou le double du compte rendent les
    // mêmes plans, et une régénération qui compterait autrement passerait.
    //
    // Sur ses premiers mouvements, la descente change souvent de meilleure
    // affectation. À chaque compte de 1 à COMPTES_COURTS, regenerer rend le
    // plan de chaque proposition à partir de ses trois champs, et l'épreuve
    // exige qu'un compte au moins de la boucle change un plan par rapport au
    // compte précédent : une régénération qui compterait un mouvement de
    // moins rend un autre plan à ce compte, et une qui en compterait un de
    // plus, au compte précédent.
    //
    // À 100 mouvements, la descente progresse encore. Une descente plus
    // courte refait, mouvement pour mouvement, le début de celle-ci, et la
    // meilleure affectation ne cède qu'à une meilleure : des plans qui
    // changent à arret / 2 et à 2 × arret changent à tout compte hors de cet
    // intervalle.
    const COMPTES_COURTS = 32;
    const configuration = demo('petite-conflit');
    const reglages = { graine: 5, arret: 100, nombre: 3, historique: 37 };
    let precedents = null;
    let changements = 0;
    for (let compte = 1; compte <= COMPTES_COURTS; compte += 1) {
      const courtes = rechercher(configuration, { ...reglages, arret: compte });
      for (const { id, graine, arret, historique, plan } of courtes) {
        assert.deepStrictEqual(
          regenerer(configuration, { graine, arret, historique }),
          plan,
          `arret ${compte}, proposition ${id}`,
        );
      }
      const plans = courtes.map(({ plan }) => JSON.stringify(plan));
      if (precedents !== null && plans.some((plan, i) => plan !== precedents[i])) changements += 1;
      precedents = plans;
    }
    assert.ok(changements > 0, `aucun compte de 2 à ${COMPTES_COURTS} ne change un plan du compte précédent`);
    const propositions = rechercher(configuration, reglages);
    for (const { id, graine, arret, historique, plan } of [...propositions].reverse()) {
      assert.deepStrictEqual(regenerer(configuration, { graine, arret, historique }), plan, `proposition ${id}`);
    }
    for (const arret of [reglages.arret / 2, 2 * reglages.arret]) {
      assert.notDeepStrictEqual(
        rechercher(configuration, { ...reglages, arret }).map(({ plan }) => plan),
        propositions.map(({ plan }) => plan),
        `arret ${arret}`,
      );
    }
  });

  test('champ hors de son domaine ou absent : RangeError qui le nomme ; salle trop petite : PLACES_MANQUANTES, comme rechercher', () => {
    // Un champ absent ne prend pas la valeur par défaut de rechercher : une
    // proposition qui ne porte pas son historique ne se régénère pas sous une
    // longueur supposée. Les deux bornes de la graine sont admises.
    const champs = { graine: 1, arret: 10, historique: 5 };
    for (const graine of [0, 2 ** 32 - 1]) {
      assert.equal(regenerer(demo('petite'), { ...champs, graine }).tours.length, 4, `graine ${graine}`);
    }
    const cas = [
      [{ ...champs, graine: -1 }, 'graine'],
      [{ ...champs, graine: 2 ** 32 }, 'graine'],
      [{ ...champs, graine: 1.5 }, 'graine'],
      [{ arret: 10, historique: 5 }, 'graine'],
      [{ ...champs, arret: 0 }, 'arret'],
      [{ ...champs, arret: '10' }, 'arret'],
      [{ ...champs, historique: 0 }, 'historique'],
      [{ graine: 1, arret: 10 }, 'historique'],
    ];
    for (const [proposition, nom] of cas) {
      assert.throws(
        () => regenerer(demo('petite'), proposition),
        (erreur) => erreur instanceof RangeError && erreur.message.startsWith(`${nom} :`),
        JSON.stringify(proposition),
      );
    }
    const tropPetite = configurationDe({
      appartenances: Array(11).fill(null),
      tables: [
        { id: 1, capacite: 4 },
        { id: 2, capacite: 4 },
      ],
      tours: 2,
    });
    assert.throws(() => regenerer(tropPetite, champs), {
      name: 'ErreurConfiguration',
      code: 'PLACES_MANQUANTES',
      details: { placesManquantes: 3 },
    });
  });
});

describe('rechercher : plans valides (§ 5.2, § 5.9, § 14.12)', () => {
  test('chaque proposition des quatre démonstrations tient tous les invariants, réserve interdite', () => {
    let examinees = 0;
    for (const { cle, construire } of CATALOGUE) {
      const configuration = construire();
      const instance = normaliser(configuration);
      for (const { id, plan } of rechercher(configuration, { graine: 5, arret: 2_000, nombre: 2 })) {
        assert.deepEqual(verifierInvariants(instance, plan), [], `${cle}, proposition ${id}`);
        examinees += 1;
      }
    }
    assert.equal(examinees, 8);
  });

  test('ancrés et partiellement fixés sont à leur table à chaque tour fixé', () => {
    let examines = 0;
    for (const configuration of [salleReservee(), demo('grande')]) {
      for (const { id, plan } of rechercher(configuration, { graine: 9, arret: 3_000, nombre: 2 })) {
        const releve = reservationsRompues(configuration, plan);
        assert.deepEqual(releve.rompues, [], `proposition ${id}`);
        examines += releve.examines;
      }
    }
    // Deux propositions de chacune : huit couples dans la salle, 33 ancrés
    // sur 4 tours dans la grande démonstration.
    assert.equal(examines, 2 * 8 + 2 * 33 * 4);
  });

  test("l'appartenance d'un ancré compte : son collègue mobile n'est jamais assis à sa table", () => {
    // Trois tables de 3, trois tours. 1 et 2 portent l'appartenance X, 1 est
    // ancré à la table 1. Chacun peut rencontrer six personnes sans croiser
    // personne deux fois, 2 compris, sans jamais s'asseoir à la table 1 :
    // trois des quatre classes parallèles du plan affine d'ordre 3, celle où
    // 1 et 2 se retrouvent écartée. Éviter la table 1 coûte à 2 au moins un
    // retour, que la séparation fait accepter. Une recherche qui ignorerait
    // l'appartenance de l'ancré l'y assiérait pour épargner ce retour.
    const configuration = configurationDe({
      appartenances: ['X', 'X', null, null, null, null, null, null, null],
      tables: [
        { id: 1, capacite: 3 },
        { id: 2, capacite: 3 },
        { id: 3, capacite: 3 },
      ],
      tours: 3,
      reservations: [tous(1, 1)],
      contraintes: { ...SANS_CONTRAINTE, separerAppartenances: true, nouvelleTable: true },
    });
    const instance = normaliser(configuration);
    const propositions = rechercher(configuration, { graine: 4, arret: 20_000, nombre: 3 });
    assert.equal(propositions.length, 3);
    for (const { id, plan } of propositions) {
      const mesures = mesurer(instance, indexerPlan(instance, plan));
      assert.equal(mesures.collisionsCumulees, 0, `proposition ${id}`);
      assert.deepEqual(
        plan.tours.map((listes) => listes[plan.tables.indexOf(1)].includes(2)),
        [false, false, false],
        `proposition ${id}`,
      );
      assert.ok(mesures.retoursChoisis[instance.indexDe.get(2)] >= 1, `proposition ${id}`);
    }
  });

  test('salle trop petite : PLACES_MANQUANTES et le nombre exact de places manquantes, aucun plan', () => {
    // Douze inscrits dont un exclu, deux tables de 4 et une de 2 : onze
    // présents pour dix places. L'exclu ne compte pas, une réservation ne
    // change rien au compte (§ 5.9). Le détail se nomme placesManquantes,
    // comme dans le diagnostic : « manque » désigne plafond réalisé −
    // rencontres (§ 5.5).
    const tables = [
      { id: 1, capacite: 4 },
      { id: 2, capacite: 4 },
      { id: 3, capacite: 2 },
    ];
    const appartenances = Array(12).fill(null);
    const sansReservation = configurationDe({ appartenances, tables, tours: 2, exclus: [12] });
    const avecReservations = configurationDe({
      appartenances,
      tables,
      tours: 2,
      exclus: [12],
      reservations: [tous(1, 1), auTour(2, 3, 2)],
    });
    const reglages = { graine: 1, arret: 100, nombre: 2 };
    for (const configuration of [sansReservation, avecReservations]) {
      assert.throws(() => rechercher(configuration, reglages), {
        name: 'ErreurConfiguration',
        code: 'PLACES_MANQUANTES',
        details: { placesManquantes: 1 },
      });
    }
    const unDePlus = configurationDe({ appartenances: Array(13).fill(null), tables, tours: 2 });
    assert.throws(() => rechercher(unDePlus, reglages), {
      code: 'PLACES_MANQUANTES',
      details: { placesManquantes: 3 },
    });
  });
});

describe('rechercher : avancement et annulation (§ 5.10)', () => {
  test('progression toutes les 1 000 itérations, au rang du mouvement dans nombre × arret', () => {
    const etapes = [];
    const propositions = rechercher(
      demo('petite'),
      { graine: 3, arret: 2_500, nombre: 2 },
      { progression: (fait, total) => etapes.push([fait, total]) },
    );
    assert.equal(propositions.length, 2);
    assert.deepEqual(etapes, [
      [1_000, 5_000],
      [2_000, 5_000],
      [3_000, 5_000],
      [4_000, 5_000],
      [5_000, 5_000],
    ]);
  });

  test("score nul dès le placement : chaque descente s'arrête sans évaluer de mouvement", () => {
    // Le signal se lit une fois avant chaque proposition, et progression ne
    // reçoit rien : aucun millième mouvement n'est atteint.
    const configuration = troisTablesDeDeux();
    let lectures = 0;
    const signal = {
      get aborted() {
        lectures += 1;
        return false;
      },
    };
    const etapes = [];
    const propositions = rechercher(
      configuration,
      { graine: 8, arret: 50_000, nombre: 2 },
      { signal, progression: (fait, total) => etapes.push([fait, total]) },
    );
    assert.equal(propositions.length, 2);
    assert.deepEqual(etapes, []);
    assert.equal(lectures, 2);
  });

  test('un signal levé à sa deuxième lecture fait lever ErreurAnnulee, sans rien rendre', () => {
    let lectures = 0;
    const signal = {
      get aborted() {
        lectures += 1;
        return lectures >= 2;
      },
    };
    const etapes = [];
    let rendu = 'rien';
    assert.throws(() => {
      rendu = rechercher(
        demo('petite'),
        { graine: 3, arret: 5_000, nombre: 3 },
        { signal, progression: (fait, total) => etapes.push([fait, total]) },
      );
    }, ErreurAnnulee);
    assert.equal(rendu, 'rien');
    assert.equal(lectures, 2);
    assert.deepEqual(etapes, [[1_000, 15_000]]);
  });

  test('arret 999 : aucun millième mouvement, donc ni progression ni lecture du signal pendant la descente, pour rechercher comme pour proposerUne', () => {
    // Le rang du mouvement en cours part de 1 : le dernier vaut 999, la
    // cadence de 1 000 n'est pas atteinte, et le signal ne se lit qu'avant
    // la proposition.
    const reglages = { graine: 3, arret: 999, nombre: 1 };
    let lectures = 0;
    const signal = {
      get aborted() {
        lectures += 1;
        return false;
      },
    };
    const etapes = [];
    const options = { signal, progression: (fait, total) => etapes.push([fait, total]) };
    const [proposition] = rechercher(demo('petite'), reglages, options);
    const une = proposerUne(demo('petite'), reglages, 1, options);
    assert.deepEqual([proposition.evalues, une.evalues], [999, 999]);
    assert.deepEqual(etapes, []);
    assert.equal(lectures, 2);
  });
});

describe('état de recherche : placement initial et score incrémental (§ 5.10)', () => {
  test("creerEtat : fixés à leur table, les autres table après table dans l'ordre des tables", () => {
    // 264 sièges pour 260 personnes : les 32 premières tables se remplissent,
    // la 33e reçoit son animateur et les trois derniers mobiles, à chaque
    // tour.
    const instance = normaliser(demo('grande-sans-exception'));
    const etat = creerEtat(instance, creerPcg32(1, FLUX.RECHERCHE));
    const plan = planDepuisIndex(instance, etat.tableDe);
    assert.equal(plan.tours.length, 4);
    for (const listes of plan.tours) {
      assert.deepEqual(listes.map((liste) => liste.length), [...Array(32).fill(8), 4]);
    }
    assert.deepEqual(verifierInvariants(instance, plan), []);
  });

  test("creerEtat : le placement initial décrit en tête de recherche.js, à la lettre", () => {
    // La réplique tire du même flux, dans le même ordre : les deux plans
    // coïncident, et les deux générateurs restent au même point.
    for (const configuration of [salleReservee(), demo('petite'), demo('grande')]) {
      const instance = normaliser(configuration);
      const rng = creerPcg32(13, FLUX.RECHERCHE);
      const temoin = creerPcg32(13, FLUX.RECHERCHE);
      const etat = creerEtat(instance, rng);
      assert.deepStrictEqual(etat.tableDe, placementLitteral(instance, temoin));
      assert.equal(rng.suivant(), temoin.suivant());
    }
  });

  test('scoreIncremental égale scoreComplet au départ, après 1 et 10 mouvements, et revient au départ une fois défaits', () => {
    const instance = normaliser(demo('petite'));
    const rng = creerPcg32(42, FLUX.RECHERCHE);
    const etat = creerEtat(instance, rng);
    const depart = scoreIncremental(etat);
    const planDepart = Int32Array.from(etat.tableDe);
    assert.equal(depart.length, 6);
    assert.deepStrictEqual(depart, scoreComplet(etat));
    const appliques = [];
    for (let essai = 0; appliques.length < 10 && essai < 1_000; essai += 1) {
      const mouvement = proposerEtAppliquer(etat, rng);
      if (mouvement === null) continue;
      appliques.push(mouvement);
      if (appliques.length === 1 || appliques.length === 10) {
        assert.deepStrictEqual(scoreIncremental(etat), scoreComplet(etat), `${appliques.length} mouvements`);
      }
    }
    assert.equal(appliques.length, 10);
    assert.notDeepStrictEqual(etat.tableDe, planDepart);
    for (const mouvement of appliques.reverse()) defaire(etat, mouvement);
    assert.deepStrictEqual(etat.tableDe, planDepart);
    assert.deepStrictEqual(scoreIncremental(etat), depart);
  });
});

describe("rechercher : l'échange avec une place fantôme (paragraphe « Mouvement » de recherche.js)", () => {
  test("une personne passe au siège vide d'une autre table : deux tables de 3 pour A, A, B, B, aucune collision sur vingt graines", () => {
    // Le placement initial assied trois personnes à la première table et la
    // quatrième à la seconde : deux d'une même appartenance s'y retrouvent.
    // Un échange entre deux personnes garde trois et une ; seul l'échange
    // avec une place fantôme fait passer quelqu'un à la seconde table. À
    // deux par table, chacune peut réunir un A et un B, sans collision.
    const configuration = configurationDe({
      appartenances: ['A', 'A', 'B', 'B'],
      tables: [
        { id: 1, capacite: 3 },
        { id: 2, capacite: 3 },
      ],
      tours: 1,
      contraintes: { ...SANS_CONTRAINTE, separerAppartenances: true },
    });
    const instance = normaliser(configuration);
    const collisions = [];
    for (let graine = 0; graine < 20; graine += 1) {
      const [{ plan }] = rechercher(configuration, { graine, arret: 2_000, nombre: 1 });
      collisions.push(mesurer(instance, indexerPlan(instance, plan)).collisionsCumulees);
    }
    assert.deepEqual(collisions, Array(20).fill(0));
  });
});

// Un générateur qui rend, appel après appel, les valeurs imposées, et note
// chaque borne qu'on lui demande.
function tiragesImposes(valeurs) {
  const bornes = [];
  return {
    bornes,
    borne(n) {
      bornes.push(n);
      return valeurs.shift();
    },
  };
}

describe("mouvement : les tirages d'un tour et ses refus (paragraphe « Mouvement » de recherche.js)", () => {
  // Deux tables de 2, quatre personnes, trois tours ; 1 est ancré à la
  // table 1, 3 à la table 2. Au tour 1, 2 est réservé à la table 1 : un seul
  // siège mobile, le second de la table 2, pour 4. Au tour 2, deux sièges
  // mobiles, le second de chaque table, pour 2 et 4. Au tour 3, 2 est à la
  // table 1 et 4 à la table 2 : aucun siège mobile.
  const configuration = () =>
    configurationDe({
      appartenances: [null, null, null, null],
      tables: [
        { id: 1, capacite: 2 },
        { id: 2, capacite: 2 },
      ],
      tours: 3,
      reservations: [tous(1, 1), tous(3, 2), auTour(2, 1, 1), auTour(2, 1, 3), auTour(4, 2, 3)],
    });

  test('un tour de moins de deux sièges mobiles ne tire que son tour, et rend un mouvement rejeté', () => {
    const etat = creerEtat(normaliser(configuration()), creerPcg32(1, FLUX.RECHERCHE));
    const avant = Int32Array.from(etat.tableDe);
    for (const r of [0, 2]) {
      const rng = tiragesImposes([0, 0, 0]);
      assert.equal(proposerParmi(etat, rng, [r]), null, `tour ${r + 1}`);
      assert.deepEqual(rng.bornes, [1], `tour ${r + 1}`);
    }
    assert.deepStrictEqual(etat.tableDe, avant);
  });

  test('deux sièges mobiles à deux tables différentes suffisent à un échange', () => {
    const instance = normaliser(configuration());
    const etat = creerEtat(instance, creerPcg32(1, FLUX.RECHERCHE));
    const { R, indexDe } = instance;
    const cases = [indexDe.get(2) * R + 1, indexDe.get(4) * R + 1];
    const avant = cases.map((i) => etat.tableDe[i]);
    assert.deepEqual([...avant].sort(), [0, 1]);
    // Au tour 2, les sièges mobiles sont le siège 1, à la table 1, et le
    // siège 3, à la table 2.
    const rng = tiragesImposes([0, 0, 1]);
    assert.deepEqual(proposerParmi(etat, rng, [1]), { tour: 1, a: 1, b: 3 });
    assert.deepEqual(rng.bornes, [1, 2, 2]);
    assert.deepEqual(cases.map((i) => etat.tableDe[i]), [avant[1], avant[0]]);
  });

  test('deux places fantômes de deux tables : mouvement rejeté, rien ne change ; une personne et une place fantôme : elle change de table', () => {
    // Deux personnes, trois tables de 2, un tour : le placement initial les
    // assied aux sièges 0 et 1, ceux de la table 1 ; les sièges 2 à 5, aux
    // tables 2 et 3, sont des places fantômes.
    const instance = normaliser(configurationDe({
      appartenances: [null, null],
      tables: [
        { id: 1, capacite: 2 },
        { id: 2, capacite: 2 },
        { id: 3, capacite: 2 },
      ],
      tours: 1,
    }));
    const etat = creerEtat(instance, creerPcg32(1, FLUX.RECHERCHE));
    assert.deepEqual(Array.from(etat.tableDe), [0, 0]);
    const score = scoreIncremental(etat);
    assert.equal(proposerEtAppliquer(etat, tiragesImposes([0, 2, 4])), null);
    assert.deepEqual(Array.from(etat.tableDe), [0, 0]);
    assert.deepStrictEqual(scoreIncremental(etat), score);
    assert.deepEqual(proposerEtAppliquer(etat, tiragesImposes([0, 0, 4])), { tour: 0, a: 0, b: 4 });
    assert.deepEqual(Array.from(etat.tableDe).sort(), [0, 2]);
  });

  test('defaire(null) ne fait rien', () => {
    const etat = creerEtat(normaliser(demo('petite')), creerPcg32(4, FLUX.RECHERCHE));
    const plan = Int32Array.from(etat.tableDe);
    const score = scoreIncremental(etat);
    defaire(etat, null);
    assert.deepStrictEqual(etat.tableDe, plan);
    assert.deepStrictEqual(scoreIncremental(etat), score);
  });
});

// Les sept grandeurs brutes que descendait la recherche avant l'ordre réglé.
const GRANDEURS_DE_REFERENCE = [
  'ecartAuPlafondAPrioriMax',
  'carresEcartsAuPlafondAPriori',
  'excedentCollisions',
  'collisionsCumulees',
  'excedentPaires',
  'retoursChoisis',
  'redondance',
];

describe('score : composition du n-uplet (en-tête de recherche.js)', () => {
  test('scoreIncremental et scoreComplet égalent le n-uplet énuméré, pour aucune contrainte, chacune seule et toutes', () => {
    // Score tenu à jour et score recalculé passent par la même composition :
    // les comparer entre eux ne dit rien d'elle. L'oracle de ce fichier la
    // refait par un autre chemin. Chaque grandeur brute est non nulle dans au
    // moins un état de chaque jeu : une composante comptée sous une
    // contrainte désactivée, ou omise sous une contrainte active, se voit.
    const jeux = [
      ['aucune', SANS_CONTRAINTE],
      ...NOMS_CONTRAINTES.map((nom) => [nom, { ...SANS_CONTRAINTE, [nom]: true }]),
      ['toutes', TOUTES_CONTRAINTES],
    ];
    const MOUVEMENTS = 40;
    for (const [nom, contraintes] of jeux) {
      const instance = normaliser({ ...salleReservee(), contraintes });
      const aPriori = plafondsAPriori(instance);
      const rng = creerPcg32(5, FLUX.RECHERCHE);
      const etat = creerEtat(instance, rng);
      const nonNulles = Array(GRANDEURS_DE_REFERENCE.length).fill(false);
      const confronter = (etiquette) => {
        const { nUplet, brutes } = scoreOracle(instance, etat.tableDe, aPriori);
        assert.deepStrictEqual(scoreComplet(etat), nUplet, `${nom}, ${etiquette} : scoreComplet`);
        assert.deepStrictEqual(scoreIncremental(etat), nUplet, `${nom}, ${etiquette} : scoreIncremental`);
        GRANDEURS_DE_REFERENCE.forEach((grandeur, k) => { if (brutes[grandeur] > 0) nonNulles[k] = true; });
      };
      confronter('placement initial');
      let appliques = 0;
      for (let essai = 0; appliques < MOUVEMENTS && essai < 100 * MOUVEMENTS; essai += 1) {
        if (proposerEtAppliquer(etat, rng) === null) continue;
        appliques += 1;
        confronter(`${appliques} mouvements`);
      }
      assert.equal(appliques, MOUVEMENTS, nom);
      assert.deepEqual(nonNulles, Array(GRANDEURS_DE_REFERENCE.length).fill(true), `${nom} : grandeurs brutes non nulles`);
    }
  });
});

describe("rechercher : la descente par acceptation tardive, à la lettre (§ 5.10)", () => {
  // Sur la grande démonstration, au moins 24 mobiles restent sous leur
  // plafond a priori (§ 15.1) : l'écart maximal ne s'annule jamais, l'ordre
  // d'acceptation ne bascule pas, et la relance, qui suit la bascule, ne joue
  // pas non plus. rechercher y rend les plans de la réplique littérale.
  test('grande démonstration, arret 5 000 : les plans de la réplique', () => {
    const reglages = { graine: 17, arret: 5_000, nombre: 2 };
    assert.deepStrictEqual(
      rechercher(demo('grande'), reglages).map(({ plan }) => plan),
      plansLitteraux(demo('grande'), { ...reglages, historique: HISTORIQUE_PAR_DEFAUT }),
    );
  });

  test('grande démonstration sans contrainte, arret 20 000 : les plans de la réplique', () => {
    const configuration = () => ({ ...demo('grande'), contraintes: { ...SANS_CONTRAINTE } });
    const reglages = { graine: 17, arret: 20_000, nombre: 2 };
    assert.deepStrictEqual(
      rechercher(configuration(), reglages).map(({ plan }) => plan),
      plansLitteraux(configuration(), { ...reglages, historique: HISTORIQUE_PAR_DEFAUT }),
    );
  });

  test("historique d'une case : aucune relance hors de l'ordre des contraintes", () => {
    // À historique 1, le score courant reste inchangé sur des plateaux que
    // la descente parcourt sans être figée. Une relance dans l'ordre du
    // score couperait ces parcours ; la réplique n'en fait aucune.
    const reglages = { graine: 17, arret: 5_000, nombre: 2, historique: 1 };
    assert.deepStrictEqual(
      rechercher(demo('grande'), reglages).map(({ plan }) => plan),
      plansLitteraux(demo('grande'), reglages),
    );
  });
});

describe('rechercher : bascule et relance, à la lettre (en-tête de recherche.js)', () => {
  test('petite démonstration en conflit, historique 100, arret 20 000 : les plans de la réplique', () => {
    // Chaque descente y atteint un écart maximal nul et bascule ; à
    // historique 100, la patience vaut 1 000 itérations, et des relances
    // suivent la bascule puis trouvent de meilleures affectations. Les
    // comptes de la réplique l'exigent : sans eux, l'épreuve passerait aussi
    // sur des descentes qui ne basculent ni ne relancent.
    const reglages = { graine: 0, arret: 20_000, nombre: 3, historique: 100 };
    const repliques = descentesALaLettre(demo('petite-conflit'), reglages, { bascule: true });
    assert.deepStrictEqual(
      rechercher(demo('petite-conflit'), reglages).map(({ plan }) => plan),
      repliques.map(({ plan }) => plan),
    );
    assert.deepEqual(
      repliques.map(({ bascules, relances, apresRelance }) => [
        bascules,
        relances > 0,
        apresRelance > 0,
      ]),
      [
        [1, true, true],
        [1, true, true],
        [1, true, true],
      ],
    );
  });
});

// --- Les objectifs, les animateurs et l'ordre réglé ---------------------------

const QUATRE_CASES = { ...TOUTES_CONTRAINTES };
// Une entrée de palier.
const e = (critere, poids = 1) => ({ critere, poids });
// L'ordre par défaut, chaque critère seul à son palier.
const parDefaut = () => CRITERES.map((nom) => [e(nom)]);

// Les ordres déplacés de l'épreuve : sous places, le palier { excédent × 1,
// tours hors objectif × 3 } en deuxième ; sous les deux autres modes, les
// tours hors objectif seuls en deuxième.
const ORDRE_DEPLACE = {
  places: [
    [e('ecartAuPlafondAPrioriMax')],
    [e('excedentCollisions'), e('toursHorsObjectif', 3)],
    [e('collisionsCumulees')],
    [e('rencontresRepetees')],
    [e('animateursNonRencontres', 2)],
    [e('redondance')],
  ],
  deuxValeurs: [
    [e('ecartAuPlafondAPrioriMax')],
    [e('toursHorsObjectif')],
    [e('excedentCollisions')],
    [e('collisionsCumulees')],
    [e('rencontresRepetees')],
    [e('animateursNonRencontres'), e('redondance', 4)],
  ],
};
const ordreDeplace = (mode) => (mode === 'places' ? ORDRE_DEPLACE.places : ORDRE_DEPLACE.deuxValeurs);

// Une soirée inventée de quatorze personnes, quatre tables de 4, quatre
// tours, les six cases cochées. Objectifs : la table 1 « finance » pour la
// soirée ; la table 2 « finance ET Montréal » pour la soirée, remplacé au
// tour 2 par « Montréal » ; la table 3 « bénévole » au tour 3. 1 à 3 portent
// « finance », 4 et 5 « finance » et « Montréal », 6 et 7 « Montréal », 8 et
// 9 « bénévole ». Réservations : 6, « Montréal », à la table 1 au tour 1 ; 1,
// « finance », à la table 4, sans objectif, au tour 4 — leurs tours possibles
// sont inégaux ; 2, « finance », à la table 1 au tour 3, et 4, « finance » et
// « Montréal », à la table 2 au tour 1 : deux places réservées qui servent
// (D5), l'une sous « ou », l'autre sous « et ». Animateurs : 10, à la table 1
// à chaque tour ; 11 et 12, deux titres de la table 3 au seul tour 2 ; 13,
// réservé sans animer.
function soireeAObjectifs({ mode = 'places', priorites } = {}) {
  const etiquettes = [
    ['finance'], ['finance'], ['finance'], ['Montréal', 'finance'], ['Montréal', 'finance'],
    ['Montréal'], ['Montréal'], ['bénévole'], ['bénévole'],
  ];
  const anime = new Map([[10, [1, 2, 3, 4]], [11, [2]], [12, [2]]]);
  return {
    participants: Array.from({ length: 14 }, (_, rang) => ({
      id: rang + 1,
      nom: `P${rang + 1}`,
      appartenance: ['A', 'B', 'C', null][rang % 4],
      exclu: false,
      ...(rang < etiquettes.length ? { etiquettes: etiquettes[rang] } : {}),
      ...(anime.has(rang + 1) ? { anime: anime.get(rang + 1) } : {}),
    })),
    tables: [1, 2, 3, 4].map((id) => ({ id, numero: id, capacite: 4 })),
    tours: 4,
    reservations: [tous(10, 1), auTour(11, 3, 2), auTour(12, 3, 2), auTour(6, 1, 1), auTour(1, 4, 4), auTour(13, 2, 3), auTour(2, 1, 3), auTour(4, 2, 1)],
    contraintes: { ...QUATRE_CASES, respecterObjectifs: true, rencontrerAnimateurs: true },
    objectifs: [
      { table: 1, tour: null, regle: 'ou', etiquettes: ['finance'] },
      { table: 2, tour: null, regle: 'et', etiquettes: ['Montréal', 'finance'] },
      { table: 2, tour: 2, regle: 'ou', etiquettes: ['Montréal'] },
      { table: 3, tour: 3, regle: 'ou', etiquettes: ['bénévole'] },
    ],
    ...(mode === 'places' ? {} : { modeObjectifs: mode }),
    ...(priorites === undefined ? {} : { priorites }),
  };
}

// Chaque jeu de l'épreuve d'accord : chaque mode, sous l'ordre par défaut
// puis sous l'ordre déplacé.
const JEUX_A_OBJECTIFS = ['places', 'chacun', 'minimum'].flatMap((mode) => [
  { nom: `${mode}, ordre par défaut`, configuration: soireeAObjectifs({ mode }) },
  { nom: `${mode}, ordre déplacé`, configuration: soireeAObjectifs({ mode, priorites: ordreDeplace(mode) }) },
]);

describe('score : objectifs et animateurs, sous chaque mode et sous un ordre déplacé (§ 5.10, A13, A21)', () => {
  test('la soirée inventée : objectifs et animateurs ont un objet, les tours possibles sont inégaux', () => {
    const instance = normaliser(soireeAObjectifs());
    const actifs = instance.etatCriteres.filter(({ coche, sansObjet }) => coche && !sansObjet).map(({ nom }) => nom);
    assert.deepEqual(actifs, CRITERES);
    assert.ok(new Set(instance.possibles).size > 2, `tours possibles : ${[...instance.possibles]}`);
    assert.ok(instance.borneAnimateurs.some((B) => B > 0));
    // Deux places réservées servent : 2 à la table 1 au tour 3, 4 à la
    // table 2 au tour 1. Un état qui ne compterait s(p) que sur les places
    // libres s'écarterait de la mesure dès le placement initial.
    for (const [id, table, tour] of [[2, 1, 3], [4, 2, 1]]) {
      const p = instance.indexDe.get(id);
      const t = instance.indexTableDe.get(table);
      const r = tour - 1;
      assert.equal(instance.fixe[p * instance.R + r], t, `${id} réservé`);
      const o = instance.objectifDe[t * instance.R + r];
      assert.notEqual(o, -1, `${id} : objectif en vigueur`);
      assert.equal(instance.correspond[p * instance.O + o], 1, `${id} servi`);
    }
  });

  test('scoreIncremental et scoreComplet égalent le n-uplet énuméré au départ, à 1, 10, 100 et 1 000 mouvements, et reviennent au départ une fois défaits', () => {
    const PALIERS = [1, 10, 100, 1_000];
    for (const { nom, configuration } of JEUX_A_OBJECTIFS) {
      const instance = normaliser(configuration);
      const aPriori = plafondsAPriori(instance);
      const rng = creerPcg32(31, FLUX.RECHERCHE);
      const etat = creerEtat(instance, rng);
      const depart = scoreIncremental(etat);
      const nonNulles = new Set();
      const confronter = (etiquette) => {
        const { nUplet, brutes } = scoreOracle(instance, etat.tableDe, aPriori, configuration);
        assert.deepStrictEqual(scoreComplet(etat), nUplet, `${nom}, ${etiquette} : scoreComplet`);
        assert.deepStrictEqual(scoreIncremental(etat), nUplet, `${nom}, ${etiquette} : scoreIncremental`);
        for (const grandeur of ['toursHorsObjectif', 'jamaisServies', 'horsObjectifMax', 'personnesAuMax', 'animateursNonRencontres']) {
          if (brutes[grandeur] > 0) nonNulles.add(grandeur);
        }
      };
      confronter('placement initial');
      const appliques = [];
      for (let essai = 0; appliques.length < PALIERS.at(-1) && essai < 100 * PALIERS.at(-1); essai += 1) {
        const mouvement = proposerEtAppliquer(etat, rng);
        if (mouvement === null) continue;
        appliques.push(mouvement);
        if (PALIERS.includes(appliques.length)) confronter(`${appliques.length} mouvements`);
      }
      assert.equal(appliques.length, PALIERS.at(-1), nom);
      assert.equal(nonNulles.size, 5, `${nom} : grandeurs des objectifs et des animateurs non nulles ${[...nonNulles]}`);
      for (const mouvement of appliques.reverse()) defaire(etat, mouvement);
      assert.deepStrictEqual(scoreIncremental(etat), depart, nom);
    }
  });

  test('chaque composante a la place que la compilation lui donne : un mode à deux et trois valeurs, un palier pondéré, une somme de poids', () => {
    const tailles = JEUX_A_OBJECTIFS.map(({ configuration }) => scoreIncremental(creerEtat(normaliser(configuration), creerPcg32(1, FLUX.RECHERCHE))).length);
    assert.deepEqual(tailles, [8, 7, 9, 8, 10, 9]);
  });

  test("l'état tient les grandeurs des objectifs et des animateurs sous les noms de la mesure : tours servis, tours hors objectif, jamais servies, le plus d'une personne et leur nombre, animateurs rencontrés", () => {
    for (const mode of ['places', 'minimum']) {
      const instance = normaliser(soireeAObjectifs({ mode }));
      const rng = creerPcg32(8, FLUX.RECHERCHE);
      const etat = creerEtat(instance, rng);
      for (let essai = 0; essai < 300; essai += 1) proposerEtAppliquer(etat, rng);
      const { objectifs, animateurs } = mesurer(instance, etat.tableDe);
      assert.deepEqual(Array.from(etat.servis), objectifs.tours, mode);
      assert.deepEqual(
        [etat.horsObjectif, etat.jamaisServies, etat.horsObjectifMax, etat.personnesAuMax],
        [objectifs.horsObjectif, objectifs.jamaisServies, objectifs.horsObjectifMax, objectifs.personnesAuMax],
        mode,
      );
      assert.deepEqual(Array.from(etat.rencontresAnimateurs), animateurs.rencontres, mode);
      assert.equal(etat.animateursNonRencontres, animateurs.nonRencontres, mode);
    }
  });

  test("une rencontre d'animateur ne compte qu'au tour où il anime : partager la table de 11 aux tours 1, 3 et 4 n'en est pas une", () => {
    const configuration = soireeAObjectifs();
    const instance = normaliser(configuration);
    const etat = creerEtat(instance, creerPcg32(3, FLUX.RECHERCHE));
    const onze = instance.indexDe.get(11);
    const { R, N, A } = instance;
    const avecOnze = (p, r) => etat.tableDe[p * R + r] === etat.tableDe[onze * R + r];
    // Les personnes assises avec 11 aux tours 1, 3 ou 4, où il n'anime pas,
    // et jamais au tour 2, où il anime : aucune ne l'a rencontré comme
    // animateur.
    const voisins = [];
    for (let p = 0; p < N; p += 1) {
      if (p !== onze && [0, 2, 3].some((r) => avecOnze(p, r)) && !avecOnze(p, 1)) voisins.push(p);
    }
    assert.ok(voisins.length > 0);
    const rangOnze = instance.rangAnimateur[onze];
    for (const p of voisins) assert.equal(etat.rencontresAnimees[p * A + rangOnze], 0, `personne d'index ${p}`);
    const directs = animateursRencontres(configuration, instance, etat.tableDe);
    assert.deepEqual(Array.from(etat.rencontresAnimateurs), directs);
  });

  test("case des animateurs décochée : l'état ne tient pas leurs rencontres, le score reste celui de la mesure, et la recherche rend les plans d'une soirée sans animateur", () => {
    const cochee = soireeAObjectifs();
    const decochee = { ...cochee, contraintes: { ...cochee.contraintes, rencontrerAnimateurs: false } };
    const sansAnimateur = { ...decochee, participants: decochee.participants.map(({ anime, ...reste }) => reste) };
    assert.ok(normaliser(decochee).borneAnimateurs.some((B) => B > 0));
    assert.equal(creerEtat(normaliser(cochee), creerPcg32(5, FLUX.RECHERCHE)).suitAnimateurs, true);
    const rng = creerPcg32(5, FLUX.RECHERCHE);
    const etat = creerEtat(normaliser(decochee), rng);
    assert.deepEqual(
      [etat.suitAnimateurs, etat.rencontresAnimees, etat.rencontresAnimateurs, etat.animateursNonRencontres],
      [false, null, null, null],
    );
    for (let essai = 0; essai < 300; essai += 1) proposerEtAppliquer(etat, rng);
    assert.deepStrictEqual(scoreIncremental(etat), scoreComplet(etat));
    const reglages = { graine: 9, arret: 3_000, nombre: 2 };
    assert.deepEqual(rechercher(decochee, reglages), rechercher(sansAnimateur, reglages));
  });
});

describe("état de recherche : valeurs de départ, bornes de la composition, comptes au-delà d'un octet et de seize bits (§ 5.10)", () => {
  test('une personne seule ne peut rencontrer personne : écart et score nuls dès le placement, aucun mouvement évalué', () => {
    const configuration = configurationDe({ appartenances: [null], tables: [{ id: 1, capacite: 2 }], tours: 2 });
    const instance = normaliser(configuration);
    assert.deepEqual(plafondsAPriori(instance), [0]);
    const etat = creerEtat(instance, creerPcg32(1, FLUX.RECHERCHE));
    assert.deepStrictEqual(scoreIncremental(etat), [0, 0]);
    assert.deepStrictEqual(scoreIncremental(etat), scoreComplet(etat));
    assert.equal(rechercher(configuration, { graine: 1, arret: 50, nombre: 1 })[0].evalues, 0);
  });

  test('sans personne concernée, ou chacun servi à chacun de ses tours possibles : les quatre valeurs des objectifs sont nulles au placement initial', () => {
    const valeurs = (etat) => [etat.horsObjectif, etat.jamaisServies, etat.horsObjectifMax, etat.personnesAuMax];
    const sans = creerEtat(normaliser(troisTablesDeDeux()), creerPcg32(1, FLUX.RECHERCHE));
    assert.deepEqual(valeurs(sans), [0, 0, 0, 0]);
    // Deux personnes « finance » à la seule table, « finance » : chacune y
    // est servie à son seul tour possible.
    const servies = {
      participants: [1, 2].map((id) => ({ id, nom: `F${id}`, appartenance: null, exclu: false, etiquettes: ['finance'] })),
      tables: [{ id: 1, numero: 1, capacite: 2 }],
      tours: 1,
      reservations: [],
      contraintes: { ...SANS_CONTRAINTE, respecterObjectifs: true },
      objectifs: [{ table: 1, tour: null, regle: 'ou', etiquettes: ['finance'] }],
    };
    const instance = normaliser(servies);
    assert.deepEqual(Array.from(instance.possibles), [1, 1]);
    const etat = creerEtat(instance, creerPcg32(1, FLUX.RECHERCHE));
    assert.deepEqual(Array.from(etat.servis), [1, 1]);
    assert.deepEqual(valeurs(etat), [0, 0, 0, 0]);
  });

  test('la composition délimite les termes de chaque composante : taille + 1 bornes, de 0 au nombre de termes, croissantes', () => {
    for (const { nom, configuration } of JEUX_A_OBJECTIFS) {
      const { composition } = creerEtat(normaliser(configuration), creerPcg32(1, FLUX.RECHERCHE));
      const { taille, debut, codes, poids } = composition;
      assert.equal(debut.length, taille + 1, nom);
      assert.equal(debut[0], 0, nom);
      assert.equal(debut[taille], codes.length, nom);
      assert.equal(poids.length, codes.length, nom);
      for (let k = 0; k < taille; k += 1) assert.ok(debut[k + 1] > debut[k], `${nom}, composante ${k}`);
    }
  });

  test("deux animateurs ancrés côte à côte, animant chacun des 257 tours, se rencontrent une fois : le compte d'un couple dépasse un octet", () => {
    const R = 257;
    const anime = Array.from({ length: R }, (_, r) => r + 1);
    const base = configurationDe({
      appartenances: [null, null],
      tables: [{ id: 1, capacite: 2 }],
      tours: R,
      reservations: [tous(1, 1), tous(2, 1)],
      contraintes: { ...SANS_CONTRAINTE, rencontrerAnimateurs: true },
    });
    const configuration = { ...base, participants: base.participants.map((participant) => ({ ...participant, anime })) };
    const etat = creerEtat(normaliser(configuration), creerPcg32(1, FLUX.RECHERCHE));
    assert.equal(etat.suitAnimateurs, true);
    assert.deepEqual(Array.from(etat.rencontresAnimateurs), [1, 1]);
    assert.equal(etat.animateursNonRencontres, 0);
    assert.deepStrictEqual(scoreIncremental(etat), scoreComplet(etat));
  });

  test("deux personnes ancrées à la même table pendant 65 537 tours ont une seule rencontre chacune : le compte d'une paire dépasse seize bits", () => {
    const configuration = configurationDe({
      appartenances: [null, null],
      tables: [{ id: 1, capacite: 2 }],
      tours: 65_537,
      reservations: [tous(1, 1), tous(2, 1)],
    });
    const etat = creerEtat(normaliser(configuration), creerPcg32(1, FLUX.RECHERCHE));
    assert.deepEqual(Array.from(etat.rencontres), [1, 1]);
    assert.deepStrictEqual(scoreIncremental(etat), [0, 0]);
  });
});

describe("recherche : le mode et l'ordre réglé ne touchent pas au hasard (A13, § 15.5)", () => {
  test('même graine : mêmes mouvements tirés, le générateur au même point, quels que soient objectifs, mode et ordre', () => {
    const sans = { ...soireeAObjectifs(), objectifs: [], contraintes: { ...QUATRE_CASES } };
    const suites = [sans, soireeAObjectifs({ mode: 'minimum' }), soireeAObjectifs({ mode: 'places', priorites: ordreDeplace('places') })].map((configuration) => {
      const rng = creerPcg32(77, FLUX.RECHERCHE);
      const etat = creerEtat(normaliser(configuration), rng);
      const mouvements = Array.from({ length: 500 }, () => proposerEtAppliquer(etat, rng));
      return { mouvements, suivant: rng.suivant() };
    });
    assert.deepEqual(suites[1], suites[0]);
    assert.deepEqual(suites[2], suites[0]);
  });
});

describe("rechercher : la bascule suit l'ordre réglé (A11, A21)", () => {
  test("l'écart en troisième palier, petite démonstration en conflit, historique 100 : les plans de la réplique, qui bascule au rang de l'écart", () => {
    // L'excédent en tête s'annule avant l'écart : deux descentes sur trois
    // annulent ensuite l'écart et basculent, la troisième non. Une bascule
    // lue sur la première composante ferait basculer les trois.
    const priorites = [
      [e('excedentCollisions')],
      [e('collisionsCumulees')],
      [e('ecartAuPlafondAPrioriMax')],
      ...parDefaut().slice(3),
    ];
    const configuration = () => ({ ...demo('petite-conflit'), priorites });
    const instance = normaliser(configuration());
    assert.equal(ordresDe(instance).rangEcart, 2);
    const reglages = { graine: 4, arret: 20_000, nombre: 3, historique: 100 };
    const repliques = descentesALaLettre(configuration(), reglages, { bascule: true });
    assert.deepStrictEqual(
      rechercher(configuration(), reglages).map(({ plan }) => plan),
      repliques.map(({ plan }) => plan),
    );
    assert.deepEqual(repliques.map(({ bascules }) => bascules), [1, 0, 1]);
  });

  test('la soirée à objectifs sous chaque mode et sous son ordre déplacé : les plans de la réplique', () => {
    for (const { nom, configuration } of JEUX_A_OBJECTIFS) {
      const reglages = { graine: 9, arret: 3_000, nombre: 2, historique: 50 };
      assert.deepStrictEqual(
        rechercher(configuration, reglages).map(({ plan }) => plan),
        descentesALaLettre(configuration, reglages, { bascule: true }).map(({ plan }) => plan),
        nom,
      );
    }
  });
});

describe("rechercher : l'arrêt sur le n-uplet nul lit chaque composante (§ 5.10)", () => {
  test("les collisions cumulées en tête, toute autre composante nulle : la descente ne s'arrête qu'au n-uplet nul", () => {
    // A, A, B, B sur deux tables de 2, un tour : chacun rencontre son seul
    // voisin, l'écart et l'excédent sont nuls dans tout placement, et seules
    // les collisions de la composante de tête varient. Un placement qui
    // réunit les deux A et les deux B n'est pas nul : la descente le quitte.
    const base = configurationDe({
      appartenances: ['A', 'A', 'B', 'B'],
      tables: [
        { id: 1, capacite: 2 },
        { id: 2, capacite: 2 },
      ],
      tours: 1,
      contraintes: { ...SANS_CONTRAINTE, separerAppartenances: true },
    });
    const configuration = {
      ...base,
      priorites: [[e('collisionsCumulees')], ...CRITERES.filter((nom) => nom !== 'collisionsCumulees').map((nom) => [e(nom)])],
    };
    const instance = normaliser(configuration);
    const propositions = rechercher(configuration, { graine: 2, arret: 200, nombre: 6 });
    assert.ok(propositions.some(({ evalues }) => evalues > 0), 'aucun placement initial à collisions');
    for (const { id, plan, evalues } of propositions) {
      assert.equal(mesurer(instance, indexerPlan(instance, plan)).collisionsCumulees, 0, `proposition ${id}`);
      assert.ok(evalues < 200, `proposition ${id} : ${evalues} mouvements évalués`);
    }
  });
});

// Dix personnes « finance », dont 10 d'appartenance A ; 11, sans étiquette,
// d'appartenance A, réservé à la table « finance » de huit places pour la
// soirée ; 12, sans étiquette ni appartenance. Une table sans objectif de
// quatre, quatre tours, la seule case « séparer les appartenances » cochée
// hors des objectifs ; les tours hors objectif au premier palier, les
// collisions cumulées au deuxième, l'écart au troisième. Chaque tour où 10
// est servi coûte une collision avec 11 sans changer les tours hors
// objectif : sous places, la descente le laisse jamais servi, au plus loin
// de l'objectif ; les deux autres modes doivent payer la collision.
function soireeFinance(mode) {
  const premiers = ['toursHorsObjectif', 'collisionsCumulees', 'ecartAuPlafondAPrioriMax'];
  return {
    participants: [
      ...Array.from({ length: 10 }, (_, rang) => ({ id: rang + 1, nom: `F${rang + 1}`, appartenance: rang === 9 ? 'A' : null, exclu: false, etiquettes: ['finance'] })),
      { id: 11, nom: 'G11', appartenance: 'A', exclu: false },
      { id: 12, nom: 'G12', appartenance: null, exclu: false },
    ],
    tables: [{ id: 1, numero: 1, capacite: 8 }, { id: 2, numero: 2, capacite: 4 }],
    tours: 4,
    reservations: [tous(11, 1)],
    contraintes: { ...SANS_CONTRAINTE, separerAppartenances: true },
    objectifs: [{ table: 1, tour: null, regle: 'ou', etiquettes: ['finance'] }],
    priorites: [...premiers.map((nom) => [e(nom)]), ...CRITERES.filter((nom) => !premiers.includes(nom)).map((nom) => [e(nom)])],
    ...(mode === 'places' ? {} : { modeObjectifs: mode }),
  };
}

describe('rechercher : chaque mode descend jusqu’aux planchers du diagnostic (A21)', () => {
  // Les valeurs que chaque mode compare, dans l'ordre, lues dans la mesure et
  // dans les planchers du diagnostic ; puis, pour les deux modes qui
  // comparent une valeur de plus, celle que la descente sous places laisse
  // au-dessus de son plancher.
  const COMPAREES = {
    places: ['horsObjectif'],
    chacun: ['jamaisServies', 'horsObjectif'],
    minimum: ['horsObjectifMax', 'horsObjectif'],
  };
  const CONTRASTE = { chacun: 'jamaisServies', minimum: 'horsObjectifMax' };
  // Par tour, P_r = 10 et L_r = 8 − 1, l'ancré de la table : 3, et 12 en tout.
  const PLANCHERS = { horsObjectif: 12, jamaisServies: 0, horsObjectifMax: 2, parTour: [3, 3, 3, 3] };
  const objectifsDu = (configuration, graine) => {
    const instance = normaliser(configuration);
    const [{ plan }] = rechercher(configuration, { graine, arret: 20_000, nombre: 1 });
    return mesurer(instance, indexerPlan(instance, plan)).objectifs;
  };

  test('places : les tours hors objectif dépendent du plan — un placement tiré assied 12 à la table « finance » —, et la descente les ramène à leur plancher', () => {
    const configuration = soireeFinance('places');
    assert.deepEqual(diagnostiquer(configuration).objectifsInevitables, PLANCHERS);
    const instance = normaliser(configuration);
    const departs = [1, 2, 3].map((graine) => creerEtat(instance, creerPcg32(graine, FLUX.RECHERCHE)).horsObjectif);
    assert.ok(departs.some((H) => H > PLANCHERS.horsObjectif), `départs : ${departs}`);
    for (const graine of [1, 2, 3]) {
      const objectifs = objectifsDu(configuration, graine);
      for (const valeur of COMPAREES.places) assert.equal(objectifs[valeur], PLANCHERS[valeur], `places, graine ${graine}, ${valeur}`);
      // 10 n'est jamais servi : les deux autres modes ont à le corriger.
      assert.equal(objectifs.tours[9], 0, `places, graine ${graine}`);
    }
  });

  for (const mode of ['chacun', 'minimum']) {
    test(`${mode} : à trois graines, chaque valeur que le mode compare atteint son plancher, que la même graine sous places laisse au-dessus`, () => {
      const configuration = soireeFinance(mode);
      assert.deepEqual(diagnostiquer(configuration).objectifsInevitables, PLANCHERS);
      for (const graine of [1, 2, 3]) {
        const objectifs = objectifsDu(configuration, graine);
        for (const valeur of COMPAREES[mode]) assert.equal(objectifs[valeur], PLANCHERS[valeur], `${mode}, graine ${graine}, ${valeur}`);
        const sousPlaces = objectifsDu(soireeFinance('places'), graine);
        assert.ok(sousPlaces[CONTRASTE[mode]] > PLANCHERS[CONTRASTE[mode]], `places, graine ${graine}, ${CONTRASTE[mode]}`);
      }
    });
  }

  test("sous minimum et chacun, la descente s'arrête sur le n-uplet nul : le nombre de personnes au plus grand retombe à 0 avec lui", () => {
    // Six « finance », une table sans objectif de deux rangée d'abord, une
    // table « finance » de six : le placement initial en assied deux à la
    // première ; le plan nul les assied toutes à la seconde. Les tours hors
    // objectif au premier palier : seule la personne qui rejoint la seconde
    // table un à un améliore le score, l'écart au plafond, lui, se dégrade le
    // temps d'un mouvement.
    for (const mode of ['minimum', 'chacun']) {
      const configuration = {
        priorites: [[e('toursHorsObjectif')], [e('ecartAuPlafondAPrioriMax')], ...parDefaut().slice(1).filter(([{ critere }]) => critere !== 'toursHorsObjectif')],
        participants: Array.from({ length: 6 }, (_, rang) => ({ id: rang + 1, nom: `F${rang + 1}`, appartenance: null, exclu: false, etiquettes: ['finance'] })),
        tables: [{ id: 1, numero: 1, capacite: 2 }, { id: 2, numero: 2, capacite: 6 }],
        tours: 1,
        reservations: [],
        contraintes: { ...SANS_CONTRAINTE },
        objectifs: [{ table: 2, tour: null, regle: 'ou', etiquettes: ['finance'] }],
        modeObjectifs: mode,
      };
      const instance = normaliser(configuration);
      assert.notDeepEqual(scoreIncremental(creerEtat(instance, creerPcg32(1, FLUX.RECHERCHE))).filter((v) => v !== 0), []);
      const avancements = [];
      const [{ plan }] = rechercher(configuration, { graine: 1, arret: 100_000, nombre: 1 }, { progression: (fait) => avancements.push(fait) });
      assert.deepEqual(avancements, [], mode);
      assert.deepEqual(plan.tours[0][1].length, 6, mode);
    }
  });

  test('un mode qui compare deux valeurs garde son palier : les tours hors objectif joints à un autre critère refusent PRIORITES', () => {
    const priorites = [[e('ecartAuPlafondAPrioriMax')], [e('excedentCollisions'), e('toursHorsObjectif')], ...parDefaut().slice(2).filter(([{ critere }]) => critere !== 'toursHorsObjectif')];
    for (const mode of ['chacun', 'minimum']) {
      assert.throws(
        () => rechercher(soireeAObjectifs({ mode, priorites }), { graine: 1, arret: 10, nombre: 1 }),
        (erreur) => erreur instanceof ErreurConfiguration && erreur.code === 'PRIORITES' && erreur.details.faute === 'seulASonPalier',
      );
    }
    assert.equal(rechercher(soireeAObjectifs({ priorites }), { graine: 1, arret: 10, nombre: 1 }).length, 1);
  });
});

describe('rechercher : le mode ne touche pas au défaut, sans objectif (A21, contrainte 33)', () => {
  exigerVerification(process.env);
  const REFERENCE = lireEmpreintes();
  for (const mode of ['chacun', 'minimum']) {
    test(`${mode} : les plans de la petite et de sa variante, des seize combinaisons et de la bascule sont ceux des empreintes de référence`, () => {
      for (const cle of ['petite', 'petite-conflit']) {
        assert.deepEqual(differences(`${cle}, ${mode}`, empreintesDesPlans(cle, undefined, mode), REFERENCE.plans[cle]), []);
      }
      assert.deepEqual(differences(`petite, ${mode}`, empreintesDesCombinaisons(mode), REFERENCE.combinaisons), []);
      for (const cle of BASCULE.cles) {
        assert.deepEqual(differences(`${cle} (bascule), ${mode}`, empreintesDesPlans(cle, BASCULE.arret, mode), REFERENCE.bascule[cle]), []);
      }
    });
  }
});

// --- La course de la recherche (§ 5.10, B6, D40) ------------------------------

// Les puissances de dix strictement sous n, croissantes : les abscisses des
// points de relevé copiés d'une descente de n mouvements évalués. Le compte
// se fait en entiers, sans logarithme flottant.
function puissancesSous(n) {
  const liste = [];
  for (let k = 1; k < n; k *= 10) liste.push(k);
  return liste;
}

// ⌊log₁₀ n⌋ + 1 pour un entier n ≥ 1 : le nombre de ses chiffres décimaux.
const chiffres = (n) => String(n).length;

// Confronte la course d'une proposition à regenerer : ses abscisses sont les
// puissances de dix strictement sous evalues ; chaque point de relevé k est
// le plan que la même graine rend au compte d'arrêt k ; le dernier point,
// evalues, est le plan de la proposition. Rend le nombre de points copiés.
function confronterCourse(configuration, proposition, nom) {
  const { graine, historique, evalues, releves, plan } = proposition;
  assert.ok(Number.isSafeInteger(evalues) && evalues >= 0, `${nom} : evalues ${evalues}`);
  assert.deepEqual(releves.map(({ mouvements }) => mouvements), puissancesSous(evalues), nom);
  for (const releve of releves) {
    assert.deepEqual(Object.keys(releve), ['mouvements', 'plan'], nom);
    assert.deepStrictEqual(
      releve.plan,
      regenerer(configuration, { graine, arret: releve.mouvements, historique }),
      `${nom}, point ${releve.mouvements}`,
    );
  }
  if (evalues > 0) {
    assert.deepStrictEqual(plan, regenerer(configuration, { graine, arret: evalues, historique }), `${nom}, dernier point`);
  }
  return releves.length;
}

// Six personnes « finance », une table sans objectif de deux rangée
// d'abord, une table « finance » de six, un tour, sous minimum : le plan
// initial assied deux personnes à la première table, et la descente
// s'arrête sur le n-uplet nul, toutes à la seconde, avant son compte.
const soireeQuiSAnnule = () => ({
  priorites: [[e('toursHorsObjectif')], [e('ecartAuPlafondAPrioriMax')], ...parDefaut().slice(1).filter(([{ critere }]) => critere !== 'toursHorsObjectif')],
  participants: Array.from({ length: 6 }, (_, rang) => ({ id: rang + 1, nom: `F${rang + 1}`, appartenance: null, exclu: false, etiquettes: ['finance'] })),
  tables: [{ id: 1, numero: 1, capacite: 2 }, { id: 2, numero: 2, capacite: 6 }],
  tours: 1,
  reservations: [],
  contraintes: { ...SANS_CONTRAINTE },
  objectifs: [{ table: 2, tour: null, regle: 'ou', etiquettes: ['finance'] }],
  modeObjectifs: 'minimum',
});

describe('rechercher : la course de la recherche (§ 5.10, B6, D40)', () => {
  test("chaque proposition porte ses mouvements évalués et ses points de relevé, après son plan ; proposerUne rend les mêmes", () => {
    const reglages = { graine: 5, arret: 2_500, nombre: 3, historique: 37 };
    const propositions = rechercher(demo('petite-conflit'), reglages);
    for (const proposition of propositions) {
      assert.deepEqual(Object.keys(proposition), ['id', 'graine', 'arret', 'historique', 'plan', 'evalues', 'releves']);
      assert.deepStrictEqual(proposerUne(demo('petite-conflit'), reglages, proposition.id), proposition);
    }
  });

  test("arrêt au compte : le point de relevé k égale regenerer au compte k (1, 10, 100, 1 000), et le plan rendu celui du compte entier — salle réservée, variante conflit avec bascule et relance, historique 37", () => {
    // Dans la variante conflit, chaque descente bascule puis relance avant
    // 5 000 mouvements (épreuve de regenerer plus haut) : un point copié
    // pendant l'ordre des contraintes, ou juste après une relance, doit
    // encore égaler la régénération à son compte.
    const reglages = { graine: 5, arret: 5_000, nombre: 3, historique: 37 };
    let points = 0;
    for (const [nom, construire] of [
      ['salleReservee', salleReservee],
      ['petite-conflit', () => demo('petite-conflit')],
    ]) {
      const configuration = construire();
      for (const proposition of rechercher(configuration, reglages)) {
        assert.equal(proposition.evalues, reglages.arret, `${nom}, proposition ${proposition.id}`);
        points += confronterCourse(configuration, proposition, `${nom}, proposition ${proposition.id}`);
      }
    }
    assert.equal(points, 6 * 4);
  });

  test("arrêt sur le n-uplet nul : moins de mouvements évalués que le compte, des points sous ce nombre seulement, chacun égal à regenerer", () => {
    const configuration = soireeQuiSAnnule();
    const propositions = rechercher(configuration, { graine: 1, arret: 100_000, nombre: 4 });
    for (const proposition of propositions) {
      assert.ok(proposition.evalues > 0 && proposition.evalues < 100_000, `evalues ${proposition.evalues}`);
      confronterCourse(configuration, proposition, `proposition ${proposition.id}`);
    }
    // Au moins une descente dure plus d'un mouvement : la liste de ses points
    // n'est pas vide, et la confrontation porte sur autre chose que le plan.
    assert.ok(propositions.some(({ releves }) => releves.length > 0));
    // Une descente qui s'annule pile à une puissance de dix : ce dernier point
    // est le plan rendu, non copié ; seules les puissances strictement sous
    // lui sont des points de relevé.
    for (const [graine, evalues, attendus] of [[39, 10, [1]], [144, 100, [1, 10]]]) {
      const [proposition] = rechercher(configuration, { graine, arret: 100_000, nombre: 1 });
      assert.equal(proposition.evalues, evalues, `graine ${graine}`);
      assert.deepEqual(proposition.releves.map(({ mouvements }) => mouvements), attendus, `graine ${graine}`);
      confronterCourse(configuration, proposition, `graine ${graine}`);
    }
  });

  test("plan initial au n-uplet nul : aucun mouvement évalué, aucun point de relevé", () => {
    for (const proposition of rechercher(troisTablesDeDeux(), { graine: 8, arret: 50_000, nombre: 2 })) {
      assert.equal(proposition.evalues, 0);
      assert.deepEqual(proposition.releves, []);
    }
  });

  test("compte 1 : un mouvement, aucun point copié ; compte 1 000 : 1, 10 et 100, le point 1 000 étant le plan ; compte 2 500 : 1, 10, 100 et 1 000", () => {
    const configuration = demo('grande');
    const cas = [
      [1, []],
      [1_000, [1, 10, 100]],
      [2_500, [1, 10, 100, 1_000]],
    ];
    for (const [arret, attendus] of cas) {
      const [proposition] = rechercher(configuration, { graine: 3, arret, nombre: 1 });
      assert.equal(proposition.evalues, arret, `compte ${arret}`);
      assert.deepEqual(proposition.releves.map(({ mouvements }) => mouvements), attendus, `compte ${arret}`);
      confronterCourse(configuration, proposition, `compte ${arret}`);
    }
  });

  test("au plus ⌊log₁₀ arret⌋ + 1 copies, autour de chaque puissance de dix", () => {
    const configuration = demo('petite-conflit');
    const comptes = [1, 2, 9, 10, 11, 99, 100, 101, 999, 1_000, 1_001];
    for (const arret of comptes) {
      for (const proposition of rechercher(configuration, { graine: 13, arret, nombre: 2, historique: 50 })) {
        assert.ok(proposition.releves.length <= chiffres(arret), `compte ${arret} : ${proposition.releves.length} copies`);
        assert.deepEqual(proposition.releves.map(({ mouvements }) => mouvements), puissancesSous(proposition.evalues), `compte ${arret}`);
      }
    }
    assert.equal(chiffres(999), 3);
    assert.equal(chiffres(1_000), 4);
  });

  test("regenerer rend le seul plan, sans la course : ses clés sont celles du plan d'une proposition", () => {
    const configuration = demo('petite-conflit');
    const [proposition] = rechercher(configuration, { graine: 2, arret: 300, nombre: 1 });
    const plan = regenerer(configuration, proposition);
    assert.deepEqual(Object.keys(plan), Object.keys(proposition.plan));
    assert.deepStrictEqual(plan, proposition.plan);
    assert.equal('evalues' in plan || 'releves' in plan, false);
  });
});

// --- Le chemin ordinaire et le départ (§ 5.7, § 5.10, § 8.9, § 15.5, C24) ----

// Le nombre de sorties de 32 bits que rng a produites depuis sa création,
// rng étant creerPcg32(graine, flux) : ses trois sorties suivantes se
// cherchent dans la suite d'un jumeau neuf. Les tirages internes de borne
// (rejet) et de melanger y comptent, qu'aucune enveloppe ne verrait.
// Consomme trois sorties de rng.
function sortiesProduites(rng, graine, flux) {
  const suivantes = [rng.suivant(), rng.suivant(), rng.suivant()];
  const jumeau = creerPcg32(graine, flux);
  const fenetre = [jumeau.suivant(), jumeau.suivant(), jumeau.suivant()];
  for (let n = 0; n < 1_000_000; n += 1) {
    if (fenetre.every((sortie, i) => sortie === suivantes[i])) return n;
    fenetre.shift();
    fenetre.push(jumeau.suivant());
  }
  throw new Error(`sorties introuvables pour la graine ${graine}`);
}

// Les clés d'une proposition de rechercher, dans leur ordre.
const CLES_PROPOSITION = ['id', 'graine', 'arret', 'historique', 'plan', 'evalues', 'releves'];

describe('rechercher : le chemin ordinaire ne tire pas un nombre de plus (§ 5.10, § 15.5, C8)', () => {
  // Les comptes attendus sont des littéraux, jamais recalculés par le code
  // éprouvé : les sorties de 32 bits d'une descente sans départ, un appel de
  // borne par tour tiré et par siège, sans rejet sur ces instances, plus
  // n − 1 par mélange de n éléments, un mélange par tour et par placement
  // tiré.
  //
  // La réplique, qui tire comme rechercher, produit exactement ces sorties ;
  // le plan de rechercher égale le sien. Ce plan ne voit un tirage de plus
  // que s'il le précède une meilleure affectation qui en dépend : chaque cas
  // à relance exige donc qu'un mouvement trouve une meilleure affectation
  // après la DERNIÈRE relance, et arret s'arrête avant la relance suivante.
  // Un tirage de plus n'importe où sur le chemin de la relance décale alors
  // le placement de cette relance ou les mouvements qui la suivent, et
  // change le plan rendu par rechercher.
  const CAS = [
    { graine: 1, arret: 20_000, historique: 1_000, sorties: 60_044, relances: 0 },
    { graine: 30, arret: 2_600, historique: 20, sorties: 7_888, relances: 1 },
    { graine: 35, arret: 5_500, historique: 20, sorties: 16_632, relances: 2 },
    { graine: 59, arret: 1_950, historique: 5, sorties: 6_026, relances: 3 },
    { graine: 25, arret: 20_000, historique: 50, sorties: 60_176, relances: 3 },
    { graine: 8, arret: 15_000, historique: 5, sorties: 47_112, relances: 47 },
  ];
  for (const { graine, arret, historique, sorties, relances } of CAS) {
    test(`petite, graine ${graine}, arret ${arret}, historique ${historique} : ${sorties} sorties, ${relances} relance(s), le plan de rechercher`, () => {
      const configuration = demo('petite');
      const instance = normaliser(configuration);
      const graines = creerPcg32(graine, FLUX.GRAINES);
      const graineDerivee = graines.suivant();
      assert.equal(sortiesProduites(graines, graine, FLUX.GRAINES), 1);
      const rng = creerPcg32(graineDerivee, FLUX.RECHERCHE);
      const replique = descendreALaLettre(instance, graineDerivee, arret, historique, { bascule: true, rng });
      assert.equal(replique.relances, relances);
      if (relances > 0) {
        assert.ok(replique.apresDerniere >= 1, `meilleures après la dernière relance : ${replique.apresDerniere}`);
      }
      assert.equal(sortiesProduites(rng, graineDerivee, FLUX.RECHERCHE), sorties);
      const [proposition] = rechercher(configuration, { graine, arret, historique, nombre: 1 });
      assert.deepEqual(Object.keys(proposition), CLES_PROPOSITION);
      assert.equal(proposition.graine, graineDerivee);
      assert.equal(proposition.evalues, arret);
      assert.deepStrictEqual(proposition.plan, replique.plan);
    });
  }

  // Deux cas à relance où la réplique tire le même nombre de sorties que
  // rechercher. Aucune meilleure affectation n'y suit la dernière relance,
  // si bien que l'égalité des plans n'y voit pas les tirages de la relance :
  // seuls les cas de CAS les éprouvent.
  for (const { graine, historique, sorties, relances } of [
    { graine: 3, historique: 10, sorties: 6_088, relances: 1 },
    { graine: 1, historique: 5, sorties: 6_132, relances: 2 },
  ]) {
    test(`réplique, petite, graine ${graine}, arret 2000, historique ${historique} : ${sorties} sorties, ${relances} relance(s)`, () => {
      const instance = normaliser(demo('petite'));
      const graineDerivee = creerPcg32(graine, FLUX.GRAINES).suivant();
      const rng = creerPcg32(graineDerivee, FLUX.RECHERCHE);
      const replique = descendreALaLettre(instance, graineDerivee, 2_000, historique, { bascule: true, rng });
      assert.equal(replique.relances, relances);
      assert.equal(sortiesProduites(rng, graineDerivee, FLUX.RECHERCHE), sorties);
    });
  }

  test('le placement tiré : 44 sorties sur la petite démonstration, 904 sur la grande, un mélange par tour', () => {
    for (const [cle, sorties] of [['petite', 44], ['grande', 904]]) {
      const rng = creerPcg32(1, FLUX.RECHERCHE);
      creerEtat(normaliser(demo(cle)), rng);
      assert.equal(sortiesProduites(rng, 1, FLUX.RECHERCHE), sorties, cle);
    }
  });
});

// Un générateur dont melanger range les libres de chaque tour par la table
// que plan leur donne, puis par index croissant, au lieu de les mélanger :
// creerEtat assied alors exactement plan, sur une instance où chaque table
// reçoit autant de libres que de sièges mobiles, sans place fantôme. Les
// appels se comptent par tour, dans l'ordre où creerEtat les fait : un
// rangeur neuf sert chaque état.
function rangeurDe(instance, plan) {
  const tableDe = indexerPlan(instance, plan);
  const { R } = instance;
  let r = 0;
  return {
    melanger(liste) {
      const tour = r;
      r += 1;
      return Int32Array.from([...liste].sort((p, q) => tableDe[p * R + tour] - tableDe[q * R + tour] || p - q));
    },
  };
}

// Les index des tours non figés, croissants.
const tirablesDe = (R, toursFiges) => Array.from({ length: R }, (_, r) => r).filter((r) => !toursFiges.includes(r + 1));

// La descente d'une proposition dérivée selon le paragraphe « Départ » de
// recherche.js, récrite avec les primitives publiques, sur une instance sans
// place fantôme : l'état du départ par creerEtat et rangeurDe, au début et à
// chaque relance ; chaque mouvement par proposerParmi sur les tours non
// figés, tiré du générateur de la graine dérivée ; l'acceptation, la
// bascule et la relance de descendreALaLettre. Rend son plan et ses comptes.
function repartirALaLettre(instance, graineDerivee, arret, L, { plan, toursFiges }) {
  const tirables = tirablesDe(instance.R, toursFiges);
  return descendreALaLettre(instance, graineDerivee, arret, L, {
    bascule: true,
    partir: () => creerEtat(instance, rangeurDe(instance, plan)),
    mouvoir: (etat, rng) => proposerParmi(etat, rng, tirables),
  });
}

// Le départ des épreuves sur la petite démonstration : une proposition à
// compte court, loin du plan parfait, ses tables dans l'ordre de l'instance.
const departPetite = (graine = 5) => rechercher(demo('petite'), { graine, arret: 40, nombre: 1 })[0].plan;

// La graine de departPetite, puis graine, compte et historique, où une
// dérivée de la petite démonstration, tour 1 figé, voit l'écart maximal de
// sa meilleure affectation tomber à zéro sans que son score s'annule : elle
// bascule, relance, et trouve une meilleure affectation après une relance
// (en-tête de recherche.js).
const RELANCE = { depart: 6, graine: 13, arret: 20_000, historique: 5 };

// Le plan, tables dans l'ordre déclaré, dont chaque liste et l'ordre des
// tables sont renversés : le même placement, écrit autrement.
const renverse = ({ tables, tours, reserves }) => ({
  tables: [...tables].reverse(),
  tours: tours.map((listes) => [...listes].reverse().map((liste) => [...liste].reverse())),
  reserves: reserves.map((reserve) => [...reserve]),
});

// Un départ valide de salleReservee : chacun à sa table réservée, une place
// fantôme par tour, ailleurs à chaque tour.
const departSalle = () => ({
  tables: [10, 20, 30],
  tours: [
    [[2, 4, 5, 6], [1, 7, 8], [3, 9]],
    [[2, 3, 7], [1, 4, 9], [5, 6, 8]],
    [[2, 5, 7, 9], [1, 4, 6], [3, 8]],
  ],
  reserves: [[], [], []],
});

// Le n-uplet du score d'un plan, par l'oracle.
const scoreDuPlan = (instance, plan) => scoreOracle(instance, indexerPlan(instance, plan), plafondsAPriori(instance)).nUplet;

describe('repartir : une dérivée continue son départ (§ 5.7, D69 à D71, C24)', () => {
  test('une dérivée part du plan de son départ, au début et à chaque relance : petite démonstration, tour 1 figé', () => {
    const configuration = demo('petite');
    const instance = normaliser(configuration);
    const depart = { plan: departPetite(RELANCE.depart), toursFiges: [1] };
    const { graine, arret, historique } = RELANCE;
    const [proposition] = repartir(configuration, { graine, arret, historique, nombre: 1 }, depart);
    // Sans relance, l'épreuve n'éprouverait pas la relance : elle refuse de
    // passer.
    assert.ok(proposition.relances >= 1, `relances : ${proposition.relances}`);
    const replique = repartirALaLettre(instance, proposition.graine, arret, historique, depart);
    assert.equal(proposition.relances, replique.relances);
    assert.ok(replique.apresRelance >= 1, `meilleures après une relance : ${replique.apresRelance}`);
    assert.deepStrictEqual(proposition.plan, replique.plan);
    assert.ok(proposition.releves.length >= 3);
    for (const { mouvements, plan } of [...proposition.releves, { mouvements: proposition.evalues, plan: proposition.plan }]) {
      depart.plan.tables.forEach((table, i) => {
        assert.deepEqual(plan.tours[0][i], depart.plan.tours[0][i], `point ${mouvements}, table ${table}`);
      });
    }
  });

  test('une dérivée est la descente du paragraphe « Départ », à la lettre : sans tour figé, tour 2, tours 1 et 3', () => {
    const configuration = demo('petite-conflit');
    const instance = normaliser(configuration);
    const plan = rechercher(configuration, { graine: 8, arret: 60, nombre: 1 })[0].plan;
    for (const toursFiges of [[], [2], [1, 3]]) {
      const reglages = { graine: 4, arret: 4_000, nombre: 2, historique: 20 };
      const propositions = repartir(configuration, reglages, { plan, toursFiges });
      for (const proposition of propositions) {
        const replique = repartirALaLettre(instance, proposition.graine, reglages.arret, reglages.historique, { plan, toursFiges });
        assert.deepStrictEqual(proposition.plan, replique.plan, `figés ${toursFiges}, n° ${proposition.id}`);
        assert.equal(proposition.relances, replique.relances);
      }
    }
  });

  test('chaque proposition porte ses champs, sa course et ses relances ; ses graines dérivées sont celles de rechercher', () => {
    const configuration = demo('petite');
    const reglages = { graine: 12, arret: 500, nombre: 3, historique: 30 };
    const derivees = repartir(configuration, reglages, { plan: departPetite(), toursFiges: [] });
    const ordinaires = rechercher(configuration, reglages);
    assert.deepEqual(derivees.map(({ id }) => id), [1, 2, 3]);
    for (const [i, proposition] of derivees.entries()) {
      assert.deepEqual(Object.keys(proposition), [...CLES_PROPOSITION, 'relances']);
      assert.ok(Number.isInteger(proposition.relances) && proposition.relances >= 0);
      for (const champ of ['graine', 'arret', 'historique']) assert.equal(proposition[champ], ordinaires[i][champ], champ);
    }
  });

  test("même graine saisie, ordinaire et dérivée : même triplet, d'autres plans", () => {
    const configuration = demo('petite');
    const reglages = { graine: 21, arret: 1_000, nombre: 3, historique: 50 };
    const derivees = repartir(configuration, reglages, { plan: departPetite(), toursFiges: [1] });
    const ordinaires = rechercher(configuration, reglages);
    for (const [i, { graine, arret, historique, plan }] of derivees.entries()) {
      assert.deepEqual([graine, arret, historique], [ordinaires[i].graine, ordinaires[i].arret, ordinaires[i].historique]);
      assert.notDeepStrictEqual(plan, ordinaires[i].plan, `n° ${i + 1}`);
    }
  });

  test('repartirUne égale repartir au rang k : rangs 1, 3 et 5, dans le désordre', () => {
    const configuration = demo('petite');
    const reglages = { graine: 33, arret: 800, nombre: 5, historique: 40 };
    const depart = { plan: departPetite(), toursFiges: [2] };
    const toutes = repartir(configuration, reglages, depart);
    for (const rang of [5, 1, 3]) {
      assert.deepStrictEqual(repartirUne(configuration, reglages, depart, rang), toutes[rang - 1], `rang ${rang}`);
    }
    for (const rang of [0, 6, 1.5]) {
      assert.throws(() => repartirUne(configuration, reglages, depart, rang), { name: 'RangeError', reglage: 'rang' });
    }
  });

  test('le point de relevé k d\'une dérivée égale regenerer au compte k, départ et tours figés compris : 1, 10, 100, 1 000', () => {
    const configuration = demo('petite');
    const planDuDepart = departPetite();
    for (const toursFiges of [[1], [2, 4]]) {
      const [proposition] = repartir(configuration, { graine: 9, arret: 2_500, nombre: 1, historique: 25 }, { plan: planDuDepart, toursFiges });
      const { graine, historique, releves, evalues, plan } = proposition;
      assert.deepEqual(releves.map(({ mouvements }) => mouvements), puissancesSous(evalues));
      assert.deepEqual(releves.map(({ mouvements }) => mouvements), [1, 10, 100, 1_000]);
      const fichier = { ...proposition, depart: 7, toursFiges };
      for (const releve of releves) {
        assert.deepStrictEqual(
          releve.plan,
          regenerer(configuration, { ...fichier, arret: releve.mouvements }, { planDuDepart }),
          `figés ${toursFiges}, point ${releve.mouvements}`,
        );
      }
      assert.deepStrictEqual(plan, regenerer(configuration, fichier, { planDuDepart }));
    }
  });

  test('regenerer sous un départ sans toursFiges part de lui sans tour figé', () => {
    const configuration = demo('petite');
    const planDuDepart = departPetite();
    const [proposition] = repartir(configuration, { graine: 2, arret: 700, nombre: 1, historique: 30 }, { plan: planDuDepart, toursFiges: [] });
    const { graine, arret, historique } = proposition;
    assert.deepStrictEqual(regenerer(configuration, { graine, arret, historique, depart: 3 }, { planDuDepart }), proposition.plan);
    assert.notDeepStrictEqual(regenerer(configuration, { graine, arret, historique }), proposition.plan);
  });

  test('aucun mouvement dans un tour figé : proposerParmi tire son tour parmi les tirables, puis ses deux sièges', () => {
    const instance = normaliser(demo('petite'));
    const rng = creerPcg32(97, FLUX.RECHERCHE);
    const etat = creerEtat(instance, rng);
    const avant = Int32Array.from(etat.tableDe);
    const tirables = [1, 3];
    // Chaque appel de borne est noté : le premier d'un mouvement tire son
    // tour dans la liste des tirables, les deux suivants ses sièges.
    const appels = [];
    const enveloppe = {
      borne(n) {
        const valeur = rng.borne(n);
        appels.push([n, valeur]);
        return valeur;
      },
    };
    const tires = [0, 0, 0, 0];
    const appliques = [0, 0, 0, 0];
    for (let i = 0; i < 4_000; i += 1) {
      appels.length = 0;
      const mouvement = proposerParmi(etat, enveloppe, tirables);
      const [[n, valeur], ...sieges] = appels;
      assert.equal(n, tirables.length);
      tires[tirables[valeur]] += 1;
      assert.deepEqual(sieges.map(([m]) => m), [3 * 4, 3 * 4]);
      if (mouvement !== null) {
        assert.equal(mouvement.tour, tirables[valeur]);
        appliques[mouvement.tour] += 1;
      }
    }
    assert.equal(tires[0] + tires[2], 0);
    assert.equal(appliques[0] + appliques[2], 0);
    assert.ok(appliques[1] > 1_000 && appliques[3] > 1_000, `${appliques}`);
    for (let p = 0; p < instance.N; p += 1) {
      for (const r of [0, 2]) assert.equal(etat.tableDe[p * instance.R + r], avant[p * instance.R + r], `p ${p}, tour ${r + 1}`);
    }
  });

  test('une dérivée du plan parfait de la petite démonstration rend ce plan : sans tour figé, et tour 1 figé', () => {
    const configuration = demo('petite');
    for (const toursFiges of [[], [1]]) {
      const propositions = repartir(configuration, { graine: 6, arret: 3_000, nombre: 3, historique: 20 }, { plan: PLAN_PARFAIT_PETITE, toursFiges });
      for (const { id, plan } of propositions) assert.deepStrictEqual(plan, PLAN_PARFAIT_PETITE, `figés ${toursFiges}, n° ${id}`);
    }
  });

  test("une dérivée n'est jamais pire que son départ dans l'ordre de la recherche, et le dépasse souvent", () => {
    let meilleures = 0;
    let examinees = 0;
    for (const [nom, configuration, plan] of [
      ['petite', demo('petite'), departPetite()],
      ['salle réservée', salleReservee(), departSalle()],
    ]) {
      const instance = normaliser(configuration);
      const { ORDRE_DU_SCORE } = ordresDe(instance);
      const auDepart = scoreDuPlan(instance, plan);
      for (const toursFiges of [[], [2]]) {
        for (const graine of [1, 2, 3]) {
          for (const proposition of repartir(configuration, { graine, arret: 600, nombre: 2, historique: 30 }, { plan, toursFiges })) {
            const signe = comparerDans(ORDRE_DU_SCORE, scoreDuPlan(instance, proposition.plan), auDepart);
            assert.ok(signe <= 0, `${nom}, figés ${toursFiges}, graine ${graine}, n° ${proposition.id}`);
            examinees += 1;
            if (signe < 0) meilleures += 1;
          }
        }
      }
    }
    assert.equal(examinees, 24);
    assert.ok(meilleures >= 12, `${meilleures} meilleures`);
  });

  test("le remplissage ne dépend pas de l'ordre des listes du plan : places fantômes, ancrés et partiellement fixés compris", () => {
    for (const [nom, configuration, plan] of [
      ['petite', demo('petite'), departPetite()],
      ['salle réservée', salleReservee(), departSalle()],
    ]) {
      const reglages = { graine: 14, arret: 900, nombre: 2, historique: 30 };
      for (const toursFiges of [[], [3]]) {
        assert.deepStrictEqual(
          repartir(configuration, reglages, { plan: renverse(plan), toursFiges }),
          repartir(configuration, reglages, { plan, toursFiges }),
          `${nom}, figés ${toursFiges}`,
        );
      }
    }
  });

  test('sous des places fantômes et des réservations, chaque plan tient les invariants, et chaque tour figé reste celui du départ', () => {
    const configuration = salleReservee();
    const instance = normaliser(configuration);
    const plan = departSalle();
    const propositions = repartir(configuration, { graine: 3, arret: 2_000, nombre: 3, historique: 20 }, { plan, toursFiges: [1, 3] });
    for (const proposition of propositions) {
      assert.deepEqual(verifierInvariants(instance, proposition.plan), [], `n° ${proposition.id}`);
      assert.deepEqual(reservationsRompues(configuration, proposition.plan).rompues, []);
      for (const releve of [...proposition.releves, proposition]) {
        for (const r of [0, 2]) assert.deepEqual(releve.plan.tours[r], plan.tours[r], `n° ${proposition.id}, tour ${r + 1}`);
      }
    }
  });

  test("un tour non figé dont les sièges mobiles sont moins de deux ne bouge pas ; un tour figé d'une seule table mobile reste celui du départ", () => {
    // Deux tables de 2 et une de 3, sept personnes, trois tours. Au tour 2,
    // cinq personnes sont réservées : deux sièges restent mobiles, à la
    // même table ; au tour 3, six le sont, un seul siège reste mobile.
    const configuration = configurationDe({
      appartenances: ['A', 'B', 'A', 'B', 'A', 'B', null],
      tables: [
        { id: 1, capacite: 2 },
        { id: 2, capacite: 2 },
        { id: 3, capacite: 3 },
      ],
      tours: 3,
      reservations: [
        auTour(1, 1, 2), auTour(2, 1, 2), auTour(3, 2, 2), auTour(4, 2, 2), auTour(5, 3, 2),
        auTour(1, 2, 3), auTour(2, 3, 3), auTour(3, 1, 3), auTour(4, 3, 3), auTour(5, 1, 3), auTour(6, 2, 3),
      ],
    });
    const instance = normaliser(configuration);
    const plan = {
      tables: [1, 2, 3],
      tours: [
        [[1, 2], [3, 4], [5, 6, 7]],
        [[1, 2], [3, 4], [5, 6, 7]],
        [[3, 5], [1, 6], [2, 4, 7]],
      ],
      reserves: [[], [], []],
    };
    for (const toursFiges of [[1], [3]]) {
      for (const proposition of repartir(configuration, { graine: 5, arret: 300, nombre: 2, historique: 10 }, { plan, toursFiges })) {
        assert.deepEqual(verifierInvariants(instance, proposition.plan), []);
        assert.deepEqual(proposition.plan.tours.slice(1), plan.tours.slice(1), `figés ${toursFiges}`);
      }
    }
  });

  test('R = 1 : figer le seul tour est refusé, aucun tour figé est admis', () => {
    const configuration = troisTablesDeDeux();
    const plan = { tables: [1, 2, 3], tours: [[[1, 2], [3, 4], [5, 6]]], reserves: [[]] };
    assert.throws(() => repartir(configuration, { graine: 1, arret: 10, nombre: 1 }, { plan, toursFiges: [1] }), {
      name: 'RangeError',
      reglage: 'toursFiges',
    });
    const [proposition] = repartir(configuration, { graine: 1, arret: 10, nombre: 1 }, { plan, toursFiges: [] });
    assert.deepStrictEqual(proposition.plan, plan);
    assert.equal(proposition.evalues, 0);
  });

  test('repartir ne modifie ni la configuration ni le départ ; un signal levé avant le départ fait lever ErreurAnnulee', () => {
    const configuration = salleReservee();
    const plan = departSalle();
    const toursFiges = [2];
    const copies = structuredClone({ configuration, plan, toursFiges });
    repartir(configuration, { graine: 1, arret: 300, nombre: 2 }, { plan, toursFiges });
    assert.deepStrictEqual({ configuration, plan, toursFiges }, copies);
    assert.throws(
      () => repartir(configuration, { graine: 1, arret: 300, nombre: 2 }, { plan, toursFiges }, { signal: { aborted: true } }),
      ErreurAnnulee,
    );
  });

  test("l'avancement d'une génération dérivée se compte comme celui de rechercher, sur nombre × arret à partir du rang de chaque proposition ; celui de repartirUne sur arret seul", () => {
    const configuration = demo('petite-conflit');
    const plan = rechercher(configuration, { graine: 8, arret: 60, nombre: 1 })[0].plan;
    const depart = { plan, toursFiges: [2] };
    const etapes = [];
    const progression = (fait, total) => etapes.push([fait, total]);
    const propositions = repartir(configuration, { graine: 4, arret: 1_500, nombre: 2, historique: 20 }, depart, { progression });
    assert.deepEqual(propositions.map(({ evalues }) => evalues), [1_500, 1_500]);
    assert.deepEqual(etapes, [
      [1_000, 3_000],
      [2_000, 3_000],
      [3_000, 3_000],
    ]);
    // 999 mouvements évalués : le millième n'est pas atteint.
    etapes.length = 0;
    const une = repartirUne(configuration, { graine: 4, arret: 999, nombre: 2, historique: 20 }, depart, 2, { progression });
    assert.equal(une.evalues, 999);
    assert.deepEqual(etapes, []);
  });

  test("dans l'ordre des contraintes, la descente se relance après PATIENCE × L itérations sans changement du score courant : historique 1, relance à la onzième itération, puis à la vingt et unième", () => {
    // Trois A et un B sur deux tables de 2, un tour : chaque placement réunit
    // deux A, le score courant ne change jamais, et l'écart est nul dès le
    // départ : l'acceptation compare dans l'ordre des contraintes, et chaque
    // itération compte sans changement.
    const configuration = configurationDe({
      appartenances: ['A', 'A', 'A', 'B'],
      tables: [
        { id: 1, capacite: 2 },
        { id: 2, capacite: 2 },
      ],
      tours: 1,
      contraintes: { ...SANS_CONTRAINTE, separerAppartenances: true },
    });
    const depart = { plan: { tables: [1, 2], tours: [[[1, 2], [3, 4]]], reserves: [[]] }, toursFiges: [] };
    const relances = [10, 11, 20, 21].map((arret) =>
      repartir(configuration, { graine: 1, arret, nombre: 1, historique: 1 }, depart)[0].relances);
    assert.deepEqual(relances, [0, 1, 1, 2]);
  });
});

describe('repartir et regenerer : le contrôle du départ, avant tout calcul (§ 5.7, § 8.9, C12, C24)', () => {
  const reglages = { graine: 1, arret: 1_000, nombre: 2 };
  // Les trois points d'entrée, chacun sur le départ reçu ; progression note
  // tout appel, qu'aucun refus ne doit précéder.
  const entrees = (configuration, plan, toursFiges, appels) => [
    ['repartir', () => repartir(configuration, reglages, { plan, toursFiges }, { progression: () => appels.push(1) })],
    ['repartirUne', () => repartirUne(configuration, reglages, { plan, toursFiges }, 2, { progression: () => appels.push(1) })],
    ['regenerer', () => regenerer(configuration, { graine: 5, arret: 1_000, historique: 30, depart: 1, toursFiges }, { planDuDepart: plan })],
  ];

  test('toursFiges désordonné, répété, hors de 1 à R, non entier, ou complet : RangeError qui nomme toursFiges', () => {
    const configuration = demo('petite');
    const plan = departPetite();
    for (const toursFiges of [[2, 1], [1, 1], [0], [5], [1.5], ['1'], [1, 2, 3, 4], 2]) {
      const appels = [];
      for (const [nom, appel] of entrees(configuration, plan, toursFiges, appels)) {
        assert.throws(appel, { name: 'RangeError', reglage: 'toursFiges' }, `${nom}, ${JSON.stringify(toursFiges)}`);
      }
      assert.deepEqual(appels, []);
    }
  });

  test("regenerer : depart sans le plan du départ refuse, au lieu de rendre la proposition ordinaire ; toursFiges sans depart refuse", () => {
    const configuration = demo('petite');
    const [proposition] = rechercher(configuration, { graine: 4, arret: 300, nombre: 1 });
    assert.throws(() => regenerer(configuration, { ...proposition, depart: 1 }), { name: 'RangeError', reglage: 'depart' });
    assert.throws(() => regenerer(configuration, { ...proposition, depart: 1, toursFiges: [1] }, {}), { name: 'RangeError', reglage: 'depart' });
    assert.throws(
      () => regenerer(configuration, { ...proposition, toursFiges: [1] }, { planDuDepart: departPetite() }),
      { name: 'RangeError', reglage: 'toursFiges' },
    );
    assert.throws(() => regenerer(configuration, { ...proposition, toursFiges: [] }), { name: 'RangeError', reglage: 'toursFiges' });
    for (const depart of [0, 1.5, '1']) {
      assert.throws(
        () => regenerer(configuration, { ...proposition, depart }, { planDuDepart: departPetite() }),
        { name: 'RangeError', reglage: 'depart' },
        String(depart),
      );
    }
    // Sans depart ni toursFiges, regenerer rend le plan de la proposition :
    // le plan du départ reçu n'est pas lu.
    assert.deepStrictEqual(regenerer(configuration, proposition, { planDuDepart: departPetite() }), proposition.plan);
  });

  // Les départs fautifs de salleReservee, chacun tiré de departSalle par une
  // seule retouche, et le refus attendu.
  const retouche = (modifier) => {
    const plan = departSalle();
    modifier(plan);
    return plan;
  };
  const FAUTIFS = [
    ['une personne en réserve', retouche((p) => { p.tours[0][2] = [3]; p.reserves[0] = [9]; }), { tour: 1, table: null, participant: 9 }],
    ['une personne assise et en réserve', retouche((p) => { p.reserves[0] = [9]; }), { tour: 1, table: null, participant: 9 }],
    ['une personne absente', retouche((p) => { p.tours[2][0] = [2, 5, 9]; }), { tour: 3, table: null, participant: 7 }],
    ['une personne étrangère', retouche((p) => { p.tours[1][2] = [5, 6, 42]; }), { tour: 2, table: 30, participant: 42 }],
    ['une personne assise deux fois', retouche((p) => { p.tours[0][1] = [1, 7, 9]; }), { tour: 1, table: 30, participant: 9 }],
    ['une table inconnue', retouche((p) => { p.tables = [10, 20, 99]; }), { tour: 1, table: 99, participant: null }],
    ['une table qui déborde', retouche((p) => { p.tours[1][1] = [1, 4, 6, 9]; p.tours[1][2] = [5, 8]; }), { tour: 2, table: 20, participant: null }],
    [
      'une personne fixée assise ailleurs, sa table réservée ayant de la place',
      retouche((p) => { p.tours[1][0] = [3, 7, 8]; p.tours[1][2] = [2, 5, 6]; }),
      { tour: 2, table: 10, participant: 2 },
    ],
    [
      'un ancré assis ailleurs à un seul tour',
      retouche((p) => { p.tours[2][1] = [4, 6, 8]; p.tours[2][2] = [1, 3]; }),
      { tour: 3, table: 20, participant: 1 },
    ],
    ['un tour sans une liste par table déclarée', retouche((p) => { p.tours[1] = [[2, 3, 7], [1, 4, 9, 5, 6, 8]]; }), { tour: 2, table: null, participant: null }],
    [
      'une table inconnue qui assied une seule personne',
      retouche((p) => {
        p.tables.push(99);
        p.tours[0] = [[2, 4, 5, 6], [1, 7, 8], [3], [9]];
        p.tours[1].push([]);
        p.tours[2].push([]);
      }),
      { tour: 1, table: 99, participant: null },
    ],
    ['la première table qui déborde', retouche((p) => { p.tours[1] = [[2, 3, 7, 9, 5], [1, 4], [6, 8]]; }), { tour: 2, table: 10, participant: null }],
  ];

  for (const [nom, plan, details] of FAUTIFS) {
    test(`DEPART_INCOMPATIBLE, ${nom} : refusé par repartir, repartirUne et regenerer, dans un tour figé comme non figé`, () => {
      const configuration = salleReservee();
      for (const toursFiges of [[], [details.tour], [details.tour === 1 ? 2 : 1]]) {
        const appels = [];
        for (const [entree, appel] of entrees(configuration, plan, toursFiges, appels)) {
          assert.throws(appel, { name: 'ErreurConfiguration', code: 'DEPART_INCOMPATIBLE', details }, `${entree}, figés ${toursFiges}`);
        }
        assert.deepEqual(appels, []);
      }
    });
  }

  test("un plan qui n'a pas R tours : DEPART_INCOMPATIBLE au premier tour qui manque ou qui est de trop", () => {
    const configuration = salleReservee();
    for (const [nom, plan, tour] of [
      ['deux tours', retouche((p) => { p.tours.pop(); p.reserves.pop(); }), 3],
      ['quatre tours', retouche((p) => { p.tours.push(p.tours[0]); p.reserves.push([]); }), 4],
    ]) {
      const appels = [];
      for (const [entree, appel] of entrees(configuration, plan, [], appels)) {
        assert.throws(
          appel,
          { name: 'ErreurConfiguration', code: 'DEPART_INCOMPATIBLE', details: { tour, table: null, participant: null } },
          `${entree}, ${nom}`,
        );
      }
      assert.deepEqual(appels, []);
    }
  });

  test("une table inconnue dont chaque liste est vide n'assied personne : le départ est admis, et rend ce que rend le même plan sans elle", () => {
    const avecInconnue = retouche((p) => {
      p.tables.push(99);
      for (const listes of p.tours) listes.push([]);
    });
    const rendus = (plan) => entrees(salleReservee(), plan, [2], []).map(([, appel]) => appel());
    assert.deepStrictEqual(rendus(avecInconnue), rendus(departSalle()));
  });

  test('le départ valide de ces épreuves est admis par les trois points d\'entrée', () => {
    const appels = [];
    const rendus = entrees(salleReservee(), departSalle(), [2], appels).map(([, appel]) => appel());
    assert.equal(appels.length, 3);
    assert.deepEqual(rendus.map((rendu) => Array.isArray(rendu) ? rendu.length : Object.keys(rendu).length), [2, 8, 3]);
  });
});
