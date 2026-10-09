// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le modèle de l'aperçu avant impression (§ 11.7, § 8.5, § 18.6), sans DOM :
// ce qu'une vue imprime — papier, orientation, tour —, les dimensions d'une
// page et de sa zone de contenu, la bande mesurée, la page nommée que la
// feuille d'impression déclare pour chaque papier et chaque orientation, le
// pied de cinq éléments et le filigrane d'une feuille, la source que
// l'aperçu imprime et la découpe du plan. Le modèle ne rend que des
// nombres, des codes, des clés et des données ; les composants les
// traduisent et les posent.
import { etatPlaces } from '../../application/places.js';
import { decouperPlan } from '../../geometrie/pages.js';
import { PAPIERS } from '../../geometrie/papiers.js';
import { englobantImpression, geometrieTable } from '../../geometrie/tables.js';
import { DECOUPES, VUES_IMPRESSION } from '../etat_ui.js';

/** Millimètres par pixel CSS : 96 px au pouce, 25,4 mm au pouce. */
export const MM_PAR_PX = 25.4 / 96;

/** Les papiers que l'aperçu offre, ceux de PAPIERS, dans leur ordre. */
export const PAPIERS_OFFERTS = Object.freeze(Object.keys(PAPIERS));

const ORIENTATIONS = Object.freeze(['portrait', 'paysage']);

// Le diviseur de la diagonale de la page qui donne le corps du filigrane :
// « BROUILLON » couvre environ 6 corps de Noto Sans en capitales, et tient
// alors dans la diagonale avec sa marge.
const DIVISEUR_CORPS_FILIGRANE = 9;

// L'épaisseur du contour du filigrane, en mm de papier.
const TRAIT_FILIGRANE_MM = 0.6;

function exigerPapier(papier) {
  if (typeof papier !== 'string' || !Object.hasOwn(PAPIERS, papier)) {
    throw new RangeError(`papier inconnu : ${JSON.stringify(papier)}`);
  }
}

function exigerOrientation(orientation) {
  if (!ORIENTATIONS.includes(orientation)) throw new RangeError(`orientation inconnue : ${JSON.stringify(orientation)}`);
}

const nombreFini = (valeur) => typeof valeur === 'number' && Number.isFinite(valeur);

/**
 * Ce que l'aperçu imprime, tiré de son état (EtatUi.apercu) et du papier de
 * la machine (EtatSeance.papier). Les listes — liste d'accueil, feuilles
 * par table — s'impriment en portrait et couvrent la soirée ; le plan
 * s'imprime à son tour, dans l'orientation que choisit sa découpe (null
 * ici). Sans papier choisi, question est vrai : l'aperçu pose la question
 * du papier avant de rien mettre en page (§ 8.5, § 11.2).
 *
 * @param {{vue: string, tour: number|'tous', listes: boolean, decoupe: string, parTour: boolean}} apercu
 * @param {'A4'|'Lettre'|null} papier
 * @returns {{vue: string, papier: string|null, orientation: 'portrait'|null, tour: number|'tous',
 *            listes: boolean, decoupe: string, parTour: boolean, question: boolean}}
 * @throws {TypeError} sans aperçu ouvert
 * @throws {RangeError} une vue ou un papier hors de leur domaine
 */
export function optionsApercu(apercu, papier) {
  if (apercu === null || typeof apercu !== 'object') throw new TypeError('optionsApercu : aucun aperçu ouvert');
  if (!VUES_IMPRESSION.includes(apercu.vue)) throw new RangeError(`vue inconnue : ${JSON.stringify(apercu.vue)}`);
  if (papier !== null) exigerPapier(papier);
  const plan = apercu.vue === 'plan';
  return {
    vue: apercu.vue,
    papier,
    orientation: plan ? null : 'portrait',
    tour: plan ? apercu.tour : 'tous',
    listes: apercu.listes,
    decoupe: apercu.decoupe,
    parTour: apercu.parTour,
    question: papier === null,
  };
}

/** Les tours que le plan imprimé offre : de 1 à tours, dans l'ordre. */
export function toursOfferts(tours) {
  if (!Number.isSafeInteger(tours) || tours < 1) throw new RangeError(`tours : entier ≥ 1 attendu, reçu ${String(tours)}`);
  return Array.from({ length: tours }, (_, rang) => rang + 1);
}

