// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le rapport de l'audit par mutation (§ 14.13) : rediger rend le Markdown et
// le JSON d'un audit, sur des résultats inventés. Les modules nommés ici
// n'existent pas : rediger ne lit aucun fichier.
import assert from 'node:assert/strict';
import { VERSION } from '../../src/version.genere.js';
import { describe, test } from '../../test/lanceur.js';
import { rediger } from './rapport.js';

const ENTETE = Object.freeze({
  version: VERSION.affichee,
  perimetre: ['src/verger'],
  empreinte: 'a'.repeat(64),
  node: 'v26.1.0',
});

// Un mutant inventé, aux champs du contrat de mutants.js.
function mutant(fichier, ligne, operateur, original, remplacement, colonne = 5) {
  return {
    cle: `${fichier}:${operateur}:${ligne}${colonne}:0`,
    fichier,
    ligne,
    colonne,
    operateur,
    original,
    remplacement,
    debut: ligne * 100 + colonne,
    fin: ligne * 100 + colonne + original.length,
  };
}

const resultat = (m, issue, { couverte = true, longue = null, equivalent = null } = {}) => ({
  mutant: m,
  issue,
  couverte,
  longue,
  equivalent,
});

// Neuf résultats sur deux modules, dans le désordre :
//   pommes.js  arithmetique tué ; frontiere survivant couvert (l. 30) ;
//              negation survivant non couvert (l. 4) ; nombre-zero délai ;
//              si-vrai survivant équivalent
//   poires.js  arithmetique survivant couvert (l. 12), tué par la série
//              longue ; frontiere tué ; logique erreur ; frontiere survivant
//              couvert (l. 12, colonne 2)
const RESULTATS = Object.freeze([
  resultat(mutant('src/verger/pommes.js', 3, 'arithmetique', '+', '-'), 'tue'),
  resultat(mutant('src/verger/poires.js', 12, 'arithmetique', '*', '/'), 'survivant', { longue: 'tue' }),
  resultat(mutant('src/verger/pommes.js', 30, 'frontiere', '<', '<='), 'survivant', { longue: 'survivant' }),
  resultat(mutant('src/verger/pommes.js', 4, 'negation', '===', '!=='), 'survivant', { couverte: false }),
  resultat(mutant('src/verger/poires.js', 7, 'frontiere', '>', '>='), 'tue'),
  resultat(mutant('src/verger/pommes.js', 9, 'nombre-zero', '1', '0'), 'delai'),
  resultat(mutant('src/verger/poires.js', 20, 'logique', 'a && b', '((a )||( b))'), 'erreur'),
  resultat(mutant('src/verger/pommes.js', 15, 'si-vrai', 'n > 0', 'true'), 'survivant', {
    equivalent: 'le test est toujours vrai à cet endroit',
  }),
  resultat(mutant('src/verger/poires.js', 12, 'frontiere', '<=', '<', 2), 'survivant'),
]);

const lieux = (liste) => liste.map(({ fichier, ligne, colonne }) => `${fichier}:${ligne}:${colonne}`);

