// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le modèle de l'aperçu d'un import, § 10.1, § 10.2 et § 10.4 : la lecture
// d'un collage sans en-tête dans l'ordre de la grille, la clé de la cause et
// celle du remède de chaque refus global, l'encodage et le séparateur
// nommés, les titres que « Remplacer » annonce, comptés par la règle unique
// des titres pourvus, la nature du fichier reçue et jamais devinée, les
// objectifs de table et les étiquettes fondues, à part des appartenances ;
// la cellule de la présence, lue sous le nombre de tours de l'événement ;
// le modèle à télécharger de chaque nature, son nom et son nom accessible.
// Les noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import {
  apercevoir,
  apercevoirObjectifs,
  bilanRemplacement,
  CHAMPS,
  CHAMPS_OBJECTIFS,
  decoder,
  modeleObjectifs,
  modeleParticipants,
} from '../../application/csv.js';
import { comptesTitres, titresNonPourvus } from '../../application/listes_travail.js';
import { creerTraduction } from '../../application/traduction.js';
import { creerCharge } from '../../stockage/document.js';
import { TABLES_INTERFACE } from '../libelles.js';
import {
  COLONNES_DES_LIGNES,
  COLONNES_DES_OBJECTIFS,
  ENCODAGES,
  MODES_D_IMPORT,
  NATURES_D_IMPORT,
  NATURE_PAR_DEFAUT,
  SEPARATEURS,
  SORTES_DE_MESSAGE,
  apercevoirSelon,
  avecEntetesDeLaGrille,
  comptesDuRapport,
  messageDuBloc,
  modesDImport,
  modeleApercu,
  modeleATelecharger,
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

  test('onze colonnes : les neuf champs de l’export, la huitième celle des étiquettes, la neuvième celle de la présence, puis deux en-têtes vides, listés non reconnus', () => {
    const rangee = (nom) =>
      [nom, 'Iris', 'Grisaille', 'iris@exemple.test', 'animation', 'non', 'note', 'finance|Montréal', 'tours 2 et 3', 'x1', 'x2'].join(TAB);
    const texte = lignes(rangee('Ombrelle'), rangee('Lacasse'));
    const sans = apercevoir(texte);
    assert.equal(sans.refusGlobal, 'AUCUN_ENTETE');
    assert.equal(sans.entetes.length, 11);
    const avec = avecEntetesDeLaGrille(texte, sans);
    assert.equal(avec.split('\n')[0], [...CHAMPS, '', ''].join(TAB));
    const lu = apercevoir(avec, { tours: 4 });
    assert.equal(lu.refusGlobal, null);
    assert.equal(CHAMPS.length, 9);
    assert.equal(CHAMPS[7], 'etiquettes');
    assert.equal(CHAMPS[8], 'presence');
    assert.deepEqual(lu.association.colonnes, Object.fromEntries(CHAMPS.map((champ, rang) => [champ, rang])));
    assert.deepEqual(lu.association.nonReconnues, [9, 10]);
    assert.deepEqual(nomsLus(lu), ['Ombrelle', 'Lacasse']);
    assert.deepEqual(lu.lignes.map(({ champs }) => champs.etiquettes), [['finance', 'Montréal'], ['finance', 'Montréal']]);
    assert.deepEqual(lu.lignes.map(({ champs }) => champs.presence), [[2, 3], [2, 3]]);
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
    const texte = lignes(CHAMPS.join(';'), ['Ombrelle', 'Iris', 'Grisaille', 'i@exemple.test', 'x', 'non', 'n', 'finance', 'tous'].join(';'));
    const { colonnes } = modeleApercu({ encodage: 'utf-8', apercu: apercevoir(texte) });
    assert.equal(colonnes.length, 9);
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
  test('chaque ligne valide montre ses neuf champs dans l’ordre de CHAMPS ; exclu par sa clé, vide sans valeur ; les étiquettes une à une, chacune sa pastille', () => {
    const texte = lignes(
      'notes;exclu;nom;prenom;mots-clés',
      'arrive tard;Oui;Ombrelle;Iris;',
      ';;Pervenche;;finance|Montréal',
      ';0;Lacasse;Ondine;',
    );
    const { lignes: lues } = modeleApercu({ encodage: 'utf-8', apercu: apercevoir(texte) });
    assert.equal(lues.length, 3);
    assert.deepEqual(lues.map(({ ligne }) => ligne), [2, 3, 4]);
    for (const { cellules } of lues) assert.deepEqual(cellules.map(({ champ }) => champ), [...CHAMPS]);
    assert.deepEqual(COLONNES_DES_LIGNES.map(({ champ }) => champ), [...CHAMPS]);
    for (const { cle } of COLONNES_DES_LIGNES) assert.ok(t(cle).length > 0, cle);
    const [premiere, deuxieme, troisieme] = lues;
    assert.deepEqual(premiere.cellules.map(({ texte: valeur }) => valeur), ['Ombrelle', 'Iris', null, null, null, null, 'arrive tard', null, null]);
    assert.deepEqual(deuxieme.cellules.at(-2), { champ: 'etiquettes', texte: null, cle: null, etiquettes: ['finance', 'Montréal'], details: null });
    assert.deepEqual(premiere.cellules.at(-2), { champ: 'etiquettes', texte: null, cle: null, etiquettes: [], details: null });
    assert.deepEqual(premiere.cellules.at(-1), { champ: 'presence', texte: null, cle: null, etiquettes: null, details: null });
    for (const { champ, etiquettes } of premiere.cellules.filter(({ champ: nom }) => nom !== 'etiquettes')) assert.equal(etiquettes, null, champ);
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

describe('messageDuBloc : chaque message de l’aperçu et du rapport classé en refus, avis ou information', () => {
  test('les refus : le refus global et les lignes refusées', () => {
    for (const bloc of ['global', 'refusees']) {
      assert.deepEqual(messageDuBloc(bloc), { sorte: 'refus', cle: 'import.sorte.refus', icone: 'interdit' }, bloc);
    }
  });

  test('les avis : les doublons et les homonymes, que rien ne fusionne seul, et les cellules sur plusieurs lignes qui portent le séparateur, à vérifier', () => {
    for (const bloc of ['doublons', 'homonymes', 'multilignes']) {
      assert.deepEqual(messageDuBloc(bloc), { sorte: 'avis', cle: 'import.sorte.avis', icone: 'triangle' }, bloc);
    }
  });

  test('les informations : les orthographes fondues, d’appartenance ou d’étiquette, un import qui n’a rien écrit', () => {
    for (const bloc of ['fusions', 'fusionsEtiquettes', 'rienEcrit']) {
      assert.deepEqual(messageDuBloc(bloc), { sorte: 'information', cle: 'import.sorte.information', icone: 'information' }, bloc);
    }
  });

  test('un bloc inconnu lève RangeError, en le nommant', () => {
    assert.throws(() => messageDuBloc('fusion'), { name: 'RangeError', message: /"fusion"/ });
  });

  test('trois sortes, chacune un ton de pastille, un libellé traduit et une icône distincte', () => {
    assert.deepEqual(SORTES_DE_MESSAGE, ['refus', 'avis', 'information']);
    const blocs = ['global', 'refusees', 'doublons', 'homonymes', 'fusions', 'fusionsEtiquettes', 'multilignes', 'rienEcrit'].map(messageDuBloc);
    assert.equal(new Set(blocs.map(({ icone }) => icone)).size, 3);
    assert.deepEqual(
      SORTES_DE_MESSAGE.map((sorte) => t(`import.sorte.${sorte}`)),
      ['Refus', 'Avis', 'Information'],
    );
  });
});

// --- La nature du fichier, les objectifs de table, les étiquettes (§ 10.1, § 10.4) ---

// Une charge de deux tours et de neuf tables, numérotées 1, 2, 3, 3, puis 4
// à 8 : deux tables portent le numéro 3. Les personnes données, sans
// étiquette par défaut.
function chargeDesObjectifs({ participants = [], tables = null } = {}) {
  const charge = creerCharge({ id: 'epreuve-objectifs', nom: 'Soirée des Merles', siegesParDefaut: 6, tours: 2 });
  const numeros = [1, 2, 3, 3, 4, 5, 6, 7, 8];
  charge.tables = tables ?? numeros.map((numero, rang) => ({ id: rang + 1, numero, sieges: null, forme: 'ronde', position: { x: 0, y: 0 } }));
  charge.participants = participants;
  charge.prochainsIds = { participant: participants.length + 1, table: charge.tables.length + 1, proposition: 1 };
  return charge;
}

// Une personne d'épreuve, ses étiquettes données.
const porteuse = (id, nom, etiquettes) => ({
  id, nom, prenom: null, appartenance: null, courriel: null, titrePressenti: null, notes: null, exclu: false, etiquettes,
});

// Le CSV des objectifs qui refuse une ligne pour chaque motif du § 10.4,
// dans l'ordre du texte : [ligne, code]. Huit lignes valides de remplissage
// précèdent le champ en trop, que l'analyse du séparateur ne lit qu'au-delà
// de ses vingt premiers enregistrements. La ligne 15 écrit « FINANCE », que
// la réconciliation fond dans « finance ».
const VINGT_ET_UNE = Array.from({ length: 21 }, (_, rang) => `mot${rang + 1}`).join('|');
const TEXTE_DES_MOTIFS = lignes(
  'table;tour;objectif;regle',
  '1;;finance;',
  ';;finance;',
  'un;;finance;',
  '9;;finance;',
  '3;;finance;',
  '2;2.0;finance;',
  '2;5;finance;',
  '2;1;;ou',
  `2;1;${'x'.repeat(41)};`,
  `2;1;${VINGT_ET_UNE};`,
  '2;1;finance;peut-être',
  '1;;Finance;et',
  '2;2;FINANCE;toutes',
  '4;;bénévole;ou',
  '4;1;bénévole;',
  '4;2;bénévole;',
  '5;;bénévole;',
  '5;1;bénévole;',
  '5;2;bénévole;',
  '6;;bénévole;',
  '6;1;bénévole;une',
  '1;1;finance;;en trop',
);
const MOTIFS_ATTENDUS = [
  [3, 'TABLE_ABSENTE'],
  [4, 'TABLE_NON_ENTIERE'],
  [5, 'NUMERO_TABLE_INCONNU'],
  [6, 'PLUSIEURS_TABLES'],
  [7, 'TOUR_NON_ENTIER'],
  [8, 'TOUR_HORS_SOIREE'],
  [9, 'OBJECTIF_VIDE'],
  [10, 'ETIQUETTE_MAL_FORMEE'],
  [11, 'ETIQUETTES_TROP_NOMBREUSES'],
  [12, 'REGLE_INCONNUE'],
  [13, 'OBJECTIF_EN_DOUBLE'],
  [23, 'CHAMPS_EN_TROP'],
];

describe('la nature du fichier : choisie par l’opérateur, jamais devinée (§ 10.4)', () => {
  test('deux natures, Participants d’abord et par défaut, chacune nommée par sa clé', () => {
    assert.deepEqual(NATURES_D_IMPORT.map(({ nature }) => nature), ['participants', 'objectifs']);
    assert.equal(NATURE_PAR_DEFAUT, 'participants');
    assert.deepEqual(NATURES_D_IMPORT.map(({ cle }) => t(cle)), ['Participants', 'Objectifs de table']);
  });

  test('l’en-tête d’un fichier d’objectifs lu sous Participants : l’aperçu des participants, refusé faute d’en-tête reconnu, jamais celui des objectifs', () => {
    const charge = chargeDesObjectifs();
    const texte = lignes('table;tour;objectif;regle', '1;;finance;');
    const lu = apercevoirSelon('participants', texte, charge);
    assert.equal(lu.refusGlobal, 'AUCUN_ENTETE');
    assert.deepEqual(lu, apercevoir(texte, { participants: charge.participants, tables: charge.tables, tours: charge.evenement.tours }));
    const objectifs = apercevoirSelon('objectifs', texte, charge);
    assert.equal(objectifs.refusGlobal, null);
    assert.deepEqual(objectifs, apercevoirObjectifs(texte, charge));
  });

  test('une liste de participants qui porte une colonne « Table » lue sous Objectifs : l’aperçu des objectifs, refusé faute d’objectif ; sous Participants, la table ignorée', () => {
    const charge = chargeDesObjectifs();
    const texte = lignes('nom;prenom;table', 'Ombrelle;Iris;2', 'Pervenche;Théo;1');
    assert.equal(apercevoirSelon('objectifs', texte, charge).refusGlobal, 'OBJECTIF_NON_ASSOCIE');
    const lu = apercevoirSelon('participants', texte, charge);
    assert.equal(lu.refusGlobal, null);
    assert.deepEqual(nomsLus(lu), ['Ombrelle', 'Pervenche']);
    assert.deepEqual(lu.association.nonReconnues, [2]);
  });

  test('le choix des colonnes et le mode passent à l’aperçu de la nature ; une nature inconnue lève', () => {
    const charge = chargeDesObjectifs();
    const texte = lignes('table;objectif;objectifs', '1;finance;bénévole');
    const ambigu = apercevoirSelon('objectifs', texte, charge, { mode: 'remplacer' });
    assert.equal(ambigu.mode, 'remplacer');
    assert.deepEqual(ambigu.association.ambigus, [{ champ: 'objectif', rangs: [1, 2] }]);
    const tranche = apercevoirSelon('objectifs', texte, charge, { choix: { objectif: 2 }, mode: 'remplacer' });
    assert.deepEqual(tranche.lignes.map(({ champs }) => champs.etiquettes), [['bénévole']]);
    assert.equal(apercevoirSelon('participants', lignes('nom', 'Ombrelle'), charge, { mode: 'remplacer' }).mode, 'remplacer');
    assert.throws(() => apercevoirSelon('tables', texte, charge), { name: 'RangeError', message: /"tables"/ });
  });

  test('les modes de chaque nature : trois pour les participants, Mettre à jour puis Remplacer pour les objectifs, que l’aperçu accepte', () => {
    assert.equal(modesDImport('participants'), MODES_D_IMPORT);
    assert.deepEqual(modesDImport('objectifs').map(({ mode }) => mode), ['mettreAJour', 'remplacer']);
    const charge = chargeDesObjectifs();
    for (const { mode, cle } of modesDImport('objectifs')) {
      assert.ok(t(cle).length > 0, cle);
      assert.equal(apercevoirObjectifs(lignes('table;objectif', '1;finance'), charge, { mode }).mode, mode);
    }
    assert.throws(() => modesDImport('tables'), RangeError);
  });

  test('le mode proposé des objectifs : Mettre à jour, que la liste soit vide ou non ; jamais Remplacer', () => {
    assert.equal(modePropose([], 'objectifs'), 'mettreAJour');
    assert.equal(modePropose([{ id: 1, nom: 'Ombrelle' }], 'objectifs'), 'mettreAJour');
    assert.equal(modePropose([], 'participants'), 'ajouter');
  });
});

describe('modeleApercu des objectifs de table (§ 10.4)', () => {
  test('les colonnes, les quatre champs dans l’ordre de l’export, chacun sa clé ; les lignes : numéro, soirée ou tour, étiquettes une à une, règle nommée', () => {
    const charge = chargeDesObjectifs();
    const texte = lignes('Règle;Objectif;Tour;Table;Salle', ';finance|Montréal;;1;A', 'toutes;bénévole;2;2;B', 'ou;finance;1;4;C');
    const modele = modeleApercu({ nature: 'objectifs', encodage: 'utf-8', apercu: apercevoirObjectifs(texte, charge) });
    assert.equal(modele.global, null);
    assert.deepEqual(modele.colonnes.map(({ entete, cle }) => [entete, cle]), [
      ['Règle', 'import.champ.regle'],
      ['Objectif', 'import.champ.objectif'],
      ['Tour', 'import.champ.tour'],
      ['Table', 'import.champ.table'],
      ['Salle', 'import.colonne.nonReconnue'],
    ]);
    assert.equal(modele.champs, COLONNES_DES_OBJECTIFS);
    assert.deepEqual(COLONNES_DES_OBJECTIFS.map(({ champ }) => champ), [...CHAMPS_OBJECTIFS]);
    for (const { cle } of COLONNES_DES_OBJECTIFS) assert.ok(t(cle).length > 0, cle);
    assert.equal(modele.valides, 3);
    assert.deepEqual(modele.lignes, [
      {
        ligne: 2,
        cellules: [
          { champ: 'table', texte: '1', cle: null, etiquettes: null, details: null },
          { champ: 'tour', texte: null, cle: 'import.tour.soiree', etiquettes: null, details: null },
          { champ: 'objectif', texte: null, cle: null, etiquettes: ['finance', 'Montréal'], details: null },
          { champ: 'regle', texte: null, cle: 'import.regle.defaut', etiquettes: null, details: null },
        ],
      },
      {
        ligne: 3,
        cellules: [
          { champ: 'table', texte: '2', cle: null, etiquettes: null, details: null },
          { champ: 'tour', texte: '2', cle: null, etiquettes: null, details: null },
          { champ: 'objectif', texte: null, cle: null, etiquettes: ['bénévole'], details: null },
          { champ: 'regle', texte: null, cle: 'import.regle.et', etiquettes: null, details: null },
        ],
      },
      {
        ligne: 4,
        cellules: [
          { champ: 'table', texte: '4', cle: null, etiquettes: null, details: null },
          { champ: 'tour', texte: '1', cle: null, etiquettes: null, details: null },
          { champ: 'objectif', texte: null, cle: null, etiquettes: ['finance'], details: null },
          { champ: 'regle', texte: null, cle: 'import.regle.ou', etiquettes: null, details: null },
        ],
      },
    ]);
    for (const cle of ['import.tour.soiree', 'import.regle.defaut', 'import.regle.ou', 'import.regle.et']) assert.ok(t(cle).length > 0, cle);
    for (const liste of ['fusions', 'doublons', 'homonymes']) assert.deepEqual(modele[liste], [], liste);
    assert.equal(modeleApercu({ encodage: 'utf-8', apercu: apercevoir(lignes('nom', 'Ombrelle')) }).champs, COLONNES_DES_LIGNES);
  });

  test('un refus de chaque motif du § 10.4, dans l’ordre du texte, chacun un motif traduit qui nomme sa cause', () => {
    const modele = modeleApercu({ nature: 'objectifs', encodage: 'utf-8', apercu: apercevoirObjectifs(TEXTE_DES_MOTIFS, chargeDesObjectifs()) });
    assert.equal(modele.global, null);
    assert.deepEqual(modele.refusees.map(({ ligne, code }) => [ligne, code]), MOTIFS_ATTENDUS);
    assert.equal(new Set(MOTIFS_ATTENDUS.map(([, code]) => code)).size, 12);
    const motif = motifLigne(t);
    const textes = modele.refusees.map(({ code, details }) => motif(code, details));
    for (const [rang, texte] of textes.entries()) assert.ok(texte.length > 0, MOTIFS_ATTENDUS[rang][1]);
    assert.equal(new Set(textes).size, 12);
    const parCode = new Map(modele.refusees.map(({ code, details }) => [code, motif(code, details)]));
    assert.match(parCode.get('NUMERO_TABLE_INCONNU'), /9/);
    assert.match(parCode.get('TOUR_HORS_SOIREE'), /2 tours/);
    assert.match(parCode.get('REGLE_INCONNUE'), /peut-être/);
    assert.match(parCode.get('OBJECTIF_EN_DOUBLE'), /ligne 2/);
    assert.match(parCode.get('ETIQUETTES_TROP_NOMBREUSES'), /21/);
  });

  test('les étiquettes fondues : un bloc à part, en information, jamais mêlé aux appartenances ; l’orthographe d’une personne de l’événement retenue', () => {
    const charge = chargeDesObjectifs({ participants: [porteuse(1, 'Ombrelle', ['Finance'])] });
    const modele = modeleApercu({ nature: 'objectifs', encodage: 'utf-8', apercu: apercevoirObjectifs(TEXTE_DES_MOTIFS, charge) });
    assert.deepEqual(modele.fusions, []);
    assert.deepEqual(modele.fusionsEtiquettes, [{ retenue: 'Finance', orthographes: ['FINANCE', 'Finance', 'finance'], lignes: 2 }]);
    assert.deepEqual(modele.lignes.find(({ ligne }) => ligne === 2).cellules[2].etiquettes, ['Finance']);
  });

  test('participants : appartenances et étiquettes fondues, chacune dans son bloc', () => {
    const existants = [{ ...porteuse(4, 'Ombrelle', ['bénévole']), prenom: 'Iris', appartenance: 'Coopérative Bleue' }];
    const texte = lignes(
      'nom;prenom;appartenance;etiquettes',
      'Pervenche;Théo;cooperative  bleue;Bénévole|finance',
      'Lacasse;Ondine;Grisaille;FINANCE',
    );
    const modele = modeleApercu({ encodage: 'utf-8', apercu: apercevoir(texte, { participants: existants }) });
    assert.deepEqual(modele.fusions.map(({ affichee }) => affichee), ['Coopérative Bleue']);
    assert.deepEqual(modele.fusionsEtiquettes, [
      { retenue: 'FINANCE', orthographes: ['FINANCE', 'finance'], lignes: 1 },
      { retenue: 'bénévole', orthographes: ['Bénévole', 'bénévole'], lignes: 1 },
    ]);
    for (const { affichee } of modele.fusions) assert.ok(!modele.fusionsEtiquettes.some(({ retenue }) => retenue === affichee));
    const sansFusion = modeleApercu({ encodage: 'utf-8', apercu: apercevoir(lignes('nom;etiquettes', 'Ombrelle;finance')) });
    assert.deepEqual(sansFusion.fusionsEtiquettes, []);
  });

  test('chaque refus global des objectifs : la clé de sa cause, celle de son remède ; un événement sans table mène à la section des tables', () => {
    const avecTables = chargeDesObjectifs();
    const sansTable = chargeDesObjectifs({ tables: [] });
    const cas = [
      ['CARACTERE_NUL', apercevoirObjectifs('table;objectif\n1;finance\u{0}\n', avecTables), 'import.remede.caractereNulCollage'],
      ['AUCUN_ENTETE', apercevoirObjectifs(lignes('a;b', '1;finance'), avecTables), 'import.remede.aucunEnteteObjectifs'],
      ['TABLE_NON_ASSOCIEE', apercevoirObjectifs(lignes('tour;objectif', '1;finance'), avecTables), 'import.remede.tableNonAssociee'],
      ['OBJECTIF_NON_ASSOCIE', apercevoirObjectifs(lignes('table;tour', '1;1'), avecTables), 'import.remede.objectifNonAssocie'],
      ['AUCUNE_LIGNE_VALIDE', apercevoirObjectifs(lignes('table;objectif', '9;finance'), avecTables), 'import.remede.aucuneLigneValide'],
      ['GUILLEMET_OUVERT', apercevoirObjectifs(lignes('table;objectif', '"1;finance'), avecTables), 'import.remede.guillemetOuvert'],
      [
        'SEPARATEUR_INTROUVABLE',
        apercevoirObjectifs(lignes('table;objectif', '1;finance;x', '2'), avecTables),
        'import.remede.separateurIntrouvable',
      ],
    ];
    for (const [code, apercu, remede] of cas) {
      assert.equal(apercu.refusGlobal, code, code);
      const { global } = modeleApercu({ nature: 'objectifs', encodage: 'utf-8', apercu });
      assert.equal(global.cle, code, code);
      assert.deepEqual(global.remede, { cle: remede, details: global.details, dansLaCause: false, geste: null }, code);
      assert.ok(t(global.remede.cle, global.remede.details).length > 0, code);
      assert.ok(t(global.cle, global.details).length > 0, code);
    }
    const apercu = apercevoirObjectifs(lignes('table;objectif', '1;finance'), sansTable);
    assert.equal(apercu.refusGlobal, 'OBJECTIFS_SANS_TABLE');
    const { global } = modeleApercu({ nature: 'objectifs', encodage: 'utf-8', apercu });
    assert.deepEqual(global, {
      cle: 'OBJECTIFS_SANS_TABLE',
      details: {},
      remede: { cle: null, details: {}, dansLaCause: true, geste: { geste: 'ouvrirSection', section: 'tables' } },
    });
    assert.ok(t(global.cle).length > 0);
  });

  test('un collage sous Objectifs : la lecture dans l’ordre de la grille ne s’offre pas, et le remède ne la nomme pas', () => {
    const charge = chargeDesObjectifs();
    const texte = lignes('1;finance', '2;bénévole');
    const apercu = apercevoirObjectifs(texte, charge);
    assert.equal(apercu.refusGlobal, 'AUCUN_ENTETE');
    assert.equal(avecEntetesDeLaGrille(texte, apercu, 'objectifs'), null);
    assert.equal(modeleApercu({ nature: 'objectifs', apercu }).global.remede.cle, 'import.remede.aucunEnteteObjectifs');
    const participants = apercevoir(texte);
    assert.notEqual(avecEntetesDeLaGrille(texte, participants), null);
  });

  test('une nature inconnue lève, jamais un modèle deviné', () => {
    assert.throws(() => modeleApercu({ nature: 'tables', apercu: apercevoir(lignes('nom', 'Ombrelle')) }), RangeError);
  });
});

describe('le rapport et la fenêtre de « Remplacer » selon la nature', () => {
  test('les comptes du rapport : ceux du résumé de chaque import, chacun une clé qui s’accorde au nombre', () => {
    assert.deepEqual(comptesDuRapport('participants').map(({ nom }) => nom), ['ajoutes', 'misAJour', 'inchanges', 'retires', 'reservationsRetirees']);
    assert.deepEqual(comptesDuRapport('objectifs').map(({ nom }) => nom), ['ajoutes', 'remplaces', 'inchanges', 'retires', 'tables']);
    for (const nature of ['participants', 'objectifs']) {
      for (const { nom, cle } of comptesDuRapport(nature)) {
        assert.notEqual(t(cle, { n: 1 }), t(cle, { n: 2 }), `${nature} ${nom}`);
      }
    }
    assert.match(t('import.rapport.objectifsAjoutes', { n: 2 }), /objectifs ajoutés/);
    assert.match(t('import.rapport.tablesTouchees', { n: 1 }), /table/);
    assert.throws(() => comptesDuRapport('tables'), RangeError);
  });

  test('remplacer des objectifs annonce les deux comptes de bilanRemplacementObjectifs, accordés', () => {
    assert.equal(t('import.remplacer.objectifs', { n: 3 }), '3 objectifs de table seront supprimés');
    assert.equal(t('import.remplacer.objectifs', { n: 1 }), '1 objectif de table sera supprimé');
    assert.equal(t('import.remplacer.tables', { n: 2 }), '2 tables perdront leurs objectifs');
    assert.equal(t('import.remplacer.tables', { n: 1 }), '1 table perdra ses objectifs');
    assert.ok(t('import.remplacer.titreObjectifs').length > 0);
  });
});

describe('le modèle à télécharger de chaque nature (§ 10.1, § 10.4)', () => {
  test('chaque nature porte la clé du nom accessible de sa commande, qui nomme la nature après le libellé visible', () => {
    const visible = t('import.commande.telechargerModele');
    assert.equal(visible, 'Télécharger un modèle');
    const noms = NATURES_D_IMPORT.map(({ modele }) => t(modele));
    assert.deepEqual(noms, ['Télécharger un modèle de liste de participants', "Télécharger un modèle d'objectifs de table"]);
    for (const nom of noms) assert.ok(nom.startsWith(visible), nom);
    assert.ok(t('import.modele.enregistre').length > 0);
  });

  test('Participants : le modèle de l’événement, sous modele-participants.csv ; sa présence suit le nombre de tours', () => {
    const charge = chargeDesObjectifs();
    const { nom, octets } = modeleATelecharger('participants', { base: 'soiree', charge });
    assert.equal(nom, 'modele-participants.csv');
    assert.deepEqual(octets, modeleParticipants(charge));
    const quatre = chargeDesObjectifs();
    quatre.evenement.tours = 4;
    const deQuatre = modeleATelecharger('participants', { base: 'soiree', charge: quatre }).octets;
    assert.deepEqual(deQuatre, modeleParticipants(quatre));
    assert.notDeepEqual(deQuatre, octets);
    assert.match(decoder(deQuatre).texte, /;1-3\r$/m);
  });

  test('Objectifs de table : le modèle de l’événement ouvert, sous ‹base›-modele-objectifs.csv', () => {
    const charge = chargeDesObjectifs();
    const { nom, octets } = modeleATelecharger('objectifs', { base: 'soiree', charge });
    assert.equal(nom, 'soiree-modele-objectifs.csv');
    assert.deepEqual(octets, modeleObjectifs(charge));
  });

  test('un événement sans table, ou dont chaque numéro est partagé, refuse le modèle des objectifs, jamais celui des participants ; une nature inconnue lève', () => {
    const charge = chargeDesObjectifs({ tables: [] });
    assert.throws(() => modeleATelecharger('objectifs', { base: 'soiree', charge }), { code: 'OBJECTIFS_SANS_TABLE' });
    const partages = chargeDesObjectifs();
    for (const table of partages.tables) table.numero = 7;
    assert.throws(() => modeleATelecharger('objectifs', { base: 'soiree', charge: partages }), { code: 'OBJECTIFS_NUMEROS_PARTAGES' });
    assert.equal(modeleATelecharger('participants', { base: 'soiree', charge: partages }).nom, 'modele-participants.csv');
    assert.equal(modeleATelecharger('participants', { base: 'soiree', charge }).nom, 'modele-participants.csv');
    assert.throws(() => modeleATelecharger('tables', { base: 'soiree', charge }), RangeError);
  });
});

describe('la cellule de la présence (§ 10.1)', () => {
  const texte = lignes('nom;présence', 'Ombrelle;', 'Pervenche;tous', 'Lacasse;2-4', 'Sarcelle;3, 1');

  // La cellule de la présence de chaque ligne valide.
  const cellulesDePresence = (modele) => modele.lignes.map(({ cellules }) => cellules.find(({ champ }) => champ === 'presence'));

  test('à la création : vide pour une cellule vide, « tous les tours » pour 1..R, les tours nommés sinon, par leurs détails', () => {
    const modele = modeleApercu({ encodage: 'utf-8', apercu: apercevoir(texte, { tours: 4 }) });
    assert.deepEqual(cellulesDePresence(modele), [
      { champ: 'presence', texte: null, cle: null, etiquettes: null, details: null },
      { champ: 'presence', texte: null, cle: 'import.presence.tous', etiquettes: null, details: null },
      { champ: 'presence', texte: null, cle: 'import.presence.tours', etiquettes: null, details: { tours: [2, 3, 4] } },
      { champ: 'presence', texte: null, cle: 'import.presence.tours', etiquettes: null, details: { tours: [1, 3] } },
    ]);
    const [, tous, plage, liste] = cellulesDePresence(modele);
    assert.equal(t(tous.cle, tous.details ?? {}), 'tous les tours');
    assert.equal(t(plage.cle, plage.details), 'tours 2 à 4');
    assert.equal(t(liste.cle, liste.details), 'tours 1 et 3');
    assert.equal(t('import.champ.presence'), 'présence');
  });

  test('en mise à jour, la cellule vide d’une personne existante se lit « présence inchangée » ; celle d’une ligne que l’import crée, rien', () => {
    // Ombrelle et Pervenche existent ; Sarcelle et une Ombrelle neuve non.
    const existants = [
      { id: 1, nom: 'Ombrelle', prenom: null, appartenance: null },
      { id: 2, nom: 'Pervenche', prenom: null, appartenance: null },
    ];
    const misAJour = lignes('nom;prénom;présence', 'Ombrelle;;', 'Pervenche;;tous', 'Sarcelle;;', 'Lacasse;;2-4');
    const modele = modeleApercu({
      encodage: 'utf-8', apercu: apercevoir(misAJour, { participants: existants, tours: 4, mode: 'mettreAJour' }),
    });
    const [vide, tous, creee] = cellulesDePresence(modele);
    assert.deepEqual(vide, { champ: 'presence', texte: null, cle: 'import.presence.inchangee', etiquettes: null, details: null });
    assert.equal(t(vide.cle), 'présence inchangée');
    assert.equal(tous.cle, 'import.presence.tous');
    // Sarcelle ne désigne personne : l'import la crée à tous les tours.
    assert.deepEqual(creee, { champ: 'presence', texte: null, cle: null, etiquettes: null, details: null });
    // Sans existant, chaque ligne est créée : aucune ne s'annonce inchangée.
    const sansExistant = modeleApercu({ encodage: 'utf-8', apercu: apercevoir(texte, { tours: 4, mode: 'mettreAJour' }) });
    assert.equal(cellulesDePresence(sansExistant)[0].cle, null);
    const remplace = modeleApercu({
      encodage: 'utf-8', apercu: apercevoir(misAJour, { participants: existants, tours: 4, mode: 'remplacer' }),
    });
    assert.equal(cellulesDePresence(remplace)[0].cle, null);
  });

  test('sans colonne de présence, la cellule reste vide dans chaque mode : rien ne se lit, rien ne s’annonce', () => {
    for (const mode of ['ajouter', 'mettreAJour', 'remplacer']) {
      const modele = modeleApercu({ encodage: 'utf-8', apercu: apercevoir(lignes('nom', 'Ombrelle'), { mode }) });
      assert.deepEqual(cellulesDePresence(modele), [{ champ: 'presence', texte: null, cle: null, etiquettes: null, details: null }], mode);
    }
  });

  test('apercevoirSelon lit la présence sous le nombre de tours de l’événement', () => {
    const charge = chargeDesObjectifs();
    const lu = apercevoirSelon('participants', lignes('nom;presence', 'Ombrelle;2', 'Pervenche;3'), charge);
    assert.equal(lu.tours, 2);
    assert.deepEqual(lu.lignes.map(({ champs }) => champs.presence), [[2]]);
    assert.deepEqual(lu.refusees.map(({ code, tour, tours }) => [code, tour, tours]), [['PRESENCE_HORS_TOURS', 3, 2]]);
    assert.equal(apercevoirSelon('participants', lignes('nom', 'Ombrelle'), charge, { mode: 'mettreAJour' }).tours, 2);
  });
});
