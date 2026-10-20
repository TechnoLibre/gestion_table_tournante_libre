// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le modèle pur des graphiques de la page de qualité (§ 12.3, § 12.4,
// § 12.5, § 12.7) : les traits et leurs motifs, la disposition d'un
// escalier, de points de relevé, de barres et d'une grille, le pointage au
// plus proche de chaque forme, la ligne de l'infobulle et les cellules du
// jumeau, la troncature d'un nom. La mesure du texte est injectée : ici, une
// largeur fixe par caractère. Les noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../../test/lanceur.js';
import { cheminEscalier, cheminPoints } from '../../../geometrie/graphique.js';
import { constante } from '../../../geometrie/constantes.js';
import { MARQUES_GRAPHIQUE, NIVEAUX_GRAPHIQUE } from '../../marques.js';
import {
  ECART_AXE_PX,
  ECART_SEGMENTS_PX,
  ESPACE_PX,
  LARGEUR_MIN_CONTOUR_PX,
  LARGEUR_NOM_PX,
  RETRAIT_CASE_PX,
  REMPLISSAGES,
  SIGNES,
  SIGNE_PX,
  TRAIT_CONTOUR_PX,
  TRAITS,
  ancrePoint,
  ancreRang,
  cadreGrille,
  celluleDe,
  cheminSigne,
  ciblePoint,
  cibleCase,
  cibleLigne,
  cibleRang,
  dispositionBarres,
  dispositionEscalier,
  dispositionGrille,
  dispositionPoints,
  espacerEtiquettes,
  exigerColonnes,
  exigerCompte,
  exigerInfobulle,
  exigerInfobulleDesTraces,
  exigerTraces,
  hauteurBarres,
  legendeBarres,
  legendeTraces,
  ligneInfobulle,
  lignesInfobulle,
  margesCommunes,
  margesVerticales,
  tronquerNom,
} from './pointage.js';

// Sept pixels par caractère, comptés en points de code ; douze de haut.
const mesurer = (texte) => 7 * [...texte].length;
const HAUTEUR_TEXTE = 12;
const graduer = (v) => String(v);
const MARQUE = '\u{2026}';

const escalier = (options) =>
  dispositionEscalier({ largeur: 1000, hauteur: 240, mesurer, hauteurTexte: HAUTEUR_TEXTE, graduer, ...options });

const serie = (valeurs, libelle = 'rencontres') => ({ libelle, valeurs });

describe('pointage : les traits (§ 12.7, D30)', () => {
  test('quatre motifs deux à deux distincts : plein, tirets, mixte, pointillé ; la règle à 100 % prend celui du plafond', () => {
    const motifs = ['serie1', 'serie2', 'plafond', 'borne'].map((genre) => TRAITS[genre].motif);
    assert.equal(new Set(motifs).size, 4, motifs.join(' | '));
    assert.equal(TRAITS.serie1.motif, 'none');
    assert.equal(TRAITS.cent.motif, TRAITS.plafond.motif);
    assert.equal(TRAITS.cent.marque, TRAITS.plafond.marque);
  });

  test('rouge : le plafond et la règle à 100 % en tiret-point, la borne en pointillés plus courts que les tirets de la seconde série', () => {
    const motif = (genre) => TRAITS[genre].motif.split(/[\s,]+/).map(Number);
    for (const genre of ['plafond', 'cent']) {
      const [long, vide1, court, vide2] = motif(genre);
      assert.equal(motif(genre).length, 4, `${genre} : tiret, vide, point, vide`);
      assert.ok(long > court, `${genre} : un tiret long puis un court`);
      assert.ok(court <= vide1 && court <= vide2, `${genre} : le point n’est pas plus long que ses vides`);
    }
    const [point, vide] = motif('borne');
    assert.equal(motif('borne').length, 2, 'borne : point, vide');
    assert.ok(point <= vide, 'borne : le point n’est pas plus long que son vide');
    assert.ok(point < motif('serie2')[0], 'borne : plus court que le tiret de la seconde série');
  });

  test('chaque trait et chaque remplissage nomme une marque de graphique et en peint le jeton', () => {
    const registre = new Map(MARQUES_GRAPHIQUE.map(({ nom, jeton }) => [nom, jeton]));
    for (const [genre, { marque, jeton }] of [...Object.entries(TRAITS), ...Object.entries(REMPLISSAGES)]) {
      assert.equal(registre.get(marque), jeton, genre);
    }
    assert.deepEqual(Object.keys(REMPLISSAGES), ['serie1', 'serie2', 'prouve', 'reste']);
  });

  test('les signes des rangs marqués : ancré, partiel, en réserve, absente, plafond nul', () => {
    assert.deepEqual(SIGNES, ['ancre', 'partiel', 'reserve', 'absente', 'plafondNul']);
  });

  test('le signe d’une absente : un losange, sommets au-dessus, à droite, au-dessous et à gauche du centre', () => {
    const s = SIGNE_PX;
    assert.equal(cheminSigne('absente', 10, 20), `M 10 ${20 - s} L ${10 + s} 20 L 10 ${20 + s} L ${10 - s} 20 Z`);
    assert.equal(cheminSigne('absente', 10.004, 20.5), `M 10 ${20.5 - s} L ${10 + s} 20.5 L 10 ${20.5 + s} L ${10 - s} 20.5 Z`);
    // Une forme distincte de chacun des autres signes.
    const formes = SIGNES.map((genre) => cheminSigne(genre, 10, 20));
    const autres = SIGNES.filter((genre) => genre !== 'absente');
    for (const genre of autres) assert.notEqual(cheminSigne(genre, 10, 20), formes[SIGNES.indexOf('absente')], genre);
  });
});

describe('pointage : exigerTraces', () => {
  test('une ou deux séries, plein puis tirets ; zéro à deux repères', () => {
    const { n, traces } = exigerTraces([serie([1, 2]), serie([0, 1], 'appartenances')], [{ genre: 'borne', libelle: 'b', valeurs: [1, 1] }]);
    assert.equal(n, 2);
    assert.deepEqual(traces.map((t) => t.genre), ['serie1', 'serie2', 'borne']);
    assert.throws(() => exigerTraces([], []), RangeError);
    assert.throws(() => exigerTraces([serie([1]), serie([1]), serie([1])], []), RangeError);
    const reperes = ['plafond', 'borne', 'borne'].map((genre) => ({ genre, libelle: genre, valeurs: [1] }));
    assert.throws(() => exigerTraces([serie([1])], reperes), RangeError);
  });

  test('rouge : deux repères du même motif — un plafond et la règle à 100 % — sont refusés', () => {
    const reperes = ['plafond', 'cent'].map((genre) => ({ genre, libelle: genre, valeurs: [1] }));
    assert.throws(() => exigerTraces([serie([1])], reperes), /motif/);
  });

  test('un genre de repère inconnu, une série de longueur différente, un libellé absent sont refusés', () => {
    assert.throws(() => exigerTraces([serie([1])], [{ genre: 'serie2', libelle: 'x', valeurs: [1] }]), RangeError);
    assert.throws(() => exigerTraces([serie([1, 2]), serie([1])], []), RangeError);
    assert.throws(() => exigerTraces([{ valeurs: [1] }], []), TypeError);
    assert.throws(() => exigerTraces([{ libelle: 'x', valeurs: 'abc' }], []), TypeError);
  });
});

