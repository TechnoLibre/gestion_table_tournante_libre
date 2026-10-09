// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du manifeste des captures et de ses contrôles sous node (§ 19.3,
// § 19.5, § 19.7) : la liste déclarée des captures, l'empreinte d'étape, la
// forme canonique, l'appariement documentation, manifeste et disque, l'ordre
// contre les étapes du § 2.1, l'en-tête PNG, l'écart de version, les chemins
// hors de la racine neutre et la garde qui refuse un manifeste nommant sa
// machine. Les données viennent de test/fixtures/captures/ : deux images
// minimales de 1 366 × 700, une de 2 × 3, un guide et un manifeste inventés.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test } from '../../test/lanceur.js';
import { versionVoisine } from '../../test/version_voisine.js';
import { VERSION } from '../../src/version.genere.js';
import {
  A_VENIR,
  CAPTURES,
  CHEMIN_MANIFESTE,
  ETAPES,
  REPORTEES,
  canoniser,
  cheminImage,
  cheminsHorsRacine,
  ecartDeVersion,
  empreinteEtape,
  fautesDImage,
  fautesDeMachine,
  imagesReferencees,
  lireEntetePng,
  verifierAppariement,
  verifierOrdre,
} from './manifeste.js';

const FIXTURES = fileURLToPath(new URL('../../test/fixtures/captures/', import.meta.url));
const lire = (chemin) => readFileSync(FIXTURES + chemin);

// Racine neutre inventée : elle n'existe nulle part ailleurs dans le dépôt.
const RACINE = 'C:\\Racine\\Tablees';

const IMAGE_01 = 'doc/captures/01-premier-ecran.png';
const IMAGE_02 = 'doc/captures/02-import-apercu.png';

// Le manifeste de fixture, lu à neuf à chaque appel. Il ne porte pas la
// version réelle, qu'aucune donnée n'écrit en clair (§ 18.5, point 6) :
// chaque capture reçoit ici celle de la construction.
function manifesteFixture() {
  const manifeste = JSON.parse(lire('manifeste.json').toString('utf8'));
  for (const capture of manifeste.captures) capture.versionReelle = VERSION.affichee;
  return manifeste;
}

function captureFixture(rang = 0) {
  return manifesteFixture().captures[rang];
}

function referencesFixture() {
  return [{ document: 'guide.md', images: imagesReferencees(lire('guide.md').toString('utf8')) }];
}

// Un manifeste dont seules les entrées comptent pour l'ordre : chaque capture
// déclarée, sauf celles qu'on écarte, et chaque reportée.
function manifesteDeclare({ sans = [], reportees = REPORTEES } = {}) {
  return {
    format: 1,
    captures: CAPTURES.filter((c) => !sans.includes(c.fichier)).map((c) => ({ fichier: c.fichier, etape: c.etape })),
    reportees: reportees.map((r) => ({ ...r })),
  };
}

const sha256 = (octets) => createHash('sha256').update(octets).digest('hex');
const fautesDe = (fautes, motif) => fautes.filter((f) => motif.test(f.faute));

