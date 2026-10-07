// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de l'aperçu d'un import ou d'un collage (§ 10.1, § 10.2, § 14.10) :
// les lignes valides et leurs champs, les lignes refusées et leur motif, les
// refus globaux, la valeur d'« exclu », le rapport des orthographes fondues,
// les doublons signalés et jamais fusionnés, le même aperçu pour un texte
// collé et pour le même texte décodé d'un fichier, et les données d'épreuve
// de test/fixtures/csv/, chacune un CSV tel qu'un tableur l'écrit. Les lettres
// décomposées et les blancs autres que l'espace s'écrivent par leur point de
// code.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, test } from '../../test/lanceur.js';
import { VALEURS_EXCLU, apercevoir } from './apercu.js';
import { contientNul, decoder } from './encodage.js';
import { cleNormalisee } from './normalisation.js';

const FIXTURES = new URL('../../test/fixtures/csv/', import.meta.url);

// Texte d'un CSV : chaque ligne donnée, terminée par CRLF.
const csv = (...lignes) => lignes.map((ligne) => `${ligne}\r\n`).join('');

// Vingt patronymes d'épreuve, inventés.
const PATRONYMES = [
  'Ardoise', 'Brindille', 'Châtaigne', 'Dune', 'Écorce', 'Fougère', 'Galet', 'Houle', 'Iode', 'Jonc',
  'Lichen', 'Mousse', 'Nacre', 'Ocre', 'Prêle', 'Quartz', 'Roseau', 'Sauge', 'Tourbe', 'Ulve',
];

// Les lignes qui suivent l'en-tête dans la fenêtre du choix du séparateur,
// ses vingt premiers enregistrements : une ligne par patronyme, rendue par
// ligne ; dix-neuf par défaut, moins pour placer un enregistrement choisi
// dans la fenêtre. Un enregistrement dont le nombre de champs diffère de
// celui de l'en-tête n'est une ligne de l'aperçu qu'au-delà, à partir du
// rang 21 : dans la fenêtre, il écarte le séparateur, et le texte entier est
// refusé à son rang.
const fenetre = (ligne, nombre = 19) => PATRONYMES.slice(0, nombre).map(ligne);

// Participant existant, ses autres champs vides.
const existant = (id, nom, prenom, appartenance) => ({
  id, nom, prenom, appartenance, courriel: null, titrePressenti: null, notes: null, exclu: false,
});

// Champs d'une ligne valide, dans l'ordre de l'aperçu ; un champ omis vaut null.
const champs = ({
  nom, prenom = null, appartenance = null, courriel = null, titrePressenti = null, notes = null, exclu = null,
}) => ({ nom, prenom, appartenance, courriel, titrePressenti, notes, exclu });

// Aperçu d'un texte refusé en entier : ce que la lecture a établi avant le
// refus, aucune ligne.
const refusGlobal = (
  code,
  { separateur = null, entetes = [], association = { colonnes: {}, ambigus: [], nonReconnues: [] } } = {},
  ligne = null,
) => ({
  mode: 'ajouter',
  separateur,
  entetes,
  association,
  lignes: [],
  refusees: [],
  fusions: [],
  doublons: [],
  homonymes: [],
  multilignes: [],
  refusGlobal: code,
  refusGlobalLigne: ligne,
});

// Octets d'une donnée d'épreuve.
const lireFixture = (nom) => readFileSync(new URL(nom, FIXTURES));

// Fins de ligne des octets d'un texte à un octet par unité : les CRLF, puis
// les LF et CR isolés.
function finsDeLigne(octets) {
  let crlf = 0;
  let isolees = 0;
  for (let i = 0; i < octets.length; i += 1) {
    if (octets[i] === 0x0d && octets[i + 1] === 0x0a) {
      crlf += 1;
      i += 1;
    } else if (octets[i] === 0x0a || octets[i] === 0x0d) {
      isolees += 1;
    }
  }
  return { crlf, isolees };
}

// Rang et champs de chaque ligne valide.
const lignesDe = (apercu) => apercu.lignes.map(({ ligne, champs: lus }) => [ligne, lus]);

describe("apercevoir : les lignes d'un texte sans défaut (§ 10.1)", () => {
  test("chaque partie de l'aperçu : séparateur, en-têtes tels qu'écrits, association, lignes", () => {
    const texte = csv(
      'Nom;Prénom;Équipe;Courriel;Rôle;Exclu;Notes',
      'Ombrelle;Iris;Club des Merles;iris@exemple.test;animation;non;arrive tôt',
      'Pervenche;Théo;;;;oui;',
    );
    assert.deepEqual(apercevoir(texte), {
      mode: 'ajouter',
      separateur: ';',
      entetes: ['Nom', 'Prénom', 'Équipe', 'Courriel', 'Rôle', 'Exclu', 'Notes'],
      association: {
        colonnes: { nom: 0, prenom: 1, appartenance: 2, courriel: 3, titre_pressenti: 4, exclu: 5, notes: 6 },
        ambigus: [],
        nonReconnues: [],
      },
      lignes: [
        {
          ligne: 2,
          champs: champs({
            nom: 'Ombrelle', prenom: 'Iris', appartenance: 'Club des Merles', courriel: 'iris@exemple.test',
            titrePressenti: 'animation', notes: 'arrive tôt', exclu: false,
          }),
          brut: ['Ombrelle', 'Iris', 'Club des Merles', 'iris@exemple.test', 'animation', 'non', 'arrive tôt'],
        },
        {
          ligne: 3,
          champs: champs({ nom: 'Pervenche', prenom: 'Théo', exclu: true }),
          brut: ['Pervenche', 'Théo', '', '', '', 'oui', ''],
        },
      ],
      refusees: [],
      fusions: [],
      doublons: [],
      homonymes: [],
      multilignes: [],
      refusGlobal: null,
      refusGlobalLigne: null,
    });
  });

  test("les champs d'une ligne, dans l'ordre du participant, quel que soit celui des colonnes", () => {
    const [ligne] = apercevoir(csv('notes;exclu;titre;courriel;équipe;prénom;nom', 'n;oui;t;c@exemple.test;a;p;Ombrelle'))
      .lignes;
    assert.equal(
      JSON.stringify(ligne.champs),
      '{"nom":"Ombrelle","prenom":"p","appartenance":"a","courriel":"c@exemple.test","titrePressenti":"t","notes":"n","exclu":true}',
    );
  });

  test("un champ : NFC, bouts retirés, vide ou blanc → null ; le brut reste tel qu'écrit", () => {
    const texte = csv(
      'nom;prenom;appartenance;courriel;notes',
      ' Ombrelle ;The\u{301}o;  Club  des   Merles ;  \u{A0} ;"ligne un\nligne deux "',
    );
    const [ligne] = apercevoir(texte).lignes;
    assert.deepEqual(
      ligne.champs,
      champs({ nom: 'Ombrelle', prenom: 'Th\u{E9}o', appartenance: 'Club  des   Merles', notes: 'ligne un\nligne deux' }),
    );
    assert.deepEqual(ligne.brut, [' Ombrelle ', 'The\u{301}o', '  Club  des   Merles ', '  \u{A0} ', 'ligne un\nligne deux ']);
  });

  test('un champ sans colonne vaut null', () => {
    assert.deepEqual(lignesDe(apercevoir(csv('nom', 'Ombrelle'))), [[2, champs({ nom: 'Ombrelle' })]]);
  });

  test("l'en-tête est le premier enregistrement non vide ; les rangs comptent les lignes qui le précèdent", () => {
    const apercu = apercevoir(csv('', ';', 'nom;prenom', 'Ombrelle;Iris'));
    assert.deepEqual(apercu.entetes, ['nom', 'prenom']);
    assert.deepEqual(lignesDe(apercu), [[4, champs({ nom: 'Ombrelle', prenom: 'Iris' })]]);
  });

  test('un enregistrement vide, blanc ou fait de séparateurs est ignoré, et garde son rang', () => {
    const apercu = apercevoir(csv('nom;prenom', 'Ombrelle;Iris', '', ';', ' ;\u{A0}\t', 'Pervenche;Théo'));
    assert.deepEqual(apercu.lignes.map(({ ligne }) => ligne), [2, 6]);
    assert.deepEqual(apercu.refusees, []);
    assert.equal(apercu.refusGlobal, null);
  });

  test("le choix tranche une ambiguïté de l'en-tête, et les lignes en suivent", () => {
    const texte = csv('nom;organisation;entreprise', 'Ombrelle;Club des Merles;Chorale du Givre');
    const sansChoix = apercevoir(texte);
    assert.deepEqual(sansChoix.association.ambigus, [{ champ: 'appartenance', rangs: [1, 2] }]);
    assert.equal(sansChoix.refusGlobal, null);
    assert.equal(sansChoix.lignes[0].champs.appartenance, null);

    const avecChoix = apercevoir(texte, { choix: { appartenance: 2 } });
    assert.deepEqual(avecChoix.association, { colonnes: { nom: 0, appartenance: 2 }, ambigus: [], nonReconnues: [] });
    assert.equal(avecChoix.lignes[0].champs.appartenance, 'Chorale du Givre');
  });

  test("un texte qui n'est pas une chaîne est refusé par un TypeError : des octets passent par decoder", () => {
    // Un objet String se lirait comme sa chaîne ; les autres entrées lèveraient
    // plus loin, par accident, un TypeError d'un autre texte.
    const entrees = [
      new TextEncoder().encode('nom\nOmbrelle\n'),
      new String('nom\nOmbrelle\n'),
      ['nom', 'Ombrelle'],
      undefined,
      null,
      42,
    ];
    for (const entree of entrees) {
      assert.throws(() => apercevoir(entree), { name: 'TypeError', message: 'texte : chaîne attendue' });
    }
  });

  test('apercevoir ne modifie ni les participants ni le choix', () => {
    const participants = Object.freeze([
      Object.freeze(existant(7, 'Givre', null, 'cooperative bleue')),
      Object.freeze(existant(3, 'Houle', null, 'Coopérative Bleue')),
    ]);
    const choix = Object.freeze({ appartenance: 2 });
    const texte = csv('nom;organisation;entreprise', 'Givre;;COOPÉRATIVE BLEUE');
    const apercu = apercevoir(texte, { participants, choix });
    assert.equal(apercu.lignes[0].champs.appartenance, 'Coopérative Bleue');
    assert.deepEqual(participants.map(({ id }) => id), [7, 3]);
  });

  test("l'ordre des participants donnés ne compte pas : l'identifiant ordonne", () => {
    const participants = [
      existant(3, 'Houle', null, 'Coopérative Bleue'),
      existant(7, 'Givre', null, 'cooperative bleue'),
      existant(5, 'Ombrelle', 'Iris', null),
    ];
    const texte = csv('nom;prenom;appartenance', 'Ombrelle;Iris;COOPÉRATIVE BLEUE', 'Givre;;cooperative bleue');
    const apercu = apercevoir(texte, { participants });
    assert.deepEqual(apercevoir(texte, { participants: [...participants].reverse() }), apercu);
    assert.equal(apercu.fusions[0].affichee, 'Coopérative Bleue');
    assert.deepEqual(apercu.doublons, [{ cle: '["givre","","cooperative bleue"]', lignes: [3], existants: [7] }]);
  });
});

