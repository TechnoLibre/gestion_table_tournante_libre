// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le gain parallèle de la génération (§ 5.10, Q14) : la durée t(W) d'une
// génération de W propositions sur W travailleurs, une seule vague, par
// l'exécuteur de production — creerExecuteurTravailleur et le travailleur
// inclus dans la page, celui que src/main.js construit —, dans Chromium. Le
// poste annonce L processeurs logiques (navigator.hardwareConcurrency, par
// coeursDe) ; W parcourt 1, 2, 4, … jusqu'à L, et L lui-même. Le
// ralentissement ρ(W) = t(W) / t(1) d'un cœur chargé en sort, et ρ(L) est la
// valeur proposée pour RALENTISSEMENT_PLEINE_CHARGE : le banc l'écrit dans
// sa sortie, jamais dans le registre (décision 6).
//
// Chaque génération part de la grande démonstration, graine 1, arret
// 200 000 : la configuration et le compte que l'opérateur emploie. Les
// répétitions alternent les W — une ronde passe chaque W une fois —, de
// sorte qu'une dérive de la machine pèse sur tous ; t(W) est la médiane de
// ses répétitions. Un ralentissement ne décroît pas quand W croît : des
// médianes qui décroissent disent une mesure bruitée, qui gagne une ronde
// de plus et se signale « bruite » dans la sortie. La durée d'une génération
// d'un travailleur neuf compte sa naissance : c'est celle que l'opérateur
// attend.
//
// La sortie, scripts/banc/sorties/parallele.json, a la forme d'un relevé
// (releve.js) que verifierReleve accepte : la configuration ne nomme pas
// la machine, seulement ses processeurs logiques. Elle porte la courbe
// t(W), ρ(W) et le ρ du modèle de l'estimation à la même pleine charge, le
// ρ proposé, et la durée de la génération par défaut sur min(5, L) cœurs,
// qui situe le « bien en deçà » du plafond d'usage (§ 5.10).
//
// Une horloge réelle se lit ici, performance.now, pour mesurer seulement :
// la sortie ne porte que des durées.
import { beforeAll, describe, expect, test } from 'vitest';
import { commands } from 'vitest/browser';
import { configurationDe } from '../../src/application/configuration.js';
import { creerExecuteurTravailleur } from '../../src/application/executeur_travailleur.js';
import { coeursDe, ralentissement } from '../../src/application/generation.js';
import { texteLivre } from '../../src/demo/livrees.js';
import Travailleur from '../../src/interface/generation/travailleur.js?worker&inline';
import { GENERATION_PAR_DEFAUT, analyser } from '../../src/stockage/document.js';
import { controlerCadre, ecrireSortie, ralentirCpu } from './navigateur.js';
import { verifierReleve } from './releve.js';

// Le compte d'arrêt et la graine de chaque génération mesurée.
const ARRET = 200_000;
const GRAINE = 1;

// Les rondes de mesure, et la ronde de plus d'une mesure bruitée.
const REPETITIONS = 3;

// La grande démonstration, comme la génération la lit : animateurs compris.
const CONFIGURATION = configurationDe(analyser(texteLivre('grande')).charge);

// Les processeurs logiques du poste, tels que l'exécuteur de production les lit.
const L = coeursDe(navigator.hardwareConcurrency);

let cadre = null;
// Par W, les durées de ses répétitions, en ms, dans l'ordre des rondes.
const durees = new Map();
let bruite = false;
let parDefaut = null;

/**
 * Les nombres de cœurs mesurés : les puissances de 2 sous L, puis L.
 * @param {number} l
 * @returns {number[]}
 */
function coeursMesures(l) {
  const liste = [];
  for (let w = 1; w < l; w *= 2) liste.push(w);
  liste.push(l);
  return liste;
}

const mediane = (valeurs) => {
  const triees = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(triees.length / 2);
  return triees.length % 2 === 1 ? triees[milieu] : (triees[milieu - 1] + triees[milieu]) / 2;
};

// Vrai quand chaque valeur est au moins la précédente.
const nonDecroissante = (valeurs) => valeurs.every((valeur, rang) => rang === 0 || valeur >= valeurs[rang - 1]);

// Une durée au dixième de milliseconde, un rapport au millième.
const dixieme = (ms) => Math.round(ms * 10) / 10;
const millieme = (rapport) => Math.round(rapport * 1000) / 1000;

/**
 * La durée murale d'une génération de reglages sur coeurs travailleurs
 * neufs, en ms, de lancer à la dernière proposition rendue. Lève quand
 * l'exécution n'emploie pas coeurs travailleurs ou ne rend pas une
 * proposition par rang : la mesure ne serait pas celle de W.
 *
 * @param {number} coeurs
 * @param {{graine: number, nombre: number, arret: number, historique: number}} reglages
 * @returns {Promise<number>}
 */
async function dureeGeneration(coeurs, reglages) {
  const executeur = creerExecuteurTravailleur(() => new Travailleur(), { coeursDisponibles: L });
  const debut = performance.now();
  const execution = executeur.lancer(CONFIGURATION, reglages, { coeurs });
  const propositions = await execution.resultat;
  const duree = performance.now() - debut;
  if (execution.coeurs !== coeurs) throw new Error(`${execution.coeurs} travailleurs employés, ${coeurs} attendus`);
  if (propositions.length !== reglages.nombre) {
    throw new Error(`${propositions.length} propositions rendues, ${reglages.nombre} attendues`);
  }
  return duree;
}

