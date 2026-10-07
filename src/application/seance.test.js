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
import { rechercher } from '../moteur/recherche.js';
import { serialiser } from '../stockage/canonique.js';
import { creer as creerDansLeDepot, ouvrir as ouvrirDansLeDepot } from '../stockage/depot.js';
import { analyser, configurationDepuisCharge, creerCharge, etatDeduit } from '../stockage/document.js';
import { ErreurStockage } from '../stockage/erreurs.js';
import { ligneEntree, ligneOuverture, lireJournal, reconstruire } from '../stockage/journal.js';
import { SUFFIXES } from '../stockage/noms.js';
import { VERSION } from '../version.genere.js';
import { libelle } from './libelles.js';
import { INACTIVITE_MS, creerSeance } from './seance.js';

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
function monter({ fs = creerFichiersSimules(), racine = DOC, prefixe = 'seance', inactiviteMs } = {}) {
  fs.deposerDossier(racine.id);
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
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'MODE_LECTURE', {});
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
    await refus(second.seance.passerEnEcriture(), 'VERROU_PRIS', details);
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
    await refus(lointain.seance.passerEnEcriture(), 'VERROU_PRIS', { seance: 'premiere-1', depuis, vivant: null });
    premier.fs.deposer('documents', VERROU, 'pas un verrou\n');
    const voisin = monter({ fs: creerFichiersSimules({ disque }), prefixe: 'voisine' });
    await ouvrirSansEcrire(voisin);
    await refus(voisin.seance.passerEnEcriture(), 'VERROU_PRIS', { seance: null, depuis: null, vivant: null });
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
    assert.deepEqual(rendu, { libelle: 'Ajouté Iris Ombrelle', avertissements: [] });
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

  test("un import est une seule entrée ; il n'avertit pas en brouillon, et porte l'avertissement de dérive en retenu (§ 10.1)", async () => {
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
    assert.deepEqual(rendu.avertissements, []);
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
    assert.deepEqual(enRetenu.avertissements, [{ code: 'IMPORT_EN_RETENU', details: {} }]);
    assert.deepEqual(seance.avertissements, enRetenu.avertissements);
  });

  test("importer sur un plan bloqué est refusé, et le texte du refus nomme « Débloquer »", async () => {
    const montage = monter();
    const { fs, seance } = montage;
    await enEcriture(montage);
    await seance.executer('changerEtat', { etat: 'bloque' });
    const avant = fs.compteurs.ecritures;
    const apercu = apercevoir('nom\nAncolie\n', { participants: [] });
    const erreur = await refus(seance.executer('importerParticipants', { apercu, mode: 'ajouter' }), 'LECTURE_SEULE', { raison: 'BLOQUE' });
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
    assert.deepEqual(etatDe(fs).charge, reconstruire(journal, 2));
    assert.deepEqual(reconstruire(journal, 7), reconstruire(journal, 2));
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
    await refus(seance.revenir(3), 'INSTANT_NON_RESTITUABLE', { revision: 3 });
    await refus(seance.revenir(11), 'INSTANT_NON_RESTITUABLE', { revision: 11 });
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
      const bloque = { raison: 'BLOQUE' };
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
    await refus(seance.debloquer(), 'VERROU_PRIS', { seance: 'lointaine-1', depuis, vivant: null });
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
    const format = { raison: 'FORMAT' };
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
  async function surPortable() {
    const fs = creerFichiersSimules({ executable: 'E:\\soirees' });
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
    await refus(seance.executer('ajouterParticipant', { champs: { nom: 'Bruyère' } }), 'SUPPORT_ROMPU', refusSupport);
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
    await refus(seance.passerEnEcriture(), 'SUPPORT_ROMPU', refusSupport);
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
    await refus(seance.passerEnEcriture(), 'SUPPORT_ROMPU', refusSupport);
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
    for (const fichier of ['seance.js', 'commandes.js', 'libelles.js']) {
      const texte = code(readFileSync(new URL(`./${fichier}`, import.meta.url), 'utf8'));
      assert.ok(texte.trim().length > 0, `${fichier} vide`);
      for (const motif of [/\bDate\b/, /\bsetTimeout\b/, /\bsetInterval\b/, /\bclearTimeout\b/, /\bperformance\b/, /\bMath\s*\.\s*random\b/, /\bcrypto\b/]) {
        assert.doesNotMatch(texte, motif, `${fichier} : ${motif}`);
      }
    }
  });
});
