// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de l'association des colonnes (§ 10.1) : les champs du CSV, la
// reconnaissance d'un en-tête et de ses synonymes, et l'association par
// en-tête, jamais par position, qui laisse sans colonne un champ que deux
// colonnes revendiquent tant qu'un choix ne tranche pas.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { CHAMPS, associer, reconnaitre } from './colonnes.js';

describe('CHAMPS', () => {
  test('les sept champs du § 10.1, dans leur ordre, figés', () => {
    assert.deepEqual(CHAMPS, ['nom', 'prenom', 'appartenance', 'courriel', 'titre_pressenti', 'exclu', 'notes']);
    assert.ok(Object.isFrozen(CHAMPS));
  });
});

describe('reconnaitre (§ 10.1)', () => {
  test('chaque champ par son propre nom', () => {
    assert.ok(CHAMPS.length > 0, 'aucun champ');
    for (const champ of CHAMPS) assert.equal(reconnaitre(champ), champ);
  });

  test('les synonymes : organisation, entreprise et équipe ; titre et rôle', () => {
    assert.deepEqual(
      ['organisation', 'entreprise', 'équipe', 'titre', 'rôle'].map((entete) => reconnaitre(entete)),
      ['appartenance', 'appartenance', 'appartenance', 'titre_pressenti', 'titre_pressenti'],
    );
  });

  test('sans égard à la casse, aux accents ni aux espaces', () => {
    const cas = [
      ['NOM', 'nom'],
      [' Prénom ', 'prenom'],
      ['Équipe', 'appartenance'],
      ['titre', 'titre_pressenti'],
      ['Rôle', 'titre_pressenti'],
      ['E X C L U', 'exclu'],
      ['Titre_Pressenti', 'titre_pressenti'],
      ['titre pressenti', 'titre_pressenti'],
      ['COURRIEL', 'courriel'],
      ['Notes ', 'notes'],
      ['ORGANISATION', 'appartenance'],
      ['Entre-prise', 'appartenance'],
      ['Equipe', 'appartenance'],
    ];
    assert.deepEqual(
      cas.map(([entete]) => reconnaitre(entete)),
      cas.map(([, champ]) => champ),
    );
  });

  test('un en-tête inconnu rend null, dont « ligne » et « motif » du CSV des refus', () => {
    const inconnus = [
      'ligne', 'motif', '', '   ', 'nom de famille', 'société', 'prenoms', 'courriels',
      'organisations', 'titres', 'appartenances', 'exclus', 'note', 'titre.pressenti',
    ];
    assert.deepEqual(
      inconnus.map((entete) => reconnaitre(entete)),
      inconnus.map(() => null),
    );
  });
});

