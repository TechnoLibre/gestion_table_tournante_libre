// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les icônes des primitives : des tracés SVG au trait, dans un carré de 24
// unités, que Icone.svelte dessine sans remplissage, du trait de la couleur
// courante (currentColor) — la couleur vient du jeton que lit le parent.
// Aucune ne porte de texte ni de couleur. Une icône est un signe redondant :
// un libellé l'accompagne toujours, et le dessin est caché aux technologies
// d'assistance.
//
// Un point se trace comme un cercle de rayon 1,5, que l'épaisseur du trait
// remplit : deux arcs qui se referment.

// Un cercle de centre (x, y) et de rayon r, en deux demi-arcs.
const cercle = (x, y, r) => `M${x + r} ${y}a${r} ${r} 0 1 1-${2 * r} 0a${r} ${r} 0 1 1 ${2 * r} 0`;

const DESSINS = [
  // Les quatre états du plan (§ 9) : brouillon, proposé, retenu, bloqué.
  ['crayon', ['M4 20h4L19 9l-4-4L4 16z', 'M14 6l4 4']],
  ['listePoints', ['M9 6h11M9 12h11M9 18h11', 'M4 6h.01M4 12h.01M4 18h.01']],
  ['coche', ['M4 12l5 5L20 6']],
  ['cadenas', ['M6 11h12v9H6z', 'M8 11V8a4 4 0 0 1 8 0v3']],
  // Les commandes et les repères des écrans.
  ['liste', ['M4 6h16M4 12h16M4 18h16']],
  ['importer', ['M12 3v12', 'M7 10l5 5 5-5', 'M4 21h16']],
  ['exporter', ['M12 15V3', 'M7 8l5-5 5 5', 'M4 21h16']],
  ['ajouter', ['M12 5v14', 'M5 12h14']],
  ['chercher', [cercle(11, 11, 7), 'M20 20l-4-4']],
  ['calendrier', ['M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M3 10h18', 'M8 3v4', 'M16 3v4']],
  // Les messages : information, avis, refus.
  ['information', [cercle(12, 12, 9), 'M12 11v5', 'M12 8h.01']],
  ['triangle', ['M12 3l10 18H2z', 'M12 10v5', 'M12 18h.01']],
  ['interdit', [cercle(12, 12, 9), 'M5.6 5.6l12.8 12.8']],
  ['dossier', ['M3 6h7l2 2h9v11H3z']],
  // Les modes : lecture, écriture.
  ['oeil', ['M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z', cercle(12, 12, 3)]],
  ['stylo', ['M4 20h4L19 9l-4-4L4 16z']],
  ['defaire', ['M9 14L4 9l5-5', 'M4 9h11a5 5 0 0 1 0 10h-3']],
  ['imprimer', ['M6 9V3h12v6', 'M5 9h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z', 'M7 14h10v7H7z']],
  ['etoile', ['M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z']],
  ['croix', ['M6 6l12 12M18 6L6 18']],
  ['chevron', ['M9 6l6 6-6 6']],
  ['points', [cercle(5, 12, 1.5), cercle(12, 12, 1.5), cercle(19, 12, 1.5)]],
  ['demarrer', ['M8 5l11 7-11 7z']],
  // Une étiquette (§ 4.5) : l'étiquette à œillet, pointe en bas à droite.
  ['etiquettes', ['M3 3h8l10 10-8 8L3 11z', cercle(7.5, 7.5, 1.5)]],
];

/** Les noms des icônes, dans l'ordre du module. */
export const NOMS_ICONES = Object.freeze(DESSINS.map(([nom]) => nom));

/** Chaque icône par son nom : la liste figée de ses tracés. */
export const ICONES = Object.freeze(Object.fromEntries(DESSINS.map(([nom, traces]) => [nom, Object.freeze(traces)])));

/**
 * Les tracés d'une icône.
 *
 * @param {string} nom
 * @returns {readonly string[]}
 * @throws {RangeError} un nom hors de NOMS_ICONES
 */
export function traceIcone(nom) {
  if (!NOMS_ICONES.includes(nom)) throw new RangeError(`icône inconnue : ${JSON.stringify(nom)}`);
  return ICONES[nom];
}
