// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de la vue du plan (§ 7.2, § 14.10) : la conversion écran ↔ dessin,
// l'ajustement, les bornes relatives du zoom, le zoom sous le curseur, le
// glissement en écart, la molette et l'attribut transform. Chaque valeur
// attendue est écrite en clair ou se déduit, à la main, de la formule du
// § 7.2 ; les formules fausses qu'une épreuve doit refuser sont écrites ici,
// et montrées rouges sur les mêmes cas.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { FLUX, creerPcg32 } from '../demo/prng.js';
import {
  FACTEUR_CRAN,
  FACTEUR_K_MIN,
  K_MAX,
  K_PLAN_VIDE,
  MARGE_AJUSTEMENT_PX,
  ajuster,
  borner,
  bornesZoom,
  deplacer,
  deplacerVue,
  dessinDepuisEcran,
  ecranDepuisDessin,
  facteurMolette,
  kAjuste,
  transformDe,
  vueDepuisTransform,
  zoomerSous,
} from './vue.js';

const PRECISION = 1e-9;

// Vrai quand a et b diffèrent de moins de PRECISION, relativement à leur
// grandeur quand elle dépasse 1.
const proches = (a, b) => Math.abs(a - b) <= PRECISION * Math.max(1, Math.abs(a), Math.abs(b));

function egauxPoints(recu, attendu, message) {
  assert.ok(
    proches(recu.x, attendu.x) && proches(recu.y, attendu.y),
    `${message} : (${recu.x}, ${recu.y}) au lieu de (${attendu.x}, ${attendu.y})`,
  );
}

function egalesVues(recue, attendue, message) {
  assert.ok(
    proches(recue.k, attendue.k) && proches(recue.tx, attendue.tx) && proches(recue.ty, attendue.ty),
    `${message} : ${JSON.stringify(recue)} au lieu de ${JSON.stringify(attendue)}`,
  );
}

// Un englobant carré de côté c cm, coin haut gauche à l'origine.
const carre = (c) => ({ minX: 0, minY: 0, maxX: c, maxY: c });

describe('vue : conversion écran ↔ dessin (§ 7.2)', () => {
  const VUE = { k: 2, tx: 10, ty: 20 };
  const CADRE = { gauche: 100, haut: 50, largeur: 800, hauteur: 600 };

  // Cas écrits à la main : [vue, cadre, point écran, point de dessin].
  const CAS = [
    [VUE, CADRE, { x: 150, y: 90 }, { x: 20, y: 10 }],
    [{ k: 0.19, tx: -50, ty: 30 }, { gauche: 37, haut: 211, largeur: 1366, hauteur: 700 }, { x: 67, y: 279 }, { x: 80 / 0.19, y: 38 / 0.19 }],
    [{ k: 10, tx: 0, ty: 0 }, { gauche: 37, haut: 211, largeur: 300, hauteur: 900 }, { x: 37, y: 211 }, { x: 0, y: 0 }],
  ];

  // Écarts d'une conversion aux cas écrits à la main, un par cas faux.
  const ecarts = (conversion) =>
    CAS.filter(([vue, cadre, ecran, dessin]) => {
      const recu = conversion(vue, cadre, ecran.x, ecran.y);
      return !(proches(recu.x, dessin.x) && proches(recu.y, dessin.y));
    });

  test('le point écran (150, 90) est le point de dessin (20, 10), et réciproquement', () => {
    egauxPoints(dessinDepuisEcran(VUE, CADRE, 150, 90), { x: 20, y: 10 }, 'dessin');
    egauxPoints(ecranDepuisDessin(VUE, CADRE, 20, 10), { x: 150, y: 90 }, 'écran');
    assert.deepEqual(ecarts(dessinDepuisEcran), []);
  });

  test('trois formules fausses tombent sur les mêmes cas : cadre oublié, division avant la translation, répartition dans un viewBox', () => {
    const cadreOublie = (vue, cadre, x, y) => ({ x: (x - vue.tx) / vue.k, y: (y - vue.ty) / vue.k });
    const diviseAvant = (vue, cadre, x, y) => ({
      x: (x - cadre.gauche) / vue.k - vue.tx,
      y: (y - cadre.haut) / vue.k - vue.ty,
    });
    // Un viewBox carré, de la largeur visible du dessin : le pointeur s'y
    // répartit en proportion du cadre, juste en x, faux en y dès que le cadre
    // n'est pas carré.
    const viewBox = (vue, cadre, x, y) => {
      const cote = cadre.largeur / vue.k;
      return {
        x: -vue.tx / vue.k + ((x - cadre.gauche) / cadre.largeur) * cote,
        y: -vue.ty / vue.k + ((y - cadre.haut) / cadre.hauteur) * cote,
      };
    };
    for (const [nom, faux] of [['cadre oublié', cadreOublie], ['division avant', diviseAvant], ['viewBox', viewBox]]) {
      assert.ok(ecarts(faux).length > 0, nom);
    }
  });

  test("l'aller-retour écran → dessin → écran rend le point, sur 25 points, quatre k et un cadre décalé", () => {
    const cadre = { gauche: 37, haut: 211, largeur: 1366, hauteur: 700 };
    let comptes = 0;
    for (const k of [0.1, 0.19, 1, 10]) {
      const vue = { k, tx: -123.25, ty: 47.5 };
      for (let i = 0; i < 5; i += 1) {
        for (let j = 0; j < 5; j += 1) {
          const ecran = { x: cadre.gauche + (i * cadre.largeur) / 4, y: cadre.haut + (j * cadre.hauteur) / 4 };
          const dessin = dessinDepuisEcran(vue, cadre, ecran.x, ecran.y);
          egauxPoints(ecranDepuisDessin(vue, cadre, dessin.x, dessin.y), ecran, `k = ${k}, (${i}, ${j})`);
          comptes += 1;
        }
      }
    }
    assert.equal(comptes, 100);
  });
});

