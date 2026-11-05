// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du CSV des objectifs de table (§ 10.4, A19, A20, A21) : la table
// des en-têtes et son association, l'aperçu et ses refus globaux, les refus
// d'une ligne dans l'ordre de A20, la règle lue dans sa liste fermée, la
// réconciliation des étiquettes, l'import appliqué selon le mode, l'export
// et l'aller-retour, le fichier d'exemple et la boucle de son CSV des refus,
// la ligne à remplir, que l'import passe, et le modèle à télécharger.
// Les noms, les étiquettes et les événements sont inventés.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from '../../test/lanceur.js';
import { serialiser } from '../stockage/canonique.js';
import { analyser, creerCharge } from '../stockage/document.js';
import { estFigee, gelerPropositions } from '../stockage/gel.js';
import { ETIQUETTES_MAX, ETIQUETTE_LONGUEUR_MAX } from '../stockage/etiquettes.js';
import { VERSION } from '../version.genere.js';
import { decoder } from './encodage.js';
import { ErreurCsv } from './erreurs.js';
import { JOINTURE_ETIQUETTES } from './export.js';
import { exporterRefus } from './import.js';
import { decouper } from './lecture.js';
import {
  CHAMPS_OBJECTIFS,
  ENTETES_DES_OBJECTIFS,
  MODES_IMPORT_OBJECTIFS,
  VALEURS_REGLE,
  apercevoirObjectifs,
  appliquerImportObjectifs,
  associerObjectifs,
  bilanRemplacementObjectifs,
  exporterObjectifs,
  modeleObjectifs,
  reconnaitreObjectif,
} from './objectifs.js';

const EXEMPLES = new URL('../../exemples/', import.meta.url);
const MARQUE = '\u{FEFF}';
const TAB = '\u{0009}';

// Texte d'un CSV : chaque ligne donnée, terminée par CRLF.
const csv = (...lignes) => lignes.map((ligne) => `${ligne}\r\n`).join('');

// Texte des octets, la marque d'ordre d'octets gardée en tête.
const texteDe = (octets) => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(octets);

const personne = (id, nom, prenom, autres = {}) => ({
  id, nom, prenom, organisation: null, courriel: null, titrePressenti: null, notes: null, exclu: false, ...autres,
});

const table = (id, numero, autres = {}) => ({ id, numero, sieges: null, forme: 'ronde', position: { x: 200 * id, y: 0 }, ...autres });

// Un événement inventé de quatre tours : trois personnes, l'une exclue, et
// trois tables numérotées 1, 2 et 3, sans objectif.
function evenement() {
  const charge = creerCharge({ id: 'evt-herons', nom: 'Soirée des Hérons', siegesParDefaut: 4, tours: 4 });
  charge.prochainsIds = { participant: 4, table: 4, proposition: 1 };
  charge.participants = [
    personne(1, 'Ombrelle', 'Iris', { etiquettes: ['finance'] }),
    personne(2, 'Pervenche', 'Théo', { etiquettes: ['Montréal', 'bénévole'] }),
    personne(3, 'Lacasse', 'Ondine', { exclu: true, etiquettes: ['ressources humaines'] }),
  ];
  charge.tables = [table(1, 1), table(2, 2), table(3, 3)];
  return charge;
}

// L'événement dont les tables portent des objectifs : la table 1 un
// objectif de soirée et un du tour 2, la table 3 un du tour 3, règle propre.
function avecObjectifs() {
  const charge = evenement();
  charge.tables[0].objectifs = [
    { portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] },
    { portee: 'tour', tour: 2, regle: 'et', etiquettes: ['Montréal', 'bénévole'] },
  ];
  charge.tables[2].objectifs = [{ portee: 'tour', tour: 3, regle: 'ou', etiquettes: ['Vélo'] }];
  return charge;
}

// L'événement aux objectifs, deux propositions inventées en plus : chacune
// assied les deux personnes déclarées à la table 1, à chaque tour.
function avecPropositions() {
  const charge = avecObjectifs();
  const proposition = (id) => ({
    id, graine: 7 + id, arret: 40, historique: 1000, produitVersion: VERSION.affichee, siegesAttribues: false,
    tables: [1, 2, 3], capacites: [4, 4, 4], tours: 4, participants: [1, 2],
    placement: Array.from({ length: 4 }, () => ({ sieges: [[1, 2], [], []], reserve: [] })),
  });
  charge.propositions = [proposition(1), proposition(2)];
  charge.prochainsIds.proposition = 3;
  charge.evenement.etat = 'propose';
  return charge;
}

// Les objets que valeur atteint, elle comprise, tels que JSON.stringify les
// parcourt.
function objetsDe(valeur) {
  const vus = new Set();
  JSON.stringify(valeur, (_, v) => {
    if (typeof v === 'object' && v !== null) vus.add(v);
    return v;
  });
  return vus;
}

// La charge relue par le schéma du fichier d'état : elle s'écrit et se relit.
const relue = (charge) => analyser(serialiser(charge, { revision: 1, produitVersion: VERSION.affichee })).charge;

// Les codes des lignes refusées, avec leur rang.
const refus = (apercu) => apercu.refusees.map(({ ligne, code }) => [ligne, code]);

// Le refus d'une seule ligne de données sous l'en-tête donné, sans brut.
function refusDe(ligne, { entete = 'table;tour;objectif;regle', charge = evenement() } = {}) {
  const apercu = apercevoirObjectifs(csv(entete, ligne), charge);
  assert.equal(apercu.refusGlobal, 'AUCUNE_LIGNE_VALIDE', ligne);
  assert.equal(apercu.refusees.length, 1, ligne);
  const [{ brut, ...reste }] = apercu.refusees;
  assert.ok(Array.isArray(brut));
  return reste;
}

// Les champs lus d'une seule ligne valide.
function champsDe(ligne, { entete = 'table;tour;objectif;regle', charge = evenement(), mode } = {}) {
  const apercu = apercevoirObjectifs(csv(entete, ligne), charge, { mode });
  assert.equal(apercu.refusGlobal, null, ligne);
  assert.deepEqual(apercu.refusees, [], ligne);
  return apercu.lignes[0].champs;
}

const lireExemple = () => decoder(readFileSync(new URL('objectifs_cas_limites.csv', EXEMPLES))).texte;

