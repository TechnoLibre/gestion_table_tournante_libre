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
//
// Les sorties (§ 11.1, § 14.15) : la police embarquée voyage dans deux
// morceaux différés, un par graisse, incrustée octet pour octet ; le logo de
// TechnoLibre et les textes des deux licences du logiciel voyagent chacun dans
// leur morceau différé, le PNG du logo incrusté octet pour octet ; pdf-lib et
// fontkit, quand la page les importe, tiennent chacun leur morceau, sous le
// seuil ; aucun de ces morceaux n'est chargé ni préchargé au lancement ; les
// avis de licence et les textes des deux licences sont copiés dans
// www/licences/, et chaque paquet des morceaux construits y a le sien, sous
// la licence de son package.json. Les deux fichiers de la police sont aussi
// émis dans www/, octet pour octet, et nommés par la feuille construite :
// jetons.css en fait la police de l'interface.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
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
      // url( précédé d'un point, d'un mot ou d'un $ est un appel de méthode
      // ou de fonction, non une feuille : rien à relever.
      'var y=x.url("https://exemple.invalid/u.png"),z=$url("https://exemple.invalid/v.png"),c=curl(\'https://exemple.invalid/w.png\');',
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

// Le paquet de node_modules d'où vient un module construit : le dernier
// segment node_modules de son chemin, et le répertoire qui porte son
// package.json ; null pour un module du projet.
function paquetDe(id) {
  const lu = /^(.*[\\/]node_modules[\\/])((?:@[^\\/]+[\\/])?[^\\/]+)/.exec(id.replace(/\?.*$/, ''));
  if (lu === null) return null;
  return { nom: lu[2].split(sep).join('/'), dossier: lu[1] + lu[2] };
}

// Les sections « paquet : nom version » de TIERS.txt et leur ligne
// « licence : … », dans l'ordre du texte.
function sectionsDesTiers(texte) {
  return [...texte.matchAll(/^paquet : (\S+) (\S+)\nlicence : (.+)$/gm)].map(([, nom, version, licence]) => ({
    nom,
    version,
    licence,
  }));
}

// Les paquets que vite.config.js range dans un groupe de morceaux, et le
// groupe qui les prend : name et test de chaque groupe, dans leur ordre.
const groupeDe = (groupes, id) =>
  groupes.find(({ test: motif }) => (typeof motif === 'function' ? motif(id) : new RegExp(motif).test(id)))?.name ?? null;

// Modules témoins des deux groupes de la production PDF, chemins comme
// Rolldown les nomme, et un module qui n'est d'aucun groupe.
const TEMOINS_DES_GROUPES = [
  ['/projet/node_modules/@pdf-lib/fontkit/dist/fontkit.es.js', 'fontkit'],
  ['/projet/node_modules/pdf-lib/es/api/PDFDocument.js', 'pdf-lib'],
  ['/projet/node_modules/pako/lib/deflate.js', 'pdf-lib'],
  ['/projet/node_modules/pdf-lib/node_modules/tslib/tslib.es6.js', 'pdf-lib'],
  ['/projet/node_modules/@pdf-lib/standard-fonts/es/index.js', 'pdf-lib'],
  ['/projet/node_modules/@pdf-lib/upng/UPNG.js', 'pdf-lib'],
  ['/projet/node_modules/svelte/src/index-client.js', null],
  ['/projet/src/pdf/imposition.js', null],
];
const DU_PDF = /[\\/]node_modules[\\/](?:pdf-lib|pako|tslib|@pdf-lib[\\/](?:fontkit|standard-fonts|upng))[\\/]/;

// Les modules de la vue de comparaison (contrainte 53) : la page de qualité
// seule les importe, et ils voyagent dans son morceau, chargé à la demande.
const MODULES_DE_LA_COMPARAISON = [
  'src/interface/qualite/VueComparaison.svelte',
  'src/interface/qualite/comparaison.js',
  'src/interface/qualite/ColonnesComparaison.svelte',
  'src/interface/qualite/colonnes.js',
];

