// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le panneau « Paramètres » dans un vrai moteur de rendu (§ 18.6, § 8.5,
// § 19.2) : d'abord monté seul, sur un état de navigation neuf et une séance
// d'épreuve qui relève les tailles qu'on lui demande ; puis dans App, monté
// par test/navigateur/ecrans.js sur le système de fichiers simulé, où le
// bouton du bandeau l'ouvre, où la taille du texte change la police de la
// racine et survit à un relancement, et où le dessin du plan et le document
// imprimé gardent leurs tailles. Chaque mesure se lit sur le style calculé
// et la boîte rendue, jamais sur une classe.
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import './jetons.css';
import { flushSync, mount, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cdp } from 'vitest/browser';
import { creerHorlogePilotee } from '../application/horloge.js';
import { TABLES_APPLICATION } from '../application/libelles.js';
import { creerTraduction } from '../application/traduction.js';
import { PALIERS_TAILLE_TEXTE, TAILLE_TEXTE_DEFAUT } from '../geometrie/taille_texte.js';
import { FICHIER_REGLAGES, serialiserReglages } from '../stockage/reglages_locaux.js';
import { couleurDeJeton } from '../../test/navigateur/captures.js';
import { attendre, chargePrincipale, cliquer, creerContexte, ouvrirApercu, ouvrirEvenement } from '../../test/navigateur/ecrans.js';
import { fixerCadre, touche } from '../../test/navigateur/entrees.js';
import { composantes, contraste, couleurTexte, fondPeintSous, sousTheme, visible } from '../../test/navigateur/rendu.js';
import { creerEtatUi } from './etat_ui.js';
import { TABLES_INTERFACE } from './libelles.js';
import Parametres from './Parametres.svelte';
import { THEMES, cleDeTheme } from './theme.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

// La taille de base du navigateur, en px : celle de la racine à 100 %.
const BASE_PX = 16;

const plat = (chaine) => chaine.replace(/\s+/g, ' ').trim();
const taillePx = (element) => Number.parseFloat(getComputedStyle(element).fontSize);
const racinePx = () => taillePx(document.documentElement);

// --- Le panneau seul ----------------------------------------------------------

const montes = [];
afterEach(() => {
  for (const { composant, conteneur } of montes.splice(0)) {
    unmount(composant);
    conteneur.remove();
  }
});

// Une séance d'épreuve : son état ne porte que la taille du texte ;
// choisirTailleTexte relève chaque taille demandée, la pose dans l'état et
// rend l'issue reçue.
function seanceDEpreuve({ taille = TAILLE_TEXTE_DEFAUT, issue = { retenue: true, avertissements: [] } } = {}) {
  const magasin = writable({ tailleTexte: taille });
  const demandes = [];
  return {
    demandes,
    subscribe: magasin.subscribe,
    async choisirTailleTexte(palier) {
      demandes.push(palier);
      magasin.set({ tailleTexte: palier });
      return issue;
    },
    // Une relecture des réglages d'un autre dossier, qui pose sa taille.
    relire(palier) {
      magasin.set({ tailleTexte: palier });
    },
  };
}

function monter({ seance = seanceDEpreuve(), ui = creerEtatUi(), fermer = () => {} } = {}) {
  const conteneur = document.createElement('div');
  document.body.prepend(conteneur);
  const contexte = new Map([
    ['t', t],
    ['horloge', creerHorlogePilotee()],
    ['seance', seance],
    ['ui', ui],
  ]);
  const composant = mount(Parametres, { target: conteneur, props: { fermer }, context: contexte });
  flushSync();
  montes.push({ composant, conteneur });
  return { conteneur, seance, ui };
}

const choixTaille = (racine) => [...racine.querySelectorAll('[data-commande="tailleTexte"]')];
const choixTheme = (racine) => [...racine.querySelectorAll('[data-commande="theme"]')];
const presses = (boutons) => boutons.filter((bouton) => bouton.getAttribute('aria-pressed') === 'true');