describe('objectifs : la table des en-têtes (§ 10.4)', () => {
  test('quatre colonnes, dans l’ordre de l’export : table, tour, objectif, regle, figées à toute profondeur', () => {
    assert.deepEqual(CHAMPS_OBJECTIFS, ['table', 'tour', 'objectif', 'regle']);
    assert.ok(Object.isFrozen(CHAMPS_OBJECTIFS));
    assert.deepEqual(
      ENTETES_DES_OBJECTIFS.map(([champ, entetes]) => [champ, [...entetes]]),
      [
        ['table', ['table']],
        ['tour', ['tour']],
        ['objectif', ['objectif', 'objectifs']],
        ['regle', ['regle', 'règle']],
      ],
    );
    assert.ok(Object.isFrozen(ENTETES_DES_OBJECTIFS));
    for (const paire of ENTETES_DES_OBJECTIFS) {
      assert.ok(Object.isFrozen(paire) && Object.isFrozen(paire[1]), paire[0]);
    }
  });

  test('chaque en-tête sans égard à la casse, aux accents ni aux espaces ; ceux des participants, ligne et motif restent inconnus', () => {
    assert.deepEqual(
      ['Table', 'TOUR', 'Objectif', 'objectifs', 'Règle', 'REGLE', ' r è g l e '].map(reconnaitreObjectif),
      ['table', 'tour', 'objectif', 'objectif', 'regle', 'regle', 'regle'],
    );
    assert.deepEqual(
      ['nom', 'etiquettes', 'étiquette', 'ligne', 'motif', 'numero', 'tables', ''].map(reconnaitreObjectif),
      [null, null, null, null, null, null, null, null],
    );
  });

  test('objectif et objectifs ensemble : une ambiguïté, que le choix tranche', () => {
    assert.deepEqual(associerObjectifs(['table', 'objectif', 'objectifs']), {
      colonnes: { table: 0 },
      ambigus: [{ champ: 'objectif', rangs: [1, 2] }],
      nonReconnues: [],
    });
    assert.deepEqual(associerObjectifs(['Règle', 'objectifs', 'Table', 'notes']), {
      colonnes: { table: 2, objectif: 1, regle: 0 },
      ambigus: [],
      nonReconnues: [3],
    });
  });

  test('la règle, liste fermée : ou, une, au moins une ; et, toutes ; vide suit le défaut', () => {
    assert.deepEqual([...VALEURS_REGLE], [
      ['ou', 'ou'],
      ['une', 'ou'],
      ['au moins une', 'ou'],
      ['et', 'et'],
      ['toutes', 'et'],
      ['', null],
    ]);
    assert.deepEqual([...MODES_IMPORT_OBJECTIFS], ['mettreAJour', 'remplacer']);
  });
});

describe('objectifs : les refus globaux de l’aperçu (§ 10.1, § 10.4)', () => {
  test('les refus du § 10.1 hors NOM_NON_ASSOCIE, chacun sans ligne ni fusion, le mode gardé', () => {
    const cas = [
      ['table;objectif\r\n1;fin\u{0000}ance\r\n', 'CARACTERE_NUL', null],
      ['', 'AUCUN_ENTETE', null],
      [csv('salle;teinte', '1;bleu'), 'AUCUN_ENTETE', null],
      [csv('nom;prenom', 'Ombrelle;Iris'), 'AUCUN_ENTETE', null],
      [csv('table;objectif', '1;finance;bénévole', '2;Montréal'), 'SEPARATEUR_INTROUVABLE', 2],
      [csv('table;objectif', '1;"finance'), 'GUILLEMET_OUVERT', 2],
      [csv('table;objectif', '9;finance'), 'AUCUNE_LIGNE_VALIDE', null],
    ];
    for (const [texte, code, ligne] of cas) {
      const apercu = apercevoirObjectifs(texte, evenement(), { mode: 'remplacer' });
      assert.equal(apercu.refusGlobal, code, JSON.stringify(texte));
      assert.equal(apercu.refusGlobalLigne, ligne, code);
      assert.equal(apercu.mode, 'remplacer');
      for (const cle of ['lignes', 'fusionsEtiquettes', 'multilignes']) assert.deepEqual(apercu[cle], [], `${code} ${cle}`);
      if (code !== 'AUCUNE_LIGNE_VALIDE') assert.deepEqual(apercu.refusees, [], code);
    }
  });

  test('aucune colonne table : TABLE_NON_ASSOCIEE ; aucune colonne objectif : OBJECTIF_NON_ASSOCIE ; la première manque d’abord', () => {
    const lire = (...lignes) => apercevoirObjectifs(csv(...lignes), evenement());
    assert.equal(lire('tour;objectif', '2;finance').refusGlobal, 'TABLE_NON_ASSOCIEE');
    assert.equal(lire('table;tour', '1;2').refusGlobal, 'OBJECTIF_NON_ASSOCIE');
    assert.equal(lire('tour;regle', '2;ou').refusGlobal, 'TABLE_NON_ASSOCIEE');
    // Une colonne ambiguë n'est associée à rien : elle manque.
    const ambigu = lire('table;objectif;objectifs', '1;finance;bénévole');
    assert.equal(ambigu.refusGlobal, 'OBJECTIF_NON_ASSOCIE');
    assert.deepEqual(ambigu.association.ambigus, [{ champ: 'objectif', rangs: [1, 2] }]);
    assert.deepEqual(ambigu.entetes, ['table', 'objectif', 'objectifs']);
    const tranche = apercevoirObjectifs(csv('table;objectif;objectifs', '1;finance;bénévole'), evenement(), { choix: { objectif: 2 } });
    assert.equal(tranche.refusGlobal, null);
    assert.deepEqual(tranche.lignes[0].champs.etiquettes, ['bénévole']);
  });

  test('un événement sans table : OBJECTIFS_SANS_TABLE, après les en-têtes ; un fichier sans colonne table le dit d’abord', () => {
    const vide = { ...evenement(), tables: [] };
    const apercu = apercevoirObjectifs(csv('table;objectif', '1;finance'), vide);
    assert.equal(apercu.refusGlobal, 'OBJECTIFS_SANS_TABLE');
    assert.equal(apercu.separateur, ';');
    assert.deepEqual(apercu.association.colonnes, { table: 0, objectif: 1 });
    assert.deepEqual(apercu.refusees, []);
    assert.equal(apercevoirObjectifs(csv('tour;objectif', '1;finance'), vide).refusGlobal, 'TABLE_NON_ASSOCIEE');
  });

  test('un fichier de participants lu comme objectifs ne passe jamais pour des objectifs', () => {
    const participants = csv('nom;prenom;table', 'Ombrelle;Iris;2');
    assert.equal(apercevoirObjectifs(participants, evenement()).refusGlobal, 'OBJECTIF_NON_ASSOCIE');
  });

  test('un texte qui n’est pas une chaîne, un mode inconnu, ajouter compris, et une charge sans tours lèvent TypeError', () => {
    assert.throws(() => apercevoirObjectifs(new Uint8Array([1]), evenement()), TypeError);
    assert.throws(() => apercevoirObjectifs(csv('table;objectif', '1;finance'), evenement(), { mode: 'ajouter' }), TypeError);
    const sansTours = { ...evenement(), evenement: { ...evenement().evenement, tours: 0 } };
    assert.throws(() => apercevoirObjectifs(csv('table;objectif', '1;finance'), sansTours), TypeError);
  });
});

