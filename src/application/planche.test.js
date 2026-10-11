// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du modèle de la planche de badges (§ 4.1, § 11.4 à § 11.8,
// § 15.1, § 15.5) : ce qu'un badge porte et ne porte pas, l'ordre de la pile
// par points de code, les homonymes que rien ne sépare, la source imprimée
// (le retenu ou une proposition, Q3), les refus avant de produire, le
// filigrane, l'horodatage et la version, la réédition identique, et les
// lignes de la feuille de contrôle. Les noms d'épreuve sont inventés, hors du
// réservoir des démonstrations ; la version vient du module engendré.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { H_PROPOSITION, H_RETENU, H_RETOUCHE, personne, placementDe, soiree, table } from '../../test/fixtures/badges/cas.js';
import { EXCLUS_TEMOIN, FORME_TEMOIN, chargeTemoin } from '../../test/fixtures/badges/temoin.js';
import { cleNormalisee } from '../csv/normalisation.js';
import { VERSION } from '../version.genere.js';
import { ErreurCommande } from './erreurs.js';
import { libelle } from './libelles.js';
import { comparerPointsDeCode, homonymesDe, modelePlanche, refusPlanche, refusProduction, textesControle } from './planche.js';
import { MARQUE_TEMOIN } from './traduction.js';

const PROVENANCE = 'developpement';
const options = (autres = {}) => ({ provenance: PROVENANCE, version: VERSION.affichee, ...autres });
const modele = (charge, autres) => modelePlanche(charge, options(autres));

const VERS_PROPOSITIONS = { geste: 'ouvrirSection', section: 'propositions' };
const PIED_EVENEMENT = 'Soirée des Lucioles, 17 mai 2031';
const PIED_DATE = '17 mai 2031';
const PIED_HORODATAGE = 'Placement du 17 mai 2031 à 20:15:07';

// Le badge de la personne id dans un modèle.
const badgeDe = (m, id) => m.badges.find(({ participant }) => participant === id);
// Tous les textes d'un badge, à plat.
const textesDe = ({ textes }) => [textes.nom, ...textes.lignes, textes.appartenance ?? '', ...textes.pied, ...textes.piedReduit];

// Cinq personnes sur deux tables de deux places, deux tours : chaque tour
// laisse une personne en réserve — Théo au tour 2, Grisaille au tour 1.
function aReserve(autres = {}) {
  return soiree({
    personnes: [
      personne(1, 'Iris', 'Ombrelle'),
      personne(2, 'Théo', 'Pervenche'),
      personne(3, 'Ondine', 'Lacasse'),
      personne(4, 'Émile', 'Ombrelle'),
      personne(5, null, 'Grisaille'),
    ],
    tables: [table(1, 7, 2), table(2, 3, 2)],
    plan: [
      { sieges: [[1, 2], [3, 4]], reserve: [5] },
      { sieges: [[1, 5], [3, 4]], reserve: [2] },
    ],
    ...autres,
  });
}

// Deux personnes à la table 7 (identifiant 1), à chacun des tours.
const deuxATable7 = (tours, autres = {}) =>
  soiree({
    personnes: [personne(1, 'Iris', 'Ombrelle'), personne(2, 'Théo', 'Pervenche')],
    tables: [table(1, 7, 2)],
    plan: Array.from({ length: tours }, () => ({ sieges: [[1, 2]] })),
    ...autres,
  });

// Trois personnes à la table 7, sièges attribués, deux tours : Iris au
// siège 1 puis 2, Théo au siège 2 puis 1 ; un titre « animateur » au siège 1.
const titree = ({ reservations = [], tour2 = [2, 1, 3] } = {}) =>
  soiree({
    personnes: [personne(1, 'Iris', 'Ombrelle'), personne(2, 'Théo', 'Pervenche'), personne(3, 'Ondine', 'Lacasse')],
    tables: [table(1, 7, 3)],
    plan: [{ sieges: [[1, 2, 3]] }, { sieges: [tour2] }],
    siegesAttribues: true,
    titres: [{ table: 1, siege: 1, libelle: 'animateur' }],
    reservations,
  });

// Huit personnes sur deux tables de quatre, deux tours : deux « Théo
// Pervenche » sans appartenance, deux « Iris Ombrelle » de la même
// appartenance écrite autrement, deux « Ondine Lacasse » d'appartenances
// différentes, et deux autres.
function homonymes(autres = {}) {
  return soiree({
    personnes: [
      personne(1, 'Théo', 'Pervenche'),
      personne(2, 'Théo', 'Pervenche'),
      personne(3, 'Iris', 'Ombrelle', { appartenance: 'Club des Merles' }),
      personne(4, 'iris', 'OMBRELLE', { appartenance: ' club  des MERLES ' }),
      personne(5, 'Ondine', 'Lacasse', { appartenance: 'Grisaille' }),
      personne(6, 'Ondine', 'Lacasse', { appartenance: 'Club des Merles' }),
      personne(7, 'Émile', 'Ombrelle'),
      personne(8, 'Ångel', 'Ombrelle'),
    ],
    tables: [table(1, 1, 4), table(2, 2, 4)],
    plan: [
      { sieges: [[1, 2, 3, 4], [5, 6, 7, 8]] },
      { sieges: [[1, 3, 5, 7], [2, 4, 6, 8]] },
    ],
    ...autres,
  });
}

