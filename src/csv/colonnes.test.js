// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de l'association des colonnes (§ 10.1) : les champs du CSV, la
// reconnaissance d'un en-tête et de ses synonymes, et l'association par
// en-tête, jamais par position, qui laisse sans colonne un champ que deux
// colonnes revendiquent tant qu'un choix ne tranche pas. associerSelon et
// reconnaitreSelon portent la même règle sur une autre table d'en-têtes,
// celle du CSV des objectifs de table (§ 10.4).
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { CHAMPS, ENTETES_DES_CHAMPS, associer, associerSelon, reconnaitre, reconnaitreSelon } from './colonnes.js';
import { cleEntete } from './normalisation.js';

describe('CHAMPS', () => {
  test('les neuf champs du § 10.1, dans leur ordre, etiquettes puis presence en dernier, figés', () => {
    assert.deepEqual(CHAMPS, [
      'nom', 'prenom', 'appartenance', 'courriel', 'titre_pressenti', 'exclu', 'notes', 'etiquettes', 'presence',
    ]);
    assert.ok(Object.isFrozen(CHAMPS));
  });
});

describe('ENTETES_DES_CHAMPS : la table des colonnes reconnues, seule source (§ 10.1, § 19.8)', () => {
  test('chaque champ de CHAMPS, dans son ordre, avec son nom en tête de ses en-têtes, puis ses synonymes', () => {
    assert.deepEqual(
      ENTETES_DES_CHAMPS.map(([champ, entetes]) => [champ, [...entetes]]),
      [
        ['nom', ['nom']],
        ['prenom', ['prenom']],
        ['appartenance', ['appartenance', 'organisation', 'entreprise', 'équipe']],
        ['courriel', ['courriel']],
        ['titre_pressenti', ['titre_pressenti', 'titre', 'rôle']],
        ['exclu', ['exclu']],
        ['notes', ['notes']],
        ['etiquettes', ['etiquettes', 'étiquette', 'mots-clés']],
        ['presence', ['presence', 'présence', 'tours de présence']],
      ],
    );
    assert.deepEqual(ENTETES_DES_CHAMPS.map(([champ]) => champ), [...CHAMPS]);
  });

  test('figée à toute profondeur : ni la table, ni une paire, ni une liste d’en-têtes ne change', () => {
    assert.ok(ENTETES_DES_CHAMPS.length > 0);
    assert.ok(Object.isFrozen(ENTETES_DES_CHAMPS));
    for (const paire of ENTETES_DES_CHAMPS) {
      assert.ok(Object.isFrozen(paire), paire[0]);
      assert.ok(Object.isFrozen(paire[1]), paire[0]);
    }
    assert.throws(() => ENTETES_DES_CHAMPS.push(['ligne', ['ligne']]), TypeError);
    assert.throws(() => ENTETES_DES_CHAMPS[2][1].push('club'), TypeError);
    assert.equal(reconnaitre('club'), null);
  });

  test('chaque en-tête de la table est reconnu sous son champ : la reconnaissance la lit', () => {
    const paires = ENTETES_DES_CHAMPS.flatMap(([champ, entetes]) => entetes.map((entete) => [entete, champ]));
    assert.equal(paires.length, 18);
    for (const [entete, champ] of paires) assert.equal(reconnaitre(entete), champ, entete);
  });

  test('aucune clé d’en-tête n’est celle de deux champs : un synonyme ne vole la colonne d’aucun autre champ', () => {
    const champDeCle = new Map();
    for (const [champ, entetes] of ENTETES_DES_CHAMPS) {
      for (const entete of entetes) {
        const cle = cleEntete(entete);
        assert.equal(champDeCle.get(cle) ?? champ, champ, entete);
        champDeCle.set(cle, champ);
      }
    }
    // « presence » et « présence » partagent leur clé, sous le même champ.
    assert.equal(champDeCle.size, 17);
  });
});

