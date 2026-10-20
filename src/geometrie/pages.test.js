// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de la découpe du plan en pages (§ 11.7) : une page quand le plan
// s'y lit, la grille minimale au seuil de lisibilité sinon, l'échelle la plus
// grande que cette grille admet, l'orientation qui donne le moins de pages,
// des tuiles contiguës à l'égalité exacte, les cartouches et les tables que
// chaque page dessine. Sauf mention, le papier est un A4 aux marges de 10 mm,
// sans bande : 190 × 277 mm utiles en portrait, 277 × 190 en paysage ; et le
// seuil e* = corpsMinMm / corpsDessinCm vaut 2 mm de papier par cm de dessin.
// Les valeurs attendues se calculent dans le commentaire qui les précède.
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from '../../test/lanceur.js';
import { constante } from './constantes.js';
import { decouperPlan } from './pages.js';
import { PAPIERS } from './papiers.js';
import { englobant, englobantImpression, geometrieTable } from './tables.js';
import { TAILLE_TEXTE_LISTE_CM } from './texte.js';

const OPTIONS = Object.freeze({ papier: 'A4', margeMm: 10, bandeMm: 0, corpsDessinCm: 1, corpsMinMm: 2 });

// Un englobant de coin (x, y) et de cotes largeur × hauteur, en cm.
const boite = (x, y, largeur, hauteur) => ({ minX: x, minY: y, maxX: x + largeur, maxY: y + hauteur });

const table = (id, x, y) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x, y } });

// Les cotes d'une tuile s'arrondissent par excès à 2⁻²⁰ cm près : une cote
// de cadrage se compare à 1e-5 cm près, une échelle à 1e-9 près.
function proche(reel, attendu, libelle, tolerance = 1e-9) {
  assert.ok(Math.abs(reel - attendu) <= tolerance, `${libelle} : ${reel} au lieu de ${attendu}`);
}

