// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les captures d'écran du parcours, côté page (§ 19.2 à § 19.5, § 19.7,
// § 19.11, § 14.5). photographier(m, fichier) contrôle l'écran du montage
// m, relève ce que le manifeste en garde, puis, selon le mode, compare
// l'entrée à celle du manifeste ou dépose image et entrée pour la
// publication. Les fichiers, le manifeste et la capture d'élément sont de
// node : les commandes de test/navigateur/commandes_documentation.js.
//
// Le mode vient de provide (vitest.config.js, GTT_CAPTURES) : 'verifier'
// par défaut, 'ecrire' sous make captures ; une option le remplace pour une
// épreuve du mécanisme, sur un dossier d'épreuve.
//
// Les relevés de contraste des textes et des marques vivent ici, une seule
// fois : l'épreuve transversale les lit sur chaque écran, photographier les
// range en styles du manifeste, par jeton et par rôle, dans les deux thèmes.
// Un relevé complet amène dans la fenêtre l'élément qu'il mesure ; le
// relevé de la fenêtre ne fait rien défiler et ne lit que ce que l'image
// montre. photographier rend après chaque thème, à chaque élément qui
// défile, sa position d'avant.
import { inject } from 'vitest';
import { commands } from 'vitest/browser';
import { TABLES_APPLICATION } from '../../src/application/libelles.js';
import { MARQUE_TEMOIN, creerTraduction } from '../../src/application/traduction.js';
import { constante } from '../../src/geometrie/constantes.js';
import JETONS_CSS from '../../src/interface/jetons.css?raw';
import { TABLES_INTERFACE } from '../../src/interface/libelles.js';
import { MARQUES, TEXTES } from '../../src/interface/marques.js';
import { serialiserCharge } from '../../src/stockage/canonique.js';
import { analyser } from '../../src/stockage/document.js';
import { SUFFIXES } from '../../src/stockage/noms.js';
import { VERSION } from '../../src/version.genere.js';
import { MODE_AFFICHAGE } from '../chromium.js';
import { CHAINE_TEMOIN, longueurTemoin } from '../temoin.js';
import { feuillePosee } from './feuilles.js';
import {
  attenuations,
  composantes,
  contraste,
  couleurTexte,
  couleursPeintes,
  designation,
  fondPeintSous,
  porteursDeTexte,
  sousTheme,
  visible,
} from './rendu.js';

/** Le cadre d'affichage des captures, en px CSS (§ 19.4). */
export const CADRE = Object.freeze({ largeur: 1366, hauteur: 700 });

// Seuils du § 14.5 : le texte, les marques porteuses d'information.
const SEUIL_TEXTE = 4.5;
const SEUIL_MARQUE = 3;

// --- Les aides des relevés ---------------------------------------------------------

// Une couleur en texte, pour un message ; l'égalité de deux couleurs ; un
// texte aplati, réduit à soixante caractères ; un élément rendu.
export const rgb = (c) => `rgb(${c.slice(0, 3).join(', ')}${c[3] === 1 ? '' : `, ${c[3]}`})`;
export const egales = (a, b) => a.join() === b.join();
export const extrait = (texte) => {
  const plat = texte.replace(/\s+/g, ' ').trim();
  return plat.length > 60 ? `${plat.slice(0, 57)}…` : plat;
};
export const rendu = (element) => element.checkVisibility({ visibilityProperty: true, opacityProperty: true });

// Les conteneurs désignés qui situent un élément dans son écran.
const REPERES = '[data-liste], [data-siege], [data-table], [data-pastille], [data-panneau], [data-menu], [data-section], [data-ecran], [data-bandeau]';

// Le nom d'un élément, suivi de celui du plus proche conteneur désigné qui
// le porte : un tspan se situe par sa liste, une pastille par sa table.
export function situer(element) {
  const repere = element.parentElement?.closest(REPERES) ?? null;
  return repere === null ? designation(element) : `${designation(element)} dans ${designation(repere)}`;
}


// --- Les contrastes des textes et les atténuations --------------------------------

// Vrai quand la boîte de l'élément coupe la fenêtre, bords exclus.
function coupeLaFenetre(element) {
  const b = element.getBoundingClientRect();
  return b.right > 0 && b.bottom > 0 && b.left < innerWidth && b.top < innerHeight;
}

/** Vrai quand la boîte de l'élément tient entière dans la fenêtre et dans
 *  chaque ancêtre qui rogne ce qui le déborde — overflow autre que visible,
 *  ou un <svg> —, à un demi-pixel près : l'image le montre entier. */
export function entiereDansLaFenetre(element) {
  const b = element.getBoundingClientRect();
  const dedans = (r) => b.left >= r.left - 0.5 && b.top >= r.top - 0.5 && b.right <= r.right + 0.5 && b.bottom <= r.bottom + 0.5;
  if (!dedans({ left: 0, top: 0, right: innerWidth, bottom: innerHeight })) return false;
  for (let ancetre = element.parentElement; ancetre !== null; ancetre = ancetre.parentElement) {
    const rogne = ancetre.localName === 'svg' || getComputedStyle(ancetre).overflow !== 'visible';
    if (rogne && !dedans(ancetre.getBoundingClientRect())) return false;
  }
  return true;
}

// Amène un élément dans la fenêtre, s'il en sort.
function amener(element) {
  const b = element.getBoundingClientRect();
  if (b.left < 0 || b.top < 0 || b.right > innerWidth || b.bottom > innerHeight) {
    element.scrollIntoView({ block: 'center', inline: 'nearest' });
  }
}

