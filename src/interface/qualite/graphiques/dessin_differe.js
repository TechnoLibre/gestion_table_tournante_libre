// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le contexte dessinDiffere (Graphique.svelte) : la page qui le pose tient
// le registre des graphiques dont le dessin attend d'approcher de la zone
// visible. Chaque graphique en attente s'y inscrit, son cadre et la
// fonction qui le dessine, et s'en retire une fois dessiné ou démonté.
//
// dessinerAvant(cible) dessine chaque graphique inscrit qui précède cible
// dans le document, hors de ses descendants : une page qui amène une vue
// dans la zone visible les dessine d'abord, puis, le rendu fait
// (flushSync), défile jusqu'à elle. Leur hauteur réservée est celle de
// leur dessin ; les dessiner avant le défilement garantit en plus
// qu'aucun dessin au-dessus de la vue ne la déplace ensuite.

/** Un registre neuf : {inscrire(cadre, dessiner) → retirer, dessinerAvant(cible)}. */
export function creerDessinDiffere() {
  const enAttente = new Set();
  return {
    inscrire(cadre, dessiner) {
      const entree = { cadre, dessiner };
      enAttente.add(entree);
      return () => enAttente.delete(entree);
    },
    dessinerAvant(cible) {
      for (const { cadre, dessiner } of [...enAttente]) {
        if (cible.compareDocumentPosition(cadre) & Node.DOCUMENT_POSITION_PRECEDING) dessiner();
      }
    },
  };
}
