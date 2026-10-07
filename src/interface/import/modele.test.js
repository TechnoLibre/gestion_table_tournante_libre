// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le modèle de l'aperçu d'import (§ 10.1, § 10.2) : la lecture d'un collage
// sans en-tête dans l'ordre de la grille, la clé de la cause et celle du
// remède de chaque refus global, l'encodage et le séparateur nommés, et les
// titres que « Remplacer » annonce, comptés par la règle unique des titres
// pourvus. Les noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { apercevoir, bilanRemplacement, CHAMPS, decoder } from '../../application/csv.js';
import { comptesTitres, titresNonPourvus } from '../../application/listes_travail.js';
import { creerTraduction } from '../../application/traduction.js';
import { creerCharge } from '../../stockage/document.js';
import { TABLES_INTERFACE } from '../libelles.js';
import {
  COLONNES_DES_LIGNES,
  ENCODAGES,
  MODES_D_IMPORT,
  SEPARATEURS,
  avecEntetesDeLaGrille,
  modeleApercu,
  modePropose,
  motifLigne,
  nommer,
  refuseesDe,
} from './modele.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

const TAB = '\t';
const lignes = (...enregistrements) => `${enregistrements.join('\n')}\n`;

// Les noms lus des lignes valides d'un aperçu, dans l'ordre du texte.
const nomsLus = (apercu) => apercu.lignes.map(({ champs }) => champs.nom);

// Le refus de decoder sur ces octets, sous la forme { code, details }.
function refusDeDecoder(octets) {
  try {
    decoder(octets);
  } catch (erreur) {
    return { code: erreur.code, details: erreur.details };
  }
  throw new Error('decoder a accepté les octets');
}

const octets = (...valeurs) => Uint8Array.from(valeurs);
const utf8 = (texte) => new TextEncoder().encode(texte);
const MARQUE_UTF8 = [0xef, 0xbb, 0xbf];

