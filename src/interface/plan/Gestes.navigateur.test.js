// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les gestes du pointeur sur le plan, dans un vrai moteur de rendu (§ 5.8,
// § 5.9, § 6.1, § 6.2, § 7.1, § 7.2, § 7.3, § 8.4, § 8.5, § 9) : la capture
// sur la racine, le modèle confié au relâcher, aucune lecture de mise en page
// pendant un glissement, un seul écouteur, le déplacement de vue, le dépôt
// par la géométrie, les annulations, les gestes d'une personne sous les deux
// états des données, la table glissée, sur le plan écarté aussi, la poignée
// et ses refus, la lecture, l'inactivité, le dépôt refusé sur une table
// pleine.
//
// Chaque épreuve monte App par monterApp, sur le système de fichiers simulé
// où un fichier d'état d'épreuve est posé puis ouvert, au cadre de
// 1 366 × 700, et agit par des entrées réelles (test/navigateur/entrees.js) ;
// elle lit le rendu — attributs data-…, transform, boîte, texte — et le
// disque simulé : « une entrée » est une entrée du journal relu de révision
// supérieure à celle de l'état avant le geste, l'en-tête de l'état relu
// portant cette révision plus un. Les points visés se calculent par la
// géométrie des tables et la vue relue de l'attribut, sollicitées une
// seconde fois (§ 19.1). Les noms d'épreuve sont inventés.
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { flushSync } from 'svelte';
import { appliquerCommande } from '../../application/commandes.js';
import { etatPlaces } from '../../application/places.js';
import { DELAI_REGLAGES_MS, INACTIVITE_MS } from '../../application/seance.js';
import { constante } from '../../geometrie/constantes.js';
import { surLeSol } from '../../geometrie/designation.js';
import { diametre, englobant, geometrieTable } from '../../geometrie/tables.js';
import { ajuster, dessinDepuisEcran, ecranDepuisDessin, kAjuste, transformDe, vueDepuisTransform } from '../../geometrie/vue.js';
import { serialiser, serialiserCharge } from '../../stockage/canonique.js';
import { analyser, creerCharge } from '../../stockage/document.js';
import { lireJournal } from '../../stockage/journal.js';
import { SUFFIXES } from '../../stockage/noms.js';
import { VERSION } from '../../version.genere.js';
import TEXTE_HUIT from '../../../test/fixtures/plan/huit_tables_retenu.gtt.json?raw';
import { releverMarques } from '../../../test/navigateur/captures.js';
import { fixerCadre, glisser, molette, pointer, touche } from '../../../test/navigateur/entrees.js';
import { monterApp } from '../../../test/navigateur/montage.js';
import { sousTheme } from '../../../test/navigateur/rendu.js';
import { cadreDepuisRect, englobantDuTour } from './vue_plan.js';

const BASE = 'soiree';
const SEUIL = constante('SEUIL_GLISSER_PX');

// --- Les configurations d'épreuve ---------------------------------------------

const NOMS = [
  ['Ombrelle', 'Iris'], ['Pervenche', 'Théo'], ['Lacasse', 'Ondine'], ['Grisaille', null],
  ['Tourmaline', 'Basile'], ['Arrosoir', 'Capucine'], ['Cerfeuil', 'Aurèle'], ['Bruyère', 'Mélisande'],
  ['Galet', 'Firmin'], ['Mistral', 'Clélia'], ['Houblon', 'Anatole'], ['Sarcelle', 'Solveig'],
  ['Ravenelle', 'Octave'], ['Pimprenelle', 'Albane'], ['Coquelicot', 'Gaspard'], ['Lavandière', 'Ysaline'],
  ['Châtaigne', 'Bérénice'], ['Murier', 'Lazare'],
];

// La charge du fichier d'épreuve : huit rondes de trois, vingt personnes,
// trois tours, la proposition 1 retenue ; Iris Ombrelle (1) à la table 4
// au tour 2, la table 7 assied 19 et 20 à ce tour.
const huitRetenue = () => analyser(TEXTE_HUIT).charge;

// La même, avant la retenue : la proposition 1 seule, le plan proposé.
function huitAvantRetenue() {
  const charge = huitRetenue();
  charge.retenu = null;
  charge.evenement.etat = 'propose';
  return charge;
}

const executer = (charge, nom, args) => appliquerCommande(nom, charge, args).charge;

/**
 * Une charge d'épreuve : des rondes posées sur une ligne, aux places données
 * — null suit le défaut —, les personnes de NOMS, et, quand tours est donné,
 * une proposition à sièges non attribués de ces listes, retenue si retenir.
 */