describe('decouperPlan : une page, ou la grille au seuil de lisibilité', () => {
  test('un plan qui se lit sur une page : une page, à l’échelle de la page, le plan centré', () => {
    // 100 × 50 cm. Paysage : e₁ = min(277/100, 190/50) = 2,77 ≥ 2, une page ;
    // la tuile mesure 277/2,77 = 100 cm sur 190/2,77 ≈ 68,592 cm, centrée :
    // y = −(68,592 − 50)/2.
    const plan = decouperPlan(boite(0, 0, 100, 50), OPTIONS);
    assert.equal(plan.orientation, 'paysage');
    assert.equal(plan.lisibleSurUnePage, true);
    assert.equal(plan.colonnes, 1);
    assert.equal(plan.rangees, 1);
    assert.equal(plan.pages.length, 1);
    proche(plan.echelle, 2.77, 'échelle');
    const { cadrage } = plan.pages[0];
    proche(cadrage.largeur, 100, 'largeur', 1e-5);
    proche(cadrage.hauteur, 190 / 2.77, 'hauteur', 1e-5);
    proche(cadrage.x, 0, 'x', 1e-5);
    proche(cadrage.y, -(190 / 2.77 - 50) / 2, 'y', 1e-5);
  });

  test('sous le seuil : « auto » découpe, « unePage » rend une page illisible, « decoupe » rend la grille', () => {
    // 1 000 × 100 cm. Portrait : e₁ = min(0,19, 2,77) < 2 ; grille
    // ⌈1000·2/190⌉ × ⌈100·2/277⌉ = 11 × 1. Paysage : ⌈2000/277⌉ × ⌈200/190⌉ =
    // 8 × 2 = 16 pages. « auto » : portrait, 11 pages. « unePage » : une page
    // dans chaque orientation, le paysage plus grand, e₁ = min(0,277, 1,9).
    const auto = decouperPlan(boite(0, 0, 1000, 100), OPTIONS);
    assert.equal(auto.orientation, 'portrait');
    assert.equal(auto.lisibleSurUnePage, false);
    assert.deepEqual([auto.colonnes, auto.rangees, auto.pages.length], [11, 1, 11]);

    const unePage = decouperPlan(boite(0, 0, 1000, 100), { ...OPTIONS, mode: 'unePage' });
    assert.equal(unePage.orientation, 'paysage');
    assert.equal(unePage.lisibleSurUnePage, false);
    assert.deepEqual([unePage.colonnes, unePage.rangees, unePage.pages.length], [1, 1, 1]);
    proche(unePage.echelle, 0.277, 'échelle sur une page');

    assert.deepEqual(decouperPlan(boite(0, 0, 1000, 100), { ...OPTIONS, mode: 'decoupe' }), auto);
  });

  test('« decoupe » sur un plan qui se lit : la grille au seuil est d’une page', () => {
    assert.deepEqual(
      decouperPlan(boite(0, 0, 100, 50), { ...OPTIONS, mode: 'decoupe' }),
      decouperPlan(boite(0, 0, 100, 50), OPTIONS),
    );
  });

  test('le nombre de colonnes est l’arrondi par excès : W·e*/L = 2 exactement → 2, 2,01 → 3', () => {
    // Paysage, L = 277 : W = 277 donne 554/277 = 2 exactement, 2 colonnes
    // (portrait : ⌈554/190⌉ = 3). W = 277 × 1,005 donne 2,01 : 3 colonnes ;
    // le portrait en donne aussi 3, à l'échelle min(3·190/W, 27,7) ≈ 2,05,
    // moindre que celle du paysage, min(3·277/W, 19) ≈ 2,99.
    const deux = decouperPlan(boite(0, 0, 277, 10), OPTIONS);
    assert.deepEqual([deux.orientation, deux.colonnes, deux.rangees], ['paysage', 2, 1]);
    const trois = decouperPlan(boite(0, 0, 277 * 1.005, 10), OPTIONS);
    assert.deepEqual([trois.orientation, trois.colonnes, trois.rangees], ['paysage', 3, 1]);
  });

  test('le nombre de rangées est l’arrondi par excès : H·e*/Hu = 2 exactement → 2, 2,01 → 3', () => {
    // Portrait, Hu = 277 : H = 277 donne 2 rangées (paysage : ⌈554/190⌉ = 3).
    // H = 277 × 1,005 : 3 rangées dans chaque orientation, le portrait à
    // l'échelle min(19, 3·277/H) ≈ 2,99, le paysage à min(27,7, 3·190/H) ≈ 2,05.
    const deux = decouperPlan(boite(0, 0, 10, 277), OPTIONS);
    assert.deepEqual([deux.orientation, deux.colonnes, deux.rangees], ['portrait', 1, 2]);
    const trois = decouperPlan(boite(0, 0, 10, 277 * 1.005), OPTIONS);
    assert.deepEqual([trois.orientation, trois.colonnes, trois.rangees], ['portrait', 1, 3]);
  });

  test('l’échelle retenue est la plus grande que la grille minimale admet, pas le seuil', () => {
    // 1 000 × 100 cm en portrait, 11 colonnes : min(11·190/1000, 277/100) =
    // 2,09 > e* = 2. Tuile de 190/2,09 ≈ 90,909 cm sur 277/2,09 ≈ 132,54 cm ;
    // onze tuiles couvrent les 1 000 cm, la rangée est centrée sur les 100.
    const plan = decouperPlan(boite(0, 0, 1000, 100), OPTIONS);
    proche(plan.echelle, 2.09, 'échelle');
    const premiere = plan.pages[0].cadrage;
    proche(premiere.largeur, 190 / 2.09, 'largeur', 1e-5);
    proche(premiere.hauteur, 277 / 2.09, 'hauteur', 1e-5);
    proche(premiere.x, 0, 'x', 1e-5);
    proche(premiere.y, -(277 / 2.09 - 100) / 2, 'y', 1e-5);
    const derniere = plan.pages[10].cadrage;
    proche(derniere.x + derniere.largeur, 1000, 'bord droit de la dernière', 1e-4);
  });

  test('la bande se retire de la hauteur utile, sous les deux marges ; le papier Lettre a ses cotes', () => {
    // 50 × 100 cm, bande de 17 mm, A4 portrait : 190 × 260 mm utiles,
    // e₁ = min(3,8, 2,6) = 2,6 ; le paysage, 277 × 173, découpe en 2.
    const a4 = decouperPlan(boite(0, 0, 50, 100), { ...OPTIONS, bandeMm: 17 });
    assert.deepEqual([a4.orientation, a4.pages.length], ['portrait', 1]);
    proche(a4.echelle, 2.6, 'échelle A4');
    proche(a4.pages[0].cadrage.hauteur * a4.echelle, 260, 'hauteur utile', 1e-4);
    proche(a4.pages[0].cadrage.largeur * a4.echelle, 190, 'largeur utile', 1e-4);
    // Lettre portrait, sans bande : 195,9 × 259,4 mm utiles, e₁ = 2,594.
    const lettre = decouperPlan(boite(0, 0, 50, 100), { ...OPTIONS, papier: 'Lettre' });
    assert.deepEqual([lettre.orientation, lettre.pages.length], ['portrait', 1]);
    proche(lettre.echelle, (PAPIERS.Lettre.hauteur - 20) / 100, 'échelle Lettre');
  });

  test('marge, corps du dessin et corps minimal ont pour défaut le registre ; le mode, « auto »', () => {
    const englobe = boite(-300, 40, 2600, 900);
    assert.deepEqual(
      decouperPlan(englobe, { papier: 'A4', bandeMm: 12 }),
      decouperPlan(englobe, {
        papier: 'A4',
        bandeMm: 12,
        margeMm: constante('MARGE_PAGE_MM'),
        corpsDessinCm: TAILLE_TEXTE_LISTE_CM,
        corpsMinMm: constante('CORPS_MIN_IMPRESSION_MM'),
        mode: 'auto',
      }),
    );
  });
});

