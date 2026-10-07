// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves des entrées réelles (§ 7.3) et du cadre d'affichage (§ 19.4).
// Les entrées passent par CDP : Chromium les traite comme celles d'un
// périphérique, chaque événement relevé porte isTrusted vrai, et la capture
// du pointeur se pose — ce qu'un événement construit par la page n'obtient
// pas. Les coordonnées sont celles du cadre de l'épreuve.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { fixerCadre, glisser, molette, pointer, touche, toucher } from './entrees.js';

const SVG = 'http://www.w3.org/2000/svg';

let scene;
let cadreInitial;

beforeAll(() => {
  cadreInitial = { largeur: innerWidth, hauteur: innerHeight };
});

afterAll(async () => {
  await page.viewport(cadreInitial.largeur, cadreInitial.hauteur);
});

beforeEach(() => {
  scrollTo(0, 0);
  scene = document.createElement('div');
  document.body.append(scene);
});

afterEach(() => {
  scene.remove();
  scrollTo(0, 0);
});

// Un plan d'épreuve : un <svg> en touch-action: none, posé à 30 px du bord,
// qui porte deux rectangles côte à côte.
function monterPlan() {
  scene.innerHTML =
    `<svg xmlns="${SVG}" data-plan width="300" height="160" ` +
    'style="display: block; margin: 30px; touch-action: none">' +
    '<rect data-a x="0" y="0" width="150" height="160" fill="rgb(200, 220, 240)"/>' +
    '<rect data-b x="150" y="0" width="150" height="160" fill="rgb(240, 220, 200)"/></svg>';
  return scene.querySelector('[data-plan]');
}

function centre(element) {
  const boite = element.getBoundingClientRect();
  return { x: boite.left + boite.width / 2, y: boite.top + boite.height / 2 };
}

// Relève les événements des types donnés sur la cible, dans leur ordre.
function relever(cible, types) {
  const releves = [];
  for (const type of types) {
    cible.addEventListener(type, (e) => releves.push(e));
  }
  return releves;
}

