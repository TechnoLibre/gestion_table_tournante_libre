// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Options du Chromium des épreuves du navigateur, que vitest.config.js passe
// au fournisseur Playwright. Playwright lance par défaut le Chromium qu'il a
// téléchargé ; GTT_CHROMIUM désigne un autre exécutable. Sous NixOS, où les
// binaires téléchargés ne démarrent pas, scripts/installation/shell.nix y
// met celui de nixpkgs.
//
// Sous Linux, Chromium convertit le nom d'une entrée de l'OPFS par les
// paramètres régionaux de son processus : hors UTF-8, un nom hors ASCII ne
// se convertit pas, et les épreuves du navigateur n'éprouvent plus le
// stockage. Les paramètres régionaux qui décident de cette conversion sont
// ceux de LC_CTYPE : LC_ALL, puis LC_CTYPE, puis LANG, la première variable
// non vide ; aucune, c'est « C ». Quand ils ne sont pas UTF-8, Chromium
// reçoit une copie de l'environnement sous LANG=C.UTF-8, LC_ALL et LC_CTYPE
// retirés puisqu'ils l'emporteraient sur LANG, comme
// scripts/verifier_systemes.sh le lance dans ses conteneurs. Seul le nom des
// paramètres régionaux se lit : un nom UTF-8 que l'hôte n'a pas générés
// laisse Chromium sous « C », et l'épreuve de l'OPFS du navigateur nomme
// alors cette cause. C.UTF-8 vient avec la glibc 2.35 et suivantes, et avec
// les distributions qui le livrent avant ; l'environnement reçu reste tel
// quel.

// Un nom de paramètres régionaux dont le jeu de caractères est UTF-8 :
// « fr_CA.UTF-8 », « C.utf8 », « de_DE.UTF-8@euro ».
const NOM_UTF8 = /\.utf-?8(@[^.]*)?$/i;

// Paramètres régionaux de LC_CTYPE que env donne, « C » sans aucun.
function caracteresDe(env) {
  for (const variable of ['LC_ALL', 'LC_CTYPE', 'LANG']) {
    if (env[variable]) return env[variable];
  }
  return 'C';
}

export function optionsChromium(env) {
  const lancement = {};
  if (env.GTT_CHROMIUM) lancement.executablePath = env.GTT_CHROMIUM;
  if (!NOM_UTF8.test(caracteresDe(env))) {
    lancement.env = { ...env, LANG: 'C.UTF-8' };
    delete lancement.env.LC_ALL;
    delete lancement.env.LC_CTYPE;
  }
  return Object.keys(lancement).length > 0 ? { launchOptions: lancement } : {};
}
