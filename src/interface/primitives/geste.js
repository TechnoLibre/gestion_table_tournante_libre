// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le geste qu'une primitive tient ouvert sur la séance (§ 8.4) : une saisie
// non validée, une fenêtre à confirmer ouverte. Un geste compté par la
// séance suspend son compte d'inactivité, qui ne la ramène pas en lecture
// sous l'opérateur.
//
// Le geste ne se compte qu'en écriture, seul mode où le compte d'inactivité
// court. Le retour en lecture, explicite ou à la fermeture de l'événement,
// remet le compte de la séance à zéro et l'annonce par surAnnulation : le
// geste n'est plus compté, et finirGeste n'est pas appelé pour lui — il
// retirerait le geste d'une autre primitive. Le retour automatique n'a lieu
// que sans geste compté. Le passage en écriture suivant, que subscribe
// publie, recompte le geste que la primitive tient encore.

/**
 * Le geste d'une primitive sur une séance.
 *
 * @param {{subscribe: Function, surAnnulation: Function, debuterGeste: Function, finirGeste: Function}} seance
 * @returns {{tenir: (voulu: boolean) => void, liberer: () => void}}
 *   tenir(voulu) dit si la primitive tient le geste ouvert ; liberer, au
 *   démontage, finit le geste compté et désabonne.
 */
export function creerGeste(seance) {
  // voulu : la primitive tient le geste ; compte : la séance le compte ;
  // ecriture : le mode publié en dernier, ou annoncé quitté.
  let voulu = false;
  let compte = false;
  let ecriture = false;

  function ajuster() {
    if (voulu && ecriture && !compte) {
      compte = true;
      seance.debuterGeste();
    } else if (!voulu && compte) {
      compte = false;
      seance.finirGeste();
    }
  }

  const desabonnerEtat = seance.subscribe((etat) => {
    ecriture = etat.mode === 'ecriture';
    ajuster();
  });
  const desabonnerAnnulation = seance.surAnnulation(() => {
    ecriture = false;
    compte = false;
  });

  return {
    tenir(nouveau) {
      voulu = nouveau;
      ajuster();
    },
    liberer() {
      voulu = false;
      ajuster();
      desabonnerEtat();
      desabonnerAnnulation();
    },
  };
}
