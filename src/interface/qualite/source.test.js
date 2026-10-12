// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de la source de la page de qualité (§ 12, B9, D25) : la page
// mesure un placement entier — la proposition demandée, sinon le retenu —, et
// quatre cas sans recouvrement se partagent l'absence d'une source mesurable
// — ni proposition ni retenu, des propositions dont aucune n'est montrée, une
// source en dérive ou fautive, une configuration qui ne se normalise pas, qui
// l'emporte. L'état des places du plan (etatPlaces), sollicité à part, dit ce
// que la barre de vue nomme ; la ligne d'évaluation est celle d'evaluer. Les
// noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { appliquerCommande } from '../../application/commandes.js';
import { diagnostiquerCharge } from '../../application/diagnostic.js';
import { evaluer, premiereDuClassement } from '../../application/evaluation.js';
import { etatPlaces } from '../../application/places.js';
import { rechercher } from '../../moteur/recherche.js';
import { configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { VERSION } from '../../version.genere.js';
import { CAS_QUALITE, sourceQualite } from './source.js';

const V1 = VERSION.affichee;

// Six personnes inventées, deux appartenances, deux tables de trois places,
// deux tours, sans proposition ni retenu.
function chargeSix() {
  const charge = creerCharge({ id: 'evt-qualite', nom: 'Atelier Ressac', siegesParDefaut: 3, tours: 2 });
  const noms = [
    ['Ombrelle', 'Iris', 'Coopérative Aubier'],
    ['Pervenche', 'Théo', 'Coopérative Aubier'],
    ['Lacasse', 'Ondine', 'Atelier Ressac'],
    ['Tourteau', 'Basile', 'Atelier Ressac'],
    ['Quenouille', 'Maëlle', null],
    ['Varech', 'Sidonie', null],
  ];
  charge.participants = noms.map(([nom, prenom, appartenance], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    appartenance,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  charge.tables = [1, 2].map((id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 300 * id, y: 0 } }));
  charge.prochainsIds = { participant: 7, table: 3, proposition: 1 };
  return charge;
}

// La charge, une génération de plus, enregistrée par la commande.
function generee(charge, reglages = { graine: 3, arret: 40, nombre: 3 }) {
  const configuration = configurationDepuisCharge(charge);
  const propositions = rechercher(configuration, reglages);
  return appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: V1 }).charge;
}

const executer = (charge, nom, args) => appliquerCommande(nom, charge, args).charge;

// Une copie de la charge, modifiée en place par change.
function avec(charge, change) {
  const copie = structuredClone(charge);
  change(copie);
  return copie;
}

// Le même placement assis deux fois au premier tour : un placement fautif.
function rendreFautif(placement) {
  const [premiere, seconde] = placement.placement[0].sieges;
  seconde[0] = premiere[0];
}

// Iris réservée à la table 1 pour toute la soirée, et à la table 2 au
// premier tour : la configuration ne se normalise pas.
function enConflit(charge) {
  charge.reservations.push(
    { participant: 1, table: 1, siege: null, portee: 'tous', tour: null },
    { participant: 1, table: 2, siege: null, portee: 'tour', tour: 1 },
  );
}

// La source que le plan montre à ce tour, lue dans l'état des places, et le
// libellé de sa barre de vue.
const sourceDuPlan = (charge, demandee, tour = 1) => {
  const { source, proposition, refus } = etatPlaces(charge, { tour, proposition: demandee });
  return { source, proposition, refus: refus?.code ?? null };
};

// Les clés et les détails des raisons d'une ligne d'évaluation, comme le
// tableau des propositions les écrit.
const raisonsDe = (ligne) => ligne.raisons.map((raison) => ({ cle: raison.code, details: raison, participant: raison.participant ?? null }));

