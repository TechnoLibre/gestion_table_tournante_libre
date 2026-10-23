// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// L'enveloppe de l'événement ouvert dans un vrai moteur de rendu (§ 8.4,
// § 9, § 12.7, § 14.5) : la bande de mode sous le bandeau, la carte
// d'en-tête — le nom, le résumé chiffré, « Imprimer… » —, « Modifier » mis
// en valeur à sa place fixe, la suite des états du plan, la navigation
// groupée par phase, les avertissements en messages d'avis dont l'action
// n'est jamais rognée, le support rompu en message de refus. Chaque épreuve
// monte App par monterApp, au cadre de 1 366 × 700 sauf mention, et lit le
// rendu : la boîte, le style calculé, le texte, le nom accessible — jamais
// une classe. La couleur attendue d'un jeton se relit sur une sonde qui le
// peint ; un texte tient 4,5:1 et un signe 3:1 sur ce qui est peint sous
// lui, dans les deux thèmes.
//
// Les éléments s'atteignent par leurs désignations data-…, par leur rôle et
// leur nom accessible : la bande est la région d'état, enfant direct de
// l'écran ; la suite des états, le groupe nommé « État du plan » ; chaque
// phase, un groupe de la navigation nommé par son intertitre. Les noms
// d'épreuve sont inventés.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { flushSync } from 'svelte';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerFormat } from '../../application/format.js';
import { creerTraduction } from '../../application/traduction.js';
import { fixerCadre, touche } from '../../../test/navigateur/entrees.js';
import { monterApp } from '../../../test/navigateur/montage.js';
import { composantes, contraste, couleurTexte, fondPeintSous, porteursDeTexte, sousTheme, traductionEcran, visible } from '../../../test/navigateur/rendu.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { PHASES, SECTIONS } from './sections.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
// Le t de l'écran, celui qu'App pose au contexte (§ 14.6) : l'attendu d'un
// texte lu tel que l'écran le porte, insécables comprises.
const { t: tEcran } = traductionEcran();
const format = creerFormat(t);
const THEMES = ['clair', 'sombre'];

const NOMS = ['Ombrelle', 'Pervenche', 'Lacasse', 'Grisaille', 'Merlette', 'Fauvelle'];
const EVENEMENT = { nom: 'Cercle des Linottes', date: null, siegesParDefaut: 3, tours: 2 };

let montes = [];
async function monter(options) {
  const m = await monterApp(options);
  montes.push(m);
  return m;
}
beforeEach(async () => {
  await fixerCadre(1366, 700);
});
afterEach(() => {
  const erreurs = montes.flatMap((m) => m.erreurs());
  for (const m of montes.reverse()) m.demonter();
  montes = [];
  window.scrollTo(0, 0);
  expect(erreurs, 'erreurs reçues par le collecteur').toEqual([]);
});

// --- Les lectures du rendu ----------------------------------------------------

const dans = (m, selecteur) => m.racine.querySelector(selecteur);
const tous = (m, selecteur) => [...m.racine.querySelectorAll(selecteur)];
const ecran = (m) => dans(m, '[data-ecran="evenement"]');
const surface = (m) => dans(m, '[data-mode]');
const bande = (m) => ecran(m).querySelector(':scope > [role="status"]');
const fixe = (m, nom) => dans(m, `[data-place-fixe] [data-commande="${nom}"]`);
const etats = (m) => dans(m, `[role="group"][aria-label="${t('evenement.etat.titre')}"]`);
const navigation = (m) => dans(m, `nav[aria-label="${t('coquille.navigation')}"]`);
const boite = (element) => element.getBoundingClientRect();
const style = (element) => getComputedStyle(element);
const fond = (element) => composantes(style(element).backgroundColor);

// La couleur qu'un jeton donne dans le thème courant, relue sur une sonde.
function jeton(nom) {
  const sonde = document.createElement('span');
  sonde.style.color = `var(${nom})`;
  document.body.append(sonde);
  const couleur = composantes(getComputedStyle(sonde).color);
  sonde.remove();
  return couleur;
}

// La couleur du trait d'une icône des primitives.
const trait = (svg) => composantes(style(svg.querySelector('path')).stroke);

