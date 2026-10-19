// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuve d'intégration de l'application (§ 2.1, § 8.2, § 8.3, § 8.4, § 9,
// § 10.1) : le parcours de l'opérateur, joué par la séance sur le système de
// fichiers d'épreuve, avec une horloge, des identifiants et un planificateur
// factices. Créer ; passer en écriture ; importer le CSV d'exemple des cas
// limites en une seule entrée ; corriger deux participants ; générer par le
// moteur, à un compte d'arrêt réduit, et enregistrer la génération ; retenir
// une proposition ; exclure une personne qu'elle place ; rouvrir, la dérive
// nommée et la proposition gardée ; défaire jusqu'avant la génération ;
// rouvrir.
//
// Le parcours se déroule une fois, et chaque épreuve en lit une propriété :
// - chaque fichier d'état, saisi au moment où il s'écrit, trouve déjà au
//   journal l'entrée de sa révision (le journal d'abord, § 8.2) ;
// - chaque instant du journal final, reconstruit, s'écrit octet pour octet
//   comme l'état écrit à cette révision, et chaque révision a un état ;
// - le journal ne se tronque jamais : chaque texte relevé commence par le
//   précédent (§ 8.3) ;
// - aucune ouverture n'écrit : ni primitive d'écriture comptée, ni octet du
//   disque changé (§ 8.4).
//
// Chaque réouverture est un processus neuf : une autre instance du système
// d'épreuve sur le même disque, et une autre séance ; rien de la mémoire de
// la précédente ne passe. Aucune commande de l'itération ne crée de table :
// l'entrée qui pose les tables s'écrit par le dépôt, depuis l'Ouvert que la
// création laisse, comme le fera la commande qui les créera — le journal
// d'abord, l'état ensuite. Les noms viennent du CSV d'exemple livré et, pour
// les corrections, sont inventés ; la version vient du module engendré.
//
// Un second parcours, plus bas, fait l'aller-retour d'un départ (§ 5.7) :
// du contrôleur de génération à la commande, de la commande au fichier, du
// fichier à un processus neuf.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { creerFichiersSimules } from '../../test/fichiers_simules.js';
import { describe, test } from '../../test/lanceur.js';
import { apercevoir } from '../csv/apercu.js';
import { decoder } from '../csv/encodage.js';
import { exporterRefus } from '../csv/import.js';
import { rechercher, regenerer, repartir } from '../moteur/recherche.js';
import { serialiser, serialiserCharge } from '../stockage/canonique.js';
import { lireCourses } from '../stockage/courses.js';
import { creer as creerDansLeDepot, enregistrer } from '../stockage/depot.js';
import { analyser, configurationDepuisCharge, creerCharge } from '../stockage/document.js';
import { fil, lireJournal, reconstruire, versionDe } from '../stockage/journal.js';
import { SUFFIXES } from '../stockage/noms.js';
import { planDepuisFichier } from '../stockage/placements.js';
import { VERSION } from '../version.genere.js';
import { appliquerCommande } from './commandes.js';
import { configurationDe } from './configuration.js';
import { derivationDe, planDuDepart } from './depart.js';
import { creerExecuteurTravailleur } from './executeur_travailleur.js';
import { creerControleurGeneration, creerExecuteurDirect } from './generation.js';
import { brancherTravailleur } from './generation_travailleur.js';
import { creerHorlogePilotee } from './horloge.js';
import { libelle } from './libelles.js';
import { creerSeance } from './seance.js';

const V = VERSION.affichee;
const DOC = { id: 'documents', chemin: 'C:\\Users\\Exemple\\Documents\\Gestion table tournante Libre' };
const NOM = 'Soirée des Grillons';
const CSV = new URL('../../exemples/participants_cas_limites.csv', import.meta.url);

// Le moteur : trois propositions, d'une graine fixe, à un compte d'arrêt qui
// garde l'épreuve dans le budget de la série surveillée (§ 14.14).
const GENERATION = { graine: 4099, arret: 300, nombre: 3 };

// Quatre tables de quatre places, sur une ligne, pour douze personnes
// présentes : les places suffisent à chaque tour.
const TABLES = [1, 2, 3, 4].map((id) => ({
  id,
  numero: id,
  sieges: null,
  forme: 'ronde',
  position: { x: 250 * (id - 1), y: 0 },
}));

// --- Le montage -------------------------------------------------------------

const deux = (valeur) => String(valeur).padStart(2, '0');

// Horloge d'épreuve : une seconde de plus à chaque lecture, à partir de
// 18 h, à l'heure de l'Est ; une heure de lectures au plus.
function creerHorloge() {
  let n = 0;
  return {
    horodatage() {
      const secondes = n;
      n += 1;
      return `2033-11-12T18:${deux(Math.floor(secondes / 60))}:${deux(secondes % 60)}-05:00`;
    },
  };
}

// Identifiants d'épreuve, numérotés dans l'ordre des tirages, préfixés par
// le processus.
function creerIdentifiants(prefixe) {
  let n = 0;
  return () => {
    n += 1;
    return `${prefixe}-${n}`;
  };
}

// Planificateur d'épreuve : il garde les minuteries sans jamais les
// déclencher ; l'inactivité ne tombe donc pas pendant le parcours.
function creerPlanificateur() {
  let suivant = 0;
  const minuteries = new Map();
  return {
    planifier(fn) {
      suivant += 1;
      minuteries.set(suivant, fn);
      return suivant;
    },
    annuler(id) {
      minuteries.delete(id);
    },
  };
}

// Le relevé du disque partagé : chaque état écrit, saisi à l'écriture, et
// chaque texte du journal relevé après un pas du parcours.
function creerReleve() {
  return { etats: [], journaux: [], ouvertures: [] };
}

