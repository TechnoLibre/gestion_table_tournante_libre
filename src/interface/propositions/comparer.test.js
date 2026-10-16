// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du geste « Comparer » d'une ligne du tableau des propositions
// (§ 12, C14, D56, D58, D85) : il se juge sur la source de la page de
// qualité (sourceQualite), jamais sur la seule proposition demandée au plan.
// Quand cette source n'existe pas, vaut déjà la ligne, ou lui est identique
// — un retenu non ajusté et sa proposition d'origine —, la ligne devient la
// source et le second placement prend son défaut ; sinon, rien ne change au
// plan et la ligne devient le second placement. Le retenu se montre par
// null, jamais par 'retenu'. Les charges sont générées par le moteur, la
// faute d'un placement forgée ; les noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { appliquerCommande } from '../../application/commandes.js';
import { candidatsDeComparaison, evaluer } from '../../application/evaluation.js';
import { rechercher } from '../../moteur/recherche.js';
import { configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { VERSION } from '../../version.genere.js';
import { sourceQualite } from '../qualite/source.js';
import { gesteComparer } from './comparer.js';

const V1 = VERSION.affichee;

// Six personnes inventées, deux tables de trois places, deux tours, trois
// propositions générées, sans retenu.
function chargeGeneree() {
  const charge = creerCharge({ id: 'evt-comparer', nom: 'Atelier Ressac', siegesParDefaut: 3, tours: 2 });
  const noms = [
    ['Ombrelle', 'Iris'],
    ['Pervenche', 'Théo'],
    ['Lacasse', 'Ondine'],
    ['Tourteau', 'Basile'],
    ['Quenouille', 'Maëlle'],
    ['Varech', 'Sidonie'],
  ];
  charge.participants = noms.map(([nom, prenom], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    appartenance: rang < 3 ? 'Coopérative Aubier' : 'Atelier Ressac',
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  charge.tables = [1, 2].map((id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 300 * id, y: 0 } }));
  charge.prochainsIds = { participant: 7, table: 3, proposition: 1 };
  const configuration = configurationDepuisCharge(charge);
  const propositions = rechercher(configuration, { graine: 5, arret: 40, nombre: 3 });
  return appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: V1 }).charge;
}

// La charge où deux propositions de plus sont générées sur sa configuration
// du moment.
function generee(charge) {
  const configuration = configurationDepuisCharge(charge);
  const propositions = rechercher(configuration, { graine: 7, arret: 40, nombre: 2 });
  return appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: V1 }).charge;
}

// Les identifiants des propositions qu'apres porte et qu'avant ne porte pas,
// croissants.
function nouvellesDe(avant, apres) {
  const anciennes = new Set(avant.propositions.map(({ id }) => id));
  return apres.propositions.map(({ id }) => id).filter((id) => !anciennes.has(id));
}

// Le même participant assis deux fois au premier tour du placement : un
// placement fautif, qu'aucune génération ne produit.
function rendreFautif(placement) {
  const [premiere, seconde] = placement.placement[0].sieges;
  seconde[0] = premiere[0];
}

// Gèle en profondeur : un geste qui modifierait sa charge lèverait.
function figer(valeur) {
  if (valeur !== null && typeof valeur === 'object' && !Object.isFrozen(valeur)) {
    Object.freeze(valeur);
    for (const element of Object.values(valeur)) figer(element);
  }
  return valeur;
}

// La charge dont le retenu est tiré de la proposition id ; ajusté : les
// premières personnes des deux tables échangées au premier tour, les listes
// gardées croissantes.
function avecRetenu(charge, id, { ajuste = false } = {}) {
  const copie = structuredClone(charge);
  const { siegesAttribues, tables, capacites, tours, participants, placement } = structuredClone(copie.propositions.find((p) => p.id === id));
  copie.retenu = { proposition: id, siegesAttribues, tables, capacites, tours, participants, placement };
  if (ajuste) {
    const [premiere, seconde] = copie.retenu.placement[0].sieges;
    [premiere[0], seconde[0]] = [seconde[0], premiere[0]];
    for (const liste of [premiere, seconde]) liste.sort((x, y) => x - y);
  }
  copie.evenement.etat = 'retenu';
  return copie;
}

