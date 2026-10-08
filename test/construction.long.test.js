// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le paquet livré n'emporte rien de l'outillage d'épreuve (§ 14.9, § 14.15) :
// ni fichier de test, ni le lanceur, ni donnée d'épreuve, ni paquet d'un outil
// d'épreuve, ni le client du serveur de développement ; et il ne charge rien
// du réseau. Le test construit la page par l'API de Vite, avec la
// configuration et le mode de la livraison, dans un répertoire temporaire ;
// il relit les modules que contient le paquet, les noms d'origine de chaque
// actif, puis le chemin et le contenu de chaque fichier écrit. Le paquet du
// travailleur de génération, que « ?worker&inline » construit à part et
// incruste en chaîne dans le module principal, n'apparaît pas dans les
// moduleIds de celui-ci : un greffon posé par l'option worker.plugins relève
// les modules et le code de ses morceaux, qui passent par les mêmes relevés.
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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

// Le client du serveur de développement de Vite : une page qui le nomme
// attend un serveur qui n'existe pas chez l'opérateur.
const CLIENT_DE_DEVELOPPEMENT = '/@vite/client';

// Un littéral de chaîne JavaScript, entre guillemets doubles, simples ou
// accents graves sans interpolation ; son contenu est dans l'un des trois
// groupes.
const LITTERAL = String.raw`(?:"([^"\n]*)"|'([^'\n]*)'|\x60([^\x60$]*)\x60)`;

