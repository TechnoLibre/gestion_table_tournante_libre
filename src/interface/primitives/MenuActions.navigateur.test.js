// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du menu d'actions dans un vrai moteur de rendu (§ 2.1, § 14.5,
// § 14.6) : le motif du bouton de menu de WAI-ARIA — ses attributs, le menu
// et ses éléments —, l'ouverture au pointeur et au clavier, les
// déplacements, la fermeture par Échap, par Tab et par un clic au dehors ;
// l'anneau de focus ; l'exécution d'un élément, qui ferme le menu et retient
// le reste d'une série de clics, et son refus, qui reste posé à côté du
// bouton, désigné par lui. Le menu se monte par mount avec les
// contextes que pose App — 't', 'seance', 'horloge' — ; la séance est une
// doublure qui compte ses appels, l'horloge, pilotée, n'avance que sous
// l'épreuve. Les gestes passent par des entrées que
// Chromium traite comme réelles (test/navigateur/entrees.js). Les noms
// d'épreuve sont inventés.
import { afterEach, describe, expect, test } from 'vitest';
import { cdp } from 'vitest/browser';
import { flushSync, mount, tick, unmount } from 'svelte';
import '../jetons.css';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerHorlogePilotee } from '../../application/horloge.js';
import { creerTraduction } from '../../application/traduction.js';
import { pointer, touche } from '../../../test/navigateur/entrees.js';
import { actionDe, actionsDe, boutonActions, ouvrirActions } from '../../../test/navigateur/menus.js';
import { composantes, sousTheme, visible } from '../../../test/navigateur/rendu.js';
import { TABLES_INTERFACE } from '../libelles.js';
import MenuActions from './MenuActions.svelte';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

const NOM_MENU = 'Actions de la soirée des Merles';

// Les montages de l'épreuve courante, leurs conteneurs et leurs horloges.
const montes = [];

// Chaque horloge passe le délai d'une série de clics : l'écoute qu'une
// épreuve laisse posée se retire avant la suivante.
afterEach(() => {
  for (const { composant, cible, horloge } of montes.splice(0)) {
    horloge.avancer(DELAI_SERIE);
    unmount(composant);
    cible.remove();
  }
});

// Trois éléments inventés, chacun comptant ses exécutions dans appels ; le
// deuxième se nomme par une phrase distincte de son libellé. executer
// remplace l'exécution d'un élément, par sa désignation.
function elementsEssai(appels, executer = {}) {
  const element = (cle, nom, nomAccessible = null) => ({
    cle,
    nom,
    nomAccessible,
    executer: () => {
      appels.push(nom);
      return executer[nom]?.() ?? null;
    },
  });
  return [
    element('propositions.commande.voir', 'voir'),
    element('propositions.commande.repartir', 'repartir', 'Repartir de la soirée des Merles'),
    element('propositions.commande.retenir', 'retenir'),
  ];
}

// Monte le menu au début du corps, suivi d'un bouton témoin, le contrôle
// que Tab atteint après le menu, sous une horloge pilotée qu'il rend. La séance, une doublure : passerEnEcriture
// compte ses appels, le remède « Modifier » d'un refus passe par elle.
function monter({ executer = {} } = {}) {
  const appels = [];
  const seance = { ecritures: 0, passerEnEcriture: async () => (seance.ecritures += 1) };
  const cible = document.createElement('div');
  document.body.prepend(cible);
  const horloge = creerHorlogePilotee();
  const contexte = new Map([
    ['t', t],
    ['seance', seance],
    ['horloge', horloge],
  ]);
  const composant = mount(MenuActions, { target: cible, props: { nomAccessible: NOM_MENU, elements: elementsEssai(appels, executer) }, context: contexte });
  const apres = document.createElement('button');
  apres.type = 'button';
  apres.textContent = 'Témoin';
  cible.append(apres);
  flushSync();
  montes.push({ composant, cible, horloge });
  const bouton = boutonActions(cible);
  const menu = () => document.getElementById(bouton.getAttribute('aria-controls'));
  const items = () => [...menu().querySelectorAll('[role="menuitem"]')];
  return { cible, bouton, menu, items, appels, seance, apres, horloge };
}

