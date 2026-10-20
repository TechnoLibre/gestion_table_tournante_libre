// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le panneau « À propos » dans un vrai moteur de rendu (§ 18.6) : monté
// seul, sur un presse-papiers d'épreuve qui relève ce qu'on lui remet ou
// refuse, et une façade d'épreuve dont enregistrerSous relève le nom et les
// octets reçus. Le bloc copié est celui qu'on lui passe ; l'ouverture depuis
// le bandeau et la composition du bloc s'éprouvent dans App.navigateur.test.js.
// Les octets du logo et les textes des licences se comparent aux fichiers,
// lus par le disque par la commande readFile du lanceur. Aucune épreuve ne
// suit un lien : le navigateur d'épreuve n'a pas de réseau (§ 19.2).
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import './jetons.css';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { commands } from 'vitest/browser';
import { LICENCES } from '../actifs/licences.js';
import { FICHIERS_LOGO } from '../actifs/logo.js';
import { creerHorlogePilotee } from '../application/horloge.js';
import { TABLES_APPLICATION } from '../application/libelles.js';
import { creerTraduction } from '../application/traduction.js';
import { couleurDeJeton } from '../../test/navigateur/captures.js';
import { composantes, contraste, couleurTexte, fondPeintSous, sousTheme } from '../../test/navigateur/rendu.js';
import APropos from './APropos.svelte';
import { LIENS, cleDeLien } from './apropos.js';
import { CATEGORIES, cleDeCategorie, cleDeFonctionnalite } from './fonctionnalites.js';
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

// Une façade d'épreuve : enregistrerSous relève chaque nom, ses octets et la
// promesse qu'elle rend, celle du chemin que donne chemin(nom), null pour un
// téléchargement.
function facadeDEpreuve({ chemin = (nom) => `/dossier/${nom}` } = {}) {
  const enregistres = [];
  return {
    enregistres,
    enregistrerSous(nom, octets) {
      const rendu = Promise.resolve(chemin(nom));
      enregistres.push({ nom, octets: [...octets], rendu });
      return rendu;
    },
  };
}

