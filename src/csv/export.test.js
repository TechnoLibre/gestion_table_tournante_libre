// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de l'export de la liste (§ 10.2, § 10.3) : la forme exacte que
// l'import lit — marque UTF-8, « ; », CRLF, les huit en-têtes de l'import —,
// les champs cités au besoin, les étiquettes jointes par « , » et relues par
// la découpe de la saisie, et l'aller-retour qui importe, exporte, réimporte
// et compare champ par champ, sur chaque donnée d'épreuve de
// test/fixtures/csv/, sur les fichiers d'exemple et sur une liste aux valeurs
// difficiles. L'écriture d'un
// CSV, que l'export partage avec le CSV des refus, s'éprouve contre la
// découpe qui la relit.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, test } from '../../test/lanceur.js';
import { creerCharge } from '../stockage/document.js';
import { SEPARATEURS_ETIQUETTES, lireEtiquettes } from '../stockage/etiquettes.js';
import { VALEURS_EXCLU, apercevoir } from './apercu.js';
import { CHAMPS } from './colonnes.js';
import { decoder } from './encodage.js';
import { JOINTURE_ETIQUETTES, SEPARATEUR, ecrireCsv, exporterParticipants } from './export.js';
import { appliquerImport } from './import.js';
import { decouper } from './lecture.js';

const FIXTURES = new URL('../../test/fixtures/csv/', import.meta.url);
const EXEMPLES = new URL('../../exemples/', import.meta.url);

const MARQUE = '\u{FEFF}';

// Texte des octets, la marque d'ordre d'octets gardée en tête.
const texteDe = (octets) => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(octets);

// Texte d'un CSV : chaque ligne donnée, terminée par CRLF.
const csv = (...lignes) => lignes.map((ligne) => `${ligne}\r\n`).join('');

// Participant, ses champs omis vides et non exclu.
const personne = (id, nom, autres = {}) => ({
  id, nom, prenom: null, appartenance: null, courriel: null, titrePressenti: null, notes: null, exclu: false, ...autres,
});

// Champs d'un participant, dans l'ordre du fichier d'état.
const CHAMPS_DU_PARTICIPANT = [
  'id', 'nom', 'prenom', 'appartenance', 'courriel', 'titrePressenti', 'notes', 'exclu', 'etiquettes',
];

// Participants qu'un import crée, en ajoutant, sur une charge neuve, à
// partir des octets d'un fichier ; l'aperçu ne doit refuser ni le texte ni
// aucune ligne, sauf celles que refusesAdmis nomme par leur code.
function importer(octets, nom, refusesAdmis = []) {
  const apercu = apercevoir(decoder(octets).texte);
  assert.equal(apercu.refusGlobal, null, nom);
  assert.deepEqual(apercu.refusees.map(({ code }) => code), refusesAdmis, nom);
  const charge = creerCharge({ id: 'evt-essai', nom: "Soirée d'essai", siegesParDefaut: 4, tours: 2 });
  return appliquerImport(charge, apercu, 'ajouter').charge.participants;
}

// Compare deux listes de participants champ par champ, puis en entier.
function memesParticipants(obtenus, attendus, nom) {
  assert.equal(obtenus.length, attendus.length, nom);
  attendus.forEach((attendu, rang) => {
    for (const champ of CHAMPS_DU_PARTICIPANT) {
      assert.deepEqual(obtenus[rang][champ], attendu[champ], `${nom}, participant ${rang + 1}, ${champ}`);
    }
  });
  assert.deepEqual(obtenus, attendus, nom);
}

