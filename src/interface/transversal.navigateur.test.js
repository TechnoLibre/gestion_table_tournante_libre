// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le rendu transversal, sur chaque écran de l'itération (§ 14.5, § 14.6,
// § 19.11, § 12.7, § 7.6, § 13.1, § 2, § 19.2, § 8.4, § 18.6) : langue
// témoin, erreurs par leur libellé, contrastes et marques dans les deux
// thèmes, aucune atténuation, jamais la seule couleur, teinte réservée, aucun
// emoji, balisage littéral, bandeau, formulaires, transitions annulées.
//
// Un parcours unique, en langue témoin, au cadre de 1 366 × 700, atteint
// chaque écran de test/navigateur/ecrans.js et y fait ses relevés, une fois
// dans le thème clair, puis dans le sombre que pose le réglage du bandeau ;
// chaque garde lit ensuite les relevés de tous les écrans et échoue en
// listant chaque faute, écran et élément nommés, en un seul message. Un
// relevé lit le rendu — style calculé, boîte, élément qu'atteint un point —,
// jamais une classe (§ 14.2). Chaque garde affirme un ensemble mesuré non
// vide avant de juger, et s'éprouve d'abord sur un fragment d'épreuve bâti
// ici, où elle doit relever la faute qu'on y a mise.
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { TABLES_APPLICATION } from '../application/libelles.js';
import { nomAffiche } from '../application/personnes.js';
import { etatPlaces } from '../application/places.js';
import { MARQUE_TEMOIN, creerTraduction } from '../application/traduction.js';
import { decoder } from '../csv/encodage.js';
import { CATALOGUE } from '../demo/catalogue.js';
import { decouper } from '../csv/lecture.js';
import { analyser } from '../stockage/document.js';
import { lireJournal } from '../stockage/journal.js';
import { SUFFIXES } from '../stockage/noms.js';
import { VERSION } from '../version.genere.js';
import INDEX from '../../index.html?raw';
import {
  ECRANS,
  NOM_CAS_LIMITES,
  attendre,
  centre,
  chargePrincipale,
  cliquer,
  creerContexte,
  octetsCasLimites,
  ouvrirEvenement,
} from '../../test/navigateur/ecrans.js';
import { fixerCadre, pointer } from '../../test/navigateur/entrees.js';
import {
  attenuations,
  composantes,
  contraste,
  couleurTexte,
  couleursPeintes,
  designation,
  fondPeintSous,
  porteursDeTexte,
  visible,
} from '../../test/navigateur/rendu.js';
import { provenanceVisible } from './apropos.js';
import { TABLES_INTERFACE } from './libelles.js';
import { MARQUES } from './marques.js';

const { t: tTemoin } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE], { langue: 'temoin' });
const { ouverture: OUVERTURE, fermeture: FERMETURE } = MARQUE_TEMOIN;
const PROVENANCE = 'test';
const THEMES = ['clair', 'sombre'];

// Seuils du § 14.5.
const SEUIL_TEXTE = 4.5;
const SEUIL_MARQUE = 3;

// Attributs annoncés : lus par l'accessibilité, ils sont du texte visible
// au sens du § 14.6 (contrainte 7).
const ATTRIBUTS_ANNONCES = ['aria-label', 'aria-roledescription', 'aria-description', 'aria-valuetext', 'title', 'placeholder', 'alt'];

// Éléments dont le texte ne se peint jamais.
const TEXTES_NON_PEINTS = new Set(['script', 'style', 'template', 'noscript', 'title', 'desc', 'metadata']);

// Conteneurs SVG qui ne peignent qu'à travers une référence.
const CONTENEURS_DE_REFERENCE = 'defs, pattern, clipPath, mask, marker, symbol, linearGradient, radialGradient';

// Les marques que la teinte du conflit peint seules (§ 12.7, § 7.5).
const MARQUES_DU_CONFLIT = new Set(['contourConflit', 'trameConflit']);

const PICTOGRAPHIQUE = /\p{Extended_Pictographic}/u;
const LETTRE = /\p{L}/u;

// Une couleur en texte, pour un message.
const rgb = (c) => `rgb(${c.slice(0, 3).join(', ')}${c[3] === 1 ? '' : `, ${c[3]}`})`;
const egales = (a, b) => a.join() === b.join();
const extrait = (texte) => {
  const plat = texte.replace(/\s+/g, ' ').trim();
  return plat.length > 60 ? `${plat.slice(0, 57)}…` : plat;
};
const rendu = (element) => element.checkVisibility({ visibilityProperty: true, opacityProperty: true });

// Les conteneurs désignés qui situent un élément dans son écran.
const REPERES = '[data-liste], [data-siege], [data-table], [data-pastille], [data-panneau], [data-menu], [data-section], [data-ecran], [data-bandeau]';

// Le nom d'un élément, suivi de celui du plus proche conteneur désigné qui
// le porte : un tspan se situe par sa liste, une pastille par sa table.
function situer(element) {
  const repere = element.parentElement?.closest(REPERES) ?? null;
  return repere === null ? designation(element) : `${designation(element)} dans ${designation(repere)}`;
}

// --- Les données connues de l'épreuve ------------------------------------------

/**
 * Ce qu'un écran peut montrer sans la marque de la langue témoin, parce que
 * c'est une donnée (§ 14.6, « La traduction ») : noms, prénoms, noms
 * affichés, appartenances, courriels, titres et notes des personnes, nom et
 * base des événements du disque, libellés des titres, libellés figés du
 * journal, version, provenance, identifiant et instant d'un verrou, cellules
 * du CSV servi, nom de chaque démonstration du catalogue — le nom que
 * l'événement chargé porte, que l'accueil reçoit comme une donnée — ; un
 * chemin sous une racine du système simulé.
 * → { valeurs: string[], racines: string[] }, valeurs de la plus longue à la
 * plus courte.
 */
async function donneesConnues(contexte, { cellules = [] } = {}) {
  const valeurs = new Set([VERSION.affichee, VERSION.windows, PROVENANCE, ...CATALOGUE.map(({ nom }) => nom), ...cellules]);
  const racines = new Set();
  const personne = (p) => {
    for (const v of [p.nom, p.prenom, p.appartenance, p.courriel, p.titrePressenti, p.notes]) if (v) valeurs.add(v);
    if (p.nom) valeurs.add(nomAffiche(p));
  };
  for (const m of contexte.montages) {
    const etat = m.seance.etat();
    if (etat.evenement !== null) {
      valeurs.add(etat.evenement.nom);
      valeurs.add(etat.evenement.base);
    }
    for (const p of etat.charge?.participants ?? []) personne(p);
    for (const titre of etat.charge?.titres ?? []) valeurs.add(titre.libelle);
    if (etat.verrouAutre !== null) for (const v of [etat.verrouAutre.seance, etat.verrouAutre.depuis]) if (v) valeurs.add(v);
    for (const racine of Object.values(await m.fs.racines())) if (racine?.chemin) racines.add(racine.chemin);
    // Le disque simulé range ses nœuds sous une clé repliée ; nom garde le
    // nom du fichier tel qu'il s'écrit.
    for (const noeud of m.disque.values()) {
      if (noeud?.type !== 'fichier' || typeof noeud.texte !== 'string') continue;
      if (noeud.nom.endsWith(SUFFIXES.etat)) {
        try {
          const { charge } = analyser(noeud.texte);
          valeurs.add(charge.evenement.nom);
          for (const p of charge.participants) personne(p);
          for (const titre of charge.titres) valeurs.add(titre.libelle);
        } catch {
          // Un état illisible ne porte aucune donnée affichée.
        }
      }
      if (noeud.nom.endsWith(SUFFIXES.journal)) {
        const journal = lireJournal(noeud.texte);
        for (const ligne of [...(journal.entrees ?? []), ...(journal.jalons ?? [])]) {
          for (const v of [ligne.libelle, ligne.nom]) if (typeof v === 'string') valeurs.add(v);
        }
      }
    }
  }
  return {
    valeurs: [...valeurs]
      .filter((v) => typeof v === 'string' && v.trim().length > 1)
      .map((v) => v.replace(/\s+/g, ' ').trim())
      .sort((a, b) => b.length - a.length),
    racines: [...racines],
  };
}

