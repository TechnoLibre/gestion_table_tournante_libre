// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de la génération (§ 2.1, § 5.7, § 5.8, § 5.9, § 5.10, § 8.2,
// § 8.3, § 8.4, § 8.6, § 8.9, § 14.12, § 15.4) : le contrôleur sur une
// séance montée sur le système de fichiers d'épreuve, l'horloge pilotée et,
// sauf mention, l'exécuteur direct ; un exécuteur que l'épreuve résout à la
// main tient une génération ouverte. Les démonstrations livrées fournissent
// les configurations ; les personnes ajoutées portent des noms inventés, et
// la version vient du module engendré.
import assert from 'node:assert/strict';
import { creerFichiersSimules } from '../../test/fichiers_simules.js';
import { describe, test } from '../../test/lanceur.js';
import { texteLivre } from '../demo/livrees.js';
import { normaliser } from '../moteur/configuration.js';
import { ErreurAnnulee as ErreurAnnuleeDuMoteur, ErreurConfiguration } from '../moteur/erreurs.js';
import { rechercher, regenerer } from '../moteur/recherche.js';
import { verifierInvariants } from '../moteur/verification.js';
import { serialiser } from '../stockage/canonique.js';
import { creer as creerDansLeDepot } from '../stockage/depot.js';
import { FORMAT, analyser, configurationDepuisCharge, creerCharge } from '../stockage/document.js';
import { lireJournal } from '../stockage/journal.js';
import { SUFFIXES } from '../stockage/noms.js';
import { derive, planDepuisFichier, versFichier } from '../stockage/placements.js';
import { VERSION } from '../version.genere.js';
import { ErreurCommande } from './erreurs.js';
import {
  ErreurAnnulee,
  ErreurGeneration,
  PLAFOND_USAGE_S,
  SEUIL_GENERATION_LONGUE_S,
  creerControleurGeneration,
  creerExecuteurDirect,
  versErreurGeneration,
} from './generation.js';
import { creerHorlogePilotee } from './horloge.js';
import { libelle } from './libelles.js';
import { INACTIVITE_MS, creerSeance } from './seance.js';

const V1 = VERSION.affichee;
const DOC = { id: 'documents', chemin: 'C:\\Users\\Exemple\\Documents\\Gestion table tournante Libre' };
const NOM = 'Soirée des Merles';
const AUTRE = 'Soirée des Pervenches';
const MAX_GRAINE = 2 ** 32 - 1;

const VERS_PARTICIPANTS = { geste: 'ouvrirSection', section: 'participants' };
const VERS_TABLES = { geste: 'ouvrirSection', section: 'tables' };

// --- Les charges d'épreuve ----------------------------------------------------

// La charge d'une démonstration livrée, renommée : sa base devient nom.
function chargeDemo(cle, nom = NOM) {
  const { charge } = analyser(texteLivre(cle));
  charge.evenement.nom = nom;
  charge.evenement.id = `evt-${cle}-${nom.length}`;
  return charge;
}

const PRENOMS = ['Iris', 'Théo', 'Ondine', 'Anouk', 'Basile', 'Capucine', 'Gaspard', 'Hortense'];
const NOMS = ['Ombrelle', 'Pervenche', 'Lacasse', 'Grisaille', 'Bruyère', 'Sarcelle', 'Mélèze', 'Quenouille'];

