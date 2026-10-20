// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves des inscriptions du plateau (§ 7.5, § 7.7) : le corps et la place
// du numéro d'une table, avec ou sans libellé, la marque de gel et la
// pastille, posée sur le bord du plateau, en haut à droite, hors des
// chaises. Les tables sont celles de geometrieTable, rondes et carrées, de
// une à quarante places.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import {
  DEMI_HAUTEUR_GEL,
  PROPORTION_NUMERO,
  RAYON_PASTILLE,
  RETRAIT_GEL,
  corpsNumero,
  placeGel,
  placeNumero,
  placePastille,
} from './plateau.js';
import { geometrieTable } from './tables.js';
import { TAILLE_TEXTE_LISTE_CM } from './texte.js';

const FORMES = ['ronde', 'carree'];
const PLACES = Array.from({ length: 40 }, (_, i) => i + 1);
const PRES = 1e-9;

// Chaque table d'épreuve, centrée hors de l'origine : forme, places et géométrie.
const TABLES = FORMES.flatMap((forme) =>
  PLACES.map((places) => ({ forme, places, g: geometrieTable({ id: 1, numero: 7, forme, position: { x: 130, y: -45 } }, places) })),
);

// Le bas de la marque de gel d'une géométrie, en cm de dessin.
const basDuGel = (g) => placeGel(g).y + DEMI_HAUTEUR_GEL;

// L'angle d'un point autour du centre de la table, en degrés, y vers le bas.
const angle = (g, p) => (Math.atan2(p.y - g.centre.y, p.x - g.centre.x) * 180) / Math.PI;

describe('plateau : le numéro de la table (§ 7.7)', () => {
  test('le corps vaut PROPORTION_NUMERO de la largeur du plateau, jamais moins que le corps des listes', () => {
    assert.equal(PROPORTION_NUMERO, 0.4);
    assert.equal(corpsNumero(35), 28);
    assert.equal(corpsNumero(90), 72);
    assert.equal(corpsNumero(10), TAILLE_TEXTE_LISTE_CM);
    for (const { forme, places, g } of TABLES) {
      const corps = corpsNumero(g.demiTaille);
      assert.ok(corps >= TAILLE_TEXTE_LISTE_CM, `${forme} de ${places}`);
      assert.ok(Math.abs(corps - PROPORTION_NUMERO * 2 * g.demiTaille) < PRES, `${forme} de ${places} : ${corps}`);
    }
  });

  test('sans libellé, le numéro se pose au centre du plateau, à ce corps', () => {
    for (const { g } of TABLES) {
      assert.deepEqual(placeNumero(g), { x: g.centre.x, y: g.centre.y, corps: corpsNumero(g.demiTaille) });
      assert.deepEqual(placeNumero(g, { libelle: false }), placeNumero(g));
    }
  });

  test('avec un libellé, le numéro monte au-dessus du centre, sous la marque de gel, d\u{2019}un corps entre celui des listes et le sien', () => {
    for (const { forme, places, g } of TABLES) {
      const quoi = `${forme} de ${places}`;
      const { x, y, corps } = placeNumero(g, { libelle: true });
      assert.equal(x, g.centre.x, quoi);
      assert.ok(y < g.centre.y, `${quoi} : ${y}`);
      assert.ok(corps >= TAILLE_TEXTE_LISTE_CM && corps <= corpsNumero(g.demiTaille), `${quoi} : ${corps}`);
      // Le haut du cadratin ne passe pas au-dessus du bas de la marque de gel.
      assert.ok(y - corps / 2 >= basDuGel(g) - PRES, `${quoi} : haut ${y - corps / 2}, gel ${basDuGel(g)}`);
    }
  });

  test('avec un libellé, sur une table où la bande entre le gel et le centre tient le corps des listes, le cadratin du numéro la remplit', () => {
    let remplies = 0;
    for (const { forme, places, g } of TABLES) {
      const bande = g.centre.y - basDuGel(g);
      if (bande < TAILLE_TEXTE_LISTE_CM) continue;
      remplies += 1;
      const { y, corps } = placeNumero(g, { libelle: true });
      const quoi = `${forme} de ${places}`;
      assert.ok(Math.abs(corps - Math.min(bande, corpsNumero(g.demiTaille))) < PRES, `${quoi} : ${corps}`);
      // Le bas du cadratin touche le centre ; le corps ne dépasse pas celui
      // sans libellé.
      assert.ok(Math.abs(y + corps / 2 - g.centre.y) < PRES, `${quoi} : bas ${y + corps / 2}`);
    }
    assert.ok(remplies > 60, String(remplies));
  });

  test('la plus petite table : le numéro avec libellé prend le corps des listes, sous la marque de gel', () => {
    const g = geometrieTable({ id: 1, numero: 1, forme: 'ronde', position: { x: 0, y: 0 } }, 2);
    assert.equal(g.demiTaille, 35);
    assert.deepEqual(placeNumero(g, { libelle: true }), { x: 0, y: -35 + RETRAIT_GEL + DEMI_HAUTEUR_GEL + TAILLE_TEXTE_LISTE_CM / 2, corps: TAILLE_TEXTE_LISTE_CM });
  });
});