describe('decouperPlan : l’orientation', () => {
  test('paysage d’un plan large, portrait d’un plan haut', () => {
    // 100 × 50 : une page en paysage, deux en portrait. 50 × 100 : une page
    // en portrait (e₁ = 2,77), deux en paysage (e₁ = 1,9, ⌈200/190⌉ rangées).
    assert.equal(decouperPlan(boite(0, 0, 100, 50), OPTIONS).orientation, 'paysage');
    const haut = decouperPlan(boite(0, 0, 50, 100), OPTIONS);
    assert.deepEqual([haut.orientation, haut.pages.length], ['portrait', 1]);
  });

  test('à pages égales, la plus grande échelle ; à échelle égale aussi, le paysage', () => {
    // « unePage » d'un plan haut : une page dans chaque orientation, le
    // portrait à 2,77, le paysage à 1,9. Un carré de 50 cm : 3,8 dans les deux.
    const haut = decouperPlan(boite(0, 0, 50, 100), { ...OPTIONS, mode: 'unePage' });
    assert.equal(haut.orientation, 'portrait');
    const carre = decouperPlan(boite(0, 0, 50, 50), OPTIONS);
    assert.equal(carre.orientation, 'paysage');
    proche(carre.echelle, 3.8, 'échelle du carré');
  });
});

