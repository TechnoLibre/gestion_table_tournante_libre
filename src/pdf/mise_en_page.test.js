// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La mise en page du badge (§ 11.4, § 11.5), éprouvée sur deux jeux de
// métriques : celles de la police embarquée, lues par pdf-lib, et des
// métriques factices à chasse fixe dont chaque cote se calcule de tête.
// Chaque épreuve affirme ce que voit le porteur du carton : le nom jamais
// abrégé et toujours dans le cadre utile, l'ordre de sacrifice, une
// organisation sur une ligne, des tours jamais tronqués, aucun texte qui en
// chevauche un autre.
import assert from 'node:assert/strict';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { lirePolices } from '../../test/polices.js';
import { describe, test } from '../../test/lanceur.js';
import { constante } from '../geometrie/constantes.js';
import { BADGE, MODELES_BADGE } from '../geometrie/papiers.js';
import { LIBELLE_TABLE_MAX } from '../stockage/document.js';
import { cadreUtile } from './imposition.js';
import { mettreEnPage, metriquesDe } from './mise_en_page.js';

// Le point typographique en millimètres : une conversion d'unités.
const MM_PAR_PT = 25.4 / 72;
const CADRE = cadreUtile({ x: 0, y: 0, largeur: BADGE.largeur, hauteur: BADGE.hauteur });
const TOLERANCE = 1e-9;
const MARQUE = '\u{2026}';
const TIRET = '\u{2014}';

const polices = lirePolices();
const document = await PDFDocument.create();
document.registerFontkit(fontkit);
const regulierPdf = await document.embedFont(polices.regulier, { subset: true });
const grasPdf = await document.embedFont(polices.gras, { subset: true });
const NOTO = metriquesDe({ regulier: regulierPdf, gras: grasPdf });

// Chasse fixe : chaque point de code avance de `chasse` cadratin, sauf les
// capitales larges W, M, Æ et Œ, qui avancent du double — le glyphe le plus
// large de l'alphabet, sur lequel le corps du nom se cale (§ 11.5) — et les
// marques combinantes, qui avancent de `marque` fois la chasse (nulle, comme
// dans la police embarquée, ou non, comme dans une police qui les espace) ;
// un dixième de plus en gras. La capitale vaut `capitale` cadratin. Les
// glyphes au-delà de U+024F sont absents.
function metriquesFactices({ capitale = 0.7, chasse = 0.45, marque = 0 } = {}) {
  const avance = (c) => (/\p{M}/u.test(c) ? marque : 'WMÆŒ'.includes(c) ? 2 : 1);
  const avances = (texte) => [...texte].reduce((somme, c) => somme + avance(c), 0);
  return {
    largeur: (texte, corps, gras) => avances(texte) * chasse * (gras ? 1.1 : 1) * corps * MM_PAR_PT,
    hauteurs: (corps) => ({
      ascendante: 0.95 * corps * MM_PAR_PT,
      descendante: 0.25 * corps * MM_PAR_PT,
      capitale: capitale * corps * MM_PAR_PT,
    }),
    absents: (texte) => [...new Set([...texte].filter((c) => c.codePointAt(0) > 0x24f && !/\p{M}/u.test(c)))],
  };
}
const FACTICES = metriquesFactices();
const JEUX = [
  ['Noto Sans', NOTO],
  ['chasse fixe', FACTICES],
];

const EVENEMENT = 'Souper du Club des Merles';
const DATE = '9 octobre 2026';
const HORODATAGE = 'Placement du 2026-10-09 19:00:00';
const PIED = [`${EVENEMENT} ${TIRET} ${DATE}`, HORODATAGE];
const PIED_REDUIT = [DATE, HORODATAGE];
const tour = (r, table) => `Tour ${r} ${TIRET} table ${table}`;
const tours = (n) => Array.from({ length: n }, (_, i) => tour(i + 1, i + 3));

/** Les textes d'un badge, complétés des valeurs par défaut. */
const textes = (champs = {}) => ({
  nom: 'Iris Ombrelle',
  lignes: tours(4),
  organisation: 'Club des Merles',
  pied: PIED,
  piedReduit: PIED_REDUIT,
  ...champs,
});

const capParPt = (metriques) => metriques.hauteurs(1).capitale;
const corpsNomMax = (metriques) => constante('HAUTEUR_CAPITALE_NOM_MAX_MM') / capParPt(metriques);
const corpsNomPlancher = (metriques) => constante('HAUTEUR_CAPITALE_NOM_PLANCHER_MM') / capParPt(metriques);

// Des noms composés dont un mot, trait d'union compris, déborde la ligne aux
// grands corps : un repli à trois lignes coupé dans ce mot y tient, à un corps
// où le repli de mots entiers ne tient pas encore.
const NOMS_COMPOSES = [
  'Ondelie-Mauve Lacasse-Pervenche de la Grisaille',
  'Théa-Iris Lamontagne-Desrochers de Grandpré',
  'Iris Lacasse-Pervenche-Grisaille de Théo',
];

// Une ligne de tour faite de morceaux : des textes fixes, et des textes
// libres, { libre }, que la ligne abrège au plancher. Rend la ligne et les
// positions de ses textes libres, comme le modèle de la planche les donne.
function composee(...parts) {
  let ligne = '';
  const morceaux = [];
  for (const part of parts) {
    if (typeof part === 'string') {
      ligne += part;
      continue;
    }
    morceaux.push({ debut: ligne.length, fin: ligne.length + part.libre.length });
    ligne += part.libre;
  }
  return { ligne, morceaux };
}
// Une ligne sans texte libre.
const simple = (ligne) => ({ ligne, morceaux: [] });
// Une ligne titrée : la place, le séparateur, puis le titre, libre.
const titree = (place, titre) => composee(`${place} ${TIRET} `, { libre: titre });
// Une ligne au libellé de table : « Tour r — table t (libellé), siège s »,
// suivie du titre quand il est donné.
const auLibelle = (r, t, libelle, s, titre = null) =>
  composee(`Tour ${r} ${TIRET} table ${t} (`, { libre: libelle }, `), siège ${s}`, ...(titre === null ? [] : [` ${TIRET} `, { libre: titre }]));
// Les textes d'un badge aux lignes composées.
const textesComposes = (lignes, champs = {}) =>
  textes({ lignes: lignes.map(({ ligne }) => ligne), abregeables: lignes.map(({ morceaux }) => morceaux), ...champs });
// Un libellé de table au plus long que la saisie admet.
const LIBELLE_LONG = 'Verrière du jardin d’hiver, près des grandes baies, côté sud';

// Des lignes de tour sous sièges attribués, numérotées comme tours(n).
const toursAuxSieges = (n) => tours(n).map((ligne, i) => `${ligne}, siège ${i + 1}`);

const blocsNom = (page) => page.blocs.filter((b) => b.gras);
const textesDe = (page) => page.blocs.map((b) => b.texte);

// La boîte d'un bloc : sa largeur mesurée, de l'ascendante au-dessus de la
// ligne de base à la descendante au-dessous.
function boite(bloc, metriques) {
  const { ascendante, descendante } = metriques.hauteurs(bloc.corps);
  return {
    gauche: bloc.x,
    droite: bloc.x + metriques.largeur(bloc.texte, bloc.corps, bloc.gras),
    haut: bloc.y - ascendante,
    bas: bloc.y + descendante,
  };
}

/** Les blocs qui sortent du cadre utile, [] quand tout y tient. */
function horsDuCadre(page, metriques) {
  return page.blocs.filter((bloc) => {
    const b = boite(bloc, metriques);
    return (
      b.gauche < -TOLERANCE ||
      b.haut < -TOLERANCE ||
      b.droite > CADRE.largeur + TOLERANCE ||
      b.bas > CADRE.hauteur + TOLERANCE
    );
  });
}

/** Les paires de blocs dont les boîtes se recouvrent. */
function chevauchements(page, metriques) {
  const boites = page.blocs.map((bloc) => boite(bloc, metriques));
  const paires = [];
  for (let i = 0; i < boites.length; i += 1) {
    for (let j = i + 1; j < boites.length; j += 1) {
      const a = boites[i];
      const b = boites[j];
      const disjointes =
        a.droite <= b.gauche + TOLERANCE ||
        b.droite <= a.gauche + TOLERANCE ||
        a.bas <= b.haut + TOLERANCE ||
        b.bas <= a.haut + TOLERANCE;
      if (!disjointes) paires.push([page.blocs[i].texte, page.blocs[j].texte]);
    }
  }
  return paires;
}

// Vrai quand les lignes, rejointes chacune par une espace ou par rien,
// redonnent le texte : rien n'est retiré, ajouté ni abrégé.
function rejoint(lignes, texte) {
  let reste = texte;
  for (const [rang, ligne] of lignes.entries()) {
    if (rang > 0 && reste.startsWith(' ')) reste = reste.slice(1);
    if (!reste.startsWith(ligne)) return false;
    reste = reste.slice(ligne.length);
  }
  return reste === '';
}

const repete = (motif, longueur) => motif.repeat(Math.ceil(longueur / motif.length)).slice(0, longueur).trim();

