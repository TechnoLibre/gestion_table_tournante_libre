// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le harnais du banc (§ 19.10, § 14.2) : avant de croire un temps par image,
// la mesure doit pouvoir le voir. Sur un plan vide, que rien ne charge, un
// glissement réel de 60 pas donne un p95 sous 16 ms — sinon la cadence
// d'images est bridée, et chaque intervalle se lit en marches de 16,7 ms.
// Une image chargée exprès de 50 ms se voit à 50 ms ou plus. Les deux
// contrôles se jouent sans ralentissement et sous le ralentissement de
// référence, ×4 (Q13 b). Chacun est montré capable de tomber : une cadence
// bridée, simulée par des images chargées de 20 ms, fait tomber le premier ;
// une charge qui ne s'applique pas fait tomber le second.
//
// Le cadre se vérifie d'abord : 1 366 × 700, facteur 1, sans mise à
// l'échelle par l'orchestrateur. La dernière épreuve écrit les statistiques
// relevées dans scripts/banc/sorties/harnais.json et les relit. Le contrôle
// du cadre est montré capable de tomber : sur un facteur d'échelle de 2, lu
// par le lecteur qu'il accepte, et sur le cadre de l'épreuve réellement mis
// à l'échelle 0,5 par sa page.
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { commands } from 'vitest/browser';
import { creerCharge } from '../../src/stockage/document.js';
import { centre, creerContexte, ouvrirEvenement } from '../../test/navigateur/ecrans.js';
import { glisser } from '../../test/navigateur/entrees.js';
import {
  CHARGE_MS,
  SEUIL_CADENCE_MS,
  chargerImages,
  controlerCadence,
  controlerCadre,
  controlerCharge,
  ecrireSortie,
  ralentirCpu,
} from './navigateur.js';

// Le nombre de pas d'un glissement mesuré (§ 19.10).
const PAS = 60;

// Le ralentissement de référence du banc (Q13 b).
const RALENTISSEMENTS = [1, 4];

// Un événement sans table : le plan vide.
const PLAN_VIDE = creerCharge({ id: 'banc-plan-vide', nom: 'Club des Merles', siegesParDefaut: 8, tours: 2 });

let contexte = null;
let montage = null;
const releves = [];

// La transformation de la vue du plan, que chaque pas d'un glissement change.
const transformation = () => montage.racine.querySelector('[data-vue]').getAttribute('transform');

// Un glissement de PAS pas sur le fond du plan, de part et d'autre de son
// centre ; lève si la vue n'a pas bougé : le geste n'aurait rien dessiné.
async function glissement() {
  const avant = transformation();
  const { x, y } = await centre(montage.racine.querySelector('[data-plan]'));
  await glisser({ x: x - 150, y }, { x: x + 150, y }, { pas: PAS });
  if (transformation() === avant) throw new Error('le glissement n’a pas déplacé la vue');
}

beforeAll(async () => {
  contexte = creerContexte();
  releves.push({ controle: 'cadre', ...(await controlerCadre()) });
  montage = await ouvrirEvenement(contexte, PLAN_VIDE, { section: 'plan' });
});

afterEach(async () => {
  await ralentirCpu(1);
});

afterAll(async () => {
  await contexte?.defaire();
});

describe('harnais du banc', () => {
  for (const ralentissement of RALENTISSEMENTS) {
    test(`ralenti ×${ralentissement} : un plan vide glissé de ${PAS} pas donne un p95 sous ${SEUIL_CADENCE_MS} ms`, async () => {
      await ralentirCpu(ralentissement);
      const stats = await controlerCadence(glissement);
      releves.push({ controle: 'cadence', ralentissement, ...stats });
      expect(stats.p95Ms).toBeLessThan(SEUIL_CADENCE_MS);
      expect(stats.images).toBeGreaterThanOrEqual(PAS);
    });

    test(`ralenti ×${ralentissement} : une image chargée de ${CHARGE_MS} ms se voit à ${CHARGE_MS} ms ou plus`, async () => {
      await ralentirCpu(ralentissement);
      const stats = await controlerCharge(glissement);
      releves.push({ controle: 'charge', ralentissement, ...stats });
      expect(stats.p95Ms).toBeGreaterThanOrEqual(CHARGE_MS);
    });
  }

  test('le contrôle de cadence tombe sur une cadence bridée, simulée par des images chargées de 20 ms', async () => {
    const arreter = chargerImages(20);
    try {
      await expect(controlerCadence(glissement)).rejects.toThrow(/^cadence bridée : p95 \d/);
    } finally {
      arreter();
    }
  });

  test('le contrôle de charge tombe quand la charge ne s’applique pas', async () => {
    await expect(controlerCharge(glissement, { charger: () => () => {} })).rejects.toThrow(/^image chargée de 50 ms vue à \d/);
  });

  test('le contrôle du cadre tombe sur un facteur d’échelle autre que 1', async () => {
    await expect(controlerCadre({ lireFacteur: () => 2 })).rejects.toThrow(/^facteur d’échelle 2, attendu 1$/);
  });

  test('le contrôle du cadre tombe sur un cadre que la page qui le porte met à l’échelle', async () => {
    const element = window.frameElement;
    const avant = element.style.transform;
    element.style.transform = 'scale(0.5)';
    try {
      await expect(controlerCadre()).rejects.toThrow(/^cadre mis à l’échelle 0\.5 par la page qui le porte$/);
    } finally {
      element.style.transform = avant;
    }
    await expect(controlerCadre()).resolves.toEqual({ largeur: 1366, hauteur: 700, facteurEchelle: 1 });
  });

  test('ecrireSortie refuse un nom hors de [a-z0-9_]', async () => {
    for (const nom of ['', '../harnais', 'harnais.json', 'Harnais', 'temps image']) {
      await expect(ecrireSortie(nom, {})).rejects.toThrow(RangeError);
    }
  });

  test('les relevés du harnais s’écrivent dans scripts/banc/sorties/harnais.json, relus tels quels', async () => {
    expect(releves.map(({ controle }) => controle)).toEqual(['cadre', 'cadence', 'charge', 'cadence', 'charge']);
    const objet = { format: 1, releves };
    await ecrireSortie('harnais', objet);
    expect(JSON.parse(await commands.readFile('scripts/banc/sorties/harnais.json'))).toEqual(objet);
  });
});