// Chaque texte visible sous racine tient 4,5:1 sur chaque couleur peinte
// sous lui.
function exigerTextesLisibles(racine, lieu) {
  const porteurs = porteursDeTexte(racine).filter(({ element }) => visible(element) === true);
  expect(porteurs.length, `${lieu} : aucun texte`).toBeGreaterThan(0);
  for (const porteur of porteurs) {
    const couleur = couleurTexte(porteur);
    const fonds = fondPeintSous(porteur);
    const nom = `${lieu} « ${porteur.element.textContent.trim().slice(0, 40)} »`;
    expect(fonds.length, `${nom} : aucun fond opaque`).toBeGreaterThan(0);
    for (const f of fonds) expect(contraste(couleur, f), `${nom} sur ${f}`).toBeGreaterThanOrEqual(4.5);
  }
}

// Une icône tient 3:1 sur chaque couleur peinte sous elle (§ 14.5).
function exigerSigneVisible(svg, lieu) {
  const couleur = trait(svg);
  const fonds = fondPeintSous(svg);
  expect(fonds.length, `${lieu} : aucun fond opaque sous le signe`).toBeGreaterThan(0);
  for (const f of fonds) expect(contraste(couleur, f), `${lieu} : signe sur ${f}`).toBeGreaterThanOrEqual(3);
}

// Attend que l'assertion passe, le rendu de Svelte à jour.
async function attendre(assertion) {
  for (let essai = 0; ; essai += 1) {
    flushSync();
    try {
      return assertion();
    } catch (erreur) {
      if (essai >= 200) throw erreur;
      await new Promise((resoudre) => requestAnimationFrame(resoudre));
    }
  }
}

// Un montage où l'événement neuf, aux champs donnés, est ouvert en lecture.
async function neuf(champs = {}, options = {}) {
  const m = await monter(options);
  await m.seance.creer({ ...EVENEMENT, ...champs });
  flushSync();
  return m;
}

// L'événement passé en écriture, une table de trois places créée, puis
// quatre personnes ajoutées : la quatrième annonce PLACES_MANQUANTES, dont
// le remède ouvre les tables.
async function enManque(m) {
  await m.seance.passerEnEcriture();
  await m.seance.executer('creerTable', { forme: 'ronde' });
  for (const nom of NOMS.slice(0, 4)) await m.seance.executer('ajouterParticipant', { champs: { nom } });
  flushSync();
}

// L'événement passé en écriture, une table de trois places créée, puis
// trois personnes de plus que de places : le manque donné, à chaque tour.
async function enManqueDe(m, manque) {
  await m.seance.passerEnEcriture();
  await m.seance.executer('creerTable', { forme: 'ronde' });
  for (let n = 0; n < EVENEMENT.siegesParDefaut + manque; n += 1) {
    await m.seance.executer('ajouterParticipant', { champs: { nom: `${NOMS[n % NOMS.length]} ${n + 1}` } });
  }
  flushSync();
}

// --- Les épreuves -----------------------------------------------------------------