describe('mise en page : les métriques de la police embarquée', () => {
  test('la largeur est celle de pdf-lib, convertie de points en millimètres, par graisse', () => {
    for (const texte of ['WWWWWWWWWWWW', 'Ôjgq Æ W', 'Iris Ombrelle']) {
      assert.equal(NOTO.largeur(texte, 20, false), regulierPdf.widthOfTextAtSize(texte, 20) * MM_PAR_PT);
      assert.equal(NOTO.largeur(texte, 20, true), grasPdf.widthOfTextAtSize(texte, 20) * MM_PAR_PT);
    }
    assert.ok(NOTO.largeur('WWWW', 20, true) > NOTO.largeur('WWWW', 20, false));
  });

  test('les hauteurs se lisent dans la police, proportionnelles au corps, la descendante positive', () => {
    const fonte = regulierPdf.embedder.font;
    const h = NOTO.hauteurs(10);
    assert.ok(Math.abs(h.capitale - (fonte.capHeight / fonte.unitsPerEm) * 10 * MM_PAR_PT) < 1e-12);
    assert.ok(Math.abs(h.ascendante - (fonte.ascent / fonte.unitsPerEm) * 10 * MM_PAR_PT) < 1e-12);
    assert.ok(Math.abs(h.descendante - (-fonte.descent / fonte.unitsPerEm) * 10 * MM_PAR_PT) < 1e-12);
    assert.ok(h.descendante > 0 && h.capitale < h.ascendante);
    assert.ok(Math.abs(NOTO.hauteurs(20).capitale - 2 * h.capitale) < 1e-12);
  });

  test('les absents : chaque caractère sans glyphe, une fois, dans l’ordre de première rencontre', () => {
    assert.deepEqual(NOTO.absents('Ôjgq Æ W — Benoît Œuvre fi e\u{301}'), []);
    assert.deepEqual(NOTO.absents('Iris \u{674E} Ombrelle \u{6731}\u{674E}'), ['\u{674E}', '\u{6731}']);
    assert.deepEqual(NOTO.absents('\u{1D49C}da'), ['\u{1D49C}']);
  });

  test('une police sans fontkit (police standard de pdf-lib) est refusée', async () => {
    const standard = await document.embedFont(StandardFonts.Helvetica);
    assert.throws(() => metriquesDe({ regulier: standard, gras: grasPdf }), TypeError);
    assert.throws(() => metriquesDe({ regulier: regulierPdf, gras: undefined }), TypeError);
  });
});

describe('mise en page : le nom (§ 11.4, § 11.5)', () => {
  for (const [jeu, metriques] of JEUX) {
    test(`${jeu} : un nom court tient sur une ligne en gras, au corps dont la capitale vaut le maximum, centré`, () => {
      const page = mettreEnPage(textes(), metriques);
      const [ligne, ...autres] = blocsNom(page);
      assert.deepEqual(autres, []);
      assert.equal(ligne.texte, 'Iris Ombrelle');
      assert.ok(Math.abs(ligne.corps - corpsNomMax(metriques)) < 1e-9);
      const largeur = metriques.largeur(ligne.texte, ligne.corps, true);
      assert.ok(Math.abs(ligne.x - (CADRE.largeur - largeur) / 2) < 1e-9);
      assert.deepEqual(horsDuCadre(page, metriques), []);
    });

    test(`${jeu} : « WWWWWWWWWWWW » et « ÆÆÆÆÆ » tiennent dans le cadre, le premier au corps réduit par paliers d’un point`, () => {
      for (const nom of ['WWWWWWWWWWWW', 'ÆÆÆÆÆ', 'ÆÆÆÆÆÆÆÆÆÆÆÆ']) {
        const page = mettreEnPage(textes({ nom }), metriques);
        assert.deepEqual(textesDe(page).slice(0, 1), [nom], nom);
        assert.deepEqual(horsDuCadre(page, metriques), [], nom);
        assert.deepEqual(chevauchements(page, metriques), [], nom);
      }
      const [w] = blocsNom(mettreEnPage(textes({ nom: 'WWWWWWWWWWWW' }), metriques));
      assert.ok(w.corps < corpsNomMax(metriques) && w.corps >= corpsNomPlancher(metriques));
      const paliers = corpsNomMax(metriques) - w.corps;
      assert.ok(Math.abs(paliers - Math.round(paliers)) < 1e-9, `paliers : ${paliers}`);
      // Un point de plus, et la ligne déborderait : le corps est le plus grand qui tient.
      assert.ok(metriques.largeur('WWWWWWWWWWWW', w.corps + 1, true) > CADRE.largeur);
    });

    test(`${jeu} : le corps se réduit jusqu’au plancher avant que le nom ne se replie`, () => {
      // Un nom qui tient au plancher sur une ligne n'en prend jamais deux.
      const nom = 'Ondine Lacasse-Pervenche';
      assert.ok(metriques.largeur(nom, corpsNomPlancher(metriques), true) <= CADRE.largeur);
      assert.ok(metriques.largeur(nom, corpsNomMax(metriques), true) > CADRE.largeur);
      assert.equal(blocsNom(mettreEnPage(textes({ nom }), metriques)).length, 1);
    });

    test(`${jeu} : un nom de 200 caractères se replie, jamais abrégé ; les lignes rejointes redonnent le nom`, () => {
      const nom = repete('Iris Ombrelle-Pervenche ', 200);
      const page = mettreEnPage(textes({ nom }), metriques);
      const lignes = blocsNom(page).map((b) => b.texte);
      assert.ok(lignes.length > 3, `lignes : ${lignes.length}`);
      assert.ok(rejoint(lignes, nom), JSON.stringify(lignes));
      assert.ok(lignes.every((l) => !l.includes(MARQUE) && l === l.trim()));
      assert.ok(blocsNom(page).every((b) => Math.abs(b.corps - corpsNomPlancher(metriques)) < 1e-9));
      assert.deepEqual(horsDuCadre(page, metriques), []);
      assert.deepEqual(chevauchements(page, metriques), []);
    });

    test(`${jeu} : un nom de 2 000 caractères est refusé, PLANCHE_NOM_TROP_LONG`, () => {
      const nom = repete('Iris Ombrelle-Pervenche ', 2000);
      assert.deepEqual(mettreEnPage(textes({ nom }), metriques), {
        refus: { code: 'PLANCHE_NOM_TROP_LONG', details: {} },
      });
    });

    test(`${jeu} : sans espace, le nom se coupe entre deux points de code, jamais avant une marque combinante`, () => {
      const nom = 'Pe\u{301}'.repeat(60);
      const page = mettreEnPage(textes({ nom }), metriques);
      const lignes = blocsNom(page).map((b) => b.texte);
      assert.ok(lignes.length >= 2);
      assert.ok(rejoint(lignes, nom));
      assert.ok(lignes.every((l) => !/^\p{M}/u.test(l)), JSON.stringify(lignes.map((l) => l.slice(0, 3))));
      assert.deepEqual(horsDuCadre(page, metriques), []);
    });

    test(`${jeu} : un nom de plusieurs mots se coupe aux espaces, chaque ligne faite de mots entiers`, () => {
      const nom = 'Ondine Lacasse Théo Pervenche Iris Ombrelle Grisaille';
      const lignes = blocsNom(mettreEnPage(textes({ nom }), metriques)).map((b) => b.texte);
      assert.ok(lignes.length >= 2);
      const mots = new Set(nom.split(' '));
      assert.ok(lignes.every((l) => l.split(' ').every((m) => mots.has(m))), JSON.stringify(lignes));
      assert.equal(lignes.join(' '), nom);
    });

    test(`${jeu} : la coupe dans un mot ne vient qu’à défaut ; un repli de mots entiers à un corps plus petit passe avant`, () => {
      for (const nom of NOMS_COMPOSES) {
        const lignes = blocsNom(mettreEnPage(textes({ nom }), metriques)).map((b) => b.texte);
        // Rejointes par une espace, des lignes coupées aux espaces redonnent le
        // nom ; une coupe dans un mot y ajouterait une espace.
        assert.ok(lignes.length >= 2 && lignes.length <= 3, JSON.stringify(lignes));
        assert.equal(lignes.join(' '), nom, JSON.stringify(lignes));
      }
    });
  }

  test('une marque combinante qui avance reste sur la ligne de sa lettre, même quand elle la ferait déborder', () => {
    // Sous la police embarquée, une marque combinante n'avance pas : elle ne
    // fait jamais déborder une ligne, et la coupe ne tombe devant elle que si
    // le repli la sépare de sa lettre. Une marque qui avance éprouve la coupe
    // elle-même.
    const metriques = metriquesFactices({ marque: 1 });
    const nom = 'Pe\u{301}'.repeat(60);
    const lignes = blocsNom(mettreEnPage(textes({ nom }), metriques)).map((b) => b.texte);
    assert.ok(lignes.length >= 2);
    assert.ok(rejoint(lignes, nom));
    assert.ok(lignes.every((l) => !/^\p{M}/u.test(l)), JSON.stringify(lignes.map((l) => l.slice(0, 3))));
  });

  test('le plancher et le départ se calculent de la hauteur de capitale lue dans les métriques', () => {
    // Cent caractères dépassent trois lignes sous les deux capitales, et
    // tiennent au plancher ; deux cents tiennent sous Noto Sans.
    const moyen = repete('Iris Ombrelle-Pervenche ', 100);
    const long = repete('Iris Ombrelle-Pervenche ', 200);
    for (const capitale of [0.7, 0.5]) {
      const metriques = metriquesFactices({ capitale });
      const court = blocsNom(mettreEnPage(textes({ nom: 'Iris' }), metriques))[0].corps;
      assert.ok(Math.abs(court - constante('HAUTEUR_CAPITALE_NOM_MAX_MM') / (capitale * MM_PAR_PT)) < 1e-9);
      const replie = blocsNom(mettreEnPage(textes({ nom: moyen }), metriques))[0].corps;
      assert.ok(Math.abs(replie - constante('HAUTEUR_CAPITALE_NOM_PLANCHER_MM') / (capitale * MM_PAR_PT)) < 1e-9);
    }
    // Sur Noto Sans, la capitale du corps plancher vaut le plancher du registre.
    const [ligne] = blocsNom(mettreEnPage(textes({ nom: long }), NOTO));
    assert.ok(Math.abs(NOTO.hauteurs(ligne.corps).capitale - constante('HAUTEUR_CAPITALE_NOM_PLANCHER_MM')) < 1e-9);
  });
});