function chargeDe({ id, defaut = 8, places, ecart = 300, personnes, nombreTours = 3, tours = null, retenir = true, attribuer = false }) {
  const charge = creerCharge({ id, nom: 'Club des Merles', siegesParDefaut: defaut, tours: nombreTours });
  charge.reglages.attribuerSieges = attribuer;
  charge.participants = NOMS.slice(0, personnes).map(([nom, prenom], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    organisation: null,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  charge.tables = places.map((sieges, rang) => ({ id: rang + 1, numero: rang + 1, sieges, forme: 'ronde', position: { x: ecart * rang, y: 0 } }));
  charge.prochainsIds = { participant: personnes + 1, table: places.length + 1, proposition: 1 };
  if (tours === null) return charge;
  charge.propositions = [
    {
      id: 1,
      graine: 1,
      arret: 40,
      historique: 1000,
      produitVersion: 'epreuve',
      siegesAttribues: false,
      tables: charge.tables.map((table) => table.id),
      capacites: places.map((sieges) => sieges ?? defaut),
      tours: nombreTours,
      participants: charge.participants.map((personne) => personne.id),
      placement: tours.map((listes) => ({ sieges: listes, reserve: [] })),
    },
  ];
  charge.prochainsIds.proposition = 2;
  charge.evenement.etat = 'propose';
  return retenir ? executer(charge, 'retenirProposition', { id: 1 }) : charge;
}

const suite = (de, a) => Array.from({ length: a - de + 1 }, (_, i) => de + i);

// Trois tables de huit, dix-huit personnes, retenu : la table 3 assied
// sept personnes au seul tour 3, six aux deux autres ; la table 1, six,
// six, puis cinq.
const troisDeHuit = () =>
  chargeDe({
    id: 'evt-trois-de-huit',
    places: [null, null, null],
    personnes: 18,
    tours: [
      [suite(1, 6), suite(7, 12), suite(13, 18)],
      [suite(13, 18), suite(1, 6), suite(7, 12)],
      [suite(1, 5), suite(6, 11), suite(12, 18)],
    ],
  });

// --- Le montage ---------------------------------------------------------------

let montes = [];
let nettoyages = [];
let erreursDemontees = [];
beforeEach(async () => {
  await fixerCadre(1366, 700);
});
afterEach(async () => {
  for (const nettoyer of nettoyages.reverse()) nettoyer();
  nettoyages = [];
  const erreurs = [...erreursDemontees, ...montes.flatMap((m) => m.erreurs())];
  erreursDemontees = [];
  for (const m of montes.reverse()) m.demonter();
  montes = [];
  window.scrollTo(0, 0);
  await fixerCadre(1366, 700);
  expect(erreurs, 'erreurs reçues par le collecteur').toEqual([]);
});

// Démonte un montage avant la fin de l'épreuve, et relève son collecteur :
// le montage suivant prend sa place dans la fenêtre.
function demonter(m) {
  erreursDemontees.push(...m.erreurs());
  m.demonter();
  montes = montes.filter((autre) => autre !== m);
}

// Attend que l'assertion passe, le rendu de Svelte à jour, une image après
// l'autre.
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

const uneImage = () => new Promise((resoudre) => requestAnimationFrame(resoudre));
async function images(n = 3) {
  for (let i = 0; i < n; i += 1) await uneImage();
  flushSync();
}

// La charge posée en fichier d'état, ouverte — en écriture sauf mode
// 'lecture' —, la section du plan ouverte et sa vue posée.
async function ouvrir(charge, { mode = 'ecriture', horloge } = {}) {
  const texte = serialiser(charge, { revision: 1, produitVersion: VERSION.affichee });
  const m = await monterApp({ fichiers: [{ racine: 'documents', chemin: `${BASE}/${BASE}${SUFFIXES.etat}`, texte }], horloge });
  montes.push(m);
  await m.seance.ouvrir(`${BASE}/${BASE}`);
  if (mode === 'ecriture') await m.seance.passerEnEcriture();
  m.ui.allerA('plan');
  flushSync();
  await attendre(() => expect(groupe(m).getAttribute('transform')).not.toBeNull());
  await attendre(() => expect(tous(m, '[data-table]').length).toBe(charge.tables.length));
  return m;
}

// Pose la vue par le cadrage de la séance, puis remonte le plan, qui la
// restitue.
async function avecVue(m, vue) {
  m.seance.demanderCadrage(vue);
  m.ui.allerA('tables');
  flushSync();
  m.ui.allerA('plan');
  flushSync();
  await attendre(() => expect(groupe(m).getAttribute('transform')).toBe(transformDe(vue)));
  await images(2);
}

// --- Les lectures du rendu et du disque ---------------------------------------

const dans = (m, selecteur) => m.racine.querySelector(selecteur);
const tous = (m, selecteur) => [...m.racine.querySelectorAll(selecteur)];
const racinePlan = (m) => dans(m, '[data-plan]');
const groupe = (m) => dans(m, '[data-vue]');
const tableEl = (m, id) => dans(m, `[data-table="${id}"]`);
const fantomeEl = (m) => dans(m, '[data-fantome]');
// Le fantôme se montre : son style calculé n'est pas display: none, et il
// porte son dessin. checkVisibility ne sert pas ici : Chromium le rend vrai
// pour un <g> SVG en display: none.
const fantomeMontre = (m) => getComputedStyle(fantomeEl(m)).display !== 'none' && fantomeEl(m).childElementCount > 0;
const cadreDe = (m) => cadreDepuisRect(racinePlan(m).getBoundingClientRect());
const vueLue = (m) => vueDepuisTransform(groupe(m).getAttribute('transform'));
const charge = (m) => m.seance.etat().charge;
const texteDe = (element) => element.textContent.replace(/\s+/g, ' ').trim();
const chaisesDe = (m, id) => tous(m, `[data-siege^="${id}:"]`);

// L'état des places du tour montré, tel que le plan le calcule.
const etatMontre = (m) => etatPlaces(charge(m), { tour: m.ui.etat().tour, proposition: m.ui.etat().proposition });

// La géométrie d'une table du tour montré, à sa capacité.
function geometrieDe(m, id) {
  const table = etatMontre(m).tables.find((candidate) => candidate.id === id);
  return geometrieTable(table, table.capacite);
}

// Le point écran d'un point de dessin, sous la vue relue.
const ecranDe = (m, { x, y }) => ecranDepuisDessin(vueLue(m), cadreDe(m), x, y);
const pointTable = (m, id) => ecranDe(m, geometrieDe(m, id).centre);
const pointChaise = (m, id, siege) => ecranDe(m, geometrieDe(m, id).chaises[siege - 1]);
const pointPoignee = (m, id) => ecranDe(m, geometrieDe(m, id).poignee);

// Un point du sol : près du coin haut gauche du cadre, hors de toute emprise.
function pointSol(m) {
  const cadre = cadreDe(m);
  const point = { x: cadre.gauche + 6, y: cadre.haut + 6 };
  const geometries = etatMontre(m).tables.map((table) => geometrieTable(table, table.capacite));
  expect(surLeSol(dessinDepuisEcran(vueLue(m), cadre, point.x, point.y), geometries)).toBe(true);
  expect(document.elementFromPoint(point.x, point.y)).toBe(racinePlan(m));
  return point;
}

// Un point à (dx, dy) d'un autre.
const decale = ({ x, y }, dx, dy) => ({ x: x + dx, y: y + dy });

// Le texte de l'état et du journal de l'événement ouvert, et sa révision.
function fichiers(m) {
  return {
    etat: m.fs.contenu('documents', `${BASE}/${BASE}${SUFFIXES.etat}`),
    journal: m.fs.contenu('documents', `${BASE}/${BASE}${SUFFIXES.journal}`),
    revision: m.seance.etat().evenement.revision,
  };
}

// Les entrées du journal relu de révision supérieure à r.
function entreesApres(m, r) {
  const texte = m.fs.contenu('documents', `${BASE}/${BASE}${SUFFIXES.journal}`);
  return texte === null ? [] : lireJournal(texte).entrees.filter((entree) => entree.revision > r);
}

// Attend exactement une entrée après la révision r, l'en-tête de l'état relu
// à r + 1 ; rend son libellé.
async function uneEntree(m, r) {
  await attendre(() => expect(m.seance.etat().evenement.revision).toBe(r + 1));
  const entrees = entreesApres(m, r);
  expect(entrees).toHaveLength(1);
  expect(analyser(m.fs.contenu('documents', `${BASE}/${BASE}${SUFFIXES.etat}`)).entete.revision).toBe(r + 1);
  return entrees[0].libelle;
}

// Rien n'a été écrit depuis avant : l'état, le journal et la révision.
async function rienEcrit(m, avant) {
  await images(4);
  expect(fichiers(m)).toEqual(avant);
}

// Les refus posés sur le plan, et celui que désigne aria-describedby d'un élément.
const decrit = (element) => {
  const id = element.getAttribute('aria-describedby');
  return id === null ? null : document.getElementById(id);
};

// Les boîtes de deux éléments se recoupent.
function recoupe(a, b) {
  const p = a.getBoundingClientRect();
  const q = b.getBoundingClientRect();
  return p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom;
}

// Le pointerId du prochain appui sur la racine du plan.
function pointeurDuProchainAppui(m) {
  const lu = { id: null };
  racinePlan(m).addEventListener('pointerdown', (evenement) => {
    lu.id = evenement.pointerId;
  }, { once: true });
  return lu;
}

// Glisse par pas, une image entre deux pas, sans relâcher.
async function presserEtBouger(depuis, vers, { pas = 6 } = {}) {
  await pointer('presser', depuis.x, depuis.y);
  for (let i = 1; i <= pas; i += 1) {
    const t = i / pas;
    await pointer('bouger', depuis.x + (vers.x - depuis.x) * t, depuis.y + (vers.y - depuis.y) * t);
    await uneImage();
  }
  flushSync();
}

// Espionne les appels d'une méthode d'un prototype ; rend le compteur.
function espionner(prototype, methode) {
  const originale = prototype[methode];
  const compte = { appels: 0 };
  prototype[methode] = function espion(...parametres) {
    compte.appels += 1;
    return Reflect.apply(originale, this, parametres);
  };
  nettoyages.push(() => {
    prototype[methode] = originale;
  });
  return compte;
}

// Relève les commandes que le plan confie à la séance.
function releverCommandes(m) {
  const seance = m.seance;
  const originale = seance.executer;
  const appels = [];
  seance.executer = (nom, args) => {
    appels.push({ nom, args });
    return originale(nom, args);
  };
  nettoyages.push(() => {
    seance.executer = originale;
  });
  return appels;
}

// --- La capture et le modèle au relâcher (§ 7.3, § 8.2) ---------------------

describe('la capture du pointeur et le modèle au relâcher (§ 7.3, § 8.2)', () => {
  test('après un appui sur une table, la racine capture le pointeur, la table non ; un mouvement hors de la fenêtre et un relâcher dehors terminent le glissement', async () => {
    const m = await ouvrir(huitRetenue());
    const pointeur = pointeurDuProchainAppui(m);
    const depart = pointTable(m, 1);
    await pointer('presser', depart.x, depart.y);
    expect(pointeur.id).not.toBeNull();
    expect(racinePlan(m).hasPointerCapture(pointeur.id)).toBe(true);
    expect(tableEl(m, 1).hasPointerCapture(pointeur.id)).toBe(false);
    const r = fichiers(m).revision;
    await pointer('bouger', depart.x + 30, depart.y + 10);
    await pointer('bouger', innerWidth + 300, innerHeight + 300);
    await pointer('relacher', innerWidth + 300, innerHeight + 300);
    await uneEntree(m, r);
    await attendre(() => expect(tableEl(m, 1).getAttribute('transform')).toBeNull());
    expect(racinePlan(m).hasPointerCapture(pointeur.id)).toBe(false);
    const position = { ...charge(m).tables[0].position };
    await pointer('bouger', depart.x + 80, depart.y + 80);
    await images(3);
    expect(tableEl(m, 1).getAttribute('transform')).toBeNull();
    expect(charge(m).tables[0].position).toEqual(position);
  });

  test('pendant le glissement d’une table, ni la charge, ni la révision, ni le disque ne bougent ; le transform change ; racine et table restent les mêmes nœuds ; au relâcher, une entrée « Déplacé la table … »', async () => {
    const m = await ouvrir(huitRetenue());
    const racine = racinePlan(m);
    const table = tableEl(m, 3);
    const avant = fichiers(m);
    const texteCharge = serialiserCharge(charge(m));
    const ecritures = m.fs.compteurs.ecritures;
    const depart = pointTable(m, 3);
    await presserEtBouger(depart, decale(depart, 50, 30));
    expect(table.getAttribute('transform')).not.toBeNull();
    expect(serialiserCharge(charge(m))).toBe(texteCharge);
    expect(fichiers(m)).toEqual(avant);
    expect(m.fs.compteurs.ecritures).toBe(ecritures);
    expect(racinePlan(m)).toBe(racine);
    expect(tableEl(m, 3)).toBe(table);
    await pointer('relacher', depart.x + 50, depart.y + 30);
    expect(await uneEntree(m, avant.revision)).toBe('Déplacé la table 3');
    await attendre(() => expect(table.getAttribute('transform')).toBeNull());
    expect(tableEl(m, 3)).toBe(table);
    expect(racinePlan(m)).toBe(racine);
  });
});

// --- Aucune lecture de mise en page, un écouteur (§ 7.2, § 7.3) --------------

describe('aucune lecture de mise en page pendant un glissement ; un seul écouteur (§ 7.2, § 7.3)', () => {
  test('glissement réel d’une table, puis de la vue, dix mouvements chacun : aucun getBBox, getScreenCTM, getBoundingClientRect', async () => {
    const m = await ouvrir(huitRetenue());
    for (const [nom, depart] of [['table', pointTable(m, 2)], ['vue', pointSol(m)]]) {
      const transformAvant = (nom === 'table' ? tableEl(m, 2) : groupe(m)).getAttribute('transform');
      await pointer('presser', depart.x, depart.y);
      // Les espions se posent après l'appui, qui relit le cadre, et avant le
      // premier mouvement : celui qui franchit le seuil et fait de l'appui un
      // glissement est relevé comme les suivants.
      const espions = [
        espionner(SVGGraphicsElement.prototype, 'getBBox'),
        espionner(SVGGraphicsElement.prototype, 'getScreenCTM'),
        espionner(Element.prototype, 'getBoundingClientRect'),
      ];
      await pointer('bouger', depart.x + 8, depart.y + 4);
      await uneImage();
      for (let i = 1; i <= 10; i += 1) {
        await pointer('bouger', depart.x + 8 + 3 * i, depart.y + 4 + 2 * i);
        await uneImage();
      }
      const transformApres = (nom === 'table' ? tableEl(m, 2) : groupe(m)).getAttribute('transform');
      const appels = espions.map(({ appels }) => appels);
      for (const nettoyer of nettoyages.splice(0).reverse()) nettoyer();
      expect(appels, nom).toEqual([0, 0, 0]);
      expect(transformApres, nom).not.toBe(transformAvant);
      await pointer('relacher', depart.x + 38, depart.y + 24);
      await images(3);
    }
  });

  test('l’espion d’addEventListener : sur les tables et les chaises, aucun écouteur de pointeur ni de molette ; sur la racine, les cinq, la molette non passive ; dix pointermove d’une même tâche n’écrivent qu’une fois le transform', async () => {
    const releves = [];
    const originale = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function espion(type, ecouteur, options) {
      releves.push({ cible: this, type, options });
      return Reflect.apply(originale, this, [type, ecouteur, options]);
    };
    nettoyages.push(() => {
      EventTarget.prototype.addEventListener = originale;
    });
    const m = await ouvrir(huitRetenue());
    const capacites = charge(m).tables.length * 3;
    const elements = [...tous(m, '[data-table]'), ...tous(m, '[data-siege]')];
    expect(elements.length).toBe(charge(m).tables.length + capacites);
    expect(elements.length).toBeGreaterThan(0);
    const DU_POINTEUR = /^(pointer|wheel)/;
    const surDessin = releves.filter(({ cible, type }) => elements.includes(cible) && DU_POINTEUR.test(type));
    expect(surDessin).toEqual([]);
    for (const element of elements) {
      for (const propriete of ['onpointerdown', 'onpointermove', 'onpointerup', 'onpointercancel', 'onwheel']) {
        expect(element[propriete], propriete).toBeNull();
      }
    }
    const surRacine = releves.filter(({ cible }) => cible === racinePlan(m));
    const types = surRacine.map(({ type }) => type);
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'wheel']) expect(types, type).toContain(type);
    expect(surRacine.find(({ type }) => type === 'wheel').options).toEqual({ passive: false });
    // Contrôle d'échec : un écouteur que l'épreuve pose sur une chaise est relevé.
    const chaise = dans(m, '[data-siege]');
    chaise.addEventListener('pointerdown', () => {});
    expect(releves.filter(({ cible, type }) => cible === chaise && DU_POINTEUR.test(type))).toHaveLength(1);

    const table = tableEl(m, 2);
    const pointeur = pointeurDuProchainAppui(m);
    const depart = pointTable(m, 2);
    await pointer('presser', depart.x, depart.y);
    await images(1);
    const ecritures = [];
    const observateur = new MutationObserver((liste) => ecritures.push(...liste.filter(({ attributeName }) => attributeName === 'transform')));
    observateur.observe(table, { attributes: true });
    for (let i = 1; i <= 10; i += 1) {
      racinePlan(m).dispatchEvent(
        new PointerEvent('pointermove', { pointerId: pointeur.id, clientX: depart.x + 10 * i, clientY: depart.y, bubbles: true }),
      );
    }
    await Promise.resolve();
    expect(ecritures.length).toBeLessThanOrEqual(1);
    await uneImage();
    await Promise.resolve();
    expect(ecritures.length).toBeLessThanOrEqual(1);
    expect(table.getAttribute('transform')).not.toBeNull();
    observateur.disconnect();
    await pointer('relacher', depart.x + 100, depart.y);
    await images(3);
  });
});