/** Le nom du CSV des cas limites et ses cellules, telles que la découpe
 *  les rend. */
async function cellulesCasLimites() {
  const { texte } = decoder(await octetsCasLimites());
  return [NOM_CAS_LIMITES, ...decouper(texte, ';').enregistrements.flat().map((c) => c.trim()).filter((c) => c !== '')];
}

// --- La langue témoin et les emoji ---------------------------------------------

/**
 * Les textes affichés sous racine : chaque nœud de texte rendu, chaque
 * attribut annoncé d'un élément rendu, le content textuel de chaque
 * ::before et ::after. → [{ ou, texte }], ou nommant le porteur.
 */
export function textesAffiches(racine) {
  const textes = [];
  const marcheur = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
  for (let noeud = marcheur.nextNode(); noeud !== null; noeud = marcheur.nextNode()) {
    const parent = noeud.parentElement;
    if (parent === null || TEXTES_NON_PEINTS.has(parent.localName) || parent.closest('svg title, svg desc') !== null) continue;
    if (noeud.textContent.trim() === '' || !rendu(parent)) continue;
    textes.push({ ou: designation(parent), texte: noeud.textContent });
  }
  for (const element of [racine, ...racine.querySelectorAll('*')]) {
    if (!rendu(element)) continue;
    for (const nom of ATTRIBUTS_ANNONCES) {
      const valeur = element.getAttribute(nom);
      if (valeur !== null && valeur.trim() !== '') textes.push({ ou: `${designation(element)}[${nom}]`, texte: valeur });
    }
    if (!(element instanceof HTMLElement)) continue;
    for (const pseudo of ['::before', '::after']) {
      const contenu = getComputedStyle(element, pseudo).content;
      const litteral = /^"((?:[^"\\]|\\.)*)"$/.exec(contenu);
      if (litteral !== null && litteral[1].trim() !== '') textes.push({ ou: `${designation(element)}${pseudo}`, texte: litteral[1] });
      else if (contenu !== 'none' && contenu !== 'normal' && litteral === null) textes.push({ ou: `${designation(element)}${pseudo}`, texte: contenu });
    }
  }
  return textes;
}

const MARQUE_ENTIERE = new RegExp(`${OUVERTURE}[^${OUVERTURE}${FERMETURE}]*${FERMETURE}`, 'gu');

/** Les morceaux d'un texte hors de toute paire de marques de la langue
 *  témoin, imbrications comprises, qui portent une lettre ou une marque
 *  orpheline. */
export function horsMarques(texte) {
  let reste = texte;
  for (let avant = null; avant !== reste; ) {
    avant = reste;
    reste = reste.replace(MARQUE_ENTIERE, '\u{0}');
  }
  return reste
    .split('\u{0}')
    .map((morceau) => morceau.replace(/\s+/g, ' ').trim())
    .filter((morceau) => LETTRE.test(morceau) || morceau.includes(OUVERTURE) || morceau.includes(FERMETURE));
}

/** Le morceau n'est-il fait que de données connues ? Un chemin sous une
 *  racine en est une ; sinon, chaque donnée connue retirée, il ne reste
 *  aucune lettre. */
export function estDonnee(morceau, connues) {
  if (connues.racines.some((racine) => morceau.startsWith(racine))) return true;
  let reste = morceau;
  for (const valeur of connues.valeurs) reste = reste.split(valeur).join(' ');
  return !LETTRE.test(reste) && !reste.includes(OUVERTURE) && !reste.includes(FERMETURE);
}

/** Fautes de la langue témoin sous racine, et dans titre quand il est
 *  donné : chaque morceau hors marques qui n'est pas une donnée connue. */
export function fautesTemoin(racine, connues, { titre = null } = {}) {
  const textes = textesAffiches(racine);
  if (titre !== null) textes.push({ ou: 'document.title', texte: titre });
  const fautes = [];
  for (const { ou, texte } of textes) {
    for (const morceau of horsMarques(texte)) {
      if (!estDonnee(morceau, connues)) fautes.push(`${ou} : « ${extrait(morceau)} »`);
    }
  }
  return { fautes, lus: textes.length };
}

/** Fautes d'emoji sous racine (§ 7.6) : un point de code
 *  Extended_Pictographic dans un texte affiché. → { fautes, lus }, lus le
 *  nombre de textes affichés lus. */
export function fautesEmoji(racine, { titre = null } = {}) {
  const textes = textesAffiches(racine);
  if (titre !== null) textes.push({ ou: 'document.title', texte: titre });
  const fautes = textes.filter(({ texte }) => PICTOGRAPHIQUE.test(texte)).map(({ ou, texte }) => `${ou} : « ${extrait(texte)} »`);
  return { fautes, lus: textes.length };
}

// --- Les contrastes des textes et les atténuations --------------------------------

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
const CHAMPS = 'input:not([type="radio"]):not([type="checkbox"]):not([type="file"]):not([type="hidden"]), select, textarea';

/**
 * Contrastes des textes rendus sous racine (§ 14.5) : chaque porteur de
 * texte et chaque champ de saisie, son texte indicatif compris, sur le fond
 * peint dessous ; un texte SVG par son fill sur la forme dessous. Un porteur
 * que l'œil ne voit pas — couvert, rogné, de boîte vide — n'est pas mesuré.
 * → { fautes, attenuations, couleurs: Map(clé → couleurs), mesures }
 */
