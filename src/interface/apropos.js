// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le panneau « À propos » et la version à l'écran (§ 18.6). Le bloc tient en
// une ligne, que l'opérateur copie dans un courriel : il porte les deux
// formes de la version, l'affichée et celle que montrent les propriétés du
// fichier sous Windows, que scripts/version.js engendre. Sa composition est
// une seule clé de la table de la coquille : la langue témoin l'encadre une
// fois, en entier. La version et la provenance à l'écran se définissent
// dans l'application (version.js), que le papier lit aussi : ce module les
// réexporte.
export { provenanceVisible, versionVisible } from '../application/version.js';

/**
 * Bloc d'une ligne du panneau « À propos » (§ 18.6) : nom, version affichée,
 * version Windows, plateforme, provenance, version de format, séparés par
 * « · ». La provenance s'y lit sous son libellé, ou sous son propre nom
 * quand le mode n'en a pas ; la plateforme sous sa nature.
 *
 * @param {Object} champs
 * @param {{affichee: string, windows: string}} champs.version   les deux formes
 *        de la version, celles que reçoit App (produitVersion, versionWindows)
 * @param {string} champs.plateforme   la nature du système de fichiers
 * @param {string} champs.provenance   le mode de construction de Vite
 * @param {number} champs.format       la version de format des fichiers
 * @param {(cle: string, details?: Object) => string} t
 * @returns {string} sans saut de ligne
 * @throws {RangeError} une forme de la version absente, vide ou qui n'est
 *         pas une chaîne, en la nommant : une dépendance d'App oubliée
 *         échoue au montage, plutôt que de donner un bloc copiable faux
 */
export function blocAPropos({ version, plateforme, provenance, format }, t) {
  for (const forme of ['affichee', 'windows']) {
    const valeur = version[forme];
    if (typeof valeur !== 'string' || valeur === '') {
      throw new RangeError(`À propos : la version ${forme} manque (${JSON.stringify(valeur) ?? 'undefined'})`);
    }
  }
  return t('coquille.apropos.bloc', {
    affichee: version.affichee,
    windows: version.windows,
    plateforme,
    provenance,
    format,
  });
}
