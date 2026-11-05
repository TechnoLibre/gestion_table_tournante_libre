// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La commande d'impression des épreuves du navigateur, côté node (§ 11.7,
// § 14.4) : vitest.config.js la déclare dans browser.commands, et la page
// l'appelle par commands de vitest/browser. Elle reçoit d'abord le contexte
// de la commande — la page Playwright, le cadre de l'épreuve — et rend du
// JSON, jamais d'octets : le RPC des commandes sérialiserait un tableau
// typé en objet {"0": …}.
//
// Le moteur d'impression de Chromium ne vise qu'une page entière, jamais le
// cadre où l'épreuve s'exécute. imprimerEnPdf sérialise donc le document du
// cadre — ses feuilles de style relues de leurs règles, ses scripts
// retirés, une base qui garde l'adresse des polices et des images — et
// l'imprime dans une page neuve du même contexte, sous les médias
// d'impression, à la taille de page que demande la feuille de style
// (preferCSSPageSize). La lecture du PDF (test/pdf.js, chargé à la première
// impression : la configuration du lanceur importe ce module sans lui)
// rend le nombre de pages, la boîte de média de chacune et sa couche de
// texte.

/** Les commandes que vitest.config.js déclare, toutes exportées ici. */
export const COMMANDES = Object.freeze(['imprimerEnPdf']);

/** L'écart admis entre la boîte de média d'un PDF de Chromium et le papier
 *  demandé, en mm : Chromium arrondit la taille de page à l'unité de son
 *  moteur, et l'A4 en sort à 209,89 × 297,01 mm. L'épreuve du navigateur
 *  et l'essai de démarrage la lisent toutes deux d'ici. */
export const TOLERANCE_PAGE_MM = 0.25;

/**
 * Ce qu'un PDF imprimé donne à lire : le nombre de pages ; la boîte de
 * média de chaque page, en mm ; le texte de chaque page, ses fragments
 * dans l'ordre du flux, séparés d'une espace.
 *
 * @param {Uint8Array} octets
 * @returns {Promise<{pages: number, mediaBox: Array<{largeur: number, hauteur: number}>, textes: string[]}>}
 */
export async function lireImpression(octets) {
  const { lirePdf } = await import('../pdf.js');
  const lu = await lirePdf(octets);
  return {
    pages: lu.pages.length,
    mediaBox: lu.pages.map(({ boite }) => ({ largeur: boite.largeur, hauteur: boite.hauteur })),
    textes: lu.pages.map(({ textes }) => textes.map(({ texte }) => texte).join(' ')),
  };
}

// Le document du cadre, tel qu'une page neuve le rend sans rien exécuter,
// sous la forme d'un texte HTML. S'exécute dans le cadre : chaque feuille
// de style s'écrit de ses règles — un <style> qu'un module a rempli par
// l'objet CSSOM garde ainsi ce qu'il applique —, les feuilles adoptées en
// <style> à la fin de l'en-tête, aucun <script> ni préchargement de module
// ne reste, et une <base> en tête garde l'adresse du cadre pour les
// ressources relatives.
function serialiserDocument() {
  const regles = (feuille) => [...feuille.cssRules].map((regle) => regle.cssText).join('\n');
  const copie = document.documentElement.cloneNode(true);
  const originaux = [...document.querySelectorAll('style')];
  [...copie.querySelectorAll('style')].forEach((style, rang) => {
    const feuille = originaux[rang]?.sheet;
    if (feuille) style.textContent = regles(feuille);
  });
  for (const element of copie.querySelectorAll('script, link[rel="modulepreload"]')) element.remove();
  const tete = copie.querySelector('head');
  for (const feuille of document.adoptedStyleSheets) {
    const style = document.createElement('style');
    style.textContent = regles(feuille);
    tete.append(style);
  }
  const base = document.createElement('base');
  base.href = document.baseURI;
  tete.prepend(base);
  return `<!doctype html>\n${copie.outerHTML}`;
}

/**
 * Imprime le document du cadre de l'épreuve en PDF, par le moteur
 * d'impression de Chromium, dans une page neuve du même contexte, fermée
 * ensuite : médias d'impression, fond imprimé, taille de page de la
 * feuille de style. Les polices du document sont chargées avant
 * l'impression. Le document de l'épreuve n'est pas modifié.
 *
 * @returns {Promise<{pages: number, mediaBox: Array<{largeur: number, hauteur: number}>, textes: string[]}>}
 *   lireImpression du PDF
 */
export async function imprimerEnPdf(context) {
  const cadre = await context.frame();
  const html = await cadre.evaluate(serialiserDocument);
  const page = await context.page.context().newPage();
  try {
    await page.emulateMedia({ media: 'print' });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const octets = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    return await lireImpression(new Uint8Array(octets));
  } finally {
    await page.close();
  }
}
