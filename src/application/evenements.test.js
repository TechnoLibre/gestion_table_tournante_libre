// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de la façade des événements (§ 8.1, § 8.6, § 8.7, § 8.8, § 15,
// § 19.4), toutes sur le système de fichiers d'épreuve, qui compte ses
// lectures et ses écritures, avec l'horloge pilotée. La façade se branche sur
// une séance réelle, que le montage crée sur la racine que reçoit
// changerRacine, comme App la branche ; chaque appel que la façade fait à la
// séance s'inscrit au relevé du montage. Les noms d'épreuve sont inventés ; la
// version vient du module engendré.
import assert from 'node:assert/strict';
import { creerFichiersSimules } from '../../test/fichiers_simules.js';
import { describe, test } from '../../test/lanceur.js';
import { CATALOGUE } from '../demo/catalogue.js';
import { LIVREES, texteLivre } from '../demo/livrees.js';
import { rechercher } from '../moteur/recherche.js';
import { serialiser } from '../stockage/canonique.js';
import { creer as creerDansLeDepot, enregistrer as enregistrerDansLeDepot } from '../stockage/depot.js';
import { FORMAT, analyser, configurationDepuisCharge, creerCharge } from '../stockage/document.js';
import { ErreurStockage } from '../stockage/erreurs.js';
import { lireJournal } from '../stockage/journal.js';
import { SUFFIXES } from '../stockage/noms.js';
import { examiner } from '../stockage/placements.js';
import { VERSION } from '../version.genere.js';
import { appliquerCommande } from './commandes.js';
import { evaluer, resumeDuMeilleur, resumeDuRetenu } from './evaluation.js';
import { creerFacade } from './evenements.js';
import { creerHorlogePilotee } from './horloge.js';
import { libelle } from './libelles.js';
import { creerSeance } from './seance.js';

const V1 = VERSION.affichee;

const DOCUMENTS = 'C:\\Users\\Exemple\\Documents\\Gestion table tournante Libre';
const DOC = { id: 'documents', chemin: DOCUMENTS };
const PUBLIE = 'E:\\soirees';
const PORTABLE = { id: 'portable', chemin: 'E:\\soirees\\data' };
const SOUS_APPDATA = 'C:\\Users\\Exemple\\AppData\\Local\\Programmes\\Tablee';
const PORTABLE_APPDATA = { id: 'portable', chemin: `${SOUS_APPDATA}\\data` };

// L'instant de départ de l'horloge pilotée, et le dossier de corbeille qu'il
// date.
const DEPART = '2026-10-06T19:00:00-04:00';
const CORBEILLE_DU_DEPART = 'corbeille/2026-10-06_19-00-00';

const LUCIOLES = 'Soirée des Lucioles';
const CERFS = 'Soirée des Cerfs';

const DEMONSTRATIONS = LIVREES.map(({ cle, texte }) => ({
  cle,
  nom: CATALOGUE.find((entree) => entree.cle === cle).nom,
  texte,
}));

const UTF8 = new TextEncoder();

// --- Le montage -------------------------------------------------------------

// Identifiants d'épreuve, numérotés dans l'ordre des tirages.
function creerIdentifiants(prefixe) {
  let n = 0;
  return () => {
    n += 1;
    return `${prefixe}-${n}`;
  };
}

// La façade sur le système fs, branchée comme App la branche : changerRacine
// crée la séance sur la racine reçue. appels relève, dans l'ordre, ce que la
// façade demande à la séance, et ce que l'épreuve y ajoute.
function monter({ fs = creerFichiersSimules(), horloge = creerHorlogePilotee({ depart: DEPART }), demonstrations = DEMONSTRATIONS } = {}) {
  const identifiant = creerIdentifiants('id');
  const appels = [];
  let seance = null;
  let racine = null;
  const facade = creerFacade({
    fs,
    horloge,
    identifiant,
    produitVersion: V1,
    demonstrations,
    ouvert: () => seance?.ouvert?.base ?? null,
    ouvrir: async (base) => {
      appels.push(['ouvrir', base]);
      return seance.ouvrir(base);
    },
    fermer: async () => {
      appels.push(['fermer']);
      return seance.fermer();
    },
    creer: async (champs) => {
      appels.push(['creer', champs]);
      return seance.creer(champs);
    },
    racine: () => racine,
    changerRacine: async (nouvelle) => {
      appels.push(['changerRacine', nouvelle]);
      racine = nouvelle;
      seance = creerSeance({
        fs,
        racine: nouvelle,
        horloge,
        identifiant,
        produitVersion: V1,
        planifier: horloge.planifier,
        annuler: horloge.annuler,
      });
    },
  });
  return {
    fs,
    horloge,
    facade,
    appels,
    get seance() {
      return seance;
    },
  };
}

// Un événement posé par le dépôt, hors de la façade : sa paire, journal
// d'une entrée et son jalon, puis l'état.
async function deposerEvenement(fs, racine, { id, nom, etat = null }) {
  const charge = creerCharge({ id, nom, siegesParDefaut: 8, tours: 2 });
  if (etat !== null) charge.evenement.etat = etat;
  const ouvert = await creerDansLeDepot(fs, racine, charge, {
    libelle: libelle('ENTREE_CREATION', { nom }),
    nomJalon: libelle('JALON_CREATION'),
    horodatage: '2031-05-17T08:00:00-04:00',
    produitVersion: V1,
  });
  return ouvert.base;
}

// Le texte d'état d'un événement neuf, que l'épreuve dépose tel quel.
const texteEtat = ({ id, nom }) =>
  serialiser(creerCharge({ id, nom, siegesParDefaut: 8, tours: 2 }), { revision: 1, produitVersion: V1 });

// Le refus qu'une promesse rejette.
async function refusDe(promesse) {
  try {
    await promesse;
  } catch (erreur) {
    return erreur;
  }
  assert.fail('la promesse devait rejeter');
}

// Les textes de chaque fichier d'une racine, par nom, sous le dossier donné.
async function photographier(fs, racine, dossier = '') {
  const entrees = await fs.lister(racine, dossier);
  const photo = {};
  for (const { nom, type } of entrees) {
    if (type === 'fichier') photo[nom] = fs.contenu(racine.id, dossier === '' ? nom : `${dossier}/${nom}`);
  }
  return photo;
}

const ecritures = (fs) => fs.compteurs.ecritures;

// Le nom en NFD que copier et renommer reçoivent, et sa forme NFC, distinctes.
const NFD = 'Soire\u{0065}\u{0301}e des Hiboux'.normalize('NFD');
const NFC = NFD.normalize('NFC');

// Des Documents sous un chemin de 250 caractères : aucun nom long n'y tient
// sous la borne d'un chemin, que lève deriverBase.
const PROFOND = `C:\\${'p'.repeat(247)}`;

// --- La détermination du dossier de travail (§ 8.6) --------------------------

describe('demarrer : une détermination par séance (§ 8.6)', () => {
  test('le second demarrer ne lit ni n’écrit rien, et rend le même résultat', async () => {
    const { fs, facade, appels } = monter();
    const premier = await facade.demarrer();
    const { ecritures: e, lectures: l } = fs.compteurs;
    const second = await facade.demarrer();
    assert.equal(second, premier);
    assert.equal(fs.compteurs.ecritures, e);
    assert.equal(fs.compteurs.lectures, l);
    assert.deepEqual(premier.dossier.racine, DOC);
    assert.deepEqual(appels, [['changerRacine', DOC]]);
  });

  test('les cinq issues du dossier de travail rendent leurs avis, dans l’ordre d’Avis', async () => {
    const cas = [
      [{}, [{ code: 'NON_PUBLIE', details: {} }]],
      [{ executable: SOUS_APPDATA }, [{ code: 'DONNEES_APPLICATIVES', details: {} }]],
      [{ executable: PUBLIE, sonde: { portable: 'EACCES' } }, [{ code: 'SONDE_ECHOUEE', details: { cause: 'EACCES' } }]],
      [{ nature: 'web' }, [{ code: 'PLATEFORME_WEB', details: {} }]],
      [{ executable: PUBLIE, support: { portable: 'amovible' } }, [{ code: 'SUPPORT_AMOVIBLE', details: {} }]],
      [
        { nature: 'web', support: { documents: 'amovible' } },
        [
          { code: 'PLATEFORME_WEB', details: {} },
          { code: 'SUPPORT_AMOVIBLE', details: {} },
        ],
      ],
      [{ executable: PUBLIE }, []],
    ];
    assert.equal(cas.length, 7);
    for (const [systeme, attendus] of cas) {
      const { facade } = monter({ fs: creerFichiersSimules(systeme) });
      const { avis } = await facade.demarrer();
      assert.deepEqual(avis, attendus, JSON.stringify(systeme));
    }
  });

  test('changerRacine reçoit la racine retenue : data/ en mode portable', async () => {
    const { facade, appels } = monter({ fs: creerFichiersSimules({ executable: PUBLIE }) });
    const { dossier } = await facade.demarrer();
    assert.equal(dossier.mode, 'portable');
    assert.deepEqual(appels, [['changerRacine', PORTABLE]]);
    assert.deepEqual(facade.explorateur(), { disponible: true, raison: null });
  });

  test('des réglages locaux corrompus ajoutent REGLAGES_ILLISIBLES après les avis du dossier de travail', async () => {
    const fs = creerFichiersSimules();
    fs.deposer('documents', 'reglages_locaux.json', '{ pas du JSON');
    const { facade } = monter({ fs });
    const { avis } = await facade.demarrer();
    assert.deepEqual(avis, [
      { code: 'NON_PUBLIE', details: {} },
      { code: 'REGLAGES_ILLISIBLES', details: { chemin: 'reglages_locaux.json', raison: 'JSON' } },
    ]);
  });

  test('une lecture refusée rejette demarrer sans rien retenir, et le suivant refait la détermination', async () => {
    const fs = creerFichiersSimules();
    const lister = fs.lister;
    let pannes = 1;
    fs.lister = async (...parametres) => {
      if (pannes > 0) {
        pannes -= 1;
        throw new ErreurStockage('LECTURE', { chemin: '', dossier: DOCUMENTS, cause: 'EIO' });
      }
      return lister(...parametres);
    };
    const { facade, appels } = monter({ fs });
    const refus = await refusDe(facade.demarrer());
    assert.equal(refus.code, 'LECTURE');
    assert.deepEqual(appels, []);
    const { dossier } = await facade.demarrer();
    assert.deepEqual(dossier.racine, DOC);
    assert.deepEqual(appels, [['changerRacine', DOC]]);
  });
});

// --- Les questions (§ 8.6) ---------------------------------------------------

