// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La vue du plan dans un vrai moteur de rendu (§ 7.2, § 7.3, § 7.7, § 8.2,
// § 8.4, § 8.5, § 13.3, § 14.10) : l'oracle du moteur de rendu,
// getScreenCTM().inverse(), confronté à dessinDepuisEcran à tout zoom et
// sur une page défilée ; les trois invariants du <svg data-plan> — pas de
// viewBox, ni bordure ni remplissage, aucune transformation dans
// l'ascendance —, chacun avec son contrôle d'échec ; touch-action ; un zoom
// qui n'écrit qu'un attribut ; le zoom sous le curseur ; l'ajustement ; le
// plan monté caché ou trop petit ; le cadrage, écrit différé dans
// reglages_locaux.json et restitué ; les commandes de vue qui n'écrivent
// rien ; le plein écran ; le diagnostic du panneau latéral.
//
// Chaque épreuve monte App par monterApp, sur le système de fichiers simulé
// et l'horloge pilotée, au cadre de 1 366 × 700, et lit le rendu : la boîte,
// le style calculé, l'attribut transform relu par vueDepuisTransform —
// jamais une classe. Les valeurs attendues viennent des fonctions de
// src/geometrie/vue.js et de vue_plan.js, sollicitées une seconde fois ; les
// noms d'épreuve sont inventés.
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { flushSync } from 'svelte';
import { etatPlaces } from '../../application/places.js';
import { DELAI_REGLAGES_MS } from '../../application/seance.js';
import { FACTEUR_K_MIN, K_MAX, ajuster, bornesZoom, dessinDepuisEcran, kAjuste, transformDe, vueDepuisTransform } from '../../geometrie/vue.js';
import { constante } from '../../geometrie/constantes.js';
import { regimeCibles } from '../../geometrie/designation.js';
import { geometrieTable } from '../../geometrie/tables.js';
import { SUFFIXES } from '../../stockage/noms.js';
import { fixerCadre, molette } from '../../../test/navigateur/entrees.js';
import { monterApp } from '../../../test/navigateur/montage.js';
import { sousTheme, visible } from '../../../test/navigateur/rendu.js';
import { cadreDepuisRect, englobantDuTour, vueApresCadre, vueInitiale } from './vue_plan.js';

const EVENEMENT = { nom: 'Club des Merles', date: null, siegesParDefaut: 3, tours: 2 };
const FICHIER_REGLAGES = 'reglages_locaux.json';

// L'écart admis entre dessinDepuisEcran et l'oracle, en px d'écran : écart
// en cm × k. Chromium lit les nombres de l'attribut transform en flottants
// de 32 bits — 0,6943231441048034 s'y lit 0,6943232417106628 — et compose
// la matrice d'écran à cette précision : à moins de 2 048 px du coin de la
// fenêtre, un ULP vaut au plus 1,2e-4 px, et l'écart relevé reste de cet
// ordre. Un défaut des invariants décale d'au moins un pixel.
const TOLERANCE_ORACLE_PX = 1e-3;

// --- Montages, feuilles d'épreuve, nettoyage -----------------------------------

let montes = [];
let feuilles = [];
let ajouts = [];

async function monter(options) {
  const m = await monterApp(options);
  montes.push(m);
  return m;
}

// Démonte un montage avant la fin de l'épreuve, et relève son collecteur.
let erreursDemontees = [];
function demonter(m) {
  erreursDemontees.push(...m.erreurs());
  m.demonter();
  montes = montes.filter((autre) => autre !== m);
}

/** Pose une feuille de style d'épreuve dans la page ; rend la fonction qui la retire. */
function feuille(css) {
  const element = document.createElement('style');
  element.textContent = css;
  document.head.append(element);
  feuilles.push(element);
  return () => element.remove();
}

beforeEach(async () => {
  await fixerCadre(1366, 700);
});

afterEach(async () => {
  const erreurs = [...erreursDemontees, ...montes.flatMap((m) => m.erreurs())];
  for (const m of montes.reverse()) m.demonter();
  for (const element of [...feuilles, ...ajouts]) element.remove();
  montes = [];
  feuilles = [];
  ajouts = [];
  erreursDemontees = [];
  window.scrollTo(0, 0);
  await fixerCadre(1366, 700);
  expect(erreurs, 'erreurs reçues par le collecteur').toEqual([]);
});

// --- Lectures du rendu -----------------------------------------------------------

const dans = (m, selecteur) => m.racine.querySelector(selecteur);
const tous = (m, selecteur) => [...m.racine.querySelectorAll(selecteur)];
const racinePlan = (m) => dans(m, '[data-plan]');
const groupe = (m) => dans(m, '[data-vue]');
const surface = (m) => dans(m, '[data-surface]');
const cadreDe = (m) => cadreDepuisRect(racinePlan(m).getBoundingClientRect());
const vueLue = (m) => vueDepuisTransform(groupe(m).getAttribute('transform'));
const englobantDe = (m) => englobantDuTour(etatPlaces(m.seance.etat().charge, { tour: 1 }));
const kAjusteDe = (m) => kAjuste(englobantDe(m), cadreDe(m));
const boite = (element) => element.getBoundingClientRect().toJSON();
const centre = (element) => {
  const { left, top, width, height } = element.getBoundingClientRect();
  return { x: left + width / 2, y: top + height / 2 };
};

