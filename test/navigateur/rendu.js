// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Aides de rendu des épreuves du navigateur (§ 14.2, § 14.5). Elles lisent ce
// que le moteur de rendu a résolu — style calculé, boîte, élément qu'atteint
// un point — et jamais la présence d'une classe. Elles ne lisent aucun pixel :
// le contraste se calcule sur les couleurs calculées, qui ne sont les couleurs
// peintes que sans opacité partielle, filtre, masque ni mode de fusion, ce
// qu'attenuations relève sur toute l'ascendance d'un texte.
//
// Une couleur est un tableau [r, g, b, a] : composantes sRGB de 0 à 255,
// alpha de 0 à 1, la forme de palette.js.
//
// Un porteur de texte est { element, pseudo } : un élément qui porte lui-même
// un nœud de texte non vide (pseudo null), ou l'un de ses pseudo-éléments
// ::before et ::after dont content produit un texte. Les aides qui reçoivent
// un porteur acceptent aussi un élément nu, lu comme { element, pseudo: null }.
//
// Ce que les aides ne décèlent pas. Le centre de la boîte tient lieu de
// l'élément : un élément dont ce centre tombe hors de sa peinture — un anneau,
// un trait coudé — est dit hors d'atteinte (« n'atteint pas »). La lecture
// s'ancre à la première entrée d'elementsFromPoint que la cible contient : un
// descendant hissé au-dessus d'un recouvrement l'y ancre, et ce recouvrement
// échappe à visible et se lit comme fond peint dessous. elementsFromPoint ne
// rend jamais un pseudo-élément : sa peinture se lit sur son hôte. Un
// pseudo-élément à texte fait couvrir toute la boîte de l'hôte, un
// pseudo-élément sans texte ne couvre rien, et aucun fond de pseudo-élément
// ne se lit sous le texte d'un autre élément. Une boîte HTML se juge
// entière : son fond, son texte ou son image couvrent tout point de la boîte,
// coin arrondi ou zone sans glyphe compris. isPointInFill et isPointInStroke
// ignorent clip-path : une forme rognée au point y compte comme peinte.

/** Le rapport de contraste des WCAG, seule implémentation du dépôt. */
export { contraste } from '../../src/interface/palette.js';

const PSEUDOS = ['::before', '::after'];

// Éléments dont le texte ne se peint jamais : code, feuille, gabarit, et les
// textes de description d'un SVG, lus par l'accessibilité seule.
const TEXTES_NON_PEINTS = new Set(['script', 'style', 'template', 'noscript', 'title', 'desc', 'metadata']);

// Conteneurs SVG dont les formes ne se peignent qu'à travers une référence :
// une forme qu'ils portent n'est jamais « dessous » un élément du dessin.
const CONTENEURS_DE_REFERENCE = 'defs, pattern, clipPath, mask, marker, symbol, linearGradient, radialGradient';

// Valeurs calculées qui laissent la couleur peinte égale à la couleur résolue.
const NEUTRES = [
  ['opacity', '1'],
  ['fill-opacity', '1'],
  ['stroke-opacity', '1'],
  ['filter', 'none'],
  ['backdrop-filter', 'none'],
  ['mask-image', 'none'],
  ['mix-blend-mode', 'normal'],
];

/** Composantes [r, g, b, a] d'une couleur calculée. Chromium rend une couleur
 *  sRGB sous la forme « rgb(r, g, b) » ou « rgba(r, g, b, a) » ; toute autre
 *  forme lève, plutôt que de laisser passer une épreuve sans mesure. */
export function composantes(couleur) {
  const m = /^rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)$/.exec(couleur);
  if (m === null) {
    throw new Error(`couleur calculée illisible : « ${couleur} »`);
  }
  return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
}

/** L'élément, puis chacun de ses ancêtres jusqu'à la racine du document ;
 *  parentElement relie aussi un élément SVG à son parent. */