export function releverTextes(racine) {
  const fautes = [];
  const fautesAttenuation = [];
  const couleurs = new Map();
  let mesures = 0;
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
      if (ratio < SEUIL_TEXTE) fautes.push(`${nom} : ${ratio.toFixed(2)}:1, ${rgb(couleur)} sur ${rgb(fond)}`);
    } catch (erreur) {
      fautes.push(`${nom} : ${erreur.message}`);
    }
    couleurs.set(cle, `${rgb(couleur)} sur ${fonds.map(rgb).join(' + ')}`);
    for (const a of attenuations(cible)) fautesAttenuation.push(`${nom} : ${designation(a)} ${a.propriete}: ${a.valeur}`);
  };
  for (const [rang, porteur] of porteursDeTexte(racine).entries()) {
    const { element } = porteur;
    if (!rendu(element)) continue;
    const b = element.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) continue;
    amener(element);
    const svg = element instanceof SVGElement;
    if (!svg && visible(porteur) !== true) continue;
    // Un texte SVG se lit par la géométrie du dessin, non par l'atteinte
    // d'un point : son centre doit tomber dans le <svg> extérieur, qui rogne
    // ce qui le déborde, et dans la fenêtre.
    if (svg && !centreDansLeDessin(element)) continue;
    const texte = porteur.pseudo === null ? [...element.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('') : '';
    const nom = `${situer(element)}${porteur.pseudo ?? ''} « ${extrait(texte)} »`;
    mesurer(`${rang}:${designation(porteur)}`, nom, () => couleurTexte(porteur), () => fondPeintSous(porteur), porteur);
  }
  for (const [rang, champ] of [...racine.querySelectorAll(CHAMPS)].entries()) {
    if (!rendu(champ)) continue;
    amener(champ);
    if (visible(champ) !== true) continue;
    const nom = designation(champ);
    mesurer(`champ ${rang}:${nom}`, `${nom} (valeur)`, () => composantes(getComputedStyle(champ).color), () => fondPeintSous(champ), champ);
    if ((champ.getAttribute('placeholder') ?? '') !== '') {
      mesurer(`indicatif ${rang}:${nom}`, `${nom}::placeholder`, () => composantes(getComputedStyle(champ, '::placeholder').color), () => fondPeintSous(champ), champ);
    }
  }
  return { fautes, attenuations: fautesAttenuation, couleurs, mesures };
}

// --- Les marques -------------------------------------------------------------------

/** La couleur résolue d'un jeton dans le thème courant. */
export function couleurDeJeton(jeton) {
  const sonde = document.createElement('span');
  sonde.style.color = `var(${jeton})`;
  document.body.append(sonde);
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
function bordsPeints(style) {
  return ['top', 'right', 'bottom', 'left']
    .filter((cote) => style.getPropertyValue(`border-${cote}-style`) !== 'none' && parseFloat(style.getPropertyValue(`border-${cote}-width`)) > 0)
    .map((cote) => composantes(style.getPropertyValue(`border-${cote}-color`)));
}

/**
 * Ce qu'une marque peint de son jeton, et ce qui l'entoure : { peinture,
 * voisins }. Une forme SVG : son remplissage — une trame se mesure contre
 * les autres couleurs de son motif, un aplat contre ce qui est peint dessous
 * en un point qu'il couvre — ou son trait, contre ce qui est dessous en un
 * point du trait et contre son propre remplissage. Un élément HTML : sa
 * bordure ou son fond, contre ce qui est peint sous son parent, et son fond
 * propre pour une bordure. peinture null : le jeton n'est peint nulle part.
 */
function voisinage(element, jeton) {
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
 * atténuation. → { vues: string[], fautes, attenuations, mesures }
 */
export function releverMarques(racine) {
  const vues = new Set();
  const fautes = [];
  const fautesAttenuation = [];
  let mesures = 0;
  for (const element of racine.querySelectorAll('[data-marque]')) {
    if (!rendu(element)) continue;
    const nom = element.dataset.marque;
    const entree = MARQUES.find((m) => m.nom === nom);
    if (entree === undefined) {
      fautes.push(`${situer(element)} : marque hors du registre MARQUES`);
      continue;
    }
    vues.add(nom);
    for (const a of attenuations(element)) fautesAttenuation.push(`${situer(element)} : ${designation(a)} ${a.propriete}: ${a.valeur}`);
    // Sous une fenêtre modale, la page est inerte et le test d'atteinte
    // rencontre la fenêtre d'abord : une marque HTML de la page ne s'y
    // mesure pas, comme ses textes, et se mesure sur les écrans sans
    // fenêtre. Le dessin SVG, lu par sa géométrie, se mesure partout.
    const modale = document.querySelector('dialog:modal');
    if (modale !== null && !(element instanceof SVGElement) && !modale.contains(element)) continue;
    amener(element);
    const jeton = couleurDeJeton(entree.jeton);
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
      if (ratio < SEUIL_MARQUE) fautes.push(`${situer(element)} (${peinture}) : ${ratio.toFixed(2)}:1, ${rgb(jeton)} contre ${rgb(fond)}`);
    } catch (erreur) {
      fautes.push(`${situer(element)} : ${erreur.message}`);
    }
  }
  return { vues: [...vues], fautes, attenuations: fautesAttenuation, mesures };
}

// --- Les listes de noms et les tables -----------------------------------------------

// Les marques de désignation passagère que le clavier et le pointeur posent
// autour d'une table ou d'une chaise : elles ne sont pas la table.
const DESIGNATIONS = new Set(['focus', 'selection', 'miseEnEvidence']);

// Côté de la grille de points qui couvre l'intersection de deux boîtes.
const COTE_GRILLE = 7;

// La boîte à l'écran d'une forme SVG, son trait compris : la boîte que rend
// getBoundingClientRect ne compte que la géométrie, et s'élargit ici de
// l'épaisseur entière du trait, à l'échelle de la forme, au moins un pixel.
function boiteAvecTrait(forme) {
  const b = forme.getBoundingClientRect();
  const m = forme.getScreenCTM();
  const marge = (parseFloat(getComputedStyle(forme).strokeWidth) || 0) * Math.max(1, Math.hypot(m.a, m.b)) + 1;
  return { left: b.left - marge, top: b.top - marge, right: b.right + marge, bottom: b.bottom + marge };
}

// La forme couvre-t-elle un point de la grille qui pave le rectangle de la
// fenêtre, bords compris ? Le point passe dans le repère propre de la forme ;
// isPointInFill et isPointInStroke lisent sa géométrie, non sa peinture :
// l'intérieur d'une chaise sans remplissage compte.
function couvreUnPoint(forme, { left, top, right, bottom }) {
  const versForme = forme.getScreenCTM().inverse();
  for (let i = 0; i < COTE_GRILLE; i += 1) {
    for (let j = 0; j < COTE_GRILLE; j += 1) {
      const ecran = new DOMPoint(left + ((right - left) * i) / (COTE_GRILLE - 1), top + ((bottom - top) * j) / (COTE_GRILLE - 1));
      const point = ecran.matrixTransform(versForme);
      if (forme.isPointInFill(point) || forme.isPointInStroke(point)) return true;
    }
  }
  return false;
}

/**
 * Les listes de noms posées sur une table (§ 7.4) : chaque partie rendue
 * d'une ligne de [data-liste], par sa boîte à l'écran entière, contre
 * chaque forme marquée sous un [data-table] — emprise, plateau, trame, gel,
 * chaise et ses marques —, hors désignations passagères. Une partie est
 * posée sur une forme quand un point de la grille qui pave l'intersection
 * de leurs boîtes tombe dans la forme : le coin d'une boîte qui frôle un
 * cercle ne compte pas, un texte qui le traverse loin de son centre compte.
 * → { fautes, lues }, lues le nombre de parties lues.
 */
export function releverListes(racine) {
  const formes = [...racine.querySelectorAll('[data-table] [data-marque]')]
    .filter((f) => f instanceof SVGGeometryElement && !DESIGNATIONS.has(f.dataset.marque) && rendu(f))
    .map((forme) => ({ forme, boite: boiteAvecTrait(forme) }));
  const fautes = [];
  let lues = 0;
  for (const partie of racine.querySelectorAll('[data-liste] tspan[data-partie]')) {
    if (!rendu(partie) || partie.textContent.trim() === '') continue;
    const b = partie.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) continue;
    lues += 1;
    const sous = new Set();
    for (const { forme, boite } of formes) {
      const commune = { left: Math.max(b.left, boite.left), top: Math.max(b.top, boite.top), right: Math.min(b.right, boite.right), bottom: Math.min(b.bottom, boite.bottom) };
      if (commune.left > commune.right || commune.top > commune.bottom) continue;
      if (couvreUnPoint(forme, commune)) sous.add(situer(forme));
    }
    for (const forme of sous) fautes.push(`${situer(partie)} « ${extrait(partie.textContent)} » sur ${forme}`);
  }
  return { fautes, lues };
}