describe('planche : ce que porte un badge (§ 11.4, § 11.5, § 4.1)', () => {
  test('un exclu n’a pas de badge et compte : le témoin donne 257 badges pour 260 participants, 3 exclus', () => {
    const m = modele(chargeTemoin());
    assert.deepEqual(m.comptes, { participants: FORME_TEMOIN.participants, exclus: FORME_TEMOIN.exclus, produits: FORME_TEMOIN.produits });
    assert.equal(m.badges.length, 257);
    for (const id of EXCLUS_TEMOIN) assert.equal(badgeDe(m, id), undefined, `exclu ${id}`);
    assert.equal(new Set(m.badges.map(({ participant }) => participant)).size, 257);
    assert.deepEqual(m.evenement, { nom: 'Soirée des Lucioles', date: '2031-05-17' });
  });

  test('une personne en réserve à un tour lit « pas de table » à ce tour, en toutes lettres', () => {
    const m = modele(aReserve());
    assert.deepEqual(badgeDe(m, 2).textes.lignes, ['Tour 1 — table 7', 'Tour 2 — pas de table']);
    assert.deepEqual(badgeDe(m, 2).lignes, [
      { tour: 1, table: 7, siege: null, titre: null },
      { tour: 2, table: null, siege: null, titre: null },
    ]);
    assert.deepEqual(badgeDe(m, 5).textes.lignes, ['Tour 1 — pas de table', 'Tour 2 — table 7']);
  });

  test('un itinéraire constant s’écrit en une ligne « Toute la soirée » à R ≥ 2 ; à R = 1, la ligne du tour', () => {
    const quatre = modele(deuxATable7(4));
    assert.deepEqual(badgeDe(quatre, 1).textes.lignes, ['Toute la soirée — table 7']);
    assert.deepEqual(badgeDe(quatre, 1).lignes, [{ tour: null, table: 7, siege: null, titre: null }]);
    assert.deepEqual(badgeDe(modele(deuxATable7(1)), 1).textes.lignes, ['Tour 1 — table 7']);
    assert.deepEqual(badgeDe(modele(aReserve()), 3).textes.lignes, ['Toute la soirée — table 3']);
  });

  test('le siège ne s’écrit que sous sièges attribués, compté chaises vides comprises', () => {
    assert.deepEqual(badgeDe(modele(deuxATable7(1, { siegesAttribues: true })), 2).textes.lignes, ['Tour 1 — table 7, siège 2']);
    assert.doesNotMatch(badgeDe(modele(deuxATable7(1)), 2).textes.lignes[0], /siège/);
    const vide = soiree({
      personnes: [personne(1, 'Iris', 'Ombrelle'), personne(2, 'Théo', 'Pervenche')],
      tables: [table(1, 7, 3)],
      plan: [{ sieges: [[1, null, 2]] }],
      siegesAttribues: true,
    });
    assert.deepEqual(badgeDe(modele(vide), 2).textes.lignes, ['Tour 1 — table 7, siège 3']);
  });

  test('un titre posé sur un siège occupé sans réservation ne s’imprime pas (§ 4.1)', () => {
    const m = modele(titree());
    assert.deepEqual(badgeDe(m, 1).textes.lignes, ['Tour 1 — table 7, siège 1', 'Tour 2 — table 7, siège 2']);
    assert.deepEqual(badgeDe(m, 2).textes.lignes, ['Tour 1 — table 7, siège 2', 'Tour 2 — table 7, siège 1']);
    for (const badge of m.badges) for (const texte of textesDe(badge)) assert.doesNotMatch(texte, /animateur/);
  });

  test('une réservation d’un seul tour qui fait la titulaire met le titre sur la ligne de ce tour, seule', () => {
    const m = modele(titree({ reservations: [{ participant: 1, table: 1, siege: 1, portee: 'tour', tour: 1 }] }));
    assert.deepEqual(badgeDe(m, 1).textes.lignes, ['Tour 1 — table 7, siège 1 — animateur', 'Tour 2 — table 7, siège 2']);
    assert.deepEqual(badgeDe(m, 1).lignes[0], { tour: 1, table: 7, siege: 1, titre: 'animateur' });
    assert.deepEqual(badgeDe(m, 2).textes.lignes, ['Tour 1 — table 7, siège 2', 'Tour 2 — table 7, siège 1']);
    // Assise au même siège aux deux tours, la titulaire d'un seul tour garde
    // deux lignes : le titre change, l'itinéraire n'est pas constant.
    const memeSiege = modele(titree({ reservations: [{ participant: 1, table: 1, siege: 1, portee: 'tour', tour: 1 }], tour2: [1, 2, 3] }));
    assert.deepEqual(badgeDe(memeSiege, 1).textes.lignes, ['Tour 1 — table 7, siège 1 — animateur', 'Tour 2 — table 7, siège 1']);
    assert.deepEqual(badgeDe(memeSiege, 1).lignes, [
      { tour: 1, table: 7, siege: 1, titre: 'animateur' },
      { tour: 2, table: 7, siege: 1, titre: null },
    ]);
  });

  test('une titulaire « tous les tours » que le retenu assied ailleurs à un tour n’y porte pas le titre ; assise au siège à chaque tour, une ligne', () => {
    const tous = [{ participant: 1, table: 1, siege: 1, portee: 'tous', tour: null }];
    assert.deepEqual(badgeDe(modele(titree({ reservations: tous })), 1).textes.lignes, [
      'Tour 1 — table 7, siège 1 — animateur',
      'Tour 2 — table 7, siège 2',
    ]);
    assert.deepEqual(badgeDe(modele(titree({ reservations: tous, tour2: [1, 2, 3] })), 1).textes.lignes, [
      'Toute la soirée — table 7, siège 1 — animateur',
    ]);
  });

  test('sans sièges attribués, une réservation sans siège fait la titulaire ; le tour où le retenu l’assied à une autre table, rien', () => {
    const charge = soiree({
      personnes: [personne(1, 'Iris', 'Ombrelle'), personne(2, 'Théo', 'Pervenche'), personne(3, 'Ondine', 'Lacasse'), personne(4, null, 'Grisaille')],
      tables: [table(1, 7, 2), table(2, 3, 2)],
      plan: [{ sieges: [[1, 2], [3, 4]] }, { sieges: [[2, 3], [1, 4]] }],
      titres: [{ table: 1, siege: 1, libelle: 'animatrice' }],
      reservations: [{ participant: 1, table: 1, siege: null, portee: 'tous', tour: null }],
    });
    const m = modele(charge);
    assert.deepEqual(badgeDe(m, 1).textes.lignes, ['Tour 1 — table 7 — animatrice', 'Tour 2 — table 3']);
    assert.deepEqual(badgeDe(m, 2).textes.lignes, ['Toute la soirée — table 7']);
  });

  test('aucun texte du badge ne porte le courriel, les notes, le titre pressenti, l’identifiant hors homonymie ni la version', () => {
    const charge = chargeTemoin();
    const m = modele(charge);
    let parcourus = 0;
    for (const badge of m.badges) {
      const { courriel, notes, titrePressenti } = charge.participants.find(({ id }) => id === badge.participant);
      assert.equal(badge.identifiant, null);
      const identifiant = libelle('planche.pied.identifiant', { identifiant: badge.participant });
      for (const texte of textesDe(badge)) {
        parcourus += 1;
        for (const interdit of [courriel, notes, titrePressenti, identifiant, VERSION.affichee]) {
          assert.ok(!texte.includes(interdit), `${badge.participant} : « ${texte} » porte « ${interdit} »`);
        }
      }
    }
    assert.ok(parcourus > 257 * 4, `${parcourus} textes`);
    assert.equal(m.version, VERSION.affichee);
  });

  test('le nom affiché et l’appartenance, en NFC ; sans appartenance, rien', () => {
    const decomposee = soiree({
      personnes: [personne(1, 'Ze\u{0301}lie', 'Ombrelle', { appartenance: 'Cafe\u{0301} des Merles' }), personne(2, 'Théo', 'Pervenche')],
      tables: [table(1, 7, 2)],
      plan: [{ sieges: [[1, 2]] }],
    });
    const m = modele(decomposee);
    assert.equal(badgeDe(m, 1).nom, 'Z\u{00E9}lie Ombrelle');
    assert.equal(badgeDe(m, 1).textes.nom, 'Z\u{00E9}lie Ombrelle');
    assert.equal(badgeDe(m, 1).appartenance, 'Caf\u{00E9} des Merles');
    assert.equal(badgeDe(m, 1).textes.appartenance, 'Caf\u{00E9} des Merles');
    assert.equal(badgeDe(m, 2).appartenance, null);
    assert.equal(badgeDe(m, 2).textes.appartenance, null);
  });

  test('le pied porte l’événement et sa date, puis l’horodatage ; piedReduit retire le nom de l’événement et garde la date', () => {
    const badge = badgeDe(modele(aReserve()), 1);
    assert.deepEqual(badge.textes.pied, [PIED_EVENEMENT, PIED_HORODATAGE]);
    assert.deepEqual(badge.textes.piedReduit, [PIED_DATE, PIED_HORODATAGE]);
    const sansDate = badgeDe(modele(aReserve({ date: null })), 1);
    assert.deepEqual(sansDate.textes.pied, ['Soirée des Lucioles', PIED_HORODATAGE]);
    assert.deepEqual(sansDate.textes.piedReduit, [PIED_HORODATAGE]);
  });
});