describe('avecEntetesDeLaGrille : un collage sans en-tête lu dans l’ordre de la grille (§ 10.2)', () => {
  test('trois colonnes à tabulations, sans en-tête : AUCUN_ENTETE, puis nom, prénom et appartenance, les rangs comptant la ligne ajoutée', () => {
    const texte = lignes(
      ['Ombrelle', 'Iris', 'Club des Merles'].join(TAB),
      ['Pervenche', 'Théo', 'Grisaille'].join(TAB),
    );
    const sans = apercevoir(texte);
    assert.equal(sans.refusGlobal, 'AUCUN_ENTETE');
    const avec = avecEntetesDeLaGrille(texte, sans);
    assert.equal(avec, `${['nom', 'prenom', 'appartenance'].join(TAB)}\n${texte}`);
    const lu = apercevoir(avec);
    assert.equal(lu.refusGlobal, null);
    assert.deepEqual(lu.association.colonnes, { nom: 0, prenom: 1, appartenance: 2 });
    assert.equal(lu.lignes.length, 2);
    assert.deepEqual(lu.lignes.map(({ ligne }) => ligne), [2, 3]);
    assert.deepEqual(lu.lignes[0].champs.appartenance, 'Club des Merles');
  });

  test('deux colonnes : nom et prénom', () => {
    const texte = lignes(['Ombrelle', 'Iris'].join(TAB), ['Pervenche', 'Théo'].join(TAB));
    const sans = apercevoir(texte);
    assert.equal(sans.refusGlobal, 'AUCUN_ENTETE');
    const lu = apercevoir(avecEntetesDeLaGrille(texte, sans));
    assert.equal(lu.refusGlobal, null);
    assert.deepEqual(lu.association.colonnes, { nom: 0, prenom: 1 });
    assert.deepEqual(nomsLus(lu), ['Ombrelle', 'Pervenche']);
  });

  test('neuf colonnes : les sept champs de la grille, puis deux en-têtes vides, listés non reconnus', () => {
    const rangee = (nom) => [nom, 'Iris', 'Grisaille', 'iris@exemple.test', 'animation', 'non', 'note', 'x1', 'x2'].join(TAB);
    const texte = lignes(rangee('Ombrelle'), rangee('Lacasse'));
    const sans = apercevoir(texte);
    assert.equal(sans.refusGlobal, 'AUCUN_ENTETE');
    assert.equal(sans.entetes.length, 9);
    const avec = avecEntetesDeLaGrille(texte, sans);
    assert.equal(avec.split('\n')[0], [...CHAMPS, '', ''].join(TAB));
    const lu = apercevoir(avec);
    assert.equal(lu.refusGlobal, null);
    assert.equal(CHAMPS.length, 7);
    assert.deepEqual(lu.association.colonnes, Object.fromEntries(CHAMPS.map((champ, rang) => [champ, rang])));
    assert.deepEqual(lu.association.nonReconnues, [7, 8]);
    assert.deepEqual(nomsLus(lu), ['Ombrelle', 'Lacasse']);
  });

  test('une liste de noms d’une colonne, « Lacasse, Ondine » compris : SEPARATEUR_INTROUVABLE sans rang, puis une colonne, la ligne entière en nom', () => {
    const texte = lignes('Ombrelle', 'Lacasse, Ondine', 'Pervenche');
    const sans = apercevoir(texte);
    assert.equal(sans.refusGlobal, 'SEPARATEUR_INTROUVABLE');
    assert.equal(sans.refusGlobalLigne, null);
    const avec = avecEntetesDeLaGrille(texte, sans);
    assert.equal(avec, `nom\n${texte}`);
    const lu = apercevoir(avec);
    assert.equal(lu.refusGlobal, null);
    assert.equal(lu.separateur, null);
    assert.deepEqual(nomsLus(lu), ['Ombrelle', 'Lacasse, Ondine', 'Pervenche']);
  });

  test('un texte blanc, un guillemet ouvert, un séparateur écarté à un rang nommé, un aperçu sans refus : null', () => {
    const blanc = '  \n\t\n';
    assert.equal(apercevoir(blanc).refusGlobal, 'AUCUN_ENTETE');
    assert.equal(avecEntetesDeLaGrille(blanc, apercevoir(blanc)), null);

    const guillemet = lignes('nom;prenom', '"Ombrelle;Iris', 'Pervenche;Théo');
    assert.equal(apercevoir(guillemet).refusGlobal, 'GUILLEMET_OUVERT');
    assert.equal(avecEntetesDeLaGrille(guillemet, apercevoir(guillemet)), null);

    const ecarte = lignes('Lacasse, Ondine', 'Ombrelle', 'Pervenche');
    const refus = apercevoir(ecarte);
    assert.equal(refus.refusGlobal, 'SEPARATEUR_INTROUVABLE');
    assert.equal(refus.refusGlobalLigne, 2);
    assert.equal(avecEntetesDeLaGrille(ecarte, refus), null);

    const valide = lignes('nom;prenom', 'Ombrelle;Iris');
    assert.equal(avecEntetesDeLaGrille(valide, apercevoir(valide)), null);
  });
});

// Chaque refus global de la table des décisions d'I6, la façon de le
// produire, et la clé du remède attendue. Les quatre de decoder passent par
// refusDecodage ; les autres, par l'aperçu d'un fichier (encodage donné) ou
// d'un collage (encodage null).
const REFUS = [
  ['UTF16_SANS_MARQUE', { refusDecodage: refusDeDecoder(octets(0x6e, 0x00, 0x6f, 0x00)) }, 'ENREGISTRER_EN_UTF8'],
  ['UTF16_INVALIDE', { refusDecodage: refusDeDecoder(octets(0xff, 0xfe, 0x6e, 0x00, 0x6f)) }, 'ENREGISTRER_EN_UTF8'],
  ['UTF8_INVALIDE', { refusDecodage: refusDeDecoder(octets(...MARQUE_UTF8, 0x6e, 0xff, 0x6f)) }, 'ENREGISTRER_EN_UTF8'],
  ['CARACTERE_NUL', { refusDecodage: refusDeDecoder(octets(...MARQUE_UTF8, ...utf8('nom\nOmbrelle\u{0}\n'))) }, 'ENREGISTRER_EN_UTF8'],
  ['CARACTERE_NUL', { encodage: null, apercu: apercevoir('nom\nOmbrelle\u{0}\n') }, 'import.remede.caractereNulCollage'],
  ['AUCUN_ENTETE', { encodage: 'utf-8', apercu: apercevoir(lignes('a;b', 'Ombrelle;Iris')) }, 'import.remede.aucunEntete'],
  ['AUCUN_ENTETE', { encodage: null, apercu: apercevoir(lignes('Ombrelle;Iris', 'Pervenche;Théo')) }, 'import.remede.aucunEnteteCollage'],
  ['AUCUN_ENTETE', { encodage: null, apercu: apercevoir('  \n') }, 'import.remede.aucunEntete'],
  ['NOM_NON_ASSOCIE', { encodage: 'utf-8', apercu: apercevoir(lignes('prenom;notes', 'Iris;x')) }, 'import.remede.nomNonAssocie'],
  ['AUCUNE_LIGNE_VALIDE', { encodage: 'utf-8', apercu: apercevoir(lignes('nom;prenom', ';Iris')) }, 'import.remede.aucuneLigneValide'],
  ['GUILLEMET_OUVERT', { encodage: 'utf-8', apercu: apercevoir(lignes('nom;prenom', '"Ombrelle;Iris')) }, 'import.remede.guillemetOuvert'],
  [
    'SEPARATEUR_INTROUVABLE',
    { encodage: 'utf-8', apercu: apercevoir(lignes('nom;prenom', 'Ombrelle;Iris;x', 'Pervenche')) },
    'import.remede.separateurIntrouvable',
  ],
  [
    'SEPARATEUR_INTROUVABLE',
    { encodage: null, apercu: apercevoir(lignes('Ombrelle', 'Lacasse, Ondine')) },
    'import.remede.separateurIntrouvableCollage',
  ],
];

