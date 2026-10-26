// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La découpe du plan en pages (§ 11.7) : un navigateur ne fragmente pas un
// SVG, le plan imprimé pose donc un dessin par page, chacun sur sa tuile.
// decouperPlan rend l'échelle, l'orientation et les tuiles contiguës du plan
// entier, avec le cartouche de chacune et les tables qu'elle dessine.
// Fonction pure : ni DOM, ni mesure ; la hauteur de la bande (pied,
// mentions, barre, cartouche), mesurée au rendu de l'aperçu, entre en
// paramètre.
import { constante } from './constantes.js';
import { PAPIERS } from './papiers.js';
import { blocNoms } from './tables.js';
import { TAILLE_TEXTE_LISTE_CM } from './texte.js';

/** @typedef {'auto'|'unePage'|'decoupe'} ModeDecoupe */

const MODES = new Set(['auto', 'unePage', 'decoupe']);

// Les cotes des tuiles sont des multiples de 2⁻²⁰ cm, en valeur absolue
// sous 2³² cm : chacune s'écrit sur 52 bits de mantisse, et la somme d'une
// abscisse et d'une largeur se calcule sans arrondi. Le bord droit d'une
// tuile est ainsi, à l'égalité exacte, le bord gauche de la suivante.
const QUANTUM = 2 ** -20;
const BORNE_COTES = 2 ** 32;
const versLeBas = (v) => Math.floor(v / QUANTUM) * QUANTUM;
const versLeHaut = (v) => Math.ceil(v / QUANTUM) * QUANTUM;

// Lève RangeError quand la valeur n'est pas un nombre fini, ou qu'elle est
// sous le plancher (strictement quand strict est vrai).
function exigerNombre(nom, valeur, plancher, strict) {
  const valide =
    typeof valeur === 'number' && Number.isFinite(valeur) && (strict ? valeur > plancher : valeur >= plancher);
  if (!valide) {
    throw new RangeError(`${nom} : nombre fini ${strict ? '>' : '≥'} ${plancher} attendu, reçu ${String(valeur)}`);
  }
}

// La lettre de la colonne de rang n ≥ 1 : A à Z, puis AA, AB… (numération
// bijective en base 26).
function lettreColonne(n) {
  let lettres = '';
  for (let reste = n; reste > 0; reste = Math.floor((reste - 1) / 26)) {
    lettres = String.fromCharCode(65 + ((reste - 1) % 26)) + lettres;
  }
  return lettres;
}

// Vrai quand les deux rectangles ont un intérieur commun : un rectangle
// qui ne fait que toucher le bord d'une tuile ne la coupe pas.
const coupe = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;

// La disposition du plan dans une orientation : la grille, l'échelle, et si
// le plan se lit sur une page. Les dimensions du plan, W × H cm, sont nulles
// pour le plan vide, qui prend l'échelle du seuil.
function disposer(utile, plan, seuil, mode) {
  const { largeur: L, hauteur: Hu } = utile;
  if (plan.largeur === 0) return { colonnes: 1, rangees: 1, echelle: seuil, lisible: true };
  const unePage = Math.min(L / plan.largeur, Hu / plan.hauteur);
  const lisible = unePage >= seuil;
  if (mode === 'unePage' || (mode === 'auto' && lisible)) {
    return { colonnes: 1, rangees: 1, echelle: unePage, lisible };
  }
  const colonnes = Math.max(1, Math.ceil((plan.largeur * seuil) / L));
  const rangees = Math.max(1, Math.ceil((plan.hauteur * seuil) / Hu));
  const echelle = Math.min((colonnes * L) / plan.largeur, (rangees * Hu) / plan.hauteur);
  return { colonnes, rangees, echelle, lisible };
}

// Les bords des tuiles sur un axe : n + 1 cotes, de la tuile de longueur
// utile / echelle, arrondie par excès au quantum, et assez longue pour que n
// tuiles couvrent l'étendue avec un quantum de part et d'autre ; la grille
// est centrée sur l'étendue, son départ arrondi par défaut.
function bords(n, utileMm, echelle, centre, etendue) {
  const tuile = versLeHaut(Math.max(utileMm / echelle, (etendue + 2 * QUANTUM) / n));
  const depart = versLeBas(centre - (n * tuile) / 2);
  const cotes = Array.from({ length: n + 1 }, (_, i) => depart + i * tuile);
  if (!(Math.abs(cotes[0]) < BORNE_COTES && Math.abs(cotes[n]) < BORNE_COTES)) {
    throw new RangeError(`plan hors des cotes représentables : ${String(cotes[0])} à ${String(cotes[n])} cm`);
  }
  return { cotes, tuile };
}

