// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le modèle pur des composants de graphique de la page de qualité (§ 12.3,
// § 12.4, § 12.5, § 12.7) : les traits et leurs motifs, la disposition d'un
// escalier, de points de relevé, de barres et d'une grille, le pointage au
// plus proche de chaque forme, la ligne de l'infobulle et les cellules du
// jumeau. Les composants n'ont ni Math, ni tri, ni réduction (§ 12.9) : tout
// pixel qu'ils posent sort d'ici, et toute grandeur d'ici sort de la
// géométrie des graphiques (graphique.js). Aucune fonction ne lit le DOM :
// la largeur d'un texte vient d'une mesure injectée, mesurer(texte) → px,
// relevée sur la police rendue, et la hauteur d'une ligne de texte,
// hauteurTexte, aussi.
//
// Les valeurs reçues sont déjà rangées par le moteur, dans l'ordre où le
// détail les porte : rien n'est trié ni recompté ici, hors l'ordre vertical
// des libellés posés au bout des tracés, que espacerEtiquettes écarte.
//
// Un indice désigne une cible dans l'ordre reçu, à partir de 0 : le rang
// d'indice i est le rang i + 1 du profil ; une case de grille a l'indice
// ligne × colonnes + colonne. La ligne de l'infobulle d'une cible est la
// ligne de même indice des données que le composant reçoit.

import { constante } from '../../../geometrie/constantes.js';
import {
  barres,
  cheminEscalier,
  cheminPoints,
  colonnesJuxtaposees,
  domaineDe,
  echelleLineaire,
  echelleLog10,
  graduations,
  grille,
  niveau,
  pointLePlusProche,
  rangLePlusProche,
  regleOuEscalier,
  tronquer,
} from '../../../geometrie/graphique.js';
import { NIVEAUX_GRAPHIQUE } from '../../marques.js';

/** La largeur où un nom se tronque dans un intitulé de graphique, lue au
 *  registre des constantes mesurées (§ 14.1). */
export const LARGEUR_NOM_PX = constante('LARGEUR_TRONCATURE_NOM_PX');

/** L'espace entre un texte et ce qu'il nomme, en px. */
export const ESPACE_PX = 6;

/** Le demi-côté du signe d'un rang marqué, en px. */
export const SIGNE_PX = 4;

// Le plus grand nombre de graduations d'un axe de valeurs, puis de l'axe
// des rangs.
const GRADUATIONS_VALEURS = 5;
const GRADUATIONS_RANGS = 6;

// L'écart entre deux lignes de barres, et entre deux colonnes juxtaposées.
const ECART_LIGNES_PX = 4;
const ECART_COLONNES_PX = 24;

// Le rayon du point et le retrait de la pastille d'un intitulé de barres.
const POINT_PASTILLE_PX = 4;
const RETRAIT_PASTILLE_PX = 6;

/** L'écart entre un axe et la zone qu'il borde, en px : un tracé posé au
 *  bord de la zone — une valeur nulle, le premier rang, une barre qui part
 *  de zéro — ne touche pas l'axe, et chaque marque se lit sur le fond de la
 *  carte (§ 14.5). */
export const ECART_AXE_PX = 2;

/** L'écart entre deux segments empilés d'une même barre, pris sur le
 *  second, en px : deux remplissages ne se touchent pas. */
export const ECART_SEGMENTS_PX = 1;

/** Le retrait du remplissage d'une case dans sa bordure, en px : la bordure
 *  se lit sur le fond de la carte, et le niveau aussi. */
export const RETRAIT_CASE_PX = 2;

/** L'épaisseur du trait d'un segment tracé en contour, en px. */
export const TRAIT_CONTOUR_PX = 2;

/** La largeur minimale d'un segment tracé en contour, en px : ses deux
 *  traits et un vide de 2 px entre eux, qui le distingue d'un aplat. */
export const LARGEUR_MIN_CONTOUR_PX = 2 * TRAIT_CONTOUR_PX + 2;

const jeton = (nom) => `--couleur-graphique-${nom}`;
const trait = (marque, nom, motif) => Object.freeze({ marque, jeton: jeton(nom), motif });
const remplissage = (marque, nom, contour = false) => Object.freeze({ marque, jeton: jeton(nom), contour });

/** Les traits d'un graphique, par genre (D30, § 12.7) : { marque, jeton,
 *  motif } — la désignation data-marque du registre (marques.js), le jeton
 *  qui le peint, et son stroke-dasharray. Les deux séries en plein et en
 *  tirets ; un plafond en trait mixte, tiret-point, et la règle à 100 %,
 *  son image, du même ; une borne en pointillés. Quatre motifs, deux à deux
 *  distincts. */
export const TRAITS = Object.freeze({
  serie1: trait('graphiqueSerie1', 'serie-1', 'none'),
  serie2: trait('graphiqueSerie2', 'serie-2', '6 4'),
  plafond: trait('graphiqueRepere', 'repere', '8 3 2 3'),
  cent: trait('graphiqueRepere', 'repere', '8 3 2 3'),
  borne: trait('graphiqueBorne', 'borne', '2 3'),
});

/** Les remplissages d'un segment de barre, par genre : { marque, jeton,
 *  contour }. Le segment « prouvé inévitable » se trace en contour, un
 *  trait de TRAIT_CONTOUR_PX de son jeton, les autres en aplat : prouvé et
 *  reste se distinguent par la forme comme par la couleur (§ 12.4, B13). */
export const REMPLISSAGES = Object.freeze({
  serie1: remplissage('graphiqueSerie1', 'serie-1'),
  serie2: remplissage('graphiqueSerie2', 'serie-2'),
  prouve: remplissage('graphiqueProuve', 'prouve', true),
  reste: remplissage('graphiqueReste', 'reste'),
});

/** Les signes d'un rang marqué (§ 12.3), un par marque du profil : chacun
 *  sa forme, aucune couleur propre. */
export const SIGNES = Object.freeze(['ancre', 'partiel', 'reserve', 'plafondNul']);

/** Les genres d'une colonne de jumeau. */
export const GENRES_COLONNE = Object.freeze(['texte', 'nombre', 'pourcentage']);

const GENRES_SERIE = ['serie1', 'serie2'];
const GENRES_REPERE = ['plafond', 'borne', 'cent'];

function exiger(condition, message, Erreur = RangeError) {
  if (!condition) throw new Erreur(message);
}

const estTexte = (v) => typeof v === 'string';
const estFini = (v) => typeof v === 'number' && Number.isFinite(v);

