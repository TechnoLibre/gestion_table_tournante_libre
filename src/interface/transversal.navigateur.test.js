// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le rendu transversal, sur chaque écran de l'itération (§ 14.5, § 14.6,
// § 19.11, § 12.7, § 7.6, § 13.1, § 2, § 19.2, § 8.4, § 18.6) : langue
// témoin, erreurs par leur libellé, contrastes et marques dans les deux
// thèmes, aucune atténuation, jamais la seule couleur, teinte réservée, aucun
// emoji, la ponctuation haute insécable, balisage littéral, bandeau,
// formulaires, transitions annulées ; la page de qualité — chaque
// pourcentage suivi de son compte, celui de sa ligne sur une ligne, le
// signe « % » à ses seules places, chaque niveau de l'échelle rendu, les
// motifs des tracés, ses graphiques nommés et décrits, ses jumeaux au
// clavier ; puis
// le mécanisme des captures d'écran (§ 19.4, § 19.5, § 19.7, § 19.11),
// chaque contrôle montré en train d'échouer sur un dossier d'épreuve.
//
// Un parcours unique, en langue témoin, au cadre de 1 366 × 700, atteint
// chaque écran de test/navigateur/ecrans.js et y fait ses relevés, une fois
// dans le thème clair, puis dans le sombre que pose l'état de navigation ;
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
import { commands } from 'vitest/browser';
import { appliquerCommande } from '../application/commandes.js';
import { comparerPlacements, evaluer } from '../application/evaluation.js';
import { creerFormat } from '../application/format.js';
import { creerExecuteurDirect } from '../application/generation.js';
import { nomAffiche } from '../application/personnes.js';
import { etatPlaces } from '../application/places.js';
import { MARQUE_TEMOIN } from '../application/traduction.js';
import { typographier } from '../application/typographie.js';
import { decoder } from '../csv/encodage.js';
import { CATALOGUE } from '../demo/catalogue.js';
import { decouper } from '../csv/lecture.js';
import { analyser } from '../stockage/document.js';
import { lireEtiquettes } from '../stockage/etiquettes.js';
import { lireJournal } from '../stockage/journal.js';
import { SUFFIXES } from '../stockage/noms.js';
import { pourcentage } from '../moteur/qualite.js';
import { VERSION } from '../version.genere.js';
import INDEX from '../../index.html?raw';
import {
  ECRANS,
  NOM_CAS_LIMITES,
  attendre,
  centre,
  chargeComparaison,
  chargeComparaisonObjectifs,
  chargeObjectifs,
  chargePaires,
  chargePrincipale,
  cliquer,
  cliquerAction,
  creerContexte,
  fichierCourses,
  generationPrincipale,
  octetsCasLimites,
  ouvrirEvenement,
} from '../../test/navigateur/ecrans.js';
import { dessinerGraphiques, fixerCadre, pointer, touche } from '../../test/navigateur/entrees.js';
import { monterApp } from '../../test/navigateur/montage.js';
import {
  CADRE,
  CHAMPS,
  bordsPeints,
  couleurDeJeton,
  egales,
  extrait,
  releverMarques,
  releverTextes,
  rendu,
  rgb,
  cloreCaptures,
  photographier,
  requeteHorsBoucle,
  situer,
  stylesDuTheme,
  texteReleve,
} from '../../test/navigateur/captures.js';
import { poserFeuille } from '../../test/navigateur/feuilles.js';
import { composantes, couleursPeintes, designation, sousTheme, traductionEcran, visible } from '../../test/navigateur/rendu.js';
import { provenanceVisible } from './apropos.js';
import { nomDe } from './propositions/modele.js';
import { colonnesComparaison } from './qualite/colonnes.js';
import SOURCE_CAPTURES from '../../test/navigateur/captures.js?raw';
import { CONFLITS, FONDS_GRAPHIQUE, JETON_RETRAIT, MARQUES, MARQUES_GRAPHIQUE, NIVEAUX_GRAPHIQUE, SEPARATIONS, TEINTES_ORGANISATION } from './marques.js';
import { SIMULATIONS, ecartPercu, simuler } from './palette.js';

// Le t de l'écran en langue témoin, celui que lit App montée par creerContexte.
const { t: tTemoin } = traductionEcran({ langue: 'temoin' });
const { ouverture: OUVERTURE, fermeture: FERMETURE } = MARQUE_TEMOIN;
const PROVENANCE = 'test';
const THEMES = ['clair', 'sombre'];

// Attributs annoncés : lus par l'accessibilité, ils sont du texte visible
// au sens du § 14.6 (contrainte 7).
const ATTRIBUTS_ANNONCES = ['aria-label', 'aria-roledescription', 'aria-description', 'aria-valuetext', 'title', 'placeholder', 'alt'];

// Éléments dont le texte ne se peint jamais.
const TEXTES_NON_PEINTS = new Set(['script', 'style', 'template', 'noscript', 'title', 'desc', 'metadata']);

// Conteneurs SVG qui ne peignent qu'à travers une référence.
const CONTENEURS_DE_REFERENCE = 'defs, pattern, clipPath, mask, marker, symbol, linearGradient, radialGradient';

// Les trames de conflit, et le jeton que chacune peint seule (§ 12.7, § 7.5) :
// une teinte de conflit ne peint que la trame de sa règle.
const JETON_DE_TRAME = new Map(CONFLITS.map(({ marque, jeton }) => [marque, jeton]));

const PICTOGRAPHIQUE = /\p{Extended_Pictographic}/u;
const LETTRE = /\p{L}/u;

// --- Les données connues de l'épreuve ------------------------------------------

/**
 * Ce qu'un écran peut montrer sans la marque de la langue témoin, parce que
 * c'est une donnée (§ 14.6, « La traduction ») : noms, prénoms, noms
 * affichés, organisations, courriels, titres, notes et étiquettes des
 * personnes, nom et base des événements du disque, libellés des titres,
 * libellés figés du journal, version, provenance, identifiant et instant d'un
 * verrou, cellules du CSV servi, nom de chaque démonstration du catalogue —
 * le nom que l'événement chargé porte, que l'accueil reçoit comme une donnée
 * — ; un chemin sous une racine du système simulé. → { valeurs: string[],
 * racines: string[] }, valeurs de la plus longue à la plus courte.
 */
