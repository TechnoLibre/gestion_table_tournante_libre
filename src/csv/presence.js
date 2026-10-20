// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La présence écrite en texte (§ 10.1, § 10.2) : la seule grammaire qui lit
// une cellule « présence » et la seule écriture qui la produit. L'import,
// l'export, la grille et la fiche passent par ces deux fonctions ; la règle
// « champ absent = tous les tours » reste celle de src/moteur/presence.js.
//
// Grammaire, sur la cellule mise en NFC, sans ses blancs de bord, comparée
// sans casse :
//   cellule  := ''                    → null (la ligne ne dit rien)
//             | 'tous' | 'tous les tours' → 1..R
//             | prefixe? liste
//   prefixe  := ('tour' | 'tours') blanc+
//   liste    := element (sep element)*
//   sep      := blanc* (',' | ';' | 'et') blanc*  |  blanc+
//   element  := entier | entier blanc* tiret blanc* entier
//   tiret    := '-' | U+2013 (tiret demi-cadratin) | 'à'
//   entier   := [0-9]+               (chiffres ASCII)
// Les doublons et les recouvrements se fondent en un ensemble. « tous les
// tours », « tour 2 », « tours 1 à 3 et 5 » sont les textes qu'affichent
// l'aperçu et la grille : ce que l'écran montre se relit.
//
// Une cellule qu'un tableur a changée en date — « 2026-03-01 », « 1/3 »,
// « 01-mars », « mars-13 » — se reconnaît avant la grammaire, pour que le
// motif dise de mettre la colonne en texte. Rien ne se tronque en silence :
// un tour hors de la soirée est une faute, pas un tour ignoré.

import { TOURS_MAX } from '../stockage/document.js';

/** Jointure des morceaux d'une présence écrite (§ 10.2) : une virgule, que
 *  la grammaire lit comme séparateur, suivie d'une espace. */
export const JOINTURE_PRESENCE = ', ';

// Une suite d'au moins ce nombre de tours consécutifs s'écrit en plage.
const PLAGE_MIN = 3;

const BLANCS = /\s+/gu;
const TOUS = new Set(['tous', 'tous les tours']);
const PREFIXE = /^tours?\s+/u;
const ELEMENT = /^([0-9]+)(?:\s*[-\u{2013}\u{E0}]\s*([0-9]+))?/u;
const SEPARATEUR = /^(?:\s*(?:,|;|et)\s*|\s+)/u;

// Les mois qu'un tableur écrit dans une date, en français et en anglais,
// abrégés ou entiers, sans le point final, que DATE admet à part.
const MOIS =
  'janv|janvier|f\u{E9}vr|fevr|f\u{E9}vrier|fevrier|mars|avr|avril|mai|juin|juil|juillet|ao\u{FB}t|aout|' +
  'sept|septembre|oct|octobre|nov|novembre|d\u{E9}c|dec|d\u{E9}cembre|decembre|' +
  'jan|feb|mar|apr|may|jun|jul|aug|sep';
const HEURE = '(?:[ t][0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)?';
// Les formes de date d'un tableur, sur la clé en minuscules : année-mois-jour,
// jour/mois[/année], jour-mois et mois-année, ces deux-ci par le nom du mois.
const DATES = [
  new RegExp(`^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}${HEURE}$`, 'u'),
  new RegExp(`^[0-9]{1,2}/[0-9]{1,2}(?:/[0-9]{2,4})?${HEURE}$`, 'u'),
  new RegExp(`^[0-9]{1,2}[-. ](?:${MOIS})\\.?(?:[-. ][0-9]{2,4})?$`, 'u'),
  new RegExp(`^(?:${MOIS})\\.?[-. ][0-9]{2,4}$`, 'u'),
];

// Les éléments d'une liste, [premier, dernier] chacun, dans l'ordre écrit ;
// null quand la clé ne suit pas la grammaire.
function elementsDe(cle) {
  let reste = cle.replace(PREFIXE, '');
  const elements = [];
  for (;;) {
    const element = ELEMENT.exec(reste);
    if (element === null) return null;
    const premier = Number(element[1]);
    elements.push([premier, element[2] === undefined ? premier : Number(element[2])]);
    reste = reste.slice(element[0].length);
    if (reste === '') return elements;
    const separateur = SEPARATEUR.exec(reste);
    if (separateur === null) return null;
    reste = reste.slice(separateur[0].length);
  }
}

// Les tours de 1 à n, liste neuve.
const jusqua = (n) => Array.from({ length: n }, (_, rang) => rang + 1);