describe('plateau : la marque de gel', () => {
  test('dans le plateau, centrée sur son axe vertical, RETRAIT_GEL sous son haut', () => {
    for (const { g } of TABLES) {
      assert.deepEqual(placeGel(g), { x: g.centre.x, y: g.centre.y - g.demiTaille + RETRAIT_GEL });
      assert.ok(placeGel(g).y - DEMI_HAUTEUR_GEL > g.centre.y - g.demiTaille);
    }
  });
});

describe('plateau : la pastille, en haut à droite, sur le bord du plateau (§ 7.5)', () => {
  test('carrée : au coin haut droit du plateau', () => {
    for (const { g } of TABLES.filter(({ forme }) => forme === 'carree')) {
      assert.deepEqual(placePastille(g), { x: g.centre.x + g.demiTaille, y: g.centre.y - g.demiTaille });
    }
  });

  test('ronde : sur le cercle du plateau, dans le quart haut droit', () => {
    for (const { places, g } of TABLES.filter(({ forme }) => forme === 'ronde')) {
      const p = placePastille(g);
      assert.ok(Math.abs(Math.hypot(p.x - g.centre.x, p.y - g.centre.y) - g.demiTaille) < 1e-6, `${places} places`);
      assert.ok(p.x > g.centre.x && p.y < g.centre.y, `${places} places : ${angle(g, p)}°`);
    }
  });

  test('ronde : la diagonale à −45° quand aucune chaise ne la touche ; sinon le milieu de l\u{2019}intervalle entre deux chaises le plus proche, celui du haut à égalité', () => {
    const angleDe = (places) => {
      const g = geometrieTable({ id: 1, numero: 1, forme: 'ronde', position: { x: 0, y: 0 } }, places);
      return Math.round(angle(g, placePastille(g)) * 1000) / 1000;
    };
    for (const places of [1, 2, 3, 4]) assert.equal(angleDe(places), -45, `${places} places`);
    assert.equal(angleDe(5), -54);
    assert.equal(angleDe(6), -60);
    assert.equal(angleDe(8), -67.5);
    assert.equal(angleDe(16), -56.25);
  });

  test('le disque de la pastille ne touche aucune chaise, ni la marque de gel, quelles que soient la forme et les places', () => {
    for (const { forme, places, g } of TABLES) {
      const p = placePastille(g);
      for (const chaise of g.chaises) {
        const d = Math.hypot(chaise.x - p.x, chaise.y - p.y);
        assert.ok(d >= RAYON_PASTILLE + chaise.rayon - PRES, `${forme} de ${places}, siège ${chaise.siege} : ${d}`);
      }
      // La marque de gel tient dans un carré de demi-côté DEMI_HAUTEUR_GEL.
      const gel = placeGel(g);
      const dx = Math.max(0, Math.abs(p.x - gel.x) - DEMI_HAUTEUR_GEL);
      const dy = Math.max(0, Math.abs(p.y - gel.y) - DEMI_HAUTEUR_GEL);
      assert.ok(Math.hypot(dx, dy) > RAYON_PASTILLE, `${forme} de ${places} : gel à ${Math.hypot(dx, dy)}`);
    }
  });

  test('la place ne dépend que de la forme et des places : une table déplacée garde sa pastille au même endroit d\u{2019}elle', () => {
    for (const forme of FORMES) {
      for (const places of [3, 8, 13]) {
        const ici = geometrieTable({ id: 1, numero: 1, forme, position: { x: 0, y: 0 } }, places);
        const la = geometrieTable({ id: 2, numero: 9, forme, position: { x: -310, y: 425 } }, places);
        const [a, b] = [placePastille(ici), placePastille(la)];
        assert.ok(Math.abs(b.x + 310 - a.x) < 1e-6 && Math.abs(b.y - 425 - a.y) < 1e-6, `${forme} de ${places}`);
      }
    }
  });
});
