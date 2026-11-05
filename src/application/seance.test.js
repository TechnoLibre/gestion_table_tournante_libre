// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de la séance (§ 2.1, § 8.1 à § 8.6, § 8.8, § 9, § 10.1), toutes sur
// le système de fichiers d'épreuve, qui compte ses écritures, avec une
// horloge et un planificateur factices : rien n'attend le temps réel. Une
// ouverture n'écrit rien ; un geste écrit une entrée puis un état ; un refus
// n'écrit rien ; le verrou se prend à l'entrée en écriture et se rend au
// retour en lecture, explicite ou après l'inactivité ; le support qui rompt
// se remplace par un autre dossier. Les noms d'épreuve sont inventés ; la
// version vient du module engendré.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';
import { PanneSimulee, creerFichiersSimules } from '../../test/fichiers_simules.js';
import { H_RETENU, personne as personneBadge, soiree, table as tableBadge } from '../../test/fixtures/badges/cas.js';
import { describe, test } from '../../test/lanceur.js';
import { lireLogo } from '../../test/logo.js';
import { lirePolices } from '../../test/polices.js';
import { apercevoir } from '../csv/apercu.js';
import { nombrePlacesManquantes, normaliser } from '../moteur/configuration.js';
import { CRITERES } from '../moteur/criteres.js';
import { rechercher } from '../moteur/recherche.js';
import { serialiser } from '../stockage/canonique.js';
import { creer as creerDansLeDepot, ouvrir as ouvrirDansLeDepot } from '../stockage/depot.js';
import { FORMAT, analyser, configurationDepuisCharge, creerCharge, etatDeduit } from '../stockage/document.js';
import { ErreurStockage } from '../stockage/erreurs.js';
import { estFigee } from '../stockage/gel.js';
import { ligneEntree, ligneOuverture, lireJournal, reconstruire } from '../stockage/journal.js';
import { SUFFIXES, cleEvenement, nomPlanche } from '../stockage/noms.js';
import { FICHIER_REGLAGES } from '../stockage/reglages_locaux.js';
import { VERSION } from '../version.genere.js';
import { examenNomme } from './avertissements.js';
import { libelle } from './libelles.js';
import {
  DELAI_REGLAGES_MS,
  INACTIVITE_MS,
  LOGO_PARTICIPANT_COTE_MAX,
  TEXTE_PIED_TECHNOLIBRE_DEFAUT,
  copiePubliee,
  creerSeance,
  normaliserTextePied,
} from './seance.js';

const V1 = VERSION.affichee;

const DOCUMENTS = 'C:\\Users\\Exemple\\Documents\\Gestion table tournante Libre\\data';
const DOC = { id: 'documents', chemin: DOCUMENTS };
const PORTABLE = { id: 'portable', chemin: 'E:\\soirees\\data' };

const BASE = 'Soirée des Lucioles';
// La clé de l'événement d'essai, dans le dossier de sa base, et ses fichiers,
// relatifs à la racine.
const EVT = cleEvenement(BASE, BASE);
const ETAT = `${BASE}/${BASE}${SUFFIXES.etat}`;
const JOURNAL = `${BASE}/${BASE}${SUFFIXES.journal}`;
const VERROU = `${BASE}/${BASE}${SUFFIXES.verrou}`;
// Ce que nomme le refus d'écriture d'un fichier de l'événement d'essai : son
// nom, relatif au dossier de l'événement, et le chemin affichable de ce
// dossier sous la racine donnée.
const NOM = { ETAT: `${BASE}${SUFFIXES.etat}`, JOURNAL: `${BASE}${SUFFIXES.journal}`, VERROU: `${BASE}${SUFFIXES.verrou}` };
const dossierDe = (racine) => `${racine}\\${BASE}`;
const CREATION = "Création de l'événement « Soirée des Lucioles »";

// --- Le montage -------------------------------------------------------------

const deux = (valeur) => String(valeur).padStart(2, '0');

// Horloge d'épreuve : une minute de plus à chaque lecture, à partir de 8 h le
// 17 mai 2031, à l'heure de l'Est, décalée de debut minutes.
function creerHorloge(debut = 0) {
  let n = debut;
  return {
    horodatage() {
      const minutes = 8 * 60 + n;
      n += 1;
      return `2031-05-17T${deux(Math.floor(minutes / 60))}:${deux(minutes % 60)}:00-04:00`;
    },
  };
}

// Identifiants d'épreuve, numérotés dans l'ordre des tirages : le premier est
// celui de la séance. tirages les garde.
function creerIdentifiants(prefixe) {
  const tirages = [];
  const identifiant = () => {
    tirages.push(`${prefixe}-${tirages.length + 1}`);
    return tirages.at(-1);
  };
  identifiant.tirages = tirages;
  return identifiant;
}

// Planificateur d'épreuve : rien ne part seul. avancer(ms) déclenche les
// minuteries échues, dans l'ordre de leur échéance puis de leur création, et
// attend ce que chacune rend.
function creerPlanificateur() {
  let maintenant = 0;
  let suivant = 1;
  const minuteries = new Map();
  return {
    planifier(fn, ms) {
      const id = suivant;
      suivant += 1;
      minuteries.set(id, { fn, echeance: maintenant + ms });
      return id;
    },
    annuler(id) {
      minuteries.delete(id);
    },
    async avancer(ms) {
      maintenant += ms;
      const echues = [...minuteries]
        .filter(([, { echeance }]) => echeance <= maintenant)
        .sort(([a, m], [b, n]) => m.echeance - n.echeance || a - b);
      for (const [id, { fn }] of echues) {
        if (!minuteries.has(id)) continue;
        minuteries.delete(id);
        await fn();
      }
    },
    get actives() {
      return minuteries.size;
    },
  };
}

// Une séance sur le système d'épreuve, sa racine créée : documents par
// défaut.
// options : les paramètres de creerSeance qu'une épreuve règle en plus —
// delaiReglagesMs. Une racine null crée la séance sans dossier de travail.
// La séance reçoit le chargement du logo vectoriel, que la planche lit pour
// le pied TechnoLibre ; logo: null monte une séance sans lui.
function monter({ fs = creerFichiersSimules(), racine = DOC, prefixe = 'seance', inactiviteMs, logo = async () => lireLogo(), ...options } = {}) {
  if (racine !== null) fs.deposerDossier(racine.id);
  const planificateur = creerPlanificateur();
  const identifiant = creerIdentifiants(prefixe);
  const seance = creerSeance({
    fs,
    racine,
    horloge: creerHorloge(),
    identifiant,
    produitVersion: V1,
    planifier: planificateur.planifier,
    annuler: planificateur.annuler,
    logo,
    ...(inactiviteMs === undefined ? {} : { inactiviteMs }),
    ...options,
  });
  return { fs, seance, planificateur, identifiant };
}

// Crée l'événement d'essai par la séance, puis passe en écriture.
async function enEcriture(montage, champs = {}) {
  await montage.seance.creer({ nom: BASE, date: null, siegesParDefaut: 2, tours: 2, ...champs });
  await montage.seance.passerEnEcriture();
}

const personne = (id, nom, prenom = null, organisation = null) => ({
  id,
  nom,
  prenom,
  organisation,
  courriel: null,
  titrePressenti: null,
  notes: null,
  exclu: false,
});

// Quatre personnes, deux tables de deux places, deux tours ; Iris Ombrelle
// anime la table 1 : une réservation « tous » au siège 1 et le titre de ce
// siège.
function chargeEssai() {
  const charge = creerCharge({ id: 'evt-lucioles', nom: BASE, siegesParDefaut: 2, tours: 2 });
  charge.prochainsIds = { participant: 5, table: 3, proposition: 1 };
  charge.participants = [
    personne(1, 'Ombrelle', 'Iris', 'Club des Merles'),
    personne(2, 'Grisaille', null, 'Club des Merles'),
    personne(3, 'Pervenche', 'Théo'),
    personne(4, 'Lacasse', 'Ondine', 'Société Alpha'),
  ];
  charge.tables = [1, 2].map((id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 250 * (id - 1), y: 0 } }));
  charge.reservations = [{ participant: 1, table: 1, siege: 1, portee: 'tous', tour: null }];
  charge.titres = [{ table: 1, siege: 1, libelle: 'animation' }];
  return charge;
}

// Pose sur le disque, par le dépôt, l'événement de la charge d'essai.
async function deposerEssai(fs, charge = chargeEssai()) {
  fs.deposerDossier('documents');
  await creerDansLeDepot(fs, DOC, charge, {
    libelle: libelle('ENTREE_CREATION', { nom: charge.evenement.nom }),
    nomJalon: libelle('JALON_CREATION'),
    horodatage: '2031-05-17T07:00:00-04:00',
    produitVersion: V1,
  });
}

// Les arguments d'enregistrerGeneration : une génération courte du moteur.
function generer(charge, nombre = 2, graine = 7) {
  const configuration = configurationDepuisCharge(charge);
  return { propositions: rechercher(configuration, { graine, arret: 40, nombre }), configuration, produitVersion: V1 };
}

// Le journal et l'état que porte le disque.
const journalDe = (fs, racine = 'documents', base = BASE) => lireJournal(fs.contenu(racine, `${base}/${base}${SUFFIXES.journal}`));
const etatDe = (fs, racine = 'documents', base = BASE) => analyser(fs.contenu(racine, `${base}/${base}${SUFFIXES.etat}`));
const libellesDe = (journal) => journal.entrees.map((entree) => entree.libelle);
const verrouDe = (fs, racine = 'documents') => {
  const texte = fs.contenu(racine, VERROU);
  return texte === null ? null : JSON.parse(texte);
};
const noms = (charge) => charge.participants.map(({ nom }) => nom);

// Ouvre base, dans le dossier qui la porte, par la séance d'un montage qui
// ne tient aucun verrou, et constate qu'ouvrir n'écrit rien (§ 8.4).
async function ouvrirSansEcrire({ fs, seance }, base = BASE) {
  const avant = fs.compteurs.ecritures;
  const rendu = await seance.ouvrir(cleEvenement(base, base));
  assert.equal(fs.compteurs.ecritures, avant, 'ouvrir écrit');
  assert.equal(seance.mode, 'lecture');
  return rendu;
}

// Le refus attendu : le code, et les détails quand ils sont donnés. Rend
// l'erreur.
async function refus(promesse, code, details) {
  let erreur;
  await assert.rejects(promesse, (raison) => {
    erreur = raison;
    return true;
  });
  assert.equal(erreur.code, code, `${erreur}`);
  if (details !== undefined) assert.deepEqual(erreur.details, details);
  return erreur;
}

// Les refus de lecture seule de la séance, remède compris.
const FORMAT_SEUL = { raison: 'FORMAT', remede: null };
const BLOQUE_SEUL = { raison: 'BLOQUE', remede: { geste: 'debloquer' } };
const ENCODAGE_SEUL = { raison: 'ENCODAGE', remede: { geste: 'ouvrirSecours', source: 'precedent' } };
// Le remède d'un support rompu : écrire ailleurs, dans la racine proposée.
const versRacine = (racine) => ({ geste: 'ecrireAilleurs', racine });

// --- Les épreuves -----------------------------------------------------------

describe('séance : créer et ouvrir (§ 2.1, § 8.1, § 8.4)', () => {
  test("créer écrit le journal puis l'état, pose le jalon « Création », et laisse l'événement ouvert en lecture", async () => {
    const { fs, seance, identifiant } = monter();
    const avant = fs.compteurs.ecritures;
    const { base } = await seance.creer({ nom: ' Soirée des Lucioles ', date: '2031-05-17', siegesParDefaut: 8, tours: 3 });
    assert.equal(base, BASE);
    // Le dossier de l'événement, le journal, l'état.
    assert.equal(fs.compteurs.ecritures - avant, 3);
    assert.equal(seance.mode, 'lecture');
    assert.equal(verrouDe(fs), null);
    assert.deepEqual(identifiant.tirages, ['seance-1', 'seance-2']);
    assert.deepEqual(seance.charge.evenement, { ...creerCharge({ id: 'seance-2', nom: BASE, date: '2031-05-17', siegesParDefaut: 8, tours: 3 }).evenement });
    const journal = journalDe(fs);
    assert.deepEqual(libellesDe(journal), [CREATION]);
    assert.deepEqual(journal.jalons.map(({ revision, nom }) => [revision, nom]), [[1, 'Création']]);
    assert.equal(etatDe(fs).entete.revision, 1);
  });

  test("une création refusée n'écrit rien et ne tire aucun identifiant", async () => {
    const { fs, seance, identifiant } = monter();
    const avant = fs.compteurs.ecritures;
    await refus(seance.creer({ nom: '  ', date: null, siegesParDefaut: 8, tours: 3 }), 'NOM_REQUIS');
    await refus(seance.creer({ nom: BASE, date: null, siegesParDefaut: 1, tours: 3 }), 'SIEGES_INVALIDES');
    assert.equal(fs.compteurs.ecritures, avant);
    assert.deepEqual(identifiant.tirages, ['seance-1']);
    assert.equal(seance.ouvert, null);
  });

  test("créer ferme l'événement en écriture : son verrou est rendu, et le nouveau s'ouvre en lecture, sans verrou", async () => {
    const montage = monter();
    const { fs, seance, planificateur } = montage;
    await enEcriture(montage);
    assert.equal(verrouDe(fs).seance, seance.id);
    await seance.creer({ nom: 'Soirée des Hiboux', date: null, siegesParDefaut: 2, tours: 1 });
    assert.deepEqual([seance.mode, seance.charge.evenement.nom, planificateur.actives], ['lecture', 'Soirée des Hiboux', 0]);
    assert.equal(verrouDe(fs), null);
    assert.equal(fs.contenu('documents', `Soirée des Hiboux/Soirée des Hiboux${SUFFIXES.verrou}`), null);
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'MODE_LECTURE');
  });

  test("une création refusée laisse l'événement ouvert, son mode et son verrou, sans rien écrire", async () => {
    const montage = monter();
    const { fs, seance } = montage;
    await enEcriture(montage);
    const avant = fs.compteurs.ecritures;
    await refus(seance.creer({ nom: '  ', date: null, siegesParDefaut: 2, tours: 2 }), 'NOM_REQUIS');
    await refus(seance.creer({ nom: 'Soirée des Hiboux', date: '2031-02-30', siegesParDefaut: 2, tours: 2 }), 'DATE_INVALIDE');
    assert.equal(fs.compteurs.ecritures, avant);
    assert.deepEqual([seance.mode, seance.charge.evenement.nom, verrouDe(fs)?.seance], ['ecriture', BASE, seance.id]);
    await seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } });
    assert.deepEqual(libellesDe(journalDe(fs)), [CREATION, 'Ajouté Ancolie']);
  });

  test("ouvrir n'écrit rien et laisse en lecture ; en lecture, un geste, défaire et nommer sont refusés MODE_LECTURE", async () => {
    const fs = creerFichiersSimules();
    await deposerEssai(fs);
    const { seance } = monter({ fs });
    const avant = fs.compteurs.ecritures;
    const { base, avertissements } = await seance.ouvrir(EVT);
    assert.deepEqual([base, avertissements], [BASE, []]);
    assert.equal(fs.compteurs.ecritures, avant, 'ouvrir écrit');
    assert.equal(seance.mode, 'lecture');
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'MODE_LECTURE', { remede: { geste: 'modifier' } });
    await refus(seance.defaire(), 'MODE_LECTURE');
    await refus(seance.revenir(1), 'MODE_LECTURE');
    await refus(seance.nommer('Avant le dessert'), 'MODE_LECTURE');
    assert.equal(fs.compteurs.ecritures, avant, 'un refus écrit');
    assert.match(libelle('MODE_LECTURE'), /« Modifier »/);
  });

  test("ouvrir annonce, parmi les avertissements du dernier geste, ceux qu'on lui confie, sans rien écrire ; une autre ouverture, ou le geste suivant, les retire", async () => {
    const fs = creerFichiersSimules();
    await deposerEssai(fs);
    const { seance } = monter({ fs });
    const annonce = { code: 'LOGOS_NON_COPIES', details: { evenement: BASE, logos: 2, personnes: 3 } };
    const avant = fs.compteurs.ecritures;
    const rendu = await seance.ouvrir(EVT, undefined, { avertissements: [annonce] });
    assert.deepEqual(rendu.avertissements, [annonce]);
    assert.equal(fs.compteurs.ecritures, avant, 'ouvrir écrit');
    assert.deepEqual(seance.etat().avertissements, [annonce]);
    await seance.ouvrir(EVT);
    assert.deepEqual(seance.etat().avertissements, []);
    await seance.ouvrir(EVT, undefined, { avertissements: [annonce] });
    await seance.passerEnEcriture();
    assert.deepEqual(seance.etat().avertissements, []);
  });

  test("ouvrir un secours n'écrit rien et laisse en lecture", async () => {
    const disque = new Map();
    const premier = monter({ fs: creerFichiersSimules({ disque }) });
    await enEcriture(premier);
    await premier.seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } });
    await premier.seance.fermer();
    const second = monter({ fs: creerFichiersSimules({ disque }), prefixe: 'seconde' });
    const avant = second.fs.compteurs.ecritures;
    await second.seance.ouvrirSecours(EVT, 'precedent');
    assert.equal(second.fs.compteurs.ecritures, avant, 'ouvrirSecours écrit');
    assert.equal(second.seance.mode, 'lecture');
    assert.deepEqual([second.seance.ouvert.revision, noms(second.seance.charge)], [1, []]);
  });

  test("ouvrir ferme le précédent sans question : son verrou est rendu, et seul ce rendu s'écrit", async () => {
    const montage = monter();
    const { fs, seance } = montage;
    await enEcriture(montage);
    await creerDansLeDepot(fs, DOC, creerCharge({ id: 'evt-hiboux', nom: 'Soirée des Hiboux', siegesParDefaut: 2, tours: 1 }), {
      libelle: 'Création',
      nomJalon: 'Création',
      horodatage: '2031-05-17T07:00:00-04:00',
      produitVersion: V1,
    });
    assert.notEqual(verrouDe(fs), null);
    const avant = fs.compteurs.ecritures;
    await seance.ouvrir(cleEvenement('Soirée des Hiboux', 'Soirée des Hiboux'));
    assert.equal(fs.compteurs.ecritures - avant, 1);
    assert.equal(verrouDe(fs), null);
    assert.deepEqual([seance.mode, seance.charge.evenement.nom], ['lecture', 'Soirée des Hiboux']);
  });

  test("un événement qui ne s'ouvre pas laisse la séance sans événement, le précédent fermé", async () => {
    const montage = monter();
    await enEcriture(montage);
    const avant = montage.fs.compteurs.ecritures;
    await refus(montage.seance.ouvrir(cleEvenement('Soirée absente', 'Soirée absente')), 'ABSENT');
    assert.equal(montage.fs.compteurs.ecritures - avant, 1, "seul le rendu du verrou s'écrit");
    assert.equal(verrouDe(montage.fs), null);
    assert.deepEqual([montage.seance.ouvert, montage.seance.charge, montage.seance.mode], [null, null, 'lecture']);
  });

  test("sans événement ouvert, chaque geste est refusé AUCUN_EVENEMENT, sans écriture", async () => {
    const { fs, seance } = monter();
    const avant = fs.compteurs.ecritures;
    await refus(seance.passerEnEcriture(), 'AUCUN_EVENEMENT');
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'AUCUN_EVENEMENT');
    await refus(seance.defaire(), 'AUCUN_EVENEMENT');
    await refus(seance.debloquer(), 'AUCUN_EVENEMENT');
    await refus(seance.nommer('Jalon'), 'AUCUN_EVENEMENT');
    await refus(seance.ecrireAilleurs(DOC), 'AUCUN_EVENEMENT');
    assert.equal(fs.compteurs.ecritures, avant);
    assert.deepEqual(seance.retours, { defaire: false, refaire: false, jalons: 0 });
  });
});

describe("séance : le verrou, pris à l'entrée en écriture (§ 8.8)", () => {
  test("passer en écriture prend le verrou de la séance ; le redemander ne refait rien", async () => {
    const montage = monter();
    await enEcriture(montage);
    assert.equal(montage.seance.mode, 'ecriture');
    assert.equal(verrouDe(montage.fs).seance, montage.seance.id);
    assert.equal(montage.seance.id, 'seance-1');
    const avant = montage.fs.compteurs.ecritures;
    assert.deepEqual(await montage.seance.passerEnEcriture(), { avertissements: [] });
    assert.equal(montage.fs.compteurs.ecritures, avant);
  });

  test('une seconde séance sur le même disque ouvre en lecture, et son passage en écriture est refusé VERROU_PRIS', async () => {
    const disque = new Map();
    const premier = monter({ fs: creerFichiersSimules({ disque }), prefixe: 'premiere' });
    await enEcriture(premier);
    const { depuis } = verrouDe(premier.fs);
    const second = monter({ fs: creerFichiersSimules({ disque }), prefixe: 'seconde' });
    await ouvrirSansEcrire(second);
    const details = { seance: 'premiere-1', depuis, vivant: true };
    await refus(second.seance.passerEnEcriture(), 'VERROU_PRIS', { ...details, remede: null });
    assert.equal(second.seance.mode, 'lecture');
    assert.deepEqual(second.seance.verrouAutre, details);
    assert.equal(verrouDe(second.fs).seance, 'premiere-1');
    await refus(second.seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'MODE_LECTURE');
  });

  test("le verrou porte l'instant de l'horloge de la séance : VERROU_PRIS le rend à une seconde séance", async () => {
    const disque = new Map();
    const pilote = '2031-05-17T19:42:00-04:00';
    const premier = monter({ fs: creerFichiersSimules({ disque }), prefixe: 'premiere', horloge: { horodatage: () => pilote } });
    await enEcriture(premier);
    assert.equal(verrouDe(premier.fs).depuis, pilote);
    const second = monter({ fs: creerFichiersSimules({ disque }), prefixe: 'seconde' });
    await ouvrirSansEcrire(second);
    await refus(second.seance.passerEnEcriture(), 'VERROU_PRIS', { seance: 'premiere-1', depuis: pilote, vivant: true, remede: null });
  });

  test("le verrou d'une séance morte du même poste se reprend, et l'avertissement le dit", async () => {
    const disque = new Map();
    const premier = monter({ fs: creerFichiersSimules({ disque }), prefixe: 'premiere' });
    await enEcriture(premier);
    const { depuis } = verrouDe(premier.fs);
    premier.fs.pannes.couperApres(0);
    const second = monter({ fs: creerFichiersSimules({ disque }), prefixe: 'seconde' });
    await ouvrirSansEcrire(second);
    const repris = [{ code: 'VERROU_REPRIS', details: { seance: 'premiere-1', depuis } }];
    assert.deepEqual(await second.seance.passerEnEcriture(), { avertissements: repris });
    assert.equal(second.seance.mode, 'ecriture');
    assert.equal(verrouDe(second.fs).seance, 'seconde-1');
    assert.deepEqual(second.seance.avertissements, repris);
    assert.equal(second.seance.verrouAutre, null);
  });

  test("le verrou d'un autre poste, ou illisible, ne se reprend pas", async () => {
    const disque = new Map();
    const premier = monter({ fs: creerFichiersSimules({ disque }), prefixe: 'premiere' });
    await enEcriture(premier);
    const { depuis } = verrouDe(premier.fs);
    const lointain = monter({ fs: creerFichiersSimules({ disque, hote: 'autre-poste' }), prefixe: 'lointaine' });
    await ouvrirSansEcrire(lointain);
    await refus(lointain.seance.passerEnEcriture(), 'VERROU_PRIS', { seance: 'premiere-1', depuis, vivant: null, remede: null });
    premier.fs.deposer('documents', VERROU, 'pas un verrou\n');
    const voisin = monter({ fs: creerFichiersSimules({ disque }), prefixe: 'voisine' });
    await ouvrirSansEcrire(voisin);
    await refus(voisin.seance.passerEnEcriture(), 'VERROU_PRIS', { seance: null, depuis: null, vivant: null, remede: null });
    assert.equal(premier.fs.contenu('documents', VERROU), 'pas un verrou\n');
  });

  test('sans verrou disponible, passer en écriture ne pose aucun fichier', async () => {
    const montage = monter({ fs: creerFichiersSimules({ verrouDisponible: false }) });
    await enEcriture(montage);
    assert.equal(montage.seance.mode, 'ecriture');
    assert.equal(verrouDe(montage.fs), null);
    await montage.seance.passerEnLecture();
    assert.equal(montage.seance.mode, 'lecture');
  });

  test("fermer rend le verrou et oublie l'événement", async () => {
    const montage = monter();
    await enEcriture(montage);
    await montage.seance.fermer();
    assert.equal(verrouDe(montage.fs), null);
    assert.deepEqual([montage.seance.ouvert, montage.seance.mode, montage.planificateur.actives], [null, 'lecture', 0]);
  });
});

describe('séance : reprendre le verrou que la séance ne reprend pas seule (§ 8.8)', () => {
  // Un verrou posé sur le disque partagé par une séance d'un autre poste, à
  // l'instant depuis.
  const verrouLointain = (seance, depuis) => `${JSON.stringify({ seance, pid: 41, hote: 'poste-lointain', depuis })}\n`;

  // Une séance d'épreuve qui ouvre en lecture l'événement d'essai, créé par
  // une première séance, déjà fermée, sur le même disque.
  async function secondeSeance(disque, hote = 'autre-poste') {
    const premier = monter({ fs: creerFichiersSimules({ disque }), prefixe: 'createur' });
    await premier.seance.creer({ nom: BASE, date: null, siegesParDefaut: 2, tours: 2 });
    await premier.seance.fermer();
    const second = monter({ fs: creerFichiersSimules({ disque, hote }), prefixe: 'reprise' });
    await ouvrirSansEcrire(second);
    return second;
  }

  test("le verrou d'un autre poste, refusé puis repris : il s'efface, la séance prend le sien et passe en écriture, VERROU_REPRIS le dit", async () => {
    const disque = new Map();
    const premier = monter({ fs: creerFichiersSimules({ disque }), prefixe: 'premiere' });
    await enEcriture(premier);
    const { depuis } = verrouDe(premier.fs);
    const lointain = monter({ fs: creerFichiersSimules({ disque, hote: 'autre-poste' }), prefixe: 'lointaine' });
    await ouvrirSansEcrire(lointain);
    await refus(lointain.seance.passerEnEcriture(), 'VERROU_PRIS', { seance: 'premiere-1', depuis, vivant: null, remede: null });
    assert.deepEqual(lointain.seance.etat().verrouAutre, { seance: 'premiere-1', depuis, vivant: null });
    const journal = lointain.fs.contenu('documents', JOURNAL);
    const repris = [{ code: 'VERROU_REPRIS', details: { seance: 'premiere-1', depuis } }];
    assert.deepEqual(await lointain.seance.reprendreVerrou(), { avertissements: repris });
    assert.equal(lointain.seance.mode, 'ecriture');
    assert.equal(verrouDe(lointain.fs).seance, 'lointaine-1');
    assert.equal(lointain.fs.contenu('documents', JOURNAL), journal, 'reprendre n\u{2019}écrit aucune entrée');
    const etat = lointain.seance.etat();
    assert.equal(etat.verrouAutre, null);
    assert.deepEqual(etat.avertissements, repris);
    assert.equal(etat.refus, null);
    await lointain.seance.executer('ajouterParticipant', { champs: { nom: 'Ombrelle', prenom: 'Iris' } });
    assert.deepEqual(noms(etatDe(lointain.fs).charge), ['Ombrelle']);
  });

  test('un verrou illisible se reprend de même, sous VERROU_REPRIS {seance: null, depuis: null}', async () => {
    const disque = new Map();
    const second = await secondeSeance(disque, 'poste-epreuve');
    second.fs.deposer('documents', VERROU, 'pas un verrou\n');
    await refus(second.seance.passerEnEcriture(), 'VERROU_PRIS', { seance: null, depuis: null, vivant: null, remede: null });
    const repris = [{ code: 'VERROU_REPRIS', details: { seance: null, depuis: null } }];
    assert.deepEqual(await second.seance.reprendreVerrou(), { avertissements: repris });
    assert.equal(second.seance.mode, 'ecriture');
    assert.equal(verrouDe(second.fs).seance, 'reprise-1');
  });

  test("un verrou illisible remplacé par un valide entre sa relecture et son effacement : le valide reste, et VERROU_PRIS le nomme", async () => {
    const disque = new Map();
    const second = await secondeSeance(disque, 'poste-epreuve');
    second.fs.deposer('documents', VERROU, 'pas un verrou\n');
    await refus(second.seance.passerEnEcriture(), 'VERROU_PRIS', { seance: null, depuis: null, vivant: null, remede: null });
    // Le système de la séance pose un verrou valide juste après avoir rendu
    // l'illisible à la reprise, comme une autre séance qui le prendrait
    // entre deux appels.
    const pose = '2031-05-17T09:15:00-04:00';
    const valide = verrouLointain('lointaine-6', pose);
    const verrouiller = second.fs.verrouiller;
    let substituer = true;
    second.fs.verrouiller = async (...parametres) => {
      const rendu = await verrouiller(...parametres);
      if (substituer && rendu.pris === false && rendu.seance === null) {
        substituer = false;
        second.fs.deposer('documents', VERROU, valide);
      }
      return rendu;
    };
    const details = { seance: 'lointaine-6', depuis: pose, vivant: null };
    await refus(second.seance.reprendreVerrou(), 'VERROU_PRIS', { ...details, remede: null });
    assert.equal(second.fs.contenu('documents', VERROU), valide);
    assert.equal(second.seance.mode, 'lecture');
    assert.deepEqual(second.seance.etat().verrouAutre, details);
  });

  test('un verrou illisible disparu entre le refus et sa relecture : la relecture prend le verrou, la séance le reconnaît comme le sien, VERROU_REPRIS puis écriture', async () => {
    const disque = new Map();
    const second = await secondeSeance(disque, 'poste-epreuve');
    second.fs.deposer('documents', VERROU, 'pas un verrou\n');
    await refus(second.seance.passerEnEcriture(), 'VERROU_PRIS', { seance: null, depuis: null, vivant: null, remede: null });
    // Le fichier disparaît juste avant le deuxième appel de la reprise, la
    // relecture d'effacerVerrou, qui pose alors le verrou de la séance.
    const verrouiller = second.fs.verrouiller;
    let appels = 0;
    second.fs.verrouiller = async (racine, chemin, ...reste) => {
      appels += 1;
      if (appels === 2) await second.fs.supprimer(racine, chemin);
      return verrouiller(racine, chemin, ...reste);
    };
    const repris = [{ code: 'VERROU_REPRIS', details: { seance: null, depuis: null } }];
    assert.deepEqual(await second.seance.reprendreVerrou(), { avertissements: repris });
    assert.equal(second.seance.mode, 'ecriture');
    assert.equal(verrouDe(second.fs).seance, 'reprise-1');
    assert.equal(second.seance.etat().verrouAutre, null);
    await second.seance.executer('ajouterParticipant', { champs: { nom: 'Ombrelle', prenom: 'Iris' } });
    assert.deepEqual(noms(etatDe(second.fs).charge), ['Ombrelle']);
  });

  test("un verrou qui a changé depuis le refus ne s'efface pas : VERROU_PRIS nomme le nouveau, que verrouAutre garde", async () => {
    const disque = new Map();
    const second = await secondeSeance(disque);
    const vu = '2031-05-17T09:00:00-04:00';
    second.fs.deposer('documents', VERROU, verrouLointain('lointaine-1', vu));
    await refus(second.seance.passerEnEcriture(), 'VERROU_PRIS', { seance: 'lointaine-1', depuis: vu, vivant: null, remede: null });
    const pose = '2031-05-17T09:30:00-04:00';
    const nouveau = verrouLointain('lointaine-2', pose);
    second.fs.deposer('documents', VERROU, nouveau);
    const details = { seance: 'lointaine-2', depuis: pose, vivant: null };
    await refus(second.seance.reprendreVerrou(), 'VERROU_PRIS', { ...details, remede: null });
    assert.equal(second.fs.contenu('documents', VERROU), nouveau);
    assert.equal(second.seance.mode, 'lecture');
    assert.deepEqual(second.seance.etat().verrouAutre, details);
    const repris = [{ code: 'VERROU_REPRIS', details: { seance: 'lointaine-2', depuis: pose } }];
    assert.deepEqual(await second.seance.reprendreVerrou(), { avertissements: repris });
    assert.equal(verrouDe(second.fs).seance, 'reprise-1');
  });

  // Le verrou vu, puis remplacé par celui que décrit change : la reprise
  // le refuse VERROU_PRIS avec les détails du nouveau, ne touche pas au
  // fichier, et verrouAutre garde le nouveau.
  async function repriseRefusee(seance, depuis) {
    const second = await secondeSeance(new Map());
    const vu = '2031-05-17T09:00:00-04:00';
    second.fs.deposer('documents', VERROU, verrouLointain('lointaine-1', vu));
    await refus(second.seance.passerEnEcriture(), 'VERROU_PRIS', { seance: 'lointaine-1', depuis: vu, vivant: null, remede: null });
    const nouveau = verrouLointain(seance, depuis);
    second.fs.deposer('documents', VERROU, nouveau);
    const details = { seance, depuis, vivant: null };
    await refus(second.seance.reprendreVerrou(), 'VERROU_PRIS', { ...details, remede: null });
    assert.equal(second.fs.contenu('documents', VERROU), nouveau);
    assert.equal(second.seance.mode, 'lecture');
    assert.deepEqual(second.seance.etat().verrouAutre, details);
  }

  test("la même séance reprise à un instant plus tard : le verrou n'est plus celui que l'opérateur a vu, il ne s'efface pas", async () => {
    await repriseRefusee('lointaine-1', '2031-05-17T09:45:00-04:00');
  });

  test("une autre séance au même instant : le verrou n'est plus celui que l'opérateur a vu, il ne s'efface pas", async () => {
    await repriseRefusee('lointaine-5', '2031-05-17T09:00:00-04:00');
  });

  test("le verrou d'une séance vivante de ce poste ne se reprend jamais", async () => {
    const disque = new Map();
    const premier = monter({ fs: creerFichiersSimules({ disque }), prefixe: 'premiere' });
    await enEcriture(premier);
    const { depuis } = verrouDe(premier.fs);
    const voisin = monter({ fs: creerFichiersSimules({ disque }), prefixe: 'voisine' });
    await ouvrirSansEcrire(voisin);
    const details = { seance: 'premiere-1', depuis, vivant: true };
    await refus(voisin.seance.passerEnEcriture(), 'VERROU_PRIS', { ...details, remede: null });
    await refus(voisin.seance.reprendreVerrou(), 'VERROU_PRIS', { ...details, remede: null });
    assert.equal(verrouDe(voisin.fs).seance, 'premiere-1');
    assert.equal(voisin.seance.mode, 'lecture');
  });

  test("sans verrou refusé, reprendre est passer en écriture : un verrou posé depuis n'est pas repris", async () => {
    const second = await secondeSeance(new Map());
    const pose = '2031-05-17T10:00:00-04:00';
    second.fs.deposer('documents', VERROU, verrouLointain('lointaine-3', pose));
    await refus(second.seance.reprendreVerrou(), 'VERROU_PRIS', { seance: 'lointaine-3', depuis: pose, vivant: null, remede: null });
    assert.equal(verrouDe(second.fs).seance, 'lointaine-3');
    const libre = await secondeSeance(new Map());
    assert.deepEqual(await libre.seance.reprendreVerrou(), { avertissements: [] });
    assert.deepEqual([libre.seance.mode, verrouDe(libre.fs).seance], ['ecriture', 'reprise-1']);
  });

  test('sans verrou refusé, reprendre sur un plan bloqué lève LECTURE_SEULE BLOQUE comme passer en écriture, sans rien écrire', async () => {
    const montage = monter();
    const { fs, seance } = montage;
    await enEcriture(montage);
    await seance.executer('changerEtat', { etat: 'bloque' });
    await seance.passerEnLecture();
    assert.equal(seance.etat().verrouAutre, null);
    const avant = fs.compteurs.ecritures;
    await refus(seance.reprendreVerrou(), 'LECTURE_SEULE', BLOQUE_SEUL);
    assert.equal(fs.compteurs.ecritures, avant);
    assert.deepEqual([seance.mode, seance.charge.evenement.etat, verrouDe(fs)], ['lecture', 'bloque', null]);
  });

  test('sur un plan bloqué, la reprise rend aussitôt le verrou : la séance reste en lecture, et débloquer passe ensuite', async () => {
    const montage = monter({ prefixe: 'bloqueuse' });
    const { fs, seance } = montage;
    await enEcriture(montage);
    await seance.executer('changerEtat', { etat: 'bloque' });
    const depuis = '2031-05-17T11:00:00-04:00';
    fs.deposer('documents', VERROU, verrouLointain('lointaine-4', depuis));
    await refus(seance.debloquer(), 'VERROU_PRIS', { seance: 'lointaine-4', depuis, vivant: null, remede: null });
    const journal = fs.contenu('documents', JOURNAL);
    const repris = [{ code: 'VERROU_REPRIS', details: { seance: 'lointaine-4', depuis } }];
    assert.deepEqual(await seance.reprendreVerrou(), { avertissements: repris });
    assert.deepEqual([seance.mode, seance.charge.evenement.etat], ['lecture', 'bloque']);
    assert.equal(verrouDe(fs), null);
    assert.equal(fs.contenu('documents', JOURNAL), journal);
    assert.deepEqual(seance.etat().avertissements, repris);
    assert.deepEqual(seance.etat().refus, { code: 'LECTURE_SEULE', details: BLOQUE_SEUL });
    await seance.debloquer();
    assert.deepEqual([seance.mode, seance.charge.evenement.etat], ['ecriture', 'brouillon']);
  });

  test("en écriture, reprendre ne fait rien ; un format plus récent et un support rompu le refusent sans rien écrire", async () => {
    const montage = monter();
    await enEcriture(montage);
    const avant = montage.fs.compteurs.ecritures;
    assert.deepEqual(await montage.seance.reprendreVerrou(), { avertissements: [] });
    assert.equal(montage.fs.compteurs.ecritures, avant);
    montage.fs.pannes.ecriture('documents');
    await refus(montage.seance.executer('ajouterParticipant', { champs: { nom: 'Pervenche' } }), 'ECRITURE');
    await montage.seance.passerEnLecture();
    const rompu = montage.fs.compteurs.ecritures;
    await refus(montage.seance.reprendreVerrou(), 'SUPPORT_ROMPU');
    assert.equal(montage.fs.compteurs.ecritures, rompu);
    const fsRecent = creerFichiersSimules();
    deposerAuFormat(fsRecent, FORMAT + 1);
    const recent = monter({ fs: fsRecent });
    await ouvrirSansEcrire(recent);
    await refus(recent.seance.reprendreVerrou(), 'LECTURE_SEULE', FORMAT_SEUL);
  });
});

