// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Garde des noms forgés (§ 14.9, § 15.6) : aucun patronyme forgé complet, nom
// long compris, ni aucune racine d'organisation n'apparaît en mot entier dans
// un fichier texte du projet hors de src/demo/noms.js, qui les définit. Les
// données d'épreuve de test/fixtures/ sont balayées comme le reste.
//
// Un mot entier est bordé, de chaque côté, par autre chose qu'une lettre, une
// marque combinante ou un chiffre : le trait de soulignement et le trait
// d'union séparent deux mots. La comparaison ignore la casse et se fait sur
// le texte normalisé en NFC. Un fichier qui porte un octet nul dans ses
// 8000 premiers octets est binaire et n'est pas examiné, comme le décide git.
//
// Le balayage s'éprouve sur un arbre témoin avant de s'appliquer au projet.
// Chaque fichier de l'arbre exerce une règle : une sonde de test/fixtures/
// porte chaque nom cherché ; d'autres placent un nom au-delà du premier Mio
// du texte, en NFD, après un octet nul, dans une entrée cachée, dans un
// noms.js qui n'est pas celui des listes, ou sous un répertoire exclu ; trois
// derniers se lisent malgré un nom voisin d'une exclusion : src/distances/,
// distinctes.js et un fichier .git. L'épreuve affirme les fichiers lus, le
// compte exact des trouvailles, et que la garde de l'épreuve du projet
// désigne exactement les fichiers placés sous un répertoire exclu.
//
// L'épreuve établit l'absence dans ce projet, rien sur le monde réel : aucune
// vérification locale ne prouve qu'un nom forgé ne désigne nulle part une
// personne ou une organisation existante.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from '../../test/lanceur.js';
import { NOMS_LONGS, RACINES, patronymes } from './noms.js';

const RACINE = fileURLToPath(new URL('../..', import.meta.url));
const LISTES = join('src', 'demo', 'noms.js');

// Répertoires hors balayage, à toute profondeur : .git, les dépendances, les
// caches des outils, et les sorties de construction, qui portent une copie
// des listes mises en paquet (www, dist et chaque dist-…, plateformes de
// Capacitor). Un répertoire s'exclut par son nom exact, ou par le préfixe
// « dist- » : src/distances/ se balaie comme le reste. Un fichier ne
// s'exclut jamais par son nom : un module distinctes.js se lit, comme le
// fichier .git que porte un arbre de travail lié de git.
const HORS_BALAYAGE = new Set([
  '.git', 'node_modules', 'www', 'dist', 'android', 'ios', 'coverage', '.vite', '.vitest',
]);
const horsBalayage = (nom) => HORS_BALAYAGE.has(nom) || nom.startsWith('dist-');

// Vrai quand un répertoire du chemin relatif est hors balayage ; le nom du
// fichier, dernier composant, n'entre pas en compte.
const sousUnRepertoireExclu = (chemin) => chemin.split(/[\\/]/).slice(0, -1).some(horsBalayage);

// Noms cherchés : chaque patronyme forgé, chaque nom long et chaque racine
// d'organisation.
const nomsCherches = () => [...patronymes(), ...NOMS_LONGS, ...RACINES];

// Fichiers de l'arbre de racine, hors des répertoires exclus, en chemins
// relatifs à racine, triés.
function fichiers(racine) {
  const chemins = [];
  const parcourir = (dossier) => {
    for (const entree of readdirSync(dossier, { withFileTypes: true })) {
      const chemin = join(dossier, entree.name);
      if (entree.isDirectory()) {
        if (!horsBalayage(entree.name)) parcourir(chemin);
      } else if (entree.isFile()) {
        chemins.push(relative(racine, chemin));
      }
    }
  };
  parcourir(racine);
  return chemins.sort();
}

const estBinaire = (octets) => octets.subarray(0, 8000).includes(0);

