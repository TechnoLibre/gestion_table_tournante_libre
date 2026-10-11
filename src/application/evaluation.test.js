// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de la table d'évaluation (§ 5.4, § 5.5, § 5.7, § 8.9, § 12.6,
// § 13.2, § 15.1, § 15.3, § 15.4, § 17) : la mesure qui fait foi, le
// classement, les placements en dérive ou fautifs, les imposés. Les charges
// partent des démonstrations livrées, et leurs propositions s'enregistrent
// par la commande ; les plans construits à la main sont écrits ici, sur la
// petite démonstration au conflit inévitable. La valeur attendue vient des
// fonctions du moteur, sollicitées une seconde fois (§ 19.1). Le classement
// suit l'ordre des priorités et le mode de la charge (A11, A21) ; sous
// chacune des seize combinaisons des quatre cases, son ordre est celui de la
// clé de référence privée des critères que les cases décochées retirent,
// relue sur les grandeurs du fichier des empreintes (contrainte 33).
import assert from 'node:assert/strict';
import {
  CASES,
  CLASSEMENT,
  chargeDeClassement,
  empreintesDuClassement,
  exigerVerification,
  lireEmpreintes,
} from '../../test/empreintes_moteur.js';
import { describe, test } from '../../test/lanceur.js';
import { texteLivre } from '../demo/livrees.js';
import { classer } from '../moteur/classement.js';
import { indexerPlan, normaliser } from '../moteur/configuration.js';
import { compilationDe } from '../moteur/criteres.js';
import { diagnostiquer } from '../moteur/diagnostic.js';
import { ErreurConfiguration } from '../moteur/erreurs.js';
import { mesurer } from '../moteur/indicateurs.js';
import { ecartsAuPlafondAPriori } from '../moteur/manque.js';
import { plafondsAPriori } from '../moteur/plafond.js';
import { rechercher } from '../moteur/recherche.js';
import { analyser, capacite } from '../stockage/document.js';
import { fautes, planDepuisFichier } from '../stockage/placements.js';
import { VERSION } from '../version.genere.js';
import { appliquerCommande } from './commandes.js';
import { configurationDe } from './configuration.js';
import {
  CIBLE_REDONDANCE_PAR_DEFAUT,
  cibleRedondance,
  evaluer,
  premiereDuClassement,
  resumeDuMeilleur,
  resumeDuRetenu,
} from './evaluation.js';

const V1 = VERSION.affichee;

const chargeDemo = (cle) => analyser(texteLivre(cle)).charge;

// La charge, une génération du moteur de plus, enregistrée par la commande.
function generee(charge, reglages) {
  const configuration = configurationDe(charge);
  const propositions = rechercher(configuration, reglages);
  return appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: V1 }).charge;
}

const executer = (charge, nom, args) => appliquerCommande(nom, charge, args).charge;

// Une proposition écrite à la main, sièges non attribués, sur les tables de
// la charge dans leur ordre ; ses listes et réserves telles que données.
function propositionDe(charge, id, tours, reserves = tours.map(() => [])) {
  const participants = charge.participants.filter(({ exclu }) => !exclu).map(({ id: p }) => p);
  return {
    id,
    graine: id,
    arret: 40,
    historique: 1000,
    produitVersion: V1,
    siegesAttribues: false,
    tables: charge.tables.map(({ id: t }) => t),
    capacites: charge.tables.map((table) => capacite(charge, table)),
    tours: tours.length,
    participants,
    placement: tours.map((listes, rang) => ({ sieges: listes.map((liste) => [...liste].sort((a, b) => a - b)), reserve: reserves[rang] })),
  };
}

// Le retenu tiré d'une proposition.
function retenuDe(proposition) {
  const { id, siegesAttribues, tables, capacites, tours, participants, placement } = structuredClone(proposition);
  return { proposition: id, siegesAttribues, tables, capacites, tours, participants, placement };
}

// Gèle en profondeur : evaluer qui modifierait sa charge lèverait.
function figer(valeur) {
  if (valeur !== null && typeof valeur === 'object' && !Object.isFrozen(valeur)) {
    Object.freeze(valeur);
    for (const element of Object.values(valeur)) figer(element);
  }
  return valeur;
}

// Chaque nombre atteint depuis la valeur, à toute profondeur.
function nombres(valeur, trouves = []) {
  if (typeof valeur === 'number') trouves.push(valeur);
  else if (valeur !== null && typeof valeur === 'object') for (const element of Object.values(valeur)) nombres(element, trouves);
  return trouves;
}

