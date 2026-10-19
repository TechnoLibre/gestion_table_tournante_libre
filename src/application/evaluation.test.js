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
import { readFileSync } from 'node:fs';
import { parse } from 'svelte/compiler';
import {
  CASES,
  CLASSEMENT,
  chargeDeClassement,
  empreintesDuClassement,
  exigerVerification,
  lireEmpreintes,
} from '../../test/empreintes_moteur.js';
import { creerFichiersSimules } from '../../test/fichiers_simules.js';
import { describe, test } from '../../test/lanceur.js';
import { texteLivre } from '../demo/livrees.js';
import { constante } from '../geometrie/constantes.js';
import { classer } from '../moteur/classement.js';
import { premierPalierQuiDepartage } from '../moteur/classement.js';
import { SANS_GROUPE, STATUT, indexerPlan, normaliser } from '../moteur/configuration.js';
import { compilationDe } from '../moteur/criteres.js';
import { diagnostiquer } from '../moteur/diagnostic.js';
import * as DIVERSITE from '../moteur/diversite.js';
import { ErreurConfiguration } from '../moteur/erreurs.js';
import { mesurer } from '../moteur/indicateurs.js';
import { ecartsAuPlafondAPriori } from '../moteur/manque.js';
import { borneHaute, comparerProfils, escalierDuManque, manques, profilManque, valeursDistinctes } from '../moteur/manque.js';
import * as PAIRES from '../moteur/paires.js';
import { borneDiversite, plafondsAPriori } from '../moteur/plafond.js';
import * as QUALITE from '../moteur/qualite.js';
import { rechercher, repartir } from '../moteur/recherche.js';
import { avecCourses, courseDe } from '../stockage/courses.js';
import { creer as creerDansLeDepot } from '../stockage/depot.js';
import { analyser, capacite, creerCharge } from '../stockage/document.js';
import { deriveSansRevalider, fautes, planDepuisFichier } from '../stockage/placements.js';
import { VERSION } from '../version.genere.js';
import { appliquerCommande } from './commandes.js';
import { configurationDe } from './configuration.js';
import { departDuMoteur, derivationDe } from './depart.js';
import * as EVALUATION from './evaluation.js';
import {
  candidatsDeComparaison,
  comparaisonOfferte,
  comparerPlacements,
  detaillerQualite,
  evaluer,
  nettoyage,
  premiereDuClassement,
  rencontresDePersonne,
  resumeDuMeilleur,
  resumeDuRetenu,
} from './evaluation.js';
import { creerControleurGeneration, creerExecuteurDirect } from './generation.js';
import { creerHorlogePilotee } from './horloge.js';
import { libelle } from './libelles.js';
import { nomAffiche } from './personnes.js';
import { creerSeance } from './seance.js';

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

  test('evaluer fige sa configuration, jamais la charge : rien de ce que la charge atteint ne devient figé', () => {
    const charge = generee(chargeDemo('grande'), { graine: 2, nombre: 1, arret: 300 });
    evaluer(charge);
    const figes = [];
    const parcourir = (valeur, chemin) => {
      if (valeur === null || typeof valeur !== 'object') return;
      if (Object.isFrozen(valeur)) figes.push(chemin);
      for (const [cle, element] of Object.entries(valeur)) parcourir(element, `${chemin}.${cle}`);
    };
    parcourir(charge, 'charge');
    assert.deepEqual(figes, []);
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
    const [a, b] = proposition.placement[0].sieges;
    a.push(b.shift());
    // Le retenu suit l'exclusion, sa chaise vide : un identifiant écrit deux
    // fois le rend fautif.
    const [premiere] = charge.retenu.placement[0].sieges;
    premiere.push(premiere.find((id) => id !== null));
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

describe('resumeDuRetenu : les collisions cumulées et les rencontres répétées choisies du retenu que lit la liste des événements (§ 5.4, § 8.1)', () => {
  // La petite démonstration, trois propositions générées, la deuxième retenue.
  function retenue() {
    const generees = generee(chargeDemo('petite-conflit'), { graine: 3, nombre: 3, arret: 300 });
    return executer(generees, 'retenirProposition', { id: generees.propositions[1].id });
  }

  test("les collisions cumulées (paire et tour) et les rencontres répétées choisies, celles de la ligne du retenu d'evaluer et de mesurer, et rien d'autre", () => {
    const charge = figer(retenue());
    const resume = resumeDuRetenu(charge);
    const { mesures } = evaluer(charge).retenu;
    assert.ok(mesures.collisionsCumulees > 0, 'le retenu porte des collisions');
    assert.ok(mesures.rencontresRepetees.choisies > 0, 'le retenu porte des rencontres répétées choisies');
    assert.notEqual(mesures.collisionsCumulees, mesures.totalRedondance);
    assert.notEqual(mesures.rencontresRepetees.choisies, mesures.collisionsCumulees);
    assert.deepEqual(resume, {
      collisionsCumulees: mesures.collisionsCumulees,
      rencontresRepetees: mesures.rencontresRepetees.choisies,
    });
    const instance = normaliser(configurationDe(charge));
    const attendues = mesurer(instance, indexerPlan(instance, planDepuisFichier(charge.retenu)));
    assert.equal(attendues.collisionsCumulees, mesures.collisionsCumulees);
    assert.deepEqual(attendues.rencontresRepetees, mesures.rencontresRepetees);
  });

  test('les rencontres répétées du résumé sont les seules choisies : une paire réservée ensemble, imposée, n’y entre pas', () => {
    const charge = structuredClone(chargeDemo('petite'));
    charge.reservations = [1, 2].map((participant) => ({ participant, table: 1, siege: null, portee: 'tous', tour: null }));
    const avec = generee(charge, { graine: 6, nombre: 3, arret: 500 });
    for (const proposition of avec.propositions) {
      const retenue = figer(executer(avec, 'retenirProposition', { id: proposition.id }));
      const { mesures } = evaluer(retenue).retenu;
      assert.equal(mesures.rencontresRepetees.imposees, 1);
      assert.deepEqual(resumeDuRetenu(retenue), {
        collisionsCumulees: mesures.collisionsCumulees,
        rencontresRepetees: mesures.rencontresRepetees.choisies,
      });
    }
  });

  test('les deux valeurs sortent d’une seule mesure du retenu : un seul appel à mesurer, dont le résumé lit les deux', () => {
    const source = readFileSync(new URL('./evaluation.js', import.meta.url), 'utf8');
    const debut = source.indexOf('export function resumeDuRetenu(');
    assert.ok(debut >= 0);
    const corps = source.slice(debut, source.indexOf('\n}\n', debut));
    assert.equal(corps.match(/\bmesurer\(/g)?.length, 1);
  });

  test('aucune cible : le résumé ne dépend pas d’un champ cibleRedondance resté dans les réglages, et le module n’en exporte plus', () => {
    const charge = retenue();
    const avecChamp = structuredClone(charge);
    avecChamp.reglages.cibleRedondance = 25;
    assert.deepEqual(resumeDuRetenu(avecChamp), resumeDuRetenu(charge));
    assert.equal(Object.hasOwn(EVALUATION, 'cibleRedondance'), false);
    assert.equal(Object.hasOwn(EVALUATION, 'CIBLE_REDONDANCE_PAR_DEFAUT'), false);
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

describe('nettoyage : les n premières du tableau, et la proposition du retenu (§ 5.7)', () => {
  // Les plans écrits à la main, que le classement range 3, 2, 1, 4.
  function chargeConflit() {
    const charge = structuredClone(chargeDemo('petite-conflit'));
    charge.propositions = PLANS_CONFLIT.map(({ tours }, rang) => propositionDe(charge, rang + 1, tours));
    charge.prochainsIds.proposition = 5;
    charge.evenement.etat = 'propose';
    return charge;
  }

  test("garde les n premières dans l'ordre de la table, efface les suivantes ; sans retenu, rien de plus", () => {
    const table = evaluer(figer(chargeConflit()));
    assert.deepEqual(table.propositions.map(({ id }) => id), [3, 2, 1, 4]);
    assert.deepEqual(nettoyage(table, 2), { gardees: [3, 2], effacees: [1, 4], origineEnPlus: null });
    assert.deepEqual(nettoyage(table, 1), { gardees: [3], effacees: [2, 1, 4], origineEnPlus: null });
    assert.deepEqual(nettoyage(table, 4), { gardees: [3, 2, 1, 4], effacees: [], origineEnPlus: null });
    assert.deepEqual(nettoyage(table, 10), { gardees: [3, 2, 1, 4], effacees: [], origineEnPlus: null });
  });

  test("la proposition du retenu, après les n premières, est gardée en plus ; parmi elles, rien de plus", () => {
    const charge = executer(chargeConflit(), 'retenirProposition', { id: 4 });
    const table = evaluer(figer(charge));
    assert.equal(table.retenu.id, 4);
    assert.deepEqual(nettoyage(table, 2), { gardees: [3, 2, 4], effacees: [1], origineEnPlus: 4 });
    assert.deepEqual(nettoyage(table, 3), { gardees: [3, 2, 1, 4], effacees: [], origineEnPlus: 4 });
    const parmi = evaluer(figer(executer(chargeConflit(), 'retenirProposition', { id: 2 })));
    assert.deepEqual(nettoyage(parmi, 2), { gardees: [3, 2], effacees: [1, 4], origineEnPlus: null });
  });

  test("un retenu dont la proposition n'est plus dans la liste ne garde rien de plus", () => {
    const charge = executer(chargeConflit(), 'retenirProposition', { id: 1 });
    charge.propositions = charge.propositions.filter(({ id }) => id !== 1);
    const table = evaluer(figer(charge));
    assert.equal(table.retenu.id, 1);
    assert.deepEqual(nettoyage(table, 1), { gardees: [3], effacees: [2, 4], origineEnPlus: null });
  });

  test('les hors classement viennent après les classées, par identifiant, comme au tableau', () => {
    let charge = generee(chargeDemo('petite'), { graine: 1, nombre: 2, arret: 200 });
    charge = executer(charge, 'exclureParticipant', { id: 4 });
    charge = generee(charge, { graine: 2, nombre: 2, arret: 200 });
    const table = evaluer(figer(charge));
    const ordre = table.classement.ordre;
    assert.deepEqual(nettoyage(table, 2), { gardees: ordre, effacees: [1, 2], origineEnPlus: null });
    assert.deepEqual(nettoyage(table, 3), { gardees: [...ordre, 1], effacees: [2], origineEnPlus: null });
  });

  test('n hors des entiers ≥ 1 est une faute du code', () => {
    const table = evaluer(figer(chargeConflit()));
    for (const n of [0, -1, 1.5, '2', null, undefined, Number.NaN, 2 ** 53]) {
      assert.throws(() => nettoyage(table, n), TypeError, String(n));
    }
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

// --- Le détail d'un placement (§ 12.9, D27, D29, D40, D42, B23) ---------

// La génération du moteur, enregistrée par la commande, et ses courses en
// mémoire sous la clé de leur proposition, comme la séance les garde.
function genereeAvecCourses(charge, reglages) {
  const configuration = configurationDe(charge);
  const propositions = rechercher(configuration, reglages);
  const rendu = appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: V1 });
  return { charge: rendu.charge, courses: avecCourses(new Map(), rendu.courses) };
}

// La lecture des courses d'une charge, telle que seance.courseDe la fait.
const lecteurDe = (charge, courses) => (id) => courseDe({ charge, courses }, id);

// L'ordre réglé de l'étape 1 : l'excédent et les objectifs, pondérés à 3,
// partagent un palier.
const ORDRE_REGLE = [
  [e('ecartAuPlafondAPrioriMax')],
  [e('excedentCollisions'), e('toursHorsObjectif', 3)],
  [e('collisionsCumulees')],
  [e('rencontresRepetees')],
  [e('animateursNonRencontres')],
  [e('redondance')],
];

// Les noms des valeurs d'un point de relevé : le minimum brut, puis chaque
// grandeur que les critères appliqués de la table classent, dans leur ordre.
const indicateursDe = (table) => [
  'minimumBrut',
  ...table.classement.criteresAppliques.flatMap(({ criteres }) => criteres.flatMap(({ valeurs }) => valeurs)),
];

// Les valeurs attendues d'un point, lues une à une dans mesurer.
function valeursAttendues(table, mesures, aPriori) {
  const ecarts = ecartsAuPlafondAPriori(mesures, aPriori);
  const lire = {
    minimumBrut: () => mesures.aggRencontres.tous.min,
    ecartAuPlafondAPrioriMax: () => (ecarts === null || ecarts.length === 0 ? null : Math.max(...ecarts)),
    excedentCollisions: () => mesures.excedentCollisions,
    collisionsCumulees: () => mesures.collisionsCumulees,
    toursHorsObjectif: () => mesures.objectifs.horsObjectif,
    jamaisServies: () => mesures.objectifs.jamaisServies,
    horsObjectifMax: () => mesures.objectifs.horsObjectifMax,
    rencontresRepeteesChoisies: () => mesures.rencontresRepetees.choisies,
    retoursChoisis: () => mesures.totalRetoursChoisis,
    animateursNonRencontres: () => mesures.animateurs.nonRencontres,
    redondance: () => mesures.totalRedondance,
  };
  return Object.fromEntries(indicateursDe(table).map((nom) => [nom, lire[nom]()]));
}

// Lève sur un tableau typé atteint depuis la valeur, à toute profondeur.
function sansTableauType(valeur, chemin = 'detail') {
  assert.equal(ArrayBuffer.isView(valeur), false, `${chemin} : tableau typé`);
  if (valeur !== null && typeof valeur === 'object') {
    for (const [cle, element] of Object.entries(valeur)) sansTableauType(element, `${chemin}.${cle}`);
  }
}

// Les champs de mesure d'un détail, null quand la source ne se mesure pas.
const CHAMPS_DE_MESURE = [
  'population', 'T', 'R', 'G', 'idsTables', 'numerosTables', 'personnes', 'bornes', 'profil', 'synthese',
  'repartitionRencontres', 'collisions', 'tables', 'paires', 'matrice', 'objectifs', 'animateurs', 'course',
];

// Une charge de n personnes inventées, deux appartenances, des tables de
// cinq places, deux tours.
function chargeDeN(n) {
  const charge = creerCharge({ id: `evt-matrice-${n}`, nom: 'Atelier Ressac', siegesParDefaut: 5, tours: 2 });
  charge.participants = Array.from({ length: n }, (_, rang) => ({
    id: rang + 1,
    nom: `Ombrelle ${rang + 1}`,
    prenom: 'Iris',
    appartenance: rang % 3 === 0 ? 'Coopérative Aubier' : 'Atelier Ressac',
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  const tables = Math.ceil(n / 5);
  charge.tables = Array.from({ length: tables }, (_, rang) => ({
    id: rang + 1,
    numero: rang + 1,
    sieges: null,
    forme: 'ronde',
    position: { x: 300 * rang, y: 0 },
  }));
  charge.prochainsIds = { participant: n + 1, table: tables + 1, proposition: 1 };
  return charge;
}

// Les noms que lit un nœud d'analyse : chaque identifiant, hors de la clé
// nommée d'une propriété et du membre nommé d'un accès, qui ne lisent
// aucune liaison. Le membre nommé d'un identifiant s'ajoute sous
// « objet.membre », pour les imports d'espace de noms.
function nomsLus(noeud, lus = new Set()) {
  if (noeud === null || typeof noeud !== 'object') return lus;
  if (Array.isArray(noeud)) {
    for (const enfant of noeud) nomsLus(enfant, lus);
    return lus;
  }
  if (noeud.type === 'Identifier') lus.add(noeud.name);
  for (const [champ, valeur] of Object.entries(noeud)) {
    if (champ === 'loc' || champ === 'metadata' || champ === 'parent') continue;
    if (noeud.type === 'MemberExpression' && champ === 'property' && !noeud.computed) {
      if (noeud.object.type === 'Identifier') lus.add(`${noeud.object.name}.${valeur.name}`);
    } else if (!(noeud.type === 'Property' && champ === 'key' && !noeud.computed)) {
      nomsLus(valeur, lus);
    }
  }
  return lus;
}

// Ce qu'atteint, dans le texte d'un module, la liaison de premier niveau
// depart : chaque liaison de premier niveau qu'elle lit, de proche en
// proche — fonction, classe ou variable, exportée ou non —, et le nom
// importé de chaque import qu'une d'elles lit, directement ou par le membre
// d'un espace de noms. Un nom local qui en masque un de premier niveau
// compte comme lu : l'approximation ne laisse passer aucun appel.
function atteintDepuis(texte, depart) {
  const programme = parse(`<script module>${texte}</script>`, { modern: true }).module.content;
  const lit = new Map();
  const importe = new Map();
  for (const instruction of programme.body) {
    const declaration = instruction.type.startsWith('Export') && instruction.declaration ? instruction.declaration : instruction;
    if (declaration.type === 'ImportDeclaration') {
      for (const { type, local, imported } of declaration.specifiers) importe.set(local.name, type === 'ImportSpecifier' ? imported.name : '*');
    } else if (declaration.type === 'FunctionDeclaration' || declaration.type === 'ClassDeclaration') {
      lit.set(declaration.id.name, nomsLus(declaration));
    } else if (declaration.type === 'VariableDeclaration') {
      for (const { id, init } of declaration.declarations) for (const nom of nomsLus(id)) lit.set(nom, nomsLus(init));
    }
  }
  assert.ok(lit.has(depart), depart);
  const liaisons = new Set([depart]);
  const importes = new Set();
  const aVoir = [depart];
  while (aVoir.length > 0) {
    for (const nom of lit.get(aVoir.pop())) {
      const [objet, membre] = nom.split('.');
      if (membre !== undefined) {
        if (importe.get(objet) === '*') importes.add(membre);
      } else if (importe.has(nom)) {
        importes.add(importe.get(nom));
      } else if (lit.has(nom) && !liaisons.has(nom)) {
        liaisons.add(nom);
        aVoir.push(nom);
      }
    }
  }
  return { liaisons, importes };
}

// Les fonctions du moteur propres au détail (contrainte 41) : chaque export
// de qualite.js, paires.js et diversite.js, la borne de diversité et les
// occupations.
const FONCTIONS_DU_DETAIL = new Set([
  ...Object.keys(QUALITE),
  ...Object.keys(PAIRES),
  ...Object.keys(DIVERSITE),
  'borneDiversite',
  'occupations',
]);

describe('detaillerQualite : une seule arithmétique (§ 12.9, § 13.2, contrainte 41)', () => {
  test("la ligne d'évaluation et le détail d'une même proposition portent les mêmes rencontres, collisions, excédent et tours hors objectif", () => {
    const { charge } = genereeAvecCourses(chargeAObjectifs(), { graine: 3, nombre: 3, arret: 300 });
    figer(charge);
    const table = evaluer(charge);
    const instance = normaliser(configurationDe(charge));
    assert.equal(table.propositions.length, 3);
    for (const ligne of table.propositions) {
      const detail = detaillerQualite(charge, ligne.id);
      assert.equal(detail.statut, 'comparable');
      assert.equal(detail.id, ligne.id);
      const rang = new Map(detail.profil.map((element) => [element.id, element]));
      instance.ids.forEach((id, p) => {
        assert.equal(rang.get(id).rencontres, ligne.mesures.rencontres[p], `${ligne.id}, ${id}`);
        assert.equal(rang.get(id).plafondRealise, ligne.plafondsRealises[p], `${ligne.id}, ${id}`);
      });
      for (const { groupe, cumulees, excedent, pairesDistinctes } of detail.collisions.lignes) {
        const mesure = ligne.mesures.parGroupe.find((element) => element.groupe === groupe);
        assert.deepEqual([cumulees, excedent, pairesDistinctes], [mesure.collisionsCumulees, mesure.excedent, mesure.pairesDistinctes]);
      }
      const somme = (cle) => detail.collisions.lignes.reduce((total, element) => total + element[cle], 0);
      assert.equal(somme('excedent'), ligne.mesures.excedentCollisions);
      assert.equal(somme('cumulees'), ligne.mesures.collisionsCumulees);
      assert.equal(detail.objectifs.soiree.hors, ligne.mesures.objectifs.horsObjectif);
      assert.equal(detail.bornes.soiree.jamaisServies, ligne.mesures.objectifs.jamaisServies);
      assert.deepEqual(detail.objectifs.critere, { coche: true, sansObjet: false });
      assert.deepEqual(detail.refusDessin, []);
      assert.equal(detail.synthese.minimum, ligne.mesures.aggRencontres.tous.min);
    }
  });

  test("identifiants et noms : personnes dans l'ordre canonique, tables par identifiant, aucun index", () => {
    const { charge } = genereeAvecCourses(chargeDemo('petite-conflit'), { graine: 2, nombre: 1, arret: 200 });
    const instance = normaliser(configurationDe(charge));
    const detail = detaillerQualite(figer(charge), 1);
    const nommee = new Map(charge.participants.map((personne) => [personne.id, personne]));
    assert.deepEqual(
      detail.personnes.map(({ id, nom }) => [id, nom]),
      instance.ids.map((id) => [id, nomAffiche(nommee.get(id))]),
    );
    assert.deepEqual(detail.idsTables, [...instance.idsTables]);
    assert.deepEqual(detail.numerosTables, detail.idsTables.map((id) => charge.tables.find((table) => table.id === id).numero));
    assert.deepEqual([detail.T, detail.R, detail.G], [instance.T, instance.R, instance.groupes.length]);
    assert.deepEqual(detail.population, { mesuree: instance.N, exclue: 0 });
    const ids = new Set(instance.ids);
    for (const { id } of detail.profil) assert.ok(ids.has(id));
    assert.ok(detail.tables.lignes.every(({ table }) => detail.idsTables.includes(table)));
    for (const { a, b, tours } of [...detail.paires.choisies, ...detail.paires.imposees]) {
      assert.ok(ids.has(a) && ids.has(b));
      assert.ok(tours.every(({ table }) => detail.idsTables.includes(table)));
    }
    assert.ok(ids.has(detail.bornes.rang1.id) && ids.has(detail.bornes.manque.id) && ids.has(detail.bornes.diversite.id));
    for (const element of [detail.profil[0], detail.bornes.rang1]) assert.equal(Object.hasOwn(element, 'p'), false);
    assert.ok(detail.collisions.lignes.every((ligne) => !Object.hasOwn(ligne, 'g')));
  });

  test('les planchers des tuiles passent tels que le moteur les rend, sur des plans écrits à la main', () => {
    // La petite démonstration au conflit : l'appartenance de cinq pour
    // quatre tables prouve 4 collisions cumulées, une par tour, et 1 paire
    // distincte ; l'excédent, 4 sous C(5, 2), ne s'écrit pas. « (4, 1) »
    // atteint les deux, « (4, 2) » les cumulées seules, « (6, 6) » aucun.
    const charge = structuredClone(chargeDemo('petite-conflit'));
    charge.propositions = PLANS_CONFLIT.map(({ tours }, rang) => propositionDe(charge, rang + 1, tours));
    charge.prochainsIds.proposition = 5;
    charge.evenement.etat = 'propose';
    figer(charge);
    const collisionsDe = (id) => {
      const { collisionsCumulees, pairesDistinctes, excedentCollisions } = detaillerQualite(charge, id).bornes.planchers;
      return [collisionsCumulees, pairesDistinctes, excedentCollisions];
    };
    assert.deepEqual(collisionsDe(1), [{ plancher: 4, atteint: true }, { plancher: 1, atteint: true }, null]);
    assert.deepEqual(collisionsDe(2), [{ plancher: 4, atteint: true }, { plancher: 1, atteint: false }, null]);
    assert.deepEqual(collisionsDe(3), [{ plancher: 4, atteint: false }, { plancher: 1, atteint: false }, null]);
  });

  test('l’écart d’itinéraire porte son plancher sous le plafond a priori calculé, aucun sous un plafond a priori inconnu', () => {
    // Cinq personnes, une table de trois et une de deux, deux tours : le
    // diagnostic prouve un écart d'itinéraire maximal de 1 au moins. Le
    // plan qui fait passer quatre personnes par la table de deux l'atteint,
    // celui qui y garde les deux mêmes laisse 4 et 5 deux sous leur plafond
    // a priori.
    const charge = chargeDeN(5);
    charge.tables = [3, 2].map((sieges, rang) => ({ id: rang + 1, numero: rang + 1, sieges, forme: 'ronde', position: { x: 300 * rang, y: 0 } }));
    charge.prochainsIds.table = 3;
    charge.propositions = [
      propositionDe(charge, 1, [
        [[1, 2, 3], [4, 5]],
        [[1, 4, 5], [2, 3]],
      ]),
      propositionDe(charge, 2, [
        [[1, 2, 3], [4, 5]],
        [[1, 2, 3], [4, 5]],
      ]),
    ];
    charge.prochainsIds.proposition = 3;
    charge.evenement.etat = 'propose';
    figer(charge);
    assert.deepEqual(detaillerQualite(charge, 1).bornes.planchers.ecartItineraireMax, { plancher: 1, atteint: true });
    assert.deepEqual(detaillerQualite(charge, 2).bornes.planchers.ecartItineraireMax, { plancher: 1, atteint: false });
    assert.equal(evaluer(charge).propositions.find(({ id }) => id === 2).troisChiffres.ecartItineraireMax.tous, 2);
    for (const id of [1, 2]) assert.equal(detaillerQualite(charge, id, { plafondsAPriori: null }).bornes.planchers.ecartItineraireMax, null);
  });

  test("chaque personne en entier — appartenance ou null, statut ancré, partiel ou mobile — et le numéro de chaque table, distinct de son identifiant", () => {
    const charge = structuredClone(chargeDemo('petite-conflit'));
    const [premiere, seconde] = [...charge.tables].sort((a, b) => a.id - b.id);
    // Les numéros dans l'ordre inverse des identifiants, décalés de dix :
    // aucun numéro n'égale l'identifiant de sa table.
    charge.tables.forEach((table, rang) => {
      table.numero = 10 + charge.tables.length - rang;
    });
    charge.participants.find(({ id }) => id === 1).appartenance = null;
    charge.reservations.push({ participant: 2, table: premiere.id, siege: null, portee: 'tous', tour: null });
    charge.reservations.push({ participant: 3, table: seconde.id, siege: null, portee: 'tour', tour: 1 });
    const generation = figer(generee(charge, { graine: 2, nombre: 1, arret: 200 }));
    const instance = normaliser(configurationDe(generation));
    const detail = detaillerQualite(generation, 1);
    assert.equal(detail.statut, 'comparable');
    const nomDuStatut = new Map([
      [STATUT.MOBILE, 'mobile'],
      [STATUT.PARTIELLEMENT_FIXE, 'partiel'],
      [STATUT.ANCRE, 'ancre'],
    ]);
    const nommee = new Map(generation.participants.map((personne) => [personne.id, personne]));
    assert.deepEqual(
      detail.personnes,
      instance.ids.map((id, p) => ({
        id,
        nom: nomAffiche(nommee.get(id)),
        appartenance: instance.groupe[p] === SANS_GROUPE ? null : instance.groupes[instance.groupe[p]],
        statut: nomDuStatut.get(instance.statut[p]),
      })),
    );
    const parId = new Map(detail.personnes.map((personne) => [personne.id, personne]));
    assert.deepEqual(
      [1, 2, 3, 4].map((id) => [parId.get(id).appartenance, parId.get(id).statut]),
      [
        [null, 'mobile'],
        [nommee.get(2).appartenance, 'ancre'],
        [nommee.get(3).appartenance, 'partiel'],
        [nommee.get(4).appartenance, 'mobile'],
      ],
    );
    assert.deepEqual(detail.idsTables, [...instance.idsTables]);
    assert.deepEqual(detail.numerosTables, detail.idsTables.map((id) => generation.tables.find((table) => table.id === id).numero));
    assert.ok(detail.numerosTables.every((numero, rang) => numero !== detail.idsTables[rang]));
  });

  test("le détail ne rend que des listes et des objets simples : figer ne lève pas, aucun tableau typé", () => {
    const { charge, courses } = genereeAvecCourses(chargeAObjectifs(), { graine: 3, nombre: 1, arret: 300 });
    const detail = detaillerQualite(figer(charge), 1, { courseDe: lecteurDe(charge, courses) });
    assert.notEqual(detail.course, null);
    sansTableauType(detail);
    assert.doesNotThrow(() => figer(detail));
  });

  test("le détail ne se calcule jamais dans evaluer : ses lignes gardent leurs champs, et rien de ce qu'evaluer atteint n'appelle une fonction du détail", () => {
    const { charge } = genereeAvecCourses(chargeAObjectifs(), { graine: 3, nombre: 2, arret: 200 });
    const retenue = figer(executer(charge, 'retenirProposition', { id: 1 }));
    const table = evaluer(retenue);
    const CHAMPS = ['id', 'statut', 'raisons', 'sertDeDepart', 'violations', 'mesures', 'plafondsRealises', 'troisChiffres', 'ecartAuPlafondAPrioriMax', 'minimumAtteint', 'refusDessin'];
    for (const ligne of [...table.propositions, table.retenu]) assert.deepEqual(Object.keys(ligne), CHAMPS);
    // Le comptage des appels se fait sur le texte du module : la fermeture
    // de ce qu'evaluer atteint, ligneDe comprise et chaque fonction du
    // module qu'elle appelle, n'importe aucune fonction du détail et
    // n'atteint ni detaillerQualite ni rencontresDePersonne.
    const texte = readFileSync(new URL('./evaluation.js', import.meta.url), 'utf8');
    const deEvaluer = atteintDepuis(texte, 'evaluer');
    assert.ok(deEvaluer.importes.has('mesurer') && deEvaluer.liaisons.has('plusGrand'), 'la fermeture voit les appels de ligneDe');
    assert.deepEqual([...deEvaluer.importes].filter((nom) => FONCTIONS_DU_DETAIL.has(nom)), []);
    assert.deepEqual([...deEvaluer.liaisons].filter((nom) => nom === 'detaillerQualite' || nom === 'rencontresDePersonne'), []);
    const duDetail = atteintDepuis(texte, 'detaillerQualite');
    for (const nom of ['detailler', 'borneDiversite', 'profilRencontres', 'planchersParGroupe']) assert.ok(duDetail.importes.has(nom), nom);
  });
});

// Le diagnostic du moteur dont chaque plancher de collisions et chaque
// plancher des objectifs par tour vaut plancher, pour une épreuve de la
// garde.
const planchersRelevesA = (plancher) => (configuration) => {
  const diagnostic = diagnostiquer(configuration);
  for (const ligne of diagnostic.collisions) ligne.plancherCumulees = plancher;
  diagnostic.objectifsInevitables.parTour.fill(plancher);
  return diagnostic;
};

describe('detaillerQualite : la garde à quatre paramètres (§ 12.3, D31, D42)', () => {
  test('un plan qui assoit chacun à chaque tour et tient ses réservations : planchers valides, segments prouvés', () => {
    const { charge } = genereeAvecCourses(chargeDemo('petite-conflit'), { graine: 2, nombre: 1, arret: 300 });
    const detail = detaillerQualite(figer(charge), 1);
    assert.equal(detail.collisions.planchersValides, true);
    assert.ok(detail.collisions.lignes.every(({ prouve, reste }) => prouve !== null && reste !== null && reste >= 0));
  });

  test("un retenu ajusté qui laisse une personne en réserve : planchers non valides, aucun RESTE_NEGATIF ni RESTE_OBJECTIFS_NEGATIF", () => {
    const charge = chargeAObjectifs();
    // Le plan parfait de la petite démonstration, la personne 10 en réserve
    // aux tours 2 à 4 : une collision, sous le plancher de quatre.
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
    figer(charge);
    for (const id of [1, 'retenu']) {
      // Les planchers relevés au-delà de toute mesure : sur ce plan, où ils
      // ne valent pas, la garde ne les lit pas.
      const detail = detaillerQualite(charge, id, { diagnostiquer: planchersRelevesA(1000) });
      assert.equal(detail.statut, 'comparable', `${id}`);
      assert.equal(detail.collisions.planchersValides, false, `${id}`);
      assert.ok(detail.collisions.lignes.every(({ prouve, reste }) => prouve === null && reste === null), `${id}`);
      // Aucune tuile ne porte de plancher, pas même des 1000 relevés.
      const planchers = Object.entries(detail.bornes.planchers).filter(([, plancher]) => plancher !== null);
      assert.deepEqual(planchers, [], `${id}`);
      const codes = detail.refusDessin.map(({ code }) => code);
      assert.equal(codes.includes('RESTE_NEGATIF'), false, `${id}`);
      assert.equal(codes.includes('RESTE_OBJECTIFS_NEGATIF'), false, `${id}`);
    }
    assert.equal(detaillerQualite(charge, 'retenu').course, null);
  });

  test('une réservation que le plan ne tient pas : planchers non valides', () => {
    const avant = generee(chargeDemo('petite'), { graine: 1, nombre: 1, arret: 200 });
    const [proposition] = avant.propositions;
    const tableDuPremier = proposition.tables.find((_, rang) => !proposition.placement[0].sieges[rang].includes(1));
    const apres = structuredClone(avant);
    apres.reservations.push({ participant: 1, table: tableDuPremier, siege: null, portee: 'tour', tour: 1 });
    assert.equal(evaluer(apres).propositions[0].violations.length, 1);
    const detail = detaillerQualite(figer(apres), proposition.id);
    assert.equal(detail.statut, 'comparable');
    assert.equal(detail.collisions.planchersValides, false);
  });

  test('une borne de diversité dépassée nomme la personne : BORNE_DIVERSITE, son index et son identifiant', () => {
    const { charge } = genereeAvecCourses(chargeDemo('petite-conflit'), { graine: 2, nombre: 1, arret: 300 });
    const instance = normaliser(configurationDe(charge));
    let visee = null;
    // Une borne falsifiée : celle du calcul, moins une pour la première
    // personne qui rencontre au moins une appartenance.
    const falsifiee = (inst, tableDe) => {
      const borne = borneDiversite(inst, tableDe);
      const vues = mesurer(inst, tableDe).appartenancesVues;
      visee = vues.findIndex((a) => a > 0);
      borne.aMax[visee] = vues[visee] - 1;
      return borne;
    };
    const detail = detaillerQualite(figer(charge), 1, { borneDiversite: falsifiee });
    assert.notEqual(visee, null);
    assert.deepEqual(
      detail.refusDessin.filter(({ code }) => code === 'BORNE_DIVERSITE'),
      [{ code: 'BORNE_DIVERSITE', index: visee, participant: instance.ids[visee] }],
    );
    assert.deepEqual(detaillerQualite(charge, 1).refusDessin, []);
  });

  test("un plafond des affiliés dépassé nomme la personne : AFFILIES_PLAFOND, son index et son identifiant", () => {
    const { charge } = genereeAvecCourses(chargeDemo('petite-conflit'), { graine: 2, nombre: 1, arret: 300 });
    const instance = normaliser(configurationDe(charge));
    let visee = null;
    // Une borne falsifiée : Φ_aff de la première personne qui rencontre un
    // affilié au moins, un de moins que ses affiliés rencontrés ; A_max
    // celle du calcul.
    const falsifiee = (inst, tableDe) => {
      const borne = borneDiversite(inst, tableDe);
      const { affilies } = mesurer(inst, tableDe);
      visee = affilies.findIndex((f) => f > 0);
      borne.phiAffilies[visee] = affilies[visee] - 1;
      return borne;
    };
    const detail = detaillerQualite(figer(charge), 1, { borneDiversite: falsifiee });
    assert.notEqual(visee, null);
    assert.deepEqual(detail.refusDessin, [{ code: 'AFFILIES_PLAFOND', index: visee, participant: instance.ids[visee] }]);
  });

  test("sur un plan où les planchers valent, un plancher au-dessus de la mesure : RESTE_NEGATIF nomme l'appartenance, RESTE_OBJECTIFS_NEGATIF le tour", () => {
    const { charge } = genereeAvecCourses(chargeAObjectifs(), { graine: 3, nombre: 1, arret: 300 });
    figer(charge);
    const instance = normaliser(configurationDe(charge));
    const juste = detaillerQualite(charge, 1);
    assert.equal(juste.collisions.planchersValides, true);
    assert.deepEqual(juste.refusDessin, []);
    // Le plancher de la première appartenance que le diagnostic chiffre, et
    // celui du premier tour qui a des places à servir, un au-dessus de ce
    // que le plan mesure : le reste vaut −1, la plus petite violation.
    const [{ groupe }] = diagnostiquer(configurationDe(charge)).collisions;
    const { cumulees } = juste.collisions.lignes.find((ligne) => ligne.groupe === groupe);
    const tour = juste.objectifs.parTour.findIndex(({ possibles }) => possibles > 0);
    const { hors } = juste.objectifs.parTour[tour];
    const releves = (configuration) => {
      const diagnostic = diagnostiquer(configuration);
      diagnostic.collisions.find((ligne) => ligne.groupe === groupe).plancherCumulees = cumulees + 1;
      diagnostic.objectifsInevitables.parTour[tour] = hors + 1;
      return diagnostic;
    };
    const detail = detaillerQualite(charge, 1, { diagnostiquer: releves });
    assert.equal(detail.collisions.planchersValides, true);
    assert.deepEqual(detail.refusDessin, [
      { code: 'RESTE_NEGATIF', groupe: instance.groupes.indexOf(groupe), appartenance: groupe },
      { code: 'RESTE_OBJECTIFS_NEGATIF', tour: tour + 1 },
    ]);
    // Au plancher même, le reste est nul et rien ne se lève.
    const atteints = (configuration) => {
      const diagnostic = diagnostiquer(configuration);
      diagnostic.collisions.find((ligne) => ligne.groupe === groupe).plancherCumulees = cumulees;
      diagnostic.objectifsInevitables.parTour[tour] = hors;
      return diagnostic;
    };
    assert.deepEqual(detaillerQualite(charge, 1, { diagnostiquer: atteints }).refusDessin, []);
  });
});

describe('detaillerQualite : les statuts et les sources (§ 9, § 12, B9)', () => {
  test('une proposition en dérive rend ses raisons, et chaque champ de mesure à null', () => {
    const { charge, courses } = genereeAvecCourses(chargeDemo('petite'), { graine: 1, nombre: 1, arret: 200 });
    const exclue = figer(executer(charge, 'exclureParticipant', { id: charge.participants[0].id }));
    const detail = detaillerQualite(exclue, 1, { courseDe: lecteurDe(exclue, courses) });
    assert.equal(detail.statut, 'derive');
    assert.deepEqual(detail.raisons, evaluer(exclue).propositions[0].raisons);
    for (const champ of CHAMPS_DE_MESURE) assert.equal(detail[champ], null, champ);
    assert.deepEqual(detail.refusDessin, []);
  });

  test('une proposition fautive rend ses fautes', () => {
    const { charge } = genereeAvecCourses(chargeDemo('petite'), { graine: 1, nombre: 1, arret: 200 });
    const fautive = structuredClone(charge);
    fautive.propositions[0].placement[0].reserve.push(fautive.propositions[0].participants[0]);
    const detail = detaillerQualite(figer(fautive), 1);
    assert.equal(detail.statut, 'fautif');
    assert.deepEqual(detail.raisons, fautes(fautive.propositions[0]));
    assert.equal(detail.profil, null);
  });

  test("une personne exclue avant la génération : la population mesurée sans elle, l'exclue comptée à part", () => {
    const exclue = executer(chargeDemo('petite-conflit'), 'exclureParticipant', { id: 5 });
    const detail = detaillerQualite(figer(generee(exclue, { graine: 2, nombre: 1, arret: 200 })), 1);
    assert.equal(detail.statut, 'comparable');
    assert.deepEqual(detail.population, { mesuree: exclue.participants.length - 1, exclue: 1 });
    assert.equal(detail.personnes.some(({ id }) => id === 5), false);
  });

  test("le critère des objectifs décoché : objectifs.critere est l'état que l'instance en donne", () => {
    const depart = chargeAObjectifs();
    depart.reglages.respecterObjectifs = false;
    const charge = figer(generee(depart, { graine: 3, nombre: 1, arret: 200 }));
    const { coche, sansObjet } = normaliser(configurationDe(charge)).etatCriteres.find(({ nom }) => nom === 'toursHorsObjectif');
    const detail = detaillerQualite(charge, 1);
    assert.deepEqual(detail.objectifs.critere, { coche, sansObjet });
    assert.deepEqual(detail.objectifs.critere, { coche: false, sansObjet: false });
  });

  test('null pour une proposition absente ou sans retenu ; plafondsAPriori ni « calcul » ni null lève', () => {
    const { charge } = genereeAvecCourses(chargeDemo('petite'), { graine: 1, nombre: 1, arret: 50 });
    assert.equal(detaillerQualite(charge, 99), null);
    assert.equal(detaillerQualite(charge, 'retenu'), null);
    assert.throws(() => detaillerQualite(charge, 1, { plafondsAPriori: [] }), TypeError);
  });

  test("plafond a priori inconnu : le profil sans a priori, et l'écart des points de relevé absent", () => {
    const { charge, courses } = genereeAvecCourses(chargeDemo('petite-conflit'), { graine: 5, nombre: 1, arret: 300 });
    const detail = detaillerQualite(figer(charge), 1, { courseDe: lecteurDe(charge, courses), plafondsAPriori: null });
    assert.ok(detail.profil.every(({ plafondAPriori }) => plafondAPriori === null));
    assert.equal(detail.course.indicateurs.includes('ecartAuPlafondAPrioriMax'), false);
    assert.deepEqual(detail.course.indicateurs, indicateursDe(evaluer(charge, { plafondsAPriori: null })));
  });

  test(`la matrice seulement jusqu'au seuil : ${constante('SEUIL_MATRICE_PARTICIPANTS')} personnes dans l'ordre du profil, une de plus aucune`, () => {
    const seuil = constante('SEUIL_MATRICE_PARTICIPANTS');
    const auSeuil = detaillerQualite(figer(generee(chargeDeN(seuil), { graine: 1, nombre: 1, arret: 20 })), 1);
    assert.deepEqual(auSeuil.matrice.ordre, auSeuil.profil.map(({ id }) => id));
    assert.equal(auSeuil.matrice.comptes.length, (seuil * (seuil - 1)) / 2);
    const auDela = detaillerQualite(figer(generee(chargeDeN(seuil + 1), { graine: 1, nombre: 1, arret: 20 })), 1);
    assert.equal(auDela.statut, 'comparable');
    assert.equal(auDela.matrice, null);
  });
});

// La petite démonstration au conflit inévitable où 1 et 2, réservés sans
// siège aux tables titrées 1 et 2 pour la soirée, animent à chaque tour, et
// la case des animateurs cochée : le critère des animateurs compte.
function chargeAAnimateurs() {
  const charge = structuredClone(chargeDemo('petite-conflit'));
  charge.titres = [1, 2].map((table) => ({ table, siege: 1, libelle: 'Animation' }));
  charge.reservations = [1, 2].map((participant) => ({ participant, table: participant, siege: null, portee: 'tous', tour: null }));
  charge.reglages.rencontrerAnimateurs = true;
  return charge;
}

// Lève quand un point de relevé de la course de chaque proposition ne porte
// pas, nom pour nom, les valeurs que valeursAttendues lit dans mesurer sur
// son plan, sous la charge reçue ; le dernier point est le plan de la
// proposition. Rend les valeurs de chaque point, proposition après
// proposition.
function pointsMesures(charge, courses, nom) {
  const table = evaluer(charge);
  const instance = normaliser(configurationDe(charge));
  const aPriori = diagnostiquer(configurationDe(charge)).plafondAPriori.parPersonne;
  const points = [];
  for (const proposition of charge.propositions) {
    const course = courseDe({ charge, courses }, proposition.id);
    const detail = detaillerQualite(charge, proposition.id, { courseDe: lecteurDe(charge, courses) });
    assert.deepEqual(detail.course.indicateurs, indicateursDe(table), nom);
    const plans = [...course.releves.map(({ plan }) => plan), planDepuisFichier(proposition)];
    assert.equal(detail.course.releves.length, plans.length, nom);
    plans.forEach((plan, i) => {
      const mesures = mesurer(instance, indexerPlan(instance, plan));
      assert.deepEqual(detail.course.releves[i].valeurs, valeursAttendues(table, mesures, aPriori), `${nom}, ${proposition.id}, point ${i}`);
      points.push({ valeurs: detail.course.releves[i].valeurs, mesures });
    });
  }
  return { indicateurs: indicateursDe(table), points };
}

describe('detaillerQualite : la course de la recherche (§ 5.10, § 12.14, D40, B23)', () => {
  test("chaque point de relevé est mesuré par mesurer sur son plan, sous la charge reçue ; le dernier, aux mouvements évalués, est la ligne de la proposition", () => {
    const { charge, courses } = genereeAvecCourses(chargeAObjectifs(), { graine: 4, nombre: 2, arret: 400 });
    figer(charge);
    const table = evaluer(charge);
    const instance = normaliser(configurationDe(charge));
    const aPriori = diagnostiquer(configurationDe(charge)).plafondAPriori.parPersonne;
    for (const proposition of charge.propositions) {
      const course = courseDe({ charge, courses }, proposition.id);
      const detail = detaillerQualite(charge, proposition.id, { courseDe: lecteurDe(charge, courses) });
      assert.equal(detail.course.source, 'proposition');
      assert.equal(detail.course.propositionDuRetenu, null);
      assert.deepEqual([detail.course.evalues, detail.course.arret], [course.evalues, proposition.arret]);
      assert.deepEqual(detail.course.indicateurs, indicateursDe(table));
      assert.deepEqual(
        detail.course.releves.map(({ mouvements }) => mouvements),
        [...course.releves.map(({ mouvements }) => mouvements), course.evalues],
      );
      const plans = [...course.releves.map(({ plan }) => plan), planDepuisFichier(proposition)];
      plans.forEach((plan, i) => {
        const attendu = valeursAttendues(table, mesurer(instance, indexerPlan(instance, plan)), aPriori);
        assert.deepEqual(detail.course.releves[i].valeurs, attendu, `${proposition.id}, point ${i}`);
      });
      const ligne = table.propositions.find(({ id }) => id === proposition.id);
      assert.deepEqual(detail.course.releves.at(-1).valeurs, valeursAttendues(table, ligne.mesures, aPriori));
      assert.equal(detail.course.releves.at(-1).valeurs.excedentCollisions, ligne.mesures.excedentCollisions);
      assert.ok(detail.course.releves.every((point) => Object.keys(point).join() === 'mouvements,valeurs'), 'aucune durée par point');
    }
  });

  test("sous l'ordre réglé de l'étape 1, paliers et poids, chaque valeur est la grandeur brute, jamais la clé pondérée d'un palier", () => {
    const { charge, courses } = genereeAvecCourses(chargeAObjectifs({ priorites: ORDRE_REGLE }), { graine: 4, nombre: 1, arret: 400 });
    figer(charge);
    const table = evaluer(charge);
    const [ligne] = table.propositions;
    const detail = detaillerQualite(charge, 1, { courseDe: lecteurDe(charge, courses) });
    assert.deepEqual(detail.course.indicateurs, [
      'minimumBrut',
      'ecartAuPlafondAPrioriMax',
      'excedentCollisions',
      'toursHorsObjectif',
      'collisionsCumulees',
      'rencontresRepeteesChoisies',
      'redondance',
    ]);
    for (const { valeurs } of detail.course.releves) assert.deepEqual(Object.keys(valeurs), detail.course.indicateurs);
    const dernier = detail.course.releves.at(-1).valeurs;
    assert.equal(dernier.toursHorsObjectif, ligne.mesures.objectifs.horsObjectif);
    assert.equal(dernier.excedentCollisions, ligne.mesures.excedentCollisions);
    assert.ok(ligne.mesures.objectifs.horsObjectif > 0);
  });

  test("chaque lecture des valeurs, sous les modes chacun et minimum, sans « nouveaux voisins » et les animateurs comptés : chaque point est mesuré par mesurer", () => {
    const TETE = ['minimumBrut', 'ecartAuPlafondAPrioriMax', 'excedentCollisions', 'collisionsCumulees'];
    const sansVoisins = structuredClone(chargeDemo('petite-conflit'));
    sansVoisins.reglages.nouveauxVoisins = false;
    const cas = [
      ['chacun', chargeAObjectifs({ mode: 'chacun' }), [...TETE, 'jamaisServies', 'toursHorsObjectif', 'rencontresRepeteesChoisies', 'redondance']],
      ['minimum', chargeAObjectifs({ mode: 'minimum' }), [...TETE, 'horsObjectifMax', 'toursHorsObjectif', 'rencontresRepeteesChoisies', 'redondance']],
      ['sans nouveaux voisins', sansVoisins, [...TETE, 'retoursChoisis', 'redondance']],
      ['animateurs', chargeAAnimateurs(), [...TETE, 'rencontresRepeteesChoisies', 'animateursNonRencontres', 'redondance']],
    ];
    // La grandeur que chaque cas lit seul, et une voisine qu'une lecture
    // fautive pourrait rendre à sa place : elles diffèrent à un point au
    // moins, sans quoi la comparaison ne départagerait pas les deux.
    const temoins = {
      chacun: ({ valeurs }) => valeurs.jamaisServies !== valeurs.toursHorsObjectif,
      minimum: ({ valeurs }) => valeurs.horsObjectifMax !== valeurs.toursHorsObjectif,
      'sans nouveaux voisins': ({ valeurs, mesures }) => valeurs.retoursChoisis !== mesures.rencontresRepetees.choisies,
      animateurs: ({ valeurs }) => valeurs.animateursNonRencontres !== null,
    };
    for (const [nom, depart, attendus] of cas) {
      const { charge, courses } = genereeAvecCourses(depart, { graine: 4, nombre: 2, arret: 400 });
      const { indicateurs, points } = pointsMesures(figer(charge), courses, nom);
      assert.deepEqual(indicateurs, attendus, nom);
      assert.ok(points.length > charge.propositions.length, `${nom} : des points avant le dernier`);
      assert.ok(points.some(temoins[nom]), `${nom} : le témoin départage`);
    }
  });

  test('le dernier changement : le dernier point dont une valeur diffère du précédent, le premier quand rien ne change', () => {
    const charge = structuredClone(chargeDemo('petite-conflit'));
    charge.propositions = PLANS_CONFLIT.slice(0, 2).map(({ tours }, rang) => propositionDe(charge, rang + 1, tours));
    charge.prochainsIds.proposition = 3;
    charge.evenement.etat = 'propose';
    figer(charge);
    const [final, autre] = charge.propositions.map(planDepuisFichier);
    const avec = (course) => detaillerQualite(charge, 1, { courseDe: () => course }).course;
    const pointsDe = (plans, evalues) => ({ evalues, releves: plans.map((plan, i) => ({ mouvements: 10 ** i, plan })) });
    assert.equal(avec(pointsDe([autre, final, final], 400)).dernierChangement, 10);
    assert.equal(avec(pointsDe([autre, autre, autre], 400)).dernierChangement, 400);
    assert.equal(avec(pointsDe([final, final], 50)).dernierChangement, 1);
    const sansMouvement = avec({ evalues: 0, releves: [] });
    assert.deepEqual(sansMouvement.releves.map(({ mouvements }) => mouvements), [0]);
    assert.equal(sansMouvement.dernierChangement, 0);
  });

  test('la génération : durée, cœurs, cadence et nombre ; une durée nulle ou absente rend null partout où elle sert', () => {
    const { charge, courses } = genereeAvecCourses(chargeDemo('petite-conflit'), { graine: 2, nombre: 2, arret: 300 });
    figer(charge);
    const demandes = [];
    const generationDe = (resume) => (id) => {
      demandes.push(id);
      return resume;
    };
    const avec = (resume) => detaillerQualite(charge, 2, { courseDe: lecteurDe(charge, courses), generationDe: generationDe(resume) }).course.generation;
    assert.deepEqual(avec({ dureeMs: 2000, coeurs: 2, evalues: 5000, nombre: 3 }), { dureeMs: 2000, coeurs: 2, cadence: 2500, nombre: 3 });
    // 2 mouvements en 3 ms : 666,67 par seconde, arrondi à l'entier le plus
    // proche, et non tronqué.
    assert.deepEqual(avec({ dureeMs: 3, coeurs: 1, evalues: 2, nombre: 1 }), { dureeMs: 3, coeurs: 1, cadence: 667, nombre: 1 });
    assert.deepEqual(avec({ dureeMs: 0, coeurs: 2, evalues: 5000, nombre: 3 }), { dureeMs: null, coeurs: 2, cadence: null, nombre: 3 });
    assert.deepEqual(avec(null), { dureeMs: null, coeurs: null, cadence: null, nombre: null });
    assert.deepEqual(demandes, [2, 2, 2, 2]);
    const sansSeance = detaillerQualite(charge, 2, { courseDe: lecteurDe(charge, courses) }).course.generation;
    assert.deepEqual(sansSeance, { dureeMs: null, coeurs: null, cadence: null, nombre: null });
  });

  test('une proposition dont la course n’est pas gardée : course null', () => {
    const { charge } = genereeAvecCourses(chargeDemo('petite-conflit'), { graine: 2, nombre: 1, arret: 300 });
    figer(charge);
    assert.equal(detaillerQualite(charge, 1).course, null);
    assert.equal(detaillerQualite(charge, 1, { courseDe: () => null }).course, null);
    assert.equal(detaillerQualite(charge, 1, { courseDe: lecteurDe(charge, new Map()) }).course, null);
  });

  test("le retenu non ajusté montre la course de sa proposition ; ajusté, ou sa proposition effacée, aucune", () => {
    const { charge, courses } = genereeAvecCourses(chargeDemo('petite-conflit'), { graine: 2, nombre: 2, arret: 300 });
    const retenue = figer(executer(charge, 'retenirProposition', { id: 2 }));
    const demandes = [];
    const options = (sur) => ({
      courseDe: (id) => {
        demandes.push(id);
        return lecteurDe(sur, courses)(id);
      },
      generationDe: () => ({ dureeMs: 1000, coeurs: 1, evalues: 700, nombre: 2 }),
    });
    const proposition = detaillerQualite(retenue, 2, options(retenue));
    const duRetenu = detaillerQualite(retenue, 'retenu', options(retenue));
    assert.equal(duRetenu.id, 'retenu');
    assert.equal(duRetenu.propositionDuRetenu, 2);
    assert.equal(duRetenu.course.source, 'retenu');
    assert.equal(duRetenu.course.propositionDuRetenu, 2);
    assert.deepEqual(duRetenu.course.releves, proposition.course.releves);
    assert.deepEqual(duRetenu.course.generation, { dureeMs: 1000, coeurs: 1, cadence: 700, nombre: 2 });
    assert.deepEqual(demandes, [2, 2]);

    const ajustee = structuredClone(retenue);
    const [premiere, seconde] = ajustee.retenu.placement[0].sieges;
    [premiere[0], seconde[0]] = [seconde[0], premiere[0]];
    premiere.sort((a, b) => a - b);
    seconde.sort((a, b) => a - b);
    figer(ajustee);
    const detailAjuste = detaillerQualite(ajustee, 'retenu', options(ajustee));
    assert.equal(detailAjuste.statut, 'comparable');
    assert.deepEqual([detailAjuste.propositionDuRetenu, detailAjuste.course], [null, null]);

    const effacee = structuredClone(retenue);
    effacee.propositions = [];
    figer(effacee);
    const detailEfface = detaillerQualite(effacee, 'retenu', options(effacee));
    assert.equal(detailEfface.statut, 'comparable');
    assert.deepEqual([detailEfface.propositionDuRetenu, detailEfface.course], [null, null]);
    assert.deepEqual(demandes, [2, 2]);
    assert.equal(detaillerQualite(retenue, 2, options(retenue)).propositionDuRetenu, null);
  });

  test("remesure : un objectif ou l'ordre des priorités changés après la génération ; chaque point se mesure sous la nouvelle charge, le dernier égale sa nouvelle ligne", () => {
    const { charge, courses } = genereeAvecCourses(chargeAObjectifs(), { graine: 4, nombre: 1, arret: 400 });
    figer(charge);
    const avant = detaillerQualite(charge, 1, { courseDe: lecteurDe(charge, courses) });
    const [, seconde] = [...charge.tables].sort((a, b) => a.id - b.id);
    const changees = [
      ['priorités', executer(charge, 'changerPriorites', { paliers: ORDRE_REGLE })],
      ['objectif', executer(charge, 'poserObjectif', { table: seconde.id, tour: null, etiquettes: 'finance', regle: null })],
    ];
    for (const [nom, nouvelle] of changees) {
      figer(nouvelle);
      const table = evaluer(nouvelle);
      const [ligne] = table.propositions;
      assert.equal(ligne.statut, 'comparable', nom);
      const instance = normaliser(configurationDe(nouvelle));
      const aPriori = diagnostiquer(configurationDe(nouvelle)).plafondAPriori.parPersonne;
      const course = courseDe({ charge: nouvelle, courses }, 1);
      const detail = detaillerQualite(nouvelle, 1, { courseDe: lecteurDe(nouvelle, courses) });
      assert.deepEqual(detail.course.indicateurs, indicateursDe(table), nom);
      assert.deepEqual(detail.course.releves.at(-1).valeurs, valeursAttendues(table, ligne.mesures, aPriori), nom);
      const plans = [...course.releves.map(({ plan }) => plan), planDepuisFichier(nouvelle.propositions[0])];
      plans.forEach((plan, i) => {
        const attendu = valeursAttendues(table, mesurer(instance, indexerPlan(instance, plan)), aPriori);
        assert.deepEqual(detail.course.releves[i].valeurs, attendu, `${nom}, point ${i}`);
      });
    }
    const [[, reglee], [, objectif]] = changees;
    assert.notDeepEqual(detaillerQualite(reglee, 1, { courseDe: lecteurDe(reglee, courses) }).course.indicateurs, avant.course.indicateurs);
    const horsAvant = avant.course.releves.map(({ valeurs }) => valeurs.toursHorsObjectif);
    const horsApres = detaillerQualite(objectif, 1, { courseDe: lecteurDe(objectif, courses) }).course.releves.map(({ valeurs }) => valeurs.toursHorsObjectif);
    assert.notDeepEqual(horsApres, horsAvant);
  });
});

// Le dossier des épreuves de la séance, et le jour de la création.
const DOSSIER = { id: 'documents', chemin: 'C:\\Users\\Exemple\\Documents\\Gestion table tournante Libre' };

describe('detaillerQualite : aller-retour par le compagnon des courses (§ 8.6, B31, D53)', () => {
  test("une génération de la séance, puis l'événement rouvert par une autre séance : les mêmes points, la durée inconnue", async () => {
    const charge = structuredClone(chargeDemo('petite-conflit'));
    charge.evenement.nom = 'Soirée des Aubiers';
    charge.evenement.id = 'evt-aubiers';
    const fs = creerFichiersSimules();
    fs.deposerDossier('documents');
    await creerDansLeDepot(fs, DOSSIER, charge, {
      libelle: libelle('ENTREE_CREATION', { nom: charge.evenement.nom }),
      nomJalon: libelle('JALON_CREATION'),
      horodatage: '2031-05-17T07:00:00-04:00',
      produitVersion: V1,
    });
    const horloge = creerHorlogePilotee();
    const seanceSur = (prefixe) => {
      let tirage = 0;
      return creerSeance({
        fs,
        racine: DOSSIER,
        horloge,
        identifiant: () => `${prefixe}-${(tirage += 1)}`,
        produitVersion: V1,
        planifier: horloge.planifier,
        annuler: horloge.annuler,
      });
    };
    const seance = seanceSur('premiere');
    await seance.ouvrir(charge.evenement.nom);
    await seance.passerEnEcriture();
    const controleur = creerControleurGeneration({ seance, executeur: creerExecuteurDirect(), horloge, produitVersion: V1 });
    controleur.subscribe(({ fait }) => {
      if (fait > 0) horloge.avancer(7);
    });
    await controleur.generer({ graine: 2, nombre: 2, arret: 2_000, historique: 1000 });
    const generation = controleur.generationDe(1);
    assert.ok(generation.dureeMs > 0);
    const dansLaSeance = detaillerQualite(seance.etat().charge, 1, { courseDe: seance.courseDe, generationDe: controleur.generationDe });
    assert.deepEqual(dansLaSeance.course.generation, {
      dureeMs: generation.dureeMs,
      coeurs: generation.coeurs,
      cadence: Math.round((generation.evalues * 1000) / generation.dureeMs),
      nombre: 2,
    });

    const autre = seanceSur('seconde');
    await autre.ouvrir(charge.evenement.nom);
    const relue = autre.etat().charge;
    assert.notEqual(relue, seance.etat().charge);
    const autreControleur = creerControleurGeneration({ seance: autre, executeur: creerExecuteurDirect(), horloge, produitVersion: V1 });
    const rouverte = detaillerQualite(relue, 1, { courseDe: autre.courseDe, generationDe: autreControleur.generationDe });
    assert.deepEqual(rouverte.course.releves, dansLaSeance.course.releves);
    assert.ok(rouverte.course.releves.length > 1);
    assert.deepEqual(rouverte.course.generation, { dureeMs: null, coeurs: null, cadence: null, nombre: null });
    assert.deepEqual(rouverte.profil, dansLaSeance.profil);
  });
});

describe('rencontresDePersonne : la ligne de la fiche (§ 12.5, D33)', () => {
  test('mesurée : chaque personne rencontrée, en identifiants et noms, comme rencontresDe ; du retenu comme de sa proposition', () => {
    const { charge } = genereeAvecCourses(chargeDemo('petite-conflit'), { graine: 2, nombre: 1, arret: 300 });
    const retenue = figer(executer(charge, 'retenirProposition', { id: 1 }));
    const instance = normaliser(configurationDe(retenue));
    const tableDe = indexerPlan(instance, planDepuisFichier(retenue.propositions[0]));
    const nommee = new Map(retenue.participants.map((personne) => [personne.id, personne]));
    for (const personne of [1, 5, 12]) {
      const attendues = PAIRES.rencontresDe(instance, tableDe, instance.indexDe.get(personne)).map(({ q, fois, tours }) => ({
        id: instance.ids[q],
        nom: nomAffiche(nommee.get(instance.ids[q])),
        fois,
        tours: tours.map(({ tour, t }) => ({ tour, table: instance.idsTables[t] })),
      }));
      assert.ok(attendues.length > 0);
      assert.deepEqual(rencontresDePersonne(retenue, 1, personne), { source: 1, statut: 'mesuree', lignes: attendues });
      assert.deepEqual(rencontresDePersonne(retenue, 'retenu', personne), { source: 'retenu', statut: 'mesuree', lignes: attendues });
    }
  });

  test('exclue, source non mesurable, sans placement ; une personne inconnue lève', () => {
    const { charge } = genereeAvecCourses(chargeDemo('petite-conflit'), { graine: 2, nombre: 1, arret: 300 });
    const exclue = figer(executer(charge, 'exclureParticipant', { id: 5 }));
    assert.deepEqual(rencontresDePersonne(exclue, 1, 5), { source: 1, statut: 'exclue', lignes: [] });
    assert.deepEqual(rencontresDePersonne(exclue, 1, 6), { source: 1, statut: 'nonMesurable', lignes: [] });
    assert.deepEqual(rencontresDePersonne(charge, null, 6), { source: null, statut: 'sansPlacement', lignes: [] });
    assert.deepEqual(rencontresDePersonne(charge, 99, 6), { source: 99, statut: 'sansPlacement', lignes: [] });
    assert.deepEqual(rencontresDePersonne(charge, 'retenu', 6), { source: 'retenu', statut: 'sansPlacement', lignes: [] });
    const fautive = structuredClone(charge);
    fautive.propositions[0].placement[0].reserve.push(fautive.propositions[0].participants[0]);
    assert.equal(rencontresDePersonne(figer(fautive), 1, 6).statut, 'nonMesurable');
    // Quatre réservations à une table de trois places, posées après la
    // génération : le placement ne dérive pas, la configuration ne se
    // normalise plus.
    const surreservee = structuredClone(charge);
    surreservee.reservations = [1, 2, 3, 4].map((participant) => ({ participant, table: charge.tables[0].id, siege: null, portee: 'tous', tour: null }));
    figer(surreservee);
    assert.deepEqual(fautes(surreservee.propositions[0]), []);
    assert.deepEqual(deriveSansRevalider(surreservee.propositions[0], surreservee), []);
    assert.throws(() => normaliser(configurationDe(surreservee)), (erreur) => erreur instanceof ErreurConfiguration);
    assert.deepEqual(rencontresDePersonne(surreservee, 1, 6), { source: 1, statut: 'nonMesurable', lignes: [] });
    assert.throws(() => rencontresDePersonne(charge, 1, 999), RangeError);
  });
});

// --- La comparaison de deux placements (§ 12.10.6, D56 à D67, D83 à D85) ----

// La petite démonstration, quatre propositions générées et classées
// [4, 1, 2, 3] : 1 et 4 ont le même profil de manque, 1 et 3 basculent une
// fois, 4 sert mieux que 2 à tous les rangs, et le rang 1 du profil des
// rencontres n'est pas la même personne pour 4 et pour 3.
const chargeComparee = () => generee(chargeDemo('petite'), { graine: 2, nombre: 4, arret: 60 });

// La charge dont la proposition id est devenue une dérivée de depart, ses
// tours figés donnés, comme versFichier l'écrit.
function deriver(charge, id, depart, toursFiges = []) {
  const copie = structuredClone(charge);
  const proposition = copie.propositions.find((element) => element.id === id);
  proposition.depart = depart;
  if (toursFiges.length > 0) proposition.toursFiges = [...toursFiges];
  return copie;
}

// La charge dont le retenu est tiré de la proposition id ; ajusté : deux
// personnes des deux premières tables échangées au premier tour, les listes
// gardées croissantes.
function avecRetenu(charge, id, { ajuste = false } = {}) {
  const copie = structuredClone(charge);
  copie.retenu = retenuDe(copie.propositions.find((element) => element.id === id));
  if (ajuste) {
    const [premiere, seconde] = copie.retenu.placement[0].sieges;
    [premiere[0], seconde[0]] = [seconde[0], premiere[0]];
    for (const liste of [premiere, seconde]) liste.sort((x, y) => x - y);
  }
  copie.evenement.etat = 'retenu';
  return copie;
}

// La charge sans les propositions nommées.
function sans(charge, ids) {
  const copie = structuredClone(charge);
  copie.propositions = copie.propositions.filter(({ id }) => !ids.includes(id));
  return copie;
}

// La charge dont la proposition id est fautive : une personne déjà assise
// au premier tour mise aussi en réserve.
function rendreFautive(charge, id) {
  const copie = structuredClone(charge);
  const proposition = copie.propositions.find((element) => element.id === id);
  proposition.placement[0].reserve.push(proposition.participants[0]);
  return copie;
}

// La table dont la ligne de la proposition id (ou du retenu) est remplacée
// par ce que forger fait d'une copie d'elle.
function tableForgee(table, cle, forger) {
  const forgee = (ligne) => {
    const copie = structuredClone(ligne);
    forger(copie);
    return copie;
  };
  if (cle === 'retenu') return { ...table, retenu: forgee(table.retenu) };
  return { ...table, propositions: table.propositions.map((ligne) => (ligne.id === cle ? forgee(ligne) : ligne)) };
}

// Pose le manque voulu de chaque personne d'une ligne : ses rencontres
// deviennent son plafond réalisé moins ce manque.
const poserManques = (voulus) => (ligne) => {
  voulus.forEach((manque, p) => {
    ligne.mesures.rencontres[p] = ligne.plafondsRealises[p] - manque;
  });
};

// Les champs de bornes que portent les colonnes de la comparaison.
const bornesDesColonnes = ({ rang1, manque, objectifs, soiree, planchers }) => ({ rang1, manque, objectifs, soiree, planchers });

// La ligne d'évaluation d'un placement de la table.
const ligneDe = (table, cle) => (cle === 'retenu' ? table.retenu : table.propositions.find(({ id }) => id === cle));

// Le profil de manque d'une ligne, par les fonctions du moteur.
const profilDeLigne = (instance, ligne) =>
  profilManque(instance, manques(ligne.plafondsRealises, ligne.mesures.rencontres), ligne.plafondsRealises);

const cles = ({ candidats }) => candidats.map(({ cle }) => cle);

describe('comparaison : le second placement, ses candidats et son défaut (§ 12.10.6, D56, D58, D85, C14, C20)', () => {
  test('rouge : le défaut du second placement suit ses quatre branches', () => {
    const base = chargeComparee();
    assert.deepEqual(evaluer(base).classement.ordre, [4, 1, 2, 3]);
    const defautDe = (charge, a) => candidatsDeComparaison(charge, evaluer(figer(charge)), a).defaut;
    // A dérivée : son départ, avant la première du classement.
    const derivee = deriver(base, 3, 2, [1]);
    assert.equal(defautDe(derivee, 3), 2);
    // A retenu ajusté : sa proposition d'origine.
    assert.equal(defautDe(avecRetenu(base, 2, { ajuste: true }), 'retenu'), 2);
    // Sinon la première du classement, retenu présent ou non ; A en tête du
    // classement : la suivante.
    assert.equal(defautDe(base, 2), 4);
    assert.equal(defautDe(avecRetenu(base, 2, { ajuste: true }), 1), 4);
    assert.equal(defautDe(base, 4), 1);
    // Sinon le retenu : une seule proposition et le retenu ajusté.
    const seule = sans(base, [1, 2, 3]);
    assert.equal(defautDe(avecRetenu(seule, 4, { ajuste: true }), 4), 'retenu');
    // Le départ effacé : la branche suivante.
    assert.equal(defautDe(sans(derivee, [2]), 3), 4);
    // La proposition d'origine effacée : le retenu est ajusté, et la branche
    // suivante vaut.
    assert.equal(defautDe(sans(avecRetenu(base, 2), [2]), 'retenu'), 4);
    // Un retenu non ajusté venu d'une dérivée : le départ de sa proposition.
    assert.equal(defautDe(avecRetenu(derivee, 3), 'retenu'), 2);
    // Un retenu non ajusté et sa proposition ne sont jamais candidats l'un de
    // l'autre.
    const retenue = figer(avecRetenu(base, 4));
    const table = evaluer(retenue);
    assert.deepEqual(candidatsDeComparaison(retenue, table, 'retenu'), {
      candidats: [{ cle: 1, rang: 2 }, { cle: 2, rang: 3 }, { cle: 3, rang: 4 }],
      defaut: 1,
    });
    assert.deepEqual(cles(candidatsDeComparaison(retenue, table, 4)), [1, 2, 3]);
    // Sans candidat : null.
    assert.deepEqual(candidatsDeComparaison(seule, evaluer(seule), 4), { candidats: [], defaut: null });
    const seuleRetenue = avecRetenu(seule, 4);
    assert.deepEqual(candidatsDeComparaison(seuleRetenue, evaluer(seuleRetenue), 'retenu'), { candidats: [], defaut: null });
  });

  test('les candidats : le retenu d’abord, puis les comparables dans l’ordre du classement, chacun à sa place ; ni A, ni son identique, ni une ligne qui ne se compare pas', () => {
    const base = rendreFautive(avecRetenu(chargeComparee(), 2), 3);
    const table = evaluer(figer(base));
    assert.deepEqual(table.classement.ordre, [4, 1, 2]);
    // Le retenu non ajusté prend la place de sa proposition.
    assert.deepEqual(candidatsDeComparaison(base, table, 1).candidats, [
      { cle: 'retenu', rang: 3 },
      { cle: 4, rang: 1 },
      { cle: 2, rang: 3 },
    ]);
    assert.deepEqual(cles(candidatsDeComparaison(base, table, 2)), [4, 1]);
    assert.deepEqual(cles(candidatsDeComparaison(base, table, 'retenu')), [4, 1]);
    // Le retenu ajusté ne se classe pas, et n'est identique à aucune.
    const ajustee = rendreFautive(avecRetenu(chargeComparee(), 2, { ajuste: true }), 3);
    const tableAjustee = evaluer(figer(ajustee));
    assert.deepEqual(candidatsDeComparaison(ajustee, tableAjustee, 2).candidats, [
      { cle: 'retenu', rang: null },
      { cle: 4, rang: 1 },
      { cle: 1, rang: 2 },
    ]);
    assert.deepEqual(cles(candidatsDeComparaison(ajustee, tableAjustee, 'retenu')), [4, 1, 2]);
    // Un retenu fautif n'est pas candidat.
    const retenuFautif = structuredClone(base);
    retenuFautif.retenu.placement[0].reserve.push(retenuFautif.retenu.participants[0]);
    assert.deepEqual(cles(candidatsDeComparaison(retenuFautif, evaluer(figer(retenuFautif)), 1)), [4, 2]);
    // A qui n'est pas un placement mesurable ne retire que lui-même.
    const sansRetenu = figer(rendreFautive(chargeComparee(), 3));
    const tableSansRetenu = evaluer(sansRetenu);
    assert.deepEqual(candidatsDeComparaison(sansRetenu, tableSansRetenu, 'retenu'), {
      candidats: [{ cle: 4, rang: 1 }, { cle: 1, rang: 2 }, { cle: 2, rang: 3 }],
      defaut: 4,
    });
    assert.deepEqual(cles(candidatsDeComparaison(sansRetenu, tableSansRetenu, 3)), [4, 1, 2]);
  });

  test('comparaisonOfferte : vrai dès deux placements mesurables et distincts, un retenu non ajusté et sa proposition comptant pour un', () => {
    const base = chargeComparee();
    const offerte = (charge) => comparaisonOfferte(charge, evaluer(figer(charge)));
    assert.equal(offerte(base), true);
    const seule = sans(base, [1, 2, 3]);
    assert.equal(offerte(seule), false);
    assert.equal(offerte(avecRetenu(seule, 4)), false);
    assert.equal(offerte(avecRetenu(seule, 4, { ajuste: true })), true);
    // Le même retenu ajusté, fautif : il ne se mesure pas et ne compte pas, la
    // seule proposition reste seule.
    const retenuFautif = avecRetenu(seule, 4, { ajuste: true });
    retenuFautif.retenu.placement[0].reserve.push(retenuFautif.retenu.participants[0]);
    assert.equal(evaluer(figer(retenuFautif)).retenu.statut, 'fautif');
    assert.equal(offerte(retenuFautif), false);
    assert.equal(offerte(rendreFautive(sans(base, [1, 2]), 3)), false);
    assert.equal(offerte(sans(base, [1, 2])), true);
    assert.equal(offerte(sans(base, [1, 2, 3, 4])), false);
  });
});

describe('comparerPlacements : deux lignes de la table, une seule arithmétique (§ 12.10.6, D60 à D67, D83, C20, C22, C29)', () => {
  test('les bornes de chaque côté sont, champ pour champ, celles du détail de son placement, personnes sous id et plafond a priori compris', () => {
    // La seconde charge réserve 7 et 8 ensemble à la deuxième table pour la
    // soirée : leur plafond a priori tombe sous celui des autres, et le rang 1
    // de chaque côté est l'un d'eux, loin de l'index 0.
    const reservee = chargeAObjectifs();
    reservee.reservations = [7, 8].map((participant) => ({ participant, table: reservee.tables[1].id, siege: null, portee: 'tous', tour: null }));
    for (const depart of [chargeAObjectifs(), reservee]) {
      const generees = generee(depart, { graine: 3, nombre: 3, arret: 300 });
      let distingues = 0;
      let lignesDistinguees = 0;
      for (const charge of [avecRetenu(generees, 2), avecRetenu(generees, 2, { ajuste: true })]) {
        figer(charge);
        for (const plafondsAPriori of ['calcul', null]) {
          const table = evaluer(charge, { plafondsAPriori });
          const [premiere, seconde] = table.classement.ordre;
          for (const [a, b] of [[premiere, seconde], ['retenu', premiere], [seconde, 'retenu']]) {
            const comparaison = comparerPlacements(charge, table, a, b);
            for (const [cote, cle] of [['a', a], ['b', b]]) {
              const detail = detaillerQualite(charge, cle, { plafondsAPriori });
              assert.notEqual(detail.bornes.objectifs, null);
              assert.equal(detail.bornes.rang1.plafondAPriori === null, plafondsAPriori === null);
              assert.deepEqual(comparaison[cote].bornes, bornesDesColonnes(detail.bornes), `${cote} ${cle} ${plafondsAPriori}`);
              // Le plafond a priori du rang 1 est celui de sa personne dans la population.
              const { rang1 } = comparaison[cote].bornes;
              const p = table.population.indexOf(rang1.id);
              assert.equal(rang1.plafondAPriori, plafondsAPriori === null ? null : table.plafondsAPriori[p], `${cote} ${cle}`);
              if (plafondsAPriori !== null && table.plafondsAPriori[p] !== table.plafondsAPriori[0]) distingues += 1;
              // Chaque ligne du profil porte, de même, le plafond a priori de
              // sa propre personne.
              for (const l of comparaison.profils?.[cote] ?? []) {
                const q = table.population.indexOf(l.id);
                assert.equal(l.plafondAPriori, plafondsAPriori === null ? null : table.plafondsAPriori[q], `${cote} ${cle} ${l.id}`);
                if (plafondsAPriori !== null && table.plafondsAPriori[q] !== table.plafondsAPriori[0]) lignesDistinguees += 1;
              }
            }
          }
          if (depart === reservee && plafondsAPriori !== null) assert.ok(new Set(table.plafondsAPriori).size > 1);
        }
      }
      // Sur la charge réservée, un rang 1 au moins ne partage pas le plafond
      // a priori de la première personne : le champ se lit à sa place.
      if (depart === reservee) assert.ok(distingues > 0, 'aucun rang 1 ne se distingue de la première personne');
      if (depart === reservee) assert.ok(lignesDistinguees > 0, 'aucune ligne de profil ne se distingue de la première personne');
    }
  });

  test('hors du domaine des planchers — une personne en réserve à un tour, une réservation que le retenu ne tient pas —, chaque colonne de planchers de ce côté vaut null, comme dans le détail', () => {
    const generees = figer(generee(chargeAObjectifs(), { graine: 3, nombre: 3, arret: 300 }));
    // Les planchers d'un côté, ceux de son détail, et vrai quand chaque
    // colonne vaut null.
    const planchersDesCotes = (charge, a, b) => {
      const comparaison = comparerPlacements(charge, evaluer(charge), a, b);
      return [['a', a], ['b', b]].map(([cote, cle]) => {
        const { planchers } = comparaison[cote].bornes;
        assert.deepEqual(planchers, bornesDesColonnes(detaillerQualite(charge, cle).bornes).planchers, `${cote} ${cle}`);
        return Object.values(planchers).every((colonne) => colonne === null);
      });
    };
    // La référence : sur le domaine des planchers, chaque côté en porte.
    assert.deepEqual(planchersDesCotes(generees, 1, 2), [false, false]);

    // La première personne de la première table du premier tour de la
    // proposition 1 passe en réserve à ce tour : aucune violation, un tour
    // sans siège.
    const enReserve = structuredClone(generees);
    const proposition = enReserve.propositions.find(({ id }) => id === 1);
    assert.equal(proposition.siegesAttribues, false);
    proposition.placement[0].reserve.push(...proposition.placement[0].sieges[0].splice(0, 1));
    figer(enReserve);
    const ligneEnReserve = ligneDe(evaluer(enReserve), 1);
    assert.equal(ligneEnReserve.statut, 'comparable');
    assert.deepEqual(ligneEnReserve.violations, []);
    assert.ok(ligneEnReserve.mesures.toursAssis.some((assis) => assis < enReserve.evenement.tours));
    assert.deepEqual(planchersDesCotes(enReserve, 1, 2), [true, false]);

    // Le retenu, tiré de la proposition 2, ne tient pas la réservation de
    // la personne 1 à une autre table au premier tour : chacun assis à
    // chaque tour, une violation RESERVATION.
    const nonTenue = avecRetenu(generees, 2);
    const sienne = nonTenue.retenu.placement[0].sieges.findIndex((liste) => liste.includes(1));
    const autre = nonTenue.retenu.tables.find((_, t) => t !== sienne);
    nonTenue.reservations = [{ participant: 1, table: autre, siege: null, portee: 'tour', tour: 1 }];
    figer(nonTenue);
    const ligneNonTenue = ligneDe(evaluer(nonTenue), 'retenu');
    assert.deepEqual(ligneNonTenue.violations, [{ code: 'RESERVATION', participant: 1, table: autre, tour: 1 }]);
    assert.ok(ligneNonTenue.mesures.toursAssis.every((assis) => assis === nonTenue.evenement.tours));
    assert.deepEqual(planchersDesCotes(nonTenue, 'retenu', 1), [true, true]);
  });

  test('rouge : le pourcentage de chaque colonne est celui du pire cas de son placement, deux personnes différentes, jamais une moyenne', () => {
    const charge = figer(chargeComparee());
    const table = evaluer(charge);
    const comparaison = comparerPlacements(charge, table, 4, 3);
    const { rang1: rang1A } = comparaison.a.bornes;
    const { rang1: rang1B } = comparaison.b.bornes;
    assert.notEqual(rang1A.id, rang1B.id);
    assert.notEqual(rang1A.pourcent, rang1B.pourcent);
    const somme = (valeurs) => Array.from(valeurs).reduce((total, valeur) => total + valeur, 0);
    for (const [cote, cle] of [['a', 4], ['b', 3]]) {
      const { rang1 } = comparaison[cote].bornes;
      const ligne = ligneDe(table, cle);
      const p = table.population.indexOf(rang1.id);
      assert.deepEqual([rang1.rencontres, rang1.plafondRealise], [ligne.mesures.rencontres[p], ligne.plafondsRealises[p]]);
      assert.equal(rang1.pourcent, QUALITE.pourcentage(ligne.mesures.rencontres[p], ligne.plafondsRealises[p]));
      assert.notEqual(rang1.pourcent, QUALITE.pourcentage(somme(ligne.mesures.rencontres), somme(ligne.plafondsRealises)));
      // Le pire cas : personne n'a moins de rencontres.
      assert.equal(rang1.rencontres, Math.min(...ligne.mesures.rencontres));
    }
  });

  test('profils, rangs, borne haute, valeurs distinctes et escalier : ceux du moteur sur les deux lignes ; domine traduit en côté ; les cumuls reproduisent la courbe', () => {
    const charge = figer(chargeComparee());
    const table = evaluer(charge);
    const instance = normaliser(configurationDe(charge));
    const attendus = { '1,3': { bascule: 9, domine: null }, '4,2': { bascule: null, domine: 'a' }, '2,4': { bascule: null, domine: 'b' } };
    for (const [a, b] of [[1, 3], [4, 2], [2, 4]]) {
      const comparaison = comparerPlacements(charge, table, a, b);
      const [ligneA, ligneB] = [ligneDe(table, a), ligneDe(table, b)];
      const [profilA, profilB] = [profilDeLigne(instance, ligneA), profilDeLigne(instance, ligneB)];
      const moteur = comparerProfils(profilA, profilB);
      assert.equal(comparaison.statut, 'comparable');
      assert.deepEqual([comparaison.refusDessin, comparaison.populations, comparaison.indiscernables], [null, null, null]);
      assert.deepEqual(comparaison.rangs, {
        a: moteur.rangsA,
        b: moteur.rangsB,
        egalite: moteur.egalite,
        bascule: moteur.rangBascule,
        domine: { A: 'a', B: 'b' }[moteur.domine] ?? null,
      });
      assert.deepEqual({ bascule: comparaison.rangs.bascule, domine: comparaison.rangs.domine }, attendus[`${a},${b}`]);
      for (const [cote, ligne, profil] of [['a', ligneA, profilA], ['b', ligneB, profilB]]) {
        assert.deepEqual(
          comparaison.profils[cote],
          profil.map(({ id, manque, plafondRealise }) => {
            const p = table.population.indexOf(id);
            return { id, manque, rencontres: ligne.mesures.rencontres[p], plafondRealise, plafondAPriori: table.plafondsAPriori[p] };
          }),
        );
      }
      assert.equal(comparaison.borneHaute, borneHaute(profilA, profilB));
      assert.equal(comparaison.valeursDistinctes, valeursDistinctes(profilA, profilB));
      assert.equal(comparaison.trace, comparaison.valeursDistinctes >= constante('VALEURS_MANQUE_COURBE'));
      assert.deepEqual(comparaison.escalier, escalierDuManque(profilA, profilB));
      // Le cumul d'une valeur est le dernier rang où la courbe l'atteint.
      for (const { valeur, a: escalierA, b: escalierB } of comparaison.escalier) {
        for (const [{ cumul }, profil] of [[escalierA, comparaison.profils.a], [escalierB, comparaison.profils.b]]) {
          if (cumul > 0) assert.ok(profil[cumul - 1].manque >= valeur, `${valeur} ${cumul}`);
          if (cumul < profil.length) assert.ok(profil[cumul].manque < valeur, `${valeur} ${cumul}`);
        }
      }
    }
  });

  test('le tracé au seuil du registre, la phrase au seuil moins un : la règle porte sur les deux profils réunis', () => {
    const charge = figer(chargeComparee());
    const table = evaluer(charge);
    const seuil = constante('VALEURS_MANQUE_COURBE');
    // A prend les valeurs 0 à k − 1, B n'a aucun manque : k valeurs réunies.
    const forgee = (k) =>
      tableForgee(
        tableForgee(table, 4, poserManques(table.population.map((_, p) => (p < k ? p : 0)))),
        1,
        poserManques(table.population.map(() => 0)),
      );
    const auSeuil = comparerPlacements(charge, forgee(seuil), 4, 1);
    assert.deepEqual([auSeuil.statut, auSeuil.valeursDistinctes, auSeuil.trace], ['comparable', seuil, true]);
    const sousLeSeuil = comparerPlacements(charge, forgee(seuil - 1), 4, 1);
    assert.deepEqual([sousLeSeuil.statut, sousLeSeuil.valeursDistinctes, sousLeSeuil.trace], ['comparable', seuil - 1, false]);
    assert.equal(sousLeSeuil.escalier.length, seuil - 1);
  });

  test('rouge : un refus de dessin sur la seule ligne de B refuse toute la comparaison et nomme B ; sur A, ou sur les deux, nomme A', () => {
    const charge = figer(chargeComparee());
    const table = evaluer(charge);
    const violations = [{ code: 'DEPASSEMENT', index: 0, participant: table.population[0] }];
    const refuser = (ligne) => {
      ligne.refusDessin = structuredClone(violations);
    };
    const refuseeB = comparerPlacements(charge, tableForgee(table, 3, refuser), 1, 3);
    assert.equal(refuseeB.statut, 'refusDessin');
    assert.deepEqual(refuseeB.refusDessin, { cote: 'b', violations });
    assert.deepEqual(
      [refuseeB.populations, refuseeB.profils, refuseeB.rangs, refuseeB.borneHaute, refuseeB.valeursDistinctes, refuseeB.trace, refuseeB.escalier, refuseeB.indiscernables],
      [null, null, null, null, null, false, null, null],
    );
    assert.deepEqual(comparerPlacements(charge, tableForgee(table, 1, refuser), 1, 3).refusDessin, { cote: 'a', violations });
    const lesDeux = tableForgee(tableForgee(table, 1, refuser), 3, refuser);
    assert.equal(comparerPlacements(charge, lesDeux, 1, 3).refusDessin.cote, 'a');
    assert.equal(comparerPlacements(charge, lesDeux, 3, 1).refusDessin.cote, 'a');
  });

  test('populations différentes : une charge falsifiée où B déclare une personne que A ne place pas — ni profil ni rangs, les personnes de chaque côté nommées', () => {
    const charge = chargeComparee();
    const table = evaluer(figer(charge));
    const falsifiee = structuredClone(charge);
    const proposition = falsifiee.propositions.find(({ id }) => id === 3);
    proposition.participants = proposition.participants.map((id) => (id === 12 ? 99 : id));
    const comparaison = comparerPlacements(figer(falsifiee), table, 1, 3);
    assert.equal(comparaison.statut, 'populationsDifferentes');
    assert.deepEqual(comparaison.populations, { seulementA: [12], seulementB: [99] });
    assert.deepEqual(
      [comparaison.refusDessin, comparaison.profils, comparaison.rangs, comparaison.borneHaute, comparaison.valeursDistinctes, comparaison.trace, comparaison.escalier, comparaison.indiscernables],
      [null, null, null, null, null, false, null, null],
    );
  });

  test('total : les autres personnes de la population, N − 1, communes aux deux côtés et sous chaque statut (§ 12.10.3, D66)', () => {
    const charge = figer(chargeComparee());
    const table = evaluer(charge);
    const autres = table.population.length - 1;
    assert.ok(autres > 1);
    const comparable = comparerPlacements(charge, table, 1, 3);
    assert.equal(comparable.statut, 'comparable');
    assert.equal(comparable.total, autres);
    // Chaque ligne du profil désigne l'une des N personnes : N − 1 autres.
    assert.equal(comparable.total, comparable.profils.a.length - 1);
    assert.equal(comparable.total, comparable.profils.b.length - 1);
    const refuser = (ligne) => {
      ligne.refusDessin = [{ code: 'DEPASSEMENT', index: 0, participant: table.population[0] }];
    };
    const refusee = comparerPlacements(charge, tableForgee(table, 3, refuser), 1, 3);
    assert.deepEqual([refusee.statut, refusee.total], ['refusDessin', autres]);
    const falsifiee = structuredClone(charge);
    const proposition = falsifiee.propositions.find(({ id }) => id === 3);
    proposition.participants = proposition.participants.map((id) => (id === 12 ? 99 : id));
    const populations = comparerPlacements(figer(falsifiee), table, 1, 3);
    assert.deepEqual([populations.statut, populations.total], ['populationsDifferentes', autres]);
  });

  test('rouge : indiscernables — entre deux propositions, le premier palier qui les départage, puis l’identifiant ; avec le retenu, l’indiscernabilité seule', () => {
    const base = chargeComparee();
    // La proposition 5, copie de la 1 : mêmes clés à chaque palier.
    const copie = structuredClone(base);
    copie.propositions.push({ ...structuredClone(copie.propositions.find(({ id }) => id === 1)), id: 5, graine: 5 });
    copie.prochainsIds.proposition = 6;
    const charge = figer(avecRetenu(copie, 1));
    const table = evaluer(charge);
    const instance = normaliser(configurationDe(charge));
    const entree = (id) => ({ id, mesures: ligneDe(table, id).mesures, plafondsAPriori: table.plafondsAPriori });
    const palier = premierPalierQuiDepartage(entree(1), entree(4), compilationDe(instance));
    assert.notEqual(palier, null);
    assert.deepEqual(comparerPlacements(charge, table, 1, 4).indiscernables, { palier, retenu: false });
    assert.deepEqual(comparerPlacements(charge, table, 1, 5).indiscernables, { palier: null, retenu: false });
    // Le retenu contre sa proposition, et contre une autre de même profil.
    for (const [a, b] of [['retenu', 1], [1, 'retenu'], ['retenu', 4], [4, 'retenu']]) {
      assert.deepEqual(comparerPlacements(charge, table, a, b).indiscernables, { palier: null, retenu: true }, `${a} ${b}`);
    }
    assert.equal(comparerPlacements(charge, table, 1, 3).indiscernables, null);
  });

  test('chaque côté : sa clé, sa place au classement — celle de sa proposition pour un retenu non ajusté, null ajusté —, ajusté ou non, sa filiation', () => {
    const derivee = deriver(chargeComparee(), 3, 2, [1]);
    const nonAjuste = figer(avecRetenu(derivee, 3));
    const table = evaluer(nonAjuste);
    const comparaison = comparerPlacements(nonAjuste, table, 'retenu', 4);
    const filiation = { depart: 2, toursFiges: [1], departPresent: true };
    assert.deepEqual(derivationDe(nonAjuste, 3), filiation);
    const { bornes: _a, ...coteA } = comparaison.a;
    const { bornes: _b, ...coteB } = comparaison.b;
    assert.deepEqual(coteA, { cle: 'retenu', rang: table.classement.ordre.indexOf(3) + 1, ajuste: false, derivation: filiation });
    assert.deepEqual(coteB, { cle: 4, rang: 1, ajuste: false, derivation: null });
    assert.deepEqual(comparerPlacements(nonAjuste, table, 4, 3).b.derivation, filiation);
    const ajuste = figer(avecRetenu(derivee, 3, { ajuste: true }));
    const { bornes: _c, ...coteAjuste } = comparerPlacements(ajuste, evaluer(ajuste), 2, 'retenu').b;
    assert.deepEqual(coteAjuste, { cle: 'retenu', rang: null, ajuste: true, derivation: null });
    // Face au retenu ajusté, la proposition n'est pas ajustée : sa place au
    // classement, sans filiation.
    const tableAjustee = evaluer(ajuste);
    const { bornes: _d, ...coteProposition } = comparerPlacements(ajuste, tableAjustee, 2, 'retenu').a;
    assert.deepEqual(coteProposition, { cle: 2, rang: tableAjustee.classement.ordre.indexOf(2) + 1, ajuste: false, derivation: null });
    // Le départ effacé : la filiation le dit absent.
    const orpheline = figer(sans(derivee, [2]));
    assert.deepEqual(comparerPlacements(orpheline, evaluer(orpheline), 3, 1).a.derivation, { ...filiation, departPresent: false });
  });

  test('RangeError pour un côté qui n’est pas un placement mesurable, et pour a = b ; jamais pour un retenu et sa proposition, deux placements égaux', () => {
    const charge = figer(rendreFautive(avecRetenu(chargeComparee(), 1), 3));
    const table = evaluer(charge);
    for (const [a, b] of [[1, 1], ['retenu', 'retenu'], [1, 99], [99, 1], [1, 3], [3, 1], [1, '1'], [1, null]]) {
      assert.throws(() => comparerPlacements(charge, table, a, b), RangeError, `${a} ${b}`);
    }
    const sansRetenu = figer(rendreFautive(chargeComparee(), 3));
    assert.throws(() => comparerPlacements(sansRetenu, evaluer(sansRetenu), 1, 'retenu'), RangeError);
    let enDerive = executer(chargeComparee(), 'exclureParticipant', { id: 4 });
    enDerive = figer(generee(enDerive, { graine: 3, nombre: 1, arret: 60 }));
    assert.throws(() => comparerPlacements(enDerive, evaluer(enDerive), 5, 1), RangeError);
    // Une ligne comparable qui n'a pas une case par personne de son
    // placement : ses rencontres seules, puis ses rencontres et ses plafonds
    // réalisés ensemble.
    const courte = tableForgee(table, 2, (ligne) => {
      ligne.mesures.rencontres = ligne.mesures.rencontres.slice(1);
    });
    assert.throws(() => comparerPlacements(charge, courte, 1, 2), RangeError);
    const courteEnTout = tableForgee(table, 2, (ligne) => {
      ligne.mesures.rencontres = ligne.mesures.rencontres.slice(1);
      ligne.plafondsRealises = ligne.plafondsRealises.slice(1);
    });
    assert.throws(() => comparerPlacements(charge, courteEnTout, 1, 2), RangeError);
    assert.equal(comparerPlacements(charge, table, 'retenu', 1).statut, 'comparable');
  });

  test('rouge : les deux côtés se lisent dans la table, jamais dans un détail — une ligne forgée se lit telle quelle', () => {
    const charge = figer(chargeComparee());
    const table = evaluer(charge);
    const voulus = table.population.map((_, p) => (p === 0 ? 5 : 0));
    const comparaison = comparerPlacements(charge, tableForgee(table, 3, poserManques(voulus)), 1, 3);
    const ligne = ligneDe(table, 3);
    const id = table.population[0];
    assert.deepEqual(comparaison.profils.b[0], {
      id,
      manque: 5,
      rencontres: ligne.plafondsRealises[0] - 5,
      plafondRealise: ligne.plafondsRealises[0],
      plafondAPriori: table.plafondsAPriori[0],
    });
    assert.deepEqual(comparaison.b.bornes.manque, { id, plafondRealise: ligne.plafondsRealises[0], effectif: 1 });
    assert.equal(comparaison.b.bornes.rang1.id, id);
    assert.notDeepEqual(comparaison.b.bornes, bornesDesColonnes(detaillerQualite(charge, 3).bornes));
  });

  test('rouge : chaque côté porte l’effectif au manque maximal, celui de l’escalier à la valeur de son rang 1, et non l’effectif du manque', () => {
    const charge = figer(chargeComparee());
    const table = evaluer(charge);
    // Deux personnes au manque 3, une au manque 1 : deux au manque
    // maximal, trois à qui il en manque.
    const voulus = table.population.map((_, p) => [3, 3, 1][p] ?? 0);
    const forgee = tableForgee(table, 3, poserManques(voulus));
    const comparaison = comparerPlacements(charge, forgee, 1, 3);
    assert.equal(comparaison.b.bornes.manque.effectif, 2);
    assert.equal(comparaison.profils.b.filter(({ manque }) => manque >= 1).length, 3);
    for (const cote of ['a', 'b']) {
      const [rang1] = comparaison.profils[cote];
      const ligne = comparaison.escalier.find(({ valeur }) => valeur === rang1.manque);
      assert.equal(comparaison[cote].bornes.manque.effectif, ligne[cote].effectif, cote);
    }
  });

  test('rouge : comparerPlacements, candidatsDeComparaison et comparaisonOfferte n’atteignent ni diagnostiquer, ni detailler, ni mesurer, ni le détail, ni evaluer', () => {
    // La fermeture de ce que chacune atteint dans le texte du module, comme
    // pour evaluer : un espion de vitest ne se pose pas dans la série node.
    const texte = readFileSync(new URL('./evaluation.js', import.meta.url), 'utf8');
    for (const depart of ['comparerPlacements', 'candidatsDeComparaison', 'comparaisonOfferte']) {
      const { liaisons, importes } = atteintDepuis(texte, depart);
      assert.deepEqual(['diagnostiquer', 'detailler', 'mesurer'].filter((nom) => importes.has(nom)), [], depart);
      assert.deepEqual(['detaillerQualite', 'evaluer', 'rencontresDePersonne', 'resumeDuRetenu'].filter((nom) => liaisons.has(nom)), [], depart);
    }
    const deLaComparaison = atteintDepuis(texte, 'comparerPlacements');
    for (const nom of ['profilManque', 'comparerProfils', 'escalierDuManque', 'teteDesColonnes', 'premierPalierQuiDepartage', 'planchersAtteints']) {
      assert.ok(deLaComparaison.importes.has(nom), `la fermeture voit ${nom}`);
    }
  });
});

describe('evaluer : les deux champs de la configuration que lit la comparaison (contrainte 42, D83)', () => {
  test('la table porte le plafond a priori par personne, une liste dans l’ordre de la population, et le diagnostic dont se lisent les planchers ; les lignes ne gagnent rien', () => {
    const charge = figer(generee(chargeAObjectifs(), { graine: 3, nombre: 2, arret: 200 }));
    const table = evaluer(charge);
    const diagnostic = diagnostiquer(configurationDe(charge));
    assert.ok(Array.isArray(table.plafondsAPriori));
    assert.deepEqual(table.plafondsAPriori, Array.from(diagnostic.plafondAPriori.parPersonne));
    assert.deepEqual(table.plafondsAPriori, Array.from(plafondsAPriori(normaliser(configurationDe(charge)))));
    assert.deepEqual(table.diagnostic, diagnostic);
    const instance = normaliser(configurationDe(charge));
    assert.deepEqual(QUALITE.planchersDesColonnes(instance, table.diagnostic), QUALITE.planchersDesColonnes(instance, diagnostic));
    assert.deepEqual(Object.keys(table), ['population', 'propositions', 'retenu', 'classement', 'criteres', 'imposes', 'plafondsAPriori', 'diagnostic']);
    const CHAMPS = ['id', 'statut', 'raisons', 'sertDeDepart', 'violations', 'mesures', 'plafondsRealises', 'troisChiffres', 'ecartAuPlafondAPrioriMax', 'minimumAtteint', 'refusDessin'];
    for (const ligne of table.propositions) assert.deepEqual(Object.keys(ligne), CHAMPS);
    assert.equal(evaluer(charge, { plafondsAPriori: null }).plafondsAPriori, null);
  });
});

describe('detaillerQualite : la filiation du placement mesuré (D76, C23)', () => {
  test('la dérivée porte la sienne ; le retenu non ajusté, celle de sa proposition d’origine ; le retenu ajusté et une proposition sans départ, null', () => {
    const derivee = deriver(chargeComparee(), 3, 2, [1, 2]);
    const filiation = { depart: 2, toursFiges: [1, 2], departPresent: true };
    const nonAjuste = figer(avecRetenu(derivee, 3));
    assert.deepEqual(detaillerQualite(nonAjuste, 3).derivation, filiation);
    assert.deepEqual(detaillerQualite(nonAjuste, 'retenu').derivation, filiation);
    assert.equal(detaillerQualite(nonAjuste, 4).derivation, null);
    assert.equal(detaillerQualite(figer(avecRetenu(derivee, 3, { ajuste: true })), 'retenu').derivation, null);
    assert.deepEqual(detaillerQualite(figer(sans(derivee, [2])), 3).derivation, { ...filiation, departPresent: false });
    // Une dérivée qui ne se compare pas garde sa filiation.
    const fautive = figer(rendreFautive(derivee, 3));
    const detail = detaillerQualite(fautive, 3);
    assert.equal(detail.statut, 'fautif');
    assert.deepEqual(detail.derivation, filiation);
    // En dérive — une personne exclue sans regénérer —, elle la garde aussi.
    const enDerive = figer(executer(derivee, 'exclureParticipant', { id: 4 }));
    const detailEnDerive = detaillerQualite(enDerive, 3);
    assert.equal(detailEnDerive.statut, 'derive');
    assert.deepEqual(detailEnDerive.derivation, filiation);
  });
});

describe('évaluation : la présence par tour et le départ en dérive par ses participants (§ 5.7, § 12.3)', () => {
  // La petite démonstration, trois propositions courtes.
  const troisPropositions = () => generee(chargeDemo('petite'), { graine: 2, nombre: 3, arret: 40 });
  const statuts = (table) => table.propositions.map(({ statut, sertDeDepart }) => [statut, sertDeDepart]);

  test('sertDeDepart : comparable, vrai ; en dérive par ses seuls participants, vrai ; par le mobilier, seul ou mêlé, faux ; fautif, faux ; le retenu suit la même règle', () => {
    const base = troisPropositions();
    assert.deepEqual(statuts(evaluer(base)), [['comparable', true], ['comparable', true], ['comparable', true]]);
    const absente = structuredClone(base);
    absente.participants[0].presence = [1, 2];
    assert.deepEqual(statuts(evaluer(figer(absente))), [['derive', true], ['derive', true], ['derive', true]]);
    const exclue = structuredClone(base);
    exclue.participants[3].exclu = true;
    assert.deepEqual(statuts(evaluer(figer(exclue))), [['derive', true], ['derive', true], ['derive', true]]);
    const mobilier = structuredClone(base);
    mobilier.tables[0].sieges = 4;
    assert.deepEqual(statuts(evaluer(figer(mobilier))), [['derive', false], ['derive', false], ['derive', false]]);
    const meles = structuredClone(absente);
    meles.tables[0].sieges = 4;
    assert.deepEqual(statuts(evaluer(figer(meles))), [['derive', false], ['derive', false], ['derive', false]]);
    const fautive = structuredClone(base);
    fautive.propositions[1].placement[0].sieges[0].push(fautive.propositions[1].placement[0].sieges[1][0]);
    const table = evaluer(figer(fautive));
    assert.deepEqual(
      table.propositions.map(({ id, statut, sertDeDepart }) => [id, statut, sertDeDepart]).filter(([id]) => id === 2),
      [[2, 'fautif', false]],
    );
    // Le retenu, ajusté à la présence en même temps que retenu, se compare.
    const retenu = executer(absente, 'retenirProposition', { id: 1 });
    assert.deepEqual([evaluer(retenu).retenu.statut, evaluer(retenu).retenu.sertDeDepart], ['comparable', true]);
    const retenuMobilier = structuredClone(retenu);
    retenuMobilier.tables[0].sieges = 4;
    assert.deepEqual([evaluer(retenuMobilier).retenu.statut, evaluer(retenuMobilier).retenu.sertDeDepart], ['derive', false]);
  });

  test('planchersValides se juge sur les tours de présence : vrai sous une absence seule, au détail comme à la comparaison ; faux pour une présente laissée en réserve ; planchersRetires recopié du diagnostic', () => {
    // La démonstration au conflit inévitable : ses planchers de collisions
    // ne sont pas nuls. Sa dernière personne absente au tour 4.
    const absente = chargeDemo('petite-conflit');
    const derniere = absente.participants.length - 1;
    absente.participants[derniere].presence = [1, 2, 3];
    const charge = figer(generee(absente, { graine: 1, nombre: 2, arret: 300 }));
    const diagnostic = diagnostiquer(configurationDe(charge));
    const detail = detaillerQualite(charge, 1);
    assert.equal(detail.statut, 'comparable');
    assert.equal(detail.collisions.planchersValides, true);
    assert.deepEqual(detail.planchersRetires, diagnostic.planchersRetires);
    assert.deepEqual(detail.planchersRetires, ['ecartItineraire']);
    const comparaison = comparerPlacements(charge, evaluer(charge), 1, 2);
    assert.equal(comparaison.statut, 'comparable');
    assert.deepEqual(comparaison.a.bornes.planchers, detail.bornes.planchers);
    assert.ok(Object.values(comparaison.a.bornes.planchers).some((plancher) => plancher !== null), JSON.stringify(comparaison.a.bornes.planchers));
    // Sans absence, rien de retiré.
    const sansAbsence = figer(generee(chargeDemo('petite-conflit'), { graine: 1, nombre: 1, arret: 300 }));
    assert.deepEqual(detaillerQualite(sansAbsence, 1).planchersRetires, []);
    // La même personne présente au tour 4 et laissée en réserve : hors du
    // domaine.
    const enReserve = structuredClone(charge);
    delete enReserve.participants[derniere].presence;
    const proposition = enReserve.propositions[0];
    proposition.placement[3].reserve = [...proposition.placement[3].absents];
    delete proposition.placement[3].absents;
    const detailEnReserve = detaillerQualite(figer(enReserve), 1);
    assert.equal(detailEnReserve.statut, 'comparable');
    assert.equal(detailEnReserve.collisions.planchersValides, false);
    // Un placement qui ne se mesure pas n'a pas de planchers retirés.
    const fautive = structuredClone(charge);
    fautive.propositions[0].placement[0].sieges[0].push(fautive.propositions[0].placement[0].sieges[1][0]);
    assert.equal(detaillerQualite(figer(fautive), 1).planchersRetires, null);
  });

  test('le départ en dérive n’est jamais le défaut de Comparer : le défaut d’une dérivée retombe sur la première proposition comparable du classement', () => {
    const base = troisPropositions();
    const absente = executer(base, 'changerPresence', { id: 1, tours: [1, 2] });
    const configuration = configurationDe(absente);
    const propositions = repartir(configuration, { graine: 5, nombre: 2, arret: 200 }, departDuMoteur(absente, { id: 1, toursFiges: [1] }));
    const charge = figer(
      appliquerCommande('enregistrerGeneration', absente, {
        propositions,
        configuration,
        produitVersion: V1,
        derivation: { depart: 1, toursFiges: [1] },
      }).charge,
    );
    const table = evaluer(charge);
    assert.deepEqual(table.classement.ordre.slice().sort(), [4, 5]);
    for (const a of [4, 5]) {
      const { candidats, defaut } = candidatsDeComparaison(charge, table, a);
      assert.equal(candidats.some(({ cle }) => cle === 1), false);
      assert.equal(defaut, a === 4 ? 5 : 4);
    }
  });
});