describe('mise en page : l’ordre de sacrifice (§ 11.5, décision 8)', () => {
  for (const [jeu, metriques] of JEUX) {
    test(`${jeu} : au-delà de trois lignes, le nom de l’événement part d’abord, puis l’organisation ; date et horodatage restent`, () => {
      const vus = { complet: 0, sansEvenement: 0, sansOrganisation: 0, refus: 0 };
      for (let longueur = 10; longueur <= 600; longueur += 10) {
        const nom = repete('Iris Ombrelle-Pervenche ', longueur);
        const page = mettreEnPage(textes({ nom, lignes: tours(5) }), metriques);
        if ('refus' in page) {
          assert.equal(page.refus.code, 'PLANCHE_NOM_TROP_LONG', `${longueur}`);
          vus.refus += 1;
          continue;
        }
        const tout = textesDe(page);
        const evenement = tout.some((t) => t.includes(EVENEMENT));
        const organisation = tout.includes('Club des Merles');
        assert.ok(tout.includes(HORODATAGE), `horodatage, ${longueur}`);
        assert.ok(tout.some((t) => t.includes(DATE)), `date, ${longueur}`);
        assert.equal(tours(5).filter((t) => tout.includes(t)).length, 5, `tours, ${longueur}`);
        // L'organisation ne part jamais avant le nom de l'événement.
        assert.ok(evenement ? organisation : true, `ordre, ${longueur}`);
        // Rien ne part tant que le nom tient en trois lignes.
        if (blocsNom(page).length <= 3) assert.ok(evenement && organisation, `trois lignes, ${longueur}`);
        else assert.ok(!evenement, `au-delà de trois lignes, ${longueur}`);
        if (evenement) vus.complet += 1;
        else if (organisation) vus.sansEvenement += 1;
        else vus.sansOrganisation += 1;
        assert.deepEqual(horsDuCadre(page, metriques), [], `${longueur}`);
        assert.deepEqual(chevauchements(page, metriques), [], `${longueur}`);
      }
      for (const [cas, nombre] of Object.entries(vus)) assert.ok(nombre > 0, `${cas} : ${JSON.stringify(vus)}`);
    });

    test(`${jeu} : sous un nom de trois lignes au plus, le nom descend jusqu’au plancher avant que rien ne parte`, () => {
      // Un nom d'événement long occupe plusieurs lignes du pied : son départ
      // libère de quoi poser une ligne de tour de plus.
      const pied = [`${repete('Grand souper annuel du Club des Merles et de la Grisaille ', 160)} ${TIRET} ${DATE}`, HORODATAGE];
      const vus = { descendu: 0, sansEvenement: 0, sansOrganisation: 0, refus: 0 };
      for (const nom of NOMS_COMPOSES) {
        const depart = blocsNom(mettreEnPage(textes({ nom }), metriques))[0].corps;
        let precedent = { corps: depart, refus: false };
        for (let n = 12; n <= 30; n += 1) {
          const lignes = toursAuxSieges(n);
          const cas = `${nom}, ${n} tours`;
          const page = mettreEnPage(textes({ nom, lignes, pied }), metriques);
          if ('refus' in page) {
            assert.deepEqual(page.refus, { code: 'PLANCHE_TROP_DE_TOURS', details: { tours: n } }, cas);
            vus.refus += 1;
            precedent = { corps: precedent.corps, refus: true };
            continue;
          }
          assert.ok(!precedent.refus, `${cas} : accepté après un refus`);
          const tout = textesDe(page);
          const evenement = tout.some((t) => t.startsWith('Grand souper'));
          const organisation = tout.includes('Club des Merles');
          const nomBlocs = blocsNom(page);
          const corps = nomBlocs[0].corps;
          const auPlancher = Math.abs(corps - corpsNomPlancher(metriques)) < 1e-9;
          assert.ok(nomBlocs.length <= 3, `${cas} : ${nomBlocs.length} lignes de nom`);
          assert.ok(lignes.every((l) => tout.includes(l)), `${cas} : tours`);
          assert.ok(tout.join(' ').includes(DATE) && tout.includes(HORODATAGE), `${cas} : date, horodatage`);
          // Plus de tours, jamais un nom plus grand.
          assert.ok(corps <= precedent.corps + 1e-9, `${cas} : ${corps} après ${precedent.corps}`);
          // Un texte ne part que sous le nom au plancher, l'événement d'abord.
          assert.ok(evenement || auPlancher, `${cas} : l’événement part sous un nom de ${corps} pt`);
          assert.ok(organisation || !evenement, `${cas} : l’organisation part avant l’événement`);
          if (evenement && corps < depart - 1e-9 && !auPlancher) vus.descendu += 1;
          // Un nom qui partait au-dessus du plancher y est descendu avant que
          // l'événement ne parte.
          if (!evenement && depart > corpsNomPlancher(metriques) + 1e-9) {
            vus[organisation ? 'sansEvenement' : 'sansOrganisation'] += 1;
          }
          assert.deepEqual(horsDuCadre(page, metriques), [], cas);
          assert.deepEqual(chevauchements(page, metriques), [], cas);
          precedent = { corps, refus: false };
        }
      }
      for (const [cas, nombre] of Object.entries(vus)) assert.ok(nombre > 0, `${cas} : ${JSON.stringify(vus)}`);
    });
  }
});

describe('mise en page : l’organisation (§ 11.5)', () => {
  for (const [jeu, metriques] of JEUX) {
    test(`${jeu} : 200 caractères tiennent sur une ligne finie par « … », au plus long préfixe qui tient`, () => {
      const organisation = repete('Club des Merles et de la Grisaille ', 200);
      const page = mettreEnPage(textes({ organisation }), metriques);
      const blocs = page.blocs.filter((b) => b.texte.endsWith(MARQUE));
      assert.equal(blocs.length, 1);
      const [bloc] = blocs;
      assert.equal(bloc.corps, constante('CORPS_ORGANISATION_PT'));
      assert.equal(bloc.gras, false);
      const prefixe = bloc.texte.slice(0, -MARQUE.length);
      assert.ok(prefixe.length > 0 && organisation.startsWith(prefixe) && prefixe === prefixe.trimEnd());
      assert.ok(metriques.largeur(bloc.texte, bloc.corps, false) <= CADRE.largeur);
      // Le préfixe suivant, espaces finales retirées, déborderait.
      let fin = prefixe.length + 1;
      while (organisation.slice(0, fin).trimEnd() === prefixe) fin += 1;
      const suivant = organisation.slice(0, fin).trimEnd();
      assert.ok(metriques.largeur(`${suivant}${MARQUE}`, bloc.corps, false) > CADRE.largeur, suivant);
      assert.deepEqual(horsDuCadre(page, metriques), []);
    });

    test(`${jeu} : sans organisation, aucun bloc, et les tours remontent de la hauteur de sa ligne`, () => {
      const avec = mettreEnPage(textes(), metriques);
      const sans = mettreEnPage(textes({ organisation: null }), metriques);
      assert.equal(sans.blocs.length, avec.blocs.length - 1);
      assert.ok(!textesDe(sans).includes('Club des Merles'));
      const premierTour = (page) => page.blocs.find((b) => b.texte === tour(1, 3));
      const { ascendante, descendante } = metriques.hauteurs(constante('CORPS_ORGANISATION_PT'));
      assert.ok(Math.abs(premierTour(avec).y - premierTour(sans).y - (ascendante + descendante)) < 1e-9);
      assert.ok(textesDe(sans).every((t) => t !== TIRET && t.trim() !== ''));
    });
  }
  test('le plus long préfixe qui tient avec la marque est gardé, même quand le caractère suivant, large, déborde', () => {
    // Sous la chasse fixe, le préfixe tient avec la marque, et la capitale
    // large qui le suit fait déborder le préfixe seul : la recherche du plus
    // long préfixe ne s'arrête pas un caractère trop tôt.
    const corps = constante('CORPS_ORGANISATION_PT');
    const prefixe = 'Grisaille Grisaille Grisaille Grisaille Ondin';
    assert.ok(FACTICES.largeur(`${prefixe}${MARQUE}`, corps, false) <= CADRE.largeur);
    assert.ok(FACTICES.largeur(`${prefixe}W`, corps, false) > CADRE.largeur);
    const page = mettreEnPage(textes({ organisation: `${prefixe}WWW du Club` }), FACTICES);
    assert.ok(textesDe(page).includes(`${prefixe}${MARQUE}`), JSON.stringify(textesDe(page)));
  });
});

