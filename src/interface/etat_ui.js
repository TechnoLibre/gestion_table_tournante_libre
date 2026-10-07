// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'état de navigation de l'interface : la section ouverte, le panneau « À
// propos », le tour montré, la personne mise en évidence, la proposition
// demandée au plan, le texte d'un import en attente, les listes de noms, le
// plein écran, la place sélectionnée. Regarder n'écrit jamais (§ 8.4) : cet
// état ne reçoit ni la séance, ni la façade, ni un système de fichiers, et
// rien de ce qu'il tient ne quitte la mémoire.
//
// Il suit le contrat des magasins de Svelte : subscribe(fn) appelle fn(etat)
// tout de suite, puis à chaque nouvel état ; un état est figé, et une
// transition qui ne change rien n'en publie pas de nouveau. L'écran — liste
// ou événement — ne s'y lit pas : il suit la séance.
import { SECTION_OUVERTURE, SECTIONS } from './evenement/sections.js';

/**
 * @typedef {Object} EtatUi
 * @property {string} section             l'une de SECTIONS
 * @property {boolean} apropos            le panneau « À propos » est ouvert
 * @property {number} tour                le tour montré, entier positif
 * @property {number|null} miseEnEvidence l'identifiant de la personne mise en évidence
 * @property {number|null} proposition    la proposition demandée au plan
 * @property {null|{texte: string, origine: string}} importEnAttente
 * @property {boolean} listes             les listes de noms sont montrées
 * @property {boolean} pleinEcran
 * @property {Object|null} selection      la place sélectionnée
 */

// L'état de navigation d'un événement qui s'ouvre, panneau « À propos »
// excepté : celui-ci ne tient pas à l'événement.
const DEPART = Object.freeze({
  section: SECTION_OUVERTURE,
  tour: 1,
  miseEnEvidence: null,
  proposition: null,
  importEnAttente: null,
  listes: true,
  pleinEcran: false,
  selection: null,
});

/**
 * Un état de navigation neuf, à son départ.
 *
 * @returns {{subscribe: Function, etat: () => EtatUi, allerA: Function,
 *   reinitialiser: Function, ouvrirApropos: Function, fermerApropos: Function,
 *   montrerTour: Function, mettreEnEvidence: Function,
 *   montrerProposition: Function, ouvrirImport: Function,
 *   prendreImport: () => null|{texte: string, origine: string},
 *   basculerListes: Function, basculerPleinEcran: Function,
 *   selectionner: Function}}
 */
export function creerEtatUi() {
  let etat = Object.freeze({ ...DEPART, apropos: false });
  const abonnes = new Set();

  // Publie l'état que donnent les changements, s'il diffère du courant sur
  // l'une de ses propriétés.
  function changer(changements) {
    const suivant = { ...etat, ...changements };
    if (Object.keys(suivant).every((cle) => Object.is(suivant[cle], etat[cle]))) return;
    etat = Object.freeze(suivant);
    for (const fn of [...abonnes]) fn(etat);
  }

  return {
    subscribe(fn) {
      abonnes.add(fn);
      fn(etat);
      return () => {
        abonnes.delete(fn);
      };
    },
    etat: () => etat,
    /** Ouvre une section ; RangeError hors de SECTIONS. */
    allerA(section) {
      if (!SECTIONS.includes(section)) throw new RangeError(`section inconnue : ${JSON.stringify(section)}`);
      changer({ section });
    },
    /** Le départ d'un événement qui s'ouvre ; le panneau « À propos » reste tel. */
    reinitialiser() {
      changer(DEPART);
    },
    ouvrirApropos() {
      changer({ apropos: true });
    },
    fermerApropos() {
      changer({ apropos: false });
    },
    /** Montre le tour r, entier positif ; RangeError sinon. */
    montrerTour(r) {
      if (!Number.isInteger(r) || r < 1) throw new RangeError(`tour : entier positif attendu, reçu ${String(r)}`);
      changer({ tour: r });
    },
    mettreEnEvidence(id) {
      changer({ miseEnEvidence: id });
    },
    montrerProposition(id) {
      changer({ proposition: id });
    },
    /** Garde un texte à importer et ouvre la section de l'import. */
    ouvrirImport({ texte, origine }) {
      changer({ importEnAttente: Object.freeze({ texte, origine }), section: 'import' });
    },
    /** Rend le texte en attente, une fois, puis null. */
    prendreImport() {
      const enAttente = etat.importEnAttente;
      changer({ importEnAttente: null });
      return enAttente;
    },
    basculerListes() {
      changer({ listes: !etat.listes });
    },
    basculerPleinEcran() {
      changer({ pleinEcran: !etat.pleinEcran });
    },
    selectionner(place) {
      changer({ selection: place });
    },
  };
}