describe('une opération lancée pendant demarrer', () => {
  test('attend la détermination en cours, et lit le dossier retenu ; une seule détermination', async () => {
    const fs = creerFichiersSimules();
    const sondes = [];
    const sonder = fs.sonder;
    fs.sonder = async (racine) => {
      sondes.push(racine.id);
      return sonder(racine);
    };
    const { facade } = monter({ fs });
    fs.deposerDossier('documents');
    await deposerEvenement(fs, DOC, { id: 'evt-lucioles', nom: LUCIOLES });
    const demarrage = facade.demarrer();
    const [lignes, corbeille] = await Promise.all([facade.lister(), facade.corbeille()]);
    assert.deepEqual(lignes.map(({ base }) => base), [LUCIOLES]);
    assert.deepEqual(corbeille, []);
    assert.equal((await demarrage).dossier.racine.id, 'documents');
    assert.equal(await facade.demarrer(), await demarrage);
    assert.deepEqual(sondes, ['documents']);
  });
});

describe('les questions du dossier de travail (§ 8.6)', () => {
  // data/ porte deux événements, posés par un premier processus ; le second,
  // monté sur le même disque, voit data/ refuser l'écriture.
  async function dataQuiRefuse() {
    const disque = new Map();
    const avant = creerFichiersSimules({ disque, executable: PUBLIE });
    avant.deposerDossier('portable');
    await deposerEvenement(avant, PORTABLE, { id: 'evt-lucioles', nom: LUCIOLES });
    await deposerEvenement(avant, PORTABLE, { id: 'evt-cerfs', nom: CERFS });
    const fs = creerFichiersSimules({ disque, executable: PUBLIE, sonde: { portable: 'EACCES' } });
    const sondes = [];
    const sonder = fs.sonder;
    fs.sonder = async (racine) => {
      sondes.push(racine.id);
      return sonder(racine);
    };
    return { fs, sondes };
  }

  test('PORTABLE_NON_INSCRIPTIBLE : question au compte de 2, liste refusée tant qu’elle attend', async () => {
    const { fs } = await dataQuiRefuse();
    const { facade, appels } = monter({ fs });
    const { dossier, avis } = await facade.demarrer();
    assert.deepEqual(dossier.question, {
      code: 'PORTABLE_NON_INSCRIPTIBLE',
      racine: PORTABLE,
      evenements: 2,
      cause: 'EACCES',
    });
    assert.deepEqual(avis, [{ code: 'SONDE_ECHOUEE', details: { cause: 'EACCES' } }]);
    assert.deepEqual(appels, []);
    const refus = await refusDe(facade.lister());
    assert.equal(refus.code, 'QUESTION_EN_ATTENTE');
    assert.deepEqual(refus.details, { question: 'PORTABLE_NON_INSCRIPTIBLE', remede: null });
    assert.equal(typeof libelle(refus.code, refus.details), 'string');
  });

  test('tant que la question attend, chaque opération qui lit ou écrit le dossier se refuse QUESTION_EN_ATTENTE, sans rien écrire', async () => {
    const { fs } = await dataQuiRefuse();
    const { facade, appels } = monter({ fs });
    await facade.demarrer();
    const avant = ecritures(fs);
    const operations = [
      ['lister', () => facade.lister()],
      ['creer', () => facade.creer({ nom: 'Soirée des Merles' })],
      ['chargerDemonstration', () => facade.chargerDemonstration(DEMONSTRATIONS[0].cle)],
      ['copier', () => facade.copier(LUCIOLES, { nom: 'Variante' })],
      ['renommer', () => facade.renommer(LUCIOLES, { nom: 'Variante' })],
      ['supprimer', () => facade.supprimer(LUCIOLES)],
      ['corbeille', () => facade.corbeille()],
      ['importerFichier', () => facade.importerFichier()],
      ['importerDepuisAutre', () => facade.importerDepuisAutre()],
      ['ouvrirExplorateur', () => facade.ouvrirExplorateur()],
    ];
    assert.equal(operations.length, 10);
    for (const [nom, operation] of operations) {
      const refus = await refusDe(operation());
      assert.equal(refus.code, 'QUESTION_EN_ATTENTE', nom);
      assert.deepEqual(refus.details, { question: 'PORTABLE_NON_INSCRIPTIBLE', remede: null }, nom);
    }
    assert.equal(ecritures(fs), avant);
    assert.deepEqual(appels, []);
  });

  test('« reessayer » refait la détermination : deux sondes de plus, la même question', async () => {
    const { fs, sondes } = await dataQuiRefuse();
    const { facade, appels } = monter({ fs });
    await facade.demarrer();
    assert.deepEqual(sondes, ['portable', 'documents']);
    const avant = ecritures(fs);
    const { dossier } = await facade.repondre('reessayer');
    assert.deepEqual(sondes, ['portable', 'documents', 'portable', 'documents']);
    // Les deux sondes, et rien d'autre.
    assert.equal(ecritures(fs), avant + 2);
    assert.equal(dossier.question.code, 'PORTABLE_NON_INSCRIPTIBLE');
    assert.deepEqual(appels, []);
    assert.equal((await refusDe(facade.lister())).code, 'QUESTION_EN_ATTENTE');
  });

  test('« documents » copie les deux paires dans les Documents, originaux intacts', async () => {
    const { fs } = await dataQuiRefuse();
    const { facade, appels } = monter({ fs });
    await facade.demarrer();
    const originaux = await photographier(fs, PORTABLE);
    assert.equal(Object.keys(originaux).length, 4);
    const avant = ecritures(fs);
    const { dossier } = await facade.repondre('documents');
    // Chaque paire : son journal, puis son état.
    assert.equal(ecritures(fs), avant + 4);
    assert.equal(dossier.question, null);
    assert.equal(dossier.autre, null);
    assert.deepEqual(dossier.racine, DOC);
    assert.deepEqual(appels, [['changerRacine', DOC]]);
    assert.deepEqual(await photographier(fs, PORTABLE), originaux);
    const lignes = await facade.lister();
    assert.equal(lignes.length, 2);
    assert.deepEqual(
      lignes.map(({ id, nom }) => [id, nom]),
      [
        ['evt-cerfs', CERFS],
        ['evt-lucioles', LUCIOLES],
      ],
    );
    for (const base of [LUCIOLES, CERFS]) {
      assert.equal(fs.contenu('documents', base + SUFFIXES.etat), originaux[base + SUFFIXES.etat]);
      assert.equal(fs.contenu('documents', base + SUFFIXES.journal), originaux[base + SUFFIXES.journal]);
    }
    assert.equal((await facade.demarrer()).dossier, dossier);
  });

  test('un data/ qui ne se lit pas, compte null : « documents » n’a rien à copier, ni à relire', async () => {
    const { fs } = await dataQuiRefuse();
    const lister = fs.lister;
    const listes = [];
    fs.lister = async (racine, dossier) => {
      listes.push(racine.id);
      if (racine.id === 'portable') throw new ErreurStockage('LECTURE', { chemin: dossier, dossier: PORTABLE.chemin, cause: 'EIO' });
      return lister(racine, dossier);
    };
    const { facade, appels } = monter({ fs });
    const { dossier } = await facade.demarrer();
    assert.deepEqual(dossier.question, {
      code: 'PORTABLE_NON_INSCRIPTIBLE',
      racine: PORTABLE,
      evenements: null,
      cause: 'EACCES',
    });
    const lus = listes.length;
    const avant = ecritures(fs);
    const reponse = await facade.repondre('documents');
    assert.deepEqual(reponse.importe, { importes: [], refuses: [] });
    assert.deepEqual(reponse.dossier.racine, DOC);
    assert.deepEqual(appels, [['changerRacine', DOC]]);
    assert.deepEqual(listes.slice(lus), []);
    assert.equal(ecritures(fs), avant);
  });

  test('« continuer » ne répond pas à PORTABLE_NON_INSCRIPTIBLE : RangeError', async () => {
    const { fs } = await dataQuiRefuse();
    const { facade, appels } = monter({ fs });
    await facade.demarrer();
    await assert.rejects(facade.repondre('continuer'), RangeError);
    await assert.rejects(facade.repondre('ignorer'), RangeError);
    assert.deepEqual(appels, []);
  });

  test('DOCUMENTS_NON_INSCRIPTIBLE nomme le dossier, la cause et le compte ; « continuer » ouvre la liste sans écrire', async () => {
    const disque = new Map();
    const avant = creerFichiersSimules({ disque });
    avant.deposerDossier('documents');
    await deposerEvenement(avant, DOC, { id: 'evt-lucioles', nom: LUCIOLES });
    const fs = creerFichiersSimules({ disque, sonde: { documents: 'EACCES' } });
    const { facade, appels } = monter({ fs });
    const { dossier } = await facade.demarrer();
    assert.deepEqual(dossier.question, {
      code: 'DOCUMENTS_NON_INSCRIPTIBLE',
      racine: DOC,
      evenements: 1,
      cause: 'EACCES',
    });
    assert.equal((await refusDe(facade.lister())).code, 'QUESTION_EN_ATTENTE');
    await assert.rejects(facade.repondre('documents'), RangeError);
    assert.deepEqual(appels, []);
    const avant2 = ecritures(fs);
    const reponse = await facade.repondre('continuer');
    assert.equal(reponse.dossier.question, null);
    assert.deepEqual(appels, [['changerRacine', DOC]]);
    const lignes = await facade.lister();
    assert.deepEqual(
      lignes.map(({ base }) => base),
      [LUCIOLES],
    );
    assert.equal(ecritures(fs), avant2);
  });
});

// --- La liste (§ 8.1, § 19.4) -----------------------------------------------

// Les lignes de la liste, chacune complétée des deux résumés que resumer
// rend pour elle, le flux mené à son terme sans attendre d'horloge.
async function listerResume(facade) {
  const lignes = await facade.lister();
  const resumes = new Map();
  await facade.resumer(lignes, { ceder: async () => undefined, recevoir: (base, resume) => resumes.set(base, resume) }).fin;
  assert.equal(resumes.size, lignes.length);
  return lignes.map((ligne) => ({ ...ligne, ...resumes.get(ligne.base) }));
}