describe('« Paramètres » : l’habillage (§ 18.6)', () => {
  test('le titre, puis une carte « Taille du texte » et une carte « Thème », chacune titrée et expliquée, et « Fermer »', () => {
    const { conteneur } = monter();
    const ecran = conteneur.querySelector('[data-ecran="parametres"]');
    expect(ecran).not.toBeNull();
    expect(plat(ecran.querySelector('h1').textContent)).toBe(t('coquille.parametres.titre'));
    const titres = [...ecran.querySelectorAll('h2')].map((h) => plat(h.textContent));
    expect(titres).toEqual([t('coquille.parametres.taille.titre'), t('coquille.theme.titre')]);
    expect(plat(ecran.textContent)).toContain(plat(t('coquille.parametres.taille.explication')));
    expect(plat(ecran.textContent)).toContain(plat(t('coquille.parametres.theme.explication')));
    expect(ecran.querySelector('[data-commande="fermerParametres"]')).not.toBeNull();
  });

  test('un choix par palier, dans l’ordre de l’échelle, chacun nommé « N % » ; le palier courant seul est enfoncé', () => {
    const { conteneur } = monter({ seance: seanceDEpreuve({ taille: 130 }) });
    const boutons = choixTaille(conteneur);
    expect(boutons.map((b) => b.dataset.cible)).toEqual(PALIERS_TAILLE_TEXTE.map(String));
    expect(boutons.map((b) => plat(b.textContent))).toEqual(PALIERS_TAILLE_TEXTE.map((taille) => plat(t('coquille.parametres.taille.palier', { taille }))));
    expect(presses(boutons).map((b) => b.dataset.cible)).toEqual(['130']);
    const groupe = boutons[0].closest('[role="group"]');
    expect(groupe.getAttribute('aria-label')).toBe(t('coquille.parametres.taille.titre'));
    expect(boutons.every((b) => b.closest('[role="group"]') === groupe)).toBe(true);
  });

  test('les choix d’un réglage se touchent sur une ligne ; l’enfoncé est en gras sur la teinte de l’action, l’autre sans, à 4,5:1 dans les deux thèmes', async () => {
    const { conteneur } = monter();
    for (const boutons of [choixTaille(conteneur), choixTheme(conteneur)]) {
      const hauts = boutons.map((b) => Math.round(b.getBoundingClientRect().top));
      expect(new Set(hauts).size).toBe(1);
      for (let rang = 1; rang < boutons.length; rang += 1) {
        expect(boutons[rang].getBoundingClientRect().left - boutons[rang - 1].getBoundingClientRect().right).toBeLessThanOrEqual(0.5);
      }
      for (const theme of THEMES) {
        await sousTheme(theme, () => {
          const [enfonce] = presses(boutons);
          const autre = boutons.find((b) => b !== enfonce);
          expect(composantes(getComputedStyle(enfonce).backgroundColor), theme).toEqual(couleurDeJeton('--couleur-action-teinte'));
          expect(getComputedStyle(enfonce).fontWeight, theme).toBe('700');
          expect(getComputedStyle(autre).fontWeight, theme).toBe('400');
          for (const bouton of [enfonce, autre]) {
            const [fond] = fondPeintSous(bouton);
            expect(contraste(couleurTexte(bouton), fond), `${theme} ${plat(bouton.textContent)}`).toBeGreaterThanOrEqual(4.5);
          }
        });
      }
    }
  });
});