// Les plans écrits à la main sur la petite démonstration au conflit
// inévitable — appartenances de tailles 5, 4 et 3 —, nommés par leurs
// collisions (cumulées, distinctes). Les trois premiers ont le même plus
// grand écart au plafond a priori, 3 ; le quatrième garde ensemble, aux
// quatre tours, les personnes 1, 2 et 3, d'appartenances distinctes, et ses
// quatre collisions tombent sur quatre paires.
const PLANS_CONFLIT = [
  {
    nom: '(4, 1)',
    tours: [
      [[2, 3, 10], [6, 8, 9], [4, 7, 12], [1, 5, 11]],
      [[2, 7, 10], [4, 6, 8], [3, 11, 12], [1, 5, 9]],
      [[7, 9, 12], [3, 8, 11], [4, 6, 10], [1, 2, 5]],
      [[2, 7, 10], [3, 8, 9], [6, 11, 12], [1, 4, 5]],
    ],
    collisions: [4, 1],
  },
  {
    nom: '(4, 2)',
    tours: [
      [[2, 6, 10], [3, 8, 9], [7, 11, 12], [1, 4, 5]],
      [[4, 7, 10], [2, 6, 8], [1, 5, 11], [3, 9, 12]],
      [[2, 6, 12], [4, 8, 10], [1, 3, 11], [5, 7, 9]],
      [[2, 3, 12], [4, 8, 10], [1, 6, 9], [5, 7, 11]],
    ],
    collisions: [4, 2],
  },
  {
    nom: '(6, 6)',
    tours: [
      [[3, 4, 12], [7, 8, 9], [2, 6, 10], [1, 5, 11]],
      [[4, 6, 12], [2, 8, 10], [1, 7, 11], [3, 5, 9]],
      [[2, 4, 10], [6, 8, 11], [1, 3, 12], [5, 7, 9]],
      [[2, 7, 10], [5, 6, 8], [9, 11, 12], [1, 3, 4]],
    ],
    collisions: [6, 6],
  },
  {
    nom: 'trio',
    tours: [
      [[1, 2, 3], [6, 9, 10], [7, 11, 12], [4, 5, 8]],
      [[1, 2, 3], [5, 6, 9], [7, 11, 12], [4, 8, 10]],
      [[1, 2, 3], [7, 8, 9], [10, 11, 12], [4, 5, 6]],
      [[1, 2, 3], [7, 8, 9], [6, 10, 11], [4, 5, 12]],
    ],
    collisions: [4, 4],
  },
];

describe("évaluation : la mesure qui fait foi (§ 5.10, § 13.2)", () => {
  test('chaque ligne comparable porte mesurer, les plafonds, les trois chiffres ; le classement est celui de classer', () => {
    const charge = figer(generee(chargeDemo('petite-conflit'), { graine: 5, nombre: 3, arret: 400 }));
    const table = evaluer(charge);
    const instance = normaliser(configurationDe(charge));
    const aPriori = plafondsAPriori(instance);
    assert.deepEqual(table.population, instance.ids);
    assert.equal(table.propositions.length, 3);
    const entrees = [];
    for (const proposition of charge.propositions) {
      const ligne = table.propositions.find(({ id }) => id === proposition.id);
      const mesures = mesurer(instance, indexerPlan(instance, planDepuisFichier(proposition)));
      assert.equal(ligne.statut, 'comparable');
      assert.deepEqual(ligne.raisons, []);
      assert.deepEqual(ligne.violations, []);
      assert.deepEqual(ligne.refusDessin, []);
      assert.deepEqual(ligne.mesures, mesures);
      assert.equal(ligne.plafondsRealises.length, 12);
      assert.equal(ligne.minimumAtteint, false);
      assert.deepEqual(Object.keys(ligne.troisChiffres).sort(), ['ecartItineraireMax', 'effectifManque', 'manqueMax']);
      assert.equal(ligne.ecartAuPlafondAPrioriMax, Math.max(...ecartsAuPlafondAPriori(mesures, aPriori)));
      entrees.push({ id: proposition.id, mesures, plafondsAPriori: aPriori });
    }
    assert.deepEqual(table.classement, classer(entrees));
    assert.deepEqual(table.propositions.map(({ id }) => id), table.classement.ordre);
    assert.equal(table.retenu, null);
  });

  test("trois plans au même premier critère se rangent par l'excédent, puis les cumulées ; le trio vient en dernier", () => {
    const charge = structuredClone(chargeDemo('petite-conflit'));
    charge.propositions = PLANS_CONFLIT.map(({ tours }, rang) => propositionDe(charge, rang + 1, tours));
    charge.prochainsIds.proposition = 5;
    charge.evenement.etat = 'propose';
    const table = evaluer(figer(charge));
    const parId = new Map(table.propositions.map((ligne) => [ligne.id, ligne]));
    PLANS_CONFLIT.forEach(({ nom, collisions }, rang) => {
      const { mesures } = parId.get(rang + 1);
      assert.deepEqual([mesures.collisionsCumulees, mesures.pairesDistinctes], collisions, nom);
    });
    assert.deepEqual([1, 2, 3].map((id) => parId.get(id).ecartAuPlafondAPrioriMax), [3, 3, 3]);
    assert.ok(parId.get(4).ecartAuPlafondAPrioriMax > 3);
    assert.deepEqual(table.classement.ordre, [3, 2, 1, 4]);
    assert.deepEqual(table.classement.criteresAppliques[0].criteres.map(({ nom }) => nom), ['ecartAuPlafondAPrioriMax']);
    for (const ligne of table.propositions) {
      const ecarts = ecartsAuPlafondAPriori(ligne.mesures, plafondsAPriori(normaliser(configurationDe(charge))));
      assert.equal(ligne.ecartAuPlafondAPrioriMax, Math.max(...ecarts));
    }
  });

  test('evaluer ne modifie pas la charge, et deux appels rendent la même table', () => {
    const charge = figer(generee(chargeDemo('petite'), { graine: 2, nombre: 2, arret: 300 }));
    assert.deepEqual(evaluer(charge), evaluer(charge));
  });
});

