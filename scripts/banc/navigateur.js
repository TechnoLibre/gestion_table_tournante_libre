// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les outils de page du banc (§ 19.10), pour les épreuves *.banc.js que
// joue vitest.banc.config.js, sous Chromium sans cadence d'images : le
// contrôle du cadre, le ralentissement du processeur, la mesure des
// intervalles entre images pendant un geste, les deux contrôles qui disent
// si cette mesure voit ce qu'elle mesure, et l'écriture d'une sortie.
//
// Une horloge réelle se lit ici, et seulement pour mesurer : l'instant que
// requestAnimationFrame passe à son rappel, et performance.now pour tenir
// une image occupée. Ce qui s'écrit ne porte aucun instant, seulement des
// durées.
import { inject } from 'vitest';
import { cdp, commands } from 'vitest/browser';
import { fixerCadre } from '../../test/navigateur/entrees.js';
import { statistiques } from './statistiques.js';

/** Le p95 sous lequel un plan vide prouve que la cadence n'est pas bridée :
 *  sous la marche de 16,7 ms d'une cadence calée à 60 images par seconde. */
export const SEUIL_CADENCE_MS = 16;

/** La durée d'une image chargée exprès, que la mesure doit voir. */
export const CHARGE_MS = 50;

// Le dossier des sorties, relatif à la racine du projet, où commands.writeFile
// résout un chemin ; ignoré par git. Un nom de sortie n'y désigne qu'un
// fichier de ce dossier.
const DOSSIER_SORTIES = 'scripts/banc/sorties';
const NOM_SORTIE = /^[a-z0-9_]+$/;

const uneImage = () => new Promise((resoudre) => requestAnimationFrame(resoudre));

/**
 * Pose le cadre du banc, que vitest.banc.config.js fournit par
 * inject('cadreBanc'), et vérifie qu'il est rendu tel quel : innerWidth et
 * innerHeight (fixerCadre), un facteur d'échelle de 1, et aucune mise à
 * l'échelle du cadre de l'épreuve par la page qui le porte, d'un cadre à son
 * parent : le rapport entre la largeur rendue de chaque <iframe> et sa
 * largeur de mise en page vaut 1. Lève en nommant l'écart.
 *
 * @param {{lireFacteur?: () => number}} [options]   lireFacteur rend le
 *   facteur d'échelle de la page, par défaut devicePixelRatio
 * @returns {Promise<{largeur: number, hauteur: number, facteurEchelle: number}>}
 */
export async function controlerCadre({ lireFacteur = () => devicePixelRatio } = {}) {
  const cadre = inject('cadreBanc');
  if (cadre === undefined) throw new Error('cadre du banc absent : lancer par vitest.banc.config.js');
  const { largeur, hauteur } = await fixerCadre(cadre.largeur, cadre.hauteur);
  const facteurEchelle = lireFacteur();
  if (facteurEchelle !== 1) throw new Error(`facteur d’échelle ${facteurEchelle}, attendu 1`);
  for (let fenetre = window; fenetre !== fenetre.top; fenetre = fenetre.parent) {
    const element = fenetre.frameElement;
    const echelle = element.getBoundingClientRect().width / element.offsetWidth;
    if (echelle !== 1) throw new Error(`cadre mis à l’échelle ${echelle} par la page qui le porte`);
  }
  return { largeur, hauteur, facteurEchelle };
}

/**
 * Ralentit le processeur de la page d'un facteur (CDP
 * Emulation.setCPUThrottlingRate) ; 1 rend la vitesse normale. Le
 * ralentissement dure jusqu'au prochain appel.
 *
 * @param {number} facteur   un nombre fini ≥ 1
 */
export async function ralentirCpu(facteur) {
  if (typeof facteur !== 'number' || !Number.isFinite(facteur) || facteur < 1) {
    throw new RangeError(`ralentissement refusé : ${String(facteur)}`);
  }
  await cdp().send('Emulation.setCPUThrottlingRate', { rate: facteur });
}

// Un témoin d'un pixel, hors du flux et des gestes, que la mesure déplace
// d'un pixel à chaque image. Sans cadence, Chromium ne dessine au plus vite
// qu'une image qui change quelque chose : une image où rien ne change
// revient à sa cadence de repos, près de 17 ms, que rien ne distingue d'une
// cadence bridée ni d'une image lente. Entre deux pas d'un glissement par
// CDP, où la vue ne bouge pas, chaque image en serait une. Le témoin fait de
// chaque image une image dessinée, pour un coût de peinture d'un pixel.
function creerTemoin() {
  const temoin = document.createElement('div');
  temoin.setAttribute('aria-hidden', 'true');
  temoin.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;pointer-events:none;background:#000';
  document.body.append(temoin);
  let pair = false;
  return {
    bouger() {
      pair = !pair;
      temoin.style.transform = pair ? 'translateX(1px)' : 'none';
    },
    retirer() {
      temoin.remove();
    },
  };
}

