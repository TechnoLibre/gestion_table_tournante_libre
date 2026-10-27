// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de l'export de la liste (§ 10.2, § 10.3) : la forme exacte que
// l'import lit — marque UTF-8, « ; », CRLF, les neuf en-têtes de l'import —,
// les champs cités au besoin, les étiquettes jointes par « , » et relues par
// la découpe de la saisie, la présence en plages et en listes, relue par la
// grammaire de l'import, et l'aller-retour qui importe, exporte, réimporte
// et compare champ par champ, sur chaque donnée d'épreuve de
// test/fixtures/csv/, sur les fichiers d'exemple, sur une liste aux valeurs
// difficiles et sur chaque partie non vide des tours de 1 à 6, dont l'export
// réimporté en mise à jour ne modifie personne. L'écriture d'un CSV, que
// l'export partage avec le CSV des refus, s'éprouve contre la découpe qui la
// relit. Le modèle à télécharger (§ 10.1) s'éprouve par son texte exact, par
// chaque colonne qu'il remplit et par son import tel quel, sous chaque nombre
// de tours de 1 à 6, puisque sa présence le suit.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, test } from '../../test/lanceur.js';
import { TOURS_MAX, creerCharge } from '../stockage/document.js';
import { SEPARATEURS_ETIQUETTES, lireEtiquettes } from '../stockage/etiquettes.js';
import { VALEURS_EXCLU, apercevoir } from './apercu.js';
import { CHAMPS } from './colonnes.js';
import { decoder } from './encodage.js';
import { JOINTURE_CONFLITS, JOINTURE_ETIQUETTES, SEPARATEUR, ecrireCsv, exporterParticipants, modeleParticipants } from './export.js';
import { appliquerImport } from './import.js';
import { decouper } from './lecture.js';
import { JOINTURE_PRESENCE } from './presence.js';

const FIXTURES = new URL('../../test/fixtures/csv/', import.meta.url);

// L'en-tête d'une liste où personne ne nomme de conflit ni ne porte
// l'animation réservée : CHAMPS sans ces deux colonnes, que l'export n'écrit
// alors pas.
const ENTETE = CHAMPS.filter((champ) => champ !== 'conflit_organisation' && champ !== 'animation_reservee').join(';');
const EXEMPLES = new URL('../../exemples/', import.meta.url);

const MARQUE = '\u{FEFF}';

// Texte des octets, la marque d'ordre d'octets gardée en tête.
const texteDe = (octets) => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(octets);

// Texte d'un CSV : chaque ligne donnée, terminée par CRLF.
const csv = (...lignes) => lignes.map((ligne) => `${ligne}\r\n`).join('');

// Participant, ses champs omis vides et non exclu.
const personne = (id, nom, autres = {}) => ({
  id, nom, prenom: null, organisation: null, courriel: null, titrePressenti: null, notes: null, exclu: false, ...autres,
});

// Champs d'un participant, dans l'ordre du fichier d'état.
const CHAMPS_DU_PARTICIPANT = [
  'id', 'nom', 'prenom', 'organisation', 'courriel', 'titrePressenti', 'notes', 'exclu', 'etiquettes', 'presence', 'conflits',
  'animationReservee',
];