// La largeur du plus long des textes, 0 sans texte.
const plusLarge = (textes, mesurer) => Math.max(0, ...textes.map((texte) => mesurer(texte)));

// Une trace reçue : son libellé, ses valeurs, une par rang.
function exigerTrace(trace, quoi) {
  exiger(trace !== null && typeof trace === 'object', `${quoi} : objet attendu`, TypeError);
  exiger(estTexte(trace.libelle), `${quoi} : libellé attendu`, TypeError);
  exiger(Array.isArray(trace.valeurs), `${quoi} : liste de valeurs attendue`, TypeError);
}

/**
 * Les traces d'un escalier ou de points : une ou deux séries, la première
 * en plein, la seconde en tirets, et zéro à deux repères, chacun plafond,
 * borne ou règle à 100 % (cent), de motifs distincts. Toutes ont autant de
 * valeurs, n. Lève RangeError sur un compte, un genre ou une longueur hors
 * contrat, ou deux repères du même motif — un plafond et une règle à
 * 100 % —, TypeError sur une trace qui n'a pas de libellé ou de valeurs.
 * @param {Array<{libelle: string, valeurs: Array<number|null>}>} series
 * @param {Array<{genre: string, libelle: string, valeurs: Array<number|null>}>} reperes
 * @returns {{n: number, traces: Array<{genre: string, libelle: string, valeurs: Array<number|null>}>}}
 */
export function exigerTraces(series, reperes = []) {
  exiger(Array.isArray(series) && series.length >= 1 && series.length <= 2, 'séries : une ou deux attendues');
  exiger(Array.isArray(reperes) && reperes.length <= 2, 'repères : deux au plus');
  series.forEach((s, i) => exigerTrace(s, `série ${i + 1}`));
  reperes.forEach((r, i) => {
    exigerTrace(r, `repère ${i + 1}`);
    exiger(GENRES_REPERE.includes(r.genre), `repère ${i + 1} : genre plafond, borne ou cent attendu, reçu ${r.genre}`);
  });
  if (reperes.length === 2) {
    exiger(TRAITS[reperes[0].genre].motif !== TRAITS[reperes[1].genre].motif, 'repères : chaque trait a son motif');
  }
  const n = series[0].valeurs.length;
  const traces = [
    ...series.map((s, i) => ({ genre: GENRES_SERIE[i], libelle: s.libelle, valeurs: s.valeurs })),
    ...reperes.map((r) => ({ genre: r.genre, libelle: r.libelle, valeurs: r.valeurs })),
  ];
  for (const t of traces) exiger(t.valeurs.length === n, `${t.libelle} : ${n} valeurs attendues, reçu ${t.valeurs.length}`);
  return { n, traces };
}

/**
 * Écarte des libellés posés à des ordonnées voulues : dans l'ordre de leurs
 * ordonnées — l'indice à égalité —, chacun à pas au moins sous le
 * précédent ; puis, du dernier au premier, chacun ramené sous max et à pas
 * au moins au-dessus du suivant ; enfin aucun au-dessus de min. Rend les
 * ordonnées dans l'ordre reçu.
 * @param {number[]} ys
 * @param {number} pas
 * @param {number} min
 * @param {number} max
 * @returns {number[]}
 */
export function espacerEtiquettes(ys, pas, min, max) {
  const ordre = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y || a.i - b.i);
  for (let k = 1; k < ordre.length; k += 1) ordre[k].y = Math.max(ordre[k].y, ordre[k - 1].y + pas);
  for (let k = ordre.length - 1; k >= 0; k -= 1) {
    const plafond = k === ordre.length - 1 ? max : ordre[k + 1].y - pas;
    ordre[k].y = Math.max(min, Math.min(ordre[k].y, plafond));
  }
  const rendu = new Array(ys.length);
  for (const { y, i } of ordre) rendu[i] = y;
  return rendu;
}

// La zone de tracé d'un graphique à axe vertical : à gauche, les
// graduations de l'axe ; à droite, les libellés des traces et le titre de
// l'abscisse ; en bas, les graduations de l'abscisse. Une largeur plus
// petite que les marges laisse une zone nulle.
function zoneDe({ largeur, hauteur, gauche, droite, hauteurTexte }) {
  const haut = hauteurTexte / 2;
  const bas = hauteurTexte + ESPACE_PX;
  return {
    x: gauche,
    y: haut,
    largeur: Math.max(0, largeur - gauche - droite),
    hauteur: Math.max(0, hauteur - haut - bas),
  };
}

// Les deux axes d'une zone, à ECART_AXE_PX d'elle : le vertical à gauche,
// l'horizontal en bas.
function axesDe(zone) {
  const gauche = zone.x - ECART_AXE_PX;
  const bas = zone.y + zone.hauteur + ECART_AXE_PX;
  return [
    { x1: gauche, y1: zone.y, x2: gauche, y2: bas },
    { x1: gauche, y1: bas, x2: zone.x + zone.largeur, y2: bas },
  ];
}

// L'axe des valeurs de traces : son domaine, de zéro à la plus grande
// valeur, et ses graduations entières, écrites.
function axeDesValeurs(traces, graduer) {
  const domaine = domaineDe(...traces.map((t) => t.valeurs));
  const valeursY = graduations(domaine[0], domaine[1], GRADUATIONS_VALEURS, { entieres: true });
  return { domaine, valeursY, textesY: valeursY.map((v) => graduer(v)) };
}

// Les marges qu'un graphique à axe vertical demande pour son seul texte :
// à gauche, la plus large graduation ; à droite, le plus long libellé de
// trace et le titre de l'abscisse.
function margesDe(traces, textesY, titreX, mesurer) {
  return {
    gauche: plusLarge(textesY, mesurer) + ESPACE_PX,
    droite: plusLarge([...traces.map((t) => t.libelle), ...(titreX ? [titreX] : [])], mesurer) + 2 * ESPACE_PX,
  };
}

/**
 * Les marges qu'un escalier ou des points de relevé demandent pour leur
 * texte, {gauche, droite} en px : elles ne dépendent que des traces, des
 * graduations et du titre de l'abscisse, jamais d'un graphique voisin.
 * Deux graphiques empilés, ou des petits multiples, s'alignent en recevant
 * chacun, par l'option aligner de leur disposition, margesCommunes des
 * marges de tous (§ 12.3 : les abscisses alignées).
 */
export function margesVerticales({ series, reperes = [], mesurer, graduer, titreX = null }) {
  const { traces } = exigerTraces(series, reperes);
  return margesDe(traces, axeDesValeurs(traces, graduer).textesY, titreX, mesurer);
}

