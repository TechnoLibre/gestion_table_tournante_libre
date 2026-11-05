// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

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
import { PLAN_PARFAIT_PETITE } from '../demo/catalogue.js';
import { texteLivre } from '../demo/livrees.js';
import { constante } from '../geometrie/constantes.js';
import { normaliser } from '../moteur/configuration.js';
import { ErreurAnnulee as ErreurAnnuleeDuMoteur, ErreurConfiguration } from '../moteur/erreurs.js';
import { rechercher, regenerer, repartir } from '../moteur/recherche.js';
import { verifierInvariants } from '../moteur/verification.js';
import { serialiser } from '../stockage/canonique.js';
import { creer as creerDansLeDepot } from '../stockage/depot.js';
import { FORMAT, analyser, creerCharge } from '../stockage/document.js';
import { lireJournal } from '../stockage/journal.js';
import { SUFFIXES, cleEvenement } from '../stockage/noms.js';
import { derive, planDepuisFichier, versFichier } from '../stockage/placements.js';
import { VERSION } from '../version.genere.js';
import { configurationDe } from './configuration.js';
import { departAdapte, departDuMoteur, planDuDepart, tourFigeDifferent } from './depart.js';
import { ErreurCommande } from './erreurs.js';
import { detaillerQualite, evaluer, rencontresDePersonne } from './evaluation.js';
import { creerExecuteurTravailleur } from './executeur_travailleur.js';
import {
  ErreurAnnulee,
  ErreurGeneration,
  PLAFOND_USAGE_S,
  SEUIL_GENERATION_LONGUE_S,
  creerControleurGeneration,
  coeursDe,
  creerExecuteurDirect,
  ralentissement,
  versErreurGeneration,
} from './generation.js';
import { brancherTravailleur } from './generation_travailleur.js';
import { creerHorlogePilotee } from './horloge.js';
import { libelle } from './libelles.js';
import { nomAffiche } from './personnes.js';
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
    organisation: rang % 2 === 0 ? 'Club des Merles' : 'Grisaille',
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

// Un exécuteur qui note chaque lancement, options comprises, avant de le
// confier à interne ; il porte les cœurs disponibles d'interne.
function espionner(interne = creerExecuteurDirect()) {
  const lancements = [];
  return {
    lancements,
    coeursDisponibles: interne.coeursDisponibles,
    lancer(configuration, reglages, options) {
      lancements.push({ configuration, reglages, options });
      return interne.lancer(configuration, reglages, options);
    },
  };
}

