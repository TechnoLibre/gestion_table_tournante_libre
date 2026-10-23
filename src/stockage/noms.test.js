// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves des noms de fichiers d'un événement (§ 8.6, § 8.7, § 14.10) : les
// valeurs du contrat, la longueur du plus long chemin relatif qu'un événement
// écrit, la dérivation de la base d'un nom — caractères invisibles et
// demi-paires isolées, noms réservés, caractères que Windows refuse, composition
// en NFC, collisions comparées par la majuscule, borne du chemin complet — et
// le dossier daté de la corbeille, jusqu'à son dernier rang, le dossier d'un
// événement, le nom du fichier de la planche de badges (§ 11.6), et celui
// qu'il prend quand l'événement change de base (§ 8.7). Chaque épreuve de
// dérivation se joue sur les deux dossiers de travail possibles du § 8.6.
//
// La borne s'éprouve contre un oracle écrit ici : chaque chemin qu'un
// événement écrit se recompose en entier, de la racine au suffixe, avec des
// textes littéraux et non les constantes du module — à la racine, dans le
// dossier de l'événement, qui porte le nom de sa base, et dans le dossier
// daté de la corbeille, logo d'une personne compris. Une borne prise sur le
// seul état, sur le seul journal, sur la base comptée une fois, ou sans le
// logo dans la corbeille, y dépasse 259 unités. Les noms d'épreuve sont
// inventés. Un caractère invisible ou combinant s'écrit en échappement,
// jamais en clair : ce qu'on ne voit pas ne se relit pas.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { PAPIERS } from '../geometrie/papiers.js';
import { ErreurStockage } from './erreurs.js';
import {
  DOSSIER_CORBEILLE,
  LONGUEUR_CHEMIN_MAX,
  NOMS_RESERVES_RACINE,
  SUFFIXES,
  SUFFIXE_ECRITURE,
  cleEvenement,
  decouperCle,
  deriverBase,
  dossierCorbeille,
  dossierEvenement,
  longueurRelativeMax,
  nomControle,
  nomCsvBadges,
  nomCsvBadgesExigeListe,
  nomPlanche,
  nomPlancheExigeListe,
  nomSortieRenommee,
} from './noms.js';
import { FICHIER_REGLAGES } from './reglages_locaux.js';

// Les deux dossiers de travail possibles (§ 8.6) : data/ dans le dossier du
// produit des Documents, et data/ à côté d'un exécutable posé sur un support
// amovible.
const DOSSIERS = [
  { racine: 'C:\\Users\\Exemple\\Documents\\Gestion table tournante Libre\\data', separateur: '\\' },
  { racine: 'E:\\soirees\\data', separateur: '\\' },
];

// Le dossier daté de la corbeille au rang de collision le plus long, à deux
// chiffres, et les suffixes des fichiers d'un événement : le journal en compte
// 18, l'état 9, le compagnon des courses 17, et la planche sans marque la
// plus longue, d'une réédition de 9 999 badges, 51.
const CORBEILLE_RANG_99 = 'corbeille/2026-10-06_19-02-11_99';
const SUFFIXE_BADGES = '.badges-9999_Lettre_feuille_2026-10-06_19-02-11.pdf';
const SUFFIXES_ECRITS = ['.gtt.json', '.gtt.json.precedent', '.gtt-journal.jsonl', '.gtt.verrou', '.gtt-courses.json', SUFFIXE_BADGES];

// Le logo d'une personne, sous le dossier logo/ de l'événement, nommé par
// l'empreinte de son contenu en 64 chiffres hexadécimaux : 73 unités, qui ne
// dépendent pas de la base. La suppression le déplace, sans écriture, dans
// le dossier daté de la corbeille, à son niveau : 33 + 73 = 106 unités.
const LOGO = `logo/${'0123456789abcdef'.repeat(4)}.png`;

// Les noms des entrées que la racine du dossier de travail porte à côté des
// dossiers d'événement : la corbeille, les réglages locaux, le témoin de la
// sonde.
const ENTREES_RACINE = ['corbeille', 'reglages_locaux.json', '.gtt-temoin'];

// Le caractère de substitution haute d'une paire, et celui de substitution basse.
const estHaute = (unite) => unite >= 0xd800 && unite <= 0xdbff;
const estBasse = (unite) => unite >= 0xdc00 && unite <= 0xdfff;

// n lettres de l'alphabet, répété : ni espace ni point, et chaque position
// d'une coupe se reconnaît.
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
const lettres = (n) => Array.from({ length: n }, (_, i) => ALPHABET[i % ALPHABET.length]).join('');

// Plus long chemin de la liste ; le premier en cas d'égalité.
const plusLong = (chemins) => chemins.reduce((a, b) => (b.length > a.length ? b : a));

// Chaque chemin relatif qu'un événement de base donnée écrit : un fichier de
// chaque suffixe et son fichier d'écriture atomique, à la racine du dossier de
// travail, puis dans le dossier de l'événement, qui porte le nom de sa base,
// puis dans le dossier daté de la corbeille, qui porte directement les
// fichiers ; enfin le logo, dans le dossier de l'événement, en écriture
// atomique, puis dans le dossier daté de la corbeille.
function cheminsRelatifs(base) {
  const noms = SUFFIXES_ECRITS.flatMap((suffixe) => [`${base}${suffixe}`, `${base}${suffixe}.ecriture`]);
  return [
    ...noms,
    ...noms.map((nom) => `${base}/${nom}`),
    ...noms.map((nom) => `${CORBEILLE_RANG_99}/${nom}`),
    `${base}/${LOGO}`,
    `${base}/${LOGO}.ecriture`,
    `${CORBEILLE_RANG_99}/${LOGO}`,
  ];
}

// Chaque chemin complet : la racine, un seul séparateur, puis le chemin
// relatif écrit avec ce séparateur.
function cheminsComplets({ racine, separateur }, base) {
  const tete = racine.endsWith(separateur) ? racine : racine + separateur;
  return cheminsRelatifs(base).map((relatif) => tete + relatif.replaceAll('/', separateur));
}

// Plus grande longueur de base dont le plus long chemin complet tient en 259
// unités : l'oracle de la borne, qui ne lit que des chemins recomposés.
function longueurMaxDeBase(dossier) {
  let n = 0;
  while (plusLong(cheminsComplets(dossier, 'a'.repeat(n + 1))).length <= 259) n += 1;
  return n;
}

// Le contexte que deriverBase reçoit pour un dossier de travail.
const contexte = ({ racine, separateur }, existantes = []) => ({ racine, separateur, existantes });
const derive = (nom, dossier, existantes = []) => deriverBase(nom, contexte(dossier, existantes));

// Une épreuve par dossier de travail : son titre dit lequel.
function surChaqueDossier(titre, epreuve) {
  for (const dossier of DOSSIERS) test(`${titre} — ${dossier.racine}`, () => epreuve(dossier));
}

// L'erreur que lève fonction ; échoue quand elle n'en lève aucune.
function erreurDe(fonction) {
  try {
    fonction();
  } catch (erreur) {
    return erreur;
  }
  return assert.fail('aucune erreur levée');
}

// Vrai quand fonction lève CHEMIN_TROP_LONG, qui nomme la racine donnée.
function refuseTropLong(fonction, racine) {
  const erreur = erreurDe(fonction);
  assert.ok(erreur instanceof ErreurStockage, `${erreur?.name} au lieu d'une ErreurStockage`);
  assert.equal(erreur.code, 'CHEMIN_TROP_LONG');
  assert.deepEqual(erreur.details, { racine });
}

// Un dossier de travail dont la racine compte n unités, lecteur compris.
const dossierDeLongueur = (n) => ({ racine: `C:\\${'x'.repeat(n - 3)}`, separateur: '\\' });

// Une base lue sur le disque, plus longue que toute base que deriverBase
// rend sous la racine du dossier — celle d'un fichier d'état copié à la
// main : la plus longue dont la planche sans marque la plus longue, posée à
// la racine en écriture atomique, tient en 259 unités. Tout nom marqué s'y
// raccourcit.
function baseLueLongue({ racine, separateur }) {
  const unites = racine.endsWith(separateur) ? racine.length - 1 : racine.length;
  return lettres(259 - (unites + 1) - SUFFIXE_BADGES.length - '.ecriture'.length);
}

// Les noms que Windows réserve, en capitales : CON, PRN, AUX, NUL, COM et LPT
// de 0 à 9 et des exposants ¹ ² ³, CONIN$ et CONOUT$.
const CHIFFRES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '\u00b9', '\u00b2', '\u00b3'];
const NOMS_RESERVES = [
  'CON', 'PRN', 'AUX', 'NUL',
  ...CHIFFRES.map((chiffre) => `COM${chiffre}`),
  ...CHIFFRES.map((chiffre) => `LPT${chiffre}`),
  'CONIN$', 'CONOUT$',
];
const MINUSCULES_RESERVEES = new Set(NOMS_RESERVES.map((nom) => nom.toLowerCase()));

// Vrai quand Windows verrait un périphérique : la partie avant le premier
// point, espaces finaux retirés, est un nom réservé.
const estReserve = (base) => MINUSCULES_RESERVEES.has(base.split('.')[0].trimEnd().toLowerCase());

// Clé de comparaison de deux bases : la majuscule de leur NFC, comme Windows
// compare deux noms de fichier, caractère par caractère et sans contexte.
const cle = (base) => base.normalize('NFC').toUpperCase();

// Les caractères qu'aucun œil ne voit : de contrôle (Cc), de format (Cf) et
// ignorables par défaut.
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}]/u;