// Participants qu'un import crée, en ajoutant, sur une charge neuve de tours
// tours, à partir des octets d'un fichier, l'aperçu calculé sous ce nombre
// de tours ; l'aperçu ne doit refuser ni le texte ni aucune ligne, sauf
// celles que refusesAdmis nomme par leur code.
function importer(octets, nom, refusesAdmis = [], tours = 4) {
  const apercu = apercevoir(decoder(octets).texte, { tours });
  assert.equal(apercu.refusGlobal, null, nom);
  assert.deepEqual(apercu.refusees.map(({ code }) => code), refusesAdmis, nom);
  const charge = creerCharge({ id: 'evt-essai', nom: "Soirée d'essai", siegesParDefaut: 4, tours });
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
  test("marque UTF-8, « ; », CRLF, les neuf en-têtes de l'import dans leur ordre, un participant par ligne", () => {
    const octets = exporterParticipants([
      personne(1, 'Ombrelle', {
        prenom: 'Iris', organisation: 'Club des Merles', courriel: 'iris@exemple.test', titrePressenti: 'animation',
      }),
      personne(2, 'Pervenche', { prenom: 'Théo', notes: 'arrive tard', exclu: true }),
    ]);
    assert.ok(octets instanceof Uint8Array);
    assert.deepEqual([...octets.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
    assert.equal(
      texteDe(octets),
      MARQUE +
        csv(
          'nom;prenom;organisation;courriel;titre_pressenti;exclu;notes;etiquettes;presence',
          'Ombrelle;Iris;Club des Merles;iris@exemple.test;animation;non;;;',
          'Pervenche;Théo;;;;oui;arrive tard;;',
        ),
    );
  });

  test("les en-têtes sont les champs de l'import, CHAMPS, sans les conflits ni l'animation réservée quand personne n'en porte, et le séparateur « ; »", () => {
    assert.equal(SEPARATEUR, ';');
    assert.equal(
      CHAMPS.join(';'),
      'nom;prenom;organisation;courriel;titre_pressenti;exclu;notes;etiquettes;presence;conflit_organisation;animation_reservee',
    );
    assert.equal(ENTETE, 'nom;prenom;organisation;courriel;titre_pressenti;exclu;notes;etiquettes;presence');
    assert.equal(texteDe(exporterParticipants([])), `${MARQUE}${ENTETE}\r\n`);
  });

  test("exclu s'écrit oui ou non, deux valeurs que la liste fermée de l'import relit", () => {
    assert.equal(VALEURS_EXCLU.get('oui'), true);
    assert.equal(VALEURS_EXCLU.get('non'), false);
    const texte = texteDe(exporterParticipants([personne(1, 'Ombrelle', { exclu: true }), personne(2, 'Pervenche')]));
    assert.equal(texte, MARQUE + csv(ENTETE, 'Ombrelle;;;;;oui;;;', 'Pervenche;;;;;non;;;'));
  });

  test('un champ qui porte « ; », un guillemet ou une fin de ligne s\'écrit cité, ses guillemets doublés', () => {
    const octets = exporterParticipants([
      personne(1, 'Ombrelle', { organisation: 'Club "Les Merles" ; nord', notes: 'premier\r\nsecond' }),
      personne(2, '"Pervenche"', { courriel: 'theo\r@exemple.test', notes: 'a\nb' }),
      personne(3, 'Sarcelle', { notes: 'virgule, tabulation\tseules' }),
    ]);
    assert.equal(
      texteDe(octets),
      MARQUE +
        csv(
          ENTETE,
          'Ombrelle;;"Club ""Les Merles"" ; nord";;;non;"premier\r\nsecond";;',
          '"""Pervenche""";;;"theo\r@exemple.test";;non;"a\nb";;',
          'Sarcelle;;;;;non;virgule, tabulation\tseules;;',
        ),
    );
  });

  test("les lignes suivent l'ordre de la liste reçue", () => {
    const texte = texteDe(exporterParticipants([personne(7, 'Sarcelle'), personne(2, 'Ombrelle')]));
    assert.equal(texte, MARQUE + csv(ENTETE, 'Sarcelle;;;;;non;;;', 'Ombrelle;;;;;non;;;'));
  });

  test("exporterParticipants ne modifie pas la liste reçue", () => {
    const participants = [
      personne(1, 'Ombrelle', { prenom: 'Iris', notes: 'a;b', exclu: true, etiquettes: ['b', 'a'], presence: [2, 3] }),
    ];
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
    const tours = 'liste croissante de tours attendu';
    refuse(personne(2, 'Ombrelle', { presence: 'tous' }), `participant 2 de la liste, presence : ${tours}, reçu "tous"`);
    refuse(personne(2, 'Ombrelle', { presence: null }), `participant 2 de la liste, presence : ${tours}, reçu null`);
    refuse(personne(2, 'Ombrelle', { presence: [] }), `participant 2 de la liste, presence : ${tours}, reçu []`);
    refuse(personne(2, 'Ombrelle', { presence: [3, 1] }), `participant 2 de la liste, presence : ${tours}, reçu [3,1]`);
    refuse(personne(2, 'Ombrelle', { presence: [0, 1] }), `participant 2 de la liste, presence : ${tours}, reçu [0,1]`);
  });
});

describe("exporterParticipants : la colonne des étiquettes (§ 10.2, A18)", () => {
  test("toujours écrite, avant la présence : les étiquettes jointes par « , », dans l'ordre de la liste ; sans étiquette, vide", () => {
    assert.equal(JOINTURE_ETIQUETTES, ', ');
    const texte = texteDe(exporterParticipants([
      personne(1, 'Ombrelle', { etiquettes: ['Montréal', 'finance'] }),
      personne(2, 'Pervenche'),
      personne(3, 'Lacasse', { etiquettes: ['bénévole'] }),
    ]));
    assert.equal(
      texte,
      MARQUE + csv(ENTETE, 'Ombrelle;;;;;non;;Montréal, finance;', 'Pervenche;;;;;non;;;', 'Lacasse;;;;;non;;bénévole;'),
    );
  });

  test('la jointure, privée de ses blancs, est un séparateur que la découpe de la saisie lit', () => {
    assert.ok(SEPARATEURS_ETIQUETTES.includes(JOINTURE_ETIQUETTES.trim()));
    const etiquettes = ['Montréal', 'finance', 'ressources humaines'];
    assert.deepEqual(lireEtiquettes(etiquettes.join(JOINTURE_ETIQUETTES)), { etiquettes, fautes: [] });
  });

  test("une étiquette qui commence par « = » s'exporte telle quelle : aucune neutralisation de formule", () => {
    const texte = texteDe(exporterParticipants([personne(1, 'Ombrelle', { etiquettes: ['=SOMME(A1)', '+33', '@arobase'] })]));
    assert.equal(texte, MARQUE + csv(ENTETE, 'Ombrelle;;;;;non;;=SOMME(A1), +33, @arobase;'));
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
      ['participants_cas_limites.csv', ['NOM_ABSENT', 'PRESENCE_HORS_TOURS']],
      ['participants_cas_limites_cp1252.csv', ['NOM_ABSENT', 'PRESENCE_HORS_TOURS']],
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
        prenom: 'Iris', organisation: 'Club "Les Merles" ; nord', courriel: 'iris@exemple.test',
        titrePressenti: 'animation', notes: 'premier\r\nsecond', exclu: true,
      }),
      personne(2, '"Pervenche"', { prenom: 'Théo', notes: 'virgule, tabulation\tet ; point-virgule' }),
      personne(3, '=SOMME(A1:A3)', { prenom: '+33', organisation: '-moins', courriel: '@arobase' }),
      personne(4, 'Sarcelle', { prenom: 'Ondine', organisation: 'Chœur de l\u{2019}Anse', notes: 'saut\nseul\rretour seul' }),
      personne(5, 'Bruyère', { titrePressenti: 'fin"', notes: '"' }),
      personne(6, 'Lacasse', { etiquettes: ['=SOMME(A1)', 'Montréal', 'finance', 'ressources humaines', 'é'] }),
      personne(7, 'Pervenche', { etiquettes: Array.from({ length: 20 }, (_, i) => `m${String(i).padStart(2, '0')}`) }),
      personne(8, 'Tilleraie', { presence: [1, 2, 3] }),
      personne(9, 'Brumeval', { presence: [2, 4], etiquettes: ['finance'] }),
      personne(10, 'Grisaille', { presence: [3], exclu: true }),
    ];
    const octets = exporterParticipants(difficiles);
    assert.equal(apercevoir(decoder(octets).texte).separateur, ';');
    memesParticipants(importer(octets, 'difficiles'), difficiles, 'difficiles');
  });
});