describe('decouperPlan : les cartouches', () => {
  test('une grille de 3 × 2 : rangs dans l’ordre de lecture, lettres, rangées, voisins nuls aux bords', () => {
    // 400 × 150 cm. Paysage : ⌈800/277⌉ × ⌈300/190⌉ = 3 × 2 ; portrait :
    // ⌈800/190⌉ × ⌈300/277⌉ = 5 × 2.
    const plan = decouperPlan(boite(0, 0, 400, 150), OPTIONS);
    assert.deepEqual([plan.orientation, plan.colonnes, plan.rangees], ['paysage', 3, 2]);
    const v = (haut, droite, bas, gauche) => ({ haut, droite, bas, gauche });
    assert.deepEqual(
      plan.pages.map(({ rang, cartouche }) => ({ rang, ...cartouche })),
      [
        { rang: 0, page: 1, total: 6, colonne: 'A', rangee: 1, voisins: v(null, 1, 3, null) },
        { rang: 1, page: 2, total: 6, colonne: 'B', rangee: 1, voisins: v(null, 2, 4, 0) },
        { rang: 2, page: 3, total: 6, colonne: 'C', rangee: 1, voisins: v(null, null, 5, 1) },
        { rang: 3, page: 4, total: 6, colonne: 'A', rangee: 2, voisins: v(0, 4, null, null) },
        { rang: 4, page: 5, total: 6, colonne: 'B', rangee: 2, voisins: v(1, 5, null, 3) },
        { rang: 5, page: 6, total: 6, colonne: 'C', rangee: 2, voisins: v(2, null, null, 4) },
      ],
    );
  });

  test('au-delà de Z, les colonnes continuent en AA, AB… ', () => {
    // 4 000 × 10 cm. Paysage : ⌈8000/277⌉ = 29 colonnes ; portrait : 43.
    const plan = decouperPlan(boite(0, 0, 4000, 10), OPTIONS);
    assert.equal(plan.colonnes, 29);
    assert.deepEqual(
      [0, 25, 26, 27, 28].map((rang) => plan.pages[rang].cartouche.colonne),
      ['A', 'Z', 'AA', 'AB', 'AC'],
    );
  });
});

