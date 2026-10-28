// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La production de la planche (§ 11.1 à § 11.4), éprouvée sur le fichier
// produit, relu comme un lecteur réel le lit (test/pdf.js) : les boîtes de
// page, /Info et /ID, la police en sous-ensemble, les filets mesurés sous
// la matrice courante et leur épaisseur, l'ordre
// des noms dans la couche de texte, la zone de silence, les caractères
// extraits un à un, le filigrane, la feuille de contrôle et sa graduation,
// des octets identiques d'un export à l'autre.
//
// La série surveillée borne le coût (§ 14.4) : trois productions sur de
// petits modèles écrits à la main, que toutes les épreuves du fichier
// lisent — A4, cinq badges, feuille par feuille, brouillon tiré de la
// proposition n° 7, horodatage connu, produite deux fois ; Lettre, trois
// badges, dont un absent au tour 2, en pile, retenu,
// horodatage inconnu, sous un nom d'événement plus large que la page, dont
// la ligne de contrôle se replie aux espaces, reporte entier un mot qui
// tient seul, puis coupe un mot qui ne tient pas seul. Les lignes de
// contrôle viennent de textesControle, le mot du filigrane de libelle,
// comme la séance les passera. Les logos des participants s'éprouvent sur
// la même série, A4 debout et Lettre à plat, chacune produite une fois avec
// des logos, et sur des PNG composés ici, morceau par morceau.
import assert from 'node:assert/strict';
import { crc32, deflateSync } from 'node:zlib';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFName } from 'pdf-lib';
import { lirePdf } from '../../test/pdf.js';
import { lireLogo } from '../../test/logo.js';
import { lirePolices } from '../../test/polices.js';
import { describe, test } from '../../test/lanceur.js';
import { libelle } from '../application/libelles.js';
import { textesControle } from '../application/planche.js';
import { constante } from '../geometrie/constantes.js';
import { PAPIERS } from '../geometrie/papiers.js';
import { VERSION } from '../version.genere.js';
import { cadreUtile, cellules, filets, imposer, nombrePlanches } from './imposition.js';
import { lireLogo as lireLogoSvg } from './logo.js';
import { mettreEnPage, metriquesDe } from './mise_en_page.js';
import { analyserPlanche, produireControle, produirePlanche } from './planche.js';

const TOLERANCE = 1e-6;
const ZONE = constante('ZONE_SILENCE_MM');
const MARGE = constante('MARGE_PAGE_MM');
const FILIGRANE = libelle('planche.brouillon');
const TIRET = '\u{2014}';
const polices = lirePolices();

const EVENEMENT = { nom: 'Souper du Club des Merles', date: '2026-10-09' };
// Un nom d'événement plus large que la largeur utile d'une page : des mots,
// dont un mot long qui tient seul sur une ligne mais déborde en fin de
// ligne là où quelques-unes de ses grappes tiendraient encore, puis un mot
// composé sans espace, plus large à lui seul qu'une ligne.
const EVENEMENT_LONG = {
  nom: `Grand souper annuel des amis du Club des Merles et de la Pervenche, au profit des Ombrellebleuetières, Merles${'-Lucioles'.repeat(14)}`,
  date: '2026-10-09',
};
const HORODATAGE = '2026-10-09T19:00:00-04:00';

/** Un badge écrit à la main : ses textes tels que BA1 les compose ; chaque
 *  tour de la liste absentes porte la ligne d'une absente, sans table. */
function badge(participant, nom, { organisation = null, tours = 2, horodatage = HORODATAGE, evenement = EVENEMENT, absentes = [] } = {}) {
  const lignes = Array.from({ length: tours }, (_, i) =>
    absentes.includes(i + 1)
      ? { tour: i + 1, table: null, siege: null, titre: null, absente: true }
      : { tour: i + 1, table: participant + i, siege: null, titre: null, absente: false },
  );
  const ligneHorodatage = horodatage === null ? libelle('planche.pied.horodatageInconnu') : libelle('planche.pied.horodatage', { horodatage });
  return {
    participant,
    nom,
    organisation,
    lignes,
    identifiant: null,
    textes: {
      nom,
      lignes: lignes.map((ligne) => libelle('planche.tour', ligne)),
      organisation,
      pied: [libelle('planche.pied.evenement', evenement), ligneHorodatage],
      piedReduit: [libelle('planche.pied.date', evenement), ligneHorodatage],
    },
  };
}

/** Un modèle de planche écrit à la main. */
function modele(badges, { horodatage = HORODATAGE, brouillon = false, exclus = 0, evenement = EVENEMENT, proposition = null } = {}) {
  return {
    badges,
    source: proposition === null ? 'retenu' : 'proposition',
    proposition,
    evenement,
    horodatage,
    brouillon,
    comptes: { participants: badges.length + exclus, exclus, produits: badges.length },
    homonymes: [],
    reedition: null,
    version: VERSION.affichee,
  };
}

const NOMS_A4 = ['Iris Ombrelle', 'Ôjgq Æ Grisaille', 'Théo Pervenche', 'Ondine Lacasse', 'Merle Bleuet'];
const MODELE_A4 = modele(
  NOMS_A4.map((nom, i) => badge(i + 1, nom, { organisation: i % 2 === 0 ? 'Club des Merles' : null })),
  { brouillon: true, exclus: 1, proposition: 7 },
);
const NOMS_LETTRE = ['Aube Sarcelle', 'Côme Pervenche', 'Ysée Lacasse'];
const MODELE_LETTRE = modele(
  NOMS_LETTRE.map((nom, i) => badge(i + 10, nom, { horodatage: null, tours: 3, evenement: EVENEMENT_LONG, absentes: i === 1 ? [2] : [] })),
  { horodatage: null, evenement: EVENEMENT_LONG },
);

const entrees = (m, papier, imposition) => ({
  modele: m,
  papier,
  imposition,
  polices,
  controle: textesControle(m, { papier, imposition, planches: nombrePlanches(m.badges.length, papier) }),
  filigrane: FILIGRANE,
});

// Les trois productions de la série surveillée.
const octetsA4 = await produirePlanche(entrees(MODELE_A4, 'A4', 'feuille'));
const octetsA4Bis = await produirePlanche(entrees(MODELE_A4, 'A4', 'feuille'));
const octetsLettre = await produirePlanche(entrees(MODELE_LETTRE, 'Lettre', 'pile'));
const A4 = await lirePdf(octetsA4);
const LETTRE = await lirePdf(octetsLettre);
const PRODUCTIONS = [
  { nom: 'A4', papier: 'A4', imposition: 'feuille', lu: A4, modele: MODELE_A4 },
  { nom: 'Lettre', papier: 'Lettre', imposition: 'pile', lu: LETTRE, modele: MODELE_LETTRE },
];

// Le centre d'un fragment de texte, et la cellule qui le contient.
const centre = ({ x, y, l, h }) => [x + l / 2, y + h / 2];
const dans = ([cx, cy], { x, y, largeur, hauteur }) => cx > x && cx < x + largeur && cy > y && cy < y + hauteur;

// Les noms lus dans chaque cellule d'une page de planche, null pour une
// cellule où aucun nom du modèle ne se lit.
function nomsParCellule(page, papier, noms) {
  return cellules(papier).map((cellule) => {
    const lus = page.textes.filter((t) => noms.includes(t.texte) && dans(centre(t), cellule)).map((t) => t.texte);
    assert.ok(lus.length <= 1, `plusieurs noms dans une cellule : ${lus.join(', ')}`);
    return lus[0] ?? null;
  });
}

// La distance d'une boîte de texte à un segment parallèle à un axe.
function distance({ x, y, l, h }, { x1, y1, x2, y2 }) {
  const dx = Math.max(0, Math.min(x1, x2) - (x + l), x - Math.max(x1, x2));
  const dy = Math.max(0, Math.min(y1, y2) - (y + h), y - Math.max(y1, y2));
  return Math.hypot(dx, dy);
}

// Deux segments colinéaires qui se chevauchent sur une longueur non nulle.
function surLeMemeAxe(a, b) {
  const vertical = (s) => Math.abs(s.x1 - s.x2) < TOLERANCE;
  const horizontal = (s) => Math.abs(s.y1 - s.y2) < TOLERANCE;
  const recouvre = (a1, a2, b1, b2) => Math.min(Math.max(a1, a2), Math.max(b1, b2)) - Math.max(Math.min(a1, a2), Math.min(b1, b2)) > TOLERANCE;
  if (vertical(a) && vertical(b)) return Math.abs(a.x1 - b.x1) < 0.01 && recouvre(a.y1, a.y2, b.y1, b.y2);
  if (horizontal(a) && horizontal(b)) return Math.abs(a.y1 - b.y1) < 0.01 && recouvre(a.x1, a.x2, b.x1, b.x2);
  return false;
}

// Les segments d'une page en [x1, y1, x2, y2], arrondis au centième de
// millimètre, chacun de son extrémité la plus haut à gauche, triés dans
// l'ordre lexicographique : une forme comparable à un attendu.
function normaliser(segments) {
  const centieme = (v) => Math.round(v * 100) / 100 + 0; // + 0 : -0 devient 0
  const lexicographique = (s, t) => {
    const i = s.findIndex((v, k) => v !== t[k]);
    return i < 0 ? 0 : s[i] - t[i];
  };
  return segments
    .map(({ x1, y1, x2, y2 }) => {
      const [a, b] = [[x1, y1], [x2, y2]].map((p) => p.map(centieme)).sort(lexicographique);
      return [...a, ...b];
    })
    .sort(lexicographique);
}