describe('pointage : la disposition d’un escalier (§ 12.3)', () => {
  test('un seul axe vertical, partant de zéro ; les graduations entières sous la plus grande valeur', () => {
    const d = escalier({ series: [serie([3, 5, 8])], reperes: [{ genre: 'plafond', libelle: 'plafond réalisé', valeurs: [9, 9, 9] }] });
    assert.equal(d.axes.length, 2);
    const verticaux = d.axes.filter((a) => a.x1 === a.x2);
    assert.equal(verticaux.length, 1);
    assert.equal(verticaux[0].x1, d.zone.x - ECART_AXE_PX, 'l’axe ne touche pas un tracé posé au bord de la zone');
    assert.equal(d.graduationsY[0].texte, '0');
    assert.ok(d.graduationsY.every(({ valeur }) => Number.isInteger(valeur) && valeur <= 9));
    assert.equal(d.ey.domaine[1], 9);
  });

  test('chaque trace suit la géométrie : l’escalier de la série, la règle d’un repère constant', () => {
    const d = escalier({ series: [serie([3, null, 8])], reperes: [{ genre: 'plafond', libelle: 'plafond réalisé', valeurs: [9, 9, 9] }] });
    assert.equal(d.traces[0].d, cheminEscalier([3, null, 8], d.ex, d.ey));
    assert.equal(d.traces[0].d.match(/M/g).length, 2, 'le chemin reprend après le rang null, sans le franchir');
    assert.match(d.traces[1].d, /^M [\d.]+ [\d.]+ H [\d.]+$/);
  });

  test('rouge : un chemin qui relierait deux rangs par-dessus un rang null', () => {
    const d = escalier({ series: [serie([4, null, 4])] });
    const morceaux = d.traces[0].d.split(/(?=[MHV])/).map((m) => m.trim());
    // Le rang 2 occupe [ex(1), ex(2)] : aucun trait n'y passe.
    const debut = d.ex.versPx(1);
    const fin = d.ex.versPx(2);
    let x = null;
    for (const morceau of morceaux) {
      const [commande, ...nombres] = morceau.split(' ');
      if (commande === 'M') x = Number(nombres[0]);
      if (commande === 'H') {
        const vers = Number(nombres[0]);
        // Les nombres du chemin sont arrondis au centième de pixel.
        assert.ok(!(fin - x > 0.01 && vers - debut > 0.01), `trait de ${x} à ${vers} sur le rang null`);
        x = vers;
      }
    }
  });

  test('les libellés se posent au bout de leur tracé, sans se chevaucher', () => {
    const d = escalier({
      series: [serie([3, 5, 8]), serie([2, 4, 7], 'appartenances')],
      reperes: [
        { genre: 'plafond', libelle: 'plafond réalisé', valeurs: [8, 8, 8] },
        { genre: 'borne', libelle: 'borne de diversité', valeurs: [7, 7, 7] },
      ],
    });
    const fin = d.zone.x + d.zone.largeur;
    for (const trace of d.traces) assert.ok(trace.etiquette.x > fin, trace.libelle);
    const ys = d.traces.map((t) => t.etiquette.y).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i += 1) assert.ok(ys[i] - ys[i - 1] >= HAUTEUR_TEXTE, ys.join(' '));
    // La place des libellés est mesurée : la marge droite tient le plus long.
    assert.ok(1000 - fin >= mesurer('borne de diversité'));
  });

  test('un signe de forme aux seuls rangs marqués, à la valeur de la première série', () => {
    const d = escalier({ series: [serie([3, 5, 8, 9])], marques: [null, 'ancre', null, 'plafondNul'] });
    assert.deepEqual(d.signes.map((s) => [s.indice, s.genre]), [[1, 'ancre'], [3, 'plafondNul']]);
    assert.equal(d.signes[0].x, d.ex.versPx(1.5));
    assert.equal(d.signes[0].y, d.ey.versPx(5));
    assert.equal(d.signes[0].plein, true);
    assert.equal(d.signes[1].plein, false);
    // Le losange d'une absente est creux, comme la réserve.
    const absente = escalier({ series: [serie([3, 5])], marques: ['absente', 'reserve'] });
    assert.deepEqual(absente.signes.map((s) => [s.genre, s.plein]), [['absente', false], ['reserve', false]]);
    assert.equal(absente.signes[0].d, cheminSigne('absente', absente.signes[0].x, absente.signes[0].y));
    assert.throws(() => escalier({ series: [serie([3])], marques: ['rouge'] }), RangeError);
    assert.throws(() => escalier({ series: [serie([3])], marques: [null, null] }), RangeError);
  });

  test('la légende nomme les séries, les repères et les signes présents, dans cet ordre', () => {
    const d = escalier({
      series: [serie([3, 5, 6])],
      reperes: [{ genre: 'borne', libelle: 'borne de diversité', valeurs: [4, 4, 4] }],
      marques: ['plafondNul', 'absente', 'reserve'],
    });
    assert.deepEqual(d.legende, [
      { genre: 'serie1', libelle: 'rencontres', signe: null },
      { genre: 'borne', libelle: 'borne de diversité', signe: null },
      { genre: 'signe', libelle: null, signe: 'reserve' },
      { genre: 'signe', libelle: null, signe: 'absente' },
      { genre: 'signe', libelle: null, signe: 'plafondNul' },
    ]);
  });

  test('pointage au plus proche à 260 rangs : le centre de chaque rang le désigne, hors du tracé le rang du bord', () => {
    const valeurs = Array.from({ length: 260 }, (_, i) => i % 27);
    const d = escalier({ series: [serie(valeurs)] });
    for (let r = 1; r <= 260; r += 1) assert.equal(cibleRang(d.ex.versPx(r - 0.5), d), r - 1, `rang ${r}`);
    assert.equal(cibleRang(d.zone.x - 50, d), 0);
    assert.equal(cibleRang(5000, d), 259);
    assert.deepEqual(ancreRang(3, d), { x: d.ex.versPx(3.5), y: d.ey.versPx(3) });
  });

  test('ancreRang d’un rang null se pose au bas du tracé', () => {
    const d = escalier({ series: [serie([null, 2])] });
    assert.equal(ancreRang(0, d).y, d.zone.y + d.zone.hauteur);
  });

  test('deux graphiques empilés alignent leur zone sur les marges communes, que chacun demande pour son seul texte', () => {
    const comptes = { series: [serie([3, 25])], reperes: [{ genre: 'plafond', libelle: 'plafond réalisé', valeurs: [27, 27] }] };
    const parts = { series: [serie([11, 92], 'part')], reperes: [{ genre: 'cent', libelle: '100', valeurs: [100, 100] }], graduer: (v) => `${v} pc` };
    const marges = [
      margesVerticales({ ...comptes, mesurer, graduer }),
      margesVerticales({ ...parts, mesurer }),
    ];
    assert.notDeepEqual(marges[0], marges[1]);
    const aligner = margesCommunes(marges);
    assert.deepEqual(aligner, { gauche: Math.max(marges[0].gauche, marges[1].gauche), droite: Math.max(marges[0].droite, marges[1].droite) });
    const haut = escalier({ ...comptes, aligner });
    const bas = escalier({ ...parts, aligner });
    assert.deepEqual([haut.zone.x, haut.zone.largeur], [bas.zone.x, bas.zone.largeur]);
    assert.equal(haut.ex.versPx(1.5), bas.ex.versPx(1.5));
    assert.notEqual(escalier(comptes).zone.x, escalier(parts).zone.x, 'sans alignement, chacun sa marge');
    assert.deepEqual(margesCommunes([null, undefined]), { gauche: 0, droite: 0 });
  });

  test('une largeur plus petite que les marges laisse une zone nulle, sans lever', () => {
    const d = escalier({ largeur: 10, series: [serie([1, 2])] });
    assert.equal(d.zone.largeur, 0);
  });

  test('rouge : à zone nulle, chaque graduation de l’abscisse garde sa valeur propre, son rang', () => {
    const d = escalier({ largeur: 10, series: [serie(Array.from({ length: 12 }, (_, i) => i))] });
    const valeurs = d.graduationsX.map((g) => g.valeur);
    assert.ok(valeurs.length > 1);
    assert.equal(new Set(d.graduationsX.map((g) => g.x)).size, 1, 'toutes au même pixel');
    assert.equal(new Set(valeurs).size, valeurs.length, valeurs.join(' | '));
    for (const g of d.graduationsX) assert.equal(g.texte, graduer(g.valeur));
  });
});