describe('la bande de mode et la pleine fenêtre (§ 8.4)', () => {
  // 1 920 px dépasse --largeur-page, qui borne la liste des événements :
  // l'écran de l'événement n'y est pas borné.
  for (const largeur of [1366, 1920]) {
    test(`à ${largeur} px : la bande de bord à bord sous le bandeau, aux couleurs de chaque mode, à hauteur constante ; l’écran en pleine fenêtre, sans trait`, async () => {
      await fixerCadre(largeur, 700);
      const m = await neuf();
      const hauteurs = [];
      const relever = async (mode, cle, explication) => {
        flushSync();
        const region = bande(m);
        expect(region, mode).not.toBeNull();
        const b = boite(region);
        expect(Math.abs(b.top - boite(dans(m, '[data-bandeau]')).bottom), mode).toBeLessThanOrEqual(1);
        expect([b.left, b.right], mode).toEqual([0, innerWidth]);
        expect(document.documentElement.scrollWidth, mode).toBeLessThanOrEqual(innerWidth);
        expect(b.bottom, mode).toBeLessThanOrEqual(boite(surface(m)).top);
        // L'écran va d'un bord à l'autre de la fenêtre, au retrait de
        // l'écran près, et la barre, la tête et la surface avec lui, sans
        // trait autour d'elles.
        const retrait = Number.parseFloat(style(ecran(m).parentElement).paddingLeft);
        expect(retrait, mode).toBeGreaterThan(0);
        expect(retrait, mode).toBeLessThanOrEqual(32);
        for (const element of [ecran(m), surface(m)]) {
          const e = boite(element);
          expect(e.left, mode).toBeCloseTo(retrait, 0);
          expect(e.right, mode).toBeCloseTo(innerWidth - retrait, 0);
        }
        for (const cote of ['Top', 'Right', 'Bottom', 'Left']) {
          expect(Number.parseFloat(style(surface(m))[`border${cote}Width`]), `${mode} ${cote}`).toBe(0);
        }
        expect(region.textContent, mode).toContain(tEcran(cle));
        expect(region.textContent, mode).toContain(tEcran(explication));
        expect(region.textContent, mode).toContain(dans(m, '[data-mode-libelle="barre"]').textContent);
        expect(visible(region), mode).toBe(true);
        hauteurs.push(b.height);
        const icones = region.querySelectorAll('svg');
        expect(icones.length, mode).toBe(1);
        expect(icones[0].getAttribute('aria-hidden'), mode).toBe('true');
        for (const theme of THEMES) {
          await sousTheme(theme, () => {
            const lieu = `${theme} ${mode}`;
            expect(fond(region), lieu).toEqual(jeton(`--couleur-mode-${mode}-fond`));
            expect(composantes(style(region).borderBottomColor), lieu).toEqual(jeton(`--couleur-mode-${mode}-filet`));
            expect(trait(icones[0]), lieu).toEqual(jeton(`--couleur-mode-${mode}`));
            exigerSigneVisible(icones[0], lieu);
            exigerTextesLisibles(region, lieu);
          });
        }
      };
      await relever('lecture', 'coquille.mode.lecture', 'evenement.bande.lecture');
      await m.seance.passerEnEcriture();
      await relever('ecriture', 'coquille.mode.ecriture', 'evenement.bande.ecriture');
      await m.seance.executer('changerEtat', { etat: 'bloque' });
      await relever('bloque', 'coquille.mode.bloque', 'evenement.bande.bloque');
      expect(new Set(hauteurs).size).toBe(1);
      // Le plein écran du plan garde la bande.
      m.ui.allerA('plan');
      m.ui.basculerPleinEcran();
      flushSync();
      expect(visible(bande(m))).toBe(true);
    });
  }
});

