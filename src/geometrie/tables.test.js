// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de la géométrie des tables (§ 7.1, § 7.7) : diamètre et côté tirés
// du nombre de places, chaises posées dans le sens horaire depuis le haut,
// emprise, poignée hors de toute chaise, bloc de noms, englobant, case libre
// d'une table créée et nombre de places sous la poignée. Les valeurs
// attendues se calculent à la main dans le commentaire qui les précède.
import assert from 'node:assert/strict';
import { HAUTEUR_LIGNE_SUPPOSEE, fautesBandes } from '../../test/bandes.js';
import { describe, test } from '../../test/lanceur.js';
import { constante } from './constantes.js';
import { surLeSol } from './designation.js';
import { TAILLE_TEXTE_LISTE_CM } from './texte.js';
import { MARGE_AJUSTEMENT_PX, ajuster, ecranDepuisDessin } from './vue.js';
import {
  ECART_LISTE,
  ECART_POIGNEE,
  ECART_RANGEES,
  LARGEUR_PAR_PLACE,
  PLANCHER_DIAMETRE,
  RAYON_CHAISE,
  RAYON_POIGNEE,
  caseLibre,
  cote,
  diametre,
  ecartsGrille,
  englobant,
  englobantImpression,
  geometrieTable,
  listeSurTable,
  placesSousPoignee,
} from './tables.js';

const EPSILON = 1e-9;

// Affirme |reel − attendu| ≤ EPSILON, le libellé nommant la grandeur.
function proche(reel, attendu, libelle) {
  assert.ok(Math.abs(reel - attendu) <= EPSILON, `${libelle} : ${reel} au lieu de ${attendu}`);
}

function procheDuPoint(reel, attendu, libelle) {
  proche(reel.x, attendu.x, `${libelle}, x`);
  proche(reel.y, attendu.y, `${libelle}, y`);
}

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Une table du fichier d'état : identifiant, numéro, forme et centre.
const table = (id, forme, x, y) => ({ id, numero: id, sieges: null, forme, position: { x, y } });

describe('constantes', () => {
  test('les valeurs du contrat', () => {
    assert.equal(PLANCHER_DIAMETRE, 70);
    assert.equal(LARGEUR_PAR_PLACE, 60);
    assert.equal(RAYON_CHAISE, 22);
    assert.equal(RAYON_POIGNEE, 15);
    assert.equal(ECART_POIGNEE, 8);
    assert.equal(ECART_LISTE, 36);
    assert.equal(ECART_RANGEES, 300);
    assert.equal(HAUTEUR_LIGNE_SUPPOSEE, 1.25 * TAILLE_TEXTE_LISTE_CM);
  });
});

describe('diametre (§ 7.7)', () => {
  test('le plancher de 70 cm borne 2 et 3 places, le périmètre borne dès 4', () => {
    assert.equal(diametre(2), 70);
    assert.equal(diametre(3), 70);
    // 4 × 60 / π = 76,394 > 70 : un plancher appliqué jusqu'à 6 places rendrait 70.
    proche(diametre(4), 240 / Math.PI, 'diamètre de 4');
    proche(diametre(5), 300 / Math.PI, 'diamètre de 5');
  });

  test('115, 153 et 191 cm pour 6, 8 et 10 places, arrondis (§ 7.7)', () => {
    assert.equal(Math.round(diametre(6)), 115);
    assert.equal(Math.round(diametre(8)), 153);
    assert.equal(Math.round(diametre(10)), 191);
  });

  test('une seule formule : le format 1 ne porte aucun diamètre saisi, et une option ne change rien', () => {
    assert.equal(diametre(8, { saisi: 180 }), diametre(8));
    assert.equal(diametre(2, { saisi: 50 }), 70);
  });
});

describe('cote', () => {
  test('max(70, ⌈places / 4⌉ × 60)', () => {
    assert.equal(cote(3), 70);
    assert.equal(cote(5), 120);
    assert.equal(cote(8), 120);
    assert.equal(cote(9), 180);
  });

  test('une seule formule : une option ne change pas le côté', () => {
    assert.equal(cote(8, { saisi: 150 }), 120);
  });
});

