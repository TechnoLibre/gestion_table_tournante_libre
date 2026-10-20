// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le pas du chargement des résumés de la liste (§ 8.1) : ce qu'attend
// facade.resumer avant chaque événement, pour rendre la main au navigateur.
// Le premier pas attend l'image suivante, puis une minuterie de l'horloge :
// la minuterie armée au moment de l'image ne part qu'après la peinture de
// cette image, si bien que la liste est peinte avant le premier calcul. Les
// pas suivants n'attendent que la minuterie : entre deux événements, le
// navigateur traite les entrées en attente et peint quand une image est due.
// La minuterie vient de l'horloge de l'application, seule à en armer
// (§ 19.4) : sous l'horloge pilotée, chaque pas attend l'épreuve.

/**
 * Un pas neuf, dont le premier appel attend une image.
 *
 * @param {{planifier: (fn: () => void, ms: number) => unknown}} horloge
 * @param {(rappel: () => void) => unknown} image   demande le rappel à la
 *        prochaine image : requestAnimationFrame dans le navigateur
 * @returns {() => Promise<void>}
 */
export function creerPas(horloge, image) {
  let premier = true;
  return () =>
    new Promise((reprendre) => {
      const minuterie = () => horloge.planifier(reprendre, 0);
      if (!premier) {
        minuterie();
        return;
      }
      premier = false;
      image(minuterie);
    });
}
