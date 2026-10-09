// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

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
import { derive, examiner, fautes, formeNommee, planDepuisFichier, versFichier } from './placements.js';

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
// réserve, sauf quand enReserve dit le contraire.
const ligne = (tour, idTable, numero, siege, participant, nom, prenom, enReserve = idTable === null) => ({
  tour,
  table: idTable,
  numero,
  siege,
  participant,
  nom,
  prenom,
  reserve: enReserve,
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