// --- La teinte réservée --------------------------------------------------------------

// Un élément HTML porte-t-il lui-même un nœud de texte non vide ?
const porteTexte = (element) => [...element.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim() !== '');

// Les peintures d'un élément : [{ propriete, couleurs }]. Une forme ou un
// texte SVG : fill et stroke, un motif par ses couleurs ; un élément HTML ou
// un <svg> extérieur : sa couleur de texte quand il en porte, son fond, ses
// bords, son contour, son soulignement, et ceux de ses pseudo-éléments à
// content.
function peinturesDe(element) {
  if (element instanceof SVGGeometryElement || element instanceof SVGTextContentElement) {
    const style = getComputedStyle(element);
    const { fill, stroke } = couleursPeintes(element);
    return [
      { propriete: 'fill', couleurs: fill },
      { propriete: 'stroke', couleurs: parseFloat(style.strokeWidth) > 0 ? stroke : [] },
    ];
  }
  if (element instanceof SVGElement && element.ownerSVGElement !== null) return [];
  const peintures = [];
  const lire = (style, suffixe, texte) => {
    if (texte) peintures.push({ propriete: `color${suffixe}`, couleurs: [composantes(style.color)] });
    const fond = composantes(style.backgroundColor);
    if (fond[3] > 0) peintures.push({ propriete: `background-color${suffixe}`, couleurs: [fond] });
    peintures.push({ propriete: `border-color${suffixe}`, couleurs: bordsPeints(style) });
    if (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) {
      peintures.push({ propriete: `outline-color${suffixe}`, couleurs: [composantes(style.outlineColor)] });
    }
    if (texte && style.textDecorationLine !== 'none') {
      peintures.push({ propriete: `text-decoration-color${suffixe}`, couleurs: [composantes(style.textDecorationColor)] });
    }
  };
  lire(getComputedStyle(element), '', porteTexte(element) || element.matches(CHAMPS));
  for (const pseudo of ['::before', '::after']) {
    const style = getComputedStyle(element, pseudo);
    if (style.content !== 'none' && style.content !== 'normal') lire(style, pseudo, true);
  }
  return peintures;
}

/** Fautes de la teinte réservée sous racine (§ 12.7, § 7.5) : un élément
 *  rendu qui peint la couleur de conflit sans être une marque de conflit.
 *  → { fautes, lus }, lus le nombre d'éléments rendus, hors marques de
 *  conflit, qui peignent au moins une couleur. */
export function fautesTeinte(racine, conflit) {
  const fautes = [];
  let lus = 0;
  for (const element of [racine, ...racine.querySelectorAll('*')]) {
    if (element.closest(CONTENEURS_DE_REFERENCE) !== null || !rendu(element)) continue;
    if (MARQUES_DU_CONFLIT.has(element.dataset?.marque)) continue;
    const peintures = peinturesDe(element);
    if (peintures.some(({ couleurs }) => couleurs.length > 0)) lus += 1;
    for (const { propriete, couleurs } of peintures) {
      if (couleurs.some((c) => egales(c, conflit))) fautes.push(`${situer(element)} : ${propriete} ${rgb(conflit)}`);
    }
  }
  return { fautes, lus };
}

// --- Jamais la seule couleur ------------------------------------------------------------

/**
 * La signature non chromatique d'un état : pour chaque élément rendu des
 * racines, hors des conteneurs de référence, sa balise, l'épaisseur et les
 * tirets de son trait, la sorte de son remplissage (aplat ou motif), le
 * style et l'épaisseur de ses bords, et son texte propre. Aucune couleur,
 * aucun attribut data-… : deux états qui ne diffèrent que par la couleur
 * ont la même signature.
 */
export function signature(racines) {
  const parties = [];
  for (const racine of racines) {
    for (const n of [racine, ...racine.querySelectorAll('*')]) {
      if (n.closest(CONTENEURS_DE_REFERENCE) !== null || !rendu(n)) continue;
      const s = getComputedStyle(n);
      const svg = n instanceof SVGElement;
      const texte = [...n.childNodes].filter((c) => c.nodeType === Node.TEXT_NODE).map((c) => c.textContent.trim()).join(' ');
      parties.push(
        [
          n.localName,
          svg && s.stroke !== 'none' ? `trait ${s.strokeWidth} ${s.strokeDasharray}` : '',
          svg ? `remplissage ${s.fill === 'none' ? 'aucun' : /^url\(/.test(s.fill) ? 'motif' : 'aplat'}` : '',
          svg ? '' : `bords ${s.borderTopStyle} ${s.borderTopWidth}`,
          texte,
        ].join('|'),
      );
    }
  }
  return parties.join(' ; ');
}

// Les états du plan montré : tables saines et en conflit, places libres,
// réservées et à titre non pourvu, portées tour et tous, chacun par sa
// signature, classé par l'état des places que l'application calcule.
function releverEtats(m) {
  const racine = m.racine;
  const etats = { saine: [], conflit: [], libre: [], reservee: [], nonPourvu: [], tour: [], tous: [] };
  const charge = m.seance.etat().charge;
  if (charge === null || racine.querySelector('[data-plan]') === null) return etats;
  const { tour, proposition } = m.ui.etat();
  for (const table of etatPlaces(charge, { tour, proposition }).tables) {
    const groupe = racine.querySelector(`[data-table="${table.id}"]`);
    if (groupe === null) continue;
    const propres = [...groupe.children].filter((n) => !n.hasAttribute('data-siege'));
    const pastille = racine.querySelector(`[data-pastille="${table.id}"]`);
    const sig = signature([...propres, ...(pastille === null ? [] : [pastille])]);
    etats[(table.conflits?.nombre ?? 0) > 0 ? 'conflit' : 'saine'].push({ ou: `table ${table.id}`, sig });
    for (const place of table.chaises) {
      const element = racine.querySelector(`[data-siege="${table.id}:${place.siege}"]`);
      if (element === null) continue;
      const entree = { ou: `place ${table.id}:${place.siege}`, sig: signature([element]) };
      if (place.reservation !== null) {
        etats.reservee.push(entree);
        etats[place.reservation.portee].push(entree);
      } else if (place.titre !== null && !place.titre.pourvu) etats.nonPourvu.push(entree);
      else if (place.titre === null) etats.libre.push(entree);
    }
  }
  return etats;
}