// Un processus : une instance du système d'épreuve sur le disque, et sa
// séance. L'écriture atomique de l'état est observée : au moment où l'état
// de révision r s'écrit, le relevé garde son texte et la dernière révision
// que porte alors le journal.
function demarrer(disque, releve, prefixe) {
  const fs = creerFichiersSimules({ disque });
  const ecrireAtomique = fs.ecrireAtomique;
  fs.ecrireAtomique = async (racine, chemin, texte) => {
    if (!chemin.endsWith(SUFFIXES.etat)) return ecrireAtomique(racine, chemin, texte);
    const base = chemin.slice(0, -SUFFIXES.etat.length);
    const journal = lireJournal(fs.contenu(racine.id, base + SUFFIXES.journal) ?? '');
    const derniere = journal.entrees.at(-1)?.revision ?? null;
    await ecrireAtomique(racine, chemin, texte);
    releve.etats.push({ revision: analyser(texte).entete.revision, texte, derniere });
  };
  const planificateur = creerPlanificateur();
  const seance = creerSeance({
    fs,
    racine: DOC,
    horloge: creerHorloge(),
    identifiant: creerIdentifiants(prefixe),
    produitVersion: V,
    planifier: planificateur.planifier,
    annuler: planificateur.annuler,
  });
  return { fs, seance };
}

// Le texte de chaque fichier du disque, sous sa clé : ce qu'une ouverture
// ne doit pas changer.
const photographier = (disque) => JSON.stringify([...disque]);

// Ouvre base par la séance du processus, et relève ce que l'ouverture a
// écrit : primitives d'écriture comptées, et disque changé ou non.
async function ouvrir({ fs, seance }, disque, base, releve) {
  const ecritures = fs.compteurs.ecritures;
  const lectures = fs.compteurs.lectures;
  const avant = photographier(disque);
  const rendu = await seance.ouvrir(base);
  releve.ouvertures.push({
    base,
    ecritures: fs.compteurs.ecritures - ecritures,
    lu: fs.compteurs.lectures > lectures,
    disqueInchange: photographier(disque) === avant,
    mode: seance.mode,
  });
  return rendu;
}

// Le journal que porte le disque, en texte.
const texteDuJournal = ({ fs }, base) => fs.contenu('documents', base + SUFFIXES.journal);

// Le participant de la charge par nom et prénom.
const personneDe = (charge, nom, prenom) =>
  charge.participants.find((personne) => personne.nom === nom && personne.prenom === prenom);

// --- Le parcours ------------------------------------------------------------

async function derouler() {
  const disque = new Map();
  const releve = creerReleve();
  const vu = {};
  let processus = demarrer(disque, releve, 'p1');
  processus.fs.deposerDossier('documents');
  const releverJournal = () => releve.journaux.push(texteDuJournal(processus, vu.base));

  // 1. Créer, puis poser les tables.
  const { base } = await processus.seance.creer({ nom: NOM, date: '2033-11-12', siegesParDefaut: 4, tours: 3 });
  vu.base = base;
  releverJournal();
  const avecTables = { ...structuredClone(processus.seance.charge), tables: structuredClone(TABLES) };
  avecTables.prochainsIds.table = TABLES.length + 1;
  await enregistrer(processus.seance.ouvert, avecTables, {
    libelle: 'Ajouté les tables 1 à 4',
    horodatage: '2033-11-12T17:59:00-05:00',
    produitVersion: V,
    sens: null,
    retour: null,
  });
  releverJournal();
  await ouvrir(processus, disque, base, releve);

  // 1b. Passer en écriture.
  await processus.seance.passerEnEcriture();

  // 2. Importer le CSV des cas limites, en une entrée.
  const { texte } = decoder(readFileSync(CSV));
  const apercu = apercevoir(texte, {
    participants: processus.seance.charge.participants, tours: processus.seance.charge.evenement.tours,
  });
  vu.apercu = apercu;
  const entreesAvantImport = lireJournal(texteDuJournal(processus, base)).entrees.length;
  vu.import = await processus.seance.executer('importerParticipants', { apercu, mode: 'ajouter' });
  vu.entreesImport = lireJournal(texteDuJournal(processus, base)).entrees.length - entreesAvantImport;
  vu.refus = decoder(exporterRefus(apercu, libelle, vu.import.resume.refusees)).texte;
  releverJournal();

  // 3. Corriger deux participants.
  const brunoeil = personneDe(processus.seance.charge, 'Brunœil', null);
  const givrecoeur = personneDe(processus.seance.charge, 'Givrecœur', 'Anselme');
  vu.corrections = [
    await processus.seance.executer('modifierParticipant', { id: brunoeil.id, champs: { prenom: 'Aurèle' } }),
    await processus.seance.executer('modifierParticipant', {
      id: givrecoeur.id,
      champs: { appartenance: ' Cercle des Saules ' },
    }),
  ];
  releverJournal();
  vu.revisionAvantGeneration = processus.seance.ouvert.revision;
  vu.chargeAvantGeneration = structuredClone(processus.seance.charge);

  // 9. Générer, et enregistrer la génération.
  const configuration = configurationDepuisCharge(processus.seance.charge);
  const propositions = rechercher(configuration, GENERATION);
  vu.generation = await processus.seance.executer('enregistrerGeneration', {
    propositions,
    configuration,
    produitVersion: V,
  });
  releverJournal();

  // 10. Retenir une proposition.
  vu.retenue = 2;
  await processus.seance.executer('retenirProposition', { id: vu.retenue });
  vu.retenuAvant = structuredClone(processus.seance.charge.retenu);
  vu.propositionsAvant = structuredClone(processus.seance.charge.propositions);
  releverJournal();

  // 3 encore, après la génération : exclure une personne que la proposition
  // retenue place.
  vu.exclue = personneDe(processus.seance.charge, 'Pommerel', 'Capucine').id;
  vu.exclusion = await processus.seance.executer('exclureParticipant', { id: vu.exclue });
  releverJournal();
  vu.revisionExclusion = processus.seance.ouvert.revision;
  await processus.seance.fermer();

  // Rouvrir, dans un processus neuf.
  processus = demarrer(disque, releve, 'p2');
  vu.reouverture = await ouvrir(processus, disque, base, releve);
  vu.chargeRouverte = structuredClone(processus.seance.charge);
  vu.examen = processus.seance.ouvert.examen;

  // Défaire jusqu'avant la génération : l'exclusion, la rétention, la
  // génération.
  await processus.seance.passerEnEcriture();
  vu.defaits = [];
  for (let pas = 0; pas < 3; pas += 1) {
    vu.defaits.push(await processus.seance.defaire());
    releverJournal();
  }
  vu.chargeDefaite = structuredClone(processus.seance.charge);
  await processus.seance.fermer();

  // Rouvrir encore, dans un autre processus neuf.
  processus = demarrer(disque, releve, 'p3');
  vu.seconde = await ouvrir(processus, disque, base, releve);
  vu.chargeFinale = structuredClone(processus.seance.charge);
  vu.retoursFinaux = processus.seance.retours;
  vu.journalFinal = lireJournal(texteDuJournal(processus, base));
  return { releve, vu };
}