// Le <svg> le plus extérieur qui contient un élément SVG.
function svgExterieur(element) {
  let svg = element.ownerSVGElement ?? element;
  while (svg.ownerSVGElement !== null) svg = svg.ownerSVGElement;
  return svg;
}

// Feuille qui rend chaque élément atteignable le temps d'une lecture, comme
// celle de rendu.js : elementsFromPoint suit l'atteinte du pointeur.
const ATTEIGNABLE = '*, *::before, *::after { pointer-events: auto !important; }';

// Le point (x, y) de la fenêtre montre-t-il le dessin qui porte l'élément ?
// Dans la fenêtre, et le <svg> extérieur, ou l'un de ses descendants, parmi
// les éléments présents au point : un ancêtre qui défile rogne ce qui
// déborde de sa boîte, et le point rogné n'atteint plus le dessin.
function montreLeDessin(element, x, y) {
  if (!(x >= 0 && y >= 0 && x < innerWidth && y < innerHeight)) return false;
  const svg = svgExterieur(element);
  const feuille = document.createElement('style');
  feuille.textContent = ATTEIGNABLE;
  document.head.append(feuille);
  try {
    return document.elementsFromPoint(x, y).some((n) => svg.contains(n));
  } finally {
    feuille.remove();
  }
}

// Le centre de la boîte d'un élément SVG montre-t-il son dessin ?
function centreDansLeDessin(element) {
  const b = element.getBoundingClientRect();
  return montreLeDessin(element, b.left + b.width / 2, b.top + b.height / 2);
}

// Le plus faible contraste d'une couleur sur une liste de fonds.
const pire = (couleur, fonds) =>
  fonds.map((fond) => ({ fond, ratio: contraste(couleur, fond) })).reduce((a, b) => (b.ratio < a.ratio ? b : a));

// Les champs de saisie dont la valeur ou le texte indicatif se peint.
export const CHAMPS = 'input:not([type="radio"]):not([type="checkbox"]):not([type="file"]):not([type="hidden"]), select, textarea';

/**
 * Contrastes des textes rendus sous racine (§ 14.5) : chaque porteur de
 * texte et chaque champ de saisie, son texte indicatif compris, sur le fond
 * peint dessous ; un texte SVG par son fill sur la forme dessous. Un porteur
 * que l'œil ne voit pas — couvert, rogné, de boîte vide — n'est pas mesuré,
 * ni un texte SVG du registre des marques — le filigrane BROUILLON, un texte
 * au trait —, que releverMarques mesure à 3:1. Les textes du document
 * imprimé de l'aperçu ([data-impression]) se mesurent, mais n'entrent pas
 * dans couleurs : le papier est clair dans les deux thèmes (§ 11.7), et
 * leurs couleurs ne diffèrent pas d'un thème à l'autre.
 * → { fautes, attenuations, couleurs: Map(clé → couleurs), mesures, ratios },
 * ratios : { couleur, fond, ratio } de chaque texte mesuré, le fond le plus
 * défavorable, dans l'ordre des mesures. fenetre vrai : seuls les éléments
 * dont la boîte coupe la fenêtre se mesurent, sans rien amener — ce que
 * montre une capture d'écran.
 */
export function releverTextes(racine, { fenetre = false } = {}) {
  const fautes = [];
  const fautesAttenuation = [];
  const couleurs = new Map();
  const ratios = [];
  let mesures = 0;
  // cle null : un texte qui ne se compare pas d'un thème à l'autre.
  const mesurer = (cle, nom, couleurDe, fondDe, cible) => {
    let couleur;
    let fonds;
    try {
      couleur = couleurDe();
      fonds = fondDe();
    } catch (erreur) {
      fautes.push(`${nom} : ${erreur.message}`);
      return;
    }
    mesures += 1;
    if (fonds.length === 0) {
      fautes.push(`${nom} : aucun fond opaque dessous`);
      return;
    }
    try {
      const { fond, ratio } = pire(couleur, fonds);
      ratios.push({ couleur, fond, ratio });
      if (ratio < SEUIL_TEXTE) fautes.push(`${nom} : ${ratio.toFixed(2)}:1, ${rgb(couleur)} sur ${rgb(fond)}`);
    } catch (erreur) {
      fautes.push(`${nom} : ${erreur.message}`);
    }
    if (cle !== null) couleurs.set(cle, `${rgb(couleur)} sur ${fonds.map(rgb).join(' + ')}`);
    for (const a of attenuations(cible)) fautesAttenuation.push(`${nom} : ${designation(a)} ${a.propriete}: ${a.valeur}`);
  };
  for (const [rang, porteur] of porteursDeTexte(racine).entries()) {
    const { element } = porteur;
    if (fenetre && !coupeLaFenetre(element)) continue;
    if (!rendu(element)) continue;
    if (element instanceof SVGTextContentElement && element.hasAttribute('data-marque')) continue;
    const b = element.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) continue;
    if (!fenetre) amener(element);
    const svg = element instanceof SVGElement;
    if (!svg && visible(porteur) !== true) continue;
    // Un texte SVG se lit par la géométrie du dessin, non par l'atteinte
    // d'un point : son centre doit tomber dans le <svg> extérieur, qui rogne
    // ce qui le déborde, et dans la fenêtre.
    if (svg && !centreDansLeDessin(element)) continue;
    const texte = porteur.pseudo === null ? [...element.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('') : '';
    const nom = `${situer(element)}${porteur.pseudo ?? ''} « ${extrait(texte)} »`;
    const cle = element.closest('[data-impression]') === null ? `${rang}:${designation(porteur)}` : null;
    mesurer(cle, nom, () => couleurTexte(porteur), () => fondPeintSous(porteur), porteur);
  }
  for (const [rang, champ] of [...racine.querySelectorAll(CHAMPS)].entries()) {
    if (fenetre && !coupeLaFenetre(champ)) continue;
    if (!rendu(champ)) continue;
    if (!fenetre) amener(champ);
    if (visible(champ) !== true) continue;
    const nom = designation(champ);
    mesurer(`champ ${rang}:${nom}`, `${nom} (valeur)`, () => composantes(getComputedStyle(champ).color), () => fondPeintSous(champ), champ);
    if ((champ.getAttribute('placeholder') ?? '') !== '') {
      mesurer(`indicatif ${rang}:${nom}`, `${nom}::placeholder`, () => composantes(getComputedStyle(champ, '::placeholder').color), () => fondPeintSous(champ), champ);
    }
  }
  return { fautes, attenuations: fautesAttenuation, couleurs, mesures, ratios };
}