describe('geometrieTable, ronde', () => {
  // Ronde de 8 au centre (300, 600) : diamètre 480/π, demi-taille 240/π
  // (≈ 76,394), chaises sur le cercle de rayon 240/π + 22 (≈ 98,394).
  const g = geometrieTable(table(4, 'ronde', 300, 600), 8);
  const r = 240 / Math.PI;

  test('identité, forme, centre, demi-taille et pas', () => {
    assert.equal(g.id, 4);
    assert.equal(g.numero, 4);
    assert.equal(g.forme, 'ronde');
    assert.deepEqual(g.centre, { x: 300, y: 600 });
    proche(g.demiTaille, r, 'demi-taille');
    proche(g.pas, 60, 'pas');
  });

  test('huit chaises de rayon 22, siège 1 en haut, sens horaire', () => {
    assert.equal(g.chaises.length, 8);
    g.chaises.forEach((chaise, i) => {
      assert.equal(chaise.siege, i + 1);
      assert.equal(chaise.rayon, RAYON_CHAISE);
      proche(distance(chaise, g.centre), r + 22, `distance du siège ${chaise.siege}`);
    });
    procheDuPoint(g.chaises[0], { x: 300, y: 600 - (r + 22) }, 'siège 1');
    procheDuPoint(g.chaises[2], { x: 300 + r + 22, y: 600 }, 'siège 3');
    procheDuPoint(g.chaises[4], { x: 300, y: 600 + r + 22 }, 'siège 5');
  });

  test('emprise, poignée et origine de la liste', () => {
    proche(g.rayonEmprise, r + 44, 'rayon d’emprise');
    const ecart = (r + 44 + 23) / Math.SQRT2;
    procheDuPoint(g.poignee, { x: 300 + ecart, y: 600 + ecart }, 'poignée');
    procheDuPoint(g.origineListe, { x: 300 + r + 80, y: 600 - r }, 'origine de la liste');
  });

  test('ronde de 3 : plancher de 70 cm, pas 70π/3', () => {
    const petite = geometrieTable(table(1, 'ronde', 0, 0), 3);
    proche(petite.demiTaille, 35, 'demi-taille');
    proche(petite.pas, (70 * Math.PI) / 3, 'pas');
  });

  test('le pas vaut 60 exactement au-dessus du plancher, de 4 à 40 places', () => {
    // Le produit π × (places × 60 / π) / places rend 59,999… pour 7 places :
    // le régime des cibles basculerait alors un cran trop tôt.
    let comptees = 0;
    for (let places = 4; places <= 40; places += 1) {
      assert.equal(geometrieTable(table(1, 'ronde', 0, 0), places).pas, 60, `${places} places`);
      comptees += 1;
    }
    assert.equal(comptees, 37);
  });
});

describe('geometrieTable, carrée', () => {
  // Carrée de 8 au centre (300, 600) : côté 120, demi-côté 60, deux sièges
  // par côté à 30 et 90 cm du coin, centres à 60 + 22 = 82 cm de l'axe.
  const g = geometrieTable(table(2, 'carree', 300, 600), 8);

  test('côté 120, pas 60, deux sièges par côté dans le sens horaire', () => {
    assert.equal(g.forme, 'carree');
    assert.equal(g.demiTaille, 60);
    assert.equal(g.pas, 60);
    assert.equal(g.chaises.length, 8);
    const attendus = [
      [270, 518], [330, 518], // haut, de gauche à droite
      [382, 570], [382, 630], // droit, de haut en bas
      [330, 682], [270, 682], // bas, de droite à gauche
      [218, 630], [218, 570], // gauche, de bas en haut
    ];
    g.chaises.forEach((chaise, i) => {
      assert.equal(chaise.siege, i + 1);
      assert.equal(chaise.rayon, RAYON_CHAISE);
      procheDuPoint(chaise, { x: attendus[i][0], y: attendus[i][1] }, `siège ${i + 1}`);
    });
  });

  test('emprise 104, poignée au-delà du coin, liste en (440, 540)', () => {
    assert.equal(g.rayonEmprise, 104);
    procheDuPoint(g.poignee, { x: 404 + 23 / Math.SQRT2, y: 704 + 23 / Math.SQRT2 }, 'poignée');
    procheDuPoint(g.origineListe, { x: 440, y: 540 }, 'origine de la liste');
  });

  test('carrée de 3 : côtés garnis 1, 1, 1, 0 et pas 70', () => {
    // Côté 70, demi-côté 35 : un siège au milieu du haut, du droit et du bas.
    const petite = geometrieTable(table(1, 'carree', 0, 0), 3);
    assert.equal(petite.pas, 70);
    assert.equal(petite.chaises.length, 3);
    procheDuPoint(petite.chaises[0], { x: 0, y: -57 }, 'siège 1');
    procheDuPoint(petite.chaises[1], { x: 57, y: 0 }, 'siège 2');
    procheDuPoint(petite.chaises[2], { x: 0, y: 57 }, 'siège 3');
  });

  test('carrée de 5 : le côté haut reçoit la place en surplus', () => {
    // Côté 120 : 2 sièges en haut, puis 1 à droite, en bas et à gauche.
    const g5 = geometrieTable(table(1, 'carree', 0, 0), 5);
    assert.equal(g5.pas, 60);
    const attendus = [[-30, -82], [30, -82], [82, 0], [0, 82], [-82, 0]];
    assert.equal(g5.chaises.length, attendus.length);
    g5.chaises.forEach((chaise, i) => procheDuPoint(chaise, { x: attendus[i][0], y: attendus[i][1] }, `siège ${i + 1}`));
  });
});

