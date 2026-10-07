// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de la séance (§ 2.1, § 8.1 à § 8.6, § 8.8, § 9, § 10.1), toutes sur
// le système de fichiers d'épreuve, qui compte ses écritures, avec une
// horloge et un planificateur factices : rien n'attend le temps réel. Une
// ouverture n'écrit rien ; un geste écrit une entrée puis un état ; un refus
// n'écrit rien ; le verrou se prend à l'entrée en écriture et se rend au
// retour en lecture, explicite ou après l'inactivité ; le support qui rompt
// se remplace par un autre dossier. Les noms d'épreuve sont inventés ; la
// version vient du module engendré.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creerFichiersSimules } from '../../test/fichiers_simules.js';
import { describe, test } from '../../test/lanceur.js';
import { apercevoir } from '../csv/apercu.js';
import { nombrePlacesManquantes, normaliser } from '../moteur/configuration.js';
import { rechercher } from '../moteur/recherche.js';
import { serialiser } from '../stockage/canonique.js';
import { creer as creerDansLeDepot, ouvrir as ouvrirDansLeDepot } from '../stockage/depot.js';
import { FORMAT, analyser, configurationDepuisCharge, creerCharge, etatDeduit } from '../stockage/document.js';
import { ErreurStockage } from '../stockage/erreurs.js';
import { ligneEntree, ligneOuverture, lireJournal, reconstruire } from '../stockage/journal.js';
import { SUFFIXES } from '../stockage/noms.js';
import { FICHIER_REGLAGES } from '../stockage/reglages_locaux.js';
import { VERSION } from '../version.genere.js';
import { libelle } from './libelles.js';
import { DELAI_REGLAGES_MS, INACTIVITE_MS, creerSeance } from './seance.js';

const V1 = VERSION.affichee;

const DOCUMENTS = 'C:\\Users\\Exemple\\Documents\\Gestion table tournante Libre';
const DOC = { id: 'documents', chemin: DOCUMENTS };
const PORTABLE = { id: 'portable', chemin: 'E:\\soirees\\data' };

const BASE = 'Soirée des Lucioles';
const ETAT = `${BASE}${SUFFIXES.etat}`;
const JOURNAL = `${BASE}${SUFFIXES.journal}`;
const VERROU = `${BASE}${SUFFIXES.verrou}`;
const CREATION = "Création de l'événement « Soirée des Lucioles »";

// --- Le montage -------------------------------------------------------------

const deux = (valeur) => String(valeur).padStart(2, '0');