describe('objectifs : les refus d’une ligne, un motif, dans l’ordre de A20 (§ 10.4)', () => {
  test('le numéro de table : absent, non entier, inconnu, ou porté par deux tables', () => {
    assert.deepEqual(refusDe(';;finance;'), { ligne: 2, code: 'TABLE_ABSENTE', valeur: null });
    for (const valeur of ['2.0', 'deux', '3b', '1 2', '+', 'Ⅱ']) {
      assert.deepEqual(refusDe(`${valeur};;finance;`), { ligne: 2, code: 'TABLE_NON_ENTIERE', valeur }, valeur);
    }
    assert.deepEqual(refusDe(' 9 ;;finance;'), { ligne: 2, code: 'NUMERO_TABLE_INCONNU', valeur: '9' });
    assert.deepEqual(refusDe('0;;finance;'), { ligne: 2, code: 'NUMERO_TABLE_INCONNU', valeur: '0' });
    const deuxTrois = evenement();
    deuxTrois.tables.push(table(4, 3));
    assert.deepEqual(refusDe('3;;finance;', { charge: deuxTrois }), { ligne: 2, code: 'PLUSIEURS_TABLES', valeur: '3' });
    // Le numéro affiché, jamais l'identifiant : la table d'identifiant 7
    // porte le numéro 2.
    const renumerotee = evenement();
    renumerotee.tables = [table(7, 2)];
    assert.deepEqual(champsDe('2;;finance;', { charge: renumerotee }), {
      numero: 2, table: 7, tour: null, regle: null, etiquettes: ['finance'],
    });
    assert.deepEqual(refusDe('7;;finance;', { charge: renumerotee }), { ligne: 2, code: 'NUMERO_TABLE_INCONNU', valeur: '7' });
    assert.equal(champsDe('02;;finance;').table, 2);
  });

  test('le tour : vide pour la soirée, non entier, ou hors de la soirée, qui nomme le nombre de tours', () => {
    assert.equal(champsDe('1;;finance;').tour, null);
    assert.equal(champsDe('1; 4 ;finance;').tour, 4);
    for (const valeur of ['2.0', 'deux', 'premier', '1,5']) {
      const entete = 'table\u{0009}tour\u{0009}objectif\u{0009}regle';
      const ligne = ['1', valeur, 'finance', ''].join(TAB);
      assert.deepEqual(refusDe(ligne, { entete }), { ligne: 2, code: 'TOUR_NON_ENTIER', valeur }, valeur);
    }
    for (const valeur of ['0', '5', '9', '-1']) {
      assert.deepEqual(refusDe(`1;${valeur};finance;`), { ligne: 2, code: 'TOUR_HORS_SOIREE', valeur, tours: 4 }, valeur);
    }
  });

  test("l'objectif : vide ou fait de séparateurs sous une règle écrite, puis une étiquette mal formée, puis une vingt-et-unième étiquette", () => {
    assert.deepEqual(refusDe('1;;;et'), { ligne: 2, code: 'OBJECTIF_VIDE', valeur: null });
    assert.deepEqual(refusDe('1;;" , | ";ou'), { ligne: 2, code: 'OBJECTIF_VIDE', valeur: null });
    assert.deepEqual(refusDe(`1;;finance, ressources${TAB}humaines;`), {
      ligne: 2, code: 'ETIQUETTE_MAL_FORMEE', valeur: `ressources${TAB}humaines`, raison: 'controle',
    });
    const longue = 'x'.repeat(ETIQUETTE_LONGUEUR_MAX + 1);
    assert.deepEqual(refusDe(`1;;${longue};`), { ligne: 2, code: 'ETIQUETTE_MAL_FORMEE', valeur: longue, raison: 'longueur' });
    const vingtEtUne = Array.from({ length: ETIQUETTES_MAX + 1 }, (_, i) => `mot${i}`).join('|');
    assert.deepEqual(refusDe(`1;;${vingtEtUne};`), {
      ligne: 2, code: 'ETIQUETTES_TROP_NOMBREUSES', valeur: null, nombre: ETIQUETTES_MAX + 1,
    });
    // Vingt clés, dont une sous deux orthographes : une seule étiquette.
    const vingt = [...Array.from({ length: ETIQUETTES_MAX }, (_, i) => `mot${i}`), 'MOT0'].join('|');
    assert.equal(champsDe(`1;;${vingt};`).etiquettes.length, ETIQUETTES_MAX);
  });

  test("la règle, sans égard à la casse, aux accents ni aux espaces ; l'inconnu refuse, jamais lu comme le défaut", () => {
    const lues = [
      ['', null], ['ou', 'ou'], ['OU', 'ou'], [' Une ', 'ou'], ['Au  moins   une', 'ou'], ['âu moins ÜNE', 'ou'],
      ['et', 'et'], ['ET', 'et'], ['Toutes', 'et'], ['TOUTÈS', 'et'],
    ];
    for (const [valeur, regle] of lues) assert.equal(champsDe(`1;;finance;${valeur}`).regle, regle, valeur);
    for (const valeur of ['peut-être', 'TOUTES LES', 'oui', 'non', 'aumoinsune', '0', '1']) {
      assert.deepEqual(refusDe(`1;;finance;${valeur}`), { ligne: 2, code: 'REGLE_INCONNUE', valeur }, valeur);
    }
    // Une colonne règle absente : chaque objectif suit le défaut.
    assert.equal(champsDe('1;finance', { entete: 'table;objectif' }).regle, null);
  });

  test("un même couple (table, tour) une deuxième fois : OBJECTIF_EN_DOUBLE, qui nomme la première ligne ; une ligne refusée n'en est pas une première", () => {
    const apercu = apercevoirObjectifs(
      csv(
        'table;tour;objectif;regle',
        '1;;finance;',
        '1;2;Montréal;',
        '1;;bénévole;',
        '2;2;finance;peut-être',
        '2;2;bénévole;',
        '1;2;finance;et',
        '01;;Montréal;',
      ),
      evenement(),
    );
    assert.deepEqual(refus(apercu), [
      [4, 'OBJECTIF_EN_DOUBLE'],
      [5, 'REGLE_INCONNUE'],
      [7, 'OBJECTIF_EN_DOUBLE'],
      [8, 'OBJECTIF_EN_DOUBLE'],
    ]);
    const details = apercu.refusees.filter(({ code }) => code === 'OBJECTIF_EN_DOUBLE').map(({ brut, ligne, code, ...reste }) => reste);
    assert.deepEqual(details, [
      { valeur: null, premiereLigne: 2, numero: 1, tour: null },
      { valeur: null, premiereLigne: 3, numero: 1, tour: 2 },
      { valeur: null, premiereLigne: 2, numero: 1, tour: null },
    ]);
    assert.deepEqual(apercu.lignes.map(({ ligne }) => ligne), [2, 3, 6]);
  });

  test("un champ en trop passe avant tout ; puis chaque ligne garde son premier motif, dans l'ordre de A20", () => {
    const apercu = apercevoirObjectifs(
      csv(
        'table;tour;objectif;regle',
        '1;2;finance;ou',
        '9;9;;peut-être',
        '1;9;;peut-être',
        '1;2;;peut-être',
        `1;2;fin${TAB}ance;peut-être`,
        '1;2;finance;peut-être',
        '1;2;finance;ou',
        '"1;2";;finance;ou',
      ),
      evenement(),
    );
    assert.deepEqual(refus(apercu), [
      [3, 'NUMERO_TABLE_INCONNU'],
      [4, 'TOUR_HORS_SOIREE'],
      [5, 'OBJECTIF_VIDE'],
      [6, 'ETIQUETTE_MAL_FORMEE'],
      [7, 'REGLE_INCONNUE'],
      [8, 'OBJECTIF_EN_DOUBLE'],
      [9, 'TABLE_NON_ENTIERE'],
    ]);
    const enTrop = apercevoirObjectifs(
      csv('table;objectif', '1;finance', '2;bénévole', ...Array(20).fill('3;Montréal'), '9;;x'),
      evenement(),
    );
    assert.deepEqual(refus(enTrop).at(-1), [24, 'CHAMPS_EN_TROP']);
  });

  test('brut garde les champs tels que découpés ; ligne compte l’en-tête, et une cellule sur deux lignes une fois', () => {
    const apercu = apercevoirObjectifs(
      csv('Table;Tour;Objectif;Règle', '1;;"finance', 'bénévole";', ' 9 ; ;Montréal; et '),
      evenement(),
    );
    assert.deepEqual(apercu.refusees, [
      { ligne: 3, code: 'NUMERO_TABLE_INCONNU', valeur: '9', brut: [' 9 ', ' ', 'Montréal', ' et '] },
    ]);
    assert.deepEqual(apercu.lignes, [
      {
        ligne: 2,
        champs: { numero: 1, table: 1, tour: null, regle: null, etiquettes: ['finance', 'bénévole'] },
        brut: ['1', '', 'finance\r\nbénévole', ''],
      },
    ]);
    assert.deepEqual(apercu.multilignes, []);
  });

  test("une cellule sur plusieurs lignes qui porte le séparateur se nomme : un guillemet égaré y fond deux lignes", () => {
    const apercu = apercevoirObjectifs(csv('table;tour;objectif;regle', '1;;"finance', '2;;bénévole";'), evenement());
    assert.equal(apercu.refusGlobal, null);
    assert.deepEqual(apercu.multilignes, [{ ligne: 2, rangs: [2] }]);
  });
});

