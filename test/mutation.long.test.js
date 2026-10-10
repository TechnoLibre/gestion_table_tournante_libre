// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'exécution d'un mutant (§ 14.13), sur le module inventé de
// test/fixtures/mutation/ et son épreuve, jouée sous le repli node --test
// (§ 14.8) : les quatre issues — tué, survivant, délai, erreur. Chaque cas
// lance de vrais processus de Node, d'où sa place hors de la série
// surveillée (§ 14.14). Le cas du délai vérifie qu'aucun processus de
// l'épreuve ne reste après le délai, groupe entier compris.
//
// Puis l'audit entier, en ligne de commande : node scripts/mutation/audit.js
// dans un processus fils, sur un petit arbre planté dans un dossier
// temporaire — les scripts de l'audit recopiés, le module inventé de
// test/fixtures/mutation/arbre/ en src/moteur, une épreuve node qui laisse
// survivre des mutants, une épreuve longue qui en tue. Aucune épreuve
// n'importe audit.js (audit.test.js) : le processus fils l'exécute tel que
// make mutation le lance, sa racine étant celle de l'arbre.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executerMutant } from '../scripts/mutation/executer.js';
import { mutants } from '../scripts/mutation/mutants.js';
import { relire } from '../scripts/mutation/rapport.js';
import { describe, test } from './lanceur.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const MODULE = 'test/fixtures/mutation/calcul.js';
const EPREUVE = 'test/fixtures/mutation/calcul.epreuve.js';
const SOURCE = readFileSync(join(RACINE, MODULE), 'utf8');

// Un délai large pour les cas qui terminent : la série longue se joue à
// côté d'autres épreuves, et le démarrage de Node s'en ressent.
const DELAI_LARGE_MS = 30_000;
const DELAI_COURT_MS = 3_000;

// Le seul mutant que rend mutants() pour cet opérateur et de cet original, dans calcul.js.
function unMutant(operateur, original) {
  const trouves = mutants(SOURCE, MODULE).filter((m) => m.operateur === operateur && m.original === original);
  assert.equal(trouves.length, 1, `${operateur} ${original}`);
  return trouves[0];
}

// Les processus de Node vivants qui jouent l'épreuve, lus dans /proc : le
// premier argument est ce Node, un autre est le chemin de l'épreuve. Un
// processus mort non encore recueilli a une ligne vide ; un shell qui nomme
// l'épreuve dans sa commande n'est pas un processus de Node.
function processusDeLEpreuve() {
  return readdirSync('/proc')
    .filter((nom) => /^\d+$/u.test(nom))
    .filter((pid) => {
      try {
        const [programme, ...argumentsLus] = readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0');
        return programme === process.execPath && argumentsLus.some((a) => a.endsWith(EPREUVE));
      } catch {
        return false;
      }
    });
}

describe('executerMutant', () => {
  test('un mutant que le mini-test attrape est tué, et son extrait ne porte aucun chemin du poste', async () => {
    const resultat = await executerMutant({ mutant: unMutant('mise-a-jour', '+='), tests: [EPREUVE], delaiMs: DELAI_LARGE_MS });
    assert.equal(resultat.issue, 'tue', resultat.extrait);
    assert.match(resultat.extrait, /not ok/u);
    assert.match(resultat.extrait, /somme/u);
    assert.ok(!resultat.extrait.includes(RACINE), resultat.extrait);
    assert.ok(!resultat.extrait.includes(homedir()), resultat.extrait);
    assert.ok(resultat.dureeMs > 0 && resultat.dureeMs < DELAI_LARGE_MS);
  });

  test('un mutant neutre survit', async () => {
    const resultat = await executerMutant({ mutant: unMutant('frontiere', '>'), tests: [EPREUVE], delaiMs: DELAI_LARGE_MS });
    assert.equal(resultat.issue, 'survivant', resultat.extrait);
  });

  test('une boucle infinie finit en délai, sous le délai + 2 s, sans processus orphelin', async () => {
    const resultat = await executerMutant({ mutant: unMutant('mise-a-jour', '++'), tests: [EPREUVE], delaiMs: DELAI_COURT_MS });
    assert.equal(resultat.issue, 'delai', resultat.extrait);
    assert.ok(resultat.dureeMs >= DELAI_COURT_MS, `${resultat.dureeMs} ms`);
    assert.ok(resultat.dureeMs < DELAI_COURT_MS + 2_000, `${resultat.dureeMs} ms`);
    if (existsSync('/proc/self/cmdline')) {
      // Le noyau retire un processus tué en quelques millisecondes ; la
      // relecture borne l'attente à deux secondes.
      let restants = processusDeLEpreuve();
      for (const fin = performance.now() + 2_000; restants.length > 0 && performance.now() < fin; ) {
        await new Promise((suite) => setTimeout(suite, 50));
        restants = processusDeLEpreuve();
      }
      // Un orphelin tourne sans fin : il est tué avant le verdict, pour
      // qu'un échec ne laisse aucun processus derrière la série.
      for (const pid of restants) {
        try {
          process.kill(Number(pid), 'SIGKILL');
        } catch {
          // déjà terminé
        }
      }
      assert.deepEqual(restants, []);
    }
  });

  test('une syntaxe cassée est une erreur, comptée à part, sans lancer l’épreuve', async () => {
    const reel = unMutant('mise-a-jour', '+=');
    const casse = { ...reel, cle: `${reel.cle}:casse`, remplacement: '+=+=' };
    const resultat = await executerMutant({ mutant: casse, tests: [EPREUVE], delaiMs: DELAI_LARGE_MS });
    assert.equal(resultat.issue, 'erreur', resultat.extrait);
    assert.notEqual(resultat.extrait, '');
  });

  test('une liste d’épreuves vide, ou une épreuve absente, est refusée avant tout lancement', async () => {
    const mutant = unMutant('frontiere', '>');
    await assert.rejects(executerMutant({ mutant, tests: [], delaiMs: DELAI_LARGE_MS }), /aucune épreuve/u);
    await assert.rejects(
      executerMutant({ mutant, tests: ['test/fixtures/mutation/absente.epreuve.js'], delaiMs: DELAI_LARGE_MS }),
      /absente\.epreuve\.js/u,
    );
    await assert.rejects(executerMutant({ mutant, tests: [EPREUVE], delaiMs: 0 }), RangeError);
  });
});

