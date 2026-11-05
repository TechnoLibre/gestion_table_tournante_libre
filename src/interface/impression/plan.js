// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le plan imprimé (§ 7.7, § 11.7), sans DOM : les pages du plan d'un tour,
// chacune la tuile que la découpe (decouperPlan) lui donne, sous le pied
// d'un seul tour, avec son cartouche de repérage, la mention « disposition
// relative », l'échelle graphique de son échelle et, quand les listes sont
// montrées et que la page porte une table, la mention qui dit les listes
// hors d'échelle. Les blocs de noms entrent dans la découpe à la largeur du
// registre, LARGEUR_BLOC_NOMS_CM, celle de l'écran, et à la hauteur que leur
// donne la hauteur de ligne mesurée au rendu (HAUTEUR_LIGNE). Le module ne
// rend que des nombres et des données ; PlanImprime les pose. Un pied dont
// le nom d'événement ne s'imprime pas (refusApercu) se refuse avant toute
// découpe.
import { constante } from '../../geometrie/constantes.js';
import { echelleGraphique } from '../../geometrie/echelle.js';
import { decouperPlan } from '../../geometrie/pages.js';
import { englobantImpression } from '../../geometrie/tables.js';
import { refusApercu } from './modele.js';

/** Largeur maximale de la barre de l'échelle graphique imprimée, en mm de
 *  papier. */
export const LARGEUR_ECHELLE_MM = 40;

/** Le cartouche de la feuille gabarit : chaque renvoi présent, des numéros
 *  et une lettre de colonne plus larges que ceux d'un plan réel. La bande
 *  mesurée sur lui majore celle de toute page du plan. */
export const CARTOUCHE_GABARIT = Object.freeze({
  page: 888,
  total: 888,
  colonne: 'WW',
  rangee: 888,
  voisins: Object.freeze({ haut: 887, droite: 887, bas: 887, gauche: 887 }),
});

/** Les mentions de la feuille gabarit : toutes deux présentes. */
export const MENTIONS_GABARIT = Object.freeze({ relative: true, listes: true });

/** L'échelle graphique de la feuille gabarit : une barre de largeur
 *  LARGEUR_ECHELLE_MM ; sa hauteur ne dépend pas de sa longueur. */
export const ECHELLE_GABARIT = Object.freeze({ longueurCm: 50000, largeurMm: LARGEUR_ECHELLE_MM });

// Les renvois d'un cartouche, dans l'ordre de la lecture du plan : le sens,
// et la clé de son libellé.
const RENVOIS = Object.freeze([
  ['haut', 'impression.plan.renvoi.haut'],
  ['droite', 'impression.plan.renvoi.droite'],
  ['bas', 'impression.plan.renvoi.bas'],
  ['gauche', 'impression.plan.renvoi.gauche'],
]);

/**
 * La hauteur du bloc de noms de chaque table, en cm de dessin : une ligne
 * par siège, de 1 à la capacité, plus l'en-tête d'une table gelée, plus une
 * ligne. La ligne de base de la rangée i, comptée de 1, tombe i hauteurs de
 * ligne sous le haut du bloc (ordonneesLignes, plan/modele.js) ; la ligne
 * de plus majore le jambage de la dernière, plus court que la hauteur
 * d'encre du gabarit.
 *
 * @param {{tables: Array<{id: number, capacite: number, gelee: boolean}>}} etat   EtatPlaces
 * @param {number} hauteurLigne   cm, HAUTEUR_LIGNE mesurée au rendu
 * @returns {Map<number, number>}
 * @throws {RangeError} une hauteur de ligne non finie ou ≤ 0
 */
export function hauteursListes(etat, hauteurLigne) {
  if (typeof hauteurLigne !== 'number' || !Number.isFinite(hauteurLigne) || hauteurLigne <= 0) {
    throw new RangeError(`hauteur de ligne : nombre fini > 0 attendu, reçu ${String(hauteurLigne)}`);
  }
  return new Map(etat.tables.map(({ id, capacite, gelee }) => [id, (capacite + (gelee ? 1 : 0) + 1) * hauteurLigne]));
}

// Lève RangeError quand le pied n'est pas celui d'un seul tour : le plan
// s'imprime tour par tour, et son pied le nomme.
function exigerPiedDUnTour(pied) {
  const tour = pied?.elements?.find(({ element }) => element === 'tour');
  if (tour?.libelle?.cle !== 'impression.pied.tour') {
    throw new RangeError(`pied du plan : le tour imprimé attendu, reçu ${JSON.stringify(tour?.libelle ?? null)}`);
  }
}

// Lève le refus de refusApercu quand le nom que porte le pied ne s'imprime
// pas : la bande mesurée sous un tel pied ne laisse aucune zone de contenu,
// et la découpe lèverait RangeError sur elle.
function exigerNomImprimable(pied) {
  const { donnee } = pied.elements.find(({ element }) => element === 'nom');
  const refus = refusApercu({ nom: donnee });
  if (refus !== null) throw refus;
}

