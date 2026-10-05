// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuve de rendu du bandeau d'application (§ 8.4, § 18.6), dans un vrai
// moteur de rendu. Le test interroge le rendu, jamais la présence d'une
// classe (§ 14.2) : la visibilité de chaque élément, la boîte où la mise en
// page le pose et l'élément qu'atteint le centre de cette boîte, le style
// calculé, le texte, le titre de la fenêtre. Il ne lit aucun pixel : le
// contraste se calcule sur les couleurs calculées, qui ne sont les couleurs
// peintes que sans opacité partielle, filtre ni mode de fusion — ce qu'une
// épreuve vérifie dans l'ascendance de chaque texte (§ 14.5). Les épreuves de
// visibilité, de contraste et d'opacité passent par les deux thèmes : le
// protocole de débogage de Chromium (CDP) émule prefers-color-scheme.
//
// Le projet navigateur n'importe pas node:assert/strict : côté navigateur,
// Vite le remplace par un module qui lève une erreur à tout accès. Il emploie
// expect, et prend test et describe chez Vitest plutôt que dans
// test/lanceur.js, dont le repli vers node:test ne vaut que pour la série node.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { cdp } from 'vitest/browser';
import { flushSync, mount, unmount } from 'svelte';
import App from './App.svelte';
import { VERSION } from '../version.genere.js';

const TRANSPARENT = 'rgba(0, 0, 0, 0)';
const THEMES = ['light', 'dark'];

// Composantes [r, g, b, a] d'une couleur calculée. Chromium la rend sous la
// forme « rgb(r, g, b) » ou « rgba(r, g, b, a) » quand la source est une
// couleur sRGB ; toute autre forme fait échouer l'épreuve plutôt que de la
// laisser passer sans mesure.
function composantes(couleur) {
  const m = /^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/.exec(couleur);
  if (m === null) {
    throw new Error(`couleur calculée illisible : ${couleur}`);
  }
  const alpha = m[4] === undefined ? 1 : Number(m[4]);
  return [Number(m[1]), Number(m[2]), Number(m[3]), alpha];
}

// Luminance relative d'une couleur sRGB, au sens des WCAG.
function luminance([r, g, b]) {
  const lineaire = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lineaire(r) + 0.7152 * lineaire(g) + 0.0722 * lineaire(b);
}

function contraste(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// L'élément, puis chacun de ses ancêtres jusqu'à la racine du document.
function ascendance(element) {
  const chaine = [];
  for (let n = element; n !== null; n = n.parentElement) {
    chaine.push(n);
  }
  return chaine;
}

// Fond peint sous un élément : le premier fond non transparent de son
// ascendance, ou null.
function fondPeint(element) {
  for (const n of ascendance(element)) {
    const fond = composantes(getComputedStyle(n).backgroundColor);
    if (fond[3] !== 0) {
      return fond;
    }
  }
  return null;
}

// Éléments du sous-arbre qui portent eux-mêmes un nœud de texte non vide.
function porteursDeTexte(racine) {
  return [racine, ...racine.querySelectorAll('*')].filter((el) =>
    [...el.childNodes].some(
      (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim() !== '',
    ),
  );
}

// Nom lisible d'un élément dans un message d'échec.
function designation(element) {
  const classe = element.getAttribute('class');
  return classe ? `${element.localName}.${classe}` : element.localName;
}

// Exécute mesure() sous le thème demandé et rend sa valeur. L'émulation est
// levée ensuite, même quand mesure() échoue : le test suivant retrouve la
// préférence propre du navigateur.
async function sousTheme(theme, mesure) {
  await cdp().send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: theme }],
  });
  try {
    expect(matchMedia('(prefers-color-scheme: dark)').matches, theme).toBe(
      theme === 'dark',
    );
    return mesure();
  } finally {
    await cdp().send('Emulation.setEmulatedMedia', { features: [] });
  }
}

let composant;

beforeEach(() => {
  composant = mount(App, { target: document.body });
  flushSync();
});

afterEach(() => {
  unmount(composant);
});

function bandeau() {
  return document.body.querySelector('header.bandeau');
}

// Le bandeau, puis chacun des éléments qui y portent un texte.
function bandeauEtTextes() {
  return [...new Set([bandeau(), ...porteursDeTexte(bandeau())])];
}