describe('évaluation : une réservation que le plan ne tient pas (§ 5.8, § 12.6)', () => {
  test("une réservation posée après la génération laisse la ligne comparable et classée, la violation RESERVATION nommée", () => {
    const avant = generee(chargeDemo('petite'), { graine: 1, nombre: 1, arret: 200 });
    const [proposition] = avant.propositions;
    // La table de la personne 1 au premier tour, puis une autre où la réserver.
    const listes = planDepuisFichier(proposition).tours[0];
    const sienne = avant.tables[listes.findIndex((liste) => liste.includes(1))].id;
    const autre = avant.tables.find(({ id }) => id !== sienne).id;
    const charge = executer(avant, 'reserver', { participant: 1, table: autre, siege: null, portee: 'tour', tour: 1 });
    const table = evaluer(figer(charge));
    const [ligne] = table.propositions;
    assert.equal(ligne.id, proposition.id);
    assert.equal(ligne.statut, 'comparable');
    assert.deepEqual(ligne.raisons, []);
    assert.deepEqual(ligne.violations, [{ code: 'RESERVATION', participant: 1, table: autre, tour: 1 }]);
    assert.notEqual(ligne.mesures, null);
    assert.deepEqual(table.classement.ordre, [proposition.id]);
  });
});

describe('évaluation : les formes closes ne corrigent rien (§ 5.4)', () => {
  test("un retenu qui laisse une personne en réserve à trois tours mesure moins de collisions que le plancher, et la table porte la mesure", () => {
    const charge = structuredClone(chargeDemo('petite-conflit'));
    // Le plan parfait de la petite démonstration, la personne 10 en réserve
    // aux tours 2 à 4 : elle seule fait deux membres d'une même appartenance
    // à une table, au premier tour.
    const tours = [
      [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]],
      [[6, 9, 12], [3, 8, 11], [2, 5], [1, 4, 7]],
      [[4, 8], [2, 7, 12], [1, 6, 11], [3, 5, 9]],
      [[5, 7, 11], [1, 9], [3, 4, 12], [2, 6, 8]],
    ];
    const proposition = propositionDe(charge, 1, tours, [[], [10], [10], [10]]);
    charge.propositions = [proposition];
    charge.retenu = retenuDe(proposition);
    charge.prochainsIds.proposition = 2;
    charge.evenement.etat = 'retenu';
    const table = evaluer(figer(charge));
    const plancher = diagnostiquer(configurationDe(charge)).collisions.reduce((total, { plancherCumulees }) => total + plancherCumulees, 0);
    assert.equal(plancher, 4);
    assert.equal(table.retenu.statut, 'comparable');
    assert.equal(table.retenu.id, 1);
    assert.equal(table.retenu.mesures.collisionsCumulees, 1);
    assert.ok(table.retenu.mesures.collisionsCumulees < plancher);
  });
});

describe('évaluation : les populations différentes (§ 9, § 12.6)', () => {
  test("générer, exclure une personne, générer encore : les premières sont en dérive, hors classement, leurs raisons nomment la personne", () => {
    let charge = generee(chargeDemo('petite'), { graine: 1, nombre: 2, arret: 200 });
    charge = executer(charge, 'exclureParticipant', { id: 4 });
    charge = generee(charge, { graine: 2, nombre: 2, arret: 200 });
    const table = evaluer(figer(charge));
    assert.deepEqual(table.population, [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12]);
    assert.deepEqual(table.classement.ordre.slice().sort(), [3, 4]);
    for (const id of [1, 2]) {
      const ligne = table.propositions.find((candidate) => candidate.id === id);
      assert.equal(ligne.statut, 'derive');
      assert.deepEqual(ligne.raisons, [{ code: 'PARTICIPANT_EXCLU', participant: 4 }]);
      assert.deepEqual([ligne.mesures, ligne.plafondsRealises, ligne.troisChiffres, ligne.ecartAuPlafondAPrioriMax, ligne.minimumAtteint], [null, null, null, null, null]);
      assert.deepEqual([ligne.violations, ligne.refusDessin], [[], []]);
    }
    assert.deepEqual(table.propositions.map(({ id }) => id), [...table.classement.ordre, 1, 2]);
  });

  test('une exclusion et un ajout, à effectif égal, mettent en dérive ; une table ajoutée aussi, TABLE_AJOUTEE', () => {
    let charge = generee(chargeDemo('petite'), { graine: 1, nombre: 1, arret: 200 });
    charge = executer(charge, 'exclureParticipant', { id: 4 });
    charge = executer(charge, 'ajouterParticipant', { champs: { nom: 'Ombrelle', prenom: 'Iris', appartenance: 'Club des Merles' } });
    const echange = evaluer(figer(charge));
    assert.equal(echange.population.length, 12);
    assert.equal(echange.propositions[0].statut, 'derive');
    assert.deepEqual(echange.propositions[0].raisons.map(({ code }) => code), ['PARTICIPANT_EXCLU', 'PARTICIPANT_NON_PLACE']);
    assert.deepEqual(echange.classement.ordre, []);
    let ajout = generee(chargeDemo('petite'), { graine: 1, nombre: 1, arret: 200 });
    ajout = executer(ajout, 'creerTable', { forme: 'ronde' });
    const table = evaluer(figer(ajout));
    assert.equal(table.propositions[0].statut, 'derive');
    assert.deepEqual(table.propositions[0].raisons, [{ code: 'TABLE_AJOUTEE', table: 5 }]);
  });
});

