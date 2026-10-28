// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de la recherche (§ 5.2, § 5.7, § 5.9, § 5.10, § 14.10) : à graine
// et entrée égales, propositions identiques ; l'identifiant d'une proposition
// est son rang dans la suite des graines dérivées, et son plan sort de sa
// graine dérivée, de son compte d'arrêt et de son historique, trois champs à
// partir desquels regenerer le rend ; chaque plan rendu tient les invariants
// et les réservations, et l'organisation d'un ancré y pèse comme une autre ;
// une salle trop petite est refusée avec le nombre de places manquantes ;
// l'avancement se rapporte toutes les 1 000 itérations, une descente s'arrête
// sur un score nul, une annulation ne rend rien ; le placement initial égale
// celui que décrit le paragraphe « Sièges » de l'en-tête de recherche.js,
// récrit ici à la lettre ; un échange avec une place fantôme fait passer une
// personne à une autre table, comme le dit son paragraphe « Mouvement » ; la
// descente égale l'acceptation tardive de son paragraphe « Acceptation
// tardive », récrite de même, là où ni bascule ni relance ne jouent, et sinon
// augmentée de la bascule et de la relance de son paragraphe « Deux ordres
// d'acceptation » ; le score tenu à jour et le score recalculé égalent le
// n-uplet de l'oracle de test/oracle_score.js, qui énumère les paires, les
// tours servis et les animateurs rencontrés et le compose palier par palier
// sur la compilation de l'instance ; la petite démonstration atteint son plan
// parfait sans cas particulier. Sur une configuration inventée à objectifs et
// animateurs, sous chacun des trois modes et sous un ordre réglé, l'état tenu
// à jour s'accorde au recalcul ; la bascule suit l'ordre réglé ; chaque mode
// descend jusqu'aux planchers du diagnostic, et le mode ou l'ordre ne
// changent aucun tirage. Une génération sans départ tire les nombres que
// comptent des littéraux. Une dérivée égale la descente du paragraphe
// « Départ », récrite de même, relances comprises ; ses tours figés ne
// bougent pas, elle n'est jamais pire que son départ, rend le plan parfait
// dont elle part, et son point de relevé k égale regenerer au compte k sous
// le même départ ; un départ malformé, ou qui contredit le mobilier, est
// refusé avant tout calcul. Sous la présence par tour, une salle se juge tour
// par tour, un absent n'est assis nulle part, et le départ d'une dérivée
// s'ajuste : absents, exclus et supprimés ignorés, arrivantes au siège
// canonique, puis, à un tour figé, à la meilleure chaise libre ou en réserve
// imposée, sans que personne d'autre ne bouge ; le départ brut et le départ
// ajusté par le stockage rendent les mêmes propositions, et une réserve
// imposée se mesure comme indicateurs.js la lit. Sur de petites salles
// écrites à la main, le départ ajusté se lit aussi case par case et siège par
// siège : libres en trop par index décroissants, débordements refusés à
// chaque table, remplissage canonique, retours et animateurs sous réserve
// imposée. Un plan rendu se juge par verifierInvariants, ou, sous absence,
// par ses listes lues sur la configuration, et se mesure par mesurer, deux
// modules distincts du module éprouvé. Le mouvement dirigé des inclusions se
// lit tirage par tirage sous des tirages imposés, ne touche ni tour figé ni
// siège fixé, tient l'ensemble des rencontres qui manquent égal au recompte,
// et la réplique, qui le récrit, rend les plans de la recherche ; il ne tire
// rien quand aucune rencontre demandée ne manque.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { CATALOGUE, PLAN_PARFAIT_PETITE } from '../demo/catalogue.js';
import { FLUX, creerPcg32 } from '../demo/prng.js';
import {
  LIBRE,
  RESERVE,
  indexerPlan,
  normaliser,
  planDepuisIndex,
} from './configuration.js';
import { CRITERES, MODES_OBJECTIFS, compilationDe, composantesDe } from './criteres.js';
import { diagnostiquer } from './diagnostic.js';
import { ErreurAnnulee, ErreurConfiguration } from './erreurs.js';
import { ciblesDesInclusions } from './inclusions.js';
import { mesurer } from './indicateurs.js';
import { plafondsAPriori } from './plafond.js';
import {
  creerEtat,
  creerEtatDuDepart,
  defaire,
  proposerEtAppliquer,
  proposerParmi,
  proposerUne,
  rapprocher,
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
  empreintesDeLaBascule,
  empreintesDesCombinaisons,
  empreintesDesPlans,
  exigerVerification,
  lireEmpreintes,
} from '../../test/empreintes_moteur.js';
import { grandeAvecInclusions } from '../../test/inclusions_grande.js';
import {
  animateursRencontres,
  conflitsDirects,
  scoreOracle,
  valeurDescendue,
} from '../../test/oracle_score.js';

const SANS_CONTRAINTE = {
  separerOrganisations: false,
  nouveauxVoisins: false,
  nouvelleTable: false,
  varierOrganisations: false,
};
const TOUTES_CONTRAINTES = {
  separerOrganisations: true,
  nouveauxVoisins: true,
  nouvelleTable: true,
  varierOrganisations: true,
};
const NOMS_CONTRAINTES = [
  'separerOrganisations',
  'nouveauxVoisins',
  'nouvelleTable',
  'varierOrganisations',
];
// Longueur d'historique que rechercher prend quand les réglages n'en donnent
// pas (plan, ReglagesGeneration).
const HISTORIQUE_PAR_DEFAUT = 1_000;

// Configuration neuve d'une démonstration du catalogue.
const demo = (cle) => CATALOGUE.find((entree) => entree.cle === cle).construire();

// L'ordre du registre, chaque critère seul à son palier, au poids 1 : l'écart
// au plafond a priori l'ouvre, et la bascule y passe les contraintes devant
// lui. Sous l'ordre par défaut, sans objectif ni animateurs, l'écart ne
// précède que la redondance, et la bascule ne change pas l'ordre
// d'acceptation.
const ordreDuRegistre = CRITERES.map((critere) => [{ critere, poids: 1 }]);

// La même configuration sous l'ordre du registre : les épreuves de la
// bascule, de la relance et des tirages s'y règlent.
const sousLOrdreDuRegistre = (configuration) => ({ ...configuration, priorites: ordreDuRegistre });

const tous = (participant, table) => ({ participant, table, portee: 'tous' });
const auTour = (participant, table, tour) => ({ participant, table, portee: 'tour', tour });

