// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// L'analyse de public/licences/TIERS.txt, dont le panneau « À propos » tire
// sa liste des composants tiers (§ 18.6). Le vrai fichier se lit par le
// disque : chaque ligne de son index a sa section, et le texte d'une entrée
// est le fichier de licence du paquet tel qu'il est installé. Des textes
// inventés éprouvent les refus. Les noms de composants sont inventés.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from '../../test/lanceur.js';
import { composantsDesTiers } from './tiers.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const lire = (...chemin) => readFileSync(join(RACINE, ...chemin), 'utf8');
const TIERS = lire('public', 'licences', 'TIERS.txt');
const OFL = lire('public', 'licences', 'NotoSans-OFL.txt');
const VOISINS = { 'NotoSans-OFL.txt': OFL };
// La version de svelte se lit dans son package.json installé : TIERS.txt se
// régénère à chaque mise à jour, et l'épreuve suit sans retouche.
const VERSION_SVELTE = JSON.parse(lire('node_modules', 'svelte', 'package.json')).version;
// Les autres versions, qu'aucun fichier installé ne porte, s'éprouvent par
// leur forme : un entier et trois chiffres pour la police, trois entiers
// pour une œuvre incorporée.
const VERSION_POLICE = /^\d+\.\d{3}$/;
const VERSION_SEMVER = /^\d+\.\d+\.\d+$/;

const FILET_EGAL = '='.repeat(72);
const FILET_TIRET = '-'.repeat(72);

// Un TIERS.txt inventé : un titre, un paragraphe, l'index de lignes donné,
// puis chaque section — ses lignes d'en-tête, le filet de « - », son corps —
// derrière le filet de 72 « = ».
function tiersInvente(index, sections) {
  const corps = sections.map(({ entete, texte }) => `${FILET_EGAL}\n${entete.join('\n')}\n${FILET_TIRET}\n${texte}\n`);
  return ['Avis des tiers d\u{2019}un logiciel inventé', '=====', '', 'Un paragraphe.', '', 'Index', '-----', ...index, '', corps.join('\n')].join('\n');
}

const INDEX_INVENTE = [
  'paquet-alpha 1.2.3 \u{2014} MIT \u{2014} paquet-alpha/LICENSE',
  'paquet-beta 0.4.0 \u{2014} ISC \u{2014} paquet-beta/LICENSE',
  '  incorporé à paquet-beta : oeuvre-gamma 2.0.1 \u{2014} Zlib',
  '  incorporé à paquet-beta : oeuvre delta sans version \u{2014} MIT, et BSD-2-Clause pour un fichier',
];
const SECTIONS_INVENTEES = [
  { entete: ['paquet : paquet-alpha 1.2.3', 'licence : MIT', 'texte : paquet-alpha/LICENSE'], texte: 'Texte alpha.' },
  { entete: ['paquet : paquet-beta 0.4.0', 'licence : ISC', 'texte : paquet-beta/LICENSE'], texte: 'Texte beta.' },
  {
    entete: ['incorporé à paquet-beta : oeuvre-gamma 2.0.1', 'licence : Zlib', 'texte : LICENSE amont'],
    texte: `  Texte gamma, en retrait.\n${'='.repeat(78)}\nSa propre règle, et un filet de tirets :\n${FILET_TIRET}\nfin gamma.`,
  },
  { entete: ['incorporé à paquet-beta : oeuvre delta sans version', 'licence : MIT', 'texte : en-tête du code'], texte: 'Texte delta.' },
];