// Le geste sur la ligne cible, la page de qualité jugée comme elle le
// serait sous la proposition demandée au plan.
function geste(charge, demandee, cible) {
  const figee = figer(charge);
  const source = sourceQualite(figee, { demandee });
  return gesteComparer(figee, evaluer(figee), { source, cible });
}

describe('gesteComparer : la ligne devient le second placement, ou la source (§ 12, C14, D56, D58)', () => {
  test('aucune source — sans retenu, rien de montré — : la ligne devient la source, le second placement son défaut', () => {
    const charge = chargeGeneree();
    const [, deux] = charge.propositions.map(({ id }) => id);
    assert.equal(sourceQualite(charge, { demandee: null }).cas, 'aucuneMontree');
    assert.deepEqual(geste(charge, null, deux), { montrer: deux, comparee: null });
  });

  test('une autre proposition montrée : rien ne change au plan, la ligne devient le second placement', () => {
    const charge = chargeGeneree();
    const [un, deux, trois] = charge.propositions.map(({ id }) => id);
    assert.deepEqual(geste(charge, un, deux), { montrer: undefined, comparee: deux });
    assert.deepEqual(geste(charge, trois, un), { montrer: undefined, comparee: un });
  });

  test('la ligne de la proposition déjà montrée : elle reste la source, le second placement son défaut', () => {
    const charge = chargeGeneree();
    const [, deux] = charge.propositions.map(({ id }) => id);
    assert.deepEqual(geste(charge, deux, deux), { montrer: deux, comparee: null });
  });

  test('retenu ajusté montré, rien de demandé au plan : « Comparer » sur sa proposition d’origine garde le retenu en A et la met en B', () => {
    const charge = avecRetenu(chargeGeneree(), 2, { ajuste: true });
    assert.equal(sourceQualite(charge, { demandee: null }).id, 'retenu');
    assert.deepEqual(geste(charge, null, 2), { montrer: undefined, comparee: 2 });
    assert.deepEqual(geste(charge, null, 3), { montrer: undefined, comparee: 3 });
  });

  test('retenu non ajusté montré : sa proposition d’origine lui est identique, et devient la source ; une autre ligne devient le second placement', () => {
    const charge = avecRetenu(chargeGeneree(), 2);
    assert.equal(sourceQualite(charge, { demandee: null }).id, 'retenu');
    assert.deepEqual(geste(charge, null, 2), { montrer: 2, comparee: null });
    assert.deepEqual(geste(charge, null, 1), { montrer: undefined, comparee: 1 });
  });

  test('la ligne du retenu : montrer vaut null ou undefined, jamais « retenu »', () => {
    const generees = chargeGeneree();
    const nonAjuste = avecRetenu(generees, 2);
    const ajuste = avecRetenu(generees, 2, { ajuste: true });
    // Une autre proposition montrée : le retenu devient le second placement.
    assert.deepEqual(geste(nonAjuste, 1, 'retenu'), { montrer: undefined, comparee: 'retenu' });
    assert.deepEqual(geste(ajuste, 2, 'retenu'), { montrer: undefined, comparee: 'retenu' });
    // Le retenu déjà source, ou sa proposition d'origine identique montrée :
    // il devient la source, montré par null.
    assert.deepEqual(geste(nonAjuste, null, 'retenu'), { montrer: null, comparee: null });
    assert.deepEqual(geste(ajuste, null, 'retenu'), { montrer: null, comparee: null });
    assert.deepEqual(geste(nonAjuste, 2, 'retenu'), { montrer: null, comparee: null });
    for (const charge of [nonAjuste, ajuste]) {
      for (const demandee of [null, 1, 2, 3]) assert.notEqual(geste(charge, demandee, 'retenu').montrer, 'retenu', String(demandee));
    }
  });

  test('une source en dérive ne se compare pas : la ligne devient la source', () => {
    const generees = chargeGeneree();
    const enDerive = appliquerCommande('exclureParticipant', avecRetenu(generees, 3), { id: 6 }).charge;
    const source = sourceQualite(enDerive, { demandee: null });
    assert.equal(source.cas, 'derive');
    assert.deepEqual(geste(enDerive, null, 1), { montrer: 1, comparee: null });
  });

  test('un retenu en dérive, des propositions comparables générées après lui : la ligne devient la source, jamais le second placement du retenu', () => {
    const exclue = appliquerCommande('exclureParticipant', avecRetenu(chargeGeneree(), 3), { id: 6 }).charge;
    const charge = generee(exclue);
    const nouvelles = nouvellesDe(exclue, charge);
    assert.equal(nouvelles.length, 2);
    const source = sourceQualite(charge, { demandee: null });
    assert.deepEqual([source.cas, source.id], ['derive', 'retenu']);
    // Le retenu a des candidats : seul son statut l'écarte comme source.
    assert.ok(candidatsDeComparaison(charge, evaluer(charge), 'retenu').candidats.length > 0);
    for (const nouvelle of nouvelles) assert.deepEqual(geste(charge, null, nouvelle), { montrer: nouvelle, comparee: null }, String(nouvelle));
  });

  test('une proposition en dérive demandée sous un retenu comparable : la ligne devient la source, le retenu compris', () => {
    const exclue = appliquerCommande('exclureParticipant', chargeGeneree(), { id: 6 }).charge;
    const generes = generee(exclue);
    const nouvelles = nouvellesDe(exclue, generes);
    assert.equal(nouvelles.length, 2);
    const [premiere, seconde] = nouvelles;
    assert.ok(Number.isInteger(seconde));
    const charge = avecRetenu(generes, premiere, { ajuste: true });
    assert.equal(sourceQualite(charge, { demandee: null }).cas, 'mesurable');
    for (const demandee of [1, 2, 3]) {
      const source = sourceQualite(charge, { demandee });
      assert.deepEqual([source.cas, source.id], ['derive', demandee], String(demandee));
      assert.ok(candidatsDeComparaison(charge, evaluer(charge), demandee).candidats.length > 0, String(demandee));
      assert.deepEqual(geste(charge, demandee, seconde), { montrer: seconde, comparee: null }, String(demandee));
      assert.deepEqual(geste(charge, demandee, 'retenu'), { montrer: null, comparee: null }, String(demandee));
    }
  });

  test('une source fautive ne se compare pas : la ligne devient la source', () => {
    const generees = chargeGeneree();
    const [fautive, deux, trois] = generees.propositions.map(({ id }) => id);
    const propositionFautive = structuredClone(generees);
    rendreFautif(propositionFautive.propositions[0]);
    const retenuFautif = avecRetenu(generees, 2);
    rendreFautif(retenuFautif.retenu);
    const cas = [
      [propositionFautive, fautive, fautive],
      [retenuFautif, null, 'retenu'],
    ];
    for (const [charge, demandee, id] of cas) {
      const source = sourceQualite(charge, { demandee });
      assert.deepEqual([source.cas, source.id], ['fautif', id], String(id));
      // La source a des candidats : seul son statut l'écarte.
      assert.ok(candidatsDeComparaison(charge, evaluer(charge), id).candidats.length > 0, String(id));
    }
    for (const autre of [deux, trois]) {
      assert.equal(evaluer(propositionFautive).propositions.find(({ id }) => id === autre).statut, 'comparable');
      assert.deepEqual(geste(propositionFautive, fautive, autre), { montrer: autre, comparee: null }, String(autre));
    }
    assert.deepEqual(geste(retenuFautif, null, trois), { montrer: trois, comparee: null });
  });

  test('le geste ne modifie ni la charge, ni la table, ni la source', () => {
    const charge = figer(avecRetenu(chargeGeneree(), 2, { ajuste: true }));
    const table = evaluer(charge);
    const source = sourceQualite(charge, { demandee: 1 });
    const avant = JSON.stringify([charge, source]);
    gesteComparer(charge, table, { source, cible: 3 });
    gesteComparer(charge, table, { source, cible: 'retenu' });
    assert.equal(JSON.stringify([charge, source]), avant);
  });
});
