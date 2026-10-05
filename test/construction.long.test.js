// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le paquet livré n'emporte rien de l'outillage d'épreuve (§ 14.9, § 14.15) :
// ni fichier de test, ni le lanceur, ni donnée d'épreuve, ni paquet d'un outil
// d'épreuve. Le test construit la page par l'API de Vite, avec la
// configuration et le mode de la livraison, dans un répertoire temporaire ;
// il relit les modules que contient le paquet, les noms d'origine de chaque
// actif, puis le chemin et le contenu de chaque fichier écrit.
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { describe, test } from './lanceur.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));

// Paquets qui ne servent qu'aux épreuves.
const OUTILS_EPREUVE =
  /[\\/]node_modules[\\/](?:vitest|@vitest|playwright|playwright-core|fast-check)[\\/]/;

// Vrai quand un module vient de l'outillage d'épreuve : l'arbre test/
// (lanceur, données d'épreuve), un fichier *.test.js rangé à côté de son
// module, un paquet d'épreuve, ou un module de Node que Vite remplace pour le
// navigateur, comme node:assert.
function moduleDEpreuve(id) {
  return (
    id.startsWith(join(RACINE, 'test') + sep) ||
    /\.test\.[cm]?js(?:\?|$)/.test(id) ||
    OUTILS_EPREUVE.test(id) ||
    id.includes('__vite-browser-external')
  );
}

// Traces de l'outillage dans le chemin ou le contenu d'un fichier écrit. Les
// motifs portent l'extension : le domaine emploie le mot « lanceur » (lanceur
// portable, § 8.6), et un code minifié peut écrire « x.test.call ».
const TRACES_EPREUVE = [/vitest/i, /node:assert/, /lanceur\.js/, /\.test\.[cm]?js/];

// Construit la page comme la livraison : vite.config.js, mode livraison,
// NODE_ENV=production. Vitest pose NODE_ENV=test, dont Vite déduirait une
// construction de développement — composants compilés en mode dev, paquets
// résolus sous la condition « development ».
async function construireLivraison(sortie) {
  const nodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    return await build({
      root: RACINE,
      configFile: join(RACINE, 'vite.config.js'),
      mode: 'livraison',
      logLevel: 'error',
      // Sans incrustation, chaque actif sort en fichier et garde ses noms
      // d'origine ; incrusté en data:, il ne laisserait aucune trace lisible.
      build: { outDir: sortie, emptyOutDir: true, assetsInlineLimit: 0 },
    });
  } finally {
    if (nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnv;
  }
}

describe('construction', () => {
  test("le paquet livré n'emporte aucun fichier ni module d'épreuve (§ 14.9)", async () => {
    const sortie = mkdtempSync(join(tmpdir(), 'construction-'));
    try {
      const resultat = await construireLivraison(sortie);
      const sorties = (Array.isArray(resultat) ? resultat : [resultat]).flatMap(
        (r) => r.output,
      );
      const modules = sorties
        .filter((s) => s.type === 'chunk')
        .flatMap((s) => s.moduleIds);
      assert.ok(
        modules.some((id) => id.startsWith(join(RACINE, 'src') + sep)),
        `aucun module de src/ parmi ${modules.length} modules examinés`,
      );
      assert.deepEqual(modules.filter(moduleDEpreuve), []);

      // Un actif n'est pas un module : moduleIds ne le voit pas. Une donnée
      // jointe par new URL(…, import.meta.url) n'apparaît que là.
      const actifs = sorties
        .filter((s) => s.type === 'asset')
        .flatMap((s) => (s.originalFileNames ?? []).map((n) => resolve(RACINE, n)));
      assert.ok(actifs.length > 0, `aucun actif d'origine connue parmi ${sorties.length} sorties`);
      assert.deepEqual(actifs.filter(moduleDEpreuve), []);

      const fichiers = readdirSync(sortie, { recursive: true, withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => join(e.parentPath, e.name));
      assert.ok(
        fichiers.some((f) => f.endsWith('.js')),
        `aucun script parmi ${fichiers.length} fichiers écrits`,
      );
      const traces = fichiers.flatMap((f) => {
        const nom = relative(sortie, f);
        const contenu = readFileSync(f, 'utf8');
        return TRACES_EPREUVE.filter((m) => m.test(nom) || m.test(contenu)).map(
          (m) => `${nom} : ${m}`,
        );
      });
      assert.deepEqual(traces, []);
    } finally {
      rmSync(sortie, { recursive: true, force: true });
    }
  });
});