/** Les plus grandes marges d'une liste, {gauche, droite} ; null ignoré,
 *  zéro sans marge. */
export function margesCommunes(liste) {
  const connues = liste.filter((m) => m !== null && m !== undefined);
  return {
    gauche: Math.max(0, ...connues.map((m) => m.gauche)),
    droite: Math.max(0, ...connues.map((m) => m.droite)),
  };
}

// Le cadre commun d'un escalier et de points de relevé : l'axe des valeurs,
// ses graduations entières, la zone, et les libellés des traces au bout de
// leur tracé — à la dernière valeur non nulle, au bas de la zone sans
// valeur —, écartés d'une ligne de texte au moins. aligner, null ou des
// marges communes, élargit les marges du texte propre jusqu'à elles.
function cadreVertical({ largeur, hauteur, traces, mesurer, hauteurTexte, graduer, titreX, aligner }) {
  const { domaine, valeursY, textesY } = axeDesValeurs(traces, graduer);
  const propres = margesDe(traces, textesY, titreX, mesurer);
  const { gauche, droite } = margesCommunes([propres, aligner]);
  const zone = zoneDe({ largeur, hauteur, gauche, droite, hauteurTexte });
  const ey = echelleLineaire({ domaine, plage: [zone.y + zone.hauteur, zone.y] });
  const graduationsY = valeursY.map((valeur, i) => ({ valeur, texte: textesY[i], y: ey.versPx(valeur) }));
  const bas = zone.y + zone.hauteur;
  const voulues = traces.map((t) => {
    const derniere = t.valeurs.findLast((v) => v !== null);
    return derniere === undefined ? bas : ey.versPx(derniere);
  });
  const ys = espacerEtiquettes(voulues, hauteurTexte, zone.y, bas);
  const xEtiquette = zone.x + zone.largeur + ESPACE_PX;
  const etiquettes = ys.map((y) => ({ x: xEtiquette, y }));
  const titre = titreX ? { texte: titreX, x: xEtiquette, y: bas + ESPACE_PX + hauteurTexte / 2 } : null;
  return { zone, ey, graduationsY, etiquettes, titreX: titre, axes: axesDe(zone) };
}

/** Le tracé d'un signe de forme centré sur (x, y), de SIGNE_PX de
 *  demi-côté : un triangle — plein pour un ancré, creux pour un placement
 *  partiellement fixé —, un carré creux pour une réserve, une croix pour un
 *  plafond réalisé nul. Le graphique et sa légende le tracent l'un et
 *  l'autre. */
export function cheminSigne(genre, x, y) {
  const s = SIGNE_PX;
  const n = (v) => String(Math.round(v * 100) / 100 + 0);
  const triangle = `M ${n(x)} ${n(y - s)} L ${n(x + s)} ${n(y + s)} L ${n(x - s)} ${n(y + s)} Z`;
  if (genre === 'ancre' || genre === 'partiel') return triangle;
  if (genre === 'reserve') return `M ${n(x - s)} ${n(y - s)} H ${n(x + s)} V ${n(y + s)} H ${n(x - s)} Z`;
  return `M ${n(x - s)} ${n(y - s)} L ${n(x + s)} ${n(y + s)} M ${n(x + s)} ${n(y - s)} L ${n(x - s)} ${n(y + s)}`;
}

/**
 * La légende d'un escalier ou de points (Graphique) : chaque trace sous son
 * libellé — les séries, puis les repères —, puis chaque signe que marques
 * porte, dans l'ordre de SIGNES. Elle ne lit que les données reçues, aucune
 * mesure ni disposition : un graphique qui attend son dessin la rend déjà.
 * Lève comme exigerTraces.
 * @returns {Array<{genre: string, libelle: string|null, signe: string|null}>}
 */
export function legendeTraces({ series, reperes = [], marques = null }) {
  const { traces } = exigerTraces(series, reperes);
  const presents = new Set(marques ?? []);
  return [
    ...traces.map((t) => ({ genre: t.genre, libelle: t.libelle, signe: null })),
    ...SIGNES.filter((s) => presents.has(s)).map((signe) => ({ genre: 'signe', libelle: null, signe })),
  ];
}

/**
 * La disposition d'un escalier par rang (§ 12.3) : une ou deux séries et
 * leurs repères sur un seul axe vertical, qui part de zéro, l'abscisse
 * linéaire des rangs. marques : null, ou une entrée par rang, null ou un
 * genre de SIGNES — le signe se pose au centre du rang, à la valeur de la
 * première série, au bas de la zone quand elle est nulle. graduer(v) écrit
 * une graduation de l'axe vertical, graduerX(rang) une graduation de
 * l'abscisse — un rang, jamais une valeur de l'axe vertical : un graphique
 * en pourcentages ne gradue pas ses rangs en pourcentages ; sans graduerX,
 * graduer écrit les deux. titreX, déjà traduit, nomme l'abscisse, ou
 * null. Les libellés des traces se posent au bout de leur
 * tracé, dans la marge droite mesurée. aligner : null, ou les marges
 * communes d'un groupe de graphiques (margesVerticales, margesCommunes).
 * Chaque graduation de l'abscisse, {valeur, texte, x}, porte son rang :
 * à zone nulle, toutes ont le même x, et la valeur reste propre à chacune.
 * @returns {{n, zone, ex, ey, axes, graduationsY, graduationsX, titreX,
 *   traces: Array<{genre, libelle, valeurs, d, etiquette: {x, y}}>,
 *   signes: Array<{indice, genre, x, y, d, plein}>, legende}}
 */
export function dispositionEscalier({
  largeur,
  hauteur,
  series,
  reperes = [],
  marques = null,
  mesurer,
  hauteurTexte,
  graduer,
  graduerX = graduer,
  titreX = null,
  aligner = null,
}) {
  const { n, traces } = exigerTraces(series, reperes);
  if (marques !== null) {
    exiger(Array.isArray(marques) && marques.length === n, `marques : ${n} entrées attendues`);
    for (const m of marques) exiger(m === null || SIGNES.includes(m), `marque inconnue : ${m}`);
  }
  const cadre = cadreVertical({ largeur, hauteur, traces, mesurer, hauteurTexte, graduer, titreX, aligner });
  const { zone, ey } = cadre;
  const ex = echelleLineaire({ domaine: [0, n], plage: [zone.x, zone.x + zone.largeur] });
  const bas = zone.y + zone.hauteur;
  const tracees = traces.map((t, i) => ({
    ...t,
    d: t.genre.startsWith('serie') ? cheminEscalier(t.valeurs, ex, ey) : regleOuEscalier(t.valeurs, ex, ey).d,
    etiquette: cadre.etiquettes[i],
  }));
  const signes = [];
  (marques ?? []).forEach((genre, indice) => {
    if (genre === null) return;
    const v = traces[0].valeurs[indice];
    const x = ex.versPx(indice + 0.5);
    const y = v === null ? bas : ey.versPx(v);
    signes.push({ indice, genre, x, y, d: cheminSigne(genre, x, y), plein: genre === 'ancre' });
  });
  const graduationsX =
    n === 0
      ? []
      : graduations(1, n, GRADUATIONS_RANGS, { entieres: true }).map((rang) => ({ valeur: rang, texte: graduerX(rang), x: ex.versPx(rang - 0.5) }));
  return { ...cadre, n, ex, traces: tracees, signes, graduationsX, legende: legendeTraces({ series, reperes, marques }) };
}