// Les positions où un fichier construit charge une adresse, par nature :
// attributs src et href du HTML ; url() et @import des feuilles ; argument
// littéral d'import(), de fetch, d'importScripts et des constructeurs de
// travailleur, et spécificateur d'un import statique ou d'une réexportation
// en JavaScript. Un composant Svelte compile son balisage en chaînes du
// JavaScript : les attributs src, href, xlink:href et srcset et les url()
// d'un attribut style y sont relevés dans tout le texte, sans apparier les
// littéraux, qu'une expression régulière ou un guillemet échappé du code
// minifié décalerait ; un guillemet échappé (\") y ouvre la valeur comme un
// guillemet nu, et la valeur s'arrête au premier guillemet ou à la première
// barre oblique inverse. Le balisage compilé écrit en entité HTML un
// guillemet de la valeur d'un attribut — url(&quot;…&quot;) —, que le texte
// JavaScript voit décodé avant les motifs. url( n'y compte qu'en minuscules,
// hors d'un nom plus long : new URL(…) n'est pas une feuille. Chaque
// candidat d'un srcset compte, l'adresse avant son descripteur de largeur
// ou de densité. Une chaîne hors de ces positions — l'adresse
// https://svelte.dev/e/… d'une erreur de Svelte, un espace de noms XML
// http://www.w3.org/… — ne charge rien et n'est pas relevée. Les
// commentaires du HTML et des feuilles sont retirés d'abord : une balise
// commentée ne charge rien.
//
// Par nature : commentaires, le motif des commentaires retirés d'abord ;
// entites, vrai quand les guillemets écrits en entité HTML se décodent
// avant les motifs ; motifs, dont chaque correspondance porte une adresse
// dans l'un de ses groupes ; listes, dont chaque correspondance porte la
// valeur d'un srcset, liste de candidats séparés par des virgules.
const POSITIONS = {
  html: {
    commentaires: /<!--[\s\S]*?-->/g,
    entites: false,
    motifs: [/\s(?:src|(?:xlink:)?href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi],
    listes: [/\ssrcset\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi],
  },
  css: {
    commentaires: /\/\*[\s\S]*?\*\//g,
    entites: false,
    motifs: [/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/gi, /@import\s+(?:"([^"]*)"|'([^']*)')/gi],
    listes: [],
  },
  js: {
    commentaires: null,
    entites: true,
    motifs: [
      new RegExp(String.raw`(?:\bimport|\bfetch|\bimportScripts|\bWorker|\bSharedWorker)\s*\(\s*${LITTERAL}`, 'g'),
      new RegExp(String.raw`(?:\bimport|\bfrom)\s*${LITTERAL}`, 'g'),
      /\s(?:src|(?:xlink:)?href)\s*=\s*\\?(?:"([^"\\]*)|'([^'\\]*)|([^\s"'>\\]+))/gi,
      /(?<![\w$.])url\(\s*\\?["']?([^)"'\\\s]*)/g,
    ],
    listes: [/\ssrcset\s*=\s*\\?(?:"([^"\\]*)|'([^'\\]*)|([^\s"'>\\]+))/gi],
  },
};

// Les guillemets qu'une entité HTML écrit, nommée ou numérique, décimale ou
// hexadécimale, zéros de tête et casse indifférents.
const GUILLEMETS_EN_ENTITE = /&(?:(quot)|apos|#0*(34)|#0*39|#x0*(22)|#x0*27);/gi;

// Le texte où chaque guillemet écrit en entité est rendu à son caractère.
const decoderGuillemets = (texte) =>
  texte.replace(GUILLEMETS_EN_ENTITE, (_entite, quot, decimal, hexadecimal) =>
    quot || decimal || hexadecimal ? '"' : "'",
  );

// Les adresses d'une valeur de srcset : le premier mot de chaque candidat.
const candidatsDe = (valeur) =>
  valeur
    .split(',')
    .map((candidat) => candidat.trim().split(/\s+/)[0])
    .filter((adresse) => adresse !== '');

// La nature d'un fichier construit, d'après son extension ; null pour un
// fichier qu'aucune position ne concerne.
function natureDe(nom) {
  const extension = extname(nom).toLowerCase();
  if (extension === '.html') return 'html';
  if (extension === '.css') return 'css';
  if (['.js', '.mjs', '.cjs'].includes(extension)) return 'js';
  return null;
}

// Les adresses qu'un texte de la nature donnée charge, dans l'ordre du
// texte, motif par motif, puis celles des srcset.
function adressesChargees(nature, texte) {
  const { commentaires, entites, motifs, listes } = POSITIONS[nature];
  const sansCommentaires = commentaires === null ? texte : texte.replace(commentaires, ' ');
  const nettoye = entites ? decoderGuillemets(sansCommentaires) : sansCommentaires;
  const valeurs = (motif) => [...nettoye.matchAll(motif)].map((m) => m.slice(1).find((groupe) => groupe !== undefined));
  return [...motifs.flatMap(valeurs), ...listes.flatMap((motif) => valeurs(motif).flatMap(candidatsDe))];
}

// Vrai pour une adresse qui sort de la machine : http, https, ou relative au
// protocole (« //hôte/… »).
const distante = (adresse) => /^(?:https?:)?\/\//i.test(adresse.trim());

// Le relevé du travailleur : un greffon de construction des travailleurs,
// qui garde le nom, les modules et le code de chacun de leurs morceaux.
function releveDuTravailleur() {
  const morceaux = [];
  const greffon = {
    name: 'releve-du-travailleur',
    generateBundle(_options, paquet) {
      for (const sortie of Object.values(paquet)) {
        if (sortie.type === 'chunk') {
          morceaux.push({ nom: sortie.fileName, moduleIds: sortie.moduleIds, code: sortie.code });
        }
      }
    },
  };
  return { morceaux, plugins: () => [greffon] };
}

// Les balises script d'un HTML, dans l'ordre : leur src, si elles portent
// type="module", et si elles portent async ou defer. Les commentaires sont
// retirés d'abord.
function scriptsDe(html) {
  return [...html.replace(POSITIONS.html.commentaires, ' ').matchAll(/<script\b([^>]*)>/gi)].map(([, attributs]) => ({
    src: /\ssrc\s*=\s*["']?([^"'\s>]+)/i.exec(attributs)?.[1] ?? null,
    module: /\stype\s*=\s*["']?module\b/i.test(attributs),
    differe: /\s(?:async|defer)\b/i.test(attributs),
  }));
}

// Construit la page comme la livraison : vite.config.js, mode livraison,
// NODE_ENV=production. Vitest pose NODE_ENV=test, dont Vite déduirait une
// construction de développement — composants compilés en mode dev, paquets
// résolus sous la condition « development ».
async function construireLivraison(sortie, travailleur) {
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
      worker: { plugins: travailleur.plugins },
    });
  } finally {
    if (nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnv;
  }
}

describe('construction : le relevé des adresses chargées', () => {
  test('chaque position relève son adresse ; commentaires, espaces de noms et adresses d’erreur ne comptent pas', () => {
    const html = [
      '<!-- <script src="https://commente.invalid/a.js"></script> -->',
      '<script src="https://exemple.invalid/a.js"></script>',
      '<script src="http://exemple.invalid/k.js"></script>',
      "<link rel=stylesheet href='//exemple.invalid/b.css'>",
      '<img src=./local.png>',
      '<svg><image xlink:href="https://exemple.invalid/q.png"/></svg>',
      '<img srcset="./r.png 1x, https://exemple.invalid/r2.png 2x">',
    ].join('\n');
    assert.deepEqual(adressesChargees('html', html), [
      'https://exemple.invalid/a.js',
      'http://exemple.invalid/k.js',
      '//exemple.invalid/b.css',
      './local.png',
      'https://exemple.invalid/q.png',
      './r.png',
      'https://exemple.invalid/r2.png',
    ]);
    const css = [
      '/* url(https://commente.invalid/f.png) */',
      'a { background: url( "https://exemple.invalid/c.png" ) }',
      "@import 'https://exemple.invalid/d.css';",
      'b { background: url(./e.png) }',
    ].join('\n');
    assert.deepEqual(adressesChargees('css', css), [
      'https://exemple.invalid/c.png',
      './e.png',
      'https://exemple.invalid/d.css',
    ]);
    const js = [
      'fetch("https://exemple.invalid/e.json");',
      'fetch("HTTP://exemple.invalid/l");',
      "import('https://exemple.invalid/f.js');",
      'importScripts(`https://exemple.invalid/g.js`);',
      'new Worker("./h.js");',
      'import"https://exemple.invalid/i.js";',
      'export{a}from"https://exemple.invalid/j.js";',
      'const n="http://www.w3.org/2000/svg",l="https://svelte.dev/e/effect_orphan";',
      'fetch(u);import(`./${m}.js`);',
      // Le balisage qu'un composant compilé porte en chaîne, guillemets nus
      // ou échappés, gabarit interpolé compris ; l'espace de noms d'une
      // balise ne charge rien.
      `var t=$.from_html('<img src="https://exemple.invalid/k.png">');`,
      'var a="<a href=\\"https://exemple.invalid/m.html\\">x</a>";',
      "var d=`<div style=\"background: url('https://exemple.invalid/n.png')\">${x}</div>`;",
      'var s="<svg xmlns=\\"http://www.w3.org/2000/svg\\"><use href=\\"#a\\"/></svg>";',
      'var o=new URL(e,import.meta.url);',
      // Le guillemet d'une valeur d'attribut écrit en entité HTML, comme
      // Svelte compile style='background: url("…")'.
      'var p=$.from_html(`<div style="background: url(&quot;https://exemple.invalid/o.png&quot;)"></div>`);',
      'var q="<div style=\\"background: url(&#39;https://exemple.invalid/p.png&#39;)\\"></div>";',
      'var r=\'<i style="background:url(&#X27;https://exemple.invalid/q.png&#x27;)"></i>\';',
      // xlink:href et srcset, dont chaque candidat compte.
      'var v=$.from_html(`<svg><image xlink:href="https://exemple.invalid/s.png"></image></svg>`);',
      'var w="<img srcset=\\"./t.png 1x, https://exemple.invalid/t2.png 2x\\">";',
    ].join('');
    assert.deepEqual(adressesChargees('js', js), [
      'https://exemple.invalid/e.json',
      'HTTP://exemple.invalid/l',
      'https://exemple.invalid/f.js',
      'https://exemple.invalid/g.js',
      './h.js',
      'https://exemple.invalid/i.js',
      'https://exemple.invalid/j.js',
      'https://exemple.invalid/k.png',
      'https://exemple.invalid/m.html',
      '#a',
      'https://exemple.invalid/s.png',
      'https://exemple.invalid/n.png',
      'https://exemple.invalid/o.png',
      'https://exemple.invalid/p.png',
      'https://exemple.invalid/q.png',
      './t.png',
      'https://exemple.invalid/t2.png',
    ]);
    const distantes = [html, css, js].flatMap((texte, rang) =>
      adressesChargees(['html', 'css', 'js'][rang], texte).filter(distante),
    );
    assert.equal(distantes.length, 21);
    assert.ok(!distantes.some((a) => a.includes('svelte.dev') || a.includes('w3.org') || a.includes('commente')));
  });

  test('scriptsDe lit les balises script dans l’ordre, commentaires retirés', () => {
    const html = [
      '<!-- <script type="module" src="./x.js"></script> -->',
      '<script src="./c.js"></script>',
      '<script type="module" crossorigin src="./m.js"></script>',
      "<script defer src='./d.js'></script>",
    ].join('');
    assert.deepEqual(scriptsDe(html), [
      { src: './c.js', module: false, differe: false },
      { src: './m.js', module: true, differe: false },
      { src: './d.js', module: false, differe: true },
    ]);
  });
});

describe('construction', () => {
  test("le paquet livré n'emporte aucun fichier ni module d'épreuve et ne charge rien du réseau (§ 14.9, § 14.15)", async () => {
    const sortie = mkdtempSync(join(tmpdir(), 'construction-'));
    const travailleur = releveDuTravailleur();
    try {
      const resultat = await construireLivraison(sortie, travailleur);
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

      // La taille de chaque morceau tient sous le seuil d'avertissement de
      // vite.config.js, en kilooctets de 1 000 octets comme Vite les compte :
      // un paquet qui grossit au-delà fait tomber cette épreuve, et non
      // seulement avertir la construction.
      const { default: vite } = await import(pathToFileURL(join(RACINE, 'vite.config.js')).href);
      const seuil = vite.build?.chunkSizeWarningLimit;
      assert.equal(typeof seuil, 'number', 'vite.config.js ne pose aucun build.chunkSizeWarningLimit');
      const morceaux = sorties.filter((s) => s.type === 'chunk');
      assert.ok(morceaux.length > 0, `aucun morceau parmi ${sorties.length} sorties`);
      assert.deepEqual(
        morceaux
          .filter((m) => Buffer.byteLength(m.code, 'utf8') > seuil * 1000)
          .map((m) => `${m.fileName} : ${Math.ceil(Buffer.byteLength(m.code, 'utf8') / 1000)} ko > ${seuil} ko`),
        [],
      );

      // Un actif n'est pas un module : moduleIds ne le voit pas. Une donnée
      // jointe par new URL(…, import.meta.url) n'apparaît que là.
      const actifs = sorties
        .filter((s) => s.type === 'asset')
        .flatMap((s) => (s.originalFileNames ?? []).map((n) => resolve(RACINE, n)));
      assert.ok(actifs.length > 0, `aucun actif d'origine connue parmi ${sorties.length} sorties`);
      assert.deepEqual(actifs.filter(moduleDEpreuve), []);

      // Le paquet du travailleur : ses modules, dont le point d'entrée de la
      // génération, passent par le même relevé que ceux du module principal.
      const modulesDuTravailleur = travailleur.morceaux.flatMap((m) => m.moduleIds);
      assert.ok(travailleur.morceaux.length > 0, 'aucun morceau de travailleur relevé');
      assert.ok(
        modulesDuTravailleur.includes(join(RACINE, 'src', 'application', 'generation_travailleur.js')),
        `generation_travailleur.js absent des ${modulesDuTravailleur.length} modules du travailleur`,
      );
      assert.deepEqual(modulesDuTravailleur.filter(moduleDEpreuve), []);

      const fichiers = readdirSync(sortie, { recursive: true, withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => join(e.parentPath, e.name));
      assert.ok(
        fichiers.some((f) => f.endsWith('.js')),
        `aucun script parmi ${fichiers.length} fichiers écrits`,
      );
      // Les fichiers écrits, puis le code de chaque morceau du travailleur,
      // qui n'est écrit qu'incrusté en chaîne et s'y lirait échappé.
      const textes = [
        ...fichiers.map((f) => ({ nom: relative(sortie, f), contenu: readFileSync(f, 'utf8') })),
        ...travailleur.morceaux.map((m) => ({ nom: `travailleur:${m.nom}`, contenu: m.code })),
      ];
      const traces = textes.flatMap(({ nom, contenu }) =>
        [...TRACES_EPREUVE, CLIENT_DE_DEVELOPPEMENT]
          .filter((m) => (typeof m === 'string' ? nom.includes(m) || contenu.includes(m) : m.test(nom) || m.test(contenu)))
          .map((m) => `${nom} : ${m}`),
      );
      assert.deepEqual(traces, []);

      // Les adresses chargées : aucune ne sort de la machine. Le HTML en
      // porte au moins une, le collecteur, le module d'entrée et sa feuille.
      const releves = textes.flatMap(({ nom, contenu }) => {
        const nature = natureDe(nom.replace(/^travailleur:/, ''));
        return nature === null ? [] : adressesChargees(nature, contenu).map((adresse) => ({ nom, nature, adresse }));
      });
      assert.ok(
        releves.filter(({ nature }) => nature === 'html').length >= 3,
        `${releves.length} adresses relevées, dont trop peu dans le HTML`,
      );
      assert.deepEqual(
        releves.filter(({ adresse }) => distante(adresse)).map(({ nom, adresse }) => `${nom} : ${adresse}`),
        [],
      );

      // index.html : la langue, puis le collecteur, script classique copié
      // tel quel depuis public/, en tête des scripts et sans async ni defer :
      // il s'exécute pendant l'analyse du HTML, avant tout module, que le
      // navigateur diffère à la fin de l'analyse.
      const html = readFileSync(join(sortie, 'index.html'), 'utf8');
      assert.match(html, /<html\b[^>]*\slang="fr"/);
      const scripts = scriptsDe(html);
      const modulesDuHtml = scripts.filter((s) => s.module);
      assert.ok(modulesDuHtml.length > 0, `aucun script module parmi ${scripts.length} scripts`);
      assert.deepEqual(scripts[0], { src: './collecteur.js', module: false, differe: false });
      assert.equal(
        readFileSync(join(sortie, 'collecteur.js'), 'utf8'),
        readFileSync(join(RACINE, 'public', 'collecteur.js'), 'utf8'),
      );
    } finally {
      rmSync(sortie, { recursive: true, force: true });
    }
  });
});