// Attend que l'assertion passe, le rendu de Svelte à jour, une image après
// l'autre : les observations de taille se livrent avant la peinture.
async function attendre(assertion) {
  for (let essai = 0; ; essai += 1) {
    flushSync();
    try {
      return assertion();
    } catch (erreur) {
      if (essai >= 200) throw erreur;
      await new Promise((resoudre) => requestAnimationFrame(resoudre));
    }
  }
}

const deuxImages = async () => {
  for (let i = 0; i < 2; i += 1) await new Promise((resoudre) => requestAnimationFrame(resoudre));
  flushSync();
};

/** Clique la commande de vue nom, puis met le rendu à jour. */
function cliquer(m, nom) {
  const bouton = dans(m, `[data-commande="${nom}"]`);
  expect(bouton, nom).not.toBeNull();
  bouton.click();
  flushSync();
}

/** Choisit le tour r dans le sélecteur de la barre de vue. */
function choisirTour(m, r) {
  const select = dans(m, '[data-champ="tour"]');
  select.value = String(r);
  select.dispatchEvent(new Event('change', { bubbles: true }));
  flushSync();
}

/** Un cran de molette réel au centre du cadre, ou au point donné, et le rendu à jour. */
async function cran(m, deltaY, point = null) {
  const cadre = cadreDe(m);
  const { x, y } = point ?? { x: cadre.gauche + cadre.largeur / 2, y: cadre.haut + cadre.hauteur / 2 };
  const avant = groupe(m).getAttribute('transform');
  await molette(x, y, deltaY);
  await attendre(() => expect(groupe(m).getAttribute('transform')).not.toBe(avant));
}

/** Le texte de l'état et du journal de l'événement ouvert, et sa révision. */
function fichiers(m) {
  const { base, revision } = m.seance.etat().evenement;
  return {
    etat: m.fs.contenu('documents', `${base}${SUFFIXES.etat}`),
    journal: m.fs.contenu('documents', `${base}${SUFFIXES.journal}`),
    revision,
  };
}

/** Le cadrage de l'événement ouvert lu dans reglages_locaux.json, ou undefined. */
function cadrageEcrit(m) {
  const texte = m.fs.contenu('documents', FICHIER_REGLAGES);
  if (texte === null) return undefined;
  const { id } = m.seance.etat().charge.evenement;
  return JSON.parse(texte).cadrages.find(({ evenement }) => evenement === id);
}

/** Un montage où la petite démonstration est chargée et ouverte en lecture,
 *  sur la section du plan, la vue posée. */
async function petite(options) {
  const m = await monter(options);
  await m.facade.chargerDemonstration('petite');
  flushSync();
  expect(m.ui.etat().section).toBe('plan');
  await attendre(() => expect(groupe(m).getAttribute('transform')).not.toBeNull());
  return m;
}

// Le plus grand écart entre dessinDepuisEcran sous la vue relue et l'oracle
// du moteur de rendu, getScreenCTM().inverse() du groupe, sur une grille de
// 5 × 5 points du cadre, bords et coins compris ; en px d'écran, l'écart en
// cm multiplié par k. cadre : celui que lit dessinDepuisEcran, par défaut
// relu maintenant.
function ecartOracle(m, cadre = cadreDe(m)) {
  const lu = cadreDe(m);
  const inverse = groupe(m).getScreenCTM().inverse();
  const vue = vueLue(m);
  let ecart = 0;
  let points = 0;
  for (const fx of [0, 0.25, 0.5, 0.75, 1]) {
    for (const fy of [0, 0.25, 0.5, 0.75, 1]) {
      const x = lu.gauche + fx * lu.largeur;
      const y = lu.haut + fy * lu.hauteur;
      const oracle = new DOMPoint(x, y).matrixTransform(inverse);
      const calcule = dessinDepuisEcran(vue, cadre, x, y);
      ecart = Math.max(ecart, Math.abs(oracle.x - calcule.x), Math.abs(oracle.y - calcule.y));
      points += 1;
    }
  }
  expect(points).toBe(25);
  return ecart * vue.k;
}

// Les fautes des trois invariants du § 7.2 sur la racine du plan, dans le
// thème courant : viewBox, largeurs de bordure et de remplissage non nulles,
// transformation sur la racine ou un ancêtre jusqu'à <html>.
function fautesInvariants(m) {
  const fautes = [];
  const svg = racinePlan(m);
  if (svg.hasAttribute('viewBox')) fautes.push('viewBox');
  const style = getComputedStyle(svg);
  const largeurs = ['Top', 'Right', 'Bottom', 'Left'].flatMap((cote) => [`border${cote}Width`, `padding${cote}`]);
  expect(largeurs.length).toBe(8);
  for (const propriete of largeurs) if (style[propriete] !== '0px') fautes.push(`${propriete} ${style[propriete]}`);
  let porteurs = 0;
  for (let porteur = svg; porteur !== null; porteur = porteur.parentElement) {
    const calcule = getComputedStyle(porteur);
    for (const propriete of ['transform', 'translate', 'rotate', 'scale']) {
      if (calcule[propriete] !== 'none') fautes.push(`${porteur.tagName} ${propriete} ${calcule[propriete]}`);
    }
    if (calcule.zoom !== '1') fautes.push(`${porteur.tagName} zoom ${calcule.zoom}`);
    porteurs += 1;
  }
  expect(porteurs).toBeGreaterThan(3);
  return fautes;
}