/** Les dimensions d'une page, en mm : le papier, couché en paysage. */
export function dimensionsPage(papier, orientation) {
  exigerPapier(papier);
  exigerOrientation(orientation);
  const { largeur, hauteur } = PAPIERS[papier];
  return orientation === 'portrait' ? { largeur, hauteur } : { largeur: hauteur, hauteur: largeur };
}

/** Les clés de libellé d'un papier, sous son nom en minuscules : son nom
 *  seul, et le choix qui le décrit. */
export function clesPapier(papier) {
  exigerPapier(papier);
  const cle = papier.toLowerCase();
  return { nom: `impression.papier.nom.${cle}`, choix: `impression.papier.choix.${cle}` };
}

/** La clé du libellé d'une vue imprimée. */
export function cleVue(vue) {
  if (!VUES_IMPRESSION.includes(vue)) throw new RangeError(`vue inconnue : ${JSON.stringify(vue)}`);
  return `impression.vue.${vue}`;
}

/** La clé du libellé d'une découpe du plan. */
export function cleDecoupe(decoupe) {
  if (!DECOUPES.includes(decoupe)) throw new RangeError(`découpe inconnue : ${JSON.stringify(decoupe)}`);
  return `impression.decoupe.${decoupe}`;
}

/**
 * Le nom de la page que la feuille d'impression déclare pour un papier et
 * une orientation, le papier en minuscules : impression.css porte une règle
 * @page de ce nom, à la taille du papier, sans marge, et chaque feuille la
 * demande par sa propriété page.
 */
export function nomPage(papier, orientation) {
  exigerPapier(papier);
  exigerOrientation(orientation);
  return `gtt-${papier.toLowerCase()}-${orientation}`;
}

/**
 * La hauteur de la zone de contenu d'une feuille, en mm : la page, moins la
 * marge de chaque bord, moins la bande — ce que la feuille porte hors de
 * son contenu, mesuré sur la feuille gabarit. La découpe du plan reçoit la
 * même bande : la zone de contenu est la hauteur utile d'une page.
 *
 * @throws {RangeError} une marge ou une bande négative ou non finie ; une
 *         page sans contenu
 */
export function hauteurContenu({ papier, orientation, margeMm, bandeMm }) {
  const { hauteur } = dimensionsPage(papier, orientation);
  for (const [nom, valeur] of [['marge', margeMm], ['bande', bandeMm]]) {
    if (!nombreFini(valeur) || valeur < 0) throw new RangeError(`${nom} : nombre fini ≥ 0 attendu, reçu ${String(valeur)}`);
  }
  const reste = hauteur - 2 * margeMm - bandeMm;
  if (!(reste > 0)) throw new RangeError(`page ${papier} ${orientation} sans contenu : ${reste} mm`);
  return reste;
}

/**
 * La bande d'une feuille gabarit, en mm (HAUTEUR_BANDE_IMPRESSION, § 14.1) :
 * tout ce qu'elle porte hors de sa zone de contenu — pied, et ce que la vue
 * y ajoute —, soit sa hauteur rendue moins celle du contenu, moins la marge
 * de chaque bord, que la feuille porte en retrait.
 *
 * @param {{feuillePx: number, contenuPx: number, margeMm: number}} mesure  px CSS
 * @returns {number}
 * @throws {RangeError} une mesure non finie, une bande négative
 */
export function bandeDeFeuille({ feuillePx, contenuPx, margeMm }) {
  const bande = (feuillePx - contenuPx) * MM_PAR_PX - 2 * margeMm;
  if (!nombreFini(bande) || bande < 0) {
    throw new RangeError(`bande : la feuille de ${feuillePx} px ne porte pas son contenu de ${contenuPx} px et ses marges de ${margeMm} mm`);
  }
  return bande;
}

// Un élément du pied : son libellé traduit, ou null ; sa donnée, ou null ;
// la forme sous laquelle la donnée s'écrit.
const element = (nom, libelle, donnee = null, forme = 'texte') => ({ element: nom, libelle, donnee, forme });
const libelle = (cle, details = {}) => ({ cle, details });

