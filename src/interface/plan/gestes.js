// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La machine d'un geste du plan (§ 7.1, § 7.2, § 7.3, § 8.4), pure : un
// état, un événement, un contexte, et ce qu'il faut faire — les effets —,
// que Plan.svelte applique au DOM, à la séance et à l'état de navigation.
// Aucune fonction ne lit le DOM ni l'heure.
//
// Un geste naît d'un appui (presser) sur une source — une table, une
// personne assise sur sa chaise, la poignée d'une table, le sol —, au repos
// seulement : un second pointeur pendant un geste ne fait rien, et les
// mouvements d'un autre pointeur non plus. L'appui capture le pointeur et
// suspend le compte d'inactivité (debuterGeste) ; le relâcher et toute
// annulation le font repartir (finirGeste). L'appui devient glissement
// quand le pointeur s'éloigne de son point de départ de plus de
// SEUIL_GLISSER_PX ; en deçà, relâcher sélectionne la place et n'exécute
// rien. Tout se calcule en écart depuis l'appui (§ 7.2), sur la vue et le
// cadre relus à l'appui : aucun mouvement ne demande de mise en page.
//
// Pendant le glissement, le modèle ne change pas : une table et la vue se
// déplacent par l'attribut transform, écrit à chaque image ; la personne se
// montre par un fantôme qui suit le pointeur ; la poignée montre un nombre
// de places que le dessin prend sans rien écrire. Le relâcher confie au
// plus une commande à la séance (executer) ; une annulation — pointercancel,
// Échap, passage en lecture — restaure et n'exécute rien.
import { constante } from '../../geometrie/constantes.js';
import { placesSousPoignee } from '../../geometrie/tables.js';
import { deplacer, deplacerVue, dessinDepuisEcran, transformDe } from '../../geometrie/vue.js';

/** L'état d'aucun geste. */
export const REPOS = Object.freeze({ phase: 'repos' });

const SEUIL = constante('SEUIL_GLISSER_PX');

// La place que désigne une source : la chaise, la table — celle de la
// poignée comprise —, null pour le sol.
function placeDe({ genre, table, siege }) {
  if (genre === 'sol') return null;
  if (genre === 'personne') return { table, siege };
  return { table };
}

// Ce que restaure une annulation : le groupe de la table, le fantôme, le
// nombre de la poignée, la vue.
function cibleDe({ genre, table }) {
  if (genre === 'table' || genre === 'poignee') return { genre, table };
  return genre === 'personne' ? 'fantome' : 'vue';
}

// Un nombre écrit sans −0 : l'arrondi d'une petite valeur négative le rend.
const arrondi = (valeur) => Math.round(valeur) + 0;

// Le nombre que la poignée montre au point, arrêté au plus proche que le
// contrôle accepte entre le nombre sous le pointeur et le nombre initial,
// avec le refus du nombre qui l'arrête et les avertissements du nombre
// montré. L'écart radial est la projection du mouvement sur la diagonale de
// la poignée, ramenée en cm.
function nombreDePoignee(etat, point, contexte) {
  const { source, depart, vue } = etat;
  const initial = source.places;
  const ecartRadial = (point.x - depart.x + (point.y - depart.y)) / Math.SQRT2 / vue.k;
  const voulu = placesSousPoignee(initial, ecartRadial);
  const pas = Math.sign(initial - voulu);
  let refus = null;
  let places = initial;
  for (let n = voulu; n !== initial; n += pas) {
    const controle = contexte.controlerPlaces(source.table, n);
    if (controle.refus === null) {
      places = n;
      break;
    }
    refus = controle.refus;
  }
  const { avertissements } = contexte.controlerPlaces(source.table, places);
  return { places, refus, avertissements };
}

// Les effets d'un mouvement au point, l'appui devenu glissement, et l'état
// qui en résulte.
function glisser(etat, point, contexte, entree) {
  const { source, depart, vue, cadre } = etat;
  const effets = [];
  let suivant = etat;
  if (source.genre === 'table') {
    const dx = (point.x - depart.x) / vue.k;
    const dy = (point.y - depart.y) / vue.k;
    effets.push({ type: 'ecrireTransform', cible: cibleDe(source), transform: `translate(${dx},${dy})` });
  } else if (source.genre === 'sol') {
    effets.push({ type: 'ecrireTransform', cible: 'vue', transform: transformDe(deplacerVue(vue, depart, point)) });
  } else if (source.genre === 'personne') {
    if (source.participant !== null) {
      if (entree) effets.push({ type: 'montrerFantome', participant: source.participant, depuis: placeDe(source) });
      const transform = `translate(${point.x - cadre.gauche},${point.y - cadre.haut})`;
      effets.push({ type: 'ecrireTransform', cible: 'fantome', transform });
    }
  } else {
    const montre = nombreDePoignee(etat, point, contexte);
    const refusChange = JSON.stringify(montre.refus) !== JSON.stringify(etat.refus);
    const change =
      refusChange || montre.places !== etat.places || JSON.stringify(montre.avertissements) !== JSON.stringify(etat.avertissements);
    if (change) {
      effets.push({ type: 'montrerPlaces', table: source.table, places: montre.places, avertissements: montre.avertissements });
      if (refusChange) effets.push({ type: 'montrerRefus', place: placeDe(source), refus: montre.refus });
      suivant = { ...etat, ...montre };
    }
  }
  return { etat: { ...suivant, phase: 'glisse' }, effets };
}