describe("séance : l'inactivité (§ 8.4)", () => {
  test('au terme du délai, la séance revient seule en lecture et rend son verrou', async () => {
    const montage = monter();
    await enEcriture(montage);
    await montage.planificateur.avancer(INACTIVITE_MS - 1);
    assert.equal(montage.seance.mode, 'ecriture');
    await montage.planificateur.avancer(1);
    assert.equal(montage.seance.mode, 'lecture');
    assert.equal(verrouDe(montage.fs), null);
    assert.equal(montage.planificateur.actives, 0);
    assert.equal(INACTIVITE_MS, 10 * 60 * 1000);
  });

  test("pendant un geste ouvert, rien ne tombe ; les gestes s'emboîtent ; le dernier fini, le compte repart", async () => {
    const montage = monter();
    const { seance, planificateur } = montage;
    await enEcriture(montage);
    assert.equal(planificateur.actives, 1);
    seance.debuterGeste();
    seance.debuterGeste();
    assert.equal(planificateur.actives, 0, 'un geste ouvert laisse une minuterie armée');
    await planificateur.avancer(3 * INACTIVITE_MS);
    assert.equal(seance.mode, 'ecriture');
    seance.finirGeste();
    assert.equal(planificateur.actives, 0, 'le geste encore ouvert laisse une minuterie armée');
    await seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } });
    assert.equal(planificateur.actives, 0, 'un geste achevé arme le compte malgré le geste ouvert');
    await planificateur.avancer(2 * INACTIVITE_MS);
    assert.equal(seance.mode, 'ecriture');
    seance.finirGeste();
    assert.equal(planificateur.actives, 1);
    await planificateur.avancer(INACTIVITE_MS - 1);
    assert.equal(seance.mode, 'ecriture');
    await planificateur.avancer(1);
    assert.equal(seance.mode, 'lecture');
    assert.equal(verrouDe(montage.fs), null);
  });

  test("pendant un calcul ouvert, rien ne tombe ; fini, le compte repart ; un calcul fini de trop ne compte pas", async () => {
    const montage = monter();
    const { seance, planificateur } = montage;
    await enEcriture(montage);
    seance.debuterCalcul();
    assert.equal(seance.calculEnCours, true);
    assert.equal(planificateur.actives, 0, 'un calcul ouvert laisse une minuterie armée');
    await planificateur.avancer(2 * INACTIVITE_MS);
    assert.equal(seance.mode, 'ecriture');
    seance.finirCalcul();
    seance.finirCalcul();
    assert.equal(seance.calculEnCours, false);
    seance.debuterCalcul();
    await planificateur.avancer(2 * INACTIVITE_MS);
    assert.equal(seance.mode, 'ecriture', 'le calcul fini de trop a compté contre le suivant');
    seance.finirCalcul();
    await planificateur.avancer(INACTIVITE_MS);
    assert.equal(seance.mode, 'lecture');
  });

  test('chaque geste achevé relance le compte ; le délai se règle', async () => {
    const montage = monter({ inactiviteMs: 5000 });
    const { seance, planificateur } = montage;
    await enEcriture(montage);
    await planificateur.avancer(4000);
    await seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } });
    await planificateur.avancer(4000);
    assert.equal(seance.mode, 'ecriture');
    await refus(seance.executer('ajouterParticipant', { champs: { nom: ' ' } }), 'NOM_REQUIS');
    await planificateur.avancer(4000);
    assert.equal(seance.mode, 'ecriture', 'un geste refusé est une activité');
    await planificateur.avancer(1000);
    assert.equal(seance.mode, 'lecture');
  });

  test('passer en lecture annule le geste en cours et rend le verrou ; repassé en écriture, le compte court', async () => {
    const montage = monter();
    const { seance, planificateur } = montage;
    await enEcriture(montage);
    seance.debuterGeste();
    await seance.passerEnLecture();
    assert.equal(seance.mode, 'lecture');
    assert.equal(verrouDe(montage.fs), null);
    assert.equal(planificateur.actives, 0);
    await seance.passerEnEcriture();
    await planificateur.avancer(INACTIVITE_MS);
    assert.equal(seance.mode, 'lecture');
  });
});

describe('séance : un geste, une entrée, un état (§ 2.1, § 8.2, § 10.1)', () => {
  test("un geste écrit le journal puis l'état ; son libellé reste figé quand on renomme la personne", async () => {
    const montage = monter();
    const { fs, seance } = montage;
    await enEcriture(montage);
    const avant = fs.compteurs.ecritures;
    const rendu = await seance.executer('ajouterParticipant', { champs: { nom: 'Ombrelle', prenom: 'Iris' } });
    // L'événement neuf n'a aucune table : la première personne manque d'une place.
    const manque = [{ code: 'PLACES_MANQUANTES', details: { placesManquantes: 1 } }];
    assert.deepEqual(rendu, { libelle: 'Ajouté Iris Ombrelle', avertissements: manque });
    assert.equal(fs.compteurs.ecritures - avant, 3, "la ligne, le .precedent, l'état");
    await seance.executer('modifierParticipant', { id: 1, champs: { nom: 'Parasol' } });
    const journal = journalDe(fs);
    assert.deepEqual(libellesDe(journal), [CREATION, 'Ajouté Iris Ombrelle', 'Modifié Iris Ombrelle : nom (désormais Iris Parasol)']);
    assert.deepEqual(etatDe(fs).charge, reconstruire(journal, 3));
    assert.equal(etatDe(fs).entete.revision, 3);
    assert.deepEqual(noms(seance.charge), ['Parasol']);
  });

  test("deux gestes lancés sans attendre écrivent deux entrées, dans l'ordre", async () => {
    const montage = monter();
    await enEcriture(montage);
    const premier = montage.seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } });
    const second = montage.seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } });
    await Promise.all([premier, second]);
    assert.deepEqual(libellesDe(journalDe(montage.fs)), [CREATION, 'Ajouté Ancolie', 'Ajouté Bruyère']);
    assert.deepEqual(montage.seance.charge.participants.map(({ id, nom }) => [id, nom]), [[1, 'Ancolie'], [2, 'Bruyère']]);
  });

  test("un geste sans effet, ou refusé par sa commande, n'écrit rien", async () => {
    const montage = monter();
    const { fs, seance } = montage;
    await enEcriture(montage);
    await seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } });
    const avant = fs.compteurs.ecritures;
    await refus(seance.executer('modifierParticipant', { id: 1, champs: { nom: 'Ancolie' } }), 'SANS_EFFET');
    await refus(seance.executer('exclureParticipant', { id: 7 }), 'PARTICIPANT_INCONNU');
    await refus(seance.executer('changerEtat', { etat: 'retenu' }), 'AUCUN_RETENU');
    await assert.rejects(seance.executer('commandeInventee', {}), TypeError);
    assert.equal(fs.compteurs.ecritures, avant);
  });

  test("nommer l'instant courant pose un jalon, sans entrée", async () => {
    const montage = monter();
    await enEcriture(montage);
    await montage.seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } });
    const avant = montage.fs.compteurs.ecritures;
    await montage.seance.nommer('  Avant le dessert ');
    assert.equal(montage.fs.compteurs.ecritures - avant, 1);
    const journal = journalDe(montage.fs);
    assert.equal(journal.entrees.length, 2);
    assert.deepEqual(journal.jalons.at(-1), { type: 'jalon', revision: 2, nom: 'Avant le dessert', horodatage: journal.jalons.at(-1).horodatage });
    await refus(montage.seance.nommer(' '), 'NOM_REQUIS');
  });

  test("un import est une seule entrée ; en brouillon, il ne dit que le manque de places, et en retenu l'import et la dérive (§ 10.1, § 5.9)", async () => {
    const fs = creerFichiersSimules();
    await deposerEssai(fs);
    const montage = monter({ fs });
    const { seance } = montage;
    await ouvrirSansEcrire(montage);
    await seance.passerEnEcriture();
    const csv = 'nom;prenom\nAncolie;Bastien\nBruyère;Capucine\nCerfeuil;Damien\n';
    const entrees = journalDe(fs).entrees.length;
    const rendu = await seance.executer('importerParticipants', { apercu: apercevoir(csv, { participants: seance.charge.participants }), mode: 'ajouter' });
    assert.equal(rendu.libelle, 'Importé 3 participants');
    assert.deepEqual(rendu.avertissements, [{ code: 'PLACES_MANQUANTES', details: { placesManquantes: 3 } }]);
    assert.equal(rendu.resume.ajoutes, 3);
    assert.equal(journalDe(fs).entrees.length, entrees + 1);
    assert.equal(seance.charge.participants.length, 7);

    await seance.executer('supprimerParticipant', { id: 7 });
    await seance.executer('supprimerParticipant', { id: 6 });
    await seance.executer('supprimerParticipant', { id: 5 });
    await seance.executer('enregistrerGeneration', generer(seance.charge));
    await seance.executer('retenirProposition', { id: 1 });
    const plus = apercevoir('nom\nEpicéa\n', { participants: seance.charge.participants });
    const enRetenu = await seance.executer('importerParticipants', { apercu: plus, mode: 'ajouter' });
    const nonPlace = [{ code: 'PARTICIPANT_NON_PLACE', participant: 8, personne: 'Epicéa' }];
    // Le retenu suit l'import, l'arrivée en réserve : seules les propositions dérivent.
    assert.equal(enRetenu.libelle, 'Importé 1 participant ; placement retenu ajusté');
    assert.deepEqual(enRetenu.avertissements, [
      { code: 'IMPORT_EN_RETENU', details: {} },
      { code: 'PLACES_MANQUANTES', details: { placesManquantes: 1 } },
      { code: 'DERIVE_NOUVELLE', details: { touchees: [{ id: 1, raisons: nonPlace }, { id: 2, raisons: nonPlace }] } },
    ]);
    // La séance montre aussi la dérive que l'Ouvert écrit porte désormais.
    assert.deepEqual(seance.avertissements, [...seance.ouvert.avertissements, ...enRetenu.avertissements]);
    assert.deepEqual(seance.ouvert.avertissements.map(({ code }) => code), ['DERIVE']);
  });

  test("importer sur un plan bloqué est refusé, et le texte du refus nomme « Débloquer »", async () => {
    const montage = monter();
    const { fs, seance } = montage;
    await enEcriture(montage);
    await seance.executer('changerEtat', { etat: 'bloque' });
    const avant = fs.compteurs.ecritures;
    const apercu = apercevoir('nom\nAncolie\n', { participants: [] });
    const erreur = await refus(seance.executer('importerParticipants', { apercu, mode: 'ajouter' }), 'LECTURE_SEULE', BLOQUE_SEUL);
    assert.match(libelle(erreur.code, erreur.details), /« Débloquer »/);
    assert.equal(fs.compteurs.ecritures, avant);
  });

  test("exclure une personne réservée suspend ses réservations, son titre n'est plus pourvu, et l'avertissement le dit ; la réintégrer les rend (§ 4.4)", async () => {
    const fs = creerFichiersSimules();
    await deposerEssai(fs);
    const montage = monter({ fs });
    const { seance } = montage;
    await ouvrirSansEcrire(montage);
    await seance.passerEnEcriture();
    const exclusion = await seance.executer('exclureParticipant', { id: 1 });
    assert.deepEqual(exclusion, {
      libelle: 'Exclu Iris Ombrelle',
      avertissements: [{ code: 'RESERVATIONS_SUSPENDUES', details: { participant: 1, personne: 'Iris Ombrelle', reservations: 1, titres: 1 } }],
    });
    assert.deepEqual([seance.charge.participants[0].exclu, seance.charge.reservations.length], [true, 1]);
    assert.deepEqual(seance.avertissements, exclusion.avertissements);
    const retour = await seance.executer('reintegrerParticipant', { id: 1 });
    assert.deepEqual(retour.avertissements, [
      { code: 'RESERVATIONS_RETABLIES', details: { participant: 1, personne: 'Iris Ombrelle', reservations: 1, titres: 1 } },
    ]);
    assert.equal(seance.charge.participants[0].exclu, false);
  });
});

describe("séance : ce qu'un import dit, et ce que la séance montre (§ 4.4, § 9, § 10.1)", () => {
  // L'événement d'essai, ouvert depuis le disque, en écriture.
  async function essaiEnEcriture() {
    const fs = creerFichiersSimules();
    await deposerEssai(fs);
    const montage = monter({ fs });
    await ouvrirSansEcrire(montage);
    await montage.seance.passerEnEcriture();
    return montage;
  }
  const mettreAJour = (seance, csv) =>
    seance.executer('importerParticipants', {
      apercu: apercevoir(csv, { participants: seance.charge.participants, mode: 'mettreAJour' }),
      mode: 'mettreAJour',
    });

  test("un import qui exclut l'animatrice réservée dit ses réservations suspendues et son titre non pourvu, comme exclure (§ 4.4)", async () => {
    const { seance } = await essaiEnEcriture();
    const rendu = await mettreAJour(seance, 'nom;prenom;exclu\nOmbrelle;Iris;oui\n');
    const suspendues = { participant: 1, personne: 'Iris Ombrelle', reservations: 1, titres: 1 };
    assert.equal(rendu.libelle, 'Mis à jour la liste par import : 0 ajouté, 1 modifié');
    assert.deepEqual(rendu.avertissements, [{ code: 'RESERVATIONS_SUSPENDUES', details: suspendues }]);
    assert.equal(seance.charge.participants[0].exclu, true);
    const retour = await mettreAJour(seance, 'nom;prenom;exclu\nOmbrelle;Iris;non\n');
    assert.deepEqual(retour.avertissements, [{ code: 'RESERVATIONS_RETABLIES', details: suspendues }]);
  });

  test("un import dont les lignes valides ne changent rien, mais qui refuse des lignes, n'écrit rien et rend son résumé", async () => {
    const { fs, seance } = await essaiEnEcriture();
    await seance.executer('ajouterParticipant', { champs: { nom: 'Lacasse', prenom: 'Ondine' } });
    const avant = fs.compteurs.ecritures;
    const entrees = journalDe(fs).entrees.length;
    const rendu = await mettreAJour(seance, 'nom;prenom;courriel\nLacasse;Ondine;o@exemple.test\nPervenche;Théo;\n');
    assert.equal(rendu.libelle, null);
    assert.deepEqual(rendu.avertissements, []);
    assert.deepEqual(rendu.resume.refusees.map(({ ligne, code }) => [ligne, code]), [[2, 'PLUSIEURS_CORRESPONDENT']]);
    assert.equal(fs.compteurs.ecritures, avant);
    assert.equal(journalDe(fs).entrees.length, entrees);
    assert.deepEqual(seance.avertissements, []);
  });

  test("après un geste, la séance montre les avertissements de l'Ouvert écrit : la dérive paraît et s'en va (§ 9)", async () => {
    const { seance } = await essaiEnEcriture();
    await seance.executer('enregistrerGeneration', generer(seance.charge));
    await seance.executer('retenirProposition', { id: 1 });
    assert.deepEqual(seance.avertissements, []);
    const exclusion = await seance.executer('exclureParticipant', { id: 2 });
    assert.deepEqual(codesDe(exclusion.avertissements), ['RENCONTRES_RETIREES_DU_RETENU', 'DERIVE_NOUVELLE']);
    assert.deepEqual(seance.avertissements.map(({ code }) => code), ['DERIVE', 'RENCONTRES_RETIREES_DU_RETENU', 'DERIVE_NOUVELLE']);
    assert.deepEqual(seance.avertissements, [...seance.ouvert.avertissements, ...exclusion.avertissements]);
    // Le retenu suit l'exclusion : seules les propositions dérivent.
    assert.equal(seance.avertissements[0].details.retenu, false);
    await seance.executer('reintegrerParticipant', { id: 2 });
    // Réintégrée, elle attend en réserve du retenu ; plus rien ne dérive.
    assert.deepEqual(codesDe(seance.avertissements), ['A_PLACER_DANS_LE_RETENU']);
  });

  test("le journal incomplet de l'ouverture ne s'affiche plus une fois la reprise écrite", async () => {
    const fs = creerFichiersSimules();
    await deposerEssai(fs);
    const plus = chargeEssai();
    plus.participants.push(personne(5, 'Ancolie'));
    plus.prochainsIds.participant = 6;
    fs.deposer('documents', ETAT, serialiser(plus, { revision: 4, produitVersion: V1 }));
    const montage = monter({ fs });
    const { seance } = montage;
    await ouvrirSansEcrire(montage);
    const incomplet = [{ code: 'JOURNAL_INCOMPLET', details: { etat: 4, journal: 1 } }];
    assert.deepEqual(seance.avertissements, incomplet);
    await seance.passerEnEcriture();
    assert.deepEqual(seance.avertissements, incomplet);
    await seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } });
    // Cinq personnes déjà pour quatre places : seul le manque, qui croît, se dit.
    assert.deepEqual(seance.avertissements, [{ code: 'PLACES_MANQUANTES', details: { placesManquantes: 2 } }]);
  });
});

describe('séance : la forme nommée se lit sans rien écrire (§ 8.9, point 4)', () => {
  test("la forme nommée d'une proposition ou du retenu se lit en lecture, sans entrée ni écriture", async () => {
    const fs = creerFichiersSimules();
    await deposerEssai(fs);
    const montage = monter({ fs });
    const { seance } = montage;
    await ouvrirSansEcrire(montage);
    await seance.passerEnEcriture();
    await seance.executer('enregistrerGeneration', generer(seance.charge));
    await seance.executer('retenirProposition', { id: 2 });
    await seance.passerEnLecture();
    const avant = fs.compteurs.ecritures;
    const entrees = journalDe(fs).entrees.length;
    const proposition = await seance.formeNommee({ proposition: 1 });
    assert.deepEqual(proposition.fautes, []);
    assert.deepEqual(
      proposition.lignes.filter(({ tour }) => tour === 1).map(({ nom }) => nom).sort(),
      ['Grisaille', 'Lacasse', 'Ombrelle', 'Pervenche'],
    );
    const retenu = await seance.formeNommee({ retenu: true });
    assert.equal(retenu.lignes.length, 8);
    await refus(seance.formeNommee({ proposition: 7 }), 'PROPOSITION_INCONNUE');
    assert.equal(fs.compteurs.ecritures, avant);
    assert.equal(journalDe(fs).entrees.length, entrees);
    assert.equal(seance.mode, 'lecture');
  });

  test("un retenu fautif sur le disque se lit sous forme nommée par la séance : ses lignes et ses fautes (RETENU_FAUTIF, § 8.9)", async () => {
    const fs = creerFichiersSimules();
    await deposerEssai(fs);
    const montage = monter({ fs });
    const { seance } = montage;
    await ouvrirSansEcrire(montage);
    await seance.passerEnEcriture();
    await seance.executer('enregistrerGeneration', generer(seance.charge));
    await seance.executer('retenirProposition', { id: 1 });
    await seance.passerEnLecture();
    const { entete, charge } = etatDe(fs);
    const premier = charge.retenu.placement[0];
    const assis = premier.sieges.find((liste) => liste.length > 0)[0];
    premier.reserve = [...premier.reserve, assis].sort((a, b) => a - b);
    fs.deposer('documents', ETAT, serialiser(charge, { revision: entete.revision, produitVersion: V1 }));
    await ouvrirSansEcrire(montage);
    assert.equal(seance.avertissements[0].code, 'RETENU_FAUTIF');
    const lue = await seance.formeNommee({ retenu: true });
    assert.deepEqual(lue.fautes, [{ code: 'DOUBLON', tour: 1, participant: assis }]);
    assert.equal(lue.lignes.length, 9);
    assert.equal(lue.lignes.filter(({ tour, participant }) => tour === 1 && participant === assis).length, 2);
  });

  test('sans événement ouvert, la forme nommée est refusée AUCUN_EVENEMENT', async () => {
    await refus(monter().seance.formeNommee({ retenu: true }), 'AUCUN_EVENEMENT');
  });
});