describe('planche : l’ordre de la pile (§ 11.6, § 15.5, décision 9)', () => {
  test('comparerPointsDeCode compare par points de code, là où « < » compare des unités UTF-16', () => {
    assert.equal(comparerPointsDeCode('a', 'b'), -1);
    assert.equal(comparerPointsDeCode('b', 'a'), 1);
    assert.equal(comparerPointsDeCode('', ''), 0);
    assert.equal(comparerPointsDeCode('abc', 'abc'), 0);
    assert.equal(comparerPointsDeCode('ab', 'abc'), -1);
    assert.equal(comparerPointsDeCode('abc', 'ab'), 1);
    assert.equal(comparerPointsDeCode('\u{1D49C}b', '\u{1D49C}c'), -1, 'un point astral commun, puis la différence');
    assert.equal(comparerPointsDeCode('\u{1D49C}', '\u{1D49C}'), 0);
    const [pleine, script] = ['\u{FF41}', '\u{1D49C}'];
    assert.equal(pleine < script, false);
    assert.equal(comparerPointsDeCode(pleine, script), -1);
    assert.equal(comparerPointsDeCode(script, pleine), 1);
    for (const intrus of [null, undefined, 3]) assert.throws(() => comparerPointsDeCode(intrus, 'a'), TypeError);
  });

  // Dix personnes à une table, listées dans l'ordre inverse des
  // identifiants : l'ordre rendu ne doit rien à celui de la liste.
  const PERSONNES_ORDRE = [
    personne(1, 'Zélie', 'Ombrelle'),
    personne(2, 'Émile', 'Ombrelle'),
    personne(3, 'Eric', 'Ombrelle'),
    personne(4, 'Ångel', 'Ombrelle'),
    personne(5, 'Iris', 'Pervenche'),
    personne(6, 'Iris', 'Pervenche'),
    personne(7, 'Ondine', 'Lacasse'),
    personne(8, 'Iris', '\u{0152}illet'),
    personne(9, '\u{FF21}da', 'Ombrelle'),
    personne(10, '\u{1D49C}da', 'Ombrelle'),
  ];
  const ordonnee = () =>
    soiree({
      personnes: [...PERSONNES_ORDRE].reverse(),
      tables: [table(1, 1, 10)],
      plan: [{ sieges: [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]] }],
    });

  test('l’ordre suit la clé normalisée du couple (nom, prénom), par points de code, départagé par identifiant — jamais localeCompare', () => {
    const [cleA, cleScript] = ['\u{FF21}da', '\u{1D49C}da'].map(cleNormalisee);
    assert.equal(cleA < cleScript, false, '« < » range la forme pleine après la lettre mathématique');
    assert.equal(comparerPointsDeCode(cleA, cleScript), -1, 'les points de code la rangent avant');
    // La collation française range « œillet » comme « oeillet », avant
    // « ombrelle » ; l'ordre attendu ici le met après « pervenche ». La
    // locale est nommée : sans elle, la précondition suit la langue du
    // processus, et la collation suédoise range « œ » après « o ».
    assert.ok(cleNormalisee('\u{0152}illet').localeCompare('ombrelle', 'fr') < 0);
    const m = modele(ordonnee());
    assert.deepEqual(m.badges.map(({ participant }) => participant), [7, 4, 2, 3, 1, 9, 10, 5, 6, 8]);
  });

  test('l’ordre par table : la table du tour 1 par numéro, l’ordre alphabétique dans chacune, la réserve du tour 1 en dernier', () => {
    const charge = soiree({
      personnes: [
        personne(1, 'Iris', 'Ombrelle'),
        personne(2, 'Théo', 'Pervenche'),
        personne(3, 'Ondine', 'Lacasse'),
        personne(4, 'Émile', 'Ombrelle'),
        personne(5, 'Ångel', 'Ombrelle'),
      ],
      tables: [table(1, 2, 2), table(2, 1, 2)],
      plan: [{ sieges: [[1, 2], [4, 3]], reserve: [5] }],
    });
    assert.deepEqual(modele(charge, { ordre: 'table' }).badges.map(({ participant }) => participant), [3, 4, 1, 2, 5]);
    assert.deepEqual(modele(charge).badges.map(({ participant }) => participant), [3, 5, 4, 1, 2]);
  });

  test('sans prénom, la clé du prénom est vide : « Grisaille » seule vient avant « Ondine Grisaille », deux sans prénom par identifiant', () => {
    const charge = soiree({
      personnes: [personne(1, 'Ondine', 'Grisaille'), personne(2, null, 'Grisaille'), personne(3, null, 'grisaille')],
      tables: [table(1, 1, 3)],
      plan: [{ sieges: [[1, 2, 3]] }],
    });
    assert.deepEqual(modele(charge).badges.map(({ participant }) => participant), [2, 3, 1]);
  });

  test('par table, deux tables de même numéro se départagent par leur identifiant', () => {
    const charge = soiree({
      personnes: [personne(1, 'Iris', 'Ombrelle'), personne(2, 'Théo', 'Pervenche'), personne(3, 'Ondine', 'Lacasse')],
      tables: [table(1, 4, 2), table(2, 4, 2), table(3, 2, 2)],
      plan: [{ sieges: [[2], [1], [3]] }],
    });
    assert.deepEqual(modele(charge, { ordre: 'table' }).badges.map(({ participant }) => participant), [3, 2, 1]);
  });

  test('un ordre inconnu lève TypeError', () => {
    for (const ordre of ['alpha', 'Table', null]) assert.throws(() => modele(aReserve(), { ordre }), TypeError, String(ordre));
  });
});

