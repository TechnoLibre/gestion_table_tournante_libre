// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de typographier (§ 14.6) : la suite d'espaces après « et devant
// : » devient une insécable U+00A0, devant ; ? ! une fine insécable U+202F ;
// un signe sans espace devant, le saut de ligne et la tabulation restent ;
// un seul passage de gauche à droite ; la fonction est idempotente et ne
// change que des espaces. Dans la même passe, l'espace entre un nombre et
// son unité, après « n° » et dans une date en lettres devient insécable ; un
// mot qui commence par une unité sans en être une reste sécable. Les textes
// sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { MOIS, UNITES, typographier } from './typographie.js';

// L'insécable et la fine insécable, écrites par leur point de code.
const I = '\u{00A0}';
const F = '\u{202F}';

// [entrée, attendu] : la règle sur les formes qu'en portent les textes de
// l'écran, puis les signes qu'elle laisse.
const CAS = [
  ['Tour 1 : table 3', `Tour 1${I}: table 3`],
  ['Supprimer la table 3 ? Ces saisies partent avec elle :', `Supprimer la table 3${F}? Ces saisies partent avec elle${I}:`],
  ['retenue comprise ; le placement', `retenue comprise${F}; le placement`],
  ['Attention !', `Attention${F}!`],
  ['Le dossier « Mes événements » est trop profond', `Le dossier «${I}Mes événements${I}» est trop profond`],
  ['par « ; », « , » ou', `par «${I};${I}», «${I},${I}» ou`],
  ['« x » ;', `«${I}x${I}»${F};`],
  ['Vraiment ? »', `Vraiment${F}?${I}»`],
  [' : 3 conflits', `${I}: 3 conflits`],
  ['« ', `«${I}`],
  ['\u{2045}« x »\u{2046}', `\u{2045}«${I}x${I}»\u{2046}`],
  ['mot  :', `mot${I}:`],
  [`mot ${I} ;`, `mot${F};`],
  ['21:42:30', '21:42:30'],
  ['20 h 30', `20${I}h${I}30`],
  ['avec https://technolibre.ca pour', 'avec https://technolibre.ca pour'],
  ['site : https://technolibre.ca/?a=1', `site${I}: https://technolibre.ca/?a=1`],
  ['C:\\Dossiers\\x', 'C:\\Dossiers\\x'],
  ['d(p) : A(p)', `d(p)${I}: A(p)`],
  ['«\nligne', '«\nligne'],
  ['mot\n:', 'mot\n:'],
  ['mot\t?', 'mot\t?'],
  ['GNU Affero General Public License v3.0', 'GNU Affero General Public License v3.0'],
  ['', ''],
  ['?', '?'],
];

// Des textes de plus pour les propriétés : insécables déjà posées, suites
// mêlées, milliers et pourcentage à la fine insécable.
const AUTRES = [
  `Tour 1${I}: table 3`,
  `«${F}x${F}»`,
  `mot ${F}${I} !`,
  `1${F}200 places : 3 tables`,
  `12${F}% des places`,
  'Iris Ombrelle : « Qui ? Moi » ; puis !',
  '« « ; » »',
];

// Les unités et les mois de la règle, écrits ici en regard des constantes.
const LISTE_UNITES = ['h', 'min', 's', 'ms', 'mm', 'cm', 'm', 'km', 'po', 'pt', 'px', 'Mo', 'Ko', 'Go', 'Mpx', '%', '°C'];
const LISTE_MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