// Le petit arbre de l'audit : [chemin dans l'arbre, source sous la racine du
// projet]. Les scripts de l'audit sont recopiés, et non liés : un module lié
// se charge sous son chemin réel, et audit.js prendrait le projet pour racine.
const ARBRE = Object.freeze([
  ['scripts/version.js', 'scripts/version.js'],
  ...['audit', 'crochets', 'executer', 'graphe', 'mutants', 'rapport'].map((nom) => [
    `scripts/mutation/${nom}.js`,
    `scripts/mutation/${nom}.js`,
  ]),
  ['test/lanceur.js', 'test/lanceur.js'],
  ['version.json', 'version.json'],
  ['src/moteur/bornes.js', 'test/fixtures/mutation/arbre/bornes.js'],
  ['src/moteur/bornes.test.js', 'test/fixtures/mutation/arbre/bornes.epreuve.js'],
  ['src/moteur/bornes.long.test.js', 'test/fixtures/mutation/arbre/bornes.longue.js'],
]);

// Le délai du processus fils : l'audit du petit arbre dure quelques
// secondes ; au-delà, l'épreuve échoue plutôt que d'attendre le délai de la
// série.
const DELAI_AUDIT_MS = 90_000;

// Plante l'arbre dans un dossier temporaire neuf, node_modules lié à celui du
// projet (vite, dont mutants.js et executer.js lisent parseAst), et y lance
// l'audit ; rend le dossier, le code de sortie et la sortie d'erreur.
// preparer(dossier) modifie l'arbre avant l'audit. Le dossier s'efface par
// effacer(dossier).
function auditerArbre(preparer = () => {}) {
  const dossier = mkdtempSync(join(tmpdir(), 'gtt-audit-'));
  for (const [cible, source] of ARBRE) {
    mkdirSync(dirname(join(dossier, cible)), { recursive: true });
    copyFileSync(join(RACINE, source), join(dossier, cible));
  }
  writeFileSync(join(dossier, 'package.json'), '{ "type": "module" }\n');
  symlinkSync(join(RACINE, 'node_modules'), join(dossier, 'node_modules'), 'dir');
  preparer(dossier);
  const fils = spawnSync(process.execPath, ['scripts/mutation/audit.js'], {
    cwd: dossier,
    encoding: 'utf8',
    timeout: DELAI_AUDIT_MS,
    killSignal: 'SIGKILL',
  });
  return { dossier, code: fils.status, sortie: `${fils.stderr ?? ''}${fils.error ? `\n${fils.error.message}` : ''}` };
}

const effacer = (dossier) => rmSync(dossier, { recursive: true, force: true });

// Les mutants d'une liste du JSON, lus « ligne opérateur avant→après ».
const lus = (liste) => liste.map((m) => `${m.ligne} ${m.operateur} ${m.original}→${m.remplacement}`);