describe('apercevoir : la ligne refusée, le reste importé (§ 10.1)', () => {
  test('un nom vide ou blanc refuse la ligne : NOM_ABSENT', () => {
    const apercu = apercevoir(csv('prenom;nom;appartenance', 'Iris;;Club des Merles', 'Théo; \u{A0}\t;', 'Ondine;Sarcelle;'));
    assert.deepEqual(apercu.refusees, [
      { ligne: 2, code: 'NOM_ABSENT', valeur: null, brut: ['Iris', '', 'Club des Merles'] },
      { ligne: 3, code: 'NOM_ABSENT', valeur: null, brut: ['Théo', ' \u{A0}\t', ''] },
    ]);
    assert.deepEqual(lignesDe(apercu), [[4, champs({ nom: 'Sarcelle', prenom: 'Ondine' })]]);
    assert.equal(apercu.refusGlobal, null);
  });

  test('un enregistrement trop court pour porter le nom refuse la ligne : NOM_ABSENT', () => {
    const apercu = apercevoir(csv('prenom;nom', ...fenetre((patronyme) => `x;${patronyme}`), 'Iris'));
    assert.equal(apercu.separateur, ';');
    assert.deepEqual(apercu.refusees, [{ ligne: 21, code: 'NOM_ABSENT', valeur: null, brut: ['Iris'] }]);
    assert.equal(apercu.lignes.length, 19);
  });

  test("un champ non vide au-delà de l'en-tête refuse la ligne : CHAMPS_EN_TROP", () => {
    const apercu = apercevoir(csv(
      'nom;prenom',
      ...fenetre((patronyme) => `${patronyme};x`),
      'Ombrelle;Iris;Club des Merles',
      'Pervenche;Théo;; \t',
      'Sarcelle',
    ));
    assert.equal(apercu.separateur, ';');
    assert.deepEqual(apercu.refusees, [
      { ligne: 21, code: 'CHAMPS_EN_TROP', valeur: null, brut: ['Ombrelle', 'Iris', 'Club des Merles'] },
    ]);
    // Un champ en trop vide ou blanc ne perd rien ; un enregistrement plus
    // court laisse ses champs manquants à null.
    assert.deepEqual(apercu.lignes.slice(-2), [
      { ligne: 22, champs: champs({ nom: 'Pervenche', prenom: 'Théo' }), brut: ['Pervenche', 'Théo', '', ' \t'] },
      { ligne: 23, champs: champs({ nom: 'Sarcelle' }), brut: ['Sarcelle'] },
    ]);
  });

  test('un seul motif par ligne : champs en trop, puis nom absent, puis exclu inconnu', () => {
    const apercu = apercevoir(csv(
      'nom;exclu',
      ...fenetre((patronyme) => `${patronyme};non`),
      ';peut-être;en trop',
      ';peut-être',
      'Ombrelle;peut-être',
    ));
    assert.deepEqual(
      apercu.refusees.map(({ ligne, code }) => [ligne, code]),
      [[21, 'CHAMPS_EN_TROP'], [22, 'NOM_ABSENT'], [23, 'EXCLU_INCONNU']],
    );
  });
});

describe('apercevoir : « exclu », une liste fermée (§ 10.1)', () => {
  test('VALEURS_EXCLU : oui, o, vrai, 1 et x valent oui ; non, n, faux, 0 et vide valent non', () => {
    assert.deepEqual(
      [...VALEURS_EXCLU],
      [
        ['oui', true], ['o', true], ['vrai', true], ['1', true], ['x', true],
        ['non', false], ['n', false], ['faux', false], ['0', false], ['', false],
      ],
    );
    for (const [cle] of VALEURS_EXCLU) assert.equal(cleNormalisee(cle), cle);
  });

  test('Oui, X, 0 et vide sont admis ; « peut-être » refuse la ligne, sa valeur nommée', () => {
    const apercu = apercevoir(csv(
      'nom;exclu',
      'Ardoise;Oui',
      'Brindille;X',
      'Châtaigne;0',
      'Dune;',
      'Écorce;peut-être',
      'Fougère; \u{A0}',
    ));
    assert.deepEqual(
      apercu.lignes.map(({ ligne, champs: lus }) => [ligne, lus.exclu]),
      [[2, true], [3, true], [4, false], [5, null], [7, null]],
    );
    assert.deepEqual(apercu.refusees, [
      { ligne: 6, code: 'EXCLU_INCONNU', valeur: 'peut-être', brut: ['Écorce', 'peut-être'] },
    ]);
  });

  test('chaque valeur admise, sans égard à la casse, aux accents ni aux blancs de bord', () => {
    const cas = [
      ['OUI', true], [' o ', true], ['Vrai', true], ['1', true], ['x', true], ['Ouï', true],
      ['NON', false], ['N', false], ['Faux', false], ['0', false], ['\tnon\u{A0}', false],
    ];
    const apercu = apercevoir(csv('nom;exclu', ...cas.map(([valeur], rang) => `${PATRONYMES[rang]};${valeur}`)));
    assert.deepEqual(apercu.refusees, []);
    assert.deepEqual(apercu.lignes.map(({ champs: lus }) => lus.exclu), cas.map(([, exclu]) => exclu));
  });

  test("toute autre valeur refuse la ligne, sa valeur nommée sans ses blancs de bord", () => {
    const valeurs = ['yes', 'true', 'oui.', '2', 'nn', '-', 'exclu', 'o u i', ' non merci '];
    const apercu = apercevoir(csv('nom;exclu', ...valeurs.map((valeur, rang) => `${PATRONYMES[rang]};${valeur}`)));
    assert.deepEqual(
      apercu.refusees.map(({ ligne, code, valeur }) => [ligne, code, valeur]),
      valeurs.map((valeur, rang) => [rang + 2, 'EXCLU_INCONNU', valeur.trim()]),
    );
    assert.equal(apercu.refusGlobal, 'AUCUNE_LIGNE_VALIDE');
  });
});