describe('la carte d’en-tête', () => {
  test('la barre porte, après la place fixe, la suite des états puis « Imprimer… », principale, calée à droite ; la tête, le nom puis la date, les participants, les tables et leurs sièges, les tours ; le plein écran efface les uns et les autres', async () => {
    const m = await neuf({ date: '2031-05-17', siegesParDefaut: 4, tours: 3 });
    await m.seance.passerEnEcriture();
    for (const nom of NOMS) await m.seance.executer('ajouterParticipant', { champs: { nom } });
    for (let n = 0; n < 2; n += 1) await m.seance.executer('creerTable', { forme: 'ronde' });
    flushSync();
    const titre = dans(m, '[data-ecran="evenement"] header h1');
    expect(titre.textContent).toBe(EVENEMENT.nom);
    const entete = titre.closest('header');
    const attendus = [
      creerFormat(tEcran).date('2031-05-17'),
      t('evenement.resume.participants', { participants: 6 }),
      t('evenement.resume.tables', { tables: 2, sieges: 8 }),
      t('evenement.resume.tours', { tours: 3 }),
    ];
    const lus = [...entete.querySelectorAll('h1 ~ * > *')].map((element) => element.textContent.trim());
    expect(lus).toEqual(attendus);
    // Le nom et son résumé tiennent sur une ligne.
    expect(boite(entete.querySelector('h1 ~ *')).top).toBeLessThan(boite(titre).bottom);
    const imprimer = dans(m, '[data-ecran="evenement"] [data-commande="apercu"]');
    expect(imprimer.textContent).toBe(t('impression.commande.ouvrir'));
    expect(entete.contains(imprimer)).toBe(false);
    const place = boite(fixe(m, 'lecture'));
    const [i, e, c] = [boite(imprimer), boite(etats(m)), boite(surface(m))];
    expect(i.top).toBe(place.top);
    expect(i.height).toBeGreaterThanOrEqual(44);
    expect(c.right - i.right).toBeLessThanOrEqual(24);
    expect(e.left).toBeGreaterThan(place.right);
    expect(e.top).toBeGreaterThanOrEqual(place.top);
    expect(e.bottom).toBeLessThanOrEqual(place.bottom);
    expect(i.left).toBeGreaterThan(e.right);
    for (const theme of THEMES) {
      await sousTheme(theme, () => {
        expect(fond(imprimer), theme).toEqual(jeton('--couleur-action-fond'));
        expect(fondPeintSous(titre), theme).toEqual([jeton('--couleur-carte-fond')]);
        expect(fondPeintSous(etats(m)), theme).toEqual([jeton('--couleur-carte-fond-sourd')]);
        exigerTextesLisibles(entete, theme);
      });
    }
    m.ui.allerA('plan');
    m.ui.basculerPleinEcran();
    flushSync();
    expect(dans(m, '[data-commande="apercu"]')).toBeNull();
    expect(etats(m)).toBeNull();
    expect(dans(m, '[data-ecran="evenement"] header')).toBeNull();
  });

  test('sans date, le résumé commence aux participants', async () => {
    const m = await neuf();
    const entete = dans(m, '[data-ecran="evenement"] header');
    const lus = [...entete.querySelectorAll('h1 ~ * > *')].map((element) => element.textContent.trim());
    expect(lus).toEqual([
      t('evenement.resume.participants', { participants: 0 }),
      t('evenement.resume.tables', { tables: 0, sieges: 0 }),
      t('evenement.resume.tours', { tours: EVENEMENT.tours }),
    ]);
  });
});

describe('« Modifier » mis en valeur à sa place fixe (§ 8.4)', () => {
  test('en lecture, « Modifier » est l’action principale ; « Revenir en lecture » et « Débloquer » ne le sont pas ; la surface ne bouge pas d’un mode à l’autre', async () => {
    const m = await neuf();
    const surface = () => boite(dans(m, '[data-section]')).top;
    const avant = surface();
    for (const theme of THEMES) {
      await sousTheme(theme, () => {
        expect(fond(fixe(m, 'modifier')), theme).toEqual(jeton('--couleur-action-fond'));
        expect(composantes(style(fixe(m, 'modifier')).color), theme).toEqual(jeton('--couleur-action-texte'));
      });
    }
    expect(boite(fixe(m, 'modifier')).height).toBeGreaterThanOrEqual(44);
    await m.seance.passerEnEcriture();
    flushSync();
    expect(fond(fixe(m, 'lecture'))).not.toEqual(jeton('--couleur-action-fond'));
    expect(surface()).toBe(avant);
    await m.seance.executer('changerEtat', { etat: 'bloque' });
    flushSync();
    expect(fond(fixe(m, 'debloquer'))).not.toEqual(jeton('--couleur-action-fond'));
    expect(surface()).toBe(avant);
  });
});

