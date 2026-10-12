// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'état de navigation de l'interface : la section ouverte, le panneau « À
// propos », le tour montré, la personne mise en évidence, la proposition
// demandée au plan et le numéro de sa demande, le texte d'un import en
// attente, les listes de noms, le plein écran, la place sélectionnée, la
// fiche ouverte, le choix en attente du plan, le refus posé sur une place,
// l'appartenance collante du formulaire d'ajout, l'aperçu avant impression,
// la page du tableau des propositions et la position du sélecteur du
// mélange des tables de la page de qualité (§ 12.11, D54) — ce que la
// grille compte : sièges, assis ou doublons. Ce qu'il tient survit au
// démontage des sections.
// Regarder n'écrit jamais (§ 8.4) : cet état ne reçoit ni la séance, ni la
// façade, ni un système de fichiers, et rien de ce qu'il tient ne quitte la
// mémoire.
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
 * @property {boolean} pleinEcran       vrai seulement sur la section du plan
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
 * @property {string} appartenance        l'appartenance collante du formulaire d'ajout
 *           des participants : celle du dernier ajout (§ 10.2), '' au départ
 * @property {null|{vue: 'plan'|'accueil'|'tables', tour: number|'tous', listes: boolean,
 *            decoupe: 'auto'|'unePage'|'decoupe', parTour: boolean, retour: string}} apercu
 *           l'aperçu avant impression ouvert (§ 11.7), null fermé : la vue imprimée ; le
 *           tour du plan, 'tous' pour une vue de la soirée, jamais pour le plan ; les
 *           listes de noms du plan ; sa découpe en pages ; la feuille par table, une
 *           par tour ou la soirée en colonnes ; la section où l'aperçu se referme
 * @property {number} visee               le numéro de la dernière demande d'une proposition
 *           au plan : chaque montrerProposition d'une proposition l'augmente de 1, même
 *           pour celle déjà demandée ; 0 au départ
 * @property {Object|null} pagePropositions le suivi de la page du tableau des propositions
 *           (SuiviDePage, propositions/modele.js), figé, que la section des propositions
 *           tient ; null au départ, et chaque événement qui s'ouvre repart de la première page
 * @property {'sieges'|'assis'|'doublons'} melangeTables  la position du sélecteur du
 *           mélange des tables (§ 12.11) : une de POSITIONS_MELANGE, 'sieges' au départ ;
 *           chaque événement qui s'ouvre en repart, et un changement de section la garde
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
  appartenance: '',
  apercu: null,
  visee: 0,
  pagePropositions: null,
  melangeTables: 'sieges',
});

/** Les positions du sélecteur du mélange des tables (§ 12.11, D35), dans
 *  l'ordre du sélecteur : les sièges, les assis, les doublons parmi les
 *  affiliés. */
export const POSITIONS_MELANGE = Object.freeze(['sieges', 'assis', 'doublons']);

/** Les vues que l'aperçu imprime (§ 11.7). */
export const VUES_IMPRESSION = Object.freeze(['plan', 'accueil', 'tables']);

/** Les découpes du plan imprimé, celles de decouperPlan (src/geometrie/pages.js). */
export const DECOUPES = Object.freeze(['auto', 'unePage', 'decoupe']);

// Le domaine de chaque réglage de l'aperçu que reglerApercu change.
const REGLAGES_APERCU = Object.freeze({
  vue: (v) => VUES_IMPRESSION.includes(v),
  tour: (v) => v === 'tous' || entierPositif(v),
  listes: (v) => typeof v === 'boolean',
  decoupe: (v) => DECOUPES.includes(v),
  parTour: (v) => typeof v === 'boolean',
});

const GENRES_CHOIX = new Set(['personne', 'reservation']);
const PORTEES = new Set(['tous', 'tour']);

const entierPositif = (n) => Number.isInteger(n) && n >= 1;

// Vrai pour une place {table, siege|null} : table entière positive, siège
// entier positif ou null.
const estPlace = (place) =>
  place !== null && typeof place === 'object' && entierPositif(place.table) && (place.siege === null || entierPositif(place.siege));

