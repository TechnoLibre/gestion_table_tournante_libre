// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// L'état de navigation de l'interface : la section ouverte, le panneau « À
// propos » et le panneau « Paramètres », le thème de la séance, le tour
// montré, la personne mise en évidence et la demande de la centrer sur le
// plan, la proposition demandée au plan et le numéro de sa demande, le texte
// d'un import en attente, les listes de noms et les organisations qu'elles
// portent, le plein écran, la place sélectionnée, la fiche ouverte, le choix
// en attente du plan, le refus posé sur une place, l'aperçu de la section
// de l'impression, la page du tableau des propositions, la position du
// sélecteur du mélange des tables de la page de qualité (§ 12.11, D54) — ce
// que la grille compte : sièges, assis ou doublons —, le départ d'une
// génération dérivée et ses tours figés (§ 5.7), le second placement de la
// vue de comparaison (§ 12.10.6) et la vue de la qualité demandée. Ce qu'il
// tient survit au démontage des sections.
// Le départ et le second placement sont des états de navigation (§ 8.4) :
// les choisir n'écrit rien, en lecture comme sur un plan bloqué ;
// oublierAbsents les retire quand ils quittent la liste, et un événement
// qui s'ouvre en repart sans eux.
// Regarder n'écrit jamais (§ 8.4) : cet état ne reçoit ni la séance, ni la
// façade, ni un système de fichiers, et rien de ce qu'il tient ne quitte la
// mémoire. Le thème part du clair ; App y pose celui du lancement, puis le
// réglage de l'opérateur le change pour la séance (§ 19.2).
// Un panneau à la fois : ouvrir l'un ferme l'autre. Les commandes du
// bandeau basculent le leur — l'ouvrent fermé, le referment ouvert — et la
// fermeture, par le bandeau comme par « Fermer », ne touche qu'au panneau :
// l'écran d'où il s'est ouvert revient tel qu'il était (§ 18.6).
//
// Il suit le contrat des magasins de Svelte : subscribe(fn) appelle fn(etat)
// tout de suite, puis à chaque nouvel état ; un état est figé, et une
// transition qui ne change rien n'en publie pas de nouveau. L'écran — liste
// ou événement — ne s'y lit pas : il suit la séance.
import { SECTION_IMPRESSION, SECTION_OUVERTURE, SECTIONS } from './evenement/sections.js';
import { THEMES } from './theme.js';

/**
 * @typedef {Object} EtatUi
 * @property {string} section             l'une de SECTIONS
 * @property {boolean} apropos            le panneau « À propos » est ouvert
 * @property {boolean} parametres         le panneau « Paramètres » est ouvert ; jamais
 *           avec « À propos »
 * @property {'clair'|'sombre'} theme     le thème de la séance, l'un de THEMES
 * @property {number} tour                le tour montré, entier positif
 * @property {number|null} miseEnEvidence l'identifiant de la personne mise en évidence
 * @property {boolean} centrerEvidence    le plan doit amener la chaise de la personne mise
 *           en évidence au centre de sa vue (« Voir sur le plan », § 7.1) ; Plan.svelte
 *           la consomme (evidenceCentree) ; faux au départ
 * @property {number|null} proposition    la proposition demandée au plan
 * @property {null|{texte: string, origine: string}} importEnAttente
 * @property {boolean} listes             les listes de noms sont montrées
 * @property {boolean} organisations      les listes portent l'organisation de chaque
 *           occupant, à droite de son nom ; faux au départ
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
 * @property {null|{vue: 'plan'|'accueil'|'tables', tour: number|'tous', listes: boolean,
 *            organisations: boolean, decoupe: 'auto'|'unePage'|'decoupe', parColonne: boolean,
 *            parTour: boolean, dessinTable: boolean}} apercu
 *           l'aperçu avant impression (§ 11.7), que la section de l'impression porte sous
 *           son titre « Plan » : présent tant que cette section est ouverte, null hors
 *           d'elle. La vue imprimée ; le tour du plan, 'tous' pour une vue de la soirée,
 *           jamais pour le plan ; les listes de noms du plan, et les organisations
 *           qu'elles portent ; sa découpe en pages, et une colonne de tables par page ; la
 *           feuille par table, une par tour ou la soirée en colonnes, et le dessin de la
 *           table en tête de chaque page
 * @property {number} visee               le numéro de la dernière demande d'une proposition
 *           au plan : chaque montrerProposition d'une proposition l'augmente de 1, même
 *           pour celle déjà demandée ; 0 au départ
 * @property {Object|null} pagePropositions le suivi de la page du tableau des propositions
 *           (SuiviDePage, propositions/modele.js), figé, que la section des propositions
 *           tient ; null au départ, et chaque événement qui s'ouvre repart de la première page
 * @property {'sieges'|'assis'|'doublons'} melangeTables  la position du sélecteur du
 *           mélange des tables (§ 12.11) : une de POSITIONS_MELANGE, 'sieges' au départ ;
 *           chaque événement qui s'ouvre en repart, et un changement de section la garde
 * @property {null|{id: number, toursFiges: number[]}} depart  le départ de la génération
 *           dérivée (§ 5.7, C6) : l'identifiant de la proposition et les tours à figer,
 *           numéros distincts, croissants, figés ; null sans départ
 * @property {number|'retenu'|null} comparee  le second placement de la vue de comparaison
 *           (§ 12.10.6, C14) : une proposition, le retenu, ou null pour le défaut de la vue
 * @property {'comparaison'|null} vueQualite  la vue que la page de qualité doit porter à
 *           l'écran et au focus, null sans demande ; SectionQualite la consomme
 *           (vueQualiteAtteinte)
 * Chaque événement qui s'ouvre repart de depart, comparee et vueQualite à null, et un
 * changement de section les garde.
 */