/** L'indice du rang sous l'abscisse x d'un escalier, au plus proche, borné
 *  aux rangs du tracé (§ 12.7). */
export function cibleRang(x, disposition) {
  return rangLePlusProche(x, disposition.ex, Math.max(1, disposition.n)) - 1;
}

/** Le point où s'ancre l'infobulle du rang d'indice donné : son centre, à
 *  la valeur de la première série, au bas de la zone quand elle est nulle. */
export function ancreRang(indice, disposition) {
  const v = disposition.traces[0].valeurs[indice];
  return {
    x: disposition.ex.versPx(indice + 0.5),
    y: v === null || v === undefined ? disposition.zone.y + disposition.zone.hauteur : disposition.ey.versPx(v),
  };
}

/**
 * La disposition de petits multiples en points de relevé (§ 12.14, D49) :
 * des points aux seuls points de relevé, reliés par un trait mince, sur
 * l'abscisse logarithmique des mouvements évalués, graduée à ces points.
 * abscisses : les mouvements de chaque point, entiers ≥ 1 strictement
 * croissants, autant que de valeurs. Deux graduations qui se chevauchent
 * gardent la plus à droite : le dernier point, la proposition elle-même,
 * reste écrit. graduerX écrit une graduation de l'abscisse ; chacune,
 * {valeur, texte, x}, porte ses mouvements.
 * @returns {{n, zone, ex, ey, axes, graduationsY, graduationsX, titreX,
 *   traces: Array<{genre, libelle, valeurs, d, etiquette, points: Array<{indice, mouvements, x, y: number|null}>}>,
 *   abscissesPx: number[], legende}}
 */
export function dispositionPoints({
  largeur,
  hauteur,
  abscisses,
  series,
  mesurer,
  hauteurTexte,
  graduer,
  graduerX,
  titreX = null,
  aligner = null,
}) {
  const { n, traces } = exigerTraces(series, []);
  exiger(Array.isArray(abscisses) && abscisses.length === n && n >= 1, `abscisses : ${n} mouvements attendus`);
  abscisses.forEach((m, i) => {
    exiger(Number.isInteger(m) && m >= 1, `abscisse ${i} : entier ≥ 1 attendu, reçu ${m}`);
    exiger(i === 0 || m > abscisses[i - 1], `abscisse ${i} : les mouvements croissent strictement`);
  });
  const cadre = cadreVertical({ largeur, hauteur, traces, mesurer, hauteurTexte, graduer, titreX, aligner });
  const { zone, ey } = cadre;
  const ex = echelleLog10({ domaine: [1, abscisses[n - 1]], plage: [zone.x, zone.x + zone.largeur] });
  const abscissesPx = abscisses.map((m) => ex.versPx(m));
  const tracees = traces.map((t, k) => ({
    ...t,
    d: cheminPoints(abscisses.map((x, i) => ({ x, y: t.valeurs[i] })), ex, ey),
    etiquette: cadre.etiquettes[k],
    points: abscisses.map((mouvements, indice) => ({
      indice,
      mouvements,
      x: abscissesPx[indice],
      y: t.valeurs[indice] === null ? null : ey.versPx(t.valeurs[indice]),
    })),
  }));
  // Du dernier point au premier : une graduation se garde quand sa moitié
  // et celle de la dernière gardée, plus un espace, tiennent entre elles.
  const gardees = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const texte = graduerX(abscisses[i]);
    const x = abscissesPx[i];
    const suivante = gardees[0];
    if (suivante === undefined || suivante.x - x >= (mesurer(texte) + mesurer(suivante.texte)) / 2 + ESPACE_PX) {
      gardees.unshift({ valeur: abscisses[i], texte, x });
    }
  }
  return { ...cadre, n, ex, traces: tracees, abscissesPx, graduationsX: gardees, legende: legendeTraces({ series }) };
}

/** L'indice du point de relevé le plus proche de l'abscisse x, sur
 *  l'abscisse commune des petits multiples (§ 12.7). */
export function ciblePoint(x, disposition) {
  return pointLePlusProche(x, disposition.abscissesPx);
}

/** Le point où s'ancre l'infobulle du point de relevé d'indice donné : le
 *  point de la première série, au bas de la zone quand il n'a pas de
 *  valeur. */
export function ancrePoint(indice, disposition) {
  const { y } = disposition.traces[0].points[indice];
  return { x: disposition.abscissesPx[indice], y: y === null ? disposition.zone.y + disposition.zone.hauteur : y };
}

/**
 * Le nom tel qu'il s'écrit dans maxPx (§ 12.6) : entier quand il tient ;
 * sinon le plus long préfixe, en points de code, suivi de la marque, qui
 * tient ; la marque seule quand aucun préfixe ne tient avec elle ; '' quand
 * elle ne tient pas. Un nom qui tient se mesure une fois ; un nom trop long,
 * une fois par préfixe. largeur est celle du texte rendu.
 * @param {string} nom
 * @param {number} maxPx
 * @param {(texte: string) => number} mesurer
 * @param {string} marque
 * @returns {{texte: string, largeur: number, tronque: boolean}}
 */
export function tronquerNom(nom, maxPx, mesurer, marque) {
  const entiere = mesurer(nom);
  if (entiere <= maxPx) return { texte: nom, largeur: entiere, tronque: false };
  const lettres = [...nom];
  const largeurs = lettres.map((_, k) => (k === lettres.length - 1 ? entiere : mesurer(lettres.slice(0, k + 1).join('') + marque)));
  const garde = tronquer(largeurs, maxPx);
  if (garde > 0) {
    const texte = lettres.slice(0, garde).join('') + marque;
    return { texte, largeur: largeurs[garde - 1], tronque: true };
  }
  const seule = mesurer(marque);
  return seule <= maxPx ? { texte: marque, largeur: seule, tronque: true } : { texte: '', largeur: 0, tronque: true };
}