describe('la suite des états du plan (§ 9)', () => {
  test('quatre étapes séparées de chevrons, sous l’intertitre « État du plan » ; l’état courant porte le fond de sa teinte, son icône et le gras ; les autres gardent leur nom et restent atteints', async () => {
    const m = await neuf();
    await m.seance.passerEnEcriture();
    const groupe = etats(m);
    expect(groupe).not.toBeNull();
    const verifier = async (courant) => {
      flushSync();
      const etapes = [...groupe.querySelectorAll('[data-etat]')];
      expect(etapes.map((etape) => etape.dataset.etat)).toEqual(['brouillon', 'propose', 'retenu', 'bloque']);
      // Les chevrons séparent les étapes, hors d'elles, cachés à
      // l'assistance.
      const chevrons = [...groupe.querySelectorAll('svg')].filter((svg) => svg.closest('[data-etat]') === null);
      expect(chevrons.length).toBe(3);
      for (const chevron of chevrons) expect(chevron.closest('[aria-hidden="true"]')).not.toBeNull();
      for (const etape of etapes) {
        const { etat } = etape.dataset;
        const bouton = etape.querySelector('[data-commande="etat"]');
        expect(bouton.textContent, etat).toBe(t(`evenement.etat.${etat}`));
        expect(visible(bouton), etat).toBe(true);
        const icones = etape.querySelectorAll('svg');
        expect(icones.length, etat).toBe(1);
        // L'icône est dans la boîte du bouton : l'étape se lit d'un bloc.
        const [b, i] = [boite(bouton), boite(icones[0])];
        expect(i.left >= b.left && i.right <= b.right && i.top >= b.top && i.bottom <= b.bottom, etat).toBe(true);
        for (const theme of THEMES) {
          await sousTheme(theme, () => {
            const lieu = `${theme} ${etat}`;
            expect(trait(icones[0]), lieu).toEqual(jeton(`--couleur-etat-${etat}-marque`));
            exigerSigneVisible(icones[0], lieu);
            exigerTextesLisibles(etape, lieu);
            if (etat === courant) {
              expect(fond(bouton), lieu).toEqual(jeton(`--couleur-etat-${etat}-fond`));
              expect(style(etape).fontWeight, lieu).toBe('700');
              expect(style(bouton).fontWeight, lieu).toBe('700');
            } else {
              expect(fond(bouton), lieu).not.toEqual(jeton(`--couleur-etat-${etat}-fond`));
              expect(style(bouton).fontWeight, lieu).toBe('400');
            }
          });
        }
      }
      // L'intertitre est en petites capitales, d'une encre neutre.
      const intertitre = [...groupe.querySelectorAll('*')].find(
        (n) => n.textContent === t('evenement.etat.titre') && n.children.length === 0,
      );
      expect(intertitre).not.toBeUndefined();
      expect(style(intertitre).textTransform).toBe('uppercase');
      expect(composantes(style(intertitre).color)).toEqual(jeton('--couleur-page-texte-secondaire'));
    };
    await verifier('brouillon');
    await m.seance.executer('changerEtat', { etat: 'bloque' });
    await verifier('bloque');
  });
});