describe("séance : une autre séance a écrit entre-temps (§ 8.2, § 8.8)", () => {
  // Deux processus d'un même poste sur un même disque : la première séance
  // crée l'événement d'essai, puis la seconde l'ouvre en lecture.
  async function deuxSeances() {
    const disque = new Map();
    const premiere = monter({ fs: creerFichiersSimules({ disque }), prefixe: 'premiere' });
    await premiere.seance.creer({ nom: BASE, date: null, siegesParDefaut: 2, tours: 2 });
    const seconde = monter({ fs: creerFichiersSimules({ disque }), prefixe: 'seconde' });
    await ouvrirSansEcrire(seconde);
    return { premiere: premiere.seance, seconde: seconde.seance, fs: seconde.fs, fsPremiere: premiere.fs, disque };
  }

  test("passer en écriture relit l'événement : le travail de l'autre séance est adopté, EVENEMENT_CHANGE le dit, et le geste suivant s'écrit à sa suite", async () => {
    const { premiere, seconde, fs } = await deuxSeances();
    await premiere.passerEnEcriture();
    await premiere.executer('ajouterParticipant', { champs: { nom: 'Xavier' } });
    await premiere.passerEnLecture();
    const change = [{ code: 'EVENEMENT_CHANGE', details: { revision: 2 } }];
    assert.deepEqual(await seconde.passerEnEcriture(), { avertissements: change });
    assert.deepEqual([seconde.mode, verrouDe(fs).seance], ['ecriture', seconde.id]);
    assert.deepEqual(noms(seconde.charge), ['Xavier']);
    assert.deepEqual(seconde.avertissements, change);
    await seconde.executer('ajouterParticipant', { champs: { nom: 'Yvette' } });
    const journal = journalDe(fs);
    assert.deepEqual(libellesDe(journal), [CREATION, 'Ajouté Xavier', 'Ajouté Yvette']);
    assert.equal(journal.ecartees, 0);
    assert.deepEqual(noms(etatDe(fs).charge), ['Xavier', 'Yvette']);
    assert.deepEqual(etatDe(fs).charge, reconstruire(journal, 3));
  });

  test("sans geste de l'autre séance, rien n'avertit ; son jalon est adopté avec le journal relu", async () => {
    const { premiere, seconde, fs } = await deuxSeances();
    await premiere.passerEnEcriture();
    await premiere.nommer('Avant les invitations');
    await premiere.passerEnLecture();
    assert.deepEqual(await seconde.passerEnEcriture(), { avertissements: [] });
    assert.deepEqual(seconde.ouvert.journal.jalons.map(({ nom }) => nom), ['Création', 'Avant les invitations']);
    await seconde.executer('ajouterParticipant', { champs: { nom: 'Yvette' } });
    assert.deepEqual(journalDe(fs).jalons.map(({ nom }) => nom), ['Création', 'Avant les invitations']);
  });

  test("un événement qui a quitté le disque entre-temps, renommé ailleurs : le passage en écriture est refusé, le verrou rendu, rien ne se recrée", async () => {
    const { seconde, fs, disque } = await deuxSeances();
    const autre = creerFichiersSimules({ disque });
    for (const fichier of [ETAT, JOURNAL]) await autre.supprimer(DOC, fichier);
    await refus(seconde.passerEnEcriture(), 'ABSENT');
    assert.deepEqual([seconde.mode, verrouDe(fs)], ['lecture', null]);
    assert.deepEqual((await fs.lister(DOC, BASE)).map(({ nom }) => nom), []);
    await refus(seconde.executer('ajouterParticipant', { champs: { nom: 'Yvette' } }), 'MODE_LECTURE');
  });

  test("un plan que l'autre séance a bloqué entre-temps : adopté, EVENEMENT_CHANGE le dit, et le passage est refusé BLOQUE, le verrou rendu", async () => {
    const { premiere, seconde, fs } = await deuxSeances();
    await premiere.passerEnEcriture();
    await premiere.executer('changerEtat', { etat: 'bloque' });
    await refus(seconde.passerEnEcriture(), 'LECTURE_SEULE', BLOQUE_SEUL);
    assert.deepEqual([seconde.mode, verrouDe(fs), seconde.charge.evenement.etat], ['lecture', null, 'bloque']);
    assert.deepEqual(seconde.avertissements, [{ code: 'EVENEMENT_CHANGE', details: { revision: 2 } }]);
  });

  test("débloquer relit l'événement sous le verrou : le déblocage s'écrit à la suite du travail de l'autre séance", async () => {
    const { premiere, seconde, fs } = await deuxSeances();
    await premiere.passerEnEcriture();
    await premiere.executer('changerEtat', { etat: 'bloque' });
    await seconde.ouvrir(EVT);
    await premiere.debloquer();
    await premiere.executer('ajouterParticipant', { champs: { nom: 'Xavier' } });
    await premiere.executer('changerEtat', { etat: 'bloque' });
    assert.equal(premiere.mode, 'lecture');
    const rendu = await seconde.debloquer();
    assert.deepEqual(rendu, {
      libelle: 'Plan débloqué, état « Brouillon »',
      avertissements: [{ code: 'EVENEMENT_CHANGE', details: { revision: 5 } }],
    });
    assert.equal(seconde.mode, 'ecriture');
    const journal = journalDe(fs);
    assert.deepEqual(journal.entrees.map(({ revision }) => revision), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(noms(etatDe(fs).charge), ['Xavier']);
    assert.equal(etatDe(fs).charge.evenement.etat, 'brouillon');
  });

  test("débloquer un plan que l'autre séance a débloqué entre-temps : refusé PLAN_NON_BLOQUE, adopté, le verrou rendu", async () => {
    const { premiere, seconde, fs } = await deuxSeances();
    await premiere.passerEnEcriture();
    await premiere.executer('changerEtat', { etat: 'bloque' });
    await seconde.ouvrir(EVT);
    await premiere.debloquer();
    await premiere.passerEnLecture();
    const entrees = journalDe(fs).entrees.length;
    await refus(seconde.debloquer(), 'PLAN_NON_BLOQUE');
    assert.deepEqual([seconde.mode, verrouDe(fs), seconde.charge.evenement.etat], ['lecture', null, 'brouillon']);
    assert.deepEqual(seconde.avertissements, [{ code: 'EVENEMENT_CHANGE', details: { revision: 3 } }]);
    assert.equal(journalDe(fs).entrees.length, entrees);
  });

  test("un secours ouvert se relit par la même source : passer en écriture ne bute pas sur l'état illisible", async () => {
    const montage = monter();
    const { fs, seance } = montage;
    await enEcriture(montage);
    await seance.executer('ajouterParticipant', { champs: { nom: 'Xavier' } });
    await seance.passerEnLecture();
    fs.deposer('documents', ETAT, '');
    await seance.ouvrirSecours(EVT, 'journal');
    assert.deepEqual(await seance.passerEnEcriture(), { avertissements: [] });
    await seance.executer('ajouterParticipant', { champs: { nom: 'Yvette' } });
    assert.deepEqual(noms(etatDe(fs).charge), ['Xavier', 'Yvette']);
    await seance.passerEnLecture();
    assert.deepEqual(await seance.passerEnEcriture(), { avertissements: [] });
  });

  // L'événement de la première séance porte Aubépine puis Bourrache, son
  // état devient illisible, et chacune des deux ouvre son .precedent : la
  // révision 2, Aubépine seule.
  async function surPrecedent() {
    const deux = await deuxSeances();
    const { premiere, seconde, fs } = deux;
    await premiere.passerEnEcriture();
    for (const nom of ['Aubépine', 'Bourrache']) await premiere.executer('ajouterParticipant', { champs: { nom } });
    await premiere.passerEnLecture();
    fs.deposer('documents', ETAT, '');
    for (const seance of [premiere, seconde]) await seance.ouvrirSecours(EVT, 'precedent');
    assert.deepEqual([seconde.ouvert.revision, noms(seconde.charge)], [2, ['Aubépine']]);
    return deux;
  }

  for (const gestes of [['Cerfeuil'], ['Cerfeuil', 'Dictame']]) {
    test(`un secours .precedent se relit par l'état qu'une autre séance a écrit depuis (${gestes.length} geste·s) : adopté, EVENEMENT_CHANGE le dit, rien ne s'efface`, async () => {
      const { premiere, seconde, fs } = await surPrecedent();
      await premiere.passerEnEcriture();
      for (const nom of gestes) await premiere.executer('ajouterParticipant', { champs: { nom } });
      await premiere.passerEnLecture();
      const { revision } = etatDe(fs).entete;
      const change = [{ code: 'EVENEMENT_CHANGE', details: { revision } }];
      assert.deepEqual(await seconde.passerEnEcriture(), { avertissements: change });
      assert.deepEqual([seconde.ouvert.revision, noms(seconde.charge)], [revision, ['Aubépine', ...gestes]]);
      await seconde.executer('ajouterParticipant', { champs: { nom: 'Estragon' } });
      assert.deepEqual(noms(etatDe(fs).charge), ['Aubépine', ...gestes, 'Estragon']);
      assert.equal(journalDe(fs).ecartees, 0);
    });
  }

  test("un secours .precedent dont l'état reste illisible, mais dont le journal a reçu le geste d'une autre séance : le dernier instant du journal est adopté, EVENEMENT_CHANGE le dit", async () => {
    const { premiere, seconde, fs, fsPremiere } = await surPrecedent();
    await premiere.passerEnEcriture();
    await premiere.nommer('Point');
    fsPremiere.pannes.renommage('documents');
    await refus(premiere.executer('ajouterParticipant', { champs: { nom: 'Cerfeuil' } }), 'ETAT_NON_ECRIT');
    await premiere.passerEnLecture();
    assert.equal(fs.contenu('documents', ETAT), '');
    assert.deepEqual(await seconde.passerEnEcriture(), {
      avertissements: [{ code: 'EVENEMENT_CHANGE', details: { revision: 5 } }],
    });
    assert.deepEqual(noms(seconde.charge), ['Aubépine', 'Cerfeuil']);
    await seconde.executer('ajouterParticipant', { champs: { nom: 'Estragon' } });
    assert.deepEqual(noms(etatDe(fs).charge), ['Aubépine', 'Cerfeuil', 'Estragon']);
  });

  test("un secours .precedent dont l'état redevient lisible entre-temps se relit par l'état, sans entrée nouvelle au journal : EVENEMENT_CHANGE le dit", async () => {
    const montage = monter();
    const { fs, seance } = montage;
    await enEcriture(montage);
    for (const nom of ['Aubépine', 'Bourrache']) await seance.executer('ajouterParticipant', { champs: { nom } });
    await seance.passerEnLecture();
    const lisible = fs.contenu('documents', ETAT);
    fs.deposer('documents', ETAT, '');
    await seance.ouvrirSecours(EVT, 'precedent');
    fs.deposer('documents', ETAT, lisible);
    assert.deepEqual(await seance.passerEnEcriture(), {
      avertissements: [{ code: 'EVENEMENT_CHANGE', details: { revision: 3 } }],
    });
    assert.deepEqual(noms(seance.charge), ['Aubépine', 'Bourrache']);
    await seance.executer('ajouterParticipant', { champs: { nom: 'Cerfeuil' } });
    assert.deepEqual(noms(etatDe(fs).charge), ['Aubépine', 'Bourrache', 'Cerfeuil']);
  });

  test("un secours .precedent ouvert devant un état lisible se relit par le .precedent tant que l'état ne change pas : le choix de l'opérateur reste (§ 8.9, point 3)", async () => {
    const montage = monter();
    const { fs, seance } = montage;
    await enEcriture(montage);
    for (const nom of ['Aubépine', 'Bourrache']) await seance.executer('ajouterParticipant', { champs: { nom } });
    await seance.passerEnLecture();
    await seance.ouvrirSecours(EVT, 'precedent');
    assert.deepEqual(await seance.passerEnEcriture(), { avertissements: [] });
    assert.deepEqual([seance.ouvert.revision, noms(seance.charge)], [2, ['Aubépine']]);
    await seance.executer('ajouterParticipant', { champs: { nom: 'Cerfeuil' } });
    assert.deepEqual(noms(etatDe(fs).charge), ['Aubépine', 'Cerfeuil']);
  });

  test("après un geste sur un secours .precedent, la séance se relit par l'état : redevenu illisible, il refuse le passage en écriture, sans revenir au .precedent", async () => {
    const montage = monter();
    const { fs, seance } = montage;
    await enEcriture(montage);
    for (const nom of ['Aubépine', 'Bourrache']) await seance.executer('ajouterParticipant', { champs: { nom } });
    await seance.passerEnLecture();
    fs.deposer('documents', ETAT, '');
    await seance.ouvrirSecours(EVT, 'precedent');
    await seance.passerEnEcriture();
    await seance.executer('ajouterParticipant', { champs: { nom: 'Cerfeuil' } });
    await seance.passerEnLecture();
    fs.deposer('documents', ETAT, '');
    await refus(seance.passerEnEcriture(), 'ETAT_ILLISIBLE');
    assert.deepEqual([seance.mode, verrouDe(fs), noms(seance.charge)], ['lecture', null, ['Aubépine', 'Cerfeuil']]);
  });

  test("après avoir écrit ailleurs un secours .precedent, la séance s'y relit par l'état, que le dossier nouveau porte seul", async () => {
    const fs = creerFichiersSimules({ executable: 'E:\\soirees' });
    fs.deposerDossier('portable');
    const montage = monter({ fs });
    const { seance } = montage;
    await enEcriture(montage);
    for (const nom of ['Aubépine', 'Bourrache']) await seance.executer('ajouterParticipant', { champs: { nom } });
    await seance.passerEnLecture();
    fs.deposer('documents', ETAT, '');
    await seance.ouvrirSecours(EVT, 'precedent');
    await seance.passerEnEcriture();
    fs.pannes.ecriture('documents');
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Cerfeuil' } }), 'ECRITURE');
    await seance.ecrireAilleurs(PORTABLE);
    await seance.passerEnLecture();
    assert.deepEqual(await seance.passerEnEcriture(), { avertissements: [] });
    assert.deepEqual([seance.mode, noms(seance.charge)], ['ecriture', ['Aubépine']]);
  });

  test("le jalon d'une séance seule sur un secours .precedent pose la reprise : la relecture la retrouve, sans EVENEMENT_CHANGE ni recul de révision", async () => {
    const montage = monter();
    const { fs, seance } = montage;
    await enEcriture(montage);
    for (const nom of ['Aubépine', 'Bourrache']) await seance.executer('ajouterParticipant', { champs: { nom } });
    await seance.passerEnLecture();
    fs.deposer('documents', ETAT, '');
    await seance.ouvrirSecours(EVT, 'precedent');
    await seance.passerEnEcriture();
    assert.deepEqual(await seance.nommer('Point'), { revision: 4 });
    await seance.passerEnLecture();
    assert.deepEqual(await seance.passerEnEcriture(), { avertissements: [] });
    assert.deepEqual([seance.ouvert.revision, noms(seance.charge)], [4, ['Aubépine']]);
    const codes = seance.avertissements.map(({ code }) => code);
    assert.ok(!codes.includes('JOURNAL_EN_AVANCE_DE'), codes.join());
  });

  test("le jalon d'une séance seule sur un état que le journal devance de deux entrées pose la reprise : la relecture la retrouve, sans EVENEMENT_CHANGE", async () => {
    const montage = monter();
    const { fs, seance } = montage;
    await enEcriture(montage);
    const premier = fs.contenu('documents', ETAT);
    for (const nom of ['Aubépine', 'Bourrache']) await seance.executer('ajouterParticipant', { champs: { nom } });
    await seance.passerEnLecture();
    fs.deposer('documents', ETAT, premier);
    await ouvrirSansEcrire(montage);
    await seance.passerEnEcriture();
    assert.deepEqual(await seance.nommer('Point'), { revision: 4 });
    await seance.passerEnLecture();
    assert.deepEqual(await seance.passerEnEcriture(), { avertissements: [] });
    assert.deepEqual([seance.ouvert.revision, noms(seance.charge)], [4, []]);
  });

  // L'événement réécrit par une construction plus récente : l'état, ou la
  // première ligne du journal, déclarent le format qui suit FORMAT.
  const versPlusRecent = (texte) => texte.replace(`"format":${FORMAT}`, `"format":${FORMAT + 1}`);
  const plusRecent = {
    etat: (fs) => fs.deposer('documents', ETAT, versPlusRecent(fs.contenu('documents', ETAT))),
    journal: (fs) => fs.deposer('documents', JOURNAL, versPlusRecent(fs.contenu('documents', JOURNAL))),
  };

  for (const [fichier, designe] of [['etat', "l'état"], ['journal', 'le journal']]) {
    test(`${designe} qu'une construction plus récente a réécrit entre-temps : passer en écriture est refusé LECTURE_SEULE FORMAT, le verrou rendu`, async () => {
      const { seconde, fs } = await deuxSeances();
      const entrees = journalDe(fs).entrees.length;
      plusRecent[fichier](fs);
      await refus(seconde.passerEnEcriture(), 'LECTURE_SEULE', FORMAT_SEUL);
      assert.deepEqual([seconde.mode, verrouDe(fs), seconde.ouvert.formatPlusRecent], ['lecture', null, true]);
      await refus(seconde.executer('ajouterParticipant', { champs: { nom: 'Cerfeuil' } }), 'LECTURE_SEULE', FORMAT_SEUL);
      if (fichier === 'etat') assert.equal(journalDe(fs).entrees.length, entrees);
    });

    test(`un secours .precedent dont ${designe} est réécrit entre-temps par une construction plus récente : passer en écriture est refusé LECTURE_SEULE FORMAT, le verrou rendu`, async () => {
      const { seconde, fs } = await surPrecedent();
      if (fichier === 'etat') {
        const precedent = fs.contenu('documents', `${BASE}/${BASE}${SUFFIXES.precedent}`);
        fs.deposer('documents', ETAT, versPlusRecent(precedent));
      } else {
        plusRecent.journal(fs);
      }
      await refus(seconde.passerEnEcriture(), 'LECTURE_SEULE', FORMAT_SEUL);
      assert.deepEqual([seconde.mode, verrouDe(fs), seconde.ouvert.formatPlusRecent], ['lecture', null, true]);
    });

    test(`un plan bloqué dont ${designe} est réécrit entre-temps par une construction plus récente : débloquer est refusé LECTURE_SEULE FORMAT, le verrou rendu, sans entrée`, async () => {
      const { premiere, seconde, fs } = await deuxSeances();
      await premiere.passerEnEcriture();
      await premiere.executer('changerEtat', { etat: 'bloque' });
      await seconde.ouvrir(EVT);
      const texte = fs.contenu('documents', JOURNAL);
      plusRecent[fichier](fs);
      await refus(seconde.debloquer(), 'LECTURE_SEULE', FORMAT_SEUL);
      assert.deepEqual([seconde.mode, verrouDe(fs), seconde.ouvert.formatPlusRecent], ['lecture', null, true]);
      if (fichier === 'etat') assert.equal(fs.contenu('documents', JOURNAL), texte);
    });
  }

  // L'état réécrit en octets hors UTF-8 : son premier « é » remplacé par
  // l'octet E9 d'un éditeur réglé en windows-1252. Rend ces octets.
  function etatMalEncode(fs) {
    const octets = [...new TextEncoder().encode(fs.contenu('documents', ETAT))];
    const rang = octets.findIndex((octet, i) => octet === 0xc3 && octets[i + 1] === 0xa9);
    octets.splice(rang, 2, 0xe9);
    fs.deposerOctets('documents', ETAT, new Uint8Array(octets));
    return new Uint8Array(octets);
  }

  // Les noms des fichiers de documents et le texte du journal : ce qu'un
  // refus laisse tel quel.
  const empreinte = async (fs) => [(await fs.lister(DOC, '')).map(({ nom }) => nom), fs.contenu('documents', JOURNAL)];

  test("l'état réécrit entre-temps en octets hors UTF-8 : passer en écriture est refusé LECTURE_SEULE {raison: 'ENCODAGE'}, comme un format plus récent, le verrou rendu et rien de l'événement écrit ; le refus a son texte", async () => {
    const { seconde, fs } = await deuxSeances();
    const octets = etatMalEncode(fs);
    const avant = await empreinte(fs);
    const erreur = await refus(seconde.passerEnEcriture(), 'LECTURE_SEULE', ENCODAGE_SEUL);
    assert.deepEqual([seconde.mode, verrouDe(fs)], ['lecture', null]);
    assert.deepEqual(await empreinte(fs), avant);
    assert.deepEqual(fs.octets('documents', ETAT), octets);
    assert.match(libelle(erreur.code, erreur.details), /UTF-8/);
    await refus(seconde.executer('ajouterParticipant', { champs: { nom: 'Cerfeuil' } }), 'MODE_LECTURE');
  });

  test("un plan bloqué dont l'état est réécrit entre-temps en octets hors UTF-8 : débloquer est refusé LECTURE_SEULE {raison: 'ENCODAGE'}, le verrou rendu, sans entrée", async () => {
    const { premiere, seconde, fs } = await deuxSeances();
    await premiere.passerEnEcriture();
    await premiere.executer('changerEtat', { etat: 'bloque' });
    await premiere.passerEnLecture();
    await seconde.ouvrir(EVT);
    const octets = etatMalEncode(fs);
    const avant = await empreinte(fs);
    await refus(seconde.debloquer(), 'LECTURE_SEULE', ENCODAGE_SEUL);
    assert.deepEqual([seconde.mode, verrouDe(fs)], ['lecture', null]);
    assert.deepEqual(await empreinte(fs), avant);
    assert.deepEqual(fs.octets('documents', ETAT), octets);
  });

  for (const source of ['precedent', 'journal']) {
    test(`ouvert par son secours ${source}, un état aux octets hors UTF-8 ne fige rien : passer en écriture réussit, et le premier geste met l'état dans un dossier daté de la corbeille, ses octets intacts, avant d'écrire`, async () => {
      const montage = monter();
      const { fs, seance } = montage;
      await enEcriture(montage);
      for (const nom of ['Aubépine', 'Bourrache']) await seance.executer('ajouterParticipant', { champs: { nom } });
      await seance.passerEnLecture();
      const octets = etatMalEncode(fs);
      const illisible = await refus(seance.ouvrir(EVT), 'ETAT_ILLISIBLE');
      assert.equal(illisible.details.raison, 'ENCODAGE');
      assert.match(libelle(illisible.code, illisible.details), /UTF-8/);
      await seance.ouvrirSecours(EVT, source);
      assert.equal(seance.ouvert.etatMalEncode, true);
      assert.deepEqual(await seance.passerEnEcriture(), { avertissements: [] });
      await seance.executer('ajouterParticipant', { champs: { nom: 'Cerfeuil' } });
      const [dossier] = (await fs.lister(DOC, 'corbeille')).map(({ nom }) => nom);
      assert.deepEqual(fs.octets('documents', `corbeille/${dossier}/${NOM.ETAT}`), octets);
      assert.deepEqual(noms(etatDe(fs).charge), [...noms(seance.charge)]);
      assert.ok(noms(seance.charge).includes('Cerfeuil'));
      assert.equal(seance.ouvert.etatMalEncode, false);
      for (const { code, details } of seance.avertissements) assert.equal(typeof libelle(code, details), 'string');
    });
  }
});

describe('séance : revenir, défaire, refaire (§ 8.3)', () => {
  // Trois gestes après la création : Ancolie, Bruyère, Capucine, aux
  // révisions 2, 3 et 4.
  async function troisGestes() {
    const montage = monter();
    await enEcriture(montage);
    for (const nom of ['Ancolie', 'Bruyère', 'Capucine']) await montage.seance.executer('ajouterParticipant', { champs: { nom } });
    return montage;
  }

  test('défaire, refaire et revenir écrivent des entrées de retour, et le journal ne se tronque jamais', async () => {
    const montage = await troisGestes();
    const { fs, seance } = montage;
    assert.deepEqual(await seance.defaire(), { libelle: 'Défait : « Ajouté Capucine »', avertissements: [] });
    assert.deepEqual(noms(seance.charge), ['Ancolie', 'Bruyère']);
    await seance.refaire();
    assert.deepEqual(noms(seance.charge), ['Ancolie', 'Bruyère', 'Capucine']);
    await seance.revenir(2);
    assert.deepEqual(noms(seance.charge), ['Ancolie']);
    const journal = journalDe(fs);
    assert.deepEqual(
      journal.entrees.map(({ revision, sens, retour, libelle: texte }) => [revision, sens, retour, texte]),
      [
        [1, null, null, CREATION],
        [2, null, null, 'Ajouté Ancolie'],
        [3, null, null, 'Ajouté Bruyère'],
        [4, null, null, 'Ajouté Capucine'],
        [5, 'defaire', 3, 'Défait : « Ajouté Capucine »'],
        [6, 'refaire', 4, 'Refait : « Ajouté Capucine »'],
        [7, 'revenir', 2, 'Retour à « Ajouté Ancolie »'],
      ],
    );
    // L'instant 2 revient avec son contenu, et ses compteurs restent où trois
    // ajouts les ont portés : aucun identifiant donné ne se redonne (§ 8.9).
    const instant2 = reconstruire(journal, 2);
    const attendu = { ...instant2, prochainsIds: { ...instant2.prochainsIds, participant: 4 } };
    assert.deepEqual(etatDe(fs).charge, attendu);
    assert.deepEqual(reconstruire(journal, 7), attendu);
    await seance.executer('ajouterParticipant', { champs: { nom: 'Digitale' } });
    assert.deepEqual(
      seance.charge.participants.map(({ id, nom }) => [id, nom]),
      [[1, 'Ancolie'], [4, 'Digitale']],
    );
  });

  test("refaire n'existe qu'après des retours, tant qu'aucun geste ne les suit", async () => {
    const montage = await troisGestes();
    const { fs, seance } = montage;
    assert.deepEqual(seance.retours, { defaire: true, refaire: false, jalons: 1 });
    const avant = fs.compteurs.ecritures;
    await refus(seance.refaire(), 'RIEN_A_REFAIRE');
    assert.equal(fs.compteurs.ecritures, avant);
    await seance.defaire();
    await seance.defaire();
    assert.deepEqual(seance.retours, { defaire: true, refaire: true, jalons: 1 });
    await seance.refaire();
    assert.deepEqual(noms(seance.charge), ['Ancolie', 'Bruyère']);
    await seance.executer('ajouterParticipant', { champs: { nom: 'Dauphinelle' } });
    assert.deepEqual(seance.retours, { defaire: true, refaire: false, jalons: 1 });
    await refus(seance.refaire(), 'RIEN_A_REFAIRE');
  });

  test("rien à défaire au premier instant", async () => {
    const montage = monter();
    await enEcriture(montage);
    assert.deepEqual(montage.seance.retours, { defaire: false, refaire: false, jalons: 1 });
    const avant = montage.fs.compteurs.ecritures;
    await refus(montage.seance.defaire(), 'RIEN_A_DEFAIRE');
    assert.equal(montage.fs.compteurs.ecritures, avant);
  });

  test('après un retour de la révision 6 à la 3, défaire vise le prédécesseur de 3 sur le fil, non la ligne précédente', async () => {
    const montage = monter();
    const { fs, seance } = montage;
    await enEcriture(montage);
    for (const nom of ['Ancolie', 'Bruyère', 'Capucine', 'Dauphinelle', 'Églantine']) await seance.executer('ajouterParticipant', { champs: { nom } });
    await seance.revenir(3);
    await seance.defaire();
    const derniere = journalDe(fs).entrees.at(-1);
    assert.deepEqual([derniere.revision, derniere.sens, derniere.retour, derniere.libelle], [8, 'defaire', 2, 'Défait : « Ajouté Bruyère »']);
    assert.deepEqual(noms(seance.charge), ['Ancolie']);
  });

  test("un journal qui finit avant l'état : défaire vise l'instant où il finit, par-dessus l'entrée de reprise", async () => {
    const fs = creerFichiersSimules();
    await deposerEssai(fs);
    // L'état du disque, à la révision 4, porte une personne que le journal,
    // arrêté à la révision 1, n'a pas.
    const plus = chargeEssai();
    plus.participants.push(personne(5, 'Ancolie'));
    plus.prochainsIds.participant = 6;
    fs.deposer('documents', ETAT, serialiser(plus, { revision: 4, produitVersion: V1 }));
    const montage = monter({ fs });
    const { seance } = montage;
    await ouvrirSansEcrire(montage);
    assert.deepEqual(seance.ouvert.avertissements, [{ code: 'JOURNAL_INCOMPLET', details: { etat: 4, journal: 1 } }]);
    await seance.passerEnEcriture();
    assert.deepEqual(seance.retours, { defaire: true, refaire: false, jalons: 1 });
    const reprise = "Reprise de l'état trouvé sur le disque";
    assert.deepEqual(await seance.defaire(), { libelle: `Défait : « ${reprise} »`, avertissements: [] });
    assert.deepEqual(
      journalDe(fs).entrees.map(({ revision, sens, retour, libelle: texte }) => [revision, sens, retour, texte]),
      [
        [1, null, null, CREATION],
        [2, null, null, reprise],
        [3, 'defaire', 1, `Défait : « ${reprise} »`],
      ],
    );
    assert.deepEqual(noms(seance.charge), noms(chargeEssai()));
    assert.deepEqual(seance.retours, { defaire: false, refaire: true, jalons: 1 });
    await seance.refaire();
    assert.deepEqual(noms(seance.charge), noms(plus));
  });

  test("un état sans journal : rien à défaire ; le premier geste ouvre le journal par l'entrée de reprise", async () => {
    const fs = creerFichiersSimules();
    fs.deposerDossier('documents');
    fs.deposer('documents', ETAT, serialiser(chargeEssai(), { revision: 3, produitVersion: V1 }));
    const montage = monter({ fs });
    const { seance } = montage;
    await ouvrirSansEcrire(montage);
    await seance.passerEnEcriture();
    assert.deepEqual(seance.retours, { defaire: false, refaire: false, jalons: 0 });
    await refus(seance.defaire(), 'RIEN_A_DEFAIRE');
    await seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } });
    assert.deepEqual(
      journalDe(fs).entrees.map(({ revision, libelle: texte }) => [revision, texte]),
      [
        [3, "Reprise de l'état trouvé sur le disque"],
        [4, 'Ajouté Ancolie'],
      ],
    );
    assert.deepEqual(seance.retours, { defaire: true, refaire: false, jalons: 0 });
  });

  test("revenir à un instant que le journal ne restitue plus est refusé, sans écriture", async () => {
    const fs = creerFichiersSimules();
    fs.deposerDossier('documents');
    const charge = chargeEssai();
    // Un journal élagué : sa première entrée est la révision 10.
    const lignes = [
      ligneOuverture(charge.evenement.id),
      ligneEntree({ revision: 10, libelle: 'Geste 10', horodatage: '2031-05-17T07:00:00-04:00', produitVersion: V1, apres: charge, instantane: true }),
    ];
    fs.deposer('documents', JOURNAL, `${lignes.join('\n')}\n`);
    fs.deposer('documents', ETAT, serialiser(charge, { revision: 10, produitVersion: V1 }));
    const montage = monter({ fs });
    const { seance } = montage;
    await ouvrirSansEcrire(montage);
    await seance.passerEnEcriture();
    const avant = fs.compteurs.ecritures;
    await refus(seance.revenir(3), 'INSTANT_NON_RESTITUABLE', { revision: 3, remede: null });
    await refus(seance.revenir(11), 'INSTANT_NON_RESTITUABLE', { revision: 11, remede: null });
    await refus(seance.defaire(), 'RIEN_A_DEFAIRE');
    assert.equal(fs.compteurs.ecritures, avant);
  });

  test('la touche qui défait ou refait se lit dans le libellé figé de son entrée ; sans touche, le libellé reste le même', async () => {
    const { fs, seance } = await troisGestes();
    assert.deepEqual(await seance.defaire({ touche: 'Ctrl+Z' }), { libelle: 'Défait (Ctrl+Z) : « Ajouté Capucine »', avertissements: [] });
    assert.deepEqual(await seance.refaire({ touche: 'Ctrl+Maj+Z' }), { libelle: 'Refait (Ctrl+Maj+Z) : « Ajouté Capucine »', avertissements: [] });
    await seance.defaire({});
    assert.deepEqual(await seance.refaire({ touche: 'Ctrl+Y' }), { libelle: 'Refait (Ctrl+Y) : « Ajouté Capucine »', avertissements: [] });
    assert.deepEqual(libellesDe(journalDe(fs)).slice(4), [
      'Défait (Ctrl+Z) : « Ajouté Capucine »',
      'Refait (Ctrl+Maj+Z) : « Ajouté Capucine »',
      'Défait : « Ajouté Capucine »',
      'Refait (Ctrl+Y) : « Ajouté Capucine »',
    ]);
    assert.deepEqual(noms(seance.charge), ['Ancolie', 'Bruyère', 'Capucine']);
  });

  test("une touche inconnue, ou de l'autre sens, est une faute du code : TypeError, sans rien écrire, dans tout mode", async () => {
    const { fs, seance } = await troisGestes();
    const avant = fs.compteurs.ecritures;
    const fautes = [
      () => seance.defaire({ touche: 'Ctrl+Y' }),
      () => seance.defaire({ touche: 'Ctrl+Maj+Z' }),
      () => seance.refaire({ touche: 'Ctrl+Z' }),
      () => seance.defaire({ touche: 'ctrl+z' }),
      () => seance.defaire({ touche: null }),
      () => seance.refaire({ touche: 'Ctrl+Shift+Z' }),
      () => seance.defaire('Ctrl+Z'),
      () => seance.refaire(null),
    ];
    for (const faute of fautes) await assert.rejects(faute(), TypeError);
    await seance.passerEnLecture();
    await assert.rejects(seance.defaire({ touche: 'Ctrl+Y' }), TypeError);
    assert.equal(fs.compteurs.ecritures - avant, 1, 'seul le rendu du verrou s’écrit');
    assert.equal(journalDe(fs).entrees.length, 4);
  });

  test('en lecture, défaire et refaire par leur touche se refusent comme leur commande, remède « Modifier »', async () => {
    const { fs, seance } = await troisGestes();
    await seance.defaire();
    await seance.passerEnLecture();
    const avant = fs.compteurs.ecritures;
    const lecture = { remede: { geste: 'modifier' } };
    await refus(seance.defaire({ touche: 'Ctrl+Z' }), 'MODE_LECTURE', lecture);
    await refus(seance.refaire({ touche: 'Ctrl+Maj+Z' }), 'MODE_LECTURE', lecture);
    await refus(seance.refaire({ touche: 'Ctrl+Y' }), 'MODE_LECTURE', lecture);
    assert.equal(fs.compteurs.ecritures, avant);
  });
});

describe("séance : l'historique se lit dans tout mode, sans rien écrire (§ 8.3, § 8.4)", () => {
  // L'historique sans ses horodatages, chaque jalon réduit à son nom : les
  // horodatages se comparent à part, à ceux du journal.
  const sansHeure = ({ lignes, ...reste }) => ({
    ...reste,
    lignes: lignes.map(({ horodatage, jalons, ...ligne }) => ({ ...ligne, jalons: jalons.map(({ nom }) => nom) })),
  });

  test("en lecture, les instants du journal : le fil de chacun, ses jalons, la position courante ; aucune écriture", async () => {
    const montage = monter();
    const { fs, seance } = montage;
    await enEcriture(montage);
    for (const nom of ['Ancolie', 'Bruyère', 'Capucine']) await seance.executer('ajouterParticipant', { champs: { nom } });
    await seance.defaire();
    await seance.nommer('Avant le repas');
    await seance.executer('ajouterParticipant', { champs: { nom: 'Dauphinelle' } });
    await seance.passerEnLecture();
    const avant = [fs.compteurs.ecritures, seance.etat()];
    const historique = seance.historique();
    assert.deepEqual(sansHeure(historique), {
      position: 6,
      reprise: false,
      lignes: [
        { revision: 1, libelle: CREATION, sens: null, retour: null, fil: 'courant', jalons: ['Création'] },
        { revision: 2, libelle: 'Ajouté Ancolie', sens: null, retour: null, fil: 'courant', jalons: [] },
        { revision: 3, libelle: 'Ajouté Bruyère', sens: null, retour: null, fil: 'courant', jalons: [] },
        { revision: 4, libelle: 'Ajouté Capucine', sens: null, retour: null, fil: 'abandonne', jalons: [] },
        { revision: 5, libelle: 'Défait : « Ajouté Capucine »', sens: 'defaire', retour: 3, fil: 'retour', jalons: ['Avant le repas'] },
        { revision: 6, libelle: 'Ajouté Dauphinelle', sens: null, retour: null, fil: 'courant', jalons: [] },
      ],
    });
    const journal = journalDe(fs);
    assert.deepEqual(
      historique.lignes.map(({ horodatage, jalons }) => [horodatage, jalons.map((jalon) => jalon.horodatage)]),
      journal.entrees.map(({ revision, horodatage }) => [
        horodatage,
        journal.jalons.filter((jalon) => jalon.revision === revision).map((jalon) => jalon.horodatage),
      ]),
    );
    assert.deepEqual([fs.compteurs.ecritures, seance.etat()], avant, 'lire l’historique n’écrit ni ne publie rien');
    assert.notEqual(seance.historique().lignes, historique.lignes, 'chaque lecture est neuve');
  });

  test('sans événement, aucun historique', () => {
    assert.equal(monter().seance.historique(), null);
  });

  test("un journal qui finit avant l'état : reprise, sans instant courant, ses lignes telles quelles", async () => {
    const fs = creerFichiersSimules();
    await deposerEssai(fs);
    const plus = chargeEssai();
    plus.participants.push(personne(5, 'Ancolie'));
    plus.prochainsIds.participant = 6;
    fs.deposer('documents', ETAT, serialiser(plus, { revision: 4, produitVersion: V1 }));
    const montage = monter({ fs });
    await ouvrirSansEcrire(montage);
    const creation = libelle('ENTREE_CREATION', { nom: BASE });
    assert.deepEqual(sansHeure(montage.seance.historique()), {
      position: null,
      reprise: true,
      lignes: [{ revision: 1, libelle: creation, sens: null, retour: null, fil: 'courant', jalons: ['Création'] }],
    });
  });

  test('un état sans journal : reprise, sans instant courant ni ligne', async () => {
    const fs = creerFichiersSimules();
    fs.deposerDossier('documents');
    fs.deposer('documents', ETAT, serialiser(chargeEssai(), { revision: 3, produitVersion: V1 }));
    const montage = monter({ fs });
    await ouvrirSansEcrire(montage);
    assert.deepEqual(montage.seance.historique(), { position: null, lignes: [], reprise: true });
  });

  test("un journal réduit à sa ligne d'ouverture : reprise, sans instant courant ni ligne", async () => {
    const fs = creerFichiersSimules();
    fs.deposerDossier('documents');
    const charge = chargeEssai();
    fs.deposer('documents', JOURNAL, `${ligneOuverture(charge.evenement.id)}\n`);
    fs.deposer('documents', ETAT, serialiser(charge, { revision: 3, produitVersion: V1 }));
    const montage = monter({ fs });
    await ouvrirSansEcrire(montage);
    assert.deepEqual(montage.seance.historique(), { position: null, lignes: [], reprise: true });
    assert.equal(montage.seance.retours.jalons, 0);
  });

  test("un journal qui finit après l'état : reprise, sans instant courant, ses lignes telles quelles", async () => {
    const montage = monter();
    const { fs, seance } = montage;
    await enEcriture(montage);
    const prenoms = ['Ancolie', 'Bruyère', 'Capucine', 'Dauphinelle', 'Églantine'];
    let etatRevision4 = null;
    for (const nom of prenoms) {
      await seance.executer('ajouterParticipant', { champs: { nom } });
      if (seance.ouvert.revision === 4) etatRevision4 = fs.contenu('documents', ETAT);
    }
    await seance.passerEnLecture();
    // L'état du disque revient à la révision 4 ; le journal finit à la 6.
    fs.deposer('documents', ETAT, etatRevision4);
    await ouvrirSansEcrire(montage);
    assert.deepEqual(seance.ouvert.avertissements, [{ code: 'JOURNAL_EN_AVANCE_DE', details: { n: 2 } }]);
    assert.deepEqual(sansHeure(seance.historique()), {
      position: null,
      reprise: true,
      lignes: [
        { revision: 1, libelle: CREATION, sens: null, retour: null, fil: 'courant', jalons: ['Création'] },
        ...prenoms.map((nom, rang) => ({ revision: rang + 2, libelle: `Ajouté ${nom}`, sens: null, retour: null, fil: 'courant', jalons: [] })),
      ],
    });
  });

  test("nommer change l'état observable par le compte des jalons, sans changer la révision", async () => {
    const montage = monter();
    const { seance } = montage;
    await enEcriture(montage);
    await seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } });
    const avant = seance.etat();
    assert.deepEqual([avant.evenement.revision, avant.retours], [2, { defaire: true, refaire: false, jalons: 1 }]);
    const recus = [];
    seance.subscribe((suivant) => recus.push(suivant));
    await seance.nommer('Avant le repas');
    const apres = seance.etat();
    assert.deepEqual([apres.evenement.revision, apres.retours], [2, { defaire: true, refaire: false, jalons: 2 }]);
    assert.deepEqual(seance.retours, { defaire: true, refaire: false, jalons: 2 });
    assert.equal(recus.at(-1), apres, 'le nouvel état est publié');
    assert.deepEqual(seance.historique().lignes.at(-1).jalons.map(({ nom }) => nom), ['Avant le repas']);
  });
});

// Un événement écrit par le code du format 1 (test/fixtures/stockage/format1) :
// son état, son .precedent et son journal, sous la base qu'empreintes.json
// nomme.
const FORMAT1 = new URL('../../test/fixtures/stockage/format1/', import.meta.url);
const FORMAT1_BASE = JSON.parse(readFileSync(new URL('empreintes.json', FORMAT1), 'utf8')).base;

describe('séance : un événement d’un format plus ancien ne s’ouvre pas (§ 8.8)', () => {
  test('l’événement du format 1 se refuse ETAT_ILLISIBLE FORMAT_TROP_ANCIEN, sans secours ; la séance reste sans événement, rien ne s’écrit, et le refus dit que ce format n’est plus pris en charge', async () => {
    const fs = creerFichiersSimules();
    fs.deposerDossier('documents');
    for (const suffixe of [SUFFIXES.journal, SUFFIXES.etat, SUFFIXES.precedent]) {
      const nom = `${FORMAT1_BASE}${suffixe}`;
      fs.deposer('documents', `${FORMAT1_BASE}/${nom}`, readFileSync(new URL(nom, FORMAT1), 'utf8'));
    }
    const { seance } = monter({ fs });
    const avant = fs.compteurs.ecritures;
    const erreur = await refus(seance.ouvrir(cleEvenement(FORMAT1_BASE, FORMAT1_BASE)), 'ETAT_ILLISIBLE');
    assert.deepEqual(erreur.details, {
      base: FORMAT1_BASE,
      raison: 'FORMAT_TROP_ANCIEN',
      chemin: 'entete.format',
      format: 1,
      secours: { precedent: null, journal: null },
    });
    assert.equal(seance.etat().evenement, null);
    assert.equal(fs.compteurs.ecritures, avant);
    const texte = libelle(erreur.code, erreur.details);
    assert.match(texte, /format 1/);
    assert.match(texte, /plus pris en charge/);
    assert.match(texte, /Aucune version de secours ne se lit\./);
  });

  test('un état du format FORMAT − 1 se refuse de même, son format nommé', async () => {
    const fs = creerFichiersSimules();
    deposerAuFormat(fs, FORMAT - 1);
    const { seance } = monter({ fs });
    const erreur = await refus(seance.ouvrir(EVT), 'ETAT_ILLISIBLE');
    assert.deepEqual([erreur.details.raison, erreur.details.format], ['FORMAT_TROP_ANCIEN', FORMAT - 1]);
    assert.equal(seance.etat().evenement, null);
  });
});

describe('séance : les jalons automatiques (§ 8.3)', () => {
  test("la création, chaque changement d'état, et l'instant qui précède chaque génération sont nommés", async () => {
    const fs = creerFichiersSimules();
    await deposerEssai(fs);
    const montage = monter({ fs });
    const { seance } = montage;
    await ouvrirSansEcrire(montage);
    await seance.passerEnEcriture();
    await seance.executer('enregistrerGeneration', generer(seance.charge));
    await seance.executer('retenirProposition', { id: 1 });
    await seance.executer('enregistrerGeneration', generer(seance.charge, 1, 9));
    const journal = journalDe(fs);
    assert.deepEqual(libellesDe(journal), [CREATION, 'Généré 2 propositions (n° 1 à 2)', 'Retenu la proposition n° 1', 'Généré 1 proposition (n° 3)']);
    assert.deepEqual(journal.jalons.map(({ revision, nom }) => [revision, nom]), [
      [1, 'Création'],
      [1, 'Avant la génération'],
      [2, 'État « Proposé »'],
      [3, 'État « Retenu »'],
      [3, 'Avant la génération'],
    ]);
  });

  test("un retour qui change l'état du plan pose le jalon qui le nomme : défaire un déblocage rebloque, et la séance revient en lecture", async () => {
    const montage = monter();
    const { fs, seance } = montage;
    await enEcriture(montage);
    await seance.executer('changerEtat', { etat: 'bloque' });
    await seance.debloquer();
    const rendu = await seance.defaire();
    assert.deepEqual(rendu, { libelle: 'Défait : « Plan débloqué, état « Brouillon » »', avertissements: [] });
    const journal = journalDe(fs);
    const derniere = journal.entrees.at(-1);
    assert.deepEqual([derniere.revision, derniere.sens, derniere.retour], [4, 'defaire', 2]);
    assert.deepEqual(journal.jalons.map(({ revision, nom }) => [revision, nom]), [
      [1, 'Création'],
      [2, 'État « Bloqué »'],
      [3, 'État « Brouillon »'],
      [4, 'État « Bloqué »'],
    ]);
    assert.deepEqual([seance.mode, seance.charge.evenement.etat, verrouDe(fs)], ['lecture', 'bloque', null]);
  });
});

// --- Le logo d'une personne (§ 8.3, § 8.9) -----------------------------------

// Un PNG composé morceau par morceau : largeur × hauteur en RVBA 8 bits,
// une ligne de pixels répétée, teintée par teinte ; le CRC de node:zlib.
function pngEssai(largeur = 2, hauteur = 2, teinte = 0) {
  const mot = (n) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
  const morceau = (type, donnees) => {
    const corps = Uint8Array.from([...new TextEncoder().encode(type), ...donnees]);
    return [...mot(donnees.length), ...corps, ...mot(crc32(corps))];
  };
  const ligne = [0, ...Array.from({ length: Math.min(largeur, 4) * 4 }, (_, i) => (i * 31 + teinte) & 0xff)];
  const donnees = deflateSync(Uint8Array.from(Array.from({ length: Math.min(hauteur, 4) }, () => ligne).flat()));
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...morceau('IHDR', [...mot(largeur), ...mot(hauteur), 8, 6, 0, 0, 0]),
    ...morceau('IDAT', [...donnees]),
    ...morceau('IEND', []),
  ]);
}

// Le chemin d'un logo, relatif au dossier de l'événement, d'après le SHA-256
// de node:crypto ; et ce même fichier relatif à la racine.
const cheminDuLogo = (octets) => `logo/${createHash('sha256').update(octets).digest('hex')}.png`;
const surLaRacine = (chemin) => `${BASE}/${chemin}`;

// La charge d'essai déposée, ouverte et passée en écriture.
async function essaiEnEcriture(options = {}) {
  const montage = monter(options);
  await deposerEssai(montage.fs);
  await montage.seance.ouvrir(EVT);
  await montage.seance.passerEnEcriture();
  return montage;
}

