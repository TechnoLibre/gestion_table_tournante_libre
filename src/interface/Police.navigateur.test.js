// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La police de l'interface dans un vrai moteur de rendu (§ 14.1, § 14.15,
// § 19.4) : jetons.css déclare Noto Sans en deux faces, 400 et 700, dont
// chaque fichier est, octet pour octet, celui que le chargement de la police
// rend à App ; --police-interface la nomme en tête ; le corps du document la
// rend, et la chaîne témoin y prend la longueur que donnent les avances de
// la police, dans TOLERANCE_CHAINE_TEMOIN.
//
// Un mesureur du plan (plan/mesure_texte.js) garde chaque largeur qu'il a
// lue : créé avant le chargement des faces, il rend la largeur de la police
// de repli, et la rend encore une fois les faces chargées — le constat se
// fait dans un cadre neuf, dont le document n'a encore rien chargé. D'où
// l'attente : monterApp, comme src/main.js, ne monte App qu'une fois les deux
// faces chargées, et un mesureur créé au premier rendu lit la police
// embarquée. Cette épreuve vient la première du fichier, et constate
// qu'aucune face n'est chargée avant son montage : après elle, le document
// les garde chargées.
//
// Les mesures de texte coupent le crénage et les ligatures
// (font-kerning: none, font-variant-ligatures: none) : la longueur attendue,
// longueurTemoin (test/temoin.js), est la somme des avances, sans l'un ni
// l'autre.
//
// La police du corps ne suffit pas : le moteur donne aux contrôles de
// formulaire — button, input, select, textarea — leur propre police, qui
// n'hérite pas du corps. La dernière épreuve parcourt chaque écran de
// test/navigateur/ecrans.js et lit la première famille calculée de chaque
// porteur de texte et de chaque contrôle.
import { describe, expect, test } from 'vitest';
import { constante } from '../geometrie/constantes.js';
import { CHAINE_TEMOIN, longueurTemoin } from '../../test/temoin.js';
import { monterApp } from '../../test/navigateur/montage.js';
import { creerMesureur } from './plan/mesure_texte.js';
import { ECRANS, creerContexte } from '../../test/navigateur/ecrans.js';
import { fixerCadre } from '../../test/navigateur/entrees.js';
import { designation, porteursDeTexte } from '../../test/navigateur/rendu.js';
import SOURCE_APP from './App.svelte?raw';

const SVG = 'http://www.w3.org/2000/svg';
const FAMILLE = 'Noto Sans';
const TOLERANCE = constante('TOLERANCE_CHAINE_TEMOIN');
// Le corps de chaque mesure de la chaîne témoin : celui où le banc relève
// TOLERANCE_CHAINE_TEMOIN (scripts/banc/temoin.banc.js, CORPS_PX), le texte
// courant de l'interface. L'écart admis est relatif, et l'arrondi des
// avances pèse plus à petit corps : la tolérance se juge au corps où elle
// est relevée.
const CORPS = 16;