// Les segments ou les colonnes de barres : un ou deux, chacun un libellé et
// un genre de remplissage connu, distinct de celui de l'autre — le genre
// est la clé de son libellé dans Barres, et deux genres égaux auraient le
// même remplissage.
function exigerSegments(liste, quoi) {
  exiger(Array.isArray(liste) && liste.length >= 1 && liste.length <= 2, `${quoi} : un ou deux attendus`);
  for (const s of liste) {
    exiger(s !== null && typeof s === 'object' && estTexte(s.libelle), `${quoi} : libellé attendu`, TypeError);
    exiger(Object.hasOwn(REMPLISSAGES, s.genre), `${quoi} : genre inconnu ${s.genre}`);
  }
  exiger(liste.length === 1 || liste[0].genre !== liste[1].genre, `${quoi} : deux genres distincts attendus, reçu ${liste[0].genre} deux fois`);
}

// L'identifiant d'une ligne de barres, clé de sa ligne dans Barres : un
// texte ou un nombre, qu'aucune autre ligne ne porte.
function exigerIdentifiants(lignes) {
  const vus = new Set();
  for (const [i, l] of lignes.entries()) {
    exiger(estTexte(l.id) || estFini(l.id), `ligne ${i + 1} : identifiant, un texte ou un nombre`, TypeError);
    exiger(!vus.has(l.id), `ligne ${i + 1} : identifiant ${l.id} déjà porté`);
    vus.add(l.id);
  }
}

/**
 * La hauteur, en px, de barres de n lignes (dispositionBarres) : l'en-tête
 * — le titre de chaque colonne juxtaposée, puis les graduations — et les
 * lignes, chacune d'une hauteur de texte et d'ESPACE_PX, écartées de
 * ECART_LIGNES_PX. Elle ne lit aucune largeur de texte : un graphique qui
 * attend son dessin la réserve, et son dessin ne change pas sa hauteur.
 */
export function hauteurBarres({ n, juxtaposees, hauteurTexte }) {
  const ligne = hauteurTexte + ESPACE_PX;
  return enTeteBarres(juxtaposees, hauteurTexte) + (n === 0 ? 0 : n * ligne + (n - 1) * ECART_LIGNES_PX);
}

// La hauteur de l'en-tête des barres : le titre de chaque colonne
// juxtaposée, puis les graduations.
const enTeteBarres = (juxtaposees, hauteurTexte) => (juxtaposees ? 2 : 1) * (hauteurTexte + ESPACE_PX);

/**
 * La légende de barres (Graphique) : chaque segment empilé sous son
 * libellé, rien pour des colonnes juxtaposées, que leurs titres nomment.
 * Elle ne lit que les données reçues : un graphique qui attend son dessin
 * la rend déjà.
 * @returns {Array<{genre: string, libelle: string, signe: null}>}
 */
export function legendeBarres({ segments = null, colonnes = null }) {
  return colonnes !== null ? [] : segments.map((s) => ({ genre: s.genre, libelle: s.libelle, signe: null }));
}

/**
 * La disposition de barres horizontales (§ 12.4, § 12.12, § 12.13) : une
 * ligne par entrée de lignes, {id, nom, appartenance?, valeurs}, dans
 * l'ordre reçu, chacune intitulée de son nom tronqué à LARGEUR_NOM_PX —
 * précédé d'une pastille quand appartenance est donnée, un rang de teinte
 * ou null pour la neutre —, le nom entier gardé pour l'infobulle et le
 * jumeau. Deux formes, exclusives : segments, un ou deux, empilés depuis
 * zéro sur un axe commun, valeurs[k] celle du segment k, le libellé de
 * chaque segment posé sur la première ligne où il est non nul ; ou
 * colonnes, deux, juxtaposées, chacune son axe, valeurs[k] celle de la
 * colonne k. Un segment nul ne se trace pas. marque : la marque de
 * troncature.
 *
 * secondaire, facultatif, un texte déjà écrit ou null : les autres chiffres
 * de la ligne (§ 12.4), ou « — » d'une ligne sans barre (B15). Il se pose
 * au milieu de la ligne, après la fin de sa barre — de la seconde colonne
 * quand elles sont juxtaposées —, ou après le dernier libellé de segment
 * posé sur elle ; la marge droite réserve la largeur mesurée du plus long.
 * Lève TypeError sur un secondaire qui n'est pas un texte ou sur un
 * identifiant qui n'est ni un texte ni un nombre, RangeError sur deux
 * lignes du même identifiant ou deux segments du même genre.
 * @returns {{lignes: Array<{id, nom, appartenance, indice, y, hauteur, fin,
 *   intitule: {texte, largeur, tronque, x, y}, pastille: {x, y, largeur, hauteur, rayon, point: {x, y}}|null,
 *   secondaire: {texte, x, y}|null,
 *   segments: Array<{genre, colonne, x, y, largeur, hauteur, marque, jeton}>}>,
 *   ex, colonnes, axes, graduations, etiquettesSegments, legende, hauteurTotale, haut}}
 */