describe("bandeau d'application", () => {
  test('existe et porte la version affichée', () => {
    expect(bandeau()).not.toBeNull();
    expect(bandeau().textContent).toContain(VERSION.affichee);
  });

  test('le bandeau et chacun de ses textes sont visibles dans la fenêtre, dans les deux thèmes (§ 14.2, § 18.6)', async () => {
    // Le texte, le titre et le style calculé se relisent sur un élément qui
    // ne peint rien. L'épreuve interroge donc la mise en page : chaque élément
    // est visible pour checkVisibility (display, visibility, opacité nulle,
    // content-visibility), sa boîte est non vide et tient dans la fenêtre, et
    // le point central de cette boîte atteint l'élément ou l'un de ses
    // descendants — un élément recouvert, ou rogné par un ancêtre, laisse le
    // point à un autre. elementFromPoint suit l'atteinte du pointeur : un
    // élément en pointer-events: none n'y répond pas, et l'épreuve le refuse.
    for (const theme of THEMES) {
      await sousTheme(theme, () => {
        const elements = bandeauEtTextes();
        expect(elements.length).toBeGreaterThan(1);
        for (const element of elements) {
          const lieu = `${theme} : ${designation(element)}`;
          expect(
            element.checkVisibility({ opacityProperty: true, visibilityProperty: true }),
            `${lieu} : checkVisibility`,
          ).toBe(true);
          const boite = element.getBoundingClientRect();
          expect(boite.width, `${lieu} : largeur`).toBeGreaterThan(0);
          expect(boite.height, `${lieu} : hauteur`).toBeGreaterThan(0);
          expect(boite.left, `${lieu} : bord gauche`).toBeGreaterThanOrEqual(0);
          expect(boite.top, `${lieu} : bord haut`).toBeGreaterThanOrEqual(0);
          expect(boite.right, `${lieu} : bord droit`).toBeLessThanOrEqual(innerWidth);
          expect(boite.bottom, `${lieu} : bord bas`).toBeLessThanOrEqual(innerHeight);
          const atteint = document.elementFromPoint(
            boite.left + boite.width / 2,
            boite.top + boite.height / 2,
          );
          expect(
            element.contains(atteint),
            `${lieu} : le centre de sa boîte atteint ${atteint === null ? 'aucun élément' : designation(atteint)}`,
          ).toBe(true);
        }
      });
    }
  });

  test('porte la provenance de la construction', () => {
    expect(import.meta.env.MODE).toBe('test');
    expect(bandeau().textContent).toContain('épreuve');
  });

  test('le titre de la fenêtre porte le nom et la version affichée', () => {
    expect(document.title).toBe(
      `Gestion table tournante Libre — ${VERSION.affichee}`,
    );
  });

  test('le texte et le fond du bandeau ont une couleur calculée', () => {
    const style = getComputedStyle(bandeau());
    expect(style.color).not.toBe(TRANSPARENT);
    expect(style.backgroundColor).not.toBe(TRANSPARENT);
  });

  test('chaque texte du bandeau tient 4,5:1 sur un fond opaque, dans les deux thèmes (§ 14.5)', async () => {
    const couleursParTheme = [];
    for (const theme of THEMES) {
      const couleurs = await sousTheme(theme, () => {
        const textes = porteursDeTexte(bandeau());
        expect(textes.length).toBeGreaterThan(0);
        for (const element of textes) {
          const lieu = `${theme} : ${designation(element)}`;
          const texte = composantes(getComputedStyle(element).color);
          const fond = fondPeint(element);
          expect(fond, lieu).not.toBeNull();
          expect(texte[3], lieu).toBe(1);
          expect(fond[3], lieu).toBe(1);
          expect(contraste(texte, fond), lieu).toBeGreaterThanOrEqual(4.5);
        }
        return [document.body, bandeau()].map((el) => {
          const style = getComputedStyle(el);
          return `${style.color} sur ${style.backgroundColor}`;
        });
      });
      couleursParTheme.push(couleurs);
    }
    // Une émulation sans effet, ou un thème sombre qui ne redéfinit aucune
    // couleur, ferait mesurer deux fois le thème clair.
    expect(
      couleursParTheme[1],
      `mêmes couleurs dans les deux thèmes : ${couleursParTheme[0].join(' ; ')}`,
    ).not.toEqual(couleursParTheme[0]);
  });

  test("aucune opacité partielle, aucun filtre ni mode de fusion sous un texte, dans les deux thèmes (§ 14.5)", async () => {
    // opacity et filter ne s'héritent pas : posés sur un ancêtre, ils changent
    // le pixel peint sans changer le style calculé du texte. Chaque niveau de
    // l'ascendance est donc relu, jusqu'à la racine du document.
    for (const theme of THEMES) {
      await sousTheme(theme, () => {
        const textes = porteursDeTexte(bandeau());
        expect(textes.length).toBeGreaterThan(0);
        for (const element of textes) {
          for (const n of ascendance(element)) {
            const style = getComputedStyle(n);
            const lieu = `${theme} : ${designation(n)} sous ${designation(element)}`;
            expect(style.opacity, lieu).toBe('1');
            expect(style.filter, lieu).toBe('none');
            expect(style.backdropFilter, lieu).toBe('none');
            expect(style.mixBlendMode, lieu).toBe('normal');
          }
        }
      });
    }
  });
});