/**
 * La feuille d'un pied (piedDePage, src/application/sorties.js) : ses cinq
 * éléments dans l'ordre du § 11.7 — nom de l'événement, date, tour,
 * horodatage du placement, version —, chacun un libellé à traduire et une
 * donnée à poser telle quelle (forme 'texte') ou à mettre en forme ('date',
 * 'horodatage'), et le filigrane, qui suit brouillon (estBrouillon). Une
 * date ou un horodatage absents s'écrivent par un libellé qui le dit.
 *
 * @param {{nom: string, date: string|null, tour: number|'tous', horodatage: string|null, version: string}} pied
 * @param {boolean} brouillon
 * @returns {{elements: Array<{element: string, libelle: {cle: string, details: Object}|null,
 *            donnee: string|null, forme: 'texte'|'date'|'horodatage'}>, filigrane: boolean}}
 * @throws {TypeError} un pied hors du contrat, un brouillon non booléen
 */
export function feuilleDe(pied, brouillon) {
  const { nom, date, tour, horodatage, version } = pied;
  const texteOuNull = (v) => v === null || typeof v === 'string';
  const valide =
    typeof nom === 'string' &&
    typeof version === 'string' &&
    texteOuNull(date) &&
    texteOuNull(horodatage) &&
    (tour === 'tous' || (Number.isSafeInteger(tour) && tour >= 1));
  if (!valide) throw new TypeError(`feuilleDe : pied hors du contrat ${JSON.stringify(pied)}`);
  if (typeof brouillon !== 'boolean') throw new TypeError(`feuilleDe : brouillon booléen attendu, reçu ${String(brouillon)}`);
  return {
    elements: [
      element('nom', null, nom),
      date === null ? element('date', libelle('impression.pied.sansDate')) : element('date', null, date, 'date'),
      element('tour', tour === 'tous' ? libelle('impression.pied.tousLesTours') : libelle('impression.pied.tour', { tour })),
      horodatage === null
        ? element('horodatage', libelle('impression.pied.placementInconnu'))
        : element('horodatage', libelle('impression.pied.placement'), horodatage, 'horodatage'),
      element('version', libelle('impression.pied.version'), version),
    ],
    filigrane: brouillon,
  };
}

/**
 * Le filigrane d'une page, en mm de papier : la page entière pour cadre,
 * son centre, l'angle de sa diagonale montante, en degrés — négatif, le
 * sens de rotation de SVG —, le corps du texte, tiré de la diagonale, et
 * l'épaisseur de son contour.
 */
export function filigraneDe(papier, orientation) {
  const { largeur, hauteur } = dimensionsPage(papier, orientation);
  return {
    largeur,
    hauteur,
    x: largeur / 2,
    y: hauteur / 2,
    angle: -(Math.atan2(hauteur, largeur) * 180) / Math.PI,
    corps: Math.hypot(largeur, hauteur) / DIVISEUR_CORPS_FILIGRANE,
    trait: TRAIT_FILIGRANE_MM,
  };
}

/**
 * La sortie que l'aperçu imprime : l'état des places de son tour
 * (etatPlaces) — le tour du plan, borné aux tours de la soirée, ou le
 * premier pour une vue de la soirée —, sa source et la proposition qu'elle
 * désigne, null hors de la source proposition, et le tour du pied.
 *
 * @param {Object} charge
 * @param {{tour: number|'tous'}} options   celles d'optionsApercu
 * @param {number|null} proposition   la proposition demandée au plan
 * @returns {{etat: Object, source: 'retenu'|'proposition'|'reservations', proposition: number|null,
 *            tour: number|'tous'}}
 */
export function sortieApercu(charge, { tour }, proposition) {
  const tourEtat = tour === 'tous' ? 1 : Math.min(tour, charge.evenement.tours);
  const etat = etatPlaces(charge, { tour: tourEtat, proposition });
  return {
    etat,
    source: etat.source,
    proposition: etat.source === 'proposition' ? etat.proposition : null,
    tour: tour === 'tous' ? 'tous' : tourEtat,
  };
}

/**
 * La découpe du plan d'un tour en pages (decouperPlan, § 11.7) : les
 * géométries des tables de l'état des places, à leur capacité, leur
 * englobant, et la bande mesurée sur la feuille gabarit.
 *
 * @param {Object} etat   EtatPlaces
 * @param {{papier: string, bandeMm: number, decoupe: string}} options
 */
export function decoupeDuPlan(etat, { papier, bandeMm, decoupe }) {
  const geometries = etat.tables.map((table) => geometrieTable(table, table.capacite));
  return decouperPlan(englobantImpression(geometries), { papier, bandeMm, mode: decoupe, geometries });
}