describe('mise en page : les lignes de tour (§ 11.5)', () => {
  for (const [jeu, metriques] of JEUX) {
    test(`${jeu} : de 2 à 6 tours sur une colonne, chaque ligne entière, dans l’ordre`, () => {
      for (let n = 2; n <= 6; n += 1) {
        const page = mettreEnPage(textes({ lignes: tours(n) }), metriques);
        assert.equal(page.colonnesTours, 1, `${n}`);
        const lignes = page.blocs.filter((b) => b.texte.startsWith('Tour '));
        assert.deepEqual(lignes.map((b) => b.texte), tours(n));
        assert.ok(lignes.every((b) => b.corps === constante('CORPS_TOURS_PT') && b.x === lignes[0].x));
        assert.ok(lignes.every((b, i) => i === 0 || b.y > lignes[i - 1].y));
      }
    });

    test(`${jeu} : douze tours tiennent sur une colonne sous un nom court, sur deux sous un nom qui prend la place`, () => {
      // Le passage à deux colonnes se mesure sur le gabarit, pas sur un
      // nombre de tours : sous un nom d'une ligne, douze tours tiennent au
      // corps des tours.
      const court = mettreEnPage(textes({ lignes: tours(12) }), metriques);
      assert.equal(court.colonnesTours, 1);
      assert.ok(court.blocs.filter((b) => b.texte.startsWith('Tour ')).every((b) => b.corps === constante('CORPS_TOURS_PT')));

      // Le premier nom, par longueurs croissantes, qui renvoie les douze
      // tours sur deux colonnes.
      let page = null;
      for (let longueur = 10; longueur <= 600 && page === null; longueur += 10) {
        const essai = mettreEnPage(textes({ nom: repete('Iris Ombrelle-Pervenche ', longueur), lignes: tours(12) }), metriques);
        if (!('refus' in essai) && essai.colonnesTours === 2) page = essai;
      }
      assert.notEqual(page, null);
      const lignes = page.blocs.filter((b) => b.texte.startsWith('Tour '));
      assert.deepEqual(lignes.map((b) => b.texte), tours(12));
      // Colonne de gauche : les six premiers, de haut en bas ; puis la droite,
      // rangée par rangée à la même ligne de base.
      assert.ok(lignes.slice(0, 6).every((b) => b.x === lignes[0].x));
      assert.ok(lignes.slice(6).every((b) => b.x === lignes[6].x && b.x > lignes[0].x));
      assert.ok(lignes.slice(6).every((b, i) => b.y === lignes[i].y));
      assert.ok(lignes.slice(1, 6).every((b, i) => b.y > lignes[i].y));
      assert.deepEqual(horsDuCadre(page, metriques), []);
      assert.deepEqual(chevauchements(page, metriques), []);
      // Une colonne au corps plancher n'y tenait pas : entre le haut du
      // premier tour et le haut du pied, douze lignes au plancher débordent.
      const corps = lignes[0].corps;
      const { ascendante, descendante } = metriques.hauteurs(constante('CORPS_TOURS_PLANCHER_PT'));
      const hautTours = lignes[0].y - metriques.hauteurs(corps).ascendante;
      const premierPied = page.blocs.find((b) => b.corps === constante('CORPS_PIED_PT') && !b.texte.startsWith('Tour '));
      const hautPied = premierPied.y - metriques.hauteurs(constante('CORPS_PIED_PT')).ascendante;
      assert.ok(hautTours + 12 * (ascendante + descendante) > hautPied);
    });

    test(`${jeu} : avant deux colonnes, le corps des tours descend jusqu’au plancher`, () => {
      const nom = 'Ondine Lacasse Théo Pervenche Iris Ombrelle Grisaille Merles';
      const resultats = [];
      for (let n = 1; n <= 30; n += 1) {
        const page = mettreEnPage(textes({ nom, lignes: tours(n) }), metriques);
        if ('refus' in page) break;
        const corps = page.blocs.find((b) => b.texte === tour(1, 3)).corps;
        resultats.push({ n, colonnes: page.colonnesTours, corps });
      }
      const premiereDouble = resultats.find((r) => r.colonnes === 2);
      assert.ok(premiereDouble !== undefined);
      const derniereSimple = resultats.filter((r) => r.colonnes === 1).at(-1);
      assert.equal(derniereSimple.n, premiereDouble.n - 1);
      assert.equal(derniereSimple.corps, constante('CORPS_TOURS_PLANCHER_PT'));
      assert.ok(resultats.some((r) => r.colonnes === 1 && r.corps < constante('CORPS_TOURS_PT') && r.corps > constante('CORPS_TOURS_PLANCHER_PT')));
    });

    test(`${jeu} : cent tours sont refusés, PLANCHE_TROP_DE_TOURS nomme cent`, () => {
      assert.deepEqual(mettreEnPage(textes({ lignes: tours(100) }), metriques), {
        refus: { code: 'PLANCHE_TROP_DE_TOURS', details: { tours: 100 } },
      });
    });

    test(`${jeu} : une ligne trop large pour la colonne s’abrège à la fin, au corps plancher ; les autres restent entières`, () => {
      const titre = titree(tour(2, 5), repete('Animatrice de la table d’honneur ', 120));
      const page = mettreEnPage(textesComposes([simple(tour(1, 3)), titre, simple(tour(3, 7))]), metriques);
      assert.equal(page.colonnesTours, 1);
      const blocs = page.blocs.filter((b) => b.texte.startsWith('Tour '));
      assert.equal(blocs.length, 3);
      assert.equal(blocs[0].texte, tour(1, 3));
      assert.equal(blocs[2].texte, tour(3, 7));
      assert.ok(blocs[1].texte.endsWith(MARQUE) && blocs[1].texte.startsWith(tour(2, 5)));
      assert.ok(blocs.every((b) => b.corps === constante('CORPS_TOURS_PLANCHER_PT')));
      assert.deepEqual(horsDuCadre(page, metriques), []);
    });

    test(`${jeu} : à deux colonnes, au corps plancher, un titre trop large pour sa colonne s’abrège ; table et siège restent`, () => {
      // Le premier nombre de tours que ce nom renvoie sur deux colonnes ; la
      // première ligne y reçoit un titre plus large qu'une demi-colonne.
      const nom = 'Ondine Lacasse Théo Pervenche Iris Ombrelle Grisaille Merles';
      let n = 1;
      while (n < 60 && mettreEnPage(textes({ nom, lignes: tours(n) }), metriques).colonnesTours !== 2) n += 1;
      assert.ok(n < 60);
      const composees = tours(n).map(simple);
      composees[0] = titree(tour(1, 3), repete('Animatrice de la table d’honneur ', 60));
      const lignes = composees.map(({ ligne }) => ligne);
      const page = mettreEnPage(textesComposes(composees, { nom }), metriques);
      assert.equal(page.colonnesTours, 2, `${n} : ${JSON.stringify(page.refus)}`);
      const blocs = page.blocs.filter((b) => b.texte.startsWith('Tour '));
      assert.equal(blocs.length, n);
      const [titre, ...autres] = blocs;
      assert.ok(titre.texte.endsWith(MARQUE) && titre.texte.startsWith(tour(1, 3)), titre.texte);
      assert.ok(lignes[0].startsWith(titre.texte.slice(0, -MARQUE.length)), titre.texte);
      // La colonne de droite, étroite, laisse au titre plus d'une demi-colonne.
      const plancher = constante('CORPS_TOURS_PLANCHER_PT');
      const demi = (CADRE.largeur - plancher * MM_PAR_PT) / 2;
      assert.ok(metriques.largeur(titre.texte, plancher, false) > demi, titre.texte);
      assert.deepEqual(autres.map((b) => b.texte), lignes.slice(1));
      assert.ok(blocs.every((b) => b.corps === constante('CORPS_TOURS_PLANCHER_PT')));
      assert.deepEqual(horsDuCadre(page, metriques), []);
      assert.deepEqual(chevauchements(page, metriques), []);
    });

    test(`${jeu} : une ligne sans titre ne s’abrège jamais, à une colonne comme à deux ; le badge est refusé plutôt`, () => {
      // Une colonne : une table dont le numéro déborde le cadre au plancher,
      // sans titre, puis suivie d'un titre.
      const large = tour(1, '9'.repeat(80));
      assert.ok(metriques.largeur(large, constante('CORPS_TOURS_PLANCHER_PT'), false) > CADRE.largeur);
      for (const ligne of [simple(large), titree(large, 'Animatrice')]) {
        assert.deepEqual(mettreEnPage(textesComposes([ligne]), metriques), {
          refus: { code: 'PLANCHE_TROP_DE_TOURS', details: { tours: 1 } },
        });
      }
      // Deux colonnes : des lignes aux sièges plus larges qu'une demi-colonne,
      // la première titrée. Quelle que soit la disposition retenue, chaque
      // ligne sans titre paraît entière, et la titrée garde sa place.
      const nom = 'Ondine Lacasse Théo Pervenche Iris Ombrelle Grisaille Merles';
      const lignes = Array.from({ length: 20 }, (_, i) => `${tour(i + 1, i + 30)}, siège ${i + 10}`);
      const demi = (CADRE.largeur - constante('CORPS_TOURS_PLANCHER_PT') * MM_PAR_PT) / 2;
      assert.ok(lignes.slice(-10).every((l) => metriques.largeur(l, constante('CORPS_TOURS_PLANCHER_PT'), false) > demi));
      const place = lignes[0];
      const composees = lignes.map(simple);
      composees[0] = titree(place, 'Animatrice de la table d’honneur');
      const page = mettreEnPage(textesComposes(composees, { nom }), metriques);
      if ('refus' in page) {
        assert.equal(page.refus.code, 'PLANCHE_TROP_DE_TOURS');
        return;
      }
      const tout = textesDe(page);
      assert.ok(lignes.slice(1).every((l) => tout.includes(l)), JSON.stringify(tout.filter((t) => t.endsWith(MARQUE))));
      assert.ok(tout.some((t) => t.startsWith(place)));
    });
  }

  for (const [jeu, metriques] of JEUX) {
    for (const modele of ['a6', 'avery5392']) {
      const plancher = constante('CORPS_TOURS_PLANCHER_PT');
      const { largeur: L } = cadreUtile({ x: 0, y: 0, ...(modele === 'a6' ? BADGE : MODELES_BADGE.avery5392) }, modele);
      const blocTour = (page, debut) => page.blocs.find((b) => b.texte.startsWith(debut));

      test(`${jeu}, ${modele} : un libellé de ${LIBELLE_TABLE_MAX} caractères s’abrège au plancher, entre ses parenthèses ; numéro, siège et titre restent entiers`, () => {
        assert.equal([...LIBELLE_LONG].length, LIBELLE_TABLE_MAX);
        const longue = auLibelle(1, 13, LIBELLE_LONG, 8, 'animation');
        assert.ok(metriques.largeur(longue.ligne, plancher, false) > L, 'la ligne entière déborde au plancher');
        const page = mettreEnPage(textesComposes([longue, simple(tour(2, 5)), simple(tour(3, 7))]), metriques, modele);
        assert.ok(!('refus' in page), JSON.stringify(page));
        const bloc = blocTour(page, `Tour 1 ${TIRET} table 13 (`);
        assert.equal(bloc.corps, plancher);
        const [, libelle] = /^Tour 1 — table 13 \((.*)\), siège 8 — animation$/u.exec(bloc.texte) ?? [];
        assert.ok(libelle !== undefined && libelle.endsWith(MARQUE), bloc.texte);
        assert.ok(LIBELLE_LONG.startsWith(libelle.slice(0, -MARQUE.length)) && libelle.length > MARQUE.length, bloc.texte);
        // Le plus long préfixe qui tient : une grappe de plus déborde.
        const garde = libelle.slice(0, -MARQUE.length);
        const plus = LIBELLE_LONG.slice(0, garde.length + 1).trimEnd();
        if (plus.length > garde.length) {
          assert.ok(metriques.largeur(`Tour 1 ${TIRET} table 13 (${plus}${MARQUE}), siège 8 ${TIRET} animation`, plancher, false) > L);
        }
        assert.ok([tour(2, 5), tour(3, 7)].every((t) => textesDe(page).includes(t)));
        assert.deepEqual(chevauchements(page, metriques), []);
        assert.ok(page.blocs.every((b) => b.x >= -TOLERANCE && b.x + metriques.largeur(b.texte, b.corps, b.gras) <= L + TOLERANCE));
      });

      test(`${jeu}, ${modele} : le libellé s’abrège avant le titre ; le titre ne s’abrège que le libellé réduit à sa première grappe`, () => {
        const titre = repete('Animatrice de la table d’honneur ', 80);
        const page = mettreEnPage(textesComposes([auLibelle(1, 13, LIBELLE_LONG, 8, titre)]), metriques, modele);
        assert.ok(!('refus' in page), JSON.stringify(page));
        const bloc = blocTour(page, 'Tour 1');
        assert.ok(bloc.texte.startsWith(`Tour 1 ${TIRET} table 13 (V${MARQUE}), siège 8 ${TIRET} A`), bloc.texte);
        assert.ok(bloc.texte.endsWith(MARQUE), bloc.texte);
        // Un titre court reste entier, le libellé seul abrégé.
        const court = mettreEnPage(textesComposes([auLibelle(1, 13, LIBELLE_LONG, 8, 'animation')]), metriques, modele);
        assert.match(blocTour(court, 'Tour 1').texte, /…\), siège 8 — animation$/u);
      });

      test(`${jeu}, ${modele} : au-dessus du plancher, un libellé ne s’abrège pas ; une ligne qui tient entière n’est pas touchée`, () => {
        const court = auLibelle(1, 13, 'Terrasse', 8, 'animation');
        const page = mettreEnPage(textesComposes([court]), metriques, modele);
        const bloc = blocTour(page, 'Tour 1');
        assert.equal(bloc.texte, court.ligne);
        assert.ok(metriques.largeur(court.ligne, bloc.corps, false) <= L + TOLERANCE);
      });
    }

    test(`${jeu} : des morceaux mal formés lèvent TypeError`, () => {
      const ligne = tour(1, 3);
      for (const abregeables of [[], [[{ debut: 0, fin: 99 }]], [[{ debut: 2, fin: 2 }]], [[{ debut: 0, fin: 3 }, { debut: 2, fin: 5 }]], [null], [[{ debut: -1, fin: 2 }]]]) {
        assert.throws(() => mettreEnPage(textes({ lignes: [ligne], abregeables }), metriques), TypeError, JSON.stringify(abregeables));
      }
    });
  }

  test('un titre abrégé garde au moins une grappe : sa place suivie du séparateur et de la marque seuls ne passent pas pour un titre', () => {
    // Sous la chasse fixe, la place, le séparateur et la marque tiennent au
    // corps plancher, mais pas une grappe de titre de plus : le titre ne
    // peut pas s'abréger, et la ligne ne se rend pas réduite à sa place.
    const plancher = constante('CORPS_TOURS_PLANCHER_PT');
    let chiffres = 1;
    const place = () => tour(1, '9'.repeat(chiffres));
    while (
      chiffres < 400 &&
      !(FACTICES.largeur(`${place()} ${TIRET}${MARQUE}`, plancher, false) <= CADRE.largeur &&
        FACTICES.largeur(`${place()} ${TIRET} A${MARQUE}`, plancher, false) > CADRE.largeur)
    ) chiffres += 1;
    assert.ok(chiffres < 400);
    const page = mettreEnPage(textesComposes([titree(place(), 'Animatrice')]), FACTICES);
    if ('refus' in page) return;
    const abregees = textesDe(page).filter((t) => t.startsWith('Tour ') && t.endsWith(MARQUE));
    assert.ok(
      abregees.every((t) => t.slice(0, -MARQUE.length).trimEnd().length > `${place()} ${TIRET}`.length),
      JSON.stringify(abregees),
    );
  });

  test('Noto Sans : la plus large ligne sans titre tient entière sur une colonne au corps plancher', () => {
    // L'abrègement d'une ligne en colonne unique ne mange alors que le titre.
    const ligne = `Toute la soirée ${TIRET} table 9999, siège 9999`;
    assert.ok(NOTO.largeur(ligne, constante('CORPS_TOURS_PLANCHER_PT'), false) <= CADRE.largeur);
  });
});