describe("vue : l'ajustement et les bornes relatives du zoom (§ 7.2, § 14.10)", () => {
  test('un plan de 36 m dans 1 366 × 700 s\'ajuste sous 0,2 px/cm, et k_min vaut 0,5 × k_ajusté sur deux plans', () => {
    const cadre = { gauche: 0, haut: 0, largeur: 1366, hauteur: 700 };
    const grand = kAjuste(carre(3600), cadre);
    assert.ok(proches(grand, (700 - 32) / 3600), `k ajusté ${grand}`);
    assert.ok(grand < 0.2);
    assert.equal(bornesZoom(grand).kMin, 0.5 * grand);
    assert.ok(bornesZoom(grand).kMin < 0.2);
    const petit = kAjuste(carre(400), cadre);
    assert.ok(proches(petit, 668 / 400), `k ajusté ${petit}`);
    assert.equal(bornesZoom(petit).kMin, 0.5 * petit);
    assert.equal(bornesZoom(petit).kMax, 10);
    assert.equal(FACTEUR_K_MIN, 0.5);
    assert.equal(K_MAX, 10);
    assert.equal(MARGE_AJUSTEMENT_PX, 16);
  });

  test('k_max vaut 10 : un zoom avant de facteur 2 depuis k = 9 rend 10', () => {
    const cadre = { gauche: 0, haut: 0, largeur: 800, hauteur: 600 };
    const vue = zoomerSous({ k: 9, tx: 0, ty: 0 }, cadre, 400, 300, 2, bornesZoom(1));
    assert.equal(vue.k, 10);
  });

  test("ajuster centre l'englobant au k ajusté ; le plan vide prend 1 px/cm, l'origine au centre", () => {
    const cadre = { gauche: 0, haut: 0, largeur: 1366, hauteur: 700 };
    const vue = ajuster(carre(3600), cadre);
    assert.ok(proches(vue.k, 668 / 3600));
    egauxPoints(ecranDepuisDessin(vue, cadre, 1800, 1800), { x: 683, y: 350 }, 'centre');
    const decale = { gauche: 37, haut: 211, largeur: 1366, hauteur: 700 };
    egauxPoints(ecranDepuisDessin(ajuster(carre(3600), decale), decale, 1800, 1800), { x: 37 + 683, y: 211 + 350 }, 'centre, cadre décalé');

    const vide = { gauche: 5, haut: 7, largeur: 800, hauteur: 600 };
    assert.equal(K_PLAN_VIDE, 1);
    assert.equal(kAjuste(null, vide), 1);
    assert.deepEqual(ajuster(null, vide), { k: 1, tx: 400, ty: 300 });
    assert.deepEqual(bornesZoom(kAjuste(null, vide)), { kMin: 0.5, kMax: 10 });
  });

  test("un englobant de 10 × 10 cm s'ajuste à k = 10, plafonné ; un englobant réduit à un point aussi", () => {
    const cadre = { gauche: 0, haut: 0, largeur: 800, hauteur: 600 };
    assert.equal(kAjuste(carre(10), cadre), 10);
    assert.equal(ajuster(carre(10), cadre).k, 10);
    assert.equal(kAjuste({ minX: 300, minY: 300, maxX: 300, maxY: 300 }, cadre), 10);
    const ligne = ajuster({ minX: 0, minY: 300, maxX: 3000, maxY: 300 }, cadre);
    assert.ok(proches(ligne.k, 768 / 3000));
    egauxPoints(ecranDepuisDessin(ligne, cadre, 1500, 300), { x: 400, y: 300 }, 'centre');
  });

  test("un cadre nul ou plus petit que ses marges ne s'ajuste pas : null, plan vide compris ; 33 px de large suffisent", () => {
    for (const [largeur, hauteur] of [[0, 600], [800, 0], [0, 0], [20, 20], [32, 600], [800, 32]]) {
      const cadre = { gauche: 0, haut: 0, largeur, hauteur };
      assert.equal(kAjuste(carre(3600), cadre), null, `${largeur} × ${hauteur}`);
      assert.equal(kAjuste(null, cadre), null, `${largeur} × ${hauteur}, plan vide`);
      assert.equal(ajuster(carre(3600), cadre), null, `${largeur} × ${hauteur}`);
      assert.equal(ajuster(null, cadre), null, `${largeur} × ${hauteur}, plan vide`);
    }
    const etroit = { gauche: 0, haut: 0, largeur: 33, hauteur: 600 };
    assert.ok(proches(kAjuste(carre(3600), etroit), 1 / 3600));
  });

  test('bornesZoom refuse un k ajusté qui n\'est pas un nombre fini positif', () => {
    for (const k of [null, undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY, '1']) {
      assert.throws(() => bornesZoom(k), RangeError, String(k));
    }
  });

  test('200 englobants et cadres tirés, nuls et vides compris : chaque nombre rendu est fini, chaque k > 0, ou le résultat vaut null', () => {
    const GRAINE = 20260;
    const alea = creerPcg32(GRAINE, FLUX.DEMO);
    let nuls = 0;
    let rendus = 0;
    for (let i = 0; i < 200; i += 1) {
      const nature = i % 5;
      const cadre = {
        gauche: alea.borne(2000) - 1000,
        haut: alea.borne(2000) - 1000,
        largeur: nature === 0 ? alea.borne(33) : alea.borne(3000),
        hauteur: nature === 1 ? 0 : alea.borne(3000),
      };
      let englobant = null;
      if (nature >= 2) {
        const minX = alea.borne(20000) - 10000;
        const minY = alea.borne(20000) - 10000;
        const plat = nature === 2;
        englobant = {
          minX,
          minY,
          maxX: minX + (plat ? 0 : alea.borne(10000) / 7),
          maxY: minY + (plat ? 0 : alea.borne(10000) / 3),
        };
      }
      const k = kAjuste(englobant, cadre);
      const vue = ajuster(englobant, cadre);
      if (k === null) {
        assert.equal(vue, null, `tirage ${i}`);
        nuls += 1;
        continue;
      }
      rendus += 1;
      assert.ok(Number.isFinite(k) && k > 0 && k <= K_MAX, `tirage ${i} : k ${k}`);
      assert.ok([vue.k, vue.tx, vue.ty].every(Number.isFinite) && vue.k > 0, `tirage ${i} : ${JSON.stringify(vue)}`);
      const bornes = bornesZoom(k);
      assert.ok(Number.isFinite(bornes.kMin) && bornes.kMin > 0, `tirage ${i}`);
    }
    assert.ok(nuls > 0 && rendus > 0, `${nuls} nuls, ${rendus} rendus`);
  });

  test('un cadrage hors des bornes est ramené dans elles, le centre du cadre fixe', () => {
    const cadre = { gauche: 30, haut: 40, largeur: 800, hauteur: 600 };
    const k = kAjuste({ minX: 0, minY: 0, maxX: 1000, maxY: 1420 }, cadre);
    assert.ok(proches(k, 0.4));
    const bornes = bornesZoom(k);
    const memorise = { k: 0.1, tx: -25, ty: 60 };
    const centre = dessinDepuisEcran(memorise, cadre, 30 + 400, 40 + 300);
    const ramene = borner(memorise, cadre, bornes);
    assert.ok(proches(ramene.k, 0.2), `k ${ramene.k}`);
    egauxPoints(dessinDepuisEcran(ramene, cadre, 30 + 400, 40 + 300), centre, 'centre');
    const trop = borner({ k: 25, tx: 3, ty: 4 }, cadre, bornes);
    assert.equal(trop.k, 10);
    assert.deepEqual(borner({ k: 1, tx: 3, ty: 4 }, cadre, bornes), { k: 1, tx: 3, ty: 4 });
  });
});