// Une charge de n personnes, dont les exclus, et des tables de sieges places.
function chargeDe({ n = 0, exclus = [], tables = 0, sieges = 3, tours = 2, nom = NOM } = {}) {
  const charge = creerCharge({ id: `evt-${nom.length}-${n}`, nom, siegesParDefaut: sieges, tours });
  charge.participants = Array.from({ length: n }, (_, rang) => ({
    id: rang + 1,
    nom: `${NOMS[rang % NOMS.length]}${rang >= NOMS.length ? ` ${rang}` : ''}`,
    prenom: PRENOMS[rang % PRENOMS.length],
    appartenance: rang % 2 === 0 ? 'Club des Merles' : 'Grisaille',
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: exclus.includes(rang + 1),
  }));
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

// --- Les exécuteurs d'épreuve ---------------------------------------------------

// Un exécuteur qui note chaque lancement avant de le confier à interne.
function espionner(interne = creerExecuteurDirect()) {
  const lancements = [];
  return {
    lancements,
    lancer(configuration, reglages) {
      lancements.push({ configuration, reglages });
      return interne.lancer(configuration, reglages);
    },
  };
}

// Un exécuteur que l'épreuve résout à la main : chaque exécution porte
// resoudre, rejeter, avancer, et compte ses annulations. Annulée, elle
// rejette ErreurAnnulee, comme le travailleur qu'on termine ; differer
// vrai, elle ne fait que compter, et l'épreuve rejette quand elle veut,
// comme l'exécuteur direct qui n'arrête qu'à la lecture suivante du signal.
function executeurManuel({ differer = false } = {}) {
  const executions = [];
  return {
    executions,
    lancer(configuration, reglages) {
      const abonnes = new Set();
      let resoudre;
      let rejeter;
      const resultat = new Promise((ok, ko) => {
        resoudre = ok;
        rejeter = ko;
      });
      const execution = {
        configuration,
        reglages,
        annulations: 0,
        resultat,
        resoudre,
        rejeter,
        // Les propositions du moteur pour ce lancement, rendues telles quelles.
        resoudreParLeMoteur: () => resoudre(rechercher(configuration, reglages)),
        avancer: (fait, total) => {
          for (const fn of [...abonnes]) fn(fait, total);
        },
        surAvancement(fn) {
          abonnes.add(fn);
          return () => abonnes.delete(fn);
        },
        annuler() {
          execution.annulations += 1;
          if (!differer) rejeter(new ErreurAnnulee());
        },
      };
      executions.push(execution);
      return execution;
    },
  };
}

// Un exécuteur qui calcule par le moteur, puis transforme la liste rendue.
function executeurTransforme(transformer) {
  const direct = creerExecuteurDirect();
  return {
    lancer(configuration, reglages) {
      const execution = direct.lancer(configuration, reglages);
      return { ...execution, resultat: execution.resultat.then((propositions) => transformer(propositions, configuration)) };
    },
  };
}

// --- Le montage ---------------------------------------------------------------

async function deposer(fs, charge) {
  await creerDansLeDepot(fs, DOC, charge, {
    libelle: libelle('ENTREE_CREATION', { nom: charge.evenement.nom }),
    nomJalon: libelle('JALON_CREATION'),
    horodatage: '2031-05-17T07:00:00-04:00',
    produitVersion: V1,
  });
}

// Une séance sur les charges données, la première ouverte — en écriture
// sauf ecriture faux — et un contrôleur sur un exécuteur espionné.
async function monter({ charges, executeur = creerExecuteurDirect(), ecriture = true, fs = creerFichiersSimules(), disque = true } = {}) {
  fs.deposerDossier('documents');
  if (disque) for (const charge of charges) await deposer(fs, charge);
  const horloge = creerHorlogePilotee();
  let tirage = 0;
  const seance = creerSeance({
    fs,
    racine: DOC,
    horloge,
    identifiant: () => {
      tirage += 1;
      return `seance-${tirage}`;
    },
    produitVersion: V1,
    planifier: horloge.planifier,
    annuler: horloge.annuler,
  });
  const espion = espionner(executeur);
  const controleur = creerControleurGeneration({ seance, executeur: espion, horloge, produitVersion: V1 });
  const base = charges[0].evenement.nom;
  await seance.ouvrir(base);
  if (ecriture) await seance.passerEnEcriture();
  const journal = () => lireJournal(fs.contenu('documents', `${base}${SUFFIXES.journal}`));
  const etatDisque = () => fs.contenu('documents', `${base}${SUFFIXES.etat}`);
  return { fs, seance, horloge, controleur, espion, journal, etatDisque, charge: () => seance.etat().charge };
}

// Le refus attendu d'une promesse : une ErreurGeneration de ce code, aux
// détails donnés, dont le texte se compose.
async function refuse(promesse, code, details) {
  let leve = null;
  try {
    await promesse;
  } catch (erreur) {
    leve = erreur;
  }
  assert.ok(leve instanceof ErreurGeneration, `ErreurGeneration ${code} attendue, reçu ${leve}`);
  assert.equal(leve.code, code, leve.message);
  if (details !== undefined) assert.deepEqual(leve.details, details);
  assert.equal(typeof libelle(leve.code, leve.details), 'string');
  return leve;
}

// La promesse rejette, et rend ce qu'elle lève.
async function rejet(promesse) {
  try {
    await promesse;
  } catch (erreur) {
    return erreur;
  }
  assert.fail('rejet attendu');
  return null;
}

// Le plan d'une proposition du moteur, rangé comme planDepuisFichier le
// rend : la même mise en forme que celle d'une proposition enregistrée.
const planRange = (proposition, configuration) =>
  planDepuisFichier(versFichier(proposition, configuration, { produitVersion: V1, attribuerSieges: false, decalage: 0 }));

const ids = (charge) => charge.propositions.map(({ id }) => id);
const COURT = { graine: 1, nombre: 1, arret: 50, historique: 1000 };

// --- valider (§ 5.7) ------------------------------------------------------------

describe('génération : la saisie des réglages (§ 5.7)', () => {
  test('une graine négative, décimale ou en lettres refuse NON_ENTIER sur son champ', async () => {
    const { controleur } = await monter({ charges: [chargeDemo('petite')] });
    for (const saisie of ['-1', '\u{2212}1', '1,5', 'x', '']) {
      const { reglages, refus } = controleur.valider({ graine: saisie, nombre: '5', arret: '200000', historique: '1000' });
      assert.equal(reglages, null, saisie);
      assert.deepEqual(refus, [{ champ: 'graine', code: 'NON_ENTIER', details: { saisie, remede: null } }], saisie);
      assert.ok(libelle(refus[0].code, refus[0].details).length > 0);
    }
  });

  test('une graine de 2^32 sort du domaine ; 0 et 2^32 - 1 sont admises', async () => {
    const { controleur } = await monter({ charges: [chargeDemo('petite')] });
    const hors = controleur.valider({ graine: '4294967296', nombre: '5', arret: '200000', historique: '1000' });
    assert.deepEqual(hors.refus, [{ champ: 'graine', code: 'HORS_DOMAINE', details: { min: 0, max: MAX_GRAINE, remede: null } }]);
    assert.match(libelle('HORS_DOMAINE', hors.refus[0].details), /4\u{202F}294\u{202F}967\u{202F}295/u);
    for (const graine of ['0', '4294967295', ' 17 ']) {
      const { reglages, refus } = controleur.valider({ graine, nombre: '5', arret: '200000', historique: '1000' });
      assert.deepEqual(refus, [], graine);
      assert.deepEqual(reglages, { graine: Number(graine), nombre: 5, arret: 200000, historique: 1000 });
    }
  });

  test('nombre, arrêt et historique valent au moins 1 ; chaque refus se pose sur son champ, dans leur ordre', async () => {
    const { controleur } = await monter({ charges: [chargeDemo('petite')] });
    const { reglages, refus } = controleur.valider({ graine: 'x', nombre: '0', arret: '0', historique: '0' });
    assert.equal(reglages, null);
    const unAuMoins = { min: 1, max: null, remede: null };
    assert.deepEqual(refus, [
      { champ: 'graine', code: 'NON_ENTIER', details: { saisie: 'x', remede: null } },
      { champ: 'nombre', code: 'HORS_DOMAINE', details: unAuMoins },
      { champ: 'arret', code: 'HORS_DOMAINE', details: unAuMoins },
      { champ: 'historique', code: 'HORS_DOMAINE', details: unAuMoins },
    ]);
    assert.doesNotMatch(libelle('HORS_DOMAINE', unAuMoins), /null|undefined/);
  });

  test("un historique non saisi vaut celui de la charge : 1 000 sur une charge neuve, 500 après modifierReglage ; les réglages proposés la reprennent", async () => {
    const montage = await monter({ charges: [chargeDe({ n: 4, tables: 2, sieges: 2, tours: 2 })] });
    const { controleur, seance } = montage;
    for (const historique of [undefined, null, '', '  ']) {
      assert.equal(controleur.valider({ graine: '3', nombre: '2', arret: '40', historique }).reglages.historique, 1000);
    }
    assert.deepEqual(controleur.reglagesProposes(), { graine: 1, nombre: 5, arret: 200000, historique: 1000 });
    await seance.executer('modifierReglage', { cle: 'generation.historique', valeur: 500 });
    await seance.executer('modifierReglage', { cle: 'generation.nombre', valeur: 3 });
    await seance.executer('modifierReglage', { cle: 'generation.arret', valeur: 777 });
    assert.equal(controleur.valider({ graine: '3', nombre: '2', arret: '40' }).reglages.historique, 500);
    assert.deepEqual(controleur.reglagesProposes(), { graine: 1, nombre: 3, arret: 777, historique: 500 });
  });
});

// --- La graine proposée (§ 5.7) -------------------------------------------------

describe("génération : l'exécuteur direct refuse un réglage comme le travailleur", () => {
  test('un réglage hors de son domaine rejette REGLAGE_HORS_DOMAINE, qui le nomme, sans le message du moteur', async () => {
    const { charge } = analyser(texteLivre('petite'));
    const configuration = configurationDepuisCharge(charge);
    const { resultat } = creerExecuteurDirect().lancer(configuration, { graine: 2 ** 32, nombre: 1, arret: 10 });
    await refuse(resultat, 'REGLAGE_HORS_DOMAINE', { reglage: 'graine', remede: null });
  });
});

describe('génération : la graine proposée (§ 5.7)', () => {
  test("1 à l'ouverture, la dernière graine lancée plus un, 1 à l'ouverture d'un autre événement, 0 après 2^32 - 1", async () => {
    const montage = await monter({ charges: [chargeDemo('petite'), chargeDemo('petite', AUTRE)] });
    const { controleur, seance } = montage;
    assert.equal(controleur.grainePropose(), 1);
    await controleur.generer({ ...COURT, graine: 7 });
    assert.equal(controleur.grainePropose(), 8);
    assert.equal(controleur.reglagesProposes().graine, 8);
    await seance.ouvrir(AUTRE);
    assert.equal(controleur.grainePropose(), 1);
    await seance.passerEnEcriture();
    await controleur.generer({ ...COURT, graine: MAX_GRAINE });
    assert.equal(controleur.grainePropose(), 0);
    await seance.fermer();
    await seance.ouvrir(AUTRE);
    assert.equal(controleur.grainePropose(), 1);
  });
});

// --- Les refus d'avant lancement (§ 2.1, § 5.9, § 8.4, § 8.6, § 15.4) ----------

// Le refus attendu de generer, sans écriture ni lancement.
async function refuseSansRien(montage, code, details, reglages = COURT) {
  const avant = montage.fs.compteurs.ecritures;
  const leve = await refuse(montage.controleur.generer(reglages), code, details);
  assert.equal(montage.fs.compteurs.ecritures, avant, `${code} : une écriture`);
  assert.equal(montage.espion.lancements.length, 0, `${code} : lancé`);
  return leve;
}

describe("génération : les refus d'avant lancement (§ 2.1, § 5.9, § 8.4, § 8.6, § 15.4)", () => {
  test("un fichier d'un format plus récent refuse LECTURE_SEULE {raison: 'FORMAT'}", async () => {
    const fs = creerFichiersSimules();
    fs.deposerDossier('documents');
    const texte = serialiser(chargeDemo('petite'), { revision: 1, produitVersion: V1 });
    fs.deposer('documents', `${NOM}${SUFFIXES.etat}`, texte.replace(`"format":${FORMAT}`, `"format":${FORMAT + 1}`));
    const montage = await monter({ charges: [chargeDemo('petite')], fs, disque: false, ecriture: false });
    await refuseSansRien(montage, 'LECTURE_SEULE', { raison: 'FORMAT', remede: null });
  });

  test("un plan bloqué refuse LECTURE_SEULE {raison: 'BLOQUE'}, jamais MODE_LECTURE", async () => {
    const charge = chargeDemo('petite');
    charge.evenement.etat = 'bloque';
    const montage = await monter({ charges: [charge], ecriture: false });
    await refuseSansRien(montage, 'LECTURE_SEULE', { raison: 'BLOQUE', remede: { geste: 'debloquer' } });
  });

  test('en lecture, MODE_LECTURE ; sans événement, AUCUN_EVENEMENT', async () => {
    const montage = await monter({ charges: [chargeDemo('petite')], ecriture: false });
    await refuseSansRien(montage, 'MODE_LECTURE', { remede: { geste: 'modifier' } });
    await montage.seance.fermer();
    await refuseSansRien(montage, 'AUCUN_EVENEMENT', { remede: null });
  });

  test('un support rompu refuse SUPPORT_ROMPU, remède compris', async () => {
    const montage = await monter({ charges: [chargeDemo('petite')] });
    montage.fs.pannes.ecriture('documents');
    await assert.rejects(montage.seance.executer('ajouterParticipant', { champs: { nom: 'Ombrelle', prenom: 'Iris' } }));
    assert.notEqual(montage.seance.etat().supportRompu, null);
    const leve = await refuseSansRien(montage, 'SUPPORT_ROMPU');
    assert.deepEqual(leve.details, montage.seance.etat().refus.details);
    assert.equal(leve.details.remede.geste, 'ecrireAilleurs');
  });

  test('zéro participant non exclu, AUCUN_PARTICIPANT ; zéro table, AUCUNE_TABLE ; chacun nomme sa section', async () => {
    const sansPersonne = await monter({ charges: [chargeDe({ n: 3, exclus: [1, 2, 3], tables: 2 })] });
    await refuseSansRien(sansPersonne, 'AUCUN_PARTICIPANT', { remede: VERS_PARTICIPANTS });
    const sansTable = await monter({ charges: [chargeDe({ n: 3, tables: 0 })] });
    await refuseSansRien(sansTable, 'AUCUNE_TABLE', { remede: VERS_TABLES });
    // Le moteur accepte N = 0 et rend des plans vides : le refus est celui du contrôleur.
    const vide = configurationDepuisCharge(chargeDe({ n: 3, exclus: [1, 2, 3], tables: 2 }));
    assert.deepEqual(rechercher(vide, COURT)[0].plan.tours, [[[], []], [[], []]]);
  });

  test('treize personnes pour quatre tables de 3 : PLACES_MANQUANTES {placesManquantes: 1}, vers les tables', async () => {
    const montage = await monter({ charges: [chargeDe({ n: 13, tables: 4, sieges: 3 })] });
    await refuseSansRien(montage, 'PLACES_MANQUANTES', { placesManquantes: 1, remede: VERS_TABLES });
  });

  test('une configuration que normaliser refuse rend son code et ses détails', async () => {
    const charge = chargeDe({ n: 4, tables: 2, sieges: 2 });
    charge.reservations = [1, 2, 3].map((participant) => ({ participant, table: 1, siege: null, portee: 'tous', tour: null }));
    const montage = await monter({ charges: [charge] });
    let attendu = null;
    try {
      normaliser(configurationDepuisCharge(charge));
    } catch (erreur) {
      attendu = erreur;
    }
    assert.ok(attendu instanceof ErreurConfiguration);
    await refuseSansRien(montage, attendu.code, { ...attendu.details, remede: null });
  });

  test("plusieurs causes à la fois : le refus rendu est le premier dans l'ordre du contrat", async () => {
    // Un plan bloqué sans aucune table : la séance d'abord.
    const bloque = chargeDe({ n: 3, tables: 0 });
    bloque.evenement.etat = 'bloque';
    await refuseSansRien(await monter({ charges: [bloque], ecriture: false }), 'LECTURE_SEULE', {
      raison: 'BLOQUE',
      remede: { geste: 'debloquer' },
    });
    // En lecture, avec des places manquantes : la séance d'abord.
    const lecture = await monter({ charges: [chargeDe({ n: 13, tables: 4, sieges: 3 })], ecriture: false });
    await refuseSansRien(lecture, 'MODE_LECTURE', { remede: { geste: 'modifier' } });
    // Personne à placer et aucune table : les participants d'abord.
    const vide = await monter({ charges: [chargeDe({ n: 3, exclus: [1, 2, 3], tables: 0 })] });
    await refuseSansRien(vide, 'AUCUN_PARTICIPANT', { remede: VERS_PARTICIPANTS });
    // Une réservation de trop et des places manquantes : normaliser d'abord.
    const surreservee = chargeDe({ n: 13, tables: 4, sieges: 3 });
    surreservee.reservations = [1, 2, 3, 4].map((participant) => ({ participant, table: 1, siege: null, portee: 'tous', tour: null }));
    const leve = await refuseSansRien(await monter({ charges: [surreservee] }), 'SURRESERVATION');
    assert.equal(leve.details.remede, null);
    // Des places manquantes et une génération longue non confirmée : le manque d'abord.
    const longue = { graine: 1, nombre: 5, arret: 2000001, historique: 1000 };
    await refuseSansRien(await monter({ charges: [chargeDe({ n: 13, tables: 4, sieges: 3 })] }), 'PLACES_MANQUANTES', {
      placesManquantes: 1,
      remede: VERS_TABLES,
    }, longue);
  });

  test('une génération en cours passe avant les refus de la charge, après ceux de la séance', async () => {
    const manuel = executeurManuel({ differer: true });
    const montage = await monter({ charges: [chargeDe({ n: 3, tables: 2, sieges: 2 })], executeur: manuel });
    const premiere = montage.controleur.generer(COURT);
    await Promise.resolve();
    for (const id of [1, 2, 3]) await montage.seance.executer('exclureParticipant', { id });
    await refuse(montage.controleur.generer(COURT), 'GENERATION_EN_COURS', { remede: null });
    // Fermée, la séance annule ; tant que l'exécution n'a pas rendu, l'absence d'événement l'emporte.
    await montage.seance.fermer();
    assert.equal(manuel.executions[0].annulations, 1);
    await refuse(montage.controleur.generer(COURT), 'AUCUN_EVENEMENT', { remede: null });
    assert.equal(montage.espion.lancements.length, 1);
    manuel.executions[0].rejeter(new ErreurAnnulee());
    assert.ok((await rejet(premiere)) instanceof ErreurAnnulee);
  });

  test('un réglage hors de son domaine refuse REGLAGE_HORS_DOMAINE, qui le nomme, avant tout autre refus', async () => {
    const montage = await monter({ charges: [chargeDemo('petite')] });
    const cas = [
      [{ ...COURT, graine: 2 ** 32 }, 'graine', /Graine/],
      [{ ...COURT, arret: 1.5 }, 'arret', /Mouvements par proposition/],
      [{ ...COURT, historique: 0 }, 'historique', /Historique d'acceptation/],
      [{ ...COURT, nombre: 0 }, 'nombre', /Propositions par génération/],
    ];
    for (const [reglages, reglage, nom] of cas) {
      const leve = await refuseSansRien(montage, 'REGLAGE_HORS_DOMAINE', { reglage, remede: null }, reglages);
      assert.match(libelle(leve.code, leve.details), nom);
    }
    assert.equal(montage.controleur.grainePropose(), 1);
    // Un historique absent vaut celui de rechercher : la génération part.
    const { graine, nombre, arret } = COURT;
    assert.deepEqual((await montage.controleur.generer({ graine, nombre, arret })).ajoutees, [1]);
    // En lecture, le réglage d'abord.
    const lecture = await monter({ charges: [chargeDemo('petite')], ecriture: false });
    await refuseSansRien(lecture, 'REGLAGE_HORS_DOMAINE', { reglage: 'nombre', remede: null }, { ...COURT, nombre: 0 });
  });

  test('une génération en cours sur un plan passé en lecture : MODE_LECTURE, la séance avant GENERATION_EN_COURS', async () => {
    const manuel = executeurManuel({ differer: true });
    const montage = await monter({ charges: [chargeDemo('petite')], executeur: manuel });
    const premiere = montage.controleur.generer(COURT);
    await Promise.resolve();
    await montage.seance.passerEnLecture();
    assert.equal(manuel.executions[0].annulations, 1);
    await refuse(montage.controleur.generer(COURT), 'MODE_LECTURE', { remede: { geste: 'modifier' } });
    assert.equal(montage.espion.lancements.length, 1);
    manuel.executions[0].rejeter(new ErreurAnnulee());
    assert.ok((await rejet(premiere)) instanceof ErreurAnnulee);
  });

  test('une seconde génération pendant la première refuse GENERATION_EN_COURS', async () => {
    const manuel = executeurManuel();
    const montage = await monter({ charges: [chargeDemo('petite')], executeur: manuel });
    const premiere = montage.controleur.generer(COURT);
    await Promise.resolve();
    assert.equal(montage.espion.lancements.length, 1);
    await refuse(montage.controleur.generer(COURT), 'GENERATION_EN_COURS', { remede: null });
    assert.equal(montage.espion.lancements.length, 1);
    manuel.executions[0].resoudreParLeMoteur();
    await premiere;
  });
});

// --- Un compte, jamais une durée (§ 5.10, § 14.7) ----------------------------------

describe('génération : un compte, jamais une durée (§ 5.10, § 14.7)', () => {
  for (const pas of [1, 1000]) {
    test(`l'horloge avancée de ${pas} ms à chaque avancement ne change aucun plan`, async () => {
      const montage = await monter({ charges: [chargeDemo('petite-conflit')] });
      const reglages = { graine: 11, nombre: 2, arret: 5000, historique: 1000 };
      let avancements = 0;
      let dernier = 0;
      montage.controleur.subscribe(({ fait }) => {
        if (fait > dernier) {
          avancements += 1;
          dernier = fait;
          montage.horloge.avancer(pas);
        }
      });
      const bilan = await montage.controleur.generer(reglages);
      assert.equal(avancements, 10);
      assert.deepEqual(bilan.ajoutees, [1, 2]);
      assert.equal(bilan.dureeMs, 10 * pas);
      const configuration = configurationDepuisCharge(montage.charge());
      const attendues = rechercher(configuration, reglages);
      assert.equal(attendues.length, 2);
      montage.charge().propositions.forEach((proposition, rang) => {
        assert.deepEqual(planDepuisFichier(proposition), planRange(attendues[rang], configuration));
        const { graine, arret, historique } = attendues[rang];
        assert.deepEqual([proposition.graine, proposition.arret, proposition.historique], [graine, arret, historique]);
      });
    });
  }
});

// --- Les identifiants (§ 5.7, § 8.9, § 19.4) ------------------------------------------

describe('génération : les identifiants (§ 5.7, § 8.9)', () => {
  const PREMIERE = { graine: 1, nombre: 3, arret: 200, historique: 1000 };
  const SECONDE = { graine: 2, nombre: 2, arret: 200, historique: 1000 };

  test("les générations s'accumulent sous des identifiants qui suivent le compteur", async () => {
    const montage = await monter({ charges: [chargeDemo('petite-conflit')] });
    const premiere = await montage.controleur.generer(PREMIERE);
    assert.deepEqual([premiere.ajoutees, premiere.identiques], [[1, 2, 3], 0]);
    assert.equal(montage.charge().prochainsIds.proposition, 4);
    const avant = structuredClone(montage.charge().propositions);
    const seconde = await montage.controleur.generer(SECONDE);
    assert.deepEqual(seconde.ajoutees, [4, 5]);
    assert.deepEqual(montage.charge().propositions.slice(0, 3), avant);
    assert.deepEqual(ids(montage.charge()), [1, 2, 3, 4, 5]);
  });

  test("un exécuteur qui rend les propositions à rebours donne les mêmes identifiants et la même charge", async () => {
    const droit = await monter({ charges: [chargeDemo('petite-conflit')] });
    await droit.controleur.generer(PREMIERE);
    const rebours = await monter({
      charges: [chargeDemo('petite-conflit')],
      executeur: executeurTransforme((propositions) => [...propositions].reverse()),
    });
    const bilan = await rebours.controleur.generer(PREMIERE);
    assert.deepEqual(bilan.ajoutees, [1, 2, 3]);
    assert.deepEqual(rebours.charge().propositions, droit.charge().propositions);
  });

  test("relancer à l'identique n'ajoute rien et n'écrit rien ; un identifiant effacé ne revient jamais", async () => {
    const montage = await monter({ charges: [chargeDemo('petite-conflit')] });
    const { controleur, seance, fs } = montage;
    await controleur.generer(PREMIERE);
    await controleur.generer(SECONDE);
    const ecritures = fs.compteurs.ecritures;
    const jalons = montage.journal().jalons.length;
    const identique = await controleur.generer(PREMIERE);
    assert.deepEqual([identique.ajoutees, identique.identiques], [[], 3]);
    assert.equal(fs.compteurs.ecritures, ecritures);
    assert.equal(montage.journal().jalons.length, jalons);
    await seance.executer('retenirProposition', { id: 2 });
    await seance.executer('effacerPropositions', {});
    assert.deepEqual(ids(montage.charge()), [2]);
    const relance = await controleur.generer(PREMIERE);
    assert.deepEqual([relance.ajoutees, relance.identiques], [[6, 8], 1]);
    assert.deepEqual(ids(montage.charge()), [2, 6, 8]);
    assert.equal(montage.charge().prochainsIds.proposition, 9);
  });

  test("un compteur à 2^31 - 2 et une génération de 2 : COMPTEUR_SATURE de la commande, rien d'écrit, aucun jalon", async () => {
    const charge = chargeDemo('petite-conflit');
    charge.prochainsIds.proposition = 2 ** 31 - 2;
    const montage = await monter({ charges: [charge] });
    const ecritures = montage.fs.compteurs.ecritures;
    const jalons = montage.journal().jalons.length;
    const leve = await rejet(montage.controleur.generer({ ...SECONDE }));
    assert.ok(leve instanceof ErreurCommande, String(leve));
    assert.equal(leve.code, 'COMPTEUR_SATURE');
    assert.equal(leve.details.compteur, 'proposition');
    assert.equal(montage.fs.compteurs.ecritures, ecritures);
    assert.equal(montage.journal().jalons.length, jalons);
  });

  test("le double d'une proposition en dérive s'ajoute : seule une présente sans dérive rend un plan identique", async () => {
    const montage = await monter({ charges: [chargeDe({ n: 6, tables: 1, sieges: 6, tours: 1 })] });
    const reglages = { graine: 1, nombre: 1, arret: 10, historique: 10 };
    assert.deepEqual((await montage.controleur.generer(reglages)).ajoutees, [1]);
    await montage.seance.executer('changerPlacesTable', { id: 1, sieges: '7', origine: 'champ' });
    const [premiere] = montage.charge().propositions;
    assert.deepEqual(derive(premiere, montage.charge()).map(({ code }) => code), ['CAPACITE_CHANGEE']);
    const bilan = await montage.controleur.generer(reglages);
    assert.deepEqual([bilan.ajoutees, bilan.identiques], [[2], 0]);
    const [, seconde] = montage.charge().propositions;
    assert.deepEqual(planDepuisFichier(seconde).tours, planDepuisFichier(premiere).tours);
    assert.deepEqual(derive(seconde, montage.charge()), []);
  });

  test("deux propositions d'un même lancement au même plan n'en font qu'une", async () => {
    const montage = await monter({ charges: [chargeDe({ n: 6, tables: 1, sieges: 6, tours: 1 })] });
    const bilan = await montage.controleur.generer({ graine: 5, nombre: 3, arret: 10, historique: 10 });
    assert.deepEqual([bilan.ajoutees, bilan.identiques], [[1], 2]);
  });
});

// --- Les champs d'une proposition (§ 5.7, § 8.9) --------------------------------------

describe("génération : les champs d'une proposition (§ 5.7, § 8.9)", () => {
  test("chaque proposition porte la graine dérivée, l'arrêt et l'historique de rechercher, et se régénère", async () => {
    const montage = await monter({ charges: [chargeDemo('petite-conflit')] });
    const reglages = { graine: 41, nombre: 3, arret: 300, historique: 50 };
    await montage.controleur.generer(reglages);
    const charge = montage.charge();
    const configuration = configurationDepuisCharge(charge);
    const moteur = rechercher(configuration, reglages);
    assert.equal(charge.propositions.length, 3);
    charge.propositions.forEach((proposition, rang) => {
      assert.deepEqual(
        [proposition.graine, proposition.arret, proposition.historique, proposition.produitVersion],
        [moteur[rang].graine, 300, 50, V1],
      );
      assert.deepEqual(planRange({ ...moteur[rang], plan: regenerer(configuration, proposition) }, configuration), planDepuisFichier(proposition));
    });
  });
});

// --- Une entrée, le journal d'abord, les jalons (§ 8.2, § 8.3, § 8.8) ---------------

describe("génération : une entrée, le journal d'abord, les jalons (§ 8.2, § 8.3, § 8.8)", () => {
  test("une génération est une seule entrée ; sur un brouillon, deux jalons, sur un plan proposé, le premier seul", async () => {
    const montage = await monter({ charges: [chargeDemo('petite-conflit')] });
    const { seance, controleur } = montage;
    const executer = seance.executer;
    const appels = [];
    seance.executer = (nom, args) => {
      appels.push(nom);
      return executer(nom, args);
    };
    const avant = montage.journal();
    await controleur.generer({ graine: 3, nombre: 2, arret: 100 });
    assert.deepEqual(appels, ['enregistrerGeneration']);
    const apres = montage.journal();
    assert.equal(apres.entrees.length, avant.entrees.length + 1);
    const revision = apres.entrees.at(-1).revision;
    assert.equal(analyser(montage.etatDisque()).entete.revision, revision);
    assert.deepEqual(apres.jalons.slice(avant.jalons.length).map(({ revision: r, nom }) => [r, nom]), [
      [revision - 1, libelle('JALON_AVANT_GENERATION')],
      [revision, libelle('JALON_ETAT', { etat: 'propose' })],
    ]);
    await controleur.generer({ graine: 9, nombre: 1, arret: 100 });
    const encore = montage.journal();
    const derniere = encore.entrees.at(-1).revision;
    assert.deepEqual(encore.jalons.slice(apres.jalons.length).map(({ revision: r, nom }) => [r, nom]), [
      [derniere - 1, libelle('JALON_AVANT_GENERATION')],
    ]);
  });

  test("coupé après chaque écriture, le disque ne porte jamais un état en avance sur le journal", async () => {
    const reglages = { graine: 3, nombre: 2, arret: 100, historique: 1000 };
    const temoin = await monter({ charges: [chargeDemo('petite-conflit')] });
    const avant = temoin.fs.compteurs.ecritures;
    await temoin.controleur.generer(reglages);
    const total = temoin.fs.compteurs.ecritures - avant;
    assert.ok(total >= 3, `${total} écritures`);
    let journalEnAvance = 0;
    for (let k = 0; k <= total; k += 1) {
      const montage = await monter({ charges: [chargeDemo('petite-conflit')] });
      montage.fs.pannes.couperApres(k);
      try {
        await montage.controleur.generer(reglages);
      } catch {
        // La coupure tue le processus au milieu de la génération.
      }
      const revisionEtat = analyser(montage.etatDisque()).entete.revision;
      const revisionJournal = montage.journal().entrees.at(-1).revision;
      assert.ok(revisionEtat <= revisionJournal, `coupure ${k} : état ${revisionEtat}, journal ${revisionJournal}`);
      if (revisionJournal === revisionEtat + 1) journalEnAvance += 1;
    }
    assert.ok(journalEnAvance >= 1, 'aucune coupure ne laisse le journal une entrée en avance');
  });

  test("annulée, une génération ne laisse ni entrée, ni jalon, ni écriture", async () => {
    const manuel = executeurManuel();
    const montage = await monter({ charges: [chargeDemo('petite-conflit')], executeur: manuel });
    const ecritures = montage.fs.compteurs.ecritures;
    const journal = montage.journal();
    const enCours = montage.controleur.generer(COURT);
    await Promise.resolve();
    montage.controleur.annuler();
    assert.ok((await rejet(enCours)) instanceof ErreurAnnulee);
    assert.equal(montage.fs.compteurs.ecritures, ecritures);
    assert.deepEqual(montage.journal(), journal);
  });
});

// --- Les invariants (§ 14.12) --------------------------------------------------------

describe('génération : les invariants (§ 14.12)', () => {
  test("un exécuteur qui déplace un ancré fait refuser GENERATION_INVARIANT_VIOLE, qui nomme le rang et la violation, sans rien écrire", async () => {
    const charge = chargeDemo('petite-conflit');
    charge.reservations = [{ participant: 1, table: 1, siege: null, portee: 'tous', tour: null }];
    // Au premier tour, la personne 1 change de liste avec un occupant d'une autre table.
    const deplacer = (propositions) =>
      propositions.map((proposition) => {
        const tours = structuredClone(proposition.plan.tours);
        const [premiere, seconde] = tours[0];
        const rang = premiere.indexOf(1);
        [premiere[rang], seconde[0]] = [seconde[0], premiere[rang]];
        return { ...proposition, plan: { ...proposition.plan, tours } };
      });
    const montage = await monter({ charges: [charge], executeur: executeurTransforme(deplacer) });
    const ecritures = montage.fs.compteurs.ecritures;
    const leve = await refuse(montage.controleur.generer({ graine: 2, nombre: 2, arret: 100 }), 'GENERATION_INVARIANT_VIOLE');
    assert.deepEqual(Object.keys(leve.details), ['rang', 'violations', 'remede']);
    assert.equal(leve.details.rang, 1);
    assert.equal(leve.details.remede, null);
    // Le texte dit le rang dans le lancement, ni un retenu, ni une dérive,
    // ni une proposition enregistrée sous ce numéro.
    const texte = libelle(leve.code, leve.details);
    assert.match(texte, /rang 1\b/);
    assert.match(texte, /la personne n° 1, réservée à la table d'identifiant 1, est placée ailleurs/);
    assert.doesNotMatch(texte, /retenu|dérive|proposition n°/);
    assert.deepEqual(
      leve.details.violations.filter(({ code }) => code === 'RESERVATION'),
      [{ code: 'RESERVATION', participant: 1, table: 1, tour: 1 }],
    );
    assert.equal(montage.fs.compteurs.ecritures, ecritures);
    assert.deepEqual(montage.charge().propositions, []);
  });

  test('le moteur réel sur la grande démonstration, 2 × 20 000 mouvements : aucune violation', async () => {
    const montage = await monter({ charges: [chargeDemo('grande')] });
    const bilan = await montage.controleur.generer({ graine: 3, nombre: 2, arret: 20000 });
    assert.deepEqual(bilan.ajoutees, [1, 2]);
    const charge = montage.charge();
    const instance = normaliser(configurationDepuisCharge(charge));
    assert.ok(instance.k > 0, 'aucun ancré');
    for (const proposition of charge.propositions) assert.deepEqual(verifierInvariants(instance, planDepuisFichier(proposition)), []);
  });
});

// --- Compléter un placement partiel (§ 5.8) -------------------------------------------

describe('génération : compléter un placement partiel (§ 5.8)', () => {
  test('trois réservations, une « tous » et deux « tour », sont honorées, et personne n\'attend en réserve', async () => {
    const charge = chargeDemo('petite');
    charge.reservations = [
      { participant: 1, table: 1, siege: null, portee: 'tous', tour: null },
      { participant: 2, table: 2, siege: null, portee: 'tour', tour: 1 },
      { participant: 3, table: 4, siege: null, portee: 'tour', tour: 3 },
    ];
    const montage = await monter({ charges: [charge] });
    await montage.controleur.generer({ graine: 8, nombre: 3, arret: 2000 });
    const apres = montage.charge();
    const instance = normaliser(configurationDepuisCharge(apres));
    assert.ok(apres.propositions.length > 0);
    for (const proposition of apres.propositions) {
      const plan = planDepuisFichier(proposition);
      assert.deepEqual(verifierInvariants(instance, plan), []);
      assert.deepEqual(plan.reserves, [[], [], [], []]);
      const tableDe = (participant, tour) => plan.tables[plan.tours[tour - 1].findIndex((liste) => liste.includes(participant))];
      assert.deepEqual([1, 2, 3, 4].map((tour) => tableDe(1, tour)), [1, 1, 1, 1]);
      assert.deepEqual([tableDe(2, 1), tableDe(3, 3)], [2, 4]);
    }
  });
});

// --- L'inactivité (§ 5.10, § 8.4) ---------------------------------------------------

describe("génération : l'inactivité se suspend pendant le calcul (§ 5.10, § 8.4)", () => {
  for (const fin of ['resolue', 'annulee', 'rejetee']) {
    test(`générer suspend le compte ; ${fin}, il repart`, async () => {
      const manuel = executeurManuel();
      const montage = await monter({ charges: [chargeDemo('petite-conflit')], executeur: manuel });
      const { seance, horloge, controleur } = montage;
      const enCours = controleur.generer({ graine: 2, nombre: 1, arret: 100 });
      await Promise.resolve();
      assert.equal(seance.etat().calculEnCours, true);
      horloge.avancer(INACTIVITE_MS + 1);
      await seance.formeNommee(1).catch(() => null);
      assert.equal(seance.mode, 'ecriture');
      const [execution] = manuel.executions;
      if (fin === 'resolue') execution.resoudreParLeMoteur();
      if (fin === 'annulee') controleur.annuler();
      if (fin === 'rejetee') execution.rejeter(new ErreurGeneration('PLACES_MANQUANTES', { placesManquantes: 1 }));
      try {
        await enCours;
      } catch {
        // Annulée ou rejetée, la génération lève ; le compte repart quand même.
      }
      assert.equal(seance.etat().calculEnCours, false);
      horloge.avancer(INACTIVITE_MS);
      // Une lecture mise en file après le terme de la minuterie s'achève
      // quand le retour en lecture est fait.
      await seance.formeNommee(1).catch(() => null);
      assert.equal(seance.mode, 'lecture');
    });
  }
});

// --- L'annulation (§ 5.10, § 8.4) ------------------------------------------------------

describe("génération : l'annulation (§ 5.10, § 8.4)", () => {
  for (const geste of ['passerEnLecture', 'fermer']) {
    test(`${geste} pendant une génération l'annule : 'seance', ni entrée, ni jalon, ni état écrit`, async () => {
      const manuel = executeurManuel();
      const montage = await monter({ charges: [chargeDemo('petite-conflit')], executeur: manuel });
      const journal = montage.journal();
      const etat = montage.etatDisque();
      const enCours = montage.controleur.generer(COURT);
      await Promise.resolve();
      await montage.seance[geste]();
      assert.equal(manuel.executions[0].annulations, 1);
      const leve = await rejet(enCours);
      assert.ok(leve instanceof ErreurAnnulee);
      assert.ok(leve instanceof ErreurAnnuleeDuMoteur);
      let vu = null;
      montage.controleur.subscribe((etatControleur) => {
        vu = etatControleur;
      });
      assert.deepEqual(vu, { enCours: false, fait: 0, total: COURT.nombre * COURT.arret, annulee: 'seance' });
      assert.deepEqual(montage.journal(), journal);
      assert.equal(montage.etatDisque(), etat);
    });
  }

  test("annulée par la séance alors que l'exécution rend son résultat : ErreurAnnulee, ni écriture, ni jalon", async () => {
    // L'exécution n'arrête rien d'elle-même : seule l'annulation notée par
    // le contrôleur écarte le résultat rendu. Le passage en lecture, mis en
    // file avant la résolution, annonce l'annulation avant que le calcul ne
    // reprenne.
    // Les écritures du seul retour en lecture, mesurées sans génération.
    const temoin = await monter({ charges: [chargeDemo('petite-conflit')] });
    const avantTemoin = temoin.fs.compteurs.ecritures;
    await temoin.seance.passerEnLecture();
    const ecrituresDuRetourEnLecture = temoin.fs.compteurs.ecritures - avantTemoin;
    const manuel = executeurManuel({ differer: true });
    const montage = await monter({ charges: [chargeDemo('petite-conflit')], executeur: manuel });
    const ecritures = montage.fs.compteurs.ecritures;
    const journal = montage.journal();
    const etat = montage.etatDisque();
    const enCours = montage.controleur.generer(COURT);
    await Promise.resolve();
    const lecture = montage.seance.passerEnLecture();
    manuel.executions[0].resoudreParLeMoteur();
    const leve = await rejet(enCours);
    await lecture;
    assert.ok(leve instanceof ErreurAnnulee, String(leve));
    assert.equal(manuel.executions[0].annulations, 1);
    assert.deepEqual(montage.charge().propositions, []);
    assert.equal(montage.etatDisque(), etat);
    assert.deepEqual(montage.journal(), journal);
    assert.deepEqual(montage.journal().jalons, journal.jalons);
    assert.equal(montage.fs.compteurs.ecritures - ecritures, ecrituresDuRetourEnLecture);
    assert.equal(montage.controleur.derniereGeneration(), null);
  });

  test("controleur.annuler() dit 'commande' ; le lancement suivant remet annulee à null", async () => {
    const manuel = executeurManuel();
    const montage = await monter({ charges: [chargeDemo('petite-conflit')], executeur: manuel });
    const vus = [];
    montage.controleur.subscribe((etat) => vus.push(etat));
    assert.deepEqual(vus[0], { enCours: false, fait: 0, total: 0, annulee: null });
    const enCours = montage.controleur.generer(COURT);
    await Promise.resolve();
    manuel.executions[0].avancer(20, 50);
    assert.deepEqual(vus.at(-1), { enCours: true, fait: 20, total: 50, annulee: null });
    montage.controleur.annuler();
    await rejet(enCours);
    assert.deepEqual(vus.at(-1), { enCours: false, fait: 20, total: 50, annulee: 'commande' });
    const suivante = montage.controleur.generer(COURT);
    await Promise.resolve();
    assert.deepEqual(vus.at(-1), { enCours: true, fait: 0, total: 50, annulee: null });
    manuel.executions[1].resoudreParLeMoteur();
    await suivante;
    assert.equal(vus.at(-1).enCours, false);
  });
});

// --- L'exécuteur direct (§ 5.10) -----------------------------------------------------

describe("génération : l'exécuteur direct (§ 5.10)", () => {
  const configuration = configurationDepuisCharge(chargeDemo('petite-conflit'));

  test('annuler aussitôt après lancer : ErreurAnnulee, aucun avancement', async () => {
    const execution = creerExecuteurDirect().lancer(configuration, { graine: 1, nombre: 2, arret: 5000 });
    let avancements = 0;
    execution.surAvancement(() => {
      avancements += 1;
    });
    execution.annuler();
    assert.ok((await rejet(execution.resultat)) instanceof ErreurAnnulee);
    assert.equal(avancements, 0);
  });

  test("annuler depuis le premier avancement : ErreurAnnulee, aucun avancement de plus", async () => {
    const execution = creerExecuteurDirect().lancer(configuration, { graine: 1, nombre: 2, arret: 5000 });
    const recus = [];
    execution.surAvancement((fait, total) => {
      recus.push([fait, total]);
      execution.annuler();
    });
    assert.ok((await rejet(execution.resultat)) instanceof ErreurAnnulee);
    assert.deepEqual(recus, [[1000, 10000]]);
  });

  test('sans annulation, le résultat est celui de rechercher, et chaque avancement compte les mouvements', async () => {
    const reglages = { graine: 4, nombre: 2, arret: 3000 };
    const execution = creerExecuteurDirect().lancer(configuration, reglages);
    const recus = [];
    execution.surAvancement((fait) => recus.push(fait));
    assert.deepEqual(await execution.resultat, rechercher(configuration, reglages));
    assert.deepEqual(recus, [1000, 2000, 3000, 4000, 5000, 6000]);
  });

  test("une RangeError levée par un abonné remonte telle quelle, jamais comme un réglage", async () => {
    const montage = await monter({ charges: [chargeDemo('petite-conflit')] });
    const faute = new RangeError('faute d\'un abonné');
    let levee = false;
    montage.controleur.subscribe(({ fait }) => {
      if (fait > 0 && !levee) {
        levee = true;
        throw faute;
      }
    });
    const ecritures = montage.fs.compteurs.ecritures;
    const leve = await rejet(montage.controleur.generer({ graine: 1, nombre: 1, arret: 2000 }));
    assert.equal(leve, faute);
    assert.ok(!(leve instanceof ErreurGeneration));
    assert.equal(montage.fs.compteurs.ecritures, ecritures);
    assert.deepEqual(montage.charge().propositions, []);
  });

  test('des places manquantes : ErreurGeneration PLACES_MANQUANTES, code et détails du moteur', async () => {
    const manque = configurationDepuisCharge(chargeDe({ n: 13, tables: 4, sieges: 3 }));
    const leve = await rejet(creerExecuteurDirect().lancer(manque, COURT).resultat);
    assert.ok(leve instanceof ErreurGeneration);
    assert.deepEqual([leve.code, leve.details], ['PLACES_MANQUANTES', { placesManquantes: 1 }]);
  });

  test("versErreurGeneration : l'annulation telle quelle, une erreur de configuration convertie, toute autre relevée, RangeError comprise", () => {
    const annulee = new ErreurAnnuleeDuMoteur();
    assert.equal(versErreurGeneration(annulee), annulee);
    const configurationFausse = new ErreurConfiguration('TOURS', { tours: 0 });
    const convertie = versErreurGeneration(configurationFausse);
    assert.ok(convertie instanceof ErreurGeneration);
    assert.deepEqual([convertie.code, convertie.details], ['TOURS', { tours: 0 }]);
    let horsDomaine = null;
    try {
      rechercher(configuration, { graine: 2 ** 32, nombre: 1, arret: 1 });
    } catch (erreur) {
      horsDomaine = erreur;
    }
    assert.ok(horsDomaine instanceof RangeError);
    assert.equal(versErreurGeneration(horsDomaine), horsDomaine);
    const autre = new TypeError('faute du code');
    assert.equal(versErreurGeneration(autre), autre);
  });
});

// --- La durée observée et l'estimation (§ 5.10) -------------------------------------------

// Une génération sur l'exécuteur manuel qui dure ms à l'horloge pilotée.
async function genererEn(montage, manuel, reglages, ms) {
  const enCours = montage.controleur.generer(reglages, { confirmee: true });
  await Promise.resolve();
  montage.horloge.avancer(ms);
  manuel.executions.at(-1).resoudre(rechercher(manuel.executions.at(-1).configuration, { ...reglages, arret: 50 }));
  return enCours;
}

describe('génération : la durée observée, en mémoire (§ 5.10)', () => {
  test("1 800 ms pour 5 × 200 000 mouvements ; un contrôleur neuf ne sait rien", async () => {
    const manuel = executeurManuel();
    const montage = await monter({ charges: [chargeDemo('petite-conflit')], executeur: manuel });
    assert.equal(montage.controleur.derniereGeneration(), null);
    const bilan = await genererEn(montage, manuel, { graine: 1, nombre: 5, arret: 200000, historique: 1000 }, 1800);
    assert.equal(bilan.dureeMs, 1800);
    assert.deepEqual(montage.controleur.derniereGeneration(), {
      dureeMs: 1800,
      mouvements: 1000000,
      participants: 12,
      nombre: 5,
      arret: 200000,
    });
    const neuf = creerControleurGeneration({
      seance: montage.seance,
      executeur: creerExecuteurDirect(),
      horloge: montage.horloge,
      produitVersion: V1,
    });
    assert.equal(neuf.derniereGeneration(), null);
    assert.deepEqual(neuf.estimer({ graine: 1, nombre: 5, arret: 200000, historique: 1000 }), { inconnue: true });
  });

  test("une génération annulée ou rejetée ne mesure rien", async () => {
    const manuel = executeurManuel();
    const montage = await monter({ charges: [chargeDemo('petite-conflit')], executeur: manuel });
    const enCours = montage.controleur.generer(COURT);
    await Promise.resolve();
    montage.horloge.avancer(500);
    montage.controleur.annuler();
    await rejet(enCours);
    assert.equal(montage.controleur.derniereGeneration(), null);
  });
});

describe("génération : l'estimation et la génération longue (§ 5.10)", () => {
  test('proportionnelle aux mouvements, longue au-delà du seuil, au-delà du plafond dite sans refus', async () => {
    assert.equal(SEUIL_GENERATION_LONGUE_S, 60);
    assert.equal(PLAFOND_USAGE_S, 1800);
    const manuel = executeurManuel();
    const montage = await monter({ charges: [chargeDemo('petite-conflit')], executeur: manuel });
    const { controleur } = montage;
    assert.deepEqual(controleur.estimer({ graine: 1, nombre: 5, arret: 200000, historique: 1000 }), { inconnue: true });
    await genererEn(montage, manuel, { graine: 1, nombre: 5, arret: 200000, historique: 1000 }, 2000);
    const mesure = controleur.derniereGeneration();
    assert.deepEqual(controleur.estimer({ graine: 1, nombre: 3000, arret: 200000, historique: 1000 }), {
      secondes: 1200,
      longue: true,
      auDelaDuPlafond: false,
      mesure,
    });
    assert.deepEqual(controleur.estimer({ graine: 1, nombre: 5, arret: 200000, historique: 1000 }), {
      secondes: 2,
      longue: false,
      auDelaDuPlafond: false,
      mesure,
    });
    assert.equal(controleur.estimer({ graine: 1, nombre: 5000, arret: 200000, historique: 1000 }).auDelaDuPlafond, true);
    assert.equal(controleur.estimer({ graine: 1, nombre: 150, arret: 200000, historique: 1000 }).longue, false);
    assert.equal(controleur.estimer({ graine: 1, nombre: 151, arret: 200000, historique: 1000 }).longue, true);
  });

  test("une génération longue demande sa confirmation, puis part ; sans mesure, au-delà de 10 000 000 mouvements", async () => {
    const manuel = executeurManuel();
    const montage = await monter({ charges: [chargeDemo('petite-conflit')], executeur: manuel });
    const { controleur, espion } = montage;
    const sansMesure = { graine: 1, nombre: 5, arret: 2000001, historique: 1000 };
    const refus = await refuseSansRien(montage, 'CONFIRMATION_REQUISE', { estimation: { inconnue: true }, remede: null }, sansMesure);
    assert.match(libelle(refus.code, refus.details), /confirm/i);
    const juste = controleur.generer({ ...sansMesure, arret: 2000000 });
    await Promise.resolve();
    assert.equal(espion.lancements.length, 1);
    controleur.annuler();
    await rejet(juste);
    await genererEn(montage, manuel, { graine: 1, nombre: 5, arret: 200000, historique: 1000 }, 2000);
    const longue = { graine: 1, nombre: 3000, arret: 200000, historique: 1000 };
    const lances = espion.lancements.length;
    const ecritures = montage.fs.compteurs.ecritures;
    const leve = await refuse(controleur.generer(longue), 'CONFIRMATION_REQUISE');
    assert.deepEqual(leve.details, { estimation: controleur.estimer(longue), remede: null });
    assert.match(libelle(leve.code, leve.details), /vingt minutes/);
    assert.equal(espion.lancements.length, lances);
    assert.equal(montage.fs.compteurs.ecritures, ecritures);
    const confirmee = controleur.generer(longue, { confirmee: true });
    await Promise.resolve();
    assert.equal(espion.lancements.length, lances + 1);
    controleur.annuler();
    await rejet(confirmee);
  });
});

// --- Une table, un tour (§ 15.4) ---------------------------------------------------------

describe('génération : une table, un tour (§ 15.4)', () => {
  test('une table de 6, six personnes, un tour : la génération aboutit', async () => {
    const montage = await monter({ charges: [chargeDe({ n: 6, tables: 1, sieges: 6, tours: 1 })] });
    const bilan = await montage.controleur.generer({ graine: 1, nombre: 1, arret: 10 });
    assert.deepEqual(bilan.ajoutees, [1]);
    assert.deepEqual(planDepuisFichier(montage.charge().propositions[0]).tours, [[[1, 2, 3, 4, 5, 6]]]);
  });
});