describe('rapport de mutation : les comptes', () => {
  const { json } = rediger({ entete: ENTETE, resultats: RESULTATS });
  const lu = JSON.parse(json);

  test('le bilan compte chaque issue, un survivant équivalent à part', () => {
    assert.deepEqual(lu.bilan, { total: 9, tues: 2, survivants: 4, equivalents: 1, delais: 1, erreurs: 1 });
  });

  test('par fichier, dans l’ordre des chemins', () => {
    assert.deepEqual(lu.parFichier, [
      { fichier: 'src/verger/poires.js', total: 4, tues: 1, survivants: 2, equivalents: 0, delais: 0, erreurs: 1 },
      { fichier: 'src/verger/pommes.js', total: 5, tues: 1, survivants: 2, equivalents: 1, delais: 1, erreurs: 0 },
    ]);
  });

  test('par opérateur, dans l’ordre d’OPERATEURS', () => {
    assert.deepEqual(lu.parOperateur, [
      { operateur: 'arithmetique', total: 2, tues: 1, survivants: 1, equivalents: 0, delais: 0, erreurs: 0 },
      { operateur: 'frontiere', total: 3, tues: 1, survivants: 2, equivalents: 0, delais: 0, erreurs: 0 },
      { operateur: 'negation', total: 1, tues: 0, survivants: 1, equivalents: 0, delais: 0, erreurs: 0 },
      { operateur: 'logique', total: 1, tues: 0, survivants: 0, equivalents: 0, delais: 0, erreurs: 1 },
      { operateur: 'nombre-zero', total: 1, tues: 0, survivants: 0, equivalents: 0, delais: 1, erreurs: 0 },
      { operateur: 'si-vrai', total: 1, tues: 0, survivants: 0, equivalents: 1, delais: 0, erreurs: 0 },
    ]);
  });

  test('le Markdown porte les mêmes comptes, en lignes de tableau', () => {
    const { markdown } = rediger({ entete: ENTETE, resultats: RESULTATS });
    const lignes = markdown.split('\n');
    assert.ok(lignes.includes('| 9 | 2 | 4 | 1 | 1 | 1 |'), 'ligne du bilan');
    assert.ok(lignes.includes('| `src/verger/poires.js` | 4 | 1 | 2 | 0 | 0 | 1 |'), 'ligne de poires.js');
    assert.ok(lignes.includes('| `src/verger/pommes.js` | 5 | 1 | 2 | 1 | 1 | 0 |'), 'ligne de pommes.js');
    assert.ok(lignes.includes('| frontiere | 3 | 1 | 2 | 0 | 0 | 0 |'), 'ligne de frontiere');
  });

  test('l’en-tête se recopie tel quel quand il ne nomme pas la machine', () => {
    assert.deepEqual(lu.entete, { ...ENTETE });
    const { markdown } = rediger({ entete: ENTETE, resultats: RESULTATS });
    for (const valeur of [ENTETE.version, ENTETE.empreinte, ENTETE.node, 'src/verger']) {
      assert.ok(markdown.includes(valeur), valeur);
    }
  });
});

describe('rapport de mutation : l’ordre', () => {
  const { json, markdown } = rediger({ entete: ENTETE, resultats: RESULTATS });
  const lu = JSON.parse(json);

  test('les survivants couverts d’abord, puis par fichier, ligne et colonne', () => {
    assert.deepEqual(lieux(lu.survivants), [
      'src/verger/poires.js:12:2',
      'src/verger/poires.js:12:5',
      'src/verger/pommes.js:30:5',
      'src/verger/pommes.js:4:5',
    ]);
    assert.deepEqual(
      lu.survivants.map(({ couverte, longue }) => [couverte, longue]),
      [
        [true, null],
        [true, 'tue'],
        [true, 'survivant'],
        [false, null],
      ],
    );
  });

  test('dans un même fichier, les lignes en ordre numérique : 9 avant 12', () => {
    // L'opérateur de la ligne 12 précède celui de la ligne 9 dans OPERATEURS,
    // et « 12 » précède « 9 » en ordre lexical : seul l'ordre numérique des
    // lignes met la ligne 9 en tête.
    const paire = [
      resultat(mutant('src/verger/pommes.js', 12, 'arithmetique', '+', '-'), 'survivant'),
      resultat(mutant('src/verger/pommes.js', 9, 'frontiere', '<', '<='), 'survivant'),
    ];
    for (const resultats of [paire, [...paire].reverse()]) {
      const { survivants } = JSON.parse(rediger({ entete: ENTETE, resultats }).json);
      assert.deepEqual(lieux(survivants), ['src/verger/pommes.js:9:5', 'src/verger/pommes.js:12:5']);
    }
  });

  test('le Markdown range les survivants dans le même ordre, l’équivalent dans sa section', () => {
    const rangs = lieux(lu.survivants).map((lieu) => markdown.indexOf(`\`${lieu}\``));
    assert.ok(rangs.every((rang) => rang > 0), 'chaque survivant est nommé');
    assert.deepEqual([...rangs].sort((a, b) => a - b), rangs);
    const section = markdown.indexOf('## Mutants équivalents');
    assert.ok(section > rangs.at(-1), 'la section des équivalents suit les survivants');
    assert.ok(markdown.indexOf('`src/verger/pommes.js:15:5`') > section);
    assert.ok(markdown.includes('le test est toujours vrai à cet endroit'));
  });

  test('équivalents, délais et erreurs sont listés à part, hors des survivants', () => {
    assert.deepEqual(lieux(lu.equivalents), ['src/verger/pommes.js:15:5']);
    assert.equal(lu.equivalents[0].raison, 'le test est toujours vrai à cet endroit');
    assert.deepEqual(
      lu.delaisEtErreurs.map((r) => `${r.fichier}:${r.ligne} ${r.issue}`),
      ['src/verger/poires.js:20 erreur', 'src/verger/pommes.js:9 delai'],
    );
  });

  test('l’ordre des résultats reçus ne change pas un octet de la sortie', () => {
    const renverse = rediger({ entete: ENTETE, resultats: [...RESULTATS].reverse() });
    assert.equal(renverse.markdown, markdown);
    assert.equal(renverse.json, json);
  });
});

