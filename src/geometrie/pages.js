// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La découpe du plan en pages (§ 11.7) : un navigateur ne fragmente pas un
// SVG, le plan imprimé pose donc un dessin par page, chacun sur sa tuile.
// decouperPlan rend l'échelle, l'orientation et les tuiles contiguës du plan
// entier, avec le cartouche de chacune et les tables qu'elle dessine ;
// decouperParColonnes, les mêmes pour chaque colonne de tables
// (colonnesDeTables), chacune sur ses propres pages. Fonctions pures : ni
// DOM, ni mesure ; la hauteur de la bande (pied, mentions, barre,
// cartouche), mesurée au rendu de l'aperçu, entre en paramètre.
import { constante } from './constantes.js';
import { PAPIERS } from './papiers.js';
import { blocNoms, englobantImpression } from './tables.js';
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
export function decouperPlan(englobant, options = {}) {
  const { papier, margeMm, bandeMm, seuil, mode, geometries, listes } = reglages(options);
  const plan = planDe(englobant);
  const retenu = meilleure(orientationsUtiles(papier, margeMm, bandeMm), (utile) => {
    const disposition = disposer(utile, plan, seuil, mode);
    return { dispositions: [disposition], echelle: disposition.echelle, lisible: disposition.lisible };
  });
  const [{ colonnes, rangees }] = retenu.dispositions;
  const pages = tuiles(
    [{ plan, colonnes, rangees, emprises: emprisesDe(geometries, listes) }],
    retenu.utile,
    retenu.echelle,
  );
  return { orientation: retenu.orientation, echelle: retenu.echelle, lisibleSurUnePage: retenu.lisible, colonnes, rangees, pages };
}

/**
 * Les colonnes de tables du plan (§ 11.7), de gauche à droite : chaque
 * table couvre, sur l'axe horizontal, l'étendue de son emprise — le carré
 * de demi-côté rayonEmprise — et, quand listes est donné, de son bloc de
 * noms (blocNoms). Deux tables dont les étendues se recouvrent, bords
 * exclus, sont de la même colonne, et la relation se ferme : une table à
 * cheval sur deux colonnes les réunit. Une colonne ne se coupe donc jamais
 * entre deux tables qu'un bloc de noms ou une emprise relie. Chaque colonne
 * rend les identifiants de ses tables dans l'ordre de geometries.
 *
 * @param {import('./tables.js').GeometrieTable[]} geometries
 * @param {null|{largeur: number, hauteurs: Map<number, number>}} [listes]
 * @returns {number[][]}   aucune colonne sans table
 */
export function colonnesDeTables(geometries, listes = null) {
  const etendues = geometries
    .map((geometrie, rang) => {
      const rectangles = rectanglesDe(geometrie, listes);
      return { rang, minX: Math.min(...rectangles.map(({ minX }) => minX)), maxX: Math.max(...rectangles.map(({ maxX }) => maxX)) };
    })
    .sort((a, b) => a.minX - b.minX || a.rang - b.rang);
  const colonnes = [];
  for (const { rang, minX, maxX } of etendues) {
    const courante = colonnes.at(-1);
    if (courante !== undefined && minX < courante.maxX) {
      courante.rangs.push(rang);
      courante.maxX = Math.max(courante.maxX, maxX);
    } else {
      colonnes.push({ rangs: [rang], maxX });
    }
  }
  return colonnes.map(({ rangs }) => rangs.sort((a, b) => a - b).map((rang) => geometries[rang].id));
}

/**
 * La découpe du plan en pages, une colonne de tables par page au moins
 * (§ 11.7) : chaque colonne de colonnesDeTables se découpe seule, sur
 * l'englobant d'impression de ses tables (englobantImpression), selon le
 * mode, comme decouperPlan découpe le plan entier — une page à son échelle,
 * ou la grille minimale au seuil de lisibilité. Ses pages ne dessinent que
 * ses tables : une table d'une autre colonne ne paraît sur aucune d'elles,
 * même quand la tuile s'étend jusqu'à elle.
 *
 * Toutes les pages partagent l'orientation et l'échelle : l'imprimante
 * reçoit une seule orientation, et une même échelle garde aux tables leur
 * taille d'une page à l'autre. L'échelle est la plus petite de celles des
 * colonnes, chacune prise seule : chaque colonne tient dans ses pages, et
 * l'échelle reste au seuil au moins, sauf en mode 'unePage'.
 * L'orientation est celle qui donne le moins de pages en tout ; à pages
 * égales, la plus grande échelle ; à échelle égale aussi, le paysage.
 *
 * Les pages se rangent colonne par colonne, de gauche à droite, et dans
 * chacune comme decouperPlan les range ; la grille de chaque colonne est
 * centrée sur ses tables. Le cartouche compte les colonnes de pages de
 * gauche à droite sur tout le plan, et les rangées dans chaque colonne de
 * tables ; une page voisine à gauche ou à droite, au bord d'une colonne de
 * tables, est la page de la même rangée dans la colonne voisine, null
 * quand celle-ci n'a pas cette rangée. lisibleSurUnePage dit que chaque
 * colonne se lit sur une page ; colonnes compte les colonnes de pages, et
 * rangees, le plus de rangées d'une colonne. Le plan vide rend la page de
 * decouperPlan.
 *
 * @param {import('./tables.js').GeometrieTable[]} geometries
 * @param {Object} options   celles de decouperPlan, geometries exceptées
 * @returns {ReturnType<typeof decouperPlan>}
 * @throws {RangeError} ce que decouperPlan refuse
 */