// [entrée, attendu] : nombres et unités, « n° », dates en lettres ; le trait
// d'union d'une plage et le guillemet simple fermant qui suivent une date ou
// une heure n'empêchent pas la liaison.
const LIES = [
  ['20 h 30', `20${I}h${I}30`],
  ['à 8 h 05 : ouverture', `à 8${I}h${I}05${I}: ouverture`],
  ['3 min 4 s', `3${I}min 4${I}s`],
  ['2 h 15 min', `2${I}h 15${I}min`],
  ['2 h', `2${I}h`],
  ['12,5 s pour 20 essais', `12,5${I}s pour 20 essais`],
  ['proposition n° 12', `proposition n°${I}12`],
  ['N° 4 et n° B', `N°${I}4 et n°${I}B`],
  [`Lettre (215,9 × 279,4 mm)`, `Lettre (215,9 × 279,4${I}mm)`],
  [`1${F}200 px`, `1${F}200${I}px`],
  ['2,5 cm', `2,5${I}cm`],
  [`pèse 30,1 Mo, au-delà des 25 Mo`, `pèse 30,1${I}Mo, au-delà des 25${I}Mo`],
  [`12${F}% des places`, `12${F}% des places`],
  ['à 100 %', `à 100${F}%`],
  [`3${F}h`, `3${F}h`],
  ['17 mai 2031', `17${I}mai${I}2031`],
  ['le 1er janvier 2032 à 21 h 40', `le 1er${I}janvier${I}2032 à 21${I}h${I}40`],
  ['le 3 mars', `le 3${I}mars`],
  ['en août 2031', `en août${I}2031`],
  ['17  mai', `17${I}mai`],
  ['du 3 mai-5 juin', `du 3${I}mai-5${I}juin`],
  ['de 20 h 30-22 h 00', `de 20${I}h${I}30-22${I}h${I}00`],
  ['17 mai 2031-2032', `17${I}mai${I}2031-2032`],
  ['en août 2031-2032', `en août${I}2031-2032`],
  ['\u{2018}le 31 mai\u{2019}', `\u{2018}le 31${I}mai\u{2019}`],
  ["20 h 30 s'y rangent", `20${I}h${I}30 s'y rangent`],
  ['de 3 h-4 h', `de 3 h-4${I}h`],
];

// Des textes que la règle laisse : un mot qui commence par une unité sans
// en être une, dont les formes réelles des tables de libellés ; un nombre
// collé à une lettre ; une heure à deux-points ; « n° » sans espace.
const NON_LIES = [
  'le 3 mai2031',
  'du 3mai 2031',
  'en mai 2031e',
  'le 123 mai',
  'v3 mai',
  '3 sièges',
  '2 personnes',
  '12 personnes',
  '4 tours',
  '3 tours',
  '2 places',
  '4 sur 6',
  '2 pour 3',
  `100${F}000 mouvements`,
  '3 seulement',
  '2 sans place',
  '3 meilleures',
  '1 sort',
  '1 sert',
  "3 s'y rangent",
  '3 s\u{2019}y rangent',
  '2 surchargées',
  '1 sous',
  '2 sont',
  '1 moins',
  '3 mobiles',
  '1 mobile',
  '2 millions',
  '1 même',
  '1 hors',
  '2 se placent',
  '1 porte',
  '12 mais',
  '3 maisons',
  '2 mn',
  'A4 m',
  'v3 s',
  '21:42:30',
  'n°3',
  'mai 31',
  'n° ⟨x⟩',
];