// --- Le déplacement de vue (§ 7.1, § 7.2, § 8.5) -------------------------------

describe('le déplacement de vue, geste du sol (§ 7.1, § 7.2, § 8.5)', () => {
  test('(60, −40) px avancent tx et ty d’autant, k inchangé ; seul le transform du groupe change ; le cadrage s’écrit après DELAI_REGLAGES_MS ; en écriture, en lecture, sur un plan bloqué', async () => {
    const m = await ouvrir(huitRetenue());
    const parcourir = async (nom) => {
      const avant = fichiers(m);
      const ecritures = m.fs.compteurs.ecritures;
      const vue = vueLue(m);
      const depart = pointSol(m);
      const mutations = [];
      const observateur = new MutationObserver((liste) => mutations.push(...liste));
      observateur.observe(racinePlan(m), { attributes: true, childList: true, subtree: true, characterData: true });
      await glisser(depart, decale(depart, 60, -40), { pas: 10 });
      await images(2);
      observateur.disconnect();
      expect(mutations.length, nom).toBeGreaterThan(0);
      for (const mutation of mutations) {
        expect(mutation.type, nom).toBe('attributes');
        expect(mutation.attributeName, nom).toBe('transform');
        expect(mutation.target, nom).toBe(groupe(m));
      }
      const apres = vueLue(m);
      expect(apres.k, nom).toBe(vue.k);
      expect(apres.tx, nom).toBeCloseTo(vue.tx + 60, 6);
      expect(apres.ty, nom).toBeCloseTo(vue.ty - 40, 6);
      expect(fichiers(m), nom).toEqual(avant);
      expect(m.fs.compteurs.ecritures, nom).toBe(ecritures);
      m.horloge.avancer(DELAI_REGLAGES_MS - 1);
      await images(2);
      expect(m.fs.compteurs.ecritures, nom).toBe(ecritures);
      m.horloge.avancer(1);
      await attendre(() => expect(m.fs.compteurs.ecritures, nom).toBe(ecritures + 1));
      const ecrit = JSON.parse(m.fs.contenu('documents', 'reglages_locaux.json')).cadrages.find(
        ({ evenement }) => evenement === charge(m).evenement.id,
      );
      expect({ k: ecrit.k, tx: ecrit.tx, ty: ecrit.ty }, nom).toEqual(vueLue(m));
      expect(fichiers(m), nom).toEqual(avant);
    };
    await parcourir('écriture');
    await m.seance.passerEnLecture();
    flushSync();
    await parcourir('lecture');
    await m.seance.passerEnEcriture();
    await m.seance.executer('changerEtat', { etat: 'bloque' });
    flushSync();
    await parcourir('bloqué');
  });

  test('un pointercancel en cours de glissement remet le transform d’origine', async () => {
    const m = await ouvrir(huitRetenue());
    const transform = groupe(m).getAttribute('transform');
    const pointeur = pointeurDuProchainAppui(m);
    const depart = pointSol(m);
    await presserEtBouger(depart, decale(depart, 70, 50));
    expect(groupe(m).getAttribute('transform')).not.toBe(transform);
    racinePlan(m).dispatchEvent(new PointerEvent('pointercancel', { pointerId: pointeur.id, bubbles: true }));
    flushSync();
    expect(groupe(m).getAttribute('transform')).toBe(transform);
    await pointer('relacher', depart.x + 70, depart.y + 50);
    await images(2);
    expect(groupe(m).getAttribute('transform')).toBe(transform);
  });
});

