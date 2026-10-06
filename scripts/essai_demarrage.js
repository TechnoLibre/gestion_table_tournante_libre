// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Essai de démarrage : construit la page, lance la vraie coquille Electron
// par Playwright, attend sa fenêtre, lit le titre et le bandeau, puis ferme.
// Il prouve ce que la coquille factice des épreuves (test/coquille.test.js)
// ne peut pas dire : qu'Electron démarre sur ce système, avec ses
// bibliothèques, et y charge la page.
//
//   node scripts/essai_demarrage.js
//
// Sous Linux sans session graphique, Electron se lance sur la plateforme
// Ozone « headless » de Chromium : la fenêtre existe et la page s'y charge
// et s'y met en page, sans serveur d'affichage. Sous root, ou avec
// GTT_SANS_BAC_A_SABLE=1 là où le système refuse les espaces de noms
// d'utilisateur — un conteneur —, Electron se lance sans son bac à sable.
// Sort à 0 sur un démarrage conforme, à 1 sinon.
import { execFileSync } from 'node:child_process';
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

const attendu = titreAvecVersion(VERSION.affichee);
const application = await _electron.launch({
  args: [
    ...(sansBacASable ? ['--no-sandbox'] : []),
    ...(sansEcran ? ['--ozone-platform=headless'] : []),
    '.',
  ],
  cwd: RACINE,
  timeout: ATTENTE_MS,
});
let conforme = false;
try {
  const fenetre = await application.firstWindow({ timeout: ATTENTE_MS });
  await fenetre.locator('header.bandeau .titre').waitFor({ timeout: ATTENTE_MS });
  const titre = await fenetre.title();
  const bandeau = (await fenetre.locator('header.bandeau .titre').textContent()).trim();
  conforme = titre === attendu && bandeau === attendu;
  console.log(`Titre de la fenêtre : ${titre}`);
  console.log(`Bandeau : ${bandeau}`);
  if (!conforme) console.error(`Attendu : ${attendu}`);
} finally {
  await application.close();
}
console.log(conforme ? 'Démarrage conforme.' : 'Démarrage non conforme.');
process.exit(conforme ? 0 : 1);
