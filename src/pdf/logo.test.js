// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La lecture du logo vectoriel que le pied TechnoLibre dessine (§ 11.4) :
// le fichier de src/actifs, lu par le disque, rend ses trois formes dans
// leurs couleurs d'origine ; les commandes de chemin relatives, implicites
// et lissées se ramènent à des commandes absolues ; tout ce que le dessin
// ne rendrait pas fidèlement se refuse plutôt que de se perdre en silence.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from '../../test/lanceur.js';
import { CHEMIN_LOGO, lireLogo as lireFichier } from '../../test/logo.js';
import { lireLogo } from './logo.js';

const TOLERANCE = 1e-9;
const svg = (corps, racine = 'viewBox="0 0 100 20"') => new TextEncoder().encode(`<svg ${racine} xmlns="http://www.w3.org/2000/svg">${corps}</svg>`);
const tracer = (d) => lireLogo(svg(`<path d="${d}" fill="black"/>`)).formes[0].trace;
// Une couleur #rrggbb en fractions de 1, comme le logo la rend.
const fractions = (hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);

describe('lireLogo : le fichier de TechnoLibre', () => {
  const logo = lireLogo(lireFichier());
  const texte = readFileSync(CHEMIN_LOGO, 'utf8');

  test('250 × 50, trois formes dans l’ordre du fichier : le fond #243742, les lettres blanches, puis les lettres #FFD166', () => {
    assert.deepEqual([logo.largeur, logo.hauteur], [250, 50]);
    assert.deepEqual(
      logo.formes.map((forme) => forme.couleur),
      [fractions('#243742'), [1, 1, 1], fractions('#FFD166')],
    );
    assert.deepEqual(logo.formes[0].trace, [
      { op: 'M', x: 0, y: 0 },
      { op: 'L', x: 250, y: 0 },
      { op: 'L', x: 250, y: 50 },
      { op: 'L', x: 0, y: 50 },
      { op: 'Z' },
    ]);
  });

  test('chaque chemin garde ses sous-chemins et ses courbes ; H et V deviennent des L ; tout point tombe dans le cadre', () => {
    const chemins = [...texte.matchAll(/<path d="([^"]*)"/g)].map(([, d]) => d);
    assert.equal(chemins.length, 2);
    chemins.forEach((d, rang) => {
      const trace = logo.formes[rang + 1].trace;
      const compte = (lettre) => [...d].filter((c) => c === lettre).length;
      assert.equal(trace.filter(({ op }) => op === 'M').length, compte('M'));
      assert.equal(trace.filter(({ op }) => op === 'C').length, compte('C'));
      assert.equal(trace.filter(({ op }) => op === 'Z').length, compte('Z'));
      assert.equal(trace.filter(({ op }) => op === 'L').length, compte('L') + compte('H') + compte('V'));
    });
    assert.deepEqual(logo.formes[1].trace.slice(0, 3), [
      { op: 'M', x: 11.3898, y: 10.152 },
      { op: 'L', x: 4.81375, y: 10.152 },
      { op: 'L', x: 4.81375, y: 6.12 },
    ]);
    const points = logo.formes.flatMap(({ trace }) => trace.flatMap((p) => [[p.x, p.y], [p.x1, p.y1], [p.x2, p.y2]]));
    for (const [x, y] of points.filter(([x]) => x !== undefined)) {
      assert.ok(x >= 0 && x <= 250 && y >= 0 && y <= 50, `${x} ${y}`);
    }
  });

  test('deux lectures rendent la même valeur ; les octets reçus ne changent pas', () => {
    const octets = lireFichier();
    const copie = octets.slice();
    assert.deepEqual(lireLogo(octets), lireLogo(octets));
    assert.deepEqual(octets, copie);
  });
});