// Horloge d'épreuve : une minute de plus à chaque lecture, à partir de 8 h le
// 17 mai 2031, à l'heure de l'Est.
function creerHorloge() {
  let n = 0;
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
// formatCourant, delaiReglagesMs. Une racine null crée la séance sans
// dossier de travail.
function monter({ fs = creerFichiersSimules(), racine = DOC, prefixe = 'seance', inactiviteMs, ...options } = {}) {
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

const personne = (id, nom, prenom = null, appartenance = null) => ({
  id,
  nom,
  prenom,
  appartenance,
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
const journalDe = (fs, racine = 'documents', base = BASE) => lireJournal(fs.contenu(racine, `${base}${SUFFIXES.journal}`));
const etatDe = (fs, racine = 'documents', base = BASE) => analyser(fs.contenu(racine, `${base}${SUFFIXES.etat}`));
const libellesDe = (journal) => journal.entrees.map((entree) => entree.libelle);
const verrouDe = (fs, racine = 'documents') => {
  const texte = fs.contenu(racine, VERROU);
  return texte === null ? null : JSON.parse(texte);
};
const noms = (charge) => charge.participants.map(({ nom }) => nom);

// Ouvre base par la séance d'un montage qui ne tient aucun verrou, et
// constate qu'ouvrir n'écrit rien (§ 8.4).
async function ouvrirSansEcrire({ fs, seance }, base = BASE) {
  const avant = fs.compteurs.ecritures;
  const rendu = await seance.ouvrir(base);
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

// Les refus de lecture seule de la séance, remède compris (A2).
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
    assert.equal(fs.compteurs.ecritures - avant, 2);
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
    assert.equal(fs.contenu('documents', `Soirée des Hiboux${SUFFIXES.verrou}`), null);
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
    const { base, avertissements } = await seance.ouvrir(BASE);
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

  test("ouvrir un secours n'écrit rien et laisse en lecture", async () => {
    const disque = new Map();
    const premier = monter({ fs: creerFichiersSimules({ disque }) });
    await enEcriture(premier);
    await premier.seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } });
    await premier.seance.fermer();
    const second = monter({ fs: creerFichiersSimules({ disque }), prefixe: 'seconde' });
    const avant = second.fs.compteurs.ecritures;
    await second.seance.ouvrirSecours(BASE, 'precedent');
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
    await seance.ouvrir('Soirée des Hiboux');
    assert.equal(fs.compteurs.ecritures - avant, 1);
    assert.equal(verrouDe(fs), null);
    assert.deepEqual([seance.mode, seance.charge.evenement.nom], ['lecture', 'Soirée des Hiboux']);
  });

  test("un événement qui ne s'ouvre pas laisse la séance sans événement, le précédent fermé", async () => {
    const montage = monter();
    await enEcriture(montage);
    const avant = montage.fs.compteurs.ecritures;
    await refus(montage.seance.ouvrir('Soirée absente'), 'ABSENT');
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
    assert.deepEqual(seance.retours, { defaire: false, refaire: false });
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
    const nonPlace = [{ code: 'PARTICIPANT_NON_PLACE', participant: 8 }];
    assert.deepEqual(enRetenu.avertissements, [
      { code: 'IMPORT_EN_RETENU', details: {} },
      { code: 'PLACES_MANQUANTES', details: { placesManquantes: 1 } },
      {
        code: 'DERIVE_NOUVELLE',
        details: { touchees: [{ id: 1, raisons: nonPlace }, { id: 2, raisons: nonPlace }, { id: 'retenu', raisons: nonPlace }] },
      },
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
    assert.deepEqual(codesDe(exclusion.avertissements), ['DERIVE_NOUVELLE']);
    assert.deepEqual(seance.avertissements.map(({ code }) => code), ['DERIVE', 'DERIVE_NOUVELLE']);
    assert.deepEqual(seance.avertissements, [...seance.ouvert.avertissements, ...exclusion.avertissements]);
    assert.equal(seance.avertissements[0].details.retenu, true);
    await seance.executer('reintegrerParticipant', { id: 2 });
    assert.deepEqual(seance.avertissements, []);
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
    assert.deepEqual((await fs.lister(DOC, '')).map(({ nom }) => nom), []);
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
    await seconde.ouvrir(BASE);
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
    await seconde.ouvrir(BASE);
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
    await seance.ouvrirSecours(BASE, 'journal');
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
    for (const seance of [premiere, seconde]) await seance.ouvrirSecours(BASE, 'precedent');
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
    await seance.ouvrirSecours(BASE, 'precedent');
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
    await seance.ouvrirSecours(BASE, 'precedent');
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
    await seance.ouvrirSecours(BASE, 'precedent');
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
    await seance.ouvrirSecours(BASE, 'precedent');
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
    await seance.ouvrirSecours(BASE, 'precedent');
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
  // première ligne du journal, déclarent le format 2.
  const plusRecent = {
    etat: (fs) => fs.deposer('documents', ETAT, fs.contenu('documents', ETAT).replace('"format":1', '"format":2')),
    journal: (fs) => fs.deposer('documents', JOURNAL, fs.contenu('documents', JOURNAL).replace('"format":1', '"format":2')),
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
        const precedent = fs.contenu('documents', `${BASE}${SUFFIXES.precedent}`);
        fs.deposer('documents', ETAT, precedent.replace('"format":1', '"format":2'));
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
      await seconde.ouvrir(BASE);
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
    await seconde.ouvrir(BASE);
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
      const illisible = await refus(seance.ouvrir(BASE), 'ETAT_ILLISIBLE');
      assert.equal(illisible.details.raison, 'ENCODAGE');
      assert.match(libelle(illisible.code, illisible.details), /UTF-8/);
      await seance.ouvrirSecours(BASE, source);
      assert.equal(seance.ouvert.etatMalEncode, true);
      assert.deepEqual(await seance.passerEnEcriture(), { avertissements: [] });
      await seance.executer('ajouterParticipant', { champs: { nom: 'Cerfeuil' } });
      const [dossier] = (await fs.lister(DOC, 'corbeille')).map(({ nom }) => nom);
      assert.deepEqual(fs.octets('documents', `corbeille/${dossier}/${ETAT}`), octets);
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
    assert.deepEqual(seance.retours, { defaire: true, refaire: false });
    const avant = fs.compteurs.ecritures;
    await refus(seance.refaire(), 'RIEN_A_REFAIRE');
    assert.equal(fs.compteurs.ecritures, avant);
    await seance.defaire();
    await seance.defaire();
    assert.deepEqual(seance.retours, { defaire: true, refaire: true });
    await seance.refaire();
    assert.deepEqual(noms(seance.charge), ['Ancolie', 'Bruyère']);
    await seance.executer('ajouterParticipant', { champs: { nom: 'Dauphinelle' } });
    assert.deepEqual(seance.retours, { defaire: true, refaire: false });
    await refus(seance.refaire(), 'RIEN_A_REFAIRE');
  });

  test("rien à défaire au premier instant", async () => {
    const montage = monter();
    await enEcriture(montage);
    assert.deepEqual(montage.seance.retours, { defaire: false, refaire: false });
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
    assert.deepEqual(seance.retours, { defaire: true, refaire: false });
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
    assert.deepEqual(seance.retours, { defaire: false, refaire: true });
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
    assert.deepEqual(seance.retours, { defaire: false, refaire: false });
    await refus(seance.defaire(), 'RIEN_A_DEFAIRE');
    await seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } });
    assert.deepEqual(
      journalDe(fs).entrees.map(({ revision, libelle: texte }) => [revision, texte]),
      [
        [3, "Reprise de l'état trouvé sur le disque"],
        [4, 'Ajouté Ancolie'],
      ],
    );
    assert.deepEqual(seance.retours, { defaire: true, refaire: false });
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
    fs.deposer('documents', ETAT, serialiser(charge, { revision: 1, produitVersion: V1 }).replace('"format":1', '"format":2'));
    const { seance } = monter({ fs });
    const avant = fs.compteurs.ecritures;
    await seance.ouvrir(BASE);
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
    const refusSupport = { echec: 'ECRITURE', chemin: JOURNAL, dossier: PORTABLE.chemin, cause: 'EROFS' };
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
      { code: 'VERROU_NON_RENDU', details: { chemin: VERROU, dossier: PORTABLE.chemin, cause: 'EROFS' } },
    ]);
    assert.deepEqual([seance.supportRompu, seance.refusSupport, seance.mode], [false, null, 'ecriture']);
    assert.deepEqual(seance.racine, DOC);
    assert.equal(verrouDe(fs).seance, seance.id);
    await seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } });
    assert.deepEqual(libellesDe(journalDe(fs)), [CREATION, 'Ajouté Ancolie', 'Ajouté Bruyère']);
    assert.deepEqual(noms(etatDe(fs).charge), ['Ancolie', 'Bruyère']);
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
    const refusSupport = { chemin: JOURNAL, dossier: DOCUMENTS, cause: 'EROFS' };
    const rendu = await seance.executer('changerEtat', { etat: 'bloque' });
    assert.deepEqual(rendu, {
      libelle: "Plan passé à l'état « Bloqué »",
      avertissements: [
        { code: 'JALON_NON_ECRIT', details: refusSupport },
        { code: 'VERROU_NON_RENDU', details: { chemin: VERROU, dossier: DOCUMENTS, cause: 'EROFS' } },
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
    const details = { chemin: VERROU, dossier: PORTABLE.chemin, cause: 'EROFS' };
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
    const details = { chemin: VERROU, dossier: PORTABLE.chemin, cause: 'EROFS' };
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
    const details = { chemin: VERROU, dossier: DOCUMENTS, cause: 'EACCES' };
    const verrouiller = fs.verrouiller;
    fs.verrouiller = async (racine, chemin, jeton) => {
      if (racine.id === 'documents') throw new ErreurStockage('ECRITURE', details);
      return verrouiller(racine, chemin, jeton);
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
    const erreur = await refus(seance.ecrireAilleurs(DOC), 'IDENTIFIANT_PRESENT', { id, base: BASE });
    assert.equal(fs.compteurs.ecritures, avant);
    assert.deepEqual([seance.supportRompu, seance.racine], [true, DOC]);
    const etats = (await fs.lister(DOC, '')).filter(({ nom }) => nom.endsWith(SUFFIXES.etat)).map(({ nom }) => nom);
    assert.deepEqual(etats, [ETAT]);
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
    const refusSupport = { echec: 'ETAT_NON_ECRIT', chemin: ETAT, dossier: DOCUMENTS, cause: 'EBUSY' };
    assert.deepEqual([seance.mode, seance.supportRompu, seance.refusSupport], ['lecture', true, refusSupport]);
    assert.deepEqual(seance.avertissements, [
      { code: 'VERROU_NON_RENDU', details: { chemin: VERROU, dossier: PORTABLE.chemin, cause: 'EROFS' } },
    ]);
    assert.deepEqual(noms(seance.charge), ['Ancolie']);
    assert.deepEqual(libellesDe(journalDe(fs)), [CREATION, 'Ajouté Ancolie']);
    assert.equal(fs.contenu('documents', ETAT), null);
    const avant = fs.compteurs.ecritures;
    await refus(seance.ecrireAilleurs(DOC), 'IDENTIFIANT_PRESENT', { id, base: BASE });
    await refus(seance.ecrireAilleurs(PORTABLE), 'IDENTIFIANT_PRESENT', { id, base: BASE });
    assert.equal(fs.compteurs.ecritures, avant);
    const fichiers = (await fs.lister(DOC, '')).map(({ nom }) => nom);
    assert.deepEqual(fichiers, [JOURNAL]);
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
    const illisible = await refus(seance.ouvrir(BASE), 'ETAT_ILLISIBLE');
    assert.deepEqual([illisible.details.raison, illisible.details.secours], ['JSON', { precedent: null, journal: 1 }]);
    await seance.ouvrirSecours(BASE, 'journal');
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
    await refus(seance.ecrireAilleurs(DOC), 'IDENTIFIANT_PRESENT', { id, base: BASE });
    assert.equal(fs.compteurs.ecritures, avant);
    assert.deepEqual(await fichiersDe(fs, DOC), fichiers);
    assert.deepEqual([seance.supportRompu, seance.racine], [true, DOC]);
    const illisible = await refus(ouvrirDansLeDepot(fs, DOC, BASE), 'ETAT_ILLISIBLE');
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
    await refus(seance.ecrireAilleurs(DOC), 'IDENTIFIANT_PRESENT', { id, base: BASE });
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
      { code: 'VERROU_NON_RENDU', details: { chemin: VERROU, dossier: PORTABLE.chemin, cause: 'EROFS' } },
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
        { code: 'VERROU_NON_RENDU', details: { chemin: VERROU, dossier: PORTABLE.chemin, cause: 'EROFS' } },
      ]);
      assert.deepEqual(seance.avertissements, avertissements);
      assert.deepEqual([seance.supportRompu, seance.mode, seance.racine, planificateur.actives], [false, 'ecriture', DOC, 1]);
    });
  }

  test("tant que le support est rompu, ouvrir, ouvrir un secours, créer et fermer sont refusés SUPPORT_ROMPU_NON_SAUVE, sans rien changer", async () => {
    const { fs, seance } = await surPortable();
    fs.pannes.ecriture('portable');
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'ECRITURE');
    const refusSupport = { echec: 'ECRITURE', chemin: JOURNAL, dossier: PORTABLE.chemin, cause: 'EROFS' };
    const nonSauve = { ...refusSupport, remede: versRacine(DOC) };
    const avant = fs.compteurs.ecritures;
    await refus(seance.ouvrir(BASE), 'SUPPORT_ROMPU_NON_SAUVE', nonSauve);
    await refus(seance.ouvrirSecours(BASE, 'journal'), 'SUPPORT_ROMPU_NON_SAUVE', nonSauve);
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
    const rendu = await seance.ouvrir(BASE, { abandonner: true });
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
    const secours = await seance.ouvrirSecours(BASE, 'journal', { abandonner: true });
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

// --- La séance observable (A2) -----------------------------------------------

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
  await montage.seance.ouvrir(BASE);
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

describe('séance observable : etat() et subscribe (§ 8.4, A2)', () => {
  test('subscribe appelle aussitôt, puis après ouvrir, passer en écriture, un geste et passer en lecture ; désabonné, plus rien', async () => {
    const fs = creerFichiersSimules();
    await deposerEssai(fs);
    const { seance } = monter({ fs });
    const recus = [];
    const desabonner = seance.subscribe((etat) => recus.push(etat));
    assert.equal(recus.length, 1);
    assert.equal(recus[0], seance.etat());
    assert.equal(recus[0].evenement, null);
    await seance.ouvrir(BASE);
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

  test("l'état porte l'événement, la charge, l'examen, les retours, le calcul en cours ; sans événement, rien", async () => {
    const vide = monter().seance.etat();
    assert.deepEqual(
      [vide.evenement, vide.charge, vide.examen, vide.fautives, vide.avertissements, vide.refus, vide.supportRompu, vide.verrouAutre],
      [null, null, null, [], [], null, null, null],
    );
    assert.deepEqual([vide.mode, vide.retours, vide.calculEnCours, vide.racine], ['lecture', { defaire: false, refaire: false }, false, DOC]);
    const { seance } = await ouvertSur();
    await seance.passerEnEcriture();
    await seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } });
    const etat = seance.etat();
    assert.deepEqual(etat.evenement, { base: BASE, id: 'evt-lucioles', nom: BASE, etat: 'brouillon', revision: 2, annonceFormat: null });
    assert.deepEqual(etat.charge, seance.charge);
    assert.deepEqual(etat.examen, seance.ouvert.examen);
    assert.deepEqual(etat.retours, { defaire: true, refaire: false });
    const recus = [];
    seance.subscribe((suivant) => recus.push(suivant));
    seance.debuterCalcul();
    assert.deepEqual([seance.etat().calculEnCours, recus.at(-1).calculEnCours], [true, true]);
    seance.finirCalcul();
    assert.deepEqual([seance.etat().calculEnCours, recus.at(-1).calculEnCours], [false, false]);
  });
});

