// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La vue du plan côté interface (§ 7.1, § 7.2, § 8.5, § 13.3), sans DOM :
// ce que Plan.svelte décide de sa vue — à l'ouverture, après un changement
// de cadre, à la molette, aux boutons de zoom et sur « Voir sur le plan » —,
// composé des fonctions de src/geometrie/vue.js et du seuil des chaises de
// src/geometrie/designation.js. Le cadre est un paramètre, relu par
// l'appelant au moment du geste ; aucune fonction ne lit le DOM.
//
// Une vue ne se calcule que dans un cadre où kAjuste rend un nombre : un
// cadre dont la largeur ou la hauteur ne dépasse pas 2 × MARGE_AJUSTEMENT_PX,
// nul compris — un plan monté caché —, ne fixe aucune borne, et bornesZoom
// lèverait sur null. Chaque fonction fait ce contrôle avant de borner.
import { nomAffiche } from '../../application/personnes.js';
import { kSieges } from '../../geometrie/designation.js';
import { englobant, geometrieTable } from '../../geometrie/tables.js';
import { ajuster, borner, bornesZoom, facteurMolette, kAjuste, zoomerSous } from '../../geometrie/vue.js';

/** Facteur de zoom des boutons de zoom, appliqué autour du centre du cadre. */
export const FACTEUR_BOUTON = 1.25;

/**
 * Le Cadre du contrat depuis un DOMRect : gauche ← left, haut ← top,
 * largeur ← width, hauteur ← height. Plan.svelte, les gestes et les
 * épreuves n'en lisent pas d'autre.
 * @param {{left: number, top: number, width: number, height: number}} rect
 * @returns {{gauche: number, haut: number, largeur: number, hauteur: number}}
 */
export function cadreDepuisRect(rect) {
  return { gauche: rect.left, haut: rect.top, largeur: rect.width, hauteur: rect.height };
}

/**
 * Vue à l'ouverture : le cadrage mémorisé, son k ramené dans les bornes du
 * cadre (borner) ; sans cadrage, l'ajustement. Null dès que kAjuste vaut
 * null, cadrage mémorisé ou non. Le cadrage reçu n'est pas modifié.
 * @param {{k: number, tx: number, ty: number}|null} cadrage
 * @param {{minX: number, minY: number, maxX: number, maxY: number}|null} englobantPlan
 * @param {{gauche: number, haut: number, largeur: number, hauteur: number}} cadre
 * @returns {{k: number, tx: number, ty: number}|null}
 */
export function vueInitiale(cadrage, englobantPlan, cadre) {
  const k = kAjuste(englobantPlan, cadre);
  if (k === null) return null;
  if (cadrage === null) return ajuster(englobantPlan, cadre);
  return borner(cadrage, cadre, bornesZoom(k));
}

/**
 * Vue après un changement de cadre : k ajusté recalculé sur le nouveau
 * cadre, k ramené dans ses bornes, le point de dessin au centre du cadre y
 * restant. Quand kAjuste vaut null, la vue reçue elle-même, inchangée.
 * @returns {{k: number, tx: number, ty: number}}
 */
export function vueApresCadre(vue, englobantPlan, cadre) {
  const k = kAjuste(englobantPlan, cadre);
  if (k === null) return vue;
  return borner(vue, cadre, bornesZoom(k));
}

/**
 * Vue après un cran de molette : zoom sous le pointeur (clientX, clientY),
 * du facteur de facteurMolette(deltaY, deltaMode), aux bornes du cadre.
 * Null quand il n'y a rien à zoomer : vue null, ou cadre où kAjuste vaut null.
 * @param {{k: number, tx: number, ty: number}|null} vue
 * @param {{clientX: number, clientY: number, deltaY: number, deltaMode: number}} evenement
 * @returns {{k: number, tx: number, ty: number}|null}
 */
export function zoomerMolette(vue, englobantPlan, cadre, { clientX, clientY, deltaY, deltaMode }) {
  const k = vue === null ? null : kAjuste(englobantPlan, cadre);
  if (k === null) return null;
  return zoomerSous(vue, cadre, clientX, clientY, facteurMolette(deltaY, deltaMode), bornesZoom(k));
}

