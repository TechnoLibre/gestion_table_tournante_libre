// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Construit la page que servent la plateforme web de Capacitor et la coquille
// Electron. La base relative fait commencer chaque chemin d'actif par « ./ » :
// la coquille charge la page par file://, où un chemin absolu « /assets/… »
// désigne la racine du disque.
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  base: './',
  plugins: [svelte()],
  build: {
    outDir: 'www',
    emptyOutDir: true,
  },
});