export function ascendance(element) {
  const chaine = [];
  for (let n = element; n !== null; n = n.parentElement) {
    chaine.push(n);
  }
  return chaine;
}

// { element, pseudo } d'un porteur ou d'un élément nu.
function porteur(cible) {
  return cible instanceof Element ? { element: cible, pseudo: null } : cible;
}

/** Nom lisible d'un élément ou d'un porteur dans un message d'échec : la
 *  balise, chaque attribut data-… dans l'ordre de l'élément, chaque classe,
 *  puis le pseudo-élément. */
export function designation(cible) {
  const { element, pseudo } = porteur(cible);
  const donnees = [...element.attributes]
    .filter((a) => a.name.startsWith('data-'))
    .map((a) => (a.value === '' ? `[${a.name}]` : `[${a.name}="${a.value}"]`))
    .join('');
  const classes = [...element.classList].map((c) => `.${c}`).join('');
  return `${element.localName}${donnees}${classes}${pseudo ?? ''}`;
}

// Le content calculé d'un pseudo-élément produit-il un texte ? « none » et
// « normal » n'en créent pas ; une chaîne littérale vide ou faite de blancs
// crée une boîte sans texte à lire. Toute autre valeur — compteur, attr(),
// image — compte comme texte.
function contenuTextuel(element, pseudo) {
  const contenu = getComputedStyle(element, pseudo).content;
  if (contenu === 'none' || contenu === 'normal') return false;
  const litteral = /^"((?:[^"\\]|\\.)*)"$/.exec(contenu) ?? /^'((?:[^'\\]|\\.)*)'$/.exec(contenu);
  return litteral === null || litteral[1].trim() !== '';
}

// L'élément porte-t-il lui-même un nœud de texte non vide ?
function porteTexte(element) {
  return [...element.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim() !== '');
}

/** Porteurs de texte du sous-arbre de racine, racine comprise, dans l'ordre
 *  du document : pour chaque élément HTML, son ::before à content, l'élément
 *  s'il porte un nœud de texte non vide, puis son ::after à content. Un
 *  élément SVG ne porte pas de pseudo-élément ; les éléments dont le texte ne
 *  se peint jamais (script, style, title…) sont écartés. */
export function porteursDeTexte(racine) {
  const porteurs = [];
  for (const element of [racine, ...racine.querySelectorAll('*')]) {
    if (TEXTES_NON_PEINTS.has(element.localName)) continue;
    const html = element instanceof HTMLElement;
    if (html && contenuTextuel(element, '::before')) porteurs.push({ element, pseudo: '::before' });
    if (porteTexte(element)) porteurs.push({ element, pseudo: null });
    if (html && contenuTextuel(element, '::after')) porteurs.push({ element, pseudo: '::after' });
  }
  return porteurs;
}

/** Couleur du texte d'un porteur : color d'un élément HTML ou d'un
 *  pseudo-élément, fill d'un texte SVG. Un fill qui n'est pas une couleur —
 *  none, un motif — lève par composantes. */
export function couleurTexte(cible) {
  const { element, pseudo } = porteur(cible);
  const style = getComputedStyle(element, pseudo);
  return composantes(element instanceof SVGElement ? style.fill : style.color);
}

// Une couleur peint-elle quelque chose ? Un alpha nul ne peint rien.
const peint = (couleur) => couleur[3] !== 0;

// Ajoute les couleurs à la liste, sans doublon, dans leur ordre.
function ajouter(liste, couleurs) {
  for (const c of couleurs) {
    if (!liste.some((d) => d.join() === c.join())) liste.push(c);
  }
  return liste;
}

const DEGRADES = new Set(['linearGradient', 'radialGradient']);

// Un serveur de peinture porte-t-il lui-même ce qu'il peint : des <stop> pour
// un dégradé, des éléments enfants pour un motif ?
function porteSonContenu(serveur) {
  return DEGRADES.has(serveur.localName)
    ? serveur.querySelector(':scope > stop') !== null
    : serveur.firstElementChild !== null;
}