describe('la navigation groupée par phase', () => {
  test('trois groupes nommés par leur intertitre — préparer, placer, produire —, chacun ses sections dans l’ordre ; l’onglet courant souligné de l’action et gras', async () => {
    const m = await neuf();
    const nav = navigation(m);
    expect(nav).not.toBeNull();
    const groupes = [...nav.querySelectorAll('[role="group"]')];
    expect(groupes.length).toBe(PHASES.length);
    groupes.forEach((groupe, rang) => {
      const phase = PHASES[rang];
      const intertitre = document.getElementById(groupe.getAttribute('aria-labelledby'));
      expect(intertitre, phase.nom).not.toBeNull();
      expect(intertitre.textContent.trim(), phase.nom).toBe(t(phase.cle));
      expect(style(intertitre).textTransform, phase.nom).toBe('uppercase');
      expect(composantes(style(intertitre).color), phase.nom).toEqual(jeton('--couleur-page-texte-secondaire'));
      const cibles = [...groupe.querySelectorAll('[data-commande="section"]')].map((bouton) => bouton.dataset.cible);
      expect(cibles, phase.nom).toEqual(phase.sections);
    });
    // La marque colorée à côté de chaque intertitre : un élément muet, avant
    // le nom, du fond de sa phase, qui tient 3:1 sur ce qui est peint sous
    // l'intertitre dans les deux thèmes (§ 14.5).
    const teintes = new Map([
      ['preparer', '--couleur-action-fond'],
      ['placer', '--couleur-etat-retenu-marque'],
      ['produire', '--couleur-etat-bloque-marque'],
    ]);
    expect([...teintes.keys()]).toEqual(PHASES.map((phase) => phase.nom));
    for (const [rang, groupe] of groupes.entries()) {
      const phase = PHASES[rang];
      const intertitre = document.getElementById(groupe.getAttribute('aria-labelledby'));
      const marque = intertitre.firstChild;
      expect(marque instanceof HTMLElement, phase.nom).toBe(true);
      expect(marque.getAttribute('aria-hidden'), phase.nom).toBe('true');
      expect(marque.textContent, phase.nom).toBe('');
      expect(visible(marque), phase.nom).toBe(true);
      const b = boite(marque);
      expect(b.width, phase.nom).toBeGreaterThan(0);
      expect(b.height, phase.nom).toBeGreaterThan(0);
      for (const theme of THEMES) {
        await sousTheme(theme, () => {
          const lieu = `${theme} ${phase.nom}`;
          expect(fond(marque), lieu).toEqual(jeton(teintes.get(phase.nom)));
          const dessous = fondPeintSous(intertitre);
          expect(dessous.length, `${lieu} : aucun fond opaque sous l\u{2019}intertitre`).toBeGreaterThan(0);
          for (const f of dessous) expect(contraste(fond(marque), f), `${lieu} : marque sur ${f}`).toBeGreaterThanOrEqual(3);
        });
      }
    }
    for (const nom of SECTIONS) {
      m.ui.allerA(nom);
      flushSync();
      for (const bouton of tous(m, '[data-commande="section"]')) {
        const courant = bouton.dataset.cible === nom;
        expect(bouton.getAttribute('aria-current'), nom).toBe(courant ? 'page' : null);
        const s = style(bouton);
        if (courant) {
          expect(s.fontWeight, nom).toBe('700');
          expect(Number.parseFloat(s.borderBottomWidth), nom).toBeGreaterThanOrEqual(2);
          expect(composantes(s.borderBottomColor), nom).toEqual(jeton('--couleur-action-fond'));
        } else {
          expect(s.fontWeight, nom).toBe('400');
          expect(composantes(s.borderBottomColor)[3] === 0 || Number.parseFloat(s.borderBottomWidth) === 0, nom).toBe(true);
        }
      }
    }
    for (const theme of THEMES) await sousTheme(theme, () => exigerTextesLisibles(nav, theme));
  });

  test('avec un avertissement à côté de la tête, tous les onglets tiennent sur une ligne, quelle que soit la section ouverte, dont le libellé passe en gras', async () => {
    const m = await neuf();
    await enManque(m);
    expect(dans(m, '[data-annonces] [data-avertissement]')).not.toBeNull();
    for (const nom of SECTIONS) {
      m.ui.allerA(nom);
      flushSync();
      const hauts = tous(m, '[data-commande="section"]').map((bouton) => boite(bouton).top);
      expect(hauts.length, nom).toBe(SECTIONS.length);
      expect(new Set(hauts).size, nom).toBe(1);
    }
  });
});

