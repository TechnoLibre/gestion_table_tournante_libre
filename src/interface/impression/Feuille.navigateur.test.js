// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La feuille de l'aperçu est la page imprimée (§ 11.7 : « ce n'est pas une
// seconde mise en page : c'est la même ») : sa zone de contenu
// [data-contenu] a la même largeur à l'écran et sous les médias
// d'impression émulés, celle de la page moins ses deux marges. Le bord que
// l'écran dessine autour de la feuille ne prend aucune place : la tuile du
// plan, à la largeur utile, y tient sans être rognée, et les listes se
// mesurent et se paginent à l'écran à la largeur du papier.
//
// App est montée par test/navigateur/ecrans.js sur le système de fichiers
// simulé, au cadre de 1 366 × 700. Le projet navigateur emploie expect, et
// test et describe de Vitest (§ 14.8).
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { cdp } from 'vitest/browser';
import { texteLivre } from '../../demo/livrees.js';
import { constante } from '../../geometrie/constantes.js';
import { analyser } from '../../stockage/document.js';
import { fixerCadre } from '../../../test/navigateur/entrees.js';
import { attendre, chargePrincipale, cliquer, creerContexte, ouvrirApercu } from '../../../test/navigateur/ecrans.js';
import { MM_PAR_PX } from './modele.js';

// Images attendues au plus par étape : bien au-delà d'un rendu, et sous le
// délai d'une épreuve, pour qu'une étape qui ne vient pas se nomme.
const IMAGES = 300;

// Une feuille se mesure au dixième de millimètre (§ 11.7).
const TOLERANCE_MM = 0.1;

let contexte = null;
beforeEach(async () => {
  await fixerCadre(1366, 700);
  contexte = creerContexte();
});
afterEach(async () => {
  const erreurs = contexte.erreurs();
  await contexte.defaire();
  expect(erreurs, 'erreurs reçues par le collecteur').toEqual([]);
});

const feuilles = (m) => [...m.racine.querySelectorAll('[data-impression] [data-feuille]')];

// Chaque feuille du document : sa largeur et celle de sa zone de contenu,
// en px CSS, ce que le contenu porte au-delà de sa largeur visible, et le
// bord tracé autour de la feuille — le style de son contour, s'il tient
// dans le rectangle de la feuille (décalage + épaisseur ≤ 0), son ombre.
const mesures = (m) =>
  feuilles(m).map((feuille) => {
    const contenu = feuille.querySelector('[data-contenu]');
    const style = getComputedStyle(feuille);
    return {
      rang: feuille.dataset.feuille,
      feuille: feuille.getBoundingClientRect().width,
      contenu: contenu.getBoundingClientRect().width,
      deborde: contenu.scrollWidth - contenu.clientWidth,
      bord: style.outlineStyle,
      bordDedans: parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth) <= 0,
      ombre: style.boxShadow,
    };
  });

// Les mesures sous les médias d'impression émulés, puis l'écran rétabli.
async function mesuresImprimees(m) {
  await cdp().send('Emulation.setEmulatedMedia', { media: 'print' });
  try {
    return mesures(m);
  } finally {
    await cdp().send('Emulation.setEmulatedMedia', { media: '' });
  }
}

// La zone de contenu de chaque feuille, à l'écran et à l'impression : la
// même largeur, celle de la feuille moins ses deux marges, et rien qui
// déborde. L'écran trace le bord de la feuille ; le papier n'en porte ni
// bord ni ombre.
async function verifierLargeurs(m, cas) {
  const marge = constante('MARGE_PAGE_MM');
  const ecran = mesures(m);
  const papier = await mesuresImprimees(m);
  expect(ecran.length, `${cas} : des feuilles`).toBeGreaterThan(0);
  expect(papier.map(({ rang }) => rang), `${cas} : les mêmes feuilles`).toEqual(ecran.map(({ rang }) => rang));
  for (const [i, sur] of ecran.entries()) {
    const imprime = papier[i];
    const libelle = `${cas}, feuille ${sur.rang} : écran ${JSON.stringify(sur)}, impression ${JSON.stringify(imprime)}`;
    expect(Math.abs(sur.contenu - imprime.contenu) * MM_PAR_PX, libelle).toBeLessThanOrEqual(TOLERANCE_MM);
    expect(Math.abs((sur.feuille - sur.contenu) * MM_PAR_PX - 2 * marge), libelle).toBeLessThanOrEqual(TOLERANCE_MM);
    expect(sur.deborde, libelle).toBeLessThanOrEqual(0);
    expect([sur.bord, sur.bordDedans], libelle).toEqual(['solid', true]);
    expect([imprime.bord, imprime.ombre], libelle).toEqual(['none', 'none']);
  }
}

describe('la feuille à l’écran est la feuille imprimée (§ 11.7)', () => {
  test('le plan de la principale : la zone de contenu a la même largeur à l’écran et à l’impression, et la tuile y tient', async () => {
    const m = await ouvrirApercu(contexte, chargePrincipale());
    await verifierLargeurs(m, 'plan, A4');
  });

  test('la grande démonstration sur papier Lettre, plan puis liste d’accueil : la même largeur sur chaque feuille', async () => {
    const m = await ouvrirApercu(contexte, analyser(texteLivre('grande')).charge, { papier: 'Lettre' });
    await verifierLargeurs(m, 'plan, Lettre');
    await cliquer(m, '[data-ecran="apercu"] [data-commande="vue"][data-cible="accueil"]');
    await attendre('la liste d’accueil', () => m.racine.querySelector('[data-impression][data-vue-impression="accueil"] [data-feuille]'), IMAGES);
    await verifierLargeurs(m, 'accueil, Lettre');
  });
});