describe('objectifs : les étiquettes se réconcilient avec celles de l’événement (§ 10.1, § 10.4)', () => {
  test('mettre à jour : les personnes, exclues comprises, et les objectifs donnent leur orthographe, et le rapport nomme chaque fusion', () => {
    const apercu = apercevoirObjectifs(
      csv('table;tour;objectif', '2;;FINANCE', '3;;vélo, Ressources Humaines', '1;;MONTREAL', '1;3;Bénévole, bénévole'),
      avecObjectifs(),
    );
    assert.deepEqual(
      apercu.lignes.map(({ champs }) => champs.etiquettes),
      [['finance'], ['Vélo', 'ressources humaines'], ['Montréal'], ['bénévole']],
    );
    assert.deepEqual(apercu.fusionsEtiquettes, [
      { retenue: 'finance', orthographes: ['FINANCE', 'finance'], lignes: 1 },
      { retenue: 'Vélo', orthographes: ['Vélo', 'vélo'], lignes: 1 },
      { retenue: 'ressources humaines', orthographes: ['Ressources Humaines', 'ressources humaines'], lignes: 1 },
      { retenue: 'Montréal', orthographes: ['MONTREAL', 'Montréal'], lignes: 1 },
      { retenue: 'bénévole', orthographes: ['Bénévole', 'bénévole'], lignes: 1 },
    ]);
  });

  test('remplacer : les objectifs partent, leurs orthographes avec eux ; celles des personnes restent', () => {
    const apercu = apercevoirObjectifs(csv('table;objectif', '3;vélo', '2;FINANCE'), avecObjectifs(), { mode: 'remplacer' });
    assert.deepEqual(apercu.lignes.map(({ champs }) => champs.etiquettes), [['vélo'], ['finance']]);
    assert.deepEqual(apercu.fusionsEtiquettes, [{ retenue: 'finance', orthographes: ['FINANCE', 'finance'], lignes: 1 }]);
    assert.equal(apercu.mode, 'remplacer');
  });
});