describe('emprise et chaises, de 2 à 40 places', () => {
  test('l’emprise contient chaque chaise, et deux chaises ne se touchent pas', () => {
    let tables = 0;
    for (const forme of ['ronde', 'carree']) {
      for (let places = 2; places <= 40; places += 1) {
        const g = geometrieTable(table(1, forme, 10, -20), places);
        assert.equal(g.chaises.length, places);
        proche(g.rayonEmprise, g.demiTaille + 2 * RAYON_CHAISE, `${forme} de ${places}, emprise`);
        for (const chaise of g.chaises) {
          const dx = Math.abs(chaise.x - g.centre.x);
          const dy = Math.abs(chaise.y - g.centre.y);
          const portee = forme === 'ronde' ? Math.hypot(dx, dy) : Math.max(dx, dy);
          assert.ok(portee + chaise.rayon <= g.rayonEmprise + EPSILON, `${forme} de ${places}, siège ${chaise.siege}`);
        }
        for (let i = 0; i < places; i += 1) {
          for (let j = i + 1; j < places; j += 1) {
            assert.ok(distance(g.chaises[i], g.chaises[j]) >= 2 * RAYON_CHAISE, `${forme} de ${places}, sièges ${i + 1} et ${j + 1}`);
          }
        }
        tables += 1;
      }
    }
    assert.equal(tables, 78);
  });
});

describe('la poignée ne touche aucune chaise (§ 7.1)', () => {
  test('rondes de 3, 8 et 16, carrées de 3, 8, 12 et 16', () => {
    const cas = [
      ['ronde', 3], ['ronde', 8], ['ronde', 16],
      ['carree', 3], ['carree', 8], ['carree', 12], ['carree', 16],
    ];
    let eprouvees = 0;
    for (const [forme, places] of cas) {
      const g = geometrieTable(table(1, forme, 0, 0), places);
      assert.ok(g.chaises.length > 0);
      for (const chaise of g.chaises) {
        assert.ok(
          distance(g.poignee, chaise) > RAYON_CHAISE + RAYON_POIGNEE,
          `${forme} de ${places}, siège ${chaise.siege} à ${distance(g.poignee, chaise)} cm`,
        );
      }
      assert.equal(surLeSol(g.poignee, [g]), true, `${forme} de ${places} : centre de la poignée hors du sol`);
      eprouvees += 1;
    }
    assert.equal(eprouvees, 7);
  });
});