describe("apercevoir : les orthographes d'une appartenance (§ 10.1, § 14.10)", () => {
  test("le rapport nomme chaque fusion : trois orthographes, leurs lignes, l'existante affichée", () => {
    const participants = [existant(1, 'Ombrelle', 'Iris', 'Coopérative Bleue')];
    const apercu = apercevoir(
      csv(
        'nom;prenom;appartenance',
        'Pervenche;Théo;cooperative  bleue',
        'Sarcelle;Ondine;COOPÉRATIVE BLEUE',
        'Bruyère;Anouk;cooperative  bleue',
      ),
      { participants },
    );
    assert.deepEqual(apercu.fusions, [
      {
        affichee: 'Coopérative Bleue',
        orthographes: [
          { texte: 'Coopérative Bleue', lignes: [] },
          { texte: 'cooperative  bleue', lignes: [2, 4] },
          { texte: 'COOPÉRATIVE BLEUE', lignes: [3] },
        ],
      },
    ]);
    assert.deepEqual(
      apercu.lignes.map(({ champs: lus }) => lus.appartenance),
      ['Coopérative Bleue', 'Coopérative Bleue', 'Coopérative Bleue'],
    );
  });

  test("sans participant existant, la première orthographe du fichier s'affiche", () => {
    const apercu = apercevoir(csv(
      'nom;appartenance',
      'Ombrelle;club des merles',
      'Pervenche;Club des Merles',
      'Sarcelle; CLUB DES MERLES ',
    ));
    assert.deepEqual(apercu.fusions, [
      {
        affichee: 'club des merles',
        orthographes: [
          { texte: 'club des merles', lignes: [2] },
          { texte: 'Club des Merles', lignes: [3] },
          { texte: 'CLUB DES MERLES', lignes: [4] },
        ],
      },
    ]);
    assert.deepEqual(apercu.lignes.map(({ champs: lus }) => lus.appartenance), [
      'club des merles', 'club des merles', 'club des merles',
    ]);
  });

  test("une orthographe répétée, ou la même en NFC et en NFD, n'est pas une fusion", () => {
    const apercu = apercevoir(csv(
      'nom;appartenance',
      'Ombrelle;Club des Merles',
      'Pervenche;Club des Merles',
      'Sarcelle;Chorale d\u{2019}\u{E9}t\u{E9}',
      'Bruyère;Chorale d\u{2019}e\u{301}te\u{301}',
    ));
    assert.deepEqual(apercu.fusions, []);
    assert.deepEqual(apercu.lignes.map(({ champs: lus }) => lus.appartenance), [
      'Club des Merles', 'Club des Merles', 'Chorale d\u{2019}\u{E9}t\u{E9}', 'Chorale d\u{2019}\u{E9}t\u{E9}',
    ]);
  });

  test("une appartenance vide vaut absence, jamais une appartenance nommée « »", () => {
    const participants = [existant(1, 'Houle', null, null), existant(2, 'Givre', null, '')];
    const apercu = apercevoir(csv('nom;appartenance', 'Ombrelle;', 'Pervenche;   ', 'Sarcelle;\u{A0}'), { participants });
    assert.deepEqual(apercu.lignes.map(({ champs: lus }) => lus.appartenance), [null, null, null]);
    assert.deepEqual(apercu.fusions, []);
  });

  test("une appartenance blanche ou faite de marques combinantes seules vaut absence, dans le fichier comme chez un existant", () => {
    // Sa clé normalisée est vide, celle que la clé de doublon donne à une
    // appartenance absente : elle n'est l'orthographe d'aucun groupe.
    const participants = [existant(1, 'Houle', null, '   '), existant(2, 'Givre', null, '\u{301}')];
    const apercu = apercevoir(csv('nom;appartenance', 'Ombrelle;\u{301}', 'Pervenche;\u{301}\u{20DD}', 'Givre;'), {
      participants,
    });
    assert.deepEqual(apercu.lignes.map(({ champs: lus }) => lus.appartenance), [null, null, null]);
    assert.deepEqual(apercu.fusions, []);
    assert.deepEqual(apercu.doublons, [{ cle: '["givre","",""]', lignes: [4], existants: [2] }]);
  });

  test("un trait d'union, un trait de soulignement ou une espace de moins distinguent deux appartenances", () => {
    // La clé d'en-tête les ignore, la clé normalisée non : la réconciliation
    // compare par la seconde, comme la clé de doublon.
    const orthographes = ['Club des Merles', 'Club-des-Merles', 'Club_des_Merles', 'Clubdes Merles', 'Val-Brume', 'Val Brume'];
    const apercu = apercevoir(csv('nom;appartenance', ...orthographes.map((orthographe, rang) => `${PATRONYMES[rang]};${orthographe}`)));
    assert.deepEqual(apercu.fusions, []);
    assert.deepEqual(apercu.lignes.map(({ champs: lus }) => lus.appartenance), orthographes);
  });

  test("les orthographes existantes d'abord, par identifiant croissant, puis celles du fichier", () => {
    const participants = [existant(7, 'Givre', null, 'cooperative bleue'), existant(3, 'Houle', null, 'Coopérative Bleue')];
    const apercu = apercevoir(csv('nom;appartenance', 'Ombrelle;COOPÉRATIVE BLEUE'), { participants });
    assert.deepEqual(apercu.fusions, [
      {
        affichee: 'Coopérative Bleue',
        orthographes: [
          { texte: 'Coopérative Bleue', lignes: [] },
          { texte: 'cooperative bleue', lignes: [] },
          { texte: 'COOPÉRATIVE BLEUE', lignes: [2] },
        ],
      },
    ]);
  });

  test("l'orthographe existante s'affiche telle qu'elle est enregistrée", () => {
    const participants = [existant(4, 'Houle', null, 'Club des Merles ')];
    const apercu = apercevoir(csv('nom;appartenance', 'Ombrelle;club des merles'), { participants });
    assert.equal(apercu.lignes[0].champs.appartenance, 'Club des Merles ');
    assert.equal(apercu.fusions[0].affichee, 'Club des Merles ');
  });

  test("un groupe sans ligne du fichier n'est pas une fusion de l'import", () => {
    const participants = [existant(3, 'Houle', null, 'Coopérative Bleue'), existant(7, 'Givre', null, 'cooperative bleue')];
    const apercu = apercevoir(csv('nom;appartenance', 'Ombrelle;Club des Merles'), { participants });
    assert.deepEqual(apercu.fusions, []);
  });

  test("la ligne qui reprend l'orthographe existante n'ajoute pas d'orthographe", () => {
    const participants = [existant(1, 'Houle', null, 'Club des Merles')];
    const apercu = apercevoir(csv('nom;appartenance', 'Ombrelle;Club des Merles'), { participants });
    assert.deepEqual(apercu.fusions, []);
    assert.equal(apercu.lignes[0].champs.appartenance, 'Club des Merles');
  });

  test('deux groupes, rangés par leur première ligne du fichier', () => {
    const participants = [existant(1, 'Houle', null, 'chorale du givre')];
    const apercu = apercevoir(
      csv(
        'nom;appartenance',
        'Ombrelle;Club des Merles',
        'Pervenche;Chorale du Givre',
        'Sarcelle;club des merles',
        'Bruyère;CHORALE DU GIVRE',
      ),
      { participants },
    );
    assert.deepEqual(apercu.fusions, [
      {
        affichee: 'Club des Merles',
        orthographes: [
          { texte: 'Club des Merles', lignes: [2] },
          { texte: 'club des merles', lignes: [4] },
        ],
      },
      {
        affichee: 'chorale du givre',
        orthographes: [
          { texte: 'chorale du givre', lignes: [] },
          { texte: 'Chorale du Givre', lignes: [3] },
          { texte: 'CHORALE DU GIVRE', lignes: [5] },
        ],
      },
    ]);
    assert.deepEqual(apercu.lignes.map(({ champs: lus }) => lus.appartenance), [
      'Club des Merles', 'chorale du givre', 'Club des Merles', 'chorale du givre',
    ]);
  });

  test("une ligne refusée ne prend part à aucun groupe", () => {
    const apercu = apercevoir(csv(
      'nom;appartenance;exclu',
      'Ombrelle;CLUB DES MERLES;peut-être',
      'Pervenche;Club des Merles;',
      'Sarcelle;club des merles;',
    ));
    assert.deepEqual(apercu.fusions, [
      {
        affichee: 'Club des Merles',
        orthographes: [
          { texte: 'Club des Merles', lignes: [3] },
          { texte: 'club des merles', lignes: [4] },
        ],
      },
    ]);
  });
});