/**
 * Les intervalles entre images pendant un geste, en millisecondes : l'écart
 * entre les instants que requestAnimationFrame passe à deux images
 * successives, de la première image qui suit l'appel à la première qui suit
 * la fin du geste. Chaque image déplace le témoin d'un pixel, qui la fait
 * dessiner. Un geste qui lève fait lever la mesure, le relevé arrêté et le
 * témoin retiré.
 *
 * @param {() => Promise<void>} geste
 * @returns {Promise<number[]>}
 */
export async function mesurerImages(geste) {
  const instants = [];
  const temoin = creerTemoin();
  let suivre = true;
  const noter = (instant) => {
    instants.push(instant);
    if (!suivre) return;
    temoin.bouger();
    requestAnimationFrame(noter);
  };
  requestAnimationFrame(noter);
  try {
    await geste();
  } finally {
    suivre = false;
    // Le dernier rappel de noter, armé avant celui-ci, passe d'abord.
    await uneImage();
    temoin.retirer();
  }
  return instants.slice(1).map((instant, i) => instant - instants[i]);
}

/**
 * Occupe chaque image de dureeMs : un rappel d'image qui attend, sans rendre
 * la main, que performance.now ait avancé d'autant, puis se réarme. Rend la
 * fonction qui l'arrête.
 *
 * @param {number} dureeMs
 * @returns {() => void}
 */
export function chargerImages(dureeMs) {
  let actif = true;
  const charger = () => {
    if (!actif) return;
    const fin = performance.now() + dureeMs;
    while (performance.now() < fin) {
      // l'image reste occupée
    }
    requestAnimationFrame(charger);
  };
  requestAnimationFrame(charger);
  return () => {
    actif = false;
  };
}

/**
 * Le contrôle de cadence, sur un geste qui ne charge rien — un plan vide :
 * rend les statistiques de ses intervalles, ou lève « cadence bridée » quand
 * leur p95 atteint SEUIL_CADENCE_MS.
 *
 * @param {() => Promise<void>} geste
 */
export async function controlerCadence(geste) {
  const stats = statistiques(await mesurerImages(geste));
  if (stats.p95Ms >= SEUIL_CADENCE_MS) {
    throw new Error(`cadence bridée : p95 ${stats.p95Ms.toFixed(2)} ms sur un plan vide, attendu sous ${SEUIL_CADENCE_MS} ms`);
  }
  return stats;
}

/**
 * Le contrôle de charge : chaque image occupée de CHARGE_MS par charger
 * (chargerImages par défaut, que les épreuves du harnais remplacent pour
 * montrer le contrôle tomber) pendant le geste ; rend les statistiques, ou
 * lève quand leur p95 reste sous CHARGE_MS — la mesure ne verrait pas une
 * image lente.
 *
 * @param {() => Promise<void>} geste
 * @param {{charger?: (dureeMs: number) => () => void}} [options]
 */
export async function controlerCharge(geste, { charger = chargerImages } = {}) {
  const arreter = charger(CHARGE_MS);
  let stats;
  try {
    stats = statistiques(await mesurerImages(geste));
  } finally {
    arreter();
  }
  if (stats.p95Ms < CHARGE_MS) {
    throw new Error(`image chargée de ${CHARGE_MS} ms vue à ${stats.p95Ms.toFixed(2)} ms : la mesure ne voit pas la charge`);
  }
  return stats;
}

/**
 * Écrit objet en JSON, indenté de deux espaces, dans
 * scripts/banc/sorties/<nom>.json, par la commande writeFile de Vitest, qui
 * crée le dossier au besoin. L'ordre des clés est celui de l'objet.
 *
 * @param {string} nom   lettres minuscules sans accent, chiffres et « _ »
 * @param {unknown} objet
 * @throws {RangeError} sur un autre nom, avant toute écriture
 */
export async function ecrireSortie(nom, objet) {
  if (typeof nom !== 'string' || !NOM_SORTIE.test(nom)) throw new RangeError(`nom de sortie refusé : « ${String(nom)} »`);
  await commands.writeFile(`${DOSSIER_SORTIES}/${nom}.json`, `${JSON.stringify(objet, null, 2)}\n`);
}