const centre = (element) => {
  const b = element.getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
};

// Un clic réel au centre de l'élément, puis le rendu.
async function cliquer(element) {
  const { x, y } = centre(element);
  await pointer('presser', x, y);
  await pointer('relacher', x, y);
  await tick();
  flushSync();
}

// Un appui réel au point (x, y), de rang clickCount dans une série de
// clics, son relâcher, puis le rendu.
async function appuyerAuPoint(x, y, clickCount) {
  await pointer('presser', x, y, { clickCount });
  await pointer('relacher', x, y, { clickCount });
  await tick();
  flushSync();
}

// Une touche réelle sur l'élément qui a le focus, puis le rendu.
async function appuyer(cle) {
  await touche(cle);
  await tick();
  flushSync();
}

// Maj+Tab, réel : Tab sous le modificateur Maj (8 pour CDP).
async function majTab() {
  const commun = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9, modifiers: 8 };
  await cdp().send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...commun });
  await cdp().send('Input.dispatchKeyEvent', { type: 'keyUp', ...commun });
  await tick();
  flushSync();
}

// Une touche tenue : un appui, puis repetitions appuis que Chromium marque
// répétés (autoRepeat), et un seul relâcher.
async function tenir(cle, texte, virtuelle, repetitions) {
  const commun = { key: cle, code: cle === ' ' ? 'Space' : cle, windowsVirtualKeyCode: virtuelle, nativeVirtualKeyCode: virtuelle };
  const appui = { type: 'keyDown', ...commun, text: texte, unmodifiedText: texte };
  await cdp().send('Input.dispatchKeyEvent', appui);
  for (let n = 0; n < repetitions; n += 1) await cdp().send('Input.dispatchKeyEvent', { ...appui, autoRepeat: true });
  await cdp().send('Input.dispatchKeyEvent', { type: 'keyUp', ...commun });
  await tick();
  flushSync();
}

// Les composantes de la couleur d'un jeton dans le thème posé, lue sur une
// sonde du corps.
function jeton(nom) {
  const sonde = document.createElement('span');
  sonde.style.color = `var(${nom})`;
  document.body.append(sonde);
  const couleur = composantes(getComputedStyle(sonde).color);
  sonde.remove();
  return couleur;
}

// L'élément qui a le focus porte l'anneau du focus clavier, dans les deux
// thèmes : :focus-visible, un trait plein de 2 px de la couleur du focus.
async function exigerAnneau(element) {
  expect(document.activeElement).toBe(element);
  for (const theme of ['clair', 'sombre']) {
    await sousTheme(theme, () => {
      const style = getComputedStyle(element);
      expect(element.matches(':focus-visible'), theme).toBe(true);
      expect(style.outlineStyle, theme).toBe('solid');
      expect(parseFloat(style.outlineWidth), theme).toBeGreaterThanOrEqual(2);
      expect(composantes(style.outlineColor), theme).toEqual(jeton('--couleur-focus'));
    });
  }
}

// Le délai de double-clic de l'écoute qui retient le reste d'une série, en
// ms (MenuActions.svelte).
const DELAI_SERIE = 500;

// Deux menus : celui du dessous, monté d'abord, puis le menu de l'épreuve,
// ouvert, le focus sur son premier élément. Le menu du dessous, en position
// fixe loin du bouton du menu, se pose ensuite sous le troisième élément du
// menu ouvert, au point (x, y). recus : les pointerdown, pointerup et clics
// — ceux-ci avec leur detail — qui atteignent le conteneur du dessous.
async function poserDessous() {
  const dessous = monter();
  const m = monter();
  dessous.cible.style.cssText = 'position: fixed; right: 0; bottom: 0;';
  const recus = [];
  dessous.cible.addEventListener('pointerdown', () => recus.push('pointerdown'));
  dessous.cible.addEventListener('pointerup', () => recus.push('pointerup'));
  dessous.cible.addEventListener('click', (evenement) => recus.push(`click:${evenement.detail}`));
  await cliquer(m.bouton);
  exigerOuvert(m, 0);
  const { x, y } = centre(m.items()[2]);
  const b = dessous.bouton.getBoundingClientRect();
  dessous.cible.style.cssText = `position: fixed; left: ${x - b.width / 2}px; top: ${y - b.height / 2}px;`;
  expect(document.elementFromPoint(x, y)).toBe(m.items()[2]);
  return { m, dessous, x, y, recus };
}