describe('séance observable : la racine (§ 8.6, A2)', () => {
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
    await refus(montage.seance.ouvrir(BASE), 'ABSENT');
  });
});

describe('séance observable : la version de format (§ 8.8, § 18.6, A2)', () => {
  test("un fichier d'un format plus récent s'annonce 'plusRecent' ; passer en écriture et un geste sont refusés LECTURE_SEULE FORMAT, remède null, jamais MODE_LECTURE", async () => {
    const fs = creerFichiersSimules();
    deposerAuFormat(fs, FORMAT + 1);
    const { seance } = monter({ fs });
    const avant = fs.compteurs.ecritures;
    await seance.ouvrir(BASE);
    assert.equal(seance.etat().evenement.annonceFormat, 'plusRecent');
    const format = { raison: 'FORMAT', remede: null };
    await refus(seance.passerEnEcriture(), 'LECTURE_SEULE', format);
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } }), 'LECTURE_SEULE', format);
    assert.deepEqual(seance.etat().refus, { code: 'LECTURE_SEULE', details: format });
    assert.equal(fs.compteurs.ecritures, avant);
  });

  test("au format courant, aucune annonce ; formatCourant au-delà, 'plusAncien' sans rien écrire, puis le premier geste écrit au format FORMAT et l'annonce tombe", async () => {
    const courant = await ouvertSur();
    assert.equal(courant.seance.etat().evenement.annonceFormat, null);

    const fs = creerFichiersSimules();
    await deposerEssai(fs);
    const { seance } = monter({ fs, formatCourant: FORMAT + 1 });
    const avant = fs.compteurs.ecritures;
    await seance.ouvrir(BASE);
    assert.equal(seance.etat().evenement.annonceFormat, 'plusAncien');
    assert.equal(fs.compteurs.ecritures, avant);
    await seance.passerEnEcriture();
    assert.equal(seance.etat().evenement.annonceFormat, 'plusAncien', 'le passage en écriture ne convertit rien');
    const entrees = journalDe(fs).entrees.length;
    await seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } });
    assert.equal(journalDe(fs).entrees.length, entrees + 1);
    assert.equal(etatDe(fs).entete.format, FORMAT);
    assert.equal(seance.etat().evenement.annonceFormat, null);
  });
});