// L'état de navigation d'un événement qui s'ouvre, panneaux « À propos » et
// « Paramètres » et thème exceptés : ils ne tiennent pas à l'événement.
const DEPART = Object.freeze({
  section: SECTION_OUVERTURE,
  tour: 1,
  miseEnEvidence: null,
  centrerEvidence: false,
  proposition: null,
  importEnAttente: null,
  listes: true,
  organisations: false,
  pleinEcran: false,
  selection: null,
  fiche: null,
  choix: null,
  pose: null,
  apercu: null,
  visee: 0,
  pagePropositions: null,
  melangeTables: 'sieges',
  depart: null,
  comparee: null,
  vueQualite: null,
});

/** Les vues de la page de qualité qu'une autre section peut demander
 *  (demanderVueQualite) : la comparaison, que « Comparer » ouvre (C14). */
export const VUES_QUALITE_DEMANDABLES = Object.freeze(['comparaison']);

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
  organisations: (v) => typeof v === 'boolean',
  decoupe: (v) => DECOUPES.includes(v),
  parColonne: (v) => typeof v === 'boolean',
  parTour: (v) => typeof v === 'boolean',
  dessinTable: (v) => typeof v === 'boolean',
});

const GENRES_CHOIX = new Set(['personne', 'reservation']);
const PORTEES = new Set(['tous', 'tour']);

const entierPositif = (n) => Number.isInteger(n) && n >= 1;

// Vrai pour la valeur du second placement : un identifiant, le retenu, ou
// null.
const estComparee = (cle) => cle === null || cle === 'retenu' || entierPositif(cle);

// Vrai quand deux listes d'entiers sont égales terme à terme.
const memesTours = (a, b) => a.length === b.length && a.every((tour, i) => tour === b[i]);

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

// L'aperçu de la section de l'impression qui s'ouvre sur l'état suivant : le
// plan au tour montré, les listes du plan et leurs organisations telles que
// l'écran les montre, la découpe proposée par défaut, sans une colonne par
// page, la feuille par table couvrant la soirée, sans le dessin de la table.
// Le départ passe par apercuValide, comme tout réglage.
const apercuDeDepart = (suivant) => ({
  vue: 'plan',
  tour: suivant.tour,
  listes: suivant.listes,
  organisations: suivant.organisations,
  decoupe: 'auto',
  parColonne: false,
  parTour: false,
  dessinTable: false,
});

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
 *   ouvrirParametres: Function, fermerParametres: Function,
 *   basculerApropos: Function, basculerParametres: Function, choisirTheme: Function,
 *   montrerTour: Function, mettreEnEvidence: Function, evidenceCentree: Function,
 *   montrerProposition: Function, ouvrirImport: Function,
 *   prendreImport: () => null|{texte: string, origine: string},
 *   basculerListes: Function, basculerOrganisations: Function, basculerPleinEcran: Function,
 *   selectionner: Function, ouvrirFiche: Function, choisir: Function,
 *   poserSurPlace: Function,
 *   reglerApercu: Function,
 *   retenirPagePropositions: Function, reglerMelangeTables: Function,
 *   choisirDepart: Function, reglerToursFiges: Function, retirerDepart: Function,
 *   comparerA: Function, demanderVueQualite: Function, vueQualiteAtteinte: Function,
 *   oublierAbsents: Function}}
 */
