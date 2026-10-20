// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La mise en forme des nombres, des durées, des dates et des horodatages
// (§ 5.4, § 5.10, § 11.7, § 18.4). Aucune fonction ne lit la locale du
// système : les chiffres se groupent par trois, séparés d'une espace fine
// insécable (U+202F), la décimale suit une virgule, un négatif porte le signe
// moins (U+2212). Tout texte rendu qui porte une lettre — unité, mois, ordre
// de grandeur — vient d'une clé format.… par t, en un seul appel : en langue
// témoin, il est encadré de la marque une fois. Un nombre, qui ne porte
// aucune lettre, n'y passe pas.

import { estHorodatage } from '../stockage/journal.js';

const ESPACE_FINE = '\u{202F}';
const MOINS = '\u{2212}';

// L'échelle des ordres de grandeur d'une durée (§ 5.10) : chaque pas en
// secondes et sa clé. Sous le premier seuil, moins d'une minute ; dès le
// dernier, plusieurs heures ; entre les deux, le pas le plus proche en
// rapport : la frontière de deux pas voisins a et b est √(a·b), comparée
// exactement, s² contre a·b.
const MOINS_D_UNE_MINUTE = 60;
const PLUSIEURS_HEURES = 5400;
const PAS = [
  [120, 'format.duree.deuxMinutes'],
  [300, 'format.duree.cinqMinutes'],
  [600, 'format.duree.dixMinutes'],
  [1200, 'format.duree.vingtMinutes'],
  [1800, 'format.duree.demiHeure'],
  [3600, 'format.duree.uneHeure'],
];

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Le nombre de jours d'un mois du calendrier grégorien.
function joursDuMois(annee, mois) {
  if (mois === 2) return annee % 4 === 0 && (annee % 100 !== 0 || annee % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(mois) ? 30 : 31;
}

// Année, mois et jour d'une date AAAA-MM-JJ du calendrier, ou RangeError.
function lireDate(annee, mois, jour, texte) {
  const lue = { annee: Number(annee), mois: Number(mois), jour: Number(jour) };
  if (lue.mois < 1 || lue.mois > 12 || lue.jour < 1 || lue.jour > joursDuMois(lue.annee, lue.mois)) {
    throw new RangeError(`format : ${JSON.stringify(texte)} n'est pas un jour du calendrier`);
  }
  return lue;
}

/**
 * La seule lecture d'un horodatage sous src/application : sa forme est celle
 * d'estHorodatage (src/stockage/journal.js), dont les champs, de largeur
 * fixe, se lisent par leur position ; la date doit être un jour du
 * calendrier, l'heure une heure du jour, le décalage au plus ±23:59.
 *
 * @param {unknown} texte  AAAA-MM-JJTHH:MM:SS±HH:MM
 * @returns {{annee: number, mois: number, jour: number, heure: number, minute: number,
 *            seconde: number, decalage: number}}  decalage en minutes à l'est de UTC
 * @throws {RangeError} une autre forme, un jour hors du calendrier, une heure
 *         ou un décalage hors de leurs bornes
 */
export function lireHorodatage(texte) {
  if (!estHorodatage(texte)) {
    throw new RangeError(`format : horodatage AAAA-MM-JJTHH:MM:SS±HH:MM attendu, reçu ${JSON.stringify(texte)}`);
  }
  const champ = (debut, fin) => Number(texte.slice(debut, fin));
  const [heure, minute, seconde, decalageH, decalageM] = [champ(11, 13), champ(14, 16), champ(17, 19), champ(20, 22), champ(23, 25)];
  if (heure > 23 || minute > 59 || seconde > 59 || decalageH > 23 || decalageM > 59) {
    throw new RangeError(`format : ${JSON.stringify(texte)} n'est pas une heure du jour`);
  }
  const decalage = (texte[19] === '-' ? -1 : 1) * (decalageH * 60 + decalageM);
  return { ...lireDate(texte.slice(0, 4), texte.slice(5, 7), texte.slice(8, 10), texte), heure, minute, seconde, decalage };
}

// Un nombre fini, ou l'erreur qui dit pourquoi il ne se met pas en forme.
function exigerFini(valeur, quoi) {
  if (typeof valeur !== 'number') throw new TypeError(`format : ${quoi} doit être un nombre, reçu ${String(valeur)}`);
  if (!Number.isFinite(valeur)) throw new RangeError(`format : ${quoi} non fini, ${valeur}`);
}

/**
 * Les fonctions de mise en forme, dont chaque texte vient de t.
 *
 * @param {(cle: string, details?: Object) => string} t  la traduction
 * @returns {{
 *   nombre: (valeur: number|null, options?: {decimales?: number}) => string,
 *   duree: (ms: number) => string,
 *   ordreDeGrandeur: (secondes: number) => string,
 *   date: (date: string) => string,
 *   horodatage: (horodatage: string) => string,
 * }}
 */
export function creerFormat(t) {
  // Les chiffres d'un nombre fini, arrondi à decimales chiffres après la
  // virgule, sans passer par la traduction.
  function chiffres(valeur, decimales) {
    if (!Number.isInteger(decimales) || decimales < 0 || decimales > 20) {
      throw new RangeError(`format : décimales hors de 0 à 20, ${decimales}`);
    }
    const ecrit = Math.abs(valeur).toFixed(decimales);
    if (ecrit.includes('e')) throw new RangeError(`format : ${valeur} dépasse ce qui s'écrit en chiffres`);
    const [entiere, fraction] = ecrit.split('.');
    const groupee = entiere.replace(/\B(?=(\d{3})+$)/g, ESPACE_FINE);
    const nul = /^[0.]*$/.test(ecrit);
    const signe = valeur < 0 && !nul ? MOINS : '';
    return `${signe}${groupee}${fraction === undefined ? '' : `,${fraction}`}`;
  }

  /** Un nombre ; null, une valeur absente, s'écrit format.vide, jamais 0. */
  function nombre(valeur, { decimales = 0 } = {}) {
    if (valeur === null) return t('format.vide');
    exigerFini(valeur, 'nombre');
    return chiffres(valeur, decimales);
  }

  /**
   * Une durée en millisecondes : sous la minute, au dixième de seconde, un
   * compte rond sans décimale ; sous l'heure, minutes et secondes entières ;
   * au-delà, heures et minutes entières. Un arrondi qui atteint l'unité
   * suivante s'écrit dans elle.
   */
  function duree(ms) {
    exigerFini(ms, 'durée');
    if (ms < 0) throw new RangeError(`format : durée négative, ${ms}`);
    const dixiemes = Math.round(ms / 100);
    if (dixiemes < 600) {
      const secondes = dixiemes % 10 === 0 ? chiffres(dixiemes / 10, 0) : chiffres(dixiemes / 10, 1);
      return t('format.duree.secondes', { secondes });
    }
    const secondes = Math.round(ms / 1000);
    if (secondes < 3600) {
      return t('format.duree.minutes', { minutes: Math.floor(secondes / 60), secondes: secondes % 60 });
    }
    const minutes = Math.round(ms / 60_000);
    return t('format.duree.heures', { heures: chiffres(Math.floor(minutes / 60), 0), minutes: minutes % 60 });
  }

  /** L'ordre de grandeur d'une durée en secondes (§ 5.10). */
  function ordreDeGrandeur(secondes) {
    exigerFini(secondes, 'durée');
    if (secondes < 0) throw new RangeError(`format : durée négative, ${secondes}`);
    if (secondes < MOINS_D_UNE_MINUTE) return t('format.duree.moinsDUneMinute');
    if (secondes >= PLUSIEURS_HEURES) return t('format.duree.plusieursHeures');
    const carre = secondes * secondes;
    let rang = 0;
    while (rang + 1 < PAS.length && carre >= PAS[rang][0] * PAS[rang + 1][0]) rang += 1;
    return t(PAS[rang][1]);
  }

  /** Une date AAAA-MM-JJ en lettres, « 1er » pour le premier du mois. */
  function date(texte) {
    const morceaux = DATE.exec(String(texte));
    if (morceaux === null) throw new RangeError(`format : date AAAA-MM-JJ attendue, reçu ${JSON.stringify(texte)}`);
    return t('format.date', lireDate(...morceaux.slice(1), texte));
  }

  /**
   * Un horodatage AAAA-MM-JJTHH:MM:SS±HH:MM en lettres, à l'heure locale
   * qu'il porte : la date, puis l'heure et la minute.
   */
  function horodatage(texte) {
    const { annee, mois, jour, heure, minute } = lireHorodatage(texte);
    return t('format.horodatage', { annee, mois, jour, heure, minute });
  }

  return { nombre, duree, ordreDeGrandeur, date, horodatage };
}