// Élément que désigne une peinture url(#id), lue dans le document de element,
// ou null pour une couleur. Un dégradé sans <stop> ou un motif sans enfant
// hérite ceux du serveur que désigne son href (ou xlink:href) : la chaîne se
// suit jusqu'au premier serveur qui porte son contenu, ou jusqu'au dernier,
// qui ne peint alors rien. Une référence vers un élément absent, ou une
// chaîne qui boucle, lève.
function serveurDePeinture(valeur, element) {
  const reference = /^url\("?#([^")]+)"?\)/.exec(valeur);
  if (reference === null) return null;
  const doc = element.ownerDocument;
  let serveur = doc.getElementById(reference[1]);
  if (serveur === null) {
    throw new Error(`peinture ${valeur} : aucun élément #${reference[1]}`);
  }
  const vus = new Set([serveur]);
  while (!porteSonContenu(serveur)) {
    const lien = serveur.getAttribute('href') ?? serveur.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
    if (lien === null || !lien.startsWith('#')) break;
    const suivant = doc.getElementById(lien.slice(1));
    if (suivant === null) throw new Error(`peinture ${valeur} : #${serveur.id} hérite de ${lien}, absent`);
    if (vus.has(suivant)) throw new Error(`peinture ${valeur} : la chaîne href de #${serveur.id} boucle`);
    vus.add(suivant);
    serveur = suivant;
  }
  return serveur;
}

// Éléments d'un motif qui peignent : formes et textes, hors display none. Un
// groupe <g> porte un fill calculé, noir par défaut, qu'il ne peint pas ; il
// est écarté, ses formes sont lues.
function peintresDuMotif(motif) {
  return [...motif.querySelectorAll('*')].filter(
    (n) =>
      (n instanceof SVGGeometryElement || n instanceof SVGTextContentElement) &&
      n.checkVisibility({ visibilityProperty: true }),
  );
}

// Couleurs que peint une valeur calculée de fill ou de stroke : none ne peint
// rien ; url(#id) désigne un motif, dont les formes et les textes peignent par
// leurs propres fill et stroke, ou un dégradé, qui peint ses stop-color ;
// sinon, une couleur. Une référence vers un élément d'un autre genre lève.
function couleursDeLaPeinture(valeur, element) {
  if (valeur === 'none') return [];
  const serveur = serveurDePeinture(valeur, element);
  if (serveur === null) {
    const couleur = composantes(valeur);
    return peint(couleur) ? [couleur] : [];
  }
  if (serveur.localName === 'pattern') {
    const couleurs = [];
    for (const peintre of peintresDuMotif(serveur)) {
      const { fill, stroke } = couleursPeintes(peintre);
      ajouter(couleurs, [...fill, ...stroke]);
    }
    return couleurs;
  }
  if (DEGRADES.has(serveur.localName)) {
    return ajouter(
      [],
      [...serveur.querySelectorAll('stop')]
        .map((arret) => composantes(getComputedStyle(arret).stopColor))
        .filter(peint),
    );
  }
  throw new Error(`peinture ${valeur} : #${serveur.id} est un <${serveur.localName}>`);
}

/** fill et stroke calculés d'une forme SVG, chacun en liste de couleurs, sans
 *  doublon : vide pour none ou une couleur transparente ; un motif url(#…)
 *  rend les couleurs que peignent ses enfants, un dégradé ses arrêts. Une
 *  <line> n'a pas d'aire : elle ne peint que par son trait, et son fill
 *  calculé, noir par défaut, rend une liste vide. */
export function couleursPeintes(element) {
  const style = getComputedStyle(element);
  return {
    fill: element instanceof SVGLineElement ? [] : couleursDeLaPeinture(style.fill, element),
    stroke: couleursDeLaPeinture(style.stroke, element),
  };
}

