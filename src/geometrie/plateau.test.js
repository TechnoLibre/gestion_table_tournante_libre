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
  AVANCE_CHIFFRE,
  DECALAGE_ANCRE,
  DEMI_HAUTEUR_GEL,
  ECART_NUMERO,
  ENCRE_BAS_CHIFFRE,
  ENCRE_HAUT_CHIFFRE,
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

// La géométrie g, numérotée numero.
const numerotee = (g, numero) => ({ ...g, numero });

// La boîte qui borne l'encre d'un numéro de chiffres chiffres, posé à sa
// place : la somme des chasses en largeur, les bornes d'encre de part et
// d'autre de l'ancre, et le décalage de l'arrondi, en hauteur.
function encreBornee({ x, y, corps }, chiffres) {
  const demi = (chiffres * AVANCE_CHIFFRE * corps) / 2;
  const [haut, bas] = [ENCRE_HAUT_CHIFFRE * corps + DECALAGE_ANCRE, ENCRE_BAS_CHIFFRE * corps + DECALAGE_ANCRE];
  return { gauche: x - demi, droite: x + demi, haut: y - haut, bas: y + bas };
}

// La distance d'un point à une boîte, 0 dedans.
const distanceBoite = (p, b) => Math.hypot(Math.max(0, b.gauche - p.x, p.x - b.droite), Math.max(0, b.haut - p.y, p.y - b.bas));

// Ce qui sépare une boîte d'encre de la pastille, du bas de la marque de gel
// et du bord du plateau, en cm ; négatif quand elle les touche.
function ecarts(g, b) {
  const { centre, demiTaille } = g;
  const coins = [
    [b.gauche, b.haut],
    [b.droite, b.haut],
    [b.gauche, b.bas],
    [b.droite, b.bas],
  ];
  const bord =
    g.forme === 'ronde'
      ? demiTaille - Math.max(...coins.map(([x, y]) => Math.hypot(x - centre.x, y - centre.y)))
      : demiTaille - Math.max(...coins.map(([x, y]) => Math.max(Math.abs(x - centre.x), Math.abs(y - centre.y))));
  return { pastille: distanceBoite(placePastille(g), b) - RAYON_PASTILLE, gel: b.haut - basDuGel(g), bord };
}

// Vrai quand chacun des écarts vaut au moins ECART_NUMERO.
const degagee = (e) => e.pastille >= ECART_NUMERO - PRES && e.gel >= ECART_NUMERO - PRES && e.bord >= ECART_NUMERO - PRES;

// Des numéros de un à six chiffres.
const NUMEROS = [7, 88, 888, 8888, 88888, 888888];

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