// Un caractère par son point de code, U+XXXX ; un texte par ceux de tous ses
// caractères, séparés d'une espace : la seule façon de lire un écart de
// composition, où une lettre et sa marque combinante se confondent à l'écran.
const pointDeCode = (caractere) => `U+${caractere.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
const pointsDeCode = (texte) => Array.from(texte, pointDeCode).join(' ');

// Un texte où chaque caractère invisible, et chaque demi-paire de substitution
// isolée, s'écrit ⟨U+XXXX⟩ : la seule façon de lire un écart qu'on ne voit pas.
const visible = (texte) =>
  texte.replace(/[\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}\ud800-\udfff]/gu, (caractere) => `⟨${pointDeCode(caractere)}⟩`);

describe('noms.js : valeurs du contrat', () => {
  test('SUFFIXES, SUFFIXE_ECRITURE, DOSSIER_CORBEILLE et LONGUEUR_CHEMIN_MAX valent le contrat, et SUFFIXES ne se modifie pas', () => {
    // Seule épreuve qui écrit ces valeurs en clair : les autres recomposent
    // les chemins avec des textes littéraux.
    assert.deepEqual(SUFFIXES, {
      etat: '.gtt.json',
      precedent: '.gtt.json.precedent',
      journal: '.gtt-journal.jsonl',
      verrou: '.gtt.verrou',
      courses: '.gtt-courses.json',
    });
    assert.ok(Object.isFrozen(SUFFIXES));
    assert.equal(SUFFIXE_ECRITURE, '.ecriture');
    assert.equal(DOSSIER_CORBEILLE, 'corbeille');
    assert.equal(LONGUEUR_CHEMIN_MAX, 259);
  });

  test("longueurs des suffixes : l'état 9, le journal 18, l'état précédent 19, le compagnon des courses 17, et 28 avec le suffixe d'écriture", () => {
    assert.deepEqual(
      [SUFFIXES.etat, SUFFIXES.precedent, SUFFIXES.journal, SUFFIXES.verrou, SUFFIXES.courses].map(
        (suffixe) => suffixe.length,
      ),
      [9, 19, 18, 11, 17],
    );
    assert.equal(SUFFIXE_ECRITURE.length, 9);
    assert.equal(`${SUFFIXES.precedent}${SUFFIXE_ECRITURE}`.length, 28);
    assert.equal(`${SUFFIXES.journal}${SUFFIXE_ECRITURE}`.length, 27);
  });
});

describe("longueurRelativeMax : le plus long chemin relatif qu'un événement écrit", () => {
  test("elle vaut la longueur du plus long chemin recomposé : le logo dans la corbeille sous 13 unités de base, puis la planche la plus longue en écriture atomique, dans la corbeille au rang 99 jusqu'à 32 unités, dans le dossier de l'événement au-delà", () => {
    const cas = [
      ['', 'logo'],
      ['a', 'logo'],
      ['Gala', 'logo'],
      [lettres(12), 'logo'],
      [lettres(14), 'corbeille'],
      [lettres(31), 'corbeille'],
      [lettres(33), 'dossier'],
      [lettres(100), 'dossier'],
      [lettres(197), 'dossier'],
    ];
    assert.ok(cas.length > 0, 'aucune base examinée');
    for (const [base, ou] of cas) {
      const plus = plusLong(cheminsRelatifs(base));
      const tete = ou === 'corbeille' ? CORBEILLE_RANG_99 : base;
      const attendu = ou === 'logo' ? `${CORBEILLE_RANG_99}/${LOGO}` : `${tete}/${base}${SUFFIXE_BADGES}.ecriture`;
      assert.equal(plus, attendu, `base de ${base.length} unités`);
      assert.equal(longueurRelativeMax(base), plus.length, `base de ${base.length} unités`);
    }
    // Les parties qui ne dépendent pas de la base : dans le dossier de
    // l'événement, le séparateur, la planche et .ecriture, 1 + 51 + 9, outre
    // deux fois la base ; dans la corbeille, le dossier daté et son
    // séparateur, la planche et .ecriture, 33 + 51 + 9, outre la base ; le
    // logo dans la corbeille, 33 + 73, quelle que soit la base. Les deux
    // premières se valent à 32 unités, la corbeille et le logo à 13.
    assert.equal(longueurRelativeMax(lettres(100)), 2 * 100 + 1 + 51 + 9);
    assert.equal(longueurRelativeMax(''), 33 + 73);
    assert.equal(longueurRelativeMax(lettres(12)), 106);
    assert.equal(longueurRelativeMax(lettres(13)), 13 + 93);
    assert.equal(longueurRelativeMax(lettres(13)), 106);
    assert.equal(longueurRelativeMax(lettres(14)), 14 + 93);
    assert.equal(longueurRelativeMax(lettres(32)), 2 * 32 + 61);
    assert.equal(longueurRelativeMax(lettres(32)), 32 + 93);
    // Le logo dans le dossier de l'événement, en écriture atomique, compte
    // 1 + 73 + 9 unités outre la base : toujours moins que la corbeille.
    assert.ok(`${lettres(12)}/${LOGO}.ecriture`.length < longueurRelativeMax(lettres(12)));
  });

  test("le rang le plus long que rend dossierCorbeille est celui que la longueur retient : deux chiffres, au rang 99", () => {
    const horodatage = '2026-10-06T19:02:11-04:00';
    const premier = dossierCorbeille(horodatage, []);
    // Les rangs 2 à 98 sont pris : le suivant est le 99.
    const existants = [premier, ...Array.from({ length: 97 }, (_, i) => `${premier}_${i + 2}`)];
    assert.equal(existants.length, 98);
    const dernier = dossierCorbeille(horodatage, existants);
    assert.equal(dernier, CORBEILLE_RANG_99);
    assert.equal(longueurRelativeMax('Gala des Saules'), `${dernier}/Gala des Saules${SUFFIXE_BADGES}.ecriture`.length);
  });
});

describe('deriverBase : les deux dossiers de travail', () => {
  test("leur racine compte 61 et 15 unités, et la borne laisse 68 et 91 unités à la base", () => {
    assert.deepEqual(DOSSIERS.map(({ racine }) => racine.length), [61, 15]);
    // (259 − racine − 1 séparateur − 61) / 2 : la base compte deux fois, au
    // dossier de l'événement et à ses fichiers.
    assert.deepEqual(DOSSIERS.map(longueurMaxDeBase), [(259 - 61 - 1 - 61) / 2, (259 - 15 - 1 - 61) / 2]);
    assert.deepEqual(DOSSIERS.map(longueurMaxDeBase), [68, 91]);
    // Le module laisse ces longueurs à la base d'un nom qui les dépasse.
    assert.deepEqual(DOSSIERS.map((dossier) => derive(lettres(400), dossier).length), [68, 91]);
  });
});

describe('deriverBase : les caractères de format et les demi-paires isolées', () => {
  surChaqueDossier('un nom fait de seuls caractères de format ou de demi-paires isolées donne evenement, jamais une base invisible', (dossier) => {
    const invisibles = [
      '\u200b',
      '\u200b\u200c\u200d\u2060\ufeff\u00ad',
      '\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069',
      '\ud800',
      '\udfff',
      '\ude00\ud83d',
      '\u{e0041}\u{e007f}',
      ' \u200b . \u200b ',
    ];
    assert.ok(invisibles.length > 0, 'aucun nom examiné');
    assert.deepEqual(invisibles.map((nom) => derive(nom, dossier)), invisibles.map(() => 'evenement'));
  });

  surChaqueDossier('chaque caractère de format, et chaque demi-paire isolée, est retiré, non remplacé', (dossier) => {
    // Espace, antiliant et liant sans chasse ; marques, enchâssements, forçages
    // et isolats bidirectionnels ; trait d'union conditionnel ; gluon de mots ;
    // U+FEFF ; marque de lettre arabe ; une étiquette, hors du plan de base.
    const formats = [
      '\u200b', '\u200c', '\u200d', '\u200e', '\u200f',
      '\u202a', '\u202b', '\u202c', '\u202d', '\u202e',
      '\u2066', '\u2067', '\u2068', '\u2069',
      '\u00ad', '\u2060', '\ufeff', '\u061c', '\u{e0041}',
    ];
    const demiPaires = ['\ud800', '\udbff', '\udc00', '\udfff'];
    assert.equal(formats.length, 19);
    assert.equal(demiPaires.length, 4);
    const ecarts = [...formats, ...demiPaires]
      .map((caractere) => [caractere, derive(`Ga${caractere}la`, dossier)])
      .filter(([, base]) => base !== 'Gala')
      .map(([caractere, base]) => `U+${caractere.codePointAt(0).toString(16).padStart(4, '0')} donne ${JSON.stringify(base)}`);
    assert.deepEqual(ecarts, []);
    assert.equal(derive('\u200eGala\u200e', dossier), 'Gala');
    assert.equal(derive('\ufeffGala\ufeff', dossier), 'Gala');
    // U+FEFF, que \s compte parmi les blancs, part sans laisser d'espace.
    assert.equal(derive('Ga\ufeffla', dossier), 'Gala');
    // Un forçage de droite à gauche part : la fin du nom s'affiche comme elle s'écrit.
    assert.equal(derive('Gala\u202eslx.exe', dossier), 'Galaslx.exe');
    // Une paire bien formée, emoji ou idéogramme hors du plan de base, reste.
    assert.equal(derive('Gala\u{1F600}', dossier), 'Gala\u{1F600}');
    assert.equal(derive('\u{20000}', dossier), '\u{20000}');
  });

  surChaqueDossier('le retrait précède toutes les autres règles : composition, caractères refusés, blancs, bords, noms réservés', (dossier) => {
    const cas = [
      // Entre une lettre et sa marque combinante, un caractère de format
      // empêcherait la composition : la base sort en NFC.
      ['Soire\u200b\u0301e', 'Soir\u00e9e'],
      ['a<\u200b\u0338b', 'a\u226eb'],
      // Deux moitiés que sépare un caractère refusé ne se recollent pas.
      ['Ga\ud83d<\ude00la', 'Gala'],
      // Retirés d'abord, ils ne séparent ni deux blancs ni un bord.
      ['Gala \u200b du', 'Gala du'],
      ['.\u200b.Gala.\u200b.', 'Gala'],
      [' \u2060 Gala \u2060 ', 'Gala'],
      // Un nom réservé qu'ils masquent se reconnaît.
      ['C\u200bON', 'CON_'],
      ['con\u200e.soir\u00e9e', 'con_.soir\u00e9e'],
    ];
    assert.ok(cas.length > 0, 'aucun cas examiné');
    assert.deepEqual(
      cas.map(([nom]) => derive(nom, dossier)),
      cas.map(([, attendu]) => attendu),
    );
  });

  surChaqueDossier('un nom à caractère de format ou à demi-paire isolée heurte le même nom sans eux', (dossier) => {
    assert.equal(derive('Gala\u200b', dossier, ['gala']), 'Gala (2)');
    assert.equal(derive('\u200eGALA\u200e', dossier, ['gala', 'Gala (2)']), 'GALA (3)');
    // Deux noms qui ne diffèrent que par une demi-paire donnent la même base :
    // le second prend un rang au lieu d'écrire le même fichier.
    const premier = derive('Gala\ud800', dossier);
    assert.equal(premier, 'Gala');
    assert.equal(derive('Gala\udbff', dossier, [premier]), 'Gala (2)');
  });
});

describe('deriverBase : les caractères de contrôle et les ignorables par défaut', () => {
  // Les trois noms que ni les caractères refusés par Windows ni \s ne couvrent :
  // un contrôle de C1, un remplisseur hangul et un sélecteur de variante. Gardés,
  // chacun donnerait une base qui ne se voit pas.
  surChaqueDossier('un nom fait du seul U+0085, contrôle de C1, donne evenement', (dossier) => {
    assert.equal(visible(derive('\u{85}', dossier)), 'evenement');
  });

  surChaqueDossier('un nom fait du seul U+3164, remplisseur hangul qui se dessine en blanc, donne evenement', (dossier) => {
    assert.equal(visible(derive('\u{3164}', dossier)), 'evenement');
  });

  surChaqueDossier('un nom fait du seul U+FE0F, sélecteur de variante, donne evenement', (dossier) => {
    assert.equal(visible(derive('\u{fe0f}', dossier)), 'evenement');
  });

  surChaqueDossier('un nom fait de seuls contrôles ou ignorables par défaut, mêlés ou non de blancs et de points, donne evenement', (dossier) => {
    const invisibles = [
      // DEL, puis le premier et le dernier contrôle de C1.
      '\u{7f}',
      '\u{80}\u{9f}',
      '\u{85}\u{85}\u{85}',
      // Lien de graphèmes, remplisseurs hangul, voyelles inhérentes khmères.
      '\u{34f}',
      '\u{115f}\u{1160}\u{3164}\u{ffa0}',
      '\u{17b4}\u{17b5}',
      // Sélecteurs de variante : mongols, de base, du supplément.
      '\u{180b}\u{180c}\u{180d}\u{180f}',
      '\u{fe00}\u{fe0f}',
      '\u{e0100}\u{e01ef}',
      // Ignorables par défaut que rien n'assigne.
      '\u{2065}\u{fff0}\u{fff8}',
      // De format sans être ignorables par défaut : signe de nombre arabe, marque de fin d'ayah.
      '\u{600}\u{6dd}',
      ' \u{3164} . \u{85} ',
    ];
    assert.ok(invisibles.length > 0, 'aucun nom examiné');
    const ecarts = invisibles
      .map((nom) => [nom, derive(nom, dossier)])
      .filter(([, base]) => base !== 'evenement')
      .map(([nom, base]) => `${visible(nom)} donne ${visible(base)}`);
    assert.deepEqual(ecarts, []);
  });

  surChaqueDossier('chaque caractère de contrôle, de format ou ignorable par défaut est retiré, non remplacé', (dossier) => {
    // Les membres de la classe se lisent au moteur : aucun n'est oublié, quelle
    // que soit la version d'Unicode qu'il embarque.
    const membres = [];
    for (let code = 0; code <= 0x10ffff; code += 1) {
      if (code >= 0xd800 && code <= 0xdfff) continue;
      const caractere = String.fromCodePoint(code);
      if (INVISIBLE.test(caractere)) membres.push(caractere);
    }
    assert.ok(membres.length > 4000, `${membres.length} caractères examinés`);
    const ecarts = membres
      .map((caractere) => [caractere, derive(`Ga${caractere}la`, dossier)])
      .filter(([, base]) => base !== 'Gala')
      .map(([caractere, base]) => `${visible(caractere)} donne ${visible(base)}`);
    assert.deepEqual(ecarts, []);
  });

  surChaqueDossier('une tabulation et une fin de ligne sont retirées, non remplacées par une espace', (dossier) => {
    const cas = [
      ['Ga\tla', 'Gala'],
      ['Ga\nla', 'Gala'],
      ['Ga\r\nla', 'Gala'],
      ['Gala\tdu\nsoir', 'Galadusoir'],
      // L'espace, elle, reste.
      ['Gala du\tsoir', 'Gala dusoir'],
    ];
    assert.ok(cas.length > 0, 'aucun cas examiné');
    assert.deepEqual(
      cas.map(([nom]) => derive(nom, dossier)),
      cas.map(([, attendu]) => attendu),
    );
  });

  surChaqueDossier("le retrait précède les autres règles : un contrôle ou un ignorable ne masque ni un nom réservé, ni une collision, ni un bord", (dossier) => {
    const cas = [
      ['C\u{3164}ON', [], 'CON_'],
      ['con\u{85}.soir\u{e9}e', [], 'con_.soir\u{e9}e'],
      ['Gala\u{3164}', ['gala'], 'Gala (2)'],
      ['\u{fe0f}Gala\u{fe0f}', [], 'Gala'],
      ['. \u{85} Gala \u{3164} .', [], 'Gala'],
      ['Ga\u{85}la', [], 'Gala'],
    ];
    assert.ok(cas.length > 0, 'aucun cas examiné');
    assert.deepEqual(
      cas.map(([nom, existantes]) => visible(derive(nom, dossier, existantes))),
      cas.map(([, , attendu]) => attendu),
    );
  });
});

describe('deriverBase : les noms réservés (§ 8.6)', () => {
  surChaqueDossier('con et CON reçoivent « _ », con.soirée aussi, Com1 de même, et console reste', (dossier) => {
    const cas = [
      ['con', 'con_'],
      ['CON', 'CON_'],
      ['con.soirée', 'con_.soirée'],
      ['Com1', 'Com1_'],
      ['console', 'console'],
    ];
    assert.ok(cas.length > 0, 'aucun cas examiné');
    assert.deepEqual(
      cas.map(([nom]) => derive(nom, dossier)),
      cas.map(([, attendu]) => attendu),
    );
  });

  surChaqueDossier('chacun des noms réservés, en minuscules, en capitales et capitalisé, reçoit « _ »', (dossier) => {
    const casses = (nom) => [nom.toLowerCase(), nom, nom[0] + nom.slice(1).toLowerCase()];
    const cas = NOMS_RESERVES.flatMap(casses);
    assert.equal(NOMS_RESERVES.length, 4 + 13 + 13 + 2);
    assert.equal(cas.length, NOMS_RESERVES.length * 3);
    const ecarts = cas
      .map((nom) => [nom, derive(nom, dossier)])
      .filter(([nom, base]) => base !== `${nom}_`)
      .map(([nom, base]) => `${JSON.stringify(nom)} donne ${JSON.stringify(base)}`);
    assert.deepEqual(ecarts, []);
  });

  surChaqueDossier('seule la partie avant le premier point compte : un nom voisin ou réservé après le point reste', (dossier) => {
    const intacts = [
      'COM10', 'COM', 'COMA', 'LPT', 'LPT10', 'CON1', 'CONIN', 'CONOUT', 'NULL', 'AUXE', 'PRN0',
      'console', 'COM\u00b9\u00b9', 'CONIN$$', 'xcon', 'con soirée', 'soirée.con', 'a.nul', 'con_', 'conin$x',
    ];
    assert.ok(intacts.length > 0, 'aucun nom examiné');
    assert.deepEqual(intacts.map((nom) => derive(nom, dossier)), intacts);
    const reserves = [
      ['Nul.txt', 'Nul_.txt'],
      ['aux.c.d', 'aux_.c.d'],
      ['COM\u00b9.x', 'COM\u00b9_.x'],
      ['lpt9.log', 'lpt9_.log'],
      ['conin$.x', 'conin$_.x'],
      ['Con.Soirée.Finale', 'Con_.Soirée.Finale'],
    ];
    assert.ok(reserves.length > 0, 'aucun nom examiné');
    assert.deepEqual(
      reserves.map(([nom]) => derive(nom, dossier)),
      reserves.map(([, attendu]) => attendu),
    );
  });

  surChaqueDossier('un nom réservé se reconnaît après le nettoyage, et des espaces avant le point ne le défont pas', (dossier) => {
    const cas = [
      ['c:o:n', 'con_'],
      ['CO<N', 'CON_'],
      ['. con .', 'con_'],
      ['con\u00a0', 'con_'],
      ['con .soirée', 'con_ .soirée'],
      ['con   .soirée', 'con_ .soirée'],
      ['NUL . x', 'NUL_ . x'],
    ];
    assert.ok(cas.length > 0, 'aucun cas examiné');
    assert.deepEqual(
      cas.map(([nom]) => derive(nom, dossier)),
      cas.map(([, attendu]) => attendu),
    );
  });
});

describe('deriverBase : les entrées de la racine du dossier de travail (§ 8.6)', () => {
  test('NOMS_RESERVES_RACINE nomme la corbeille, les réglages locaux et le témoin de la sonde, et ne se modifie pas', () => {
    assert.deepEqual([...NOMS_RESERVES_RACINE], ENTREES_RACINE);
    assert.ok(Object.isFrozen(NOMS_RESERVES_RACINE));
    // Les mêmes noms que ceux de la corbeille et du fichier des réglages.
    assert.ok(NOMS_RESERVES_RACINE.includes(DOSSIER_CORBEILLE));
    assert.ok(NOMS_RESERVES_RACINE.includes(FICHIER_REGLAGES));
  });

  surChaqueDossier('corbeille et reglages_locaux.json prennent le rang (2), quelle que soit la casse, comme une collision', (dossier) => {
    const cas = [
      ['corbeille', 'corbeille (2)'],
      ['Corbeille', 'Corbeille (2)'],
      ['CORBEILLE', 'CORBEILLE (2)'],
      [' corbeille. ', 'corbeille (2)'],
      ['corbe<ille', 'corbeille (2)'],
      ['reglages_locaux.json', 'reglages_locaux.json (2)'],
      ['Reglages_Locaux.JSON', 'Reglages_Locaux.JSON (2)'],
    ];
    assert.ok(cas.length > 0, 'aucun cas examiné');
    assert.deepEqual(
      cas.map(([nom]) => derive(nom, dossier)),
      cas.map(([, attendu]) => attendu),
    );
    // Le rang (2) pris, le suivant ; un ensemble d'existantes vaut une liste.
    assert.equal(derive('corbeille', dossier, ['CORBEILLE (2)']), 'corbeille (3)');
    assert.equal(derive('Corbeille', dossier, new Set(['corbeille (2)', 'corbeille (3)'])), 'Corbeille (4)');
  });

  surChaqueDossier('seul le nom entier est réservé : un nom voisin reste, et le témoin perd son point de tête', (dossier) => {
    const intacts = ['corbeilles', 'ma corbeille', 'corbeille 2026', 'corbeille (2)', 'reglages_locaux', 'reglages_locaux.json.bak', 'gtt-temoin'];
    assert.ok(intacts.length > 0, 'aucun nom examiné');
    assert.deepEqual(intacts.map((nom) => derive(nom, dossier)), intacts);
    // La dérivation retire le point de tête : .gtt-temoin donne gtt-temoin,
    // qui n'est pas réservé.
    assert.equal(derive('.gtt-temoin', dossier), 'gtt-temoin');
  });
});

describe('deriverBase : ce que Windows refuse (§ 8.6)', () => {
  surChaqueDossier('«Gala»: 2026/11/14? donne «Gala» 20261114, ... donne evenement, Soirée. donne Soirée', (dossier) => {
    assert.equal(derive('«Gala»: 2026/11/14?', dossier), '«Gala» 20261114');
    assert.equal(derive('...', dossier), 'evenement');
    assert.equal(derive('Soirée.', dossier), 'Soirée');
  });

  surChaqueDossier('un nom en NFD et son NFC donnent la même base, en NFC', (dossier) => {
    const nfc = 'Soir\u00e9e';
    const nfd = 'Soire\u0301e';
    assert.notEqual(nfd, nfc);
    assert.equal(nfd.length, 7);
    assert.equal(derive(nfd, dossier), nfc);
    assert.equal(derive(nfc, dossier), nfc);
    assert.equal(derive(nfd, dossier).length, 6);
  });

  surChaqueDossier("la conversion en NFC précède le retrait : un « < » composé avec U+0338 n'est plus refusé", (dossier) => {
    assert.equal(derive('a<\u0338b', dossier), 'a\u226eb');
    assert.equal(derive('a>\u0338b', dossier), 'a\u226fb');
    assert.equal(derive('a=\u0338b', dossier), 'a\u2260b');
    // Sans U+0338, le caractère refusé part.
    assert.equal(derive('a<b', dossier), 'ab');
  });

  surChaqueDossier("la conversion en NFC revient après le retrait : un caractère refusé entre une lettre et sa marque combinante laisse une base en NFC, qui se dérive en elle-même", (dossier) => {
    // Le caractère refusé empêche la première NFC de composer. Une fois retiré,
    // la lettre et sa marque se touchent, et seule une seconde NFC les compose.
    const cas = [
      // « < » entre « a » et U+0301 : Gála.
      ['Ga<\u{301}la', 'G\u{e1}la'],
      // Deux marques, à remettre dans l'ordre canonique avant de composer.
      ['a\u{301}<\u{323}', '\u{1ea1}\u{301}'],
      ['e:\u{302}\u{301}', '\u{1ebf}'],
      // Les jamos d'un syllabe hangul : initiale, voyelle, finale.
      ['\u{1100}<\u{1161}', '\u{ac00}'],
      ['\u{1100}<\u{1161}<\u{11a8}', '\u{ac01}'],
    ];
    assert.ok(cas.length > 0, 'aucun cas examiné');
    const bases = cas.map(([nom]) => derive(nom, dossier));
    assert.deepEqual(bases.map(pointsDeCode), cas.map(([, attendu]) => pointsDeCode(attendu)));
    assert.deepEqual(bases.filter((base) => base !== base.normalize('NFC')).map(pointsDeCode), []);
    assert.deepEqual(bases.filter((base) => derive(base, dossier) !== base).map(pointsDeCode), []);
    // Chacun des caractères refusés agit de même entre « a » et U+0301.
    const refuses = ['<', '>', ':', '"', '/', '\\', '|', '?', '*'];
    assert.equal(refuses.length, 9);
    const ecarts = refuses
      .map((refuse) => [refuse, derive(`Ga${refuse}\u{301}la`, dossier)])
      .filter(([, base]) => base !== 'G\u{e1}la')
      .map(([refuse, base]) => `${refuse} donne ${pointsDeCode(base)}`);
    assert.deepEqual(ecarts, []);
  });

  surChaqueDossier('chaque caractère refusé, et chaque code de U+0000 à U+001F, est retiré, non remplacé', (dossier) => {
    const refuses = ['<', '>', ':', '"', '/', '\\', '|', '?', '*'];
    const controles = Array.from({ length: 32 }, (_, code) => String.fromCharCode(code));
    assert.equal(refuses.length, 9);
    assert.equal(controles.length, 32);
    const ecarts = [...refuses, ...controles]
      .map((caractere) => [caractere, derive(`Ga${caractere}la`, dossier)])
      .filter(([, base]) => base !== 'Gala')
      .map(([caractere, base]) => `U+${caractere.charCodeAt(0).toString(16).padStart(4, '0')} donne ${JSON.stringify(base)}`);
    assert.deepEqual(ecarts, []);
    // Une tabulation est un code refusé, non un blanc : retirée, elle ne sépare pas.
    assert.equal(derive('Ga\tla', dossier), 'Gala');
    // L'espace, qui n'est pas refusée, reste.
    assert.equal(derive('Ga la', dossier), 'Ga la');
  });

  surChaqueDossier('les blancs consécutifs se réduisent à une espace ; les espaces et points des deux bouts se retirent', (dossier) => {
    const cas = [
      ['Gala   du    soir', 'Gala du soir'],
      ['Gala\u00a0du\u202fsoir\u3000fin', 'Gala du soir fin'],
      ['  Gala  ', 'Gala'],
      ['Gala\u00a0\u00a0:', 'Gala'],
      ['Ga : la', 'Ga la'],
      ['. Gala .', 'Gala'],
      ['..Gala..', 'Gala'],
      ['Soirée. . ', 'Soirée'],
      ['Gala. ?', 'Gala'],
      ['v1.2 finale', 'v1.2 finale'],
      ['a . b', 'a . b'],
    ];
    assert.ok(cas.length > 0, 'aucun cas examiné');
    assert.deepEqual(
      cas.map(([nom]) => derive(nom, dossier)),
      cas.map(([, attendu]) => attendu),
    );
  });

  surChaqueDossier("de très longues suites d'espaces et de points se traitent d'une passe", (dossier) => {
    // Une suite au milieu du nom, aux deux bouts, ou le nom entier : la
    // dérivation rend sans attendre, là où un retrait par expression régulière
    // reprendrait la suite à chacune de ses positions.
    const points = '.'.repeat(200_000);
    assert.equal(derive(`a${points}b`, dossier), 'a');
    assert.equal(derive(`${points}a${points}`, dossier), 'a');
    assert.equal(derive(`a${' .'.repeat(100_000)}b`, dossier), 'a');
    assert.equal(derive(' .'.repeat(100_000), dossier), 'evenement');
  });

  surChaqueDossier('un nom dont il ne reste rien donne evenement : vide, blancs, points, caractères refusés', (dossier) => {
    const vides = ['', ' ', '.', '...', '. .', '. '.repeat(200), '<>:"/\\|?*', ' ? ', '\u0000', '\u00a0\u3000', '*.*'];
    assert.ok(vides.length > 0, 'aucun nom examiné');
    assert.deepEqual(vides.map((nom) => derive(nom, dossier)), vides.map(() => 'evenement'));
  });
});

describe('deriverBase : les collisions, sans égard à la casse (§ 8.6)', () => {
  surChaqueDossier('Gala avec gala donne Gala (2), avec gala et GALA (2) donne Gala (3)', (dossier) => {
    assert.equal(derive('Gala', dossier, ['gala']), 'Gala (2)');
    assert.equal(derive('Gala', dossier, ['gala', 'GALA (2)']), 'Gala (3)');
    assert.equal(derive('Gala', dossier, []), 'Gala');
  });

  surChaqueDossier("des noms qui donnent la même base prennent (2), (3)… dans l'ordre, au-delà de (9) compris", (dossier) => {
    const noms = ['Gala', 'gala', 'GALA', 'Gala.', ' Gala ', 'Gala?'];
    const existantes = [];
    for (const nom of noms) existantes.push(derive(nom, dossier, existantes));
    assert.deepEqual(existantes, ['Gala', 'gala (2)', 'GALA (3)', 'Gala (4)', 'Gala (5)', 'Gala (6)']);
    // Le douzième exemplaire porte un rang à deux chiffres.
    const pris = ['Gala', ...Array.from({ length: 10 }, (_, i) => `Gala (${i + 2})`)];
    assert.equal(pris.length, 11);
    assert.equal(derive('Gala', dossier, pris), 'Gala (12)');
    // Un rang libre au milieu se prend : (2) est libre, (3) est pris.
    assert.equal(derive('Gala', dossier, ['gala', 'gala (3)']), 'Gala (2)');
  });

  surChaqueDossier("la casse des lettres accentuées compte pour rien, et un nom en NFD heurte le même nom en NFC", (dossier) => {
    assert.equal(derive('\u00e9cole', dossier, ['\u00c9COLE']), '\u00e9cole (2)');
    assert.equal(derive('Soir\u00e9e', dossier, ['Soire\u0301e']), 'Soir\u00e9e (2)');
    assert.equal(derive('Soire\u0301e', dossier, ['SOIR\u00c9E']), 'Soir\u00e9e (2)');
  });

  surChaqueDossier("la casse se compare lettre à lettre, sans contexte : un sigma final et un sigma de milieu de mot désignent la même base", (dossier) => {
    // Windows compare deux noms par leur majuscule, un caractère après l'autre.
    // toLowerCase, lui, écrit « ς » le Σ qui finit un mot et « σ » les autres :
    // « ΣΑΣ2 » et « σασ2 » y auraient deux clés pour un seul fichier.
    const cas = [
      // ΣΑΣ2 contre σασ2, dans les deux sens, puis contre σας2.
      ['\u{3a3}\u{391}\u{3a3}2', ['\u{3c3}\u{3b1}\u{3c3}2'], '\u{3a3}\u{391}\u{3a3}2 (2)'],
      ['\u{3c3}\u{3b1}\u{3c3}2', ['\u{3a3}\u{391}\u{3a3}2'], '\u{3c3}\u{3b1}\u{3c3}2 (2)'],
      ['\u{3a3}\u{391}\u{3a3}2', ['\u{3c3}\u{3b1}\u{3c2}2'], '\u{3a3}\u{391}\u{3a3}2 (2)'],
      // Un Σ qui finit le nom : ΟΔΟΣ contre οδοσ.
      ['\u{39f}\u{394}\u{39f}\u{3a3}', ['\u{3bf}\u{3b4}\u{3bf}\u{3c3}'], '\u{39f}\u{394}\u{39f}\u{3a3} (2)'],
    ];
    assert.ok(cas.length > 0, 'aucun cas examiné');
    assert.deepEqual(
      cas.map(([nom, existantes]) => derive(nom, dossier, existantes)),
      cas.map(([, , attendu]) => attendu),
    );
  });

  surChaqueDossier("seule une base entière en heurte une autre, et un ensemble d'existantes vaut une liste", (dossier) => {
    const voisines = ['Gala du printemps', 'Gal', 'Gala (2)', 'un Gala', 'Gala2', 'evenement'];
    assert.equal(derive('Gala', dossier, voisines), 'Gala');
    assert.equal(derive('Gala', dossier, new Set(['gala'])), 'Gala (2)');
    assert.equal(derive('Gala', dossier, new Set()), 'Gala');
    // Deux noms sans rien d'utilisable donnent le nom générique, puis son rang 2.
    assert.equal(derive('???', dossier, ['evenement']), 'evenement (2)');
    assert.equal(derive('...', dossier, ['EVENEMENT', 'evenement (2)']), 'evenement (3)');
  });

  surChaqueDossier("la collision d'un nom réservé se joue sur la base protégée : con_ puis con_ (2)", (dossier) => {
    assert.equal(derive('con', dossier, ['CON_']), 'con_ (2)');
    assert.equal(derive('con', dossier, ['con']), 'con_');
  });
});

describe('deriverBase : la borne du chemin complet (§ 8.6, § 14.10)', () => {
  surChaqueDossier("un nom de 400 caractères se tronque : le plus long chemin écrit tient en 259 unités, dossier de l'événement, planche et écriture comprises", (dossier) => {
    const nom = lettres(400);
    const limite = longueurMaxDeBase(dossier);
    const base = derive(nom, dossier);
    const chemins = cheminsComplets(dossier, base);
    const plus = plusLong(chemins);
    assert.ok(plus.length <= LONGUEUR_CHEMIN_MAX, `le plus long chemin compte ${plus.length} unités : ${plus}`);
    // La plus longue base qui tient : la tête du nom, au chemin de 259 unités.
    assert.equal(base, nom.slice(0, limite));
    assert.equal(plus.length, LONGUEUR_CHEMIN_MAX);
    assert.ok(plus.endsWith(`${SUFFIXE_BADGES}.ecriture`));
    assert.ok(plus.includes(`${dossier.separateur}${base}${dossier.separateur}${base}.`));
    assert.deepEqual(chemins.filter((chemin) => chemin.length > 259), []);
    // Une base plus longue d'une unité déborde : la borne n'est pas trop large.
    assert.ok(plusLong(cheminsComplets(dossier, nom.slice(0, limite + 1))).length > 259);
  });

  surChaqueDossier("une borne sur un seul fichier, sur la base comptée une fois, sans la planche ou sans l'écriture atomique, laisserait déborder le plus long chemin ; la base dérivée reste en deçà", (dossier) => {
    // Chaque borne fautive, par le seul chemin relatif qu'elle retient.
    const bornes = [
      ['sur .gtt.json seul, à la racine', (b) => `${b}.gtt.json`],
      ['sur .gtt-journal.jsonl seul, dans le dossier', (b) => `${b}/${b}.gtt-journal.jsonl`],
      ['sur .gtt.json.precedent.ecriture, dans le dossier', (b) => `${b}/${b}.gtt.json.precedent.ecriture`],
      ['sur la planche, la base comptée une fois', (b) => `${b}/${SUFFIXE_BADGES}.ecriture`],
      ['sur la planche sans .ecriture', (b) => `${b}/${b}${SUFFIXE_BADGES}`],
      ['sur la liste en CSV la plus longue', (b) => `${b}/${b}.badges-9999_BROUILLON_2026-10-06_19-02-11.csv.ecriture`],
      ['sur la corbeille seule', (b) => `${CORBEILLE_RANG_99}/${b}${SUFFIXE_BADGES}.ecriture`],
      ['sur la corbeille et .gtt.json.precedent.ecriture', (b) => `${CORBEILLE_RANG_99}/${b}.gtt.json.precedent.ecriture`],
    ];
    assert.ok(bornes.length > 0, 'aucune borne examinée');
    const limite = longueurMaxDeBase(dossier);
    const racine = dossier.racine.length;
    const base = derive(lettres(400), dossier);
    for (const [libelle, relatif] of bornes) {
      // La plus longue base que cette borne laisserait.
      let fautive = 0;
      while (racine + 1 + relatif('a'.repeat(fautive + 1)).length <= 259) fautive += 1;
      assert.ok(fautive > limite, `${libelle} : ${fautive} unités, la bonne borne en laisse ${limite}`);
      assert.ok(
        plusLong(cheminsComplets(dossier, lettres(fautive))).length > 259,
        `${libelle} : le plus long chemin tiendrait`,
      );
      // Un module qui bornerait ainsi laisserait ces unités à la base.
      assert.ok(base.length < fautive, `${libelle} : la base dérivée compte ${base.length} unités`);
    }
  });

  surChaqueDossier("la coupe d'un nom à espaces garde la tête du nom, espaces et points finaux retirés", (dossier) => {
    const limite = longueurMaxDeBase(dossier);
    const phrase = 'Grande soirée des lanternes, rencontre annuelle du cercle des jardiniers. '.repeat(10);
    const base = derive(phrase, dossier);
    assert.equal(base, phrase.slice(0, limite).replace(/[ .]+$/, ''));
    assert.ok(plusLong(cheminsComplets(dossier, base)).length <= 259);
    // La coupe laisse un point et deux espaces en queue : ils partent.
    assert.equal(derive(`${'a'.repeat(limite - 3)} . ${'b'.repeat(40)}`, dossier), 'a'.repeat(limite - 3));
    assert.equal(derive(`${'a'.repeat(limite - 1)}.${'b'.repeat(40)}`, dossier), 'a'.repeat(limite - 1));
  });

  surChaqueDossier("un emoji en position de coupe n'est pas coupé en deux : il tient tout entier ou il est retiré", (dossier) => {
    const limite = longueurMaxDeBase(dossier);
    const emoji = '\u{1F600}';
    assert.equal(emoji.length, 2);
    // La paire chevauche la limite : une coupe naïve garderait sa moitié haute seule.
    const chevauche = `${'a'.repeat(limite - 1)}${emoji}${lettres(40)}`;
    assert.ok(estHaute(chevauche.charCodeAt(limite - 1)) && estBasse(chevauche.charCodeAt(limite)));
    assert.equal(derive(chevauche, dossier), 'a'.repeat(limite - 1));
    // La paire finit à la limite : elle tient.
    const finit = `${'a'.repeat(limite - 2)}${emoji}${lettres(40)}`;
    assert.equal(derive(finit, dossier), `${'a'.repeat(limite - 2)}${emoji}`);
    // Une suite d'emoji tient autant de paires entières que la borne en laisse.
    const base = derive(emoji.repeat(300), dossier);
    assert.equal(base, emoji.repeat(Math.floor(limite / 2)));
    assert.ok(plusLong(cheminsComplets(dossier, base)).length <= 259);
  });

  surChaqueDossier('une collision se règle dans la borne : la base se raccourcit du rang, les blancs de coupe partent', (dossier) => {
    const limite = longueurMaxDeBase(dossier);
    const nom = lettres(400);
    const base = derive(nom, dossier);
    const casse = base.toUpperCase();
    assert.notEqual(casse, base);
    const deux = derive(nom, dossier, [casse]);
    assert.equal(deux, `${nom.slice(0, limite - 4)} (2)`);
    assert.equal(deux.length, limite);
    const trois = derive(nom, dossier, [casse, deux]);
    assert.equal(trois, `${nom.slice(0, limite - 4)} (3)`);
    // Un rang à deux chiffres prend une unité de plus.
    const pris = [casse, ...Array.from({ length: 8 }, (_, i) => `${nom.slice(0, limite - 4)} (${i + 2})`)];
    assert.equal(derive(nom, dossier, pris), `${nom.slice(0, limite - 5)} (10)`);
    for (const resultat of [deux, trois]) {
      assert.ok(plusLong(cheminsComplets(dossier, resultat)).length <= 259);
    }
    // La coupe du rang tombe après une espace : elle part, puis le rang s'ajoute.
    const aEspace = `${'a'.repeat(limite - 5)} ${'b'.repeat(30)}`;
    const premier = derive(aEspace, dossier);
    assert.equal(premier, `${'a'.repeat(limite - 5)} bbbb`);
    assert.equal(derive(aEspace, dossier, [premier]), `${'a'.repeat(limite - 5)} (2)`);
  });

  test('une racine de 250 caractères ne laisse tenir aucune base : CHEMIN_TROP_LONG nomme la racine', () => {
    const dossier = dossierDeLongueur(250);
    assert.equal(dossier.racine.length, 250);
    refuseTropLong(() => derive('Gala', dossier), dossier.racine);
    refuseTropLong(() => derive('...', dossier), dossier.racine);
  });

  test("la racine la plus longue qui laisse une base compte 152 caractères, et lui laisse 13 unités ; à 153, le logo dans la corbeille dépasse seul la borne, et aucune base ne tient", () => {
    const auPlus = dossierDeLongueur(152);
    const auDela = dossierDeLongueur(153);
    assert.equal(longueurMaxDeBase(auPlus), 13);
    assert.equal(longueurMaxDeBase(auDela), 0);
    assert.equal(derive('Gala', auPlus), 'Gala');
    assert.equal(derive('\u{1F600}Gala', auPlus), '\u{1F600}Gala');
    assert.equal(derive(lettres(400), auPlus), lettres(13));
    assert.equal(plusLong(cheminsComplets(auPlus, lettres(13))).length, 259);
    // La base d'une seule unité, sous 153 caractères, déborde par le logo.
    const logoEnCorbeille = `${CORBEILLE_RANG_99}/${LOGO}`.replaceAll('/', '\\');
    assert.equal(plusLong(cheminsComplets(auDela, 'G')), `${auDela.racine}\\${logoEnCorbeille}`);
    assert.equal(plusLong(cheminsComplets(auDela, 'G')).length, 260);
    for (const nom of ['Gala', 'G', '\u{1F600}Gala', '...']) refuseTropLong(() => derive(nom, auDela), auDela.racine);
    refuseTropLong(() => derive('Gala', dossierDeLongueur(164)), dossierDeLongueur(164).racine);
  });

  test("à la racine la plus longue, le rang d'une collision se loge dans les 13 unités : la base se raccourcit de son rang", () => {
    const treize = dossierDeLongueur(152);
    assert.equal(longueurMaxDeBase(treize), 13);
    assert.equal(derive('Gala', treize, ['gala']), 'Gala (2)');
    const nom = lettres(400);
    assert.equal(derive(nom, treize, [lettres(13)]), `${lettres(9)} (2)`);
    const pris = [lettres(13), ...Array.from({ length: 8 }, (_, i) => `${lettres(9)} (${i + 2})`)];
    assert.equal(derive(nom, treize, pris), `${lettres(8)} (10)`);
    for (const base of [derive(nom, treize, pris), derive('Gala', treize, ['gala'])]) {
      assert.ok(plusLong(cheminsComplets(treize, base)).length <= 259, base);
    }
  });

  test('la coupe ne laisse jamais un nom réservé : la tête de 13 unités qui en tombe sur un reçoit « _ », et recule quand « _ » ne tient plus', () => {
    const treize = dossierDeLongueur(152);
    assert.equal(longueurMaxDeBase(treize), 13);
    const cas = [
      // Les points et les espaces de la coupe partent : il reste un nom réservé.
      [`con${'.'.repeat(10)}sole`, 'con_'],
      [`Aux${' .'.repeat(5)}x`, 'Aux_'],
      // Le « _ » porterait la tête à 14 unités : elle recule d'une.
      [`con.${lettres(20)}`, `con_.${lettres(8)}`],
      [`conout$.${lettres(20)}`, `conout$_.${lettres(4)}`],
    ];
    assert.ok(cas.length > 0, 'aucun nom examiné');
    assert.deepEqual(
      cas.map(([nom]) => derive(nom, treize)),
      cas.map(([, attendu]) => attendu),
    );
    assert.equal(derive(`con${'.'.repeat(10)}sole`, treize, ['CON_']), 'con_ (2)');
    for (const [nom] of cas) {
      const base = derive(nom, treize);
      assert.ok(!estReserve(base), `${nom} donne ${base}`);
      assert.ok(base.length <= 13, `${nom} donne ${base}`);
      assert.ok(plusLong(cheminsComplets(treize, base)).length <= 259);
    }
  });

  test('la racine se compte en unités UTF-16 comme la base : un emoji y pèse deux unités', () => {
    const dossier = { racine: `C:\\${'\u{1F600}'.repeat(50)}`, separateur: '\\' };
    assert.equal(dossier.racine.length, 3 + 2 * 50);
    assert.equal(Array.from(dossier.racine).length, 3 + 50);
    const limite = longueurMaxDeBase(dossier);
    assert.equal(limite, (259 - 103 - 1 - 61) / 2);
    const base = derive(lettres(400), dossier);
    assert.equal(base, lettres(limite));
    assert.equal(plusLong(cheminsComplets(dossier, base)).length, 259);
  });

  test("une racine qui finit par le séparateur ne compte pas un séparateur de plus", () => {
    const nom = lettres(400);
    const cas = [
      { racine: 'E:\\soirees\\data\\', separateur: '\\' },
      { racine: 'E:\\', separateur: '\\' },
      { racine: '/home/exemple/soirees/', separateur: '/' },
      { racine: '/home/exemple/soirees', separateur: '/' },
      { racine: '/', separateur: '/' },
    ];
    assert.ok(cas.length > 0, 'aucun dossier examiné');
    for (const dossier of cas) {
      const limite = longueurMaxDeBase(dossier);
      const base = derive(nom, dossier);
      assert.equal(base, nom.slice(0, limite), dossier.racine);
      // La base compte deux fois : le plus long chemin remplit 259 unités, ou
      // 258 quand une unité de plus en demanderait deux.
      assert.ok(plusLong(cheminsComplets(dossier, base)).length >= 258, dossier.racine);
      assert.ok(plusLong(cheminsComplets(dossier, base)).length <= 259, dossier.racine);
    }
    // Avec ou sans le séparateur final, le même dossier donne la même base.
    assert.equal(derive(nom, cas[0]), derive(nom, DOSSIERS[1]));
    assert.equal(derive(nom, cas[2]), derive(nom, cas[3]));
    // Les valeurs : E:\ laisse 97 unités à la base, « / » 98.
    assert.deepEqual([cas[1], cas[4]].map(longueurMaxDeBase), [97, 98]);
  });
});

// Noms que la dérivation doit traverser sans rien rompre : vides, réservés,
// noms des entrées de la racine, refusés, en NFD, à emoji, trop longs, à
// caractères de contrôle, de format ou ignorables par défaut, à demi-paires
// isolées, à marque combinante que sépare un caractère refusé, à sigma
// majuscule, médian ou final. Les longueurs de 66 à 69 et de 89 à 91
// encadrent la borne des deux dossiers de travail, 68 et 91.
const NOMS_HOSTILES = [
  '', ' ', '.', '...', '. . .', '<>:"/\\|?*', '\u0000\u001f', '\u00a0', '*.*',
  'con', 'CON', 'Con.txt', 'nul.', 'aux .x', 'COM1', 'lpt9.log', 'CONIN$', 'conout$.x', 'COM\u00b9', 'console',
  'c:o:n', ' con ', 'PRN . . ',
  'corbeille', 'CORBEILLE', ' Corbeille.', 'reglages_locaux.json', 'REGLAGES_LOCAUX.JSON', '.gtt-temoin',
  '«Gala»: 2026/11/14?', 'Soirée.', 'Soire\u0301e', '  Gala   du   soir  ', 'Gala\u00a0du\u202fsoir',
  '\u{1F600}', '\u{1F600}'.repeat(300), `${'a'.repeat(66)}\u{1F600}${'b'.repeat(50)}`,
  `${'a'.repeat(67)}\u{1F600}${'b'.repeat(50)}`, `${'a'.repeat(90)}\u{1F600}${'b'.repeat(50)}`,
  `${'a'.repeat(89)}\u{1F600}${'b'.repeat(50)}`,
  lettres(400), '\u00e9'.repeat(400), 'e\u0301'.repeat(200), '. '.repeat(250), `con.${lettres(400)}`,
  `${'a'.repeat(66)} ${'b'.repeat(60)}`, `${'a'.repeat(67)}.${'b'.repeat(60)}`, 'x'.repeat(68), 'x'.repeat(69),
  'x'.repeat(91), 'x'.repeat(92),
  '\u200b', '\u200b'.repeat(300), '\u200eGala\u200e', 'Gala\u200b', 'Ga\ufeffla', 'Ga\u00adla', 'Gala\u202eslx.exe',
  'C\u200bON', 'Soire\u200b\u0301e', '\ud800', 'Ga\udc00la', '\ude00\ud83d', 'Ga\ud83d<\ude00la',
  `${'a'.repeat(67)}\u200b${'b'.repeat(50)}`,
  // Un contrôle de C1, un remplisseur hangul et un sélecteur de variante, seuls ou dans un nom.
  '\u{85}', '\u{3164}', '\u{fe0f}', 'Ga\u{3164}la', 'C\u{3164}ON', `${'a'.repeat(67)}\u{3164}${'b'.repeat(50)}`,
  // Une lettre et sa marque combinante, qu'un caractère refusé sépare : retiré, il les laisse se composer.
  'Ga<\u{301}la', 'a\u{301}<\u{323}', 'e:\u{302}\u{301}', '\u{1100}<\u{1161}<\u{11a8}',
  // Un sigma majuscule, médian et final : trois écritures d'un même nom.
  '\u{3a3}\u{391}\u{3a3}2', '\u{3c3}\u{3b1}\u{3c3}2', '\u{3c3}\u{3b1}\u{3c2}2',
];

// Les invariants d'une base dérivée : invariantsRompus rend, en une ligne
// chacun, ceux que la base viole.
const INTERDIT = /[<>:"/\\|?*\u0000-\u001f]/;
const BORD = /^[ .]|[ .]$/;
const SUBSTITUTION_ISOLEE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
function invariantsRompus(base, dossier) {
  const rompus = [];
  if (base.length === 0) rompus.push('base vide');
  if (base !== base.normalize('NFC')) rompus.push('base hors NFC');
  if (INTERDIT.test(base)) rompus.push('caractère refusé');
  if (INVISIBLE.test(base)) rompus.push('caractère invisible');
  if (BORD.test(base)) rompus.push('espace ou point de bord');
  if (estReserve(base)) rompus.push('nom réservé');
  if (ENTREES_RACINE.some((entree) => cle(entree) === cle(base))) rompus.push("nom d'une entrée de la racine");
  if (SUBSTITUTION_ISOLEE.test(base)) rompus.push('paire de substitution coupée');
  const longueur = plusLong(cheminsComplets(dossier, base)).length;
  if (longueur > 259) rompus.push(`chemin de ${longueur} unités`);
  return rompus;
}

describe('deriverBase : les invariants de toute base', () => {
  // Non vide, en NFC, sans caractère refusé ni de format ni bord, jamais
  // réservée, sans paire de substitution coupée, le plus long chemin dans la
  // borne ; et stable : une base dérivée redonne la même.
  surChaqueDossier('chaque nom hostile donne une base valide, qui se dérive en elle-même', (dossier) => {
    assert.ok(NOMS_HOSTILES.length >= 40, `${NOMS_HOSTILES.length} noms examinés`);
    const ecarts = NOMS_HOSTILES.flatMap((nom, rang) => {
      const base = derive(nom, dossier);
      const rompus = invariantsRompus(base, dossier);
      if (derive(base, dossier) !== base) rompus.push('base non stable');
      return rompus.map((rompu) => `nom ${rang} : ${rompu}`);
    });
    assert.deepEqual(ecarts, []);
  });

  surChaqueDossier('des noms hostiles dérivés à la suite donnent des bases deux à deux distinctes, sans égard à la casse', (dossier) => {
    const existantes = [];
    const ecarts = [];
    for (const [rang, nom] of NOMS_HOSTILES.entries()) {
      const base = derive(nom, dossier, existantes);
      if (existantes.some((autre) => cle(autre) === cle(base))) ecarts.push(`nom ${rang} : ${base} déjà pris`);
      for (const rompu of invariantsRompus(base, dossier)) ecarts.push(`nom ${rang} : ${rompu}`);
      existantes.push(base);
    }
    assert.equal(existantes.length, NOMS_HOSTILES.length);
    assert.equal(new Set(existantes.map(cle)).size, NOMS_HOSTILES.length);
    assert.deepEqual(ecarts, []);
  });
});

describe("dossierEvenement : le dossier d'un événement (§ 8.6)", () => {
  surChaqueDossier('le dossier est la base elle-même, telle que deriverBase la rend, nom hostile compris', (dossier) => {
    const noms = ['Gala', 'Soir\u{E9}e des Lucioles', 'con', 'corbeille', lettres(400), ...NOMS_HOSTILES];
    assert.ok(noms.length > 40, `${noms.length} noms examinés`);
    const ecarts = noms
      .map((nom) => derive(nom, dossier))
      .filter((base) => dossierEvenement(base) !== base)
      .map((base) => visible(base));
    assert.deepEqual(ecarts, []);
  });

  test("une base vide ou d'un autre type, un caractère interdit, « . » ou « .. », un point ou une espace final, un périphérique, ou le nom d'une entrée de la racine, quelle que soit sa casse : TypeError", () => {
    const refusees = [
      ...['', null, undefined, 42, 'a/b', 'a\\b', '/', '.', '..', 'a:b', 'a*b'],
      ...['corbeille', 'CORBEILLE', 'corbeille.', 'Corbeille ', 'reglages_locaux.json.', 'Reglages_Locaux.json'],
      ...['.gtt-temoin', '.GTT-TEMOIN', 'con', 'NUL', 'com1.soir\u{E9}e', 'Gala.', 'Gala '],
    ];
    assert.ok(refusees.length > 0, 'aucune base examinée');
    for (const base of refusees) assert.throws(() => dossierEvenement(base), TypeError, String(base));
    // Un nom voisin passe.
    assert.equal(dossierEvenement('corbeille (2)'), 'corbeille (2)');
    assert.equal(dossierEvenement('...a'), '...a');
  });
});

describe("cleEvenement, decouperCle : l'identité d'un événement du dossier de travail (§ 8.1, § 8.6)", () => {
  test('la clé joint le dossier et la base par « / », et se découpe en eux, le dossier pouvant ne pas être la base', () => {
    assert.equal(cleEvenement('Gala', 'Gala'), 'Gala/Gala');
    assert.equal(cleEvenement('Gala - Copie', 'Gala'), 'Gala - Copie/Gala');
    for (const [dossier, base] of [
      ['Gala', 'Gala'],
      ['Gala - Copie', 'Gala'],
      ['Soir\u{E9}e', 'Soir\u{E9}e (2)'],
      ['corbeille (2)', 'corbeille (2)'],
    ]) {
      assert.deepEqual(decouperCle(cleEvenement(dossier, base)), { dossier, base });
    }
  });

  test("une clé sans dossier — un fichier à plat —, à plus de deux segments, au segment vide, « . » ou « .. », d'un autre type, ou dans la corbeille, quelle que soit sa casse : CHEMIN_REFUSE {chemin}", () => {
    const refusees = ['Gala', '', '/Gala', 'Gala/', 'a/b/c', './Gala', '../Gala', 'Gala/..', 'corbeille/Gala', 'Corbeille/x', null, 3];
    for (const cle of refusees) {
      let erreur = null;
      try {
        decouperCle(cle);
      } catch (levee) {
        erreur = levee;
      }
      assert.ok(erreur instanceof ErreurStockage, String(cle));
      assert.deepEqual([erreur.code, erreur.details], ['CHEMIN_REFUSE', { chemin: cle }], String(cle));
    }
    assert.throws(() => cleEvenement('a/b', 'c'), TypeError);
    assert.throws(() => cleEvenement('a', ''), TypeError);
  });
});

describe('dossierCorbeille (§ 8.7)', () => {
  test("un horodatage donne corbeille/AAAA-MM-JJ_HH-MM-SS : la date et l'heure telles qu'écrites, sans le décalage", () => {
    assert.equal(dossierCorbeille('2026-10-06T19:02:11-04:00', []), 'corbeille/2026-10-06_19-02-11');
    assert.equal(dossierCorbeille('2026-10-06T19:02:11+05:30', []), 'corbeille/2026-10-06_19-02-11');
    assert.equal(dossierCorbeille('2026-12-31T23:59:59-05:00', []), 'corbeille/2026-12-31_23-59-59');
    assert.equal(dossierCorbeille('2027-01-01T00:00:00+00:00', []), 'corbeille/2027-01-01_00-00-00');
  });

  test('un nom déjà présent, seul ou avec le préfixe corbeille/, ajoute le rang 2 ; le premier rang libre est pris', () => {
    const horodatage = '2026-10-06T19:02:11-04:00';
    const nom = '2026-10-06_19-02-11';
    assert.equal(dossierCorbeille(horodatage, [nom]), `corbeille/${nom}_2`);
    assert.equal(dossierCorbeille(horodatage, [`corbeille/${nom}`]), `corbeille/${nom}_2`);
    assert.equal(dossierCorbeille(horodatage, [nom, `${nom}_2`]), `corbeille/${nom}_3`);
    assert.equal(dossierCorbeille(horodatage, [`corbeille/${nom}`, `corbeille/${nom}_2`]), `corbeille/${nom}_3`);
    // Un trou se comble : le rang 2 est libre quand seuls le premier et le 3 sont pris.
    assert.equal(dossierCorbeille(horodatage, [nom, `${nom}_3`]), `corbeille/${nom}_2`);
    // Le rang 10 : un nom et ses rangs 2 à 9.
    const pris = [nom, ...Array.from({ length: 8 }, (_, i) => `${nom}_${i + 2}`)];
    assert.equal(dossierCorbeille(horodatage, pris), `corbeille/${nom}_10`);
  });

  test('le nom et ses rangs 2 à 99 pris, CORBEILLE_SATUREE nomme le dossier daté : le rang 100 dépasserait la borne', () => {
    const horodatage = '2026-10-06T19:02:11-04:00';
    const nom = '2026-10-06_19-02-11';
    const rangs = [nom, ...Array.from({ length: 98 }, (_, i) => `${nom}_${i + 2}`)];
    assert.equal(rangs.length, 99);
    assert.equal(rangs.at(-1), `${nom}_99`);
    for (const existants of [rangs, rangs.map((entree) => `corbeille/${entree}`)]) {
      const erreur = erreurDe(() => dossierCorbeille(horodatage, existants));
      assert.ok(erreur instanceof ErreurStockage, `${erreur?.name} au lieu d'une ErreurStockage`);
      assert.equal(erreur.code, 'CORBEILLE_SATUREE');
      assert.deepEqual(erreur.details, { dossier: `corbeille/${nom}` });
    }
    // Seuls les rangs de cet instant comptent : le rang 99 libre se prend, quel
    // que soit le nombre d'entrées d'autres instants.
    const autres = Array.from({ length: 5 }, (_, i) => `2026-10-06_19-02-1${i + 2}`);
    assert.equal(dossierCorbeille(horodatage, [...rangs.slice(0, 98), ...autres]), `corbeille/${nom}_99`);
    // Un rang libre plus bas se prend, même quand le rang 99 est pris.
    assert.equal(dossierCorbeille(horodatage, rangs.filter((entree) => entree !== `${nom}_50`)), `corbeille/${nom}_50`);
  });

  test("les entrées d'un autre instant, ou d'une autre forme, ne heurtent rien ; une liste figée n'est pas modifiée", () => {
    const horodatage = '2026-10-06T19:02:11-04:00';
    const voisines = Object.freeze([
      '2026-10-06_19-02-12', '2026-10-06_19-02-10', '2026-10-07_19-02-11', '2026-10-06_19-02-11_x',
      '2026-10-06_19-02-11 (2)', 'autre', 'corbeille', '',
    ]);
    assert.equal(dossierCorbeille(horodatage, voisines), 'corbeille/2026-10-06_19-02-11');
    assert.equal(dossierCorbeille(horodatage, new Set(['2026-10-06_19-02-11'])), 'corbeille/2026-10-06_19-02-11_2');
    assert.equal(voisines.length, 8);
  });

  test("un horodatage d'une autre forme que AAAA-MM-JJTHH:MM:SS±HH:MM lève TypeError : le chemin n'en porte que des chiffres", () => {
    const refuses = [
      '', '2026-10-06', '2026-10-06 19:02:11-04:00', '2026-10-06T19:02:11', '2026-10-06T19:02:11Z',
      '2026-10-06T19:02:11-04:00 ', '2026-10-06T19:02:11-04:00\n', ' 2026-10-06T19:02:11-04:00',
      '2026-10-06T19:02:11-04:00/../..', '../../2026-10-06T19:02:11-04:00', '2026-10-06T19:02:11.5-04:00',
      '26-10-06T19:02:11-04:00', '2026-10-06T19-02-11-04:00', '2026-10-06T19:02:11-0400', '20261006T190211-0400',
      '\u0662026-10-06T19:02:11-04:00',
    ];
    assert.ok(refuses.length > 0, 'aucun horodatage examiné');
    const ecarts = refuses
      .map((horodatage) => [horodatage, erreurDe(() => dossierCorbeille(horodatage, []))])
      .filter(([, erreur]) => !(erreur instanceof TypeError))
      .map(([horodatage, erreur]) => `${JSON.stringify(horodatage)} : ${erreur?.name}`);
    assert.deepEqual(ecarts, []);
    for (const horodatage of [undefined, null, 20261006, ['2026-10-06T19:02:11-04:00']]) {
      assert.ok(erreurDe(() => dossierCorbeille(horodatage, [])) instanceof TypeError);
    }
  });
});