// --- Les épreuves -----------------------------------------------------------------

describe('l’oracle du moteur de rendu (§ 7.2, § 14.10)', () => {
  test('à k_min, k_ajusté, 1,25 × k_ajusté et 10, avant et après un défilement de la page, dessinDepuisEcran égale getScreenCTM().inverse() à 1e-3 px près ; un cadre mémorisé au montage tombe', async () => {
    const m = await petite();
    // Une page plus haute que la fenêtre.
    const haut = document.createElement('div');
    haut.style.height = '2000px';
    document.body.append(haut);
    ajouts.push(haut);
    expect(document.documentElement.scrollHeight).toBeGreaterThan(innerHeight + 300);

    const releves = [];
    const relever = (visee) => {
      expect(vueLue(m).k).toBe(visee);
      window.scrollTo(0, 0);
      const memorise = cadreDe(m);
      expect(ecartOracle(m)).toBeLessThan(TOLERANCE_ORACLE_PX);
      window.scrollTo(0, 300);
      expect(window.scrollY).toBe(300);
      expect(cadreDe(m).haut).toBe(memorise.haut - 300);
      expect(ecartOracle(m)).toBeLessThan(TOLERANCE_ORACLE_PX);
      // Le cadre lu avant le défilement répond faux après lui.
      expect(ecartOracle(m, memorise)).toBeGreaterThan(299);
      window.scrollTo(0, 0);
      releves.push(visee);
    };

    cliquer(m, 'ajuster');
    const kAjusteVise = kAjusteDe(m);
    relever(kAjusteVise);
    cliquer(m, 'zoomer');
    relever(1.25 * kAjusteVise);
    for (let precedent = null; precedent !== vueLue(m).k; ) {
      precedent = vueLue(m).k;
      cliquer(m, 'dezoomer');
    }
    relever(FACTEUR_K_MIN * kAjusteVise);
    for (let precedent = null; precedent !== vueLue(m).k; ) {
      precedent = vueLue(m).k;
      cliquer(m, 'zoomer');
    }
    relever(K_MAX);
    expect(releves.length).toBe(4);
  });
});

describe('les trois invariants du <svg data-plan> (§ 7.2)', () => {
  test('pas de viewBox ; contrôle d’échec : un viewBox ajouté fait tomber l’épreuve et décale l’oracle', async () => {
    const m = await petite();
    expect(racinePlan(m).hasAttribute('viewBox')).toBe(false);
    expect(fautesInvariants(m)).toEqual([]);
    expect(ecartOracle(m)).toBeLessThan(TOLERANCE_ORACLE_PX);
    racinePlan(m).setAttribute('viewBox', '0 0 100 100');
    expect(fautesInvariants(m)).toContain('viewBox');
    expect(ecartOracle(m)).toBeGreaterThan(1);
    racinePlan(m).removeAttribute('viewBox');
  });

  test('ni bordure ni remplissage, dans les deux thèmes ; contrôle d’échec : « border: 1px solid; padding: 2px » fait tomber l’épreuve et décale l’oracle', async () => {
    const m = await petite();
    for (const theme of ['clair', 'sombre']) {
      await sousTheme(theme, async () => {
        flushSync();
        expect(fautesInvariants(m), theme).toEqual([]);
        expect(ecartOracle(m), theme).toBeLessThan(TOLERANCE_ORACLE_PX);
      });
    }
    const retirer = feuille('[data-plan] { border: 1px solid !important; padding: 2px !important; }');
    expect(fautesInvariants(m).length).toBe(8);
    expect(ecartOracle(m)).toBeGreaterThan(1);
    retirer();
  });

  test('aucune transformation de la racine à <html> ; contrôle d’échec : transform: translateZ(0) sur un conteneur', async () => {
    const m = await petite();
    expect(fautesInvariants(m)).toEqual([]);
    const retirer = feuille('[data-section="plan"] { transform: translateZ(0); }');
    expect(fautesInvariants(m).some((faute) => faute.startsWith('SECTION transform'))).toBe(true);
    retirer();
    expect(fautesInvariants(m)).toEqual([]);
  });

  test('touch-action: none au style calculé de la racine et de la surface (§ 7.3)', async () => {
    const m = await petite();
    expect(getComputedStyle(racinePlan(m)).touchAction).toBe('none');
    expect(getComputedStyle(surface(m)).touchAction).toBe('none');
  });
});

// Zoome à la molette, par « Zoom + » et par « Zoom moins » en restant au-dessus
// des seuils de rendu, sous un MutationObserver posé sur la racine ; rend
// ses relevés et la largeur de la barre d'échelle avant et après.
async function zoomsObserves(m) {
  const barre = () => dans(m, '[data-marque="echelle"]');
  const largeurAvant = barre().getBoundingClientRect().width;
  const releves = [];
  const observateur = new MutationObserver((liste) => releves.push(...liste));
  observateur.observe(racinePlan(m), { attributes: true, childList: true, subtree: true, characterData: true });
  await cran(m, -100);
  await cran(m, -100);
  cliquer(m, 'zoomer');
  cliquer(m, 'dezoomer');
  await cran(m, 100);
  await deuxImages();
  releves.push(...observateur.takeRecords());
  observateur.disconnect();
  return { releves, largeurAvant, largeurApres: barre().getBoundingClientRect().width };
}