// Le nom d'une famille sans ses guillemets.
const sansGuillemets = (texte) => texte.trim().replace(/^(["'])(.*)\1$/, '$2');

// L'écart relatif d'une mesure à sa valeur attendue.
const ecart = (mesure, attendue) => Math.abs(mesure - attendue) / attendue;

// Les faces de la famille dans l'ensemble des polices du document, par
// graisse croissante.
const facesDuDocument = () =>
  [...document.fonts].filter((face) => sansGuillemets(face.family) === FAMILLE).sort((a, b) => Number(a.weight) - Number(b.weight));

// Les règles @font-face de la famille dans les feuilles du document, dans
// l'ordre des feuilles puis des règles : { graisse, style, adresse }, l'adresse
// absolue du fichier que nomme src.
function reglesDuDocument() {
  const regles = [];
  for (const feuille of document.styleSheets) {
    for (const regle of feuille.cssRules) {
      if (!(regle instanceof CSSFontFaceRule)) continue;
      if (sansGuillemets(regle.style.getPropertyValue('font-family')) !== FAMILLE) continue;
      const adresses = [...regle.style.getPropertyValue('src').matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/g)].map((m) => m[2]);
      regles.push({
        graisse: regle.style.getPropertyValue('font-weight'),
        style: regle.style.getPropertyValue('font-style'),
        adresses: adresses.map((a) => new URL(a, feuille.href ?? document.baseURI).href),
      });
    }
  }
  return regles;
}

// La largeur de la chaîne témoin lue par un mesureur neuf, sur un <text>
// posé dans parent, au corps donné, crénage et ligatures coupés ; famille :
// la valeur de font-family, la police de l'interface par défaut.
function largeurTemoin(parent, { corps = CORPS, graisse = 400, famille = 'var(--police-interface)' } = {}) {
  const proprietaire = parent.ownerDocument;
  const svg = proprietaire.createElementNS(SVG, 'svg');
  const texte = proprietaire.createElementNS(SVG, 'text');
  texte.setAttribute(
    'style',
    `font-family: ${famille}; font-size: ${corps}px; font-weight: ${graisse}; font-kerning: none; font-variant-ligatures: none`,
  );
  svg.append(texte);
  parent.append(svg);
  try {
    return creerMesureur(texte)(CHAINE_TEMOIN);
  } finally {
    svg.remove();
  }
}

const hex = (tampon) => [...new Uint8Array(tampon)].map((o) => o.toString(16).padStart(2, '0')).join('');
const empreinte = async (octets) => hex(await crypto.subtle.digest('SHA-256', octets));

describe('police : le montage attend les faces (§ 14.1, § 19.4)', () => {
  test('monterApp ne monte App qu’une fois les deux faces chargées : un mesureur créé au premier rendu lit la chaîne témoin à la longueur des avances', async () => {
    const faces = facesDuDocument();
    expect(faces.map((face) => face.weight)).toEqual(['400', '700']);
    // Aucune face n'est chargée avant ce montage : une épreuve qui les
    // chargerait plus tôt ôterait à celle-ci tout pouvoir d'échouer.
    expect(faces.map((face) => face.status)).toEqual(['unloaded', 'unloaded']);

    // Le premier rendu : le premier lot de mutations où le bandeau d'App
    // paraît dans le conteneur du montage. Le rappel suit le montage, avant
    // que la page ne rende la main au chargement d'une police.
    let premierRendu = null;
    const observateur = new MutationObserver(() => {
      if (premierRendu !== null) return;
      const bandeau = document.querySelector('[data-montage] [data-bandeau]');
      if (bandeau === null) return;
      const conteneur = bandeau.closest('[data-montage]');
      premierRendu = { statuts: facesDuDocument().map((face) => face.status), largeur: largeurTemoin(conteneur) };
    });
    observateur.observe(document.body, { childList: true, subtree: true });
    let m;
    try {
      m = await monterApp();
    } finally {
      observateur.disconnect();
    }
    try {
      expect(premierRendu).not.toBeNull();
      const { regulier } = await m.polices();
      const attendue = longueurTemoin(regulier, CORPS);
      expect(ecart(premierRendu.largeur, attendue), `${premierRendu.largeur} px pour ${attendue} px`).toBeLessThanOrEqual(TOLERANCE);
      expect(premierRendu.statuts).toEqual(['loaded', 'loaded']);
    } finally {
      m.demonter();
    }
  });

  test('constat, dans un cadre neuf : un mesureur créé avant le chargement rend la largeur de repli, et la garde une fois la face chargée', async () => {
    const m = await monterApp();
    const cadre = document.createElement('iframe');
    try {
      const { regulier } = await m.polices();
      const attendue = longueurTemoin(regulier, CORPS);
      const [regle] = reglesDuDocument().filter(({ graisse }) => graisse === '400');
      expect(regle?.adresses.length).toBe(1);
      document.body.append(cadre);
      const neuf = cadre.contentDocument;
      const style = neuf.createElement('style');
      style.textContent = `@font-face { font-family: '${FAMILLE}'; font-weight: 400; src: url('${regle.adresses[0]}'); }`;
      neuf.head.append(style);
      const famille = `'${FAMILLE}', serif`;

      const svg = neuf.createElementNS(SVG, 'svg');
      const texte = neuf.createElementNS(SVG, 'text');
      texte.setAttribute('style', `font-family: ${famille}; font-size: ${CORPS}px; font-kerning: none; font-variant-ligatures: none`);
      svg.append(texte);
      neuf.body.append(svg);
      const mesurer = creerMesureur(texte);
      const avant = mesurer(CHAINE_TEMOIN);
      expect(ecart(avant, attendue), `${avant} px avant le chargement, ${attendue} px attendus`).toBeGreaterThan(TOLERANCE);

      const chargees = await neuf.fonts.load(`400 ${CORPS}px '${FAMILLE}'`);
      expect(chargees.map((face) => face.status)).toEqual(['loaded']);
      // Le même mesureur rend la largeur gardée ; un mesureur neuf lit la face.
      expect(mesurer(CHAINE_TEMOIN)).toBe(avant);
      const apres = largeurTemoin(neuf.body, { famille });
      expect(ecart(apres, attendue), `${apres} px une fois chargée, ${attendue} px attendus`).toBeLessThanOrEqual(TOLERANCE);
    } finally {
      cadre.remove();
      m.demonter();
    }
  });
});

describe('police : Noto Sans est la police de l’interface (§ 14.15, § 19.4, Q4)', () => {
  test('jetons.css déclare deux faces, 400 et 700, de style normal, dont chaque fichier est celui que le chargement de la police rend à App', async () => {
    const m = await monterApp();
    try {
      const regles = reglesDuDocument();
      expect(regles.map(({ graisse, style }) => [graisse, style])).toEqual([
        ['400', 'normal'],
        ['700', 'normal'],
      ]);
      const polices = await m.polices();
      for (const [{ adresses }, graisse] of [[regles[0], 'regulier'], [regles[1], 'gras']]) {
        expect(adresses.length, graisse).toBe(1);
        const reponse = await fetch(adresses[0]);
        expect(reponse.ok, `${adresses[0]} : ${reponse.status}`).toBe(true);
        expect(await empreinte(await reponse.arrayBuffer()), graisse).toBe(await empreinte(polices[graisse]));
      }
    } finally {
      m.demonter();
    }
  });

  test('--police-interface nomme Noto Sans en tête, puis les replis du système ; le corps du document la rend, et document.fonts la tient pour chargée', async () => {
    const m = await monterApp();
    try {
      const jeton = getComputedStyle(document.documentElement).getPropertyValue('--police-interface');
      expect(jeton.split(',').map(sansGuillemets)).toEqual([FAMILLE, 'system-ui', 'sans-serif']);
      const famille = getComputedStyle(document.body).fontFamily;
      expect(sansGuillemets(famille.split(',')[0])).toBe(FAMILLE);
      expect(document.fonts.check(`16px '${FAMILLE}'`)).toBe(true);
      expect(document.fonts.check(`700 16px '${FAMILLE}'`)).toBe(true);
      expect(facesDuDocument().map((face) => face.status)).toEqual(['loaded', 'loaded']);
    } finally {
      m.demonter();
    }
  });

  test('la chaîne témoin, au corps du banc, crénage et ligatures coupés, a la longueur des avances de chaque graisse, dans TOLERANCE_CHAINE_TEMOIN', async () => {
    const m = await monterApp();
    try {
      const polices = await m.polices();
      for (const [graisse, poids] of [['regulier', 400], ['gras', 700]]) {
        const attendue = longueurTemoin(polices[graisse], CORPS);
        const mesuree = largeurTemoin(m.racine, { graisse: poids });
        expect(ecart(mesuree, attendue), `${graisse} : ${mesuree} px pour ${attendue} px`).toBeLessThanOrEqual(TOLERANCE);
      }
    } finally {
      m.demonter();
    }
  });

  test('App déstructure le chargement de la police parmi ses dépendances', () => {
    const [, liste] = /const \{([\s\S]*?)\} = untrack\(\(\) => dependances\);/.exec(SOURCE_APP) ?? [];
    expect(liste, 'la déstructuration des dépendances d’App').toBeDefined();
    const noms = liste.replace(/\/\/[^\n]*/g, '').split(',').map((nom) => nom.trim().split(/\s*=/)[0]).filter(Boolean);
    expect(noms).toContain('polices');
  });
});

// Les contrôles de formulaire, dont le texte — valeur, option, libellé —
// n'est pas toujours un nœud de texte de l'élément.
const CONTROLES = 'button, input, select, textarea';

// La première famille calculée d'un porteur ou d'un élément nu, sans ses
// guillemets.
function premiereFamille(cible) {
  const { element, pseudo } = cible instanceof Element ? { element: cible, pseudo: null } : cible;
  return sansGuillemets(getComputedStyle(element, pseudo).fontFamily.split(',')[0]);
}

describe('police : chaque écran rend son texte en Noto Sans (Q4)', () => {
  test('sur chaque écran de test/navigateur/ecrans.js, chaque porteur de texte et chaque contrôle de formulaire a Noto Sans pour première famille calculée', async () => {
    await fixerCadre(1366, 700);
    const fautes = [];
    let lus = 0;
    for (const ecran of ECRANS) {
      const contexte = creerContexte({ langue: 'fr' });
      try {
        const racine = await ecran.atteindre(contexte);
        const cibles = [...porteursDeTexte(racine), ...racine.querySelectorAll(CONTROLES)];
        expect(cibles.length, `${ecran.nom} : porteurs de texte`).toBeGreaterThan(0);
        const vues = new Set();
        for (const cible of cibles) {
          lus += 1;
          const famille = premiereFamille(cible);
          if (famille === FAMILLE) continue;
          const faute = `${ecran.nom} : ${designation(cible)} en ${famille}`;
          if (!vues.has(faute)) fautes.push(faute);
          vues.add(faute);
        }
      } finally {
        await contexte.defaire();
      }
    }
    expect(lus).toBeGreaterThan(ECRANS.length);
    expect(fautes).toEqual([]);
  }, 900_000);
});
