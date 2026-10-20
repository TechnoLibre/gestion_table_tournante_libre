// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La tolérance de la chaîne témoin (§ 19.4, § 14.1), relevée par le banc :
// la longueur rendue de CHAINE_TEMOIN, par getComputedTextLength, dix fois
// sur la police embarquée, puis dix fois sur la famille de repli forcée — la
// police de l'interface sans Noto Sans, ce que le moteur rend quand la face
// manque. La longueur attendue se calcule des avances de la police
// (longueurTemoin, fontkit), jamais saisie. toleranceTemoin (seuils.js) en
// tire la valeur proposée : le quart de l'écart du repli, au moins trois fois
// la gigue des dix mesures de la police embarquée.
//
// Chaque mesure se prend sur un <text> neuf, décalé d'un dixième de pixel
// de la précédente : la gigue couvre le placement du texte au sous-pixel,
// non la seule relecture d'une longueur gardée. Crénage et ligatures sont
// coupés (font-kerning: none, font-variant-ligatures: none) : la longueur
// attendue est la somme des avances, sans l'un ni l'autre. Le corps est
// celui du texte courant de l'interface, 16 px, où l'arrondi des avances
// pèse le plus.
//
// La police embarquée doit être chargée et la première famille de la
// police de l'interface : sinon la mesure se refuse (C8). Une tolérance
// refusée s'écrit tout de même, valeur proposée null et refus nommé, et
// l'épreuve échoue : le relevé le dit, et le passage tombe.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { commands } from 'vitest/browser';
import { CONSTANTES } from '../../src/geometrie/constantes.js';
import { creerContexte } from '../../test/navigateur/ecrans.js';
import { CHAINE_TEMOIN, longueurTemoin } from '../../test/temoin.js';
import { controlerCadre, ecrireSortie } from './navigateur.js';
import { verifierReleve } from './releve.js';
import { toleranceTemoin } from './seuils.js';

const SVG = 'http://www.w3.org/2000/svg';
const FAMILLE = 'Noto Sans';
const CORPS_PX = 16;
const MESURES = 10;
const NOM = 'TOLERANCE_CHAINE_TEMOIN';

// Le nom d'une famille sans ses guillemets.
const sansGuillemets = (texte) => texte.trim().replace(/^(["'])(.*)\1$/, '$2');

let contexte = null;
let octets = null;
let mesure = null;

/**
 * Les familles de la police de l'interface, dans l'ordre de
 * --police-interface, sans guillemets.
 * @returns {string[]}
 */
function famillesInterface() {
  return getComputedStyle(document.documentElement).getPropertyValue('--police-interface').split(',').map(sansGuillemets);
}

/**
 * Dix longueurs rendues de la chaîne témoin, en px, sur la famille donnée
 * (une valeur de font-family), en graisse 400, au corps CORPS_PX : chacune
 * sur un <text> neuf, posé à x = rang / 10 px, retiré après sa lecture.
 * @param {string} famille
 * @returns {number[]}
 */
function longueursRendues(famille) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('width', '800');
  svg.setAttribute('height', '40');
  document.body.append(svg);
  try {
    return Array.from({ length: MESURES }, (_, rang) => {
      const texte = document.createElementNS(SVG, 'text');
      texte.setAttribute('x', String(rang / 10));
      texte.setAttribute('y', '30');
      texte.setAttribute(
        'style',
        `font-family: ${famille}; font-size: ${CORPS_PX}px; font-weight: 400; font-kerning: none; font-variant-ligatures: none`,
      );
      texte.textContent = CHAINE_TEMOIN;
      svg.append(texte);
      const longueur = texte.getComputedTextLength();
      texte.remove();
      return longueur;
    });
  } finally {
    svg.remove();
  }
}

/** Vrai quand la face 400 de la police embarquée est chargée dans le document. */
const faceChargee = () =>
  [...document.fonts].some((face) => sansGuillemets(face.family) === FAMILLE && face.weight === '400' && face.status === 'loaded');

beforeAll(async () => {
  await controlerCadre();
  contexte = creerContexte();
  const m = await contexte.monter();
  ({ regulier: octets } = await m.polices());
});

afterAll(async () => {
  await contexte?.defaire();
});

describe('la tolérance de la chaîne témoin (§ 19.4)', () => {
  test('la police embarquée est chargée et nommée en tête de la police de l’interface ; le repli forcé est le reste de la liste', () => {
    const familles = famillesInterface();
    expect(familles[0]).toBe(FAMILLE);
    expect(familles.length).toBeGreaterThan(1);
    expect(familles.slice(1)).not.toContain(FAMILLE);
    expect(faceChargee()).toBe(true);
  });

  test('dix mesures sur chaque police ; la tolérance proposée écarte le repli et admet la police embarquée', async () => {
    const familles = famillesInterface();
    const repli = familles.slice(1).join(', ');
    const attenduePx = longueurTemoin(octets, CORPS_PX);
    const embarqueePx = longueursRendues(`'${FAMILLE}', ${repli}`);
    const repliPx = longueursRendues(repli);
    const police = familles[0] === FAMILLE && faceChargee() ? FAMILLE : null;
    const tolerance = toleranceTemoin({ attenduePx, embarqueePx, repliPx });
    const refus = police === null ? `police ${familles[0]} : la mesure se prend sur ${FAMILLE}` : tolerance.refus;
    mesure = {
      nom: NOM,
      unite: 'rapport',
      valeurProposee: refus === null ? tolerance.valeur : null,
      critere:
        `le quart de l’écart relatif du repli (${repli}) à la longueur des avances de ${FAMILLE}, et au moins trois fois la ` +
        `gigue de ${MESURES} mesures ; chaîne témoin à ${CORPS_PX} px, graisse 400, crénage et ligatures coupés`,
      police,
      ralentissementCpu: 1,
      corpsPx: CORPS_PX,
      attenduePx,
      embarqueePx,
      repliPx,
      ecartRepli: tolerance.ecartRepli,
      gigue: tolerance.gigue,
      biais: tolerance.biais,
      refus,
    };
    expect(refus).toBeNull();
    expect(mesure.valeurProposee).toBeGreaterThan(0);
    expect(mesure.valeurProposee).toBeLessThan(tolerance.ecartRepli);
    expect(mesure.valeurProposee).toBeGreaterThanOrEqual(tolerance.biais);
  });

  test('la mesure s’écrit dans scripts/banc/sorties/temoin.json, relue telle quelle, et se range dans un relevé', async () => {
    expect(mesure).not.toBeNull();
    const objet = { format: 1, mesures: [mesure] };
    const releve = {
      format: 1,
      configuration: {
        cadre: { largeur: innerWidth, hauteur: innerHeight },
        facteurEchelle: devicePixelRatio,
        navigateur: null,
        node: null,
        processeursLogiques: null,
        ralentissementCpu: 1,
        police: mesure.police,
      },
      mesures: [mesure],
    };
    expect(verifierReleve(releve, CONSTANTES)).toEqual([]);
    await ecrireSortie('temoin', objet);
    expect(JSON.parse(await commands.readFile('scripts/banc/sorties/temoin.json'))).toEqual(objet);
    expect(mesure.refus).toBeNull();
  });
});