// Exécute fonction pendant que l'horloge, les sources d'aléa et les
// comparaisons localisées lèvent à leur lecture, puis les rétablit telles
// qu'elles étaient, propres ou héritées ; rend ce que rend fonction.
function sansSourcesVariables(fonction) {
  const interdite = (nom) => () => {
    throw new Error(`${nom} lu`);
  };
  const remplacees = [
    [Math, 'random'],
    [Date, 'now'],
    [performance, 'now'],
    [crypto, 'getRandomValues'],
    [crypto, 'randomUUID'],
    [String.prototype, 'localeCompare'],
    [String.prototype, 'toLocaleLowerCase'],
    [String.prototype, 'toLocaleUpperCase'],
  ].map(([objet, nom]) => ({ objet, nom, propre: Object.hasOwn(objet, nom), valeur: objet[nom] }));
  const DateReelle = globalThis.Date;
  for (const { objet, nom } of remplacees) objet[nom] = interdite(nom);
  function DateInterdite() {
    throw new Error('Date lu');
  }
  DateInterdite.now = interdite('Date.now');
  globalThis.Date = DateInterdite;
  try {
    return fonction();
  } finally {
    globalThis.Date = DateReelle;
    for (const { objet, nom, propre, valeur } of remplacees) {
      if (propre) objet[nom] = valeur;
      else delete objet[nom];
    }
  }
}