describe('zoomer écrit un attribut sur un élément (§ 7.2)', () => {
  test('molette, « Zoom + » et « Zoom moins » : seul le transform du groupe change sous la racine, il décrit la vue tenue, et la barre d’échelle, hors du <svg>, change de longueur', async () => {
    const m = await petite();
    cliquer(m, 'ajuster');
    await deuxImages();
    // Au-dessus des seuils de rendu : chaises dessinées, listes rendues.
    const k = vueLue(m).k;
    const etat = etatPlaces(m.seance.etat().charge, { tour: 1 });
    expect(etat.tables.length).toBe(4);
    for (const table of etat.tables) expect(regimeCibles(k / 1.1, geometrieTable(table, table.capacite))).toBe('sieges');
    expect(k / 1.1).toBeGreaterThan(constante('K_LISTES'));
    expect(tous(m, '[data-liste]').length).toBe(4);
    expect(tous(m, '[data-siege]').length).toBe(12);
    const { releves, largeurAvant, largeurApres } = await zoomsObserves(m);
    expect(releves.length).toBeGreaterThan(0);
    for (const releve of releves) {
      expect([releve.type, releve.attributeName, releve.target]).toEqual(['attributes', 'transform', groupe(m)]);
    }
    expect(vueLue(m)).toEqual(m.seance.cadrage());
    expect(largeurApres).not.toBe(largeurAvant);
  });

  test('contrôle d’échec : la même échelle montée sous le <svg data-plan> fait tomber l’épreuve', async () => {
    const m = await petite();
    cliquer(m, 'ajuster');
    await deuxImages();
    // La barre, sa graduation et la mention : le bloc entier d'EchellePlan.
    const echelle = dans(m, '[data-marque="echelle"]').parentElement.parentElement;
    expect(surface(m).contains(echelle)).toBe(true);
    const etranger = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    etranger.setAttribute('width', '300');
    etranger.setAttribute('height', '80');
    racinePlan(m).append(etranger);
    etranger.append(echelle);
    const { releves } = await zoomsObserves(m);
    expect(releves.some((releve) => releve.target !== groupe(m) || releve.attributeName !== 'transform')).toBe(true);
  });
});

describe('la molette zoome sans faire défiler (§ 7.2, § 7.3)', () => {
  test('page plus haute que la fenêtre, surface défilable : des crans réels sur [data-plan] changent le transform, et ni la page ni aucun ancêtre ne défile', async () => {
    const m = await petite();
    const haut = document.createElement('div');
    haut.style.height = '2000px';
    document.body.append(haut);
    ajouts.push(haut);
    // La surface défile : une hauteur fixe, un plan de 400 px, et une cale
    // de 2 000 px sous lui. Le <svg> garde ses invariants.
    feuille(
      '[data-surface] { flex: none !important; height: 600px !important; overflow-y: auto !important; }' +
        ' [data-plan] { flex: none !important; height: 400px !important; }',
    );
    const cale = document.createElement('div');
    cale.style.cssText = 'flex: none; height: 2000px;';
    surface(m).append(cale);
    ajouts.push(cale);
    await deuxImages();
    // Chaque défileur part du milieu : un cran vers le haut comme vers le
    // bas trouverait de quoi défiler.
    window.scrollTo(0, 100);
    surface(m).scrollTop = 50;
    await deuxImages();
    expect(window.scrollY).toBe(100);
    expect(surface(m).scrollTop).toBe(50);
    expect(surface(m).scrollHeight).toBeGreaterThan(surface(m).clientHeight + 100);
    const ancetres = [];
    for (let porteur = racinePlan(m); porteur !== null; porteur = porteur.parentElement) ancetres.push(porteur);
    expect(ancetres.length).toBeGreaterThan(3);
    const defilements = () => [window.scrollX, window.scrollY, ...ancetres.flatMap((porteur) => [porteur.scrollLeft, porteur.scrollTop])];
    const avant = defilements();
    const rect = racinePlan(m).getBoundingClientRect();
    const point = { x: rect.left + rect.width / 2, y: Math.max(rect.top, surface(m).getBoundingClientRect().top, 0) + 100 };
    expect(document.elementFromPoint(point.x, point.y)?.closest('[data-plan]')).toBe(racinePlan(m));
    const transform = groupe(m).getAttribute('transform');
    let crans = 0;
    for (const deltaY of [100, -100, -100]) {
      await cran(m, deltaY, point);
      crans += 1;
    }
    expect(crans).toBe(3);
    for (let i = 0; i < 10; i += 1) await deuxImages();
    expect(groupe(m).getAttribute('transform')).not.toBe(transform);
    expect(defilements()).toEqual(avant);
  });
});

