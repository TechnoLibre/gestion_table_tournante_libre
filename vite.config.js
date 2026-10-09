// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Construit la page que servent la plateforme web de Capacitor et la coquille
// Electron. La base relative fait commencer chaque chemin d'actif par « ./ » :
// la coquille charge la page par file://, où un chemin absolu « /assets/… »
// désigne la racine du disque.
//
// Le seuil d'avertissement d'un morceau vaut 1 000 ko, et non les 500 ko de
// Vite : la page se lit sur le disque local, hors ligne, une fois au
// lancement, et un seul morceau porte l'application entière, travailleur de
// génération incrusté compris. Le seuil n'avertit donc que d'une croissance
// anormale du paquet ; test/construction.long.test.js tombe au-delà.
//
// La production de la planche se charge à part, par un import différé, et
// jamais au lancement. pdf-lib et fontkit y pèsent ensemble plus d'un
// morceau : deux groupes les séparent, fontkit seul d'un côté, pdf-lib et ce
// qu'il tire — pako, tslib, les polices standard, upng — de l'autre. La
// police embarquée, elle, forme deux morceaux différés sans groupe : un par
// graisse, puisque chacune a son module (src/polices).
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  base: './',
  plugins: [svelte()],
  build: {
    outDir: 'www',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
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
