// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La table des raccourcis clavier de l'interface (§ 7.3, § 13.5, § 19.8) :
// la seule source du tableau des raccourcis de la documentation. Le code qui
// répond à une touche la lit par effetDe, et la garde de
// test/sources_interface.test.js relève toute touche nommée hors d'ici :
// l'interface ne répond qu'aux touches de la table, et le tableau décrit
// chacune de ses réponses.
//
// Une entrée est { touche, contexte, effet, cle } :
//   touche    le nom que toucheDe donne à l'événement clavier : la valeur
//             de KeyboardEvent.key, précédée de « Ctrl+ » quand Ctrl est
//             tenue, et de « Maj+ » quand la majuscule change l'effet
//             (Maj+Tab dans la grille, Ctrl+Maj+Z sur l'écran de
//             l'événement) ;
//   contexte  là où elle agit — 'plan' (l'élément actif du plan, les listes
//             de travail et la réserve), 'grille' (une cellule de la grille
//             des participants), 'cases' (les cases d'une saisie de la
//             présence par tour, dans la grille ou la fiche), 'champ' (une
//             saisie), 'commande' (un
//             bouton qui exécute une commande, l'élément d'un menu compris),
//             'boutonMenu' (le bouton d'un menu d'actions), 'menu' (un menu
//             d'actions ouvert, le focus sur l'un de ses éléments), 'geste'
//             (un geste du pointeur en cours), 'evenement' (l'écran de
//             l'événement, hors d'une saisie), 'fenetre' (un panneau, une
//             infobulle) ;
//   effet     ce qu'elle y fait, un nom que le code du contexte interprète ;
//   cle       la clé du libellé qui décrit l'effet, raccourcis.<contexte>.<effet>.
// Deux touches d'un même effet partagent sa clé : Entrée et l'espace sur le
// plan, Entrée et F2 dans la grille.

/** @typedef {'plan'|'grille'|'cases'|'champ'|'commande'|'boutonMenu'|'menu'|'geste'|'evenement'|'fenetre'} ContexteRaccourci */

/** Les contextes, dans l'ordre du tableau. */
export const CONTEXTES_RACCOURCIS = Object.freeze(['plan', 'grille', 'cases', 'champ', 'commande', 'boutonMenu', 'menu', 'geste', 'evenement', 'fenetre']);

const raccourci = (touche, contexte, effet) => Object.freeze({ touche, contexte, effet, cle: `raccourcis.${contexte}.${effet}` });

/**
 * Les raccourcis, par contexte dans l'ordre de CONTEXTES_RACCOURCIS. Sur le
 * plan, les flèches mènent à la table voisine, ou au siège suivant (droite,
 * bas) et précédent (gauche, haut) ; Entrée et l'espace descendent dans les
 * sièges ou choisissent la place ; Échap remonte, et oublie le choix des
 * listes (plan/clavier.js). Dans la grille des participants, les flèches
 * mènent à la cellule voisine, Tab et Maj+Tab à la suivante et à la
 * précédente — une saisie en cours validée d'abord —, Entrée et F2 ouvrent
 * la saisie de la cellule — les cases de présence comprises — ou basculent
 * l'exclusion, Échap efface le refus de la cellule. Dans les cases d'une
 * présence, les flèches gauche et droite passent à la case du tour
 * précédent et du suivant, sans boucler, Début et Fin à la première et à la
 * dernière ; l'espace coche ou décoche la case, de lui-même. Dans un
 * champ, Entrée valide la saisie et Échap rend la valeur d'avant. Sur une
 * commande, Entrée et l'espace l'exécutent une fois,
 * maintenues comprises. Sur le bouton d'un menu d'actions, Entrée, l'espace
 * et la flèche bas ouvrent le menu sur son premier élément, la flèche haut
 * sur le dernier ; dans le menu ouvert, les flèches bas et haut passent à
 * l'élément suivant et au précédent, en bouclant, Début et Fin vont aux
 * bouts, Échap ferme le menu et rend le focus au bouton, Tab le ferme et
 * laisse le focus passer au contrôle suivant (primitives/menu.js). Échap
 * annule le geste en cours. Sur l'écran de l'événement, hors d'une saisie,
 * Ctrl+Z défait le dernier geste, Ctrl+Maj+Z et Ctrl+Y refont le dernier
 * retour (§ 8.3). Échap ferme une fenêtre.
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
  raccourci('ArrowLeft', 'cases', 'precedente'),
  raccourci('ArrowRight', 'cases', 'suivante'),
  raccourci('Home', 'cases', 'premiere'),
  raccourci('End', 'cases', 'derniere'),
  raccourci('Enter', 'champ', 'valider'),
  raccourci('Escape', 'champ', 'rendre'),
  raccourci('Enter', 'commande', 'activer'),
  raccourci(' ', 'commande', 'activer'),
  raccourci('Enter', 'boutonMenu', 'ouvrirPremier'),
  raccourci(' ', 'boutonMenu', 'ouvrirPremier'),
  raccourci('ArrowDown', 'boutonMenu', 'ouvrirPremier'),
  raccourci('ArrowUp', 'boutonMenu', 'ouvrirDernier'),
  raccourci('ArrowDown', 'menu', 'suivant'),
  raccourci('ArrowUp', 'menu', 'precedent'),
  raccourci('Home', 'menu', 'premier'),
  raccourci('End', 'menu', 'dernier'),
  raccourci('Escape', 'menu', 'fermer'),
  raccourci('Tab', 'menu', 'quitter'),
  raccourci('Escape', 'geste', 'annuler'),
  raccourci('Ctrl+Z', 'evenement', 'defaire'),
  raccourci('Ctrl+Maj+Z', 'evenement', 'refaire'),
  raccourci('Ctrl+Y', 'evenement', 'refaire'),
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
 * @param {string|null} touche   KeyboardEvent.key, ou le nom que toucheDe
 *        rend ; null, que toucheDe rend sous Alt ou Méta, n'a aucun effet
 * @returns {string|null}
 * @throws {RangeError} pour un contexte hors de CONTEXTES_RACCOURCIS
 */
export function effetDe(contexte, touche) {
  const effets = EFFETS.get(contexte);
  if (effets === undefined) throw new RangeError(`contexte de raccourci inconnu : ${JSON.stringify(contexte)}`);
  return effets.get(touche) ?? null;
}

// Une lettre seule, de quelque écriture qu'elle soit : sa majuscule la nomme.
const LETTRE = /^\p{L}$/u;

/**
 * Le nom d'un événement clavier dans la forme de la table : « Ctrl+ »
 * quand Ctrl est tenue, puis « Maj+ » quand Maj l'est sur une lettre ou
 * sur Tab, puis la valeur de key, une lettre en majuscule. Maj tenue sur
 * une autre touche ne s'écrit pas : la valeur de key la porte déjà, « ? »
 * plutôt que « / ». Sous Alt ou Méta, que la table ne nomme jamais, null.
 *
 * @param {{key: string, ctrlKey: boolean, shiftKey: boolean, altKey: boolean, metaKey: boolean}} evenement
 * @returns {string|null}
 */
export function toucheDe({ key, ctrlKey, shiftKey, altKey, metaKey }) {
  if (altKey || metaKey) return null;
  const lettre = LETTRE.test(key);
  const maj = shiftKey && (lettre || key === 'Tab') ? 'Maj+' : '';
  return `${ctrlKey ? 'Ctrl+' : ''}${maj}${lettre ? key.toUpperCase() : key}`;
}