describe('le zoom sous le curseur (§ 7.2)', () => {
  test('au centre de la boîte d’une table proche du bord droit, plusieurs crans dans les deux sens : ce centre reste sous le pointeur à moins d’un pixel', async () => {
    const m = await petite();
    cliquer(m, 'ajuster');
    await deuxImages();
    const tables = tous(m, '[data-table]');
    expect(tables.length).toBe(4);
    const droite = tables.reduce((a, b) => (b.getBoundingClientRect().right > a.getBoundingClientRect().right ? b : a));
    const pointeur = centre(droite);
    const kAjusteVise = vueLue(m).k;
    let crans = 0;
    for (const deltaY of [-100, -100, -100, 100, 100, 100, 100, 100, -100]) {
      await cran(m, deltaY, pointeur);
      // Sans franchir de seuil de rendu : le régime des sièges tient.
      expect(vueLue(m).k).toBeGreaterThan(kAjusteVise / 1.5);
      expect(droite.querySelectorAll('[data-siege]').length).toBe(3);
      const lu = centre(droite);
      expect(Math.abs(lu.x - pointeur.x)).toBeLessThan(1);
      expect(Math.abs(lu.y - pointeur.y)).toBeLessThan(1);
      crans += 1;
    }
    expect(crans).toBe(9);
  });
});

describe('ajuster (§ 7.2, § 8.4)', () => {
  test('après des zooms puis « Ajuster », la boîte rendue de chaque table tient dans le cadre du <svg>', async () => {
    const m = await petite();
    cliquer(m, 'zoomer');
    cliquer(m, 'zoomer');
    await cran(m, -300, { x: cadreDe(m).gauche + 10, y: cadreDe(m).haut + 10 });
    cliquer(m, 'ajuster');
    await deuxImages();
    const cadre = racinePlan(m).getBoundingClientRect();
    const tables = tous(m, '[data-table]');
    expect(tables.length).toBe(m.seance.etat().charge.tables.length);
    expect(tables.length).toBeGreaterThan(0);
    for (const table of tables) {
      const b = table.getBoundingClientRect();
      expect(b.left).toBeGreaterThanOrEqual(cadre.left - 0.5);
      expect(b.top).toBeGreaterThanOrEqual(cadre.top - 0.5);
      expect(b.right).toBeLessThanOrEqual(cadre.right + 0.5);
      expect(b.bottom).toBeLessThanOrEqual(cadre.bottom + 0.5);
    }
    expect(vueLue(m).k).toBe(kAjusteDe(m));
  });

  test('un événement sans table : translate(L/2,H/2) scale(1), à l’ouverture et après « Ajuster »', async () => {
    const m = await monter();
    await m.seance.creer(EVENEMENT);
    flushSync();
    await attendre(() => expect(groupe(m).getAttribute('transform')).not.toBeNull());
    expect(tous(m, '[data-table]').length).toBe(0);
    const { largeur, hauteur } = cadreDe(m);
    expect(largeur).toBeGreaterThan(32);
    expect(hauteur).toBeGreaterThan(32);
    const attendu = transformDe({ k: 1, tx: largeur / 2, ty: hauteur / 2 });
    expect(groupe(m).getAttribute('transform')).toBe(attendu);
    cliquer(m, 'zoomer');
    cliquer(m, 'ajuster');
    expect(groupe(m).getAttribute('transform')).toBe(attendu);
  });
});

// Vrai quand le groupe ne porte pas de transform, ou un transform aux
// nombres finis.
const transformFiniOuAbsent = (m) => {
  const texte = groupe(m).getAttribute('transform');
  if (texte === null) return true;
  const { k, tx, ty } = vueDepuisTransform(texte);
  return [k, tx, ty].every(Number.isFinite);
};