describe('déterminisme et pureté (§ 14.7)', () => {
  test('longueurRelativeMax, deriverBase, dossierCorbeille et nomPlanche ne lisent ni horloge, ni aléa, ni comparaison localisée', () => {
    // Le filet est éprouvé d'abord : chaque source lève pendant qu'il est tendu.
    for (const lecture of [
      () => Math.random(),
      () => Date.now(),
      () => new Date(),
      () => performance.now(),
      () => crypto.getRandomValues(new Uint8Array(1)),
      () => crypto.randomUUID(),
      () => 'a'.localeCompare('b'),
      () => 'A'.toLocaleLowerCase(),
      () => 'a'.toLocaleUpperCase(),
    ]) {
      assert.throws(() => sansSourcesVariables(lecture), / lu$/);
    }
    assert.equal(typeof Date.now(), 'number');
    assert.equal('A'.toLocaleLowerCase(), 'a');
    const rendre = () => [
      longueurRelativeMax('Gala'),
      derive('Gala', DOSSIERS[0], ['gala', 'GALA (2)']),
      derive(lettres(400), DOSSIERS[1], []),
      derive('Con.soirée', DOSSIERS[0], ['con_.soirée']),
      dossierCorbeille('2026-10-06T19:02:11-04:00', ['2026-10-06_19-02-11']),
      nomPlanche('Gala', { papier: 'A4', imposition: 'pile', horodatage: '2026-10-06T19:02:11-04:00', reedition: { ids: [4, 9] } }),
      nomPlanche('Gala', { papier: 'A4', imposition: 'feuille', horodatage: null, reedition: null }),
      nomPlanche('Gala', {
        papier: 'A4',
        imposition: 'pile',
        horodatage: '2026-10-06T19:02:11-04:00',
        reedition: { ids: [4] },
        proposition: 2,
        ordre: 'table',
        dossier: { ...DOSSIERS[0], existants: ['gala.BADGES-p2-1_A4_pile_table_2026-10-06_19-02-11.pdf'] },
      }),
    ];
    assert.deepEqual(sansSourcesVariables(rendre), rendre());
  });

  test("les arguments ne sont pas modifiés : un contexte et une liste figés passent, et le résultat se répète", () => {
    const existantes = Object.freeze(['gala', 'GALA (2)']);
    const dossier = Object.freeze({ racine: DOSSIERS[0].racine, separateur: '\\', existantes });
    const premier = deriverBase('Gala', dossier);
    assert.equal(premier, 'Gala (3)');
    assert.equal(deriverBase('Gala', dossier), premier);
    assert.deepEqual([...existantes], ['gala', 'GALA (2)']);
  });
});