describe('la cible d’un siège a la taille du pas (§ 7.3)', () => {
  test('de 2 à 40 places, deux formes : rayon max(RAYON_CHAISE, pas/2) ; deux cibles ne se recouvrent pas ; le centre de la poignée n’est dans aucune', () => {
    let tables = 0;
    for (const forme of ['ronde', 'carree']) {
      for (let places = 2; places <= 40; places += 1) {
        const g = geometrieTable(table(1, forme, 10, -20), places);
        assert.equal(g.rayonCible, Math.max(RAYON_CHAISE, g.pas / 2), `${forme} de ${places}`);
        for (let i = 0; i < places; i += 1) {
          for (let j = i + 1; j < places; j += 1) {
            const d = distance(g.chaises[i], g.chaises[j]);
            assert.ok(d >= 2 * g.rayonCible - EPSILON, `${forme} de ${places}, sièges ${i + 1} et ${j + 1} à ${d} cm`);
          }
          assert.ok(distance(g.poignee, g.chaises[i]) > g.rayonCible, `${forme} de ${places}, poignée et siège ${i + 1}`);
        }
        tables += 1;
      }
    }
    assert.equal(tables, 78);
  });
});

describe('aucune rotation (§ 7.1)', () => {
  test('la géométrie ne porte aucun angle et une seule poignée', () => {
    for (const forme of ['ronde', 'carree']) {
      const g = geometrieTable(table(1, forme, 0, 0), 8);
      assert.deepEqual(
        Object.keys(g).sort(),
        ['centre', 'chaises', 'demiTaille', 'forme', 'id', 'numero', 'origineListe', 'pas', 'poignee', 'rayonCible', 'rayonEmprise'],
      );
      assert.deepEqual(Object.keys(g.poignee).sort(), ['x', 'y']);
      for (const chaise of g.chaises) assert.deepEqual(Object.keys(chaise).sort(), ['rayon', 'siege', 'x', 'y']);
    }
  });
});

describe('geometrieTable refuse une table qu’elle ne sait pas dessiner', () => {
  test('forme inconnue, places nulles ou non entières', () => {
    assert.throws(() => geometrieTable(table(1, 'ovale', 0, 0), 8), RangeError);
    assert.throws(() => geometrieTable(table(1, 'ronde', 0, 0), 0), RangeError);
    assert.throws(() => geometrieTable(table(1, 'carree', 0, 0), 2.5), RangeError);
  });

  test('diametre et cote : places invalides', () => {
    assert.throws(() => diametre(0), RangeError);
    assert.throws(() => cote(1.5), RangeError);
    assert.throws(() => diametre(Number.NaN), RangeError);
  });
});

describe('englobant : tout ce que le dessin pose de pointable', () => {
  test('null sans table', () => {
    assert.equal(englobant([]), null);
  });

  test('deux tables : min et max exacts de leurs emprises, des cibles de leurs sièges et de leurs poignées', () => {
    // Ronde de 8 en (300, 600) : chaises à r + 22 du centre, r = 240/π,
    // cibles de rayon pas/2 = 30, soit r + 52 de chaque côté — la poignée,
    // à (r + 67)/√2 + 15 ≈ 116,4 sur chaque axe, reste dedans. Carrée de 8
    // en (−100, 50) : emprise 104 ; chaises de gauche en x = −182 et du haut
    // en y = −32, cibles de rayon 30 : −212 et −62.
    const r = 240 / Math.PI;
    const e = englobant([
      geometrieTable(table(1, 'ronde', 300, 600), 8),
      geometrieTable(table(2, 'carree', -100, 50), 8),
    ]);
    assert.deepEqual(Object.keys(e).sort(), ['maxX', 'maxY', 'minX', 'minY']);
    proche(e.minX, -212, 'minX');
    proche(e.minY, -62, 'minY');
    proche(e.maxX, 300 + r + 52, 'maxX');
    proche(e.maxY, 600 + r + 52, 'maxY');
  });

  test('une carrée seule : la poignée, au-delà du coin de l’emprise, borne le bas et la droite', () => {
    // Carrée de 8 en (−100, 50) : centre de la poignée en (4 + 23/√2,
    // 154 + 23/√2), son bord 15 cm plus loin ; les cibles du haut et de la
    // gauche bornent l'autre coin.
    const e = englobant([geometrieTable(table(2, 'carree', -100, 50), 8)]);
    proche(e.minX, -212, 'minX');
    proche(e.minY, -62, 'minY');
    proche(e.maxX, 4 + 23 / Math.SQRT2 + RAYON_POIGNEE, 'maxX');
    proche(e.maxY, 154 + 23 / Math.SQRT2 + RAYON_POIGNEE, 'maxY');
  });

  test('après ajuster, sur une carrée seule de 4 et de 8, le disque de la poignée et chaque cible tiennent dans le cadre moins ses marges', () => {
    const cadre = { gauche: 0, haut: 0, largeur: 1366, hauteur: 700 };
    const dedans = (vue, { x, y }, rayon, libelle) => {
      const p = ecranDepuisDessin(vue, cadre, x, y);
      const r = rayon * vue.k;
      assert.ok(p.x - r >= MARGE_AJUSTEMENT_PX - EPSILON && p.x + r <= cadre.largeur - MARGE_AJUSTEMENT_PX + EPSILON, `${libelle}, x`);
      assert.ok(p.y - r >= MARGE_AJUSTEMENT_PX - EPSILON && p.y + r <= cadre.hauteur - MARGE_AJUSTEMENT_PX + EPSILON, `${libelle}, y`);
    };
    let disques = 0;
    for (const places of [4, 8]) {
      const g = geometrieTable(table(1, 'carree', 0, 0), places);
      const vue = ajuster(englobant([g]), cadre);
      dedans(vue, g.poignee, RAYON_POIGNEE, `carrée de ${places}, poignée`);
      for (const chaise of g.chaises) dedans(vue, chaise, g.rayonCible, `carrée de ${places}, siège ${chaise.siege}`);
      disques += 1 + g.chaises.length;
    }
    assert.equal(disques, 14);
  });
});