describe('évaluation : un placement fautif (§ 8.9, point 3)', () => {
  test("un retenu dont une liste dépasse sa longueur déclarée est fautif, non mesuré, et les propositions se classent sans lui", () => {
    const base = generee(chargeDemo('petite'), { graine: 3, nombre: 2, arret: 300 });
    const attendue = evaluer(figer(structuredClone(base)));
    const charge = structuredClone(base);
    const retenu = retenuDe(charge.propositions[1]);
    const [premiere, seconde] = retenu.placement[0].sieges;
    premiere.push(seconde.shift());
    charge.retenu = retenu;
    charge.evenement.etat = 'retenu';
    const table = evaluer(figer(charge));
    assert.equal(table.retenu.statut, 'fautif');
    assert.equal(table.retenu.id, charge.propositions[1].id);
    assert.equal(table.retenu.mesures, null);
    assert.ok(table.retenu.raisons.length > 0);
    assert.ok(table.retenu.raisons.every(({ code }) => code === 'LONGUEUR'), JSON.stringify(table.retenu.raisons));
    assert.deepEqual(table.propositions, attendue.propositions);
    assert.deepEqual(table.classement, attendue.classement);
  });
});

// Le placement donné, sous un mandataire qui compte les lectures de
// siegesAttribues : seule la validation (fautes) lit cette clé.
function compte(placement) {
  const releve = { lectures: 0 };
  const mandataire = new Proxy(placement, {
    get(cible, cle, recepteur) {
      if (cle === 'siegesAttribues') releve.lectures += 1;
      return Reflect.get(cible, cle, recepteur);
    },
  });
  return { mandataire, releve };
}

describe('évaluation : chaque placement se valide une fois (§ 8.9)', () => {
  test("une proposition fautive est rendue fautive, ses fautes pour raisons, non mesurée ; les autres se classent comme sans elle", () => {
    const base = generee(chargeDemo('petite'), { graine: 3, nombre: 3, arret: 300 });
    const charge = structuredClone(base);
    const fautive = charge.propositions[1];
    const [premiere, seconde] = fautive.placement[0].sieges;
    premiere.push(seconde.shift());
    const sansElle = structuredClone(base);
    sansElle.propositions.splice(1, 1);
    const table = evaluer(figer(charge));
    const attendue = evaluer(figer(sansElle));
    const ligne = table.propositions.find(({ id }) => id === fautive.id);
    assert.equal(ligne.statut, 'fautif');
    assert.ok(ligne.raisons.length > 0);
    assert.deepEqual(ligne.raisons, fautes(fautive));
    assert.equal(ligne.mesures, null);
    assert.equal(table.propositions.at(-1), ligne);
    assert.deepEqual(table.propositions.slice(0, -1), attendue.propositions);
    assert.deepEqual(table.classement, attendue.classement);
  });

  test('un placement à la fois fautif et en dérive est rendu fautif, ses fautes pour raisons : la validation précède la dérive', () => {
    const base = generee(chargeDemo('petite'), { graine: 3, nombre: 3, arret: 300 });
    const retenue = executer(base, 'retenirProposition', { id: base.propositions[0].id });
    const charge = executer(retenue, 'exclureParticipant', { id: retenue.participants[0].id });
    const proposition = charge.propositions[1];
    for (const placement of [proposition, charge.retenu]) {
      const [a, b] = placement.placement[0].sieges;
      a.push(b.shift());
    }
    assert.ok(fautes(proposition).length > 0);
    assert.ok(fautes(charge.retenu).length > 0);
    const table = evaluer(figer(charge));
    const ligne = table.propositions.find(({ id }) => id === proposition.id);
    assert.equal(ligne.statut, 'fautif');
    assert.deepEqual(ligne.raisons, fautes(proposition));
    assert.equal(table.retenu.statut, 'fautif');
    assert.deepEqual(table.retenu.raisons, fautes(charge.retenu));
    assert.ok(table.propositions.filter(({ id }) => id !== proposition.id).every(({ statut }) => statut === 'derive'));
  });

  test('evaluer valide chaque proposition et le retenu une seule fois : la validation y lit le placement autant que fautes seul', () => {
    const base = generee(chargeDemo('petite'), { graine: 3, nombre: 2, arret: 300 });
    const charge = executer(base, 'retenirProposition', { id: base.propositions[0].id });
    const seule = compte(structuredClone(charge.propositions[1]));
    fautes(seule.mandataire);
    assert.ok(seule.releve.lectures > 0);
    const proposition = compte(charge.propositions[1]);
    const retenu = compte(charge.retenu);
    charge.propositions[1] = proposition.mandataire;
    charge.retenu = retenu.mandataire;
    const table = evaluer(charge);
    assert.ok(table.propositions.every(({ statut }) => statut === 'comparable'));
    assert.equal(table.retenu.statut, 'comparable');
    assert.equal(proposition.releve.lectures, seule.releve.lectures);
    const seulRetenu = compte(structuredClone(executer(base, 'retenirProposition', { id: base.propositions[0].id }).retenu));
    fautes(seulRetenu.mandataire);
    assert.equal(retenu.releve.lectures, seulRetenu.releve.lectures);
  });
});