describe('lister (§ 8.1, § 19.4)', () => {
  // Publié en E:\soirees, data/ inscriptible : la petite démonstration
  // déposée sans journal, et un événement renommé à la main.
  async function deuxEvenements() {
    const fs = creerFichiersSimules({ executable: PUBLIE });
    const montage = monter({ fs });
    await montage.facade.demarrer();
    fs.deposer('portable', `petite${SUFFIXES.etat}`, texteLivre('petite'));
    const base = await deposerEvenement(fs, PORTABLE, { id: 'evt-gala', nom: 'Gala du printemps' });
    await fs.deplacer(PORTABLE, base + SUFFIXES.etat, `soiree-a${SUFFIXES.etat}`);
    await fs.deplacer(PORTABLE, base + SUFFIXES.journal, `soiree-a${SUFFIXES.journal}`);
    return montage;
  }

  test('six informations par ligne, le nom et le compte lus dans le fichier, rien d’écrit', async () => {
    const { fs, facade } = await deuxEvenements();
    const avant = ecritures(fs);
    const lignes = await facade.lister();
    assert.equal(ecritures(fs), avant);
    const petite = analyser(texteLivre('petite')).charge;
    assert.deepEqual(lignes, [
      {
        base: 'soiree-a',
        id: 'evt-gala',
        nom: 'Gala du printemps',
        date: null,
        etat: 'brouillon',
        participants: 0,
        derniereModification: '2031-05-17T08:00:00-04:00',
        chemin: `E:\\soirees\\data\\soiree-a${SUFFIXES.etat}`,
        illisible: null,
        journalSeul: false,
        doublonAvec: [],
        verrou: null,
      },
      {
        base: 'petite',
        id: petite.evenement.id,
        nom: petite.evenement.nom,
        date: petite.evenement.date,
        etat: petite.evenement.etat,
        participants: petite.participants.length,
        derniereModification: null,
        chemin: `E:\\soirees\\data\\petite${SUFFIXES.etat}`,
        illisible: null,
        journalSeul: false,
        doublonAvec: [],
        verrou: null,
      },
    ]);
    assert.ok(petite.participants.length > 0);
  });

  test('deux exécutions rendent la même liste ; la date des fichiers n’y change rien', async () => {
    const { fs, facade } = await deuxEvenements();
    const avant = ecritures(fs);
    const premiere = await facade.lister();
    assert.equal(premiere.length, 2);
    assert.deepEqual(await facade.lister(), premiere);
    fs.deposer('portable', `petite${SUFFIXES.etat}`, texteLivre('petite'), 1);
    fs.deposer('portable', `soiree-a${SUFFIXES.journal}`, fs.contenu('portable', `soiree-a${SUFFIXES.journal}`), 2);
    assert.deepEqual(await facade.lister(), premiere);
    assert.equal(ecritures(fs), avant);
  });

  test('la dernière modification est l’horodatage de la dernière entrée du journal', async () => {
    const { fs, horloge, facade } = monter();
    await facade.demarrer();
    await facade.creer({ nom: LUCIOLES });
    horloge.avancer(3_600_000);
    await facade.renommer(LUCIOLES, { nom: CERFS });
    const journal = lireJournal(fs.contenu('documents', CERFS + SUFFIXES.journal));
    assert.deepEqual(
      journal.entrees.map(({ horodatage }) => horodatage),
      [DEPART, '2026-10-06T20:00:00-04:00'],
    );
    const avant = ecritures(fs);
    const [ligne] = await facade.lister();
    assert.equal(ligne.derniereModification, '2026-10-06T20:00:00-04:00');
    assert.equal(ecritures(fs), avant);
  });

  test('un .gtt.verrou présent se lit sans écrire ; illisible, sa séance et son instant sont null', async () => {
    const { fs, facade } = await deuxEvenements();
    const contenu = { seance: 'seance-voisine', pid: 7, hote: 'poste-voisin', depuis: '2031-05-17T09:30:00-04:00' };
    fs.deposer('portable', `soiree-a${SUFFIXES.verrou}`, `${JSON.stringify(contenu)}\n`);
    fs.deposer('portable', `petite${SUFFIXES.verrou}`, 'pas un verrou');
    const avant = ecritures(fs);
    const lignes = await facade.lister();
    assert.equal(ecritures(fs), avant);
    assert.deepEqual(
      lignes.map(({ base, verrou }) => [base, verrou]),
      [
        ['soiree-a', { seance: 'seance-voisine', depuis: '2031-05-17T09:30:00-04:00' }],
        ['petite', { seance: null, depuis: null }],
      ],
    );
  });

  test("un .gtt.verrou dont la lecture échoue autrement qu'ABSENT se dit illisible, sans écrire ; un absent n'est pas un verrou", async () => {
    const { fs, facade } = await deuxEvenements();
    fs.deposer('portable', `soiree-a${SUFFIXES.verrou}`, '{}');
    const lireTexte = fs.lireTexte;
    fs.lireTexte = async (racine, chemin) => {
      if (chemin === `soiree-a${SUFFIXES.verrou}`) throw new ErreurStockage('LECTURE', { chemin, dossier: PORTABLE.chemin, cause: 'EACCES' });
      return lireTexte(racine, chemin);
    };
    const avant = ecritures(fs);
    const lignes = await facade.lister();
    assert.equal(ecritures(fs), avant);
    assert.deepEqual(
      lignes.map(({ base, verrou }) => [base, verrou]),
      [
        ['soiree-a', { seance: null, depuis: null }],
        ['petite', null],
      ],
    );
  });

  test("un journal dont une ligne n'est pas de l'UTF-8 : la dernière modification est celle de la dernière entrée lue avant elle", async () => {
    const fs = creerFichiersSimules();
    const { facade } = monter({ fs });
    await facade.demarrer();
    const base = await deposerEvenement(fs, DOC, { id: 'evt-lucioles', nom: LUCIOLES });
    const journal = UTF8.encode(fs.contenu('documents', base + SUFFIXES.journal));
    fs.deposerOctets('documents', base + SUFFIXES.journal, new Uint8Array([...journal, 0xff, 0xfe, 0x0a]));
    const avant = ecritures(fs);
    const [ligne] = await facade.lister();
    assert.equal(ecritures(fs), avant);
    assert.equal(ligne.derniereModification, '2031-05-17T08:00:00-04:00');
  });

  test('signalements : état vide, journal seul, doublons ; rien pour les autres fichiers', async () => {
    const fs = creerFichiersSimules();
    const { facade } = monter({ fs });
    await facade.demarrer();
    fs.deposer('documents', `Soirée vide${SUFFIXES.etat}`, '');
    const hiboux = await deposerEvenement(fs, DOC, { id: 'evt-hiboux', nom: 'Soirée des Hiboux' });
    await fs.supprimer(DOC, hiboux + SUFFIXES.etat);
    const merles = texteEtat({ id: 'evt-merles', nom: 'Club des Merles' });
    fs.deposer('documents', `Merles A${SUFFIXES.etat}`, merles);
    fs.deposer('documents', `Merles B${SUFFIXES.etat}`, merles);
    fs.deposer('documents', 'reglages_locaux.json', '{}');
    fs.deposer('documents', `corbeille/2031-01-01_00-00-00/Ancienne${SUFFIXES.etat}`, merles);
    fs.deposer('documents', 'planche.pdf', '%PDF');
    const avant = ecritures(fs);
    const lignes = await facade.lister();
    assert.equal(ecritures(fs), avant);
    assert.equal(lignes.length, 4);
    const signalees = lignes.filter((l) => l.illisible !== null || l.journalSeul || l.doublonAvec.length > 0);
    assert.equal(signalees.length, 4);
    const par = Object.fromEntries(lignes.map((ligne) => [ligne.base, ligne]));
    assert.deepEqual(Object.keys(par).sort(), ['Merles A', 'Merles B', 'Soirée des Hiboux', 'Soirée vide']);

    assert.equal(par['Soirée vide'].illisible.raison, 'VIDE');
    assert.deepEqual(par['Soirée vide'].illisible.secours, { precedent: null, journal: null });
    assert.equal(par['Soirée vide'].journalSeul, false);
    assert.equal(typeof libelle('ETAT_ILLISIBLE', par['Soirée vide'].illisible), 'string');

    assert.equal(par['Soirée des Hiboux'].journalSeul, true);
    assert.equal(par['Soirée des Hiboux'].id, 'evt-hiboux');
    assert.deepEqual(par['Soirée des Hiboux'].illisible.secours, { precedent: null, journal: 1 });
    assert.equal(par['Soirée des Hiboux'].derniereModification, '2031-05-17T08:00:00-04:00');

    assert.deepEqual(par['Merles A'].doublonAvec, ['Merles B']);
    assert.deepEqual(par['Merles B'].doublonAvec, ['Merles A']);
    assert.equal(par['Merles A'].illisible, null);
    assert.equal(par['Soirée vide'].doublonAvec.length, 0);
  });

  // La petite démonstration au conflit inévitable, deux propositions
  // générées par le moteur et la seconde retenue, par les commandes ;
  // modifier(charge) l'ajuste avant l'écriture.
  function texteRetenu(modifier = (charge) => charge) {
    let charge = analyser(texteLivre('petite-conflit')).charge;
    const configuration = configurationDepuisCharge(charge);
    const propositions = rechercher(configuration, { graine: 4, nombre: 2, arret: 300 });
    charge = appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: V1 }).charge;
    charge = appliquerCommande('retenirProposition', charge, { id: charge.propositions[1].id }).charge;
    return serialiser(modifier(charge), { revision: 3, produitVersion: V1 });
  }

  test('les mesures du retenu : ses collisions cumulées et ses rencontres répétées choisies, celles de resumeDuRetenu ; null sans retenu ; rien d’écrit', async () => {
    const { fs, facade } = await deuxEvenements();
    fs.deposer('portable', `retenue${SUFFIXES.etat}`, texteRetenu());
    const avant = ecritures(fs);
    const lignes = await listerResume(facade);
    assert.equal(ecritures(fs), avant);
    const par = Object.fromEntries(lignes.map((ligne) => [ligne.base, ligne]));
    const charge = analyser(texteRetenu()).charge;
    const { mesures } = evaluer(charge).retenu;
    assert.ok(mesures.collisionsCumulees > 0, 'le retenu porte des collisions');
    assert.ok(mesures.rencontresRepetees.choisies > 0, 'le retenu porte des rencontres répétées choisies');
    assert.deepEqual(par.retenue.mesuresDuRetenu, {
      collisionsCumulees: mesures.collisionsCumulees,
      rencontresRepetees: mesures.rencontresRepetees.choisies,
    });
    assert.deepEqual(par.retenue.mesuresDuRetenu, resumeDuRetenu(charge));
    assert.equal(par['soiree-a'].mesuresDuRetenu, null);
    assert.equal(par.petite.mesuresDuRetenu, null);
  });

  test('un état écrit avec la cible de redondance d’un code antérieur se résume sans faute, comme sans elle', async () => {
    const { fs, facade } = await deuxEvenements();
    const lu = JSON.parse(texteRetenu());
    lu.charge.reglages.cibleRedondance = 25;
    fs.deposer('portable', `retenue${SUFFIXES.etat}`, `${JSON.stringify(lu, null, 2)}\n`);
    const ligne = (await listerResume(facade)).find(({ base }) => base === 'retenue');
    assert.equal(ligne.illisible, null);
    assert.deepEqual(ligne.mesuresDuRetenu, resumeDuRetenu(analyser(texteRetenu()).charge));
  });

  test('un retenu fautif, ou en dérive, et un état illisible : null, la liste entière rendue, rien d’écrit', async () => {
    const { fs, facade } = await deuxEvenements();
    fs.deposer(
      'portable',
      `fautive${SUFFIXES.etat}`,
      texteRetenu((charge) => {
        charge.retenu.placement[0].reserve.push(charge.retenu.participants[0]);
        return charge;
      }),
    );
    fs.deposer('portable', `derivee${SUFFIXES.etat}`, texteRetenu((charge) => appliquerCommande('changerTours', charge, { tours: '3' }).charge));
    fs.deposer('portable', `tronquee${SUFFIXES.etat}`, texteRetenu().slice(0, 40));
    const avant = ecritures(fs);
    const lignes = await listerResume(facade);
    assert.equal(ecritures(fs), avant);
    assert.equal(lignes.length, 5);
    const par = Object.fromEntries(lignes.map((ligne) => [ligne.base, ligne]));
    assert.equal(par.fautive.illisible, null);
    assert.equal(par.fautive.mesuresDuRetenu, null);
    assert.equal(par.derivee.mesuresDuRetenu, null);
    assert.notEqual(par.tronquee.illisible, null);
    assert.equal(par.tronquee.mesuresDuRetenu, null);
  });

  test('la meilleure proposition du classement : celle de resumeDuMeilleur, retenu ou non ; null sans proposition ; rien d’écrit', async () => {
    const { fs, facade } = await deuxEvenements();
    // Les mêmes propositions, sans retenu, sous un autre identifiant : deux
    // événements distincts, aucun doublon.
    const sansRetenu = texteRetenu((charge) => ({
      ...charge,
      retenu: null,
      evenement: { ...charge.evenement, id: 'evt-proposee', etat: 'propose' },
    }));
    fs.deposer('portable', `retenue${SUFFIXES.etat}`, texteRetenu());
    fs.deposer('portable', `proposee${SUFFIXES.etat}`, sansRetenu);
    const avant = ecritures(fs);
    const lignes = await listerResume(facade);
    assert.equal(ecritures(fs), avant);
    assert.equal(lignes.length, 4);
    const par = Object.fromEntries(lignes.map((ligne) => [ligne.base, ligne]));
    for (const [base, texte] of [
      ['retenue', texteRetenu()],
      ['proposee', sansRetenu],
    ]) {
      const charge = analyser(texte).charge;
      const [premiere] = evaluer(charge).propositions;
      assert.equal(premiere.statut, 'comparable', base);
      assert.deepEqual(par[base].meilleureDuClassement, { id: premiere.id }, base);
      assert.deepEqual(par[base].meilleureDuClassement, resumeDuMeilleur(charge), base);
    }
    assert.equal(par.proposee.mesuresDuRetenu, null);
    assert.equal(par['soiree-a'].meilleureDuClassement, null);
    assert.equal(par.petite.meilleureDuClassement, null);
  });

  test("un journal en avance d'une entrée : la ligne porte la proposition que montre le bloc après ouverture, sans rien écrire", async () => {
    const montage = await deuxEvenements();
    const { fs, facade } = montage;
    // L'état d'une soirée sans proposition ; le journal porte en plus la
    // génération dont l'état ne s'est pas écrit.
    const charge = analyser(texteLivre('petite-conflit')).charge;
    charge.evenement = { ...charge.evenement, id: 'evt-avance', nom: 'Soirée en avance' };
    const ouvert = await creerDansLeDepot(fs, PORTABLE, charge, {
      libelle: libelle('ENTREE_CREATION', { nom: charge.evenement.nom }),
      nomJalon: libelle('JALON_CREATION'),
      horodatage: DEPART,
      produitVersion: V1,
    });
    const configuration = configurationDepuisCharge(charge);
    const propositions = rechercher(configuration, { graine: 4, nombre: 2, arret: 300 });
    const apres = appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: V1 }).charge;
    fs.pannes.renommage('portable', 11);
    const refus = await refusDe(enregistrerDansLeDepot(ouvert, apres, { libelle: 'Génération', horodatage: DEPART, produitVersion: V1 }));
    assert.equal(refus.code, 'ETAT_NON_ECRIT');
    assert.equal(analyser(fs.contenu('portable', ouvert.base + SUFFIXES.etat)).charge.propositions.length, 0);
    const avant = ecritures(fs);
    const ligne = (await listerResume(facade)).find(({ base }) => base === ouvert.base);
    assert.equal(ecritures(fs), avant);
    await montage.seance.ouvrir(ouvert.base);
    const bloc = resumeDuMeilleur(montage.seance.charge);
    assert.notEqual(bloc, null);
    assert.deepEqual(ligne.meilleureDuClassement, bloc);
    assert.equal(ecritures(fs), avant);
  });

  test('lister lit chaque état une fois, celle du dépôt ; resumer le relit une fois de plus pour ses deux résumés', async () => {
    const { fs, facade } = await deuxEvenements();
    fs.deposer('portable', `retenue${SUFFIXES.etat}`, texteRetenu());
    const lireTexte = fs.lireTexte;
    const lus = [];
    fs.lireTexte = (racine, chemin) => {
      lus.push(chemin);
      return lireTexte.call(fs, racine, chemin);
    };
    const lues = await facade.lister();
    assert.equal(lues.length, 3);
    const etats = () => lus.filter((chemin) => chemin === `retenue${SUFFIXES.etat}`).length;
    assert.equal(etats(), 1, lus.join());
    const ligne = (await listerResume(facade)).find(({ base }) => base === 'retenue');
    assert.notEqual(ligne.mesuresDuRetenu, null);
    assert.notEqual(ligne.meilleureDuClassement, null);
    assert.equal(etats(), 3, lus.join());
  });

  // Un état que l'analyse admet et qu'examiner corrige (§ 8.9, point 3) :
  // la ligne lit la charge que l'ouverture lit, examinée, et non la charge
  // brute. Les propositions, sans retenu, sous modifier(charge).
  const texteExamine = (modifier) => texteRetenu((charge) => modifier({ ...charge, retenu: null }));
  const meilleureOuverte = (texte) => resumeDuMeilleur(examiner(analyser(texte).charge).charge);

  test('un identifiant répété : la ligne rendue, avec la meilleure proposition de la charge examinée', async () => {
    const { fs, facade } = await deuxEvenements();
    const texte = texteExamine((charge) => {
      const [premiere, seconde, ...reste] = charge.propositions;
      return { ...charge, propositions: [premiere, { ...seconde, id: premiere.id }, ...reste] };
    });
    assert.equal(examiner(analyser(texte).charge).fautives[0].fautes[0].code, 'IDENTIFIANT_REPETE');
    fs.deposer('portable', `repetee${SUFFIXES.etat}`, texte);
    const ligne = (await listerResume(facade)).find(({ base }) => base === 'repetee');
    assert.notEqual(ligne, undefined);
    assert.notEqual(meilleureOuverte(texte), null);
    assert.deepEqual(ligne.meilleureDuClassement, meilleureOuverte(texte));
  });

  test('une proposition hors du compteur : la ligne nomme la meilleure de la charge examinée, celle du bloc de génération', async () => {
    const { fs, facade } = await deuxEvenements();
    // Le compteur abaissé à l'identifiant de la proposition au rang 1 de la
    // charge brute : examiner l'écarte, et le rang 1 change.
    const rangUn = resumeDuMeilleur(analyser(texteExamine((charge) => charge)).charge);
    const texte = texteExamine((charge) => ({ ...charge, prochainsIds: { ...charge.prochainsIds, proposition: rangUn.id } }));
    assert.equal(examiner(analyser(texte).charge).fautives[0].fautes[0].code, 'IDENTIFIANT_HORS_COMPTEUR');
    assert.notDeepEqual(meilleureOuverte(texte), resumeDuMeilleur(analyser(texte).charge));
    fs.deposer('portable', `abaissee${SUFFIXES.etat}`, texte);
    const ligne = (await listerResume(facade)).find(({ base }) => base === 'abaissee');
    assert.deepEqual(ligne.meilleureDuClassement, meilleureOuverte(texte));
  });

  test('des propositions toutes en dérive, et un état illisible : null, la liste entière rendue', async () => {
    const { fs, facade } = await deuxEvenements();
    const derivee = texteRetenu((charge) => appliquerCommande('changerTours', charge, { tours: '3' }).charge);
    assert.ok(evaluer(analyser(derivee).charge).propositions.every(({ statut }) => statut === 'derive'));
    fs.deposer('portable', `derivee${SUFFIXES.etat}`, derivee);
    fs.deposer('portable', `tronquee${SUFFIXES.etat}`, texteRetenu().slice(0, 40));
    const lignes = await listerResume(facade);
    assert.equal(lignes.length, 4);
    const par = Object.fromEntries(lignes.map((ligne) => [ligne.base, ligne]));
    assert.equal(par.derivee.meilleureDuClassement, null);
    assert.notEqual(par.tronquee.illisible, null);
    assert.equal(par.tronquee.meilleureDuClassement, null);
  });

  // --- resumer : les résumés, un événement après l'autre ---------------------

  // Un pas que tient l'horloge pilotée : sa promesse se résout à la prochaine
  // avance de l'horloge, comme le pas de l'interface à sa minuterie.
  const pasDe = (horloge) => () =>
    new Promise((reprendre) => {
      horloge.planifier(reprendre, 0);
    });
  // setImmediate rappelle une fois vidées les microtâches, où s'enchaînent
  // les lectures du système simulé et le calcul qu'un pas libère.
  const laisser = () => new Promise((resolve) => setImmediate(resolve));
  async function unPas(horloge) {
    horloge.avancer(0);
    await laisser();
  }
  const AUCUN = { mesuresDuRetenu: null, meilleureDuClassement: null };
  // Les deux résumés d'un texte d'état, sur sa charge examinée, celle que
  // l'ouverture lit.
  function resumesAttendus(texte) {
    const charge = examiner(analyser(texte).charge).charge;
    return { mesuresDuRetenu: resumeDuRetenu(charge), meilleureDuClassement: resumeDuMeilleur(charge) };
  }

  // Le dossier de deuxEvenements, plus un retenu, des propositions sans
  // retenu et un état tronqué.
  async function dossierAResumer() {
    const montage = await deuxEvenements();
    const sansRetenu = texteRetenu((charge) => ({
      ...charge,
      retenu: null,
      evenement: { ...charge.evenement, id: 'evt-proposee', etat: 'propose' },
    }));
    montage.fs.deposer('portable', `retenue${SUFFIXES.etat}`, texteRetenu());
    montage.fs.deposer('portable', `proposee${SUFFIXES.etat}`, sansRetenu);
    montage.fs.deposer('portable', `tronquee${SUFFIXES.etat}`, texteRetenu().slice(0, 40));
    return { ...montage, textes: { retenue: texteRetenu(), proposee: sansRetenu } };
  }

  test('lister rend ses lignes sans résumé ; resumer rend l’état illisible aussitôt, puis un événement par pas, dans l’ordre de la liste, rien d’écrit', async () => {
    const { fs, horloge, facade, textes } = await dossierAResumer();
    const avant = ecritures(fs);
    const lignes = await facade.lister();
    assert.equal(lignes.length, 5);
    for (const ligne of lignes) {
      assert.equal('mesuresDuRetenu' in ligne, false, ligne.base);
      assert.equal('meilleureDuClassement' in ligne, false, ligne.base);
    }
    const recus = [];
    const flux = facade.resumer(lignes, { ceder: pasDe(horloge), recevoir: (base, resume) => recus.push([base, resume]) });
    // Un état illisible n'a rien à résumer : son résumé vide vient avant
    // tout pas.
    assert.deepEqual(recus, [['tronquee', AUCUN]]);
    await laisser();
    assert.equal(recus.length, 1);
    const lisibles = lignes.filter(({ illisible }) => illisible === null).map(({ base }) => base);
    assert.equal(lisibles.length, 4);
    for (let pas = 1; pas <= lisibles.length; pas += 1) {
      await unPas(horloge);
      assert.deepEqual(
        recus.slice(1).map(([base]) => base),
        lisibles.slice(0, pas),
      );
    }
    await flux.fin;
    const par = new Map(recus);
    assert.equal(par.size, 5);
    for (const base of ['retenue', 'proposee']) assert.deepEqual(par.get(base), resumesAttendus(textes[base]), base);
    assert.notEqual(par.get('retenue').mesuresDuRetenu, null);
    assert.notEqual(par.get('proposee').meilleureDuClassement, null);
    assert.deepEqual(par.get('petite'), AUCUN);
    assert.deepEqual(par.get('soiree-a'), AUCUN);
    assert.equal(ecritures(fs), avant);
  });

  test('rien ne s’évalue avant le pas : un état réécrit entre la liste et son pas se résume tel que le pas le lit', async () => {
    const { fs, horloge, facade } = await dossierAResumer();
    const lignes = await facade.lister();
    const recus = new Map();
    const flux = facade.resumer(lignes, { ceder: pasDe(horloge), recevoir: (base, resume) => recus.set(base, resume) });
    // L'autre proposition devient le retenu après la liste : le résumé du
    // pas lit ses collisions, et non celles du retenu que la liste a vu.
    const plusTard = texteRetenu((charge) => appliquerCommande('retenirProposition', charge, { id: charge.propositions[0].id }).charge);
    fs.deposer('portable', `retenue${SUFFIXES.etat}`, plusTard);
    for (let pas = 0; pas < lignes.length; pas += 1) await unPas(horloge);
    await flux.fin;
    const { collisionsCumulees } = evaluer(analyser(plusTard).charge).retenu.mesures;
    assert.notEqual(collisionsCumulees, evaluer(analyser(texteRetenu()).charge).retenu.mesures.collisionsCumulees);
    assert.equal(recus.get('retenue').mesuresDuRetenu.collisionsCumulees, collisionsCumulees);
    assert.deepEqual(recus.get('retenue'), resumesAttendus(plusTard));
  });

  test('abandonner : le calcul en cours ne se reçoit pas, et aucune lecture ne part ensuite', async () => {
    const { fs, horloge, facade } = await dossierAResumer();
    const lignes = await facade.lister();
    const lisibles = lignes.filter(({ illisible }) => illisible === null).map(({ base }) => base);
    // La lecture du deuxième état lisible reste suspendue jusqu'à liberer().
    const lireTexte = fs.lireTexte;
    let liberer;
    const barriere = new Promise((resoudre) => {
      liberer = resoudre;
    });
    let suspendue = null;
    fs.lireTexte = (racine, chemin) => {
      if (chemin === lisibles[1] + SUFFIXES.etat && suspendue === null) {
        suspendue = barriere.then(() => lireTexte.call(fs, racine, chemin));
        return suspendue;
      }
      return lireTexte.call(fs, racine, chemin);
    };
    const recus = [];
    const flux = facade.resumer(lignes, { ceder: pasDe(horloge), recevoir: (base) => recus.push(base) });
    await unPas(horloge);
    await unPas(horloge);
    assert.notEqual(suspendue, null);
    assert.deepEqual(recus, ['tronquee', lisibles[0]]);
    flux.abandonner();
    // La lecture suspendue s'achève et compte ; aucune ne part après elle.
    liberer();
    await laisser();
    const lectures = fs.compteurs.lectures;
    for (let pas = 0; pas < lignes.length; pas += 1) await unPas(horloge);
    await flux.fin;
    assert.deepEqual(recus, ['tronquee', lisibles[0]]);
    assert.equal(fs.compteurs.lectures, lectures);
  });

  test('sans dossier de travail, resumer lève RangeError sans rien recevoir', () => {
    const { facade } = monter();
    const recus = [];
    assert.throws(
      () => facade.resumer([{ base: 'x', illisible: { raison: 'VIDE' } }], { ceder: async () => undefined, recevoir: (base) => recus.push(base) }),
      RangeError,
    );
    assert.deepEqual(recus, []);
  });

  test('abandonné avant son premier pas, le flux ne lit rien et ne rend que les résumés vides des états illisibles', async () => {
    const { fs, horloge, facade } = await dossierAResumer();
    const lignes = await facade.lister();
    const lectures = fs.compteurs.lectures;
    const recus = [];
    const flux = facade.resumer(lignes, { ceder: pasDe(horloge), recevoir: (base) => recus.push(base) });
    flux.abandonner();
    for (let pas = 0; pas < lignes.length; pas += 1) await unPas(horloge);
    await flux.fin;
    assert.deepEqual(recus, ['tronquee']);
    assert.equal(fs.compteurs.lectures, lectures);
  });

  test('un état qui ne se relit plus rend son résumé vide, les autres le leur ; une faute de même, puis fin la rejette', async () => {
    const { fs, horloge, facade, textes } = await dossierAResumer();
    const lignes = await facade.lister();
    // Tronqué après la liste : la relecture du pas le trouve illisible.
    fs.deposer('portable', `proposee${SUFFIXES.etat}`, textes.proposee.slice(0, 40));
    const recus = new Map();
    const flux = facade.resumer(lignes, { ceder: pasDe(horloge), recevoir: (base, resume) => recus.set(base, resume) });
    for (let pas = 0; pas < lignes.length; pas += 1) await unPas(horloge);
    await flux.fin;
    assert.deepEqual(recus.get('proposee'), AUCUN);
    assert.deepEqual(recus.get('retenue'), resumesAttendus(textes.retenue));

    // Une faute — une erreur qui n'est pas un refus du stockage — sur un
    // seul état : son résumé vide, les suivants rendus, puis fin la rejette.
    fs.deposer('portable', `proposee${SUFFIXES.etat}`, textes.proposee);
    const faute = new TypeError('faute d’épreuve');
    const lireTexte = fs.lireTexte;
    fs.lireTexte = (racine, chemin) => (chemin === `petite${SUFFIXES.etat}` ? Promise.reject(faute) : lireTexte.call(fs, racine, chemin));
    const apres = new Map();
    const suivant = facade.resumer(lignes, { ceder: pasDe(horloge), recevoir: (base, resume) => apres.set(base, resume) });
    const issue = suivant.fin.then(
      () => null,
      (erreur) => erreur,
    );
    for (let pas = 0; pas < lignes.length; pas += 1) await unPas(horloge);
    assert.equal(await issue, faute);
    assert.equal(apres.size, 5);
    assert.deepEqual(apres.get('petite'), AUCUN);
    assert.deepEqual(apres.get('retenue'), resumesAttendus(textes.retenue));
    assert.deepEqual(apres.get('proposee'), resumesAttendus(textes.proposee));
    assert.notEqual(apres.get('proposee').meilleureDuClassement, null);
  });
});

