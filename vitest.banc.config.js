// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le banc de mesure (§ 19.10), un projet de Vitest hors des trois séries de
// vitest.config.js (§ 14.4, § 14.8) : il ne se lance que par sa propre
// commande, npm run banc, qui passe cette configuration à Vitest. Comme le
// projet navigateur, il étend vite.config.js : un module s'y résout comme
// dans le livrable. Le projet lui-même — fichiers joués, cadre, cadence,
// délais — se décrit dans scripts/banc/projet.js ; ce fichier n'y ajoute que
// le fournisseur Playwright. Le rapporteur des plafonds de la série
// surveillée (test/rapporteur.js) n'a pas cours ici : le banc n'a pas de
// budget de durée.
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { optionsBanc, projetBanc } from './scripts/banc/projet.js';

const projet = projetBanc();

export default defineConfig({
  test: {
    reporters: ['default'],
    projects: [
      {
        extends: './vite.config.js',
        test: { ...projet, browser: { ...projet.browser, provider: playwright(optionsBanc(process.env)) } },
      },
    ],
  },
});