/**
 * Les pages du plan imprimé d'un tour (§ 11.7).
 *
 * La découpe est celle de decouperPlan, sur l'englobant d'impression des
 * géométries (englobantImpression) ; les listes montrées l'étendent de
 * leurs blocs, larges de LARGEUR_BLOC_NOMS_CM, hauts de hauteursListes. Une
 * page par tuile, dans l'ordre de la découpe :
 *  - rang, cartouche, tables : ceux de la tuile ;
 *  - orientation : celle de la découpe ;
 *  - viewBox : le cadrage de la tuile, en cm de dessin ;
 *  - taille : la tuile sur le papier, en mm, le cadrage à l'échelle ;
 *  - mentions : relative, toujours ; listes, quand les listes sont montrées
 *    et que la page porte une table ;
 *  - echelle : la longueur ronde dont la barre tient dans largeurEchelleMm
 *    à l'échelle de la découpe (echelleGraphique), et sa largeur en mm ;
 *  - pied : le pied reçu, le même sur chaque page.
 *
 * @param {Object} etat   EtatPlaces du tour imprimé
 * @param {import('../../geometrie/tables.js').GeometrieTable[]} geometries   celles des tables de etat
 * @param {'auto'|'unePage'|'decoupe'} decoupe
 * @param {{papier: string, bandeMm: number, listes?: boolean, hauteurLigne?: number|null,
 *          pied: {elements: Object[], filigrane: boolean}, largeurEchelleMm?: number}} options
 *        pied : la feuille de feuilleDe (modele.js), d'un seul tour
 * @returns {Array<{rang: number, orientation: 'portrait'|'paysage',
 *            viewBox: {x: number, y: number, largeur: number, hauteur: number},
 *            taille: {largeur: number, hauteur: number}, tables: number[],
 *            mentions: {relative: true, listes: boolean}, echelle: {longueurCm: number, largeurMm: number},
 *            cartouche: Object, pied: Object}>}
 * @throws {RangeError} un pied de la soirée ; des listes montrées sans hauteur de ligne ; ce que
 *         decouperPlan refuse
 * @throws {import('../../application/erreurs.js').ErreurCommande} NOM_EVENEMENT_TROP_LONG
 *         {longueur, maximum}, remède « Renommer » (refusApercu), avant la découpe
 */
export function pagesDuPlan(
  etat,
  geometries,
  decoupe,
  { papier, bandeMm, listes = false, hauteurLigne = null, pied, largeurEchelleMm = LARGEUR_ECHELLE_MM },
) {
  exigerPiedDUnTour(pied);
  exigerNomImprimable(pied);
  const blocs = listes ? { largeur: constante('LARGEUR_BLOC_NOMS_CM'), hauteurs: hauteursListes(etat, hauteurLigne) } : null;
  const resultat = decouperPlan(englobantImpression(geometries, { listes: blocs }), {
    papier,
    bandeMm,
    mode: decoupe,
    geometries,
    listes: blocs,
  });
  const { longueurCm, largeurPx } = echelleGraphique(resultat.echelle, largeurEchelleMm);
  return resultat.pages.map(({ rang, cadrage, cartouche, tables }) => ({
    rang,
    orientation: resultat.orientation,
    viewBox: { ...cadrage },
    taille: { largeur: cadrage.largeur * resultat.echelle, hauteur: cadrage.hauteur * resultat.echelle },
    tables,
    mentions: { relative: true, listes: listes && tables.length > 0 },
    echelle: { longueurCm, largeurMm: largeurPx },
    cartouche,
    pied,
  }));
}

/**
 * Les renvois d'un cartouche vers les pages voisines, dans l'ordre haut,
 * droite, bas, gauche : le sens, la clé de son libellé et le numéro de la
 * page, de 1 ; un bord du plan, sans voisine, n'en a pas.
 *
 * @param {{voisins: {haut: number|null, droite: number|null, bas: number|null, gauche: number|null}}} cartouche
 *        voisins : le rang de chaque page voisine, de 0
 * @returns {Array<{sens: string, cle: string, page: number}>}
 */
export function renvois({ voisins }) {
  return RENVOIS.filter(([sens]) => voisins[sens] !== null).map(([sens, cle]) => ({ sens, cle, page: voisins[sens] + 1 }));
}

/**
 * Le modèle de dessin d'une page : les tables du modèle que la page porte,
 * dans l'ordre du modèle — celui de la peinture —, le reste du modèle tel
 * quel. Une table hors de la tuile ne se dessine pas sur la page.
 *
 * @param {{tables: Array<{id: number}>}} modele   ModeleDessin
 * @param {{tables: number[]}} page
 */
export function modeleDeLaPage(modele, { tables }) {
  const portees = new Set(tables);
  return { ...modele, tables: modele.tables.filter(({ id }) => portees.has(id)) };
}