function monter(props, { facade = facadeDEpreuve() } = {}) {
  const conteneur = document.createElement('div');
  document.body.prepend(conteneur);
  const contexte = new Map([
    ['t', t],
    ['horloge', creerHorlogePilotee()],
    ['facade', facade],
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

// Les octets d'un fichier du projet, lus par le disque.
async function octetsDuDisque(chemin) {
  const base64 = await commands.readFile(chemin, 'base64');
  return [...Uint8Array.from(atob(base64), (caractere) => caractere.charCodeAt(0))];
}

const monterSeul = (facade) => monter({ bloc: BLOC, pressePapiers: pressePapiersDEpreuve(), fermer: () => {} }, { facade });

describe('« À propos » : le logo de TechnoLibre (§ 18.6)', () => {
  test('le logo s’affiche dans un bouton qui ouvre et referme un petit menu de deux téléchargements, SVG et PNG', async () => {
    const conteneur = monterSeul(facadeDEpreuve());
    const bouton = conteneur.querySelector('[data-commande="logo"]');
    expect(bouton.getAttribute('aria-label')).toBe(t('coquille.apropos.logo.menu'));
    await vi.waitFor(() => {
      flushSync();
      expect(bouton.querySelector('img')?.getAttribute('src')?.startsWith('data:image/svg+xml')).toBe(true);
    });
    const image = bouton.querySelector('img');
    await image.decode();
    expect(image.getBoundingClientRect().width).toBeGreaterThan(100);
    expect(bouton.getAttribute('aria-expanded')).toBe('false');
    const menu = document.getElementById(bouton.getAttribute('aria-controls'));
    expect(menu.hidden).toBe(true);
    expect(conteneur.querySelector('[data-commande="telechargerSvg"]')).toBeNull();

    bouton.click();
    flushSync();
    expect(bouton.getAttribute('aria-expanded')).toBe('true');
    expect(menu.hidden).toBe(false);
    expect([...menu.querySelectorAll('[data-commande]')].map((c) => [c.dataset.commande, c.textContent.trim()])).toEqual([
      ['telechargerSvg', t('coquille.apropos.logo.telechargerSvg')],
      ['telechargerPng', t('coquille.apropos.logo.telechargerPng')],
    ]);
    bouton.click();
    flushSync();
    expect(bouton.getAttribute('aria-expanded')).toBe('false');
    expect(menu.hidden).toBe(true);
  });

  test('chaque téléchargement remet à enregistrerSous le nom et les octets exacts du fichier, ferme le menu et dit où le logo est enregistré', async () => {
    const facade = facadeDEpreuve();
    const conteneur = monterSeul(facade);
    const bouton = conteneur.querySelector('[data-commande="logo"]');
    for (const [forme, commande] of [['svg', 'telechargerSvg'], ['png', 'telechargerPng']]) {
      bouton.click();
      flushSync();
      conteneur.querySelector(`[data-commande="${commande}"]`).click();
      await vi.waitFor(() => expect(facade.enregistres.length).toBe(forme === 'svg' ? 1 : 2));
      const { nom, octets } = facade.enregistres.at(-1);
      expect(nom).toBe(FICHIERS_LOGO[forme]);
      expect(octets).toEqual(await octetsDuDisque(`src/actifs/${FICHIERS_LOGO[forme]}`));
      await vi.waitFor(() => {
        flushSync();
        expect(bouton.getAttribute('aria-expanded')).toBe('false');
        expect(conteneur.querySelector('[data-logo-enregistre]')?.textContent).toBe(
          t('coquille.apropos.logo.enregistre', { chemin: `/dossier/${FICHIERS_LOGO[forme]}` }),
        );
      });
      expect(document.activeElement).toBe(bouton);
    }
  });

  test('un téléchargement sans chemin — celui du web — ne dit rien ; Échap ferme le menu et rend le focus au logo', async () => {
    const facade = facadeDEpreuve({ chemin: () => null });
    const conteneur = monterSeul(facade);
    const bouton = conteneur.querySelector('[data-commande="logo"]');
    bouton.click();
    flushSync();
    conteneur.querySelector('[data-commande="telechargerPng"]').click();
    await vi.waitFor(() => expect(facade.enregistres.length).toBe(1));
    // La suite de l'enregistrement s'exécute une microtâche après la
    // promesse rendue.
    await facade.enregistres[0].rendu;
    await Promise.resolve();
    flushSync();
    expect(conteneur.querySelector('[data-logo-enregistre]')).toBeNull();

    bouton.click();
    flushSync();
    const svg = conteneur.querySelector('[data-commande="telechargerSvg"]');
    svg.focus();
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    flushSync();
    expect(bouton.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(bouton);
  });

  test('un enregistrement refusé se dit sous le logo, désigné par le logo, qui garde le focus, sans chemin ; le suivant, abouti, le retire', async () => {
    // Une façade dont enregistrerSous rend un chemin, sauf au deuxième
    // appel : sa promesse attend que l'épreuve la rejette, menu déjà fermé,
    // par un refus codé, comme la coquille un dossier où rien ne s'écrit.
    const details = { chemin: FICHIERS_LOGO.png, dossier: '/dossier', cause: 'EACCES' };
    const enregistres = [];
    let rejeter = null;
    const facade = {
      enregistrerSous(nom) {
        enregistres.push(nom);
        if (enregistres.length !== 2) return Promise.resolve(`/dossier/${nom}`);
        return new Promise((_, rejet) => (rejeter = rejet));
      },
    };
    const conteneur = monterSeul(facade);
    const bouton = conteneur.querySelector('[data-commande="logo"]');
    const telecharger = async (commande, rang) => {
      bouton.click();
      flushSync();
      conteneur.querySelector(`[data-commande="${commande}"]`).click();
      await vi.waitFor(() => expect(enregistres.length).toBe(rang));
    };

    await telecharger('telechargerSvg', 1);
    await vi.waitFor(() => {
      flushSync();
      expect(conteneur.querySelector('[data-logo-enregistre]')).not.toBeNull();
    });

    await telecharger('telechargerPng', 2);
    flushSync();
    expect(conteneur.querySelector('[data-commande="telechargerPng"]')).toBeNull();
    rejeter(Object.assign(new Error('ECRITURE'), { code: 'ECRITURE', details }));
    await vi.waitFor(() => {
      flushSync();
      expect(conteneur.querySelector('[data-refus="ECRITURE"]')).not.toBeNull();
    });
    const refus = conteneur.querySelector('[data-refus="ECRITURE"]');
    expect(refus.textContent).toContain(t('ECRITURE', details));
    expect(refus.closest('.logo')).toBe(bouton.closest('.logo'));
    expect(bouton.getAttribute('aria-describedby')).toBe(refus.id);
    expect(conteneur.querySelector('[data-logo-enregistre]')).toBeNull();
    expect(bouton.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(bouton);

    await telecharger('telechargerSvg', 3);
    await vi.waitFor(() => {
      flushSync();
      expect(conteneur.querySelector('[data-logo-enregistre]')).not.toBeNull();
    });
    expect(conteneur.querySelector('[data-refus]')).toBeNull();
    expect(bouton.hasAttribute('aria-describedby')).toBe(false);
  });
});

describe('« À propos » : les liens (§ 2, § 18.6)', () => {
  test('les quatre liens, chacun vers son adresse, dans un nouvel onglet, sans ouvreur ni référent ; aucun autre lien', () => {
    const conteneur = monterSeul(facadeDEpreuve());
    const liens = [...conteneur.querySelectorAll('a')];
    expect(liens.map((a) => a.dataset.lien).sort()).toEqual(Object.keys(LIENS).sort());
    for (const a of liens) {
      const nom = a.dataset.lien;
      expect(a.getAttribute('href'), nom).toBe(LIENS[nom]);
      expect(a.getAttribute('target'), nom).toBe('_blank');
      expect(a.getAttribute('rel'), nom).toBe('noopener noreferrer');
      expect(a.textContent.trim(), nom).toBe(t(cleDeLien(nom)));
    }
  });

  test('un lien se lit dans les deux thèmes, souligné, au contraste du texte', async () => {
    const conteneur = monterSeul(facadeDEpreuve());
    const lien = conteneur.querySelector('[data-lien="projet"]');
    for (const theme of ['clair', 'sombre']) {
      await sousTheme(theme, async () => {
        const [fond] = fondPeintSous(lien);
        expect(contraste(couleurTexte(lien), fond), theme).toBeGreaterThanOrEqual(4.5);
        expect(getComputedStyle(lien).textDecorationLine, theme).toContain('underline');
      });
    }
  });
});

describe('« À propos » : la licence et l’attribution (§ 18.6)', () => {
  test('la licence dit le choix entre les deux licences, l’identifiant SPDX et ce que demande la licence choisie ; l’attribution suit', () => {
    const conteneur = monterSeul(facadeDEpreuve());
    const licence = [...conteneur.querySelectorAll('section[aria-labelledby]')].find(
      (s) => s.querySelector('h2')?.textContent === t('coquille.apropos.licence.titre'),
    );
    expect(licence, 'carte Licence').toBeDefined();
    const texte = licence.textContent;
    for (const cle of ['choix', 'agpl', 'liliq', 'spdx', 'textes', 'respecter', 'contributions']) {
      expect(texte.includes(t(`coquille.apropos.licence.${cle}`)), cle).toBe(true);
    }
    for (const rang of [1, 2, 3, 4, 5]) expect(texte.includes(t(`coquille.apropos.licence.obligation${rang}`)), rang).toBe(true);
    expect(licence.querySelector('code')?.textContent).toBe(t('coquille.apropos.licence.spdxValeur'));
    expect([...licence.querySelectorAll('[data-lien]')].map((a) => a.dataset.lien)).toEqual(['agpl', 'liliq']);
    const attribution = [...conteneur.querySelectorAll('section[aria-labelledby]')].find(
      (s) => s.querySelector('h2')?.textContent === t('coquille.apropos.attribution.titre'),
    );
    expect(attribution?.textContent.includes(t('coquille.apropos.attribution.texte'))).toBe(true);
  });

  test('chaque texte complet se lit dans le panneau, à la demande, tel que son fichier ; un seul à la fois, que « Fermer le texte » retire', async () => {
    const conteneur = monterSeul(facadeDEpreuve());
    expect(conteneur.querySelector('[data-texte-licence]')).toBeNull();
    const commandes = { agpl: 'lireAgpl', liliq: 'lireLiliq' };
    for (const { nom, fichier } of LICENCES) {
      conteneur.querySelector(`[data-commande="${commandes[nom]}"]`).click();
      const disque = await commands.readFile(`public/licences/${fichier}`);
      await vi.waitFor(() => {
        flushSync();
        expect(conteneur.querySelector(`[data-texte-licence="${nom}"]`)?.textContent).toBe(disque);
      });
      expect(conteneur.querySelectorAll('[data-texte-licence]').length).toBe(1);
      const pre = conteneur.querySelector('[data-texte-licence]');
      expect(pre.scrollWidth, nom).toBeLessThanOrEqual(pre.clientWidth + 1);
    }
    conteneur.querySelector('[data-commande="fermerTexte"]').click();
    flushSync();
    expect(conteneur.querySelector('[data-texte-licence]')).toBeNull();
  });
});

describe('« À propos » : le sommaire des fonctionnalités (§ 2.2)', () => {
  test('chaque catégorie, dans l’ordre, sous son libellé, puis chacune de ses fonctionnalités, son numéro avant son intitulé', () => {
    const conteneur = monterSeul(facadeDEpreuve());
    const blocs = [...conteneur.querySelectorAll('[data-categorie]')];
    expect(blocs.map((b) => b.dataset.categorie)).toEqual(CATEGORIES.map(({ code }) => code));
    for (const { code, fonctionnalites } of CATEGORIES) {
      const bloc = conteneur.querySelector(`[data-categorie="${code}"]`);
      expect(bloc.querySelector('h3')?.textContent, code).toBe(t(cleDeCategorie(code)));
      const lignes = [...bloc.querySelectorAll('[data-fonctionnalite]')];
      expect(lignes.map((l) => l.dataset.fonctionnalite), code).toEqual(fonctionnalites.map(({ numero }) => numero));
      for (const ligne of lignes) {
        const numero = ligne.dataset.fonctionnalite;
        expect(ligne.textContent.replace(/\s+/gu, ' ').trim(), numero).toBe(`${numero} ${t(cleDeFonctionnalite(numero))}`);
      }
    }
  });
});
