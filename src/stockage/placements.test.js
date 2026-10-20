// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves des placements du fichier d'état (§ 8.9, § 9, § 4.4, § 5.7) : la
// conversion entre la proposition du moteur et la forme positionnelle, la
// numérotation des générations qui s'accumulent, le contrôle de cohérence
// sur un fichier abîmé, aux capacités égales ou non, ce que ce contrôle
// n'attrape pas, la dérive d'une proposition sur une configuration changée,
// le partage d'une charge lue entre propositions gardées et écartées, sous
// un compteur relevé au-delà de chaque identifiant lu, la forme nommée, et
// des résultats qui ne dépendent que des arguments. Les charges d'épreuve
// reprennent la petite démonstration (§ 15.3) et son plan parfait ; leurs
// noms sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { CATALOGUE, PLAN_PARFAIT_PETITE } from '../demo/catalogue.js';
import { indexerPlan, normaliser } from '../moteur/configuration.js';
import { ErreurConfiguration } from '../moteur/erreurs.js';
import { HISTORIQUE_PAR_DEFAUT, rechercher, regenerer } from '../moteur/recherche.js';
import { VERSION } from '../version.genere.js';
import { serialiser } from './canonique.js';
import { analyser, configurationDepuisCharge, creerCharge } from './document.js';
import { ErreurStockage } from './erreurs.js';
import { figer, gelerPropositions } from './gel.js';
import {
  RAISONS_DE_PARTICIPANTS,
  ajusterALaPresence,
  courseDepuisFichier,
  courseVersFichier,
  derive,
  examiner,
  fauteDeCourse,
  fautes,
  formeNommee,
  planDepuisFichier,
  raisonsQuiBloquentUnDepart,
  versFichier,
} from './placements.js';

const ENTETE = Object.freeze({ revision: 1, produitVersion: VERSION.affichee });

// Fige une valeur à toute profondeur et la rend : une fonction qui
// écrirait dans ce qu'elle reçoit lève alors TypeError.
function geler(valeur) {
  if (typeof valeur === 'object' && valeur !== null) {
    for (const enfant of Object.values(valeur)) geler(enfant);
    Object.freeze(valeur);
  }
  return valeur;
}

// La configuration de la petite démonstration (§ 15.3), neuve à chaque
// appel : 12 personnes, 4 tables de 3 sièges, 4 tours, aucune réservation.
const petite = () => CATALOGUE.find(({ cle }) => cle === 'petite').construire();

// Trois propositions du moteur sur la petite démonstration, figées.
const GENERATION = geler(rechercher(petite(), { graine: 5, arret: 2_000, nombre: 3 }));

// Le plan parfait de la petite démonstration, en proposition du moteur.
const PARFAITE = Object.freeze({ id: 1, graine: 48_271, arret: 20_000, historique: 1_000, plan: PLAN_PARFAIT_PETITE });

// La forme positionnelle attendue de PARFAITE, sièges non attribués, écrite
// à la main : une copie neuve à chaque appel.
function fichierParfait() {
  return {
    id: 1,
    graine: 48_271,
    arret: 20_000,
    historique: 1_000,
    produitVersion: VERSION.affichee,
    siegesAttribues: false,
    tables: [1, 2, 3, 4],
    capacites: [3, 3, 3, 3],
    tours: 4,
    participants: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    placement: [
      { sieges: [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]], reserve: [] },
      { sieges: [[6, 9, 12], [3, 8, 11], [2, 5, 10], [1, 4, 7]], reserve: [] },
      { sieges: [[4, 8, 10], [2, 7, 12], [1, 6, 11], [3, 5, 9]], reserve: [] },
      { sieges: [[5, 7, 11], [1, 9, 10], [3, 4, 12], [2, 6, 8]], reserve: [] },
    ],
  };
}

// fichierParfait, cohérent lui aussi, ses tables déclarées dans l'ordre 3,
// 1, 2, 4, chaque tour portant ses listes dans cet ordre, et ses
// participants déclarés à rebours : un ordre de sortie qui suivrait celui
// de la déclaration s'y voit.
function fichierPermute() {
  const p = fichierParfait();
  const ordre = [2, 0, 1, 3];
  p.tables = ordre.map((rang) => p.tables[rang]);
  p.capacites = ordre.map((rang) => p.capacites[rang]);
  for (const tour of p.placement) tour.sieges = ordre.map((rang) => tour.sieges[rang]);
  p.participants.reverse();
  return p;
}

// fichierParfait, cohérent lui aussi, dont le tour 1 laisse les personnes 6
// et 3 à la réserve, écrite dans cet ordre, hors de l'ordre croissant.
function fichierAReserve() {
  const p = fichierParfait();
  p.placement[0] = { sieges: [[1, 2], [4, 5], [7, 8, 9], [10, 11, 12]], reserve: [6, 3] };
  return p;
}

// fichierParfait, cohérent lui aussi, la table 4 portée à quatre sièges et
// déclarée la première : tables 4, 1, 2, 3, capacités 4, 3, 3, 3. Au tour 1,
// la table 3 cède la personne 9 à la table 4, pleine à sa propre capacité,
// au-delà de celle de ses voisines. Une capacité lue au rang de
// l'identifiant moins un, et non au rang de la déclaration, donnerait 3 à la
// table 4 et 4 à la table 1.
function fichierInegal() {
  const p = fichierParfait();
  const ordre = [3, 0, 1, 2];
  p.tables = ordre.map((rang) => p.tables[rang]);
  p.capacites = [4, 3, 3, 3];
  for (const tour of p.placement) tour.sieges = ordre.map((rang) => tour.sieges[rang]);
  p.placement[0].sieges = [[9, 10, 11, 12], [1, 2, 3], [4, 5, 6], [7, 8]];
  return p;
}

// Noms et prénoms inventés des personnes 1 à 12 de la charge d'épreuve, puis
// ceux de la personne 13, que des épreuves ajoutent.
const PERSONNES = Object.freeze([
  ['Aubépine', 'Agathe'],
  ['Bruyère', 'Basile'],
  ['Chardon', 'Céleste'],
  ['Doucette', 'Désiré'],
  ['Églantine', 'Edmée'],
  ['Fougère', 'Firmin'],
  ['Giroflée', 'Gisèle'],
  ['Houblon', 'Honoré'],
  ['Isatis', 'Ida'],
  ['Jonquille', 'Joachim'],
  ['Lavande', 'Lazare'],
  ['Mélisse', 'Mathurin'],
]);
const TREIZIEME = Object.freeze(['Nigelle', 'Noémie']);
// Appartenances inventées, données aux groupes de la démonstration dans
// l'ordre où ils apparaissent, par identifiant croissant.
const CERCLES = Object.freeze(['Cercle Aulne', 'Cercle Bouleau', 'Cercle Charme']);

const personne = (id, nom, prenom, appartenance = null) => ({
  id,
  nom,
  prenom,
  appartenance,
  courriel: null,
  titrePressenti: null,
  notes: null,
  exclu: false,
});
const table = (id, numero, sieges = null) => ({ id, numero, sieges, forme: 'ronde', position: { x: 300 * id, y: 0 } });

// La charge de la petite démonstration, sans proposition : ses personnes
// sous des noms inventés et leurs groupes, ses tables aux sièges du défaut,
// 3, ses 4 tours.
function chargePetite() {
  const configuration = petite();
  const charge = creerCharge({ id: 'evt-pinsons', nom: 'Soirée des Pinsons', siegesParDefaut: 3, tours: 4 });
  const cercleDe = new Map();
  charge.participants = configuration.participants.map(({ id, appartenance }) => {
    if (!cercleDe.has(appartenance)) cercleDe.set(appartenance, CERCLES[cercleDe.size]);
    const [nom, prenom] = PERSONNES[id - 1];
    return personne(id, nom, prenom, cercleDe.get(appartenance));
  });
  charge.tables = configuration.tables.map(({ id, numero }) => table(id, numero));
  charge.prochainsIds = { participant: 13, table: 5, proposition: 1 };
  return charge;
}

// chargePetite avec les propositions de GENERATION, converties sans
// attribution de sièges sur sa propre configuration et numérotées à partir
// de prochainsIds.proposition, qui avance au-delà de la dernière.
function chargeAvecGeneration() {
  const charge = chargePetite();
  const configuration = configurationDepuisCharge(charge);
  const decalage = charge.prochainsIds.proposition - 1;
  charge.propositions = GENERATION.map((proposition) =>
    versFichier(proposition, configuration, { produitVersion: VERSION.affichee, attribuerSieges: false, decalage }),
  );
  charge.prochainsIds.proposition = decalage + GENERATION.length + 1;
  charge.evenement.etat = 'propose';
  return charge;
}

// Le retenu tiré d'une proposition de fichier : son identifiant à la clé
// proposition, une copie de son plan.
const retenuDe = ({ id, siegesAttribues, tables, capacites, tours, participants, placement }) =>
  structuredClone({ proposition: id, siegesAttribues, tables, capacites, tours, participants, placement });

// La charge écrite dans son fichier, puis relue : ce que trouve l'ouverture.
const relire = (charge) => analyser(serialiser(charge, ENTETE)).charge;

// Le fichier de la charge, abîmé : abimer reçoit le JSON du texte écrit et
// le modifie, puis le texte qui en résulte est relu par l'analyse, qui ne
// contrôle des propositions et du retenu que leur conteneur.
function abimerFichier(charge, abimer) {
  const ecrit = JSON.parse(serialiser(charge, ENTETE));
  abimer(ecrit);
  return analyser(JSON.stringify(ecrit)).charge;
}

// Exige que appel lève TypeError, et que son message réponde à motif.
function leveTypeError(appel, motif, message) {
  assert.throws(appel, (erreur) => erreur instanceof TypeError && motif.test(erreur.message), message);
}

// Code et détails de l'ErreurStockage que lève appel, ou un texte qui dit
// l'écart : une autre erreur, aucun refus.
function refusDe(appel) {
  try {
    appel();
  } catch (erreur) {
    if (!(erreur instanceof ErreurStockage)) return `${erreur?.name} au lieu d'une ErreurStockage : ${erreur?.message}`;
    return { code: erreur.code, details: erreur.details };
  }
  return 'aucun refus';
}

// Le refus d'un identifiant qui ne laisserait au compteur des propositions
// aucune valeur au-delà.
const COMPTEUR_SATURE = Object.freeze({ code: 'COMPTEUR_SATURE', details: Object.freeze({ compteur: 'proposition' }) });

// Une ligne attendue de la forme nommée : sans table, une ligne de la
// réserve, sauf quand enReserve dit le contraire ; absente seulement quand
// absent le dit.
const ligne = (tour, idTable, numero, siege, participant, nom, prenom, enReserve = idTable === null, absent = false) => ({
  tour,
  table: idTable,
  numero,
  siege,
  participant,
  nom,
  prenom,
  reserve: enReserve,
  absent,
});