describe('manifeste : la liste déclarée (§ 19.3, Q8 a)', () => {
  test('les treize étapes du § 2.1, dans leur ordre', () => {
    assert.deepEqual(ETAPES, ['1', '1b', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
    assert.ok(Object.isFrozen(ETAPES));
  });

  test('CAPTURES égale la table du contrat : vingt-deux entrées, leur étape et leur source', () => {
    const table = CAPTURES.map((c) => [c.fichier, c.etape, c.source]);
    assert.deepEqual(table, [
      ['01-premier-ecran', '1', 'navigateur'],
      ['01b-passer-en-ecriture', '1b', 'navigateur'],
      ['02-import-apercu', '2', 'navigateur'],
      ['02b-import-cp1252', '2', 'navigateur'],
      ['03-import-rapport', '2', 'navigateur'],
      ['04-grille-participants', '3', 'navigateur'],
      ['05-tables-etat', '4', 'navigateur'],
      ['06-defaut-consequence', '4', 'navigateur'],
      ['07-plan-tables', '4', 'navigateur'],
      ['07a-cibles-sieges', '4', 'navigateur'],
      ['07a-cibles-tables', '4', 'navigateur'],
      ['07b-nombre-de-tours', '5', 'navigateur'],
      ['08-animateurs-designes', '6', 'navigateur'],
      ['09-refus-sur-place', '7', 'navigateur'],
      ['10-diagnostic', '8', 'navigateur'],
      ['11-propositions', '9', 'navigateur'],
      ['19-ajustement', '11', 'navigateur'],
      ['20-mode-lecture', '11', 'navigateur'],
      ['22-plan-brouillon', '12', 'navigateur'],
      ['23-plan-retenu', '12', 'navigateur'],
      ['24-badges-controle', '12', 'pdf'],
      ['25-badges-planche', '12', 'pdf'],
    ]);
    for (const capture of CAPTURES) {
      assert.deepEqual(Object.keys(capture).sort(), ['configuration', 'etape', 'fichier', 'source'], capture.fichier);
      assert.equal(typeof capture.configuration, 'string', capture.fichier);
      assert.ok(capture.configuration.length > 0, capture.fichier);
      assert.ok(Object.isFrozen(capture), capture.fichier);
    }
    assert.ok(Object.isFrozen(CAPTURES));
  });

  test('la configuration nomme le fichier d’import ou la démonstration que la capture exige', () => {
    const configuration = new Map(CAPTURES.map((c) => [c.fichier, c.configuration]));
    assert.equal(configuration.get('02-import-apercu'), 'participants_cas_limites.csv');
    assert.equal(configuration.get('02b-import-cp1252'), 'participants_cas_limites_cp1252.csv');
    assert.equal(configuration.get('03-import-rapport'), 'participants_cas_limites.csv');
    assert.equal(configuration.get('10-diagnostic'), 'grande');
  });

  test('REPORTEES : 12 à 18 à l’étape 10, 21 à l’étape 11, raison « iteration5 », rien d’autre', () => {
    assert.deepEqual(
      REPORTEES.map((r) => [r.fichier, r.etape, r.raison]),
      [
        ['12-qualite-profil', '10', 'iteration5'],
        ['13-qualite-collisions', '10', 'iteration5'],
        ['14-qualite-paires', '10', 'iteration5'],
        ['15-pas-de-matrice', '10', 'iteration5'],
        ['16-minimum-atteint', '10', 'iteration5'],
        ['17-comparaison-manque', '10', 'iteration5'],
        ['18-comparaison-escalier', '10', 'iteration5'],
        ['21-historique', '11', 'iteration5'],
      ],
    );
    const rangs = REPORTEES.map((r) => Number(r.fichier.slice(0, 2)));
    for (const rang of rangs) assert.ok((rang >= 12 && rang <= 18) || rang === 21, String(rang));
    assert.ok(Object.isFrozen(REPORTEES));
    for (const reportee of REPORTEES) assert.ok(Object.isFrozen(reportee), reportee.fichier);
  });

  test('A_VENIR nomme les quatre captures de l’étape 12, toutes déclarées', () => {
    assert.deepEqual(A_VENIR, ['22-plan-brouillon', '23-plan-retenu', '24-badges-controle', '25-badges-planche']);
    const declarees = new Set(CAPTURES.map((c) => c.fichier));
    for (const fichier of A_VENIR) assert.ok(declarees.has(fichier), fichier);
    assert.ok(Object.isFrozen(A_VENIR));
  });

  test('CAPTURES ∪ REPORTEES : des noms uniques, et l’ordre des noms suit celui des étapes', () => {
    const toutes = [...CAPTURES, ...REPORTEES];
    assert.equal(new Set(toutes.map((e) => e.fichier)).size, toutes.length);
    const parNom = [...toutes].sort((a, b) => (a.fichier < b.fichier ? -1 : a.fichier > b.fichier ? 1 : 0));
    const rangs = parNom.map((e) => ETAPES.indexOf(e.etape));
    assert.ok(rangs.every((rang) => rang >= 0));
    for (let i = 1; i < rangs.length; i += 1) assert.ok(rangs[i - 1] <= rangs[i], `${parNom[i - 1].fichier} › ${parNom[i].fichier}`);
    const capturesParNom = [...CAPTURES].sort((a, b) => (a.fichier < b.fichier ? -1 : 1)).map((c) => c.fichier);
    assert.deepEqual(CAPTURES.map((c) => c.fichier), capturesParNom);
  });

  test('cheminImage et le chemin du manifeste sont sous doc/captures', () => {
    assert.equal(cheminImage('01-premier-ecran'), IMAGE_01);
    assert.equal(CHEMIN_MANIFESTE, 'doc/captures/manifeste.json');
  });
});

describe('manifeste : l’empreinte d’étape (§ 19.5, amendé)', () => {
  test('SHA-256 en hexadécimal, égale à celle que porte le manifeste de fixture', () => {
    for (const capture of manifesteFixture().captures) {
      assert.match(empreinteEtape(capture), /^[0-9a-f]{64}$/);
      assert.equal(empreinteEtape(capture), capture.empreinte, capture.fichier);
    }
  });

  test('invariante à la version réelle, à la version du navigateur, à l’image, à l’empreinte et à l’ordre des clés', () => {
    const capture = captureFixture();
    const reference = empreinteEtape(capture);
    assert.equal(empreinteEtape({ ...capture, versionReelle: versionVoisine(VERSION.affichee) }), reference);
    const { versionReelle: _version, ...sansVersion } = capture;
    assert.equal(empreinteEtape(sansVersion), reference);
    assert.equal(empreinteEtape({ ...capture, versionNavigateur: '141.0.1.2' }), reference);
    assert.equal(empreinteEtape({ ...capture, pilote: { navigateur: 'chromium', versionNavigateur: '141.0.1.2' } }),
      empreinteEtape({ ...capture, pilote: { navigateur: 'chromium', versionNavigateur: '139.0.9.9' } }));
    assert.equal(empreinteEtape({ ...capture, image: { sha256: '0'.repeat(64), largeur: 1, hauteur: 1 } }), reference);
    assert.equal(empreinteEtape({ ...capture, empreinte: 'f'.repeat(64) }), reference);
    const inverse = Object.fromEntries(Object.entries(capture).reverse());
    assert.equal(empreinteEtape(inverse), reference);
  });

  test('variable au texte, au thème, à l’état, aux styles, à la graine et au cadre', () => {
    const capture = captureFixture();
    const reference = empreinteEtape(capture);
    const variantes = [
      { ...capture, texte: [...capture.texte, 'Théo Pervenche'] },
      { ...capture, texte: capture.texte.slice().reverse() },
      { ...capture, theme: 'sombre' },
      { ...capture, etat: sha256('un autre état inventé') },
      { ...capture, styles: { ...capture.styles, clair: [{ couleur: '#000000' }] } },
      { ...capture, graine: 7 },
      { ...capture, cadre: { largeur: 1366, hauteur: 701 } },
    ];
    for (const variante of variantes) assert.notEqual(empreinteEtape(variante), reference);
  });

  test('refuse ce qui n’est pas un objet, et une valeur que JSON ne porte pas', () => {
    assert.throws(() => empreinteEtape(null), TypeError);
    assert.throws(() => empreinteEtape([]), TypeError);
    assert.throws(() => empreinteEtape({ ...captureFixture(), graine: undefined }), TypeError);
    assert.throws(() => empreinteEtape({ ...captureFixture(), graine: Number.NaN }), TypeError);
  });
});

describe('manifeste : la forme canonique', () => {
  test('clés triées à toute profondeur, une capture et une reportée par ligne, fin de ligne finale', () => {
    const manifeste = manifesteFixture();
    const texte = canoniser(manifeste);
    assert.ok(texte.endsWith(']}\n'), texte.slice(-10));
    const lignes = texte.split('\n');
    assert.equal(lignes[0], '{"captures":[');
    assert.ok(lignes[1].startsWith('{"cadre":{"hauteur":700,"largeur":1366},"empreinte":'), lignes[1]);
    assert.ok(lignes[1].endsWith('},'), lignes[1]);
    assert.ok(lignes[2].startsWith('{"cadre":'), lignes[2]);
    assert.ok(lignes[2].endsWith('}'), lignes[2]);
    assert.ok(lignes[3].startsWith('],"format":1,"pilote":{"cadre":{"hauteur":700,"largeur":1366},"facteurEchelle":1,'), lignes[3]);
    assert.ok(lignes[3].endsWith(',"reportees":['), lignes[3]);
    assert.equal(lignes[4], '{"etape":"10","fichier":"12-qualite-profil","raison":"iteration5"}');
    assert.equal(lignes[5], ']}');
    assert.equal(lignes[6], '');
    assert.deepEqual(JSON.parse(texte), manifeste);
  });

  test('l’ordre des clés reçu ne change rien ; celui des tableaux, si', () => {
    const manifeste = manifesteFixture();
    const inverse = Object.fromEntries(Object.entries(manifeste).reverse());
    inverse.captures = manifeste.captures.map((c) => Object.fromEntries(Object.entries(c).reverse()));
    assert.equal(canoniser(inverse), canoniser(manifeste));
    assert.notEqual(canoniser({ ...manifeste, captures: manifeste.captures.slice().reverse() }), canoniser(manifeste));
  });

  test('un tableau vide reste sur sa ligne', () => {
    assert.equal(canoniser({ format: 1, captures: [], reportees: [] }), '{"captures":[],"format":1,"reportees":[]}\n');
  });

  test('refuse une valeur que JSON ne porte pas', () => {
    assert.throws(() => canoniser({ format: 1, captures: [{ fichier: undefined }] }), TypeError);
    assert.throws(() => canoniser({ format: Number.POSITIVE_INFINITY }), TypeError);
    assert.throws(() => canoniser([]), TypeError);
  });
});

describe('manifeste : l’appariement documentation, manifeste, disque (§ 19.7)', () => {
  const images = [IMAGE_01, IMAGE_02];

  test('imagesReferencees relève chaque image de doc/captures, une fois, dans l’ordre du texte', () => {
    assert.deepEqual(imagesReferencees(lire('guide.md').toString('utf8')), [IMAGE_01, IMAGE_02]);
    assert.deepEqual(imagesReferencees('![a](../doc/captures/03-import-rapport.png) et doc/captures/x.jpg'), ['doc/captures/03-import-rapport.png']);
    assert.deepEqual(imagesReferencees('aucune image'), []);
  });

  test('la fixture appariée ne porte aucune faute', () => {
    assert.deepEqual(verifierAppariement({ manifeste: manifesteFixture(), references: referencesFixture(), images }), []);
  });

  test('balayage vide refusé : manifeste sans capture, document sans référence, aucune documentation, aucun fichier', () => {
    const vide = { ...manifesteFixture(), captures: [] };
    const sansCapture = verifierAppariement({ manifeste: vide, references: referencesFixture(), images });
    assert.equal(fautesDe(sansCapture, /aucune capture/).length, 1, JSON.stringify(sansCapture));
    assert.equal(fautesDe(sansCapture, /aucune capture/)[0].chemin, CHEMIN_MANIFESTE);

    const documentNu = verifierAppariement({
      manifeste: manifesteFixture(),
      references: [...referencesFixture(), { document: 'GUIDE-WINDOWS.md', images: [] }],
      images,
    });
    assert.deepEqual(documentNu, [{ chemin: 'GUIDE-WINDOWS.md', faute: 'aucune image référencée' }]);

    const sansDocument = verifierAppariement({ manifeste: manifesteFixture(), references: [], images });
    assert.equal(fautesDe(sansDocument, /aucun document/).length, 1, JSON.stringify(sansDocument));

    const sansFichier = verifierAppariement({ manifeste: manifesteFixture(), references: referencesFixture(), images: [] });
    assert.equal(fautesDe(sansFichier, /aucune image sur le disque/).length, 1, JSON.stringify(sansFichier));
  });

  test('orpheline côté document, côté manifeste, côté disque : trois fautes, chacune nommée', () => {
    const manifeste = manifesteFixture();
    const seule = (fichier) => ({ ...manifeste.captures[0], fichier });
    manifeste.captures.push(seule('04-grille-participants'));
    const references = referencesFixture();
    references[0].images.push('doc/captures/03-import-rapport.png');
    const fautes = verifierAppariement({ manifeste, references, images: [...images, 'doc/captures/05-tables-etat.png'] });
    assert.deepEqual(fautes, [
      { chemin: 'doc/captures/03-import-rapport.png', faute: 'orpheline : référencée par guide.md ; absente du manifeste et du disque' },
      { chemin: 'doc/captures/04-grille-participants.png', faute: 'orpheline : au manifeste ; absente de la documentation et du disque' },
      { chemin: 'doc/captures/05-tables-etat.png', faute: 'orpheline : sur le disque ; absente de la documentation et du manifeste' },
    ]);
  });

  test('une image présente de deux côtés sur trois est une orpheline du troisième', () => {
    const fautes = verifierAppariement({ manifeste: manifesteFixture(), references: referencesFixture(), images: [IMAGE_01] });
    assert.deepEqual(fautes, [{ chemin: IMAGE_02, faute: 'orpheline : référencée par guide.md, au manifeste ; absente du disque' }]);
  });

  test('une capture deux fois au manifeste est une faute', () => {
    const manifeste = manifesteFixture();
    manifeste.captures.push({ ...manifeste.captures[1] });
    const fautes = verifierAppariement({ manifeste, references: referencesFixture(), images });
    assert.deepEqual(fautes, [{ chemin: IMAGE_02, faute: 'deux fois au manifeste' }]);
  });
});

describe('manifeste : l’ordre contre les étapes du § 2.1 (§ 19.3)', () => {
  test('CAPTURES ∪ REPORTEES réel : aucune faute', () => {
    assert.deepEqual(verifierOrdre(manifesteDeclare()), []);
  });

  test('les captures d’A_VENIR, absentes du manifeste, sont admises', () => {
    assert.deepEqual(verifierOrdre(manifesteDeclare({ sans: A_VENIR })), []);
  });

  test('A_VENIR vidé, l’étape 12 sans capture est une faute', () => {
    const fautes = verifierOrdre(manifesteDeclare({ sans: A_VENIR }), { aVenir: [] });
    assert.deepEqual(fautes, [{ chemin: CHEMIN_MANIFESTE, faute: 'étape 12 : aucune capture ni reportée' }]);
  });

  test('une étape sans capture ni reportée est une faute qui la nomme', () => {
    assert.deepEqual(verifierOrdre(manifesteDeclare({ sans: ['07b-nombre-de-tours'] })), [
      { chemin: CHEMIN_MANIFESTE, faute: 'étape 5 : aucune capture ni reportée' },
    ]);
  });

  test('les reportées couvrent l’étape 10 ; sans elles, elle manque', () => {
    assert.deepEqual(verifierOrdre(manifesteDeclare({ reportees: [] })), [
      { chemin: CHEMIN_MANIFESTE, faute: 'étape 10 : aucune capture ni reportée' },
    ]);
  });

  test('ordre contredit : 02 rattachée à l’étape 4 avant 03 rattachée à la 2', () => {
    const manifeste = manifesteDeclare();
    manifeste.captures.find((c) => c.fichier === '02-import-apercu').etape = '4';
    assert.deepEqual(verifierOrdre(manifeste), [
      { chemin: 'doc/captures/02b-import-cp1252.png', faute: 'étape 2 après 02-import-apercu, de l’étape 4 : l’ordre contredit les étapes' },
    ]);
  });

  test('l’ordre se lit sur les noms, pas sur la place dans le tableau', () => {
    const manifeste = manifesteDeclare();
    manifeste.captures.reverse();
    assert.deepEqual(verifierOrdre(manifeste), []);
  });

  test('une étape inconnue, un nom déclaré deux fois : des fautes', () => {
    const inconnue = manifesteDeclare();
    inconnue.captures.find((c) => c.fichier === '05-tables-etat').etape = '4b';
    assert.deepEqual(verifierOrdre(inconnue), [{ chemin: 'doc/captures/05-tables-etat.png', faute: 'étape inconnue « 4b »' }]);

    const double = manifesteDeclare();
    double.reportees.push({ fichier: '19-ajustement', etape: '11', raison: 'iteration5' });
    assert.deepEqual(verifierOrdre(double), [{ chemin: 'doc/captures/19-ajustement.png', faute: 'déclarée deux fois' }]);
  });

  test('balayage vide refusé : aucune entrée est une faute, et chaque étape manque', () => {
    const fautes = verifierOrdre({ format: 1, captures: [], reportees: [] }, { aVenir: [] });
    assert.equal(fautes[0].faute, 'aucune capture ni reportée');
    assert.equal(fautes.length, 1 + ETAPES.length);
  });
});

describe('manifeste : l’image et son en-tête', () => {
  test('lireEntetePng lit 2 × 3 sur le PNG minimal', () => {
    assert.deepEqual(lireEntetePng(lire('deux_par_trois.png')), { largeur: 2, hauteur: 3 });
    assert.deepEqual(lireEntetePng(new Uint8Array(lire('doc/captures/01-premier-ecran.png'))), { largeur: 1366, hauteur: 700 });
  });

  test('lireEntetePng refuse une signature fausse, un en-tête tronqué, un premier morceau qui n’est pas IHDR', () => {
    const octets = new Uint8Array(lire('deux_par_trois.png'));
    const signature = octets.slice();
    signature[1] = 0x51;
    assert.throws(() => lireEntetePng(signature), /signature PNG/);
    assert.throws(() => lireEntetePng(octets.slice(0, 20)), /tronqué/);
    const autre = octets.slice();
    autre[12] = 0x69;
    assert.throws(() => lireEntetePng(autre), /IHDR/);
    const nulle = octets.slice();
    nulle.fill(0, 16, 20);
    assert.throws(() => lireEntetePng(nulle), /largeur/);
    assert.throws(() => lireEntetePng('PNG'), TypeError);
  });

  test('l’image de la fixture, octets et dimensions conformes : aucune faute', () => {
    const capture = captureFixture();
    assert.deepEqual(fautesDImage(capture, lire('doc/captures/01-premier-ecran.png')), []);
  });

  test('image remplacée par les octets d’une autre : faute', () => {
    const fautes = fautesDImage(captureFixture(0), lire('doc/captures/02-import-apercu.png'));
    assert.deepEqual(fautes, [{ chemin: IMAGE_01, faute: 'image remplacée : son empreinte diffère de celle du manifeste' }]);
  });

  test('dimensions ≠ cadre × facteur : faute', () => {
    const capture = captureFixture();
    const double = { ...capture, facteurEchelle: 2 };
    assert.deepEqual(fautesDImage(double, lire('doc/captures/01-premier-ecran.png')), [
      { chemin: IMAGE_01, faute: 'dimensions 1366 × 700, attendues 2732 × 1400 (cadre × facteur)' },
    ]);
    const autreCadre = { ...capture, cadre: { largeur: 1280, hauteur: 700 } };
    assert.deepEqual(fautesDImage(autreCadre, lire('doc/captures/01-premier-ecran.png')), [
      { chemin: IMAGE_01, faute: 'dimensions 1366 × 700, attendues 1280 × 700 (cadre × facteur)' },
    ]);
  });

  test('dimensions du fichier ≠ celles que le manifeste inscrit : faute', () => {
    const capture = captureFixture();
    const inscrite = { ...capture, image: { ...capture.image, hauteur: 699 } };
    assert.deepEqual(fautesDImage(inscrite, lire('doc/captures/01-premier-ecran.png')), [
      { chemin: IMAGE_01, faute: 'dimensions 1366 × 700, le manifeste inscrit 1366 × 699' },
    ]);
  });

  test('un fichier qui n’est pas un PNG : faute, pas d’exception', () => {
    const capture = captureFixture();
    const octets = new TextEncoder().encode('ceci n’est pas une image');
    const fautes = fautesDImage({ ...capture, image: { ...capture.image, sha256: sha256(octets) } }, octets);
    assert.equal(fautes.length, 1, JSON.stringify(fautes));
    assert.match(fautes[0].faute, /^illisible : /);
  });
});

describe('manifeste : les chemins hors de la racine neutre (§ 19.4)', () => {
  test('relève C:\\Users\\…, /home/…, /tmp/… ; admet la racine elle-même et ce qui est dessous', () => {
    const texte = [
      `Dossier de travail : ${RACINE}`,
      `Événement : ${RACINE}\\Bal des Grisailles.gtt.json`,
      'Copie : C:\\Users\\Exemple\\Bureau\\x',
      'Ailleurs : /home/exemple/x',
      'Temporaire (/tmp/x).',
    ].join('\n');
    assert.deepEqual(cheminsHorsRacine(texte, RACINE), ['C:\\Users\\Exemple\\Bureau\\x', '/home/exemple/x', '/tmp/x']);
  });

  test('la racine se reconnaît sous l’autre séparateur et l’autre casse de Windows ; un nom qui la prolonge ne l’est pas', () => {
    assert.deepEqual(cheminsHorsRacine('c:/racine/tablees/a et C:\\RACINE\\TABLEES\\b', RACINE), []);
    assert.deepEqual(cheminsHorsRacine(`${RACINE}X\\a`, RACINE), [`${RACINE}X\\a`]);
    assert.deepEqual(cheminsHorsRacine('D:\\Racine\\Tablees\\a', RACINE), ['D:\\Racine\\Tablees\\a']);
  });

  test('une racine qui porte une espace se reconnaît entière', () => {
    const racine = 'C:\\Mes Tablées';
    assert.deepEqual(cheminsHorsRacine(`ouvert depuis ${racine}\\Soirée des Merles.gtt.json`, racine), []);
  });

  test('chemin réseau, dossier personnel abrégé, racine POSIX', () => {
    assert.deepEqual(cheminsHorsRacine('\\\\serveur\\partage\\x et ~/x', RACINE), ['\\\\serveur\\partage\\x', '~/x']);
    assert.deepEqual(cheminsHorsRacine('/srv/neutre/a /srv/neutre /srv/neutreX/b', '/srv/neutre'), ['/srv/neutreX/b']);
  });

  test('ni une adresse web, ni une fraction, ni un chemin relatif ne sont des chemins absolus', () => {
    assert.deepEqual(cheminsHorsRacine('http://www.example.org/a 3/4 tables, doc/captures/x.png, et/ou', RACINE), []);
    assert.deepEqual(cheminsHorsRacine('Lien:https://exemple.invalid/a à 12:30', RACINE), []);
  });

  test('un chemin POSIX qui suit un deux-points est relevé', () => {
    assert.deepEqual(cheminsHorsRacine('Chemin:/home/exemple/x et poste-exemple:/var/y', RACINE), ['/home/exemple/x', '/var/y']);
  });

  test('un chemin réseau aux barres obliques est relevé ; sous une racine réseau, il est admis', () => {
    assert.deepEqual(cheminsHorsRacine('//serveur/partage/x et (//serveur/autre)', RACINE), ['//serveur/partage/x', '//serveur/autre']);
    assert.deepEqual(cheminsHorsRacine('//serveur/partage/a', '\\\\serveur\\partage'), []);
    assert.deepEqual(cheminsHorsRacine('//serveur/partageX/a', '\\\\serveur\\partage'), ['//serveur/partageX/a']);
  });

  test('une adresse file:// est relevée par le chemin qu’elle porte, encodage compris', () => {
    const texte = 'file:///home/exemple/x, FILE:///C:/Users/Exemple/x et file://serveur/partage/x';
    assert.deepEqual(cheminsHorsRacine(texte, RACINE), ['file:///home/exemple/x', 'FILE:///C:/Users/Exemple/x', 'file://serveur/partage/x']);
    assert.deepEqual(cheminsHorsRacine('file:///c:/racine/tablees/a.gtt.json', RACINE), []);
    assert.deepEqual(cheminsHorsRacine('file:///C:/Mes%20Tabl%C3%A9es/a.gtt.json', 'C:\\Mes Tablées'), []);
    assert.deepEqual(cheminsHorsRacine('file:///srv/neutre/a file:///srv/neutreX/b', '/srv/neutre'), ['file:///srv/neutreX/b']);
  });

  test('chaque chemin une fois, dans l’ordre du texte ; une racine absente ou relative est refusée', () => {
    assert.deepEqual(cheminsHorsRacine('/tmp/x puis /tmp/x puis /var/y', RACINE), ['/tmp/x', '/var/y']);
    assert.throws(() => cheminsHorsRacine('x', ''), TypeError);
    assert.throws(() => cheminsHorsRacine('x', 'relatif\\dossier'), TypeError);
    assert.throws(() => cheminsHorsRacine(42, RACINE), TypeError);
  });
});

describe('manifeste : l’écart de version (§ 19.7)', () => {
  test('null à version égale, par défaut celle de la construction', () => {
    assert.equal(ecartDeVersion(manifesteFixture(), VERSION.affichee), null);
    assert.equal(ecartDeVersion(manifesteFixture()), null);
  });

  test('l’écart nommé sinon : la version du manifeste et celle de la construction', () => {
    const voisine = versionVoisine(VERSION.affichee);
    assert.deepEqual(ecartDeVersion(manifesteFixture(), voisine), { manifeste: VERSION.affichee, construction: voisine });
  });

  test('deux versions au manifeste : chacune nommée, une fois, dans l’ordre des captures', () => {
    const voisine = versionVoisine(VERSION.affichee);
    const manifeste = manifesteFixture();
    manifeste.captures[1].versionReelle = voisine;
    manifeste.captures.push({ ...manifeste.captures[0] });
    assert.deepEqual(ecartDeVersion(manifeste, VERSION.affichee), { manifeste: `${VERSION.affichee}, ${voisine}`, construction: VERSION.affichee });
  });

  test('un manifeste sans capture n’établit aucune version : écart', () => {
    assert.deepEqual(ecartDeVersion({ format: 1, captures: [] }, VERSION.affichee), { manifeste: null, construction: VERSION.affichee });
  });
});

describe('manifeste : un relevé ne nomme pas sa machine (contrainte 27)', () => {
  test('le manifeste de fixture passe', () => {
    assert.deepEqual(fautesDeMachine(manifesteFixture(), RACINE), []);
  });

  test('un champ d’hôte au pilote, une clé inconnue d’une capture ou du manifeste : refusés', () => {
    const manifeste = manifesteFixture();
    manifeste.pilote.hote = 'poste-des-merles';
    manifeste.captures[1].utilisateur = 'ondine';
    manifeste.date = '2030-01-01';
    assert.deepEqual(fautesDeMachine(manifeste, RACINE), [
      { chemin: CHEMIN_MANIFESTE, faute: 'clé hors du contrat : « date »' },
      { chemin: CHEMIN_MANIFESTE, faute: 'clé hors du contrat : « pilote.hote »' },
      { chemin: IMAGE_02, faute: 'clé hors du contrat : « utilisateur »' },
    ]);
  });

  test('un chemin de compte dans le texte relevé ou dans le pilote : refusé', () => {
    const manifeste = manifesteFixture();
    manifeste.captures[0].texte.push('/home/exemple/x');
    manifeste.pilote.navigateur = 'C:\\Users\\Exemple\\chromium';
    assert.deepEqual(fautesDeMachine(manifeste, RACINE), [
      { chemin: CHEMIN_MANIFESTE, faute: 'chemin hors de la racine neutre : « C:\\Users\\Exemple\\chromium »' },
      { chemin: IMAGE_01, faute: 'chemin hors de la racine neutre : « /home/exemple/x »' },
    ]);
  });
});