const reglagesSur = (nombre) => ({ graine: GRAINE, nombre, arret: ARRET, historique: GENERATION_PAR_DEFAUT.historique });

// Une ronde : chaque W une fois, dans l'ordre croissant.
async function ronde() {
  for (const w of coeursMesures(L)) durees.get(w).push(await dureeGeneration(w, reglagesSur(w)));
}

const medianes = () => coeursMesures(L).map((w) => mediane(durees.get(w)));

beforeAll(async () => {
  cadre = await controlerCadre();
  await ralentirCpu(1);
  for (const w of coeursMesures(L)) durees.set(w, []);
  // Une génération d'échauffement, hors mesure : le premier travailleur
  // compile son module.
  await dureeGeneration(1, reglagesSur(1));
});

describe('banc : le gain parallèle de la génération (§ 5.10, Q14)', () => {
  test('les cœurs mesurés : les puissances de 2 sous L, puis L ; un seul sur un seul processeur', () => {
    expect(coeursMesures(1)).toEqual([1]);
    expect(coeursMesures(2)).toEqual([1, 2]);
    expect(coeursMesures(6)).toEqual([1, 2, 4, 6]);
    expect(coeursMesures(16)).toEqual([1, 2, 4, 8, 16]);
  });

  test('une mesure bruitée se reconnaît : des médianes qui décroissent', () => {
    expect(nonDecroissante([300, 300, 310, 420])).toBe(true);
    expect(nonDecroissante([300, 290, 310])).toBe(false);
    expect(mediane([5, 1, 3])).toBe(3);
    expect(mediane([4, 1, 3, 2])).toBe(2.5);
  });

  test(`t(W) pour W de 1 à L, ${REPETITIONS} répétitions, une de plus si bruité : ρ(1) = 1, ρ(W) = t(W) / t(1)`, async () => {
    for (let rang = 0; rang < REPETITIONS; rang += 1) await ronde();
    if (!nonDecroissante(medianes())) {
      bruite = true;
      await ronde();
    }
    const t = medianes();
    expect(t.every((ms) => Number.isFinite(ms) && ms > 0)).toBe(true);
    for (const w of coeursMesures(L)) expect(durees.get(w).length).toBe(bruite ? REPETITIONS + 1 : REPETITIONS);
  });

  test('la génération par défaut, sur min(nombre, L) cœurs : sa durée médiane', async () => {
    const coeurs = Math.min(GENERATION_PAR_DEFAUT.nombre, L);
    const reglages = { ...GENERATION_PAR_DEFAUT, graine: GRAINE };
    const releves = [];
    for (let rang = 0; rang < REPETITIONS; rang += 1) releves.push(await dureeGeneration(coeurs, reglages));
    parDefaut = { coeurs, dureesMs: releves.map(dixieme), medianeMs: dixieme(mediane(releves)) };
    expect(parDefaut.medianeMs).toBeGreaterThan(0);
  });

  test('parallele.json : un relevé que verifierReleve accepte, écrit dans scripts/banc/sorties et relu tel quel', async () => {
    expect(parDefaut).not.toBeNull();
    const t = medianes();
    const rhoPleineCharge = t.at(-1) / t[0];
    const courbe = coeursMesures(L).map((w, rang) => ({
      coeurs: w,
      dureesMs: durees.get(w).map(dixieme),
      medianeMs: dixieme(t[rang]),
      ralentissement: millieme(t[rang] / t[0]),
      modele: millieme(ralentissement(w, L, rhoPleineCharge)),
    }));
    const sortie = {
      format: 1,
      configuration: {
        cadre: { largeur: cadre.largeur, hauteur: cadre.hauteur },
        facteurEchelle: cadre.facteurEchelle,
        navigateur: null,
        node: null,
        processeursLogiques: L,
        ralentissementCpu: 1,
        police: null,
      },
      mesures: [
        {
          nom: 'RALENTISSEMENT_PLEINE_CHARGE',
          unite: '×',
          valeurProposee: Math.round(rhoPleineCharge * 100) / 100,
          critere:
            `t(L) / t(1), médianes de ${REPETITIONS} répétitions ou plus : une génération de W propositions ` +
            `sur W travailleurs, grande démonstration, arret ${ARRET}, graine ${GRAINE}`,
          courbe,
          bruite,
        },
        {
          nom: 'DUREE_GENERATION_PAR_DEFAUT',
          unite: 'ms',
          valeurProposee: parDefaut.medianeMs,
          critere:
            `médiane de ${REPETITIONS} générations au réglage par défaut, ${GENERATION_PAR_DEFAUT.nombre} × ` +
            `${GENERATION_PAR_DEFAUT.arret} mouvements sur ${parDefaut.coeurs} travailleurs, grande démonstration`,
          courbe: [parDefaut],
        },
      ],
      parallele: courbe,
    };
    expect(courbe[0]).toMatchObject({ coeurs: 1, ralentissement: 1, modele: 1 });
    expect(courbe.at(-1)).toMatchObject({ coeurs: L, modele: millieme(rhoPleineCharge) });
    expect(verifierReleve(sortie)).toEqual([]);
    await ecrireSortie('parallele', sortie);
    expect(JSON.parse(await commands.readFile('scripts/banc/sorties/parallele.json'))).toEqual(sortie);
  });
});
