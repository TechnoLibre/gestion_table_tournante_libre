// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Essai de démarrage : construit la page, lance la vraie coquille Electron
// par Playwright, attend sa fenêtre, lit le titre, le bandeau et le premier
// écran, puis ferme. Il prouve ce que la coquille factice des épreuves
// (test/coquille.test.js) ne peut pas dire : qu'Electron démarre sur ce
// système, avec ses bibliothèques, y charge la page, et que l'application y
// monte jusqu'à la liste des événements.
//
//   node scripts/essai_demarrage.js
//
// Le titre de la fenêtre doit valoir le nom suivi de la version affichée, et
// le bandeau — qui porte aussi provenance, thème, mode et « À propos » —
// contenir la version affichée.
//
// La coquille se lance comme publiée par le lanceur portable dans un dossier
// neuf, créé sous node_modules/.cache/ et retiré en sortant : la sonde de la
// détermination y écrit son dossier de travail. Sans lui, elle créerait le
// dossier du produit dans les vrais Documents de la machine ; et un dossier
// sous le dossier temporaire du système relève des données applicatives
// (§ 8.6, point 2), qui renvoient aux mêmes Documents.
//
// Sous Linux sans session graphique, Electron se lance sur la plateforme
// Ozone « headless » de Chromium : la fenêtre existe et la page s'y charge
// et s'y met en page, sans serveur d'affichage. Sous root, ou avec
// GTT_SANS_BAC_A_SABLE=1 là où le système refuse les espaces de noms
// d'utilisateur — un conteneur —, Electron se lance sans son bac à sable.
// Sort à 0 sur un démarrage conforme, à 1 sinon.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron } from 'playwright';
import { VERSION } from '../src/version.genere.js';
import { titreAvecVersion } from '../src/interface/libelles.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const ATTENTE_MS = 60_000;

const sousRoot = typeof process.getuid === 'function' && process.getuid() === 0;
const sansBacASable = sousRoot || process.env.GTT_SANS_BAC_A_SABLE === '1';
const sansEcran = process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY;

// npm est un script .cmd sous Windows, que Node ne lance que par un shell.
execFileSync('npm', ['run', '--silent', 'build'], {
  cwd: RACINE,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

const cache = join(RACINE, 'node_modules', '.cache');
mkdirSync(cache, { recursive: true });
const publie = mkdtempSync(join(cache, 'essai-demarrage-'));

const attendu = titreAvecVersion(VERSION.affichee);
let conforme = false;
try {
  const application = await _electron.launch({
    args: [
      ...(sansBacASable ? ['--no-sandbox'] : []),
      ...(sansEcran ? ['--ozone-platform=headless'] : []),
      '.',
    ],
    cwd: RACINE,
    env: { ...process.env, PORTABLE_EXECUTABLE_DIR: publie },
    timeout: ATTENTE_MS,
  });
  try {
    const fenetre = await application.firstWindow({ timeout: ATTENTE_MS });
    // La fenêtre de la plateforme headless peut n'avoir qu'un pixel de côté :
    // le bandeau s'y voit par sa largeur minimale, la liste n'y est que
    // présente.
    await fenetre.locator('[data-bandeau]').waitFor({ timeout: ATTENTE_MS });
    await fenetre.locator('[data-ecran="accueil"]').waitFor({ state: 'attached', timeout: ATTENTE_MS });
    const titre = await fenetre.title();
    const bandeau = (await fenetre.locator('[data-bandeau]').textContent()).replace(/\s+/g, ' ').trim();
    const erreurs = await fenetre.evaluate(() => globalThis.__gttErreurs ?? null);
    conforme = titre === attendu && bandeau.includes(VERSION.affichee) && Array.isArray(erreurs) && erreurs.length === 0;
    console.log(`Titre de la fenêtre : ${titre}`);
    console.log(`Bandeau : ${bandeau}`);
    console.log(`Erreurs recueillies : ${JSON.stringify(erreurs)}`);
    if (!conforme) console.error(`Attendu : titre « ${attendu} », bandeau portant ${VERSION.affichee}, collecteur posé et vide`);
  } finally {
    await application.close();
  }
} finally {
  rmSync(publie, { recursive: true, force: true });
}
console.log(conforme ? 'Démarrage conforme.' : 'Démarrage non conforme.');
process.exit(conforme ? 0 : 1);
