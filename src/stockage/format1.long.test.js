// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Un événement écrit par le code du format 1 (§ 8.8, A15) : l'état, son
// .precedent et le journal de test/fixtures/stockage/format1/, tels que les a
// écrits le dépôt du format 1 pour un événement inventé — une création et son
// jalon, une inscription, une cible de redondance posée puis retirée, une
// réservation, un second jalon, une note. empreintes.json y porte, par
// révision, l'empreinte SHA-256 du texte de serialiserCharge que restituait
// le journal sous ce même code. Chaque épreuve travaille sur une copie de ces
// fichiers dans un dossier temporaire neuf, retiré à la fin, par le système
// de fichiers de la plateforme electron (fichiers_electron.js devant les
// primitives de la coquille, electron/fichiers.js) : l'ouverture n'écrit
// rien ; chaque révision se restitue comme le format 1 la restituait ; le
// premier geste réécrit le journal au format courant, chaque ligne
// d'historique gardée ; défaire, d'un geste à l'autre au-delà de la
// conversion, rend chaque charge d'avant. L'épreuve est de la série longue :
// elle charge les primitives de la coquille, et le motif de surveillance
// d'electron/ (vitest.config.js) ne relance, dans la série node, que les
// épreuves qu'il nomme.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PREFIXE_CANAL, PRIMITIVES, creerFichiers, decrireSysteme, servir } from '../../electron/fichiers.js';
import { describe, test } from '../../test/lanceur.js';
import { VERSION } from '../version.genere.js';
import { serialiserCharge } from './canonique.js';
import { enregistrer, lister, ouvrir } from './depot.js';
import { FORMAT, analyser } from './document.js';
import { creerFichiersElectron } from './fichiers_electron.js';
import { fil, lireJournal, reconstruire } from './journal.js';
import { SUFFIXES } from './noms.js';

const FIXTURE = fileURLToPath(new URL('../../test/fixtures/stockage/format1/', import.meta.url));
const { base: BASE, revisions: EMPREINTES } = JSON.parse(readFileSync(join(FIXTURE, 'empreintes.json'), 'utf8'));
const NOMS = [SUFFIXES.journal, SUFFIXES.etat, SUFFIXES.precedent].map((suffixe) => `${BASE}${suffixe}`);
const [JOURNAL, ETAT, PRECEDENT] = NOMS;
const DERNIERE = Object.keys(EMPREINTES).length;

const empreinte = (charge) => createHash('sha256').update(serialiserCharge(charge), 'utf8').digest('hex');
const lignesDe = (texte) => texte.replace(/\n$/, '').split('\n');
const geste = (n, plus = {}) => ({
  libelle: `Geste ${n}`,
  horodatage: `2031-06-21T20:${String(n).padStart(2, '0')}:00-04:00`,
  produitVersion: VERSION.affichee,
  ...plus,
});

// Le système de fichiers de la plateforme electron sous dossier : la page
// devant les primitives de la coquille, que servir offre canal par canal ;
// l'IPC d'Electron y est remplacé par une copie structurée des arguments et
// des réponses. La racine documents reçoit une copie des fichiers de la
// fixture. Rend { fs, racine, chemin }, chemin(nom) étant le chemin sur le
// disque d'un fichier de la racine.
async function copieDeLaFixture(dossier) {
  const systeme = decrireSysteme({
    env: {},
    plateforme: process.platform,
    cheminSysteme: (nom) => (nom === 'temp' ? tmpdir() : join(dossier, nom)),
    nomProduit: 'Gestion table tournante Libre',
  });
  const gestionnaires = new Map();
  servir(creerFichiers({ ...systeme, dialog: {}, shell: {} }), (canal, gestionnaire) =>
    gestionnaires.set(canal, gestionnaire),
  );
  const pont = Object.fromEntries(
    PRIMITIVES.map((primitive) => {
      const gestionnaire = gestionnaires.get(`${PREFIXE_CANAL}${primitive}`);
      const appeler = async (...parametres) =>
        structuredClone(await gestionnaire({ sender: null }, ...structuredClone(parametres)));
      return [primitive, appeler];
    }),
  );
  const fs = creerFichiersElectron(pont);
  const { documents: racine } = await fs.racines();
  mkdirSync(racine.chemin, { recursive: true });
  for (const nom of NOMS) writeFileSync(join(racine.chemin, nom), readFileSync(join(FIXTURE, nom)));
  return { fs, racine, chemin: (nom) => join(racine.chemin, nom) };
}