describe('lireLogo : les commandes de chemin', () => {
  test('les commandes relatives se rapportent au point courant ; z ramène au départ du sous-chemin', () => {
    assert.deepEqual(tracer('m10 2 l5 0 h5 v5 z m1 1 l1 1'), [
      { op: 'M', x: 10, y: 2 },
      { op: 'L', x: 15, y: 2 },
      { op: 'L', x: 20, y: 2 },
      { op: 'L', x: 20, y: 7 },
      { op: 'Z' },
      { op: 'M', x: 11, y: 3 },
      { op: 'L', x: 12, y: 4 },
    ]);
  });

  test('les coordonnées qui suivent un M sans lettre sont des L ; les nombres collés, signés ou en exposant se lisent', () => {
    assert.deepEqual(tracer('M.5.5 10,0-1e1 2E0'), [
      { op: 'M', x: 0.5, y: 0.5 },
      { op: 'L', x: 10, y: 0 },
      { op: 'L', x: -10, y: 2 },
    ]);
    assert.deepEqual(tracer('m1 1 2 0'), [
      { op: 'M', x: 1, y: 1 },
      { op: 'L', x: 3, y: 1 },
    ]);
  });

  test('S reflète le second point de contrôle de la courbe précédente, sinon part du point courant', () => {
    assert.deepEqual(tracer('M0 0 C1 2 3 4 5 5 S9 9 10 10'), [
      { op: 'M', x: 0, y: 0 },
      { op: 'C', x1: 1, y1: 2, x2: 3, y2: 4, x: 5, y: 5 },
      { op: 'C', x1: 7, y1: 6, x2: 9, y2: 9, x: 10, y: 10 },
    ]);
    assert.deepEqual(tracer('M0 0 s1 1 2 2'), [
      { op: 'M', x: 0, y: 0 },
      { op: 'C', x1: 0, y1: 0, x2: 1, y2: 1, x: 2, y: 2 },
    ]);
  });

  test('Q et T deviennent des cubiques de même tracé : contrôles aux deux tiers du point de contrôle quadratique', () => {
    const [, q, t] = tracer('M0 0 Q3 3 6 0 T12 0');
    const proche = (a, b) => Math.abs(a - b) < TOLERANCE;
    assert.equal(q.op, 'C');
    assert.ok([q.x1 - 2, q.y1 - 2, q.x2 - 4, q.y2 - 2, q.x - 6, q.y].every((v) => proche(v, 0)), JSON.stringify(q));
    // Le point de contrôle de T, reflet de (3, 3) autour de (6, 0) : (9, -3).
    assert.ok([t.x1 - 8, t.y1 + 2, t.x2 - 10, t.y2 + 2, t.x - 12, t.y].every((v) => proche(v, 0)), JSON.stringify(t));
  });

  test('un arc, une lettre inconnue, un nombre manquant ou un chemin qui ne s’ouvre pas sur M lèvent TypeError', () => {
    for (const d of ['M0 0 A5 5 0 0 1 10 10', 'M0 0 X1 1', 'M0 0 L1', 'L1 1', 'M0 0 C1 1 2', '']) {
      assert.throws(() => tracer(d), TypeError, d);
    }
  });
});

describe('lireLogo : le fichier SVG', () => {
  test('la boîte de vue donne les dimensions et l’origine ; sans elle, width et height', () => {
    const decale = lireLogo(svg('<rect x="12" y="7" width="3" height="2" fill="#000"/>', 'viewBox="10 5 40 8"'));
    assert.deepEqual([decale.largeur, decale.hauteur], [40, 8]);
    assert.deepEqual(decale.formes[0].trace[0], { op: 'M', x: 2, y: 2 });
    const sansBoite = lireLogo(svg('<rect width="3" height="2" fill="#000"/>', 'width="30" height="6"'));
    assert.deepEqual([sansBoite.largeur, sansBoite.hauteur], [30, 6]);
  });

  test('les couleurs : #rgb, #rrggbb, white, black ; fill="none" n’est pas dessiné ; sans fill, celui de la racine, à défaut le noir', () => {
    const logo = lireLogo(
      svg(
        '<rect width="1" height="1" fill="#0f8"/><rect width="1" height="1" fill="#FF0080"/><rect width="1" height="1" fill="none"/>' +
          '<rect width="1" height="1" fill="white"/><rect width="1" height="1"/>',
        'viewBox="0 0 10 10" fill="black"',
      ),
    );
    assert.deepEqual(
      logo.formes.map(({ couleur }) => couleur),
      [[0, 1, 0x88 / 255], [1, 0, 0x80 / 255], [1, 1, 1], [0, 0, 0]],
    );
    assert.equal(lireLogo(svg('<rect width="1" height="1"/>', 'viewBox="0 0 2 2" fill="none"')).formes.length, 0);
    assert.deepEqual(lireLogo(svg('<rect width="1" height="1"/>', 'viewBox="0 0 2 2"')).formes[0].couleur, [0, 0, 0]);
  });

  test('ce que le dessin ne rendrait pas fidèlement se refuse : autre élément, transformation, trait, opacité, style, couleur inconnue', () => {
    const refuses = [
      '<circle r="2" fill="#000"/>',
      '<g><path d="M0 0 L1 1" fill="#000"/></g>',
      '<path d="M0 0 L1 1" fill="#000" transform="scale(2)"/>',
      '<path d="M0 0 L1 1" fill="#000" stroke="#000"/>',
      '<path d="M0 0 L1 1" fill="#000" opacity="0.5"/>',
      '<path d="M0 0 L1 1" fill="#000" fill-rule="evenodd"/>',
      '<path d="M0 0 L1 1" style="fill:#000"/>',
      '<path d="M0 0 L1 1" fill="red"/>',
      '<rect width="1" height="1" rx="1" fill="#000"/>',
    ];
    for (const corps of refuses) assert.throws(() => lireLogo(svg(corps)), TypeError, corps);
    assert.throws(() => lireLogo(svg('<rect width="1" height="1" fill="#000"/>', '')), TypeError, 'sans dimensions');
  });

  test('des octets qui ne sont pas un SVG lèvent TypeError', () => {
    for (const faute of [null, 'texte', new TextEncoder().encode('<html></html>'), new Uint8Array([0xff, 0xfe])]) {
      assert.throws(() => lireLogo(faute), TypeError, String(faute));
    }
  });
});