describe('« Paramètres » : les gestes (§ 8.5, § 19.2)', () => {
  test('chaque palier se demande à la séance, une fois par clic, et devient le seul enfoncé ; retenue, aucune annonce', () => {
    const { conteneur, seance } = monter();
    for (const palier of PALIERS_TAILLE_TEXTE) {
      conteneur.querySelector(`[data-commande="tailleTexte"][data-cible="${palier}"]`).click();
      flushSync();
      expect(presses(choixTaille(conteneur)).map((b) => b.dataset.cible)).toEqual([String(palier)]);
    }
    expect(seance.demandes).toEqual(PALIERS_TAILLE_TEXTE);
    expect(conteneur.querySelector('[data-avertissement="tailleNonRetenue"]')).toBeNull();
  });

  test('une taille que la séance ne retient pas s’annonce, sous les choix, dans un rôle d’état ; un choix retenu ensuite retire l’annonce', async () => {
    const issue = { retenue: false, avertissements: [] };
    const seance = seanceDEpreuve({ issue });
    const { conteneur } = monter({ seance });
    conteneur.querySelector('[data-commande="tailleTexte"][data-cible="150"]').click();
    const annonce = await vi.waitFor(() => {
      flushSync();
      const trouve = conteneur.querySelector('[data-avertissement="tailleNonRetenue"]');
      expect(trouve).not.toBeNull();
      return trouve;
    });
    expect(plat(annonce.textContent)).toBe(plat(t('coquille.parametres.taille.nonRetenue')));
    expect(annonce.closest('[role="status"]')).not.toBeNull();
    issue.retenue = true;
    conteneur.querySelector('[data-commande="tailleTexte"][data-cible="100"]').click();
    await vi.waitFor(() => {
      flushSync();
      expect(conteneur.querySelector('[data-avertissement="tailleNonRetenue"]')).toBeNull();
    });
  });

  test('une taille non retenue que remplace la relecture d’un autre dossier ne s’annonce plus : l’avis suit la taille à l’écran', async () => {
    const seance = seanceDEpreuve({ issue: { retenue: false, avertissements: [] } });
    const { conteneur } = monter({ seance });
    conteneur.querySelector('[data-commande="tailleTexte"][data-cible="130"]').click();
    await vi.waitFor(() => {
      flushSync();
      expect(conteneur.querySelector('[data-avertissement="tailleNonRetenue"]')).not.toBeNull();
    });
    seance.relire(100);
    flushSync();
    expect(presses(choixTaille(conteneur)).map((b) => b.dataset.cible)).toEqual(['100']);
    expect(conteneur.querySelector('[data-avertissement="tailleNonRetenue"]')).toBeNull();
  });

  test('chaque thème se choisit dans l’état de navigation et devient le seul enfoncé', () => {
    const { conteneur, ui } = monter();
    expect(choixTheme(conteneur).map((b) => b.dataset.themeChoix)).toEqual(THEMES);
    expect(choixTheme(conteneur).map((b) => plat(b.textContent))).toEqual(THEMES.map((theme) => t(cleDeTheme(theme))));
    for (const theme of [...THEMES].reverse()) {
      conteneur.querySelector(`[data-commande="theme"][data-theme-choix="${theme}"]`).click();
      flushSync();
      expect(ui.etat().theme).toBe(theme);
      expect(presses(choixTheme(conteneur)).map((b) => b.dataset.themeChoix)).toEqual([theme]);
    }
  });

  test('« Fermer » appelle fermer une fois', () => {
    const fermer = vi.fn();
    const { conteneur } = monter({ fermer });
    conteneur.querySelector('[data-commande="fermerParametres"]').click();
    expect(fermer).toHaveBeenCalledTimes(1);
  });
});

// --- Dans l'application -------------------------------------------------------