describe('séance : le logo d’une personne, écrit avant son entrée (§ 8.3, § 8.9)', () => {
  test('poser écrit l’image dans logo/ du dossier de l’événement, sous le SHA-256 de ses octets, puis une entrée qui la nomme', async () => {
    const { fs, seance } = await essaiEnEcriture();
    const octets = pngEssai();
    const recus = Uint8Array.from(octets);
    const chemin = cheminDuLogo(octets);
    const journal = journalDe(fs).entrees.length;
    const rendu = await seance.poserLogoParticipant({ id: 4, octets });
    assert.deepEqual(rendu, { libelle: 'Logo de Ondine Lacasse : posé', chemin, avertissements: [] });
    assert.deepEqual(octets, recus);
    assert.deepEqual(fs.octets('documents', surLaRacine(chemin)), octets);
    assert.equal(seance.charge.participants[3].logo, chemin);
    assert.equal(etatDe(fs).charge.participants[3].logo, chemin);
    assert.deepEqual(libellesDe(journalDe(fs)).slice(journal), ['Logo de Ondine Lacasse : posé']);
    assert.equal(seance.mode, 'ecriture');
  });

  test('remplacer, retirer, puis défaire et refaire : chaque retour rend le chemin, et aucun fichier ne s’efface', async () => {
    const { fs, seance } = await essaiEnEcriture();
    const premier = pngEssai(2, 2, 0);
    const second = pngEssai(3, 1, 9);
    await seance.poserLogoParticipant({ id: 1, octets: premier });
    const remplace = await seance.poserLogoParticipant({ id: 1, octets: second });
    assert.equal(remplace.libelle, 'Logo de Iris Ombrelle : remplacé');
    assert.equal(seance.charge.participants[0].logo, cheminDuLogo(second));
    const retire = await seance.retirerLogoParticipant({ id: 1 });
    assert.equal(retire.libelle, 'Logo de Iris Ombrelle : retiré');
    assert.equal(Object.hasOwn(seance.charge.participants[0], 'logo'), false);
    const presents = () => [premier, second].map((octets) => fs.octets('documents', surLaRacine(cheminDuLogo(octets))));
    assert.deepEqual(presents(), [premier, second]);
    await seance.defaire();
    assert.equal(seance.charge.participants[0].logo, cheminDuLogo(second));
    await seance.defaire();
    assert.equal(seance.charge.participants[0].logo, cheminDuLogo(premier));
    assert.deepEqual(await seance.lireLogoParticipant(seance.charge.participants[0].logo), premier);
    await seance.refaire();
    assert.equal(seance.charge.participants[0].logo, cheminDuLogo(second));
    assert.deepEqual(presents(), [premier, second]);
    // Supprimer la personne laisse aussi son image.
    await seance.executer('supprimerParticipant', { id: 1 });
    assert.deepEqual(presents(), [premier, second]);
  });

  test('les mêmes octets pour deux personnes font un seul fichier, écrit une fois', async () => {
    const { fs, seance } = await essaiEnEcriture();
    const octets = pngEssai();
    await seance.poserLogoParticipant({ id: 2, octets });
    const ecritures = fs.compteurs.ecritures;
    await seance.poserLogoParticipant({ id: 3, octets: Uint8Array.from(octets) });
    assert.equal(seance.charge.participants[1].logo, seance.charge.participants[2].logo);
    // L'entrée et l'état seulement : ni logo/, ni l'image.
    const journalEtEtat = fs.compteurs.ecritures - ecritures;
    await seance.executer('modifierParticipant', { id: 3, champs: { notes: 'au fond' } });
    assert.equal(fs.compteurs.ecritures - ecritures - journalEtEtat, journalEtEtat);
    assert.deepEqual(fs.octets('documents', surLaRacine(cheminDuLogo(octets))), octets);
  });

  test('en lecture, sur un plan bloqué, rien ne s’écrit : ni l’image, ni logo/, ni l’entrée', async () => {
    const montage = monter();
    await deposerEssai(montage.fs);
    await montage.seance.ouvrir(EVT);
    const { fs, seance } = montage;
    const octets = pngEssai();
    let ecritures = fs.compteurs.ecritures;
    await refus(seance.poserLogoParticipant({ id: 4, octets }), 'MODE_LECTURE', { remede: { geste: 'modifier' } });
    await refus(seance.retirerLogoParticipant({ id: 4 }), 'MODE_LECTURE', { remede: { geste: 'modifier' } });
    // Les refus de l'écriture passent avant le contrôle du PNG.
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
    await refus(seance.poserLogoParticipant({ id: 4, octets: jpeg }), 'MODE_LECTURE', { remede: { geste: 'modifier' } });
    await refus(seance.poserLogoParticipant({ id: 4, octets: pngEssai(1201, 1) }), 'MODE_LECTURE', { remede: { geste: 'modifier' } });
    assert.equal(fs.compteurs.ecritures, ecritures);
    await seance.passerEnEcriture();
    await seance.executer('changerEtat', { etat: 'bloque' });
    assert.equal(seance.mode, 'lecture');
    ecritures = fs.compteurs.ecritures;
    await refus(seance.poserLogoParticipant({ id: 4, octets }), 'LECTURE_SEULE', BLOQUE_SEUL);
    await refus(seance.retirerLogoParticipant({ id: 4 }), 'LECTURE_SEULE', BLOQUE_SEUL);
    await refus(seance.poserLogoParticipant({ id: 4, octets: jpeg }), 'LECTURE_SEULE', BLOQUE_SEUL);
    assert.equal(fs.compteurs.ecritures, ecritures);
    assert.equal(fs.octets('documents', `${BASE}/logo`), null);
    assert.equal(fs.octets('documents', surLaRacine(cheminDuLogo(octets))), null);
  });

  test('une personne inconnue, ou le même logo, se refusent avant toute écriture', async () => {
    const { fs, seance } = await essaiEnEcriture();
    const octets = pngEssai();
    const ecritures = fs.compteurs.ecritures;
    await refus(seance.poserLogoParticipant({ id: 9, octets }), 'PARTICIPANT_INCONNU', { id: 9, remede: null });
    await refus(seance.retirerLogoParticipant({ id: 4 }), 'SANS_EFFET', { commande: 'changerLogo', remede: null });
    assert.equal(fs.compteurs.ecritures, ecritures);
    assert.equal(fs.octets('documents', surLaRacine(cheminDuLogo(octets))), null);
    await seance.poserLogoParticipant({ id: 4, octets });
    const apres = fs.compteurs.ecritures;
    const journal = journalDe(fs).entrees.length;
    await refus(seance.poserLogoParticipant({ id: 4, octets }), 'SANS_EFFET', { commande: 'changerLogo', remede: null });
    assert.equal(fs.compteurs.ecritures, apres);
    assert.equal(journalDe(fs).entrees.length, journal);
  });

  test('le même logo, son image disparue du dossier, se réécrit sans entrée : le chemin se retrouve', async () => {
    const { fs, seance } = await essaiEnEcriture();
    const octets = pngEssai();
    await seance.poserLogoParticipant({ id: 4, octets });
    const chemin = surLaRacine(cheminDuLogo(octets));
    await fs.supprimer(DOC, chemin);
    assert.equal(await seance.lireLogoParticipant(cheminDuLogo(octets)), null);
    const journal = journalDe(fs).entrees.length;
    await refus(seance.poserLogoParticipant({ id: 4, octets }), 'SANS_EFFET', { commande: 'changerLogo', remede: null });
    assert.deepEqual(fs.octets('documents', chemin), octets);
    assert.equal(journalDe(fs).entrees.length, journal);
  });

  test('une image que le disque refuse lève LOGO_NON_ECRIT, sans entrée ni rupture du support : le geste suivant s’écrit', async () => {
    const { fs, seance } = await essaiEnEcriture();
    // Un fichier logo en travers du dossier logo/.
    fs.deposer('documents', `${BASE}/logo`, 'pas un dossier');
    const journal = journalDe(fs).entrees.length;
    const erreur = await refus(seance.poserLogoParticipant({ id: 4, octets: pngEssai() }), 'LOGO_NON_ECRIT');
    assert.equal(erreur.details.personne, 'Ondine Lacasse');
    assert.equal(erreur.details.remede, null);
    assert.equal(typeof erreur.details.chemin, 'string');
    assert.equal(typeof erreur.details.dossier, 'string');
    assert.ok(Object.hasOwn(erreur.details, 'cause'));
    assert.equal(libelle('LOGO_NON_ECRIT', erreur.details).startsWith("Le logo de Ondine Lacasse n'a pas pu s'écrire : "), true);
    assert.equal(journalDe(fs).entrees.length, journal);
    assert.equal(Object.hasOwn(seance.charge.participants[3], 'logo'), false);
    assert.equal(seance.etat().refus, null);
    // L'image elle-même refusée, dossier logo/ libre : de même.
    await fs.supprimer(DOC, `${BASE}/logo`);
    const ecrire = fs.ecrireOctetsAtomique;
    fs.ecrireOctetsAtomique = async () => {
      throw new ErreurStockage('ECRITURE', { chemin: 'Soirée des Lucioles/logo/x.png', dossier: dossierDe(DOCUMENTS), cause: 'ENOSPC' });
    };
    await refus(seance.poserLogoParticipant({ id: 4, octets: pngEssai() }), 'LOGO_NON_ECRIT', {
      personne: 'Ondine Lacasse',
      chemin: 'logo/x.png',
      dossier: dossierDe(DOCUMENTS),
      cause: 'ENOSPC',
      remede: null,
    });
    fs.ecrireOctetsAtomique = ecrire;
    assert.equal(seance.etat().refus, null);
    // Le fichier déjà présent qui ne se lit pas : de même.
    const lire = fs.lireOctets;
    fs.lireOctets = async () => {
      throw new ErreurStockage('LECTURE', { chemin: 'Soirée des Lucioles/logo/y.png', dossier: dossierDe(DOCUMENTS), cause: 'EACCES' });
    };
    await refus(seance.poserLogoParticipant({ id: 4, octets: pngEssai() }), 'LOGO_NON_ECRIT', {
      personne: 'Ondine Lacasse',
      chemin: 'logo/y.png',
      dossier: dossierDe(DOCUMENTS),
      cause: 'EACCES',
      remede: null,
    });
    fs.lireOctets = lire;
    assert.equal(seance.etat().refus, null);
    await seance.executer('modifierParticipant', { id: 4, champs: { notes: 'au fond' } });
    assert.equal(journalDe(fs).entrees.length, journal + 1);
  });

  test('des octets qui ne sont pas un PNG, ou plus grands que LOGO_PARTICIPANT_COTE_MAX, sont une faute du code, sans écriture', async () => {
    assert.equal(LOGO_PARTICIPANT_COTE_MAX, 1200);
    const { fs, seance } = await essaiEnEcriture();
    const ecritures = fs.compteurs.ecritures;
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
    await assert.rejects(seance.poserLogoParticipant({ id: 4, octets: jpeg }), TypeError);
    // Le PNG se juge avant l'essai à blanc : une personne inconnue n'y change rien.
    await assert.rejects(seance.poserLogoParticipant({ id: 9, octets: jpeg }), TypeError);
    await assert.rejects(seance.poserLogoParticipant({ id: 9, octets: pngEssai(1201, 1) }), RangeError);
    await assert.rejects(seance.poserLogoParticipant({ id: 4, octets: [...pngEssai()] }), TypeError);
    await assert.rejects(seance.poserLogoParticipant({ id: 4 }), TypeError);
    await assert.rejects(seance.poserLogoParticipant(), TypeError);
    await assert.rejects(seance.poserLogoParticipant({ id: 4, octets: pngEssai(1201, 1) }), RangeError);
    await assert.rejects(seance.poserLogoParticipant({ id: 4, octets: pngEssai(1, 1201) }), RangeError);
    await assert.rejects(seance.retirerLogoParticipant(), TypeError);
    assert.equal(fs.compteurs.ecritures, ecritures);
    // 1200 de côté passe.
    const grand = pngEssai(1200, 900);
    assert.equal((await seance.poserLogoParticipant({ id: 4, octets: grand })).chemin, cheminDuLogo(grand));
  });

  test('lire l’image d’un chemin se fait dans tout mode, sans rien écrire ; absente, null ; un chemin d’une autre forme, TypeError', async () => {
    const { fs, seance } = await essaiEnEcriture();
    const octets = pngEssai();
    const { chemin } = await seance.poserLogoParticipant({ id: 4, octets });
    await seance.passerEnLecture();
    const ecritures = fs.compteurs.ecritures;
    assert.deepEqual(await seance.lireLogoParticipant(chemin), octets);
    assert.equal(await seance.lireLogoParticipant(cheminDuLogo(pngEssai(5, 5))), null);
    for (const fautif of [`../${chemin}`, chemin.toUpperCase(), `${BASE}.gtt.json`, null, 7]) {
      await assert.rejects(seance.lireLogoParticipant(fautif), TypeError, String(fautif));
    }
    assert.equal(fs.compteurs.ecritures, ecritures);
    // Un fichier présent qui ne se lit pas n'est pas absent : LECTURE passe.
    const lire = fs.lireOctets;
    fs.lireOctets = async () => {
      throw new ErreurStockage('LECTURE', { chemin, dossier: dossierDe(DOCUMENTS), cause: 'EACCES' });
    };
    await refus(seance.lireLogoParticipant(chemin), 'LECTURE');
    fs.lireOctets = lire;
    // Bloqué, la lecture répond encore.
    await seance.passerEnEcriture();
    await seance.executer('changerEtat', { etat: 'bloque' });
    assert.deepEqual(await seance.lireLogoParticipant(chemin), octets);
  });

  test('sans événement ouvert, chaque appel du logo lève AUCUN_EVENEMENT', async () => {
    const { seance } = monter();
    const chemin = cheminDuLogo(pngEssai());
    await refus(seance.lireLogoParticipant(chemin), 'AUCUN_EVENEMENT');
    await refus(seance.poserLogoParticipant({ id: 1, octets: pngEssai() }), 'AUCUN_EVENEMENT');
    await refus(seance.retirerLogoParticipant({ id: 1 }), 'AUCUN_EVENEMENT');
    // Sans événement, poser ne juge pas le PNG ; lire juge le chemin d'abord.
    await refus(seance.poserLogoParticipant({ id: 1, octets: Uint8Array.of(1, 2, 3) }), 'AUCUN_EVENEMENT');
    await assert.rejects(seance.lireLogoParticipant('x'), TypeError);
  });

  // Un événement du disque portable, en écriture, dont la personne ajoutée
  // porte un logo ; puis le support refuse toute écriture, et le geste
  // suivant le rompt. Rend le montage et les octets du logo.
  async function logoSurSupportRompu() {
    const fs = creerFichiersSimules({ executable: 'E:\\soirees' });
    const montage = monter({ fs, racine: PORTABLE });
    await enEcriture(montage);
    const { seance } = montage;
    await seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } });
    const octets = pngEssai(3, 2, 5);
    await seance.poserLogoParticipant({ id: seance.charge.participants[0].id, octets });
    fs.pannes.ecriture('portable');
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'ECRITURE');
    return { ...montage, octets };
  }

  test('écrire ailleurs emporte logo/ dans le dossier neuf : la personne y retrouve son logo, et rien ne l’annonce', async () => {
    const { fs, seance, octets } = await logoSurSupportRompu();
    await seance.ecrireAilleurs(DOC);
    assert.equal(seance.supportRompu, false);
    assert.deepEqual(fs.octets('documents', surLaRacine(cheminDuLogo(octets))), octets);
    assert.deepEqual(await seance.lireLogoParticipant(cheminDuLogo(octets)), octets);
    assert.ok(!codesDe(seance.etat().avertissements).includes('LOGOS_NON_COPIES'));
  });

  test('un support retiré, que plus rien ne lit, ne refuse pas écrire ailleurs : l’événement y est, sans logo, et LOGOS_NON_COPIES compte ceux restés en arrière', async () => {
    const { fs, seance, octets } = await logoSurSupportRompu();
    // Le support retiré : chaque chemin de l'ancienne racine est absent.
    for (const nom of ['lister', 'lireOctets', 'lireTexte']) {
      const primitive = fs[nom];
      fs[nom] = async (racine, chemin, ...reste) => {
        if (racine.id === 'portable') throw new ErreurStockage('ABSENT', { chemin });
        return primitive(racine, chemin, ...reste);
      };
    }
    const { base } = await seance.ecrireAilleurs(DOC);
    assert.deepEqual([base, seance.supportRompu, seance.racine], [BASE, false, DOC]);
    assert.equal(fs.octets('documents', surLaRacine(cheminDuLogo(octets))), null);
    assert.deepEqual(
      seance.etat().avertissements.filter(({ code }) => code === 'LOGOS_NON_COPIES'),
      [{ code: 'LOGOS_NON_COPIES', details: { evenement: BASE, logos: 1, personnes: 1 } }],
    );
  });

  test('un logo que l’ancien support ne rend plus ne refuse pas écrire ailleurs : l’événement y est, son support rétabli, et LOGOS_NON_COPIES s’annonce', async () => {
    const { fs, seance, octets } = await logoSurSupportRompu();
    const lireOctets = fs.lireOctets;
    fs.lireOctets = async (racine, chemin) => {
      if (racine.id === 'portable') throw new ErreurStockage('LECTURE', { chemin, dossier: racine.chemin, cause: 'EIO' });
      return lireOctets(racine, chemin);
    };
    const { base } = await seance.ecrireAilleurs(DOC);
    assert.deepEqual([base, seance.supportRompu, seance.racine], [BASE, false, DOC]);
    assert.equal(fs.octets('documents', surLaRacine(cheminDuLogo(octets))), null);
    assert.equal(etatDe(fs).charge.participants[0].logo, cheminDuLogo(octets));
    assert.deepEqual(
      seance.etat().avertissements.filter(({ code }) => code === 'LOGOS_NON_COPIES'),
      [{ code: 'LOGOS_NON_COPIES', details: { evenement: BASE, logos: 1, personnes: 1 } }],
    );
  });
});

describe('séance : bloquer et débloquer (§ 8.5, § 9)', () => {
  test("bloquer écrit l'entrée et son jalon, puis la séance revient en lecture et rend le verrou", async () => {
    const montage = monter();
    const { fs, seance } = montage;
    await enEcriture(montage);
    const rendu = await seance.executer('changerEtat', { etat: 'bloque' });
    assert.equal(rendu.libelle, "Plan passé à l'état « Bloqué »");
    assert.equal(seance.mode, 'lecture');
    assert.equal(verrouDe(fs), null);
    assert.equal(montage.planificateur.actives, 0);
    const journal = journalDe(fs);
    assert.deepEqual(journal.jalons.at(-1).nom, 'État « Bloqué »');
    assert.equal(etatDe(fs).charge.evenement.etat, 'bloque');
  });

  test('sur un plan bloqué : passer en écriture, un geste, défaire et nommer sont refusés BLOQUE, sans écriture', async () => {
    const disque = new Map();
    const premier = monter({ fs: creerFichiersSimules({ disque }) });
    await enEcriture(premier);
    await premier.seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } });
    await premier.seance.executer('changerEtat', { etat: 'bloque' });
    const second = monter({ fs: creerFichiersSimules({ disque }), prefixe: 'seconde' });
    await ouvrirSansEcrire(second);
    for (const { seance, fs } of [premier, second]) {
      const avant = fs.compteurs.ecritures;
      const bloque = BLOQUE_SEUL;
      await refus(seance.passerEnEcriture(), 'LECTURE_SEULE', bloque);
      await refus(seance.executer('changerEtat', { etat: 'retenu' }), 'LECTURE_SEULE', bloque);
      await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'LECTURE_SEULE', bloque);
      await refus(seance.defaire(), 'LECTURE_SEULE', bloque);
      await refus(seance.nommer('Distribué'), 'LECTURE_SEULE', bloque);
      assert.equal(fs.compteurs.ecritures, avant);
      assert.equal(seance.mode, 'lecture');
    }
    assert.match(libelle('LECTURE_SEULE', { raison: 'BLOQUE' }), /« Débloquer »/);
  });

  test("débloquer prend le verrou, écrit une entrée et un jalon, rend l'état que le contenu impose, et laisse la séance en écriture", async () => {
    const montage = monter();
    const { fs, seance } = montage;
    await enEcriture(montage);
    await seance.executer('changerEtat', { etat: 'bloque' });
    const entrees = journalDe(fs).entrees.length;
    const rendu = await seance.debloquer();
    assert.equal(rendu.libelle, 'Plan débloqué, état « Brouillon »');
    assert.equal(seance.mode, 'ecriture');
    assert.equal(verrouDe(fs).seance, seance.id);
    assert.equal(seance.charge.evenement.etat, etatDeduit(seance.charge));
    const journal = journalDe(fs);
    assert.equal(journal.entrees.length, entrees + 1);
    assert.deepEqual(journal.jalons.at(-1), { ...journal.jalons.at(-1), revision: journal.entrees.at(-1).revision, nom: 'État « Brouillon »' });
    await seance.executer('changerEtat', { etat: 'bloque' });
    await seance.executer('debloquer', {});
    assert.deepEqual([seance.mode, seance.charge.evenement.etat], ['ecriture', 'brouillon']);
  });

  test("débloquer devant le verrou d'un autre poste est refusé VERROU_PRIS, avant toute entrée", async () => {
    const montage = monter();
    const { fs, seance } = montage;
    await enEcriture(montage);
    await seance.executer('changerEtat', { etat: 'bloque' });
    const depuis = '2031-05-17T09:00:00-04:00';
    fs.deposer('documents', VERROU, `${JSON.stringify({ seance: 'lointaine-1', pid: 99, hote: 'autre-poste', depuis })}\n`);
    const journal = fs.contenu('documents', JOURNAL);
    const avant = fs.compteurs.ecritures;
    await refus(seance.debloquer(), 'VERROU_PRIS', { seance: 'lointaine-1', depuis, vivant: null, remede: null });
    assert.equal(fs.compteurs.ecritures - avant, 1, 'seule la prise du verrou se tente');
    assert.equal(fs.contenu('documents', JOURNAL), journal);
    assert.deepEqual([seance.mode, seance.charge.evenement.etat], ['lecture', 'bloque']);
    assert.equal(verrouDe(fs).seance, 'lointaine-1');
  });

  test("débloquer un plan qui ne l'est pas : en lecture MODE_LECTURE, en écriture PLAN_NON_BLOQUE", async () => {
    const montage = monter();
    await montage.seance.creer({ nom: BASE, date: null, siegesParDefaut: 2, tours: 2 });
    await refus(montage.seance.debloquer(), 'MODE_LECTURE');
    await montage.seance.passerEnEcriture();
    const avant = montage.fs.compteurs.ecritures;
    await refus(montage.seance.debloquer(), 'PLAN_NON_BLOQUE');
    assert.equal(montage.fs.compteurs.ecritures, avant);
  });
});

describe("séance : un fichier d'un format plus récent (§ 8.8)", () => {
  test("s'ouvre en lecture sans rien écrire, et tout ce qui écrirait est refusé LECTURE_SEULE FORMAT, avant BLOQUE", async () => {
    const fs = creerFichiersSimules();
    fs.deposerDossier('documents');
    const charge = chargeEssai();
    charge.evenement.etat = 'bloque';
    fs.deposer(
      'documents',
      ETAT,
      serialiser(charge, { revision: 1, produitVersion: V1 }).replace(`"format":${FORMAT}`, `"format":${FORMAT + 1}`),
    );
    const { seance } = monter({ fs });
    const avant = fs.compteurs.ecritures;
    await seance.ouvrir(EVT);
    assert.equal(seance.ouvert.formatPlusRecent, true);
    const format = FORMAT_SEUL;
    await refus(seance.passerEnEcriture(), 'LECTURE_SEULE', format);
    await refus(seance.executer('changerEtat', { etat: 'retenu' }), 'LECTURE_SEULE', format);
    await refus(seance.debloquer(), 'LECTURE_SEULE', format);
    await refus(seance.defaire(), 'LECTURE_SEULE', format);
    assert.equal(fs.compteurs.ecritures, avant);
    assert.doesNotMatch(libelle('LECTURE_SEULE', format), /Débloquer/);
  });
});

describe('séance : la perte du support en cours de séance (§ 8.6)', () => {
  // Un événement du disque portable, en écriture, après un premier geste.
  async function surPortable(reglages = {}) {
    const fs = creerFichiersSimules({ executable: 'E:\\soirees', ...reglages });
    const montage = monter({ fs, racine: PORTABLE });
    await enEcriture(montage);
    await montage.seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } });
    return montage;
  }

  test("une écriture refusée rompt le support : le geste est refusé, les suivants aussi, puis écrire ailleurs rétablit", async () => {
    const { fs, seance } = await surPortable();
    fs.pannes.ecriture('portable');
    const refusSupport = { echec: 'ECRITURE', chemin: NOM.JOURNAL, dossier: dossierDe(PORTABLE.chemin), cause: 'EROFS' };
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'ECRITURE');
    assert.equal(seance.supportRompu, true);
    assert.deepEqual(seance.refusSupport, refusSupport);
    assert.deepEqual(noms(seance.charge), ['Ancolie']);
    const avant = fs.compteurs.ecritures;
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'SUPPORT_ROMPU', { ...refusSupport, remede: versRacine(DOC) });
    await refus(seance.defaire(), 'SUPPORT_ROMPU');
    assert.equal(fs.compteurs.ecritures, avant);
    assert.match(libelle('SUPPORT_ROMPU', refusSupport), /Écrire ailleurs/);

    const { base, avertissements } = await seance.ecrireAilleurs(DOC);
    assert.equal(base, BASE);
    assert.deepEqual(avertissements, [
      { code: 'VERROU_NON_RENDU', details: { chemin: NOM.VERROU, dossier: dossierDe(PORTABLE.chemin), cause: 'EROFS' } },
    ]);
    assert.deepEqual([seance.supportRompu, seance.refusSupport, seance.mode], [false, null, 'ecriture']);
    assert.deepEqual(seance.racine, DOC);
    assert.equal(verrouDe(fs).seance, seance.id);
    await seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } });
    assert.deepEqual(libellesDe(journalDe(fs)), [CREATION, 'Ajouté Ancolie', 'Ajouté Bruyère']);
    assert.deepEqual(noms(etatDe(fs).charge), ['Ancolie', 'Bruyère']);
  });

  test("écrire ailleurs aboutit dans une racine dont un dossier refuse sa liste : il ne porte rien, et l'identifiant se cherche dans les autres", async () => {
    const { fs, seance } = await surPortable();
    fs.deposerDossier('documents', 'System Volume Information');
    const lister = fs.lister;
    fs.lister = async (racine, chemin) => {
      if (racine.id === 'documents' && chemin === 'System Volume Information') {
        throw new ErreurStockage('LECTURE', { chemin, dossier: DOCUMENTS, cause: 'EPERM' });
      }
      return lister(racine, chemin);
    };
    fs.pannes.ecriture('portable');
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'ECRITURE');
    const { base } = await seance.ecrireAilleurs(DOC);
    assert.equal(base, BASE);
    assert.deepEqual([seance.supportRompu, seance.racine], [false, DOC]);
    assert.deepEqual(noms(etatDe(fs).charge), ['Ancolie']);
  });

  test("le cadrage en attente quand le support rompt s'écrit dans les réglages de la racine nouvelle, après écrire ailleurs", async () => {
    const { fs, seance, planificateur } = await surPortable();
    fs.pannes.ecriture('portable');
    seance.demanderCadrage({ k: 1.25, tx: 30, ty: -12 });
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'ECRITURE');
    await seance.ecrireAilleurs(DOC);
    await planificateur.avancer(DELAI_REGLAGES_MS);
    await laisser();
    const evenement = seance.charge.evenement.id;
    assert.deepEqual(JSON.parse(fs.contenu('documents', FICHIER_REGLAGES)).cadrages, [{ evenement, k: 1.25, tx: 30, ty: -12 }]);
    assert.equal(fs.contenu('portable', FICHIER_REGLAGES), null);
  });

  test("un état qui ne s'écrit pas : le geste est au journal, la séance en montre la charge, et écrire ailleurs la garde", async () => {
    const { fs, seance } = await surPortable();
    fs.pannes.renommage('portable');
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'ETAT_NON_ECRIT');
    assert.deepEqual([seance.supportRompu, seance.refusSupport.echec], [true, 'ETAT_NON_ECRIT']);
    assert.deepEqual(noms(seance.charge), ['Ancolie', 'Bruyère']);
    assert.deepEqual(libellesDe(journalDe(fs, 'portable')), [CREATION, 'Ajouté Ancolie', 'Ajouté Bruyère']);
    await seance.ecrireAilleurs(DOC);
    assert.deepEqual(noms(etatDe(fs).charge), ['Ancolie', 'Bruyère']);
    assert.equal(seance.supportRompu, false);
  });

  test("un jalon d'état qui ne s'écrit pas laisse le geste enregistré : JALON_NON_ECRIT le dit, et le support est rompu", async () => {
    const montage = monter();
    const { fs, seance } = montage;
    await enEcriture(montage);
    // La deuxième ligne ajoutée au journal à partir d'ici, le jalon qui suit
    // l'entrée, trouve le support en lecture seule.
    const ajouterLigne = fs.ajouterLigne;
    let lignes = 0;
    fs.ajouterLigne = async (racine, chemin, ligne) => {
      lignes += 1;
      if (lignes === 2) fs.pannes.ecriture(racine.id);
      return ajouterLigne(racine, chemin, ligne);
    };
    const refusSupport = { chemin: NOM.JOURNAL, dossier: dossierDe(DOCUMENTS), cause: 'EROFS' };
    const rendu = await seance.executer('changerEtat', { etat: 'bloque' });
    assert.deepEqual(rendu, {
      libelle: "Plan passé à l'état « Bloqué »",
      avertissements: [
        { code: 'JALON_NON_ECRIT', details: refusSupport },
        { code: 'VERROU_NON_RENDU', details: { chemin: NOM.VERROU, dossier: dossierDe(DOCUMENTS), cause: 'EROFS' } },
      ],
    });
    assert.deepEqual([seance.supportRompu, seance.refusSupport], [true, { echec: 'JALON_NON_ECRIT', ...refusSupport }]);
    assert.equal(seance.mode, 'lecture');
    assert.equal(etatDe(fs).charge.evenement.etat, 'bloque');
    const journal = journalDe(fs);
    assert.equal(journal.entrees.at(-1).libelle, "Plan passé à l'état « Bloqué »");
    assert.deepEqual(journal.jalons.map(({ nom }) => nom), ['Création']);
  });

  test("une création dont l'état ne s'écrit pas reste ouverte en lecture, le support rompu, et s'écrit ailleurs", async () => {
    const fs = creerFichiersSimules({ executable: 'E:\\soirees' });
    const montage = monter({ fs, racine: PORTABLE });
    const { seance } = montage;
    // La deuxième écriture atomique, l'état qui suit le journal, trouve le
    // support en lecture seule.
    const ecrireAtomique = fs.ecrireAtomique;
    let ecritures = 0;
    fs.ecrireAtomique = async (racine, chemin, texte) => {
      ecritures += 1;
      if (ecritures === 2) fs.pannes.ecriture(racine.id);
      return ecrireAtomique(racine, chemin, texte);
    };
    await refus(seance.creer({ nom: BASE, date: null, siegesParDefaut: 2, tours: 2 }), 'ETAT_NON_ECRIT');
    assert.deepEqual([seance.mode, seance.supportRompu, seance.refusSupport.echec], ['lecture', true, 'ETAT_NON_ECRIT']);
    assert.equal(seance.charge.evenement.nom, BASE);
    assert.equal(fs.contenu('portable', ETAT), null);
    const { base } = await seance.ecrireAilleurs(DOC);
    assert.equal(base, BASE);
    assert.deepEqual([seance.supportRompu, seance.mode, verrouDe(fs)], [false, 'lecture', null]);
    assert.deepEqual(libellesDe(journalDe(fs)), [CREATION]);
    assert.equal(etatDe(fs).entete.revision, 1);
  });

  test("un verrou que le support refuse rompt le support : « Modifier » est refusé, puis écrire ailleurs rétablit l'écriture", async () => {
    const { fs, seance, planificateur } = await surPortable();
    await planificateur.avancer(INACTIVITE_MS);
    assert.deepEqual([seance.mode, verrouDe(fs, 'portable')], ['lecture', null]);
    fs.pannes.ecriture('portable');
    const details = { chemin: NOM.VERROU, dossier: dossierDe(PORTABLE.chemin), cause: 'EROFS' };
    await refus(seance.passerEnEcriture(), 'ECRITURE', details);
    const refusSupport = { echec: 'VERROU_NON_ECRIT', ...details };
    assert.deepEqual([seance.mode, seance.supportRompu, seance.refusSupport], ['lecture', true, refusSupport]);
    assert.deepEqual(noms(seance.charge), ['Ancolie']);
    const avant = fs.compteurs.ecritures;
    await refus(seance.passerEnEcriture(), 'SUPPORT_ROMPU', { ...refusSupport, remede: versRacine(DOC) });
    assert.equal(fs.compteurs.ecritures, avant);
    const { base } = await seance.ecrireAilleurs(DOC);
    assert.equal(base, BASE);
    assert.deepEqual([seance.supportRompu, seance.mode, seance.racine], [false, 'lecture', DOC]);
    await seance.passerEnEcriture();
    assert.equal(verrouDe(fs).seance, seance.id);
    await seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } });
    assert.deepEqual(libellesDe(journalDe(fs)), [CREATION, 'Ajouté Ancolie', 'Ajouté Bruyère']);
  });

  test("débloquer devant un verrou que le support refuse rompt aussi le support, et le plan se débloque ailleurs", async () => {
    const { fs, seance } = await surPortable();
    await seance.executer('changerEtat', { etat: 'bloque' });
    assert.equal(seance.mode, 'lecture');
    fs.pannes.ecriture('portable');
    const details = { chemin: NOM.VERROU, dossier: dossierDe(PORTABLE.chemin), cause: 'EROFS' };
    await refus(seance.debloquer(), 'ECRITURE', details);
    assert.deepEqual([seance.mode, seance.supportRompu, seance.refusSupport], ['lecture', true, { echec: 'VERROU_NON_ECRIT', ...details }]);
    assert.equal(seance.charge.evenement.etat, 'bloque');
    await seance.ecrireAilleurs(DOC);
    const rendu = await seance.debloquer();
    assert.equal(rendu.libelle, 'Plan débloqué, état « Brouillon »');
    assert.deepEqual([seance.mode, verrouDe(fs)?.seance], ['ecriture', seance.id]);
    assert.equal(etatDe(fs).charge.evenement.etat, 'brouillon');
  });

  test("écrire ailleurs dont le verrou ne s'écrit pas là-bas : la paire y est, la séance y passe en lecture, son support de nouveau rompu", async () => {
    const { fs, seance } = await surPortable();
    fs.pannes.ecriture('portable');
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'ECRITURE');
    // Les Documents prennent la paire, mais refusent le verrou.
    const details = { chemin: NOM.VERROU, dossier: dossierDe(DOCUMENTS), cause: 'EACCES' };
    const verrouiller = fs.verrouiller;
    fs.verrouiller = async (racine, chemin, jeton, depuis) => {
      if (racine.id === 'documents') throw new ErreurStockage('ECRITURE', details);
      return verrouiller(racine, chemin, jeton, depuis);
    };
    const { base, avertissements } = await seance.ecrireAilleurs(DOC);
    assert.equal(base, BASE);
    assert.deepEqual(avertissements.map(({ code }) => code), ['VERROU_NON_RENDU', 'ECRITURE']);
    const refusSupport = { echec: 'VERROU_NON_ECRIT', ...details };
    assert.deepEqual([seance.racine, seance.mode, seance.supportRompu, seance.refusSupport], [DOC, 'lecture', true, refusSupport]);
    assert.deepEqual(noms(etatDe(fs).charge), ['Ancolie']);
    // Le support rompu est celui des Documents : aucune racine à proposer.
    await refus(seance.passerEnEcriture(), 'SUPPORT_ROMPU', { ...refusSupport, remede: versRacine(null) });
  });

  test("écrire ailleurs refuse un dossier qui porte déjà l'événement, le sien compris : jamais deux copies d'un identifiant dans un dossier", async () => {
    const montage = monter();
    const { fs, seance } = montage;
    await enEcriture(montage);
    await seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } });
    fs.pannes.renommage('documents', 11);
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'ETAT_NON_ECRIT');
    assert.equal(seance.supportRompu, true);
    const avant = fs.compteurs.ecritures;
    const id = seance.charge.evenement.id;
    const erreur = await refus(seance.ecrireAilleurs(DOC), 'IDENTIFIANT_PRESENT', { id, base: BASE, dossier: BASE });
    assert.equal(fs.compteurs.ecritures, avant);
    assert.deepEqual([seance.supportRompu, seance.racine], [true, DOC]);
    const etats = (await fs.lister(DOC, BASE)).filter(({ nom }) => nom.endsWith(SUFFIXES.etat)).map(({ nom }) => nom);
    assert.deepEqual(etats, [NOM.ETAT]);
    assert.doesNotMatch(libelle(erreur.code, erreur.details), /import/);
  });

  test("un état qu'écrire ailleurs ne pose pas y transporte la séance, avec le journal écrit : un nouvel essai n'y dérive pas une seconde base", async () => {
    const { fs, seance } = await surPortable();
    fs.pannes.ecriture('portable');
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'ECRITURE');
    // La deuxième écriture atomique dans les Documents, l'état qui suit le
    // journal, voit refusés tous ses renommages.
    const ecrireAtomique = fs.ecrireAtomique;
    let ecritures = 0;
    fs.ecrireAtomique = async (racine, chemin, texte) => {
      if (racine.id === 'documents') {
        ecritures += 1;
        if (ecritures === 2) fs.pannes.renommage('documents', 11);
      }
      return ecrireAtomique(racine, chemin, texte);
    };
    const id = seance.charge.evenement.id;
    await refus(seance.ecrireAilleurs(DOC), 'ETAT_NON_ECRIT');
    assert.deepEqual([seance.racine, seance.ouvert.racine, seance.ouvert.base], [DOC, DOC, BASE]);
    const refusSupport = { echec: 'ETAT_NON_ECRIT', chemin: NOM.ETAT, dossier: dossierDe(DOCUMENTS), cause: 'EBUSY' };
    assert.deepEqual([seance.mode, seance.supportRompu, seance.refusSupport], ['lecture', true, refusSupport]);
    assert.deepEqual(seance.avertissements, [
      { code: 'VERROU_NON_RENDU', details: { chemin: NOM.VERROU, dossier: dossierDe(PORTABLE.chemin), cause: 'EROFS' } },
    ]);
    assert.deepEqual(noms(seance.charge), ['Ancolie']);
    assert.deepEqual(libellesDe(journalDe(fs)), [CREATION, 'Ajouté Ancolie']);
    assert.equal(fs.contenu('documents', ETAT), null);
    const avant = fs.compteurs.ecritures;
    await refus(seance.ecrireAilleurs(DOC), 'IDENTIFIANT_PRESENT', { id, base: BASE, dossier: BASE });
    await refus(seance.ecrireAilleurs(PORTABLE), 'IDENTIFIANT_PRESENT', { id, base: BASE, dossier: BASE });
    assert.equal(fs.compteurs.ecritures, avant);
    assert.deepEqual((await fs.lister(DOC, '')).map(({ nom }) => nom), [BASE]);
    const fichiers = (await fs.lister(DOC, BASE)).map(({ nom }) => nom);
    assert.deepEqual(fichiers, [NOM.JOURNAL]);
  });

  // L'événement d'essai des Documents, dont l'état devient un JSON tronqué et
  // dont le journal reste lisible : ouvrir le refuse, la séance l'ouvre par
  // le secours du journal et passe en écriture, puis l'état d'un geste ne
  // s'écrit pas — le geste est au journal, le support est rompu.
  async function illisibleRompu() {
    const fs = creerFichiersSimules({ executable: 'E:\\soirees' });
    await deposerEssai(fs);
    fs.deposer('documents', ETAT, fs.contenu('documents', ETAT).slice(0, 40));
    const montage = monter({ fs });
    const { seance } = montage;
    const illisible = await refus(seance.ouvrir(EVT), 'ETAT_ILLISIBLE');
    assert.deepEqual([illisible.details.raison, illisible.details.secours], ['JSON', { precedent: null, journal: 1 }]);
    await seance.ouvrirSecours(EVT, 'journal');
    await seance.passerEnEcriture();
    fs.pannes.renommage('documents', 11);
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } }), 'ETAT_NON_ECRIT');
    assert.deepEqual([seance.supportRompu, seance.racine], [true, DOC]);
    return montage;
  }

  // Les noms des fichiers d'une racine.
  const fichiersDe = async (fs, racine) => (await fs.lister(racine, '')).map(({ nom }) => nom);

  test("écrire ailleurs refuse le dossier où l'événement n'a qu'un état illisible, que son journal apparie : aucune seconde paire, et ce journal reste son secours", async () => {
    const { fs, seance } = await illisibleRompu();
    const id = seance.charge.evenement.id;
    const avant = fs.compteurs.ecritures;
    const fichiers = await fichiersDe(fs, DOC);
    await refus(seance.ecrireAilleurs(DOC), 'IDENTIFIANT_PRESENT', { id, base: BASE, dossier: BASE });
    assert.equal(fs.compteurs.ecritures, avant);
    assert.deepEqual(await fichiersDe(fs, DOC), fichiers);
    assert.deepEqual([seance.supportRompu, seance.racine], [true, DOC]);
    const illisible = await refus(ouvrirDansLeDepot(fs, DOC, EVT), 'ETAT_ILLISIBLE');
    assert.deepEqual(illisible.details.secours, { precedent: null, journal: 2 });
  });

  test("écrire ailleurs refuse de revenir au dossier d'où l'événement est parti, quand son état y est illisible", async () => {
    const { fs, seance } = await illisibleRompu();
    const id = seance.charge.evenement.id;
    await seance.ecrireAilleurs(PORTABLE);
    assert.deepEqual([seance.racine, seance.supportRompu, seance.mode], [PORTABLE, false, 'ecriture']);
    fs.pannes.ecriture('portable');
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'ECRITURE');
    const avant = fs.compteurs.ecritures;
    const fichiers = await fichiersDe(fs, DOC);
    await refus(seance.ecrireAilleurs(DOC), 'IDENTIFIANT_PRESENT', { id, base: BASE, dossier: BASE });
    assert.equal(fs.compteurs.ecritures, avant);
    assert.deepEqual(await fichiersDe(fs, DOC), fichiers);
    assert.deepEqual([seance.supportRompu, seance.racine], [true, PORTABLE]);
  });

  test("écrire ailleurs sur un support amovible l'annonce, comme la règle du dossier de travail au démarrage (§ 8.8)", async () => {
    const { fs, seance } = await surPortable({ support: { documents: 'amovible' } });
    fs.pannes.ecriture('portable');
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'ECRITURE');
    const amovible = { code: 'SUPPORT_AMOVIBLE', details: { dossier: DOCUMENTS } };
    const { avertissements } = await seance.ecrireAilleurs(DOC);
    assert.deepEqual(avertissements, [
      { code: 'VERROU_NON_RENDU', details: { chemin: NOM.VERROU, dossier: dossierDe(PORTABLE.chemin), cause: 'EROFS' } },
      amovible,
    ]);
    assert.ok(seance.avertissements.some(({ code }) => code === 'SUPPORT_AMOVIBLE'));
    assert.match(libelle(amovible.code, amovible.details), /Gestion table tournante Libre/);
  });

  const fautesDuPont = [
    ['stockage', () => new ErreurStockage('LECTURE', { chemin: '', dossier: DOCUMENTS, cause: 'EIO' })],
    ['pont', () => new TypeError('réponse du pont illisible pour typeSupport')],
  ];
  for (const [nature, faute] of fautesDuPont) {
    test(`écrire ailleurs réussit quand le type du support ne se dit pas (faute ${nature}) : le support vaut inconnu, rien n'est annoncé`, async () => {
      const { fs, seance, planificateur } = await surPortable({ support: { documents: 'amovible' } });
      fs.pannes.ecriture('portable');
      await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'ECRITURE');
      fs.typeSupport = async () => {
        throw faute();
      };
      const { base, avertissements } = await seance.ecrireAilleurs(DOC);
      assert.equal(base, BASE);
      assert.deepEqual(avertissements, [
        { code: 'VERROU_NON_RENDU', details: { chemin: NOM.VERROU, dossier: dossierDe(PORTABLE.chemin), cause: 'EROFS' } },
      ]);
      assert.deepEqual(seance.avertissements, avertissements);
      assert.deepEqual([seance.supportRompu, seance.mode, seance.racine, planificateur.actives], [false, 'ecriture', DOC, 1]);
    });
  }

  test("tant que le support est rompu, ouvrir, ouvrir un secours, créer et fermer sont refusés SUPPORT_ROMPU_NON_SAUVE, sans rien changer", async () => {
    const { fs, seance } = await surPortable();
    fs.pannes.ecriture('portable');
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'ECRITURE');
    const refusSupport = { echec: 'ECRITURE', chemin: NOM.JOURNAL, dossier: dossierDe(PORTABLE.chemin), cause: 'EROFS' };
    const nonSauve = { ...refusSupport, remede: versRacine(DOC) };
    const avant = fs.compteurs.ecritures;
    await refus(seance.ouvrir(EVT), 'SUPPORT_ROMPU_NON_SAUVE', nonSauve);
    await refus(seance.ouvrirSecours(EVT, 'journal'), 'SUPPORT_ROMPU_NON_SAUVE', nonSauve);
    await refus(seance.creer({ nom: 'Soirée des Grillons', date: null, siegesParDefaut: 2, tours: 2 }), 'SUPPORT_ROMPU_NON_SAUVE', nonSauve);
    await refus(seance.fermer(), 'SUPPORT_ROMPU_NON_SAUVE', nonSauve);
    assert.equal(fs.compteurs.ecritures, avant);
    assert.deepEqual([seance.supportRompu, seance.refusSupport, noms(seance.charge)], [true, refusSupport, ['Ancolie']]);
    assert.match(libelle('SUPPORT_ROMPU_NON_SAUVE', refusSupport), /« Écrire ailleurs »/);
    await seance.ecrireAilleurs(DOC);
    await seance.fermer();
    assert.equal(seance.ouvert, null);
  });

  test("le support rompu se quitte sur abandon explicite : ouvrir, ou fermer, avec {abandonner: true}", async () => {
    const { fs, seance } = await surPortable();
    fs.pannes.ecriture('portable');
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'ECRITURE');
    const rendu = await seance.ouvrir(EVT, { abandonner: true });
    assert.equal(rendu.base, BASE);
    assert.deepEqual([seance.supportRompu, seance.mode, noms(seance.charge)], [false, 'lecture', ['Ancolie']]);
    await refus(seance.passerEnEcriture(), 'ECRITURE');
    assert.equal(seance.supportRompu, true);
    await seance.fermer({ abandonner: true });
    assert.deepEqual([seance.ouvert, seance.supportRompu], [null, false]);
  });

  test("le support rompu se quitte sur abandon explicite : créer, ou ouvrir un secours, avec {abandonner: true}", async () => {
    const { fs, seance } = await surPortable();
    // Un état que le support refuse rompt le support ; les renommages
    // rétablis ensuite, ce qui suit s'écrit.
    const rompre = async (nom) => {
      await seance.passerEnEcriture();
      fs.pannes.renommage('portable');
      await refus(seance.executer('ajouterParticipant', { champs: { nom } }), 'ETAT_NON_ECRIT');
      fs.pannes.renommage('portable', 0);
      assert.equal(seance.supportRompu, true);
    };
    await rompre('Bruyère');
    const grillons = 'Soirée des Grillons';
    const cree = await seance.creer({ nom: grillons, date: null, siegesParDefaut: 2, tours: 2 }, { abandonner: true });
    assert.equal(cree.base, grillons);
    assert.deepEqual([seance.supportRompu, seance.mode, seance.charge.evenement.nom], [false, 'lecture', grillons]);
    await rompre('Cerfeuil');
    const secours = await seance.ouvrirSecours(EVT, 'journal', { abandonner: true });
    assert.equal(secours.base, BASE);
    assert.deepEqual([seance.supportRompu, seance.mode, noms(seance.charge)], [false, 'lecture', ['Ancolie', 'Bruyère']]);
  });

  test("écrire ailleurs qui échoue laisse le support rompu ; sans support rompu, il est refusé SUPPORT_INTACT", async () => {
    const { fs, seance } = await surPortable();
    const avant = fs.compteurs.ecritures;
    await refus(seance.ecrireAilleurs(DOC), 'SUPPORT_INTACT');
    assert.equal(fs.compteurs.ecritures, avant);
    fs.pannes.ecriture('portable');
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'ECRITURE');
    fs.pannes.ecriture('documents');
    await refus(seance.ecrireAilleurs(DOC), 'ECRITURE');
    assert.equal(seance.supportRompu, true);
    assert.deepEqual(seance.racine, PORTABLE);
  });
});

