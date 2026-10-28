// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La géométrie d'une table (§ 7.1, § 7.7), en centimètres de dessin, l'axe y
// vers le bas : plateau tiré du nombre de places, chaises numérotées depuis le
// haut dans le sens horaire, emprise, poignée et origine du bloc de noms. Le
// dessin pose les chaises par geometrieTable et la désignation d'un siège
// (designation.js) lit les mêmes chaises : une seule implémentation, que le
// dessin et le dépôt partagent. Aucune table ne tourne : la géométrie ne
// porte aucun angle. La grille où se posent les tables des démonstrations et
// celles que l'opérateur crée a un seul pas, ecartsGrille.
import { constante } from './constantes.js';
import { TAILLE_TEXTE_LISTE_CM } from './texte.js';

/**
 * @typedef {Object} GeometrieTable   en cm
 * @property {number} id
 * @property {number} numero
 * @property {'ronde'|'carree'} forme
 * @property {{x: number, y: number}} centre
 * @property {number} demiTaille      rayon du plateau (ronde) ou demi-côté (carrée)
 * @property {number} pas             distance entre deux sièges voisins, au bord du plateau
 * @property {Array<{siege: number, x: number, y: number, rayon: number}>} chaises   sièges 1 à places
 * @property {{x: number, y: number}} poignee   centre du disque de la poignée
 * @property {number} rayonCible      rayon du disque, centré sur une chaise, où un point désigne
 *                                    son siège en régime sièges : max(RAYON_CHAISE, pas / 2)
 * @property {number} rayonEmprise    demiTaille + 2 × RAYON_CHAISE : rayon du disque d'emprise
 *                                    (ronde) ou demi-côté du carré d'emprise (carrée)
 * @property {{x: number, y: number}} origineListe   coin haut gauche du bloc de noms
 */

/** Diamètre minimal d'une table ronde, côté minimal d'une carrée, en cm :
 *  réglage par défaut, non norme (§ 7.7). */
export const PLANCHER_DIAMETRE = 70;
/** Longueur de bord par convive, en cm (§ 7.7). */
export const LARGEUR_PAR_PLACE = 60;
/** Rayon d'une chaise, en cm. */
export const RAYON_CHAISE = 22;
/** Rayon du disque de la poignée, en cm. */
export const RAYON_POIGNEE = 15;
/** Distance entre l'emprise et le bord de la poignée, en cm. */
export const ECART_POIGNEE = 8;
/** Distance entre l'emprise et le bloc de noms, en cm. Le carré du focus
 *  que l'interface pose autour de l'emprise, ou d'une chaise, s'en écarte
 *  de ECART_FOCUS (src/interface/plan/modele.js), plus la moitié de son
 *  trait, en deçà de cette distance : le bloc commence au-delà, et aucune
 *  marque ne couvre la liste. C'est aussi le plus grand écart que le plan
 *  écarté exige entre deux blocs de noms l'un au-dessus de l'autre
 *  (ecarterRangees). */
export const ECART_LISTE = 36;
/** Écart minimal entre les centres de deux rangées de la grille des tables,
 *  en cm. */
export const ECART_RANGEES = 300;
/** Hauteur d'une ligne de liste que la géométrie suppose, en cm : 1,25
 *  corps, au-dessus de la hauteur d'encre du gabarit sur les polices
 *  courantes. Le dessin mesure la sienne au navigateur (HAUTEUR_LIGNE, du
 *  registre) ; un calcul pur qui juge où descend une liste lit celle-ci. */
export const HAUTEUR_LIGNE_SUPPOSEE = 1.25 * TAILLE_TEXTE_LISTE_CM;

// Accroissement du rayon d'une ronde pour une place de plus, au-dessus du
// plancher : le périmètre croît de LARGEUR_PAR_PLACE, le rayon de 60 / 2π.
const RAYON_PAR_PLACE = LARGEUR_PAR_PLACE / (2 * Math.PI);