describe('monté caché, cadre trop petit (§ 7.2, point d’attention 1)', () => {
  test('surface en display: none → aucun transform non fini ; montrée → vueInitiale dans le cadre rendu ; 683 × 700 → vueApresCadre', async () => {
    const montrer = feuille('[data-surface] { display: none !important; }');
    const m = await monter();
    await m.facade.chargerDemonstration('petite');
    flushSync();
    await deuxImages();
    expect(cadreDe(m).largeur).toBe(0);
    expect(groupe(m).getAttribute('transform')).toBeNull();
    expect(transformFiniOuAbsent(m)).toBe(true);
    montrer();
    await attendre(() => expect(groupe(m).getAttribute('transform')).not.toBeNull());
    expect(groupe(m).getAttribute('transform')).toBe(transformDe(vueInitiale(m.seance.cadrage(), englobantDe(m), cadreDe(m))));
    const avant = vueLue(m);
    const largeurAvant = cadreDe(m).largeur;
    await fixerCadre(683, 700);
    await attendre(() => expect(cadreDe(m).largeur).not.toBe(largeurAvant));
    await deuxImages();
    expect(groupe(m).getAttribute('transform')).toBe(transformDe(vueApresCadre(avant, englobantDe(m), cadreDe(m))));
  });

  test('dézoomé à k_min à 683 × 700, puis élargi à 1 366 × 700 → vueApresCadre relève k au k_min du nouveau cadre', async () => {
    // Un cadre qui rétrécit abaisse k_min et laisse la vue telle quelle ; un
    // cadre qui s'élargit relève k_min au-dessus d'une vue dézoomée à fond :
    // seul ce sens distingue vueApresCadre d'une vue gardée inchangée.
    await fixerCadre(683, 700);
    const m = await petite();
    for (let precedent = null; precedent !== vueLue(m).k; ) {
      precedent = vueLue(m).k;
      cliquer(m, 'dezoomer');
    }
    const auPlusBas = vueLue(m);
    expect(auPlusBas.k).toBe(FACTEUR_K_MIN * kAjusteDe(m));
    const largeurPetite = cadreDe(m).largeur;
    await fixerCadre(1366, 700);
    await attendre(() => expect(cadreDe(m).largeur).toBeGreaterThan(largeurPetite));
    // La vue se recalcule à l'image qui suit l'observation de taille.
    const attendu = () => transformDe(vueApresCadre(auPlusBas, englobantDe(m), cadreDe(m)));
    await attendre(() => expect(groupe(m).getAttribute('transform')).toBe(attendu()));
    expect(attendu()).not.toBe(transformDe(auPlusBas));
    expect(vueLue(m).k).toBe(FACTEUR_K_MIN * kAjusteDe(m));
    expect(vueLue(m).k).toBeGreaterThan(auPlusBas.k);
  });

  test('une surface de 20 × 20 px, au montage puis après un premier rendu : aucun transform non fini, rien au collecteur', async () => {
    const css = '[data-surface] { flex: none !important; width: 20px !important; height: 20px !important; }';
    let retirer = feuille(css);
    const m = await monter();
    await m.facade.chargerDemonstration('petite');
    flushSync();
    await deuxImages();
    expect(cadreDe(m).largeur).toBeLessThanOrEqual(20);
    expect(groupe(m).getAttribute('transform')).toBeNull();
    retirer();
    await attendre(() => expect(groupe(m).getAttribute('transform')).not.toBeNull());
    const posee = groupe(m).getAttribute('transform');
    retirer = feuille(css);
    await deuxImages();
    expect(cadreDe(m).largeur).toBeLessThanOrEqual(20);
    expect(transformFiniOuAbsent(m)).toBe(true);
    expect(groupe(m).getAttribute('transform')).toBe(posee);
    retirer();
    await deuxImages();
    expect(transformFiniOuAbsent(m)).toBe(true);
    expect(m.erreurs()).toEqual([]);
  });
});