describe('planche : les homonymes que rien ne sépare (§ 11.4, décision 7)', () => {
  test('même nom normalisé, sans appartenance ou de même appartenance normalisée : nommés ; d’appartenances différentes, non', () => {
    assert.deepEqual(homonymesDe(homonymes()), [
      { nom: 'Iris Ombrelle', ids: [3, 4] },
      { nom: 'Théo Pervenche', ids: [1, 2] },
    ]);
    const m = modele(homonymes());
    assert.deepEqual(m.homonymes, homonymesDe(homonymes()));
    for (const id of [1, 2, 3, 4]) {
      const badge = badgeDe(m, id);
      assert.equal(badge.identifiant, id);
      assert.equal(badge.textes.pied.at(-1), `Identifiant n° ${id}`);
      assert.equal(badge.textes.piedReduit.at(-1), `Identifiant n° ${id}`);
    }
    for (const id of [5, 6, 7, 8]) {
      assert.equal(badgeDe(m, id).identifiant, null);
      assert.equal(badgeDe(m, id).textes.pied.length, 2);
    }
  });

  test('le nom imprimé décide : « Théo Pervenche » sans prénom rejoint « Théo » « Pervenche » ; un exclu ne compte pas', () => {
    const charge = homonymes();
    // L'exclu porte le nom et l'appartenance du groupe [3, 4] : compté, il
    // le rejoindrait.
    charge.participants.push(
      personne(9, null, 'Théo Pervenche'),
      personne(10, 'Iris', 'Ombrelle', { appartenance: 'Club des Merles', exclu: true }),
    );
    charge.retenu = { proposition: 1, ...placementDe(charge, [{ sieges: [[1, 2, 3, 4], [5, 6, 7, 8, 9]] }, { sieges: [[1, 3, 5, 7, 9], [2, 4, 6, 8]] }]) };
    charge.tables[1].sieges = 5;
    charge.retenu.capacites = [4, 5];
    assert.deepEqual(homonymesDe(charge), [
      { nom: 'Iris Ombrelle', ids: [3, 4] },
      { nom: 'Théo Pervenche', ids: [1, 2, 9] },
    ]);
  });

  test('un présent seul de son nom à côté d’un homonyme exclu n’a pas d’identifiant au pied', () => {
    const charge = soiree({
      personnes: [
        personne(1, 'Théo', 'Pervenche'),
        personne(2, 'Théo', 'Pervenche', { exclu: true }),
        personne(3, 'Iris', 'Ombrelle'),
      ],
      tables: [table(1, 7, 2)],
      plan: [{ sieges: [[1, 3]] }],
    });
    assert.deepEqual(homonymesDe(charge), []);
    const m = modele(charge);
    assert.deepEqual(m.homonymes, []);
    assert.equal(badgeDe(m, 1).identifiant, null);
    assert.deepEqual(badgeDe(m, 1).textes.pied, [PIED_EVENEMENT, PIED_HORODATAGE]);
    assert.deepEqual(badgeDe(m, 1).textes.piedReduit, [PIED_DATE, PIED_HORODATAGE]);
  });

  test('deux collisions du même nom, d’appartenances différentes : deux groupes, rangés par appartenance normalisée', () => {
    const charge = soiree({
      personnes: [
        personne(1, 'Ondine', 'Lacasse', { appartenance: 'Grisaille' }),
        personne(2, 'Ondine', 'Lacasse', { appartenance: 'Club des Merles' }),
        personne(3, 'Ondine', 'Lacasse', { appartenance: 'grisaille' }),
        personne(4, 'Ondine', 'Lacasse', { appartenance: 'Club des merles' }),
      ],
      tables: [table(1, 1, 4)],
      plan: [{ sieges: [[1, 2, 3, 4]] }],
    });
    assert.deepEqual(homonymesDe(charge), [
      { nom: 'Ondine Lacasse', ids: [2, 4] },
      { nom: 'Ondine Lacasse', ids: [1, 3] },
    ]);
  });

  test('sans homonyme, une liste vide', () => {
    assert.deepEqual(homonymesDe(aReserve()), []);
    assert.deepEqual(modele(aReserve()).homonymes, []);
  });
});

