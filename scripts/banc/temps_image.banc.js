// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le temps par image pendant un déplacement de vue (§ 19.10, § 17 point 6),
// relevé par le banc sur la grande démonstration et ses 33 tables avec
// listes. Une garde, pas un arbitre (Q12 a) : K_LISTES est une constante
// manuelle, un seuil de lisibilité, et le coût des listes ne dépend pas du
// zoom ; le banc vérifie que, listes dessinées à tout zoom, un glissement
// tient CRITERE_TEMPS_IMAGE_MS au p95 sur la machine de référence — le poste,
// processeur ralenti ×4 (Q13 b).
//
// Les listes se dessinent à tout zoom : le registre est remplacé pour ce
// fichier, K_LISTES à 0 (vi.mock), toute autre constante inchangée. La
// première épreuve constate que le remplacement atteint le dessin : au zoom
// ajusté, sous la valeur du registre, les 33 listes sont là.
//
// Le déroulé : le plan ouvert au zoom ajusté, puis cran de molette après
// cran (×1,1) au centre du plan jusqu'à k ≥ 1. À chaque k, sans
// ralentissement puis ralenti ×4, trois glissements de 60 pas sur le sol du
// plan, de part et d'autre d'un point libre de toute table ; le p95 retenu
// est la médiane des trois. Chaque pas doit changer le transform du groupe
// [data-vue] en quelques images : sinon le geste n'a rien dessiné, et la
// mesure lève. Les 33 [data-liste] sont relues à chaque k.
//
// La sortie temps_image.json porte la courbe — chaque point nomme son
// ralentissement —, le critère, le seuil que seuilDepuisCourbe lit sur la
// courbe à ×4, et le verdict : « tenu » quand le p95 à ×4 tient le critère à
// tout k. Le verdict est une donnée du relevé : l'épreuve ne tombe que sur
// une mesure qui ne voit pas ce qu'elle mesure.
import { flushSync } from 'svelte';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { commands } from 'vitest/browser';
import { CONSTANTES, constante } from '../../src/geometrie/constantes.js';
import { vueDepuisTransform } from '../../src/geometrie/vue.js';
import { texteLivre } from '../../src/demo/livrees.js';
import { analyser } from '../../src/stockage/document.js';
import { creerContexte, ouvrirEvenement } from '../../test/navigateur/ecrans.js';
import { molette, pointer } from '../../test/navigateur/entrees.js';
import { controlerCadre, ecrireSortie, mesurerImages, ralentirCpu } from './navigateur.js';
import { verifierReleve } from './releve.js';
import { CRITERE_TEMPS_IMAGE_MS, seuilDepuisCourbe } from './seuils.js';
import { statistiques } from './statistiques.js';

vi.mock('../../src/geometrie/constantes.js', async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, constante: (nom) => (nom === 'K_LISTES' ? 0 : original.constante(nom)) };
});

const NOM = 'TEMPS_IMAGE_LISTES';
const TABLES = 33;
const PAS = 60;
const PAS_PX = 5;
const GLISSEMENTS = 3;
const RALENTISSEMENTS = Object.freeze([1, 4]);
const RALENTISSEMENT_REFERENCE = 4;
const K_FIN = 1;

// Le nombre d'images qu'un pas a pour changer la vue.
const IMAGES_PAR_PAS = 10;
// L'écart, en px, entre deux points d'essai dans la recherche d'un point du sol.
const MAILLE_PX = 20;

const uneImage = () => new Promise((resoudre) => requestAnimationFrame(resoudre));
const mediane = (valeurs) => statistiques(valeurs).medianeMs;

let contexte = null;
let montage = null;
const courbe = [];
let mesure = null;

const groupe = () => montage.racine.querySelector('[data-vue]');
const transformation = () => groupe().getAttribute('transform');
const kCourant = () => vueDepuisTransform(transformation()).k;
const plan = () => montage.racine.querySelector('svg[data-plan]');
const listes = () => montage.racine.querySelectorAll('[data-liste]').length;