describe('rapport de mutation : ce qu’il refuse', () => {
  test('des résultats vides ou absents', () => {
    assert.throws(() => rediger({ entete: ENTETE, resultats: [] }), /aucun résultat/);
    assert.throws(() => rediger({ entete: ENTETE }), /aucun résultat/);
  });

  test('aucune date ni heure dans le texte', () => {
    const { markdown, json } = rediger({ entete: ENTETE, resultats: RESULTATS });
    for (const texte of [markdown, json]) {
      assert.doesNotMatch(texte, /\d{4}-\d{2}-\d{2}/);
      assert.doesNotMatch(texte, /\d{1,2}:\d{2}:\d{2}/);
      assert.doesNotMatch(texte, /\b(?:date|instant|horodatage)\b/i);
    }
  });

  test('un en-tête qui nomme la machine : un nom d’hôte, un chemin de compte', () => {
    const refuse = (entete) =>
      assert.throws(() => rediger({ entete, resultats: RESULTATS }), /ne nomme pas sa machine/, JSON.stringify(entete));
    refuse({ ...ENTETE, hote: 'atelier-ombrelle' });
    refuse({ ...ENTETE, poste: 'atelier-ombrelle.local' });
    refuse({ ...ENTETE, node: 'atelier-ombrelle' });
    refuse({ ...ENTETE, node: '/home/exemple/.local/node/bin/node' });
    refuse({ ...ENTETE, perimetre: ['/home/exemple/verger/src/verger'] });
    refuse({ ...ENTETE, perimetre: ['C:\\Users\\exemple\\verger'] });
    refuse({ ...ENTETE, date: 'mardi' });
    refuse({ ...ENTETE, node: 'v26.0.0-/home/exemple' });
  });

  test('une version de Node avec un suffixe de préversion, sans blanc ni barre oblique', () => {
    for (const node of ['v26.0.0-rc.1', 'v27.0.0-pre']) {
      assert.equal(JSON.parse(rediger({ entete: { ...ENTETE, node }, resultats: RESULTATS }).json).entete.node, node);
    }
    for (const node of ['v26.0.0-rc 1', 'v26.0.0-a/b', 'v26.0.0-', 'v26.0.0+rc']) {
      assert.throws(() => rediger({ entete: { ...ENTETE, node }, resultats: RESULTATS }), /en-tête : node/, node);
    }
  });

  test('une version que la dérivation de scripts/version.js refuse', () => {
    const [annee, , , rang] = VERSION.affichee.split('.');
    for (const version of [[annee, '13', '45', rang].join('.'), `${VERSION.affichee}2`]) {
      assert.throws(() => rediger({ entete: { ...ENTETE, version }, resultats: RESULTATS }), /en-tête : version/, version);
    }
  });

  test('un en-tête incomplet ou d’une autre forme', () => {
    const refuse = (entete) => assert.throws(() => rediger({ entete, resultats: RESULTATS }), TypeError, JSON.stringify(entete));
    const { empreinte, ...sansEmpreinte } = ENTETE;
    assert.equal(empreinte.length, 64);
    refuse(sansEmpreinte);
    refuse({ ...ENTETE, empreinte: 'b'.repeat(63) });
    refuse({ ...ENTETE, version: 'v1' });
    refuse({ ...ENTETE, perimetre: [] });
    refuse({ ...ENTETE, perimetre: ['src/../verger'] });
    refuse(null);
  });

  test('un résultat d’une autre forme : issue, opérateur, chemin, équivalence, rejeu, clé', () => {
    const [premier, second] = RESULTATS;
    const refuse = (remplace, motif) =>
      assert.throws(() => rediger({ entete: ENTETE, resultats: [remplace, second] }), motif, JSON.stringify(remplace));
    refuse({ ...premier, issue: 'blesse' }, /issue/);
    refuse({ ...premier, mutant: { ...premier.mutant, operateur: 'inversion' } }, /opérateur/);
    refuse({ ...premier, mutant: { ...premier.mutant, fichier: '/home/exemple/verger/pommes.js' } }, /ne nomme pas sa machine/);
    refuse({ ...premier, mutant: { ...premier.mutant, fichier: '../verger/pommes.js' } }, /chemin/);
    refuse({ ...premier, mutant: { ...premier.mutant, ligne: 0 } }, /ligne/);
    refuse({ ...premier, equivalent: 'tué pourtant' }, /équivalent/);
    for (const equivalent of ['vu dans /home/exemple/notes.txt', 'vu dans C:\\Users\\exemple\\notes.txt']) {
      assert.throws(
        () => rediger({ entete: ENTETE, resultats: [{ ...RESULTATS[2], equivalent }, second] }),
        /ne nomme pas sa machine : chemin de compte dans résultat 0, équivalent/,
        equivalent,
      );
    }
    refuse({ ...premier, longue: 'tue' }, /série longue/);
    refuse({ ...premier, couverte: 'oui' }, /couverte/);
    refuse({ ...premier, mutant: { ...premier.mutant, cle: second.mutant.cle } }, /clé/);
  });
});

