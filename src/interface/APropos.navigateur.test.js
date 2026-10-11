// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le panneau « À propos » dans un vrai moteur de rendu (§ 18.6) : monté
// seul, sur un presse-papiers d'épreuve qui relève ce qu'on lui remet ou
// refuse. Le bloc copié est celui qu'on lui passe ; l'ouverture depuis le
// bandeau et la composition du bloc s'éprouvent dans App.navigateur.test.js.
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import './jetons.css';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { creerHorlogePilotee } from '../application/horloge.js';
import { TABLES_APPLICATION } from '../application/libelles.js';
import { creerTraduction } from '../application/traduction.js';
import { couleurDeJeton } from '../../test/navigateur/captures.js';
import { composantes, contraste, couleurTexte, fondPeintSous, sousTheme } from '../../test/navigateur/rendu.js';
import APropos from './APropos.svelte';
import { TABLES_INTERFACE } from './libelles.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

// Un bloc inventé, de la forme d'une ligne d'« À propos ».
const BLOC = 'Logiciel témoin \u{00B7} forme d\u{2019}épreuve \u{00B7} plateforme simulée';

const montes = [];
afterEach(() => {
  for (const { composant, conteneur } of montes.splice(0)) {
    unmount(composant);
    conteneur.remove();
  }
});

// Un presse-papiers d'épreuve : relève chaque copie, ou lève refus.
function pressePapiersDEpreuve({ refus = null } = {}) {
  const copies = [];
  return {
    copies,
    async copier(texte) {
      if (refus !== null) throw refus;
      copies.push(texte);
    },
  };
}

function monter(props) {
  const conteneur = document.createElement('div');
  document.body.prepend(conteneur);
  const contexte = new Map([
    ['t', t],
    ['horloge', creerHorlogePilotee()],
  ]);
  const composant = mount(APropos, { target: conteneur, props, context: contexte });
  flushSync();
  montes.push({ composant, conteneur });
  return conteneur;
}

// La carte qui porte un élément : le plus proche ancêtre peint du fond de la
// carte, au rayon de 12 px ; null sans elle.
function carteDe(element) {
  const fond = couleurDeJeton('--couleur-carte-fond').join();
  for (let n = element.parentElement; n !== null; n = n.parentElement) {
    const style = getComputedStyle(n);
    if (composantes(style.backgroundColor).join() === fond && style.borderTopLeftRadius === '12px') return n;
  }
  return null;
}

describe('« À propos » : l’habillage (§ 18.6)', () => {
  test('le titre au-dessus d’une carte qui porte le bloc, sur le fond sourd, et les commandes ; « Copier » est l’action principale, dans les deux thèmes', async () => {
    const conteneur = monter({ bloc: BLOC, pressePapiers: pressePapiersDEpreuve(), fermer: () => {} });
    const ecran = conteneur.querySelector('[data-ecran="apropos"]');
    const titre = ecran.querySelector('h1');
    expect(titre.textContent).toBe(t('coquille.apropos.titre'));
    const bloc = ecran.querySelector('[data-bloc]');
    expect(bloc.textContent).toBe(BLOC);
    const carte = carteDe(bloc);
    expect(carte, 'carte du bloc').not.toBeNull();
    expect(ecran.contains(carte)).toBe(true);
    expect(carte.contains(titre)).toBe(false);
    expect(carte.contains(ecran.querySelector('[data-commande="copier"]'))).toBe(true);
    expect(carte.contains(ecran.querySelector('[data-commande="fermerApropos"]'))).toBe(true);
    for (const theme of ['clair', 'sombre']) {
      await sousTheme(theme, async () => {
        const [fond] = fondPeintSous(bloc);
        expect(fond.join(), theme).toBe(couleurDeJeton('--couleur-carte-fond-sourd').join());
        expect(contraste(couleurTexte(bloc), fond), theme).toBeGreaterThanOrEqual(4.5);
        const copier = getComputedStyle(ecran.querySelector('[data-commande="copier"]'));
        expect(composantes(copier.backgroundColor).join(), theme).toBe(couleurDeJeton('--couleur-action-fond').join());
      });
    }
  });

  test('« Copier » remet exactement le bloc affiché et le dit ; refusée, la copie le dit dans l’encre du refus', async () => {
    const presse = pressePapiersDEpreuve();
    const conteneur = monter({ bloc: BLOC, pressePapiers: presse, fermer: () => {} });
    conteneur.querySelector('[data-commande="copier"]').click();
    await vi.waitFor(() => expect(presse.copies).toEqual([BLOC]));
    await vi.waitFor(() => {
      flushSync();
      expect(conteneur.querySelector('[role="status"]')?.textContent).toBe(t('coquille.apropos.copie'));
    });

    const refuse = monter({ bloc: BLOC, pressePapiers: pressePapiersDEpreuve({ refus: new Error('refusé') }), fermer: () => {} });
    refuse.querySelector('[data-commande="copier"]').click();
    await vi.waitFor(() => {
      flushSync();
      expect(refuse.querySelector('[data-refus="copier"]')?.textContent).toBe(t('coquille.apropos.copieRefusee'));
    });
    const message = refuse.querySelector('[data-refus="copier"]');
    expect(couleurTexte(message).join()).toBe(couleurDeJeton('--couleur-refus').join());
  });

  test('« Fermer » appelle fermer une fois', () => {
    const fermer = vi.fn();
    const conteneur = monter({ bloc: BLOC, pressePapiers: pressePapiersDEpreuve(), fermer });
    conteneur.querySelector('[data-commande="fermerApropos"]').click();
    expect(fermer).toHaveBeenCalledTimes(1);
  });
});