// L'aperçu que donnent les changements reçus sur courant, figé ; RangeError
// pour un réglage inconnu ou hors de son domaine, et pour le plan à « tous » :
// le plan s'imprime tour par tour.
function apercuValide(courant, changements) {
  if (changements === null || typeof changements !== 'object') {
    throw new RangeError(`aperçu : réglages attendus, reçu ${String(changements)}`);
  }
  for (const [nom, valeur] of Object.entries(changements)) {
    if (!Object.hasOwn(REGLAGES_APERCU, nom) || !REGLAGES_APERCU[nom](valeur)) {
      throw new RangeError(`aperçu : ${nom} hors du domaine, reçu ${JSON.stringify(valeur)}`);
    }
  }
  const suivant = { ...courant, ...changements };
  if (suivant.vue === 'plan' && suivant.tour === 'tous') throw new RangeError('aperçu : le plan s’imprime à un tour, non à « tous »');
  return Object.freeze(suivant);
}

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
 *   poserSurPlace: Function, garderAppartenance: Function,
 *   ouvrirApercu: Function, reglerApercu: Function, fermerApercu: Function,
 *   retenirPagePropositions: Function, reglerMelangeTables: Function}}
 */
export function creerEtatUi() {
  let etat = Object.freeze({ ...DEPART, apropos: false });
  const abonnes = new Set();

  // Publie l'état que donnent les changements, s'il diffère du courant sur
  // l'une de ses propriétés. Le plein écran ne vaut que pour le plan : hors
  // de lui, il tombe, quelle que soit la transition qui quitte le plan, et
  // la navigation des sections, que le plein écran efface, revient.
  function changer(changements) {
    const suivant = { ...etat, ...changements };
    if (suivant.section !== 'plan') suivant.pleinEcran = false;
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
     *  sur l'état des places d'avant, se retire. Chaque demande d'une
     *  proposition reçoit le numéro de visée suivant, et publie donc un état
     *  neuf même pour la proposition déjà demandée : la section des
     *  propositions y reconnaît une visée nouvelle. */
    montrerProposition(id) {
      changer(id === null ? { proposition: null, pose: null } : { proposition: id, pose: null, visee: etat.visee + 1 });
    },
    /** Retient le suivi de la page du tableau des propositions, un objet
     *  figé, ou null ; RangeError sinon, sans rien changer. Le même suivi ne
     *  publie rien. */
    retenirPagePropositions(suivi) {
      if (suivi !== null && (typeof suivi !== 'object' || !Object.isFrozen(suivi))) {
        throw new RangeError(`page des propositions : suivi figé ou null attendu, reçu ${JSON.stringify(suivi)}`);
      }
      changer({ pagePropositions: suivi });
    },
    /** Règle la position du sélecteur du mélange des tables, l'une de
     *  POSITIONS_MELANGE ; RangeError sinon, sans rien changer. Regarder
     *  n'écrit rien : la position ne quitte pas cet état. */
    reglerMelangeTables(position) {
      if (!POSITIONS_MELANGE.includes(position)) {
        throw new RangeError(`mélange des tables : position hors de ${POSITIONS_MELANGE.join(', ')}, reçu ${JSON.stringify(position)}`);
      }
      changer({ melangeTables: position });
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
    /** Garde l'appartenance collante du formulaire d'ajout, une chaîne ;
     *  RangeError sinon. */
    garderAppartenance(texte) {
      if (typeof texte !== 'string') throw new RangeError(`appartenance : chaîne attendue, reçu ${String(texte)}`);
      changer({ appartenance: texte });
    },
    /** Ouvre l'aperçu avant impression sur la vue et le tour reçus : les
     *  listes du plan telles que l'écran les montre, la découpe proposée par
     *  défaut, la feuille par table couvrant la soirée ; la section courante
     *  est celle où il se refermera. RangeError hors du domaine
     *  (reglerApercu), sans rien changer. */
    ouvrirApercu(demande) {
      if (demande === null || typeof demande !== 'object' || !Object.hasOwn(demande, 'vue') || !Object.hasOwn(demande, 'tour')) {
        throw new RangeError(`aperçu : { vue, tour } attendu, reçu ${JSON.stringify(demande)}`);
      }
      const depart = { vue: 'plan', tour: 1, listes: etat.listes, decoupe: 'auto', parTour: false, retour: etat.section };
      changer({ apercu: apercuValide(depart, { vue: demande.vue, tour: demande.tour }) });
    },
    /** Change les réglages de l'aperçu ouvert — vue, tour, listes, decoupe,
     *  parTour — chacun dans son domaine ; RangeError hors de lui, pour un
     *  autre nom, ou sans aperçu ouvert, sans rien changer. */
    reglerApercu(changements) {
      if (etat.apercu === null) throw new RangeError('aperçu : aucun aperçu ouvert');
      changer({ apercu: apercuValide(etat.apercu, changements) });
    },
    /** Ferme l'aperçu et rend la section d'où il s'est ouvert. */
    fermerApercu() {
      if (etat.apercu === null) return;
      changer({ apercu: null, section: etat.apercu.retour });
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