describe('planche : la source imprimée, le retenu ou une proposition (Q3)', () => {
  // Le retenu de aReserve, et la proposition 2 qui permute les tables au
  // tour 2.
  const avecProposition = (autres) =>
    aReserve({
      propositions: [
        [2, [
          { sieges: [[1, 2], [3, 4]], reserve: [5] },
          { sieges: [[3, 4], [1, 5]], reserve: [2] },
        ]],
      ],
      ...autres,
    });

  test('une proposition désignée donne ses badges, BROUILLON même sous l’état retenu, et son horodatage', () => {
    const charge = avecProposition();
    const retenu = modele(charge);
    const tiree = modele(charge, { source: 'proposition', proposition: 2 });
    assert.equal(retenu.brouillon, false);
    assert.equal(tiree.brouillon, true);
    assert.equal(retenu.horodatage, H_RETENU);
    assert.equal(tiree.horodatage, H_PROPOSITION);
    assert.deepEqual(badgeDe(tiree, 1).textes.lignes, ['Tour 1 — table 7', 'Tour 2 — table 3']);
    assert.deepEqual(badgeDe(retenu, 1).textes.lignes, ['Toute la soirée — table 7']);
    assert.notDeepEqual(tiree, retenu);
    assert.deepEqual([retenu.source, retenu.proposition], ['retenu', null]);
    assert.deepEqual([tiree.source, tiree.proposition], ['proposition', 2]);
    const sansChamp = avecProposition();
    delete sansChamp.propositions[0].horodatage;
    assert.equal(modele(sansChamp, { source: 'proposition', proposition: 2 }).horodatage, null);
    for (const etat of ['bloque', 'brouillon']) {
      assert.equal(modele(avecProposition({ etat }), { source: 'proposition', proposition: 2 }).brouillon, true, etat);
    }
  });

  test('une planche se tire d’une proposition sans retenu ; un identifiant inconnu lève PROPOSITION_INCONNUE ; une autre source, TypeError', () => {
    const sansRetenu = avecProposition({ plan: null, etat: 'propose' });
    assert.equal(modele(sansRetenu, { source: 'proposition', proposition: 2 }).badges.length, 5);
    assert.throws(
      () => modele(avecProposition(), { source: 'proposition', proposition: 9 }),
      (erreur) => erreur instanceof ErreurCommande && erreur.code === 'PROPOSITION_INCONNUE' && erreur.details.id === 9,
    );
    for (const source of ['reservations', 'plan', null]) {
      assert.throws(() => modele(avecProposition(), { source }), TypeError, String(source));
      assert.throws(() => refusPlanche(avecProposition(), { source }), TypeError, String(source));
    }
    assert.throws(() => modele(avecProposition(), { source: 'proposition', proposition: '2' }), TypeError);
  });
});