describe('pointage : deux séries sur une borne haute reçue (C20, D59, D60)', () => {
  // Deux placements comparés, chacun une série de manques par rang, nommée
  // comme la vue les nomme.
  const a = (valeurs = [3, 2, 1, 0]) => ({ libelle: 'n° 4', valeurs, cle: 'a' });
  const b = (valeurs = [7, 5, 0, 0]) => ({ libelle: 'n° 7', valeurs, cle: 'b' });

  test('rouge : deux séries partagent une seule échelle verticale, bornée par la borne reçue, jamais recalculée sur la plus grande série', () => {
    const d = escalier({ series: [a(), b()], borneHaute: 7 });
    assert.deepEqual(d.ey.domaine, [0, 7]);
    assert.equal(d.axes.filter((x) => x.x1 === x.x2).length, 1, 'un seul axe vertical');
    assert.ok(Math.abs(d.ey.versPx(7) - d.zone.y) < 1e-9, 'la plus grande série atteint le haut, à la borne');
    assert.ok(d.ey.versPx(3) > d.zone.y, 'la première ne s’étire pas jusqu’au haut');
    const large = escalier({ series: [a(), b()], borneHaute: 9 });
    assert.deepEqual(large.ey.domaine, [0, 9], 'la borne reçue, au-delà de la plus grande valeur');
    assert.ok(large.ey.versPx(7) > large.zone.y, 'la plus grande série ne touche pas le haut d’une borne plus haute');
    assert.ok(large.graduationsY.every(({ valeur }) => Number.isInteger(valeur) && valeur <= 9));
    assert.equal(large.graduationsY[0].texte, '0', 'zéro en bas');
  });

  test('rouge : les marges se mesurent sur les graduations de la borne reçue, comme la disposition', () => {
    const avec = margesVerticales({ series: [a([3, 1])], borneHaute: 1000, mesurer, graduer });
    assert.equal(avec.gauche, mesurer('1000') + ESPACE_PX);
    const sans = margesVerticales({ series: [a([3, 1])], mesurer, graduer });
    assert.equal(sans.gauche, mesurer('3') + ESPACE_PX, 'sans borne, celles des données');
    const d = escalier({ series: [a([3, 1])], borneHaute: 1000 });
    assert.equal(d.zone.x, avec.gauche, 'la zone suit les mêmes marges');
  });

  test('une borne absente garde le domaine des données ; les points de relevé la reçoivent aussi', () => {
    assert.deepEqual(escalier({ series: [a(), b()] }).ey.domaine, [0, 7]);
    assert.deepEqual(escalier({ series: [a(), b()], borneHaute: null }).ey.domaine, [0, 7]);
    const d = dispositionPoints({
      largeur: 600,
      hauteur: 120,
      mesurer,
      hauteurTexte: HAUTEUR_TEXTE,
      graduer,
      graduerX: graduer,
      abscisses: [1, 10],
      series: [serie([2, 1])],
      borneHaute: 4,
    });
    assert.deepEqual(d.ey.domaine, [0, 4]);
  });

  test('une borne sous une valeur tracée, négative ou non finie est refusée', () => {
    assert.throws(() => escalier({ series: [a(), b()], borneHaute: 6 }), RangeError, 'sous la plus grande série');
    assert.throws(
      () => escalier({ series: [a()], reperes: [{ genre: 'borne', libelle: 'borne', valeurs: [5, 5, 5, 5] }], borneHaute: 4 }),
      RangeError,
      'sous un repère',
    );
    const nonFini = { name: 'RangeError', message: /nombre fini/ };
    for (const faux of [Number.NaN, Number.POSITIVE_INFINITY, '7']) {
      assert.throws(() => escalier({ series: [a()], borneHaute: faux }), nonFini, String(faux));
      assert.throws(() => margesVerticales({ series: [a()], borneHaute: faux, mesurer, graduer }), nonFini, String(faux));
    }
    // Une borne négative passe sous le zéro des données, que tout domaine
    // contient : elle se refuse comme une borne sous une valeur tracée.
    const sousZero = { name: 'RangeError', message: /borne haute : -1 sous la valeur tracée/ };
    assert.throws(() => escalier({ series: [a()], borneHaute: -1 }), sousZero);
    assert.throws(() => margesVerticales({ series: [a()], borneHaute: -1, mesurer, graduer }), sousZero);
  });

  test('chaque série porte sa clé de désignation, la sienne ou son genre ; A en plein, B en tirets', () => {
    const { traces } = exigerTraces([a(), b()], [{ genre: 'plafond', libelle: 'plafond', valeurs: [7, 7, 7, 7] }]);
    assert.deepEqual(traces.map((t) => [t.genre, t.cle]), [['serie1', 'a'], ['serie2', 'b'], ['plafond', 'plafond']]);
    assert.equal(TRAITS[traces[0].genre].motif, 'none');
    assert.notEqual(TRAITS[traces[1].genre].motif, 'none');
    const sansCle = exigerTraces([serie([1]), serie([2], 'appartenances')], []).traces;
    assert.deepEqual(sansCle.map((t) => t.cle), ['serie1', 'serie2'], 'sans clé, la désignation par rang');
    const d = escalier({ series: [a(), b()], borneHaute: 7 });
    assert.deepEqual(d.traces.map((t) => [t.cle, t.libelle]), [['a', 'n° 4'], ['b', 'n° 7']]);
    assert.deepEqual(d.legende.map((e) => e.libelle), ['n° 4', 'n° 7'], 'chacune nommée dans la légende');
  });

  test('deux séries de même clé, ou une clé qui n’est pas un texte non vide, sont refusées', () => {
    assert.throws(() => exigerTraces([a(), { ...b(), cle: 'a' }], []), RangeError);
    assert.throws(() => exigerTraces([{ ...a(), cle: '' }], []), TypeError);
    assert.throws(() => exigerTraces([{ ...a(), cle: 3 }], []), TypeError);
  });
});

describe('pointage : les points de relevé (§ 12.14, D49)', () => {
  const points = (options) =>
    dispositionPoints({
      largeur: 600,
      hauteur: 120,
      mesurer,
      hauteurTexte: HAUTEUR_TEXTE,
      graduer,
      graduerX: graduer,
      abscisses: [1, 10, 100, 1000, 10000, 20000],
      series: [serie([5, 4, null, 2, 1, 1], 'collisions')],
      ...options,
    });

  test('des points aux seuls points de relevé, reliés par cheminPoints, sur l’échelle logarithmique', () => {
    const d = points();
    const trace = d.traces[0];
    assert.equal(trace.d, cheminPoints([1, 10, 100, 1000, 10000, 20000].map((x, i) => ({ x, y: [5, 4, null, 2, 1, 1][i] })), d.ex, d.ey));
    assert.deepEqual(trace.points.map((p) => p.y === null), [false, false, true, false, false, false]);
    assert.equal(trace.points[1].x, d.ex.versPx(10));
    assert.equal(d.axes.filter((a) => a.x1 === a.x2).length, 1);
  });

  test('l’abscisse se gradue aux points de relevé ; deux graduations qui se chevauchent gardent la plus à droite', () => {
    const d = points();
    const textes = d.graduationsX.map((g) => g.texte);
    assert.equal(textes.at(-1), '20000');
    assert.ok(!textes.includes('10000'), textes.join(' '));
    assert.ok(textes.includes('1'));
    for (let i = 1; i < d.graduationsX.length; i += 1) {
      assert.ok(d.graduationsX[i].x - d.graduationsX[i - 1].x >= mesurer(d.graduationsX[i].texte));
    }
  });

  test('chaque graduation de l’abscisse porte ses mouvements, sa valeur propre', () => {
    const d = points();
    for (const g of d.graduationsX) assert.equal(g.texte, graduer(g.valeur));
    assert.equal(d.graduationsX.at(-1).valeur, 20000);
  });

  test('ciblePoint désigne le point de relevé le plus proche sur l’abscisse commune', () => {
    const d = points();
    assert.equal(ciblePoint(d.ex.versPx(10) + 3, d), 1);
    assert.equal(ciblePoint(0, d), 0);
    assert.equal(ciblePoint(10_000, d), 5);
    assert.deepEqual(ancrePoint(1, d), { x: d.ex.versPx(10), y: d.ey.versPx(4) });
    assert.deepEqual(ancrePoint(2, d), { x: d.ex.versPx(100), y: d.zone.y + d.zone.hauteur });
  });

  test('des abscisses qui ne croissent pas, ou sous 1, sont refusées', () => {
    assert.throws(() => points({ abscisses: [1, 1, 100, 1000, 10000, 20000] }), RangeError);
    assert.throws(() => points({ abscisses: [0, 10, 100, 1000, 10000, 20000] }), RangeError);
    assert.throws(() => points({ abscisses: [1, 10] }), RangeError);
  });
});