describe('les avertissements, en messages d’avis', () => {
  test('« Ouvrir les tables » se voit en entier dans la zone des annonces, sans défiler ; le message porte le fond, le filet et le signe de l’avis', async () => {
    const m = await neuf();
    await enManque(m);
    const message = await attendre(() => {
      const element = dans(m, '[data-annonces] [data-avertissement="PLACES_MANQUANTES"]');
      expect(element).not.toBeNull();
      return element;
    });
    const zone = message.closest('[data-annonces]');
    expect(zone.scrollTop).toBe(0);
    const action = message.querySelector('[data-commande]');
    expect(action).not.toBeNull();
    const [a, z] = [boite(action), boite(zone)];
    expect(a.top).toBeGreaterThanOrEqual(z.top);
    expect(a.bottom).toBeLessThanOrEqual(z.bottom);
    expect(a.left).toBeGreaterThanOrEqual(z.left);
    expect(a.right).toBeLessThanOrEqual(z.right);
    expect(visible(action)).toBe(true);
    const icones = [...message.querySelectorAll('svg')].filter((svg) => !action.contains(svg));
    expect(icones.length).toBe(1);
    for (const theme of THEMES) {
      await sousTheme(theme, () => {
        expect(fond(message), theme).toEqual(jeton('--couleur-avis-fond'));
        expect(composantes(style(message).borderTopColor), theme).toEqual(jeton('--couleur-avis-filet'));
        expect(trait(icones[0]), theme).toEqual(jeton('--couleur-avis-marque'));
        exigerSigneVisible(icones[0], theme);
        exigerTextesLisibles(message, theme);
      });
    }
  });
  // Le texte de l'avertissement et son action ne sont jamais rognés : ni
  // le texte, ni le message, ni aucune boîte qui les porte jusqu'à la
  // surface de l'événement (SurfaceEvenement.svelte) ne déborde de sa
  // hauteur, et chacun tient dans la boîte visible de chaque ascendant qui
  // coupe ce qui le dépasse, la zone des annonces la première. Le manque d'une place, de quatre et de treize : le nombre et
  // l'accord allongent la phrase.
  for (const largeur of [1366, 1024]) {
    for (const manque of [1, 4, 13]) {
      test(`à ${largeur} × 700, il manque ${manque} : le texte de PLACES_MANQUANTES et le bouton « Ouvrir les tables » se lisent en entier, sans défiler`, async () => {
        await fixerCadre(largeur, 700);
        const m = await neuf();
        await enManqueDe(m, manque);
        const message = await attendre(() => {
          const element = dans(m, '[data-annonces] [data-avertissement="PLACES_MANQUANTES"]');
          expect(element).not.toBeNull();
          return element;
        });
        const texte = message.querySelector('p');
        const action = message.querySelector('button[data-commande]');
        expect(texte.textContent).toBe(tEcran('PLACES_MANQUANTES', { placesManquantes: manque }));
        expect(action).not.toBeNull();
        expect(action.textContent.trim()).toBe(t('communs.remede.ouvrirSection.tables'));
        // La zone des annonces ne défile pas, et le bouton tient dans sa
        // boîte visible.
        const zone = message.closest('[data-annonces]');
        expect(zone.scrollHeight, 'zone : hauteur du contenu').toBeLessThanOrEqual(zone.clientHeight + 1);
        expect(zone.scrollTop).toBe(0);
        const z = boite(zone);
        const a = boite(action);
        expect(a.top, 'bouton sous le haut de la zone').toBeGreaterThanOrEqual(z.top + zone.clientTop - 0.5);
        expect(a.bottom, 'bouton au-dessus du bas visible de la zone').toBeLessThanOrEqual(z.top + zone.clientTop + zone.clientHeight + 0.5);
        const borne = surface(m);
        for (let element = texte; element !== borne.parentElement; element = element.parentElement) {
          const nom = `${element.tagName.toLowerCase()}${element.hasAttribute('data-annonces') ? '[data-annonces]' : ''}`;
          expect(element.scrollHeight, `${nom} : hauteur du contenu`).toBeLessThanOrEqual(element.clientHeight + 1);
          if (element === texte || style(element).overflowY === 'visible') continue;
          const b = boite(element);
          const bas = b.top + element.clientTop + element.clientHeight;
          for (const [lu, porte] of [['texte', texte], ['bouton', action]]) {
            expect(boite(porte).top, `${lu} dans ${nom}`).toBeGreaterThanOrEqual(b.top + element.clientTop - 0.5);
            expect(boite(porte).bottom, `${lu} dans ${nom}`).toBeLessThanOrEqual(bas + 0.5);
          }
        }
        expect(visible(action)).toBe(true);
        expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(innerHeight);
        expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(innerWidth);
      });
    }
  }
});

