// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Table des chaînes visibles de l'interface. Un composant n'écrit aucune
// chaîne visible en dur : il les lit ici, seul endroit qu'une traduction
// remplace (§ 14.6).

const NOM_APPLICATION = 'Gestion table tournante Libre';

// Mode de construction de Vite → provenance affichée dans le bandeau
// (§ 18.6). Une Map ne répond qu'aux clés qu'on y a posées : un mode nommé
// comme une propriété héritée d'Object ne rend pas une fonction.
const PROVENANCES = new Map([
  ['developpement', 'développement'],
  ['livraison', 'livraison'],
  ['documentation', 'documentation'],
  ['test', 'épreuve'],
]);

// Libellé de la provenance pour un mode de Vite. Un mode sans libellé, comme
// celui d'un « vite build » lancé sans --mode, s'affiche sous son propre nom.
export function libelleProvenance(mode) {
  return PROVENANCES.get(mode) ?? mode;
}

// Vrai quand le mode a un libellé déclaré. Comparer libelleProvenance(mode) à
// mode ne le dit pas : « livraison » et « documentation » ont un libellé
// identique à leur nom.
export function aUnLibelle(mode) {
  return PROVENANCES.has(mode);
}

// Nom de l'application suivi de la version affichée : texte du bandeau et
// titre de la fenêtre (§ 18.6).
export function titreAvecVersion(version) {
  return `${NOM_APPLICATION} — ${version}`;
}