// Un appui réel sur le bouton, relâché au coin bas gauche de la fenêtre,
// hors du bouton et du menu : aucun clic ne suit.
async function appuyerBoutonRelacherAuDehors(m) {
  const { x, y } = centre(m.bouton);
  await pointer('presser', x, y);
  await pointer('bouger', 4, innerHeight - 4);
  await pointer('relacher', 4, innerHeight - 4);
  await tick();
  flushSync();
}

// Le menu est fermé : le bouton le dit, et le menu n'a aucun élément.
function exigerFerme({ bouton, menu }) {
  expect(bouton.getAttribute('aria-expanded')).toBe('false');
  expect(menu().hidden).toBe(true);
  expect(menu().querySelectorAll('[role="menuitem"]')).toHaveLength(0);
}

// Le menu est ouvert, visible, et le focus sur son élément de rang rang.
function exigerOuvert({ bouton, menu, items }, rang) {
  expect(bouton.getAttribute('aria-expanded')).toBe('true');
  expect(menu().hidden).toBe(false);
  expect(visible(menu())).toBe(true);
  expect(document.activeElement).toBe(items()[rang]);
}

describe('le motif du bouton de menu (WAI-ARIA)', () => {
  test('fermé : un bouton « Actions » qui annonce son menu, nommé par la phrase reçue, le menu caché et vide', () => {
    const m = monter();
    expect(m.bouton.localName).toBe('button');
    expect(m.bouton.textContent.trim()).toBe(t('communs.menu.actions'));
    expect(m.bouton.getAttribute('aria-label')).toBe(NOM_MENU);
    expect(m.bouton.getAttribute('aria-haspopup')).toBe('menu');
    expect(m.menu()).not.toBeNull();
    expect(m.menu().getAttribute('role')).toBe('menu');
    expect(m.menu().getAttribute('aria-labelledby')).toBe(m.bouton.id);
    expect(m.bouton.getAttribute('aria-describedby')).toBeNull();
    exigerFerme(m);
  });

  test('ouvert au pointeur : chaque élément un menuitem hors de l’ordre de Tab, dans l’ordre reçu, sa désignation, son libellé et son nom ; le focus sur le premier', async () => {
    const m = monter();
    await cliquer(m.bouton);
    exigerOuvert(m, 0);
    expect(m.items().map((item) => item.dataset.commande)).toEqual(['voir', 'repartir', 'retenir']);
    expect(m.items().map((item) => item.getAttribute('tabindex'))).toEqual(['-1', '-1', '-1']);
    expect(m.items().map((item) => item.textContent.trim())).toEqual(['propositions.commande.voir', 'propositions.commande.repartir', 'propositions.commande.retenir'].map((cle) => t(cle)));
    expect(m.items().map((item) => item.getAttribute('aria-label'))).toEqual([null, 'Repartir de la soirée des Merles', null]);
    for (const item of m.items()) expect(item.closest('[role="menu"]')).toBe(m.menu());
    // Rien ne s'exécute à l'ouverture ; un second clic sur le bouton ferme.
    expect(m.appels).toEqual([]);
    await cliquer(m.bouton);
    exigerFerme(m);
  });

  test('le menu ouvert se pose sous son bouton, dans la fenêtre, au-dessus du reste de la page', async () => {
    const m = monter();
    await cliquer(m.bouton);
    const b = m.bouton.getBoundingClientRect();
    const r = m.menu().getBoundingClientRect();
    expect(r.top).toBeGreaterThanOrEqual(b.bottom);
    expect(r.left).toBeGreaterThanOrEqual(0);
    expect(r.right).toBeLessThanOrEqual(innerWidth);
    expect(r.bottom).toBeLessThanOrEqual(innerHeight);
    expect(getComputedStyle(m.menu()).position).toBe('fixed');
  });
});