// Le cadre de mode : sa signature, son libellé compris.
function signatureCadre(racine) {
  const cadre = racine.querySelector('[data-mode]');
  if (cadre === null) return null;
  const s = getComputedStyle(cadre);
  const libelle = racine.querySelector('[data-mode-libelle="cadre"]')?.textContent.trim() ?? '';
  return `bords ${s.borderTopStyle} ${s.borderTopWidth} | ${libelle}`;
}

/** Fautes d'une paire d'états : chaque élément du premier dont la signature
 *  égale celle d'un élément du second ; une paire absente est une faute. */
export function fautesPaire(nom, premiers, seconds) {
  if (premiers.length === 0 || seconds.length === 0) return [`${nom} : paire absente (${premiers.length} et ${seconds.length})`];
  const fautes = [];
  for (const a of premiers) {
    for (const b of seconds) if (a.sig === b.sig) fautes.push(`${nom} : ${a.ou} et ${b.ou} ne diffèrent que par la couleur`);
  }
  return fautes;
}

// --- Le bandeau et les formulaires ------------------------------------------------------

// true quand un élément est rendu, de boîte non vide, dans la fenêtre ;
// sinon la raison.
function dansLaFenetre(element) {
  if (!rendu(element)) return 'non rendu';
  const b = element.getBoundingClientRect();
  if (!(b.width > 0 && b.height > 0)) return `boîte vide : ${b.width} × ${b.height}`;
  if (b.left < 0 || b.top < 0 || b.right > innerWidth || b.bottom > innerHeight) return 'hors de la fenêtre';
  return true;
}

/** Fautes du bandeau d'un écran (§ 8.4, § 18.6) : unique, visible, portant
 *  la version et la provenance ; le libellé de mode absent sans événement,
 *  présent et égal à celui du cadre sinon. */
export function fautesBandeau(racine, mode, { version = VERSION.affichee, provenance = provenanceVisible(PROVENANCE, tTemoin) } = {}) {
  const bandeaux = racine.querySelectorAll('[data-bandeau]');
  if (bandeaux.length !== 1) return [`${bandeaux.length} bandeaux`];
  const bandeau = bandeaux[0];
  const fautes = [];
  // Une fenêtre modale rend la page inerte, et le test d'atteinte la
  // traverse : sous elle, à fond de recouvrement transparent, le bandeau se
  // juge rendu et dans la fenêtre.
  const voir = document.querySelector('dialog:modal') === null ? visible : dansLaFenetre;
  const vu = voir(bandeau);
  if (vu !== true) fautes.push(`bandeau non visible : ${vu}`);
  if (!bandeau.textContent.includes(version)) fautes.push(`la version ${version} manque au bandeau`);
  if (!bandeau.textContent.includes(provenance)) fautes.push(`la provenance « ${provenance} » manque au bandeau`);
  const libelle = bandeau.querySelector('[data-mode-libelle="bandeau"]');
  if (mode === null) {
    if (libelle !== null) fautes.push(`libellé de mode « ${libelle.textContent.trim()} » sans événement ouvert`);
    return fautes;
  }
  const cadre = racine.querySelector('[data-mode-libelle="cadre"]');
  if (libelle === null) fautes.push(`libellé de mode absent du bandeau (${mode})`);
  else if (voir(libelle) !== true) fautes.push(`libellé de mode du bandeau non visible : ${voir(libelle)}`);
  if (cadre === null) fautes.push(`libellé de mode absent du cadre (${mode})`);
  if (libelle !== null && cadre !== null && libelle.textContent.trim() !== cadre.textContent.trim()) {
    fautes.push(`bandeau « ${libelle.textContent.trim()} », cadre « ${cadre.textContent.trim()} »`);
  }
  return fautes;
}

/** Fautes des formulaires sous racine (§ 2, § 14.10) : un <form> sans
 *  novalidate, un input[type=file] rendu. → { fautes, formulaires },
 *  formulaires le nombre de <form> lus. */
export function fautesFormulaires(racine) {
  const fautes = [];
  const formulaires = racine.querySelectorAll('form');
  for (const form of formulaires) if (!form.noValidate) fautes.push(`${designation(form)} sans novalidate`);
  for (const champ of racine.querySelectorAll('input[type="file"]')) if (rendu(champ)) fautes.push(`${designation(champ)} visible`);
  return { fautes, formulaires: formulaires.length };
}

// --- Le parcours et ses relevés ----------------------------------------------------------

// Les messages de refus d'un écran, et les motifs des lignes refusées d'un
// aperçu d'import : { code, texte, debloquer }.
function releverRefus(racine) {
  const refus = [...racine.querySelectorAll('[data-refus]')]
    .filter(rendu)
    .map((element) => ({
      code: element.dataset.refus,
      texte: element.querySelector(':scope > p')?.textContent ?? element.textContent,
      debloquer: element.querySelector('[data-commande="debloquer"]')?.textContent ?? null,
    }));
  for (const motif of racine.querySelectorAll('[data-refusees] [data-motif]')) {
    refus.push({ code: 'LIGNE_CSV', texte: motif.textContent, debloquer: null });
  }
  return refus;
}

// Relève, dans le thème courant, ce que chaque garde lit d'un écran.
function releverTheme(racine) {
  try {
    const textes = releverTextes(racine);
    const marques = releverMarques(racine);
    return { textes, marques, teinte: fautesTeinte(racine, couleurDeJeton('--couleur-conflit')) };
  } finally {
    window.scrollTo(0, 0);
  }
}

const releves = [];

beforeAll(async () => {
  await fixerCadre(1366, 700);
  const cellules = await cellulesCasLimites();
  for (const ecran of ECRANS) {
    const contexte = creerContexte({ langue: 'temoin', theme: 'clair' });
    const releve = { nom: ecran.nom, mode: ecran.mode, echec: null };
    releves.push(releve);
    try {
      const racine = await ecran.atteindre(contexte);
      const m = contexte.montage;
      const connues = await donneesConnues(contexte, { cellules: ecran.nom.startsWith('import.') ? cellules : [] });
      releve.temoin = fautesTemoin(racine, connues, { titre: document.title });
      releve.emoji = fautesEmoji(racine, { titre: document.title });
      releve.bandeau = fautesBandeau(racine, ecran.mode);
      releve.formulaires = fautesFormulaires(racine);
      releve.refus = releverRefus(racine).map((r) => ({ ...r, restes: horsMarques(r.texte).filter((x) => !estDonnee(x, connues)) }));
      releve.etats = releverEtats(m);
      releve.listes = releverListes(racine);
      releve.cadre = signatureCadre(racine);
      releve.clair = releverTheme(racine);
      await cliquer(m, '[data-bandeau] [data-commande="theme"][data-theme-choix="sombre"]');
      await attendre('le thème sombre', () => document.documentElement.getAttribute('data-theme') === 'sombre');
      releve.sombre = releverTheme(racine);
      releve.erreurs = contexte.erreurs();
    } catch (erreur) {
      releve.echec = erreur.message;
    } finally {
      await contexte.defaire();
    }
  }
}, 900_000);