// --- Créer (§ 2.1, § 8.3) ----------------------------------------------------

describe('creer (§ 2.1, § 8.3)', () => {
  test('« Soirée d’essai » : creer de la séance, une entrée, le jalon « Création », ouvert en lecture', async () => {
    const montage = monter();
    const { fs, facade, appels } = montage;
    await facade.demarrer();
    const avant = ecritures(fs);
    const { base } = await facade.creer({ nom: "Soirée d'essai", date: null });
    assert.equal(ecritures(fs), avant + 2);
    assert.deepEqual(appels.at(-1), ['creer', { nom: "Soirée d'essai", date: null, siegesParDefaut: 8, tours: 4 }]);
    const journal = lireJournal(fs.contenu('documents', base + SUFFIXES.journal));
    assert.equal(journal.entrees.length, 1);
    assert.deepEqual(
      journal.jalons.map(({ nom }) => nom),
      ['Création'],
    );
    assert.equal(montage.seance.ouvert.base, base);
    assert.equal(montage.seance.mode, 'lecture');
    const { charge } = analyser(fs.contenu('documents', base + SUFFIXES.etat));
    assert.equal(charge.evenement.siegesParDefaut, 8);
    assert.equal(charge.evenement.tours, 4);
  });

  test('une coupure après la première écriture laisse le journal sans l’état : le journal d’abord', async () => {
    const disque = new Map();
    const fs = creerFichiersSimules({ disque });
    const { facade } = monter({ fs });
    await facade.demarrer();
    fs.pannes.couperApres(1);
    await assert.rejects(facade.creer({ nom: "Soirée d'essai" }));
    const relu = creerFichiersSimules({ disque });
    assert.notEqual(relu.contenu('documents', `Soirée d'essai${SUFFIXES.journal}`), null);
    assert.equal(relu.contenu('documents', `Soirée d'essai${SUFFIXES.etat}`), null);
  });

  test('un nom en NFD est inscrit en NFC', async () => {
    const { fs, facade } = monter();
    await facade.demarrer();
    const nfd = 'Soire\u{0065}\u{0301}e des Lucioles'.normalize('NFD');
    assert.notEqual(nfd, nfd.normalize('NFC'));
    const { base } = await facade.creer({ nom: nfd });
    assert.equal(analyser(fs.contenu('documents', base + SUFFIXES.etat)).charge.evenement.nom, nfd.normalize('NFC'));
  });

  test('nom blanc, date hors du calendrier ou mal écrite : refus, rien d’écrit', async () => {
    const { fs, facade } = monter();
    await facade.demarrer();
    const avant = ecritures(fs);
    assert.equal((await refusDe(facade.creer({ nom: '  ' }))).code, 'NOM_REQUIS');
    for (const date of ['2026-02-30', '2026-2-3']) {
      const refus = await refusDe(facade.creer({ nom: LUCIOLES, date }));
      assert.equal(refus.code, 'DATE_INVALIDE');
      assert.equal(refus.details.date, date);
    }
    assert.equal(ecritures(fs), avant);
  });

  test('des Documents sous un chemin de 250 caractères : CHEMIN_TROP_LONG, rien d’écrit', async () => {
    assert.equal(PROFOND.length, 250);
    const { fs, facade } = monter({ fs: creerFichiersSimules({ documents: PROFOND }) });
    await facade.demarrer();
    const avant = ecritures(fs);
    assert.equal((await refusDe(facade.creer({ nom: LUCIOLES }))).code, 'CHEMIN_TROP_LONG');
    assert.equal(ecritures(fs), avant);
  });
});