describe('le clavier', () => {
  test('Entrée, Espace et ↓ ouvrent sur le premier élément, ↑ sur le dernier ; Échap ferme et rend le focus au bouton ; aucune ouverture n’exécute', async () => {
    const m = monter();
    for (const [cle, rang] of [['Enter', 0], [' ', 0], ['ArrowDown', 0], ['ArrowUp', 2]]) {
      m.bouton.focus();
      await appuyer(cle);
      exigerOuvert(m, rang);
      await appuyer('Escape');
      exigerFerme(m);
      expect(document.activeElement, cle).toBe(m.bouton);
    }
    expect(m.appels).toEqual([]);
  });

  test('↓ et ↑ passent d’un élément à l’autre et bouclent ; Début et Fin vont aux bouts', async () => {
    const m = monter();
    m.bouton.focus();
    await appuyer('ArrowDown');
    const rangs = [];
    for (const cle of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowUp', 'End', 'Home', 'ArrowUp']) {
      await appuyer(cle);
      rangs.push(m.items().indexOf(document.activeElement));
    }
    expect(rangs).toEqual([1, 2, 0, 2, 2, 0, 2]);
    expect(m.appels).toEqual([]);
  });

  test('Tab ferme le menu et passe au contrôle suivant ; Maj+Tab le ferme et rend le focus au bouton', async () => {
    const m = monter();
    m.bouton.focus();
    await appuyer('Enter');
    await appuyer('Tab');
    exigerFerme(m);
    expect(document.activeElement).toBe(m.apres);
    m.bouton.focus();
    await appuyer('ArrowUp');
    await majTab();
    exigerFerme(m);
    expect(document.activeElement).toBe(m.bouton);
  });

  test('ouvert au clavier, l’élément qui reçoit le focus porte l’anneau de focus, et le bouton aussi après Échap, dans les deux thèmes', async () => {
    const m = monter();
    m.bouton.focus();
    await appuyer('ArrowDown');
    exigerOuvert(m, 0);
    await exigerAnneau(m.items()[0]);
    await appuyer('ArrowDown');
    await exigerAnneau(m.items()[1]);
    await appuyer('Escape');
    exigerFerme(m);
    await exigerAnneau(m.bouton);
  });

  test('Entrée sur un élément l’exécute une fois, même tenue, et ferme le menu, le focus rendu au bouton', async () => {
    const m = monter();
    m.bouton.focus();
    await appuyer('ArrowDown');
    await appuyer('ArrowDown');
    await tenir('Enter', '\r', 13, 3);
    expect(m.appels).toEqual(['repartir']);
    exigerFerme(m);
    expect(document.activeElement).toBe(m.bouton);
  });

  test('Espace tenue sur le bouton ouvre le menu sans exécuter son premier élément', async () => {
    const m = monter();
    m.bouton.focus();
    await tenir(' ', ' ', 32, 2);
    exigerOuvert(m, 0);
    expect(m.appels).toEqual([]);
  });
});