describe('produirePlanche : le document (§ 11.1)', () => {
  test('boîtes 210 × 297 et 215,9 × 279,4 à 0,1 mm près sur chaque page ; ni CropBox ni UserUnit ; ni /ID', () => {
    for (const { papier, lu, modele: m } of PRODUCTIONS) {
      assert.equal(lu.pages.length, 1 + nombrePlanches(m.badges.length, papier), papier);
      for (const page of lu.pages) {
        assert.ok(Math.abs(page.boite.largeur - PAPIERS[papier].largeur) < 0.1, `${papier} largeur ${page.boite.largeur}`);
        assert.ok(Math.abs(page.boite.hauteur - PAPIERS[papier].hauteur) < 0.1, `${papier} hauteur ${page.boite.hauteur}`);
        assert.equal(page.cropBox, null);
        assert.equal(page.userUnit, null);
      }
      assert.equal(lu.id, false, papier);
    }
  });

  test("/Info ne porte que CreationDate quand l'horodatage est connu, et n'existe pas quand il est inconnu", () => {
    assert.deepEqual(A4.info, ['CreationDate']);
    assert.deepEqual(LETTRE.info, []);
  });

  test("CreationDate se compose du texte de l'horodatage du placement, décalage local gardé", async () => {
    const document = await PDFDocument.load(octetsA4, { updateMetadata: false });
    assert.equal(document.getInfoDict().lookup(PDFName.of('CreationDate')).asString(), "D:20261009190000-04'00'");
  });

  test('les deux exports A4 du même modèle : mêmes octets', () => {
    assert.equal(octetsA4.length, octetsA4Bis.length);
    assert.ok(Buffer.from(octetsA4).equals(Buffer.from(octetsA4Bis)), 'deux exports diffèrent');
  });

  test('chaque police porte une ToUnicode ; les deux graisses sont embarquées', () => {
    for (const { papier, lu } of PRODUCTIONS) {
      for (const { nom, toUnicode } of lu.polices) assert.ok(toUnicode, `${papier} : ${nom} sans ToUnicode`);
      assert.equal(lu.polices.length, 2, papier);
    }
  });

  test('chaque police embarquée est un sous-ensemble : son FontFile2 pèse moins d\u{2019}un dixième du .ttf de sa graisse', () => {
    const graisses = [
      { motif: /NotoSans-Regular/, ttf: polices.regulier },
      { motif: /NotoSans-Bold/, ttf: polices.gras },
    ];
    for (const { papier, lu } of PRODUCTIONS) {
      for (const { motif, ttf } of graisses) {
        const police = lu.polices.find(({ nom }) => motif.test(nom));
        assert.ok(police !== undefined, `${papier} : aucune police ${motif} parmi ${lu.polices.map(({ nom }) => nom).join(', ')}`);
        assert.ok(police.fontFile2 !== null && police.fontFile2 < ttf.length / 10, `${papier} : ${police.nom} embarque ${police.fontFile2} octets sur ${ttf.length}`);
      }
    }
  });

  test('« Ôjgq » et « Æ » se lisent caractère par caractère dans la couche de texte', () => {
    const lus = A4.pages.slice(1).flatMap(({ textes }) => textes.map(({ texte }) => texte));
    const nom = lus.find((texte) => texte.includes('Ôjgq'));
    assert.ok(nom !== undefined, `aucun fragment ne porte « Ôjgq » : ${lus.join(' | ')}`);
    assert.deepEqual([...nom], [...'Ôjgq Æ Grisaille']);
  });
});

describe('produirePlanche : les filets mesurés (§ 11.2, § 11.3)', () => {
  test('A4, planche pleine : x = 105 de 0 à 296 ; y = 148 et y = 296 de 0 à 210 — trois axes, rien d\u{2019}autre', () => {
    assert.deepEqual(normaliser(A4.pages[1].segments), [
      [0, 148, 210, 148],
      [0, 296, 210, 296],
      [105, 0, 105, 296],
    ]);
  });

  test("A4, planche d'un badge : seuls les segments qui bordent la cellule occupée", () => {
    assert.deepEqual(normaliser(A4.pages[2].segments), [
      [0, 148, 105, 148],
      [105, 0, 105, 148],
    ]);
  });

  test('Lettre, planche pleine : les cinq axes de l\u{2019}encadrement complet', () => {
    assert.deepEqual(normaliser(LETTRE.pages[1].segments), [
      [33.95, 34.7, 33.95, 244.7],
      [33.95, 34.7, 181.95, 34.7],
      [33.95, 139.7, 181.95, 139.7],
      [33.95, 244.7, 181.95, 244.7],
      [181.95, 34.7, 181.95, 244.7],
    ]);
  });

  test("Lettre, planche d'un badge : l'encadrement de la seule cellule occupée", () => {
    assert.deepEqual(normaliser(LETTRE.pages[2].segments), [
      [33.95, 34.7, 33.95, 139.7],
      [33.95, 34.7, 181.95, 34.7],
      [33.95, 139.7, 181.95, 139.7],
      [181.95, 34.7, 181.95, 139.7],
    ]);
  });

  test('chaque filet de coupe est fin : une épaisseur non nulle, d\u{2019}au plus 0,1 mm, sur chaque planche A4 et Lettre', () => {
    for (const { papier, lu } of PRODUCTIONS) {
      lu.pages.slice(1).forEach((page, rang) => {
        assert.ok(page.segments.length > 0, `${papier} planche ${rang + 1}`);
        for (const { epaisseur, ...segment } of page.segments) {
          assert.ok(epaisseur > 0 && epaisseur <= 0.1, `${papier} planche ${rang + 1} : ${epaisseur} mm sur ${JSON.stringify(segment)}`);
        }
      });
    }
  });

  test('page 1 : aucun segment sur un axe de coupe', () => {
    for (const { papier, lu } of PRODUCTIONS) {
      const axes = filets(papier, cellules(papier).map(() => true));
      for (const segment of lu.pages[0].segments) {
        assert.ok(!axes.some((axe) => surLeMemeAxe(segment, axe)), `${papier} : ${JSON.stringify(segment)}`);
      }
    }
  });

  test('aucun motif de tirets, aucun remplissage, aucune couleur hors des gris, sur aucune page', () => {
    for (const { papier, lu } of PRODUCTIONS) {
      lu.pages.forEach((page, rang) => {
        assert.equal(page.tirets, false, `${papier} page ${rang + 1}`);
        assert.equal(page.remplissages, 0, `${papier} page ${rang + 1}`);
        for (const [r, g, b] of page.couleurs) assert.ok(r === g && g === b, `${papier} page ${rang + 1} : ${[r, g, b]}`);
      });
    }
  });
});