// --- Les marques -------------------------------------------------------------------

/** La couleur résolue d'un jeton dans le thème courant, ou sous hote : un
 *  élément qui redéclare les jetons — le document imprimé de l'aperçu,
 *  [data-impression], porte ceux du clair dans les deux thèmes (§ 11.7). */
export function couleurDeJeton(jeton, hote = document.body) {
  const sonde = document.createElement('span');
  sonde.style.color = `var(${jeton})`;
  hote.append(sonde);
  try {
    return composantes(getComputedStyle(sonde).color);
  } finally {
    sonde.remove();
  }
}

// Des points, dans le repère propre d'une forme, où elle peint quoi
// ('fill' ou 'stroke') et que la fenêtre montre, POINTS_MAX au plus : le
// centre de sa boîte, les milieux de ses bords, puis une grille de neuf sur
// neuf, dans cet ordre ; aucun pour une forme rognée en entier.
const POINTS_MAX = 8;
function pointsPeints(forme, quoi) {
  const b = forme.getBBox();
  const candidats = [
    [b.x + b.width / 2, b.y + b.height / 2],
    [b.x + b.width / 2, b.y],
    [b.x + b.width, b.y + b.height / 2],
    [b.x + b.width / 2, b.y + b.height],
    [b.x, b.y + b.height / 2],
  ];
  for (let i = 0; i <= 8; i += 1) for (let j = 0; j <= 8; j += 1) candidats.push([b.x + (b.width * i) / 8, b.y + (b.height * j) / 8]);
  const versEcran = forme.getScreenCTM();
  const points = [];
  for (const [x, y] of candidats) {
    const point = new DOMPoint(x, y);
    if (!(quoi === 'stroke' ? forme.isPointInStroke(point) : forme.isPointInFill(point))) continue;
    const ecran = point.matrixTransform(versEcran);
    if (montreLeDessin(forme, ecran.x, ecran.y)) points.push(point);
    if (points.length === POINTS_MAX) break;
  }
  return points;
}

// Ce qui est peint sous la plupart des points où la forme peint : les
// couleurs dessous en chaque point, puis la liste la plus fréquente, la
// première à égalité. Un trait qui croise un autre trait en un point se
// juge sur ce qui l'entoure, non sur ce croisement.
function dessousLePlusFrequent(forme, quoi) {
  const comptes = new Map();
  const points = pointsPeints(forme, quoi);
  if (points.length === 0) return null;
  for (const point of points) {
    const couleurs = dessousAuPoint(forme, point);
    const cle = couleurs.map(rgb).join(' + ');
    const vu = comptes.get(cle) ?? { couleurs, n: 0 };
    vu.n += 1;
    comptes.set(cle, vu);
  }
  return [...comptes.values()].reduce((a, b) => (b.n > a.n ? b : a)).couleurs;
}

// Les couleurs peintes sous une forme SVG au point donné de son repère : une
// sonde sans peinture, posée juste avant elle chez son parent, se mesure par
// fondPeintSous, qui lit les formes peintes avant elle à ce point, puis ce
// qui est sous le dessin.
function dessousAuPoint(forme, point) {
  const ecran = point.matrixTransform(forme.getScreenCTM());
  const parent = forme.parentNode;
  const matrice = parent.getScreenCTM();
  const local = ecran.matrixTransform(matrice.inverse());
  const cote = 0.5 / Math.hypot(matrice.a, matrice.b);
  const sonde = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  sonde.setAttribute('x', String(local.x - cote / 2));
  sonde.setAttribute('y', String(local.y - cote / 2));
  sonde.setAttribute('width', String(cote));
  sonde.setAttribute('height', String(cote));
  sonde.style.fill = 'none';
  sonde.style.stroke = 'none';
  parent.insertBefore(sonde, forme);
  try {
    return fondPeintSous(sonde);
  } finally {
    sonde.remove();
  }
}

// Les bords d'un élément HTML qui se peignent, et leurs couleurs.
export function bordsPeints(style) {
  return ['top', 'right', 'bottom', 'left']
    .filter((cote) => style.getPropertyValue(`border-${cote}-style`) !== 'none' && parseFloat(style.getPropertyValue(`border-${cote}-width`)) > 0)
    .map((cote) => composantes(style.getPropertyValue(`border-${cote}-color`)));
}

/**
 * Ce qu'une marque peint de son jeton, et ce qui l'entoure : { peinture,
 * voisins }. Une forme SVG : son remplissage — une trame se mesure contre
 * les autres couleurs de son motif, un aplat contre ce qui est peint dessous
 * en un point qu'il couvre — ou son trait, contre ce qui est dessous en un
 * point du trait et contre son propre remplissage. Un texte SVG au trait —
 * le filigrane — : son contour, contre ce qui est peint sous le centre de sa
 * boîte. Un élément HTML : sa bordure ou son fond, contre ce qui est peint
 * sous son parent, et son fond propre pour une bordure. peinture null : le
 * jeton n'est peint nulle part.
 */
