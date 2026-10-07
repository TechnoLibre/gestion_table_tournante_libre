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
// visibilité, de contraste et d'opacité passent par les deux thèmes, que
// l'attribut data-theme de <html> choisit (§ 19.2). Les mesures viennent du
// module partagé test/navigateur/rendu.js, dont le contraste est celui de
// palette.js, seule formule des WCAG du dépôt.
//
// Le projet navigateur n'importe pas node:assert/strict : côté navigateur,
// Vite le remplace par un module qui lève une erreur à tout accès. Il emploie
// expect, et prend test et describe chez Vitest plutôt que dans
// test/lanceur.js, dont le repli vers node:test ne vaut que pour la série node.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import App from './App.svelte';
import { VERSION } from '../version.genere.js';
import {
  attenuations,
  composantes,
  contraste,
  couleurTexte,
  designation,
  fondPeintSous,
  porteursDeTexte,
  sousTheme,
  visible,
} from '../../test/navigateur/rendu.js';

const TRANSPARENT = 'rgba(0, 0, 0, 0)';
const THEMES = ['clair', 'sombre'];

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

// Le bandeau, puis chacun de ses porteurs de texte.
function bandeauEtTextes() {
  return [{ element: bandeau(), pseudo: null }, ...porteursDeTexte(bandeau())];
}

describe("bandeau d'application", () => {
  test('existe et porte la version affichée', () => {
    expect(bandeau()).not.toBeNull();
    expect(bandeau().textContent).toContain(VERSION.affichee);
  });

  test('le bandeau et chacun de ses textes sont visibles dans la fenêtre, dans les deux thèmes (§ 14.2, § 18.6)', async () => {
    // Le texte, le titre et le style calculé se relisent sur un élément qui
    // ne peint rien. visible interroge donc la mise en page : checkVisibility,
    // une boîte non vide dans la fenêtre, et le centre de cette boîte qui
    // atteint l'élément ou l'un de ses descendants sans qu'un élément peint
    // au-dessus y peigne — un élément recouvert, ou rogné par un ancêtre,
    // échoue.
    for (const theme of THEMES) {
      await sousTheme(theme, () => {
        const porteurs = bandeauEtTextes();
        expect(porteurs.length).toBeGreaterThan(1);
        for (const porteur of porteurs) {
          expect(visible(porteur), `${theme} : ${designation(porteur)}`).toBe(true);
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

  test('chaque texte du bandeau tient 4,5:1 sur chaque couleur peinte sous lui, dans les deux thèmes (§ 14.5)', async () => {
    const couleursParTheme = [];
    for (const theme of THEMES) {
      const couleurs = await sousTheme(theme, () => {
        const textes = porteursDeTexte(bandeau());
        expect(textes.length).toBeGreaterThan(0);
        for (const porteur of textes) {
          const lieu = `${theme} : ${designation(porteur)}`;
          const texte = couleurTexte(porteur);
          const fonds = fondPeintSous(porteur);
          expect(fonds.length, `${lieu} : aucun fond opaque`).toBeGreaterThan(0);
          expect(texte[3], lieu).toBe(1);
          for (const fond of fonds) {
            expect(contraste(texte, fond), `${lieu} sur ${fond.join(', ')}`).toBeGreaterThanOrEqual(4.5);
          }
        }
        return [document.body, bandeau()].map((el) => {
          const style = getComputedStyle(el);
          return `${composantes(style.color)} sur ${composantes(style.backgroundColor)}`;
        });
      });
      couleursParTheme.push(couleurs);
    }
    // Un attribut que la feuille ne lit pas, ou un thème sombre qui ne
    // redéfinit aucune couleur, ferait mesurer deux fois le thème clair.
    expect(
      couleursParTheme[1],
      `mêmes couleurs dans les deux thèmes : ${couleursParTheme[0].join(' ; ')}`,
    ).not.toEqual(couleursParTheme[0]);
  });

  test("aucune opacité partielle, aucun filtre, masque ni mode de fusion sous un texte, dans les deux thèmes (§ 14.5)", async () => {
    // opacity et filter ne s'héritent pas : posés sur un ancêtre, ils changent
    // le pixel peint sans changer le style calculé du texte. attenuations
    // relit donc chaque niveau de l'ascendance, jusqu'à la racine du document.
    for (const theme of THEMES) {
      await sousTheme(theme, () => {
        const textes = porteursDeTexte(bandeau());
        expect(textes.length).toBeGreaterThan(0);
        for (const porteur of textes) {
          const fautes = attenuations(porteur).map(
            (f) => `${designation({ element: f.element, pseudo: f.pseudo })} ${f.propriete}: ${f.valeur}`,
          );
          expect(fautes, `${theme} : ${designation(porteur)}`).toEqual([]);
        }
      });
    }
  });
});