describe('produirePlanche : les badges (§ 11.3, § 11.4, § 11.6)', () => {
  test("l'ordre des noms dans la couche de texte, cellule par cellule, égale imposer : feuille en A4, pile en Lettre", () => {
    for (const { papier, imposition, lu, modele: m } of PRODUCTIONS) {
      const noms = m.badges.map(({ nom }) => nom);
      const attendu = imposer(noms.length, papier, imposition).map((planche) => planche.map((i) => (i === null ? null : noms[i])));
      assert.deepEqual(
        lu.pages.slice(1).map((page) => nomsParCellule(page, papier, noms)),
        attendu,
        papier,
      );
    }
  });

  test("aucun fragment de texte, filigrane compris, à moins de ZONE_SILENCE_MM d'un axe de coupe ou d'un bord de feuille", () => {
    for (const { papier, lu } of PRODUCTIONS) {
      const { largeur: W, hauteur: H } = PAPIERS[papier];
      const bords = [
        { x1: 0, y1: 0, x2: W, y2: 0 },
        { x1: 0, y1: H, x2: W, y2: H },
        { x1: 0, y1: 0, x2: 0, y2: H },
        { x1: W, y1: 0, x2: W, y2: H },
      ];
      const axes = [...filets(papier, cellules(papier).map(() => true)), ...bords];
      lu.pages.slice(1).forEach((page, rang) => {
        assert.ok(page.textes.length > 0);
        for (const fragment of page.textes) {
          const plusProche = Math.min(...axes.map((axe) => distance(fragment, axe)));
          assert.ok(plusProche >= ZONE - TOLERANCE, `${papier} planche ${rang + 1}, « ${fragment.texte} » à ${plusProche} mm`);
        }
      });
    }
  });

  test('Lettre : les badges sont à plat, leur texte monte de bas en haut, leur haut à gauche', () => {
    const [premiere] = LETTRE.pages.slice(1);
    const nom = premiere.textes.find(({ texte }) => texte === NOMS_LETTRE[0]);
    assert.ok(nom.h > nom.l, JSON.stringify(nom));
    const premiereLigne = premiere.textes.find(({ texte }) => texte.startsWith('Tour 1'));
    // Le nom est en haut du badge : plus à gauche que les lignes de tour.
    assert.ok(nom.x < premiereLigne.x, `${nom.x} contre ${premiereLigne.x}`);
  });

  test('BROUILLON : une fois dans chaque cellule occupée de l\u{2019}A4, aucune dans une cellule vide ; nulle part dans le Lettre retenu', () => {
    for (const page of A4.pages.slice(1)) {
      const occupees = nomsParCellule(page, 'A4', NOMS_A4).map((nom) => nom !== null);
      cellules('A4').forEach((cellule, rang) => {
        const marques = page.textes.filter((t) => t.texte === FILIGRANE && dans(centre(t), cellule));
        assert.equal(marques.length, occupees[rang] ? 1 : 0, `cellule ${rang}`);
        if (!occupees[rang]) assert.deepEqual(page.textes.filter((t) => dans(centre(t), cellule)), []);
      });
    }
    const lus = LETTRE.pages.flatMap(({ textes }) => textes.map(({ texte }) => texte)).join(' ');
    assert.ok(!lus.includes(FILIGRANE), lus);
  });

  test('BROUILLON au trait (mode de rendu 1) : une fois par cellule occupée de chaque planche A4 et une fois sur sa feuille de contrôle ; le Lettre retenu ne le porte jamais', () => {
    const [controle, ...planches] = A4.pages;
    assert.equal(controle.modesTexte.filter((mode) => mode === 1).length, 1, 'A4 page 1');
    planches.forEach((page, rang) => {
      const occupees = nomsParCellule(page, 'A4', NOMS_A4).filter((nom) => nom !== null).length;
      assert.ok(occupees > 0);
      assert.equal(page.modesTexte.filter((mode) => mode === 1).length, occupees, `A4 planche ${rang + 1}`);
    });
    LETTRE.pages.forEach((page, rang) => {
      assert.ok(page.modesTexte.length > 0);
      assert.deepEqual(page.modesTexte.filter((mode) => mode !== 0), [], `Lettre page ${rang + 1}`);
    });
  });

  test('chaque texte du badge se lit dans la couche de texte : nom, organisation, tours, pied', () => {
    const page = A4.pages[1];
    const lus = new Set(page.textes.map(({ texte }) => texte));
    const [premier] = MODELE_A4.badges;
    for (const texte of [premier.textes.nom, premier.textes.organisation, ...premier.textes.lignes, ...premier.textes.pied]) {
      assert.ok(lus.has(texte), `« ${texte} » absent : ${[...lus].join(' | ')}`);
    }
    assert.ok([...lus].some((texte) => texte.includes(`Tour 2 ${TIRET} table`)));
  });

  test('un badge à lignes « absente » se compose sans refus : la planche Lettre en porte un, et sa ligne se lit dans la couche de texte', () => {
    // produirePlanche refuse ce que la mise en page refuse (analyserPlanche,
    // plus bas) : la production Lettre de la série surveillée, faite, vaut
    // composition sans refus, sans une analyse de plus.
    const absente = MODELE_LETTRE.badges[1];
    assert.deepEqual(absente.textes.lignes, [`Tour 1 ${TIRET} table 11`, `Tour 2 ${TIRET} absente`, `Tour 3 ${TIRET} table 13`]);
    const lus = new Set(LETTRE.pages.flatMap(({ textes }) => textes.map(({ texte }) => texte)));
    for (const texte of absente.textes.lignes) assert.ok(lus.has(texte), `« ${texte} » absent : ${[...lus].join(' | ')}`);
  });
});

// La mesure de la police embarquée, celle que la production emploie :
// les deux graisses chargées par pdf-lib et fontkit dans un document
// neuf, qui ne s'enregistre pas.
const documentDeMesure = await PDFDocument.create({ updateMetadata: false });
documentDeMesure.registerFontkit(fontkit);
const metriques = metriquesDe({
  regulier: await documentDeMesure.embedFont(polices.regulier, { subset: true }),
  gras: await documentDeMesure.embedFont(polices.gras, { subset: true }),
});
const MM_PAR_PT = 25.4 / 72;