describe('objectifs : ce que remplacer touche, et l’import appliqué (§ 10.4)', () => {
  test("la charge et l'aperçu reçus ne sont pas modifiés, et la charge rendue n'en partage aucun objet", () => {
    for (const mode of MODES_IMPORT_OBJECTIFS) {
      const charge = avecPropositions();
      const apercu = apercevoirObjectifs(csv('table;tour;objectif;regle', '1;;finance;', '2;3;Vélo;ou'), charge, { mode });
      const avant = structuredClone({ charge, apercu });
      const { charge: rendue } = appliquerImportObjectifs(charge, apercu, mode);
      assert.deepEqual({ charge, apercu }, avant, mode);
      const recus = objetsDe({ charge, apercu });
      for (const objet of objetsDe(rendue)) assert.ok(!recus.has(objet), `${mode} : objet partagé ${JSON.stringify(objet)}`);
    }
  });

  test("les propositions figées de la charge reçue passent telles quelles dans la charge rendue, qui n'en partage rien d'autre, et la reçue s'écrit comme avant", () => {
    for (const mode of MODES_IMPORT_OBJECTIFS) {
      const charge = gelerPropositions(avecPropositions());
      const apercu = apercevoirObjectifs(csv('table;tour;objectif;regle', '1;;finance;', '2;3;Vélo;ou'), charge, { mode });
      const texte = JSON.stringify(charge);
      const { charge: rendue } = appliquerImportObjectifs(charge, apercu, mode);
      assert.notEqual(rendue.propositions, charge.propositions, mode);
      assert.equal(rendue.propositions.length, 2, mode);
      charge.propositions.forEach((p, rang) => assert.equal(rendue.propositions[rang], p, `${mode} : proposition ${p.id} recopiée`));
      assert.equal(JSON.stringify(charge), texte, mode);
      const recus = objetsDe(charge);
      for (const objet of objetsDe(rendue)) {
        if (!estFigee(objet)) assert.ok(!recus.has(objet), `${mode} : objet partagé ${JSON.stringify(objet)}`);
      }
    }
  });

  test('bilanRemplacementObjectifs compte les objectifs de l’événement et les tables qui en portent', () => {
    assert.deepEqual(bilanRemplacementObjectifs(avecObjectifs()), { objectifs: 3, tables: 2 });
    assert.deepEqual(bilanRemplacementObjectifs(evenement()), { objectifs: 0, tables: 0 });
  });

  test('mettre à jour : chaque couple du fichier remplace le sien, les autres restent ; la soirée avant les tours, les étiquettes rangées', () => {
    const charge = avecObjectifs();
    const copie = structuredClone(charge);
    const apercu = apercevoirObjectifs(
      csv('table;tour;objectif;regle', '1;;finance;', '1;2;finance, Montréal;toutes', '2;3;Vélo;', '2;;bénévole;ou'),
      charge,
    );
    const { charge: apres, resume } = appliquerImportObjectifs(charge, apercu, 'mettreAJour');
    assert.deepEqual(charge, copie);
    assert.deepEqual(apres.tables[0].objectifs, [
      { portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] },
      { portee: 'tour', tour: 2, regle: 'et', etiquettes: ['Montréal', 'finance'] },
    ]);
    assert.deepEqual(apres.tables[1].objectifs, [
      { portee: 'tous', tour: null, regle: 'ou', etiquettes: ['bénévole'] },
      { portee: 'tour', tour: 3, regle: null, etiquettes: ['Vélo'] },
    ]);
    assert.deepEqual(apres.tables[2].objectifs, charge.tables[2].objectifs);
    assert.deepEqual(resume, { ajoutes: 2, remplaces: 1, inchanges: 1, retires: 0, tables: 2, refusees: [], derive: false });
    assert.deepEqual(relue(apres), apres);
    for (const { objectifs = [] } of apres.tables) {
      for (const objectif of objectifs) assert.ok(!charge.tables.some((t) => t.objectifs?.includes(objectif)));
    }
  });

  test('remplacer : chaque objectif part, puis ceux du fichier s’écrivent ; une table qui n’en garde aucun perd son champ', () => {
    const charge = avecObjectifs();
    const apercu = apercevoirObjectifs(csv('table;tour;objectif', '2;;finance', '1;;finance'), charge, { mode: 'remplacer' });
    const { charge: apres, resume } = appliquerImportObjectifs(charge, apercu, 'remplacer');
    assert.deepEqual(apres.tables[0].objectifs, [{ portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] }]);
    assert.deepEqual(apres.tables[1].objectifs, [{ portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] }]);
    assert.ok(!Object.hasOwn(apres.tables[2], 'objectifs'));
    assert.deepEqual(resume, { ajoutes: 1, remplaces: 0, inchanges: 1, retires: 2, tables: 3, refusees: [], derive: false });
    assert.deepEqual(relue(apres), apres);
    assert.deepEqual(apres.participants, charge.participants);
  });

  test('les refus de l’aperçu passent au résumé, copiés ; derive en état retenu ; un réimport identique ne change rien', () => {
    const charge = avecObjectifs();
    charge.evenement.etat = 'retenu';
    const apercu = apercevoirObjectifs(csv('table;tour;objectif', '1;;finance', '9;;finance'), charge);
    const { charge: apres, resume } = appliquerImportObjectifs(charge, apercu, 'mettreAJour');
    assert.deepEqual(apres, charge);
    assert.equal(resume.derive, true);
    assert.deepEqual(resume.inchanges, 1);
    assert.deepEqual(resume.refusees, apercu.refusees);
    assert.notEqual(resume.refusees[0], apercu.refusees[0]);
  });

  test('refus : en bloqué, puis le refus global, puis l’ambiguïté ; un mode inconnu ou autre que celui de l’aperçu lève TypeError', () => {
    const charge = evenement();
    const leve = (appel, code, details) =>
      assert.throws(appel, (erreur) => erreur instanceof ErreurCsv && erreur.code === code && JSON.stringify(erreur.details) === JSON.stringify(details));
    const valide = apercevoirObjectifs(csv('table;objectif', '1;finance'), charge);
    const bloquee = { ...charge, evenement: { ...charge.evenement, etat: 'bloque' } };
    leve(() => appliquerImportObjectifs(bloquee, valide, 'mettreAJour'), 'PLAN_BLOQUE', {});
    const guillemet = apercevoirObjectifs(csv('table;objectif', '1;"finance'), charge);
    leve(() => appliquerImportObjectifs(charge, guillemet, 'mettreAJour'), 'GUILLEMET_OUVERT', { ligne: 2 });
    const sansTable = apercevoirObjectifs(csv('table;objectif', '1;finance'), { ...charge, tables: [] });
    leve(() => appliquerImportObjectifs(charge, sansTable, 'mettreAJour'), 'OBJECTIFS_SANS_TABLE', { ligne: null });
    const ambigu = apercevoirObjectifs(csv('table;objectif;règle;regle', '1;finance;ou;et'), charge);
    leve(() => appliquerImportObjectifs(charge, ambigu, 'mettreAJour'), 'AMBIGUITE', { champs: ['regle'] });
    assert.throws(() => appliquerImportObjectifs(charge, valide, 'remplacer'), TypeError);
    assert.throws(() => appliquerImportObjectifs(charge, valide, 'ajouter'), TypeError);
  });
});

describe('objectifs : l’export, gabarit de l’import et sauvegarde (§ 10.4)', () => {
  test('table;tour;objectif;regle, les tables par numéro puis identifiant, la soirée puis les tours, la règle ou, et ou vide', () => {
    const charge = avecObjectifs();
    // Une quatrième table porte le numéro 1, comme la première : deux tables
    // d'un même numéro se rangent par identifiant.
    charge.tables.push(table(4, 1, { objectifs: [{ portee: 'tous', tour: null, regle: 'et', etiquettes: ['=SOMME(A1)', 'finance'] }] }));
    charge.tables.reverse();
    const octets = exporterObjectifs(charge.tables);
    assert.equal(
      texteDe(octets),
      MARQUE +
        csv(
          'table;tour;objectif;regle',
          '1;;finance;',
          '1;2;Montréal, bénévole;et',
          '1;;=SOMME(A1), finance;et',
          '3;3;Vélo;ou',
        ),
    );
    assert.equal(JOINTURE_ETIQUETTES, ', ');
    assert.equal(texteDe(exporterObjectifs(evenement().tables)), `${MARQUE}table;tour;objectif;regle\r\n`);
  });

  test('l’aller-retour : exporté, réimporté en remplacement sur l’événement sans objectifs, les mêmes objectifs ; réimporté en mise à jour, rien ne change', () => {
    const charge = avecObjectifs();
    charge.tables[1].objectifs = [{ portee: 'tour', tour: 4, regle: null, etiquettes: ['finance', 'ressources humaines'] }];
    const texte = decoder(exporterObjectifs(charge.tables)).texte;
    const vide = evenement();
    const apercu = apercevoirObjectifs(texte, vide, { mode: 'remplacer' });
    assert.equal(apercu.separateur, ';');
    assert.deepEqual(apercu.refusees, []);
    assert.deepEqual(appliquerImportObjectifs(vide, apercu, 'remplacer').charge.tables, charge.tables);
    const meme = appliquerImportObjectifs(charge, apercevoirObjectifs(texte, charge), 'mettreAJour');
    assert.deepEqual(meme.charge, charge);
    assert.deepEqual([meme.resume.ajoutes, meme.resume.remplaces, meme.resume.inchanges, meme.resume.tables], [0, 0, 4, 0]);
  });

  test('une forme fausse lève TypeError, qui nomme la table', () => {
    const charge = evenement();
    charge.tables[1].objectifs = [{ portee: 'tous', tour: null, regle: 'toutes', etiquettes: ['finance'] }];
    assert.throws(() => exporterObjectifs(charge.tables), (erreur) => erreur instanceof TypeError && /table 2/.test(erreur.message));
    charge.tables[1].objectifs = [{ portee: 'tous', tour: null, regle: null, etiquettes: 'finance' }];
    assert.throws(() => exporterObjectifs(charge.tables), TypeError);
  });
});