describe('planche : les refus avant de produire (§ 11.8, Q3)', () => {
  test('ni retenu ni proposition désignée : PLANCHE_SANS_PLACEMENT, remède les propositions', () => {
    const attendu = { code: 'PLANCHE_SANS_PLACEMENT', details: { remede: VERS_PROPOSITIONS } };
    assert.deepEqual(refusPlanche(aReserve({ plan: null })), attendu);
    assert.deepEqual(refusPlanche(aReserve(), { source: 'proposition', proposition: null }), attendu);
    assert.throws(
      () => modele(aReserve({ plan: null })),
      (erreur) => erreur instanceof ErreurCommande && erreur.code === attendu.code && assert.deepEqual(erreur.details, attendu.details) === undefined,
    );
  });

  test('un retenu qui se contredit : RETENU_FAUTIF, tel que le relaient les places, remède la version précédente du fichier', () => {
    const attendu = { code: 'RETENU_FAUTIF', details: { remede: { geste: 'ouvrirSecours', source: 'precedent' } } };
    const fautif = aReserve();
    fautif.retenu.placement[0].sieges[1] = [3, 3];
    assert.deepEqual(refusPlanche(fautif), attendu);
    assert.throws(() => modele(fautif), (erreur) => erreur instanceof ErreurCommande && erreur.code === 'RETENU_FAUTIF');
  });

  test('une proposition qui se contredit : PROPOSITION_FAUTIVE la nomme, remède les propositions ; le retenu sain se produit, et ne la juge pas', () => {
    const proposee = aReserve({ propositions: [[2, [{ sieges: [[1, 2], [3, 4]], reserve: [5] }, { sieges: [[1, 5], [3, 4]], reserve: [2] }]]] });
    proposee.propositions[0].placement[1].reserve = [];
    const attendu = { code: 'PROPOSITION_FAUTIVE', details: { id: 2, remede: VERS_PROPOSITIONS } };
    assert.deepEqual(refusPlanche(proposee, { source: 'proposition', proposition: 2 }), attendu);
    assert.throws(
      () => modele(proposee, { source: 'proposition', proposition: 2 }),
      (erreur) => erreur instanceof ErreurCommande && erreur.code === 'PROPOSITION_FAUTIVE' && erreur.details.id === 2,
    );
    assert.equal(refusPlanche(proposee), null);
    const texte = libelle(attendu.code, attendu.details);
    assert.match(texte, /proposition n° 2\b/);
    assert.doesNotMatch(texte, /retenu|version précédente/);
    // Un retenu fautif n'empêche pas d'imprimer une proposition saine.
    const retenuFautif = aReserve({ propositions: [[2, [{ sieges: [[1, 2], [3, 4]], reserve: [5] }, { sieges: [[1, 5], [3, 4]], reserve: [2] }]]] });
    retenuFautif.retenu.placement[0].sieges[1] = [3, 3];
    assert.equal(refusPlanche(retenuFautif, { source: 'proposition', proposition: 2 }), null);
  });

  test('une source en dérive — une personne ajoutée depuis — : PLANCHE_DERIVE, qui la nomme avant de produire', () => {
    const charge = aReserve();
    charge.participants.push(personne(6, 'Ondine', 'Grisaille'));
    const refus = refusPlanche(charge);
    assert.deepEqual(refus, {
      code: 'PLANCHE_DERIVE',
      details: { raisons: [{ code: 'PARTICIPANT_NON_PLACE', participant: 6, personne: 'Ondine Grisaille' }], remede: VERS_PROPOSITIONS },
    });
    assert.match(libelle(refus.code, refus.details), /Ondine Grisaille/);
    assert.throws(
      () => modele(charge),
      (erreur) => erreur instanceof ErreurCommande && erreur.code === 'PLANCHE_DERIVE' && erreur.details.raisons[0].personne === 'Ondine Grisaille',
    );
  });

  test('un retenu à 3 tours sur une soirée de 4 : PLANCHE_DERIVE, le nombre de tours nommé', () => {
    const charge = deuxATable7(3);
    charge.evenement.tours = 4;
    assert.deepEqual(refusPlanche(charge)?.details.raisons, [{ code: 'TOURS_CHANGES', avant: 3, maintenant: 4 }]);
  });

  test('l’ordre des refus est épinglé : sans placement, puis fautif, puis dérive', () => {
    const fautifEtDerive = aReserve();
    fautifEtDerive.retenu.placement[0].sieges[1] = [3, 3];
    fautifEtDerive.participants.push(personne(6, 'Ondine', 'Grisaille'));
    assert.equal(refusPlanche(fautifEtDerive).code, 'RETENU_FAUTIF');
    const fautiveEtDerive = aReserve({ propositions: [[2, [{ sieges: [[1, 2], [3, 4]], reserve: [5] }, { sieges: [[1, 5], [3, 4]], reserve: [2] }]]] });
    fautiveEtDerive.propositions[0].placement[1].reserve = [];
    fautiveEtDerive.participants.push(personne(6, 'Ondine', 'Grisaille'));
    assert.equal(refusPlanche(fautiveEtDerive, { source: 'proposition', proposition: 2 }).code, 'PROPOSITION_FAUTIVE');
    const sansPlacementEtDerive = aReserve({ plan: null });
    sansPlacementEtDerive.participants.push(personne(6, 'Ondine', 'Grisaille'));
    assert.equal(refusPlanche(sansPlacementEtDerive).code, 'PLANCHE_SANS_PLACEMENT');
    assert.equal(refusPlanche(aReserve()), null);
  });
});

describe('planche : brouillon, horodatage, version, réédition (§ 11.4, § 11.7, § 11.8)', () => {
  test('brouillon selon estBrouillon : faux sous l’état retenu ou bloqué, vrai sous brouillon ou proposé avec un retenu', () => {
    const lus = ['brouillon', 'propose', 'retenu', 'bloque'].map((etat) => [etat, modele(aReserve({ etat })).brouillon]);
    assert.deepEqual(lus, [
      ['brouillon', true],
      ['propose', true],
      ['retenu', false],
      ['bloque', false],
    ]);
  });

  test('l’horodatage est celui du retenu ; sans le champ, null, et le pied dit l’horodatage inconnu', () => {
    assert.equal(modele(aReserve()).horodatage, H_RETENU);
    const ancien = modele(aReserve({ horodatage: null }));
    assert.equal(ancien.horodatage, null);
    assert.deepEqual(badgeDe(ancien, 1).textes.pied, [PIED_EVENEMENT, 'Horodatage du placement inconnu']);
  });

  test('la version visible, la marque de documentation dans une construction de documentation ; jamais sur un badge', () => {
    assert.equal(modele(aReserve()).version, VERSION.affichee);
    const documentation = modelePlanche(aReserve(), { provenance: 'documentation', version: VERSION.affichee });
    assert.equal(documentation.version, libelle('sorties.version.documentation'));
    for (const badge of documentation.badges) for (const texte of textesDe(badge)) assert.ok(!texte.includes(documentation.version));
    assert.throws(() => modelePlanche(aReserve(), { provenance: PROVENANCE }), TypeError);
    assert.throws(() => modelePlanche(aReserve(), { version: VERSION.affichee }), TypeError);
  });

  test('une réédition de trois personnes : reedition.ids, trois badges en ordre alphabétique, les comptes de la soirée gardés', () => {
    const m = modele(aReserve(), { selection: [2, 5, 4] });
    assert.deepEqual(m.badges.map(({ participant }) => participant), [5, 4, 2]);
    assert.deepEqual(m.reedition, { ids: [5, 4, 2] });
    assert.deepEqual(m.comptes, { participants: 5, exclus: 0, produits: 3 });
    assert.equal(modele(aReserve()).reedition, null);
  });

  test('une sélection vide, en double, d’identifiants non entiers lève TypeError ; une personne inconnue ou exclue, son refus', () => {
    for (const selection of [[], [2, 2], [1.5], 'tous', [null]]) {
      assert.throws(() => modele(aReserve(), { selection }), TypeError, JSON.stringify(selection));
    }
    assert.throws(
      () => modele(aReserve(), { selection: [1, 42] }),
      (erreur) => erreur instanceof ErreurCommande && erreur.code === 'PARTICIPANT_INCONNU' && erreur.details.id === 42,
    );
    const charge = chargeTemoin();
    assert.throws(
      () => modele(charge, { selection: [EXCLUS_TEMOIN[0]] }),
      (erreur) => erreur instanceof ErreurCommande && erreur.code === 'PERSONNE_EXCLUE' && erreur.details.participant === EXCLUS_TEMOIN[0],
    );
  });

  test('deux appels sur la même charge rendent des modèles égaux, sans la modifier', () => {
    const charge = homonymes();
    const avant = structuredClone(charge);
    assert.deepStrictEqual(modele(charge), modele(charge));
    assert.deepStrictEqual(modele(charge, { selection: [6, 1] }), modele(charge, { selection: [1, 6] }));
    assert.deepStrictEqual(charge, avant);
  });
});