export function dispositionBarres({ largeur, lignes, segments = null, colonnes = null, mesurer, hauteurTexte, graduer, marque }) {
  exiger((segments === null) !== (colonnes === null), 'barres : segments ou colonnes, l’un des deux');
  const juxtaposees = colonnes !== null;
  const parts = juxtaposees ? colonnes : segments;
  exigerSegments(parts, juxtaposees ? 'colonnes' : 'segments');
  exiger(!juxtaposees || colonnes.length === 2, 'colonnes : deux attendues');
  exiger(Array.isArray(lignes), 'lignes : liste attendue', TypeError);
  exigerIdentifiants(lignes);
  for (const l of lignes) {
    exiger(Array.isArray(l.valeurs) && l.valeurs.length === parts.length, `ligne ${l.id} : ${parts.length} valeurs attendues`);
    exiger(estTexte(l.nom), `ligne ${l.id} : nom attendu`, TypeError);
    exiger(l.secondaire === undefined || l.secondaire === null || estTexte(l.secondaire), `ligne ${l.id} : secondaire, un texte`, TypeError);
  }

  const hauteurLigne = hauteurTexte + ESPACE_PX;
  const intitules = lignes.map((l) => tronquerNom(l.nom, LARGEUR_NOM_PX, mesurer, marque));
  const avecPastille = lignes.some((l) => l.appartenance !== undefined);
  const retraitNom = avecPastille ? 2 * RETRAIT_PASTILLE_PX + 2 * POINT_PASTILLE_PX : 0;
  const largeurNoms = Math.max(0, ...intitules.map((i) => i.largeur)) + retraitNom + (avecPastille ? RETRAIT_PASTILLE_PX : 0);
  const x0 = largeurNoms + ESPACE_PX;
  const haut = enTeteBarres(juxtaposees, hauteurTexte);
  // À droite : les libellés des segments, au pire tous sur une même ligne,
  // puis le plus long texte secondaire.
  const etiquettes = juxtaposees ? [] : parts.map((s) => s.libelle);
  const secondaires = lignes.filter((l) => estTexte(l.secondaire)).map((l) => l.secondaire);
  const droite =
    etiquettes.reduce((somme, e) => somme + mesurer(e) + ESPACE_PX, ESPACE_PX) +
    (secondaires.length === 0 ? 0 : plusLarge(secondaires, mesurer) + ESPACE_PX);
  const trace = Math.max(0, largeur - x0 - droite);

  // Les axes : un seul, commun, pour des segments empilés ; un par colonne.
  const plages = juxtaposees ? colonnesJuxtaposees(trace, 2, ECART_COLONNES_PX) : [{ x: 0, largeur: trace }];
  const echelles = plages.map((plage, k) => {
    const valeurs = juxtaposees ? lignes.map((l) => l.valeurs[k]) : lignes.map((l) => l.valeurs.reduce((a, v) => a + v, 0));
    const domaine = domaineDe(valeurs);
    return echelleLineaire({ domaine, plage: [x0 + plage.x, x0 + plage.x + plage.largeur] });
  });
  const geometries = juxtaposees
    ? echelles.map((ex, k) => barres(lignes.map((l) => [l.valeurs[k]]), ex, hauteurLigne, ECART_LIGNES_PX))
    : [barres(lignes.map((l) => l.valeurs), echelles[0], hauteurLigne, ECART_LIGNES_PX)];

  const disposees = lignes.map((l, indice) => {
    const y = haut + geometries[0].lignes[indice].y;
    const traces = juxtaposees
      ? geometries.map((g, k) => ({ ...g.lignes[indice].segments[0], genre: parts[k].genre, colonne: k }))
      : geometries[0].lignes[indice].segments.map((s, k) => ({ ...s, genre: parts[k].genre, colonne: k }));
    // Empilé, un segment qui suit un segment non nul s'en écarte. Un
    // segment en contour garde au moins LARGEUR_MIN_CONTOUR_PX, et la
    // barre finit au plus loin à sa limite : la fin de sa valeur, ou, pour
    // une ligne plus étroite que le contour minimal de son premier segment à
    // sa valeur, son premier segment plus ce minimum. Ce que le contour
    // gagne au-delà de sa fin se prend sur les segments qui le suivent, dans
    // l'ordre, chacun jusqu'à zéro ; ce qui dépasse encore la limite, sur
    // ceux qui le précèdent, du plus proche au premier, chacun jusqu'à zéro
    // — un segment ramené à zéro cède aussi l'écart qui le suivait —, et le
    // contour recule d'autant. Seul le prouvé se trace en contour, et deux
    // segments n'ont jamais le même genre : ce qui précède le contour est en
    // aplat. Juxtaposé, chaque segment est seul sur son axe, et sa limite est
    // la sienne.
    const visibles = traces.filter((s) => l.valeurs[s.colonne] > 0);
    const limiteDe = (premier, dernier) => Math.max(dernier.x + dernier.largeur, premier.x + LARGEUR_MIN_CONTOUR_PX);
    const limiteEmpilee = visibles.length === 0 ? 0 : limiteDe(visibles[0], visibles.at(-1));
    let finPrecedente = null;
    const tracees = visibles.map((s) => {
      const ecart = !juxtaposees && s.colonne > 0 && l.valeurs[s.colonne - 1] > 0 ? ECART_SEGMENTS_PX : 0;
      const limite = juxtaposees ? limiteDe(s, s) : limiteEmpilee;
      const depart = juxtaposees || finPrecedente === null ? s.x : Math.max(s.x, finPrecedente);
      const x = Math.min(limite, depart + ecart);
      const propre = Math.max(0, s.x + s.largeur - x);
      const largeurTracee = REMPLISSAGES[s.genre].contour ? Math.max(propre, LARGEUR_MIN_CONTOUR_PX) : propre;
      finPrecedente = x + largeurTracee;
      return { ...s, x, largeur: largeurTracee, y, hauteur: hauteurLigne, ...REMPLISSAGES[s.genre] };
    });
    let depasse = juxtaposees || finPrecedente === null ? 0 : finPrecedente - limiteEmpilee;
    for (let i = tracees.length - 2; depasse > 0 && i >= 0; i -= 1) {
      const s = tracees[i];
      const ecartSuivant = tracees[i + 1].x - (s.x + s.largeur);
      const pris = Math.min(depasse, s.largeur);
      s.largeur -= pris;
      const recul = pris + (s.largeur === 0 ? Math.min(ecartSuivant, depasse - pris) : 0);
      for (let j = i + 1; j < tracees.length; j += 1) tracees[j].x -= recul;
      depasse -= recul;
    }
    const intitule = intitules[indice];
    const centre = y + hauteurLigne / 2;
    const pastille =
      l.appartenance === undefined
        ? null
        : {
            x: 0,
            y,
            largeur: intitule.largeur + retraitNom + RETRAIT_PASTILLE_PX,
            hauteur: hauteurLigne,
            rayon: hauteurLigne / 2,
            point: { x: RETRAIT_PASTILLE_PX + POINT_PASTILLE_PX, y: centre },
          };
    const derniere = traces.at(-1);
    return {
      id: l.id,
      nom: l.nom,
      appartenance: l.appartenance ?? null,
      indice,
      y,
      hauteur: hauteurLigne,
      fin: Math.max(derniere.x + derniere.largeur, ...tracees.map((s) => s.x + s.largeur)),
      intitule: { ...intitule, x: retraitNom, y: centre },
      pastille,
      segments: tracees,
      secondaire: null,
    };
  });

  // Le libellé d'un segment, à droite de la barre de la première ligne où
  // il est non nul ; deux libellés sur la même ligne, l'un après l'autre.
  const etiquettesSegments = [];
  if (!juxtaposees) {
    parts.forEach((s, k) => {
      const indice = lignes.findIndex((l) => l.valeurs[k] > 0);
      if (indice === -1) return;
      const ligne = disposees[indice];
      const voisine = etiquettesSegments.find((e) => e.indice === indice);
      const x = voisine === undefined ? ligne.fin + ESPACE_PX : voisine.x + mesurer(voisine.libelle) + ESPACE_PX;
      etiquettesSegments.push({ genre: s.genre, libelle: s.libelle, indice, x, y: ligne.y + ligne.hauteur / 2 });
    });
  }

  // Le texte secondaire de chaque ligne, après sa barre et les libellés de
  // segment posés sur elle.
  for (const ligne of disposees) {
    const texte = lignes[ligne.indice].secondaire;
    if (!estTexte(texte)) continue;
    const derniere = etiquettesSegments.findLast((e) => e.indice === ligne.indice);
    const x = derniere === undefined ? ligne.fin + ESPACE_PX : derniere.x + mesurer(derniere.libelle) + ESPACE_PX;
    ligne.secondaire = { texte, x, y: ligne.y + ligne.hauteur / 2 };
  }

  const corps = geometries[0].hauteurTotale;
  const colonnesDisposees = echelles.map((ex, k) => ({
    ex,
    x: ex.plage[0],
    largeur: ex.plage[1] - ex.plage[0],
    titre: juxtaposees ? { texte: parts[k].libelle, x: ex.plage[0], y: hauteurTexte / 2 } : null,
    graduations: graduations(0, ex.domaine[1], GRADUATIONS_VALEURS, { entieres: true }).map((valeur) => ({
      valeur,
      texte: graduer(valeur),
      x: ex.versPx(valeur),
      y: haut - ESPACE_PX - hauteurTexte / 2,
    })),
    axe: { x1: ex.plage[0] - ECART_AXE_PX, y1: haut - ESPACE_PX / 2, x2: ex.plage[0] - ECART_AXE_PX, y2: haut + corps },
  }));
  return {
    lignes: disposees,
    ex: echelles[0],
    colonnes: juxtaposees ? colonnesDisposees : [],
    axes: colonnesDisposees,
    etiquettesSegments,
    legende: legendeBarres({ segments, colonnes }),
    haut,
    hauteurTotale: hauteurBarres({ n: lignes.length, juxtaposees, hauteurTexte }),
  };
}