// Les quatre côtés d'une carrée, dans l'ordre où ils reçoivent les places —
// haut, droit, bas, gauche — : le coin où commence le côté dans le sens
// horaire, en demi-côtés depuis le centre, la direction de parcours et la
// normale sortante.
const COTES = [
  { depart: { x: -1, y: -1 }, direction: { x: 1, y: 0 }, normale: { x: 0, y: -1 } },
  { depart: { x: 1, y: -1 }, direction: { x: 0, y: 1 }, normale: { x: 1, y: 0 } },
  { depart: { x: 1, y: 1 }, direction: { x: -1, y: 0 }, normale: { x: 0, y: 1 } },
  { depart: { x: -1, y: 1 }, direction: { x: 0, y: -1 }, normale: { x: -1, y: 0 } },
];

// Lève RangeError sur un nombre de places qui n'est pas un entier ≥ 1 : la
// géométrie d'une table se calcule sans valeur de repli.
function exigerPlaces(places) {
  if (!Number.isInteger(places) || places < 1) {
    throw new RangeError(`nombre de places entier ≥ 1 attendu, reçu ${JSON.stringify(places)}`);
  }
}

/**
 * Diamètre d'une table ronde (§ 7.7) : max(70, places × 60 / π). Le fichier
 * ne porte aucun diamètre saisi : la formule dessine toute table, et le pas
 * qu'en tire geometrieTable ne connaît qu'elle.
 *
 * @param {number} places  entier ≥ 1
 * @returns {number} cm
 */
export function diametre(places) {
  exigerPlaces(places);
  return Math.max(PLANCHER_DIAMETRE, (places * LARGEUR_PAR_PLACE) / Math.PI);
}

/**
 * Côté d'une table carrée : max(70, ⌈places / 4⌉ × 60) — le côté le plus
 * garni porte ⌈places / 4⌉ sièges.
 *
 * @param {number} places  entier ≥ 1
 * @returns {number} cm
 */
export function cote(places) {
  exigerPlaces(places);
  return Math.max(PLANCHER_DIAMETRE, Math.ceil(places / 4) * LARGEUR_PAR_PLACE);
}

// Chaises d'une ronde : sur le cercle de rayon demiTaille + RAYON_CHAISE,
// siège s à l'angle −π/2 + 2π(s − 1)/places, le siège 1 en haut et la
// numérotation dans le sens horaire à l'écran (y vers le bas).
function chaisesRonde(centre, demiTaille, places) {
  const rayon = demiTaille + RAYON_CHAISE;
  return Array.from({ length: places }, (_, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / places;
    return { siege: i + 1, x: centre.x + rayon * Math.cos(angle), y: centre.y + rayon * Math.sin(angle), rayon: RAYON_CHAISE };
  });
}

// Nombre de sièges de chaque côté d'une carrée, dans l'ordre de COTES :
// ⌊places / 4⌋ chacun, et une place en surplus à chacun des premiers côtés.
const siegesParCote = (places) => COTES.map((_, i) => Math.floor(places / 4) + (i < places % 4 ? 1 : 0));

// Chaises d'une carrée : sur chaque côté, n sièges espacés de côté / n, le
// premier à côté / 2n du coin de départ, leur centre à RAYON_CHAISE au-delà
// du bord ; le siège 1 est le premier du côté haut.
function chaisesCarree(centre, demiTaille, places) {
  const chaises = [];
  siegesParCote(places).forEach((nombre, i) => {
    const { depart, direction, normale } = COTES[i];
    for (let j = 0; j < nombre; j += 1) {
      const avance = ((j + 0.5) * 2 * demiTaille) / nombre;
      chaises.push({
        siege: chaises.length + 1,
        x: centre.x + depart.x * demiTaille + direction.x * avance + normale.x * RAYON_CHAISE,
        y: centre.y + depart.y * demiTaille + direction.y * avance + normale.y * RAYON_CHAISE,
        rayon: RAYON_CHAISE,
      });
    }
  });
  return chaises;
}

