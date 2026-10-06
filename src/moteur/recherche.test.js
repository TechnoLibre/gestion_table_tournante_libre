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
// recalculé égalent un n-uplet recalculé ici par énumération des paires ; la
// petite démonstration atteint son plan parfait sans cas particulier. Un plan
// rendu se juge par verifierInvariants et se mesure par mesurer, deux modules
// distincts du module éprouvé.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { CATALOGUE } from '../demo/catalogue.js';
import { FLUX, creerPcg32 } from '../demo/prng.js';
import {
  LIBRE,
  RESERVE,
  SANS_GROUPE,
  indexerPlan,
  normaliser,
  planDepuisIndex,
} from './configuration.js';
import { ErreurAnnulee } from './erreurs.js';
import { mesurer } from './indicateurs.js';
import { plafondsAPriori } from './plafond.js';
import {
  creerEtat,
  defaire,
  proposerEtAppliquer,
  rechercher,
  regenerer,
  scoreComplet,
  scoreIncremental,
} from './recherche.js';
import { verifierInvariants } from './verification.js';

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

// Le n-uplet du paragraphe « Score » de recherche.js, recalculé par
// énumération directe des
// paires du plan indexé, sans mesurer ni le module éprouvé ; les plafonds a
// priori sont la seule grandeur reçue. Rend aussi les sept grandeurs brutes,
// contraintes ignorées : écart maximal au plafond a priori, somme des carrés
// des écarts, excédent de collisions, collisions cumulées, Σ_paires
// max(0, M − 1), retours choisis, Σ_p r(p).
function scoreOracle(instance, tableDe, aPriori) {
  const { N, T, R, groupe, fixe, contraintes } = instance;
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
  const brutes = [
    Math.max(...ecarts),
    ecarts.reduce((somme, ecart) => somme + ecart * ecart, 0),
    cumulees - distinctes,
    cumulees,
    excedentPaires,
    retours,
    affilies.reduce((somme, f, p) => somme + f - appartenances[p].size, 0),
  ];
  const c = contraintes;
  const nUplet = [
    brutes[0],
    brutes[1],
    c.separerAppartenances ? brutes[2] : 0,
    c.separerAppartenances ? brutes[3] : 0,
    (c.nouveauxVoisins ? brutes[4] : 0) + (c.nouvelleTable ? brutes[5] : 0),
    c.varierAppartenances ? brutes[6] : 0,
  ];
  return { nUplet, brutes };
}

// Ordres de comparaison du n-uplet, par rang de composante : celui du score,
// et celui des contraintes, composantes 2, 3 et 4 devant les deux premières
// (en-tête de recherche.js).
const ORDRE_SCORE = [0, 1, 2, 3, 4, 5];
const ORDRE_CONTRAINTES = [2, 3, 4, 0, 1, 5];
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
// meilleure affectation porte un écart maximal nul ; dans cet ordre, un
// score courant inchangé pendant PATIENCE × L itérations fait repartir la
// descente d'un placement neuf, tiré du même générateur, l'historique à son
// score (en-tête de recherche.js). Rend le plan et trois comptes : bascules,
// relances, et meilleures affectations trouvées après une relance.
function descendreALaLettre(instance, graineDerivee, arret, L, { bascule }) {
  const rng = creerPcg32(graineDerivee, FLUX.RECHERCHE);
  let etat = creerEtat(instance, rng);
  let courant = scoreIncremental(etat);
  let meilleur = courant;
  let meilleurPlan = Int32Array.from(etat.tableDe);
  let H = Array(L).fill(courant);
  let ordre = ORDRE_SCORE;
  let immobile = 0;
  const comptes = { bascules: 0, relances: 0, apresRelance: 0 };
  const basculer = () => {
    if (!bascule || ordre === ORDRE_CONTRAINTES || meilleur[0] !== 0) return;
    ordre = ORDRE_CONTRAINTES;
    comptes.bascules += 1;
  };
  const retenir = () => {
    if (comparerDans(ORDRE_SCORE, courant, meilleur) >= 0) return;
    meilleur = courant;
    meilleurPlan = Int32Array.from(etat.tableDe);
    if (comptes.relances > 0) comptes.apresRelance += 1;
    basculer();
  };
  basculer();
  for (let i = 0; i < arret && courant.some((composante) => composante !== 0); i += 1) {
    if (immobile >= PATIENCE * L && ordre === ORDRE_CONTRAINTES) {
      etat = creerEtat(instance, rng);
      courant = scoreIncremental(etat);
      H = Array(L).fill(courant);
      comptes.relances += 1;
      retenir();
      immobile = 0;
    }
    const mouvement = proposerEtAppliquer(etat, rng);
    let change = false;
    if (mouvement !== null) {
      const candidat = scoreIncremental(etat);
      if (comparerDans(ordre, candidat, courant) <= 0 || comparerDans(ordre, candidat, H[i % L]) <= 0) {
        change = comparerDans(ORDRE_SCORE, candidat, courant) !== 0;
        courant = candidat;
        retenir();
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
      const nonNulles = Array(7).fill(false);
      const confronter = (etiquette) => {
        const { nUplet, brutes } = scoreOracle(instance, etat.tableDe, aPriori);
        assert.deepStrictEqual(scoreComplet(etat), nUplet, `${nom}, ${etiquette} : scoreComplet`);
        assert.deepStrictEqual(scoreIncremental(etat), nUplet, `${nom}, ${etiquette} : scoreIncremental`);
        for (let k = 0; k < brutes.length; k += 1) if (brutes[k] > 0) nonNulles[k] = true;
      };
      confronter('placement initial');
      let appliques = 0;
      for (let essai = 0; appliques < MOUVEMENTS && essai < 100 * MOUVEMENTS; essai += 1) {
        if (proposerEtAppliquer(etat, rng) === null) continue;
        appliques += 1;
        confronter(`${appliques} mouvements`);
      }
      assert.equal(appliques, MOUVEMENTS, nom);
      assert.deepEqual(nonNulles, Array(7).fill(true), `${nom} : grandeurs brutes non nulles`);
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