/**
 * La découpe du plan en pages (§ 11.7).
 *
 * L'échelle e se compte en mm de papier par cm de dessin. Le texte des
 * listes, de corpsDessinCm cm dans le dessin, s'imprime à corpsDessinCm × e
 * mm : il se lit à partir du seuil e* = corpsMinMm / corpsDessinCm. La
 * surface utile d'une page est le papier, dans l'orientation, moins margeMm
 * sur chaque bord et moins la bande en hauteur : L × Hu mm.
 *
 * Le plan, W × H cm, tiendrait sur une page à e₁ = min(L/W, Hu/H) ;
 * lisibleSurUnePage dit e₁ ≥ e*. En mode 'unePage', ou en 'auto' quand le
 * plan se lit sur une page, une page à e₁. Sinon la grille minimale au seuil,
 * ⌈W·e* ÷ L⌉ colonnes × ⌈H·e* ÷ Hu⌉ rangées, à l'échelle la plus grande qu'elle
 * admet, min(nx·L/W, ny·Hu/H) ≥ e*. 'decoupe' rend cette grille même quand
 * le plan se lit sur une page : elle est alors d'une page.
 *
 * L'orientation est celle qui donne le moins de pages ; à pages égales, la
 * plus grande échelle ; à échelle égale aussi, le paysage. Une orientation
 * sans surface utile ne concourt pas : une bande plus haute que la page
 * couchée laisse le portrait seul.
 *
 * Les tuiles, toutes de même taille, se rangent par rangées de haut en bas,
 * de gauche à droite dans chaque rangée ; rang est l'indice dans pages,
 * cartouche.page le rang + 1. Elles sont contiguës, à l'égalité exacte, sans
 * recouvrement, et la grille est centrée sur le plan, qu'elle couvre. Une
 * tuile mesure la surface utile à l'échelle, arrondie par excès d'au plus
 * 3 × 2⁻²⁰ cm de dessin, moins d'un micromètre de papier.
 *
 * tables : les identifiants des tables dont l'emprise — le carré de
 * demi-côté rayonEmprise, plateau et chaises — ou, quand listes est donné,
 * le bloc de noms coupe la tuile, dans l'ordre de geometries. Le plan vide
 * (englobant null) rend une page sans table, centrée sur l'origine, à e*.
 *
 * @param {null|{minX: number, minY: number, maxX: number, maxY: number}} englobant
 *        cm ; celui d'englobantImpression, des mêmes géométries et listes
 * @param {Object} options
 * @param {import('./papiers.js').Papier} options.papier
 * @param {number} options.bandeMm   hauteur de la bande d'une page, mesurée à l'aperçu
 * @param {number} [options.margeMm]          défaut : MARGE_PAGE_MM
 * @param {number} [options.corpsDessinCm]    défaut : TAILLE_TEXTE_LISTE_CM
 * @param {number} [options.corpsMinMm]       défaut : CORPS_MIN_IMPRESSION_MM
 * @param {ModeDecoupe} [options.mode]        défaut : 'auto'
 * @param {import('./tables.js').GeometrieTable[]} [options.geometries]
 * @param {null|{largeur: number, hauteurs: Map<number, number>}} [options.listes]
 * @returns {{orientation: 'portrait'|'paysage', echelle: number, lisibleSurUnePage: boolean,
 *            colonnes: number, rangees: number,
 *            pages: Array<{rang: number, cadrage: {x: number, y: number, largeur: number, hauteur: number},
 *                          cartouche: {page: number, total: number, colonne: string, rangee: number,
 *                                      voisins: {haut: number|null, droite: number|null,
 *                                                bas: number|null, gauche: number|null}},
 *                          tables: number[]}>}}
 * @throws {RangeError} papier ou mode inconnu ; marge, bande ou corps hors de leur domaine ; aucune
 *         orientation avec une surface utile ; englobant plat, inversé ou non fini ; table sans
 *         hauteur de liste
 */