describe('mise en page : le pied (§ 11.4)', () => {
  for (const [jeu, metriques] of JEUX) {
    test(`${jeu} : le pied s’ancre au bas du cadre, au corps du pied, chaque ligne présente`, () => {
      const page = mettreEnPage(textes(), metriques);
      const pied = page.blocs.slice(-2);
      assert.deepEqual(pied.map((b) => b.texte), PIED);
      assert.ok(pied.every((b) => b.corps === constante('CORPS_PIED_PT') && !b.gras));
      const { descendante } = metriques.hauteurs(constante('CORPS_PIED_PT'));
      assert.ok(Math.abs(pied[1].y + descendante - CADRE.hauteur) < 1e-9);
    });

    test(`${jeu} : un nom d’événement très long se replie dans le pied sans perdre la date`, () => {
      const evenement = repete('Grand souper annuel du Club des Merles ', 200);
      const pied = [`${evenement} ${TIRET} ${DATE}`, HORODATAGE];
      const page = mettreEnPage(textes({ pied }), metriques);
      const lignes = page.blocs.filter((b) => b.corps === constante('CORPS_PIED_PT')).map((b) => b.texte);
      assert.ok(lignes.length > 2);
      assert.ok(rejoint(lignes.slice(0, -1), pied[0]));
      assert.equal(lignes.at(-1), HORODATAGE);
      assert.deepEqual(horsDuCadre(page, metriques), []);
      assert.deepEqual(chevauchements(page, metriques), []);
    });
  }
});

describe('mise en page : le corps du nom plafonne les autres corps (§ 11.4)', () => {
  test('sous une grande capitale, le nom au plancher plafonne le corps des tours, de l’organisation et du pied', () => {
    // Capitale de 1,2 cadratin : le plancher du nom tombe sous le corps
    // plancher des tours et sous celui de l'organisation.
    const metriques = metriquesFactices({ capitale: 1.2 });
    const plancher = corpsNomPlancher(metriques);
    assert.ok(plancher < constante('CORPS_TOURS_PLANCHER_PT') && plancher < constante('CORPS_ORGANISATION_PT'), `${plancher}`);
    const nom = repete('Iris Ombrelle-Pervenche ', 150);
    for (const n of [4, 12]) {
      const page = mettreEnPage(textes({ nom, lignes: tours(n) }), metriques);
      const nomBlocs = blocsNom(page);
      assert.ok(Math.abs(nomBlocs[0].corps - plancher) < 1e-9, `${n} : ${nomBlocs[0].corps}`);
      const autres = page.blocs.filter((b) => !b.gras);
      assert.ok(autres.some((b) => b.texte === tour(1, 3)) && autres.some((b) => b.texte === 'Club des Merles'), `${n}`);
      assert.ok(autres.every((b) => b.corps <= plancher + 1e-9), JSON.stringify(autres.map((b) => [b.texte, b.corps])));
      assert.deepEqual(horsDuCadre(page, metriques), [], `${n}`);
      assert.deepEqual(chevauchements(page, metriques), [], `${n}`);
    }
  });
});