export function creerEtatUi() {
  let etat = Object.freeze({ ...DEPART, apropos: false, parametres: false, theme: THEMES[0] });
  const abonnes = new Set();

  // Publie l'état que donnent les changements, s'il diffère du courant sur
  // l'une de ses propriétés. Le plein écran ne vaut que pour le plan : hors
  // de lui, il tombe, quelle que soit la transition qui quitte le plan, et
  // la navigation des sections, que le plein écran efface, revient.
  // L'aperçu ne vaut que pour la section de l'impression : hors d'elle, il
  // tombe ; elle s'ouvre sans aperçu, il naît de son départ
  // (apercuDeDepart).
  function changer(changements) {
    const suivant = { ...etat, ...changements };
    if (suivant.section !== 'plan') suivant.pleinEcran = false;
    if (suivant.section !== SECTION_IMPRESSION) suivant.apercu = null;
    else if (suivant.apercu === null) suivant.apercu = apercuValide({}, apercuDeDepart(suivant));
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
    /** Le départ d'un événement qui s'ouvre ; les panneaux et le thème restent tels. */
    reinitialiser() {
      changer(DEPART);
    },
    /** Ouvre « À propos », et ferme « Paramètres » : un panneau à la fois. */
    ouvrirApropos() {
      changer({ apropos: true, parametres: false });
    },
    fermerApropos() {
      changer({ apropos: false });
    },
    /** Ouvre « Paramètres », et ferme « À propos » : un panneau à la fois. */
    ouvrirParametres() {
      changer({ parametres: true, apropos: false });
    },
    fermerParametres() {
      changer({ parametres: false });
    },
    /** La commande « Paramètres » du bandeau : fermé, ouvre le panneau, comme
     *  ouvrirParametres ; ouvert, le referme, comme fermerParametres. */
    basculerParametres() {
      if (etat.parametres) changer({ parametres: false });
      else changer({ parametres: true, apropos: false });
    },
    /** La commande « À propos » du bandeau : fermé, ouvre le panneau, comme
     *  ouvrirApropos ; ouvert, le referme, comme fermerApropos. */
    basculerApropos() {
      if (etat.apropos) changer({ apropos: false });
      else changer({ apropos: true, parametres: false });
    },
    /** Pose le thème de la séance, l'un de THEMES ; RangeError sinon, sans
     *  rien changer. */
    choisirTheme(theme) {
      if (!THEMES.includes(theme)) throw new RangeError(`thème hors de ${THEMES.join(', ')}, reçu ${JSON.stringify(theme)}`);
      changer({ theme });
    },
    /** Montre le tour r, entier positif ; RangeError sinon. Le choix en
     *  attente s'oublie, et la pose, qui tient à l'état des places d'un tour. */
    montrerTour(r) {
      if (!Number.isInteger(r) || r < 1) throw new RangeError(`tour : entier positif attendu, reçu ${String(r)}`);
      changer({ tour: r, choix: null, pose: null });
    },
    /** Met la personne id en évidence, ou personne (null). Avec centrer
     *  vrai, demande au plan d'amener sa chaise au centre de sa vue ; une
     *  mise en évidence sans centrer, et null, retirent la demande en
     *  attente. RangeError pour un centrer qui n'est pas un booléen, sans
     *  rien changer. */
    mettreEnEvidence(id, { centrer = false } = {}) {
      if (typeof centrer !== 'boolean') throw new RangeError(`centrer : booléen attendu, reçu ${JSON.stringify(centrer)}`);
      changer({ miseEnEvidence: id, centrerEvidence: centrer && id !== null });
    },
    /** Retire la demande de centrer la personne mise en évidence, une fois
     *  le plan à même d'y répondre. */
    evidenceCentree() {
      changer({ centrerEvidence: false });
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
    /** Choisit le départ de la génération dérivée, l'identifiant id d'une
     *  proposition, entier ≥ 1 ; RangeError sinon, sans rien changer. Chaque
     *  choix, du même départ comme d'un autre, décoche tous les tours (C6) ;
     *  le même départ sans tour figé ne publie rien. */
    choisirDepart(id) {
      if (!entierPositif(id)) throw new RangeError(`départ : identifiant entier ≥ 1 attendu, reçu ${JSON.stringify(id)}`);
      if (etat.depart?.id === id && etat.depart.toursFiges.length === 0) return;
      changer({ depart: Object.freeze({ id, toursFiges: Object.freeze([]) }) });
    },
    /** Règle les tours à figer du départ choisi : une liste d'entiers ≥ 1,
     *  distincts, gardée croissante dans une copie figée, la liste vide les
     *  décochant tous. RangeError pour une autre liste, et sans départ
     *  choisi, sans rien changer. Que les tours tiennent dans la soirée, et
     *  n'y soient pas tous, se juge au lancement : la soirée n'est pas ici. */
    reglerToursFiges(tours) {
      if (etat.depart === null) throw new RangeError('tours figés : aucun départ choisi');
      if (!Array.isArray(tours) || !tours.every(entierPositif) || new Set(tours).size !== tours.length) {
        throw new RangeError(`tours figés : entiers ≥ 1 distincts attendus, reçu ${JSON.stringify(tours)}`);
      }
      const croissants = [...tours].sort((a, b) => a - b);
      if (memesTours(croissants, etat.depart.toursFiges)) return;
      changer({ depart: Object.freeze({ id: etat.depart.id, toursFiges: Object.freeze(croissants) }) });
    },
    /** Retire le départ et ses tours figés : « Repartir de zéro ». */
    retirerDepart() {
      changer({ depart: null });
    },
    /** Pose le second placement de la vue de comparaison : l'identifiant
     *  d'une proposition, entier ≥ 1, 'retenu', ou null, le défaut de la
     *  vue ; RangeError sinon, sans rien changer. Il ne change ni la
     *  proposition montrée ni la section. */
    comparerA(cle) {
      if (!estComparee(cle)) throw new RangeError(`second placement : identifiant, 'retenu' ou null attendu, reçu ${JSON.stringify(cle)}`);
      changer({ comparee: cle });
    },
    /** Demande à la page de qualité de porter la vue nom, l'une de
     *  VUES_QUALITE_DEMANDABLES, à l'écran et au focus ; RangeError sinon,
     *  sans rien changer. La section n'en change pas. */
    demanderVueQualite(nom) {
      if (!VUES_QUALITE_DEMANDABLES.includes(nom)) {
        throw new RangeError(`vue de la qualité : l'une de ${VUES_QUALITE_DEMANDABLES.join(', ')} attendue, reçu ${JSON.stringify(nom)}`);
      }
      changer({ vueQualite: nom });
    },
    /** Retire la demande de vue, une fois la vue portée à l'écran. */
    vueQualiteAtteinte() {
      changer({ vueQualite: null });
    },
    /** Oublie ce qui a quitté la charge : le départ dont l'identifiant n'est
     *  plus parmi propositions, et le second placement absent — un
     *  identifiant hors de propositions, ou 'retenu' quand retenu est faux.
     *  propositions : les identifiants de la charge ; retenu : vrai quand la
     *  charge a un retenu. Rien d'autre ne change, et ce qui est retiré ne
     *  revient pas avec la proposition qu'un retour rend. RangeError pour
     *  une autre forme, sans rien changer. */
    oublierAbsents(presents) {
      const forme = presents !== null && typeof presents === 'object' && Array.isArray(presents.propositions) && typeof presents.retenu === 'boolean';
      if (!forme) throw new RangeError(`absents : { propositions: identifiants, retenu: booléen } attendu, reçu ${JSON.stringify(presents)}`);
      const ids = new Set(presents.propositions);
      const { depart, comparee } = etat;
      const changements = {};
      if (depart !== null && !ids.has(depart.id)) changements.depart = null;
      if (comparee === 'retenu' ? !presents.retenu : comparee !== null && !ids.has(comparee)) changements.comparee = null;
      changer(changements);
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
    /** Montre, ou retire, l'organisation de chaque occupant dans les
     *  listes ; listes masquées, le réglage se garde pour leur retour. */
    basculerOrganisations() {
      changer({ organisations: !etat.organisations });
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
    /** Change les réglages de l'aperçu de la section de l'impression —
     *  vue, tour, listes, organisations, decoupe, parColonne, parTour,
     *  dessinTable — chacun dans son domaine ; RangeError hors de lui, pour
     *  un autre nom, ou hors de cette section, sans rien changer. */
    reglerApercu(changements) {
      if (etat.apercu === null) throw new RangeError('aperçu : aucun aperçu ouvert');
      changer({ apercu: apercuValide(etat.apercu, changements) });
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
