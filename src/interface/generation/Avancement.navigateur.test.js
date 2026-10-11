// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'avancement d'une génération dans un vrai moteur de rendu (§ 5.10) : la
// barre de progression se voit. Le composant est monté seul, dans un
// conteneur de largeur fixée ; la barre se lit par son rôle, son
// remplissage par son premier enfant, les couleurs par leurs jetons, dans
// les deux thèmes.
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import '../jetons.css';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test } from 'vitest';
import { creerHorlogePilotee } from '../../application/horloge.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { couleurDeJeton } from '../../../test/navigateur/captures.js';
import { composantes, contraste, sousTheme } from '../../../test/navigateur/rendu.js';
import { TABLES_INTERFACE } from '../libelles.js';
import Avancement from './Avancement.svelte';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

const montes = [];
afterEach(() => {
  for (const { composant, conteneur } of montes.splice(0)) {
    unmount(composant);
    conteneur.remove();
  }
});

// Monte Avancement dans un conteneur de 600 px.
function monter(props) {
  const conteneur = document.createElement('div');
  conteneur.style.width = '600px';
  document.body.prepend(conteneur);
  const contexte = new Map([
    ['t', t],
    ['horloge', creerHorlogePilotee()],
  ]);
  const composant = mount(Avancement, { target: conteneur, props, context: contexte });
  flushSync();
  montes.push({ composant, conteneur });
  return conteneur;
}

describe('l’avancement se voit (§ 5.10)', () => {
  test('la barre occupe la largeur de son conteneur ; son remplissage, au prorata, se peint de la teinte de l’action à 3:1 sur la piste, dans les deux thèmes', async () => {
    const conteneur = monter({ fait: 250, total: 1000, annuler: () => {} });
    const barre = conteneur.querySelector('[role="progressbar"]');
    expect(barre.getAttribute('aria-valuenow')).toBe('250');
    expect(barre.getBoundingClientRect().width).toBeGreaterThanOrEqual(0.9 * conteneur.getBoundingClientRect().width);
    const plein = barre.firstElementChild;
    expect(plein.getBoundingClientRect().width / barre.clientWidth).toBeCloseTo(0.25, 2);
    expect(barre.getBoundingClientRect().height).toBeGreaterThanOrEqual(8);
    for (const theme of ['clair', 'sombre']) {
      await sousTheme(theme, async () => {
        const remplissage = composantes(getComputedStyle(plein).backgroundColor);
        const piste = composantes(getComputedStyle(barre).backgroundColor);
        expect(remplissage.join(), theme).toBe(couleurDeJeton('--couleur-action-fond').join());
        expect(piste.join(), theme).toBe(couleurDeJeton('--couleur-carte-fond-sourd').join());
        expect(contraste(remplissage, piste), theme).toBeGreaterThanOrEqual(3);
      });
    }
  });

  test('le compte se lit en mots au-dessus de la barre, et « Annuler la génération » la suit', () => {
    const conteneur = monter({ fait: 250, total: 1000, annuler: () => {} });
    const barre = conteneur.querySelector('[role="progressbar"]');
    const texte = [...conteneur.querySelectorAll('p')].find((p) => p.textContent === t('generation.avancement.texte', { fait: 250, total: 1000 }));
    expect(texte).toBeDefined();
    expect(texte.getBoundingClientRect().bottom).toBeLessThanOrEqual(barre.getBoundingClientRect().top);
    const annuler = conteneur.querySelector('[data-commande="annuler"]');
    expect(annuler.getBoundingClientRect().top).toBeGreaterThanOrEqual(barre.getBoundingClientRect().bottom);
  });
});