describe('decouperPlan : les tables de chaque page', () => {
  test('une table à cheval sur deux tuiles paraît sur les deux, chaque autre sur la sienne', () => {
    // Trois rondes de 8 en x = 0, 1 900, 4 000 : l'englobant court de −128,4
    // à 4 128,4 cm sur 256,8. Seuil e* = 0,1 : paysage ⌈425,7/277⌉ × 1 = 2
    // colonnes, portrait 3. La frontière tombe au milieu, x = 2 000 : le
    // centre de la deuxième est dans la première tuile, ses chaises
    // (emprise de 1 779,6 à 2 020,4) passent dans la seconde. Une emprise
    // réduite au plateau, ou à la moitié du demi-côté, n'y passerait pas.
    const geometries = [table(1, 0, 0), table(2, 1900, 0), table(3, 4000, 0)].map((t) => geometrieTable(t, 8));
    const plan = decouperPlan(englobant(geometries), { ...OPTIONS, corpsMinMm: 0.1, geometries });
    assert.deepEqual([plan.orientation, plan.colonnes, plan.rangees], ['paysage', 2, 1]);
    assert.ok(plan.pages[1].cadrage.x > geometries[1].centre.x, 'centre dans la première tuile');
    assert.deepEqual(
      plan.pages.map((p) => p.tables),
      [
        [1, 2],
        [2, 3],
      ],
    );
  });

  test('à cheval sur deux rangées : la même table, son centre au-dessus de la frontière', () => {
    // Les trois rondes ci-dessus, transposées en y = 0, 1 900, 4 000.
    // Portrait : ⌈425,7/277⌉ = 2 rangées sur ⌈25,7/190⌉ = 1 colonne ; le
    // paysage en demande ⌈425,7/190⌉ = 3. La frontière tombe en y = 2 000.
    const geometries = [table(1, 0, 0), table(2, 0, 1900), table(3, 0, 4000)].map((t) => geometrieTable(t, 8));
    const plan = decouperPlan(englobant(geometries), { ...OPTIONS, corpsMinMm: 0.1, geometries });
    assert.deepEqual([plan.orientation, plan.colonnes, plan.rangees], ['portrait', 1, 2]);
    assert.ok(plan.pages[1].cadrage.y > geometries[1].centre.y, 'centre dans la première rangée');
    assert.deepEqual(
      plan.pages.map((p) => p.tables),
      [
        [1, 2],
        [2, 3],
      ],
    );
  });

  test('une emprise qui ne fait que toucher le bord d’une tuile n’y paraît pas', () => {
    // Les tuiles des trois rondes ci-dessus, et deux emprises de demi-côté 50
    // posées contre leur frontière b, l'une à gauche, l'autre à droite : b est
    // un multiple de 2⁻²⁰ cm, b ± 50 ∓ 50 se calcule sans arrondi.
    const geometries = [table(1, 0, 0), table(2, 2000, 0), table(3, 4000, 0)].map((t) => geometrieTable(t, 8));
    const options = { ...OPTIONS, corpsMinMm: 0.1 };
    const b = decouperPlan(englobant(geometries), { ...options, geometries }).pages[1].cadrage.x;
    const contre = (id, x) => ({ id, centre: { x, y: 0 }, rayonEmprise: 50 });
    const plan = decouperPlan(englobant(geometries), {
      ...options,
      geometries: [...geometries, contre(8, b - 50), contre(9, b + 50)],
    });
    assert.deepEqual(
      plan.pages.map((p) => p.tables),
      [
        [1, 2, 8],
        [2, 3, 9],
      ],
    );
  });

  test('un bloc de noms seul dans une tuile y fait paraître sa table', () => {
    // Une ronde de 8 en (0, 0), son bloc de 2 000 cm sur 300 depuis
    // l'origine de la liste (156,4 ; −76,4) : l'englobant d'impression court
    // de −128,4 à 2 156,4. Seuil e* = 0,2 : paysage ⌈457/277⌉ = 2 colonnes,
    // frontière en x = 1 014, au-delà de l'emprise (bord à 120,4) : la
    // seconde tuile ne coupe que le bloc.
    const geometries = [geometrieTable(table(1, 0, 0), 8)];
    const listes = { largeur: 2000, hauteurs: new Map([[1, 300]]) };
    const englobe = englobantImpression(geometries, { listes });
    const options = { ...OPTIONS, corpsMinMm: 0.2, geometries };
    const avec = decouperPlan(englobe, { ...options, listes });
    assert.deepEqual([avec.orientation, avec.colonnes, avec.rangees], ['paysage', 2, 1]);
    assert.ok(avec.pages[1].cadrage.x > geometries[0].centre.x + geometries[0].rayonEmprise);
    assert.deepEqual(
      avec.pages.map((p) => p.tables),
      [[1], [1]],
    );
    // Sans les listes, la même tuile ne coupe rien.
    const sans = decouperPlan(englobe, { ...options, listes: null });
    assert.deepEqual(
      sans.pages.map((p) => p.tables),
      [[1], []],
    );
  });

  test('douze tables en grille, leurs listes comprises : chacune paraît sur une page au moins', () => {
    // Le pas d'une grille de rondes de 8 : 813 cm entre colonnes, 300 entre
    // rangées ; neuf lignes de 22,5 cm par liste. Seuils du registre.
    const geometries = Array.from({ length: 12 }, (_, i) =>
      geometrieTable(table(i + 1, (i % 4) * 813, Math.floor(i / 4) * 300), 8),
    );
    const listes = { largeur: constante('LARGEUR_BLOC_NOMS_CM'), hauteurs: new Map(geometries.map((g) => [g.id, 202.5])) };
    const plan = decouperPlan(englobantImpression(geometries, { listes }), {
      papier: 'A4',
      bandeMm: 15,
      geometries,
      listes,
    });
    assert.ok(plan.pages.length >= 2, `${plan.pages.length} page(s)`);
    const vues = new Set(plan.pages.flatMap((p) => p.tables));
    assert.deepEqual(
      geometries.map((g) => g.id).filter((id) => !vues.has(id)),
      [],
    );
    for (const page of plan.pages) {
      assert.deepEqual(
        page.tables,
        geometries.map((g) => g.id).filter((id) => page.tables.includes(id)),
        'les tables d’une page suivent l’ordre des géométries',
      );
    }
  });
});

