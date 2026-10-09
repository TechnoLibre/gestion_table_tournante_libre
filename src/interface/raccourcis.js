// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La table des raccourcis clavier de l'interface (§ 7.3, § 13.5, § 19.8) :
// la seule source du tableau des raccourcis de la documentation. Le code qui
// répond à une touche la lit par effetDe ; les fichiers que la garde de
// test/sources_interface.test.js admet encore nomment leurs touches eux-mêmes,
// et chacune de ces touches doit avoir son entrée ici, sans quoi la garde la
// relève comme absente du tableau.
//
// Une entrée est { touche, contexte, effet, cle } :
//   touche    la valeur de KeyboardEvent.key, précédée de « Maj+ » quand la
//             majuscule change l'effet (Maj+Tab dans la grille) ;
//   contexte  là où elle agit — 'plan' (l'élément actif du plan, les listes
//             de travail et la réserve), 'grille' (une cellule de la grille
//             des participants), 'champ' (une saisie), 'commande' (un
//             bouton qui exécute une commande), 'geste' (un geste du
//             pointeur en cours), 'fenetre' (un panneau, une infobulle) ;
//   effet     ce qu'elle y fait, un nom que le code du contexte interprète ;
//   cle       la clé du libellé qui décrit l'effet, raccourcis.<contexte>.<effet>.
// Deux touches d'un même effet partagent sa clé : Entrée et l'espace sur le
// plan, Entrée et F2 dans la grille.

/** @typedef {'plan'|'grille'|'champ'|'commande'|'geste'|'fenetre'} ContexteRaccourci */

/** Les contextes, dans l'ordre du tableau. */
export const CONTEXTES_RACCOURCIS = Object.freeze(['plan', 'grille', 'champ', 'commande', 'geste', 'fenetre']);

const raccourci = (touche, contexte, effet) => Object.freeze({ touche, contexte, effet, cle: `raccourcis.${contexte}.${effet}` });

/**
 * Les raccourcis, par contexte dans l'ordre de CONTEXTES_RACCOURCIS. Sur le
 * plan, les flèches mènent à la table voisine, ou au siège suivant (droite,
 * bas) et précédent (gauche, haut) ; Entrée et l'espace descendent dans les
 * sièges ou choisissent la place ; Échap remonte, et oublie le choix des
 * listes (plan/clavier.js). Dans la grille des participants, les flèches
 * mènent à la cellule voisine, Tab et Maj+Tab à la suivante et à la
 * précédente — une saisie en cours validée d'abord —, Entrée et F2 ouvrent
 * la saisie de la cellule ou basculent l'exclusion, Échap efface le refus
 * de la cellule. Dans un champ, Entrée valide la saisie et Échap rend la
 * valeur d'avant. Sur une commande, Entrée et l'espace l'exécutent une fois,
 * maintenues comprises. Échap annule le geste en cours et ferme une
 * fenêtre.
 *
 * @type {ReadonlyArray<Readonly<{touche: string, contexte: ContexteRaccourci, effet: string, cle: string}>>}
 */
export const RACCOURCIS = Object.freeze([
  raccourci('ArrowRight', 'plan', 'droite'),
  raccourci('ArrowDown', 'plan', 'bas'),
  raccourci('ArrowLeft', 'plan', 'gauche'),
  raccourci('ArrowUp', 'plan', 'haut'),
  raccourci('Enter', 'plan', 'entrer'),
  raccourci(' ', 'plan', 'entrer'),
  raccourci('Escape', 'plan', 'remonter'),
  raccourci('ArrowRight', 'grille', 'droite'),
  raccourci('ArrowDown', 'grille', 'bas'),
  raccourci('ArrowLeft', 'grille', 'gauche'),
  raccourci('ArrowUp', 'grille', 'haut'),
  raccourci('Tab', 'grille', 'suivante'),
  raccourci('Maj+Tab', 'grille', 'precedente'),
  raccourci('Enter', 'grille', 'editer'),
  raccourci('F2', 'grille', 'editer'),
  raccourci('Escape', 'grille', 'effacer'),
  raccourci('Enter', 'champ', 'valider'),
  raccourci('Escape', 'champ', 'rendre'),
  raccourci('Enter', 'commande', 'activer'),
  raccourci(' ', 'commande', 'activer'),
  raccourci('Escape', 'geste', 'annuler'),
  raccourci('Escape', 'fenetre', 'fermer'),
]);

// L'effet de chaque touche, par contexte.
const EFFETS = new Map(
  CONTEXTES_RACCOURCIS.map((contexte) => [
    contexte,
    new Map(RACCOURCIS.filter((entree) => entree.contexte === contexte).map(({ touche, effet }) => [touche, effet])),
  ]),
);

/**
 * L'effet d'une touche dans un contexte, ou null pour une touche que le
 * contexte ne prend pas.
 *
 * @param {ContexteRaccourci} contexte
 * @param {string} touche   KeyboardEvent.key
 * @returns {string|null}
 * @throws {RangeError} pour un contexte hors de CONTEXTES_RACCOURCIS
 */
export function effetDe(contexte, touche) {
  const effets = EFFETS.get(contexte);
  if (effets === undefined) throw new RangeError(`contexte de raccourci inconnu : ${JSON.stringify(contexte)}`);
  return effets.get(touche) ?? null;
}