describe("exporterParticipants : la forme exacte que l'import lit (§ 10.2)", () => {
  test("marque UTF-8, « ; », CRLF, les huit en-têtes de l'import dans leur ordre, un participant par ligne", () => {
    const octets = exporterParticipants([
      personne(1, 'Ombrelle', {
        prenom: 'Iris', appartenance: 'Club des Merles', courriel: 'iris@exemple.test', titrePressenti: 'animation',
      }),
      personne(2, 'Pervenche', { prenom: 'Théo', notes: 'arrive tard', exclu: true }),
    ]);
    assert.ok(octets instanceof Uint8Array);
    assert.deepEqual([...octets.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
    assert.equal(
      texteDe(octets),
      MARQUE +
        csv(
          'nom;prenom;appartenance;courriel;titre_pressenti;exclu;notes;etiquettes',
          'Ombrelle;Iris;Club des Merles;iris@exemple.test;animation;non;;',
          'Pervenche;Théo;;;;oui;arrive tard;',
        ),
    );
  });

  test("les en-têtes sont les champs de l'import, CHAMPS, et le séparateur « ; »", () => {
    assert.equal(SEPARATEUR, ';');
    assert.equal(CHAMPS.join(';'), 'nom;prenom;appartenance;courriel;titre_pressenti;exclu;notes;etiquettes');
    assert.equal(texteDe(exporterParticipants([])), `${MARQUE}${CHAMPS.join(SEPARATEUR)}\r\n`);
  });

  test("exclu s'écrit oui ou non, deux valeurs que la liste fermée de l'import relit", () => {
    assert.equal(VALEURS_EXCLU.get('oui'), true);
    assert.equal(VALEURS_EXCLU.get('non'), false);
    const texte = texteDe(exporterParticipants([personne(1, 'Ombrelle', { exclu: true }), personne(2, 'Pervenche')]));
    assert.equal(texte, MARQUE + csv(CHAMPS.join(';'), 'Ombrelle;;;;;oui;;', 'Pervenche;;;;;non;;'));
  });

  test('un champ qui porte « ; », un guillemet ou une fin de ligne s\'écrit cité, ses guillemets doublés', () => {
    const octets = exporterParticipants([
      personne(1, 'Ombrelle', { appartenance: 'Club "Les Merles" ; nord', notes: 'premier\r\nsecond' }),
      personne(2, '"Pervenche"', { courriel: 'theo\r@exemple.test', notes: 'a\nb' }),
      personne(3, 'Sarcelle', { notes: 'virgule, tabulation\tseules' }),
    ]);
    assert.equal(
      texteDe(octets),
      MARQUE +
        csv(
          CHAMPS.join(';'),
          'Ombrelle;;"Club ""Les Merles"" ; nord";;;non;"premier\r\nsecond";',
          '"""Pervenche""";;;"theo\r@exemple.test";;non;"a\nb";',
          'Sarcelle;;;;;non;virgule, tabulation\tseules;',
        ),
    );
  });

  test("les lignes suivent l'ordre de la liste reçue", () => {
    const texte = texteDe(exporterParticipants([personne(7, 'Sarcelle'), personne(2, 'Ombrelle')]));
    assert.equal(texte, MARQUE + csv(CHAMPS.join(';'), 'Sarcelle;;;;;non;;', 'Ombrelle;;;;;non;;'));
  });

  test("exporterParticipants ne modifie pas la liste reçue", () => {
    const participants = [personne(1, 'Ombrelle', { prenom: 'Iris', notes: 'a;b', exclu: true, etiquettes: ['b', 'a'] })];
    const avant = structuredClone(participants);
    exporterParticipants(participants);
    assert.deepEqual(participants, avant);
  });

  test("un exclu qui n'est pas un booléen, un nom qui n'est pas une chaîne, un texte ni chaîne ni null : TypeError qui nomme la personne et le champ, rien d'écrit en silence", () => {
    const refuse = (participant, message) =>
      assert.throws(() => exporterParticipants([personne(1, 'Sarcelle'), participant]), { name: 'TypeError', message });
    refuse(personne(2, 'Ombrelle', { exclu: null }), 'participant 2 de la liste, exclu : booléen attendu, reçu null');
    refuse(personne(2, 'Ombrelle', { exclu: 'oui' }), 'participant 2 de la liste, exclu : booléen attendu, reçu "oui"');
    refuse(personne(2, 'Ombrelle', { courriel: 5 }), 'participant 2 de la liste, courriel : texte ou null attendu, reçu 5');
    refuse(personne(2, undefined), 'participant 2 de la liste, nom : texte attendu, reçu undefined');
    refuse(personne(2, null), 'participant 2 de la liste, nom : texte attendu, reçu null');
    refuse(personne(2, 'Ombrelle', { etiquettes: 'finance' }), 'participant 2 de la liste, etiquettes : liste de textes attendu, reçu "finance"');
    refuse(personne(2, 'Ombrelle', { etiquettes: null }), 'participant 2 de la liste, etiquettes : liste de textes attendu, reçu null');
    refuse(personne(2, 'Ombrelle', { etiquettes: ['finance', 3] }), 'participant 2 de la liste, etiquettes : liste de textes attendu, reçu ["finance",3]');
  });
});

describe("exporterParticipants : la colonne des étiquettes (§ 10.2, A18)", () => {
  test("toujours écrite, en dernier : les étiquettes jointes par « , », dans l'ordre de la liste ; sans étiquette, vide", () => {
    assert.equal(JOINTURE_ETIQUETTES, ', ');
    const texte = texteDe(exporterParticipants([
      personne(1, 'Ombrelle', { etiquettes: ['Montréal', 'finance'] }),
      personne(2, 'Pervenche'),
      personne(3, 'Lacasse', { etiquettes: ['bénévole'] }),
    ]));
    assert.equal(
      texte,
      MARQUE + csv(CHAMPS.join(';'), 'Ombrelle;;;;;non;;Montréal, finance', 'Pervenche;;;;;non;;', 'Lacasse;;;;;non;;bénévole'),
    );
  });

  test('la jointure, privée de ses blancs, est un séparateur que la découpe de la saisie lit', () => {
    assert.ok(SEPARATEURS_ETIQUETTES.includes(JOINTURE_ETIQUETTES.trim()));
    const etiquettes = ['Montréal', 'finance', 'ressources humaines'];
    assert.deepEqual(lireEtiquettes(etiquettes.join(JOINTURE_ETIQUETTES)), { etiquettes, fautes: [] });
  });

  test("une étiquette qui commence par « = » s'exporte telle quelle : aucune neutralisation de formule", () => {
    const texte = texteDe(exporterParticipants([personne(1, 'Ombrelle', { etiquettes: ['=SOMME(A1)', '+33', '@arobase'] })]));
    assert.equal(texte, MARQUE + csv(CHAMPS.join(';'), 'Ombrelle;;;;;non;;=SOMME(A1), +33, @arobase'));
    const [personneRelue] = importer(new TextEncoder().encode(texte), 'formule');
    assert.deepEqual(personneRelue.etiquettes, ['+33', '=SOMME(A1)', '@arobase']);
  });
});

describe("exporterParticipants : l'aller-retour, champ par champ (§ 10.2)", () => {
  test("chaque donnée d'épreuve de test/fixtures/csv/ : importée, exportée, réimportée, les mêmes participants", () => {
    const donnees = readdirSync(FIXTURES).sort();
    assert.ok(donnees.length > 0, "aucune donnée d'épreuve");
    assert.ok(donnees.includes('etiquettes_virgule_citee.csv'));
    for (const nom of donnees) {
      const importes = importer(readFileSync(new URL(nom, FIXTURES)), nom);
      assert.ok(importes.length > 0, nom);
      const octets = exporterParticipants(importes);
      assert.equal(apercevoir(decoder(octets).texte).separateur, ';', nom);
      memesParticipants(importer(octets, nom), importes, nom);
    }
  });

  test("chaque fichier d'exemple : importé, exporté, réimporté, les mêmes participants, étiquettes comprises", () => {
    const exemples = [
      ['participants_cas_limites.csv', ['NOM_ABSENT']],
      ['participants_cas_limites_cp1252.csv', ['NOM_ABSENT']],
      ['participants_demo_petite.csv', []],
      ['participants_demo_grande.csv', []],
    ];
    let etiquetees = 0;
    for (const [nom, refusesAdmis] of exemples) {
      const importes = importer(readFileSync(new URL(nom, EXEMPLES)), nom, refusesAdmis);
      assert.ok(importes.length > 0, nom);
      etiquetees += importes.filter(({ etiquettes }) => etiquettes !== undefined).length;
      memesParticipants(importer(exporterParticipants(importes), nom), importes, nom);
    }
    assert.ok(etiquetees > 0, 'aucune personne étiquetée dans les exemples');
  });

  test('une liste aux valeurs difficiles : guillemets, séparateurs, fins de ligne, formules, accents, exclusions', () => {
    const difficiles = [
      personne(1, 'Ombrelle', {
        prenom: 'Iris', appartenance: 'Club "Les Merles" ; nord', courriel: 'iris@exemple.test',
        titrePressenti: 'animation', notes: 'premier\r\nsecond', exclu: true,
      }),
      personne(2, '"Pervenche"', { prenom: 'Théo', notes: 'virgule, tabulation\tet ; point-virgule' }),
      personne(3, '=SOMME(A1:A3)', { prenom: '+33', appartenance: '-moins', courriel: '@arobase' }),
      personne(4, 'Sarcelle', { prenom: 'Ondine', appartenance: 'Chœur de l\u{2019}Anse', notes: 'saut\nseul\rretour seul' }),
      personne(5, 'Bruyère', { titrePressenti: 'fin"', notes: '"' }),
      personne(6, 'Lacasse', { etiquettes: ['=SOMME(A1)', 'Montréal', 'finance', 'ressources humaines', 'é'] }),
      personne(7, 'Pervenche', { etiquettes: Array.from({ length: 20 }, (_, i) => `m${String(i).padStart(2, '0')}`) }),
    ];
    const octets = exporterParticipants(difficiles);
    assert.equal(apercevoir(decoder(octets).texte).separateur, ';');
    memesParticipants(importer(octets, 'difficiles'), difficiles, 'difficiles');
  });
});

describe("ecrireCsv : l'écriture d'un CSV, qu'une découpe relit telle quelle", () => {
  test('cite un champ qui porte le séparateur, un guillemet, un retour chariot ou un saut de ligne ; tout autre champ tel quel', () => {
    assert.equal(
      texteDe(ecrireCsv([['a;b', 'c"d', 'e\rf', 'g\nh', ' i ', '', 'j,k\tl']], ';')),
      `${MARQUE}"a;b";"c""d";"e\rf";"g\nh"; i ;;j,k\tl\r\n`,
    );
  });

  test('le séparateur reçu décide : sous la tabulation, « ; » et « , » restent nus', () => {
    assert.equal(texteDe(ecrireCsv([['a;b', 'c\td', 'e,f']], '\t')), `${MARQUE}a;b\t"c\td"\te,f\r\n`);
    assert.equal(texteDe(ecrireCsv([['a;b', 'c\td', 'e,f']], ',')), `${MARQUE}a;b,c\td,"e,f"\r\n`);
  });

  test('decouper relit chaque enregistrement tel qu\'écrit, sous chacun des trois séparateurs', () => {
    const enregistrements = [
      ['nom', 'notes', 'courriel'],
      ['"Ombrelle"', 'a;b,c\td', 'x'],
      ['x\r\ny', ' ', '""'],
      ['', 'fin"', 'z\r'],
    ];
    for (const separateur of [';', ',', '\t']) {
      const { texte, encodage } = decoder(ecrireCsv(enregistrements, separateur));
      assert.equal(encodage, 'utf-8-bom');
      assert.deepEqual(decouper(texte, separateur), { enregistrements, guillemetOuvert: false }, separateur);
    }
  });
});
