// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La géométrie d'une table (§ 7.1, § 7.7), en centimètres de dessin, l'axe y
// vers le bas : plateau tiré du nombre de places, chaises numérotées depuis le
// haut dans le sens horaire, emprise, poignée et origine du bloc de noms. Le
// dessin pose les chaises par geometrieTable et la désignation d'un siège
// (designation.js) lit les mêmes chaises : une seule implémentation, que le
// dessin et le dépôt partagent. Aucune table ne tourne : la géométrie ne
// porte aucun angle.

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
/** Distance entre l'emprise et le bloc de noms, en cm : le carré du focus
 *  que l'interface pose autour de l'emprise, ou d'une chaise, s'étend à
 *  26 cm d'elle, plus la moitié de son trait ; le bloc commence au-delà, et
 *  aucune marque ne couvre la liste. */
export const ECART_LISTE = 36;
/** Distance entre deux cases de la grille des tables créées, en cm. */
export const PAS_GRILLE = 300;

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

// Lève RangeError sur un nombre de places qui n'est pas un entier ≥ 1, ou un
// diamètre ou côté saisi qui n'est pas un nombre fini > 0 : la géométrie
// d'une table se calcule sans valeur de repli.
function exigerPlaces(places, saisi) {
  if (!Number.isInteger(places) || places < 1) {
    throw new RangeError(`nombre de places entier ≥ 1 attendu, reçu ${JSON.stringify(places)}`);
  }
  if (saisi !== null && !(Number.isFinite(saisi) && saisi > 0)) {
    throw new RangeError(`dimension saisie > 0 attendue, reçu ${JSON.stringify(saisi)}`);
  }
}

/**
 * Diamètre d'une table ronde (§ 7.7) : max(70, places × 60 / π), ou le
 * diamètre saisi, qui l'emporte.
 *
 * @param {number} places  entier ≥ 1
 * @param {{saisi?: number|null}} [options]
 * @returns {number} cm
 */
export function diametre(places, { saisi = null } = {}) {
  exigerPlaces(places, saisi);
  return saisi ?? Math.max(PLANCHER_DIAMETRE, (places * LARGEUR_PAR_PLACE) / Math.PI);
}

/**
 * Côté d'une table carrée : max(70, ⌈places / 4⌉ × 60) — le côté le plus
 * garni porte ⌈places / 4⌉ sièges —, ou le côté saisi, qui l'emporte.
 *
 * @param {number} places  entier ≥ 1
 * @param {{saisi?: number|null}} [options]
 * @returns {number} cm
 */
export function cote(places, { saisi = null } = {}) {
  exigerPlaces(places, saisi);
  return saisi ?? Math.max(PLANCHER_DIAMETRE, Math.ceil(places / 4) * LARGEUR_PAR_PLACE);
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
    poignee: { x: centre.x + decalage, y: centre.y + decalage },
    rayonEmprise,
    origineListe: { x: centre.x + rayonEmprise + ECART_LISTE, y: centre.y - demiTaille },
  };
}

/**
 * Rectangle englobant des emprises : pour chaque table, le carré de
 * demi-côté rayonEmprise centré sur elle, qui circonscrit le disque d'une
 * ronde et égale l'emprise d'une carrée.
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
  for (const { centre, rayonEmprise } of geometries) {
    minX = Math.min(minX, centre.x - rayonEmprise);
    minY = Math.min(minY, centre.y - rayonEmprise);
    maxX = Math.max(maxX, centre.x + rayonEmprise);
    maxY = Math.max(maxY, centre.y + rayonEmprise);
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Position d'une table créée : la première case libre, ligne par ligne, d'une
 * grille de PAS_GRILLE cm à ⌈√(T + 1)⌉ colonnes, T = centres.length, partant
 * de (0, 0) ; une case est prise quand un centre est à PAS_GRILLE / 2 ou
 * moins. centres : les positions de charge.tables, que l'appelant passe sans
 * construire de géométrie.
 *
 * La recherche s'arrête : un centre est à PAS_GRILLE / 2 ou moins d'au plus
 * deux cases, le plus petit disque qui contient trois cases ayant un rayon
 * d'au moins PAS_GRILLE / √2 ; l'une des 2T + 1 premières cases est donc
 * libre.
 *
 * @param {Array<{x: number, y: number}>} centres
 * @returns {{x: number, y: number}}
 */
export function caseLibre(centres) {
  const colonnes = Math.ceil(Math.sqrt(centres.length + 1));
  for (let rang = 0; ; rang += 1) {
    const candidate = { x: (rang % colonnes) * PAS_GRILLE, y: Math.floor(rang / colonnes) * PAS_GRILLE };
    const prise = centres.some(({ x, y }) => Math.hypot(x - candidate.x, y - candidate.y) <= PAS_GRILLE / 2);
    if (!prise) return candidate;
  }
}

/**
 * Nombre de places sous la poignée : placesInitiales + round(ecartRadial ×
 * 2π / 60), jamais sous 2. L'écart se compte depuis le début du geste
 * (§ 7.2) ; un demi-pas exact s'arrondit vers le haut (Math.round).
 *
 * @param {number} placesInitiales  les places au début du geste
 * @param {number} ecartRadial      cm, projeté sur l'axe de la poignée, positif en s'éloignant du centre
 * @returns {number} entier ≥ 2
 */
export function placesSousPoignee(placesInitiales, ecartRadial) {
  return Math.max(2, placesInitiales + Math.round(ecartRadial / RAYON_PAR_PLACE));
}