describe('modeleApercu : la cause et le remède de chaque refus global (§ 10.1)', () => {
  test('chaque refus de la table des décisions rend la clé de sa cause, le code, et celle de son remède, toutes deux traduites', () => {
    const codes = new Set(REFUS.map(([code]) => code));
    assert.equal(codes.size, 9);
    assert.equal(REFUS.length, 13);
    for (const [code, entree, remede] of REFUS) {
      if (entree.apercu !== undefined) assert.equal(entree.apercu.refusGlobal, code, code);
      if (entree.refusDecodage !== undefined) assert.equal(entree.refusDecodage.code, code, code);
      const { global } = modeleApercu(entree);
      assert.notEqual(global, null, code);
      assert.equal(global.cle, code);
      assert.equal(global.remede.cle, remede, code);
      assert.equal(typeof t(global.cle, global.details), 'string');
      assert.ok(t(global.cle, global.details).length > 0, code);
      assert.ok(t(global.remede.cle, global.remede.details).length > 0, code);
    }
  });

  test('un refus de decoder : son texte compose déjà le remède, que le modèle dit et ne répète pas ; un refus de l’aperçu le porte à part', () => {
    const [, entree] = REFUS[0];
    const { global } = modeleApercu(entree);
    assert.equal(global.remede.dansLaCause, true);
    assert.ok(t(global.cle, global.details).includes(t(global.remede.cle, global.remede.details)));
    for (const [code, apercuDonne] of REFUS.slice(4)) {
      assert.equal(modeleApercu(apercuDonne).global.remede.dansLaCause, false, code);
    }
  });

  test('le rang d’un guillemet ouvert et d’un séparateur écarté passe à la cause et au remède', () => {
    const guillemet = modeleApercu(REFUS[10][1]).global;
    assert.deepEqual(guillemet.details, { ligne: 2 });
    assert.match(t(guillemet.cle, guillemet.details), /ligne 2/);
    assert.match(t(guillemet.remede.cle, guillemet.remede.details), /2/);
    const separateur = modeleApercu(REFUS[11][1]).global;
    assert.deepEqual(separateur.details, { ligne: 2 });
    assert.match(t(separateur.cle, separateur.details), /ligne 2/);
  });

  test('un code de refus que la table ne connaît pas lève, jamais un remède muet', () => {
    const apercu = { ...apercevoir(lignes('nom', 'Ombrelle')), refusGlobal: 'REFUS_INVENTE' };
    assert.throws(() => modeleApercu({ encodage: 'utf-8', apercu }), RangeError);
    assert.throws(
      () => modeleApercu({ refusDecodage: { code: 'REFUS_INVENTE', details: { remede: 'ENREGISTRER_EN_UTF8' } } }),
      RangeError,
    );
  });

  test('sous un refus de decoder : ni encodage, ni séparateur, ni colonne, ni ligne', () => {
    const modele = modeleApercu(REFUS[0][1]);
    assert.equal(modele.encodage, null);
    assert.equal(modele.separateur, null);
    for (const liste of ['colonnes', 'ambigus', 'lignes', 'refusees', 'fusions', 'doublons', 'homonymes', 'multilignes']) {
      assert.deepEqual(modele[liste], [], liste);
    }
    assert.equal(modele.valides, 0);
  });
});