describe('nomPlanche : le nom du fichier de la planche (§ 11.6, § 8.6)', () => {
  const BASE = 'Soir\u{E9}e des Lucioles';
  const HORODATAGE = '2031-05-17T20:15:07-04:00';
  // Une réédition de k badges, sous la forme du modèle de la planche.
  const reeditionDe = (k) => ({ ids: Array.from({ length: k }, (_, i) => i + 1) });

  test('les quatre combinaisons papier × imposition : la base, « .badges », le papier, l’imposition, la date et l’heure du placement sans décalage, puis « .pdf »', () => {
    const cas = [
      ['A4', 'feuille', `${BASE}.badges_A4_feuille_2031-05-17_20-15-07.pdf`],
      ['A4', 'pile', `${BASE}.badges_A4_pile_2031-05-17_20-15-07.pdf`],
      ['Lettre', 'feuille', `${BASE}.badges_Lettre_feuille_2031-05-17_20-15-07.pdf`],
      ['Lettre', 'pile', `${BASE}.badges_Lettre_pile_2031-05-17_20-15-07.pdf`],
    ];
    assert.deepEqual(cas.map(([papier]) => papier).filter((p, i, t) => t.indexOf(p) === i), Object.keys(PAPIERS));
    for (const [papier, imposition, attendu] of cas) {
      assert.equal(nomPlanche(BASE, { papier, imposition, horodatage: HORODATAGE, reedition: null }), attendu);
    }
  });

  test('une réédition de k badges porte « -<k> » après « .badges » ; sans réédition, rien', () => {
    const nom = (reedition) => nomPlanche(BASE, { papier: 'A4', imposition: 'feuille', horodatage: HORODATAGE, reedition });
    assert.equal(nom({ ids: [3, 8, 12] }), `${BASE}.badges-3_A4_feuille_2031-05-17_20-15-07.pdf`);
    assert.equal(nom(reeditionDe(1)), `${BASE}.badges-1_A4_feuille_2031-05-17_20-15-07.pdf`);
    assert.equal(nom(reeditionDe(9999)), `${BASE}.badges-9999_A4_feuille_2031-05-17_20-15-07.pdf`);
    assert.equal(nom(null), `${BASE}.badges_A4_feuille_2031-05-17_20-15-07.pdf`);
    assert.equal(nom(undefined), `${BASE}.badges_A4_feuille_2031-05-17_20-15-07.pdf`);
  });

  test('un horodatage inconnu donne « _horodatage-inconnu » ; un décalage, quel qu’il soit, ne change pas le nom ; aucun « : »', () => {
    assert.equal(
      nomPlanche(BASE, { papier: 'Lettre', imposition: 'pile', horodatage: null, reedition: null }),
      `${BASE}.badges_Lettre_pile_horodatage-inconnu.pdf`,
    );
    for (const horodatage of ['2031-05-17T20:15:07+05:30', '2031-05-17T20:15:07+00:00', HORODATAGE]) {
      const nom = nomPlanche(BASE, { papier: 'A4', imposition: 'feuille', horodatage, reedition: reeditionDe(2) });
      assert.equal(nom, `${BASE}.badges-2_A4_feuille_2031-05-17_20-15-07.pdf`, horodatage);
      assert.ok(!nom.includes(':'), nom);
    }
  });

  test('même placement, même papier, même imposition : même nom ; un autre placement, un autre nom', () => {
    const options = { papier: 'A4', imposition: 'feuille', horodatage: HORODATAGE, reedition: null };
    assert.equal(nomPlanche(BASE, options), nomPlanche(BASE, { ...options }));
    assert.notEqual(nomPlanche(BASE, options), nomPlanche(BASE, { ...options, horodatage: '2031-05-17T20:15:08-04:00' }));
  });

  test('le plus long suffixe, 51 unités, avec le séparateur et le suffixe d’écriture, fait la partie fixe de longueurRelativeMax : la planche d’une base à la borne tient à la racine, et remplit 259 unités dans le dossier de l’événement', () => {
    const suffixes = [];
    for (const papier of Object.keys(PAPIERS)) {
      for (const imposition of ['feuille', 'pile']) {
        for (const horodatage of [HORODATAGE, null]) {
          for (const reedition of [null, reeditionDe(9), reeditionDe(9999)]) {
            suffixes.push(nomPlanche('b', { papier, imposition, horodatage, reedition }).slice(1));
          }
        }
      }
    }
    assert.equal(suffixes.length, 24);
    const plusLong = suffixes.reduce((a, b) => (b.length > a.length ? b : a));
    assert.equal(plusLong, '.badges-9999_Lettre_feuille_2031-05-17_20-15-07.pdf');
    assert.equal(plusLong.length, 51);
    assert.equal(longueurRelativeMax('b'.repeat(100)) - 2 * 100, 1 + plusLong.length + SUFFIXE_ECRITURE.length);
    // Recomposé en entier sur une base que deriverBase pousse à la borne : à
    // la racine du dossier de travail, et dans le dossier de l'événement,
    // qui porte le nom de sa base.
    for (const dossier of DOSSIERS) {
      const base = deriverBase(lettres(400), { ...dossier, existantes: [] });
      assert.equal(base.length, longueurMaxDeBase(dossier));
      const nom = nomPlanche(base, { papier: 'Lettre', imposition: 'feuille', horodatage: HORODATAGE, reedition: reeditionDe(9999) });
      const aLaRacine = `${dossier.racine}${dossier.separateur}${nom}.ecriture`;
      assert.ok(aLaRacine.length <= LONGUEUR_CHEMIN_MAX, `${dossier.racine} : ${aLaRacine.length} unités`);
      const dansLeDossier = `${dossier.racine}${dossier.separateur}${base}${dossier.separateur}${nom}.ecriture`;
      assert.equal(dansLeDossier.length, LONGUEUR_CHEMIN_MAX, dossier.racine);
    }
  });

  test('une proposition porte « -p<id> » après « .badges », avant le compte d’une réédition ; le retenu, rien : son nom ne change pas', () => {
    const nom = (options) => nomPlanche(BASE, { papier: 'A4', imposition: 'feuille', horodatage: HORODATAGE, reedition: null, ...options });
    assert.equal(nom({ proposition: 2 }), `${BASE}.badges-p2_A4_feuille_2031-05-17_20-15-07.pdf`);
    assert.equal(nom({ proposition: 2 ** 31 - 1 }), `${BASE}.badges-p2147483647_A4_feuille_2031-05-17_20-15-07.pdf`);
    assert.equal(nom({ proposition: 2, reedition: { ids: [3, 8, 12] } }), `${BASE}.badges-p2-3_A4_feuille_2031-05-17_20-15-07.pdf`);
    assert.equal(nom({ proposition: null }), `${BASE}.badges_A4_feuille_2031-05-17_20-15-07.pdf`);
    assert.equal(nom({}), `${BASE}.badges_A4_feuille_2031-05-17_20-15-07.pdf`);
  });

  test('deux propositions de la même génération, donc du même horodatage : deux noms ; le retenu au même horodatage, un troisième', () => {
    const nom = (proposition) => nomPlanche(BASE, { papier: 'Lettre', imposition: 'pile', horodatage: HORODATAGE, reedition: null, proposition });
    const noms = [nom(1), nom(2), nom(null)];
    assert.equal(new Set(noms).size, 3, noms.join(' | '));
    // Sans horodatage, les trois se distinguent encore.
    const inconnus = [1, 2, null].map((proposition) => nomPlanche(BASE, { papier: 'A4', imposition: 'feuille', horodatage: null, proposition }));
    assert.equal(new Set(inconnus).size, 3, inconnus.join(' | '));
  });

  test('l’ordre par table porte « _table » après l’imposition ; l’ordre alphabétique, rien', () => {
    const nom = (ordre) => nomPlanche(BASE, { papier: 'A4', imposition: 'pile', horodatage: HORODATAGE, reedition: null, ordre });
    assert.equal(nom('table'), `${BASE}.badges_A4_pile_table_2031-05-17_20-15-07.pdf`);
    assert.equal(nom('alphabetique'), `${BASE}.badges_A4_pile_2031-05-17_20-15-07.pdf`);
    assert.equal(nom(undefined), `${BASE}.badges_A4_pile_2031-05-17_20-15-07.pdf`);
    assert.equal(
      nomPlanche(BASE, { papier: 'Lettre', imposition: 'feuille', horodatage: null, reedition: reeditionDe(2), proposition: 4, ordre: 'table' }),
      `${BASE}.badges-p4-2_Lettre_feuille_table_horodatage-inconnu.pdf`,
    );
  });

  test('une réédition ne remplace jamais un fichier du dossier : le premier rang libre, « _2 », « _3 »…, comparé sans égard à la casse ; une planche entière garde son nom', () => {
    const dossier = (existants) => ({ ...DOSSIERS[0], existants });
    const options = { papier: 'A4', imposition: 'feuille', horodatage: HORODATAGE, reedition: reeditionDe(3) };
    const libre = `${BASE}.badges-3_A4_feuille_2031-05-17_20-15-07.pdf`;
    const rang = (n) => libre.replace(/\.pdf$/, `_${n}.pdf`);
    assert.equal(nomPlanche(BASE, { ...options, dossier: dossier([]) }), libre);
    assert.equal(nomPlanche(BASE, { ...options, dossier: dossier([`${BASE}.gtt.json`, 'corbeille']) }), libre);
    assert.equal(nomPlanche(BASE, { ...options, dossier: dossier([libre]) }), rang(2));
    assert.equal(nomPlanche(BASE, { ...options, dossier: dossier([rang(2), libre]) }), rang(3));
    assert.equal(nomPlanche(BASE, { ...options, dossier: dossier([libre.toUpperCase()]) }), rang(2));
    // Un rang pris ne compte pas tant que le nom sans rang est libre.
    assert.equal(nomPlanche(BASE, { ...options, dossier: dossier([rang(2)]) }), libre);
    // Une liste figée passe, et n'est pas modifiée.
    const figee = Object.freeze([libre]);
    assert.equal(nomPlanche(BASE, { ...options, dossier: { ...DOSSIERS[0], existants: figee } }), rang(2));
    assert.deepEqual([...figee], [libre]);
    // La planche entière du même placement reprend son nom : même placement, même planche.
    const entiere = `${BASE}.badges_A4_feuille_2031-05-17_20-15-07.pdf`;
    assert.equal(nomPlanche(BASE, { ...options, reedition: null, dossier: dossier([entiere]) }), entiere);
  });

  test('le plus long nom marqué tient sous 259 unités à côté d’une base lue sur le disque qui remplit la planche sans marque : la base s’y raccourcit, le suffixe reste entier ; le nom sans marque ne change pas', () => {
    for (const dossier of DOSSIERS) {
      const base = baseLueLongue(dossier);
      const options = { papier: 'Lettre', imposition: 'feuille', horodatage: HORODATAGE, reedition: reeditionDe(9999), proposition: 2 ** 31 - 1, ordre: 'table' };
      const sansDossier = nomPlanche(base, options);
      const suffixe = sansDossier.slice(base.length);
      assert.equal(suffixe, '.badges-p2147483647-9999_Lettre_feuille_table_2031-05-17_20-15-07.pdf');
      // Dix rééditions de suite dans le même dossier : chacune prend le rang
      // libre suivant, la base raccourcie d'autant.
      const pris = [];
      for (let rang = 1; rang <= 10; rang += 1) {
        const nom = nomPlanche(base, { ...options, dossier: { ...dossier, existants: pris } });
        const attendu = rang === 1 ? suffixe : suffixe.replace(/\.pdf$/, `_${rang}.pdf`);
        assert.ok(nom.endsWith(attendu), nom);
        // La tête raccourcie finit par le point de la coupe.
        const tete = nom.slice(0, nom.length - attendu.length);
        assert.ok(tete.length > 1 && tete.endsWith('.') && base.startsWith(tete.slice(0, -1)), tete);
        const chemin = `${dossier.racine}${dossier.separateur}${nom}.ecriture`;
        assert.equal(chemin.length, LONGUEUR_CHEMIN_MAX, `${dossier.racine} : ${chemin.length} unités`);
        pris.push(nom);
      }
      assert.equal(new Set(pris).size, 10);
      // Le nom du retenu, dans l'ordre alphabétique, ne bouge pas.
      const retenu = { papier: 'Lettre', imposition: 'feuille', horodatage: HORODATAGE, reedition: null };
      assert.equal(nomPlanche(base, { ...retenu, dossier: { ...dossier, existants: [] } }), nomPlanche(base, retenu));
    }
  });

  test('deux événements dont les bases ne diffèrent qu’au-delà de la coupe : la planche entière du second prend un rang plutôt que de remplacer celle du premier ; un nom raccourci ne se confond pas avec un nom entier', () => {
    const options = { papier: 'Lettre', imposition: 'feuille', horodatage: HORODATAGE, reedition: null, proposition: 12, ordre: 'table' };
    const suffixe = nomPlanche('b', options).slice(1);
    assert.equal(suffixe, '.badges-p12_Lettre_feuille_table_2031-05-17_20-15-07.pdf');
    for (const dossier of DOSSIERS) {
      // L'original et sa copie, deux bases lues sur le disque, plus longues
      // que la borne de deriverBase : la copie ne diffère que par « (2) »,
      // que la coupe retire.
      const nom = `Souper des Lucioles du printemps, \u{E9}dition sp\u{E9}ciale ${lettres(400)}`;
      const longueur = baseLueLongue(dossier).length;
      const original = nom.slice(0, longueur);
      const copie = `${nom.slice(0, longueur - 4)} (2)`;
      assert.ok(copie.endsWith(' (2)') && copie.length === original.length, copie);
      const sous = (existants) => ({ ...options, dossier: { ...dossier, existants } });
      const premier = nomPlanche(original, sous([]));
      assert.notEqual(premier, original + suffixe, 'la base se raccourcit');
      assert.ok(`${dossier.racine}${dossier.separateur}${premier}.ecriture`.length <= LONGUEUR_CHEMIN_MAX, premier);
      // Sans le premier fichier dans le dossier, la copie prendrait le même nom :
      // listé, il lui laisse le rang suivant.
      assert.equal(nomPlanche(copie, sous([])), premier);
      const second = nomPlanche(copie, sous([`${original}.gtt.json`, `${copie}.gtt.json`, premier]));
      // Le rang allonge le suffixe : la tête se raccourcit d'autant.
      const auRang2 = suffixe.replace(/\.pdf$/, '_2.pdf');
      assert.ok(second.endsWith(`.${auRang2}`) && premier.startsWith(second.slice(0, -auRang2.length - 1)), second);
      assert.ok(`${dossier.racine}${dossier.separateur}${second}.ecriture`.length <= LONGUEUR_CHEMIN_MAX, second);
      assert.equal(nomPlanche(copie, sous([premier.toUpperCase()])), second);
      // La planche entière raccourcie ne remplace pas davantage la sienne.
      assert.equal(nomPlanche(original, sous([premier])), second);
      // Une base égale à la tête raccourcie se nomme entière, autrement que le nom raccourci.
      const tete = premier.slice(0, premier.length - suffixe.length);
      assert.ok(tete.endsWith('.'), tete);
      const courte = tete.slice(0, -1);
      const entier = nomPlanche(courte, sous([premier]));
      assert.equal(entier, courte + suffixe);
      assert.notEqual(entier.toUpperCase(), premier.toUpperCase());
    }
  });

  test('le nom se choisit parmi les entrées du dossier pour une réédition, ou pour une base qui se raccourcit ; jamais sans dossier', () => {
    const dossier = { ...DOSSIERS[0], existants: [] };
    const options = { papier: 'Lettre', imposition: 'feuille', horodatage: HORODATAGE, reedition: null, proposition: 12, ordre: 'table' };
    const longue = baseLueLongue(DOSSIERS[0]);
    assert.equal(nomPlancheExigeListe(BASE, { ...options, dossier }), false);
    assert.equal(nomPlancheExigeListe(BASE, { ...options, reedition: reeditionDe(2), dossier }), true);
    assert.equal(nomPlancheExigeListe(longue, { ...options, dossier }), true);
    assert.equal(nomPlancheExigeListe(longue, { papier: 'A4', imposition: 'feuille', horodatage: HORODATAGE, dossier }), false);
    assert.equal(nomPlancheExigeListe(longue, options), false);
    assert.equal(nomPlancheExigeListe(longue, { ...options, reedition: reeditionDe(2) }), false);
    assert.throws(() => nomPlancheExigeListe(longue, { ...options, papier: 'A5', dossier }), TypeError);
  });

  test('la coupe rend un nom bien formé : ni demi-paire, ni espace ou point avant le point de la coupe, ni nom réservé, et le chemin tient sous 259 unités', () => {
    const options = { papier: 'Lettre', imposition: 'feuille', horodatage: HORODATAGE, reedition: null, proposition: 12, ordre: 'table' };
    const suffixe = '.badges-p12_Lettre_feuille_table_2031-05-17_20-15-07.pdf';
    // Le dossier dont la racine laisse exactement libres unités à la tête du nom :
    // racine, séparateur, tête, point de la coupe, suffixe, « .ecriture ». Les
    // bases sont lues sur le disque : sous ces racines, deriverBase n'en rend
    // aucune d'aussi longue.
    const dossierPour = (libres) => dossierDeLongueur(259 - 1 - libres - 1 - suffixe.length - '.ecriture'.length);
    const debut = (n) => `Gala ${lettres(n - 5)}`;
    const L = 40;
    const cas = [
      ['une paire coupée en son milieu', L, `${debut(L - 1)}\u{1F389}\u{1F389}x`, debut(L - 1)],
      ['une coupe sur une espace', L, `${debut(L - 1)} f\u{EA}te`, debut(L - 1)],
      ['une coupe sur un point', L, `${debut(L - 1)}.f\u{EA}te`, debut(L - 1)],
      ['une coupe sur une espace et un point', L, `${debut(L - 2)} .f\u{EA}t`, debut(L - 2)],
      ['une coupe qui laisserait CON', 3, 'CON soir', 'CO'],
      ['une coupe qui laisserait COM1', 4, 'COM1 soi', 'COM'],
    ];
    for (const [quoi, libres, base, attendue] of cas) {
      const dossier = dossierPour(libres);
      const nom = nomPlanche(base, { ...options, dossier: { ...dossier, existants: [] } });
      assert.equal(nom, `${attendue}.${suffixe}`, quoi);
      const tete = nom.slice(0, nom.length - suffixe.length - 1);
      assert.ok(!/[\ud800-\udfff]/u.test(tete), `${quoi} : demi-paire dans ${JSON.stringify(tete)}`);
      assert.ok(!/[ .]$/.test(tete), `${quoi} : ${JSON.stringify(tete)} finit par une espace ou un point`);
      assert.equal(estReserve(nom), false, `${quoi} : ${nom}`);
      assert.ok(`${dossier.racine}${dossier.separateur}${nom}.ecriture`.length <= LONGUEUR_CHEMIN_MAX, quoi);
    }
  });

  test('une base qui ne laisse rien à couper sous une racine trop longue garde son nom entier : l’écriture refusée offrira « Enregistrer sous… »', () => {
    const options = { papier: 'Lettre', imposition: 'feuille', horodatage: HORODATAGE, reedition: reeditionDe(9999), proposition: 2 ** 31 - 1, ordre: 'table' };
    const marque = '.badges-p2147483647-9999_Lettre_feuille_table_2031-05-17_20-15-07.pdf';
    // La racine qui ne laisse qu'une unité au nom avant son suffixe marqué :
    // racine, séparateur, une unité, suffixe, « .ecriture ». Le point de la
    // coupe n'y laisse aucun caractère de base. « Gala » vient d'un fichier
    // lu sur le disque : sous cette racine, deriverBase n'en rend aucune.
    const dossier = dossierDeLongueur(LONGUEUR_CHEMIN_MAX - 1 - 1 - marque.length - '.ecriture'.length);
    refuseTropLong(() => derive('Gala', dossier), dossier.racine);
    assert.equal(nomPlanche('Gala', options), `Gala${marque}`);
    assert.equal(nomPlanche('Gala', { ...options, dossier: { ...dossier, existants: [] } }), nomPlanche('Gala', options));
    // Un nom qui tient ne se raccourcit pas.
    const court = { papier: 'A4', imposition: 'feuille', horodatage: HORODATAGE, proposition: 3 };
    assert.equal(nomPlanche('Gala', { ...court, dossier: { ...dossier, existants: [] } }), 'Gala.badges-p3_A4_feuille_2031-05-17_20-15-07.pdf');
  });

  test('une base lue sur le disque qui finit par un point, comme celle de « Gala..gtt.json » : sa planche se choisit parmi les entrées du dossier, et ne remplace pas la planche qu’une autre base raccourcit en la même tête', () => {
    const options = { papier: 'Lettre', imposition: 'feuille', horodatage: HORODATAGE, reedition: null, proposition: 12, ordre: 'table' };
    const suffixe = '.badges-p12_Lettre_feuille_table_2031-05-17_20-15-07.pdf';
    const auRang2 = suffixe.replace(/\.pdf$/, '_2.pdf');
    // La racine qui laisse cinq unités au nom avant son suffixe : racine,
    // séparateur, nom, suffixe, « .ecriture ». « Gala. » y tient entière,
    // « Gala soir » s'y raccourcit en « Gala » suivi du point de la coupe.
    // Les deux bases sont lues sur le disque : sous cette racine, deriverBase
    // n'en rend aucune.
    const dossier = dossierDeLongueur(259 - 1 - 5 - suffixe.length - '.ecriture'.length);
    const sous = (existants) => ({ ...options, dossier: { ...dossier, existants } });
    refuseTropLong(() => derive('Gala soir', dossier), dossier.racine);
    const raccourcie = nomPlanche('Gala soir', sous([]));
    assert.equal(raccourcie, `Gala.${suffixe}`);
    assert.equal(`${dossier.racine}${dossier.separateur}${raccourcie}.ecriture`.length, LONGUEUR_CHEMIN_MAX);
    // Le dossier vide : la base au point garde son nom entier, que rien ne
    // distingue du nom raccourci.
    assert.equal(nomPlancheExigeListe('Gala.', sous([])), true);
    assert.equal(nomPlanche('Gala.', sous([])), raccourcie);
    // La planche raccourcie présente, la base au point prend le rang suivant,
    // sans égard à la casse ; et l'inverse.
    assert.equal(nomPlanche('Gala.', sous([raccourcie])), `Ga.${auRang2}`);
    assert.equal(nomPlanche('Gala.', sous([raccourcie.toUpperCase()])), `Ga.${auRang2}`);
    assert.equal(nomPlanche('Gala soir', sous([raccourcie])), `Ga.${auRang2}`);
    // Sous un dossier où elle tient sans peine, de même.
    for (const ailleurs of DOSSIERS) {
      const large = (existants) => ({ ...options, dossier: { ...ailleurs, existants } });
      for (const base of ['Gala.', 'Gala..', 'Soir\u{E9}e du 14.']) {
        assert.equal(nomPlancheExigeListe(base, large([])), true, `${base} — ${ailleurs.racine}`);
        assert.equal(nomPlanche(base, large([])), base + suffixe, `${base} — ${ailleurs.racine}`);
        assert.equal(nomPlanche(base, large([base + suffixe])), base + auRang2, `${base} — ${ailleurs.racine}`);
      }
      // Une espace finale ne se confond avec aucun nom raccourci : le nom
      // reste celui d'une base qui tient, et remplace sa propre planche.
      assert.equal(nomPlancheExigeListe('Gala ', large([])), false, ailleurs.racine);
      assert.equal(nomPlanche('Gala ', large([`Gala ${suffixe}`])), `Gala ${suffixe}`, ailleurs.racine);
    }
    // Sans dossier, ni liste ni rang.
    assert.equal(nomPlancheExigeListe('Gala.', options), false);
    assert.equal(nomPlanche('Gala.', options), `Gala.${suffixe}`);
  });

  test('la coupe sous une racine de lecteur, « E:\\ », ou sous « / » : la racine ne compte pas un séparateur de plus, et le chemin en écriture atomique remplit 259 unités', () => {
    const options = { papier: 'Lettre', imposition: 'feuille', horodatage: HORODATAGE, reedition: reeditionDe(9999), proposition: 2 ** 31 - 1, ordre: 'table' };
    const suffixe = '.badges-p2147483647-9999_Lettre_feuille_table_2031-05-17_20-15-07.pdf';
    // Le dossier, dont la racine porte déjà son séparateur final, et la
    // longueur de la tête que laisse 259 − racine − point de la coupe −
    // suffixe − « .ecriture ».
    const cas = [
      [{ racine: 'E:\\', separateur: '\\' }, 259 - 3 - 1 - suffixe.length - 9],
      [{ racine: '/', separateur: '/' }, 259 - 1 - 1 - suffixe.length - 9],
    ];
    // Une base lue sur le disque, que la coupe raccourcit sous chaque racine.
    const base = lettres(250);
    for (const [dossier, longueurTete] of cas) {
      const nom = nomPlanche(base, { ...options, dossier: { ...dossier, existants: [] } });
      assert.equal(nom, `${lettres(longueurTete)}.${suffixe}`, dossier.racine);
      assert.equal(`${dossier.racine}${nom}.ecriture`.length, 259, dossier.racine);
    }
    // Avec ou sans le séparateur final, un même dossier donne le même nom.
    const nom = (racine) => nomPlanche(base, { ...options, dossier: { racine, separateur: '\\', existants: [] } });
    assert.equal(nom('E:\\soirees\\data\\'), nom('E:\\soirees\\data'));
    assert.equal(`E:\\soirees\\data\\${nom('E:\\soirees\\data\\')}.ecriture`.length, 259);
  });

  test('un domaine hors contrat lève sans rien rendre : base, papier, imposition ou horodatage, TypeError ; réédition vide, de plus de 9 999 badges ou d’une autre forme, RangeError ou TypeError', () => {
    const valides = { papier: 'A4', imposition: 'feuille', horodatage: HORODATAGE, reedition: null };
    const fautes = [
      [TypeError, '', valides],
      [TypeError, 42, valides],
      [TypeError, BASE, { ...valides, papier: 'A3' }],
      [TypeError, BASE, { ...valides, papier: 'toString' }],
      [TypeError, BASE, { ...valides, papier: undefined }],
      [TypeError, BASE, { ...valides, imposition: 'massicot' }],
      [TypeError, BASE, { ...valides, imposition: undefined }],
      [TypeError, BASE, { ...valides, horodatage: '2031-05-17T20:15:07Z' }],
      [TypeError, BASE, { ...valides, horodatage: '2031-05-17 20:15:07-04:00' }],
      [TypeError, BASE, { ...valides, horodatage: undefined }],
      [TypeError, BASE, { ...valides, reedition: 3 }],
      [TypeError, BASE, { ...valides, reedition: { ids: 'abc' } }],
      [RangeError, BASE, { ...valides, reedition: { ids: [] } }],
      [RangeError, BASE, { ...valides, reedition: reeditionDe(10000) }],
      [TypeError, BASE, { ...valides, proposition: 0 }],
      [TypeError, BASE, { ...valides, proposition: 1.5 }],
      [TypeError, BASE, { ...valides, proposition: '2' }],
      [TypeError, BASE, { ...valides, ordre: 'hasard' }],
      [TypeError, BASE, { ...valides, ordre: null }],
      [TypeError, BASE, { ...valides, dossier: { racine: 'E:\\data', separateur: '\\' } }],
      [TypeError, BASE, { ...valides, dossier: { racine: 'E:\\data', separateur: ':', existants: [] } }],
      [TypeError, BASE, { ...valides, dossier: { racine: 42, separateur: '/', existants: [] } }],
      [TypeError, BASE, { ...valides, dossier: 'E:\\data' }],
    ];
    for (const [type, base, options] of fautes) {
      assert.throws(() => nomPlanche(base, options), type, `${JSON.stringify(base)} ${JSON.stringify(options).slice(0, 120)}`);
    }
    assert.throws(() => nomPlanche(BASE), TypeError);
  });
});

