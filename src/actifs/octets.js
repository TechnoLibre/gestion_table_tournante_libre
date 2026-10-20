// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le décodage d'une URL data: en base64, celle que « ?inline » rend sous
// Vite pour un fichier binaire : chargerLogo (logo.js) en tire les octets du
// PNG. Le module est pur, sans import : les épreuves node le lisent.

// Les données d'une URL data: en base64 : l'alphabet base64 et son
// remplissage. L'en-tête, avant la première virgule, s'ouvre sur « data: »
// et se ferme sur « ;base64 » ; le type et ses paramètres, entre les deux,
// ne se lisent pas.
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * Les octets d'une URL data: en base64.
 *
 * @param {string} texte
 * @returns {Uint8Array}  un tableau neuf à chaque appel
 * @throws {TypeError} tout texte qui n'est pas une URL data: en base64 — une
 *         adresse d'actif, par exemple, qu'une autre configuration de Vite
 *         rendrait à la place des données
 */
export function octetsDeDonnees(texte) {
  const virgule = typeof texte === 'string' ? texte.indexOf(',') : -1;
  const entete = virgule === -1 ? '' : texte.slice(0, virgule);
  const donnees = virgule === -1 ? '' : texte.slice(virgule + 1);
  if (!entete.startsWith('data:') || !entete.endsWith(';base64') || !BASE64.test(donnees)) {
    const debut = typeof texte === 'string' ? JSON.stringify(texte.slice(0, 40)) : String(texte);
    throw new TypeError(`octetsDeDonnees : URL data: en base64 attendue, reçu ${debut}`);
  }
  const binaire = atob(donnees);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i);
  return octets;
}
