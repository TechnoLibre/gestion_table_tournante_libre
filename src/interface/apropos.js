// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le panneau « À propos » et la version à l'écran (§ 18.6). Le bloc tient en
// une ligne, que l'opérateur copie dans un courriel : il porte les deux
// formes de la version, l'affichée et celle que montrent les propriétés du
// fichier sous Windows, que scripts/version.js engendre. Sa composition est
// une seule clé de la table de la coquille : la langue témoin l'encadre une
// fois, en entier.
import { aUnLibelle } from './libelles.js';

/**
 * Bloc d'une ligne du panneau « À propos » (§ 18.6) : nom, version affichée,
 * version Windows, plateforme, provenance, version de format, séparés par
 * « · ». La provenance s'y lit sous son libellé, ou sous son propre nom
 * quand le mode n'en a pas ; la plateforme sous sa nature.
 *
 * @param {Object} champs
 * @param {{affichee: string, windows: string}} champs.version   VERSION
 * @param {string} champs.plateforme   la nature du système de fichiers
 * @param {string} champs.provenance   le mode de construction de Vite
 * @param {number} champs.format       la version de format des fichiers
 * @param {(cle: string, details?: Object) => string} t
 * @returns {string} sans saut de ligne
 */
export function blocAPropos({ version, plateforme, provenance, format }, t) {
  return t('coquille.apropos.bloc', {
    affichee: version.affichee,
    windows: version.windows,
    plateforme,
    provenance,
    format,
  });
}

/**
 * Ce qui tient lieu de version à l'écran : la marque de provenance dans une
 * construction de documentation, dont les captures d'écran ne changent pas
 * d'une livraison à l'autre (§ 19.4) ; la version affichée sinon.
 *
 * @param {string} provenance   le mode de construction de Vite
 * @param {string} version      la version affichée
 * @param {(cle: string) => string} t
 * @returns {string}
 */
export function versionVisible(provenance, version, t) {
  return provenance === 'documentation' ? t('coquille.version.documentation') : version;
}

/**
 * La provenance à l'écran : le libellé du mode de construction par la
 * traduction reçue, ou le mode lui-même quand il n'en a pas — celui d'un
 * « vite build » lancé sans --mode —, qui s'affiche alors comme une donnée.
 *
 * @param {string} provenance   le mode de construction de Vite
 * @param {(cle: string) => string} t
 * @returns {string}
 */
export function provenanceVisible(provenance, t) {
  return aUnLibelle(provenance) ? t(`coquille.provenance.${provenance}`) : provenance;
}