// --- Le dépôt par la géométrie (§ 7.3, § 14.10) ------------------------------

describe('le dépôt se désigne par la géométrie (§ 7.3)', () => {
  test('relâchée au centre d’une chaise libre d’une autre table, la commande nomme cette table et ce siège ; sur une chaise que recouvre une liste, de même', async () => {
    const m = await ouvrir(huitRetenue());
    const commandes = releverCommandes(m);
    // Au tour 1, la table 8 n'assied que la personne 20 : ses sièges 2 et 3 sont libres.
    const r = fichiers(m).revision;
    await glisser(pointChaise(m, 2, 1), pointChaise(m, 8, 2));
    await uneEntree(m, r);
    expect(commandes).toEqual([{ nom: 'deplacerDansRetenu', args: { tour: 1, participant: 4, table: 8, siege: 2 } }]);

    // La liste de la table 5 couvre les chaises de la table 6 : la personne 13
    // va au siège 3, libre, de la table 6.
    const liste = dans(m, '[data-liste="5"]');
    const visee = pointChaise(m, 6, 3);
    const boite = liste.getBoundingClientRect();
    expect(visee.x > boite.left && visee.x < boite.right && visee.y > boite.top && visee.y < boite.bottom).toBe(true);
    await glisser(pointChaise(m, 5, 1), visee);
    await uneEntree(m, r + 1);
    expect(commandes.at(-1)).toEqual({ nom: 'deplacerDansRetenu', args: { tour: 1, participant: 13, table: 6, siege: 3 } });
  });
});

// --- Annuler n'est pas finir (§ 7.3, § 8.4) ---------------------------------------

describe('annuler n’est pas finir (§ 7.3, § 8.4)', () => {
  const verrou = (m) => m.fs.contenu('documents', `${BASE}/${BASE}${SUFFIXES.verrou}`);

  // Trois annulations d'un geste entamé : un pointercancel sur la racine,
  // Échap le focus sur <body>, le retour en lecture. montrer entame le
  // geste et rend la fonction qui vérifie qu'il est montré ; revenu vérifie
  // que tout est revenu.
  async function annulerTrois(m, { depart, vers, montre, revenu }) {
    for (const cause of ['pointercancel', 'echap', 'lecture']) {
      if (m.seance.etat().mode !== 'ecriture') await m.seance.passerEnEcriture();
      flushSync();
      const avant = fichiers(m);
      const ecritures = m.fs.compteurs.ecritures;
      const pointeur = pointeurDuProchainAppui(m);
      await presserEtBouger(depart(), vers());
      montre(cause);
      if (cause === 'pointercancel') {
        racinePlan(m).dispatchEvent(new PointerEvent('pointercancel', { pointerId: pointeur.id, bubbles: true }));
      } else if (cause === 'echap') {
        document.activeElement?.blur();
        expect(document.activeElement).toBe(document.body);
        await touche('Escape');
      } else {
        await m.seance.passerEnLecture();
      }
      flushSync();
      revenu(cause);
      await pointer('relacher', vers().x, vers().y);
      await images(3);
      revenu(cause);
      expect(fichiers(m), cause).toEqual(avant);
      if (cause === 'lecture') {
        expect(m.fs.compteurs.ecritures, cause).toBe(ecritures + 1);
        expect(verrou(m), cause).toBeNull();
      } else {
        expect(m.fs.compteurs.ecritures, cause).toBe(ecritures);
      }
    }
  }

  test('une table : pointercancel, Échap, passage en lecture → le transform d’origine, rien d’écrit', async () => {
    const m = await ouvrir(huitRetenue());
    await annulerTrois(m, {
      depart: () => pointTable(m, 2),
      vers: () => decale(pointTable(m, 2), 60, 40),
      montre: (cause) => expect(tableEl(m, 2).getAttribute('transform'), cause).not.toBeNull(),
      revenu: (cause) => expect(tableEl(m, 2).getAttribute('transform'), cause).toBeNull(),
    });
  });

  test('une personne : le fantôme se montre, puis se cache ; rien d’écrit', async () => {
    const m = await ouvrir(huitRetenue());
    await annulerTrois(m, {
      depart: () => pointChaise(m, 2, 1),
      vers: () => pointChaise(m, 8, 2),
      montre: (cause) => expect(fantomeMontre(m), cause).toBe(true),
      revenu: (cause) => expect(fantomeMontre(m), cause).toBe(false),
    });
  });

  test('une poignée : les chaises tirées disparaissent, la table revient à sa capacité ; rien d’écrit', async () => {
    const m = await ouvrir(troisDeHuit());
    const k = vueLue(m).k;
    const pas = (60 / (2 * Math.PI)) * k / Math.SQRT2;
    await annulerTrois(m, {
      depart: () => pointPoignee(m, 1),
      vers: () => decale(pointPoignee(m, 1), 3 * pas, 3 * pas),
      montre: (cause) => expect(chaisesDe(m, 1).length, cause).toBe(11),
      revenu: (cause) => expect(chaisesDe(m, 1).length, cause).toBe(8),
    });
  });
});

// --- Les gestes d'une personne, les deux états des données (§ 5.8, § 7.1) -------