function voisinage(element, jeton) {
  if (element instanceof SVGTextContentElement) {
    const { stroke } = couleursPeintes(element);
    const trace = Number.parseFloat(getComputedStyle(element).strokeWidth) > 0;
    return trace && stroke.some((c) => egales(c, jeton)) ? { peinture: 'trait', voisins: fondPeintSous(element) } : { peinture: null, voisins: [] };
  }
  if (element instanceof SVGGeometryElement) {
    const motif = /^url\(/.test(getComputedStyle(element).fill);
    const { fill, stroke } = couleursPeintes(element);
    if (fill.some((c) => egales(c, jeton))) {
      if (motif) return { peinture: 'trame', voisins: fill.filter((c) => !egales(c, jeton)) };
      const dessous = dessousLePlusFrequent(element, 'fill');
      return dessous === null ? { peinture: 'cachee', voisins: [] } : { peinture: 'remplissage', voisins: dessous };
    }
    if (stroke.some((c) => egales(c, jeton))) {
      const dessous = dessousLePlusFrequent(element, 'stroke');
      return dessous === null ? { peinture: 'cachee', voisins: [] } : { peinture: 'trait', voisins: [...dessous, ...fill] };
    }
    return { peinture: null, voisins: [] };
  }
  const style = getComputedStyle(element);
  const fond = composantes(style.backgroundColor);
  if (bordsPeints(style).some((c) => egales(c, jeton))) {
    return { peinture: 'bordure', voisins: [...(fond[3] === 1 ? [fond] : []), ...fondPeintSous(element.parentElement)] };
  }
  if (egales(fond, jeton)) return { peinture: 'fond', voisins: fondPeintSous(element.parentElement) };
  return { peinture: null, voisins: [] };
}

/**
 * Les marques rendues sous racine (§ 14.5, § 19.5) : chacune nommée au
 * registre, peinte de son jeton, à 3:1 de ce qui l'entoure, sans
 * atténuation. Sous le document imprimé de l'aperçu, le jeton se résout
 * comme le papier le résout : au clair, dans les deux thèmes.
 * → { vues: string[], fautes, attenuations, mesures, ratios },
 * ratios : { marque, jeton, ratio } de chaque marque mesurée, contre ce qui
 * l'entoure de plus défavorable, dans l'ordre des mesures. fenetre vrai :
 * seules les marques que la fenêtre montre entières se lisent, sans rien
 * amener : une marque rognée par le bord de la fenêtre ou d'un ancêtre qui
 * rogne ne montre qu'une partie de ce qui l'entoure — une chaise coupée par
 * le bord du plan ne garde parfois, de son trait, que le point où il touche
 * le trait du plateau.
 */
export function releverMarques(racine, { fenetre = false } = {}) {
  const vues = new Set();
  const ratios = [];
  const fautes = [];
  const fautesAttenuation = [];
  let mesures = 0;
  for (const element of racine.querySelectorAll('[data-marque]')) {
    if (fenetre && !entiereDansLaFenetre(element)) continue;
    if (!rendu(element)) continue;
    const nom = element.dataset.marque;
    const entree = MARQUES.find((m) => m.nom === nom);
    if (entree === undefined) {
      fautes.push(`${situer(element)} : marque hors du registre MARQUES`);
      continue;
    }
    for (const a of attenuations(element)) fautesAttenuation.push(`${situer(element)} : ${designation(a)} ${a.propriete}: ${a.valeur}`);
    // Sous une fenêtre modale, la page est inerte et le test d'atteinte
    // rencontre la fenêtre d'abord : une marque HTML de la page ne s'y
    // mesure pas, comme ses textes, et se mesure sur les écrans sans
    // fenêtre. Le dessin SVG, lu par sa géométrie, se mesure partout. Une
    // marque ne compte comme vue que là où elle se mesure.
    const modale = document.querySelector('dialog:modal');
    if (modale !== null && !(element instanceof SVGElement) && !modale.contains(element)) continue;
    vues.add(nom);
    if (!fenetre) amener(element);
    const jeton = couleurDeJeton(entree.jeton, element.closest('[data-impression]') ?? document.body);
    try {
      const { peinture, voisins } = voisinage(element, jeton);
      if (peinture === null) {
        fautes.push(`${situer(element)} : ne peint pas son jeton ${entree.jeton} (${rgb(jeton)})`);
        continue;
      }
      // Rognée par un ancêtre qui défile, la marque ne se voit pas ici.
      if (peinture === 'cachee') continue;
      if (voisins.length === 0) {
        fautes.push(`${situer(element)} : ${peinture} sans rien d'opaque autour`);
        continue;
      }
      mesures += 1;
      const { fond, ratio } = pire(jeton, voisins);
      ratios.push({ marque: nom, jeton: entree.jeton, ratio });
      if (ratio < SEUIL_MARQUE) fautes.push(`${situer(element)} (${peinture}) : ${ratio.toFixed(2)}:1, ${rgb(jeton)} contre ${rgb(fond)}`);
    } catch (erreur) {
      fautes.push(`${situer(element)} : ${erreur.message}`);
    }
  }
  return { vues: [...vues], fautes, attenuations: fautesAttenuation, mesures, ratios };
}


// --- La capture d'écran d'une étape ---------------------------------------------------

const THEMES = Object.freeze(['clair', 'sombre']);

// Le corps, en px, de la chaîne témoin mesurée : grand, pour que l'écart
// relatif lise la police et non l'arrondi d'un pixel.
const CORPS_TEMOIN = 100;

const SVG = 'http://www.w3.org/2000/svg';

// Les éléments dont le texte ne se peint jamais : leurs nœuds de texte ne
// sont pas relevés.
const SANS_TEXTE = new Set(['script', 'style', 'template', 'noscript']);

// Les éléments qui n'existent que pour porter un texte : rendus vides, sans
// image ni nom annoncé, ils trahissent un libellé manquant (§ 19.11).
const PORTEURS_DE_LIBELLE = 'button, label, legend, caption, th, h1, h2, h3, h4, h5, h6, p, li, dt, dd, summary, option, a';

// Ce qui donne un nom à un élément sans texte.
const NOMMANTS = ['aria-label', 'aria-labelledby', 'title'];

// Les clés de la traduction : un texte qui en égale une est une clé brute.
const CLES = new Set(creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]).cles());

