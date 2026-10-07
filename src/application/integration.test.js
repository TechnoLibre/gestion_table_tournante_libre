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
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creerFichiersSimules } from '../../test/fichiers_simules.js';
import { describe, test } from '../../test/lanceur.js';
import { apercevoir } from '../csv/apercu.js';
import { decoder } from '../csv/encodage.js';
import { exporterRefus } from '../csv/import.js';
import { rechercher } from '../moteur/recherche.js';
import { serialiser } from '../stockage/canonique.js';
import { enregistrer } from '../stockage/depot.js';
import { analyser, configurationDepuisCharge } from '../stockage/document.js';
import { fil, lireJournal, reconstruire, versionDe } from '../stockage/journal.js';
import { SUFFIXES } from '../stockage/noms.js';
import { VERSION } from '../version.genere.js';
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
  const apercu = apercevoir(texte, { participants: processus.seance.charge.participants });
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
      [[13, 'NOM_ABSENT']],
    );
    assert.match(vu.refus, /;13;Le nom manque\.\r\n$/);
    assert.equal(vu.import.resume.ajoutes, 13);
    const charge = vu.chargeRouverte;
    assert.equal(charge.participants.length, 13);
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
    assert.deepEqual(vu.retoursFinaux, { defaire: true, refaire: true });
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