async function donneesConnues(contexte, { cellules = [] } = {}) {
  const valeurs = new Set([VERSION.affichee, PROVENANCE, ...CATALOGUE.map(({ nom }) => nom), ...cellules]);
  const racines = new Set();
  const personne = (p) => {
    for (const v of [p.nom, p.prenom, p.organisation, p.courriel, p.titrePressenti, p.notes, ...(p.etiquettes ?? [])]) if (v) valeurs.add(v);
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
 *  les rend, avec les étiquettes que chaque cellule porte : l'aperçu les
 *  montre une à une. */
async function cellulesCasLimites() {
  const { texte } = decoder(await octetsCasLimites());
  const cellules = decouper(texte, ';').enregistrements.flat().map((c) => c.trim()).filter((c) => c !== '');
  return [NOM_CAS_LIMITES, ...cellules, ...cellules.flatMap((c) => lireEtiquettes(c).etiquettes)];
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

// Les mois d'une date en lettres, en alternative d'expression.
const MOIS_EN_LETTRES = 'janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre';
// Les unités qu'un nombre garde contre lui, en alternative d'expression.
const UNITES_LIEES = 'h|min|s|ms|mm|cm|m|km|po|pt|px|Mo|Ko|Go|Mpx|%|°C';
// Une espace ordinaire U+0020 devant la ponctuation haute ou « » », ou après
// « « » : la place où le t de l'écran pose une insécable (§ 14.6).
const PONCTUATION_DETACHEE = / [;:?!»]|« /u;
// Une espace ordinaire U+0020 que le t de l'écran lie aussi (§ 14.6) : entre
// un nombre et une unité de la liste, entre le « h » d'une heure et ses
// minutes sur deux chiffres qu'aucune unité ne suit, après « n° », entre le
// jour et le mois d'une date en lettres, entre le mois et l'année. Les
// débuts et fins de mot sont ceux de typographier : un mot commence après ce
// qui n'est ni lettre ni chiffre ; le mois, l'année et les minutes
// s'arrêtent à ce qui n'est ni lettre ni chiffre — le trait d'union d'une
// plage compris —, l'unité aussi à l'apostrophe et au trait d'union.
const FIN_MOT = '(?![\\p{L}\\p{N}])';
const FIN_UNITE = "(?![\\p{L}\\p{N}'\\u{2019}-])";
const NOMBRE_DETACHE = new RegExp(
  [
    `(?<![\\p{L}\\p{N}])\\d+(?:,\\d+)? (?:${UNITES_LIEES})${FIN_UNITE}`,
    `(?<=\\d[\\u{A0}\\u{202F}])h \\d{2}${FIN_MOT}(?![ \\u{A0}\\u{202F}]+(?:${UNITES_LIEES})${FIN_UNITE})`,
    '(?<![\\p{L}\\p{N}])[nN]° (?=[\\p{L}\\p{N}])',
    `(?<![\\p{L}\\p{N}])(?:1er|\\d{1,2}) (?:${MOIS_EN_LETTRES})${FIN_MOT}`,
    `(?<![\\p{L}\\p{N}])(?:${MOIS_EN_LETTRES}) \\d{4}${FIN_MOT}`,
  ].join('|'),
  'u',
);
// Une insécable U+00A0 ou fine U+202F à l'une de ces places.
const PONCTUATION_INSECABLE = /[\u{A0}\u{202F}][;:?!»]|«[\u{A0}\u{202F}]/u;

/** Fautes de typographie sous racine (§ 14.6) : un texte affiché qui porte
 *  une espace ordinaire devant « ; », « : », « ? », « ! », « » » ou après
 *  « « », ou à l'une des places de NOMBRE_DETACHE. Le titre de la fenêtre
 *  n'est pas lu : il quitte l'écran et garde le texte brut. → { fautes,
 *  lus, insecables }, lus le nombre de textes affichés lus, insecables le
 *  nombre de ceux qui portent une insécable devant la ponctuation haute ou
 *  après « « ». */
export function fautesTypographie(racine) {
  const textes = textesAffiches(racine);
  const fautes = [];
  for (const { ou, texte } of textes) {
    const motif = PONCTUATION_DETACHEE.exec(texte) ?? NOMBRE_DETACHE.exec(texte);
    if (motif !== null) fautes.push(`${ou} : « ${extrait(texte)} » (« ${motif[0].trim()} »)`);
  }
  return { fautes, lus: textes.length, insecables: textes.filter(({ texte }) => PONCTUATION_INSECABLE.test(texte)).length };
}

// --- Les listes de noms et les tables -----------------------------------------------

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
 * chaise et ses marques, focus, sélection et mise en évidence comprises :
 * une désignation ne cache jamais un texte. Une partie est
 * posée sur une forme quand un point de la grille qui pave l'intersection
 * de leurs boîtes tombe dans la forme : le coin d'une boîte qui frôle un
 * cercle ne compte pas, un texte qui le traverse loin de son centre compte.
 * → { fautes, lues }, lues le nombre de parties lues.
 */
export function releverListes(racine) {
  const formes = [...racine.querySelectorAll('[data-table] [data-marque]')]
    .filter((f) => f instanceof SVGGeometryElement && rendu(f))
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

/** Fautes des teintes réservées sous racine (§ 12.7, § 7.5) : un élément
 *  rendu qui peint une teinte de conflit sans être la trame de sa règle —
 *  aucun autre élément, ni la trame d'une autre règle. teintes : [{ jeton,
 *  couleur }], la couleur résolue de chaque jeton de conflit dans le thème
 *  courant. → { fautes, lus }, lus le nombre d'éléments rendus qui peignent
 *  au moins une couleur. */
export function fautesTeinte(racine, teintes) {
  const fautes = [];
  let lus = 0;
  for (const element of [racine, ...racine.querySelectorAll('*')]) {
    if (element.closest(CONTENEURS_DE_REFERENCE) !== null || !rendu(element)) continue;
    const sienne = JETON_DE_TRAME.get(element.dataset?.marque) ?? null;
    const peintures = peinturesDe(element);
    if (peintures.some(({ couleurs }) => couleurs.length > 0)) lus += 1;
    for (const { propriete, couleurs } of peintures) {
      for (const { jeton, couleur } of teintes) {
        if (jeton !== sienne && couleurs.some((c) => egales(c, couleur))) fautes.push(`${situer(element)} : ${propriete} ${rgb(couleur)} (${jeton})`);
      }
    }
  }
  return { fautes, lus };
}

/** Les teintes de conflit du thème courant : [{ jeton, couleur }]. */
const teintesDeConflit = () => CONFLITS.map(({ jeton }) => ({ jeton, couleur: couleurDeJeton(jeton) }));

// --- Jamais la seule couleur ------------------------------------------------------------

// La géométrie d'un motif, sans ses couleurs : sa transformation, son
// carreau, et chacune de ses formes — balise, attributs de géométrie,
// épaisseur de trait. Deux trames qui ne diffèrent que par la couleur de
// leur motif ont la même.
const GEOMETRIE = ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'width', 'height', 'd'];
function formeDuMotif(element) {
  const id = /^url\("?#([^")]+)"?\)/.exec(getComputedStyle(element).fill)?.[1];
  const motif = id === undefined ? null : element.ownerDocument.getElementById(id);
  if (motif === null) return 'motif absent';
  const formes = [...motif.querySelectorAll('*')].map((n) =>
    [n.localName, ...GEOMETRIE.map((a) => n.getAttribute(a) ?? ''), getComputedStyle(n).strokeWidth].join(' '),
  );
  return `motif ${motif.getAttribute('patternTransform') ?? ''} ${motif.getAttribute('width')}×${motif.getAttribute('height')} [${formes.join(', ')}]`;
}

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
          svg ? `remplissage ${s.fill === 'none' ? 'aucun' : /^url\(/.test(s.fill) ? formeDuMotif(n) : 'aplat'}` : '',
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
  const etats = { saine: [], conflit: [], libre: [], reservee: [], nonPourvu: [], tour: [], tous: [], trames: Object.fromEntries(CONFLITS.map(({ marque }) => [marque, []])) };
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
    // Chaque trame de conflit, par sa sorte.
    for (const trame of groupe.querySelectorAll(CONFLITS.map(({ marque }) => `[data-marque="${marque}"]`).join(', '))) {
      if (rendu(trame)) etats.trames[trame.dataset.marque].push({ ou: `trame de la table ${table.id}`, sig: signature([trame]) });
    }
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

// Le mode de l'événement : sig, la signature de la bande de mode et du
// libellé de mode de la barre ; trait, la somme des épaisseurs des bords de
// la surface de travail, qui n'en porte aucun. null hors d'un événement.
function signatureMode(racine) {
  const surface = racine.querySelector('[data-mode]');
  const bande = racine.querySelector('[data-ecran="evenement"] > [role="status"]');
  const libelle = racine.querySelector('[data-mode-libelle="barre"]');
  if (surface === null || bande === null || libelle === null) return null;
  const s = getComputedStyle(surface);
  const trait = ['Top', 'Right', 'Bottom', 'Left'].reduce((somme, cote) => somme + Number.parseFloat(s[`border${cote}Width`]), 0);
  return { sig: signature([bande, libelle]), trait };
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
 *  présent et égal à celui de la barre de l'événement sinon. */
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
  const barre = racine.querySelector('[data-mode-libelle="barre"]');
  if (libelle === null) fautes.push(`libellé de mode absent du bandeau (${mode})`);
  else if (voir(libelle) !== true) fautes.push(`libellé de mode du bandeau non visible : ${voir(libelle)}`);
  if (barre === null) fautes.push(`libellé de mode absent de la barre (${mode})`);
  if (libelle !== null && barre !== null && libelle.textContent.trim() !== barre.textContent.trim()) {
    fautes.push(`bandeau « ${libelle.textContent.trim()} », barre « ${barre.textContent.trim()} »`);
  }
  return fautes;
}

// Les éléments HTML de flux qu'un contenu de phrase ne peut porter, et les
// éléments dont le contenu est de phrase seulement.
const BLOCS = 'div, p, section, article, aside, nav, header, footer, form, fieldset, ul, ol, dl, table, figure, blockquote, pre, h1, h2, h3, h4, h5, h6';
const PHRASES = 'span, button, label, p, h1, h2, h3, h4, h5, h6';

/** Fautes d'imbrication sous racine : un bloc porté par un élément de
 *  phrase — un <div> dans un <span> —, que l'analyseur HTML déplacerait ou
 *  que le validateur refuse. L'espace de noms SVG n'est pas lu.
 *  → { fautes, lus }, lus le nombre de blocs lus. */
export function fautesImbrication(racine) {
  const fautes = [];
  const blocs = [...racine.querySelectorAll(BLOCS)].filter((element) => element.namespaceURI === 'http://www.w3.org/1999/xhtml');
  for (const bloc of blocs) {
    const parent = bloc.parentElement?.closest(PHRASES);
    if (parent !== null && parent !== undefined && racine.contains(parent)) fautes.push(`${designation(bloc)} dans ${designation(parent)}`);
  }
  return { fautes, lus: blocs.length };
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

// --- La page de qualité --------------------------------------------------------------------

// Le graphique en pourcentages : les graduations de son axe vertical et le
// libellé de son repère « cent » écrivent le signe « % » sans être le
// pourcentage d'une mesure (contrainte 44, D34), et n'ont pas de compte.
const GRAPHIQUE_EN_POURCENTAGES = 'profilPourcentages';

// Le signe « % » est-il admis dans l'élément qui porte le texte ? Dans un
// [data-pourcentage] ; dans le libellé du repère « cent », sur le tracé ou
// repris par la légende de son graphique — une entrée de liste sœur du
// <svg> qui porte ce libellé, au même texte ; dans une graduation de l'axe
// vertical du graphique en pourcentages — un <text> ancré à sa fin, qui
// n'est le libellé ni d'une série ni d'un repère.
function pourcentAdmis(element) {
  if (element.closest('[data-pourcentage], [data-repere="cent"]') !== null) return true;
  const liste = element.closest('li')?.parentElement ?? null;
  const voisin = liste?.parentElement?.querySelector(`:scope > svg[data-graphique="${GRAPHIQUE_EN_POURCENTAGES}"]`) ?? null;
  const cent = voisin?.querySelector('text[data-repere="cent"]') ?? null;
  if (cent !== null && cent.textContent.trim() === element.textContent.trim()) return true;
  const texte = element.closest('text');
  if (texte === null || texte.closest('svg[data-graphique]')?.dataset.graphique !== GRAPHIQUE_EN_POURCENTAGES) return false;
  return texte.getAttribute('text-anchor') === 'end' && !texte.hasAttribute('data-serie') && !texte.hasAttribute('data-repere');
}

// Les entiers qu'écrit un texte, dans son ordre.
const entiersDe = (texte) => (texte.match(/\d+/g) ?? []).map(Number);

// Le compte qui suit un pourcentage est-il le sien (contrainte 44, D34) ?
// Sur une ligne — d'un jumeau ou d'une infobulle —, le compte est celui de
// la ligne : son numérateur puis son dénominateur, ses deux seuls entiers ;
// seule une ligne sans rien à compter, sa valeur « — », écrit à la place
// une phrase sans entier (« aucun affilié à ce tour »). Partout, un compte
// de deux entiers redonne, par pourcentage du moteur, la valeur écrite —
// son premier entier, ou « — » quand le dénominateur est nul : le compte
// d'une autre ligne ou d'une autre population se trahit ainsi dès que leurs
// rapports diffèrent. Le pire cas d'une population écrit d'un seul entier
// (« 3 personnes jamais servies ») ne se recoupe pas. → null, ou la faute.
function fauteDuCompte(valeur, compte) {
  const texte = compte.textContent.trim();
  const entiers = entiersDe(texte);
  const ecrit = entiersDe(valeur.textContent)[0] ?? null;
  if (entiers.length !== 2) {
    if (valeur.closest('[data-jumeau], [role="tooltip"]') === null) return null;
    if (ecrit === null && entiers.length === 0) return null;
    return `« ${extrait(texte)} » n’est pas le compte de sa ligne, numérateur sur dénominateur`;
  }
  const [n, d] = entiers;
  const attendu = pourcentage(n, d);
  if (ecrit === attendu) return null;
  return `son compte ${extrait(texte)} donne ${attendu === null ? '\u{2014}' : `${attendu}\u{202F}%`}`;
}

// Vrai quand une ligne de jumeau porte deux comptes de même numérateur, de
// dénominateurs qui donnent deux pourcentages distincts — les sièges et les
// assis d'une table incomplète : un compte permuté avec l'autre y redonne
// un pourcentage qui n'est pas le sien, et fauteDuCompte le relève.
function ligneQuiDistingue(rangee) {
  const parNumerateur = new Map();
  for (const compte of rangee.querySelectorAll('[data-compte-pire]')) {
    const entiers = entiersDe(compte.textContent);
    if (entiers.length !== 2) continue;
    const [n, d] = entiers;
    const autres = parNumerateur.get(n) ?? [];
    if (autres.some((autre) => pourcentage(n, autre) !== pourcentage(n, d))) return true;
    parNumerateur.set(n, [...autres, d]);
  }
  return false;
}

/**
 * Les pourcentages et le signe « % » rendus sous racine (contrainte 44,
 * D34) : chaque [data-pourcentage] rendu suivi, son voisin immédiat dans
 * le composant Pourcentage, d'un [data-compte-pire] rendu, non vide et
 * qui est le sien (fauteDuCompte) ; et chaque texte rendu — nœud de texte
 * ou attribut annoncé — qui porte « % » hors des places que pourcentAdmis
 * admet. → { lus, dansInfobulle, dansJumeaux, lignesQuiDistinguent, fautes,
 * signes: { lus, fautes } }, lus le nombre de pourcentages rendus,
 * dansInfobulle et dansJumeaux ceux d'une infobulle et d'un jumeau ;
 * lignesQuiDistinguent, les lignes de jumeau rendues où ligneQuiDistingue
 * est vrai ; signes.lus le nombre de textes rendus qui portent « % ».
 */
export function releverPourcentages(racine) {
  const fautes = [];
  let lus = 0;
  let dansInfobulle = 0;
  let dansJumeaux = 0;
  for (const valeur of racine.querySelectorAll('[data-pourcentage]')) {
    if (!rendu(valeur)) continue;
    lus += 1;
    if (valeur.closest('[role="tooltip"]') !== null) dansInfobulle += 1;
    if (valeur.closest('[data-jumeau]') !== null) dansJumeaux += 1;
    const compte = valeur.nextElementSibling;
    const nomme = `${situer(valeur)} « ${extrait(valeur.textContent)} »`;
    if (compte === null || !compte.matches('[data-compte-pire]')) fautes.push(`${nomme} : aucun [data-compte-pire] ne le suit`);
    else if (!rendu(compte) || compte.textContent.trim() === '') fautes.push(`${nomme} : son compte du pire est vide`);
    else {
      const faute = fauteDuCompte(valeur, compte);
      if (faute !== null) fautes.push(`${nomme} : ${faute}`);
    }
  }
  const lignesQuiDistinguent = [...racine.querySelectorAll('[data-jumeau] tbody tr')].filter((rangee) => rendu(rangee) && ligneQuiDistingue(rangee)).length;
  const signes = { lus: 0, fautes: [] };
  const marcheur = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
  for (let noeud = marcheur.nextNode(); noeud !== null; noeud = marcheur.nextNode()) {
    const parent = noeud.parentElement;
    if (parent === null || !noeud.textContent.includes('%') || TEXTES_NON_PEINTS.has(parent.localName) || !rendu(parent)) continue;
    if (parent.closest('svg title, svg desc') !== null) continue;
    signes.lus += 1;
    if (!pourcentAdmis(parent)) signes.fautes.push(`${situer(parent)} : « ${extrait(noeud.textContent)} »`);
  }
  for (const element of [racine, ...racine.querySelectorAll('*')]) {
    if (!rendu(element)) continue;
    for (const nom of ATTRIBUTS_ANNONCES) {
      const valeur = element.getAttribute(nom);
      if (valeur === null || !valeur.includes('%')) continue;
      signes.lus += 1;
      signes.fautes.push(`${situer(element)}[${nom}] : « ${extrait(valeur)} »`);
    }
  }
  return { lus, dansInfobulle, dansJumeaux, lignesQuiDistinguent, fautes, signes };
}

/** Les niveaux de l'échelle que chaque grille rend sous racine (§ 12.7,
 *  D33, D35) : [{ graphique, niveaux }], niveaux croissants, chacun lu sur
 *  le remplissage calculé d'une case, comparé à la couleur que le thème
 *  courant donne au jeton de chaque niveau (NIVEAUX_GRAPHIQUE). */
export function releverNiveaux(racine) {
  const couleurs = NIVEAUX_GRAPHIQUE.map(({ niveau, jeton }) => ({ niveau, couleur: couleurDeJeton(jeton) }));
  const grilles = [];
  for (const svg of racine.querySelectorAll('svg[data-graphique]')) {
    const cases = [...svg.querySelectorAll('[data-case] > rect')].filter(rendu);
    if (cases.length === 0) continue;
    const niveaux = new Set();
    for (const forme of cases) {
      for (const peinte of couleursPeintes(forme).fill) {
        for (const { niveau, couleur } of couleurs) if (egales(peinte, couleur)) niveaux.add(niveau);
      }
    }
    grilles.push({ graphique: svg.dataset.graphique, niveaux: [...niveaux].sort((a, b) => a - b) });
  }
  return grilles;
}

// Les jetons des teintes d'organisation, la marque et le fond de chacune.
const JETONS_ORGANISATION = TEINTES_ORGANISATION.flatMap(({ marque, fond }) => [marque, fond]);

/**
 * Ce que les tracés de la page portent hors de leur couleur (§ 12.7, D30,
 * B13, B16) : traces, par genre — serie1, serie2, plafond, borne, cent —,
 * chaque tracé rendu [{ ou, sig, motif }], sig sa signature non chromatique
 * (signature), motif le stroke-dasharray calculé ; segments, prouve et
 * reste, chaque segment de barre rendu [{ ou, sig }].
 */
export function releverTraces(racine) {
  const traces = { serie1: [], serie2: [], plafond: [], borne: [], cent: [] };
  for (const trace of racine.querySelectorAll('path[data-serie], path[data-repere]')) {
    if (!rendu(trace)) continue;
    const genre = trace.dataset.serie ?? trace.dataset.repere;
    traces[genre] ??= [];
    traces[genre].push({ ou: situer(trace), sig: signature([trace]), motif: getComputedStyle(trace).strokeDasharray });
  }
  const segments = { prouve: [], reste: [] };
  for (const segment of racine.querySelectorAll('[data-segment="prouve"], [data-segment="reste"]')) {
    if (rendu(segment)) segments[segment.dataset.segment].push({ ou: situer(segment), sig: signature([segment]) });
  }
  return { traces, segments };
}

/**
 * Fautes des tracés réunis de plusieurs écrans (releverTraces) — jamais la
 * seule couleur (§ 12.7, D30, B13, B16) : la série 1 et la série 2, prouvé
 * inévitable et reste ont des signatures distinctes (fautesPaire) ; les motifs
 * des quatre traits — plein, tirets, trait mixte, pointillé — sont deux à
 * deux distincts : chaque série, le plafond, la borne ; la règle « cent »
 * a le motif du plafond et aucun autre. Une paire absente est une faute.
 */
export function fautesTraces({ traces, segments }) {
  const de = (genre) => traces[genre] ?? [];
  const motifs = (genre) => de(genre).map(({ ou, motif }) => ({ ou, sig: motif }));
  const fautes = [
    ...fautesPaire('série 1 / série 2', de('serie1'), de('serie2')),
    ...fautesPaire('prouvé inévitable / reste', segments.prouve, segments.reste),
  ];
  const genres = ['serie1', 'serie2', 'plafond', 'borne'];
  for (let i = 0; i < genres.length; i += 1) {
    for (let j = i + 1; j < genres.length; j += 1) {
      fautes.push(...fautesPaire(`motif ${genres[i]} / ${genres[j]}`, motifs(genres[i]), motifs(genres[j])));
    }
  }
  const cent = motifs('cent');
  if (cent.length === 0) fautes.push('motif cent : absent');
  for (const regle of cent) {
    for (const plafond of motifs('plafond')) if (regle.sig !== plafond.sig) fautes.push(`motif cent : ${regle.ou} (${regle.sig}) n’a pas celui du plafond ${plafond.ou} (${plafond.sig})`);
  }
  return fautes;
}

// Les vues sous lesquelles une série se mesure à une teinte d'organisation :
// les couleurs d'origine, puis chaque dichromatie (§ 12.7 : simuler d'abord,
// puis mesurer l'écart).
const VUES_SEPARATION = ['origine', ...Object.keys(SIMULATIONS)];

/**
 * Les couleurs que les séries et les teintes d'organisation peignent
 * réellement sous racine, dans le thème courant (§ 12.7, D43) : series,
 * chaque tracé de série rendu [{ ou, couleur }], couleur son trait calculé ;
 * teintes, chaque élément rendu, hors des conteneurs de référence et des
 * tracés de série, qui peint la marque d'une teinte d'organisation — le
 * point d'une pastille — [{ ou, couleur }]. Une couleur déjà relevée ne se relève pas deux fois.
 */
export function releverSeparation(racine) {
  const series = [];
  const teintes = [];
  const ajouter = (liste, ou, couleur) => {
    if (!liste.some((x) => egales(x.couleur, couleur))) liste.push({ ou, couleur });
  };
  for (const trace of racine.querySelectorAll('path[data-serie]')) {
    if (rendu(trace)) for (const couleur of couleursPeintes(trace).stroke) ajouter(series, situer(trace), couleur);
  }
  const marques = TEINTES_ORGANISATION.map(({ marque }) => couleurDeJeton(marque));
  for (const element of racine.querySelectorAll('*')) {
    if (element.closest(CONTENEURS_DE_REFERENCE) !== null || element.matches('[data-serie]') || !rendu(element)) continue;
    for (const { couleurs } of peinturesDe(element)) {
      for (const couleur of couleurs) if (marques.some((m) => egales(m, couleur))) ajouter(teintes, situer(element), couleur);
    }
  }
  return { series, teintes };
}

/** Fautes de séparation (releverSeparation, réunis de plusieurs écrans) :
 *  chaque série rendue et chaque teinte d'organisation rendue s'écartent
 *  d'au moins SEPARATIONS.autresMarques (ecartPercu), sur les couleurs
 *  d'origine puis sous chaque dichromatie (§ 12.7, D43). Aucune série ou
 *  aucune teinte relevée est une faute : la mesure n'a pas eu lieu. */
export function fautesSeparation({ series, teintes }) {
  if (series.length === 0 || teintes.length === 0) return [`séries / teintes d’organisation : paire absente (${series.length} et ${teintes.length})`];
  const fautes = [];
  for (const serie of series) {
    for (const teinte of teintes) {
      for (const vue of VUES_SEPARATION) {
        const vu = (c) => (vue === 'origine' ? c : simuler(c, vue));
        const ecart = ecartPercu(vu(serie.couleur), vu(teinte.couleur));
        if (ecart < SEPARATIONS.autresMarques) {
          fautes.push(`${serie.ou} ${rgb(serie.couleur)} et ${teinte.ou} ${rgb(teinte.couleur)} : écart ${ecart.toFixed(1)} (${vue}), ${SEPARATIONS.autresMarques} au moins`);
        }
      }
    }
  }
  return fautes;
}

/** Fautes des marques de graphique sous racine (D43, § 12.7) : une marque
 *  d'un <svg data-graphique> peinte d'une teinte d'organisation — sa marque
 *  ou son fond — ou du rouge du retrait, dans le thème courant. → { fautes,
 *  lus }, lus le nombre de marques de graphique lues. */
export function fautesTeintesGraphique(racine) {
  const reservees = [...JETONS_ORGANISATION, JETON_RETRAIT].map((jeton) => ({ jeton, couleur: couleurDeJeton(jeton) }));
  const fautes = [];
  let lus = 0;
  for (const marque of racine.querySelectorAll('svg[data-graphique] [data-marque]')) {
    if (!rendu(marque)) continue;
    lus += 1;
    const { fill, stroke } = couleursPeintes(marque);
    for (const { jeton, couleur } of reservees) {
      if ([...fill, ...stroke].some((c) => egales(c, couleur))) fautes.push(`${situer(marque)} : ${rgb(couleur)} (${jeton})`);
    }
  }
  return { fautes, lus };
}

// Le texte des éléments que nomment des identifiants séparés d'espaces.
const texteDesIdentifiants = (ids) =>
  (ids ?? '')
    .split(/\s+/)
    .filter((id) => id !== '')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Les graphiques rendus sous racine (§ 12.7, D44) : [{ ou, vue, role,
 *  nom, description }], vue la vue de qualité qui le porte
 *  (data-vue-qualite), nom son nom accessible — aria-label, sinon le texte
 *  de aria-labelledby —, description le texte de aria-describedby. */
export function releverGraphiques(racine) {
  return [...racine.querySelectorAll('svg[data-graphique]')].filter(rendu).map((svg) => ({
    ou: situer(svg),
    vue: svg.closest('[data-vue-qualite]')?.dataset.vueQualite ?? null,
    role: svg.getAttribute('role'),
    nom: (svg.getAttribute('aria-label') ?? '').trim() || texteDesIdentifiants(svg.getAttribute('aria-labelledby')),
    description: texteDesIdentifiants(svg.getAttribute('aria-describedby')),
  }));
}

/** Fautes des graphiques d'un écran (releverGraphiques) : chacun une image
 *  (role img), nommée et décrite, et deux graphiques de vues différentes
 *  jamais du même nom. */
export function fautesGraphiques(graphiques) {
  const fautes = [];
  for (const g of graphiques) {
    if (g.role !== 'img') fautes.push(`${g.ou} : rôle ${g.role ?? 'absent'}, img attendu`);
    if (g.nom === '') fautes.push(`${g.ou} : sans nom accessible`);
    if (g.description === '') fautes.push(`${g.ou} : sans description`);
  }
  for (let i = 0; i < graphiques.length; i += 1) {
    for (let j = i + 1; j < graphiques.length; j += 1) {
      const [a, b] = [graphiques[i], graphiques[j]];
      if (a.nom !== '' && a.nom === b.nom && a.vue !== b.vue) fautes.push(`${a.ou} (${a.vue}) et ${b.ou} (${b.vue}) : même nom « ${extrait(a.nom)} »`);
    }
  }
  return fautes;
}

// --- La vue de comparaison, le départ et les dérivées ----------------------------------------

// Les pourcentages qu'une colonne côte à côte porte au plus : ceux des
// trois tuiles qui en portent un (D67, C29).
const POURCENTAGES_PAR_COLONNE = 3;

// La vue de comparaison sous racine, racine comprise.
const vuesComparaison = (racine) => [...(racine.matches?.('[data-vue-qualite="comparaison"]') ? [racine] : []), ...racine.querySelectorAll('[data-vue-qualite="comparaison"]')];

/**
 * Les pourcentages rendus dans la vue de comparaison sous racine (contrainte
 * 44, D67, C29) : chaque [data-pourcentage] rendu de la vue se tient dans
 * une colonne côte à côte — le plus proche [data-colonne-comparaison] —,
 * jamais dans une phrase, au tracé, à son infobulle ni à l'escalier ; le
 * [data-compte-pire] qui le suit est dans la même colonne et, de deux
 * entiers, redonne la valeur écrite (fauteDuCompte) : le compte de l'autre
 * placement se trahit dès que leurs rapports diffèrent. Une colonne en
 * porte au plus POURCENTAGES_PAR_COLONNE, et les deux colonnes autant. Un
 * pourcentage hors de la vue — une tuile — ne se lit pas ici.
 * → { lus, parColonne: { a, b }, fautes }.
 */
export function releverPourcentagesComparaison(racine) {
  const fautes = [];
  const parColonne = { a: 0, b: 0 };
  let lus = 0;
  for (const vue of vuesComparaison(racine)) {
    for (const valeur of vue.querySelectorAll('[data-pourcentage]')) {
      if (!rendu(valeur)) continue;
      lus += 1;
      const nomme = `${situer(valeur)} « ${extrait(valeur.textContent)} »`;
      const colonne = valeur.closest('[data-colonne-comparaison]')?.dataset.colonneComparaison ?? null;
      if (colonne === null) {
        fautes.push(`${nomme} : hors d’une colonne côte à côte`);
        continue;
      }
      parColonne[colonne] = (parColonne[colonne] ?? 0) + 1;
      const compte = valeur.nextElementSibling;
      if (compte === null || !compte.matches('[data-compte-pire]')) continue;
      const colonneDuCompte = compte.closest('[data-colonne-comparaison]').dataset.colonneComparaison;
      if (colonneDuCompte !== colonne) fautes.push(`${nomme} : son compte est dans la colonne ${colonneDuCompte}, lui dans la colonne ${colonne}`);
      const faute = fauteDuCompte(valeur, compte);
      if (faute !== null) fautes.push(`${nomme} : ${faute}`);
    }
  }
  for (const [colonne, n] of Object.entries(parColonne)) {
    if (n > POURCENTAGES_PAR_COLONNE) fautes.push(`colonne ${colonne} : ${n} pourcentages, trois au plus`);
  }
  if (parColonne.a !== parColonne.b) fautes.push(`colonnes a et b : ${parColonne.a} et ${parColonne.b} pourcentages, autant de chaque côté`);
  return { lus, parColonne, fautes };
}

/** Fautes des deux séries du tracé de la comparaison (D60, § 12.7) — jamais
 *  la seule couleur : traces, celles de releverTraces, dont les genres a et
 *  b sont les deux placements ; la série a et la série b ont des signatures
 *  distinctes et des motifs distincts. Une paire absente est une faute. */
export function fautesSeriesComparaison(traces) {
  const de = (genre) => traces[genre] ?? [];
  const motifs = (genre) => de(genre).map(({ ou, motif }) => ({ ou, sig: motif }));
  return [...fautesPaire('série a / série b', de('a'), de('b')), ...fautesPaire('motif a / motif b', motifs('a'), motifs('b'))];
}

/** Les couleurs que peignent les deux séries du tracé de la comparaison
 *  sous racine, dans le thème courant : { a, b }, chacune [{ ou, couleur }],
 *  le trait calculé de chaque tracé rendu, une couleur relevée une fois. */
export function releverSeriesComparaison(racine) {
  const series = { a: [], b: [] };
  for (const trace of racine.querySelectorAll('svg[data-graphique="comparaison"] path[data-serie="a"], svg[data-graphique="comparaison"] path[data-serie="b"]')) {
    if (!rendu(trace)) continue;
    const liste = series[trace.dataset.serie];
    for (const couleur of couleursPeintes(trace).stroke) if (!liste.some((x) => egales(x.couleur, couleur))) liste.push({ ou: situer(trace), couleur });
  }
  return series;
}

/** Fautes de séparation des deux séries de la comparaison
 *  (releverSeriesComparaison) : chaque couleur de a s'écarte de chaque
 *  couleur de b d'au moins SEPARATIONS.autresMarques (ecartPercu), sur les
 *  couleurs d'origine puis sous chaque dichromatie (§ 12.7, D43). Une série
 *  sans couleur relevée est une faute : la mesure n'a pas eu lieu. */
export function fautesSeparationComparaison({ a, b }) {
  if (a.length === 0 || b.length === 0) return [`séries a / b : paire absente (${a.length} et ${b.length})`];
  const fautes = [];
  for (const x of a) {
    for (const y of b) {
      for (const vue of VUES_SEPARATION) {
        const vu = (c) => (vue === 'origine' ? c : simuler(c, vue));
        const ecart = ecartPercu(vu(x.couleur), vu(y.couleur));
        if (ecart < SEPARATIONS.autresMarques) fautes.push(`${x.ou} ${rgb(x.couleur)} et ${y.ou} ${rgb(y.couleur)} : écart ${ecart.toFixed(1)} (${vue}), ${SEPARATIONS.autresMarques} au moins`);
      }
    }
  }
  return fautes;
}

// Les commandes de ligne du tableau des propositions (D85) : le bouton du
// menu « Actions » de chaque ligne, celle du retenu comprise, et, dans un
// menu ouvert, « Repartir d'elle » et « Comparer » d'une proposition,
// « Comparer » du retenu.
const COMMANDES_DE_LIGNE = [
  '[data-proposition] [data-menu-actions]',
  '[data-retenu] [data-menu-actions]',
  '[data-proposition] [role="menuitem"][data-commande="repartir"]',
  '[data-proposition] [role="menuitem"][data-commande="comparer"]',
  '[data-retenu] [role="menuitem"][data-commande="comparer"]',
].join(', ');

// Le nom accessible d'un bouton : son aria-label, sinon son texte.
const nomAccessible = (bouton) => (bouton.getAttribute('aria-label') ?? '').trim() || bouton.textContent.replace(/\s+/g, ' ').trim();

/**
 * Les noms accessibles des commandes de ligne rendues sous racine (D85) :
 * deux commandes n'ont jamais le même, et celui d'une commande d'une ligne
 * de proposition porte le numéro de sa ligne (data-proposition) parmi ses
 * entiers. → { lues, fautes }, lues le nombre de commandes lues.
 */
export function releverCommandesDeLigne(racine) {
  const fautes = [];
  const vus = new Map();
  let lues = 0;
  for (const bouton of racine.querySelectorAll(COMMANDES_DE_LIGNE)) {
    if (!rendu(bouton)) continue;
    lues += 1;
    const nom = nomAccessible(bouton);
    const ligne = bouton.closest('[data-proposition]')?.dataset.proposition ?? null;
    if (ligne !== null && !entiersDe(nom).includes(Number(ligne))) fautes.push(`${situer(bouton)} « ${extrait(nom)} » : ne porte pas le numéro ${ligne} de sa ligne`);
    if (vus.has(nom)) fautes.push(`${situer(bouton)} et ${vus.get(nom)} : même nom accessible « ${extrait(nom)} »`);
    else vus.set(nom, situer(bouton));
  }
  return { lues, fautes };
}

/** Ce qu'un écran de la page de qualité rend, hors des thèmes : null hors
 *  de la page. Sinon les pourcentages, les niveaux, les tracés et les
 *  graphiques, les phrases de cas (data-phrase-qualite), le nombre de
 *  jumeaux ouverts et les vues qui les portent (vuesJumeau), le nombre de
 *  points de relevé, la ligne de tête de la course, et la largeur rendue,
 *  en px, de chaque segment « prouvé inévitable » des collisions
 *  (prouvesCollisions). */
function releverQualite(racine) {
  const section = racine.querySelector('[data-section="qualite"]');
  if (section === null) return null;
  return {
    pourcentages: releverPourcentages(racine),
    niveaux: releverNiveaux(section),
    traces: releverTraces(section),
    graphiques: releverGraphiques(section),
    phrases: [...section.querySelectorAll('[data-phrase-qualite]')].filter(rendu).map((p) => p.dataset.phraseQualite),
    jumeaux: [...section.querySelectorAll('[data-jumeau]')].filter(rendu).length,
    vuesJumeau: [
      ...new Set(
        [...section.querySelectorAll('[data-jumeau]')]
          .filter(rendu)
          .map((jumeau) => jumeau.closest('[data-vue-qualite]')?.dataset.vueQualite ?? null),
      ),
    ],
    prouvesCollisions: [...section.querySelectorAll('[data-graphique="collisions"] [data-segment="prouve"]')]
      .filter(rendu)
      .map((segment) => segment.getBoundingClientRect().width),
    pointsReleve: [...section.querySelectorAll('[data-point-releve]')].filter(rendu).length,
    course: section.querySelector('[data-course]') !== null,
    comparaison: releverComparaison(section),
  };
}

// Un texte rendu, ses blancs réduits à une espace, sans blanc aux bouts.
const texteReduit = (texte) => texte.replace(/\s+/g, ' ').trim();

/** Ce que la vue de comparaison rend sous la section de qualité, hors des
 *  thèmes : null quand elle ne s'est pas calculée. Sinon ses phrases
 *  (data-phrase-comparaison), ses pourcentages (releverPourcentagesComparaison),
 *  chaque pourcentage rendu dans une colonne avec son compte, dans l'ordre
 *  des lignes — { nom, cote, valeur, compte }, nom la ligne, cote la
 *  colonne —, les tracés de ses deux séries (releverTraces, genres a et b),
 *  le texte de l'en-tête de chaque colonne, la place de chacune, et l'état
 *  du repli et de son jumeau. */
function releverComparaison(section) {
  const vue = section.querySelector('[data-vue-qualite="comparaison"]');
  if (vue === null || vue.querySelector('[data-phrase-comparaison]') === null) return null;
  const texte = (selecteur) => {
    const element = vue.querySelector(selecteur);
    return element === null ? null : texteReduit(element.textContent);
  };
  const enColonne = (ligne) =>
    [...ligne.querySelectorAll('td[data-colonne-comparaison]')].flatMap((cellule) =>
      [...cellule.querySelectorAll('[data-pourcentage]')].filter(rendu).map((valeur) => ({
        nom: ligne.dataset.colonne,
        cote: cellule.dataset.colonneComparaison,
        valeur: texteReduit(valeur.textContent),
        compte: texteReduit(valeur.nextElementSibling?.textContent ?? ''),
      })),
    );
  return {
    phrases: [...vue.querySelectorAll('[data-phrase-comparaison]')].filter(rendu).map((p) => p.dataset.phraseComparaison),
    pourcentages: releverPourcentagesComparaison(vue),
    pourcentagesEnColonne: [...vue.querySelectorAll('tr[data-colonne]')].flatMap(enColonne),
    traces: releverTraces(vue).traces,
    trace: vue.querySelector('svg[data-graphique="comparaison"]') !== null,
    entetes: { a: texte('th[data-colonne-comparaison="a"]'), b: texte('th[data-colonne-comparaison="b"]') },
    rangs: { a: texte('tr[data-colonne="rang"] td[data-colonne-comparaison="a"]'), b: texte('tr[data-colonne="rang"] td[data-colonne-comparaison="b"]') },
    repli: vue.querySelector('[data-tous-les-indicateurs][aria-expanded="true"]') !== null,
    jumeau: [...vue.querySelectorAll('[data-jumeau]')].some(rendu),
  };
}

/** La carte du départ de la section Génération sous racine : null sans
 *  carte ; sinon son titre — l'élément que nomme son aria-labelledby, qui
 *  dit le numéro du départ —, null sans titre, et les tours dont la case
 *  est cochée, croissants. */
function releverDepart(racine) {
  const carte = racine.querySelector('[data-section="generation"] [data-depart]');
  if (carte === null || !rendu(carte)) return null;
  const titre = document.getElementById(carte.getAttribute('aria-labelledby') ?? '');
  return {
    titre: titre === null ? null : texteReduit(titre.textContent),
    figes: [...carte.querySelectorAll('[data-tour-fige]')].filter((c) => c.checked).map((c) => Number(c.dataset.tourFige)),
  };
}

/** Les pourcentages que les colonnes de la comparaison de a à b rendent
 *  pour charge, en langue témoin, dans l'ordre des lignes et A avant B :
 *  [{ nom, cote, valeur, compte }], comme pourcentagesEnColonne les relève,
 *  tirés de colonnesComparaison — le modèle que ColonnesComparaison.svelte
 *  câble —, les blancs réduits. Un pourcentage sans valeur s'écrit « — ». */
function pourcentagesAttendus(charge, a, b) {
  const table = evaluer(charge);
  const outils = { t: tTemoin, format: creerFormat(tTemoin), nomDe: (id) => nomDe(charge, id) };
  const { tete, groupes } = colonnesComparaison(comparerPlacements(charge, table, a, b), table, outils);
  return [...tete, ...groupes.flatMap(({ lignes }) => lignes)].flatMap((ligne) =>
    ['a', 'b']
      .filter((cote) => ligne[cote].pourcentage !== null)
      .map((cote) => ({
        nom: ligne.nom,
        cote,
        valeur: texteReduit(ligne[cote].pourcentage.texte ?? tTemoin('format.vide')),
        compte: texteReduit(ligne[cote].pourcentage.compte),
      })),
  );
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
    const section = racine.querySelector('[data-section="qualite"]');
    return {
      textes,
      marques,
      teinte: fautesTeinte(racine, teintesDeConflit()),
      teintesGraphique: fautesTeintesGraphique(racine),
      separation: section === null ? null : releverSeparation(section),
      seriesComparaison: section === null ? null : releverSeriesComparaison(section),
    };
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
      releve.typographie = fautesTypographie(racine);
      releve.bandeau = fautesBandeau(racine, ecran.mode);
      releve.formulaires = fautesFormulaires(racine);
      releve.imbrication = fautesImbrication(racine);
      releve.refus = releverRefus(racine).map((r) => ({ ...r, restes: horsMarques(r.texte).filter((x) => !estDonnee(x, connues)) }));
      releve.etats = releverEtats(m);
      releve.listes = releverListes(racine);
      releve.signatureMode = signatureMode(racine);
      releve.qualite = releverQualite(racine);
      releve.depart = releverDepart(racine);
      releve.commandesDeLigne = releverCommandesDeLigne(racine);
      releve.filiations = [...racine.querySelectorAll('[data-section="propositions"] [data-filiation]')].filter(rendu).length;
      releve.clair = releverTheme(racine);
      m.ui.choisirTheme('sombre');
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

  test('imbrication : un bloc dans un <span>, un <p> dans un <p> par le DOM, une liste dans un <button> sont relevés ; un <span> dans un <div> et le SVG passent', () => {
    const { fautes, lus } = avecFragment('<div><span>a</span></div><span class="x"><div>b</div></span><svg><g><text>c</text></g></svg>', (c) => {
      const p = document.createElement('p');
      p.append(document.createElement('p'));
      const bouton = document.createElement('button');
      bouton.append(document.createElement('ul'));
      c.append(p, bouton);
      return fautesImbrication(c);
    });
    expect(lus).toBe(5);
    expect(fautes).toHaveLength(3);
    expect(fautes[0]).toMatch(/^div.* dans span/);
    expect(fautes[1]).toMatch(/^p.* dans p/);
    expect(fautes[2]).toMatch(/^ul.* dans button/);
  });

  test('emoji : un pictogramme dans un texte est relevé', () => {
    const { fautes, lus } = avecFragment(`<p>${OUVERTURE}Prêt${FERMETURE} \u{1F642}</p><p>${OUVERTURE}2 + 2${FERMETURE}</p>`, (c) => fautesEmoji(c));
    expect(lus).toBe(2);
    expect(fautes).toHaveLength(1);
  });

  test('typographie : une espace ordinaire devant « ; », « : », « ? », « ! » ou « » », ou après « « », est relevée, texte ou attribut ; l’insécable et un signe collé passent', () => {
    const { fautes, lus } = avecFragment(
      `<p>${OUVERTURE}Table 3 : 4 places${FERMETURE}</p><p>« Iris\u{A0}»</p><p>a ; b</p><p>Oui !</p><p>«\u{A0}Iris »</p>` +
        '<button aria-label="Fermer ?">x</button>' +
        `<p>${OUVERTURE}Table 3\u{A0}: 4 places\u{202F}; «\u{A0}Iris\u{A0}»\u{202F}?\u{202F}!${FERMETURE}</p><p>https://exemple.test à 21:42</p>`,
      (c) => fautesTypographie(c),
    );
    // Sept paragraphes, le texte du bouton et son aria-label : une faute par
    // signe de la garde, chacune nommée par son signe.
    expect(lus).toBe(9);
    expect(fautes).toEqual([
      `p : « ${OUVERTURE}Table 3 : 4 places${FERMETURE} » (« : »)`,
      'p : « « Iris » » (« « »)',
      'p : « a ; b » (« ; »)',
      'p : « Oui ! » (« ! »)',
      'p : « « Iris » » (« » »)',
      'button[aria-label] : « Fermer ? » (« ? »)',
    ]);
  });

  test('typographie : une espace ordinaire entre un nombre et son unité, entre « h » et les minutes, après « n° », entre jour et mois ou mois et année est relevée ; l’insécable et un mot qui n’est pas une unité passent', () => {
    const { fautes, lus } = avecFragment(
      '<p>12,5 s</p><p>20\u{A0}h 30</p><p>proposition n° 4</p><p>le 17 mai</p><p>en mai 2031</p>' +
        '<p>12,5\u{A0}s, 20\u{A0}h\u{A0}30, 3\u{A0}min 4\u{A0}s, 2\u{A0}h 15\u{A0}min, n°\u{A0}4, 17\u{A0}mai\u{A0}2031, 12\u{202F}%, ' +
        'du 3\u{A0}mai-5\u{A0}juin, de 20\u{A0}h\u{A0}30-22\u{A0}h\u{A0}00</p>' +
        "<p>3 sièges, 4 tours, 2 places, 100\u{202F}000 mouvements, 3 s'y rangent, 21:42, A4 m</p>" +
        '<p>3 s\u{2019}y rangent</p><p>3 s-bornes</p><p>xn° 4</p>',
      (c) => fautesTypographie(c),
    );
    // Dix paragraphes : une faute par place de la garde, chacune nommée par
    // son extrait. Les cinq derniers ne portent que des formes qui passent ;
    // les trois derniers, une seule chacun, pour que chacune se nomme : une
    // unité que suit une apostrophe typographique, une unité que suit un
    // trait d'union, un « n° » collé à la lettre qui le précède.
    expect(lus).toBe(10);
    expect(fautes).toEqual([
      'p : « 12,5 s » (« 12,5 s »)',
      'p : « 20 h 30 » (« h 30 »)',
      'p : « proposition n° 4 » (« n° »)',
      'p : « le 17 mai » (« 17 mai »)',
      'p : « en mai 2031 » (« mai 2031 »)',
    ]);
  });

  test('typographie : la garde ne relève aucune sortie de typographier, et relève le brut de chaque texte qu’elle change', () => {
    // Une plage au trait d'union, une date suivie d'un guillemet simple, un
    // mot qui commence par une unité ou un mois sans en être un, des minutes
    // qu'un mot à apostrophe suit, un mois ou une année collés à un chiffre
    // ou à une lettre.
    const textes = [
      'du 3 mai-5 juin',
      'de 20 h 30-22 h 00',
      '17 mai 2031-2032',
      '\u{2018}le 31 mai\u{2019}',
      "3 s'y rangent",
      '3 maisons',
      '2 hérons',
      "20\u{A0}h 30 s'y rangent",
      'le 3 mai2031',
      'du 3mai 2031',
      'en mai 2031e',
    ];
    const lire = (texte) => avecFragment(`<p>${texte}</p>`, (c) => fautesTypographie(c).fautes);
    for (const texte of textes) {
      const rendu = typographier(texte);
      expect(lire(rendu), `sortie ${JSON.stringify(rendu)}`).toEqual([]);
      expect(lire(texte), `brut ${JSON.stringify(texte)}`).toHaveLength(rendu === texte ? 0 : 1);
    }
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

  test('marques : un texte au trait du registre — le filigrane — se mesure à son contour sur ce qui est peint sous lui, non comme un texte ; un contour noyé dans son fond est relevé ; un texte du document imprimé ne se compare pas d’un thème à l’autre', () => {
    const fragment = (fond) =>
      `<div data-impression style="background:${fond};padding:8px"><p style="color:#1c2128">papier</p>` +
      '<svg width="240" height="60"><text data-marque="filigrane" x="10" y="40" ' +
      'style="fill:none;stroke:var(--couleur-filigrane);stroke-width:1px;font-size:30px">BROUILLON</text></svg></div>';
    const lire = (fond) => avecFragment(fragment(fond), (c) => ({ marques: releverMarques(c), textes: releverTextes(c) }));
    const net = lire('#ffffff');
    expect(net.marques.vues).toEqual(['filigrane']);
    expect(net.marques.mesures).toBe(1);
    expect(net.marques.fautes).toEqual([]);
    expect(net.textes.mesures).toBe(1);
    expect(net.textes.fautes).toEqual([]);
    expect([...net.textes.couleurs]).toEqual([]);
    const noye = lire(rgb(couleurDeJeton('--couleur-filigrane')));
    expect(noye.marques.fautes).toHaveLength(1);
    expect(noye.marques.fautes[0]).toContain('1.00:1');
  });

  test('marques : sous le document imprimé, une marque se mesure au jeton du papier — celui du clair, dans les deux thèmes —, non à celui de la page', () => {
    const racine = document.documentElement;
    const theme = racine.getAttribute('data-theme');
    racine.setAttribute('data-theme', 'sombre');
    try {
      const { vues, fautes, mesures } = avecFragment(
        '<div data-impression style="background:var(--couleur-papier);padding:8px"><svg width="60" height="40">' +
          '<circle data-marque="contourTable" cx="20" cy="20" r="12" style="fill:var(--couleur-papier);stroke:var(--couleur-table-trait);stroke-width:3px" />' +
          '</svg></div>',
        (c) => releverMarques(c),
      );
      expect(vues).toEqual(['contourTable']);
      expect(fautes).toEqual([]);
      expect(mesures).toBe(1);
    } finally {
      if (theme === null) racine.removeAttribute('data-theme');
      else racine.setAttribute('data-theme', theme);
    }
  });

  test('le pont retiré : chaque marque de graphique est versée dans MARQUES, le seul registre que releverMarques lit', () => {
    const noms = MARQUES.map(({ nom }) => nom);
    expect(MARQUES_GRAPHIQUE.length).toBeGreaterThan(0);
    for (const { nom } of MARQUES_GRAPHIQUE) expect(noms, nom).toContain(nom);
    expect(SOURCE_CAPTURES).not.toMatch(/MARQUES_GRAPHIQUE|REGISTRE_MARQUES/);
    expect(SOURCE_CAPTURES).toMatch(/const entree = MARQUES\.find\(/);
  });

  test('marques de graphique : le relevé d’un écran les connaît par MARQUES et les mesure à 3:1 ; une marque inconnue du registre et un fond de graphique restent hors du registre', () => {
    const { fautes, vues, mesures } = avecFragment(
      '<svg width="200" height="40" style="background:var(--couleur-carte-fond)">' +
        '<rect data-marque="graphiqueSerie1" x="4" y="4" width="24" height="24" style="fill:var(--couleur-graphique-serie-1)" />' +
        '<rect data-marque="graphiqueSerie3" x="60" y="4" width="24" height="24" style="fill:var(--couleur-graphique-serie-2)" />' +
        '<rect data-marque="graphiqueGrille" x="120" y="4" width="24" height="24" style="fill:var(--couleur-graphique-grille)" /></svg>' +
        '<svg width="40" height="40" style="background:var(--couleur-graphique-borne)">' +
        '<rect data-marque="graphiqueBorne" x="4" y="4" width="24" height="24" style="fill:var(--couleur-graphique-borne)" /></svg>',
      (c) => releverTheme(c).marques,
    );
    expect(vues).toEqual(['graphiqueSerie1', 'graphiqueBorne']);
    expect(mesures).toBe(2);
    expect(fautes).toHaveLength(3);
    expect(fautes[0]).toContain('graphiqueSerie3');
    expect(fautes[0]).toContain('hors du registre');
    expect(fautes[1]).toContain('graphiqueGrille');
    expect(fautes[1]).toContain('hors du registre');
    expect(fautes[2]).toContain('1.00:1');
    expect(FONDS_GRAPHIQUE.map((f) => f.nom)).toContain('graphiqueGrille');
  });

  test('marques de graphique : un repère à motif posé sur sa série se mesure contre le fond ; un repère plein, contre la série', () => {
    const trace = (designation, jeton, marque) =>
      `<path ${designation} data-marque="${marque}" d="M10 20 H190" style="fill:none;stroke:var(${jeton});stroke-width:2px" />`;
    const fragment = (motif) =>
      '<svg width="200" height="40" style="background:var(--couleur-carte-fond)">' +
      trace('data-serie="serie1"', '--couleur-graphique-serie-1', 'graphiqueSerie1') +
      trace(`data-repere="borne"${motif}`, '--couleur-graphique-borne', 'graphiqueBorne') +
      '</svg>';
    const pointille = avecFragment(fragment(' stroke-dasharray="1 3"'), (c) => releverTheme(c).marques);
    expect(pointille.vues).toEqual(['graphiqueSerie1', 'graphiqueBorne']);
    expect(pointille.mesures).toBe(2);
    expect(pointille.fautes).toEqual([]);
    const plein = avecFragment(fragment(''), (c) => releverTheme(c).marques);
    expect(plein.fautes).toHaveLength(1);
    expect(plein.fautes[0]).toContain('graphiqueBorne');
  });

  test('marques de graphique : une série à motif posée sur une autre série se mesure contre le fond ; une série pleine, contre la série qu’elle recouvre', () => {
    const trace = (designation, jeton, marque) =>
      `<path ${designation} data-marque="${marque}" d="M10 20 H190" style="fill:none;stroke:var(${jeton});stroke-width:2px" />`;
    const fragment = (motif) =>
      '<svg width="200" height="40" style="background:var(--couleur-carte-fond)">' +
      trace('data-serie="a"', '--couleur-graphique-serie-1', 'graphiqueSerie1') +
      trace(`data-serie="b"${motif}`, '--couleur-graphique-serie-2', 'graphiqueSerie2') +
      '</svg>';
    const tirets = avecFragment(fragment(' stroke-dasharray="6 4"'), (c) => releverTheme(c).marques);
    expect(tirets.vues).toEqual(['graphiqueSerie1', 'graphiqueSerie2']);
    expect(tirets.mesures).toBe(2);
    expect(tirets.fautes).toEqual([]);
    const plein = avecFragment(fragment(''), (c) => releverTheme(c).marques);
    expect(plein.fautes).toHaveLength(1);
    expect(plein.fautes[0]).toContain('graphiqueSerie2');
  });

  test('marques de graphique : le relevé du parcours photographié (stylesDuTheme) les connaît aussi — une série sur la carte ne porte aucune faute et se range sous son jeton, rôle marque', () => {
    const { styles, fautes } = avecFragment(
      '<svg width="200" height="40" style="background:var(--couleur-carte-fond)">' +
        '<rect data-marque="graphiqueSerie1" x="4" y="4" width="24" height="24" style="fill:var(--couleur-graphique-serie-1)" /></svg>',
      (c) => stylesDuTheme(c),
    );
    expect(fautes).toEqual([]);
    expect(styles.filter((s) => s.role === 'marque').map((s) => s.jeton)).toEqual(['--couleur-graphique-serie-1']);
  });

  test('marques sous une fenêtre modale : une marque HTML de la page, qui ne s’y mesure pas, ne compte pas comme vue ; une marque dans la fenêtre, si', () => {
    const { vues } = avecFragment(
      '<p data-marque="gel" style="border:2px solid var(--couleur-gel)">dehors</p>' +
        '<dialog><p data-marque="selection" style="border:2px solid var(--couleur-selection)">dedans</p></dialog>',
      (c) => {
        const fenetre = c.querySelector('dialog');
        fenetre.showModal();
        try {
          return releverMarques(c);
        } finally {
          fenetre.close();
        }
      },
    );
    expect(vues).toEqual(['selection']);
  });

  test('qualité, pourcentages : un pourcentage sans compte, ou d’un compte vide, est relevé ; un « % » hors d’un pourcentage, d’une graduation de l’axe vertical du graphique en pourcentages et du repère « cent », sur le tracé ou dans sa légende, est relevé — une graduation de l’abscisse, un attribut annoncé compris', () => {
    const { lus, dansInfobulle, dansJumeaux, fautes, signes } = avecFragment(
      '<p><span data-pourcentage>88 %</span><span data-compte-pire>minimum 24 sur 27</span></p>' +
        '<p><span data-pourcentage>50 %</span></p><p><span data-pourcentage>40 %</span><span data-compte-pire> </span></p>' +
        '<div role="tooltip"><span data-pourcentage>7 %</span><span data-compte-pire>1 sur 14</span></div>' +
        '<table data-jumeau="0"><tbody><tr><td><span data-pourcentage>9 %</span><span data-compte-pire>1 sur 11</span></td></tr></tbody></table>' +
        '<p>12 %</p><button aria-label="9 %">x</button>' +
        '<div><svg data-graphique="profilPourcentages" width="200" height="60">' +
        '<text x="40" y="10" text-anchor="end">50 %</text><text data-repere="cent" x="60" y="30">100 %</text>' +
        '<text data-serie="serie1" x="60" y="50">3 %</text><text x="80" y="58" text-anchor="middle">4 %</text></svg>' +
        '<ul><li><span>100 %</span></li><li><span>7 %</span></li></ul></div>' +
        '<svg data-graphique="profilComptes" width="200" height="30"><text x="40" y="10" text-anchor="end">20 %</text></svg>',
      (c) => releverPourcentages(c),
    );
    expect([lus, dansInfobulle, dansJumeaux]).toEqual([5, 1, 1]);
    expect(fautes).toHaveLength(2);
    expect(fautes[0]).toContain('aucun [data-compte-pire]');
    expect(fautes[1]).toContain('compte du pire est vide');
    expect(signes.lus).toBe(14);
    expect(signes.fautes).toHaveLength(6);
    expect(signes.fautes.join('\n')).toContain('« 4 % »');
    expect(signes.fautes.join('\n')).toContain('« 7 % »');
    expect(signes.fautes.join('\n')).toMatch(/^p : « 12 % »/m);
    expect(signes.fautes.join('\n')).toContain('[data-serie="serie1"]');
    expect(signes.fautes.join('\n')).toContain('« 20 % »');
    expect(signes.fautes.join('\n')).toContain('[aria-label] : « 9 % »');
  });

  test('qualité, pourcentages : le compte d’une ligne est le sien, numérateur sur dénominateur ; deux entiers rendent la valeur écrite', () => {
    const paire = (valeur, compte) => `<span data-pourcentage>${valeur}</span><span data-compte-pire>${compte}</span>`;
    const ligne = (valeur, compte) => `<tr><td>${paire(valeur, compte)}</td></tr>`;
    const { lus, fautes } = avecFragment(
      `<p>${paire('88\u{202F}%', 'minimum 24 sur 27')}</p><p>${paire('77\u{202F}% des tours possibles servis', '3 personnes jamais servies')}</p>` +
        '<table data-jumeau="0"><tbody>' +
        ligne('62\u{202F}%', '5 organisations pour 8 sièges') +
        ligne('80\u{202F}%', '24 servis sur 30 possibles') +
        ligne('1\u{202F}%', '1 sur 250') +
        ligne('\u{2014}', '0 sur 0') +
        ligne('\u{2014}', 'aucun affilié à ce tour') +
        ligne('12\u{202F}%', 'aucun affilié à ce tour') +
        ligne('9\u{202F}%', '1 sur 14') +
        ligne('\u{2014}', '2 sur 5') +
        ligne('40\u{202F}%', '2 sur 0') +
        '</tbody></table>' +
        `<div role="tooltip">${paire('50\u{202F}%', '3 personnes jamais servies')}</div>` +
        `<p>${paire('70\u{202F}%', 'minimum 24 sur 27')}</p>`,
      (c) => releverPourcentages(c),
    );
    expect(lus).toBe(13);
    expect(fautes).toHaveLength(6);
    expect(fautes[0]).toContain('« aucun affilié à ce tour » n’est pas le compte de sa ligne');
    expect(fautes[1]).toMatch(/« 9\s% » : son compte 1 sur 14 donne 7\u{202F}%$/u);
    expect(fautes[2]).toContain('2 sur 5 donne 40\u{202F}%');
    expect(fautes[3]).toContain('2 sur 0 donne \u{2014}');
    expect(fautes[4]).toContain('« 3 personnes jamais servies » n’est pas le compte de sa ligne');
    expect(fautes[5]).toContain('minimum 24 sur 27 donne 88\u{202F}%');
  });

  test('qualité, niveaux : une grille rend les niveaux que portent ses cases, lus sur leur remplissage calculé ; une forme hors d’une case ne compte pas', () => {
    const cases = [0, 2, 2]
      .map((k, i) => `<g data-case="0:${i}"><rect x="${30 * i}" width="20" height="20" style="fill:var(--couleur-graphique-niveau-${k})" /></g>`)
      .join('');
    const grilles = avecFragment(
      `<svg data-graphique="matrice" width="120" height="30">${cases}<rect x="100" width="10" height="10" style="fill:var(--couleur-graphique-niveau-3)" /></svg>`,
      (c) => releverNiveaux(c),
    );
    expect(grilles).toEqual([{ graphique: 'matrice', niveaux: [0, 2] }]);
  });

  test('qualité, tracés : deux séries de même trait, une borne du motif d’une série, une règle « cent » d’un autre motif que le plafond, deux segments que seule la couleur sépare sont relevés', () => {
    const trace = (attribut, jeton, motif) =>
      `<path ${attribut} d="M10 10 H190" style="fill:none;stroke:var(${jeton});stroke-width:2px"${motif === null ? '' : ` stroke-dasharray="${motif}"`} />`;
    const fragment = (motifs) =>
      '<svg width="200" height="60">' +
      trace('data-serie="serie1"', '--couleur-graphique-serie-1', motifs.serie1) +
      trace('data-serie="serie2"', '--couleur-graphique-serie-2', motifs.serie2) +
      trace('data-repere="plafond"', '--couleur-graphique-repere', motifs.plafond) +
      trace('data-repere="borne"', '--couleur-graphique-borne', motifs.borne) +
      trace('data-repere="cent"', '--couleur-graphique-repere', motifs.cent) +
      '<rect data-segment="prouve" x="10" y="30" width="40" height="10" style="fill:var(--couleur-graphique-prouve)" />' +
      `<rect data-segment="reste" x="50" y="30" width="40" height="10" style="fill:var(--couleur-graphique-reste)"${motifs.reste} /></svg>`;
    const justes = { serie1: null, serie2: '6 4', plafond: '8 3 2 3', borne: '2 3', cent: '8 3 2 3', reste: ' stroke="#000" stroke-width="1"' };
    const juste = avecFragment(fragment(justes), (c) => releverTraces(c));
    expect(fautesTraces(juste)).toEqual([]);
    const fautive = avecFragment(fragment({ ...justes, serie2: null, borne: null, cent: '2 3', reste: '' }), (c) => releverTraces(c));
    const fautes = fautesTraces(fautive);
    expect(fautes.some((f) => f.startsWith('série 1 / série 2'))).toBe(true);
    expect(fautes.some((f) => f.startsWith('prouvé inévitable / reste'))).toBe(true);
    expect(fautes.some((f) => f.startsWith('motif serie1 / borne'))).toBe(true);
    expect(fautes.some((f) => f.startsWith('motif cent'))).toBe(true);
    expect(fautesTraces({ traces: {}, segments: { prouve: [], reste: [] } }).some((f) => f.includes('paire absente'))).toBe(true);
  });

  test('qualité, séparation : une série peinte d’une couleur que la marque d’une teinte d’organisation rendue ne quitte pas d’assez loin est relevée, sous chaque vue ; ses jetons passent ; sans série ou sans teinte, la paire absente', () => {
    const fragment = (jetonSerie) =>
      '<svg width="200" height="30">' +
      `<path data-serie="serie1" d="M10 10 H190" style="fill:none;stroke:var(${jetonSerie});stroke-width:2px" /></svg>` +
      '<span style="display:inline-block;width:12px;height:12px;background-color:var(--couleur-organisation-2-marque)"></span>';
    const juste = avecFragment(fragment('--couleur-graphique-serie-1'), (c) => releverSeparation(c));
    expect(juste.series).toHaveLength(1);
    expect(juste.teintes).toHaveLength(1);
    expect(fautesSeparation(juste)).toEqual([]);
    const fautes = fautesSeparation(avecFragment(fragment('--couleur-organisation-2-marque'), (c) => releverSeparation(c)));
    expect(fautes).toHaveLength(4);
    expect(fautes[0]).toMatch(/^path\b.*span\b.*écart 0\.0 \(origine\)/);
    expect(fautes.map((f) => /\(([a-z]+)\)/.exec(f)[1])).toEqual(['origine', ...Object.keys(SIMULATIONS)]);
    expect(fautesSeparation({ series: juste.series, teintes: [] })).toEqual(['séries / teintes d’organisation : paire absente (1 et 0)']);
  });

  test('qualité, teintes : une marque de graphique peinte d’une teinte d’organisation ou du rouge du retrait est relevée ; une série de son jeton passe', () => {
    const { fautes, lus } = avecFragment(
      '<svg data-graphique="collisions" width="200" height="30">' +
        '<rect data-marque="graphiqueSerie1" width="20" height="20" style="fill:var(--couleur-graphique-serie-1)" />' +
        '<rect data-marque="graphiqueReste" x="40" width="20" height="20" style="fill:var(--couleur-organisation-2-marque)" />' +
        '<path data-marque="graphiqueRepere" d="M80 10 H150" style="fill:none;stroke:var(--couleur-retrait);stroke-width:2px" /></svg>',
      (c) => fautesTeintesGraphique(c),
    );
    expect(lus).toBe(3);
    expect(fautes).toHaveLength(2);
    expect(fautes[0]).toContain('--couleur-organisation-2-marque');
    expect(fautes[1]).toContain('--couleur-retrait');
  });

  test('qualité, graphiques : un graphique sans rôle img, sans nom ou sans description est relevé, et deux graphiques de vues différentes du même nom', () => {
    const graphique = (vue, nom, decrit) =>
      `<div data-vue-qualite="${vue}"><span id="n-${vue}" hidden>${nom}</span><p id="d-${vue}">synthèse</p>` +
      `<svg data-graphique="${vue}" role="img" width="40" height="20" aria-labelledby="n-${vue}"${decrit ? ` aria-describedby="d-${vue}"` : ''}></svg></div>`;
    const fautes = avecFragment(
      graphique('profil', 'Qui est mal servi ?', true) + graphique('paires', 'Qui est mal servi ?', true) + graphique('tables', '', false) +
        '<svg data-graphique="nu" width="40" height="20"></svg>',
      (c) => fautesGraphiques(releverGraphiques(c)),
    );
    expect(fautes).toHaveLength(6);
    expect(fautes.filter((f) => f.includes('sans nom accessible'))).toHaveLength(2);
    expect(fautes.filter((f) => f.includes('sans description'))).toHaveLength(2);
    expect(fautes.filter((f) => f.includes('rôle absent'))).toHaveLength(1);
    expect(fautes.filter((f) => f.includes('même nom'))).toHaveLength(1);
  });

  test('comparaison, pourcentages : dans une phrase, compte échangé entre A et B ou posé dans l’autre colonne, plus de trois par colonne, colonnes inégales — chacun relevé', () => {
    const paire = (valeur, compte, colonneDuCompte = '') =>
      `<span data-pourcentage>${valeur}</span><span data-compte-pire${colonneDuCompte}>${compte}</span>`;
    const ligne = (nom, a, b) => `<tr data-colonne="${nom}"><td data-colonne-comparaison="a">${a}</td><td data-colonne-comparaison="b">${b}</td></tr>`;
    const vue = (lignes, apres = '') => `<div data-vue-qualite="comparaison"><table><tbody>${lignes}</tbody></table>${apres}</div>`;
    const juste = ligne('rencontresTous', paire('88\u{202F}%', 'minimum 24 sur 27'), paire('70\u{202F}%', 'minimum 19 sur 27'));
    const releve = (html) => avecFragment(html, (c) => releverPourcentagesComparaison(c));

    // Hors de la vue, un pourcentage ne se lit pas ici : les tuiles en portent.
    const bon = releve(`<p>${paire('50\u{202F}%', 'minimum 1 sur 2')}</p>${vue(juste)}`);
    expect([bon.lus, bon.parColonne]).toEqual([2, { a: 1, b: 1 }]);
    expect(bon.fautes).toEqual([]);

    const phrase = releve(vue(juste, `<p data-phrase-comparaison="effectifs">3 rangs ${paire('12\u{202F}%', '3 sur 25')}</p>`));
    expect(phrase.fautes).toHaveLength(1);
    expect(phrase.fautes[0]).toMatch(/« 12\s% » : hors d’une colonne côte à côte$/u);

    const echanges = releve(vue(ligne('rencontresTous', paire('88\u{202F}%', 'minimum 19 sur 27'), paire('70\u{202F}%', 'minimum 24 sur 27'))));
    expect(echanges.fautes).toHaveLength(2);
    expect(echanges.fautes[0]).toMatch(/« 88\s% » : son compte minimum 19 sur 27 donne 70\u{202F}%$/u);
    expect(echanges.fautes[1]).toMatch(/« 70\s% » : son compte minimum 24 sur 27 donne 88\u{202F}%$/u);

    const ailleurs = releve(vue(ligne('rencontresTous', paire('88\u{202F}%', 'minimum 24 sur 27', ' data-colonne-comparaison="b"'), paire('70\u{202F}%', 'minimum 19 sur 27'))));
    expect(ailleurs.fautes).toEqual([expect.stringMatching(/« 88\s% » : son compte est dans la colonne b, lui dans la colonne a$/u)]);

    const quatre = ['rencontresTous', 'toursHorsObjectif', 'toursSelonObjectif', 'collisionsCumulees'].map((nom) => ligne(nom, paire('50\u{202F}%', 'minimum 1 sur 2'), ''));
    const trop = releve(vue(quatre.join('')));
    expect(trop.parColonne).toEqual({ a: 4, b: 0 });
    expect(trop.fautes).toEqual(['colonne a : 4 pourcentages, trois au plus', 'colonnes a et b : 4 et 0 pourcentages, autant de chaque côté']);
  });

  test('comparaison, séries : deux courbes de même trait sont relevées ; deux séries que la vue d’origine ou une dichromatie confond aussi ; sans la série b, la paire absente', () => {
    const trace = (serie, jeton, motif) =>
      `<path data-serie="${serie}" data-marque="graphiqueSerie${serie === 'a' ? 1 : 2}" d="M10 10 H190" style="fill:none;stroke:var(${jeton});stroke-width:2px"${motif === null ? '' : ` stroke-dasharray="${motif}"`} />`;
    const graphique = (b) => `<svg data-graphique="comparaison" width="200" height="30">${trace('a', '--couleur-graphique-serie-1', null)}${b}</svg>`;
    const lire = (html) => avecFragment(html, (c) => ({ traces: releverTraces(c).traces, couleurs: releverSeriesComparaison(c) }));

    const juste = lire(graphique(trace('b', '--couleur-graphique-serie-2', '6 4')));
    expect(fautesSeriesComparaison(juste.traces)).toEqual([]);
    expect([juste.couleurs.a.length, juste.couleurs.b.length]).toEqual([1, 1]);
    expect(fautesSeparationComparaison(juste.couleurs)).toEqual([]);

    const memeTrait = lire(graphique(trace('b', '--couleur-graphique-serie-2', null)));
    const fautes = fautesSeriesComparaison(memeTrait.traces);
    expect(fautes.some((f) => f.startsWith('série a / série b') && f.includes('ne diffèrent que par la couleur'))).toBe(true);
    expect(fautes.some((f) => f.startsWith('motif a / motif b'))).toBe(true);

    const confondues = lire(graphique(trace('b', '--couleur-graphique-serie-1', '6 4')));
    expect(fautesSeriesComparaison(confondues.traces)).toEqual([]);
    expect(fautesSeparationComparaison(confondues.couleurs).map((f) => /\(([a-z]+)\)/.exec(f)[1])).toEqual(['origine', ...Object.keys(SIMULATIONS)]);

    const seule = lire(graphique(''));
    expect(fautesSeriesComparaison(seule.traces)).toContain('série a / série b : paire absente (1 et 0)');
    expect(fautesSeparationComparaison(seule.couleurs)).toEqual(['séries a / b : paire absente (1 et 0)']);
  });

  test('commandes de ligne : deux commandes de même nom accessible, et un nom qui ne porte pas le numéro de sa ligne, sont relevés ; sous le nom, le texte du bouton ; les boutons des menus « Actions » comptent', () => {
    const menu = (aria) => `<button data-menu-actions aria-haspopup="menu"${aria === null ? '' : ` aria-label="${aria}"`}>Actions</button>`;
    const commande = (nom, aria, texte = 'Comparer') => `<button role="menuitem" data-commande="${nom}"${aria === null ? '' : ` aria-label="${aria}"`}>${texte}</button>`;
    const ligne = (id, ...commandes) => `<tr data-proposition="${id}"><td>${commandes.join('')}</td></tr>`;
    const lire = (lignes) => avecFragment(`<table><tbody>${lignes}</tbody></table>`, (c) => releverCommandesDeLigne(c));

    const justes = lire(
      ligne(3, menu('Actions de la proposition n° 3'), commande('voir', null, 'Voir sur le plan'), commande('repartir', 'Repartir de la proposition n° 3', 'Repartir d’elle'), commande('comparer', 'Comparer la proposition n° 3')) +
        ligne(14, menu('Actions de la proposition n° 14'), commande('repartir', 'Repartir de la proposition n° 14', 'Repartir d’elle'), commande('comparer', null, 'Comparer n° 14')) +
        `<tr data-retenu="3"><td>${menu('Actions du placement retenu')}${commande('comparer', 'Comparer le placement retenu')}</td></tr>`,
    );
    expect(justes.lues).toBe(8);
    expect(justes.fautes).toEqual([]);

    const fautives = lire(
      ligne(3, menu('Actions de la proposition n° 3'), commande('comparer', 'Comparer la proposition n° 3')) +
        ligne(14, menu('Actions de la proposition n° 3'), commande('comparer', 'Comparer la proposition n° 3'), commande('repartir', null, 'Repartir d’elle')),
    );
    expect(fautives.fautes).toHaveLength(5);
    expect(fautives.fautes.filter((f) => f.includes('ne porte pas le numéro 14'))).toHaveLength(3);
    expect(fautives.fautes.filter((f) => f.includes('même nom accessible'))).toHaveLength(2);
  });

  test('teintes réservées : un texte peint d’une teinte de conflit, et la trame d’une règle peinte de la teinte d’une autre, sont relevés ; une trame de sa propre teinte passe', () => {
    const { fautes, lus } = avecFragment(
      '<p style="color:var(--couleur-conflit-voisins)">alerte</p>' +
        '<svg width="80" height="20"><rect data-marque="trameOrganisation" width="20" height="20" style="fill:var(--couleur-conflit-table)" />' +
        '<rect data-marque="trameTable" x="40" width="20" height="20" style="fill:var(--couleur-conflit-table)" /></svg>',
      (c) => fautesTeinte(c, teintesDeConflit()),
    );
    expect(lus).toBeGreaterThan(2);
    expect(fautes).toHaveLength(2);
    expect(fautes[0]).toContain('--couleur-conflit-voisins');
    expect(fautes[1]).toMatch(/trameOrganisation.*--couleur-conflit-table/);
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

  test('listes : un carré de focus ou de sélection qui couvre les premiers centimètres d\u{2019}une partie est relevé — une désignation ne cache jamais un texte', () => {
    for (const marque of ['focus', 'selection', 'miseEnEvidence']) {
      const { fautes, lues } = avecFragment(
        '<svg width="400" height="160" style="font: 12px sans-serif">' +
          `<g data-table="2"><rect data-marque="${marque}" x="0" y="0" width="30" height="30" style="fill:none;stroke:#000;stroke-width:2" /></g>` +
          '<text data-liste="1"><tspan x="10" y="54"><tspan data-partie="nom">Wxyz Quorvel Tamberlune</tspan></tspan></text></svg>',
        (c) => {
          // Le carré se pose sur le début de la partie, loin de son centre.
          const p = c.querySelector('tspan[data-partie]').getBBox();
          expect(p.width).toBeGreaterThan(80);
          const carre = c.querySelector('rect');
          carre.setAttribute('x', String(p.x - 20));
          carre.setAttribute('y', String(p.y + p.height / 2 - 15));
          return releverListes(c);
        },
      );
      expect(lues, marque).toBe(1);
      expect(fautes, marque).toEqual([
        `tspan[data-partie="nom"] dans text[data-liste="1"] « Wxyz Quorvel Tamberlune » sur rect[data-marque="${marque}"] dans g[data-table="2"]`,
      ]);
    }
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

  test('jamais la seule couleur : deux trames dont les motifs ne diffèrent que par la couleur ont la même signature ; deux formes de motif, deux signatures', () => {
    const motif = (id, angle, teinte) =>
      `<pattern id="${id}" patternUnits="userSpaceOnUse" width="12" height="12" patternTransform="rotate(${angle})">` +
      `<line x1="6" y1="0" x2="6" y2="12" style="stroke:${teinte};stroke-width:4" /></pattern>`;
    const sigs = avecFragment(
      `<svg width="120" height="40"><defs>${motif('m-a', -45, '#a00')}${motif('m-b', -45, '#0a0')}${motif('m-c', 45, '#a00')}</defs>` +
        '<rect id="a" width="30" height="30" style="fill:url(#m-a)" /><rect id="b" x="40" width="30" height="30" style="fill:url(#m-b)" />' +
        '<rect id="c" x="80" width="30" height="30" style="fill:url(#m-c)" /></svg>',
      (c) => ['a', 'b', 'c'].map((id) => signature([c.querySelector(`#${id}`)])),
    );
    expect(sigs[0]).toBe(sigs[1]);
    expect(sigs[0]).not.toBe(sigs[2]);
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
    const retirer = poserFeuille();
    try {
      expect(await attendTransition()).toBe(false);
    } finally {
      retirer();
    }
  });
});

// --- Les gardes, sur chaque écran ----------------------------------------------------------

describe('chaque écran de l’itération (§ 14.5, § 14.6, § 19.11)', () => {
  test('chaque écran s’atteint depuis le premier, et le collecteur ne reçoit rien', () => {
    expect(ECRANS.length, 'écrans parcourus').toBeGreaterThan(0);
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
    // Un compte par thème : un relevé vide dans l'un passerait sous la somme
    // des deux, et la comparaison des couleurs n'aurait rien à comparer.
    for (const theme of THEMES) {
      expect(atteints().reduce((n, r) => n + r[theme].textes.mesures, 0), `textes mesurés [${theme}]`).toBeGreaterThan(0);
    }
    const fautes = [];
    let comparees = 0;
    for (const r of atteints()) {
      for (const theme of THEMES) fautes.push(...r[theme].textes.fautes.map((f) => `${r.nom} [${theme}] — ${f}`));
      for (const [cle, couleurs] of r.clair.textes.couleurs) {
        const sombres = r.sombre.textes.couleurs.get(cle);
        if (sombres === undefined) continue;
        comparees += 1;
        if (sombres === couleurs) fautes.push(`${r.nom} — ${cle} : ${couleurs} dans les deux thèmes`);
      }
    }
    expect(comparees, 'couleurs relevées dans les deux thèmes').toBeGreaterThan(0);
    aucuneFaute([...new Set(fautes)], 'contrastes');
  });

  test('marques : chaque sorte de MARQUES est rendue au moins une fois, et chacune tient 3:1 contre ce qui est peint dessous, dans les deux thèmes', () => {
    for (const theme of THEMES) {
      expect(atteints().reduce((n, r) => n + r[theme].marques.mesures, 0), `marques mesurées [${theme}]`).toBeGreaterThan(0);
    }
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
      for (const sorte of ['textes', 'marques']) {
        expect(atteints().reduce((n, r) => n + r[theme][sorte].mesures, 0), `${sorte} mesurés [${theme}]`).toBeGreaterThan(0);
      }
    }
    const fautes = [];
    for (const r of atteints()) {
      for (const theme of THEMES) {
        fautes.push(...[...r[theme].textes.attenuations, ...r[theme].marques.attenuations].map((f) => `${r.nom} [${theme}] — ${f}`));
      }
    }
    aucuneFaute([...new Set(fautes)], 'atténuations');
  });

  test('jamais la seule couleur : table saine et en conflit, les quatre sortes de conflit, place libre, réservée et à titre non pourvu, portée tour et tous, mode en lecture, en écriture et bloqué, sans trait autour de la surface', () => {
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
    // Les quatre sortes de conflit, sur le plan qui les montre ensemble :
    // chaque paire de trames.
    const toutes = atteints().find((r) => r.nom === 'plan.troisConflits');
    expect(toutes, 'le plan des sortes de conflit relevé').toBeDefined();
    CONFLITS.forEach(({ marque }, i) => {
      for (const { marque: autre } of CONFLITS.slice(i + 1)) {
        fautes.push(...fautesPaire(`trame ${marque} / ${autre}`, toutes.etats.trames[marque], toutes.etats.trames[autre]));
      }
    });
    const modes = ['lecture', 'ecriture', 'bloque'].map((mode) => {
      const r = atteints().find((x) => x.nom === `evenement.plan.${mode}`);
      return { ou: `mode ${mode}`, sig: r?.signatureMode?.sig ?? null, trait: r?.signatureMode?.trait ?? null };
    });
    for (const c of modes) if (c.sig === null) fautes.push(`${c.ou} : absent`);
    for (const c of modes) if (c.trait !== null && c.trait !== 0) fautes.push(`${c.ou} : un trait de ${c.trait} px autour de la surface`);
    for (let i = 0; i < modes.length; i += 1) {
      for (let j = i + 1; j < modes.length; j += 1) fautes.push(...fautesPaire(`${modes[i].ou} / ${modes[j].ou}`, [modes[i]], [modes[j]]));
    }
    aucuneFaute(fautes, 'jamais la seule couleur');
  });

  test('teintes réservées : chaque teinte de conflit calculée ne peint que la trame de sa règle, dans les deux thèmes', () => {
    for (const theme of THEMES) {
      expect(atteints().reduce((n, r) => n + r[theme].teinte.lus, 0), `éléments peints lus [${theme}]`).toBeGreaterThan(0);
    }
    const fautes = atteints().flatMap((r) => THEMES.flatMap((theme) => r[theme].teinte.fautes.map((f) => `${r.nom} [${theme}] — ${f}`)));
    aucuneFaute([...new Set(fautes)], 'teintes réservées');
  });

  test('aucun emoji au rendu', () => {
    expect(atteints().reduce((n, r) => n + r.emoji.lus, 0), 'textes affichés lus').toBeGreaterThan(0);
    aucuneFaute(atteints().flatMap((r) => r.emoji.fautes.map((f) => `${r.nom} — ${f}`)), 'emoji');
  });

  test('typographie : aucune espace ordinaire devant la ponctuation haute ni après « « », ni dans un nombre et son unité, « n° » ou une date, et des insécables posées (§ 14.6)', () => {
    expect(atteints().reduce((n, r) => n + r.typographie.lus, 0), 'textes affichés lus').toBeGreaterThan(0);
    aucuneFaute([...new Set(atteints().flatMap((r) => r.typographie.fautes.map((f) => `${r.nom} — ${f}`)))], 'typographie');
    // Les écrans montrent de la ponctuation haute : la garde a lu des
    // insécables posées, non des textes qui n'en portent aucune.
    expect(atteints().reduce((n, r) => n + r.typographie.insecables, 0), 'textes affichés qui portent une insécable de ponctuation').toBeGreaterThan(0);
  });

  test('le bandeau sur tout écran : visible, version et provenance ; libellé de mode absent de la liste, égal à celui de la barre sur un événement', () => {
    expect(atteints().some((r) => r.mode === null) && atteints().some((r) => r.mode !== null)).toBe(true);
    aucuneFaute(atteints().flatMap((r) => r.bandeau.map((f) => `${r.nom} — ${f}`)), 'bandeau');
  });

  test('imbrication : aucun bloc dans un élément de phrase', () => {
    expect(atteints().reduce((n, r) => n + r.imbrication.lus, 0), 'blocs lus').toBeGreaterThan(0);
    aucuneFaute([...new Set(atteints().flatMap((r) => r.imbrication.fautes.map((f) => `${r.nom} — ${f}`)))], 'imbrication');
  });

  test('formulaires : chaque <form> porte novalidate, aucun input[type=file] visible ; la page se déclare en français', () => {
    expect(atteints().reduce((n, r) => n + r.formulaires.formulaires, 0), '<form> lus').toBeGreaterThan(0);
    const fautes = [...new Set(atteints().flatMap((r) => r.formulaires.fautes.map((f) => `${r.nom} — ${f}`)))];
    if (!/<html[^>]*\slang="fr"/.test(INDEX)) fautes.push('index.html : <html> sans lang="fr"');
    aucuneFaute(fautes, 'formulaires');
  });
});

// --- La page de qualité, sur ses écrans --------------------------------------------------

// Les écrans nommés de la page de qualité (§ 12, § 12.7) : chacun atteint,
// et chacun montre ce que son nom annonce.
const ECRANS_QUALITE = [
  'qualite.infobulle',
  'qualite.jumeaux',
  'qualite.jumeaux.lecture',
  'qualite.jumeaux.bloque',
  'qualite.paires',
  'qualite.objectifs',
  'qualite.performance',
  'qualite.collisions.etroit',
  'qualite.niveaux',
  'qualite.tables.assis',
  'qualite.tables.doublons',
  'qualite.sansCourse',
  'qualite.refus',
];

// Les vues de la page qui portent un jumeau : chaque source de vue qui rend
// <Jumeau>, nommée par son data-vue-qualite, en ordre alphabétique.
const SOURCES_VUES = import.meta.glob('./qualite/Vue*.svelte', { query: '?raw', import: 'default', eager: true });
const VUES_A_JUMEAU = Object.values(SOURCES_VUES)
  .filter((source) => /<Jumeau\b/.test(source))
  .map((source) => /data-vue-qualite="([^"]+)"/.exec(source)?.[1] ?? source.slice(0, 60))
  .sort();

// Un segment « prouvé inévitable » étroit : 8 px de large au plus, où un
// contour de 2 px de chaque côté ne laisse plus de vide.
const PROUVE_ETROIT_PX = 8;

// Les relevés des écrans atteints qui montrent la page de qualité.
const deQualite = () => atteints().filter((r) => r.qualite !== null);
const releveDe = (nom) => atteints().find((r) => r.nom === nom);

describe('la page de qualité, sur chacun de ses écrans (§ 12.7, § 14.5, D30, D34, D43, D44)', () => {
  test('chaque écran nommé de la page est atteint et la montre ; chacun rend ce que son nom annonce', () => {
    const fautes = [];
    for (const nom of ECRANS_QUALITE) {
      const r = releveDe(nom);
      if (r === undefined) fautes.push(`${nom} : non atteint`);
      else if (r.qualite === null) fautes.push(`${nom} : la page de qualité absente`);
    }
    const q = (nom) => releveDe(nom)?.qualite ?? null;
    if (q('qualite.infobulle') !== null && q('qualite.infobulle').pourcentages.dansInfobulle === 0) fautes.push('qualite.infobulle : aucun pourcentage dans l’infobulle');
    for (const nom of ['qualite.jumeaux', 'qualite.objectifs', 'qualite.performance', 'qualite.tables.assis']) {
      if (q(nom) !== null && q(nom).pourcentages.dansJumeaux === 0) fautes.push(`${nom} : aucun pourcentage dans un jumeau`);
    }
    if (q('qualite.tables.assis') !== null && q('qualite.tables.assis').pourcentages.lignesQuiDistinguent === 0) {
      fautes.push('qualite.tables.assis : aucune ligne du jumeau où sièges et assis donnent deux pourcentages, une permutation passerait');
    }
    if (q('qualite.objectifs') !== null && !q('qualite.objectifs').vuesJumeau.includes('objectifs')) fautes.push('qualite.objectifs : le jumeau des objectifs fermé');
    if (q('qualite.performance') !== null && !q('qualite.performance').vuesJumeau.includes('performance')) fautes.push('qualite.performance : le jumeau de la performance fermé');
    if (q('qualite.collisions.etroit') !== null && !q('qualite.collisions.etroit').prouvesCollisions.some((largeur) => largeur <= PROUVE_ETROIT_PX)) {
      fautes.push(`qualite.collisions.etroit : aucun segment prouvé de ${PROUVE_ETROIT_PX} px au plus — largeurs [${q('qualite.collisions.etroit').prouvesCollisions.map((l) => l.toFixed(1))}]`);
    }
    if (q('qualite.performance') !== null && !(q('qualite.performance').course && q('qualite.performance').pointsReleve > 0)) fautes.push('qualite.performance : ni course ni point de relevé');
    if (q('qualite.sansCourse') !== null && !q('qualite.sansCourse').phrases.includes('sansCourse')) fautes.push('qualite.sansCourse : la phrase « sansCourse » absente');
    if (q('qualite.refus') !== null) {
      if (!q('qualite.refus').phrases.includes('refusDessin')) fautes.push('qualite.refus : la phrase « refusDessin » absente');
      if (q('qualite.refus').graphiques.length > 0) fautes.push('qualite.refus : un graphique dessiné malgré le refus');
    }
    if (q('qualite.paires') !== null && !q('qualite.paires').niveaux.some(({ graphique }) => graphique === 'matrice')) fautes.push('qualite.paires : la matrice non dessinée');
    if (q('qualite.objectifs') !== null && !q('qualite.objectifs').graphiques.some(({ ou }) => ou.includes('objectifs'))) fautes.push('qualite.objectifs : le graphique des objectifs absent');
    aucuneFaute(fautes, 'écrans de la qualité');
  });

  test('un jumeau ouvert en lecture et sur un plan bloqué : aucun refus rendu (l’écran lève à la moindre écriture)', () => {
    const fautes = [];
    for (const nom of ['qualite.jumeaux.lecture', 'qualite.jumeaux.bloque']) {
      const r = releveDe(nom);
      if (r === undefined) {
        fautes.push(`${nom} : non atteint`);
        continue;
      }
      if (r.qualite.jumeaux === 0) fautes.push(`${nom} : aucun jumeau ouvert`);
      for (const refus of r.refus) fautes.push(`${nom} : refus ${refus.code}`);
    }
    aucuneFaute(fautes, 'jumeau en lecture et bloqué');
  });

  test('chaque pourcentage rendu est suivi, dans son composant, de son compte du pire — celui de sa ligne sur une ligne —, sur chaque écran de la page, infobulle et jumeaux compris — le jumeau de chaque vue qui en porte un ouvert sur un écran au moins', () => {
    expect(deQualite().reduce((n, r) => n + r.qualite.pourcentages.lus, 0), 'pourcentages lus').toBeGreaterThan(0);
    expect(VUES_A_JUMEAU.length, 'vues à jumeau').toBeGreaterThan(0);
    const ouvertes = new Set(deQualite().flatMap((r) => r.qualite.vuesJumeau));
    const fautes = VUES_A_JUMEAU.filter((vue) => !ouvertes.has(vue)).map((vue) => `${vue} : son jumeau ouvert sur aucun écran`);
    fautes.push(...deQualite().flatMap((r) => r.qualite.pourcentages.fautes.map((f) => `${r.nom} — ${f}`)));
    aucuneFaute(fautes, 'pourcentage et son compte');
  });

  test('le signe « % » ne s’écrit que dans un pourcentage, une graduation du graphique en pourcentages ou le libellé du repère « cent »', () => {
    expect(deQualite().reduce((n, r) => n + r.qualite.pourcentages.signes.lus, 0), 'textes à « % » lus').toBeGreaterThan(0);
    aucuneFaute(deQualite().flatMap((r) => r.qualite.pourcentages.signes.fautes.map((f) => `${r.nom} — ${f}`)), 'signe « % »');
  });

  test('chaque niveau de l’échelle est rendu : sur qualite.niveaux, la grille des tables et la matrice portent chacune les quatre ; sous les deux autres positions, la grille aussi', () => {
    const fautes = [];
    const tous = NIVEAUX_GRAPHIQUE.map(({ niveau }) => niveau);
    for (const [nom, graphiques] of [
      ['qualite.niveaux', ['tables', 'matrice']],
      ['qualite.tables.assis', ['tables']],
      ['qualite.tables.doublons', ['tables']],
    ]) {
      const grilles = releveDe(nom)?.qualite?.niveaux ?? [];
      for (const graphique of graphiques) {
        const niveaux = grilles.find((g) => g.graphique === graphique)?.niveaux ?? [];
        if (niveaux.join() !== tous.join()) fautes.push(`${nom} : ${graphique} rend les niveaux [${niveaux}], [${tous}] attendus`);
      }
    }
    const rendus = new Set(deQualite().flatMap((r) => r.qualite.niveaux.flatMap(({ niveaux }) => niveaux)));
    for (const niveau of tous) if (!rendus.has(niveau)) fautes.push(`niveau ${niveau} : rendu sur aucun écran`);
    aucuneFaute(fautes, 'niveaux de l’échelle');
  });

  test('jamais la seule couleur : série 1 / série 2, prouvé inévitable / reste — un segment prouvé étroit compris ; le plafond, la borne et chaque série, quatre motifs deux à deux distincts ; la règle « cent » au motif du plafond', () => {
    // Chaque liste réunie ne garde que la première occurrence de chaque
    // signature et de chaque motif : une faute se nomme une fois, sur le
    // premier écran qui la montre.
    const reunis = { traces: {}, segments: { prouve: [], reste: [] } };
    const ajouter = (cible, liste, nom) => {
      for (const x of liste) {
        if (!cible.some((y) => y.sig === x.sig && y.motif === x.motif)) cible.push({ ...x, ou: `${nom} ${x.ou}` });
      }
    };
    for (const r of deQualite()) {
      const { traces, segments } = r.qualite.traces;
      for (const [genre, liste] of Object.entries(traces)) ajouter((reunis.traces[genre] ??= []), liste, r.nom);
      for (const genre of ['prouve', 'reste']) ajouter(reunis.segments[genre], segments[genre], r.nom);
    }
    aucuneFaute([...new Set(fautesTraces(reunis))], 'jamais la seule couleur (graphiques)');
  });

  test('chaque série rendue se sépare de chaque teinte d’organisation rendue, sur les couleurs d’origine et sous les trois dichromaties, dans les deux thèmes', () => {
    const fautes = [];
    for (const theme of THEMES) {
      // Les couleurs réunies de tous les écrans, chacune nommée sur le
      // premier qui la peint.
      const reunis = { series: [], teintes: [] };
      for (const r of deQualite()) {
        for (const genre of ['series', 'teintes']) {
          for (const x of r[theme].separation[genre]) {
            if (!reunis[genre].some((y) => egales(y.couleur, x.couleur))) reunis[genre].push({ ...x, ou: `${r.nom} ${x.ou}` });
          }
        }
      }
      fautes.push(...fautesSeparation(reunis).map((f) => `[${theme}] ${f}`));
    }
    aucuneFaute(fautes, 'séries et teintes d’organisation');
  });

  test('aucune teinte d’organisation ni le rouge du retrait sur une marque de graphique, dans les deux thèmes', () => {
    for (const theme of THEMES) {
      expect(deQualite().reduce((n, r) => n + r[theme].teintesGraphique.lus, 0), `marques de graphique lues [${theme}]`).toBeGreaterThan(0);
    }
    const fautes = deQualite().flatMap((r) => THEMES.flatMap((theme) => r[theme].teintesGraphique.fautes.map((f) => `${r.nom} [${theme}] — ${f}`)));
    aucuneFaute([...new Set(fautes)], 'teintes des graphiques');
  });

  test('chaque graphique est une image nommée par sa question et décrite par sa synthèse ; deux vues ne nomment jamais deux graphiques du même nom', () => {
    expect(deQualite().reduce((n, r) => n + r.qualite.graphiques.length, 0), 'graphiques lus').toBeGreaterThan(0);
    aucuneFaute([...new Set(deQualite().flatMap((r) => fautesGraphiques(r.qualite.graphiques).map((f) => `${r.nom} — ${f}`)))], 'graphiques nommés et décrits');
  });

  // Les charges que l'épreuve du clavier ouvre sur la page : chacune rend
  // { charge, fichiers }, fichiers posés dans les Documents. Ensemble, elles
  // montrent chaque vue qui porte un jumeau.
  const CHARGES_CLAVIER = [
    ['principale', () => ({ charge: chargePrincipale(), fichiers: [] })],
    ['paires', () => ({ charge: chargePaires(), fichiers: [] })],
    ['objectifs', () => ({ charge: chargeObjectifs(), fichiers: [] })],
    [
      'performance',
      () => {
        const { charge, courses } = generationPrincipale();
        return { charge, fichiers: [fichierCourses(charge, courses)] };
      },
    ],
  ];

  test('au clavier : chaque jumeau de la page s’ouvre et se ferme par Entrée, le focus jamais sur body, celui de chaque vue qui en porte un ; Échap ferme l’infobulle', async () => {
    const vues = new Set();
    for (const [nom, preparer] of CHARGES_CLAVIER) {
      const contexte = creerContexte({ langue: 'temoin', theme: 'clair' });
      try {
        const { charge, fichiers } = preparer();
        const m = await ouvrirEvenement(contexte, charge, { section: 'qualite', options: { fichiers } });
        await attendre(`la page de qualité (${nom})`, () => m.racine.querySelector('[data-section="qualite"] [data-vue-qualite]'));
        await dessinerGraphiques(m.racine.querySelector('[data-section="qualite"]'));
        await attendre(`la page de qualité dessinée (${nom})`, () => m.racine.querySelector('[data-section="qualite"] svg[data-graphique] [data-marque]'));
        const commandes = [...m.racine.querySelectorAll('[data-section="qualite"] [data-commande="ouvrirJumeau"]')];
        expect(commandes.length, `commandes de jumeau (${nom})`).toBeGreaterThan(0);
        for (const commande of commandes) {
          const vue = commande.closest('[data-vue-qualite]')?.dataset.vueQualite ?? null;
          commande.focus();
          await touche('Enter');
          await attendre(`le jumeau de ${vue} ouvert au clavier (${nom})`, () => {
            const tableaux = document.getElementById(commande.getAttribute('aria-controls') ?? '');
            return commande.getAttribute('aria-expanded') === 'true' && commande.dataset.commande === 'fermerJumeau' && tableaux?.querySelector('[data-jumeau]');
          });
          expect(document.activeElement, `focus après l’ouverture (${nom}, ${vue})`).toBe(commande);
          await touche('Enter');
          await attendre(`le jumeau de ${vue} refermé au clavier (${nom})`, () => commande.getAttribute('aria-expanded') === 'false' && commande.dataset.commande === 'ouvrirJumeau');
          expect(document.activeElement, `focus après la fermeture (${nom}, ${vue})`).toBe(commande);
          expect(document.activeElement).not.toBe(document.body);
          vues.add(vue);
        }
        if (nom === 'principale') {
          const { x, y } = await centre(m.racine.querySelector('[data-graphique="profilComptes"] > rect[pointer-events="all"]'));
          await pointer('bouger', x, y);
          const bulle = await attendre("l'infobulle du profil", () => {
            const trouvee = m.racine.querySelector('[data-vue-qualite="profil"] [role="tooltip"]');
            return trouvee !== null && !trouvee.hidden ? trouvee : null;
          });
          await touche('Escape');
          await attendre("l'infobulle fermée par Échap", () => bulle.hidden);
        }
        expect(contexte.erreurs(), `erreurs (${nom})`).toEqual([]);
      } finally {
        await contexte.defaire();
      }
    }
    expect([...vues].filter((vue) => vue !== null).sort(), 'vues dont le jumeau s’ouvre au clavier').toEqual(expect.arrayContaining(VUES_A_JUMEAU));
  }, 240_000);
});

// --- La comparaison, le départ et les dérivées, sur leurs écrans ----------------------------

// Les écrans de la vue de comparaison, de la carte du départ et des
// dérivées (C9, C15, C20, D55, D85) : chacun atteint, et chacun montre ce
// que son nom annonce.
const ECRANS_COMPARAISON = [
  'qualite.comparaison',
  'qualite.comparaison.phrase',
  'qualite.comparaison.seul',
  'qualite.comparaison.retenu',
  'qualite.comparaison.repli',
  'qualite.comparaison.lecture',
  'qualite.comparaison.bloque',
  'generation.depart',
  'generation.depart.lecture',
  'generation.depart.bloque',
  'propositions.derivees',
  'propositions.actions',
];

// Les écrans où regarder n'écrit rien ni ne refuse rien (§ 8.4, C9,
// contrainte 57) : l'écran lève à la moindre écriture.
const ECRANS_SANS_ECRITURE = ['qualite.comparaison.lecture', 'qualite.comparaison.bloque', 'generation.depart.lecture', 'generation.depart.bloque', 'propositions.actions'];

// Les relevés des écrans atteints où la vue de comparaison s'est calculée.
const deComparaison = () => deQualite().filter((r) => r.qualite.comparaison !== null);

describe('la comparaison, le départ et les dérivées, sur leurs écrans (C9, C15, C20, C29, D55, D66, D67, D85)', () => {
  test('chaque écran est atteint ; chacun rend ce que son nom annonce', () => {
    const fautes = [];
    for (const nom of ECRANS_COMPARAISON) if (releveDe(nom) === undefined) fautes.push(`${nom} : non atteint`);
    const c = (nom) => releveDe(nom)?.qualite?.comparaison ?? null;
    for (const nom of ECRANS_COMPARAISON.filter((n) => n.startsWith('qualite.'))) if (releveDe(nom) !== undefined && c(nom) === null) fautes.push(`${nom} : la vue de comparaison non calculée`);
    for (const nom of ['qualite.comparaison', 'qualite.comparaison.retenu']) {
      if (c(nom) !== null && !(c(nom).trace && c(nom).traces.a?.length > 0 && c(nom).traces.b?.length > 0)) fautes.push(`${nom} : le tracé des deux séries absent`);
    }
    if (c('qualite.comparaison') !== null) {
      if (!c('qualite.comparaison').phrases.includes('bascule')) fautes.push('qualite.comparaison : la bascule absente');
      if (!c('qualite.comparaison').jumeau) fautes.push('qualite.comparaison : le jumeau fermé');
    }
    if (c('qualite.comparaison.phrase') !== null && (c('qualite.comparaison.phrase').trace || !c('qualite.comparaison.phrase').phrases.includes('peuDeValeurs'))) {
      fautes.push(`qualite.comparaison.phrase : ${c('qualite.comparaison.phrase').trace ? 'un tracé' : 'la phrase « peuDeValeurs » absente'}`);
    }
    if (c('qualite.comparaison.seul') !== null) {
      const seul = c('qualite.comparaison.seul');
      if (seul.phrases.join() !== 'seul' || seul.trace || seul.entetes.a !== null || seul.pourcentages.lus > 0) fautes.push(`qualite.comparaison.seul : ${JSON.stringify(seul.phrases)}, des colonnes, un tracé ou un pourcentage`);
    }
    if (c('qualite.comparaison.retenu') !== null) {
      const { entetes, rangs } = c('qualite.comparaison.retenu');
      if (!entetes.a?.includes(tTemoin('qualite.comparaison.nom.retenu'))) fautes.push(`qualite.comparaison.retenu : la colonne a « ${entetes.a} » ne nomme pas le retenu`);
      // Le second placement par défaut d'un retenu ajusté : sa proposition
      // d'origine, la n° 1.
      if (!entetes.b?.includes(texteReduit(tTemoin('qualite.comparaison.nom.proposition', { proposition: 1 })))) fautes.push(`qualite.comparaison.retenu : la colonne b « ${entetes.b} » ne nomme pas la proposition d’origine n° 1`);
      if (!rangs.a?.includes(tTemoin('format.vide'))) fautes.push(`qualite.comparaison.retenu : la place du retenu ajusté « ${rangs.a} »`);
    }
    for (const nom of ['qualite.comparaison.repli', 'qualite.comparaison.lecture', 'qualite.comparaison.bloque']) {
      if (c(nom) !== null && !c(nom).repli) fautes.push(`${nom} : « Tous les indicateurs » fermé`);
    }
    for (const nom of ['qualite.comparaison.lecture', 'qualite.comparaison.bloque']) if (c(nom) !== null && !c(nom).jumeau) fautes.push(`${nom} : le jumeau fermé`);
    // « Repartir d'elle » sur la ligne 1 : le départ est la proposition 1.
    const titreDuDepart = texteReduit(tTemoin('generation.depart.titre', { depart: 1 }));
    for (const nom of ['generation.depart', 'generation.depart.lecture', 'generation.depart.bloque']) {
      const depart = releveDe(nom)?.depart;
      if (depart !== undefined && depart?.figes.join() !== '1') fautes.push(`${nom} : la carte du départ ${depart === null ? 'absente' : `aux tours cochés [${depart.figes}]`}`);
      if (depart && depart.titre !== titreDuDepart) fautes.push(`${nom} : la carte du départ titrée « ${depart.titre} », « ${titreDuDepart} » attendu`);
    }
    // Quatre lignes, chacune son menu fermé ; puis le menu de la n° 4
    // ouvert : ses deux commandes nommées par la ligne s'y ajoutent.
    const derivees = releveDe('propositions.derivees');
    if (derivees !== undefined && (derivees.filiations !== 2 || derivees.commandesDeLigne.lues !== 4)) {
      fautes.push(`propositions.derivees : ${derivees.filiations} filiations, ${derivees.commandesDeLigne.lues} commandes de ligne`);
    }
    const actions = releveDe('propositions.actions');
    if (actions !== undefined && actions.commandesDeLigne.lues !== 6) fautes.push(`propositions.actions : ${actions.commandesDeLigne.lues} commandes de ligne, 6 attendues`);
    aucuneFaute(fautes, 'écrans de la comparaison, du départ et des dérivées');
  });

  test('dans la vue de comparaison, un pourcentage ne se rend que dans une colonne, suivi du compte de la même colonne ; trois au plus par colonne, autant de chaque côté', () => {
    expect(deComparaison().reduce((n, r) => n + r.qualite.comparaison.pourcentages.lus, 0), 'pourcentages de la vue lus').toBeGreaterThan(0);
    // Le repli ouvert sous un objectif qui concerne des personnes : les
    // trois pourcentages de chaque colonne, chacun la valeur et le compte
    // que le modèle des colonnes donne à son côté.
    const repli = releveDe('qualite.comparaison.repli')?.qualite?.comparaison ?? null;
    expect(repli?.pourcentages.parColonne, 'repli ouvert').toEqual({ a: 3, b: 3 });
    const proposition = (cle) => texteReduit(tTemoin('qualite.comparaison.nom.proposition', { proposition: cle }));
    const a = [1, 2].find((cle) => repli.entetes.a?.includes(proposition(cle)));
    expect(a, `la colonne a « ${repli.entetes.a} »`).toBeDefined();
    expect(repli.pourcentagesEnColonne, 'repli ouvert, pourcentages et comptes').toEqual(pourcentagesAttendus(chargeComparaisonObjectifs(), a, 3 - a));
    aucuneFaute(deComparaison().flatMap((r) => r.qualite.comparaison.pourcentages.fautes.map((f) => `${r.nom} — ${f}`)), 'pourcentages de la comparaison');
  });

  test('jamais la seule couleur : les deux séries du tracé, deux motifs et deux traits distincts ; leurs couleurs séparées l’une de l’autre sur les couleurs d’origine et sous les trois dichromaties, dans les deux thèmes', () => {
    const traces = deComparaison().filter((r) => r.qualite.comparaison.trace);
    expect(traces.length, 'écrans au tracé de la comparaison').toBeGreaterThan(0);
    const fautes = traces.flatMap((r) => fautesSeriesComparaison(r.qualite.comparaison.traces).map((f) => `${r.nom} — ${f}`));
    for (const r of traces) {
      for (const theme of THEMES) fautes.push(...fautesSeparationComparaison(r[theme].seriesComparaison).map((f) => `${r.nom} [${theme}] — ${f}`));
    }
    aucuneFaute([...new Set(fautes)], 'séries de la comparaison');
  });

  test('en lecture et sur un plan bloqué, regarder la comparaison et choisir un départ ne rendent aucun refus (l’écran lève à la moindre écriture)', () => {
    const fautes = [];
    for (const nom of ECRANS_SANS_ECRITURE) {
      const r = releveDe(nom);
      if (r === undefined) fautes.push(`${nom} : non atteint`);
      else for (const refus of r.refus) fautes.push(`${nom} : refus ${refus.code}`);
    }
    aucuneFaute(fautes, 'regarder sans écrire');
  });

  test('les commandes de ligne : chacune un nom accessible distinct, qui porte le numéro de sa ligne', () => {
    expect(releveDe('propositions.derivees')?.commandesDeLigne.lues, 'commandes de ligne des dérivées').toBeGreaterThan(0);
    aucuneFaute([...new Set(atteints().flatMap((r) => r.commandesDeLigne.fautes.map((f) => `${r.nom} — ${f}`)))], 'commandes de ligne');
  });

  test('au clavier : le jumeau de la comparaison et « Tous les indicateurs » s’ouvrent et se ferment par Entrée, le focus jamais sur body', async () => {
    const contexte = creerContexte({ langue: 'temoin', theme: 'clair' });
    try {
      const m = await ouvrirEvenement(contexte, chargeComparaison(), { section: 'qualite' });
      const vue = await attendre('la vue de comparaison', () => m.racine.querySelector('[data-vue-qualite="comparaison"]'));
      vue.scrollIntoView({ block: 'start' });
      await attendre('la vue de comparaison calculée', () => vue.querySelector('[data-tous-les-indicateurs]'));
      await dessinerGraphiques(vue);
      const commandes = [
        ['le jumeau', () => vue.querySelector('[data-commande="ouvrirJumeau"], [data-commande="fermerJumeau"]'), (b) => b.dataset.commande === 'fermerJumeau', '[data-jumeau]'],
        ['« Tous les indicateurs »', () => vue.querySelector('[data-tous-les-indicateurs]'), () => true, 'table'],
      ];
      for (const [quoi, lire, ouverteParNom, contenu] of commandes) {
        const commande = lire();
        expect(commande, quoi).not.toBeNull();
        commande.focus();
        await touche('Enter');
        await attendre(`${quoi} ouvert au clavier`, () => commande.getAttribute('aria-expanded') === 'true' && ouverteParNom(commande) && document.getElementById(commande.getAttribute('aria-controls') ?? '')?.querySelector(contenu));
        expect(document.activeElement, `focus après l’ouverture (${quoi})`).toBe(commande);
        await touche('Enter');
        await attendre(`${quoi} refermé au clavier`, () => commande.getAttribute('aria-expanded') === 'false');
        expect(document.activeElement, `focus après la fermeture (${quoi})`).toBe(commande);
        expect(document.activeElement).not.toBe(document.body);
      }
      expect(contexte.erreurs()).toEqual([]);
    } finally {
      await contexte.defaire();
    }
  });

  test('le chemin jusqu’à la vue : « Comparer » d’une ligne, puis « Comparer n° a à n° X » de l’issue d’une génération dérivée, ouvrent la vue de comparaison sur la paire, le focus sur elle', async () => {
    const nom = (proposition) => tTemoin('qualite.comparaison.nom.proposition', { proposition });
    const paire = (a, b) => tTemoin('qualite.comparaison.placements', { a: nom(a), b: nom(b) });
    // La vue rendue sur la paire, et le focus sur l'élément qui la porte.
    const surLaPaire = async (m, a, b) => {
      const ligne = await attendre(`la vue sur n° ${a} et n° ${b}`, () => {
        const trouvee = m.racine.querySelector('[data-section="qualite"] [data-vue-qualite="comparaison"] [data-placements-compares]');
        return trouvee?.textContent === paire(a, b) ? trouvee : null;
      });
      await attendre('le focus sur la vue de comparaison', () => document.activeElement?.querySelector(':scope > [data-vue-qualite="comparaison"]') !== null);
      expect(document.activeElement.contains(ligne)).toBe(true);
    };
    const contexte = creerContexte({ langue: 'temoin', theme: 'clair' });
    try {
      let charge = chargeComparaison();
      for (const [cle, valeur] of [['generation.nombre', 2], ['generation.arret', 60]]) charge = appliquerCommande('modifierReglage', charge, { cle, valeur }).charge;
      const m = await ouvrirEvenement(contexte, charge, { ecriture: true, section: 'propositions' });
      // La proposition 1 au plan : « Comparer » sur la ligne 2.
      await cliquerAction(m, '[data-proposition="2"]', 'comparer');
      await surLaPaire(m, 1, 2);

      await cliquer(m, '[data-commande="section"][data-cible="propositions"]');
      await cliquerAction(m, '[data-proposition="2"]', 'repartir');
      await cliquer(m, '[data-section="generation"] [data-commande="genererDepuis"]');
      const comparer = await attendre("l'issue de la génération dérivée", () => m.racine.querySelector('[data-section="generation"] [data-commande="comparerIssue"]'), 3000);
      const [meilleure, depart] = entiersDe(comparer.textContent);
      expect([meilleure >= 3, depart], 'la meilleure dérivée et son départ nommés par la commande').toEqual([true, 2]);
      await cliquer(m, '[data-section="generation"] [data-commande="comparerIssue"]');
      await surLaPaire(m, meilleure, 2);
      expect(contexte.erreurs()).toEqual([]);
    } finally {
      await contexte.defaire();
    }
  }, 60_000);
});

// --- Le balisage littéral -------------------------------------------------------------------

describe('balisage littéral (§ 13.1)', () => {
  const INJECTION = '<img src=x onerror=globalThis.__injecte=1>';

  test('une personne nommée par du balisage : son nom littéral dans la grille, la fiche, le plan et l’infobulle ; aucun img créé ; rien d’exécuté', async () => {
    await fixerCadre(1366, 700);
    const charge = chargePrincipale();
    // Les cinq personnes de l'organisation en conflit portent le nom
    // injecté : l'infobulle d'une table en conflit les nomme.
    const organisation = charge.participants[0].organisation;
    for (const p of charge.participants) {
      if (p.organisation === organisation) {
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
      // Une table du tour 1 qui réunit deux personnes de l'organisation : elle
      // est en conflit, et son infobulle les nomme.
      const [{ placement, tables }] = charge.propositions;
      const membres = new Set(charge.participants.filter((p) => p.organisation === organisation).map(({ id }) => id));
      const rang = placement[0].sieges.findIndex((liste) => liste.filter((id) => membres.has(id)).length >= 2);
      expect(rang, 'une table qui réunit deux personnes de l’organisation').toBeGreaterThanOrEqual(0);
      const plateau = m.racine.querySelector(`[data-table="${tables[rang]}"] [data-marque="contourConflit"]`);
      expect(plateau, 'sa table en conflit').not.toBeNull();
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
    const retirer = poserFeuille();
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
      retirer();
    }
    expect(atteintes, 'écrans atteints').toBeGreaterThan(0);
    expect(atteintes + fautes.length).toBe(ECRANS.length);
    aucuneFaute(fautes, 'transitions annulées');
  }, 900_000);
});

// --- Les captures d'écran : le mécanisme ------------------------------------------------------

describe('les captures d’écran : chaque contrôle échoue en nommant la capture (§ 19.4, § 19.5, § 19.7, § 19.11)', () => {
  const ACCUEIL = '[data-ecran="accueil"]';
  const ADRESSE_INVENTEE = 'http://192.0.2.1/';
  let retirer = null;

  beforeAll(async () => {
    await fixerCadre(CADRE.largeur, CADRE.hauteur);
    retirer = poserFeuille();
    await commands.requetesHorsBoucle();
  });

  afterAll(() => {
    retirer?.();
  });

  // Un montage du premier écran, sous la provenance des captures, sur un
  // dossier d'épreuve neuf ; tout deux défaits à la fin.
  async function avecMontage(faire) {
    const racine = await commands.dossierEpreuve();
    const m = await monterApp({ provenance: 'documentation', executeur: creerExecuteurDirect({ coeursDisponibles: 4 }) });
    try {
      await attendre('le premier écran', () => m.racine.querySelector(`${ACCUEIL} [data-dossier-travail]`));
      const racineNeutre = m.seance.etat().racine.chemin;
      return await faire(m, { racine, racineNeutre, ecrire: { mode: 'ecrire', racine }, verifier: { mode: 'verifier', racine } });
    } finally {
      m.demonter();
      await commands.effacerDossierEpreuve(racine);
    }
  }

  // Pose un élément dans le premier écran, le temps d'une capture.
  function poser(m, html) {
    const gabarit = document.createElement('template');
    gabarit.innerHTML = html;
    const element = gabarit.content.firstElementChild;
    m.racine.querySelector(ACCUEIL).append(element);
    return element;
  }

  // Une requête vers une adresse inventée hors de la boucle locale : l'erreur
  // qu'elle rend.
  async function requeteInventee() {
    try {
      await fetch(ADRESSE_INVENTEE, { mode: 'no-cors', signal: AbortSignal.timeout(10_000) });
      return null;
    } catch (erreur) {
      return erreur;
    }
  }

  // Les échecs hors boucle que node relève, attendus image après image : ils
  // lui arrivent par le protocole de débogage, au plus quelques images
  // après le rejet que la page a reçu, et après la requête elle-même.
  async function echecsReleves() {
    const echecs = [];
    for (let image = 0; image < 60 && echecs.length === 0; image += 1) {
      echecs.push(...(await commands.echecsHorsBoucle()));
      await new Promise((resoudre) => requestAnimationFrame(resoudre));
    }
    return echecs;
  }

  // Laisse passer autant d'images de la page qu'echecsReleves en attend au
  // plus, sans lire aucun relevé : l'échec d'une requête a rejoint node.
  async function laisserArriverLEchec() {
    for (let image = 0; image < 60; image += 1) await new Promise((resoudre) => requestAnimationFrame(resoudre));
  }

  // Le mandataire mort de test/chromium.js refuse la connexion : la requête
  // n'est jamais partie de la machine, et Chromium le dit par sa cause.
  test('réseau : une requête vers une adresse littérale inventée échoue en connexion au mandataire mort, la page de la boucle locale se charge, le relevé la nomme', async () => {
    expect((await fetch('/collecteur.js')).ok).toBe(true);
    expect(await commands.requetesHorsBoucle()).toEqual([]);
    await commands.echecsHorsBoucle();
    const erreur = await requeteInventee();
    expect(erreur?.name, String(erreur)).toBe('TypeError');
    expect(await echecsReleves()).toEqual([{ adresse: ADRESSE_INVENTEE, cause: 'net::ERR_PROXY_CONNECTION_FAILED' }]);
    expect(await commands.requetesHorsBoucle()).toEqual([ADRESSE_INVENTEE]);
  });

  test('relevé : requeteHorsBoucle nomme la requête suivie de sa cause une fois l’échec reçu, vide les deux relevés, puis rend null', async () => {
    await commands.requetesHorsBoucle();
    await commands.echecsHorsBoucle();
    await requeteInventee();
    await laisserArriverLEchec();
    expect(await requeteHorsBoucle()).toBe(`${ADRESSE_INVENTEE} (net::ERR_PROXY_CONNECTION_FAILED)`);
    expect(await commands.echecsHorsBoucle()).toEqual([]);
    expect(await requeteHorsBoucle()).toBe(null);
  });

  test('un sélecteur manquant, une erreur au collecteur, une requête hors boucle : chacun échoue en nommant la capture', async () => {
    await avecMontage(async (m, { ecrire }) => {
      await expect(photographier(m, '01-premier-ecran', { ...ecrire, condition: '[data-absent]' })).rejects.toThrow(
        'capture 01-premier-ecran : sélecteur absent « [data-absent] »',
      );
      await requeteInventee();
      expect(await echecsReleves()).toHaveLength(1);
      await expect(photographier(m, '01-premier-ecran', ecrire)).rejects.toThrow(
        `capture 01-premier-ecran : requête hors de la boucle locale : ${ADRESSE_INVENTEE}`,
      );
      console.error('erreur provoquée par l’épreuve');
      await expect(photographier(m, '01-premier-ecran', ecrire)).rejects.toThrow(
        'capture 01-premier-ecran : collecteur : console.error « erreur provoquée par l’épreuve »',
      );
    });
  });

  test('un chemin hors de la racine neutre, un élément de texte vide, une clé brute, une marque de la langue témoin : chacun échoue', async () => {
    await avecMontage(async (m, { ecrire }) => {
      const cas = [
        ['<p>/home/exemple/notes.txt</p>', 'chemin hors de la racine neutre : « /home/exemple/notes.txt »'],
        ['<p>Rangé sous C:\\Users\\Autre\\soiree.gtt.json</p>', 'chemin hors de la racine neutre : « C:\\Users\\Autre\\soiree.gtt.json »'],
        ['<button type="button"></button>', 'élément de texte vide : button dans '],
        ['<p>plan.echelle.mention</p>', 'clé brute affichée : « plan.echelle.mention »'],
        [`<p>${OUVERTURE}Libellé${FERMETURE}</p>`, `marque de la langue témoin : « ${OUVERTURE}Libellé${FERMETURE} »`],
      ];
      for (const [html, nature] of cas) {
        const element = poser(m, html);
        try {
          await expect(photographier(m, '01-premier-ecran', ecrire), html).rejects.toThrow(`capture 01-premier-ecran : ${nature}`);
        } finally {
          element.remove();
        }
      }
    });
  });

  // Une condition se juge sur la boîte entière de l'élément (§ 19.11) :
  // un élément dont le centre se voit, mais que le bord de la fenêtre ou un
  // ancêtre qui rogne coupe, refuse la capture ; le même, entier, passe. Le
  // bord de la fenêtre coupe un élément HTML avant même la boîte entière :
  // visible de rendu.js le refuse déjà, et nomme la fenêtre.
  test('condition : un élément HTML ou SVG dont le centre se voit, coupé par la fenêtre ou par un ancêtre qui rogne, refuse la capture ; entier, il passe', async () => {
    await avecMontage(async (m, { ecrire }) => {
      const fixe = 'position: fixed; top: 300px';
      const coupe = 'sa boîte déborde de la fenêtre ou d’un ancêtre qui la rogne : l’image la coupe';
      const cas = [
        [
          'HTML rogné par un ancêtre overflow: hidden',
          `<div style="${fixe}; left: 100px; width: 200px; height: 40px; overflow: hidden"><div data-sonde style="width: 300px; height: 20px"></div></div>`,
          `<div style="${fixe}; left: 100px; width: 200px; height: 40px; overflow: hidden"><div data-sonde style="width: 160px; height: 20px"></div></div>`,
          coupe,
        ],
        [
          'HTML coupé par le bord de la fenêtre',
          `<div data-sonde style="${fixe}; left: -40px; width: 200px; height: 20px"></div>`,
          `<div data-sonde style="${fixe}; left: 40px; width: 200px; height: 20px"></div>`,
          'hors de la fenêtre',
        ],
        [
          'SVG rogné par son <svg>',
          `<svg style="${fixe}; left: 100px" width="200" height="40"><rect data-sonde x="100" y="10" width="160" height="20" fill="none" /></svg>`,
          `<svg style="${fixe}; left: 100px" width="200" height="40"><rect data-sonde x="20" y="10" width="160" height="20" fill="none" /></svg>`,
          coupe,
        ],
        [
          'SVG coupé par le bord de la fenêtre',
          `<svg style="${fixe}; left: -60px" width="200" height="40"><rect data-sonde x="0" y="10" width="160" height="20" fill="none" /></svg>`,
          `<svg style="${fixe}; left: 60px" width="200" height="40"><rect data-sonde x="0" y="10" width="160" height="20" fill="none" /></svg>`,
          coupe,
        ],
      ];
      for (const [nom, rogne, entier, nature] of cas) {
        let element = poser(m, rogne);
        try {
          await expect(photographier(m, '01-premier-ecran', { ...ecrire, condition: '[data-sonde]' }), nom).rejects.toThrow(
            `capture 01-premier-ecran : « [data-sonde] » invisible : ${nature}`,
          );
        } finally {
          element.remove();
        }
        element = poser(m, entier);
        try {
          expect((await photographier(m, '01-premier-ecran', { ...ecrire, condition: '[data-sonde]' })).fichier, nom).toBe('01-premier-ecran');
        } finally {
          element.remove();
        }
      }
    });
  });

  test('publication : zéro capture échoue ; une étape en échec ne publie rien — attente jetée, manifeste et images inchangés', async () => {
    await avecMontage(async (m, { racine, racineNeutre, ecrire }) => {
      const declarees = ['01-premier-ecran', '01b-passer-en-ecriture'];
      await expect(commands.publierCaptures({ declarees: [], racine, racineNeutre })).rejects.toThrow('aucune capture déclarée');
      await expect(commands.publierCaptures({ declarees, racine, racineNeutre })).rejects.toThrow('aucune capture déposée');
      for (const fichier of declarees) await photographier(m, fichier, ecrire);
      const bilan = await commands.publierCaptures({ declarees, racine, racineNeutre });
      expect(bilan).toEqual({ ecrites: declarees, gardees: [], retirees: [], manifeste: true });
      const publie = await commands.empreintesDossier({ racine });
      expect(publie.map(([chemin]) => chemin)).toEqual([
        'doc/captures/01-premier-ecran.png',
        'doc/captures/01b-passer-en-ecriture.png',
        'doc/captures/manifeste.json',
      ]);

      poser(m, '<p>Iris Ombrelle</p>');
      await photographier(m, '01-premier-ecran', ecrire);
      await expect(photographier(m, '01b-passer-en-ecriture', { ...ecrire, condition: '[data-absent]' })).rejects.toThrow();
      expect((await commands.empreintesDossier({ racine })).map(([chemin]) => chemin)).toContain('doc/captures/.attente/01-premier-ecran.json');
      await expect(commands.publierCaptures({ declarees, racine, racineNeutre })).rejects.toThrow(
        'étapes sans capture déposée, rien n’est publié : 01b-passer-en-ecriture',
      );
      expect(await commands.empreintesDossier({ racine })).toEqual(publie);
    });
  });

  test('publication : une empreinte d’étape inchangée laisse les octets de l’image ; changée, l’image se réécrit', async () => {
    await avecMontage(async (m, { racine, racineNeutre, ecrire }) => {
      const declarees = ['01-premier-ecran'];
      const image = async () => new Map(await commands.empreintesDossier({ racine })).get('doc/captures/01-premier-ecran.png');
      await photographier(m, '01-premier-ecran', ecrire);
      await commands.publierCaptures({ declarees, racine, racineNeutre });
      const premiere = await image();
      expect(premiere).toMatch(/^[0-9a-f]{64}$/);

      // Une pastille sans texte ni marque, dans un coin vide : les pixels
      // changent, l'entrée non.
      poser(m, '<div style="position: fixed; right: 0; bottom: 0; width: 6px; height: 6px; background: rgb(200, 30, 30)"></div>');
      await photographier(m, '01-premier-ecran', ecrire);
      const deposee = new Map(await commands.empreintesDossier({ racine })).get('doc/captures/.attente/01-premier-ecran.png');
      expect(deposee).not.toBe(premiere);
      expect(await commands.publierCaptures({ declarees, racine, racineNeutre })).toEqual({
        ecrites: [],
        gardees: declarees,
        retirees: [],
        manifeste: false,
      });
      expect(await image()).toBe(premiere);

      // Un texte de plus : l'entrée change, l'image se réécrit.
      poser(m, '<p>Théo Pervenche</p>');
      await photographier(m, '01-premier-ecran', ecrire);
      expect(await commands.publierCaptures({ declarees, racine, racineNeutre })).toEqual({
        ecrites: declarees,
        gardees: [],
        retirees: [],
        manifeste: true,
      });
      expect(await image()).not.toBe(premiere);
    });
  });

  test('vérification : la même étape passe ; un libellé modifié est un écart qui nomme l’étape et le texte', async () => {
    await avecMontage(async (m, { racine, racineNeutre, ecrire, verifier }) => {
      await photographier(m, '01-premier-ecran', ecrire);
      await commands.publierCaptures({ declarees: ['01-premier-ecran'], racine, racineNeutre });
      await photographier(m, '01-premier-ecran', verifier);
      const titre = m.racine.querySelector(`${ACCUEIL} h2`);
      const avant = titre.textContent;
      titre.textContent = `${avant} modifié`;
      await expect(photographier(m, '01-premier-ecran', verifier)).rejects.toThrow(
        `01-premier-ecran (étape 1) : écart de texte, rang ${texteReleve(m.racine).indexOf(`${avant} modifié`)} : « ${avant} modifié » au lieu de « ${avant} »`,
      );
    });
  });

  test('cadre, facteur d’échelle, thème, chaîne témoin, feuille, contraste : chacun échoue en nommant la capture', async () => {
    await avecMontage(async (m, { ecrire }) => {
      const refus = (nature) => expect(photographier(m, '01-premier-ecran', ecrire)).rejects.toThrow(nature);
      await fixerCadre(CADRE.largeur, CADRE.hauteur - 1);
      try {
        await refus(`capture 01-premier-ecran : cadre ${CADRE.largeur} × ${CADRE.hauteur - 1}, attendu ${CADRE.largeur} × ${CADRE.hauteur}`);
      } finally {
        await fixerCadre(CADRE.largeur, CADRE.hauteur);
      }
      // Le facteur que la page lit, remplacé le temps d'une capture.
      const facteur = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
      Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
      try {
        await refus('capture 01-premier-ecran : facteur d’échelle 2, attendu 1');
      } finally {
        if (facteur === undefined) delete window.devicePixelRatio;
        else Object.defineProperty(window, 'devicePixelRatio', facteur);
      }
      expect(devicePixelRatio).toBe(1);
      const documentRacine = document.documentElement;
      const theme = documentRacine.getAttribute('data-theme');
      documentRacine.setAttribute('data-theme', 'sombre');
      try {
        await refus('capture 01-premier-ecran : thème « sombre », l’image se prend en thème clair');
      } finally {
        documentRacine.setAttribute('data-theme', theme);
      }
      m.racine.style.setProperty('--police-interface', 'serif');
      try {
        await refus(/^capture 01-premier-ecran : chaîne témoin à [\d.]+ px/);
      } finally {
        m.racine.style.removeProperty('--police-interface');
      }
      retirer();
      try {
        await refus('capture 01-premier-ecran : la feuille qui annule transitions et animations n’est pas posée');
      } finally {
        retirer = poserFeuille();
      }
      const pale = poser(m, '<p style="position: fixed; left: 600px; top: 300px; z-index: 2147483647; margin: 0; color: rgb(210, 210, 210); background: rgb(255, 255, 255)">Gris pâle</p>');
      try {
        await refus(/^capture 01-premier-ecran : thème clair : \d+ faute\(s\) de contraste[^]*« Gris pâle »/);
      } finally {
        pale.remove();
      }
      await photographier(m, '01-premier-ecran', ecrire);
    });
  });

  // Le mode d'affichage du manifeste (§ 19.4) : Chromium sans tête, que
  // navigator.userAgent nomme HeadlessChrome. La page lit un userAgent
  // remplacé le temps d'une capture.
  test('mode d’affichage : la page des épreuves est sans tête ; un userAgent sans HeadlessChrome refuse la capture en la nommant', async () => {
    expect(navigator.userAgent).toContain('HeadlessChrome');
    await avecMontage(async (m, { ecrire }) => {
      const avecTete = navigator.userAgent.replace('HeadlessChrome', 'Chrome');
      Object.defineProperty(navigator, 'userAgent', { value: avecTete, configurable: true });
      try {
        await expect(photographier(m, '01-premier-ecran', ecrire)).rejects.toThrow(
          'capture 01-premier-ecran : navigateur avec tête, navigator.userAgent sans HeadlessChrome : le mode d’affichage nommé au manifeste est chromium-headless-shell',
        );
      } finally {
        delete navigator.userAgent;
      }
      expect(navigator.userAgent).toContain('HeadlessChrome');
      expect((await photographier(m, '01-premier-ecran', ecrire)).mode).toBe('chromium-headless-shell');
    });
  });

  test('relevé des styles : un porteur à demi hors de la fenêtre ne fait rien défiler et n’entre pas dans les styles', async () => {
    await avecMontage(async (m) => {
      const releve = async () => {
        const styles = {};
        for (const nom of THEMES) styles[nom] = (await sousTheme(nom, () => stylesDuTheme(m.racine))).styles;
        return styles;
      };
      const defilements = () => [document.scrollingElement, ...m.racine.querySelectorAll('*')].map((e) => `${e.scrollTop},${e.scrollLeft}`).join(';');
      const sans = await releve();
      // Le porteur se pose six pixels au-dessus du bord bas de la fenêtre,
      // son centre au-dessous ; une cale le descend, une queue fait défiler.
      const bloc = poser(m, '<div><div data-cale></div><p style="margin: 0; line-height: 40px; color: rgb(20, 60, 20)">Texte à demi caché</p><div style="height: 1500px"></div></div>');
      const cale = bloc.querySelector('[data-cale]');
      const porteur = bloc.querySelector('p');
      cale.style.height = `${innerHeight - 6 - porteur.getBoundingClientRect().top}px`;
      try {
        expect(Math.round(porteur.getBoundingClientRect().top)).toBe(innerHeight - 6);
        const avant = defilements();
        const avec = await releve();
        expect(defilements()).toBe(avant);
        expect(avec).toEqual(sans);
      } finally {
        bloc.remove();
      }
    });
  });

  test('clôture : une épreuve en échec ou une requête hors boucle ne publie rien, jette l’attente et se nomme ; sinon, la clôture publie', async () => {
    await avecMontage(async (m, { racine, racineNeutre, ecrire }) => {
      const declarees = ['01-premier-ecran'];
      const clore = (echecs) => cloreCaptures({ echecs, declarees, mode: 'ecrire', racine, racineNeutre });
      await photographier(m, '01-premier-ecran', ecrire);
      await expect(clore(['20 « Défaire » en lecture'])).rejects.toThrow('captures non publiées : 1 épreuve(s) du parcours en échec : « 20 « Défaire » en lecture »');
      expect(await commands.empreintesDossier({ racine })).toEqual([]);
      // Une requête émise après la dernière capture : la clôture seule la lit.
      await photographier(m, '01-premier-ecran', ecrire);
      await requeteInventee();
      await echecsReleves();
      await expect(clore([])).rejects.toThrow(`captures non publiées : requête hors de la boucle locale : ${ADRESSE_INVENTEE}`);
      expect(await commands.empreintesDossier({ racine })).toEqual([]);
      await photographier(m, '01-premier-ecran', ecrire);
      await requeteInventee();
      await echecsReleves();
      await expect(clore(['20 « Défaire » en lecture'])).rejects.toThrow(
        `captures non publiées : 1 épreuve(s) du parcours en échec : « 20 « Défaire » en lecture » ; requête hors de la boucle locale : ${ADRESSE_INVENTEE}`,
      );
      expect(await commands.empreintesDossier({ racine })).toEqual([]);
      await photographier(m, '01-premier-ecran', ecrire);
      expect(await clore([])).toEqual({ declarees, bilan: { ecrites: declarees, gardees: [], retirees: [], manifeste: true } });
    });
  });

  test('publication : un dépôt qui nomme un chemin de la machine est refusé par la garde de la contrainte 27, le chemin nommé', async () => {
    await avecMontage(async (m, { racine, racineNeutre, ecrire }) => {
      const entree = await photographier(m, '01-premier-ecran', ecrire);
      const forgee = { ...entree, texte: [...entree.texte, '/home/exemple/x'] };
      await commands.deposerCapture({ fichier: '01-premier-ecran', entree: forgee, chemin: `${racine}/doc/captures/.attente/01-premier-ecran.png`, racine });
      await expect(commands.publierCaptures({ declarees: ['01-premier-ecran'], racine, racineNeutre })).rejects.toThrow(
        'doc/captures/01-premier-ecran.png : chemin hors de la racine neutre : « /home/exemple/x »',
      );
      expect(await commands.empreintesDossier({ racine })).toEqual([]);
    });
  });

  test('publication : une image qui n’est plus déclarée part ; une image remplacée, à empreinte d’étape égale, se réécrit', async () => {
    await avecMontage(async (m, { racine, racineNeutre, ecrire }) => {
      const declarees = ['01-premier-ecran'];
      const empreintes = async () => new Map(await commands.empreintesDossier({ racine }));
      await photographier(m, '01-premier-ecran', ecrire);
      await commands.copierDansEpreuve({ racine, depuis: 'doc/captures/.attente/01-premier-ecran.png', vers: 'doc/captures/09-refus-sur-place.png' });
      expect((await empreintes()).has('doc/captures/09-refus-sur-place.png')).toBe(true);
      const bilan = await commands.publierCaptures({ declarees, racine, racineNeutre });
      expect(bilan.retirees).toEqual(['09-refus-sur-place']);
      expect([...(await empreintes()).keys()]).toEqual(['doc/captures/01-premier-ecran.png', 'doc/captures/manifeste.json']);
      const publiee = (await empreintes()).get('doc/captures/01-premier-ecran.png');

      // Une autre image prend la place de la publiée : une pastille change
      // les pixels, l'entrée non.
      const pastille = poser(m, '<div style="position: fixed; right: 0; bottom: 0; width: 6px; height: 6px; background: rgb(200, 30, 30)"></div>');
      await photographier(m, '01-premier-ecran', ecrire);
      pastille.remove();
      await commands.copierDansEpreuve({ racine, depuis: 'doc/captures/.attente/01-premier-ecran.png', vers: 'doc/captures/01-premier-ecran.png' });
      const remplacee = (await empreintes()).get('doc/captures/01-premier-ecran.png');
      expect(remplacee).not.toBe(publiee);
      await photographier(m, '01-premier-ecran', ecrire);
      expect(await commands.publierCaptures({ declarees, racine, racineNeutre })).toMatchObject({ ecrites: declarees, gardees: [], retirees: [] });
      expect((await empreintes()).get('doc/captures/01-premier-ecran.png')).not.toBe(remplacee);
    });
  });
});