// Les jetons de couleur que la feuille des jetons déclare, dans l'ordre de
// leur première déclaration ; les jetons des textes du registre (TEXTES)
// d'abord, qui nomment une couleur partagée par plusieurs jetons.
const JETONS = (() => {
  const declares = [...new Set([...JETONS_CSS.matchAll(/(--couleur-[a-z0-9-]+)\s*:/g)].map(([, nom]) => nom))];
  const deTexte = TEXTES.map(({ jeton }) => jeton);
  return Object.freeze([...deTexte.filter((jeton) => declares.includes(jeton)), ...declares.filter((jeton) => !deTexte.includes(jeton))]);
})();

// Les captures déclarées, lues une fois de node.
let declarations = null;
async function declaration(fichier) {
  declarations ??= commands.declarationsCaptures();
  const { captures } = await declarations;
  return captures.find((capture) => capture.fichier === fichier) ?? null;
}

// Les captures photographiées sur la racine du projet depuis le chargement
// du module : le contrôle de clôture du parcours.
const prises = new Set();

/** Les noms des captures que photographier a menées à leur terme sur la
 *  racine du projet, dans l'ordre. */
export function capturesPrises() {
  return [...prises];
}

/** Le mode des captures que fournit la configuration : 'verifier' ou
 *  'ecrire'. */
export function modeFourni() {
  return inject('captures')?.mode ?? 'verifier';
}

/**
 * Les textes du conteneur, en ordre de document : chaque nœud de texte hors
 * des éléments qui ne se peignent jamais, ses blancs réduits à une espace,
 * vides écartés (§ 19.5).
 *
 * @param {Element} racine
 * @returns {string[]}
 */
export function texteReleve(racine) {
  const textes = [];
  const marcheur = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
  for (let noeud = marcheur.nextNode(); noeud !== null; noeud = marcheur.nextNode()) {
    if (noeud.parentElement === null || noeud.parentElement.closest('script, style, template, noscript') !== null) continue;
    if (SANS_TEXTE.has(noeud.parentElement.localName)) continue;
    const texte = noeud.textContent.replace(/\s+/g, ' ').trim();
    if (texte !== '') textes.push(texte);
  }
  return textes;
}

/**
 * Les fautes de libellé du conteneur (§ 19.11) : un porteur de libellé
 * rendu sans texte, sans image ni contrôle dedans, sans nom annoncé, hors
 * d'une zone d'annonce ; un texte égal à une clé de la traduction ; une
 * marque de la langue témoin.
 *
 * @param {Element} racine
 * @returns {string[]}
 */
export function fautesDeLibelle(racine) {
  const fautes = [];
  for (const element of racine.querySelectorAll(PORTEURS_DE_LIBELLE)) {
    if (!rendu(element) || element.textContent.trim() !== '') continue;
    if (element.querySelector('svg, img, canvas, input, select, textarea') !== null) continue;
    if (NOMMANTS.some((nom) => (element.getAttribute(nom) ?? '').trim() !== '')) continue;
    if (element.closest('[aria-live], [role="status"], [role="alert"], [role="log"]') !== null) continue;
    fautes.push(`élément de texte vide : ${situer(element)}`);
  }
  for (const texte of texteReleve(racine)) {
    if (CLES.has(texte)) fautes.push(`clé brute affichée : « ${texte} »`);
    if (texte.includes(MARQUE_TEMOIN.ouverture) || texte.includes(MARQUE_TEMOIN.fermeture)) {
      fautes.push(`marque de la langue témoin : « ${extrait(texte)} »`);
    }
  }
  return fautes;
}

// La largeur rendue de la chaîne témoin dans la police de l'interface, au
// corps CORPS_TEMOIN, crénage et ligatures coupés comme longueurTemoin les
// compte, sur un <text> posé dans le conteneur le temps de la lecture.
function largeurTemoin(racine) {
  const svg = document.createElementNS(SVG, 'svg');
  const texte = document.createElementNS(SVG, 'text');
  texte.setAttribute(
    'style',
    `font-family: var(--police-interface); font-size: ${CORPS_TEMOIN}px; font-weight: 400; font-kerning: none; font-variant-ligatures: none`,
  );
  texte.textContent = CHAINE_TEMOIN;
  svg.append(texte);
  racine.append(svg);
  try {
    return texte.getComputedTextLength();
  } finally {
    svg.remove();
  }
}

// La couleur en clé de comparaison.
const cleCouleur = (couleur) => couleur.join(',');