describe('« Paramètres » dans l’application (§ 8.4, § 8.5, § 18.6, § 19.2)', () => {
  let contexte = null;
  afterEach(async () => {
    if (contexte === null) return;
    const erreurs = contexte.erreurs();
    await contexte.defaire();
    contexte = null;
    expect(erreurs, 'erreurs reçues par le collecteur').toEqual([]);
  });

  const bandeau = (m) => m.racine.querySelector('[data-bandeau]');
  const ecran = (m) => m.racine.querySelector('[data-ecran]');

  test('le bandeau porte « Paramètres » juste à gauche de « À propos », et plus le réglage de thème ; un seul des deux panneaux est ouvert à la fois, et « Fermer » rend l’écran', async () => {
    contexte = creerContexte();
    const m = await ouvrirEvenement(contexte, chargePrincipale(), { section: 'participants' });
    const parametres = bandeau(m).querySelector('[data-commande="parametres"]');
    const apropos = bandeau(m).querySelector('[data-commande="apropos"]');
    expect(plat(parametres.textContent)).toBe(t('coquille.parametres.titre'));
    expect(parametres.nextElementSibling).toBe(apropos);
    expect(parametres.getBoundingClientRect().right).toBeLessThanOrEqual(apropos.getBoundingClientRect().left);
    expect(Math.round(parametres.getBoundingClientRect().top)).toBe(Math.round(apropos.getBoundingClientRect().top));
    expect(bandeau(m).querySelector('[data-commande="theme"]')).toBeNull();
    expect(bandeau(m).querySelector(`[aria-label="${t('coquille.theme.titre')}"]`)).toBeNull();

    await cliquer(m, '[data-bandeau] [data-commande="parametres"]');
    expect(ecran(m).dataset.ecran).toBe('parametres');
    expect(visible(ecran(m))).toBe(true);
    await cliquer(m, '[data-bandeau] [data-commande="apropos"]');
    expect(ecran(m).dataset.ecran).toBe('apropos');
    expect(m.racine.querySelector('[data-ecran="parametres"]')).toBeNull();
    await cliquer(m, '[data-bandeau] [data-commande="parametres"]');
    expect(m.racine.querySelector('[data-ecran="apropos"]')).toBeNull();
    await cliquer(m, '[data-ecran="parametres"] [data-commande="fermerParametres"]');
    expect(ecran(m).dataset.ecran).toBe('evenement');
    expect(m.racine.querySelector('[data-section="participants"]')).not.toBeNull();
  });

  // L'état enfoncé des deux commandes de panneau du bandeau, dans l'ordre
  // « Paramètres », « À propos ».
  const enfoncees = (m) =>
    ['parametres', 'apropos'].map((nom) => bandeau(m).querySelector(`[data-commande="${nom}"]`).getAttribute('aria-pressed'));

  test('« Paramètres » du bandeau bascule : un clic ouvre le panneau et enfonce la commande, un second le referme, et l’événement revient sur sa section ; le bandeau garde sa hauteur', async () => {
    contexte = creerContexte();
    const m = await ouvrirEvenement(contexte, chargePrincipale(), { section: 'participants' });
    const hauteur = bandeau(m).getBoundingClientRect().height;
    expect(enfoncees(m)).toEqual(['false', 'false']);

    await cliquer(m, '[data-bandeau] [data-commande="parametres"]');
    expect(ecran(m).dataset.ecran).toBe('parametres');
    expect(enfoncees(m)).toEqual(['true', 'false']);
    expect(bandeau(m).getBoundingClientRect().height).toBe(hauteur);

    await cliquer(m, '[data-bandeau] [data-commande="parametres"]');
    expect(ecran(m).dataset.ecran).toBe('evenement');
    expect(m.racine.querySelector('[data-section="participants"]')).not.toBeNull();
    expect(enfoncees(m)).toEqual(['false', 'false']);
    expect(bandeau(m).getBoundingClientRect().height).toBe(hauteur);
  });

  test('« Paramètres » ouvert, « À propos » du bandeau l’échange : seule la commande d’« À propos » est enfoncée ; « Fermer » relâche la commande', async () => {
    contexte = creerContexte();
    const m = await contexte.monter();
    await cliquer(m, '[data-bandeau] [data-commande="parametres"]');
    await cliquer(m, '[data-bandeau] [data-commande="apropos"]');
    expect(ecran(m).dataset.ecran).toBe('apropos');
    expect(enfoncees(m)).toEqual(['false', 'true']);
    await cliquer(m, '[data-bandeau] [data-commande="parametres"]');
    expect(enfoncees(m)).toEqual(['true', 'false']);
    await cliquer(m, '[data-ecran="parametres"] [data-commande="fermerParametres"]');
    expect(ecran(m).dataset.ecran).toBe('accueil');
    expect(enfoncees(m)).toEqual(['false', 'false']);
  });

  test('au clavier, refermer « Paramètres » par la commande du bandeau lui laisse le focus', async () => {
    contexte = creerContexte();
    const m = await ouvrirEvenement(contexte, chargePrincipale(), { section: 'participants' });
    const commande = bandeau(m).querySelector('[data-commande="parametres"]');
    commande.focus();
    await touche('Enter');
    await attendre('le panneau ouvert', () => m.racine.querySelector('[data-ecran="parametres"]'));
    expect(document.activeElement).toBe(commande);
    await touche('Enter');
    await attendre('l’événement rendu', () => m.racine.querySelector('[data-section="participants"]'));
    expect(document.activeElement).toBe(commande);
    expect(commande.getAttribute('aria-pressed')).toBe('false');
  });

  test('chaque palier pose sa taille de police sur la racine, et un texte de l’écran la suit dans sa proportion', async () => {
    contexte = creerContexte();
    const m = await contexte.monter();
    expect(racinePx()).toBe(BASE_PX);
    const nom = bandeau(m).querySelector('[data-commande="parametres"]');
    const auDefaut = taillePx(nom);
    await cliquer(m, '[data-bandeau] [data-commande="parametres"]');
    const titre = m.racine.querySelector('[data-ecran="parametres"] h1');
    const titreAuDefaut = taillePx(titre);
    for (const palier of PALIERS_TAILLE_TEXTE) {
      await cliquer(m, `[data-ecran="parametres"] [data-commande="tailleTexte"][data-cible="${palier}"]`);
      await attendre(`la racine à ${palier} %`, () => Math.abs(racinePx() - (BASE_PX * palier) / 100) < 0.01);
      expect(taillePx(nom), `bandeau à ${palier} %`).toBeCloseTo((auDefaut * palier) / 100, 1);
      expect(taillePx(titre), `titre à ${palier} %`).toBeCloseTo((titreAuDefaut * palier) / 100, 1);
    }
  });

  test('la taille choisie s’écrit dans reglages_locaux.json et survit à un relancement simulé : un second montage sur le même disque la pose dès le lancement', async () => {
    contexte = creerContexte();
    const premier = await contexte.monter();
    await cliquer(premier, '[data-bandeau] [data-commande="parametres"]');
    await cliquer(premier, '[data-ecran="parametres"] [data-commande="tailleTexte"][data-cible="130"]');
    await attendre('la taille écrite', () => JSON.parse(premier.fs.contenu('documents', FICHIER_REGLAGES) ?? '{}').taille_texte === 130);
    await contexte.defaire();
    expect(racinePx(), 'le démontage rend la racine').toBe(BASE_PX);

    const second = await contexte.monter({ systeme: { disque: premier.disque } });
    expect(racinePx()).toBeCloseTo((BASE_PX * 130) / 100, 2);
    await cliquer(second, '[data-bandeau] [data-commande="parametres"]');
    expect(presses(choixTaille(second.racine)).map((b) => b.dataset.cible)).toEqual(['130']);
  });

  test('les deux thèmes se choisissent dans le panneau et changent les couleurs calculées du corps et du bandeau, sans rechargement', async () => {
    contexte = creerContexte();
    const m = await contexte.monter();
    const couleurs = () => [document.body, bandeau(m)].map((el) => `${getComputedStyle(el).color} sur ${getComputedStyle(el).backgroundColor}`);
    await cliquer(m, '[data-bandeau] [data-commande="parametres"]');
    const clair = couleurs();
    await cliquer(m, '[data-ecran="parametres"] [data-commande="theme"][data-theme-choix="sombre"]');
    expect(document.documentElement.getAttribute('data-theme')).toBe('sombre');
    const sombre = couleurs();
    expect(sombre[0]).not.toBe(clair[0]);
    expect(sombre[1]).not.toBe(clair[1]);
    await cliquer(m, '[data-ecran="parametres"] [data-commande="theme"][data-theme-choix="clair"]');
    expect(document.documentElement.getAttribute('data-theme')).toBe('clair');
    expect(couleurs()).toEqual(clair);
  });

  test('monté sans réglage de thème, sous la préférence sombre du système, le panneau montre le sombre enfoncé', async () => {
    const preferer = (valeur) => cdp().send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: valeur }] });
    await preferer('dark');
    try {
      contexte = creerContexte();
      const m = await contexte.monter({ theme: null });
      expect(document.documentElement.getAttribute('data-theme')).toBe('sombre');
      await cliquer(m, '[data-bandeau] [data-commande="parametres"]');
      expect(presses(choixTheme(m.racine)).map((b) => b.dataset.themeChoix)).toEqual(['sombre']);
    } finally {
      await preferer('');
    }
  });

  // Le relevé d'un document imprimé : sa taille de police, puis, pour chaque
  // élément qu'il porte, sa balise, sa taille de police, son interligne et sa
  // boîte, au dixième de px. Le document lui-même prend la largeur de
  // l'écran, que la taille du texte change : sa boîte ne se relève pas.
  const releve = (racine) =>
    [getComputedStyle(racine).fontSize, ...[...racine.querySelectorAll('*')].map((element) => {
      const style = getComputedStyle(element);
      const boite = element.getBoundingClientRect();
      return [element.tagName, style.fontSize, style.lineHeight, Math.round(boite.width * 10), Math.round(boite.height * 10)].join(' ');
    })];

  // Les réglages locaux d'un poste au papier A4, à la taille donnée.
  const reglagesA = (taille) => ({
    racine: 'documents',
    chemin: FICHIER_REGLAGES,
    texte: serialiserReglages({ format: 1, papier: 'A4', cadrages: [], taille_texte: taille }),
  });

  // Le relevé du document de chaque vue de l'aperçu, la racine à la taille
  // donnée, et la taille calculée d'une commande de la barre de l'aperçu.
  async function documentsImprimes(taille) {
    contexte = creerContexte();
    const m = await ouvrirApercu(contexte, chargePrincipale(), { papier: null, section: 'participants', options: { fichiers: [reglagesA(taille)] } });
    await attendre(`la racine à ${taille} %`, () => Math.abs(racinePx() - (BASE_PX * taille) / 100) < 0.01);
    const vues = {};
    for (const vue of ['plan', 'accueil', 'tables']) {
      await cliquer(m, `[data-apercu-impression] [data-commande="vue"][data-cible="${vue}"]`);
      const imprime = await attendre(`la vue ${vue}`, () => m.racine.querySelector(`[data-impression][data-vue-impression="${vue}"]`));
      await attendre(`les feuilles de ${vue}`, () => imprime.querySelector('[data-feuille]'));
      vues[vue] = { feuilles: imprime.querySelectorAll('[data-feuille]').length, releve: releve(imprime) };
    }
    const barre = taillePx(m.racine.querySelector('[data-apercu-impression] [data-commande="vue"]'));
    await contexte.defaire();
    contexte = null;
    return { vues, barre };
  }

  test('le document imprimé — plan, liste d’accueil, feuilles par table, pagination comprise — garde ses tailles et ses pages à 90 % comme à 150 % ; la barre de l’aperçu, de l’écran, suit', async () => {
    await fixerCadre(1366, 700);
    const normal = await documentsImprimes(100);
    for (const palier of [90, 150]) {
      const autre = await documentsImprimes(palier);
      for (const vue of ['plan', 'accueil', 'tables']) {
        expect(normal.vues[vue].feuilles, vue).toBeGreaterThan(0);
        expect(autre.vues[vue].feuilles, `${palier} %, ${vue} : pages`).toBe(normal.vues[vue].feuilles);
        expect(autre.vues[vue].releve, `${palier} %, ${vue} : tailles et boîtes`).toEqual(normal.vues[vue].releve);
      }
      expect(autre.barre).toBeCloseTo((normal.barre * palier) / 100, 1);
    }
  }, 180_000);

  // Le relevé du dessin du plan, en unités du plan, que le cadrage ne change
  // pas : la taille de police et la boîte du numéro de chaque table, et les
  // tailles de police des textes du dessin. Les listes de noms paraissent ou
  // non selon le zoom : leurs tailles se relèvent, non leur nombre.
  const releveDessin = (m) => {
    const textes = [...m.racine.querySelectorAll('[data-surface] svg text')];
    const numeros = textes
      .filter((texte) => texte.hasAttribute('data-numero-table'))
      .map((texte) => {
        const boite = texte.getBBox();
        return [texte.dataset.numeroTable, getComputedStyle(texte).fontSize, Math.round(boite.width * 100), Math.round(boite.height * 100)].join(' ');
      });
    return { numeros, tailles: new Set(textes.map((texte) => getComputedStyle(texte).fontSize)) };
  };

  test('le dessin du plan garde la taille de ses textes à chaque palier ; les commandes de l’écran autour de lui suivent', async () => {
    await fixerCadre(1366, 700);
    contexte = creerContexte();
    const m = await ouvrirEvenement(contexte, chargePrincipale());
    const dessin = releveDessin(m);
    expect(dessin.numeros.length).toBe(chargePrincipale().tables.length);
    const commande = m.racine.querySelector('[data-ecran="evenement"] [data-commande="section"][data-cible="plan"]');
    const auDefaut = taillePx(commande);
    for (const palier of [90, 150]) {
      await m.seance.choisirTailleTexte(palier);
      await attendre(`la racine à ${palier} %`, () => Math.abs(racinePx() - (BASE_PX * palier) / 100) < 0.01);
      const apres = releveDessin(m);
      expect(apres.numeros, `numéros à ${palier} %`).toEqual(dessin.numeros);
      for (const taille of apres.tailles) expect(dessin.tailles.has(taille), `texte du plan de ${taille} à ${palier} %`).toBe(true);
      expect(taillePx(commande), `commande à ${palier} %`).toBeCloseTo((auDefaut * palier) / 100, 1);
    }
  });
});
