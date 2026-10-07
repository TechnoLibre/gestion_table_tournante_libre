// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Lecture des jetons, simulation des dichromaties, contraste et teinte
// réservée (§ 12.7, § 13.3, § 14.5). Les fonctions s'éprouvent d'abord sur des
// feuilles d'épreuve écrites ici, où chaque défaut est posé exprès, puis sur
// le vrai fichier de jetons : ses familles, ses deux thèmes, les jetons que
// lisent les composants, la teinte du conflit.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from '../../test/lanceur.js';
import {
  SIMULATIONS,
  contraste,
  lireBlocs,
  lireJetons,
  simuler,
  teinte,
  verifierPalette,
  verifierTeinteReservee,
} from './palette.js';

const DOSSIER = fileURLToPath(new URL('.', import.meta.url));
const JETONS = readFileSync(new URL('./jetons.css', import.meta.url), 'utf8');
const NOMS_SIMULATIONS = ['protanopie', 'deuteranopie', 'tritanopie'];

// Feuille d'épreuve : le même corps de couleurs dans les deux thèmes, le
// clair valant aussi sans attribut.
function feuille(couleurs, sombre = couleurs) {
  const corps = (table) =>
    Object.entries(table)
      .map(([nom, valeur]) => `  ${nom}: ${valeur};`)
      .join('\n');
  return [
    ':root { --espace-1: 0.25rem; }',
    `:root,\n:root[data-theme='clair'] {\n  color-scheme: light;\n${corps(couleurs)}\n}`,
    `:root[data-theme="sombre"] {\n  color-scheme: dark;\n${corps(sombre)}\n}`,
  ].join('\n\n');
}

// Composantes sRGB de 0 à 255 d'une couleur #rrggbb.
function hex(valeur) {
  return [1, 3, 5].map((i) => Number.parseInt(valeur.slice(i, i + 2), 16));
}