/**
 * Géométrie d'une table, en cm (contrat de données, GeometrieTable).
 *
 * Le pas d'une ronde est π × diamètre / places, calculé sous la forme
 * max(60, 70π / places) qui lui est égale : elle rend 60 exactement dès que
 * le périmètre borne la table, là où le produit rend 59,999… pour certains
 * nombres de places et ferait basculer le régime des cibles (designation.js)
 * sous le seuil. Le pas d'une carrée est son côté divisé par le nombre de
 * sièges du côté le plus garni.
 *
 * La cible d'un siège est un disque de rayon max(RAYON_CHAISE, pas / 2)
 * centré sur sa chaise : au zoom où le régime des cibles passe aux sièges,
 * k × pas ≥ 24 px (designation.js), elle mesure au moins 24 px à l'écran.
 * Deux chaises d'une même table sont à un pas au moins l'une de l'autre :
 * deux cibles se touchent au plus, sans se recouvrir.
 *
 * La poignée est un disque de rayon RAYON_POIGNEE sur la diagonale à +45°
 * (vers le bas à droite), son bord à ECART_POIGNEE de l'emprise : son centre
 * est à rayonEmprise + 23 cm du centre d'une ronde, à rayonEmprise × √2 + 23
 * cm de celui d'une carrée, au-delà du coin de son emprise.
 *
 * @param {{id: number, numero: number, forme: 'ronde'|'carree', position: {x: number, y: number}}} table
 *        l'enregistrement de charge.tables ; position est le centre
 * @param {number} places  la capacité courante, entier ≥ 1
 * @returns {GeometrieTable}
 * @throws {RangeError} pour une forme inconnue ou un nombre de places invalide
 */
export function geometrieTable(table, places) {
  const { id, numero, forme } = table;
  if (forme !== 'ronde' && forme !== 'carree') {
    throw new RangeError(`forme de table inconnue : ${JSON.stringify(forme)}`);
  }
  const centre = { x: table.position.x, y: table.position.y };
  const ronde = forme === 'ronde';
  const demiTaille = (ronde ? diametre(places) : cote(places)) / 2;
  const pas = ronde
    ? Math.max(LARGEUR_PAR_PLACE, (PLANCHER_DIAMETRE * Math.PI) / places)
    : (2 * demiTaille) / Math.ceil(places / 4);
  const chaises = ronde ? chaisesRonde(centre, demiTaille, places) : chaisesCarree(centre, demiTaille, places);
  const rayonEmprise = demiTaille + 2 * RAYON_CHAISE;
  const distancePoignee = (ronde ? rayonEmprise : rayonEmprise * Math.SQRT2) + ECART_POIGNEE + RAYON_POIGNEE;
  const decalage = distancePoignee / Math.SQRT2;
  return {
    id,
    numero,
    forme,
    centre,
    demiTaille,
    pas,
    chaises,
    rayonCible: Math.max(RAYON_CHAISE, pas / 2),
    poignee: { x: centre.x + decalage, y: centre.y + decalage },
    rayonEmprise,
    origineListe: { x: centre.x + rayonEmprise + ECART_LISTE, y: centre.y - demiTaille },
  };
}

/**
 * Rectangle englobant de ce que le dessin pose de chaque table et qui se
 * pointe : le carré de demi-côté rayonEmprise centré sur elle — il
 * circonscrit le disque d'une ronde et égale l'emprise d'une carrée —, le
 * carré circonscrit à la cible de chaque siège, qui déborde l'emprise de
 * pas / 2 − RAYON_CHAISE, et celui du disque de la poignée, posée au-delà du
 * coin d'une carrée. L'ajustement (vue.js) le fait tenir dans le cadre :
 * toute cible et toute poignée y restent visibles.
 *
 * @param {GeometrieTable[]} geometries
 * @returns {{minX: number, minY: number, maxX: number, maxY: number}|null}  null sans table
 */