describe('plateau : le corps du numéro selon ses chiffres (§ 7.7)', () => {
  test('jusqu\u{2019}à deux chiffres, le numéro garde le corps de PROPORTION_NUMERO de la largeur, sur toute table ; avec un libellé, celui de la bande', () => {
    for (const { forme, places, g } of TABLES) {
      const bande = Math.min(corpsNumero(g.demiTaille), Math.max(TAILLE_TEXTE_LISTE_CM, g.centre.y - basDuGel(g)));
      for (const numero of [7, 88]) {
        assert.equal(placeNumero(numerotee(g, numero)).corps, corpsNumero(g.demiTaille), `${forme} de ${places}, ${numero}`);
        assert.equal(placeNumero(numerotee(g, numero), { libelle: true }).corps, bande, `${forme} de ${places}, ${numero}, avec un libellé`);
      }
    }
  });

  test('de un à quatre chiffres, avec ou sans libellé, l\u{2019}encre bornée reste à ECART_NUMERO de la pastille, du bas de la marque de gel et du bord du plateau, au corps des listes au moins', () => {
    assert.equal(ECART_NUMERO, 1.5);
    for (const { forme, places, g } of TABLES) {
      for (const numero of NUMEROS.slice(0, 4)) {
        for (const libelle of [false, true]) {
          const quoi = `${forme} de ${places}, ${numero}${libelle ? ', avec un libellé' : ''}`;
          const place = placeNumero(numerotee(g, numero), { libelle });
          assert.ok(place.corps >= TAILLE_TEXTE_LISTE_CM && place.corps <= corpsNumero(g.demiTaille) + PRES, `${quoi} : ${place.corps}`);
          // Avec un libellé, la plus petite ronde place un numéro de trois
          // chiffres au corps des listes, sous la marque de gel : la pastille
          // y est plus près que l'écart (§ 7.7).
          const e = ecarts(g, encreBornee(place, String(numero).length));
          if (libelle && forme === 'ronde' && places <= 4 && numero >= 888) {
            assert.equal(place.corps, TAILLE_TEXTE_LISTE_CM, quoi);
            assert.ok(e.gel >= ECART_NUMERO - PRES && e.bord >= ECART_NUMERO - PRES, `${quoi} : ${JSON.stringify(e)}`);
          } else {
            assert.ok(degagee(e), `${quoi} : ${JSON.stringify(e)}`);
          }
        }
      }
    }
  });

  test('sur les rondes de une à quatre places, trois et quatre chiffres réduisent le corps du numéro, qui reste au centre', () => {
    for (const places of [1, 2, 3, 4]) {
      const g = geometrieTable({ id: 1, numero: 1, forme: 'ronde', position: { x: 0, y: 0 } }, places);
      const corps = [88, 888, 8888].map((numero) => placeNumero(numerotee(g, numero)).corps);
      assert.ok(corps[0] > corps[1] && corps[1] > corps[2] && corps[2] > TAILLE_TEXTE_LISTE_CM, `${places} places : ${corps}`);
      assert.deepEqual([placeNumero(numerotee(g, 8888)).x, placeNumero(numerotee(g, 8888)).y], [0, 0]);
    }
  });

  test('de un à six chiffres, le corps réduit dégage l\u{2019}encre, et c\u{2019}est le plus grand : un dixième de cm de plus la ferait toucher', () => {
    let reduits = 0;
    for (const { forme, places, g } of TABLES) {
      for (const numero of NUMEROS) {
        for (const libelle of [false, true]) {
          const place = placeNumero(numerotee(g, numero), { libelle });
          const plafond = placeNumero(numerotee(g, 7), { libelle }).corps;
          if (place.corps >= plafond - PRES || place.corps <= TAILLE_TEXTE_LISTE_CM + PRES) continue;
          reduits += 1;
          const quoi = `${forme} de ${places}, ${numero}${libelle ? ', avec un libellé' : ''}`;
          assert.ok(degagee(ecarts(g, encreBornee(place, String(numero).length))), quoi);
          const plus = place.corps + 0.1;
          const y = libelle ? Math.max(g.centre.y - plus / 2, basDuGel(g) + plus / 2) : g.centre.y;
          assert.ok(!degagee(ecarts(g, encreBornee({ x: place.x, y, corps: plus }, String(numero).length))), quoi);
        }
      }
    }
    assert.ok(reduits > 100, String(reduits));
  });

  test('au corps des listes, l\u{2019}encre d\u{2019}un numéro sans libellé reste à l\u{2019}écart de la pastille et de la marque de gel, quel que soit le nombre de chiffres ; trop long pour le plateau, il garde ce corps', () => {
    for (const { forme, places, g } of TABLES) {
      const place = { x: g.centre.x, y: g.centre.y, corps: TAILLE_TEXTE_LISTE_CM };
      const e = ecarts(g, encreBornee(place, 40));
      assert.ok(e.pastille >= ECART_NUMERO && e.gel >= ECART_NUMERO, `${forme} de ${places} : ${JSON.stringify(e)}`);
    }
    const g = geometrieTable({ id: 1, numero: 1, forme: 'ronde', position: { x: 0, y: 0 } }, 2);
    assert.deepEqual(placeNumero(numerotee(g, 1234567890)), { x: 0, y: 0, corps: TAILLE_TEXTE_LISTE_CM });
  });

  test('le corps ne dépend que de la forme, des places et du nombre de chiffres', () => {
    for (const forme of FORMES) {
      for (const places of [2, 5, 9]) {
        const ici = geometrieTable({ id: 1, numero: 123, forme, position: { x: 0, y: 0 } }, places);
        const la = geometrieTable({ id: 4, numero: 987, forme, position: { x: 215, y: -340 } }, places);
        assert.equal(placeNumero(ici).corps, placeNumero(la).corps, `${forme} de ${places}`);
      }
    }
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