export function decouperPlan(
  englobant,
  {
    papier,
    margeMm = constante('MARGE_PAGE_MM'),
    bandeMm,
    corpsDessinCm = TAILLE_TEXTE_LISTE_CM,
    corpsMinMm = constante('CORPS_MIN_IMPRESSION_MM'),
    mode = 'auto',
    geometries = [],
    listes = null,
  } = {},
) {
  if (!Object.hasOwn(PAPIERS, papier)) throw new RangeError(`papier inconnu : ${String(papier)}`);
  if (!MODES.has(mode)) throw new RangeError(`mode de découpe inconnu : ${String(mode)}`);
  exigerNombre('marge', margeMm, 0, false);
  exigerNombre('bande', bandeMm, 0, false);
  exigerNombre('corps du dessin', corpsDessinCm, 0, true);
  exigerNombre('corps minimal', corpsMinMm, 0, true);
  let plan = { largeur: 0, hauteur: 0, centreX: 0, centreY: 0 };
  if (englobant !== null) {
    const { minX, minY, maxX, maxY } = englobant;
    for (const [nom, valeur] of [['minX', minX], ['minY', minY], ['maxX', maxX], ['maxY', maxY]]) {
      exigerNombre(`englobant, ${nom}`, valeur, -Infinity, true);
    }
    if (!(maxX > minX && maxY > minY)) throw new RangeError('englobant plat ou inversé');
    plan = { largeur: maxX - minX, hauteur: maxY - minY, centreX: (minX + maxX) / 2, centreY: (minY + maxY) / 2 };
  }
  const seuil = corpsMinMm / corpsDessinCm;
  const { largeur: petit, hauteur: grand } = PAPIERS[papier];

  // Paysage d'abord : il garde la place à toute égalité. Une orientation
  // sans surface utile — une bande plus haute que la page couchée — n'est
  // pas candidate ; le portrait, plus haut, garde alors la sienne.
  const orientations = [
    { orientation: 'paysage', feuille: { largeur: grand, hauteur: petit } },
    { orientation: 'portrait', feuille: { largeur: petit, hauteur: grand } },
  ].map(({ orientation, feuille }) => ({
    orientation,
    utile: { largeur: feuille.largeur - 2 * margeMm, hauteur: feuille.hauteur - 2 * margeMm - bandeMm },
  }));
  const candidats = orientations
    .filter(({ utile }) => utile.largeur > 0 && utile.hauteur > 0)
    .map(({ orientation, utile }) => ({ orientation, utile, ...disposer(utile, plan, seuil, mode) }));
  if (candidats.length === 0) {
    const surfaces = orientations.map(({ orientation, utile }) => `${orientation} ${utile.largeur} × ${utile.hauteur} mm`);
    throw new RangeError(`aucune orientation n'a de surface utile : ${surfaces.join(', ')}`);
  }
  const retenu = candidats.reduce((meilleur, c) => {
    const pages = c.colonnes * c.rangees;
    const pagesMeilleur = meilleur.colonnes * meilleur.rangees;
    return pages < pagesMeilleur || (pages === pagesMeilleur && c.echelle > meilleur.echelle) ? c : meilleur;
  });

  const { orientation, utile, colonnes, rangees, echelle, lisible } = retenu;
  const enX = bords(colonnes, utile.largeur, echelle, plan.centreX, plan.largeur);
  const enY = bords(rangees, utile.hauteur, echelle, plan.centreY, plan.hauteur);
  const emprises = geometries.map((g) => ({
    id: g.id,
    rectangles: [
      {
        minX: g.centre.x - g.rayonEmprise,
        minY: g.centre.y - g.rayonEmprise,
        maxX: g.centre.x + g.rayonEmprise,
        maxY: g.centre.y + g.rayonEmprise,
      },
      ...(listes === null ? [] : [blocNoms(g, listes)]),
    ],
  }));
  const total = colonnes * rangees;
  const pages = Array.from({ length: total }, (_, rang) => {
    const c = rang % colonnes;
    const r = Math.floor(rang / colonnes);
    const tuile = { minX: enX.cotes[c], minY: enY.cotes[r], maxX: enX.cotes[c + 1], maxY: enY.cotes[r + 1] };
    return {
      rang,
      cadrage: { x: tuile.minX, y: tuile.minY, largeur: enX.tuile, hauteur: enY.tuile },
      cartouche: {
        page: rang + 1,
        total,
        colonne: lettreColonne(c + 1),
        rangee: r + 1,
        voisins: {
          haut: r > 0 ? rang - colonnes : null,
          droite: c + 1 < colonnes ? rang + 1 : null,
          bas: r + 1 < rangees ? rang + colonnes : null,
          gauche: c > 0 ? rang - 1 : null,
        },
      },
      tables: emprises.filter(({ rectangles }) => rectangles.some((rect) => coupe(rect, tuile))).map(({ id }) => id),
    };
  });
  return { orientation, echelle, lisibleSurUnePage: lisible, colonnes, rangees, pages };
}