describe("séance : ni horloge ni minuterie lues en direct (§ 14.7)", () => {
  // Commentaires et chaînes blanchis : seul le code compte.
  const JETONS = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\[\s\S]|[^`\\])*`/g;
  const code = (texte) => texte.replace(JETONS, (jeton) => jeton.replace(/[^\n]/g, ' '));

  test("ni la séance, ni les commandes, ni la table des libellés ne lisent l'horloge, un aléa ou une minuterie", () => {
    for (const fichier of ['seance.js', 'avertissements.js', 'commandes.js', 'libelles.js']) {
      const texte = code(readFileSync(new URL(`./${fichier}`, import.meta.url), 'utf8'));
      assert.ok(texte.trim().length > 0, `${fichier} vide`);
      for (const motif of [/\bDate\b/, /\bsetTimeout\b/, /\bsetInterval\b/, /\bclearTimeout\b/, /\bperformance\b/, /\bMath\s*\.\s*random\b/, /\bcrypto\b/]) {
        assert.doesNotMatch(texte, motif, `${fichier} : ${motif}`);
      }
    }
  });
});

// --- La séance observable ----------------------------------------------------

// Laisse passer les tâches en attente : l'écrivain différé des réglages
// écrit à la suite de sa minuterie, sans que celle-ci rende sa promesse.
// setImmediate rappelle une fois vidées les microtâches, où s'enchaînent
// les écritures du système de fichiers d'épreuve ; il n'attend aucune durée.
const laisser = () => new Promise((resolve) => setImmediate(resolve));

// Compte les objets atteints depuis valeur, chacun une fois, en affirmant
// que chacun est figé.
function compterFiges(valeur, vus = new Set()) {
  if (valeur === null || typeof valeur !== 'object' || vus.has(valeur)) return 0;
  vus.add(valeur);
  assert.ok(Object.isFrozen(valeur), `objet non figé : ${JSON.stringify(valeur).slice(0, 80)}`);
  return 1 + Object.keys(valeur).reduce((n, cle) => n + compterFiges(valeur[cle], vus), 0);
}

const codesDe = (avertissements) => avertissements.map(({ code }) => code);

// La charge d'essai, d'un plan bloqué.
const chargeBloquee = () => {
  const charge = chargeEssai();
  charge.evenement.etat = 'bloque';
  return charge;
};

// Le retenu de la proposition 1 posé sur la charge d'essai : Iris et
// Grisaille à la table 1 au premier tour, Iris et Théo au second.
function avecRetenu(charge) {
  charge.retenu = {
    proposition: 1,
    siegesAttribues: false,
    tables: [1, 2],
    capacites: [2, 2],
    tours: 2,
    participants: [1, 2, 3, 4],
    placement: [
      { sieges: [[1, 2], [3, 4]], reserve: [] },
      { sieges: [[1, 3], [2, 4]], reserve: [] },
    ],
  };
  charge.prochainsIds.proposition = 2;
  charge.evenement.etat = 'retenu';
  return charge;
}

// Grisaille réservée à la table 2 au premier tour, où le retenu l'assoit à
// la table 1.
const reserverGrisaille = (charge) => {
  charge.reservations.push({ participant: 2, table: 2, siege: null, portee: 'tour', tour: 1 });
  return charge;
};

// Un montage dont l'événement d'essai, de cette charge, est ouvert.
async function ouvertSur(charge = chargeEssai(), options = {}) {
  const fs = options.fs ?? creerFichiersSimules();
  await deposerEssai(fs, charge);
  const montage = monter({ ...options, fs });
  await montage.seance.ouvrir(EVT);
  return montage;
}

// Un fichier d'état de la charge d'essai, au format donné.
function deposerAuFormat(fs, format, charge = chargeEssai()) {
  fs.deposerDossier('documents');
  const texte = serialiser(charge, { revision: 1, produitVersion: V1 });
  fs.deposer('documents', ETAT, texte.replace(`"format":${FORMAT}`, `"format":${format}`));
}

const MODIFIER = { geste: 'modifier' };
const DEBLOQUER = { geste: 'debloquer' };

describe('séance observable : etat() et subscribe (§ 8.4)', () => {
  test('subscribe appelle aussitôt, puis après ouvrir, passer en écriture, un geste et passer en lecture ; désabonné, plus rien', async () => {
    const fs = creerFichiersSimules();
    await deposerEssai(fs);
    const { seance } = monter({ fs });
    const recus = [];
    const desabonner = seance.subscribe((etat) => recus.push(etat));
    assert.equal(recus.length, 1);
    assert.equal(recus[0], seance.etat());
    assert.equal(recus[0].evenement, null);
    await seance.ouvrir(EVT);
    assert.deepEqual([recus.at(-1).evenement.base, recus.at(-1).mode], [BASE, 'lecture']);
    await seance.passerEnEcriture();
    assert.equal(recus.at(-1).mode, 'ecriture');
    await seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } });
    assert.deepEqual(noms(recus.at(-1).charge), ['Ombrelle', 'Grisaille', 'Pervenche', 'Lacasse', 'Ancolie']);
    await seance.passerEnLecture();
    assert.equal(recus.at(-1).mode, 'lecture');
    assert.ok(recus.length >= 5, `${recus.length} appels`);
    assert.equal(new Set(recus.slice(1)).size, recus.length - 1, 'un état rendu deux fois');
    const n = recus.length;
    desabonner();
    await seance.passerEnEcriture();
    seance.debuterCalcul();
    assert.equal(recus.length, n);
  });

  test("l'état rendu n'est jamais muté : figé en profondeur, et une copie d'avant compare égale après les gestes suivants", async () => {
    const { seance } = await ouvertSur();
    await seance.passerEnEcriture();
    const etat = seance.etat();
    const copie = structuredClone(etat);
    assert.ok(compterFiges(etat) > 20);
    assert.throws(() => etat.charge.participants.push(personne(9, 'Ancolie')), TypeError);
    await seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } });
    await seance.executer('exclureParticipant', { id: 3 });
    await seance.defaire();
    assert.deepEqual(etat, copie);
    assert.notEqual(seance.etat(), etat);
    assert.equal(seance.etat(), seance.etat(), "deux lectures sans changement rendent le même état");
    compterFiges(seance.etat());
  });

  test("la charge de l'état garde son identité tant que l'événement ne change pas, et chaque geste en rend une neuve, figée", async () => {
    const { seance } = await ouvertSur();
    await seance.passerEnEcriture();
    const etat = seance.etat();
    const { charge } = etat;
    seance.debuterCalcul();
    seance.finirCalcul();
    assert.notEqual(seance.etat(), etat);
    assert.equal(seance.etat().charge, charge);
    await seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } });
    const apres = seance.etat().charge;
    assert.notEqual(apres, charge);
    compterFiges(apres);
    await seance.executer('exclureParticipant', { id: 3 });
    assert.notEqual(seance.etat().charge, apres);
    compterFiges(seance.etat().charge);
  });

  test("l'état porte l'événement, la charge, l'examen, les retours, le calcul en cours ; sans événement, rien", async () => {
    const vide = monter().seance.etat();
    assert.deepEqual(
      [vide.evenement, vide.charge, vide.examen, vide.fautives, vide.avertissements, vide.refus, vide.supportRompu, vide.verrouAutre],
      [null, null, null, [], [], null, null, null],
    );
    assert.deepEqual([vide.mode, vide.retours, vide.calculEnCours, vide.racine], ['lecture', { defaire: false, refaire: false, jalons: 0 }, false, DOC]);
    const { seance } = await ouvertSur();
    await seance.passerEnEcriture();
    await seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } });
    const etat = seance.etat();
    assert.deepEqual(etat.evenement, {
      cle: EVT,
      base: BASE,
      id: 'evt-lucioles',
      nom: BASE,
      etat: 'brouillon',
      revision: 2,
      annonceFormat: null,
    });
    assert.deepEqual(etat.charge, seance.charge);
    assert.deepEqual(etat.examen, seance.ouvert.examen);
    assert.deepEqual(etat.retours, { defaire: true, refaire: false, jalons: 1 });
    const recus = [];
    seance.subscribe((suivant) => recus.push(suivant));
    seance.debuterCalcul();
    assert.deepEqual([seance.etat().calculEnCours, recus.at(-1).calculEnCours], [true, true]);
    seance.finirCalcul();
    assert.deepEqual([seance.etat().calculEnCours, recus.at(-1).calculEnCours], [false, false]);
  });
});

// La copie entière d'un Ouvert : sa charge et son examen nommé en un seul
// structuredClone. Les épreuves la prennent pour valeur attendue de la
// charge et de l'examen publiés, au caractère près.
const copieEntiere = ({ charge, examen }) => structuredClone({ charge, examen: examenNomme(examen, charge) });

// Deux personnes du retenu assises au tour 1 à des tables différentes, hors
// de la réservée : un échange qui change le retenu sans toucher aux
// propositions.
function deuxTablesDuRetenu(charge) {
  const [premiere, seconde] = charge.retenu.placement[0].sieges;
  return { tour: 1, a: premiere.find((id) => id !== 1), b: seconde.find((id) => id !== 1) };
}

// Une séance en écriture dont l'événement d'essai porte trois propositions
// générées et retient la première.
async function avecPropositions(options = {}) {
  const montage = await ouvertSur(chargeEssai(), options);
  await montage.seance.passerEnEcriture();
  await montage.seance.executer('enregistrerGeneration', generer(montage.seance.charge, 3));
  await montage.seance.executer('retenirProposition', { id: 1 });
  return montage;
}

describe("séance observable : la charge publiée partage les propositions figées (§ 8.4, § 13.3)", () => {
  test("après un échange dans le retenu, la charge publiée est neuve, ses propositions les mêmes objets figés que celles de l'état d'avant et de l'Ouvert, et l'examen porte cette charge", async () => {
    const { seance } = await avecPropositions();
    const e1 = seance.etat();
    await seance.executer('echangerDansRetenu', deuxTablesDuRetenu(seance.charge));
    const e2 = seance.etat();
    assert.notEqual(e2.charge, e1.charge);
    assert.notEqual(e2.charge, seance.ouvert.charge);
    assert.equal(Object.isFrozen(seance.ouvert.charge), false);
    assert.equal(Object.isFrozen(seance.ouvert.charge.propositions), false);
    assert.notDeepEqual(e2.charge.retenu, e1.charge.retenu);
    assert.equal(e2.charge.propositions.length, 3);
    e2.charge.propositions.forEach((proposition, i) => {
      assert.equal(proposition, e1.charge.propositions[i], `proposition ${i} recopiée`);
      assert.equal(proposition, seance.charge.propositions[i], `proposition ${i} distincte de celle de l'Ouvert`);
      assert.ok(estFigee(proposition), `proposition ${i} hors du registre`);
    });
    for (const etat of [e1, e2]) {
      assert.equal(etat.examen.charge, etat.charge);
      assert.ok(estFigee(etat) && estFigee(etat.charge) && estFigee(etat.examen), 'état hors du registre');
      compterFiges(etat);
    }
  });

  test("une écriture dans une proposition publiée lève TypeError, et ne change ni l'état ni l'Ouvert", async () => {
    const { seance } = await avecPropositions();
    const etat = seance.etat();
    const [proposition] = etat.charge.propositions;
    const avant = JSON.stringify(seance.ouvert.charge);
    assert.throws(() => {
      proposition.placement[0].sieges[0][0] = 99;
    }, TypeError);
    assert.throws(() => {
      proposition.note = 'Bruyère';
    }, TypeError);
    assert.throws(() => proposition.placement.push({ sieges: [], reserve: [] }), TypeError);
    assert.equal(JSON.stringify(seance.ouvert.charge), avant);
    assert.equal(seance.etat(), etat);
  });

  test("à chaque geste, la charge et l'examen publiés s'écrivent comme la copie entière de l'Ouvert, et comme ceux d'une seconde séance qui rouvre l'événement du disque", async () => {
    const { fs, seance } = await avecPropositions();
    const gestes = [
      () => seance.executer('echangerDansRetenu', deuxTablesDuRetenu(seance.charge)),
      () => seance.executer('exclureParticipant', { id: 4 }),
      () => seance.executer('retenirProposition', { id: 2 }),
      () => seance.defaire(),
      () => seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }),
    ];
    for (const [rang, geste] of [[-1, async () => {}], ...gestes.map((g, i) => [i, g])]) {
      await geste();
      const etat = seance.etat();
      const publie = { charge: etat.charge, examen: etat.examen };
      assert.equal(JSON.stringify(publie), JSON.stringify(copieEntiere(seance.ouvert)), `geste ${rang} : copie entière`);
      assert.deepStrictEqual(publie, copieEntiere(seance.ouvert));
      const autre = monter({ fs, prefixe: 'autre' }).seance;
      await autre.ouvrir(EVT);
      const relu = autre.etat();
      assert.equal(relu.evenement.revision, etat.evenement.revision);
      assert.equal(JSON.stringify({ charge: relu.charge, examen: relu.examen }), JSON.stringify(publie), `geste ${rang} : relu`);
      assert.deepStrictEqual({ charge: relu.charge, examen: relu.examen }, publie);
    }
  });
});

describe('séance : copiePubliee (§ 8.4)', () => {
  test("copiePubliee partage chaque proposition figée à sa place, recopie et fige une proposition libre sans figer l'original, et s'écrit comme la copie entière", async () => {
    const { seance } = await avecPropositions();
    const { charge, examen } = seance.ouvert;
    const [p1, p2] = charge.propositions;
    assert.ok(estFigee(p1) && estFigee(p2));
    const libre = structuredClone(p2);
    const melee = { ...charge, propositions: [p1, libre, p1] };
    const ouvert = { charge: melee, examen: { ...examen, charge: melee } };
    const copie = copiePubliee(ouvert);
    assert.notEqual(copie.charge, melee);
    assert.notEqual(copie.charge.propositions, melee.propositions);
    assert.notEqual(copie.charge.participants, melee.participants);
    assert.equal(copie.charge.propositions[0], p1);
    assert.equal(copie.charge.propositions[2], p1);
    assert.notEqual(copie.charge.propositions[1], libre);
    assert.deepStrictEqual(copie.charge.propositions[1], libre);
    assert.ok(estFigee(copie.charge.propositions[1]));
    assert.equal(Object.isFrozen(libre), false, "l'original libre est figé");
    assert.equal(copie.examen.charge, copie.charge);
    assert.ok(estFigee(copie) && estFigee(copie.charge) && estFigee(copie.examen));
    assert.deepStrictEqual(Object.keys(copie), ['charge', 'examen']);
    assert.equal(JSON.stringify(copie), JSON.stringify(copieEntiere(ouvert)));
    assert.deepStrictEqual(copie, copieEntiere(ouvert));
    assert.equal(copie.charge.propositions.length, 3);
  });

  test("une proposition gelée en surface seulement (Object.freeze) se recopie : le registre décide du partage, non Object.isFrozen", async () => {
    const { seance } = await avecPropositions();
    const { charge, examen } = seance.ouvert;
    const surface = Object.freeze(structuredClone(charge.propositions[0]));
    assert.equal(estFigee(surface), false);
    const melee = { ...charge, propositions: [surface] };
    const copie = copiePubliee({ charge: melee, examen: { ...examen, charge: melee } });
    assert.notEqual(copie.charge.propositions[0], surface);
    assert.deepStrictEqual(copie.charge.propositions[0], surface);
    assert.equal(Object.isFrozen(surface.placement), false, "l'original gelé en surface est figé en place");
  });

  test("copiePubliee recopie à part la charge d'un examen qui n'est pas celle de l'Ouvert, et ne fige rien de ce qu'elle reçoit hors des propositions déjà figées", async () => {
    const { seance } = await avecPropositions();
    const { charge, examen } = seance.ouvert;
    const autre = structuredClone(charge);
    const ouvert = { charge, examen: { ...examen, charge: autre } };
    const copie = copiePubliee(ouvert);
    assert.notEqual(copie.examen.charge, copie.charge);
    assert.notEqual(copie.examen.charge, autre);
    assert.deepStrictEqual(copie.examen.charge, autre);
    assert.equal(JSON.stringify(copie), JSON.stringify(copieEntiere(ouvert)));
    assert.equal(Object.isFrozen(autre), false);
    assert.equal(Object.isFrozen(charge), false);
    assert.equal(Object.isFrozen(charge.participants), false);
    assert.equal(Object.isFrozen(examen), false);
  });
});

describe('séance observable : la racine (§ 8.6)', () => {
  test("une séance créée sans racine n'en a pas ; changerRacine la pose sans rien écrire", async () => {
    const fs = creerFichiersSimules();
    fs.deposerDossier('documents');
    const { seance } = monter({ fs, racine: null });
    assert.equal(seance.etat().racine, null);
    const avant = fs.compteurs.ecritures;
    const recus = [];
    seance.subscribe((etat) => recus.push(etat));
    await seance.changerRacine(DOC);
    assert.deepEqual([seance.etat().racine, recus.at(-1).racine], [DOC, DOC]);
    assert.equal(fs.compteurs.ecritures, avant);
    await seance.creer({ nom: BASE, date: null, siegesParDefaut: 2, tours: 2 });
    assert.equal(seance.etat().evenement.base, BASE);
  });

  test("changerRacine ferme l'événement ouvert en écriture : son verrou quitte le disque, et la séance ouvre désormais là", async () => {
    const fs = creerFichiersSimules({ executable: 'E:\\soirees' });
    fs.deposerDossier('portable');
    const montage = monter({ fs });
    await enEcriture(montage);
    assert.equal(verrouDe(fs).seance, montage.seance.id);
    await montage.seance.changerRacine(PORTABLE);
    assert.equal(verrouDe(fs), null);
    assert.deepEqual([montage.seance.etat().evenement, montage.seance.etat().racine, montage.seance.etat().mode], [null, PORTABLE, 'lecture']);
    await refus(montage.seance.ouvrir(EVT), 'ABSENT');
  });
});

describe('séance observable : la version de format (§ 8.8, § 18.6)', () => {
  test("un fichier d'un format plus récent s'annonce 'plusRecent' ; passer en écriture et un geste sont refusés LECTURE_SEULE FORMAT, remède null, jamais MODE_LECTURE", async () => {
    const fs = creerFichiersSimules();
    deposerAuFormat(fs, FORMAT + 1);
    const { seance } = monter({ fs });
    const avant = fs.compteurs.ecritures;
    await seance.ouvrir(EVT);
    assert.equal(seance.etat().evenement.annonceFormat, 'plusRecent');
    const format = { raison: 'FORMAT', remede: null };
    await refus(seance.passerEnEcriture(), 'LECTURE_SEULE', format);
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } }), 'LECTURE_SEULE', format);
    assert.deepEqual(seance.etat().refus, { code: 'LECTURE_SEULE', details: format });
    assert.equal(fs.compteurs.ecritures, avant);
  });

  test('au format courant, aucune annonce, à l’ouverture, en écriture et après un geste écrit au format FORMAT', async () => {
    const { seance, fs } = await ouvertSur(chargeEssai());
    assert.equal(seance.etat().evenement.annonceFormat, null);
    await seance.passerEnEcriture();
    await seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } });
    assert.equal(etatDe(fs).entete.format, FORMAT);
    assert.equal(seance.etat().evenement.annonceFormat, null);
  });
});

describe('séance observable : bloquer et débloquer (§ 8.5, § 9)', () => {
  test("sur un plan bloqué, passer en écriture, changer l'état et défaire sont refusés BLOQUE, remède debloquer, jamais MODE_LECTURE, sans écriture", async () => {
    const montage = await ouvertSur(chargeBloquee());
    const { fs, seance } = montage;
    const avant = fs.compteurs.ecritures;
    const bloque = { raison: 'BLOQUE', remede: DEBLOQUER };
    await refus(seance.passerEnEcriture(), 'LECTURE_SEULE', bloque);
    await refus(seance.executer('changerEtat', { etat: 'retenu' }), 'LECTURE_SEULE', bloque);
    await refus(seance.defaire(), 'LECTURE_SEULE', bloque);
    assert.deepEqual(seance.etat().refus, { code: 'LECTURE_SEULE', details: bloque });
    assert.equal(fs.compteurs.ecritures, avant);
  });

  test("débloquer prend le verrou, écrit une entrée et un jalon, rend l'état que le contenu impose, et laisse en écriture", async () => {
    const { fs, seance } = await ouvertSur(chargeBloquee());
    const entrees = journalDe(fs).entrees.length;
    await seance.debloquer();
    assert.equal(seance.etat().mode, 'ecriture');
    assert.equal(verrouDe(fs).seance, seance.id);
    const journal = journalDe(fs);
    assert.equal(journal.entrees.length, entrees + 1);
    assert.equal(journal.jalons.at(-1).revision, journal.entrees.at(-1).revision);
    assert.equal(seance.etat().evenement.etat, etatDeduit(seance.charge));
    assert.equal(seance.etat().refus, null);
  });

  test('sur un plan non bloqué ouvert en lecture, un geste est refusé MODE_LECTURE, remède modifier', async () => {
    const { fs, seance } = await ouvertSur();
    const avant = fs.compteurs.ecritures;
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } }), 'MODE_LECTURE', { remede: MODIFIER });
    await refus(seance.nommer('Avant le dessert'), 'MODE_LECTURE', { remede: MODIFIER });
    assert.equal(fs.compteurs.ecritures, avant);
  });

  test('bloquer écrit une entrée et un jalon, revient en lecture, rend le verrou ; une seconde séance du même disque ouvre un plan bloqué', async () => {
    const disque = new Map();
    const premier = monter({ fs: creerFichiersSimules({ disque }), prefixe: 'premiere' });
    await enEcriture(premier);
    const entrees = journalDe(premier.fs).entrees.length;
    await premier.seance.executer('changerEtat', { etat: 'bloque' });
    assert.equal(journalDe(premier.fs).entrees.length, entrees + 1);
    assert.equal(journalDe(premier.fs).jalons.at(-1).nom, 'État « Bloqué »');
    assert.deepEqual([premier.seance.etat().mode, verrouDe(premier.fs)], ['lecture', null]);
    const second = monter({ fs: creerFichiersSimules({ disque }), prefixe: 'seconde' });
    await ouvrirSansEcrire(second);
    assert.equal(second.seance.etat().evenement.etat, 'bloque');
    assert.deepEqual(second.seance.etat().refus, { code: 'LECTURE_SEULE', details: { raison: 'BLOQUE', remede: DEBLOQUER } });
  });
});

describe("séance observable : l'annulation et le retour automatique (§ 8.4)", () => {
  test('surAnnulation est appelé au passage en lecture explicite pendant un geste, au retour automatique et à la fermeture ; désabonné, plus rien', async () => {
    const montage = monter();
    const { seance, planificateur } = montage;
    await enEcriture(montage);
    let appels = 0;
    const desabonner = seance.surAnnulation(() => {
      appels += 1;
    });
    seance.debuterGeste();
    await seance.passerEnLecture();
    assert.equal(appels, 1);
    await seance.passerEnEcriture();
    await planificateur.avancer(INACTIVITE_MS);
    assert.deepEqual([seance.mode, appels], ['lecture', 2]);
    await seance.fermer();
    assert.equal(appels, 3);
    desabonner();
    await seance.ouvrir(EVT);
    await seance.passerEnEcriture();
    await seance.passerEnLecture();
    await seance.fermer();
    assert.equal(appels, 3);
  });

  test("le retour automatique ne tombe jamais pendant un geste ouvert ; il pose RETOUR_AUTOMATIQUE à la suite des avertissements, que le passage en écriture suivant retire", async () => {
    const montage = monter();
    const { seance, planificateur } = montage;
    await enEcriture(montage);
    const ajout = await seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } });
    assert.deepEqual(codesDe(ajout.avertissements), ['PLACES_MANQUANTES']);
    let appels = 0;
    seance.surAnnulation(() => {
      appels += 1;
    });
    seance.debuterGeste();
    await planificateur.avancer(3 * INACTIVITE_MS);
    assert.deepEqual([seance.mode, appels], ['ecriture', 0]);
    assert.ok(!codesDe(seance.etat().avertissements).includes('RETOUR_AUTOMATIQUE'));
    seance.finirGeste();
    await planificateur.avancer(INACTIVITE_MS);
    assert.deepEqual([seance.mode, appels], ['lecture', 1]);
    const retour = { code: 'RETOUR_AUTOMATIQUE', details: {} };
    assert.deepEqual(seance.etat().avertissements, [...seance.ouvert.avertissements, ...ajout.avertissements, retour]);
    await seance.passerEnEcriture();
    assert.deepEqual(codesDe(seance.etat().avertissements), []);
    await seance.passerEnLecture();
    assert.ok(!codesDe(seance.etat().avertissements).includes('RETOUR_AUTOMATIQUE'), 'le retour explicite se tait');
  });
});

describe('séance observable : le cadrage (§ 8.5)', () => {
  const REGLAGES = `{"cadrages":[{"evenement":"evt-lucioles","k":2,"tx":10,"ty":-5}],"format":1,"papier":null}\n`;
  const lireCadrages = (fs) => JSON.parse(fs.contenu('documents', FICHIER_REGLAGES)).cadrages;

  for (const [cas, charge, ecriture] of [
    ['en lecture', chargeEssai, false],
    ['sur un plan bloqué', chargeBloquee, false],
    ['en écriture', chargeEssai, true],
  ]) {
    test(`${cas} : ouvrir relit le cadrage ; vingt demandes en 500 ms font une seule écriture des réglages, ${DELAI_REGLAGES_MS} ms après la première, le dernier cadrage, sans toucher l'état ni le journal`, async () => {
      const fs = creerFichiersSimules();
      await deposerEssai(fs, charge());
      fs.deposer('documents', FICHIER_REGLAGES, REGLAGES);
      const montage = monter({ fs });
      const { seance, planificateur } = montage;
      await seance.ouvrir(EVT);
      if (ecriture) await seance.passerEnEcriture();
      assert.deepEqual(seance.cadrage(), { k: 2, tx: 10, ty: -5 });
      const avant = fs.compteurs.ecritures;
      const revision = seance.etat().evenement.revision;
      const textes = [fs.contenu('documents', ETAT), fs.contenu('documents', JOURNAL)];
      for (let rang = 0; rang < 20; rang += 1) {
        seance.demanderCadrage({ k: 1 + rang / 10, tx: rang, ty: -rang });
        await planificateur.avancer(25);
      }
      assert.deepEqual(seance.cadrage(), { k: 2.9, tx: 19, ty: -19 });
      await planificateur.avancer(DELAI_REGLAGES_MS - 500 - 1);
      await laisser();
      assert.equal(fs.compteurs.ecritures, avant);
      await planificateur.avancer(1);
      await laisser();
      assert.equal(fs.compteurs.ecritures, avant + 1);
      assert.deepEqual(lireCadrages(fs), [{ evenement: 'evt-lucioles', k: 2.9, tx: 19, ty: -19 }]);
      assert.deepEqual([fs.contenu('documents', ETAT), fs.contenu('documents', JOURNAL)], textes);
      assert.equal(seance.etat().evenement.revision, revision);
    });
  }

  test("une vue de k nul ou non fini n'est pas demandée ; une écriture refusée se tait", async () => {
    const { fs, seance, planificateur } = await ouvertSur();
    const avant = fs.compteurs.ecritures;
    for (const vue of [{ k: 0, tx: 0, ty: 0 }, { k: Number.NaN, tx: 0, ty: 0 }, { k: Infinity, tx: 0, ty: 0 }, { k: 1, tx: Number.NaN, ty: 0 }]) {
      seance.demanderCadrage(vue);
    }
    await planificateur.avancer(DELAI_REGLAGES_MS);
    await laisser();
    assert.equal(fs.compteurs.ecritures, avant);
    assert.equal(seance.cadrage(), null);
    fs.pannes.ecriture('documents');
    seance.demanderCadrage({ k: 1.5, tx: 3, ty: 4 });
    await planificateur.avancer(DELAI_REGLAGES_MS);
    await laisser();
    assert.equal(fs.contenu('documents', FICHIER_REGLAGES), null);
    assert.deepEqual(seance.cadrage(), { k: 1.5, tx: 3, ty: 4 });
    await seance.fermer();
  });

  test("fermer écrit aussitôt une demande en attente ; rouvrir la rend ; défaire ne la change pas", async () => {
    const montage = monter();
    const { fs, seance, planificateur } = montage;
    await enEcriture(montage);
    await seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } });
    seance.demanderCadrage({ k: 0.5, tx: -40, ty: 12 });
    await seance.fermer();
    assert.equal(planificateur.actives, 0);
    const { id } = etatDe(fs).charge.evenement;
    assert.deepEqual(lireCadrages(fs), [{ evenement: id, k: 0.5, tx: -40, ty: 12 }]);
    await seance.ouvrir(EVT);
    assert.deepEqual(seance.cadrage(), { k: 0.5, tx: -40, ty: 12 });
    await seance.passerEnEcriture();
    await seance.defaire();
    assert.deepEqual(seance.cadrage(), { k: 0.5, tx: -40, ty: 12 });
    const ailleurs = monter({ fs: creerFichiersSimules({ disque: new Map() }) });
    assert.equal(ailleurs.seance.cadrage(), null, 'sans événement, aucun cadrage');
  });

  test("une lecture des réglages qui lève ne retient pas l'ouverture : cadrage() null", async () => {
    const fs = creerFichiersSimules();
    await deposerEssai(fs);
    const lireTexte = fs.lireTexte;
    fs.lireTexte = async (racine, chemin) => {
      if (chemin === FICHIER_REGLAGES) throw new TypeError('réponse illisible du système');
      return lireTexte(racine, chemin);
    };
    const { seance } = monter({ fs });
    await seance.ouvrir(EVT);
    assert.deepEqual([seance.etat().evenement.base, seance.cadrage()], [BASE, null]);
  });

  test("des réglages que la lecture ne prend pas ne s'écrasent pas : le cadrage attend, le papier et les autres cadrages restent", async () => {
    const AUTRES = `{"cadrages":[{"evenement":"evt-voisin","k":3,"tx":1,"ty":2}],"format":1,"papier":"A4"}\n`;
    const fs = creerFichiersSimules();
    await deposerEssai(fs);
    fs.deposer('documents', FICHIER_REGLAGES, AUTRES);
    let occupe = false;
    const lireTexte = fs.lireTexte;
    fs.lireTexte = async (racine, chemin) => {
      if (occupe && chemin === FICHIER_REGLAGES) throw new ErreurStockage('LECTURE', { chemin, cause: 'EBUSY' });
      return lireTexte(racine, chemin);
    };
    const montage = monter({ fs });
    const { seance, planificateur } = montage;
    await seance.ouvrir(EVT);
    occupe = true;
    seance.demanderCadrage({ k: 1, tx: 0, ty: 0 });
    await planificateur.avancer(DELAI_REGLAGES_MS);
    await laisser();
    assert.equal(fs.contenu('documents', FICHIER_REGLAGES), AUTRES, 'une lecture refusée laisse le fichier');
    assert.deepEqual(seance.cadrage(), { k: 1, tx: 0, ty: 0 });
    occupe = false;
    await seance.fermer();
    const relus = JSON.parse(fs.contenu('documents', FICHIER_REGLAGES));
    assert.equal(relus.papier, 'A4');
    assert.deepEqual(relus.cadrages, [
      { evenement: 'evt-lucioles', k: 1, tx: 0, ty: 0 },
      { evenement: 'evt-voisin', k: 3, tx: 1, ty: 2 },
    ]);
    for (const corrompu of ['pas du json\n', '{"cadrages":[],"format":0,"papier":"A4"}\n']) {
      fs.deposer('documents', FICHIER_REGLAGES, corrompu);
      await seance.ouvrir(EVT);
      seance.demanderCadrage({ k: 2, tx: 5, ty: 5 });
      await planificateur.avancer(DELAI_REGLAGES_MS);
      await laisser();
      await seance.fermer();
      assert.equal(fs.contenu('documents', FICHIER_REGLAGES), corrompu, corrompu);
    }
  });

  test("des réglages corrompus : cadrage() null, et aucun avertissement de la séance ne le dit", async () => {
    const fs = creerFichiersSimules();
    await deposerEssai(fs);
    fs.deposer('documents', FICHIER_REGLAGES, 'pas du json\n');
    const { seance } = monter({ fs });
    await seance.ouvrir(EVT);
    assert.equal(seance.cadrage(), null);
    assert.ok(!codesDe(seance.etat().avertissements).includes('REGLAGES_ILLISIBLES'));
  });
});