const enHex = (c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

describe('lireBlocs et lireJetons', () => {
  test('lit les blocs dans leur ordre, commentaires ôtés, et les couleurs de chaque thème', () => {
    const css = [
      "/* { un commentaire n'ouvre aucun bloc } */",
      ':root { --espace-1: 0.25rem; --police-interface: system-ui, sans-serif; }',
      ":root, :root[data-theme='clair'] {",
      '  --couleur-a: #fff;',
      '  --couleur-b: #102030;',
      '  --couleur-c: rgb(1, 2, 3);',
      '  --couleur-d: rgb(4 5 6);',
      '  --couleur-e: var(--couleur-b);',
      '  --couleur-f: rgba(7, 8, 9, 0.5);',
      '  --couleur-g: #10203080;',
      '  --couleur-h: transparent;',
      '}',
      ':root[data-theme="sombre"] { --couleur-a: #000000; }',
    ].join('\n');
    const blocs = lireBlocs(css);
    assert.equal(blocs.length, 3);
    assert.deepEqual(blocs[0].selecteurs, [':root']);
    assert.deepEqual(blocs[1].selecteurs, [':root', ":root[data-theme='clair']"]);
    assert.deepEqual(blocs[2].selecteurs, [":root[data-theme='sombre']"]);
    assert.equal(blocs[0].declarations.get('--police-interface'), 'system-ui, sans-serif');

    const clair = lireJetons(css, 'clair');
    assert.deepEqual([...clair.keys()], [
      '--couleur-a', '--couleur-b', '--couleur-c', '--couleur-d',
      '--couleur-e', '--couleur-f', '--couleur-g', '--couleur-h',
    ]);
    assert.deepEqual(clair.get('--couleur-a'), [255, 255, 255, 1]);
    assert.deepEqual(clair.get('--couleur-b'), [16, 32, 48, 1]);
    assert.deepEqual(clair.get('--couleur-c'), [1, 2, 3, 1]);
    assert.deepEqual(clair.get('--couleur-d'), [4, 5, 6, 1]);
    assert.deepEqual(clair.get('--couleur-e'), [16, 32, 48, 1]);
    assert.deepEqual(clair.get('--couleur-f'), [7, 8, 9, 0.5]);
    assert.deepEqual(clair.get('--couleur-g'), [16, 32, 48, 128 / 255]);
    assert.deepEqual(clair.get('--couleur-h'), [0, 0, 0, 0]);
    assert.deepEqual([...lireJetons(css, 'sombre')], [['--couleur-a', [0, 0, 0, 1]]]);
    // Sans attribut : les seuls blocs :root, ceux que le clair partage.
    assert.deepEqual(lireJetons(css, null), clair);
  });

  test('lève sur un thème absent, une couleur illisible, un renvoi sans cible et un bloc imbriqué', () => {
    const css = feuille({ '--couleur-a': '#ffffff' });
    assert.throws(() => lireJetons(css, 'contraste'), /contraste/);
    assert.throws(() => lireJetons(feuille({ '--couleur-a': 'hsl(0 0% 50%)' }), 'clair'), /--couleur-a/);
    assert.throws(() => lireJetons(feuille({ '--couleur-a': 'var(--couleur-z)' }), 'clair'), /--couleur-z/);
    assert.throws(
      () => lireJetons(feuille({ '--couleur-a': 'var(--couleur-b)', '--couleur-b': 'var(--couleur-a)' }), 'clair'),
      /--couleur-a/,
    );
    assert.throws(
      () => lireBlocs('@media (prefers-color-scheme: dark) { :root { --couleur-a: #000; } }'),
      /imbriqué/,
    );
    assert.throws(() => lireBlocs(':root { --couleur-a: #000;'), /fermé/);
  });

  test('lève sur une couleur déclarée sous un autre sélecteur que :root et les deux thèmes : elle masquerait le jeton lu', () => {
    const base = feuille({ '--couleur-sol': '#eeeeee', '--couleur-focus': '#5a3fc0' });
    for (const intrus of [
      ":root[data-theme='sombre'] svg { --couleur-sol: #ff8a80; --couleur-focus: #e8e8e8; }",
      'html { --couleur-sol: #ff8a80; }',
      ":root[data-theme='contraste'] { --couleur-sol: #ff8a80; }",
      ":root, .plan { --couleur-sol: #ff8a80; }",
    ]) {
      const css = `${base}\n${intrus}`;
      for (const theme of ['clair', 'sombre', null]) {
        assert.throws(() => lireJetons(css, theme), /sélecteur/, `${theme} : ${intrus}`);
      }
      assert.throws(() => lireJetons(`${JETONS}\n${intrus}`, 'sombre'), /sélecteur/, intrus);
    }
    // Un autre sélecteur sans couleur n'est pas lu, et ne lève pas.
    assert.deepEqual(lireJetons(`${base}\n.plan { --espace-1: 1rem; }`, 'clair'), lireJetons(base, 'clair'));
  });
});

describe('contraste et simulations', () => {
  test('noir sur blanc vaut 21, une couleur sur elle-même 1, dans les deux sens', () => {
    const noir = [0, 0, 0, 1];
    const blanc = [255, 255, 255, 1];
    assert.ok(Math.abs(contraste(noir, blanc) - 21) < 1e-9);
    assert.equal(contraste(blanc, noir), contraste(noir, blanc));
    assert.equal(contraste([90, 120, 30, 1], [90, 120, 30, 1]), 1);
    // Valeur connue : #767676 sur blanc, 4,54:1 au sens des WCAG.
    assert.ok(Math.abs(contraste(hex('#767676'), hex('#ffffff')) - 4.54) < 0.01);
  });

  test("lève sur une couleur à canal alpha partiel : le ratio d'une couleur composée mentirait", () => {
    assert.throws(() => contraste([0, 0, 0, 0.5], [255, 255, 255, 1]), /alpha/);
    assert.throws(() => contraste([0, 0, 0, 1], [255, 255, 255, 0]), /alpha/);
    assert.ok(contraste([0, 0, 0], [255, 255, 255]) > 20);
  });

  test('les trois matrices sont celles de Machado, Oliveira et Fernandes, sévérité 1', () => {
    assert.deepEqual(Object.keys(SIMULATIONS).sort(), [...NOMS_SIMULATIONS].sort());
    assert.deepEqual(SIMULATIONS.protanopie[0], [0.152286, 1.052583, -0.204868]);
    assert.deepEqual(SIMULATIONS.deuteranopie[1], [0.280085, 0.672501, 0.047413]);
    assert.deepEqual(SIMULATIONS.tritanopie[2], [0.004733, 0.691367, 0.3039]);
  });

  test('le blanc et le noir sont des points fixes des trois matrices, à 1/255 près ; alpha intact', () => {
    assert.equal(NOMS_SIMULATIONS.length, 3);
    for (const nom of NOMS_SIMULATIONS) {
      for (const couleur of [[255, 255, 255, 1], [0, 0, 0, 1]]) {
        const simulee = simuler(couleur, nom);
        for (let i = 0; i < 3; i += 1) {
          assert.ok(Math.abs(simulee[i] - couleur[i]) <= 1, `${nom} ${couleur} → ${simulee}`);
        }
        assert.equal(simulee[3], 1);
      }
    }
    assert.throws(() => simuler([0, 0, 0, 1], 'achromatopsie'), /achromatopsie/);
  });

  test('un gris reste gris, un rouge pur perd sa clarté sous la protanopie', () => {
    const gris = simuler([118, 118, 118, 1], 'deuteranopie');
    assert.ok(Math.abs(gris[0] - 118) <= 1 && Math.abs(gris[2] - 118) <= 1, `${gris}`);
    const rouge = [255, 0, 0, 1];
    assert.ok(contraste(simuler(rouge, 'protanopie'), [0, 0, 0, 1]) < contraste(rouge, [0, 0, 0, 1]));
  });
});

describe('verifierPalette', () => {
  // Cherche un rouge et un vert qui tiennent 3:1 en couleurs d'origine et
  // tombent sous 3:1 sous au moins une simulation.
  function coupleRougeVert() {
    for (let a = 0; a <= 200; a += 8) {
      for (let v = 40; v <= 200; v += 8) {
        const rouge = [255, a, a, 1];
        const vert = [0, v, 0, 1];
        if (contraste(rouge, vert) < 3) continue;
        const simule = NOMS_SIMULATIONS.some(
          (nom) => contraste(simuler(rouge, nom), simuler(vert, nom)) < 3,
        );
        if (simule) return { rouge, vert };
      }
    }
    return null;
  }

  test('un couple rouge-vert qui tient 3:1 en origine et tombe une fois simulé est refusé, sous simulation seulement', () => {
    const couple = coupleRougeVert();
    assert.notEqual(couple, null);
    const css = feuille({ '--couleur-rouge': enHex(couple.rouge.slice(0, 3)), '--couleur-vert': enHex(couple.vert.slice(0, 3)) });
    const fautes = verifierPalette(css, [{ jeton: '--couleur-rouge', fonds: ['--couleur-vert'], seuil: 3 }]);
    assert.ok(fautes.length > 0);
    assert.ok(fautes.every((f) => f.simulation !== 'origine'), JSON.stringify(fautes));
    assert.ok(fautes.every((f) => f.ratio < 3 && f.seuil === 3));
    assert.ok(fautes.every((f) => f.jeton === '--couleur-rouge' && f.fond === '--couleur-vert'));
    assert.deepEqual([...new Set(fautes.map((f) => f.theme))], ['clair', 'sombre']);
  });

  test('une marque qui tient sur son premier fond et pas sur le second est refusée sur le second', () => {
    const css = feuille({
      '--couleur-marque': '#202020',
      '--couleur-clair': '#ffffff',
      '--couleur-sombre': '#000000',
    });
    const fautes = verifierPalette(css, [
      { jeton: '--couleur-marque', fonds: ['--couleur-clair', '--couleur-sombre'], seuil: 3 },
    ]);
    // Deux thèmes, l'origine et trois simulations : huit fautes, toutes sur le second fond.
    assert.equal(fautes.length, 8);
    assert.ok(fautes.every((f) => f.fond === '--couleur-sombre'));
    assert.deepEqual(
      fautes.map((f) => `${f.theme}:${f.simulation}`),
      ['clair', 'sombre'].flatMap((t) => ['origine', ...NOMS_SIMULATIONS].map((s) => `${t}:${s}`)),
    );
  });

  test('rend [] quand chaque entrée tient sur chaque fond ; lève sur un jeton inconnu', () => {
    const css = feuille({ '--couleur-texte': '#000000', '--couleur-fond': '#ffffff' }, { '--couleur-texte': '#ffffff', '--couleur-fond': '#000000' });
    assert.deepEqual(verifierPalette(css, [{ jeton: '--couleur-texte', fonds: ['--couleur-fond'], seuil: 4.5 }]), []);
    assert.throws(
      () => verifierPalette(css, [{ jeton: '--couleur-texte', fonds: ['--couleur-absente'], seuil: 3 }]),
      /--couleur-absente/,
    );
  });
});

describe('teinte et verifierTeinteReservee (§ 12.7)', () => {
  test('la teinte HSL ne vaut que pour une couleur dont les composantes s’écartent de 26 au moins', () => {
    assert.equal(teinte([255, 0, 0, 1]), 0);
    assert.equal(teinte([0, 255, 0, 1]), 120);
    assert.equal(teinte([0, 0, 255, 1]), 240);
    assert.equal(teinte([255, 0, 128, 1]) > 329 && teinte([255, 0, 128, 1]) < 331, true);
    assert.equal(teinte([138, 125, 125, 1]), null); // écart 13 : gris
    assert.equal(teinte([125, 100, 100, 1]), null); // écart 25 : gris
    assert.notEqual(teinte([126, 100, 100, 1]), null); // écart 26 : chromatique
  });

  test('un refus de la teinte du conflit et d’une autre clarté est refusé, valeurs pourtant distinctes', () => {
    const conflit = '#c62828';
    const refus = '#5a1212';
    assert.notEqual(conflit, refus);
    assert.ok(Math.abs(teinte(hex(conflit)) - teinte(hex(refus))) < 1);
    const css = feuille({
      '--couleur-conflit': conflit,
      '--couleur-conflit-trame': '#e57373',
      '--couleur-refus': refus,
      '--couleur-gris-rose': '#8a7d7d',
      '--couleur-bleu': '#1f3a5f',
    });
    const fautes = verifierTeinteReservee(css, ['--couleur-conflit', '--couleur-conflit-trame']);
    assert.deepEqual(fautes.map((f) => `${f.theme}:${f.jeton}`), ['clair:--couleur-refus', 'sombre:--couleur-refus']);
    assert.ok(fautes.every((f) => f.ecart < 30));
  });

  test('le jeton de conflit lui-même doit être chromatique ; une teinte à 30° passe, à 29° non ; le cercle se referme', () => {
    const gris = feuille({ '--couleur-conflit': '#808080', '--couleur-bleu': '#1f3a5f' });
    assert.deepEqual(verifierTeinteReservee(gris, ['--couleur-conflit']), [
      { theme: 'clair', jeton: '--couleur-conflit', ecart: null },
      { theme: 'sombre', jeton: '--couleur-conflit', ecart: null },
    ]);
    // Conflit à 0° ; 30° et 330° passent, 29° et 331° non.
    const css = feuille({
      '--couleur-conflit': '#ff0000',
      '--couleur-a': '#ff8000', // 30,1°
      '--couleur-b': '#ff7b00', // 28,9°
      '--couleur-c': '#ff0080', // 329,9°
      '--couleur-d': '#ff0079', // 331,5°
    });
    const fautes = verifierTeinteReservee(css, ['--couleur-conflit']);
    assert.deepEqual(fautes.map((f) => `${f.theme}:${f.jeton}`), [
      'clair:--couleur-b', 'clair:--couleur-d', 'sombre:--couleur-b', 'sombre:--couleur-d',
    ]);
  });
});

// Fichiers .svelte et .css de src/interface, sous-dossiers compris, triés.
function sourcesDeStyle() {
  return readdirSync(DOSSIER, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /\.(svelte|css)$/.test(e.name))
    .map((e) => join(e.parentPath, e.name))
    .sort();
}

describe('jetons.css', () => {
  // Lue dans chaque épreuve : une feuille illisible fait échouer chacune, sans
  // empêcher les épreuves des fonctions de se lancer.
  const blocs = () => lireBlocs(JETONS);
  const declares = () => new Set(blocs().flatMap((b) => [...b.declarations.keys()]));
  const nomsDe = (prefixe) => [...declares()].filter((n) => n.startsWith(prefixe));

  test('un fichier, toutes les familles : couleurs, polices, échelle typographique, espacements, rayons, ombres (§ 13.3)', () => {
    for (const prefixe of ['--couleur-', '--police-', '--taille-', '--espace-', '--rayon-', '--ombre-']) {
      assert.ok(nomsDe(prefixe).length > 0, `aucun jeton ${prefixe}…`);
    }
    // Une échelle a trois pas au moins, de valeurs distinctes.
    const tailles = new Set(
      blocs().flatMap((b) => [...b.declarations].filter(([n]) => n.startsWith('--taille-')).map(([, v]) => v)),
    );
    assert.ok(tailles.size >= 3, `${tailles.size} tailles distinctes`);
  });

  test('deux thèmes posés par data-theme, de mêmes jetons de couleur ; sans attribut, le clair ; aucune préférence du système lue', () => {
    const clair = lireJetons(JETONS, 'clair');
    const sombre = lireJetons(JETONS, 'sombre');
    assert.ok(clair.size >= 20, `${clair.size} couleurs`);
    assert.deepEqual([...sombre.keys()].sort(), [...clair.keys()].sort());
    assert.deepEqual(lireJetons(JETONS, null), clair);
    // Le thème sombre redéfinit chaque couleur à une autre valeur que le clair,
    // sauf celles que les deux thèmes partagent exprès.
    const differentes = [...clair.keys()].filter((n) => String(clair.get(n)) !== String(sombre.get(n)));
    assert.ok(differentes.length > clair.size / 2, `${differentes.length} couleurs changent`);
    assert.equal(/prefers-color-scheme/.test(JETONS.replace(/\/\*[\s\S]*?\*\//g, '')), false);
  });

  test('chaque var(--…) lu par un .svelte ou un .css de src/interface est déclaré dans jetons.css', () => {
    const sources = sourcesDeStyle();
    assert.ok(sources.length >= 2, `${sources.length} sources de style`);
    const lus = [];
    for (const chemin of sources) {
      for (const [, nom] of readFileSync(chemin, 'utf8').matchAll(/var\(\s*(--[\w-]+)/g)) {
        lus.push({ chemin, nom });
      }
    }
    assert.ok(lus.length >= 11, `${lus.length} lectures`);
    const noms = declares();
    const absents = lus.filter((l) => !noms.has(l.nom)).map((l) => `${l.chemin} ${l.nom}`);
    assert.deepEqual(absents, []);
  });

  test("les onze jetons d'App.svelte gardent leur nom", () => {
    const noms = declares();
    for (const nom of [
      '--couleur-page-fond', '--couleur-page-texte', '--couleur-bandeau-fond',
      '--couleur-bandeau-texte', '--couleur-bandeau-filet', '--police-interface',
      '--taille-texte-bandeau', '--espace-2', '--espace-3', '--espace-4', '--rayon-1',
    ]) {
      assert.ok(noms.has(nom), nom);
    }
  });

  test('la teinte du conflit est réservée (§ 12.7) : chromatique, sa valeur à lui seul, à 30° de tout autre jeton chromatique', () => {
    for (const theme of ['clair', 'sombre']) {
      const jetons = lireJetons(JETONS, theme);
      const conflit = jetons.get('--couleur-conflit');
      assert.notEqual(conflit, undefined, theme);
      assert.notEqual(teinte(conflit), null, `${theme} : conflit achromatique`);
      const memeValeur = [...jetons].filter(([n, c]) => n !== '--couleur-conflit' && String(c) === String(conflit));
      assert.deepEqual(memeValeur.map(([n]) => n), [], theme);
    }
    assert.deepEqual(verifierTeinteReservee(JETONS, ['--couleur-conflit']), []);
  });
});