describe('englobantImpression : l’englobant du plan imprimé, ses listes comprises (§ 7.7, § 11.7)', () => {
  // Ronde de 8 en (300, 600) : r = 240/π ≈ 76,39, emprise r + 44, origine de
  // la liste en (300 + r + 44 + 36, 600 − r) ; carrée de 8 en (−100, 50) :
  // emprise 104, origine de la liste en (40, −10).
  const r = 240 / Math.PI;
  const geometries = () => [geometrieTable(table(1, 'ronde', 300, 600), 8), geometrieTable(table(2, 'carree', -100, 50), 8)];

  test('null sans table, avec ou sans listes', () => {
    assert.equal(englobantImpression([]), null);
    assert.equal(englobantImpression([], { listes: { largeur: 500, hauteurs: new Map() } }), null);
  });

  test('sans listes, l’englobant du dessin, tel quel', () => {
    assert.deepEqual(englobantImpression(geometries()), englobant(geometries()));
    assert.deepEqual(englobantImpression(geometries(), { listes: null }), englobant(geometries()));
  });

  test('avec listes : maxX au bord du bloc le plus à droite, maxY au pied du plus bas, le reste inchangé', () => {
    // Bloc de la ronde : x de 380 + r à 880 + r, y de 600 − r à 900 − r ;
    // bloc de la carrée : x de 40 à 540, y de −10 à 1 990, sous la ronde.
    const listes = { largeur: 500, hauteurs: new Map([[1, 300], [2, 2000]]) };
    const e = englobantImpression(geometries(), { listes });
    const dessin = englobant(geometries());
    proche(e.maxX, 300 + r + 44 + 36 + 500, 'maxX');
    proche(e.maxY, -10 + 2000, 'maxY');
    assert.equal(e.minX, dessin.minX);
    assert.equal(e.minY, dessin.minY);
  });

  test('un bloc au-dessus et à gauche de tout ne se pose pas : il part de origineListe, vers la droite et le bas', () => {
    // Hauteurs nulles : chaque bloc se réduit à son origine, dans l'emprise
    // en y et à droite d'elle en x ; seul maxX peut croître.
    const listes = { largeur: 0, hauteurs: new Map([[1, 0], [2, 0]]) };
    const e = englobantImpression(geometries(), { listes });
    const dessin = englobant(geometries());
    assert.deepEqual([e.minX, e.minY, e.maxY], [dessin.minX, dessin.minY, dessin.maxY]);
    proche(e.maxX, Math.max(dessin.maxX, 300 + r + 80), 'maxX');
  });

  test('une table sans hauteur de liste, une largeur ou une hauteur négative ou non finie : RangeError', () => {
    const hauteurs = new Map([[1, 300]]);
    assert.throws(() => englobantImpression(geometries(), { listes: { largeur: 500, hauteurs } }), RangeError);
    const deux = new Map([[1, 300], [2, 100]]);
    assert.throws(() => englobantImpression(geometries(), { listes: { largeur: -1, hauteurs: deux } }), RangeError);
    assert.throws(() => englobantImpression(geometries(), { listes: { largeur: Infinity, hauteurs: deux } }), RangeError);
    const negative = new Map([[1, 300], [2, -5]]);
    assert.throws(() => englobantImpression(geometries(), { listes: { largeur: 500, hauteurs: negative } }), RangeError);
  });
});