describe('produirePlanche : la feuille de contrôle, page 1 (§ 11.3)', () => {
  // La graduation : le segment horizontal de 100 mm, et les repères qui le
  // touchent, verticaux.
  function graduation(page) {
    const horizontaux = page.segments.filter(({ y1, y2 }) => Math.abs(y1 - y2) < TOLERANCE);
    const regles = horizontaux.filter(({ x1, x2 }) => Math.abs(Math.abs(x2 - x1) - 100) < 0.5);
    assert.equal(regles.length, 1, JSON.stringify(horizontaux));
    const [regle] = regles;
    const reperes = page.segments.filter(
      ({ x1, x2, y1, y2 }) => Math.abs(x1 - x2) < TOLERANCE && Math.abs(Math.max(y1, y2) - regle.y1) < TOLERANCE,
    );
    return { regle, reperes };
  }

  // Les lignes de contrôle d'une page : ses fragments dans l'ordre du flux,
  // sans les chiffres de la règle, posés d'abord, ni le filigrane, que sa
  // rotation rend plus haut qu'aucune ligne.
  const CHIFFRES_REGLE = ['0', '50', '100'];
  function fragmentsDeControle(page) {
    const sansFiligrane = page.textes.filter(({ texte, h }) => !(texte === FILIGRANE && h > 20));
    assert.deepEqual(sansFiligrane.slice(0, CHIFFRES_REGLE.length).map(({ texte }) => texte), CHIFFRES_REGLE);
    return sansFiligrane.slice(CHIFFRES_REGLE.length);
  }

  // Les fragments rapportés aux lignes attendues, dans l'ordre : chaque ligne
  // se lit d'un ou de plusieurs fragments consécutifs, accolés quand la coupe
  // tombe dans un mot, séparés par une espace quand elle tombe sur une
  // espace — aucun caractère perdu, ajouté ni déplacé, aucun fragment de
  // reste. Rend, par ligne, ses morceaux, l'indice dans la ligne où chacun
  // commence et la nature de chaque coupe.
  function recomposer(fragments, lignes) {
    let k = 0;
    const recomposees = lignes.map((ligne) => {
      const morceaux = [];
      const debuts = [];
      const coupes = [];
      let position = 0;
      while (position < ligne.length) {
        const fragment = fragments[k];
        assert.ok(fragment !== undefined && ligne.startsWith(fragment.texte, position), `« ${ligne} » à ${position} : « ${fragment?.texte} »`);
        morceaux.push(fragment);
        debuts.push(position);
        k += 1;
        position += fragment.texte.length;
        if (position < ligne.length) {
          const surEspace = ligne[position] === ' ';
          coupes.push(surEspace ? 'espace' : 'mot');
          if (surEspace) position += 1;
        }
      }
      return { ligne, morceaux, debuts, coupes };
    });
    assert.deepEqual(fragments.slice(k).map(({ texte }) => texte), [], 'fragments de reste');
    return recomposees;
  }

  test('graduation de 0 à 100 mm, repérée tous les 10 mm, mesurée sur les segments', () => {
    for (const { papier, lu } of PRODUCTIONS) {
      const { regle, reperes } = graduation(lu.pages[0]);
      const debut = Math.min(regle.x1, regle.x2);
      assert.ok(Math.abs(Math.abs(regle.x2 - regle.x1) - 100) < 0.01, `${papier} : ${JSON.stringify(regle)}`);
      const abscisses = reperes.map(({ x1 }) => x1).sort((a, b) => a - b);
      assert.equal(abscisses.length, 11, papier);
      abscisses.forEach((x, k) => assert.ok(Math.abs(x - (debut + 10 * k)) < 0.01, `${papier} repère ${k} : ${x}`));
      // Dans la marge de la page : la graduation se lit entière.
      assert.ok(debut >= MARGE - TOLERANCE && Math.min(...reperes.flatMap(({ y1, y2 }) => [y1, y2])) >= MARGE - TOLERANCE);
    }
  });

  test("les lignes de contrôle se lisent dans la couche de texte, dans l'ordre et entières : comptes, source, horodatage, version, papier", () => {
    for (const { papier, imposition, lu, modele: m } of PRODUCTIONS) {
      const lignes = textesControle(m, { papier, imposition, planches: nombrePlanches(m.badges.length, papier) });
      recomposer(fragmentsDeControle(lu.pages[0]), lignes);
    }
    const lusA4 = A4.pages[0].textes.map(({ texte }) => texte);
    assert.ok(lusA4.includes(libelle('planche.controle.comptes', MODELE_A4.comptes)));
    assert.ok(lusA4.includes(libelle('planche.pied.horodatage', { horodatage: HORODATAGE })));
    assert.ok(LETTRE.pages[0].textes.some(({ texte }) => texte === libelle('planche.pied.horodatageInconnu')));
    // La source se nomme : la proposition imprimée par son numéro, ou le retenu.
    assert.ok(lusA4.includes('Source : la proposition n° 7, qui n\u{2019}est pas le placement retenu'), lusA4.join(' | '));
    assert.ok(LETTRE.pages[0].textes.some(({ texte }) => texte === 'Source : le placement retenu'));
  });

  test("une ligne plus large que la page se replie dans la largeur utile : aux espaces, puis dans le mot qui ne tient pas seul ; chaque morceau aussi plein qu'il se peut", () => {
    const largeurUtile = PAPIERS.Lettre.largeur - 2 * MARGE;
    const lignes = textesControle(MODELE_LETTRE, { papier: 'Lettre', imposition: 'pile', planches: nombrePlanches(3, 'Lettre') });
    const recomposees = recomposer(fragmentsDeControle(LETTRE.pages[0]), lignes);
    const evenement = recomposees.find(({ ligne }) => ligne === libelle('planche.controle.evenement', EVENEMENT_LONG));
    assert.ok(evenement.coupes.includes('espace') && evenement.coupes.includes('mot'), JSON.stringify(evenement.coupes));
    for (const { ligne, morceaux, debuts, coupes } of recomposees) {
      if (ligne !== evenement.ligne) assert.equal(morceaux.length, 1, ligne);
      const corps = morceaux[0].h / MM_PAR_PT;
      const largeur = (texte) => metriques.largeur(texte, corps, false);
      for (const morceau of morceaux) {
        // La mesure de l'épreuve est celle du fichier : l'avance relue.
        assert.ok(Math.abs(largeur(morceau.texte) - morceau.l) < 0.01, `« ${morceau.texte} » : ${largeur(morceau.texte)} contre ${morceau.l}`);
        assert.ok(morceau.l <= largeurUtile + TOLERANCE, `« ${morceau.texte} » large de ${morceau.l} mm`);
      }
      // Une coupe ne tombe que là où la suite déborde : le premier mot (ou
      // la première grappe) du morceau suivant, ajouté, passe la largeur.
      coupes.forEach((coupe, i) => {
        const suivant = morceaux[i + 1].texte;
        const ajout = coupe === 'espace' ? ` ${suivant.split(' ')[0]}` : suivant.match(/\P{M}\p{M}*/u)[0];
        assert.ok(largeur(morceaux[i].texte + ajout) > largeurUtile, `coupe ${coupe} trop tôt après « ${morceaux[i].texte} »`);
      });
      // Une coupe dans un mot ne tombe que dans un mot plus large à lui seul
      // que la ligne, et ce mot ouvre le morceau qui porte son début : un mot
      // qui tient seul passe entier à la ligne suivante.
      coupes.forEach((coupe, i) => {
        if (coupe !== 'mot') return;
        const position = debuts[i] + morceaux[i].texte.length;
        const debutMot = ligne.lastIndexOf(' ', position - 1) + 1;
        const finMot = ligne.indexOf(' ', position);
        const mot = ligne.slice(debutMot, finMot === -1 ? ligne.length : finMot);
        assert.ok(largeur(mot) > largeurUtile, `« ${mot} », large de ${largeur(mot)} mm, coupé après « ${morceaux[i].texte} »`);
        const porteur = debuts.findLastIndex((debut) => debut <= debutMot);
        assert.equal(debuts[porteur], debutMot, `« ${mot} » commence dans « ${morceaux[porteur].texte} »`);
      });
    }
    // Les données éprouvent le report d'un mot entier : le mot long, qui
    // tient seul sur une ligne, ouvre un morceau alors que sa première
    // grappe tenait encore au bout du morceau précédent.
    const long = 'Ombrellebleuetières,';
    const largeurLue = (texte) => metriques.largeur(texte, evenement.morceaux[0].h / MM_PAR_PT, false);
    const avant = evenement.morceaux.findIndex(({ texte }) => texte.startsWith(long)) - 1;
    assert.ok(avant >= 0, JSON.stringify(evenement.morceaux.map(({ texte }) => texte)));
    assert.ok(largeurLue(long) <= largeurUtile && largeurLue(`${evenement.morceaux[avant].texte} ${long[0]}`) <= largeurUtile);
  });

  test('chaque texte de la feuille de contrôle, chiffres et filigrane compris, tient dans les marges ; chaque ligne part de la marge gauche', () => {
    for (const { papier, lu } of PRODUCTIONS) {
      const { largeur: W, hauteur: H } = PAPIERS[papier];
      const [page] = lu.pages;
      for (const { texte, x, y, l, h } of page.textes) {
        const dedans = x >= MARGE - TOLERANCE && y >= MARGE - TOLERANCE && x + l <= W - MARGE + TOLERANCE && y + h <= H - MARGE + TOLERANCE;
        assert.ok(dedans, `${papier} : « ${texte} » en ${JSON.stringify({ x, y, l, h })}`);
      }
      for (const { texte, x } of fragmentsDeControle(page)) assert.ok(Math.abs(x - MARGE) < TOLERANCE, `${papier} : « ${texte} » part de ${x} mm`);
    }
  });

  test('BROUILLON sur la feuille de contrôle du brouillon : sa ligne et le filigrane, une fois, hors de la graduation', () => {
    const page = A4.pages[0];
    const marques = page.textes.filter(({ texte }) => texte === FILIGRANE);
    assert.equal(marques.length, 2, JSON.stringify(marques));
    const { regle, reperes } = graduation(page);
    const xs = [regle.x1, regle.x2];
    const ys = reperes.flatMap(({ y1, y2 }) => [y1, y2]);
    const zone = { x: Math.min(...xs), y: Math.min(...ys), l: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    for (const marque of marques) {
      const separees =
        marque.x > zone.x + zone.l || marque.x + marque.l < zone.x || marque.y > zone.y + zone.h || marque.y + marque.h < zone.y;
      assert.ok(separees, `${JSON.stringify(marque)} sur la graduation ${JSON.stringify(zone)}`);
    }
  });
});

describe('analyserPlanche : avant de produire (§ 11.5, décision 12)', () => {
  test('un nom à glyphe absent : absents le nomme, une fois, et rien ne refuse', async () => {
    const m = modele([badge(1, 'Ondine 李'), badge(2, 'Théo 李 Pervenche')]);
    assert.deepEqual(await analyserPlanche({ modele: m, polices }), {
      refus: null,
      absents: ['李'],
      sansTechnolibre: 0,
      logosParticipants: { poses: 0, sansPlace: 0 },
    });
  });

  test('le nom de l’événement, que la feuille de contrôle écrit, nomme ses absents après ceux des badges, même quand aucun badge ne le porte', async () => {
    const evenement = { nom: 'Souper des Hérons \u{4E00}', date: EVENEMENT.date };
    const porte = modele([badge(1, 'Ondine 李', { evenement })], { evenement });
    assert.deepEqual((await analyserPlanche({ modele: porte, polices })).absents, ['李', '\u{4E00}']);
    // Les badges du modèle portent le pied d'un autre nom, comme sous la case
    // décochée : l'événement du modèle est le seul à porter le caractère.
    const retire = modele([badge(1, 'Ondine 李')], { evenement });
    assert.deepEqual((await analyserPlanche({ modele: retire, polices })).absents, ['李', '\u{4E00}']);
  });

  test('un badge à 100 tours : refus PLANCHE_TROP_DE_TOURS, et son rang dans le modèle', async () => {
    const m = modele([badge(1, 'Iris Ombrelle'), badge(2, 'Théo Pervenche', { tours: 100 }), badge(3, 'Ondine Lacasse', { tours: 100 })]);
    assert.deepEqual(await analyserPlanche({ modele: m, polices }), {
      refus: { code: 'PLANCHE_TROP_DE_TOURS', details: { tours: 100, repliees: false }, rang: 1 },
      absents: [],
      sansTechnolibre: 0,
      logosParticipants: { poses: 0, sansPlace: 0 },
    });
  });

  test('produirePlanche refuse un modèle que la mise en page refuse, sans rien produire', async () => {
    const m = modele([badge(1, 'Iris Ombrelle', { tours: 100 })]);
    await assert.rejects(produirePlanche(entrees(m, 'A4', 'feuille')), /PLANCHE_TROP_DE_TOURS/);
  });
});

describe('produirePlanche : les entrées hors de leur domaine', () => {
  test('un papier ou une imposition inconnus, des lignes de contrôle qui ne sont pas des chaînes : TypeError', async () => {
    const base = entrees(MODELE_LETTRE, 'Lettre', 'pile');
    await assert.rejects(produirePlanche({ ...base, papier: 'A5' }), TypeError);
    await assert.rejects(produirePlanche({ ...base, imposition: 'damier' }), TypeError);
    await assert.rejects(produirePlanche({ ...base, controle: [1] }), TypeError);
  });

  test("un brouillon sans le mot de son filigrane : TypeError ; un horodatage d'une autre forme : TypeError", async () => {
    await assert.rejects(produirePlanche({ ...entrees(MODELE_A4, 'A4', 'feuille'), filigrane: undefined }), TypeError);
    await assert.rejects(produirePlanche({ ...entrees(MODELE_A4, 'A4', 'feuille'), filigrane: '' }), TypeError);
    const horsForme = { ...MODELE_LETTRE, horodatage: '2026-10-09 19:00' };
    await assert.rejects(produirePlanche({ ...entrees(MODELE_LETTRE, 'Lettre', 'pile'), modele: horsForme }), TypeError);
  });
});

// Le modèle Avery 5392 (§ 11.2, § 11.3) : sept badges, deux feuilles de
// cartes sans feuille de contrôle ni filet ; la feuille de contrôle en un
// second document, la règle et le contour des six cartes.
const AVERY = 'avery5392';
const ZONE_CARTE = constante('ZONE_SILENCE_CARTE_MM');
const NOMS_AVERY = ['Aube Sarcelle', 'Côme Pervenche', 'Iris Ombrelle', 'Merle Bleuet', 'Ondine Lacasse', 'Théo Grisaille', 'Ysée Lacasse'];
const MODELE_AVERY = modele(
  NOMS_AVERY.map((nom, i) => badge(i + 20, nom, { organisation: i % 3 === 0 ? 'Club des Merles' : null })),
  { brouillon: true, proposition: 4 },
);
const controleAvery = (m) =>
  textesControle(m, { papier: 'Lettre', imposition: 'feuille', planches: nombrePlanches(m.badges.length, 'Lettre', AVERY), modeleBadge: AVERY });
const entreesAvery = (m) => ({ ...entrees(m, 'Lettre', 'feuille'), controle: controleAvery(m), modeleBadge: AVERY });
const octets = await produirePlanche(entreesAvery(MODELE_AVERY));
const octetsBis = await produirePlanche(entreesAvery(MODELE_AVERY));
const lu = await lirePdf(octets);
const octetsControle = await produireControle(entreesAvery(MODELE_AVERY));
const controle = await lirePdf(octetsControle);
const cartes = cellules('Lettre', AVERY);

describe('produirePlanche et produireControle : le modèle Avery 5392', () => {
  test('deux pages, une par feuille de cartes, sans feuille de contrôle : chaque boîte mesure 215,9 × 279,4', () => {
    assert.equal(lu.pages.length, 2);
    for (const page of lu.pages) {
      assert.ok(Math.abs(page.boite.largeur - 215.9) < 0.1 && Math.abs(page.boite.hauteur - 279.4) < 0.1, JSON.stringify(page.boite));
      assert.equal(page.cropBox, null);
    }
    assert.ok(!lu.pages.some((page) => page.textes.some(({ texte }) => texte === '100')), 'aucune règle');
  });

  test('aucun filet de coupe : les cartes sont prédécoupées', () => {
    for (const page of lu.pages) assert.deepEqual(page.segments, []);
  });

  test('les noms tombent dans les cartes, carte après carte, dans l’ordre de la pile', () => {
    const lus = lu.pages.map((page) =>
      cartes.map((carte) => page.textes.find((t) => NOMS_AVERY.includes(t.texte) && dans(centre(t), carte))?.texte ?? null),
    );
    assert.deepEqual(lus, [NOMS_AVERY.slice(0, 6), [NOMS_AVERY[6], null, null, null, null, null]]);
  });

  test('aucun texte, filigrane compris, à moins de ZONE_SILENCE_CARTE_MM du bord de sa carte ; le texte se lit droit', () => {
    for (const page of lu.pages) {
      for (const t of page.textes) {
        const carte = cartes.find((c) => dans(centre(t), c));
        assert.ok(carte !== undefined, t.texte);
        const ecart = Math.min(t.x - carte.x, t.y - carte.y, carte.x + carte.largeur - (t.x + t.l), carte.y + carte.hauteur - (t.y + t.h));
        assert.ok(ecart >= ZONE_CARTE - 0.01, `${t.texte} : ${ecart}`);
      }
      const nom = page.textes.find(({ texte }) => NOMS_AVERY.includes(texte));
      assert.ok(nom.l > nom.h, 'un nom droit est plus large que haut');
    }
  });

  test('BROUILLON, une fois dans chaque carte occupée ; les mêmes octets d’un export à l’autre', () => {
    const filigranes = lu.pages.map((page) => page.textes.filter(({ texte }) => texte === FILIGRANE).length);
    assert.deepEqual(filigranes, [6, 1]);
    assert.deepEqual(octetsBis, octets);
  });

  test('la feuille de contrôle à part : une page Lettre, la règle de 100 mm, les lignes de contrôle, le filigrane', async () => {
    assert.equal(controle.pages.length, 1);
    const [page] = controle.pages;
    assert.ok(Math.abs(page.boite.largeur - 215.9) < 0.1 && Math.abs(page.boite.hauteur - 279.4) < 0.1);
    const regles = page.segments.filter(({ x1, x2, y1, y2 }) => Math.abs(y1 - y2) < TOLERANCE && Math.abs(Math.abs(x2 - x1) - 100) < 0.01);
    assert.equal(regles.length, 1);
    const texte = page.textes.map(({ texte: t }) => t).join(' ');
    for (const ligne of [libelle('planche.controle.planches', { planches: 2 }), libelle('planche.controle.source', { source: 'proposition', proposition: 4 })]) {
      assert.ok(texte.includes(ligne), ligne);
    }
    assert.equal(page.textes.filter(({ texte: t, h }) => t === FILIGRANE && h > 20).length, 1);
    assert.deepEqual(await produireControle(entreesAvery(MODELE_AVERY)), octetsControle);
  });

  test('la feuille de contrôle trace le contour des six cartes à leur place exacte, à 0,01 mm : trois verticales, quatre horizontales', () => {
    const [page] = controle.pages;
    const contour = normaliser(page.segments.filter(({ x1, x2, y1, y2 }) => Math.abs(Math.abs(x2 - x1) - 100) >= 0.01 || Math.abs(y1 - y2) >= TOLERANCE))
      .filter(([x1, y1, x2, y2]) => Math.max(x2 - x1, y2 - y1) > 50);
    assert.deepEqual(contour, normaliser([
      ...[6.35, 107.95, 209.55].map((x) => ({ x1: x, y1: 25.4, x2: x, y2: 254 })),
      ...[25.4, 101.6, 177.8, 254].map((y) => ({ x1: 6.35, y1: y, x2: 209.55, y2: y })),
    ]));
  });

  test('les lignes de contrôle se replient dans la colonne de gauche des cartes : aucune ne croise le contour du milieu', () => {
    const [page] = controle.pages;
    // Les chiffres de la règle se lisent au-dessus du contour, hors des cartes.
    const sousLaRegle = page.textes.filter(({ y, h }) => h < 20 && y > cartes[0].y);
    assert.ok(sousLaRegle.length >= controleAvery(MODELE_AVERY).length);
    assert.ok(page.textes.every(({ y, h, texte }) => h >= 20 || y > cartes[0].y || ['0', '50', '100'].includes(texte)));
    for (const t of sousLaRegle) {
      assert.ok(t.x >= MARGE - 0.01 && t.x + t.l <= 107.95 - MARGE + 0.01, `${t.texte} : ${t.x} + ${t.l}`);
    }
  });

  test('analyserPlanche met en page sur la carte : 60 tours refusés sur Avery 5392, tenus sur l’A6', async () => {
    const m = modele([badge(1, 'Iris Ombrelle', { tours: 60 })]);
    assert.deepEqual((await analyserPlanche({ modele: m, polices, modeleBadge: AVERY })).refus, {
      code: 'PLANCHE_TROP_DE_TOURS',
      details: { tours: 60, repliees: false },
      rang: 0,
    });
    assert.equal((await analyserPlanche({ modele: m, polices })).refus, null);
  });

  test('Avery 5392 sur A4, un modèle inconnu, ou la feuille de contrôle à part d’un A6 : TypeError', async () => {
    await assert.rejects(produirePlanche({ ...entreesAvery(MODELE_AVERY), papier: 'A4' }), TypeError);
    await assert.rejects(produirePlanche({ ...entreesAvery(MODELE_AVERY), modeleBadge: 'A6' }), TypeError);
    await assert.rejects(produireControle({ ...entreesAvery(MODELE_AVERY), papier: 'A4' }), TypeError);
    await assert.rejects(produireControle({ ...entrees(MODELE_A4, 'A4', 'feuille'), modeleBadge: 'a6' }), TypeError);
  });
});

// Le pied TechnoLibre (§ 11.4) : un texte et le logo en couleurs d'origine,
// sous le pied de chaque badge où il tient, dessinés en vecteurs. Les
// planches A4 debout, Lettre à plat et Avery 5392 le portent ; la feuille
// de contrôle, jamais.
const TECHNOLIBRE = Object.freeze({ texte: libelle('planche.technolibre'), logo: lireLogo() });
// Les couleurs du logo, dans l'ordre de ses formes : le fond, les lettres
// blanches, les lettres jaunes.
const COULEURS_LOGO = [[0x24, 0x37, 0x42], [255, 255, 255], [0xff, 0xd1, 0x66]];
const avecPromotion = (base) => ({ ...base, technolibre: TECHNOLIBRE });
const octetsAveryT = await produirePlanche(avecPromotion(entreesAvery(MODELE_AVERY)));
const octetsA4T = await produirePlanche(avecPromotion(entrees(MODELE_A4, 'A4', 'feuille')));
const octetsLettreT = await produirePlanche(avecPromotion(entrees(MODELE_LETTRE, 'Lettre', 'pile')));
const PRODUCTIONS_T = [
  { nom: 'Avery 5392', lu: await lirePdf(octetsAveryT), cases: cartes, zone: ZONE_CARTE, pages: [1, 2], rapportLogo: 5 },
  { nom: 'A4', lu: await lirePdf(octetsA4T), cases: cellules('A4'), zone: ZONE, pages: [2, 3], rapportLogo: 5 },
  { nom: 'Lettre', lu: await lirePdf(octetsLettreT), cases: cellules('Lettre'), zone: ZONE, pages: [2, 3], rapportLogo: 5 },
];
// Le logo lu, et l'englobant de chaque forme, contrôles des courbes compris,
// dans la boîte de vue.
const LOGO = lireLogoSvg(TECHNOLIBRE.logo);
const ENGLOBANTS_LOGO = LOGO.formes.map(({ trace }) => {
  const points = trace.flatMap((p) => (p.op === 'Z' ? [] : p.op === 'C' ? [[p.x1, p.y1], [p.x2, p.y2], [p.x, p.y]] : [[p.x, p.y]]));
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
});
// Le corps de départ du texte TechnoLibre, et la hauteur du logo à ce corps.
const HAUTEUR_LOGO = (2 * constante('CORPS_TECHNOLIBRE_PT') * 25.4) / 72;

describe('produirePlanche : le pied TechnoLibre (§ 11.4)', () => {
  test('chaque badge porte le logo, trois remplissages dans ses couleurs d’origine, dans l’ordre du fichier', () => {
    for (const { nom, lu: document, cases } of PRODUCTIONS_T) {
      const planches = document.pages.slice(nom === 'Avery 5392' ? 0 : 1);
      const badges = planches.reduce((n, page) => n + cases.filter((c) => page.textes.some((t) => dans(centre(t), c))).length, 0);
      const zones = planches.flatMap((page) => page.zonesRemplies);
      assert.equal(zones.length, 3 * badges, nom);
      zones.forEach((zone, rang) => assert.deepEqual(zone.couleur, COULEURS_LOGO[rang % 3], `${nom} ${rang}`));
    }
  });

  test('le fond du logo, centré dans son badge, posé au bas du cadre utile ; ses lettres dans le fond — debout et sur la carte comme à plat', () => {
    for (const { nom, lu: document, cases, zone: silence } of PRODUCTIONS_T) {
      const aPlat = nom === 'Lettre';
      assert.ok(document.pages.filter((page) => page.zonesRemplies.length > 0).length >= 2, nom);
      for (const page of document.pages) {
        for (let i = 0; i < page.zonesRemplies.length; i += 3) {
          const [fond, ...lettres] = page.zonesRemplies.slice(i, i + 3);
          const cellule = cases.find((c) => dans([fond.x + fond.largeur / 2, fond.y + fond.hauteur / 2], c));
          assert.ok(cellule !== undefined, nom);
          const [long, court] = aPlat ? [fond.hauteur, fond.largeur] : [fond.largeur, fond.hauteur];
          assert.ok(Math.abs(court - HAUTEUR_LOGO) < 0.01 && Math.abs(long - 5 * court) < 0.01, `${nom} : ${JSON.stringify(fond)}`);
          if (aPlat) {
            // Le haut du badge à gauche : son bas tombe à droite de la cellule.
            assert.ok(Math.abs(fond.x + fond.largeur - (cellule.x + cellule.largeur - silence)) < 0.01, `${nom} : ${JSON.stringify(fond)}`);
            assert.ok(Math.abs(fond.y + fond.hauteur / 2 - (cellule.y + cellule.hauteur / 2)) < 0.01, nom);
          } else {
            assert.ok(Math.abs(fond.y + fond.hauteur - (cellule.y + cellule.hauteur - silence)) < 0.01, `${nom} : ${JSON.stringify(fond)}`);
            assert.ok(Math.abs(fond.x + fond.largeur / 2 - (cellule.x + cellule.largeur / 2)) < 0.01, nom);
          }
          for (const l of lettres) {
            assert.ok(l.x >= fond.x - 0.01 && l.y >= fond.y - 0.01 && l.x + l.largeur <= fond.x + fond.largeur + 0.01 && l.y + l.hauteur <= fond.y + fond.hauteur + 0.01, nom);
          }
          if (!aPlat) {
            // Les lettres à leur place dans le fond, comme le fichier les
            // dessine, y vers le bas : ni retournées, ni décalées.
            const echelle = fond.hauteur / LOGO.hauteur;
            lettres.forEach((l, rang) => {
              const e = ENGLOBANTS_LOGO[rang + 1];
              const attendu = [fond.x + e.x1 * echelle, fond.y + e.y1 * echelle, (e.x2 - e.x1) * echelle, (e.y2 - e.y1) * echelle];
              [l.x, l.y, l.largeur, l.hauteur].forEach((v, k) => assert.ok(Math.abs(v - attendu[k]) < 0.005, `${nom} : ${JSON.stringify(l)} contre ${attendu}`));
            });
          }
        }
      }
    }
  });

  test('le texte TechnoLibre se lit dans chaque badge, entre le pied et le logo, dans la zone de silence', () => {
    const avery = PRODUCTIONS_T[0];
    assert.deepEqual(avery.lu.pages.map((page) => page.zonesRemplies.length), [18, 3]);
    for (const page of avery.lu.pages) {
      for (let i = 0; i < page.zonesRemplies.length; i += 3) {
        const fond = page.zonesRemplies[i];
        const carte = cartes.find((c) => dans([fond.x + 1, fond.y + 1], c));
        const dedans = page.textes.filter((t) => dans(centre(t), carte));
        const promotion = dedans.filter((t) => t.y > dedans.find((d) => d.texte.startsWith('Placement'))?.y && t.y < fond.y);
        const lu = promotion.map((t) => t.texte).join(' ');
        assert.equal(lu.replace(/\s+/g, ' '), TECHNOLIBRE.texte, lu);
        for (const t of promotion) assert.ok(t.y + t.h <= fond.y + 0.01 && t.x >= carte.x + ZONE_CARTE - 0.01, t.texte);
      }
    }
  });

  // Les fragments lus se regroupent par ligne, à la même ordonnée, rejoints
  // de gauche à droite : la dernière ligne du texte TechnoLibre porte au
  // moins deux mots, sur la carte comme sur l'A4 debout.
  test('le texte TechnoLibre ne laisse aucun mot seul sur sa dernière ligne', () => {
    for (const { nom, lu: document, cases, pages } of PRODUCTIONS_T.slice(0, 2)) {
      let vus = 0;
      for (const page of pages.map((p) => document.pages[p - 1])) {
        for (let i = 0; i < page.zonesRemplies.length; i += 3) {
          const fond = page.zonesRemplies[i];
          const cellule = cases.find((c) => dans([fond.x + 1, fond.y + 1], c));
          const dedans = page.textes.filter((t) => dans(centre(t), cellule));
          const placement = dedans.find((d) => d.texte.startsWith('Placement'));
          const promotion = dedans.filter((t) => t.y > placement.y && t.y < fond.y);
          const ordonnees = [...new Set(promotion.map((t) => t.y.toFixed(2)))].sort((a, b) => a - b);
          const lignes = ordonnees.map((y) =>
            promotion
              .filter((t) => t.y.toFixed(2) === y)
              .sort((a, b) => a.x - b.x)
              .map((t) => t.texte)
              .join(' ')
              .trim(),
          );
          assert.equal(lignes.join(' ').replace(/\s+/g, ' '), TECHNOLIBRE.texte, nom);
          assert.ok(lignes.length >= 2, `${nom} : ${JSON.stringify(lignes)}`);
          assert.ok(/\S\s+\S/u.test(lignes.at(-1)), `${nom} : ${JSON.stringify(lignes)}`);
          vus += 1;
        }
      }
      assert.ok(vus > 0, nom);
    }
  });

  // Ces planches ne portent aucun logo de participant : le pied TechnoLibre
  // y est la seule couleur.
  test('le logo est la seule couleur : chaque texte de la planche se montre en noir, celui qui suit un logo compris', () => {
    for (const { nom, lu: document } of PRODUCTIONS_T) {
      // Les pages où un texte suit un logo : celles qui portent un logo et
      // plus d'un badge.
      assert.ok(document.pages.some((page) => page.zonesRemplies.length > 3), nom);
      for (const page of document.pages) {
        assert.ok(page.couleursTexte.length > 0, nom);
        page.couleursTexte.forEach((couleur, rang) => assert.deepEqual(couleur, [0, 0, 0], `${nom}, texte ${rang + 1}`));
      }
    }
  });

  test('les mêmes octets d’un export à l’autre ; sans pied TechnoLibre, la planche d’avant, octet pour octet', async () => {
    assert.deepEqual(await produirePlanche(avecPromotion(entreesAvery(MODELE_AVERY))), octetsAveryT);
    assert.deepEqual(await produirePlanche({ ...entreesAvery(MODELE_AVERY), technolibre: null }), octets);
    assert.notDeepEqual(octetsAveryT, octets);
  });

  test('analyserPlanche compte les badges où le pied TechnoLibre se retire, ceux où la mise en page ne le pose pas ; la planche n’y dessine pas le logo', async () => {
    const m = modele(Array.from({ length: 16 }, (_, i) => badge(i + 1, NOMS_AVERY[i % NOMS_AVERY.length], { organisation: 'Club des Merles', tours: i + 1 })));
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const metriques = metriquesDe({ regulier: await pdf.embedFont(polices.regulier, { subset: true }), gras: await pdf.embedFont(polices.gras, { subset: true }) });
    const posees = m.badges.map((b) => mettreEnPage(b.textes, metriques, AVERY, { texte: TECHNOLIBRE.texte, rapport: 5 }).technolibre.corps !== null);
    const retires = posees.filter((p) => !p).length;
    assert.ok(retires > 0 && retires < m.badges.length, String(retires));
    const analyse = await analyserPlanche({ modele: m, polices, modeleBadge: AVERY, technolibre: TECHNOLIBRE });
    assert.deepEqual(analyse, { refus: null, absents: [], sansTechnolibre: retires, logosParticipants: { poses: 0, sansPlace: 0 } });
    assert.equal((await analyserPlanche({ modele: m, polices, modeleBadge: AVERY })).sansTechnolibre, 0);
    const document = await lirePdf(await produirePlanche(avecPromotion({ ...entreesAvery(m) })));
    assert.equal(document.pages.reduce((n, page) => n + page.zonesRemplies.length, 0), 3 * (m.badges.length - retires));
  });

  test('un pied TechnoLibre mal formé lève TypeError : texte absent ou qui n’est pas une chaîne, logo qui n’est pas des octets ou pas un SVG lisible', async () => {
    const base = entreesAvery(MODELE_AVERY);
    const fautes = [
      { logo: TECHNOLIBRE.logo },
      { texte: null, logo: TECHNOLIBRE.logo },
      { texte: TECHNOLIBRE.texte, logo: 'svg' },
      { texte: TECHNOLIBRE.texte, logo: new TextEncoder().encode('<svg/>') },
      'oui',
    ];
    for (const technolibre of fautes) {
      await assert.rejects(produirePlanche({ ...base, technolibre }), TypeError, JSON.stringify(technolibre));
      await assert.rejects(analyserPlanche({ modele: MODELE_AVERY, polices, modeleBadge: AVERY, technolibre }), TypeError);
    }
  });

  test('un texte vide : chaque carte porte le logo seul, sans ligne de texte TechnoLibre, et la planche se produit', async () => {
    const document = await lirePdf(await produirePlanche({ ...entreesAvery(MODELE_AVERY), technolibre: { texte: '', logo: TECHNOLIBRE.logo } }));
    const avec = PRODUCTIONS_T[0].lu;
    assert.deepEqual(document.pages.map((page) => page.zonesRemplies.length), avec.pages.map((page) => page.zonesRemplies.length));
    const lus = document.pages.flatMap((page) => page.textes.map(({ texte }) => texte)).join(' ');
    for (const mot of TECHNOLIBRE.texte.split(' ')) assert.ok(!lus.includes(mot), `${mot} : ${lus}`);
    const sans = await lirePdf(octets);
    assert.deepEqual(
      document.pages.map((page) => page.textes.map(({ texte }) => texte)),
      sans.pages.map((page) => page.textes.map(({ texte }) => texte)),
    );
  });

  test('un texte personnalisé passe par la garde des caractères : un caractère que la police n’a pas se nomme dans absents, après ceux des badges, une fois, sans refus', async () => {
    const m = modele([badge(1, 'Ondine \u{4E00}'), badge(2, 'Théo Pervenche')]);
    const technolibre = { texte: 'Atelier \u{674E} des Hérons \u{674E}', logo: TECHNOLIBRE.logo };
    const analyse = await analyserPlanche({ modele: m, polices, modeleBadge: AVERY, technolibre });
    assert.deepEqual([analyse.refus, analyse.absents], [null, ['\u{4E00}', '\u{674E}']]);
    assert.deepEqual((await analyserPlanche({ modele: m, polices, modeleBadge: AVERY })).absents, ['\u{4E00}']);
    assert.deepEqual((await analyserPlanche({ modele: m, polices, modeleBadge: AVERY, technolibre: TECHNOLIBRE })).absents, ['\u{4E00}']);
  });
});

// Le logo du participant (§ 11.4, § 11.5) : une image PNG, embarquée une
// fois par chemin, peinte par Do sous une matrice qui la pose dans la boîte
// que la mise en page donne, dans le repère du badge — debout sur A4, à plat
// sur Lettre —, après le texte et le pied TechnoLibre, avant le filigrane.
// Un badge sans logo, ou dont le logo ne trouve pas de place, sort tel
// qu'avant, octet pour octet.
const SIGNATURE_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const mot = (n) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
// Un morceau PNG : longueur, type, données, CRC du type et des données.
function morceauPng(type, donnees) {
  const corps = [...new TextEncoder().encode(type), ...donnees];
  return [...mot(donnees.length), ...corps, ...mot(crc32(Uint8Array.from(corps)))];
}
// Un PNG RVB 8 bits d'une couleur unie ; donnees remplace l'IDAT compressé.
function pngUni(largeur, hauteur, couleur, donnees = null) {
  const ligne = [0, ...Array.from({ length: largeur }, () => couleur).flat()];
  const idat = donnees ?? [...deflateSync(Uint8Array.from(Array.from({ length: hauteur }, () => ligne).flat()))];
  const ihdr = [...mot(largeur), ...mot(hauteur), 8, 2, 0, 0, 0];
  return Uint8Array.from([...SIGNATURE_PNG, ...morceauPng('IHDR', ihdr), ...morceauPng('IDAT', idat), ...morceauPng('IEND', [])]);
}
const chemin = (chiffre) => `logo/${chiffre.repeat(64)}.png`;
const LARGE = chemin('a');
const HAUT = chemin('b');
const MANQUANT = chemin('c');
const LOGOS = new Map([
  [LARGE, pngUni(4, 2, [200, 30, 30])],
  [HAUT, pngUni(2, 4, [30, 30, 200])],
]);
const RAPPORTS = new Map([
  [LARGE, 2],
  [HAUT, 0.5],
]);
// Les badges de la série, chacun avec son logo : deux partagent le large, un
// porte le haut, un désigne un fichier que la carte ne porte pas, le
// dernier n'en a pas.
const CHEMINS_A4 = [LARGE, HAUT, LARGE, MANQUANT, null];
const avecLogos = (m, chemins) => ({ ...m, badges: m.badges.map((b, i) => ({ ...b, logo: chemins[i % chemins.length] })) });
const MODELE_A4_LOGOS = avecLogos(MODELE_A4, CHEMINS_A4);
const MODELE_LETTRE_LOGOS = avecLogos(MODELE_LETTRE, [HAUT, LARGE, null]);
const octetsA4Logos = await produirePlanche({ ...entrees(MODELE_A4_LOGOS, 'A4', 'feuille'), logosParticipants: LOGOS });
const octetsLettreLogos = await produirePlanche({ ...entrees(MODELE_LETTRE_LOGOS, 'Lettre', 'pile'), logosParticipants: LOGOS });
const A4_LOGOS = await lirePdf(octetsA4Logos);
const LETTRE_LOGOS = await lirePdf(octetsLettreLogos);
const CADRE_A6 = cadreUtile({ x: 0, y: 0, largeur: 105, hauteur: 148 });

// La page et la cellule de chaque badge d'une planche : la page 1 est la
// feuille de contrôle.
function places(n, papier, imposition) {
  const lesCellules = cellules(papier);
  const resultat = [];
  imposer(n, papier, imposition).forEach((planche, rang) => {
    planche.forEach((indice, k) => {
      if (indice !== null) resultat[indice] = { page: rang + 1, cellule: lesCellules[k] };
    });
  });
  return resultat;
}

// La boîte attendue du logo d'un badge sur sa page, en millimètres, y vers
// le bas, son origine et son axe : celle que la mise en page donne dans le
// cadre utile, portée dans la cellule — debout telle quelle, à plat tournée
// d'un quart de tour, le haut du badge à gauche.
function logoAttendu(badgeDuModele, cellule, rapport) {
  const { boite } = mettreEnPage(badgeDuModele.textes, metriques, 'a6', null, { rapport }).logoParticipant;
  const [bx, by] = [CADRE_A6.x + boite.x, CADRE_A6.y + boite.y];
  if (!cellule.aPlat) {
    return {
      x: cellule.x + bx,
      y: cellule.y + by,
      largeur: boite.largeur,
      hauteur: boite.hauteur,
      origine: [cellule.x + bx, cellule.y + by + boite.hauteur],
      axe: [1, 0],
    };
  }
  const bas = cellule.y + cellule.hauteur;
  return {
    x: cellule.x + by,
    y: bas - bx - boite.largeur,
    largeur: boite.hauteur,
    hauteur: boite.largeur,
    origine: [cellule.x + by + boite.hauteur, bas - bx],
    axe: [0, -1],
  };
}

describe('produirePlanche : le logo du participant (§ 11.4, § 11.5)', () => {
  test('une image par chemin distinct : trois badges peints de deux images, le badge au fichier manquant et celui sans logo n’en portent pas, la feuille de contrôle non plus', () => {
    assert.equal(A4_LOGOS.images, 2);
    assert.deepEqual(A4_LOGOS.pages.map((page) => page.images.length), [0, 3, 0]);
    assert.equal(LETTRE_LOGOS.images, 2);
    // En pile, les badges se répartissent sur les deux feuilles.
    const parPage = [0, 0, 0];
    places(3, 'Lettre', 'pile').forEach(({ page }, indice) => {
      if (MODELE_LETTRE_LOGOS.badges[indice].logo !== null) parPage[page] += 1;
    });
    assert.deepEqual(LETTRE_LOGOS.pages.map((page) => page.images.length), parPage);
  });

  test('chaque image tombe dans la boîte que la mise en page donne, à 0,01 mm, proportions gardées : debout sur A4, tournée avec le badge à plat sur Lettre, ni retournée ni décalée', () => {
    for (const [lu, m, papier, imposition] of [
      [A4_LOGOS, MODELE_A4_LOGOS, 'A4', 'feuille'],
      [LETTRE_LOGOS, MODELE_LETTRE_LOGOS, 'Lettre', 'pile'],
    ]) {
      const lesPlaces = places(m.badges.length, papier, imposition);
      const attendues = m.badges
        .map((b, indice) => ({ b, indice }))
        .filter(({ b }) => LOGOS.has(b.logo))
        .map(({ b, indice }) => ({ ...lesPlaces[indice], attendu: logoAttendu(b, lesPlaces[indice].cellule, RAPPORTS.get(b.logo)) }));
      for (const { page, cellule, attendu } of attendues) {
        const image = lu.pages[page].images.find((im) => dans([im.x + im.largeur / 2, im.y + im.hauteur / 2], cellule));
        assert.ok(image !== undefined, `${papier} : aucune image dans la cellule ${JSON.stringify(cellule)}`);
        for (const cle of ['x', 'y', 'largeur', 'hauteur']) assert.ok(Math.abs(image[cle] - attendu[cle]) < 0.01, `${papier} ${cle} : ${JSON.stringify(image)} contre ${JSON.stringify(attendu)}`);
        attendu.origine.forEach((v, k) => assert.ok(Math.abs(image.origine[k] - v) < 0.01, `${papier} origine : ${image.origine} contre ${attendu.origine}`));
        assert.deepEqual(image.axe.map((v) => Math.round(v * 1e6) / 1e6 + 0), attendu.axe, papier);
        // Dans le cadre utile de sa cellule, hors de la zone de silence.
        assert.ok(image.x >= cellule.x + ZONE - 0.01 && image.x + image.largeur <= cellule.x + cellule.largeur - ZONE + 0.01, papier);
        assert.ok(image.y >= cellule.y + ZONE - 0.01 && image.y + image.hauteur <= cellule.y + cellule.hauteur - ZONE + 0.01, papier);
      }
    }
  });

  test('aucun texte du badge sur l’image, filigrane excepté ; l’image se peint après le texte du badge et, sur le brouillon, avant le filigrane, qui la recouvre', () => {
    for (const lu of [A4_LOGOS, LETTRE_LOGOS]) {
      for (const page of lu.pages) {
        for (const image of page.images) {
          assert.equal(page.modesTexte[image.textesAvant - 1], 0, 'un texte plein avant l’image');
          if (lu === A4_LOGOS) assert.equal(page.modesTexte[image.textesAvant], 1, 'le filigrane, au trait, juste après');
          const recouvrants = page.textes.filter(
            (t) =>
              t.texte !== FILIGRANE &&
              t.x < image.x + image.largeur - 0.01 &&
              t.x + t.l > image.x + 0.01 &&
              t.y < image.y + image.hauteur - 0.01 &&
              t.y + t.h > image.y + 0.01,
          );
          assert.deepEqual(recouvrants.map(({ texte }) => texte), []);
        }
      }
    }
  });

  test('avec le pied TechnoLibre, le logo du participant se peint après celui de TechnoLibre, sans le recouvrir', async () => {
    const lu = await lirePdf(await produirePlanche({ ...avecPromotion(entreesAvery(avecLogos(MODELE_AVERY, [LARGE]))), logosParticipants: LOGOS }));
    const page = lu.pages[0];
    assert.ok(page.images.length >= 1);
    let suivies = 0;
    for (const image of page.images) {
      assert.equal(image.remplissagesAvant % 3, 0);
      const carte = cartes.find((c) => dans([image.x + image.largeur / 2, image.y + image.hauteur / 2], c));
      const fonds = page.zonesRemplies.filter((z, rang) => rang % 3 === 0 && dans([z.x + z.largeur / 2, z.y + z.hauteur / 2], carte));
      if (fonds.length === 0) continue;
      assert.equal(image.remplissagesAvant, page.zonesRemplies.indexOf(fonds[0]) + 3, 'le logo TechnoLibre de la carte, puis le sien');
      assert.ok(image.y + image.hauteur <= fonds[0].y + 0.01, JSON.stringify([image, fonds[0]]));
      suivies += 1;
    }
    assert.ok(suivies >= 1, 'aucune carte ne porte les deux logos');
  });

  test('sans logo désigné, ou avec une carte de logos que nul badge ne désigne, la planche d’avant, octet pour octet ; un logo sans place sur chaque badge ne l’embarque pas', async () => {
    assert.deepEqual(await produirePlanche({ ...entrees(MODELE_A4, 'A4', 'feuille'), logosParticipants: LOGOS }), octetsA4);
    assert.deepEqual(await produirePlanche({ ...entrees(avecLogos(MODELE_A4, [null]), 'A4', 'feuille'), logosParticipants: null }), octetsA4);
    // Un logo vingt fois plus large que haut n'atteint son plancher sur aucun
    // badge : ni image ni objet, et les octets de la planche sans logo.
    const etroit = new Map([[LARGE, pngUni(40, 2, [0, 0, 0])]]);
    const sansPlace = await produirePlanche({ ...entreesAvery(avecLogos(MODELE_AVERY, [LARGE])), logosParticipants: etroit });
    assert.deepEqual(sansPlace, octets);
    assert.deepEqual(await produirePlanche({ ...entrees(MODELE_A4_LOGOS, 'A4', 'feuille'), logosParticipants: LOGOS }), octetsA4Logos);
  });

  test('analyserPlanche compte les logos posés et ceux sans place ; un chemin que la carte ne porte pas n’est compté ni l’un ni l’autre', async () => {
    const analyse = await analyserPlanche({ modele: MODELE_A4_LOGOS, polices, logosParticipants: LOGOS });
    assert.deepEqual(analyse.logosParticipants, { poses: 3, sansPlace: 0 });
    const etroit = new Map([[LARGE, pngUni(40, 2, [0, 0, 0])]]);
    const avery = await analyserPlanche({ modele: avecLogos(MODELE_AVERY, [LARGE, null]), polices, modeleBadge: AVERY, logosParticipants: etroit });
    assert.deepEqual(avery.logosParticipants, { poses: 0, sansPlace: 4 });
  });

  test('analyserPlanche compte dans sansTechnolibre le pied TechnoLibre retiré pour laisser place au logo du participant', async () => {
    const m = avecLogos(
      modele(Array.from({ length: 16 }, (_, i) => badge(i + 1, NOMS_AVERY[i % NOMS_AVERY.length], { organisation: 'Club des Merles', tours: i + 1 }))),
      [LARGE],
    );
    const carre = new Map([[LARGE, pngUni(10, 10, [0, 0, 0])]]);
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const metriques = metriquesDe({ regulier: await pdf.embedFont(polices.regulier, { subset: true }), gras: await pdf.embedFont(polices.gras, { subset: true }) });
    const pages = m.badges.map((b) => mettreEnPage(b.textes, metriques, AVERY, { texte: TECHNOLIBRE.texte, rapport: 5 }, { rapport: 1 }));
    const retires = pages.filter((p) => p.technolibre.corps === null);
    assert.ok(retires.some((p) => p.logoParticipant.boite !== null), 'aucun pied retiré pour le logo');
    const analyse = await analyserPlanche({ modele: m, polices, modeleBadge: AVERY, technolibre: TECHNOLIBRE, logosParticipants: carre });
    assert.equal(analyse.sansTechnolibre, retires.length);
    assert.equal(analyse.logosParticipants.poses, pages.filter((p) => p.logoParticipant.boite !== null).length);
  });

  test('un PNG dont la structure tient mais que zlib refuse : le badge se produit sans logo, tel qu’il serait sans lui, sans lever', async () => {
    const corrompu = new Map([[LARGE, pngUni(4, 2, [0, 0, 0], [0x78, 0x9c, 0xff, 0xff, 0xff, 0xff])]]);
    const m = avecLogos(MODELE_A4, [LARGE]);
    assert.deepEqual(await produirePlanche({ ...entrees(m, 'A4', 'feuille'), logosParticipants: corrompu }), octetsA4);
  });

  test('une carte de logos mal formée lève TypeError : ni Map ni null, une clé qui n’est pas un chemin, des octets qui ne sont pas un PNG', async () => {
    const base = entrees(MODELE_A4_LOGOS, 'A4', 'feuille');
    for (const logosParticipants of [{}, new Map([[1, LOGOS.get(LARGE)]]), new Map([[LARGE, 'png']]), new Map([[LARGE, Uint8Array.of(1, 2, 3)]])]) {
      await assert.rejects(produirePlanche({ ...base, logosParticipants }), TypeError);
      await assert.rejects(analyserPlanche({ modele: MODELE_A4_LOGOS, polices, logosParticipants }), TypeError);
    }
  });
});
