// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de la forme d'une étiquette et de la découpe d'une saisie
// (§ 4.5) : les bornes, les séparateurs, la mise en forme — NFC, blancs —,
// les fautes nommées par leur raison, et la garde de la règle unique : hors
// de src/stockage/etiquettes.js, aucun module ne définit les séparateurs ni
// la longueur, et aucun ne découpe une liste d'étiquettes. Les étiquettes
// d'épreuve sont des mots génériques ou inventés.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from '../../test/lanceur.js';
import {
  ETIQUETTES_MAX,
  ETIQUETTE_LONGUEUR_MAX,
  SEPARATEURS_ETIQUETTES,
  estEtiquetteBienFormee,
  lireEtiquettes,
} from './etiquettes.js';

// Un texte de n points de code, chacun la lettre donnée.
const repete = (lettre, n) => lettre.repeat(n);

// Une lettre hors du plan de base : deux unités UTF-16, un point de code.
const ASTRALE = '\u{1D538}';

describe('les bornes et les séparateurs (§ 4.5)', () => {
  test('40 points de code, 20 étiquettes ; les séparateurs sont la virgule, le point-virgule, la barre et les fins de ligne', () => {
    assert.equal(ETIQUETTE_LONGUEUR_MAX, 40);
    assert.equal(ETIQUETTES_MAX, 20);
    assert.deepEqual(SEPARATEURS_ETIQUETTES, [',', ';', '|', '\u{000D}', '\u{000A}']);
    assert.ok(Object.isFrozen(SEPARATEURS_ETIQUETTES));
  });
});