describe('objectifs : la ligne à remplir, sans objectif ni règle, que l’import passe (§ 10.4)', () => {
  test('ni valide ni refusée, quels que soient sa table et son tour ; seule, aucune ligne valide', () => {
    for (const ligne of ['1;;;', '1;2;;', '1;;" , | ";', '9;;;', 'un;cinq;;', ';3; ;']) {
      const apercu = apercevoirObjectifs(csv('table;tour;objectif;regle', ligne), evenement());
      assert.equal(apercu.refusGlobal, 'AUCUNE_LIGNE_VALIDE', ligne);
      assert.deepEqual(apercu.refusees, [], ligne);
    }
    const sansRegle = apercevoirObjectifs(csv('table;objectif', '1;', '2;finance'), evenement());
    assert.deepEqual(sansRegle.refusees, []);
    assert.deepEqual(sansRegle.lignes.map(({ ligne }) => ligne), [3]);
  });

  test('un champ en trop la refuse encore, et une règle écrite en fait un objectif vide', () => {
    // Vingt lignes à remplir précèdent le champ en trop, que l'analyse du
    // séparateur ne lit qu'au-delà de ses vingt premiers enregistrements.
    const apercu = apercevoirObjectifs(
      csv('table;tour;objectif;regle', '1;;finance;', ...Array(20).fill('3;;;'), '2;;;;x', '2;1;;toutes'),
      evenement(),
    );
    assert.deepEqual(refus(apercu), [[23, 'CHAMPS_EN_TROP'], [24, 'OBJECTIF_VIDE']]);
    assert.deepEqual(apercu.lignes.map(({ ligne }) => ligne), [2]);
  });

  test('elle ne touche pas l’objectif de son couple en mise à jour ; en remplacement, son couple est de ceux que le fichier ne nomme pas', () => {
    const charge = avecObjectifs();
    const texte = csv('table;tour;objectif;regle', '1;;;', '1;2;;', '2;;finance;');
    const misAJour = appliquerImportObjectifs(charge, apercevoirObjectifs(texte, charge), 'mettreAJour');
    assert.deepEqual(misAJour.charge.tables[0].objectifs, charge.tables[0].objectifs);
    assert.deepEqual([misAJour.resume.ajoutes, misAJour.resume.inchanges, misAJour.resume.retires], [1, 0, 0]);
    const remplace = appliquerImportObjectifs(charge, apercevoirObjectifs(texte, charge, { mode: 'remplacer' }), 'remplacer');
    assert.equal(remplace.charge.tables[0].objectifs, undefined);
    assert.deepEqual([remplace.resume.ajoutes, remplace.resume.retires], [1, 3]);
  });
});