// Ce qu'un appui saisirait au point : une table, une chaise, une poignée
// ou une pastille, sinon le sol du plan. Les listes ne reçoivent pas le
// pointeur.
function surLeSol(x, y) {
  const cible = document.elementFromPoint(x, y);
  return cible !== null && plan().contains(cible) && cible.closest('[data-table], [data-siege], [data-poignee], [data-pastille]') === null;
}

/**
 * Un point du sol du plan, le plus proche du centre de sa boîte, dont le
 * point à x + 150 et l'aller-retour restent dans le plan. Lève si la maille
 * n'en trouve aucun.
 * @returns {{x: number, y: number}}
 */
function pointDuSol() {
  const boite = plan().getBoundingClientRect();
  const cx = boite.left + boite.width / 2;
  const cy = boite.top + boite.height / 2;
  const candidats = [];
  for (let y = boite.top + MAILLE_PX; y < boite.bottom - MAILLE_PX; y += MAILLE_PX) {
    for (let x = boite.left + MAILLE_PX; x + PAS * PAS_PX < boite.right - MAILLE_PX; x += MAILLE_PX) {
      candidats.push({ x, y, d: Math.hypot(x - cx, y - cy) });
    }
  }
  candidats.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  const trouve = candidats.find(({ x, y }) => surLeSol(x, y));
  if (trouve === undefined) throw new Error(`aucun point du sol dans le plan à k ${kCourant()}`);
  return { x: trouve.x, y: trouve.y };
}

/**
 * Un glissement de PAS pas de PAS_PX px, horizontal, depuis depart, sens 1
 * vers la droite, -1 vers la gauche. Chaque pas attend que le transform du
 * groupe [data-vue] change, au plus IMAGES_PAR_PAS images, et lève sinon.
 */
async function glissement(depart, sens) {
  await pointer('presser', depart.x, depart.y);
  try {
    for (let i = 1; i <= PAS; i += 1) {
      const avant = transformation();
      await pointer('bouger', depart.x + sens * i * PAS_PX, depart.y);
      let images = 0;
      while (transformation() === avant) {
        if (images >= IMAGES_PAR_PAS) throw new Error(`le pas ${i} du glissement n’a pas déplacé la vue à k ${kCourant()}`);
        await uneImage();
        images += 1;
      }
    }
  } finally {
    await pointer('relacher', depart.x + sens * PAS * PAS_PX, depart.y);
  }
}

// Un cran de molette avant au centre du plan ; attend que la vue change.
async function cran() {
  const boite = plan().getBoundingClientRect();
  const avant = transformation();
  await molette(boite.left + boite.width / 2, boite.top + boite.height / 2, -100);
  for (let images = 0; transformation() === avant; images += 1) {
    if (images >= IMAGES_PAR_PAS) throw new Error('le cran de molette n’a pas zoomé');
    flushSync();
    await uneImage();
  }
}

// Le point de la courbe à k et à un ralentissement : trois glissements, un
// aller, un retour, un aller, chacun relevé par mesurerImages ; p95Ms est la
// médiane de leurs p95. Un dernier retour, sans ralentissement ni mesure,
// ramène la vue.
async function mesurerPoint(k, ralentissementCpu) {
  const depart = pointDuSol();
  const arrivee = { x: depart.x + PAS * PAS_PX, y: depart.y };
  await ralentirCpu(ralentissementCpu);
  const glissements = [];
  try {
    for (let rang = 0; rang < GLISSEMENTS; rang += 1) {
      const aller = rang % 2 === 0;
      glissements.push(statistiques(await mesurerImages(() => glissement(aller ? depart : arrivee, aller ? 1 : -1))));
    }
  } finally {
    await ralentirCpu(1);
  }
  // Un retour non mesuré : la vue revient où elle était, et la suite de la
  // courbe glisse sur le même morceau du plan.
  await glissement(arrivee, -1);
  return { k, ralentissementCpu, p95Ms: mediane(glissements.map(({ p95Ms }) => p95Ms)), glissements };
}