describe('ecartsGrille : le pas d\u{2019}une grille de tables (§ 7.4, § 7.7)', () => {
  // colonnes = ⌈2 × emprise + 2 × ECART_LISTE + LARGEUR_BLOC_NOMS_CM⌉ ;
  // rangées = max(ECART_RANGEES, ⌈2 × emprise + ECART_LISTE⌉), l'emprise la
  // plus grande des tables données. LARGEUR_BLOC_NOMS_CM vaut 500.
  test('la largeur du bloc de noms est celle du registre', () => {
    assert.equal(constante('LARGEUR_BLOC_NOMS_CM'), 500);
  });

  test('ronde de 3 : emprise 79, colonnes 158 + 72 + 500 = 730, rangées 300', () => {
    assert.deepEqual(ecartsGrille([{ forme: 'ronde', places: 3 }]), { colonnes: 730, rangees: 300 });
  });

  test('ronde de 8 : emprise 120,39, colonnes ⌈812,79⌉ = 813, rangées 300', () => {
    // 2 × 120,3944 + 72 + 500 = 812,789 → 813 ; 2 × 120,3944 + 36 = 276,8 → 300.
    assert.deepEqual(ecartsGrille([{ forme: 'ronde', places: 8 }]), { colonnes: 813, rangees: 300 });
  });

  test('carrée de 8 : côté 120, emprise 104, colonnes 780, rangées 300', () => {
    assert.deepEqual(ecartsGrille([{ forme: 'carree', places: 8 }]), { colonnes: 780, rangees: 300 });
  });

  test('la plus grande emprise décide : une ronde de 16 parmi des rondes de 8 → colonnes 966, rangées 430', () => {
    // diamètre 16 × 60 / π = 305,577 ; emprise 152,789 + 44 = 196,789 ;
    // 393,578 + 572 = 965,578 → 966 ; 393,578 + 36 = 429,578 → 430.
    const tables = [{ forme: 'ronde', places: 8 }, { forme: 'ronde', places: 16 }, { forme: 'carree', places: 8 }];
    assert.deepEqual(ecartsGrille(tables), { colonnes: 966, rangees: 430 });
  });
});