describe('composantsDesTiers : le vrai TIERS.txt', () => {
  // L'analyse se fait dans chaque épreuve : une faute s'attribue à celle
  // qui la voit, non à la collecte du fichier.
  const lus = () => composantsDesTiers(TIERS, VOISINS);
  const trouver = (nom, hote = null) => lus().find((c) => c.nom === nom && c.hote === hote);

  test('une entrée par ligne d’index, dans son ordre : la police d’abord, son texte celui de NotoSans-OFL.txt', () => {
    const composants = lus();
    const debut = TIERS.indexOf('\nIndex\n-----\n') + '\nIndex\n-----\n'.length;
    const lignes = TIERS.slice(debut, TIERS.indexOf('\n\n', debut)).split('\n');
    assert.ok(lignes.length > 40, `${lignes.length} lignes d’index`);
    assert.equal(composants.length, lignes.length);
    assert.deepEqual(
      { ...composants[0], version: undefined },
      { cle: 'Noto Sans', nom: 'Noto Sans', version: undefined, licence: 'OFL-1.1', hote: null, texte: OFL },
    );
    assert.match(composants[0].version, VERSION_POLICE);
    assert.deepEqual(
      composants.map(({ nom, version, licence, hote }) =>
        hote === null ? `${nom} ${version}` : `  incorporé à ${hote} : ${version === null ? nom : `${nom} ${version}`} \u{2014} ${licence}`,
      ),
      lignes.map((ligne) => (ligne.startsWith('  ') ? ligne : ligne.split(' \u{2014} ')[0])),
    );
  });

  test('le texte d’un paquet est son fichier de licence tel qu’installé : svelte, highs', () => {
    assert.deepEqual(
      { ...trouver('svelte'), texte: trouver('svelte').texte.trim() },
      { cle: 'svelte', nom: 'svelte', version: VERSION_SVELTE, licence: 'MIT', hote: null, texte: lire('node_modules', 'svelte', 'LICENSE.md').trim() },
    );
    assert.equal(trouver('highs').texte.trim(), lire('node_modules', 'highs', 'LICENSE').trim());
    assert.equal(trouver('highs').texte, trouver('highs').texte.trimEnd());
  });

  test('une œuvre incorporée nomme son hôte ; sans version, version vaut null ; le texte de LLVM garde ses propres filets', () => {
    const composants = lus();
    assert.deepEqual(
      { ...trouver('HiGHS', 'highs'), version: undefined, texte: undefined },
      { cle: 'highs : HiGHS', nom: 'HiGHS', version: undefined, licence: 'MIT, IPX et basiclu compris', hote: 'highs', texte: undefined },
    );
    assert.match(trouver('HiGHS', 'highs').version, VERSION_SEMVER);
    assert.equal(trouver('cuPDLP-C', 'highs').version, null);
    assert.equal(trouver('@pdf-lib/brotli', '@pdf-lib/fontkit').licence, 'MIT, et Apache-2.0 pour le décodeur');
    // Une désignation qui finit par une parenthèse n'a pas de version, même
    // quand un chiffre ouvre son dernier mot.
    const llvm = composants.find((c) => c.hote === 'highs' && c.nom.startsWith('libc++'));
    assert.deepEqual([llvm.cle, llvm.version], [`highs : ${llvm.nom}`, null]);
    assert.match(llvm.nom, /^libc\+\+, libc\+\+abi et compiler-rt \(LLVM \d+\.\d+\.\d+\)$/);
    assert.ok(/^=+$/m.test(llvm.texte), 'les filets de LLVM manquent à son texte');
    assert.ok(llvm.texte.includes('Apache License') && llvm.texte.includes('LLVM Exceptions'), 'texte de LLVM tronqué');
    // La section de pako porte un filet de tirets dans son corps.
    assert.ok(trouver('pako').texte.includes(`\n${FILET_TIRET}\n`), 'le corps de pako coupé à son second filet');
  });

  test('chaque hôte est un paquet de la liste, chaque clé est unique, et aucun texte n’est vide', () => {
    const composants = lus();
    const paquets = new Set(composants.filter((c) => c.hote === null).map((c) => c.nom));
    assert.deepEqual(composants.filter((c) => c.hote !== null && !paquets.has(c.hote)), []);
    assert.equal(new Set(composants.map((c) => c.cle)).size, composants.length);
    assert.deepEqual(composants.filter((c) => c.texte.trim() === '').map((c) => c.cle), []);
    assert.ok(composants.some((c) => c.hote === '@pdf-lib/fontkit') && composants.some((c) => c.hote === 'highs'));
  });

  test('sans le texte de la police à côté, la ligne d’index de Noto Sans, qui n’a pas de section, lève', () => {
    assert.throws(() => composantsDesTiers(TIERS), /Noto Sans/);
  });
});