describe('planche : la réédition identique (§ 11.8)', () => {
  test('les textes d’un badge réédité égalent ceux du modèle complet, identifiant d’homonyme compris', () => {
    const complet = modele(homonymes());
    const reedite = modele(homonymes(), { selection: [2, 5, 7] });
    assert.equal(badgeDe(reedite, 2).identifiant, 2);
    for (const badge of reedite.badges) assert.deepStrictEqual(badge, badgeDe(complet, badge.participant), String(badge.participant));
    assert.deepEqual(reedite.homonymes, complet.homonymes);
  });

  test('après une retouche du retenu, le pied diffère par l’horodatage, le reste est égal', () => {
    const avant = modele(homonymes(), { selection: [2, 5, 7] });
    const retouchee = homonymes();
    retouchee.retenu.horodatage = H_RETOUCHE;
    const tour2 = retouchee.retenu.placement[1].sieges;
    [tour2[0][1], tour2[1][3]] = [8, 3];
    tour2[0].sort((a, b) => a - b);
    tour2[1].sort((a, b) => a - b);
    const apres = modele(retouchee, { selection: [2, 5, 7] });
    assert.notEqual(badgeDe(modele(retouchee), 3).textes.lignes.join(), badgeDe(modele(homonymes()), 3).textes.lignes.join());
    for (const badge of apres.badges) {
      const ancien = badgeDe(avant, badge.participant);
      const { pied, piedReduit, ...reste } = badge.textes;
      const { pied: piedAncien, piedReduit: reduitAncien, ...resteAncien } = ancien.textes;
      assert.deepStrictEqual(reste, resteAncien);
      assert.deepEqual(pied.filter((ligne, rang) => ligne !== piedAncien[rang]), ['Placement du 17 mai 2031 à 21:42:30']);
      assert.deepEqual(piedReduit.filter((ligne, rang) => ligne !== reduitAncien[rang]), ['Placement du 17 mai 2031 à 21:42:30']);
    }
  });
});