// Fond propre d'un élément ou d'un pseudo-élément, s'il est opaque, sinon
// null. Une image de fond se peint par-dessus la couleur de fond, et ses
// couleurs ne se lisent pas dans le style calculé : elle lève en nommant son
// porteur, plutôt que de laisser mesurer une couleur que l'écran ne montre pas.
function fondOpaque(element, pseudo = null) {
  const style = getComputedStyle(element, pseudo);
  if (style.backgroundImage !== 'none') {
    throw new Error(`fond ${designation({ element, pseudo })} : background-image ${style.backgroundImage} ne se mesure pas`);
  }
  const fond = composantes(style.backgroundColor);
  return fond[3] === 1 ? fond : null;
}

// Propriétés qui composent un élément avec ce qui est dessous : non neutres
// sur un fond ou sur l'un de ses ancêtres, sa couleur calculée n'est plus
// celle de l'écran.
const COMPOSITION = ['opacity', 'filter', 'mask-image', 'mix-blend-mode'];

const NEUTRE = new Map(NEUTRES);

// Fautes { element, pseudo, propriete, valeur } des propriétés nommées dont la
// valeur calculée sur element n'est pas neutre.
function fautesSur(element, proprietes) {
  const style = getComputedStyle(element);
  return proprietes
    .filter((propriete) => style.getPropertyValue(propriete) !== NEUTRE.get(propriete))
    .map((propriete) => ({ element, pseudo: null, propriete, valeur: style.getPropertyValue(propriete) }));
}

// Fautes de composition d'un fond : sur lui et sur chacun de ses ancêtres qui
// ne contiennent pas le texte mesuré. Un ancêtre commun compose le texte et
// son fond ensemble ; attenuations(texte) le relève déjà.
function voiles(fond, texte) {
  return ascendance(fond)
    .filter((n) => !n.contains(texte))
    .flatMap((n) => fautesSur(n, COMPOSITION));
}

// Fautes qui rendent translucide la peinture fill ou stroke d'un élément SVG :
// les voiles de l'élément, son fill-opacity ou stroke-opacity — hérités, ils se
// lisent sur l'élément même —, une couleur d'alpha inférieur à 1 ; pour un
// motif, les mêmes fautes sur chaque forme qui y peint ; pour un dégradé, un
// arrêt translucide.
function translucidite(element, quoi, texte) {
  const style = getComputedStyle(element);
  const valeur = style.getPropertyValue(quoi);
  const fautes = [...voiles(element, texte), ...fautesSur(element, [`${quoi}-opacity`])];
  const serveur = serveurDePeinture(valeur, element);
  if (serveur === null) {
    if (composantes(valeur)[3] !== 1) fautes.push({ element, pseudo: null, propriete: quoi, valeur });
  } else if (serveur.localName === 'pattern') {
    for (const peintre of peintresDuMotif(serveur)) {
      const { fill, stroke } = couleursPeintes(peintre);
      if (fill.length > 0) fautes.push(...translucidite(peintre, 'fill', texte));
      if (stroke.length > 0) fautes.push(...translucidite(peintre, 'stroke', texte));
    }
  } else if (DEGRADES.has(serveur.localName)) {
    for (const arret of serveur.querySelectorAll('stop')) {
      const { stopColor, stopOpacity } = getComputedStyle(arret);
      if (composantes(stopColor)[3] !== 1) fautes.push({ element: arret, pseudo: null, propriete: 'stop-color', valeur: stopColor });
      if (stopOpacity !== '1') fautes.push({ element: arret, pseudo: null, propriete: 'stop-opacity', valeur: stopOpacity });
    }
  }
  return fautes;
}