describe('pointage : les barres (§ 12.4)', () => {
  const NOM_LONG = 'Maëlle-Hortense Quenouille-Vasque de Belle-Rive';
  const lignes = [
    { id: 'a', nom: 'Coopérative Aubier', appartenance: 1, valeurs: [0, 3] },
    { id: 'b', nom: NOM_LONG, appartenance: null, valeurs: [2, 0] },
    { id: 'c', nom: 'Atelier Ressac', appartenance: 2, valeurs: [1, 1] },
  ];
  const segments = [
    { genre: 'prouve', libelle: 'prouvé inévitable' },
    { genre: 'reste', libelle: 'reste' },
  ];
  const disposer = (options) =>
    dispositionBarres({ largeur: 900, mesurer, hauteurTexte: HAUTEUR_TEXTE, graduer, marque: MARQUE, lignes, segments, ...options });

  test('le nom long se tronque sous la largeur du registre ; le nom entier reste à la ligne', () => {
    assert.equal(LARGEUR_NOM_PX, constante('LARGEUR_TRONCATURE_NOM_PX'));
    const d = disposer();
    const ligne = d.lignes[1];
    assert.equal(ligne.nom, NOM_LONG);
    assert.ok(ligne.intitule.texte.endsWith(MARQUE));
    assert.ok(mesurer(ligne.intitule.texte) <= LARGEUR_NOM_PX);
    assert.equal(d.lignes[0].intitule.texte, 'Coopérative Aubier');
  });

  test('les segments empilés partent de zéro, sur un axe commun ; un segment nul ne se trace pas', () => {
    const d = disposer();
    assert.deepEqual(d.lignes.map((l) => l.segments.map((s) => s.genre)), [['reste'], ['prouve'], ['prouve', 'reste']]);
    const zero = d.ex.versPx(0);
    assert.equal(d.lignes[1].segments[0].x, zero);
    assert.equal(d.lignes[0].segments[0].x, zero, 'le reste d’une ligne sans prouvé part de zéro');
    assert.equal(d.lignes[2].segments[1].x, d.ex.versPx(1) + ECART_SEGMENTS_PX, 'le second segment s’écarte du premier');
    assert.equal(d.lignes[0].segments[0].largeur, d.ex.versPx(3) - d.ex.versPx(0), 'sans premier segment, aucun écart');
    assert.equal(d.ex.domaine[1], 3);
  });

  test('rouge : « prouvé inévitable » seul se trace en contour ; étroit, il garde LARGEUR_MIN_CONTOUR_PX, pris sur le segment qui le suit, la fin de la barre inchangée ; seul, sa barre s’allonge d’autant', () => {
    assert.deepEqual(Object.entries(REMPLISSAGES).filter(([, r]) => r.contour).map(([genre]) => genre), ['prouve']);
    assert.equal(TRAIT_CONTOUR_PX, 2);
    assert.equal(LARGEUR_MIN_CONTOUR_PX, 2 * TRAIT_CONTOUR_PX + 2);
    const d = disposer({
      lignes: [
        { id: 'a', nom: 'Coopérative Aubier', appartenance: 1, valeurs: [0, 300] },
        { id: 'b', nom: 'Atelier Ressac', appartenance: 2, valeurs: [1, 9] },
        { id: 'c', nom: 'Iris Ombrelle', appartenance: null, valeurs: [1, 0] },
      ],
    });
    const naturelle = d.ex.versPx(1) - d.ex.versPx(0);
    assert.ok(naturelle < LARGEUR_MIN_CONTOUR_PX, `un sur trois cents : ${naturelle} px`);
    const [prouve, reste] = d.lignes[1].segments;
    assert.equal(prouve.contour, true);
    assert.equal(reste.contour, false);
    assert.equal(prouve.x, d.ex.versPx(0));
    assert.equal(prouve.largeur, LARGEUR_MIN_CONTOUR_PX);
    assert.equal(reste.x, prouve.x + prouve.largeur + ECART_SEGMENTS_PX);
    assert.ok(Math.abs(reste.x + reste.largeur - d.ex.versPx(10)) < 1e-9, 'le reste finit où finit la barre');
    assert.ok(Math.abs(d.lignes[1].fin - d.ex.versPx(10)) < 1e-9);
    const seul = d.lignes[2].segments[0];
    assert.equal(seul.largeur, LARGEUR_MIN_CONTOUR_PX);
    assert.equal(d.lignes[2].fin, seul.x + LARGEUR_MIN_CONTOUR_PX);
    const ordinaire = disposer();
    const large = ordinaire.lignes[2].segments[0];
    assert.ok(large.largeur > LARGEUR_MIN_CONTOUR_PX);
    assert.equal(large.largeur, ordinaire.ex.versPx(1) - ordinaire.ex.versPx(0), 'un prouvé assez large garde sa largeur');
  });

  test('rouge : une barre ne finit jamais au-delà de sa valeur ; seule une ligne plus étroite que le contour minimal s’allonge, jusqu’à lui', () => {
    // Une première ligne de 600 fixe l'axe : une unité y fait moins de
    // 2 px, si bien qu'un prouvé de 1 et un reste de 2 tiennent dans moins
    // que LARGEUR_MIN_CONTOUR_PX.
    const axe = { id: 'a', nom: 'Coopérative Aubier', appartenance: 1, valeurs: [0, 600] };
    const unite = (() => {
      const d = disposer({ lignes: [axe] });
      return d.ex.versPx(1) - d.ex.versPx(0);
    })();
    assert.ok(3 * unite < LARGEUR_MIN_CONTOUR_PX, `une unité : ${unite} px`);
    // Le plus petit reste qui fait la ligne au moins aussi large que le
    // contour minimal, sans lui laisser l'écart d'un second segment.
    const reste = Math.ceil(LARGEUR_MIN_CONTOUR_PX / unite) - 1;
    assert.ok((1 + reste) * unite < LARGEUR_MIN_CONTOUR_PX + ECART_SEGMENTS_PX, `un plus ${reste} : ${(1 + reste) * unite} px`);
    const d = disposer({
      lignes: [
        axe,
        { id: 'b', nom: 'Atelier Ressac', appartenance: 2, valeurs: [1, 2] },
        { id: 'c', nom: 'Iris Ombrelle', appartenance: null, valeurs: [1, reste] },
      ],
    });
    const zero = d.ex.versPx(0);
    const finDe = (segment) => segment.x + segment.largeur;
    // 1 et 2, plus étroite que le contour minimal : la barre s'allonge
    // jusqu'à lui, et pas d'un pixel de plus.
    const etroite = d.lignes[1];
    assert.equal(etroite.segments[0].largeur, LARGEUR_MIN_CONTOUR_PX);
    assert.ok(Math.abs(etroite.fin - (zero + LARGEUR_MIN_CONTOUR_PX)) < 1e-9, `fin ${etroite.fin - zero} px`);
    assert.ok(etroite.segments.every((s) => finDe(s) <= etroite.fin + 1e-9 && s.largeur >= 0));
    // 1 et le reste, au moins aussi large : le prouvé garde son contour, le
    // reste cède ce qu'il faut, jusqu'à zéro, et la barre finit à sa valeur.
    const juste = d.lignes[2];
    const valeur = d.ex.versPx(1 + reste);
    assert.equal(juste.segments[0].largeur, LARGEUR_MIN_CONTOUR_PX);
    assert.ok(Math.abs(juste.fin - valeur) < 1e-9, `fin ${juste.fin - zero} px, valeur ${valeur - zero} px`);
    for (const s of juste.segments) assert.ok(finDe(s) <= valeur + 1e-9 && s.x <= valeur + 1e-9 && s.largeur >= 0, `${s.genre} : ${s.x - zero} + ${s.largeur}`);
    // La hauteur réservée reste celle du dessin.
    assert.equal(d.hauteurTotale, hauteurBarres({ n: 3, juxtaposees: false, hauteurTexte: HAUTEUR_TEXTE }));
    // Un prouvé en dernier n'a aucun segment après lui où prendre : il ne
    // passe pas la valeur de sa ligne, plus large que le contour minimal.
    const inverse = disposer({
      segments: [...segments].reverse(),
      lignes: [
        { ...axe, valeurs: [600, 0] },
        { id: 'd', nom: 'Théo Pervenche', appartenance: null, valeurs: [reste + 1, 1] },
      ],
    });
    const derniere = inverse.lignes[1];
    const fin = inverse.ex.versPx(reste + 2);
    assert.equal(derniere.segments.at(-1).genre, 'prouve');
    assert.ok(Math.abs(derniere.fin - fin) < 1e-9, `fin ${derniere.fin - inverse.ex.versPx(0)} px, valeur ${fin - inverse.ex.versPx(0)} px`);
    for (const s of derniere.segments) assert.ok(finDe(s) <= fin + 1e-9 && s.largeur >= 0, `${s.genre} : ${s.x} + ${s.largeur}`);
  });

  test('rouge : un prouvé en dernier garde aussi le contour minimal, pris sur le segment qui le précède ; la barre ne passe sa valeur que pour une ligne plus étroite que lui', () => {
    const d = disposer({
      segments: [...segments].reverse(),
      lignes: [
        { id: 'a', nom: 'Coopérative Aubier', appartenance: 1, valeurs: [300, 0] },
        { id: 'b', nom: 'Atelier Ressac', appartenance: 2, valeurs: [9, 1] },
        { id: 'c', nom: 'Iris Ombrelle', appartenance: null, valeurs: [1, 1] },
        { id: 'd', nom: 'Théo Pervenche', appartenance: null, valeurs: [0, 1] },
      ],
    });
    const zero = d.ex.versPx(0);
    const unite = d.ex.versPx(1) - zero;
    assert.ok(2 * unite < LARGEUR_MIN_CONTOUR_PX && 10 * unite > LARGEUR_MIN_CONTOUR_PX + ECART_SEGMENTS_PX, `une unité : ${unite} px`);
    const proche = (a, b) => Math.abs(a - b) < 1e-9;
    // 9 et 1 : le prouvé prend son contour sur le reste, qui le précède ;
    // la barre finit à sa valeur.
    const [reste, prouve] = d.lignes[1].segments;
    assert.deepEqual([reste.genre, prouve.genre], ['reste', 'prouve']);
    assert.equal(prouve.largeur, LARGEUR_MIN_CONTOUR_PX);
    assert.ok(proche(prouve.x + prouve.largeur, d.ex.versPx(10)), `fin ${prouve.x + prouve.largeur - zero} px`);
    assert.ok(proche(d.lignes[1].fin, d.ex.versPx(10)));
    assert.equal(reste.x, zero);
    assert.ok(proche(reste.x + reste.largeur + ECART_SEGMENTS_PX, prouve.x), 'le reste cède, l’écart reste');
    // 1 et 1, plus étroite que le contour minimal : le reste cède tout,
    // l'écart avec lui, et la barre s'allonge jusqu'au contour minimal.
    const [vide, seul] = d.lignes[2].segments;
    assert.equal(vide.largeur, 0);
    assert.equal(seul.x, zero);
    assert.equal(seul.largeur, LARGEUR_MIN_CONTOUR_PX);
    assert.ok(proche(d.lignes[2].fin, zero + LARGEUR_MIN_CONTOUR_PX));
    // Un prouvé seul : le contour minimal, depuis zéro.
    assert.deepEqual(
      d.lignes[3].segments.map(({ genre, x, largeur }) => [genre, x, largeur]),
      [['prouve', zero, LARGEUR_MIN_CONTOUR_PX]],
    );
    // Aucun segment prouvé plus étroit que le contour minimal, aucun segment
    // de largeur négative ; la hauteur réservée reste celle du dessin.
    const traces = d.lignes.flatMap((ligne) => ligne.segments);
    assert.ok(traces.every((s) => s.largeur >= 0));
    const prouves = traces.filter((s) => s.contour);
    assert.equal(prouves.length, 3);
    assert.ok(prouves.every((s) => s.largeur >= LARGEUR_MIN_CONTOUR_PX), prouves.map((s) => s.largeur).join(', '));
    assert.equal(d.hauteurTotale, hauteurBarres({ n: 4, juxtaposees: false, hauteurTexte: HAUTEUR_TEXTE }));
  });

  test('rouge : le libellé de chaque segment se pose sur la première barre où il est non nul', () => {
    const d = disposer();
    assert.deepEqual(d.etiquettesSegments.map((e) => [e.genre, e.indice]), [['prouve', 1], ['reste', 0]]);
    for (const e of d.etiquettesSegments) {
      const ligne = d.lignes[e.indice];
      assert.equal(e.y, ligne.y + ligne.hauteur / 2);
      assert.ok(e.x > ligne.fin);
    }
  });

  test('un segment nul partout n’a pas de libellé sur le tracé ; la légende le garde', () => {
    const d = disposer({ lignes: lignes.map((l) => ({ ...l, valeurs: [0, l.valeurs[1]] })) });
    assert.deepEqual(d.etiquettesSegments.map((e) => e.genre), ['reste']);
    assert.deepEqual(d.legende.map((e) => e.genre), ['prouve', 'reste']);
  });

  test('deux colonnes juxtaposées, chacune son axe, les lignes dans le même ordre', () => {
    const d = dispositionBarres({
      largeur: 900,
      mesurer,
      hauteurTexte: HAUTEUR_TEXTE,
      graduer,
      marque: MARQUE,
      lignes: [
        { id: 'f1', nom: 'Iris Ombrelle', valeurs: [2, 9] },
        { id: 'f2', nom: 'Théo Pervenche', valeurs: [4, 1] },
      ],
      colonnes: [
        { genre: 'serie1', libelle: 'appartenances' },
        { genre: 'serie2', libelle: 'étiquettes' },
      ],
    });
    assert.equal(d.colonnes.length, 2);
    assert.deepEqual(d.colonnes.map((c) => c.ex.domaine[1]), [4, 9]);
    assert.ok(d.colonnes[0].x + d.colonnes[0].largeur < d.colonnes[1].x);
    assert.deepEqual(d.lignes.map((l) => l.id), ['f1', 'f2']);
    assert.equal(d.lignes[1].segments[1].x, d.colonnes[1].ex.versPx(0));
    assert.deepEqual(d.etiquettesSegments, []);
  });

  test('rouge : chaque ligne porte son texte secondaire après sa barre et ses libellés, dans la marge droite réservée', () => {
    const avec = [
      { ...lignes[0], secondaire: '7 personnes, 3 paires, excédent 2' },
      { ...lignes[1], secondaire: '4 personnes, 2 paires, excédent 0' },
      { id: 'vide', nom: 'Ondine Lacasse', valeurs: [0, 0], secondaire: '\u{2014}' },
      { ...lignes[2] },
    ];
    for (const largeur of [900, 700]) {
      const d = disposer({ largeur, lignes: avec });
      const [a, b, vide, c] = d.lignes;
      assert.equal(c.secondaire, null, 'sans texte secondaire, rien');
      for (const ligne of [a, b, vide]) {
        assert.equal(ligne.secondaire.y, ligne.y + ligne.hauteur / 2);
        assert.ok(ligne.secondaire.x >= ligne.fin + ESPACE_PX - 1e-9, ligne.id);
        assert.ok(ligne.secondaire.x + mesurer(ligne.secondaire.texte) <= largeur + 1e-9, `${ligne.id} tient dans ${largeur}`);
        for (const e of d.etiquettesSegments.filter((x) => x.indice === ligne.indice)) {
          assert.ok(ligne.secondaire.x >= e.x + mesurer(e.libelle) + ESPACE_PX - 1e-9, `${ligne.id} : après le libellé ${e.genre}`);
        }
      }
      assert.deepEqual(vide.segments, [], 'une ligne sans valeur n’a aucune barre');
      assert.equal(vide.secondaire.texte, '\u{2014}');
      assert.equal(vide.secondaire.x, d.ex.versPx(0) + ESPACE_PX);
    }
  });

  test('le texte secondaire des colonnes juxtaposées suit la barre de la seconde ; un secondaire qui n’est pas un texte est refusé', () => {
    const d = dispositionBarres({
      largeur: 600,
      mesurer,
      hauteurTexte: HAUTEUR_TEXTE,
      graduer,
      marque: MARQUE,
      lignes: [{ id: 'f1', nom: 'Iris Ombrelle', valeurs: [2, 9], secondaire: '12 tours animés' }],
      colonnes: [
        { genre: 'serie1', libelle: 'appartenances' },
        { genre: 'serie2', libelle: 'étiquettes' },
      ],
    });
    const [ligne] = d.lignes;
    assert.equal(ligne.secondaire.x, ligne.segments[1].x + ligne.segments[1].largeur + ESPACE_PX);
    assert.ok(ligne.secondaire.x + mesurer('12 tours animés') <= 600 + 1e-9);
    assert.throws(() => disposer({ lignes: [{ ...lignes[0], secondaire: 7 }] }), TypeError);
    assert.equal(disposer({ lignes: [{ ...lignes[0], secondaire: null }] }).lignes[0].secondaire, null);
  });

  test('cibleLigne : la ligne sous le pointeur, bornée aux lignes ; aucune sans ligne', () => {
    const d = disposer();
    for (const [i, ligne] of d.lignes.entries()) assert.equal(cibleLigne(ligne.y + 1, d), i);
    assert.equal(cibleLigne(-100, d), 0);
    assert.equal(cibleLigne(10_000, d), 2);
    assert.equal(cibleLigne(10, disposer({ lignes: [] })), null);
  });

  test('segments et colonnes ensemble, ou une ligne qui n’a pas autant de valeurs, sont refusés', () => {
    assert.throws(() => disposer({ colonnes: [{ genre: 'serie1', libelle: 'x' }] }), RangeError);
    assert.throws(() => disposer({ lignes: [{ id: 'z', nom: 'Ondine Lacasse', valeurs: [1] }] }), RangeError);
    assert.throws(() => disposer({ segments: [{ genre: 'repere', libelle: 'x' }, segments[1]] }), RangeError);
  });

  test('deux segments du même genre, ou une ligne sans identifiant propre, sont refusés : Barres les prend pour clés', () => {
    assert.throws(() => disposer({ segments: [{ genre: 'reste', libelle: 'a' }, { genre: 'reste', libelle: 'b' }] }), RangeError);
    assert.throws(() => disposer({ colonnes: [{ genre: 'serie1', libelle: 'a' }, { genre: 'serie1', libelle: 'b' }], segments: null }), RangeError);
    const sansId = [{ nom: 'Iris Ombrelle', valeurs: [1, 0] }, { nom: 'Théo Pervenche', valeurs: [0, 1] }];
    assert.throws(() => disposer({ lignes: sansId }), TypeError);
    assert.throws(() => disposer({ lignes: [{ ...lignes[0], id: { cle: 'a' } }] }), TypeError);
    assert.throws(() => disposer({ lignes: [lignes[0], { ...lignes[1], id: 'a' }] }), RangeError);
    assert.deepEqual(disposer({ lignes: [{ ...lignes[0], id: 1 }, { ...lignes[1], id: 2 }] }).lignes.map(({ id }) => id), [1, 2]);
  });
});