describe('lireEtiquettes : la découpe et la mise en forme', () => {
  test('chaque séparateur coupe, dans l’ordre de la saisie ; « a|b » saisi d’un bloc fait deux étiquettes', () => {
    assert.deepEqual(lireEtiquettes('finance, ressources humaines; Montréal|bénévole'), {
      etiquettes: ['finance', 'ressources humaines', 'Montréal', 'bénévole'],
      fautes: [],
    });
    assert.deepEqual(lireEtiquettes('a|b').etiquettes, ['a', 'b']);
    assert.deepEqual(lireEtiquettes('lune\u{000D}\u{000A}soleil\u{000A}étoile\u{000D}comète').etiquettes, [
      'lune',
      'soleil',
      'étoile',
      'comète',
    ]);
  });

  test('bords nettoyés, blancs intérieurs réduits à une espace, insécables et cadratins compris', () => {
    assert.deepEqual(lireEtiquettes('   ressources    humaines  ').etiquettes, ['ressources humaines']);
    assert.deepEqual(lireEtiquettes('\u{00A0}ressources\u{2003}\u{00A0}humaines\u{202F}').etiquettes, [
      'ressources humaines',
    ]);
    assert.deepEqual(lireEtiquettes('\u{3000}grand\u{2028}salon\u{0020}').etiquettes, ['grand salon']);
  });

  test('la saisie se met en NFC : « é » composé et décomposé donnent la même étiquette, fondue', () => {
    const decompose = 'Montre\u{0301}al';
    const compose = 'Montr\u{00E9}al';
    assert.deepEqual(lireEtiquettes(decompose).etiquettes, [compose]);
    assert.deepEqual(lireEtiquettes(`${decompose}, ${compose}`).etiquettes, [compose]);
  });

  test('les morceaux vides s’écartent sans faute : une saisie vide, ou de séparateurs et de blancs seuls, ne donne rien', () => {
    for (const saisie of ['', ' ', ',', ',,;  ;| |', '\u{000A}\u{000D}\u{000A}', '\u{00A0},\u{2003}']) {
      assert.deepEqual(lireEtiquettes(saisie), { etiquettes: [], fautes: [] }, JSON.stringify(saisie));
    }
  });

  test('un doublon exact se fond à sa première place ; deux casses différentes restent deux étiquettes, la réconciliation est ailleurs', () => {
    assert.deepEqual(lireEtiquettes('finance, Montréal, finance,finance').etiquettes, ['finance', 'Montréal']);
    assert.deepEqual(lireEtiquettes('Finance, finance, FINANCE  ').etiquettes, ['Finance', 'finance', 'FINANCE']);
  });

  test('40 points de code se lisent ; 41 font une faute « longueur » ; une lettre hors du plan de base compte pour un', () => {
    const quarante = repete('a', 40);
    const quaranteEtUn = repete('a', 41);
    const astrales = repete(ASTRALE, 40);
    assert.equal(astrales.length, 80);
    assert.deepEqual(lireEtiquettes(`${quarante}, ${astrales}`), { etiquettes: [quarante, astrales], fautes: [] });
    assert.deepEqual(lireEtiquettes(`finance, ${quaranteEtUn}`), {
      etiquettes: ['finance'],
      fautes: [{ valeur: quaranteEtUn, raison: 'longueur' }],
    });
    assert.deepEqual(lireEtiquettes(repete(ASTRALE, 41)).fautes, [{ valeur: repete(ASTRALE, 41), raison: 'longueur' }]);
    // La longueur se compte après la mise en forme : des blancs réduits ne
    // comptent plus.
    assert.deepEqual(lireEtiquettes(`  ${repete('b', 20)}     ${repete('c', 19)}  `).fautes, []);
  });

  test('une tabulation, au milieu comme au bord, fait une faute « contrôle » : un caractère de contrôle n’est jamais un blanc', () => {
    assert.deepEqual(lireEtiquettes('ressources\u{0009}humaines'), {
      etiquettes: [],
      fautes: [{ valeur: 'ressources\u{0009}humaines', raison: 'controle' }],
    });
    assert.deepEqual(lireEtiquettes('\u{0009}finance, Montréal').fautes, [
      { valeur: '\u{0009}finance', raison: 'controle' },
    ]);
    assert.deepEqual(lireEtiquettes('finance\u{0009}').fautes, [{ valeur: 'finance\u{0009}', raison: 'controle' }]);
  });

  test('tout caractère de contrôle, C0, DEL ou C1, et une moitié de paire isolée font une faute « contrôle »', () => {
    const fautifs = ['a\u{0000}b', 'a\u{0007}b', 'a\u{001B}b', 'a\u{007F}b', 'a\u{0085}b', 'a\u{009F}b', 'a\u{000B}b', 'a\u{000C}b', 'a\u{D800}b', 'a\u{DFFF}'];
    for (const valeur of fautifs) {
      assert.deepEqual(lireEtiquettes(valeur), { etiquettes: [], fautes: [{ valeur, raison: 'controle' }] }, JSON.stringify(valeur));
    }
  });

  test('un caractère invisible — format (Cf) ou ignorable par défaut — fait une faute « contrôle », au milieu comme au bord : un trait d’union conditionnel dans « finance » ne se voit pas', () => {
    const invisibles = [
      '\u{00AD}', // trait d'union conditionnel
      '\u{200B}', // espace sans chasse
      '\u{200C}', // antiliant sans chasse
      '\u{200D}', // liant sans chasse
      '\u{2060}', // gluon de mots
      '\u{FEFF}', // gluon sans chasse, indicateur d'ordre des octets
      '\u{202A}', // enchâssement de gauche à droite
      '\u{202E}', // forçage de droite à gauche
      '\u{2066}', // isolat de gauche à droite
      '\u{2069}', // fin d'isolat
      '\u{061C}', // marque de lettre arabe
      '\u{180E}', // séparateur de voyelle mongol
      '\u{115F}', // remplisseur de début hangul, ignorable hors de Cf
      '\u{034F}', // lien de graphèmes, ignorable hors de Cf
      '\u{FE0F}', // sélecteur de variante, ignorable hors de Cf
      '\u{E0061}', // étiquette Unicode, hors du plan de base
    ];
    for (const invisible of invisibles) {
      for (const valeur of [`fin${invisible}ance`, `${invisible}finance`, `finance${invisible}`]) {
        assert.deepEqual(lireEtiquettes(valeur), { etiquettes: [], fautes: [{ valeur, raison: 'controle' }] }, JSON.stringify(valeur));
        assert.equal(estEtiquetteBienFormee(valeur), false, JSON.stringify(valeur));
      }
    }
    // Les blancs restent des blancs : aucun n'est invisible au sens de la
    // règle, et chacun se réduit à une espace.
    assert.deepEqual(lireEtiquettes('grand\u{00A0}\u{2007}\u{205F}\u{3000}salon').etiquettes, ['grand salon']);
  });

  test('un caractère de contrôle l’emporte sur la longueur ; une même faute répétée se nomme une fois, à sa première place', () => {
    const longueEtControle = `${repete('a', 41)}\u{0007}`;
    assert.deepEqual(lireEtiquettes(longueEtControle).fautes, [{ valeur: longueEtControle, raison: 'controle' }]);
    const longue = repete('z', 45);
    assert.deepEqual(lireEtiquettes(`a\u{0007}, ${longue}, finance, a\u{0007}, ${longue}`), {
      etiquettes: ['finance'],
      fautes: [
        { valeur: 'a\u{0007}', raison: 'controle' },
        { valeur: longue, raison: 'longueur' },
      ],
    });
  });

  test('le nombre d’étiquettes ne se borne pas ici : 21 étiquettes distinctes se lisent toutes, l’appelant compare à ETIQUETTES_MAX', () => {
    const saisie = Array.from({ length: 21 }, (_, rang) => `groupe ${rang + 1}`).join(', ');
    assert.equal(lireEtiquettes(saisie).etiquettes.length, 21);
  });

  test('chaque étiquette rendue est bien formée, et une étiquette bien formée se relit seule et telle quelle', () => {
    const saisies = [
      ' Finance ,finance;  RH|  Montre\u{0301}al ',
      `\u{00A0}${repete('é', 40)}\u{00A0}`,
      `${repete(ASTRALE, 39)}  x`,
      'a  b , c\u{2003}\u{2003}d',
    ];
    for (const saisie of saisies) {
      for (const motCle of lireEtiquettes(saisie).etiquettes) {
        assert.equal(estEtiquetteBienFormee(motCle), true, JSON.stringify(motCle));
        assert.deepEqual(lireEtiquettes(motCle), { etiquettes: [motCle], fautes: [] }, JSON.stringify(motCle));
      }
    }
  });

  test('une saisie qui n’est pas un texte lève TypeError', () => {
    for (const valeur of [null, undefined, 12, ['finance']]) {
      assert.throws(() => lireEtiquettes(valeur), TypeError, String(valeur));
    }
  });
});

