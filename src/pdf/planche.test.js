// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

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
// comme la séance les passera.
import assert from 'node:assert/strict';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFName } from 'pdf-lib';
import { lirePdf } from '../../test/pdf.js';
import { lirePolices } from '../../test/polices.js';
import { describe, test } from '../../test/lanceur.js';
import { libelle } from '../application/libelles.js';
import { textesControle } from '../application/planche.js';
import { constante } from '../geometrie/constantes.js';
import { PAPIERS } from '../geometrie/papiers.js';
import { VERSION } from '../version.genere.js';
import { cellules, filets, imposer, nombrePlanches } from './imposition.js';
import { metriquesDe } from './mise_en_page.js';
import { analyserPlanche, produirePlanche } from './planche.js';

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
function badge(participant, nom, { appartenance = null, tours = 2, horodatage = HORODATAGE, evenement = EVENEMENT, absentes = [] } = {}) {
  const lignes = Array.from({ length: tours }, (_, i) =>
    absentes.includes(i + 1)
      ? { tour: i + 1, table: null, siege: null, titre: null, absente: true }
      : { tour: i + 1, table: participant + i, siege: null, titre: null, absente: false },
  );
  const ligneHorodatage = horodatage === null ? libelle('planche.pied.horodatageInconnu') : libelle('planche.pied.horodatage', { horodatage });
  return {
    participant,
    nom,
    appartenance,
    lignes,
    identifiant: null,
    textes: {
      nom,
      lignes: lignes.map((ligne) => libelle('planche.tour', ligne)),
      appartenance,
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
  NOMS_A4.map((nom, i) => badge(i + 1, nom, { appartenance: i % 2 === 0 ? 'Club des Merles' : null })),
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

  test('chaque texte du badge se lit dans la couche de texte : nom, appartenance, tours, pied', () => {
    const page = A4.pages[1];
    const lus = new Set(page.textes.map(({ texte }) => texte));
    const [premier] = MODELE_A4.badges;
    for (const texte of [premier.textes.nom, premier.textes.appartenance, ...premier.textes.lignes, ...premier.textes.pied]) {
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
    assert.deepEqual(await analyserPlanche({ modele: m, polices }), { refus: null, absents: ['李'] });
  });

  test('un badge à 100 tours : refus PLANCHE_TROP_DE_TOURS, et son rang dans le modèle', async () => {
    const m = modele([badge(1, 'Iris Ombrelle'), badge(2, 'Théo Pervenche', { tours: 100 }), badge(3, 'Ondine Lacasse', { tours: 100 })]);
    assert.deepEqual(await analyserPlanche({ modele: m, polices }), {
      refus: { code: 'PLANCHE_TROP_DE_TOURS', details: { tours: 100 }, rang: 1 },
      absents: [],
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