/**
 * Vue après « Zoom + » (sens 1) ou « Zoom moins » (sens -1) : zoom de FACTEUR_BOUTON,
 * ou de son inverse, autour du centre du cadre, aux bornes du cadre. Null
 * quand il n'y a rien à zoomer, comme zoomerMolette. RangeError pour un
 * autre sens.
 * @param {1|-1} sens
 * @returns {{k: number, tx: number, ty: number}|null}
 */
export function zoomerBouton(vue, englobantPlan, cadre, sens) {
  if (sens !== 1 && sens !== -1) throw new RangeError(`sens du zoom : 1 ou -1 attendu, reçu ${String(sens)}`);
  const k = vue === null ? null : kAjuste(englobantPlan, cadre);
  if (k === null) return null;
  const facteur = sens === 1 ? FACTEUR_BOUTON : 1 / FACTEUR_BOUTON;
  const x = cadre.gauche + cadre.largeur / 2;
  const y = cadre.haut + cadre.hauteur / 2;
  return zoomerSous(vue, cadre, x, y, facteur, bornesZoom(k));
}

/**
 * L'englobant des emprises des tables d'un état des places (EtatPlaces,
 * A5), chacune à sa capacité courante, comme le modèle de dessin les pose
 * (geometrieTable) ; null sans table. Il ne dépend ni du tour ni de k.
 * @returns {{minX: number, minY: number, maxX: number, maxY: number}|null}
 */
export function englobantDuTour(etat) {
  return englobant(etat.tables.map((table) => geometrieTable(table, table.capacite)));
}

/**
 * Les tours que le sélecteur offre : 1 à tours, croissants.
 * @param {number} tours  entier ≥ 1
 * @returns {number[]}
 */
export function toursOfferts(tours) {
  return Array.from({ length: tours }, (_, rang) => rang + 1);
}

/**
 * Le tour que montre le plan : le tour demandé, ramené au dernier quand le
 * nombre de tours a baissé depuis la demande — etatPlaces lève au-delà.
 * @param {number} tour  entier ≥ 1  @param {number} tours  entier ≥ 1
 * @returns {number}
 */
export function tourAffiche(tour, tours) {
  return Math.min(tour, tours);
}

// Vrai quand une chaise de l'état des places porte la personne id.
const assiseDans = (etat, id) => etat.tables.some((table) => table.chaises.some(({ occupant }) => occupant === id));

/**
 * Le tour où « Voir sur le plan » montre une personne (§ 7.1) : le tour
 * montré quand elle y a une chaise ; sinon le premier tour, de 1 à tours,
 * où elle en a une ; le tour montré encore quand elle n'en a à aucun tour
 * — la barre de vue dit alors l'absence ou la réserve, et ne qualifie pas
 * une exclue (evidenceDe). tourPourVoir ne lit que etatDuTour(r), l'état
 * des places du placement que le plan montre au tour r, et ne recalcule
 * aucun placement ; le tour montré se lit seul quand elle y est assise.
 *
 * @param {number} id
 * @param {number} tours   entier ≥ 1
 * @param {number} montre  le tour montré, tourAffiche, de 1 à tours
 * @param {(tour: number) => {tables: Array<{chaises: Array<{occupant: number|null}>}>}} etatDuTour
 * @returns {number}
 */
export function tourPourVoir(id, tours, montre, etatDuTour) {
  if (assiseDans(etatDuTour(montre), id)) return montre;
  for (let tour = 1; tour <= tours; tour += 1) {
    if (tour !== montre && assiseDans(etatDuTour(tour), id)) return tour;
  }
  return montre;
}