describe('objectifs : le modèle à télécharger, adapté à l’événement (§ 10.4)', () => {
  test('sans objectif : une ligne de soirée par table, les deux premières portent l’exemple « ou » puis l’exemple « et »', () => {
    const charge = evenement();
    const octets = modeleObjectifs(charge.tables, charge.evenement.tours);
    assert.ok(octets instanceof Uint8Array);
    assert.deepEqual([...octets.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
    assert.equal(
      texteDe(octets),
      MARQUE + csv('table;tour;objectif;regle', '1;;finance, ressources humaines;ou', '2;;finance, Montréal;et', '3;;;'),
    );
  });

  test('une table qui porte un objectif de tour : sa soirée puis chaque tour ; un objectif existant s’écrit à son couple, les exemples aux premiers couples libres', () => {
    const charge = avecObjectifs();
    // Une quatrième table numérotée 0 vient en tête par son numéro.
    charge.tables.push(table(4, 0));
    charge.tables.reverse();
    const avant = structuredClone(charge.tables);
    assert.equal(
      texteDe(modeleObjectifs(charge.tables, charge.evenement.tours)),
      MARQUE +
        csv(
          'table;tour;objectif;regle',
          '0;;finance, ressources humaines;ou',
          '1;;finance;',
          '1;1;finance, Montréal;et',
          '1;2;Montréal, bénévole;et',
          '1;3;;',
          '1;4;;',
          '2;;;',
          '3;;;',
          '3;1;;',
          '3;2;;',
          '3;3;Vélo;ou',
          '3;4;;',
        ),
    );
    assert.deepEqual(charge.tables, avant);
  });

  test('deux tables d’un même numéro ont leurs lignes, à remplir, leurs objectifs existants tus : aucun exemple n’y va, l’import refuserait ce numéro', () => {
    const charge = evenement();
    charge.tables = [table(1, 3), table(2, 3), table(3, 5)];
    assert.equal(
      texteDe(modeleObjectifs(charge.tables, 2)),
      MARQUE + csv('table;tour;objectif;regle', '3;;;', '3;;;', '5;;finance, ressources humaines;ou', '5;1;finance, Montréal;et', '5;2;;'),
    );
    const garnie = evenement();
    garnie.tables = [
      table(1, 3, { objectifs: [
        { portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] },
        { portee: 'tour', tour: 2, regle: 'et', etiquettes: ['Montréal', 'bénévole'] },
      ] }),
      table(2, 3),
      table(3, 5),
    ];
    assert.equal(
      texteDe(modeleObjectifs(garnie.tables, 2)),
      MARQUE + csv('table;tour;objectif;regle', '3;;;', '3;1;;', '3;2;;', '3;;;', '5;;finance, ressources humaines;ou', '5;1;finance, Montréal;et', '5;2;;'),
    );
    assert.equal(texteDe(modeleObjectifs([], 2)), `${MARQUE}table;tour;objectif;regle\r\n`);
  });

  test('moins de deux couples libres : la première table à numéro unique sans objectif de tour prend ses lignes de tour, et les deux formes s’y montrent', () => {
    const garnies = evenement();
    garnies.tables = [
      table(1, 1, { objectifs: [{ portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] }] }),
      table(2, 2, { objectifs: [{ portee: 'tous', tour: null, regle: null, etiquettes: ['bénévole'] }] }),
    ];
    assert.equal(
      texteDe(modeleObjectifs(garnies.tables, 3)),
      MARQUE +
        csv(
          'table;tour;objectif;regle',
          '1;;finance;',
          '1;1;finance, ressources humaines;ou',
          '1;2;finance, Montréal;et',
          '1;3;;',
          '2;;bénévole;',
        ),
    );
    const seule = evenement();
    seule.tables = [table(1, 4)];
    assert.equal(
      texteDe(modeleObjectifs(seule.tables, 3)),
      MARQUE + csv('table;tour;objectif;regle', '4;;finance, ressources humaines;ou', '4;1;finance, Montréal;et', '4;2;;', '4;3;;'),
    );
    // Un seul tour : la première table n'offre qu'un couple de tour, la
    // suivante prend aussi sa ligne de tour pour le second exemple.
    const tourUnique = evenement();
    tourUnique.tables = [
      table(1, 1, { objectifs: [{ portee: 'tous', tour: null, regle: 'et', etiquettes: ['finance'] }] }),
      table(2, 2, { objectifs: [{ portee: 'tous', tour: null, regle: null, etiquettes: ['Montréal'] }] }),
    ];
    assert.equal(
      texteDe(modeleObjectifs(tourUnique.tables, 1)),
      MARQUE + csv('table;tour;objectif;regle', '1;;finance;et', '1;1;finance, ressources humaines;ou', '2;;Montréal;', '2;1;finance, Montréal;et'),
    );
    // Une table déjà écrite par tour, avant une table garnie à sa soirée :
    // son couple libre ne suffit pas, ses tours ne se recomptent pas, et la
    // table suivante prend ses lignes de tour pour l'exemple « et ».
    const parTourDabord = evenement();
    parTourDabord.tables = [
      table(1, 1, { objectifs: [
        { portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] },
        { portee: 'tour', tour: 1, regle: null, etiquettes: ['finance'] },
        { portee: 'tour', tour: 2, regle: null, etiquettes: ['finance'] },
      ] }),
      table(2, 2, { objectifs: [{ portee: 'tous', tour: null, regle: null, etiquettes: ['bénévole'] }] }),
    ];
    assert.equal(
      texteDe(modeleObjectifs(parTourDabord.tables, 3)),
      MARQUE +
        csv(
          'table;tour;objectif;regle',
          '1;;finance;',
          '1;1;finance;',
          '1;2;finance;',
          '1;3;finance, ressources humaines;ou',
          '2;;bénévole;',
          '2;1;finance, Montréal;et',
          '2;2;;',
          '2;3;;',
        ),
    );
  });

  test('sans couple libre sur une table à numéro unique, aucun exemple : un événement entièrement garni, ou des numéros tous partagés, dont le fichier n’a aucune ligne valide', () => {
    const garni = evenement();
    garni.tables = [
      table(1, 1, { objectifs: [
        { portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] },
        { portee: 'tour', tour: 1, regle: 'ou', etiquettes: ['Montréal'] },
        { portee: 'tour', tour: 2, regle: 'et', etiquettes: ['bénévole'] },
      ] }),
    ];
    assert.equal(
      texteDe(modeleObjectifs(garni.tables, 2)),
      MARQUE + csv('table;tour;objectif;regle', '1;;finance;', '1;1;Montréal;ou', '1;2;bénévole;et'),
    );
    const partages = evenement();
    partages.tables = [table(1, 3), table(2, 3)];
    assert.equal(texteDe(modeleObjectifs(partages.tables, 2)), MARQUE + csv('table;tour;objectif;regle', '3;;;', '3;;;'));
    // Ce fichier ne s'importe pas : l'application refuse ce modèle
    // (OBJECTIFS_NUMEROS_PARTAGES, src/application/csv.js).
    const texte = decoder(modeleObjectifs(partages.tables, 2)).texte;
    for (const mode of MODES_IMPORT_OBJECTIFS) {
      const apercu = apercevoirObjectifs(texte, partages, { mode });
      assert.equal(apercu.refusGlobal, 'AUCUNE_LIGNE_VALIDE', mode);
      assert.deepEqual(apercu.refusees, [], mode);
    }
  });

  test('importé tel quel, sous les deux modes : aucun refus, les objectifs existants inchangés, les exemples ajoutés', () => {
    const garnies = evenement();
    garnies.tables[0].objectifs = [{ portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] }];
    garnies.tables[1].objectifs = [{ portee: 'tous', tour: null, regle: null, etiquettes: ['bénévole'] }];
    garnies.tables[2].objectifs = [{ portee: 'tous', tour: null, regle: 'ou', etiquettes: ['Montréal'] }];
    for (const depart of [evenement(), avecObjectifs(), garnies]) {
      const texte = decoder(modeleObjectifs(depart.tables, depart.evenement.tours)).texte;
      const parMode = MODES_IMPORT_OBJECTIFS.map((mode) => {
        const apercu = apercevoirObjectifs(texte, depart, { mode });
        assert.equal(apercu.refusGlobal, null, mode);
        assert.deepEqual(apercu.refusees, [], mode);
        assert.deepEqual(apercu.multilignes, [], mode);
        return appliquerImportObjectifs(depart, apercu, mode);
      });
      const [misAJour, remplace] = parMode;
      assert.deepEqual(remplace.charge, misAJour.charge);
      assert.deepEqual([misAJour.resume.ajoutes, misAJour.resume.remplaces, misAJour.resume.retires], [2, 0, 0]);
      for (const avant of depart.tables) {
        const apres = misAJour.charge.tables.find(({ id }) => id === avant.id);
        for (const objectif of avant.objectifs ?? []) assert.ok(apres.objectifs.some((o) => JSON.stringify(o) === JSON.stringify(objectif)));
      }
    }
    // Un numéro partagé, dont une table porte un objectif : ses lignes sont à
    // remplir, aucune n'est refusée ; la mise à jour garde son objectif, le
    // remplacement le retire, comme son bilan l'annonce.
    const partagee = evenement();
    partagee.tables = [
      table(1, 3, { objectifs: [{ portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] }] }),
      table(2, 3),
      table(3, 5),
    ];
    const texte = decoder(modeleObjectifs(partagee.tables, partagee.evenement.tours)).texte;
    const [misAJour, remplace] = MODES_IMPORT_OBJECTIFS.map((mode) => {
      const apercu = apercevoirObjectifs(texte, partagee, { mode });
      assert.equal(apercu.refusGlobal, null, mode);
      assert.deepEqual(apercu.refusees, [], mode);
      const applique = appliquerImportObjectifs(partagee, apercu, mode);
      assert.deepEqual(applique.resume.refusees, [], mode);
      return applique;
    });
    assert.deepEqual(misAJour.charge.tables[0].objectifs, partagee.tables[0].objectifs);
    assert.deepEqual([misAJour.resume.ajoutes, misAJour.resume.remplaces, misAJour.resume.retires], [2, 0, 0]);
    assert.equal(remplace.charge.tables[0].objectifs, undefined);
    assert.deepEqual([remplace.resume.ajoutes, remplace.resume.remplaces, remplace.resume.retires], [2, 0, 1]);
  });

  test('un nombre de tours qui n’est pas un entier positif lève TypeError ; une forme fausse d’objectif aussi, qui nomme la table', () => {
    const charge = avecObjectifs();
    for (const tours of [0, -1, 1.5, '4', null]) assert.throws(() => modeleObjectifs(charge.tables, tours), TypeError, String(tours));
    charge.tables[1].objectifs = [{ portee: 'tous', tour: null, regle: 'toutes', etiquettes: ['finance'] }];
    assert.throws(() => modeleObjectifs(charge.tables, 4), (erreur) => erreur instanceof TypeError && /table 2/.test(erreur.message));
  });
});