// Un mouvement au point : rien sous le seuil tant que l'appui n'a pas
// glissé ; sinon les effets du glissement.
function bouger(etat, point, contexte) {
  if (etat.phase === 'appui' && Math.hypot(point.x - etat.depart.x, point.y - etat.depart.y) <= SEUIL) {
    return { etat, effets: [] };
  }
  return glisser(etat, point, contexte, etat.phase === 'appui');
}

// La fin d'un glissement : la commande que le geste confie à la séance,
// ou la restauration de ce qu'il a montré.
function achever(etat, point, contexte) {
  const { source, depart, vue, cadre } = etat;
  if (source.genre === 'table') {
    const position = deplacer(source.position, depart, point, vue.k);
    return [
      {
        type: 'executer',
        commande: 'deplacerTable',
        arguments: { id: source.table, position: { x: arrondi(position.x), y: arrondi(position.y) } },
        place: placeDe(source),
        apres: cibleDe(source),
      },
    ];
  }
  if (source.genre === 'sol') return [{ type: 'poserVue', vue: deplacerVue(vue, depart, point) }];
  if (source.genre === 'poignee') {
    if (etat.places === source.places) return [{ type: 'restaurer', cible: cibleDe(source) }];
    return [
      {
        type: 'executer',
        commande: 'changerPlacesTable',
        arguments: { id: source.table, sieges: etat.places, origine: 'poignee' },
        place: placeDe(source),
        apres: cibleDe(source),
      },
    ];
  }
  if (source.participant === null) return [];
  const { resultat, place } = contexte.deposer(source, dessinDepuisEcran(vue, cadre, point.x, point.y));
  const effets = [{ type: 'restaurer', cible: 'fantome' }];
  if (resultat === null) return effets;
  if (Object.hasOwn(resultat, 'refus')) return [...effets, { type: 'montrerRefus', place, refus: resultat.refus }];
  return [...effets, { type: 'executer', commande: resultat.commande, arguments: resultat.arguments, place, apres: null }];
}

/**
 * Un pas de la machine d'un geste du plan.
 *
 * Événements, chacun par son type :
 *   presser {source, pointeur, point, vue, cadre} — source {genre: 'table'|'personne'|'poignee'|'sol',
 *     table, siege, participant}, plus position (le centre de la table, cm) pour une table et
 *     places (sa capacité) pour une poignée ; participant null pour une chaise vide, qui se
 *     sélectionne et ne glisse rien ; point en px de la fenêtre ;
 *   bouger {point, pointeur}, relacher {point, pointeur} — un autre pointeur ne fait rien ;
 *   annuler {cause: 'pointercancel'|'echap'|'lecture'}.
 * Contexte : controlerPlaces(table, places) → {refus, avertissements}, le contrôle de
 * capacité d'origine 'poignee' sur la charge du geste ; deposer(source, point) → {resultat,
 * place}, le dépôt d'une personne au point de dessin (depot.js).
 * Effets, chacun par son type : capturer {pointeur}, debuterGeste, finirGeste,
 * ecrireTransform {cible, transform}, montrerFantome {participant, depuis},
 * montrerPlaces {table, places, avertissements}, montrerRefus {place, refus} — refus null
 * efface —, restaurer {cible}, poserVue {vue}, selectionner {place}, executer {commande,
 * arguments, place, apres} — place, où poser un refus de la commande ; apres, la cible à
 * restaurer une fois la commande achevée, ou null. Une cible est 'vue', 'fantome',
 * {genre: 'table', table} ou {genre: 'poignee', table}.
 *
 * Le relâcher joue d'abord le mouvement jusqu'à son point : un appui relâché loin de son
 * départ glisse, même sans mouvement livré entre-temps.
 *
 * @param {Object} etat   REPOS, ou l'état qu'un pas précédent a rendu
 * @param {Object} evenement
 * @param {Object} contexte
 * @returns {{etat: Object, effets: Object[]}}
 */
