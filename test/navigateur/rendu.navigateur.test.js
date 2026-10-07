// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves des aides de rendu (§ 14.2, § 14.5) dans un vrai moteur de rendu.
// Chaque épreuve monte un petit fragment HTML ou SVG aux couleurs inventées,
// lit ce que l'aide en rend et le confronte à ce que le fragment déclare. Le
// projet navigateur emploie expect, test et describe de Vitest.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  ascendance,
  attenuations,
  composantes,
  contraste,
  couleursPeintes,
  couleurTexte,
  designation,
  fondPeintSous,
  porteursDeTexte,
  sousTheme,
  visible,
} from './rendu.js';
import { contraste as contrastePalette } from '../../src/interface/palette.js';

const SVG = 'http://www.w3.org/2000/svg';

let scene;
let feuille;

beforeEach(() => {
  scene = document.createElement('div');
  scene.setAttribute('data-scene', '');
  document.body.append(scene);
});

afterEach(() => {
  scene.remove();
  feuille?.remove();
  feuille = undefined;
});

// Monte le fragment dans la scène et rend la scène.
function monter(html) {
  scene.innerHTML = html;
  return scene;
}

// Pose une feuille de style dans <head> : un pseudo-élément ne se déclare
// que par une règle.
function regles(texte) {
  feuille = document.createElement('style');
  feuille.textContent = texte;
  document.head.append(feuille);
}

const $ = (selecteur) => scene.querySelector(selecteur);

describe('composantes', () => {
  test('lit rgb(…) et rgba(…)', () => {
    expect(composantes('rgb(12, 34, 56)')).toEqual([12, 34, 56, 1]);
    expect(composantes('rgba(12, 34, 56, 0.5)')).toEqual([12, 34, 56, 0.5]);
    expect(composantes('rgba(0, 0, 0, 0)')).toEqual([0, 0, 0, 0]);
  });

  test('lève sur une forme inconnue', () => {
    for (const forme of ['hsl(0 0% 0%)', 'none', 'url("#motif")', 'rouge', '']) {
      expect(() => composantes(forme), forme).toThrow(/couleur/);
    }
  });

  test('contraste est celui de palette.js', () => {
    expect(contraste).toBe(contrastePalette);
  });
});

describe('ascendance et designation', () => {
  test("l'ascendance d'un élément SVG remonte jusqu'à <html>", () => {
    monter(`<svg xmlns="${SVG}"><g><text x="5" y="15">Iris</text></g></svg>`);
    const chaine = ascendance($('text'));
    expect(chaine.map((n) => n.localName).slice(0, 4)).toEqual(['text', 'g', 'svg', 'div']);
    expect(chaine.at(-1)).toBe(document.documentElement);
  });

  test('designation nomme la balise, les attributs data-… et les classes', () => {
    monter('<span class="nom gras" data-participant="7" data-actif>Théo</span><b>x</b>');
    expect(designation($('span'))).toBe('span[data-participant="7"][data-actif].nom.gras');
    expect(designation($('b'))).toBe('b');
    expect(designation({ element: $('span'), pseudo: '::before' })).toBe(
      'span[data-participant="7"][data-actif].nom.gras::before',
    );
  });
});

describe('porteursDeTexte', () => {
  test('rend les éléments à texte non vide, HTML et SVG, dans leur ordre', () => {
    monter(
      `<p>Ondine <em>Lacasse</em></p><div>  <span> </span></div>` +
        `<svg xmlns="${SVG}"><title>bulle</title><text x="0" y="10">Grisaille</text></svg>`,
    );
    const porteurs = porteursDeTexte(scene);
    expect(porteurs.length).toBe(3);
    expect(porteurs.map((p) => p.element.localName)).toEqual(['p', 'em', 'text']);
    expect(porteurs.every((p) => p.pseudo === null)).toBe(true);
  });

  test('rend un ::before à content comme porteur, pas un ::after à content vide', () => {
    regles(
      '[data-scene] .epreuve-marque::before { content: "→ "; }' +
        '[data-scene] .epreuve-marque::after { content: ""; }',
    );
    monter('<span class="epreuve-marque"></span>');
    expect(porteursDeTexte(scene)).toEqual([{ element: $('span'), pseudo: '::before' }]);
  });

  test("un pseudo-élément dont content n'est qu'un blanc n'est pas un porteur", () => {
    regles(
      '[data-scene] .epreuve-blanc::before { content: " "; }' +
        '[data-scene] .epreuve-blanc::after { content: "\\a0"; }',
    );
    monter('<span class="epreuve-blanc">a</span>');
    expect(porteursDeTexte(scene)).toEqual([{ element: $('span'), pseudo: null }]);
  });
});