// Le jeton d'une couleur de texte dans le thème courant : le premier de
// JETONS qui la résout ; sa forme rgb(…) quand aucun ne la résout.
function jetonsDuTheme() {
  const parCouleur = new Map();
  for (const jeton of JETONS) {
    const cle = cleCouleur(couleurDeJeton(jeton));
    if (!parCouleur.has(cle)) parCouleur.set(cle, jeton);
  }
  return (couleur) => parCouleur.get(cleCouleur(couleur)) ?? rgb(couleur);
}

// Un ratio arrondi au centième, comme le tableau des contrastes l'écrit.
const centieme = (ratio) => Math.round(ratio * 100) / 100;

/**
 * Les styles relevés dans le thème courant (§ 14.5, § 19.5), sur ce que la
 * fenêtre montre — la région photographiée : pour chaque
 * jeton et chaque rôle — texte, marque —, le plus petit ratio mesuré et le
 * seuil du rôle, rangés par jeton puis rôle ; et les fautes : un ratio sous
 * son seuil, une mesure impossible, une atténuation.
 *
 * @param {Element} racine
 * @returns {{styles: Array<{jeton: string, role: string, ratio: number, seuil: number}>, fautes: string[]}}
 */
export function stylesDuTheme(racine) {
  const textes = releverTextes(racine, { fenetre: true });
  const marques = releverMarques(racine, { fenetre: true });
  const jetonDe = jetonsDuTheme();
  const parCle = new Map();
  const retenir = (jeton, role, ratio, seuil) => {
    const cle = `${jeton}\u{0}${role}`;
    const vu = parCle.get(cle);
    if (vu === undefined || ratio < vu.ratio) parCle.set(cle, { jeton, role, ratio, seuil });
  };
  for (const { couleur, ratio } of textes.ratios) retenir(jetonDe(couleur), 'texte', ratio, SEUIL_TEXTE);
  for (const { jeton, ratio } of marques.ratios) retenir(jeton, 'marque', ratio, SEUIL_MARQUE);
  const styles = [...parCle.values()]
    .map((style) => ({ ...style, ratio: centieme(style.ratio) }))
    .sort((a, b) => (a.jeton < b.jeton ? -1 : a.jeton > b.jeton ? 1 : a.role < b.role ? -1 : a.role > b.role ? 1 : 0));
  return { styles, fautes: [...textes.fautes, ...textes.attenuations, ...marques.fautes, ...marques.attenuations] };
}

// Les positions de défilement du document et de chaque élément du
// conteneur qui a défilé ; rend la fonction qui les restitue.
function retenirDefilements(racine) {
  const positions = [document.scrollingElement, racine, ...racine.querySelectorAll('*')]
    .filter((element) => element !== null && (element.scrollTop !== 0 || element.scrollLeft !== 0 || element.scrollHeight > element.clientHeight))
    .map((element) => [element, element.scrollTop, element.scrollLeft]);
  return () => {
    for (const [element, haut, gauche] of positions) {
      element.scrollTop = haut;
      element.scrollLeft = gauche;
    }
  };
}

const hex = (tampon) => [...new Uint8Array(tampon)].map((octet) => octet.toString(16).padStart(2, '0')).join('');

/**
 * L'empreinte d'état (§ 8.8, § 19.5) : le SHA-256 hexadécimal de
 * serialiserCharge de l'événement ouvert, lu sur le disque simulé du
 * montage ; null sans événement ouvert.
 *
 * @param {Object} m  un montage de monterApp
 * @returns {Promise<string|null>}
 */
export async function empreinteEtat(m) {
  const { evenement, racine } = m.seance.etat();
  if (evenement === null) return null;
  const texte = m.fs.contenu(racine.id, `${evenement.base}${SUFFIXES.etat}`);
  if (texte === null) throw new Error(`état de ${evenement.base} absent du disque simulé`);
  const { charge } = analyser(texte);
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialiserCharge(charge))));
}

// Un élément que l'étape affirme est-il visible ? Un élément HTML : visible
// de rendu.js, son centre atteint et non couvert. Un élément SVG se lit par
// la géométrie du dessin, comme ses textes au relevé des contrastes : rendu,
// et le centre de sa boîte dans le <svg> extérieur et dans la fenêtre — un
// dessin sous le pointeur ou hors d'atteinte reste visible. Dans les deux
// cas, la boîte entière tient dans la fenêtre et dans chaque ancêtre qui
// rogne : un libellé dont le centre se voit mais que le bord du plan coupe
// n'est pas lisible sur l'image. Rend true, ou la raison.
function conditionVisible(element) {
  if (element instanceof SVGElement) {
    if (!rendu(element)) return 'checkVisibility faux';
    if (!centreDansLeDessin(element)) return 'le centre de sa boîte est hors du dessin ou de la fenêtre';
  } else {
    const vu = visible(element);
    if (vu !== true) return vu;
  }
  return entiereDansLaFenetre(element) ? true : 'sa boîte déborde de la fenêtre ou d’un ancêtre qui la rogne : l’image la coupe';
}

/**
 * La première requête hors de la boucle locale que la page a émise depuis
 * le relevé précédent (§ 2, § 19.11), suivie de la cause de son échec entre
 * parenthèses quand node l'a déjà reçue ; null sans requête. Vide les deux
 * relevés de test/chromium.js, requêtes et échecs : chaque requête se
 * nomme une fois, au premier contrôle qui la lit. Photographier, une page
 * du PDF, la fin de chaque épreuve du parcours et sa clôture la lisent.
 *
 * @returns {Promise<string|null>}
 */
export async function requeteHorsBoucle() {
  const [adresse] = await commands.requetesHorsBoucle();
  const echecs = await commands.echecsHorsBoucle();
  if (adresse === undefined) return null;
  const cause = echecs.find((echec) => echec.adresse === adresse)?.cause ?? null;
  return cause === null ? adresse : `${adresse} (${cause})`;
}

