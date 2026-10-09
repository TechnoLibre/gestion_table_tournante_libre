// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le projet banc de Vitest (§ 19.10), décrit sans rien charger de Vitest :
// vitest.banc.config.js l'enveloppe de defineConfig et lui donne son
// fournisseur Playwright, les gardes du banc (banc.test.js) le lisent sous
// node, où une épreuve ne charge pas le lanceur hors de test/lanceur.js
// (§ 14.8).
//
// Chromium reçoit les options des épreuves du navigateur (test/chromium.js),
// plus deux drapeaux qui lui ôtent sa cadence d'images : sans eux, chaque
// intervalle entre images se cale sur 16,7 ms, et un temps par image se lit
// en marches de cette hauteur. Le harnais (harnais.banc.js) vérifie que la
// cadence n'est pas bridée avant de mesurer.
//
// Le cadre d'affichage est celui des captures, 1 366 × 700 au facteur 1
// (§ 19.4, § 19.10) : la page de Playwright a ces dimensions, le cadre de
// l'épreuve aussi, et l'orchestrateur ne le met pas à l'échelle. La page
// lit le cadre par inject('cadreBanc'), qui vient d'ici seul.
//
// Les fichiers se jouent l'un après l'autre : deux mesures en même temps se
// disputeraient les processeurs. Une épreuve du banc dispose d'une
// demi-heure, un balayage de zoom à deux ralentissements y compris.
import { optionsChromium } from '../../test/chromium.js';

const CADRE = Object.freeze({ largeur: 1366, hauteur: 700 });
const DRAPEAUX_CADENCE = Object.freeze(['--disable-frame-rate-limit', '--disable-gpu-vsync']);
const DELAI_MS = 1_800_000;

/**
 * Les options du fournisseur Playwright pour le banc : celles de
 * optionsChromium(env), les drapeaux de cadence ajoutés à la fin des
 * arguments de lancement, et un contexte de navigation au cadre du banc, au
 * facteur d'échelle 1. env n'est pas modifié.
 *
 * @param {Record<string, string|undefined>} env
 */
export function optionsBanc(env) {
  const { launchOptions = {}, ...autres } = optionsChromium(env);
  return {
    ...autres,
    launchOptions: { ...launchOptions, args: [...(launchOptions.args ?? []), ...DRAPEAUX_CADENCE] },
    contextOptions: { viewport: { width: CADRE.largeur, height: CADRE.hauteur }, deviceScaleFactor: 1 },
  };
}

/**
 * L'objet test du projet banc, hors du fournisseur du navigateur, que
 * vitest.banc.config.js ajoute à browser. Un objet neuf à chaque appel.
 */
export function projetBanc() {
  return {
    name: 'banc',
    include: ['scripts/banc/**/*.banc.js'],
    fileParallelism: false,
    testTimeout: DELAI_MS,
    hookTimeout: DELAI_MS,
    provide: { cadreBanc: { ...CADRE } },
    browser: {
      enabled: true,
      headless: true,
      instances: [{ browser: 'chromium' }],
      viewport: { width: CADRE.largeur, height: CADRE.hauteur },
    },
  };
}
