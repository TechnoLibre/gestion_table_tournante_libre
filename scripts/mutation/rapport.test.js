// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le rapport de l'audit par mutation (§ 14.13) : rediger rend le Markdown et
// le JSON d'un audit, sur des résultats inventés. Les modules nommés ici
// n'existent pas : rediger ne lit aucun fichier. La dernière partie lit, elle,
// les trois fichiers committés d'audit/, comme du texte, sans importer
// audit.js.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION } from '../../src/version.genere.js';
import { describe, test } from '../../test/lanceur.js';
import { equivalentsDe, rediger, relire } from './rapport.js';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));

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
//              longue, donc compté à part des survivants ; frontiere tué ;
//              logique erreur ; frontiere survivant couvert (l. 12,
//              colonne 2)
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

  test('le bilan compte chaque issue ; un survivant que la série longue tue, et un équivalent, à part', () => {
    assert.deepEqual(lu.bilan, { total: 9, tues: 2, tuesSerieLongue: 1, survivants: 3, equivalents: 1, delais: 1, erreurs: 1 });
  });

  test('par fichier, dans l’ordre des chemins', () => {
    assert.deepEqual(lu.parFichier, [
      { fichier: 'src/verger/poires.js', total: 4, tues: 1, tuesSerieLongue: 1, survivants: 1, equivalents: 0, delais: 0, erreurs: 1 },
      { fichier: 'src/verger/pommes.js', total: 5, tues: 1, tuesSerieLongue: 0, survivants: 2, equivalents: 1, delais: 1, erreurs: 0 },
    ]);
  });

  test('par opérateur, dans l’ordre d’OPERATEURS', () => {
    const vide = { tues: 0, tuesSerieLongue: 0, survivants: 0, equivalents: 0, delais: 0, erreurs: 0 };
    assert.deepEqual(lu.parOperateur, [
      { operateur: 'arithmetique', total: 2, ...vide, tues: 1, tuesSerieLongue: 1 },
      { operateur: 'frontiere', total: 3, ...vide, tues: 1, survivants: 2 },
      { operateur: 'negation', total: 1, ...vide, survivants: 1 },
      { operateur: 'logique', total: 1, ...vide, erreurs: 1 },
      { operateur: 'nombre-zero', total: 1, ...vide, delais: 1 },
      { operateur: 'si-vrai', total: 1, ...vide, equivalents: 1 },
    ]);
  });

  test('le Markdown porte les mêmes comptes, en lignes de tableau', () => {
    const { markdown } = rediger({ entete: ENTETE, resultats: RESULTATS });
    const lignes = markdown.split('\n');
    assert.ok(lignes.includes('| mutants | tués | tués par la série longue | survivants | équivalents | délais | erreurs |'), 'en-tête du bilan');
    assert.ok(lignes.includes('| 9 | 2 | 1 | 3 | 1 | 1 | 1 |'), 'ligne du bilan');
    assert.ok(lignes.includes('| `src/verger/poires.js` | 4 | 1 | 1 | 1 | 0 | 0 | 1 |'), 'ligne de poires.js');
    assert.ok(lignes.includes('| `src/verger/pommes.js` | 5 | 1 | 0 | 2 | 1 | 1 | 0 |'), 'ligne de pommes.js');
    assert.ok(lignes.includes('| frontiere | 3 | 1 | 0 | 2 | 0 | 0 | 0 |'), 'ligne de frontiere');
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
    assert.deepEqual(lieux(lu.survivants), ['src/verger/poires.js:12:2', 'src/verger/pommes.js:30:5', 'src/verger/pommes.js:4:5']);
    assert.deepEqual(
      lu.survivants.map(({ couverte, longue }) => [couverte, longue]),
      [
        [true, null],
        [true, 'survivant'],
        [false, null],
      ],
    );
  });

  test('un survivant que la série longue tue se liste à part, entre les survivants et les équivalents', () => {
    assert.deepEqual(
      lu.tuesSerieLongue.map((r) => [`${r.fichier}:${r.ligne}:${r.colonne}`, r.couverte, r.longue]),
      [['src/verger/poires.js:12:5', true, 'tue']],
    );
    const section = (titre) => markdown.indexOf(`\n## ${titre}`);
    const ici = markdown.indexOf('`src/verger/poires.js:12:5`');
    assert.ok(section('Survivants (3)') > 0, 'trois survivants annoncés');
    assert.ok(section('Tués par la série longue (1)') > section('Survivants (3)'), 'la section suit les survivants');
    assert.ok(ici > section('Tués par la série longue (1)') && ici < section('Mutants équivalents (1)'), 'le mutant est dans sa section');
    assert.equal(markdown.indexOf('`src/verger/poires.js:12:5`', ici + 1), -1, 'et nulle part ailleurs');
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
    assert.throws(
      () => rediger({ entete: ENTETE, resultats: [{ ...RESULTATS[1], equivalent: 'déclaré à tort' }] }),
      /équivalent/,
      'un survivant que la série longue tue n’est pas équivalent',
    );
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

describe('rapport de mutation : la relecture du JSON écrit', () => {
  const ecrit = rediger({ entete: ENTETE, resultats: RESULTATS });
  // Le JSON écrit, modifié par changer sur sa forme lue, réécrit comme
  // rediger l'écrit.
  const modifie = (changer) => {
    const lu = JSON.parse(ecrit.json);
    changer(lu);
    return `${JSON.stringify(lu, null, 2)}\n`;
  };

  test('relire rend le Markdown que rediger a écrit, octet pour octet', () => {
    const relu = relire(ecrit.json);
    assert.equal(relu.markdown, ecrit.markdown);
    assert.deepEqual(relu.donnees, JSON.parse(ecrit.json));
  });

  test('relire refuse un JSON réindenté, un en-tête qui nomme la machine, des comptes contraires aux listes', () => {
    assert.throws(() => relire(JSON.stringify(JSON.parse(ecrit.json))), /forme/);
    assert.throws(() => relire('{'), /illisible/);
    assert.throws(() => relire(modifie((lu) => Object.assign(lu.entete, { hote: 'atelier-ombrelle' }))), /ne nomme pas sa machine/);
    assert.throws(() => relire(modifie((lu) => Object.assign(lu, { format: 2 }))), /format/);
    assert.throws(() => relire(modifie((lu) => (lu.bilan.survivants += 1))), /bilan/);
    assert.throws(() => relire(modifie((lu) => (lu.parFichier[0].tues += 1))), /par fichier/);
    assert.throws(() => relire(modifie((lu) => (lu.parOperateur[0].tues += 1))), /par opérateur/);
  });

  test('relire refuse un survivant que la série longue tue, laissé parmi les survivants', () => {
    // L'ancien compte : le mutant tué par la série longue rangé avec les
    // survivants, bilan, fichier et opérateur ajustés pour que seuls les
    // listes et la règle du compte le trahissent.
    const ancien = modifie((lu) => {
      lu.survivants.splice(1, 0, ...lu.tuesSerieLongue.splice(0));
      for (const compte of [lu.bilan, lu.parFichier[0], lu.parOperateur[0]]) {
        compte.survivants += 1;
        compte.tuesSerieLongue -= 1;
      }
    });
    assert.throws(() => relire(ancien), /série longue/);
  });
});

describe('rapport de mutation : les équivalents déclarés', () => {
  const texte = (liste) => `${JSON.stringify(liste, null, 2)}\n`;
  const CLE = 'src/verger/pommes.js:si-vrai:00000000000000aa:0';

  test('equivalentsDe rend chaque clé avec sa raison, dans l’ordre du fichier', () => {
    const lus = equivalentsDe(texte([{ cle: CLE, raison: 'toujours vrai ici' }, { cle: `${CLE}1`, raison: 'idem' }]));
    assert.deepEqual([...lus], [
      [CLE, 'toujours vrai ici'],
      [`${CLE}1`, 'idem'],
    ]);
    assert.deepEqual([...equivalentsDe('[]\n')], []);
  });

  test('equivalentsDe refuse un texte illisible, une autre forme, une raison vide, une clé en double, un chemin de compte', () => {
    assert.throws(() => equivalentsDe('['), /illisible/);
    assert.throws(() => equivalentsDe('{}'), /liste de \{ cle, raison \}/);
    assert.throws(() => equivalentsDe(texte([{ cle: CLE }])), new RegExp(`raison.*${CLE}`));
    assert.throws(() => equivalentsDe(texte([{ cle: CLE, raison: '' }])), new RegExp(`raison.*${CLE}`));
    assert.throws(() => equivalentsDe(texte([{ cle: '', raison: 'x' }])), /clé/);
    assert.throws(() => equivalentsDe(texte([null])), /liste de \{ cle, raison \}/);
    assert.throws(
      () => equivalentsDe(texte([{ cle: CLE, raison: 'a' }, { cle: CLE, raison: 'b' }])),
      new RegExp(`en double.*${CLE}`),
    );
    assert.throws(() => equivalentsDe(texte([{ cle: CLE, raison: 'lu dans /home/exemple/notes' }])), /ne nomme pas sa machine/);
  });
});

// Les fautes des trois fichiers d'audit/, lus comme du texte : un JSON que
// relire accepte, au périmètre du moteur seul ; le Markdown que sa
// composition rejoue ; les équivalents déclarés, exactement ceux que le JSON
// range à part, chacun avec la même raison. Une liste vide quand tout
// s'accorde.
function fautesAudit({ markdown, json, equivalents }) {
  let relu;
  try {
    relu = relire(json);
  } catch (erreur) {
    return [`mutation-moteur.json : ${erreur.message}`];
  }
  const fautes = [];
  const { perimetre } = relu.donnees.entete;
  if (perimetre.length !== 1 || perimetre[0] !== 'src/moteur') fautes.push(`périmètre ${perimetre.join(', ')} : src/moteur seul attendu`);
  if (markdown !== relu.markdown) fautes.push('mutation-moteur.md : autre que le Markdown que rediger rejoue');
  let declares;
  try {
    declares = equivalentsDe(equivalents);
  } catch (erreur) {
    return [...fautes, `mutants-equivalents.json : ${erreur.message}`];
  }
  const ranges = new Map(relu.donnees.equivalents.map(({ cle, raison }) => [cle, raison]));
  for (const [cle, raison] of declares) {
    if (!ranges.has(cle)) fautes.push(`mutants-equivalents.json : clé inconnue du JSON, ${cle}`);
    else if (ranges.get(cle) !== raison) fautes.push(`mutants-equivalents.json : raison autre que celle du JSON, ${cle}`);
  }
  for (const cle of ranges.keys()) {
    if (!declares.has(cle)) fautes.push(`mutation-moteur.json : équivalent non déclaré, ${cle}`);
  }
  return fautes;
}

describe('rapport de mutation : audit/ committé (§ 14.13)', () => {
  const lire = (fichier) => readFileSync(join(RACINE, 'audit', fichier), 'utf8');
  const COMMITTE = Object.freeze({
    markdown: lire('mutation-moteur.md'),
    json: lire('mutation-moteur.json'),
    equivalents: lire('mutants-equivalents.json'),
  });

  test('audit/ committé : l’en-tête passe verifierEntete, le Markdown est celui que rediger rejoue, chaque équivalent a une clé unique et une raison non vide, connue du JSON', () => {
    assert.deepEqual(fautesAudit(COMMITTE), []);
    assert.deepEqual(relire(COMMITTE.json).donnees.entete.perimetre, ['src/moteur']);
    assert.ok(equivalentsDe(COMMITTE.equivalents).size > 0, 'des équivalents déclarés');
  });

  test('la garde relève, en mémoire, une raison vidée, une clé inconnue, un Markdown retouché, un périmètre élargi', () => {
    const liste = JSON.parse(COMMITTE.equivalents);
    const premiere = liste[0].cle;
    const videe = `${JSON.stringify([{ ...liste[0], raison: '' }, ...liste.slice(1)], null, 2)}\n`;
    assert.deepEqual(fautesAudit({ ...COMMITTE, equivalents: videe }), [
      `mutants-equivalents.json : liste de { cle, raison }, raison vide pour ${premiere}`,
    ]);
    const inconnue = 'src/moteur/inventee.js:frontiere:0123456789abcdef:0';
    const ajoutee = `${JSON.stringify([...liste, { cle: inconnue, raison: 'une clé que nul audit n’a rendue' }], null, 2)}\n`;
    assert.deepEqual(fautesAudit({ ...COMMITTE, equivalents: ajoutee }), [`mutants-equivalents.json : clé inconnue du JSON, ${inconnue}`]);
    assert.deepEqual(fautesAudit({ ...COMMITTE, markdown: COMMITTE.markdown.replace('## Bilan', '## Bilan retouché') }), [
      'mutation-moteur.md : autre que le Markdown que rediger rejoue',
    ]);
    const elargi = COMMITTE.json.replace('"src/moteur"\n', '"src/moteur",\n      "src/application"\n');
    assert.notEqual(elargi, COMMITTE.json);
    assert.deepEqual(fautesAudit({ ...COMMITTE, json: elargi }), [
      'périmètre src/moteur, src/application : src/moteur seul attendu',
      'mutation-moteur.md : autre que le Markdown que rediger rejoue',
    ]);
  });
});