describe('les gestes d’une personne (§ 7.1, § 8.2, § 5.8)', () => {
  test('sur un retenu, au tour 2 : déplacer, échanger, retirer → une entrée chacun ; le retenu ne change qu’au tour 2 ; la proposition reste identique', async () => {
    const m = await ouvrir(huitRetenue());
    m.ui.montrerTour(2);
    flushSync();
    await images(2);
    const origine = structuredClone(charge(m));
    let r = fichiers(m).revision;

    await glisser(pointChaise(m, 4, 1), pointChaise(m, 7, 3));
    expect(await uneEntree(m, r)).toBe('Déplacé Iris Ombrelle de la table 4 à la table 7, tour 2');
    r += 1;
    // Théo Pervenche (2), à la table 1 au tour 2, prend la place d'Ondine
    // Lacasse (3), à la table 2, et l'inverse.
    await glisser(pointChaise(m, 1, 1), pointChaise(m, 2, 1));
    expect(await uneEntree(m, r)).toMatch(/^Échangé Théo Pervenche .* et Ondine Lacasse .*, tour 2$/);
    r += 1;
    await glisser(pointChaise(m, 3, 1), pointSol(m));
    expect(await uneEntree(m, r)).toMatch(/^Retiré Grisaille de la table 3, tour 2$/);

    const apres = charge(m);
    expect(apres.propositions).toEqual(origine.propositions);
    expect(apres.reservations).toEqual(origine.reservations);
    expect(apres.retenu.placement[0]).toEqual(origine.retenu.placement[0]);
    expect(apres.retenu.placement[2]).toEqual(origine.retenu.placement[2]);
    expect(apres.retenu.placement[1]).not.toEqual(origine.retenu.placement[1]);
    expect(etatPlaces(apres, { tour: 2 }).reserve).toContain(4);
    for (const tour of [1, 3]) expect(etatPlaces(apres, { tour }).reserve, `tour ${tour}`).not.toContain(4);
  });

  test('le même geste, deux états : avant la retenue une réservation, sur le retenu le retenu ; une proposition montrée sur le retenu refuse sur la place', async () => {
    // Avant la retenue, la proposition 1 montrée : Grisaille (4), non réservée,
    // vers le siège 2, libre, de la table 8 au tour 1.
    const avantRetenue = await ouvrir(huitAvantRetenue());
    avantRetenue.ui.montrerProposition(1);
    flushSync();
    await images(2);
    const origine = structuredClone(charge(avantRetenue));
    const r = fichiers(avantRetenue).revision;
    await presserEtBouger(pointChaise(avantRetenue, 2, 1), pointChaise(avantRetenue, 8, 2));
    expect(fantomeMontre(avantRetenue)).toBe(true);
    const libelleReservation = texteDe(fantomeEl(avantRetenue).querySelector('[data-partie="etat"]'));
    expect(libelleReservation).toBe('pose une réservation');
    expect(texteDe(fantomeEl(avantRetenue).querySelector('[data-partie="nom"]'))).toBe('Grisaille');
    const vers = pointChaise(avantRetenue, 8, 2);
    await pointer('relacher', vers.x, vers.y);
    await uneEntree(avantRetenue, r);
    expect(charge(avantRetenue).reservations).toEqual([{ participant: 4, table: 8, siege: 2, portee: 'tour', tour: 1 }]);
    expect(charge(avantRetenue).propositions).toEqual(origine.propositions);

    // Sur le retenu, le même glissement modifie le retenu.
    demonter(avantRetenue);
    const retenue = await ouvrir(huitRetenue());
    const origineRetenue = structuredClone(charge(retenue));
    const rr = fichiers(retenue).revision;
    await presserEtBouger(pointChaise(retenue, 2, 1), pointChaise(retenue, 8, 2));
    const libelleRetenu = texteDe(fantomeEl(retenue).querySelector('[data-partie="etat"]'));
    expect(libelleRetenu).toBe('déplace dans le placement retenu');
    expect(libelleRetenu).not.toBe(libelleReservation);
    const versRetenu = pointChaise(retenue, 8, 2);
    await pointer('relacher', versRetenu.x, versRetenu.y);
    await uneEntree(retenue, rr);
    expect(charge(retenue).reservations).toEqual(origineRetenue.reservations);
    expect(charge(retenue).propositions).toEqual(origineRetenue.propositions);
    expect(charge(retenue).retenu.placement[0]).not.toEqual(origineRetenue.retenu.placement[0]);

    // Le retenu, la proposition 1 montrée : la personne revient, le refus est
    // sur la place, et son remède montre le retenu.
    retenue.ui.montrerProposition(1);
    flushSync();
    await images(2);
    const avant = fichiers(retenue);
    await glisser(pointChaise(retenue, 3, 1), pointChaise(retenue, 7, 3));
    const place = dans(retenue, '[data-siege="7:3"]');
    await attendre(() => expect(decrit(place)).not.toBeNull());
    const refus = decrit(place).querySelector('[data-refus="PROPOSITION_MONTREE"]');
    expect(refus).not.toBeNull();
    const remede = refus.querySelector('[data-commande="afficherTour"]');
    expect(remede).not.toBeNull();
    await rienEcrit(retenue, avant);
    expect(fantomeMontre(retenue)).toBe(false);
    remede.click();
    flushSync();
    expect(retenue.ui.etat().proposition).toBeNull();
    await rienEcrit(retenue, avant);
  });

  // L'anneau du fantôme garde son rayon en pixels à tout zoom ; la chaise
  // visée, le sien en cm. Quand le rayon de la chaise à l'écran avoisine
  // celui de l'anneau, le trait de la chaise passe sous l'anneau ou le
  // borde : l'anneau se mesure contre ce qui est peint sous son trait
  // (§ 14.5), dans les deux thèmes, à chaque rayon de chaise de 8 à 12 px.
  test('le fantôme posé sur une chaise de son rayon à l’écran : son anneau se détache du trait de la chaise, à 3:1, dans les deux thèmes', async () => {
    const m = await ouvrir(huitRetenue());
    const rayon = geometrieDe(m, 8).chaises[1].rayon;
    const cadre = cadreDe(m);
    const avant = fichiers(m);
    for (const ecran of [8, 9, 10, 11, 12]) {
      const k = ecran / rayon;
      await avecVue(m, { k, tx: cadre.largeur / 2 - 450 * k, ty: cadre.hauteur / 2 - 150 * k });
      await presserEtBouger(pointChaise(m, 2, 1), pointChaise(m, 8, 2));
      expect(fantomeMontre(m), `chaise de ${ecran} px`).toBe(true);
      for (const theme of ['clair', 'sombre']) {
        const { vues, fautes } = await sousTheme(theme, () => releverMarques(fantomeEl(m), { fenetre: true }));
        const cause = `chaise de ${ecran} px, thème ${theme}`;
        expect(vues, cause).toEqual(['fantome']);
        expect(fautes, cause).toEqual([]);
      }
      const vers = pointChaise(m, 8, 2);
      document.activeElement?.blur();
      await touche('Escape');
      await pointer('relacher', vers.x, vers.y);
      await attendre(() => expect(fantomeMontre(m)).toBe(false));
      await rienEcrit(m, avant);
    }
  });
});

describe('un refus posé sur une place ne couvre pas la cible suivante (§ 5.9, § 7.3)', () => {
  test('un appui sur une chaise que couvre le texte du refus atteint le plan : le refus se ferme, la chaise se sélectionne', async () => {
    const m = await ouvrir(huitRetenue());
    m.ui.montrerProposition(1);
    flushSync();
    await images(2);
    await glisser(pointChaise(m, 3, 1), pointChaise(m, 7, 1));
    const place = dans(m, '[data-siege="7:1"]');
    await attendre(() => expect(decrit(place)).not.toBeNull());
    const refus = decrit(place);
    const boite = refus.getBoundingClientRect();
    // Les chaises dont le centre tombe dans la boîte du refus, hors de ses
    // boutons.
    const couvertes = tous(m, '[data-siege]')
      .map((chaise) => {
        const [table, siege] = chaise.dataset.siege.split(':').map(Number);
        return { chaise, point: pointChaise(m, table, siege) };
      })
      .filter(({ point: { x, y } }) => x > boite.left + 2 && x < boite.right - 2 && y > boite.top + 2 && y < boite.bottom - 2)
      .filter(({ point: { x, y } }) => document.elementFromPoint(x, y)?.closest('button') === null);
    expect(couvertes.length).toBeGreaterThan(0);
    const { chaise, point } = couvertes[0];
    const avant = fichiers(m);
    await pointer('presser', point.x, point.y);
    await pointer('relacher', point.x, point.y);
    await images(2);
    expect(decrit(place)).toBeNull();
    const [table, siege] = chaise.dataset.siege.split(':').map(Number);
    expect(m.ui.etat().selection).toEqual({ table, siege });
    await rienEcrit(m, avant);
  });
});

// --- Glisser une table (§ 7.1, § 9) ---------------------------------------------