describe('vue : le zoom sous le curseur (§ 7.2)', () => {
  const CADRE = { gauche: 37, haut: 211, largeur: 800, hauteur: 600 };
  const DEPART = { k: 1, tx: 50, ty: 40 };
  const BORNES = { kMin: 0.2, kMax: 10 };
  const POINTS = [
    { x: 37 + 400, y: 211 + 300 },
    { x: 37 + 799, y: 211 + 599 },
    { x: 37, y: 211 },
  ];

  // Les cas où le point de dessin sous le pointeur bouge, pour une fonction
  // de zoom donnée.
  const fuites = (zoomer) =>
    [1.1, 1 / 1.1, 100, 0.001].flatMap((facteur) =>
      POINTS.filter((p) => {
        const avant = dessinDepuisEcran(DEPART, CADRE, p.x, p.y);
        const apres = dessinDepuisEcran(zoomer(DEPART, CADRE, p.x, p.y, facteur, BORNES), CADRE, p.x, p.y);
        return !(proches(avant.x, apres.x) && proches(avant.y, apres.y));
      }),
    );

  test('le point de dessin sous le pointeur y reste, au centre comme au coin, aux bornes comprises', () => {
    assert.deepEqual(fuites(zoomerSous), []);
    assert.equal(zoomerSous(DEPART, CADRE, 437, 511, 100, BORNES).k, 10);
    assert.equal(zoomerSous(DEPART, CADRE, 437, 511, 0.001, BORNES).k, 0.2);
    assert.ok(proches(zoomerSous(DEPART, CADRE, 437, 511, 1.1, BORNES).k, 1.1));
  });

  test("deux zooms faux tombent : autour de l'origine du cadre, et le bornage appliqué après coup", () => {
    const borne = (k) => Math.min(BORNES.kMax, Math.max(BORNES.kMin, k));
    const autourDeLOrigine = (vue, cadre, x, y, facteur, bornes) => ({ k: borne(vue.k * facteur), tx: vue.tx, ty: vue.ty });
    const borneApres = (vue, cadre, x, y, facteur) => {
      const k = vue.k * facteur;
      const p = dessinDepuisEcran(vue, cadre, x, y);
      return { k: borne(k), tx: x - cadre.gauche - k * p.x, ty: y - cadre.haut - k * p.y };
    };
    assert.ok(fuites(autourDeLOrigine).length > 0);
    assert.ok(fuites(borneApres).length > 0);
  });

  test('un facteur qui n\'est pas un nombre fini positif est refusé', () => {
    for (const facteur of [0, -1.1, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(() => zoomerSous(DEPART, CADRE, 437, 511, facteur, BORNES), RangeError, String(facteur));
    }
  });
});

describe('vue : le glissement se calcule en écart (§ 7.2)', () => {
  test("une table saisie à 37 px de son centre suit l'écart du pointeur, divisé par k", () => {
    const initiale = { x: 300, y: 300 };
    const pointeurInitial = { x: 437, y: 260 };
    assert.deepEqual(deplacer(initiale, pointeurInitial, { x: 477, y: 240 }, 2), { x: 320, y: 290 });
    assert.deepEqual(deplacer(initiale, pointeurInitial, pointeurInitial, 2), initiale);
  });

  test("la mutation qui met l'origine de la table sous le pointeur tombe", () => {
    // Vue où le centre de la table, (300, 300) cm, est à l'écran (400, 260) :
    // le pointeur saisi en (437, 260) est à 37 px à droite du centre.
    const vue = { k: 2, tx: -200, ty: -340 };
    const cadre = { gauche: 0, haut: 0, largeur: 800, hauteur: 600 };
    egauxPoints(ecranDepuisDessin(vue, cadre, 300, 300), { x: 400, y: 260 }, 'centre');
    const sousLePointeur = (initiale, pointeurInitial, pointeur) => dessinDepuisEcran(vue, cadre, pointeur.x, pointeur.y);
    const initiale = { x: 300, y: 300 };
    const pointeurInitial = { x: 437, y: 260 };
    assert.notDeepEqual(sousLePointeur(initiale, pointeurInitial, pointeurInitial, 2), initiale);
    assert.notDeepEqual(sousLePointeur(initiale, pointeurInitial, { x: 477, y: 240 }, 2), { x: 320, y: 290 });
  });

  test("glisser le sol ajoute l'écart du pointeur, en px, et garde k", () => {
    assert.deepEqual(deplacerVue({ k: 0.5, tx: 10, ty: -20 }, { x: 100, y: 100 }, { x: 130, y: 85 }), { k: 0.5, tx: 40, ty: -35 });
  });
});

describe("vue : la molette et l'attribut transform", () => {
  test('un cran vaut 100 px, 3 lignes ou une page ; vers le haut, le facteur dépasse 1', () => {
    assert.equal(FACTEUR_CRAN, 1.1);
    assert.ok(proches(facteurMolette(-100, 0), 1.1));
    assert.ok(proches(facteurMolette(100, 0), 1 / 1.1));
    assert.ok(proches(facteurMolette(-3, 1), 1.1));
    assert.ok(proches(facteurMolette(1, 2), 1 / 1.1));
    assert.ok(proches(facteurMolette(-250, 0), 1.1 ** 2.5));
    assert.equal(facteurMolette(0, 0), 1);
    assert.throws(() => facteurMolette(-100, 3), RangeError);
  });

  test('transformDe et vueDepuisTransform font l\'aller-retour ; une autre forme lève', () => {
    const vues = [
      { k: 2, tx: 10, ty: 20 },
      { k: 1 / 3600, tx: -683.5, ty: 0.1 + 0.2 },
      { k: 10, tx: 1e-7, ty: -2.5e21 },
    ];
    assert.equal(transformDe(vues[0]), 'translate(10,20) scale(2)');
    for (const vue of vues) assert.deepEqual(vueDepuisTransform(transformDe(vue)), vue);
    for (const texte of [
      '',
      'translate(10,20)',
      'scale(2) translate(10,20)',
      'translate(10 20) scale(2)',
      'translate(10,20) scale(0)',
      'translate(10,20) scale(-2)',
      'translate(a,20) scale(2)',
      'translate(10,20) scale(2) rotate(3)',
    ]) {
      assert.throws(() => vueDepuisTransform(texte), SyntaxError, texte);
    }
  });
});