/**
 * La vue où « Voir sur le plan » montre une personne (§ 7.1, § 7.3) : le
 * centre de la chaise qu'elle occupe dans l'état des places du tour montré
 * au centre du cadre, au plus petit zoom où sa table dessine ses chaises
 * (kSieges), ou au k de la vue quand il est déjà plus grand ; k ramené
 * dans les bornes du cadre. Null quand elle n'a pas de chaise à ce tour —
 * réserve, absence, exclusion, personne que la charge n'a plus —, sans vue,
 * ou dans un cadre où kAjuste vaut null : la vue reste. La chaise se lit
 * sur la géométrie de sa table à sa capacité, celle que le modèle de
 * dessin pose ; aucun argument n'est modifié.
 *
 * @param {{k: number, tx: number, ty: number}|null} vue
 * @param {{tables: Object[]}} etat   EtatPlaces du tour montré
 * @param {number} id
 * @param {{minX: number, minY: number, maxX: number, maxY: number}|null} englobantPlan
 * @param {{gauche: number, haut: number, largeur: number, hauteur: number}} cadre
 * @returns {{k: number, tx: number, ty: number}|null}
 */
export function vuePourVoir(vue, etat, id, englobantPlan, cadre) {
  const kCadre = vue === null ? null : kAjuste(englobantPlan, cadre);
  if (kCadre === null) return null;
  for (const table of etat.tables) {
    const rang = table.chaises.findIndex(({ occupant }) => occupant === id);
    if (rang === -1) continue;
    const geometrie = geometrieTable(table, table.capacite);
    const { x, y } = geometrie.chaises[rang];
    const { kMin, kMax } = bornesZoom(kCadre);
    const k = Math.min(kMax, Math.max(kMin, vue.k, kSieges(geometrie)));
    return { k, tx: cadre.largeur / 2 - k * x, ty: cadre.hauteur / 2 - k * y };
  }
  return null;
}

/**
 * La fonction nomDe du modèle de dessin : l'identifiant d'un participant de
 * la charge vers son nom affiché (nomAffiche, F1).
 * @returns {(id: number) => string}
 */
export function nomDeCharge(charge) {
  const noms = new Map(charge.participants.map((participant) => [participant.id, nomAffiche(participant)]));
  return (id) => noms.get(id);
}

/**
 * La personne mise en évidence, que la barre de vue nomme : son identifiant,
 * son nom affiché par nomDe — null pour une personne que la charge n'a
 * plus —, absente, vrai quand l'état des places du tour montré la nomme
 * parmi ses absents (non exclue, absente à ce tour), et reserve, vrai quand
 * il la nomme dans sa réserve (présente à ce tour, sans chaise). Une
 * personne que la charge n'a plus, ou une exclue, n'est jamais dite absente
 * ni en réserve au tour.
 *
 * @param {number} id
 * @param {(id: number) => string|undefined} nomDe   nomDeCharge
 * @param {{absents: number[], reserve: number[]}} etat   EtatPlaces du tour montré
 * @returns {{id: number, nom: string|null, absente: boolean, reserve: boolean}}
 */
export function evidenceDe(id, nomDe, etat) {
  return { id, nom: nomDe(id) ?? null, absente: etat.absents.includes(id), reserve: etat.reserve.includes(id) };
}

/**
 * La fonction organisationDe de l'infobulle (detailConflits) : l'identifiant
 * d'un participant de la charge vers son organisation, la chaîne même que la
 * liste porte, ou null — sans organisation, ou pour un identifiant que la
 * charge n'a pas.
 * @returns {(id: number) => string|null}
 */
export function organisationDeCharge(charge) {
  const organisations = new Map(charge.participants.map(({ id, organisation }) => [id, organisation]));
  return (id) => organisations.get(id) ?? null;
}

