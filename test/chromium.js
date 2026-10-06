// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Options du Chromium des épreuves du navigateur, que vitest.config.js passe
// au fournisseur Playwright. Playwright lance par défaut le Chromium qu'il a
// téléchargé ; GTT_CHROMIUM désigne un autre exécutable. Sous NixOS, où les
// binaires téléchargés ne démarrent pas, scripts/installation/shell.nix y
// met celui de nixpkgs.
export function optionsChromium(env) {
  const chemin = env.GTT_CHROMIUM;
  return chemin ? { launchOptions: { executablePath: chemin } } : {};
}