// Le parcours ne se déroule qu'une fois ; chaque épreuve attend le même.
let parcours = null;
const leParcours = () => {
  parcours ??= derouler();
  return parcours;
};

// --- Les épreuves -----------------------------------------------------------

describe('intégration : le parcours de l’opérateur par la séance (§ 2.1)', () => {
  test("l'import du CSV des cas limites est une seule entrée : le refus nommé et réexporté, l'exclusion, le doublon gardé, les appartenances fondues (§ 10.1)", async () => {
    const { vu } = await leParcours();
    assert.equal(vu.entreesImport, 1);
    assert.deepEqual(
      vu.import.resume.refusees.map(({ ligne, code }) => [ligne, code]),
      [[13, 'NOM_ABSENT'], [16, 'PRESENCE_HORS_TOURS']],
    );
    assert.match(vu.refus, /;13;Le nom manque\.\r\n/);
    assert.match(vu.refus, /;0-2;555-0115;16;La présence « 0-2 » nomme le tour 0 : la soirée compte 3 tours\.\r\n$/);
    assert.equal(vu.import.resume.ajoutes, 13);
    const charge = vu.chargeRouverte;
    assert.equal(charge.participants.length, 13);
    // La colonne Présence ne porte ni plage ni liste admise : personne n'a de présence partielle.
    assert.deepEqual(charge.participants.filter((p) => Object.hasOwn(p, 'presence')), []);
    assert.equal(charge.participants.filter((p) => p.nom === 'Lanterneau' && p.prenom === 'Basile').length, 2);
    assert.equal(personneDe(charge, 'Tourterel', 'Héloïse').exclu, true);
    assert.equal(personneDe(charge, 'Ormelin', 'Faustine').appartenance, 'Société des Hérons');
    assert.equal(personneDe(charge, 'Fenouillet', 'Côme').notes, 'végétarien; sans noix, ni arachides');
    assert.equal(personneDe(charge, 'Coudraie', 'Apolline').notes, 'Arrive après le premier tour\nrepart avant le dessert');
  });

  test('les deux corrections sont deux entrées, et le fichier rouvert les porte', async () => {
    const { vu } = await leParcours();
    assert.deepEqual(
      vu.corrections.map((rendu) => rendu.avertissements),
      [[], []],
    );
    assert.equal(personneDe(vu.chargeRouverte, 'Brunœil', 'Aurèle').appartenance, 'Cercle des Saules');
    assert.equal(personneDe(vu.chargeRouverte, 'Givrecœur', 'Anselme').appartenance, 'Cercle des Saules');
    const libelles = vu.journalFinal.entrees.map((entree) => entree.libelle);
    assert.deepEqual(libelles.slice(3, 5), vu.corrections.map((rendu) => rendu.libelle));
  });

  test('rouvrir après l’exclusion nomme la dérive de chaque proposition et du retenu, et les garde toutes (§ 9)', async () => {
    const { vu } = await leParcours();
    const ids = vu.propositionsAvant.map(({ id }) => id);
    assert.deepEqual(ids, [1, 2, 3]);
    assert.deepEqual(vu.reouverture.avertissements, [{ code: 'DERIVE', details: { ids, retenu: true } }]);
    const raison = { code: 'PARTICIPANT_EXCLU', participant: vu.exclue };
    assert.deepEqual(vu.examen.derives, ids.map((id) => ({ id, raisons: [raison] })));
    assert.deepEqual(vu.examen.retenu, { fautes: [], raisons: [raison] });
    assert.deepEqual(vu.examen.fautives, []);
    assert.match(libelle('DERIVE', { ids, retenu: true }), /gardés, et rien n'est effacé/);
    assert.deepEqual(vu.chargeRouverte.propositions, vu.propositionsAvant);
    assert.deepEqual(vu.chargeRouverte.retenu, vu.retenuAvant);
    assert.equal(vu.chargeRouverte.retenu.proposition, vu.retenue);
    assert.equal(vu.chargeRouverte.evenement.etat, 'retenu');
  });

  test('défaire trois fois revient avant la génération ; rouvert, rien ne dérive et tout se refait (§ 8.3)', async () => {
    const { vu } = await leParcours();
    const exclue = vu.chargeRouverte.participants.find(({ id }) => id === vu.exclue);
    assert.deepEqual(
      vu.defaits.map((rendu) => rendu.libelle),
      [
        `Défait : « Exclu ${exclue.prenom} ${exclue.nom} »`,
        `Défait : « Retenu la proposition n° ${vu.retenue} »`,
        `Défait : « ${vu.generation.libelle} »`,
      ],
    );
    // La charge restituée rend le contenu d'avant la génération, et ses
    // compteurs ne reculent jamais (§ 8.9) : participants et tables
    // reviennent à leur valeur, que la génération n'a pas changée ; celui des
    // propositions reste au-delà de tout identifiant de la génération défaite,
    // qu'une génération suivante ne redonnera pas.
    const sansCompteurs = (charge) => ({ ...charge, prochainsIds: undefined });
    const avant = vu.chargeAvantGeneration.prochainsIds;
    const dernierGenere = Math.max(...vu.propositionsAvant.map(({ id }) => id));
    for (const charge of [vu.chargeDefaite, vu.chargeFinale]) {
      assert.deepEqual(sansCompteurs(charge), sansCompteurs(vu.chargeAvantGeneration));
      assert.deepEqual(charge.prochainsIds, {
        participant: avant.participant,
        table: avant.table,
        proposition: dernierGenere + 1,
      });
    }
    assert.deepEqual(vu.seconde.avertissements, []);
    assert.deepEqual(vu.retoursFinaux, { defaire: true, refaire: true, jalons: 6 });
    const { entrees } = vu.journalFinal;
    const retours = entrees.slice(-3).map(({ sens, retour }) => [sens, retour]);
    assert.deepEqual(retours, [
      ['defaire', vu.revisionExclusion - 1],
      ['defaire', vu.revisionExclusion - 2],
      ['defaire', vu.revisionAvantGeneration],
    ]);
    assert.equal(fil(vu.journalFinal).position, vu.revisionAvantGeneration);
    const jalons = vu.journalFinal.jalons.map(({ revision, nom }) => [revision, nom]);
    assert.ok(
      jalons.some(([revision, nom]) => revision === vu.revisionAvantGeneration && nom === 'Avant la génération'),
      JSON.stringify(jalons),
    );
  });
});

describe('intégration : les trois garanties d’un geste, sur le journal entier (§ 2.1, § 8.2, § 8.3, § 8.4)', () => {
  test("chaque état s'écrit après l'entrée de sa révision, une fois par révision", async () => {
    const { releve, vu } = await leParcours();
    assert.deepEqual(
      releve.etats.map(({ revision, derniere }) => [revision, derniere]),
      releve.etats.map(({ revision }) => [revision, revision]),
    );
    const revisions = releve.etats.map(({ revision }) => revision);
    assert.deepEqual(
      revisions,
      vu.journalFinal.entrees.map(({ revision }) => revision),
    );
  });

  test("chaque instant du journal, reconstruit, s'écrit octet pour octet comme l'état écrit à ce moment", async () => {
    const { releve, vu } = await leParcours();
    const journal = vu.journalFinal;
    assert.equal(journal.entrees.length, releve.etats.length);
    assert.ok(journal.entrees.length >= 10, `${journal.entrees.length} entrées`);
    for (const { revision, texte } of releve.etats) {
      const produitVersion = versionDe(journal, revision);
      const reconstruit = serialiser(reconstruire(journal, revision), { revision, produitVersion });
      assert.equal(reconstruit, texte, `révision ${revision}`);
    }
  });

  test('le journal ne se tronque jamais : chaque texte relevé commence par le précédent', async () => {
    const { releve } = await leParcours();
    assert.ok(releve.journaux.length >= 9);
    releve.journaux.reduce((avant, apres, rang) => {
      assert.ok(apres.length > avant.length && apres.startsWith(avant), `relevé ${rang}`);
      return apres;
    });
  });

  test("aucune ouverture n'écrit : ni primitive d'écriture, ni octet du disque, et l'événement s'ouvre en lecture", async () => {
    const { releve, vu } = await leParcours();
    assert.deepEqual(
      releve.ouvertures,
      [1, 2, 3].map(() => ({ base: vu.base, ecritures: 0, lu: true, disqueInchange: true, mode: 'lecture' })),
    );
  });
});

// --- L'aller-retour d'un départ ---------------------------------------------
//
// Le second parcours (§ 5.7, § 8.6, § 8.9, C6, C11, C24) : une génération
// ordinaire, puis deux générations dérivées et une ordinaire, chacune lancée
// par le contrôleur de génération sur la séance, enregistrée par la vraie
// commande, écrite sur le disque d'épreuve ; un retour et sa reprise entre
// les deux dérivées ; puis un processus neuf relit le disque. Les sièges sont
// attribués : la première génération se fait sous deux réservations à un
// siège, et l'une se retire avant la première dérivée — un geste légitime,
// après lequel le rangement par siège ne redonne plus les listes du départ,
// que le tour figé doit garder telles quelles. Le parcours se joue sur
// l'exécuteur direct et, une seconde fois, sur l'exécuteur à fils, dont les
// fils, en mémoire, répondent par brancherTravailleur, le vrai côté
// travailleur. Chaque épreuve lit le parcours direct, sauf celles qui lisent
// les messages des fils ou comparent les deux disques.

const NOM_EVENEMENT_RICOCHETS = 'Soirée des Ricochets';

// Neuf personnes inventées ; trois tables de cinq places, trois tours : six
// places libres à chaque tour, et une chaise vide là où une table assied
// moins de personnes que le siège réservé ne le demande.
const GENS = [
  ['Ombrelle', 'Iris', 'Coopérative Aubier'],
  ['Pervenche', 'Théo', 'Atelier Ressac'],
  ['Lacasse', 'Ondine', 'Coopérative Aubier'],
  ['Tourteau', 'Basile', 'Atelier Ressac'],
  ['Quenouille', 'Maëlle', null],
  ['Grisaille', 'Anouk', 'Coopérative Aubier'],
  ['Bruyère', 'Capucine', null],
  ['Sarcelle', 'Gaspard', 'Atelier Ressac'],
  ['Mélèze', 'Hortense', null],
];

// La réservation d'Iris Ombrelle, retirée avant la première dérivée ; celle
// d'Ondine Lacasse reste, et chaque départ la tient.
const RESERVATION_RETIREE = { participant: 1, table: 1, siege: 5, portee: 'tous', tour: null };
const RESERVATION_GARDEE = { participant: 3, table: 2, siege: 5, portee: 'tous', tour: null };

// Les réglages des quatre générations. La première, au plus court compte
// d'arrêt, laisse aux dérivées de quoi améliorer : aucune dérivée n'égale son
// départ, ce que les épreuves vérifient par les identifiants ajoutés.
const REGLAGES = Object.freeze({
  ordinaire: { graine: 21, nombre: 2, arret: 1, historique: 1000 },
  derivee: { graine: 31, nombre: 2, arret: 60, historique: 1000 },
  deriveeDeDerivee: { graine: 41, nombre: 2, arret: 300, historique: 1000 },
  ensuite: { graine: 51, nombre: 2, arret: 300, historique: 1000 },
});

// Ce que la génération ordinaire d'après les dérivées écrit pour ses
// propositions n° 7 et 8 : la fin du fichier d'état et celle du compagnon
// des courses, chacune depuis la ligne qui ouvre la proposition n° 7, la
// version du produit remplacée par « V », réduites à leur empreinte SHA-256.
// La valeur est écrite ici et non recalculée : une comparaison à la commande
// ordinaire du même arbre retrouverait des deux côtés un changement du
// chemin ordinaire — moteur, commande sans dérivation, sérialiseur —, que
// cette empreinte refuse. Elle ne change qu'avec ce chemin, quand il change à
// dessein.
const EMPREINTE_ORDINAIRE = '84f91d6d9f9135f5387b6f1b2544cc48ad96c0074126dee486227f1d478695a5';

// Les départs des deux générations dérivées : n° 1, tour 1 figé ; puis n° 3,
// une dérivée de la génération précédente, tours 1 et 2 figés.
const DEPARTS = Object.freeze({
  derivee: { id: 1, toursFiges: [1] },
  deriveeDeDerivee: { id: 3, toursFiges: [1, 2] },
});

function chargeDuParcours() {
  const charge = creerCharge({ id: 'evt-ricochets', nom: NOM_EVENEMENT_RICOCHETS, date: '2033-11-12', siegesParDefaut: 5, tours: 3 });
  charge.participants = GENS.map(([nom, prenom, appartenance], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    appartenance,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  charge.tables = [1, 2, 3].map((id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 250 * (id - 1), y: 0 } }));
  charge.reglages.attribuerSieges = true;
  charge.reservations = [{ ...RESERVATION_RETIREE }, { ...RESERVATION_GARDEE }];
  charge.prochainsIds = { participant: GENS.length + 1, table: 4, proposition: 1 };
  return charge;
}

// Une fabrique de fils en mémoire : chaque message reçu est gardé, cloné,
// dans messages, puis servi une microtâche plus tard par
// brancherTravailleur ; ce que celui-ci poste revient au fil, cloné, tant
// que le fil n'est pas terminé.
function fabriqueDeFils(messages) {
  return () => {
    const fil = {
      onmessage: null,
      termine: false,
      postMessage(message) {
        messages.push(structuredClone(message));
        const recu = structuredClone(message);
        queueMicrotask(() => {
          if (fil.termine) return;
          const portee = {
            onmessage: null,
            postMessage: (data) => {
              if (!fil.termine) fil.onmessage?.({ data: structuredClone(data) });
            },
          };
          brancherTravailleur(portee);
          portee.onmessage({ data: recu });
        });
      },
      terminate() {
        fil.termine = true;
      },
    };
    return fil;
  };
}

// Un processus du second parcours : une instance du système d'épreuve sur
// le disque, une horloge pilotée, la séance, et le contrôleur de génération
// sur l'exécuteur donné, dont chaque lancer garde ses options, clonées.
function demarrerAvecControleur(disque, prefixe, executeur) {
  const fs = creerFichiersSimules({ disque });
  const horloge = creerHorlogePilotee({ depart: '2033-11-12T18:00:00-05:00' });
  const seance = creerSeance({
    fs,
    racine: DOC,
    horloge,
    identifiant: creerIdentifiants(prefixe),
    produitVersion: V,
    planifier: horloge.planifier,
    annuler: horloge.annuler,
  });
  const lancements = [];
  const espion = {
    coeursDisponibles: executeur.coeursDisponibles,
    lancer(configuration, reglages, options) {
      lancements.push(structuredClone(options));
      return executeur.lancer(configuration, reglages, options);
    },
  };
  const controleur = creerControleurGeneration({ seance, executeur: espion, horloge, produitVersion: V });
  return { fs, seance, controleur, lancements };
}

// Les textes de l'état, du journal et du compagnon des courses de base.
const textesDuDisque = ({ fs }, base) =>
  Object.fromEntries(['etat', 'journal', 'courses'].map((cle) => [cle, fs.contenu('documents', base + SUFFIXES[cle])]));

// sorte : 'direct' ou 'fils'.
async function deroulerDepart(sorte) {
  const disque = new Map();
  const messages = [];
  const executeur =
    sorte === 'fils' ? creerExecuteurTravailleur(fabriqueDeFils(messages), { coeursDisponibles: 2 }) : creerExecuteurDirect();
  const depot = creerFichiersSimules({ disque });
  depot.deposerDossier('documents');
  const { base } = await creerDansLeDepot(depot, DOC, chargeDuParcours(), {
    libelle: libelle('ENTREE_CREATION', { nom: NOM_EVENEMENT_RICOCHETS }),
    nomJalon: libelle('JALON_CREATION'),
    horodatage: '2033-11-12T17:59:00-05:00',
    produitVersion: V,
  });
  const vu = { base };
  let processus = demarrerAvecControleur(disque, 'q1', executeur);
  await processus.seance.ouvrir(base);
  await processus.seance.passerEnEcriture();
  const charge = () => structuredClone(processus.seance.charge);

  // Une génération du contrôleur, et ce qu'elle laisse : la charge avant et
  // après, l'issue, les options du lancer, les messages aux fils, le
  // libellé de la dernière entrée du journal.
  async function generation(nom, depart = null) {
    const avant = charge();
    const debut = messages.length;
    const lancement = processus.lancements.length;
    const issue = await processus.controleur.generer(REGLAGES[nom], depart === null ? {} : { depart });
    vu[nom] = {
      avant,
      issue,
      apres: charge(),
      options: processus.lancements.slice(lancement),
      messages: messages.slice(debut),
      libelle: lireJournal(texteDuJournal(processus, base)).entrees.at(-1).libelle,
    };
  }

  await generation('ordinaire');
  const { participant, table, portee, tour } = RESERVATION_RETIREE;
  await processus.seance.executer('retirerReservation', { participant, table, portee, tour });
  await generation('derivee', DEPARTS.derivee);
  vu.defait = await processus.seance.defaire();
  vu.chargeDefaite = charge();
  vu.refait = await processus.seance.refaire();
  vu.chargeRefaite = charge();
  await generation('deriveeDeDerivee', DEPARTS.deriveeDeDerivee);
  await generation('ensuite');
  await processus.seance.fermer();

  // Rouvrir, dans un processus neuf.
  processus = demarrerAvecControleur(disque, 'q2', executeur);
  await processus.seance.ouvrir(base);
  vu.rouverte = charge();
  vu.courses = new Map(vu.rouverte.propositions.map(({ id }) => [id, processus.seance.courseDe(id)]));
  vu.textes = textesDuDisque(processus, base);
  return vu;
}

// Chaque sorte de parcours ne se déroule qu'une fois.
const parcoursDepart = new Map();
const leParcoursDepart = (sorte = 'direct') => {
  if (!parcoursDepart.has(sorte)) parcoursDepart.set(sorte, deroulerDepart(sorte));
  return parcoursDepart.get(sorte);
};

// Les propositions que le moteur rend pour la génération nom du parcours,
// recalculées hors du contrôleur sur la charge d'avant elle, lue dans vue :
// repartir sous un départ, rechercher sinon.
function duMoteur(vue, nom) {
  const configuration = configurationDe(vue.avant);
  const depart = DEPARTS[nom];
  if (depart === undefined) return rechercher(configuration, REGLAGES[nom]);
  return repartir(configuration, REGLAGES[nom], { plan: planDuDepart(vue.avant, depart.id), toursFiges: depart.toursFiges });
}

const propositionDe = (charge, id) => charge.propositions.find((p) => p.id === id);

// La fin d'un texte de fichier, depuis la ligne qui ouvre la proposition
// n° 7 ; une proposition n° 7 absente fait échouer l'épreuve.
function depuisLaProposition7(texte) {
  const debut = texte.indexOf('{"id":7,"graine":');
  assert.ok(debut >= 0, 'la proposition n° 7 manque au texte');
  return texte.slice(debut);
}

// Les entrées du compagnon des courses que la charge confirme, par
// identifiant de proposition.
function entreesDuCompagnon(texte, charge) {
  return new Map([...lireCourses(texte, charge).values()].map((entree) => [entree.id, entree]));
}

describe('intégration : l’aller-retour d’un départ, du contrôleur au fichier (§ 5.7, § 8.9, C6, C11, C24)', () => {
  test('un départ choisi, tour 1 figé, une génération : la charge porte depart et toursFiges, chaque tour 1 égal à celui du départ', async () => {
    const { derivee, rouverte } = await leParcoursDepart();
    assert.deepEqual(derivee.issue.ajoutees, [3, 4]);
    assert.deepEqual(derivee.issue.depart, DEPARTS.derivee);
    assert.equal(derivee.issue.identiquesAuDepart, 0);
    const depart = propositionDe(derivee.avant, 1);
    // La charge de la séance, et celle que le fichier rend à un processus neuf.
    for (const [ici, charge] of [['séance', derivee.apres], ['fichier rouvert', rouverte]]) {
      for (const id of [3, 4]) {
        const p = propositionDe(charge, id);
        assert.deepEqual([p.depart, p.toursFiges], [1, [1]], `${ici}, proposition ${id}`);
        assert.deepEqual(p.placement[0], depart.placement[0], `${ici}, proposition ${id}, tour 1`);
        assert.deepEqual(derivationDe(charge, id), { depart: 1, toursFiges: [1], departPresent: true }, `${ici}, proposition ${id}`);
      }
    }
  });

  test('sous sièges attribués, le tour 1 de chaque dérivée égale celui du départ case pour case, sièges et chaises vides compris, au plan et à chaque point de relevé du compagnon', async () => {
    const { derivee, rouverte, textes } = await leParcoursDepart();
    const depart = propositionDe(derivee.avant, 1);
    const entrees = entreesDuCompagnon(textes.courses, rouverte);
    let chaisesVides = 0;
    let releves = 0;
    for (const id of [3, 4]) {
      const p = propositionDe(rouverte, id);
      assert.equal(p.siegesAttribues, true, `proposition ${id}`);
      assert.deepEqual(p.tables, depart.tables, `proposition ${id}`);
      const entree = entrees.get(id);
      assert.notEqual(entree, undefined, `proposition ${id} : le compagnon relu n'a pas sa course`);
      const points = entree.course.releves.map(({ placement }) => placement);
      releves += points.length;
      [p.placement, ...points].forEach((placement, point) => {
        assert.deepEqual(placement[0], depart.placement[0], `proposition ${id}, point ${point}, tour 1`);
        chaisesVides += placement[0].sieges.flat().filter((siege) => siege === null).length;
      });
    }
    assert.ok(releves > 0, 'aucun point de relevé : l’épreuve ne les éprouverait pas');
    assert.ok(chaisesVides > 0, 'aucune chaise vide au tour 1 : l’épreuve ne les éprouverait pas');
    // Les mêmes propositions du moteur, enregistrées sans dérivation sous les
    // réservations courantes : le rangement par siège donnerait au tour 1
    // d'autres listes que celles du départ.
    const moteur = duMoteur(derivee, 'derivee');
    const configuration = configurationDe(derivee.avant);
    const rangees = appliquerCommande('enregistrerGeneration', derivee.avant, { propositions: moteur, configuration, produitVersion: V })
      .charge.propositions.slice(-2);
    assert.ok(
      rangees.some((p) => JSON.stringify(p.placement[0]) !== JSON.stringify(depart.placement[0])),
      'le rangement redonnerait les listes du départ : l’épreuve ne distinguerait pas la recopie',
    );
    // Hors des listes du tour figé, la dérivée est la proposition du moteur.
    rangees.forEach((rangee, rang) => {
      assert.deepEqual(planDepuisFichier(propositionDe(rouverte, rang + 3)), planDepuisFichier(rangee), `proposition ${rang + 3}`);
    });
  });

  test('le journal porte le libellé de chaque génération dérivée, fixé à l’écriture : le départ, les propositions, les tours figés', async () => {
    const { ordinaire, derivee, deriveeDeDerivee, rouverte, textes } = await leParcoursDepart();
    assert.equal(ordinaire.libelle, 'Généré 2 propositions (n° 1 à 2)');
    assert.equal(derivee.libelle, 'Généré 2 propositions dérivées de n° 1 (n° 3 à 4), tour 1 figé');
    assert.equal(deriveeDeDerivee.libelle, 'Généré 2 propositions dérivées de n° 3 (n° 5 à 6), tours 1 et 2 figés');
    // Le journal relu garde ces libellés, et l'état rouvert est celui que le
    // journal reconstruit à sa dernière révision.
    const journal = lireJournal(textes.journal);
    const libelles = journal.entrees.map((entree) => entree.libelle);
    assert.ok(libelles.includes(derivee.libelle), JSON.stringify(libelles));
    assert.ok(libelles.includes(deriveeDeDerivee.libelle), JSON.stringify(libelles));
    const revision = journal.entrees.at(-1).revision;
    assert.equal(serialiserCharge(reconstruire(journal, revision)), serialiserCharge(rouverte));
  });

  test('un retour rend la charge d’avant la génération dérivée, son compteur excepté ; le refaire rend ses dérivées', async () => {
    const { derivee, defait, chargeDefaite, refait, chargeRefaite } = await leParcoursDepart();
    assert.equal(defait.libelle, `Défait : « ${derivee.libelle} »`);
    assert.equal(refait.libelle, `Refait : « ${derivee.libelle} »`);
    const sansCompteurs = (charge) => ({ ...charge, prochainsIds: undefined });
    assert.deepEqual(sansCompteurs(chargeDefaite), sansCompteurs(derivee.avant));
    assert.equal(chargeDefaite.prochainsIds.proposition, 5);
    assert.deepEqual(chargeDefaite.propositions.map(({ id }) => id), [1, 2]);
    assert.equal(serialiserCharge(chargeRefaite), serialiserCharge(derivee.apres));
    assert.deepEqual(derivationDe(chargeRefaite, 3), { depart: 1, toursFiges: [1], departPresent: true });
  });

  test('la course de chaque dérivée se relit après réouverture (courseDe) : celle de sa descente, partie du départ', async () => {
    const vu = await leParcoursDepart();
    for (const nom of ['derivee', 'deriveeDeDerivee', 'ensuite']) {
      const vue = vu[nom];
      duMoteur(vue, nom).forEach((proposition, rang) => {
        const id = vue.issue.ajoutees[rang];
        const course = vu.courses.get(id);
        assert.notEqual(course, null, `${nom}, proposition ${id} : sa course n'est pas relue`);
        assert.equal(course.evalues, proposition.evalues, `${nom}, proposition ${id}`);
        assert.deepEqual(
          course.releves.map(({ mouvements }) => mouvements),
          proposition.releves.map(({ mouvements }) => mouvements),
          `${nom}, proposition ${id}`,
        );
      });
    }
  });

  test('ni la charge, ni le journal, ni le compagnon des courses ne portent relances, que portent les propositions de repartir', async () => {
    const vu = await leParcoursDepart();
    for (const nom of ['derivee', 'deriveeDeDerivee']) {
      for (const proposition of duMoteur(vu[nom], nom)) {
        assert.equal(typeof proposition.relances, 'number', `${nom}, rang ${proposition.id}`);
      }
    }
    for (const [cle, texte] of Object.entries(vu.textes)) {
      assert.equal(typeof texte, 'string', cle);
      assert.equal(texte.includes('relances'), false, cle);
    }
    for (const p of vu.rouverte.propositions) assert.equal(Object.hasOwn(p, 'relances'), false, `proposition ${p.id}`);
  });

  test('une dérivée d’une dérivée écrite par la génération précédente ne nomme que son départ immédiat ; ses tours figés sont ceux de ce départ', async () => {
    const { deriveeDeDerivee, rouverte } = await leParcoursDepart();
    assert.deepEqual(deriveeDeDerivee.issue.ajoutees, [5, 6]);
    assert.deepEqual(deriveeDeDerivee.options, [{ coeurs: 1, depart: { plan: planDuDepart(deriveeDeDerivee.avant, 3), toursFiges: [1, 2] } }]);
    assert.notDeepEqual(planDuDepart(deriveeDeDerivee.avant, 3), planDuDepart(deriveeDeDerivee.avant, 1));
    const depart = propositionDe(rouverte, 3);
    assert.equal(depart.depart, 1);
    for (const id of [5, 6]) {
      const p = propositionDe(rouverte, id);
      assert.deepEqual([p.depart, p.toursFiges], [3, [1, 2]], `proposition ${id}`);
      assert.deepEqual(derivationDe(rouverte, id), { depart: 3, toursFiges: [1, 2], departPresent: true });
      assert.deepEqual(p.placement.slice(0, 2), depart.placement.slice(0, 2), `proposition ${id}, tours 1 et 2`);
    }
  });

  test('chaque dérivée rouverte se régénère de ses champs et du plan de son départ, relus du fichier ; sans ce plan, regenerer refuse', async () => {
    const { rouverte } = await leParcoursDepart();
    const configuration = configurationDe(rouverte);
    let toursFigesLus = 0;
    for (const id of [3, 4, 5, 6]) {
      const p = propositionDe(rouverte, id);
      const options = { planDuDepart: planDuDepart(rouverte, p.depart) };
      assert.deepEqual(regenerer(configuration, p, options), planDepuisFichier(p), `proposition ${id}`);
      assert.throws(() => regenerer(configuration, p), (erreur) => erreur instanceof RangeError && erreur.reglage === 'depart', `proposition ${id}`);
      // Sans ses tours figés, la même descente rend un autre plan : l'épreuve
      // lit bien ceux que le fichier rend.
      const sansTours = regenerer(configuration, { ...p, toursFiges: undefined }, options);
      if (JSON.stringify(sansTours) !== JSON.stringify(planDepuisFichier(p))) toursFigesLus += 1;
    }
    assert.ok(toursFigesLus > 0, 'aucune dérivée ne dépend de ses tours figés : l’épreuve ne les éprouverait pas');
  });

  test('une génération ordinaire après une dérivée : lancer sans départ, charge, libellé et courses de la commande ordinaire, texte écrit égal à son empreinte fixée', async () => {
    const { ensuite, derivee, textes, rouverte } = await leParcoursDepart();
    assert.deepEqual(derivee.options, [{ coeurs: 1, depart: { plan: planDuDepart(derivee.avant, 1), toursFiges: [1] } }]);
    assert.deepEqual(ensuite.options, [{ coeurs: 1 }]);
    assert.deepEqual(ensuite.issue.ajoutees, [7, 8]);
    assert.equal(ensuite.issue.depart, null);
    assert.equal(ensuite.issue.identiquesAuDepart, 0);
    // La commande ordinaire, appliquée hors de la séance aux propositions de
    // rechercher, sous l'horodatage que la séance a posé : le contrôleur ne
    // laisse rien d'une génération dérivée à la suivante.
    const { horodatage } = propositionDe(ensuite.apres, 7);
    const configuration = configurationDe(ensuite.avant);
    const attendu = appliquerCommande(
      'enregistrerGeneration',
      ensuite.avant,
      { propositions: duMoteur(ensuite, 'ensuite'), configuration, produitVersion: V },
      { horodatage },
    );
    assert.equal(serialiserCharge(ensuite.apres), serialiserCharge(attendu.charge));
    assert.equal(ensuite.libelle, attendu.libelle);
    assert.equal(ensuite.libelle, 'Généré 2 propositions (n° 7 à 8)');
    for (const id of [7, 8]) {
      const p = propositionDe(rouverte, id);
      assert.equal(Object.hasOwn(p, 'depart'), false, `proposition ${id}`);
      assert.equal(Object.hasOwn(p, 'toursFiges'), false, `proposition ${id}`);
    }
    const entrees = entreesDuCompagnon(textes.courses, rouverte);
    assert.deepEqual(
      attendu.courses.map((entree) => entrees.get(entree.id)),
      attendu.courses,
    );
    // Le texte écrit sur le disque, contre sa valeur fixée.
    const ecrit = [textes.etat, textes.courses].map(depuisLaProposition7).join('').replaceAll(JSON.stringify(V), '"V"');
    assert.equal(createHash('sha256').update(ecrit).digest('hex'), EMPREINTE_ORDINAIRE);
  });

  test('sur l’exécuteur à fils : chaque message d’une dérivée porte son départ, celui de la génération ordinaire suivante n’a pas de clé depart', async () => {
    const vu = await leParcoursDepart('fils');
    for (const nom of ['derivee', 'deriveeDeDerivee']) {
      const { messages, avant } = vu[nom];
      const { id, toursFiges } = DEPARTS[nom];
      assert.deepEqual(messages.map(({ rang }) => rang).sort(), [1, 2], nom);
      for (const message of messages) {
        assert.deepEqual(message.depart, { plan: planDuDepart(avant, id), toursFiges }, `${nom}, rang ${message.rang}`);
      }
    }
    for (const nom of ['ordinaire', 'ensuite']) {
      assert.deepEqual(vu[nom].messages.map(({ rang }) => rang).sort(), [1, 2], nom);
      for (const message of vu[nom].messages) {
        assert.deepEqual(Object.keys(message), ['type', 'configuration', 'reglages', 'rang'], `${nom}, rang ${message.rang}`);
      }
    }
  });

  test('le même parcours sur un fil et sur deux écrit le même disque : état, journal et compagnon octet pour octet', async () => {
    const direct = await leParcoursDepart('direct');
    const fils = await leParcoursDepart('fils');
    for (const cle of ['etat', 'journal', 'courses']) {
      assert.equal(typeof direct.textes[cle], 'string', cle);
      assert.equal(fils.textes[cle], direct.textes[cle], cle);
    }
  });
});
