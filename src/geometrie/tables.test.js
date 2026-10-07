// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de la géométrie des tables (§ 7.1, § 7.7) : diamètre et côté tirés
// du nombre de places, chaises posées dans le sens horaire depuis le haut,
// emprise, poignée hors de toute chaise, bloc de noms, englobant, case libre
// d'une table créée et nombre de places sous la poignée. Les valeurs
// attendues se calculent à la main dans le commentaire qui les précède.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { constante } from './constantes.js';
import { surLeSol } from './designation.js';
import { TAILLE_TEXTE_LISTE_CM } from './texte.js';
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
  geometrieTable,
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

// Hauteur de ligne d'une liste que suppose l'épreuve des bandes : 1,25 corps,
// au-dessus de la hauteur d'encre du gabarit sur les polices courantes. Le
// dessin la mesure au navigateur ; le module de géométrie ne la connaît pas.
const HAUTEUR_LIGNE_SUPPOSEE = 1.25 * TAILLE_TEXTE_LISTE_CM;

// Les fautes « une liste passe sur une autre table » d'un ensemble de tables
// posées {position, forme, places} : pour chaque paire ordonnée, la bande du
// bloc de noms de la première — LARGEUR_BLOC_NOMS_CM de large depuis
// origineListe, places + 1 lignes de haut, en-tête d'une table gelée
// compris — recoupe le carré d'emprise de la seconde, bords exclus. Avec
// avec, seules les paires où figure la table de ce rang, compté depuis 1,
// sont examinées. Rend les fautes et le nombre de paires examinées.
function fautesBandes(posees, { avec = null } = {}) {
  const largeur = constante('LARGEUR_BLOC_NOMS_CM');
  const geometries = posees.map(({ position, forme, places }, rang) => ({
    g: geometrieTable(table(rang + 1, forme, position.x, position.y), places),
    places,
  }));
  const fautes = [];
  let paires = 0;
  for (const { g, places } of geometries) {
    const bande = {
      gauche: g.origineListe.x,
      droite: g.origineListe.x + largeur,
      haut: g.origineListe.y,
      bas: g.origineListe.y + (places + 1) * HAUTEUR_LIGNE_SUPPOSEE,
    };
    for (const { g: autre } of geometries) {
      if (autre === g || (avec !== null && g.id !== avec && autre.id !== avec)) continue;
      paires += 1;
      const e = autre.rayonEmprise;
      const recoupe =
        autre.centre.x + e > bande.gauche &&
        autre.centre.x - e < bande.droite &&
        autre.centre.y + e > bande.haut &&
        autre.centre.y - e < bande.bas;
      if (recoupe) fautes.push(`bloc de la table ${g.id} (${g.centre.x}, ${g.centre.y}) sur la table ${autre.id} (${autre.centre.x}, ${autre.centre.y})`);
    }
  }
  return { fautes, paires };
}

describe('constantes', () => {
  test('les valeurs du contrat', () => {
    assert.equal(PLANCHER_DIAMETRE, 70);
    assert.equal(LARGEUR_PAR_PLACE, 60);
    assert.equal(RAYON_CHAISE, 22);
    assert.equal(RAYON_POIGNEE, 15);
    assert.equal(ECART_POIGNEE, 8);
    assert.equal(ECART_LISTE, 36);
    assert.equal(ECART_RANGEES, 300);
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

  test('un diamètre saisi l’emporte', () => {
    assert.equal(diametre(8, { saisi: 180 }), 180);
    assert.equal(diametre(2, { saisi: 50 }), 50);
  });
});

describe('cote', () => {
  test('max(70, ⌈places / 4⌉ × 60)', () => {
    assert.equal(cote(3), 70);
    assert.equal(cote(5), 120);
    assert.equal(cote(8), 120);
    assert.equal(cote(9), 180);
  });

  test('un côté saisi l’emporte', () => {
    assert.equal(cote(8, { saisi: 150 }), 150);
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

describe('aucune rotation (§ 7.1)', () => {
  test('la géométrie ne porte aucun angle et une seule poignée', () => {
    for (const forme of ['ronde', 'carree']) {
      const g = geometrieTable(table(1, forme, 0, 0), 8);
      assert.deepEqual(
        Object.keys(g).sort(),
        ['centre', 'chaises', 'demiTaille', 'forme', 'id', 'numero', 'origineListe', 'pas', 'poignee', 'rayonEmprise'],
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

  test('diametre et cote : places invalides, dimension saisie nulle ou non finie', () => {
    assert.throws(() => diametre(0), RangeError);
    assert.throws(() => cote(1.5), RangeError);
    assert.throws(() => diametre(8, { saisi: 0 }), RangeError);
    assert.throws(() => cote(8, { saisi: Number.NaN }), RangeError);
    assert.throws(() => diametre(8, { saisi: Infinity }), RangeError);
  });
});

describe('englobant', () => {
  test('null sans table', () => {
    assert.equal(englobant([]), null);
  });

  test('deux tables : min et max exacts de leurs emprises', () => {
    // Ronde de 8 en (300, 600), emprise 240/π + 44 ; carrée de 8 en
    // (−100, 50), emprise 104.
    const r = 240 / Math.PI + 44;
    const e = englobant([
      geometrieTable(table(1, 'ronde', 300, 600), 8),
      geometrieTable(table(2, 'carree', -100, 50), 8),
    ]);
    assert.deepEqual(Object.keys(e).sort(), ['maxX', 'maxY', 'minX', 'minY']);
    proche(e.minX, -204, 'minX');
    proche(e.minY, -54, 'minY');
    proche(e.maxX, 300 + r, 'maxX');
    proche(e.maxY, 600 + r, 'maxY');
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
});