describe('glisser une table (§ 7.1, § 9)', () => {
  test('(40, −20) px à k = 2 ajoutent (20, −10) cm à sa position, une entrée ; sur un plan bloqué, la table revient, un refus nomme « Débloquer », rien d’écrit', async () => {
    const m = await ouvrir(troisDeHuit());
    const cadre = cadreDe(m);
    await avecVue(m, { k: 2, tx: cadre.largeur / 2 - 2 * 300, ty: cadre.hauteur / 2 });
    const r = fichiers(m).revision;
    const position = { ...charge(m).tables[1].position };
    const depart = pointTable(m, 2);
    await glisser(depart, decale(depart, 40, -20));
    await uneEntree(m, r);
    expect(charge(m).tables[1].position).toEqual({ x: position.x + 20, y: position.y - 10 });

    await m.seance.executer('changerEtat', { etat: 'bloque' });
    flushSync();
    const avant = fichiers(m);
    const ici = pointTable(m, 2);
    await glisser(ici, decale(ici, 40, -20));
    const table = tableEl(m, 2);
    await attendre(() => expect(decrit(table)).not.toBeNull());
    const refus = decrit(table).querySelector('[data-refus="LECTURE_SEULE"]');
    expect(refus).not.toBeNull();
    expect(texteDe(refus.querySelector('[data-commande="debloquer"]'))).toBe('Débloquer');
    expect(table.getAttribute('transform')).toBeNull();
    await rienEcrit(m, avant);
  });

  test('pendant l’écriture d’un déplacement, un second appui sur la table ne fait rien : une seule commande, la table au premier écart, aucun refus ; la vue, elle, se déplace', async () => {
    const m = await ouvrir(huitRetenue());
    const commandes = releverCommandes(m);
    // L'écriture de l'état reste retenue jusqu'à liberer() : la séance ne
    // publie la charge nouvelle qu'une fois l'écriture faite.
    const ecrireAtomique = m.fs.ecrireAtomique;
    let liberer = null;
    const retenue = new Promise((resoudre) => {
      liberer = resoudre;
    });
    m.fs.ecrireAtomique = async (...parametres) => {
      await retenue;
      return Reflect.apply(ecrireAtomique, m.fs, parametres);
    };
    nettoyages.push(() => {
      m.fs.ecrireAtomique = ecrireAtomique;
    });
    const r = fichiers(m).revision;
    const position = { ...charge(m).tables[0].position };
    const depart = pointTable(m, 1);
    const ici = decale(depart, 40, 0);
    await glisser(depart, ici);
    await attendre(() => expect(commandes).toHaveLength(1));
    const voulue = commandes[0].args.position;
    expect(voulue).not.toEqual(position);
    const deplacee = tableEl(m, 1).getAttribute('transform');
    expect(deplacee).not.toBeNull();

    await glisser(ici, decale(ici, 40, 0));
    await images(3);
    expect(commandes).toHaveLength(1);
    expect(tableEl(m, 1).getAttribute('transform')).toBe(deplacee);
    const vueAvant = groupe(m).getAttribute('transform');
    const sol = pointSol(m);
    await glisser(sol, decale(sol, 30, 20));
    await attendre(() => expect(groupe(m).getAttribute('transform')).not.toBe(vueAvant));

    liberer();
    await uneEntree(m, r);
    await images(4);
    expect(commandes).toHaveLength(1);
    expect(charge(m).tables[0].position).toEqual(voulue);
    await attendre(() => expect(tableEl(m, 1).getAttribute('transform')).toBeNull());
    expect(decrit(tableEl(m, 1))).toBeNull();
    expect(m.racine.querySelector('[data-refus]')).toBeNull();
  });

  // Trois rondes de 8 : la 1 et la 2 l'une sous l'autre, à 300 cm, la 3 à
  // droite de la 1. Chaque personne porte sa propre organisation, trop
  // longue pour sa ligne : sous « Organisation », la liste de la table 1
  // descend plus bas que le pas de rangée, et la rangée de la table 2
  // descend sur le dessin (§ 7.4).
  function planEcarte() {
    const depart = troisDeHuit();
    depart.tables = depart.tables.map((table, rang) => ({ ...table, position: [{ x: 0, y: 0 }, { x: 0, y: 300 }, { x: 1000, y: 0 }][rang] }));
    depart.participants = depart.participants.map((personne) => ({ ...personne, organisation: `Fédération des jardins partagés du quartier ${personne.nom}` }));
    return depart;
  }
  // Le centre de la table sur le dessin : celui de son plateau, signalé ou
  // non.
  const centreDessine = (m, id) => {
    const plateau = dans(m, `[data-table="${id}"] > :is([data-marque="contourTable"], [data-marque="contourConflit"])`);
    return { x: Number(plateau.getAttribute('cx')), y: Number(plateau.getAttribute('cy')) };
  };
  // La vue d'« Ajuster » sur le plan tel qu'il est dessiné.
  const ajusteeSurLeDessin = (m) =>
    ajuster(englobant(etatMontre(m).tables.map((table) => geometrieTable({ ...table, position: centreDessine(m, table.id) }, table.capacite))), cadreDe(m));

  // Le cadre, plus haut, montre les deux rangées à k = 0,5.
  test('plan écarté : une table se saisit où le dessin la pose, glisse de l’écart du pointeur sans changer de rangée, et lâchée sur une rangée du dessin y prend l’ordonnée enregistrée', async () => {
    await fixerCadre(1366, 1100);
    const m = await ouvrir(planEcarte());
    const centre = (id) => centreDessine(m, id);
    m.ui.basculerOrganisations();
    await attendre(() => expect(centre(2).y).toBeGreaterThan(300));
    const cadre = cadreDe(m);
    await avecVue(m, { k: 0.5, tx: cadre.largeur / 2 - 250, ty: 40 });
    await attendre(() => expect(centre(2).y).toBeGreaterThan(300));
    const descente = centre(2).y - 300;
    expect(centre(1)).toEqual({ x: 0, y: 0 });
    expect(centre(3)).toEqual({ x: 1000, y: 0 });

    const r = fichiers(m).revision;
    const ici = ecranDe(m, centre(2));
    await glisser(ici, decale(ici, 20, 0));
    await uneEntree(m, r);
    expect(charge(m).tables[1].position).toEqual({ x: 40, y: 300 });
    await attendre(() => expect(tableEl(m, 2).getAttribute('transform')).toBeNull());
    expect(centre(2).x).toBe(40);
    expect(centre(2).y).toBeCloseTo(300 + descente, 9);

    const r2 = fichiers(m).revision;
    await glisser(ecranDe(m, centre(3)), ecranDe(m, { x: 1000, y: centre(2).y }));
    await uneEntree(m, r2);
    expect(charge(m).tables[2].position).toEqual({ x: 1000, y: 300 });
    await attendre(() => expect(tableEl(m, 3).getAttribute('transform')).toBeNull());
    expect(centre(3).y).toBeCloseTo(centre(2).y, 9);

    // « Ajuster » cadre le plan tel qu'il est dessiné, rangées écartées.
    const attendue = ajusteeSurLeDessin(m);
    dans(m, '[data-commande="ajuster"]').click();
    await attendre(() => expect(vueLue(m).ty).toBeCloseTo(attendue.ty, 6));
    expect(vueLue(m).k).toBeCloseTo(attendue.k, 9);
    expect(vueLue(m).tx).toBeCloseTo(attendue.tx, 6);

    // « Voir sur le plan », demandé hors du plan, centre la chaise où le
    // plan écarté la dessine, une fois le plan remonté : celle d'une
    // personne de la table 2.
    const assise = etatMontre(m).tables[1].chaises.findIndex(({ occupant }) => occupant !== null);
    const personne = etatMontre(m).tables[1].chaises[assise].occupant;
    m.ui.allerA('tables');
    flushSync();
    m.ui.mettreEnEvidence(personne, { centrer: true });
    m.ui.allerA('plan');
    await attendre(() => expect(m.ui.etat().centrerEvidence).toBe(false));
    await attendre(() => expect(centre(2).y).toBeGreaterThan(300));
    const chaise = dans(m, `[data-siege="2:${assise + 1}"] circle`);
    const boite = chaise.getBoundingClientRect();
    const plan = racinePlan(m).getBoundingClientRect();
    expect(boite.left + boite.width / 2).toBeCloseTo(plan.left + plan.width / 2, 3);
    expect(boite.top + boite.height / 2).toBeCloseTo(plan.top + plan.height / 2, 3);
  });

  // La vue où le plan s'ouvre se calcule avant les mesures des listes,
  // donc avant les rangées : leurs premières mesures la recalculent.
  test('plan écarté remonté sans cadrage mémorisé : il s’ouvre sur la vue d’« Ajuster » du dessin écarté', async () => {
    const m = await ouvrir(planEcarte());
    m.ui.basculerOrganisations();
    await attendre(() => expect(centreDessine(m, 2).y).toBeGreaterThan(300));
    expect(m.seance.cadrage()).toBeNull();
    m.ui.allerA('tables');
    flushSync();
    m.ui.allerA('plan');
    flushSync();
    await attendre(() => expect(centreDessine(m, 2).y).toBeGreaterThan(300));
    const attendue = ajusteeSurLeDessin(m);
    await attendre(() => expect(vueLue(m).ty).toBeCloseTo(attendue.ty, 6));
    expect(vueLue(m).k).toBeCloseTo(attendue.k, 9);
    expect(vueLue(m).tx).toBeCloseTo(attendue.tx, 6);
    expect(m.seance.cadrage()).toBeNull();
  });
});