describe('nomPlanche et nomControle : les deux fichiers d’Avery 5392 (§ 11.6, § 8.6)', () => {
  const BASE = 'Soir\u{E9}e des Lucioles';
  const HORODATAGE = '2031-05-17T20:15:07-04:00';
  const reeditionDe = (k) => ({ ids: Array.from({ length: k }, (_, i) => i + 1) });
  const AVERY = { papier: 'Lettre', imposition: 'feuille', horodatage: HORODATAGE, reedition: null, modeleBadge: 'avery5392' };

  test('les cartes : « .badges », le modèle à la place du papier et de l’imposition ; la feuille de contrôle : « .controle », le reste à l’identique', () => {
    assert.equal(nomPlanche(BASE, AVERY), `${BASE}.badges_avery5392_2031-05-17_20-15-07.pdf`);
    assert.equal(nomControle(BASE, AVERY), `${BASE}.controle_avery5392_2031-05-17_20-15-07.pdf`);
    const marque = { ...AVERY, horodatage: null, reedition: reeditionDe(2), proposition: 4, ordre: 'table' };
    assert.equal(nomPlanche(BASE, marque), `${BASE}.badges-p4-2_avery5392_table_horodatage-inconnu.pdf`);
    assert.equal(nomControle(BASE, marque), `${BASE}.controle-p4-2_avery5392_table_horodatage-inconnu.pdf`);
  });

  test('l’A6 garde son nom, le modèle donné ou non ; nomControle n’existe que pour un modèle à cartes prédécoupées', () => {
    const a6 = { papier: 'A4', imposition: 'pile', horodatage: HORODATAGE, reedition: null };
    assert.equal(nomPlanche(BASE, { ...a6, modeleBadge: 'a6' }), nomPlanche(BASE, a6));
    assert.throws(() => nomControle(BASE, a6), TypeError);
    assert.throws(() => nomControle(BASE, { ...a6, modeleBadge: 'a6' }), TypeError);
  });

  test('Avery 5392 sur un autre papier que Lettre, ou un modèle inconnu : TypeError', () => {
    assert.throws(() => nomPlanche(BASE, { ...AVERY, papier: 'A4' }), TypeError);
    assert.throws(() => nomControle(BASE, { ...AVERY, papier: 'A4' }), TypeError);
    for (const modeleBadge of ['A6', 'Avery5392', null, 'toString']) {
      assert.throws(() => nomPlanche(BASE, { ...AVERY, modeleBadge }), TypeError, String(modeleBadge));
    }
  });

  test('les deux noms partagent leur rang : le premier où ni l’un ni l’autre n’est pris', () => {
    const options = { ...AVERY, reedition: reeditionDe(3) };
    const sous = (existants) => ({ ...options, dossier: { ...DOSSIERS[0], existants } });
    const cartes = nomPlanche(BASE, sous([]));
    const controle = nomControle(BASE, sous([]));
    const rang = (nom, n) => nom.replace(/\.pdf$/, `_${n}.pdf`);
    // Le contrôle seul pris pousse aussi les cartes au rang 2.
    for (const pris of [[cartes], [controle], [controle.toUpperCase()]]) {
      assert.deepEqual([nomPlanche(BASE, sous(pris)), nomControle(BASE, sous(pris))], [rang(cartes, 2), rang(controle, 2)], pris[0]);
    }
    assert.deepEqual([nomPlanche(BASE, sous([cartes, rang(controle, 2)])), nomControle(BASE, sous([cartes, rang(controle, 2)]))], [rang(cartes, 3), rang(controle, 3)]);
  });

  test('la borne du chemin : le plus long suffixe Avery tient sous celui de l’A6 ; à côté d’une base lue sur le disque qui remplit la planche sans marque, les deux noms marqués se raccourcissent en une même tête', () => {
    const plusLongAvery = nomControle('b', { ...AVERY, reedition: reeditionDe(9999) }).slice(1);
    assert.equal(plusLongAvery, '.controle-9999_avery5392_2031-05-17_20-15-07.pdf');
    assert.ok(plusLongAvery.length <= 51, String(plusLongAvery.length));
    for (const dossier of DOSSIERS) {
      const base = baseLueLongue(dossier);
      const options = { ...AVERY, reedition: reeditionDe(9999), proposition: 2 ** 31 - 1, ordre: 'table', dossier: { ...dossier, existants: [] } };
      const cartes = nomPlanche(base, options);
      const controle = nomControle(base, options);
      const teteDe = (nom, marque) => nom.slice(0, nom.indexOf(marque));
      assert.equal(teteDe(cartes, '.badges-'), teteDe(controle, '.controle-'));
      assert.ok(teteDe(cartes, '.badges-').endsWith('.'), cartes);
      for (const nom of [cartes, controle]) {
        assert.ok(`${dossier.racine}${dossier.separateur}${nom}.ecriture`.length <= LONGUEUR_CHEMIN_MAX, nom);
      }
      assert.equal(nomPlancheExigeListe(base, options), true);
    }
  });
});