describe("séance observable : les avertissements d'un geste (§ 5.9, § 9)", () => {
  // Deux tables de huit et seize convives : la salle est pleine.
  function sallePleine() {
    const charge = creerCharge({ id: 'evt-lucioles', nom: BASE, siegesParDefaut: 8, tours: 2 });
    charge.tables = [1, 2].map((id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 300 * (id - 1), y: 0 } }));
    charge.participants = Array.from({ length: 16 }, (_, rang) => personne(rang + 1, `Convive ${rang + 1}`));
    charge.prochainsIds = { participant: 17, table: 3, proposition: 1 };
    return charge;
  }
  const manqueDe = (charge) => nombrePlacesManquantes(normaliser(configurationDepuisCharge(charge)));

  test("la dix-septième personne avertit PLACES_MANQUANTES {1}, trois de plus {4}, le nombre du moteur ; un geste qui ne fait pas croître le manque n'en dit rien", async () => {
    const { seance } = await ouvertSur(sallePleine());
    await seance.passerEnEcriture();
    const ajout = await seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } });
    assert.deepEqual(ajout.avertissements, [{ code: 'PLACES_MANQUANTES', details: { placesManquantes: 1 } }]);
    assert.equal(manqueDe(seance.charge), 1);
    const apercu = apercevoir('nom\nBruyère\nCerfeuil\nDahlia\n', { participants: seance.charge.participants });
    const import3 = await seance.executer('importerParticipants', { apercu, mode: 'ajouter' });
    assert.deepEqual(import3.avertissements, [{ code: 'PLACES_MANQUANTES', details: { placesManquantes: 4 } }]);
    assert.equal(manqueDe(seance.charge), 4);
    assert.deepEqual(seance.etat().avertissements, [...seance.ouvert.avertissements, ...import3.avertissements]);
    const renomme = await seance.executer('modifierParticipant', { id: 1, champs: { nom: 'Parasol' } });
    assert.deepEqual(renomme.avertissements, []);
    const retire = await seance.executer('supprimerParticipant', { id: 2 });
    assert.deepEqual(retire.avertissements, []);
  });

  test("après la retenue, exclure une personne : DERIVE_NOUVELLE nomme le retenu et PARTICIPANT_EXCLU, sans lever ; le geste suivant passe sans redire cette raison", async () => {
    const { seance } = await ouvertSur();
    await seance.passerEnEcriture();
    await seance.executer('enregistrerGeneration', generer(seance.charge));
    await seance.executer('retenirProposition', { id: 1 });
    const exclusion = await seance.executer('exclureParticipant', { id: 3 });
    const raisons = [{ code: 'PARTICIPANT_EXCLU', participant: 3, personne: 'Théo Pervenche' }];
    // Le retenu la perd dans la même entrée : seules les propositions dérivent.
    assert.deepEqual(exclusion.avertissements, [
      { code: 'RENCONTRES_RETIREES_DU_RETENU', details: { participant: 3, personne: 'Théo Pervenche', tours: [1, 2], remede: null } },
      { code: 'DERIVE_NOUVELLE', details: { touchees: [{ id: 1, raisons }, { id: 2, raisons }] } },
    ]);
    const suivant = await seance.executer('modifierParticipant', { id: 4, champs: { nom: 'Lacasse-Ombrelle' } });
    assert.deepEqual(suivant.avertissements, []);
    const autre = await seance.executer('exclureParticipant', { id: 2 });
    const nouvelle = [{ code: 'PARTICIPANT_EXCLU', participant: 2, personne: 'Grisaille' }];
    assert.deepEqual(autre.avertissements, [
      { code: 'RENCONTRES_RETIREES_DU_RETENU', details: { participant: 2, personne: 'Grisaille', tours: [1, 2], remede: null } },
      { code: 'DERIVE_NOUVELLE', details: { touchees: [{ id: 1, raisons: nouvelle }, { id: 2, raisons: nouvelle }] } },
    ]);
  });

  test("un fichier au retenu fautif : le geste passe, et ni DERIVE_NOUVELLE ni RESERVATION_NON_HONOREE ne vient du retenu", async () => {
    const fs = creerFichiersSimules();
    const charge = avecRetenu(chargeEssai());
    charge.retenu.placement[0].reserve = [2];
    await deposerEssai(fs, reserverGrisaille(charge));
    const montage = monter({ fs });
    await ouvrirSansEcrire(montage);
    const { seance } = montage;
    assert.equal(seance.etat().avertissements[0].code, 'RETENU_FAUTIF');
    await seance.passerEnEcriture();
    const exclusion = await seance.executer('exclureParticipant', { id: 3 });
    assert.deepEqual(exclusion.avertissements, []);
    assert.ok(!codesDe(seance.etat().avertissements).includes('INVARIANT_VIOLE'));
  });
});

describe("séance observable : le verrou d'une autre séance (§ 8.8)", () => {
  test('la seconde séance ouvre en lecture sans refus ; son passage en écriture est refusé VERROU_PRIS, remède null, et verrouAutre porte la séance et depuis', async () => {
    const disque = new Map();
    const premier = monter({ fs: creerFichiersSimules({ disque }), prefixe: 'premiere' });
    await enEcriture(premier);
    const { depuis } = verrouDe(premier.fs);
    const second = monter({ fs: creerFichiersSimules({ disque }), prefixe: 'seconde' });
    await ouvrirSansEcrire(second);
    assert.equal(second.seance.etat().verrouAutre, null);
    await refus(second.seance.passerEnEcriture(), 'VERROU_PRIS', { seance: 'premiere-1', depuis, vivant: true, remede: null });
    assert.deepEqual(second.seance.etat().verrouAutre, { seance: 'premiere-1', depuis, vivant: true });
    assert.equal(verrouDe(second.fs).seance, 'premiere-1');
  });

  test("le verrou d'une séance morte se reprend seul, et VERROU_REPRIS le dit", async () => {
    const disque = new Map();
    const premier = monter({ fs: creerFichiersSimules({ disque }), prefixe: 'premiere' });
    await enEcriture(premier);
    const { depuis } = verrouDe(premier.fs);
    premier.fs.pannes.couperApres(0);
    const second = monter({ fs: creerFichiersSimules({ disque }), prefixe: 'seconde' });
    await ouvrirSansEcrire(second);
    const repris = [{ code: 'VERROU_REPRIS', details: { seance: 'premiere-1', depuis } }];
    assert.deepEqual(await second.seance.passerEnEcriture(), { avertissements: repris });
    assert.deepEqual(second.seance.etat().avertissements, repris);
  });

  test("le verrou d'une instance d'un autre hôte (vivant null) n'est jamais repris : VERROU_PRIS, remède null, le fichier inchangé, et aucun geste ne le reprend seul : seul reprendreVerrou, que l'opérateur confirme, le reprend", async () => {
    const disque = new Map();
    const premier = monter({ fs: creerFichiersSimules({ disque }), prefixe: 'premiere' });
    await enEcriture(premier);
    const { depuis } = verrouDe(premier.fs);
    const texte = premier.fs.contenu('documents', VERROU);
    const lointain = monter({ fs: creerFichiersSimules({ disque, hote: 'autre-poste' }), prefixe: 'lointaine' });
    await ouvrirSansEcrire(lointain);
    const { seance } = lointain;
    const pris = { seance: 'premiere-1', depuis, vivant: null, remede: null };
    await refus(seance.passerEnEcriture(), 'VERROU_PRIS', pris);
    await refus(seance.passerEnEcriture(), 'VERROU_PRIS', pris);
    assert.equal(premier.fs.contenu('documents', VERROU), texte);
    assert.deepEqual(seance.etat().verrouAutre, { seance: 'premiere-1', depuis, vivant: null });
    assert.equal(seance.etat().mode, 'lecture');
  });

  test("un verrou illisible n'est jamais repris : VERROU_PRIS, remède null, le fichier inchangé", async () => {
    const fs = creerFichiersSimules();
    await deposerEssai(fs);
    fs.deposer('documents', VERROU, 'pas un verrou\n');
    const montage = monter({ fs });
    await ouvrirSansEcrire(montage);
    const illisible = { seance: null, depuis: null, vivant: null, remede: null };
    await refus(montage.seance.passerEnEcriture(), 'VERROU_PRIS', illisible);
    assert.equal(fs.contenu('documents', VERROU), 'pas un verrou\n');
  });

  test("sur un plan bloqué, débloquer devant le verrou d'un autre hôte est refusé VERROU_PRIS, remède null, sans entrée, le verrou inchangé", async () => {
    const fs = creerFichiersSimules();
    await deposerEssai(fs, chargeBloquee());
    const depuis = '2031-05-17T09:00:00-04:00';
    const texte = `${JSON.stringify({ seance: 'lointaine-1', pid: 99, hote: 'autre-poste', depuis })}\n`;
    fs.deposer('documents', VERROU, texte);
    const montage = monter({ fs });
    await ouvrirSansEcrire(montage);
    const { seance } = montage;
    const entrees = journalDe(fs).entrees.length;
    await refus(seance.debloquer(), 'VERROU_PRIS', { seance: 'lointaine-1', depuis, vivant: null, remede: null });
    assert.equal(journalDe(fs).entrees.length, entrees);
    assert.deepEqual([seance.etat().mode, seance.etat().evenement.etat], ['lecture', 'bloque']);
    assert.equal(fs.contenu('documents', VERROU), texte);
  });
});

describe('séance observable : le support rompu (§ 8.6, § 8.2)', () => {
  // Un événement du disque portable, en écriture, après un premier geste.
  async function surPortable() {
    const fs = creerFichiersSimules({ executable: 'E:\\soirees' });
    const montage = monter({ fs, racine: PORTABLE });
    await enEcriture(montage);
    await montage.seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } });
    return montage;
  }
  const rompu = { echec: 'ECRITURE', chemin: NOM.JOURNAL, dossier: dossierDe(PORTABLE.chemin), cause: 'EROFS' };
  const versDocuments = { geste: 'ecrireAilleurs', racine: DOC };

  test("une écriture refusée remonte ECRITURE ; supportRompu en garde les champs et la racine documents ; le refus courant et le geste suivant sont SUPPORT_ROMPU, remède écrire ailleurs ; écrire ailleurs rétablit", async () => {
    const { fs, seance } = await surPortable();
    fs.pannes.ecriture('portable');
    const erreur = await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'ECRITURE');
    assert.deepEqual(erreur.details, { chemin: NOM.JOURNAL, dossier: dossierDe(PORTABLE.chemin), cause: 'EROFS' });
    assert.deepEqual(seance.etat().supportRompu, { ...rompu, ailleurs: DOC });
    const attendu = { code: 'SUPPORT_ROMPU', details: { ...rompu, remede: versDocuments } };
    assert.deepEqual(seance.etat().refus, attendu);
    const avant = fs.compteurs.ecritures;
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'SUPPORT_ROMPU', attendu.details);
    assert.equal(fs.compteurs.ecritures, avant);
    await seance.ecrireAilleurs(DOC);
    assert.deepEqual([seance.etat().supportRompu, seance.etat().racine, seance.etat().refus], [null, DOC, null]);
    assert.deepEqual(libellesDe(journalDe(fs)), [CREATION, 'Ajouté Ancolie']);
    assert.deepEqual(noms(etatDe(fs).charge), ['Ancolie']);
  });

  test("un état qui ne s'écrit pas : ETAT_NON_ECRIT, le geste au journal, l'état du disque intact ; écrire ailleurs écrit là-bas l'état de ce geste", async () => {
    const { fs, seance } = await surPortable();
    fs.pannes.renommage('portable');
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'ETAT_NON_ECRIT');
    assert.equal(seance.etat().supportRompu.echec, 'ETAT_NON_ECRIT');
    assert.deepEqual(libellesDe(journalDe(fs, 'portable')), [CREATION, 'Ajouté Ancolie', 'Ajouté Bruyère']);
    assert.deepEqual(noms(etatDe(fs, 'portable').charge), ['Ancolie']);
    await seance.ecrireAilleurs(DOC);
    assert.deepEqual(noms(etatDe(fs).charge), ['Ancolie', 'Bruyère']);
  });

  test('sous un support rompu, ouvrir, créer, fermer et changerRacine sont refusés SUPPORT_ROMPU_NON_SAUVE, remède écrire ailleurs, sans écriture ; fermer({abandonner: true}) ferme', async () => {
    const { fs, seance } = await surPortable();
    fs.pannes.ecriture('portable');
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'ECRITURE');
    const nonSauve = { ...rompu, remede: versDocuments };
    const avant = fs.compteurs.ecritures;
    await refus(seance.ouvrir(EVT), 'SUPPORT_ROMPU_NON_SAUVE', nonSauve);
    await refus(seance.creer({ nom: 'Soirée des Grillons', date: null, siegesParDefaut: 2, tours: 2 }), 'SUPPORT_ROMPU_NON_SAUVE', nonSauve);
    await refus(seance.fermer(), 'SUPPORT_ROMPU_NON_SAUVE', nonSauve);
    await refus(seance.changerRacine(DOC), 'SUPPORT_ROMPU_NON_SAUVE', nonSauve);
    assert.equal(fs.compteurs.ecritures, avant);
    assert.deepEqual(seance.etat().racine, PORTABLE);
    await seance.fermer({ abandonner: true });
    assert.deepEqual([seance.etat().evenement, seance.etat().supportRompu], [null, null]);
  });

  test("écrire ailleurs sans racine demande le dossier par fs.choisirDossier : son annulation ne change rien, son choix y écrit", async () => {
    const { fs, seance } = await surPortable();
    fs.pannes.ecriture('portable');
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'ECRITURE');
    let appels = 0;
    fs.choisirDossier = async () => {
      appels += 1;
      return null;
    };
    const avant = fs.compteurs.ecritures;
    assert.equal(await seance.ecrireAilleurs(null), null);
    assert.equal(appels, 1);
    assert.equal(fs.compteurs.ecritures, avant);
    assert.deepEqual([seance.etat().supportRompu, seance.etat().racine], [{ ...rompu, ailleurs: DOC }, PORTABLE]);
    fs.deposerDossier('documents');
    fs.choisirDossier = async () => DOC;
    const { base } = await seance.ecrireAilleurs(null);
    assert.equal(base, BASE);
    assert.deepEqual([seance.etat().supportRompu, seance.etat().racine], [null, DOC]);
  });

  test("un système qui ne dit pas ses racines : aucun ailleurs n'est proposé", async () => {
    const { fs, seance } = await surPortable();
    fs.pannes.ecriture('portable');
    fs.racines = async () => {
      throw new TypeError('réponse illisible du système');
    };
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'ECRITURE');
    assert.deepEqual(seance.etat().supportRompu, { ...rompu, ailleurs: null });
  });

  test("le support rompu de la racine documents n'a pas d'ailleurs : le remède laisse l'opérateur désigner le dossier", async () => {
    const montage = monter();
    const { fs, seance } = montage;
    await enEcriture(montage);
    fs.pannes.ecriture('documents');
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'ECRITURE');
    assert.equal(seance.etat().supportRompu.ailleurs, null);
    assert.deepEqual(seance.etat().refus.details.remede, { geste: 'ecrireAilleurs', racine: null });
  });
});

describe('séance observable : le refus courant (§ 2.1, garantie 3)', () => {
  test("null sans événement et en écriture ; sinon, en profondeur, le code et les détails qu'executer lève, remède compris", async () => {
    assert.equal(monter().seance.etat().refus, null);
    const enEcritureMontage = await ouvertSur();
    await enEcritureMontage.seance.passerEnEcriture();
    assert.equal(enEcritureMontage.seance.etat().refus, null);

    const lecture = await ouvertSur();
    const bloque = await ouvertSur(chargeBloquee());
    const fsFormat = creerFichiersSimules();
    deposerAuFormat(fsFormat, FORMAT + 1);
    const format = monter({ fs: fsFormat });
    await format.seance.ouvrir(EVT);
    const portable = monter({ fs: creerFichiersSimules({ executable: 'E:\\soirees' }), racine: PORTABLE });
    await enEcriture(portable);
    portable.fs.pannes.ecriture('portable');
    await refus(portable.seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'ECRITURE');

    const cas = [
      [lecture, 'MODE_LECTURE', { remede: MODIFIER }],
      [bloque, 'LECTURE_SEULE', { raison: 'BLOQUE', remede: DEBLOQUER }],
      [format, 'LECTURE_SEULE', { raison: 'FORMAT', remede: null }],
      [portable, 'SUPPORT_ROMPU', { ...{ echec: 'ECRITURE', chemin: NOM.JOURNAL, dossier: dossierDe(PORTABLE.chemin), cause: 'EROFS' }, remede: { geste: 'ecrireAilleurs', racine: DOC } }],
    ];
    assert.equal(cas.length, 4);
    for (const [{ seance }, code, details] of cas) {
      assert.deepEqual(seance.etat().refus, { code, details }, code);
      const erreur = await refus(seance.executer('changerEtat', { etat: 'brouillon' }), code);
      assert.deepEqual(seance.etat().refus, { code: erreur.code, details: erreur.details }, code);
    }
  });

  test("les autres refus de la séance portent un remède null", async () => {
    await refus(monter().seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } }), 'AUCUN_EVENEMENT', { remede: null });
    const montage = monter();
    await enEcriture(montage);
    await refus(montage.seance.defaire(), 'RIEN_A_DEFAIRE', { remede: null });
    await refus(montage.seance.refaire(), 'RIEN_A_REFAIRE', { remede: null });
    await refus(montage.seance.nommer(' '), 'NOM_REQUIS', { remede: null });
    await refus(montage.seance.revenir(99), 'INSTANT_NON_RESTITUABLE', { revision: 99, remede: null });
    await refus(montage.seance.ecrireAilleurs(DOC), 'SUPPORT_INTACT', { remede: null });
  });
});

describe('séance observable : fautives et examen (§ 8.9)', () => {
  test("les propositions que l'ouverture écarte restent dans fautives après un geste, et partent à la fermeture ; l'examen d'après un geste n'en porte aucune", async () => {
    const charge = chargeEssai();
    charge.prochainsIds.proposition = 2;
    charge.propositions = [
      {
        id: 1,
        graine: 7,
        arret: 40,
        historique: 1,
        produitVersion: V1,
        siegesAttribues: false,
        tables: [1, 2],
        capacites: [2, 2],
        tours: 2,
        participants: [1, 2, 3, 4],
        placement: [
          { sieges: [[1, 2, 3], [4]], reserve: [] },
          { sieges: [[1, 3], [2, 4]], reserve: [] },
        ],
      },
    ];
    const { seance } = await ouvertSur(charge);
    const { fautives } = seance.etat();
    assert.deepEqual(fautives.map(({ rang, id }) => [rang, id]), [[0, 1]]);
    assert.equal(fautives[0].fautes[0].code, 'LONGUEUR');
    assert.deepEqual(seance.etat().examen.fautives, fautives);
    await seance.passerEnEcriture();
    await seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } });
    assert.deepEqual(seance.etat().fautives, fautives);
    assert.deepEqual(seance.etat().examen.fautives, []);
    await seance.fermer();
    assert.deepEqual(seance.etat().fautives, []);
  });
});

describe('séance : attendre la file (§ 5.10, § 8.4)', () => {
  test("attendre se résout quand les appels déjà en file ont fini, réussis ou refusés, sans rien écrire ni publier de plus", async () => {
    const { seance, fs } = await ouvertSur();
    await seance.passerEnEcriture();
    const ecrit = seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } });
    const refuse = seance.executer('ajouterParticipant', { champs: { nom: '' } }).catch((erreur) => erreur);
    const avant = seance.charge.participants.length;
    const ecritures = fs.compteurs.ecritures;
    let publications = 0;
    seance.subscribe(() => {
      publications += 1;
    });
    publications = 0;
    await seance.attendre();
    assert.equal(seance.charge.participants.length, avant + 1);
    assert.equal((await refuse).code !== undefined, true);
    await ecrit;
    const apres = publications;
    const ecrituresApres = fs.compteurs.ecritures;
    await seance.attendre();
    assert.equal(publications, apres, 'attendre ne publie rien');
    assert.equal(fs.compteurs.ecritures, ecrituresApres, 'attendre n’écrit rien');
    assert.ok(ecrituresApres > ecritures);
  });
});

describe('séance observable : la dérive nommée (§ 9)', () => {
  test("l'examen de l'état nomme chaque raison de dérive — la personne par son nom, la table par son numéro —, quand celui de l'Ouvert garde les identifiants", async () => {
    const charge = avecRetenu(chargeEssai());
    charge.participants[2].exclu = true;
    charge.tables[1].numero = 7;
    charge.tables[1].sieges = 3;
    const { seance } = await ouvertSur(charge);
    const { raisons } = seance.etat().examen.retenu;
    assert.deepEqual(raisons, [
      { code: 'CAPACITE_CHANGEE', table: 2, avant: 2, maintenant: 3, numero: 7 },
      { code: 'PARTICIPANT_EXCLU', participant: 3, personne: 'Théo Pervenche' },
    ]);
    assert.deepEqual(
      seance.ouvert.examen.retenu.raisons,
      raisons.map(({ personne, numero, ...nue }) => nue),
    );
  });
});

describe('séance observable : les invariants du retenu (§ 14.12, § 14.15)', () => {
  test("un retenu qui laisse une réservation d'un tour non honorée s'ouvre avec INVARIANT_VIOLE, sans les violations que la dérive nomme, sans écriture ; de même après défaire, refaire et revenir", async () => {
    const fs = creerFichiersSimules();
    const charge = reserverGrisaille(avecRetenu(chargeEssai()));
    charge.participants[3].exclu = true;
    await deposerEssai(fs, charge);
    const montage = monter({ fs });
    await ouvrirSansEcrire(montage);
    const { seance } = montage;
    const viole = {
      code: 'INVARIANT_VIOLE',
      details: { proposition: 1, violations: [{ code: 'RESERVATION', participant: 2, table: 2, tour: 1 }] },
    };
    assert.deepEqual(seance.etat().avertissements, [...seance.ouvert.avertissements, viole]);
    assert.deepEqual(codesDe(seance.ouvert.avertissements), ['DERIVE']);
    await seance.passerEnEcriture();
    const renomme = await seance.executer('modifierParticipant', { id: 3, champs: { nom: 'Pervenche-Ombrelle' } });
    assert.deepEqual(seance.etat().avertissements, [...seance.ouvert.avertissements, viole, ...renomme.avertissements]);
    for (const retour of [() => seance.defaire(), () => seance.refaire(), () => seance.revenir(1)]) {
      await retour();
      assert.ok(seance.etat().avertissements.some((a) => a.code === 'INVARIANT_VIOLE'), String(retour));
      assert.deepEqual(seance.etat().avertissements.find((a) => a.code === 'INVARIANT_VIOLE'), viole);
    }
    const exclusion = await seance.executer('exclureParticipant', { id: 1 });
    // Le retenu la perd dans la même entrée : il ne gagne aucune raison de dérive.
    assert.deepEqual(codesDe(exclusion.avertissements), ['RESERVATIONS_SUSPENDUES', 'RENCONTRES_RETIREES_DU_RETENU']);
    assert.deepEqual(seance.etat().avertissements, [...seance.ouvert.avertissements, viole, ...exclusion.avertissements]);
  });

  test("un retenu aux surnuméraires versés en réserve s'ouvre sans INVARIANT_VIOLE", async () => {
    const charge = avecRetenu(chargeEssai());
    charge.participants.push(personne(5, 'Ancolie'));
    charge.prochainsIds.participant = 6;
    charge.retenu.participants = [1, 2, 3, 4, 5];
    for (const tour of charge.retenu.placement) tour.reserve = [5];
    const { seance } = await ouvertSur(charge);
    assert.deepEqual(codesDe(seance.etat().avertissements), []);
  });
});

// Les textes des codes que la séance ajoute se composent, sans trace de
// valeur absente, sous les détails d'exemple de la table que
// libelles.test.js partage pour chaque code ; les épreuves qui suivent
// lisent ce que chaque texte nomme.
describe("séance observable : les textes des codes qu'elle ajoute (§ 14.6)", () => {
  test('le manque dit son nombre ; la surréservation nomme la table, le tour, les réservées et la capacité', () => {
    assert.match(libelle('PLACES_MANQUANTES', { placesManquantes: 1 }), /\b1 place\b/);
    assert.match(libelle('PLACES_MANQUANTES', { placesManquantes: 4 }), /\b4 places\b/);
    const texte = libelle('SURRESERVATION', { table: 3, tour: 2, reservees: 9, capacite: 8 });
    for (const motif of [/identifiant 3\b/, /tour 2\b/, /\b9 personnes\b/, /\b8 places\b/]) assert.match(texte, motif);
  });

  test("la dérive nouvelle nomme le placement et sa raison ; l'invariant nomme la réservation ; la reprise d'un verrou la dit d'une autre séance, d'un poste ou d'un autre", () => {
    const derive = libelle('DERIVE_NOUVELLE', {
      touchees: [
        { id: 2, raisons: [{ code: 'PARTICIPANT_EXCLU', participant: 3 }] },
        { id: 'retenu', raisons: [{ code: 'TABLE_AJOUTEE', table: 5 }] },
      ],
    });
    assert.ok(derive.includes(libelle('PARTICIPANT_EXCLU', { participant: 3 })), derive);
    assert.match(derive, /n° 2/);
    assert.match(derive, /retenu/);
    const viole = libelle('INVARIANT_VIOLE', {
      proposition: 3,
      violations: [
        { code: 'RESERVATION', participant: 2, table: 2, tour: 1 },
        { code: 'DOUBLE_PLACE', participant: 4, tour: 2 },
      ],
    });
    assert.ok(viole.includes(libelle('RESERVATION_NON_HONOREE', { participant: 2, table: 2, tour: 1 })), viole);
    assert.match(viole, /n° 3/);
    for (const details of [{ seance: 's', depuis: null }, { seance: null, depuis: null }]) {
      const repris = libelle('VERROU_REPRIS', details);
      assert.match(repris, /une autre séance/);
      assert.doesNotMatch(repris, /interrompue|ce poste/);
    }
    assert.match(libelle('CONFIGURATION_INCOHERENTE', { code: 'CODE_INVENTE', details: {} }), /« CODE_INVENTE »/);
  });

  test("effacer ou garder les meilleures sans rien à effacer dit qu'aucune proposition n'est à effacer ; un autre geste sans effet garde le texte commun", async () => {
    const { seance } = await ouvertSur();
    await seance.passerEnEcriture();
    await seance.executer('enregistrerGeneration', generer(seance.charge));
    const aucune = "Aucune proposition n'est à effacer : rien n'est enregistré.";
    const garder = await refus(seance.executer('garderMeilleures', { n: 5 }), 'SANS_EFFET', { commande: 'garderMeilleures', remede: null });
    assert.equal(libelle(garder.code, garder.details), aucune);
    await seance.executer('effacerPropositions', {});
    const effacer = await refus(seance.executer('effacerPropositions', {}), 'SANS_EFFET', { commande: 'effacerPropositions', remede: null });
    assert.equal(libelle(effacer.code, effacer.details), aucune);
    const autre = await refus(seance.executer('modifierParticipant', { id: 1, champs: { nom: 'Ombrelle' } }), 'SANS_EFFET');
    assert.equal(libelle(autre.code, autre.details), "Ce geste ne change rien : rien n'est enregistré.");
  });
});

describe('séance : le placement daté (§ 8.9, § 11.8, Q2)', () => {
  // L'horodatage de la dernière entrée du journal sur le disque.
  const derniereDate = (fs) => journalDe(fs).entrees.at(-1).horodatage;

  test("chaque geste date le placement de l'instant de son entrée, une lecture d'horloge ; corriger un nom ne date rien ; défaire restitue l'ancien", async () => {
    const { fs, seance } = await ouvertSur();
    await seance.passerEnEcriture();
    await seance.executer('enregistrerGeneration', generer(seance.charge));
    const generation = derniereDate(fs);
    assert.deepEqual(seance.charge.propositions.map((p) => p.horodatage), [generation, generation]);
    await seance.executer('retenirProposition', { id: 1 });
    const premier = derniereDate(fs);
    assert.notEqual(premier, generation);
    assert.equal(seance.charge.retenu.horodatage, premier);
    assert.equal(etatDe(fs).charge.retenu.horodatage, premier);
    await seance.executer('modifierParticipant', { id: 3, champs: { nom: 'Pervenche-Lacasse' } });
    assert.equal(seance.charge.retenu.horodatage, premier);
    await seance.executer('retenirProposition', { id: 2 });
    const second = derniereDate(fs);
    assert.notEqual(second, premier);
    assert.deepEqual([seance.charge.retenu.proposition, seance.charge.retenu.horodatage], [2, second]);
    assert.deepEqual(seance.charge.propositions.map((p) => p.horodatage), [generation, generation]);
    await seance.defaire();
    assert.deepEqual([seance.charge.retenu.proposition, seance.charge.retenu.horodatage], [1, premier]);
    assert.equal(etatDe(fs).charge.retenu.horodatage, premier);
  });

  test('débloquer, depuis la lecture, garde le placement daté de son instant', async () => {
    const charge = avecRetenu(chargeEssai());
    charge.retenu.horodatage = '2031-05-17T07:30:00-04:00';
    charge.evenement.etat = 'bloque';
    const { seance } = await ouvertSur(charge);
    await seance.debloquer();
    assert.deepEqual([seance.charge.evenement.etat, seance.charge.retenu.horodatage], ['retenu', '2031-05-17T07:30:00-04:00']);
  });
});