const echapper = (texte) => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Motif qui trouve chacun des noms en mot entier, sans égard à la casse.
function motifDes(noms) {
  const alternatives = noms.map((nom) => echapper(nom.normalize('NFC'))).join('|');
  return new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])(?:${alternatives})(?![\\p{L}\\p{M}\\p{N}])`, 'giu');
}

// Occurrences du motif dans un texte, normalisé en NFC.
const occurrences = (motif, texte) => [...texte.normalize('NFC').matchAll(motif)].map(([mot]) => mot);

// Balaie l'arbre de racine : chaque fichier texte hors des répertoires exclus
// et des listes du générateur se lit en entier, décodé en UTF-8, et chaque
// nom cherché s'y relève. Rend les chemins examinés, relatifs à racine et
// triés, et les trouvailles { chemin, mot }, fichier après fichier, dans
// l'ordre du texte.
function balayer(racine) {
  const motif = motifDes(nomsCherches());
  const examines = [];
  const trouvailles = [];
  for (const chemin of fichiers(racine)) {
    if (chemin === LISTES) continue;
    const octets = readFileSync(join(racine, chemin));
    if (estBinaire(octets)) continue;
    examines.push(chemin);
    for (const mot of occurrences(motif, octets.toString('utf8'))) trouvailles.push({ chemin, mot });
  }
  return { examines, trouvailles };
}

// Écrit dans un répertoire temporaire l'arbre donné, liste de paires [chemin
// relatif, contenu], le passe à examiner, puis l'efface ; rend ce que rend
// examiner.
function avecArbre(arbre, examiner) {
  const racine = mkdtempSync(join(tmpdir(), 'noms-forges-'));
  try {
    for (const [chemin, contenu] of arbre) {
      mkdirSync(dirname(join(racine, chemin)), { recursive: true });
      writeFileSync(join(racine, chemin), contenu);
    }
    return examiner(racine);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
}

// Contenu dont l'octet d'indice indice est nul : des points jusqu'à lui, puis
// le nom sur la ligne suivante.
const nulA = (indice, nom) => Buffer.concat([Buffer.alloc(indice, '.'), Buffer.from(`\0\n${nom}\n`)]);

describe('noms forgés : balayage du projet (§ 15.6)', () => {
  test('le motif trouve un nom forgé en mot entier, quelles que soient la casse et la forme normale', () => {
    const [patronyme] = patronymes();
    const [racine] = RACINES;
    const long = NOMS_LONGS[1];
    const motif = motifDes([patronyme, racine, long]);
    // [texte, occurrences attendues]
    const cas = [
      [`« ${patronyme} »`, [patronyme]],
      [`${patronyme.toUpperCase()},`, [patronyme.toUpperCase()]],
      [`x_${racine}-y`, [racine]],
      [long.normalize('NFD'), [long]],
      [`x${patronyme}`, []],
      [`${racine}s`, []],
      [`${patronyme}2`, []],
    ];
    const ecarts = cas
      .filter(([texte, attendu]) => occurrences(motif, texte).join('|') !== attendu.join('|'))
      .map(([texte]) => texte);
    assert.deepEqual(ecarts, []);
  });

  test('arbre témoin : chaque nom trouvé, tout fichier texte lu en entier, seules les exclusions sautées', () => {
    // Les noms attendus se calculent ici, sans nomsCherches : la sonde de
    // test/fixtures/ en porte un par ligne, et chaque ligne doit être trouvée.
    const noms = [...patronymes(), ...NOMS_LONGS, ...RACINES];
    assert.ok(
      patronymes().length > 0 && NOMS_LONGS.length > 0 && RACINES.length > 0,
      'aucun nom forgé à chercher',
    );
    const [patronyme] = patronymes();
    const enCapitales = RACINES[RACINES.length - 1].toUpperCase();
    const sonde = join('test', 'fixtures', 'sonde.csv');
    // [chemin, contenu, mots] : les fichiers lus, et les mots que le balayage
    // doit y relever, dans l'ordre du texte.
    const lus = [
      [sonde, `${noms.join('\n')}\n`, noms],
      // Au-delà du premier Mio : une lecture tronquée le manque.
      [join('docs', 'loin.md'), `${'.'.repeat(2 ** 20)}\n${enCapitales}\n`, [enCapitales]],
      ['nfd.txt', `${NOMS_LONGS[1].normalize('NFD')}\n`, [NOMS_LONGS[1]]],
      ['nul-dehors.dat', nulA(8000, patronyme), [patronyme]],
      // Une entrée cachée se lit, fichier ou répertoire.
      ['.editorconfig', patronyme, [patronyme]],
      [join('.github', 'x.yml'), patronyme, [patronyme]],
      // Les listes s'excluent par leur chemin, non par leur nom de fichier.
      [join('autre', 'noms.js'), patronyme, [patronyme]],
      // Un répertoire dont le nom commence comme celui d'un exclu se balaie,
      // et un fichier ne s'exclut jamais par son nom : un arbre de travail lié
      // de git porte un fichier .git.
      [join('src', 'distances', 'a.js'), patronyme, [patronyme]],
      [join('src', 'distinctes.js'), 'paires distinctes\n', []],
      [join('sous', '.git'), 'gitdir: ../.git/worktrees/sous\n', []],
    ];
    // [chemin, contenu] : les fichiers que le balayage saute — un octet nul
    // dans les 8000 premiers, les listes du générateur.
    const sautes = [
      ['nul-dedans.dat', nulA(7999, patronyme)],
      [LISTES, patronyme],
    ];
    // Un fichier sous chaque répertoire exclu, à la racine et plus profond ;
    // chacun porte un nom forgé.
    const exclus = [
      join('node_modules', 'p', 'i.js'),
      join('sous', 'node_modules', 'p', 'i.js'),
      join('www', 'i.js'),
      join('dist', 'i.js'),
      join('dist-x', 'i.js'),
      join('android', 'i.js'),
      join('ios', 'i.js'),
      join('coverage', 'i.html'),
      join('.git', 'i'),
      join('.vite', 'i.js'),
      join('.vitest', 'i.json'),
    ];
    const arbre = [
      ...lus.map(([chemin, contenu]) => [chemin, contenu]),
      ...sautes,
      ...exclus.map((chemin) => [chemin, patronyme]),
    ];
    const { examines, trouvailles } = avecArbre(arbre, balayer);
    const attendus = [...lus].sort(([a], [b]) => (a < b ? -1 : 1));
    // Chaque fichier lu, et lui seul, avec le compte de ses trouvailles : un
    // écart s'affiche en chemins et en comptes.
    assert.deepEqual(
      examines.map((chemin) => [chemin, trouvailles.filter((t) => t.chemin === chemin).length]),
      attendus.map(([chemin, , mots]) => [chemin, mots.length]),
    );
    assert.equal(trouvailles.length, attendus.reduce((total, [, , mots]) => total + mots.length, 0));
    // Hors de la sonde, chaque mot tel que l'écrit le texte normalisé.
    assert.deepEqual(
      trouvailles.filter((t) => t.chemin !== sonde).map((t) => t.mot),
      attendus.filter(([chemin]) => chemin !== sonde).flatMap(([, , mots]) => mots),
    );
    // La garde de l'épreuve du projet désigne exactement les fichiers placés
    // sous un répertoire exclu.
    assert.deepEqual(arbre.map(([chemin]) => chemin).filter(sousUnRepertoireExclu), exclus);
  });

  test('aucun patronyme forgé ni aucune racine hors de src/demo/noms.js', () => {
    assert.ok(nomsCherches().length > 0, 'aucun nom forgé à chercher');
    const { examines, trouvailles } = balayer(RACINE);
    assert.ok(examines.length > 0, 'balayage vide');
    assert.ok(examines.includes(join('src', 'demo', 'catalogue.js')), 'src/demo/catalogue.js non balayé');
    assert.deepEqual(examines.filter(sousUnRepertoireExclu), []);
    assert.deepEqual(trouvailles.map(({ chemin, mot }) => `${chemin} : ${mot}`), []);
  });
});