describe('construction : le morceau de la page de qualité (§ 12.10.6, D55)', () => {
  test('la vue de comparaison voyage dans le seul morceau de la page de qualité, chargé à la demande : aucun de ses modules n’est dans un morceau chargé ou préchargé au lancement', async () => {
    const sortie = mkdtempSync(join(tmpdir(), 'construction-qualite-'));
    try {
      const resultat = await construireLivraison(sortie, releveDuTravailleur());
      const sorties = (Array.isArray(resultat) ? resultat : [resultat]).flatMap((r) => r.output);
      const morceaux = sorties.filter((s) => s.type === 'chunk');
      // Les morceaux qui portent le module au chemin donné, sa requête
      // retirée : un composant y entre aussi par sa feuille de style.
      const porteurs = (chemin) => {
        const id = join(RACINE, ...chemin.split('/'));
        return morceaux.filter((m) => m.moduleIds.some((module) => module.replace(/\?.*$/, '') === id)).map((m) => m.fileName);
      };
      const deLaQualite = porteurs('src/interface/qualite/SectionQualite.svelte');
      assert.equal(deLaQualite.length, 1, `SectionQualite.svelte dans ${deLaQualite.length} morceaux`);
      const [qualite] = deLaQualite;
      const morceau = morceaux.find((m) => m.fileName === qualite);
      assert.ok(morceau.isDynamicEntry && !morceau.isEntry, `${qualite} n'est pas un morceau différé`);
      for (const chemin of MODULES_DE_LA_COMPARAISON) assert.deepEqual(porteurs(chemin), [qualite], chemin);

      // Au lancement : les imports statiques des points d'entrée, de proche
      // en proche, et les modulepreload du HTML.
      const statiques = new Set();
      const aSuivre = morceaux.filter((m) => m.isEntry).map((m) => m.fileName);
      assert.ok(aSuivre.length > 0, 'aucun point d’entrée');
      while (aSuivre.length > 0) {
        const nom = aSuivre.pop();
        if (statiques.has(nom)) continue;
        statiques.add(nom);
        aSuivre.push(...(morceaux.find((m) => m.fileName === nom)?.imports ?? []));
      }
      const html = readFileSync(join(sortie, 'index.html'), 'utf8');
      const prechargements = [...html.matchAll(/<link\b[^>]*\brel=["']?modulepreload\b[^>]*>/gi)].map(
        ([balise]) => /\shref\s*=\s*["']?\.?\/?([^"'\s>]+)/i.exec(balise)?.[1] ?? '',
      );
      assert.deepEqual([...statiques, ...prechargements].filter((nom) => nom === qualite), []);
    } finally {
      rmSync(sortie, { recursive: true, force: true });
    }
  });
});

describe('construction : les sorties (§ 11.1, § 14.15)', () => {
  test('vite.config.js range fontkit dans un morceau, pdf-lib et ce qu’il tire dans un autre, et rien d’autre', async () => {
    const { default: vite } = await import(pathToFileURL(join(RACINE, 'vite.config.js')).href);
    const groupes = vite.build?.rolldownOptions?.output?.codeSplitting?.groups ?? [];
    assert.deepEqual(groupes.map(({ name }) => name), ['fontkit', 'pdf-lib']);
    assert.deepEqual(
      TEMOINS_DES_GROUPES.map(([id]) => [id, groupeDe(groupes, id)]),
      TEMOINS_DES_GROUPES,
    );
  });

  test('la police voyage dans deux morceaux différés, octet pour octet, et ses deux fichiers sont émis dans www/, nommés par la feuille construite ; le logo et les textes des licences voyagent chacun dans un morceau différé, le PNG octet pour octet ; aucun morceau des sorties n’est chargé ni préchargé au lancement ; les avis et les textes des licences sont dans www/licences/, et chaque paquet construit y a le sien', async () => {
    const sortie = mkdtempSync(join(tmpdir(), 'construction-sorties-'));
    const travailleur = releveDuTravailleur();
    try {
      const resultat = await construireLivraison(sortie, travailleur);
      const sorties = (Array.isArray(resultat) ? resultat : [resultat]).flatMap((r) => r.output);
      const morceaux = sorties.filter((s) => s.type === 'chunk');

      // Une graisse, un morceau : chargé par import() différé, il porte la
      // police en URL data:, dont le décodage est le fichier de src/polices.
      const sha256 = (octets) => createHash('sha256').update(octets).digest('hex');
      const morceauxDePolice = [];
      for (const [module, fichier] of [['regulier.js', 'NotoSans-Regular.ttf'], ['gras.js', 'NotoSans-Bold.ttf']]) {
        const id = join(RACINE, 'src', 'polices', module);
        const porteurs = morceaux.filter((m) => m.moduleIds.includes(id));
        assert.equal(porteurs.length, 1, `${module} dans ${porteurs.length} morceaux`);
        const [morceau] = porteurs;
        assert.ok(morceau.isDynamicEntry && !morceau.isEntry, `${morceau.fileName} n'est pas un morceau différé`);
        const donnees = [...morceau.code.matchAll(/data:font\/ttf;base64,([A-Za-z0-9+/]+=*)/g)].map((m) => m[1]);
        assert.equal(donnees.length, 1, `${morceau.fileName} : ${donnees.length} polices incrustées`);
        assert.equal(
          sha256(Buffer.from(donnees[0], 'base64')),
          sha256(readFileSync(join(RACINE, 'src', 'polices', fichier))),
          fichier,
        );
        morceauxDePolice.push(morceau.fileName);
      }
      assert.notEqual(morceauxDePolice[0], morceauxDePolice[1]);

      // Le logo et les textes des licences (§ 18.6) : chacun dans un seul
      // morceau, différé, que chargerLogo et chargerTexteLicence importent à
      // la demande, avec les fichiers qu'il incruste ; le PNG du logo y est
      // une URL data:, dont le décodage est le fichier de src/actifs.
      const sansRequete = (id) => id.replace(/\?.*$/, '');
      const morceauxDActifs = [];
      for (const [module, incrustes] of [
        ['src/actifs/donnees_logo.js', ['src/actifs/full_logo_technolibre_2023.svg', 'src/actifs/full_logo_technolibre_2023.png']],
        ['src/actifs/textes_licences.js', ['public/licences/AGPL-3.0-or-later.txt', 'public/licences/LiLiQ-Rplus-1.1.txt']],
      ]) {
        const id = join(RACINE, ...module.split('/'));
        const porteurs = morceaux.filter((m) => m.moduleIds.includes(id));
        assert.equal(porteurs.length, 1, `${module} dans ${porteurs.length} morceaux`);
        const [morceau] = porteurs;
        assert.ok(morceau.isDynamicEntry && !morceau.isEntry, `${morceau.fileName} n'est pas un morceau différé`);
        for (const fichier of incrustes) {
          const idFichier = join(RACINE, ...fichier.split('/'));
          assert.ok(morceau.moduleIds.some((m) => sansRequete(m) === idFichier), `${fichier} absent de ${morceau.fileName}`);
        }
        morceauxDActifs.push(morceau.fileName);
      }
      const morceauDuLogo = morceaux.find((m) => m.fileName === morceauxDActifs[0]);
      const logos = [...morceauDuLogo.code.matchAll(/data:image\/png;base64,([A-Za-z0-9+/]+=*)/g)].map((m) => m[1]);
      assert.equal(logos.length, 1, `${morceauDuLogo.fileName} : ${logos.length} PNG incrustés`);
      assert.equal(
        sha256(Buffer.from(logos[0], 'base64')),
        sha256(readFileSync(join(RACINE, 'src', 'actifs', 'full_logo_technolibre_2023.png'))),
        'full_logo_technolibre_2023.png',
      );

      // Les morceaux des sorties : la police, et tout morceau qui porte un
      // module de pdf-lib, de fontkit ou de ce qu'ils tirent. Quand la page
      // les importe, fontkit et pdf-lib tiennent chacun un morceau à part.
      const deLaProduction = morceaux.filter((m) => m.moduleIds.some((id) => DU_PDF.test(id)));
      for (const morceau of deLaProduction) {
        const nomsDePaquets = new Set(morceau.moduleIds.map((id) => paquetDe(id)?.nom ?? 'projet'));
        const attendu = nomsDePaquets.has('@pdf-lib/fontkit') ? 'fontkit' : 'pdf-lib';
        assert.ok(basename(morceau.fileName).startsWith(`${attendu}-`), `${morceau.fileName} : ${[...nomsDePaquets]}`);
        assert.ok(!(nomsDePaquets.has('@pdf-lib/fontkit') && nomsDePaquets.has('pdf-lib')), morceau.fileName);
      }
      const desSorties = new Set([...morceauxDePolice, ...morceauxDActifs, ...deLaProduction.map((m) => m.fileName)]);

      // Au lancement, la page charge les scripts du HTML et les imports
      // statiques de son point d'entrée, et précharge les modulepreload.
      const entrees = morceaux.filter((m) => m.isEntry);
      assert.ok(entrees.length > 0, 'aucun point d’entrée');
      const statiques = new Set();
      const aSuivre = entrees.map((m) => m.fileName);
      while (aSuivre.length > 0) {
        const nom = aSuivre.pop();
        if (statiques.has(nom)) continue;
        statiques.add(nom);
        aSuivre.push(...(morceaux.find((m) => m.fileName === nom)?.imports ?? []));
      }
      const html = readFileSync(join(sortie, 'index.html'), 'utf8');
      const prechargements = [...html.matchAll(/<link\b[^>]*\brel=["']?modulepreload\b[^>]*>/gi)].map(
        ([balise]) => /\shref\s*=\s*["']?\.?\/?([^"'\s>]+)/i.exec(balise)?.[1] ?? '',
      );
      const auLancement = [...statiques, ...prechargements, ...scriptsDe(html).map((s) => (s.src ?? '').replace(/^\.\//, ''))];
      assert.deepEqual(auLancement.filter((nom) => desSorties.has(nom)), []);

      // Les avis et les textes des deux licences du logiciel : copiés tels
      // quels de public/licences/, d'où l'exécutable les emporte.
      for (const avis of ['NotoSans-OFL.txt', 'TIERS.txt', 'AGPL-3.0-or-later.txt', 'LiLiQ-Rplus-1.1.txt']) {
        assert.equal(
          readFileSync(join(sortie, 'licences', avis), 'utf8'),
          readFileSync(join(RACINE, 'public', 'licences', avis), 'utf8'),
          avis,
        );
      }

      // Chaque paquet des morceaux construits, travailleur compris, a sa
      // section dans TIERS.txt, à la version et sous la licence de son
      // package.json.
      const tiers = sectionsDesTiers(readFileSync(join(RACINE, 'public', 'licences', 'TIERS.txt'), 'utf8'));
      const ids = [...morceaux, ...travailleur.morceaux].flatMap((m) => m.moduleIds);
      const construits = new Map();
      for (const id of ids) {
        const paquet = paquetDe(id);
        if (paquet !== null) construits.set(paquet.nom, paquet.dossier);
      }
      assert.ok(construits.has('svelte'), `svelte absent des ${construits.size} paquets construits`);
      const manquants = [...construits]
        .map(([nom, dossier]) => {
          const { version, license } = JSON.parse(readFileSync(join(dossier, 'package.json'), 'utf8'));
          return { nom, version, licence: license };
        })
        .filter(({ nom, version, licence }) => !tiers.some((s) => s.nom === nom && s.version === version && s.licence === licence))
        .map(({ nom, version, licence }) => `${nom} ${version} — ${licence}`);
      assert.deepEqual(manquants, []);

      // La police de l'interface (jetons.css) : les deux fichiers de
      // src/polices sont émis dans www/, chacun une fois, octet pour octet,
      // et aucune autre police ; une feuille qui en nomme une la trouve dans
      // www/, et les deux sont nommées.
      const fichiers = readdirSync(sortie, { recursive: true, withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => join(e.parentPath, e.name));
      const sources = ['NotoSans-Regular.ttf', 'NotoSans-Bold.ttf'].map((f) => sha256(readFileSync(join(RACINE, 'src', 'polices', f))));
      const polices = fichiers.filter((f) => extname(f) === '.ttf');
      assert.deepEqual(
        polices.map((f) => sha256(readFileSync(f))).sort(),
        [...sources].sort(),
        `polices émises : ${polices.map((f) => relative(sortie, f)).join(', ') || 'aucune'}`,
      );
      const nommees = new Set();
      for (const feuille of fichiers.filter((f) => extname(f) === '.css')) {
        for (const adresse of adressesChargees('css', readFileSync(feuille, 'utf8')).filter((a) => /\.ttf$/i.test(a))) {
          const cible = resolve(dirname(feuille), adresse);
          assert.ok(fichiers.includes(cible), `${relative(sortie, feuille)} : ${adresse} absent de la construction`);
          nommees.add(cible);
        }
      }
      assert.deepEqual([...nommees].sort(), [...polices].sort(), 'polices que les feuilles nomment');
    } finally {
      rmSync(sortie, { recursive: true, force: true });
    }
  });

  test('chaque section de TIERS.txt nomme un paquet du verrou, à sa version, sous la licence que porte son package.json', () => {
    const { packages: paquets } = JSON.parse(readFileSync(join(RACINE, 'package-lock.json'), 'utf8'));
    const tiers = sectionsDesTiers(readFileSync(join(RACINE, 'public', 'licences', 'TIERS.txt'), 'utf8'));
    assert.ok(tiers.length > 0, 'TIERS.txt ne porte aucune section de paquet');
    const fautes = tiers
      .filter(({ nom, version, licence }) => {
        const entrees = Object.entries(paquets).filter(
          ([chemin, entree]) => chemin.endsWith(`node_modules/${nom}`) && entree.version === version,
        );
        return !entrees.some(([, entree]) => entree.license === licence);
      })
      .map(({ nom, version, licence }) => `${nom} ${version} — ${licence}`);
    assert.deepEqual(fautes, []);
    // Les paquets de la production PDF ont leur avis, même quand aucune
    // page ne les importe encore.
    for (const nom of ['pdf-lib', '@pdf-lib/fontkit', '@pdf-lib/standard-fonts', '@pdf-lib/upng', 'pako', 'tslib']) {
      assert.ok(tiers.some((s) => s.nom === nom), `${nom} sans avis`);
    }
  });

  // La construction minifiée retire les commentaires ordinaires : l'avis
  // qu'un code incorporé porte en tête n'arrive dans www/ que par TIERS.txt.
  // Chaque ligne « Copyright … » d'un commentaire de la construction publiée
  // de fontkit y figure donc telle quelle, et une section « incorporé » qui
  // nomme Apache porte le texte entier de l'Apache License 2.0. Une ligne
  // « Copyright » est le texte du titulaire : aucune incise française n'y
  // entre, elle va dans l'en-tête de la section.
  test('TIERS.txt porte mot pour mot les avis que les commentaires de fontkit incorporent, et le texte de leur licence', () => {
    const tiers = readFileSync(join(RACINE, 'public', 'licences', 'TIERS.txt'), 'utf8');
    const lignes = new Set(tiers.split('\n').map((l) => l.trim()));
    const dossier = join(RACINE, 'node_modules', '@pdf-lib', 'fontkit');
    const { module: entree } = JSON.parse(readFileSync(join(dossier, 'package.json'), 'utf8'));
    const code = readFileSync(join(dossier, entree), 'utf8');
    const avis = [
      ...code.matchAll(/^\s*(?:\/\/|\/\*|\*)\s*(Copyright\b.*\S)\s*$/gm),
    ].map(([, ligne]) => ligne);
    assert.ok(avis.length > 0, `aucun avis dans ${entree}`);
    assert.deepEqual([...new Set(avis)].filter((ligne) => !lignes.has(ligne)), []);

    const incorporees = tiers.split(/^=+$/m).filter((section) => /^\s*incorporé à /.test(section));
    assert.ok(incorporees.length > 0, 'aucune section « incorporé »');
    const TERMES_APACHE = [
      'Version 2.0, January 2004',
      'TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION',
      ...['Definitions', 'Grant of Copyright License', 'Grant of Patent License', 'Redistribution', 'Submission of Contributions', 'Trademarks', 'Disclaimer of Warranty', 'Limitation of Liability', 'Accepting Warranty or Additional Liability'].map(
        (titre, i) => `${i + 1}. ${titre}.`,
      ),
      'END OF TERMS AND CONDITIONS',
    ];
    const sansTexteApache = incorporees
      .filter((section) => /Apache/.test(section))
      .filter((section) => TERMES_APACHE.some((terme) => !section.includes(terme)))
      .map((section) => section.trim().split('\n')[0]);
    assert.deepEqual(sansTexteApache, []);
    if (/Licensed under the Apache License/.test(code)) {
      assert.ok(incorporees.some((section) => /Apache/.test(section)), 'du code Apache-2.0 sans section qui le nomme');
    }

    const incises = tiers.split('\n').filter((l) => /^Copyright\b/.test(l) && /[àâçéèêëîïôûùüœ]/.test(l));
    assert.deepEqual(incises, []);
  });
});
