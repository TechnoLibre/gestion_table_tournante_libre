// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le chargement de la police embarquée, Noto Sans Regular et Bold, dont la
// production de la planche (src/pdf) embarque les octets (§ 11.1). Chaque
// graisse est un module à part, regulier.js et gras.js, que chargerPolices
// importe par deux import() différés : la construction en fait deux
// morceaux, que la page ne télécharge ni ne précharge au lancement.
//
// « ?inline » rend sous Vite le fichier en URL data: base64 : la police
// voyage dans le morceau, et se lit sans requête, sous file:// où la
// coquille charge la page comme sous http://. chargerPolices la décode en
// Uint8Array. Ce module n'est importé que par src/main.js et par le montage
// des épreuves du navigateur, qui le passent à App (Dependances.polices) ;
// les épreuves node lisent les mêmes fichiers par le disque
// (test/polices.js), node ne connaissant pas « ?inline ».
//
// La même police est celle de l'interface : jetons.css déclare ses deux
// faces sur les mêmes fichiers. attendrePolices attend qu'elles soient
// chargées dans le document ; src/main.js et monterApp l'attendent avant de
// monter App, car un mesureur de texte créé plus tôt (plan/mesure_texte.js)
// lirait la police de repli et garderait sa largeur.

// Une URL data: en base64 : un type, des paramètres éventuels, « ;base64, »,
// puis l'alphabet base64 et son remplissage.
const DONNEES_BASE64 = /^data:[^,;]*(?:;[^,;=]+=[^,;]*)*;base64,([A-Za-z0-9+/]*={0,2})$/;

/**
 * Les octets d'une URL data: en base64.
 *
 * @param {string} texte
 * @returns {Uint8Array}   un tableau neuf à chaque appel
 * @throws {TypeError} tout texte qui n'est pas une URL data: en base64 — une
 *         adresse d'actif, par exemple, qu'une autre configuration de Vite
 *         rendrait à la place des données
 */
export function decoderDonnees(texte) {
  const lu = typeof texte === 'string' ? DONNEES_BASE64.exec(texte) : null;
  if (lu === null) {
    const debut = typeof texte === 'string' ? JSON.stringify(texte.slice(0, 40)) : String(texte);
    throw new TypeError(`decoderDonnees : URL data: en base64 attendue, reçu ${debut}`);
  }
  const binaire = atob(lu[1]);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i);
  return octets;
}

/**
 * Les octets des deux graisses de la police embarquée.
 *
 * @returns {Promise<{regulier: Uint8Array, gras: Uint8Array}>}  des tableaux
 *          neufs à chaque appel : un appelant peut écrire dans les siens
 */
export async function chargerPolices() {
  const [{ default: regulier }, { default: gras }] = await Promise.all([import('./regulier.js'), import('./gras.js')]);
  return { regulier: decoderDonnees(regulier), gras: decoderDonnees(gras) };
}

/** Les faces de la police d'interface que attendrePolices charge, sous la
 *  forme d'une déclaration font : graisse, corps, famille. Le corps ne sert
 *  qu'à la syntaxe : une face se charge pour tout corps. */
export const FACES_INTERFACE = Object.freeze(['400 16px "Noto Sans"', '700 16px "Noto Sans"']);

/**
 * Attend que les deux faces de la police d'interface, déclarées par
 * jetons.css, soient chargées dans document : les deux demandes à
 * document.fonts.load partent ensemble, et la promesse se résout quand
 * chacune rend au moins une face, toutes au statut « loaded ».
 *
 * @param {Document} document
 * @returns {Promise<void>}
 * @throws {TypeError} (rejet) un document sans ensemble de polices, sans
 *         rien demander
 * @throws {Error} (rejet) une face qu'aucune feuille du document ne déclare
 *         — load ne rend alors aucune face —, ou rendue sans être chargée :
 *         le message nomme chaque face en faute ; un chargement que le
 *         navigateur refuse rejette avec son erreur, telle quelle
 */
export async function attendrePolices(document) {
  if (typeof document?.fonts?.load !== 'function') {
    throw new TypeError('attendrePolices : un document dont fonts.load est une fonction est attendu');
  }
  const rendues = await Promise.all(FACES_INTERFACE.map((face) => document.fonts.load(face)));
  const enFaute = FACES_INTERFACE.filter(
    (_, rang) => rendues[rang].length === 0 || rendues[rang].some(({ status }) => status !== 'loaded'),
  );
  if (enFaute.length > 0) throw new Error(`attendrePolices : face non chargée — ${enFaute.join(' ; ')}`);
}