describe('couleurTexte', () => {
  test("lit color d'un élément HTML et fill d'un <text> SVG", () => {
    monter(
      `<span style="color: rgb(40, 50, 60)">Iris</span>` +
        `<svg xmlns="${SVG}"><text x="0" y="10" fill="rgb(70, 80, 90)" style="color: rgb(1, 1, 1)">Ombrelle</text></svg>`,
    );
    expect(couleurTexte({ element: $('span'), pseudo: null })).toEqual([40, 50, 60, 1]);
    expect(couleurTexte({ element: $('text'), pseudo: null })).toEqual([70, 80, 90, 1]);
    expect(couleurTexte($('span'))).toEqual([40, 50, 60, 1]);
  });
});

describe('couleursPeintes', () => {
  test('un motif de hachure rend les deux couleurs que peignent ses enfants', () => {
    monter(
      `<svg xmlns="${SVG}" width="80" height="80"><defs>` +
        `<pattern id="epreuve-hachure" width="8" height="8" patternUnits="userSpaceOnUse">` +
        `<rect width="8" height="8" fill="rgb(250, 240, 200)"/>` +
        `<path d="M0 8 L8 0" fill="none" stroke="rgb(20, 30, 90)"/>` +
        `</pattern></defs>` +
        `<rect data-forme width="80" height="80" fill="url(#epreuve-hachure)" stroke="rgb(1, 2, 3)"/></svg>`,
    );
    expect(couleursPeintes($('[data-forme]'))).toEqual({
      fill: [
        [250, 240, 200, 1],
        [20, 30, 90, 1],
      ],
      stroke: [[1, 2, 3, 1]],
    });
  });

  test('un remplissage plein rend sa couleur, none et transparent ne rendent rien', () => {
    monter(
      `<svg xmlns="${SVG}"><circle data-a r="5" cx="5" cy="5" fill="rgb(9, 8, 7)"/>` +
        `<circle data-b r="5" cx="5" cy="5" fill="none" stroke="transparent"/></svg>`,
    );
    expect(couleursPeintes($('[data-a]'))).toEqual({ fill: [[9, 8, 7, 1]], stroke: [] });
    expect(couleursPeintes($('[data-b]'))).toEqual({ fill: [], stroke: [] });
  });

  test('une hachure groupée dans un <g> : les couleurs de ses formes, pas le noir du groupe', () => {
    monter(
      `<svg xmlns="${SVG}" width="80" height="80"><defs>` +
        `<pattern id="epreuve-hachure-groupee" width="8" height="8" patternUnits="userSpaceOnUse"><g>` +
        `<rect width="8" height="8" fill="rgb(250, 240, 200)"/>` +
        `<path d="M0 8 L8 0" fill="none" stroke="rgb(20, 30, 90)"/>` +
        `<rect width="2" height="2" fill="rgb(7, 7, 7)" style="display: none"/>` +
        `</g></pattern></defs>` +
        `<rect data-forme width="80" height="80" fill="url(#epreuve-hachure-groupee)"/></svg>`,
    );
    expect(couleursPeintes($('[data-forme]')).fill).toEqual([
      [250, 240, 200, 1],
      [20, 30, 90, 1],
    ]);
  });

  test("une ligne ne peint que son trait : le noir par défaut de son fill n'est compté ni seul, ni dans un motif", () => {
    monter(
      `<svg xmlns="${SVG}" width="80" height="80"><defs>` +
        `<pattern id="epreuve-hachure-ligne" width="8" height="8" patternUnits="userSpaceOnUse">` +
        `<rect width="8" height="8" fill="rgb(250, 240, 200)"/>` +
        `<line x1="4" y1="0" x2="4" y2="8" stroke="rgb(20, 30, 90)" stroke-width="3"/>` +
        `</pattern></defs>` +
        `<line data-ligne x1="0" y1="0" x2="80" y2="80" stroke="rgb(60, 70, 80)"/>` +
        `<rect data-forme width="80" height="80" fill="url(#epreuve-hachure-ligne)"/></svg>`,
    );
    expect(getComputedStyle($('[data-ligne]')).fill).toBe('rgb(0, 0, 0)');
    expect(couleursPeintes($('[data-ligne]'))).toEqual({ fill: [], stroke: [[60, 70, 80, 1]] });
    expect(couleursPeintes($('[data-forme]')).fill).toEqual([
      [250, 240, 200, 1],
      [20, 30, 90, 1],
    ]);
  });
});