describe('évaluation : le plafond a priori inconnu (§ 17, point 4)', () => {
  test("plafondsAPriori null : le premier critère est sauté et nommé ; écart d'itinéraire et certificat inconnus", () => {
    const charge = figer(generee(chargeDemo('petite-conflit'), { graine: 5, nombre: 2, arret: 300 }));
    const table = evaluer(charge, { plafondsAPriori: null });
    assert.equal(table.classement.critereSaute, 'ecartAuPlafondAPrioriMax');
    assert.deepEqual(table.classement.criteresAppliques[0].criteres.map(({ nom }) => nom), ['excedentCollisions']);
    for (const ligne of table.propositions) {
      assert.equal(ligne.troisChiffres.ecartItineraireMax, null);
      assert.equal(ligne.minimumAtteint, null);
      assert.equal(ligne.ecartAuPlafondAPrioriMax, null);
    }
    assert.throws(() => evaluer(charge, { plafondsAPriori: [] }), TypeError);
  });
});

describe('évaluation : les imposés (§ 5.4, § 15.1)', () => {
  test('la grande démonstration : 99 retours imposés, 33 ancrages qui en imposent, ceux de diagnostiquer', () => {
    const charge = chargeDemo('grande');
    const table = evaluer(figer(charge));
    const diagnostic = diagnostiquer(configurationDe(charge));
    assert.deepEqual(table.imposes, { retours: 99, ancrages: 33 });
    assert.deepEqual(table.imposes, { retours: diagnostic.retoursImposes, ancrages: diagnostic.ancragesImposantRetours });
  });

  test("deux personnes d'appartenances distinctes réservées ensemble : une rencontre répétée imposée par ligne, hors des choisies", () => {
    const charge = structuredClone(chargeDemo('petite'));
    charge.reservations = [1, 2].map((participant) => ({ participant, table: 1, siege: null, portee: 'tous', tour: null }));
    const avec = generee(charge, { graine: 6, nombre: 3, arret: 500 });
    const table = evaluer(figer(avec));
    assert.equal(table.propositions.length, 3);
    for (const ligne of table.propositions) {
      assert.equal(ligne.mesures.rencontresRepetees.imposees, 1);
      // Les paires réunies deux fois au moins, comptées sur le plan : celle
      // des deux réservés n'est pas parmi les choisies.
      const plan = planDepuisFichier(avec.propositions.find(({ id }) => id === ligne.id));
      const fois = new Map();
      for (const listes of plan.tours) {
        for (const liste of listes) {
          for (const a of liste) for (const b of liste) if (a < b) fois.set(`${a}-${b}`, (fois.get(`${a}-${b}`) ?? 0) + 1);
        }
      }
      const repetees = [...fois.values()].filter((n) => n >= 2).length;
      assert.equal(fois.get('1-2'), 4);
      assert.equal(ligne.mesures.rencontresRepetees.choisies, repetees - 1);
    }
  });
});

describe('évaluation : une table, un tour (§ 15.4)', () => {
  test('six personnes à une table de 6, un tour : rien de répété, aucun NaN ni infini', () => {
    const charge = structuredClone(chargeDemo('petite'));
    charge.participants = charge.participants.slice(0, 6);
    charge.tables = charge.tables.slice(0, 1).map((table) => ({ ...table, sieges: 6 }));
    charge.evenement.tours = 1;
    const table = evaluer(figer(generee(charge, { graine: 1, nombre: 1, arret: 10 })));
    const [ligne] = table.propositions;
    assert.equal(ligne.statut, 'comparable');
    assert.deepEqual(ligne.mesures.rencontresRepetees, { choisies: 0, imposees: 0 });
    assert.equal(ligne.mesures.excedentCollisions, 0);
    assert.equal(ligne.mesures.totalRetoursChoisis, 0);
    const tous = nombres(table);
    assert.ok(tous.length > 0);
    assert.ok(tous.every(Number.isFinite), 'NaN ou infini dans la table');
  });
});

describe("évaluation : une configuration qui ne se tient pas", () => {
  test("evaluer lève l'ErreurConfiguration de normaliser", () => {
    const charge = structuredClone(chargeDemo('petite'));
    charge.reservations = [1, 2, 3, 4].map((participant) => ({ participant, table: 1, siege: null, portee: 'tous', tour: null }));
    assert.throws(() => evaluer(figer(charge)), (erreur) => erreur instanceof ErreurConfiguration && erreur.code === 'SURRESERVATION');
  });
});

