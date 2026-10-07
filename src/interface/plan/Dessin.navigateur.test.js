// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

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
import { flushSync, mount, unmount } from 'svelte';
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
import { GABARIT_HAUTEUR_LIGNE } from '../../geometrie/texte.js';
import { dessinDepuisEcran, ecranDepuisDessin, transformDe } from '../../geometrie/vue.js';
import { rechercher } from '../../moteur/recherche.js';
import { analyser, configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { versFichier } from '../../stockage/placements.js';
import { fixerCadre } from '../../../test/navigateur/entrees.js';
import { composantes, couleursPeintes, fondPeintSous, sousTheme, visible } from '../../../test/navigateur/rendu.js';
import TEXTE_TOUTES_EN_CONFLIT from '../../../test/fixtures/plan/toutes_en_conflit.gtt.json?raw';
import { TABLES_INTERFACE } from '../libelles.js';
import BandeauPlan from './BandeauPlan.svelte';
import EchellePlan from './EchellePlan.svelte';
import { LARGEUR_ECHELLE_PX, modeleDessin } from './modele.js';
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
 *  en display: none, et conteneur.style.display = '' le montre. */
function monterPlan(modele, vue = { k: 1, tx: 0, ty: 0 }, { cache = false } = {}) {
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
  const composant = mount(PlanDessin, { target: groupe, props: { modele }, context: CONTEXTE });
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

const nomsDe = (charge) => {
  const noms = new Map(charge.participants.map(({ id, nom, prenom }) => [id, prenom === null ? nom : `${prenom} ${nom}`]));
  return (id) => noms.get(id);
};

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
        const trames = tous(svg, '[data-marque=trameConflit]');
        expect(trames.length).toBe(1);
        expect(trames[0].closest('[data-table]').dataset.table).toBe('1');
        expect(getComputedStyle(trames[0]).fill).toMatch(/^url\("?#/);
        expect(couleursPeintes(trames[0]).fill.some((c) => memeCouleur(c, jeton('--couleur-conflit')))).toBe(true);
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
        demonterTout();

        const tour1 = monterPlan(modeleDe(charge, { tour: 1, proposition: 1, k: 1.5 }), vue).svg;
        expect(plateauDe(tour1, 1).dataset.marque).toBe('contourTable');
        expect(tous(tour1, '[data-marque=trameConflit], [data-pastille]').length).toBe(0);
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
    expect(tous(svg, '[data-marque=contourConflit], [data-marque=trameConflit]').length).toBe(0);
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