// Ce que porte le userAgent de Chromium sans tête, le seul mode d'affichage
// des captures, MODE_AFFICHAGE au manifeste (§ 19.4) : les métriques de
// texte diffèrent d'un mode à l'autre.
const SANS_TETE = 'HeadlessChrome';

// L'identifiant du cadre que pose cliche.
const CADRE_DE_CAPTURE = 'gtt-cadre-de-capture';

// L'image de l'écran du montage m, telle que la fenêtre la montre ; rend
// { chemin }. Un montage dont la boîte est la fenêtre se photographie
// lui-même. Un montage plus haut — l'aperçu avant impression, dont le
// document n'est jamais tronqué — se photographie par un cadre fixe de la
// taille de la fenêtre, posé le temps de la capture, sans peinture, sans
// atteinte du pointeur, caché aux technologies d'assistance : l'image est
// la fenêtre, à la position où le document a défilé. Le cadre ne sert que
// là : la capture d'un autre élément que le montage peint autrement
// l'élément qui a le focus — le contour de focus du plan, le curseur d'un
// champ —, et l'image d'un écran qui n'a pas changé changerait.
async function cliche(m, fichier, racine) {
  const b = m.racine.getBoundingClientRect();
  if (b.left === 0 && b.top === 0 && b.width === innerWidth && b.height === innerHeight) {
    return commands.prendreCliche({ fichier, selecteur: `[data-montage="${m.racine.dataset.montage}"]`, racine });
  }
  const cadre = document.createElement('div');
  cadre.id = CADRE_DE_CAPTURE;
  cadre.setAttribute('aria-hidden', 'true');
  Object.assign(cadre.style, { position: 'fixed', inset: '0', pointerEvents: 'none' });
  document.body.append(cadre);
  try {
    return await commands.prendreCliche({ fichier, selecteur: `#${CADRE_DE_CAPTURE}`, racine });
  } finally {
    cadre.remove();
  }
}

/**
 * Photographie l'écran du montage m sous le nom fichier, une capture de
 * CAPTURES. Dans l'ordre, chaque contrôle échoue en nommant la capture et
 * la nature de la faute : capture déclarée ; feuille sans mouvement posée ;
 * conditions visibles ; collecteur vide ; aucune requête hors de la boucle
 * locale ; cadre relu au CADRE, facteur d'échelle 1 ; navigateur sans
 * tête, que nomme MODE_AFFICHAGE ; thème clair ; chaîne témoin dans sa
 * tolérance ; aucun chemin hors de la racine de travail dans le texte
 * relevé ; aucune faute de libellé ; styles relevés dans les deux thèmes,
 * sous leurs seuils ; empreinte d'état. L'entrée se compose,
 * puis 'verifier' la compare au manifeste — un écart nomme l'étape et sa
 * nature —, et 'ecrire' dépose l'image de la fenêtre, prise avant les
 * relevés, et l'entrée.
 *
 * @param {Object} m          un montage de monterApp
 * @param {string} fichier    le nom de la capture, sans extension
 * @param {Object} [options]
 * @param {string|string[]} [options.condition]  les sélecteurs que l'étape
 *        affirme : présents dans le conteneur, visibles
 * @param {number|null} [options.graine]  la graine écrite dans le scénario
 * @param {'verifier'|'ecrire'} [options.mode]  sinon celui de la configuration
 * @param {string|null} [options.racine]  un dossier d'épreuve, sinon le projet
 * @returns {Promise<Object>} l'entrée, sans image ni empreinte
 */