describe('decouperPlan : le plan vide', () => {
  test('englobant null : une page, aucune table, une échelle finie, dans tout mode', () => {
    for (const mode of ['auto', 'unePage', 'decoupe']) {
      const plan = decouperPlan(null, { ...OPTIONS, mode });
      assert.equal(plan.pages.length, 1, mode);
      assert.ok(Number.isFinite(plan.echelle) && plan.echelle > 0, `${mode} : échelle ${plan.echelle}`);
      assert.equal(plan.lisibleSurUnePage, true, mode);
      assert.deepEqual([plan.colonnes, plan.rangees], [1, 1], mode);
      const [{ rang, cadrage, cartouche, tables }] = plan.pages;
      assert.equal(rang, 0);
      assert.ok(Object.values(cadrage).every(Number.isFinite), mode);
      assert.deepEqual(cartouche, {
        page: 1,
        total: 1,
        colonne: 'A',
        rangee: 1,
        voisins: { haut: null, droite: null, bas: null, gauche: null },
      });
      assert.deepEqual(tables, []);
    }
  });

  test('englobant null : l’échelle du seuil, la page centrée sur l’origine, en paysage', () => {
    // Une page dans chaque orientation, à e* = 2 : égalité, le paysage. La
    // tuile mesure 277/2 = 138,5 cm sur 190/2 = 95 cm, de part et d'autre
    // de l'origine.
    const plan = decouperPlan(null, OPTIONS);
    assert.equal(plan.orientation, 'paysage');
    proche(plan.echelle, 2, 'échelle');
    const { cadrage } = plan.pages[0];
    proche(cadrage.largeur, 138.5, 'largeur', 1e-5);
    proche(cadrage.hauteur, 95, 'hauteur', 1e-5);
    proche(cadrage.x, -69.25, 'x', 1e-5);
    proche(cadrage.y, -47.5, 'y', 1e-5);
  });
});

describe('decouperPlan : les refus', () => {
  const ok = boite(0, 0, 100, 50);
  test('un papier inconnu, une bande absente ou négative, un mode inconnu', () => {
    assert.throws(() => decouperPlan(ok, { ...OPTIONS, papier: 'A3' }), RangeError);
    assert.throws(() => decouperPlan(ok, { ...OPTIONS, papier: 'toString' }), RangeError);
    assert.throws(() => decouperPlan(ok, { ...OPTIONS, bandeMm: undefined }), RangeError);
    assert.throws(() => decouperPlan(ok, { ...OPTIONS, bandeMm: -1 }), RangeError);
    assert.throws(() => decouperPlan(ok, { ...OPTIONS, mode: 'toujours' }), RangeError);
  });

  test('des corps nuls ou non finis, une marge négative, une page sans surface utile', () => {
    assert.throws(() => decouperPlan(ok, { ...OPTIONS, corpsMinMm: 0 }), RangeError);
    assert.throws(() => decouperPlan(ok, { ...OPTIONS, corpsDessinCm: Number.NaN }), RangeError);
    assert.throws(() => decouperPlan(ok, { ...OPTIONS, margeMm: -1 }), RangeError);
    // A4 : 210 − 2 × 105 = 0 mm, en largeur du portrait et en hauteur du paysage.
    assert.throws(() => decouperPlan(ok, { ...OPTIONS, margeMm: 105 }), { name: 'RangeError', message: /aucune orientation/ });
    // 297 − 20 − 300 < 0 : ni le portrait ni le paysage n'ont de hauteur.
    assert.throws(() => decouperPlan(ok, { ...OPTIONS, bandeMm: 300 }), { name: 'RangeError', message: /aucune orientation/ });
    // 297 − 20 − 277 = 0 : le portrait n'a plus de hauteur non plus.
    assert.throws(() => decouperPlan(ok, { ...OPTIONS, bandeMm: 277 }), { name: 'RangeError', message: /aucune orientation/ });
  });

  test('une bande plus haute que le paysage : la découpe se replie sur le portrait, qui garde de la place', () => {
    // Bande de 195 mm, plus de la moitié d'une page couchée : le paysage a
    // 210 − 20 − 195 = −5 mm de hauteur, le portrait 297 − 20 − 195 = 82 mm.
    // Le plan large de 100 × 50 cm, qui préférerait le paysage, s'imprime en
    // portrait : e₁ = min(190/100, 82/50) = 1,64 < 2, sa grille au seuil est
    // ⌈200/190⌉ × ⌈100/82⌉ = 2 × 2, à min(380/100, 164/50) = 3,28.
    for (const mode of ['auto', 'unePage', 'decoupe']) {
      const plan = decouperPlan(boite(0, 0, 100, 50), { ...OPTIONS, bandeMm: 195, mode });
      assert.equal(plan.orientation, 'portrait', mode);
      for (const page of plan.pages) {
        proche(page.cadrage.hauteur * plan.echelle, 82, `${mode} : hauteur utile`, 1e-4);
        proche(page.cadrage.largeur * plan.echelle, 190, `${mode} : largeur utile`, 1e-4);
      }
    }
    assert.equal(decouperPlan(boite(0, 0, 100, 50), { ...OPTIONS, bandeMm: 195 }).pages.length, 4);
    // Lettre : 215,9 − 20 − 196 < 0 en paysage, 279,4 − 20 − 196 = 63,4 en portrait.
    const lettre = decouperPlan(boite(0, 0, 100, 50), { ...OPTIONS, papier: 'Lettre', bandeMm: 196, mode: 'unePage' });
    assert.equal(lettre.orientation, 'portrait');
    proche(lettre.pages[0].cadrage.hauteur * lettre.echelle, PAPIERS.Lettre.hauteur - 20 - 196, 'hauteur utile Lettre', 1e-4);
    // Le plan vide aussi : une page portrait.
    assert.equal(decouperPlan(null, { ...OPTIONS, bandeMm: 195 }).orientation, 'portrait');
  });

  test('un englobant plat, inversé, non fini, ou hors des cotes représentables', () => {
    assert.throws(() => decouperPlan(boite(0, 0, 0, 50), OPTIONS), RangeError);
    // Au-delà de 2³² cm, une cote multiple de 2⁻²⁰ ne tient plus sur 52 bits.
    assert.throws(() => decouperPlan(boite(2 ** 32, 0, 100, 50), OPTIONS), RangeError);
    assert.ok(decouperPlan(boite(2 ** 31, 0, 100, 50), OPTIONS).pages.length >= 1);
    assert.throws(() => decouperPlan({ minX: 0, minY: 10, maxX: 10, maxY: 0 }, OPTIONS), RangeError);
    assert.throws(() => decouperPlan(boite(0, 0, Infinity, 50), OPTIONS), RangeError);
  });

  test('une table sans hauteur de liste quand les listes sont dessinées', () => {
    const geometries = [geometrieTable(table(1, 0, 0), 8), geometrieTable(table(2, 900, 0), 8)];
    const listes = { largeur: 500, hauteurs: new Map([[1, 100]]) };
    assert.throws(() => decouperPlan(englobant(geometries), { ...OPTIONS, geometries, listes }), RangeError);
  });
});