describe('séance : le papier de la machine (§ 8.5, § 11.2, Q1)', () => {
  const papierLu = (fs) => JSON.parse(fs.contenu('documents', FICHIER_REGLAGES)).papier;
  // Le texte de l'état et du journal sur le disque, null pour un absent.
  const evenementSurDisque = (fs) => [fs.contenu('documents', ETAT), fs.contenu('documents', JOURNAL)];

  test("null au départ ; choisirPapier écrit les seuls réglages, et une séance neuve sur la même racine le lit, jamais redemandé", async () => {
    const { fs, seance } = await ouvertSur();
    assert.equal(seance.etat().papier, null);
    const avant = fs.compteurs.ecritures;
    const textes = evenementSurDisque(fs);
    await seance.choisirPapier('Lettre');
    assert.equal(fs.compteurs.ecritures, avant + 1);
    assert.deepEqual(evenementSurDisque(fs), textes);
    assert.equal(papierLu(fs), 'Lettre');
    assert.equal(seance.etat().papier, 'Lettre');
    const neuve = monter({ fs, racine: null, prefixe: 'neuve' });
    assert.equal(neuve.seance.etat().papier, null, 'sans racine');
    await neuve.seance.changerRacine(DOC);
    assert.equal(neuve.seance.etat().papier, 'Lettre');
    const surRacine = monter({ fs, prefixe: 'sur-racine' });
    await surRacine.seance.attendre();
    assert.equal(surRacine.seance.etat().papier, 'Lettre');
  });

  test("vivant en lecture, en écriture, sur un plan bloqué et sans événement ; jamais l'état ni le journal", async () => {
    const bloque = chargeEssai();
    bloque.evenement.etat = 'bloque';
    const cas = [
      ['lecture', async () => ouvertSur()],
      ['écriture', async () => {
        const montage = await ouvertSur();
        await montage.seance.passerEnEcriture();
        return montage;
      }],
      ['bloqué', async () => ouvertSur(bloque)],
      ['sans événement', async () => monter()],
    ];
    assert.equal(cas.length, 4);
    for (const [libelleCas, monterCas] of cas) {
      const { fs, seance } = await monterCas();
      const textes = evenementSurDisque(fs);
      const avant = fs.compteurs.ecritures;
      for (const [rang, papier] of ['A4', 'Lettre'].entries()) {
        await seance.choisirPapier(papier);
        assert.equal(fs.compteurs.ecritures, avant + rang + 1, libelleCas);
        assert.deepEqual([papierLu(fs), seance.etat().papier], [papier, papier], libelleCas);
      }
      assert.deepEqual(evenementSurDisque(fs), textes, libelleCas);
    }
  });

  test('un papier hors du domaine est une faute du code, et rien ne s’écrit', async () => {
    const { fs, seance } = await ouvertSur();
    const avant = fs.compteurs.ecritures;
    for (const faux of ['A3', 'a4', 'lettre', null, undefined, 4]) {
      await assert.rejects(seance.choisirPapier(faux), TypeError, String(faux));
    }
    assert.equal(fs.compteurs.ecritures, avant);
    assert.equal(seance.etat().papier, null);
  });

  // Des réglages que la lecture ne prend pas : un format plus récent qui
  // porte un papier inconnu de cette construction, et un texte tronqué.
  const ILLISIBLES = [
    ['FORME', '{"format":2,"papier":"Legal","cadrages":[]}'],
    ['JSON', '{"format":1,"papier":"A4","cadr'],
  ];
  // Une soirée retenue de deux personnes à une table, un tour : une planche
  // se prépare dès que le papier est connu.
  const PLAN_RETENU = [{ sieges: [[1, 2]] }];
  const chargeRetenue = () =>
    soiree({
      personnes: [personneBadge(1, 'Iris', 'Ombrelle'), personneBadge(2, 'Théo', 'Pervenche')],
      tables: [tableBadge(1, 1, 2)],
      plan: PLAN_RETENU,
      propositions: [[1, PLAN_RETENU]],
    });
  const avecPlanche = { polices: async () => lirePolices(), provenance: 'production' };

  test('des réglages illisibles : le papier choisi vaut pour la séance, en mémoire, le fichier intact octet pour octet, et la planche le prend', async () => {
    for (const [raison, texte] of ILLISIBLES) {
      const fs = creerFichiersSimules();
      fs.deposerDossier('documents');
      fs.deposer('documents', FICHIER_REGLAGES, texte);
      const { seance } = await ouvertSur(chargeRetenue(), { fs, ...avecPlanche });
      // L'A6, seul modèle qui lise le papier de la machine.
      await seance.choisirModeleBadge('a6');
      const avant = fs.compteurs.ecritures;
      const textes = evenementSurDisque(fs);
      const avis = { code: 'REGLAGES_ILLISIBLES', details: { chemin: FICHIER_REGLAGES, raison } };
      assert.deepEqual(await seance.choisirPapier('A4'), { avertissements: [avis] }, raison);
      assert.equal(seance.etat().papier, 'A4', raison);
      assert.deepEqual(seance.etat().avertissements.filter(({ code }) => code === avis.code), [avis], raison);
      const annonce = await seance.preparerPlanche();
      assert.deepEqual([annonce.refus, annonce.papier], [null, 'A4'], raison);
      await seance.choisirPapier('Lettre');
      assert.equal(seance.etat().papier, 'Lettre', raison);
      assert.equal((await seance.preparerPlanche()).papier, 'Lettre', raison);
      assert.deepEqual(seance.etat().avertissements.filter(({ code }) => code === avis.code), [avis], `${raison} : un avis, pas deux`);
      assert.deepEqual(fs.octets('documents', FICHIER_REGLAGES), new TextEncoder().encode(texte), raison);
      assert.equal(fs.compteurs.ecritures, avant, raison);
      assert.deepEqual(evenementSurDisque(fs), textes, raison);
    }
  });

  test('des réglages illisibles : la planche se produit sur le papier de la séance, et seul le PDF s’écrit', async () => {
    const [, texte] = ILLISIBLES[1];
    const fs = creerFichiersSimules();
    fs.deposerDossier('documents');
    fs.deposer('documents', FICHIER_REGLAGES, texte);
    const { seance } = await ouvertSur(chargeRetenue(), { fs, ...avecPlanche });
    await seance.choisirModeleBadge('a6');
    assert.deepEqual(await seance.preparerPlanche().then(({ refus: rejet, papier }) => [rejet, papier]), [null, 'Lettre']);
    await seance.choisirPapier('A4');
    const textes = evenementSurDisque(fs);
    const { nom } = await seance.produirePlanche();
    assert.match(nom, /_A4_/);
    // La planche se dépose dans le dossier de l'événement, jamais à la racine.
    assert.ok(fs.octets('documents', `${BASE}/${nom}`).length > 0);
    assert.equal(fs.octets('documents', nom), null);
    assert.equal(fs.contenu('documents', FICHIER_REGLAGES), texte);
    assert.deepEqual(evenementSurDisque(fs), textes);
  });

  test("le papier de la séance n'est pas retenu sur la machine : une séance neuve sur la même racine le demande, et un changement de racine le garde", async () => {
    const [, texte] = ILLISIBLES[0];
    const fs = creerFichiersSimules({ executable: 'E:\\soirees' });
    fs.deposerDossier('documents');
    fs.deposer('documents', FICHIER_REGLAGES, texte);
    const { seance } = await ouvertSur(chargeEssai(), { fs });
    await seance.choisirPapier('A4');
    const neuve = monter({ fs, prefixe: 'neuve' });
    await neuve.seance.attendre();
    assert.equal(neuve.seance.etat().papier, null);
    await seance.changerRacine(DOC);
    assert.equal(seance.etat().papier, 'A4', 'relu sur la même racine illisible');
    fs.deposerDossier(PORTABLE.id);
    await seance.changerRacine(PORTABLE);
    assert.equal(seance.etat().papier, 'A4', 'une racine sans réglages : le choix de la séance');
    fs.deposer(PORTABLE.id, FICHIER_REGLAGES, '{"cadrages":[],"format":1,"papier":"Lettre"}\n');
    await seance.changerRacine(DOC);
    await seance.changerRacine(PORTABLE);
    assert.equal(seance.etat().papier, 'Lettre', 'un papier écrit sur la racine l’emporte');
    assert.equal(fs.contenu('documents', FICHIER_REGLAGES), texte);
  });

  test('des réglages illisibles : le cadrage différé attend, rien ne s’écrit, et le choix du papier ne le change pas', async () => {
    const [, texte] = ILLISIBLES[1];
    const fs = creerFichiersSimules();
    fs.deposerDossier('documents');
    fs.deposer('documents', FICHIER_REGLAGES, texte);
    const { seance, planificateur } = await ouvertSur(chargeEssai(), { fs });
    seance.demanderCadrage({ k: 1.5, tx: 3, ty: 4 });
    await planificateur.avancer(DELAI_REGLAGES_MS);
    await seance.choisirPapier('Lettre');
    await laisser();
    assert.equal(fs.contenu('documents', FICHIER_REGLAGES), texte);
    assert.equal(seance.etat().papier, 'Lettre');
  });

  test('un cadrage écrit après des réglages illisibles réparés écrit avec lui le papier de la séance, qui devient retenu, et l’avis se retire', async () => {
    const [, texte] = ILLISIBLES[1];
    const fs = creerFichiersSimules();
    fs.deposerDossier('documents');
    fs.deposer('documents', FICHIER_REGLAGES, texte);
    const { seance, planificateur } = await ouvertSur(chargeEssai(), { fs });
    await seance.choisirPapier('A4');
    fs.deposer('documents', FICHIER_REGLAGES, '{"cadrages":[],"format":1,"papier":"Lettre"}\n');
    seance.demanderCadrage({ k: 2, tx: 0, ty: 0 });
    await planificateur.avancer(DELAI_REGLAGES_MS);
    await laisser();
    const relus = JSON.parse(fs.contenu('documents', FICHIER_REGLAGES));
    assert.deepEqual([relus.papier, relus.cadrages.length], ['A4', 1]);
    assert.equal(seance.etat().papier, 'A4');
    assert.equal(seance.etat().avertissements.some(({ code }) => code === 'REGLAGES_ILLISIBLES'), false);
    const neuve = monter({ fs, prefixe: 'neuve' });
    await neuve.seance.attendre();
    assert.equal(neuve.seance.etat().papier, 'A4', 'retenu sur la machine');
  });

  test('un papier écrit après des réglages illisibles réparés : le fichier le porte, la séance suit le fichier, et le papier de la séance s’efface', async () => {
    const [, texte] = ILLISIBLES[1];
    const fs = creerFichiersSimules({ executable: 'E:\\soirees' });
    fs.deposerDossier('documents');
    fs.deposer('documents', FICHIER_REGLAGES, texte);
    const { seance } = await ouvertSur(chargeEssai(), { fs });
    await seance.choisirPapier('A4');
    fs.deposer('documents', FICHIER_REGLAGES, '{"cadrages":[],"format":1,"papier":null}\n');
    assert.deepEqual(await seance.choisirPapier('Lettre'), { avertissements: [] });
    assert.deepEqual([papierLu(fs), seance.etat().papier], ['Lettre', 'Lettre']);
    assert.equal(seance.etat().avertissements.some(({ code }) => code === 'REGLAGES_ILLISIBLES'), false, 'l’avis se retire');
    fs.deposerDossier(PORTABLE.id);
    await seance.changerRacine(PORTABLE);
    assert.equal(seance.etat().papier, null, 'le choix retenu reste à sa racine ; une racine sans réglages le demande');
  });

  // Un dossier de travail qui refuse toute écriture (EROFS) après
  // l'ouverture : les réglages s'y lisent, ils ne s'y écrivent pas.
  const avisNonEcrits = { code: 'REGLAGES_NON_ECRITS', details: { chemin: FICHIER_REGLAGES, dossier: DOCUMENTS, cause: 'EROFS' } };

  test("un dossier qui refuse l'écriture des réglages : le papier choisi vaut pour la séance, un avis le dit, et la planche le prend", async () => {
    const fs = creerFichiersSimules();
    fs.deposerDossier('documents');
    fs.deposer('documents', FICHIER_REGLAGES, '{"cadrages":[],"format":1,"papier":null}\n');
    const { seance } = await ouvertSur(chargeRetenue(), { fs, ...avecPlanche });
    await seance.choisirModeleBadge('a6');
    fs.pannes.ecriture('documents');
    const textes = evenementSurDisque(fs);
    const reglages = fs.contenu('documents', FICHIER_REGLAGES);
    assert.deepEqual(await seance.choisirPapier('A4'), { avertissements: [avisNonEcrits] });
    assert.equal(seance.etat().papier, 'A4');
    const annonce = await seance.preparerPlanche();
    assert.deepEqual([annonce.refus, annonce.papier], [null, 'A4']);
    assert.deepEqual(await seance.choisirPapier('Lettre'), { avertissements: [avisNonEcrits] });
    assert.equal((await seance.preparerPlanche()).papier, 'Lettre');
    assert.deepEqual(
      seance.etat().avertissements.filter(({ code }) => code === avisNonEcrits.code),
      [avisNonEcrits],
      'un avis, pas deux',
    );
    assert.equal(seance.etat().avertissements.some(({ code }) => code === 'REGLAGES_ILLISIBLES'), false);
    assert.equal(fs.contenu('documents', FICHIER_REGLAGES), reglages);
    assert.deepEqual(evenementSurDisque(fs), textes);
  });

  test("un dossier qui refuse l'écriture des réglages : la production ne demande plus le papier, seule l'écriture du PDF est refusée", async () => {
    const fs = creerFichiersSimules();
    fs.deposerDossier('documents');
    const { seance } = await ouvertSur(chargeRetenue(), { fs, ...avecPlanche });
    fs.pannes.ecriture('documents');
    // L'A6, refusé d'écriture comme le papier, vaut pour la séance.
    await seance.choisirModeleBadge('a6');
    assert.match((await refus(seance.produirePlanche(), 'PLANCHE_NON_ECRITE')).details.chemin, /_Lettre_/);
    const textes = evenementSurDisque(fs);
    await seance.choisirPapier('A4');
    const erreur = await refus(seance.produirePlanche(), 'PLANCHE_NON_ECRITE');
    assert.match(erreur.details.chemin, /_A4_/);
    assert.equal(fs.contenu('documents', FICHIER_REGLAGES), null);
    assert.deepEqual(evenementSurDisque(fs), textes);
  });

  test("le papier d'une écriture refusée vaut au changement de racine, là où les réglages n'en portent pas", async () => {
    const fs = creerFichiersSimules({ executable: 'E:\\soirees' });
    const { seance } = await ouvertSur(chargeEssai(), { fs });
    fs.pannes.ecriture('documents');
    await seance.choisirPapier('Lettre');
    fs.deposerDossier(PORTABLE.id);
    await seance.changerRacine(PORTABLE);
    assert.equal(seance.etat().papier, 'Lettre');
  });

  // Des réglages lisibles qui portent déjà un papier, sur la racine des
  // documents.
  const REGLAGES_A4 = '{"cadrages":[],"format":1,"papier":"A4"}\n';
  const sansReglages = (seance) =>
    seance.etat().avertissements.filter(({ code }) => code === 'REGLAGES_NON_ECRITS' || code === 'REGLAGES_ILLISIBLES');

  test("une écriture refusée une fois : le papier de la séance l'emporte sur celui du fichier, le cadrage écrit ensuite l'écrit avec lui, et l'avis se retire", async () => {
    const fs = creerFichiersSimules();
    fs.deposerDossier('documents');
    fs.deposer('documents', FICHIER_REGLAGES, REGLAGES_A4);
    const { seance, planificateur } = await ouvertSur(chargeEssai(), { fs });
    fs.pannes.renommage('documents', 11);
    const avis = { code: 'REGLAGES_NON_ECRITS', details: { chemin: FICHIER_REGLAGES, dossier: DOCUMENTS, cause: 'EBUSY' } };
    assert.deepEqual(await seance.choisirPapier('Lettre'), { avertissements: [avis] });
    assert.deepEqual([papierLu(fs), seance.etat().papier], ['A4', 'Lettre']);
    seance.demanderCadrage({ k: 1.5, tx: 3, ty: 4 });
    await planificateur.avancer(DELAI_REGLAGES_MS);
    await laisser();
    const relus = JSON.parse(fs.contenu('documents', FICHIER_REGLAGES));
    assert.deepEqual([relus.papier, relus.cadrages.length], ['Lettre', 1]);
    assert.equal(seance.etat().papier, 'Lettre');
    assert.deepEqual(sansReglages(seance), [], 'le choix est retenu : l’avis se retire');
    await seance.changerRacine(DOC);
    assert.equal(seance.etat().papier, 'Lettre');
  });

  test("une écriture refusée une fois, puis un papier qui s'écrit : l'avis se retire de l'état", async () => {
    const fs = creerFichiersSimules();
    fs.deposerDossier('documents');
    fs.deposer('documents', FICHIER_REGLAGES, REGLAGES_A4);
    const { seance } = await ouvertSur(chargeEssai(), { fs });
    fs.pannes.renommage('documents', 11);
    await seance.choisirPapier('Lettre');
    assert.deepEqual(sansReglages(seance).map(({ code }) => code), ['REGLAGES_NON_ECRITS']);
    assert.deepEqual(await seance.choisirPapier('Lettre'), { avertissements: [] });
    assert.deepEqual([papierLu(fs), seance.etat().papier], ['Lettre', 'Lettre']);
    assert.deepEqual(sansReglages(seance), []);
  });

  test("un dossier qui refuse l'écriture : revenir sur la même racine garde le papier de la séance, que le fichier en porte un autre ou non ; une autre racine lit le sien", async () => {
    const fs = creerFichiersSimules({ executable: 'E:\\soirees' });
    fs.deposerDossier('documents');
    fs.deposer('documents', FICHIER_REGLAGES, REGLAGES_A4);
    const { seance, planificateur } = await ouvertSur(chargeEssai(), { fs });
    fs.pannes.ecriture('documents');
    await seance.choisirPapier('Lettre');
    await seance.changerRacine(DOC);
    assert.equal(seance.etat().papier, 'Lettre', 'la même racine');
    fs.deposerDossier(PORTABLE.id);
    fs.deposer(PORTABLE.id, FICHIER_REGLAGES, REGLAGES_A4);
    await seance.changerRacine(PORTABLE);
    assert.equal(seance.etat().papier, 'A4', 'une autre racine : son papier l’emporte');
    await seance.changerRacine(DOC);
    assert.equal(seance.etat().papier, 'Lettre', 'de retour sur la racine du choix');
    await seance.ouvrir(EVT);
    seance.demanderCadrage({ k: 2, tx: 0, ty: 0 });
    await planificateur.avancer(DELAI_REGLAGES_MS);
    await laisser();
    assert.equal(seance.etat().papier, 'Lettre', 'un cadrage refusé ne le change pas');
    assert.equal(fs.contenu('documents', FICHIER_REGLAGES), REGLAGES_A4);
  });

  test('une écriture des réglages qui lève autre chose qu’un refus du stockage remonte de choisirPapier, sans poser de papier ni d’avis', async () => {
    const { fs, seance } = await ouvertSur();
    // Les réglages se lisent ; leur écriture lève une panne du processus.
    const ecrireAtomique = fs.ecrireAtomique;
    fs.ecrireAtomique = async (racine, chemin, texte) => {
      if (chemin === FICHIER_REGLAGES) throw new PanneSimulee();
      return ecrireAtomique(racine, chemin, texte);
    };
    await assert.rejects(seance.choisirPapier('A4'), PanneSimulee);
    assert.equal(seance.etat().papier, null);
    assert.deepEqual(sansReglages(seance), []);
  });

  test("un papier écrit pour l'ancienne racine, dans la file pendant un changement de racine, ne se publie jamais sur la nouvelle", async () => {
    const { fs, seance } = monter({ fs: creerFichiersSimules({ executable: 'E:\\soirees' }) });
    await seance.attendre();
    // Un fichier présent : sa lecture se retient, celle d'un absent non.
    fs.deposer('documents', FICHIER_REGLAGES, '{"cadrages":[],"format":1,"papier":null}\n');
    fs.deposerDossier(PORTABLE.id);
    const publies = [];
    seance.subscribe(({ racine, papier }) => publies.push([racine?.id ?? null, papier]));
    const lecture = retenirLectureReglages(fs);
    const choix = seance.choisirPapier('Lettre');
    await laisser();
    assert.equal(lecture.prise(), true, 'la lecture du choix est partie');
    const changement = seance.changerRacine(PORTABLE);
    await laisser();
    assert.equal(seance.racine.id, PORTABLE.id, 'la racine a changé, le choix attend');
    lecture.liberer();
    await choix;
    await changement;
    await seance.attendre();
    assert.equal(papierLu(fs), 'Lettre', 'écrit à sa racine');
    assert.deepEqual(publies.filter(([racine, papier]) => racine === PORTABLE.id && papier !== null), []);
    assert.equal(seance.etat().papier, null);
  });

  test("une écriture des réglages de l'ancienne racine, en cours pendant écrire ailleurs, ne publie jamais son papier sur la racine nouvelle", async () => {
    const fs = creerFichiersSimules({ executable: 'E:\\soirees' });
    const montage = monter({ fs, racine: PORTABLE });
    const { seance, planificateur } = montage;
    await enEcriture(montage);
    // Des réglages illisibles : le papier choisi vaut pour la séance, sur
    // la racine du portable ; réparés, ils s'écrivent ensuite avec lui.
    fs.deposer(PORTABLE.id, FICHIER_REGLAGES, '{"format":1,');
    await seance.choisirPapier('Lettre');
    fs.deposer(PORTABLE.id, FICHIER_REGLAGES, '{"cadrages":[],"format":1,"papier":null}\n');
    // L'état d'un geste refusé rompt le support.
    fs.pannes.renommage(PORTABLE.id, 11);
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } }), 'ETAT_NON_ECRIT');
    assert.equal(seance.supportRompu, true);
    // Le cadrage différé part, et sa lecture des réglages attend.
    seance.demanderCadrage({ k: 2, tx: 0, ty: 0 });
    const lecture = retenirLectureReglages(fs);
    await planificateur.avancer(DELAI_REGLAGES_MS);
    await laisser();
    assert.equal(lecture.prise(), true, 'la lecture du cadrage est partie');
    const publies = [];
    seance.subscribe(({ racine, papier }) => publies.push([racine?.id ?? null, papier]));
    const ailleurs = seance.ecrireAilleurs(DOC);
    for (let pas = 0; pas < 50 && seance.racine.id !== DOC.id; pas += 1) await laisser();
    assert.equal(seance.racine.id, DOC.id, 'la racine a changé, le cadrage attend');
    lecture.liberer();
    await ailleurs;
    await seance.attendre();
    const relus = JSON.parse(fs.contenu(PORTABLE.id, FICHIER_REGLAGES));
    assert.deepEqual([relus.papier, relus.cadrages.length], ['Lettre', 1], 'écrit et retenu à sa racine');
    assert.deepEqual(publies.filter(([racine, papier]) => racine === DOC.id && papier !== null), []);
    assert.equal(seance.etat().papier, null);
  });

  test("un cadrage différé et le choix du papier écrits ensemble : les deux restent, l'un après l'autre", async () => {
    const { fs, seance, planificateur } = await ouvertSur();
    seance.demanderCadrage({ k: 1.5, tx: 3, ty: 4 });
    const cadrage = planificateur.avancer(DELAI_REGLAGES_MS);
    const papier = seance.choisirPapier('Lettre');
    await cadrage;
    await papier;
    await seance.fermer();
    await laisser();
    const relus = JSON.parse(fs.contenu('documents', FICHIER_REGLAGES));
    assert.equal(relus.papier, 'Lettre');
    assert.deepEqual(relus.cadrages, [{ evenement: 'evt-lucioles', k: 1.5, tx: 3, ty: 4 }]);
  });

  test("le papier qu'une autre séance a choisi se lit après l'écriture suivante de cette séance, cadrage compris", async () => {
    const { fs, seance, planificateur } = await ouvertSur();
    const autre = monter({ fs, prefixe: 'autre' });
    await autre.seance.choisirPapier('A4');
    assert.equal(seance.etat().papier, null);
    seance.demanderCadrage({ k: 2, tx: 0, ty: 0 });
    await planificateur.avancer(DELAI_REGLAGES_MS);
    await laisser();
    assert.equal(seance.etat().papier, 'A4');
    assert.equal(papierLu(fs), 'A4');
  });

  // Retient la réponse de la première lecture de reglages_locaux.json qui
  // suit : la lecture se fait aussitôt, sa réponse attend liberer().
  function retenirLectureReglages(fs) {
    const lireTexte = fs.lireTexte;
    let liberer = null;
    const retenue = new Promise((resolve) => {
      liberer = resolve;
    });
    let prise = false;
    fs.lireTexte = async (racine, chemin) => {
      if (prise || chemin !== FICHIER_REGLAGES) return lireTexte(racine, chemin);
      prise = true;
      const reponse = await lireTexte(racine, chemin);
      await retenue;
      return reponse;
    };
    return { liberer: () => liberer(), prise: () => prise };
  }

  test("une relecture du papier partie avant un choix ne l'écrase pas : à la création, l'état suit le fichier", async () => {
    const fs = creerFichiersSimules();
    fs.deposerDossier('documents');
    fs.deposer('documents', FICHIER_REGLAGES, '{"cadrages":[],"format":1,"papier":"A4"}\n');
    const lecture = retenirLectureReglages(fs);
    const { seance } = monter({ fs });
    await laisser();
    assert.equal(lecture.prise(), true, 'la relecture de la création est partie');
    const choix = seance.choisirPapier('Lettre');
    await laisser();
    lecture.liberer();
    await choix;
    await seance.attendre();
    assert.deepEqual([papierLu(fs), seance.etat().papier], ['Lettre', 'Lettre']);
  });

  test("une relecture du papier partie avant un choix ne l'écrase pas : au changement de racine, l'état suit le fichier", async () => {
    const { fs, seance } = monter({ fs: creerFichiersSimules({ executable: 'E:\\soirees' }) });
    await seance.attendre();
    fs.deposerDossier(PORTABLE.id);
    fs.deposer(PORTABLE.id, FICHIER_REGLAGES, '{"cadrages":[],"format":1,"papier":"A4"}\n');
    const lecture = retenirLectureReglages(fs);
    const changement = seance.changerRacine(PORTABLE);
    await laisser();
    assert.equal(lecture.prise(), true, 'la relecture du changement de racine est partie');
    const choix = seance.choisirPapier('Lettre');
    await laisser();
    lecture.liberer();
    await changement;
    await choix;
    await seance.attendre();
    assert.equal(JSON.parse(fs.contenu(PORTABLE.id, FICHIER_REGLAGES)).papier, 'Lettre');
    assert.equal(seance.etat().papier, 'Lettre');
  });
});

describe('séance : la taille du texte de l’écran (§ 8.5, § 18.6)', () => {
  const tailleLue = (fs, racine = 'documents') => JSON.parse(fs.contenu(racine, FICHIER_REGLAGES)).taille_texte;
  // Le texte de l'état et du journal sur le disque, null pour un absent.
  const evenementSurDisque = (fs) => [fs.contenu('documents', ETAT), fs.contenu('documents', JOURNAL)];
  const RETENUE = { retenue: true, avertissements: [] };

  test('100 au départ ; choisirTailleTexte écrit les seuls réglages, dans tout mode, et l’état la porte ; une séance neuve la relit au changement de racine, comme au lancement', async () => {
    const cas = [
      ['lecture', async () => ouvertSur()],
      ['bloqué', async () => ouvertSur(chargeBloquee())],
      ['sans événement', async () => monter()],
    ];
    assert.equal(cas.length, 3);
    for (const [libelleCas, monterCas] of cas) {
      const { fs, seance } = await monterCas();
      assert.equal(seance.etat().tailleTexte, 100, libelleCas);
      const textes = evenementSurDisque(fs);
      const avant = fs.compteurs.ecritures;
      assert.deepEqual(await seance.choisirTailleTexte(130), RETENUE, libelleCas);
      assert.equal(fs.compteurs.ecritures, avant + 1, libelleCas);
      assert.deepEqual([tailleLue(fs), seance.etat().tailleTexte], [130, 130], libelleCas);
      assert.deepEqual(evenementSurDisque(fs), textes, libelleCas);
      const neuve = monter({ fs, racine: null, prefixe: 'neuve' });
      assert.equal(neuve.seance.etat().tailleTexte, 100, `${libelleCas} : sans racine`);
      await neuve.seance.changerRacine(DOC);
      assert.equal(neuve.seance.etat().tailleTexte, 130, libelleCas);
      const surRacine = monter({ fs, prefixe: 'sur-racine' });
      await surRacine.seance.attendre();
      assert.equal(surRacine.seance.etat().tailleTexte, 130, libelleCas);
    }
  });

  test('l’état porte la taille choisie dès le choix, avant que l’écriture finisse', async () => {
    const { seance } = monter();
    const recues = [];
    seance.subscribe((etat) => recues.push(etat.tailleTexte));
    const choix = seance.choisirTailleTexte(150);
    assert.equal(seance.etat().tailleTexte, 150);
    assert.equal(recues.at(-1), 150);
    await choix;
  });

  test('l’écriture garde le papier, les cadrages et les clés inconnues des réglages', async () => {
    const fs = creerFichiersSimules();
    fs.deposerDossier('documents');
    const texte = '{"cadrages":[{"evenement":"evt-a","k":1,"tx":0,"ty":0}],"format":2,"papier":"A4","zeta":true}\n';
    fs.deposer('documents', FICHIER_REGLAGES, texte);
    const { seance } = monter({ fs });
    await seance.attendre();
    await seance.choisirTailleTexte(115);
    assert.equal(fs.contenu('documents', FICHIER_REGLAGES), texte.replace('"papier":"A4"', '"papier":"A4","taille_texte":115'));
  });

  test('une taille hors des paliers est une faute du code : TypeError, rien ne s’écrit et l’état ne change pas', async () => {
    const { fs, seance } = await ouvertSur();
    const avant = fs.compteurs.ecritures;
    for (const faute of [0, 120, '115', null, undefined, Number.NaN]) {
      await assert.rejects(seance.choisirTailleTexte(faute), TypeError, String(faute));
    }
    assert.equal(fs.compteurs.ecritures, avant);
    assert.equal(seance.etat().tailleTexte, 100);
  });

  test('des réglages illisibles : la taille vaut pour la séance, non retenue, l’avis rendu sans entrer dans l’état, le fichier intact octet pour octet', async () => {
    for (const [raison, texte] of [
      ['FORME', '{"format":1,"papier":null,"cadrages":[],"taille_texte":175}'],
      ['JSON', '{"format":1,"papier":"A4","cadr'],
    ]) {
      const fs = creerFichiersSimules();
      fs.deposerDossier('documents');
      fs.deposer('documents', FICHIER_REGLAGES, texte);
      const { seance } = await ouvertSur(chargeEssai(), { fs });
      assert.equal(seance.etat().tailleTexte, 100, raison);
      const avertissements = seance.etat().avertissements;
      const avant = fs.compteurs.ecritures;
      const avis = { code: 'REGLAGES_ILLISIBLES', details: { chemin: FICHIER_REGLAGES, raison } };
      assert.deepEqual(await seance.choisirTailleTexte(115), { retenue: false, avertissements: [avis] }, raison);
      assert.equal(seance.etat().tailleTexte, 115, raison);
      assert.deepEqual(seance.etat().avertissements, avertissements, raison);
      assert.deepEqual(fs.octets('documents', FICHIER_REGLAGES), new TextEncoder().encode(texte), raison);
      assert.equal(fs.compteurs.ecritures, avant, raison);
    }
  });

  test("un dossier qui refuse l'écriture des réglages : la taille vaut pour la séance, non retenue, et l'avis le dit", async () => {
    const { fs, seance } = await ouvertSur();
    fs.pannes.ecriture('documents');
    const avis = { code: 'REGLAGES_NON_ECRITS', details: { chemin: FICHIER_REGLAGES, dossier: DOCUMENTS, cause: 'EROFS' } };
    assert.deepEqual(await seance.choisirTailleTexte(150), { retenue: false, avertissements: [avis] });
    assert.equal(seance.etat().tailleTexte, 150);
    assert.equal(fs.contenu('documents', FICHIER_REGLAGES), null);
  });

  test('sans dossier de travail, la taille vaut pour la séance, non retenue, et rien ne s’écrit', async () => {
    const { fs, seance } = monter({ racine: null });
    const avant = fs.compteurs.ecritures;
    assert.deepEqual(await seance.choisirTailleTexte(90), { retenue: false, avertissements: [] });
    assert.equal(seance.etat().tailleTexte, 90);
    assert.equal(fs.compteurs.ecritures, avant);
  });

  test('au changement de racine : la taille que les réglages portent, à défaut celle de la séance — une racine sans taille, illisible ou sans réglages la garde', async () => {
    const fs = creerFichiersSimules({ executable: 'E:\\soirees' });
    fs.deposerDossier('documents');
    fs.deposer('documents', FICHIER_REGLAGES, '{"cadrages":[],"format":1,"papier":null,"taille_texte":130}\n');
    const { seance } = monter({ fs, racine: null });
    await seance.changerRacine(DOC);
    assert.equal(seance.etat().tailleTexte, 130);
    fs.deposerDossier(PORTABLE.id);
    await seance.changerRacine(PORTABLE);
    assert.equal(seance.etat().tailleTexte, 130, 'une racine sans réglages');
    fs.deposer(PORTABLE.id, FICHIER_REGLAGES, '{"cadrages":[],"format":1,"papier":"A4"}\n');
    await seance.changerRacine(DOC);
    await seance.changerRacine(PORTABLE);
    assert.equal(seance.etat().tailleTexte, 130, 'des réglages sans taille');
    fs.deposer(PORTABLE.id, FICHIER_REGLAGES, '{"format":1,"papier":"A4","cadr');
    await seance.changerRacine(PORTABLE);
    assert.equal(seance.etat().tailleTexte, 130, 'des réglages illisibles');
    fs.deposer(PORTABLE.id, FICHIER_REGLAGES, '{"cadrages":[],"format":1,"papier":null,"taille_texte":90}\n');
    await seance.changerRacine(PORTABLE);
    assert.equal(seance.etat().tailleTexte, 90, 'une taille écrite sur la racine l’emporte');
  });

  test('une relecture des réglages partie avant un choix de taille ne l’écrase pas, ni dans l’état ni dans le fichier', async () => {
    const { fs, seance } = monter({ fs: creerFichiersSimules({ executable: 'E:\\soirees' }) });
    await seance.attendre();
    fs.deposerDossier(PORTABLE.id);
    fs.deposer(PORTABLE.id, FICHIER_REGLAGES, '{"cadrages":[],"format":1,"papier":null,"taille_texte":90}\n');
    const lireTexte = fs.lireTexte;
    let liberer = null;
    const retenue = new Promise((resolve) => {
      liberer = resolve;
    });
    let prise = false;
    fs.lireTexte = async (racine, chemin) => {
      if (prise || chemin !== FICHIER_REGLAGES) return lireTexte(racine, chemin);
      prise = true;
      const reponse = await lireTexte(racine, chemin);
      await retenue;
      return reponse;
    };
    const changement = seance.changerRacine(PORTABLE);
    await laisser();
    assert.equal(prise, true, 'la relecture du changement de racine est partie');
    const choix = seance.choisirTailleTexte(130);
    await laisser();
    liberer();
    await changement;
    assert.equal(seance.etat().tailleTexte, 130);
    assert.deepEqual(await choix, RETENUE);
    await seance.attendre();
    assert.deepEqual([tailleLue(fs, PORTABLE.id), seance.etat().tailleTexte], [130, 130]);
  });

  test('le papier de la séance, non retenu, s’écrit avec la taille dès que les réglages réparés l’acceptent', async () => {
    const fs = creerFichiersSimules();
    fs.deposerDossier('documents');
    fs.deposer('documents', FICHIER_REGLAGES, '{"format":1,"papier":"A4","cadr');
    const { seance } = await ouvertSur(chargeEssai(), { fs });
    await seance.choisirPapier('Lettre');
    fs.deposer('documents', FICHIER_REGLAGES, '{"cadrages":[],"format":1,"papier":null}\n');
    assert.deepEqual(await seance.choisirTailleTexte(115), RETENUE);
    const relus = JSON.parse(fs.contenu('documents', FICHIER_REGLAGES));
    assert.deepEqual([relus.papier, relus.taille_texte], ['Lettre', 115]);
  });
});

describe('séance : la planche, câblée dans la file des appels (§ 11.6, § 13.4)', () => {
  // Une soirée retenue de quatre personnes sur deux tables de deux places,
  // deux tours, le retenu daté de H_RETENU.
  const PLAN = [{ sieges: [[1, 2], [3, 4]] }, { sieges: [[1, 3], [2, 4]] }];
  const chargeRetenue = () =>
    soiree({
      personnes: [
        personneBadge(1, 'Iris', 'Ombrelle'),
        personneBadge(2, 'Théo', 'Pervenche'),
        personneBadge(3, 'Ondine', 'Lacasse'),
        personneBadge(4, null, 'Grisaille'),
      ],
      tables: [tableBadge(1, 1, 2), tableBadge(2, 2, 2)],
      plan: PLAN,
      propositions: [[1, PLAN]],
    });

  test('preparerPlanche lancé derrière un geste lit la charge que le geste laisse ; la police se charge une fois par séance', async () => {
    const fs = creerFichiersSimules();
    await deposerEssai(fs, chargeRetenue());
    let chargements = 0;
    const polices = async () => {
      chargements += 1;
      return lirePolices();
    };
    const { seance } = monter({ fs, polices, provenance: 'production' });
    await seance.choisirModeleBadge('a6');
    await seance.choisirPapier('A4');
    await seance.ouvrir(EVT);
    await seance.passerEnEcriture();
    const geste = seance.executer('echangerDansRetenu', { tour: 1, a: 1, b: 3 });
    const annonce = seance.preparerPlanche();
    await geste;
    const horodatage = seance.charge.retenu.horodatage;
    assert.notEqual(horodatage, H_RETENU);
    const attendu = nomPlanche(BASE, { papier: 'A4', imposition: 'feuille', horodatage, reedition: null });
    assert.equal((await annonce).nom, attendu);
    assert.equal((await seance.preparerPlanche()).nom, attendu);
    assert.equal(chargements, 1);
  });

  test('un papier choisi sans être attendu compte pour la planche demandée juste après : la planche attend les écritures de réglages déjà demandées', async () => {
    const fs = creerFichiersSimules();
    await deposerEssai(fs, chargeRetenue());
    const { seance } = monter({ fs, polices: async () => lirePolices(), provenance: 'production' });
    await seance.choisirModeleBadge('a6');
    await seance.ouvrir(EVT);
    const choix = seance.choisirPapier('Lettre');
    const annonce = await seance.preparerPlanche();
    await choix;
    assert.deepEqual([annonce.refus, annonce.papier], [null, 'Lettre']);
  });

  test('sans police ni provenance, préparer lève TypeError ; un chargement refusé remonte, et le suivant réessaie', async () => {
    const fs = creerFichiersSimules();
    await deposerEssai(fs, chargeRetenue());
    const sansPolices = monter({ fs, provenance: 'production' }).seance;
    await sansPolices.ouvrir(EVT);
    await assert.rejects(sansPolices.preparerPlanche(), (erreur) => erreur instanceof TypeError && /polices/.test(erreur.message));
    const sansProvenance = monter({ fs, prefixe: 'sans-provenance', polices: async () => lirePolices() }).seance;
    await sansProvenance.ouvrir(EVT);
    await assert.rejects(sansProvenance.preparerPlanche(), TypeError);

    let essais = 0;
    const polices = async () => {
      essais += 1;
      if (essais === 1) throw new Error('police illisible');
      return lirePolices();
    };
    const { seance } = monter({ fs, prefixe: 'reessai', polices, provenance: 'production' });
    await seance.choisirModeleBadge('a6');
    await seance.ouvrir(EVT);
    await assert.rejects(seance.preparerPlanche(), /police illisible/);
    const annonce = await seance.preparerPlanche();
    assert.deepEqual([annonce.refus, annonce.papier], [null, 'Lettre']);
    assert.equal(essais, 2);
  });
});

describe('séance : la course de la recherche dans son compagnon (§ 5.10, § 8.9, B31)', () => {
  const COURSES = `${BASE}/${BASE}${SUFFIXES.courses}`;

  // Les identifiants des propositions dont le compagnon sur le disque porte
  // la course, dans son ordre ; null sans compagnon.
  const dansLeCompagnon = (fs) => {
    const texte = fs.contenu('documents', COURSES);
    return texte === null ? null : JSON.parse(texte).courses.map(({ id }) => id);
  };

  test("une génération écrit le compagnon, que courseDe lit ; un geste qui garde les propositions ne le réécrit pas ; défaire et refaire la génération le réécrivent, la course gardée par la séance, même relue au passage en écriture", async () => {
    const fs = creerFichiersSimules();
    await deposerEssai(fs);
    const montage = monter({ fs });
    await ouvrirSansEcrire(montage);
    const { seance } = montage;
    await seance.passerEnEcriture();
    assert.equal(seance.courseDe(1), null);

    const args = generer(seance.charge);
    await seance.executer('enregistrerGeneration', args);
    assert.deepEqual(dansLeCompagnon(fs), [1, 2]);
    assert.equal(seance.courseDe(2).evalues, args.propositions[1].evalues);
    assert.equal(etatDe(fs).charge.propositions.some((p) => Object.hasOwn(p, 'course')), false);

    const texte = fs.contenu('documents', COURSES);
    const ecrire = fs.ecrireAtomique;
    const ecrits = [];
    fs.ecrireAtomique = (racine, chemin, contenu) => {
      ecrits.push(chemin);
      return ecrire(racine, chemin, contenu);
    };
    await seance.executer('retenirProposition', { id: 1 });
    await seance.executer('exclureParticipant', { id: 2 });
    assert.equal(ecrits.includes(COURSES), false);
    assert.equal(fs.contenu('documents', COURSES), texte);

    await seance.defaire();
    await seance.defaire();
    await seance.defaire();
    assert.deepEqual(seance.charge.propositions, []);
    assert.deepEqual(dansLeCompagnon(fs), []);
    assert.equal(seance.courseDe(1), null);

    await seance.passerEnLecture();
    await seance.passerEnEcriture();
    await seance.refaire();
    assert.deepEqual(dansLeCompagnon(fs), [1, 2]);
    assert.equal(seance.courseDe(2).evalues, args.propositions[1].evalues);
    assert.equal(fs.contenu('documents', COURSES), texte);
  });

  test("garder les meilleures retire du compagnon les courses des effacées ; une entrée, que défaire rend, compagnon compris ; en lecture, refusé sans rien écrire", async () => {
    const fs = creerFichiersSimules();
    await deposerEssai(fs);
    const montage = monter({ fs });
    await ouvrirSansEcrire(montage);
    const { seance } = montage;
    await seance.passerEnEcriture();
    await seance.executer('enregistrerGeneration', generer(seance.charge, 3));
    assert.deepEqual(dansLeCompagnon(fs), [1, 2, 3]);
    const entrees = journalDe(fs).entrees.length;

    const rendu = await seance.executer('garderMeilleures', { n: 1 });
    assert.deepEqual(rendu.resume, { effacees: 2 });
    const gardees = seance.charge.propositions.map(({ id }) => id);
    assert.equal(gardees.length, 1);
    assert.deepEqual(dansLeCompagnon(fs), gardees);
    assert.equal(seance.charge.prochainsIds.proposition, 4);
    assert.equal(journalDe(fs).entrees.length, entrees + 1);
    assert.equal(libellesDe(journalDe(fs)).at(-1), 'Gardé la meilleure proposition, effacé 2 propositions');

    await seance.defaire();
    assert.deepEqual(seance.charge.propositions.map(({ id }) => id), [1, 2, 3]);
    assert.deepEqual(dansLeCompagnon(fs), [1, 2, 3]);

    await seance.passerEnLecture();
    const etat = fs.contenu('documents', ETAT);
    await refus(seance.executer('garderMeilleures', { n: 1 }), 'MODE_LECTURE', { remede: { geste: 'modifier' } });
    assert.equal(fs.contenu('documents', ETAT), etat);
    assert.deepEqual(dansLeCompagnon(fs), [1, 2, 3]);
  });

  // Le compteur des propositions ne recule jamais sous défaire ni revenir ;
  // il recule quand l'opérateur reprend un état d'avant la génération, ici
  // son .precedent. La génération suivante, sous la même graine, porte
  // alors les mêmes id, graine, arret et historique que celles du journal,
  // et après un changement qui laisse la déclaration intacte — ici une
  // organisation — un autre placement. Le retour à la première génération
  // ne rend jamais la course de la seconde, et réécrit le compagnon.
  test("une génération refaite sous la même graine après un changement d'organisation ne prête jamais sa course à la première ; le retour à la première réécrit le compagnon", async () => {
    const fs = creerFichiersSimules();
    await deposerEssai(fs);
    const montage = monter({ fs });
    await ouvrirSansEcrire(montage);
    const { seance } = montage;
    await seance.passerEnEcriture();
    await seance.executer('enregistrerGeneration', generer(seance.charge));
    const revision = seance.ouvert.revision;
    const premieres = seance.charge.propositions;
    assert.notEqual(seance.courseDe(1), null);
    await seance.passerEnLecture();

    await seance.ouvrirSecours(EVT, 'precedent');
    await seance.passerEnEcriture();
    assert.deepEqual(seance.charge.propositions, []);
    await seance.executer('modifierParticipant', { id: 2, champs: { organisation: 'Société Alpha' } });
    await seance.executer('enregistrerGeneration', generer(seance.charge));
    const identite = ({ id, graine, arret, historique }) => [id, graine, arret, historique];
    assert.deepEqual(seance.charge.propositions.map(identite), premieres.map(identite));
    assert.notDeepEqual(seance.charge.propositions[0].placement, premieres[0].placement);
    assert.notEqual(seance.courseDe(1), null);
    const texteSeconde = fs.contenu('documents', COURSES);

    await seance.revenir(revision);
    const placements = (propositions) => propositions.map(({ placement }) => placement);
    assert.deepEqual(placements(seance.charge.propositions), placements(premieres));
    // La séance ne connaît plus la course de la première génération.
    assert.equal(seance.courseDe(1), null);
    assert.notEqual(fs.contenu('documents', COURSES), texteSeconde);
    assert.deepEqual(dansLeCompagnon(fs), []);

    // Relu par une autre séance, le compagnon ne rend aucune course.
    await seance.fermer();
    const relecture = monter({ fs, prefixe: 'relecture' });
    await ouvrirSansEcrire(relecture);
    assert.equal(relecture.seance.courseDe(1), null);
  });

  // Douze personnes, la sixième seule du Club des Merles, trois tables de
  // quatre, trois tours, sous l'ordre du registre réglé, chaque critère seul
  // à son palier.
  function chargeDouze() {
    const charge = creerCharge({ id: 'evt-lucioles', nom: BASE, siegesParDefaut: 4, tours: 3 });
    const ordreDuRegistre = CRITERES.map((critere) => [{ critere, poids: 1 }]);
    charge.reglages.priorites = ordreDuRegistre;
    const prenoms = ['Iris', 'Théo', 'Ondine', 'Basile', 'Clémence', 'Gaspard', 'Lison', 'Marius', 'Nora', 'Octave', 'Perle', 'Rémi'];
    charge.participants = prenoms.map((prenom, i) => personne(i + 1, 'Lucane', prenom, i === 5 ? 'Club des Merles' : null));
    charge.tables = [1, 2, 3].map((id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 250 * (id - 1), y: 0 } }));
    charge.prochainsIds = { participant: 13, table: 4, proposition: 1 };
    return charge;
  }

  // Les arguments d'enregistrerGeneration : graine 1, arrêt à 400 mouvements.
  const generationDouze = (charge) => {
    const configuration = configurationDepuisCharge(charge);
    return { propositions: rechercher(configuration, { graine: 1, arret: 400, nombre: 2 }), configuration, produitVersion: V1 };
  };

  // Une deuxième personne au Club des Merles ne change pas le placement
  // final de la recherche sous la même graine, mais sa course : la seconde
  // génération porte alors la même identité de recherche et la même
  // empreinte que la première. Seul l'horodatage de la génération les
  // départage.
  test("une génération refaite sous la même graine qui finit sur le même placement ne prête jamais sa course à la première", async () => {
    const fs = creerFichiersSimules();
    await deposerEssai(fs, chargeDouze());
    const montage = monter({ fs });
    await ouvrirSansEcrire(montage);
    const { seance } = montage;
    await seance.passerEnEcriture();
    await seance.executer('enregistrerGeneration', generationDouze(seance.charge));
    const revision = seance.ouvert.revision;
    const premieres = seance.charge.propositions;
    const premiereCourse = seance.courseDe(1);
    assert.notEqual(premiereCourse, null);
    await seance.passerEnLecture();

    await seance.ouvrirSecours(EVT, 'precedent');
    await seance.passerEnEcriture();
    await seance.executer('modifierParticipant', { id: 2, champs: { organisation: 'Club des Merles' } });
    await seance.executer('enregistrerGeneration', generationDouze(seance.charge));
    const [p1] = premieres;
    const [q1] = seance.charge.propositions;
    const identite = ({ id, graine, arret, historique, placement }) => ({ id, graine, arret, historique, placement });
    assert.deepEqual(identite(q1), identite(p1));
    assert.notEqual(q1.horodatage, p1.horodatage);
    const secondeCourse = seance.courseDe(1);
    assert.notDeepEqual(secondeCourse, premiereCourse);

    await seance.revenir(revision);
    assert.deepEqual(seance.charge.propositions, premieres);
    // La séance a quitté la course de la première en ouvrant le .precedent,
    // et celle de la seconde n'est pas la sienne.
    assert.equal(seance.courseDe(1), null);
    assert.deepEqual(dansLeCompagnon(fs), []);

    await seance.fermer();
    const relecture = monter({ fs, prefixe: 'relecture' });
    await ouvrirSansEcrire(relecture);
    assert.equal(relecture.seance.courseDe(1), null);
  });

  // La première séance garde en mémoire la course de sa génération ; une
  // autre, sur une horloge plus tardive, reprend le .precedent et régénère
  // sur le même placement. Le passage en écriture de la première relit le
  // compagnon de la seconde sans perdre sa course.
  test("la course qu'une séance garde ne cède pas à celle qu'une autre séance écrit pour une génération qui finit sur le même placement", async () => {
    const fs = creerFichiersSimules();
    await deposerEssai(fs, chargeDouze());
    const premiere = monter({ fs });
    await ouvrirSansEcrire(premiere);
    await premiere.seance.passerEnEcriture();
    await premiere.seance.executer('enregistrerGeneration', generationDouze(premiere.seance.charge));
    const revision = premiere.seance.ouvert.revision;
    const premieres = premiere.seance.charge.propositions;
    const premiereCourse = premiere.seance.courseDe(1);
    assert.notEqual(premiereCourse, null);
    await premiere.seance.passerEnLecture();

    const seconde = monter({ fs, prefixe: 'seconde', horloge: creerHorloge(60) });
    await ouvrirSansEcrire(seconde);
    await seconde.seance.ouvrirSecours(EVT, 'precedent');
    await seconde.seance.passerEnEcriture();
    await seconde.seance.executer('modifierParticipant', { id: 2, champs: { organisation: 'Club des Merles' } });
    await seconde.seance.executer('enregistrerGeneration', generationDouze(seconde.seance.charge));
    assert.deepEqual(seconde.seance.charge.propositions[0].placement, premieres[0].placement);
    assert.notDeepEqual(seconde.seance.courseDe(1), premiereCourse);
    await seconde.seance.passerEnLecture();

    await premiere.seance.passerEnEcriture();
    await premiere.seance.revenir(revision);
    assert.deepEqual(premiere.seance.charge.propositions, premieres);
    assert.deepEqual(premiere.seance.courseDe(1), premiereCourse);
    assert.deepEqual(dansLeCompagnon(fs), [1, 2]);

    await premiere.seance.fermer();
    const relecture = monter({ fs, prefixe: 'relecture' });
    await ouvrirSansEcrire(relecture);
    assert.deepEqual(relecture.seance.courseDe(1), premiereCourse);
  });

  test("la séance sans événement n'a aucune course", () => {
    const { seance } = monter();
    assert.equal(seance.courseDe(1), null);
  });
});