afterAll(async () => {
  await fixerCadre(1366, 700);
});

// Les relevés des écrans atteints.
const atteints = () => releves.filter((r) => r.echec === null);

// Échoue en listant chaque faute, une par ligne.
function aucuneFaute(fautes, quoi) {
  expect(fautes, `${quoi} — ${fautes.length} faute(s) :\n${fautes.join('\n')}`).toEqual([]);
}

// --- Les gardes, éprouvées sur un fragment d'épreuve -----------------------------------

// Pose un fragment dans le corps du document, le temps d'une lecture.
function avecFragment(html, lire) {
  const conteneur = document.createElement('div');
  conteneur.innerHTML = html;
  document.body.append(conteneur);
  try {
    return lire(conteneur);
  } finally {
    conteneur.remove();
  }
}

describe('les gardes relèvent la faute qu’un fragment porte (§ 14.2)', () => {
  test('langue témoin : un mot écrit dans le gabarit, un attribut annoncé et le rendu d’un module .js qui contourne la table sont relevés ; une donnée connue et un texte marqué passent', () => {
    const connues = { valeurs: ['Iris Ombrelle'], racines: ['C:\\Documents'] };
    // Ce que rendrait un module de présentation qui composerait son texte
    // sans la table de traduction.
    const etiquette = (numero) => `Table ${numero}`;
    const { fautes, lus } = avecFragment(
      `<p>${OUVERTURE}Libellé${FERMETURE}</p><p>Bonjour</p><span>Iris Ombrelle</span><span>C:\\Documents\\x.gtt.json</span>` +
        `<button aria-label="Fermer">${OUVERTURE}x${FERMETURE}</button><p>${etiquette(3)}</p>` +
        `<p>${OUVERTURE}Table${FERMETURE} 3 ${OUVERTURE}place${FERMETURE}</p>`,
      (c) => fautesTemoin(c, connues),
    );
    expect(lus).toBeGreaterThan(0);
    expect(fautes).toEqual(['p : « Bonjour »', 'p : « Table 3 »', 'button[aria-label] : « Fermer »']);
  });

  test('emoji : un pictogramme dans un texte est relevé', () => {
    const { fautes, lus } = avecFragment(`<p>${OUVERTURE}Prêt${FERMETURE} \u{1F642}</p><p>${OUVERTURE}2 + 2${FERMETURE}</p>`, (c) => fautesEmoji(c));
    expect(lus).toBe(2);
    expect(fautes).toHaveLength(1);
  });

  test('contraste et atténuation : un gris clair sur blanc et une opacité partielle sont relevés', () => {
    const { fautes, attenuations: voiles, mesures } = avecFragment(
      '<div style="background:#ffffff;color:#000000;padding:4px"><p style="color:#bbbbbb">pâle</p><p style="opacity:0.5">voilé</p></div>',
      (c) => releverTextes(c),
    );
    expect(mesures).toBeGreaterThan(1);
    expect(fautes.some((f) => f.includes('pâle'))).toBe(true);
    expect(voiles.some((f) => f.includes('opacity'))).toBe(true);
  });

  test('marques : une marque hors registre, une marque qui ne peint pas son jeton et une marque noyée dans son fond sont relevées', () => {
    const { fautes, vues } = avecFragment(
      '<svg width="120" height="40" style="background:var(--couleur-poignee)">' +
        '<circle data-marque="inconnue" cx="10" cy="10" r="8" style="fill:#000" />' +
        '<circle data-marque="gel" cx="40" cy="20" r="8" style="fill:#123456" />' +
        '<circle data-marque="poignee" cx="80" cy="20" r="8" style="fill:var(--couleur-poignee);stroke:none" /></svg>',
      (c) => releverMarques(c),
    );
    expect(vues).toEqual(['gel', 'poignee']);
    expect(fautes).toHaveLength(3);
    expect(fautes[0]).toContain('hors du registre');
    expect(fautes[1]).toContain('ne peint pas son jeton');
    expect(fautes[2]).toContain('1.00:1');
  });

  test('teinte réservée : un texte peint de la couleur de conflit est relevé', () => {
    const { fautes, lus } = avecFragment('<p style="color:var(--couleur-conflit)">alerte</p>', (c) => fautesTeinte(c, couleurDeJeton('--couleur-conflit')));
    expect(lus).toBeGreaterThan(0);
    expect(fautes).toHaveLength(1);
  });

  test('listes : une partie qui traverse une chaise loin de son centre est relevée ; une boîte qui n’entre que dans le coin d’un cercle passe', () => {
    const R = 20;
    const { fautes, lues } = avecFragment(
      '<svg width="400" height="160" style="font: 12px sans-serif">' +
        `<g data-table="2"><g data-siege="2:1"><circle data-marque="contourChaise" cx="0" cy="0" r="${R}" style="fill:none;stroke:#000;stroke-width:2" /></g></g>` +
        '<text data-liste="1"><tspan x="10" y="54"><tspan data-partie="nom">Wxyz Quorvel Tamberlune</tspan></tspan></text>' +
        '<text data-liste="3"><tspan x="0" y="0"><tspan data-partie="nom">Ab</tspan></tspan></text></svg>',
      (c) => {
        const cercle = c.querySelector('circle');
        const [premiere, seconde] = c.querySelectorAll('tspan[data-partie]');
        // Le cercle se pose sur la fin de la première partie, dont le centre
        // reste hors de lui ; la seconde partie se pose, par le coin haut
        // gauche de sa boîte, en un point de la boîte du cercle à 1,13 rayon
        // de son centre, hors de son trait.
        const p = premiere.getBBox();
        expect(p.width).toBeGreaterThan(80);
        const cx = p.x + p.width - 8;
        const cy = p.y + p.height / 2;
        cercle.setAttribute('cx', String(cx));
        cercle.setAttribute('cy', String(cy));
        const s = seconde.getBBox();
        seconde.closest('text').setAttribute('transform', `translate(${cx + 0.8 * R - s.x}, ${cy + 0.8 * R - s.y})`);
        return releverListes(c);
      },
    );
    expect(lues).toBe(2);
    expect(fautes).toEqual(['tspan[data-partie="nom"] dans text[data-liste="1"] « Wxyz Quorvel Tamberlune » sur circle[data-marque="contourChaise"] dans g[data-siege="2:1"]']);
  });

  test('jamais la seule couleur : deux formes qui ne diffèrent que par la couleur ont la même signature', () => {
    const fautes = avecFragment(
      '<svg width="60" height="20"><circle id="a" cx="10" cy="10" r="8" style="fill:#000;stroke:#333;stroke-width:2" />' +
        '<circle id="b" cx="40" cy="10" r="8" style="fill:#fff;stroke:#c00;stroke-width:2" /></svg>',
      (c) => fautesPaire('paire', [{ ou: 'a', sig: signature([c.querySelector('#a')]) }], [{ ou: 'b', sig: signature([c.querySelector('#b')]) }]),
    );
    expect(fautes).toEqual(['paire : a et b ne diffèrent que par la couleur']);
    expect(fautesPaire('vide', [], [{ ou: 'b', sig: '' }])).toHaveLength(1);
  });

  test('bandeau et formulaires : une version absente, un formulaire validé par le navigateur et un champ de fichier visible sont relevés', () => {
    const bandeau = avecFragment('<header data-bandeau>Nom</header>', (c) => fautesBandeau(c, null, { version: 'version-epreuve', provenance: 'épreuve' }));
    expect(bandeau).toHaveLength(2);
    const formulaires = avecFragment('<form><input type="file" /></form><form novalidate></form>', (c) => fautesFormulaires(c));
    expect(formulaires.formulaires).toBe(2);
    expect(formulaires.fautes).toHaveLength(2);
  });

  test('transitions annulées : sous la feuille injectée, un écran qui attendrait transitionend ne viendrait jamais', async () => {
    const attendTransition = async () => {
      const element = document.createElement('div');
      element.style.transition = 'opacity 20ms linear';
      element.style.opacity = '1';
      document.body.append(element);
      let finie = false;
      element.addEventListener('transitionend', () => (finie = true));
      getComputedStyle(element).opacity;
      element.style.opacity = '0.5';
      for (let image = 0; image < 60 && !finie; image += 1) await new Promise((r) => requestAnimationFrame(r));
      element.remove();
      return finie;
    };
    expect(await attendTransition()).toBe(true);
    const feuille = document.createElement('style');
    feuille.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
    document.head.append(feuille);
    try {
      expect(await attendTransition()).toBe(false);
    } finally {
      feuille.remove();
    }
  });
});