export function decouperParColonnes(geometries, options = {}) {
  const { papier, margeMm, bandeMm, seuil, mode, listes } = reglages({ ...options, geometries });
  const colonnesTables = colonnesDeTables(geometries, listes);
  if (colonnesTables.length === 0) return decouperPlan(null, { ...options, geometries });
  const groupes = colonnesTables.map((ids) => {
    const membres = geometries.filter(({ id }) => ids.includes(id));
    return { plan: planDe(englobantImpression(membres, { listes })), emprises: emprisesDe(membres, listes) };
  });
  const retenu = meilleure(orientationsUtiles(papier, margeMm, bandeMm), (utile) => {
    const dispositions = groupes.map(({ plan }) => disposer(utile, plan, seuil, mode));
    return {
      dispositions,
      echelle: Math.min(...dispositions.map(({ echelle }) => echelle)),
      lisible: dispositions.every(({ lisible }) => lisible),
    };
  });
  const pages = tuiles(
    groupes.map((groupe, rang) => ({ ...groupe, ...retenu.dispositions[rang] })),
    retenu.utile,
    retenu.echelle,
  );
  return {
    orientation: retenu.orientation,
    echelle: retenu.echelle,
    lisibleSurUnePage: retenu.lisible,
    colonnes: retenu.dispositions.reduce((somme, { colonnes }) => somme + colonnes, 0),
    rangees: Math.max(...retenu.dispositions.map(({ rangees }) => rangees)),
    pages,
  };
}

// Les options de decouperPlan, validées, aux défauts posés ; le seuil de
// lisibilité e* en mm de papier par cm de dessin.
function reglages({
  papier,
  margeMm = constante('MARGE_PAGE_MM'),
  bandeMm,
  corpsDessinCm = TAILLE_TEXTE_LISTE_CM,
  corpsMinMm = constante('CORPS_MIN_IMPRESSION_MM'),
  mode = 'auto',
  geometries = [],
  listes = null,
} = {}) {
  if (!Object.hasOwn(PAPIERS, papier)) throw new RangeError(`papier inconnu : ${String(papier)}`);
  if (!MODES.has(mode)) throw new RangeError(`mode de découpe inconnu : ${String(mode)}`);
  exigerNombre('marge', margeMm, 0, false);
  exigerNombre('bande', bandeMm, 0, false);
  exigerNombre('corps du dessin', corpsDessinCm, 0, true);
  exigerNombre('corps minimal', corpsMinMm, 0, true);
  return { papier, margeMm, bandeMm, seuil: corpsMinMm / corpsDessinCm, mode, geometries, listes };
}

// Les dimensions et le centre d'un englobant, en cm, nuls pour le plan vide
// (null) ; RangeError pour un englobant plat, inversé ou non fini.
function planDe(englobant) {
  if (englobant === null) return { largeur: 0, hauteur: 0, centreX: 0, centreY: 0 };
  const { minX, minY, maxX, maxY } = englobant;
  for (const [nom, valeur] of [['minX', minX], ['minY', minY], ['maxX', maxX], ['maxY', maxY]]) {
    exigerNombre(`englobant, ${nom}`, valeur, -Infinity, true);
  }
  if (!(maxX > minX && maxY > minY)) throw new RangeError('englobant plat ou inversé');
  return { largeur: maxX - minX, hauteur: maxY - minY, centreX: (minX + maxX) / 2, centreY: (minY + maxY) / 2 };
}

// Les orientations qui ont une surface utile, paysage d'abord : il garde la
// place à toute égalité. Une orientation sans surface utile — une bande plus
// haute que la page couchée — n'est pas candidate ; le portrait, plus haut,
// garde alors la sienne. RangeError quand aucune n'en a.
function orientationsUtiles(papier, margeMm, bandeMm) {
  const { largeur: petit, hauteur: grand } = PAPIERS[papier];
  const orientations = [
    { orientation: 'paysage', feuille: { largeur: grand, hauteur: petit } },
    { orientation: 'portrait', feuille: { largeur: petit, hauteur: grand } },
  ].map(({ orientation, feuille }) => ({
    orientation,
    utile: { largeur: feuille.largeur - 2 * margeMm, hauteur: feuille.hauteur - 2 * margeMm - bandeMm },
  }));
  const utiles = orientations.filter(({ utile }) => utile.largeur > 0 && utile.hauteur > 0);
  if (utiles.length === 0) {
    const surfaces = orientations.map(({ orientation, utile }) => `${orientation} ${utile.largeur} × ${utile.hauteur} mm`);
    throw new RangeError(`aucune orientation n'a de surface utile : ${surfaces.join(', ')}`);
  }
  return utiles;
}