describe('apercevoir : les doublons, signalés et jamais fusionnés (§ 10.1)', () => {
  test('deux lignes du même triplet normalisé : un doublon, et deux lignes restent deux', () => {
    const apercu = apercevoir(csv(
      'nom;prenom;appartenance',
      'Ombrelle;Iris;Club des Merles',
      'OMBRELLE; iris ;club  des merles',
      'Ombrelle;Iris;Chorale du Givre',
    ));
    assert.deepEqual(apercu.lignes.map(({ ligne }) => ligne), [2, 3, 4]);
    assert.deepEqual(apercu.doublons, [
      { cle: '["ombrelle","iris","club des merles"]', lignes: [2, 3], existants: [] },
    ]);
  });

  test("une ligne du triplet d'un participant existant : ses identifiants, croissants", () => {
    const participants = [existant(9, 'Ombrelle', 'Iris', 'Club des Merles'), existant(4, 'ombrelle', 'IRIS', 'club des merles')];
    const apercu = apercevoir(csv('nom;prenom;appartenance', 'Ombrelle;Iris;Club des Merles'), { participants });
    assert.deepEqual(apercu.doublons, [
      { cle: '["ombrelle","iris","club des merles"]', lignes: [2], existants: [4, 9] },
    ]);
    assert.equal(apercu.lignes.length, 1);
  });

  test("un triplet qui diffère par le prénom ou par l'appartenance n'est pas un doublon", () => {
    const participants = [existant(1, 'Ombrelle', 'Ondine', null)];
    const apercu = apercevoir(
      csv(
        'nom;prenom;appartenance',
        'Ombrelle;Iris;Club des Merles',
        'Ombrelle;Iris;Chorale du Givre',
        'Ombrelle;;Club des Merles',
        'Ombrelle;Ondine;Club des Merles',
      ),
      { participants },
    );
    assert.deepEqual(apercu.doublons, []);
  });

  test("un nom seul : le prénom et l'appartenance absents comptent comme vides", () => {
    const participants = [existant(2, 'Givre', '', null)];
    const apercu = apercevoir(csv('nom', 'Givre', 'givre ', 'Houle'), { participants });
    assert.equal(apercu.separateur, null);
    assert.deepEqual(apercu.doublons, [{ cle: '["givre","",""]', lignes: [2, 3], existants: [2] }]);
  });

  test('les doublons, rangés par leur première ligne du fichier, non par leur premier existant', () => {
    const participants = [existant(1, 'Givre', 'Théo', null)];
    const apercu = apercevoir(csv('nom;prenom', 'Houle;Iris', 'Givre;Théo', 'Givre;The\u{301}o', 'Houle;Iris'), {
      participants,
    });
    assert.deepEqual(apercu.doublons, [
      { cle: '["houle","iris",""]', lignes: [2, 5], existants: [] },
      { cle: '["givre","theo",""]', lignes: [3, 4], existants: [1] },
    ]);
  });

  test("un triplet propre aux participants existants n'est pas un doublon de l'import ; une ligne refusée non plus", () => {
    const participants = [existant(1, 'Givre', null, null), existant(2, 'Givre', null, null)];
    const apercu = apercevoir(csv('nom;exclu', 'Houle;non', 'Houle;peut-être'), { participants });
    assert.deepEqual(apercu.doublons, []);
  });
});

describe("apercevoir : le mode de l'import (§ 10.1)", () => {
  // Deux participants existants, dont l'appartenance de l'un s'écrit
  // autrement dans le fichier.
  const participants = [existant(1, 'Ombrelle', 'Iris', 'Club des Merles'), existant(2, 'Lacasse', 'Ondine', null)];
  const texte = csv('nom;prenom;appartenance', 'Ombrelle;Iris;club des merles', 'Lacasse;Ondine;', 'Lacasse;Ondine;');

  test("ajouter, par défaut, et mettre à jour lisent le fichier contre les existants : doublons et fusions les comptent", () => {
    for (const mode of [undefined, 'ajouter', 'mettreAJour']) {
      const apercu = apercevoir(texte, { participants, mode });
      assert.equal(apercu.mode, mode ?? 'ajouter');
      assert.deepEqual(apercu.doublons, [
        { cle: '["ombrelle","iris","club des merles"]', lignes: [2], existants: [1] },
        { cle: '["lacasse","ondine",""]', lignes: [3, 4], existants: [2] },
      ], String(mode));
      assert.deepEqual(apercu.fusions, [
        { affichee: 'Club des Merles', orthographes: [{ texte: 'Club des Merles', lignes: [] }, { texte: 'club des merles', lignes: [2] }] },
      ], String(mode));
      assert.equal(apercu.lignes[0].champs.appartenance, 'Club des Merles', String(mode));
    }
  });

  test("remplacer retire chaque existant : aucune ligne n'en est le doublon, aucune orthographe existante ne s'affiche ni ne fond", () => {
    const apercu = apercevoir(texte, { participants, mode: 'remplacer' });
    assert.equal(apercu.mode, 'remplacer');
    assert.deepEqual(apercu.doublons, [{ cle: '["lacasse","ondine",""]', lignes: [3, 4], existants: [] }]);
    assert.deepEqual(apercu.fusions, []);
    assert.equal(apercu.lignes[0].champs.appartenance, 'club des merles');
    assert.deepEqual(apercu, apercevoir(texte, { participants: [], mode: 'remplacer' }));
  });

  test("mettre à jour nomme chaque ligne qu'il ajoute à côté d'un existant de même nom, que le prénom ou l'appartenance écarte des deux côtés", () => {
    // Iris passe du Club des Merles à la Société Alpha : la ligne ne désigne
    // personne, et l'import ajouterait une seconde Iris Ombrelle.
    const existants = [
      existant(1, 'Ombrelle', 'Iris', 'Club des Merles'),
      existant(2, 'Ombrelle', 'Théo', null),
      existant(3, 'Lacasse', 'Ondine', null),
    ];
    const changeDeClub = csv(
      'nom;prenom;appartenance',
      // Iris écarte 2, la Société Alpha écarte 1 : un homonyme de 1 et 2.
      'OMBRELLE;Iris;Société Alpha',
      // Désigne 3, qui n'a pas d'appartenance : aucun homonyme.
      'Lacasse;Ondine;Club des Merles',
      // Aucun existant de ce nom : un ajout, pas un homonyme.
      'Pervenche;Théo;',
      // Sans prénom ni appartenance : les deux Ombrelle, un refus de
      // l'import, pas un ajout.
      'Ombrelle;;',
      // Désigne 2, sans prénom ni appartenance de part et d'autre.
      'Ombrelle;Théo;Chorale du Givre',
    );
    assert.deepEqual(apercevoir(changeDeClub, { participants: existants, mode: 'mettreAJour' }).homonymes, [
      { ligne: 2, participants: [1, 2] },
    ]);
    // Ajouter et remplacer n'en nomment aucun : ajouter crée chaque ligne,
    // remplacer retire chaque existant.
    for (const mode of ['ajouter', 'remplacer']) {
      assert.deepEqual(apercevoir(changeDeClub, { participants: existants, mode }).homonymes, [], mode);
    }
    // Les lignes qui désignent un existant ne retirent rien aux candidats
    // des suivantes ; les identifiants sont croissants, quel que soit
    // l'ordre des existants.
    const inverse = csv('nom;prenom', 'Ombrelle;Théo', 'Ombrelle;Iris', 'Ombrelle;Anouk');
    assert.deepEqual(
      apercevoir(inverse, { participants: [existants[1], existants[0]], mode: 'mettreAJour' }).homonymes,
      [{ ligne: 4, participants: [1, 2] }],
    );
  });

  test('un aperçu refusé porte son mode', () => {
    assert.equal(apercevoir('', { mode: 'remplacer' }).mode, 'remplacer');
    assert.equal(apercevoir(csv('prenom', 'Iris'), { mode: 'mettreAJour' }).mode, 'mettreAJour');
  });

  test('un mode inconnu : TypeError, qui nomme les trois modes', () => {
    assert.throws(() => apercevoir(texte, { mode: 'fusionner' }), {
      name: 'TypeError',
      message: 'mode : ajouter, mettreAJour, remplacer attendu, reçu fusionner',
    });
  });
});