describe('mise en page : propriétés sur des noms engendrés', () => {
  // Une boucle écrite à la main sur des cas tirés d'une graine (§ 14.12 : la
  // bibliothèque de propriétés ne sert qu'aux endroits que le spec nomme).
  // L'alphabet latin étendu : capitales et minuscules, Latin-1, Latin étendu
  // A, quelques marques combinantes, l'espace, le trait d'union,
  // l'apostrophe ; douze lettres pour une marque et trois séparateurs.
  const LATIN = [
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    ...Array.from({ length: 0xff - 0xc0 + 1 }, (_, i) => String.fromCodePoint(0xc0 + i)).filter((c) => !'×÷'.includes(c)),
    ...Array.from({ length: 0x17f - 0x100 + 1 }, (_, i) => String.fromCodePoint(0x100 + i)),
  ];
  const MARQUES = ['\u{300}', '\u{301}', '\u{308}', '\u{327}'];
  const SEPARATEURS = [' ', '-', '\u{2019}'];

  // Un générateur congruentiel de Park et Miller : la même graine rend la
  // même suite de cas, d'une machine à l'autre.
  function tirage(graine) {
    let etat = graine;
    const suivant = () => {
      etat = (etat * 48271) % 2147483647;
      return etat / 2147483647;
    };
    const entier = (min, max) => min + Math.floor(suivant() * (max - min + 1));
    const parmi = (liste) => liste[entier(0, liste.length - 1)];
    const caractere = () => {
      const de = entier(1, 16);
      return de <= 12 ? parmi(LATIN) : de === 13 ? parmi(MARQUES) : parmi(SEPARATEURS);
    };
    const texte = (maxLength) => {
      for (;;) {
        const t = Array.from({ length: entier(1, maxLength) }, caractere).join('');
        if (t.trim() !== '') return t;
      }
    };
    return () => ({
      nom: texte(suivant() < 0.5 ? 30 : 260),
      organisation: suivant() < 0.25 ? null : texte(120),
      tours: entier(1, 30),
      sieges: suivant() < 0.5,
    });
  }
  const GRAINE = 4242;
  // Chaque texte nouveau coûte une mise en forme fontkit sous Noto Sans : la
  // série surveillée lui accorde moins de tirages qu'aux métriques factices.
  const TIRAGES = new Map([
    [NOTO, 100],
    [FACTICES, 300],
  ]);

  for (const [jeu, metriques] of JEUX) {
    test(`${jeu} : tout bloc dans le cadre, aucun chevauchement, le nom au plus grand corps, rien de perdu`, () => {
      const bilan = { acceptes: 0, auDela: 0, deuxColonnes: 0, abregees: 0, refus: 0 };
      const tirer = tirage(GRAINE);
      for (let rang = 0; rang < TIRAGES.get(metriques); rang += 1) {
        const { nom, organisation, tours: n, sieges } = tirer();
        const cas = JSON.stringify({ rang, nom, organisation, tours: n, sieges });
        const nomPropre = nom.trim().replace(/ +/g, ' ');
        const lignes = Array.from({ length: n }, (_, i) => `${tour(i + 1, i + 2)}${sieges ? `, siège ${i + 1}` : ''}`);
        const page = mettreEnPage(textes({ nom: nomPropre, organisation, lignes }), metriques);
        if ('refus' in page) {
          bilan.refus += 1;
          assert.ok(['PLANCHE_TROP_DE_TOURS', 'PLANCHE_NOM_TROP_LONG'].includes(page.refus.code), cas);
          if (page.refus.code === 'PLANCHE_TROP_DE_TOURS') assert.deepEqual(page.refus.details, { tours: n }, cas);
          continue;
        }
        bilan.acceptes += 1;
        assert.deepEqual(horsDuCadre(page, metriques), [], cas);
        assert.deepEqual(chevauchements(page, metriques), [], cas);
        const nomBlocs = blocsNom(page);
        assert.ok(rejoint(nomBlocs.map((b) => b.texte), nomPropre), cas);
        const corpsNom = nomBlocs[0].corps;
        assert.ok(page.blocs.every((b) => b.corps <= corpsNom), cas);
        assert.ok(nomBlocs.every((b) => b.corps === corpsNom), cas);
        // Aucune ligne de tour ne manque ni ne s'abrège.
        const tout = textesDe(page);
        assert.ok(lignes.every((l) => tout.includes(l)), cas);
        assert.ok(tout.includes(HORODATAGE), cas);
        if (nomBlocs.length > 3) bilan.auDela += 1;
        if (page.colonnesTours === 2) bilan.deuxColonnes += 1;
        if (tout.some((t) => t.endsWith(MARQUE))) bilan.abregees += 1;
      }
      // Un tirage qui n'atteint pas les cas difficiles rend la propriété
      // vraie sans rien éprouver : chaque famille a son plancher.
      assert.ok(bilan.acceptes >= (TIRAGES.get(metriques) * 2) / 3, JSON.stringify(bilan));
      assert.ok(bilan.auDela >= 10, JSON.stringify(bilan));
      assert.ok(bilan.deuxColonnes >= 10, JSON.stringify(bilan));
      assert.ok(bilan.abregees >= 10, JSON.stringify(bilan));
    });
  }
});

// La carte Avery 5392 (§ 11.2, § 11.5) : 101,6 × 76,2 à plat, son cadre
// utile en retrait de ZONE_SILENCE_CARTE_MM, ses corps propres, les mêmes
// planchers de lisibilité que l'A6.
describe('mise en page : la carte Avery 5392', () => {
  const AVERY = 'avery5392';
  const CARTE = cadreUtile({ x: 0, y: 0, ...MODELES_BADGE[AVERY] }, AVERY);
  const sortDeLaCarte = (page, metriques) =>
    page.blocs.filter((bloc) => {
      const b = boite(bloc, metriques);
      return b.gauche < -TOLERANCE || b.haut < -TOLERANCE || b.droite > CARTE.largeur + TOLERANCE || b.bas > CARTE.hauteur + TOLERANCE;
    });
  const corpsNomMaxCarte = (metriques) => constante('HAUTEUR_CAPITALE_NOM_MAX_CARTE_MM') / capParPt(metriques);
  // Quatre tours titrés sous sièges attribués, le cas le plus large que la
  // spécification promet de tenir.
  const titres = (n) => Array.from({ length: n }, (_, i) => `${tour(i + 1, i + 10)}, siège ${i + 5} ${TIRET} animation`);
  const LIGNE_TYPE = `Toute la soirée ${TIRET} table 13 ${TIRET} animation`;

  test('le cadre utile d’une carte mesure 91,6 × 66,2 mm', () => {
    assert.ok(Math.abs(CARTE.largeur - 91.6) < 1e-9 && Math.abs(CARTE.hauteur - 66.2) < 1e-9, JSON.stringify(CARTE));
  });

  for (const [jeu, metriques] of JEUX) {
    test(`${jeu} : un nom court au corps maximal de la carte, sur une ligne, tout dans le cadre, rien ne se chevauche`, () => {
      const page = mettreEnPage(textes(), metriques, AVERY);
      const nom = blocsNom(page);
      assert.equal(nom.length, 1);
      assert.ok(Math.abs(nom[0].corps - corpsNomMaxCarte(metriques)) < 1e-9, String(nom[0].corps));
      assert.deepEqual(sortDeLaCarte(page, metriques), []);
      assert.deepEqual(chevauchements(page, metriques), []);
    });

    test(`${jeu} : rien ne dépasse les corps de la carte — tours, organisation, pied`, () => {
      const page = mettreEnPage(textes(), metriques, AVERY);
      const corpsDe = (texte) => page.blocs.find((b) => b.texte === texte).corps;
      assert.equal(corpsDe(tour(1, 3)), constante('CORPS_TOURS_CARTE_PT'));
      assert.equal(corpsDe('Club des Merles'), constante('CORPS_ORGANISATION_CARTE_PT'));
      assert.equal(corpsDe(HORODATAGE), constante('CORPS_PIED_CARTE_PT'));
    });
  }

  test('Noto Sans : un nom qui ne tient sur une ligne à aucun corps se replie sur deux, au plus grand corps qui y tient ; quatre tours titrés, l’organisation et le pied entier tiennent avec lui', () => {
    const nom = 'Ondine-Théa Lacasse-Pervenche de la Grisaille';
    const plancher = constante('HAUTEUR_CAPITALE_NOM_PLANCHER_MM') / capParPt(NOTO);
    assert.ok(NOTO.largeur(nom, plancher, true) > CARTE.largeur, 'le nom ne tient sur une ligne à aucun corps');
    const lignes = titres(4);
    const page = mettreEnPage(textes({ nom, lignes }), NOTO, AVERY);
    assert.ok(!('refus' in page), JSON.stringify(page));
    const blocs = blocsNom(page);
    assert.equal(blocs.length, 2);
    assert.ok(rejoint(blocs.map((b) => b.texte), nom));
    // Le plus grand corps qui tient sur deux lignes : un point de plus déborde.
    const corps = blocs[0].corps;
    if (corps < corpsNomMaxCarte(NOTO) - 1e-9) {
      assert.ok(NOTO.largeur(nom, corps + 1, true) > 2 * CARTE.largeur || blocs.some((b) => NOTO.largeur(b.texte, corps + 1, true) > CARTE.largeur));
    }
    const tout = textesDe(page);
    assert.ok(lignes.every((l) => tout.includes(l)), JSON.stringify(tout));
    assert.ok(tout.includes('Club des Merles') && PIED.every((ligne) => tout.includes(ligne)), JSON.stringify(tout));
    assert.equal(page.colonnesTours, 1);
    assert.deepEqual(sortDeLaCarte(page, NOTO), []);
    assert.deepEqual(chevauchements(page, NOTO), []);
  });

  test('Noto Sans : quatre tours titrés sous un nom d’une ligne au corps maximal tiennent au corps des tours de la carte', () => {
    const lignes = titres(4);
    const page = mettreEnPage(textes({ lignes }), NOTO, AVERY);
    const blocs = blocsNom(page);
    assert.ok(blocs.length === 1 && Math.abs(blocs[0].corps - corpsNomMaxCarte(NOTO)) < 1e-9);
    const blocsTours = page.blocs.filter((b) => lignes.includes(b.texte));
    assert.equal(blocsTours.length, 4);
    assert.ok(blocsTours.every((b) => b.corps === constante('CORPS_TOURS_CARTE_PT')));
    assert.ok(textesDe(page).includes(PIED[0]));
    assert.deepEqual(sortDeLaCarte(page, NOTO), []);
  });

  test('Noto Sans : la ligne type « Toute la soirée — table 13 — animation » tient entière sur une ligne au plancher des tours', () => {
    const plancher = constante('CORPS_TOURS_PLANCHER_PT');
    assert.ok(NOTO.largeur(LIGNE_TYPE, plancher, false) <= CARTE.largeur);
    // Huit lignes poussent les tours au plancher, en une colonne.
    const lignes = [LIGNE_TYPE, ...tours(7)];
    const page = mettreEnPage(textes({ lignes }), NOTO, AVERY);
    const ligne = page.blocs.find((b) => b.texte.startsWith('Toute la soirée'));
    assert.deepEqual([ligne.texte, ligne.corps, page.colonnesTours], [LIGNE_TYPE, plancher, 1]);
    assert.deepEqual(sortDeLaCarte(page, NOTO), []);
    assert.deepEqual(chevauchements(page, NOTO), []);
  });

  test('Noto Sans : le refus des tours tombe à son seuil sur la carte — 20 tours tiennent sur deux colonnes, 21 sont refusés', () => {
    const page = mettreEnPage(textes({ lignes: tours(20) }), NOTO, AVERY);
    assert.ok(!('refus' in page), 'vingt tours');
    assert.equal(page.colonnesTours, 2);
    assert.ok(tours(20).every((l) => textesDe(page).includes(l)));
    assert.deepEqual(sortDeLaCarte(page, NOTO), []);
    assert.deepEqual(chevauchements(page, NOTO), []);
    assert.deepEqual(mettreEnPage(textes({ lignes: tours(21) }), NOTO, AVERY), {
      refus: { code: 'PLANCHE_TROP_DE_TOURS', details: { tours: 21 } },
    });
  });

  test('l’A6 reste le modèle quand aucun n’est donné, et un modèle inconnu lève TypeError', () => {
    for (const [, metriques] of JEUX) {
      assert.deepEqual(mettreEnPage(textes(), metriques, 'a6'), mettreEnPage(textes(), metriques));
    }
    assert.throws(() => mettreEnPage(textes(), NOTO, 'A6'), TypeError);
  });
});