describe('caseLibre : la place d\u{2019}une table créée, sur la grille des démonstrations', () => {
  const huit = { forme: 'ronde', places: 8 };
  const posee = (x, y, autres = huit) => ({ position: { x, y }, ...autres });

  test('sans table, l\u{2019}origine', () => {
    assert.deepEqual(caseLibre([], huit), { x: 0, y: 0 });
  });

  test('deux rondes de 8 en (0, 0) et (813, 0) : deux colonnes, la case suivante est (0, 300)', () => {
    assert.deepEqual(caseLibre([posee(0, 0), posee(813, 0)], huit), { x: 0, y: 300 });
  });

  test('un centre à moins d\u{2019}un pas de colonne, (406,6 ; 0) ou (812,9 ; 0), prend les deux premières cases ; à 813, la première est libre', () => {
    // À 406,6 de (0, 0), le bloc de la table nouvelle, de 156,4 à 656,4,
    // couvrirait l'emprise posée, de 286,2 à 527 : la case est refusée.
    assert.deepEqual(caseLibre([posee(406.6, 0)], huit), { x: 0, y: 300 });
    assert.deepEqual(caseLibre([posee(812.9, 0)], huit), { x: 0, y: 300 });
    assert.deepEqual(caseLibre([posee(813, 0)], huit), { x: 0, y: 0 });
  });

  test('un centre à moins d\u{2019}un pas de rangée, (0 ; 150,1) ou (0 ; 299,9), prend la case (0, 0) ; à 300, elle est libre', () => {
    assert.deepEqual(caseLibre([posee(0, 150.1)], huit), { x: 813, y: 0 });
    assert.deepEqual(caseLibre([posee(0, 299.9)], huit), { x: 813, y: 0 });
    assert.deepEqual(caseLibre([posee(0, 300)], huit), { x: 0, y: 0 });
  });

  test('une table déplacée en (330, 0) prend aussi (813, 0) : la case suivante est (0, 300), et aucun bloc ne passe sur l\u{2019}autre table', () => {
    // En (813, 0), à 483 cm, la liste de la table déplacée, de 486,4 à
    // 986,4, couvrirait la table nouvelle, de 692,6 à 933,4.
    const posees = [posee(330, 0)];
    const position = caseLibre(posees, huit);
    assert.deepEqual(position, { x: 0, y: 300 });
    assert.deepEqual(fautesBandes([...posees, posee(position.x, position.y)]), { fautes: [], paires: 2 });
  });

  test('l\u{2019}épreuve des bandes voit la faute : une ronde de 8 en (330, 0) et une autre en (813, 0)', () => {
    assert.equal(fautesBandes([posee(330, 0), posee(813, 0)]).fautes.length, 1);
  });

  test('une ronde de 8 agrandie à 16 au milieu de rondes de 8 : la table créée au nouveau pas ne porte ni ne subit aucune liste', () => {
    // Vingt rondes de 8 sur cinq colonnes au pas 813 × 300, la première
    // passée à 16 places : le pas devient 966 × 430, sur cinq colonnes. La
    // case (3864, 0) est à 612 cm de la table (3252, 0), dont la liste, de
    // 3408,4 à 3908,4, couvrirait la table nouvelle, de 3743,6 à 3984,4 :
    // elle est prise, comme toute case à moins d'un pas d'une table posée,
    // jusqu'à la rangée 1720, à 820 cm de la dernière. Seules les paires où
    // figure la table nouvelle sont examinées : la table agrandie porte sa
    // liste sur ses voisines, ce que la création ne change pas.
    const posees = Array.from({ length: 20 }, (_, rang) => posee((rang % 5) * 813, Math.floor(rang / 5) * 300));
    posees[0] = posee(0, 0, { forme: 'ronde', places: 16 });
    const position = caseLibre(posees, huit);
    assert.deepEqual(position, { x: 0, y: 1720 });
    assert.deepEqual(fautesBandes([...posees, posee(position.x, position.y)], { avec: 21 }), { fautes: [], paires: 2 * 20 });
  });

  test('le pas suit la table à créer et les tables posées : une ronde de 16 posée écarte la case suivante à 966', () => {
    assert.deepEqual(caseLibre([posee(0, 0, { forme: 'ronde', places: 16 })], huit), { x: 966, y: 0 });
    assert.deepEqual(caseLibre([posee(0, 0)], { forme: 'ronde', places: 16 }), { x: 966, y: 0 });
  });

  test('trente-trois rondes de 8 créées une à une : les cases de la grille des démonstrations, et aucun bloc de noms ne passe sur une autre table', () => {
    const posees = [];
    for (let n = 0; n < 33; n += 1) posees.push(posee(...Object.values(caseLibre(posees, huit))));
    assert.equal(posees.length, 33);
    assert.equal(new Set(posees.map(({ position: { x, y } }) => `${x},${y}`)).size, 33);
    for (const { position } of posees) {
      assert.equal(position.x % 813, 0, `x ${position.x}`);
      assert.equal(position.y % 300, 0, `y ${position.y}`);
    }
    assert.deepEqual(fautesBandes(posees), { fautes: [], paires: 33 * 32 });
  });
});