/** L'indice de la ligne de barres sous l'ordonnée y, bornée aux lignes ;
 *  null sans ligne (§ 12.7). */
export function cibleLigne(y, disposition) {
  const n = disposition.lignes.length;
  if (n === 0) return null;
  const pas = disposition.lignes[0].hauteur + ECART_LIGNES_PX;
  const indice = Math.floor((y - disposition.haut + ECART_LIGNES_PX / 2) / pas);
  return Math.min(n - 1, Math.max(0, indice));
}

/**
 * Le cadre d'une grille (dispositionGrille) : ce que ses seuls intitulés
 * décident, mesurés par mesurer. x0, la largeur des intitulés de ligne et
 * d'un espace ; cote et dessinable, la case que la largeur restante tient
 * (grille, graphique.js) ; tournes, vrai quand un intitulé de colonne
 * dépasse la case, et y0, la hauteur de l'en-tête : la hauteur d'un texte,
 * ou du plus long intitulé de colonne tourné, et un espace ; largeur et
 * hauteur, le dessin entier. Les comptes des cases n'y entrent pas : un
 * graphique qui attend son dessin réserve cette hauteur, et sait déjà s'il
 * cède la place.
 */
export function cadreGrille({ largeur, lignes, colonnes, mesurer, hauteurTexte, coteMax = Number.POSITIVE_INFINITY }) {
  exiger(Array.isArray(lignes) && Array.isArray(colonnes), 'grille : lignes et colonnes attendues', TypeError);
  const x0 = plusLarge(lignes.map((l) => l.libelle), mesurer) + ESPACE_PX;
  const g = grille(lignes.length, colonnes.length, Math.max(0, largeur - x0), hauteurTexte, coteMax);
  const tournes = colonnes.some((c) => mesurer(c.libelle) > g.cote);
  const y0 = (tournes ? plusLarge(colonnes.map((c) => c.libelle), mesurer) : hauteurTexte) + ESPACE_PX;
  return { x0, y0, cote: g.cote, dessinable: g.dessinable, tournes, largeur: x0 + g.largeur, hauteur: y0 + g.hauteur };
}

/**
 * La disposition d'une grille (§ 12.5, § 12.11, D33, D35) : lignes ×
 * colonnes de cases carrées, chacune {libelle}, valeurs les comptes en ordre
 * de lignes, null pour une case sans compte. Chaque case porte le niveau de
 * son compte (niveau), le jeton de ce niveau et l'encre qui le sert
 * (NIVEAUX_GRAPHIQUE) ; marque, la désignation de la marque d'un niveau au
 * moins 1 — le niveau 0 est un fond, sans marque —, null sinon. Une case
 * sans compte n'a ni niveau ni jeton, et texte null : le composant écrit
 * « — ». Sous diagonale, une case de même ligne et colonne est vide et
 * neutre. Une case porte sa bordure, bord, un trait d'un pixel au bord de
 * la case, et son remplissage, fond, en retrait de RETRAIT_CASE_PX dans
 * elle. bordures, le chemin de toutes les bordures, un sous-chemin fermé
 * par case dans l'ordre des cases, chacun le carré de son bord : un seul
 * <path> trace ce que traceraient autant de <rect>, sans un élément par
 * case. dessinable faux quand les cases ne tiennent pas dans la largeur
 * (grille, graphique.js) : la vue cède la place. Les intitulés de colonne
 * se tournent d'un quart de tour quand l'un d'eux dépasse la case. ecrire(v)
 * écrit un compte.
 */