describe('estEtiquetteBienFormee', () => {
  test('admet un texte en NFC, sans blanc en bord, ses blancs réduits à une espace, de 1 à 40 points de code', () => {
    const admises = ['a', 'finance', 'ressources humaines', 'Montréal', repete('a', 40), repete(ASTRALE, 40), 'été 2031', '=SOMME(A1)'];
    for (const valeur of admises) assert.equal(estEtiquetteBienFormee(valeur), true, JSON.stringify(valeur));
  });

  test('refuse le vide, les bords, les blancs doubles ou insécables, le texte décomposé, 41 points de code, un séparateur, un caractère de contrôle, une moitié de paire et ce qui n’est pas un texte', () => {
    const refusees = [
      '',
      ' finance',
      'finance ',
      'ressources  humaines',
      'ressources\u{00A0}humaines',
      'ressources\u{2003}humaines',
      'Montre\u{0301}al',
      repete('a', 41),
      'a,b',
      'a;b',
      'a|b',
      'a\u{000A}b',
      'a\u{000D}b',
      'a\u{0009}b',
      'a\u{0085}b',
      'fin\u{00AD}ance',
      'fin\u{200B}ance',
      '\u{202E}gauche',
      '\u{2066}finance\u{2069}',
      'a\u{D800}',
      null,
      undefined,
      40,
      ['finance'],
    ];
    for (const valeur of refusees) assert.equal(estEtiquetteBienFormee(valeur), false, JSON.stringify(valeur));
  });
});

// --- La garde de la règle unique (contrainte 34) ----------------------------

// Le module qui seul définit la forme et la découpe, relatif à la racine.
const MODULE_DE_LA_REGLE = 'src/stockage/etiquettes.js';

// Les deux constantes de la règle, et les définitions qui les visent, lues
// sur le texte entier : une déclaration ; un nom donné à l'export ou à
// l'import ; une affectation, au nom seul ou à une propriété ; une clé d'objet
// littéral ; une déstructuration, sur une ou plusieurs lignes, qui lie le nom.
// L'indice du groupe nom est celui de la ligne relevée.
const NOM = '(?<nom>SEPARATEURS_ETIQUETTES|ETIQUETTE_LONGUEUR_MAX)\\b';
const DEFINITIONS = [
  new RegExp(`\\b(?:const|let|var|function|class)\\s+${NOM}`, 'g'),
  new RegExp(`\\bas\\s+${NOM}`, 'g'),
  new RegExp(`(?<![\\w$])${NOM}\\s*=(?![=>])`, 'g'),
  new RegExp(`(?<=[{,]\\s*)${NOM}\\s*:(?!:)`, 'g'),
  new RegExp(`[{[][^{}\\[\\]();=]*?(?<![\\w$])${NOM}[^{}\\[\\]();=]*[}\\]]\\s*=(?![=>])`, 'g'),
];

// Le seul emploi admis de la liste des séparateurs hors du module de la
// règle : son nom seul, sans alias, dans la clause { … } d'un import, à côté
// ou non d'un import par défaut. Tout autre mot SEPARATEURS_ETIQUETTES du
// code — propriété, substitution d'un gabarit, alias, réexportation — sert à
// découper hors de lireEtiquettes ou y prépare.
const CLAUSE_D_IMPORT = /\bimport\s+(?:[\p{L}\p{N}_$]+\s*,\s*)?\{([^}]*)\}\s*from\b/gu;
const SEPARATEURS = 'SEPARATEURS_ETIQUETTES';

// Les indices, dans texte, des noms SEPARATEURS_ETIQUETTES que
// CLAUSE_D_IMPORT admet : chaque membre de la clause qui, blancs retirés, se
// réduit au nom.
function importsAdmis(texte) {
  const admis = new Set();
  for (const clause of texte.matchAll(CLAUSE_D_IMPORT)) {
    let indice = clause.index + clause[0].indexOf('{') + 1;
    for (const membre of clause[1].split(',')) {
      if (membre.trim() === SEPARATEURS) admis.add(indice + membre.indexOf(SEPARATEURS));
      indice += membre.length + 1;
    }
  }
  return admis;
}

// Les séparateurs d'une cellule (§ 10.1), sans les fins de ligne : une
// expression qui coupe aux fins de ligne seules découpe des lignes, non une
// liste d'étiquettes.
const SEPARATEURS_DE_CELLULE = Object.freeze([',', ';', '|']);

// Le caractère que désigne une séquence d'échappement d'une source
// d'expression, \xHH, \uHHHH ou \u{H…}, ou le caractère échappé lui-même ;
// null pour une classe (\s, \d, \w et leurs contraires), une ancre (\b, \B)
// ou une référence. Rend { car, fin }, fin l'indice qui suit la séquence.
function echappement(source, debut) {
  const suite = source.slice(debut + 1);
  const code = /^(?:x([0-9a-fA-F]{2})|u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4}))/.exec(suite);
  if (code !== null) {
    return { car: String.fromCodePoint(Number.parseInt(code[1] ?? code[2] ?? code[3], 16)), fin: debut + 1 + code[0].length };
  }
  const lettre = suite.charAt(0);
  if (lettre === '') return { car: null, fin: debut + 1 };
  if (/[sSdDwWbBkpPc0-9]/.test(lettre)) return { car: null, blanc: lettre === 's', fin: debut + 2 };
  return { car: lettre, fin: debut + 2 };
}

