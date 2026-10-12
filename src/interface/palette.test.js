// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Lecture des jetons, simulation des dichromaties, contraste et teinte
// réservée (§ 12.7, § 13.3, § 14.5). Les fonctions s'éprouvent d'abord sur des
// feuilles d'épreuve écrites ici, où chaque défaut est posé exprès, puis sur
// le vrai fichier de jetons : ses familles, ses deux thèmes, les jetons que
// lisent les composants, les teintes des trois sortes de conflit.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from '../../test/lanceur.js';
import { JETONS_CONFLIT, JETON_RETRAIT, MARQUES } from './marques.js';
import {
  SIMULATIONS,
  contraste,
  ecartPercu,
  lireBlocs,
  lireJetons,
  oklab,
  simuler,
  teinte,
  verifierClartes,
  verifierPalette,
  verifierSeparation,
  verifierTeintesReservees,
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
  test('le bloc du clair porte aussi [data-impression] : ses couleurs se lisent comme celles du clair, le papier imprimé les redéclare', () => {
    const css = [
      ":root, :root[data-theme='clair'], [data-impression] { --couleur-a: #ffffff; --couleur-b: #102030; }",
      ':root[data-theme="sombre"] { --couleur-a: #000000; --couleur-b: #a0b0c0; }',
    ].join('\n');
    assert.deepEqual(lireBlocs(css)[0].selecteurs, [':root', ":root[data-theme='clair']", '[data-impression]']);
    assert.deepEqual([...lireJetons(css, 'clair')], [['--couleur-a', [255, 255, 255, 1]], ['--couleur-b', [16, 32, 48, 1]]]);
    assert.deepEqual(lireJetons(css, null), lireJetons(css, 'clair'));
    assert.deepEqual([...lireJetons(css, 'sombre')], [['--couleur-a', [0, 0, 0, 1]], ['--couleur-b', [160, 176, 192, 1]]]);
  });

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
    // Le document imprimé ne prend que les jetons du clair : [data-impression]
    // seul, ou posé sur le bloc du sombre, masquerait le jeton lu.
    for (const intrus of [
      '[data-impression] { --couleur-sol: #ff8a80; }',
      ":root[data-theme='sombre'], [data-impression] { --couleur-sol: #ff8a80; --couleur-focus: #e8e8e8; }",
      ':root, [data-impression] { --couleur-sol: #ff8a80; }',
    ]) {
      for (const theme of ['clair', 'sombre', null]) {
        assert.throws(() => lireJetons(`${base}\n${intrus}`, theme), /sélecteur/, `${theme} : ${intrus}`);
      }
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

describe('teinte et verifierTeintesReservees (§ 12.7)', () => {
  test('la teinte HSL ne vaut que pour une couleur dont les composantes s’écartent de 26 au moins', () => {
    assert.equal(teinte([255, 0, 0, 1]), 0);
    assert.equal(teinte([0, 255, 0, 1]), 120);
    assert.equal(teinte([0, 0, 255, 1]), 240);
    assert.equal(teinte([255, 0, 128, 1]) > 329 && teinte([255, 0, 128, 1]) < 331, true);
    assert.equal(teinte([138, 125, 125, 1]), null); // écart 13 : gris
    assert.equal(teinte([125, 100, 100, 1]), null); // écart 25 : gris
    assert.notEqual(teinte([126, 100, 100, 1]), null); // écart 26 : chromatique
  });

  test('un refus de la teinte d’un conflit et d’une autre clarté est refusé, valeurs pourtant distinctes', () => {
    const conflit = '#c62828';
    const refus = '#5a1212';
    assert.notEqual(conflit, refus);
    assert.ok(Math.abs(teinte(hex(conflit)) - teinte(hex(refus))) < 1);
    const css = feuille({
      '--couleur-conflit-a': conflit,
      '--couleur-conflit-b': '#1f8a3a',
      '--couleur-refus': refus,
      '--couleur-gris-rose': '#8a7d7d',
      '--couleur-bleu': '#1f3a5f',
    });
    const fautes = verifierTeintesReservees(css, ['--couleur-conflit-a', '--couleur-conflit-b']);
    assert.deepEqual(fautes.map((f) => `${f.theme}:${f.reservee}:${f.jeton}`), [
      'clair:--couleur-conflit-a:--couleur-refus',
      'sombre:--couleur-conflit-a:--couleur-refus',
    ]);
    assert.ok(fautes.every((f) => f.ecart < 30));
  });

  test('chaque teinte réservée est une référence : un jeton proche de la seconde est refusé ; deux teintes réservées ne se mesurent pas entre elles', () => {
    // Rouge à 0°, vert à 120° : le jeton à 135° n'est proche que du vert.
    const css = feuille({
      '--couleur-conflit-a': '#ff0000',
      '--couleur-conflit-b': '#00ff00',
      '--couleur-conflit-c': '#ff1000',
      '--couleur-sarcelle': '#00ff40',
      '--couleur-bleu': '#0000ff',
    });
    const fautes = verifierTeintesReservees(css, ['--couleur-conflit-a', '--couleur-conflit-b', '--couleur-conflit-c']);
    assert.deepEqual(fautes.map((f) => `${f.theme}:${f.reservee}:${f.jeton}`), [
      'clair:--couleur-conflit-b:--couleur-sarcelle',
      'sombre:--couleur-conflit-b:--couleur-sarcelle',
    ]);
  });

  test('une teinte réservée doit être chromatique ; une teinte à 30° passe, à 29° non ; le cercle se referme', () => {
    const gris = feuille({ '--couleur-conflit': '#808080', '--couleur-bleu': '#1f3a5f' });
    assert.deepEqual(verifierTeintesReservees(gris, ['--couleur-conflit']), [
      { theme: 'clair', reservee: '--couleur-conflit', jeton: '--couleur-conflit', ecart: null },
      { theme: 'sombre', reservee: '--couleur-conflit', jeton: '--couleur-conflit', ecart: null },
    ]);
    // Conflit à 0° ; 30° et 330° passent, 29° et 331° non.
    const css = feuille({
      '--couleur-conflit': '#ff0000',
      '--couleur-a': '#ff8000', // 30,1°
      '--couleur-b': '#ff7b00', // 28,9°
      '--couleur-c': '#ff0080', // 329,9°
      '--couleur-d': '#ff0079', // 331,5°
    });
    const fautes = verifierTeintesReservees(css, ['--couleur-conflit']);
    assert.deepEqual(fautes.map((f) => `${f.theme}:${f.jeton}`), [
      'clair:--couleur-b', 'clair:--couleur-d', 'sombre:--couleur-b', 'sombre:--couleur-d',
    ]);
    // Un jeton admis ne se mesure pas ; les autres, si.
    const admis = verifierTeintesReservees(css, ['--couleur-conflit'], ['--couleur-b']);
    assert.deepEqual(admis.map((f) => `${f.theme}:${f.jeton}`), ['clair:--couleur-d', 'sombre:--couleur-d']);
  });
});

describe('ecartPercu et verifierSeparation (§ 12.7 : simuler d’abord, puis mesurer l’écart)', () => {
  test('OKLab : le blanc vaut L = 1, le noir L = 0, un gris n’a ni a ni b ; l’écart du noir au blanc vaut 100, d’une couleur à elle-même 0, dans les deux sens', () => {
    const blanc = oklab([255, 255, 255, 1]);
    const noir = oklab([0, 0, 0, 1]);
    assert.ok(Math.abs(blanc[0] - 1) < 1e-4 && Math.abs(noir[0]) < 1e-9);
    const gris = oklab([118, 118, 118, 1]);
    assert.ok(Math.abs(gris[1]) < 1e-4 && Math.abs(gris[2]) < 1e-4, `${gris}`);
    assert.ok(Math.abs(ecartPercu([0, 0, 0, 1], [255, 255, 255, 1]) - 100) < 0.01);
    assert.equal(ecartPercu([90, 120, 30, 1], [90, 120, 30, 1]), 0);
    assert.equal(ecartPercu([200, 30, 30, 1], [30, 120, 200, 1]), ecartPercu([30, 120, 200, 1], [200, 30, 30, 1]));
  });

  test('un rouge et un vert de même clarté se séparent en couleurs d’origine et se confondent sous la deutéranopie : la faute n’est relevée que simulée', () => {
    // Cherche un vert de la clarté d'un rouge donné : leurs écarts d'origine
    // sont grands, et la deutéranopie les rapproche.
    const rouge = [200, 40, 40, 1];
    let vert = null;
    for (let v = 40; v <= 255 && vert === null; v += 1) {
      const candidat = [40, v, 40, 1];
      if (Math.abs(oklab(candidat)[0] - oklab(rouge)[0]) < 0.01) vert = candidat;
    }
    assert.notEqual(vert, null);
    assert.ok(ecartPercu(rouge, vert) > 20);
    assert.ok(ecartPercu(simuler(rouge, 'deuteranopie'), simuler(vert, 'deuteranopie')) < 10);
    const css = feuille({ '--couleur-rouge': enHex(rouge.slice(0, 3)), '--couleur-vert': enHex(vert.slice(0, 3)) });
    const fautes = verifierSeparation(css, ['--couleur-rouge', '--couleur-vert'], [], 10);
    assert.ok(fautes.length > 0);
    assert.ok(fautes.every((f) => f.simulation !== 'origine' && f.ecart < 10 && f.seuil === 10), JSON.stringify(fautes));
    assert.ok(fautes.some((f) => f.simulation === 'deuteranopie'));
    assert.ok(fautes.every((f) => f.jeton === '--couleur-rouge' && f.autre === '--couleur-vert'));
    assert.deepEqual([...new Set(fautes.map((f) => f.theme))], ['clair', 'sombre']);
  });

  test('chaque paire des jetons, puis chaque jeton contre chacun des autres ; les autres ne se mesurent pas entre eux ; un jeton absent lève', () => {
    const css = feuille({
      '--couleur-a': '#c01010',
      '--couleur-b': '#c11111',
      '--couleur-x': '#1010c0',
      '--couleur-y': '#1111c1',
    });
    const fautes = verifierSeparation(css, ['--couleur-a', '--couleur-x'], ['--couleur-b', '--couleur-y'], 5);
    // Origine et trois simulations, deux thèmes : a contre b et x contre y
    // se confondent partout ; a contre x, a contre y, x contre b se séparent.
    assert.deepEqual(
      [...new Set(fautes.map((f) => `${f.jeton}/${f.autre}`))],
      ['--couleur-a/--couleur-b', '--couleur-x/--couleur-y'],
    );
    assert.equal(fautes.length, 2 * 2 * 4);
    assert.throws(() => verifierSeparation(css, ['--couleur-a'], ['--couleur-absente'], 5), /--couleur-absente/);
  });
});

describe('verifierClartes : des teintes voisines se distinguent en clarté', () => {
  test('deux bleus de même clarté sont relevés, dans chaque thème ; un bleu et un ocre de même clarté passent : leurs teintes s’écartent', () => {
    const css = feuille({ '--couleur-a': '#2050b0', '--couleur-b': '#2a56b2', '--couleur-o': '#8a5a00' });
    const fautes = verifierClartes(css, ['--couleur-a', '--couleur-b', '--couleur-o'], 10);
    assert.deepEqual(fautes.map((f) => `${f.theme} ${f.jeton}/${f.autre}`), ['clair --couleur-a/--couleur-b', 'sombre --couleur-a/--couleur-b']);
    assert.ok(fautes.every((f) => f.seuil === 10 && f.ecart < 10 && f.ecart >= 0));
    assert.ok(Math.abs(oklab(hex('#2050b0'))[0] - oklab(hex('#8a5a00'))[0]) < 0.1, 'le bleu et l’ocre ont une clarté voisine');
  });

  test('une teinte à 29° de l’autre est voisine, à 31° elle ne l’est plus ; un gris est voisin de toute couleur', () => {
    // Trois couleurs de même clarté perçue, à 0,001 près : un bleu à 199,8°,
    // un bleu à 229,2° et un autre à 231,0°.
    const base = '#228ec3';
    for (const [autre, voisine] of [['#637ae3', true], ['#6679e4', false]]) {
      assert.ok(Math.abs(oklab(hex(base))[0] - oklab(hex(autre))[0]) < 0.001, autre);
      const ecart = teinte(hex(autre)) - teinte(hex(base));
      assert.ok(voisine ? ecart > 29 && ecart < 30 : ecart > 30 && ecart < 32, `${autre} : écart ${ecart}`);
      const css = feuille({ '--couleur-a': base, '--couleur-b': autre });
      assert.equal(verifierClartes(css, ['--couleur-a', '--couleur-b'], 5).length, voisine ? 2 : 0, autre);
    }
    const gris = feuille({ '--couleur-a': '#2050b0', '--couleur-g': '#56595e' });
    assert.equal(teinte(hex('#56595e')), null);
    assert.ok(Math.abs(oklab(hex('#2050b0'))[0] - oklab(hex('#56595e'))[0]) < 0.05);
    assert.equal(verifierClartes(gris, ['--couleur-a', '--couleur-g'], 10).length, 2);
  });

  test('deux bleus de clartés écartées passent ; le seuil se mesure en L × 100 ; un jeton absent lève', () => {
    const css = feuille({ '--couleur-clair': '#6f9be8', '--couleur-fonce': '#173a80' });
    const ecart = 100 * Math.abs(oklab(hex('#6f9be8'))[0] - oklab(hex('#173a80'))[0]);
    assert.deepEqual(verifierClartes(css, ['--couleur-clair', '--couleur-fonce'], ecart - 0.01), []);
    assert.equal(verifierClartes(css, ['--couleur-clair', '--couleur-fonce'], ecart + 0.01).length, 2);
    assert.throws(() => verifierClartes(css, ['--couleur-clair', '--couleur-absente'], 10), /--couleur-absente/);
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

  test('le document imprimé prend les jetons du clair dans les deux thèmes (§ 11.7) : le bloc du clair porte [data-impression], aucun autre', () => {
    const avecPapier = blocs().filter((b) => b.selecteurs.includes('[data-impression]'));
    assert.equal(avecPapier.length, 1);
    assert.ok(avecPapier[0].selecteurs.includes(":root[data-theme='clair']"));
    assert.ok([...avecPapier[0].declarations.keys()].some((nom) => nom.startsWith('--couleur-')));
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

  test('les trois teintes de conflit sont réservées (§ 12.7) : chromatiques, chacune sa valeur, à 30° de tout autre jeton chromatique', () => {
    assert.deepEqual(JETONS_CONFLIT, ['--couleur-conflit-appartenance', '--couleur-conflit-voisins', '--couleur-conflit-table']);
    for (const theme of ['clair', 'sombre']) {
      const jetons = lireJetons(JETONS, theme);
      for (const nom of JETONS_CONFLIT) {
        const couleur = jetons.get(nom);
        assert.notEqual(couleur, undefined, `${theme} : ${nom}`);
        assert.notEqual(teinte(couleur), null, `${theme} : ${nom} achromatique`);
        const memeValeur = [...jetons].filter(([n, c]) => n !== nom && String(c) === String(couleur));
        assert.deepEqual(memeValeur.map(([n]) => n), [], `${theme} : ${nom}`);
      }
      // Aucun autre jeton ne porte le préfixe des teintes de conflit.
      assert.deepEqual([...jetons.keys()].filter((n) => n.startsWith('--couleur-conflit')), JETONS_CONFLIT, theme);
    }
    assert.deepEqual(verifierTeintesReservees(JETONS, JETONS_CONFLIT, [JETON_RETRAIT]), []);
  });

  test('le rouge du retrait est le seul jeton admis près d’une teinte de conflit : chromatique, sa valeur à lui, peint sur la carte seulement, jamais sur le plan', () => {
    assert.equal(JETON_RETRAIT, '--couleur-retrait');
    // Sans l'admission, le retrait est la seule faute.
    assert.deepEqual([...new Set(verifierTeintesReservees(JETONS, JETONS_CONFLIT).map((f) => f.jeton))], [JETON_RETRAIT]);
    for (const theme of ['clair', 'sombre']) {
      const jetons = lireJetons(JETONS, theme);
      const couleur = jetons.get(JETON_RETRAIT);
      assert.notEqual(teinte(couleur), null, theme);
      const memeValeur = [...jetons].filter(([n, c]) => n !== JETON_RETRAIT && String(c) === String(couleur));
      assert.deepEqual(memeValeur.map(([n]) => n), [], theme);
    }
    const peintes = MARQUES.filter((m) => m.jeton === JETON_RETRAIT || m.fonds.includes(JETON_RETRAIT));
    assert.deepEqual(peintes.map((m) => [m.nom, [...m.fonds]]), [['retrait', ['--couleur-carte-fond', '--couleur-carte-fond-sourd']]]);
  });
});