// Lève quand le fond retenu n'est pas opaque à l'écran, en nommant le fond
// et chaque faute : une couleur composée avec ce qui est dessous ne se mesure
// pas sur sa valeur calculée (§ 14.5).
function exigerOpaque(fond, fautes, texte) {
  if (fautes.length === 0) return;
  const liste = fautes.map((f) => `${designation(f)} ${f.propriete}: ${f.valeur}`).join(' ; ');
  throw new Error(`fond ${designation(fond)} translucide sous ${designation(texte)} : ${liste}`);
}

// Peinture, 'stroke' ou 'fill', qu'une forme SVG pose au point donné en
// coordonnées de la fenêtre, ou null quand elle n'y peint rien : forme en
// display none, cachée ou d'opacité nulle, elle ou un ancêtre
// (checkVisibility) ; peinture absente, transparente ou d'opacité nulle ;
// point hors du trait et du remplissage. Le point passe en coordonnées
// propres de la forme par l'inverse de getScreenCTM, que le moteur de rendu
// tient pour exact (§ 7.2) ; isPointInStroke et isPointInFill ignorent
// pointer-events. Le trait se peint sur le remplissage et se teste d'abord.
function peintureAuPoint(forme, centre) {
  if (!forme.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return null;
  const point = centre.matrixTransform(forme.getScreenCTM().inverse());
  const couleurs = couleursPeintes(forme);
  const style = getComputedStyle(forme);
  for (const quoi of ['stroke', 'fill']) {
    if (couleurs[quoi].length === 0 || Number(style.getPropertyValue(`${quoi}-opacity`)) === 0) continue;
    if (quoi === 'stroke' ? forme.isPointInStroke(point) : forme.isPointInFill(point)) return quoi;
  }
  return null;
}

// Couleurs qu'une forme SVG peint au point, ou null quand elle n'y peint
// rien ; lève quand la peinture retenue est translucide à l'écran.
function fondDeForme(forme, centre, texte) {
  const quoi = peintureAuPoint(forme, centre);
  if (quoi === null) return null;
  exigerOpaque(forme, translucidite(forme, quoi, texte), texte);
  return couleursPeintes(forme)[quoi];
}

// Un <use> peint une copie de l'élément qu'il désigne, que les aides ne
// lisent pas : celui qui peint au point lève en se nommant, plutôt que de
// laisser rendre ce qui est sous lui.
function refuserUse(use, texte) {
  return new Error(`fond sous ${designation(texte)} : ${designation(use)} peint une copie par référence, que l'aide ne lit pas`);
}

// Le <use> peint-il au point ? Sa boîte, dans son propre repère, contient le
// point, et il n'est ni caché ni d'opacité nulle.
function useAuPoint(use, centre) {
  if (!use.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
  const point = centre.matrixTransform(use.getScreenCTM().inverse());
  const b = use.getBBox();
  return point.x >= b.x && point.x <= b.x + b.width && point.y >= b.y && point.y <= b.y + b.height;
}

// Centre de la boîte d'un élément, en coordonnées de la fenêtre.
function centreDe(element) {
  const boite = element.getBoundingClientRect();
  return new DOMPoint(boite.left + boite.width / 2, boite.top + boite.height / 2);
}

// Feuille qui rend chaque élément atteignable le temps d'une lecture :
// elementsFromPoint suit l'atteinte du pointeur, et un élément en
// pointer-events: none n'en est pas moins peint.
const ATTEIGNABLE = '*, *::before, *::after { pointer-events: auto !important; }';

// Éléments présents au point centre, en coordonnées de la fenêtre, du plus
// haut au plus bas dans l'ordre de peinture — cascade, positionnement et
// dessins SVG compris —, pointer-events ignoré. Un point hors de la fenêtre
// n'atteint rien et lève, au nom de texte.
function elementsAuPoint(doc, centre, texte) {
  const fenetre = doc.defaultView;
  if (centre.x < 0 || centre.y < 0 || centre.x >= fenetre.innerWidth || centre.y >= fenetre.innerHeight) {
    throw new Error(`fond sous ${designation(texte)} : centre (${centre.x}, ${centre.y}) hors de la fenêtre`);
  }
  const feuille = doc.createElement('style');
  feuille.textContent = ATTEIGNABLE;
  doc.head.append(feuille);
  try {
    return doc.elementsFromPoint(centre.x, centre.y);
  } finally {
    feuille.remove();
  }
}

// Premier fond opaque peint au point centre sous racine. Parmi les éléments
// présents au point, seuls comptent la première entrée que racine contient et
// celles qui la suivent : ce qui la précède se peint au-dessus d'elle. Les
// descendants de racine sont écartés, racine elle-même non — le fond CSS d'un
// <svg> extérieur se lit. Un élément d'opacité nulle, lui ou un ancêtre, ne
// peint rien et se saute. Une forme SVG rend sa peinture au point, un <use>
// lève, les autres éléments internes d'un SVG ne peignent pas de fond ; un
// élément HTML ou un <svg> extérieur rend son fond opaque. Le fond retenu doit
// être opaque à l'écran, sinon lève ; une racine que le point n'atteint pas
// lève aussi. Rend [] quand rien d'opaque n'est dessous.
function fondAuPoint(centre, racine, texte) {
  const atteints = elementsAuPoint(racine.ownerDocument, centre, texte);
  const debut = atteints.findIndex((n) => racine.contains(n));
  if (debut === -1) {
    throw new Error(`fond sous ${designation(texte)} : le centre (${centre.x}, ${centre.y}) n'atteint pas ${designation(racine)}`);
  }
  for (const n of atteints.slice(debut)) {
    if (n !== racine && racine.contains(n)) continue;
    if (!n.checkVisibility({ opacityProperty: true })) continue;
    if (n instanceof SVGGeometryElement) {
      const couleurs = fondDeForme(n, centre, texte);
      if (couleurs !== null) return couleurs;
      continue;
    }
    if (n instanceof SVGUseElement) throw refuserUse(n, texte);
    if (n instanceof SVGElement && n.ownerSVGElement !== null) continue;
    const fond = fondOpaque(n);
    if (fond !== null) {
      exigerOpaque(n, voiles(n, texte), texte);
      return [fond];
    }
  }
  return [];
}

// Le <svg> le plus extérieur qui contient element.
function svgExterieur(element) {
  let svg = element.ownerSVGElement ?? element;
  while (svg.ownerSVGElement !== null) svg = svg.ownerSVGElement;
  return svg;
}

// Couleurs peintes sous un élément SVG, au centre de sa boîte : les formes
// et les <use> qui le précèdent dans l'ordre du document, hors de lui et de
// ses descendants et hors des conteneurs de référence, se peignent avant lui ;
// de la dernière à la première, la première forme qui peint au point rend ses
// couleurs, un <use> qui peint au point lève. Sans rien dessous dans le
// dessin, ce qui est peint au même point sous le <svg> extérieur, son propre
// fond CSS compris.
function fondSvg(element) {
  const centre = centreDe(element);
  const svg = svgExterieur(element);
  const formes = [...svg.querySelectorAll('*')].filter(
    (n) =>
      (n instanceof SVGGeometryElement || n instanceof SVGUseElement) &&
      n !== element &&
      !element.contains(n) &&
      n.closest(CONTENEURS_DE_REFERENCE) === null &&
      (n.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
  );
  for (const forme of formes.reverse()) {
    if (forme instanceof SVGUseElement) {
      if (useAuPoint(forme, centre)) throw refuserUse(forme, element);
      continue;
    }
    const couleurs = fondDeForme(forme, centre, element);
    if (couleurs !== null) return couleurs;
  }
  return fondAuPoint(centre, svg, element);
}

/** Couleurs peintes sous le contenu d'un porteur ou d'un élément, au centre
 *  de sa boîte. Un élément HTML : son propre fond s'il est opaque — son texte
 *  se peint dessus —, sinon le premier fond opaque peint dessous à ce point,
 *  ses descendants exceptés : un élément HTML frère ou cousin, ou le trait ou
 *  le remplissage d'une forme SVG ; ce qui se peint au-dessus de lui ne compte
 *  pas, en pointer-events: none ou non. Un pseudo-élément : son fond opaque,
 *  sinon celui de son hôte. Un élément SVG, lui et ses descendants exceptés :
 *  le trait ou le remplissage de la forme qui le précède dessous — les
 *  couleurs d'un motif, ou d'un dégradé, href suivi —, ou ce qui est peint
 *  sous le dessin, fond CSS du <svg> extérieur compris. Une forme ou un fond
 *  qui ne peint rien — caché, opacité nulle, peinture d'opacité nulle — est
 *  sauté. Rend [] quand rien d'opaque n'est dessous. Lève quand le fond retenu
 *  est translucide à l'écran (opacity, fill-opacity, stroke-opacity, alpha,
 *  filter, masque, fusion, sur lui ou ses ancêtres propres), quand une image
 *  de fond ou un <use> se peint entre le texte et le fond retenu, quand le
 *  centre est hors de la fenêtre, ou quand il n'atteint pas l'élément. */
export function fondPeintSous(cible) {
  const { element, pseudo } = porteur(cible);
  if (pseudo !== null) {
    const fond = fondOpaque(element, pseudo);
    return fond !== null ? [fond] : fondPeintSous(element);
  }
  if (element instanceof SVGElement && element.ownerSVGElement !== null) return fondSvg(element);
  const fond = fondOpaque(element);
  if (fond !== null) return [fond];
  return fondAuPoint(centreDe(element), element, element);
}

// Fautes de neutralité d'un style : chaque propriété de NEUTRES dont la
// valeur calculée n'est pas la valeur neutre.
function fautesDe(element, pseudo) {
  const style = getComputedStyle(element, pseudo);
  return NEUTRES.filter(([propriete, neutre]) => style.getPropertyValue(propriete) !== neutre).map(
    ([propriete]) => ({ element, pseudo, propriete, valeur: style.getPropertyValue(propriete) }),
  );
}

/** Propriétés qui font différer le pixel peint de la couleur calculée :
 *  opacity, fill-opacity et stroke-opacity différents de 1 ; filter,
 *  backdrop-filter et mask-image différents de none ; mix-blend-mode différent
 *  de normal. Relevées sur le pseudo-élément, puis sur l'élément et chacun de
 *  ses ancêtres : opacity et filter ne s'héritent pas, et changent le pixel
 *  sans changer le style calculé du texte. fill-opacity s'hérite : posé sur un
 *  groupe, il se relève sur le groupe et sur chaque niveau qui en hérite.
 *  → [{ element, pseudo, propriete, valeur }], vide quand tout est neutre. */
export function attenuations(cible) {
  const { element, pseudo } = porteur(cible);
  return [
    ...(pseudo !== null ? fautesDe(element, pseudo) : []),
    ...ascendance(element).flatMap((n) => fautesDe(n, null)),
  ];
}

// Éléments dont le contenu se peint sans qu'un style le dise : image, média,
// dessin, cadre, champ.
const REMPLACES = new Set(['img', 'video', 'canvas', 'iframe', 'embed', 'object', 'input', 'textarea', 'select']);

// Un élément présent au point y peint-il quelque chose qui couvre ce qui est
// dessous ? Non s'il est caché ou d'opacité nulle, lui ou un ancêtre. Une
// forme SVG : une peinture au point (peintureAuPoint). Un autre élément
// interne d'un SVG — texte, <use>, image — : oui, son contenu est au point.
// Un élément HTML ou un <svg> extérieur : un fond d'alpha non nul, une image
// de fond, un nœud de texte propre, un pseudo-élément à texte, ou un élément
// remplacé ; une boîte sans rien de cela, qui ne sert qu'à la mise en page,
// ne couvre rien. Bordure, ombre et contour ne se lisent pas.
function peintAuPoint(n, centre) {
  if (!n.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
  if (n instanceof SVGGeometryElement) return peintureAuPoint(n, centre) !== null;
  if (n instanceof SVGElement && n.ownerSVGElement !== null) return true;
  const style = getComputedStyle(n);
  return (
    composantes(style.backgroundColor)[3] !== 0 ||
    style.backgroundImage !== 'none' ||
    porteTexte(n) ||
    (n instanceof HTMLElement && PSEUDOS.some((pseudo) => contenuTextuel(n, pseudo))) ||
    REMPLACES.has(n.localName)
  );
}

/** true quand la cible se voit dans la fenêtre, sinon la raison, en texte.
 *  Un élément : checkVisibility (display, visibility, opacité nulle,
 *  content-visibility), une boîte non vide qui tient dans la fenêtre, puis
 *  l'occlusion au centre de cette boîte. Les éléments présents au point se
 *  lisent pointer-events ignoré — un élément en pointer-events: none se voit,
 *  et un recouvrement en pointer-events: none cache ce qu'il couvre. Le centre
 *  doit atteindre l'élément ou l'un de ses descendants — un élément rogné par
 *  un ancêtre le laisse à un autre —, et aucun élément peint au-dessus ne doit
 *  y peindre (peintAuPoint) : une boîte de mise en page vide, une zone
 *  d'atteinte d'opacité nulle ne cachent rien. Un pseudo-élément : son hôte,
 *  puis son display, sa visibility et son content. */
export function visible(cible) {
  const { element, pseudo } = porteur(cible);
  if (pseudo !== null) {
    const hote = visible(element);
    if (hote !== true) return `hôte : ${hote}`;
    const style = getComputedStyle(element, pseudo);
    if (style.display === 'none') return `${pseudo} : display none`;
    if (style.visibility !== 'visible') return `${pseudo} : visibility ${style.visibility}`;
    if (!contenuTextuel(element, pseudo)) return `${pseudo} : content ${style.content}`;
    return true;
  }
  if (!element.checkVisibility({ opacityProperty: true, visibilityProperty: true })) {
    return 'checkVisibility faux';
  }
  const b = element.getBoundingClientRect();
  if (!(b.width > 0 && b.height > 0)) return `boîte vide : ${b.width} × ${b.height}`;
  if (b.left < 0 || b.top < 0 || b.right > innerWidth || b.bottom > innerHeight) {
    return `hors de la fenêtre ${innerWidth} × ${innerHeight} : boîte (${b.left}, ${b.top}) – (${b.right}, ${b.bottom})`;
  }
  const centre = centreDe(element);
  const atteints = elementsAuPoint(element.ownerDocument, centre, element);
  const rang = atteints.findIndex((n) => element.contains(n));
  if (rang === -1) return `le centre de sa boîte n'atteint pas ${designation(element)} : rogné, ou hors de son dessin`;
  const couvrant = atteints.slice(0, rang).find((n) => peintAuPoint(n, centre));
  if (couvrant !== undefined) return `le centre de sa boîte est couvert par ${designation(couvrant)}`;
  return true;
}

/** Pose data-theme ('clair'|'sombre') sur <html>, attend mesure(), puis rend
 *  à l'attribut sa valeur d'avant, ou son absence, même quand mesure lève :
 *  l'épreuve suivante part du même document. Rend la valeur de mesure. */
export async function sousTheme(theme, mesure) {
  const racine = document.documentElement;
  const avant = racine.getAttribute('data-theme');
  racine.setAttribute('data-theme', theme);
  try {
    return await mesure();
  } finally {
    if (avant === null) {
      racine.removeAttribute('data-theme');
    } else {
      racine.setAttribute('data-theme', avant);
    }
  }
}