describe('modeleApercu : ce que l’aperçu montre (§ 10.1)', () => {
  test('chaque encodage de decoder et chaque séparateur ont leur clé, qui se traduit, et un collage n’a pas d’encodage', () => {
    const encodages = ['utf-8-bom', 'utf-16le', 'utf-16be', 'utf-8', 'windows-1252'];
    assert.deepEqual([...ENCODAGES.keys()], encodages);
    for (const encodage of encodages) assert.ok(t(ENCODAGES.get(encodage)).length > 0, encodage);
    assert.deepEqual([...SEPARATEURS.keys()], [';', ',', '\t', null]);
    for (const cle of SEPARATEURS.values()) assert.ok(t(cle).length > 0, cle);
    assert.equal(t(SEPARATEURS.get(null)), 'une seule colonne');

    const apercu = apercevoir(lignes('nom,prenom', 'Ombrelle,Iris'));
    const fichier = modeleApercu({ encodage: 'windows-1252', apercu });
    assert.equal(fichier.encodage, ENCODAGES.get('windows-1252'));
    assert.equal(fichier.separateur, SEPARATEURS.get(','));
    const collage = modeleApercu({ apercu });
    assert.equal(collage.encodage, null);
    assert.equal(collage.separateur, SEPARATEURS.get(','));
    const uneColonne = modeleApercu({ encodage: 'utf-8', apercu: apercevoir(lignes('nom', 'Lacasse, Ondine')) });
    assert.equal(uneColonne.separateur, SEPARATEURS.get(null));
  });

  test('un séparateur que la lecture n’a pas établi n’est pas nommé « une seule colonne »', () => {
    for (const [code, entree] of REFUS.slice(4)) {
      const { separateur } = modeleApercu(entree);
      const etabli = ['AUCUN_ENTETE', 'NOM_NON_ASSOCIE', 'AUCUNE_LIGNE_VALIDE', 'GUILLEMET_OUVERT'].includes(code) &&
        entree.apercu.entetes.length > 0;
      if (etabli) assert.equal(separateur, SEPARATEURS.get(entree.apercu.separateur), code);
      else assert.equal(separateur, null, code);
    }
  });

  test('colonnes associées, non reconnues, à trancher puis écartée ; ambiguïtés nommées par leurs en-têtes', () => {
    const texte = lignes('Nom;Organisation;Entreprise;Allergies', 'Ombrelle;Club des Merles;Grisaille;aucune');
    const ambigu = modeleApercu({ encodage: 'utf-8', apercu: apercevoir(texte) });
    assert.deepEqual(
      ambigu.colonnes.map(({ rang, entete, cle }) => [rang, entete, cle]),
      [
        [0, 'Nom', 'import.champ.nom'],
        [1, 'Organisation', 'import.colonne.aTrancher'],
        [2, 'Entreprise', 'import.colonne.aTrancher'],
        [3, 'Allergies', 'import.colonne.nonReconnue'],
      ],
    );
    assert.deepEqual(ambigu.ambigus, [
      { champ: 'appartenance', cle: 'import.champ.appartenance', rangs: [{ rang: 1, entete: 'Organisation' }, { rang: 2, entete: 'Entreprise' }] },
    ]);
    const tranche = modeleApercu({ encodage: 'utf-8', apercu: apercevoir(texte, { choix: { appartenance: 2 } }) });
    assert.deepEqual(tranche.colonnes.map(({ cle }) => cle), [
      'import.champ.nom', 'import.colonne.ecartee', 'import.champ.appartenance', 'import.colonne.nonReconnue',
    ]);
    assert.deepEqual(tranche.ambigus, []);
    for (const { cle } of [...ambigu.colonnes, ...tranche.colonnes]) assert.ok(t(cle).length > 0, cle);
  });

  test('chaque champ de CHAMPS a sa clé, qui se traduit', () => {
    const texte = lignes(CHAMPS.join(';'), ['Ombrelle', 'Iris', 'Grisaille', 'i@exemple.test', 'x', 'non', 'n'].join(';'));
    const { colonnes } = modeleApercu({ encodage: 'utf-8', apercu: apercevoir(texte) });
    assert.equal(colonnes.length, 7);
    for (const { cle } of colonnes) {
      assert.match(cle, /^import\.champ\./);
      assert.ok(t(cle).length > 0, cle);
    }
  });

  test('lignes refusées, fusions et doublons, en données ; le motif affiché est celui de t', () => {
    const existants = [{ id: 4, nom: 'Ombrelle', prenom: 'Iris', appartenance: 'Coopérative Bleue' }];
    const texte = lignes(
      'nom;prenom;appartenance;exclu',
      'Ombrelle;Iris;cooperative  bleue;',
      ';Théo;Grisaille;',
      'Pervenche;Théo;COOPÉRATIVE BLEUE;peut-être',
      'Pervenche;Théo;COOPÉRATIVE BLEUE;x',
      'Lacasse;Ondine;;',
    );
    const modele = modeleApercu({ encodage: 'utf-8', apercu: apercevoir(texte, { participants: existants }) });
    assert.equal(modele.valides, 3);
    assert.deepEqual(modele.refusees, [
      { ligne: 3, code: 'NOM_ABSENT', details: { ligne: 3, valeur: null } },
      { ligne: 4, code: 'EXCLU_INCONNU', details: { ligne: 4, valeur: 'peut-être' } },
    ]);
    assert.deepEqual(modele.fusions, [
      {
        affichee: 'Coopérative Bleue',
        orthographes: [
          { texte: 'Coopérative Bleue', lignes: 0 },
          { texte: 'cooperative  bleue', lignes: 1 },
          { texte: 'COOPÉRATIVE BLEUE', lignes: 1 },
        ],
      },
    ]);
    assert.deepEqual(modele.doublons, [{ lignes: [2], existants: [4] }]);
    const motif = motifLigne(t);
    const [, refusee] = modele.refusees;
    assert.equal(motif(refusee.code, refusee.details), t('EXCLU_INCONNU', { ligne: 4, valeur: 'peut-être' }));
    assert.match(motif(refusee.code, refusee.details), /peut-être/);
  });
});