describe('listeSurTable : la liste d\u{2019}une table passe sur une autre', () => {
  const ronde = (id, x, y, places = 8) => ({ id, forme: 'ronde', position: { x, y }, places });
  const geometrie = ({ id, forme, position, places }) => geometrieTable(table(id, forme, position.x, position.y), places);

  test('une ronde de 8 en (330, 0) porte sa liste sur une autre en (813, 0), non l\u{2019}inverse ; au pas de 813, rien ne se couvre', () => {
    // La liste de la première, de 486,4 à 986,4, couvre l'emprise de la
    // seconde, de 692,6 à 933,4 ; celle de la seconde part vers la droite.
    const [a, b] = [ronde(1, 330, 0), ronde(2, 813, 0)];
    assert.equal(listeSurTable(geometrie(a), 8, geometrie(b)), true);
    assert.equal(listeSurTable(geometrie(b), 8, geometrie(a)), false);
    const [c, d] = [ronde(1, 0, 0), ronde(2, 813, 0)];
    assert.equal(listeSurTable(geometrie(c), 8, geometrie(d)), false);
    assert.equal(listeSurTable(geometrie(d), 8, geometrie(c)), false);
  });

  test('bords exclus : une emprise qui touche la bande ne la recoupe pas ; un centimètre de plus, si', () => {
    // La bande d'une ronde de 8 en (0, 0) va de 156,4 à 656,4 : une table
    // dont l'emprise commence exactement à 656,4 ne la recoupe pas.
    const a = geometrie(ronde(1, 0, 0));
    const largeur = constante('LARGEUR_BLOC_NOMS_CM');
    const bord = a.origineListe.x + largeur;
    const juste = geometrie(ronde(2, bord + a.rayonEmprise, 0));
    assert.equal(listeSurTable(a, 8, juste), false);
    const dedans = geometrie(ronde(2, bord + a.rayonEmprise - 1, 0));
    assert.equal(listeSurTable(a, 8, dedans), true);
    // En bas, la bande compte places + 1 lignes de HAUTEUR_LIGNE_SUPPOSEE.
    const bas = a.origineListe.y + 9 * HAUTEUR_LIGNE_SUPPOSEE;
    assert.equal(listeSurTable(a, 8, geometrie(ronde(2, 400, bas + a.rayonEmprise))), false);
    assert.equal(listeSurTable(a, 8, geometrie(ronde(2, 400, bas + a.rayonEmprise - 1))), true);
  });

  test("l'épreuve des bandes et listeSurTable disent la même chose sur 300 paires tirées", () => {
    let graine = 7;
    const tirer = (n) => {
      graine = (graine * 1103515245 + 12345) % 2147483648;
      return graine % n;
    };
    let couvertes = 0;
    for (let i = 0; i < 300; i += 1) {
      const a = { id: 1, forme: tirer(2) === 0 ? 'ronde' : 'carree', position: { x: 0, y: 0 }, places: 2 + tirer(20) };
      const b = { id: 2, forme: tirer(2) === 0 ? 'ronde' : 'carree', position: { x: tirer(1600) - 200, y: tirer(1200) - 600 }, places: 2 + tirer(20) };
      const attendu = fautesBandes([a, b]).fautes.some((faute) => faute.startsWith('bloc de la table 1 '));
      assert.equal(listeSurTable(geometrie(a), a.places, geometrie(b)), attendu, JSON.stringify([a, b]));
      if (attendu) couvertes += 1;
    }
    assert.ok(couvertes > 20 && couvertes < 280, `${couvertes} paires couvertes`);
  });
});

describe('placesSousPoignee', () => {
  const PAS_RAYON = 60 / (2 * Math.PI);

  test('écart nul, deux pas, dix pas en arrière, un pas', () => {
    assert.equal(placesSousPoignee(8, 0), 8);
    assert.equal(placesSousPoignee(8, 2 * PAS_RAYON), 10);
    assert.equal(placesSousPoignee(8, -10 * PAS_RAYON), 2);
    assert.equal(placesSousPoignee(3, PAS_RAYON), 4);
  });

  test('l’écart s’arrondit au pas le plus proche', () => {
    assert.equal(placesSousPoignee(8, 0.4 * PAS_RAYON), 8);
    assert.equal(placesSousPoignee(8, 0.6 * PAS_RAYON), 9);
    assert.equal(placesSousPoignee(8, -0.6 * PAS_RAYON), 7);
  });

  test('un nombre de places qui n’est pas un entier ≥ 1, ou un écart non fini, lève RangeError', () => {
    for (const [places, ecart] of [[8, Number.NaN], [2.5, 0], [8, Number.POSITIVE_INFINITY], [8, Number.NEGATIVE_INFINITY], [Number.NaN, 0], [0, 0], ['8', 0]]) {
      assert.throws(() => placesSousPoignee(places, ecart), RangeError, `${String(places)}, ${String(ecart)}`);
    }
  });
});