describe('apercevoir : la réconciliation et la clé de doublon, une seule forme normalisée (§ 10.1)', () => {
  test('deux personnes du même nom et du même prénom forment un doublon si et seulement si leurs appartenances se fondent', () => {
    // Chaque orthographe éprouve une dimension de la clé : casse, accent
    // composé ou décomposé, blancs, trait d'union, trait de soulignement,
    // absence. L'appartenance affichée d'une ligne désigne son groupe ; une
    // appartenance absente n'en a aucun, et la clé de doublon la compte vide.
    const orthographes = [
      'Club des Merles', 'CLUB DES MERLES', ' club  des\u{A0}merles ', 'Clu\u{301}b des Merles', 'Club-des-Merles',
      'Club_des_Merles', 'Clubdes Merles', 'Val-Brume', 'Val Brume', 'VAL BRUME', '', '   ', '\u{301}',
    ];
    const participants = [existant(1, 'Ombrelle', 'Iris', 'club des merles')];
    const apercu = apercevoir(
      csv('nom;prenom;appartenance', ...orthographes.map((orthographe) => `Ombrelle;Iris;${orthographe}`)),
      { participants },
    );
    // Les groupes attendus : la propriété ne se vérifie pas sur du vide.
    assert.deepEqual(apercu.lignes.map(({ champs: lus }) => lus.appartenance), [
      'club des merles', 'club des merles', 'club des merles', 'club des merles', 'Club-des-Merles',
      'Club_des_Merles', 'Clubdes Merles', 'Val-Brume', 'Val Brume', 'Val Brume', null, null, null,
    ]);
    const doublonDe = new Map();
    apercu.doublons.forEach(({ lignes }, rang) => {
      for (const ligne of lignes) doublonDe.set(ligne, rang);
    });
    for (const a of apercu.lignes) {
      const avecExistant = apercu.doublons.some(({ lignes, existants }) => lignes.includes(a.ligne) && existants.includes(1));
      assert.equal(avecExistant, a.champs.appartenance === 'club des merles', `ligne ${a.ligne} et l'existant`);
      for (const b of apercu.lignes) {
        if (b.ligne <= a.ligne) continue;
        const memeDoublon = doublonDe.has(a.ligne) && doublonDe.get(a.ligne) === doublonDe.get(b.ligne);
        assert.equal(memeDoublon, a.champs.appartenance === b.champs.appartenance, `lignes ${a.ligne} et ${b.ligne}`);
      }
    }
  });
});