describe('fondPeintSous', () => {
  test("un cercle posé sur un rectangle rempli : le remplissage du rectangle", () => {
    monter(
      `<div style="background: rgb(255, 255, 255)"><svg xmlns="${SVG}" width="200" height="100">` +
        `<rect width="200" height="100" fill="rgb(200, 220, 240)"/>` +
        `<circle data-pastille cx="100" cy="50" r="20" fill="rgb(10, 10, 10)"/></svg></div>`,
    );
    expect(fondPeintSous($('[data-pastille]'))).toEqual([[200, 220, 240, 1]]);
  });

  test('un texte SVG sur un rectangle hachuré : chaque couleur du motif', () => {
    monter(
      `<svg xmlns="${SVG}" width="200" height="100"><defs>` +
        `<pattern id="epreuve-hachure-fond" width="8" height="8" patternUnits="userSpaceOnUse">` +
        `<rect width="8" height="8" fill="rgb(250, 240, 200)"/>` +
        `<path d="M0 8 L8 0" fill="none" stroke="rgb(20, 30, 90)"/></pattern></defs>` +
        `<rect x="10" y="10" width="180" height="80" fill="url(#epreuve-hachure-fond)"/>` +
        `<text x="40" y="55" fill="rgb(0, 0, 0)">Pervenche</text></svg>`,
    );
    expect(fondPeintSous({ element: $('text'), pseudo: null })).toEqual([
      [250, 240, 200, 1],
      [20, 30, 90, 1],
    ]);
  });

  test('seules comptent les formes qui précèdent la cible : un rectangle peint après elle ne la porte pas', () => {
    monter(
      `<svg xmlns="${SVG}" width="200" height="100">` +
        `<rect data-a width="200" height="100" fill="rgb(200, 220, 240)"/>` +
        `<circle data-pastille cx="100" cy="50" r="20" fill="rgb(10, 10, 10)"/>` +
        `<rect data-b width="200" height="100" fill="rgb(120, 40, 60)"/></svg>`,
    );
    expect(fondPeintSous($('[data-pastille]'))).toEqual([[200, 220, 240, 1]]);
  });

  // Chaque cas rend translucide la forme posée sur le rectangle noir ; la
  // couleur peinte n'est plus la couleur calculée, et l'aide lève en nommant
  // la forme plutôt que de rendre un blanc que l'écran ne montre pas.
  const TRANSLUCIDES = [
    ['fill-opacity', 'fill="rgb(255, 255, 255)" fill-opacity="0.2"', '', /fill-opacity/],
    ['opacity', 'fill="rgb(255, 255, 255)" opacity="0.2"', '', /opacity/],
    ['un alpha de couleur', 'fill="rgba(255, 255, 255, 0.2)"', '', /fill/],
    ["l'opacity d'un groupe", 'fill="rgb(255, 255, 255)"', 'opacity="0.2"', /opacity/],
  ];
  for (const [nom, attributs, groupe, attendu] of TRANSLUCIDES) {
    test(`une forme translucide (${nom}) sur une forme opaque : lève en nommant la forme`, () => {
      monter(
        `<svg xmlns="${SVG}" width="200" height="100">` +
          `<rect width="200" height="100" fill="rgb(0, 0, 0)"/>` +
          `<g ${groupe}><rect data-voile width="200" height="100" ${attributs}/></g>` +
          `<text x="60" y="55" fill="rgb(0, 0, 0)">Iris</text></svg>`,
      );
      expect(() => fondPeintSous($('text'))).toThrow(attendu);
      expect(() => fondPeintSous($('text'))).toThrow(/rect\[data-voile\]/);
    });
  }

  test("un motif dont une forme est translucide, un dégradé à arrêt translucide : lève en les nommant", () => {
    monter(
      `<svg xmlns="${SVG}" width="200" height="200"><defs>` +
        `<pattern id="epreuve-motif-voile" width="8" height="8" patternUnits="userSpaceOnUse">` +
        `<rect data-maille width="8" height="8" fill="rgb(250, 240, 200)" fill-opacity="0.5"/></pattern>` +
        `<linearGradient id="epreuve-degrade-voile"><stop offset="0" stop-color="rgb(250, 240, 200)"/>` +
        `<stop offset="1" stop-color="rgb(20, 30, 90)" stop-opacity="0.5"/></linearGradient></defs>` +
        `<rect width="200" height="100" fill="url(#epreuve-motif-voile)"/>` +
        `<rect y="100" width="200" height="100" fill="url(#epreuve-degrade-voile)"/>` +
        `<text data-haut x="60" y="55" fill="rgb(0, 0, 0)">Iris</text>` +
        `<text data-bas x="60" y="155" fill="rgb(0, 0, 0)">Théo</text></svg>`,
    );
    expect(() => fondPeintSous($('[data-haut]'))).toThrow(/rect\[data-maille\] fill-opacity: 0\.5/);
    expect(() => fondPeintSous($('[data-bas]'))).toThrow(/stop stop-opacity: 0\.5/);
  });

  test('un élément SVG sans forme dessous : le premier fond HTML opaque', () => {
    monter(
      `<div style="background: rgb(230, 240, 250)"><div><svg xmlns="${SVG}" width="200" height="100">` +
        `<rect width="40" height="40" fill="rgb(1, 1, 1)"/>` +
        `<text x="100" y="60">Grisaille</text></svg></div></div>`,
    );
    expect(fondPeintSous($('text'))).toEqual([[230, 240, 250, 1]]);
  });

  test("un texte HTML sans fond : le premier fond opaque de son ascendance", () => {
    monter(
      '<div style="background: rgb(250, 250, 240)"><p style="background: rgba(0, 0, 0, 0.5)">' +
        '<span>Club des Merles</span></p></div>',
    );
    expect(fondPeintSous($('span'))).toEqual([[250, 250, 240, 1]]);
  });

  test('un texte HTML posé sur un rect SVG frère : le remplissage du rect, pas le fond de la surface', () => {
    monter(
      '<div style="background: rgb(255, 255, 255); position: relative; height: 100px">' +
        `<svg xmlns="${SVG}" width="200" height="100" style="display: block"><rect width="200" height="100" fill="rgb(0, 0, 0)"/></svg>` +
        '<span style="position: absolute; left: 10px; top: 10px">Iris</span></div>',
    );
    expect(fondPeintSous($('span'))).toEqual([[0, 0, 0, 1]]);
  });

  test('un texte HTML sur un div frère absolu : le fond du frère, même en pointer-events: none', () => {
    monter(
      '<div style="background: rgb(255, 255, 255); position: relative; height: 100px">' +
        '<div data-plateau style="position: absolute; inset: 0; background: rgb(0, 0, 0); pointer-events: none"></div>' +
        '<span style="position: absolute; left: 10px; top: 10px; pointer-events: none">Iris</span></div>',
    );
    expect(fondPeintSous($('span'))).toEqual([[0, 0, 0, 1]]);
  });

  test('un texte HTML sur un frère opaque mais à opacity 0,2 : lève en nommant le frère', () => {
    monter(
      '<div style="background: rgb(255, 255, 255); position: relative; height: 100px">' +
        '<div data-plateau style="position: absolute; inset: 0; background: rgb(0, 0, 0); opacity: 0.2"></div>' +
        '<span style="position: absolute; left: 10px; top: 10px">Iris</span></div>',
    );
    expect(() => fondPeintSous($('span'))).toThrow(/div\[data-plateau\].*opacity/);
  });

  test('un texte HTML hors de la fenêtre : lève, rien ne se lit sous un point hors champ', () => {
    monter('<span style="position: fixed; left: -500px; top: 0">Iris</span>');
    expect(() => fondPeintSous($('span'))).toThrow(/fenêtre/);
  });

  test("le fond CSS du <svg> extérieur, sous un texte SVG sans forme dessous", () => {
    monter(
      `<div style="background: rgb(255, 255, 255)"><svg xmlns="${SVG}" width="200" height="100" ` +
        `style="display: block; background: rgb(0, 0, 0)"><text x="60" y="55" fill="rgb(0, 0, 0)">Iris</text></svg></div>`,
    );
    expect(fondPeintSous($('text'))).toEqual([[0, 0, 0, 1]]);
  });

  test("un recouvrement peint après un texte HTML, en pointer-events: none, n'est pas dessous", () => {
    monter(
      '<div style="background: rgb(255, 255, 255); position: relative; height: 100px">' +
        '<span style="position: absolute; left: 10px; top: 10px">Iris</span>' +
        '<div data-voile style="position: absolute; inset: 0; background: rgb(0, 0, 0); pointer-events: none"></div></div>',
    );
    expect(fondPeintSous($('span'))).toEqual([[255, 255, 255, 1]]);
  });

  test("un recouvrement HTML peint après le dessin n'est pas sous un texte SVG", () => {
    monter(
      '<div style="background: rgb(255, 255, 255); position: relative; height: 100px">' +
        `<svg xmlns="${SVG}" width="200" height="100" style="display: block"><text x="60" y="55">Iris</text></svg>` +
        '<div data-voile style="position: absolute; inset: 0; background: rgb(0, 0, 0); pointer-events: none"></div></div>',
    );
    expect(fondPeintSous($('text'))).toEqual([[255, 255, 255, 1]]);
  });

  test("un descendant à fond opaque qui couvre le centre d'un texte HTML n'est pas dessous", () => {
    monter(
      '<div style="background: rgb(255, 255, 255)"><p style="position: relative">Iris' +
        '<b style="position: absolute; inset: 0; background: rgb(0, 0, 0)"></b></p></div>',
    );
    expect(fondPeintSous($('p'))).toEqual([[255, 255, 255, 1]]);
  });

  test("une forme peinte après un texte SVG sans forme dessous n'est pas dessous", () => {
    monter(
      `<div style="background: rgb(255, 255, 255)"><svg xmlns="${SVG}" width="200" height="100" style="display: block">` +
        `<text x="60" y="55">Iris</text><rect width="200" height="100" fill="rgb(0, 0, 0)"/></svg></div>`,
    );
    expect(fondPeintSous($('text'))).toEqual([[255, 255, 255, 1]]);
  });

  test("un texte que son centre n'atteint pas : lève en le nommant", () => {
    monter('<div style="background: rgb(255, 255, 255)"><span data-cache style="visibility: hidden">Iris</span></div>');
    expect(() => fondPeintSous($('span'))).toThrow(/span\[data-cache\].*n'atteint pas/);
  });

  // Chaque cas pose, entre le rectangle clair et le texte, une forme qui ne
  // peint rien au centre : l'aide la saute et rend le rectangle clair.
  const SANS_PEINTURE = [
    ['opacity 0', '<rect width="200" height="100" fill="rgb(0, 0, 0)" opacity="0"/>'],
    ['fill-opacity 0', '<rect width="200" height="100" fill="rgb(0, 0, 0)" fill-opacity="0"/>'],
    ['visibility hidden', '<rect width="200" height="100" fill="rgb(0, 0, 0)" visibility="hidden"/>'],
    ['maille d’un <pattern>', '<pattern id="epreuve-maille" width="200" height="100" patternUnits="userSpaceOnUse"><rect width="200" height="100" fill="rgb(0, 0, 0)"/></pattern>'],
  ];
  for (const [nom, forme] of SANS_PEINTURE) {
    test(`une forme qui ne peint rien au centre (${nom}) n'est pas dessous`, () => {
      monter(
        `<svg xmlns="${SVG}" width="200" height="100"><rect width="200" height="100" fill="rgb(200, 220, 240)"/>` +
          `${forme}<text x="60" y="55" fill="rgb(0, 0, 0)">Iris</text></svg>`,
      );
      expect(fondPeintSous($('text'))).toEqual([[200, 220, 240, 1]]);
    });
  }

  test("un frère HTML à opacity 0 sous un texte HTML ne peint rien", () => {
    monter(
      '<div style="background: rgb(255, 255, 255); position: relative; height: 100px">' +
        '<div style="position: absolute; inset: 0; background: rgb(0, 0, 0); opacity: 0"></div>' +
        '<span style="position: absolute; left: 10px; top: 10px">Iris</span></div>',
    );
    expect(fondPeintSous($('span'))).toEqual([[255, 255, 255, 1]]);
  });

  test('une forme peinte par <use> sous un texte SVG : lève en nommant le <use>', () => {
    monter(
      `<div style="background: rgb(255, 255, 255)"><svg xmlns="${SVG}" width="200" height="100">` +
        `<defs><rect id="epreuve-plateau" width="200" height="100" fill="rgb(0, 0, 0)"/></defs>` +
        `<use data-plateau href="#epreuve-plateau"/><text x="60" y="55" fill="rgb(255, 255, 255)">Iris</text></svg></div>`,
    );
    expect(() => fondPeintSous($('text'))).toThrow(/use\[data-plateau\]/);
  });

  test('un texte HTML posé sur un <use> : lève en nommant le <use>', () => {
    monter(
      '<div style="background: rgb(255, 255, 255); position: relative; height: 100px">' +
        `<svg xmlns="${SVG}" width="200" height="100" style="display: block">` +
        `<defs><rect id="epreuve-plateau-html" width="200" height="100" fill="rgb(0, 0, 0)"/></defs>` +
        `<use data-plateau href="#epreuve-plateau-html"/></svg>` +
        '<span style="position: absolute; left: 10px; top: 10px">Iris</span></div>',
    );
    expect(() => fondPeintSous($('span'))).toThrow(/use\[data-plateau\]/);
  });

  test('un dégradé et un motif qui héritent leurs arrêts ou leurs formes par href', () => {
    monter(
      `<svg xmlns="${SVG}" width="200" height="200"><defs>` +
        `<linearGradient id="epreuve-g0"><stop stop-color="rgb(0, 0, 0)"/><stop offset="1" stop-color="rgb(10, 10, 10)"/></linearGradient>` +
        `<linearGradient id="epreuve-g1" href="#epreuve-g0"/>` +
        `<pattern id="epreuve-p0" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="rgb(20, 20, 20)"/></pattern>` +
        `<pattern id="epreuve-p1" href="#epreuve-p0"/></defs>` +
        `<rect width="200" height="200" fill="rgb(255, 255, 255)"/>` +
        `<rect width="200" height="100" fill="url(#epreuve-g1)"/>` +
        `<rect y="100" width="200" height="100" fill="url(#epreuve-p1)"/>` +
        `<text data-haut x="60" y="55">Iris</text><text data-bas x="60" y="155">Théo</text></svg>`,
    );
    expect(fondPeintSous($('[data-haut]'))).toEqual([
      [0, 0, 0, 1],
      [10, 10, 10, 1],
    ]);
    expect(fondPeintSous($('[data-bas]'))).toEqual([[20, 20, 20, 1]]);
  });

  test('une image de fond sur le chemin du fond retenu, ou sur la cible : lève en nommant son porteur', () => {
    monter(
      '<div style="background: rgb(255, 255, 255)"><p data-degrade style="background-image: linear-gradient(rgb(0, 0, 0), rgb(0, 0, 0))">' +
        '<span>Iris</span></p>' +
        '<button style="background: rgb(30, 60, 90) linear-gradient(rgb(0, 0, 0), rgb(0, 0, 0))">Retenir</button></div>',
    );
    expect(() => fondPeintSous($('span'))).toThrow(/p\[data-degrade\].*background-image/);
    expect(() => fondPeintSous($('button'))).toThrow(/button.*background-image/);
  });

  test('un bouton à fond opaque : son propre fond', () => {
    monter(
      '<div style="background: rgb(250, 250, 240)">' +
        '<button style="background: rgb(30, 60, 90); color: rgb(255, 255, 255)">Retenir</button></div>',
    );
    expect(fondPeintSous($('button'))).toEqual([[30, 60, 90, 1]]);
  });

  test("sans aucun fond opaque, la liste est vide", async () => {
    // L'épreuve retire le fond de <html> et de <body> le temps de la mesure.
    const avant = [document.documentElement.style.background, document.body.style.background];
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    try {
      monter('<span>Iris</span>');
      expect(fondPeintSous($('span'))).toEqual([]);
    } finally {
      [document.documentElement.style.background, document.body.style.background] = avant;
    }
  });
});

describe('pseudo-éléments', () => {
  test('couleurTexte, fondPeintSous et attenuations lisent le ::before, pas son hôte', () => {
    regles(
      '[data-scene] .epreuve-avant::before { content: "★"; color: rgb(10, 20, 30); opacity: 0.6; }' +
        '[data-scene] .epreuve-propre::before { content: "☆"; color: rgb(10, 20, 30); background: rgb(90, 80, 70); }',
    );
    monter(
      '<span class="epreuve-avant" style="background: rgb(240, 230, 220); color: rgb(5, 5, 5)"></span>' +
        '<span class="epreuve-propre" style="background: rgb(240, 230, 220)"></span>',
    );
    const [avant, propre] = porteursDeTexte(scene);
    expect(avant).toEqual({ element: $('.epreuve-avant'), pseudo: '::before' });
    expect(couleurTexte(avant)).toEqual([10, 20, 30, 1]);
    expect(fondPeintSous(avant)).toEqual([[240, 230, 220, 1]]);
    expect(fondPeintSous(propre)).toEqual([[90, 80, 70, 1]]);
    expect(attenuations(avant)).toEqual([
      { element: $('.epreuve-avant'), pseudo: '::before', propriete: 'opacity', valeur: '0.6' },
    ]);
    expect(attenuations(propre)).toEqual([]);
  });
});

describe('attenuations', () => {
  test('un texte sans atténuation : aucune faute', () => {
    monter('<p><span>Ondine</span></p>');
    expect(attenuations($('span'))).toEqual([]);
  });

  // Chaque cas pose une propriété sur un ancêtre ou sur le texte, et attend
  // la faute sur l'élément qui la porte.
  const CAS = [
    ['opacity', 'opacity: 0.6', '0.6'],
    ['filter', 'filter: grayscale(1)', 'grayscale(1)'],
    ['backdrop-filter', 'backdrop-filter: blur(2px)', 'blur(2px)'],
    ['mask-image', 'mask-image: linear-gradient(black, black)', 'linear-gradient(rgb(0, 0, 0), rgb(0, 0, 0))'],
    ['mix-blend-mode', 'mix-blend-mode: multiply', 'multiply'],
  ];
  for (const [propriete, declaration, valeur] of CAS) {
    test(`relève ${propriete} posé sur un ancêtre`, () => {
      monter(`<section style="${declaration}"><p><span>Iris</span></p></section>`);
      expect(attenuations($('span'))).toEqual([
        { element: $('section'), pseudo: null, propriete, valeur },
      ]);
    });
  }

  test("relève un fill-opacity de 0,5 sur le groupe d'un texte SVG, et sur ce qui en hérite", () => {
    monter(`<svg xmlns="${SVG}"><g fill-opacity="0.5"><text x="0" y="10">Théo</text></g></svg>`);
    const fautes = attenuations($('text'));
    expect(fautes).toContainEqual({ element: $('g'), pseudo: null, propriete: 'fill-opacity', valeur: '0.5' });
    expect(fautes.every((f) => f.propriete === 'fill-opacity')).toBe(true);
  });

  test('relève un stroke-opacity', () => {
    monter(`<svg xmlns="${SVG}"><circle cx="5" cy="5" r="4" stroke="rgb(0, 0, 0)" stroke-opacity="0.4"/></svg>`);
    expect(attenuations($('circle'))).toContainEqual({
      element: $('circle'),
      pseudo: null,
      propriete: 'stroke-opacity',
      valeur: '0.4',
    });
  });
});

describe('visible', () => {
  test('un élément visible, puis caché, recouvert, hors de la fenêtre', () => {
    monter(
      '<div style="position: relative; width: 200px; height: 40px">' +
        '<span data-a>Iris</span>' +
        '<span data-b style="display: none">Théo</span>' +
        '<span data-c style="position: absolute; left: 120px; top: 0">Ondine</span>' +
        '<span data-d style="position: absolute; left: 0; top: 0; width: 200px; height: 40px; background: rgb(1, 1, 1)"></span>' +
        '<span data-e style="position: fixed; left: -500px; top: 0">Grisaille</span>' +
        '</div>',
    );
    expect(visible($('[data-a]'))).toMatch(/centre/);
    expect(visible($('[data-b]'))).toMatch(/checkVisibility/);
    expect(visible($('[data-c]'))).toMatch(/centre/);
    expect(visible($('[data-e]'))).toMatch(/fenêtre/);
    $('[data-d]').remove();
    expect(visible($('[data-a]'))).toBe(true);
    expect(visible($('[data-c]'))).toBe(true);
  });

  test('un élément en pointer-events: none se voit, comme la pastille du plan', () => {
    monter(
      `<svg xmlns="${SVG}" width="200" height="100"><rect width="200" height="100" fill="rgb(200, 220, 240)"/>` +
        `<text data-pastille x="60" y="55" style="pointer-events: none">3</text></svg>`,
    );
    expect(visible($('text'))).toBe(true);
  });

  test("un recouvrement opaque en pointer-events: none cache le texte dessous, et se nomme", () => {
    monter(
      '<div style="position: relative; width: 200px; height: 40px">' +
        '<span>Iris</span>' +
        '<div data-fantome style="position: absolute; inset: 0; background: rgb(1, 1, 1); pointer-events: none"></div></div>',
    );
    expect(visible($('span'))).toMatch(/couvert par div\[data-fantome\]/);
  });

  // Recouvrements qui ne peignent rien au centre : ils ne cachent pas le texte.
  const TRANSPARENTS = [
    ['une boîte HTML sans fond ni texte', '<div style="position: absolute; inset: 0"></div>'],
    ['une boîte HTML à opacity 0', '<div style="position: absolute; inset: 0; background: rgb(1, 1, 1); opacity: 0"></div>'],
    [
      'une zone d’atteinte SVG à fill-opacity 0',
      `<svg xmlns="${SVG}" width="200" height="40" style="position: absolute; left: 0; top: 0"><rect width="200" height="40" fill="rgb(1, 1, 1)" fill-opacity="0"/></svg>`,
    ],
  ];
  for (const [nom, recouvrement] of TRANSPARENTS) {
    test(`${nom} posée sur le texte ne le cache pas`, () => {
      monter(`<div style="position: relative; width: 200px; height: 40px"><span>Iris</span>${recouvrement}</div>`);
      expect(visible($('span'))).toBe(true);
    });
  }

  // Recouvrements qui peignent au centre : chacun cache le texte.
  const OPAQUES = [
    ['une boîte HTML qui porte un texte', '<div style="position: absolute; inset: 0">Théo</div>'],
    [
      'une boîte HTML à image de fond',
      '<div style="position: absolute; inset: 0; background-image: linear-gradient(rgb(1, 1, 1), rgb(1, 1, 1))"></div>',
    ],
    ['une image sans fond', '<img alt="" style="position: absolute; left: 0; top: 0; width: 200px; height: 40px">'],
    [
      'une forme SVG remplie',
      `<svg xmlns="${SVG}" width="200" height="40" style="position: absolute; left: 0; top: 0"><rect width="200" height="40" fill="rgb(1, 1, 1)"/></svg>`,
    ],
  ];
  for (const [nom, recouvrement] of OPAQUES) {
    test(`${nom} posée sur le texte le cache`, () => {
      monter(`<div style="position: relative; width: 200px; height: 40px"><span>Iris</span>${recouvrement}</div>`);
      expect(visible($('span'))).toMatch(/couvert/);
    });
  }

  test('une boîte sans fond dont un pseudo-élément porte un texte, posée sur le texte, le cache', () => {
    regles('[data-scene] .epreuve-etiquette::before { content: "Théo"; }');
    monter(
      '<div style="position: relative; width: 200px; height: 40px"><span>Iris</span>' +
        '<div class="epreuve-etiquette" style="position: absolute; inset: 0"></div></div>',
    );
    expect(visible($('span'))).toMatch(/couvert par div\.epreuve-etiquette/);
  });

  test("un élément rogné par son ancêtre au centre de sa boîte : le centre ne l'atteint pas", () => {
    monter(
      '<div style="position: relative; width: 100px; height: 40px; overflow: hidden">' +
        '<span style="position: absolute; left: 60px; top: 0; width: 100px">Iris</span></div>',
    );
    expect(visible($('span'))).toMatch(/n'atteint pas/);
  });

  test("un pseudo-élément : son hôte, son display et son content", () => {
    regles(
      '[data-scene] .epreuve-vu::before { content: "★"; }' +
        '[data-scene] .epreuve-cache::before { content: "★"; display: none; }',
    );
    monter('<span class="epreuve-vu">Iris</span> <span class="epreuve-cache">Théo</span>');
    expect(visible({ element: $('.epreuve-vu'), pseudo: '::before' })).toBe(true);
    expect(visible({ element: $('.epreuve-cache'), pseudo: '::before' })).toMatch(/display/);
    expect(visible({ element: $('.epreuve-vu'), pseudo: '::after' })).toMatch(/content/);
  });
});

describe('sousTheme', () => {
  const racine = document.documentElement;

  test("pose le thème pendant la mesure, puis rend 'clair' qu'il portait", async () => {
    racine.setAttribute('data-theme', 'clair');
    try {
      const lu = await sousTheme('sombre', () => racine.getAttribute('data-theme'));
      expect(lu).toBe('sombre');
      expect(racine.getAttribute('data-theme')).toBe('clair');
    } finally {
      racine.removeAttribute('data-theme');
    }
  });

  test("laisse l'attribut absent quand il l'était", async () => {
    racine.removeAttribute('data-theme');
    await sousTheme('sombre', () => {
      expect(racine.getAttribute('data-theme')).toBe('sombre');
    });
    expect(racine.hasAttribute('data-theme')).toBe(false);
  });

  test('rend la valeur d’avant, ou son absence, même quand la mesure lève', async () => {
    racine.removeAttribute('data-theme');
    await expect(sousTheme('sombre', () => { throw new Error('mesure manquée'); })).rejects.toThrow('mesure manquée');
    expect(racine.hasAttribute('data-theme')).toBe(false);
    racine.setAttribute('data-theme', 'clair');
    try {
      await expect(sousTheme('sombre', async () => { throw new Error('mesure manquée'); })).rejects.toThrow('mesure manquée');
      expect(racine.getAttribute('data-theme')).toBe('clair');
    } finally {
      racine.removeAttribute('data-theme');
    }
  });
});