beforeAll(async () => {
  await controlerCadre();
  contexte = creerContexte();
  montage = await ouvrirEvenement(contexte, analyser(texteLivre('grande')).charge, { section: 'plan' });
});

afterEach(async () => {
  await ralentirCpu(1);
});

afterAll(async () => {
  await contexte?.defaire();
});

describe('le temps par image d’un glissement, listes à tout zoom (§ 19.10, § 17 point 6)', () => {
  test(`le registre de ce fichier porte K_LISTES à 0 : au zoom ajusté, sous la valeur du registre, les ${TABLES} listes sont là`, () => {
    expect(constante('K_LISTES')).toBe(0);
    const registre = CONSTANTES.find(({ nom }) => nom === 'K_LISTES').valeur;
    expect(kCourant()).toBeLessThan(registre);
    expect(montage.racine.querySelectorAll('[data-table]').length).toBe(TABLES);
    expect(listes()).toBe(TABLES);
  });

  test(`de l’ajusté à k ≥ ${K_FIN}, cran après cran : ${GLISSEMENTS} glissements de ${PAS} pas à ×1 et ×4, chaque pas déplace la vue, ${TABLES} listes à chaque k`, async () => {
    for (;;) {
      const k = kCourant();
      expect(listes(), `k ${k}`).toBe(TABLES);
      for (const ralentissementCpu of RALENTISSEMENTS) courbe.push(await mesurerPoint(k, ralentissementCpu));
      if (k >= K_FIN) break;
      await cran();
    }
    expect(courbe.length).toBeGreaterThanOrEqual(2 * RALENTISSEMENTS.length);
    for (const { glissements } of courbe) {
      for (const { images } of glissements) expect(images).toBeGreaterThanOrEqual(PAS);
    }
  });

  test('la courbe à ×4 donne le seuil et le verdict ; la mesure s’écrit dans scripts/banc/sorties/temps_image.json, relue telle quelle, et se range dans un relevé', async () => {
    const reference = courbe.filter(({ ralentissementCpu }) => ralentissementCpu === RALENTISSEMENT_REFERENCE);
    const seuil = seuilDepuisCourbe(reference, CRITERE_TEMPS_IMAGE_MS);
    mesure = {
      nom: NOM,
      unite: 'ms',
      valeurProposee: null,
      critere:
        `p95 du temps par image d’un glissement de ${PAS} pas, médiane de ${GLISSEMENTS} glissements, grande démonstration, ` +
        `${TABLES} listes dessinées à tout k ; tenu quand il vaut au plus ${CRITERE_TEMPS_IMAGE_MS} ms à ×${RALENTISSEMENT_REFERENCE}, ` +
        `à tout k de l’ajusté à ${K_FIN}`,
      critereMs: CRITERE_TEMPS_IMAGE_MS,
      ralentissementCpu: RALENTISSEMENT_REFERENCE,
      seuil,
      pireP95Ms: Math.max(...reference.map(({ p95Ms }) => p95Ms)),
      courbe,
      verdict: seuil.tenuPartout ? 'tenu' : 'nonTenu',
    };
    const objet = { format: 1, mesures: [mesure] };
    const releve = {
      format: 1,
      configuration: {
        cadre: { largeur: innerWidth, hauteur: innerHeight },
        facteurEchelle: devicePixelRatio,
        navigateur: null,
        node: null,
        processeursLogiques: null,
        ralentissementCpu: RALENTISSEMENT_REFERENCE,
        police: 'Noto Sans',
      },
      mesures: [mesure],
    };
    expect(verifierReleve(releve, CONSTANTES)).toEqual([]);
    await ecrireSortie('temps_image', objet);
    expect(JSON.parse(await commands.readFile('scripts/banc/sorties/temps_image.json'))).toEqual(objet);
  });
});