// --- Les gardes, sur chaque écran ----------------------------------------------------------

describe('chaque écran de l’itération (§ 14.5, § 14.6, § 19.11)', () => {
  test('chaque écran s’atteint depuis le premier, et le collecteur ne reçoit rien', () => {
    expect(releves.length).toBe(ECRANS.length);
    const fautes = [
      ...releves.filter((r) => r.echec !== null).map((r) => `${r.nom} : ${r.echec}`),
      ...atteints().flatMap((r) => r.erreurs.map((e) => `${r.nom} : collecteur ${JSON.stringify(e)}`)),
    ];
    aucuneFaute(fautes, 'parcours');
  });

  test('langue témoin : chaque texte affiché porte la marque, ou est une donnée connue', () => {
    expect(atteints().reduce((n, r) => n + r.temoin.lus, 0)).toBeGreaterThan(0);
    const fautes = [...new Set(atteints().flatMap((r) => r.temoin.fautes.map((f) => `${r.nom} — ${f}`)))];
    aucuneFaute(fautes, 'langue témoin');
  });

  test('les erreurs par leur libellé : MODE_LECTURE, LECTURE_SEULE d’un plan bloqué, VERROU_PRIS, ETAT_ILLISIBLE, une ligne CSV refusée, PLACE_RESERVEE — chacune marquée, aucun err.message', () => {
    const attendus = [
      ['refus.modeLecture', 'MODE_LECTURE'],
      ['refus.bloque', 'LECTURE_SEULE'],
      ['refus.verrou', 'VERROU_PRIS'],
      ['recuperation', 'ETAT_ILLISIBLE'],
      ['import.apercu', 'LIGNE_CSV'],
      ['plan.refusPlace', 'PLACE_RESERVEE'],
    ];
    const fautes = [];
    for (const [nom, code] of attendus) {
      const releve = atteints().find((r) => r.nom === nom);
      const messages = releve?.refus.filter((r) => r.code === code) ?? [];
      if (messages.length === 0) {
        fautes.push(`${nom} : aucun message ${code}`);
        continue;
      }
      for (const { texte, restes } of messages) {
        if (!texte.includes(OUVERTURE)) fautes.push(`${nom} ${code} : message sans marque « ${extrait(texte)} »`);
        for (const reste of restes) fautes.push(`${nom} ${code} : hors marque « ${extrait(reste)} »`);
        if (code !== 'LIGNE_CSV' && (texte.includes(code) || texte.includes('{"'))) fautes.push(`${nom} ${code} : err.message affiché « ${extrait(texte)} »`);
      }
      if (code === 'LECTURE_SEULE') {
        const nomme = messages.some((m) => m.debloquer !== null && m.debloquer.includes(tTemoin('communs.remede.debloquer')));
        if (!nomme) fautes.push(`${nom} : le refus ne nomme pas « ${tTemoin('communs.remede.debloquer')} »`);
      }
    }
    aucuneFaute(fautes, 'erreurs par leur libellé');
  });

  test('contrastes : chaque texte tient 4,5:1 sur son fond peint, dans les deux thèmes posés par le réglage ; les couleurs relues diffèrent d’un thème à l’autre', () => {
    expect(atteints().reduce((n, r) => n + r.clair.textes.mesures + r.sombre.textes.mesures, 0)).toBeGreaterThan(0);
    const fautes = [];
    for (const r of atteints()) {
      for (const theme of THEMES) fautes.push(...r[theme].textes.fautes.map((f) => `${r.nom} [${theme}] — ${f}`));
      for (const [cle, couleurs] of r.clair.textes.couleurs) {
        if (r.sombre.textes.couleurs.get(cle) === couleurs) fautes.push(`${r.nom} — ${cle} : ${couleurs} dans les deux thèmes`);
      }
    }
    aucuneFaute([...new Set(fautes)], 'contrastes');
  });

  test('marques : chaque sorte de MARQUES est rendue au moins une fois, et chacune tient 3:1 contre ce qui est peint dessous, dans les deux thèmes', () => {
    expect(atteints().reduce((n, r) => n + r.clair.marques.mesures, 0)).toBeGreaterThan(0);
    const vues = new Set(atteints().flatMap((r) => [...r.clair.marques.vues, ...r.sombre.marques.vues]));
    const fautes = MARQUES.filter(({ nom }) => !vues.has(nom)).map(({ nom }) => `${nom} : rendue sur aucun écran`);
    for (const r of atteints()) {
      for (const theme of THEMES) fautes.push(...r[theme].marques.fautes.map((f) => `${r.nom} [${theme}] — ${f}`));
    }
    aucuneFaute([...new Set(fautes)], 'marques');
  });

  test('aucune liste de noms sur une table : chaque partie d’une ligne, de toute sa boîte, hors des chaises, plateaux et emprises de toute table', () => {
    expect(atteints().reduce((n, r) => n + r.listes.lues, 0), 'parties de listes lues').toBeGreaterThan(0);
    aucuneFaute(atteints().flatMap((r) => r.listes.fautes.map((f) => `${r.nom} — ${f}`)), 'listes sur une table');
  });

  test('aucune atténuation : ni opacité partielle, ni filtre, ni fusion, ni masque sur un texte, une marque ou leur ascendance, dans les deux thèmes', () => {
    for (const theme of THEMES) {
      const mesures = atteints().reduce((n, r) => n + r[theme].textes.mesures + r[theme].marques.mesures, 0);
      expect(mesures, `textes et marques mesurés [${theme}]`).toBeGreaterThan(0);
    }
    const fautes = [];
    for (const r of atteints()) {
      for (const theme of THEMES) {
        fautes.push(...[...r[theme].textes.attenuations, ...r[theme].marques.attenuations].map((f) => `${r.nom} [${theme}] — ${f}`));
      }
    }
    aucuneFaute([...new Set(fautes)], 'atténuations');
  });

  test('jamais la seule couleur : table saine et en conflit, place libre, réservée et à titre non pourvu, portée tour et tous, cadre en lecture, en écriture et bloqué', () => {
    const plan = atteints().find((r) => r.nom === 'evenement.plan.ecriture');
    expect(plan, 'le plan en écriture relevé').toBeDefined();
    const e = plan.etats;
    const fautes = [
      ...fautesPaire('table saine / en conflit', e.saine, e.conflit),
      ...fautesPaire('place libre / réservée', e.libre, e.reservee),
      ...fautesPaire('place libre / titre non pourvu', e.libre, e.nonPourvu),
      ...fautesPaire('place réservée / titre non pourvu', e.reservee, e.nonPourvu),
      ...fautesPaire('portée tour / tous', e.tour, e.tous),
    ];
    const cadres = ['lecture', 'ecriture', 'bloque'].map((mode) => {
      const r = atteints().find((x) => x.nom === `evenement.plan.${mode}`);
      return { ou: `cadre ${mode}`, sig: r?.cadre ?? null };
    });
    for (const c of cadres) if (c.sig === null) fautes.push(`${c.ou} : absent`);
    for (let i = 0; i < cadres.length; i += 1) {
      for (let j = i + 1; j < cadres.length; j += 1) fautes.push(...fautesPaire(`${cadres[i].ou} / ${cadres[j].ou}`, [cadres[i]], [cadres[j]]));
    }
    aucuneFaute(fautes, 'jamais la seule couleur');
  });

  test('teinte réservée : la couleur calculée de conflit ne peint que les marques de conflit, dans les deux thèmes', () => {
    for (const theme of THEMES) {
      expect(atteints().reduce((n, r) => n + r[theme].teinte.lus, 0), `éléments peints lus [${theme}]`).toBeGreaterThan(0);
    }
    const fautes = atteints().flatMap((r) => THEMES.flatMap((theme) => r[theme].teinte.fautes.map((f) => `${r.nom} [${theme}] — ${f}`)));
    aucuneFaute([...new Set(fautes)], 'teinte réservée');
  });

  test('aucun emoji au rendu', () => {
    expect(atteints().reduce((n, r) => n + r.emoji.lus, 0), 'textes affichés lus').toBeGreaterThan(0);
    aucuneFaute(atteints().flatMap((r) => r.emoji.fautes.map((f) => `${r.nom} — ${f}`)), 'emoji');
  });

  test('le bandeau sur tout écran : visible, version et provenance ; libellé de mode absent de la liste, égal à celui du cadre sur un événement', () => {
    expect(atteints().some((r) => r.mode === null) && atteints().some((r) => r.mode !== null)).toBe(true);
    aucuneFaute(atteints().flatMap((r) => r.bandeau.map((f) => `${r.nom} — ${f}`)), 'bandeau');
  });

  test('formulaires : chaque <form> porte novalidate, aucun input[type=file] visible ; la page se déclare en français', () => {
    expect(atteints().reduce((n, r) => n + r.formulaires.formulaires, 0), '<form> lus').toBeGreaterThan(0);
    const fautes = [...new Set(atteints().flatMap((r) => r.formulaires.fautes.map((f) => `${r.nom} — ${f}`)))];
    if (!/<html[^>]*\slang="fr"/.test(INDEX)) fautes.push('index.html : <html> sans lang="fr"');
    aucuneFaute(fautes, 'formulaires');
  });
});

