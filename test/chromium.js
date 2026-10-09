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
//
// Le projet navigateur reçoit optionsNavigateur : les mêmes options, plus
// trois arguments de lancement et un contexte au facteur d'échelle 1
// (§ 19.2, § 19.4). Le résolveur de Chromium ne résout que localhost ; un
// mandataire mort, 127.0.0.1:9, reçoit toute requête vers une adresse
// littérale, que le résolveur ne voit pas. Chromium contourne d'office le
// mandataire pour la boucle locale — localhost, 127.0.0.0/8, [::1] — : la
// page des épreuves se charge, et une requête qui sortirait de la machine
// échoue en connexion, observable, au lieu de partir. La règle de
// contournement <-loopback> retirerait ce contournement ; elle n'est pas
// posée. Le facteur d'échelle se fixe au lancement, que ni Playwright ni
// une commande du standard ne fixent pour la fenêtre de la machine.
// suivreRequetes relève, page par page, les requêtes hors de la boucle
// locale que la page émet, refusées ou non, et la cause de chaque échec.

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

/** Les arguments de lancement du projet navigateur, dans cet ordre. */
export const ARGUMENTS_NAVIGATEUR = Object.freeze([
  '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost',
  '--proxy-server=127.0.0.1:9',
  '--force-device-scale-factor=1',
]);

/** Le mode d'affichage du navigateur des captures, nommé au manifeste
 *  (§ 19.4) : une valeur de la configuration, jamais lue de la machine. */
export const MODE_AFFICHAGE = 'chromium-headless-shell';

/**
 * Les options du fournisseur Playwright du projet navigateur : celles de
 * optionsChromium(env), ARGUMENTS_NAVIGATEUR ajoutés à la fin des arguments
 * de lancement, et un contexte de navigation au facteur d'échelle 1. env
 * n'est pas modifié.
 *
 * @param {Record<string, string|undefined>} env
 */
export function optionsNavigateur(env) {
  const { launchOptions = {}, ...autres } = optionsChromium(env);
  return {
    ...autres,
    launchOptions: { ...launchOptions, args: [...(launchOptions.args ?? []), ...ARGUMENTS_NAVIGATEUR] },
    contextOptions: { deviceScaleFactor: 1 },
  };
}

// Les schémas d'une adresse qui ne passe pas par le réseau.
const SANS_RESEAU = new Set(['data:', 'blob:', 'about:']);

// Un nom d'hôte de la boucle locale, tel que l'URL le rend : localhost,
// une adresse IPv4 de 127.0.0.0/8, ou [::1].
const BOUCLE = /^(localhost|127(\.\d{1,3}){3}|\[::1\])$/;

/**
 * Vrai quand une requête vers cette adresse sortirait de la machine : toute
 * adresse dont l'hôte n'est pas de la boucle locale, hors des schémas sans
 * réseau (data:, blob:, about:). Une adresse illisible compte comme sortante.
 *
 * @param {string} adresse
 * @returns {boolean}
 */
export function horsBoucle(adresse) {
  let url;
  try {
    url = new URL(adresse);
  } catch {
    return true;
  }
  if (SANS_RESEAU.has(url.protocol)) return false;
  return !BOUCLE.test(url.hostname);
}

// Les requêtes hors boucle relevées par page, et leurs échecs, en attente
// d'être lus.
const RELEVES = new WeakMap();

/**
 * Suit les requêtes de la page Playwright : la première fois, deux
 * écouteurs se posent sur la page, « request » et « requestfailed », qui
 * relèvent chaque adresse hors de la boucle locale, cadres compris, et
 * chaque échec d'une telle requête avec sa cause — l'errorText de
 * Chromium, net::ERR_PROXY_CONNECTION_FAILED quand le mandataire mort l'a
 * reçue. Rend { relever(), releverEchecs() } : les adresses, puis les
 * échecs { adresse, cause }, relevés depuis la lecture précédente, dans
 * l'ordre, chacun vidé par sa lecture. Deux suivis de la même page
 * partagent le même relevé.
 *
 * @param {{on: (evenement: string, ecouteur: Function) => unknown}} page
 * @returns {{relever: () => string[], releverEchecs: () => Array<{adresse: string, cause: string|null}>}}
 */
export function suivreRequetes(page) {
  if (!RELEVES.has(page)) {
    const releve = { requetes: [], echecs: [] };
    RELEVES.set(page, releve);
    page.on('request', (requete) => {
      const adresse = requete.url();
      if (horsBoucle(adresse)) releve.requetes.push(adresse);
    });
    page.on('requestfailed', (requete) => {
      const adresse = requete.url();
      if (horsBoucle(adresse)) releve.echecs.push({ adresse, cause: requete.failure()?.errorText ?? null });
    });
  }
  const { requetes, echecs } = RELEVES.get(page);
  return { relever: () => requetes.splice(0, requetes.length), releverEchecs: () => echecs.splice(0, echecs.length) };
}