// --- La poignée (§ 7.1, § 7.7, § 6.1, § 6.2) ----------------------------------------

describe('la poignée (§ 7.1, § 7.7, § 6.2)', () => {
  // Le décalage écran, sur chaque axe, d'un écart radial de n places.
  const pasDe = (m, n) => ((n * 60) / (2 * Math.PI)) * vueLue(m).k / Math.SQRT2;

  test('une table de 8 tirée dehors puis dedans : des nombres entiers successifs de chaises, le rayon rendu à l’échelle, rien d’écrit avant le relâcher, puis une entrée', async () => {
    const m = await ouvrir(troisDeHuit());
    const k = vueLue(m).k;
    const avant = fichiers(m);
    const depart = pointPoignee(m, 1);
    await pointer('presser', depart.x, depart.y);
    const vus = [];
    const plateau = () => dans(m, '[data-table="1"] [data-marque="contourTable"], [data-table="1"] [data-marque="contourConflit"]');
    const lire = () => {
      flushSync();
      const n = chaisesDe(m, 1).length;
      if (vus.at(-1) !== n) vus.push(n);
      expect(plateau().getBoundingClientRect().width / 2).toBeCloseTo((diametre(n) / 2) * k, 0);
    };
    for (const n of [0.4, 1, 1.6, 2, 2.6, 3, 2.4, 2, 1.4, 1, 0.5, 0, -0.6]) {
      await pointer('bouger', depart.x + pasDe(m, n), depart.y + pasDe(m, n));
      await images(1);
      lire();
    }
    expect(fichiers(m)).toEqual(avant);
    expect(vus.length).toBeGreaterThan(3);
    for (let i = 1; i < vus.length; i += 1) expect(Math.abs(vus[i] - vus[i - 1]), `${vus}`).toBe(1);
    expect(Math.max(...vus)).toBe(11);
    expect(vus.at(-1)).toBe(7);
    await pointer('relacher', depart.x + pasDe(m, -0.6), depart.y + pasDe(m, -0.6));
    expect(await uneEntree(m, avant.revision)).toBe('Table 1 : 7 places');
    expect(charge(m).tables[0].sieges).toBe(7);
    expect(Number.isInteger(charge(m).tables[0].sieges)).toBe(true);
  });

  test('retenu, sept personnes à la table 3 au seul tour 3 : tirée vers 5, elle s’arrête à 7, et le message sur la table porte « 7 » et « tour 3 »', async () => {
    const m = await ouvrir(troisDeHuit());
    const depart = pointPoignee(m, 3);
    await presserEtBouger(depart, decale(depart, pasDe(m, -3), pasDe(m, -3)));
    expect(chaisesDe(m, 3).length).toBe(7);
    const table = tableEl(m, 3);
    await attendre(() => expect(decrit(table)).not.toBeNull());
    const refus = decrit(table).querySelector('[data-refus="SOUS_OCCUPES"]');
    expect(texteDe(refus)).toContain('7');
    expect(texteDe(refus)).toContain('tour 3');
    expect(recoupe(decrit(table), table)).toBe(true);
    const r = fichiers(m).revision;
    await pointer('relacher', depart.x + pasDe(m, -3), depart.y + pasDe(m, -3));
    expect(await uneEntree(m, r)).toBe('Table 3 : 7 places');
  });

  test('sièges attribués, un titre « animateur » au siège 8 et une réservation au siège 7 : tirée vers 6, elle s’arrête à 8 ; le message liste le siège 8 et son titre ; relâchée à 8, aucune entrée', async () => {
    let base = chargeDe({ id: 'evt-attribues', places: [null, null], personnes: 4, attribuer: true });
    base = executer(base, 'poserTitre', { table: 1, siege: 8, libelle: 'animateur' });
    base = executer(base, 'reserver', { participant: 1, table: 1, siege: 7, portee: 'tous', tour: null });
    const m = await ouvrir(base);
    const avant = fichiers(m);
    const depart = pointPoignee(m, 1);
    const vers = decale(depart, pasDe(m, -2), pasDe(m, -2));
    await presserEtBouger(depart, vers);
    expect(chaisesDe(m, 1).length).toBe(8);
    const table = tableEl(m, 1);
    await attendre(() => expect(decrit(table)).not.toBeNull());
    const refus = decrit(table).querySelector('[data-refus="SIEGES_RETIRES"]');
    expect(texteDe(refus)).toContain('siège 8');
    expect(texteDe(refus)).toContain('animateur');
    await pointer('relacher', vers.x, vers.y);
    await rienEcrit(m, avant);
    expect(chaisesDe(m, 1).length).toBe(8);
  });

  test('surcharge par la poignée : une table qui suit un défaut de 8, passée à 9 puis ramenée à 8, se dit surchargée, jusqu’au réalignement', async () => {
    const m = await ouvrir(chargeDe({ id: 'evt-surcharge', places: [null, null], personnes: 4 }));
    const nom = (id) => tableEl(m, id).getAttribute('aria-label');
    expect(nom(1)).toBe(nom(2).replace('Table 2', 'Table 1'));
    let r = fichiers(m).revision;
    for (const n of [1, -1]) {
      const depart = pointPoignee(m, 1);
      await glisser(depart, decale(depart, pasDe(m, n), pasDe(m, n)));
      await uneEntree(m, r);
      r += 1;
    }
    expect(charge(m).tables[0].sieges).toBe(8);
    await attendre(() => expect(nom(1)).toContain('surchargée'));
    expect(nom(2)).not.toContain('surchargée');
    expect(chaisesDe(m, 1).length).toBe(chaisesDe(m, 2).length);
    await m.seance.executer('realignerTable', { id: 1 });
    await attendre(() => expect(nom(1)).not.toContain('surchargée'));
  });

  test('lisibilité : au-delà de SEUIL_SIEGES_LISIBLES, l’avertissement s’affiche sur la table, sans arrêter le nombre', async () => {
    const m = await ouvrir(chargeDe({ id: 'evt-lisible', places: [null, null], personnes: 4 }));
    const seuil = constante('SEUIL_SIEGES_LISIBLES');
    const depart = pointPoignee(m, 1);
    const n = seuil + 1 - 8;
    await presserEtBouger(depart, decale(depart, pasDe(m, n), pasDe(m, n)), { pas: 10 });
    expect(chaisesDe(m, 1).length).toBe(seuil + 1);
    const table = tableEl(m, 1);
    await attendre(() => expect(decrit(table)).not.toBeNull());
    const avertissement = decrit(table).querySelector('[data-avertissement="AU_DELA_LISIBLE"]');
    expect(avertissement).not.toBeNull();
    expect(avertissement.checkVisibility()).toBe(true);
    const r = fichiers(m).revision;
    await pointer('relacher', depart.x + pasDe(m, n), depart.y + pasDe(m, n));
    expect(await uneEntree(m, r)).toBe(`Table 1 : ${seuil + 1} places`);
  });
});

// --- Un clic n'est pas un glisser ; la lecture ; l'inactivité (§ 8.4) ---------------

