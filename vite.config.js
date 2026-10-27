// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Construit la page que servent la plateforme web de Capacitor et la coquille
// Electron. La base relative fait commencer chaque chemin d'actif par « ./ » :
// la coquille charge la page par file://, où un chemin absolu « /assets/… »
// désigne la racine du disque.
//
// Le lancement charge le point d'entrée, travailleur de génération incrusté
// compris, et le morceau commun que la construction nomme d'après l'un de
// ses modules, vue_plan : les modules que le point d'entrée partage avec
// un morceau différé. La section de la qualité forme son propre morceau,
// différé, que la page ne charge qu'à la première ouverture de la section
// (src/main.js). Le seuil d'avertissement d'un morceau vaut 1 100 ko, et
// non les 500 ko de Vite : la page se lit sur le disque local, hors ligne,
// une fois au lancement. Le seuil n'avertit donc que d'une croissance
// anormale d'un morceau ; test/construction.long.test.js tombe au-delà.
//
// La production de la planche se charge à part, par un import différé, et
// jamais au lancement. pdf-lib et fontkit y pèsent ensemble plus d'un
// morceau : deux groupes les séparent, fontkit seul d'un côté, pdf-lib et ce
// qu'il tire — pako, tslib, les polices standard, upng — de l'autre. La
// police embarquée, elle, forme deux morceaux différés sans groupe : un par
// graisse, puisque chacune a son module (src/polices).
//
// Le travailleur du solveur du plancher exact (src/main.js, chargerSolveur)
// forme un morceau différé, que la page ne charge qu'au premier calcul : il
// porte le travailleur incrusté, et highs avec lui. Le module WebAssembly de
// HiGHS reste un actif à part, émis une fois, que highs/runtime?url et le
// chargeur d'Emscripten désignent tous deux. Ce chargeur importe en différé
// le module node:module de node, sous une garde qui ne vaut que sous node,
// fausse dans la page, dans le travailleur et dans le rendu d'Electron :
// worker.rolldownOptions.external laisse cet import inerte tel quel, sans
// quoi le module de remplacement de Vite pour le navigateur entrerait dans
// les modules du travailleur. Sous le serveur de développement, celui des
// épreuves du navigateur, highs se pré-assemble dès le départ
// (optimizeDeps.include) : découvert au premier chargement du travailleur,
// il ferait recharger la page au milieu d'une épreuve.
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  base: './',
  plugins: [svelte()],
  worker: {
    rolldownOptions: { external: ['node:module'] },
  },
  optimizeDeps: {
    include: ['highs'],
  },
  build: {
    outDir: 'www',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1100,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'fontkit', test: /[\\/]node_modules[\\/]@pdf-lib[\\/]fontkit[\\/]/ },
            {
              name: 'pdf-lib',
              test: /[\\/]node_modules[\\/](?:pdf-lib|pako|tslib|@pdf-lib[\\/](?:standard-fonts|upng))[\\/]/,
            },
          ],
        },
      },
    },
  },
});