export function dispositionGrille({
  largeur,
  lignes,
  colonnes,
  valeurs,
  diagonale = false,
  mesurer,
  hauteurTexte,
  ecrire,
  coteMax = Number.POSITIVE_INFINITY,
}) {
  exiger(Array.isArray(lignes) && Array.isArray(colonnes), 'grille : lignes et colonnes attendues', TypeError);
  const nl = lignes.length;
  const nc = colonnes.length;
  exiger(Array.isArray(valeurs) && valeurs.length === nl * nc, `grille : ${nl * nc} valeurs attendues`);
  const cadre = cadreGrille({ largeur, lignes, colonnes, mesurer, hauteurTexte, coteMax });
  const { x0, y0, tournes, cote } = cadre;
  const cases = valeurs.map((v, index) => {
    const ligne = Math.floor(index / nc);
    const colonne = index % nc;
    const surDiagonale = diagonale && ligne === colonne;
    const n = surDiagonale || v === null ? null : niveau(v);
    const entree = n === null ? null : NIVEAUX_GRAPHIQUE[n];
    const x = x0 + colonne * cote;
    const y = y0 + ligne * cote;
    return {
      index,
      ligne,
      colonne,
      x,
      y,
      cote,
      bord: { x: x + 0.5, y: y + 0.5, cote: Math.max(0, cote - 1) },
      fond: { x: x + RETRAIT_CASE_PX, y: y + RETRAIT_CASE_PX, cote: Math.max(0, cote - 2 * RETRAIT_CASE_PX) },
      diagonale: surDiagonale,
      niveau: n,
      jeton: entree?.jeton ?? null,
      encre: entree?.encre ?? null,
      marque: n !== null && n > 0 ? `graphiqueNiveau${n}` : null,
      texte: surDiagonale ? '' : v === null ? null : ecrire(v),
    };
  });
  return {
    dessinable: cadre.dessinable,
    cote,
    x0,
    y0,
    largeur: cadre.largeur,
    hauteur: cadre.hauteur,
    nl,
    nc,
    intitulesLignes: lignes.map((l, i) => ({ texte: l.libelle, x: x0 - ESPACE_PX, y: y0 + (i + 0.5) * cote })),
    intitulesColonnes: colonnes.map((c, j) => ({ texte: c.libelle, x: x0 + (j + 0.5) * cote, y: y0 - ESPACE_PX, tourne: tournes })),
    cases,
    bordures: cases.map(({ bord }) => `M${bord.x} ${bord.y}h${bord.cote}v${bord.cote}h${-bord.cote}z`).join(''),
  };
}

/** L'indice de la case sous le point (x, y) ; null hors de la grille et sur
 *  la diagonale, qui ne porte rien (§ 12.7). */
export function cibleCase(x, y, disposition) {
  const { x0, y0, cote, nl, nc } = disposition;
  if (cote === 0) return null;
  const colonne = Math.floor((x - x0) / cote);
  const ligne = Math.floor((y - y0) / cote);
  if (colonne < 0 || colonne >= nc || ligne < 0 || ligne >= nl) return null;
  const index = ligne * nc + colonne;
  return disposition.cases[index].diagonale ? null : index;
}

/**
 * Les colonnes d'un jumeau ou d'une infobulle : une liste non vide de
 * {cle, libelle, genre, decimales?}, libelle déjà traduit, genre de
 * GENRES_COLONNE, chaque clé une fois ; decimales, sur une colonne de
 * nombres seule, un entier de 0 à 20, 0 par défaut. Rend la liste reçue.
 * Lève TypeError sur une colonne sans clé ni libellé, RangeError sur une
 * liste vide, un genre inconnu, une clé répétée ou des décimales hors
 * contrat.
 */
export function exigerColonnes(colonnes) {
  exiger(Array.isArray(colonnes) && colonnes.length > 0, 'colonnes : liste non vide attendue');
  const vues = new Set();
  for (const c of colonnes) {
    exiger(c !== null && typeof c === 'object' && estTexte(c.cle) && estTexte(c.libelle), 'colonne : clé et libellé attendus', TypeError);
    exiger(GENRES_COLONNE.includes(c.genre), `colonne ${c.cle} : genre inconnu ${c.genre}`);
    exiger(
      c.decimales === undefined || (c.genre === 'nombre' && Number.isInteger(c.decimales) && c.decimales >= 0 && c.decimales <= 20),
      `colonne ${c.cle} : décimales, un entier de 0 à 20 sur une colonne de nombres`,
    );
    exiger(!vues.has(c.cle), `colonne ${c.cle} : clé répétée`);
    vues.add(c.cle);
  }
  return colonnes;
}

/** Le compte du pire, ou d'une ligne, qui suit un pourcentage (D34) : une
 *  chaîne non vide, rendue telle quelle ; TypeError sinon. */
export function exigerCompte(compte) {
  exiger(estTexte(compte) && compte !== '', 'pourcentage : le compte qui le suit est attendu', TypeError);
  return compte;
}

/**
 * La cellule d'une ligne sous une colonne : {genre, texte, compte}, texte
 * null quand la valeur manque. Texte : la valeur, un texte. Nombre : un
 * nombre fini, écrit par ecrire(valeur, {decimales}) aux décimales de la
 * colonne — l'écriture des nombres de la page, format.nombre, celle des
 * axes —, ou un texte déjà écrit, rendu tel quel ; compte null. Une cellule
 * de pourcentage reçoit {texte, compte} de la vue — le pourcentage déjà
 * écrit, ou null pour « — », et le compte de la ligne, qu'elle exige. Lève
 * TypeError sur une valeur d'une autre forme, ou sans ecrire.
 * @param {{cle: string, genre: string, decimales?: number}} colonne
 * @param {Object} ligne
 * @param {(valeur: number, options: {decimales: number}) => string} ecrire
 */
export function celluleDe(colonne, ligne, ecrire) {
  exiger(typeof ecrire === 'function', 'cellule : l’écriture des nombres est attendue', TypeError);
  const valeur = ligne[colonne.cle];
  if (colonne.genre === 'pourcentage') {
    exiger(valeur !== null && typeof valeur === 'object', `${colonne.cle} : {texte, compte} attendu`, TypeError);
    exiger(valeur.texte === null || estTexte(valeur.texte), `${colonne.cle} : texte attendu`, TypeError);
    return { genre: 'pourcentage', texte: valeur.texte, compte: exigerCompte(valeur.compte) };
  }
  if (valeur === null || valeur === undefined) return { genre: colonne.genre, texte: null, compte: null };
  if (colonne.genre === 'nombre' && estFini(valeur)) {
    return { genre: 'nombre', texte: ecrire(valeur, { decimales: colonne.decimales ?? 0 }), compte: null };
  }
  exiger(estTexte(valeur), `${colonne.cle} : ${colonne.genre === 'nombre' ? 'nombre fini ou texte' : 'texte'} attendu`, TypeError);
  return { genre: colonne.genre, texte: valeur, compte: null };
}

/** La ligne d'une infobulle : chaque cellule de la ligne, dans l'ordre des
 *  colonnes, sous leur clé et leur libellé (§ 12.7 : l'infobulle porte la
 *  ligne du jumeau) ; ecrire, celle de celluleDe. */
export function ligneInfobulle(colonnes, ligne, ecrire) {
  return exigerColonnes(colonnes).map((c) => ({ cle: c.cle, libelle: c.libelle, ...celluleDe(c, ligne, ecrire) }));
}