describe('apercevoir : les refus globaux (§ 10.1)', () => {
  test("aucun en-tête reconnu : AUCUN_ENTETE, les en-têtes et l'association rendus", () => {
    assert.deepEqual(
      apercevoir(csv('personne;groupe', 'Ombrelle;Club des Merles')),
      refusGlobal('AUCUN_ENTETE', {
        separateur: ';',
        entetes: ['personne', 'groupe'],
        association: { colonnes: {}, ambigus: [], nonReconnues: [0, 1] },
      }),
    );
  });

  test('un texte vide ou blanc : AUCUN_ENTETE', () => {
    for (const texte of ['', '\r\n', ' \t\r\n\r\n\u{A0}']) {
      assert.deepEqual(apercevoir(texte), refusGlobal('AUCUN_ENTETE'), JSON.stringify(texte));
    }
  });

  test('aucune colonne associée à nom : NOM_NON_ASSOCIE', () => {
    assert.deepEqual(
      apercevoir(csv('prenom;appartenance', 'Iris;Club des Merles')),
      refusGlobal('NOM_NON_ASSOCIE', {
        separateur: ';',
        entetes: ['prenom', 'appartenance'],
        association: { colonnes: { prenom: 0, appartenance: 1 }, ambigus: [], nonReconnues: [] },
      }),
    );
  });

  test('deux colonnes nom : NOM_NON_ASSOCIE, tant que le choix ne tranche pas', () => {
    const texte = csv('Nom;NOM;prenom', 'Ombrelle;Givre;Iris');
    assert.deepEqual(
      apercevoir(texte),
      refusGlobal('NOM_NON_ASSOCIE', {
        separateur: ';',
        entetes: ['Nom', 'NOM', 'prenom'],
        association: { colonnes: { prenom: 2 }, ambigus: [{ champ: 'nom', rangs: [0, 1] }], nonReconnues: [] },
      }),
    );
    const tranche = apercevoir(texte, { choix: { nom: 1 } });
    assert.equal(tranche.refusGlobal, null);
    assert.deepEqual(tranche.lignes, [
      { ligne: 2, champs: champs({ nom: 'Givre', prenom: 'Iris' }), brut: ['Ombrelle', 'Givre', 'Iris'] },
    ]);
  });

  test('zéro ligne valide : AUCUNE_LIGNE_VALIDE, les lignes refusées rendues', () => {
    assert.deepEqual(apercevoir(csv('nom;exclu', ';oui', 'Ardoise;peut-être')), {
      ...refusGlobal('AUCUNE_LIGNE_VALIDE', {
        separateur: ';',
        entetes: ['nom', 'exclu'],
        association: { colonnes: { nom: 0, exclu: 1 }, ambigus: [], nonReconnues: [] },
      }),
      refusees: [
        { ligne: 2, code: 'NOM_ABSENT', valeur: null, brut: ['', 'oui'] },
        { ligne: 3, code: 'EXCLU_INCONNU', valeur: 'peut-être', brut: ['Ardoise', 'peut-être'] },
      ],
    });
  });

  test("l'en-tête seul, ou suivi de lignes vides : AUCUNE_LIGNE_VALIDE", () => {
    for (const texte of [csv('nom;prenom'), 'nom;prenom', csv('nom'), csv('nom;prenom', '', ';', '  ;  ')]) {
      const apercu = apercevoir(texte);
      assert.equal(apercu.refusGlobal, 'AUCUNE_LIGNE_VALIDE', JSON.stringify(texte));
      assert.deepEqual(apercu.refusees, []);
    }
  });

  test("un guillemet ouvert jusqu'à la fin : GUILLEMET_OUVERT, au rang où il s'ouvre", () => {
    // Au-delà de la fenêtre du séparateur : sans le refus, Pervenche entrerait
    // dans les notes d'Ombrelle, deux personnes fondues en une.
    const texte = csv(
      'nom;notes',
      ...fenetre((patronyme) => `${patronyme};x`),
      'Ombrelle;"arrive tard',
      'Pervenche;rien à signaler',
    );
    assert.deepEqual(
      apercevoir(texte),
      refusGlobal(
        'GUILLEMET_OUVERT',
        {
          separateur: ';',
          entetes: ['nom', 'notes'],
          association: { colonnes: { nom: 0, notes: 1 }, ambigus: [], nonReconnues: [] },
        },
        21,
      ),
    );
  });

  test("un guillemet ouvert l'emporte sur un en-tête inconnu : le texte est faux avant d'être mal nommé", () => {
    for (const rang of [2, 21]) {
      const texte = csv('personne;groupe', ...fenetre((patronyme) => `${patronyme};x`, rang - 2), 'Ombrelle;"arrive tard');
      assert.deepEqual(
        apercevoir(texte),
        refusGlobal(
          'GUILLEMET_OUVERT',
          {
            separateur: ';',
            entetes: ['personne', 'groupe'],
            association: { colonnes: {}, ambigus: [], nonReconnues: [0, 1] },
          },
          rang,
        ),
        String(rang),
      );
    }
  });

  test("un guillemet ouvert dans un fichier à une colonne : GUILLEMET_OUVERT", () => {
    assert.deepEqual(
      apercevoir(csv('nom', 'Ombrelle', '"Pervenche', 'Sarcelle')),
      refusGlobal(
        'GUILLEMET_OUVERT',
        { separateur: null, entetes: ['nom'], association: { colonnes: { nom: 0 }, ambigus: [], nonReconnues: [] } },
        3,
      ),
    );
  });

  test("un guillemet ouvert dans la fenêtre du séparateur : GUILLEMET_OUVERT, au rang où il s'ouvre", () => {
    // choisirSeparateur écarte chaque candidat, l'un pour son guillemet
    // ouvert, les autres pour leur champ unique. Sans le refus, Pervenche
    // entrerait dans les notes d'Ombrelle.
    for (const separateur of [';', ',', '\t']) {
      const ligne = (...valeurs) => valeurs.join(separateur);
      const texte = csv(ligne('nom', 'prenom', 'notes'), ligne('Ombrelle', 'Iris', '"arrive tard'), ligne('Pervenche', 'Théo', ''));
      assert.deepEqual(
        apercevoir(texte),
        refusGlobal(
          'GUILLEMET_OUVERT',
          {
            separateur,
            entetes: ['nom', 'prenom', 'notes'],
            association: { colonnes: { nom: 0, prenom: 1, notes: 2 }, ambigus: [], nonReconnues: [] },
          },
          2,
        ),
        JSON.stringify(texte),
      );
    }
  });

  test("le même refus de part et d'autre de la fenêtre : GUILLEMET_OUVERT au rang 2, au rang 20, au rang 21", () => {
    for (const rang of [2, 20, 21]) {
      const texte = csv('nom;notes', ...fenetre((patronyme) => `${patronyme};x`, rang - 2), 'Ombrelle;"arrive tard');
      assert.deepEqual(
        apercevoir(texte),
        refusGlobal(
          'GUILLEMET_OUVERT',
          {
            separateur: ';',
            entetes: ['nom', 'notes'],
            association: { colonnes: { nom: 0, notes: 1 }, ambigus: [], nonReconnues: [] },
          },
          rang,
        ),
        String(rang),
      );
    }
  });

  test("un guillemet égaré au-delà de la fenêtre, refermé plus loin sur une lettre : GUILLEMET_OUVERT au rang où il s'ouvre, aucune personne fondue dans une autre", () => {
    // Vingt-cinq enregistrements : la note du rang 23 ouvre un guillemet que
    // rien ne referme à sa place ; celui de « "Bob" », au rang 25, le
    // referme, suivi d'une lettre. Les rangs 24 et 25 tiendraient sinon dans
    // la note du rang 23, et l'aperçu compterait 22 lignes sans un refus.
    const lignes = Array.from({ length: 21 }, (_, i) => `Nom${i + 1};Pre${i + 1};`);
    const texte = csv('nom;prenom;notes', ...lignes, 'Nom22;Pre22;"VIP au fond', 'Nom23;Pre23;', 'Nom24;Pre24;surnommé "Bob" par tous');
    assert.deepEqual(
      apercevoir(texte),
      refusGlobal(
        'GUILLEMET_OUVERT',
        {
          separateur: ';',
          entetes: ['nom', 'prenom', 'notes'],
          association: { colonnes: { nom: 0, prenom: 1, notes: 2 }, ambigus: [], nonReconnues: [] },
        },
        23,
      ),
    );
    // Le même texte dont la note se referme à sa place s'importe en entier.
    const referme = texte.replace('"VIP au fond', '"VIP au fond"');
    assert.equal(apercevoir(referme).refusGlobal, null);
    assert.equal(apercevoir(referme).lignes.length, 24);
  });

  test("un guillemet égaré refermé plus loin par un pouce, au-delà de la fenêtre : la cellule fondue est nommée, à son rang", () => {
    // Le guillemet de « écran 27" » referme la note ouverte au rang 23 :
    // les rangs 24 et 25 tiennent dans cette note, que rien ne refuse.
    // L'aperçu nomme la cellule, qui s'étend sur plusieurs lignes du texte
    // et porte le séparateur.
    const lignes = Array.from({ length: 21 }, (_, i) => `Nom${i + 1};Pre${i + 1};`);
    const texte = csv('nom;prenom;notes', ...lignes, 'Nom22;Pre22;"VIP au fond', 'Nom23;Pre23;', 'Nom24;Pre24;écran 27"', 'Nom25;Pre25;');
    const apercu = apercevoir(texte);
    assert.equal(apercu.refusGlobal, null);
    assert.equal(apercu.lignes.length, 23);
    assert.equal(apercu.lignes[21].champs.notes, 'VIP au fond\r\nNom23;Pre23;\r\nNom24;Pre24;écran 27');
    assert.deepEqual(apercu.multilignes, [{ ligne: 23, rangs: [2] }]);
  });

  test("une cellule nommée : sur plusieurs lignes du texte et portant le séparateur, dans la fenêtre comme au-delà ; un nom sur plusieurs lignes d'un fichier à une colonne", () => {
    // Dans la fenêtre, le guillemet égaré du rang 3 se referme au rang 4 :
    // l'enregistrement fondu a la largeur de l'en-tête, et le séparateur
    // est retenu.
    const fondu = csv('nom;prenom;notes', 'Ombrelle;Iris;', 'Lacasse;Ondine;"à l\'entrée', 'Pervenche;Théo;écran 27"', 'Givre;Silas;');
    assert.deepEqual(apercevoir(fondu).multilignes, [{ ligne: 3, rangs: [2] }]);
    // Une note sur plusieurs lignes sans le séparateur, ou le séparateur
    // sur une seule ligne, n'est pas nommée ; une cellule qui porte les
    // deux l'est, une fois par cellule, quel que soit le séparateur.
    const notes = csv(
      'nom,prenom,appartenance,notes',
      'Ombrelle,Iris,"Club, nord","arrive tôt\nrepart tard"',
      'Lacasse,Ondine,"Chorale\ndu Givre","noix, arachides\r\nsans gluten"',
      'Pervenche,Théo,,"au fond\rprès de la scène, côté jardin"',
    );
    assert.deepEqual(apercevoir(notes).multilignes, [{ ligne: 3, rangs: [3] }, { ligne: 4, rangs: [3] }]);
    // Fichier à une colonne : un nom ne s'étend jamais sur deux lignes, et
    // aucun séparateur n'est à chercher.
    assert.deepEqual(apercevoir(csv('nom', 'Ombrelle', '"Lacasse', 'Pervenche"', 'Givre')).multilignes, [
      { ligne: 3, rangs: [0] },
    ]);
    // Une ligne refusée revient dans le CSV des refus : elle n'est pas
    // nommée ici.
    const refusee = csv('nom;notes;exclu', 'Ombrelle;"a\nb;c";peut-être', 'Lacasse;;');
    assert.deepEqual(apercevoir(refusee).multilignes, []);
  });

  test("sous GUILLEMET_OUVERT, l'association suit le choix, dans la fenêtre comme au-delà", () => {
    for (const rang of [2, 21]) {
      const texte = csv('nom;organisation;entreprise', ...fenetre((patronyme) => `${patronyme};x;y`, rang - 2), 'Ombrelle;"x');
      const apercu = apercevoir(texte, { choix: { appartenance: 2 } });
      assert.equal(apercu.refusGlobal, 'GUILLEMET_OUVERT', String(rang));
      assert.deepEqual(apercu.association, { colonnes: { nom: 0, appartenance: 2 }, ambigus: [], nonReconnues: [] }, String(rang));
    }
  });

  test("le refus suit la lecture dont l'en-tête porte le plus d'en-têtes reconnus, puis l'ordre « ; », « , », tabulation", () => {
    // Collé d'un tableur, un en-tête qui porte un « ; » compte deux champs
    // sous « ; » aussi, aucun reconnu : lu ainsi, le texte serait refusé au
    // rang 2, là où le défaut est le guillemet du rang 3.
    assert.deepEqual(
      apercevoir(csv('nom\tprenom\tnotes; remarques', 'Ombrelle\tIris\tx', 'Pervenche\tThéo\t"arrive tard')),
      refusGlobal(
        'GUILLEMET_OUVERT',
        {
          separateur: '\t',
          entetes: ['nom', 'prenom', 'notes; remarques'],
          association: { colonnes: { nom: 0, prenom: 1 }, ambigus: [], nonReconnues: [2] },
        },
        3,
      ),
    );
    // À égalité, aucun en-tête reconnu, « ; » passe avant « , ».
    assert.deepEqual(
      apercevoir(csv('personne;groupe,section', 'Ombrelle;"arrive tard')),
      refusGlobal(
        'GUILLEMET_OUVERT',
        {
          separateur: ';',
          entetes: ['personne', 'groupe,section'],
          association: { colonnes: {}, ambigus: [], nonReconnues: [0, 1] },
        },
        2,
      ),
    );
  });

  test("un enregistrement de la fenêtre qui n'a pas le nombre de champs de l'en-tête : SEPARATEUR_INTROUVABLE, à son rang", () => {
    // Le § 10.1 veut le même nombre de champs partout dans les vingt premiers
    // enregistrements : aucun séparateur ne convient, le texte entier est
    // refusé, et le refus nomme la ligne à corriger. Au-delà, le même
    // enregistrement n'est qu'une ligne refusée, ou complétée de null.
    const cas = [
      [csv('nom;prenom;notes', 'Ombrelle;Iris;arrive tard; vers 20 h', 'Pervenche;Théo;'), 2],
      [csv('nom;prenom;appartenance', 'Ombrelle;Iris', 'Pervenche;Théo;Club des Merles'), 2],
      [csv('nom;prenom;notes', 'Ombrelle;Iris;', 'Pervenche;Théo;arrive tard; vers 20 h', 'Sarcelle;Ondine;'), 3],
      [csv('nom;prenom', 'Ombrelle'), 2],
      // Un enregistrement vide ne compte pas, avant l'en-tête ni après.
      [csv('', 'nom;prenom', '', ';;', 'Ombrelle;Iris', 'Pervenche'), 6],
      // Le premier défaut dans l'ordre du texte : l'enregistrement court
      // passe avant le guillemet ouvert qui le suit.
      [csv('nom;prenom;notes', 'Ombrelle;Iris', 'Pervenche;Théo;"arrive tard'), 2],
      // Le dernier enregistrement de la fenêtre.
      [csv('nom;prenom', ...fenetre((patronyme) => `${patronyme};x`, 18), 'Ombrelle;Iris;Club des Merles'), 20],
    ];
    for (const [texte, rang] of cas) {
      assert.deepEqual(apercevoir(texte), refusGlobal('SEPARATEUR_INTROUVABLE', {}, rang), JSON.stringify(texte));
    }
  });

  test("aucune lecture ne donne à l'en-tête deux champs : SEPARATEUR_INTROUVABLE, sans rang", () => {
    // Une colonne unique d'en-tête inconnu, guillemet ouvert compris : aucune
    // lecture à un champ ne désigne de séparateur ; un séparateur hors des
    // trois candidats ; un guillemet ouvert dès l'en-tête, qui n'en laisse
    // aucun terminé ; vingt lignes vides, qui laissent la fenêtre sans
    // en-tête, et ce qui les suit sans effet sur le refus.
    const vingtLignesVides = Array.from({ length: 20 }, () => '');
    const textes = [
      csv('personnes', 'Ombrelle'),
      csv('personnes', '"Ombrelle'),
      csv('nom|prenom', 'Ombrelle|"Iris'),
      csv('nom;"prenom', 'Ombrelle;Iris'),
      csv(...vingtLignesVides, 'nom;prenom', 'Ombrelle;Iris;Club des Merles'),
      csv(...vingtLignesVides, 'nom;prenom', 'Ombrelle;"Iris'),
    ];
    for (const texte of textes) {
      assert.deepEqual(apercevoir(texte), refusGlobal('SEPARATEUR_INTROUVABLE'), JSON.stringify(texte));
    }
  });

  test("des lignes vides insérées avant un guillemet ouvert ne changent pas le refus, en deçà de la fenêtre comme au-delà", () => {
    // Une ligne vide ne compte ni pour le choix du séparateur ni pour
    // l'aperçu : elle repousse d'un rang ce qui la suit. De zéro à quarante
    // lignes vides, le guillemet passe des vingt enregistrements que lit
    // choisirSeparateur, où il écarte le séparateur et où le refus nomme ce
    // qui l'écarte, à l'au-delà, où le texte se lit sous le séparateur
    // retenu. Les deux rendent le même refus : le guillemet à son rang, ou le
    // défaut qui le précède au sien. Chaque cas éprouve une part de la règle
    // du § 10.1 : les trois candidats, et eux seuls ; leur ordre ; le
    // départage par les en-têtes reconnus ; un en-tête d'au moins deux
    // champs ; le même nombre de champs partout.
    const lu = (separateur, entetes, colonnes, nonReconnues = []) => ({
      separateur,
      entetes,
      association: { colonnes, ambigus: [], nonReconnues },
    });
    // L'espace et chaque signe ASCII qui n'est ni une lettre, ni un chiffre,
    // ni le guillemet, ni un candidat : l'en-tête n'a qu'un champ, inconnu,
    // et le guillemet, au milieu d'un champ, n'ouvre rien.
    const autresSignes = Array.from({ length: 0x7f - 0x20 }, (_, i) => String.fromCharCode(0x20 + i)).filter(
      (signe) => !/[\p{L}\p{N}";,]/u.test(signe),
    );
    const cas = [
      ...[';', ',', '\t'].map((signe) => ({
        avant: [`nom${signe}prenom`, `Pervenche${signe}Théo`],
        guillemet: `Ombrelle${signe}"Iris`,
        code: 'GUILLEMET_OUVERT',
        etabli: lu(signe, ['nom', 'prenom'], { nom: 0, prenom: 1 }),
      })),
      ...autresSignes.map((signe) => ({
        avant: [`nom${signe}prenom`, `Pervenche${signe}Théo`],
        guillemet: `Ombrelle${signe}"Iris`,
        code: 'SEPARATEUR_INTROUVABLE',
      })),
      // L'en-tête a deux champs sous « ; » comme sous « , », aucun reconnu :
      // « ; » passe avant « , ». Un guillemet en tête de ligne s'ouvre sous
      // chaque candidat.
      {
        avant: ['personne;groupe,section', 'Pervenche;Théo,x'],
        guillemet: '"Ombrelle;y,z',
        code: 'GUILLEMET_OUVERT',
        etabli: lu(';', ['personne', 'groupe,section'], {}, [0, 1]),
      },
      // Sous « , », l'en-tête porte un en-tête reconnu, sous « ; » aucun :
      // « , » l'emporte.
      {
        avant: ['personne;nom,prenom', 'Pervenche;Théo,x'],
        guillemet: '"Ombrelle;y,z',
        code: 'GUILLEMET_OUVERT',
        etabli: lu(',', ['personne;nom', 'prenom'], { prenom: 1 }, [0]),
      },
      // Un enregistrement plus court, puis plus long, que l'en-tête : le refus
      // reste au rang de l'enregistrement, quel que soit celui du guillemet.
      { avant: ['nom;prenom;notes', 'Pervenche;Théo'], guillemet: 'Ombrelle;Iris;"x', code: 'SEPARATEUR_INTROUVABLE', rang: 2 },
      { avant: ['nom;prenom', 'Pervenche;Théo;x'], guillemet: 'Ombrelle;"Iris', code: 'SEPARATEUR_INTROUVABLE', rang: 2 },
      // Une colonne unique : reconnue, elle se lit sans séparateur ; inconnue,
      // rien ne se lit.
      { avant: ['nom', 'Pervenche'], guillemet: '"Ombrelle', code: 'GUILLEMET_OUVERT', etabli: lu(null, ['nom'], { nom: 0 }) },
      { avant: ['personnes', 'Pervenche'], guillemet: '"Ombrelle', code: 'SEPARATEUR_INTROUVABLE' },
    ];
    for (const { avant, guillemet, code, etabli = {}, rang = null } of cas) {
      for (let vides = 0; vides <= 40; vides += 1) {
        const texte = csv(...avant, ...new Array(vides).fill(''), guillemet);
        const rangDuRefus = code === 'GUILLEMET_OUVERT' ? avant.length + vides + 1 : rang;
        assert.deepEqual(
          apercevoir(texte),
          refusGlobal(code, etabli, rangDuRefus),
          `${JSON.stringify(avant[0])} … ${JSON.stringify(guillemet)}, ${vides} lignes vides`,
        );
      }
    }
  });

  test("un caractère nul refuse le texte entier : CARACTERE_NUL, avant toute lecture", () => {
    const textes = [
      '\u{0}',
      csv('nom\u{0};prenom', 'Ombrelle;Iris'),
      csv('nom;prenom', 'Ombrelle;Iris\u{0}'),
      `${csv('nom;prenom', 'Ombrelle;Iris')}\u{0}`,
      csv('nom;notes', 'Ombrelle;"ouvert\u{0}'),
    ];
    for (const texte of textes) {
      assert.deepEqual(apercevoir(texte), refusGlobal('CARACTERE_NUL'), JSON.stringify(texte));
    }
  });

  test('le caractère nul suit la règle de contientNul, la même que pour un fichier décodé', () => {
    const textes = [
      csv('nom', 'Ombrelle\u{0}'),
      csv('nom', 'Ombrelle\u{2400}'),
      csv('nom', 'Ombrelle\\0'),
      csv('nom', 'Ombrelle0'),
      csv('nom', 'Ombrelle\u{1}\u{7F}'),
      csv('\u{0}nom', 'Ombrelle'),
    ];
    const refuses = textes.map((texte) => apercevoir(texte).refusGlobal === 'CARACTERE_NUL');
    assert.deepEqual(refuses, textes.map((texte) => contientNul(texte)));
    assert.deepEqual(refuses, [true, false, false, false, false, true]);
  });
});

// Le texte qu'un collage depuis un tableur donne : tabulations, CRLF, et une
// cellule à deux lignes, citée. C'est aussi le texte du fichier
// utf16le_tabulation.csv, l'enregistrement « Texte Unicode » d'un tableur.
const COLLAGE = csv(
  'nom\tprenom\tappartenance\tnotes',
  'Ombrelle\tIris\tCh\u{153}ur de l\u{2019}Anse\tcaf\u{E9} \u{E0} 8 h',
  'Pervenche\tTh\u{E9}o\tClub des Merles\t"dit ""oui""\r\npuis part"',
);

// Ses lignes, que rend aussi le même contenu en windows-1252, séparé par « ; ».
const LIGNES_DU_COLLAGE = [
  {
    ligne: 2,
    champs: champs({
      nom: 'Ombrelle', prenom: 'Iris', appartenance: 'Ch\u{153}ur de l\u{2019}Anse', notes: 'caf\u{E9} \u{E0} 8 h',
    }),
    brut: ['Ombrelle', 'Iris', 'Ch\u{153}ur de l\u{2019}Anse', 'caf\u{E9} \u{E0} 8 h'],
  },
  {
    ligne: 3,
    champs: champs({
      nom: 'Pervenche', prenom: 'Th\u{E9}o', appartenance: 'Club des Merles', notes: 'dit "oui"\r\npuis part',
    }),
    brut: ['Pervenche', 'Th\u{E9}o', 'Club des Merles', 'dit "oui"\r\npuis part'],
  },
];

describe("apercevoir : le collage et l'import, un seul analyseur (§ 10.2, § 14.10)", () => {
  test("le texte collé et le même texte décodé d'un fichier rendent le même aperçu", () => {
    const fichier = decoder(lireFixture('utf16le_tabulation.csv'));
    assert.equal(fichier.encodage, 'utf-16le');
    assert.equal(fichier.texte, COLLAGE);

    const colle = apercevoir(COLLAGE);
    assert.equal(colle.separateur, '\t');
    assert.deepEqual(colle.lignes, LIGNES_DU_COLLAGE);
    assert.deepEqual(apercevoir(fichier.texte), colle);

    const marque = decoder(Uint8Array.from([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(COLLAGE)]));
    assert.equal(marque.encodage, 'utf-8-bom');
    assert.deepEqual(apercevoir(marque.texte), colle);
  });

  test('le même contenu en windows-1252, séparé par « ; », rend les mêmes lignes', () => {
    const octets = lireFixture('windows1252.csv');
    assert.deepEqual(finsDeLigne(octets), { crlf: 4, isolees: 0 });
    const { texte, encodage } = decoder(octets);
    assert.equal(encodage, 'windows-1252');
    const apercu = apercevoir(texte);
    assert.equal(apercu.separateur, ';');
    assert.deepEqual(apercu.lignes, LIGNES_DU_COLLAGE);
    assert.deepEqual(apercu.entetes, apercevoir(COLLAGE).entetes);
  });
});

// Noms des fichiers de test/fixtures/csv/ que ce fichier éprouve, chacun dans
// son épreuve ci-dessous.
const DONNEES = [
  'champ_cite.csv',
  'derniere_ligne_sans_fin.csv',
  'entete_vide.csv',
  'espaces_autour.csv',
  'ligne_vide_au_milieu.csv',
  'marque_crlf.csv',
  'utf16le_tabulation.csv',
  'windows1252.csv',
];

// Aperçu d'une donnée d'épreuve, une fois vérifié que decoder la lit en
// UTF-8 avec marque, et que ses octets ne portent que des fins de ligne CRLF :
// git ne les a pas converties.
function apercuDe(nom) {
  const octets = lireFixture(nom);
  assert.equal(finsDeLigne(octets).isolees, 0, `${nom} : fin de ligne isolée`);
  const { texte, encodage } = decoder(octets);
  assert.equal(encodage, 'utf-8-bom', nom);
  return apercevoir(texte);
}

describe("apercevoir : les données d'épreuve, un CSV tel qu'un tableur l'écrit", () => {
  test("chaque donnée d'épreuve de test/fixtures/csv/ est éprouvée ici, et il y en a", () => {
    const presentes = readdirSync(FIXTURES).sort();
    assert.ok(presentes.length > 0, "aucune donnée d'épreuve");
    assert.deepEqual(presentes, DONNEES);
  });

  test('marque UTF-8 et CRLF : sept colonnes, chaque fin de ligne lue, la marque hors du premier en-tête', () => {
    assert.deepEqual(finsDeLigne(lireFixture('marque_crlf.csv')), { crlf: 4, isolees: 0 });
    const apercu = apercuDe('marque_crlf.csv');
    assert.equal(apercu.separateur, ';');
    assert.deepEqual(apercu.entetes, ['nom', 'prenom', 'appartenance', 'courriel', 'titre_pressenti', 'exclu', 'notes']);
    assert.deepEqual(lignesDe(apercu), [
      [2, champs({
        nom: 'Ombrelle', prenom: 'Iris', appartenance: 'Club des Merles', courriel: 'iris.ombrelle@exemple.test',
        titrePressenti: 'animation', exclu: false,
      })],
      [3, champs({ nom: 'Pervenche', prenom: 'Théo', courriel: 'theo.pervenche@exemple.test', notes: 'arrive tard' })],
      [4, champs({ nom: 'Sarcelle', prenom: 'Ondine', appartenance: 'Chorale du Givre', exclu: true })],
    ]);
    assert.deepEqual(apercu.refusees, []);
    assert.equal(apercu.refusGlobal, null);
  });

  test('une dernière ligne sans fin de ligne est lue en entier', () => {
    const octets = lireFixture('derniere_ligne_sans_fin.csv');
    assert.notEqual(octets[octets.length - 1], 0x0a);
    assert.deepEqual(finsDeLigne(octets), { crlf: 2, isolees: 0 });
    assert.deepEqual(lignesDe(apercuDe('derniere_ligne_sans_fin.csv')), [
      [2, champs({ nom: 'Ombrelle', prenom: 'Iris', appartenance: 'Club des Merles' })],
      [3, champs({ nom: 'Bruyère', prenom: 'Anouk', appartenance: 'Chorale du Givre' })],
    ]);
  });

  test('une ligne vide et une ligne de séparateurs au milieu : ignorées, les rangs suivants gardés', () => {
    const apercu = apercuDe('ligne_vide_au_milieu.csv');
    assert.deepEqual(lignesDe(apercu), [
      [2, champs({ nom: 'Ombrelle', prenom: 'Iris', appartenance: 'Club des Merles' })],
      [4, champs({ nom: 'Pervenche', prenom: 'Théo' })],
      [6, champs({ nom: 'Sarcelle', prenom: 'Ondine', appartenance: 'Chorale du Givre' })],
    ]);
    assert.deepEqual(apercu.refusees, []);
  });

  test('un champ cité qui porte des guillemets doublés et le séparateur ; un autre sur deux lignes', () => {
    const apercu = apercuDe('champ_cite.csv');
    assert.deepEqual(lignesDe(apercu), [
      [2, champs({
        nom: 'Ombrelle', prenom: 'Iris', appartenance: 'Club "Les Merles" ; section nord',
        notes: 'dit "bonjour" ; puis part',
      })],
      [3, champs({
        nom: 'Pervenche', prenom: 'Théo', appartenance: 'Chorale du Givre', notes: 'première ligne\r\ndeuxième ligne',
      })],
      [4, champs({ nom: 'Sarcelle', prenom: 'Ondine', notes: 'fin' })],
    ]);
    assert.deepEqual(apercu.refusees, []);
  });

  test('des espaces autour des valeurs et des en-têtes : retirés des champs, gardés dans le brut', () => {
    const apercu = apercuDe('espaces_autour.csv');
    assert.deepEqual(apercu.entetes, [' nom ', ' prenom ', ' appartenance ', ' courriel ', ' exclu ']);
    assert.deepEqual(apercu.association.colonnes, { nom: 0, prenom: 1, appartenance: 2, courriel: 3, exclu: 4 });
    assert.deepEqual(apercu.lignes, [
      {
        ligne: 2,
        champs: champs({
          nom: 'Ombrelle', prenom: 'Iris', appartenance: 'Club des Merles', courriel: 'iris@exemple.test', exclu: true,
        }),
        brut: [' Ombrelle ', '  Iris ', '  Club des Merles  ', ' iris@exemple.test ', ' Oui '],
      },
      {
        ligne: 3,
        champs: champs({ nom: 'Pervenche', prenom: 'Théo' }),
        brut: ['Pervenche\u{A0}', ' Théo ', '   ', '   ', '   '],
      },
    ]);
  });

  test("une colonne d'en-tête vide : non reconnue, sa valeur ignorée, la ligne importée", () => {
    const apercu = apercuDe('entete_vide.csv');
    assert.deepEqual(apercu.association, {
      colonnes: { nom: 0, prenom: 1, appartenance: 3 },
      ambigus: [],
      nonReconnues: [2],
    });
    assert.deepEqual(apercu.lignes, [
      {
        ligne: 2,
        champs: champs({ nom: 'Ombrelle', prenom: 'Iris', appartenance: 'Club des Merles' }),
        brut: ['Ombrelle', 'Iris', 'note sans en-tête', 'Club des Merles'],
      },
      { ligne: 3, champs: champs({ nom: 'Pervenche', prenom: 'Théo' }), brut: ['Pervenche', 'Théo', '', ''] },
    ]);
    assert.deepEqual(apercu.refusees, []);
  });
});