describe('les lignes, les refus de la mise à jour, les personnes désignées, le mode proposé (§ 10.1)', () => {
  test('chaque ligne valide montre ses sept champs dans l’ordre de CHAMPS ; exclu par sa clé, vide sans valeur', () => {
    const texte = lignes(
      'notes;exclu;nom;prenom',
      'arrive tard;Oui;Ombrelle;Iris',
      ';;Pervenche;',
      ';0;Lacasse;Ondine',
    );
    const { lignes: lues } = modeleApercu({ encodage: 'utf-8', apercu: apercevoir(texte) });
    assert.equal(lues.length, 3);
    assert.deepEqual(lues.map(({ ligne }) => ligne), [2, 3, 4]);
    for (const { cellules } of lues) assert.deepEqual(cellules.map(({ champ }) => champ), [...CHAMPS]);
    assert.deepEqual(COLONNES_DES_LIGNES.map(({ champ }) => champ), [...CHAMPS]);
    for (const { cle } of COLONNES_DES_LIGNES) assert.ok(t(cle).length > 0, cle);
    const [premiere, deuxieme, troisieme] = lues;
    assert.deepEqual(premiere.cellules.map(({ texte: valeur }) => valeur), ['Ombrelle', 'Iris', null, null, null, null, 'arrive tard']);
    assert.equal(premiere.cellules[5].cle, 'import.exclu.oui');
    assert.equal(deuxieme.cellules[5].cle, null);
    assert.equal(troisieme.cellules[5].cle, 'import.exclu.non');
    for (const cle of ['import.exclu.oui', 'import.exclu.non']) assert.ok(t(cle).length > 0);
  });

  test('refuseesDe : les refus de la mise à jour gardent les personnes désignées et la première ligne, sans les champs découpés', () => {
    const refusees = [
      { ligne: 3, code: 'PLUSIEURS_CORRESPONDENT', valeur: null, participants: [2, 5], brut: ['Lacasse', ''] },
      { ligne: 5, code: 'DEJA_DESIGNE', valeur: null, participants: [1], premiereLigne: 4, brut: ['Ombrelle', ''] },
    ];
    assert.deepEqual(refuseesDe(refusees), [
      { ligne: 3, code: 'PLUSIEURS_CORRESPONDENT', details: { ligne: 3, valeur: null, participants: [2, 5] } },
      { ligne: 5, code: 'DEJA_DESIGNE', details: { ligne: 5, valeur: null, participants: [1], premiereLigne: 4 } },
    ]);
    const motif = motifLigne(t);
    assert.match(motif('DEJA_DESIGNE', refuseesDe(refusees)[1].details), /ligne 4/);
  });

  test('nommer : les personnes d’une liste d’identifiants, dans son ordre ; une personne que la liste n’a plus est omise', () => {
    const participants = [
      { id: 2, nom: 'Lacasse', prenom: 'Ondine' },
      { id: 5, nom: 'Lacasse', prenom: null },
    ];
    assert.deepEqual(nommer(participants, [5, 2, 9]), [
      { id: 5, nom: 'Lacasse', prenom: null },
      { id: 2, nom: 'Lacasse', prenom: 'Ondine' },
    ]);
  });

  test('les trois modes offerts, chacun nommé par sa clé, ceux de l’aperçu de src/csv', () => {
    assert.deepEqual(MODES_D_IMPORT.map(({ mode }) => mode), ['ajouter', 'mettreAJour', 'remplacer']);
    for (const { mode, cle } of MODES_D_IMPORT) {
      assert.ok(t(cle).length > 0, cle);
      assert.equal(apercevoir(lignes('nom', 'Ombrelle'), { mode }).mode, mode);
    }
  });

  test('le mode proposé : Ajouter pour une liste vide, Mettre à jour sinon ; jamais Remplacer', () => {
    assert.equal(modePropose([]), 'ajouter');
    assert.equal(modePropose([{ id: 1, nom: 'Ombrelle' }]), 'mettreAJour');
  });
});