describe('rapport de mutation : les cellules de code', () => {
  test('une barre verticale s’échappe, un nœud sur plusieurs lignes tient sur une', () => {
    const resultats = [
      resultat(mutant('src/verger/pommes.js', 2, 'logique', 'a ||\n    b', '((a )&&(\n    b))'), 'survivant'),
      resultat(mutant('src/verger/pommes.js', 3, 'corps-si', `{ ${'x += 1; '.repeat(20)}}`, '{}'), 'survivant'),
    ];
    const { markdown, json } = rediger({ entete: ENTETE, resultats });
    const ligne = markdown.split('\n').find((l) => l.includes('`src/verger/pommes.js:2:5`'));
    assert.ok(ligne.includes('`a \\|\\| b`'), ligne);
    assert.ok(ligne.includes('`((a )&&( b))`'), ligne);
    const longue = markdown.split('\n').find((l) => l.includes('`src/verger/pommes.js:3:5`'));
    assert.ok(longue.includes('…`'), longue);
    assert.ok(longue.length < 200, longue);
    assert.equal(JSON.parse(json).survivants[0].original, 'a ||\n    b');
  });

  test('un accent grave dans le code garde la cellule entière', () => {
    const resultats = [resultat(mutant('src/verger/pommes.js', 2, 'logique', 'a && `x`', '((a )||( `x`))'), 'survivant')];
    const { markdown } = rediger({ entete: ENTETE, resultats });
    assert.ok(markdown.includes('`` a && `x` ``'), markdown);
  });
});
