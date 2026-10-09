// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'exécution d'un mutant (§ 14.13), sur le module inventé de
// test/fixtures/mutation/ et son épreuve, jouée sous le repli node --test
// (§ 14.8) : les quatre issues — tué, survivant, délai, erreur. Chaque cas
// lance de vrais processus de Node, d'où sa place hors de la série
// surveillée (§ 14.14). Le cas du délai vérifie qu'aucun processus de
// l'épreuve ne reste après le délai, groupe entier compris.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executerMutant } from '../scripts/mutation/executer.js';
import { mutants } from '../scripts/mutation/mutants.js';
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
