// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// L'épreuve des bandes, partagée par les épreuves de la géométrie des tables
// et du mobilier : une liste de noms passe-t-elle sur une autre table ? Le
// calcul est écrit ici à part de listeSurTable (src/geometrie/tables.js),
// qu'il éprouve : seule la hauteur de ligne supposée vient du module, une
// valeur et non un calcul.
import { constante } from '../src/geometrie/constantes.js';
import { HAUTEUR_LIGNE_SUPPOSEE, geometrieTable } from '../src/geometrie/tables.js';

export { HAUTEUR_LIGNE_SUPPOSEE };

/**
 * Les fautes « une liste passe sur une autre table » d'un ensemble de tables
 * posées : pour chaque paire ordonnée, la bande du bloc de noms de la
 * première — LARGEUR_BLOC_NOMS_CM de large depuis origineListe, places + 1
 * lignes de HAUTEUR_LIGNE_SUPPOSEE, en-tête d'une table gelée compris —
 * recoupe le carré d'emprise de la seconde, bords exclus.
 *
 * @param {Array<{id?: number, position: {x: number, y: number}, forme: 'ronde'|'carree', places: number}>} posees
 *        id, l'identifiant de la table ; son rang compté depuis 1 quand il manque
 * @param {{avec?: number|null}} [options]  avec : seules les paires où figure
 *        la table de cet identifiant sont examinées
 * @returns {{fautes: string[], paires: number}}  les fautes, et le nombre de
 *          paires examinées
 */
export function fautesBandes(posees, { avec = null } = {}) {
  const largeur = constante('LARGEUR_BLOC_NOMS_CM');
  const geometries = posees.map(({ id, position, forme, places }, rang) => ({
    g: geometrieTable({ id: id ?? rang + 1, numero: rang + 1, forme, position }, places),
    places,
  }));
  const fautes = [];
  let paires = 0;
  for (const { g, places } of geometries) {
    const bande = {
      gauche: g.origineListe.x,
      droite: g.origineListe.x + largeur,
      haut: g.origineListe.y,
      bas: g.origineListe.y + (places + 1) * HAUTEUR_LIGNE_SUPPOSEE,
    };
    for (const { g: autre } of geometries) {
      if (autre === g || (avec !== null && g.id !== avec && autre.id !== avec)) continue;
      paires += 1;
      const e = autre.rayonEmprise;
      const recoupe =
        autre.centre.x + e > bande.gauche &&
        autre.centre.x - e < bande.droite &&
        autre.centre.y + e > bande.haut &&
        autre.centre.y - e < bande.bas;
      if (recoupe) fautes.push(`bloc de la table ${g.id} (${g.centre.x}, ${g.centre.y}) sur la table ${autre.id} (${autre.centre.x}, ${autre.centre.y})`);
    }
  }
  return { fautes, paires };
}
