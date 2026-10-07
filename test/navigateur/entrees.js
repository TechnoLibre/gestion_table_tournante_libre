// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Entrées que Chromium traite comme réelles (§ 7.3), et le cadre d'affichage
// (§ 19.4). Les événements passent par le protocole de débogage de Chromium,
// Input.dispatch… sur la page qui porte le cadre de l'épreuve : ils
// traversent le test d'atteinte, la capture du pointeur et la conversion du
// toucher en pointeur comme ceux d'un périphérique, et portent isTrusted
// vrai. Un événement construit par new PointerEvent ne pose pas de capture.
//
// Les coordonnées reçues sont celles du cadre de l'épreuve — clientX et
// clientY de l'élément visé. CDP les attend dans la fenêtre de la page :
// chaque appel relit, d'un cadre à son parent, le rectangle du cadre et
// l'échelle qu'une transformation lui donne, et convertit au moment de
// l'envoi. Défiler la page de l'épreuve ne change rien : un point du cadre
// reste un point de sa fenêtre.
import { cdp, page } from 'vitest/browser';

// Boutons de la souris : le masque de buttons et le nom que CDP attend.
const BOUTONS = [
  [1, 'left'],
  [2, 'right'],
  [4, 'middle'],
];

const GENRES = { souris: 'mouse', stylet: 'pen' };

const TYPES_POINTEUR = { presser: 'mousePressed', bouger: 'mouseMoved', relacher: 'mouseReleased' };

const TYPES_TOUCHER = { presser: 'touchStart', bouger: 'touchMove', relacher: 'touchEnd', annuler: 'touchCancel' };

// Touches nommées : key, code et code de touche virtuelle ; text pour celles
// qui saisissent un caractère.
const TOUCHES = {
  Escape: { code: 'Escape', touche: 27 },
  Enter: { code: 'Enter', touche: 13, texte: '\r' },
  Tab: { code: 'Tab', touche: 9 },
  ' ': { code: 'Space', touche: 32, texte: ' ' },
  Backspace: { code: 'Backspace', touche: 8 },
  Delete: { code: 'Delete', touche: 46 },
  Home: { code: 'Home', touche: 36 },
  End: { code: 'End', touche: 35 },
  PageUp: { code: 'PageUp', touche: 33 },
  PageDown: { code: 'PageDown', touche: 34 },
  ArrowLeft: { code: 'ArrowLeft', touche: 37 },
  ArrowUp: { code: 'ArrowUp', touche: 38 },
  ArrowRight: { code: 'ArrowRight', touche: 39 },
  ArrowDown: { code: 'ArrowDown', touche: 40 },
};

// Boutons tenus enfoncés depuis le dernier presser, rendus par relacher.
let boutonsEnfonces = 0;

/** Point de la fenêtre de la page qui porte le cadre de l'épreuve, pour le
 *  point (x, y) de la fenêtre de ce cadre. D'un cadre à son parent : la
 *  boîte de l'<iframe> dans le parent, sa bordure et son retrait, et
 *  l'échelle que pose une transformation, rapport de la largeur rendue à la
 *  largeur de mise en page. */
function versPage(x, y) {
  let px = x;
  let py = y;
  for (let fenetre = window; fenetre !== fenetre.top; fenetre = fenetre.parent) {
    const cadre = fenetre.frameElement;
    const boite = cadre.getBoundingClientRect();
    const style = fenetre.parent.getComputedStyle(cadre);
    const echelle = cadre.offsetWidth > 0 ? boite.width / cadre.offsetWidth : 1;
    px = boite.left + (cadre.clientLeft + parseFloat(style.paddingLeft) + px) * echelle;
    py = boite.top + (cadre.clientTop + parseFloat(style.paddingTop) + py) * echelle;
  }
  return { x: px, y: py };
}

// Le bouton CDP d'un masque : le premier enfoncé, 'none' sans aucun.
function bouton(masque) {
  return BOUTONS.find(([bit]) => (masque & bit) !== 0)?.[1] ?? 'none';
}

/** Un événement de pointeur réel au point (x, y) du cadre. type : 'presser',
 *  'bouger' ou 'relacher'. boutons, le masque de buttons : par défaut, 1 au
 *  presser, les boutons tenus pour bouger et relacher. genre : 'souris' ou
 *  'stylet' ; le doigt passe par toucher. */
export async function pointer(type, x, y, { boutons, genre = 'souris' } = {}) {
  const typeCdp = TYPES_POINTEUR[type];
  if (typeCdp === undefined) throw new Error(`pointer : type inconnu « ${type} »`);
  const pointerType = GENRES[genre];
  if (pointerType === undefined) throw new Error(`pointer : genre inconnu « ${genre} »`);
  const masque = boutons ?? (type === 'presser' ? 1 : boutonsEnfonces);
  const { x: px, y: py } = versPage(x, y);
  const evenement = { type: typeCdp, x: px, y: py, pointerType, button: bouton(masque), buttons: masque };
  if (type === 'presser') {
    evenement.clickCount = 1;
    boutonsEnfonces = masque;
  } else if (type === 'relacher') {
    evenement.clickCount = 1;
    evenement.buttons = 0;
    boutonsEnfonces = 0;
  }
  await cdp().send('Input.dispatchMouseEvent', evenement);
}

