// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le panneau « À propos » et la version à l'écran (§ 18.6). Le bloc tient en
// une ligne, que l'opérateur copie dans un courriel : il porte la version
// affichée, celle que nomment le changelog et le nom du livrable. Sa
// composition est une seule clé de la table de la coquille : la langue
// témoin l'encadre une fois, en entier. La version et la provenance à l'écran se définissent
// dans l'application (version.js), que le papier lit aussi : ce module les
// réexporte.
export { provenanceVisible, versionVisible } from '../application/version.js';

/**
 * Bloc d'une ligne du panneau « À propos » (§ 18.6) : nom, version affichée,
 * plateforme, provenance, version de format, séparés par « · ». La
 * provenance s'y lit sous son libellé, ou sous son propre nom quand le mode
 * n'en a pas ; la plateforme sous sa nature.
 *
 * @param {Object} champs
 * @param {string} champs.version   la version affichée, celle que reçoit App
 *        (produitVersion)
 * @param {string} champs.plateforme   la nature du système de fichiers
 * @param {string} champs.provenance   le mode de construction de Vite
 * @param {number} champs.format       la version de format des fichiers
 * @param {(cle: string, details?: Object) => string} t
 * @returns {string} sans saut de ligne
 * @throws {RangeError} une version absente, vide ou qui n'est pas une
 *         chaîne : une dépendance d'App oubliée échoue au montage, plutôt
 *         que de donner un bloc copiable faux
 */
export function blocAPropos({ version, plateforme, provenance, format }, t) {
  if (typeof version !== 'string' || version === '') {
    throw new RangeError(`À propos : la version manque (${JSON.stringify(version) ?? 'undefined'})`);
  }
  return t('coquille.apropos.bloc', {
    version,
    plateforme,
    provenance,
    format,
  });
}