describe('séance observable : bloquer et débloquer (§ 8.5, § 9, A2)', () => {
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

describe("séance observable : l'annulation et le retour automatique (§ 8.4, A2)", () => {
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
    await seance.ouvrir(BASE);
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

describe('séance observable : le cadrage (§ 8.5, A2)', () => {
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
      await seance.ouvrir(BASE);
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
    await seance.ouvrir(BASE);
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
    await seance.ouvrir(BASE);
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
    await seance.ouvrir(BASE);
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
      await seance.ouvrir(BASE);
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
    await seance.ouvrir(BASE);
    assert.equal(seance.cadrage(), null);
    assert.ok(!codesDe(seance.etat().avertissements).includes('REGLAGES_ILLISIBLES'));
  });
});

describe("séance observable : les avertissements d'un geste (§ 5.9, § 9, A2)", () => {
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
    const raisons = [{ code: 'PARTICIPANT_EXCLU', participant: 3 }];
    assert.deepEqual(exclusion.avertissements, [
      { code: 'DERIVE_NOUVELLE', details: { touchees: [{ id: 1, raisons }, { id: 2, raisons }, { id: 'retenu', raisons }] } },
    ]);
    const suivant = await seance.executer('modifierParticipant', { id: 4, champs: { nom: 'Lacasse-Ombrelle' } });
    assert.deepEqual(suivant.avertissements, []);
    const autre = await seance.executer('exclureParticipant', { id: 2 });
    const nouvelle = [{ code: 'PARTICIPANT_EXCLU', participant: 2 }];
    assert.deepEqual(autre.avertissements, [
      { code: 'DERIVE_NOUVELLE', details: { touchees: [{ id: 1, raisons: nouvelle }, { id: 2, raisons: nouvelle }, { id: 'retenu', raisons: nouvelle }] } },
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

describe("séance observable : le verrou d'une autre séance (§ 8.8, A2)", () => {
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

describe('séance observable : le support rompu (§ 8.6, § 8.2, A2)', () => {
  // Un événement du disque portable, en écriture, après un premier geste.
  async function surPortable() {
    const fs = creerFichiersSimules({ executable: 'E:\\soirees' });
    const montage = monter({ fs, racine: PORTABLE });
    await enEcriture(montage);
    await montage.seance.executer('ajouterParticipant', { champs: { nom: 'Ancolie' } });
    return montage;
  }
  const rompu = { echec: 'ECRITURE', chemin: JOURNAL, dossier: PORTABLE.chemin, cause: 'EROFS' };
  const versDocuments = { geste: 'ecrireAilleurs', racine: DOC };

  test("une écriture refusée remonte ECRITURE ; supportRompu en garde les champs et la racine documents ; le refus courant et le geste suivant sont SUPPORT_ROMPU, remède écrire ailleurs ; écrire ailleurs rétablit", async () => {
    const { fs, seance } = await surPortable();
    fs.pannes.ecriture('portable');
    const erreur = await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'ECRITURE');
    assert.deepEqual(erreur.details, { chemin: JOURNAL, dossier: PORTABLE.chemin, cause: 'EROFS' });
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
    await refus(seance.ouvrir(BASE), 'SUPPORT_ROMPU_NON_SAUVE', nonSauve);
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

describe('séance observable : le refus courant (§ 2.1, garantie 3, A2)', () => {
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
    await format.seance.ouvrir(BASE);
    const portable = monter({ fs: creerFichiersSimules({ executable: 'E:\\soirees' }), racine: PORTABLE });
    await enEcriture(portable);
    portable.fs.pannes.ecriture('portable');
    await refus(portable.seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'ECRITURE');

    const cas = [
      [lecture, 'MODE_LECTURE', { remede: MODIFIER }],
      [bloque, 'LECTURE_SEULE', { raison: 'BLOQUE', remede: DEBLOQUER }],
      [format, 'LECTURE_SEULE', { raison: 'FORMAT', remede: null }],
      [portable, 'SUPPORT_ROMPU', { ...{ echec: 'ECRITURE', chemin: JOURNAL, dossier: PORTABLE.chemin, cause: 'EROFS' }, remede: { geste: 'ecrireAilleurs', racine: DOC } }],
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

describe('séance observable : fautives et examen (§ 8.9, A2)', () => {
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

describe('séance observable : les invariants du retenu (§ 14.12, § 14.15, A2)', () => {
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
    assert.deepEqual(codesDe(exclusion.avertissements), ['RESERVATIONS_SUSPENDUES', 'DERIVE_NOUVELLE']);
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

describe("séance observable : les textes des codes qu'elle ajoute (§ 14.6, A2)", () => {
  const TRACES_A2 = [/\bundefined\b/, /\bnull\b/, /\bNaN\b/, /\b(?:true|false)\b/, /\[object /];
  const EXEMPLES_A2 = [
    ['RETOUR_AUTOMATIQUE', {}],
    ['INVARIANT_VIOLE', { proposition: 3, violations: [{ code: 'RESERVATION', participant: 2, table: 2, tour: 1 }, { code: 'DOUBLE_PLACE', participant: 4, tour: 2 }] }],
    ['DERIVE_NOUVELLE', { touchees: [{ id: 2, raisons: [{ code: 'PARTICIPANT_EXCLU', participant: 3 }] }, { id: 'retenu', raisons: [{ code: 'TABLE_AJOUTEE', table: 5 }] }] }],
    ['RESERVATION_NON_HONOREE', { participant: 2, table: 2, tour: 1 }],
    ['CONFIGURATION_INCOHERENTE', { code: 'RESERVATION_CONFLIT', details: { participant: 1, tour: 1, tables: [1, 2] } }],
    ['PLACES_MANQUANTES', { placesManquantes: 4 }],
    ['SURRESERVATION', { table: 3, tour: 2, reservees: 9, capacite: 8 }],
  ];

  test('chaque code se compose de ses détails, sans trace de valeur absente', () => {
    assert.equal(EXEMPLES_A2.length, 7);
    for (const [code, details] of EXEMPLES_A2) {
      const texte = libelle(code, details);
      assert.ok(texte.trim().length > 0 && texte !== code, code);
      for (const trace of TRACES_A2) assert.doesNotMatch(texte, trace, `${code} : « ${texte} »`);
    }
  });

  test('le manque dit son nombre ; la surréservation nomme la table, le tour, les réservées et la capacité', () => {
    assert.match(libelle('PLACES_MANQUANTES', { placesManquantes: 1 }), /\b1 place\b/);
    assert.match(libelle('PLACES_MANQUANTES', { placesManquantes: 4 }), /\b4 places\b/);
    const texte = libelle('SURRESERVATION', { table: 3, tour: 2, reservees: 9, capacite: 8 });
    for (const motif of [/identifiant 3\b/, /tour 2\b/, /\b9 personnes\b/, /\b8 places\b/]) assert.match(texte, motif);
  });

  test("la dérive nouvelle nomme le placement et sa raison ; l'invariant nomme la réservation ; la reprise d'un verrou la dit d'une autre séance, d'un poste ou d'un autre", () => {
    const derive = libelle('DERIVE_NOUVELLE', EXEMPLES_A2[2][1]);
    assert.ok(derive.includes(libelle('PARTICIPANT_EXCLU', { participant: 3 })), derive);
    assert.match(derive, /n° 2/);
    assert.match(derive, /retenu/);
    const viole = libelle('INVARIANT_VIOLE', EXEMPLES_A2[1][1]);
    assert.ok(viole.includes(libelle('RESERVATION_NON_HONOREE', { participant: 2, table: 2, tour: 1 })), viole);
    assert.match(viole, /n° 3/);
    for (const details of [{ seance: 's', depuis: null }, { seance: null, depuis: null }]) {
      const repris = libelle('VERROU_REPRIS', details);
      assert.match(repris, /une autre séance/);
      assert.doesNotMatch(repris, /interrompue|ce poste/);
    }
    assert.match(libelle('CONFIGURATION_INCOHERENTE', { code: 'CODE_INVENTE', details: {} }), /« CODE_INVENTE »/);
  });
});