describe('le cadrage (§ 8.5, § 13.3)', () => {
  test('des zooms rapprochés n’écrivent ni l’état ni le journal ; une seule écriture des réglages après DELAI_REGLAGES_MS, qui porte la vue rendue ; en lecture, puis sur un plan bloqué', async () => {
    const m = await petite();
    const verifier = async (gestes) => {
      const avant = fichiers(m);
      const ecritures = m.fs.compteurs.ecritures;
      await gestes();
      await deuxImages();
      expect(fichiers(m)).toEqual(avant);
      expect(m.fs.compteurs.ecritures).toBe(ecritures);
      m.horloge.avancer(DELAI_REGLAGES_MS - 1);
      await deuxImages();
      expect(m.fs.compteurs.ecritures).toBe(ecritures);
      m.horloge.avancer(1);
      await attendre(() => expect(m.fs.compteurs.ecritures).toBe(ecritures + 1));
      await deuxImages();
      expect(m.fs.compteurs.ecritures).toBe(ecritures + 1);
      expect(fichiers(m)).toEqual(avant);
      const ecrit = cadrageEcrit(m);
      const lue = vueLue(m);
      expect({ k: ecrit.k, tx: ecrit.tx, ty: ecrit.ty }).toEqual(lue);
    };
    expect(m.seance.etat().mode).toBe('lecture');
    await verifier(async () => {
      await cran(m, -100);
      await cran(m, -100);
      cliquer(m, 'zoomer');
      cliquer(m, 'dezoomer');
      cliquer(m, 'ajuster');
      await cran(m, 100);
    });
    await m.seance.passerEnEcriture();
    await m.seance.executer('changerEtat', { etat: 'bloque' });
    flushSync();
    expect(m.seance.etat().evenement.etat).toBe('bloque');
    expect(m.seance.etat().mode).toBe('lecture');
    await verifier(async () => {
      for (let i = 0; i < 20; i += 1) await cran(m, i % 3 === 0 ? 100 : -100);
      cliquer(m, 'zoomer');
      cliquer(m, 'ajuster');
      cliquer(m, 'dezoomer');
    });
    // Une suite qui finit par « Ajuster » : la vue ajustée est celle qui
    // s'écrit, et non celle du zoom qui la précède.
    await verifier(async () => {
      await cran(m, -100);
      cliquer(m, 'zoomer');
      cliquer(m, 'ajuster');
    });
    expect(groupe(m).getAttribute('transform')).toBe(transformDe(ajuster(englobantDe(m), cadreDe(m))));
  });

  test('démonté puis remonté sur le même disque : le même transform ; « Défaire » ne le change pas', async () => {
    const premier = await petite();
    const base = premier.seance.etat().evenement.base;
    await premier.seance.passerEnEcriture();
    await cran(premier, -100);
    cliquer(premier, 'zoomer');
    // Un geste écrit, puis défait, ne touche pas à la vue.
    const transform = groupe(premier).getAttribute('transform');
    await premier.seance.executer('creerTable', { forme: 'ronde' });
    flushSync();
    expect(groupe(premier).getAttribute('transform')).toBe(transform);
    await premier.seance.defaire();
    flushSync();
    expect(premier.seance.etat().charge.tables.length).toBe(4);
    expect(groupe(premier).getAttribute('transform')).toBe(transform);
    premier.horloge.avancer(DELAI_REGLAGES_MS);
    await attendre(() => expect(cadrageEcrit(premier)).toEqual({ evenement: premier.seance.etat().charge.evenement.id, ...vueLue(premier) }));
    await premier.seance.passerEnLecture();
    demonter(premier);

    const second = await monter({ systeme: { disque: premier.disque }, horloge: premier.horloge });
    await second.seance.ouvrir(base);
    flushSync();
    await attendre(() => expect(groupe(second).getAttribute('transform')).toBe(transform));
    await second.seance.passerEnEcriture();
    await second.seance.executer('creerTable', { forme: 'ronde' });
    await second.seance.defaire();
    flushSync();
    expect(groupe(second).getAttribute('transform')).toBe(transform);
  });

  test('un cadrage restitué dans un cadre plus petit reste dans ses bornes, tel que vueInitiale le borne ; dans un cadre plus grand, k_min le relève', async () => {
    const premier = await petite();
    const base = premier.seance.etat().evenement.base;
    for (let precedent = null; precedent !== vueLue(premier).k; ) {
      precedent = vueLue(premier).k;
      cliquer(premier, 'dezoomer');
    }
    const memorise = vueLue(premier);
    expect(memorise.k).toBe(FACTEUR_K_MIN * kAjusteDe(premier));
    premier.horloge.avancer(DELAI_REGLAGES_MS);
    await attendre(() => expect(cadrageEcrit(premier)?.k).toBe(memorise.k));
    demonter(premier);

    await fixerCadre(683, 700);
    const petitCadre = await monter({ systeme: { disque: premier.disque }, horloge: premier.horloge });
    await petitCadre.seance.ouvrir(base);
    flushSync();
    await attendre(() => expect(groupe(petitCadre).getAttribute('transform')).not.toBeNull());
    const cadrePetit = cadreDe(petitCadre);
    expect(groupe(petitCadre).getAttribute('transform')).toBe(transformDe(vueInitiale(memorise, englobantDe(petitCadre), cadrePetit)));
    const { kMin, kMax } = bornesZoom(kAjuste(englobantDe(petitCadre), cadrePetit));
    expect(vueLue(petitCadre).k).toBeGreaterThanOrEqual(kMin);
    expect(vueLue(petitCadre).k).toBeLessThanOrEqual(kMax);
    // Dans ce cadre, k_min descend : le dézoom va plus loin, et se mémorise.
    for (let precedent = null; precedent !== vueLue(petitCadre).k; ) {
      precedent = vueLue(petitCadre).k;
      cliquer(petitCadre, 'dezoomer');
    }
    const auPlusBas = vueLue(petitCadre).k;
    expect(auPlusBas).toBeLessThan(memorise.k);
    petitCadre.horloge.avancer(DELAI_REGLAGES_MS);
    await attendre(() => expect(cadrageEcrit(petitCadre)?.k).toBe(auPlusBas));
    demonter(petitCadre);

    await fixerCadre(1366, 700);
    const grand = await monter({ systeme: { disque: premier.disque }, horloge: premier.horloge });
    await grand.seance.ouvrir(base);
    flushSync();
    await attendre(() => expect(groupe(grand).getAttribute('transform')).not.toBeNull());
    expect(vueLue(grand).k).toBe(FACTEUR_K_MIN * kAjusteDe(grand));
    expect(vueLue(grand).k).toBeGreaterThan(auPlusBas);
  });

  test('ouvrir, attendre DELAI_REGLAGES_MS sans geste, changer de cadre, attendre encore : aucune écriture', async () => {
    const m = await petite();
    const ecritures = m.fs.compteurs.ecritures;
    m.horloge.avancer(DELAI_REGLAGES_MS);
    await deuxImages();
    const largeur = cadreDe(m).largeur;
    await fixerCadre(683, 700);
    await attendre(() => expect(cadreDe(m).largeur).not.toBe(largeur));
    await deuxImages();
    m.horloge.avancer(DELAI_REGLAGES_MS);
    await deuxImages();
    expect(m.fs.compteurs.ecritures).toBe(ecritures);
    expect(m.fs.contenu('documents', FICHIER_REGLAGES) === null || cadrageEcrit(m) === undefined).toBe(true);
  });
});

// La signature de ce que le plan montre : le texte des listes, puis les
// marques de chaque chaise, puis les pastilles.
function montre(m) {
  return {
    listes: tous(m, '[data-liste]').map((liste) => liste.textContent),
    marques: tous(m, '[data-siege]').map((chaise) => [
      chaise.getAttribute('data-siege'),
      [...chaise.querySelectorAll('[data-marque]')].map((marque) => marque.getAttribute('data-marque')),
    ]),
    pastilles: tous(m, '[data-pastille]').map((pastille) => pastille.textContent),
  };
}