// Configuration dont le participant d'id i + 1 porte organisations[i] ; les
// tables reçoivent leurs numéros dans l'ordre de la liste ; un id cité dans
// exclus est exclu.
function configurationDe({
  organisations,
  tables,
  tours,
  reservations = [],
  contraintes = SANS_CONTRAINTE,
  exclus = [],
}) {
  return {
    participants: organisations.map((organisation, i) => ({
      id: i + 1,
      nom: `P${i + 1}`,
      organisation,
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
    organisations: ['A', 'B', 'A', null, 'B', 'A', null, 'B', null],
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

// Six participants sans organisation, trois tables de 2, un tour, aucune
// contrainte : chacun rencontre son seul voisin, qui est son plafond a
// priori, quel que soit le placement. Le score est nul dès le placement
// initial, et chaque descente rend ce placement.
const troisTablesDeDeux = () =>
  configurationDe({
    organisations: Array(6).fill(null),
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
// Sur combien de mouvements tirés, tant qu'une unité d'inclusion manque, un
// est dirigé (en-tête de recherche.js, « Le mouvement dirigé »).
const PART_RAPPROCHER = 2;

// La fonction de mouvement d'une descente, selon le paragraphe « Le mouvement
// dirigé » de recherche.js : quand l'état tient les inclusions et qu'une
// unité manque, borne(PART_RAPPROCHER) tire d'abord, et 0 fait rapprocher
// dans tirables ; sinon le mouvement ordinaire seul, mouvoir.
const dirige = (mouvoir, tirables) => (etat, rng) =>
  etat.suitInclusions && etat.inclusionsNonSatisfaites > 0 && rng.borne(PART_RAPPROCHER) === 0
    ? rapprocher(etat, rng, tirables)
    : mouvoir(etat, rng);

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
// l'acceptation tardive seule, à la lettre (§ 5.10). Avec, il est l'ordre des
// contraintes tant que la meilleure affectation porte un écart maximal nul,
// lu au rang que la compilation donne au plus grand écart, celui du score
// sinon ; dans l'ordre des contraintes, un score courant inchangé pendant
// PATIENCE × L itérations fait repartir la descente d'un placement neuf, tiré
// du même générateur, l'historique à son score (en-tête de recherche.js).
// Rend le plan et quatre comptes : bascules, les passages à l'ordre des
// contraintes ; relances ; meilleures affectations trouvées après une
// relance ; et meilleures affectations qu'un mouvement trouve après la
// dernière relance (zéro sans relance).
//
// rng, le générateur des mouvements, est par défaut celui de la graine
// dérivée ; partir() construit l'état du début et de chaque relance,
// creerEtat sur rng par défaut ; mouvoir(etat, rng) tire et applique un
// mouvement ordinaire, proposerEtAppliquer par défaut, que le mouvement
// dirigé précède sous les inclusions (dirige), dans les tours de tirables,
// tous par défaut. Une dérivée (paragraphe « Départ ») se récrit en passant
// l'état de son départ, proposerParmi et ses tours non figés.
function descendreALaLettre(instance, graineDerivee, arret, L, {
  bascule,
  rng = creerPcg32(graineDerivee, FLUX.RECHERCHE),
  partir = () => creerEtat(instance, rng),
  mouvoir: ordinaire = proposerEtAppliquer,
  tirables = null,
}) {
  const mouvoir = dirige(ordinaire, tirables);
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
    if (!bascule || rangEcart === null) return;
    const suivant = meilleur[rangEcart] === 0 ? ORDRE_DES_CONTRAINTES : ORDRE_DU_SCORE;
    if (suivant !== ordre && suivant === ORDRE_DES_CONTRAINTES) comptes.bascules += 1;
    ordre = suivant;
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
      ['petite-conflit', () => sousLOrdreDuRegistre(demo('petite-conflit'))],
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
    // Dans la variante conflit, sous l'ordre du registre, chaque descente
    // atteint un écart nul, bascule, puis relance : la réplique littérale
    // rend les mêmes plans, et compte bascules et relances. La régénération
    // rejoue donc aussi le placement neuf qu'une relance tire.
    const repliques = descentesALaLettre(sousLOrdreDuRegistre(demo('petite-conflit')), reglages, { bascule: true });
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
      organisations: Array(11).fill(null),
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

  test("l'organisation d'un ancré compte : son collègue mobile n'est jamais assis à sa table", () => {
    // Trois tables de 3, trois tours. 1 et 2 portent l'organisation X, 1 est
    // ancré à la table 1. Chacun peut rencontrer six personnes sans croiser
    // personne deux fois, 2 compris, sans jamais s'asseoir à la table 1 :
    // trois des quatre classes parallèles du plan affine d'ordre 3, celle où
    // 1 et 2 se retrouvent écartée. Éviter la table 1 coûte à 2 au moins un
    // retour, que la séparation fait accepter. Une recherche qui ignorerait
    // l'organisation de l'ancré l'y assiérait pour épargner ce retour.
    const configuration = configurationDe({
      organisations: ['X', 'X', null, null, null, null, null, null, null],
      tables: [
        { id: 1, capacite: 3 },
        { id: 2, capacite: 3 },
        { id: 3, capacite: 3 },
      ],
      tours: 3,
      reservations: [tous(1, 1)],
      contraintes: { ...SANS_CONTRAINTE, separerOrganisations: true, nouvelleTable: true },
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
    const organisations = Array(12).fill(null);
    const sansReservation = configurationDe({ organisations, tables, tours: 2, exclus: [12] });
    const avecReservations = configurationDe({
      organisations,
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
    const unDePlus = configurationDe({ organisations: Array(13).fill(null), tables, tours: 2 });
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
    // quatrième à la seconde : deux d'une même organisation s'y retrouvent.
    // Un échange entre deux personnes garde trois et une ; seul l'échange
    // avec une place fantôme fait passer quelqu'un à la seconde table. À
    // deux par table, chacune peut réunir un A et un B, sans collision.
    const configuration = configurationDe({
      organisations: ['A', 'A', 'B', 'B'],
      tables: [
        { id: 1, capacite: 3 },
        { id: 2, capacite: 3 },
      ],
      tours: 1,
      contraintes: { ...SANS_CONTRAINTE, separerOrganisations: true },
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
      organisations: [null, null, null, null],
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
      organisations: [null, null],
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
    // les comparer entre eux ne dit rien d'elle. L'oracle de
    // test/oracle_score.js la refait par un autre chemin. Chaque grandeur
    // brute est non nulle dans au moins un état de chaque jeu : une
    // composante comptée sous une contrainte désactivée, ou omise sous une
    // contrainte active, se voit.
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
  test('petite démonstration en conflit, sous l’ordre du registre, historique 100, arret 20 000 : les plans de la réplique', () => {
    // Chaque descente y atteint un écart maximal nul et bascule ; à
    // historique 100, la patience vaut 1 000 itérations, et des relances
    // suivent la bascule puis trouvent de meilleures affectations. Les
    // comptes de la réplique l'exigent : sans eux, l'épreuve passerait aussi
    // sur des descentes qui ne basculent ni ne relancent.
    const reglages = { graine: 0, arret: 20_000, nombre: 3, historique: 100 };
    const repliques = descentesALaLettre(sousLOrdreDuRegistre(demo('petite-conflit')), reglages, { bascule: true });
    assert.deepStrictEqual(
      rechercher(sousLOrdreDuRegistre(demo('petite-conflit')), reglages).map(({ plan }) => plan),
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
// La liste canonique, chaque critère seul à son palier dans l'ordre du
// registre, l'écart en tête : une liste valide, que les épreuves découpent.
const canonique = () => CRITERES.map((nom) => [e(nom)]);

// Les ordres déplacés de l'épreuve : sous places, le palier { excédent × 1,
// tours hors objectif × 3 } en deuxième, le conflit d'organisation en
// quatrième, les inclusions en dernier ; sous les deux autres modes, les
// inclusions en deuxième, les tours hors objectif seuls en troisième, le
// conflit d'organisation en dernier.
const ORDRE_DEPLACE = {
  places: [
    [e('ecartAuPlafondAPrioriMax')],
    [e('excedentCollisions'), e('toursHorsObjectif', 3)],
    [e('collisionsCumulees')],
    [e('conflitsOrganisation')],
    [e('rencontresRepetees')],
    [e('animateursNonRencontres', 2)],
    [e('redondance')],
    [e('inclusionsNonSatisfaites')],
  ],
  deuxValeurs: [
    [e('ecartAuPlafondAPrioriMax')],
    [e('inclusionsNonSatisfaites')],
    [e('toursHorsObjectif')],
    [e('excedentCollisions')],
    [e('collisionsCumulees')],
    [e('rencontresRepetees')],
    [e('animateursNonRencontres'), e('redondance', 4)],
    [e('conflitsOrganisation')],
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
// réservé sans animer. Conflits : 1, de A, nomme B ; 4, sans organisation,
// nomme C ; 15, exclue, de C, nomme B : sa liste relie encore C et B.
// Inclusions : 1 inclut 7, 8 et C, et 7 inclut 1, une rencontre demandée des
// deux côtés ; 12 et 14 de même, et 12 inclut A ; 8 inclut B, dont aucun
// membre n'est 8 ; 3 inclut 2 et 9 inclut B, que les conflits contredisent.
function soireeAObjectifs({ mode = 'places', priorites } = {}) {
  const etiquettes = [
    ['finance'], ['finance'], ['finance'], ['Montréal', 'finance'], ['Montréal', 'finance'],
    ['Montréal'], ['Montréal'], ['bénévole'], ['bénévole'],
  ];
  const anime = new Map([[10, [1, 2, 3, 4]], [11, [2]], [12, [2]]]);
  const conflits = new Map([[1, ['B']], [4, ['C']]]);
  const inclusions = new Map([
    [1, { inclusionsParticipant: [7, 8], inclusionsOrganisation: ['C'] }],
    [3, { inclusionsParticipant: [2] }],
    [7, { inclusionsParticipant: [1] }],
    [8, { inclusionsOrganisation: ['B'] }],
    [9, { inclusionsOrganisation: ['B'] }],
    [12, { inclusionsParticipant: [14], inclusionsOrganisation: ['A'] }],
    [14, { inclusionsParticipant: [12] }],
  ]);
  return {
    participants: Array.from({ length: 14 }, (_, rang) => ({
      id: rang + 1,
      nom: `P${rang + 1}`,
      organisation: ['A', 'B', 'C', null][rang % 4],
      exclu: false,
      ...(rang < etiquettes.length ? { etiquettes: etiquettes[rang] } : {}),
      ...(anime.has(rang + 1) ? { anime: anime.get(rang + 1) } : {}),
      ...(conflits.has(rang + 1) ? { conflits: conflits.get(rang + 1) } : {}),
      ...(inclusions.get(rang + 1) ?? {}),
    })).concat([{ id: 15, nom: 'P15', organisation: 'C', exclu: true, conflits: ['B'] }]),
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
        for (const grandeur of [
          'toursHorsObjectif', 'jamaisServies', 'horsObjectifMax', 'personnesAuMax', 'animateursNonRencontres', 'conflitsOrganisation',
          'inclusionsNonSatisfaites',
        ]) {
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
      assert.equal(nonNulles.size, 7, `${nom} : grandeurs des objectifs, des animateurs, des conflits et des inclusions non nulles ${[...nonNulles]}`);
      for (const mouvement of appliques.reverse()) defaire(etat, mouvement);
      assert.deepStrictEqual(scoreIncremental(etat), depart, nom);
    }
  });

  test('chaque composante a la place que la compilation lui donne : un mode à deux et trois valeurs, un palier pondéré, une somme de poids', () => {
    const tailles = JEUX_A_OBJECTIFS.map(({ configuration }) => scoreIncremental(creerEtat(normaliser(configuration), creerPcg32(1, FLUX.RECHERCHE))).length);
    assert.deepEqual(tailles, [10, 9, 11, 10, 12, 11]);
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

// Six personnes, deux tables de 3, deux tours, sans case cochée : 1 de A, 2
// et 3 de B, 4 de C, 5 et 6 sans organisation. 1 et 2 s'incluent l'un
// l'autre, 5 inclut B, 6 inclut 4 : trois rencontres demandées, la paire
// (1, 2), le couple (5, B) et la paire (6, 4).
const salleAInclusions = () => {
  const configuration = configurationDe({
    organisations: ['A', 'B', 'B', 'C', null, null],
    tables: [{ id: 10, capacite: 3 }, { id: 20, capacite: 3 }],
    tours: 2,
  });
  const listes = new Map([
    [1, { inclusionsParticipant: [2] }],
    [2, { inclusionsParticipant: [1] }],
    [5, { inclusionsOrganisation: ['B'] }],
    [6, { inclusionsParticipant: [4] }],
  ]);
  configuration.participants = configuration.participants.map((personne) => ({ ...personne, ...(listes.get(personne.id) ?? {}) }));
  return configuration;
};

// Un plan de salleAInclusions, tour par tour, les deux tables dans l'ordre.
const planDeLaSalle = (...tours) => ({ tables: [10, 20], tours, reserves: tours.map(() => []) });

// Applique compte mouvements tirés par tirer, puis les défait : après chaque
// mouvement et chaque retour, les inclusions non satisfaites de l'état
// égalent les avis que mesurer recompte. Rend les écarts relevés, les
// valeurs prises et ce qui a changé : une unité de paire et une unité
// d'organisation satisfaites puis défaites.
function suivreLesInclusions(instance, etat, tirer, compte) {
  const { uniteLigne, uniteSource } = ciblesDesInclusions(instance);
  const genre = (p, cible) => {
    const u = uniteSource.findIndex((source, k) => source === p && instance.inclusionCible[uniteLigne[k]] === cible);
    return instance.inclusionCible[uniteLigne[u]] >= 0 ? 'paire' : 'organisation';
  };
  const ecarts = [];
  const valeurs = new Set();
  const changes = new Set();
  let avant = null;
  const confronter = (etiquette) => {
    const { avis, nonSatisfaites } = mesurer(instance, etat.tableDe).inclusions;
    const manquees = new Set(nonSatisfaites.map(({ p, cible }) => `${p} ${cible}`));
    if (avant !== null) {
      for (const cle of [...manquees, ...avant].filter((c) => manquees.has(c) !== avant.has(c))) {
        const [p, cible] = cle.split(' ').map(Number);
        changes.add(`${genre(p, cible)} ${manquees.has(cle) ? 'défaite' : 'satisfaite'}`);
      }
    }
    avant = manquees;
    valeurs.add(avis);
    if (etat.inclusionsNonSatisfaites !== avis) ecarts.push(`${etiquette} : état ${etat.inclusionsNonSatisfaites}, mesure ${avis}`);
  };
  confronter('départ');
  const appliques = [];
  for (let essai = 0; appliques.length < compte && essai < 100 * compte; essai += 1) {
    const mouvement = tirer();
    if (mouvement === null) continue;
    appliques.push(mouvement);
    confronter(`mouvement ${appliques.length}`);
  }
  for (const mouvement of appliques.reverse()) {
    defaire(etat, mouvement);
    confronter('défait');
  }
  return { ecarts, valeurs, changes };
}

describe('score : les inclusions, tenues coup par coup (en-tête de recherche.js, § 5.10)', () => {
  test('salle à inclusions : trois unités, une paire demandée des deux côtés comptée une fois, le critère au deuxième palier', () => {
    const instance = normaliser(salleAInclusions());
    assert.equal(instance.inclusionsActives, 4);
    assert.equal(ciblesDesInclusions(instance).uniteLigne.length, 3);
    const { paliers } = compilationDe(instance);
    assert.deepEqual(paliers.map(({ criteres }) => criteres.map(({ nom }) => nom)), [['inclusionsNonSatisfaites'], ['ecartAuPlafondAPrioriMax']]);
    // (1, 2) jamais réunis : leurs deux lignes manquent, un seul avis. 5
    // rencontre 3 au tour 1, puis 2 et 3 au tour 2 : B satisfait une fois.
    // 6 rencontre 4 aux deux tours.
    const plan = planDeLaSalle([[1, 3, 5], [2, 4, 6]], [[1, 4, 6], [2, 3, 5]]);
    const etat = creerEtatDuDepart(instance, { plan, toursFiges: [] });
    assert.equal(etat.suitInclusions, true);
    assert.equal(etat.inclusionsNonSatisfaites, 1);
    assert.equal(scoreIncremental(etat)[0], 1);
    assert.deepStrictEqual(scoreComplet(etat), scoreIncremental(etat));
    const { inclusions } = mesurer(instance, etat.tableDe);
    assert.deepEqual(inclusions.nonSatisfaites, [{ p: 0, cible: 1, reciproque: true }]);
    // Le premier membre de B que 5 rencontre la satisfait, le second n'y
    // ajoute rien : 5 avec 2 seul, puis avec 2 et 3, donne le même compte.
    for (const tours of [
      [[[1, 2, 5], [3, 4, 6]], [[1, 4, 6], [2, 3, 5]]],
      [[[1, 2, 5], [3, 4, 6]], [[1, 3, 6], [2, 4, 5]]],
    ]) {
      const deux = creerEtatDuDepart(instance, { plan: planDeLaSalle(...tours), toursFiges: [] });
      assert.equal(deux.inclusionsNonSatisfaites, 0, JSON.stringify(tours));
    }
    // Personne ne rencontre qui il inclut : trois avis.
    const aucun = creerEtatDuDepart(instance, { plan: planDeLaSalle([[1, 4, 5], [2, 3, 6]], [[1, 4, 5], [2, 3, 6]]), toursFiges: [] });
    assert.equal(aucun.inclusionsNonSatisfaites, 3);
  });

  test('après chaque mouvement et chaque mouvement défait, l’état tient les avis que mesurer recompte : paires et organisations satisfaites puis défaites', () => {
    const jeux = [
      ['salle à inclusions', salleAInclusions()],
      ['soirée à objectifs, places', soireeAObjectifs()],
      ['soirée à objectifs, minimum, ordre déplacé', soireeAObjectifs({ mode: 'minimum', priorites: ordreDeplace('minimum') })],
    ];
    for (const [nom, configuration] of jeux) {
      const instance = normaliser(configuration);
      const rng = creerPcg32(29, FLUX.RECHERCHE);
      const etat = creerEtat(instance, rng);
      const { ecarts, valeurs, changes } = suivreLesInclusions(instance, etat, () => proposerEtAppliquer(etat, rng), 600);
      assert.deepEqual(ecarts.slice(0, 3), [], nom);
      assert.ok(valeurs.size >= 2, `${nom} : valeurs prises ${[...valeurs]}`);
      assert.deepEqual([...changes].sort(), ['organisation défaite', 'organisation satisfaite', 'paire défaite', 'paire satisfaite'], nom);
    }
  });

  test('sous un départ à tours figés et réserves imposées, l’état tient les avis coup par coup, un mouvement après l’autre', () => {
    const instance = normaliser(soireeAReservesImposees());
    const reservesImposees = [{ participant: 3, tour: 2 }, { participant: 4, tour: 2 }];
    const etat = creerEtatDuDepart(instance, { plan: departAReservesImposees(), toursFiges: [2], reservesImposees });
    // 7 rencontre 2, de B, au tour figé, au siège que laisse 3 : l'unité de
    // 7 vers B est satisfaite, bien que 6 soit le seul membre de B qu'un
    // plan qui honore les réservations lui fasse rencontrer. Elle se suit
    // donc par le couple (7, B), comme mesurer la juge, et non par la paire
    // (7, 6).
    const [sept, deux, six] = [7, 2, 6].map((id) => instance.indexDe.get(id));
    assert.equal(etat.tableDe[sept * instance.R + 1], etat.tableDe[deux * instance.R + 1]);
    const { uniteLigne, uniteSource, unitePartenaire } = ciblesDesInclusions(instance);
    const versB = uniteSource.findIndex((p, u) => p === sept && instance.inclusionCible[uniteLigne[u]] < 0);
    assert.equal(unitePartenaire[versB], six);
    assert.ok(!mesurer(instance, etat.tableDe).inclusions.nonSatisfaites.some(({ p, cible }) => p === sept && cible < 0));
    const rng = creerPcg32(37, FLUX.RECHERCHE);
    const { ecarts, valeurs } = suivreLesInclusions(instance, etat, () => proposerParmi(etat, rng, [0, 2]), 600);
    assert.deepEqual(ecarts.slice(0, 3), []);
    assert.ok(valeurs.size >= 2, `valeurs prises ${[...valeurs]}`);
  });

  test('une dérivée sous inclusions n’en laisse jamais plus que son départ, et ses tours figés ne bougent pas', () => {
    const configuration = salleAInclusions();
    const instance = normaliser(configuration);
    // Personne ne rencontre qui il inclut : trois avis, que le tour 2, libre,
    // peut tous lever.
    const plan = planDeLaSalle([[1, 4, 5], [2, 3, 6]], [[1, 4, 5], [2, 3, 6]]);
    const avisDuDepart = mesurer(instance, indexerPlan(instance, plan)).inclusions.avis;
    assert.equal(avisDuDepart, 3);
    for (const graine of [1, 2, 3]) {
      const [proposition] = repartir(configuration, { graine, arret: 2_000, nombre: 1 }, { plan, toursFiges: [1] });
      assert.deepEqual(proposition.plan.tours[0].map((liste) => [...liste].sort()), plan.tours[0], `graine ${graine}`);
      const avis = mesurer(instance, indexerPlan(instance, proposition.plan)).inclusions.avis;
      assert.ok(avis <= avisDuDepart, `graine ${graine} : ${avis}`);
      assert.equal(avis, 0, `graine ${graine}`);
    }
  });

  test('un fil par proposition rend la génération d’un seul : chaque rang de proposerUne, dans n’importe quel ordre, égale celui de rechercher', () => {
    const configuration = soireeAObjectifs();
    const reglages = { graine: 41, arret: 3_000, nombre: 4 };
    const toutes = rechercher(configuration, reglages);
    for (const rang of [3, 1, 4, 2]) assert.deepStrictEqual(proposerUne(configuration, reglages, rang), toutes[rang - 1], `rang ${rang}`);
  });

  test("sans ligne active, l'état ne tient rien des inclusions et la recherche rend les plans d'une salle sans liste, mêmes tirages", () => {
    // 1, de A, inclut B, que 3, de B, oppose à A : la seule ligne est
    // contredite. 2 inclut 4, exclu.
    const avecListes = configurationDe({
      organisations: ['A', null, 'B', null, 'B', 'A'],
      tables: [{ id: 10, capacite: 3 }, { id: 20, capacite: 3 }],
      tours: 3,
      exclus: [4],
    });
    const sansListe = structuredClone(avecListes);
    const listes = new Map([[1, { inclusionsOrganisation: ['B'] }], [2, { inclusionsParticipant: [4] }], [3, { conflits: ['A'] }]]);
    avecListes.participants = avecListes.participants.map((personne) => ({ ...personne, ...(listes.get(personne.id) ?? {}) }));
    sansListe.participants[2].conflits = ['A'];
    const instance = normaliser(avecListes);
    assert.equal(instance.inclusionsActives, 0);
    assert.equal(instance.inclusionsHorsAtteinte.length, 2);
    const etat = creerEtat(instance, creerPcg32(3, FLUX.RECHERCHE));
    assert.deepEqual([etat.suitInclusions, etat.inclusionsNonSatisfaites, etat.inclusionSatisfaite, etat.inclusions], [false, null, null, null]);
    const reglages = { graine: 5, arret: 4_000, nombre: 3 };
    assert.deepEqual(rechercher(avecListes, reglages), rechercher(sansListe, reglages));
  });
});

// La salle à inclusions où personne ne rencontre qui il inclut, aux deux
// tours : la table 10 assied 1, 4 et 5 aux sièges 0 à 2, la table 20 assied
// 2, 3 et 6 aux sièges 3 à 5. Ses trois unités manquent, dans cet ordre :
// la paire (1, 2), le couple (5, B), la paire (6, 4).
function etatSansRencontre(configuration = salleAInclusions()) {
  const instance = normaliser(configuration);
  const plan = planDeLaSalle([[1, 4, 5], [2, 3, 6]], [[1, 4, 5], [2, 3, 6]]);
  return { instance, etat: creerEtatDuDepart(instance, { plan, toursFiges: [] }) };
}

// Les unités qui manquent, lues de deux façons : le contenu de l'ensemble
// enManque, trié, et les unités que l'état juge non satisfaites.
function manquesDe(etat) {
  const n = etat.inclusionsNonSatisfaites;
  const ensemble = Array.from(etat.enManque.subarray(0, n)).sort((u, v) => u - v);
  const recompte = [];
  etat.inclusionSatisfaite.forEach((satisfaite, u) => {
    if (satisfaite === 0) recompte.push(u);
  });
  return { ensemble, recompte };
}

// Les compteurs de l'état, tableaux copiés, hors de l'ordre interne de
// l'ensemble enManque et des options du mouvement dirigé, qui ne sont pas
// des grandeurs.
function compteursDe(etat) {
  const copie = {};
  for (const [cle, valeur] of Object.entries(etat)) {
    if (cle === 'enManque' || cle === 'placeEnManque' || cle === 'options') continue;
    if (ArrayBuffer.isView(valeur)) copie[cle] = Array.from(valeur);
    else if (typeof valeur === 'number') copie[cle] = valeur;
  }
  return copie;
}

describe('recherche : le mouvement dirigé des inclusions (en-tête de recherche.js, « Le mouvement dirigé », § 5.10)', () => {
  test("à la lettre : une unité qui manque, un partenaire, une option, puis un siège de la table d'arrivée, celui qui y reste sauté", () => {
    const { etat } = etatSansRencontre();
    assert.deepEqual(Array.from(etat.enManque), [0, 1, 2]);
    // (5, B) ; son second membre, 3 ; la quatrième option, 3 au tour 2 ; le
    // second siège mobile de la table 10 hors de celui de 5, le siège 1, où
    // est 4. 3, au siège 4, et 4 s'échangent : 5 rencontre 3, et 4, passé à
    // la table 20, y rencontre 6.
    let rng = tiragesImposes([1, 1, 3, 1]);
    const mouvement = rapprocher(etat, rng);
    assert.deepEqual(rng.bornes, [3, 2, 4, 2]);
    assert.deepEqual(mouvement, { tour: 1, a: 4, b: 1 });
    assert.deepEqual(manquesDe(etat), { ensemble: [0], recompte: [0] });
    defaire(etat, mouvement);
    assert.deepEqual(manquesDe(etat), { ensemble: [0, 1, 2], recompte: [0, 1, 2] });
    assert.equal(etat.enManque[0], 0);
    // (1, 2), là où l'ensemble la range ; son seul partenaire ; la deuxième
    // option, 2 au tour 1, qui rejoint 1 au siège 0 : le rang 0 tiré saute
    // le siège de 1 et désigne le siège 1 ; le rang 1, le siège 2.
    for (const [rang, b] of [[0, 1], [1, 2]]) {
      rng = tiragesImposes([etat.enManque.indexOf(0), 0, 1, rang]);
      const vers = rapprocher(etat, rng);
      assert.deepEqual(rng.bornes, [3, 1, 4, 2], `rang ${rang}`);
      assert.deepEqual(vers, { tour: 0, a: 3, b }, `rang ${rang}`);
      assert.equal(etat.inclusionSatisfaite[0], 1, `rang ${rang}`);
      defaire(etat, vers);
    }
  });

  test("une option exige les deux assis au tour, le déplacé libre et un siège mobile d'arrivée ; sans option, null, et rien ne change", () => {
    // 1 est réservé à la table 10 au tour 1, et 2 n'est présent qu'au tour 1 :
    // seul 2 au tour 1 réunit la paire (1, 2).
    const reserve = salleAInclusions();
    reserve.reservations = [auTour(1, 10, 1)];
    reserve.participants[1] = { ...reserve.participants[1], presence: [1] };
    let { etat } = etatSansRencontre(reserve);
    let rng = tiragesImposes([0, 0, 0, 0]);
    assert.deepEqual(rapprocher(etat, rng), { tour: 0, a: 3, b: 1 });
    assert.deepEqual(rng.bornes, [3, 1, 1, 2]);
    // 1, 4 et 5 réservés à la table 10 au tour 1, 2 présent aux deux tours :
    // au tour 1, 1 ne bouge pas, et sa table n'a aucun siège mobile où 2
    // le rejoindrait. Parmi ce seul tour, la paire n'a aucune option.
    const pleine = salleAInclusions();
    pleine.reservations = [auTour(1, 10, 1), auTour(4, 10, 1), auTour(5, 10, 1)];
    ({ etat } = etatSansRencontre(pleine));
    assert.equal(etat.inclusionsNonSatisfaites, 3);
    const avant = compteursDe(etat);
    rng = tiragesImposes([0, 0]);
    assert.equal(rapprocher(etat, rng, [0]), null);
    assert.deepEqual(rng.bornes, [3, 1]);
    assert.deepStrictEqual(compteursDe(etat), avant);
    // Parmi les seuls tours de tirables : le tour 2, où 2 est absent, n'en
    // offre aucune, même sans la table pleine.
    ({ etat } = etatSansRencontre(reserve));
    rng = tiragesImposes([0, 0]);
    assert.equal(rapprocher(etat, rng, [1]), null);
    assert.deepEqual(rng.bornes, [3, 1]);
  });

  test("le partenaire d'une organisation qu'un seul membre peut satisfaire est ce membre, sans tirage parmi les autres", () => {
    // 1 et 2 de B, 3 et 4 sans organisation, deux tables de 2, deux tours ;
    // 2 est ancré à la table 10, 3 à la table 20 : seul 1, d'index 0, peut
    // rencontrer 3, qui inclut B.
    const configuration = configurationDe({
      organisations: ['B', 'B', null, null],
      tables: [{ id: 10, capacite: 2 }, { id: 20, capacite: 2 }],
      tours: 2,
      reservations: [tous(2, 10), tous(3, 20)],
    });
    configuration.participants[2].inclusionsOrganisation = ['B'];
    const instance = normaliser(configuration);
    const plan = { tables: [10, 20], tours: [[[1, 2], [3, 4]], [[1, 2], [3, 4]]], reserves: [[], []] };
    const etat = creerEtatDuDepart(instance, { plan, toursFiges: [] });
    assert.equal(etat.inclusionsNonSatisfaites, 1);
    // 1 quitte le siège 1, derrière 2 fixé, et rejoint 3 au tour 2, au seul
    // siège mobile de la table 20, celui de 4.
    const rng = tiragesImposes([0, 0, 1, 0]);
    assert.deepEqual(rapprocher(etat, rng), { tour: 1, a: 1, b: 3 });
    assert.deepEqual(rng.bornes, [1, 1, 2, 1]);
    assert.equal(etat.inclusionsNonSatisfaites, 0);
  });

  test("au second tour, le siège sauté est celui du partenaire, deuxième siège mobile de sa table", () => {
    // 1 inclut 3 ; deux tables de 4, deux tours, huit sièges par tour. Aux
    // deux tours, 1 est au premier siège de la table 10, et 3 au deuxième de
    // la table 20, le siège 5, après 2. La troisième option déplace 1 vers la
    // table 20 au tour 2 : le rang 0 désigne le siège 4, celui de 2 ; les
    // rangs 1 et 2 sautent le siège de 3 et désignent les sièges 6 et 7.
    const configuration = configurationDe({
      organisations: Array.from({ length: 8 }, () => null),
      tables: [{ id: 10, capacite: 4 }, { id: 20, capacite: 4 }],
      tours: 2,
    });
    configuration.participants[0].inclusionsParticipant = [3];
    const instance = normaliser(configuration);
    const tour = [[1, 4, 5, 8], [2, 3, 6, 7]];
    const etat = creerEtatDuDepart(instance, { plan: { tables: [10, 20], tours: [tour, tour], reserves: [[], []] }, toursFiges: [] });
    for (const [rang, b] of [[0, 4], [1, 6], [2, 7]]) {
      const rng = tiragesImposes([0, 0, 2, rang]);
      const mouvement = rapprocher(etat, rng);
      assert.deepEqual(rng.bornes, [1, 1, 4, 3], `rang ${rang}`);
      assert.deepEqual(mouvement, { tour: 1, a: 0, b }, `rang ${rang}`);
      assert.equal(etat.inclusionsNonSatisfaites, 0, `rang ${rang}`);
      defaire(etat, mouvement);
    }
  });

  test("une organisation que deux membres satisfont, dont celui d'index 0, les tire tous deux", () => {
    // 1 et 2 de B, 3 et 4 sans organisation, deux tables de 2, un tour ; 3
    // inclut B et s'assied avec 4, 1 et 2 à l'autre table.
    const configuration = configurationDe({
      organisations: ['B', 'B', null, null],
      tables: [{ id: 10, capacite: 2 }, { id: 20, capacite: 2 }],
      tours: 1,
    });
    configuration.participants[2].inclusionsOrganisation = ['B'];
    const instance = normaliser(configuration);
    const etat = creerEtatDuDepart(instance, { plan: { tables: [10, 20], tours: [[[3, 4], [1, 2]]], reserves: [[]] }, toursFiges: [] });
    assert.equal(etat.inclusionsNonSatisfaites, 1);
    // Le premier des deux partenaires, 1 ; la première option, 3 déplacé ;
    // le seul siège de la table 20 hors de celui de 1, celui de 2.
    const rng = tiragesImposes([0, 0, 0, 0]);
    assert.deepEqual(rapprocher(etat, rng), { tour: 0, a: 0, b: 3 });
    assert.deepEqual(rng.bornes, [1, 2, 2, 1]);
    assert.equal(etat.inclusionsNonSatisfaites, 0);
  });

  test("la source déplacée vers la table fixée de son partenaire, qui ne garde qu'un siège mobile : une option", () => {
    // 1 inclut 2, ancré à la table 20 ; deux tables de 2, un tour. 1 est
    // avec 3, 2 avec 4 : 1 rejoint 2 au siège de 4, le seul mobile de la 20.
    const configuration = configurationDe({
      organisations: [null, null, null, null],
      tables: [{ id: 10, capacite: 2 }, { id: 20, capacite: 2 }],
      tours: 1,
      reservations: [tous(2, 20)],
    });
    configuration.participants[0].inclusionsParticipant = [2];
    const instance = normaliser(configuration);
    const etat = creerEtatDuDepart(instance, { plan: { tables: [10, 20], tours: [[[1, 3], [2, 4]]], reserves: [[]] }, toursFiges: [] });
    const rng = tiragesImposes([0, 0, 0, 0]);
    assert.deepEqual(rapprocher(etat, rng), { tour: 0, a: 0, b: 3 });
    assert.deepEqual(rng.bornes, [1, 1, 1, 1]);
    assert.equal(etat.inclusionsNonSatisfaites, 0);
  });

  test("sous un départ à tours figés et réserves imposées, coup par coup : aucun tour figé ni siège fixé touché, l'ensemble des manques égal au recompte, puis tout défait", () => {
    const configuration = soireeAReservesImposees();
    const instance = normaliser(configuration);
    const { R, fixe } = instance;
    const reservesImposees = [{ participant: 3, tour: 2 }, { participant: 4, tour: 2 }];
    const etat = creerEtatDuDepart(instance, { plan: departAReservesImposees(), toursFiges: [2], reservesImposees });
    const depart = compteursDe(etat);
    const fige = (tableDe) => Array.from({ length: instance.N }, (_, p) => tableDe[p * R + 1]);
    const tourFige = fige(etat.tableDe);
    const tirables = [0, 2];
    const rng = creerPcg32(43, FLUX.RECHERCHE);
    const appliques = [];
    let diriges = 0;
    const ecarts = [];
    for (let essai = 0; essai < 400; essai += 1) {
      const dirige = etat.inclusionsNonSatisfaites > 0;
      const mouvement = dirige ? rapprocher(etat, rng, tirables) : proposerParmi(etat, rng, tirables);
      if (mouvement === null) continue;
      appliques.push(mouvement);
      if (dirige) diriges += 1;
      const { ensemble, recompte } = manquesDe(etat);
      if (!tirables.includes(mouvement.tour)) ecarts.push(`tour ${mouvement.tour}`);
      if (ensemble.join() !== recompte.join()) ecarts.push(`ensemble ${ensemble} contre ${recompte}`);
      if (etat.inclusionsNonSatisfaites !== mesurer(instance, etat.tableDe).inclusions.avis) ecarts.push('avis');
      for (const r of tirables) {
        for (let p = 0; p < instance.N; p += 1) {
          if (fixe[p * R + r] !== LIBRE && etat.tableDe[p * R + r] !== fixe[p * R + r]) ecarts.push(`fixé ${p} au tour ${r}`);
        }
      }
      if (fige(etat.tableDe).join() !== tourFige.join()) ecarts.push('tour figé');
    }
    assert.deepEqual(ecarts.slice(0, 3), []);
    assert.ok(diriges >= 50, `mouvements dirigés : ${diriges}`);
    assert.deepStrictEqual(scoreIncremental(etat), scoreComplet(etat));
    for (const mouvement of appliques.reverse()) defaire(etat, mouvement);
    assert.deepStrictEqual(compteursDe(etat), depart);
    const { ensemble, recompte } = manquesDe(etat);
    assert.deepEqual(ensemble, recompte);
  });

  test("sur la fixture des inclusions, deux cent six unités, un mouvement dirigé sur deux : l'ensemble des manques égal au recompte au placement, après chaque coup et chaque retour", () => {
    const instance = normaliser(grandeAvecInclusions());
    const rng = creerPcg32(47, FLUX.RECHERCHE);
    const etat = creerEtat(instance, rng);
    assert.equal(etat.inclusions.U, 206);
    const appliques = [];
    const ecarts = [];
    const vus = new Set();
    const confronter = (etiquette) => {
      const { ensemble, recompte } = manquesDe(etat);
      vus.add(ensemble.length);
      if (ensemble.join() !== recompte.join()) ecarts.push(`${etiquette} : ${ensemble.length} contre ${recompte.length}`);
    };
    confronter('placement');
    for (let essai = 0; essai < 600; essai += 1) {
      const dirige = etat.inclusionsNonSatisfaites > 0 && essai % 2 === 0;
      const mouvement = dirige ? rapprocher(etat, rng) : proposerEtAppliquer(etat, rng);
      if (mouvement === null) continue;
      appliques.push(mouvement);
      confronter(`coup ${appliques.length}`);
    }
    for (const mouvement of appliques.reverse()) {
      defaire(etat, mouvement);
      confronter('retour');
    }
    assert.deepEqual(ecarts.slice(0, 3), []);
    assert.ok(vus.size >= 10, `nombres de manques vus : ${vus.size}`);
  });

  test('rechercher et repartir sous inclusions : les plans de la réplique, qui dirige un mouvement sur PART_RAPPROCHER tant qu’une unité manque', () => {
    const configuration = salleAInclusions();
    const instance = normaliser(configuration);
    const reglages = { graine: 17, arret: 2_000, nombre: 3, historique: 20 };
    assert.deepStrictEqual(
      rechercher(configuration, reglages).map(({ plan }) => plan),
      descentesALaLettre(configuration, reglages, { bascule: true }).map(({ plan }) => plan),
    );
    // Au tour 1, figé, la paire (1, 2) et le couple (5, B) sont satisfaits ;
    // (6, 4) manque, et le tour 2 seul peut la satisfaire.
    const plan = planDeLaSalle([[1, 2, 6], [3, 4, 5]], [[1, 2, 6], [3, 4, 5]]);
    assert.equal(mesurer(instance, indexerPlan(instance, plan)).inclusions.avis, 1);
    const graines = creerPcg32(reglages.graine, FLUX.GRAINES);
    for (const proposition of repartir(configuration, reglages, { plan, toursFiges: [1] })) {
      const replique = repartirALaLettre(instance, graines.suivant(), reglages.arret, reglages.historique, { plan, toursFiges: [1] });
      assert.deepStrictEqual(proposition.plan, replique.plan, `proposition ${proposition.id}`);
    }
  });

  test('sur la fixture des inclusions, cinq propositions de 50 000 mouvements satisfont chacune les deux cent six rencontres demandées', () => {
    // Sans le mouvement dirigé, la même génération en laisse encore une
    // centaine par proposition à 100 000 mouvements : il fait l'atteinte.
    const configuration = grandeAvecInclusions();
    const instance = normaliser(configuration);
    const propositions = rechercher(configuration, { graine: 1, arret: 50_000, nombre: 5 });
    assert.deepEqual(propositions.map(({ plan }) => mesurer(instance, indexerPlan(instance, plan)).inclusions.avis), [0, 0, 0, 0, 0]);
  });

  test("toutes les unités satisfaites à un tour figé : aucun tirage de plus, la dérivée tire comme une descente sans mouvement dirigé", () => {
    // Au tour 1, figé, les trois unités sont satisfaites ; le tour 2 répète
    // les tables du tour 1, et l'écart reste à réduire jusqu'au compte.
    const configuration = salleAInclusions();
    const instance = normaliser(configuration);
    const plan = planDeLaSalle([[1, 2, 5], [3, 4, 6]], [[1, 2, 5], [3, 4, 6]]);
    assert.equal(mesurer(instance, indexerPlan(instance, plan)).inclusions.avis, 0);
    const reglages = { graine: 23, arret: 3_000, nombre: 4, historique: 10 };
    const graines = creerPcg32(reglages.graine, FLUX.GRAINES);
    for (const proposition of repartir(configuration, reglages, { plan, toursFiges: [1] })) {
      const graineDerivee = graines.suivant();
      const rng = creerPcg32(graineDerivee, FLUX.RECHERCHE);
      const replique = descendreALaLettre(instance, graineDerivee, reglages.arret, reglages.historique, {
        bascule: true,
        rng,
        partir: () => creerEtat(instance, rangeurDe(instance, plan)),
        mouvoir: (etat, g) => {
          assert.equal(etat.inclusionsNonSatisfaites, 0);
          return proposerParmi(etat, g, [1]);
        },
        tirables: [1],
      });
      assert.equal(proposition.evalues, reglages.arret);
      assert.deepStrictEqual(proposition.plan, replique.plan, `proposition ${proposition.id}`);
    }
  });
});

describe("score : les conflits d'organisation, tenus coup par coup (en-tête de recherche.js)", () => {
  test("après chaque mouvement appliqué puis chaque mouvement défait, l'état tient les conflits que mesurer recompte et que l'énumération directe compte", () => {
    const configuration = soireeAObjectifs();
    const instance = normaliser(configuration);
    assert.ok(instance.pairesEnConflit > 0);
    const enConflit = conflitsDirects(configuration, instance);
    // Les conflits d'un plan indexé, par énumération directe des paires.
    const directs = (tableDe) => {
      let total = 0;
      for (let r = 0; r < instance.R; r += 1) {
        for (let a = 0; a < instance.N; a += 1) {
          for (let b = a + 1; b < instance.N; b += 1) {
            const t = tableDe[a * instance.R + r];
            if (t !== RESERVE && t === tableDe[b * instance.R + r] && enConflit(a, b)) total += 1;
          }
        }
      }
      return total;
    };
    const rng = creerPcg32(23, FLUX.RECHERCHE);
    const etat = creerEtat(instance, rng);
    const valeurs = new Set();
    const ecarts = [];
    const confronter = (etiquette) => {
      const mesure = mesurer(instance, etat.tableDe).conflitsOrganisation;
      valeurs.add(mesure);
      if (etat.conflitsOrganisation !== mesure || mesure !== directs(etat.tableDe)) {
        ecarts.push(`${etiquette} : état ${etat.conflitsOrganisation}, mesure ${mesure}`);
      }
    };
    confronter('départ');
    const appliques = [];
    for (let essai = 0; appliques.length < 600; essai += 1) {
      const mouvement = proposerEtAppliquer(etat, rng);
      if (mouvement === null) continue;
      appliques.push(mouvement);
      confronter(`mouvement ${appliques.length}`);
    }
    for (const mouvement of appliques.reverse()) {
      defaire(etat, mouvement);
      confronter('défait');
    }
    assert.deepEqual(ecarts.slice(0, 3), []);
    assert.ok(valeurs.size >= 3, `valeurs prises : ${[...valeurs]}`);
  });

  test("sous l'ordre par défaut, la recherche annule les conflits de la petite démonstration où la première personne nomme la deuxième organisation, au prix de collisions", () => {
    // Trois organisations de quatre, quatre tables de trois : sans mêler
    // les deux organisations en conflit, une table ne porte que deux
    // organisations, et des collisions sont forcées. Le conflit, en tête,
    // passe avant elles.
    const base = demo('petite');
    const organisations = [...new Set(base.participants.map(({ organisation }) => organisation))];
    const configuration = {
      ...base,
      participants: base.participants.map((personne, rang) => (rang === 0 ? { ...personne, conflits: [organisations[1]] } : personne)),
    };
    const instance = normaliser(configuration);
    assert.equal(instance.pairesEnConflit, 16);
    for (const graine of [1, 2, 3]) {
      const [{ plan }] = rechercher(configuration, { graine, arret: 20_000, nombre: 1 });
      const mesures = mesurer(instance, indexerPlan(instance, plan));
      assert.equal(mesures.conflitsOrganisation, 0, `graine ${graine}`);
      assert.ok(mesures.collisionsCumulees > 0, `graine ${graine}`);
    }
  });
});

describe('score : chaque critère de CRITERES se lit sous sa propre grandeur, sous chaque mode (en-tête de recherche.js)', () => {
  test("chaque critère, seul à son palier, pose ses composantes ; chacune égale la grandeur que l'oracle lit sous son nom, et s'écarte au moins une fois de l'écart ; une faute nomme le critère", () => {
    // La composition retrouve le code d'une grandeur par son nom : un nom
    // sans code se lirait, sans lever, au code du plus grand écart. Sur la
    // soirée inventée, où chaque critère compte, l'ordre par défaut met
    // chaque critère seul à son palier ; un palier partagé lit le code sous
    // le nom du critère, la seule grandeur qu'il descend alors. À chaque
    // relevé, chaque composante d'un critère est confrontée à l'oracle, et
    // doit prendre au moins une fois une autre valeur que l'écart. Un
    // critère sans palier à lui seul, dont composantesDe ne nomme aucune
    // composante ou en nomme un autre nombre que son palier, ou dont l'oracle
    // ne connaît pas une grandeur, est une faute à son nom, citée à son
    // premier relevé.
    const RELEVES = 20;
    const PAS = 10;
    const fautes = new Map();
    const signaler = (cle, faute) => { if (!fautes.has(cle)) fautes.set(cle, faute); };
    for (const mode of MODES_OBJECTIFS) {
      const instance = normaliser(soireeAObjectifs({ mode }));
      const aPriori = plafondsAPriori(instance);
      const { paliers } = compilationDe(instance);
      const termes = CRITERES.flatMap((critere) => {
        const palier = paliers.find(({ criteres }) => criteres.length === 1 && criteres[0].nom === critere);
        if (palier === undefined) {
          signaler(`${mode} ${critere}`, `${mode}, ${critere} : aucune composante seule à son palier`);
          return [];
        }
        const grandeurs = composantesDe(critere, mode);
        if (grandeurs.length === 0 || grandeurs.length !== palier.composantes.length) {
          signaler(`${mode} ${critere}`, `${mode}, ${critere} : ${grandeurs.length} composantes nommées pour ${palier.composantes.length}`);
          return [];
        }
        return grandeurs.map((grandeur, k) => ({
          critere,
          grandeur,
          composante: palier.composantes[k],
          poids: palier.criteres[0].poids,
        }));
      });
      const distinctes = new Set();
      const rng = creerPcg32(13, FLUX.RECHERCHE);
      const etat = creerEtat(instance, rng);
      for (let releve = 0; releve <= RELEVES; releve += 1) {
        if (releve > 0) for (let i = 0; i < PAS; i += 1) proposerEtAppliquer(etat, rng);
        const { brutes } = scoreOracle(instance, etat.tableDe, aPriori, soireeAObjectifs({ mode }));
        const [complet, incremental] = [scoreComplet(etat), scoreIncremental(etat)];
        for (const { critere, grandeur, composante, poids } of termes) {
          if (grandeur !== 'rencontresRepetees' && !Object.hasOwn(brutes, grandeur)) {
            signaler(`${mode} ${grandeur}`, `${mode}, ${critere} : grandeur ${grandeur} inconnue de l'oracle`);
            continue;
          }
          const attendue = poids * valeurDescendue(brutes, grandeur, instance.contraintes);
          for (const [nom, score] of [['scoreComplet', complet], ['scoreIncremental', incremental]]) {
            if (score[composante] !== attendue) {
              signaler(`${mode} ${grandeur} ${nom}`, `${mode}, ${critere}, relevé ${releve} : ${nom} lit ${score[composante]} pour ${grandeur}, l'oracle ${attendue}`);
            }
          }
          if (attendue !== poids * brutes.ecartAuPlafondAPrioriMax) distinctes.add(grandeur);
        }
      }
      for (const { critere, grandeur } of termes) {
        if (grandeur !== 'ecartAuPlafondAPrioriMax' && !distinctes.has(grandeur) && !fautes.has(`${mode} ${grandeur}`)) {
          signaler(`${mode} ${grandeur} écart`, `${mode}, ${critere} : ${grandeur} vaut l'écart à chaque relevé, sa lecture ne s'en distingue pas`);
        }
      }
    }
    assert.deepEqual([...fautes.values()], []);
  });
});

describe("état de recherche : valeurs de départ, bornes de la composition, comptes au-delà d'un octet et de seize bits (§ 5.10)", () => {
  test('une personne seule ne peut rencontrer personne : écart et score nuls dès le placement, aucun mouvement évalué', () => {
    const configuration = configurationDe({ organisations: [null], tables: [{ id: 1, capacite: 2 }], tours: 2 });
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
      participants: [1, 2].map((id) => ({ id, nom: `F${id}`, organisation: null, exclu: false, etiquettes: ['finance'] })),
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
      organisations: [null, null],
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
      organisations: [null, null],
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
      ...canonique().slice(3),
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
      organisations: ['A', 'A', 'B', 'B'],
      tables: [
        { id: 1, capacite: 2 },
        { id: 2, capacite: 2 },
      ],
      tours: 1,
      contraintes: { ...SANS_CONTRAINTE, separerOrganisations: true },
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

// Dix personnes « finance », dont 10 d'organisation A ; 11, sans étiquette,
// d'organisation A, réservé à la table « finance » de huit places pour la
// soirée ; 12, sans étiquette ni organisation. Une table sans objectif de
// quatre, quatre tours, la seule case « séparer les organisations » cochée
// hors des objectifs ; les tours hors objectif au premier palier, les
// collisions cumulées au deuxième, l'écart au troisième. Chaque tour où 10
// est servi coûte une collision avec 11 sans changer les tours hors
// objectif : sous places, la descente le laisse jamais servi, au plus loin
// de l'objectif ; les deux autres modes doivent payer la collision.
function soireeFinance(mode) {
  const premiers = ['toursHorsObjectif', 'collisionsCumulees', 'ecartAuPlafondAPrioriMax'];
  return {
    participants: [
      ...Array.from({ length: 10 }, (_, rang) => ({ id: rang + 1, nom: `F${rang + 1}`, organisation: rang === 9 ? 'A' : null, exclu: false, etiquettes: ['finance'] })),
      { id: 11, nom: 'G11', organisation: 'A', exclu: false },
      { id: 12, nom: 'G12', organisation: null, exclu: false },
    ],
    tables: [{ id: 1, numero: 1, capacite: 8 }, { id: 2, numero: 2, capacite: 4 }],
    tours: 4,
    reservations: [tous(11, 1)],
    contraintes: { ...SANS_CONTRAINTE, separerOrganisations: true },
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
        priorites: [[e('toursHorsObjectif')], [e('ecartAuPlafondAPrioriMax')], ...canonique().slice(1).filter(([{ critere }]) => critere !== 'toursHorsObjectif')],
        participants: Array.from({ length: 6 }, (_, rang) => ({ id: rang + 1, nom: `F${rang + 1}`, organisation: null, exclu: false, etiquettes: ['finance'] })),
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
    const priorites = [[e('ecartAuPlafondAPrioriMax')], [e('excedentCollisions'), e('toursHorsObjectif')], ...canonique().slice(2).filter(([{ critere }]) => critere !== 'toursHorsObjectif')];
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
        const calcule = empreintesDeLaBascule(cle, mode);
        assert.deepEqual(differences(`${cle} (bascule), ${mode}`, calcule, REFERENCE.bascule[cle]), []);
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
  priorites: [[e('toursHorsObjectif')], [e('ecartAuPlafondAPrioriMax')], ...canonique().slice(1).filter(([{ critere }]) => critere !== 'toursHorsObjectif')],
  participants: Array.from({ length: 6 }, (_, rang) => ({ id: rang + 1, nom: `F${rang + 1}`, organisation: null, exclu: false, etiquettes: ['finance'] })),
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
    // Dans la variante conflit, sous l'ordre du registre, chaque descente
    // bascule puis relance avant 5 000 mouvements (épreuve de regenerer plus
    // haut) : un point copié pendant l'ordre des contraintes, ou juste après
    // une relance, doit encore égaler la régénération à son compte.
    const reglages = { graine: 5, arret: 5_000, nombre: 3, historique: 37 };
    let points = 0;
    for (const [nom, construire] of [
      ['salleReservee', salleReservee],
      ['petite-conflit', () => sousLOrdreDuRegistre(demo('petite-conflit'))],
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
  // tiré. La petite démonstration y porte l'ordre du registre
  // (sousLOrdreDuRegistre).
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
      const configuration = sousLOrdreDuRegistre(demo('petite'));
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
      const instance = normaliser(sousLOrdreDuRegistre(demo('petite')));
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
    tirables,
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
      organisations: ['A', 'B', 'A', 'B', 'A', 'B', null],
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
      organisations: ['A', 'A', 'A', 'B'],
      tables: [
        { id: 1, capacite: 2 },
        { id: 2, capacite: 2 },
      ],
      tours: 1,
      contraintes: { ...SANS_CONTRAINTE, separerOrganisations: true },
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
    ['une personne assise et en réserve', retouche((p) => { p.reserves[0] = [9]; }), { tour: 1, table: null, participant: 9 }],
    ['une personne en réserve deux fois', retouche((p) => { p.tours[0][2] = [3]; p.reserves[0] = [9, 9]; }), { tour: 1, table: null, participant: 9 }],
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
    [
      'une table inconnue qui assied un seul identifiant inconnu, ignoré partout ailleurs',
      retouche((p) => {
        p.tables.push(99);
        p.tours[0].push([42]);
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

// La configuration retouchée : le participant d'id i reçoit presences[i] pour
// présence, les autres restent tels quels.
const avecPresences = (configuration, presences) => ({
  ...configuration,
  participants: configuration.participants.map((participant) =>
    (presences[participant.id] === undefined ? participant : { ...participant, presence: presences[participant.id] })),
});

// Vrai quand le participant est présent au tour, lu sur la configuration :
// non exclu, et sans présence ou d'une présence qui nomme le tour.
const presentAuTour = (participant, tour) => !participant.exclu && (participant.presence?.includes(tour) ?? true);

// Les fautes d'un plan par identifiants, lues sur la configuration seule,
// chacune « tour r : … » : une table au-delà de sa capacité ; un identifiant
// listé à une table qui n'est pas un présent du tour (absent, exclu ou
// inconnu) ; un présent assis zéro ou plusieurs fois, réserves imposées mises
// à part ; une réserve qui n'est pas la liste des réserves imposées du tour ;
// une réservation d'un présent qui n'est pas tenue, réserve imposée mise à
// part.
function fautesDuPlan(configuration, plan, reservesImposees = []) {
  const fautes = [];
  const parId = new Map(configuration.participants.map((participant) => [participant.id, participant]));
  for (let r = 0; r < configuration.tours; r += 1) {
    const tour = r + 1;
    const imposees = reservesImposees.filter((entree) => entree.tour === tour).map(({ participant }) => participant);
    const assis = new Map();
    plan.tours[r].forEach((liste, i) => {
      const { capacite } = configuration.tables.find(({ id }) => id === plan.tables[i]);
      if (liste.length > capacite) fautes.push(`tour ${tour} : la table ${plan.tables[i]} déborde`);
      for (const id of liste) {
        assis.set(id, (assis.get(id) ?? 0) + 1);
        const participant = parId.get(id);
        if (participant === undefined || !presentAuTour(participant, tour)) fautes.push(`tour ${tour} : ${id} listé`);
      }
    });
    if (JSON.stringify(plan.reserves[r]) !== JSON.stringify(imposees)) fautes.push(`tour ${tour} : réserve [${plan.reserves[r]}]`);
    for (const participant of configuration.participants) {
      if (!presentAuTour(participant, tour) || imposees.includes(participant.id)) continue;
      const fois = assis.get(participant.id) ?? 0;
      if (fois !== 1) fautes.push(`tour ${tour} : ${participant.id} assis ${fois} fois`);
    }
    for (const { participant: id, table, portee, tour: reserve } of configuration.reservations) {
      if (portee !== 'tous' && reserve !== tour) continue;
      if (!presentAuTour(parId.get(id), tour) || imposees.includes(id)) continue;
      if (!plan.tours[r][plan.tables.indexOf(table)].includes(id)) fautes.push(`tour ${tour} : ${id}@${table} non tenue`);
    }
  }
  return fautes;
}

// Deux tables de 2, cinq personnes sans organisation, deux tours : quatre
// sièges par tour ; presences dit qui est absent où.
const deuxTablesDeDeux = (presences) =>
  avecPresences(configurationDe({
    organisations: Array(5).fill(null),
    tables: [
      { id: 1, capacite: 2 },
      { id: 2, capacite: 2 },
    ],
    tours: 2,
  }), presences);

describe('rechercher : la présence par tour (§ 5.9, § 5.10)', () => {
  // Les quatre points d'entrée qui préparent une instance.
  const entreesDe = (configuration) => [
    ['rechercher', () => rechercher(configuration, { graine: 1, arret: 10, nombre: 1 })],
    ['proposerUne', () => proposerUne(configuration, { graine: 1, arret: 10, nombre: 1 }, 1)],
    ['regenerer', () => regenerer(configuration, { graine: 1, arret: 10, historique: 5 })],
    ['creerEtat', () => creerEtat(normaliser(configuration), creerPcg32(1, FLUX.RECHERCHE))],
  ];

  test('PLACES_MANQUANTES se juge tour par tour : sous absence, tours nomme chaque tour à manque positif ; sans absence, les détails restent { placesManquantes }', () => {
    const cas = [
      [deuxTablesDeDeux({ 5: [1] }), { placesManquantes: 1, tours: [{ tour: 1, manque: 1 }] }],
      // Cinq présents au tour 2 seulement : le manque d'un tour tardif compte.
      [deuxTablesDeDeux({ 5: [2] }), { placesManquantes: 1, tours: [{ tour: 2, manque: 1 }] }],
      [deuxTablesDeDeux({}), { placesManquantes: 1 }],
      // Six personnes sur quatre sièges, trois tours : 6 au tour 1 seulement,
      // 5 aux tours 1 et 2 ; il manque 2, 1 et 0 places.
      [
        avecPresences(configurationDe({
          organisations: Array(6).fill(null),
          tables: [
            { id: 1, capacite: 2 },
            { id: 2, capacite: 2 },
          ],
          tours: 3,
        }), { 5: [1, 2], 6: [1] }),
        { placesManquantes: 2, tours: [{ tour: 1, manque: 2 }, { tour: 2, manque: 1 }] },
      ],
    ];
    for (const [configuration, details] of cas) {
      for (const [nom, appel] of entreesDe(configuration)) {
        assert.throws(appel, { name: 'ErreurConfiguration', code: 'PLACES_MANQUANTES', details }, `${nom}, ${JSON.stringify(details)}`);
      }
    }
  });

  test('une salle trop petite pour tous, assez grande pour les présents de chaque tour, est servie', () => {
    const configuration = deuxTablesDeDeux({ 4: [1], 5: [2] });
    const propositions = rechercher(configuration, { graine: 1, arret: 50, nombre: 2 });
    assert.deepEqual(propositions.map(({ id }) => id), [1, 2]);
  });

  test("un absent n'est listé nulle part, chaque présent est assis une fois, la réserve reste vide, points de relevé compris", () => {
    const configuration = deuxTablesDeDeux({ 4: [1], 5: [2] });
    const instance = normaliser(configuration);
    for (const graine of [1, 2, 3]) {
      for (const proposition of rechercher(configuration, { graine, arret: 300, nombre: 2, historique: 20 })) {
        for (const { mouvements, plan } of [...proposition.releves, { mouvements: proposition.evalues, plan: proposition.plan }]) {
          assert.deepEqual(fautesDuPlan(configuration, plan), [], `graine ${graine}, n° ${proposition.id}, point ${mouvements}`);
          assert.deepEqual(plan.reserves, [[], []]);
          indexerPlan(instance, plan);
        }
      }
    }
  });

  test("dans l'état de recherche, un absent vaut RESERVE et n'occupe aucun siège, à chaque pas de 2 000 mouvements ; le score tenu à jour égale le recalcul", () => {
    const instance = normaliser(deuxTablesDeDeux({ 4: [1], 5: [2] }));
    const { R } = instance;
    // Deux tables de 2 : quatre sièges par tour.
    const S = 4;
    const rng = creerPcg32(7, FLUX.RECHERCHE);
    const etat = creerEtat(instance, rng);
    // L'index 3 (id 4) est absent au tour 2, l'index 4 (id 5) au tour 1.
    const absents = [[3, 1], [4, 0]];
    let appliques = 0;
    for (let i = 0; i <= 2_000; i += 1) {
      if (i > 0 && proposerEtAppliquer(etat, rng) !== null) appliques += 1;
      for (const [p, r] of absents) {
        assert.equal(etat.tableDe[p * R + r], RESERVE, `pas ${i}, index ${p}`);
        assert.ok(!etat.siege.subarray(r * S, (r + 1) * S).includes(p), `pas ${i}, index ${p}`);
      }
      if (i % 100 === 0) assert.deepStrictEqual(scoreIncremental(etat), scoreComplet(etat), `pas ${i}`);
    }
    assert.ok(appliques > 500, `${appliques} mouvements appliqués`);
  });
});

// Les trois points d'entrée sous un départ : repartir, repartirUne au rang 2
// et regenerer de chaque proposition rendue. repartirUne égale repartir au
// rang 2, et regenerer rend le plan de chacune, octet pour octet. Rend les
// propositions de repartir.
function sousLeDepart(configuration, depart, reglages = { graine: 3, arret: 400, nombre: 2, historique: 20 }) {
  const propositions = repartir(configuration, reglages, depart);
  assert.deepStrictEqual(repartirUne(configuration, reglages, depart, 2), propositions[1], 'repartirUne');
  const { plan: planDuDepart, toursFiges, reservesImposees } = depart;
  for (const proposition of propositions) {
    assert.deepStrictEqual(
      regenerer(configuration, { ...proposition, depart: 1, toursFiges }, { planDuDepart, reservesImposees }),
      proposition.plan,
      `regenerer, n° ${proposition.id}`,
    );
  }
  return propositions;
}

// Le départ ajusté, par identifiants : le plan de l'état dont part chaque
// descente sous ce départ.
function departAjuste(configuration, depart) {
  const instance = normaliser(configuration);
  return planDepuisIndex(instance, creerEtatDuDepart(instance, depart).tableDe);
}

// La table d'un participant à un tour d'un plan par identifiants, null hors
// de toute table.
function tableAu(plan, participant, tour) {
  const i = plan.tours[tour - 1].findIndex((liste) => liste.includes(participant));
  return i === -1 ? null : plan.tables[i];
}

// Les listes d'un tour, chacune triée : la comparaison ne lit pas l'ordre
// d'une liste.
const tourTrie = (plan, tour) => plan.tours[tour - 1].map((liste) => [...liste].sort((a, b) => a - b));

// departSalle, retouché par modifier.
const departRetouche = (modifier) => {
  const plan = departSalle();
  modifier(plan);
  return plan;
};

describe('repartir : le départ ajusté à la présence (§ 5.7)', () => {
  test("un absent assis au départ est ignoré ; un tour figé garde le reste, sa chaise libre", () => {
    const configuration = avecPresences(salleReservee(), { 9: [2, 3] });
    const plan = departSalle();
    for (const toursFiges of [[], [1], [2]]) {
      for (const proposition of sousLeDepart(configuration, { plan, toursFiges })) {
        assert.deepEqual(fautesDuPlan(configuration, proposition.plan), [], `figés ${toursFiges}`);
        if (toursFiges.includes(1)) assert.deepEqual(tourTrie(proposition.plan, 1), [[2, 4, 5, 6], [1, 7, 8], [3]]);
        if (toursFiges.includes(2)) assert.deepEqual(tourTrie(proposition.plan, 2), tourTrie(plan, 2));
      }
    }
  });

  test('un exclu assis au départ est ignoré, à chaque tour, figé ou non', () => {
    const configuration = salleReservee();
    configuration.participants[8].exclu = true;
    const plan = departSalle();
    for (const toursFiges of [[], [1], [1, 3]]) {
      for (const proposition of sousLeDepart(configuration, { plan, toursFiges })) {
        assert.deepEqual(fautesDuPlan(configuration, proposition.plan), [], `figés ${toursFiges}`);
        if (toursFiges.includes(1)) assert.deepEqual(tourTrie(proposition.plan, 1), [[2, 4, 5, 6], [1, 7, 8], [3]]);
        if (toursFiges.includes(3)) assert.deepEqual(tourTrie(proposition.plan, 3), [[2, 5, 7], [1, 4, 6], [3, 8]]);
      }
    }
  });

  test("un exclu listé en réserve au départ, seul ou en plus de sa table, est ignoré : le départ rend ce que rend le plan qui l'assied", () => {
    const configuration = salleReservee();
    configuration.participants[8].exclu = true;
    for (const [nom, plan] of [
      ['en réserve seulement', departRetouche((p) => { p.tours[0][2] = [3]; p.reserves[0] = [9]; })],
      ['à sa table et en réserve', departRetouche((p) => { p.reserves[0] = [9]; })],
    ]) {
      for (const toursFiges of [[], [1]]) {
        assert.deepStrictEqual(
          sousLeDepart(configuration, { plan, toursFiges }),
          sousLeDepart(configuration, { plan: departSalle(), toursFiges }),
          `${nom}, figés ${toursFiges}`,
        );
      }
    }
  });

  test("un identifiant inconnu (supprimé) est ignoré, listé une fois ou deux, même à une table pleine, ou en réserve : le départ rend ce que rend le même plan sans lui", () => {
    const configuration = salleReservee();
    for (const [nom, plan] of [
      ['une fois', departRetouche((p) => { p.tours[0][2] = [3, 9, 42]; })],
      ['deux fois', departRetouche((p) => { p.tours[0][0] = [2, 4, 5, 6, 42]; p.tours[0][2] = [3, 9, 42]; })],
      ['en réserve seulement', departRetouche((p) => { p.reserves[0] = [42]; })],
      ['à une table et en réserve', departRetouche((p) => { p.tours[0][2] = [3, 9, 42]; p.reserves[0] = [42]; })],
    ]) {
      for (const toursFiges of [[], [1]]) {
        const propositions = sousLeDepart(configuration, { plan, toursFiges });
        assert.deepStrictEqual(propositions, sousLeDepart(configuration, { plan: departSalle(), toursFiges }), `${nom}, figés ${toursFiges}`);
        for (const proposition of propositions) {
          assert.deepEqual(fautesDuPlan(configuration, proposition.plan), []);
          if (toursFiges.includes(1)) assert.deepEqual(tourTrie(proposition.plan, 1), tourTrie(departSalle(), 1));
        }
      }
    }
  });

  test("une arrivante libre d'un tour non figé part du siège canonique, la première place libre dans l'ordre des sièges, puis la proposition l'assied", () => {
    const configuration = salleReservee();
    // Au tour 2, 9 n'est plus assise : les tables 10 et 20 gardent chacune une
    // place, et la table 10 vient la première.
    const sansElle = departRetouche((p) => { p.tours[1][1] = [1, 4]; });
    const aLaPremiere = departRetouche((p) => { p.tours[1][0] = [2, 3, 7, 9]; p.tours[1][1] = [1, 4]; });
    for (const toursFiges of [[], [1], [3]]) {
      assert.equal(tableAu(departAjuste(configuration, { plan: sansElle, toursFiges }), 9, 2), 10, `figés ${toursFiges}`);
      const propositions = sousLeDepart(configuration, { plan: sansElle, toursFiges });
      assert.deepStrictEqual(propositions, sousLeDepart(configuration, { plan: aLaPremiere, toursFiges }), `figés ${toursFiges}`);
      for (const proposition of propositions) assert.deepEqual(fautesDuPlan(configuration, proposition.plan), []);
    }
  });

  // Au tour 2, 6 (organisation A) n'est plus assise ; la table 10 est pleine,
  // les tables 20 et 30 gardent chacune une place. La table 20, la première
  // dans l'ordre des sièges, assied 1, de A ; la table 30 assied deux B.
  const departSansSix = () => departRetouche((p) => { p.tours[1] = [[2, 3, 4, 7], [1, 9], [5, 8]]; });
  const avecSixA = (plan, table) => {
    const copie = structuredClone(plan);
    copie.tours[1][copie.tables.indexOf(table)].push(6);
    return copie;
  };

  test("une arrivante libre d'un tour figé prend la meilleure chaise libre : la table sans collègue plutôt que la première", () => {
    const configuration = salleReservee();
    const instance = normaliser(configuration);
    const { ORDRE_DU_SCORE } = ordresDe(instance);
    const plan = departSansSix();
    // La chaise de la table 30 vaut mieux, dans l'ordre du score, que la
    // canonique, à la table 20.
    assert.ok(comparerDans(ORDRE_DU_SCORE, scoreDuPlan(instance, avecSixA(plan, 30)), scoreDuPlan(instance, avecSixA(plan, 20))) < 0);
    for (const toursFiges of [[2], [1, 2]]) {
      assert.equal(tableAu(departAjuste(configuration, { plan, toursFiges }), 6, 2), 30, `figés ${toursFiges}`);
      for (const proposition of sousLeDepart(configuration, { plan, toursFiges })) {
        assert.deepEqual(tourTrie(proposition.plan, 2), [[2, 3, 4, 7], [1, 9], [5, 6, 8]], `figés ${toursFiges}`);
        assert.deepEqual(fautesDuPlan(configuration, proposition.plan), []);
      }
    }
    // Au tour non figé, le siège canonique suffit : la recherche la déplacera.
    assert.equal(tableAu(departAjuste(configuration, { plan, toursFiges: [] }), 6, 2), 20);
  });

  test("sans meilleure chaise, l'arrivante prend la première table à égalité, ici celle de son siège canonique ; une collègue l'en écarte", () => {
    // Trois tables de 2, quatre personnes, deux tours, sans contrainte. Au
    // tour 1, figé, 4 arrive ; 1 et 2 sont seules à leur table, et jouent le
    // même rôle au tour 2 : les deux chaises se valent, la table 3, où 4
    // retrouverait 3, vaut moins.
    const tables = [
      { id: 1, capacite: 2 },
      { id: 2, capacite: 2 },
      { id: 3, capacite: 2 },
    ];
    const plan = { tables: [1, 2, 3], tours: [[[1], [2], [3]], [[1, 2], [3, 4], []]], reserves: [[], []] };
    const avecQuatre = (i) => {
      const copie = structuredClone(plan);
      copie.tours[0][i].push(4);
      return copie;
    };
    const egales = configurationDe({ organisations: [null, null, null, null], tables, tours: 2 });
    const instance = normaliser(egales);
    const { ORDRE_DU_SCORE } = ordresDe(instance);
    const [a1, a2, a3] = [0, 1, 2].map((i) => scoreDuPlan(instance, avecQuatre(i)));
    assert.equal(comparerDans(ORDRE_DU_SCORE, a1, a2), 0);
    assert.ok(comparerDans(ORDRE_DU_SCORE, a1, a3) < 0);
    assert.equal(tableAu(departAjuste(egales, { plan, toursFiges: [1] }), 4, 1), 1);
    // 1 et 4 de même organisation, séparation cochée : la table 2 l'emporte.
    const collegues = configurationDe({
      organisations: ['A', null, null, 'A'],
      tables,
      tours: 2,
      contraintes: { ...SANS_CONTRAINTE, separerOrganisations: true },
    });
    assert.equal(tableAu(departAjuste(collegues, { plan, toursFiges: [1] }), 4, 1), 2);
    for (const proposition of sousLeDepart(collegues, { plan, toursFiges: [1] })) {
      assert.deepEqual(proposition.plan.tours[0], [[1], [2, 4], [3]]);
    }
  });

  test("deux arrivantes au même tour figé : la seconde prend la première table à égalité, avant celle de son siège canonique", () => {
    // Six personnes sans organisation, tables 1 et 2 de 2 places, table 3 de
    // 3 places, deux tours, le tour 1 figé. Au tour 1, 4 et 5 arrivent, leurs
    // sièges canoniques aux tables 1 et 2. 4 part à la table 3 ; pour 5, les
    // tables 1 et 2 se valent, et la table 1 vient la première.
    const configuration = configurationDe({
      organisations: Array(6).fill(null),
      tables: [
        { id: 1, capacite: 2 },
        { id: 2, capacite: 2 },
        { id: 3, capacite: 3 },
      ],
      tours: 2,
    });
    const plan = { tables: [1, 2, 3], tours: [[[1], [2], [3, 6]], [[1, 4], [2, 3], [5, 6]]], reserves: [[], []] };
    const instance = normaliser(configuration);
    const { ORDRE_DU_SCORE } = ordresDe(instance);
    const avecCinq = (i) => {
      const copie = structuredClone(plan);
      copie.tours[0][2].push(4);
      copie.tours[0][i].push(5);
      return copie;
    };
    assert.equal(comparerDans(ORDRE_DU_SCORE, scoreDuPlan(instance, avecCinq(0)), scoreDuPlan(instance, avecCinq(1))), 0);
    const attendu = [[1, 5], [2], [3, 4, 6]];
    assert.deepEqual(tourTrie(departAjuste(configuration, { plan, toursFiges: [1] }), 1), attendu);
    for (const proposition of sousLeDepart(configuration, { plan, toursFiges: [1] })) {
      assert.deepEqual(tourTrie(proposition.plan, 1), attendu);
    }
  });

  test("une arrivante fixée d'un tour figé reste à sa table réservée, même quand une place fantôme ailleurs vaudrait mieux", () => {
    // Deux tables de 2, trois personnes, deux tours, le tour 1 figé. 2,
    // collègue de 1, est réservée à la table 1 au tour 1, où le départ ne
    // l'assied pas : la table 2, sans collègue, vaudrait mieux.
    const configuration = configurationDe({
      organisations: ['A', 'A', null],
      tables: [
        { id: 1, capacite: 2 },
        { id: 2, capacite: 2 },
      ],
      tours: 2,
      reservations: [auTour(2, 1, 1)],
      contraintes: { ...SANS_CONTRAINTE, separerOrganisations: true },
    });
    const plan = { tables: [1, 2], tours: [[[1], [3]], [[1, 3], [2]]], reserves: [[], []] };
    const instance = normaliser(configuration);
    const { ORDRE_DU_SCORE } = ordresDe(instance);
    const sonTour = (tour) => ({ ...plan, tours: [tour, plan.tours[1]] });
    assert.ok(comparerDans(ORDRE_DU_SCORE, scoreDuPlan(instance, sonTour([[1], [2, 3]])), scoreDuPlan(instance, sonTour([[1, 2], [3]]))) < 0);
    assert.deepEqual(tourTrie(departAjuste(configuration, { plan, toursFiges: [1] }), 1), [[1, 2], [3]]);
    for (const proposition of sousLeDepart(configuration, { plan, toursFiges: [1] })) {
      assert.deepEqual(tourTrie(proposition.plan, 1), [[1, 2], [3]]);
      assert.deepEqual(fautesDuPlan(configuration, proposition.plan), []);
    }
  });

  test("une arrivante libre d'un tour figé prend la meilleure chaise libre même à une table qui en a deux : la première place fantôme de la table", () => {
    // departSansSix, 5 absente au tour 2 : la table 30 n'y assied que 8, et
    // garde deux places ; la table 20 assied 1, collègue de 6.
    const configuration = avecPresences(salleReservee(), { 5: [1, 3] });
    const instance = normaliser(configuration);
    const { ORDRE_DU_SCORE } = ordresDe(instance);
    const plan = departRetouche((p) => { p.tours[1] = [[2, 3, 4, 7], [1, 9], [8]]; });
    assert.ok(comparerDans(ORDRE_DU_SCORE, scoreDuPlan(instance, avecSixA(plan, 30)), scoreDuPlan(instance, avecSixA(plan, 20))) < 0);
    for (const toursFiges of [[2], [1, 2]]) {
      assert.equal(tableAu(departAjuste(configuration, { plan, toursFiges }), 6, 2), 30, `figés ${toursFiges}`);
      for (const proposition of sousLeDepart(configuration, { plan, toursFiges })) {
        assert.deepEqual(tourTrie(proposition.plan, 2), [[2, 3, 4, 7], [1, 9], [6, 8]], `figés ${toursFiges}`);
        assert.deepEqual(fautesDuPlan(configuration, proposition.plan), []);
      }
    }
  });

  test("aux tours non figés, une arrivante réservée à une table pleine de libres fait passer le libre de plus grand index à asseoir, ailleurs ; le plus petit ne bouge pas", () => {
    const configuration = salleReservee();
    // Au tour 3, 3 (réservée à 30) n'est plus assise, et 30 est pleine de
    // libres : 5, 8 et 9.
    const plan = departRetouche((p) => { p.tours[2] = [[2, 7], [1, 4, 6], [5, 8, 9]]; });
    const neufCede = departRetouche((p) => { p.tours[2] = [[2, 7], [1, 4, 6], [3, 5, 8]]; });
    const cinqCede = departRetouche((p) => { p.tours[2] = [[2, 7], [1, 4, 6], [3, 8, 9]]; });
    for (const toursFiges of [[], [1], [2]]) {
      const ajuste = departAjuste(configuration, { plan, toursFiges });
      assert.deepEqual(tourTrie(ajuste, 3), [[2, 7, 9], [1, 4, 6], [3, 5, 8]], `figés ${toursFiges}`);
      assert.notDeepStrictEqual(tourTrie(departAjuste(configuration, { plan: cinqCede, toursFiges }), 3), tourTrie(ajuste, 3));
      const propositions = sousLeDepart(configuration, { plan, toursFiges });
      assert.deepStrictEqual(propositions, sousLeDepart(configuration, { plan: neufCede, toursFiges }), `figés ${toursFiges}`);
      for (const proposition of propositions) assert.deepEqual(fautesDuPlan(configuration, proposition.plan), []);
    }
  });

  test('une présente en réserve au départ est à asseoir, comme une présente omise, figé ou non', () => {
    const configuration = salleReservee();
    const enReserve = departRetouche((p) => { p.tours[0][2] = [3]; p.reserves[0] = [9]; });
    const omise = departRetouche((p) => { p.tours[0][2] = [3]; });
    for (const toursFiges of [[], [1], [2]]) {
      const propositions = sousLeDepart(configuration, { plan: enReserve, toursFiges });
      assert.deepStrictEqual(propositions, sousLeDepart(configuration, { plan: omise, toursFiges }), `figés ${toursFiges}`);
      for (const proposition of propositions) assert.deepEqual(fautesDuPlan(configuration, proposition.plan), []);
      if (toursFiges.includes(1)) assert.equal(tableAu(propositions[0].plan, 9, 1), 30);
    }
  });

  test("une absente rangée en réserve au départ est ignorée : ni assise, ni en réserve", () => {
    const configuration = avecPresences(salleReservee(), { 9: [2, 3] });
    const enReserve = departRetouche((p) => { p.tours[0][2] = [3]; p.reserves[0] = [9]; });
    const omise = departRetouche((p) => { p.tours[0][2] = [3]; });
    for (const toursFiges of [[], [1]]) {
      const propositions = sousLeDepart(configuration, { plan: enReserve, toursFiges });
      assert.deepStrictEqual(propositions, sousLeDepart(configuration, { plan: omise, toursFiges }), `figés ${toursFiges}`);
      for (const proposition of propositions) assert.deepEqual(fautesDuPlan(configuration, proposition.plan), []);
    }
  });

  test('une fixée que le départ n\'assied pas est assise à sa table, sans refus', () => {
    const configuration = salleReservee();
    // 4 est réservée à la table 10 au tour 1.
    const plan = departRetouche((p) => { p.tours[0][0] = [2, 5, 6]; });
    for (const toursFiges of [[], [1], [2]]) {
      assert.equal(tableAu(departAjuste(configuration, { plan, toursFiges }), 4, 1), 10);
      for (const proposition of sousLeDepart(configuration, { plan, toursFiges })) {
        assert.equal(tableAu(proposition.plan, 4, 1), 10, `figés ${toursFiges}`);
        assert.deepEqual(fautesDuPlan(configuration, proposition.plan), []);
      }
    }
  });

  test("sous arrivantes et absentes, une dérivée rend son départ ajusté case pour case, ou un plan strictement meilleur dans l'ordre du score", () => {
    const configuration = avecPresences(salleReservee(), { 5: [1, 2] });
    const instance = normaliser(configuration);
    const { ORDRE_DU_SCORE } = ordresDe(instance);
    const plan = departRetouche((p) => { p.tours[1][1] = [1, 4]; });
    let meilleures = 0;
    for (const toursFiges of [[], [1]]) {
      const ajuste = departAjuste(configuration, { plan, toursFiges });
      const auDepart = scoreDuPlan(instance, ajuste);
      for (const arret of [1, 30, 600]) {
        for (const proposition of repartir(configuration, { graine: 2, arret, nombre: 2, historique: 20 }, { plan, toursFiges })) {
          const signe = comparerDans(ORDRE_DU_SCORE, scoreDuPlan(instance, proposition.plan), auDepart);
          assert.ok(signe <= 0, `figés ${toursFiges}, arret ${arret}, n° ${proposition.id}`);
          if (signe === 0) assert.deepStrictEqual(proposition.plan, ajuste);
          else meilleures += 1;
        }
      }
    }
    assert.ok(meilleures >= 2, `${meilleures} meilleures`);
  });

  test("tous les tours figés sauf un, sous un départ ajusté optimal, la dérivée le rend : petite démonstration, 12 absente au tour 4, 1 arrivante au tour 2", () => {
    const configuration = avecPresences(demo('petite'), { 12: [1, 2, 3] });
    const plan = structuredClone(PLAN_PARFAIT_PETITE);
    plan.tours[1][3] = [4, 7];
    const attendu = structuredClone(PLAN_PARFAIT_PETITE);
    attendu.tours[3][2] = [3, 4];
    for (const proposition of sousLeDepart(configuration, { plan, toursFiges: [1, 2, 3] }, { graine: 5, arret: 2_000, nombre: 3, historique: 20 })) {
      assert.deepStrictEqual(proposition.plan, attendu, `n° ${proposition.id}`);
    }
  });

  test('le départ brut et le même départ ajusté par le stockage, absents retirés et arrivantes en réserve, rendent les mêmes propositions', () => {
    const configuration = avecPresences(salleReservee(), { 9: [2, 3] });
    // Brut : 9, absente au tour 1, y est encore assise ; 6 n'est plus assise
    // au tour 2. Ajusté : 9 quitte le tour 1, 6 est en réserve au tour 2.
    const brut = departRetouche((p) => { p.tours[1][2] = [5, 8]; });
    const ajuste = departRetouche((p) => { p.tours[0][2] = [3]; p.tours[1][2] = [5, 8]; p.reserves[1] = [6]; });
    for (const toursFiges of [[], [1], [2], [1, 3]]) {
      assert.deepStrictEqual(sousLeDepart(configuration, { plan: brut, toursFiges }), sousLeDepart(configuration, { plan: ajuste, toursFiges }), `figés ${toursFiges}`);
    }
  });

  test("une table qui ne déborde qu'à cause d'une absente est admise, et l'absente n'y est plus", () => {
    const configuration = avecPresences(salleReservee(), { 5: [1, 3] });
    const plan = departRetouche((p) => { p.tours[1][1] = [1, 4, 9, 5]; p.tours[1][2] = [6, 8]; });
    for (const toursFiges of [[], [2]]) {
      for (const proposition of sousLeDepart(configuration, { plan, toursFiges })) {
        assert.deepEqual(fautesDuPlan(configuration, proposition.plan), [], `figés ${toursFiges}`);
        if (toursFiges.includes(2)) assert.deepEqual(tourTrie(proposition.plan, 2), [[2, 3, 7], [1, 4, 9], [6, 8]]);
      }
    }
  });

  // Au tour 3, 3 (réservée à 30) n'est plus assise, et 30 est pleine de
  // libres : 5, 8 et 9.
  const departTableTrenteRemplie = () => departRetouche((p) => { p.tours[2] = [[2, 7], [1, 4, 6], [5, 8, 9]]; });

  test("au tour figé, une réserve imposée y reste ; chaque libre garde sa table, et le tour égale le départ ajusté hors d'elle", () => {
    const configuration = salleReservee();
    const plan = departTableTrenteRemplie();
    const reservesImposees = [{ participant: 3, tour: 3 }];
    for (const toursFiges of [[3], [1, 3]]) {
      const depart = { plan, toursFiges, reservesImposees };
      const ajuste = departAjuste(configuration, depart);
      assert.deepEqual(tourTrie(ajuste, 3), tourTrie(plan, 3));
      assert.deepEqual(ajuste.reserves, [[], [], [3]]);
      for (const proposition of sousLeDepart(configuration, depart)) {
        assert.deepEqual(tourTrie(proposition.plan, 3), tourTrie(plan, 3), `figés ${toursFiges}`);
        assert.deepEqual(proposition.plan.reserves, [[], [], [3]]);
        assert.deepEqual(fautesDuPlan(configuration, proposition.plan, reservesImposees), []);
      }
    }
  });

  test("au tour figé, une arrivante fixée à une table pleine de libres, sans réserve imposée, la fait déborder : DEPART_INCOMPATIBLE, avant tout calcul", () => {
    const configuration = salleReservee();
    const plan = departTableTrenteRemplie();
    const appels = [];
    const progression = () => appels.push(1);
    const reglages = { graine: 1, arret: 1_000, nombre: 2 };
    const details = { tour: 3, table: 30, participant: null };
    for (const toursFiges of [[3], [2, 3]]) {
      for (const appel of [
        () => repartir(configuration, reglages, { plan, toursFiges }, { progression }),
        () => repartirUne(configuration, reglages, { plan, toursFiges, reservesImposees: [] }, 2, { progression }),
        () => regenerer(configuration, { graine: 5, arret: 1_000, historique: 30, depart: 1, toursFiges }, { planDuDepart: plan }),
      ]) {
        assert.throws(appel, { name: 'ErreurConfiguration', code: 'DEPART_INCOMPATIBLE', details }, `figés ${toursFiges}`);
      }
    }
    assert.deepEqual(appels, []);
  });

  test("une réserve imposée hors d'un tour figé, d'une absente, d'un inconnu, d'une personne assise au départ, ou une liste mal formée : RangeError qui nomme reservesImposees, avant tout calcul", () => {
    const base = salleReservee();
    // 3 et 7 ne sont plus assises au tour 3, 9 ne l'est plus au tour 2.
    const plan = departRetouche((p) => { p.tours[1][1] = [1, 4]; p.tours[2] = [[2], [1, 4, 6], [5, 8, 9]]; });
    const reglages = { graine: 1, arret: 1_000, nombre: 2 };
    const absente = avecPresences(base, { 3: [1, 2] });
    const e = (participant, tour) => ({ participant, tour });
    const cas = [
      ['un tour non figé', base, [3], [e(9, 2)]],
      ['une absente', absente, [3], [e(3, 3)]],
      ['un identifiant inconnu', base, [3], [e(42, 3)]],
      ['une personne assise au départ', base, [3], [e(5, 3)]],
      ['deux entrées dans le désordre', base, [3], [e(7, 3), e(3, 3)]],
      ['une entrée répétée', base, [3], [e(3, 3), e(3, 3)]],
      ['des tours dans le désordre', base, [2, 3], [e(3, 3), e(9, 2)]],
      ['un tour qui n\'est pas un entier', base, [3], [e(3, '3')]],
      ['une entrée nulle', base, [3], [null]],
      ['un objet au lieu d\'une liste', base, [3], e(3, 3)],
    ];
    for (const [nom, configuration, toursFiges, reservesImposees] of cas) {
      const appels = [];
      const progression = () => appels.push(1);
      const depart = { plan, toursFiges, reservesImposees };
      for (const appel of [
        () => repartir(configuration, reglages, depart, { progression }),
        () => repartirUne(configuration, reglages, depart, 2, { progression }),
        () => regenerer(configuration, { graine: 5, arret: 1_000, historique: 30, depart: 1, toursFiges }, { planDuDepart: plan, reservesImposees }),
      ]) {
        assert.throws(appel, { name: 'RangeError', reglage: 'reservesImposees' }, nom);
      }
      assert.deepEqual(appels, [], nom);
    }
    // Les mêmes entrées, bien formées, sont admises.
    for (const [toursFiges, reservesImposees] of [[[3], [e(3, 3), e(7, 3)]], [[2, 3], [e(9, 2), e(3, 3)]]]) {
      for (const proposition of sousLeDepart(base, { plan, toursFiges, reservesImposees })) {
        assert.deepEqual(fautesDuPlan(base, proposition.plan, reservesImposees), [], `figés ${toursFiges}`);
      }
    }
    // Sans départ, regenerer refuse une réserve imposée au lieu de l'ignorer.
    const [proposition] = rechercher(base, { graine: 4, arret: 50, nombre: 1 });
    assert.throws(() => regenerer(base, proposition, { reservesImposees: [e(3, 3)] }), { name: 'RangeError', reglage: 'reservesImposees' });
    assert.deepStrictEqual(regenerer(base, proposition, { reservesImposees: [] }), proposition.plan);
  });

  test('sous une réserve imposée, regenerer égale repartir octet pour octet, à chaque point de relevé', () => {
    const configuration = salleReservee();
    const planDuDepart = departTableTrenteRemplie();
    const reservesImposees = [{ participant: 3, tour: 3 }];
    const toursFiges = [3];
    const [proposition] = repartir(configuration, { graine: 9, arret: 1_500, nombre: 1, historique: 25 }, { plan: planDuDepart, toursFiges, reservesImposees });
    assert.deepEqual(proposition.releves.map(({ mouvements }) => mouvements), [1, 10, 100, 1_000]);
    const fichier = { ...proposition, depart: 4, toursFiges };
    for (const releve of proposition.releves) {
      assert.deepStrictEqual(releve.plan, regenerer(configuration, { ...fichier, arret: releve.mouvements }, { planDuDepart, reservesImposees }), `point ${releve.mouvements}`);
    }
    assert.deepStrictEqual(proposition.plan, regenerer(configuration, fichier, { planDuDepart, reservesImposees }));
  });
});

// Huit personnes, trois tables (la 1 de deux places, la 2 et la 3 de trois),
// trois tours, objectifs et animateurs cochés. Au tour 2, les deux places de
// la table 1 sont réservées à 2 et à 3, et 4, réservée à la table 3, y anime.
// 3 l'est aussi à la table 1 au tour 1. La table 1 porte l'objectif « x »
// pour la soirée, que 7 porte. 2, de B, nomme A : les deux organisations
// sont en conflit. 2 n'est présente qu'au tour 2, où sa table n'a aucun
// siège libre : 7, qui inclut B, ne peut rencontrer que 6 dans un plan qui
// honore les réservations, et rencontre pourtant 2 au siège fixé que laisse
// 3. 7 et 8 s'incluent l'un l'autre, et 6 inclut 3.
const soireeAReservesImposees = () => ({
  participants: Array.from({ length: 8 }, (_, rang) => ({
    id: rang + 1,
    organisation: ['A', 'B', null, 'A'][rang % 4],
    ...(rang + 1 === 7 ? { etiquettes: ['x'], inclusionsOrganisation: ['B'], inclusionsParticipant: [8] } : {}),
    ...(rang + 1 === 4 ? { anime: [2] } : {}),
    ...(rang + 1 === 2 ? { conflits: ['A'], presence: [2] } : {}),
    ...(rang + 1 === 8 ? { inclusionsParticipant: [7] } : {}),
    ...(rang + 1 === 6 ? { inclusionsParticipant: [3] } : {}),
  })),
  tables: [
    { id: 1, numero: 1, capacite: 2 },
    { id: 2, numero: 2, capacite: 3 },
    { id: 3, numero: 3, capacite: 3 },
  ],
  tours: 3,
  reservations: [auTour(2, 1, 2), auTour(3, 1, 2), auTour(3, 1, 1), auTour(4, 3, 2)],
  contraintes: { ...TOUTES_CONTRAINTES, respecterObjectifs: true, rencontrerAnimateurs: true },
  objectifs: [{ table: 1, tour: null, regle: 'ou', etiquettes: ['x'] }],
});

// Son départ : au tour 2, ni 3 ni 4 ne sont assises, et 7, libre, l'est à la
// table 1, qui n'a aucun siège mobile ; au tour 3, 3, libre, revient à la
// table 1.
const departAReservesImposees = () => ({
  tables: [1, 2, 3],
  tours: [
    [[3, 5], [1, 2, 6], [4, 7, 8]],
    [[2, 7], [1, 5, 6], [8]],
    [[3, 6], [4, 5, 8], [1, 2, 7]],
  ],
  reserves: [[], [], []],
});

describe('repartir : une réserve imposée se mesure comme indicateurs.js la lit (§ 5.10)', () => {
  test("le score tenu à jour égale le recalcul au départ et après 2 000 mouvements : retours d'une fixée en réserve, animatrice en réserve, libre assis au siège fixé d'une table sans siège mobile", () => {
    const configuration = soireeAReservesImposees();
    const instance = normaliser(configuration);
    assert.ok(instance.etatCriteres.every(({ coche, sansObjet }) => coche && !sansObjet));
    const reservesImposees = [{ participant: 3, tour: 2 }, { participant: 4, tour: 2 }];
    const etat = creerEtatDuDepart(instance, { plan: departAReservesImposees(), toursFiges: [2], reservesImposees });
    const { R, indexDe } = instance;
    assert.equal(etat.tableDe[indexDe.get(3) * R + 1], RESERVE);
    assert.equal(etat.tableDe[indexDe.get(4) * R + 1], RESERVE);
    assert.equal(etat.tableDe[indexDe.get(7) * R + 1], 0);
    assert.deepStrictEqual(scoreIncremental(etat), scoreComplet(etat), 'au départ');
    const rng = creerPcg32(11, FLUX.RECHERCHE);
    let appliques = 0;
    for (let i = 1; i <= 2_000; i += 1) {
      if (proposerParmi(etat, rng, [0, 2]) !== null) appliques += 1;
      if (i % 200 === 0) assert.deepStrictEqual(scoreIncremental(etat), scoreComplet(etat), `pas ${i}`);
    }
    assert.ok(appliques > 500, `${appliques} mouvements appliqués`);
  });

  test("creerEtatDuDepart contrôle le départ comme repartir, et porte la composition de l'instance", () => {
    const instance = normaliser(salleReservee());
    const etat = creerEtatDuDepart(instance, { plan: departSalle(), toursFiges: [2] });
    assert.deepStrictEqual(planDepuisIndex(instance, etat.tableDe), departSalle());
    assert.equal(etat.composition.taille, scoreIncremental(etat).length);
    assert.throws(() => creerEtatDuDepart(instance, { plan: departSalle(), toursFiges: [1, 2, 3] }), { name: 'RangeError', reglage: 'toursFiges' });
    assert.throws(() => creerEtatDuDepart(instance, { plan: departSalle(), toursFiges: [], reservesImposees: [{ participant: 3, tour: 3 }] }), {
      name: 'RangeError',
      reglage: 'reservesImposees',
    });
  });

  test("une place fantôme qui précède une personne à sa table ne compte aucun conflit d'organisation au départ", () => {
    // 1, du Rameau, est réservée à la table 10 au tour 1 ; 2, du Tilleul,
    // nomme le Rameau ; 3 n'a pas d'organisation. Au tour 1, figé, 1 est en
    // réserve imposée : son siège fixé, le premier de la table 10, reste une
    // place fantôme, et 2 s'assied au siège mobile qui le suit. Au tour 2,
    // 1 et 2 sont à des tables différentes : aucun conflit, à aucun tour.
    const configuration = configurationDe({
      organisations: ['Rameau', 'Tilleul', null],
      tables: [{ id: 10, capacite: 2 }, { id: 20, capacite: 2 }],
      tours: 2,
      reservations: [auTour(1, 10, 1)],
    });
    configuration.participants[1].conflits = ['Rameau'];
    const instance = normaliser(configuration);
    assert.ok(compose(instance, 'conflitsOrganisation'));
    const plan = { tables: [10, 20], tours: [[[2], [3]], [[1, 3], [2]]], reserves: [[], []] };
    const etat = creerEtatDuDepart(instance, { plan, toursFiges: [1], reservesImposees: [{ participant: 1, tour: 1 }] });
    const { indexDe } = instance;
    assert.deepEqual(Array.from(etat.siege.subarray(0, 2)), [-1, indexDe.get(2)], 'la place fantôme précède 2');
    assert.equal(etat.conflitsOrganisation, 0);
    assert.equal(mesurer(instance, etat.tableDe).conflitsOrganisation, 0);
    assert.deepStrictEqual(scoreIncremental(etat), scoreComplet(etat));
  });
});

// Vrai quand le critère nom est coché et a un objet dans l'instance : le
// n-uplet le compose.
const compose = (instance, nom) => instance.etatCriteres.some((critere) => critere.nom === nom && critere.coche && !critere.sansObjet);

describe('repartir : le départ ajusté, case par case et siège par siège (§ 5.7)', () => {
  test("une réserve imposée au tour 0 n'est à aucun tour figé : RangeError qui nomme reservesImposees", () => {
    const instance = normaliser(salleReservee());
    assert.throws(
      () => creerEtatDuDepart(instance, { plan: departSalle(), toursFiges: [1], reservesImposees: [{ participant: 9, tour: 0 }] }),
      { name: 'RangeError', reglage: 'reservesImposees', message: 'reservesImposees : tour figé attendu, reçu 0' },
    );
  });

  test("une absente listée deux fois en réserve est ignorée ; une présente en réserve, à côté d'une assise, est à asseoir", () => {
    // Deux tables de 3, cinq personnes, deux tours ; 4 est absente au tour 2.
    // Au tour 2, la réserve liste 3, présente, puis deux fois 4.
    const configuration = avecPresences(configurationDe({
      organisations: Array(5).fill(null),
      tables: [
        { id: 1, capacite: 3 },
        { id: 2, capacite: 3 },
      ],
      tours: 2,
    }), { 4: [1] });
    const plan = { tables: [1, 2], tours: [[[1, 2, 3], [4, 5]], [[1, 2], [5]]], reserves: [[], [3, 4, 4]] };
    // 3 prend la première place libre du tour 2, à la table 1.
    const attendu = { tables: [1, 2], tours: [[[1, 2, 3], [4, 5]], [[1, 2, 3], [5]]], reserves: [[], []] };
    for (const toursFiges of [[], [1]]) {
      const ajuste = departAjuste(configuration, { plan, toursFiges });
      assert.deepEqual([1, 2].map((tour) => tourTrie(ajuste, tour)), attendu.tours, `figés ${toursFiges}`);
      assert.deepEqual(ajuste.reserves, attendu.reserves, `figés ${toursFiges}`);
    }
  });

  test("aux tours non figés, deux arrivantes fixées font passer à asseoir les deux libres de leur table, l'index 0 compris", () => {
    // Tables 10 et 20 de 2, 30 de 3, six personnes, deux tours. Au tour 2, 3
    // et 4 sont réservées à la table 20, où le départ assied 1 et 5 : 5 puis
    // 1 passent à asseoir ; assises ensuite par index croissant, 1 prend la
    // première place libre, à la table 10, et 5 la suivante, à la table 30.
    // 6, à la table 30, ne bouge pas.
    const configuration = configurationDe({
      organisations: Array(6).fill(null),
      tables: [
        { id: 10, capacite: 2 },
        { id: 20, capacite: 2 },
        { id: 30, capacite: 3 },
      ],
      tours: 2,
      reservations: [auTour(3, 20, 2), auTour(4, 20, 2)],
    });
    const plan = { tables: [10, 20, 30], tours: [[[1, 2], [3, 4], [5, 6]], [[2], [1, 5], [6]]], reserves: [[], [3, 4]] };
    for (const toursFiges of [[], [1]]) {
      const ajuste = departAjuste(configuration, { plan, toursFiges });
      assert.deepEqual(tourTrie(ajuste, 2), [[1, 2], [3, 4], [5, 6]], `figés ${toursFiges}`);
      assert.deepEqual(ajuste.reserves, [[], []], `figés ${toursFiges}`);
    }
    // Au tour figé, le même débordement est refusé.
    assert.throws(() => departAjuste(configuration, { plan, toursFiges: [2] }), {
      name: 'ErreurConfiguration',
      code: 'DEPART_INCOMPATIBLE',
      details: { tour: 2, table: 20, participant: null },
    });
  });

  test('au tour figé, deux arrivantes fixées qui font déborder la première table : DEPART_INCOMPATIBLE sur cette table', () => {
    const configuration = configurationDe({
      organisations: Array(6).fill(null),
      tables: [
        { id: 10, capacite: 2 },
        { id: 20, capacite: 2 },
        { id: 30, capacite: 3 },
      ],
      tours: 2,
      reservations: [auTour(1, 10, 2), auTour(2, 10, 2)],
    });
    const plan = { tables: [10, 20, 30], tours: [[[1, 2], [3, 4], [5, 6]], [[3, 4], [5], [6]]], reserves: [[], [1, 2]] };
    assert.throws(() => departAjuste(configuration, { plan, toursFiges: [2] }), {
      name: 'ErreurConfiguration',
      code: 'DEPART_INCOMPATIBLE',
      details: { tour: 2, table: 10, participant: null },
    });
  });

  test('sous une réserve imposée fixée, le score tenu à jour égale le recalcul : retours de deux fixées, animateurs gardés à la première ligne, à la dernière et à deux par table', () => {
    // Trois tables de 3, huit personnes, deux tours, le tour 2 figé. 1 et 2
    // sont réservées à la table 2 aux deux tours ; 3 anime à la table 1 au
    // tour 1 ; 4 et 5 animent à la table 3 au tour 2 ; 6, réservée à la
    // table 1 au tour 2, y est en réserve imposée.
    const configuration = {
      participants: Array.from({ length: 8 }, (_, rang) => ({
        id: rang + 1,
        organisation: null,
        ...(rang + 1 === 3 ? { anime: [1] } : {}),
        ...(rang + 1 === 4 || rang + 1 === 5 ? { anime: [2] } : {}),
      })),
      tables: [1, 2, 3].map((id) => ({ id, numero: id, capacite: 3 })),
      tours: 2,
      reservations: [tous(1, 2), tous(2, 2), auTour(3, 1, 1), auTour(4, 3, 2), auTour(5, 3, 2), auTour(6, 1, 2)],
      contraintes: { ...TOUTES_CONTRAINTES, rencontrerAnimateurs: true },
    };
    const instance = normaliser(configuration);
    assert.ok(compose(instance, 'rencontresRepetees') && compose(instance, 'animateursNonRencontres'));
    const plan = {
      tables: [1, 2, 3],
      tours: [
        [[3, 6, 7], [1, 2, 8], [4, 5]],
        [[7, 8], [1, 2], [3, 4, 5]],
      ],
      reserves: [[], [6]],
    };
    const etat = creerEtatDuDepart(instance, { plan, toursFiges: [2], reservesImposees: [{ participant: 6, tour: 2 }] });
    assert.deepEqual(planDepuisIndex(instance, etat.tableDe), plan);
    // 1 et 2 visitent deux fois la table 2, où elles sont fixées deux fois :
    // aucun retour choisi. 7, jamais fixée, revient à la table 1 ; 4 et 5,
    // fixées une fois à la table 3, y reviennent : un retour choisi chacune.
    assert.equal(etat.totalRetoursChoisis, 3);
    assert.deepStrictEqual(scoreIncremental(etat), scoreComplet(etat));
  });

  test("sous une réserve imposée, le seuil des retours d'une personne ne compte que ses propres tours fixés", () => {
    // Deux tables de 2, quatre personnes, trois tours. 1 et 2 sont réservées
    // à la table 1 au tour 1 ; 3, réservée à la table 2 au tour 2, y est en
    // réserve imposée. 1 revient à la table 1 au tour 2, où elle n'est pas
    // fixée : un retour choisi, que la fixation de 2 au tour 1, à la même
    // table, n'efface pas. 2 revient à la table 1 au tour 3, 4 à la table 2.
    const configuration = configurationDe({
      organisations: [null, null, null, null],
      tables: [{ id: 1, capacite: 2 }, { id: 2, capacite: 2 }],
      tours: 3,
      reservations: [auTour(1, 1, 1), auTour(2, 1, 1), auTour(3, 2, 2)],
      contraintes: TOUTES_CONTRAINTES,
    });
    const instance = normaliser(configuration);
    assert.ok(compose(instance, 'rencontresRepetees'));
    const plan = {
      tables: [1, 2],
      tours: [
        [[1, 2], [3, 4]],
        [[1, 4], [2]],
        [[2, 3], [1, 4]],
      ],
      reserves: [[], [3], []],
    };
    const etat = creerEtatDuDepart(instance, { plan, toursFiges: [2], reservesImposees: [{ participant: 3, tour: 2 }] });
    assert.deepEqual(planDepuisIndex(instance, etat.tableDe), plan);
    assert.equal(etat.totalRetoursChoisis, 3);
    assert.deepStrictEqual(scoreIncremental(etat), scoreComplet(etat));
  });

  test("une animatrice seule fixée, en réserve imposée au tour 1 ou au tour 2, n'est rencontrée par personne", () => {
    // Deux tables de 3, cinq personnes, deux tours : 1 n'est fixée, à la
    // table 1, qu'au tour qu'elle anime, et ce tour figé la laisse en réserve.
    for (const tour of [1, 2]) {
      const configuration = {
        participants: Array.from({ length: 5 }, (_, rang) => ({ id: rang + 1, organisation: null, ...(rang === 0 ? { anime: [tour] } : {}) })),
        tables: [1, 2].map((id) => ({ id, numero: id, capacite: 3 })),
        tours: 2,
        reservations: [auTour(1, 1, tour)],
        contraintes: { ...TOUTES_CONTRAINTES, rencontrerAnimateurs: true },
      };
      const instance = normaliser(configuration);
      assert.ok(compose(instance, 'animateursNonRencontres'), `tour ${tour}`);
      const sansElle = [[2, 3], [4, 5]];
      const avecElle = [[1, 2, 4], [3, 5]];
      const plan = {
        tables: [1, 2],
        tours: tour === 1 ? [sansElle, avecElle] : [avecElle, sansElle],
        reserves: tour === 1 ? [[1], []] : [[], [1]],
      };
      const etat = creerEtatDuDepart(instance, { plan, toursFiges: [tour], reservesImposees: [{ participant: 1, tour }] });
      assert.deepEqual(planDepuisIndex(instance, etat.tableDe), plan, `tour ${tour}`);
      assert.deepStrictEqual(scoreIncremental(etat), scoreComplet(etat), `tour ${tour}`);
    }
  });

  test("le remplissage canonique, siège par siège : arrivantes aux premières places libres, libres gardés aux prochains sièges mobiles, jamais au siège qu'une réserve imposée laisse quand un siège mobile reste", () => {
    // Deux tables de 3, six personnes, deux tours, le tour 2 figé. Au tour 2,
    // 1 est réservée à la table 1 ; 2 et 3 à la table 2, où 2 est en réserve
    // imposée. Au tour 1, sans fixée, la table 2 assied 1, 2 et 3 ; 4, 5 et
    // 6 arrivent.
    const configuration = configurationDe({
      organisations: Array(6).fill(null),
      tables: [
        { id: 1, capacite: 3 },
        { id: 2, capacite: 3 },
      ],
      tours: 2,
      reservations: [auTour(1, 1, 2), auTour(2, 2, 2), auTour(3, 2, 2)],
    });
    const plan = { tables: [1, 2], tours: [[[], [1, 2, 3]], [[1, 4, 6], [3, 5]]], reserves: [[], [2]] };
    const instance = normaliser(configuration);
    const etat = creerEtatDuDepart(instance, { plan, toursFiges: [2], reservesImposees: [{ participant: 2, tour: 2 }] });
    // Sièges 0 à 2 : la table 1 ; 3 à 5 : la table 2 ; par index, −1 pour
    // une place fantôme. Tour 1 : les arrivantes 4, 5 et 6 aux sièges 0 à 2,
    // dans l'ordre des index ; 1, 2 et 3 aux sièges mobiles de la table 2.
    // Tour 2 : 1 au premier siège de la table 1, puis 4 et 6 à ses sièges
    // mobiles ; à la table 2, le siège de 2 reste vide, 3 garde le sien, et 5
    // prend le siège mobile.
    assert.deepEqual(Array.from(etat.siege), [3, 4, 5, 0, 1, 2, 0, 3, 5, -1, 2, 4]);
  });

  test("deux libres que le départ assied à une table dont les deux fixées sont en réserve imposée y prennent leurs sièges, et n'y sont pas servies", () => {
    // Tables 1 de 3, 2 et 3 de 2, cinq personnes, deux tours, le tour 2
    // figé. 1 et 2 sont réservées à la table 2 au tour 2, et y sont en
    // réserve imposée ; 3 et 4, d'étiquette x, y sont assises. La table 2
    // porte l'objectif x : au tour 2, sans siège libre, elle ne sert
    // personne.
    const configuration = {
      participants: Array.from({ length: 5 }, (_, rang) => ({
        id: rang + 1,
        organisation: null,
        ...(rang + 1 === 3 || rang + 1 === 4 ? { etiquettes: ['x'] } : {}),
      })),
      tables: [
        { id: 1, numero: 1, capacite: 3 },
        { id: 2, numero: 2, capacite: 2 },
        { id: 3, numero: 3, capacite: 2 },
      ],
      tours: 2,
      reservations: [auTour(1, 2, 2), auTour(2, 2, 2)],
      contraintes: { ...TOUTES_CONTRAINTES, respecterObjectifs: true },
      objectifs: [{ table: 2, tour: null, regle: 'ou', etiquettes: ['x'] }],
    };
    const instance = normaliser(configuration);
    assert.ok(compose(instance, 'toursHorsObjectif'));
    const plan = { tables: [1, 2, 3], tours: [[[1, 2, 5], [3, 4], []], [[5], [3, 4], []]], reserves: [[], [1, 2]] };
    const reservesImposees = [{ participant: 1, tour: 2 }, { participant: 2, tour: 2 }];
    const etat = creerEtatDuDepart(instance, { plan, toursFiges: [2], reservesImposees });
    assert.deepEqual(planDepuisIndex(instance, etat.tableDe), plan);
    // Tour 2 : 3 et 4 aux deux sièges de la table 2, 5 au premier de la
    // table 1.
    assert.deepEqual(Array.from(etat.siege.subarray(7)), [4, -1, -1, 2, 3, -1, -1]);
    // Servies au tour 1 seulement, le seul où la table 2 offre un siège.
    assert.deepEqual(Array.from(etat.servis), [0, 0, 1, 1, 0]);
    assert.deepStrictEqual(scoreIncremental(etat), scoreComplet(etat));
  });

  test("au tour figé, une arrivante libre dont la voisine d'index est fixée quitte son siège canonique pour la meilleure table", () => {
    // Trois tables de 2, quatre personnes, deux tours, le tour 2 figé. 2 est
    // réservée à la table 2 au tour 2 ; 3 y arrive, son siège canonique à la
    // table 1, auprès de 1, sa collègue. À la table 3, elle retrouverait 4 :
    // la table 2 l'emporte.
    const configuration = configurationDe({
      organisations: ['A', null, 'A', null],
      tables: [1, 2, 3].map((id) => ({ id, capacite: 2 })),
      tours: 2,
      reservations: [auTour(2, 2, 2)],
      contraintes: { ...SANS_CONTRAINTE, separerOrganisations: true },
    });
    const plan = { tables: [1, 2, 3], tours: [[[1, 2], [3, 4], []], [[1], [2], [4]]], reserves: [[], []] };
    assert.equal(tableAu(departAjuste(configuration, { plan, toursFiges: [] }), 3, 2), 1);
    assert.deepEqual(tourTrie(departAjuste(configuration, { plan, toursFiges: [2] }), 2), [[1], [2, 3], [4]]);
  });

  test('une fixée à la première place de sa table, en réserve imposée au tour 1, la reprend au tour 2', () => {
    const configuration = configurationDe({
      organisations: Array(4).fill(null),
      tables: [
        { id: 1, capacite: 2 },
        { id: 2, capacite: 2 },
      ],
      tours: 2,
      reservations: [tous(1, 1)],
    });
    const plan = { tables: [1, 2], tours: [[[2], [3, 4]], [[1, 2], [3, 4]]], reserves: [[1], []] };
    const ajuste = departAjuste(configuration, { plan, toursFiges: [1], reservesImposees: [{ participant: 1, tour: 1 }] });
    assert.deepEqual([1, 2].map((tour) => tourTrie(ajuste, tour)), plan.tours);
    assert.deepEqual(ajuste.reserves, plan.reserves);
  });
});