describe('versFichier et planDepuisFichier : la proposition du moteur et sa forme positionnelle (§ 8.9)', () => {
  test('le plan parfait de la petite démonstration donne la forme positionnelle attendue, et planDepuisFichier rend le plan', () => {
    const fichier = versFichier(PARFAITE, petite(), { produitVersion: VERSION.affichee, attribuerSieges: false, decalage: 0 });
    assert.deepStrictEqual(fichier, fichierParfait());
    assert.deepStrictEqual(planDepuisFichier(fichier), PLAN_PARFAIT_PETITE);
  });

  test("chaque proposition de deux générations, sous l'historique par défaut du moteur puis sous un autre : graine, arrêt, historique et produitVersion portés, les trois premiers régénèrent le plan, listes de table croissantes, le plan rendu tel quel", () => {
    // GENERATION suit l'historique que le moteur prend par défaut ; la
    // seconde génération en demande un autre : sur elle seule, un fichier
    // qui porte le défaut au lieu de l'historique reçu se distingue, et sa
    // régénération rend un autre plan (§ 8.9).
    const seconde = rechercher(petite(), { graine: 5, arret: 500, nombre: 1, historique: 37 });
    assert.notEqual(HISTORIQUE_PAR_DEFAUT, 37);
    assert.deepStrictEqual(seconde.map(({ historique }) => historique), [37]);
    assert.equal(GENERATION.length, 3);
    for (const proposition of [...GENERATION, ...seconde]) {
      for (const attribuerSieges of [false, true]) {
        const fichier = versFichier(proposition, petite(), { produitVersion: VERSION.affichee, attribuerSieges, decalage: 0 });
        const { id, graine, arret, historique } = proposition;
        assert.deepStrictEqual(
          [fichier.id, fichier.graine, fichier.arret, fichier.historique, fichier.produitVersion],
          [id, graine, arret, historique, VERSION.affichee],
        );
        assert.equal(fichier.siegesAttribues, attribuerSieges);
        assert.deepStrictEqual(fichier.tables, [1, 2, 3, 4]);
        assert.deepStrictEqual(fichier.capacites, [3, 3, 3, 3]);
        assert.equal(fichier.tours, 4);
        assert.deepStrictEqual(fichier.participants, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        assert.equal(fichier.placement.length, 4);
        for (const { sieges, reserve } of fichier.placement) {
          for (const liste of sieges) assert.deepStrictEqual(liste, [...liste].sort((a, b) => a - b));
          assert.deepStrictEqual(reserve, []);
        }
        assert.deepStrictEqual(fautes(fichier), []);
        assert.deepStrictEqual(planDepuisFichier(fichier), proposition.plan);
        assert.deepStrictEqual(regenerer(petite(), fichier), proposition.plan);
      }
    }
  });

  test("sièges non attribués : chaque liste de table se trie par identifiant croissant ; attribués : l'ordre des sièges est gardé ; la réserve se trie dans les deux cas", () => {
    const configuration = petite();
    configuration.participants.push({ id: 13, nom: TREIZIEME[0], prenom: TREIZIEME[1], appartenance: null });
    const inverses = PLAN_PARFAIT_PETITE.tours.map((listes) => listes.map((liste) => [...liste].reverse()));
    inverses[0][3] = [11, 10];
    const proposition = {
      ...PARFAITE,
      plan: { tables: [1, 2, 3, 4], tours: inverses, reserves: [[13, 12], [13], [13], [13]] },
    };
    const reserves = [[12, 13], [13], [13], [13]];

    const nonAttribues = versFichier(proposition, configuration, { produitVersion: VERSION.affichee, attribuerSieges: false, decalage: 0 });
    assert.equal(nonAttribues.siegesAttribues, false);
    assert.deepStrictEqual(nonAttribues.participants, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    const tries = PLAN_PARFAIT_PETITE.tours.map((listes) => listes.map((liste) => [...liste]));
    tries[0][3] = [10, 11];
    assert.deepStrictEqual(
      nonAttribues.placement,
      tries.map((sieges, r) => ({ sieges, reserve: reserves[r] })),
    );

    const attribues = versFichier(proposition, configuration, { produitVersion: VERSION.affichee, attribuerSieges: true, decalage: 0 });
    assert.equal(attribues.siegesAttribues, true);
    assert.deepStrictEqual(
      attribues.placement,
      inverses.map((sieges, r) => ({ sieges, reserve: reserves[r] })),
    );
    assert.deepStrictEqual(planDepuisFichier(attribues), planDepuisFichier(nonAttribues));
  });

  test("les tables dans l'ordre du plan, chacune avec sa capacité dans la configuration, quel que soit l'ordre où la configuration les range", () => {
    const options = { produitVersion: VERSION.affichee, attribuerSieges: false, decalage: 0 };
    const configuration = petite();
    configuration.tables[3].capacite = 4;
    configuration.tables.reverse();
    const [proposition] = rechercher(configuration, { graine: 5, arret: 2_000, nombre: 1 });
    assert.deepStrictEqual(proposition.plan.tables, [4, 3, 2, 1]);
    const engendre = versFichier(proposition, configuration, options);
    assert.deepStrictEqual([engendre.tables, engendre.capacites], [[4, 3, 2, 1], [4, 3, 3, 3]]);
    assert.deepStrictEqual(planDepuisFichier(engendre), proposition.plan);
    const parfait = versFichier(PARFAITE, configuration, options);
    assert.deepStrictEqual([parfait.tables, parfait.capacites], [[1, 2, 3, 4], [3, 3, 3, 4]]);
    assert.deepStrictEqual(planDepuisFichier(parfait), PLAN_PARFAIT_PETITE);
    // Les participants se déclarent par identifiant croissant, même quand
    // la configuration les range à rebours.
    const renversee = petite();
    renversee.participants.reverse();
    const [tiree] = rechercher(renversee, { graine: 5, arret: 2_000, nombre: 1 });
    assert.deepStrictEqual(versFichier(tiree, renversee, options).participants, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  test("planDepuisFichier rend chaque réserve par identifiant croissant, comme le moteur les rend, quel que soit l'ordre écrit", () => {
    const p = fichierAReserve();
    assert.deepStrictEqual(fautes(p), []);
    assert.deepStrictEqual(planDepuisFichier(p).reserves[0], [3, 6]);
  });

  test("versFichier ne modifie ni la proposition ni la configuration, et ne partage aucune liste avec elles ; planDepuisFichier non plus avec le fichier", () => {
    const configuration = geler(petite());
    for (const proposition of GENERATION) {
      const fichier = versFichier(proposition, configuration, { produitVersion: VERSION.affichee, attribuerSieges: true, decalage: 0 });
      assert.notEqual(fichier.tables, proposition.plan.tables);
      fichier.placement.forEach(({ sieges, reserve }, r) => {
        assert.notEqual(reserve, proposition.plan.reserves[r]);
        sieges.forEach((liste, i) => assert.notEqual(liste, proposition.plan.tours[r][i]));
      });
      const gele = geler(fichier);
      const plan = planDepuisFichier(gele);
      assert.notEqual(plan.tables, gele.tables);
      plan.tours.forEach((listes, r) => {
        assert.notEqual(plan.reserves[r], gele.placement[r].reserve);
        listes.forEach((liste, i) => assert.notEqual(liste, gele.placement[r].sieges[i]));
      });
    }
  });

  test('versFichier refuse un drapeau, une version ou un décalage qui manquent ou sortent de leur domaine, et un plan que la configuration contredit : TypeError', () => {
    // Une troisième proposition : le décalage −2 lui donnerait l'identifiant
    // 1, que le contrôle de forme admet.
    const troisieme = { ...PARFAITE, id: 3 };
    for (const options of [
      { produitVersion: VERSION.affichee, decalage: 0 },
      { produitVersion: VERSION.affichee, attribuerSieges: 'non', decalage: 0 },
      { attribuerSieges: false, decalage: 0 },
      { produitVersion: '', attribuerSieges: false, decalage: 0 },
    ]) {
      assert.throws(() => versFichier(troisieme, petite(), options), TypeError, JSON.stringify(options));
    }
    // Un décalage hors de son domaine se refuse en son nom, avant toute
    // forme.
    for (const decalage of [undefined, -2, 0.5, '0']) {
      leveTypeError(
        () => versFichier(troisieme, petite(), { produitVersion: VERSION.affichee, attribuerSieges: false, decalage }),
        /décalage/,
        `décalage ${JSON.stringify(decalage) ?? 'absent'}`,
      );
    }
    const options = { produitVersion: VERSION.affichee, attribuerSieges: false, decalage: 0 };
    const avecTreize = petite();
    avecTreize.participants.push({ id: 13, nom: TREIZIEME[0], appartenance: null });
    leveTypeError(() => versFichier(PARFAITE, avecTreize, options), /"MANQUANT"/, 'personne 13 non placée');
    const tableReduite = petite();
    tableReduite.tables[3].capacite = 2;
    leveTypeError(() => versFichier(PARFAITE, tableReduite, options), /"LONGUEUR"/, 'table 4 réduite');
    const cinqTours = petite();
    cinqTours.tours = 5;
    leveTypeError(() => versFichier(PARFAITE, cinqTours, options), /"LONGUEUR"/, 'cinq tours');
    const sansTable = petite();
    sansTable.tables.pop();
    leveTypeError(() => versFichier(PARFAITE, sansTable, options), /"FORME"/, 'table 4 absente');
  });

  test("versFichier refuse sous un code l'identifiant qui ne laisserait au compteur aucune valeur au-delà, 2^31 − 1 et plus : ErreurStockage COMPTEUR_SATURE, qui nomme le compteur des propositions ; 2^31 − 2, le dernier qui lui en laisse une, s'écrit", () => {
    // Une troisième proposition, que son décalage porte comme la première à
    // l'identifiant 2^31 − 1.
    const troisieme = { ...PARFAITE, id: 3 };
    const options = { produitVersion: VERSION.affichee, attribuerSieges: false, decalage: 0 };
    assert.equal(versFichier(PARFAITE, petite(), { ...options, decalage: 2 ** 31 - 3 }).id, 2 ** 31 - 2);
    const refus = [
      [PARFAITE, 2 ** 31 - 2],
      [troisieme, 2 ** 31 - 4],
      [PARFAITE, 2 ** 31 - 1],
    ].map(([proposition, decalage]) => [
      decalage + proposition.id,
      refusDe(() => versFichier(proposition, petite(), { ...options, decalage })),
    ]);
    assert.deepStrictEqual(refus, [
      [2 ** 31 - 1, COMPTEUR_SATURE],
      [2 ** 31 - 1, COMPTEUR_SATURE],
      [2 ** 31, COMPTEUR_SATURE],
    ]);
  });

  test("le fichier écrit se relit : examiner garde chaque proposition telle qu'écrite, sans faute ni dérive", () => {
    const charge = chargeAvecGeneration();
    const examen = examiner(relire(charge));
    assert.deepStrictEqual(examen.fautives, []);
    assert.deepStrictEqual(examen.derives, []);
    assert.deepStrictEqual(examen.retenu, { fautes: [], raisons: [] });
    assert.deepStrictEqual(examen.charge.propositions, charge.propositions);
    examen.charge.propositions.forEach((proposition, rang) => {
      assert.deepStrictEqual(planDepuisFichier(proposition), GENERATION[rang].plan);
    });
  });

  test("des générations qui s'accumulent (§ 5.7) : chacune décalée de prochainsIds.proposition − 1, qui avance ensuite ; après un effacement qui épargne le retenu, aucun identifiant ne revient, et examiner garde chaque proposition relue", () => {
    const charge = chargePetite();
    const configuration = configurationDepuisCharge(charge);
    // L'appelant décale une génération de prochainsIds.proposition − 1,
    // puis porte le compteur au-delà du dernier identifiant écrit.
    const generer = (graine) => {
      const decalage = charge.prochainsIds.proposition - 1;
      const options = { produitVersion: VERSION.affichee, attribuerSieges: false, decalage };
      const propositions = rechercher(configuration, { graine, arret: 2_000, nombre: 3 });
      for (const proposition of propositions) charge.propositions.push(versFichier(proposition, configuration, options));
      charge.prochainsIds.proposition = decalage + propositions.length + 1;
    };
    generer(5);
    generer(9);
    charge.evenement.etat = 'propose';
    assert.deepStrictEqual(charge.propositions.map(({ id }) => id), [1, 2, 3, 4, 5, 6]);
    const examen = examiner(relire(charge));
    assert.deepStrictEqual(examen.fautives, []);
    assert.deepStrictEqual(examen.charge.propositions, charge.propositions);
    // Effacer la liste en épargnant le retenu (§ 5.7) garde la proposition
    // 2 seule ; la génération suivante prend 7, 8 et 9, aucun des
    // identifiants effacés.
    charge.retenu = retenuDe(charge.propositions[1]);
    charge.propositions = [charge.propositions[1]];
    charge.evenement.etat = 'retenu';
    generer(13);
    assert.deepStrictEqual(charge.propositions.map(({ id }) => id), [2, 7, 8, 9]);
    const apres = examiner(relire(charge));
    assert.deepStrictEqual(apres.fautives, []);
    assert.deepStrictEqual(apres.charge.propositions, charge.propositions);
    assert.deepStrictEqual(apres.retenu, { fautes: [], raisons: [] });
  });
});

describe('fautes : la corruption délibérée (§ 8.9, points 1 à 3)', () => {
  // Les quatre façons d'abîmer une proposition de la petite démonstration,
  // chacune dans son tour : chaque fonction abîme la proposition reçue et
  // rend la faute que le contrôle doit nommer.
  const QUATRE_FACONS = [
    ['une longueur fausse', (p) => {
      const { sieges } = p.placement[0];
      sieges[1].push(sieges[0].shift());
      return { code: 'LONGUEUR', tour: 1, table: 2, declare: 3, ecrit: 4 };
    }],
    ['un identifiant dupliqué', (p) => {
      const { sieges, reserve } = p.placement[1];
      reserve.push(sieges[0][0]);
      return { code: 'DOUBLON', tour: 2, participant: sieges[0][0] };
    }],
    ['un identifiant inconnu', (p) => {
      p.placement[2].reserve.push(13);
      return { code: 'INCONNU', tour: 3, participant: 13 };
    }],
    ['un identifiant manquant sans entrée de réserve', (p) => {
      const perdu = p.placement[3].sieges[2].pop();
      return { code: 'MANQUANT', tour: 4, participant: perdu };
    }],
  ];

  test('trois propositions, la deuxième abîmée de quatre façons tour à tour : fautes nomme chacune avec ses coordonnées, examiner écarte la seule fautive et garde les deux autres', () => {
    const charge = chargeAvecGeneration();
    assert.deepStrictEqual(charge.propositions[1].tables, [1, 2, 3, 4]);
    for (const [libelle, abimer] of QUATRE_FACONS) {
      let attendue;
      const lue = abimerFichier(charge, (ecrit) => {
        attendue = abimer(ecrit.charge.propositions[1]);
      });
      const abimee = lue.propositions[1];
      assert.equal(abimee.id, 2, libelle);
      assert.notDeepStrictEqual(abimee, charge.propositions[1], libelle);
      assert.deepStrictEqual(fautes(abimee), [attendue], libelle);
      const examen = examiner(lue);
      assert.deepStrictEqual(examen.fautives, [{ rang: 1, id: 2, fautes: [attendue] }], libelle);
      assert.deepStrictEqual(examen.charge.propositions, [charge.propositions[0], charge.propositions[2]], libelle);
      assert.deepStrictEqual(examen.derives, [], libelle);
    }
  });

  test("les quatre défauts dans la même proposition sont nommés dans l'ordre des tours", () => {
    const abimee = structuredClone(chargeAvecGeneration().propositions[1]);
    const attendues = QUATRE_FACONS.map(([, abimer]) => abimer(abimee));
    assert.deepStrictEqual(fautes(abimee), [attendues[0], attendues[1], attendues[2], attendues[3]]);
    assert.deepStrictEqual(attendues.map(({ tour }) => tour), [1, 2, 3, 4]);
  });

  test("dans un tour : le nombre de listes, chaque table dans l'ordre déclaré, puis doublons, inconnus et manquants par identifiant croissant ; le nombre de tours avant tout", () => {
    const p = fichierParfait();
    p.tours = 5;
    p.placement[1] = { sieges: [[6, 9, 12, 3], [8], [2, 10, 14, 9], [1, 4, 7], [20]], reserve: [15, 1, 13, 15] };
    assert.deepStrictEqual(fautes(p), [
      { code: 'LONGUEUR', tour: null, table: null, declare: 5, ecrit: 4 },
      { code: 'LONGUEUR', tour: 2, table: null, declare: 4, ecrit: 5 },
      { code: 'LONGUEUR', tour: 2, table: 1, declare: 3, ecrit: 4 },
      { code: 'LONGUEUR', tour: 2, table: 3, declare: 3, ecrit: 4 },
      { code: 'DOUBLON', tour: 2, participant: 1 },
      { code: 'DOUBLON', tour: 2, participant: 9 },
      { code: 'INCONNU', tour: 2, participant: 13 },
      { code: 'INCONNU', tour: 2, participant: 14 },
      { code: 'INCONNU', tour: 2, participant: 15 },
      { code: 'INCONNU', tour: 2, participant: 20 },
      { code: 'MANQUANT', tour: 2, participant: 5 },
      { code: 'MANQUANT', tour: 2, participant: 11 },
    ]);
    // Plus de tours écrits que déclarés : la même faute, dans l'autre sens.
    const enTrop = { ...fichierParfait(), tours: 3 };
    assert.deepStrictEqual(fautes(enTrop), [{ code: 'LONGUEUR', tour: null, table: null, declare: 3, ecrit: 4 }]);
  });

  test("un identifiant se nomme une fois par tour : inconnu écrit deux fois, déclaré écrit trois fois ; une liste de moins que les tables nomme aussi ses absents", () => {
    const p = fichierParfait();
    p.placement[0].reserve = [13, 2, 13, 2];
    p.placement[2].sieges.pop();
    assert.deepStrictEqual(fautes(p), [
      { code: 'DOUBLON', tour: 1, participant: 2 },
      { code: 'INCONNU', tour: 1, participant: 13 },
      { code: 'LONGUEUR', tour: 3, table: null, declare: 4, ecrit: 3 },
      { code: 'MANQUANT', tour: 3, participant: 3 },
      { code: 'MANQUANT', tour: 3, participant: 5 },
      { code: 'MANQUANT', tour: 3, participant: 9 },
    ]);
  });

  test("les tables suivent l'ordre déclaré, les identifiants l'ordre croissant, quel que soit l'ordre de la déclaration des participants", () => {
    const permute = fichierPermute();
    assert.deepStrictEqual(permute.tables, [3, 1, 2, 4]);
    assert.deepStrictEqual(fautes(permute), []);
    const longues = fichierPermute();
    longues.placement[0].sieges = [[7, 8, 9, 4], [1, 2, 3, 5], [6], [10, 11, 12]];
    assert.deepStrictEqual(fautes(longues), [
      { code: 'LONGUEUR', tour: 1, table: 3, declare: 3, ecrit: 4 },
      { code: 'LONGUEUR', tour: 1, table: 1, declare: 3, ecrit: 4 },
    ]);
    const melees = fichierPermute();
    melees.placement[0].sieges[0] = [7, 8];
    melees.placement[0].sieges[1] = [1, 3];
    melees.placement[0].reserve = [5, 3];
    assert.deepStrictEqual(fautes(melees), [
      { code: 'DOUBLON', tour: 1, participant: 3 },
      { code: 'DOUBLON', tour: 1, participant: 5 },
      { code: 'MANQUANT', tour: 1, participant: 2 },
      { code: 'MANQUANT', tour: 1, participant: 9 },
    ]);
  });

  test("capacités inégales, tables déclarées hors de l'ordre des identifiants : chaque liste se mesure à la capacité de son rang dans la déclaration, et la proposition se relit sans être écartée", () => {
    const inegal = fichierInegal();
    assert.deepStrictEqual(fautes(inegal), []);
    // La table 4 au-delà de ses quatre sièges, la table 1 au-delà de ses
    // trois mais en deçà de quatre ; la table 3 vide n'est pas fautive.
    const debordees = fichierInegal();
    debordees.placement[0].sieges = [[8, 9, 10, 11, 12], [1, 2, 3, 7], [4, 5, 6], []];
    assert.deepStrictEqual(fautes(debordees), [
      { code: 'LONGUEUR', tour: 1, table: 4, declare: 4, ecrit: 5 },
      { code: 'LONGUEUR', tour: 1, table: 1, declare: 3, ecrit: 4 },
    ]);
    const charge = chargePetite();
    charge.tables[3].sieges = 4;
    charge.propositions = [inegal];
    charge.prochainsIds.proposition = 2;
    charge.evenement.etat = 'propose';
    const examen = examiner(relire(charge));
    assert.deepStrictEqual(examen.fautives, []);
    assert.deepStrictEqual(examen.derives, []);
    assert.deepStrictEqual(examen.charge.propositions, [inegal]);
  });

  test("une table moins remplie que sa capacité n'est pas fautive : la longueur déclarée borne la liste, une salle peut avoir des places vides", () => {
    const configuration = petite();
    configuration.participants[4].exclu = true;
    const [proposition] = rechercher(configuration, { graine: 9, arret: 1_000, nombre: 1 });
    const fichier = versFichier(proposition, configuration, { produitVersion: VERSION.affichee, attribuerSieges: false, decalage: 0 });
    assert.deepStrictEqual(fichier.participants, [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12]);
    for (const { sieges } of fichier.placement) {
      assert.deepStrictEqual(sieges.map((liste) => liste.length).sort((a, b) => a - b), [2, 3, 3, 3]);
    }
    assert.deepStrictEqual(fautes(fichier), []);
    const versLaReserve = fichierParfait();
    versLaReserve.placement[0] = { sieges: [[1, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]], reserve: [2] };
    assert.deepStrictEqual(fautes(versLaReserve), []);
  });

  test("la forme se contrôle d'abord : la première valeur hors de sa règle est nommée FORME, par son chemin dans la proposition", () => {
    const cas = [
      ['un nombre', () => 42, ''],
      ['null', () => null, ''],
      ['une liste', () => [], ''],
      ['identifiant 0', (p) => { p.id = 0; return p; }, 'id'],
      ['identifiant en chaîne', (p) => { p.id = '1'; return p; }, 'id'],
      ['graine négative', (p) => { p.graine = -1; return p; }, 'graine'],
      ['graine de 2^32', (p) => { p.graine = 2 ** 32; return p; }, 'graine'],
      ['arrêt nul', (p) => { p.arret = 0; return p; }, 'arret'],
      ['historique fractionnaire', (p) => { p.historique = 1.5; return p; }, 'historique'],
      ['version vide', (p) => { p.produitVersion = ''; return p; }, 'produitVersion'],
      ['drapeau en chaîne', (p) => { p.siegesAttribues = 'non'; return p; }, 'siegesAttribues'],
      ['tables en objet', (p) => { p.tables = {}; return p; }, 'tables'],
      ['identifiant de table 0', (p) => { p.tables[3] = 0; return p; }, 'tables[3]'],
      ["capacité d'un siège", (p) => { p.capacites[2] = 1; return p; }, 'capacites[2]'],
      ['zéro tour', (p) => { p.tours = 0; return p; }, 'tours'],
      ['participant en chaîne', (p) => { p.participants[1] = '2'; return p; }, 'participants[1]'],
      ['placement en objet', (p) => { p.placement = {}; return p; }, 'placement'],
      ['tour en liste', (p) => { p.placement[0] = []; return p; }, 'placement[0]'],
      ['sièges en chaîne', (p) => { p.placement[1].sieges = 'x'; return p; }, 'placement[1].sieges'],
      ['liste de table en nombre', (p) => { p.placement[2].sieges[1] = 7; return p; }, 'placement[2].sieges[1]'],
      ['occupant fractionnaire', (p) => { p.placement[3].sieges[0][2] = 2.5; return p; }, 'placement[3].sieges[0][2]'],
      ['occupant au-delà des entiers exacts', (p) => { p.placement[3].sieges[1][0] = 2 ** 53; return p; }, 'placement[3].sieges[1][0]'],
      // Un identifiant reste sous 2^31.
      ['identifiant 2^31', (p) => { p.id = 2 ** 31; return p; }, 'id'],
      ['identifiant de table 2^31', (p) => { p.tables[3] = 2 ** 31; return p; }, 'tables[3]'],
      ['participant déclaré 2^31', (p) => { p.participants[11] = 2 ** 31; return p; }, 'participants[11]'],
      ['occupant 2^31', (p) => { p.placement[3].sieges[1][0] = 2 ** 31; return p; }, 'placement[3].sieges[1][0]'],
      ['en réserve, 2^31', (p) => { p.placement[2].reserve = [2 ** 31]; return p; }, 'placement[2].reserve[0]'],
      ['réserve absente', (p) => { delete p.placement[0].reserve; return p; }, 'placement[0].reserve'],
      ['graine absente', (p) => { delete p.graine; return p; }, 'graine'],
      ['deux clés inconnues : la plus petite', (p) => { p.zeta = 1; p.alpha = 2; return p; }, 'alpha'],
      ["une clé inconnue qui ne s'écrit pas comme un identifiant", (p) => { p['clé inconnue'] = 1; return p; }, '["clé inconnue"]'],
      ['une clé inconnue dans un tour', (p) => { p.placement[1].note = 'x'; return p; }, 'placement[1].note'],
      ['un champ fautif avant une clé inconnue', (p) => { p.aaa = 1; p.tours = 0; return p; }, 'tours'],
      ['une table déclarée deux fois', (p) => { p.tables[2] = 2; return p; }, 'tables[2]'],
      ['des capacités moins nombreuses que les tables', (p) => { p.capacites.pop(); return p; }, 'capacites'],
      ['des capacités plus nombreuses que les tables', (p) => { p.capacites.push(3); return p; }, 'capacites'],
      ['un participant déclaré deux fois', (p) => { p.participants[3] = 3; return p; }, 'participants[3]'],
      ['une forme fautive dans un placement incohérent : la forme seule', (p) => {
        p.placement[0].sieges[0].pop();
        p.historique = 0;
        return p;
      }, 'historique'],
    ];
    const ecarts = cas.flatMap(([libelle, abimer, chemin]) => {
      const obtenues = fautes(abimer(fichierParfait()));
      const attendues = [{ code: 'FORME', chemin }];
      return JSON.stringify(obtenues) === JSON.stringify(attendues)
        ? []
        : [`${libelle} : ${JSON.stringify(obtenues)} au lieu de ${JSON.stringify(attendues)}`];
    });
    assert.deepStrictEqual(ecarts, []);
  });

  test("le retenu se contrôle sous sa propre forme : la clé proposition au lieu de l'identifiant, ni graine, ni arrêt, ni historique, ni version", () => {
    const retenu = retenuDe(fichierParfait());
    assert.deepStrictEqual(fautes(retenu), []);
    assert.deepStrictEqual(fautes({ ...retenuDe(fichierParfait()), graine: 1 }), [{ code: 'FORME', chemin: 'graine' }]);
    const sansDrapeau = retenuDe(fichierParfait());
    delete sansDrapeau.siegesAttribues;
    assert.deepStrictEqual(fautes(sansDrapeau), [{ code: 'FORME', chemin: 'siegesAttribues' }]);
    assert.deepStrictEqual(fautes({ ...retenuDe(fichierParfait()), proposition: 0 }), [{ code: 'FORME', chemin: 'proposition' }]);
    retenu.placement[1].sieges[3].pop();
    assert.deepStrictEqual(fautes(retenu), [{ code: 'MANQUANT', tour: 2, participant: 7 }]);
  });
});

describe("ce que le contrôle n'attrape pas, et ne prétend pas attraper (§ 8.9, point 2)", () => {
  test("une permutation dans une table, et l'échange du contenu de deux tables de même capacité, gardent le multiensemble et les longueurs : fautes rend [], examiner garde la proposition", () => {
    for (const siegesAttribues of [true, false]) {
      const reference = { ...fichierParfait(), siegesAttribues };
      const permutee = structuredClone(reference);
      permutee.placement[0].sieges[0] = [3, 1, 2];
      const echangee = structuredClone(reference);
      const { sieges } = echangee.placement[1];
      [sieges[0], sieges[1]] = [sieges[1], sieges[0]];
      for (const abimee of [permutee, echangee]) {
        assert.notDeepStrictEqual(abimee, reference);
        assert.deepStrictEqual(fautes(abimee), []);
        const charge = chargePetite();
        charge.propositions = [abimee];
        charge.prochainsIds.proposition = 2;
        const examen = examiner(charge);
        assert.deepStrictEqual(examen.fautives, []);
        assert.deepStrictEqual(examen.derives, []);
        assert.deepStrictEqual(examen.charge.propositions, [abimee]);
      }
    }
  });
});

describe('derive : la péremption délibérée (§ 8.9, point 3 ; § 9 ; § 4.4)', () => {
  test('exclure 5, supprimer la table 2, réduire la table 3, passer à 3 tours, ajouter 13 : chaque raison nommée, triées par code puis identifiant ; examiner conserve chaque proposition et le retenu', () => {
    const charge = chargeAvecGeneration();
    charge.retenu = retenuDe(charge.propositions[1]);
    charge.evenement.etat = 'retenu';
    charge.participants[4].exclu = true;
    charge.tables = charge.tables.filter(({ id }) => id !== 2);
    charge.tables.find(({ id }) => id === 3).sieges = 2;
    charge.evenement.tours = 3;
    charge.participants.push(personne(13, ...TREIZIEME));
    charge.prochainsIds.participant = 14;
    const raisons = [
      { code: 'CAPACITE_CHANGEE', table: 3, avant: 3, maintenant: 2 },
      { code: 'PARTICIPANT_EXCLU', participant: 5 },
      { code: 'PARTICIPANT_NON_PLACE', participant: 13 },
      { code: 'TABLE_SUPPRIMEE', table: 2 },
      { code: 'TOURS_CHANGES', avant: 4, maintenant: 3 },
    ];
    const lue = relire(charge);
    for (const proposition of lue.propositions) assert.deepStrictEqual(derive(proposition, lue), raisons);
    const examen = examiner(lue);
    assert.deepStrictEqual(examen.fautives, []);
    assert.deepStrictEqual(examen.derives, [1, 2, 3].map((id) => ({ id, raisons })));
    assert.deepStrictEqual(examen.charge.propositions, charge.propositions);
    assert.deepStrictEqual(examen.retenu, { fautes: [], raisons });
    assert.equal(examen.charge.retenu, lue.retenu);
  });

  test("chaque changement seul donne sa seule raison ; ce qui ne touche ni les personnes placées, ni le mobilier, ni les tours n'est pas une dérive", () => {
    const cas = [
      ['exclure la personne 5', (c) => { c.participants[4].exclu = true; },
        [{ code: 'PARTICIPANT_EXCLU', participant: 5 }]],
      ['supprimer la personne 7', (c) => { c.participants.splice(6, 1); },
        [{ code: 'PARTICIPANT_SUPPRIME', participant: 7 }]],
      ['ajouter la personne 13', (c) => { c.participants.push(personne(13, ...TREIZIEME)); },
        [{ code: 'PARTICIPANT_NON_PLACE', participant: 13 }]],
      ['ajouter la personne 13, exclue', (c) => { c.participants.push({ ...personne(13, ...TREIZIEME), exclu: true }); },
        []],
      ['supprimer la table 2', (c) => { c.tables.splice(1, 1); },
        [{ code: 'TABLE_SUPPRIMEE', table: 2 }]],
      ['ajouter la table 5', (c) => { c.tables.push(table(5, 5)); },
        [{ code: 'TABLE_AJOUTEE', table: 5 }]],
      ['réduire la table 3 à deux sièges', (c) => { c.tables[2].sieges = 2; },
        [{ code: 'CAPACITE_CHANGEE', table: 3, avant: 3, maintenant: 2 }]],
      ['agrandir la table 1 à quatre sièges', (c) => { c.tables[0].sieges = 4; },
        [{ code: 'CAPACITE_CHANGEE', table: 1, avant: 3, maintenant: 4 }]],
      ['passer le défaut à quatre sièges', (c) => { c.evenement.siegesParDefaut = 4; },
        [1, 2, 3, 4].map((id) => ({ code: 'CAPACITE_CHANGEE', table: id, avant: 3, maintenant: 4 }))],
      ['surcharger la table 4 à la valeur du défaut', (c) => { c.tables[3].sieges = 3; },
        []],
      ['passer à cinq tours', (c) => { c.evenement.tours = 5; },
        [{ code: 'TOURS_CHANGES', avant: 4, maintenant: 5 }]],
      ['passer à trois tours', (c) => { c.evenement.tours = 3; },
        [{ code: 'TOURS_CHANGES', avant: 4, maintenant: 3 }]],
      ["renommer, changer d'appartenance, renuméroter, déplacer et changer de forme, attribuer les sièges", (c) => {
        c.participants[0].nom = 'Aubier';
        c.participants[1].appartenance = null;
        c.tables[1].numero = 7;
        c.tables[2].position = { x: -40, y: 125.5 };
        c.tables[3].forme = 'carree';
        c.reglages.attribuerSieges = true;
      }, []],
    ];
    for (const [libelle, changer, raisons] of cas) {
      const charge = chargeAvecGeneration();
      changer(charge);
      for (const proposition of charge.propositions) {
        assert.deepStrictEqual(derive(proposition, charge), raisons, libelle);
      }
      const examen = examiner(charge);
      assert.deepStrictEqual(examen.fautives, [], libelle);
      assert.equal(examen.charge.propositions.length, 3, libelle);
      const attendues = raisons.length === 0 ? [] : [1, 2, 3].map((id) => ({ id, raisons }));
      assert.deepStrictEqual(examen.derives, attendues, libelle);
    }
  });

  test("les raisons d'un même code se rangent par identifiant, quel que soit l'ordre de la déclaration ou de la charge", () => {
    const p = fichierPermute();
    const charge = chargePetite();
    charge.evenement.siegesParDefaut = 4;
    charge.tables = charge.tables.filter(({ id }) => id !== 3 && id !== 1);
    charge.tables.push(table(6, 6), table(5, 5));
    charge.participants[8].exclu = true;
    charge.participants[1].exclu = true;
    charge.participants = charge.participants.filter(({ id }) => id !== 11 && id !== 4);
    charge.participants.push(personne(14, 'Ortie', 'Ovide'), personne(13, ...TREIZIEME));
    assert.deepStrictEqual(derive(p, charge), [
      { code: 'CAPACITE_CHANGEE', table: 2, avant: 3, maintenant: 4 },
      { code: 'CAPACITE_CHANGEE', table: 4, avant: 3, maintenant: 4 },
      { code: 'PARTICIPANT_EXCLU', participant: 2 },
      { code: 'PARTICIPANT_EXCLU', participant: 9 },
      { code: 'PARTICIPANT_NON_PLACE', participant: 13 },
      { code: 'PARTICIPANT_NON_PLACE', participant: 14 },
      { code: 'PARTICIPANT_SUPPRIME', participant: 4 },
      { code: 'PARTICIPANT_SUPPRIME', participant: 11 },
      { code: 'TABLE_AJOUTEE', table: 5 },
      { code: 'TABLE_AJOUTEE', table: 6 },
      { code: 'TABLE_SUPPRIMEE', table: 1 },
      { code: 'TABLE_SUPPRIMEE', table: 3 },
    ]);
  });

  test("capacités inégales, tables déclarées hors de l'ordre des identifiants : chaque capacité déclarée se compare à celle de sa table, et seule celle qui change est nommée", () => {
    const p = fichierInegal();
    const charge = chargePetite();
    charge.tables[3].sieges = 4;
    assert.deepStrictEqual(derive(p, charge), []);
    charge.tables[3].sieges = 5;
    assert.deepStrictEqual(derive(p, charge), [{ code: 'CAPACITE_CHANGEE', table: 4, avant: 4, maintenant: 5 }]);
    charge.tables[3].sieges = 4;
    charge.evenement.siegesParDefaut = 4;
    assert.deepStrictEqual(
      derive(p, charge),
      [1, 2, 3].map((id) => ({ code: 'CAPACITE_CHANGEE', table: id, avant: 3, maintenant: 4 })),
    );
  });

  test("une personne exclue à la génération puis réintégrée n'est pas placée : PARTICIPANT_NON_PLACE", () => {
    const configuration = petite();
    configuration.participants[4].exclu = true;
    const [proposition] = rechercher(configuration, { graine: 9, arret: 1_000, nombre: 1 });
    const fichier = versFichier(proposition, configuration, { produitVersion: VERSION.affichee, attribuerSieges: false, decalage: 0 });
    const charge = chargePetite();
    charge.participants[4].exclu = true;
    assert.deepStrictEqual(derive(fichier, charge), []);
    charge.participants[4].exclu = false;
    assert.deepStrictEqual(derive(fichier, charge), [{ code: 'PARTICIPANT_NON_PLACE', participant: 5 }]);
  });

  test('sans dérive, le plan passe indexerPlan sur la configuration courante ; une table ajoutée est une dérive, que le moteur refuserait', () => {
    const charge = chargeAvecGeneration();
    const instance = normaliser(configurationDepuisCharge(charge));
    for (const proposition of charge.propositions) {
      assert.deepStrictEqual(derive(proposition, charge), []);
      indexerPlan(instance, planDepuisFichier(proposition));
    }
    charge.tables.push(table(5, 5));
    const agrandie = normaliser(configurationDepuisCharge(charge));
    for (const proposition of charge.propositions) {
      assert.deepStrictEqual(derive(proposition, charge), [{ code: 'TABLE_AJOUTEE', table: 5 }]);
      assert.throws(
        () => indexerPlan(agrandie, planDepuisFichier(proposition)),
        (erreur) => erreur instanceof ErreurConfiguration && erreur.code === 'PLAN_TABLE_ABSENTE' && erreur.details.table === 5,
      );
    }
  });
});

describe("examiner : le partage d'une charge lue (§ 8.9, point 3)", () => {
  test("un retenu fautif est signalé et reste dans la charge, sans raison de dérive : la reprise par le .precedent n'est pas de son ressort", () => {
    const charge = chargeAvecGeneration();
    const retenu = retenuDe(charge.propositions[0]);
    const perdu = retenu.placement[1].sieges[3].pop();
    charge.retenu = retenu;
    charge.evenement.etat = 'retenu';
    charge.participants[4].exclu = true;
    const lue = relire(charge);
    const examen = examiner(lue);
    assert.deepStrictEqual(examen.retenu, { fautes: [{ code: 'MANQUANT', tour: 2, participant: perdu }], raisons: [] });
    assert.equal(examen.charge.retenu, lue.retenu);
    assert.deepStrictEqual(examen.fautives, []);
    assert.deepStrictEqual(examen.charge.propositions, charge.propositions);
    const raisons = [{ code: 'PARTICIPANT_EXCLU', participant: 5 }];
    assert.deepStrictEqual(examen.derives, [1, 2, 3].map((id) => ({ id, raisons })));
  });

  test("un retenu de forme quelconque, que l'analyse admet, est fautif sous la forme du retenu", () => {
    const sansCle = abimerFichier(chargeAvecGeneration(), (ecrit) => {
      ecrit.charge.retenu = { inconnue: [] };
      ecrit.entete.comptes.retenu = 1;
    });
    assert.deepStrictEqual(examiner(sansCle).retenu, { fautes: [{ code: 'FORME', chemin: 'proposition' }], raisons: [] });
    const charge = chargeAvecGeneration();
    const sansProposition = retenuDe(charge.propositions[0]);
    delete sansProposition.proposition;
    charge.retenu = sansProposition;
    assert.deepStrictEqual(examiner(charge).retenu, { fautes: [{ code: 'FORME', chemin: 'proposition' }], raisons: [] });
    assert.equal(examiner(charge).charge.retenu, sansProposition);
  });

  test('un retenu cohérent et périmé porte ses raisons, sans faute ; sans retenu, ni faute ni raison', () => {
    const charge = chargeAvecGeneration();
    assert.deepStrictEqual(examiner(charge).retenu, { fautes: [], raisons: [] });
    charge.retenu = retenuDe(charge.propositions[2]);
    assert.deepStrictEqual(examiner(charge).retenu, { fautes: [], raisons: [] });
    charge.participants[4].exclu = true;
    assert.deepStrictEqual(examiner(charge).retenu, {
      fautes: [],
      raisons: [{ code: 'PARTICIPANT_EXCLU', participant: 5 }],
    });
  });

  test("deux propositions cohérentes de même identifiant : la seconde dans l'ordre de la liste est fautive, IDENTIFIANT_REPETE, et le fichier s'ouvre sans elle ; une fautive n'écarte pas la cohérente qui porte son identifiant", () => {
    const charge = chargeAvecGeneration();
    const [p1, p2, p3] = charge.propositions;
    const homonyme = { ...structuredClone(p3), id: 2 };
    charge.propositions = [p1, p2, homonyme, p3];
    const examen = examiner(charge);
    assert.deepStrictEqual(examen.fautives, [{ rang: 2, id: 2, fautes: [{ code: 'IDENTIFIANT_REPETE' }] }]);
    assert.deepStrictEqual(examen.charge.propositions, [p1, p2, p3]);
    assert.equal(examen.charge.propositions[1], p2);
    // Au travers du fichier, que l'analyse admet avec ses deux propositions 2.
    const lue = examiner(relire(charge));
    assert.deepStrictEqual(lue.fautives.map(({ id, fautes }) => [id, fautes]), [[2, [{ code: 'IDENTIFIANT_REPETE' }]]]);
    assert.deepStrictEqual(lue.charge.propositions.map(({ id }) => id), [1, 2, 3]);

    const abimee = { ...structuredClone(p1), tours: 5 };
    charge.propositions = [abimee, p1, p2, p3];
    const seconde = examiner(charge);
    assert.deepStrictEqual(seconde.fautives, [
      { rang: 0, id: 1, fautes: [{ code: 'LONGUEUR', tour: null, table: null, declare: 5, ecrit: 4 }] },
    ]);
    assert.deepStrictEqual(seconde.charge.propositions, [p1, p2, p3]);
    // Après la cohérente, une fautive de même identifiant se nomme par sa
    // propre faute, et non comme une répétition.
    charge.propositions = [p1, abimee];
    assert.deepStrictEqual(examiner(charge).fautives, [
      { rang: 1, id: 1, fautes: [{ code: 'LONGUEUR', tour: null, table: null, declare: 5, ecrit: 4 }] },
    ]);
  });

  test("une proposition cohérente dont l'identifiant atteint prochainsIds.proposition est fautive, IDENTIFIANT_HORS_COMPTEUR, et le fichier s'ouvre sans elle ; un retenu dont la proposition d'origine l'atteint porte cette faute, reste, et garde ses raisons de dérive", () => {
    const HORS = { code: 'IDENTIFIANT_HORS_COMPTEUR' };
    // Les propositions 1, 2 et 3 sous le compteur 4 ; le retenu vient de la
    // première. Un octet change dans le fichier écrit : chaque fois,
    // l'analyse le lit, et examiner n'écarte que la proposition touchée.
    const charge = chargeAvecGeneration();
    const [p1, p2, p3] = charge.propositions;
    charge.retenu = retenuDe(p1);
    charge.evenement.etat = 'retenu';
    const texte = serialiser(charge, ENTETE);
    const unOctet = ([avant, apres]) => {
      assert.equal(texte.split(avant).length, 2, `« ${avant} » doit figurer une fois`);
      return examiner(analyser(texte.replace(avant, apres)).charge);
    };
    // L'identifiant de la troisième proposition, puis le compteur, réécrits.
    const troisieme = (id) => ['{"id":3,"graine"', `{"id":${id},"graine"`];
    const compteur = (prochain) => ['"proposition":4}', `"proposition":${prochain}}`];
    const cas = [
      ['la troisième au compteur', troisieme(4), [{ rang: 2, id: 4, fautes: [HORS] }], [p1, p2]],
      ['la troisième au-delà', troisieme(9), [{ rang: 2, id: 9, fautes: [HORS] }], [p1, p2]],
      ['la troisième répète la deuxième', troisieme(2),
        [{ rang: 2, id: 2, fautes: [{ code: 'IDENTIFIANT_REPETE' }] }], [p1, p2]],
      ['la troisième à 0', troisieme(0), [{ rang: 2, id: null, fautes: [{ code: 'FORME', chemin: 'id' }] }], [p1, p2]],
      ['le compteur abaissé à 2', compteur(2),
        [{ rang: 1, id: 2, fautes: [HORS] }, { rang: 2, id: 3, fautes: [HORS] }], [p1]],
    ];
    for (const [libelle, octet, fautives, gardees] of cas) {
      const examen = unOctet(octet);
      assert.deepStrictEqual(examen.fautives, fautives, libelle);
      assert.deepStrictEqual(examen.charge.propositions, gardees, libelle);
      assert.deepStrictEqual(examen.retenu, { fautes: [], raisons: [] }, libelle);
    }
    // Abaissé à 1, le compteur écarte chaque proposition, et le retenu, dont
    // l'origine l'atteint, porte la faute sans être retiré. Son placement se
    // tient : sa dérive se nomme encore.
    const auPlusBas = unOctet(compteur(1));
    assert.deepStrictEqual(
      auPlusBas.fautives.map(({ id, fautes }) => [id, fautes]),
      [[1, [HORS]], [2, [HORS]], [3, [HORS]]],
    );
    assert.deepStrictEqual(auPlusBas.charge.propositions, []);
    assert.deepStrictEqual(auPlusBas.retenu, { fautes: [HORS], raisons: [] });
    assert.deepStrictEqual(auPlusBas.charge.retenu, charge.retenu);
    const exclue = structuredClone(charge);
    exclue.participants[4].exclu = true;
    exclue.prochainsIds.proposition = 1;
    assert.deepStrictEqual(examiner(exclue).retenu, {
      fautes: [HORS],
      raisons: [{ code: 'PARTICIPANT_EXCLU', participant: 5 }],
    });
    // Une proposition qui se contredit se nomme par ses propres fautes,
    // même quand son identifiant atteint aussi le compteur ; un retenu qui se
    // contredit aussi, sans raison de dérive.
    const abimee = { ...structuredClone(p3), id: 4, tours: 5 };
    const contradictoire = { ...charge, propositions: [p1, abimee], retenu: { ...retenuDe(abimee), proposition: 4 } };
    const longueur = { code: 'LONGUEUR', tour: null, table: null, declare: 5, ecrit: 4 };
    const examen = examiner(contradictoire);
    assert.deepStrictEqual(examen.fautives, [{ rang: 1, id: 4, fautes: [longueur] }]);
    assert.deepStrictEqual(examen.retenu, { fautes: [longueur], raisons: [] });
  });

  test("la charge rendue relève prochainsIds.proposition au-delà de chaque identifiant lu — d'une proposition écartée, quelle que soit sa faute, et de l'origine du retenu, cohérent ou non — ; le compteur ne recule jamais, ce qui n'est pas un identifiant, au-delà de 2^31 − 1 compris, n'y entre pas, et relevé, il s'arrête au plus grand identifiant, que l'analyse relit", () => {
    const HORS = 'IDENTIFIANT_HORS_COMPTEUR';
    const PLUS_GRAND = 2 ** 31 - 1;
    // Les propositions 1, 2 et 3 sous le compteur 4 ; le retenu vient de la
    // troisième. Chaque cas abîme la charge du fichier écrit, que l'analyse
    // relit et qui se fige avant l'examen. Il nomme les écartées, [id,
    // code], et les fautes du retenu, ce que le cas éprouve, puis le
    // compteur attendu.
    const base = chargeAvecGeneration();
    base.retenu = retenuDe(base.propositions[2]);
    base.evenement.etat = 'retenu';
    const cas = [
      ["le fichier tel qu'écrit", () => {}, [], [], 4],
      ['le compteur porté à 9', (c) => { c.prochainsIds.proposition = 9; }, [], [], 9],
      ['le compteur abaissé à 2', (c) => { c.prochainsIds.proposition = 2; }, [[2, HORS], [3, HORS]], [HORS], 4],
      ['le compteur abaissé à 1', (c) => { c.prochainsIds.proposition = 1; },
        [[1, HORS], [2, HORS], [3, HORS]], [HORS], 4],
      ['la troisième à 9', (c) => { c.propositions[2].id = 9; }, [[9, HORS]], [], 10],
      ['la troisième à 9, qui se contredit', (c) => { Object.assign(c.propositions[2], { id: 9, tours: 5 }); },
        [[9, 'LONGUEUR']], [], 10],
      ['la troisième répète la deuxième', (c) => { c.propositions[2].id = 2; }, [[2, 'IDENTIFIANT_REPETE']], [], 4],
      ['la troisième à 9.5', (c) => { c.propositions[2].id = 9.5; }, [[null, 'FORME']], [], 4],
      ['la troisième à 2^53', (c) => { c.propositions[2].id = 2 ** 53; }, [[null, 'FORME']], [], 4],
      ['la troisième à 2^31', (c) => { c.propositions[2].id = 2 ** 31; }, [[null, 'FORME']], [], 4],
      ['la troisième au plus grand identifiant', (c) => { c.propositions[2].id = PLUS_GRAND; },
        [[PLUS_GRAND, HORS]], [], PLUS_GRAND],
      ["l'origine du retenu à 9", (c) => { c.retenu.proposition = 9; }, [], [HORS], 10],
      ["l'origine du retenu à 9, qui se contredit", (c) => { Object.assign(c.retenu, { proposition: 9, tours: 5 }); },
        [], ['LONGUEUR'], 10],
      ["l'origine du retenu à 9, hors de sa règle", (c) => {
        Object.assign(c.retenu, { proposition: 9, toura: c.retenu.tours });
        delete c.retenu.tours;
      }, [], ['FORME'], 10],
      ["l'origine du retenu à 9.5", (c) => { c.retenu.proposition = 9.5; }, [], ['FORME'], 4],
      ["l'origine du retenu au plus grand entier exact", (c) => { c.retenu.proposition = Number.MAX_SAFE_INTEGER; },
        [], ['FORME'], 4],
      ["l'origine du retenu à 2^31", (c) => { c.retenu.proposition = 2 ** 31; }, [], ['FORME'], 4],
      ["l'origine du retenu au plus grand identifiant", (c) => { c.retenu.proposition = PLUS_GRAND; },
        [], [HORS], PLUS_GRAND],
    ];
    // Le compteur que l'analyse relit dans le fichier de la charge rendue,
    // ou le refus qu'elle lève.
    const compteurRelu = (charge) => {
      try {
        return relire(charge).prochainsIds.proposition;
      } catch (erreur) {
        return `${erreur.name} ${erreur.message}`;
      }
    };
    const observes = cas.map(([libelle, abimer]) => {
      const lue = geler(abimerFichier(base, (ecrit) => abimer(ecrit.charge)));
      const examen = examiner(lue);
      return [
        libelle,
        examen.fautives.map(({ id, fautes: [premiere] }) => [id, premiere.code]),
        examen.retenu.fautes.map(({ code }) => code),
        examen.charge.prochainsIds,
        compteurRelu(examen.charge),
      ];
    });
    assert.deepStrictEqual(
      observes,
      cas.map(([libelle, , ecartees, fautesDuRetenu, compteur]) => [
        libelle,
        ecartees,
        fautesDuRetenu,
        { participant: 13, table: 5, proposition: compteur },
        compteur,
      ]),
    );
  });

  test("un identifiant au-delà de 2^31 − 1, écrit à la main à l'origine du retenu ou à une proposition, n'en est pas un : le retenu est fautif, la proposition écartée, le compteur reste à 4 ; la génération suivante, numérotée comme le dit versFichier, prend 4, 5 et 6, et le fichier se rouvre", () => {
    // Les propositions 1, 2 et 3 sous le compteur 4 ; le retenu vient de la
    // première. Une valeur change dans le texte écrit, que l'analyse lit
    // sans entrer dans les propositions ni dans le retenu.
    const suivante = rechercher(petite(), { graine: 13, arret: 2_000, nombre: 3 });
    const charge = chargeAvecGeneration();
    charge.retenu = retenuDe(charge.propositions[0]);
    charge.evenement.etat = 'retenu';
    const texte = serialiser(charge, ENTETE);
    const FORME_ORIGINE = { code: 'FORME', chemin: 'proposition' };
    const cas = [
      ["l'origine du retenu à 2^53 − 2", '"retenu": {"proposition":1,', 2 ** 53 - 2, [1, 2, 3], [FORME_ORIGINE]],
      ["l'origine du retenu à 2^31", '"retenu": {"proposition":1,', 2 ** 31, [1, 2, 3], [FORME_ORIGINE]],
      ['la troisième proposition à 2^53 − 2', '{"id":3,"graine"', 2 ** 53 - 2, [1, 2], []],
      ['la troisième proposition à 2^31', '{"id":3,"graine"', 2 ** 31, [1, 2], []],
    ];
    const observes = [];
    const attendus = [];
    for (const [libelle, avant, valeur, gardees, fautesDuRetenu] of cas) {
      assert.equal(texte.split(avant).length, 2, `« ${avant} » doit figurer une fois`);
      const ouverte = examiner(analyser(texte.replace(avant, avant.replace(/\d+,/, `${valeur},`))).charge).charge;
      // L'appelant, comme le dit versFichier : la génération décalée de
      // prochainsIds.proposition − 1, puis le compteur porté au-delà.
      const decalage = ouverte.prochainsIds.proposition - 1;
      const configuration = configurationDepuisCharge(ouverte);
      const options = { produitVersion: VERSION.affichee, attribuerSieges: false, decalage };
      const generee = {
        ...ouverte,
        prochainsIds: { ...ouverte.prochainsIds, proposition: decalage + suivante.length + 1 },
        propositions: [
          ...ouverte.propositions,
          ...suivante.map((proposition) => versFichier(proposition, configuration, options)),
        ],
      };
      const rouverte = examiner(relire(generee));
      observes.push([
        libelle,
        decalage,
        rouverte.charge.propositions.map(({ id }) => id),
        rouverte.fautives,
        rouverte.retenu.fautes,
        rouverte.charge.prochainsIds.proposition,
      ]);
      attendus.push([libelle, 3, [...gardees, 4, 5, 6], [], fautesDuRetenu, 7]);
    }
    assert.deepStrictEqual(observes, attendus);
  });

  test("un identifiant de 2^31 − 1, le plus grand, écrit à la main à l'origine du retenu ou à une proposition, ou le compteur écrit à cette valeur, laisse à 2^31 − 1 le compteur de la charge rendue : la génération suivante, d'une proposition ou de trois, numérotée comme le dit versFichier, lève COMPTEUR_SATURE à sa première proposition, un code que l'appelant lit avant toute écriture", () => {
    // Les propositions 1, 2 et 3 sous le compteur 4 ; le retenu vient de la
    // première. Une valeur change dans le texte écrit, que l'analyse admet :
    // elle ne lit des propositions et du retenu que le conteneur, et le
    // compteur reste dans sa règle.
    const PLUS_GRAND = 2 ** 31 - 1;
    const suivante = rechercher(petite(), { graine: 13, arret: 2_000, nombre: 3 });
    const charge = chargeAvecGeneration();
    charge.retenu = retenuDe(charge.propositions[0]);
    charge.evenement.etat = 'retenu';
    const texte = serialiser(charge, ENTETE);
    const cas = [
      ["l'origine du retenu", '"retenu": {"proposition":1,', `"retenu": {"proposition":${PLUS_GRAND},`],
      ['la troisième proposition', '{"id":3,"graine"', `{"id":${PLUS_GRAND},"graine"`],
      ['le compteur', '"proposition":4}', `"proposition":${PLUS_GRAND}}`],
    ];
    const observes = [];
    const attendus = [];
    for (const [libelle, avant, apres] of cas) {
      assert.equal(texte.split(avant).length, 2, `« ${avant} » doit figurer une fois`);
      const ouverte = examiner(analyser(texte.replace(avant, apres)).charge).charge;
      // L'appelant, comme le dit versFichier : la génération décalée de
      // prochainsIds.proposition − 1, chacune de ses propositions mise en
      // forme avant qu'aucune ne s'écrive.
      const decalage = ouverte.prochainsIds.proposition - 1;
      const options = { produitVersion: VERSION.affichee, attribuerSieges: false, decalage };
      const configuration = configurationDepuisCharge(ouverte);
      for (const nombre of [1, 3]) {
        const generation = suivante.slice(0, nombre);
        observes.push([
          libelle,
          nombre,
          ouverte.prochainsIds.proposition,
          refusDe(() => generation.map((proposition) => versFichier(proposition, configuration, options))),
        ]);
        attendus.push([libelle, nombre, PLUS_GRAND, COMPTEUR_SATURE]);
      }
    }
    assert.deepStrictEqual(observes, attendus);
  });

  test("un compteur abaissé à la main, puis une génération numérotée depuis la charge rendue, comme le dit versFichier : aucun identifiant écarté ne revient, et l'origine du retenu n'est jamais réattribuée", () => {
    // Les propositions 1, 2 et 3 sous le compteur 4 ; le retenu vient de
    // l'une d'elles. Le compteur, abaissé à 1, 2 ou 3 dans le fichier écrit,
    // écarte celles qu'il ne couvre plus. La génération suivante, décalée de
    // prochainsIds.proposition − 1 de la charge rendue, prend 4, 5 et 6 ; à
    // la réouverture, l'identifiant de l'origine du retenu ne désigne que
    // l'origine elle-même, quand elle est gardée, et rien sinon.
    const suivante = rechercher(petite(), { graine: 13, arret: 2_000, nombre: 3 });
    const observes = [];
    const attendus = [];
    for (const abaisse of [1, 2, 3]) {
      for (const rang of [0, 1, 2]) {
        const charge = chargeAvecGeneration();
        const origine = charge.propositions[rang];
        charge.retenu = retenuDe(origine);
        charge.evenement.etat = 'retenu';
        const texte = serialiser(charge, ENTETE);
        assert.equal(texte.split('"proposition":4}').length, 2, 'le compteur doit figurer une fois');
        const abime = texte.replace('"proposition":4}', `"proposition":${abaisse}}`);
        const ouverte = examiner(analyser(abime).charge).charge;
        // L'appelant, comme le dit versFichier : la génération décalée de
        // prochainsIds.proposition − 1, puis le compteur porté au-delà.
        const configuration = configurationDepuisCharge(ouverte);
        const decalage = ouverte.prochainsIds.proposition - 1;
        const options = { produitVersion: VERSION.affichee, attribuerSieges: false, decalage };
        const generee = {
          ...ouverte,
          prochainsIds: { ...ouverte.prochainsIds, proposition: decalage + suivante.length + 1 },
          propositions: [
            ...ouverte.propositions,
            ...suivante.map((proposition) => versFichier(proposition, configuration, options)),
          ],
        };
        const rouverte = examiner(relire(generee));
        const libelle = `compteur abaissé à ${abaisse}, retenu de la proposition ${origine.id}`;
        observes.push([
          libelle,
          rouverte.charge.propositions.map(({ id }) => id),
          rouverte.fautives,
          rouverte.retenu,
          rouverte.charge.propositions.filter(({ id }) => id === origine.id).map(({ graine }) => graine),
        ]);
        attendus.push([
          libelle,
          [...[1, 2, 3].filter((id) => id < abaisse), 4, 5, 6],
          [],
          { fautes: [], raisons: [] },
          origine.id < abaisse ? [origine.graine] : [],
        ]);
      }
    }
    assert.deepStrictEqual(observes, attendus);
  });

  test("une proposition qui ne se lit pas est écartée seule : rang dans la liste, id null quand son identifiant n'en est pas un ; null, et un retenu égaré parmi les propositions, aussi", () => {
    const charge = chargeAvecGeneration();
    const lue = abimerFichier(charge, (ecrit) => {
      const [, deuxieme] = ecrit.charge.propositions;
      ecrit.charge.propositions.unshift(42, { id: 1, inconnue: true }, { ...deuxieme, id: 'deux' }, null, retenuDe(deuxieme));
      ecrit.entete.comptes.propositions = 8;
    });
    const examen = examiner(lue);
    // Le retenu égaré passe la forme du retenu : seule la règle d'une
    // proposition, que l'examen applique à chaque élément de la liste,
    // l'écarte.
    assert.deepStrictEqual(fautes(lue.propositions[4]), []);
    assert.deepStrictEqual(examen.fautives, [
      { rang: 0, id: null, fautes: [{ code: 'FORME', chemin: '' }] },
      { rang: 1, id: 1, fautes: [{ code: 'FORME', chemin: 'graine' }] },
      { rang: 2, id: null, fautes: [{ code: 'FORME', chemin: 'id' }] },
      { rang: 3, id: null, fautes: [{ code: 'FORME', chemin: '' }] },
      { rang: 4, id: null, fautes: [{ code: 'FORME', chemin: 'id' }] },
    ]);
    assert.deepStrictEqual(examen.charge.propositions, charge.propositions);
    assert.deepStrictEqual(examen.derives, []);
  });

  test("la charge rendue garde l'ordre de la liste ; les dérives se rangent par identifiant, les fautives par rang", () => {
    const charge = chargeAvecGeneration();
    const [p1, p2, p3] = charge.propositions;
    const abimee = { ...structuredClone(p2), id: 4, tours: 5 };
    charge.propositions = [p3, abimee, p1, p2];
    charge.participants[4].exclu = true;
    const examen = examiner(charge);
    const raisons = [{ code: 'PARTICIPANT_EXCLU', participant: 5 }];
    assert.deepStrictEqual(examen.charge.propositions, [p3, p1, p2]);
    assert.deepStrictEqual(examen.derives, [1, 2, 3].map((id) => ({ id, raisons })));
    assert.deepStrictEqual(examen.fautives.map(({ rang, id }) => [rang, id]), [[1, 4]]);
  });

  test('examiner ne modifie pas la charge reçue et rend une charge neuve, dont le reste est celui de la charge reçue', () => {
    const charge = chargeAvecGeneration();
    charge.propositions[0].placement[0].reserve.push(13);
    charge.retenu = retenuDe(charge.propositions[1]);
    charge.participants[4].exclu = true;
    const avant = structuredClone(charge);
    geler(charge);
    const examen = examiner(charge);
    assert.deepStrictEqual(charge, avant);
    assert.notEqual(examen.charge, charge);
    assert.deepStrictEqual(examen.charge, { ...avant, propositions: avant.propositions.slice(1) });
    assert.equal(examen.charge.participants, charge.participants);
    assert.equal(examen.charge.retenu, charge.retenu);
  });
});

// chargeAvecGeneration, ses propositions figées au registre (gel.js) : la
// liste, les personnes, les tables et l'événement restent modifiables.
const chargeFigee = () => gelerPropositions(chargeAvecGeneration());

// Les raisons de dérive de chaque proposition d'un examen, par identifiant.
const raisonsDe = (examen) => examen.derives.map(({ raisons }) => raisons);

describe('examiner : la mémoire par proposition figée (§ 8.9, point 3)', () => {
  test("les raisons d'une proposition figée sont le même objet, figé, tant que ce que la dérive lit de la charge ne change pas", () => {
    const charge = chargeFigee();
    charge.participants[4].exclu = true;
    const premier = examiner(charge);
    const renommee = {
      ...charge,
      evenement: { ...charge.evenement, nom: 'Soirée des Mésanges' },
      participants: charge.participants.map((p) => (p.id === 1 ? { ...p, nom: 'Aulnaie', prenom: 'Aurèle' } : p)),
      tables: charge.tables.map((t) => ({ ...t, numero: t.numero + 10, position: { x: 0, y: 40 * t.id } })),
    };
    const second = examiner(renommee);
    assert.deepStrictEqual(premier, examiner(structuredClone(charge)));
    assert.equal(premier.derives.length, 3);
    raisonsDe(second).forEach((raisons, rang) => {
      assert.equal(raisons, raisonsDe(premier)[rang]);
      assert.ok(Object.isFrozen(raisons) && raisons.every((raison) => Object.isFrozen(raison)));
    });
    assert.throws(() => raisonsDe(second)[0].push({ code: 'TABLE_AJOUTEE', table: 9 }), TypeError);
    assert.equal(examiner(charge).derives[0].raisons, raisonsDe(premier)[0]);
    assert.notEqual(examiner(charge).derives, premier.derives);
  });

  test('un seul champ lu par la dérive change à chaque étape : les dérives suivent, égales à celles de la copie libre', () => {
    const charge = chargeFigee();
    const etapes = [
      ['exclusion', (c) => (c.participants[4].exclu = true)],
      ['exclusion levée', (c) => (c.participants[4].exclu = false)],
      ['présence retirée', (c) => (c.participants[5].presence = [2, 3, 4])],
      ['présence réduite', (c) => (c.participants[5].presence = [3, 4])],
      ['présence rendue', (c) => delete c.participants[5].presence],
      ['participant ajouté', (c) => c.participants.push(personne(13, ...TREIZIEME))],
      ['participant supprimé', (c) => c.participants.pop()],
      ['participant renuméroté', (c) => (c.participants[0].id = 14)],
      ['table ajoutée', (c) => c.tables.push(table(5, 5))],
      ['table supprimée', (c) => c.tables.pop()],
      ['table renumérotée', (c) => (c.tables[3].id = 6)],
      ['sièges de la table', (c) => (c.tables[0].sieges = 4)],
      ['sièges par défaut', (c) => (c.evenement.siegesParDefaut = 5)],
      ['tours', (c) => (c.evenement.tours = 5)],
    ];
    let precedentes = examiner(charge).derives;
    assert.deepStrictEqual(precedentes, []);
    for (const [nom, changer] of etapes) {
      changer(charge);
      const examen = examiner(charge);
      assert.deepStrictEqual(examen, examiner(structuredClone(charge)), nom);
      assert.notDeepStrictEqual(examen.derives, precedentes, nom);
      assert.deepStrictEqual(examiner(charge), examen, nom);
      precedentes = examen.derives;
    }
  });

  test("une proposition gelée par Object.freeze seul n'est pas mise en mémoire : ses enfants restent lus à chaque appel", () => {
    const charge = chargeAvecGeneration();
    charge.participants[4].exclu = true;
    for (const p of charge.propositions) Object.freeze(p);
    const [p1] = charge.propositions;
    assert.notEqual(raisonsDe(examiner(charge))[0], raisonsDe(examiner(charge))[0]);
    p1.capacites[0] = 4;
    assert.deepStrictEqual(raisonsDe(examiner(charge))[0], [
      { code: 'CAPACITE_CHANGEE', table: 1, avant: 4, maintenant: 3 },
      { code: 'PARTICIPANT_EXCLU', participant: 5 },
    ]);
    p1.placement[0].reserve.push(13);
    assert.deepStrictEqual(examiner(charge).fautives, [
      { rang: 0, id: 1, fautes: [{ code: 'INCONNU', tour: 1, participant: 13 }] },
    ]);

    const gelee = chargeAvecGeneration();
    gelee.participants[4].exclu = true;
    geler(gelee.propositions);
    assert.notEqual(raisonsDe(examiner(gelee))[0], raisonsDe(examiner(gelee))[0]);
  });

  test("les fautes d'une proposition figée se jugent à chaque appel : répétition, compteur, fautive rendue en liste neuve", () => {
    const charge = chargeFigee();
    const [p1, p2] = charge.propositions;
    assert.deepStrictEqual(examiner(charge).fautives, []);
    const repetee = { ...charge, propositions: [p1, p2, p1] };
    assert.deepStrictEqual(examiner(repetee).fautives, [{ rang: 2, id: 1, fautes: [{ code: 'IDENTIFIANT_REPETE' }] }]);
    const abaissee = { ...charge, prochainsIds: { ...charge.prochainsIds, proposition: 2 } };
    assert.deepStrictEqual(examiner(abaissee).fautives, [
      { rang: 1, id: 2, fautes: [{ code: 'IDENTIFIANT_HORS_COMPTEUR' }] },
      { rang: 2, id: 3, fautes: [{ code: 'IDENTIFIANT_HORS_COMPTEUR' }] },
    ]);
    assert.deepStrictEqual(examiner(charge).fautives, []);

    const fautive = figer({ ...structuredClone(p2), id: 4, tours: 5 });
    const avecFautive = { ...charge, propositions: [p1, fautive], prochainsIds: { ...charge.prochainsIds, proposition: 5 } };
    const [premier, second] = [examiner(avecFautive), examiner(avecFautive)];
    assert.deepStrictEqual(premier, examiner(structuredClone(avecFautive)));
    assert.deepStrictEqual(second, premier);
    assert.equal(premier.fautives.length, 1);
    assert.notEqual(second.fautives[0].fautes, premier.fautives[0].fautes);
    assert.ok(!Object.isFrozen(premier.fautives[0].fautes));
  });

  test('une charge que la dérive ne sait pas lire lève comme sa copie libre, présence null comprise', () => {
    const charge = chargeFigee();
    charge.participants[4].exclu = true;
    examiner(charge);
    const abimages = [
      (c) => (c.tables = [null]),
      (c) => (c.participants = [null]),
      (c) => (c.evenement = null),
      (c) => (c.participants = c.participants.map((p) => (p.id === 1 ? { ...p, presence: null } : p))),
    ];
    for (const abimer of abimages) {
      const abimee = { ...charge, evenement: { ...charge.evenement } };
      abimer(abimee);
      let attendue = null;
      try {
        examiner(structuredClone(abimee));
      } catch (erreur) {
        attendue = erreur;
      }
      assert.ok(attendue instanceof TypeError);
      assert.throws(() => examiner(abimee), { name: attendue.name, message: attendue.message });
    }
  });
});

describe('formeNommee : la lecture et le signalement (§ 8.9, point 4)', () => {
  test('le tour 1 du plan parfait : douze lignes, table 1 → 1, 2, 3, avec les noms et prénoms de la charge, siège null sans attribution', () => {
    const lignes = formeNommee(fichierParfait(), chargePetite());
    assert.equal(lignes.length, 48);
    assert.deepStrictEqual(lignes.filter(({ tour }) => tour === 1), [
      ligne(1, 1, 1, null, 1, 'Aubépine', 'Agathe'),
      ligne(1, 1, 1, null, 2, 'Bruyère', 'Basile'),
      ligne(1, 1, 1, null, 3, 'Chardon', 'Céleste'),
      ligne(1, 2, 2, null, 4, 'Doucette', 'Désiré'),
      ligne(1, 2, 2, null, 5, 'Églantine', 'Edmée'),
      ligne(1, 2, 2, null, 6, 'Fougère', 'Firmin'),
      ligne(1, 3, 3, null, 7, 'Giroflée', 'Gisèle'),
      ligne(1, 3, 3, null, 8, 'Houblon', 'Honoré'),
      ligne(1, 3, 3, null, 9, 'Isatis', 'Ida'),
      ligne(1, 4, 4, null, 10, 'Jonquille', 'Joachim'),
      ligne(1, 4, 4, null, 11, 'Lavande', 'Lazare'),
      ligne(1, 4, 4, null, 12, 'Mélisse', 'Mathurin'),
    ]);
    assert.deepStrictEqual(
      lignes.map(({ tour, numero, participant }) => [tour, numero, participant]),
      PLAN_PARFAIT_PETITE.tours.flatMap((listes, r) => listes.flatMap((ids, i) => ids.map((id) => [r + 1, i + 1, id]))),
    );
  });

  test("sièges attribués : le siège est le rang dans la liste, à partir de 1, dans l'ordre écrit", () => {
    const p = { ...fichierParfait(), siegesAttribues: true };
    p.placement[0].sieges[0] = [3, 1, 2];
    const lignes = formeNommee(p, chargePetite()).filter(({ tour, table: id }) => tour === 1 && id === 1);
    assert.deepStrictEqual(lignes, [
      ligne(1, 1, 1, 1, 3, 'Chardon', 'Céleste'),
      ligne(1, 1, 1, 2, 1, 'Aubépine', 'Agathe'),
      ligne(1, 1, 1, 3, 2, 'Bruyère', 'Basile'),
    ]);
  });

  test("lignes rangées par tour, numéro de table, rang : numéros égaux départagés par l'identifiant, une table supprimée après les autres sans numéro, la réserve en dernier, une personne supprimée sans nom", () => {
    const p = fichierPermute();
    p.participants.push(13);
    for (const tour of p.placement) tour.reserve = [13];
    const charge = chargePetite();
    charge.participants.push(personne(13, ...TREIZIEME));
    charge.participants[6].prenom = null;
    charge.participants.splice(11, 1);
    charge.prochainsIds.participant = 14;
    charge.tables = [table(1, 3), table(2, 1), table(3, 1)];
    const lignes = formeNommee(p, charge);
    assert.equal(lignes.length, 52);
    assert.deepStrictEqual(lignes.filter(({ tour }) => tour === 1), [
      ligne(1, 2, 1, null, 4, 'Doucette', 'Désiré'),
      ligne(1, 2, 1, null, 5, 'Églantine', 'Edmée'),
      ligne(1, 2, 1, null, 6, 'Fougère', 'Firmin'),
      ligne(1, 3, 1, null, 7, 'Giroflée', null),
      ligne(1, 3, 1, null, 8, 'Houblon', 'Honoré'),
      ligne(1, 3, 1, null, 9, 'Isatis', 'Ida'),
      ligne(1, 1, 3, null, 1, 'Aubépine', 'Agathe'),
      ligne(1, 1, 3, null, 2, 'Bruyère', 'Basile'),
      ligne(1, 1, 3, null, 3, 'Chardon', 'Céleste'),
      ligne(1, 4, null, null, 10, 'Jonquille', 'Joachim'),
      ligne(1, 4, null, null, 11, 'Lavande', 'Lazare'),
      ligne(1, 4, null, null, 12, null, null),
      ligne(1, null, null, null, 13, 'Nigelle', 'Noémie'),
    ]);
    assert.deepStrictEqual(
      lignes.map(({ tour }) => tour),
      [1, 2, 3, 4].flatMap((tour) => Array(13).fill(tour)),
    );
  });

  test("la réserve suit les tables de son tour, ses personnes dans l'ordre écrit", () => {
    const lignes = formeNommee(fichierAReserve(), chargePetite()).filter(({ tour, table: id }) => tour === 1 && id === null);
    assert.deepStrictEqual(lignes, [
      ligne(1, null, null, null, 6, 'Fougère', 'Firmin'),
      ligne(1, null, null, null, 3, 'Chardon', 'Céleste'),
    ]);
  });

  test("un placement incohérent se rend pour le signalement de son défaut, une ligne par identifiant écrit, ses fautes à côté (fautes) : doublon, inconnu, liste au-delà de sa capacité, liste en trop sans table, liste ou tour en moins", () => {
    const charge = chargePetite();
    const casDe = (abimer) => {
      const p = fichierParfait();
      abimer(p);
      return p;
    };
    const cas = [
      [
        'un assis aussi dans la réserve',
        casDe((p) => { p.placement[0].reserve = [2]; }),
        ['DOUBLON'],
        (lignes) => {
          assert.equal(lignes.length, 49);
          assert.deepEqual(lignes.filter(({ tour, participant }) => tour === 1 && participant === 2), [
            ligne(1, 1, 1, null, 2, 'Bruyère', 'Basile'),
            ligne(1, null, null, null, 2, 'Bruyère', 'Basile'),
          ]);
        },
      ],
      [
        "un inconnu à la place d'un déclaré",
        casDe((p) => { p.placement[1].sieges[0][0] = 99; }),
        ['INCONNU', 'MANQUANT'],
        (lignes) => {
          assert.equal(lignes.length, 48);
          assert.deepEqual(lignes.filter(({ participant }) => participant === 99), [
            ligne(2, 1, 1, null, 99, null, null),
          ]);
        },
      ],
      [
        'une table au-delà de sa capacité, une liste en trop',
        casDe((p) => {
          p.siegesAttribues = true;
          p.placement[0].sieges[0].push(4);
          p.placement[0].sieges.push([5, 6]);
        }),
        ['LONGUEUR', 'LONGUEUR', 'DOUBLON', 'DOUBLON', 'DOUBLON'],
        (lignes) => {
          assert.equal(lignes.length, 51);
          assert.deepEqual(lignes.filter(({ tour }) => tour === 1).slice(0, 4).map(({ siege, participant }) => [siege, participant]), [
            [1, 1],
            [2, 2],
            [3, 3],
            [4, 4],
          ]);
          assert.deepEqual(lignes.filter(({ tour }) => tour === 1).slice(-2), [
            ligne(1, null, null, 1, 5, 'Églantine', 'Edmée', false),
            ligne(1, null, null, 2, 6, 'Fougère', 'Firmin', false),
          ]);
        },
      ],
      [
        'une liste et un tour en moins',
        casDe((p) => {
          p.placement[0].sieges.pop();
          p.placement.pop();
        }),
        ['LONGUEUR', 'LONGUEUR', 'MANQUANT', 'MANQUANT', 'MANQUANT'],
        (lignes) => {
          assert.equal(lignes.length, 33);
          assert.deepEqual([...new Set(lignes.map(({ tour }) => tour))], [1, 2, 3]);
          assert.equal(lignes.filter(({ tour, table }) => tour === 1 && table === 4).length, 0);
        },
      ],
    ];
    for (const [nom, p, codes, verifier] of cas) {
      assert.deepEqual(fautes(p).map(({ code }) => code), codes, nom);
      verifier(formeNommee(p, charge));
    }
  });

  test("planDepuisFichier et derive refusent une proposition fautive par TypeError, au lieu d'en rendre une lecture fausse ; formeNommee ne refuse qu'une forme fausse ; fautes ne lève jamais", () => {
    const charge = chargePetite();
    const abimee = fichierParfait();
    abimee.placement[0].sieges[0].pop();
    for (const [nom, appel] of [
      ['planDepuisFichier', () => planDepuisFichier(abimee)],
      ['derive', () => derive(abimee, charge)],
    ]) {
      leveTypeError(appel, /"MANQUANT"/, nom);
    }
    assert.equal(formeNommee(abimee, charge).length, 47);
    for (const illisible of [42, undefined, { ...fichierParfait(), placement: 'x' }]) {
      leveTypeError(() => planDepuisFichier(illisible), /"FORME"/, String(illisible));
      leveTypeError(() => derive(illisible, charge), /"FORME"/, String(illisible));
      leveTypeError(() => formeNommee(illisible, charge), /"FORME"/, String(illisible));
    }
    assert.deepStrictEqual(fautes(undefined), [{ code: 'FORME', chemin: '' }]);
  });
});

// Exécute fonction pendant que l'horloge et les sources d'aléa lèvent à leur
// lecture, puis les rétablit telles qu'elles étaient, propres ou héritées ;
// rend ce que rend fonction.
function sansHorlogeNiAlea(fonction) {
  const interdite = (nom) => () => {
    throw new Error(`${nom} lu`);
  };
  const remplacees = [
    [Math, 'random'],
    [Date, 'now'],
    [performance, 'now'],
    [crypto, 'getRandomValues'],
    [crypto, 'randomUUID'],
  ].map(([objet, nom]) => ({ objet, nom, propre: Object.hasOwn(objet, nom), valeur: objet[nom] }));
  const DateReelle = globalThis.Date;
  for (const { objet, nom } of remplacees) objet[nom] = interdite(nom);
  function DateInterdite() {
    throw new Error('Date lu');
  }
  DateInterdite.now = interdite('Date.now');
  globalThis.Date = DateInterdite;
  try {
    return fonction();
  } finally {
    globalThis.Date = DateReelle;
    for (const { objet, nom, propre, valeur } of remplacees) {
      if (propre) objet[nom] = valeur;
      else delete objet[nom];
    }
  }
}

// La valeur refaite à toute profondeur, les clés de chaque objet à rebours.
function aRebours(valeur) {
  if (Array.isArray(valeur)) return valeur.map(aRebours);
  if (typeof valeur !== 'object' || valeur === null) return valeur;
  const copie = {};
  for (const cle of Object.keys(valeur).reverse()) copie[cle] = aRebours(valeur[cle]);
  return copie;
}

describe('déterminisme (§ 8.8, § 14.7)', () => {
  // Les résultats de chaque fonction du module sur une charge où se trouvent
  // une proposition fautive, une dérive et un retenu, en un seul texte.
  function resultats(charge) {
    const configuration = petite();
    const [, coherente] = charge.propositions;
    const examen = examiner(charge);
    return JSON.stringify([
      versFichier(GENERATION[0], configuration, { produitVersion: VERSION.affichee, attribuerSieges: false, decalage: 0 }),
      charge.propositions.map((proposition) => fautes(proposition)),
      derive(coherente, charge),
      formeNommee(coherente, charge),
      planDepuisFichier(coherente),
      [examen.fautives, examen.derives, examen.retenu, examen.charge.propositions.map(({ id }) => id)],
    ]);
  }
  function chargeMelee() {
    const charge = chargeAvecGeneration();
    charge.propositions[0].placement[0].reserve.push(13, 2);
    charge.propositions[2].placement[3].sieges[1].pop();
    charge.retenu = retenuDe(charge.propositions[1]);
    charge.participants[4].exclu = true;
    return charge;
  }

  test('ni horloge ni aléa : la sortie de chaque fonction ne dépend que de ses arguments', () => {
    // Le filet est éprouvé d'abord : chaque source lève pendant qu'il est tendu.
    for (const lecture of [
      () => Math.random(),
      () => Date.now(),
      () => new Date(),
      () => performance.now(),
      () => crypto.getRandomValues(new Uint8Array(1)),
      () => crypto.randomUUID(),
    ]) {
      assert.throws(() => sansHorlogeNiAlea(lecture), / lu$/);
    }
    assert.equal(typeof Date.now(), 'number');
    assert.equal(sansHorlogeNiAlea(() => resultats(chargeMelee())), resultats(chargeMelee()));
  });

  test("l'ordre des clés reçues n'entre dans aucun résultat, ni dans la clé inconnue nommée", () => {
    const charge = chargeMelee();
    const inversee = aRebours(charge);
    assert.notEqual(JSON.stringify(inversee), JSON.stringify(charge));
    assert.equal(resultats(inversee), resultats(charge));
    const p = fichierParfait();
    const zetaPuisAlpha = { ...p, zeta: 1, alpha: 2 };
    const alphaPuisZeta = { ...p, alpha: 2, zeta: 1 };
    assert.deepStrictEqual(fautes(zetaPuisAlpha), [{ code: 'FORME', chemin: 'alpha' }]);
    assert.deepStrictEqual(fautes(alphaPuisZeta), [{ code: 'FORME', chemin: 'alpha' }]);
  });
});

// fichierParfait, sièges attribués, dont le tour 1 laisse vide le siège 2
// de la table 1 : sa liste vaut [12, null, 7], et la personne 2 attend en
// réserve. Une copie neuve à chaque appel.
function fichierAChaiseVide() {
  const p = fichierParfait();
  p.siegesAttribues = true;
  p.placement[0] = { sieges: [[12, null, 7], [4, 5, 6], [1, 8, 9], [10, 11, 3]], reserve: [2] };
  return p;
}

describe('le marqueur de chaise vide : null avant le dernier occupant, sièges attribués (§ 8.9)', () => {
  test("une liste [12, null, 7] est cohérente, proposition comme retenu : le null compte dans la longueur, n'est ni DOUBLON ni INCONNU, et planDepuisFichier le retire", () => {
    const p = fichierAChaiseVide();
    assert.deepStrictEqual(fautes(p), []);
    assert.deepStrictEqual(fautes(retenuDe(p)), []);
    assert.deepStrictEqual(planDepuisFichier(p).tours[0], [[7, 12], [4, 5, 6], [1, 8, 9], [3, 10, 11]]);
    assert.deepStrictEqual(planDepuisFichier(retenuDe(p)).tours[0][0], [7, 12]);
    // Deux chaises vides au même tour, à deux tables : aucune n'est un
    // doublon de l'autre.
    const deux = fichierAChaiseVide();
    deux.placement[0] = { sieges: [[12, null, 7], [4, null, 6], [1, 8, 9], [10, 11, 3]], reserve: [2, 5] };
    assert.deepStrictEqual(fautes(deux), []);
    assert.deepStrictEqual(planDepuisFichier(deux).tours[0].slice(0, 2), [[7, 12], [4, 6]]);
    // Le null occupe un siège : quatre éléments sur une capacité de 3.
    const longue = fichierAChaiseVide();
    longue.placement[0] = { sieges: [[12, null, 7, 9], [4, 5, 6], [1, 8], [10, 11, 3]], reserve: [2] };
    assert.deepStrictEqual(fautes(longue), [{ code: 'LONGUEUR', tour: 1, table: 1, declare: 3, ecrit: 4 }]);
  });

  test("une chaise vide au siège 1, [null, 12, 7] ou [null, null, 7], est cohérente, proposition comme retenu : planDepuisFichier la retire, et formeNommee garde le siège de chaque occupant", () => {
    const cas = [
      [[null, 12, 7], [2], [7, 12], [ligne(1, 1, 1, 2, 12, 'Mélisse', 'Mathurin'), ligne(1, 1, 1, 3, 7, 'Giroflée', 'Gisèle')]],
      [[null, null, 7], [2, 12], [7], [ligne(1, 1, 1, 3, 7, 'Giroflée', 'Gisèle')]],
    ];
    assert.ok(cas.length > 0);
    for (const [liste, reserve, occupants, assis] of cas) {
      const p = fichierAChaiseVide();
      p.placement[0] = { sieges: [liste, [4, 5, 6], [1, 8, 9], [10, 11, 3]], reserve };
      assert.deepStrictEqual(fautes(p), [], JSON.stringify(liste));
      assert.deepStrictEqual(fautes(retenuDe(p)), [], JSON.stringify(liste));
      assert.deepStrictEqual(planDepuisFichier(p).tours[0][0], occupants);
      assert.deepStrictEqual(planDepuisFichier(retenuDe(p)).tours[0][0], occupants);
      const lignes = formeNommee(p, chargePetite());
      assert.deepStrictEqual(lignes.filter(({ tour, table: id }) => tour === 1 && id === 1), assis);
      assert.deepStrictEqual(
        lignes.filter(({ tour, reserve: enReserve }) => tour === 1 && enReserve).map(({ participant }) => participant),
        reserve,
      );
    }
  });

  test("sans attribution, ou en fin de liste, null est une faute FORME qui nomme la chaise ; seul sous sa règle, il ne s'admet nulle part ailleurs dans un placement", () => {
    const cas = [
      ['sièges non attribués', (p) => { p.siegesAttribues = false; }, 'placement[0].sieges[0][1]'],
      ['une liste qui finit par null', (p) => {
        p.placement[0] = { sieges: [[12, null], [4, 5, 6], [1, 8, 9], [10, 11, 3]], reserve: [2, 7] };
      }, 'placement[0].sieges[0][1]'],
      ['une liste réduite à null', (p) => {
        p.placement[1].sieges[3] = [null];
        p.placement[1].reserve = [1, 4, 7];
      }, 'placement[1].sieges[3][0]'],
      ['une chaise vide admise au tour 1, puis une fin nulle au tour 3', (p) => {
        p.placement[2].sieges[0] = [4, 8, null];
        p.placement[2].reserve = [10];
      }, 'placement[2].sieges[0][2]'],
      ['une fin nulle au dernier tour, à la dernière table', (p) => {
        p.placement[3].sieges[3] = [2, 6, null];
        p.placement[3].reserve = [8];
      }, 'placement[3].sieges[3][2]'],
      ['sièges non attribués, une chaise vide au siège 1', (p) => {
        p.siegesAttribues = false;
        p.placement[0] = { sieges: [[null, 7, 12], [4, 5, 6], [1, 8, 9], [3, 10, 11]], reserve: [2] };
      }, 'placement[0].sieges[0][0]'],
      ['sièges non attribués, deux chaises vides : la première est nommée', (p) => {
        p.siegesAttribues = false;
        p.placement[0] = { sieges: [[null, null, 7], [4, 5, 6], [1, 8, 9], [3, 10, 11]], reserve: [2, 12] };
      }, 'placement[0].sieges[0][0]'],
      ['null dans la réserve', (p) => { p.placement[0].reserve = [2, null]; }, 'placement[0].reserve[1]'],
      ['null parmi les participants', (p) => { p.participants[11] = null; }, 'participants[11]'],
      ['null parmi les tables', (p) => { p.tables[3] = null; }, 'tables[3]'],
    ];
    assert.ok(cas.length > 0);
    const ecarts = cas.flatMap(([libelle, abimer, chemin]) =>
      [fichierAChaiseVide(), retenuDe(fichierAChaiseVide())].flatMap((p) => {
        abimer(p);
        const rendu = fautes(p);
        const attendu = [{ code: 'FORME', chemin }];
        return JSON.stringify(rendu) === JSON.stringify(attendu) ? [] : [`${libelle} : ${JSON.stringify(rendu)}`];
      }),
    );
    assert.deepEqual(ecarts, []);
    leveTypeError(() => planDepuisFichier({ ...fichierAChaiseVide(), siegesAttribues: false }), /FORME/);
  });

  test('formeNommee assied 12 au siège 1 et 7 au siège 3, sans ligne pour la chaise vide', () => {
    const lignes = formeNommee(fichierAChaiseVide(), chargePetite());
    assert.equal(lignes.length, 48);
    assert.ok(lignes.every(({ participant }) => participant !== null));
    assert.deepStrictEqual(lignes.filter(({ tour, table: id }) => tour === 1 && id === 1), [
      ligne(1, 1, 1, 1, 12, 'Mélisse', 'Mathurin'),
      ligne(1, 1, 1, 3, 7, 'Giroflée', 'Gisèle'),
    ]);
    assert.deepStrictEqual(
      lignes.filter(({ tour, reserve }) => tour === 1 && reserve),
      [ligne(1, null, null, null, 2, 'Bruyère', 'Basile')],
    );
  });

  test('versFichier garde les chaises vides du plan reçu quand les sièges sont attribués, et lève sans attribution', () => {
    const plan = {
      tables: [1, 2, 3, 4],
      tours: [[[12, null, 7], [4, 5, 6], [1, 8, 9], [10, 11, 3]], ...PLAN_PARFAIT_PETITE.tours.slice(1)],
      reserves: [[2], [], [], []],
    };
    const proposition = { ...PARFAITE, plan };
    const options = { produitVersion: VERSION.affichee, decalage: 0 };
    const fichier = versFichier(proposition, petite(), { ...options, attribuerSieges: true });
    assert.deepStrictEqual(fichier.placement[0].sieges, [[12, null, 7], [4, 5, 6], [1, 8, 9], [10, 11, 3]]);
    assert.deepStrictEqual(fichier, fichierAChaiseVide());
    leveTypeError(() => versFichier(proposition, petite(), { ...options, attribuerSieges: false }), /FORME/);
  });

  test("le fichier relu porte la liste telle quelle : examiner garde la proposition et le retenu sans faute, et écarte la proposition sans attribution qui porte null", () => {
    const charge = chargePetite();
    const proposition = fichierAChaiseVide();
    charge.propositions = [proposition, { ...fichierAChaiseVide(), id: 2, siegesAttribues: false }];
    charge.retenu = retenuDe(proposition);
    charge.prochainsIds.proposition = 3;
    charge.evenement.etat = 'retenu';
    const relue = relire(charge);
    assert.deepStrictEqual(relue.retenu.placement[0].sieges[0], [12, null, 7]);
    assert.deepStrictEqual(relue.propositions[0].placement[0].sieges[0], [12, null, 7]);
    const examen = examiner(relue);
    assert.deepStrictEqual(examen.retenu, { fautes: [], raisons: [] });
    assert.deepStrictEqual(examen.charge.propositions, [fichierAChaiseVide()]);
    assert.deepStrictEqual(examen.fautives, [
      { rang: 1, id: 2, fautes: [{ code: 'FORME', chemin: 'placement[0].sieges[0][0]' }] },
    ]);
  });
});

// --- La course de la recherche, hors du fichier d'état (§ 8.9, B31) ---------

// Une course inventée sur la petite démonstration, telle que le moteur la
// rend, à evalues mouvements évalués : un point de relevé à chaque
// puissance de dix strictement sous evalues. Le point de rang k reprend les
// tours du plan parfait décalés de k, chaque liste de table à rebours, hors
// de l'ordre croissant ; au premier point, la personne 12 attend en réserve
// au tour 1. Aucun appel à la recherche.
function courseInventee(evalues) {
  const releves = [];
  for (let k = 0, mouvements = 1; mouvements < evalues; k += 1, mouvements *= 10) {
    const { tours } = PLAN_PARFAIT_PETITE;
    const decales = tours.map((_, r) => tours[(r + k) % tours.length].map((liste) => [...liste].reverse()));
    const reserves = decales.map(() => []);
    if (k === 0) {
      decales[0][3] = decales[0][3].filter((id) => id !== 12);
      reserves[0] = [12];
    }
    releves.push({ mouvements, plan: { tables: [1, 2, 3, 4], tours: decales, reserves } });
  }
  return { evalues, releves };
}

// PARFAITE portant la course inventée à evalues mouvements, 1 234 par
// défaut : quatre points de relevé, à 1, 10, 100 et 1 000.
const parfaiteAvecCourse = (evalues = 1_234) => ({ ...PARFAITE, ...courseInventee(evalues) });

// Le plan reçu, chaque liste de table et chaque réserve par identifiant
// croissant, sans chaise vide : la forme que rend planDepuisFichier.
const planRange = ({ tables, tours, reserves }) => ({
  tables: [...tables],
  tours: tours.map((listes) => listes.map((liste) => liste.filter((id) => id !== null).sort((a, b) => a - b))),
  reserves: reserves.map((reserve) => [...reserve].sort((a, b) => a - b)),
});

// Un plan de configuration forgé sans moteur : à chaque tour, les
// participants non exclus, par identifiant croissant décalé de 37 rangs par
// tour, remplissent les tables dans l'ordre de la configuration, chacune
// jusqu'à sa capacité, chaque liste triée ; ceux qui restent vont à la
// réserve. Il porte chaque participant une fois par tour, et sa forme de
// fichier pèse ce que pèse celle d'un plan du moteur.
function planForge(configuration) {
  const ids = configuration.participants
    .filter(({ exclu }) => exclu !== true)
    .map(({ id }) => id)
    .sort((a, b) => a - b);
  const tours = [];
  const reserves = [];
  for (let r = 0; r < configuration.tours; r += 1) {
    const decalage = (37 * r) % ids.length;
    const ordre = [...ids.slice(decalage), ...ids.slice(0, decalage)];
    let rang = 0;
    tours.push(
      configuration.tables.map(({ capacite }) => {
        const liste = ordre.slice(rang, rang + capacite).sort((a, b) => a - b);
        rang += liste.length;
        return liste;
      }),
    );
    reserves.push(ordre.slice(rang).sort((a, b) => a - b));
  }
  return { tables: configuration.tables.map(({ id }) => id), tours, reserves };
}

// La proposition de fichier de PARFAITE, sous attribuerSieges, et sa course
// mise en forme de fichier, à evalues mouvements, 1 234 par défaut.
function avecSaCourse(attribuerSieges = false, evalues = 1_234) {
  const proposition = parfaiteAvecCourse(evalues);
  const options = { produitVersion: VERSION.affichee, attribuerSieges, decalage: 0 };
  const fichier = versFichier(proposition, petite(), options);
  return { fichier, course: courseVersFichier(proposition, fichier, { attribuerSieges }) };
}

describe("la course de la recherche hors du fichier d'état (§ 8.9, B31, D53)", () => {
  test("versFichier n'écrit aucune course, même quand la proposition du moteur en porte une : la proposition de fichier est celle d'une proposition sans course", () => {
    const options = { produitVersion: VERSION.affichee, attribuerSieges: false, decalage: 0 };
    const avec = versFichier(parfaiteAvecCourse(), petite(), options);
    assert.equal(Object.hasOwn(avec, 'course'), false);
    assert.deepStrictEqual(avec, fichierParfait());
    assert.deepStrictEqual(versFichier({ ...PARFAITE, evalues: 0, releves: [] }, petite(), options), fichierParfait());
  });

  test('courseVersFichier met la course en forme de fichier : sans attribution, chaque placement de relevé rangé comme celui de la proposition ; avec, dans l’ordre reçu ; la réserve rangée dans les deux cas', () => {
    const { releves } = courseInventee(1_234);
    const nonAttribues = avecSaCourse(false).course;
    const attribues = avecSaCourse(true).course;
    assert.equal(nonAttribues.evalues, 1_234);
    assert.deepStrictEqual(nonAttribues.releves.map(({ mouvements }) => mouvements), [1, 10, 100, 1_000]);
    nonAttribues.releves.forEach(({ placement }, i) => {
      const { tours, reserves } = planRange(releves[i].plan);
      assert.deepStrictEqual(placement, tours.map((sieges, r) => ({ sieges, reserve: reserves[r] })), `relevé ${i}`);
    });
    attribues.releves.forEach(({ placement }, i) => {
      const { tours, reserves } = releves[i].plan;
      assert.deepStrictEqual(placement, tours.map((sieges, r) => ({ sieges, reserve: reserves[r] })), `relevé ${i}`);
    });
    assert.deepStrictEqual(Object.keys(nonAttribues), ['evalues', 'releves']);
  });

  test('sans evalues, courseVersFichier rend null ; à zéro mouvement évalué, {evalues: 0, releves: []}', () => {
    const fichier = fichierParfait();
    assert.equal(courseVersFichier(PARFAITE, fichier, { attribuerSieges: false }), null);
    const nulle = courseVersFichier({ ...PARFAITE, evalues: 0, releves: [] }, fichier, { attribuerSieges: false });
    assert.deepStrictEqual(nulle, { evalues: 0, releves: [] });
    assert.equal(fauteDeCourse(fichier, nulle), null);
  });

  test('aller-retour courseVersFichier → JSON → courseDepuisFichier, sièges attribués ou non : la course reçue, en plans par identifiants rangés', () => {
    for (const attribuerSieges of [false, true]) {
      const { fichier, course } = avecSaCourse(attribuerSieges);
      const relue = JSON.parse(JSON.stringify(course));
      assert.equal(fauteDeCourse(fichier, relue), null, `attribuerSieges ${attribuerSieges}`);
      const { evalues, releves } = courseInventee(1_234);
      assert.deepStrictEqual(courseDepuisFichier(fichier, relue), {
        evalues,
        releves: releves.map(({ mouvements, plan }) => ({ mouvements, plan: planRange(plan) })),
      });
    }
    const { course } = avecSaCourse(false, 0);
    assert.deepStrictEqual(courseDepuisFichier(fichierParfait(), course), { evalues: 0, releves: [] });
    leveTypeError(() => courseDepuisFichier({ ...fichierParfait(), tours: 5 }, course), /placement fautif/);
    const contredite = { ...avecSaCourse(false).course, evalues: 20_001 };
    leveTypeError(() => courseDepuisFichier(fichierParfait(), contredite), /course\.evalues/);
  });

  test('courseDepuisFichier ne partage aucune liste avec la proposition ni avec la course', () => {
    const { fichier, course } = avecSaCourse(true);
    geler(fichier);
    geler(course);
    const { releves } = courseDepuisFichier(fichier, course);
    releves.forEach(({ plan }, i) => {
      const { placement } = course.releves[i];
      assert.notEqual(plan.tables, fichier.tables);
      plan.tours.forEach((listes, r) => {
        assert.notEqual(plan.reserves[r], placement[r].reserve);
        listes.forEach((liste, t) => assert.notEqual(liste, placement[r].sieges[t]));
      });
    });
  });

  test('fauteDeCourse nomme par son chemin la première contradiction : forme, evalues au-delà de arret, abscisse manquante, en trop, hors d’ordre ou au dernier point, placement de relevé qui contredit la déclaration', () => {
    // Chaque cas abîme une copie de la course, sous le drapeau donné, et
    // nomme le chemin attendu.
    const cas = [
      ['une durée dans un point', false, (c) => { c.releves[1].duree = 3; }, 'course.releves[1].duree'],
      ['une valeur mesurée', false, (c) => { c.valeurs = { rencontres: 3 }; }, 'course.valeurs'],
      ['evalues au-delà de arret', false, (c) => { c.evalues = 20_001; }, 'course.evalues'],
      ['abscisse manquante au milieu', false, (c) => { c.releves.splice(1, 1); }, 'course.releves[1].mouvements'],
      ['abscisse manquante à la fin', false, (c) => { c.releves.pop(); }, 'course.releves[3]'],
      ['abscisse en trop', false, (c) => {
        c.releves.push({ ...structuredClone(c.releves[3]), mouvements: 10_000 });
      }, 'course.releves[4]'],
      ['abscisses hors d’ordre', false, (c) => {
        const [a, b] = [c.releves[1], c.releves[2]];
        c.releves[1] = b;
        c.releves[2] = a;
      }, 'course.releves[1].mouvements'],
      ['abscisse qui n’est pas une puissance de dix', false, (c) => { c.releves[0].mouvements = 5; }, 'course.releves[0].mouvements'],
      ['abscisse 1 000 sous evalues 1 000 : elle est le placement', false, (c) => { c.evalues = 1_000; }, 'course.releves[3]'],
      ['abscisse 1 sous evalues 1', false, (c) => {
        c.evalues = 1;
        c.releves.splice(1);
      }, 'course.releves[0]'],
      ['un tour de moins', false, (c) => { c.releves[1].placement.pop(); }, 'course.releves[1].placement'],
      ['une liste de table de moins', false, (c) => { c.releves[2].placement[1].sieges.pop(); }, 'course.releves[2].placement[1].sieges'],
      ['une table au-delà de sa capacité', false, (c) => {
        const { sieges } = c.releves[1].placement[0];
        sieges[2].push(sieges[3].shift());
      }, 'course.releves[1].placement[0].sieges[2]'],
      ['un identifiant dupliqué : le second nommé', false, (c) => {
        const tour = c.releves[2].placement[3];
        tour.reserve.push(tour.sieges[1][0]);
      }, 'course.releves[2].placement[3].reserve[0]'],
      ['un identifiant inconnu', false, (c) => { c.releves[3].placement[2].sieges[0][1] = 13; }, 'course.releves[3].placement[2].sieges[0][1]'],
      ['un identifiant manquant sans entrée de réserve', false, (c) => {
        c.releves[0].placement[0].reserve = [];
      }, 'course.releves[0].placement[0]'],
      ['une chaise vide sans attribution', false, (c) => {
        c.releves[0].placement[0].sieges[3] = [null, 10, 11];
        c.releves[0].placement[0].reserve = [12];
      }, 'course.releves[0].placement[0].sieges[3][0]'],
      ['une chaise vide en fin de liste, sièges attribués', true, (c) => {
        const tour = c.releves[1].placement[2];
        const [premier] = tour.sieges[0].splice(0, 1);
        tour.sieges[0].push(null);
        tour.reserve = [premier];
      }, 'course.releves[1].placement[2].sieges[0][2]'],
    ];
    assert.equal(cas.length, 18);
    const ecarts = cas.flatMap(([libelle, attribuerSieges, abimer, chemin]) => {
      const { fichier, course } = avecSaCourse(attribuerSieges);
      const abimee = structuredClone(course);
      abimer(abimee);
      const rendu = fauteDeCourse(fichier, abimee);
      return rendu === chemin ? [] : [`${libelle} : ${rendu}`];
    });
    assert.deepEqual(ecarts, []);
    for (const valeur of [undefined, null, 3, 'x', []]) assert.equal(fauteDeCourse(fichierParfait(), valeur), 'course');
  });

  test('les bornes admises : evalues égal à arret, et ses points de relevé exactement les puissances de dix sous lui', () => {
    for (const evalues of [0, 1, 2, 10, 11, 1_000, 1_001, 20_000]) {
      const { fichier, course } = avecSaCourse(false, evalues);
      assert.equal(course.evalues, evalues);
      assert.equal(fauteDeCourse(fichier, course), null, `evalues ${evalues}`);
    }
    assert.deepStrictEqual(avecSaCourse(false, 20_000).course.releves.map(({ mouvements }) => mouvements), [1, 10, 100, 1_000, 10_000]);
  });

  test('courseVersFichier lève TypeError pour une course qui se contredit, et pour un point de relevé sur d’autres tables que le plan', () => {
    const fichier = fichierParfait();
    const options = { attribuerSieges: false };
    leveTypeError(() => courseVersFichier({ ...parfaiteAvecCourse(), evalues: 20_001 }, fichier, options), /course\.evalues/);
    // Sans points de relevé, la course n'a pas de releves : la faute nomme
    // la clé, et non un point.
    for (const evalues of [0, 1, 12]) {
      leveTypeError(() => courseVersFichier({ ...PARFAITE, evalues }, fichier, options), /course\.releves\b(?!\[)/);
    }
    const autresTables = parfaiteAvecCourse();
    autresTables.releves[1] = { ...autresTables.releves[1], plan: { ...autresTables.releves[1].plan, tables: [2, 1, 3, 4] } };
    leveTypeError(() => courseVersFichier(autresTables, fichier, options), /relevé/);
  });

  test('la taille d’une course sur la grande démonstration, à la forme réelle : six placements de relevé de 1 040 places, chacun du poids du placement de la proposition', () => {
    const configuration = CATALOGUE.find(({ cle }) => cle === 'grande').construire();
    const plan = planForge(configuration);
    const releves = [1, 10, 100, 1_000, 10_000, 100_000].map((mouvements) => ({ mouvements, plan }));
    const proposition = { id: 1, graine: 1, arret: 200_000, historique: HISTORIQUE_PAR_DEFAUT, plan, evalues: 200_000, releves };
    const fichier = versFichier(proposition, configuration, { produitVersion: VERSION.affichee, attribuerSieges: false, decalage: 0 });
    const course = courseVersFichier(proposition, fichier, { attribuerSieges: false });
    assert.equal(fichier.participants.length * fichier.tours, 1_040);
    const placement = JSON.stringify(fichier.placement).length;
    const octets = JSON.stringify(course).length;
    // Six placements et leurs abscisses : la forme positionnelle, sans
    // rien qui nomme une place.
    assert.ok(octets > 6 * placement && octets < 6.1 * placement, `course ${octets} o, placement ${placement} o`);
    assert.ok(octets > 15_000 && octets < 40_000, `course ${octets} o`);
  });
});

describe('la dérivation : deux champs facultatifs de la proposition (§ 8.9, C11, C13, D74)', () => {
  const OPTIONS = Object.freeze({ produitVersion: 'construction-epreuve', attribuerSieges: false, decalage: 6 });

  // La proposition du moteur de la table d'épreuve à 13 personnes : le plan
  // parfait, ses listes à rebours, la personne 13 à la réserve à chaque
  // tour et la 12 au premier.
  function propositionAReserve() {
    const tours = PLAN_PARFAIT_PETITE.tours.map((listes) => listes.map((liste) => [...liste].reverse()));
    tours[0][3] = [11, 10];
    return { ...PARFAITE, id: 2, graine: 7, plan: { tables: [1, 2, 3, 4], tours, reserves: [[13, 12], [13], [13], [13]] } };
  }
  function configurationATreize() {
    const configuration = petite();
    configuration.participants.push({ id: 13, nom: TREIZIEME[0], prenom: TREIZIEME[1], appartenance: null });
    return configuration;
  }

  // Ce que versFichier écrit sans dérivation, pour PARFAITE puis pour
  // propositionAReserve, chacune sièges non attribués puis attribués, sous
  // OPTIONS : JSON.stringify de la forme rendue, octet pour octet.
  const ECRITS_SANS_DERIVATION = Object.freeze([
    '{"id":7,"graine":48271,"arret":20000,"historique":1000,"produitVersion":"construction-epreuve","siegesAttribues":false,"tables":[1,2,3,4],"capacites":[3,3,3,3],"tours":4,"participants":[1,2,3,4,5,6,7,8,9,10,11,12],"placement":[{"sieges":[[1,2,3],[4,5,6],[7,8,9],[10,11,12]],"reserve":[]},{"sieges":[[6,9,12],[3,8,11],[2,5,10],[1,4,7]],"reserve":[]},{"sieges":[[4,8,10],[2,7,12],[1,6,11],[3,5,9]],"reserve":[]},{"sieges":[[5,7,11],[1,9,10],[3,4,12],[2,6,8]],"reserve":[]}]}',
    '{"id":7,"graine":48271,"arret":20000,"historique":1000,"produitVersion":"construction-epreuve","siegesAttribues":true,"tables":[1,2,3,4],"capacites":[3,3,3,3],"tours":4,"participants":[1,2,3,4,5,6,7,8,9,10,11,12],"placement":[{"sieges":[[1,2,3],[4,5,6],[7,8,9],[10,11,12]],"reserve":[]},{"sieges":[[6,9,12],[3,8,11],[2,5,10],[1,4,7]],"reserve":[]},{"sieges":[[4,8,10],[2,7,12],[1,6,11],[3,5,9]],"reserve":[]},{"sieges":[[5,7,11],[1,9,10],[3,4,12],[2,6,8]],"reserve":[]}]}',
    '{"id":8,"graine":7,"arret":20000,"historique":1000,"produitVersion":"construction-epreuve","siegesAttribues":false,"tables":[1,2,3,4],"capacites":[3,3,3,3],"tours":4,"participants":[1,2,3,4,5,6,7,8,9,10,11,12,13],"placement":[{"sieges":[[1,2,3],[4,5,6],[7,8,9],[10,11]],"reserve":[12,13]},{"sieges":[[6,9,12],[3,8,11],[2,5,10],[1,4,7]],"reserve":[13]},{"sieges":[[4,8,10],[2,7,12],[1,6,11],[3,5,9]],"reserve":[13]},{"sieges":[[5,7,11],[1,9,10],[3,4,12],[2,6,8]],"reserve":[13]}]}',
    '{"id":8,"graine":7,"arret":20000,"historique":1000,"produitVersion":"construction-epreuve","siegesAttribues":true,"tables":[1,2,3,4],"capacites":[3,3,3,3],"tours":4,"participants":[1,2,3,4,5,6,7,8,9,10,11,12,13],"placement":[{"sieges":[[3,2,1],[6,5,4],[9,8,7],[11,10]],"reserve":[12,13]},{"sieges":[[12,9,6],[11,8,3],[10,5,2],[7,4,1]],"reserve":[13]},{"sieges":[[10,8,4],[12,7,2],[11,6,1],[9,5,3]],"reserve":[13]},{"sieges":[[11,7,5],[10,9,1],[12,4,3],[8,6,2]],"reserve":[13]}]}',
  ]);

  // Les quatre cas d'ECRITS_SANS_DERIVATION : [proposition du moteur,
  // configuration, attribuerSieges].
  const CAS_SANS_DERIVATION = () => [
    [PARFAITE, petite(), false],
    [PARFAITE, petite(), true],
    [propositionAReserve(), configurationATreize(), false],
    [propositionAReserve(), configurationATreize(), true],
  ];

  // Le texte canonique d'une proposition de fichier dans une charge qui ne
  // porte qu'elle, ses retours de ligne et leur retrait retirés.
  function texteCanoniqueCompact(fichier) {
    const charge = { ...chargePetite(), propositions: [fichier] };
    const texte = serialiser(charge, ENTETE);
    const ouverture = '"propositions": [\n';
    const debut = texte.indexOf(ouverture) + ouverture.length;
    return texte.slice(debut, texte.indexOf('\n    ],\n    "retenu"')).replace(/\n */g, '').trimStart();
  }

  test('versFichier sous derivation écrit depart puis toursFiges juste après historique, avant produitVersion ; une liste vide n’écrit pas la clé', () => {
    const fichier = versFichier(PARFAITE, petite(), { ...OPTIONS, derivation: { depart: 3, toursFiges: [1, 3] } });
    assert.deepStrictEqual(Object.keys(fichier), [
      'id', 'graine', 'arret', 'historique', 'depart', 'toursFiges', 'produitVersion', 'siegesAttribues',
      'tables', 'capacites', 'tours', 'participants', 'placement',
    ]);
    assert.deepStrictEqual([fichier.id, fichier.depart, fichier.toursFiges], [7, 3, [1, 3]]);
    assert.deepStrictEqual(fautes(fichier), []);
    const { depart, toursFiges, ...reste } = fichier;
    assert.equal(JSON.stringify(reste), ECRITS_SANS_DERIVATION[0]);
    assert.ok(JSON.stringify(fichier).startsWith('{"id":7,"graine":48271,"arret":20000,"historique":1000,"depart":3,"toursFiges":[1,3],"produitVersion":'));

    const sansTour = versFichier(PARFAITE, petite(), { ...OPTIONS, derivation: { depart: 3, toursFiges: [] } });
    assert.equal(Object.hasOwn(sansTour, 'toursFiges'), false);
    assert.equal(sansTour.depart, 3);
    assert.ok(JSON.stringify(sansTour).startsWith('{"id":7,"graine":48271,"arret":20000,"historique":1000,"depart":3,"produitVersion":'));
    assert.deepStrictEqual(fautes(sansTour), []);

    // La liste écrite n'est pas celle reçue : la changer ensuite ne change
    // pas la proposition.
    const recue = [2];
    const copie = versFichier(PARFAITE, petite(), { ...OPTIONS, derivation: geler({ depart: 1, toursFiges: recue }) });
    assert.notEqual(copie.toursFiges, recue);
    assert.deepStrictEqual(copie.toursFiges, [2]);
  });

  test('garde : une proposition sans dérivation s’écrit octet pour octet comme une proposition ordinaire, objet rendu et texte canonique, derivation absente ou nulle', () => {
    const cas = CAS_SANS_DERIVATION();
    assert.equal(cas.length, ECRITS_SANS_DERIVATION.length);
    cas.forEach(([proposition, configuration, attribuerSieges], rang) => {
      for (const options of [{ ...OPTIONS, attribuerSieges }, { ...OPTIONS, attribuerSieges, derivation: null }]) {
        const fichier = versFichier(proposition, configuration, options);
        assert.equal(JSON.stringify(fichier), ECRITS_SANS_DERIVATION[rang], `cas ${rang}`);
        assert.equal(texteCanoniqueCompact(fichier), ECRITS_SANS_DERIVATION[rang], `cas ${rang}`);
      }
    });
  });

  test('une dérivée s’écrit dans le texte canonique ses deux champs après historique, et se relit telle quelle', () => {
    const fichier = versFichier(PARFAITE, petite(), { ...OPTIONS, derivation: { depart: 2, toursFiges: [2, 4] } });
    const attendu = ECRITS_SANS_DERIVATION[0].replace('"historique":1000,', '"historique":1000,"depart":2,"toursFiges":[2,4],');
    assert.equal(texteCanoniqueCompact(fichier), attendu);
    const charge = { ...chargePetite(), propositions: [fichier] };
    charge.prochainsIds.proposition = 8;
    const lue = relire(charge);
    assert.deepStrictEqual(lue.propositions, [fichier]);
    assert.deepStrictEqual(examiner(lue).fautives, []);
    assert.equal(serialiser(lue, ENTETE), serialiser(charge, ENTETE));
  });

  test('versFichier lève TypeError pour une dérivation que la proposition écrite contredirait', () => {
    const cas = [
      ['départ égal à l’identifiant', { depart: 7, toursFiges: [] }],
      ['départ postérieur', { depart: 9, toursFiges: [1] }],
      ['un tour hors de la soirée', { depart: 1, toursFiges: [5] }],
      ['tous les tours', { depart: 1, toursFiges: [1, 2, 3, 4] }],
      ['une liste désordonnée', { depart: 1, toursFiges: [2, 1] }],
      ['un départ qui n’est pas un identifiant', { depart: 0, toursFiges: [] }],
      // Une dérivation illisible se refuse avant d'être écrite : sans départ,
      // la clé depart vaudrait undefined ; sans liste, toursFiges ne se lit
      // pas.
      ['sans départ', { toursFiges: [] }],
      ['un départ undefined', { depart: undefined, toursFiges: [1] }],
      ['sans liste de tours figés', { depart: 1 }],
      ['un texte', 'x'],
    ];
    assert.equal(cas.length, 10);
    for (const [libelle, derivation] of cas) {
      leveTypeError(() => versFichier(PARFAITE, petite(), { ...OPTIONS, derivation }), /versFichier/, libelle);
    }
  });

  test('fautes : chaque faute de dérivation se nomme par son chemin — la forme d’abord, puis DERIVATION et sa raison, seule, avant la déclaration', () => {
    // La proposition 7 de la petite démonstration, dérivée ou non selon
    // modifier.
    const derivee = (modifier) => {
      const p = { ...fichierParfait(), id: 7 };
      modifier(p);
      return p;
    };
    const ordre = (p, cles) => Object.fromEntries([...cles.map((cle) => [cle, p[cle]]), ...Object.entries(p)]);
    const cas = [
      ['départ égal', (p) => { p.depart = 7; }, [{ code: 'DERIVATION', chemin: 'depart', raison: 'departNonAnterieur' }]],
      ['départ supérieur', (p) => { p.depart = 8; }, [{ code: 'DERIVATION', chemin: 'depart', raison: 'departNonAnterieur' }]],
      ['départ nul', (p) => { p.depart = 0; }, [{ code: 'FORME', chemin: 'depart' }]],
      ['départ texte', (p) => { p.depart = '3'; }, [{ code: 'FORME', chemin: 'depart' }]],
      ['départ null', (p) => { p.depart = null; }, [{ code: 'FORME', chemin: 'depart' }]],
      ['toursFiges vide', (p) => { p.depart = 3; p.toursFiges = []; }, [{ code: 'FORME', chemin: 'toursFiges' }]],
      ['toursFiges désordonnés', (p) => { p.depart = 3; p.toursFiges = [3, 1]; }, [{ code: 'FORME', chemin: 'toursFiges' }]],
      ['toursFiges répétés', (p) => { p.depart = 3; p.toursFiges = [2, 2]; }, [{ code: 'FORME', chemin: 'toursFiges' }]],
      ['toursFiges non entiers', (p) => { p.depart = 3; p.toursFiges = [1, 2.5]; }, [{ code: 'FORME', chemin: 'toursFiges[1]' }]],
      ['toursFiges à zéro', (p) => { p.depart = 3; p.toursFiges = [0, 1]; }, [{ code: 'FORME', chemin: 'toursFiges[0]' }]],
      ['toursFiges hors liste', (p) => { p.depart = 3; p.toursFiges = 2; }, [{ code: 'FORME', chemin: 'toursFiges' }]],
      ['un tour hors de la soirée', (p) => { p.depart = 3; p.toursFiges = [1, 5]; }, [{ code: 'DERIVATION', chemin: 'toursFiges[1]', raison: 'tourHorsSoiree' }]],
      ['tous les tours', (p) => { p.depart = 3; p.toursFiges = [1, 2, 3, 4]; }, [{ code: 'DERIVATION', chemin: 'toursFiges', raison: 'tousLesTours' }]],
      ['toursFiges sans départ', (p) => { p.toursFiges = [1]; }, [{ code: 'DERIVATION', chemin: 'toursFiges', raison: 'sansDepart' }]],
      // La forme passe avant la dérivation, la dérivation avant la
      // déclaration et la cohérence.
      ['graine fautive et départ égal', (p) => { p.depart = 7; p.graine = -1; }, [{ code: 'FORME', chemin: 'graine' }]],
      ['départ égal et table déclarée deux fois', (p) => { p.depart = 7; p.tables[1] = 1; }, [{ code: 'DERIVATION', chemin: 'depart', raison: 'departNonAnterieur' }]],
      ['départ égal et une personne manquante', (p) => { p.depart = 7; p.placement[0].sieges[0].pop(); }, [{ code: 'DERIVATION', chemin: 'depart', raison: 'departNonAnterieur' }]],
    ];
    assert.equal(cas.length, 17);
    for (const [libelle, modifier, attendu] of cas) {
      const p = derivee(modifier);
      assert.deepStrictEqual(fautes(p), attendu, libelle);
      // L'ordre des clés de l'objet reçu ne change rien.
      assert.deepStrictEqual(fautes(ordre(p, ['placement', 'toursFiges'])), attendu, `${libelle}, clés désordonnées`);
    }
    // Admises : un départ antérieur, avec ou sans tours figés, jusqu'à tous
    // les tours sauf un.
    for (const modifier of [(p) => { p.depart = 6; }, (p) => { p.depart = 1; p.toursFiges = [4]; }, (p) => { p.depart = 1; p.toursFiges = [1, 2, 4]; }]) {
      assert.deepStrictEqual(fautes(derivee(modifier)), []);
    }
    // Le retenu ne porte ni l'un ni l'autre : une clé inconnue de sa règle.
    assert.deepStrictEqual(fautes({ ...retenuDe(fichierParfait()), depart: 1 }), [{ code: 'FORME', chemin: 'depart' }]);
    assert.deepStrictEqual(fautes({ ...retenuDe(fichierParfait()), toursFiges: [1] }), [{ code: 'FORME', chemin: 'toursFiges' }]);
  });

  test('examiner écarte la seule dérivée fautive, nommée par son chemin, et garde la dérivée dont le départ est absent de la liste', () => {
    const charge = chargeAvecGeneration();
    const [p1, p2, p3] = charge.propositions;
    const copieDe = (p, id, champs) => ({ ...structuredClone(p), id, ...champs });
    const fautivesAttendues = [
      [copieDe(p2, 4, { depart: 4 }), { code: 'DERIVATION', chemin: 'depart', raison: 'departNonAnterieur' }],
      [copieDe(p2, 5, { depart: 6 }), { code: 'DERIVATION', chemin: 'depart', raison: 'departNonAnterieur' }],
      [copieDe(p2, 6, { depart: 1, toursFiges: [] }), { code: 'FORME', chemin: 'toursFiges' }],
      [copieDe(p2, 7, { depart: 1, toursFiges: [2, 1] }), { code: 'FORME', chemin: 'toursFiges' }],
      [copieDe(p2, 8, { depart: 1, toursFiges: [1.5] }), { code: 'FORME', chemin: 'toursFiges[0]' }],
      [copieDe(p2, 9, { depart: 1, toursFiges: [5] }), { code: 'DERIVATION', chemin: 'toursFiges[0]', raison: 'tourHorsSoiree' }],
      [copieDe(p2, 10, { depart: 1, toursFiges: [1, 2, 3, 4] }), { code: 'DERIVATION', chemin: 'toursFiges', raison: 'tousLesTours' }],
      [copieDe(p2, 11, { toursFiges: [1] }), { code: 'DERIVATION', chemin: 'toursFiges', raison: 'sansDepart' }],
    ];
    // La 12 part de la 1, tour 2 figé ; la 13 part de la 2, effacée de la
    // liste, sans tour figé : ni l'une ni l'autre n'est fautive.
    const gardees = [p1, p3, copieDe(p2, 12, { depart: 1, toursFiges: [2] }), copieDe(p3, 13, { depart: 2 })];
    charge.propositions = [p1, p3, ...fautivesAttendues.map(([p]) => p), ...gardees.slice(2)];
    charge.prochainsIds.proposition = 14;
    for (const lue of [charge, relire(charge)]) {
      const examen = examiner(lue);
      assert.deepStrictEqual(
        examen.fautives,
        fautivesAttendues.map(([p, faute], i) => ({ rang: i + 2, id: p.id, fautes: [faute] })),
      );
      assert.deepStrictEqual(examen.charge.propositions, gardees);
      assert.deepStrictEqual(examen.derives, []);
    }
  });

  test('ordreDesPropositions ne lit pas la dérivation : les propositions se rangent par identifiant, graine, arrêt et historique', () => {
    const charge = chargeAvecGeneration();
    const [p1, p2, p3] = charge.propositions;
    // Une dérivée reçue avant une ordinaire d'identifiant supérieur : un
    // rangement par départ placerait la 3 avant la 2.
    charge.propositions = [{ ...p2, depart: 1, toursFiges: [3] }, p3, p1];
    const lue = relire(charge);
    assert.deepStrictEqual(lue.propositions.map(({ id }) => id), [1, 2, 3]);
    assert.deepStrictEqual(lue.propositions.map(({ depart }) => depart), [undefined, 1, undefined]);
  });
});

// --- La présence par tour ---------------------------------------------------

// chargePetite où la personne 5 n'arrive qu'au tour 2 et la personne 12
// part après le tour 2.
function chargePresence() {
  const charge = chargePetite();
  charge.participants[4].presence = [2, 3, 4];
  charge.participants[11].presence = [1, 2];
  return charge;
}

// fichierParfait aligné à la main sur chargePresence : 5 absente au tour 1,
// sa chaise libre ; 12 absente aux tours 3 et 4.
function fichierAbsents() {
  const p = fichierParfait();
  p.placement[0] = { sieges: [[1, 2, 3], [4, 6], [7, 8, 9], [10, 11, 12]], reserve: [], absents: [5] };
  p.placement[2] = { sieges: [[4, 8, 10], [2, 7], [1, 6, 11], [3, 5, 9]], reserve: [], absents: [12] };
  p.placement[3] = { sieges: [[5, 7, 11], [1, 9, 10], [3, 4], [2, 6, 8]], reserve: [], absents: [12] };
  return p;
}

// fichierAbsents sous des sièges attribués : la chaise de 5 au tour 1, la
// deuxième de sa table, reste marquée null ; celles de 12, en fin de liste,
// ne s'écrivent pas.
function fichierAbsentsAttribues() {
  const p = fichierAbsents();
  p.siegesAttribues = true;
  p.placement[0].sieges[1] = [4, null, 6];
  return p;
}

// Une course de deux points de relevé sur le placement de p, chacun une copie.
const courseSur = (p, placement = p.placement) => ({
  evalues: 100,
  releves: [1, 10].map((mouvements) => ({ mouvements, placement: structuredClone(placement) })),
});

// Les objets et listes que porte valeur, elle comprise.
function objetsDe(valeur) {
  const objets = new Set();
  JSON.stringify(valeur, (_, enfant) => {
    if (typeof enfant === 'object' && enfant !== null) objets.add(enfant);
    return enfant;
  });
  return objets;
}

describe('la présence par tour : la troisième liste d’un tour, absents (§ 8.9, point 2)', () => {
  test('un placement qui porte ses absents est cohérent, sièges attribués ou non, proposition ou retenu', () => {
    assert.deepEqual(fautes(fichierAbsents()), []);
    assert.deepEqual(fautes(fichierAbsentsAttribues()), []);
    assert.deepEqual(fautes(retenuDe(fichierAbsents())), []);
    const desordre = fichierAbsents();
    desordre.placement[0] = { sieges: [[1, 2], [4], [7, 8, 9], [10, 11, 12]], reserve: [], absents: [6, 3, 5] };
    assert.deepEqual(fautes(desordre), []);
  });

  test('une personne déclarée absente à chaque tour n’est pas une faute', () => {
    const p = fichierAbsents();
    p.placement[0].sieges[3] = [10, 11];
    p.placement[0].absents = [5, 12];
    p.placement[1].sieges[0] = [6, 9];
    p.placement[1].absents = [12];
    assert.deepEqual(fautes(p), []);
  });

  test('corruption délibérée étendue : une absente aussi assise, aussi en réserve, inconnue ; une présente écrite nulle part, même quand le tour porte des absents', () => {
    const cas = [
      ['absente aussi assise', (p) => { p.placement[0].sieges[1] = [4, 5, 6]; }, [{ code: 'DOUBLON', tour: 1, participant: 5 }]],
      ['absente aussi en réserve', (p) => { p.placement[0].reserve = [5]; }, [{ code: 'DOUBLON', tour: 1, participant: 5 }]],
      ['absente inconnue', (p) => { p.placement[2].absents = [12, 13]; }, [{ code: 'INCONNU', tour: 3, participant: 13 }]],
      ['absente deux fois', (p) => { p.placement[2].absents = [12, 12]; }, [{ code: 'DOUBLON', tour: 3, participant: 12 }]],
      ['présente nulle part', (p) => { p.placement[2].sieges[0] = [8, 10]; }, [{ code: 'MANQUANT', tour: 3, participant: 4 }]],
      ['absente nulle part', (p) => { delete p.placement[0].absents; }, [{ code: 'MANQUANT', tour: 1, participant: 5 }]],
    ];
    for (const [libelle, abimer, attendues] of cas) {
      const p = fichierAbsents();
      abimer(p);
      assert.deepEqual(fautes(p), attendues, libelle);
    }
  });

  test('le chemin d’une occurrence lit absents après la réserve : le second exemplaire d’un doublon, le premier d’un inconnu', () => {
    const p = fichierAbsents();
    const releve = (abimer) => {
      const placement = structuredClone(p.placement);
      abimer(placement);
      return fauteDeCourse(p, courseSur(p, placement));
    };
    assert.equal(releve((pl) => { pl[0].reserve = [5]; }), 'course.releves[0].placement[0].absents[0]');
    assert.equal(releve((pl) => { pl[2].absents = [12, 13]; }), 'course.releves[0].placement[2].absents[1]');
    assert.equal(releve((pl) => { pl[2].absents = [12, 12]; }), 'course.releves[0].placement[2].absents[1]');
  });

  test('seule la proposition fautive est écartée ; la cohérente qui porte ses absents est gardée, sans dérive', () => {
    const charge = chargePresence();
    const abimee = { ...fichierAbsents(), id: 2 };
    abimee.placement[0].reserve = [5];
    charge.propositions = [fichierAbsents(), abimee];
    charge.prochainsIds.proposition = 3;
    charge.retenu = retenuDe(fichierAbsents());
    for (const lue of [charge, relire(charge)]) {
      const examen = examiner(lue);
      assert.deepEqual(examen.fautives, [{ rang: 1, id: 2, fautes: [{ code: 'DOUBLON', tour: 1, participant: 5 }] }]);
      assert.deepEqual(examen.charge.propositions, [fichierAbsents()]);
      assert.deepEqual(examen.derives, []);
      assert.deepEqual(examen.retenu, { fautes: [], raisons: [] });
    }
  });
});

describe('la présence par tour : mise en fichier, plan du moteur, course (§ 8.9, § 5.10)', () => {
  const OPTIONS = Object.freeze({ produitVersion: VERSION.affichee, attribuerSieges: false, decalage: 0 });

  test('versFichier tire absents de la configuration : le plan du moteur ne liste pas les absentes', () => {
    const configuration = configurationDepuisCharge(chargePresence());
    const plan = planDepuisFichier(fichierAbsents());
    assert.deepEqual(versFichier({ ...PARFAITE, plan }, configuration, OPTIONS), fichierAbsents());
  });

  test('un plan qui assied une absente, ou qui perd une présente, lève TypeError', () => {
    const configuration = configurationDepuisCharge(chargePresence());
    leveTypeError(() => versFichier(PARFAITE, configuration, OPTIONS), /versFichier : placement fautif .*DOUBLON/);
    const plan = planDepuisFichier(fichierAbsents());
    plan.tours[1][0] = [6, 9];
    leveTypeError(() => versFichier({ ...PARFAITE, plan }, configuration, OPTIONS), /MANQUANT/);
  });

  test('une exclue n’est ni déclarée, ni absente : sa présence est suspendue', () => {
    const charge = chargePresence();
    charge.participants[11].exclu = true;
    const plan = planDepuisFichier(fichierAbsents());
    plan.tours[0][3] = [10, 11];
    plan.tours[1][0] = [6, 9];
    const attendu = fichierAbsents();
    attendu.participants = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    attendu.placement[0].sieges[3] = [10, 11];
    attendu.placement[1].sieges[0] = [6, 9];
    delete attendu.placement[2].absents;
    delete attendu.placement[3].absents;
    assert.deepEqual(versFichier({ ...PARFAITE, plan }, configurationDepuisCharge(charge), OPTIONS), attendu);
  });

  test('planDepuisFichier ne porte jamais absents, et n’y liste aucune absente : ni à une table, ni en réserve', () => {
    const attendu = {
      tables: [1, 2, 3, 4],
      tours: [
        [[1, 2, 3], [4, 6], [7, 8, 9], [10, 11, 12]],
        [[6, 9, 12], [3, 8, 11], [2, 5, 10], [1, 4, 7]],
        [[4, 8, 10], [2, 7], [1, 6, 11], [3, 5, 9]],
        [[5, 7, 11], [1, 9, 10], [3, 4], [2, 6, 8]],
      ],
      reserves: [[], [], [], []],
    };
    for (const p of [fichierAbsents(), fichierAbsentsAttribues(), retenuDe(fichierAbsents())]) {
      const plan = planDepuisFichier(p);
      assert.deepEqual(plan, attendu);
      assert.deepEqual(Object.keys(plan), ['tables', 'tours', 'reserves']);
    }
  });

  test('fauteDeCourse : les absents de chaque relevé égalent ceux de la proposition, sinon la course s’ignore seule, au chemin de leur liste', () => {
    const p = fichierAbsents();
    assert.equal(fauteDeCourse(p, courseSur(p)), null);
    const releve = (abimer) => {
      const placement = structuredClone(p.placement);
      abimer(placement);
      return fauteDeCourse(p, courseSur(p, placement));
    };
    // Assise au relevé, absente à la proposition : le relevé est cohérent, la
    // course le contredit.
    assert.equal(releve((pl) => { pl[0] = { sieges: [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]], reserve: [] }; }), 'course.releves[0].placement[0].absents');
    assert.equal(releve((pl) => { pl[1].sieges[0] = [6, 9]; pl[1].absents = [12]; }), 'course.releves[0].placement[1].absents');
    assert.equal(releve((pl) => { pl[3] = { sieges: [[5, 7, 11], [1, 9, 10], [3, 4, 12], [2, 6, 8]], reserve: [] }; }), 'course.releves[0].placement[3].absents');
    // Autant d'absents, pas les mêmes : 7 et 12 échangent leur place, le
    // relevé reste cohérent.
    assert.equal(releve((pl) => { pl[2] = { sieges: [[4, 8, 10], [2, 12], [1, 6, 11], [3, 5, 9]], reserve: [], absents: [7] }; }), 'course.releves[0].placement[2].absents');
    // Le second relevé seul.
    const course = courseSur(p);
    course.releves[1].placement[2] = { sieges: [[4, 8, 10], [2, 7, 12], [1, 6, 11], [3, 5, 9]], reserve: [] };
    assert.equal(fauteDeCourse(p, course), 'course.releves[1].placement[2].absents');
  });

  test('courseVersFichier écrit à chaque relevé les absents de la proposition, et la course se relit en plans sans absents', () => {
    const plan = planDepuisFichier(fichierAbsents());
    const proposition = { ...PARFAITE, plan, evalues: 100, releves: [1, 10].map((mouvements) => ({ mouvements, plan })) };
    const fichier = versFichier(proposition, configurationDepuisCharge(chargePresence()), OPTIONS);
    const course = courseVersFichier(proposition, fichier, { attribuerSieges: false });
    assert.deepEqual(course.releves.map(({ placement }) => placement), [fichierAbsents().placement, fichierAbsents().placement]);
    assert.deepEqual(courseDepuisFichier(fichier, course).releves.map((r) => r.plan), [plan, plan]);
  });
});

describe('la présence par tour : la dérive PRESENCE_RETIREE et PRESENCE_AJOUTEE (§ 9)', () => {
  const avec = (modifier) => {
    const charge = chargePresence();
    modifier(charge);
    return charge;
  };
  const presenceDe = (charge, id, presence) => {
    const p = charge.participants.find((personne) => personne.id === id);
    if (presence === undefined) delete p.presence;
    else p.presence = presence;
  };

  test('un placement aligné sur la présence ne dérive pas, la présence écrite dans un autre ordre comprise', () => {
    assert.deepEqual(derive(fichierAbsents(), chargePresence()), []);
    assert.deepEqual(derive(fichierAbsents(), avec((c) => presenceDe(c, 5, [4, 3, 2]))), []);
    assert.deepEqual(derive(fichierParfait(), chargePetite()), []);
  });

  test('péremption délibérée étendue : changer une présence donne la seule raison PRESENCE_*, avec ses tours exacts, croissants', () => {
    assert.deepEqual(derive(fichierAbsents(), avec((c) => presenceDe(c, 12))), [
      { code: 'PRESENCE_AJOUTEE', participant: 12, tours: [3, 4] },
    ]);
    assert.deepEqual(derive(fichierAbsents(), avec((c) => presenceDe(c, 7, [1, 3]))), [
      { code: 'PRESENCE_RETIREE', participant: 7, tours: [2, 4] },
    ]);
    assert.deepEqual(derive(fichierParfait(), chargePresence()), [
      { code: 'PRESENCE_RETIREE', participant: 5, tours: [1] },
      { code: 'PRESENCE_RETIREE', participant: 12, tours: [3, 4] },
    ]);
  });

  test('les raisons se rangent par code, puis par participant, parmi les autres', () => {
    const charge = avec((c) => {
      presenceDe(c, 5);
      presenceDe(c, 12, [1]);
      presenceDe(c, 7, [1, 3, 4]);
      c.participants[2].exclu = true;
    });
    assert.deepEqual(derive(fichierAbsents(), charge), [
      { code: 'PARTICIPANT_EXCLU', participant: 3 },
      { code: 'PRESENCE_AJOUTEE', participant: 5, tours: [1] },
      { code: 'PRESENCE_RETIREE', participant: 7, tours: [2] },
      { code: 'PRESENCE_RETIREE', participant: 12, tours: [2] },
    ]);
  });

  test('une personne qui ajoute et retire des tours porte les deux raisons', () => {
    assert.deepEqual(derive(fichierAbsents(), avec((c) => presenceDe(c, 5, [1, 2]))), [
      { code: 'PRESENCE_AJOUTEE', participant: 5, tours: [1] },
      { code: 'PRESENCE_RETIREE', participant: 5, tours: [3, 4] },
    ]);
  });

  test('sous TOURS_CHANGES, seuls les tours communs se comparent', () => {
    const troisTours = (modifier) => avec((c) => {
      c.evenement.tours = 3;
      presenceDe(c, 5, [2, 3]);
      modifier(c);
    });
    assert.deepEqual(derive(fichierAbsents(), troisTours(() => {})), [{ code: 'TOURS_CHANGES', avant: 4, maintenant: 3 }]);
    assert.deepEqual(derive(fichierAbsents(), troisTours((c) => presenceDe(c, 12, [1]))), [
      { code: 'PRESENCE_RETIREE', participant: 12, tours: [2] },
      { code: 'TOURS_CHANGES', avant: 4, maintenant: 3 },
    ]);
    // Un placement plus court que la soirée ne se compare que sur ses tours.
    const court = { ...fichierAbsents(), tours: 3, placement: fichierAbsents().placement.slice(0, 3) };
    assert.deepEqual(derive(court, avec(() => {})), [{ code: 'TOURS_CHANGES', avant: 3, maintenant: 4 }]);
  });

  test('une exclue ou une supprimée n’a que sa raison d’avant, quelle que soit sa présence', () => {
    assert.deepEqual(derive(fichierAbsents(), avec((c) => { c.participants[11].exclu = true; presenceDe(c, 12); })), [
      { code: 'PARTICIPANT_EXCLU', participant: 12 },
    ]);
    assert.deepEqual(derive(fichierAbsents(), avec((c) => { c.participants = c.participants.filter(({ id }) => id !== 5); })), [
      { code: 'PARTICIPANT_SUPPRIME', participant: 5 },
    ]);
  });

  test('une proposition périmée par la présence est gardée, jamais écartée, et sa dérive se nomme', () => {
    const charge = avec((c) => presenceDe(c, 12));
    charge.propositions = [fichierAbsents()];
    charge.prochainsIds.proposition = 2;
    for (const lue of [charge, relire(charge)]) {
      const examen = examiner(lue);
      assert.deepEqual(examen.fautives, []);
      assert.deepEqual(examen.charge.propositions, [fichierAbsents()]);
      assert.deepEqual(examen.derives, [{ id: 1, raisons: [{ code: 'PRESENCE_AJOUTEE', participant: 12, tours: [3, 4] }] }]);
    }
  });
});

describe('les raisons de participants et celles qui bloquent un départ (§ 5.7)', () => {
  test('RAISONS_DE_PARTICIPANTS porte les cinq raisons des participants, et ne se modifie pas', () => {
    assert.deepEqual([...RAISONS_DE_PARTICIPANTS], [
      'PARTICIPANT_EXCLU',
      'PARTICIPANT_NON_PLACE',
      'PARTICIPANT_SUPPRIME',
      'PRESENCE_AJOUTEE',
      'PRESENCE_RETIREE',
    ]);
    assert.equal(RAISONS_DE_PARTICIPANTS.has('PRESENCE_RETIREE'), true);
    assert.equal(RAISONS_DE_PARTICIPANTS.has('TOURS_CHANGES'), false);
    assert.ok(Object.isFrozen(RAISONS_DE_PARTICIPANTS));
    assert.equal(RAISONS_DE_PARTICIPANTS.add, undefined);
    assert.equal(RAISONS_DE_PARTICIPANTS.delete, undefined);
  });

  test('raisonsQuiBloquentUnDepart : vide pour les seules raisons de participants, la sous-liste des autres dans l’ordre reçu sinon', () => {
    const participants = [
      { code: 'PARTICIPANT_EXCLU', participant: 3 },
      { code: 'PARTICIPANT_NON_PLACE', participant: 13 },
      { code: 'PARTICIPANT_SUPPRIME', participant: 4 },
      { code: 'PRESENCE_AJOUTEE', participant: 5, tours: [1] },
      { code: 'PRESENCE_RETIREE', participant: 12, tours: [3] },
    ];
    assert.deepEqual(raisonsQuiBloquentUnDepart(participants), []);
    assert.deepEqual(raisonsQuiBloquentUnDepart([]), []);
    const mobilier = [
      { code: 'TOURS_CHANGES', avant: 4, maintenant: 3 },
      { code: 'TABLE_SUPPRIMEE', table: 2 },
      { code: 'CAPACITE_CHANGEE', table: 1, avant: 3, maintenant: 2 },
      { code: 'TABLE_AJOUTEE', table: 5 },
    ];
    for (const raison of mobilier) {
      assert.deepEqual(raisonsQuiBloquentUnDepart([...participants, raison]), [raison], raison.code);
    }
    const melees = [participants[0], mobilier[1], participants[3], mobilier[0]];
    const rendues = raisonsQuiBloquentUnDepart(melees);
    assert.deepEqual(rendues, [mobilier[1], mobilier[0]]);
    assert.equal(rendues[0], mobilier[1]);
    assert.deepEqual(melees.length, 4);
  });
});

describe('ajusterALaPresence : le placement aligné sur la charge, sans rien d’autre (§ 5.8, § 8.9)', () => {
  const avec = (modifier, base = chargePresence) => {
    const charge = base();
    modifier(charge);
    return charge;
  };
  const presenceDe = (charge, id, presence) => {
    const p = charge.participants.find((personne) => personne.id === id);
    if (presence === undefined) delete p.presence;
    else p.presence = presence;
  };
  const VIDE = Object.freeze({ partis: [], arrives: [], retires: [] });
  const sansPlacement = ({ placement, ...reste }) => reste;

  // Exige que derive(rendu, charge) ne porte plus de raison des participants
  // pour un identifiant de ids (tous quand ids manque), et que rendu soit
  // cohérent.
  function exigerInvariant(rendu, charge, ids) {
    assert.deepEqual(fautes(rendu), []);
    const restantes = derive(rendu, charge).filter(
      ({ code, participant }) => RAISONS_DE_PARTICIPANTS.has(code) && (ids === undefined || ids.includes(participant)),
    );
    assert.deepEqual(restantes, []);
  }

  test('rien à ajuster : tout est vide, et le placement est égal à celui reçu', () => {
    for (const [p, charge] of [[fichierAbsents(), chargePresence()], [fichierParfait(), chargePetite()], [fichierAReserve(), chargePetite()]]) {
      const rendu = ajusterALaPresence(p, charge);
      assert.deepEqual(sansPlacement(rendu), VIDE);
      assert.deepEqual(rendu.placement, p);
    }
  });

  test('sans attribution, une partante quitte sa table, dont la liste reste triée, et va aux absents du tour, triés', () => {
    const charge = avec((c) => presenceDe(c, 7, [1, 3]));
    const rendu = ajusterALaPresence(fichierAbsents(), charge);
    const attendu = fichierAbsents();
    attendu.placement[1] = { sieges: [[6, 9, 12], [3, 8, 11], [2, 5, 10], [1, 4]], reserve: [], absents: [7] };
    attendu.placement[3] = { sieges: [[5, 11], [1, 9, 10], [3, 4], [2, 6, 8]], reserve: [], absents: [7, 12] };
    assert.deepEqual(rendu.placement, attendu);
    assert.deepEqual(sansPlacement(rendu), { partis: [{ participant: 7, tours: [2, 4] }], arrives: [], retires: [] });
    exigerInvariant(rendu.placement, charge);
  });

  test('sous des sièges attribués, la chaise libérée devient null et les null de fin de liste se retirent', () => {
    const charge = avec((c) => {
      presenceDe(c, 6, [2, 3, 4]);
      presenceDe(c, 1, [1, 2, 4]);
    });
    const rendu = ajusterALaPresence(fichierAbsentsAttribues(), charge);
    const attendu = fichierAbsentsAttribues();
    attendu.placement[0] = { sieges: [[1, 2, 3], [4], [7, 8, 9], [10, 11, 12]], reserve: [], absents: [5, 6] };
    attendu.placement[2] = { sieges: [[4, 8, 10], [2, 7], [null, 6, 11], [3, 5, 9]], reserve: [], absents: [1, 12] };
    assert.deepEqual(rendu.placement, attendu);
    assert.deepEqual(rendu.partis, [{ participant: 1, tours: [3] }, { participant: 6, tours: [1] }]);
    exigerInvariant(rendu.placement, charge);
  });

  test('une partante en réserve quitte la réserve', () => {
    const p = fichierAReserve();
    const charge = avec((c) => presenceDe(c, 6, [2, 3, 4]), chargePetite);
    const rendu = ajusterALaPresence(p, charge);
    assert.deepEqual(rendu.placement.placement[0], { sieges: [[1, 2], [4, 5], [7, 8, 9], [10, 11, 12]], reserve: [3], absents: [6] });
    assert.deepEqual(rendu.partis, [{ participant: 6, tours: [1] }]);
  });

  test('une arrivante entre dans la réserve du tour, triée, et quitte ses absents ; la clé absents part quand la liste se vide', () => {
    const p = fichierAbsents();
    p.placement[0] = { sieges: [[1, 2, 3], [4], [7, 8, 9], [10, 11, 12]], reserve: [6], absents: [5] };
    const charge = avec((c) => {
      presenceDe(c, 5);
      presenceDe(c, 12);
    });
    const rendu = ajusterALaPresence(p, charge);
    assert.deepEqual(rendu.placement.placement[0], { sieges: [[1, 2, 3], [4], [7, 8, 9], [10, 11, 12]], reserve: [5, 6] });
    assert.deepEqual(rendu.placement.placement[2], { sieges: [[4, 8, 10], [2, 7], [1, 6, 11], [3, 5, 9]], reserve: [12] });
    assert.deepEqual(Object.keys(rendu.placement.placement[3]), ['sieges', 'reserve']);
    assert.deepEqual(sansPlacement(rendu), { partis: [], arrives: [{ participant: 5, tours: [1] }, { participant: 12, tours: [3, 4] }], retires: [] });
    exigerInvariant(rendu.placement, charge);
  });

  test('une présente laissée en réserve, comme une réserve imposée d’une dérivée, y reste', () => {
    const p = fichierAbsents();
    p.placement[1] = { sieges: [[6, 9], [3, 8, 11], [2, 5, 10], [1, 4, 7]], reserve: [12] };
    const rendu = ajusterALaPresence(p, chargePresence());
    assert.deepEqual(rendu.placement, p);
    assert.deepEqual(sansPlacement(rendu), VIDE);
  });

  test('une exclue quitte chaque liste de chaque tour et la déclaration ; sous sièges attribués, sa chaise devient null', () => {
    const charge = avec((c) => { c.participants[3].exclu = true; presenceDe(c, 4, [1]); });
    const rendu = ajusterALaPresence(fichierAbsentsAttribues(), charge);
    const attendu = fichierAbsentsAttribues();
    attendu.participants = [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12];
    attendu.placement[0].sieges[1] = [null, null, 6];
    attendu.placement[1].sieges[3] = [1, null, 7];
    attendu.placement[2].sieges[0] = [null, 8, 10];
    attendu.placement[3].sieges[2] = [3];
    assert.deepEqual(rendu.placement, attendu);
    assert.deepEqual(sansPlacement(rendu), { partis: [], arrives: [], retires: [4] });
    exigerInvariant(rendu.placement, charge);
  });

  test('une supprimée quitte de même chaque liste, absents et réserve compris, et la déclaration', () => {
    const charge = avec((c) => { c.participants = c.participants.filter(({ id }) => id !== 12 && id !== 10); });
    const rendu = ajusterALaPresence(fichierAbsents(), charge);
    const attendu = fichierAbsents();
    attendu.participants = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11];
    attendu.placement[0].sieges[3] = [11];
    attendu.placement[1].sieges[0] = [6, 9];
    attendu.placement[1].sieges[2] = [2, 5];
    attendu.placement[2].sieges[0] = [4, 8];
    delete attendu.placement[2].absents;
    attendu.placement[3].sieges[1] = [1, 9];
    delete attendu.placement[3].absents;
    assert.deepEqual(rendu.placement, attendu);
    assert.deepEqual(sansPlacement(rendu), { partis: [], arrives: [], retires: [10, 12] });
    exigerInvariant(rendu.placement, charge);
  });

  test('une présente non déclarée est déclarée, en réserve à ses tours de présence, absente ailleurs ; une exclue non déclarée ne l’est pas', () => {
    const charge = avec((c) => {
      c.participants.push({ ...personne(13, ...TREIZIEME), presence: [2, 3] });
      c.participants.push(personne(14, 'Bourrache', 'Capucine'));
      c.participants.push({ ...personne(15, 'Fenouil', 'Dahlia'), exclu: true });
      c.prochainsIds.participant = 16;
    });
    const rendu = ajusterALaPresence(fichierAbsents(), charge);
    const attendu = fichierAbsents();
    attendu.participants = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
    attendu.placement[0].reserve = [14];
    attendu.placement[0].absents = [5, 13];
    attendu.placement[1].reserve = [13, 14];
    attendu.placement[2].reserve = [13, 14];
    attendu.placement[3].reserve = [14];
    attendu.placement[3].absents = [12, 13];
    assert.deepEqual(rendu.placement, attendu);
    assert.deepEqual(sansPlacement(rendu), {
      partis: [],
      arrives: [{ participant: 13, tours: [2, 3] }, { participant: 14, tours: [1, 2, 3, 4] }],
      retires: [],
    });
    exigerInvariant(rendu.placement, charge);
  });

  test('une exclue réintégrée revient dans la déclaration à son rang, avant des identifiants déjà déclarés ; réserve et absents la reçoivent triés', () => {
    const exclue = avec((c) => { c.participants[2].exclu = true; });
    const sans3 = ajusterALaPresence(fichierAbsents(), exclue).placement;
    assert.deepEqual(sans3.participants, [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const charge = avec((c) => presenceDe(c, 3, [1, 2, 4]));
    const rendu = ajusterALaPresence(sans3, charge);
    assert.deepEqual(rendu.placement.participants, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    assert.deepEqual(rendu.placement.placement.map(({ reserve }) => reserve), [[3], [3], [], [3]]);
    assert.deepEqual(rendu.placement.placement.map(({ absents }) => absents), [[5], undefined, [3, 12], [12]]);
    assert.deepEqual(sansPlacement(rendu), { partis: [], arrives: [{ participant: 3, tours: [1, 2, 4] }], retires: [] });
    exigerInvariant(rendu.placement, charge);
  });

  test('ids restreint l’ajustement : une autre personne en dérive y reste ; un identifiant que ni la charge ni le placement ne portent est ignoré', () => {
    const charge = avec((c) => {
      presenceDe(c, 7, [1, 3, 4]);
      presenceDe(c, 9, [2, 3, 4]);
      c.participants[2].exclu = true;
    });
    const rendu = ajusterALaPresence(fichierAbsents(), charge, [7, 99]);
    assert.deepEqual(sansPlacement(rendu), { partis: [{ participant: 7, tours: [2] }], arrives: [], retires: [] });
    exigerInvariant(rendu.placement, charge, [7, 99]);
    assert.deepEqual(derive(rendu.placement, charge), [
      { code: 'PARTICIPANT_EXCLU', participant: 3 },
      { code: 'PRESENCE_RETIREE', participant: 9, tours: [1] },
    ]);
    assert.deepEqual(sansPlacement(ajusterALaPresence(fichierAbsents(), charge, [])), VIDE);
    assert.deepEqual(ajusterALaPresence(fichierAbsents(), charge, new Set([3])).retires, [3]);
  });

  test('les tables, les tours au-delà des tours de l’événement et l’horodatage ne sont pas touchés', () => {
    const charge = avec((c) => {
      c.evenement.tours = 3;
      presenceDe(c, 5, [2, 3]);
      presenceDe(c, 12, [1]);
      c.tables = c.tables.filter(({ id }) => id !== 4);
    });
    const p = { ...fichierAbsents(), horodatage: '2031-05-17T08:05:00-04:00' };
    const rendu = ajusterALaPresence(p, charge);
    const attendu = structuredClone(p);
    attendu.placement[1] = { sieges: [[6, 9], [3, 8, 11], [2, 5, 10], [1, 4, 7]], reserve: [], absents: [12] };
    assert.deepEqual(rendu.placement, attendu);
    assert.deepEqual(rendu.partis, [{ participant: 12, tours: [2] }]);
  });

  test('une arrivante non déclarée entre dans la réserve des tours de l’événement, et aux absents d’un tour au-delà', () => {
    const charge = avec((c) => {
      c.evenement.tours = 3;
      c.participants.push(personne(13, ...TREIZIEME));
    });
    const rendu = ajusterALaPresence(fichierAbsents(), charge);
    for (const rang of [0, 1, 2]) assert.ok(rendu.placement.placement[rang].reserve.includes(13), `tour ${rang + 1}`);
    assert.ok(rendu.placement.placement[3].absents.includes(13));
    assert.ok(!rendu.placement.placement[3].reserve.includes(13));
    assert.deepEqual(rendu.arrives, [{ participant: 13, tours: [1, 2, 3] }]);
    assert.deepEqual(fautes(rendu.placement), []);
  });

  test('idempotente : ajuster deux fois rend le même placement, et le second ajustement ne rend rien', () => {
    const charges = [
      avec((c) => presenceDe(c, 7, [1, 3])),
      avec((c) => { presenceDe(c, 5); c.participants[3].exclu = true; c.participants.push(personne(13, ...TREIZIEME)); }),
    ];
    for (const charge of charges) {
      for (const p of [fichierAbsents(), fichierAbsentsAttribues()]) {
        const une = ajusterALaPresence(p, charge);
        const deux = ajusterALaPresence(une.placement, charge);
        assert.deepEqual(deux.placement, une.placement);
        assert.deepEqual(sansPlacement(deux), VIDE);
        exigerInvariant(une.placement, charge);
      }
    }
  });

  test('le retenu s’ajuste comme une proposition, et garde sa clé proposition', () => {
    const charge = avec((c) => presenceDe(c, 12));
    const rendu = ajusterALaPresence(retenuDe(fichierAbsents()), charge);
    assert.equal(rendu.placement.proposition, 1);
    assert.deepEqual(rendu.arrives, [{ participant: 12, tours: [3, 4] }]);
    exigerInvariant(rendu.placement, charge);
  });

  test('ne modifie ni le placement ni la charge reçus, et ne partage rien avec eux', () => {
    const p = geler(fichierAbsentsAttribues());
    const charge = geler(avec((c) => { presenceDe(c, 7, [1, 3]); c.participants[3].exclu = true; }));
    for (const rendu of [ajusterALaPresence(p, charge), ajusterALaPresence(p, chargePresence())]) {
      const recus = new Set([...objetsDe(p), ...objetsDe(charge)]);
      for (const objet of objetsDe(rendu)) assert.ok(!recus.has(objet));
    }
  });

  test('un placement fautif lève TypeError', () => {
    const p = fichierAbsents();
    p.placement[0].reserve = [5];
    leveTypeError(() => ajusterALaPresence(p, chargePresence()), /^ajusterALaPresence : placement fautif /);
  });
});

describe('formeNommee : une ligne par absente, après la réserve de son tour', () => {
  test('une absente a sa ligne, absent vrai, sans table, numéro ni siège, et hors de la réserve ; les autres lignes ont absent faux', () => {
    const p = fichierAbsentsAttribues();
    p.placement[0] = { sieges: [[1, 2, 3], [4], [7, 8, 9], [10, 11, 12]], reserve: [6], absents: [5] };
    const lignes = formeNommee(p, chargePresence());
    const tour1 = lignes.filter(({ tour }) => tour === 1);
    assert.deepEqual(tour1.slice(-2), [
      ligne(1, null, null, null, 6, 'Fougère', 'Firmin'),
      ligne(1, null, null, null, 5, 'Églantine', 'Edmée', false, true),
    ]);
    assert.deepEqual(lignes.filter(({ absent }) => absent), [
      ligne(1, null, null, null, 5, 'Églantine', 'Edmée', false, true),
      ligne(3, null, null, null, 12, 'Mélisse', 'Mathurin', false, true),
      ligne(4, null, null, null, 12, 'Mélisse', 'Mathurin', false, true),
    ]);
    assert.equal(lignes.length, 4 * 12);
    assert.ok(lignes.every(({ absent }) => typeof absent === 'boolean'));
  });
});