export function englobant(geometries) {
  if (geometries.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const etendre = ({ x, y }, demi) => {
    minX = Math.min(minX, x - demi);
    minY = Math.min(minY, y - demi);
    maxX = Math.max(maxX, x + demi);
    maxY = Math.max(maxY, y + demi);
  };
  for (const { centre, rayonEmprise, chaises, rayonCible, poignee } of geometries) {
    etendre(centre, rayonEmprise);
    for (const chaise of chaises) etendre(chaise, rayonCible);
    etendre(poignee, RAYON_POIGNEE);
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Le rectangle du bloc de noms d'une table sur le plan imprimé, en cm : de
 * origineListe vers la droite et le bas, large de listes.largeur, haut de la
 * hauteur que listes.hauteurs porte pour la table. La seule mesure de ce
 * rectangle : englobantImpression l'ajoute à l'englobant, la découpe en
 * pages (pages.js) le confronte à chaque tuile. Lève RangeError quand la
 * largeur ou la hauteur n'est pas un nombre fini ≥ 0, ou quand la table n'a
 * pas de hauteur : un bloc absent ferait disparaître sa liste d'une page
 * sans rien dire.
 *
 * @param {GeometrieTable} geometrie
 * @param {{largeur: number, hauteurs: Map<number, number>}} listes  cm
 * @returns {{minX: number, minY: number, maxX: number, maxY: number}}
 */
export function blocNoms(geometrie, listes) {
  const { largeur, hauteurs } = listes;
  const hauteur = hauteurs.get(geometrie.id);
  for (const [nom, valeur] of [['largeur', largeur], [`hauteur de la table ${geometrie.id}`, hauteur]]) {
    if (typeof valeur !== 'number' || !Number.isFinite(valeur) || valeur < 0) {
      throw new RangeError(`liste : ${nom}, nombre fini ≥ 0 attendu, reçu ${String(valeur)}`);
    }
  }
  const { x, y } = geometrie.origineListe;
  return { minX: x, minY: y, maxX: x + largeur, maxY: y + hauteur };
}

/**
 * L'englobant du plan imprimé : sans listes, englobant(geometries) tel quel ;
 * avec, étendu du bloc de noms de chaque table (blocNoms). Les étiquettes ne
 * sont pas à l'échelle (§ 7.7) : un plan imprimé avec ses listes couvre plus
 * de papier que son mobilier, et la découpe en pages en tient compte.
 *
 * @param {GeometrieTable[]} geometries
 * @param {{listes?: null|{largeur: number, hauteurs: Map<number, number>}}} [options]
 *        listes : largeur des blocs et hauteur de chacun, par identifiant de table, en cm
 * @returns {{minX: number, minY: number, maxX: number, maxY: number}|null}  null sans table
 */
export function englobantImpression(geometries, { listes = null } = {}) {
  const dessin = englobant(geometries);
  if (dessin === null || listes === null) return dessin;
  let { minX, minY, maxX, maxY } = dessin;
  for (const geometrie of geometries) {
    const bloc = blocNoms(geometrie, listes);
    minX = Math.min(minX, bloc.minX);
    minY = Math.min(minY, bloc.minY);
    maxX = Math.max(maxX, bloc.maxX);
    maxY = Math.max(maxY, bloc.maxY);
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Les rangées du plan écarté (§ 7.4, § 11.7) : chaque ordonnée distincte des
 * centres des tables, croissante, avec le décalage vers le bas, en cm, que
 * le dessin donne aux tables qui y sont centrées. Deux blocs de noms
 * (blocNoms) qui se recouvrent en largeur, de deux tables d'ordonnées
 * différentes, finissent à l'écart exigé l'un de l'autre en hauteur ; deux
 * tables de même ordonnée ne se séparent pas. L'écart exigé est ECART_LISTE ;
 * avec listes.references, la hauteur de chaque bloc avant ce qui l'allonge,
 * c'est le plus petit d'ECART_LISTE et de l'écart des deux blocs de
 * référence : l'allongement ne rapproche jamais deux blocs, et des hauteurs
 * égales à leurs références ne déplacent aucune rangée.
 *
 * L'écart s'ajoute entre deux rangées consécutives, et tout ce qui est
 * dessous descend d'autant : le décalage croît en descendant, la première
 * rangée reste à sa place, et ni l'ordre des rangées, ni l'alignement d'une
 * rangée, ni les abscisses ne changent. Pour chaque paire de blocs trop
 * proches — la table du bas d'abord, de haut en bas, puis celle du haut, de
 * haut en bas, dans l'ordre reçu à ordonnée égale —, ce qui manque encore à
 * leur écart s'ajoute au plus grand intervalle entre deux rangées
 * consécutives qui les séparent, le plus haut à égalité : deux tables à
 * quelques centimètres de la même ordonnée restent alignées, l'écart passant
 * dans l'intervalle plus grand qui les sépare des rangées voisines. Un écart
 * ajouté ne réduit aucun autre : chaque paire tient, et une paire déjà assez
 * écartée n'ajoute rien. Quand aucune rangée ne descend, il n'y en a aucune :
 * le plan n'a rien à écarter.
 *
 * @param {GeometrieTable[]} geometries   les tables à leur position enregistrée
 * @param {{largeur: number, hauteurs: Map<number, number>, references?: Map<number, number>}} listes
 *        largeur et hauteurs : celles de blocNoms ; references : les hauteurs de référence, par table
 * @returns {Array<{y: number, decalage: number}>}   aucune sans table, ni sans décalage
 * @throws {RangeError} ce que blocNoms refuse, sur les hauteurs comme sur les références
 */
export function ecarterRangees(geometries, listes) {
  const { largeur, references = null } = listes;
  const ordonnees = [...new Set(geometries.map(({ centre }) => centre.y))].sort((a, b) => a - b);
  const rangs = new Map(ordonnees.map((y, rang) => [y, rang]));
  // ajouts[i] : l'écart ajouté entre les rangées i − 1 et i.
  const ajouts = ordonnees.map(() => 0);
  const intervalle = (rang) => ordonnees[rang] - ordonnees[rang - 1];
  const blocs = geometries
    .map((geometrie) => ({
      rang: rangs.get(geometrie.centre.y),
      bloc: blocNoms(geometrie, listes),
      reference: references === null ? null : blocNoms(geometrie, { largeur, hauteurs: references }),
    }))
    .sort((a, b) => a.rang - b.rang);
  for (const bas of blocs) {
    for (const haut of blocs) {
      if (haut.rang >= bas.rang) break;
      if (haut.bloc.minX >= bas.bloc.maxX || bas.bloc.minX >= haut.bloc.maxX) continue;
      const exige = haut.reference === null ? ECART_LISTE : Math.min(ECART_LISTE, bas.reference.minY - haut.reference.maxY);
      let manque = haut.bloc.maxY + exige - bas.bloc.minY;
      for (let rang = haut.rang + 1; rang <= bas.rang; rang += 1) manque -= ajouts[rang];
      if (manque <= 0) continue;
      let choisi = haut.rang + 1;
      for (let rang = choisi + 1; rang <= bas.rang; rang += 1) {
        if (intervalle(rang) > intervalle(choisi)) choisi = rang;
      }
      ajouts[choisi] += manque;
    }
  }
  if (ajouts.every((ajout) => ajout === 0)) return [];
  let decalage = 0;
  return ordonnees.map((y, rang) => {
    decalage += ajouts[rang];
    return { y, decalage };
  });
}

// Le rang de la première rangée dont l'ordonnée, lue par ordonnee, dépasse
// y ; rangees.length quand aucune ne la dépasse.
function rangSuivant(rangees, y, ordonnee) {
  const rang = rangees.findIndex((rangee) => ordonnee(rangee) > y);
  return rang === -1 ? rangees.length : rang;
}

// L'ordonnée d'une rangée sur le dessin écarté.
const ordonneeDessinee = ({ y, decalage }) => y + decalage;

/**
 * Le point du dessin écarté d'une position enregistrée (§ 7.4) : l'abscisse
 * telle quelle ; l'ordonnée descend du décalage de sa rangée quand une table
 * y est centrée, entre deux rangées du décalage interpolé linéairement entre
 * les leurs, au-dessus de la première de son décalage, au-dessous de la
 * dernière du sien. Sans rangée, le point est la position. L'ordonnée
 * dessinée croît sans saut, au moins aussi vite que l'enregistrée :
 * positionDepuisDessin l'inverse en tout point.
 *
 * @param {{x: number, y: number}} position   cm
 * @param {ReturnType<typeof ecarterRangees>} rangees
 * @returns {{x: number, y: number}}
 */
export function dessinDepuisPosition({ x, y }, rangees) {
  if (rangees.length === 0) return { x, y };
  const rang = rangSuivant(rangees, y, (rangee) => rangee.y);
  if (rang === 0) return { x, y: y + rangees[0].decalage };
  if (rang === rangees.length) return { x, y: y + rangees[rang - 1].decalage };
  const haut = rangees[rang - 1];
  const bas = rangees[rang];
  return { x, y: y + haut.decalage + ((y - haut.y) * (bas.decalage - haut.decalage)) / (bas.y - haut.y) };
}

/**
 * La position enregistrée d'un point du dessin écarté (§ 7.4), l'inverse
 * de dessinDepuisPosition : un point posé sur une rangée du dessin y ramène
 * à son ordonnée enregistrée exacte, un point entre deux rangées à la même
 * part de l'intervalle enregistré qui les sépare. Sans rangée, la position
 * est le point.
 *
 * @param {{x: number, y: number}} point   cm de dessin
 * @param {ReturnType<typeof ecarterRangees>} rangees
 * @returns {{x: number, y: number}}
 */
export function positionDepuisDessin({ x, y }, rangees) {
  if (rangees.length === 0) return { x, y };
  const rang = rangSuivant(rangees, y, ordonneeDessinee);
  if (rang === 0) return { x, y: y - rangees[0].decalage };
  if (rang === rangees.length) return { x, y: y - rangees[rang - 1].decalage };
  const haut = rangees[rang - 1];
  const bas = rangees[rang];
  return { x, y: haut.y + ((y - ordonneeDessinee(haut)) * (bas.y - haut.y)) / (ordonneeDessinee(bas) - ordonneeDessinee(haut)) };
}

/**
 * La géométrie d'une table à places places (geometrieTable), posée au point
 * du dessin écarté que les rangées donnent à sa position
 * (dessinDepuisPosition) ; sans rangée, à sa position même. Le modèle de
 * dessin et la vue du plan la lisent tous deux.
 *
 * @param {Parameters<typeof geometrieTable>[0]} table   position enregistrée
 * @param {number} places
 * @param {ReturnType<typeof ecarterRangees>} rangees
 * @returns {GeometrieTable}
 */
export function geometrieEcartee(table, places, rangees) {
  return geometrieTable({ ...table, position: dessinDepuisPosition(table.position, rangees) }, places);
}

/**
 * Le pas de la grille des tables, en cm entiers, pour la plus grande emprise
 * E des tables données, chacune de sa forme et de son nombre de places :
 * entre deux colonnes, ⌈2E + 2 × ECART_LISTE + LARGEUR_BLOC_NOMS_CM⌉ — le bloc
 * de noms d'une table, à ECART_LISTE de son emprise et large de
 * LARGEUR_BLOC_NOMS_CM, où toute ligne s'abrège, s'achève à ECART_LISTE de
 * l'emprise de la colonne suivante : aucune liste ne passe sur une autre
 * table de la grille, d'aucune rangée ; entre deux rangées,
 * max(ECART_RANGEES, ⌈2E + ECART_LISTE⌉) — deux emprises voisines restent à
 * ECART_LISTE l'une de l'autre, la marge du carré de focus.
 *
 * @param {Array<{forme: 'ronde'|'carree', places: number}>} tables  au moins une
 * @returns {{colonnes: number, rangees: number}}
 */
export function ecartsGrille(tables) {
  const emprise = Math.max(
    ...tables.map(({ forme, places }) => geometrieTable({ id: 0, numero: 0, forme, position: { x: 0, y: 0 } }, places).rayonEmprise),
  );
  return {
    colonnes: Math.ceil(2 * emprise + 2 * ECART_LISTE + constante('LARGEUR_BLOC_NOMS_CM')),
    rangees: Math.max(ECART_RANGEES, Math.ceil(2 * emprise + ECART_LISTE)),
  };
}

/**
 * Position d'une table créée : la première case libre, ligne par ligne, d'une
 * grille à ⌈√(T + 1)⌉ colonnes, T = tables.length, partant de (0, 0), au pas
 * d'ecartsGrille des tables posées et de la nouvelle — le pas des
 * démonstrations (scripts/engendrer_livrables.js). Une case est prise quand
 * une table posée est à moins d'un pas de son centre sur chacun des deux
 * axes, bornes exclues. Une table à un pas de colonne ou plus a son emprise
 * hors de la bande du bloc de noms de la table nouvelle, et la sienne
 * s'achève avant l'emprise nouvelle, à ECART_LISTE au moins, quelle que soit
 * la rangée : c'est le calcul d'ecartsGrille, fait sur la plus grande
 * emprise des deux. Une table à un pas de rangée ou plus a son emprise à
 * ECART_LISTE au moins de l'emprise nouvelle. Ainsi, à travers une colonne,
 * une table déplacée hors de la grille, ou une grille dont le pas a crû
 * depuis qu'elle a été posée, ne reçoit pas la liste de la table nouvelle et
 * ne lui porte pas la sienne. Le pas de rangée ne sépare que les emprises :
 * une liste plus haute que lui, celle d'une table de beaucoup de places,
 * descend sur une table posée hors de la grille dessous, dans la bande de
 * son bloc ; listeSurTable juge ce recouvrement.
 *
 * La recherche s'arrête : un intervalle ouvert de largeur 2 × pas contient
 * au plus deux multiples du pas, et une table prend donc au plus quatre
 * cases ; l'une des 4T + 1 premières cases est libre.
 *
 * @param {Array<{position: {x: number, y: number}, forme: 'ronde'|'carree', places: number}>} tables
 *        les tables posées, chacune à sa capacité courante
 * @param {{forme: 'ronde'|'carree', places: number}} nouvelle  la table à poser
 * @returns {{x: number, y: number}}
 */
export function caseLibre(tables, nouvelle) {
  const { colonnes: pasX, rangees: pasY } = ecartsGrille([...tables, nouvelle]);
  const colonnes = Math.ceil(Math.sqrt(tables.length + 1));
  for (let rang = 0; ; rang += 1) {
    const candidate = { x: (rang % colonnes) * pasX, y: Math.floor(rang / colonnes) * pasY };
    const prise = tables.some(
      ({ position: { x, y } }) => Math.abs(x - candidate.x) < pasX && Math.abs(y - candidate.y) < pasY,
    );
    if (!prise) return candidate;
  }
}

/**
 * Vrai quand le bloc de noms de la table geometrie, à places places, recoupe
 * l'emprise de la table autre, bords exclus : la bande du bloc, large de
 * LARGEUR_BLOC_NOMS_CM depuis origineListe, haute de places + 1 lignes de
 * HAUTEUR_LIGNE_SUPPOSEE — l'en-tête d'une table gelée compris —, contre le
 * carré de demi-côté rayonEmprise centré sur autre, qui circonscrit le
 * disque d'une ronde. La seule mesure de ce recouvrement : le mobilier en
 * tire LISTE_SUR_VOISINE.
 *
 * @param {GeometrieTable} geometrie  la table dont la liste se juge
 * @param {number} places             sa capacité courante
 * @param {GeometrieTable} autre
 * @returns {boolean}
 */
export function listeSurTable(geometrie, places, autre) {
  const gauche = geometrie.origineListe.x;
  const haut = geometrie.origineListe.y;
  const droite = gauche + constante('LARGEUR_BLOC_NOMS_CM');
  const bas = haut + (places + 1) * HAUTEUR_LIGNE_SUPPOSEE;
  const { centre, rayonEmprise: e } = autre;
  return centre.x + e > gauche && centre.x - e < droite && centre.y + e > haut && centre.y - e < bas;
}

/**
 * Nombre de places sous la poignée : placesInitiales + round(ecartRadial ×
 * 2π / 60), jamais sous 2. L'écart se compte depuis le début du geste
 * (§ 7.2) ; un demi-pas exact s'arrondit vers le haut (Math.round). Lève
 * RangeError sur des places initiales qui ne sont pas un entier ≥ 1, ou sur
 * un écart non fini : le résultat serait NaN, ou un nombre non entier.
 *
 * @param {number} placesInitiales  les places au début du geste
 * @param {number} ecartRadial      cm, projeté sur l'axe de la poignée, positif
 *        en s'éloignant du centre
 * @returns {number} entier ≥ 2
 */
export function placesSousPoignee(placesInitiales, ecartRadial) {
  exigerPlaces(placesInitiales);
  if (typeof ecartRadial !== 'number' || !Number.isFinite(ecartRadial)) {
    throw new RangeError(`écart radial : nombre fini attendu, reçu ${String(ecartRadial)}`);
  }
  return Math.max(2, placesInitiales + Math.round(ecartRadial / RAYON_PAR_PLACE));
}