describe('typographier : la ponctuation haute (§ 14.6)', () => {
  test('vingt-cinq cas : U+00A0 après « et devant : », U+202F devant ; ? !, rien sans espace devant', () => {
    assert.equal(CAS.length, 25);
    for (const [entree, attendu] of CAS) assert.equal(typographier(entree), attendu, JSON.stringify(entree));
  });

  test('un seul passage, de gauche à droite : l’espace qui suit « appartient au guillemet, même devant un signe', () => {
    assert.equal(typographier('« « ; » »'), `«${I}«${I};${I}»${I}»`);
    assert.equal(typographier('« ? »'), `«${I}?${I}»`);
  });

  test('la fine insécable des milliers et du pourcentage reste ; une suite qui la contient se réduit', () => {
    assert.equal(typographier(`1${F}200 places : 3 tables`), `1${F}200 places${I}: 3 tables`);
    assert.equal(typographier(`12${F}% des places`), `12${F}% des places`);
    assert.equal(typographier(`mot ${F}${I} !`), `mot${F}!`);
    assert.equal(typographier(`«${F}x${F}»`), `«${I}x${I}»`);
  });

  test('idempotente : un texte déjà typographié ne change plus', () => {
    for (const texte of [...CAS.map(([entree]) => entree), ...AUTRES]) {
      const une = typographier(texte);
      assert.equal(typographier(une), une, JSON.stringify(texte));
    }
  });

  test('seules les espaces changent : sans elles, le texte est le même ; les insécables ramenées à l’espace, aussi', () => {
    const sansEspaces = (texte) => texte.replace(/[ \u{00A0}\u{202F}]/gu, '');
    const ramene = (texte) => texte.replace(/[ \u{00A0}\u{202F}]+/gu, ' ');
    for (const texte of [...CAS.map(([entree]) => entree), ...AUTRES]) {
      const rendu = typographier(texte);
      assert.equal(sansEspaces(rendu), sansEspaces(texte), JSON.stringify(texte));
      assert.equal(ramene(rendu), ramene(texte), JSON.stringify(texte));
    }
  });

  test('aucune espace ordinaire ne reste devant ; : ? ! » ni après «', () => {
    for (const texte of [...CAS.map(([entree]) => entree), ...AUTRES]) {
      const rendu = typographier(texte);
      assert.doesNotMatch(rendu, / [;:?!»]/u, JSON.stringify(texte));
      assert.doesNotMatch(rendu, /« /u, JSON.stringify(texte));
    }
  });

  test('ce qui n’est pas une chaîne lève TypeError', () => {
    assert.throws(() => typographier(undefined), TypeError);
    assert.throws(() => typographier(3), TypeError);
  });
});

describe('typographier : nombres et unités, « n° », dates en lettres (§ 14.6)', () => {
  test('les constantes nomment les unités et les mois de la règle', () => {
    assert.deepEqual(UNITES, LISTE_UNITES);
    assert.deepEqual(MOIS, LISTE_MOIS);
  });

  test('chaque unité de la liste se lie à son nombre ; « % » à la fine insécable', () => {
    for (const unite of LISTE_UNITES) {
      const espace = unite === '%' ? F : I;
      assert.equal(typographier(`3 ${unite}`), `3${espace}${unite}`, unite);
      assert.equal(typographier(`soit 2,5 ${unite}, pas plus`), `soit 2,5${espace}${unite}, pas plus`, unite);
    }
  });

  test('chaque mois se lie au jour qui le précède et à l’année qui le suit', () => {
    for (const mois of LISTE_MOIS) {
      assert.equal(typographier(`le 1er ${mois} 2032`), `le 1er${I}${mois}${I}2032`, mois);
      assert.equal(typographier(`le 28 ${mois}`), `le 28${I}${mois}`, mois);
    }
  });

  test('vingt-sept cas liés : heure, durée, « n° », nombre groupé ou décimal, date, plage ; une U+202F existante reste', () => {
    assert.equal(LIES.length, 27);
    for (const [entree, attendu] of LIES) assert.equal(typographier(entree), attendu, JSON.stringify(entree));
  });

  test('un mot qui commence par une unité sans en être une reste sécable', () => {
    for (const texte of NON_LIES) assert.equal(typographier(texte), texte, JSON.stringify(texte));
  });

  test('idempotente, et seules les espaces changent', () => {
    const sansEspaces = (texte) => texte.replace(/[ \u{00A0}\u{202F}]/gu, '');
    const ramene = (texte) => texte.replace(/[ \u{00A0}\u{202F}]+/gu, ' ');
    for (const texte of [...LIES.map(([entree]) => entree), ...NON_LIES]) {
      const rendu = typographier(texte);
      assert.equal(typographier(rendu), rendu, JSON.stringify(texte));
      assert.equal(sansEspaces(rendu), sansEspaces(texte), JSON.stringify(texte));
      assert.equal(ramene(rendu), ramene(texte), JSON.stringify(texte));
    }
  });
});