describe('resumeDuRetenu : la différence à la cible que lit la liste des événements (§ 5.4, § 8.1, § 8.9)', () => {
  // La petite démonstration, trois propositions générées, la deuxième retenue.
  function retenue() {
    const generees = generee(chargeDemo('petite-conflit'), { graine: 3, nombre: 3, arret: 300 });
    return executer(generees, 'retenirProposition', { id: generees.propositions[1].id });
  }

  test("la seule différence à la cible, 1000 par défaut, contre le Σ r(p) de la ligne du retenu d'evaluer", () => {
    const charge = figer(retenue());
    const resume = resumeDuRetenu(charge);
    const { mesures } = evaluer(charge).retenu;
    assert.ok(mesures.totalRedondance !== 1000, 'la différence se distingue de zéro');
    assert.deepEqual(resume, { diffRedondance: Math.abs(1000 - mesures.totalRedondance) });
    const instance = normaliser(configurationDe(charge));
    const attendues = mesurer(instance, indexerPlan(instance, planDepuisFichier(charge.retenu)));
    assert.equal(attendues.totalRedondance, mesures.totalRedondance);
    assert.equal(CIBLE_REDONDANCE_PAR_DEFAUT, 1000);
    assert.equal(cibleRedondance(charge), 1000);
  });

  test("une cible propre à l'événement : la différence se lit contre elle, en valeur absolue, des deux côtés", () => {
    const charge = retenue();
    const total = evaluer(charge).retenu.mesures.totalRedondance;
    for (const cible of [0, total, total + 7, 5_000]) {
      const avecCible = executer(charge, 'changerCibleRedondance', { cible: String(cible) });
      assert.equal(cibleRedondance(avecCible), cible);
      assert.deepEqual(resumeDuRetenu(avecCible), { diffRedondance: Math.abs(cible - total) }, String(cible));
    }
    const dessous = executer(charge, 'changerCibleRedondance', { cible: '0' });
    assert.equal(resumeDuRetenu(dessous).diffRedondance, total);
  });

  test('sans retenu, null ; un retenu fautif ou en dérive, null, sans lever', () => {
    const sansRetenu = generee(chargeDemo('petite-conflit'), { graine: 3, nombre: 1, arret: 200 });
    assert.equal(sansRetenu.retenu, null);
    assert.equal(resumeDuRetenu(sansRetenu), null);
    assert.equal(resumeDuRetenu(chargeDemo('petite')), null);

    const fautif = structuredClone(retenue());
    fautif.retenu.placement[0].reserve.push(fautif.retenu.participants[0]);
    assert.equal(evaluer(fautif).retenu.statut, 'fautif');
    assert.equal(resumeDuRetenu(fautif), null);

    const enDerive = executer(retenue(), 'changerTours', { tours: '3' });
    assert.equal(evaluer(enDerive).retenu.statut, 'derive');
    assert.equal(resumeDuRetenu(enDerive), null);
  });

  test('une configuration qui ne se normalise pas rend null là où evaluer lève', () => {
    const charge = structuredClone(retenue());
    const table = charge.tables[0].id;
    charge.reservations = [1, 2, 3, 4].map((participant) => ({ participant, table, siege: null, portee: 'tous', tour: null }));
    assert.throws(() => evaluer(charge), (erreur) => erreur instanceof ErreurConfiguration && erreur.code === 'SURRESERVATION');
    assert.equal(resumeDuRetenu(charge), null);
  });
});

describe('resumeDuMeilleur : la proposition au rang 1 que lit la liste des événements (§ 5.4, § 5.7, § 8.1)', () => {
  test('le rang 1 du classement, ni le plus petit identifiant ni le moins de collisions : son seul identifiant', () => {
    // Le classement range les plans écrits à la main 3, 2, 1, 4 : la 3 vient
    // en tête avec 6 collisions cumulées, quand la 1 n'en porte que 4.
    const charge = structuredClone(chargeDemo('petite-conflit'));
    charge.propositions = PLANS_CONFLIT.map(({ tours }, rang) => propositionDe(charge, rang + 1, tours));
    charge.prochainsIds.proposition = 5;
    figer(charge);
    const table = evaluer(charge);
    assert.deepEqual(table.classement.ordre, [3, 2, 1, 4]);
    assert.deepEqual(resumeDuMeilleur(charge), { id: 3 });
    assert.equal(premiereDuClassement(table), table.propositions[0]);
    assert.equal(premiereDuClassement(table).mesures.collisionsCumulees, 6);
    assert.equal(table.propositions.find(({ id }) => id === 1).mesures.collisionsCumulees, 4);
  });

  test("après des générations : la première ligne d'evaluer, comparable, et le retenu n'y change rien", () => {
    let charge = generee(chargeDemo('petite-conflit'), { graine: 4, nombre: 3, arret: 300 });
    charge = generee(charge, { graine: 9, nombre: 2, arret: 300 });
    const [premiere] = evaluer(charge).propositions;
    assert.equal(premiere.statut, 'comparable');
    const attendu = { id: premiere.id };
    assert.deepEqual(resumeDuMeilleur(figer(charge)), attendu);
    const derniere = charge.propositions.at(-1).id;
    const retenue = executer(charge, 'retenirProposition', { id: derniere });
    assert.deepEqual(resumeDuMeilleur(retenue), attendu);
  });

  test('sans proposition, null, retenu ou non ; premiereDuClassement d’une table sans comparable, null', () => {
    assert.equal(resumeDuMeilleur(chargeDemo('petite')), null);
    const generees = generee(chargeDemo('petite-conflit'), { graine: 3, nombre: 2, arret: 300 });
    const retenue = executer(generees, 'retenirProposition', { id: generees.propositions[0].id });
    // Un retenu seul : la liste vidée à la main, la commande gardant la
    // proposition d'origine du retenu.
    const retenuSeul = structuredClone(retenue);
    retenuSeul.propositions = [];
    assert.equal(evaluer(retenuSeul).retenu.statut, 'comparable');
    assert.equal(resumeDuMeilleur(retenuSeul), null);
    assert.equal(premiereDuClassement(evaluer(retenuSeul)), null);
  });

  test('des propositions toutes hors du classement — population changée, ou fautives — : null, sans lever', () => {
    const generees = generee(chargeDemo('petite'), { graine: 3, nombre: 2, arret: 300 });
    assert.notEqual(resumeDuMeilleur(generees), null);
    const exclue = executer(generees, 'exclureParticipant', { id: generees.participants[0].id });
    const table = evaluer(exclue);
    assert.equal(table.propositions.length, 2);
    assert.ok(table.propositions.every(({ statut }) => statut === 'derive'));
    assert.equal(premiereDuClassement(table), null);
    assert.equal(resumeDuMeilleur(exclue), null);

    const fautives = structuredClone(generees);
    for (const proposition of fautives.propositions) proposition.placement[0].reserve.push(proposition.participants[0]);
    assert.ok(evaluer(fautives).propositions.every(({ statut }) => statut === 'fautif'));
    assert.equal(resumeDuMeilleur(fautives), null);
  });

  test('une configuration qui ne se normalise pas rend null là où evaluer lève', () => {
    const charge = structuredClone(generee(chargeDemo('petite-conflit'), { graine: 3, nombre: 2, arret: 300 }));
    const table = charge.tables[0].id;
    charge.reservations = [1, 2, 3, 4].map((participant) => ({ participant, table, siege: null, portee: 'tous', tour: null }));
    assert.throws(() => evaluer(charge), (erreur) => erreur instanceof ErreurConfiguration && erreur.code === 'SURRESERVATION');
    assert.equal(resumeDuMeilleur(charge), null);
  });
});