describe('reconnaitre (§ 10.1)', () => {
  test('chaque champ par son propre nom', () => {
    assert.ok(CHAMPS.length > 0, 'aucun champ');
    for (const champ of CHAMPS) assert.equal(reconnaitre(champ), champ);
  });

  test('les synonymes : organisation, entreprise et équipe ; titre et rôle ; étiquette et mots-clés', () => {
    assert.deepEqual(
      ['organisation', 'entreprise', 'équipe', 'titre', 'rôle', 'étiquette', 'mots-clés'].map((entete) => reconnaitre(entete)),
      ['appartenance', 'appartenance', 'appartenance', 'titre_pressenti', 'titre_pressenti', 'etiquettes', 'etiquettes'],
    );
  });

  test('Étiquettes, ETIQUETTE, Mots clés et mots_clés désignent les étiquettes ; « mot-clé » et « tags » restent inconnus', () => {
    assert.deepEqual(
      ['Étiquettes', 'ETIQUETTE', 'Mots clés', 'mots_clés', 'Mots-Cles'].map((entete) => reconnaitre(entete)),
      ['etiquettes', 'etiquettes', 'etiquettes', 'etiquettes', 'etiquettes'],
    );
    assert.deepEqual(['mot-clé', 'tags', 'étiquettes 2'].map((entete) => reconnaitre(entete)), [null, null, null]);
  });

  test('presence, Présence et Tours de présence désignent la présence ; « tours » et « présences » restent inconnus', () => {
    assert.deepEqual(
      ['presence', 'Présence', 'PRÉSENCE', 'Tours de présence', 'tours_de_presence', 'Tours-de-Presence'].map((entete) =>
        reconnaitre(entete),
      ),
      ['presence', 'presence', 'presence', 'presence', 'presence', 'presence'],
    );
    assert.deepEqual(['tours', 'présences', 'tour', 'présent'].map((entete) => reconnaitre(entete)), [null, null, null, null]);
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
    assert.deepEqual(associer(['nom', 'prenom', 'appartenance', 'courriel', 'titre_pressenti', 'exclu', 'notes', 'etiquettes']), {
      colonnes: { nom: 0, prenom: 1, appartenance: 2, courriel: 3, titre_pressenti: 4, exclu: 5, notes: 6, etiquettes: 7 },
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

  test("étiquette et mots-clés ensemble : ni l'une ni l'autre, une ambiguïté sur etiquettes", () => {
    assert.deepEqual(associer(['nom', 'étiquette', 'mots-clés']), {
      colonnes: { nom: 0 },
      ambigus: [{ champ: 'etiquettes', rangs: [1, 2] }],
      nonReconnues: [],
    });
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

// Une table d'en-têtes inventée, d'un autre fichier que celui des
// participants : deux champs, des synonymes, et un synonyme de même clé que
// le nom de son champ, comme « règle » pour regle.
const TABLE_INVENTEE = Object.freeze([
  Object.freeze(['salle', Object.freeze(['salle', 'pièce', 'local'])]),
  Object.freeze(['couleur', Object.freeze(['couleur', 'Couleur', 'teinte'])]),
]);

describe('associerSelon et reconnaitreSelon : la même règle sur une autre table (§ 10.1, § 10.4)', () => {
  test('sur la table des participants, associerSelon rend exactement ce que rend associer', () => {
    const associerParticipants = associerSelon(ENTETES_DES_CHAMPS);
    const cas = [
      [['nom', 'prenom', 'appartenance', 'courriel', 'titre_pressenti', 'exclu', 'notes', 'etiquettes'], {}],
      [['notes', 'exclu', 'courriel', 'nom'], {}],
      [['nom', 'organisation', 'entreprise'], {}],
      [['nom', 'organisation', 'entreprise'], { appartenance: 2 }],
      [['nom', 'organisation', 'entreprise', 'inconnue'], { appartenance: 3 }],
      [['titre', 'équipe', 'nom', 'rôle', 'organisation', 'entreprise'], {}],
      [['x', 'nom', '', 'ligne', '  '], {}],
      [[], {}],
    ];
    for (const [entetes, choix] of cas) {
      const rendu = associerParticipants(entetes, choix);
      assert.deepEqual(rendu, associer(entetes, choix), JSON.stringify([entetes, choix]));
      assert.equal(JSON.stringify(rendu.colonnes), JSON.stringify(associer(entetes, choix).colonnes));
    }
    const reconnaitreParticipants = reconnaitreSelon(ENTETES_DES_CHAMPS);
    for (const entete of ['NOM', 'Équipe', 'mots-clés', 'ligne', 'motif', '', 'table']) {
      assert.equal(reconnaitreParticipants(entete), reconnaitre(entete), entete);
    }
  });

  test('sur une autre table, chaque champ par ses en-têtes ; ceux des participants y sont inconnus', () => {
    const reconnaitreInventee = reconnaitreSelon(TABLE_INVENTEE);
    assert.deepEqual(
      ['SALLE', 'Pièce', 'lo cal', 'couleur', 'TEINTE', 'nom', 'etiquettes', 'ligne', 'motif', ''].map(reconnaitreInventee),
      ['salle', 'salle', 'salle', 'couleur', 'couleur', null, null, null, null, null],
    );
    assert.equal(reconnaitre('salle'), null);
  });

  test("sur une autre table, l'association suit l'ordre de la table, laisse ambigu un champ revendiqué deux fois, et le choix tranche", () => {
    const associerInventee = associerSelon(TABLE_INVENTEE);
    assert.deepEqual(associerInventee(['teinte', 'nom', 'local']), {
      colonnes: { salle: 2, couleur: 0 },
      ambigus: [],
      nonReconnues: [1],
    });
    assert.equal(JSON.stringify(associerInventee(['teinte', 'local']).colonnes), '{"salle":1,"couleur":0}');
    assert.deepEqual(associerInventee(['pièce', 'teinte', 'salle']), {
      colonnes: { couleur: 1 },
      ambigus: [{ champ: 'salle', rangs: [0, 2] }],
      nonReconnues: [],
    });
    assert.deepEqual(associerInventee(['pièce', 'teinte', 'salle'], { salle: 2 }).colonnes, { salle: 2, couleur: 1 });
    assert.deepEqual(associerInventee(['pièce', 'teinte', 'salle'], { salle: 1 }).ambigus, [{ champ: 'salle', rangs: [0, 2] }]);
  });

  test("deux champs qui partagent une clé d'en-tête lèvent RangeError, qui nomme la clé ; un champ peut répéter la sienne", () => {
    const conflit = [
      ['salle', ['salle', 'pièce']],
      ['couleur', ['couleur', 'Piece']],
    ];
    assert.throws(() => associerSelon(conflit), (erreur) => erreur instanceof RangeError && /piece/.test(erreur.message));
    assert.throws(() => reconnaitreSelon(conflit), RangeError);
    assert.equal(reconnaitreSelon(TABLE_INVENTEE)('Couleur'), 'couleur');
  });

  test('la table reçue est lue une fois : la changer ensuite ne change pas la reconnaissance', () => {
    const table = [['salle', ['salle']]];
    const reconnaitreLue = reconnaitreSelon(table);
    const associerLue = associerSelon(table);
    table[0][1].push('pièce');
    table.push(['couleur', ['couleur']]);
    assert.equal(reconnaitreLue('pièce'), null);
    assert.deepEqual(associerLue(['couleur', 'salle']), { colonnes: { salle: 1 }, ambigus: [], nonReconnues: [0] });
  });
});
