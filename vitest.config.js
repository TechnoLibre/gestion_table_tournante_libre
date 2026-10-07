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
//             d'accord avec la première. Il joue les épreuves de src/ et
//             celles de l'outillage partagé de test/navigateur/.
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { optionsChromium } from './test/chromium.js';
import { coeursDisponibles, reglagesSeries } from './test/machine.js';

// Les séries node suivent le nombre de cœurs de la machine (test/machine.js) :
// en deçà de quatre, des threads sur tous les cœurs, et les épreuves lourdes
// de la série surveillée passent dans la série longue (§ 14.14). Sous la
// mesure de la couverture, que process.argv annonce par --coverage, elles
// restent dans node, où se mesurent les seuils qu'elles couvrent.
const SERIES = reglagesSeries(coeursDisponibles(), { couverture: process.argv.includes('--coverage') });
const PROCESSUS = { pool: SERIES.pool, maxWorkers: SERIES.maxWorkers };

// Les épreuves node qui lisent les composants de src/interface par le
// système de fichiers — chaînes, couleurs, en-tête, jetons lus, écouteurs du
// plan, version affichée, graphe des couches, version qu'App reçoit par ses
// propriétés —, et celle qui importe App.svelte pour en voir l'échec sous
// node.
const RELANCES_D_UN_COMPOSANT = Object.freeze([
  'test/arborescence.test.js',
  'test/sources_interface.test.js',
  'scripts/version.test.js',
  'test/projets.test.js',
  'test/licence.test.js',
  'src/interface/palette.test.js',
  'src/interface/plan/ecouteurs.test.js',
  'src/interface/apropos.test.js',
]);

// Les épreuves node qui lisent la feuille des jetons par le système de
// fichiers — palette validée par calcul, var(--…) déclarés, couleurs des
// sources, en-tête, version affichée —, et la garde des motifs, qui balaie
// les feuilles de style de src/interface.
const RELANCES_DES_JETONS = Object.freeze([
  'src/interface/palette.test.js',
  'src/interface/marques.test.js',
  'test/sources_interface.test.js',
  'test/licence.test.js',
  'scripts/version.test.js',
  'test/arborescence.test.js',
]);

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
    // d'imports change. Les fichiers des motifs se lisent hors de tout graphe :
    // le contrôle de version (§ 18.5) lit les premiers par le système de
    // fichiers ; la coquille s'exécute dans un processus à part, la
    // configuration d'electron-builder se charge par un require natif et lit
    // capacitor.config.json, et le script de construction se lance depuis une
    // copie ; le point d'entrée de la page et le montage des épreuves du
    // navigateur, qu'aucune épreuve node n'importe, se lisent par le disque, la
    // langue et les démonstrations qu'ils passent à App comprises
    // (test/livrable.test.js). Les composants de src/interface et la feuille des
    // jetons se lisent comme du texte par les gardes qui les balaient ; sous
    // node, sans greffon Svelte, aucun graphe ne les parcourt. Chaque motif
    // rattache ses fichiers aux épreuves qui les lisent, et au contrôle de
    // version quand son point 6 les balaie. Un fichier qui répond à un motif ne
    // relance que les épreuves nommées, et plus celles qui l'importeraient : un
    // motif relance donc toute épreuve de la série node qui importe l'un de ses
    // fichiers — test/fichiers_electron.test.js importe electron/fichiers.js,
    // test/projets.test.js importe App.svelte —, et ne nomme aucune table de
    // libellés, que le graphe suffit à suivre. test/arborescence.test.js garde
    // cette règle, et relève toute épreuve de la série node dont le texte lit un
    // composant ou une feuille de style de src/interface sans que son motif la
    // relance. Les motifs ne servent que la série node, la seule que la commande
    // surveillée lance (§ 14.4) : sous une surveillance du projet navigateur,
    // lancée à la main, un composant ou la feuille des jetons modifiés ne
    // relancent aucune épreuve du navigateur, que le motif tait ; elles se
    // relancent à la main. L'option se lit au niveau du lanceur : posée dans un
    // projet, elle est ignorée sans avertissement.
    watchTriggerPatterns: [
      { pattern: /(^|\/)(version\.json|package-lock\.json|CHANGELOG\.md|README\.md|GUIDE-[^/]*\.md)$/,
        testsToRun: () => 'scripts/version.test.js' },
      { pattern: /(^|\/)electron\/[^/]+$/,
        testsToRun: () => ['test/coquille.test.js', 'test/fichiers_electron.test.js', 'test/livrable.test.js',
                           'scripts/essai_demarrage.test.js', 'scripts/version.test.js'] },
      { pattern: /(^|\/)test\/electron_factice\.js$/,
        testsToRun: () => ['test/coquille.test.js', 'scripts/version.test.js'] },
      { pattern: /(^|\/)(electron-builder\.config\.cjs|capacitor\.config\.json)$/,
        testsToRun: () => ['test/livrable.test.js', 'scripts/construire_windows.test.js', 'scripts/version.test.js'] },
      { pattern: /(^|\/)(src\/main\.js|test\/navigateur\/montage\.js)$/,
        testsToRun: () => ['test/livrable.test.js', 'test/arborescence.test.js', 'scripts/version.test.js'] },
      { pattern: /(^|\/)scripts\/construire_windows\.sh$/,
        testsToRun: () => ['scripts/construire_windows.test.js', 'scripts/version.test.js'] },
      { pattern: /(^|\/)src\/interface\/.+\.svelte$/,
        testsToRun: () => [...RELANCES_D_UN_COMPOSANT] },
      { pattern: /(^|\/)src\/interface\/jetons\.css$/,
        testsToRun: () => [...RELANCES_DES_JETONS] },
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
          include: ['src/**/*.navigateur.test.js', 'test/**/*.navigateur.test.js'],
          browser: { enabled: true, headless: true, provider: playwright(optionsChromium(process.env)),
                     instances: [{ browser: 'chromium' }] } } },
    ],
  },
});