export function geste(etat, evenement, contexte) {
  const rien = { etat, effets: [] };
  if (evenement.type === 'presser') {
    if (etat.phase !== 'repos') return rien;
    const { source, pointeur, point, vue, cadre } = evenement;
    const suivant = { phase: 'appui', source, pointeur, depart: point, vue, cadre };
    if (source.genre === 'poignee') Object.assign(suivant, { places: source.places, refus: null, avertissements: [] });
    return { etat: suivant, effets: [{ type: 'capturer', pointeur }, { type: 'debuterGeste' }] };
  }
  if (etat.phase === 'repos') return rien;
  if (evenement.type === 'annuler') {
    return { etat: REPOS, effets: [{ type: 'restaurer', cible: cibleDe(etat.source) }, { type: 'finirGeste' }] };
  }
  if (evenement.pointeur !== etat.pointeur) return rien;
  if (evenement.type === 'bouger') return bouger(etat, evenement.point, contexte);
  if (evenement.type !== 'relacher') throw new TypeError(`événement de geste inconnu : ${JSON.stringify(evenement.type)}`);
  const mouvement = bouger(etat, evenement.point, contexte);
  const fin = { type: 'finirGeste' };
  if (mouvement.etat.phase === 'appui') {
    return { etat: REPOS, effets: [{ type: 'selectionner', place: placeDe(etat.source) }, fin] };
  }
  return { etat: REPOS, effets: [...mouvement.effets, ...achever(mouvement.etat, evenement.point, contexte), fin] };
}

/**
 * Le contrôle de places d'un geste, mémorisé : un nombre ne se contrôle
 * qu'une fois par table. Plan.svelte en crée un à chaque appui, sur la
 * charge de ce moment : un contrôle de capacité coûte un calcul des places
 * de chaque tour.
 *
 * @param {(table: number, places: number) => Object} controler
 * @returns {(table: number, places: number) => Object}
 */
export function memoriser(controler) {
  const rendus = new Map();
  return (table, places) => {
    const cle = `${table}:${places}`;
    if (!rendus.has(cle)) rendus.set(cle, controler(table, places));
    return rendus.get(cle);
  };
}

// Les clés du libellé du fantôme, par cible de l'état des places : ce que
// le dépôt modifie, ou rien sous une cible null.
const CLES_FANTOME = new Map([
  ['reservations', 'plan.fantome.reservations'],
  ['retenu', 'plan.fantome.retenu'],
  [null, 'plan.fantome.vueSeule'],
]);

// Sous la cible 'reservations', la clé d'une personne que sa réservation
// tient à sa chaise, par portée : son dépôt sur une chaise est
// deplacerReservation, qui garde la portée.
const CLES_RESERVATION_TENUE = new Map([
  ['tour', 'plan.fantome.reservationTour'],
  ['tous', 'plan.fantome.reservationTous'],
]);

/**
 * La clé du libellé que le fantôme porte pendant le glissement d'une
 * personne (§ 5.8, § 7.1) : sous la cible 'reservations', « pose une
 * réservation » pour une personne que rien ne tient, sinon le déplacement
 * de sa réservation et sa portée — « tous les tours » s'y dit ; « déplace
 * dans le placement retenu » sous 'retenu' ; la vue seule sous une cible
 * null. Une cible ou une portée hors du contrat lève : elle ne prend aucun
 * libellé par défaut.
 *
 * @param {'reservations'|'retenu'|null} cible  EtatPlaces.cible
 * @param {'tous'|'tour'|null} [portee]  la portée de la réservation qui tient
 *   la personne à sa chaise d'origine (reservationTenue de depot.js), ou null
 * @returns {string}
 */
export function cleFantome(cible, portee = null) {
  if (!CLES_FANTOME.has(cible)) throw new TypeError(`cible du fantôme hors du contrat : ${JSON.stringify(cible)}`);
  if (portee !== null && !CLES_RESERVATION_TENUE.has(portee)) {
    throw new TypeError(`portée du fantôme hors du contrat : ${JSON.stringify(portee)}`);
  }
  if (cible === 'reservations' && portee !== null) return CLES_RESERVATION_TENUE.get(portee);
  return CLES_FANTOME.get(cible);
}

/**
 * Le libellé de la place où un refus ou un avertissement se pose : la table
 * seule quand la place n'a pas de siège, la table et le siège sinon. Un
 * siège qui n'est ni null ni un entier positif lève.
 *
 * @param {{numero: number|null, siege: number|null}} place
 * @returns {{cle: string, details: Object}}
 */
export function libellePlace({ numero, siege }) {
  if (siege === null) return { cle: 'plan.refus.table', details: { numero } };
  if (!Number.isInteger(siege) || siege < 1) throw new TypeError(`siège d’une place hors du contrat : ${JSON.stringify(siege)}`);
  return { cle: 'plan.refus.siege', details: { numero, siege } };
}