describe('nomCsvBadges : le nom de la liste des badges en CSV (§ 11.6, § 8.6)', () => {
  const BASE = 'Soir\u{E9}e des Lucioles';
  const HORODATAGE = '2031-05-17T20:15:07-04:00';
  const reeditionDe = (k) => ({ ids: Array.from({ length: k }, (_, i) => i + 1) });
  const LISTE = { horodatage: HORODATAGE, reedition: null, proposition: null, ordre: 'alphabetique', brouillon: false };

  test('« .badges », la date et l’heure du placement, puis « .csv » ; ni papier, ni imposition, ni modèle', () => {
    assert.equal(nomCsvBadges(BASE, LISTE), `${BASE}.badges_2031-05-17_20-15-07.csv`);
    assert.equal(nomCsvBadges(BASE, { horodatage: HORODATAGE }), `${BASE}.badges_2031-05-17_20-15-07.csv`);
  });

  test('la proposition, la réédition et l’ordre par table se marquent comme dans le nom de la planche ; BROUILLON avant la date', () => {
    assert.equal(
      nomCsvBadges(BASE, { ...LISTE, horodatage: null, reedition: reeditionDe(2), proposition: 4, ordre: 'table', brouillon: true }),
      `${BASE}.badges-p4-2_table_BROUILLON_horodatage-inconnu.csv`,
    );
    assert.equal(nomCsvBadges(BASE, { ...LISTE, brouillon: true }), `${BASE}.badges_BROUILLON_2031-05-17_20-15-07.csv`);
    // Le nom de la liste ne se confond jamais avec celui d'une planche.
    assert.notEqual(nomCsvBadges(BASE, LISTE), nomPlanche(BASE, { papier: 'A4', imposition: 'feuille', horodatage: HORODATAGE }));
  });

  test('une réédition prend le premier rang libre du dossier, sans égard à la casse ; une liste entière garde son nom', () => {
    const sous = (options, existants) => ({ ...options, dossier: { ...DOSSIERS[0], existants } });
    const entiere = nomCsvBadges(BASE, sous(LISTE, []));
    assert.equal(nomCsvBadges(BASE, sous(LISTE, [entiere])), entiere);
    assert.equal(nomCsvBadgesExigeListe(BASE, sous(LISTE, [])), false);
    const reedition = { ...LISTE, reedition: reeditionDe(3) };
    const premiere = nomCsvBadges(BASE, sous(reedition, []));
    assert.equal(nomCsvBadgesExigeListe(BASE, sous(reedition, [])), true);
    assert.equal(nomCsvBadges(BASE, sous(reedition, [premiere.toUpperCase()])), premiere.replace(/\.csv$/, '_2.csv'));
    assert.equal(nomCsvBadgesExigeListe(BASE, reedition), false);
  });

  test('la borne du chemin : le plus long suffixe sans marque compte 46 unités, sous les 51 de la planche ; à côté d’une base lue sur le disque qui remplit la planche sans marque, le nom marqué se raccourcit', () => {
    const plusLong = nomCsvBadges('b', { ...LISTE, reedition: reeditionDe(9999), brouillon: true }).slice(1);
    assert.equal(plusLong, '.badges-9999_BROUILLON_2031-05-17_20-15-07.csv');
    assert.equal(plusLong.length, 46);
    for (const dossier of DOSSIERS) {
      const base = baseLueLongue(dossier);
      const options = { ...LISTE, reedition: reeditionDe(9999), proposition: 2 ** 31 - 1, ordre: 'table', brouillon: true, dossier: { ...dossier, existants: [] } };
      const nom = nomCsvBadges(base, options);
      assert.ok(nom.slice(0, nom.indexOf('.badges-')).endsWith('.'), nom);
      assert.ok(`${dossier.racine}${dossier.separateur}${nom}.ecriture`.length <= LONGUEUR_CHEMIN_MAX, nom);
    }
  });

  test('un domaine hors contrat lève TypeError ou RangeError, comme nomPlanche', () => {
    for (const options of [
      { ...LISTE, horodatage: '17 mai' },
      { ...LISTE, proposition: 0 },
      { ...LISTE, ordre: 'nom' },
      { ...LISTE, brouillon: 'oui' },
      { ...LISTE, dossier: { racine: 'C:' } },
    ]) {
      assert.throws(() => nomCsvBadges(BASE, options), TypeError, JSON.stringify(options));
    }
    assert.throws(() => nomCsvBadges('', LISTE), TypeError);
    assert.throws(() => nomCsvBadges(BASE, { ...LISTE, reedition: { ids: [] } }), RangeError);
  });
});