describe('pointage : la grille (§ 12.5, § 12.11, D33)', () => {
  const lignes = [{ libelle: 'Iris Ombrelle' }, { libelle: 'Théo Pervenche' }, { libelle: 'Basile Tourteau' }];
  const valeurs = [null, 1, 3, 1, null, 0, 3, 0, null];
  const disposer = (options) =>
    dispositionGrille({
      largeur: 600,
      mesurer,
      hauteurTexte: HAUTEUR_TEXTE,
      ecrire: graduer,
      lignes,
      colonnes: lignes,
      valeurs,
      diagonale: true,
      ...options,
    });

  test('chaque case : son niveau, son jeton, l’encre de son niveau et son compte écrit ; la diagonale vide et neutre', () => {
    const d = disposer();
    assert.equal(d.dessinable, true);
    const c = d.cases;
    assert.equal(c.length, 9);
    assert.deepEqual([c[0].diagonale, c[0].texte, c[0].niveau], [true, '', null]);
    assert.deepEqual([c[2].niveau, c[2].texte, c[2].marque], [3, '3', 'graphiqueNiveau3']);
    assert.equal(c[2].jeton, NIVEAUX_GRAPHIQUE[3].jeton);
    assert.equal(c[2].encre, NIVEAUX_GRAPHIQUE[3].encre);
    assert.deepEqual([c[5].niveau, c[5].marque], [0, null], 'le niveau 0 est un fond, sans marque');
    // La bordure et le remplissage ne se touchent pas.
    assert.ok(c[2].fond.x > c[2].bord.x + 0.5);
    assert.equal(c[2].fond.x + c[2].fond.cote, c[2].x + c[2].cote - RETRAIT_CASE_PX);
  });

  test('bordures : un sous-chemin fermé par case, diagonale comprise, dans l’ordre des cases, chacun le carré de son bord', () => {
    const d = disposer();
    const sousChemins = d.bordures.split('z').filter((x) => x !== '');
    assert.equal(sousChemins.length, d.cases.length);
    d.cases.forEach(({ bord }, i) => {
      assert.equal(sousChemins[i], `M${bord.x} ${bord.y}h${bord.cote}v${bord.cote}h${-bord.cote}`);
    });
  });

  test('une case sans compte écrit « — » sans couleur ; elle n’est pas sur la diagonale', () => {
    const d = disposer({ diagonale: false, valeurs: [null, 1, 2, 0] , lignes: lignes.slice(0, 2), colonnes: lignes.slice(0, 2) });
    assert.deepEqual([d.cases[0].texte, d.cases[0].niveau, d.cases[0].jeton, d.cases[0].diagonale], [null, null, null, false]);
  });

  test('cède la place quand ses cases ne tiennent pas dans la largeur', () => {
    assert.equal(disposer({ largeur: 120 }).dessinable, false);
  });

  test('cibleCase : la case sous le pointeur, aucune sur la diagonale ni hors de la grille', () => {
    const d = disposer();
    const centre = (i) => [d.cases[i].x + d.cases[i].cote / 2, d.cases[i].y + d.cases[i].cote / 2];
    assert.equal(cibleCase(...centre(5), d), 5);
    assert.equal(cibleCase(...centre(4), d), null);
    assert.equal(cibleCase(d.x0 - 1, centre(5)[1], d), null);
    assert.equal(cibleCase(centre(5)[0], d.y0 + d.cote * 3 + 1, d), null);
  });

  test('autant de valeurs que de cases, sinon refus', () => {
    assert.throws(() => disposer({ valeurs: [1, 2] }), RangeError);
  });
});