describe('un clic n’est pas un glisser, la lecture, l’inactivité (§ 8.4)', () => {
  test('appui, mouvement sous le seuil, relâcher → aucune entrée ; au-delà → une entrée ; Échap pendant le glissement → objet remis, aucune entrée', async () => {
    expect(SEUIL).toBeGreaterThan(0);
    const m = await ouvrir(huitRetenue());
    const avant = fichiers(m);
    const depart = pointTable(m, 5);
    await glisser(depart, decale(depart, SEUIL - 1, 0), { pas: 2 });
    await rienEcrit(m, avant);
    expect(m.ui.etat().selection).toEqual({ table: 5 });
    await glisser(depart, decale(depart, SEUIL + 6, 0), { pas: 2 });
    await uneEntree(m, avant.revision);
    const apres = fichiers(m);
    const ici = pointTable(m, 5);
    await presserEtBouger(ici, decale(ici, 40, 0));
    await touche('Escape');
    flushSync();
    expect(tableEl(m, 5).getAttribute('transform')).toBeNull();
    await pointer('relacher', ici.x + 40, ici.y);
    await rienEcrit(m, apres);
  });

  test('en lecture : glisser une personne, une table, tirer une poignée → charge inchangée, rien d’écrit, objets revenus ; le zoom et le changement de tour opèrent', async () => {
    const m = await ouvrir(troisDeHuit(), { mode: 'lecture' });
    const texteCharge = serialiserCharge(charge(m));
    const avant = fichiers(m);
    const ecritures = m.fs.compteurs.ecritures;
    await glisser(pointChaise(m, 1, 1), pointChaise(m, 3, 8));
    await glisser(pointTable(m, 2), decale(pointTable(m, 2), 50, 50));
    const poignee = pointPoignee(m, 1);
    await glisser(poignee, decale(poignee, pasDeLecture(m), pasDeLecture(m)));
    await images(4);
    expect(serialiserCharge(charge(m))).toBe(texteCharge);
    await rienEcrit(m, avant);
    expect(m.fs.compteurs.ecritures).toBe(ecritures);
    expect(tableEl(m, 2).getAttribute('transform')).toBeNull();
    expect(chaisesDe(m, 1).length).toBe(8);
    expect(fantomeMontre(m)).toBe(false);
    const transform = groupe(m).getAttribute('transform');
    dans(m, '[data-commande="zoomer"]').click();
    flushSync();
    expect(groupe(m).getAttribute('transform')).not.toBe(transform);
    const select = dans(m, '[data-champ="tour"]');
    select.value = '2';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();
    expect(m.ui.etat().tour).toBe(2);
    expect(m.seance.etat().mode).toBe('lecture');
  });

  test('inactivité : le délai dépassé pendant un glissement laisse en écriture ; après le relâcher et le délai, lecture ; un déplacement de vue relance le compte ; « Revenir en lecture » au clavier ramène la table', async () => {
    const m = await ouvrir(huitRetenue());
    const depart = pointTable(m, 6);
    await presserEtBouger(depart, decale(depart, 30, 20));
    m.horloge.avancer(INACTIVITE_MS + 1);
    await images(2);
    expect(m.seance.etat().mode).toBe('ecriture');
    expect(tableEl(m, 6).getAttribute('transform')).not.toBeNull();
    const r = fichiers(m).revision;
    await pointer('bouger', depart.x + 40, depart.y + 20);
    await pointer('relacher', depart.x + 40, depart.y + 20);
    await uneEntree(m, r);
    m.horloge.avancer(INACTIVITE_MS + 1);
    await attendre(() => expect(m.seance.etat().mode).toBe('lecture'));

    await m.seance.passerEnEcriture();
    flushSync();
    m.horloge.avancer(INACTIVITE_MS - 1000);
    const sol = pointSol(m);
    await glisser(sol, decale(sol, 30, 30));
    await images(2);
    m.horloge.avancer(INACTIVITE_MS - 1);
    await images(2);
    expect(m.seance.etat().mode).toBe('ecriture');

    const avant = fichiers(m);
    const ici = pointTable(m, 6);
    await presserEtBouger(ici, decale(ici, 50, 0));
    expect(tableEl(m, 6).getAttribute('transform')).not.toBeNull();
    const lecture = dans(m, '[data-commande="lecture"]');
    lecture.focus();
    expect(document.activeElement).toBe(lecture);
    await touche('Enter');
    await attendre(() => expect(m.seance.etat().mode).toBe('lecture'));
    expect(tableEl(m, 6).getAttribute('transform')).toBeNull();
    await pointer('relacher', ici.x + 50, ici.y);
    await images(3);
    expect(entreesApres(m, avant.revision)).toEqual([]);
    expect(fichiers(m).etat).toBe(avant.etat);
  });
});

describe('regarder pendant un geste et regarder sans appuyer (§ 7.2, § 7.3, § 8.4)', () => {
  test('la molette pendant le glissement d’une personne ne change pas la vue : la commande nomme la chaise sous le pointeur au relâcher', async () => {
    const m = await ouvrir(huitRetenue());
    m.ui.montrerTour(2);
    flushSync();
    await avecVue(m, { k: 0.5, tx: 150, ty: 60 });
    const commandes = releverCommandes(m);
    const r = fichiers(m).revision;
    const depart = pointChaise(m, 4, 1);
    await presserEtBouger(depart, decale(depart, 30, 0));
    const vue = groupe(m).getAttribute('transform');
    const cadre = cadreDe(m);
    await molette(cadre.gauche + cadre.largeur / 2, cadre.haut + cadre.hauteur / 2, -300);
    await images(3);
    expect(groupe(m).getAttribute('transform')).toBe(vue);
    const vers = pointChaise(m, 7, 3);
    await pointer('bouger', vers.x, vers.y);
    await uneImage();
    await pointer('relacher', vers.x, vers.y);
    await uneEntree(m, r);
    expect(commandes).toEqual([{ nom: 'deplacerDansRetenu', args: { tour: 2, participant: 1, table: 7, siege: 3 } }]);
  });

  test('la molette, « Zoom + », « Ajuster » et le changement de tour ne relancent pas le compte d’inactivité : le retour en lecture tombe à son heure', async () => {
    const m = await ouvrir(huitRetenue());
    expect(m.seance.etat().mode).toBe('ecriture');
    m.horloge.avancer(INACTIVITE_MS - 1000);
    await images(2);
    const transform = groupe(m).getAttribute('transform');
    const cadre = cadreDe(m);
    await molette(cadre.gauche + cadre.largeur / 2, cadre.haut + cadre.hauteur / 2, -100);
    await attendre(() => expect(groupe(m).getAttribute('transform')).not.toBe(transform));
    dans(m, '[data-commande="zoomer"]').click();
    flushSync();
    dans(m, '[data-commande="ajuster"]').click();
    flushSync();
    const select = dans(m, '[data-champ="tour"]');
    select.value = '2';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();
    expect(m.ui.etat().tour).toBe(2);
    await images(2);
    expect(m.seance.etat().mode).toBe('ecriture');
    m.horloge.avancer(1001);
    await attendre(() => expect(m.seance.etat().mode).toBe('lecture'));
  });
});

// L'écart d'une poignée tirée de trois places, au zoom relu.
const pasDeLecture = (m) => ((3 * 60) / (2 * Math.PI)) * vueLue(m).k / Math.SQRT2;

// --- Le dépôt sur une table pleine (§ 5.9, § 7.3) -----------------------------------

describe('le dépôt sur une table pleine (§ 5.9, § 7.3)', () => {
  test('k = 0,39 : la ronde de 3 en régime sièges, les tables de 8 en régime table ; une personne déposée sur une table de 8 pleine revient, un refus rattaché à la table porte sa cause et son numéro, rien d’écrit', async () => {
    const base = chargeDe({
      id: 'evt-pleine',
      places: [3, null, null],
      ecart: 1200,
      personnes: 16,
      nombreTours: 2,
      tours: [
        [[1, 2, 3], suite(4, 11), suite(12, 16)],
        [[4, 5, 6], [1, 2, 3, 12, 13, 14, 15, 16], suite(7, 11)],
      ],
    });
    const m = await ouvrir(base);
    const cadre = cadreDe(m);
    const kA = kAjuste(englobantDuTour(etatMontre(m)), cadre);
    expect(0.39).toBeGreaterThanOrEqual(kA / 2);
    const englobant = englobantDuTour(etatMontre(m));
    const k = 0.39;
    await avecVue(m, {
      k,
      tx: cadre.largeur / 2 - (k * (englobant.minX + englobant.maxX)) / 2,
      ty: cadre.hauteur / 2 - (k * (englobant.minY + englobant.maxY)) / 2,
    });
    expect(chaisesDe(m, 1).length).toBe(3);
    expect(chaisesDe(m, 2).length).toBe(0);
    const avant = fichiers(m);
    await glisser(pointChaise(m, 1, 1), pointTable(m, 2));
    const table = tableEl(m, 2);
    await attendre(() => expect(decrit(table)).not.toBeNull());
    const refus = decrit(table);
    expect(refus.querySelector('[data-refus="TABLE_PLEINE"]')).not.toBeNull();
    expect(texteDe(refus)).toContain('Table 2');
    expect(texteDe(refus)).toContain('pleine');
    expect(recoupe(refus, table)).toBe(true);
    expect(fantomeMontre(m)).toBe(false);
    await rienEcrit(m, avant);
  });
});
