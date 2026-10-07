// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les textes de la coquille (§ 18.6) : le nom de l'application, le titre du
// bandeau et de la fenêtre, et la provenance de la construction par mode de
// Vite. Un mode sans clé s'affiche sous son propre nom (libelles.js).
export const TABLE = new Map([
  ['coquille.nom', 'Gestion table tournante Libre'],
  ['coquille.titre', ({ version }, texte) => `${texte('coquille.nom')} \u{2014} ${version}`],
  ['coquille.provenance.developpement', 'développement'],
  ['coquille.provenance.livraison', 'livraison'],
  ['coquille.provenance.documentation', 'documentation'],
  ['coquille.provenance.test', 'épreuve'],
]);