// Les séparateurs d'une cellule qu'une classe [ … ] admet, négation ou non,
// intervalles compris : { ensemble, fin }, fin l'indice qui suit le « ] ».
function classeDe(source, debut) {
  const ensemble = new Set();
  const caracteres = [];
  let i = debut + 1;
  if (source[i] === '^') i += 1;
  while (i < source.length && source[i] !== ']') {
    if (source[i] === '\\') {
      const { car, fin } = echappement(source, i);
      caracteres.push(car);
      i = fin;
    } else {
      caracteres.push(String.fromCodePoint(source.codePointAt(i)));
      i += caracteres.at(-1).length;
    }
  }
  caracteres.forEach((car, rang) => {
    if (car !== null && SEPARATEURS_DE_CELLULE.includes(car)) ensemble.add(car);
    const fin = caracteres[rang + 2];
    if (car !== null && caracteres[rang + 1] === '-' && fin !== null && fin !== undefined) {
      for (const separateur of SEPARATEURS_DE_CELLULE) {
        if (car.codePointAt(0) <= separateur.codePointAt(0) && separateur.codePointAt(0) <= fin.codePointAt(0)) ensemble.add(separateur);
      }
    }
  });
  return { ensemble, fin: i + 1 };
}

// Vrai quand une source d'expression régulière découpe aux séparateurs d'une
// cellule : une classe en admet au moins deux, ou une alternance — au
// premier niveau ou dans un groupe — en offre au moins deux par des branches
// qui ne portent, blancs et ancres mis à part, qu'un séparateur, une classe
// ou un groupe de séparateurs. Une source mal formée se lit sans lever.
function decoupeAuxSeparateurs(source) {
  let i = 0;
  let releve = false;
  const alternance = () => {
    const branches = [[]];
    while (i < source.length && source[i] !== ')') {
      const c = source[i];
      let atome;
      if (c === '|') {
        branches.push([]);
        i += 1;
        continue;
      } else if (c === '\\') {
        const { car, blanc, fin } = echappement(source, i);
        atome = blanc ? { sorte: 'neutre' } : { sorte: 'separateurs', ensemble: new Set(SEPARATEURS_DE_CELLULE.includes(car) ? [car] : []) };
        if (car === null && !blanc) atome = { sorte: 'autre' };
        i = fin;
      } else if (c === '[') {
        const { ensemble, fin } = classeDe(source, i);
        if (ensemble.size >= 2) releve = true;
        atome = { sorte: 'separateurs', ensemble };
        i = fin;
      } else if (c === '(') {
        i += 1;
        const prefixe = /^\?(?::|=|!|<=|<!|<[^>]*>)/.exec(source.slice(i));
        if (prefixe !== null) i += prefixe[0].length;
        atome = { sorte: 'separateurs', ensemble: alternance() };
        i += 1;
      } else {
        atome = c === ' ' || c === '^' || c === '$' ? { sorte: 'neutre' } : { sorte: 'separateurs', ensemble: new Set(SEPARATEURS_DE_CELLULE.includes(c) ? [c] : []) };
        if (c === '.') atome = { sorte: 'autre' };
        i += String.fromCodePoint(source.codePointAt(i)).length;
      }
      const quantificateur = /^(?:[*+?]|\{\d+(?:,\d*)?\})\??/.exec(source.slice(i));
      if (quantificateur !== null) i += quantificateur[0].length;
      branches.at(-1).push(atome);
    }
    const offerts = new Set();
    for (const branche of branches) {
      const atomes = branche.filter(({ sorte }) => sorte !== 'neutre');
      if (atomes.length === 1 && atomes[0].sorte === 'separateurs') for (const s of atomes[0].ensemble) offerts.add(s);
    }
    if (offerts.size >= 2) releve = true;
    return offerts;
  };
  while (i < source.length) {
    alternance();
    i += 1;
  }
  return releve;
}

// La valeur d'un texte littéral JavaScript, échappements résolus, telle
// qu'une source d'expression la reçoit de RegExp.
function valeurDuTexte(brut) {
  return brut.replace(/\\(?:x([0-9a-fA-F]{2})|u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|\r?\n|([\s\S]))/g, (_, x, u1, u2, autre) => {
    if (x ?? u1 ?? u2) return String.fromCodePoint(Number.parseInt(x ?? u1 ?? u2, 16));
    if (autre === undefined) return '';
    return { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', 0: '\0' }[autre] ?? autre;
  });
}

// Les mots après lesquels une barre oblique ouvre une expression régulière
// et non une division.
const MOTS_AVANT_EXPRESSION = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);