/**
 * Ce que la barre de vue dit du placement que le plan montre (§ 2.1, étape
 * 11 ; § 5.8), lu sur l'état des places du tour : le placement retenu, les
 * seules réservations — ou un retenu qui ne se lit pas, sous lequel le plan
 * montre les réservations —, une proposition dont les gestes posent des
 * réservations (avant la retenue), ou une proposition en vue seule (après).
 * Quand une proposition est demandée (ui.proposition), la barre offre de ne
 * plus la montrer : revenir au retenu quand il existe, aux réservations
 * sinon ; une proposition demandée qu'un tour ne porte pas laisse le plan
 * sur sa source réelle, et la commande reste offerte.
 *
 * @param {{source: string, proposition: number|null, cible: string|null, refus: Object|null}} etat
 *        EtatPlaces du tour affiché
 * @param {number|null} demandee   la proposition demandée au plan
 * @param {boolean} retenu         la charge porte un placement retenu
 * @returns {{libelle: {cle: string, details: Object}, revenir: string|null}}
 *          revenir : la clé du libellé de la commande, null sans proposition demandée
 * @throws {TypeError} pour une source hors du contrat
 */
export function sourceMontree(etat, demandee, retenu) {
  const revenir = demandee === null ? null : retenu ? 'plan.source.revenirRetenu' : 'plan.source.revenirReservations';
  const avec = (cle, details = {}) => ({ libelle: { cle, details }, revenir });
  if (etat.source === 'retenu') return avec('plan.source.retenu');
  if (etat.source === 'proposition') {
    const cle = etat.cible === 'reservations' ? 'plan.source.propositionReservations' : 'plan.source.propositionVueSeule';
    return avec(cle, { proposition: etat.proposition });
  }
  if (etat.source === 'reservations') {
    return avec(etat.refus?.code === 'RETENU_FAUTIF' ? 'plan.source.retenuFautif' : 'plan.source.reservations');
  }
  throw new TypeError(`source de l’état des places hors du contrat : ${JSON.stringify(etat.source)}`);
}

// La position d'une bulle sur un axe : debut, le bord de départ voulu ;
// repli, le bord où finit la bulle passée de l'autre côté ; taille, sa
// longueur ; de et a, les bords de la zone. Le côté choisi est ensuite
// borné à [de, a - taille] : une ancre avant de — une table coupée par le
// bord du cadre — ramène la bulle sur de ; une bulle plus longue que la
// zone se cale sur de.
function placerSurAxe(debut, repli, taille, de, a) {
  const fin = Math.max(de, a - taille);
  const choisi = debut + taille <= a ? debut : repli - taille >= de ? repli - taille : fin;
  return Math.min(Math.max(choisi, de), fin);
}

/**
 * La position d'une bulle posée sur le plan — l'infobulle d'une table, le
 * refus posé sur une place — dans la zone qui la contient, en px du
 * conteneur : à son ancre quand elle y tient, à droite et dessous ; passée
 * à gauche, son bord droit sur xRepli, quand elle déborde à droite ;
 * au-dessus, son bord bas sur y, quand elle déborde dessous ; calée sur le
 * bord opposé de la zone quand aucun côté ne suffit, jamais avant le bord
 * gauche ni le bord haut : une ancre au-dessus ou à gauche de la zone ramène
 * la bulle sur ce bord. Une taille nulle — pas encore mesurée — tient
 * toujours : la bulle reste à son ancre quand celle-ci est dans la zone.
 * Aucun argument n'est modifié.
 *
 * @param {{x: number, y: number, xRepli?: number}} ancre  xRepli vaut x par défaut
 * @param {{largeur: number, hauteur: number}} taille
 * @param {{gauche: number, haut: number, largeur: number, hauteur: number}} zone
 * @returns {{x: number, y: number}}  le coin haut gauche de la bulle
 * @throws {TypeError} pour un nombre non fini
 */
export function placerBulle({ x, y, xRepli = x }, { largeur, hauteur }, zone) {
  const nombres = [x, y, xRepli, largeur, hauteur, zone.gauche, zone.haut, zone.largeur, zone.hauteur];
  if (!nombres.every(Number.isFinite)) throw new TypeError(`bulle : nombre non fini : ${JSON.stringify(nombres)}`);
  return {
    x: placerSurAxe(x, xRepli, largeur, zone.gauche, zone.gauche + zone.largeur),
    y: placerSurAxe(y, y, hauteur, zone.haut, zone.haut + zone.hauteur),
  };
}