describe('objectifs : le fichier d’exemple et la boucle de son CSV des refus (A19, § 10.3, § 14.10)', () => {
  test('objectifs_cas_limites.csv : UTF-8 avec marque, « ; », CRLF, l’en-tête Table;Tour;Objectif;Règle, et le contenu fixé', () => {
    const octets = readFileSync(new URL('objectifs_cas_limites.csv', EXEMPLES));
    assert.deepEqual([...octets.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
    assert.equal(
      texteDe(octets),
      MARQUE +
        csv(
          'Table;Tour;Objectif;Règle',
          '1;;finance, bénévole;',
          '1;2;Montréal;toutes',
          '2;;FINANCE;au moins une',
          '9;;finance;',
          '2;9;finance;',
          '2;;ressources humaines;peut-être',
          '1;2;finance;',
        ),
    );
  });

  test("sur un événement à deux tables et quatre tours : trois objectifs, dont une soirée et un tour sur la table 1 et une orthographe fondue ; quatre refus, un par motif", () => {
    const charge = evenement();
    charge.tables = charge.tables.slice(0, 2);
    const apercu = apercevoirObjectifs(lireExemple(), charge);
    assert.equal(apercu.refusGlobal, null);
    assert.equal(apercu.separateur, ';');
    assert.deepEqual(apercu.lignes.map(({ ligne, champs }) => [ligne, champs]), [
      [2, { numero: 1, table: 1, tour: null, regle: null, etiquettes: ['finance', 'bénévole'] }],
      [3, { numero: 1, table: 1, tour: 2, regle: 'et', etiquettes: ['Montréal'] }],
      [4, { numero: 2, table: 2, tour: null, regle: 'ou', etiquettes: ['finance'] }],
    ]);
    assert.deepEqual(apercu.fusionsEtiquettes, [{ retenue: 'finance', orthographes: ['FINANCE', 'finance'], lignes: 1 }]);
    assert.deepEqual(apercu.refusees.map(({ brut, ...reste }) => reste), [
      { ligne: 5, code: 'NUMERO_TABLE_INCONNU', valeur: '9' },
      { ligne: 6, code: 'TOUR_HORS_SOIREE', valeur: '9', tours: 4 },
      { ligne: 7, code: 'REGLE_INCONNUE', valeur: 'peut-être' },
      { ligne: 8, code: 'OBJECTIF_EN_DOUBLE', valeur: null, premiereLigne: 3, numero: 1, tour: 2 },
    ]);
  });

  test('l’aller-retour de l’exemple : appliqué en mise à jour, exporté, réimporté en remplacement sur l’événement sans objectifs, les mêmes tables', () => {
    const deuxTables = () => {
      const charge = evenement();
      charge.tables = charge.tables.slice(0, 2);
      return charge;
    };
    const apres = appliquerImportObjectifs(deuxTables(), apercevoirObjectifs(lireExemple(), deuxTables()), 'mettreAJour').charge;
    // L'orthographe fondue s'écrit « finance », « au moins une » s'écrit
    // « ou », « toutes » s'écrit « et » : ce sont ces formes que l'export
    // doit rendre au réimport.
    assert.deepEqual(apres.tables.map(({ objectifs }) => objectifs), [
      [
        { portee: 'tous', tour: null, regle: null, etiquettes: ['bénévole', 'finance'] },
        { portee: 'tour', tour: 2, regle: 'et', etiquettes: ['Montréal'] },
      ],
      [{ portee: 'tous', tour: null, regle: 'ou', etiquettes: ['finance'] }],
    ]);
    const texte = decoder(exporterObjectifs(apres.tables)).texte;
    const vide = deuxTables();
    const apercu = apercevoirObjectifs(texte, vide, { mode: 'remplacer' });
    assert.deepEqual(apercu.refusees, []);
    assert.deepEqual(appliquerImportObjectifs(vide, apercu, 'remplacer').charge.tables, apres.tables);
  });

  test('le CSV des refus se réimporte tel quel : une cellule corrigée fait entrer sa ligne, les autres reviennent pour le même motif', () => {
    const charge = evenement();
    charge.tables = charge.tables.slice(0, 2);
    const apercu = apercevoirObjectifs(lireExemple(), charge);
    const motif = (code, { ligne }) => `${code} à la ligne ${ligne}`;
    const refusTexte = decoder(exporterRefus(apercu, motif)).texte;
    const { enregistrements } = decouper(refusTexte, ';');
    assert.deepEqual(enregistrements[0], ['Table', 'Tour', 'Objectif', 'Règle', 'ligne', 'motif']);
    assert.deepEqual(enregistrements.slice(1).map((e) => e.slice(0, 4)), [
      ['9', '', 'finance', ''],
      ['2', '9', 'finance', ''],
      ['2', '', 'ressources humaines', 'peut-être'],
      ['1', '2', 'finance', ''],
    ]);
    // Réimporté sans correction, sur l'événement d'avant : chaque ligne
    // revient pour le même motif, sauf le doublon, que plus rien ne précède
    // dans le fichier des refus.
    const tel = apercevoirObjectifs(refusTexte, charge);
    assert.deepEqual(refus(tel), [[2, 'NUMERO_TABLE_INCONNU'], [3, 'TOUR_HORS_SOIREE'], [4, 'REGLE_INCONNUE']]);
    assert.deepEqual(tel.lignes.map(({ ligne }) => ligne), [5]);
    // La règle corrigée dans sa cellule : la ligne entre, les autres restent.
    const corrige = refusTexte.replace('ressources humaines;peut-être;', 'ressources humaines;toutes;');
    assert.notEqual(corrige, refusTexte);
    const reimporte = apercevoirObjectifs(corrige, charge);
    assert.deepEqual(refus(reimporte), [[2, 'NUMERO_TABLE_INCONNU'], [3, 'TOUR_HORS_SOIREE']]);
    assert.deepEqual(reimporte.lignes.map(({ ligne, champs }) => [ligne, champs.numero, champs.tour, champs.regle]), [
      [4, 2, null, 'et'],
      [5, 1, 2, null],
    ]);
    assert.deepEqual(reimporte.association.nonReconnues, [4, 5]);
  });
});
