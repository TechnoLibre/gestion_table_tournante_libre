// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Un seul lanceur, trois projets (§ 14.4, § 14.8).
//
// node        fonctions pures, sans DOM et sans greffon Svelte : un module qui
//             importerait un composant échoue au chargement.
// node-long   épreuves lourdes, hors de la série surveillée. Leur durée croît
//             avec l'application : chacune dispose de deux minutes, là où le
//             délai par défaut de Vitest, 5 s, la ferait échouer par
//             dépassement et non sur un défaut. Ce délai arrête un test
//             bloqué ; le plafond de la série est celui du rapporteur.
// navigateur  un vrai moteur de rendu. Le projet étend vite.config.js : un
//             module s'y résout par les mêmes greffons et réglages que dans la
//             construction du livrable, sans seconde configuration à tenir
//             d'accord avec la première.
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { optionsChromium } from './test/chromium.js';
import { coeursDisponibles, reglagesSeries } from './test/machine.js';

// Les séries node suivent le nombre de cœurs de la machine (test/machine.js) :
// en deçà de quatre, des threads sur tous les cœurs, et les épreuves lourdes
// de la série surveillée passent dans la série longue (§ 14.14).
const SERIES = reglagesSeries(coeursDisponibles());
const PROCESSUS = { pool: SERIES.pool, maxWorkers: SERIES.maxWorkers };

export default defineConfig({
  test: {
    // test/rapporteur.js imprime, après le bilan par défaut, la durée de
    // chaque projet et les dix épreuves les plus lentes, et fait échouer
    // l'exécution quand node ou node-long dépasse son plafond (§ 14.14). Un
    // chemin relatif se lit depuis la racine du projet.
    reporters: ['default', './test/rapporteur.js'],
    // La couverture (§ 14.13), que lancent npm run couverture et make
    // couverture : la série node sous l'instrumentation de V8, sans le
    // rapporteur, dont les plafonds bornent la série surveillée et la série
    // longue, non une mesure. Aucun seuil global : un pourcentage d'ensemble
    // se satisfait en couvrant les modules faciles. Le tableau imprime une
    // ligne par couche et par module de src/, pleins compris — que Vitest
    // tait sinon quand un agent le lance — et à 0 % ceux qu'aucune épreuve ne
    // charge ; coverage/index.html montre, ligne à ligne, ce qui n'est jamais
    // exécuté. Quatre modules tiennent 100 % de branches, seuil dur : la
    // commande échoue en deçà. Une branche nue s'y couvre par un cas ajouté,
    // ou part avec le code mort ; le seuil ne s'abaisse pas, et
    // test/arborescence.test.js garde ces quatre seuils, ces deux rapports
    // et les deux commandes qui lancent la mesure.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/**/*.test.js'],
      reporter: [['text', { skipFull: false }], 'html'],
      reportsDirectory: 'coverage',
      thresholds: {
        'src/moteur/indicateurs.js': { branches: 100 },
        'src/moteur/plafond.js': { branches: 100 },
        'src/stockage/depot.js': { branches: 100 },
        'src/stockage/journal.js': { branches: 100 },
      },
    },
    // Sous surveillance, une épreuve se relance quand un module de son graphe
    // d'imports change. Les fichiers des motifs se lisent hors de tout
    // graphe : le contrôle de version (§ 18.5) lit les premiers par le
    // système de fichiers ; la coquille s'exécute dans un processus à part,
    // la configuration d'electron-builder se charge par un require natif et
    // lit capacitor.config.json, et le script de construction se lance
    // depuis une copie. Chaque motif rattache ses fichiers aux épreuves qui
    // les lisent, et au contrôle de version quand son point 6 les balaie. Un
    // fichier qui répond à un motif ne relance que les épreuves nommées, et
    // plus celles qui l'importeraient : un motif ne nomme donc aucun fichier
    // qu'une épreuve importe. L'option se lit au niveau du lanceur : posée
    // dans un projet, elle est ignorée sans avertissement.
    watchTriggerPatterns: [
      { pattern: /(^|\/)(version\.json|package-lock\.json|CHANGELOG\.md|README\.md|GUIDE-[^/]*\.md)$/,
        testsToRun: () => 'scripts/version.test.js' },
      { pattern: /(^|\/)electron\/[^/]+$/,
        testsToRun: () => ['test/coquille.test.js', 'test/livrable.test.js', 'scripts/version.test.js'] },
      { pattern: /(^|\/)test\/electron_factice\.js$/,
        testsToRun: () => ['test/coquille.test.js', 'scripts/version.test.js'] },
      { pattern: /(^|\/)(electron-builder\.config\.cjs|capacitor\.config\.json)$/,
        testsToRun: () => ['test/livrable.test.js', 'scripts/construire_windows.test.js', 'scripts/version.test.js'] },
      { pattern: /(^|\/)scripts\/construire_windows\.sh$/,
        testsToRun: () => ['scripts/construire_windows.test.js', 'scripts/version.test.js'] },
    ],
    projects: [
      { test: {
          name: 'node', environment: 'node', ...PROCESSUS,
          include: ['src/**/*.test.js', 'scripts/**/*.test.js', 'test/**/*.test.js'],
          exclude: ['**/*.long.test.js', '**/*.navigateur.test.js', 'node_modules/**',
                    ...SERIES.horsSerieSurveillee] } },
      { test: {
          name: 'node-long', environment: 'node', ...PROCESSUS,
          include: ['src/**/*.long.test.js', 'test/**/*.long.test.js', ...SERIES.horsSerieSurveillee],
          testTimeout: 120_000 } },
      { extends: './vite.config.js',
        test: {
          name: 'navigateur',
          include: ['src/**/*.navigateur.test.js'],
          browser: { enabled: true, headless: true, provider: playwright(optionsChromium(process.env)),
                     instances: [{ browser: 'chromium' }] } } },
    ],
  },
});