// --- Charger une démonstration (§ 15) ---------------------------------------

describe('chargerDemonstration (§ 15)', () => {
  test('deux chargements : « ‹nom› 1 » puis « ‹nom› 2 », identités distinctes, ouverts en lecture', async () => {
    const montage = monter();
    const { fs, facade } = montage;
    await facade.demarrer();
    const { base: courant } = await facade.creer({ nom: LUCIOLES });
    const courantAvant = await photographier(fs, DOC);
    const courants = [courant + SUFFIXES.etat, courant + SUFFIXES.journal];
    assert.deepEqual(Object.keys(courantAvant).sort(), [...courants].sort());
    const livre = texteLivre('petite');
    const nom = CATALOGUE.find((entree) => entree.cle === 'petite').nom;

    const avant = ecritures(fs);
    const premier = await facade.chargerDemonstration('petite');
    // Le journal, puis l'état.
    assert.equal(ecritures(fs), avant + 2);
    assert.equal(montage.seance.ouvert.base, premier.base);
    assert.equal(montage.seance.mode, 'lecture');
    const second = await facade.chargerDemonstration('petite');
    assert.equal(ecritures(fs), avant + 4);
    assert.equal(montage.seance.ouvert.base, second.base);
    assert.equal(montage.seance.mode, 'lecture');

    const lire = (base) => analyser(fs.contenu('documents', base + SUFFIXES.etat)).charge.evenement;
    assert.equal(lire(premier.base).nom, `${nom} 1`);
    assert.equal(lire(second.base).nom, `${nom} 2`);
    assert.notEqual(lire(premier.base).id, lire(second.base).id);
    const journal = lireJournal(fs.contenu('documents', premier.base + SUFFIXES.journal));
    assert.deepEqual(
      journal.entrees.map(({ libelle: texte }) => texte),
      [`Chargement de la démonstration « ${nom} »`],
    );
    assert.equal(texteLivre('petite'), livre);
    const photo = await photographier(fs, DOC);
    for (const fichier of courants) {
      assert.equal(typeof courantAvant[fichier], 'string');
      assert.equal(photo[fichier], courantAvant[fichier]);
    }
  });

  test('une clé inconnue lève RangeError, sans rien écrire', async () => {
    const { fs, facade } = monter();
    await facade.demarrer();
    const avant = ecritures(fs);
    await assert.rejects(facade.chargerDemonstration('inconnue'), RangeError);
    assert.equal(ecritures(fs), avant);
  });
});