describe('nomSortieRenommee : une sortie de la planche au renommage (§ 8.7, § 11.6)', () => {
  const ANCIENNE = 'Gala des Saules';
  const NOUVELLE = 'Bal des Grisailles';
  const HORODATAGE = '2031-05-17T20:15:07-04:00';
  // Le dossier neuf de l'événement renommé, dans le dossier de travail des
  // Documents.
  const NEUF = { racine: `${DOSSIERS[0].racine}\\${NOUVELLE}`, separateur: '\\' };
  const reeditionDe = (k) => ({ ids: Array.from({ length: k }, (_, i) => i + 1) });
  // Des options de planche et de liste : l'A6, Avery 5392 et sa feuille de
  // contrôle, une réédition marquée, une liste en brouillon.
  const A6 = { papier: 'A4', imposition: 'feuille', horodatage: HORODATAGE };
  const AVERY = { papier: 'Lettre', imposition: 'feuille', horodatage: HORODATAGE, modeleBadge: 'avery5392' };
  const MARQUEE = { ...A6, reedition: reeditionDe(12), proposition: 3, ordre: 'table' };
  const LISTE = { horodatage: HORODATAGE, proposition: 2, brouillon: true };

  test("la planche, la feuille de contrôle et la liste de l'ancienne base prennent la nouvelle, le reste du nom gardé", () => {
    const cas = [
      [nomPlanche(ANCIENNE, A6), nomPlanche(NOUVELLE, A6)],
      [nomPlanche(ANCIENNE, AVERY), nomPlanche(NOUVELLE, AVERY)],
      [nomControle(ANCIENNE, AVERY), nomControle(NOUVELLE, AVERY)],
      [nomPlanche(ANCIENNE, MARQUEE), nomPlanche(NOUVELLE, MARQUEE)],
      [nomCsvBadges(ANCIENNE, LISTE), nomCsvBadges(NOUVELLE, LISTE)],
      [`${ANCIENNE}.badges_A4_feuille_2031-05-17_20-15-07_2.pdf`, `${NOUVELLE}.badges_A4_feuille_2031-05-17_20-15-07_2.pdf`],
      [`${ANCIENNE}.badges_horodatage-inconnu.csv`, `${NOUVELLE}.badges_horodatage-inconnu.csv`],
    ];
    for (const [ancien, attendu] of cas) {
      assert.equal(nomSortieRenommee(ancien, { ancienne: ANCIENNE, nouvelle: NOUVELLE, dossier: NEUF }), attendu, ancien);
    }
  });

  test("un nom que la borne a raccourci, tête de l'ancienne base suivie d'un point, se reconnaît et prend la nouvelle base", () => {
    const longue = `${'Grande soirée des Saules '.repeat(3)}d'automne`.slice(0, 68).trimEnd();
    const options = { ...MARQUEE, reedition: reeditionDe(9999), proposition: 2 ** 31 - 1 };
    const ancien = nomPlanche(longue, {
      ...options,
      dossier: { racine: `${DOSSIERS[0].racine}\\${longue}`, separateur: '\\', existants: [] },
    });
    const tete = ancien.slice(0, ancien.indexOf('..badges'));
    assert.ok(tete.length > 0 && tete.length < longue.length && longue.startsWith(tete), ancien);
    assert.equal(
      nomSortieRenommee(ancien, { ancienne: longue, nouvelle: NOUVELLE, dossier: NEUF }),
      nomPlanche(NOUVELLE, options),
    );
  });

  test('une nouvelle base plus longue se raccourcit, suivie d’un point, pour que le chemin du dossier neuf tienne sous la borne ; un nom court la garde entière', () => {
    const nouvelle = 'e'.repeat(68);
    const dossier = { racine: `${DOSSIERS[0].racine}\\${nouvelle}`, separateur: '\\' };
    const options = { ...MARQUEE, reedition: reeditionDe(9999), proposition: 2 ** 31 - 1 };
    const ancien = nomPlanche(ANCIENNE, options);
    const nom = nomSortieRenommee(ancien, { ancienne: ANCIENNE, nouvelle, dossier });
    const reste = ancien.slice(ANCIENNE.length);
    assert.ok(nom.endsWith(`.${reste}`), nom);
    const tete = nom.slice(0, nom.length - reste.length - 1);
    assert.ok(tete.length < nouvelle.length && nouvelle.startsWith(tete), nom);
    assert.equal(`${dossier.racine}\\${nom}${SUFFIXE_ECRITURE}`.length, LONGUEUR_CHEMIN_MAX);
    assert.equal(
      nomSortieRenommee(nomPlanche(ANCIENNE, A6), { ancienne: ANCIENNE, nouvelle, dossier }),
      nomPlanche(nouvelle, A6),
    );
  });

  test("ce qui n'est pas une sortie de l'ancienne base rend null : un autre fichier, la sortie d'une autre base, un fichier de l'événement, une écriture restée", () => {
    for (const nom of [
      'notes.txt',
      'logo',
      `${NOUVELLE}.badges_A4_feuille_2031-05-17_20-15-07.pdf`,
      `Gala.badges_A4_feuille_2031-05-17_20-15-07.pdf`,
      `${ANCIENNE}${SUFFIXES.etat}`,
      `${ANCIENNE}.badges_A4_feuille_2031-05-17_20-15-07.pdf${SUFFIXE_ECRITURE}`,
      `${ANCIENNE}.badgesA4.pdf`,
      `${ANCIENNE}.controle_avery5392.txt`,
      `${ANCIENNE}.badges`,
    ]) {
      assert.equal(nomSortieRenommee(nom, { ancienne: ANCIENNE, nouvelle: NOUVELLE, dossier: NEUF }), null, nom);
    }
  });
});