describe('les commandes de vue n’écrivent rien et restent vivantes (§ 8.2, § 8.4)', () => {
  test('écriture, lecture, plan bloqué : tour, zooms, ajuster, mise en évidence, listes, plein écran n’écrivent rien ; le tour change listes et marques', async () => {
    const m = await petite();
    await m.seance.passerEnEcriture();
    const charge = m.seance.etat().charge;
    const personne = charge.participants[0].id;
    // Une réservation du seul tour 1 : une marque et une ligne qui ne
    // paraissent qu'à ce tour.
    await m.seance.executer('reserver', { participant: personne, table: 1, siege: 1, portee: 'tour', tour: 1 });
    flushSync();
    cliquer(m, 'ajuster');
    await deuxImages();

    const parcourir = async (nom) => {
      const avant = fichiers(m);
      const transform = groupe(m).getAttribute('transform');
      choisirTour(m, 1);
      await deuxImages();
      const tour1 = montre(m);
      expect(tour1.listes.length, nom).toBe(4);
      expect(tour1.marques.length, nom).toBe(12);
      choisirTour(m, 2);
      await deuxImages();
      expect(m.ui.etat().tour, nom).toBe(2);
      const tour2 = montre(m);
      expect(tour2.listes, nom).not.toEqual(tour1.listes);
      expect(tour2.marques, nom).not.toEqual(tour1.marques);
      choisirTour(m, 1);
      cliquer(m, 'zoomer');
      expect(groupe(m).getAttribute('transform'), nom).not.toBe(transform);
      cliquer(m, 'ajuster');
      m.ui.mettreEnEvidence(personne);
      flushSync();
      await deuxImages();
      expect(tous(m, '[data-marque="miseEnEvidence"]').length, nom).toBe(1);
      m.ui.mettreEnEvidence(null);
      cliquer(m, 'listes');
      await deuxImages();
      expect(dans(m, '[data-commande="listes"]').getAttribute('aria-pressed'), nom).toBe('false');
      expect(tous(m, '[data-liste]').length, nom).toBe(0);
      expect(tous(m, '[data-liste] tspan').length, nom).toBe(0);
      cliquer(m, 'listes');
      await deuxImages();
      expect(tous(m, '[data-liste]').length, nom).toBe(4);
      cliquer(m, 'pleinEcran');
      await deuxImages();
      expect(m.ui.etat().pleinEcran, nom).toBe(true);
      cliquer(m, 'pleinEcran');
      await deuxImages();
      expect(fichiers(m), nom).toEqual(avant);
      expect(m.seance.etat().refus === null, nom).toBe(nom === 'écriture');
    };

    await parcourir('écriture');
    await m.seance.passerEnLecture();
    flushSync();
    await parcourir('lecture');
    await m.seance.passerEnEcriture();
    await m.seance.executer('changerEtat', { etat: 'bloque' });
    flushSync();
    expect(m.seance.etat().evenement.etat).toBe('bloque');
    await parcourir('bloqué');
  });
});

describe('le plein écran (§ 8.4, § 18.6)', () => {
  test('la surface s’agrandit ; le cadre de mode, son libellé et le bandeau restent visibles ; ressorti, la surface retrouve sa boîte', async () => {
    const m = await petite();
    await deuxImages();
    const avant = boite(surface(m));
    cliquer(m, 'pleinEcran');
    await deuxImages();
    const plein = boite(surface(m));
    expect(plein.width * plein.height).toBeGreaterThan(avant.width * avant.height);
    expect(plein.height).toBeGreaterThan(avant.height);
    expect(plein.width).toBeGreaterThan(avant.width);
    const temoins = [dans(m, '[data-mode]'), dans(m, '[data-mode-libelle="cadre"]'), dans(m, '[data-mode-libelle="bandeau"]'), dans(m, '[data-bandeau]')];
    for (const temoin of temoins) {
      expect(temoin).not.toBeNull();
      expect(visible(temoin)).toBe(true);
    }
    const cadre = dans(m, '[data-mode]').getBoundingClientRect();
    expect(cadre.left).toBeLessThanOrEqual(plein.left);
    expect(cadre.right).toBeGreaterThanOrEqual(plein.right);
    expect(cadre.bottom).toBeGreaterThanOrEqual(plein.bottom);
    expect(dans(m, '[data-commande="pleinEcran"]').getAttribute('aria-pressed')).toBe('true');
    cliquer(m, 'pleinEcran');
    await deuxImages();
    expect(boite(surface(m))).toEqual(avant);
  });

  test('le cadre de mode garde sa boîte après un zoom', async () => {
    const m = await petite();
    await deuxImages();
    const avant = boite(dans(m, '[data-mode]'));
    await cran(m, -100);
    cliquer(m, 'zoomer');
    cliquer(m, 'ajuster');
    await deuxImages();
    expect(boite(dans(m, '[data-mode]'))).toEqual(avant);
  });
});

describe('le panneau du diagnostic (§ 2.1, étape 8)', () => {
  test('un événement ouvert : [data-panneau-diagnostic] visible dans la section du plan, sans aucun clic', async () => {
    const m = await petite();
    await deuxImages();
    const section = dans(m, '[data-section="plan"]');
    const panneau = dans(m, '[data-panneau-diagnostic]');
    expect(panneau).not.toBeNull();
    expect(section.contains(panneau)).toBe(true);
    expect(visible(panneau)).toBe(true);
  });
});