describe('planche : la feuille de contrôle (§ 11.3, § 11.5, § 11.8)', () => {
  const sansInsecable = (lignes) => lignes.map((ligne) => ligne.replace(/[\u{00A0}\u{202F}]/gu, ' '));

  test('dimensions, papier, imposition, planches, comptes, événement, horodatage, version, consigne d’impression', () => {
    const m = modele(chargeTemoin());
    const lignes = sansInsecable(textesControle(m, { papier: 'A4', imposition: 'feuille', planches: FORME_TEMOIN.planchesA4 }));
    for (const attendue of [
      'Badge : 105 × 148 mm (A6)',
      'Papier : A4, 210 × 297 mm',
      'Imposition : feuille par feuille',
      'Planches : 65',
      '257 badges pour 260 participants, 3 exclus',
      `Événement : ${PIED_EVENEMENT}`,
      PIED_HORODATAGE,
      `Version : ${VERSION.affichee}`,
      'Imprimer en recto seul, à 100 %',
    ]) {
      assert.ok(lignes.includes(attendue), `« ${attendue} » absente de ${JSON.stringify(lignes)}`);
    }
    assert.ok(!lignes.includes('BROUILLON'));
    for (const ligne of lignes) {
      assert.doesNotMatch(ligne, /\bundefined\b|\bnull\b|\bNaN\b/);
      assert.ok(!ligne.includes(MARQUE_TEMOIN.ouverture), ligne);
    }
  });

  test('l’autre papier et l’autre imposition se nomment ; un brouillon porte BROUILLON ; l’horodatage inconnu se dit', () => {
    const m = modele(aReserve({ etat: 'brouillon', horodatage: null, date: null }));
    const autre = Object.keys({ Lettre: 0 })[0];
    const lignes = sansInsecable(textesControle(m, { papier: autre, imposition: 'pile', planches: 3 }));
    for (const attendue of [
      `Papier : ${autre}, 215,9 × 279,4 mm`,
      'Imposition : en pile',
      'Planches : 3',
      '5 badges pour 5 participants',
      'Événement : Soirée des Lucioles',
      'Horodatage du placement inconnu',
      'BROUILLON',
    ]) {
      assert.ok(lignes.includes(attendue), `« ${attendue} » absente de ${JSON.stringify(lignes)}`);
    }
  });

  test('la source se nomme : le placement retenu, ou la proposition par son numéro, avant l’horodatage du placement', () => {
    const charge = aReserve({ propositions: [[2, [{ sieges: [[1, 2], [3, 4]], reserve: [5] }, { sieges: [[3, 4], [1, 5]], reserve: [2] }]]] });
    const options = { papier: 'A4', imposition: 'feuille', planches: 2 };
    const retenu = textesControle(modele(charge), options);
    const tiree = textesControle(modele(charge, { source: 'proposition', proposition: 2 }), options);
    assert.ok(retenu.includes('Source : le placement retenu'), JSON.stringify(retenu));
    const ligne = 'Source : la proposition n° 2, qui n\u{2019}est pas le placement retenu';
    assert.ok(tiree.includes(ligne), JSON.stringify(tiree));
    assert.equal(tiree.indexOf(ligne) + 1, tiree.indexOf(libelle('planche.pied.horodatage', { horodatage: H_PROPOSITION })));
    assert.ok(!retenu.some((texte) => texte.includes('proposition')), JSON.stringify(retenu));
    // Une source hors de son domaine lève.
    const m = modele(charge);
    for (const mauvaise of [{ source: undefined }, { source: 'plan' }, { source: 'proposition', proposition: null }, { source: 'retenu', proposition: 2 }]) {
      assert.throws(() => textesControle({ ...m, ...mauvaise }, options), TypeError, JSON.stringify(mauvaise));
    }
  });

  test('une réédition s’annonce, « Réédition : 3 badges », puis nomme les trois dans l’ordre de la pile', () => {
    const m = modele(aReserve(), { selection: [2, 5, 4] });
    const lignes = textesControle(m, { papier: 'A4', imposition: 'feuille', planches: 1 });
    const debut = lignes.indexOf('Réédition : 3 badges');
    assert.ok(debut >= 0, JSON.stringify(lignes));
    assert.deepEqual(lignes.slice(debut + 1, debut + 4), ['Grisaille', 'Émile Ombrelle', 'Théo Pervenche']);
    assert.ok(lignes.includes('3 badges pour 5 participants'));
    assert.equal(modele(aReserve(), { selection: [1] }).comptes.produits, 1);
    assert.ok(textesControle(modele(aReserve(), { selection: [1] }), { papier: 'A4', imposition: 'feuille', planches: 1 }).includes('Réédition : 1 badge'));
  });

  test('chaque glyphe absent s’écrit « U+674E », point de code par point de code, et jamais tel quel', () => {
    const charge = soiree({
      personnes: [personne(1, '\u{674E}', 'Ombrelle'), personne(2, 'Théo', 'Pervenche')],
      tables: [table(1, 7, 2)],
      plan: [{ sieges: [[1, 2]] }],
      nom: 'Soirée \u{20000}',
    });
    const m = modele(charge, { selection: [1] });
    const lignes = textesControle(m, { papier: 'A4', imposition: 'feuille', planches: 1, absents: ['\u{674E}', '\u{20000}', '\u{674E}'] });
    for (const ligne of lignes) {
      assert.ok(!ligne.includes('\u{674E}'), ligne);
      assert.ok(!ligne.includes('\u{20000}'), ligne);
    }
    assert.ok(lignes.includes('U+674E Ombrelle'), JSON.stringify(lignes));
    assert.ok(lignes.some((ligne) => ligne.startsWith('Événement : Soirée U+20000')), JSON.stringify(lignes));
    const annonce = lignes.find((ligne) => ligne.startsWith('Caractères absents'));
    assert.match(annonce, /U\+674E et U\+20000$/);
    assert.ok(!textesControle(m, { papier: 'A4', imposition: 'feuille', planches: 1 }).some((ligne) => ligne.startsWith('Caractères absents')));
  });

  test('un papier, une imposition, un nombre de planches ou des absents hors de leur domaine lèvent TypeError', () => {
    const m = modele(aReserve());
    const bon = { papier: 'A4', imposition: 'feuille', planches: 2 };
    for (const mauvais of [{ papier: 'A5' }, { papier: 'toString' }, { imposition: 'rame' }, { planches: -1 }, { planches: 1.5 }, { absents: 'x' }, { absents: [3] }]) {
      assert.throws(() => textesControle(m, { ...bon, ...mauvais }), TypeError, JSON.stringify(mauvais));
    }
  });
});

describe('planche : les refus de la production et leurs textes (§ 11.5, § 11.8)', () => {
  test('refusProduction relaie un refus de la mise en page avec le remède du contrat ; un autre code lève TypeError', () => {
    assert.deepEqual(refusProduction('PLANCHE_TROP_DE_TOURS', { tours: 40 }), {
      code: 'PLANCHE_TROP_DE_TOURS',
      details: { tours: 40, remede: null },
    });
    assert.deepEqual(refusProduction('PLANCHE_NOM_TROP_LONG', { participant: 3, personne: 'Ondine Lacasse' }), {
      code: 'PLANCHE_NOM_TROP_LONG',
      details: { participant: 3, personne: 'Ondine Lacasse', remede: { geste: 'ouvrirSection', section: 'participants' } },
    });
    for (const code of ['PLANCHE_DERIVE', 'RETENU_FAUTIF', 'toString', null]) {
      assert.throws(() => refusProduction(code, {}), TypeError, String(code));
    }
  });

  test('chaque refus de la planche se dit : le nombre de tours, la personne au nom trop long, chaque raison de la dérive', () => {
    assert.match(libelle('PLANCHE_TROP_DE_TOURS', { tours: 40, remede: null }), /\b40 tours\b/);
    assert.match(libelle('PLANCHE_NOM_TROP_LONG', { participant: 3, personne: 'Ondine Lacasse' }), /Ondine Lacasse/);
    assert.match(libelle('PLANCHE_NOM_TROP_LONG', { participant: 3 }), /n° 3\b/);
    const derive = libelle('PLANCHE_DERIVE', {
      raisons: [
        { code: 'PARTICIPANT_NON_PLACE', participant: 6, personne: 'Ondine Grisaille' },
        { code: 'TOURS_CHANGES', avant: 3, maintenant: 4 },
      ],
      remede: VERS_PROPOSITIONS,
    });
    assert.match(derive, /Ondine Grisaille/);
    assert.match(derive, /de 3 à 4/);
    assert.ok(libelle('PLANCHE_SANS_PLACEMENT', { remede: VERS_PROPOSITIONS }).length > 0);
  });
});