// Lit le code JavaScript de texte entre debut et fin et range dans sortie
// chaque littéral { indice, source, texte } — une expression régulière, sa
// source ; un texte, sa valeur, et un gabarit, la valeur de ses morceaux mis
// bout à bout, ses substitutions retirées, chacun avec texte vrai — et
// chaque mot { indice, mot }, identifiant, mot réservé ou nombre. Les
// lexèmes des substitutions se rangent aussi. Les commentaires sont sautés.
// Une barre oblique ouvre une expression au début, après un mot de
// MOTS_AVANT_EXPRESSION ou une ponctuation autre que « ) » et « ] », et une
// division après une valeur ; une expression qui ne se ferme pas sur sa ligne
// n'en est pas une. S'arrête à la première accolade fermante sans ouvrante, et
// rend son indice, ou fin.
function lireLexemes(texte, debut, fin, sortie) {
  let i = debut;
  let regexPossible = true;
  let profondeur = 0;
  while (i < fin) {
    const c = texte[i];
    if (c === '/' && texte[i + 1] === '/') {
      const ligne = texte.indexOf('\n', i);
      i = ligne < 0 ? fin : ligne;
    } else if (c === '/' && texte[i + 1] === '*') {
      const ferme = texte.indexOf('*/', i + 2);
      i = ferme < 0 ? fin : ferme + 2;
    } else if (/\s/.test(c)) {
      i += 1;
    } else if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < fin && texte[j] !== c && texte[j] !== '\n') j += texte[j] === '\\' ? 2 : 1;
      sortie.push({ indice: i, source: valeurDuTexte(texte.slice(i + 1, j)), texte: true });
      i = j + 1;
      regexPossible = false;
    } else if (c === '`') {
      let j = i + 1;
      let morceau = j;
      let brut = '';
      while (j < fin && texte[j] !== '`') {
        if (texte[j] === '\\') {
          j += 2;
        } else if (texte[j] === '$' && texte[j + 1] === '{') {
          brut += texte.slice(morceau, j);
          j = lireLexemes(texte, j + 2, fin, sortie) + 1;
          morceau = j;
        } else {
          j += 1;
        }
      }
      sortie.push({ indice: i, source: valeurDuTexte(brut + texte.slice(morceau, j)), texte: true });
      i = j + 1;
      regexPossible = false;
    } else if (c === '/' && regexPossible) {
      let j = i + 1;
      let dansClasse = false;
      while (j < fin && texte[j] !== '\n' && (dansClasse || texte[j] !== '/')) {
        if (texte[j] === '\\') j += 1;
        else if (texte[j] === '[') dansClasse = true;
        else if (texte[j] === ']') dansClasse = false;
        j += 1;
      }
      if (texte[j] === '/') {
        sortie.push({ indice: i, source: texte.slice(i + 1, j) });
        i = j + 1;
        while (/[a-z]/.test(texte[i] ?? '')) i += 1;
        regexPossible = false;
      } else {
        i += 1;
      }
    } else if (/[\p{L}\p{N}_$]/u.test(c)) {
      const mot = /^[\p{L}\p{N}_$]+/u.exec(texte.slice(i, Math.min(fin, i + 200)))[0];
      sortie.push({ indice: i, mot });
      i += mot.length;
      regexPossible = MOTS_AVANT_EXPRESSION.has(mot);
    } else if (c === '}' && profondeur === 0) {
      return i;
    } else {
      if (c === '{') profondeur += 1;
      if (c === '}') profondeur -= 1;
      regexPossible = c !== ')' && c !== ']';
      i += 1;
    }
  }
  return fin;
}

