// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'impression de la coquille (§ 11.7, § 13.4), dans le processus
// principal : le gestionnaire du canal gtt:imprimer, que
// electron/preload.cjs expose à la page sous window.gtt.imprimer. La page
// n'y demande qu'un papier et une orientation ; le gestionnaire en compose
// lui-même les options de webContents.print — boîte de dialogue du système
// montrée, fonds imprimés, format de page du papier, paysage ou non — et
// refuse toute autre demande sans rien imprimer : une option de print
// brute venue de la page, une impression silencieuse vers une imprimante de
// son choix par exemple, ne passe pas, comme electron/fichiers.js n'admet
// qu'un chemin relatif à une racine connue.
//
// Le paquet n'emporte de src/ que la page construite (§ 14.15) : la table
// des papiers se recopie ici, et test/coquille.test.js éprouve que ses clés
// sont celles de PAPIERS (src/geometrie/papiers.js).
//
// L'issue rendue à la page est celle du rappel de print : envoyé quand il
// réussit, annulé quand sa raison est « cancelled », celle que donne une
// boîte de dialogue que l'opérateur ferme, échoué sinon, la raison pour
// cause. Un print qui lève — un contenu détruit entre la demande et
// l'impression — est un échec sans cause : son message, une exception du
// moteur, va à la console du processus principal, jamais à l'opérateur.

/** Le canal de l'impression, qu'invoque le préchargement. */
export const CANAL_IMPRESSION = 'gtt:imprimer';

/** Le format de page de webContents.print, par papier : les clés de PAPIERS. */
export const FORMATS_DE_PAGE = Object.freeze({ A4: 'A4', Lettre: 'Letter' });

// Les orientations d'une demande, et la valeur de landscape de chacune.
const PAYSAGE = new Map([
  ['portrait', false],
  ['paysage', true],
]);

// Les clés d'une demande, triées : papier et orientation, rien d'autre.
const CLES_DE_LA_DEMANDE = ['orientation', 'papier'];

// La raison qu'Electron donne au rappel d'une impression que l'opérateur
// annule.
const RAISON_ANNULEE = 'cancelled';

/**
 * Les options de webContents.print d'une demande de la page.
 *
 * @param {unknown} demande  {papier, orientation}, telle que l'IPC l'a copiée
 * @returns {{silent: false, printBackground: true, pageSize: string, landscape: boolean}}
 * @throws {TypeError} une demande qui n'est pas un objet aux seules clés
 *         papier et orientation, un papier hors de FORMATS_DE_PAGE, une
 *         orientation autre que portrait ou paysage
 */
export function optionsImpression(demande) {
  if (demande === null || typeof demande !== 'object' || Array.isArray(demande)) {
    throw new TypeError("impression : la demande n'est pas un objet");
  }
  const cles = Object.keys(demande).sort();
  if (cles.length !== CLES_DE_LA_DEMANDE.length || cles.some((cle, rang) => cle !== CLES_DE_LA_DEMANDE[rang])) {
    throw new TypeError(`impression : options refusées ${JSON.stringify(cles)}, seuls papier et orientation admis`);
  }
  const { papier, orientation } = demande;
  if (typeof papier !== 'string' || !Object.hasOwn(FORMATS_DE_PAGE, papier)) {
    throw new TypeError(`impression : papier inconnu ${JSON.stringify(papier)}`);
  }
  if (!PAYSAGE.has(orientation)) throw new TypeError(`impression : orientation inconnue ${JSON.stringify(orientation)}`);
  return { silent: false, printBackground: true, pageSize: FORMATS_DE_PAGE[papier], landscape: PAYSAGE.get(orientation) };
}

/**
 * Imprime un contenu de fenêtre selon une demande de la page.
 *
 * @param {{print: Function}} contenu  le webContents de la page qui demande
 * @param {unknown} demande
 * @returns {Promise<{issue: 'envoye'|'annule'|'echec', cause: string|null}>}
 *          cause : la raison d'un échec, null sinon, et null pour un échec
 *          sans raison
 * @throws {TypeError} la demande que refuse optionsImpression, en rejet, sans
 *         appeler print
 */
export async function imprimer(contenu, demande) {
  const options = optionsImpression(demande);
  return new Promise((resoudre) => {
    try {
      contenu.print(options, (succes, raison) => {
        if (succes) resoudre({ issue: 'envoye', cause: null });
        else if (raison === RAISON_ANNULEE) resoudre({ issue: 'annule', cause: null });
        else resoudre({ issue: 'echec', cause: typeof raison === 'string' && raison !== '' ? raison : null });
      });
    } catch (erreur) {
      console.error('gtt:imprimer', erreur);
      resoudre({ issue: 'echec', cause: null });
    }
  });
}

/**
 * Pose le gestionnaire du canal de l'impression : poser(canal,
 * gestionnaire), ipcMain.handle dans le processus principal. Le
 * gestionnaire imprime le contenu qui a envoyé la demande.
 *
 * @param {(canal: string, gestionnaire: Function) => void} poser
 */
export function servirImpression(poser) {
  poser(CANAL_IMPRESSION, (evenement, demande) => imprimer(evenement.sender, demande));
}