describe('la source de la page de qualité (§ 12, B9, D25)', () => {
  test('les cas, dans l’ordre où la page les éprouve', () => {
    assert.deepEqual(CAS_QUALITE, ['configuration', 'aucunPlacement', 'aucuneMontree', 'derive', 'fautif', 'mesurable']);
    assert.ok(Object.isFrozen(CAS_QUALITE));
  });

  test('ni proposition ni retenu : aucun placement, la barre dit les réservations, rien à mesurer', () => {
    const charge = chargeSix();
    const source = sourceQualite(charge);
    assert.deepEqual(sourceDuPlan(charge, null), { source: 'reservations', proposition: null, refus: null });
    assert.equal(source.cas, 'aucunPlacement');
    assert.deepEqual(source.libelle, { cle: 'plan.source.reservations', details: {} });
    assert.equal(source.revenir, null);
    assert.equal(source.id, null);
    assert.equal(source.ligne, null);
    assert.equal(source.premiere, null);
    assert.deepEqual(source.raisons, []);
    assert.equal(source.refus, null);
  });

  test('des propositions, aucune montrée : la commande montre la première comparable du classement, celle de premiereDuClassement', () => {
    const charge = generee(chargeSix());
    const premiere = premiereDuClassement(evaluer(charge));
    assert.notEqual(premiere, null);
    const source = sourceQualite(charge);
    assert.equal(source.cas, 'aucuneMontree');
    assert.equal(source.premiere, premiere.id);
    assert.deepEqual(source.libelle, { cle: 'plan.source.reservations', details: {} });
    assert.equal(source.id, null);
    assert.equal(source.ligne, null);
  });

  test('des propositions dont la première par identifiant est fautive : la commande vise une proposition comparable, jamais elle', () => {
    const charge = avec(generee(chargeSix()), (c) => rendreFautif(c.propositions[0]));
    const [fautive] = charge.propositions;
    const source = sourceQualite(charge);
    assert.equal(source.cas, 'aucuneMontree');
    assert.notEqual(source.premiere, fautive.id);
    const ligne = evaluer(charge).propositions.find(({ id }) => id === source.premiere);
    assert.equal(ligne.statut, 'comparable');
  });

  test('des propositions toutes en dérive : aucune montrée, et aucune commande, aucune ne se comparant', () => {
    const charge = avec(generee(chargeSix()), (c) => (c.participants[5].exclu = true));
    assert.equal(premiereDuClassement(evaluer(charge)), null);
    const source = sourceQualite(charge);
    assert.equal(source.cas, 'aucuneMontree');
    assert.equal(source.premiere, null);
  });

  test('une proposition montrée qui se compare : la page la mesure, sous sa ligne d’évaluation, et la barre la nomme', () => {
    const charge = generee(chargeSix());
    const table = evaluer(charge);
    for (const ligne of table.propositions) {
      const source = sourceQualite(charge, { demandee: ligne.id });
      assert.deepEqual(sourceDuPlan(charge, ligne.id), { source: 'proposition', proposition: ligne.id, refus: null });
      assert.equal(source.cas, 'mesurable', String(ligne.id));
      assert.equal(source.id, ligne.id);
      assert.deepEqual(source.ligne, ligne);
      assert.deepEqual(source.libelle, { cle: 'plan.source.propositionReservations', details: { proposition: ligne.id } });
      assert.equal(source.revenir, 'plan.source.revenirReservations');
    }
  });

  test('le retenu, sans proposition demandée : la page mesure le retenu ; une proposition demandée passe devant lui, en vue seule', () => {
    const generees = generee(chargeSix());
    const [, deuxieme] = generees.propositions;
    const charge = executer(generees, 'retenirProposition', { id: deuxieme.id });
    const table = evaluer(charge);
    const retenu = sourceQualite(charge);
    assert.deepEqual(sourceDuPlan(charge, null), { source: 'retenu', proposition: null, refus: null });
    assert.equal(retenu.cas, 'mesurable');
    assert.equal(retenu.id, 'retenu');
    assert.deepEqual(retenu.ligne, table.retenu);
    assert.deepEqual(retenu.libelle, { cle: 'plan.source.retenu', details: {} });
    assert.equal(retenu.revenir, null);
    const autre = charge.propositions.find(({ id }) => id !== deuxieme.id);
    const montree = sourceQualite(charge, { demandee: autre.id });
    assert.equal(montree.cas, 'mesurable');
    assert.equal(montree.id, autre.id);
    assert.deepEqual(montree.libelle, { cle: 'plan.source.propositionVueSeule', details: { proposition: autre.id } });
    assert.equal(montree.revenir, 'plan.source.revenirRetenu');
  });

  test('une source qui disparaît : la page suit le plan, qui revient au retenu, ou aux réservations ; la commande de retour reste offerte', () => {
    const generees = generee(chargeSix());
    const disparue = generees.propositions[0].id;
    const sansElle = avec(generees, (c) => c.propositions.shift());
    assert.deepEqual(sourceDuPlan(sansElle, disparue), { source: 'reservations', proposition: null, refus: null });
    const aucune = sourceQualite(sansElle, { demandee: disparue });
    assert.equal(aucune.cas, 'aucuneMontree');
    assert.equal(aucune.revenir, 'plan.source.revenirReservations');
    // Une génération qui remplace la liste sous un retenu : le retenu revient.
    const retenue = executer(generees, 'retenirProposition', { id: generees.propositions[1].id });
    const remplacee = avec(retenue, (c) => c.propositions.splice(0, 1));
    const suivie = sourceQualite(remplacee, { demandee: disparue });
    assert.equal(suivie.cas, 'mesurable');
    assert.equal(suivie.id, 'retenu');
    assert.deepEqual(suivie.libelle, { cle: 'plan.source.retenu', details: {} });
    assert.equal(suivie.revenir, 'plan.source.revenirRetenu');
  });

  test('une proposition montrée en dérive : ses raisons, celles de la ligne d’évaluation ; rien à mesurer', () => {
    const generees = generee(chargeSix());
    const id = generees.propositions[0].id;
    const charge = avec(generees, (c) => (c.participants[5].exclu = true));
    const ligne = evaluer(charge).propositions.find((candidate) => candidate.id === id);
    assert.equal(ligne.statut, 'derive');
    assert.deepEqual(sourceDuPlan(charge, id), { source: 'proposition', proposition: id, refus: null });
    const source = sourceQualite(charge, { demandee: id });
    assert.equal(source.cas, 'derive');
    assert.equal(source.id, id);
    assert.equal(source.ligne, null);
    assert.ok(source.raisons.length > 0);
    assert.deepEqual(source.raisons, raisonsDe(ligne));
  });

  test('un retenu fautif : la barre dit que le retenu ne se lit pas, la page donne ses fautes', () => {
    const generees = generee(chargeSix());
    const charge = avec(executer(generees, 'retenirProposition', { id: generees.propositions[0].id }), (c) => rendreFautif(c.retenu));
    const ligne = evaluer(charge).retenu;
    assert.equal(ligne.statut, 'fautif');
    assert.deepEqual(sourceDuPlan(charge, null), { source: 'reservations', proposition: null, refus: 'RETENU_FAUTIF' });
    const source = sourceQualite(charge);
    assert.equal(source.cas, 'fautif');
    assert.equal(source.id, 'retenu');
    assert.deepEqual(source.libelle, { cle: 'plan.source.retenuFautif', details: {} });
    assert.ok(source.raisons.length > 0);
    assert.deepEqual(source.raisons, raisonsDe(ligne));
  });

  test('une proposition fautive demandée : la page la mesure quand même, donne ses fautes, et sa ligne de source dit que le plan ne la montre pas', () => {
    const generees = generee(chargeSix());
    const id = generees.propositions[0].id;
    const sansRetenu = avec(generees, (c) => rendreFautif(c.propositions[0]));
    const ligne = evaluer(sansRetenu).propositions.find((candidate) => candidate.id === id);
    assert.equal(ligne.statut, 'fautif');
    assert.deepEqual(sourceDuPlan(sansRetenu, id), { source: 'reservations', proposition: null, refus: null });
    const seule = sourceQualite(sansRetenu, { demandee: id });
    assert.equal(seule.cas, 'fautif');
    assert.equal(seule.id, id);
    assert.equal(seule.ligne, null);
    assert.ok(seule.raisons.length > 0);
    assert.deepEqual(seule.raisons, raisonsDe(ligne));
    assert.deepEqual(seule.libelle, { cle: 'qualite.source.propositionFautive', details: { proposition: id } });
    assert.equal(seule.revenir, 'plan.source.revenirReservations');
    // Sous un retenu qui se lit, la proposition fautive demandée reste la
    // source de la page : le retenu ne passe pas devant elle.
    const retenue = avec(executer(generees, 'retenirProposition', { id: generees.propositions[1].id }), (c) => rendreFautif(c.propositions[0]));
    assert.deepEqual(sourceDuPlan(retenue, id), { source: 'retenu', proposition: null, refus: null });
    const source = sourceQualite(retenue, { demandee: id });
    assert.equal(source.cas, 'fautif');
    assert.equal(source.id, id);
    assert.deepEqual(source.raisons, raisonsDe(evaluer(retenue).propositions.find((candidate) => candidate.id === id)));
    assert.deepEqual(source.libelle, { cle: 'qualite.source.propositionFautive', details: { proposition: id } });
    assert.equal(source.revenir, 'plan.source.revenirRetenu');
  });

  test('une configuration qui ne se normalise pas l’emporte : sans placement, avec des propositions, avec un retenu, le refus de la génération', () => {
    const generees = generee(chargeSix());
    const retenue = executer(generees, 'retenirProposition', { id: generees.propositions[0].id });
    const cas = [chargeSix(), generees, retenue].map((charge) => avec(charge, enConflit));
    for (const charge of cas) {
      const { erreur } = diagnostiquerCharge(charge);
      assert.notEqual(erreur, null);
      const source = sourceQualite(charge, { demandee: charge.propositions[0]?.id ?? null });
      assert.equal(source.cas, 'configuration');
      assert.equal(source.refus.code, erreur.code);
      assert.deepEqual(source.refus.details, erreur.details);
      assert.equal(source.ligne, null);
      assert.equal(source.premiere, null);
    }
    // Sans table d'évaluation, un placement fautif se reconnaît à ses
    // fautes : la ligne de source garde le libellé que la barre lui donne.
    const retenuFautif = avec(retenue, (c) => {
      rendreFautif(c.retenu);
      enConflit(c);
    });
    assert.deepEqual(sourceDuPlan(retenuFautif, null), { source: 'reservations', proposition: null, refus: 'RETENU_FAUTIF' });
    const surRetenu = sourceQualite(retenuFautif);
    assert.equal(surRetenu.cas, 'configuration');
    assert.deepEqual(surRetenu.libelle, { cle: 'plan.source.retenuFautif', details: {} });
    const id = generees.propositions[0].id;
    const propositionFautive = avec(generees, (c) => {
      rendreFautif(c.propositions[0]);
      enConflit(c);
    });
    const surProposition = sourceQualite(propositionFautive, { demandee: id });
    assert.equal(surProposition.cas, 'configuration');
    assert.deepEqual(surProposition.libelle, { cle: 'qualite.source.propositionFautive', details: { proposition: id } });
  });

  test('le placement entier : un tour ajouté à l’événement met la proposition montrée et le retenu en dérive, au tour que le plan montre comme à tout autre', () => {
    const generees = generee(chargeSix());
    const id = generees.propositions[0].id;
    // L'événement passe à trois tours : la proposition n'en porte que deux,
    // et le plan revient aux réservations au troisième ; la page, elle,
    // mesure la proposition entière, et la dit en dérive.
    const courte = executer(generees, 'changerTours', { tours: 3 });
    assert.deepEqual(sourceDuPlan(courte, id, 1), { source: 'proposition', proposition: id, refus: null });
    assert.deepEqual(sourceDuPlan(courte, id, 3), { source: 'reservations', proposition: null, refus: null });
    const ligne = evaluer(courte).propositions.find((candidate) => candidate.id === id);
    assert.equal(ligne.statut, 'derive');
    const source = sourceQualite(courte, { demandee: id });
    assert.deepEqual([source.cas, source.id], ['derive', id]);
    assert.deepEqual(source.raisons, raisonsDe(ligne));
    assert.deepEqual(source.libelle, { cle: 'plan.source.propositionReservations', details: { proposition: id } });
    // Le retenu, sans proposition demandée : en dérive lui aussi, ses
    // raisons, que le plan le montre au premier tour et non au dernier.
    const retenu = executer(executer(generees, 'retenirProposition', { id }), 'changerTours', { tours: 3 });
    assert.equal(evaluer(retenu).retenu.statut, 'derive');
    assert.deepEqual(sourceDuPlan(retenu, null, 3), { source: 'reservations', proposition: null, refus: null });
    assert.deepEqual(sourceDuPlan(retenu, null, 1), { source: 'retenu', proposition: null, refus: null });
    const deRetenu = sourceQualite(retenu);
    assert.deepEqual([deRetenu.cas, deRetenu.id], ['derive', 'retenu']);
    assert.deepEqual(deRetenu.raisons, raisonsDe(evaluer(retenu).retenu));
    assert.deepEqual(deRetenu.libelle, { cle: 'plan.source.retenu', details: {} });
  });

  test('la charge n’est pas modifiée, et deux lectures de la même charge rendent la même source', () => {
    const charge = generee(chargeSix());
    const avant = structuredClone(charge);
    const id = charge.propositions[1].id;
    assert.deepEqual(sourceQualite(charge, { demandee: id }), sourceQualite(charge, { demandee: id }));
    assert.deepEqual(charge, avant);
  });
});
