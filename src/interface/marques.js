// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Registre des marques porteuses d'information et des textes (§ 14.5,
// § 7.5, § 7.6, § 7.7). Chaque entrée nomme le jeton qui la peint et chaque
// jeton sur lequel elle se peint ; verifierPalette (palette.js) mesure le
// seuil de chaque couple dans les deux thèmes, sous les trois dichromaties,
// et les épreuves de rendu atteignent la marque par data-marque, qui porte
// son nom.
//
// Les remplissages d'une chaise sont son fond, son remplissage plein et les
// deux couleurs de la hachure — des traits --couleur-hachure sur le fond de
// la chaise : une marque posée sur une chaise se mesure sur chacun.

const c = (nom) => `--couleur-${nom}`;

const REMPLISSAGES_CHAISE = ['chaise-fond', 'chaise-pleine', 'hachure'];

function entree(nom, jeton, fonds, seuil) {
  return Object.freeze({ nom, jeton: c(jeton), fonds: Object.freeze(fonds.map(c)), seuil });
}

const marque = (nom, jeton, fonds) => entree(nom, jeton, fonds, 3);
const texte = (nom, jeton, fonds) => entree(nom, jeton, fonds, 4.5);

/** Les marques porteuses d'information (§ 14.5) : { nom, jeton, fonds, seuil: 3 } — nom, la
 *  désignation data-marque ; jeton, celui qui la peint ; fonds, chaque jeton sur lequel elle
 *  se peint, chaque remplissage d'une chaise pour une marque qui passe sur une chaise. */
export const MARQUES = Object.freeze([
  // Sur la chaise (§ 7.6) : cadenas posés sur ses remplissages ; l'anneau
  // l'entoure, sur le sol et le bord du plateau qu'elle touche.
  marque('cadenasFerme', 'marque', REMPLISSAGES_CHAISE),
  marque('cadenasOuvert', 'marque', REMPLISSAGES_CHAISE),
  marque('anneau', 'marque', ['sol', 'table-fond', ...REMPLISSAGES_CHAISE]),
  marque('hachure', 'hachure', ['chaise-fond']),
  marque('remplissagePlein', 'chaise-pleine', ['sol', 'table-fond']),
  // Le conflit (§ 7.5) : contour épaissi sur le sol, trame sur le plateau,
  // pastille chiffrée près de la table.
  marque('contourConflit', 'conflit', ['sol', 'table-fond']),
  marque('trameConflit', 'conflit', ['table-fond']),
  marque('pastille', 'pastille-fond', ['sol', 'table-fond']),
  marque('poignee', 'poignee', ['sol']),
  marque('gel', 'gel', ['sol', 'table-fond']),
  // La désignation se pose sur la page, le sol, le plateau et une chaise
  // vide, pourvue ou à pourvoir : chacun de ses remplissages est un fond.
  marque('miseEnEvidence', 'mise-en-evidence', ['page-fond', 'sol', 'table-fond', ...REMPLISSAGES_CHAISE]),
  marque('selection', 'selection', ['page-fond', 'sol', 'table-fond', ...REMPLISSAGES_CHAISE]),
  // Le cadre de mode (§ 8.4) entoure le contenu de l'événement, sur la page.
  marque('cadreLecture', 'cadre-lecture', ['page-fond']),
  marque('cadreEcriture', 'cadre-ecriture', ['page-fond']),
  marque('cadreBloque', 'cadre-bloque', ['page-fond']),
  marque('focus', 'focus', ['page-fond', 'bandeau-fond', 'sol', 'table-fond', ...REMPLISSAGES_CHAISE]),
  // Le mobilier sur le sol : le trait de la table, celui de la chaise, qui
  // touche aussi le plateau.
  marque('contourTable', 'table-trait', ['sol']),
  marque('contourChaise', 'chaise-trait', ['sol', 'table-fond']),
  // L'échelle graphique (§ 7.7) vit dans la surface du plan, sur le sol ou la
  // page ; le fantôme d'un glissement passe sur le sol, les tables et les
  // chaises.
  marque('echelle', 'echelle', ['sol', 'page-fond']),
  marque('fantome', 'fantome', ['sol', 'table-fond', ...REMPLISSAGES_CHAISE]),
]);

/** Les textes et leurs fonds, même forme, seuil 4,5 : page, secondaire, bandeau, refus,
 *  avis, listes du plan sur le sol, pastille. */
export const TEXTES = Object.freeze([
  texte('page', 'page-texte', ['page-fond']),
  texte('secondaire', 'page-texte-secondaire', ['page-fond']),
  texte('bandeau', 'bandeau-texte', ['bandeau-fond']),
  texte('refus', 'refus', ['page-fond']),
  texte('avis', 'avis', ['page-fond']),
  texte('listes', 'liste-texte', ['sol']),
  texte('pastille', 'pastille-texte', ['pastille-fond']),
]);