describe('le pointeur', () => {
  test('un clic au dehors ferme le menu sans rien exécuter', async () => {
    const m = monter();
    await cliquer(m.bouton);
    exigerOuvert(m, 0);
    await pointer('presser', 4, innerHeight - 4);
    await pointer('relacher', 4, innerHeight - 4);
    await tick();
    flushSync();
    exigerFerme(m);
    expect(m.appels).toEqual([]);
  });

  test('un appui au dehors qui ne déplace pas le focus ferme le menu sans rien exécuter, le focus rendu au bouton', async () => {
    const m = monter();
    // Une zone dont l'appui retient le focus — mousedown sans son effet —,
    // au coin de la fenêtre, loin du menu ouvert.
    const zone = document.createElement('div');
    zone.style.cssText = 'position: fixed; right: 0; bottom: 0; width: 200px; height: 40px;';
    let appuis = 0;
    zone.addEventListener('mousedown', (evenement) => {
      appuis += 1;
      evenement.preventDefault();
    });
    m.cible.append(zone);
    await cliquer(m.bouton);
    exigerOuvert(m, 0);
    const { x, y } = centre(zone);
    await pointer('presser', x, y);
    await pointer('relacher', x, y);
    await tick();
    flushSync();
    expect(appuis).toBe(1);
    exigerFerme(m);
    expect(m.appels).toEqual([]);
    expect(document.activeElement).toBe(m.bouton);
  });

  test('un clic sur un élément l’exécute et ferme le menu, le focus rendu au bouton ; un clic répété d’une série — detail 2 — qui atteint un élément n’exécute rien', async () => {
    const m = monter();
    await cliquer(m.bouton);
    await cliquer(m.items()[2]);
    expect(m.appels).toEqual(['retenir']);
    exigerFerme(m);
    expect(document.activeElement).toBe(m.bouton);
    await cliquer(m.bouton);
    exigerOuvert(m, 0);
    const { x, y } = centre(m.items()[0]);
    await pointer('presser', x, y, { clickCount: 2 });
    await pointer('relacher', x, y, { clickCount: 2 });
    await tick();
    flushSync();
    expect(m.appels).toEqual(['retenir']);
    exigerOuvert(m, 0);
  });

  test('un double-clic sur un élément l’exécute une fois ; le second clic n’atteint pas le menu que le premier découvre, ni son pointerdown ni son pointerup, et le focus reste au bouton ; l’appui suivant, de detail 1, l’atteint', async () => {
    const { m, dessous, x, y, recus } = await poserDessous();
    await appuyerAuPoint(x, y, 1);
    exigerFerme(m);
    // Le menu fermé découvre le bouton du dessous, là où tombe le second clic.
    expect(dessous.bouton.contains(document.elementFromPoint(x, y))).toBe(true);
    await appuyerAuPoint(x, y, 2);
    expect(m.appels).toEqual(['retenir']);
    expect(dessous.appels).toEqual([]);
    expect(recus).toEqual([]);
    exigerFerme(dessous);
    expect(document.activeElement).toBe(m.bouton);
    // Une série neuve atteint le bouton du dessous.
    await cliquer(dessous.bouton);
    exigerOuvert(dessous, 0);
  });

  test('l’écoute tient le délai d’un double-clic, que chaque appui retenu rouvre ; passé ce délai, elle s’est retirée et un appui au même point atteint ce que le menu couvrait, pointerdown compris', async () => {
    const { m, x, y, recus } = await poserDessous();
    await appuyerAuPoint(x, y, 1);
    exigerFerme(m);
    m.horloge.avancer(DELAI_SERIE - 100);
    await appuyerAuPoint(x, y, 2);
    // Le second appui rouvre le délai : le troisième, au-delà du premier
    // délai, reste retenu.
    m.horloge.avancer(DELAI_SERIE - 100);
    await appuyerAuPoint(x, y, 3);
    expect(recus).toEqual([]);
    m.horloge.avancer(DELAI_SERIE);
    await appuyerAuPoint(x, y, 2);
    expect(recus).toEqual(['pointerdown', 'pointerup', 'click:2']);
  });

  test('l’écoute retirée par un appui de detail 1 emporte sa minuterie : l’écoute posée ensuite tient son propre délai', async () => {
    const { m, x, y, recus } = await poserDessous();
    await appuyerAuPoint(x, y, 1);
    // Rouvrir le menu, un clic de detail 1, retire la première écoute ; un
    // second élément exécuté en pose une autre.
    m.horloge.avancer(DELAI_SERIE * 0.6);
    await cliquer(m.bouton);
    exigerOuvert(m, 0);
    expect(document.elementFromPoint(x, y)).toBe(m.items()[2]);
    await appuyerAuPoint(x, y, 1);
    expect(m.appels).toEqual(['retenir', 'retenir']);
    // Passé le délai de la première écoute, dans celui de la seconde : le
    // second clic d'un double-clic reste retenu.
    m.horloge.avancer(DELAI_SERIE * 0.6);
    await appuyerAuPoint(x, y, 2);
    expect(recus).toEqual([]);
  });

  test('un double-clic sur le bouton fermé ouvre le menu, que le second clic laisse ouvert, le focus sur son premier élément, sans rien exécuter', async () => {
    const m = monter();
    const { x, y } = centre(m.bouton);
    for (const clickCount of [1, 2]) {
      await pointer('presser', x, y, { clickCount });
      await pointer('relacher', x, y, { clickCount });
    }
    await tick();
    flushSync();
    exigerOuvert(m, 0);
    expect(m.appels).toEqual([]);
  });

  test('un appui d’un autre bouton que le principal sur le bouton du menu ouvert ne compte pas : après ↓ dans le menu, Maj+Tab le ferme et rend le focus au bouton', async () => {
    const m = monter();
    // Aucun menu contextuel ne s'ouvre pendant l'épreuve.
    const sansMenu = (evenement) => evenement.preventDefault();
    document.addEventListener('contextmenu', sansMenu);
    try {
      await cliquer(m.bouton);
      exigerOuvert(m, 0);
      const { x, y } = centre(m.bouton);
      await pointer('presser', x, y, { boutons: 2 });
      await pointer('relacher', x, y);
      await tick();
      flushSync();
      m.bouton.focus();
      await appuyer('ArrowDown');
      exigerOuvert(m, 0);
      await majTab();
      exigerFerme(m);
      expect(document.activeElement).toBe(m.bouton);
      expect(m.appels).toEqual([]);
    } finally {
      document.removeEventListener('contextmenu', sansMenu);
    }
  });

  test('un appui sur le bouton du menu ouvert, relâché au dehors, laisse le menu ouvert, le focus au bouton : Échap le ferme, Tab aussi', async () => {
    const m = monter();
    await cliquer(m.bouton);
    exigerOuvert(m, 0);
    await appuyerBoutonRelacherAuDehors(m);
    expect(m.bouton.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(m.bouton);
    await appuyer('Escape');
    exigerFerme(m);
    expect(document.activeElement).toBe(m.bouton);
    await cliquer(m.bouton);
    await appuyerBoutonRelacherAuDehors(m);
    await appuyer('Tab');
    exigerFerme(m);
    expect(document.activeElement).toBe(m.apres);
    expect(m.appels).toEqual([]);
  });

  test('après un appui sur le bouton relâché au dehors, Maj+Tab depuis le menu le ferme et rend le focus au bouton', async () => {
    const m = monter();
    await cliquer(m.bouton);
    await appuyerBoutonRelacherAuDehors(m);
    // Un clic dans la marge du menu, hors de ses éléments, y porte le focus.
    const r = m.menu().getBoundingClientRect();
    await pointer('presser', r.left + 3, r.top + r.height / 2);
    await pointer('relacher', r.left + 3, r.top + r.height / 2);
    await tick();
    flushSync();
    expect(document.activeElement).toBe(m.menu());
    await majTab();
    exigerFerme(m);
    expect(document.activeElement).toBe(m.bouton);
    expect(m.appels).toEqual([]);
  });
});

describe('le refus et l’exécution en cours', () => {
  const refuser = () => {
    throw Object.assign(new Error('refus'), { code: 'MODE_LECTURE', details: { remede: { geste: 'modifier' } } });
  };

  test('un élément refusé ferme le menu ; le refus reste à côté du bouton, que le bouton désigne, avec son remède ; l’exécution suivante le retire', async () => {
    let refuse = true;
    const m = monter({ executer: { retenir: () => (refuse ? refuser() : null) } });
    await cliquer(m.bouton);
    await cliquer(m.items()[2]);
    exigerFerme(m);
    const refus = m.cible.querySelector('[data-refus="MODE_LECTURE"]');
    expect(refus).not.toBeNull();
    expect(visible(refus)).toBe(true);
    expect(refus.getAttribute('role')).toBe('status');
    expect(refus.textContent).toContain(t('MODE_LECTURE'));
    expect(m.bouton.getAttribute('aria-describedby')).toBe(refus.id);
    expect(document.activeElement).toBe(m.bouton);
    // Le remède se nomme par son texte et par le nom du menu.
    const remede = refus.querySelector('[data-commande="modifier"]');
    expect(remede.getAttribute('aria-label')).toBe(t('communs.nom.remede', { cle: 'communs.remede.modifier', objet: NOM_MENU }));
    // Rouvrir le menu ne le retire pas ; une exécution aboutie, si.
    await cliquer(m.bouton);
    expect(m.cible.querySelector('[data-refus="MODE_LECTURE"]')).not.toBeNull();
    refuse = false;
    await cliquer(actionDe(m.cible, 'retenir'));
    expect(m.cible.querySelector('[data-refus]')).toBeNull();
    expect(m.bouton.getAttribute('aria-describedby')).toBeNull();
  });

  test('le remède du refus abouti le retire, et rend le focus au bouton', async () => {
    const m = monter({ executer: { retenir: refuser } });
    await cliquer(m.bouton);
    await cliquer(m.items()[2]);
    const remede = m.cible.querySelector('[data-refus] [data-commande="modifier"]');
    remede.focus();
    remede.click();
    await expect.poll(() => m.cible.querySelector('[data-refus]')).toBeNull();
    expect(m.seance.ecritures).toBe(1);
    expect(document.activeElement).toBe(m.bouton);
  });

  test('pendant une exécution qui rend une promesse, le menu fermé, le bouton est occupé ; rouvert, l’élément en cours l’est aussi, chaque élément est désactivé, et aucun clic ne relance rien ; aboutie, plus rien n’est occupé ni désactivé', async () => {
    let finir;
    const m = monter({ executer: { voir: () => new Promise((resoudre) => (finir = resoudre)) } });
    await cliquer(m.bouton);
    await cliquer(m.items()[0]);
    exigerFerme(m);
    expect(m.bouton.getAttribute('aria-busy')).toBe('true');
    expect(m.bouton.getAttribute('aria-disabled')).toBe('true');
    await cliquer(m.bouton);
    expect(m.items().map((item) => item.getAttribute('aria-busy'))).toEqual(['true', null, null]);
    expect(m.items().map((item) => item.getAttribute('aria-disabled'))).toEqual(['true', 'true', 'true']);
    await cliquer(m.items()[0]);
    await cliquer(actionDe(m.cible, 'retenir'));
    expect(m.appels).toEqual(['voir']);
    finir();
    await expect.poll(() => m.bouton.getAttribute('aria-busy')).toBeNull();
    expect(m.bouton.getAttribute('aria-disabled')).toBeNull();
    expect(m.bouton.getAttribute('aria-expanded')).toBe('true');
    expect(m.items().map((item) => item.getAttribute('aria-busy'))).toEqual([null, null, null]);
    expect(m.items().map((item) => item.getAttribute('aria-disabled'))).toEqual([null, null, null]);
  });
});

describe('l’aide des épreuves (test/navigateur/menus.js)', () => {
  test('ouvrirActions ouvre le menu d’un conteneur et le rend ; actionDe et actionsDe lisent ses éléments, le menu ouvert d’abord', () => {
    const m = monter();
    exigerFerme(m);
    expect(ouvrirActions(m.cible)).toBe(m.menu());
    expect(m.bouton.getAttribute('aria-expanded')).toBe('true');
    // Ouvert, il le reste.
    expect(ouvrirActions(m.cible)).toBe(m.menu());
    expect(m.bouton.getAttribute('aria-expanded')).toBe('true');
    expect(actionsDe(m.cible)).toEqual(['voir', 'repartir', 'retenir']);
    expect(actionDe(m.cible, 'repartir')).toBe(m.items()[1]);
    expect(actionDe(m.cible, 'comparer')).toBeNull();
  });

  test('un conteneur sans menu, ou qui en porte deux, lève', () => {
    const m = monter();
    const vide = document.createElement('div');
    expect(() => ouvrirActions(vide)).toThrow(/aucun menu/);
    const double = document.createElement('div');
    double.append(m.bouton.cloneNode(true), m.bouton.cloneNode(true));
    expect(() => boutonActions(double)).toThrow(/2 menus/);
  });
});