describe('composantsDesTiers : des textes inventés', () => {
  test('rend les entrées dans l’ordre de l’index ; le corps d’une section va jusqu’au filet suivant, ses propres filets compris', () => {
    assert.deepEqual(composantsDesTiers(tiersInvente(INDEX_INVENTE, SECTIONS_INVENTEES)), [
      { cle: 'paquet-alpha', nom: 'paquet-alpha', version: '1.2.3', licence: 'MIT', hote: null, texte: 'Texte alpha.' },
      { cle: 'paquet-beta', nom: 'paquet-beta', version: '0.4.0', licence: 'ISC', hote: null, texte: 'Texte beta.' },
      { cle: 'paquet-beta : oeuvre-gamma', nom: 'oeuvre-gamma', version: '2.0.1', licence: 'Zlib', hote: 'paquet-beta', texte: SECTIONS_INVENTEES[2].texte },
      {
        cle: 'paquet-beta : oeuvre delta sans version',
        nom: 'oeuvre delta sans version',
        version: null,
        licence: 'MIT, et BSD-2-Clause pour un fichier',
        hote: 'paquet-beta',
        texte: 'Texte delta.',
      },
    ]);
  });

  test('un paquet sans section prend le texte voisin que nomme sa ligne d’index ; le voisin ne vaut que pour une clé propre', () => {
    const index = ['police-epsilon 3.1 \u{2014} OFL-1.1 \u{2014} epsilon.txt', ...INDEX_INVENTE];
    const [police] = composantsDesTiers(tiersInvente(index, SECTIONS_INVENTEES), { 'epsilon.txt': 'Texte epsilon.' });
    assert.deepEqual(police, { cle: 'police-epsilon', nom: 'police-epsilon', version: '3.1', licence: 'OFL-1.1', hote: null, texte: 'Texte epsilon.' });
    const heritee = ['outil 1.0 \u{2014} MIT \u{2014} toString', ...INDEX_INVENTE];
    assert.throws(() => composantsDesTiers(tiersInvente(heritee, SECTIONS_INVENTEES), {}), /outil/);
  });

  test('une ligne d’index sans section, une section sans ligne d’index, une section en double, ou deux versions d’un même paquet lève', () => {
    assert.throws(() => composantsDesTiers(tiersInvente(INDEX_INVENTE, SECTIONS_INVENTEES.slice(0, 3))), /oeuvre delta/);
    assert.throws(() => composantsDesTiers(tiersInvente(INDEX_INVENTE.slice(0, 3), SECTIONS_INVENTEES)), /oeuvre delta/);
    assert.throws(() => composantsDesTiers(tiersInvente(INDEX_INVENTE, [...SECTIONS_INVENTEES, SECTIONS_INVENTEES[0]])), /paquet-alpha/);
    assert.throws(() => composantsDesTiers(tiersInvente([...INDEX_INVENTE, INDEX_INVENTE[0]], SECTIONS_INVENTEES)), /paquet-alpha/);
    // Deux versions de paquet-alpha, chacune avec sa section : la clé, son
    // seul nom, se répète.
    const autreVersion = 'paquet-alpha 2.0.0 \u{2014} MIT \u{2014} paquet-alpha/LICENSE';
    const saSection = { entete: ['paquet : paquet-alpha 2.0.0', 'licence : MIT', 'texte : paquet-alpha/LICENSE'], texte: 'Texte alpha 2.' };
    assert.throws(
      () => composantsDesTiers(tiersInvente([...INDEX_INVENTE, autreVersion], [...SECTIONS_INVENTEES, saSection])),
      /ligne d'index en double "paquet-alpha"/,
    );
  });

  test('un hôte qui n’est pas un paquet de l’index, une ligne d’index mal formée, ou un paquet sans version lève', () => {
    const remplacer = (rang, ligne) => INDEX_INVENTE.map((l, i) => (i === rang ? ligne : l));
    const orpheline = remplacer(2, '  incorporé à paquet-inconnu : oeuvre-gamma 2.0.1 \u{2014} Zlib');
    const sections = SECTIONS_INVENTEES.map((s, i) => (i === 2 ? { ...s, entete: ['incorporé à paquet-inconnu : oeuvre-gamma 2.0.1'] } : s));
    assert.throws(() => composantsDesTiers(tiersInvente(orpheline, sections)), /paquet-inconnu/);
    for (const ligne of [
      'paquet-alpha 1.2.3 \u{2014} MIT',
      'paquet-alpha 1.2.3 \u{2014} MIT \u{2014} LICENSE \u{2014} de trop',
      '  incorporé à paquet-beta : oeuvre-gamma 2.0.1',
      'paquet-alpha \u{2014} MIT \u{2014} paquet-alpha/LICENSE',
    ]) {
      assert.throws(() => composantsDesTiers(tiersInvente(remplacer(0, ligne), SECTIONS_INVENTEES)), SyntaxError, ligne);
    }
  });

  test('un texte sans index, une section sans filet de tirets ou d’un en-tête inconnu lève SyntaxError', () => {
    assert.throws(() => composantsDesTiers(tiersInvente([], [])), SyntaxError);
    assert.throws(() => composantsDesTiers('Avis\n\nAucun index ici.\n'), SyntaxError);
    const sansTirets = tiersInvente(INDEX_INVENTE, SECTIONS_INVENTEES).replace(`texte : paquet-alpha/LICENSE\n${FILET_TIRET}\n`, 'texte : paquet-alpha/LICENSE\n');
    assert.throws(() => composantsDesTiers(sansTirets), SyntaxError);
    const inconnu = SECTIONS_INVENTEES.map((s, i) => (i === 0 ? { ...s, entete: ['module : paquet-alpha 1.2.3'] } : s));
    assert.throws(() => composantsDesTiers(tiersInvente(INDEX_INVENTE, inconnu)), SyntaxError);
  });
});
