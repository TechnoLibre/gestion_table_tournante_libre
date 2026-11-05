// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Un événement écrit par le code du format 1 (§ 8.8) : l'état, son
// .precedent et le journal de test/fixtures/stockage/format1/, tels que les a
// écrits le dépôt du format 1 pour un événement inventé ; empreintes.json y
// nomme leur base. Ce format n'est plus pris en charge : chaque épreuve
// travaille sur une copie de ces fichiers dans un dossier temporaire neuf,
// retiré à la fin, par le système de fichiers de la plateforme electron
// (fichiers_electron.js devant les primitives de la coquille,
// electron/fichiers.js), et vérifie que l'ouverture, la liste et chaque
// secours le refusent, FORMAT_TROP_ANCIEN, sans qu'aucun fichier change.
// L'épreuve est de la série longue : elle charge les primitives de la
// coquille, et le motif de surveillance d'electron/ (vitest.config.js) ne
// relance, dans la série node, que les épreuves qu'il nomme.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PREFIXE_CANAL, PRIMITIVES, creerFichiers, decrireSysteme, servir } from '../../electron/fichiers.js';
import { describe, test } from '../../test/lanceur.js';
import { lister, ouvrir, ouvrirSecours } from './depot.js';
import { FORMAT, analyser } from './document.js';
import { creerFichiersElectron } from './fichiers_electron.js';
import { lireJournal } from './journal.js';
import { SUFFIXES, cleEvenement } from './noms.js';

const FIXTURE = fileURLToPath(new URL('../../test/fixtures/stockage/format1/', import.meta.url));
const { base: BASE } = JSON.parse(readFileSync(join(FIXTURE, 'empreintes.json'), 'utf8'));
const NOMS = [SUFFIXES.journal, SUFFIXES.etat, SUFFIXES.precedent].map((suffixe) => `${BASE}${suffixe}`);
const [JOURNAL, ETAT, PRECEDENT] = NOMS;
// La clé de l'événement, posé dans le dossier de sa base.
const CLE = cleEvenement(BASE, BASE);

// Le système de fichiers de la plateforme electron sous dossier : la page
// devant les primitives de la coquille, que servir offre canal par canal ;
// l'IPC d'Electron y est remplacé par une copie structurée des arguments et
// des réponses. Le dossier de l'événement, sous la racine documents, reçoit
// une copie des fichiers de la fixture. Rend { fs, racine, chemin },
// chemin(nom) étant le chemin sur le disque d'un fichier de ce dossier.
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
  const dossierEvenement = join(racine.chemin, BASE);
  mkdirSync(dossierEvenement, { recursive: true });
  for (const nom of NOMS) writeFileSync(join(dossierEvenement, nom), readFileSync(join(FIXTURE, nom)));
  return { fs, racine, chemin: (nom) => join(dossierEvenement, nom) };
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

// Chaque fichier du dossier de l'événement, par nom : ses octets et sa date
// de modification ; et les noms des entrées de la racine.
function releve(racine) {
  const dossier = join(racine.chemin, BASE);
  return Object.fromEntries(
    readdirSync(dossier)
      .sort()
      .map((nom) => {
        const chemin = join(dossier, nom);
        return [nom, { octets: readFileSync(chemin).toString('base64'), modifie: statSync(chemin).mtimeMs }];
      })
      .concat([['racine', readdirSync(racine.chemin).sort()]]),
  );
}

const fixture = (nom) => readFileSync(join(FIXTURE, nom), 'utf8');

// Le refus que lève promesse : son code et ses détails.
async function refusDe(promesse) {
  try {
    await promesse;
  } catch (erreur) {
    return { code: erreur.code, details: erreur.details };
  }
  assert.fail('aucun refus');
}

describe('stockage : un événement écrit par le code du format 1 se refuse (§ 8.8)', () => {
  test('la fixture est du format 1 : l’en-tête de l’état et du .precedent et l’ouverture du journal le déclarent, et aucun ne se lit', () => {
    assert.ok(FORMAT > 1, String(FORMAT));
    for (const nom of [ETAT, PRECEDENT]) {
      assert.equal(JSON.parse(fixture(nom)).entete.format, 1, nom);
      assert.throws(
        () => analyser(fixture(nom)),
        (erreur) => erreur.details.raison === 'FORMAT_TROP_ANCIEN' && erreur.details.format === 1,
        nom,
      );
    }
    assert.equal(JSON.parse(fixture(JOURNAL).split('\n')[0]).format, 1);
    const journal = lireJournal(fixture(JOURNAL));
    assert.deepEqual([journal.evenement, journal.format, journal.entrees.length], [null, null, 0]);
  });

  test('ouvrir, lister et chaque secours refusent l’événement, FORMAT_TROP_ANCIEN, sans secours ; chaque fichier garde ses octets et sa date, et aucun ne s’ajoute', () =>
    surUneCopie(async ({ fs, racine }) => {
      const avant = releve(racine);
      assert.deepEqual(await refusDe(ouvrir(fs, racine, CLE)), {
        code: 'ETAT_ILLISIBLE',
        details: {
          base: BASE,
          raison: 'FORMAT_TROP_ANCIEN',
          chemin: 'entete.format',
          format: 1,
          secours: { precedent: null, journal: null },
        },
      });
      const [resume] = await lister(fs, racine);
      assert.deepEqual([resume.base, resume.id, resume.illisible], [BASE, null, 'FORMAT_TROP_ANCIEN']);
      for (const source of ['precedent', 'journal']) {
        const { code, details } = await refusDe(ouvrirSecours(fs, racine, CLE, source));
        assert.deepEqual([code, details.raison, details.format], ['ETAT_ILLISIBLE', 'FORMAT_TROP_ANCIEN', 1], source);
      }
      assert.deepEqual(releve(racine), avant);
    }));
});