describe('decouperPlan : tuiles contiguës, sans recouvrement, couvrant l’englobant (propriété, § 14.12)', () => {
  // Graine fixée, écrite ici : un contre-exemple se rejoue.
  const GRAINE = 314_159;
  const TIRAGES = 400;
  // Cotes tirées sur une échelle logarithmique, de 10 cm à 500 m : des plans
  // d'une page et des plans découpés sur un axe ou sur les deux.
  const cote = fc.integer({ min: 10_000, max: 47_000 }).map((k) => 10 ** (k / 10_000));
  const coin = fc.double({ min: -100_000, max: 100_000, noNaN: true });
  const cas = fc.record({
    x: coin,
    y: coin,
    largeur: cote,
    hauteur: cote,
    papier: fc.constantFrom('A4', 'Lettre'),
    bandeMm: fc.double({ min: 0, max: 60, noNaN: true }),
    corpsMinMm: fc.double({ min: 0.5, max: 4, noNaN: true }),
    mode: fc.constantFrom('auto', 'unePage', 'decoupe'),
  });

  test('bords à l’égalité exacte, grille complète, englobant couvert, page tenue dans sa surface utile', () => {
    const bilan = { tirages: 0, decoupes: 0, deuxAxes: 0, paysage: 0, portrait: 0, lisibles: 0 };
    fc.assert(
      fc.property(cas, ({ x, y, largeur, hauteur, papier, bandeMm, corpsMinMm, mode }) => {
        const englobe = boite(x, y, largeur, hauteur);
        const plan = decouperPlan(englobe, { papier, margeMm: 10, bandeMm, corpsDessinCm: 18, corpsMinMm, mode });
        const { colonnes, rangees, pages, echelle } = plan;
        bilan.tirages += 1;
        if (pages.length > 1) bilan.decoupes += 1;
        if (colonnes > 1 && rangees > 1) bilan.deuxAxes += 1;
        bilan[plan.orientation] += 1;
        if (plan.lisibleSurUnePage) bilan.lisibles += 1;

        assert.equal(pages.length, colonnes * rangees);
        if (mode === 'unePage' || (mode === 'auto' && plan.lisibleSurUnePage)) assert.equal(pages.length, 1);
        // Hors d'« unePage », le texte imprimé atteint le corps minimal.
        if (mode !== 'unePage') assert.ok(echelle * 18 >= corpsMinMm * (1 - 1e-12), `échelle ${echelle}`);
        const papierOriente = plan.orientation === 'portrait'
          ? PAPIERS[papier]
          : { largeur: PAPIERS[papier].hauteur, hauteur: PAPIERS[papier].largeur };
        const utileL = papierOriente.largeur - 20;
        const utileH = papierOriente.hauteur - 20 - bandeMm;

        pages.forEach((page, rang) => {
          const { cadrage, cartouche } = page;
          const c = rang % colonnes;
          const r = Math.floor(rang / colonnes);
          assert.equal(page.rang, rang);
          assert.equal(cartouche.page, rang + 1);
          assert.equal(cartouche.total, pages.length);
          assert.equal(cartouche.rangee, r + 1);
          assert.ok(cadrage.largeur > 0 && cadrage.hauteur > 0);
          // La tuile, à l'échelle, tient dans la surface utile à 3 × 2⁻²⁰ cm près.
          assert.ok(cadrage.largeur * echelle <= utileL + 3 * 2 ** -20 * echelle * (1 + 1e-9), 'largeur utile');
          assert.ok(cadrage.hauteur * echelle <= utileH + 3 * 2 ** -20 * echelle * (1 + 1e-9), 'hauteur utile');
          if (c + 1 < colonnes) {
            const droite = pages[rang + 1].cadrage;
            assert.equal(cadrage.x + cadrage.largeur, droite.x, 'bord droit = bord gauche de la suivante');
            assert.equal(cadrage.y, droite.y);
            assert.equal(cadrage.hauteur, droite.hauteur);
          }
          if (r + 1 < rangees) {
            const bas = pages[rang + colonnes].cadrage;
            assert.equal(cadrage.y + cadrage.hauteur, bas.y, 'bord bas = bord haut de la suivante');
            assert.equal(cadrage.x, bas.x);
            assert.equal(cadrage.largeur, bas.largeur);
          }
          assert.equal(cartouche.voisins.droite, c + 1 < colonnes ? rang + 1 : null);
          assert.equal(cartouche.voisins.gauche, c > 0 ? rang - 1 : null);
          assert.equal(cartouche.voisins.bas, r + 1 < rangees ? rang + colonnes : null);
          assert.equal(cartouche.voisins.haut, r > 0 ? rang - colonnes : null);
        });
        const premiere = pages[0].cadrage;
        const derniere = pages[pages.length - 1].cadrage;
        assert.ok(premiere.x <= englobe.minX && premiere.y <= englobe.minY, 'coin haut gauche couvert');
        assert.ok(derniere.x + derniere.largeur >= englobe.maxX, 'bord droit couvert');
        assert.ok(derniere.y + derniere.hauteur >= englobe.maxY, 'bord bas couvert');
      }),
      { seed: GRAINE, numRuns: TIRAGES },
    );
    // Un générateur qui ne tire que des plans d'une page rend la propriété
    // vraie sans rien éprouver : chaque famille de cas a son plancher.
    assert.equal(bilan.tirages, TIRAGES);
    for (const famille of ['decoupes', 'deuxAxes', 'paysage', 'portrait', 'lisibles']) {
      assert.ok(bilan[famille] >= 20, `${famille} : ${bilan[famille]}`);
    }
  });
});