/** Presse au point depuis, avance en pas mouvements égaux jusqu'au point vers,
 *  et relâche au point vers. Chaque envoi attend que Chromium ait traité
 *  l'événement : chaque pas livre son propre pointermove, que la page ne
 *  reçoit pas regroupé avec le suivant. */
export async function glisser(depuis, vers, { pas = 10 } = {}) {
  await pointer('presser', depuis.x, depuis.y);
  for (let i = 1; i <= pas; i += 1) {
    const t = i / pas;
    await pointer('bouger', depuis.x + (vers.x - depuis.x) * t, depuis.y + (vers.y - depuis.y) * t);
  }
  await pointer('relacher', vers.x, vers.y);
}

/** Un cran de molette au point (x, y) du cadre, deltaY en pixels. */
export async function molette(x, y, deltaY) {
  const { x: px, y: py } = versPage(x, y);
  await cdp().send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: px, y: py, deltaX: 0, deltaY });
}

/** Un événement tactile réel. type : 'presser', 'bouger', 'relacher' ou
 *  'annuler' ; points : [{x, y, id?}] dans le cadre. CDP veut au moins un
 *  point pour presser et bouger, aucun pour relacher et annuler, qui lèvent
 *  les doigts posés. */
export async function toucher(type, points) {
  const typeCdp = TYPES_TOUCHER[type];
  if (typeCdp === undefined) throw new Error(`toucher : type inconnu « ${type} »`);
  const levee = type === 'relacher' || type === 'annuler';
  if (levee !== (points.length === 0)) {
    throw new Error(`toucher : ${type} veut ${levee ? 'aucun point' : 'au moins un point'}, reçu ${points.length}`);
  }
  const touchPoints = points.map(({ x, y, id = 0 }) => ({ ...versPage(x, y), id }));
  await cdp().send('Input.dispatchTouchEvent', { type: typeCdp, touchPoints });
}

/** Presse puis relâche une touche nommée par sa valeur de key ('Escape',
 *  'Enter', 'ArrowDown'…) ou un caractère imprimable. Les événements vont au
 *  document qui a le focus. Une touche inconnue lève en la nommant. */
export async function touche(cle) {
  const connue = TOUCHES[cle];
  const caractere = connue === undefined && [...cle].length === 1;
  if (connue === undefined && !caractere) throw new Error(`touche inconnue : « ${cle} »`);
  const { code, touche: virtuelle, texte } = connue ?? { code: '', touche: 0, texte: cle };
  const commun = { key: cle, code, windowsVirtualKeyCode: virtuelle, nativeVirtualKeyCode: virtuelle };
  await cdp().send('Input.dispatchKeyEvent', {
    type: texte === undefined ? 'rawKeyDown' : 'keyDown',
    ...commun,
    ...(texte === undefined ? {} : { text: texte, unmodifiedText: texte }),
  });
  await cdp().send('Input.dispatchKeyEvent', { type: 'keyUp', ...commun });
}

// innerWidth et innerHeight du cadre. Les lire force la mise en page du
// parent : la taille que poser vient de donner à l'<iframe> s'y lit déjà.
function relire() {
  return { largeur: innerWidth, hauteur: innerHeight };
}

/** Pose le cadre d'affichage à largeur × hauteur (§ 19.4). poser(largeur,
 *  hauteur) le dimensionne — par défaut page.viewport de vitest/browser —,
 *  innerWidth et innerHeight se relisent, puis, s'ils s'écartent des valeurs
 *  visées, poser reçoit les valeurs visées augmentées de l'écart relevé, et
 *  le cadre se relit. Un écart restant lève en nommant les valeurs visées et
 *  obtenues. Rend { largeur, hauteur } relues. */
export async function fixerCadre(largeur, hauteur, { poser = (l, h) => page.viewport(l, h) } = {}) {
  await poser(largeur, hauteur);
  let lu = relire();
  if (lu.largeur !== largeur || lu.hauteur !== hauteur) {
    await poser(largeur + (largeur - lu.largeur), hauteur + (hauteur - lu.hauteur));
    lu = relire();
  }
  if (lu.largeur !== largeur || lu.hauteur !== hauteur) {
    throw new Error(
      `cadre visé ${largeur} × ${hauteur}, obtenu ${lu.largeur} × ${lu.hauteur} (innerWidth × innerHeight)`,
    );
  }
  return lu;
}