export async function photographier(m, fichier, { condition = [], graine = null, mode = modeFourni(), racine = null } = {}) {
  const echec = (nature) => new Error(`capture ${fichier} : ${nature}`);
  const declaree = await declaration(fichier);
  if (declaree === null) throw echec('absente de CAPTURES');
  if (!feuillePosee()) throw echec('la feuille qui annule transitions et animations n’est pas posée');
  for (const selecteur of [condition].flat()) {
    const element = m.racine.querySelector(selecteur);
    if (element === null) throw echec(`sélecteur absent « ${selecteur} »`);
    const vu = conditionVisible(element);
    if (vu !== true) throw echec(`« ${selecteur} » invisible : ${vu}`);
  }
  const [erreur] = m.erreurs();
  if (erreur !== undefined) throw echec(`collecteur : ${erreur.type} « ${erreur.message} »`);
  const requete = await requeteHorsBoucle();
  if (requete !== null) throw echec(`requête hors de la boucle locale : ${requete}`);
  if (innerWidth !== CADRE.largeur || innerHeight !== CADRE.hauteur) {
    throw echec(`cadre ${innerWidth} × ${innerHeight}, attendu ${CADRE.largeur} × ${CADRE.hauteur}`);
  }
  if (devicePixelRatio !== 1) throw echec(`facteur d’échelle ${devicePixelRatio}, attendu 1`);
  if (!navigator.userAgent.includes(SANS_TETE)) {
    throw echec(`navigateur avec tête, navigator.userAgent sans ${SANS_TETE} : le mode d’affichage nommé au manifeste est ${MODE_AFFICHAGE}`);
  }
  const theme = document.documentElement.getAttribute('data-theme');
  if (theme !== 'clair') throw echec(`thème « ${theme} », l’image se prend en thème clair`);
  const { regulier } = await m.polices();
  const attendue = longueurTemoin(regulier, CORPS_TEMOIN);
  const lue = largeurTemoin(m.racine);
  const tolerance = constante('TOLERANCE_CHAINE_TEMOIN');
  if (!(Math.abs(lue - attendue) / attendue <= tolerance)) {
    throw echec(`chaîne témoin à ${lue} px, ${attendue} px attendus à ${tolerance} près : la police rendue n’est pas l’embarquée`);
  }

  const image = mode === 'ecrire' ? await cliche(m, fichier, racine) : null;

  const texte = texteReleve(m.racine);
  const racineNeutre = m.seance.etat().racine?.chemin ?? null;
  if (racineNeutre === null) throw echec('aucune racine de travail : le texte relevé ne se contrôle pas');
  const [chemin] = await commands.cheminsHorsRacine({ texte, racine: racineNeutre });
  if (chemin !== undefined) throw echec(`chemin hors de la racine neutre : « ${chemin} »`);
  const [libelle] = fautesDeLibelle(m.racine);
  if (libelle !== undefined) throw echec(libelle);

  // Chaque thème se relève sur la position où l'image a été prise.
  const restituer = retenirDefilements(m.racine);
  const styles = {};
  for (const nom of THEMES) {
    let releve;
    try {
      releve = await sousTheme(nom, () => stylesDuTheme(m.racine));
    } finally {
      restituer();
    }
    const { styles: releves, fautes } = releve;
    if (fautes.length > 0) throw echec(`thème ${nom} : ${fautes.length} faute(s) de contraste ou d’atténuation :\n${fautes.join('\n')}`);
    if (releves.length === 0) throw echec(`thème ${nom} : aucun style relevé`);
    styles[nom] = releves;
  }

  const entree = {
    fichier,
    etape: declaree.etape,
    source: 'navigateur',
    versionReelle: VERSION.affichee,
    graine,
    cadre: { largeur: innerWidth, hauteur: innerHeight },
    facteurEchelle: devicePixelRatio,
    mode: MODE_AFFICHAGE,
    theme,
    instant: m.horloge.horodatage(),
    texte,
    styles,
    etat: await empreinteEtat(m),
    pdf: null,
  };

  if (mode === 'ecrire') {
    await commands.deposerCapture({ fichier, entree, chemin: image.chemin, racine });
  } else if (mode === 'verifier') {
    const { ecarts } = await commands.comparerCapture({ fichier, entree, racine });
    if (ecarts.length > 0) throw echec(`écart au manifeste :\n${ecarts.join('\n')}`);
  } else {
    throw echec(`mode inconnu « ${mode} »`);
  }
  if (racine === null) prises.add(fichier);
  return entree;
}

/**
 * Clôt un parcours photographié (§ 19.1, § 19.5, § 19.7, § 19.11).
 * declarees : les captures que le parcours porte, CAPTURES hors A_VENIR par
 * défaut. Une épreuve du fichier en échec, qu'elle ait photographié ou non,
 * refuse la clôture en se nommant ; une requête hors de la boucle locale
 * émise depuis le dernier relevé la refuse en se nommant aussi : en
 * écriture, le dossier d'attente est jeté et rien n'est publié. Sans
 * échec, l'écriture publie d'un bloc et rend le bilan de publierCaptures ;
 * la vérification affirme que le manifeste porte exactement les déclarées.
 *
 * @param {Object} options
 * @param {string[]} options.echecs  les épreuves du fichier qui ont échoué
 * @param {string[]|null} [options.declarees]
 * @param {'verifier'|'ecrire'} [options.mode]  sinon celui de la configuration
 * @param {string|null} [options.racine]  un dossier d'épreuve, sinon le projet
 * @param {string|null} options.racineNeutre  la racine de travail du montage
 * @returns {Promise<{declarees: string[], bilan: Object|null}>}
 */
export async function cloreCaptures({ echecs, declarees = null, mode = modeFourni(), racine = null, racineNeutre }) {
  let liste = declarees;
  if (liste === null) {
    const { captures, aVenir } = await commands.declarationsCaptures();
    liste = captures.map(({ fichier }) => fichier).filter((fichier) => !aVenir.includes(fichier));
  }
  if (liste.length === 0) throw new Error('captures : aucune capture déclarée — zéro capture n’est jamais un succès');
  const requete = await requeteHorsBoucle();
  const causes = [];
  if (echecs.length > 0) causes.push(`${echecs.length} épreuve(s) du parcours en échec : ${echecs.map((nom) => `« ${nom} »`).join(', ')}`);
  if (requete !== null) causes.push(`requête hors de la boucle locale : ${requete}`);
  if (causes.length > 0) {
    if (mode === 'ecrire') await commands.viderAttente({ racine });
    throw new Error(`captures non ${mode === 'ecrire' ? 'publiées' : 'vérifiées'} : ${causes.join(' ; ')}`);
  }
  const memes = (a, b) => [...a].sort().join('\n') === [...b].sort().join('\n');
  if (mode === 'ecrire') {
    const bilan = await commands.publierCaptures({ declarees: liste, racine, racineNeutre });
    if (!memes([...bilan.ecrites, ...bilan.gardees], liste)) throw new Error(`captures : publiées ${[...bilan.ecrites, ...bilan.gardees].join(', ')}, déclarées ${liste.join(', ')}`);
    return { declarees: liste, bilan };
  }
  if (mode !== 'verifier') throw new Error(`captures : mode inconnu « ${mode} »`);
  const manifeste = await commands.lireManifeste({ racine });
  const portees = (manifeste?.captures ?? []).map(({ fichier }) => fichier);
  if (portees.join('\n') !== liste.join('\n')) throw new Error(`captures : le manifeste porte ${portees.join(', ') || '(rien)'}, déclarées ${liste.join(', ')}`);
  return { declarees: liste, bilan: null };
}