// --- Copier (§ 8.7) ----------------------------------------------------------

describe('copier (§ 8.7)', () => {
  test('depuis un plan bloqué : nouvel identifiant, une entrée, non bloquée, original intact', async () => {
    const montage = monter();
    const { fs, facade } = montage;
    await facade.demarrer();
    await deposerEvenement(fs, DOC, { id: 'evt-lucioles', nom: LUCIOLES, etat: 'bloque' });
    const original = await photographier(fs, DOC);
    assert.equal(Object.keys(original).length, 2);
    const avant = ecritures(fs);
    const { base } = await facade.copier(LUCIOLES, { nom: ' Variante des Lucioles ' });
    // Le journal de la copie, puis son état.
    assert.equal(ecritures(fs), avant + 2);
    assert.equal(base, 'Variante des Lucioles');
    assert.equal(montage.seance.ouvert.base, base);
    assert.equal(montage.seance.mode, 'lecture');
    const copie = analyser(fs.contenu('documents', base + SUFFIXES.etat)).charge.evenement;
    assert.notEqual(copie.id, 'evt-lucioles');
    assert.notEqual(copie.etat, 'bloque');
    assert.equal(copie.nom, 'Variante des Lucioles');
    const creation = libelle('ENTREE_CREATION', { nom: LUCIOLES });
    const journal = lireJournal(fs.contenu('documents', base + SUFFIXES.journal));
    assert.deepEqual(
      journal.entrees.map(({ libelle: texte }) => texte),
      [`Créée par copie de « ${LUCIOLES} », à l'instant « ${creation} »`],
    );
    // L'entrée nomme l'instant que la filiation inscrit.
    assert.equal(copie.filiation.instant.libelle, creation);
    const apres = await photographier(fs, DOC);
    for (const [fichier, texte] of Object.entries(original)) assert.equal(apres[fichier], texte);
  });

  test('un nom vide est refusé, sans écrire, et aucun « (copie) » ne paraît', async () => {
    const { fs, facade } = monter();
    await facade.demarrer();
    await deposerEvenement(fs, DOC, { id: 'evt-lucioles', nom: LUCIOLES });
    const avant = ecritures(fs);
    for (const nom of ['', ' \t ']) {
      const refus = await refusDe(facade.copier(LUCIOLES, { nom }));
      assert.equal(refus.code, 'NOM_REQUIS');
      assert.equal(refus.details.remede, null);
    }
    assert.equal(ecritures(fs), avant);
    const lignes = await facade.lister();
    assert.equal(lignes.length, 1);
    assert.ok(lignes.every(({ nom }) => !nom.includes('(copie)')));
  });

  test('un nom en NFD : la copie porte le nom et la base en NFC', async () => {
    const { fs, facade } = monter();
    await facade.demarrer();
    await deposerEvenement(fs, DOC, { id: 'evt-lucioles', nom: LUCIOLES });
    assert.notEqual(NFD, NFC);
    const { base } = await facade.copier(LUCIOLES, { nom: NFD });
    assert.equal(base, NFC);
    assert.equal(analyser(fs.contenu('documents', NFC + SUFFIXES.etat)).charge.evenement.nom, NFC);
    assert.equal(fs.contenu('documents', NFD + SUFFIXES.etat), null);
  });

  test("d'un format plus récent : LECTURE_SEULE relayée avec remede null, rien d'écrit", async () => {
    const { fs, facade } = monter();
    await facade.demarrer();
    const texte = texteEtat({ id: 'evt-lucioles', nom: LUCIOLES }).replace(`"format":${FORMAT}`, `"format":${FORMAT + 1}`);
    fs.deposer('documents', LUCIOLES + SUFFIXES.etat, texte);
    const avant = ecritures(fs);
    const refus = await refusDe(facade.copier(LUCIOLES, { nom: 'Variante des Lucioles' }));
    assert.equal(refus.code, 'LECTURE_SEULE');
    assert.deepEqual(refus.details, { raison: 'FORMAT_PLUS_RECENT', remede: null });
    assert.equal(ecritures(fs), avant);
  });

  test('des Documents trop profonds pour le nom : CHEMIN_TROP_LONG, rien d’écrit', async () => {
    const { fs, facade } = monter({ fs: creerFichiersSimules({ documents: PROFOND }) });
    await facade.demarrer();
    fs.deposer('documents', `Court${SUFFIXES.etat}`, texteEtat({ id: 'evt-court', nom: 'Court' }));
    const avant = ecritures(fs);
    const refus = await refusDe(facade.copier('Court', { nom: 'x'.repeat(120) }));
    assert.equal(refus.code, 'CHEMIN_TROP_LONG');
    assert.equal(ecritures(fs), avant);
    assert.deepEqual(Object.keys(await photographier(fs, { id: 'documents', chemin: PROFOND })), [`Court${SUFFIXES.etat}`]);
  });
});

// --- Renommer (§ 8.7, § 8.8) -------------------------------------------------