describe('pointage : ce qu’un graphique en attente de son dessin porte déjà (E2s)', () => {
  const nom = (i) => (i % 3 === 0 ? 'Maëlle-Hortense Quenouille-Vasque de Belle-Rive' : `Personne ${i}`);
  const segments = [
    { genre: 'prouve', libelle: 'prouvé inévitable' },
    { genre: 'reste', libelle: 'reste' },
  ];
  const colonnes = [
    { genre: 'serie1', libelle: 'appartenances' },
    { genre: 'serie2', libelle: 'étiquettes' },
  ];

  test('hauteurBarres est la hauteur du dessin, à tout nombre de lignes, empilées ou juxtaposées, et legendeBarres sa légende', () => {
    for (const n of [0, 1, 2, 7, 74]) {
      for (const hauteurTexte of [12, 15.5]) {
        for (const forme of [{ segments }, { colonnes }]) {
          const lignes = Array.from({ length: n }, (_, i) => ({ id: i, nom: nom(i), valeurs: [i % 2, i % 5], secondaire: i % 4 === 0 ? `${i} sur ${n}` : null }));
          for (const largeur of [0, 320, 1200]) {
            const d = dispositionBarres({ largeur, lignes, mesurer, hauteurTexte, graduer, marque: MARQUE, ...forme });
            const juxtaposees = forme.colonnes !== undefined;
            assert.equal(hauteurBarres({ n, juxtaposees, hauteurTexte }), d.hauteurTotale, `${n} lignes, ${largeur} px`);
            assert.equal(d.axes[0].axe.y2, d.hauteurTotale, 'l’axe finit au bas du dessin');
            assert.deepEqual(legendeBarres(forme), d.legende);
          }
        }
      }
    }
  });

  test('legendeBarres : chaque segment empilé sous son libellé ; rien pour des colonnes juxtaposées', () => {
    assert.deepEqual(legendeBarres({ segments }), [
      { genre: 'prouve', libelle: 'prouvé inévitable', signe: null },
      { genre: 'reste', libelle: 'reste', signe: null },
    ]);
    assert.deepEqual(legendeBarres({ colonnes }), []);
  });

  test('legendeTraces est la légende du dessin : séries, repères, puis les signes présents dans l’ordre de SIGNES', () => {
    const series = [serie([3, 2, 1]), serie([1, 1, 2], 'à neuf')];
    const reperes = [{ genre: 'plafond', libelle: 'plafond', valeurs: [3, 3, 3] }];
    for (const marques of [null, [null, null, null], ['reserve', null, 'ancre'], ['partiel', 'partiel', null]]) {
      const legende = legendeTraces({ series, reperes, marques });
      assert.deepEqual(legende, escalier({ series, reperes, marques }).legende);
      const signes = legende.filter((e) => e.genre === 'signe').map((e) => e.signe);
      assert.deepEqual(signes, SIGNES.filter((s) => (marques ?? []).includes(s)));
    }
    assert.deepEqual(legendeTraces({ series, reperes })[2], { genre: 'plafond', libelle: 'plafond', signe: null });
    const points = dispositionPoints({ largeur: 600, hauteur: 160, abscisses: [1, 10, 100], series, mesurer, hauteurTexte: HAUTEUR_TEXTE, graduer, graduerX: graduer });
    assert.deepEqual(legendeTraces({ series }), points.legende);
    assert.throws(() => legendeTraces({ series: [] }), RangeError);
  });

  test('cadreGrille est le cadre du dessin — hauteur, case, en-tête tourné ou non, dessinable — et ne mesure que les intitulés', () => {
    const intitules = (n, prefixe) => Array.from({ length: n }, (_, i) => ({ libelle: `${prefixe} ${i + 1}` }));
    const longues = [{ libelle: 'Une table au nom très long' }, { libelle: 'Deux' }];
    const cas = [
      [intitules(3, 'Tour'), intitules(8, 'Table')],
      [intitules(5, 'Tour'), longues],
      [intitules(2, 'Personne'), intitules(2, 'Personne')],
      [intitules(1, 'Tour'), intitules(60, 'Table')],
      [[], []],
    ];
    for (const [lignes, colonnes] of cas) {
      for (const largeur of [0, 90, 480, 1200]) {
        for (const coteMax of [Number.POSITIVE_INFINITY, 3 * HAUTEUR_TEXTE, 2 * HAUTEUR_TEXTE]) {
          const lus = new Set();
          const compter = (texte) => {
            lus.add(texte);
            return mesurer(texte);
          };
          const cadre = cadreGrille({ largeur, lignes, colonnes, mesurer: compter, hauteurTexte: HAUTEUR_TEXTE, coteMax });
          const valeurs = Array.from({ length: lignes.length * colonnes.length }, (_, i) => (i % 7 === 0 ? null : i % 4));
          const d = dispositionGrille({ largeur, lignes, colonnes, valeurs, mesurer, hauteurTexte: HAUTEUR_TEXTE, ecrire: graduer, coteMax });
          const quoi = `${lignes.length} × ${colonnes.length}, ${largeur} px, borne ${coteMax}`;
          assert.deepEqual(
            [cadre.hauteur, cadre.largeur, cadre.cote, cadre.x0, cadre.y0, cadre.dessinable],
            [d.hauteur, d.largeur, d.cote, d.x0, d.y0, d.dessinable],
            quoi,
          );
          assert.equal(cadre.tournes, d.intitulesColonnes.some((i) => i.tourne), quoi);
          for (const texte of lus) assert.ok([...lignes, ...colonnes].some((l) => l.libelle === texte), `${quoi} : ${texte} mesuré`);
        }
      }
    }
    const tournee = cadreGrille({ largeur: 600, lignes: intitules(2, 'Tour'), colonnes: longues, mesurer, hauteurTexte: HAUTEUR_TEXTE, coteMax: 2 * HAUTEUR_TEXTE });
    assert.equal(tournee.tournes, true);
    assert.equal(tournee.y0, mesurer('Une table au nom très long') + ESPACE_PX);
  });
});