// Le pied TechnoLibre (§ 11.4, § 11.5) : un texte et le logo sous le pied,
// sur la place que le reste du badge laisse. Le reste du badge ne cède rien :
// le pied TechnoLibre rapetisse de son corps de départ à son plancher, puis
// se retire, et le badge est alors celui qu'il serait sans lui.
describe('mise en page : le pied TechnoLibre', () => {
  const PROMOTION = 'Demander un développement logiciel personnalisé avec https://technolibre.ca pour votre entreprise';
  const TECHNOLIBRE = Object.freeze({ texte: PROMOTION, rapport: 5 });
  const DEPART = constante('CORPS_TECHNOLIBRE_PT');
  const PLANCHER = constante('CORPS_TECHNOLIBRE_PLANCHER_PT');
  const MODELES = [
    ['A6', 'a6', CADRE],
    ['Avery 5392', 'avery5392', cadreUtile({ x: 0, y: 0, ...MODELES_BADGE.avery5392 }, 'avery5392')],
  ];
  const hauteurLogo = (corps) => 2 * corps * MM_PAR_PT;
  // Les blocs du texte TechnoLibre : ceux qui ne sont ni du badge sans lui.
  const blocsTechnolibre = (avec, sans) => avec.blocs.slice(sans.blocs.length);
  // La hauteur du bloc TechnoLibre au corps donné : ses lignes, puis le logo.
  const hauteurBloc = (metriques, corps, lignes) => {
    const { ascendante, descendante } = metriques.hauteurs(corps);
    return lignes * (ascendante + descendante) + hauteurLogo(corps);
  };
  // L'écart libre d'un badge sans pied TechnoLibre : du bas des tours au
  // haut du pied.
  function ecartLibre(page, metriques, pied) {
    const boites = page.blocs.map((bloc) => ({ bloc, ...boite(bloc, metriques) }));
    const hautDuPied = Math.min(...boites.filter(({ bloc }) => pied.includes(bloc.texte)).map(({ haut }) => haut));
    const basDuReste = Math.max(...boites.filter(({ bloc }) => !pied.includes(bloc.texte)).map(({ bas }) => bas));
    return hautDuPied - basDuReste;
  }

  for (const [nomModele, modele, cadre] of MODELES) {
    for (const [jeu, metriques] of JEUX) {
      test(`${nomModele}, ${jeu} : sous un badge ordinaire, le texte au corps de départ puis le logo, centrés, posés sur le bas du cadre, sans rien chevaucher`, () => {
        const sans = mettreEnPage(textes(), metriques, modele);
        const avec = mettreEnPage(textes(), metriques, modele, TECHNOLIBRE);
        assert.equal(sans.technolibre, null);
        assert.equal(avec.technolibre.corps, DEPART);
        const lignes = blocsTechnolibre(avec, sans);
        assert.ok(lignes.length >= 1 && rejoint(lignes.map((b) => b.texte), PROMOTION), JSON.stringify(lignes));
        assert.ok(lignes.every((b) => b.corps === DEPART && !b.gras));
        for (const b of lignes) assert.ok(Math.abs(b.x - (cadre.largeur - metriques.largeur(b.texte, DEPART, false)) / 2) < TOLERANCE);
        const { logo } = avec.technolibre;
        assert.ok(Math.abs(logo.hauteur - hauteurLogo(DEPART)) < TOLERANCE);
        assert.ok(Math.abs(logo.largeur - 5 * logo.hauteur) < TOLERANCE);
        assert.ok(Math.abs(logo.x - (cadre.largeur - logo.largeur) / 2) < TOLERANCE);
        assert.ok(Math.abs(logo.y + logo.hauteur - cadre.hauteur) < TOLERANCE);
        // Le logo sous la dernière ligne du texte, la dernière ligne sous le
        // pied.
        assert.ok(boite(lignes.at(-1), metriques).bas <= logo.y + TOLERANCE);
        const boites = avec.blocs.map((b) => boite(b, metriques));
        assert.ok(boites.every((b) => b.droite <= cadre.largeur + TOLERANCE && b.bas <= cadre.hauteur + TOLERANCE && b.gauche >= -TOLERANCE));
        assert.ok(boites.every((b) => b.bas <= logo.y + TOLERANCE), 'aucun texte ne descend sur le logo');
        assert.deepEqual(chevauchements(avec, metriques), []);
      });

      test(`${nomModele}, ${jeu} : un logo trop large pour le cadre au corps de départ rapetisse jusqu'à tenir en largeur, puis se retire`, () => {
        const tientEnLargeur = (corps, rapport) => hauteurLogo(corps) * rapport <= cadre.largeur + TOLERANCE;
        const large = mettreEnPage(textes(), metriques, modele, { texte: PROMOTION, rapport: 30 });
        const { corps, logo } = large.technolibre;
        assert.ok(corps !== null && corps < DEPART && corps >= PLANCHER, JSON.stringify(large.technolibre));
        assert.ok(tientEnLargeur(corps, 30) && !tientEnLargeur(corps + 1, 30));
        assert.ok(logo.x >= -TOLERANCE && logo.x + logo.largeur <= cadre.largeur + TOLERANCE);
        assert.ok(!tientEnLargeur(PLANCHER, 60));
        const trop = mettreEnPage(textes(), metriques, modele, { texte: PROMOTION, rapport: 60 });
        assert.deepEqual(trop.technolibre, { corps: null, logo: null });
      });

      test(`${nomModele}, ${jeu} : le reste du badge ne cède rien — nom, organisation, tours et colonnes identiques, le pied remonté de la hauteur du bloc`, () => {
        const cas = [
          textes(),
          textes({ nom: 'Ondine-Théa Lacasse-Pervenche de la Grisaille', lignes: toursAuxSieges(4) }),
          textes({ lignes: tours(9) }),
          textes({ organisation: null, lignes: tours(2) }),
        ];
        for (const champs of cas) {
          const sans = mettreEnPage(champs, metriques, modele);
          const avec = mettreEnPage(champs, metriques, modele, TECHNOLIBRE);
          const pied = sans.blocs.filter((b) => PIED.includes(b.texte) || PIED_REDUIT.includes(b.texte));
          const haut = sans.blocs.slice(0, sans.blocs.length - pied.length);
          assert.deepEqual(avec.blocs.slice(0, haut.length), haut, champs.nom);
          assert.equal(avec.colonnesTours, sans.colonnesTours);
          const piedAvec = avec.blocs.slice(haut.length, haut.length + pied.length);
          if (avec.technolibre.corps === null) {
            assert.deepEqual(avec.blocs, sans.blocs);
            continue;
          }
          const decalage = pied[0].y - piedAvec[0].y;
          assert.ok(decalage > 0);
          pied.forEach((b, rang) => {
            assert.deepEqual({ ...piedAvec[rang], y: 0 }, { ...b, y: 0 });
            assert.ok(Math.abs(b.y - piedAvec[rang].y - decalage) < TOLERANCE);
          });
          const lignes = blocsTechnolibre(avec, sans).length;
          assert.ok(Math.abs(decalage - hauteurBloc(metriques, avec.technolibre.corps, lignes)) < 1e-6);
        }
      });
    }

    test(`${nomModele}, Noto Sans : à mesure que les tours s’ajoutent, le pied TechnoLibre rapetisse jusqu’à son plancher, puis se retire ; chaque fois, la place libre le décide`, () => {
      const vus = new Set();
      for (let n = 1; n <= 24; n += 1) {
        const champs = textes({ lignes: toursAuxSieges(n) });
        const sans = mettreEnPage(champs, NOTO, modele);
        if ('refus' in sans) {
          assert.deepEqual(mettreEnPage(champs, NOTO, modele, TECHNOLIBRE), sans, `${n} tours`);
          continue;
        }
        const avec = mettreEnPage(champs, NOTO, modele, TECHNOLIBRE);
        const { corps } = avec.technolibre;
        const pied = sans.blocs.filter((b) => PIED.includes(b.texte) || PIED_REDUIT.includes(b.texte)).map((b) => b.texte);
        const libre = ecartLibre(sans, NOTO, pied);
        // Le nombre de lignes du texte TechnoLibre à un corps : ses mots
        // remplis ligne après ligne dans la largeur du cadre.
        const lignesA = (c) => {
          let lignes = 1;
          let courante = '';
          for (const mot of PROMOTION.split(' ')) {
            const avec = courante === '' ? mot : `${courante} ${mot}`;
            if (NOTO.largeur(avec, c, false) <= cadre.largeur + TOLERANCE) courante = avec;
            else [lignes, courante] = [lignes + 1, mot];
          }
          return lignes;
        };
        if (corps === null) {
          vus.add('retire');
          assert.deepEqual(avec.blocs, sans.blocs, `${n} tours`);
          assert.equal(avec.technolibre.logo, null);
          // Même au plancher, le bloc dépasse la place libre : une ligne au
          // moins, et le logo.
          assert.ok(libre < hauteurBloc(NOTO, PLANCHER, 1) + 1e-9, `${n} tours : ${libre}`);
        } else {
          vus.add(corps === DEPART ? 'depart' : 'reduit');
          assert.ok(corps >= PLANCHER && corps <= DEPART, `${n} tours : ${corps}`);
          const lignes = blocsTechnolibre(avec, sans).length;
          assert.ok(hauteurBloc(NOTO, corps, lignes) <= libre + 1e-9, `${n} tours`);
          if (corps < DEPART) {
            // Un point de plus ne tenait pas.
            assert.ok(hauteurBloc(NOTO, corps + 1, lignesA(corps + 1)) > libre - 1e-9, `${n} tours`);
            assert.equal(lignes, lignesA(corps), `${n} tours`);
          }
        }
      }
      assert.deepEqual([...vus].sort(), ['depart', 'reduit', 'retire']);
    });
  }

  // Le nom de l'événement passe avant le pied TechnoLibre dans l'ordre de
  // sacrifice (§ 11.5) : un badge qui l'a perdu, et à plus forte raison
  // l'organisation, ne porte pas le pied TechnoLibre, quelle que soit la
  // place que le dépouillement a libérée. Le badge sort tel qu'il serait
  // sans lui, et le retrait se compte.
  const MOTS_LARGES = 'WWWWWWWWWW MMMMMMMMMM WWWWWWWWWW MMMMMMMMM WWWWWWW';
  const PIED_COURT = [`Souper ${TIRET} ${DATE}`, HORODATAGE];
  const auSiege12 = (n) => tours(n).map((ligne) => `${ligne}, siège 12`);
  // Le nom de l'événement est sur la page : seul le pied complet porte
  // « Souper », replié ou non.
  const avecEvenement = (page) => page.blocs.some((b) => b.texte.includes('Souper'));
  const retire = (sans) => ({ ...sans, technolibre: { corps: null, logo: null } });

  test('un badge qui a perdu le nom de l’événement ne porte pas le pied TechnoLibre, même quand la place le tiendrait : nom de trois lignes sous vingt tours, nom au-delà de trois lignes', () => {
    const cas = [
      ['a6', textes({ nom: 'Ondine-Théa Lacasse-Pervenche de la Grisaille', pied: PIED_COURT, lignes: auSiege12(20) })],
      ...[1, 2, 3].flatMap((n) => MODELES.map(([, modele]) => [modele, textes({ nom: MOTS_LARGES, organisation: null, lignes: tours(n) })])),
    ];
    for (const [modele, champs] of cas) {
      const sans = mettreEnPage(champs, NOTO, modele);
      assert.ok(!('refus' in sans) && !avecEvenement(sans), `${modele} : ${champs.nom}, ${champs.lignes.length} tours`);
      assert.deepEqual(mettreEnPage(champs, NOTO, modele, TECHNOLIBRE), retire(sans), `${modele} : ${champs.nom}, ${champs.lignes.length} tours`);
    }
  });

  test('sur toute une gamme de badges, des deux modèles et des deux jeux de métriques, le pied TechnoLibre ne paraît que sur un badge qui garde le nom de l’événement', () => {
    const noms = ['Iris Ombrelle', 'Ondine-Théa Lacasse-Pervenche de la Grisaille', NOMS_COMPOSES[0], MOTS_LARGES];
    for (const [, modele] of MODELES) {
      for (const [jeu, metriques] of JEUX) {
        let depouilles = 0;
        for (const nom of noms) {
          for (const organisation of ['Club des Merles', null]) {
            for (const pied of [PIED, PIED_COURT]) {
              for (let n = 1; n <= 24; n += 1) {
                const champs = textes({ nom, organisation, pied, lignes: auSiege12(n) });
                const sans = mettreEnPage(champs, metriques, modele);
                if ('refus' in sans) continue;
                const avec = mettreEnPage(champs, metriques, modele, TECHNOLIBRE);
                const quoi = `${modele}, ${jeu} : ${nom}, ${organisation}, ${n} tours`;
                if (avecEvenement(sans)) {
                  assert.ok(avec.technolibre.corps === null || avecEvenement(avec), quoi);
                  continue;
                }
                depouilles += 1;
                assert.deepEqual(avec, retire(sans), quoi);
              }
            }
          }
        }
        assert.ok(depouilles > 0, `${modele}, ${jeu} : aucun badge dépouillé dans la gamme`);
      }
    }
  });

  test('sans pied TechnoLibre, la page est celle d’avant ; un refus reste le même refus', () => {
    for (const [, modele] of MODELES) {
      assert.deepEqual(mettreEnPage(textes(), NOTO, modele, null), mettreEnPage(textes(), NOTO, modele));
      assert.deepEqual(mettreEnPage(textes({ lignes: tours(100) }), NOTO, modele, TECHNOLIBRE), {
        refus: { code: 'PLANCHE_TROP_DE_TOURS', details: { tours: 100 } },
      });
    }
  });

  test('un pied TechnoLibre mal formé lève TypeError : texte vide ou absent, rapport du logo qui n’est pas un nombre positif fini', () => {
    for (const faute of [{ texte: '', rapport: 5 }, { texte: '   ', rapport: 5 }, { rapport: 5 }, { texte: PROMOTION, rapport: 0 }, { texte: PROMOTION, rapport: Infinity }, { texte: PROMOTION }, 'texte']) {
      assert.throws(() => mettreEnPage(textes(), NOTO, 'a6', faute), TypeError, JSON.stringify(faute));
    }
  });

  test('le même badge, deux fois, rend la même page', () => {
    assert.deepEqual(mettreEnPage(textes(), NOTO, 'avery5392', TECHNOLIBRE), mettreEnPage(textes(), NOTO, 'avery5392', TECHNOLIBRE));
  });
});

describe('mise en page : le pied TechnoLibre, la mesure que la spécification cite (§ 11.5)', () => {
  const TECHNOLIBRE = Object.freeze({
    texte: 'Demander un développement logiciel personnalisé avec https://technolibre.ca pour votre entreprise',
    rapport: 5,
  });
  test('Noto Sans, un nom d’une ligne et son organisation, des tours sans siège ni titre : le corps de départ tient jusqu’à cinq tours sur la carte et treize sur l’A6, pas au-delà', () => {
    for (const [modele, dernier] of [
      ['avery5392', 5],
      ['a6', 13],
    ]) {
      const corps = (n) => mettreEnPage(textes({ lignes: tours(n) }), NOTO, modele, TECHNOLIBRE).technolibre.corps;
      for (let n = 1; n <= dernier; n += 1) assert.equal(corps(n), 6, `${modele}, ${n} tours`);
      assert.notEqual(corps(dernier + 1), 6, `${modele}, ${dernier + 1} tours`);
    }
  });
});