describe('exporterParticipants : la colonne de la présence (§ 10.2)', () => {
  test('la neuvième, toujours écrite : vide sans champ, chaque suite d’au moins trois tours en « a-b », les autres tours joints par « , »', () => {
    assert.equal(JOINTURE_PRESENCE, ', ');
    assert.equal(CHAMPS[8], 'presence');
    const texte = texteDe(exporterParticipants([
      personne(1, 'Ombrelle', { presence: [1, 2, 3, 5] }),
      personne(2, 'Pervenche'),
      personne(3, 'Lacasse', { presence: [2, 3], etiquettes: ['finance'] }),
      personne(4, 'Sarcelle', { presence: [4] }),
    ]));
    assert.equal(
      texte,
      MARQUE + csv(ENTETE, 'Ombrelle;;;;;non;;;1-3, 5', 'Pervenche;;;;;non;;;', 'Lacasse;;;;;non;;finance;2, 3', 'Sarcelle;;;;;non;;;4'),
    );
  });

  test('l’aller-retour export → import (ajouter) rend les mêmes présences, sous le nombre de tours de l’événement', () => {
    const participants = [
      personne(1, 'Ombrelle', { presence: [1, 2, 3] }),
      personne(2, 'Pervenche', { presence: [2, 3] }),
      personne(3, 'Lacasse'),
      personne(4, 'Sarcelle', { presence: [1, 3, 4, 5] }),
    ];
    memesParticipants(importer(exporterParticipants(participants), 'présences', [], 5), participants, 'présences');
  });

  test('pour R de 1 à 6, chaque partie non vide des tours : importée, exportée, réimportée, les mêmes ensembles, et une mise à jour par l’export ne modifie personne', () => {
    for (let R = 1; R <= 6; R += 1) {
      // Une personne par partie, sa présence écrite comme un opérateur la
      // tape : « tour 2 », « tours 1 et 3 et 4 », ou « tous » pour la partie
      // pleine, qui n'en porte aucune.
      const parties = [];
      const lignes = ['nom;prenom;presence'];
      for (let masque = 1; masque < 2 ** R; masque += 1) {
        const partie = Array.from({ length: R }, (_, rang) => rang + 1).filter((tour) => masque & (2 ** (tour - 1)));
        parties.push(partie);
        const cellule = partie.length === R ? 'tous' : `${partie.length === 1 ? 'tour' : 'tours'} ${partie.join(' et ')}`;
        lignes.push(`Brumeval;Partie ${masque};${cellule}`);
      }
      const nom = `R = ${R}`;
      const apercu = apercevoir(csv(...lignes), { tours: R });
      assert.deepEqual(apercu.refusees, [], nom);
      const neuve = creerCharge({ id: 'evt-essai', nom: "Soirée d'essai", siegesParDefaut: 4, tours: R });
      const { charge } = appliquerImport(neuve, apercu, 'ajouter');
      assert.deepEqual(
        charge.participants.map(({ presence }) => presence),
        parties.map((partie) => (partie.length === R ? undefined : partie)),
        nom,
      );
      const octets = exporterParticipants(charge.participants);
      memesParticipants(importer(octets, nom, [], R), charge.participants, nom);
      const options = { participants: charge.participants, mode: 'mettreAJour', tours: R };
      const { charge: apres, resume } = appliquerImport(charge, apercevoir(decoder(octets).texte, options), 'mettreAJour');
      assert.deepEqual(
        [resume.ajoutes, resume.misAJour, resume.inchanges, resume.refusees],
        [0, 0, parties.length, []],
        nom,
      );
      assert.deepEqual(apres.participants, charge.participants, nom);
    }
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

describe("exporterParticipants : la colonne des conflits d'organisation (§ 10.2)", () => {
  // La cellule des conflits de chaque ligne d'un export.
  const conflitsEcrits = (octets) => {
    const [entete, ...lignes] = decouper(decoder(octets).texte, SEPARATEUR).enregistrements.filter((l) => l.length > 1);
    return { entete, cellules: lignes.map((ligne) => ligne[entete.indexOf('conflit_organisation')]) };
  };

  test('écrite après la présence, en dernier sans animation réservée, dès qu\u{2019}une personne nomme un conflit ; absente sinon', () => {
    const avec = conflitsEcrits(exporterParticipants([
      personne(1, 'Ombrelle', { organisation: 'Club des Merles' }),
      personne(2, 'Pervenche', { conflits: ['Atelier Ressac', 'Club des Merles'] }),
      personne(3, 'Lacasse', { organisation: 'Atelier Ressac', presence: [2] }),
    ]));
    assert.deepEqual(avec.entete, [...CHAMPS.slice(0, -1)]);
    assert.equal(avec.entete.at(-1), 'conflit_organisation');
    assert.deepEqual(avec.cellules, ['', 'Atelier Ressac; Club des Merles', '']);
    assert.equal(decoder(exporterParticipants([personne(2, 'Pervenche', { conflits: ['A', 'B'] })])).texte.split('\r\n')[1], 'Pervenche;;;;;non;;;;"A; B"');
    const sans = conflitsEcrits(exporterParticipants([personne(1, 'Ombrelle', { organisation: 'Club des Merles' })]));
    assert.deepEqual(sans.entete, ENTETE.split(';'));
  });

  test('la jointure « ; », privée de ses blancs, est un séparateur que la découpe de l\u{2019}import lit ; la virgule reste dans le nom', () => {
    assert.equal(JOINTURE_CONFLITS, '; ');
    const { cellules } = conflitsEcrits(exporterParticipants([
      personne(1, 'Ombrelle', { conflits: ['Atelier Ressac', 'Club des Merles', 'Société Alpha, Beta'] }),
      personne(2, 'Sarcelle', { conflits: ['Club des Merles'] }),
    ]));
    assert.deepEqual(cellules, ['Atelier Ressac; Club des Merles; Société Alpha, Beta', 'Club des Merles']);
  });

  test("l'aller-retour export → import (ajouter) rend les mêmes conflits, un nom qui porte une virgule compris", () => {
    const participants = [
      personne(1, 'Ombrelle', { organisation: 'Club des Merles' }),
      personne(2, 'Pervenche', { organisation: 'Atelier Ressac' }),
      personne(3, 'Lacasse', { organisation: 'Société Alpha, Beta' }),
      personne(4, 'Sarcelle', { conflits: ['Atelier Ressac', 'Club des Merles', 'Société Alpha, Beta'] }),
      personne(5, 'Houle', { organisation: 'Club des Merles', conflits: ['Société Alpha, Beta'] }),
      personne(6, 'Galet', { exclu: true, conflits: ['Atelier Ressac', 'Club des Merles'] }),
    ];
    memesParticipants(importer(exporterParticipants(participants), 'conflits'), participants, 'conflits');
  });

  test("un nom d'organisation qui porte « ; » ou « | » fait l'aller-retour, sous chaque mode ; la cellule se relit telle qu'écrite", () => {
    const participants = [
      personne(1, 'Ombrelle', { organisation: 'Tilleul; frères' }),
      personne(2, 'Pervenche', { organisation: 'Atelier | Ressac' }),
      personne(3, 'Lacasse', { organisation: 'Tilleul' }),
      personne(4, 'Sarcelle', { conflits: ['Atelier | Ressac', 'Tilleul', 'Tilleul; frères'] }),
      personne(5, 'Houle', { organisation: 'Tilleul', conflits: ['Tilleul; frères'] }),
    ];
    const octets = exporterParticipants(participants);
    assert.deepEqual(conflitsEcrits(octets).cellules, ['', '', '', 'Atelier | Ressac; Tilleul; Tilleul; frères', 'Tilleul; frères']);
    memesParticipants(importer(octets, 'séparateurs dans un nom'), participants, 'séparateurs dans un nom');
    const charge = creerCharge({ id: 'evt-essai', nom: "Soirée d'essai", siegesParDefaut: 4, tours: 4 });
    charge.participants = structuredClone(participants);
    charge.prochainsIds.participant = 6;
    for (const mode of ['remplacer', 'mettreAJour']) {
      const apercu = apercevoir(decoder(octets).texte, { participants: charge.participants, mode, tours: 4 });
      assert.equal(apercu.refusGlobal, null, mode);
      const relus = appliquerImport(charge, apercu, mode).charge.participants;
      assert.deepEqual(relus.map(({ conflits }) => conflits), participants.map(({ conflits }) => conflits), mode);
    }
  });

  test("quand « ; » relirait deux organisations en une que l'événement porte, la cellule se joint par « | », puis par une fin de ligne ; sans jointure qui se relise, « ; » reste", () => {
    const participants = [
      personne(1, 'Ombrelle', { organisation: 'Alpha' }),
      personne(2, 'Pervenche', { organisation: 'Beta' }),
      personne(3, 'Lacasse', { organisation: 'Alpha; Beta' }),
      personne(4, 'Sarcelle', { conflits: ['Alpha', 'Beta'] }),
      personne(5, 'Houle', { conflits: ['Alpha; Beta'] }),
    ];
    const octets = exporterParticipants(participants);
    assert.deepEqual(conflitsEcrits(octets).cellules, ['', '', '', 'Alpha | Beta', 'Alpha; Beta']);
    memesParticipants(importer(octets, 'jointure par la barre'), participants, 'jointure par la barre');
    // La barre relue d'un seul nom, puis la fin de ligne aussi : « ; » reste,
    // faute d'une jointure qui se relise en la même liste.
    const sansIssue = exporterParticipants([
      personne(1, 'Ombrelle', { organisation: 'Alpha | Beta' }),
      personne(2, 'Pervenche', { organisation: 'Alpha\nBeta' }),
      personne(3, 'Lacasse', { organisation: 'Alpha; Beta' }),
      personne(4, 'Sarcelle', { conflits: ['Alpha', 'Beta'] }),
    ]);
    assert.equal(conflitsEcrits(sansIssue).cellules[3], 'Alpha; Beta');
    const parLaFinDeLigne = exporterParticipants([
      personne(1, 'Ombrelle', { organisation: 'Alpha | Beta' }),
      personne(3, 'Lacasse', { organisation: 'Alpha; Beta' }),
      personne(4, 'Sarcelle', { conflits: ['Alpha', 'Beta'] }),
    ]);
    assert.equal(conflitsEcrits(parLaFinDeLigne).cellules[2], 'Alpha\nBeta');
  });
});

describe('exporterParticipants : la colonne de l’animation réservée (§ 10.2)', () => {
  // L'en-tête et les cellules de la colonne de l'animation réservée, null
  // quand l'export ne l'écrit pas.
  function animationsEcrites(octets) {
    const [entete, ...lignes] = decouper(decoder(octets).texte, SEPARATEUR).enregistrements;
    const rang = entete.indexOf('animation_reservee');
    return { entete, cellules: rang < 0 ? null : lignes.map((ligne) => ligne[rang]) };
  }

  test('écrite en dernier, oui ou non, dès qu’une personne porte la marque ; absente sinon', () => {
    const avec = animationsEcrites(exporterParticipants([
      personne(1, 'Ombrelle', { titrePressenti: 'Animation table d’honneur', animationReservee: true }),
      personne(2, 'Pervenche'),
    ]));
    assert.deepEqual(avec.entete, [...ENTETE.split(';'), 'animation_reservee']);
    assert.deepEqual(avec.cellules, ['oui', 'non']);
    const lesDeux = animationsEcrites(exporterParticipants([personne(1, 'Ombrelle', { animationReservee: true, conflits: ['A'] })]));
    assert.deepEqual(lesDeux.entete, [...CHAMPS]);
    assert.deepEqual(animationsEcrites(exporterParticipants([personne(1, 'Ombrelle')])).cellules, null);
  });

  test('l’aller-retour export → import rend les mêmes marques, et un réimport en mise à jour ne modifie personne', () => {
    const participants = [personne(1, 'Ombrelle', { animationReservee: true }), personne(2, 'Pervenche')];
    const octets = exporterParticipants(participants);
    memesParticipants(importer(octets, 'animation'), participants, 'animation');
    const charge = { ...creerCharge({ id: 'evt-essai', nom: "Soirée d'essai", siegesParDefaut: 4, tours: 4 }), participants };
    const apercu = apercevoir(decoder(octets).texte, { participants, tours: 4, mode: 'mettreAJour' });
    const { resume } = appliquerImport(charge, apercu, 'mettreAJour');
    assert.deepEqual([resume.misAJour, resume.inchanges], [0, 2]);
  });

  test('une marque présente qui n’est pas vraie : TypeError qui nomme la personne et le champ', () => {
    assert.throws(
      () => exporterParticipants([personne(1, 'Ombrelle', { animationReservee: false })]),
      { name: 'TypeError', message: 'participant 1 de la liste, animation_reservee : vrai ou absent attendu, reçu false' },
    );
  });
});

describe("modeleParticipants : le modèle à télécharger, dans la forme de l'export (§ 10.1)", () => {
  // Le modèle sous quatre tours : la plage « 1-3 », la liste « 2, 3 ».
  const ATTENDU = csv(
    'nom;prenom;organisation;courriel;titre_pressenti;exclu;notes;etiquettes;presence;conflit_organisation;animation_reservee',
    'Ombrelle;Iris;Coopérative Aubier;iris.ombrelle@exemple.test;animation;non;;finance, Montréal;;;oui',
    'Pervenche;Théo;Coopérative Aubier;;;non;arrive au deuxième tour;ressources humaines;2, 3;;non',
    'Lacasse;Ondine;Atelier Ressac;ondine.lacasse@exemple.test;;oui;désistement annoncé;;;;non',
    'Tourteau;Basile;;;;non;;bénévole;1-3;Atelier Ressac;non',
  );

  // Les cellules de présence du modèle, rang à rang, sous tours tours.
  const presencesDuModele = (tours) =>
    decouper(decoder(modeleParticipants({ tours })).texte, SEPARATEUR).enregistrements.slice(1).map((ligne) => ligne[CHAMPS.indexOf('presence')]);

  test("marque UTF-8, « ; », CRLF, l'en-tête de l'export puis quatre personnes inventées", () => {
    const octets = modeleParticipants({ tours: 4 });
    assert.ok(octets instanceof Uint8Array);
    assert.deepEqual([...octets.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
    assert.equal(texteDe(octets), MARQUE + ATTENDU);
  });

  test('la présence suit le nombre de tours : « 1-3 » et « 2, 3 » à quatre, « 1, 2 » et « 2, 3 » à trois, « 1 » et « 2 » à deux, vide à un', () => {
    assert.deepEqual(presencesDuModele(4), ['', '2, 3', '', '1-3']);
    assert.deepEqual(presencesDuModele(3), ['', '2, 3', '', '1, 2']);
    assert.deepEqual(presencesDuModele(2), ['', '2', '', '1']);
    assert.deepEqual(presencesDuModele(1), ['', '', '', '']);
    assert.deepEqual(presencesDuModele(6), ['', '2, 3', '', '1-5']);
    assert.deepEqual(presencesDuModele(TOURS_MAX), ['', '2, 3', '', `1-${TOURS_MAX - 1}`]);
  });

  test('pour R de 1 à 6, importé tel quel sous R tours : aucun refus, la présence de chaque personne celle de sa cellule', () => {
    for (let tours = 1; tours <= 6; tours += 1) {
      const importes = importer(modeleParticipants({ tours }), `modèle, ${tours} tours`, [], tours);
      const attendues = tours === 1 ? [undefined, undefined] : tours === 2 ? [[2], [1]] : [[2, 3], Array.from({ length: tours - 1 }, (_, i) => i + 1)];
      assert.deepEqual(importes.map(({ presence }) => presence), [undefined, attendues[0], undefined, attendues[1]], `${tours} tours`);
    }
  });

  test('un nombre de tours qui n’est pas un entier de 1 à TOURS_MAX : TypeError', () => {
    for (const tours of [0, TOURS_MAX + 1, 2.5, '4', undefined]) {
      assert.throws(() => modeleParticipants({ tours }), TypeError, String(tours));
    }
    assert.throws(() => modeleParticipants(), TypeError);
  });

  test("chaque colonne que l'import lit porte au moins une valeur ; exclu et l'animation réservée leurs deux valeurs, une cellule plusieurs étiquettes", () => {
    const { enregistrements } = decouper(decoder(modeleParticipants({ tours: 4 })).texte, SEPARATEUR);
    const [entete, ...lignes] = enregistrements;
    assert.deepEqual(entete, [...CHAMPS]);
    CHAMPS.forEach((champ, rang) => assert.ok(lignes.some((ligne) => ligne[rang] !== ''), champ));
    const exclus = new Set(lignes.map((ligne) => ligne[CHAMPS.indexOf('exclu')]));
    assert.deepEqual([...exclus].sort(), ['non', 'oui']);
    const animations = new Set(lignes.map((ligne) => ligne[CHAMPS.indexOf('animation_reservee')]));
    assert.deepEqual([...animations].sort(), ['non', 'oui']);
    assert.ok(lignes.some((ligne) => ligne[CHAMPS.indexOf('etiquettes')].includes(JOINTURE_ETIQUETTES)));
  });

  test("importé tel quel : aucun refus, les quatre personnes, champ par champ", () => {
    memesParticipants(importer(modeleParticipants({ tours: 4 }), 'modèle'), [
      personne(1, 'Ombrelle', {
        prenom: 'Iris', organisation: 'Coopérative Aubier', courriel: 'iris.ombrelle@exemple.test', titrePressenti: 'animation',
        etiquettes: ['Montréal', 'finance'], animationReservee: true,
      }),
      personne(2, 'Pervenche', {
        prenom: 'Théo', organisation: 'Coopérative Aubier', notes: 'arrive au deuxième tour', etiquettes: ['ressources humaines'],
        presence: [2, 3],
      }),
      personne(3, 'Lacasse', {
        prenom: 'Ondine', organisation: 'Atelier Ressac', courriel: 'ondine.lacasse@exemple.test', notes: 'désistement annoncé',
        exclu: true,
      }),
      personne(4, 'Tourteau', { prenom: 'Basile', etiquettes: ['bénévole'], presence: [1, 2, 3], conflits: ['Atelier Ressac'] }),
    ], 'modèle');
    const apercu = apercevoir(decoder(modeleParticipants({ tours: 4 })).texte, { tours: 4 });
    assert.deepEqual([apercu.doublons, apercu.multilignes], [[], []]);
  });

  test('deux appels rendent les mêmes octets, dans deux tableaux distincts', () => {
    const premier = modeleParticipants({ tours: 4 });
    const second = modeleParticipants({ tours: 4 });
    assert.notEqual(premier, second);
    assert.deepEqual(premier, second);
    premier.fill(0);
    assert.equal(texteDe(modeleParticipants({ tours: 4 })), MARQUE + ATTENDU);
  });
});