describe('séance : le modèle de badge (§ 8.5, § 11.2)', () => {
  const modeleLu = (fs, racine = 'documents') => JSON.parse(fs.contenu(racine, FICHIER_REGLAGES)).modele_badge;
  const PLAN_RETENU = [{ sieges: [[1, 2]] }];
  const chargeRetenue = () =>
    soiree({
      personnes: [personneBadge(1, 'Iris', 'Ombrelle'), personneBadge(2, 'Théo', 'Pervenche')],
      tables: [tableBadge(1, 1, 2)],
      plan: PLAN_RETENU,
      propositions: [[1, PLAN_RETENU]],
    });
  const avecPlanche = { polices: async () => lirePolices(), provenance: 'production' };

  test('Avery 5392 au départ ; choisirModeleBadge écrit les seuls réglages, dans tout mode, et l’état le porte ; une séance neuve le relit', async () => {
    const { fs, seance } = await ouvertSur(chargeBloquee());
    assert.equal(seance.etat().modeleBadge, 'avery5392');
    const avant = fs.compteurs.ecritures;
    assert.deepEqual(await seance.choisirModeleBadge('a6'), { retenu: true, avertissements: [] });
    assert.equal(fs.compteurs.ecritures, avant + 1);
    assert.deepEqual([modeleLu(fs), seance.etat().modeleBadge], ['a6', 'a6']);
    const neuve = monter({ fs, prefixe: 'neuve' });
    await neuve.seance.attendre();
    assert.equal(neuve.seance.etat().modeleBadge, 'a6');
  });

  test('un modèle inconnu est une faute du code : TypeError, rien ne s’écrit et l’état ne change pas', async () => {
    const { fs, seance } = await ouvertSur();
    const avant = fs.compteurs.ecritures;
    for (const faute of ['A6', 'Avery5392', '', null, undefined, 'toString']) {
      await assert.rejects(seance.choisirModeleBadge(faute), TypeError, String(faute));
    }
    assert.equal(fs.compteurs.ecritures, avant);
    assert.equal(seance.etat().modeleBadge, 'avery5392');
  });

  test('des réglages illisibles : le modèle vaut pour la séance, non retenu, l’avis rendu, le fichier intact', async () => {
    const texte = '{"format":1,"papier":"A4","cadr';
    const fs = creerFichiersSimules();
    fs.deposerDossier('documents');
    fs.deposer('documents', FICHIER_REGLAGES, texte);
    const { seance } = await ouvertSur(chargeEssai(), { fs });
    const avis = { code: 'REGLAGES_ILLISIBLES', details: { chemin: FICHIER_REGLAGES, raison: 'JSON' } };
    assert.deepEqual(await seance.choisirModeleBadge('a6'), { retenu: false, avertissements: [avis] });
    assert.equal(seance.etat().modeleBadge, 'a6');
    assert.equal(fs.contenu('documents', FICHIER_REGLAGES), texte);
  });

  test('l’écriture garde le papier, la taille du texte et les clés inconnues ; choisir le papier garde le modèle', async () => {
    const fs = creerFichiersSimules();
    fs.deposerDossier('documents');
    fs.deposer('documents', FICHIER_REGLAGES, '{"cadrages":[],"format":1,"papier":"A4","taille_texte":115,"zeta":true}\n');
    const { seance } = monter({ fs });
    await seance.attendre();
    await seance.choisirModeleBadge('a6');
    await seance.choisirPapier('Lettre');
    assert.equal(fs.contenu('documents', FICHIER_REGLAGES), '{"cadrages":[],"format":1,"modele_badge":"a6","papier":"Lettre","taille_texte":115,"zeta":true}\n');
  });

  test('au changement de racine : le modèle que les réglages portent, à défaut celui de la séance — une racine sans modèle, illisible ou sans réglages le garde', async () => {
    const fs = creerFichiersSimules({ executable: 'E:\\soirees' });
    fs.deposerDossier('documents');
    fs.deposer('documents', FICHIER_REGLAGES, '{"cadrages":[],"format":1,"modele_badge":"a6","papier":null}\n');
    const { seance } = monter({ fs, racine: null });
    await seance.changerRacine(DOC);
    assert.equal(seance.etat().modeleBadge, 'a6');
    fs.deposerDossier(PORTABLE.id);
    await seance.changerRacine(PORTABLE);
    assert.equal(seance.etat().modeleBadge, 'a6', 'une racine sans réglages');
    fs.deposer(PORTABLE.id, FICHIER_REGLAGES, '{"cadrages":[],"format":1,"papier":"A4"}\n');
    await seance.changerRacine(DOC);
    await seance.changerRacine(PORTABLE);
    assert.equal(seance.etat().modeleBadge, 'a6', 'des réglages sans modèle');
    fs.deposer(PORTABLE.id, FICHIER_REGLAGES, '{"format":1,"papier":"A4","cadr');
    await seance.changerRacine(PORTABLE);
    assert.equal(seance.etat().modeleBadge, 'a6', 'des réglages illisibles');
    fs.deposer(PORTABLE.id, FICHIER_REGLAGES, '{"cadrages":[],"format":1,"modele_badge":"avery5392","papier":null}\n');
    await seance.changerRacine(PORTABLE);
    assert.equal(seance.etat().modeleBadge, 'avery5392', 'un modèle écrit sur la racine l’emporte');
  });

  test('une relecture des réglages partie avant un choix de modèle ne l’écrase pas, ni dans l’état ni dans le fichier', async () => {
    const { fs, seance } = monter({ fs: creerFichiersSimules({ executable: 'E:\\soirees' }) });
    await seance.attendre();
    fs.deposerDossier(PORTABLE.id);
    fs.deposer(PORTABLE.id, FICHIER_REGLAGES, '{"cadrages":[],"format":1,"modele_badge":"avery5392","papier":null}\n');
    const lireTexte = fs.lireTexte;
    let liberer = null;
    const retenue = new Promise((resolve) => {
      liberer = resolve;
    });
    let prise = false;
    fs.lireTexte = async (racine, chemin) => {
      if (prise || chemin !== FICHIER_REGLAGES) return lireTexte(racine, chemin);
      prise = true;
      const reponse = await lireTexte(racine, chemin);
      await retenue;
      return reponse;
    };
    const changement = seance.changerRacine(PORTABLE);
    await laisser();
    assert.equal(prise, true, 'la relecture du changement de racine est partie');
    const choix = seance.choisirModeleBadge('a6');
    await laisser();
    liberer();
    await changement;
    assert.equal(seance.etat().modeleBadge, 'a6');
    assert.deepEqual(await choix, { retenu: true, avertissements: [] });
    await seance.attendre();
    assert.deepEqual([modeleLu(fs, PORTABLE.id), seance.etat().modeleBadge], ['a6', 'a6']);
  });

  test('la planche suit le modèle : Avery 5392 sur Lettre sans papier choisi ; l’A6 sans papier choisi sur Lettre, sans refus, le papier de la machine toujours à choisir', async () => {
    const { seance } = await ouvertSur(chargeRetenue(), avecPlanche);
    assert.equal(seance.etat().papier, null);
    const avery = await seance.preparerPlanche();
    assert.deepEqual([avery.refus, avery.modeleBadge, avery.papier, avery.planches], [null, 'avery5392', 'Lettre', { Lettre: 1 }]);
    assert.match(avery.nom, /\.badges_avery5392_/);
    assert.match(avery.nomControle, /\.controle_avery5392_/);
    await seance.choisirModeleBadge('a6');
    const a6 = await seance.preparerPlanche();
    assert.deepEqual([a6.refus, a6.modeleBadge, a6.papier, a6.nomControle], [null, 'a6', 'Lettre', null]);
    assert.match(a6.nom, /\.badges_Lettre_feuille_/);
    assert.equal(seance.etat().papier, null);
  });
});

describe('séance : le pied TechnoLibre des badges (§ 8.5, § 11.4)', () => {
  const caseLue = (fs, racine = 'documents') => JSON.parse(fs.contenu(racine, FICHIER_REGLAGES)).pied_technolibre;
  const PLAN_RETENU = [{ sieges: [[1, 2]] }];
  const chargeRetenue = () =>
    soiree({
      personnes: [personneBadge(1, 'Iris', 'Ombrelle'), personneBadge(2, 'Théo', 'Pervenche')],
      tables: [tableBadge(1, 1, 2)],
      plan: PLAN_RETENU,
      propositions: [[1, PLAN_RETENU]],
    });
  const avecPlanche = { polices: async () => lirePolices(), provenance: 'production' };

  test('cochée au départ ; choisirPiedTechnolibre écrit les seuls réglages, dans tout mode, et l’état la porte ; une séance neuve la relit', async () => {
    const { fs, seance } = await ouvertSur(chargeBloquee());
    assert.equal(seance.etat().piedTechnolibre, true);
    const avant = fs.compteurs.ecritures;
    assert.deepEqual(await seance.choisirPiedTechnolibre(false), { retenu: true, avertissements: [] });
    assert.equal(fs.compteurs.ecritures, avant + 1);
    assert.deepEqual([caseLue(fs), seance.etat().piedTechnolibre], [false, false]);
    const neuve = monter({ fs, prefixe: 'neuve' });
    await neuve.seance.attendre();
    assert.equal(neuve.seance.etat().piedTechnolibre, false);
    assert.deepEqual(await neuve.seance.choisirPiedTechnolibre(true), { retenu: true, avertissements: [] });
    assert.deepEqual([caseLue(fs), neuve.seance.etat().piedTechnolibre], [true, true]);
  });

  test('une valeur qui n’est pas un booléen est une faute du code : TypeError, rien ne s’écrit et l’état ne change pas', async () => {
    const { fs, seance } = await ouvertSur();
    const avant = fs.compteurs.ecritures;
    for (const faute of ['false', 0, 1, null, undefined]) {
      await assert.rejects(seance.choisirPiedTechnolibre(faute), TypeError, String(faute));
    }
    assert.equal(fs.compteurs.ecritures, avant);
    assert.equal(seance.etat().piedTechnolibre, true);
  });

  test('des réglages illisibles : la case vaut pour la séance, non retenue, l’avis rendu, le fichier intact', async () => {
    const texte = '{"format":1,"papier":"A4","cadr';
    const fs = creerFichiersSimules();
    fs.deposerDossier('documents');
    fs.deposer('documents', FICHIER_REGLAGES, texte);
    const { seance } = await ouvertSur(chargeEssai(), { fs });
    const avis = { code: 'REGLAGES_ILLISIBLES', details: { chemin: FICHIER_REGLAGES, raison: 'JSON' } };
    assert.deepEqual(await seance.choisirPiedTechnolibre(false), { retenu: false, avertissements: [avis] });
    assert.equal(seance.etat().piedTechnolibre, false);
    assert.equal(fs.contenu('documents', FICHIER_REGLAGES), texte);
  });

  test('l’écriture garde le papier, le modèle, la taille du texte et les clés inconnues ; choisir le modèle garde la case', async () => {
    const fs = creerFichiersSimules();
    fs.deposerDossier('documents');
    fs.deposer('documents', FICHIER_REGLAGES, '{"cadrages":[],"format":1,"papier":"A4","taille_texte":115,"zeta":true}\n');
    const { seance } = monter({ fs });
    await seance.attendre();
    await seance.choisirPiedTechnolibre(false);
    await seance.choisirModeleBadge('a6');
    assert.equal(
      fs.contenu('documents', FICHIER_REGLAGES),
      '{"cadrages":[],"format":1,"modele_badge":"a6","papier":"A4","pied_technolibre":false,"taille_texte":115,"zeta":true}\n',
    );
  });

  test('au changement de racine : la case que les réglages portent, à défaut celle de la séance', async () => {
    const fs = creerFichiersSimules({ executable: 'E:\\soirees' });
    fs.deposerDossier('documents');
    fs.deposer('documents', FICHIER_REGLAGES, '{"cadrages":[],"format":1,"papier":null,"pied_technolibre":false}\n');
    const { seance } = monter({ fs, racine: null });
    await seance.changerRacine(DOC);
    assert.equal(seance.etat().piedTechnolibre, false);
    fs.deposerDossier(PORTABLE.id);
    await seance.changerRacine(PORTABLE);
    assert.equal(seance.etat().piedTechnolibre, false, 'une racine sans réglages');
    fs.deposer(PORTABLE.id, FICHIER_REGLAGES, '{"format":1,"papier":"A4","cadr');
    await seance.changerRacine(PORTABLE);
    assert.equal(seance.etat().piedTechnolibre, false, 'des réglages illisibles');
    fs.deposer(PORTABLE.id, FICHIER_REGLAGES, '{"cadrages":[],"format":1,"papier":null,"pied_technolibre":true}\n');
    await seance.changerRacine(PORTABLE);
    assert.equal(seance.etat().piedTechnolibre, true, 'une case écrite sur la racine l’emporte');
  });

  test('une relecture des réglages partie avant un choix de la case ne l’écrase pas, ni dans l’état ni dans le fichier', async () => {
    const { fs, seance } = monter({ fs: creerFichiersSimules({ executable: 'E:\\soirees' }) });
    await seance.attendre();
    fs.deposerDossier(PORTABLE.id);
    fs.deposer(PORTABLE.id, FICHIER_REGLAGES, '{"cadrages":[],"format":1,"papier":null,"pied_technolibre":true}\n');
    const lireTexte = fs.lireTexte;
    let liberer = null;
    const retenue = new Promise((resolve) => {
      liberer = resolve;
    });
    let prise = false;
    fs.lireTexte = async (racine, chemin) => {
      if (prise || chemin !== FICHIER_REGLAGES) return lireTexte(racine, chemin);
      prise = true;
      const reponse = await lireTexte(racine, chemin);
      await retenue;
      return reponse;
    };
    const changement = seance.changerRacine(PORTABLE);
    await laisser();
    assert.equal(prise, true, 'la relecture du changement de racine est partie');
    const choix = seance.choisirPiedTechnolibre(false);
    await laisser();
    liberer();
    await changement;
    assert.equal(seance.etat().piedTechnolibre, false);
    assert.deepEqual(await choix, { retenu: true, avertissements: [] });
    await seance.attendre();
    assert.deepEqual([caseLue(fs, PORTABLE.id), seance.etat().piedTechnolibre], [false, false]);
  });

  test('la planche suit la case : cochée, l’annonce porte le pied TechnoLibre et ses retraits ; décochée, ni l’un ni l’autre', async () => {
    const { seance } = await ouvertSur(chargeRetenue(), avecPlanche);
    const cochee = await seance.preparerPlanche();
    assert.deepEqual([cochee.refus, cochee.piedTechnolibre, cochee.sansTechnolibre], [null, true, 0]);
    await seance.choisirPiedTechnolibre(false);
    const decochee = await seance.preparerPlanche();
    assert.deepEqual([decochee.refus, decochee.piedTechnolibre, decochee.sansTechnolibre], [null, false, null]);
  });

  test('sans le chargement du logo, une planche qui demande le pied TechnoLibre lève TypeError ; décochée, elle n’en a pas besoin ; le logo se charge une fois par séance', async () => {
    const fs = creerFichiersSimules();
    await deposerEssai(fs, chargeRetenue());
    const sansLogo = monter({ fs, logo: null, ...avecPlanche }).seance;
    await sansLogo.ouvrir(EVT);
    await assert.rejects(sansLogo.preparerPlanche(), (erreur) => erreur instanceof TypeError && /logo/.test(erreur.message));
    await sansLogo.choisirPiedTechnolibre(false);
    assert.equal((await sansLogo.preparerPlanche()).refus, null);

    let chargements = 0;
    const logo = async () => {
      chargements += 1;
      if (chargements === 1) throw new Error('logo illisible');
      return lireLogo();
    };
    const fsBis = creerFichiersSimules();
    await deposerEssai(fsBis, chargeRetenue());
    const { seance } = monter({ fs: fsBis, prefixe: 'logo', logo, ...avecPlanche });
    await seance.ouvrir(EVT);
    await assert.rejects(seance.preparerPlanche(), /logo illisible/);
    await seance.preparerPlanche();
    await seance.preparerPlanche();
    assert.equal(chargements, 2);
  });
});

describe('séance : les cases de ce que le badge imprime (§ 8.5, § 11.4)', () => {
  const casesLues = (fs, racine = 'documents') => JSON.parse(fs.contenu(racine, FICHIER_REGLAGES)).donnees_badge;
  const TOUTES = { organisation: true, evenement: true, date: true, horodatage: true, identifiant: true };
  const PLAN_RETENU = [{ sieges: [[1, 2]] }];
  const chargeRetenue = () =>
    soiree({
      personnes: [personneBadge(1, 'Iris', 'Ombrelle'), personneBadge(2, 'Théo', 'Pervenche')],
      tables: [tableBadge(1, 1, 2)],
      plan: PLAN_RETENU,
      propositions: [[1, PLAN_RETENU]],
    });
  const avecPlanche = { polices: async () => lirePolices(), provenance: 'production' };

  test('toutes cochées au départ ; choisirDonneeBadge écrit les seuls réglages, dans tout mode, et l’état la porte ; une séance neuve les relit', async () => {
    const { fs, seance } = await ouvertSur(chargeBloquee());
    assert.deepEqual(seance.etat().donneesBadge, TOUTES);
    const avant = fs.compteurs.ecritures;
    assert.deepEqual(await seance.choisirDonneeBadge('organisation', false), { retenu: true, avertissements: [] });
    assert.deepEqual(await seance.choisirDonneeBadge('horodatage', false), { retenu: true, avertissements: [] });
    assert.equal(fs.compteurs.ecritures, avant + 2);
    assert.deepEqual(casesLues(fs), { horodatage: false, organisation: false });
    assert.deepEqual(seance.etat().donneesBadge, { ...TOUTES, organisation: false, horodatage: false });
    const neuve = monter({ fs, prefixe: 'neuve' });
    await neuve.seance.attendre();
    assert.deepEqual(neuve.seance.etat().donneesBadge, { ...TOUTES, organisation: false, horodatage: false });
    await neuve.seance.choisirDonneeBadge('organisation', true);
    assert.deepEqual(casesLues(fs), { horodatage: false, organisation: true });
    assert.deepEqual(neuve.seance.etat().donneesBadge, { ...TOUTES, horodatage: false });
  });

  test('une donnée inconnue, ou une valeur qui n’est pas un booléen, est une faute du code : TypeError, rien ne s’écrit et l’état ne change pas', async () => {
    const { fs, seance } = await ouvertSur();
    const avant = fs.compteurs.ecritures;
    for (const [donnee, coche] of [['nom', false], ['tours', false], ['date', 'false'], ['identifiant', 0], ['evenement', null]]) {
      await assert.rejects(seance.choisirDonneeBadge(donnee, coche), TypeError, `${donnee} ${coche}`);
    }
    assert.equal(fs.compteurs.ecritures, avant);
    assert.deepEqual(seance.etat().donneesBadge, TOUTES);
  });

  test('des réglages illisibles : la case vaut pour la séance, non retenue, l’avis rendu, le fichier intact', async () => {
    const texte = '{"format":1,"papier":"A4","cadr';
    const fs = creerFichiersSimules();
    fs.deposerDossier('documents');
    fs.deposer('documents', FICHIER_REGLAGES, texte);
    const { seance } = await ouvertSur(chargeEssai(), { fs });
    const avis = { code: 'REGLAGES_ILLISIBLES', details: { chemin: FICHIER_REGLAGES, raison: 'JSON' } };
    assert.deepEqual(await seance.choisirDonneeBadge('date', false), { retenu: false, avertissements: [avis] });
    assert.deepEqual(seance.etat().donneesBadge, { ...TOUTES, date: false });
    assert.equal(fs.contenu('documents', FICHIER_REGLAGES), texte);
  });

  test('au changement de racine : chaque case que les réglages portent, à défaut celle de la séance', async () => {
    const fs = creerFichiersSimules({ executable: 'E:\\soirees' });
    fs.deposerDossier('documents');
    fs.deposer('documents', FICHIER_REGLAGES, '{"cadrages":[],"donnees_badge":{"evenement":false},"format":1,"papier":null}\n');
    const { seance } = monter({ fs, racine: null });
    await seance.changerRacine(DOC);
    assert.deepEqual(seance.etat().donneesBadge, { ...TOUTES, evenement: false });
    fs.deposerDossier(PORTABLE.id);
    await seance.changerRacine(PORTABLE);
    assert.deepEqual(seance.etat().donneesBadge, { ...TOUTES, evenement: false }, 'une racine sans réglages');
    fs.deposer(PORTABLE.id, FICHIER_REGLAGES, '{"format":1,"papier":"A4","cadr');
    await seance.changerRacine(PORTABLE);
    assert.deepEqual(seance.etat().donneesBadge, { ...TOUTES, evenement: false }, 'des réglages illisibles');
    fs.deposer(PORTABLE.id, FICHIER_REGLAGES, '{"cadrages":[],"donnees_badge":{"identifiant":false},"format":1,"papier":null}\n');
    await seance.changerRacine(PORTABLE);
    assert.deepEqual(seance.etat().donneesBadge, { ...TOUTES, evenement: false, identifiant: false }, 'une case absente garde celle de la séance');
    fs.deposer(PORTABLE.id, FICHIER_REGLAGES, '{"cadrages":[],"donnees_badge":{"evenement":true},"format":1,"papier":null}\n');
    await seance.changerRacine(PORTABLE);
    assert.deepEqual(seance.etat().donneesBadge, { ...TOUTES, identifiant: false }, 'une case écrite sur la racine l’emporte');
  });

  test('une relecture des réglages partie avant un choix d’une case ne l’écrase pas, ni dans l’état ni dans le fichier', async () => {
    const { fs, seance } = monter({ fs: creerFichiersSimules({ executable: 'E:\\soirees' }) });
    await seance.attendre();
    fs.deposerDossier(PORTABLE.id);
    fs.deposer(PORTABLE.id, FICHIER_REGLAGES, '{"cadrages":[],"donnees_badge":{"date":true},"format":1,"papier":null}\n');
    const lireTexte = fs.lireTexte;
    let liberer = null;
    const retenue = new Promise((resolve) => {
      liberer = resolve;
    });
    let prise = false;
    fs.lireTexte = async (racine, chemin) => {
      if (prise || chemin !== FICHIER_REGLAGES) return lireTexte(racine, chemin);
      prise = true;
      const reponse = await lireTexte(racine, chemin);
      await retenue;
      return reponse;
    };
    const changement = seance.changerRacine(PORTABLE);
    await laisser();
    assert.equal(prise, true, 'la relecture du changement de racine est partie');
    const choix = seance.choisirDonneeBadge('date', false);
    await laisser();
    liberer();
    await changement;
    assert.deepEqual(seance.etat().donneesBadge, { ...TOUTES, date: false });
    assert.deepEqual(await choix, { retenu: true, avertissements: [] });
    await seance.attendre();
    assert.deepEqual([casesLues(fs, PORTABLE.id), seance.etat().donneesBadge], [{ date: false }, { ...TOUTES, date: false }]);
  });

  test('la planche lit les cases de la séance : l’annonce les porte, toutes cochées puis la date du placement décochée', async () => {
    const { seance } = await ouvertSur(chargeRetenue(), avecPlanche);
    await seance.choisirPiedTechnolibre(false);
    assert.deepEqual((await seance.preparerPlanche()).donneesBadge, TOUTES);
    await seance.choisirDonneeBadge('horodatage', false);
    const annonce = await seance.preparerPlanche();
    assert.deepEqual([annonce.refus, annonce.donneesBadge], [null, { ...TOUTES, horodatage: false }]);
  });
});

describe('séance : le texte du pied TechnoLibre (§ 8.5, § 11.4)', () => {
  // Le texte que les réglages de la racine portent ; undefined sans la clé.
  const texteLu = (fs, racine = 'documents') => JSON.parse(fs.contenu(racine, FICHIER_REGLAGES)).texte_pied_technolibre;
  const CHOISI = 'Atelier coopératif des Hérons cendrés';
  const PLAN_RETENU = [{ sieges: [[1, 2]] }];
  const chargeRetenue = () =>
    soiree({
      personnes: [personneBadge(1, 'Iris', 'Ombrelle'), personneBadge(2, 'Théo', 'Pervenche')],
      tables: [tableBadge(1, 1, 2)],
      plan: PLAN_RETENU,
      propositions: [[1, PLAN_RETENU]],
    });
  const avecPlanche = { polices: async () => lirePolices(), provenance: 'production' };

  test('la phrase d’origine, que l’interface lit ici, avec la normalisation du stockage', () => {
    assert.equal(TEXTE_PIED_TECHNOLIBRE_DEFAUT, libelle('planche.technolibre'));
    assert.equal(normaliserTextePied(` ${CHOISI}\n`), CHOISI);
  });

  test('la phrase d’origine au départ ; choisirTextePiedTechnolibre écrit le texte normalisé dans les seuls réglages, dans tout mode, et l’état le porte ; une séance neuve le relit ; la phrase d’origine choisie retire la clé', async () => {
    const { fs, seance } = await ouvertSur(chargeBloquee());
    assert.equal(seance.etat().textePiedTechnolibre, TEXTE_PIED_TECHNOLIBRE_DEFAUT);
    const avant = fs.compteurs.ecritures;
    assert.deepEqual(await seance.choisirTextePiedTechnolibre(`  ${CHOISI}\n\n`), { retenu: true, avertissements: [] });
    assert.equal(fs.compteurs.ecritures, avant + 1);
    assert.deepEqual([texteLu(fs), seance.etat().textePiedTechnolibre], [CHOISI, CHOISI]);
    const neuve = monter({ fs, prefixe: 'neuve' });
    await neuve.seance.attendre();
    assert.equal(neuve.seance.etat().textePiedTechnolibre, CHOISI);
    assert.deepEqual(await neuve.seance.choisirTextePiedTechnolibre(''), { retenu: true, avertissements: [] });
    assert.deepEqual([texteLu(fs), neuve.seance.etat().textePiedTechnolibre], ['', '']);
    assert.deepEqual(await neuve.seance.choisirTextePiedTechnolibre(`${TEXTE_PIED_TECHNOLIBRE_DEFAUT} `), { retenu: true, avertissements: [] });
    assert.equal(Object.hasOwn(JSON.parse(fs.contenu('documents', FICHIER_REGLAGES)), 'texte_pied_technolibre'), false);
    assert.equal(neuve.seance.etat().textePiedTechnolibre, TEXTE_PIED_TECHNOLIBRE_DEFAUT);
  });

  test('une valeur qui n’est pas une chaîne est une faute du code : TypeError, rien ne s’écrit et l’état ne change pas', async () => {
    const { fs, seance } = await ouvertSur();
    const avant = fs.compteurs.ecritures;
    for (const faute of [null, undefined, 3, true, ['texte']]) {
      await assert.rejects(seance.choisirTextePiedTechnolibre(faute), TypeError, String(faute));
    }
    assert.equal(fs.compteurs.ecritures, avant);
    assert.equal(seance.etat().textePiedTechnolibre, TEXTE_PIED_TECHNOLIBRE_DEFAUT);
  });

  test('des réglages illisibles : le texte vaut pour la séance, non retenu, l’avis rendu, le fichier intact', async () => {
    const texte = '{"format":1,"papier":"A4","cadr';
    const fs = creerFichiersSimules();
    fs.deposerDossier('documents');
    fs.deposer('documents', FICHIER_REGLAGES, texte);
    const { seance } = await ouvertSur(chargeEssai(), { fs });
    const avis = { code: 'REGLAGES_ILLISIBLES', details: { chemin: FICHIER_REGLAGES, raison: 'JSON' } };
    assert.deepEqual(await seance.choisirTextePiedTechnolibre(CHOISI), { retenu: false, avertissements: [avis] });
    assert.equal(seance.etat().textePiedTechnolibre, CHOISI);
    assert.equal(fs.contenu('documents', FICHIER_REGLAGES), texte);
  });

  test('l’écriture garde la case, le papier et les clés inconnues ; choisir la case garde le texte', async () => {
    const fs = creerFichiersSimules();
    fs.deposerDossier('documents');
    fs.deposer('documents', FICHIER_REGLAGES, '{"cadrages":[],"format":1,"papier":"A4","zeta":true}\n');
    const { seance } = monter({ fs });
    await seance.attendre();
    await seance.choisirTextePiedTechnolibre(CHOISI);
    await seance.choisirPiedTechnolibre(false);
    assert.equal(
      fs.contenu('documents', FICHIER_REGLAGES),
      `{"cadrages":[],"format":1,"papier":"A4","pied_technolibre":false,"texte_pied_technolibre":"${CHOISI}","zeta":true}\n`,
    );
  });

  test('au changement de racine : le texte que les réglages portent, normalisé ; des réglages lus sans la clé, la phrase d’origine ; des réglages illisibles, celui de la séance', async () => {
    const fs = creerFichiersSimules({ executable: 'E:\\soirees' });
    fs.deposerDossier('documents');
    fs.deposer('documents', FICHIER_REGLAGES, `{"cadrages":[],"format":1,"papier":null,"texte_pied_technolibre":" ${CHOISI}\\n"}\n`);
    const { seance } = monter({ fs, racine: null });
    await seance.changerRacine(DOC);
    assert.equal(seance.etat().textePiedTechnolibre, CHOISI);
    fs.deposerDossier(PORTABLE.id);
    await seance.changerRacine(PORTABLE);
    assert.equal(seance.etat().textePiedTechnolibre, TEXTE_PIED_TECHNOLIBRE_DEFAUT, 'une racine sans réglages');
    await seance.changerRacine(DOC);
    fs.deposer(PORTABLE.id, FICHIER_REGLAGES, '{"format":1,"papier":"A4","cadr');
    await seance.changerRacine(PORTABLE);
    assert.equal(seance.etat().textePiedTechnolibre, CHOISI, 'des réglages illisibles');
    // Les réglages tels que « Texte par défaut » les écrit : la case, sans la clé.
    fs.deposer(PORTABLE.id, FICHIER_REGLAGES, '{"cadrages":[],"format":1,"papier":null,"pied_technolibre":true}\n');
    await seance.changerRacine(PORTABLE);
    assert.equal(seance.etat().textePiedTechnolibre, TEXTE_PIED_TECHNOLIBRE_DEFAUT, 'la phrase d’origine remise sur la racine');
    fs.deposer(PORTABLE.id, FICHIER_REGLAGES, '{"cadrages":[],"format":1,"papier":null,"texte_pied_technolibre":""}\n');
    await seance.changerRacine(PORTABLE);
    assert.equal(seance.etat().textePiedTechnolibre, '', 'un texte écrit sur la racine l’emporte');
  });

  test('une relecture des réglages partie avant un choix du texte ne l’écrase pas, ni dans l’état ni dans le fichier', async () => {
    const { fs, seance } = monter({ fs: creerFichiersSimules({ executable: 'E:\\soirees' }) });
    await seance.attendre();
    fs.deposerDossier(PORTABLE.id);
    fs.deposer(PORTABLE.id, FICHIER_REGLAGES, '{"cadrages":[],"format":1,"papier":null,"texte_pied_technolibre":"Ancien texte"}\n');
    const lireTexte = fs.lireTexte;
    let liberer = null;
    const retenue = new Promise((resolve) => {
      liberer = resolve;
    });
    let prise = false;
    fs.lireTexte = async (racine, chemin) => {
      if (prise || chemin !== FICHIER_REGLAGES) return lireTexte(racine, chemin);
      prise = true;
      const reponse = await lireTexte(racine, chemin);
      await retenue;
      return reponse;
    };
    const changement = seance.changerRacine(PORTABLE);
    await laisser();
    assert.equal(prise, true, 'la relecture du changement de racine est partie');
    const choix = seance.choisirTextePiedTechnolibre(CHOISI);
    await laisser();
    liberer();
    await changement;
    assert.equal(seance.etat().textePiedTechnolibre, CHOISI);
    assert.deepEqual(await choix, { retenu: true, avertissements: [] });
    await seance.attendre();
    assert.deepEqual([texteLu(fs, PORTABLE.id), seance.etat().textePiedTechnolibre], [CHOISI, CHOISI]);
  });

  test('la planche lit le texte de la séance : l’annonce le porte, la phrase d’origine puis le texte choisi', async () => {
    const { seance } = await ouvertSur(chargeRetenue(), avecPlanche);
    assert.equal((await seance.preparerPlanche()).textePiedTechnolibre, TEXTE_PIED_TECHNOLIBRE_DEFAUT);
    await seance.choisirTextePiedTechnolibre(CHOISI);
    const annonce = await seance.preparerPlanche();
    assert.deepEqual([annonce.refus, annonce.textePiedTechnolibre, annonce.sansTechnolibre], [null, CHOISI, 0]);
  });
});