// --- Le balisage littéral -------------------------------------------------------------------

describe('balisage littéral (§ 13.1)', () => {
  const INJECTION = '<img src=x onerror=globalThis.__injecte=1>';

  test('une personne nommée par du balisage : son nom littéral dans la grille, la fiche, le plan et l’infobulle ; aucun img créé ; rien d’exécuté', async () => {
    await fixerCadre(1366, 700);
    const charge = chargePrincipale();
    // Les cinq personnes de l'appartenance en conflit portent le nom
    // injecté : l'infobulle d'une table en conflit les nomme.
    const appartenance = charge.participants[0].appartenance;
    for (const p of charge.participants) {
      if (p.appartenance === appartenance) {
        p.nom = INJECTION;
        p.prenom = null;
      }
    }
    const contexte = creerContexte({ langue: 'fr' });
    try {
      const m = await ouvrirEvenement(contexte, charge, { ecriture: true, section: 'participants' });
      const imgs = () => document.querySelectorAll('img').length;
      const ligne = m.racine.querySelector('[data-participant="1"]');
      expect(ligne?.textContent).toContain(INJECTION);
      await cliquer(m, '[data-participant="1"] [data-commande="fiche"]');
      expect((await attendre('la fiche', () => m.racine.querySelector('[data-fiche="1"]'))).textContent).toContain(INJECTION);
      await cliquer(m, '[data-commande="section"][data-cible="plan"]');
      const listes = await attendre('les listes de noms', () => {
        const l = [...m.racine.querySelectorAll('[data-liste]')];
        return l.length > 0 && l;
      });
      expect(listes.some((l) => l.textContent.includes(INJECTION))).toBe(true);
      const plateau = m.racine.querySelector('[data-table="1"] [data-marque="contourConflit"]');
      expect(plateau, 'la table 1 en conflit').not.toBeNull();
      const { x, y } = await centre(plateau);
      await pointer('bouger', x, y);
      const infobulle = await attendre('l’infobulle', () => {
        const element = m.racine.querySelector('[role="tooltip"]');
        return element !== null && !element.hidden && element;
      });
      expect(infobulle.textContent).toContain(INJECTION);
      expect(imgs()).toBe(0);
      expect(globalThis.__injecte).toBeUndefined();
      expect(contexte.erreurs()).toEqual([]);
    } finally {
      await contexte.defaire();
    }
  });
});

// --- Les transitions annulées ----------------------------------------------------------------

describe('transitions annulées (§ 19.2)', () => {
  test('sous une feuille qui annule transitions et animations, chaque écran s’atteint', async () => {
    await fixerCadre(1366, 700);
    const feuille = document.createElement('style');
    feuille.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
    document.head.append(feuille);
    const fautes = [];
    let atteintes = 0;
    try {
      for (const ecran of ECRANS) {
        const contexte = creerContexte({ langue: 'fr' });
        try {
          await ecran.atteindre(contexte);
          atteintes += 1;
        } catch (erreur) {
          fautes.push(`${ecran.nom} : ${erreur.message}`);
        } finally {
          await contexte.defaire();
        }
      }
    } finally {
      feuille.remove();
    }
    expect(atteintes + fautes.length).toBe(ECRANS.length);
    aucuneFaute(fautes, 'transitions annulées');
  }, 900_000);
});