describe('renommer (§ 8.7, § 8.8)', () => {
  test('nouveau nom, nouveau chemin, une entrée du renommage, aucun verrou restant', async () => {
    const { fs, facade, appels } = monter();
    await facade.demarrer();
    await deposerEvenement(fs, DOC, { id: 'evt-lucioles', nom: LUCIOLES });
    const avant = ecritures(fs);
    const { base } = await facade.renommer(LUCIOLES, { nom: CERFS });
    // La sonde qui prend le verrou ; la nouvelle paire — .precedent, journal,
    // état — ; l'effacement de l'ancienne — état, .precedent, journal — ; le
    // verrou rendu.
    assert.equal(ecritures(fs), avant + 1 + 3 + 3 + 1);
    assert.equal(base, CERFS);
    const lignes = await facade.lister();
    assert.deepEqual(
      lignes.map(({ base: b, nom, chemin }) => [b, nom, chemin]),
      [[CERFS, CERFS, `${DOCUMENTS}\\${CERFS}${SUFFIXES.etat}`]],
    );
    assert.equal(fs.contenu('documents', LUCIOLES + SUFFIXES.verrou), null);
    assert.equal(fs.contenu('documents', CERFS + SUFFIXES.verrou), null);
    const journal = lireJournal(fs.contenu('documents', CERFS + SUFFIXES.journal));
    assert.equal(journal.entrees.at(-1).libelle, `Renommé de « ${LUCIOLES} » en « ${CERFS} »`);
    assert.deepEqual(
      appels.filter(([nom]) => nom !== 'changerRacine'),
      [],
    );
  });

  // Coupe le processus dès que l'écriture atomique a posé ce fichier.
  function couperApresEcriture(fs, chemin) {
    const ecrire = fs.ecrireAtomique;
    fs.ecrireAtomique = async (racine, cible, texte) => {
      await ecrire(racine, cible, texte);
      if (cible === chemin) fs.pannes.couperApres(0);
    };
  }

  test('une coupure après le nouvel état laisse deux paires, signalées doublons l’une de l’autre', async () => {
    const disque = new Map();
    const fs = creerFichiersSimules({ disque });
    const { facade } = monter({ fs });
    await facade.demarrer();
    await deposerEvenement(fs, DOC, { id: 'evt-lucioles', nom: LUCIOLES });
    couperApresEcriture(fs, CERFS + SUFFIXES.etat);
    await assert.rejects(facade.renommer(LUCIOLES, { nom: CERFS }));
    const relu = monter({ fs: creerFichiersSimules({ disque }) });
    await relu.facade.demarrer();
    const lignes = await relu.facade.lister();
    assert.deepEqual(
      lignes.map(({ base, doublonAvec }) => [base, doublonAvec]),
      [
        [CERFS, [LUCIOLES]],
        [LUCIOLES, [CERFS]],
      ],
    );
  });

  test('une coupure après le seul nouveau journal laisse une ligne, sous l’ancienne base', async () => {
    const disque = new Map();
    const fs = creerFichiersSimules({ disque });
    const { facade } = monter({ fs });
    await facade.demarrer();
    await deposerEvenement(fs, DOC, { id: 'evt-lucioles', nom: LUCIOLES });
    couperApresEcriture(fs, CERFS + SUFFIXES.journal);
    await assert.rejects(facade.renommer(LUCIOLES, { nom: CERFS }));
    const relu = monter({ fs: creerFichiersSimules({ disque }) });
    await relu.facade.demarrer();
    const lignes = await relu.facade.lister();
    assert.deepEqual(
      lignes.map(({ base, nom }) => [base, nom]),
      [[LUCIOLES, LUCIOLES]],
    );
  });

  test('plan bloqué : LECTURE_SEULE {raison: BLOQUE}, remède « débloquer », rien d’écrit', async () => {
    const { fs, facade } = monter();
    await facade.demarrer();
    await deposerEvenement(fs, DOC, { id: 'evt-lucioles', nom: LUCIOLES, etat: 'bloque' });
    const avant = ecritures(fs);
    const refus = await refusDe(facade.renommer(LUCIOLES, { nom: CERFS }));
    assert.equal(refus.code, 'LECTURE_SEULE');
    assert.deepEqual(refus.details, { raison: 'BLOQUE', remede: { geste: 'debloquer' } });
    assert.equal(ecritures(fs), avant);
  });

  test('un nom vide : NOM_REQUIS avant toute sonde, rien d’écrit', async () => {
    const { fs, facade } = monter();
    await facade.demarrer();
    await deposerEvenement(fs, DOC, { id: 'evt-lucioles', nom: LUCIOLES });
    const avant = ecritures(fs);
    assert.equal((await refusDe(facade.renommer(LUCIOLES, { nom: '   ' }))).code, 'NOM_REQUIS');
    assert.equal(ecritures(fs), avant);
  });

  test('un nom en NFD : le nom et la base renommés sont en NFC', async () => {
    const { fs, facade } = monter();
    await facade.demarrer();
    await deposerEvenement(fs, DOC, { id: 'evt-lucioles', nom: LUCIOLES });
    assert.notEqual(NFD, NFC);
    const { base } = await facade.renommer(LUCIOLES, { nom: NFD });
    assert.equal(base, NFC);
    assert.equal(analyser(fs.contenu('documents', NFC + SUFFIXES.etat)).charge.evenement.nom, NFC);
    assert.equal(fs.contenu('documents', NFD + SUFFIXES.etat), null);
  });

  test('CHEMIN_TROP_LONG, levé sous le verrou : le verrou se rend, le disque reste tel qu’il était', async () => {
    const { fs, facade } = monter({ fs: creerFichiersSimules({ documents: PROFOND }) });
    await facade.demarrer();
    const profond = { id: 'documents', chemin: PROFOND };
    fs.deposer('documents', `Court${SUFFIXES.etat}`, texteEtat({ id: 'evt-court', nom: 'Court' }));
    const photo = await photographier(fs, profond);
    assert.deepEqual(Object.keys(photo), [`Court${SUFFIXES.etat}`]);
    const avant = ecritures(fs);
    const refus = await refusDe(facade.renommer('Court', { nom: 'x'.repeat(120) }));
    assert.equal(refus.code, 'CHEMIN_TROP_LONG');
    // La sonde qui prend le verrou, puis le verrou rendu.
    assert.equal(ecritures(fs), avant + 2);
    assert.equal(fs.contenu('documents', `Court${SUFFIXES.verrou}`), null);
    assert.deepEqual(await photographier(fs, profond), photo);
  });

  test('l’événement ouvert en écriture : fermé d’abord, aucun VERROU_PRIS, rouvert sous la nouvelle base', async () => {
    const montage = monter();
    const { facade, appels } = montage;
    await facade.demarrer();
    await facade.creer({ nom: LUCIOLES });
    await montage.seance.passerEnEcriture();
    assert.equal(montage.seance.mode, 'ecriture');
    const debut = appels.length;
    const { base } = await facade.renommer(LUCIOLES, { nom: CERFS });
    assert.deepEqual(appels.slice(debut), [['fermer'], ['ouvrir', CERFS]]);
    assert.equal(base, CERFS);
    assert.equal(montage.seance.ouvert.base, CERFS);
    assert.equal(montage.seance.mode, 'lecture');
    assert.equal(montage.fs.contenu('documents', LUCIOLES + SUFFIXES.verrou), null);
  });

  test("l'événement ouvert, renommé d'un nom que les Documents ne portent pas : refusé, il se rouvre en lecture sous sa base", async () => {
    const montage = monter({ fs: creerFichiersSimules({ documents: PROFOND }) });
    const { fs, facade, appels } = montage;
    await facade.demarrer();
    fs.deposer('documents', `Court${SUFFIXES.etat}`, texteEtat({ id: 'evt-court', nom: 'Court' }));
    await montage.seance.ouvrir('Court');
    appels.length = 0;
    const refus = await refusDe(facade.renommer('Court', { nom: 'x'.repeat(120) }));
    assert.equal(refus.code, 'CHEMIN_TROP_LONG');
    assert.deepEqual(appels, [['fermer'], ['ouvrir', 'Court']]);
    assert.deepEqual([montage.seance.ouvert.base, montage.seance.mode], ['Court', 'lecture']);
    assert.equal(fs.contenu('documents', `Court${SUFFIXES.verrou}`), null);
  });

  test('bloqué par une autre séance entre le contrôle et le verrou : la relecture sous le verrou le refuse, et le verrou se rend', async () => {
    const { fs, facade } = monter();
    await facade.demarrer();
    await deposerEvenement(fs, DOC, { id: 'evt-lucioles', nom: LUCIOLES });
    const bloque = texteEtat({ id: 'evt-lucioles', nom: LUCIOLES }).replace('"etat":"brouillon"', '"etat":"bloque"');
    assert.notEqual(bloque, texteEtat({ id: 'evt-lucioles', nom: LUCIOLES }));
    const verrouiller = fs.verrouiller;
    fs.verrouiller = async (...parametres) => {
      fs.deposer('documents', LUCIOLES + SUFFIXES.etat, bloque);
      return verrouiller(...parametres);
    };
    const refus = await refusDe(facade.renommer(LUCIOLES, { nom: CERFS }));
    assert.equal(refus.code, 'LECTURE_SEULE');
    assert.deepEqual(refus.details, { raison: 'BLOQUE', remede: { geste: 'debloquer' } });
    assert.equal(fs.contenu('documents', LUCIOLES + SUFFIXES.verrou), null);
    assert.equal(fs.contenu('documents', CERFS + SUFFIXES.etat), null);
    assert.equal(fs.contenu('documents', LUCIOLES + SUFFIXES.etat), bloque);
  });

  test('le verrou d’une séance vivante : VERROU_PRIS, rien ne bouge ; celui d’une séance morte s’efface', async () => {
    const disque = new Map();
    const fs = creerFichiersSimules({ disque });
    const { facade } = monter({ fs });
    await facade.demarrer();
    await deposerEvenement(fs, DOC, { id: 'evt-lucioles', nom: LUCIOLES });
    const voisin = creerFichiersSimules({ disque });
    await voisin.verrouiller(DOC, LUCIOLES + SUFFIXES.verrou, 'seance-voisine', '2031-05-17T09:30:00-04:00');
    const avant = await photographier(fs, DOC);
    assert.equal(Object.keys(avant).length, 3);
    const ecrituresAvant = ecritures(fs);
    const refus = await refusDe(facade.renommer(LUCIOLES, { nom: CERFS }));
    assert.equal(refus.code, 'VERROU_PRIS');
    assert.equal(refus.details.seance, 'seance-voisine');
    assert.equal(refus.details.vivant, true);
    // La seule sonde, refusée.
    assert.equal(ecritures(fs), ecrituresAvant + 1);
    assert.deepEqual(await photographier(fs, DOC), avant);

    voisin.pannes.couperApres(0);
    const avantReprise = ecritures(fs);
    const { base } = await facade.renommer(LUCIOLES, { nom: CERFS });
    // La sonde refusée, le verrou mort effacé, la sonde qui le prend ; puis
    // le renommage : nouvelle paire, ancienne effacée, verrou rendu.
    assert.equal(ecritures(fs), avantReprise + 3 + 3 + 3 + 1);
    assert.equal(base, CERFS);
    assert.equal(fs.contenu('documents', LUCIOLES + SUFFIXES.verrou), null);
  });
});

// --- Supprimer (§ 8.7, § 8.8) ------------------------------------------------