// Un exécuteur que l'épreuve résout à la main : chaque exécution porte
// resoudre, rejeter, avancer, et compte ses annulations. Annulée, elle
// rejette ErreurAnnulee, comme le travailleur qu'on termine ; differer
// vrai, elle ne fait que compter, et l'épreuve rejette quand elle veut,
// comme l'exécuteur direct qui n'arrête qu'à la lecture suivante du signal.
// coeursDisponibles : ceux qu'il annonce ; chaque exécution emploie les
// cœurs que le lancer lui demande (options.coeurs).
function executeurManuel({ differer = false, coeursDisponibles } = {}) {
  const executions = [];
  return {
    executions,
    coeursDisponibles,
    lancer(configuration, reglages, options) {
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
        coeurs: options?.coeurs,
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

// Un exécuteur qui calcule par le moteur, options du lancer comprises, puis
// transforme la liste rendue.
function executeurTransforme(transformer) {
  const direct = creerExecuteurDirect();
  return {
    lancer(configuration, reglages, options) {
      const execution = direct.lancer(configuration, reglages, options);
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
// sauf ecriture faux — et un contrôleur sur un exécuteur espionné ;
// lireConstante, quand il est donné, remplace la lecture du registre des
// constantes par le contrôleur.
async function monter({
  charges,
  executeur = creerExecuteurDirect(),
  ecriture = true,
  fs = creerFichiersSimules(),
  disque = true,
  lireConstante,
} = {}) {
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
  const controleur = creerControleurGeneration({
    seance,
    executeur: espion,
    horloge,
    produitVersion: V1,
    ...(lireConstante === undefined ? {} : { constante: lireConstante }),
  });
  const base = charges[0].evenement.nom;
  await seance.ouvrir(cleEvenement(base, base));
  if (ecriture) await seance.passerEnEcriture();
  const journal = () => lireJournal(fs.contenu('documents', `${base}/${base}${SUFFIXES.journal}`));
  const etatDisque = () => fs.contenu('documents', `${base}/${base}${SUFFIXES.etat}`);
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
// Le réglage des cœurs d'un contrôleur dont l'exécuteur n'en annonce pas.
const UN_COEUR = Object.freeze({ automatique: true, manuel: 1, disponibles: 1, nombre: 1 });
// Le ralentissement d'un cœur quand tous les processeurs logiques
// travaillent, tel que le registre le porte (§ 5.10, Q14).
const RHO = constante('RALENTISSEMENT_PLEINE_CHARGE');
// Une lecture du registre où la constante du ralentissement vaut rho, les
// autres celles du registre ; un objet { rho } se lit à chaque appel, et
// l'épreuve le change en cours de route.
const lireAvec = (rho) => (nom) =>
  nom === 'RALENTISSEMENT_PLEINE_CHARGE' ? (typeof rho === 'number' ? rho : rho.rho) : constante(nom);

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
      assert.equal(controleur.valider({ graine: '3', nombre: '2', arret: '40', historique }).reglages.historique, 1_000);
    }
    assert.deepEqual(controleur.reglagesProposes(), { graine: 1, nombre: 20, arret: 2_000_000, historique: 1_000 });
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
    const configuration = configurationDe(charge);
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
    await seance.ouvrir(cleEvenement(AUTRE, AUTRE));
    assert.equal(controleur.grainePropose(), 1);
    await seance.passerEnEcriture();
    await controleur.generer({ ...COURT, graine: MAX_GRAINE });
    assert.equal(controleur.grainePropose(), 0);
    await seance.fermer();
    await seance.ouvrir(cleEvenement(AUTRE, AUTRE));
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
    fs.deposer('documents', `${NOM}/${NOM}${SUFFIXES.etat}`, texte.replace(`"format":${FORMAT}`, `"format":${FORMAT + 1}`));
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
    const vide = configurationDe(chargeDe({ n: 3, exclus: [1, 2, 3], tables: 2 }));
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
      normaliser(configurationDe(charge));
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
    // Sans événement, le réglage encore d'abord : AUCUN_EVENEMENT vient après lui.
    await lecture.seance.fermer();
    await refuseSansRien(lecture, 'REGLAGE_HORS_DOMAINE', { reglage: 'arret', remede: null }, { ...COURT, arret: 0 });
    await refuseSansRien(lecture, 'AUCUN_EVENEMENT', { remede: null });
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
      const configuration = configurationDe(montage.charge());
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
    const configuration = configurationDe(charge);
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
    const instance = normaliser(configurationDe(charge));
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
    const instance = normaliser(configurationDe(apres));
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
      assert.deepEqual(vu, { enCours: false, fait: 0, total: COURT.nombre * COURT.arret, annulee: 'seance', coeurs: UN_COEUR });
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
    assert.deepEqual(vus[0], { enCours: false, fait: 0, total: 0, annulee: null, coeurs: UN_COEUR });
    const enCours = montage.controleur.generer(COURT);
    await Promise.resolve();
    manuel.executions[0].avancer(20, 50);
    assert.deepEqual(vus.at(-1), { enCours: true, fait: 20, total: 50, annulee: null, coeurs: UN_COEUR });
    montage.controleur.annuler();
    await rejet(enCours);
    assert.deepEqual(vus.at(-1), { enCours: false, fait: 20, total: 50, annulee: 'commande', coeurs: UN_COEUR });
    const suivante = montage.controleur.generer(COURT);
    await Promise.resolve();
    assert.deepEqual(vus.at(-1), { enCours: true, fait: 0, total: 50, annulee: null, coeurs: UN_COEUR });
    manuel.executions[1].resoudreParLeMoteur();
    await suivante;
    assert.equal(vus.at(-1).enCours, false);
  });
});

// --- L'exécuteur direct (§ 5.10) -----------------------------------------------------

describe("génération : l'exécuteur direct (§ 5.10)", () => {
  const configuration = configurationDe(chargeDemo('petite-conflit'));

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
    const manque = configurationDe(chargeDe({ n: 13, tables: 4, sieges: 3 }));
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
      coeurs: 1,
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
      coeurs: 1,
    });
    assert.deepEqual(controleur.estimer({ graine: 1, nombre: 5, arret: 200000, historique: 1000 }), {
      secondes: 2,
      longue: false,
      auDelaDuPlafond: false,
      mesure,
      coeurs: 1,
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

// --- Les cœurs de calcul (§ 5.7, § 5.10) -------------------------------------------------

// Une fabrique de travailleurs qui calculent par brancherTravailleur, le
// vrai côté travailleur : la proposition de rang r rend sa réponse après
// attente(r) tours de la file des microtâches. Par défaut (8 − r), les
// derniers rangs s'achèvent avant les premiers.
const A_REBOURS = (rang) => 8 - rang;
// Les rangs du milieu d'abord : 3, 2, puis 1, puis 4 ; quatre rangs au plus,
// un rang de plus lève dans travailleursCalculants.
const MILIEU_D_ABORD = (rang) => [4, 1, 0, 6][rang - 1];

function travailleursCalculants(attente = A_REBOURS) {
  return () => {
    const travailleur = {
      onmessage: null,
      termine: false,
      postMessage(message) {
        const copie = structuredClone(message);
        let restants = attente(copie.rang);
        if (!Number.isSafeInteger(restants) || restants < 0) throw new RangeError(`attente du rang ${copie.rang} : ${restants}`);
        const tour = () => {
          if (restants > 0) {
            restants -= 1;
            return Promise.resolve().then(tour);
          }
          if (travailleur.termine) return undefined;
          const portee = { onmessage: null, postMessage: (data) => !travailleur.termine && travailleur.onmessage?.({ data: structuredClone(data) }) };
          brancherTravailleur(portee);
          portee.onmessage({ data: copie });
          return undefined;
        };
        Promise.resolve().then(tour);
      },
      terminate() {
        travailleur.termine = true;
      },
    };
    return travailleur;
  };
}

describe('génération : les cœurs de calcul, un réglage du poste pour la séance (§ 5.7, § 5.10)', () => {
  test("automatiques à la création : autant que l'exécuteur en annonce ; 1 quand il n'en annonce pas", async () => {
    const montage = await monter({ charges: [chargeDemo('petite')], executeur: creerExecuteurDirect({ coeursDisponibles: 6 }) });
    assert.deepEqual(montage.controleur.coeurs(), { automatique: true, manuel: 6, disponibles: 6, nombre: 6 });
    const sans = await monter({ charges: [chargeDemo('petite')], executeur: executeurManuel() });
    assert.deepEqual(sans.controleur.coeurs(), UN_COEUR);
  });

  test('reglerCoeurs : une saisie de 1 à disponibles, ou le refus de lireEntier ou HORS_DOMAINE {min: 1, max}, remède null, sans rien changer ; automatique rend les disponibles et garde le manuel', async () => {
    const montage = await monter({ charges: [chargeDemo('petite')], executeur: creerExecuteurDirect({ coeursDisponibles: 6 }) });
    const { controleur } = montage;
    const vus = [];
    controleur.subscribe((etat) => vus.push(etat.coeurs));
    assert.deepEqual(controleur.reglerCoeurs({ automatique: false }), { refus: null });
    assert.deepEqual(controleur.coeurs(), { automatique: false, manuel: 6, disponibles: 6, nombre: 6 });
    assert.deepEqual(controleur.reglerCoeurs({ saisie: ' 3 ' }), { refus: null });
    assert.deepEqual(controleur.coeurs(), { automatique: false, manuel: 3, disponibles: 6, nombre: 3 });
    const refusees = [
      ['0', 'HORS_DOMAINE', { min: 1, max: 6, remede: null }],
      ['7', 'HORS_DOMAINE', { min: 1, max: 6, remede: null }],
      ['x', 'NON_ENTIER', { saisie: 'x', remede: null }],
      ['1,5', 'NON_ENTIER', { saisie: '1,5', remede: null }],
      ['-1', 'NON_ENTIER', { saisie: '-1', remede: null }],
      ['', 'NON_ENTIER', { saisie: '', remede: null }],
    ];
    assert.equal(refusees.length, 6);
    for (const [saisie, code, details] of refusees) {
      const { refus } = controleur.reglerCoeurs({ saisie, automatique: true });
      assert.deepEqual(refus, { code, details }, saisie);
      assert.equal(typeof libelle(code, details), 'string');
      assert.deepEqual(controleur.coeurs(), { automatique: false, manuel: 3, disponibles: 6, nombre: 3 }, saisie);
    }
    assert.deepEqual(controleur.reglerCoeurs({ saisie: '6' }), { refus: null });
    assert.deepEqual(controleur.reglerCoeurs({ saisie: '1' }), { refus: null });
    assert.deepEqual(controleur.reglerCoeurs({ automatique: true }), { refus: null });
    assert.deepEqual(controleur.coeurs(), { automatique: true, manuel: 1, disponibles: 6, nombre: 6 });
    assert.deepEqual(vus, [
      { automatique: true, manuel: 6, disponibles: 6, nombre: 6 },
      { automatique: false, manuel: 6, disponibles: 6, nombre: 6 },
      { automatique: false, manuel: 3, disponibles: 6, nombre: 3 },
      { automatique: false, manuel: 6, disponibles: 6, nombre: 6 },
      { automatique: false, manuel: 1, disponibles: 6, nombre: 1 },
      { automatique: true, manuel: 1, disponibles: 6, nombre: 6 },
    ]);
  });

  test("régler les cœurs n'écrit rien : ni état, ni entrée du journal, ni révision, en écriture comme en lecture", async () => {
    for (const ecriture of [true, false]) {
      const montage = await monter({ charges: [chargeDemo('petite')], executeur: creerExecuteurDirect({ coeursDisponibles: 4 }), ecriture });
      const ecritures = montage.fs.compteurs.ecritures;
      const journal = montage.journal();
      const etat = montage.etatDisque();
      const revision = montage.seance.etat().evenement.revision;
      montage.controleur.reglerCoeurs({ automatique: false });
      assert.deepEqual(montage.controleur.reglerCoeurs({ saisie: '2' }), { refus: null });
      montage.controleur.reglerCoeurs({ saisie: '9' });
      montage.controleur.reglerCoeurs({ automatique: true });
      await montage.seance.attendre();
      assert.equal(montage.fs.compteurs.ecritures, ecritures, `écriture ${ecriture}`);
      assert.deepEqual(montage.journal(), journal);
      assert.equal(montage.etatDisque(), etat);
      assert.equal(montage.seance.etat().evenement.revision, revision);
    }
  });

  test('le réglage vaut pour la séance : il survit à la fermeture et à l’ouverture d’un autre événement', async () => {
    const montage = await monter({
      charges: [chargeDemo('petite'), chargeDemo('petite-conflit', AUTRE)],
      executeur: creerExecuteurDirect({ coeursDisponibles: 4 }),
    });
    montage.controleur.reglerCoeurs({ automatique: false });
    montage.controleur.reglerCoeurs({ saisie: '2' });
    await montage.seance.fermer();
    await montage.seance.ouvrir(cleEvenement(AUTRE, AUTRE));
    assert.deepEqual(montage.controleur.coeurs(), { automatique: false, manuel: 2, disponibles: 4, nombre: 2 });
  });

  test('generer confie à lancer coeurs = min(nombre de propositions, cœurs réglés)', async () => {
    const montage = await monter({ charges: [chargeDemo('petite')], executeur: creerExecuteurDirect({ coeursDisponibles: 4 }) });
    const { controleur, espion } = montage;
    const cas = [
      { reglage: { automatique: true }, nombre: 3, attendus: 3 },
      { reglage: { automatique: true }, nombre: 6, attendus: 4 },
      { reglage: { automatique: false, saisie: '2' }, nombre: 5, attendus: 2 },
      { reglage: { automatique: false, saisie: '1' }, nombre: 2, attendus: 1 },
    ];
    assert.equal(cas.length, 4);
    for (const [k, { reglage, nombre, attendus }] of cas.entries()) {
      controleur.reglerCoeurs(reglage);
      await controleur.generer({ graine: 10 + k, nombre, arret: 50, historique: 1000 });
      assert.deepEqual(espion.lancements.at(-1).options, { coeurs: attendus }, JSON.stringify(reglage));
    }
  });

  test("par le groupe de travailleurs, 1 cœur ou 3 : le même état écrit, octet pour octet, et les propositions de rechercher", async () => {
    const etats = [];
    for (const coeurs of [1, 3]) {
      const executeur = creerExecuteurTravailleur(travailleursCalculants(), { coeursDisponibles: 3 });
      const montage = await monter({ charges: [chargeDemo('petite-conflit')], executeur });
      montage.controleur.reglerCoeurs({ automatique: false });
      montage.controleur.reglerCoeurs({ saisie: String(coeurs) });
      const reglages = { graine: 5, nombre: 5, arret: 2000, historique: 1000 };
      const bilan = await montage.controleur.generer(reglages);
      assert.deepEqual(bilan.ajoutees, [1, 2, 3, 4, 5]);
      assert.deepEqual(montage.espion.lancements.at(-1).options, { coeurs });
      const attendues = rechercher(configurationDe(montage.charge()), reglages);
      assert.deepEqual(
        montage.charge().propositions.map(({ graine }) => graine),
        attendues.map(({ graine }) => graine),
      );
      assert.deepEqual(montage.charge().propositions.map(planDepuisFichier), attendues.map((p) => planRange(p, configurationDe(montage.charge()))));
      assert.equal(montage.controleur.derniereGeneration().coeurs, coeurs);
      etats.push(montage.etatDisque());
    }
    assert.equal(etats.length, 2);
    assert.equal(etats[1], etats[0]);
  });

  test("la mesure porte les cœurs que l'exécution a employés ; 1 quand elle ne le dit pas", async () => {
    const manuel = executeurManuel({ coeursDisponibles: 4 });
    const montage = await monter({ charges: [chargeDemo('petite-conflit')], executeur: manuel });
    await genererEn(montage, manuel, { graine: 1, nombre: 5, arret: 200000, historique: 1000 }, 2000);
    assert.equal(montage.controleur.derniereGeneration().coeurs, 4);
    const muet = executeurTransforme((propositions) => propositions);
    const autre = await monter({ charges: [chargeDemo('petite-conflit')], executeur: muet });
    await autre.controleur.generer(COURT);
    assert.equal(autre.controleur.derniereGeneration().coeurs, 1);
  });

  test("l'estimation compte en vagues, chacune au ralentissement de ses cœurs : coût d'une proposition × ⌈nombre / cœurs⌉ × ρ(cœurs), la mesure ramenée de même", async () => {
    const manuel = executeurManuel({ coeursDisponibles: 8 });
    const montage = await monter({ charges: [chargeDemo('petite-conflit')], executeur: manuel });
    const { controleur } = montage;
    // ρ(W) sur 8 processeurs logiques, ρ(8) étant la valeur du registre.
    const rho = (w) => 1 + ((RHO - 1) * (w - 1)) / 7;
    const proche = (valeur, attendue) => assert.ok(Math.abs(valeur - attendue) < 1e-9, `${valeur} ≠ ${attendue}`);
    controleur.reglerCoeurs({ automatique: false });
    controleur.reglerCoeurs({ saisie: '1' });
    // 5 × 200 000 mouvements en 2 s sur 1 cœur, ρ(1) = 1 : 0,4 s par proposition.
    await genererEn(montage, manuel, { graine: 1, nombre: 5, arret: 200000, historique: 1000 }, 2000);
    const sur1 = controleur.derniereGeneration();
    assert.equal(sur1.coeurs, 1);
    controleur.reglerCoeurs({ saisie: '2' });
    const deux = controleur.estimer({ graine: 1, nombre: 5, arret: 200000, historique: 1000 });
    assert.equal(deux.coeurs, 2);
    proche(deux.secondes, 0.4 * 3 * rho(2));
    assert.deepEqual(deux.mesure, sur1);
    proche(controleur.estimer({ graine: 1, nombre: 4, arret: 200000 }).secondes, 0.4 * 2 * rho(2));
    controleur.reglerCoeurs({ automatique: true });
    const automatique = controleur.estimer({ graine: 1, nombre: 5, arret: 200000 });
    assert.equal(automatique.coeurs, 5);
    proche(automatique.secondes, 0.4 * rho(5));
    // 3 000 propositions : 1 200 s sur 1 cœur ; 750 vagues sur 4, 375 sur 8.
    controleur.reglerCoeurs({ automatique: false });
    controleur.reglerCoeurs({ saisie: '4' });
    const quatre = controleur.estimer({ graine: 1, nombre: 3000, arret: 200000 });
    proche(quatre.secondes, 0.4 * 750 * rho(4));
    assert.equal(quatre.longue, true);
    controleur.reglerCoeurs({ automatique: true });
    proche(controleur.estimer({ graine: 1, nombre: 3000, arret: 200000 }).secondes, 0.4 * 375 * RHO);
    // Une mesure prise sur 5 cœurs, 5 propositions : une seule vague de
    // 200 000 mouvements à ρ(5) en 2 s ; sur 1 cœur, 5 vagues à ρ(1).
    await genererEn(montage, manuel, { graine: 1, nombre: 5, arret: 200000, historique: 1000 }, 2000);
    assert.equal(controleur.derniereGeneration().coeurs, 5);
    controleur.reglerCoeurs({ automatique: false });
    controleur.reglerCoeurs({ saisie: '1' });
    proche(controleur.estimer({ graine: 1, nombre: 5, arret: 200000 }).secondes, (2 * 5) / rho(5));
  });

  test('sans mesure, la question part au-delà de 10 000 000 mouvements par cœur, ralentissement compris : ⌈nombre / cœurs⌉ × arret × ρ(cœurs)', async () => {
    // 2 processeurs logiques, ρ(2) = ρ à pleine charge, que l'épreuve fixe à 2.
    const manuel = executeurManuel({ coeursDisponibles: 2 });
    const montage = await monter({ charges: [chargeDemo('petite-conflit')], executeur: manuel, lireConstante: lireAvec(2) });
    const { controleur, espion } = montage;
    await refuseSansRien(montage, 'CONFIRMATION_REQUISE', { estimation: { inconnue: true }, remede: null }, {
      graine: 1,
      nombre: 10,
      arret: 1000001,
      historique: 1000,
    });
    const juste = controleur.generer({ graine: 1, nombre: 10, arret: 1000000, historique: 1000 });
    await Promise.resolve();
    assert.equal(espion.lancements.length, 1);
    controleur.annuler();
    await rejet(juste);
  });

  test('le texte de CONFIRMATION_REQUISE dit les cœurs de l’estimation et ceux de la mesure, seulement au-delà d’un', () => {
    const mesure = { dureeMs: 2000, mouvements: 1000000, participants: 12, nombre: 5, arret: 200000, coeurs: 2 };
    const plusieurs = libelle('CONFIRMATION_REQUISE', {
      estimation: { secondes: 1200, longue: true, auDelaDuPlafond: false, mesure, coeurs: 4 },
      remede: null,
    });
    assert.match(plusieurs, /environ vingt minutes, sur 4 cœurs, d'après/);
    assert.match(plusieurs, /12 participants, sur 2 cœurs/);
    const un = libelle('CONFIRMATION_REQUISE', {
      estimation: { secondes: 1200, longue: true, auDelaDuPlafond: false, mesure: { ...mesure, coeurs: 1 }, coeurs: 1 },
      remede: null,
    });
    assert.doesNotMatch(un, /cœur/);
  });

  test("l'exécuteur direct annonce ses cœurs par coeursDe, calcule dans le fil quel que soit coeurs, et n'emploie qu'un cœur", async () => {
    assert.equal(creerExecuteurDirect().coeursDisponibles, 1);
    assert.equal(creerExecuteurDirect({ coeursDisponibles: 12 }).coeursDisponibles, 12);
    assert.equal(creerExecuteurDirect({ coeursDisponibles: 0 }).coeursDisponibles, 1);
    const configuration = configurationDe(chargeDemo('petite-conflit'));
    const reglages = { graine: 4, nombre: 3, arret: 2000 };
    const execution = creerExecuteurDirect({ coeursDisponibles: 4 }).lancer(configuration, reglages, { coeurs: 3 });
    assert.equal(execution.coeurs, 1);
    assert.deepEqual(await execution.resultat, rechercher(configuration, reglages));
  });

  test('coeursDe : un entier d’au moins 1 tel quel, toute autre valeur 1', () => {
    const cas = [
      [4, 4],
      [1, 1],
      [0, 1],
      [-2, 1],
      [1.5, 1],
      ['8', 1],
      [undefined, 1],
      [null, 1],
      [Number.NaN, 1],
    ];
    assert.equal(cas.length, 9);
    for (const [valeur, attendue] of cas) assert.equal(coeursDe(valeur), attendue, String(valeur));
  });
});

// --- Le ralentissement d'un cœur chargé (§ 5.10, Q14) -----------------------------------------

describe("génération : l'estimation compte le ralentissement d'un cœur chargé (§ 5.10, Q14)", () => {
  const proche = (valeur, attendue, message) =>
    assert.ok(Math.abs(valeur - attendue) < 1e-9, `${message ?? ''} ${valeur} ≠ ${attendue}`);
  const DEFAUT = { graine: 1, nombre: 5, arret: 200000, historique: 1000 };

  test('ralentissement(W, L, ρmax) : 1 + (ρmax − 1)(W − 1)/(L − 1), 1 sur un seul processeur logique', () => {
    const cas = [
      [1, 16, 2, 1],
      [16, 16, 2, 2],
      [2, 8, 2, 1 + 1 / 7],
      [5, 5, 2, 2],
      [3, 5, 1.5, 1.25],
      [4, 7, 3, 2],
      [1, 1, 3, 1],
      [1, 1, 1, 1],
    ];
    assert.equal(cas.length, 8);
    for (const [w, l, rhoMax, attendu] of cas) proche(ralentissement(w, l, rhoMax), attendu, `ρ(${w}, ${l}, ${rhoMax})`);
  });

  test("même nombre de cœurs à la mesure et à l'estimation : la durée sans ralentissement, au flottant près — au défaut, 5 propositions sur 5 cœurs", async () => {
    const manuel = executeurManuel({ coeursDisponibles: 5 });
    const montage = await monter({ charges: [chargeDemo('petite-conflit')], executeur: manuel, lireConstante: lireAvec(3) });
    const { controleur } = montage;
    await genererEn(montage, manuel, DEFAUT, 2000);
    assert.equal(controleur.derniereGeneration().coeurs, 5);
    const memes = controleur.estimer(DEFAUT);
    assert.equal(memes.coeurs, 5);
    proche(memes.secondes, 2);
    // Deux vagues sur les mêmes cinq cœurs : le double.
    proche(controleur.estimer({ ...DEFAUT, nombre: 10 }).secondes, 4);
    proche(controleur.estimer({ ...DEFAUT, nombre: 6, arret: 50000 }).secondes, 1);
  });

  test("plus de cœurs à l'estimation qu'à la mesure : la durée multipliée par ρ(W') / ρ(Wm) > 1 ; moins, divisée", async () => {
    const manuel = executeurManuel({ coeursDisponibles: 8 });
    const montage = await monter({ charges: [chargeDemo('petite-conflit')], executeur: manuel, lireConstante: lireAvec(2) });
    const { controleur } = montage;
    controleur.reglerCoeurs({ automatique: false });
    controleur.reglerCoeurs({ saisie: '1' });
    await genererEn(montage, manuel, { ...DEFAUT, nombre: 4 }, 1600);
    // 0,4 s par proposition sur 1 cœur ; une vague de 4 sur 4 cœurs, ρ(4) = 1 + 3/7.
    controleur.reglerCoeurs({ saisie: '4' });
    const quatre = controleur.estimer({ ...DEFAUT, nombre: 4 });
    assert.equal(quatre.coeurs, 4);
    proche(quatre.secondes, 0.4 * (10 / 7));
    assert.ok(quatre.secondes > 0.4);
    // Mesurée sur 8 cœurs, ρ(8) = 2 : estimée sur 1, chaque vague deux fois plus rapide.
    controleur.reglerCoeurs({ saisie: '8' });
    await genererEn(montage, manuel, { ...DEFAUT, nombre: 8 }, 2000);
    assert.equal(controleur.derniereGeneration().coeurs, 8);
    controleur.reglerCoeurs({ saisie: '1' });
    proche(controleur.estimer({ ...DEFAUT, nombre: 8 }).secondes, (8 * 2) / 2);
  });

  test("un seul processeur logique : aucun facteur, quel que soit ρ à pleine charge", async () => {
    const manuel = executeurManuel();
    const montage = await monter({ charges: [chargeDemo('petite-conflit')], executeur: manuel, lireConstante: lireAvec(5) });
    const { controleur } = montage;
    await genererEn(montage, manuel, DEFAUT, 2000);
    proche(controleur.estimer({ ...DEFAUT, nombre: 3000 }).secondes, 1200);
    proche(controleur.estimer({ ...DEFAUT, nombre: 7, arret: 100000 }).secondes, 1.4);
    // Sans mesure, le seuil est celui d'avant : 10 000 000 mouvements.
    const neuf = await monter({ charges: [chargeDemo('petite-conflit')], executeur: executeurManuel(), lireConstante: lireAvec(5) });
    await refuseSansRien(neuf, 'CONFIRMATION_REQUISE', { estimation: { inconnue: true }, remede: null }, { ...DEFAUT, arret: 2000001 });
    const juste = neuf.controleur.generer({ ...DEFAUT, arret: 2000000 });
    await Promise.resolve();
    assert.equal(neuf.espion.lancements.length, 1);
    neuf.controleur.annuler();
    await rejet(juste);
  });

  test('sans mesure, le seuil compte ρ : la question part plus tôt quand ρ à pleine charge grandit', async () => {
    // 4 processeurs logiques, 4 propositions : une vague, ρ(4) = ρ à pleine charge.
    const reglages = (arret) => ({ graine: 1, nombre: 4, arret, historique: 1000 });
    const sous = await monter({ charges: [chargeDemo('petite-conflit')], executeur: executeurManuel({ coeursDisponibles: 4 }), lireConstante: lireAvec(4) });
    await refuseSansRien(sous, 'CONFIRMATION_REQUISE', { estimation: { inconnue: true }, remede: null }, reglages(2500001));
    const juste = sous.controleur.generer(reglages(2500000));
    await Promise.resolve();
    assert.equal(sous.espion.lancements.length, 1);
    sous.controleur.annuler();
    await rejet(juste);
  });

  test('sans mesure, le seuil ne suit pas les réglages d’une charge neuve : ses 20 propositions partent sur 16 processeurs logiques comme sur 10, demandent confirmation sur 9 comme sur 4', async () => {
    // ρ à pleine charge lu au registre, comme en production, et non injecté :
    // la limite de dix processeurs logiques que la spécification et le guide
    // écrivent suit de ρ = 2 — ⌈20 / 16⌉ × 2 000 000 × 2 = 8 000 000 et
    // ⌈20 / 10⌉ × 2 000 000 × 2 = 8 000 000 ne dépassent pas 10 000 000 ;
    // ⌈20 / 9⌉ × 2 000 000 × 2 = 12 000 000 et ⌈20 / 4⌉ × 2 000 000 × 2 =
    // 20 000 000 le dépassent. Un ρ mesuré autrement fait échouer ces cas,
    // et ces textes sont à revoir avec eux.
    const neuve = () => chargeDe({ n: 4, tables: 2, sieges: 2, tours: 2 });
    const sur = (coeursDisponibles) => monter({ charges: [neuve()], executeur: executeurManuel({ coeursDisponibles }) });
    for (const coeurs of [16, 10]) {
      const montage = await sur(coeurs);
      const proposes = montage.controleur.reglagesProposes();
      assert.deepEqual(proposes, { graine: 1, nombre: 20, arret: 2_000_000, historique: 1_000 }, `${coeurs} processeurs logiques`);
      const lancee = montage.controleur.generer(proposes);
      await Promise.resolve();
      assert.equal(montage.espion.lancements.length, 1, `${coeurs} processeurs logiques`);
      montage.controleur.annuler();
      await rejet(lancee);
    }
    for (const coeurs of [9, 4]) {
      const montage = await sur(coeurs);
      await refuseSansRien(montage, 'CONFIRMATION_REQUISE', { estimation: { inconnue: true }, remede: null }, montage.controleur.reglagesProposes());
    }
    const proposes = { graine: 1, nombre: 1, arret: 10_000_000, historique: 1_000 };
    // Le seuil est exactement 10 000 000 : sur un seul processeur logique,
    // ρ fixé à 2, une proposition de 10 000 001 mouvements demande, une de
    // 10 000 000 part.
    const un = await monter({ charges: [neuve()], executeur: executeurManuel(), lireConstante: lireAvec(2) });
    await refuseSansRien(un, 'CONFIRMATION_REQUISE', { estimation: { inconnue: true }, remede: null }, { ...proposes, nombre: 1, arret: 10_000_001 });
    const juste = un.controleur.generer({ ...proposes, nombre: 1, arret: 10_000_000 });
    await Promise.resolve();
    assert.equal(un.espion.lancements.length, 1);
    un.controleur.annuler();
    await rejet(juste);
  });

  test("ρ se lit au registre à chaque estimation, jamais recopié : la valeur changée par l'épreuve change l'estimation", async () => {
    // Le contrôleur sans lecture injectée lit le registre lui-même.
    const parDefaut = executeurManuel({ coeursDisponibles: 4 });
    const lu = await monter({ charges: [chargeDemo('petite-conflit')], executeur: parDefaut });
    lu.controleur.reglerCoeurs({ automatique: false });
    lu.controleur.reglerCoeurs({ saisie: '1' });
    await genererEn(lu, parDefaut, { ...DEFAUT, nombre: 4 }, 1600);
    lu.controleur.reglerCoeurs({ automatique: true });
    proche(lu.controleur.estimer({ ...DEFAUT, nombre: 4 }).secondes, 0.4 * RHO);

    // Une lecture dont l'épreuve change la valeur entre deux estimations.
    const valeur = { rho: 2 };
    const manuel = executeurManuel({ coeursDisponibles: 4 });
    const montage = await monter({ charges: [chargeDemo('petite-conflit')], executeur: manuel, lireConstante: lireAvec(valeur) });
    const { controleur } = montage;
    controleur.reglerCoeurs({ automatique: false });
    controleur.reglerCoeurs({ saisie: '1' });
    await genererEn(montage, manuel, { ...DEFAUT, nombre: 4 }, 1600);
    controleur.reglerCoeurs({ automatique: true });
    proche(controleur.estimer({ ...DEFAUT, nombre: 4 }).secondes, 0.8);
    valeur.rho = 3.5;
    proche(controleur.estimer({ ...DEFAUT, nombre: 4 }).secondes, 1.4);
    assert.equal(controleur.estimer({ ...DEFAUT, nombre: 4 }).longue, false);
    valeur.rho = 1;
    proche(controleur.estimer({ ...DEFAUT, nombre: 4 }).secondes, 0.4);
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

// --- Objectifs, mode et ordre réglé (§ 5.7, D17, A21) ----------------------------------

describe('génération : objectifs, mode et ordre réglé, par la séance (§ 5.7, D17, A21)', () => {
  // La petite démonstration au conflit inévitable, 1 à 6 « finance », la
  // première table attendant « finance » pour la soirée ; le mode minimum
  // par défaut (sous places, aucun mode écrit) et, sous ordre, un ordre où
  // les tours hors objectif suivent l'écart et où l'excédent et la
  // redondance partagent un palier.
  function chargeAObjectifs({ mode = 'minimum', ordre = true } = {}) {
    const charge = chargeDemo('petite-conflit');
    for (const participant of charge.participants) if (participant.id <= 6) participant.etiquettes = ['finance'];
    const [premiere] = [...charge.tables].sort((a, b) => a.id - b.id);
    premiere.objectifs = [{ portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] }];
    if (mode !== 'places') charge.reglages.modeObjectifs = mode;
    if (ordre) {
      const e = (critere, poids = 1) => ({ critere, poids });
      charge.reglages.priorites = [
        [e('ecartAuPlafondAPrioriMax')],
        [e('toursHorsObjectif')],
        [e('excedentCollisions', 2), e('redondance')],
        [e('collisionsCumulees')],
        [e('rencontresRepetees')],
        [e('animateursNonRencontres')],
        [e('conflitsOrganisation')],
      ];
    }
    return charge;
  }

  test('fil direct, puis groupe de travailleurs à un et à quatre cœurs : le même état écrit, octet pour octet, et les plans de rechercher', async () => {
    const reglages = { graine: 3, nombre: 4, arret: 1500, historique: 1000 };
    const executeurs = [
      ['fil direct', () => creerExecuteurDirect(), null],
      ['un cœur', () => creerExecuteurTravailleur(travailleursCalculants(), { coeursDisponibles: 4 }), 1],
      ['quatre cœurs', () => creerExecuteurTravailleur(travailleursCalculants(), { coeursDisponibles: 4 }), 4],
    ];
    const etats = [];
    for (const [nom, creer, coeurs] of executeurs) {
      const montage = await monter({ charges: [chargeAObjectifs()], executeur: creer() });
      if (coeurs !== null) {
        montage.controleur.reglerCoeurs({ automatique: false });
        montage.controleur.reglerCoeurs({ saisie: String(coeurs) });
      }
      const bilan = await montage.controleur.generer(reglages);
      assert.deepEqual(bilan.ajoutees, [1, 2, 3, 4], nom);
      const configuration = configurationDe(montage.charge());
      assert.equal(configuration.modeObjectifs, 'minimum', nom);
      const attendues = rechercher(configuration, reglages);
      assert.deepEqual(montage.charge().propositions.map(planDepuisFichier), attendues.map((p) => planRange(p, configuration)), nom);
      etats.push(montage.etatDisque());
    }
    assert.equal(etats[1], etats[0]);
    assert.equal(etats[2], etats[0]);
  });

  test('le mode et l’ordre atteignent la recherche, chacun pour sa part : sans le mode, sous le même ordre, ou sans l’ordre, sous le même mode, la même charge rend d’autres plans', () => {
    const reglages = { graine: 3, nombre: 4, arret: 1500 };
    const plans = (charge) => rechercher(configurationDe(charge), reglages).map(({ plan }) => plan);
    const regles = plans(chargeAObjectifs());
    assert.notDeepEqual(regles, plans(chargeAObjectifs({ mode: 'places' })), 'sans le mode');
    assert.notDeepEqual(regles, plans(chargeAObjectifs({ ordre: false })), 'sans l’ordre');
  });
});

// --- La course de la recherche dans la séance (§ 5.10, B6, D40) -------------------------

// La somme des mouvements évalués d'une liste de propositions du moteur.
const sommeEvalues = (propositions) => propositions.reduce((somme, { evalues }) => somme + evalues, 0);

describe('génération : la course, et la génération gardée pour la séance (§ 5.10, B6, D40)', () => {
  const PREMIERE = { graine: 1, nombre: 3, arret: 200, historique: 1000 };

  test("generationDe : durée, cœurs, somme des mouvements évalués de toutes les propositions calculées, identiques comprises, et nombre", async () => {
    const montage = await monter({ charges: [chargeDemo('petite-conflit')] });
    const { controleur } = montage;
    assert.equal(controleur.generationDe(1), null);
    const configuration = configurationDe(montage.charge());
    assert.deepEqual((await controleur.generer(PREMIERE)).ajoutees, [1, 2, 3]);
    const premieres = rechercher(configuration, PREMIERE);
    const resume = { dureeMs: 0, coeurs: 1, evalues: sommeEvalues(premieres), nombre: 3 };
    for (const id of [1, 2, 3]) assert.deepEqual(controleur.generationDe(id), resume, `proposition ${id}`);
    // La seconde génération recalcule les trois premières, identiques et
    // écartées, et ajoute la quatrième, sous l'identifiant 3 + 4 que le
    // compteur lui donne : ses évalués comptent les quatre.
    const seconde = { ...PREMIERE, nombre: 4 };
    const bilan = await controleur.generer(seconde);
    assert.deepEqual([bilan.ajoutees, bilan.identiques], [[7], 3]);
    const toutes = rechercher(configuration, seconde);
    assert.ok(toutes.every(({ evalues }) => evalues > 0));
    assert.deepEqual(controleur.generationDe(7), { dureeMs: 0, coeurs: 1, evalues: sommeEvalues(toutes), nombre: 4 });
    assert.ok(sommeEvalues(toutes) > toutes[3].evalues);
    assert.deepEqual(controleur.generationDe(1), resume);
    for (const id of [4, 5, 6, 8]) assert.equal(controleur.generationDe(id), null, `identifiant ${id}`);
    // Une copie : la modifier ne change pas ce que la séance garde.
    controleur.generationDe(1).dureeMs = 99;
    assert.deepEqual(controleur.generationDe(1), resume);
  });

  test("la proposition passe à enregistrerGeneration avec sa course, telle que le moteur la rend ; ni durée ni cadence n'atteignent le fichier", async () => {
    const montage = await monter({ charges: [chargeDemo('petite-conflit')] });
    const { seance, controleur, horloge } = montage;
    const executer = seance.executer;
    const recus = [];
    seance.executer = (nom, args) => {
      recus.push({ nom, args });
      return executer(nom, args);
    };
    controleur.subscribe(({ fait }) => {
      if (fait > 0) horloge.avancer(7);
    });
    await controleur.generer({ ...PREMIERE, arret: 2_000 });
    const configuration = configurationDe(montage.charge());
    const attendues = rechercher(configuration, { ...PREMIERE, arret: 2_000 });
    assert.deepEqual(recus.map(({ nom }) => nom), ['enregistrerGeneration']);
    assert.deepStrictEqual(recus[0].args.propositions, attendues);
    assert.ok(attendues.every(({ releves }) => releves.length === 4));
    assert.ok(controleur.generationDe(1).dureeMs > 0);
    const etat = montage.etatDisque();
    for (const mot of ['dureeMs', 'cadence', 'coeurs']) {
      assert.equal(etat.includes(mot), false, mot);
      assert.equal(JSON.stringify(montage.journal()).includes(mot), false, mot);
    }
  });

  test("horloge pilotée : la durée gardée est exactement l'avance donnée pendant le calcul, la même pour chaque proposition de la génération, et 0 sans avance", async () => {
    for (const pas of [0, 1, 1000]) {
      const montage = await monter({ charges: [chargeDemo('petite-conflit')] });
      let dernier = 0;
      montage.controleur.subscribe(({ fait }) => {
        if (fait > dernier) {
          dernier = fait;
          montage.horloge.avancer(pas);
        }
      });
      await montage.controleur.generer({ graine: 11, nombre: 2, arret: 5000, historique: 1000 });
      assert.equal(montage.controleur.generationDe(1).dureeMs, 10 * pas, `pas ${pas}`);
      assert.equal(montage.controleur.generationDe(2).dureeMs, 10 * pas, `pas ${pas}`);
    }
  });

  test("annulée, une génération ne garde rien : la suivante, aux mêmes réglages, garde sa seule durée", async () => {
    const manuel = executeurManuel({ differer: true });
    const montage = await monter({ charges: [chargeDemo('petite-conflit')], executeur: manuel });
    const enCours = montage.controleur.generer(PREMIERE);
    await Promise.resolve();
    montage.horloge.avancer(500);
    montage.controleur.annuler();
    manuel.executions[0].resoudreParLeMoteur();
    assert.ok((await rejet(enCours)) instanceof ErreurAnnulee);
    for (const id of [1, 2, 3]) assert.equal(montage.controleur.generationDe(id), null);
    const suivante = montage.controleur.generer(PREMIERE);
    await Promise.resolve();
    manuel.executions[1].resoudreParLeMoteur();
    assert.deepEqual((await suivante).ajoutees, [1, 2, 3]);
    const configuration = configurationDe(montage.charge());
    assert.deepEqual(montage.controleur.generationDe(1), {
      dureeMs: 0,
      coeurs: 1,
      evalues: sommeEvalues(rechercher(configuration, PREMIERE)),
      nombre: 3,
    });
  });

  test("les exécuteurs direct et à fils rendent la même course à la séance, quel que soit l'ordre d'achèvement des fils", async () => {
    const executeurs = [
      ['direct', () => creerExecuteurDirect(), null],
      ['quatre cœurs à rebours', () => creerExecuteurTravailleur(travailleursCalculants(A_REBOURS), { coeursDisponibles: 4 }), 4],
      [
        "quatre cœurs, le milieu d'abord",
        () => creerExecuteurTravailleur(travailleursCalculants(MILIEU_D_ABORD), { coeursDisponibles: 4 }),
        4,
      ],
    ];
    const recus = [];
    for (const [nom, creer, coeurs] of executeurs) {
      const montage = await monter({ charges: [chargeDemo('petite-conflit')], executeur: creer() });
      if (coeurs !== null) {
        montage.controleur.reglerCoeurs({ automatique: false });
        montage.controleur.reglerCoeurs({ saisie: String(coeurs) });
      }
      const executer = montage.seance.executer;
      montage.seance.executer = (commande, args) => {
        recus.push(args.propositions);
        return executer(commande, args);
      };
      await montage.controleur.generer({ graine: 4, nombre: 4, arret: 1_500, historique: 100 });
      const { evalues, nombre } = montage.controleur.generationDe(1);
      assert.deepEqual([evalues, nombre], [sommeEvalues(recus.at(-1)), 4], nom);
    }
    assert.equal(recus.length, 3);
    assert.deepStrictEqual(recus[1], recus[0]);
    assert.deepStrictEqual(recus[2], recus[0]);
    assert.ok(recus[0].every(({ releves }) => releves.length === 4));
  });

  test("fermer l'événement, puis le rouvrir, ou en ouvrir un autre, vide ce que la séance garde", async () => {
    const montage = await monter({ charges: [chargeDemo('petite-conflit'), chargeDemo('petite-conflit', AUTRE)] });
    const { seance, controleur } = montage;
    await controleur.generer(PREMIERE);
    assert.notEqual(controleur.generationDe(1), null);
    await seance.fermer();
    assert.equal(controleur.generationDe(1), null);
    await seance.ouvrir(cleEvenement(NOM, NOM));
    assert.equal(montage.charge().propositions.length, 3);
    assert.equal(controleur.generationDe(1), null);
    await seance.passerEnEcriture();
    await controleur.generer({ ...PREMIERE, graine: 2 });
    assert.notEqual(controleur.generationDe(4), null);
    await seance.ouvrir(cleEvenement(AUTRE, AUTRE));
    assert.equal(controleur.generationDe(4), null);
  });

  test("ouvrir la copie à la main d'un dossier, sous la même base, ouvre un autre événement : la graine repart de 1, les générations gardées s'oublient", async () => {
    const montage = await monter({ charges: [chargeDemo('petite-conflit')] });
    const { fs, seance, controleur } = montage;
    await controleur.generer({ ...PREMIERE, graine: 7 });
    assert.equal(controleur.grainePropose(), 8);
    assert.notEqual(controleur.generationDe(1), null);
    // La copie porte les fichiers mêmes : mêmes propositions, même
    // identifiant d'événement, même base ; seul son dossier diffère.
    const copie = `${NOM} - Copie`;
    for (const suffixe of [SUFFIXES.etat, SUFFIXES.journal]) {
      fs.deposer('documents', `${copie}/${NOM}${suffixe}`, fs.contenu('documents', `${NOM}/${NOM}${suffixe}`));
    }
    await seance.ouvrir(cleEvenement(copie, NOM));
    assert.deepEqual([seance.etat().evenement.cle, seance.etat().evenement.base], [cleEvenement(copie, NOM), NOM]);
    assert.equal(montage.charge().propositions.length, 3);
    assert.equal(controleur.grainePropose(), 1);
    assert.equal(controleur.generationDe(1), null);
  });

  test("une autre proposition sous le même identifiant, adoptée d'une relecture, n'a pas de génération ; la même, revenue par un retour, garde la sienne", async () => {
    const reglages = { graine: 1, nombre: 1, arret: 200, historique: 1000 };
    const montage = await monter({ charges: [chargeDemo('petite-conflit')] });
    const { seance, controleur } = montage;
    // Le retour à l'instant d'avant retire la proposition 1 ; le retour à
    // l'instant d'après la rend, la même : sa génération la suit.
    const avant = montage.journal().entrees.at(-1).revision;
    await controleur.generer(reglages);
    const apres = montage.journal().entrees.at(-1).revision;
    const gardee = controleur.generationDe(1);
    assert.notEqual(gardee, null);
    await seance.revenir(avant);
    assert.deepEqual(montage.charge().propositions, []);
    assert.equal(controleur.generationDe(1), null);
    await seance.revenir(apres);
    assert.deepEqual(controleur.generationDe(1), gardee);
    // Une autre séance, sur un autre support, a produit sa proposition 1
    // sous d'autres réglages ; ses fichiers remplacent ceux-ci pendant la
    // lecture, et le passage en écriture les relit. Chacun des trois champs
    // contrôlés, seul à différer, suffit à refuser la génération gardée.
    const [originale] = rechercher(configurationDe(montage.charge()), reglages);
    for (const [champ, autres] of [
      ['graine', { ...reglages, graine: 2 }],
      ['arret', { ...reglages, arret: 300 }],
      ['historique', { ...reglages, historique: 500 }],
    ]) {
      const ici = await monter({ charges: [chargeDemo('petite-conflit')] });
      await ici.controleur.generer(reglages);
      assert.notEqual(ici.controleur.generationDe(1), null, champ);
      const ailleurs = await monter({ charges: [chargeDemo('petite-conflit')] });
      await ailleurs.controleur.generer(autres);
      await ailleurs.seance.fermer();
      await ici.seance.passerEnLecture();
      for (const suffixe of [SUFFIXES.etat, SUFFIXES.precedent, SUFFIXES.journal]) {
        ici.fs.deposer('documents', `${NOM}/${NOM}${suffixe}`, ailleurs.fs.contenu('documents', `${NOM}/${NOM}${suffixe}`));
      }
      await ici.seance.passerEnEcriture();
      const [relue] = ici.charge().propositions;
      assert.equal(relue.id, 1, champ);
      for (const cle of ['graine', 'arret', 'historique']) {
        assert.equal(relue[cle] === originale[cle], cle !== champ, `${champ} : ${cle}`);
      }
      assert.equal(ici.controleur.generationDe(1), null, champ);
    }
  });
});

// --- La génération dérivée (§ 5.7, § 5.10, C6, C8, C24) ---------------------------------

// Le plan d'un départ loin du plan parfait : la première proposition de la
// petite démonstration à un compte court, sous la graine donnée.
const planCourt = (graine) => rechercher(configurationDe(chargeDemo('petite')), { graine, arret: 40, nombre: 1 })[0].plan;

// La petite démonstration, plan proposé, qui porte les propositions données,
// chacune [id, plan, derivation] mise en forme de fichier par versFichier —
// derivation {depart, toursFiges}, absente pour une proposition ordinaire ;
// le compteur passe au-delà de la dernière. attribuerSieges règle
// l'événement et chaque proposition.
function chargeAvecPropositions(entrees, { attribuerSieges = false } = {}) {
  const charge = chargeDemo('petite');
  charge.evenement.etat = 'propose';
  charge.reglages.attribuerSieges = attribuerSieges;
  const configuration = configurationDe(charge);
  charge.propositions = entrees.map(([id, plan, derivation = null]) =>
    versFichier({ id, graine: 4_000 + id, arret: 40, historique: 1000, plan }, configuration, {
      produitVersion: V1,
      attribuerSieges,
      decalage: 0,
      derivation,
    }),
  );
  charge.prochainsIds.proposition = Math.max(...entrees.map(([id]) => id)) + 1;
  return charge;
}

// Le départ que le moteur reçoit pour la proposition id de la charge : sans
// changement de participants, le plan du départ et aucune réserve imposée.
const departRecherche = (charge, id, toursFiges) => ({ plan: planDuDepart(charge, id), toursFiges, reservesImposees: [] });

// Remplace executer de la séance par un espion qui note chaque commande, ses
// arguments compris, avant de la confier à la séance ; rend la liste notée.
function espionnerExecuter(seance) {
  const recus = [];
  const executer = seance.executer;
  seance.executer = (nom, args) => {
    recus.push({ nom, args });
    return executer(nom, args);
  };
  return recus;
}

// Le refus d'une génération dérivée, avant tout lancement et toute écriture.
async function refuseSousDepart(montage, depart, code, details, reglages = COURT) {
  const avant = montage.fs.compteurs.ecritures;
  const leve = await refuse(montage.controleur.generer(reglages, { depart }), code, details);
  assert.equal(montage.fs.compteurs.ecritures, avant, `${code} : une écriture`);
  assert.equal(montage.espion.lancements.length, 0, `${code} : lancé`);
  return leve;
}

const REPARTIR_DE_ZERO = { geste: 'repartirDeZero' };
const DERIVEE = { graine: 3, nombre: 2, arret: 300, historique: 50 };

describe('génération dérivée : les refus du lancement (§ 5.7, C6, C24)', () => {
  test('une génération dérivée refuse avant tout calcul : départ absent, en dérive, réservation non tenue, tous les tours figés, un tour hors de la soirée', async () => {
    const charge = () => chargeAvecPropositions([[4, PLAN_PARFAIT_PETITE]]);
    const absent = await monter({ charges: [charge()] });
    await refuseSousDepart(absent, { id: 9, toursFiges: [] }, 'DEPART_ABSENT', { depart: 9, remede: REPARTIR_DE_ZERO });
    const tous = await monter({ charges: [charge()] });
    await refuseSousDepart(tous, { id: 4, toursFiges: [1, 2, 3, 4] }, 'TOURS_FIGES_TOUS', { tours: 4, remede: null });
    const horsSoiree = await monter({ charges: [charge()] });
    await refuseSousDepart(horsSoiree, { id: 4, toursFiges: [2, 5] }, 'TOUR_FIGE_HORS_SOIREE', {
      tour: 5,
      tours: 4,
      remede: { geste: 'libererTour', tour: 5 },
    });
    // Une table agrandie après le départ, et une personne exclue : il est en
    // dérive, et seule la raison du mobilier est nommée.
    const enDerive = await monter({ charges: [charge()] });
    await enDerive.seance.executer('exclureParticipant', { id: 12 });
    await enDerive.seance.executer('changerPlacesTable', { id: 1, sieges: 4, origine: 'champ' });
    const refusEnDerive = await refuseSousDepart(enDerive, { id: 4, toursFiges: [] }, 'DEPART_NON_COMPARABLE');
    assert.deepEqual(
      [refusEnDerive.details.depart, refusEnDerive.details.statut, refusEnDerive.details.remede],
      [4, 'derive', REPARTIR_DE_ZERO],
    );
    assert.deepEqual(refusEnDerive.details.raisons.map(({ code }) => code), ['CAPACITE_CHANGEE']);
    // Une réservation posée après le départ, à une table où il ne l'assied
    // pas, dans un tour qu'il ne fige pas.
    const reservee = await monter({ charges: [charge()] });
    await reservee.seance.executer('reserver', { participant: 1, table: 2, portee: 'tous' });
    const nonTenue = await refuseSousDepart(reservee, { id: 4, toursFiges: [3] }, 'DEPART_RESERVATION_NON_TENUE');
    assert.deepEqual(
      [nonTenue.details.depart, nonTenue.details.participant, nonTenue.details.table, nonTenue.details.tour, nonTenue.details.remede],
      [4, 1, 2, 1, REPARTIR_DE_ZERO],
    );
  });

  test('une réservation à un siège posée après le départ, dans un tour figé, est refusée au lancement ; ce tour libéré, la génération part', async () => {
    const manuel = executeurManuel();
    const charge = chargeAvecPropositions([[4, PLAN_PARFAIT_PETITE]], { attribuerSieges: true });
    const montage = await monter({ charges: [charge], executeur: manuel });
    // Au tour 1, le départ assied 1 au siège 1 de la table 1.
    await montage.seance.executer('reserver', { participant: 1, table: 1, siege: 2, portee: 'tour', tour: 1 });
    const leve = await refuseSousDepart(montage, { id: 4, toursFiges: [1] }, 'DEPART_SIEGE_NON_TENU');
    assert.deepEqual(
      [leve.details.depart, leve.details.participant, leve.details.table, leve.details.siege, leve.details.tour, leve.details.remede],
      [4, 1, 1, 2, 1, { geste: 'libererTour', tour: 1 }],
    );
    const enCours = montage.controleur.generer(COURT, { depart: { id: 4, toursFiges: [2] } });
    await Promise.resolve();
    assert.equal(montage.espion.lancements.length, 1);
    assert.deepEqual(montage.espion.lancements[0].options.depart, departRecherche(montage.charge(), 4, [2]));
    montage.controleur.annuler();
    assert.ok((await rejet(enCours)) instanceof ErreurAnnulee);
  });

  test('en lecture, sur un plan bloqué, avec des places manquantes ou un réglage hors domaine : le refus ordinaire passe avant celui du départ ; celui du départ avant la confirmation', async () => {
    const absent = { id: 9, toursFiges: [] };
    const lecture = await monter({ charges: [chargeAvecPropositions([[4, PLAN_PARFAIT_PETITE]])], ecriture: false });
    await refuseSousDepart(lecture, absent, 'MODE_LECTURE', { remede: { geste: 'modifier' } });
    const bloquee = chargeAvecPropositions([[4, PLAN_PARFAIT_PETITE]]);
    bloquee.evenement.etat = 'bloque';
    await refuseSousDepart(await monter({ charges: [bloquee], ecriture: false }), absent, 'LECTURE_SEULE', {
      raison: 'BLOQUE',
      remede: { geste: 'debloquer' },
    });
    await refuseSousDepart(await monter({ charges: [chargeDe({ n: 13, tables: 4, sieges: 3 })] }), absent, 'PLACES_MANQUANTES', {
      placesManquantes: 1,
      remede: VERS_TABLES,
    });
    const reglage = await monter({ charges: [chargeAvecPropositions([[4, PLAN_PARFAIT_PETITE]])] });
    await refuseSousDepart(reglage, absent, 'REGLAGE_HORS_DOMAINE', { reglage: 'graine', remede: null }, { ...COURT, graine: -1 });
    // Sans mesure, au-delà de 10 000 000 mouvements : la confirmation suit le départ.
    const longue = { graine: 1, nombre: 5, arret: 2000001, historique: 1000 };
    const confirmation = await monter({ charges: [chargeAvecPropositions([[4, PLAN_PARFAIT_PETITE]])] });
    await refuseSousDepart(confirmation, absent, 'DEPART_ABSENT', { depart: 9, remede: REPARTIR_DE_ZERO }, longue);
    await refuseSousDepart(confirmation, { id: 4, toursFiges: [] }, 'CONFIRMATION_REQUISE', {
      estimation: { inconnue: true },
      remede: null,
    }, longue);
  });

  test("des tours figés d'une autre forme qu'une liste d'entiers ≥ 1 strictement croissante lèvent une TypeError, après le refus de la séance, sans lancement ni écriture", async () => {
    const charge = () => chargeAvecPropositions([[4, PLAN_PARFAIT_PETITE]]);
    for (const depart of [{ id: 4, toursFiges: [2, 1] }, { id: 4, toursFiges: [0] }, { id: 4, toursFiges: [1.5] }, { id: 4 }]) {
      const montage = await monter({ charges: [charge()] });
      const avant = montage.fs.compteurs.ecritures;
      const leve = await rejet(montage.controleur.generer(COURT, { depart }));
      assert.ok(leve instanceof TypeError, `${JSON.stringify(depart)} : TypeError attendue, reçu ${leve}`);
      assert.equal(montage.fs.compteurs.ecritures, avant, `${JSON.stringify(depart)} : une écriture`);
      assert.equal(montage.espion.lancements.length, 0, `${JSON.stringify(depart)} : lancé`);
      const lecture = await monter({ charges: [charge()], ecriture: false });
      await refuseSousDepart(lecture, depart, 'MODE_LECTURE', { remede: { geste: 'modifier' } });
    }
  });

  test('une génération en cours passe avant le refus du départ', async () => {
    const manuel = executeurManuel({ differer: true });
    const montage = await monter({ charges: [chargeAvecPropositions([[4, PLAN_PARFAIT_PETITE]])], executeur: manuel });
    const premiere = montage.controleur.generer(COURT);
    await Promise.resolve();
    await refuse(montage.controleur.generer(COURT, { depart: { id: 9, toursFiges: [] } }), 'GENERATION_EN_COURS', { remede: null });
    assert.equal(montage.espion.lancements.length, 1);
    montage.controleur.annuler();
    manuel.executions[0].rejeter(new ErreurAnnulee());
    assert.ok((await rejet(premiere)) instanceof ErreurAnnulee);
  });
});

describe('génération dérivée : le lancement, la forme rendue, les identiques (§ 5.7, § 5.10, C6, C8)', () => {
  test('lancer reçoit le plan du départ et ses tours figés ; enregistrerGeneration, la dérivation ; la génération suivante sans départ est ordinaire, le contrôleur ne garde rien du départ', async () => {
    const montage = await monter({ charges: [chargeAvecPropositions([[4, planCourt(5)]])] });
    const recus = espionnerExecuter(montage.seance);
    const configuration = configurationDe(montage.charge());
    const depart = departRecherche(montage.charge(), 4, [2]);
    const derivee = await montage.controleur.generer(DERIVEE, { depart: { id: 4, toursFiges: [2] } });
    assert.deepEqual(montage.espion.lancements[0].options, { coeurs: 1, depart });
    assert.deepEqual(derivee.depart, { id: 4, toursFiges: [2] });
    assert.deepEqual([derivee.ajoutees, derivee.identiques, derivee.identiquesAuDepart], [[5, 6], 0, 0]);
    assert.deepEqual(recus.map(({ nom }) => nom), ['enregistrerGeneration']);
    assert.deepStrictEqual(recus[0].args.propositions, repartir(configuration, DERIVEE, depart));
    assert.deepEqual(recus[0].args.derivation, { depart: 4, toursFiges: [2] });
    const ordinaire = await montage.controleur.generer(DERIVEE);
    assert.deepEqual(montage.espion.lancements[1].options, { coeurs: 1 });
    assert.deepEqual([ordinaire.depart, ordinaire.identiquesAuDepart], [null, 0]);
    assert.equal(recus.length, 2);
    assert.equal(Object.hasOwn(recus[1].args, 'derivation'), false);
    assert.deepStrictEqual(recus[1].args.propositions, rechercher(configuration, DERIVEE));
  });

  test('la dérivée du plan parfait de la petite démonstration est écartée comme identique à son départ, sans tour figé comme tour 1 figé : rien d’écrit', async () => {
    const montage = await monter({ charges: [chargeAvecPropositions([[4, PLAN_PARFAIT_PETITE]])] });
    const reglages = { graine: 6, nombre: 3, arret: 3_000, historique: 20 };
    for (const toursFiges of [[], [1]]) {
      const ecritures = montage.fs.compteurs.ecritures;
      const bilan = await montage.controleur.generer(reglages, { depart: { id: 4, toursFiges } });
      assert.deepEqual(
        [bilan.ajoutees, bilan.identiques, bilan.identiquesAuDepart, bilan.depart],
        [[], 3, 3, { id: 4, toursFiges }],
        `figés ${toursFiges}`,
      );
      assert.equal(montage.fs.compteurs.ecritures, ecritures);
    }
    assert.deepEqual(ids(montage.charge()), [4]);
  });

  test('une dérivée identique à une autre proposition présente, non à son départ, compte dans identiques, jamais dans identiquesAuDepart', async () => {
    const depart = planCourt(5);
    const reglages = { graine: 8, nombre: 1, arret: 300, historique: 50 };
    const [{ plan: derivee }] = repartir(
      configurationDe(chargeDemo('petite')),
      reglages,
      departRecherche(chargeAvecPropositions([[4, depart]]), 4, []),
    );
    const charge = chargeAvecPropositions([[4, depart], [5, derivee]]);
    assert.notDeepEqual(planDuDepart(charge, 5), planDuDepart(charge, 4));
    const montage = await monter({ charges: [charge] });
    const bilan = await montage.controleur.generer(reglages, { depart: { id: 4, toursFiges: [] } });
    assert.deepEqual([bilan.ajoutees, bilan.identiques, bilan.identiquesAuDepart], [[], 1, 0]);
  });

  test('trois dérivées, l’une égale à son départ, l’autre à une proposition présente : identiques 2, dont 1 au départ ; la troisième ajoutée', async () => {
    const autre = planCourt(7);
    const charge = chargeAvecPropositions([[4, planCourt(5)], [5, autre]]);
    const planDepart = planDuDepart(charge, 4);
    const montage = await monter({
      charges: [charge],
      executeur: executeurTransforme(([premiere, seconde, troisieme]) => [
        { ...premiere, plan: planDepart },
        { ...seconde, plan: autre },
        troisieme,
      ]),
    });
    const bilan = await montage.controleur.generer({ ...DERIVEE, nombre: 3 }, { depart: { id: 4, toursFiges: [1] } });
    assert.deepEqual([bilan.ajoutees, bilan.identiques, bilan.identiquesAuDepart], [[8], 2, 1]);
  });

  test('relancée depuis le même départ sous une autre graine, la génération repart du même plan ; generationDe dit la génération de chaque dérivée', async () => {
    const montage = await monter({ charges: [chargeAvecPropositions([[4, planCourt(5)]])] });
    const configuration = configurationDe(montage.charge());
    const depart = departRecherche(montage.charge(), 4, [1]);
    const premiere = await montage.controleur.generer({ ...DERIVEE, graine: 1 }, { depart: { id: 4, toursFiges: [1] } });
    const seconde = await montage.controleur.generer({ ...DERIVEE, graine: 2 }, { depart: { id: 4, toursFiges: [1] } });
    assert.deepEqual([premiere.ajoutees, seconde.ajoutees], [[5, 6], [7, 8]]);
    assert.deepEqual(montage.espion.lancements.map(({ options }) => options), [{ coeurs: 1, depart }, { coeurs: 1, depart }]);
    assert.equal(montage.controleur.grainePropose(), 3);
    for (const [graine, ajoutees] of [[1, [5, 6]], [2, [7, 8]]]) {
      const calculees = repartir(configuration, { ...DERIVEE, graine }, depart);
      for (const id of ajoutees) {
        assert.deepEqual(montage.controleur.generationDe(id), { dureeMs: 0, coeurs: 1, evalues: sommeEvalues(calculees), nombre: 2 }, `n° ${id}`);
      }
    }
  });

  test('annulée, une génération dérivée ne garde rien : ni écriture, ni génération', async () => {
    const manuel = executeurManuel();
    const montage = await monter({ charges: [chargeAvecPropositions([[4, planCourt(5)]])], executeur: manuel });
    const ecritures = montage.fs.compteurs.ecritures;
    const enCours = montage.controleur.generer(DERIVEE, { depart: { id: 4, toursFiges: [2] } });
    await Promise.resolve();
    assert.deepEqual(montage.espion.lancements[0].options.depart, departRecherche(montage.charge(), 4, [2]));
    montage.controleur.annuler();
    assert.ok((await rejet(enCours)) instanceof ErreurAnnulee);
    assert.equal(montage.fs.compteurs.ecritures, ecritures);
    assert.deepEqual(ids(montage.charge()), [4]);
    assert.equal(montage.controleur.generationDe(5), null);
  });

  test('un départ qui est lui-même une dérivée, son propre départ présent ou non : aucun refus, le moteur reçoit son plan', async () => {
    for (const entrees of [
      [[1, planCourt(5)], [2, planCourt(7), { depart: 1, toursFiges: [1] }]],
      [[2, planCourt(7), { depart: 1, toursFiges: [1] }]],
    ]) {
      const manuel = executeurManuel();
      const montage = await monter({ charges: [chargeAvecPropositions(entrees)], executeur: manuel });
      const enCours = montage.controleur.generer(DERIVEE, { depart: { id: 2, toursFiges: [3] } });
      await Promise.resolve();
      assert.equal(montage.espion.lancements.length, 1, JSON.stringify(entrees.map(([id]) => id)));
      assert.deepEqual(montage.espion.lancements[0].options.depart, departRecherche(montage.charge(), 2, [3]));
      montage.controleur.annuler();
      assert.ok((await rejet(enCours)) instanceof ErreurAnnulee);
    }
  });

  test('à départ, tours figés et graine égaux, l’exécuteur direct et l’exécuteur à fils rendent les mêmes propositions, quel que soit l’ordre d’achèvement des fils', async () => {
    const reglages = { graine: 4, nombre: 4, arret: 1_500, historique: 100 };
    const recus = [];
    let attendues = null;
    for (const [nom, creer, coeurs] of [
      ['direct', () => creerExecuteurDirect(), null],
      ['un cœur', () => creerExecuteurTravailleur(travailleursCalculants(), { coeursDisponibles: 4 }), 1],
      ['quatre cœurs à rebours', () => creerExecuteurTravailleur(travailleursCalculants(A_REBOURS), { coeursDisponibles: 4 }), 4],
      [
        "quatre cœurs, le milieu d'abord",
        () => creerExecuteurTravailleur(travailleursCalculants(MILIEU_D_ABORD), { coeursDisponibles: 4 }),
        4,
      ],
    ]) {
      const montage = await monter({ charges: [chargeAvecPropositions([[4, planCourt(5)]])], executeur: creer() });
      if (coeurs !== null) {
        montage.controleur.reglerCoeurs({ automatique: false });
        montage.controleur.reglerCoeurs({ saisie: String(coeurs) });
      }
      const notes = espionnerExecuter(montage.seance);
      const bilan = await montage.controleur.generer(reglages, { depart: { id: 4, toursFiges: [2, 3] } });
      assert.deepEqual(bilan.ajoutees, [5, 6, 7, 8], nom);
      attendues ??= repartir(configurationDe(montage.charge()), reglages, departRecherche(montage.charge(), 4, [2, 3]));
      recus.push([nom, notes[0].args.propositions]);
    }
    assert.equal(recus.length, 4);
    for (const [nom, propositions] of recus) assert.deepStrictEqual(propositions, attendues, nom);
    assert.notDeepEqual(
      attendues.map(({ plan }) => plan),
      rechercher(configurationDe(chargeDemo('petite')), reglages).map(({ plan }) => plan),
    );
  });
});

// --- Le départ en dérive par ses participants (§ 5.7) ---------------------------

// Une personne inventée de la petite démonstration, présente aux tours donnés.
const inventee = (id, presence) => ({
  id,
  nom: 'Pimprenelle',
  prenom: 'Aurèle',
  organisation: null,
  courriel: null,
  titrePressenti: null,
  notes: null,
  exclu: false,
  presence,
});

// La petite démonstration, son plan parfait proposé sous le n° 4, sièges
// attribués ou non : la personne 12 absente au tour 1, et la n° 13,
// présente au seul tour 1, réservée à ce tour par reservation ({table,
// siege}).
function chargeAuTour1(reservation, { attribuerSieges = false } = {}) {
  const charge = chargeAvecPropositions([[4, PLAN_PARFAIT_PETITE]], { attribuerSieges });
  charge.participants.find(({ id }) => id === 12).presence = [2, 3, 4];
  charge.participants.push(inventee(13, [1]));
  charge.prochainsIds.participant = 14;
  charge.reservations = [{ participant: 13, table: reservation.table, siege: reservation.siege, portee: 'tour', tour: 1 }];
  return charge;
}

// Les propositions ajoutées d'une issue, lues dans la charge.
const ajouteesDe = (charge, issue) => issue.ajoutees.map((id) => charge.propositions.find((p) => p.id === id));

describe('génération dérivée : un départ en dérive par ses participants (§ 5.7)', () => {
  test('la boucle complète : retenir n° 4, réduire une présence aux tours 1 et 2, ajouter une personne aux tours 3 et 4, en exclure une, générer depuis n° 4, tours 1 et 2 figés', async () => {
    const montage = await monter({ charges: [chargeAvecPropositions([[4, planCourt(5)]])] });
    const { seance, controleur } = montage;
    await seance.executer('retenirProposition', { id: 4 });
    await seance.executer('changerPresence', { id: 3, tours: [1, 2] });
    await seance.executer('ajouterParticipant', { champs: { nom: 'Pimprenelle', prenom: 'Aurèle' }, presence: [3, 4] });
    await seance.executer('exclureParticipant', { id: 7 });
    const charge = montage.charge();
    const arrivante = charge.participants.at(-1).id;
    const toursFiges = [1, 2];
    const depart = departDuMoteur(charge, { id: 4, toursFiges });
    const recus = espionnerExecuter(seance);
    const issue = await controleur.generer({ ...DERIVEE, nombre: 4 }, { depart: { id: 4, toursFiges } });
    assert.ok(issue.ajoutees.length > 0);
    assert.deepEqual(montage.espion.lancements[0].options.depart, depart);
    assert.deepEqual(
      [issue.departEnDerive, issue.identiquesAuDepart, issue.avertissements],
      [true, 0, []],
      'le retenu, seulement ajusté à la présence, ne diffère pas du départ ajusté',
    );
    assert.deepEqual(
      issue.ecarts.map(({ participant, entrees, entreesFigees, enReserveFigee, sorties }) => [participant, entrees, entreesFigees, enReserveFigee, sorties]),
      [
        [3, [], [], [], [3, 4]],
        [7, [], [], [], [1, 2, 3, 4]],
        [arrivante, [3, 4], [], [], []],
      ],
    );
    const apres = montage.charge();
    const table = evaluer(apres);
    const adapte = departAdapte(apres, 4);
    for (const derivee of ajouteesDe(apres, issue)) {
      const ici = `n° ${derivee.id}`;
      assert.equal(table.propositions.find(({ id }) => id === derivee.id).statut, 'comparable', ici);
      assert.equal(tourFigeDifferent(derivee, adapte, toursFiges), null, ici);
      const assis = (personne, tour) => derivee.placement[tour - 1].sieges.flat().includes(personne);
      const absente = (personne, tour) => (derivee.placement[tour - 1].absents ?? []).includes(personne);
      assert.deepEqual([1, 2, 3, 4].map((tour) => [assis(3, tour), absente(3, tour)]), [[true, false], [true, false], [false, true], [false, true]], ici);
      assert.deepEqual([1, 2, 3, 4].map((tour) => [assis(arrivante, tour), absente(arrivante, tour)]), [[false, true], [false, true], [true, false], [true, false]], ici);
      assert.equal(derivee.participants.includes(7), false, ici);
      // Les rencontres de la partante sont celles des tours figés.
      const compagnons = new Map();
      for (const tour of toursFiges) {
        const liste = derivee.placement[tour - 1].sieges.find((candidate) => candidate.includes(3));
        for (const autre of liste) if (autre !== 3) compagnons.set(autre, (compagnons.get(autre) ?? 0) + 1);
      }
      const lignes = rencontresDePersonne(apres, derivee.id, 3).lignes;
      assert.deepEqual(new Map(lignes.map(({ id, fois }) => [id, fois])), compagnons, ici);
    }
    // Une paire du tour 1, figé, que le tour 3 réunit compte deux fois : la
    // première dérivée, sa paire du tour 1 réunie au tour 3 par un échange.
    const [derivee] = ajouteesDe(apres, issue);
    const [a, b] = derivee.placement[0].sieges.find((liste) => !liste.includes(3));
    const reunie = structuredClone(derivee);
    const tour3 = reunie.placement[2].sieges;
    const tableDeA = tour3.find((liste) => liste.includes(a));
    const tableDeB = tour3.find((liste) => liste.includes(b));
    if (tableDeA !== tableDeB) {
      const c = tableDeA.find((id) => id !== a);
      tableDeA[tableDeA.indexOf(c)] = b;
      tableDeB[tableDeB.indexOf(b)] = c;
    }
    const avecReunie = { ...apres, propositions: [...apres.propositions, { ...reunie, id: apres.prochainsIds.proposition }] };
    const ligne = rencontresDePersonne(avecReunie, apres.prochainsIds.proposition, a).lignes.find(({ id }) => id === b);
    assert.equal(ligne.fois, 2, JSON.stringify(ligne));
    // Les tours de la ligne sont des index, à partir de 0.
    assert.deepEqual(ligne.tours.map(({ tour }) => tour), [0, 2]);
    // À départ égal, la régénération rend le plan de chaque proposition.
    const configuration = configurationDe(charge);
    for (const { graine, arret, historique, plan } of recus[0].args.propositions) {
      assert.deepEqual(
        regenerer(configuration, { graine, arret, historique, depart: 4, toursFiges }, { planDuDepart: depart.plan, reservesImposees: depart.reservesImposees }),
        plan,
      );
    }
  });

  test('PLACES_MANQUANTES se juge tour par tour : une salle juste pleine, une arrivante aux tours 3 et 4, refuse en nommant ces tours ; une partante à ces tours, et la génération part', async () => {
    const pleine = chargeDemo('petite');
    pleine.participants.push(inventee(13, [3, 4]));
    pleine.prochainsIds.participant = 14;
    await refuse((await monter({ charges: [pleine] })).controleur.generer(COURT), 'PLACES_MANQUANTES', {
      placesManquantes: 1,
      tours: [{ tour: 3, manque: 1 }, { tour: 4, manque: 1 }],
      remede: VERS_TABLES,
    });
    pleine.participants[0].presence = [1, 2];
    const issue = await (await monter({ charges: [pleine] })).controleur.generer(COURT);
    assert.deepEqual(issue.ajoutees, [1]);
  });

  test('une arrivante réservée à une table pleine d’un tour figé reste en réserve à ce tour, chacun gardant sa chaise ; l’issue l’annonce ; les planchers ne valent plus', async () => {
    for (const attribuerSieges of [false, true]) {
      const ici = `sièges attribués : ${attribuerSieges}`;
      const montage = await monter({ charges: [chargeAuTour1({ table: 1, siege: null }, { attribuerSieges })] });
      const charge = montage.charge();
      const issue = await montage.controleur.generer(DERIVEE, { depart: { id: 4, toursFiges: [1] } });
      assert.ok(issue.ajoutees.length > 0, ici);
      assert.deepEqual(issue.ecarts, [
        { participant: 12, personne: nomAffiche(charge.participants[11]), entrees: [], entreesFigees: [], enReserveFigee: [], sorties: [1] },
        { participant: 13, personne: 'Aurèle Pimprenelle', entrees: [], entreesFigees: [], enReserveFigee: [{ tour: 1, cause: 'table' }], sorties: [] },
      ], ici);
      const apres = montage.charge();
      const adapte = departAdapte(apres, 4);
      const instance = normaliser(configurationDe(apres));
      for (const derivee of ajouteesDe(apres, issue)) {
        assert.deepEqual(derivee.placement[0].reserve, [13], ici);
        assert.deepEqual(derivee.placement[0].sieges, adapte.placement[0].sieges, ici);
        assert.equal(tourFigeDifferent(derivee, adapte, [1]), null, ici);
        const plan = planDepuisFichier(derivee);
        assert.deepEqual(verifierInvariants(instance, plan, { reservesImposees: [{ participant: 13, tour: 1 }] }), [], ici);
        assert.equal(detaillerQualite(apres, derivee.id).collisions.planchersValides, false, ici);
      }
    }
  });

  test('une arrivante à siège réservé d’un tour figé : son siège libre au départ, la dérivée l’y assied ; pris, elle reste en réserve, cause siège', async () => {
    // Au tour 1, la table 4 du départ ajusté est [10, 11] : le siège 3 est libre.
    const libre = await monter({ charges: [chargeAuTour1({ table: 4, siege: 3 }, { attribuerSieges: true })] });
    const issue = await libre.controleur.generer(DERIVEE, { depart: { id: 4, toursFiges: [1] } });
    assert.ok(issue.ajoutees.length > 0);
    assert.deepEqual(issue.ecarts.find(({ participant }) => participant === 13).entreesFigees, [1]);
    for (const derivee of ajouteesDe(libre.charge(), issue)) {
      assert.deepEqual(derivee.placement[0].sieges[3], [10, 11, 13], `n° ${derivee.id}`);
      assert.deepEqual(derivee.placement[0].reserve, [], `n° ${derivee.id}`);
    }
    // Le siège 1 est celui de la personne 10.
    const pris = await monter({ charges: [chargeAuTour1({ table: 4, siege: 1 }, { attribuerSieges: true })] });
    const enReserve = await pris.controleur.generer(DERIVEE, { depart: { id: 4, toursFiges: [1] } });
    assert.deepEqual(enReserve.ecarts.find(({ participant }) => participant === 13).enReserveFigee, [{ tour: 1, cause: 'siege' }]);
    assert.deepEqual(pris.espion.lancements[0].options.depart.reservesImposees, [{ participant: 13, tour: 1 }]);
    for (const derivee of ajouteesDe(pris.charge(), enReserve)) {
      assert.deepEqual(derivee.placement[0].sieges[3], [10, 11], `n° ${derivee.id}`);
      assert.deepEqual(derivee.placement[0].reserve, [13], `n° ${derivee.id}`);
    }
  });

  test('DEPART_ECART_AU_RETENU : un retenu retouché au tour 1, une dérivée de sa proposition, tour 1 figé ; ni pour un retenu seulement ajusté, ni pour une dérivée d’une autre proposition ; une revenue en fait un', async () => {
    const charge = () => chargeAvecPropositions([[4, planCourt(5)], [5, planCourt(7)]]);
    const retouche = await monter({ charges: [charge()] });
    await retouche.seance.executer('retenirProposition', { id: 4 });
    const [[a], [b]] = planDuDepart(retouche.charge(), 4).tours[0];
    await retouche.seance.executer('echangerDansRetenu', { tour: 1, a, b });
    const issue = await retouche.controleur.generer(DERIVEE, { depart: { id: 4, toursFiges: [1, 2] } });
    assert.deepEqual(issue.avertissements, [{ code: 'DEPART_ECART_AU_RETENU', details: { depart: 4, tours: [1] } }]);
    assert.deepEqual([issue.departEnDerive, issue.ecarts], [false, []]);
    assert.equal(typeof libelle(issue.avertissements[0].code, issue.avertissements[0].details), 'string');
    const autre = await retouche.controleur.generer(DERIVEE, { depart: { id: 5, toursFiges: [1] } });
    assert.deepEqual(autre.avertissements, []);

    const ajuste = await monter({ charges: [charge()] });
    await ajuste.seance.executer('retenirProposition', { id: 4 });
    await ajuste.seance.executer('changerPresence', { id: 1, tours: [1, 2] });
    const sansEcart = await ajuste.controleur.generer(DERIVEE, { depart: { id: 4, toursFiges: [1, 2] } });
    assert.deepEqual([sansEcart.departEnDerive, sansEcart.avertissements], [true, []]);

    // Partie du tour figé 1 puis revenue : le retenu l'y garde en réserve,
    // le départ ajusté l'assied à sa chaise ; la comparaison stricte en fait
    // un écart, que l'avertissement nomme.
    const revenue = await monter({ charges: [charge()] });
    await revenue.seance.executer('retenirProposition', { id: 4 });
    await revenue.seance.executer('changerPresence', { id: 1, tours: [2, 3, 4] });
    await revenue.seance.executer('changerPresence', { id: 1, tours: null });
    assert.deepEqual(revenue.charge().retenu.placement[0].reserve, [1]);
    const avecEcart = await revenue.controleur.generer(DERIVEE, { depart: { id: 4, toursFiges: [1, 2] } });
    assert.deepEqual(avecEcart.avertissements, [{ code: 'DEPART_ECART_AU_RETENU', details: { depart: 4, tours: [1] } }]);
  });

  test('une génération ordinaire porte une issue sans départ : ni dérive, ni écart, ni avertissement', async () => {
    const montage = await monter({ charges: [chargeDemo('petite')] });
    const issue = await montage.controleur.generer(COURT);
    assert.deepEqual([issue.depart, issue.departEnDerive, issue.ecarts, issue.avertissements], [null, false, [], []]);
  });
});