// Exécute epreuve(copie) sur une copie neuve de la fixture, sous un dossier
// temporaire retiré ensuite, que l'épreuve passe ou lève.
async function surUneCopie(epreuve) {
  const dossier = mkdtempSync(join(tmpdir(), 'gtt-format1-'));
  try {
    await epreuve(await copieDeLaFixture(dossier));
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

// Chaque fichier de la racine, par nom : ses octets et sa date de
// modification.
function releve(racine) {
  return Object.fromEntries(
    readdirSync(racine.chemin)
      .sort()
      .map((nom) => {
        const chemin = join(racine.chemin, nom);
        return [nom, { octets: readFileSync(chemin).toString('base64'), modifie: statSync(chemin).mtimeMs }];
      }),
  );
}

const fixture = (nom) => readFileSync(join(FIXTURE, nom), 'utf8');

describe('stockage : un événement écrit par le code du format 1 (§ 8.8, A15)', () => {
  test('la fixture est du format 1 : l’ouverture du journal et l’en-tête de l’état et du .precedent le déclarent', () => {
    assert.equal(lireJournal(fixture(JOURNAL)).format, 1);
    assert.equal(analyser(fixture(ETAT)).entete.format, 1);
    assert.equal(analyser(fixture(PRECEDENT)).entete.format, 1);
    assert.ok(FORMAT > 1, String(FORMAT));
  });

  test('ouvrir et lister n’écrivent rien : chaque fichier garde ses octets et sa date, et aucun ne s’ajoute', () =>
    surUneCopie(async ({ fs, racine }) => {
      const avant = releve(racine);
      const ouvert = await ouvrir(fs, racine, BASE);
      await lister(fs, racine);
      assert.deepEqual(releve(racine), avant);
      assert.deepEqual(ouvert.avertissements, []);
      assert.deepEqual([ouvert.formatPlusRecent, ouvert.journalAReecrire, ouvert.journal.format], [false, true, 1]);
      assert.equal(ouvert.revision, DERNIERE);
    }));

  test('chaque révision se restitue telle que le code du format 1 l’enregistrait ; l’état et le .precedent portent les deux dernières', () => {
    const journal = lireJournal(fixture(JOURNAL));
    assert.equal(journal.ecartees, 0);
    const lues = Object.fromEntries(journal.entrees.map(({ revision }) => [revision, empreinte(reconstruire(journal, revision))]));
    assert.deepEqual(lues, EMPREINTES);
    assert.equal(empreinte(analyser(fixture(ETAT)).charge), EMPREINTES[DERNIERE]);
    assert.equal(empreinte(analyser(fixture(PRECEDENT)).charge), EMPREINTES[DERNIERE - 1]);
    assert.deepEqual(
      journal.jalons.map(({ revision, nom }) => [revision, nom]),
      [
        [1, 'Création'],
        [4, 'Avant le défaut'],
      ],
    );
  });

  test('le premier geste réécrit le journal au format courant, chaque ligne d’historique gardée octet pour octet, et chaque révision se restitue encore ; l’état passe au format courant', () =>
    surUneCopie(async ({ fs, racine, chemin }) => {
      const ouvert = await ouvrir(fs, racine, BASE);
      const apres = structuredClone(ouvert.charge);
      apres.participants[1].notes = 'converti';
      const suite = await enregistrer(ouvert, apres, geste(1));
      const texte = readFileSync(chemin(JOURNAL), 'utf8');
      const journal = lireJournal(texte);
      assert.deepEqual([journal.format, journal.ecartees], [FORMAT, 0]);
      const anciennes = lignesDe(fixture(JOURNAL));
      const nouvelles = lignesDe(texte);
      assert.deepEqual(nouvelles.slice(1, anciennes.length), anciennes.slice(1));
      assert.equal(nouvelles.length, anciennes.length + 1);
      for (const [revision, attendue] of Object.entries(EMPREINTES)) {
        assert.equal(empreinte(reconstruire(journal, Number(revision))), attendue, `révision ${revision}`);
      }
      assert.equal(empreinte(reconstruire(journal, DERNIERE + 1)), empreinte(apres));
      assert.equal(journal.jalons.length, 2);
      assert.equal(analyser(readFileSync(chemin(ETAT), 'utf8')).entete.format, FORMAT);
      assert.equal(readFileSync(chemin(PRECEDENT), 'utf8'), fixture(ETAT));
      assert.deepEqual([suite.journalAReecrire, suite.journal.format], [false, FORMAT]);
    }));

  test('défaire, geste après geste depuis le premier geste, revient à chaque charge du format 1 jusqu’à la création ; rouvert, l’événement est à la première', () =>
    surUneCopie(async ({ fs, racine }) => {
      let ouvert = await ouvrir(fs, racine, BASE);
      const apres = structuredClone(ouvert.charge);
      apres.participants[1].notes = 'converti';
      ouvert = await enregistrer(ouvert, apres, geste(1));
      const atteintes = [];
      for (let n = 2; fil(ouvert.journal).cibleDefaire !== null; n += 1) {
        const cible = fil(ouvert.journal).cibleDefaire;
        ouvert = await enregistrer(ouvert, reconstruire(ouvert.journal, cible), geste(n, { sens: 'defaire', retour: cible }));
        assert.equal(empreinte(ouvert.charge), EMPREINTES[cible], `retour à ${cible}`);
        atteintes.push(cible);
      }
      assert.deepEqual(atteintes, [6, 5, 4, 3, 2, 1]);
      const rouvert = await ouvrir(fs, racine, BASE);
      assert.equal(empreinte(rouvert.charge), EMPREINTES[1]);
      assert.equal(rouvert.journal.format, FORMAT);
      assert.equal(fil(rouvert.journal).cibleRefaire, 2);
    }));
});