describe('supprimer (§ 8.7, § 8.8)', () => {
  test('les fichiers partent dans la corbeille datée par l’horloge, l’ouvert fermé d’abord', async () => {
    const { fs, facade, appels } = monter();
    await facade.demarrer();
    await facade.creer({ nom: LUCIOLES });
    const deplacer = fs.deplacer;
    fs.deplacer = async (...parametres) => {
      appels.push(['deplacer', parametres[1]]);
      return deplacer(...parametres);
    };
    const avant = ecritures(fs);
    const { dossier } = await facade.supprimer(LUCIOLES);
    // La sonde qui prend le verrou, le dossier daté, puis trois déplacements :
    // le verrou, le journal, l'état.
    assert.equal(ecritures(fs), avant + 1 + 1 + 3);
    assert.equal(dossier, CORBEILLE_DU_DEPART);
    const fermer = appels.findIndex(([nom]) => nom === 'fermer');
    const premierDeplacement = appels.findIndex(([nom]) => nom === 'deplacer');
    assert.ok(fermer >= 0 && premierDeplacement > fermer);
    assert.deepEqual(await facade.lister(), []);
    assert.deepEqual(await facade.corbeille(), [
      {
        dossier: CORBEILLE_DU_DEPART,
        chemin: `${DOCUMENTS}\\corbeille\\2026-10-06_19-00-00`,
        fichiers: [LUCIOLES + SUFFIXES.journal, LUCIOLES + SUFFIXES.etat, LUCIOLES + SUFFIXES.verrou],
      },
    ]);
  });

  test('le verrou d’une séance morte ne retient rien : il part avec l’événement', async () => {
    const disque = new Map();
    const fs = creerFichiersSimules({ disque });
    const { facade } = monter({ fs });
    await facade.demarrer();
    await deposerEvenement(fs, DOC, { id: 'evt-lucioles', nom: LUCIOLES });
    const mort = creerFichiersSimules({ disque });
    await mort.verrouiller(DOC, LUCIOLES + SUFFIXES.verrou, 'seance-morte', '2031-05-17T09:30:00-04:00');
    mort.pannes.couperApres(0);
    const avant = ecritures(fs);
    await facade.supprimer(LUCIOLES);
    // La sonde, que le verrou mort n'arrête pas, le dossier daté, trois
    // déplacements.
    assert.equal(ecritures(fs), avant + 1 + 1 + 3);
    const [{ fichiers }] = await facade.corbeille();
    assert.ok(fichiers.includes(LUCIOLES + SUFFIXES.verrou));
    assert.deepEqual(await facade.lister(), []);
  });

  test('un plan bloqué se supprime : rien ne se détruit, ses fichiers passent dans la corbeille', async () => {
    const { fs, facade } = monter();
    await facade.demarrer();
    await deposerEvenement(fs, DOC, { id: 'evt-lucioles', nom: LUCIOLES, etat: 'bloque' });
    const original = await photographier(fs, DOC);
    assert.equal(Object.keys(original).length, 2);
    const avant = ecritures(fs);
    const { dossier } = await facade.supprimer(LUCIOLES);
    assert.equal(ecritures(fs), avant + 1 + 1 + 3);
    assert.equal(dossier, CORBEILLE_DU_DEPART);
    assert.deepEqual(await facade.lister(), []);
    const [{ fichiers }] = await facade.corbeille();
    assert.deepEqual(fichiers, [LUCIOLES + SUFFIXES.journal, LUCIOLES + SUFFIXES.etat, LUCIOLES + SUFFIXES.verrou]);
    for (const [fichier, texte] of Object.entries(original)) {
      assert.equal(fs.contenu('documents', `${CORBEILLE_DU_DEPART}/${fichier}`), texte);
    }
  });

  test('le verrou d’une séance vivante, puis d’un autre hôte : VERROU_PRIS, fichiers en place', async () => {
    const cas = [
      [{}, true],
      [{ hote: 'poste-voisin' }, null],
    ];
    assert.equal(cas.length, 2);
    for (const [reglages, vivant] of cas) {
      const disque = new Map();
      const fs = creerFichiersSimules({ disque });
      const { facade } = monter({ fs });
      await facade.demarrer();
      await deposerEvenement(fs, DOC, { id: 'evt-lucioles', nom: LUCIOLES });
      const autre = creerFichiersSimules({ disque, ...reglages });
      await autre.verrouiller(DOC, LUCIOLES + SUFFIXES.verrou, 'seance-autre', '2031-05-17T09:30:00-04:00');
      const avant = await photographier(fs, DOC);
      assert.equal(Object.keys(avant).length, 3);
      const ecrituresAvant = ecritures(fs);
      const refus = await refusDe(facade.supprimer(LUCIOLES));
      assert.equal(refus.code, 'VERROU_PRIS');
      assert.equal(refus.details.vivant, vivant);
      assert.equal(refus.details.remede, null);
      // La seule sonde, refusée.
      assert.equal(ecritures(fs), ecrituresAvant + 1);
      assert.deepEqual(await photographier(fs, DOC), avant);
      assert.deepEqual(await facade.corbeille(), []);
    }
  });
});

// --- Importer (§ 8.6, § 8.7) -------------------------------------------------

describe('importer (§ 8.6, § 8.7)', () => {
  const MERLES = { id: 'evt-merles', nom: 'Club des Merles' };

  test('un fichier choisi : ses octets sous une base dérivée de son nom ; une seconde fois, IDENTIFIANT_PRESENT', async () => {
    const { fs, facade } = monter();
    await facade.demarrer();
    const octets = UTF8.encode(texteEtat(MERLES));
    fs.choisirFichierAImporter = async () => ({ nom: 'recu-par-courriel.gtt.json', octets });
    const avant = ecritures(fs);
    const { base } = await facade.importerFichier();
    // L'état seul, aucun verrou.
    assert.equal(ecritures(fs), avant + 1);
    assert.equal(base, MERLES.nom);
    assert.deepEqual(fs.octets('documents', base + SUFFIXES.etat), octets);
    const photo = await photographier(fs, DOC);
    assert.equal(Object.keys(photo).length, 1);
    const avantRefus = ecritures(fs);
    const refus = await refusDe(facade.importerFichier());
    assert.equal(refus.code, 'IDENTIFIANT_PRESENT');
    assert.deepEqual(refus.details, { id: MERLES.id, base: MERLES.nom });
    assert.equal(ecritures(fs), avantRefus);
    assert.deepEqual(await photographier(fs, DOC), photo);
  });

  test('un fichier d’un format plus récent s’importe tel quel', async () => {
    const { fs, facade } = monter();
    await facade.demarrer();
    const texte = texteEtat(MERLES).replace(`"format":${FORMAT}`, `"format":${FORMAT + 1}`);
    assert.ok(texte.includes(`"format":${FORMAT + 1}`));
    const octets = UTF8.encode(texte);
    fs.choisirFichierAImporter = async () => ({ nom: 'futur.gtt.json', octets });
    const avant = ecritures(fs);
    const { base } = await facade.importerFichier();
    assert.equal(ecritures(fs), avant + 1);
    assert.deepEqual(fs.octets('documents', base + SUFFIXES.etat), octets);
  });

  test('le dialogue annulé rend null, sans rien écrire', async () => {
    const { fs, facade } = monter();
    await facade.demarrer();
    const avant = ecritures(fs);
    assert.equal(await facade.importerFichier(), null);
    assert.equal(ecritures(fs), avant);
  });

  test('l’autre emplacement : Documents neufs, data/ en porte deux → copiés, originaux intacts', async () => {
    const disque = new Map();
    const avant = creerFichiersSimules({ disque, executable: SOUS_APPDATA });
    avant.deposerDossier('portable');
    await deposerEvenement(avant, PORTABLE_APPDATA, { id: 'evt-lucioles', nom: LUCIOLES });
    await deposerEvenement(avant, PORTABLE_APPDATA, { id: 'evt-cerfs', nom: CERFS });
    const fs = creerFichiersSimules({ disque, executable: SOUS_APPDATA });
    const { facade } = monter({ fs });
    const { dossier } = await facade.demarrer();
    assert.deepEqual(dossier.autre, { racine: PORTABLE_APPDATA, evenements: 2 });
    const originaux = await photographier(fs, PORTABLE_APPDATA);
    assert.equal(Object.keys(originaux).length, 4);
    const ecrituresAvant = ecritures(fs);
    const { importes, refuses } = await facade.importerDepuisAutre();
    // Chaque paire : son journal, puis son état.
    assert.equal(ecritures(fs), ecrituresAvant + 4);
    assert.equal(importes.length, 2);
    assert.deepEqual(refuses, []);
    assert.deepEqual(await photographier(fs, PORTABLE_APPDATA), originaux);
    assert.deepEqual(
      (await facade.lister()).map(({ id }) => id),
      ['evt-cerfs', 'evt-lucioles'],
    );
    assert.equal((await facade.demarrer()).dossier.autre, null);
  });
});

// --- Les dialogues de fichiers, relayés (contrat de données) -----------------

describe('les dialogues de fichiers, lus sur fs à l’appel', () => {
  test('choisirCsv rend tels quels {nom, octets} et null', async () => {
    const { fs, facade } = monter();
    assert.equal(await facade.choisirCsv(), null);
    const choisi = { nom: 'liste.csv', octets: UTF8.encode('nom\nOmbrelle\n') };
    fs.choisirFichierAImporter = async () => choisi;
    assert.equal(await facade.choisirCsv(), choisi);
  });

  test('enregistrerSous remet nom et octets tels quels, et rend le chemin ou null', async () => {
    const { fs, facade } = monter();
    assert.equal(await facade.enregistrerSous('a.csv', new Uint8Array([1])), null);
    const recus = [];
    fs.enregistrerSous = async (nom, octets) => {
      recus.push([nom, octets]);
      return 'C:\\Users\\Exemple\\Documents\\liste-refus.csv';
    };
    const octets = UTF8.encode('motif\n');
    assert.equal(await facade.enregistrerSous('liste-refus.csv', octets), 'C:\\Users\\Exemple\\Documents\\liste-refus.csv');
    assert.equal(recus.length, 1);
    assert.equal(recus[0][0], 'liste-refus.csv');
    assert.equal(recus[0][1], octets);
  });
});

// --- L'explorateur (§ 8.6) ---------------------------------------------------

describe('explorateur (§ 8.6)', () => {
  test('sous web : indisponible, EXPLORATEUR_ABSENT, aucun appel', async () => {
    const { fs, facade } = monter({ fs: creerFichiersSimules({ nature: 'web' }) });
    await facade.demarrer();
    const recus = [];
    fs.ouvrirDansExplorateur = async (racine) => recus.push(racine);
    assert.deepEqual(facade.explorateur(), { disponible: false, raison: 'EXPLORATEUR_ABSENT' });
    assert.equal(typeof libelle('EXPLORATEUR_ABSENT'), 'string');
    const refus = await refusDe(facade.ouvrirExplorateur());
    assert.equal(refus.code, 'EXPLORATEUR_ABSENT');
    assert.deepEqual(recus, []);
  });

  test('ailleurs : ouvrirDansExplorateur reçoit la racine', async () => {
    const { fs, facade } = monter();
    await facade.demarrer();
    const recus = [];
    fs.ouvrirDansExplorateur = async (racine) => recus.push(racine);
    assert.deepEqual(facade.explorateur(), { disponible: true, raison: null });
    await facade.ouvrirExplorateur();
    assert.deepEqual(recus, [DOC]);
  });
});