describe('pointeur', () => {
  test('un presser réel permet setPointerCapture sur la racine <svg>', async () => {
    const plan = monterPlan();
    let capture = null;
    plan.addEventListener('pointerdown', (e) => {
      plan.setPointerCapture(e.pointerId);
      capture = { isTrusted: e.isTrusted, tenue: plan.hasPointerCapture(e.pointerId) };
    });
    const { x, y } = centre(plan.querySelector('[data-a]'));
    await pointer('presser', x, y);
    await pointer('relacher', x, y);
    expect(capture).toEqual({ isTrusted: true, tenue: true });
  });

  test('un pointerdown construit par la page ne permet pas la capture', () => {
    const plan = monterPlan();
    let capture = null;
    plan.addEventListener('pointerdown', (e) => {
      try {
        plan.setPointerCapture(e.pointerId);
      } catch {
        // Un identifiant qu'aucun pointeur actif ne porte lève NotFoundError.
      }
      capture = { isTrusted: e.isTrusted, tenue: plan.hasPointerCapture(e.pointerId) };
    });
    const { x, y } = centre(plan.querySelector('[data-a]'));
    plan.querySelector('[data-a]').dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: x, clientY: y, buttons: 1 }),
    );
    expect(capture).toEqual({ isTrusted: false, tenue: false });
  });

  for (const defile of [0, 400]) {
    test(`le centre d'un élément, pointé, l'atteint comme cible — page défilée de ${defile} px`, async () => {
      const plan = monterPlan();
      // Un espace sous le plan rend la page défilable, puis le plan descend
      // sous la marge défilée.
      plan.style.marginTop = `${30 + defile}px`;
      plan.style.marginBottom = '2000px';
      scrollTo(0, defile);
      expect(scrollY).toBe(defile);
      const releves = relever(plan, ['pointerdown', 'pointerup']);
      for (const cible of [plan.querySelector('[data-a]'), plan.querySelector('[data-b]')]) {
        const { x, y } = centre(cible);
        await pointer('presser', x, y);
        await pointer('relacher', x, y);
      }
      expect(releves.map((e) => [e.type, e.target.getAttribute('data-a') !== null ? 'a' : 'b', e.isTrusted])).toEqual([
        ['pointerdown', 'a', true],
        ['pointerup', 'a', true],
        ['pointerdown', 'b', true],
        ['pointerup', 'b', true],
      ]);
      const { x, y } = centre(plan.querySelector('[data-b]'));
      expect(releves[2].clientX).toBeCloseTo(x, 0);
      expect(releves[2].clientY).toBeCloseTo(y, 0);
    });
  }

  test("le cadre de l'épreuve décalé et réduit dans sa page : le centre visé reste atteint", async () => {
    // Le cadre de l'épreuve est une <iframe> de la page que pilote CDP ;
    // l'épreuve la déplace, la réduit et lui pose une bordure et un retrait
    // le temps de pointer, puis lui rend son style : les coordonnées du cadre
    // se convertissent à chaque appel, bordure et retrait compris.
    const iframe = window.frameElement;
    expect(iframe).not.toBeNull();
    const avant = iframe.getAttribute('style');
    iframe.style.transformOrigin = '0 0';
    iframe.style.transform = 'translate(37px, 23px) scale(0.5)';
    iframe.style.border = '5px solid';
    iframe.style.padding = '7px';
    try {
      const plan = monterPlan();
      const releves = relever(plan, ['pointerdown', 'pointerup']);
      const { x, y } = centre(plan.querySelector('[data-b]'));
      await pointer('presser', x, y);
      await pointer('relacher', x, y);
      expect(releves.map((e) => [e.type, e.target.getAttribute('data-b') !== null])).toEqual([
        ['pointerdown', true],
        ['pointerup', true],
      ]);
      expect(releves[0].clientX).toBeCloseTo(x, 0);
      expect(releves[0].clientY).toBeCloseTo(y, 0);
    } finally {
      if (avant === null) iframe.removeAttribute('style');
      else iframe.setAttribute('style', avant);
    }
  });

  test('le genre stylet livre pointerType pen, et boutons choisit le bouton pressé', async () => {
    const plan = monterPlan();
    plan.addEventListener('contextmenu', (e) => e.preventDefault());
    const releves = relever(plan, ['pointerdown', 'pointerup']);
    const { x, y } = centre(plan.querySelector('[data-a]'));
    await pointer('presser', x, y, { genre: 'stylet' });
    await pointer('relacher', x, y, { genre: 'stylet' });
    await pointer('presser', x, y, { boutons: 2 });
    await pointer('relacher', x, y);
    expect(releves.map((e) => [e.type, e.pointerType, e.button, e.buttons])).toEqual([
      ['pointerdown', 'pen', 0, 1],
      ['pointerup', 'pen', 0, 0],
      ['pointerdown', 'mouse', 2, 2],
      ['pointerup', 'mouse', 2, 0],
    ]);
  });

  test('molette livre un wheel au point, deltaY intact', async () => {
    const plan = monterPlan();
    const releves = relever(plan, ['wheel']);
    plan.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
    const { x, y } = centre(plan.querySelector('[data-b]'));
    await molette(x, y, 125);
    await molette(x, y, -40);
    expect(releves.length).toBe(2);
    expect(releves.map((e) => [e.deltaY, e.isTrusted])).toEqual([
      [125, true],
      [-40, true],
    ]);
    expect(releves[0].target.getAttribute('data-b')).not.toBeNull();
    expect(releves[0].clientX).toBeCloseTo(x, 0);
    expect(releves[0].clientY).toBeCloseTo(y, 0);
  });

  test("glisser sous capture livre un pointermove par pas, croissants, puis un pointerup au point d'arrivée", async () => {
    const plan = monterPlan();
    plan.addEventListener('pointerdown', (e) => plan.setPointerCapture(e.pointerId));
    const releves = relever(plan, ['pointerdown', 'pointermove', 'pointerup']);
    const depuis = centre(plan.querySelector('[data-a]'));
    // L'arrivée sort du plan : la capture garde les événements sur la racine.
    const vers = { x: depuis.x + 360, y: depuis.y + 40 };
    await glisser(depuis, vers, { pas: 6 });
    const mouvements = releves.filter((e) => e.type === 'pointermove');
    expect(releves[0].type).toBe('pointerdown');
    expect(mouvements.length).toBe(6);
    for (let i = 1; i < mouvements.length; i += 1) {
      expect(mouvements[i].clientX).toBeGreaterThan(mouvements[i - 1].clientX);
    }
    const fin = releves.at(-1);
    expect(fin.type).toBe('pointerup');
    expect(fin.clientX).toBeCloseTo(vers.x, 0);
    expect(fin.clientY).toBeCloseTo(vers.y, 0);
    expect(releves.every((e) => e.isTrusted)).toBe(true);
    expect(plan.hasPointerCapture(releves[0].pointerId)).toBe(false);
  });

  test('toucher sur un élément en touch-action: none livre pointerdown puis pointerup, de type touch', async () => {
    const plan = monterPlan();
    const releves = relever(plan, ['pointerdown', 'pointerup', 'pointercancel']);
    const { x, y } = centre(plan.querySelector('[data-b]'));
    await toucher('presser', [{ x, y }]);
    // L'intervalle d'une pression longue se pilote ici par l'horloge de
    // l'application : aucune attente réelle entre les deux.
    await toucher('relacher', []);
    expect(releves.map((e) => [e.type, e.pointerType, e.isTrusted])).toEqual([
      ['pointerdown', 'touch', true],
      ['pointerup', 'touch', true],
    ]);
    expect(releves[0].target.getAttribute('data-b')).not.toBeNull();
  });
});

describe('clavier', () => {
  test("touche('Escape') livre un keydown de key 'Escape'", async () => {
    const releves = relever(document, ['keydown', 'keyup']);
    await touche('Escape');
    expect(releves.map((e) => [e.type, e.key, e.isTrusted])).toEqual([
      ['keydown', 'Escape', true],
      ['keyup', 'Escape', true],
    ]);
  });

  test('une touche inconnue lève en la nommant', async () => {
    await expect(touche('Hyperespace')).rejects.toThrow(/Hyperespace/);
  });
});

describe('le cadre (§ 19.4)', () => {
  test('fixerCadre(1366, 700) pose innerWidth et innerHeight', async () => {
    await fixerCadre(1366, 700);
    expect([innerWidth, innerHeight]).toEqual([1366, 700]);
  });

  test('un poser qui retranche 17 px à la hauteur, comme une barre, est corrigé', async () => {
    await fixerCadre(1000, 600);
    const poses = [];
    const poser = async (largeur, hauteur) => {
      poses.push([largeur, hauteur]);
      await page.viewport(largeur, hauteur - 17);
    };
    await fixerCadre(1366, 700, { poser });
    expect([innerWidth, innerHeight]).toEqual([1366, 700]);
    expect(poses).toEqual([
      [1366, 700],
      [1366, 717],
    ]);
  });

  test('un poser sans effet lève en nommant la hauteur visée et la hauteur relue', async () => {
    await fixerCadre(1000, 600);
    const poser = async () => {};
    await expect(fixerCadre(1366, 700, { poser })).rejects.toThrow(/1366 × 700.*1000 × 600/);
  });
});