// Les lexèmes du code d'une source : d'un module, son texte entier ; d'un
// composant Svelte, ses blocs de script et les expressions { … } de son
// gabarit — un bloc {#each …}, {:else …}, {@html …} se lit après son mot
// —, le texte du balisage, les commentaires HTML et la feuille de style
// exclus.
function lexemesDe(chemin, texte) {
  const sortie = [];
  if (!chemin.endsWith('.svelte')) {
    for (let i = 0; i < texte.length; i = lireLexemes(texte, i, texte.length, sortie) + 1);
    return sortie;
  }
  let i = 0;
  while (i < texte.length) {
    const ouverture = /^<(script|style)\b[^>]*>/.exec(texte.slice(i, i + 200));
    if (texte.startsWith('<!--', i)) {
      const ferme = texte.indexOf('-->', i);
      i = ferme < 0 ? texte.length : ferme + 3;
    } else if (ouverture !== null) {
      const debut = i + ouverture[0].length;
      const ferme = texte.indexOf(`</${ouverture[1]}`, debut);
      const fin = ferme < 0 ? texte.length : ferme;
      if (ouverture[1] === 'script') for (let j = debut; j < fin; j = lireLexemes(texte, j, fin, sortie) + 1);
      i = fin + 1;
    } else if (texte[i] === '{') {
      const mot = /^\{\s*[#:@/][a-z]*/.exec(texte.slice(i, i + 40));
      i = lireLexemes(texte, i + (mot === null ? 1 : mot[0].length), texte.length, sortie) + 1;
    } else {
      i += 1;
    }
  }
  return sortie;
}

// Vrai quand un texte peut servir de source à RegExp, avec ou sans le
// drapeau u. Un texte qui ne le peut pas — un jeu de caractères où un « ( »
// ou un « [ » reste ouvert — ne découpe rien.
function estSourceDExpression(source) {
  for (const drapeaux of ['', 'u']) {
    try {
      new RegExp(source, drapeaux);
      return true;
    } catch {
      // Essai suivant.
    }
  }
  return false;
}

// Les littéraux qui coupent aux séparateurs d'une cellule pour lire autre
// chose qu'une liste d'étiquettes, chacun par son module et sa source exacte :
// une source changée n'y répond plus et se relit.
const DECOUPES_ADMISES = Object.freeze([
  {
    chemin: 'src/polices/chargement.js',
    source: '^data:[^,;]*(?:;[^,;=]+=[^,;]*)*;base64,([A-Za-z0-9+/]*={0,2})$',
    raison: 'la syntaxe d’une URL data:, où « , » et « ; » séparent type, paramètres et données',
  },
  {
    chemin: 'src/csv/presence.js',
    source: '^(?:\\s*(?:,|;|et)\\s*|\\s+)',
    raison: 'la grammaire d’une cellule de présence, où « , », « ; », « et » et les blancs séparent les tours',
  },
]);

/**
 * Les écarts à la règle unique dans des sources { chemin, texte } — modules
 * JavaScript et composants Svelte : pour chaque source autre que le module
 * de la règle, chaque définition des constantes, chaque emploi de
 * SEPARATEURS_ETIQUETTES dans le code hors de ce qu'importsAdmis admet, et
 * chaque littéral — expression régulière, ou texte et gabarit qui peuvent
 * servir de source à RegExp, quel que soit l'appel qui l'emploie — dont la
 * source découpe aux séparateurs d'une cellule (decoupeAuxSeparateurs), hors
 * de DECOUPES_ADMISES, « chemin : ligne n », une fois par ligne, triés.
 *
 * La garde lit des lexèmes, sans analyse du programme, et ne voit pas :
 * une expression régulière qui ouvre une instruction après « ) », comme
 * `if (ok) /[,;]/.test(x)`, que la lecture prend pour une division — à
 * raison dans le cas général, où « ) » clôt une valeur ; des découpes
 * enchaînées d'un séparateur chacune, dont aucun littéral n'en porte deux ;
 * la liste lue par une clé entre crochets, dont le nom est un texte.
 *
 * @param {Array<{chemin: string, texte: string}>} sources
 * @returns {string[]}
 */
function ecartsALaRegleUnique(sources) {
  const ecarts = new Set();
  for (const { chemin, texte } of sources) {
    if (chemin === MODULE_DE_LA_REGLE) continue;
    const ligneDe = (indice) => texte.slice(0, indice).split('\n').length;
    const relever = (indice) => ecarts.add(`${chemin} : ligne ${ligneDe(indice)}`);
    for (const motif of DEFINITIONS) {
      for (const trouve of texte.matchAll(motif)) relever(trouve.index + trouve[0].lastIndexOf(trouve.groups.nom));
    }
    const admis = importsAdmis(texte);
    for (const lexeme of lexemesDe(chemin, texte)) {
      if (lexeme.mot !== undefined) {
        if (lexeme.mot === SEPARATEURS && !admis.has(lexeme.indice)) relever(lexeme.indice);
        continue;
      }
      if (lexeme.texte && !estSourceDExpression(lexeme.source)) continue;
      if (DECOUPES_ADMISES.some((admise) => admise.chemin === chemin && admise.source === lexeme.source)) continue;
      if (decoupeAuxSeparateurs(lexeme.source)) relever(lexeme.indice);
    }
  }
  return [...ecarts].sort();
}

// Les sources du projet que la garde balaie : sous src et scripts, chaque
// module JavaScript qui n'est pas une épreuve et chaque composant Svelte,
// triés.
function modulesDuProjet() {
  const racine = fileURLToPath(new URL('../..', import.meta.url));
  return ['src', 'scripts']
    .flatMap((dossier) =>
      readdirSync(join(racine, dossier), { recursive: true }).map((nom) => `${dossier}/${String(nom).replaceAll('\\', '/')}`),
    )
    .filter((chemin) => (chemin.endsWith('.js') && !chemin.endsWith('.test.js')) || chemin.endsWith('.svelte'))
    .sort()
    .map((chemin) => ({ chemin, texte: readFileSync(join(racine, chemin), 'utf8') }));
}

describe('une seule règle d’étiquette (contrainte 34)', () => {
  test('hors de src/stockage/etiquettes.js, aucun module ne définit les séparateurs ni la longueur, ni ne découpe une liste d’étiquettes', () => {
    const modules = modulesDuProjet();
    assert.ok(modules.length > 100, `${modules.length} modules seulement`);
    assert.ok(modules.some(({ chemin }) => chemin === MODULE_DE_LA_REGLE), 'le module de la règle manque au balayage');
    assert.ok(modules.some(({ chemin }) => chemin === 'src/interface/App.svelte'), 'les composants manquent au balayage');
    assert.deepEqual(ecartsALaRegleUnique(modules), []);
    // Chaque découpe admise désigne un littéral qui existe encore.
    for (const { chemin, source } of DECOUPES_ADMISES) {
      const module = modules.find((candidat) => candidat.chemin === chemin);
      assert.ok(module !== undefined && lexemesDe(chemin, module.texte).some((litteral) => litteral.source === source), `${chemin} : ${source}`);
      assert.deepEqual(ecartsALaRegleUnique([{ chemin: 'src/autre.js', texte: `const x = /${source}/;\n` }]), ['src/autre.js : ligne 1'], source);
    }
  });

  test('la garde relève une copie inventée : une constante redéfinie, renommée à l’import, une découpe par la classe des séparateurs ou par la constante', () => {
    const inventees = [
      { chemin: 'src/csv/inventee.js', texte: "// en tête\nexport const SEPARATEURS_ETIQUETTES = [',', ';'];\n" },
      { chemin: 'src/application/inventee.js', texte: 'let ETIQUETTE_LONGUEUR_MAX = 41;\n' },
      { chemin: 'src/interface/inventee.js', texte: "import { LIMITE as ETIQUETTE_LONGUEUR_MAX } from './ailleurs.js';\n" },
      { chemin: 'src/csv/decoupe.js', texte: 'const morceaux = cellule.split(/[,;|]/);\n' },
      { chemin: 'scripts/decoupe.js', texte: "x\ny\nconst morceaux = saisie.split(new RegExp(`[${SEPARATEURS_ETIQUETTES.join('')}]`));\n" },
      { chemin: 'src/csv/expression.js', texte: "const coupe = new RegExp('[;|]');\nconst autre = texte.split(/\\s*[;,]\\s*/);\n" },
    ];
    assert.deepEqual(ecartsALaRegleUnique(inventees), [
      'scripts/decoupe.js : ligne 3',
      'src/application/inventee.js : ligne 1',
      'src/csv/decoupe.js : ligne 1',
      'src/csv/expression.js : ligne 1',
      'src/csv/expression.js : ligne 2',
      'src/csv/inventee.js : ligne 2',
      'src/interface/inventee.js : ligne 1',
    ]);
  });

  test('la garde relève une découpe rangée dans une constante, une alternance sans classe, un séparateur échappé, une redéfinition par déstructuration et une découpe dans un composant', () => {
    const inventees = [
      // L'expression rangée dans une constante, puis employée plus loin.
      { chemin: 'src/csv/constante.js', texte: 'const COUPURES = /[,;|]/u;\nconst morceaux = cellule.split(COUPURES);\n' },
      // Une alternance sans classe, au premier niveau ou dans un groupe.
      { chemin: 'src/csv/alternance.js', texte: "const a = cellule.split(/,|;|\\|/);\nconst b = saisie.replace(/\\s*(?:;|,)\\s*/g, '·');\n" },
      // Une source rangée dans un texte, passée à RegExp par son nom.
      { chemin: 'src/application/motif.js', texte: "const MOTIF = '[,|]';\n\nconst coupe = new RegExp(MOTIF, 'u');\n" },
      // Des séparateurs écrits par leur point de code, ou pris dans un
      // intervalle.
      { chemin: 'src/csv/echappes.js', texte: 'const x = /[\\x2c\\u{3b}]/u;\nconst y = /[+-;]/;\nconst z = texte.match(/[^\\u002c|]+/g);\n' },
      // Les constantes de la règle redéfinies par déstructuration.
      { chemin: 'src/application/destructure.js', texte: 'const { SEPARATEURS_ETIQUETTES } = autre;\nconst {\n  premier,\n  ETIQUETTE_LONGUEUR_MAX,\n} = autre;\n' },
      // Un composant : dans son bloc de script, puis dans une expression du
      // gabarit ; le texte du balisage n'est pas du code.
      {
        chemin: 'src/interface/fiche/Inventee.svelte',
        texte: [
          '<script>',
          "  let { saisie } = $props();",
          '  const morceaux = $derived(saisie.split(/[;|]/));',
          '</script>',
          "<p>Séparez les mots par [, ; |] : l'écran les lit.</p>",
          '{#each saisie.split(/,|;/) as motCle}<span>{motCle}</span>{/each}',
          '',
        ].join('\n'),
      },
    ];
    assert.deepEqual(ecartsALaRegleUnique(inventees), [
      'src/application/destructure.js : ligne 1',
      'src/application/destructure.js : ligne 4',
      'src/application/motif.js : ligne 1',
      'src/csv/alternance.js : ligne 1',
      'src/csv/alternance.js : ligne 2',
      'src/csv/constante.js : ligne 1',
      'src/csv/echappes.js : ligne 1',
      'src/csv/echappes.js : ligne 2',
      'src/csv/echappes.js : ligne 3',
      'src/interface/fiche/Inventee.svelte : ligne 3',
      'src/interface/fiche/Inventee.svelte : ligne 6',
    ]);
    // Ne sont pas des écarts : une division, un commentaire ou un texte qui
    // citent les séparateurs, une classe d'un seul séparateur, une alternance
    // dont les branches ne sont pas des séparateurs seuls, le texte d'un
    // composant hors de ses expressions.
    assert.deepEqual(
      ecartsALaRegleUnique([
        {
          chemin: 'src/interface/mesure.js',
          texte: [
            'const r = [a / 2, b / 3];',
            '// cellule.split(/[,;|]/) découperait ici',
            "const phrase = 'Séparez par une virgule, un point-virgule ; ou une barre |';",
            'const x = texte.split(/[,.]/);',
            'const y = /a,|;b/.test(texte);',
            "const z = `${r[0] / 2}, ${r[1] / 3}`;",
          ].join('\n'),
        },
        { chemin: 'src/interface/Aide.svelte', texte: "<p>Les mots se séparent par [, ; |], l'écran les découpe.</p>\n" },
      ]),
      [],
    );
    // Le module de la règle y échappe seul ; une découpe sur un autre
    // séparateur, ou l'import du nom, ne sont pas des écarts.
    assert.deepEqual(
      ecartsALaRegleUnique([
        { chemin: MODULE_DE_LA_REGLE, texte: "export const SEPARATEURS_ETIQUETTES = [',', ';'];\n" },
        { chemin: 'src/interface/palette.js', texte: "texte.split(';');\ntexte.split(',');\nchemin.split('/');\n" },
        { chemin: 'src/csv/import.js', texte: "import { SEPARATEURS_ETIQUETTES, lireEtiquettes } from '../stockage/etiquettes.js';\n" },
      ]),
      [],
    );
  });

  test('la garde relève tout emploi des séparateurs de la règle hors d’une clause d’import sans alias', () => {
    const IMPORT = "from '../stockage/etiquettes.js';";
    const inventees = [
      // Une source bâtie de la liste dans un gabarit, passée à RegExp
      // plus loin.
      {
        chemin: 'src/csv/gabarit.js',
        texte: `import { SEPARATEURS_ETIQUETTES } ${IMPORT}\nconst motif = \`[\${SEPARATEURS_ETIQUETTES}]\`;\nconst m = cellule.split(new RegExp(motif));\n`,
      },
      // La liste renommée à l'import, puis employée sous son alias.
      {
        chemin: 'src/csv/alias.js',
        texte: `import { SEPARATEURS_ETIQUETTES as S } ${IMPORT}\nconst m = cellule.split(new RegExp(\`[\${S.join('')}]\`));\n`,
      },
      // Une découpe caractère par caractère, sans expression.
      { chemin: 'src/csv/boucle.js', texte: 'for (const car of cellule) if (SEPARATEURS_ETIQUETTES.includes(car)) couper();\n' },
      // La liste lue par l'espace de noms du module.
      { chemin: 'src/application/espace.js', texte: `import * as regle ${IMPORT}\nconst coupe = (c) => regle.SEPARATEURS_ETIQUETTES.includes(c);\n` },
      // Une réexportation, renommée ou non, et un alias dans un import sur
      // plusieurs lignes.
      {
        chemin: 'src/csv/relais.js',
        texte: `export { SEPARATEURS_ETIQUETTES as COUPURES } ${IMPORT}\nexport { SEPARATEURS_ETIQUETTES } ${IMPORT}\nimport {\n  lireEtiquettes,\n  SEPARATEURS_ETIQUETTES as S,\n} ${IMPORT}\n`,
      },
    ];
    assert.deepEqual(ecartsALaRegleUnique(inventees), [
      'src/application/espace.js : ligne 2',
      'src/csv/alias.js : ligne 1',
      'src/csv/boucle.js : ligne 1',
      'src/csv/gabarit.js : ligne 2',
      'src/csv/relais.js : ligne 1',
      'src/csv/relais.js : ligne 2',
      'src/csv/relais.js : ligne 5',
    ]);
    // Ne sont pas des écarts : le nom dans une clause d'import sans alias,
    // sur une ou plusieurs lignes, à côté d'un import par défaut, et le nom
    // cité dans un commentaire ou un texte.
    assert.deepEqual(
      ecartsALaRegleUnique([
        {
          chemin: 'src/csv/lecteur.js',
          texte: [
            `import defaut, { SEPARATEURS_ETIQUETTES } ${IMPORT}`,
            'import {',
            '  lireEtiquettes,',
            '  SEPARATEURS_ETIQUETTES,',
            `} ${IMPORT}`,
            '// lireEtiquettes coupe aux SEPARATEURS_ETIQUETTES.',
            "const aide = 'voir SEPARATEURS_ETIQUETTES';",
            '',
          ].join('\n'),
        },
      ]),
      [],
    );
  });

  test('la garde ne voit pas ce que son commentaire nomme comme ses limites', () => {
    // Chaque forme découpe une liste d'étiquettes et passe la garde : une
    // expression qui ouvre une instruction après « ) », lue comme une
    // division ; des découpes enchaînées d'un séparateur chacune ; la liste
    // lue par une clé entre crochets. Une garde qui en relève une met ce
    // commentaire et celui d'ecartsALaRegleUnique à jour.
    const limites = [
      'if (ok) /[,;]/.test(x);',
      "const m = cellule.split(',').flatMap((x) => x.split(';'));",
      "const m = cellule.replaceAll(';', ',').replaceAll('|', ',').split(',');",
      "const s = regle['SEPARATEURS_ETIQUETTES'];",
    ];
    for (const texte of limites) assert.deepEqual(ecartsALaRegleUnique([{ chemin: 'src/csv/limite.js', texte }]), [], texte);
  });
});
