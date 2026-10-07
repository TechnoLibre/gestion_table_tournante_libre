// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'état de navigation de l'interface : la section ouverte, le panneau « À
// propos », le tour montré, la personne mise en évidence, la proposition
// demandée au plan, le texte d'un import en attente, les listes de noms, le
// plein écran, la place sélectionnée, la fiche ouverte, le choix en attente
// du plan et le refus posé sur une place. Regarder n'écrit jamais (§ 8.4) : cet
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
 * @property {number|null} fiche          l'identifiant de la personne dont la fiche est ouverte
 * @property {null|{genre: 'personne'|'reservation', participant: number,
 *            depuis: {table: number, siege: number|null}|null,
 *            de?: {table: number, portee: 'tous'|'tour', tour: number|null}}} choix
 *           le choix en attente du plan (§ 5.8, § 7.1) : la personne choisie, ou sa
 *           réservation qui tient la place depuis ; depuis, sa place, null hors du
 *           dessin ; de, pour une réservation, ce qui la désigne dans la commande
 *           deplacerReservation
 * @property {null|{place: {table: number, siege?: number|null}, refus: Object|null,
 *            avertissements: Object[]}} pose
 *           le refus, ou les avertissements, posés sur une place du plan, que
 *           Plan.svelte montre sur la place (§ 5.9)
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
  fiche: null,
  choix: null,
  pose: null,
});

const GENRES_CHOIX = new Set(['personne', 'reservation']);
const PORTEES = new Set(['tous', 'tour']);

const entierPositif = (n) => Number.isInteger(n) && n >= 1;

// Vrai pour une place {table, siege|null} : table entière positive, siège
// entier positif ou null.
const estPlace = (place) =>
  place !== null && typeof place === 'object' && entierPositif(place.table) && (place.siege === null || entierPositif(place.siege));

// Le choix du contrat, figé ; RangeError hors du contrat.
function choixValide(choix) {
  const forme = choix !== null && typeof choix === 'object';
  const valide =
    forme &&
    GENRES_CHOIX.has(choix.genre) &&
    entierPositif(choix.participant) &&
    Object.hasOwn(choix, 'depuis') &&
    (choix.depuis === null || estPlace(choix.depuis)) &&
    (choix.genre === 'personne' ||
      (choix.de !== null &&
        typeof choix.de === 'object' &&
        entierPositif(choix.de.table) &&
        PORTEES.has(choix.de.portee) &&
        (choix.de.portee === 'tous' ? choix.de.tour === null : entierPositif(choix.de.tour))));
  if (!valide) throw new RangeError(`choix hors du contrat : ${JSON.stringify(choix)}`);
  const depuis = choix.depuis === null ? null : Object.freeze({ table: choix.depuis.table, siege: choix.depuis.siege });
  const fige = { genre: choix.genre, participant: choix.participant, depuis };
  if (choix.genre === 'reservation') fige.de = Object.freeze({ table: choix.de.table, portee: choix.de.portee, tour: choix.de.tour });
  return Object.freeze(fige);
}

/**
 * Un état de navigation neuf, à son départ.
 *
 * @returns {{subscribe: Function, etat: () => EtatUi, allerA: Function,
 *   reinitialiser: Function, ouvrirApropos: Function, fermerApropos: Function,
 *   montrerTour: Function, mettreEnEvidence: Function,
 *   montrerProposition: Function, ouvrirImport: Function,
 *   prendreImport: () => null|{texte: string, origine: string},
 *   basculerListes: Function, basculerPleinEcran: Function,
 *   selectionner: Function, ouvrirFiche: Function, choisir: Function,
 *   poserSurPlace: Function}}
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
    /** Ouvre une section ; RangeError hors de SECTIONS. Une autre section
     *  que la courante retire la pose : elle ne revient pas avec le plan. */
    allerA(section) {
      if (!SECTIONS.includes(section)) throw new RangeError(`section inconnue : ${JSON.stringify(section)}`);
      changer(section === etat.section ? {} : { section, pose: null });
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
    /** Montre le tour r, entier positif ; RangeError sinon. Le choix en
     *  attente s'oublie, et la pose, qui tient à l'état des places d'un tour. */
    montrerTour(r) {
      if (!Number.isInteger(r) || r < 1) throw new RangeError(`tour : entier positif attendu, reçu ${String(r)}`);
      changer({ tour: r, choix: null, pose: null });
    },
    mettreEnEvidence(id) {
      changer({ miseEnEvidence: id });
    },
    /** Demande la proposition id au plan, ou aucune (null) ; la pose, lue
     *  sur l'état des places d'avant, se retire. */
    montrerProposition(id) {
      changer({ proposition: id, pose: null });
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
    /** Sélectionne une place ; null retire la sélection et oublie le choix en attente. */
    selectionner(place) {
      changer(place === null ? { selection: null, choix: null } : { selection: place });
    },
    /** Pose le choix en attente (EtatUi.choix), ou l'oublie (null) ; RangeError hors du contrat. */
    choisir(choix) {
      changer({ choix: choix === null ? null : choixValide(choix) });
    },
    /** Pose sur une place un refus, ou des avertissements, que le plan montre ; null les retire.
     *  RangeError sans place. */
    poserSurPlace(pose) {
      if (pose === null) {
        changer({ pose: null });
        return;
      }
      const { place, refus = null, avertissements = [] } = pose;
      if (place === null || typeof place !== 'object' || !entierPositif(place.table)) {
        throw new RangeError(`pose sans place : ${JSON.stringify(pose)}`);
      }
      changer({ pose: Object.freeze({ place, refus, avertissements }) });
    },
    /** Ouvre la fiche de la personne id, entier positif, dans la section des
     *  participants ; null referme la fiche, la section reste. RangeError
     *  sinon. */
    ouvrirFiche(id) {
      if (id === null) {
        changer({ fiche: null });
        return;
      }
      if (!Number.isInteger(id) || id < 1) throw new RangeError(`fiche : entier positif ou null attendu, reçu ${String(id)}`);
      changer({ fiche: id, section: 'participants' });
    },
  };
}