// --- L'ordre des priorités, le mode et les cases (A11, A21) ---------------------

exigerVerification(process.env);

// La petite démonstration au conflit inévitable, où 1 à 6 portent
// « finance » et la table d'identifiant le plus petit l'objectif « finance »
// pour la soirée ; le mode et l'ordre des priorités donnés, quand ils le
// sont.
function chargeAObjectifs({ mode, priorites } = {}) {
  const charge = structuredClone(chargeDemo('petite-conflit'));
  for (const participant of charge.participants) if (participant.id <= 6) participant.etiquettes = ['finance'];
  const [premiere] = [...charge.tables].sort((a, b) => a.id - b.id);
  premiere.objectifs = [{ portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] }];
  if (mode !== undefined) charge.reglages.modeObjectifs = mode;
  if (priorites !== undefined) charge.reglages.priorites = priorites;
  return charge;
}

const e = (critere, poids = 1) => ({ critere, poids });

describe("évaluation : l'état des critères et les mesures nouvelles (contrat du classement)", () => {
  test("criteres porte l'état de chaque critère tel que normaliser le donne, valeurs comprises", () => {
    const charge = figer(generee(chargeAObjectifs({ mode: 'chacun' }), { graine: 3, nombre: 2, arret: 300 }));
    const table = evaluer(charge);
    const instance = normaliser(configurationDe(charge));
    assert.deepEqual(table.criteres, instance.etatCriteres);
    assert.deepEqual(table.criteres.find(({ nom }) => nom === 'toursHorsObjectif'), {
      nom: 'toursHorsObjectif',
      coche: true,
      sansObjet: false,
      valeurs: ['jamaisServies', 'toursHorsObjectif'],
    });
    assert.deepEqual(table.criteres.find(({ nom }) => nom === 'animateursNonRencontres').coche, false);
    for (const ligne of table.propositions) {
      assert.equal(ligne.mesures.objectifs.concernes, 6, `${ligne.id}`);
      assert.equal(ligne.mesures.animateurs, null, `${ligne.id}`);
    }
  });

  test('sans objectif, les objectifs sont sans objet, et les lignes portent des mesures nouvelles nulles', () => {
    const table = evaluer(figer(generee(chargeDemo('petite'), { graine: 2, nombre: 1, arret: 100 })));
    assert.equal(table.criteres.find(({ nom }) => nom === 'toursHorsObjectif').sansObjet, true);
    assert.deepEqual(table.propositions.map(({ mesures }) => [mesures.objectifs, mesures.animateurs]), [[null, null]]);
  });
});