/**
 * Lit une cellule « présence » (§ 10.1) sous une soirée de tours tours.
 * Rend { presence } : null pour une cellule vide ou blanche, qui ne dit
 * rien ; 1..tours pour « tous » ou « tous les tours » ; sinon les tours
 * lus, croissants, sans doublon, liste neuve, une liste qui nomme chaque
 * tour comprise. Ou rend { faute: { raison, valeur, tour? } }, valeur
 * étant la cellule en NFC sans ses blancs de bord, raison :
 * - 'date' : une forme qu'un tableur a faite d'une plage, reconnue avant
 *   la grammaire ;
 * - 'syntaxe' : rien de la grammaire ;
 * - 'intervalle' : une plage dont le premier tour dépasse le dernier ;
 * - 'horsTours' : un tour à 0 ou au-delà de tours ; tour est le premier
 *   tour fautif dans l'ordre écrit, le premier au-delà de tours pour une
 *   plage qui déborde.
 * Les éléments se contrôlent dans l'ordre écrit, et le premier fautif
 * donne la raison.
 *
 * @param {string} texte
 * @param {number} tours  le nombre de tours de la soirée
 * @returns {{presence: number[]|null} | {faute: {raison: string, valeur: string, tour?: number}}}
 * @throws {TypeError} quand texte n'est pas une chaîne, ou tours pas un
 *   entier de 1 à TOURS_MAX
 */
export function lirePresence(texte, tours) {
  if (typeof texte !== 'string') throw new TypeError('lirePresence : texte, chaîne attendue');
  if (!Number.isInteger(tours) || tours < 1 || tours > TOURS_MAX) {
    throw new TypeError(`lirePresence : tours, entier de 1 à ${TOURS_MAX} attendu, reçu ${String(tours)}`);
  }
  const valeur = texte.normalize('NFC').trim();
  if (valeur === '') return { presence: null };
  const cle = valeur.toLowerCase();
  if (TOUS.has(cle.replace(BLANCS, ' '))) return { presence: jusqua(tours) };
  if (DATES.some((date) => date.test(cle))) return { faute: { raison: 'date', valeur } };
  const elements = elementsDe(cle);
  if (elements === null) return { faute: { raison: 'syntaxe', valeur } };
  const lus = new Set();
  for (const [premier, dernier] of elements) {
    if (premier > dernier) return { faute: { raison: 'intervalle', valeur } };
    if (premier < 1) return { faute: { raison: 'horsTours', valeur, tour: premier } };
    if (dernier > tours) return { faute: { raison: 'horsTours', valeur, tour: Math.max(premier, tours + 1) } };
    for (let tour = premier; tour <= dernier; tour += 1) lus.add(tour);
  }
  return { presence: [...lus].sort((a, b) => a - b) };
}

/**
 * Écrit une présence en texte (§ 10.2) : vide pour undefined, le champ
 * absent qui vaut tous les tours ; sinon chaque suite d'au moins trois
 * tours consécutifs en « a-b », les autres tours un à un, joints par
 * JOINTURE_PRESENCE : [1, 2, 3] → « 1-3 », [2, 3] → « 2, 3 »,
 * [1, 2, 3, 5] → « 1-3, 5 ». lirePresence relit le texte en la même liste.
 *
 * @param {number[]|undefined} presence  liste non vide d'entiers positifs
 *   strictement croissants
 * @returns {string}
 * @throws {TypeError} pour toute autre valeur : une liste vide se lirait
 *   « tous les tours »
 */
export function ecrirePresence(presence) {
  if (presence === undefined) return '';
  const valide =
    Array.isArray(presence) &&
    presence.length > 0 &&
    presence.every((tour, rang) => Number.isInteger(tour) && tour >= 1 && (rang === 0 || tour > presence[rang - 1]));
  if (!valide) {
    const recu = JSON.stringify(presence) ?? String(presence);
    throw new TypeError(`ecrirePresence : liste croissante de tours attendue, reçu ${recu}`);
  }
  const morceaux = [];
  let debut = 0;
  for (let rang = 1; rang <= presence.length; rang += 1) {
    if (rang < presence.length && presence[rang] === presence[rang - 1] + 1) continue;
    const suite = presence.slice(debut, rang);
    if (suite.length >= PLAGE_MIN) morceaux.push(`${suite[0]}-${suite.at(-1)}`);
    else morceaux.push(...suite.map(String));
    debut = rang;
  }
  return morceaux.join(JOINTURE_PRESENCE);
}