describe('le remède « Créer les tables… » de PLACES_MANQUANTES (§ 6.1)', () => {
  const avis = (m) => dans(m, '[data-annonces] [data-avertissement="PLACES_MANQUANTES"]');

  test('« Créer les tables… » ouvre le formulaire des tables ; « Créer » fait tomber l’avis ; Ctrl+Z défait', async () => {
    const m = await neuf();
    await enManque(m);
    const message = await attendre(() => {
      expect(avis(m)).not.toBeNull();
      return avis(m);
    });
    const actions = [...message.querySelectorAll('button[data-commande]')];
    expect(actions.map((bouton) => bouton.textContent.trim())).toEqual([
      tEcran('communs.remede.ouvrirSection.tables'),
      tEcran('tables.manque.ouvrir'),
    ]);
    expect(actions[1].dataset.commande).toBe('creerTablesManquantes');
    actions[1].click();
    const formulaire = await attendre(() => {
      const element = dans(m, '[data-section="tables"] [data-enonce="creerTables"]');
      expect(element).not.toBeNull();
      return element;
    });
    expect(m.ui.etat().section).toBe('tables');
    const champ = formulaire.querySelector('input[data-champ="siegesParTable"]');
    expect(champ.value).toBe(String(EVENEMENT.siegesParDefaut));
    await attendre(() => expect(document.activeElement).toBe(champ));
    // Une table de 3 pour 4 personnes : une table de plus.
    expect(formulaire.querySelector('[data-phrase]').textContent).toBe(
      tEcran('tables.manque.apercu', { tables: 1, sieges: 3, placesApres: 6, presentes: 4, partielle: false }),
    );
    const revision = m.seance.etat().evenement.revision;
    formulaire.querySelector('[data-commande="creerTables"]').click();
    await attendre(() => expect(m.seance.etat().charge.tables).toHaveLength(2));
    expect(m.seance.etat().evenement.revision).toBe(revision + 1);
    await attendre(() => expect(avis(m)).toBeNull());
    const annonce = await attendre(() => {
      const element = dans(m, '[data-section="tables"] [data-enonce="tablesCreees"]');
      expect(document.activeElement).toBe(element);
      return element;
    });
    expect(annonce.textContent).toBe(tEcran('tables.manque.fait', { premier: 2, dernier: 2 }));
    await touche('z', { ctrl: true });
    await attendre(() => expect(m.seance.etat().charge.tables).toHaveLength(1));
  });

  test('section des tables déjà ouverte : le remède déplie le formulaire', async () => {
    const m = await neuf();
    m.ui.allerA('tables');
    await enManque(m);
    const bouton = await attendre(() => {
      const element = avis(m)?.querySelector('[data-commande="creerTablesManquantes"]');
      expect(element).toBeTruthy();
      return element;
    });
    expect(dans(m, '[data-section="tables"] [data-enonce="creerTables"]')).toBeNull();
    bouton.click();
    await attendre(() => expect(document.activeElement).toBe(dans(m, '[data-section="tables"] input[data-champ="siegesParTable"]')));
  });
});

describe('le support rompu, en message de refus (§ 8.6)', () => {
  test('le fond, le filet et le signe du refus, ses issues lisibles', async () => {
    const m = await neuf();
    await m.seance.passerEnEcriture();
    m.fs.pannes.ecriture('documents');
    await expect(m.seance.executer('ajouterParticipant', { champs: { nom: NOMS[0] } })).rejects.toMatchObject({ code: 'ECRITURE' });
    const message = await attendre(() => {
      const element = dans(m, '[data-support-rompu]');
      expect(element).not.toBeNull();
      return element;
    });
    const icones = [...message.querySelectorAll('svg')].filter((svg) => svg.closest('button') === null);
    expect(icones.length).toBe(1);
    for (const theme of THEMES) {
      await sousTheme(theme, () => {
        expect(fond(message), theme).toEqual(jeton('--couleur-refus-fond'));
        expect(composantes(style(message).borderTopColor), theme).toEqual(jeton('--couleur-refus-filet'));
        expect(trait(icones[0]), theme).toEqual(jeton('--couleur-refus-marque'));
        exigerSigneVisible(icones[0], theme);
        exigerTextesLisibles(message, theme);
      });
    }
  });
});

describe('à 1 024 px de large', () => {
  test('rien ne déborde : ni la page, ni la bande, ni la tête ; chaque onglet, chaque état et la place fixe se voient', async () => {
    await fixerCadre(1024, 700);
    const m = await neuf();
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(innerWidth);
    expect(boite(bande(m)).right).toBeLessThanOrEqual(innerWidth);
    const tete = dans(m, '[data-ecran="evenement"] header').parentElement;
    expect(tete.scrollWidth).toBeLessThanOrEqual(tete.clientWidth);
    for (const bouton of tous(m, '[data-commande="section"], [data-commande="etat"]')) {
      expect(visible(bouton), bouton.textContent).toBe(true);
    }
    expect(visible(fixe(m, 'modifier'))).toBe(true);
  });
});
