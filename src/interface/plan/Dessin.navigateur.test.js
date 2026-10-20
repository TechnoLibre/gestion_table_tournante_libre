// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du dessin du plan dans un vrai moteur de rendu (§ 7.1, § 7.3 à
// § 7.7, § 13.3, § 13.5, § 17 point 6). PlanDessin se monte dans un <svg
// data-plan> d'épreuve, sans viewBox, dont le groupe [data-vue] porte
// translate(tx,ty) scale(k) ; BandeauPlan et EchellePlan dans la page. Les
// épreuves lisent le style calculé, la boîte et l'élément qu'atteint un
// point, jamais la présence d'une classe, et atteignent les éléments par
// leurs attributs data-…. Une démonstration livrée se lit, et ses variantes
// se dérivent, en mémoire depuis texteLivre ; les noms d'épreuve sont
// inventés.
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { flushSync, mount, unmount } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import '../jetons.css';
import { creerFormat } from '../../application/format.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { etatPlaces } from '../../application/places.js';
import { creerTraduction } from '../../application/traduction.js';
import { PLAN_PARFAIT_PETITE } from '../../demo/catalogue.js';
import { texteLivre } from '../../demo/livrees.js';
import { constante } from '../../geometrie/constantes.js';
import { designer } from '../../geometrie/designation.js';
import { echelleGraphique } from '../../geometrie/echelle.js';
import { AVANCE_CHIFFRE, DECALAGE_ANCRE, DEMI_HAUTEUR_GEL, ECART_NUMERO, ENCRE_BAS_CHIFFRE, ENCRE_HAUT_CHIFFRE } from '../../geometrie/plateau.js';
import { PLANCHER_DIAMETRE } from '../../geometrie/tables.js';
import { GABARIT_HAUTEUR_LIGNE, TAILLE_TEXTE_LISTE_CM } from '../../geometrie/texte.js';
import { dessinDepuisEcran, ecranDepuisDessin, transformDe } from '../../geometrie/vue.js';
import { rechercher } from '../../moteur/recherche.js';
import { analyser, configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { versFichier } from '../../stockage/placements.js';
import { fixerCadre } from '../../../test/navigateur/entrees.js';
import { composantes, contraste, couleurTexte, couleursPeintes, fondPeintSous, sousTheme, visible } from '../../../test/navigateur/rendu.js';
import TEXTE_TOUTES_EN_CONFLIT from '../../../test/fixtures/plan/toutes_en_conflit.gtt.json?raw';
import { TABLES_INTERFACE } from '../libelles.js';
import { CONFLITS } from '../marques.js';
import BandeauPlan from './BandeauPlan.svelte';
import Legende from './Legende.svelte';
import EchellePlan from './EchellePlan.svelte';
import { creerMesureur } from './mesure_texte.js';
import { HALO_NUMERO, LARGEUR_ECHELLE_PX, RAYON_PASTILLE, formesTable, legendeConflits, modeleDessin } from './modele.js';
import { nomDeCharge } from './vue_plan.js';
import PlanDessin from './PlanDessin.svelte';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const CONTEXTE = new Map([
  ['t', t],
  ['format', creerFormat(t)],
]);
const SVG = 'http://www.w3.org/2000/svg';
const K_LISTES = constante('K_LISTES');
const LARGEUR = constante('LARGEUR_BLOC_NOMS_CM');
const MARQUE = t('plan.liste.abreviation');
const MARQUES_DE_CHAISE = ['cadenasFerme', 'cadenasOuvert', 'anneau'];

// Les montages de l'épreuve courante : composant et conteneur.
const montes = [];

beforeAll(async () => {
  await fixerCadre(1366, 700);
});

// Démonte tout ce que l'épreuve courante a monté.
function demonterTout() {
  for (const { composant, conteneur } of montes.splice(0)) {
    unmount(composant);
    conteneur.remove();
  }
}

afterEach(demonterTout);

// --- Montage ---------------------------------------------------------------

/** Monte PlanDessin dans un <svg data-plan> d'épreuve de la taille de la
 *  fenêtre, au début du corps, sous la vue donnée ; caché, le conteneur est
 *  en display: none, et conteneur.style.display = '' le montre. props
 *  remplace { modele } : un accesseur qui lit un état réactif change le
 *  modèle du composant monté. */
function monterPlan(modele, vue = { k: 1, tx: 0, ty: 0 }, { cache = false, props = { modele } } = {}) {
  const conteneur = document.createElement('div');
  conteneur.dataset.surface = '';
  if (cache) conteneur.style.display = 'none';
  document.body.prepend(conteneur);
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('data-plan', '');
  svg.setAttribute('width', String(innerWidth));
  svg.setAttribute('height', String(innerHeight));
  svg.style.display = 'block';
  conteneur.append(svg);
  const groupe = document.createElementNS(SVG, 'g');
  groupe.setAttribute('data-vue', '');
  groupe.setAttribute('transform', transformDe(vue));
  svg.append(groupe);
  const composant = mount(PlanDessin, { target: groupe, props, context: CONTEXTE });
  flushSync();
  montes.push({ composant, conteneur });
  const boite = svg.getBoundingClientRect();
  const cadre = { gauche: boite.left, haut: boite.top, largeur: boite.width, hauteur: boite.height };
  return { svg, groupe, conteneur, vue, cadre, ecran: (x, y) => ecranDepuisDessin(vue, cadre, x, y) };
}

// Attend deux images : les observations de taille de la première sont
// livrées, et les mises à jour qu'elles déclenchent appliquées.
const deuxImages = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

/** Monte un composant HTML dans un conteneur neuf, au début du corps. */
function monterHtml(Composant, props) {
  const conteneur = document.createElement('div');
  document.body.prepend(conteneur);
  const composant = mount(Composant, { target: conteneur, props, context: CONTEXTE });
  flushSync();
  montes.push({ composant, conteneur });
  return conteneur;
}

// --- Configurations ----------------------------------------------------------

const NOMS = [
  ['Iris', 'Ombrelle'],
  ['Théo', 'Pervenche'],
  ['Ondine', 'Lacasse'],
  [null, 'Grisaille'],
  ['Basile', 'Tourmaline'],
  ['Capucine', 'Arrosoir'],
  ['Aurèle', 'Cerfeuil'],
  ['Mélisande', 'Bruyère'],
  ['Firmin', 'Galet'],
  ['Clélia', 'Mistral'],
  ['Anatole', 'Houblon'],
  ['Solveig', 'Sarcelle'],
];

const personne = (id, nom, prenom, appartenance = null) => ({
  id,
  nom,
  prenom,
  appartenance,
  courriel: null,
  titrePressenti: null,
  notes: null,
  exclu: false,
});

const nomsDe = nomDeCharge;

/** Le modèle d'un tour de la charge, sous la source demandée. */
function modeleDe(charge, { tour = 1, proposition = null, ...options } = {}) {
  return modeleDessin(etatPlaces(charge, { tour, proposition }), {
    k: 1,
    listes: true,
    miseEnEvidence: null,
    nomDe: nomsDe(charge),
    ...options,
  });
}

/** Une charge de tables de capacités données — rondes, ou de la forme
 *  donnée —, centres espacés de pas cm sur une ligne, et douze personnes
 *  inventées. */
function chargeDeTables(capacites, { tours = 1, pas = 400, formes = [] } = {}) {
  const charge = creerCharge({ id: 'epreuve:dessin', nom: 'Dessin', siegesParDefaut: 8, tours });
  charge.tables = capacites.map((sieges, i) => ({
    id: i + 1,
    numero: i + 1,
    sieges,
    forme: formes[i] ?? 'ronde',
    position: { x: pas * i, y: 0 },
  }));
  charge.participants = NOMS.map(([prenom, nom], i) => personne(i + 1, nom, prenom));
  charge.prochainsIds = { participant: 13, table: capacites.length + 1, proposition: 1 };
  return charge;
}

// Pose une proposition de rechercher, ou la proposition donnée.
function avecProposition(charge, proposition = null) {
  const configuration = configurationDepuisCharge(charge);
  const fichier =
    proposition ??
    versFichier(rechercher(configuration, { graine: 7, nombre: 1, arret: 1000 })[0], configuration, {
      produitVersion: 'epreuve',
      attribuerSieges: false,
      decalage: 0,
    });
  charge.propositions = [fichier];
  charge.prochainsIds.proposition = fichier.id + 1;
  charge.evenement.etat = 'propose';
  return charge;
}

const toutesEnConflit = () => analyser(TEXTE_TOUTES_EN_CONFLIT).charge;

// La petite démonstration, la seule règle « nouveaux voisins » active, et une
// proposition dont le tour 2 réunit de nouveau la table 1 du tour 1 : au tour
// 2, la table 1 seule est en rencontre répétée.
function rencontreRepetee() {
  const charge = analyser(texteLivre('petite')).charge;
  Object.assign(charge.reglages, { separerAppartenances: false, nouvelleTable: false, varierAppartenances: false });
  const tours = [
    PLAN_PARFAIT_PETITE.tours[0],
    [
      [1, 2, 3],
      [4, 8, 12],
      [5, 9, 10],
      [6, 7, 11],
    ],
    PLAN_PARFAIT_PETITE.tours[2],
    PLAN_PARFAIT_PETITE.tours[3],
  ];
  return avecProposition(charge, {
    id: 1,
    graine: 1,
    arret: 1,
    historique: 1000,
    produitVersion: 'epreuve',
    siegesAttribues: false,
    tables: [1, 2, 3, 4],
    capacites: [3, 3, 3, 3],
    tours: 4,
    participants: charge.participants.map(({ id }) => id),
    placement: tours.map((listes) => ({ sieges: listes.map((liste) => [...liste].sort((a, b) => a - b)), reserve: [] })),
  });
}

// --- Lectures --------------------------------------------------------------------

const tous = (racine, selecteur) => [...racine.querySelectorAll(selecteur)];
// Les trames de conflit, des trois sortes (CONFLITS).
const TRAMES = CONFLITS.map(({ marque }) => `[data-marque=${marque}]`).join(', ');
const plateauDe = (svg, id) => svg.querySelector(`[data-table="${id}"] :is([data-marque=contourTable], [data-marque=contourConflit])`);
const centre = (element) => {
  const b = element.getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
};
// La valeur d'un jeton de couleur, en composantes [r, g, b, a].
function jeton(nom) {
  const sonde = document.createElement('div');
  sonde.style.color = `var(${nom})`;
  document.body.append(sonde);
  const lu = composantes(getComputedStyle(sonde).color);
  sonde.remove();
  return lu;
}
const memeCouleur = (a, b) => a.every((c, i) => Math.abs(c - b[i]) < 0.01);

// Les lignes rendues d'une liste : chaque <tspan> enfant du <text data-liste>.
const lignesDe = (svg, id) => tous(svg, `[data-liste="${id}"] > tspan`);

// La hauteur d'encre du gabarit sur la police calculée d'un élément.
function encreDuGabarit(element, gabarit = GABARIT_HAUTEUR_LIGNE) {
  const style = getComputedStyle(element);
  const contexte = new OffscreenCanvas(1, 1).getContext('2d');
  contexte.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const m = contexte.measureText(gabarit);
  return m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
}

// L'anneau se voit quand il est rendu et qu'un point de son trait l'atteint,
// pointer-events ignoré : le centre de sa boîte, au milieu de la chaise, ne
// le touche pas.
function anneauVisible(anneau) {
  if (!anneau.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return 'checkVisibility faux';
  const style = getComputedStyle(anneau);
  if (style.stroke === 'none' || !(parseFloat(style.strokeWidth) > 0)) return `trait ${style.stroke} ${style.strokeWidth}`;
  const b = anneau.getBoundingClientRect();
  const feuille = document.createElement('style');
  feuille.textContent = '* { pointer-events: auto !important; }';
  document.head.append(feuille);
  try {
    const atteints = document.elementsFromPoint(b.left + b.width / 2, b.top + 1);
    return atteints.includes(anneau) ? true : `le haut de son trait n'atteint pas l'anneau`;
  } finally {
    feuille.remove();
  }
}

// =============================================================================

describe('le mobilier à l\u{2019}échelle (§ 7.1, § 7.7)', () => {
  test('à k = 2, le disque d\u{2019}une table de 8, de 3 et de 10 a la largeur de son diamètre, à moins d\u{2019}un pixel', () => {
    const charge = chargeDeTables([8, 3, 10]);
    const { svg } = monterPlan(modeleDe(charge, { k: 2 }), { k: 2, tx: 300, ty: 350 });
    const diametres = [(8 * 60) / Math.PI, 70, (10 * 60) / Math.PI];
    expect(diametres[0]).toBeCloseTo(2 * 76.39, 1);
    diametres.forEach((diametre, i) => {
      expect(Math.abs(plateauDe(svg, i + 1).getBoundingClientRect().width - diametre * 2)).toBeLessThan(1);
    });
  });
});

describe('les marques des places (§ 7.6, § 19.3 08)', () => {
  // Siège 1 : réservé pour tous les tours et titré ; 2 : titre non pourvu ;
  // 3 : réservé au seul tour 1 ; les autres, nus.
  function marques() {
    const charge = chargeDeTables([8], { tours: 2 });
    charge.reservations = [
      { participant: 1, table: 1, siege: 1, portee: 'tous', tour: null },
      { participant: 2, table: 1, siege: 3, portee: 'tour', tour: 1 },
    ];
    charge.titres = [
      { table: 1, siege: 1, libelle: 'animateur' },
      { table: 1, siege: 2, libelle: 'animateur' },
    ];
    return charge;
  }
  const ATTENDUES = new Map([
    [1, ['cadenasFerme', 'anneau']],
    [2, ['cadenasOuvert']],
    [3, ['cadenasFerme']],
  ]);
  const REMPLISSAGES = new Map([
    [1, 'remplissagePlein'],
    [2, 'hachure'],
    [3, 'remplissagePlein'],
  ]);

  test('chaque marque attendue se voit, aucune autre ; deux marques de chaise au plus ; aucun pictogramme', () => {
    const charge = marques();
    const { svg } = monterPlan(modeleDe(charge, { k: 2.5 }), { k: 2.5, tx: 683, ty: 350 });
    const sieges = tous(svg, '[data-siege]');
    expect(sieges.length).toBe(8);
    for (const siege of sieges) {
      const numero = Number(siege.dataset.siege.split(':')[1]);
      const portees = MARQUES_DE_CHAISE.flatMap((nom) => tous(siege, `[data-marque=${nom}]`));
      expect(portees.length).toBeLessThanOrEqual(2);
      expect(portees.map((m) => m.dataset.marque).sort()).toEqual([...(ATTENDUES.get(numero) ?? [])].sort());
      for (const marque of portees) {
        expect(marque).toBeInstanceOf(SVGElement);
        expect(marque.dataset.marque === 'anneau' ? anneauVisible(marque) : visible(marque)).toBe(true);
      }
    }
    // Les nœuds de texte du plan : au moins un par ligne de liste, huit.
    const textes = tous(svg, '*').flatMap((e) => [...e.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE));
    expect(tous(svg, '[data-liste] > tspan').length).toBe(8);
    expect(textes.length).toBeGreaterThanOrEqual(8);
    for (const noeud of textes) {
      expect(/\p{Extended_Pictographic}/u.test(noeud.textContent)).toBe(false);
    }
  });

  test('le remplissage se lit au style calculé : plein, hachuré, ou le fond de la chaise', () => {
    const charge = marques();
    const { svg } = monterPlan(modeleDe(charge, { k: 2.5 }), { k: 2.5, tx: 683, ty: 350 });
    const chaises = tous(svg, '[data-siege] > :is([data-marque=contourChaise], [data-marque=remplissagePlein], [data-marque=hachure])');
    expect(chaises.length).toBe(8);
    for (const chaise of chaises) {
      const numero = Number(chaise.closest('[data-siege]').dataset.siege.split(':')[1]);
      const attendu = REMPLISSAGES.get(numero) ?? 'contourChaise';
      expect(chaise.dataset.marque).toBe(attendu);
      const { fill } = couleursPeintes(chaise);
      if (attendu === 'remplissagePlein') expect(fill).toEqual([jeton('--couleur-chaise-pleine')]);
      if (attendu === 'contourChaise') expect(fill).toEqual([jeton('--couleur-chaise-fond')]);
      if (attendu === 'hachure') {
        expect(getComputedStyle(chaise).fill).toMatch(/^url\(/);
        expect(fill.some((c) => memeCouleur(c, jeton('--couleur-hachure')))).toBe(true);
      }
      // Un cadenas couvre le centre de sa chaise : seule une chaise nue se
      // voit en son centre ; toutes sont rendues.
      expect(chaise.checkVisibility({ opacityProperty: true, visibilityProperty: true })).toBe(true);
      if (!ATTENDUES.has(numero)) expect(visible(chaise)).toBe(true);
    }
  });
});

describe('la liste fait foi (§ 7.6)', () => {
  test('la ligne du siège 1 égale exactement sa forme, son titre en italique ; celle d\u{2019}un titre non pourvu l\u{2019}énonce', () => {
    const charge = chargeDeTables([8]);
    charge.reservations = [{ participant: 1, table: 1, siege: 1, portee: 'tous', tour: null }];
    charge.titres = [
      { table: 1, siege: 1, libelle: 'animateur' },
      { table: 1, siege: 2, libelle: 'animateur' },
    ];
    // Au bloc du registre, LARGEUR_BLOC_NOMS_CM : la ligne entière y tient.
    const { svg } = monterPlan(modeleDe(charge), { k: 1, tx: 400, ty: 350 });
    const lignes = lignesDe(svg, 1);
    expect(lignes.length).toBe(8);
    expect(lignes[0].textContent).toBe('1. (réservée, tous les tours) Iris Ombrelle \u{2014} animateur');
    const titre = lignes[0].querySelector('[data-partie=titre]');
    expect(titre.textContent).toBe('animateur');
    expect(getComputedStyle(titre).fontStyle).toBe('italic');
    expect(getComputedStyle(lignes[0].querySelector('[data-partie=nom]')).fontStyle).toBe('normal');
    expect(lignes[1].textContent).toBe('2. (libre) \u{2014} titre animateur non pourvu');
  });

  test('« réservée à … » porte deux noms de « W » : la ligne tient sous LARGEUR_BLOC_NOMS_CM, et l\u{2019}occupant s\u{2019}abrège avant la titulaire', () => {
    // La ligne 2 de la table 1 : la titulaire, réservée là pour tous les
    // tours, que la proposition assied ailleurs, et l'occupant qu'elle y met.
    function ligneReservee(longueurTitulaire, longueurOccupant) {
      const charge = avecProposition(chargeDeTables([8, 8]));
      const etat = etatPlaces(charge, { tour: 1, proposition: 1 });
      const assis = new Set(etat.tables[0].chaises.map(({ occupant }) => occupant));
      const titulaire = charge.participants.find(({ id }) => !assis.has(id)).id;
      const occupant = etat.tables[0].chaises[1].occupant;
      expect(occupant).not.toBeNull();
      Object.assign(charge.participants.find(({ id }) => id === titulaire), { nom: 'W'.repeat(longueurTitulaire), prenom: null });
      Object.assign(charge.participants.find(({ id }) => id === occupant), { nom: 'W'.repeat(longueurOccupant), prenom: null });
      charge.reservations = [{ participant: titulaire, table: 1, siege: 2, portee: 'tous', tour: null }];
      const { svg } = monterPlan(modeleDe(charge, { proposition: 1 }), { k: 1, tx: 400, ty: 350 });
      const ligne = lignesDe(svg, 1)[1];
      expect(ligne.getComputedTextLength()).toBeLessThanOrEqual(LARGEUR + 1e-3);
      const partie = (nom) => ligne.querySelector(`[data-partie=${nom}]`)?.textContent ?? null;
      return { titulaire: partie('titulaire'), occupant: partie('nom') };
    }
    // Une titulaire courte reste entière ; l'occupant s'abrège à sa suite.
    const courte = ligneReservee(6, 80);
    expect(courte.titulaire).toBe('W'.repeat(6));
    expect(courte.occupant).toMatch(new RegExp(`^W+${MARQUE}$`));
    // Deux noms de 80 « W » : l'occupant tombé, la titulaire s'abrège à son
    // tour, et la ligne tient encore.
    const longues = ligneReservee(80, 80);
    expect(longues.occupant).toBeNull();
    expect(longues.titulaire).toMatch(new RegExp(`^W+${MARQUE}$`));
  });

  test('grande démonstration livrée, tour 1, modèle tel quel : chaque ligne tient, chaque place occupée garde son nom, chaque titre son libellé', () => {
    const charge = analyser(texteLivre('grande')).charge;
    const modele = modeleDe(charge);
    const occupees = modele.tables.flatMap(({ lignes }) => lignes.filter(({ nom }) => nom !== null));
    expect(occupees.length).toBe(33);
    expect(occupees.every(({ etat, titre }) => etat?.cle === 'plan.ligne.reserveeTous' && titre !== null)).toBe(true);
    const { svg } = monterPlan(modele, { k: 1, tx: 50, ty: 50 });
    const lignes = tous(svg, '[data-liste] > tspan');
    expect(lignes.length).toBe(260);
    for (const ligne of lignes) expect(ligne.getComputedTextLength()).toBeLessThanOrEqual(LARGEUR + 1e-3);
    const noms = tous(svg, '[data-liste] [data-partie=nom]');
    expect(noms.length).toBe(33);
    for (const nom of noms) expect(nom.textContent.replace(MARQUE, '').length).toBeGreaterThan(0);
    const titres = tous(svg, '[data-liste] [data-partie=titre]');
    expect(titres.length).toBe(33);
    for (const titre of titres) expect(titre.textContent).toBe('animation');
    for (const nom of noms) expect(nom.previousElementSibling.textContent).toMatch(/^\d+\. \(réservée, tous les tours\) $/);
  });
});

describe('le texte des listes (§ 7.4)', () => {
  test('chaque ligne est un <tspan> à x et y explicites, sans textLength ; deux lignes sont au moins à la hauteur d\u{2019}encre du gabarit', () => {
    const charge = chargeDeTables([8, 4]);
    charge.participants.forEach((p, i) => {
      p.nom = ['\u{D4}jgq', '\u{C6}jgq', '\u{D4}gq \u{C6}'][i % 3];
    });
    avecProposition(charge);
    const { svg } = monterPlan(modeleDe(charge, { proposition: 1 }), { k: 1, tx: 400, ty: 350 });
    const lignes = lignesDe(svg, 1);
    expect(lignes.length).toBe(8);
    for (const ligne of lignes) {
      expect(ligne.hasAttribute('x')).toBe(true);
      expect(ligne.hasAttribute('y') || ligne.hasAttribute('dy')).toBe(true);
    }
    expect(svg.querySelectorAll('[textLength], [lengthAdjust]').length).toBe(0);
    const encre = encreDuGabarit(svg.querySelector('[data-liste="1"]'));
    expect(encre).toBeGreaterThan(18);
    expect(encre).toBeGreaterThan(encreDuGabarit(svg.querySelector('[data-liste="1"]'), 'abc'));
    for (let i = 1; i < lignes.length; i += 1) {
      const ecart = lignes[i].getStartPositionOfChar(0).y - lignes[i - 1].getStartPositionOfChar(0).y;
      expect(ecart).toBeGreaterThanOrEqual(encre - 1e-3);
    }
  });

  test('troncature : sur les 33 tables sans exception, chaque ligne tient, chaque nom s\u{2019}abrège sur la marque', () => {
    const charge = analyser(texteLivre('grande-sans-exception')).charge;
    const LONGS = ['L'.repeat(200), 'W'.repeat(60), '\u{C6}'.repeat(60)];
    charge.participants.forEach((p, i) => {
      p.prenom = null;
      p.nom = LONGS[i % 3];
    });
    expect(charge.titres.filter(({ siege, libelle }) => siege === 1 && libelle === 'animation').length).toBe(33);
    avecProposition(charge);
    const modele = modeleDe(charge, { proposition: 1, k: 0.5 });
    const places = modele.tables.reduce((somme, { lignes }) => somme + lignes.length, 0);
    const occupees = modele.tables.reduce((somme, { lignes }) => somme + lignes.filter(({ nom }) => nom !== null).length, 0);
    expect(places).toBe(264);
    expect(occupees).toBe(260);
    // Au bloc du registre : chaque nom s'abrège, aucun ne tombe, et le
    // titre reste entier.
    const { svg } = monterPlan(modele, { k: 0.5, tx: 50, ty: 50 });
    const lignes = tous(svg, '[data-liste] > tspan');
    expect(lignes.length).toBe(places);
    for (const ligne of lignes) expect(ligne.getComputedTextLength()).toBeLessThanOrEqual(LARGEUR + 1e-3);
    const noms = tous(svg, '[data-liste] [data-partie=nom]');
    expect(noms.length).toBe(occupees);
    for (const nom of noms) expect(nom.textContent.endsWith(MARQUE) && nom.textContent.length > 1).toBe(true);
    const titres = tous(svg, '[data-liste] [data-partie=titre]');
    expect(titres.length).toBe(33);
    for (const titre of titres) expect(titre.textContent).toBe('animation');
  });

  test('un titre de deux cents caractères : la ligne tient encore, le titre abrégé', () => {
    const charge = chargeDeTables([4]);
    charge.reservations = [{ participant: 1, table: 1, siege: 1, portee: 'tous', tour: null }];
    charge.titres = [{ table: 1, siege: 1, libelle: 't'.repeat(200) }];
    const { svg } = monterPlan(modeleDe(charge), { k: 1, tx: 300, ty: 350 });
    const [premiere] = lignesDe(svg, 1);
    expect(premiere.getComputedTextLength()).toBeLessThanOrEqual(LARGEUR + 1e-3);
    const titre = premiere.querySelector('[data-partie=titre]');
    expect(titre.textContent.endsWith(MARQUE)).toBe(true);
    expect(titre.textContent.length).toBeLessThan(200);
  });
});

describe('le plan monté caché (point d\u{2019}attention 1)', () => {
  test('monté en display: none puis montré : chaque ligne tient, le nom long s\u{2019}abrège sur la marque', async () => {
    const charge = chargeDeTables([4, 8]);
    for (const p of charge.participants) {
      p.prenom = null;
      p.nom = 'W'.repeat(80);
    }
    avecProposition(charge);
    const { svg, conteneur } = monterPlan(modeleDe(charge, { proposition: 1 }), { k: 1, tx: 300, ty: 350 }, { cache: true });
    conteneur.style.display = '';
    await deuxImages();
    flushSync();
    const lignes = lignesDe(svg, 1);
    expect(lignes.length).toBe(4);
    for (const ligne of lignes) {
      expect(ligne.getComputedTextLength()).toBeLessThanOrEqual(LARGEUR + 1e-3);
      const nom = ligne.querySelector('[data-partie=nom]').textContent;
      expect(nom.startsWith('W') && nom.endsWith(MARQUE)).toBe(true);
    }
  });

  test('montré, caché, son modèle changé pendant qu\u{2019}il est caché, puis remontré : chaque ligne tient, chaque nom long s\u{2019}abrège sur la marque', async () => {
    const charge = chargeDeTables([4, 8]);
    avecProposition(charge);
    const reactif = new SvelteMap([['modele', modeleDe(charge, { proposition: 1 })]]);
    const { svg, conteneur } = monterPlan(null, { k: 1, tx: 300, ty: 350 }, {
      props: {
        get modele() {
          return reactif.get('modele');
        },
      },
    });
    await deuxImages();
    flushSync();
    expect(lignesDe(svg, 1).length).toBe(4);
    conteneur.style.display = 'none';
    await deuxImages();
    flushSync();
    // Un autre modèle, posé pendant que le plan est caché : quatre-vingts
    // « W » pour chaque nom.
    const longs = structuredClone(charge);
    for (const p of longs.participants) {
      p.prenom = null;
      p.nom = 'W'.repeat(80);
    }
    reactif.set('modele', modeleDe(longs, { proposition: 1 }));
    flushSync();
    await deuxImages();
    conteneur.style.display = '';
    await deuxImages();
    flushSync();
    const lignes = tous(svg, '[data-liste] > tspan');
    expect(lignes.length).toBe(12);
    for (const ligne of lignes) {
      expect(ligne.getComputedTextLength()).toBeLessThanOrEqual(LARGEUR + 1e-3);
      const nom = ligne.querySelector('[data-partie=nom]').textContent;
      expect(nom.startsWith('W') && nom.endsWith(MARQUE)).toBe(true);
    }
  });

  test('creerMesureur : la largeur nulle d\u{2019}un texte non rendu ne se retient pas ; rendu, la chaîne se mesure', () => {
    const conteneur = document.createElement('div');
    conteneur.style.display = 'none';
    document.body.prepend(conteneur);
    try {
      const svg = document.createElementNS(SVG, 'svg');
      const texte = document.createElementNS(SVG, 'text');
      texte.setAttribute('font-size', '18');
      svg.append(texte);
      conteneur.append(svg);
      const mesurer = creerMesureur(texte);
      expect(mesurer('Ombrelle')).toBe(0);
      conteneur.style.display = '';
      expect(mesurer('Ombrelle')).toBeGreaterThan(0);
      expect(mesurer('')).toBe(0);
    } finally {
      conteneur.remove();
    }
  });
});

describe('un nom porteur de balisage, des homonymes (point d\u{2019}attention 3)', () => {
  test('le balisage reste du texte, dans un seul nœud ; deux « Iris Ombrelle » ont chacune leur ligne et leur numéro', () => {
    const BALISAGES = ['<tspan font-size="200">X</tspan>', '</text><circle r="999"/>'];
    const charge = chargeDeTables([8, 4]);
    charge.participants[1].prenom = 'Iris';
    charge.participants[1].nom = 'Ombrelle';
    charge.participants[2].prenom = null;
    charge.participants[2].nom = BALISAGES[0];
    charge.participants[3].prenom = null;
    charge.participants[3].nom = BALISAGES[1];
    // Une proposition qui assied les huit premiers à la table 1.
    avecProposition(charge, {
      id: 1,
      graine: 1,
      arret: 1,
      historique: 1,
      produitVersion: 'epreuve',
      siegesAttribues: false,
      tables: [1, 2],
      capacites: [8, 4],
      tours: 1,
      participants: charge.participants.map(({ id }) => id),
      placement: [{ sieges: [[1, 2, 3, 4, 5, 6, 7, 8], [9, 10, 11, 12]], reserve: [] }],
    });
    const { svg } = monterPlan(modeleDe(charge, { proposition: 1 }), { k: 1, tx: 300, ty: 350 });
    const liste = svg.querySelector('[data-liste="1"]');
    const lignes = lignesDe(svg, 1);
    expect(lignes.length).toBe(8);
    // Chaque ligne d'un occupant sans réservation ni titre : sa tête et son
    // nom, deux tspan ; rien d'autre sous la liste.
    expect(liste.querySelectorAll('*').length).toBe(8 * 3);
    expect([...liste.querySelectorAll('*')].every((e) => e.localName === 'tspan')).toBe(true);
    expect(svg.querySelectorAll('circle[r="999"], [font-size="200"]').length).toBe(0);
    const noms = tous(liste, '[data-partie=nom]');
    expect(noms.length).toBe(8);
    for (const nom of noms) expect(nom.childElementCount).toBe(0);
    for (const balisage of BALISAGES) {
      const portes = noms.filter(({ textContent }) => textContent === balisage || (textContent.endsWith(MARQUE) && balisage.startsWith(textContent.slice(0, -MARQUE.length))));
      expect(portes.length, balisage).toBe(1);
    }
    const homonymes = noms.filter(({ textContent }) => textContent === 'Iris Ombrelle');
    expect(homonymes.length).toBe(2);
    const numeros = homonymes.map((nom) => nom.previousElementSibling.textContent);
    expect(numeros.every((tete) => /^\d+\. $/.test(tete))).toBe(true);
    expect(new Set(numeros).size).toBe(2);
  });
});

describe('le signal de conflit (§ 7.5, § 13.3)', () => {
  for (const theme of ['clair', 'sombre']) {
    test(`thème ${theme} : contour épaissi, trame peinte, pastille chiffrée ; la rencontre répétée et le siège réservé peignent autrement ; le tour change le signal`, async () => {
      await sousTheme(theme, async () => {
        const charge = rencontreRepetee();
        const tour2 = modeleDe(charge, { tour: 2, proposition: 1, k: 1.5 });
        expect(tour2.tables.map(({ conflit }) => conflit)).toEqual([true, false, false, false]);
        const vue = { k: 1.5, tx: 150, ty: 250 };
        const { svg } = monterPlan(tour2, vue);
        const enConflit = plateauDe(svg, 1);
        const saine = plateauDe(svg, 2);
        expect(enConflit.dataset.marque).toBe('contourConflit');
        expect(parseFloat(getComputedStyle(enConflit).strokeWidth)).toBeGreaterThan(parseFloat(getComputedStyle(saine).strokeWidth));
        expect(couleursPeintes(enConflit).stroke).not.toEqual(couleursPeintes(saine).stroke);
        // La seule règle active, nouveaux voisins : sa trame seule.
        const trames = tous(svg, TRAMES);
        expect(trames.length).toBe(1);
        expect(trames[0].dataset.marque).toBe('trameVoisins');
        expect(trames[0].closest('[data-table]').dataset.table).toBe('1');
        expect(getComputedStyle(trames[0]).fill).toMatch(/^url\("?#/);
        expect(couleursPeintes(trames[0]).fill.some((c) => memeCouleur(c, jeton('--couleur-conflit-voisins')))).toBe(true);
        const pastilles = tous(svg, '[data-pastille]');
        expect(pastilles.length).toBe(1);
        expect(pastilles[0].dataset.pastille).toBe('1');
        expect(pastilles[0].textContent).toBe(String(tour2.tables[0].pastille));
        expect(visible(pastilles[0].querySelector('text'))).toBe(true);
        expect(couleursPeintes(pastilles[0].querySelector('[data-marque=pastille]')).fill).toEqual([jeton('--couleur-pastille-fond')]);
        // La pastille se pose sur un socle du fond du plateau : la trame ne
        // passe pas sous elle (§ 14.5), et reste peinte autour du socle.
        expect(fondPeintSous(pastilles[0].querySelector('[data-marque=pastille]'))).toEqual([jeton('--couleur-table-fond')]);
        const socle = trames[0].closest('[data-table]').querySelector('[data-socle]');
        expect(Number(socle.getAttribute('r'))).toBeLessThan(Number(enConflit.getAttribute('r')));
        expect(getComputedStyle(pastilles[0]).pointerEvents).toBe('none');
        // Le retracé du contour épaissi n'existe que sur la table signalée, et
        // se peint avant ses chaises : il ne couvre pas leur bord.
        const retraces = tous(svg, 'path.retrace');
        expect(retraces.length).toBe(1);
        expect(retraces[0].closest('[data-table]').dataset.table).toBe('1');
        const chaise = svg.querySelector('[data-table="1"] [data-siege]');
        expect(retraces[0].compareDocumentPosition(chaise) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        demonterTout();

        const tour1 = monterPlan(modeleDe(charge, { tour: 1, proposition: 1, k: 1.5 }), vue).svg;
        expect(plateauDe(tour1, 1).dataset.marque).toBe('contourTable');
        expect(tous(tour1, `${TRAMES}, [data-pastille], path.retrace`).length).toBe(0);
        expect(getComputedStyle(plateauDe(tour1, 1)).strokeWidth).toBe(getComputedStyle(plateauDe(tour1, 2)).strokeWidth);

        const reserve = chargeDeTables([8]);
        reserve.reservations = [{ participant: 1, table: 1, siege: 1, portee: 'tous', tour: null }];
        const places = monterPlan(modeleDe(reserve, { k: 1.5 }), vue).svg;
        const [plein, nu] = ['1:1', '1:2'].map((s) => places.querySelector(`[data-siege="${s}"] > circle`));
        expect(couleursPeintes(plein).fill).not.toEqual(couleursPeintes(nu).fill);
      });
    });
  }

  test('toutes en conflit, au rendu : ni contour ni trame, le style d\u{2019}une table saine ; chaque pastille garde son nombre ; le bandeau porte la phrase', () => {
    const charge = toutesEnConflit();
    const modele = modeleDe(charge, { proposition: 1, k: 1 });
    expect(modele.signalerConflits).toBe(false);
    const { svg } = monterPlan(modele, { k: 1, tx: 150, ty: 250 });
    expect(tous(svg, `[data-marque=contourConflit], ${TRAMES}, path.retrace`).length).toBe(0);
    const saine = monterPlan(modeleDe(chargeDeTables([3]), { k: 1 }), { k: 1, tx: 150, ty: 600 }).svg;
    const reference = getComputedStyle(plateauDe(saine, 1));
    for (const id of [1, 2, 3, 4]) {
      const style = getComputedStyle(plateauDe(svg, id));
      for (const propriete of ['stroke', 'strokeWidth', 'fill']) expect(style[propriete]).toBe(reference[propriete]);
    }
    const pastilles = tous(svg, '[data-pastille]');
    expect(pastilles.length).toBe(4);
    for (const pastille of pastilles) {
      const table = modele.tables.find(({ id }) => String(id) === pastille.dataset.pastille);
      expect(table.pastille).toBeGreaterThan(0);
      expect(pastille.textContent).toBe(String(table.pastille));
    }
    const bandeau = monterHtml(BandeauPlan, { bandeau: modele.bandeau });
    const porteur = bandeau.querySelector('[data-bandeau-plan]');
    expect(porteur.textContent).toBe(t('plan.bandeau.toutesEnConflit'));
    expect(visible(porteur.querySelector('li span'))).toBe(true);
  });

  test('le bandeau pose l\u{2019}appartenance d\u{2019}un plancher dans son propre nœud', () => {
    const bandeau = [
      { cle: 'plan.bandeau.toutesEnConflit', details: {} },
      { cle: 'plan.bandeau.plancherGroupe', details: { groupe: 'Club des Merles', effectif: 6, plancherCumulees: 8 } },
    ];
    const conteneur = monterHtml(BandeauPlan, { bandeau });
    const entrees = tous(conteneur, '[data-bandeau-plan] li');
    expect(entrees.length).toBe(2);
    const noeuds = [...entrees[1].querySelectorAll('*')].map((e) => e.textContent);
    expect(noeuds).toContain('Club des Merles');
    expect(noeuds).toContain(t('plan.bandeau.plancherGroupe', bandeau[1].details));
  });
});

// --- Le numéro de la table (§ 7.5, § 7.7, § 14.5) ------------------------------------

// Le numéro d'une table : le <text> qui le porte, dans son groupe.
const numeroDe = (svg, id) => svg.querySelector(`[data-table="${id}"] [data-numero-table="${id}"]`);

// Le corps auquel le canevas mesure l'encre, en px : le canevas arrondit les
// bornes d'encre au px, soit un millième du corps à ce corps.
const CORPS_DE_MESURE = 1000;

// La boîte d'encre d'un <text> d'une ligne, en cm du dessin : sa base
// alphabétique se lit sur la cellule de son premier glyphe
// (getExtentOfChar), dont le haut est à l'ascendante de la police sous la
// base ; l'encre autour de la base et du début se mesure sur un canevas, à
// la police calculée, au corps CORPS_DE_MESURE ramené à celui du texte.
function encreDe(texte) {
  const style = getComputedStyle(texte);
  const corps = Number(texte.getAttribute('font-size'));
  const contexte = new OffscreenCanvas(1, 1).getContext('2d');
  contexte.font = `${style.fontStyle} ${style.fontWeight} ${CORPS_DE_MESURE}px ${style.fontFamily}`;
  const m = contexte.measureText(texte.textContent);
  const echelle = corps / CORPS_DE_MESURE;
  const cellule = texte.getExtentOfChar(0);
  const base = cellule.y + m.fontBoundingBoxAscent * echelle;
  return {
    gauche: cellule.x - m.actualBoundingBoxLeft * echelle,
    droite: cellule.x + m.actualBoundingBoxRight * echelle,
    haut: base - m.actualBoundingBoxAscent * echelle,
    bas: base + m.actualBoundingBoxDescent * echelle,
  };
}

// La distance d'un point à une boîte, 0 dedans.
const distanceBoite = ({ x, y }, b) => Math.hypot(Math.max(0, b.gauche - x, x - b.droite), Math.max(0, b.haut - y, y - b.bas));

describe('le numéro de la table, au centre du plateau (§ 7.7, § 14.5)', () => {
  // encreDe mesure le numéro sur la police calculée, à la face grasse que
  // jetons.css déclare : chargée d'abord, sans quoi le canevas mesurerait la
  // police de repli, et l'encre lue dépendrait des épreuves passées avant.
  beforeAll(async () => {
    const faces = await document.fonts.load('700 16px "Noto Sans"');
    expect(faces.map(({ status }) => status)).toEqual(['loaded']);
  });

  // Trois tables, rondes et carrée, numérotées autrement que leur identifiant.
  function numerotees() {
    const charge = chargeDeTables([2, 8, 10], { formes: ['ronde', 'carree', 'ronde'] });
    charge.tables = charge.tables.map((table, rang) => ({ ...table, numero: [7, 42, 3][rang] }));
    return charge;
  }

  for (const theme of ['clair', 'sombre']) {
    test(`thème ${theme} : chaque table porte son numéro au centre du plateau, au corps de 40 % de sa largeur, de l\u{2019}encre des listes sur un halo du fond du plateau, transparent au pointeur`, async () => {
      await sousTheme(theme, async () => {
        const charge = numerotees();
        const k = 1.2;
        const modele = modeleDe(charge, { k });
        const { svg } = monterPlan(modele, { k, tx: 120, ty: 300 });
        const encre = jeton('--couleur-liste-texte');
        const fond = jeton('--couleur-table-fond');
        expect(contraste(encre, fond)).toBeGreaterThanOrEqual(4.5);
        for (const table of modele.tables) {
          const numero = numeroDe(svg, table.id);
          expect(numero, `table ${table.id}`).not.toBeNull();
          expect(numero.textContent).toBe(String(table.numero));
          expect(visible(numero)).toBe(true);
          expect(numero.getAttribute('aria-hidden')).toBe('true');
          const style = getComputedStyle(numero);
          expect(style.pointerEvents).toBe('none');
          const plateau = plateauDe(svg, table.id).getBoundingClientRect();
          // Le corps se lit en cm du dessin, que le groupe de la vue met à l'échelle k.
          const corps = Math.max(18, 0.4 * (plateau.width / k));
          expect(Math.abs(parseFloat(style.fontSize) - corps), `table ${table.id}`).toBeLessThan(0.5);
          const boite = numero.getBoundingClientRect();
          expect(Math.abs(boite.left + boite.width / 2 - (plateau.left + plateau.width / 2))).toBeLessThan(1);
          expect(Math.abs(boite.top + boite.height / 2 - (plateau.top + plateau.height / 2))).toBeLessThan(0.1 * corps * k);
          expect(memeCouleur(couleurTexte(numero), encre)).toBe(true);
          expect(memeCouleur(composantes(style.stroke), fond)).toBe(true);
          // Le halo, en cm du dessin comme le corps : HALO_NUMERO du corps.
          expect(parseFloat(style.strokeWidth), `table ${table.id}`).toBeCloseTo(HALO_NUMERO * Number(numero.getAttribute('font-size')), 2);
          expect(style.paintOrder.startsWith('stroke')).toBe(true);
          // Sans trame dessous, le numéro se lit sur le plateau même.
          expect(fondPeintSous(numero)).toEqual([fond]);
        }
      });
    });
  }

  test('sur une table signalée, le numéro se peint après les trames, sur un socle du fond du plateau, son halo entre elles et lui ; la pastille sur le bord du plateau, en haut à droite', () => {
    const charge = rencontreRepetee();
    // Deux chiffres sur la plus petite table : leur encre déborde du socle.
    charge.tables = charge.tables.map((table) => (table.id === 1 ? { ...table, numero: 42 } : table));
    const k = 1.5;
    const modele = modeleDe(charge, { tour: 2, proposition: 1, k });
    const { svg } = monterPlan(modele, { k, tx: 150, ty: 250 });
    const [trame] = tous(svg, `[data-table="1"] :is(${TRAMES})`);
    const numero = numeroDe(svg, 1);
    const fond = jeton('--couleur-table-fond');
    expect(trame.compareDocumentPosition(numero) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(memeCouleur(composantes(getComputedStyle(numero).stroke), fond)).toBe(true);
    // Le socle du numéro, centré sous lui, le sépare des trames (§ 14.5) ;
    // il tient dans le plateau, et la trame reste peinte autour.
    expect(fondPeintSous(numero)).toEqual([fond]);
    const socle = svg.querySelector('[data-table="1"] [data-socle-numero]');
    expect(trame.compareDocumentPosition(socle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(Number(socle.getAttribute('r'))).toBeLessThan(Number(plateauDe(svg, 1).getAttribute('r')) / 2);
    expect(tous(svg, '[data-socle-numero]').length).toBe(1);
    // Hors du socle, les bords des chiffres reposent sur la trame : seul le
    // halo, du fond du plateau, les en sépare, de la moitié de son épaisseur.
    expect(Number(plateauDe(svg, 1).getAttribute('r'))).toBe(PLANCHER_DIAMETRE / 2);
    const encre = encreDe(numero);
    const cx = Number(socle.getAttribute('cx'));
    expect(numero.textContent).toBe('42');
    const debord = Math.max(cx - encre.gauche, encre.droite - cx) - Number(socle.getAttribute('r'));
    expect(debord).toBeGreaterThan(0);
    const style = getComputedStyle(numero);
    expect(parseFloat(style.strokeWidth)).toBeCloseTo(HALO_NUMERO * Number(numero.getAttribute('font-size')), 2);
    // La moitié du halo, peinte hors de l'encre, couvre ce qui déborde du
    // socle : aucun bord de chiffre ne touche la trame.
    expect(debord).toBeLessThanOrEqual(parseFloat(style.strokeWidth) / 2);
    expect(style.fontWeight).toBe('700');
    expect(style.paintOrder.startsWith('stroke')).toBe(true);
    const disque = svg.querySelector('[data-pastille="1"] [data-marque=pastille]');
    const plateau = plateauDe(svg, 1);
    const p = centre(disque);
    const c = centre(plateau);
    const rayon = plateau.getBoundingClientRect().width / 2;
    expect(p.x).toBeGreaterThan(c.x);
    expect(p.y).toBeLessThan(c.y);
    expect(Math.abs(Math.hypot(p.x - c.x, p.y - c.y) - rayon)).toBeLessThan(1);
    // Le numéro reste au centre du plateau.
    const n = centre(numero);
    expect(Math.hypot(n.x - c.x, n.y - c.y)).toBeLessThan(0.1 * Number(numero.getAttribute('font-size')) * k);
  });

  test('l\u{2019}encre d\u{2019}un numéro de deux chiffres ne passe pas sous la pastille, ni sous la marque de gel, de la plus petite table à la plus grande', () => {
    for (const forme of ['ronde', 'carree']) {
      const capacites = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16];
      const charge = chargeDeTables(capacites, { formes: capacites.map(() => forme) });
      charge.tables = charge.tables.map((table) => ({ ...table, numero: 88 }));
      const modele = modeleDe(charge, { k: 4 });
      const { svg } = monterPlan(modele, { k: 4, tx: 200, ty: 400 });
      for (const table of modele.tables) {
        const quoi = `${forme} de ${table.geometrie.chaises.length}`;
        const encre = encreDe(numeroDe(svg, table.id));
        const { pastille, gel } = formesTable(table.geometrie);
        expect(distanceBoite(pastille, encre), quoi).toBeGreaterThan(RAYON_PASTILLE);
        expect(encre.haut, quoi).toBeGreaterThan(gel.y + DEMI_HAUTEUR_GEL);
      }
      demonterTout();
    }
  });

  test('trois et quatre chiffres sur la plus petite table de chaque forme : l\u{2019}encre mesurée reste à ECART_NUMERO de la pastille et de la marque de gel, au corps des listes au moins', () => {
    for (const forme of ['ronde', 'carree']) {
      const numeros = [100, 888, 1000, 8888];
      const capacites = [1, 2, 3, 4].flatMap((places) => numeros.map(() => places));
      const charge = chargeDeTables(capacites, { formes: capacites.map(() => forme) });
      charge.tables = charge.tables.map((table, rang) => ({ ...table, numero: numeros[rang % numeros.length] }));
      const k = 2;
      const modele = modeleDe(charge, { k });
      const { svg } = monterPlan(modele, { k, tx: 100, ty: 300 });
      for (const table of modele.tables) {
        const quoi = `${forme} de ${table.geometrie.chaises.length}, ${table.numero}`;
        const numero = numeroDe(svg, table.id);
        expect(numero.textContent).toBe(String(table.numero));
        expect(Number(numero.getAttribute('font-size')), quoi).toBeGreaterThanOrEqual(TAILLE_TEXTE_LISTE_CM);
        const encre = encreDe(numero);
        const { pastille, gel } = formesTable(table.geometrie);
        expect(distanceBoite(pastille, encre), quoi).toBeGreaterThanOrEqual(RAYON_PASTILLE + ECART_NUMERO);
        expect(encre.haut, quoi).toBeGreaterThanOrEqual(gel.y + DEMI_HAUTEUR_GEL + ECART_NUMERO);
      }
      demonterTout();
    }
  });

  test('les bornes d\u{2019}encre des chiffres de la géométrie couvrent l\u{2019}encre mesurée sur la police chargée, à quarante corps', () => {
    // Des corps variés, de la plus petite table à la plus grande : l'arrondi
    // de la ligne de base et des chasses change d'un corps à l'autre. Les
    // numéros les plus longs vont aux plus petites tables, où l'encre laisse
    // le moins de marge en px à sa chasse.
    const numeros = [35160, 9999, 2048, 111, 47, 10, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const charge = chargeDeTables(Array.from({ length: 40 }, (_, rang) => rang + 1));
    charge.tables = charge.tables.map((table, rang) => ({ ...table, numero: numeros[rang % numeros.length] }));
    const k = 1;
    const modele = modeleDe(charge, { k });
    const { svg } = monterPlan(modele, { k, tx: 60, ty: 300 });
    for (const table of modele.tables) {
      const numero = numeroDe(svg, table.id);
      const corps = Number(numero.getAttribute('font-size'));
      const [x, y] = ['x', 'y'].map((a) => Number(numero.getAttribute(a)));
      const demi = (String(table.numero).length * AVANCE_CHIFFRE * corps) / 2;
      const encre = encreDe(numero);
      const quoi = `${table.numero} : ${JSON.stringify(encre)}`;
      expect(encre.gauche, quoi).toBeGreaterThanOrEqual(x - demi);
      expect(encre.droite, quoi).toBeLessThanOrEqual(x + demi);
      expect(encre.haut, quoi).toBeGreaterThanOrEqual(y - ENCRE_HAUT_CHIFFRE * corps - DECALAGE_ANCRE);
      expect(encre.bas, quoi).toBeLessThanOrEqual(y + ENCRE_BAS_CHIFFRE * corps + DECALAGE_ANCRE);
    }
  });

  test('le plan imprimé porte les numéros de l\u{2019}écran, à la même place et au même corps', () => {
    const charge = numerotees();
    const ecran = monterPlan(modeleDe(charge, { k: 1 }), { k: 1, tx: 150, ty: 300 }).svg;
    const attributs = (svg) =>
      tous(svg, '[data-numero-table]').map((n) => [n.textContent, ...['x', 'y', 'font-size'].map((a) => n.getAttribute(a))]);
    const attendus = attributs(ecran);
    demonterTout();
    const imprime = monterPlan(modeleDe(charge, { impression: true }), { k: 1, tx: 150, ty: 300 }).svg;
    expect(attendus.map(([texte]) => texte)).toEqual(['7', '42', '3']);
    expect(attributs(imprime)).toEqual(attendus);
    for (const numero of tous(imprime, '[data-numero-table]')) expect(visible(numero)).toBe(true);
  });
});

// --- Le socle de la pastille, dans le plateau (§ 7.5, § 14.5) ------------------------

// Les pixels peints d'un élément, lus sur une capture d'écran au facteur
// d'échelle 1 : une fonction de (x, y), en px de la fenêtre, vers [r, g, b].
async function pixelsDe(element) {
  const boite = element.getBoundingClientRect();
  const base64 = await page.screenshot({ element, save: false });
  const octets = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const image = await createImageBitmap(new Blob([octets], { type: 'image/png' }));
  expect([image.width, image.height]).toEqual([Math.round(boite.width), Math.round(boite.height)]);
  const contexte = new OffscreenCanvas(image.width, image.height).getContext('2d');
  contexte.drawImage(image, 0, 0);
  const { data } = contexte.getImageData(0, 0, image.width, image.height);
  return ({ x, y }) => {
    const i = (Math.floor(y - boite.top) * image.width + Math.floor(x - boite.left)) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
}

// Vrai quand un pixel a la couleur donnée, à l'arrondi du rendu près.
const pixelDe = (pixel, couleur) => pixel.every((c, i) => Math.abs(c - couleur[i]) <= 3);

describe('le socle de la pastille, dans le plateau (§ 7.5, § 14.5)', () => {
  for (const theme of ['clair', 'sombre']) {
    test(`thème ${theme} : près de la pastille d\u{2019}une table signalée, ronde ou carrée, le contour épaissi garde toute son épaisseur et le fond du plateau ne déborde pas sur le sol`, async () => {
      await sousTheme(theme, async () => {
        for (const forme of ['ronde', 'carree']) {
          const charge = rencontreRepetee();
          charge.tables = charge.tables.map((table) => (table.id === 1 ? { ...table, forme } : table));
          const k = 4;
          const modele = modeleDe(charge, { tour: 2, proposition: 1, k, listes: false });
          const table = modele.tables.find(({ id }) => id === 1);
          expect(modele.signalerConflits && table.conflit, forme).toBe(true);
          expect(table.regime).toBe('sieges');
          const { centre, demiTaille, chaises } = table.geometrie;
          const vue = { k, tx: 300 - k * centre.x, ty: 350 - k * centre.y };
          const { svg, ecran } = monterPlan(modele, vue);
          svg.style.background = 'var(--couleur-sol)';
          const pixel = await pixelsDe(svg);
          const px = 1 / k;
          const p = formesTable(table.geometrie).pastille;
          // Hors des chaises, peintes après le plateau, et de leur trait.
          const horsChaises = (q) => chaises.every((chaise) => Math.hypot(q.x - chaise.x, q.y - chaise.y) > chaise.rayon + 2 * px);

          // Le contour : un px de part et d'autre du bord, dans chaque
          // moitié du trait de 4 px, des deux côtés de la pastille, entre son
          // disque et 20 cm de son centre, où le socle couvre les trames.
          const contour = [];
          for (const cote of [-1, 1]) {
            for (const d of [16, 17.5, 19]) {
              let bord;
              let normale;
              if (forme === 'ronde') {
                const a = Math.atan2(p.y - centre.y, p.x - centre.x) + cote * 2 * Math.asin(d / (2 * demiTaille));
                normale = { x: Math.cos(a), y: Math.sin(a) };
                bord = { x: centre.x + demiTaille * normale.x, y: centre.y + demiTaille * normale.y };
              } else {
                normale = cote < 0 ? { x: 0, y: -1 } : { x: 1, y: 0 };
                bord = cote < 0 ? { x: p.x - d, y: p.y } : { x: p.x, y: p.y + d };
              }
              for (const sens of [-1, 1]) {
                const q = { x: bord.x + sens * normale.x * px, y: bord.y + sens * normale.y * px };
                if (horsChaises(q)) contour.push({ cote, sens, q });
              }
            }
          }
          expect(new Set(contour.map(({ cote, sens }) => `${cote}${sens}`)).size, forme).toBe(4);
          const fort = jeton('--couleur-contour-fort');
          for (const { q } of contour) expect(pixel(ecran(q.x, q.y)), `${forme} : contour en ${q.x}, ${q.y}`).toSatisfy((c) => pixelDe(c, fort));

          // Le sol autour : à plus de 3 px du bord du plateau, hors du
          // disque de la pastille, à moins de 20 cm de son centre.
          const dehors = (q) =>
            forme === 'ronde'
              ? Math.hypot(q.x - centre.x, q.y - centre.y) > demiTaille + 3 * px
              : Math.max(Math.abs(q.x - centre.x), Math.abs(q.y - centre.y)) > demiTaille + 3 * px;
          const sol = [];
          for (const d of [16.5, 18, 19.5]) {
            for (let degres = 0; degres < 360; degres += 10) {
              const a = (degres * Math.PI) / 180;
              const q = { x: p.x + d * Math.cos(a), y: p.y + d * Math.sin(a) };
              if (dehors(q) && horsChaises(q)) sol.push(q);
            }
          }
          expect(sol.length, forme).toBeGreaterThan(10);
          const teinteSol = jeton('--couleur-sol');
          for (const q of sol) expect(pixel(ecran(q.x, q.y)), `${forme} : sol en ${q.x}, ${q.y}`).toSatisfy((c) => pixelDe(c, teinteSol));
          demonterTout();
        }
      });
    });
  }
});

// --- Les trois sortes de conflit (§ 7.5, § 7.6, § 12.7) ---------------------------

// Le motif d'une trame : le <pattern> que désigne son remplissage.
function motifDe(trame) {
  const id = /^url\("?#([^")]+)"?\)/.exec(getComputedStyle(trame).fill)?.[1];
  return id === undefined ? null : document.getElementById(id);
}

// La forme d'un motif, lue dans le document : 'points' pour des disques ;
// pour des traits, leur sens à l'écran — la direction d'un trait du carreau
// passée par patternTransform —, 'hachuresDescendantes' quand il descend
// vers la droite, 'hachuresMontantes' quand il monte.
function formeDe(motif) {
  const formes = [...motif.children].filter((n) => n instanceof SVGGeometryElement);
  if (formes.length > 0 && formes.every((n) => n.localName === 'circle')) return 'points';
  if (formes.length === 0 || !formes.every((n) => n.localName === 'line')) return `formes ${formes.map((n) => n.localName)}`;
  const [trait] = formes;
  const dx = trait.x2.baseVal.value - trait.x1.baseVal.value;
  const dy = trait.y2.baseVal.value - trait.y1.baseVal.value;
  const m = motif.patternTransform.baseVal.consolidate()?.matrix ?? new DOMMatrix();
  const [ex, ey] = [m.a * dx + m.c * dy, m.b * dx + m.d * dy];
  if (Math.abs(ex) < 1e-6 || Math.abs(ey) < 1e-6) return 'traits droits';
  return ex * ey > 0 ? 'hachuresDescendantes' : 'hachuresMontantes';
}

// Les couleurs d'une trame, en texte trié, pour une comparaison d'ensembles.
const couleursEnTexte = (couleurs) => couleurs.map((c) => c.slice(0, 3).join(',')).sort();

// La petite démonstration en conflit, une proposition de rechercher, graine
// 3 : son tour 3 signale les trois sortes, une table saine, une table qui
// viole les trois règles et une qui en viole deux.
function troisSortes() {
  const charge = analyser(texteLivre('petite-conflit')).charge;
  const configuration = configurationDepuisCharge(charge);
  const [proposition] = rechercher(configuration, { graine: 3, nombre: 1, arret: 300, historique: 1000 });
  return avecProposition(charge, versFichier(proposition, configuration, { produitVersion: 'epreuve', attribuerSieges: false, decalage: 0 }));
}

describe('les trois sortes de conflit : une forme et une teinte par règle (§ 7.5, § 7.6, § 12.7)', () => {
  for (const theme of ['clair', 'sombre']) {
    test(`thème ${theme} : chaque règle dessine sa forme dans sa teinte, sur le fond du plateau ; une table qui en viole plusieurs les superpose, dans l\u{2019}ordre du moteur`, async () => {
      await sousTheme(theme, async () => {
        const charge = troisSortes();
        const fond = couleursEnTexte([jeton('--couleur-table-fond')]);
        const formes = new Map();
        let superposees = 0;
        for (let tour = 1; tour <= charge.evenement.tours; tour += 1) {
          const modele = modeleDe(charge, { tour, proposition: 1, k: 1 });
          if (!modele.signalerConflits) continue;
          const { svg } = monterPlan(modele, { k: 1, tx: 150, ty: 250 });
          for (const table of modele.tables) {
            const trames = tous(svg, `[data-table="${table.id}"] :is(${TRAMES})`);
            expect(trames.map((e) => e.dataset.marque), `tour ${tour}, table ${table.id}`).toEqual(table.trames.map(({ marque }) => marque));
            if (trames.length > 1) superposees += 1;
            for (const [rang, trame] of trames.entries()) {
              const { regle, jeton: nom, forme } = table.trames[rang];
              expect(trame.checkVisibility({ opacityProperty: true, visibilityProperty: true })).toBe(true);
              const motif = motifDe(trame);
              expect(motif?.localName, regle).toBe('pattern');
              expect(formeDe(motif), regle).toBe(forme);
              // Le motif ne peint que sa teinte et le fond du plateau : le
              // halo de ses traits, qui les détache d'une trame dessous.
              expect(couleursEnTexte(couleursPeintes(trame).fill), regle).toEqual([...couleursEnTexte([jeton(nom)]), ...fond].sort());
              formes.set(regle, forme);
            }
            // Les trames suivent le plateau, et la pastille reste sur son socle.
            if (trames.length > 0) {
              const plateau = plateauDe(svg, table.id);
              expect(trames.every((e) => plateau.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
              const pastille = svg.querySelector(`[data-pastille="${table.id}"] [data-marque=pastille]`);
              expect(fondPeintSous(pastille)).toEqual([jeton('--couleur-table-fond')]);
            }
          }
          demonterTout();
        }
        expect(Object.fromEntries(formes)).toEqual(Object.fromEntries(CONFLITS.map(({ regle, forme }) => [regle, forme])));
        expect(new Set(formes.values()).size).toBe(3);
        expect(superposees).toBeGreaterThan(0);
      });
    });
  }
});

describe('la légende des conflits (§ 7.5, § 14.5)', () => {
  const REGLAGES = { separerAppartenances: true, nouveauxVoisins: true, nouvelleTable: true, varierAppartenances: true, attribuerSieges: false };

  for (const theme of ['clair', 'sombre']) {
    test(`thème ${theme} : un échantillon par règle active, de la forme et de la teinte du plan, et son nom ; la pastille et ce qu\u{2019}elle compte ; texte à 4,5:1`, async () => {
      await sousTheme(theme, async () => {
        const entrees = legendeConflits(REGLAGES);
        expect(entrees.length).toBe(3);
        const conteneur = monterHtml(Legende, { entrees });
        const legende = conteneur.querySelector('[data-legende]');
        expect(visible(legende.querySelector('h3, h2, p, span'))).toBe(true);
        const items = tous(legende, '[data-legende-regle]');
        expect(items.map((e) => e.dataset.legendeRegle)).toEqual(CONFLITS.map(({ regle }) => regle));
        for (const [rang, item] of items.entries()) {
          const { marque, jeton: nom, forme, cle, cleForme } = entrees[rang];
          const trame = item.querySelector(`svg [data-marque="${marque}"]`);
          expect(trame, marque).not.toBeNull();
          expect(trame.checkVisibility({ opacityProperty: true, visibilityProperty: true })).toBe(true);
          expect(formeDe(motifDe(trame))).toBe(forme);
          expect(couleursEnTexte(couleursPeintes(trame).fill)).toEqual([...couleursEnTexte([jeton(nom)]), ...couleursEnTexte([jeton('--couleur-table-fond')])].sort());
          expect(item.textContent).toContain(t(cle));
          expect(item.textContent).toContain(t(cleForme));
          expect(item.querySelectorAll('svg [data-marque="contourConflit"]').length).toBe(1);
        }
        const pastille = legende.querySelector('[data-legende-pastille]');
        expect(pastille.querySelector('svg [data-marque="pastille"]')).not.toBeNull();
        expect(pastille.textContent).toContain(t('plan.legende.pastille'));
        expect(pastille.querySelector('svg text').textContent).toBe(t('plan.legende.pastilleExemple'));
        // Chaque texte HTML de la légende tient 4,5:1 sur son fond peint.
        const textes = tous(legende, '*').filter((e) => !(e instanceof SVGElement) && [...e.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim() !== ''));
        expect(textes.length).toBeGreaterThan(3);
        for (const element of textes) {
          const [fond] = fondPeintSous(element);
          expect(contraste(couleurTexte(element), fond), element.textContent).toBeGreaterThanOrEqual(4.5);
        }
      });
    });
  }

  test('une règle inactive n\u{2019}y paraît pas ; aucune règle active : la légende le dit, et garde la pastille', () => {
    const deux = monterHtml(Legende, { entrees: legendeConflits({ ...REGLAGES, nouveauxVoisins: false }) });
    expect(tous(deux, '[data-legende-regle]').map((e) => e.dataset.legendeRegle)).toEqual(['separerAppartenances', 'nouvelleTable']);
    expect(deux.querySelector('[data-marque="trameVoisins"]')).toBeNull();
    const aucune = monterHtml(Legende, { entrees: legendeConflits({ ...REGLAGES, separerAppartenances: false, nouveauxVoisins: false, nouvelleTable: false }) });
    expect(tous(aucune, '[data-legende-regle]').length).toBe(0);
    expect(aucune.querySelector('[data-legende]').textContent).toContain(t('plan.legende.aucune'));
    expect(aucune.querySelector('[data-legende-pastille]')).not.toBeNull();
  });
});

describe('l\u{2019}échelle graphique et la mention (§ 7.7, § 19.3 07)', () => {
  test('la mention se voit, portée par EchellePlan, tirée des libellés', () => {
    const conteneur = monterHtml(EchellePlan, { k: 1 });
    const mention = [...conteneur.querySelectorAll('*')].find((e) => e.textContent === t('plan.echelle.mention'));
    expect(mention).toBeDefined();
    expect(mention.textContent).toBe("disposition relative \u{2014} l'encombrement dans la salle n'est pas vérifié");
    expect(visible(mention)).toBe(true);
  });

  for (const k of [0.2, 1, 5]) {
    test(`k = ${k} : la largeur rendue de la barre, divisée par k, égale sa longueur libellée à 1 % près`, () => {
      const conteneur = monterHtml(EchellePlan, { k });
      const barre = conteneur.querySelector('[data-marque=echelle]');
      expect(visible(barre)).toBe(true);
      const { longueurCm } = echelleGraphique(k, LARGEUR_ECHELLE_PX);
      const libelle = barre.parentElement.textContent;
      const lu = /^([\d,]+)\s*(cm|m|km)$/.exec(libelle.trim());
      expect(lu).not.toBeNull();
      const facteur = { cm: 1, m: 100, km: 100000 }[lu[2]];
      const longueurLue = Number(lu[1].replace(',', '.')) * facteur;
      expect(longueurLue).toBeCloseTo(longueurCm, 6);
      expect(Math.abs(barre.getBoundingClientRect().width / k - longueurLue) / longueurLue).toBeLessThan(0.01);
      expect(/\b1\s*:\s*\d/.test(conteneur.textContent)).toBe(false);
    });
  }
});

describe('les seuils de rendu (§ 7.3, § 17 point 6, § 19.10)', () => {
  test('à K_LISTES − 0,01, aucun tspan de liste ; à K_LISTES + 0,01, les listes sont là', () => {
    const charge = chargeDeTables([8, 8]);
    for (const [k, present] of [
      [K_LISTES - 0.01, false],
      [K_LISTES + 0.01, true],
    ]) {
      const { svg } = monterPlan(modeleDe(charge, { k }), { k, tx: 200, ty: 200 });
      expect(tous(svg, '[data-liste] tspan').length > 0).toBe(present);
      expect(tous(svg, '[data-table]').length).toBe(2);
    }
  });

  test('grande démonstration : à 0,39, aucune chaise, une seule cible par table ; à 0,41, 260 sièges', () => {
    const charge = analyser(texteLivre('grande')).charge;
    const vue = { k: 0.39, tx: 80, ty: 80 };
    const bas = monterPlan(modeleDe(charge, { k: 0.39 }), vue);
    expect(tous(bas.svg, '[data-siege]').length).toBe(0);
    const modele = modeleDe(charge, { k: 0.39 });
    let chaises = 0;
    for (const table of modele.tables) {
      const { centre: c, rayonEmprise } = table.geometrie;
      const coin1 = bas.ecran(c.x - rayonEmprise, c.y - rayonEmprise);
      const coin2 = bas.ecran(c.x + rayonEmprise, c.y + rayonEmprise);
      if (coin1.x < 0 || coin1.y < 0 || coin2.x > innerWidth || coin2.y > innerHeight) continue;
      const atteints = table.geometrie.chaises.map(({ x, y }) => {
        const p = bas.ecran(x, y);
        return document.elementFromPoint(p.x, p.y);
      });
      chaises += atteints.length;
      expect(new Set(atteints).size).toBe(1);
      expect(atteints[0].closest('[data-siege]')).toBeNull();
      expect(atteints[0].closest('[data-table]').dataset.table).toBe(String(table.id));
    }
    expect(chaises).toBeGreaterThanOrEqual(10);

    const haut = monterPlan(modeleDe(charge, { k: 0.41 }), { k: 0.41, tx: 80, ty: 80 });
    const capacites = etatPlaces(charge, { tour: 1 }).tables.reduce((somme, { capacite }) => somme + capacite, 0);
    expect(capacites).toBe(260);
    expect(tous(haut.svg, '[data-siege]').length).toBe(260);
  });
});

describe('dessin et désignation (§ 7.3, § 13.5)', () => {
  test('au seuil k = 24/pas de chaque table, la cible d’un siège a la taille du pas : à pas/2 − 1 px de sa chaise, vers sa voisine, le DOM et designer désignent la chaise ; à pas/2 + 1 px, ils désignent la même place', () => {
    const charge = chargeDeTables([3, 8, 8, 12], { pas: 800, formes: ['ronde', 'ronde', 'carree', 'carree'] });
    let points = 0;
    for (const id of [1, 2, 3, 4]) {
      const geometrie = modeleDe(charge, { k: 1 }).tables[id - 1].geometrie;
      const k = (24 / geometrie.pas) * (1 + 1e-9);
      const vue = { k, tx: innerWidth / 2 - k * geometrie.centre.x, ty: innerHeight / 2 };
      const modele = modeleDe(charge, { k, listes: false });
      expect(modele.tables[id - 1].regime).toBe('sieges');
      const geometries = modele.tables.map(({ geometrie: g }) => g);
      const { cadre, ecran } = monterPlan(modele, vue);
      const { chaises } = geometries[id - 1];
      chaises.forEach((chaise, i) => {
        const voisine = chaises[(i + 1) % chaises.length];
        const c = ecran(chaise.x, chaise.y);
        const v = ecran(voisine.x, voisine.y);
        const d = Math.hypot(v.x - c.x, v.y - c.y);
        for (const [ecart, attendu] of [[-1, `${id}:${chaise.siege}`], [1, undefined]]) {
          const portee = (geometrie.pas / 2) * k + ecart;
          const p = { x: c.x + ((v.x - c.x) * portee) / d, y: c.y + ((v.y - c.y) * portee) / d };
          const parDom = document.elementFromPoint(p.x, p.y)?.closest('[data-siege]')?.dataset.siege ?? null;
          const designe = designer(dessinDepuisEcran(vue, cadre, p.x, p.y), geometries, k);
          const parGeometrie = designe !== null && designe.siege !== undefined ? `${designe.table}:${designe.siege}` : null;
          expect(parDom, `table ${id}, siège ${chaise.siege}, écart ${ecart}`).toBe(parGeometrie);
          if (attendu !== undefined) expect(parDom, `table ${id}, siège ${chaise.siege}`).toBe(attendu);
          points += 1;
        }
      });
      demonterTout();
    }
    expect(points).toBe(2 * (3 + 8 + 8 + 12));
  });

  test('le centre rendu de chaque siège est sa position ; aux points témoins, le DOM et designer désignent la même place ; une liste ne masque aucune chaise', () => {
    // La table 2 si près que la liste de la table 1 passe sur ses chaises de
    // gauche.
    const charge = chargeDeTables([8, 8], { pas: 280 });
    const vue = { k: 1.5, tx: 300, ty: 350 };
    const modele = modeleDe(charge, { k: vue.k });
    const { svg, cadre, ecran } = monterPlan(modele, vue);
    const geometries = modele.tables.map(({ geometrie }) => geometrie);
    const sieges = tous(svg, '[data-siege]');
    expect(sieges.length).toBe(16);
    for (const element of sieges) {
      const [table, siege] = element.dataset.siege.split(':').map(Number);
      const attendu = geometries[table - 1].chaises[siege - 1];
      const c = centre(element);
      const lu = dessinDepuisEcran(vue, cadre, c.x, c.y);
      expect(Math.hypot(lu.x - attendu.x, lu.y - attendu.y) * vue.k).toBeLessThan(0.5);
    }

    const temoins = [];
    for (const { centre: c, chaises } of geometries) {
      temoins.push(c);
      chaises.forEach((chaise, i) => {
        const suivante = chaises[(i + 1) % chaises.length];
        temoins.push(chaise, { x: (chaise.x + suivante.x) / 2, y: (chaise.y + suivante.y) / 2 });
      });
    }
    temoins.push({ x: -300, y: 0 }, { x: 100, y: -200 });
    expect(temoins.length).toBe(36);
    for (const point of temoins) {
      const p = ecran(point.x, point.y);
      const parDom = document.elementFromPoint(p.x, p.y)?.closest('[data-siege]')?.dataset.siege ?? null;
      const designe = designer(dessinDepuisEcran(vue, cadre, p.x, p.y), geometries, vue.k);
      const parGeometrie = designe !== null && designe.siege !== undefined ? `${designe.table}:${designe.siege}` : null;
      expect(parDom, `point (${point.x}, ${point.y})`).toBe(parGeometrie);
    }

    const boite = svg.querySelector('[data-liste="1"]').getBoundingClientRect();
    const couvertes = geometries[1].chaises
      .map((chaise) => ({ chaise, p: ecran(chaise.x, chaise.y) }))
      .filter(({ p }) => p.x >= boite.left && p.x <= boite.right && p.y >= boite.top && p.y <= boite.bottom);
    expect(couvertes.length).toBeGreaterThanOrEqual(1);
    for (const { chaise, p } of couvertes) {
      expect(document.elementFromPoint(p.x, p.y).closest('[data-siege]').dataset.siege).toBe(`2:${chaise.siege}`);
    }
  });
});

describe('aucune rotation, aucun canvas (§ 7.1, § 13.3)', () => {
  test('chaque table, ronde ou carrée, porte une seule poignée, centrée sur GeometrieTable.poignee', () => {
    const charge = chargeDeTables([8, 12, 2], { formes: ['ronde', 'carree', 'carree'], pas: 450 });
    for (const vue of [
      { k: 1, tx: 200, ty: 300 },
      { k: 0.3, tx: 200, ty: 300 },
    ]) {
      const modele = modeleDe(charge, { k: vue.k });
      const { svg, groupe, ecran } = monterPlan(modele, vue);
      expect(tous(svg, '[data-poignee]').length).toBe(3);
      for (const table of modele.tables) {
        const poignees = tous(svg, `[data-poignee="${table.id}"]`);
        expect(poignees.length).toBe(1);
        const attendu = ecran(table.geometrie.poignee.x, table.geometrie.poignee.y);
        const c = centre(poignees[0]);
        expect(Math.hypot(c.x - attendu.x, c.y - attendu.y)).toBeLessThan(1);
        expect(poignees[0].dataset.marque).toBe('poignee');
      }
      expect(groupe.closest('[data-surface]').querySelectorAll('canvas').length).toBe(0);
    }
  });
});

describe('la mise en évidence', () => {
  test('la chaise de la personne, et elle seule, porte [data-marque=miseEnEvidence] au tour montré', () => {
    const charge = avecProposition(chargeDeTables([4, 4, 4], { tours: 2 }));
    const sieges = new Set();
    for (const tour of [1, 2]) {
      const { svg } = monterPlan(modeleDe(charge, { tour, proposition: 1, k: 1, miseEnEvidence: 5 }), { k: 1, tx: 150, ty: 300 });
      const marquees = tous(svg, '[data-marque=miseEnEvidence]');
      expect(marquees.length).toBe(1);
      const siege = marquees[0].closest('[data-siege]').dataset.siege;
      const etat = etatPlaces(charge, { tour, proposition: 1 });
      const [table, numero] = siege.split(':').map(Number);
      expect(etat.tables.find(({ id }) => id === table).chaises[numero - 1].occupant).toBe(5);
      expect(couleursPeintes(marquees[0]).stroke).toEqual([jeton('--couleur-mise-en-evidence')]);
      expect(anneauVisible(marquees[0])).toBe(true);
      sieges.add(siege);
      demonterTout();
    }
    expect(sieges.size).toBe(2);
  });
});

describe('les bords (points d\u{2019}attention 3 et 4)', () => {
  test('une table de 2 : deux chaises, un disque de 70 cm', () => {
    const { svg } = monterPlan(modeleDe(chargeDeTables([2]), { k: 2 }), { k: 2, tx: 300, ty: 300 });
    expect(tous(svg, '[data-siege]').length).toBe(2);
    expect(Math.abs(plateauDe(svg, 1).getBoundingClientRect().width / 2 - 70)).toBeLessThan(0.5);
  });

  test('une table gelée : la marque gel se voit, « gelée » dans son aria-label et en tête de sa liste', () => {
    const charge = chargeDeTables([2]);
    charge.reservations = [
      { participant: 1, table: 1, siege: 1, portee: 'tous', tour: null },
      { participant: 2, table: 1, siege: 2, portee: 'tous', tour: null },
    ];
    const { svg } = monterPlan(modeleDe(charge, { k: 2 }), { k: 2, tx: 300, ty: 300 });
    const gel = svg.querySelector('[data-table="1"] [data-marque=gel]');
    expect(gel).not.toBeNull();
    expect(visible(gel)).toBe(true);
    expect(svg.querySelector('[data-table="1"]').getAttribute('aria-label')).toMatch(/gelée/);
    expect(lignesDe(svg, 1)[0].textContent).toBe(t('plan.liste.gelee'));
  });

  test('une seule table ; aucune table : aucun [data-table], un bandeau vide, un montage qui ne lève pas', () => {
    expect(tous(monterPlan(modeleDe(chargeDeTables([6]))).svg, '[data-table]').length).toBe(1);
    const vide = creerCharge({ id: 'epreuve:vide', nom: 'Vide', siegesParDefaut: 6, tours: 1 });
    const modele = modeleDe(vide);
    const { svg } = monterPlan(modele);
    expect(tous(svg, '[data-table]').length).toBe(0);
    const conteneur = monterHtml(BandeauPlan, { bandeau: modele.bandeau });
    expect(conteneur.querySelector('[data-bandeau-plan]')).toBeNull();
    expect(conteneur.textContent.trim()).toBe('');
  });

  test('sièges non attribués, deux titres et une réservation « tous » sans siège : la réservée au siège 1, pourvue ; « 2. (libre) — titre … non pourvu »', () => {
    const charge = chargeDeTables([4]);
    charge.reservations = [{ participant: 1, table: 1, siege: null, portee: 'tous', tour: null }];
    charge.titres = [
      { table: 1, siege: 1, libelle: 'animateur' },
      { table: 1, siege: 2, libelle: 'animateur' },
    ];
    const { svg } = monterPlan(modeleDe(charge), { k: 1, tx: 300, ty: 300 });
    const lignes = lignesDe(svg, 1).map((ligne) => ligne.textContent);
    expect(lignes.slice(0, 2)).toEqual([
      '1. (réservée, tous les tours) Iris Ombrelle \u{2014} animateur',
      '2. (libre) \u{2014} titre animateur non pourvu',
    ]);
    expect(svg.querySelector('[data-siege="1:1"] [data-marque=anneau]')).not.toBeNull();
  });
});