describe('audit par mutation, en ligne de commande (§ 14.13)', () => {
  test('un survivant que la série longue tue se compte à part ; l’audit sort en 0 avec un survivant, et écrit ses deux fichiers', () => {
    const { dossier, code, sortie } = auditerArbre();
    try {
      assert.equal(code, 0, sortie);
      assert.match(sortie, /audit écrit : audit\/mutation-moteur\.md, audit\/mutation-moteur\.json/u);
      const json = readFileSync(join(dossier, 'audit/mutation-moteur.json'), 'utf8');
      const markdown = readFileSync(join(dossier, 'audit/mutation-moteur.md'), 'utf8');
      const lu = JSON.parse(json);
      assert.deepEqual(lu.entete.perimetre, ['src/moteur']);
      assert.deepEqual(lu.bilan, { total: 7, tues: 3, tuesSerieLongue: 3, survivants: 1, equivalents: 0, delais: 0, erreurs: 0 });
      // n * 3 → n / 3 : l'épreuve node le laisse vivre, l'épreuve longue le tue.
      assert.deepEqual(lus(lu.tuesSerieLongue), ['19 arithmetique *→/', '19 nombre-plus-un 3→4', '19 nombre-zero 3→0']);
      assert.deepEqual(
        lu.tuesSerieLongue.map(({ couverte, longue }) => [couverte, longue]),
        [
          [true, 'tue'],
          [true, 'tue'],
          [true, 'tue'],
        ],
      );
      // a > b → a >= b : rejoué contre l'épreuve longue, qui atteint le
      // module, il survit encore ; c'est le seul survivant compté.
      assert.deepEqual(lus(lu.survivants), ['12 frontiere >→>=']);
      assert.equal(lu.survivants[0].longue, 'survivant');
      assert.equal(relire(json).markdown, markdown);
    } finally {
      effacer(dossier);
    }
  });

  test('une ligne de base rouge : sortie 2 (SORTIE_NE_MESURE_PAS), et aucun dossier audit/', () => {
    const { dossier, code, sortie } = auditerArbre((arbre) =>
      appendFileSync(
        join(arbre, 'src/moteur/bornes.test.js'),
        "\ntest('une épreuve rouge avant tout mutant', () => {\n  assert.equal(plusGrand(1, 2), 1);\n});\n",
      ),
    );
    try {
      assert.equal(code, 2, sortie);
      assert.match(sortie, /l’audit ne mesure pas : la série node du périmètre, non mutée, échoue/u);
      assert.equal(existsSync(join(dossier, 'audit')), false, 'aucun dossier audit/');
    } finally {
      effacer(dossier);
    }
  });

  test('un mutant déclaré équivalent que la série longue tue reste compté tué par elle, et l’audit le signale', () => {
    const source = readFileSync(join(RACINE, 'test/fixtures/mutation/arbre/bornes.js'), 'utf8');
    const [divise] = mutants(source, 'src/moteur/bornes.js').filter((m) => m.operateur === 'arithmetique');
    const { dossier, code, sortie } = auditerArbre((arbre) => {
      mkdirSync(join(arbre, 'audit'));
      writeFileSync(join(arbre, 'audit/mutants-equivalents.json'), `${JSON.stringify([{ cle: divise.cle, raison: 'déclaré à tort' }])}\n`);
    });
    try {
      assert.equal(code, 0, sortie);
      assert.ok(sortie.includes(`déclaré équivalent, pourtant tué par la série longue : ${divise.cle}`), sortie);
      const lu = JSON.parse(readFileSync(join(dossier, 'audit/mutation-moteur.json'), 'utf8'));
      assert.equal(lu.bilan.equivalents, 0);
      assert.ok(lu.tuesSerieLongue.some((m) => m.cle === divise.cle));
    } finally {
      effacer(dossier);
    }
  });

  test('des équivalents déclarés d’une autre forme : sortie 2, avant toute mesure, rien d’écrit', () => {
    const { dossier, code, sortie } = auditerArbre((arbre) => {
      mkdirSync(join(arbre, 'audit'));
      writeFileSync(join(arbre, 'audit/mutants-equivalents.json'), '[{ "cle": "src/moteur/bornes.js:frontiere:0:0", "raison": "" }]\n');
    });
    try {
      assert.equal(code, 2, sortie);
      assert.match(sortie, /audit\/mutants-equivalents\.json : liste de \{ cle, raison \}, raison vide pour src\/moteur\/bornes\.js:frontiere:0:0/u);
      assert.doesNotMatch(sortie, /ligne de base/u);
      assert.deepEqual(readdirSync(join(dossier, 'audit')), ['mutants-equivalents.json']);
    } finally {
      effacer(dossier);
    }
  });
});