describe("évaluation : le classement suit l'ordre et le mode de la charge (A11, A21)", () => {
  test("sous minimum et un ordre réglé, le classement est celui de classer sur la compilation de l'instance", () => {
    const priorites = [
      [e('ecartAuPlafondAPrioriMax')],
      [e('toursHorsObjectif')],
      [e('excedentCollisions'), e('redondance', 3)],
      [e('collisionsCumulees')],
      [e('rencontresRepetees')],
      [e('animateursNonRencontres')],
    ];
    const charge = figer(generee(chargeAObjectifs({ mode: 'minimum', priorites }), { graine: 4, nombre: 6, arret: 200 }));
    const table = evaluer(charge);
    const instance = normaliser(configurationDe(charge));
    const aPriori = plafondsAPriori(instance);
    const entrees = charge.propositions.map(({ id }) => ({
      id,
      mesures: table.propositions.find((ligne) => ligne.id === id).mesures,
      plafondsAPriori: aPriori,
    }));
    assert.deepEqual(table.classement, classer(entrees, compilationDe(instance)));
    assert.deepEqual(
      table.classement.criteresAppliques.map(({ criteres }) => criteres.map(({ nom, valeurs, poids }) => `${nom}:${valeurs.join('+')}×${poids}`)),
      [
        ['ecartAuPlafondAPrioriMax:ecartAuPlafondAPrioriMax×1'],
        ['toursHorsObjectif:horsObjectifMax+toursHorsObjectif×1'],
        ['excedentCollisions:excedentCollisions×1', 'redondance:redondance×3'],
        ['collisionsCumulees:collisionsCumulees×1'],
        ['rencontresRepetees:rencontresRepeteesChoisies×1'],
      ],
    );
    assert.notDeepEqual(table.classement.criteresAppliques, classer(entrees).criteresAppliques);
  });

  test('sans objectif, les trois modes rendent le même classement que la charge sans mode', () => {
    const charge = generee(chargeDemo('petite-conflit'), { graine: 6, nombre: 5, arret: 200 });
    const reference = evaluer(charge).classement;
    for (const mode of ['chacun', 'minimum']) {
      const autre = structuredClone(charge);
      autre.reglages.modeObjectifs = mode;
      assert.deepEqual(evaluer(autre).classement, reference, mode);
    }
  });
});

describe('évaluation : sous les seize combinaisons des cases, la clé de référence privée des critères retirés (A21, contrainte 33)', () => {
  const REFERENCE = lireEmpreintes();
  // La clé de référence privée des critères que les cases décochées
  // retirent, en grandeurs nommées du fichier : l'écart toujours ;
  // l'excédent et les cumulées sous « séparer » ; les rencontres répétées
  // choisies sous « nouveaux voisins », sinon les retours choisis sous
  // « nouvelle table » seule ; la redondance sous « varier ».
  const cleSous = (cases) => [
    'ecartAuPlafondAPrioriMax',
    ...(cases.separerAppartenances ? ['excedentCollisions', 'collisionsCumulees'] : []),
    ...(cases.nouveauxVoisins ? ['rencontresRepeteesChoisies'] : cases.nouvelleTable ? ['retoursChoisis'] : []),
    ...(cases.varierAppartenances ? ['redondance'] : []),
  ];
  // Le nom du critère appliqué qui classe chaque grandeur de la clé.
  const CRITERE_DE = {
    ecartAuPlafondAPrioriMax: 'ecartAuPlafondAPrioriMax',
    excedentCollisions: 'excedentCollisions',
    collisionsCumulees: 'collisionsCumulees',
    rencontresRepeteesChoisies: 'rencontresRepetees',
    retoursChoisis: 'rencontresRepetees',
    redondance: 'redondance',
  };
  // Les identifiants rangés grandeur par grandeur de la clé, puis par
  // identifiant croissant.
  const ordonner = (grandeurs, cle, ids) => [...ids].sort((a, b) => {
    for (const nom of cle) {
      const ecart = grandeurs[String(a)][nom] - grandeurs[String(b)][nom];
      if (ecart !== 0) return ecart;
    }
    return a - b;
  });

  for (const cle of CLASSEMENT.cles) {
    test(`${cle} : chaque combinaison classe comme sa clé privée, et ne nomme que ses critères ; l'ordre change sous une combinaison au moins`, () => {
      const charge = chargeDeClassement(cle);
      const { propositions: grandeurs } = REFERENCE.classements[cle];
      const ids = charge.propositions.map(({ id }) => id);
      let differentes = 0;
      for (let masque = 0; masque < 16; masque += 1) {
        const cases = Object.fromEntries(CASES.map((nom, bit) => [nom, (masque & (1 << bit)) !== 0]));
        const sous = structuredClone(charge);
        Object.assign(sous.reglages, cases);
        const table = evaluer(sous);
        const nom = `${cle}, ${CASES.filter((c) => cases[c]).join('+') || 'aucune'}`;
        assert.ok(table.propositions.every(({ statut }) => statut === 'comparable'), nom);
        const attendu = ordonner(grandeurs, cleSous(cases), ids);
        assert.deepEqual(table.classement.ordre, attendu, nom);
        assert.deepEqual(
          table.classement.criteresAppliques.map(({ criteres }) => criteres.map(({ nom: n, valeurs }) => `${n}:${valeurs.join('+')}`).join()),
          cleSous(cases).map((g) => `${CRITERE_DE[g]}:${g}`),
          nom,
        );
        if (attendu.join() !== REFERENCE.classements[cle].connu.ordre.join()) differentes += 1;
      }
      assert.ok(differentes > 0, cle);
    });
  }
});

describe('évaluation : le mode ne touche pas au classement de référence, sans objectif (A21)', () => {
  const REFERENCE = lireEmpreintes();
  for (const mode of ['chacun', 'minimum']) {
    test(`${mode} : ordre, critères appliqués et grandeurs, plafond a priori connu puis inconnu, ceux des empreintes de référence`, () => {
      for (const cle of CLASSEMENT.cles) {
        assert.deepEqual(empreintesDuClassement(cle, mode), REFERENCE.classements[cle], `${cle}, ${mode}`);
      }
    });
  }
});