describe('pointage : la ligne de l’infobulle et les cellules du jumeau (§ 12.7, D34, D44)', () => {
  const colonnes = [
    { cle: 'nom', libelle: 'Personne', genre: 'texte' },
    { cle: 'rencontres', libelle: 'Rencontres', genre: 'nombre' },
    { cle: 'part', libelle: 'Part', genre: 'pourcentage' },
  ];

  // L'écriture des nombres de la page, injectée comme format.nombre : elle
  // rend ici ses arguments, pour qu'une épreuve voie ce qu'elle a reçu.
  const ecrire = (v, { decimales = 0 } = {}) => `n(${v};${decimales})`;

  test('chaque cellule dans l’ordre des colonnes ; une cellule de pourcentage porte son texte et le compte de sa ligne', () => {
    const ligne = { nom: 'Iris Ombrelle', rencontres: 24, part: { texte: '88 \u{25}', compte: '24 sur 27' } };
    assert.deepEqual(ligneInfobulle(colonnes, ligne, ecrire), [
      { cle: 'nom', libelle: 'Personne', genre: 'texte', texte: 'Iris Ombrelle', compte: null },
      { cle: 'rencontres', libelle: 'Rencontres', genre: 'nombre', texte: 'n(24;0)', compte: null },
      { cle: 'part', libelle: 'Part', genre: 'pourcentage', texte: '88 \u{25}', compte: '24 sur 27' },
    ]);
  });

  test('rouge : un nombre s’écrit par l’écriture de la page, aux décimales de sa colonne, jamais par String', () => {
    const taux = { cle: 'taux', libelle: 'Taux', genre: 'nombre', decimales: 2 };
    assert.equal(celluleDe(colonnes[1], { rencontres: 20000 }, ecrire).texte, 'n(20000;0)');
    assert.equal(celluleDe(taux, { taux: 0.75 }, ecrire).texte, 'n(0.75;2)');
    assert.equal(celluleDe(colonnes[1], { rencontres: 'inconnues' }, ecrire).texte, 'inconnues', 'un texte déjà écrit reste');
    assert.throws(() => celluleDe(colonnes[1], { rencontres: 3 }), TypeError, 'sans écriture, refus');
    assert.throws(() => celluleDe(colonnes[0], { nom: 3 }, ecrire), TypeError, 'un nombre sous une colonne de texte');
    assert.throws(() => exigerColonnes([{ ...taux, decimales: 1.5 }]), RangeError);
    assert.throws(() => exigerColonnes([{ ...colonnes[0], decimales: 2 }]), RangeError, 'des décimales hors d’une colonne de nombres');
  });

  test('un pourcentage sans valeur garde son compte ; une valeur absente se rend null', () => {
    assert.deepEqual(celluleDe(colonnes[2], { part: { texte: null, compte: '0 sur 0' } }, ecrire), {
      genre: 'pourcentage',
      texte: null,
      compte: '0 sur 0',
    });
    assert.deepEqual(celluleDe(colonnes[1], {}, ecrire), { genre: 'nombre', texte: null, compte: null });
  });

  test('rouge : une cellule de pourcentage sans son compte est refusée', () => {
    assert.throws(() => celluleDe(colonnes[2], { part: { texte: '88 \u{25}' } }, ecrire), /compte/);
    assert.throws(() => celluleDe(colonnes[2], { part: { texte: '88 \u{25}', compte: '' } }, ecrire), /compte/);
    assert.throws(() => celluleDe(colonnes[2], { part: '88 \u{25}' }, ecrire), TypeError);
  });

  test('exigerCompte : une chaîne non vide, sinon TypeError', () => {
    assert.equal(exigerCompte('minimum 24 sur 27'), 'minimum 24 sur 27');
    for (const faux of ['', null, undefined, 3]) assert.throws(() => exigerCompte(faux), TypeError);
  });

  test('exigerColonnes : un genre connu, une clé unique, un libellé', () => {
    assert.equal(exigerColonnes(colonnes), colonnes);
    assert.throws(() => exigerColonnes([]), RangeError);
    assert.throws(() => exigerColonnes([{ cle: 'x', libelle: 'X', genre: 'date' }]), RangeError);
    assert.throws(() => exigerColonnes([colonnes[0], colonnes[0]]), RangeError);
    assert.throws(() => exigerColonnes([{ cle: 'x', genre: 'texte' }]), TypeError);
  });
});