// L'orientation retenue parmi les candidates : disposer(utile) rend ses
// dispositions — une par plan découpé —, leur échelle commune et leur
// lisibilité ; le moins de pages en tout, puis la plus grande échelle,
// puis la première candidate.
function meilleure(candidates, disposer) {
  const pagesDe = ({ dispositions }) => dispositions.reduce((somme, { colonnes, rangees }) => somme + colonnes * rangees, 0);
  return candidates
    .map(({ orientation, utile }) => ({ orientation, utile, ...disposer(utile) }))
    .reduce((meilleur, c) => {
      const pages = pagesDe(c);
      const pagesMeilleur = pagesDe(meilleur);
      return pages < pagesMeilleur || (pages === pagesMeilleur && c.echelle > meilleur.echelle) ? c : meilleur;
    });
}

// Les rectangles qu'une table dessine sur le papier : son emprise, puis,
// quand listes est donné, son bloc de noms.
function rectanglesDe(g, listes) {
  return [
    { minX: g.centre.x - g.rayonEmprise, minY: g.centre.y - g.rayonEmprise, maxX: g.centre.x + g.rayonEmprise, maxY: g.centre.y + g.rayonEmprise },
    ...(listes === null ? [] : [blocNoms(g, listes)]),
  ];
}

const emprisesDe = (geometries, listes) => geometries.map((g) => ({ id: g.id, rectangles: rectanglesDe(g, listes) }));

// Les pages des plans reçus, l'un après l'autre, à l'échelle commune :
// chaque plan, {plan, colonnes, rangees, emprises}, sur sa grille de
// colonnes × rangees tuiles centrée sur lui, ses pages par rangées de haut
// en bas, de gauche à droite dans chacune, et chaque page portant les
// tables de emprises qui coupent sa tuile. Les colonnes de pages se
// comptent sur tous les plans ; au bord d'un plan, la voisine à gauche ou
// à droite est la page de même rangée du plan voisin, quand il l'a.
function tuiles(plans, utile, echelle) {
  const total = plans.reduce((somme, { colonnes, rangees }) => somme + colonnes * rangees, 0);
  const premiers = [];
  const colonnesAvant = [];
  plans.reduce(
    (cumul, { colonnes, rangees }) => {
      premiers.push(cumul.rang);
      colonnesAvant.push(cumul.colonnes);
      return { rang: cumul.rang + colonnes * rangees, colonnes: cumul.colonnes + colonnes };
    },
    { rang: 0, colonnes: 0 },
  );
  // Le rang de la page de la colonne c et de la rangée r du plan p ; null
  // hors de sa grille ou hors des plans.
  const rangDe = (p, c, r) => {
    const voisin = plans[p];
    if (voisin === undefined || r >= voisin.rangees) return null;
    return premiers[p] + r * voisin.colonnes + c;
  };
  return plans.flatMap(({ plan, colonnes, rangees, emprises }, p) => {
    const enX = bords(colonnes, utile.largeur, echelle, plan.centreX, plan.largeur);
    const enY = bords(rangees, utile.hauteur, echelle, plan.centreY, plan.hauteur);
    return Array.from({ length: colonnes * rangees }, (_, indice) => {
      const c = indice % colonnes;
      const r = Math.floor(indice / colonnes);
      const rang = premiers[p] + indice;
      const tuile = { minX: enX.cotes[c], minY: enY.cotes[r], maxX: enX.cotes[c + 1], maxY: enY.cotes[r + 1] };
      return {
        rang,
        cadrage: { x: tuile.minX, y: tuile.minY, largeur: enX.tuile, hauteur: enY.tuile },
        cartouche: {
          page: rang + 1,
          total,
          colonne: lettreColonne(colonnesAvant[p] + c + 1),
          rangee: r + 1,
          voisins: {
            haut: r > 0 ? rang - colonnes : null,
            droite: c + 1 < colonnes ? rang + 1 : rangDe(p + 1, 0, r),
            bas: r + 1 < rangees ? rang + colonnes : null,
            gauche: c > 0 ? rang - 1 : p > 0 ? rangDe(p - 1, plans[p - 1].colonnes - 1, r) : null,
          },
        },
        tables: emprises.filter(({ rectangles }) => rectangles.some((rect) => coupe(rect, tuile))).map(({ id }) => id),
      };
    });
  });
}