describe('associer : par en-tête, jamais par position (§ 10.1)', () => {
  test('chaque champ reconnu reçoit le rang de sa colonne, à partir de 0', () => {
    assert.deepEqual(associer(['nom', 'prenom', 'appartenance', 'courriel', 'titre_pressenti', 'exclu', 'notes']), {
      colonnes: { nom: 0, prenom: 1, appartenance: 2, courriel: 3, titre_pressenti: 4, exclu: 5, notes: 6 },
      ambigus: [],
      nonReconnues: [],
    });
  });

  test('des colonnes déplacées donnent à chaque champ la même valeur', () => {
    const entetes = ['nom', 'prenom', 'appartenance', 'courriel'];
    const enregistrement = ['Ombrelle', 'Iris', 'Club des Merles', 'iris@exemple.test'];
    // La colonne i du fichier déplacé est la colonne deplacement[i] de l'autre.
    const deplacement = [3, 2, 0, 1];
    const entetesDeplaces = deplacement.map((rang) => entetes[rang]);
    const enregistrementDeplace = deplacement.map((rang) => enregistrement[rang]);
    // [champ, valeur] de chaque champ associé, dans l'ordre de CHAMPS.
    const lire = ({ colonnes }, champs) =>
      CHAMPS.filter((champ) => colonnes[champ] !== undefined).map((champ) => [champ, champs[colonnes[champ]]]);

    const association = associer(entetes);
    const associationDeplacee = associer(entetesDeplaces);
    assert.deepEqual(associationDeplacee.colonnes, { nom: 2, prenom: 3, appartenance: 1, courriel: 0 });
    assert.deepEqual(lire(associationDeplacee, enregistrementDeplace), lire(association, enregistrement));
    assert.deepEqual(lire(association, enregistrement), [
      ['nom', 'Ombrelle'],
      ['prenom', 'Iris'],
      ['appartenance', 'Club des Merles'],
      ['courriel', 'iris@exemple.test'],
    ]);
  });

  test("colonnes suit l'ordre de CHAMPS, quel que soit celui du fichier", () => {
    assert.equal(
      JSON.stringify(associer(['notes', 'exclu', 'courriel', 'nom']).colonnes),
      '{"nom":3,"courriel":2,"exclu":1,"notes":0}',
    );
  });

  test("organisation et entreprise ensemble : ni l'une ni l'autre, une ambiguïté sur appartenance", () => {
    assert.deepEqual(associer(['nom', 'organisation', 'entreprise']), {
      colonnes: { nom: 0 },
      ambigus: [{ champ: 'appartenance', rangs: [1, 2] }],
      nonReconnues: [],
    });
  });

  test("le choix tranche l'ambiguïté, pour l'une comme pour l'autre colonne", () => {
    const entetes = ['nom', 'organisation', 'entreprise'];
    assert.deepEqual(associer(entetes, { appartenance: 2 }), {
      colonnes: { nom: 0, appartenance: 2 },
      ambigus: [],
      nonReconnues: [],
    });
    assert.deepEqual(associer(entetes, { appartenance: 1 }).colonnes, { nom: 0, appartenance: 1 });
  });

  test('des colonnes déplacées donnent la même ambiguïté, aux rangs déplacés', () => {
    const entetes = ['entreprise', 'nom', 'organisation'];
    assert.deepEqual(associer(entetes), {
      colonnes: { nom: 1 },
      ambigus: [{ champ: 'appartenance', rangs: [0, 2] }],
      nonReconnues: [],
    });
    assert.deepEqual(associer(entetes, { appartenance: 0 }).colonnes, { nom: 1, appartenance: 0 });
  });

  test("un choix qui ne désigne pas l'une des colonnes en conflit est sans effet", () => {
    const entetes = ['nom', 'organisation', 'entreprise', 'inconnue'];
    const sansChoix = associer(entetes);
    assert.deepEqual(sansChoix.ambigus, [{ champ: 'appartenance', rangs: [1, 2] }]);
    const choix = [
      { appartenance: 0 },
      { appartenance: 3 },
      { appartenance: 7 },
      { appartenance: '2' },
      { appartenance: null },
      { nom: 1 },
      { prenom: 3 },
      { inconnu: 1 },
    ];
    for (const un of choix) assert.deepEqual(associer(entetes, un), sansChoix, JSON.stringify(un));
  });

  test("deux colonnes nom : ni l'une ni l'autre", () => {
    assert.deepEqual(associer(['Nom', 'prenom', 'NOM']), {
      colonnes: { prenom: 1 },
      ambigus: [{ champ: 'nom', rangs: [0, 2] }],
      nonReconnues: [],
    });
  });

  test("plusieurs conflits : les ambiguïtés dans l'ordre de CHAMPS, les rangs croissants", () => {
    assert.deepEqual(associer(['titre', 'équipe', 'nom', 'rôle', 'organisation', 'entreprise']), {
      colonnes: { nom: 2 },
      ambigus: [
        { champ: 'appartenance', rangs: [1, 4, 5] },
        { champ: 'titre_pressenti', rangs: [0, 3] },
      ],
      nonReconnues: [],
    });
  });

  test('les colonnes non reconnues, en-tête vide compris, par rang croissant', () => {
    assert.deepEqual(associer(['x', 'nom', '', 'ligne', '  ']), {
      colonnes: { nom: 1 },
      ambigus: [],
      nonReconnues: [0, 2, 3, 4],
    });
  });

  test('aucune colonne : rien à associer', () => {
    assert.deepEqual(associer([]), { colonnes: {}, ambigus: [], nonReconnues: [] });
  });
});