describe('pointage : l’infobulle d’un rang à plusieurs lignes (C20, D66)', () => {
  const ecrire = (v, { decimales = 0 } = {}) => `n(${v};${decimales})`;
  // L'infobulle à une série : une ligne par rang, un pourcentage suivi de son compte.
  const COLONNES_UNE_SERIE = [
    { cle: 'nom', libelle: 'Personne', genre: 'texte' },
    { cle: 'part', libelle: 'Part', genre: 'pourcentage' },
  ];
  const LIGNES_UNE_SERIE = [{ nom: 'Iris Ombrelle', part: { texte: '88 \u{25}', compte: '24 sur 27' } }];
  // L'infobulle de deux placements : en comptes, une ligne par rang et par
  // série.
  const COLONNES = [
    { cle: 'nom', libelle: 'Personne', genre: 'texte' },
    { cle: 'manque', libelle: 'manque', genre: 'nombre' },
    { cle: 'rencontres', libelle: 'rencontres', genre: 'nombre' },
  ];
  const A = { nom: 'n° 4', lignes: [{ nom: 'Théo Pervenche', manque: 3, rencontres: 24 }, { nom: 'Iris Ombrelle', manque: 1, rencontres: 26 }] };
  const B = { nom: 'n° 7', lignes: [{ nom: 'Ondine Lacasse', manque: 2, rencontres: 25 }] };

  test('rouge : une infobulle à une série rend sa ligne, sans nom de série', () => {
    const uneSerie = { colonnes: COLONNES_UNE_SERIE, lignes: LIGNES_UNE_SERIE };
    assert.deepEqual(lignesInfobulle(uneSerie, 0, ecrire), [{ nom: null, cellules: ligneInfobulle(COLONNES_UNE_SERIE, LIGNES_UNE_SERIE[0], ecrire) }]);
    assert.equal(lignesInfobulle(uneSerie, 1, ecrire), null, 'un rang sans ligne n’ouvre rien');
  });

  test('rouge : deux séries, une ligne par série au même rang, chacune précédée du nom de sa série, dans l’ordre des séries', () => {
    const bulle = { colonnes: COLONNES, series: [A, B] };
    assert.deepEqual(lignesInfobulle(bulle, 0, ecrire), [
      { nom: 'n° 4', cellules: ligneInfobulle(COLONNES, A.lignes[0], ecrire) },
      { nom: 'n° 7', cellules: ligneInfobulle(COLONNES, B.lignes[0], ecrire) },
    ]);
    assert.deepEqual(lignesInfobulle(bulle, 1, ecrire), [{ nom: 'n° 4', cellules: ligneInfobulle(COLONNES, A.lignes[1], ecrire) }], 'une série sans ce rang se tait');
    assert.equal(lignesInfobulle(bulle, 2, ecrire), null);
  });

  test('rouge : une infobulle à plusieurs séries est en comptes — une colonne de pourcentage est refusée (D67, C29)', () => {
    assert.throws(() => exigerInfobulle({ colonnes: COLONNES_UNE_SERIE, series: [{ nom: 'n° 4', lignes: LIGNES_UNE_SERIE }] }), /pourcentage/);
    assert.equal(exigerInfobulle({ colonnes: COLONNES_UNE_SERIE, lignes: LIGNES_UNE_SERIE }).lignes, LIGNES_UNE_SERIE, 'à une série, le pourcentage reste');
  });

  test('exigerInfobulle : des lignes ou des séries, l’un des deux ; une ou deux séries, chacune nommée, de noms distincts', () => {
    assert.throws(() => exigerInfobulle({ colonnes: COLONNES, lignes: [], series: [A] }), RangeError);
    assert.throws(() => exigerInfobulle({ colonnes: COLONNES }), RangeError);
    assert.throws(() => exigerInfobulle({ colonnes: COLONNES, lignes: 'abc' }), TypeError);
    assert.throws(() => exigerInfobulle({ colonnes: COLONNES, series: [] }), RangeError);
    assert.throws(() => exigerInfobulle({ colonnes: COLONNES, series: [A, B, { ...B, nom: 'n° 9' }] }), RangeError);
    assert.throws(() => exigerInfobulle({ colonnes: COLONNES, series: [A, { ...B, nom: 'n° 4' }] }), RangeError);
    assert.throws(() => exigerInfobulle({ colonnes: COLONNES, series: [{ ...A, nom: '' }] }), TypeError);
    assert.throws(() => exigerInfobulle({ colonnes: COLONNES, series: [{ nom: 'n° 4' }] }), TypeError);
    assert.throws(() => exigerInfobulle({ colonnes: [], series: [A] }), RangeError);
  });

  test('exigerInfobulleDesTraces : une ligne par série du tracé, sous le nom de la série ; l’infobulle à une série passe telle quelle', () => {
    const series = [{ libelle: 'n° 4', valeurs: [3, 1] }, { libelle: 'n° 7', valeurs: [2, 0] }];
    const bulle = { colonnes: COLONNES, series: [A, B] };
    assert.equal(exigerInfobulleDesTraces(bulle, series), bulle);
    assert.equal(exigerInfobulleDesTraces(null, series), null);
    const uneSerie = { colonnes: COLONNES_UNE_SERIE, lignes: LIGNES_UNE_SERIE };
    assert.equal(exigerInfobulleDesTraces(uneSerie, series), uneSerie);
    assert.throws(() => exigerInfobulleDesTraces({ colonnes: COLONNES, series: [A] }, series), RangeError, 'une série sans sa ligne');
    assert.throws(() => exigerInfobulleDesTraces({ colonnes: COLONNES, series: [B, A] }, series), RangeError, 'les noms dans l’ordre des séries');
  });
});

describe('pointage : la troncature d’un nom et l’espacement des libellés', () => {
  test('tronquerNom : entier quand il tient, sinon le plus long préfixe suivi de la marque', () => {
    assert.deepEqual(tronquerNom('Iris Ombrelle', 200, mesurer, MARQUE), { texte: 'Iris Ombrelle', largeur: 91, tronque: false });
    const r = tronquerNom('Iris Ombrelle', 50, mesurer, MARQUE);
    assert.deepEqual(r, { texte: `Iris O${MARQUE}`, largeur: 49, tronque: true });
    assert.deepEqual(tronquerNom('Iris', 5, mesurer, MARQUE), { texte: '', largeur: 0, tronque: true });
    assert.deepEqual(tronquerNom('Iris', 7, mesurer, MARQUE), { texte: MARQUE, largeur: 7, tronque: true });
  });

  test('tronquerNom ne coupe pas une lettre hors du plan de base', () => {
    const r = tronquerNom('\u{1D4D8}\u{1D4D8}\u{1D4D8}', 14, mesurer, MARQUE);
    assert.equal(r.texte, `\u{1D4D8}${MARQUE}`);
  });

  test('espacerEtiquettes : un pas au moins entre deux libellés, l’ordre gardé, dans les bornes', () => {
    assert.deepEqual(espacerEtiquettes([50, 52, 51], 10, 0, 200), [50, 70, 60]);
    assert.deepEqual(espacerEtiquettes([195, 196], 10, 0, 200), [190, 200]);
    assert.deepEqual(espacerEtiquettes([], 10, 0, 200), []);
  });
});