// Une charge de deux tours, une table de six places, trois titres à cette
// table, et trois personnes : la première réservée « tous » au siège du
// premier titre, la deuxième réservée au tour 1 seul au siège du deuxième,
// la troisième sans réservation. Sans attribution, les réservations ne
// portent pas de siège.
function chargeAuxTitres({ attribuerSieges }) {
  const charge = creerCharge({ id: 'epreuve', nom: 'Soirée des Merles', siegesParDefaut: 6, tours: 2 });
  charge.reglages.attribuerSieges = attribuerSieges;
  charge.participants = ['Ombrelle', 'Pervenche', 'Lacasse'].map((nom, rang) => ({
    id: rang + 1, nom, prenom: null, appartenance: null, courriel: null, titrePressenti: null, notes: null, exclu: false,
  }));
  charge.tables = [{ id: 1, numero: 1, sieges: null, forme: 'ronde', position: { x: 0, y: 0 } }];
  charge.titres = [1, 2, 3].map((siege) => ({ table: 1, siege, libelle: `Animation ${siege}` }));
  charge.reservations = [
    { participant: 1, table: 1, siege: attribuerSieges ? 1 : null, portee: 'tous', tour: null },
    { participant: 2, table: 1, siege: attribuerSieges ? 2 : null, portee: 'tour', tour: 1 },
  ];
  charge.prochainsIds = { participant: 4, table: 2, proposition: 1 };
  return charge;
}

describe('les titres que « Remplacer » annonce (§ 10.1, § 4.1)', () => {
  for (const attribuerSieges of [true, false]) {
    test(`sièges ${attribuerSieges ? 'attribués' : 'non attribués, réservations sans siège'} : deux titres perdent leur réservation, un « tous » et un « tour »`, () => {
      const charge = chargeAuxTitres({ attribuerSieges });
      const bilan = bilanRemplacement(charge);
      assert.equal(bilan.titresPourvus, 2);
      assert.equal(charge.tables.length, 1);
      const pourSoiree = charge.tables.reduce((somme, { id }) => somme + comptesTitres(charge, id).pourvus, 0);
      assert.equal(pourSoiree, 1);
      const aUnTour = titresNonPourvus(charge).filter(({ pourvuAuxTours }) => pourvuAuxTours.length > 0).length;
      assert.equal(aUnTour, 1);
      assert.equal(bilan.titresPourvus, pourSoiree + aUnTour);
      assert.deepEqual(bilan, { participants: 3, reservations: 2, titresPourvus: 2, propositions: 0 });
    });
  }
});
